import './circle.css'
import { fill, h, s } from '../../core/dom'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import { blob, clamp, curve, onSize, rng, rock, stroke, type Pt } from '../../ui/part2/ink'
import type { CircleApi } from '../../ui/part2/perspectives'
import { perspectiveCircle } from '../../ui/part2/perspectives'
import type { Perspectives } from '../../ui/part2/types'
import { hills, mist, moon, reeds, ridge } from '../../ui/part2/paint'
import type { SceneCtx, SceneDef } from '../types'
import C from '../../content/tram-25.json'
import { f1, lerp, project } from './art'
import { broken } from './kit'

const S = C.scenes.circle
const T0 = 70 // the pond seen 20° above the water …
const T1 = 3 // … and, once every stone has spoken, from straight above
const DEG = Math.PI / 180

/** A weeping willow from (x, y), h tall, leaning `dir`: trunk and limbs, the hanging strands, a pale crown wash. */
function willow(x: number, y: number, hh: number, seed: number, dir: number): SVGElement[] {
  const r = rng(seed)
  const top: Pt = [x + dir * hh * 0.16, y - hh]
  const spine = curve([x, y], [x - dir * hh * 0.1, y - hh * 0.55], top, 16)
  let wood = stroke(spine, hh * 0.055, 0.02, 0.55, 0.25)
  let strands = ''
  for (let i = 0; i < 5; i++) {
    const b = spine[8 + i * 2]
    const side = i % 2 ? -0.55 : 1
    const end: Pt = [b[0] + dir * side * hh * (0.28 + r() * 0.22), b[1] - hh * (0.04 + r() * 0.12)]
    wood += stroke(curve(b, [(b[0] + end[0]) / 2, end[1] - hh * 0.1], end, 8), hh * 0.02, 0.05, 0.6, 0.2)
    for (let k = 0; k < 10; k++) {
      const u = 0.15 + (k / 9) * 0.85
      const p: Pt = [b[0] + (end[0] - b[0]) * u, b[1] + (end[1] - b[1]) * u - Math.sin(u * Math.PI) * hh * 0.09]
      const L = hh * (0.28 + r() * 0.5) * (1 - i * 0.08)
      strands += stroke(curve(p, [p[0] + dir * L * 0.1, p[1] + L * 0.45], [p[0] + (r() - 0.3) * 8 * dir, p[1] + L], 7), 0.9 + r() * 0.9, 0.04, 0.55, 0.12)
    }
  }
  return [
    s('path', { class: 't25o-crown', d: blob(top[0] - dir * hh * 0.05, y - hh * 0.68, hh * 0.5, hh * 0.36, seed, 0.28, 16), filter: 'url(#ink-wash)' }),
    s('path', { class: 't25o-strand', d: strands }),
    s('path', { class: 't25o-wood', d: wood, filter: 'url(#ink-rough)' }),
  ]
}

/**
 * A bank stone, w × h standing on y = 0 (stone() viewBox): three tones — a lit crown plane, the mid face, the side away
 * from the moon (left) in shadow — an ink edge, moss on the crown, the moon on its right rim, a contact shadow thrown
 * left, and its reflection hanging below (shown only while it stands across the water: --refl). --near veils it dark
 * when it is the one we stand behind.
 */
