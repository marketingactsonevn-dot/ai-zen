import './pens.css'
import { fill, h, s } from '../../core/dom'
import { onPrefs } from '../../core/prefs'
import { clamp, onDigit, onSize, rng, stableHeight, stroke, type Pt } from '../../ui/part2/ink'
import { paperLantern } from '../../ui/part2/paint'
import { inkStage, type InkKit } from '../../ui/part2/stage3d'
import type { SceneCtx } from '../types'
import { C } from './content'
import { F, f1, gdefs } from './kit'
import { bake, drawKoi, paintedDepth, readPal, SHARD, swimR, type Flat, type Pal } from './pens-paint'
import { buildPond, RB, type Pond } from './pond3d'

const K = C.scenes.pens
type Id = 'canvas' | 'p5' | 'phaser' | 'three' | 'engine'
const FLAT: Id[] = ['canvas', 'p5', 'phaser']

/** shading across each pen's shaft and the pot (stops are tokens, so a theme change needs no JS) */
function penDefs() {
  gdefs()
  if (document.getElementById('t36p-defs')) return
  const st = (o: number, c: string, a = 1) => s('stop', { offset: o, style: `stop-color:${c};stop-opacity:${a}` })
  const across = (id: string, ...stops: SVGStopElement[]) => s('linearGradient', { id, x1: 0, y1: 0, x2: 1, y2: 0 }, ...stops)
  const wood = 'color-mix(in srgb, var(--lantern) 48%, var(--rock-mid))'
  const woodLo = 'color-mix(in srgb, var(--lantern) 34%, var(--rock-lo))'
  document.getElementById('p2-defs')!.append(s('defs', { id: 't36p-defs' },
    across('t36p-bamboo', st(0, woodLo), st(0.22, wood), st(0.38, 'var(--rock-hi)'), st(0.55, wood), st(1, 'var(--umbra)', 0.9)),
    across('t36p-coal', st(0, 'var(--umbra)'), st(0.35, 'var(--wash)'), st(0.45, 'var(--ink-3)'), st(0.6, 'var(--wash)'), st(1, 'var(--umbra)')),
    across('t36p-lacquer', st(0, 'var(--umbra)'), st(0.3, 'color-mix(in srgb, var(--vermilion) 45%, var(--wash))'), st(0.42, 'color-mix(in srgb, var(--vermilion) 30%, var(--rock-hi))'), st(0.55, 'color-mix(in srgb, var(--vermilion) 45%, var(--wash))'), st(1, 'var(--umbra)')),
    across('t36p-metal', st(0, 'var(--rock-lo)'), st(0.3, 'var(--rock-mid)'), st(0.42, 'var(--card)'), st(0.6, 'var(--rock-mid)'), st(1, 'var(--umbra)')),
    across('t36p-hair', st(0, 'var(--umbra)'), st(0.4, 'var(--wash)'), st(0.55, 'var(--ink-3)'), st(1, 'var(--umbra)')),
    across('t36p-ferrule', st(0, 'var(--rock-lo)'), st(0.35, 'var(--lantern)'), st(0.5, 'var(--moon)'), st(0.7, 'var(--rock-mid)'), st(1, 'var(--umbra)')),
    across('t36p-pot', st(0, 'var(--t36-pot-lo)'), st(0.12, 'var(--t36-pot-a)'), st(0.3, 'var(--t36-pot-b)'), st(0.42, 'var(--t36-pot-hi)'), st(0.62, 'var(--t36-pot-a)'), st(0.88, 'var(--t36-pot-lo)'), st(1, 'var(--umbra)')),
    s('radialGradient', { id: 't36p-pool' }, st(0, 'var(--lantern)', 0.42), st(0.45, 'var(--lantern)', 0.14), st(1, 'var(--lantern)', 0)),
    s('radialGradient', { id: 't36p-cool' }, st(0, 'var(--moon)', 0.3), st(1, 'var(--moon)', 0)),
    s('linearGradient', { id: 't36p-beam', x1: 0, y1: 0, x2: 1, y2: 1 }, st(0, 'var(--moon)', 0.32), st(1, 'var(--moon)', 0.04))))
}

