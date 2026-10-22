import { h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import type { SceneCtx } from '../types'
import { blob, clamp, curve, onDigit, onSize, p2Defs, rng, stableHeight, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist, moon, paperLantern, pine, reeds, toro, wash } from '../../ui/part2/paint'
import { C } from './data'
import { guide } from '../../ui/part2/guide'
import { arc, bamboo, blossom, f1, figure, house, P, sapling } from './kit'

const G = C.scenes.gate
const ELEV = 24 // camera elevation, degrees
const SIN = Math.sin((ELEV * Math.PI) / 180), COS = Math.cos((ELEV * Math.PI) / 180)
const D2R = Math.PI / 180

/** One paper flat standing on the turntable: where it stands (φ° from the front, r × R), its size (× R), its art. */
interface Flat {
  phi: number
  r: number
  w: number
  h: number
  face?: number // which way the drawn side looks (° like phi); default phi
  draw: (w: number, h: number) => { art: SVGElement[]; back?: SVGElement[]; sil: string }
  cls?: string
  open?: boolean // stands in the open garden: hidden while the wall is between it and the viewer
  el?: HTMLElement
  shade?: HTMLElement
  backEl?: SVGSVGElement
  frontEl?: SVGSVGElement
}

/**
 * ★ II·12 "gate" (2.5D): a pop-up book on a lacquer turntable. A round moss island on a black lacquer tray stands in still
 * water under a still moon; a diameter splits it into a walled garden (lime wall, one lit window handing out a branch,
 * blossoms out of reach behind it) and an open garden (bamboo gate flung wide, saplings in pots, stepping stones across
 * the water to far houses that light up). Paper flats stand on a CSS 3D disc: turning it gives real parallax and
 * occlusion; each flat leans back toward the viewer (≤ 40°) so it never goes edge-on, and darkens as it turns from the
 * moon (one variable per flat, written while turning). Drag to turn (inertia, snaps to 0° / 180°), Space or ← → flips.
 * Four small stone lanterns at the rim weigh the trade-offs, each with a little scene on the island for the side facing
 * you. Low quality / reduced motion: the turn is a cross-fade between the two faces.
 */
export function gateScene(ctx: SceneCtx) {
  p2Defs()
  const low = ctx.quality === 'low'
  const still = low || ctx.reduced
  const T = G.tradeoffs
  const root = h('div', { class: `t30g${still ? ' still' : ''}` })
  const bg = s('svg', { class: 't30g-bg', 'aria-hidden': 'true' })
  const world = h('div', { class: 't30g-world', 'aria-hidden': 'true' })
  const table = h('div', { class: 't30g-table' })
  const topSvg = s('svg', { class: 't30g-top-art' })
  const top = h('div', { class: 't30g-top' }, topSvg)
  const sheenSvg = s('svg', { class: 't30g-sheen-art' })
  const sheen = h('div', { class: 't30g-sheen' }, sheenSvg)
  const band = h('div', { class: 't30g-band' })
  table.append(band, top, sheen)
  world.append(table)
  const fg = s('svg', { class: 't30g-fg', 'aria-hidden': 'true' })
  // the face's name is carved into the lacquer side (a phone: into the stone base) — this copy is for screen readers
  const faceLabel = h('p', { class: 't30g-face', 'aria-live': 'polite' }, G.closed)
  const line = h('p', { class: 't30g-line' })
  const caveat = h('p', { class: 't30g-caveat' })
  const read = h('div', { class: 't30g-read' }, faceLabel, line, caveat)
  let faceCarve: SVGElement | null = null, baseCarve: SVGTextElement | null = null
  const turn = h('button', { class: 't30g-turn', type: 'button', 'aria-label': G.toggleAria, 'aria-pressed': 'false' })
  const lamps = T.map((t, i) => h('button', { class: 't30g-lamp', type: 'button', 'aria-pressed': 'false', 'aria-label': `${i + 1}. ${t.name}`, onClick: () => light(i) },
    lampArt(3110 + i), h('span', { class: 't30g-lamp-name' }, t.name)))
  const lampRow = h('div', { class: 't30g-lamps', role: 'group', 'aria-label': G.tradeoffLabel }, ...lamps)
  root.append(h('p', { class: 'visually-hidden' }, G.art), bg, world, fg, read, turn, lampRow)
  ctx.art.append(root)
  const stableH = stableHeight(ctx, [G.insight as Fact])
  // guide (audit v3 30-1): turn the tray (a hidden drag: a two-way arrow on it), then light lamps to compare (a count)
  const gd = guide(ctx)
  const step = gd.steps(G.prompts)
  step(0)
  // a vermilion dot on the tray's right rim and a two-way ink arrow along its front rim (drawn in drawFg)
  let rimAt: Pt = [0, 0]
  const rimDot = gd.dot(() => rimAt, { dir: [-1, 0] })
  const turnArrow = { done: () => root.classList.add('turned') }
  const lampDots = lamps.map((b) => gd.dot(b))
  let lampCount: ReturnType<typeof gd.count> | null = null
  const litOnce = new Set<number>()

  // ── state: θ = how far the tray has turned (0 = wall to the front, 180 = open garden to the front)
  let theta = 0, vel = 0, target = 0
  let R = 100, lit = -1
  const seen = new Set<number>([0])
  const isOpen = () => (((Math.round(target / 180) % 2) + 2) % 2) === 1
  let flats: Flat[] = []

  // ── one frame of the turntable: the island turns in its plane, each flat moves round it and leans toward the viewer
  function apply() {
    top.style.transform = `rotateX(90deg) rotateZ(${f1(-theta)}deg)`
    for (const f of flats) {
      if (!f.el) continue
      const a = (f.phi + theta) * D2R
      const X = Math.sin(a) * f.r * R, Z = Math.cos(a) * f.r * R
      const al = ((f.face ?? f.phi) + theta) * D2R
      const e = 40 * Math.sin(al) // the lean: never more than 40° off the viewer, so never edge-on
      f.el.style.transform = `translate3d(${f1(X)}px,0,${f1(Z)}px) rotateY(${f1(e)}deg)`
      // far side: hazier; turned from the moon (behind, up right): darker
      const hide = f.open ? clamp((Math.cos(a) + 0.2) / 0.35, 0, 1) : 1 // behind the wall: out of sight
      f.el.style.setProperty('--o', ((0.88 + 0.12 * ((Z / R) / Math.max(0.2, f.r) + 1) / 2) * hide).toFixed(3))
      if (f.shade) f.shade.style.opacity = (0.06 + 0.22 * (1 - (Math.sin((e - 30) * D2R) + 1) / 2) * (0.6 + 0.4 * Math.cos(al) ** 2)).toFixed(3)
      if (f.backEl) {
        const b = clamp(0.5 - Math.cos(al) * 1.6, 0, 1)
        f.backEl.style.opacity = b.toFixed(3)
        f.frontEl!.style.opacity = (1 - b).toFixed(3)
      }
    }
  }

  const loop = createLoop(root, (_t, dt) => {
    if (drag) return false
    if (dt === 0) return apply(), true
    // a stiff, critically damped spring onto the snapped face: heavy, no bounce
    const k = 46, c = 2 * Math.sqrt(k)
    vel += (k * (target - theta) - c * vel) * dt
    theta += vel * dt
    apply()
    if (Math.abs(target - theta) < 0.05 && Math.abs(vel) < 0.08) {
      theta = target
      vel = 0
      apply()
      return false
    }
  })
  ctx.onCleanup(() => loop.dispose())

  function settle(to: number) {
    target = to
    face()
    if (still) {
      // two still frames, cross-faded (low / reduced motion)
      if (ctx.reduced) return (theta = target), apply()
      root.classList.add('fade')
      const id = setTimeout(() => {
        theta = target
        apply()
        root.classList.remove('fade')
      }, 220)
      ctx.onCleanup(() => clearTimeout(id))
      return
    }
    loop.start()
  }

  // the face toward the viewer: its label, the lamp's line for it, and the insight once both faces were seen
  let shownOpen = false
  function face() {
    const o = isOpen()
    turn.setAttribute('aria-pressed', String(o))
    root.classList.toggle('is-open', o)
    if (o !== shownOpen) {
      shownOpen = o
      faceLabel.textContent = o ? G.open : G.closed
      carveFace()
      if (o) root.classList.add('was-open')
      writeLine()
      ctx.chime('soft')
    }
    seen.add(o ? 1 : 0)
    if (seen.size === 2 && !lampCount) {
      turnArrow.done()
      rimDot.done()
      step(1)
      lampCount = gd.count(G.lampTpl, T.length, () => countAt, { n: litOnce.size })
    }
    done()
  }
  /** the insight once both faces were seen and at least two lamps lit (the trade-offs are the point, audit v3 30-1) */
  function done() {
    if (seen.size < 2 || litOnce.size < 2 || root.classList.contains('both')) return
    root.classList.add('both')
    carveFace()
    lampDots.forEach((d) => d.done())
    lampCount?.done()
    ctx.insight(G.insight as Fact, G.detail as Fact)
    ctx.chime('ok')
  }
  /** a lit lamp says both gardens side by side, walled then open, so nobody has to turn back to compare */
  function writeLine() {
    root.classList.toggle('has-line', lit >= 0)
    if (lit < 0) return void line.replaceChildren()
    const t = T[lit]
    line.replaceChildren(h('span', { class: 't30g-line-name' }, t.name),
      h('span', { class: 't30g-line-text' }, h('b', null, `${G.closedShort}: `), t.closed, ' ', h('b', null, `${G.openShort}: `), t.open))
    if (!line.hasAttribute('aria-live')) line.setAttribute('aria-live', 'polite')
  }
  function light(i: number) {
    lit = lit === i ? -1 : i
    lamps.forEach((b, k) => b.setAttribute('aria-pressed', String(k === lit)))
    T.forEach((t, k) => root.classList.toggle(`lamp-${t.id}`, k === lit))
    writeLine()
    if (lit >= 0 && !litOnce.has(lit)) {
      litOnce.add(lit)
      lampDots[lit].done()
      lampCount?.set(litOnce.size)
    }
    done()
    ctx.chime('soft')
  }
  ctx.onCleanup(onDigit((d) => d <= T.length && light(d - 1)))
  // H7: idle before the first turn, the tray gives a small push and settles back (a spring, no bounce)
  const invite = () => {
    if (seen.size > 1 || still || drag) return
    vel = 34
    loop.start()
  }
  ctx.el.addEventListener('p2:idle', invite)
  ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', invite))

  // ── drag to turn (pointer anywhere but the lanterns), inertia, snap to a face
  let drag: { id: number; x: number; t0: number; last: number; lt: number; from: number; tap: boolean } | null = null
  let dragged = false
  root.addEventListener('pointerdown', (e) => {
    if (e.button || (e.target as Element).closest('.t30g-lamp')) return
    dragged = false
    drag = { id: e.pointerId, x: e.clientX, t0: theta, last: e.clientX, lt: performance.now(), from: target, tap: !!(e.target as Element).closest('.t30g-turn') }
    vel = 0
    root.setPointerCapture(e.pointerId)
    root.classList.add('dragging')
  })
  root.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return
    const now = performance.now()
    if (!still) {
      const k = 180 / Math.max(160, R * 1.7) // a full face per ~1.7 radii of drag
      theta = drag.t0 + (e.clientX - drag.x) * k
      const dt = Math.max(1, now - drag.lt) / 1000
      vel = vel * 0.6 + (((e.clientX - drag.last) * k) / dt) * 0.4
      apply()
    }
    drag.last = e.clientX
    drag.lt = now
  })
  const end = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return
    const dx = drag.last - drag.x, idle = performance.now() - drag.lt, from = drag.from, tap = drag.tap
    drag = null
    dragged = Math.abs(dx) > 5
    root.classList.remove('dragging')
    // a tap on the tray turns it too (the pointer capture sends the click to the root, not the tray's button)
    if (tap && Math.abs(dx) <= 5) return flip(1)
    if (still) {
      if (Math.abs(dx) > 24) settle(target + (dx > 0 ? 180 : -180))
      return
    }
    if (!dragged) return
    if (idle > 120) vel *= 0.3 // held still before letting go: no fling
    settle(clamp(Math.round((theta + clamp(vel, -500, 500) * 0.22) / 180) * 180, from - 180, from + 180)) // one face per throw
  }
  root.addEventListener('pointerup', end)
  root.addEventListener('pointercancel', end)
  const flip = (dir: number) => settle(target + dir * 180)
  turn.addEventListener('click', () => !dragged && flip(1))
  turn.addEventListener('keydown', (e) => {
    const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key]
    if (!k) return
    e.preventDefault()
    flip(k)
  })

  // ── layout: one read of the art size, then everything drawn for it
  let job: { cancel(): void } | null = null
  let first = true
  function layout() {
    const W = ctx.art.clientWidth
    const H = stableH(ctx.art.clientHeight)
    if (W < 60 || H < 60) return
    root.style.height = `${f1(H)}px`
    const tall = W / H < 0.9
    root.classList.toggle('tall', tall)
    R = tall ? Math.min(W * 0.33, H * 0.2) : Math.min(W * 0.25, H * 0.4)
    const cx = W / 2, cy = tall ? H * 0.31 : H * 0.395
    const thick = R * (tall ? 0.17 : 0.15)
    const Pd = Math.max(R * 5, 900) // perspective distance
    world.style.perspective = `${f1(Pd)}px`
    world.style.perspectiveOrigin = `${f1(cx)}px ${f1(cy - R * 0.3)}px`
    table.style.left = `${f1(cx)}px`
    table.style.top = `${f1(cy)}px`
    table.style.transform = `rotateX(${-ELEV}deg)`
    // screen position of a point on the tray plane (x right, z toward the viewer, y down), same maths as the CSS camera
    const proj = (x: number, y: number, z: number): Pt => {
      const yy = y * COS + z * SIN, zz = -y * SIN + z * COS
      const k = Pd / (Pd - zz)
      return [cx + x * k, cy - R * 0.3 + (yy + R * 0.3) * k]
    }
    function* build() {
      // the tray: island art turning in its plane, a lacquer sheen that stays, the lacquer side as 40 facets
      Object.assign(top.style, { width: `${f1(R * 2)}px`, height: `${f1(R * 2)}px`, left: `${f1(-R)}px`, top: `${f1(-R)}px` })
      Object.assign(sheen.style, { width: `${f1(R * 2)}px`, height: `${f1(R * 2)}px`, left: `${f1(-R)}px`, top: `${f1(-R)}px` })
      drawTop()
      yield
      band.replaceChildren()
      const N = 40, fw = (2 * Math.PI * R) / N + 1.5
      for (let i = 0; i < N; i++) {
        const a = (i / N) * 360
        // the moon, behind and to the right: a narrow specular streak on the lacquer near the right edge, a soft sheen round it
        const aa = a > 180 ? a - 360 : a
        const lit = Math.min(1, Math.exp(-(((aa - 62) / 9) ** 2)) + 0.3 * Math.max(0, Math.sin((aa - 15) * D2R)) ** 2)
        band.append(h('i', { style: `width:${f1(fw)}px;height:${f1(thick)}px;left:${f1(-fw / 2)}px;transform:rotateY(${f1(a)}deg) translateZ(${f1(R - 0.5)}px);--l:${lit.toFixed(2)}` }))
      }
      yield
      drawBg(W, H, cx, cy, thick, proj)
      yield
      flats = makeFlats()
      for (const f of flats) {
        f.el?.remove()
        const w = f.w * R, hh = f.h * R
        const { art, back, sil } = f.draw(w, hh)
        const box = `${f1(-w / 2)} ${f1(-hh)} ${f1(w)} ${f1(hh)}`
        const front = s('svg', { class: 't30g-flat-art', viewBox: box }, ...art)
        const kids: Element[] = [front]
        if (back) {
          f.frontEl = front
          f.backEl = s('svg', { class: 't30g-flat-art t30g-flat-back', viewBox: box }, ...back)
          kids.push(f.backEl)
        }
        if (!low && sil) {
          const sh = s('svg', { class: 't30g-flat-shade', viewBox: box }, s('path', { d: sil }))
          kids.push(sh)
          f.shade = sh as unknown as HTMLElement
        }
        f.el = h('div', { class: `t30g-flat ${f.cls ?? ''}`, style: `width:${f1(w)}px;height:${f1(hh)}px;left:${f1(-w / 2)}px;top:${f1(-hh)}px` }, ...kids)
        table.append(f.el)
        yield
      }
      apply()
      drawFg(W, H, cx, cy, thick, proj, tall)
      gd.refresh()
    }
    job?.cancel()
    job = sliced(build(), { sync: ctx.reduced || !first })
    first = false
  }
  ctx.onCleanup(() => job?.cancel())
  ctx.onCleanup(onSize(ctx.art, layout))

  // ── the island seen from above (local: u right, v toward the viewer at θ = 0): wall side gravel, open side moss
  function drawTop() {
    const r = rng(3001)
    topSvg.setAttribute('viewBox', `${f1(-R)} ${f1(-R)} ${f1(R * 2)} ${f1(R * 2)}`)
    sheenSvg.setAttribute('viewBox', `${f1(-R)} ${f1(-R)} ${f1(R * 2)} ${f1(R * 2)}`)
    const isl = R * 0.84
    // gravel rows parallel to the dividing line on the walled half; tufts of moss on the open half
    let rake = ''
    for (let v = R * 0.06; v < isl; v += R * 0.045) {
      const half = Math.sqrt(Math.max(0, isl * isl - v * v)) * 0.96
      rake += `M${f1(-half)} ${f1(v)}Q0 ${f1(v + R * 0.012)} ${f1(half)} ${f1(v)}`
    }
    let tufts = ''
    for (let i = 0; i < 46; i++) {
      const a = Math.PI + r() * Math.PI, d = Math.sqrt(r()) * isl * 0.92
      tufts += blob(Math.cos(a) * d, Math.sin(a) * d * 0.98, R * (0.03 + r() * 0.05), R * (0.02 + r() * 0.035), 3100 + i, 0.3, 8)
    }
    let divide = ''
    for (let i = -6; i <= 6; i++) divide += blob(i * isl * 0.15 + (r() - 0.5) * R * 0.03, (r() - 0.5) * R * 0.03, R * 0.035, R * 0.028, 3200 + i, 0.2, 9)
    // stepping stones: gate → heart of the open garden
    let steps = ''
    for (let i = 0; i < 4; i++) steps += blob((r() - 0.5) * R * 0.08, -R * (0.62 - i * 0.13), R * 0.05, R * 0.04, 3300 + i, 0.15, 10)
    // soft contact shadows where the flats stand (they turn with the island)
    let feet = ''
    for (const f of makeFlats()) {
      const u = Math.sin(f.phi * D2R) * f.r * R, v = Math.cos(f.phi * D2R) * f.r * R
      const k = f.w * R
      feet += blob(u, v, k * 0.42, R * 0.04 + k * 0.03, 3400 + Math.round(f.phi), 0.2, 12)
    }
    topSvg.replaceChildren(
      s('circle', { class: 't30g-lacquer', r: f1(R) }),
      s('circle', { class: 't30g-gold', r: f1(R * 0.965) }),
      s('path', { class: 't30g-isle', d: blob(0, 0, isl, isl, 3002, 0.04, 28), filter: 'url(#ink-wash)' }),
      s('path', { class: 't30g-gravel', d: `M${f1(-isl * 0.98)} 0A${f1(isl)} ${f1(isl)} 0 0 0 ${f1(isl * 0.98)} 0Z` }),
      s('path', { class: 't30g-rake', d: rake }),
      s('path', { class: 't30g-moss', d: `M${f1(isl * 0.98)} 0A${f1(isl)} ${f1(isl)} 0 0 0 ${f1(-isl * 0.98)} 0Z`, filter: 'url(#ink-wash)' }),
      s('path', { class: 't30g-tuft', d: tufts }),
      s('path', { class: 't30g-feet', d: feet }),
      s('path', { class: 't30g-divide', d: divide }),
      s('path', { class: 't30g-step', d: steps }),
      s('path', { class: 't30g-isle-rim', d: stroke(arc(0, 0, isl * 1.01, isl * 1.01, 0, 359, 60), Math.max(1.5, R * 0.012), 0.1, 0.1, 0.4) }))
    // moonlight caught on the lacquer ring, toward the moon (it stays while the island turns)
    sheenSvg.replaceChildren(s('path', { class: 't30g-sheen-ring', d: stroke(arc(0, 0, R * 0.93, R * 0.93, 205, 335, 30), R * 0.07, 0.4, 0.4, 0.05) }))
  }

  // ── the flats on the island (sizes × R)
  function makeFlats(): Flat[] {
    if (flats.length) return flats
    return [
      { phi: -30, r: 0.26, w: 0.9, h: 0.84, draw: (_w, hh) => ({ art: blossom(0, 0, hh * 0.66, 3011), sil: '' }) },
      { phi: 40, r: 0.34, w: 0.7, h: 0.82, draw: (_w, hh) => ({ art: [pine(0, 0, hh * 0.98, 3012, -1)], sil: '' }) },
      { phi: 0, r: 0.54, w: 1.36, h: 0.5, draw: wallArt, cls: 't30g-wallflat' },
      { phi: 14, r: 0.84, w: 0.36, h: 0.36, draw: visitorArt, cls: 't30g-v t30g-visitor' },
      { phi: 180, r: 0.66, w: 1.12, h: 0.7, draw: gateArt, open: true },
      { phi: 236, r: 0.46, w: 0.62, h: 0.62, draw: (_w, hh) => ({ art: [pine(0, 0, hh * 0.92, 3043, 1)], sil: '' }), open: true },
      { phi: 164, r: 0.36, w: 0.2, h: 0.3, draw: (_w, hh) => ({ art: [sapling(0, 0, hh * 0.95, 3044)], sil: '' }), open: true },
      { phi: 200, r: 0.42, w: 0.2, h: 0.28, draw: (_w, hh) => ({ art: [sapling(0, 0, hh * 0.95, 3045)], sil: '' }), open: true },
      { phi: 136, r: 0.74, w: 0.2, h: 0.26, draw: (_w, hh) => ({ art: [sapling(0, 0, hh * 0.95, 3046)], sil: '' }), open: true },
      { phi: 222, r: 0.76, w: 0.2, h: 0.24, draw: (_w, hh) => ({ art: [sapling(0, 0, hh * 0.95, 3047, false)], sil: '' }), open: true },
      { phi: 158, r: 0.56, w: 0.32, h: 0.36, draw: gardenerArt, cls: 't30g-v t30g-gardener', open: true },
    ]
  }

  // the lime wall: whitewash over a stone plinth, a tiled coping with real depth (slope, ridge cap with upturned ends, a
  // row of round tile ends, the eave's shadow on the plaster), a lit round window; both faces drawn (outside, then inside)
  function wallArt(w: number, hh: number) {
    const x0 = -w / 2, x1 = w / 2, gy = 0
    const capH = hh * 0.24 // the roof's depth on screen: the front slope seen from above plus the ridge
    const wh = hh * 0.66 // plaster under the eave
    const ey = gy - wh // eave line
    const ov = capH * 0.5 // the roof overhangs the wall ends
    const ry = ey - capH * 0.72 // ridge line
    const th = Math.max(3, w * 0.03) // the wall's thickness, seen at its shaded left end
    const wall = `M${P([x0, gy])}L${P([x0, ey])}L${P([x1, ey])}L${P([x1, gy])}Z`
    const plinth = `M${P([x0, gy])}L${P([x0, gy - wh * 0.16])}L${P([x1, gy - wh * 0.16])}L${P([x1, gy])}Z`
    const endFace = `M${P([x0, gy])}L${P([x0 - th, gy - th * 0.45])}L${P([x0 - th, ey - th * 0.45])}L${P([x0, ey])}Z`
    const slope = `M${P([x0 - ov, ey + capH * 0.06])}L${P([x0 - ov * 0.7, ry])}L${P([x1 + ov * 0.7, ry])}L${P([x1 + ov, ey + capH * 0.06])}Z`
    const cap = `M${P([x0 - ov * 1.05, ry - capH * 0.42])}Q${P([x0 - ov * 0.6, ry - capH * 0.02])} ${P([x0 - ov * 0.1, ry - capH * 0.12])}L${P([x1 + ov * 0.1, ry - capH * 0.12])}Q${P([x1 + ov * 0.6, ry - capH * 0.02])} ${P([x1 + ov * 1.05, ry - capH * 0.42])}L${P([x1 + ov * 0.95, ry + capH * 0.08])}L${P([x0 - ov * 0.95, ry + capH * 0.08])}Z`
    function side(inner: boolean, seed: number) {
      const r = rng(seed)
      // tiles run down the slope: alternate moonlit crowns and dark gutters
      let crowns = '', gutters = '', ends = ''
      const step = Math.max(4, capH * 0.34)
      for (let x = x0 - ov * 0.8, i = 0; x < x1 + ov * 0.8; x += step, i++) {
        const top: Pt = [x * 0.97, ry + capH * 0.06], bot: Pt = [x, ey + capH * 0.04]
        if (i % 2) gutters += stroke([top, bot], step * 0.34, 0.05, 0.05, 0.5)
        else {
          crowns += stroke([top, bot], step * 0.22, 0.1, 0.05, 0.5)
          ends += blob(bot[0], bot[1] + capH * 0.04, step * 0.4, step * 0.36, seed + i, 0.08, 9)
        }
      }
      // whitewash: long dry brush passes, a damp tide mark rising from the plinth, a few hairline cracks
      let lime = '', damp = '', joints = ''
      for (let i = 0; i < 16; i++) {
        const x = x0 + w * r(), y = ey + wh * (0.08 + r() * 0.5)
        lime += stroke([[x, y], [x + (r() - 0.5) * w * 0.12, y + wh * (0.18 + r() * 0.2)]], 1 + r() * 2.4, 0.3, 0.5, 0.1)
      }
      for (let x = x0; x < x1; x += w * (0.04 + r() * 0.05)) damp += blob(x, gy - wh * 0.18, w * 0.05, wh * (0.06 + r() * 0.08), seed + 40 + Math.round(x), 0.3, 9)
      for (let x = x0 + w * 0.07; x < x1; x += w * (0.09 + r() * 0.05)) joints += `M${f1(x)} ${f1(gy - 1)}V${f1(gy - wh * 0.16 + 1)}`
      joints += `M${f1(x0)} ${f1(gy - wh * 0.08)}H${f1(x1)}`
      // the round window, lit from within; its deep reveal in shadow on the upper rim
      const wx = (inner ? -1 : 1) * w * 0.14, wy = ey + wh * 0.46, ws = wh * 0.5
      const lattice = [-0.22, 0, 0.22].map((k) => {
        const q = ws * 0.5 * Math.sqrt(1 - 4 * k * k)
        return `M${f1(wx - q)} ${f1(wy + ws * k)}h${f1(q * 2)}M${f1(wx + ws * k)} ${f1(wy - q)}v${f1(q * 2)}`
      }).join('')
      const kids: (SVGElement | null)[] = [
        s('ellipse', { class: 't30-contact', cx: f1(w * 0.04), cy: 1, rx: f1(w * 0.56), ry: f1(Math.max(3, hh * 0.05)) }),
        s('path', { class: 't30g-wall-end', d: endFace }),
        s('path', { class: `t30g-plaster${inner ? ' t30g-plaster-in' : ''}`, d: wall, filter: 'url(#ink-rough)' }),
        s('path', { class: 't30g-lime', d: lime }),
        s('path', { class: 't30g-damp', d: damp, filter: 'url(#ink-wash)' }),
        s('path', { class: 't30g-plinth', d: plinth, filter: 'url(#ink-rough)' }),
        s('path', { class: 't30g-joint', d: joints }),
        s('rect', { class: 't30g-eave-shade', x: f1(x0), y: f1(ey), width: f1(w), height: f1(wh * 0.3), fill: 'url(#t30g-eave)' }),
        s('circle', { class: 't30g-win-glow', cx: f1(wx), cy: f1(wy), r: f1(ws * 1.5), fill: 'url(#p2-lamp)' }),
        s('circle', { class: 't30g-win-sill', cx: f1(wx), cy: f1(wy), r: f1(ws * 0.62) }),
        s('circle', { class: 't30g-win-light', cx: f1(wx), cy: f1(wy), r: f1(ws * 0.5), fill: 'url(#p2-lamp-body)' }),
        s('path', { class: 't30g-reveal', d: stroke(arc(wx, wy, ws * 0.47, ws * 0.47, 195, 345, 16), ws * 0.12, 0.3, 0.3, 0.6) }),
        s('path', { class: 't30g-lattice', d: lattice }),
        inner ? null : shut(wx, wy, ws, -1), inner ? null : shut(wx, wy, ws, 1),
        branch(wx, wy, ws, inner),
        s('path', { class: 't30g-slope', d: slope, filter: 'url(#ink-rough)' }),
        s('path', { class: 't30g-gutter', d: gutters }),
        s('path', { class: 't30g-crown', d: crowns }),
        s('path', { class: 't30g-tile-end', d: ends }),
        s('path', { class: 't30g-ridge', d: cap, filter: 'url(#ink-rough)' }),
        s('path', { class: 't30g-coping-rim', d: stroke([[x0 - ov * 0.5, ry - capH * 0.1], [x1 + ov * 0.6, ry - capH * 0.14], [x1 + ov, ry - capH * 0.4]], Math.max(1, capH * 0.1), 0.2, 0.1, 0.2) }),
        paperLantern((inner ? 1 : -1) * w * 0.3, ey + capH * 0.08, Math.max(4, hh * 0.07), seed + 9, hh * 0.06),
      ]
      return kids.filter(Boolean) as SVGElement[]
    }
    const shut = (wx: number, wy: number, ws: number, sd: -1 | 1) => s('path', { class: `t30g-shutter t30g-shutter-${sd < 0 ? 'l' : 'r'}`, d: `M${f1(wx)} ${f1(wy - ws * 0.56)}h${f1(sd * ws * 0.56)}v${f1(ws * 1.12)}h${f1(-sd * ws * 0.56)}Z` })
    // the hand at the window and the one branch it hands out (it reaches further when Freedom is lit); seen from inside,
    // the keeper's sleeve reaches into the light
    function branch(wx: number, wy: number, ws: number, inner: boolean) {
      const d = inner ? -1 : 1
      const twig = curve([wx + d * ws * 0.12, wy + ws * 0.12], [wx + d * ws * 0.85, wy + ws * 0.55], [wx + d * ws * 1.75, wy + ws * 0.22], 12)
      let buds = ''
      ;[5, 7, 9, 11, 12].forEach((k, i) => {
        const [x, y] = twig[k]
        buds += blob(x + (i % 2 ? 2 : -2), y - 2 - (i % 2) * 2, ws * 0.1, ws * 0.1, 3021 + i, 0.25, 7)
      })
      const hand = inner
        ? stroke(curve([wx + ws * 0.9, wy + ws * 1.05], [wx + ws * 0.45, wy + ws * 0.5], [wx - ws * 0.02, wy + ws * 0.14], 8), ws * 0.26, 0.4, 0.15, 0.5)
        : blob(wx + ws * 0.2, wy + ws * 0.12, ws * 0.14, ws * 0.1, 3029, 0.2, 9) + stroke([[wx - ws * 0.12, wy + ws * 0.22], [wx + ws * 0.16, wy + ws * 0.14]], ws * 0.13, 0.1, 0.2, 0.6)
      return s('g', { class: 't30g-branch' },
        s('path', { class: 't30-limb', d: stroke(twig, Math.max(1.2, ws * 0.07), 0.1, 0.6, 0.2) }),
        s('path', { class: 't30-flower', d: buds }),
        s('path', { class: inner ? 't30-figure' : 't30g-hand', d: hand }))
    }
    return { art: side(false, 3020), back: side(true, 3040), sil: wall + slope + cap }
  }

  // the visitor outside the wall: what the closed garden asks of them, one little scene per lantern
  function visitorArt(w: number, hh: number) {
    const fx = w * 0.12, k = hh * 0.86
    const coin = s('g', { class: 't30g-vc' },
      s('path', { class: 't30g-box', d: `M${f1(-w * 0.42)} ${f1(-k * 0.62)}h${f1(w * 0.26)}v${f1(k * 0.2)}h${f1(-w * 0.26)}Z` }),
      s('circle', { class: 't30g-coin', cx: f1(-w * 0.29), cy: f1(-k * 0.82), r: f1(Math.max(2, k * 0.05)) }))
    const letter = s('g', { class: 't30g-vp' }, s('path', { class: 't30g-letter', d: `M${f1(-w * 0.3)} ${f1(-k * 0.78)}l${f1(w * 0.2)} -2l1 ${f1(k * 0.12)}l${f1(-w * 0.2)} 2Z` }))
    const slip = s('g', { class: 't30g-vm' }, s('path', { class: 't30g-slip-bad', d: `M${f1(-w * 0.32)} ${f1(-k * 0.74)}l${f1(w * 0.16)} -1l1 ${f1(k * 0.22)}l${f1(-w * 0.16)} 1Z` }))
    return {
      art: [
        s('ellipse', { class: 't30-contact', cx: f1(fx), cy: 1, rx: f1(w * 0.26), ry: f1(Math.max(2, hh * 0.04)) }),
        s('path', { class: 't30-figure', d: figure(fx, 0, k, 3051, -1, { stoop: 0.12, arm: 1 }) }),
        coin, letter, slip,
      ],
      sil: '',
    }
  }

  // the gardener of the open side: pruning (Freedom) or hauling a pot and a jar of lamp oil (Cost)
  function gardenerArt(w: number, hh: number) {
    const k = hh * 0.86
    return {
      art: [
        s('ellipse', { class: 't30-contact', cx: 0, cy: 1, rx: f1(w * 0.3), ry: f1(Math.max(2, hh * 0.04)) }),
        s('g', { class: 't30g-gf' },
          s('path', { class: 't30-figure', d: figure(-w * 0.12, 0, k, 3061, 1, { hat: 'cone', stoop: 0.25, arm: 0.6 }) }),
          sapling(w * 0.26, 0, k * 0.6, 3062),
          s('path', { class: 't30g-shears', d: stroke([[w * 0.04, -k * 0.62], [w * 0.16, -k * 0.7]], Math.max(1, k * 0.03), 0.1, 0.1, 0.6) + stroke([[w * 0.04, -k * 0.7], [w * 0.16, -k * 0.6]], Math.max(1, k * 0.03), 0.1, 0.1, 0.6) })),
        s('g', { class: 't30g-gc' },
          s('path', { class: 't30-figure', d: figure(0, 0, k * 0.92, 3063, 1, { hat: 'cone', stoop: 0.55, arm: -0.4 }) }),
          s('path', { class: 't30-clay', d: blob(-w * 0.12, -k * 0.62, w * 0.17, k * 0.16, 3064, 0.12, 12) }),
          s('path', { class: 't30-leaf', d: blob(-w * 0.14, -k * 0.86, w * 0.12, k * 0.12, 3065, 0.3, 10) }),
          s('path', { class: 't30g-jar', d: blob(w * 0.3, -k * 0.2, w * 0.08, k * 0.12, 3066, 0.1, 10) })),
      ],
      sil: '',
    }
  }

  function gateArt(w: number, hh: number) {
    const gw = w * 0.46, gh = hh * 0.84, bw = Math.max(3, w * 0.05)
    // the doors flung wide: each swung out toward the viewer, so its free edge stands nearer — lower and taller on screen
    const door = (side: -1 | 1) => {
      const hx = side * gw / 2
      const ox = hx + side * gw * 0.52, oy = gh * 0.1 // where its free edge ends up (nearer)
      const dh = gh * 0.72
      // a solid woven panel (not a row of stakes): seams, two rails and a Z brace, a moonlit free edge
      const at = (t: number, k: number): Pt => [hx + (ox - hx) * t, oy * t - dh * k * (1 + t * 0.14)]
      const panel = `M${P(at(0, 0))}L${P(at(1, 0))}L${P(at(1, 1))}L${P(at(0, 1))}Z`
      let seams = ''
      for (let i = 1; i < 6; i++) seams += `M${P(at(i / 6, 0.02))}L${P(at(i / 6, 0.98))}`
      const rail = (k: number) => stroke([at(0, k), at(1, k)], Math.max(1.4, bw * 0.34), 0.05, 0.05, 0.4)
      const brace = stroke([at(0.06, 0.24), at(0.94, 0.7)], Math.max(1.4, bw * 0.3), 0.05, 0.05, 0.4)
      return s('g', { class: 't30g-door' },
        s('path', { class: 't30g-door-panel', d: panel, filter: 'url(#ink-rough)' }),
        s('path', { class: 't30g-door-seam', d: seams }),
        s('path', { class: 't30-culm-door', d: rail(0.24) + rail(0.7) + brace }),
        s('path', { class: 't30-culm-hi', d: stroke([at(1, 0.04), at(1, 0.96)], Math.max(1, bw * 0.2), 0.1, 0.1, 0.3) }))
    }
    const sil = `M${f1(-gw / 2 - bw)} 0V${f1(-gh)}H${f1(gw / 2 + bw)}V0Z`
    return {
      art: [
        s('ellipse', { class: 't30-contact', cx: 0, cy: 1, rx: f1(w * 0.45), ry: f1(Math.max(2, hh * 0.04)) }),
        door(-1), door(1),
        bamboo([-gw / 2, 1], [-gw / 2, -gh], bw, 3031, true, 0),
        bamboo([gw / 2, 1], [gw / 2, -gh], bw, 3032, true, 0),
        bamboo([-gw / 2 - gw * 0.3, -gh + 3], [gw / 2 + gw * 0.3, -gh - 1], bw * 0.9, 3033, true, 0),
        bamboo([-gw / 2 - gw * 0.12, -gh * 0.8], [gw / 2 + gw * 0.12, -gh * 0.8], bw * 0.6, 3034, false, 0),
        paperLantern(-gw / 2 - gw * 0.12, -gh + 2, Math.max(4, hh * 0.08), 3035, gh * 0.1),
        paperLantern(gw / 2 + gw * 0.12, -gh + 2, Math.max(4, hh * 0.08), 3036, gh * 0.1),
      ],
      sil,
    }
  }

  // ── the still world: moon behind, far shore with houses, water, stepping-stone paths for the open side
  function drawBg(W: number, H: number, cx: number, cy: number, thick: number, proj: (x: number, y: number, z: number) => Pt) {
    bg.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    const r = rng(3070)
    const tall = W / H < 0.9
    const shore = cy - R * (tall ? 0.78 : 0.52)
    const mr = clamp(R * 0.2, 16, 46)
    // the moon stands clear of the blossom tree's crown, up and to the right (the lacquer catches it on that side)
    const [mx, my] = [Math.min(cx + R * (tall ? 1.05 : 1.32), W * 0.86), Math.max(mr * 1.6, shore - R * (tall ? 0.62 : 0.92))]
    // far houses on the shore, both sides of the tray; paths of stepping stones reach them from the open side
    const xs = tall ? [0.08, 0.25, 0.75, 0.92] : [0.08, 0.19, 0.3, 0.7, 0.81, 0.92]
    const houses = xs.map((k, i) => {
      const x = W * k + (r() - 0.5) * W * 0.02, y = shore + 2 + r() * R * 0.05
      return { ...house(x, y, clamp(R * 0.15, 18, 40) * (0.85 + r() * 0.3), 3071 + i), x, y }
    })
    // stepping stones across the water: from the open side of the tray to the two nearest houses on each side, big and
    // far apart near the tray, small and close at the far shore; each a lit top, a dark lip, a shadow on the water
    const near = proj(0, 0, R * 1.04)[1] // the tray's front rim on the water
    const paths = houses.map((ho, i) => {
      if (i === 0 || i === houses.length - 1) return null // the outermost houses are reached along the shore
      const side = ho.x < cx ? -1 : 1
      const a = proj(side * R * 1.02, 0, R * 0.42)
      const pts = curve([a[0] + side * R * 0.12, a[1] + R * 0.05], [a[0] + side * R * (tall ? 0.25 : 0.62), (a[1] + ho.y) / 2 + R * 0.28], [ho.x, ho.y + 3], 48)
      const len: number[] = [0]
      for (let k = 1; k < pts.length; k++) len.push(len[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]))
      let top = '', lip = '', sh = '', hi = ''
      let k = 0
      for (let d = 0; d < len[len.length - 1] - 4;) {
        while (k < len.length - 2 && len[k + 1] < d) k++
        const [x, y] = pts[k]
        const depth = clamp((y - shore) / Math.max(1, near - shore), 0, 1.3) // 0 far shore … 1 the tray's front
        const rx = clamp(R * (0.018 + 0.075 * depth), 2.2, 26), ry = rx * (0.28 + depth * 0.12)
        const sd = 3080 + i * 40 + Math.round(d)
        sh += blob(x + rx * 0.1, y + ry * 0.7, rx * 1.1, ry * 0.8, sd, 0.15, 10)
        lip += blob(x, y + ry * 0.28, rx, ry, sd + 1, 0.12, 12)
        top += blob(x, y, rx * 0.96, ry * 0.86, sd + 2, 0.12, 12)
        hi += stroke(curve([x - rx * 0.62, y - ry * 0.2], [x - rx * 0.1, y - ry * 0.8], [x + rx * 0.55, y - ry * 0.45], 6), Math.max(0.8, ry * 0.3), 0.3, 0.3, 0.1)
        d += rx * 2.5 + 2
      }
      return s('g', { class: 't30g-path', style: `--i:${i}` },
        s('path', { class: 't30g-step-sh', d: sh }), s('path', { class: 't30g-step-lip', d: lip }), s('path', { class: 'p2p-step', d: top }), s('path', { class: 'p2p-step-hi', d: hi }))
    }).filter(Boolean) as SVGGElement[]
    const water = `M0 ${f1(shore)}H${f1(W)}V${f1(H)}H0Z`
    const gid = 't30g-wg'
    let rip = ''
    for (let i = 0; i < 60; i++) {
      const t = Math.pow(r(), 0.8), y = shore + 6 + (H - shore) * t, len = W * (0.02 + t * 0.06) * (0.5 + r())
      const x = r() * W
      rip += stroke([[x, y], [x + len * 0.5, y + (r() - 0.5)], [x + len, y]], 0.8 + t * 1.4, 0.3, 0.3, 0.1)
    }
    let road = ''
    for (let y = shore + 4; y < H; y += 3 + (y - shore) * 0.05 + r() * 3) {
      const near = (y - shore) / (H - shore)
      if (r() > 0.85 - near * 0.3) continue
      const len = W * (0.015 + near * 0.04) * (0.5 + r())
      const x = mx + (r() - 0.5) * W * (0.02 + near * 0.06) - len / 2
      road += stroke([[x, y], [x + len, y + (r() - 0.5)]], 0.9 + near * 1.6, 0.25, 0.25, 0.1)
    }
    const [lx, ly] = proj(0, thick, 0)
    const bh = baseH()
    const vigPriv = houses[Math.min(1, houses.length - 1)], vigMis = houses[houses.length - 2]
    bg.replaceChildren(
      mist(W * 0.5, shore - R * 0.5, W * 0.7, R * 0.9),
      moon(mx, my, mr, 3075, true),
      hills(-W * 0.05, W * 1.05, shore, Math.min(R * 0.55, shore - my - mr), 3076, 0.9, 5),
      hills(-W * 0.04, W * 0.4, shore + 1, R * 0.28, 3077, 0.6, 2),
      hills(W * 0.62, W * 1.04, shore + 1, R * 0.24, 3078, 0.62, 2),
      mist(W * 0.5, shore, W * 0.62, R * 0.12),
      s('defs', null, s('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 },
        s('stop', { offset: 0, class: 't30g-wst', style: 'stop-opacity:0.25' }),
        s('stop', { offset: 0.35, class: 't30g-wst', style: 'stop-opacity:0.85' }),
        s('stop', { offset: 0.8, class: 't30g-wst', style: 'stop-opacity:0.55' }),
        s('stop', { offset: 1, class: 't30g-wst', style: 'stop-opacity:0' })),
        // the shadow the tiled eave throws on the lime (the wall flats use it)
        s('linearGradient', { id: 't30g-eave', x1: 0, y1: 0, x2: 0, y2: 1 },
          s('stop', { offset: 0, style: 'stop-color:var(--umbra);stop-opacity:.42' }),
          s('stop', { offset: 0.35, style: 'stop-color:var(--umbra);stop-opacity:.14' }),
          s('stop', { offset: 1, style: 'stop-color:var(--umbra);stop-opacity:0' })),
        // the stone base: the moon behind-right leaves its left side in shade
        s('linearGradient', { id: 't30g-base-g', x1: 0, y1: 0, x2: 1, y2: 0 },
          s('stop', { offset: 0, style: 'stop-color:var(--umbra);stop-opacity:.55' }),
          s('stop', { offset: 0.6, style: 'stop-color:var(--umbra);stop-opacity:.12' }),
          s('stop', { offset: 1, style: 'stop-color:var(--umbra);stop-opacity:.02' }))),
      s('path', { class: 't30g-water', d: water, fill: `url(#${gid})` }),
      wash(`M${f1(-W * 0.05)} ${f1(shore + 3)}Q${f1(W * 0.25)} ${f1(shore - R * 0.06)} ${f1(W * 0.42)} ${f1(shore + 1)}L${f1(W * 0.58)} ${f1(shore + 1)}Q${f1(W * 0.78)} ${f1(shore - R * 0.07)} ${f1(W * 1.05)} ${f1(shore + 2)}L${f1(W * 1.05)} ${f1(shore + R * 0.05)}L${f1(-W * 0.05)} ${f1(shore + R * 0.05)}Z`, 0.5, 'p2p-wash t30g-land'),
      s('ellipse', { class: 't30g-road', cx: f1(mx), cy: f1(shore + (H - shore) * 0.3), rx: f1(R * 0.35), ry: f1((H - shore) * 0.36), fill: 'url(#p2-road)' }),
      s('path', { class: 'p2p-ripple', d: rip }),
      s('path', { class: 'p2p-road', d: road }),
      ...houses.map((ho) => ho.body),
      ...houses.map((ho, i) => {
        ho.win.setAttribute('style', `--i:${i}`)
        return ho.win
      }),
      // the far-shore scenes: someone at home with their own model (Privacy), a sapling whose stake is pulled (Misuse)
      s('g', { class: 't30g-v t30g-vbp' }, s('path', { class: 't30-figure', d: figure(vigPriv.door[0], vigPriv.door[1] + clamp(R * 0.05, 4, 9), clamp(R * 0.07, 7, 14), 3090, 1, { stoop: 0.1 }) })),
      s('g', { class: 't30g-v t30g-vbm' },
        sapling(vigMis.x + clamp(R * 0.16, 14, 30), vigMis.y + 2, clamp(R * 0.1, 10, 20), 3091, false),
        s('path', { class: 't30-figure', d: figure(vigMis.x + clamp(R * 0.27, 22, 48), vigMis.y + 2, clamp(R * 0.11, 10, 22), 3092, -1, { stoop: 0.5, arm: 0.8 }) }),
        s('path', { class: 't30-stake', d: stroke([[vigMis.x + clamp(R * 0.3, 24, 52), vigMis.y - clamp(R * 0.1, 8, 18)], [vigMis.x + clamp(R * 0.38, 30, 66), vigMis.y - clamp(R * 0.17, 14, 30)]], 1.4, 0.1, 0.1, 0.6) })),
      mist(W * 0.5, shore + R * 0.05, W * 0.5, R * 0.06),
      ...paths,
      // the tray's reflection: a dark breath under it, the moon road broken by it
      wash(blob(lx, ly + bh + R * 0.36, R * 1.0, R * 0.2, 3093, 0.08), 0.32, 'p2p-wash t30g-reflect'),
      wash(blob(lx, ly + bh + R * 0.3, R * 1.1, R * 0.07, 3094, 0.12), 0.2, 'p2p-wash t30g-reflect'),
      ...pedestal(thick, bh, proj))
  }

  // ── the stone drum the tray rests on: it stands in the water, a ring of ripples at its foot, a dark lip where it
  // meets the lacquer; its front takes the carving (the caveat; a phone: the face's name too)
  const baseH = () => R * (root.classList.contains('tall') ? 0.42 : 0.54)
  function pedestal(thick: number, bh: number, proj: (x: number, y: number, z: number) => Pt): SVGElement[] {
    const rp = R * 0.62
    const ring = (y: number, rr: number, a0 = -90, a1 = 90, n = 40) => Array.from({ length: n + 1 }, (_, i) => {
      const a = (a0 + ((a1 - a0) * i) / n) * D2R
      return proj(Math.sin(a) * rr, y, Math.cos(a) * rr)
    })
    const top = ring(thick, rp), bot = ring(thick + bh, rp)
    const face = `M${top.map(P).join('L')}L${[...bot].reverse().map(P).join('L')}Z`
    // block joints: one course line, staggered verticals following the drum
    let joints = `M${ring(thick + bh * 0.5, rp, -84, 84, 30).map(P).join('L')}`
    for (const [a, y0, y1] of [[-62, 0, 0.5], [-20, 0, 0.5], [24, 0, 0.5], [66, 0, 0.5], [-42, 0.5, 1], [2, 0.5, 1], [46, 0.5, 1]]) {
      const p0 = proj(Math.sin(a * D2R) * rp, thick + bh * y0, Math.cos(a * D2R) * rp), p1 = proj(Math.sin(a * D2R) * rp, thick + bh * y1, Math.cos(a * D2R) * rp)
      joints += `M${P(p0)}L${P(p1)}`
    }
    let moss = ''
    for (let i = 0; i < 9; i++) {
      const a = (-80 + i * 20) * D2R, [x, y] = proj(Math.sin(a) * rp, thick + bh * 0.93, Math.cos(a) * rp)
      moss += blob(x, y, R * (0.05 + (i % 3) * 0.02), R * 0.02, 3120 + i, 0.4, 9)
    }
    const foot = ring(thick + bh, rp * 1.08, -100, 100, 44)
    const lip = ring(thick + bh * 0.06, rp, -86, 86, 30)
    const rim = ring(thick + bh * 0.04, rp, 20, 82, 16) // the moon is behind-right: its edge on the right of the drum
    const reflect = `M${bot.map(P).join('L')}L${[...ring(thick + bh * 1.4, rp * 0.98)].reverse().map(P).join('L')}Z`
    return [
      s('path', { class: 't30g-base-refl', d: reflect }),
      s('path', { class: 't30g-base', d: face, filter: 'url(#ink-rough)' }),
      s('path', { class: 't30g-base-shade', d: face, fill: 'url(#t30g-base-g)' }),
      s('path', { class: 't30g-base-joint', d: joints }),
      s('path', { class: 't30g-base-lip', d: stroke(lip, Math.max(2, bh * 0.12), 0.05, 0.05, 0.7) }),
      s('path', { class: 't30g-base-rim', d: stroke(rim, Math.max(1.2, R * 0.012), 0.3, 0.2, 0.2) }),
      s('path', { class: 't30-leaf t30g-base-moss', d: moss, filter: 'url(#ink-wash)' }),
      s('path', { class: 't30g-base-foam', d: stroke(foot, Math.max(1.2, R * 0.01), 0.2, 0.2, 0.2) }),
    ]
  }
  /** the face's name on the lacquer side; at the end the caveat on the stone base (a phone: both on the base) */
  function carveFace() {
    if (!faceCarve || !baseCarve) return
    const tall = root.classList.contains('tall'), both = root.classList.contains('both')
    const name = isOpen() ? G.open : G.closed
    if (!tall) faceCarve.textContent = name
    // a phone's base is too small to carve on: there the face's name and the caveat read with the lantern's line
    caveat.textContent = tall && both ? G.caveat : ''
    const txt = !tall && both ? G.caveat : ''
    const lines = wrap(txt, 42)
    const fsz = Number(baseCarve.getAttribute('font-size'))
    baseCarve.replaceChildren(...lines.map((l, j) => s('tspan', { x: baseCarve!.getAttribute('x')!, dy: j ? f1(fsz * 1.3) : f1(-((lines.length - 1) * fsz * 1.3) / 2) }, l)))
    baseCarve.classList.toggle('note', both)
  }

  // ── what stands in front: the carvings, near reeds and a rock cut by the frame, the lanterns round the tray
  let countAt: Pt = [0, 0]
  function drawFg(W: number, H: number, cx: number, cy: number, thick: number, proj: (x: number, y: number, z: number) => Pt, tall: boolean) {
    fg.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    const bh = baseH()
    const arcAt = (y: number, rr = R * 1.002, a0 = -84, a1 = 84) => {
      const pts: Pt[] = []
      for (let i = 0; i <= 40; i++) {
        const a = (a0 + ((a1 - a0) * i) / 40) * D2R
        pts.push(proj(Math.sin(a) * rr, y, Math.cos(a) * rr))
      }
      return pts
    }
    const kids: SVGElement[] = []
    // the face's name, carved into the lacquer side along its front (desk)
    const fs = clamp(thick * 0.42, 13, 17)
    kids.push(s('path', { id: 't30g-arc-face', d: `M${arcAt(thick * 0.55).map(P).join('L')}`, fill: 'none' }))
    faceCarve = s('textPath', { href: '#t30g-arc-face', startOffset: '50%' })
    kids.push(s('text', { class: `t30g-carve t30g-carve-face${tall ? ' off' : ''}`, 'font-size': f1(fs), 'text-anchor': 'middle', 'dominant-baseline': 'central' }, faceCarve))
    // the stone base's carving, straight across its front
    const [bx] = proj(0, 0, 0), by = (proj(0, thick, R)[1] + proj(0, thick + bh, R * 0.62)[1]) / 2 + 3
    baseCarve = s('text', { class: 't30g-carve t30g-carve-base', x: f1(bx), y: f1(by), 'font-size': tall ? '14' : '14', 'text-anchor': 'middle', 'dominant-baseline': 'central' }) as SVGTextElement
    kids.push(baseCarve)
    // the turn mark: a two-way ink arrow on the island's front rim, a vermilion dot on its right rim (until turned)
    const rimPts = arcAt(0, R * 0.9, -58, 58)
    const hd = (p: Pt, q: Pt) => {
      const a = Math.atan2(p[1] - q[1], p[0] - q[0]), k = 9
      return `M${f1(p[0] + Math.cos(a + 2.6) * k)} ${f1(p[1] + Math.sin(a + 2.6) * k)}L${P(p)}L${f1(p[0] + Math.cos(a - 2.6) * k)} ${f1(p[1] + Math.sin(a - 2.6) * k)}`
    }
    kids.push(s('path', { class: 't30g-turn-arrow', d: `M${rimPts.map(P).join('L')}` + hd(rimPts[0], rimPts[2]) + hd(rimPts[40], rimPts[38]) }))
    rimAt = proj(Math.sin(80 * D2R) * R, 0, Math.cos(80 * D2R) * R)
    // near dark: reeds bottom left, a rock cut by the frame bottom right
    const rockD = blob(W * 1.02, H * 1.02, Math.min(W * 0.14, R * 0.6), R * 0.28, 3101, 0.12, 16)
    kids.push(
      reeds(W * 0.03, H * 1.01, Math.min(H * 0.22, R * 0.9), 3102, 9),
      s('path', { class: 't30g-near-rock', d: rockD, filter: 'url(#ink-rough)' }),
      s('path', { class: 't30g-near-rim', d: stroke(curve([W * 1.02 - Math.min(W * 0.13, R * 0.56), H * 1.0 - R * 0.05], [W * 0.97, H - R * 0.27], [W * 1.02, H - R * 0.26], 10), Math.max(1.5, R * 0.012), 0.2, 0.3, 0.1) }))
    fg.replaceChildren(...kids)
    carveFace()
    // lanterns round the tray on the water, on their own stones: two near its front, two out at its sides
    const lw = tall ? clamp(R * 0.3, 32, 42) : clamp(R * 0.26, 50, 76)
    const at: [number, number][] = tall ? [[-62, 1.18], [-22, 1.5], [22, 1.5], [62, 1.18]] : [[-108, 1.52], [-38, 1.24], [38, 1.24], [108, 1.52]]
    const yw = thick + bh // the water line, at the stone base's foot
    const spots = at.map(([a, k]) => proj(Math.sin(a * D2R) * R * k, yw, Math.cos(a * D2R) * R * k))
    lamps.forEach((b, i) => {
      const [x, y] = spots[i]
      Object.assign(b.style, { left: `${f1(x - lw)}px`, top: `${f1(y - lw * 1.43)}px`, width: `${f1(lw * 2)}px` })
      b.style.setProperty('--lw', `${f1(lw)}px`)
    })
    // the reading: bottom left, left-aligned, the insight's column (a phone: under the lanterns)
    const low = Math.max(...spots.map((p) => p[1])) + lw * 0.62 + 40
    if (tall) Object.assign(read.style, { top: `${f1(Math.max(low, proj(0, yw, R)[1] + 16))}px`, bottom: '' })
    else Object.assign(read.style, { top: '', bottom: '14px' })
    countAt = tall ? [W / 2, Math.max(low, proj(0, yw, R)[1] + 16) - 14] : [cx, Math.max(...spots.map((p) => p[1])) + lw * 0.62 + 34]
    Object.assign(turn.style, { left: `${f1(cx - R)}px`, top: `${f1(cy - R * 0.9)}px`, width: `${f1(R * 2)}px`, height: `${f1(R * 1.3)}px` })
  }
}

