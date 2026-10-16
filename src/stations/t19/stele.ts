import raw from '../../content/tram-19.json'
import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { sliced } from '../../core/chunk'
import { onPrefs } from '../../core/prefs'
import type { SceneCtx } from '../types'
import { blob, clamp, onSize, p2Defs, rng, stroke, type Pt } from '../../ui/part2/ink'
import { moon, paperLantern, pine, wash } from '../../ui/part2/paint'
import { findTakeaway, takeaway } from '../../ui/part2/takeaway'

const T = raw.scenes.stele
const f1 = (n: number) => n.toFixed(1)
type RGB = [number, number, number]

/** CSS colour (hex or rgb()) → 0…1 triple for the bake */
function rgbOf(css: string): RGB {
  const m = css.match(/rgba?\(([^)]+)\)/)
  if (m) {
    const [r, g, b] = m[1].split(/[\s,/]+/).map(Number)
    return [r / 255, g / 255, b / 255]
  }
  const x = css.replace('#', '')
  const n = parseInt(x.length === 3 ? x.replace(/./g, (c) => c + c) : x, 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}
const mix3 = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

/** one pass of a 3-tap box blur, in place (softens the carving's walls to a 1–2 px chisel slope, no more) */
function* soften(a: Float32Array, w: number, hh: number) {
  const tmp = new Float32Array(a.length)
  for (let y = 0; y < hh; y++) {
    const o = y * w
    for (let x = 0; x < w; x++) tmp[o + x] = (a[o + Math.max(0, x - 1)] + a[o + x] + a[o + Math.min(w - 1, x + 1)]) / 3
    if (y % 128 === 127) yield
  }
  for (let y = 0; y < hh; y++) {
    const o = y * w, up = Math.max(0, y - 1) * w, dn = Math.min(hh - 1, y + 1) * w
    for (let x = 0; x < w; x++) a[o + x] = (tmp[up + x] + tmp[o + x] + tmp[dn + x]) / 3
    if (y % 128 === 127) yield
  }
}

interface Sign { x: number; y: number; w: number; hh: number }
interface Bake { base: HTMLCanvasElement; rake: HTMLCanvasElement[]; w: number; hh: number; dpr: number }

/**
 * Scene 4 · read the stele without being fooled (LOW, straight on, canvas). Under the tiled eaves of a pavilion stands a
 * polished black stele — a slab with real thickness, a chamfered head, veins in the stone, the moon's rim down its right edge
 * and a long reflection down its face — on a stepped plinth. A mock press release is cut into it: the five loud claims cut
 * deep and filled with pale dust, readable at once under the moon. Beside each claim a shallow carving, invisible head-on.
 * The cursor is a paper lantern: its raking light (baked once from a height map of the carving at the screen's own
 * resolution: a moonlit base and eight grazing lamps round the compass) catches one wall of every groove and shadows the
 * other, and brings each faint sign up out of the stone. A found sign takes a red seal; its question hangs from the beam on a
 * paper strip; the plinth keeps the tally in strokes of 正 cut into its face. Five: an ink rubbing slides out of the slot.
 */