function stone3(w: number, hh: number, seed: number): SVGElement[] {
  const { top, d } = rock(w, hh, seed)
  const n = top.length
  const crown = top.slice(Math.floor(n * 0.18), Math.floor(n * 0.86))
  const plane = `M${crown.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}L${[...crown].reverse().map(([x, y], i, a) => `${f1(x * 0.9)} ${f1(y + hh * (0.14 + 0.1 * Math.sin((i / (a.length - 1)) * Math.PI)))}`).join('L')}Z`
  const r = rng(seed + 5)
  let grain = ''
  for (let i = 0; i < 3; i++) {
    const x = (r() - 0.5) * w * 0.6, y = -hh * (0.25 + r() * 0.4)
    grain += stroke([[x, y], [x + w * 0.1, y + hh * 0.06], [x + w * 0.2, y + hh * 0.14]], 1.4, 0.3, 0.4, 0.2)
  }
  const ci = crown.reduce((b, p, i) => (p[1] < crown[b][1] ? i : b), 0)
  const mossPt = crown[Math.max(0, ci - 3)]
  return [
    s('g', { class: 't25o-srefl', transform: `translate(0 ${f1(hh * 0.06)}) scale(1 -0.7)` }, s('path', { d, filter: 'url(#ink-wash)' })),
    s('ellipse', { class: 't25o-contact', cx: f1(-w * 0.12), cy: 1, rx: f1(w * 0.62), ry: f1(Math.max(3, hh * 0.1)) }),
    s('path', { class: 't25o-face', d }),
    s('path', { class: 't25o-lit', d: plane }),
    s('path', { d, fill: 'url(#t25o-shadeg)' }),
    s('path', { class: 't25o-grain', d: grain }),
    s('path', { class: 't25o-ink', d: stroke([...top.slice(0, Math.floor(n * 0.45))], Math.max(1.6, w * 0.03), 0.2, 0.2, 0.3), filter: 'url(#ink-rough)' }),
    s('path', { class: 't25o-stonemoss', d: blob(mossPt[0], mossPt[1] + hh * 0.06, w * 0.2, hh * 0.08, seed + 7, 0.4, 10), filter: 'url(#ink-rough)' }),
    s('path', { class: 't25o-rimlit', d: stroke(top.slice(Math.floor(n * 0.5), n - 2), Math.max(1.6, w * 0.035), 0.25, 0.4, 0.15) }),
    s('path', { class: 't25o-veil', d }),
  ]
}

/**
 * Scene 4 — walking round a big pond, 20° above the water. Four stones of different shapes stand on its four banks;
 * the one you stand behind looms at the edge of the frame, the one across the water is tiny. Drag sideways to walk the
 * bank (four stops pull you in), or touch a stone / press 1–4. The moon stays put but its road on the water always runs
 * to your feet. Standing behind a stone, its person's words appear on the flat slab at your feet. All four heard: the
 * view rises until it looks straight down — the pond becomes a circle, the stones four dots of moss in an ensō, the
 * road is gone, only the moon in the still water.
 */