/** a short text in lines of at most n characters (whole words) */
function wrap(t: string, n: number): string[] {
  const out: string[] = []
  for (const w of t.split(' ')) {
    if (out.length && (out[out.length - 1] + ' ' + w).length <= n) out[out.length - 1] += ' ' + w
    else out.push(w)
  }
  return out
}

/** a stone lantern on its own rock in the water: its broken reflection, a warm streak on the water once lit */
function lampArt(seed: number): SVGSVGElement {
  let glint = ''
  for (let i = 0; i < 6; i++) glint += stroke([[-6 + (i % 2) * 5, 14 + i * 4.2], [5 + (i % 3) * 3, 14.4 + i * 4.2]], 1.6, 0.3, 0.3, 0.1)
  return s('svg', { class: 't30g-lamp-art', viewBox: '-30 -66 60 92', 'aria-hidden': 'true' },
    s('g', { class: 't30g-lamp-mirror', transform: 'translate(0 9) scale(1 -0.42)' }, toro(0, 0, 60, true)),
    s('path', { class: 't30g-lamp-glint', d: glint }),
    s('ellipse', { class: 't30g-lamp-ring', cx: 0, cy: 7, rx: 21, ry: 3.6 }),
    s('path', { class: 't30g-lamp-rock', d: blob(0, 4, 17, 6, seed, 0.18, 12), filter: 'url(#ink-rough)' }),
    s('path', { class: 't30g-lamp-rock-hi', d: stroke([[2, -1], [10, -0.5], [15, 2.5]], 1.4, 0.3, 0.3, 0.2) }),
    toro(0, 0, 60, true))
}