/** One pen standing tip-up (viewBox 0 0 30 240): charcoal, a wet round brush, a flat brush, a fine metal pen, a big brush. */
function penArt(id: Id): SVGSVGElement {
  const shaft = (w: number, y0: number, grad: string, nodes = false) => [
    s('path', { d: `M${f1(15 - w / 2)} ${y0}L${f1(15 - w / 2 + 0.6)} 240L${f1(15 + w / 2 - 0.6)} 240L${f1(15 + w / 2)} ${y0}Z`, fill: `url(#${grad})` }),
    nodes ? s('path', { class: 't36p-node', d: [120, 182].map((y) => `M${f1(15 - w / 2 - 0.4)} ${y}h${f1(w + 0.8)}v2.2h${f1(-w - 0.8)}Z`).join('') }) : null,
  ]
  const tip = (w: number, len: number, grad: string, wet = false) => s('path', { class: wet ? 't36p-wet' : '', d: `M15 0Q${f1(15 + w * 0.75)} ${f1(len * 0.55)} ${f1(15 + w / 2)} ${f1(len)}L${f1(15 - w / 2)} ${f1(len)}Q${f1(15 - w * 0.75)} ${f1(len * 0.55)} 15 0Z`, fill: `url(#${grad})` })
  const ferrule = (w: number, y: number, hh: number) => s('rect', { x: f1(15 - w / 2), y: f1(y), width: f1(w), height: f1(hh), rx: 0.8, fill: 'url(#t36p-ferrule)' })
  const parts: Record<Id, (SVGElement | null)[]> = {
    canvas: [...shaft(8, 14, 't36p-coal'), s('path', { d: 'M11 14L14.5 2L19 9L19 14Z', fill: 'url(#t36p-coal)' })],
    p5: [...shaft(6.5, 50, 't36p-bamboo', true), ferrule(8, 42, 10), tip(11, 44, 't36p-hair', true)],
    phaser: [...shaft(6.5, 44, 't36p-lacquer'), ferrule(13, 32, 13), s('path', { d: 'M8.5 4Q15 1 21.5 4L21.5 33L8.5 33Z', fill: 'url(#t36p-hair)' })],
    three: [...shaft(5, 30, 't36p-metal'), s('path', { d: 'M12.5 30L15 0L17.5 30Z', fill: 'url(#t36p-metal)' }), s('path', { class: 't36p-glint', d: 'M14.2 34L14.4 236' })],
    engine: [...shaft(10, 64, 't36p-bamboo', true), ferrule(12.5, 54, 13), tip(19, 56, 't36p-hair')],
  }
  return s('svg', { class: 't36p-penart', viewBox: '0 0 30 240', preserveAspectRatio: 'xMidYMax meet', 'aria-hidden': 'true' }, ...parts[id])
}

/** The bamboo pot the pens stand in (viewBox 0 0 200 200): a cut section of a thick culm — fibres, one node, the cut rim's
 *  pale wall, a dark mouth — lamp-lit from the left. */