function stage(ctx: SceneCtx, host: HTMLElement, api: CircleApi) {
  const root = host.closest<HTMLElement>('.p2c')!
  root.classList.add('t25o')
  const stones = [...root.querySelectorAll<HTMLButtonElement>('.p2c-stone')]
  const n = stones.length
  const back = s('svg', { class: 't25o-back', 'aria-hidden': 'true' })
  const strip = s('g', { class: 't25o-strip' })
  const ground = s('svg', { class: 't25o-ground', 'aria-hidden': 'true' }) // turns with the walk
  const water = s('svg', { class: 't25o-water', 'aria-hidden': 'true' }) // the moon road on it always points at us
  const reflG = s('g', { class: 't25o-reflg' }) // the far shore upside down in the water: slides with the hills
  const view = h('div', { class: 't25o-view' }, ground, water)
  const shore = s('svg', { class: 't25o-shore', 'aria-hidden': 'true' }) // grass on the water's edge, mist on the far bank
  host.append(h('p', { class: 'visually-hidden' }, S.art), back, view, shore)

  let G: { W: number; H: number; cx: number; cy: number; Rp: number; Rs: number; Rb: number; P: number; py: number; tz: number; kFar: number; lift: number } | null = null
  let phi = 0, goal = 0, tilt = T0, tiltGoal = T0
  const theta = (k: number) => (-90 + (k * 360) / n) * DEG // where stone k stands on the bank (clockwise from the far side)
  const stopOf = (k: number) => Math.PI / 2 - theta(k) + 0.58 // stand behind it, a step to its right: it looms at the left edge
  phi = goal = stopOf(0) + Math.PI / n // start between two stones

  const place = () => {
    if (!G) return
    const { cx, cy, Rb, Rs, P, py, W } = G
    const down = (T0 - tilt) / (T0 - T1)
    const tz = G.tz * down * down // rising: the ground falls away so the whole circle fits
    const ty = G.lift * down // … and comes down to the middle of the frame, under the question
    const o = { left: cx - Rb, top: cy - Rb + ty, ox: Rb, oy: Rb, a: tilt * DEG, z: phi, tz, P, px: W / 2, py }
    const t = `translateY(${f1(ty)}px) translateZ(${f1(tz)}px) rotateX(${tilt.toFixed(2)}deg)`
    ground.style.transform = `${t} rotateZ(${(phi / DEG).toFixed(2)}deg)`
    water.style.transform = t
    root.style.setProperty('--down', down.toFixed(3))
    // the far hills and the willow slide a little as we walk (they are far): sideways with the walk, up as we rise;
    // their reflection slides with them
    const slide = Math.sin(phi) * W * 0.06
    strip.setAttribute('transform', `translate(${f1(slide)} 0)`)
    reflG.setAttribute('transform', `translate(${f1(slide / G.kFar)} 0)`)
    back.style.transform = `translateY(${f1(-down * G.H * 0.5)}px)`
    stones.forEach((b, k) => {
      const [x, y, sc] = project([Rb + Math.cos(theta(k)) * Rs, Rb + Math.sin(theta(k)) * Rs], o)
      const bw = parseFloat(b.style.width) || 92
      // the same real size on every bank; the one we stand behind grows into a dark mass cropped by the corner
      const near = clamp((sc - 1.25) / 0.5, 0, 1) * (1 - down)
      const want = G!.Rp * lerp(0.4, 0.3, down) * sc * (1 + near * 1.5)
      b.style.transform = `translate(${f1(x - near * W * 0.05)}px, ${f1(y + near * G!.H * 0.1)}px) scale(${(want / bw).toFixed(3)})`
      b.style.zIndex = String(Math.round(sc * 100))
      b.style.setProperty('--near', near.toFixed(2))
      // its reflection shows only while it stands across the water
      const a = theta(k) + phi
      b.style.setProperty('--refl', clamp((-Math.sin(a) - 0.25) / 0.5, 0, 1).toFixed(2))
      b.classList.toggle('is-near', sc > 1.5)
    })
  }

  // ── one loop: walking (eased toward the stop) and rising (once all are heard); asleep when there
  const loop = createLoop(root, (_t, dt) => {
    const f = dt > 0 ? 1 - Math.exp(-dt * 4) : 1
    phi += (goal - phi) * f
    tilt += (tiltGoal - tilt) * (dt > 0 ? 1 - Math.exp(-dt * 2.2) : 1)
    const busy = Math.abs(goal - phi) > 0.001 || Math.abs(tiltGoal - tilt) > 0.05
    if (!busy) (phi = goal), (tilt = tiltGoal)
    place()
    return busy
  })
  ctx.onCleanup(() => loop.dispose())
  const go = () => (ctx.reduced || ctx.quality === 'low' ? ((phi = goal), (tilt = tiltGoal), place()) : loop.start())
  /** walk to stand behind stone k (the shorter way round) */
  const walkTo = (k: number) => {
    let g = stopOf(k)
    while (g - phi > Math.PI) g -= Math.PI * 2
    while (phi - g > Math.PI) g += Math.PI * 2
    goal = g
    go()
  }

  // drag sideways to walk; let go and the nearest stop pulls you in (and that stone speaks)
  let drag: { x: number; phi: number; id: number; moved: boolean } | null = null
  let swallow = false
  root.addEventListener('pointerdown', (e) => {
    if ((e.target as Element).closest('.p2c-body-text, a, .fact-mark, button.mark, .insight')) return
    drag = { x: e.clientX, phi: goal, id: e.pointerId, moved: false }
  })
  root.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id || !G) return
    const dx = e.clientX - drag.x
    if (!drag.moved && Math.abs(dx) < 8) return
    if (!drag.moved) root.setPointerCapture(e.pointerId)
    drag.moved = true
    goal = drag.phi + (dx / G.W) * Math.PI * 1.2
    go()
  })
  const up = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return
    const moved = drag.moved
    drag = null
    if (!moved) return
    swallow = true // the click that ends a drag is not a touch on a stone
    setTimeout(() => (swallow = false), 0)
    let best = 0, bd = Infinity
    for (let k = 0; k < n; k++) {
      const d = Math.abs(Math.atan2(Math.sin(stopOf(k) - goal), Math.cos(stopOf(k) - goal)))
      if (d < bd) (bd = d), (best = k)
    }
    api.pick(best)
  }
  root.addEventListener('pointerup', up)
  root.addEventListener('pointercancel', up)
  root.addEventListener('click', (e) => {
    if (swallow) e.stopPropagation()
  }, true)

  // ── painting
  const layout = () => {
    const W = host.clientWidth, H = host.clientHeight
    if (W < 40 || H < 40) return
    const land = W / H > 1.05
    // a big pond, its near bank in front of us (the slab lies there), the stone we stand behind looms over it, the far one is small
    const Rp = land ? Math.min(W * 0.27, H * 0.64) : Math.min(W * 0.42, H * 0.27)
    const Rs = Rp * 1.24, Rb = Rp * 1.75
    const cx = W / 2, cy = H * (land ? 0.41 : 0.4)
    const P = Rs * 1.9, py = H * 0.26
    // from straight above the circle of stones must fit: pull the ground back by tz, and bring its centre down to the
    // middle of the frame under the question (lift, in pre-perspective px)
    const fit = Math.min(H * 0.37, W * 0.44) / (Rs * 1.12)
    const tz = Math.min(0, P - P / fit), k1 = P / (P - tz)
    const lift = (H * 0.56 - (py + (cy - py) * k1)) / k1
    const kFar = project([Rb, Rb - Rp], { left: cx - Rb, top: cy - Rb, ox: Rb, oy: Rb, a: T0 * DEG, P, px: W / 2, py })[2]
    G = { W, H, cx, cy, Rp, Rs, Rb, P, py, tz, kFar, lift }
    root.classList.toggle('t25o-land', land)
    const box = { left: `${f1(cx - Rb)}px`, top: `${f1(cy - Rb)}px`, width: `${f1(Rb * 2)}px`, height: `${f1(Rb * 2)}px` }
    Object.assign(ground.style, box)
    Object.assign(water.style, box)
    view.style.perspective = `${f1(G.P)}px`
    view.style.perspectiveOrigin = `${f1(W / 2)}px ${f1(G.py)}px`
    job?.cancel()
    job = sliced(paint(W, H, Rp, Rs, Rb, cx, land), { sync: ctx.reduced || !first })
    first = false
    place()
  }
  let job: { cancel(): void } | null = null
  let first = true
  ctx.onCleanup(() => job?.cancel())
  ctx.onCleanup(onSize(host, layout))
  api.onLayout(() => place())

  function* paint(W: number, H: number, Rp: number, Rs: number, Rb: number, cx: number, land: boolean) {
    const r = rng(2590)
    const vb = `${f1(-Rb)} ${f1(-Rb)} ${f1(Rb * 2)} ${f1(Rb * 2)}`
    ground.setAttribute('viewBox', vb)
    water.setAttribute('viewBox', vb)
    // the far shore (screen space): moon fixed, hills and a willow that slide a little as we walk
    const o = { left: G!.cx - Rb, top: G!.cy - Rb, ox: Rb, oy: Rb, a: T0 * DEG, P: G!.P, px: W / 2, py: G!.py }
    const far = project([Rb, Rb - Rs * 1.15], o)[1]
    const farW = project([Rb, Rb - Rp], o) // the water's far edge on screen
    const mx = W * (land ? 0.72 : 0.78), my = Math.max(H * 0.15, far - H * 0.14)
    const hillH = H * (land ? 0.15 : 0.1), willowX = cx - W * (land ? 0.3 : 0.3), willowH = H * (land ? 0.2 : 0.14)
    back.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    strip.replaceChildren(
      hills(-W * 0.3, W * 1.3, far + H * 0.01, hillH, 2591, 0.88, 6),
      hills(-W * 0.2, W * 0.7, far + H * 0.015, H * 0.08, 2592, 0.55, 3),
      ...willow(willowX, far + H * 0.02, willowH, 2593, 1),
      reeds(cx + W * 0.24, far + H * 0.02, H * 0.06, 2594, 7))
    back.replaceChildren(
      s('defs', null, s('linearGradient', { id: 't25o-shadeg', x1: 0, y1: 0, x2: 1, y2: 0 },
        s('stop', { offset: 0, style: 'stop-color:var(--umbra);stop-opacity:.55' }), s('stop', { offset: 0.38, style: 'stop-color:var(--umbra);stop-opacity:.32' }),
        s('stop', { offset: 0.5, style: 'stop-color:var(--umbra);stop-opacity:0' }))),
      mist(mx, my, W * 0.4, H * 0.18),
      moon(mx, my, Math.min(W, H) * (land ? 0.04 : 0.06), 2595, true),
      strip,
      mist(W * 0.5, far + H * 0.02, W * 0.7, H * 0.05))
    yield
    // the ground (turns as we walk): raked rings round the pond, moss on the banks, flat stones at the edge, the ensō
    let rake = ''
    for (let i = 0; i < 6; i++) {
      const rr = Rp * (1.1 + i * 0.13)
      let a = r() * 30
      while (a < 360) {
        const len = 40 + r() * 80
        rake += stroke(Array.from({ length: 13 }, (_, j) => {
          const t = (a + (Math.min(len, 360 - a) * j) / 12) * DEG
          return [Math.cos(t) * rr, Math.sin(t) * rr] as Pt
        }), 1.4 + r() * 1.2, 0.2, 0.2, 0.15)
        a += len + 6 + r() * 20
      }
    }
    let moss = '', flat = ''
    for (let i = 0; i < 14; i++) {
      const a = r() * Math.PI * 2, d = Rp * (1.05 + r() * 0.5)
      moss += blob(Math.cos(a) * d, Math.sin(a) * d, Rp * (0.08 + r() * 0.12), Rp * (0.05 + r() * 0.08), 2600 + i, 0.3, 12)
    }
    for (let i = 0; i < 22; i++) {
      const a = r() * Math.PI * 2, d = Rp * (1.0 + r() * 0.06)
      flat += blob(Math.cos(a) * d, Math.sin(a) * d, Rp * (0.03 + r() * 0.04), Rp * (0.025 + r() * 0.03), 2620 + i, 0.15, 10)
    }
    // from above: four moss cushions where the stones stood (a dark foot, a lit crown) …
    let dots = '', dotsLt = ''
    for (let k = 0; k < n; k++) {
      const x = Math.cos(theta(k)) * Rs, y = Math.sin(theta(k)) * Rs
      dots += blob(x, y, Rp * 0.085, Rp * 0.075, 2640 + k, 0.3, 12)
      dotsLt += blob(x + Rp * 0.015, y - Rp * 0.015, Rp * 0.055, Rp * 0.045, 2644 + k, 0.35, 10)
    }
    // … on one brushed ensō: pressed hard where it starts, thinning round the circle, its tail running dry
    const at = (deg: number, k = 1): Pt => [Math.cos(deg * DEG) * Rs * k * (1 + Math.sin(deg * 0.12) * 0.012), Math.sin(deg * DEG) * Rs * k]
    const sweep = Array.from({ length: 56 }, (_, j) => at(-70 + j * 5.2))
    let enso = stroke(sweep, Rp * 0.085, 0.04, 0.22, 0.25)
    for (let b = 0; b < 6; b++) {
      const kk = 1 + (b - 2.5) * 0.009
      enso += broken(Array.from({ length: 16 }, (_, j) => at(-70 + 55 * 5.2 + j * 2.6 - 10, kk)), Rp * (0.008 + r() * 0.008), 2655 + b, 0.7, 4)
    }
    ground.replaceChildren(
      s('defs', null, s('radialGradient', { id: 't25o-sand' }, s('stop', { offset: 0.5, class: 't25o-sand0' }), s('stop', { offset: 1, class: 't25o-sand1' }))),
      s('circle', { r: f1(Rb), fill: 'url(#t25o-sand)' }),
      s('path', { class: 't25o-rake', d: rake }),
      s('path', { class: 't25o-moss', d: moss, filter: 'url(#ink-wash)' }),
      s('circle', { class: 't25o-bank', r: f1(Rp * 1.03) }),
      s('path', { class: 't25o-flat', d: flat, filter: 'url(#ink-rough)' }),
      s('path', { class: 't25o-enso', d: enso, filter: 'url(#ink-rough)' }),
      s('path', { class: 't25o-dots', d: dots, filter: 'url(#ink-rough)' }),
      s('path', { class: 't25o-dots-lt', d: dotsLt, filter: 'url(#ink-rough)' }))
    yield
    // the water (never turns): darkest toward the far bank, where it holds the hills and the willow upside down,
    // broken by ripples; nearer, the sky; the moon's road in dry strokes from under the moon to our feet, widening
    const kFar = G!.kFar, sy = Math.cos(T0 * DEG) * kFar // plane px → screen px at the far edge (across, down)
    const toPlaneX = (X: number) => (X - W / 2) / kFar
    // (held a little shorter than a true mirror: ripples and the slant swallow the tips)
    const mirror = (pts: Pt[], base: number) => pts.map(([X, Y]) => [toPlaneX(X), -Rp + ((base - Y) / sy) * 0.55] as Pt)
    const shape = (pts: Pt[]) => `M${f1(pts[0][0])} ${f1(-Rp * 1.02)}L${pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}L${f1(pts[pts.length - 1][0])} ${f1(-Rp * 1.02)}Z`
    const hillsR = mirror(ridge(-W * 0.3, W * 1.3, far + H * 0.01, hillH, 2591, 6), far + H * 0.01)
    const hillsR2 = mirror(ridge(-W * 0.2, W * 0.7, far + H * 0.015, H * 0.08, 2592, 3), far + H * 0.015)
    const wx = toPlaneX(willowX), wl = ((willowH * 0.95) / sy) * 0.5
    const willowR = blob(wx + Rp * 0.04, -Rp + wl * 0.62, Rp * 0.16, wl * 0.4, 2596, 0.3, 14) + stroke([[wx, -Rp], [wx - Rp * 0.01, -Rp + wl * 0.5], [wx + Rp * 0.03, -Rp + wl]], Rp * 0.02, 0.1, 0.5, 0.2)
    let skin = '' // ripples breaking the reflection into bands
    for (let y = -Rp * 0.98; y < -Rp * 0.1; y += Rp * (0.035 + r() * 0.05)) {
      const x0 = (r() - 0.5) * Rp * 1.8, len = Rp * (0.2 + r() * 0.6)
      skin += stroke([[x0 - len / 2, y], [x0, y + (r() - 0.5) * 3], [x0 + len / 2, y]], Rp * (0.006 + r() * 0.01), 0.3, 0.3, 0.1)
    }
    const roadX = clamp(toPlaneX(mx), -Rp * 0.55, Rp * 0.55) // the road starts under the moon
    let road = ''
    for (let y = -Rp * 0.94; y < Rp * 0.97; ) {
      const t = (y + Rp) / (Rp * 2), c = lerp(roadX, 0, Math.pow(t, 0.85)), half = Rp * (0.025 + t * 0.2)
      const strokes = 1 + Math.floor(r() * (1 + t * 3))
      for (let q = 0; q < strokes; q++) {
        if (r() < 0.22) continue
        const len = Rp * (0.04 + t * 0.26) * (0.35 + r() * 0.9), x = c + (r() - 0.5) * half * 2
        // a dry stroke: two or three bits of one pull with gaps between
        const bits = 1 + Math.floor(r() * 3)
        for (let b = 0; b < bits; b++) {
          const a0 = x - len / 2 + (len * b) / bits, a1 = a0 + (len / bits) * (0.55 + r() * 0.35)
          road += stroke([[a0, y + (r() - 0.5) * 2], [a1, y + (r() - 0.5) * 3]], Rp * (0.008 + t * 0.03) * (0.6 + r() * 0.6), 0.25, 0.35, 0.12)
        }
      }
      y += Rp * (0.018 + r() * 0.03) * (1 + t * 1.2)
    }
    let still = '' // the moon's reflection from above: a few rings of calm round it
    for (let i = 0; i < 3; i++) still += broken(Array.from({ length: 41 }, (_, j) => [Math.cos((j / 40) * Math.PI * 2) * Rp * (0.22 + i * 0.12), Math.sin((j / 40) * Math.PI * 2) * Rp * (0.22 + i * 0.12)] as Pt), Rp * 0.006, 2680 + i, 0.55, 4)
    reflG.replaceChildren(
      s('path', { class: 't25o-refl far', d: shape(hillsR), filter: 'url(#ink-wash)' }),
      s('path', { class: 't25o-refl', d: shape(hillsR2), filter: 'url(#ink-wash)' }),
      s('path', { class: 't25o-refl tree', d: willowR, filter: 'url(#ink-wash)' }))
    water.replaceChildren(
      s('defs', null,
        s('clipPath', { id: 't25o-pondclip' }, s('circle', { r: f1(Rp) })),
        s('linearGradient', { id: 't25o-depth', gradientUnits: 'userSpaceOnUse', x1: 0, y1: f1(-Rp), x2: 0, y2: f1(Rp) }, s('stop', { offset: 0, class: 't25o-d0' }), s('stop', { offset: 0.4, class: 't25o-d1' }), s('stop', { offset: 1, class: 't25o-d2' })),
        s('radialGradient', { id: 't25o-halo' }, s('stop', { offset: 0, class: 't25o-h0' }), s('stop', { offset: 1, class: 't25o-h1' }))),
      s('circle', { r: f1(Rp), fill: 'url(#t25o-depth)' }),
      s('circle', { class: 't25o-calm', r: f1(Rp) }), // from above: one even, still water
      s('g', { 'clip-path': 'url(#t25o-pondclip)' },
        s('g', { class: 't25o-reflwrap' }, reflG, s('path', { class: 't25o-skin', d: skin })),
        s('g', { class: 't25o-roadg' }, s('path', { class: 't25o-road', d: road })),
        s('g', { class: 't25o-still' },
          s('circle', { r: f1(Rp * 0.42), fill: 'url(#t25o-halo)' }),
          s('path', { class: 't25o-stillring', d: still }),
          s('circle', { class: 't25o-moonw', r: f1(Rp * 0.12) }),
          s('path', { class: 't25o-moonsea', d: blob(-Rp * 0.03, -Rp * 0.02, Rp * 0.045, Rp * 0.03, 2697, 0.3, 10) + blob(Rp * 0.04, Rp * 0.04, Rp * 0.025, Rp * 0.02, 2698, 0.3, 8) }))),
      s('circle', { class: 't25o-rim', r: f1(Rp), filter: 'url(#ink-rough)' }))
    yield
    // the shore at rest (screen space, gone as we rise): tufts of grass standing on the water's edge, bigger near us,
    // mist lying over the far bank and the far edge of the water
    const rim = Array.from({ length: 36 }, (_, i) => project([Rb + Math.cos((i / 36) * Math.PI * 2) * Rp * 1.02, Rb + Math.sin((i / 36) * Math.PI * 2) * Rp * 1.02], o))
    let grass = '', grassFar = ''
    rim.forEach(([X, Y, k], i) => {
      if (r() < 0.3 || Y > H * 0.97) return
      const blades = 3 + Math.floor(r() * 4), hh = H * 0.022 * k * (0.7 + r() * 0.7)
      let tuft = ''
      for (let b = 0; b < blades; b++) {
        const x = X + (r() - 0.5) * hh * 0.8, lean = (r() - 0.5) * hh * 0.9, h2 = hh * (0.6 + r() * 0.5)
        tuft += stroke([[x, Y + 1], [x + lean * 0.35, Y - h2 * 0.55], [x + lean, Y - h2]], Math.max(0.9, hh * 0.07), 0.05, 0.7, 0.15)
      }
      if (i > 18 || k < 1) grassFar += tuft // the far half sits in the mist
      else grass += tuft
    })
    shore.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    shore.replaceChildren(
      mist(W * 0.5, farW[1] - H * 0.01, W * 0.62, H * 0.045),
      s('path', { class: 't25o-grass far', d: grassFar }),
      s('path', { class: 't25o-grass', d: grass, filter: 'url(#ink-rough)' }))
  }

  // stones: one big tile, then the same size on every bank (place() scales them by their distance)
  return {
    hear(k: number) {
      walkTo(k)
    },
    all() {
      tiltGoal = T1
      goal = phi
      go()
    },
  }
}