export function steleScene(ctx: SceneCtx) {
  p2Defs()
  const low = ctx.quality === 'low'
  const found = new Set<number>()
  const hall = s('svg', { class: 't19s-hall', 'aria-hidden': 'true' })
  const cv = h('canvas', { class: 't19s-cv', 'aria-hidden': 'true' })
  const glow = h('div', { class: 't19s-glow', 'aria-hidden': 'true' })
  const lamp = h('div', { class: 't19s-lamp', 'aria-hidden': 'true' })
  const seals = h('div', { class: 't19s-seals', 'aria-hidden': 'true' })
  const lines = T.lines.map((l, i) => {
    const b = h('button', { class: 't19s-line', type: 'button', 'aria-label': l.aria })
    b.addEventListener('focus', () => aim(i, false))
    b.addEventListener('click', () => aim(i, true))
    return b
  })
  const face = h('div', { class: 't19s-face', role: 'group', 'aria-label': T.lanternAria }, cv, seals, glow, ...lines)
  const tally = s('svg', { class: 't19s-tally', viewBox: '0 0 40 40', 'aria-hidden': 'true' })
  const count = h('p', { class: 'p2-eyebrow t19s-count' }, fill(T.found, { n: 0 }))
  // the questions hang from the beam on paper strips, one under another on their strings
  const read = h('div', { class: 't19s-read' })
  const side = h('div', { class: 't19s-side' }, read)
  const foot = h('div', { class: 't19s-foot' }, count, ctx.fact(T.mockNote as Fact, 'p', 't19s-note'))
  const slot = h('div', { class: 't19s-slot' })
  const root = h('div', { class: `t19s${low ? ' low' : ''}` }, hall, face, tally, slot, side, foot, lamp)
  root.setAttribute('aria-label', T.art)
  ctx.art.append(root)
  ctx.prompt(T.prompt)

  let bake: Bake | null = null
  let signs: Sign[] = []
  let fx = 0, fy = 0, fw = 1, fh = 1 // the stele face in root px
  let lx = -1e4, ly = -1e4 // the lantern, face px
  let R = 120
  let raf = 0
  let job: { cancel(): void } | null = null
  let palKey = ''
  ctx.onCleanup(() => {
    cancelAnimationFrame(raf)
    job?.cancel()
  })
  const lit = h('canvas')
  const lctx = lit.getContext('2d')!
  const fade = h('canvas') // the lantern's soft round reach, drawn once per size
  let faceBox: DOMRect | null = null

  /**
   * The moonlit base, then where the lantern is: the two raking bakes nearest its bearing (light falls from the lantern's
   * side toward the middle of the stone), blended by angle, faded by a soft round mask. Four drawImage, no loop.
   */
  function draw() {
    raf = 0
    const b = bake
    if (!b) return
    const g = cv.getContext('2d')!
    g.drawImage(b.base, 0, 0)
    if (lx < -1000 || !b.rake.length) return
    const r = Math.round(R * b.dpr)
    const cx = lx * b.dpr, cy = ly * b.dpr
    if (lit.width !== r * 2) {
      lit.width = lit.height = fade.width = fade.height = r * 2
      const fg = fade.getContext('2d')!
      const rg = fg.createRadialGradient(r, r, 0, r, r, r)
      rg.addColorStop(0, 'rgba(0,0,0,1)')
      rg.addColorStop(0.35, 'rgba(0,0,0,0.92)')
      rg.addColorStop(0.7, 'rgba(0,0,0,0.45)')
      rg.addColorStop(1, 'rgba(0,0,0,0)')
      fg.fillStyle = rg
      fg.fillRect(0, 0, r * 2, r * 2)
    }
    const n = b.rake.length
    let i0 = 0, i1 = 0, wgt = 0
    if (n > 1) {
      const th = Math.atan2(ly - fh / 2, lx - fw / 2) // where the lantern stands, seen from the middle of the stone
      const u = ((((th / (Math.PI * 2)) * n) % n) + n) % n
      i0 = Math.floor(u) % n
      i1 = (i0 + 1) % n
      wgt = u - Math.floor(u)
    }
    lctx.globalCompositeOperation = 'source-over'
    lctx.globalAlpha = 1
    lctx.clearRect(0, 0, r * 2, r * 2)
    lctx.drawImage(b.rake[i0], cx - r, cy - r, r * 2, r * 2, 0, 0, r * 2, r * 2)
    if (wgt > 0.02) {
      lctx.globalAlpha = wgt
      lctx.drawImage(b.rake[i1], cx - r, cy - r, r * 2, r * 2, 0, 0, r * 2, r * 2)
      lctx.globalAlpha = 1
    }
    lctx.globalCompositeOperation = 'destination-in'
    lctx.drawImage(fade, 0, 0)
    g.drawImage(lit, cx - r, cy - r)
    // whatever sign the light has raked is found
    for (let i = 0; i < signs.length; i++) {
      const sg = signs[i]
      if (Math.hypot(sg.x + sg.w / 2 - lx, sg.y + sg.hh / 2 - ly) < R * 0.62) reveal(i)
    }
  }
  const redraw = () => void (raf ||= requestAnimationFrame(draw))
  function setLamp(x: number, y: number) {
    lx = x
    ly = y
    glow.style.transform = `translate(${f1(x)}px, ${f1(y)}px)`
    lamp.style.transform = `translate(${f1(fx + x)}px, ${f1(fy + y)}px)`
    root.classList.add('lit')
    redraw()
  }
  /** keyboard / tap on a line: the lantern goes to its sign (and reveals it on Enter) */
  function aim(i: number, go: boolean) {
    const sg = signs[i]
    if (!sg) return
    setLamp(sg.x + sg.w / 2 - R * 0.22, sg.y + sg.hh / 2 - R * 0.1)
    if (go) reveal(i)
  }

  // the lantern follows the mouse over the stele; on touch it follows a drag (taps on a line go through the buttons)
  face.addEventListener('pointerenter', () => (faceBox = null))
  face.addEventListener('pointermove', (e) => {
    if (low || (e.pointerType !== 'mouse' && !e.buttons)) return
    const b = (faceBox ??= face.getBoundingClientRect())
    setLamp(e.clientX - b.left, e.clientY - b.top)
  })
  face.addEventListener('pointerdown', (e) => {
    if (low || e.pointerType === 'mouse') return
    const b = (faceBox = face.getBoundingClientRect())
    setLamp(e.clientX - b.left, e.clientY - b.top)
  })

  function reveal(i: number) {
    const l = T.lines[i]
    read.setAttribute('aria-live', 'polite')
    if (found.has(i)) return
    found.add(i)
    lines[i].setAttribute('aria-label', `${l.aria} · ${l.sign}`)
    const sg = signs[i]
    const seal = h('span', { class: 't19s-seal' })
    if (sg) Object.assign(seal.style, { left: `${f1(sg.x + sg.w + 4)}px`, top: `${f1(sg.y + sg.hh * 0.1)}px` })
    seals.append(seal)
    read.prepend(h('div', { class: 't19s-strip', style: `--rot:${(found.size % 2 ? -1 : 1) * (0.8 + (i % 3) * 0.5)}deg` }, h('p', { class: 't19s-sign-big' }, l.sign), h('p', { class: 't19s-q' }, l.question)))
    ctx.chime('tap')
    count.textContent = fill(T.found, { n: found.size })
    tally.querySelectorAll('.t19s-tally-cut').forEach((p, k) => p.classList.toggle('on', k < found.size))
    if (found.size === T.lines.length) finish()
  }

  function finish() {
    const card = findTakeaway(T.takeaway)
    ctx.insight(T.insight as Fact, T.detail as Fact)
    if (!card) return
    root.classList.add('carded')
    slot.append(h('div', { class: 't19s-card' }, takeaway(card, null, ctx.onCleanup)))
  }

  // ── layout + bake
  let thick = 10
  function layout() {
    const W = ctx.art.clientWidth, H = ctx.art.clientHeight
    if (W < 60 || H < 60) return
    faceBox = null
    root.style.height = `${f1(H)}px`
    const tall = W / H < 1.05
    root.classList.toggle('tall', tall)
    const roofH = tall ? H * 0.075 : H * 0.12
    // the stele, a little left of centre on wide screens (the strips hang to its right); seven-tenths of a phone's width
    fw = tall ? Math.min(W * 0.7, 360) : clamp(Math.min(W * 0.34, H * 0.58), 300, 520)
    fh = tall ? Math.min(H * 0.5, fw * 1.38) : Math.min(H * 0.62, fw * 1.22)
    thick = clamp(fw * 0.028, 8, 14)
    fx = tall ? (W - fw) / 2 - thick / 2 : W * 0.5 - fw * 0.5 - Math.min(W * 0.13, 200)
    fy = tall ? roofH + Math.min(H * 0.2, 150) : roofH + H * 0.07
    R = clamp(fw * 0.24, 70, 130)
    Object.assign(face.style, { left: `${f1(fx)}px`, top: `${f1(fy)}px`, width: `${f1(fw)}px`, height: `${f1(fh)}px` })
    // a chamfered head, cut by hand: not a rounded tablet
    const chf = fw * 0.07
    face.style.clipPath = `polygon(${f1(chf)}px 0, ${f1(fw - chf)}px 0, ${f1(fw)}px ${f1(chf)}px, ${f1(fw)}px 100%, 0 100%, 0 ${f1(chf)}px)`
    const plinthY = fy + fh, plinthH = clamp(H * 0.08, 34, 70)
    const ts = Math.max(30, plinthH * 0.62)
    Object.assign(tally.style, { left: `${f1(fx + fw - ts * 1.25)}px`, top: `${f1(plinthY + plinthH * 0.5 - ts * 0.48)}px`, width: `${f1(ts)}px`, height: `${f1(ts)}px` })
    Object.assign(slot.style, { left: `${f1(fx - 10)}px`, top: `${f1(plinthY + plinthH * 0.45)}px`, width: `${f1(fw + 20)}px` })
    slot.style.setProperty('--room', `${f1(plinthY + plinthH * 0.45 - 8)}px`)
    const beamY = roofH + clamp(H * 0.016, 7, 14) + 4
    if (tall) {
      Object.assign(side.style, { left: '14px', right: '14px', top: `${f1(beamY)}px`, width: 'auto', height: `${f1(fy - beamY - 8)}px` })
      Object.assign(foot.style, { left: '16px', right: '16px', top: `${f1(plinthY + plinthH + 10)}px`, width: 'auto' })
    } else {
      const sx = fx + fw + thick + clamp(W * 0.06, 40, 90)
      Object.assign(side.style, { left: `${f1(sx)}px`, top: `${f1(beamY)}px`, width: `${f1(Math.min(270, W - sx - 140))}px`, right: '', height: `${f1(fh + fy - beamY)}px` })
      Object.assign(foot.style, { left: `${f1(sx)}px`, top: `${f1(plinthY + 8)}px`, width: `${f1(Math.min(270, W - sx - 140))}px`, right: '' })
    }
    face.style.setProperty('--r', `${f1(R)}px`)
    paintHall(W, H, roofH, plinthY, plinthH, tall)
    paintTally()
    startBake()
  }

  /** the pavilion: moon and pine beyond, two round columns, tiled eaves with upturned corners, the beam, the stele's body, the plinth */
  function paintHall(W: number, H: number, roofH: number, plinthY: number, plinthH: number, tall: boolean) {
    const r = rng(1931)
    hall.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    const colW = clamp(W * 0.03, 14, 34)
    const cL = tall ? colW * 0.3 : fx - clamp(W * 0.1, 50, 150), cR = tall ? W - colW * 0.3 : fx + fw + clamp(W * 0.36, 240, 500)
    const ey = roofH
    // the eaves: a long low line sweeping up at the corners just past the columns
    const over = tall ? W * 0.12 : clamp(W * 0.09, 60, 140)
    const x0 = cL - over, x1 = cR + over
    const rise = clamp(roofH * 0.75, 18, 74)
    const eaveAt = (u: number) => ey - rise * Math.pow(Math.abs(u * 2 - 1), 4.5) + roofH * 0.04 * (1 - (u * 2 - 1) ** 2)
    const eave: Pt[] = Array.from({ length: 49 }, (_, i) => [x0 + ((x1 - x0) * i) / 48, eaveAt(i / 48)])
    // yin-yang tiles: convex caps (lit on the moon side) over concave channels, converging up the roof; round end caps on the eave
    let caps = '', capLit = '', channels = '', ends = ''
    const nT = Math.round((x1 - x0) / clamp(W * 0.018, 12, 26))
    for (let i = 0; i <= nT; i++) {
      const u = i / nT
      const bx = x0 + (x1 - x0) * u, by = eaveAt(u)
      const lean = (u - 0.5) * roofH * 0.9
      const tw = clamp(W * 0.006, 4, 9)
      if (i % 2) {
        caps += stroke([[bx - lean, -12], [bx - lean * 0.4, by * 0.45], [bx, by - 3]], tw, 0.02, 0.05, 0.85)
        capLit += stroke([[bx - lean + tw * 0.25, -12], [bx - lean * 0.4 + tw * 0.25, by * 0.45], [bx + tw * 0.25, by - 4]], tw * 0.28, 0.1, 0.1, 0.4)
        ends += `M${f1(bx + tw * 0.62)} ${f1(by - 1)}a${f1(tw * 0.62)} ${f1(tw * 0.62)} 0 1 0 ${f1(-tw * 1.24)} 0a${f1(tw * 0.62)} ${f1(tw * 0.62)} 0 1 0 ${f1(tw * 1.24)} 0`
      } else channels += stroke([[bx - lean, -12], [bx - lean * 0.4, by * 0.45], [bx, by - 2]], tw * 0.7, 0.02, 0.05, 0.85)
    }
    const roofD = `M${eave.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}L${f1(x1)} -20L${f1(x0)} -20Z`
    // the fascia under the tiles and the beam with its thickness: a lit top edge, a dark face, a shadow under it
    const fascia = clamp(H * 0.012, 5, 10)
    const fasciaD = `M${eave.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}L${eave.slice().reverse().map(([x, y]) => `${f1(x)} ${f1(y + fascia)}`).join('L')}Z`
    const bt = clamp(H * 0.018, 8, 16)
    const beamTop = ey + fascia + 3
    const beamD = `M${f1(cL - colW)} ${f1(beamTop)}H${f1(cR + colW)}V${f1(beamTop + bt)}H${f1(cL - colW)}Z`
    // round columns: a dark flank, a lit flank toward the moon, a stone base and a bracket under the beam
    const col = (x: number) => `M${f1(x - colW / 2)} ${f1(beamTop + bt)}H${f1(x + colW / 2)}V${f1(H + 10)}H${f1(x - colW / 2)}Z`
    const colLit = (x: number) => `M${f1(x + colW * 0.12)} ${f1(beamTop + bt)}H${f1(x + colW * 0.36)}V${f1(H + 10)}H${f1(x + colW * 0.12)}Z`
    const floorY = plinthY + plinthH
    const base = (x: number) => `M${f1(x - colW * 0.85)} ${f1(floorY - colW * 0.15)}H${f1(x + colW * 0.85)}L${f1(x + colW)} ${f1(floorY + colW * 0.35)}H${f1(x - colW)}Z`
    const bracket = (x: number) => `M${f1(x - colW * 1.1)} ${f1(beamTop + bt)}H${f1(x + colW * 1.1)}L${f1(x + colW * 0.6)} ${f1(beamTop + bt + colW * 0.7)}H${f1(x - colW * 0.6)}Z`
    // the stele's body: its right flank (the slab's thickness) catching the moon on its edge, the chamfers of its head
    const ch = fw * 0.07 // chamfer
    const sideD = `M${f1(fx + fw)} ${f1(fy + ch)}L${f1(fx + fw + thick)} ${f1(fy + ch - thick * 0.45)}L${f1(fx + fw + thick)} ${f1(plinthY - thick * 0.3)}L${f1(fx + fw)} ${f1(plinthY)}Z`
    const headD = `M${f1(fx + fw - ch)} ${f1(fy)}L${f1(fx + fw - ch + thick)} ${f1(fy - thick * 0.45)}L${f1(fx + fw + thick)} ${f1(fy + ch - thick * 0.45)}L${f1(fx + fw)} ${f1(fy + ch)}Z`
    const rimD = stroke([[fx + fw + thick, fy + ch - thick * 0.45], [fx + fw + thick, plinthY - thick * 0.3]], 1.6, 0.05, 0.1, 0.5) + stroke([[fx + fw - ch + thick, fy - thick * 0.45], [fx + fw + thick, fy + ch - thick * 0.45]], 1.4, 0.1, 0.1, 0.5)
    // the plinth in two steps: lit treads, darker risers; contact shadows under the stele and under the plinth
    const p1 = plinthH * 0.56
    const pa = fx - 18, pb = fx + fw + thick + 18
    const step1 = `M${f1(pa)} ${f1(plinthY)}H${f1(pb)}V${f1(plinthY + p1)}H${f1(pa)}Z`
    const tread1 = `M${f1(pa + 4)} ${f1(plinthY - 5)}H${f1(pb + 4)}L${f1(pb)} ${f1(plinthY)}H${f1(pa)}Z`
    const step2 = `M${f1(pa - 16)} ${f1(plinthY + p1)}H${f1(pb + 16)}V${f1(floorY)}H${f1(pa - 16)}Z`
    const tread2 = `M${f1(pa - 12)} ${f1(plinthY + p1 - 5)}H${f1(pb + 20)}L${f1(pb + 16)} ${f1(plinthY + p1)}H${f1(pa - 16)}Z`
    const pineX = tall ? W * 1.02 : cR + colW * 1.4
    hall.replaceChildren(
      s('defs', null,
        s('linearGradient', { id: 't19s-colg', x1: 0, y1: 0, x2: 1, y2: 0 },
          s('stop', { offset: 0, style: 'stop-color:var(--wash)' }),
          s('stop', { offset: 0.55, style: 'stop-color:color-mix(in srgb, var(--wash) 70%, var(--step-lo))' }),
          s('stop', { offset: 0.8, style: 'stop-color:var(--step-lo)' }),
          s('stop', { offset: 1, style: 'stop-color:color-mix(in srgb, var(--wash) 80%, var(--step-lo))' })),
        s('linearGradient', { id: 't19s-plg', x1: 0, y1: 0, x2: 0, y2: 1 },
          s('stop', { offset: 0, style: 'stop-color:color-mix(in srgb, var(--rock-mid) 60%, var(--rock-lo))' }),
          s('stop', { offset: 1, style: 'stop-color:var(--rock-lo)' })),
        s('linearGradient', { id: 't19s-side', x1: 0, y1: 0, x2: 1, y2: 0 },
          s('stop', { offset: 0, style: 'stop-color:var(--t19s-stone-lo)' }),
          s('stop', { offset: 1, style: 'stop-color:var(--t19s-stone)' }))),
      moon(tall ? W * 0.84 : cR - colW * 1.6, roofH + H * 0.1, clamp(W * 0.018, 10, 18), 1932, true),
      pine(pineX, floorY + 10, H * (tall ? 0.34 : 0.5), 1933, -1),
      wash(blob((cL + cR) / 2, floorY + H * 0.05, (cR - cL) * 0.62, H * 0.05, 1934, 0.1), 0.22),
      s('path', { class: 't19s-floor', d: `M${f1(x0)} ${f1(floorY)}H${f1(x1)}V${f1(H + 20)}H${f1(x0)}Z` }),
      s('path', { class: 't19s-floor-ink', d: stroke([[x0, floorY + 1], [x1, floorY + 1]], 2, 0.05, 0.05, 0.4) }),
      s('ellipse', { class: 't19s-pool', cx: f1(fx + fw * 0.35), cy: f1(floorY + 6), rx: f1(fw * 0.5), ry: f1(H * 0.025) }),
      s('ellipse', { class: 't19s-contact', cx: f1((pa + pb) / 2 + 6), cy: f1(floorY + 3), rx: f1((pb - pa) * 0.6), ry: f1(clamp(H * 0.012, 4, 9)) }),
      s('path', { class: 't19s-riser', d: step2, fill: 'url(#t19s-plg)' }),
      s('path', { class: 't19s-tread', d: tread2 }),
      s('path', { class: 't19s-riser', d: step1, fill: 'url(#t19s-plg)' }),
      s('path', { class: 't19s-tread', d: tread1 }),
      s('path', { class: 't19s-plinth-ink', d: stroke([[pa, plinthY + 0.5], [pb, plinthY + 0.5]], 1.6, 0.04, 0.04, 0.5) + stroke([[pa - 16, plinthY + p1 + 0.5], [pb + 16, plinthY + p1 + 0.5]], 1.6, 0.04, 0.04, 0.5), filter: 'url(#ink-rough)' }),
      s('rect', { class: 't19s-slab-sh', x: f1(fx + 4), y: f1(plinthY - 3), width: f1(fw + thick), height: 6, rx: 3 }),
      s('path', { class: 't19s-flank', d: sideD, fill: 'url(#t19s-side)' }),
      s('path', { class: 't19s-head', d: headD }),
      s('path', { class: 't19s-rim', d: rimD }),
      s('path', { class: 't19s-col', d: col(cL) + col(cR), fill: 'url(#t19s-colg)' }),
      s('path', { class: 't19s-col-lit', d: colLit(cL) + colLit(cR) }),
      s('path', { class: 't19s-col-base', d: base(cL) + base(cR) }),
      s('path', { class: 't19s-beam-sh', d: `M${f1(cL - colW)} ${f1(beamTop + bt)}H${f1(cR + colW)}V${f1(beamTop + bt + bt * 0.8)}H${f1(cL - colW)}Z` }),
      s('path', { class: 't19s-beam', d: beamD }),
      s('path', { class: 't19s-beam-lit', d: `M${f1(cL - colW)} ${f1(beamTop)}H${f1(cR + colW)}V${f1(beamTop + bt * 0.22)}H${f1(cL - colW)}Z` }),
      s('path', { class: 't19s-bracket', d: bracket(cL) + bracket(cR) }),
      s('path', { class: 't19s-roof', d: roofD, filter: 'url(#ink-wash)' }),
      s('path', { class: 't19s-channel', d: channels }),
      s('path', { class: 't19s-cap', d: caps }),
      s('path', { class: 't19s-cap-lit', d: capLit }),
      s('path', { class: 't19s-fascia', d: fasciaD }),
      s('path', { class: 't19s-tile-end', d: ends }),
      s('path', { class: 't19s-eave', d: stroke(eave, 3, 0.04, 0.04, 0.5), filter: 'url(#ink-rough)' }))
    void r
  }

  /** the tally cut into the plinth's face: the five strokes of 正, each groove filled with vermilion as a sign is found */
  function paintTally() {
    const st: [Pt, Pt][] = [[[7, 7], [33, 7]], [[20, 7], [20, 34]], [[20, 20], [31, 20]], [[10, 17], [10, 34]], [[4, 34], [36, 34]]]
    tally.replaceChildren(...st.flatMap(([a, b], k) => [
      s('path', { class: 't19s-tally-lip', d: stroke([[a[0], a[1] + 1.4], [b[0], b[1] + 1.4]], 4.2, 0.15, 0.2, 0.45) }),
      s('path', { class: `t19s-tally-cut${k < found.size ? ' on' : ''}`, d: stroke([a, b], 4.2, 0.15, 0.2, 0.45) }),
    ]))
  }

  function startBake() {
    job?.cancel()
    const cs = getComputedStyle(document.documentElement)
    const v = (k: string) => cs.getPropertyValue(k).trim()
    const keys = ['--rock-lo', '--rock-mid', '--rock-hi', '--umbra', '--moon', '--lantern', '--wash']
    palKey = keys.map(v).join()
    // the height map at the screen's own resolution (up to 2×): crisp grooves, not an enlarged blur
    const dpr = Math.min(devicePixelRatio || 1, low ? 1.5 : 2)
    const w = Math.round(fw * dpr), hh = Math.round(fh * dpr)
    job = sliced(bakeSteps(w, hh, dpr, { lo: rgbOf(v('--rock-lo')), mid: rgbOf(v('--rock-mid')), hi: rgbOf(v('--rock-hi')), umbra: rgbOf(v('--umbra')), moon: rgbOf(v('--moon')), lamp: rgbOf(v('--lantern')), wash: rgbOf(v('--wash')), dark: document.documentElement.dataset.theme === 'dark' }), { sync: ctx.reduced, budget: 6 })
  }

  function* bakeSteps(w: number, hh: number, dpr: number, pal: { lo: RGB; mid: RGB; hi: RGB; umbra: RGB; moon: RGB; lamp: RGB; wash: RGB; dark: boolean }) {
    // 1 · the carving as a mask: deep claims (the title and the five lines), shallow signs beside them
    const mk = h('canvas')
    mk.width = w
    mk.height = hh
    const m = mk.getContext('2d', { willReadFrequently: true })!
    const serif = getComputedStyle(document.documentElement).getPropertyValue('--serif').trim() || 'serif'
    const pad = w * 0.085
    const maxW = w - pad * 2
    let fs = w * 0.058
    const wrap = (text: string, size: number, weight: number) => {
      m.font = `${weight} ${size}px ${serif}`
      const words = text.split(' ')
      const out: string[] = []
      let cur = ''
      for (const wd of words) {
        const t = cur ? `${cur} ${wd}` : wd
        if (m.measureText(t).width > maxW && cur) out.push(cur), (cur = wd)
        else cur = t
      }
      if (cur) out.push(cur)
      return out
    }
    type Row = { text: string; size: number; weight: number; depth: number; sign?: number; y: number }
    let rows: Row[] = []
    for (let tries = 0; tries < 8; tries++) {
      rows = []
      let y = pad * 1.2
      const ts = fs * 0.62
      for (const t of wrap(T.mockTitle, ts, 600)) rows.push({ text: t, size: ts, weight: 600, depth: 0.9, y }), (y += ts * 1.35)
      y += fs * 0.55
      T.lines.forEach((l, i) => {
        for (const t of wrap(l.text, fs, 600)) rows.push({ text: t, size: fs, weight: 600, depth: 1, y }), (y += fs * 1.28)
        const ss = Math.max(13 * dpr, fs * 0.6)
        rows.push({ text: l.sign, size: ss, weight: 500, depth: 0.2, sign: i, y })
        y += ss * 1.25 + fs * 0.32
      })
      if (y < hh - pad * 0.6) break
      fs *= 0.92
    }
    m.fillStyle = '#000'
    m.fillRect(0, 0, w, hh)
    m.textBaseline = 'top'
    const sgs: Sign[] = []
    const lineTop: number[] = [], lineBot: number[] = []
    for (const r0 of rows) {
      m.font = `${r0.weight} ${r0.size}px ${serif}`
      const gray = Math.round(r0.depth * 255)
      m.fillStyle = `rgb(${gray},${gray},${gray})`
      if (r0.sign != null) {
        const tw = m.measureText(r0.text).width
        const x = w - pad - tw
        m.fillText(r0.text, x, r0.y)
        sgs[r0.sign] = { x: x / dpr, y: r0.y / dpr, w: tw / dpr, hh: (r0.size * 1.1) / dpr }
        lineBot[r0.sign] = (r0.y + r0.size * 1.2) / dpr
      } else {
        m.fillText(r0.text, pad, r0.y)
        if (r0.size === fs) lineTop[sgs.length] ??= r0.y / dpr
      }
    }
    yield
    signs = sgs
    T.lines.forEach((_, i) => {
      const top = lineTop[i] ?? 0, bot = lineBot[i] ?? top + 40
      Object.assign(lines[i].style, { top: `${f1(top - 4)}px`, height: `${f1(bot - top + 8)}px` })
    })

    // 2 · height: the carving cut in with a 1–2 px chisel slope; what is cut deep holds pale dust
    const px = m.getImageData(0, 0, w, hh).data
    const H0 = new Float32Array(w * hh)
    const dust = new Float32Array(w * hh)
    const deep = new Uint8Array(w * hh)
    for (let i = 0; i < w * hh; i++) {
      const a = px[i * 4] / 255
      H0[i] = a
      dust[i] = a > 0.45 ? Math.min(1, (a - 0.45) / 0.4) : 0
      deep[i] = a > 0.5 ? 1 : 0
    }
    yield
    // where the moon may see relief: the deep cuts and a couple of pixels round them (their walls); the shallow signs stay
    // flat to the moon, so head-on they are invisible
    const near = new Uint8Array(w * hh)
    const rr = Math.max(2, Math.round(dpr * 1.5))
    for (let y = 0; y < hh; y++) {
      for (let x = 0; x < w; x++) {
        if (!deep[y * w + x]) continue
        for (let dy = -rr; dy <= rr; dy++) {
          const yy = y + dy
          if (yy < 0 || yy >= hh) continue
          const o = yy * w
          for (let dx = -rr; dx <= rr; dx++) {
            const xx = x + dx
            if (xx >= 0 && xx < w) near[o + xx] = 1
          }
        }
      }
      if (y % 64 === 63) yield
    }
    if (dpr > 1.2) yield* soften(H0, w, hh)
    // the stone: fine grain and a few long pale veins (decided once, the same at every size)
    const vr = rng(1940)
    const veins: { a: number; b: number; c: number; f: number; wd: number }[] = Array.from({ length: 4 }, () => ({ a: vr(), b: vr() * 0.5 - 0.25, c: vr() * 6, f: 2 + vr() * 4, wd: 0.002 + vr() * 0.003 }))
    // 3 · normals by Sobel: a sharp edge on each wall of every groove
    const nx = new Float32Array(w * hh), ny = new Float32Array(w * hh), nz = new Float32Array(w * hh), veinK = new Float32Array(w * hh)
    const K = 0.55 * Math.min(2, dpr)
    for (let y = 0; y < hh; y++) {
      const ym = Math.max(0, y - 1) * w, y0 = y * w, yp = Math.min(hh - 1, y + 1) * w
      const v = y / hh
      for (let x = 0; x < w; x++) {
        const u = x / w
        let vk = 0
        for (const vn of veins) {
          const dv = v - (vn.a + vn.b * u + 0.04 * Math.sin(u * vn.f + vn.c))
          if (Math.abs(dv) < vn.wd * 3) vk = Math.max(vk, Math.exp(-(dv * dv) / (vn.wd * vn.wd)))
        }
        veinK[y0 + x] = vk
        const xm = Math.max(0, x - 1), xp = Math.min(w - 1, x + 1)
        const gx = H0[ym + xp] + 2 * H0[y0 + xp] + H0[yp + xp] - H0[ym + xm] - 2 * H0[y0 + xm] - H0[yp + xm]
        const gy = H0[yp + xm] + 2 * H0[yp + x] + H0[yp + xp] - H0[ym + xm] - 2 * H0[ym + x] - H0[ym + xp]
        // grooves are cut in: height falls where the mask rises
        const hx = -gx * K, hy = -gy * K
        const l = Math.hypot(hx, hy, 1)
        const i = y0 + x
        nx[i] = -hx / l
        ny[i] = -hy / l
        nz[i] = 1 / l
      }
      if (y % 48 === 47) yield
    }
    const { lo, mid, hi, umbra, moon: mc, lamp: lc, dark } = pal
    // polished black stone; by night a step lighter so it does not sink into the dark
    const stone: RGB = dark ? mix3(lo, mid, 0.3) : mix3(umbra, lo, 0.3)
    const vein: RGB = mix3(stone, hi, dark ? 0.32 : 0.22)
    const dustC: RGB = dark ? mix3(hi, mc, 0.35) : mix3(hi, mid, 0.15)
    const make = () => {
      const c = h('canvas')
      c.width = w
      c.height = hh
      return c
    }
    /** shade rows y0…y1 of img. L: light direction (x, y screen-down, z out of the stone); moon: the moonlit base */
    const shade = (img: ImageData, Lx: number, Ly: number, Lz: number, k: number, c: RGB, isMoon: boolean, y0: number, y1: number) => {
      const ll = Math.hypot(Lx, Ly, Lz)
      Lx /= ll
      Ly /= ll
      Lz /= ll
      const Hl = Math.hypot(Lx, Ly, Lz + 1)
      const hx = Lx / Hl, hy = Ly / Hl, hz = (Lz + 1) / Hl
      const d = img.data
      for (let y = y0; y < y1; y++) {
        const v = y / hh
        for (let x = 0; x < w; x++) {
          const i = y * w + x
          const u = x / w
          // the stone's own face: veins, the dust in the deep cuts
          const vk = veinK[i]
          const al = dust[i]
          let r0 = stone[0] + (vein[0] - stone[0]) * vk * 0.6, g0 = stone[1] + (vein[1] - stone[1]) * vk * 0.6, b0 = stone[2] + (vein[2] - stone[2]) * vk * 0.6
          r0 += (dustC[0] - r0) * al
          g0 += (dustC[1] - g0) * al
          b0 += (dustC[2] - b0) * al
          // the moon sees the deep cuts softly (no hard drop shadow under the letters), the lantern sees every wall
          const relief = isMoon ? (near[i] ? 0.45 : 0) : 1
          const Nx = nx[i] * relief, Ny = ny[i] * relief, Nz = relief ? nz[i] : 1
          const dif = Math.max(0, Nx * Lx + Ny * Ly + Nz * Lz)
          const sp = Math.pow(Math.max(0, Nx * hx + Ny * hy + Nz * hz), 40)
          let R0: number, G0: number, B0: number
          if (isMoon) {
            // the weak moon from the upper right: walls facing it lit, the others dark; a long reflection down the polish,
            // the moon's rim down the right-hand edge
            const shd = 0.3 + 0.75 * dif
            const streak = Math.exp(-Math.pow((u - 0.72 + v * 0.06) * 9, 2)) * (0.07 + 0.05 * (1 - v)) * (1 - al)
            const rim = Math.exp(-Math.pow((1 - u) * w / (3 * dpr), 2)) * 0.35
            R0 = r0 * shd + mc[0] * (streak + rim + sp * 0.18)
            G0 = g0 * shd + mc[1] * (streak + rim + sp * 0.18)
            B0 = b0 * shd + mc[2] * (streak + rim + sp * 0.18)
          } else {
            // the lantern grazing across: the wall that faces it flares warm, the far wall falls into shadow
            const amb = 0.6
            R0 = r0 * amb + (r0 * 0.5 + 0.22) * c[0] * dif * k + c[0] * sp * 0.4 * k
            G0 = g0 * amb + (g0 * 0.5 + 0.22) * c[1] * dif * k + c[1] * sp * 0.4 * k
            B0 = b0 * amb + (b0 * 0.5 + 0.22) * c[2] * dif * k + c[2] * sp * 0.4 * k
          }
          const o = i * 4
          d[o] = Math.min(255, R0 * 255)
          d[o + 1] = Math.min(255, G0 * 255)
          d[o + 2] = Math.min(255, B0 * 255)
          d[o + 3] = 255
        }
      }
    }
    const base = make()
    const bi = new ImageData(w, hh)
    for (let y = 0; y < hh; y += 12) {
      shade(bi, 0.35, -0.5, 0.8, 0, mc, true, y, Math.min(hh, y + 12))
      yield
    }
    base.getContext('2d')!.putImageData(bi, 0, 0)
    // the moonlit stone shows at once; the lantern's bakes follow
    const rake: HTMLCanvasElement[] = []
    bake = { base, rake, w, hh, dpr }
    cv.width = w
    cv.height = hh
    root.classList.add('baked')
    draw()
    const dirs = low ? [5] : [0, 1, 2, 3, 4, 5, 6, 7]
    const done: HTMLCanvasElement[] = []
    for (const k of dirs) {
      // light from angle k·45° (0 = from the right, screen y down), grazing low over the face
      const th = (k / 8) * Math.PI * 2
      const img = new ImageData(w, hh)
      for (let y = 0; y < hh; y += 12) {
        shade(img, Math.cos(th), Math.sin(th), 0.3, 1.35, lc, false, y, Math.min(hh, y + 12))
        yield
      }
      const c = make()
      c.getContext('2d')!.putImageData(img, 0, 0)
      done.push(c)
    }
    // low: the one bake (from the top left) serves every bearing
    rake.push(...(low ? Array.from({ length: 8 }, () => done[0]) : done))
    draw()
  }

  ctx.onCleanup(onPrefs(() => {
    const cs = getComputedStyle(document.documentElement)
    const v = (k: string) => cs.getPropertyValue(k).trim()
    if (['--rock-lo', '--rock-mid', '--rock-hi', '--umbra', '--moon', '--lantern', '--wash'].map(v).join() !== palKey) startBake()
  }))
  const lampArt = s('svg', { viewBox: '-20 -34 40 50', class: 't19s-lamp-svg' }, paperLantern(0, -30, 9, 1941, 12))
  lamp.append(lampArt)
  ctx.onCleanup(onSize(ctx.art, layout))
}