function potArt(): SVGSVGElement {
  const r = rng(3620)
  let fib = ''
  for (let i = 0; i < 26; i++) {
    const x = 18 + r() * 164, y0 = 30 + r() * 40, y1 = y0 + 40 + r() * 110
    fib += `M${f1(x)} ${f1(y0)}Q${f1(x + (r() - 0.5) * 3)} ${f1((y0 + y1) / 2)} ${f1(x + (r() - 0.5) * 2)} ${f1(Math.min(186, y1))}`
  }
  return s('svg', { class: 't36p-potart', viewBox: '0 0 200 200', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    s('ellipse', { class: 't36p-contact', cx: 116, cy: 190, rx: 112, ry: 10 }),
    s('path', { d: 'M12 26L15 186Q100 199 185 186L188 26Z', fill: 'url(#t36p-pot)' }),
    s('path', { class: 't36p-fibre', d: fib }),
    // the node: a gentle swelling ring, shadowed under, lit on top
    s('path', { class: 't36p-node', d: 'M12.5 112Q100 125 187.5 112L187.5 117Q100 130 12.5 117Z' }),
    s('path', { class: 't36p-node-hi', d: 'M20 111Q100 123 180 111', fill: 'none' }),
    s('path', { class: 't36p-pot-hi', d: 'M58 34L60 180', fill: 'none' }),
    // the cut: a pale ring of wall, then the dark inside
    s('ellipse', { class: 't36p-potlight', cx: 62, cy: 90, rx: 70, ry: 95, fill: 'url(#t36p-pool)' }),
    s('ellipse', { class: 't36p-mouth-rim', cx: 100, cy: 26, rx: 88, ry: 13 }),
    s('ellipse', { class: 't36p-mouth', cx: 100, cy: 26.6, rx: 79, ry: 10 }),
    s('path', { class: 't36p-cut', d: 'M14 27Q100 41 186 27', fill: 'none' }))
}

/**
 * Scene 2 ★ — the easel in the night workshop (art direction §4 t36 `pens`): a frame on an easel holds a koi basin seen
 * from above; a bamboo pot of five pens stands in the lamplight. Each pen sweeps the frame with its own medium. The flat
 * pens (Canvas 2D, p5.js, Phaser) paint a sheet of paper: drag it and it only slides. The Three.js pen turns the frame
 * into a window — the same drag turns the basin in real 3D, the koi rolling through the moonlight. Godot / Unity pulls
 * the camera back until the basin is a corner of a whole garden and the frame becomes a device's bezel.
 * WebGL covers only the frame's inside (inkStage, idle 12 s, DPR 2 / 1.25); no WebGL: the 3D pens become paintings.
 */
export function pensScene(ctx: SceneCtx) {
  penDefs()
  const stableH = stableHeight(ctx, [F(K.insight)])
  const low = ctx.quality === 'low'
  const sources = C.sources as Record<string, { url?: string }>
  let P: Pal = readPal()
  let cur = -1 // which pen paints the frame (−1: none yet, a pencil underdrawing)
  const seen = new Set<number>()
  let done = false

  // ── the frame on its easel: a view (WebGL inside), the paper sheet over it, the brush that sweeps between pens
  const view = h('div', { class: 't36p-view' })
  const cv = h('canvas', { class: 't36p-cv', 'aria-hidden': 'true' })
  const g = cv.getContext('2d')!
  const svgSlot = h('div', { class: 't36p-svgslot', 'aria-hidden': 'true' })
  const sheet = h('div', { class: 't36p-sheet' }, cv, svgSlot)
  const sweep = s('svg', { class: 't36p-sweep', viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    s('path', { d: brushBand(), filter: 'url(#ink-rough)' }))
  const frame = h('div', { class: 't36p-frame is-flat' }, view, h('i', { class: 't36p-ledge', 'aria-hidden': 'true' }))
  // ── the pot and its pens; the slip of paper the chosen pen carries
  const pens = K.pens.map((p, i) => h('button', {
    class: `t36p-pen t36p-${p.id}`, type: 'button', 'aria-pressed': 'false', 'aria-label': fill(K.penAria, { name: p.name }), style: `--i:${i}`,
    onClick: () => choose(i),
  }, penArt(p.id as Id), h('span', { class: 't36p-name', 'aria-hidden': 'true' }, p.name)))
  const pot = h('div', { class: 't36p-pot', role: 'group', 'aria-label': K.group }, ...pens, potArt())
  const tag = h('div', { class: 't36p-tag', hidden: true })
  const back = s('svg', { class: 't36p-back', 'aria-hidden': 'true' })
  const near = s('svg', { class: 't36p-near', 'aria-hidden': 'true' })
  const thread = s('path', { class: 't36p-thread' })
  const threadSvg = s('svg', { class: 't36p-threads', 'aria-hidden': 'true' }, thread)
  const root = h('div', { class: 't36 t36p' }, back, h('p', { class: 'visually-hidden' }, K.art), frame, pot, near, threadSvg, tag)
  ctx.art.append(root)
  ctx.prompt(K.prompt)

  // ── the 3D garden in the frame
  let kit: InkKit | null = null
  let noGL = false
  const holder: { pond?: Pond } = {}
  const TOP = { yaw: 0.22, pitch: 1.28 }
  // made once the frame has its size (the first layout): a stage born in a 0 × 0 box never drew under reduced motion
  const startStage = () => inkStage(ctx, view, {
    label: K.frameAria, hint: K.frameHint, idle: 12, dpr: [2, 1.25], fov: 36,
    view: { ...TOP, yawRange: [-2.9, 2.9], pitchRange: [0.26, 1.34], fit: [2.15, 2.15], target: [0, 0.1, 0], shift: 0, zoomRange: [0.72, 2.8] },
    fallback: () => ((noGL = true), () => {}),
  }, function* (k) {
    yield* buildPond(k, holder)
    k.onFrame((_t, dt) => {
      const pd = holder.pond
      if (!pd || dt <= 0) return
      // swim while the garden is alive (quality high, someone near): slow circle, tail beating
      if (k.live) {
        pd.swim.a += dt * 0.32
        pd.swim.ph += dt * 5.2
        pd.place()
      }
      if (isFlat()) drawSheet()
    })
  }).ready.then((k) => {
    kit = k
    if (!k) return
    holder.pond?.theme()
    // a 3D pen chosen while the garden was still being built: take the camera there now
    if (cur >= 0 && !FLAT.includes(K.pens[cur].id as Id)) setPen(cur)
  })
  let staged = false
  view.append(sheet, sweep)

  // ── the flat painting on the sheet: baked once per size / theme / pen, the koi drawn on top each frame
  const base = document.createElement('canvas')
  let geo = { cx: 0, cy: 0, R: 1 }
  let VW = 0, VH = 0, dpr = 1
  let baked: Flat | '' = ''
  const flatOf = (): Flat => (cur < 0 ? 'none' : FLAT.includes(K.pens[cur].id as Id) ? (K.pens[cur].id as Flat) : 'none')
  const isFlat = () => cur < 0 || FLAT.includes(K.pens[cur].id as Id) || noGL
  function drawSheet() {
    const kind = flatOf()
    if (!VW) return
    if (baked !== kind) {
      geo = bake(base, kind, VW, VH, dpr, P)
      baked = kind
    }
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.drawImage(base, 0, 0)
    if (kind === 'none') return
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    const pd = holder.pond
    const a = pd ? pd.swim.a : 2.4, ph = pd ? pd.swim.ph : 0
    const R = swimR(a) * geo.R
    const x = geo.cx + Math.cos(a) * R, y = geo.cy + Math.sin(a) * R
    const hit = clamp(1 - Math.hypot(x - geo.cx - SHARD[0] * geo.R, y - geo.cy - SHARD[1] * geo.R) / (geo.R * 0.32), 0, 1)
    drawKoi(g, kind, x, y, Math.atan2(Math.cos(a), -Math.sin(a)), geo.R * (0.86 / RB), ph, P, hit)
  }

  // ── a flat sheet only slides: drag it (or arrow keys) and it springs back onto the board
  let drag: { id: number; x: number; y: number } | null = null
  const slide = (dx: number, dy: number) => {
    const lim = VW * 0.28
    const ex = (v: number) => Math.sign(v) * lim * (1 - Math.exp(-Math.abs(v) / lim))
    const x = ex(dx), y = ex(dy)
    sheet.style.transform = `translate(${f1(x)}px, ${f1(y)}px) rotate(${f1(x * 0.012)}deg)`
  }
  const home = () => {
    sheet.classList.add('settle')
    sheet.style.transform = ''
  }
  sheet.addEventListener('pointerdown', (e) => {
    if (e.button || !isFlat()) return
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY }
    sheet.classList.remove('settle')
    sheet.classList.add('held')
    sheet.setPointerCapture(e.pointerId)
  })
  sheet.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return
    slide(e.clientX - drag.x, e.clientY - drag.y)
    if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 14) feel()
  })
  // the 3D frame felt by hand: a drag (or arrow keys) on the view while a 3D pen is in it
  view.addEventListener('pointermove', (e) => e.buttons && !isFlat() && feel())
  view.addEventListener('keydown', (e) => e.key.startsWith('Arrow') && feel())
  const up = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return
    drag = null
    sheet.classList.remove('held')
    home()
  }
  sheet.addEventListener('pointerup', up)
  sheet.addEventListener('pointercancel', up)
  let keyT = 0
  view.addEventListener('keydown', (e) => {
    if (!isFlat()) return
    const d = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, number[]>)[e.key]
    if (!d) return
    e.preventDefault()
    e.stopPropagation() // the flat sheet answers, not the 3D view under it
    sheet.classList.remove('settle')
    slide(d[0] * VW * 0.12, d[1] * VW * 0.12)
    clearTimeout(keyT)
    keyT = window.setTimeout(home, 380)
  }, true)
  ctx.onCleanup(() => clearTimeout(keyT))

  // ── layout: the workshop wall, the table, the easel; frame, pot and slip placed for the screen's shape
  let wide = true
  let potGeo = { px: 0, pw: 0, ph: 0, tableY: 0, penH: 0, W: 0, A: 0 }
  /** the thread from pen i (a little below its tip) to the top of its paper slip */
  const PEN_K = [0.74, 0.92, 0.84, 0.96, 1.04]
  let tagPen = -1
  function tie(i: number) {
    tagPen = i
    const { px, pw, ph, tableY, penH } = potGeo
    if (!pw || tag.hidden) return
    const th = ((i - 2) * 7 * Math.PI) / 180, L = penH * PEN_K[i] * 1.16 * 0.72
    const x0 = px + pw * (0.5 + (i - 2) * 0.18), y0 = tableY - ph * 0.52
    const a: Pt = [x0 + Math.sin(th) * L, y0 - Math.cos(th) * L]
    const b: Pt = [tag.offsetLeft + 26, tag.offsetTop + 4]
    thread.setAttribute('d', `M${f1(a[0])} ${f1(a[1])}Q${f1((a[0] + b[0]) / 2)} ${f1(Math.max(a[1], b[1]) + 18)} ${f1(b[0])} ${f1(b[1])}`)
  }
  ctx.onCleanup(onSize(ctx.art, () => {
    const W = ctx.art.clientWidth, A = ctx.art.clientHeight
    const H = stableH(A)
    if (W < 60 || H < 60) return
    root.style.height = `${f1(A)}px`
    wide = W / H > 1.1
    root.classList.toggle('wide', wide)
    // the frame: right of the pot (wide) or across the top (tall)
    let fx: number, fy: number, fw: number, fh: number
    if (wide) {
      fh = H * 0.68
      fw = Math.min(W * 0.6, fh * 1.72)
      fx = W * 0.97 - fw
      fy = H * 0.03
    } else {
      fw = W
      fh = Math.min(H * 0.46, W * 0.82)
      fx = 0
      fy = 0
    }
    const fb = clamp(Math.min(fw, fh) * 0.045, 10, 24)
    Object.assign(frame.style, { left: `${f1(fx)}px`, top: `${f1(fy)}px`, width: `${f1(fw)}px`, height: `${f1(fh)}px` })
    frame.style.setProperty('--fb', `${f1(fb)}px`)
    // the pot: on the table, left (wide) or under the frame (tall); pens as tall as the room allows
    const tableY = wide ? H * 0.8 : H * 0.98
    const pw = wide ? clamp(W * 0.12, 120, 176) : clamp(W * 0.3, 96, 130)
    const ph = pw * 1.02
    const px = wide ? Math.max(W * 0.03, fx - pw - W * 0.24) : W * 0.1
    // the pens stand 38 % of the pot deep; what shows above the mouth fills the room up to the frame (tall)
    const penH = wide ? clamp(tableY - H * 0.22 - ph * 0.5, 160, 360) : clamp(tableY - ph * 0.62 - fy - fh - 16, 120, 260)
    Object.assign(pot.style, { left: `${f1(px)}px`, top: `${f1(tableY - ph)}px`, width: `${f1(pw)}px`, height: `${f1(ph)}px` })
    pot.style.setProperty('--penh', `${f1(penH)}px`)
    // the slip: beside the pot, in the gap before the frame (wide) or right of the pot (tall)
    // clear of the rightmost pen's tip when it is lifted (it leans 14°)
    const tx = px + pw * 0.86 + penH * 1.2 * 0.24 + 14
    if (wide) Object.assign(tag.style, { left: `${f1(tx)}px`, top: `${f1(H * 0.1)}px`, width: `${f1(Math.min(250, fx - tx - 28))}px`, maxHeight: `${f1(tableY - H * 0.12)}px` })
    else Object.assign(tag.style, { left: `${f1(Math.max(px + pw + 10, tx))}px`, top: `${f1(fy + fh + 14)}px`, width: `${f1(W - Math.max(px + pw + 10, tx))}px`, maxHeight: `${f1(H - fy - fh - 18)}px` })
    paintRoom(back, near, W, A, { fx, fy, fw, fh, px, pw, tableY, wide })
    potGeo = { px, pw, ph, tableY, penH, W, A }
    threadSvg.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(A)}`)
    if (tagPen >= 0) tie(tagPen)
    // the sheet's canvas at the view's size (one read: the frame's inside is known from what we just wrote)
    VW = Math.round(fw - fb * 2)
    VH = Math.round(fh - fb * 2)
    dpr = Math.min(devicePixelRatio || 1, low ? 1.25 : 2)
    cv.width = Math.round(VW * dpr)
    cv.height = Math.round(VH * dpr)
    baked = ''
    if (isFlat()) drawSheet()
    if (!staged) {
      staged = true
      startStage()
      // the sheet and the brush stay over the WebGL view
      view.append(sheet, sweep)
    }
  }))
  ctx.onCleanup(onPrefs(() => {
    const was = P
    P = readPal()
    if (JSON.stringify(was) === JSON.stringify(P)) return
    baked = ''
    holder.pond?.theme()
    if (isFlat()) drawSheet()
    kit?.render()
  }))
  ctx.onCleanup(onDigit((d) => d <= K.pens.length && choose(d - 1)))

  // ── choosing a pen: the brush sweeps the frame, the new medium is left behind it
  let swapT = 0
  ctx.onCleanup(() => clearTimeout(swapT))
  function choose(i: number) {
    if (i === cur) return
    const p = K.pens[i]
    seen.add(i)
    picked = i
    pens.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)))
    root.dataset.pen = p.id
    fillTag(i)
    ctx.chime('tap')
    const apply = () => setPen(i)
    if (ctx.reduced || low) {
      sheet.classList.add('fade')
      swapT = window.setTimeout(() => (apply(), sheet.classList.remove('fade')), ctx.reduced ? 160 : 0)
    } else {
      sweep.classList.remove('go')
      void sweep.getBoundingClientRect()
      sweep.classList.add('go')
      swapT = window.setTimeout(apply, 330)
    }
    ask()
  }
  // the rule of thumb waits until a flat pen and a 3D pen have both been felt by hand in the frame (audit v2 B)
  const felt = [false, false] // flat, 3D
  let picked = -1 // the pen just chosen (cur follows it once the brush has swept)
  const deepPen = () => picked >= 0 && !FLAT.includes(K.pens[picked].id as Id)
  function feel() {
    if (picked < 0) return
    const k = deepPen() ? 1 : 0
    if (felt[k]) return
    felt[k] = true
    ask()
  }
  /** the next step in words, or the insight once both kinds are felt */
  function ask() {
    if (done || picked < 0) return
    if (felt[0] && felt[1]) {
      done = true
      ctx.insight(F(K.insight), [K.detail, F(K.facts[0])])
      return
    }
    const k = deepPen() ? 1 : 0
    ctx.prompt(!felt[k] ? K.dragPrompt : k ? K.otherFlat : K.other3d)
  }
  function setPen(i: number) {
    cur = i
    const id = K.pens[i].id as Id
    const flat = FLAT.includes(id)
    frame.classList.toggle('is-flat', flat || noGL)
    frame.classList.toggle('is-3d', !flat && !noGL)
    frame.classList.toggle('is-device', id === 'engine')
    sheet.style.transform = ''
    svgSlot.replaceChildren(!flat && noGL ? paintedDepth(id as 'three' | 'engine') : '')
    cv.hidden = !flat && noGL
    if (flat || noGL) {
      drawSheet()
      // the camera waits straight above, so the next 3D pen starts from the same picture
      kit?.fly([0, 0.1, 0], TOP.yaw, TOP.pitch, 0.05)
      kit?.dolly((zoomNow = 1))
      return
    }
    const k = kit
    if (!k) return
    if (id === 'three') {
      // the picture tips back into depth: the frame is a window now
      k.fly([0, 0.12, -0.05], 0.55, 0.52, 1.7)
      zoomTo(k, 0.74, 1.7)
    } else {
      k.fly([0, 0.4, -0.6], -0.42, 0.4, 2)
      zoomTo(k, 2.3, 2)
    }
  }
  let zoomNow = 1
  function zoomTo(k: InkKit, z: number, dur: number) {
    const z0 = zoomNow
    let u = 0
    k.animate((dt) => {
      u = Math.min(1, u + dt / dur)
      const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2
      zoomNow = z0 + (z - z0) * e
      k.dolly(zoomNow)
      return u < 1
    })
  }

  function fillTag(i: number) {
    const p = K.pens[i]
    const url = sources[p.source]?.url
    tag.replaceChildren(
      h('p', { class: 't36p-tname' }, p.name),
      h('p', { class: 't36p-fits' }, h('span', { class: 't36p-eye' }, K.fitsLabel), p.fits),
      h('p', { class: 't36p-ask' }, h('span', { class: 't36p-eye' }, K.askLabel), h('q', null, p.ask.replace(/^[“"]|[”"]$/g, ''))),
      h('p', { class: 't36p-note' }, K.askNote),
      url ? h('a', { class: 't36p-docs', href: url, target: '_blank', rel: 'noopener' }, K.docsLabel, ' ↗') : '')
    const first = tag.hidden
    tag.hidden = false
    tag.classList.remove('in')
    void tag.offsetWidth
    tag.classList.add('in')
    if (first) tag.setAttribute('aria-live', 'polite')
    tie(i)
  }
}

/** a broad, dry brush band across a 100 × 100 box, ragged at both edges */
function brushBand(): string {
  const r = rng(3630)
  const top: Pt[] = [], bot: Pt[] = []
  for (let i = 0; i <= 24; i++) {
    const y = -10 + (i / 24) * 120
    top.push([18 + (r() - 0.5) * 9 + Math.sin(i * 0.9) * 3, y])
    bot.push([82 + (r() - 0.5) * 9 + Math.cos(i * 0.7) * 3, y])
  }
  return `M${top.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}L${bot.reverse().map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}Z`
}

/** The night workshop behind it all: plank wall, the lantern's warm pool, the table, the easel holding the frame and the
 *  shadow it throws away from the lantern; in front, the table's near edge with an ink stone and a brush on its rest. */
function paintRoom(svg: SVGSVGElement, near: SVGSVGElement, W: number, H: number, o: { fx: number; fy: number; fw: number; fh: number; px: number; pw: number; tableY: number; wide: boolean }) {
  svg.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
  near.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
  const r = rng(3640)
  const { fx, fy, fw, fh, px, pw, tableY, wide } = o
  // the wall: tall boards with seams, a little grain, two tones
  const bw = clamp(W / 13, 46, 92)
  let boardsA = '', boardsB = '', seams = '', grain = ''
  for (let x = -r() * bw, i = 0; x < W; x += bw, i++) {
    const d = `M${f1(x)} 0h${f1(bw)}v${f1(tableY + 2)}h${f1(-bw)}Z`
    if (i % 3 === 1) boardsB += d
    else boardsA += d
    seams += `M${f1(x + 0.5)} 0V${f1(tableY)}`
    for (let k = 0; k < 3; k++) {
      const gx = x + bw * (0.2 + r() * 0.6), y0 = r() * tableY * 0.5, y1 = y0 + tableY * (0.25 + r() * 0.5)
      grain += `M${f1(gx)} ${f1(y0)}Q${f1(gx + (r() - 0.5) * 6)} ${f1((y0 + y1) / 2)} ${f1(gx + (r() - 0.5) * 3)} ${f1(y1)}`
    }
  }
  // the table: seams that open up toward us, a lit back edge; in front its near edge (wide: an ink stone and a brush on it)
  const tFront = wide ? H * 0.94 : H + 10
  let tseams = ''
  for (let i = 1; i < 6; i++) {
    const t0 = i / 6, y = tableY + (tFront - tableY) * (t0 * t0 * 0.75 + t0 * 0.25)
    tseams += `M0 ${f1(y)}L${f1(W)} ${f1(y + (r() - 0.5) * 2)}`
  }
  // the lantern: over the pot (wide), or right of it under the frame (tall)
  const lx = wide ? px + pw * 0.62 : W * 0.86, ly = wide ? tableY * 0.06 : fy + fh + 4
  const lr = wide ? clamp(W * 0.018, 16, 26) : 13
  // the easel: two splayed legs, a mast, a top clamp; the frame hides their middles
  const lw = clamp(fw * 0.026, 9, 17)
  const leg = (x0: number, y0: number, x1: number, y1: number) => `M${f1(x0 - lw / 2)} ${f1(y0)}L${f1(x0 + lw / 2)} ${f1(y0)}L${f1(x1 + lw * 0.65)} ${f1(y1)}L${f1(x1 - lw * 0.65)} ${f1(y1)}Z`
  const legsY0 = Math.max(-4, fy - fh * 0.16), legsY1 = Math.min(H - 4, tableY + (tFront - tableY) * 0.55)
  const easel = leg(fx + fw * 0.24, legsY0, fx + fw * 0.12, legsY1) + leg(fx + fw * 0.76, legsY0, fx + fw * 0.88, legsY1) + leg(fx + fw * 0.5, legsY0 - 6, fx + fw * 0.5, fy + fh + lw * 2)
  const clamp0 = `M${f1(fx + fw * 0.42)} ${f1(fy - lw * 0.9)}h${f1(fw * 0.16)}v${f1(lw * 1.3)}h${f1(-fw * 0.16)}Z`
  // the shadow the frame and easel throw on the wall: pushed away from the lantern, a little larger
  const dx = fx + fw / 2 - lx, dy = fy + fh / 2 - ly, dl = Math.hypot(dx, dy) || 1
  const sh = clamp(fw * 0.07, 14, 60)
  const sx = (dx / dl) * sh, sy = (dy / dl) * sh * 0.8 + sh * 0.3
  const fshadow = `M${f1(fx + sx)} ${f1(fy + sy)}h${f1(fw * 1.03)}v${f1(fh * 1.03)}h${f1(-fw * 1.03)}Z` + leg(fx + fw * 0.24 + sx * 1.4, legsY0 + sy, fx + fw * 0.12 + sx * 1.8, tableY) + leg(fx + fw * 0.76 + sx * 1.4, legsY0 + sy, fx + fw * 0.88 + sx * 1.8, tableY)
  svg.replaceChildren(
    s('rect', { class: 't36p-wall', x: 0, y: 0, width: f1(W), height: f1(tableY + 4) }),
    s('path', { class: 't36p-board-a', d: boardsA }),
    s('path', { class: 't36p-board-b', d: boardsB }),
    s('path', { class: 't36p-grain-w', d: grain }),
    s('path', { class: 't36p-seam', d: seams }),
    // the lantern's light: a strong pool round it on the boards, a wider wash toward the pot and the slip
    s('ellipse', { class: 't36p-glow', cx: f1(lx), cy: f1(ly + tableY * 0.3), rx: f1(wide ? W * 0.3 : W * 0.7), ry: f1(tableY * 0.62), fill: 'url(#t36p-pool)' }),
    s('ellipse', { class: 't36p-glow t36p-glow2', cx: f1(lx), cy: f1(ly + lr * 2), rx: f1(lr * 7), ry: f1(lr * 6), fill: 'url(#t36p-pool)' }),
    s('ellipse', { class: 't36p-cool', cx: f1(fx + fw * 0.85), cy: f1(fy), rx: f1(fw * 0.55), ry: f1(fh * 0.7), fill: 'url(#t36p-cool)' }),
    s('path', { class: 't36p-wallshadow', d: fshadow, filter: 'url(#ink-wash)' }),
    s('path', { class: 't36p-easel', d: easel + clamp0 }),
    s('path', { class: 't36p-easel-hi', d: `M${f1(fx + fw * 0.24 - lw * 0.3)} ${f1(legsY0)}L${f1(fx + fw * 0.12 - lw * 0.4)} ${f1(legsY1)}M${f1(fx + fw * 0.76 - lw * 0.3)} ${f1(legsY0)}L${f1(fx + fw * 0.88 - lw * 0.4)} ${f1(legsY1)}` }),
    s('rect', { class: 't36p-table', x: 0, y: f1(tableY), width: f1(W), height: f1(H - tableY + 2) }),
    s('path', { class: 't36p-tseam', d: tseams }),
    s('ellipse', { cx: f1(px + pw * 0.6), cy: f1(tableY + (tFront - tableY) * 0.25), rx: f1(wide ? W * 0.32 : W * 0.6), ry: f1((tFront - tableY) * 0.65), fill: 'url(#t36p-pool)' }),
    s('path', { class: 't36p-tedge', d: `M0 ${f1(tableY)}H${f1(W)}` }),
    s('ellipse', { class: 't36p-fshadow', cx: f1(fx + fw * 0.54), cy: f1(tableY + 5), rx: f1(fw * 0.46), ry: 6 }),
    paperLantern(lx, -6, lr, 3680, ly + 6))
  if (!wide) return near.replaceChildren()
  // ── the near layer: the table's front edge cut by the frame; on it an ink stone with its well, a brush on its rest
  const ix = W * 0.62, iy = tableY + (tFront - tableY) * 0.46, iw = clamp(W * 0.09, 90, 140), ih = (tFront - tableY) * 0.34
  const rx0 = W * 0.83, ry0 = tableY + (tFront - tableY) * 0.55
  near.replaceChildren(
    s('rect', { class: 't36p-tfront', x: -4, y: f1(tFront), width: f1(W + 8), height: f1(H - tFront + 4) }),
    s('path', { class: 't36p-tedge', d: `M-4 ${f1(tFront)}H${f1(W + 4)}` }),
    s('g', { class: 't36p-nearobj' },
      s('ellipse', { class: 't36p-fshadow', cx: f1(ix + iw * 0.55), cy: f1(iy + ih * 1.02), rx: f1(iw * 0.56), ry: f1(ih * 0.28) }),
      s('rect', { class: 't36p-inkstone', x: f1(ix), y: f1(iy), width: f1(iw), height: f1(ih), rx: f1(ih * 0.18) }),
      s('rect', { class: 't36p-inkface', x: f1(ix + iw * 0.06), y: f1(iy + ih * 0.12), width: f1(iw * 0.88), height: f1(ih * 0.62), rx: f1(ih * 0.14) }),
      s('ellipse', { class: 't36p-inkwell', cx: f1(ix + iw * 0.24), cy: f1(iy + ih * 0.42), rx: f1(iw * 0.13), ry: f1(ih * 0.2) }),
      s('path', { class: 't36p-inksheen', d: `M${f1(ix + iw * 0.18)} ${f1(iy + ih * 0.36)}q${f1(iw * 0.06)} ${f1(-ih * 0.06)} ${f1(iw * 0.12)} 0`, fill: 'none' }),
      // the brush rest (a little ceramic range of hills) and a brush lying on it, running out of the frame
      s('ellipse', { class: 't36p-fshadow', cx: f1(rx0 + W * 0.02), cy: f1(ry0 + 6), rx: f1(W * 0.04), ry: 4 }),
      s('path', { class: 't36p-rest', d: `M${f1(rx0 - W * 0.035)} ${f1(ry0 + 4)}Q${f1(rx0 - W * 0.02)} ${f1(ry0 - 14)} ${f1(rx0 - W * 0.008)} ${f1(ry0 - 4)}Q${f1(rx0)} ${f1(ry0 - 20)} ${f1(rx0 + W * 0.012)} ${f1(ry0 - 4)}Q${f1(rx0 + W * 0.024)} ${f1(ry0 - 13)} ${f1(rx0 + W * 0.035)} ${f1(ry0 + 4)}Z` }),
      s('path', { class: 't36p-nbrush', d: stroke([[rx0 - W * 0.06, ry0 - 2], [W * 1.02, ry0 - 16]], clamp(W * 0.007, 6, 11), 0.05, 0.05, 0.5) }),
      s('path', { class: 't36p-ntip', d: stroke([[rx0 - W * 0.11, ry0 + 6], [rx0 - W * 0.06, ry0 - 2]], clamp(W * 0.008, 7, 12), 0.95, 0.1, 0.3) })))
}