let current: { hear(k: number): void; all(): void } | null = null
let currentCtx: SceneCtx | null = null
const heard = new Set<number>()

const def = perspectiveCircle(S.perspectives as Perspectives, {
  label: S.label,
  prompt: S.prompt,
  question: S.question,
  stage: (host, api) => {
    current = stage(currentCtx!, host, api)
    return () => {
      current = null
      currentCtx = null
    }
  },
  place: () => ({ x: 0, y: 0, s: 1, z: 1 }),
  // four stones of different character, the same real size; a moss dot hides in each for the end. Each carries its
  // stance in two or three words, readable from across the pond (audit v3 25-4)
  stone: (k, _g, i) => s('g', null,
    s('path', { class: 't25o-mossdot', d: blob(0, -4, 30, 12, 2650 + k, 0.3, 12) }),
    s('g', { class: 't25o-stone' }, ...stone3([96, 70, 88, 80][k % 4], [52, 76, 44, 64][k % 4], 2660 + k * 7)),
    s('text', { class: 't25o-stance', x: 0, y: f1(-[52, 76, 44, 64][k % 4] * 0.42), 'text-anchor': 'middle' }, S.stances[i] ?? '')),
  onHear: (k) => {
    current?.hear(k)
    heard.add(k)
    const left = S.perspectives.stones.length - heard.size
    if (left > 0) currentCtx?.prompt(fill(S.promptNext, { n: left })) // H5: the next step, said in place
    queueMicrotask(() => {
      if (currentCtx?.art.querySelector('.p2c.is-all')) current?.all()
    })
  },
})

export const circleScene: SceneDef = {
  label: def.label,
  mount(ctx) {
    currentCtx = ctx
    heard.clear()
    return def.mount(ctx)
  },
}

