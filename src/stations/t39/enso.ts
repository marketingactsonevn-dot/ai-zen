import './enso.css'
import { fill, h, s } from '../../core/dom'
import { progress } from '../../core/progress'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import { onPrefs } from '../../core/prefs'
import { blob, clamp, onSize, rng, rock, stableHeight, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import type { SceneCtx } from '../types'
import { C } from './shell'
import { D2R, clip, dark, dawnSky, f1, f2, g39Defs, grain, idle, mossBed, polyD, readTok, rgba, type Tok } from './g39'

const K = C.scenes.enso
const PART2 = Array.from({ length: 21 }, (_, i) => 19 + i)
/** the crane: from a few centimetres above the sand (82°) to almost straight down (12°), in 3 s */
const TH0 = 82, TH1 = 12, CRANE = 3
/** how much of the circle one stroke closes: an ensō stays open */
const SWEEP = 330
/** how far the hand has to turn to close it (audit 39-5: a tilted ellipse turns less than a circle; ~300° is enough) */
const GESTURE = 300

type Lay = { W: number; H: number; R: number; wB: number; U: number; Vf: number; Vn: number; P: number; oy: number; hz0: number; s0: number; yc0: number; yc1: number; gap: number; wide: boolean }
type Spot = { id: number; u: number; v: number; w: number; seed: number; on: boolean }

/**
 * ★ Scene 5 — the ensō (CRANE, CSS 3D). Dawn over a raked sand garden seen from just above the sand: one stroke of the
 * visitor's own hand (any drag that turns ~330°, or the brush) lays a wet-cored, dry-edged ensō on the sand canvas; the
 * sun flares and the view cranes up to above the garden while a stone rises for every Moon Garden station walked
 * (the rest are raked hollows, an invitation). At the ensō's mouth: the vermilion seal (exam) and the cloth bundle
 * (toolkit). The sand is a canvas baked once in slices (grazing sun: every ridge throws a shadow); the plane, the stones
 * and the camera are transforms only, one createLoop that runs while drawing / craning / turning.
 */
export function ensoScene(ctx: SceneCtx) {
  g39Defs()
  const low = ctx.quality === 'low'
  const still = ctx.reduced || low
  const stable = stableHeight(ctx, [K.insight])
  const nVisited = PART2.filter((id) => progress.isVisited(id)).length
  const nAll = Array.from({ length: 39 }, (_, i) => i + 1).filter((id) => progress.isVisited(id)).length

  const sky = s('svg', { class: 't39e-sky', 'aria-hidden': 'true' })
  // the sand: four canvases in bands down the plane (each one a modest texture to hand over, one after another)
  const tiles = [0, 1, 2, 3].map(() => h('canvas', { class: 't39e-sand', 'aria-hidden': 'true' }))
  const ink = h('canvas', { class: 't39e-ink', 'aria-hidden': 'true' })
  const warm = h('div', { class: 't39e-warm', 'aria-hidden': 'true' })
  const garden = h('div', { class: 't39e-garden', 'aria-hidden': 'true' })
  const stamp = s('svg', { class: 't39e-stamp', viewBox: '-12 -12 24 24', 'aria-hidden': 'true' })
  const paper = h('div', { class: 't39e-paper' }, stamp,
    h('p', null, fill(K.visited, { n: nVisited })), h('p', null, fill(K.visitedAll, { n: nAll })))
  const seal = h('a', { class: 't39e-seal', href: '#/bai-thi-trang', 'aria-label': K.examAria }, sealArt(), h('span', { class: 't39e-tag g39-say' }, K.exam))
  const cloth = h('a', { class: 't39e-cloth', href: '#/do-nghe', 'aria-label': K.toolkitAria }, clothArt(), h('span', { class: 't39e-tag g39-say' }, K.toolkit))
  const exits = h('div', { class: 't39e-exits' }, paper, seal, cloth)
  const plane = h('div', { class: 't39e-plane' }, ...tiles, warm, ink, garden, exits)
  const view = h('div', { class: 't39e-view' }, plane)
  const brush = h('button', { class: 't39e-brush', type: 'button', 'aria-label': K.drawAria, onClick: () => auto() }, brushArt(), h('span', { class: 'g39-say' }, K.draw))
  const fore = s('svg', { class: 't39e-fore', 'aria-hidden': 'true', preserveAspectRatio: 'none' })
  // morning mist lying on the sand at the horizon, drifting a little (CSS, quality=high only, pauses when idle)
  const mist = h('div', { class: 't39e-mist', 'aria-hidden': 'true' }, h('i'), h('i'))
  const root = h('div', { class: `t39e${still ? ' is-still is-risen is-top' : ''}` }, h('p', { class: 'visually-hidden' }, K.art), sky, mist, view, fore, brush)
  for (const a of [seal, cloth]) a.tabIndex = -1
  stamp.append(s('rect', { x: -10, y: -10, width: 20, height: 20, rx: 1.5, class: 't39e-stamp-ink', filter: 'url(#ink-rough)' }),
    s('path', { class: 't39e-stamp-cut', d: stroke([[-6, -5], [6, -5]], 1.8, 0.1, 0.1, 0.4) + stroke([[0, -5], [0, 6]], 1.8, 0.1, 0.1, 0.4) + stroke([[-6, 6], [6, 6]], 1.8, 0.1, 0.1, 0.4) }))
  // the seal presses onto the paper, then the exam opens
  let pressing = 0
  seal.addEventListener('click', (e) => {
    e.preventDefault()
    if (pressing) return
    seal.classList.add('is-pressed')
    paper.classList.add('is-stamped')
    ctx.chime('soft')
    pressing = window.setTimeout(() => (location.hash = '#/bai-thi-trang'), ctx.reduced ? 120 : 520)
  })
  ctx.onCleanup(() => clearTimeout(pressing))
  ctx.art.append(root)
  idle(ctx, root)
  ctx.prompt(K.prompt)

  let L: Lay | null = null
  let T: Tok = readTok()
  let spots: Spot[] = []
  // camera: θ (rotateX), scale and the ring's screen y follow one eased t from the low view (0) to the high one (1)
  let camT = still ? 1 : 0
  let rz = 0, rzT = 0
  let phase: 'idle' | 'draw' | 'auto' | 'crane' | 'done' = 'idle'
  let told = false

  // ── the brush stroke (plane px, origin = the ring's centre) ────────────────────────────────────────────────────────
  // The stroke is kept as its samples along the circle ([progress, dryness]) and redrawn whole each frame it grows: one
  // filled outline for the wet body (smooth edges, no overlapping caps), dry streaks cut along it as long runs, a few
  // bristle lines inside. Never per-segment dabs (they stack into a dotted, stair-stepped edge).
  let sign = 0
  let painted = 0
  let strokes: [number, number][] = [] // [p, dryness] — replayed on theme change
  const g2 = ink.getContext('2d')!
  let kI = 1

  const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
  function spine(p: number): Pt {
    const { R, gap } = L!
    const a = gap + sign * (15 + p * SWEEP) * D2R
    const rr = R * (1 + 0.012 * Math.sin(p * 7 + 1) + 0.006 * Math.sin(p * 19)) + (p > 0.85 ? (p - 0.85) * R * 0.09 : 0)
    return [Math.cos(a) * rr, Math.sin(a) * rr]
  }
  // the brush presses in, swells, runs out of ink toward the lift (as the shared brushed ensō does)
  const swell = (p: number) => (p < 0.05 ? 0.7 + (p / 0.05) * 0.5 : 1.2 - 0.3 * p) * (p > 0.74 ? Math.max(0.1, 1 - ((p - 0.74) / 0.26) * 0.9) : 1)
  function render() {
    clearInk()
    const n = strokes.length
    if (!L || n < 2) return
    const { wB } = L
    const X: number[] = [], Y: number[] = [], NX: number[] = [], NY: number[] = [], Wd: number[] = [], D: number[] = []
    for (const [p, dry] of strokes) {
      const [x, y] = spine(p)
      X.push(x)
      Y.push(y)
      const a = Math.atan2(y, x)
      NX.push(Math.cos(a))
      NY.push(Math.sin(a))
      const d = Math.max(dry, p > 0.68 ? (p - 0.68) / 0.32 : 0)
      D.push(d)
      // a slow wobble on the half-width: a hand, not a compass
      Wd.push((wB * swell(p) * (1 - 0.3 * dry) * (1 - 0.45 * d) * (1 + 0.05 * Math.sin(p * 31 + 1.3) + 0.03 * Math.sin(p * 77))) / 2)
    }
    const outline = (k: number) => {
      g2.beginPath()
      for (let i = 0; i < n; i++) g2.lineTo(X[i] + NX[i] * Wd[i] * k, Y[i] + NY[i] * Wd[i] * k)
      for (let i = n - 1; i >= 0; i--) g2.lineTo(X[i] - NX[i] * Wd[i] * k * 0.94, Y[i] - NY[i] * Wd[i] * k * 0.94)
      g2.closePath()
    }
    g2.fillStyle = T.ink
    // a faint bleed into the sand round the wet body
    if (!low) {
      g2.globalAlpha = 0.08
      outline(1.25)
      g2.fill()
    }
    g2.globalAlpha = 0.93
    outline(1)
    g2.fill()
    // the press at the start: the brush set down, round
    g2.beginPath()
    g2.arc(X[0], Y[0], Wd[0] * 0.98, 0, Math.PI * 2)
    g2.fill()
    g2.globalAlpha = 1
    // flying white: long dry streaks running along the stroke where the brush ran out, each one bristle's gap
    g2.globalCompositeOperation = 'destination-out'
    g2.lineCap = 'round'
    g2.lineJoin = 'round'
    const N = low ? 6 : 11
    for (let k = 0; k < N; k++) {
      const o = (k + 0.5) / N - 0.5
      const load = ((k * 0.618) % 1) * 0.8 + 0.1
      g2.lineWidth = Math.max(0.8, (wB / N) * (0.55 + load * 0.5))
      g2.globalAlpha = 0.75 + load * 0.25
      g2.beginPath()
      let on = false
      for (let i = 0; i < n; i++) {
        const dry = D[i] * 1.05 + 0.2 * Math.sin(strokes[i][0] * (7 + k * 1.7) + k * 2.3) - 0.2
        const gap = dry > load
        const x = X[i] + NX[i] * Wd[i] * 2 * o, y = Y[i] + NY[i] * Wd[i] * 2 * o
        if (gap && !on) g2.moveTo(x, y)
        if (gap) g2.lineTo(x, y)
        on = gap
      }
      g2.stroke()
    }
    g2.globalCompositeOperation = 'source-atop'
    // the hairs: a few lighter lines inside the wet body
    g2.strokeStyle = dark() ? T.moon : T.paper
    g2.lineWidth = Math.max(0.6, wB * 0.03)
    for (let k = 0; k < (low ? 2 : 5); k++) {
      const o = (k / 4 - 0.5) * 1.3
      g2.globalAlpha = 0.1 + (k % 2) * 0.06
      g2.beginPath()
      for (let i = 0; i < n; i++) g2.lineTo(X[i] + NX[i] * Wd[i] * o, Y[i] + NY[i] * Wd[i] * o)
      g2.stroke()
    }
    g2.globalCompositeOperation = 'source-over'
    g2.globalAlpha = 1
  }
  function paintTo(target: number, dry: number) {
    target = Math.min(1, target)
    if (painted >= target - 1e-6) return
    if (!strokes.length) strokes.push([0, dry])
    while (painted < target - 1e-6) {
      painted = Math.min(target, painted + 1.2 / SWEEP)
      strokes.push([painted, dry])
    }
    render()
    if (painted >= 1 - 1e-6 && (phase === 'draw' || phase === 'auto')) finish()
  }
  function clearInk() {
    g2.setTransform(1, 0, 0, 1, 0, 0)
    g2.clearRect(0, 0, ink.width, ink.height)
    inkOrigin()
  }
  function inkOrigin() {
    const side = ink.width / kI
    g2.setTransform(kI, 0, 0, kI, (side / 2) * kI, (side / 2) * kI)
  }
  const replay = render

  // ── gesture: the total turning of the hand's path is the ensō's progress, wherever and however large it is drawn ──
  let turn = 0, lastDir = NaN, lx = 0, ly = 0, lt = 0
  let dragX = 0, rz0 = 0
  root.addEventListener('pointerdown', (e) => {
    if (e.button || (e.target as Element).closest('a, button')) return
    if (phase === 'done') {
      dragX = e.clientX
      rz0 = rzT
      root.setPointerCapture(e.pointerId)
      root.classList.add('is-turning')
      return
    }
    if (phase !== 'idle' || !L) return
    phase = 'draw'
    // a stroke lifted half way goes on from where it stopped (audit 39-5: lifting the finger never wipes the sand)
    turn = painted > 0 && sign ? sign * painted * GESTURE * D2R : 0
    if (!turn) sign = 0
    else ctx.prompt(K.prompt)
    lastDir = NaN
    lx = e.clientX
    ly = e.clientY
    lt = e.timeStamp
    root.setPointerCapture(e.pointerId)
    root.classList.add('is-drawing')
  })
  root.addEventListener('pointermove', (e) => {
    if (root.classList.contains('is-turning')) {
      rzT = clamp(rz0 + (e.clientX - dragX) * 0.12, -20, 20)
      // reduced motion: the garden turns with the hand, no easing after it
      if (ctx.reduced) (rz = rzT), apply()
      else loop.start()
      return
    }
    if (phase !== 'draw') return
    const dx = e.clientX - lx, dy = e.clientY - ly
    const d = Math.hypot(dx, dy)
    if (d < 5) return
    const dir = Math.atan2(dy, dx)
    if (!Number.isNaN(lastDir)) {
      let dd = dir - lastDir
      if (dd > Math.PI) dd -= Math.PI * 2
      if (dd < -Math.PI) dd += Math.PI * 2
      turn += dd
    }
    const speed = d / Math.max(4, e.timeStamp - lt) // px per ms
    lastDir = dir
    lx = e.clientX
    ly = e.clientY
    lt = e.timeStamp
    if (!sign && Math.abs(turn) > 0.3) sign = Math.sign(turn)
    if (sign) paintTo(Math.max(painted, (sign * turn) / (GESTURE * D2R)), clamp((speed - 0.7) / 2.6, 0, 0.75))
  })
  const up = () => {
    root.classList.remove('is-drawing', 'is-turning')
    if (phase !== 'draw') return
    phase = 'idle' // half a stroke stays on the sand; the next touch goes on from its end (H6: say so)
    if (painted > 0.02) ctx.prompt(K.more, 'wrong')
  }
  root.addEventListener('pointerup', up)
  root.addEventListener('pointercancel', up)

  let autoT = 0
  let fromKeys = false
  function auto() {
    if (phase !== 'idle' || !L) return
    fromKeys = true
    strokes = []
    painted = 0
    clearInk()
    sign = 1
    if (ctx.reduced) {
      phase = 'auto'
      paintTo(1, 0.15)
      return
    }
    phase = 'auto'
    autoT = 0
    loop.start()
  }

  function finish() {
    phase = 'crane'
    root.classList.add('is-drawn')
    brush.hidden = true
    ctx.chime('soft')
    if (still) return done()
    root.classList.add('is-risen')
    loop.start()
  }
  function done() {
    phase = 'done'
    camT = 1
    apply()
    root.classList.add('is-done')
    for (const a of [seal, cloth]) a.tabIndex = 0
    if (fromKeys) seal.focus({ preventScroll: true })
    if (!told) {
      told = true
      ctx.insight(K.insight)
      ctx.chime('ok')
    }
  }

  const loop = createLoop(root, (_t, dt) => {
    let busy = false
    if (phase === 'auto') {
      // a calligrapher's pace: a slow press, a quick middle, an unhurried lift
      autoT += dt
      const u = Math.min(1, autoT / 2)
      paintTo(u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2, clamp(Math.sin(u * Math.PI) * 0.7 - 0.1, 0, 1))
      busy = phase === 'auto' || phase === 'crane'
    }
    if (phase === 'crane') {
      camT = Math.min(1, camT + dt / CRANE)
      if (camT >= 1) done()
      else busy = true
    }
    if (phase === 'done' && rz !== rzT) {
      const d = rzT - rz
      rz = Math.abs(d) < 0.02 ? rzT : rz + d * (1 - Math.exp(-dt * 9))
      busy = rz !== rzT
    }
    apply()
    return busy
  })
  ctx.onCleanup(() => loop.dispose())

  // ── camera ────────────────────────────────────────────────────────────────────────────────────────────────────────
  function apply() {
    if (!L) return
    const { P, oy, hz0, s0, yc0, yc1, H } = L
    const e = ease(camT)
    const th = TH0 + (TH1 - TH0) * e
    const sc = s0 + (1 - s0) * e
    const yc = yc0 + (yc1 - yc0) * e
    plane.style.transform = `translate3d(0px,${f2((yc - oy) / sc)}px,${f2(P * (1 - 1 / sc))}px) rotateX(${f2(th)}deg) rotateZ(${f2(rz)}deg)`
    const hz = oy - P / Math.tan(th * D2R)
    sky.style.transform = `translateY(${f1(hz - hz0)}px)`
    mist.style.transform = `translateY(${f1(hz - hz0)}px)`
    if (th < 50 !== root.classList.contains('is-top')) root.classList.toggle('is-top', th < 50)
    if (!still) {
      fore.style.transform = `translateY(${f1(e * H * 0.45)}px)`
      fore.style.opacity = f2(clamp(1 - e * 1.6, 0, 1))
    }
  }

  // ── layout, sprites, the baked sand ─────────────────────────────────────────────────────────────────────────────
  let job: { cancel(): void } | null = null
  let first = true
  let paintSky = () => {}
  function layout() {
    // the scene runs full-bleed: out to the screen's sides and up under the header (the sky continues there)
    const Ha = stable(ctx.art.clientHeight)
    if (ctx.art.clientWidth < 60 || Ha < 60) return
    // the root runs full-bleed: out to the screen's sides, up under the header, a little down behind the foot
    const W = root.clientWidth, H = root.clientHeight, T0 = H - ctx.art.clientHeight - 24
    const wide = W > Ha * 1.1
    const R = Math.round(Math.min(Ha * (wide ? 0.36 : 0.27), W * (wide ? 0.4 : 0.37)))
    const wB = Math.max(13, R * 0.15)
    const P = clamp(Math.max(W, H) * 0.6, 600, 900)
    const hz0 = T0 + Ha * (wide ? 0.34 : 0.28)
    const oy = hz0 + P / Math.tan(TH0 * D2R)
    const yc1 = T0 + Ha * (wide ? 0.47 : 0.36), yc0 = T0 + Ha * (wide ? 0.66 : 0.6)
    const U = Math.round((W / 2) * 1.12 + 40), Vf = Math.round(Math.max(R * 2.8, yc1 + 80)), Vn = Math.round(Math.max(H - yc1 + 70, R * 1.5))
    // the low view's scale: the smallest at which the sand's near edge passes the frame's foot (in front of the camera)
    const sn = Math.sin(TH0 * D2R), cs = Math.cos(TH0 * D2R)
    let s0 = 0.3
    for (; s0 < 1.2; s0 += 0.02) {
      const tz = P * (1 - 1 / s0), Z = tz + Vn * sn
      if (Z > P - 60) { s0 = Math.max(0.3, s0 - 0.02); break }
      if (oy + ((yc0 - oy) / s0 + Vn * cs) * (P / (P - Z)) > H + 12) break
    }
    L = { W, H, R, wB, U, Vf, Vn, P, oy, hz0, s0, yc0, yc1, gap: (wide ? 24 : 90) * D2R, wide }
    Object.assign(view.style, { perspective: `${f1(P)}px`, perspectiveOrigin: `50% ${f1(oy)}px` })
    Object.assign(plane.style, { left: `${f1(W / 2 - U)}px`, top: `${f1(oy - Vf)}px`, width: `${2 * U}px`, height: `${Vf + Vn}px`, transformOrigin: `${U}px ${Vf}px` })
    const r = rng(3990)
    const Rin = R - wB * 0.9 - R * 0.1
    spots = PART2.map((id, i) => {
      const a = i * 2.39996 + 0.9, rr = Rin * Math.sqrt((i + 0.7) / 21.7)
      return { id, u: Math.cos(a) * rr, v: Math.sin(a) * rr * (1 + (r() - 0.5) * 0.08), w: R * (0.13 + r() * 0.08), seed: id * 13, on: progress.isVisited(id) }
    })
    Object.assign(mist.style, { top: `${f1(hz0 - Ha * 0.08)}px`, height: `${f1(Ha * 0.16)}px` })
    sky.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    Object.assign(sky.style, { width: `${W}px`, height: `${H}px` })
    paintSky = () => {
    const hh = Math.min(Ha * 0.15, 120)
    sky.replaceChildren(...dawnSky(W, H, hz0, W * 0.62, 3946, { moon: [W * (wide ? 0.16 : 0.2), T0 + Math.max(24, (hz0 - T0) * 0.32)], hillH: hh, sunY: hz0 - hh * 0.42 }), ...ground(W, H, hz0))
    if (!still) {
      fore.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
      const sw = clamp(W * 0.26, 140, 380)
      // two stones close to the lens, against the light: dark, rimmed with sun, out of focus
      const near = (x: number, y: number, w: number, hh: number, seed: number) => {
        const { top, d } = rock(w, hh, seed)
        return s('g', { transform: `translate(${f1(x)} ${f1(y)})` },
          s('path', { class: 't39e-fore-rock', d }),
          s('path', { class: 't39e-fore-rim', d: stroke(top.slice(2, -2), Math.max(2, w * 0.012), 0.2, 0.2, 0.2) }))
      }
      fore.replaceChildren(
        near(sw * 0.16, H + sw * 0.06, sw, sw * 0.46, 3997),
        mossBed(sw * 0.1, H - sw * 0.3, sw * 0.34, sw * 0.08, 3998),
        near(W - sw * 0.08, H + sw * 0.12, sw * 0.72, sw * 0.36, 3999))
    }
    }
    placeExits()
    // canvases: the sand over the whole plane, the ink over the ring only (sharper)
    const kS = low ? 0.7 : Math.min(devicePixelRatio || 1, 1.25)
    const bandH = (Vf + Vn) / tiles.length
    tiles.forEach((cv, i) => {
      cv.width = Math.round(2 * U * kS)
      cv.height = Math.ceil(bandH * kS)
      Object.assign(cv.style, { width: `${2 * U}px`, height: `${f1(bandH + 0.5)}px`, top: `${f1(i * bandH)}px` })
    })
    const side = Math.ceil(2 * (R + wB * 1.6))
    kI = low ? 1 : Math.min(devicePixelRatio || 1, 2)
    ink.width = ink.height = Math.round(side * kI)
    Object.assign(ink.style, { width: `${side}px`, height: `${side}px`, left: `${U - side / 2}px`, top: `${Vf - side / 2}px` })
    inkOrigin()
    replay()
    job?.cancel()
    const steps = build(kS)
    job = sliced(steps, { sync: ctx.reduced || !first })
    first = false
    apply()
  }

  function* build(kS: number): Generator {
    paintSky()
    yield
    // standing cut-outs one by one (each rises on its own); the stones from above and their shadows share two flat layers
    const sprites: HTMLElement[] = []
    const shades: SVGElement[] = [], tops: SVGElement[] = []
    let order = 0
    const nOn = spots.filter((p) => p.on).length || 1
    for (const p of spots) {
      if (!p.on) continue
      const d = `--d:${(0.25 + (order++ / nOn) * CRANE * 0.72).toFixed(2)}s`
      sprites.push(standing(p, d))
      const [sh, st] = lying(p)
      shades.push(sh)
      tops.push(st)
      if (order % 6 === 0) yield
    }
    const { U, Vf, Vn } = L!
    const flat = (cls: string, kids: SVGElement[]) => s('svg', { class: cls, viewBox: `${-U} ${-Vf} ${2 * U} ${Vf + Vn}`, style: `width:${2 * U}px;height:${Vf + Vn}px`, 'aria-hidden': 'true' }, ...kids)
    garden.replaceChildren(flat('t39e-shades', shades), flat('t39e-tops', tops), ...sprites)
    yield
    yield* bake(kS)
  }

  // the visited stations: a cut-out standing on the sand (the low view), a stone seen from above and its long shadow
  function standing(p: Spot, d: string) {
    const bw = p.w, bh = p.w * (0.62 + ((p.seed * 0.37) % 0.3))
    const { top, d: rd } = rock(bw, bh, p.seed)
    const [cid, cp] = clip(rd)
    const n = top.length
    const moss = p.id % 3 === 0
    const art = s('svg', { viewBox: `${f1(-bw * 0.7)} ${f1(-bh * 1.25)} ${f1(bw * 1.4)} ${f1(bh * 1.25)}`, 'aria-hidden': 'true' },
      cp, stoneArt(bw, bh, p.seed),
      moss ? s('path', { class: 't39e-moss', d: blob(-bw * 0.08, -bh * 0.95, bw * 0.32, bh * 0.16, p.seed, 0.3, 12), 'clip-path': `url(#${cid})` }) : null,
      s('path', { class: 't39e-sunrim', d: stroke(top.slice(Math.floor(n * 0.25), Math.floor(n * 0.85)), Math.max(1.2, bw * 0.04), 0.3, 0.3, 0.1) }))
    return h('div', { class: 't39e-up', style: `${d};left:${f1(L!.U + p.u - bw * 0.7)}px;top:${f1(L!.Vf + p.v - bh * 1.25)}px;width:${f1(bw * 1.4)}px;height:${f1(bh * 1.25)}px` }, art)
  }
  function lying(p: Spot): [SVGElement, SVGElement] {
    const w = p.w, q = rng(p.seed)
    // an irregular block of granite from above: a few broken corners, never an oval
    const nC = 6 + Math.floor(q() * 3)
    const a0 = q() * Math.PI
    const pts: Pt[] = Array.from({ length: nC }, (_, i) => {
      const a = a0 + (i / nC) * Math.PI * 2 + (q() - 0.5) * 0.55
      const rr = w * 0.5 * (0.72 + q() * 0.4)
      return [Math.cos(a) * rr, Math.sin(a) * rr * 0.86]
    })
    const outline = polyD(pts) + 'Z'
    // the top face: the outline drawn in toward the sun (far, a little right), a shade of the flank left showing
    const face = polyD(pts.map(([x, y]) => [x * 0.8 + w * 0.03, y * 0.78 - w * 0.06] as Pt)) + 'Z'
    let speck = ''
    for (let i = 0; i < 9; i++) speck += blob((q() - 0.5) * w * 0.6, (q() - 0.6) * w * 0.5, 0.6 + q() * 1.2, 0.5 + q(), p.seed + i, 0.3, 6)
    const at = `translate(${f1(p.u)} ${f1(p.v)})`
    // its long shadow raked across the sand away from the low sun: the outline swept toward the viewer, a little left
    const [sx, sy] = [-w * 0.95, w * 2.3]
    const sweep = [0, 0.2, 0.4, 0.6, 0.8, 1].map((k) => polyD(pts.map(([x, y]) => [x + sx * k, y + sy * k] as Pt)) + 'Z').join('')
    const sid = `t39e-sh${p.id}`
    const shadow = s('g', { transform: at },
      s('defs', null, s('linearGradient', { id: sid, gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: f1(sx), y2: f1(sy) },
        s('stop', { offset: 0, style: 'stop-color:var(--umbra);stop-opacity:.5' }),
        s('stop', { offset: 0.5, style: 'stop-color:var(--umbra);stop-opacity:.2' }),
        s('stop', { offset: 1, style: 'stop-color:var(--umbra);stop-opacity:0' }))),
      s('path', { d: sweep, fill: `url(#${sid})` }))
    // the edges that face the sun catch it (warm, thin); the rest stays matte
    let lit = ''
    for (let i = 0; i < nC; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % nC]
      const nx = y1 - y0, ny = -(x1 - x0)
      if ((nx * 0.4 - ny * 0.92) / (Math.hypot(nx, ny) || 1) > 0.3) lit += stroke([[x0, y0], [x1, y1]], Math.max(0.9, w * 0.035), 0.15, 0.15, 0.3)
    }
    const moss = p.id % 3 === 0
    const mx = (q() - 0.5) * w * 0.3 - w * 0.08, my = (q() - 0.2) * w * 0.2
    const stone = s('g', { transform: at },
      s('path', { class: 't39e-top-side', d: outline, filter: 'url(#ink-rough)' }),
      s('path', { class: 't39e-top-face', d: face }),
      s('path', { class: 't39e-top-speck', d: speck }),
      s('path', { class: 't39e-top-lit', d: lit }),
      moss ? s('path', { class: 't39e-moss', d: blob(mx, my, w * 0.2, w * 0.13, p.seed + 1, 0.35, 12) + blob(mx + w * 0.12, my + w * 0.06, w * 0.08, w * 0.06, p.seed + 2, 0.4, 9) }) : null)
    return [shadow, stone]
  }

  // the seal at the ensō's mouth, the paper beside it, the cloth bundle a little apart
  function placeExits() {
    const { R, gap, wide, W } = L!
    const gx = Math.cos(gap) * R, gy = Math.sin(gap) * R
    const pw = Math.round(wide ? clamp(R * 1.2, 250, 290) : Math.min(W - 150, 224))
    const seat = (el: HTMLElement, x: number, y: number) => Object.assign(el.style, { left: `${f1(L!.U + x)}px`, top: `${f1(L!.Vf + y)}px` })
    paper.style.width = `${pw}px`
    // the seal sits on the paper's corner, just outside the ensō's mouth; the cloth bundle a little apart
    const [px, py] = wide ? [gx + L!.wB * 0.7, gy - 26] : [-W / 2 + 128, gy + L!.wB * 0.55]
    seat(paper, px, py)
    seat(seal, px + 38, py + 36)
    if (wide) seat(cloth, px + pw + 56, py + 46)
    else seat(cloth, -W / 2 + 78, gy + L!.wB + 40)
  }

  /** the far sand under the sky (the plane covers the near part): sand, receding rake lines, the sun's path on it */
  function ground(W: number, H: number, hz: number): SVGElement[] {
    // between the horizon and the near sand: only morning haze thinning toward the viewer (no ruled lines)
    return [
      s('rect', { class: 't39e-ground', x: -2, y: f1(hz), width: f1(W + 4), height: f1(H * 4) }),
      s('defs', null, s('linearGradient', { id: 't39e-hazeg', x1: 0, y1: 0, x2: 0, y2: 1 },
        s('stop', { offset: 0, style: 'stop-color:var(--mist);stop-opacity:var(--mist-a)' }),
        s('stop', { offset: 0.5, style: 'stop-color:var(--mist);stop-opacity:calc(var(--mist-a) * 0.35)' }),
        s('stop', { offset: 1, style: 'stop-color:var(--mist);stop-opacity:0' }))),
      s('rect', { class: 't39e-haze', x: -2, y: f1(hz - 4), width: f1(W + 4), height: f1((H - hz) * 0.7), fill: 'url(#t39e-hazeg)' }),
      s('ellipse', { cx: f1(W * 0.62), cy: f1(hz + (H - hz) * 0.12), rx: f1(W * 0.08), ry: f1((H - hz) * 0.22), fill: 'url(#g39-sun)', class: 't39e-glare' }),
      s('rect', { class: 't39e-horizon', x: -2, y: f1(hz - 3), width: f1(W + 4), height: 8, fill: 'url(#g39-fog)' }),
    ]
  }

  // the raked sand under a grazing sun (from the far side): every groove a shadowed ridge, rings round the garden and
  // its stones, hollows where a station waits; the plane's edges fade into the paper
  function* bake(k: number): Generator {
    const { U, Vf, Vn, R, wB } = L!
    const dk = dark()
    const gap = clamp(R * 0.045, 6, 11)
    const Rz = R + wB * 1.1
    // the grooves go into a few paths (bands of rows, the rings, the spots' rings) so each stroke pass stays a short slice
    const paths: Path2D[] = []
    let path = new Path2D()
    let count = 0
    const poly = (pts: Pt[]) => {
      if (pts.length < 2) return
      path.moveTo(pts[0][0], pts[0][1])
      for (let i = 1; i < pts.length; i++) path.lineTo(pts[i][0], pts[i][1])
      count += pts.length
      if (count > 2600) (paths.push(path), (path = new Path2D()), (count = 0))
    }
    // straight rows outside the garden, stopping at its circle
    let n = 0
    for (let v = -Vf + gap; v < Vn; v += gap) {
      // a hand rake: the rows breathe a little
      const wob = (x: number) => v + Math.sin(x * 0.009 + v * 0.07) * 1.8 + Math.sin(x * 0.023 + v * 0.31) * 0.7
      const row = (x0: number, x1: number) => {
        const pts: Pt[] = []
        for (let x = x0; x <= x1; x += 36) pts.push([x, wob(x)])
        pts.push([x1, wob(x1)])
        poly(pts)
      }
      if (Math.abs(v) < Rz) {
        const x = Math.sqrt(Rz * Rz - v * v)
        row(-U, -x)
        row(x, U)
      } else row(-U, U)
      if (++n % 40 === 0) yield
    }
    yield
    // concentric rings inside, broken round each spot; small rings round the spots
    const near = spots.map((p) => [p.u, p.v, (p.w * 0.5 + gap * 2.3) ** 2])
    const away = (x: number, y: number) => {
      for (const [u, v, r2] of near) if ((x - u) ** 2 + (y - v) ** 2 < r2) return false
      return true
    }
    for (let rr = Rz - gap * 0.5; rr > gap * 1.5; rr -= gap) {
      const N = Math.max(24, Math.round((rr * Math.PI * 2) / 7))
      let run: Pt[] = []
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2
        const x = Math.cos(a) * rr, y = Math.sin(a) * rr
        if (away(x, y)) run.push([x, y])
        else (poly(run), (run = []))
      }
      poly(run)
      if (++n % 6 === 0) yield
    }
    paths.push(path)
    // the rings raked round each stone: their own, deeper grooves
    const rings = new Path2D()
    for (const p of spots) {
      const gapTo = Math.min(...spots.map((q) => (q === p ? 1e9 : Math.hypot(q.u - p.u, q.v - p.v) - q.w * 0.5)))
      for (const m of gapTo > p.w * 0.5 + gap * 3.6 ? [0.75, 1.75] : [0.75]) {
        const rr = p.w * 0.5 + gap * m
        const N = Math.max(16, Math.round((rr * Math.PI * 2) / 6))
        for (let i = 0; i <= N; i++) {
          const x = p.u + Math.cos((i / N) * Math.PI * 2) * rr, y = p.v + Math.sin((i / N) * Math.PI * 2) * rr * 0.98
          if (i) rings.lineTo(x, y)
          else rings.moveTo(x, y)
        }
      }
    }
    yield
    // each tile is painted (and so handed to the compositor) in its own slices
    const bandH = (Vf + Vn) / tiles.length
    for (const [ti, cv] of tiles.entries()) {
      const g = cv.getContext('2d')!
      g.setTransform(1, 0, 0, 1, 0, 0)
      g.globalCompositeOperation = 'source-over'
      g.globalAlpha = 1
      g.clearRect(0, 0, cv.width, cv.height)
      g.setTransform(k, 0, 0, k, U * k, (Vf - ti * bandH) * k)
      g.fillStyle = T.paper2
      g.fillRect(-U, -Vf, 2 * U, Vf + Vn)
      const lit = g.createLinearGradient(0, -Vf, 0, Vn)
      lit.addColorStop(0, rgba(T.dawn, dk ? 0.9 : 0.85))
      lit.addColorStop(0.55, rgba(T.dawn, dk ? 0.35 : 0.25))
      lit.addColorStop(1, rgba(T.dawn, 0))
      g.fillStyle = lit
      g.fillRect(-U, -Vf, 2 * U, Vf + Vn)
      g.globalAlpha = dk ? 0.08 : 0.06
      g.fillStyle = g.createPattern(grain(), 'repeat')!
      g.fillRect(-U, -Vf, 2 * U, Vf + Vn)
      g.globalAlpha = 1
      // the grooves: a long soft shadow toward the viewer, a sunlit lip toward the sun, the groove itself
      g.lineJoin = 'round'
      g.lineCap = 'round'
      const pass = (dy: number, color: string, alpha: number, w: number) => {
        g.save()
        g.translate(0, dy)
        g.strokeStyle = color
        g.globalAlpha = alpha
        g.lineWidth = w
        return (p: Path2D) => g.stroke(p)
      }
      for (const p of paths) {
        pass(gap * 0.26, T.umbra, dk ? 0.36 : 0.11, gap * 0.42)(p)
        g.restore()
        yield
        pass(-gap * 0.2, dk ? T.moon : '#fff', dk ? 0.08 : 0.6, gap * 0.2)(p)
        g.restore()
        pass(0, T.rake, dk ? 0.7 : 0.55, gap * 0.14)(p)
        g.restore()
        yield
      }
      // the rings round the stones, cut deeper: a wider shadow, a brighter lip, a darker groove
      pass(gap * 0.32, T.umbra, dk ? 0.6 : 0.24, gap * 0.55)(rings)
      g.restore()
      pass(-gap * 0.24, dk ? T.moon : '#fff', dk ? 0.16 : 0.9, gap * 0.26)(rings)
      g.restore()
      pass(0, T.rake, dk ? 0.85 : 0.8, gap * 0.2)(rings)
      g.restore()
      g.globalAlpha = 1
      // hollows where a station still waits: a shaded far wall, a sunlit near lip
      for (const p of spots) {
        if (p.on) continue
        const rs = p.w * 0.42
        g.fillStyle = T.umbra
        g.globalAlpha = dk ? 0.5 : 0.16
        g.beginPath()
        g.ellipse(p.u, p.v - rs * 0.1, rs, rs * 0.94, 0, 0, Math.PI * 2)
        g.fill()
        g.fillStyle = T.paper2
        g.globalAlpha = dk ? 0.85 : 0.9
        g.beginPath()
        g.ellipse(p.u, p.v + rs * 0.16, rs * 0.86, rs * 0.8, 0, 0, Math.PI * 2)
        g.fill()
        g.strokeStyle = dk ? T.moon : '#fff'
        g.globalAlpha = dk ? 0.16 : 0.8
        g.lineWidth = 1.4
        g.beginPath()
        g.ellipse(p.u, p.v, rs * 0.95, rs * 0.9, 0, 0.25, Math.PI - 0.25)
        g.stroke()
      }
      // a few beds of moss inside the ring
      g.fillStyle = T.mossB
      const mr = rng(3991)
      for (let i = 0; i < 4; i++) {
        const a = mr() * Math.PI * 2, rr = R * (0.35 + mr() * 0.45)
        g.globalAlpha = dk ? 0.5 : 0.22
        g.fill(new Path2D(blob(Math.cos(a) * rr, Math.sin(a) * rr, R * (0.08 + mr() * 0.06), R * (0.05 + mr() * 0.03), 3992 + i, 0.3, 16)))
      }
      g.globalAlpha = 1
      // the low sun: warm where it comes from (far, right), the raking light falling off across the garden, a vignette
      const warmG = g.createRadialGradient(U * 0.35, -Vf * 0.9, 0, U * 0.35, -Vf * 0.9, Math.max(U, Vf) * 1.5)
      warmG.addColorStop(0, rgba(T.lantern, dk ? 0.3 : 0.34))
      warmG.addColorStop(0.45, rgba(T.lantern, dk ? 0.1 : 0.12))
      warmG.addColorStop(1, rgba(T.lantern, 0))
      g.fillStyle = warmG
      g.fillRect(-U, -Vf, 2 * U, Vf + Vn)
      const fall = g.createLinearGradient(U * 0.4, -Vf * 0.6, -U * 0.5, Vn)
      fall.addColorStop(0, rgba(T.umbra, 0))
      fall.addColorStop(1, rgba(T.umbra, dk ? 0.3 : 0.14))
      g.fillStyle = fall
      g.fillRect(-U, -Vf, 2 * U, Vf + Vn)
      const vig = g.createRadialGradient(0, 0, R * 1.1, 0, 0, Math.max(U, Vn, R * 2.4))
      vig.addColorStop(0, rgba(T.umbra, 0))
      vig.addColorStop(1, rgba(T.umbra, dk ? 0.5 : 0.3))
      g.fillStyle = vig
      g.fillRect(-U, -Vf, 2 * U, Vf + Vn)
      yield
      // the plane's edges melt into the paper (the far edge longest, it meets the horizon in the low view)
      g.globalCompositeOperation = 'destination-out'
      const edge = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number) => {
        const gr = g.createLinearGradient(x0, y0, x1, y1)
        gr.addColorStop(0, 'rgba(0,0,0,1)')
        gr.addColorStop(1, 'rgba(0,0,0,0)')
        g.fillStyle = gr
        g.fillRect(rx, ry, rw, rh)
      }
      const fx = Math.min(140, U * 0.25), ff = Vf * 0.32, fn = Math.min(60, Vn * 0.2)
      edge(-U, 0, -U + fx, 0, -U, -Vf, fx, Vf + Vn)
      edge(U, 0, U - fx, 0, U - fx, -Vf, fx, Vf + Vn)
      edge(0, -Vf, 0, -Vf + ff, -U, -Vf, 2 * U, ff)
      edge(0, Vn, 0, Vn - fn, -U, Vn - fn, 2 * U, fn)
      g.globalCompositeOperation = 'source-over'
      yield
    }
  }

  ctx.onCleanup(onSize(ctx.art, layout))
  ctx.onCleanup(onPrefs(() => {
    const t = readTok()
    if (!L || (t.paper2 === T.paper2 && t.ink === T.ink)) return
    T = t
    job?.cancel()
    job = sliced(bake(tiles[0].width / (2 * L.U)), { sync: true })
    replay()
  }))
  ctx.onCleanup(() => job?.cancel())
}

/** The stone seal seen from above: a squat block of dark stone, its carved lion knob, vermilion paste on its foot. */
function sealArt() {
  return s('svg', { class: 't39e-seal-art', viewBox: '-30 -30 60 60', 'aria-hidden': 'true' },
    s('ellipse', { cx: 2, cy: 6, rx: 25, ry: 23, fill: 'url(#g39-ao)' }),
    s('path', { class: 't39e-seal-paste', d: blob(1.5, 3, 19, 18, 3993, 0.06, 12) }),
    s('path', { class: 't39e-seal-body', d: 'M-17 -15Q-18 -18 -15 -18H15Q18 -18 18 -15V15Q18 18 15 18H-15Q-18 18 -18 15Z', filter: 'url(#ink-rough)' }),
    s('path', { class: 't39e-seal-side', d: 'M-18 9V15Q-18 18 -15 18H15Q18 18 18 15V9Z' }),
    s('path', { class: 't39e-seal-knob', d: blob(0, -2, 10, 9, 3994, 0.25, 12) }),
    s('path', { class: 't39e-seal-knob-hi', d: stroke([[-7, -6], [-1, -10], [6, -8]], 2, 0.3, 0.3, 0.2) }),
    s('path', { class: 't39e-seal-rim', d: stroke([[-16, -17], [0, -18.5], [16, -17]], 1.6, 0.2, 0.2, 0.2) }))
}

/** A furoshiki bundle from above: a square of indigo cloth tied over its load, two ears of the knot, its folds. */
function clothArt() {
  return s('svg', { class: 't39e-cloth-art', viewBox: '-34 -34 68 68', 'aria-hidden': 'true' },
    s('ellipse', { cx: 3, cy: 7, rx: 30, ry: 27, fill: 'url(#g39-ao)' }),
    s('path', { class: 't39e-cloth-body', d: 'M-24 -6Q-27 -24 -8 -25Q8 -28 24 -20Q29 -2 25 16Q12 27 -6 25Q-26 22 -24 -6Z', filter: 'url(#ink-rough)' }),
    s('path', { class: 't39e-cloth-fold', d: stroke([[-20, 14], [-6, 4], [2, -2]], 1.6, 0.2, 0.4, 0.2) + stroke([[20, -14], [8, -4], [2, -2]], 1.6, 0.2, 0.4, 0.2) + stroke([[18, 16], [6, 4]], 1.2, 0.2, 0.4, 0.2) }),
    s('path', { class: 't39e-cloth-dots', d: [[-14, -12], [-2, -16], [10, -14], [-16, 2], [14, 4], [-8, 14], [6, 14], [16, -4]].map(([x, y]) => blob(x, y, 1.6, 1.6, x * 7 + y, 0.2, 8)).join('') }),
    s('path', { class: 't39e-cloth-knot', d: blob(2, -2, 7, 6, 3995, 0.2, 10) + stroke([[2, -2], [-6, -12], [-12, -16]], 6, 0.1, 0.6, 0.3) + stroke([[2, -2], [12, -10], [17, -18]], 6, 0.1, 0.6, 0.3) }),
    s('path', { class: 't39e-cloth-hi', d: stroke([[-22, -8], [-18, -22], [-4, -24]], 1.4, 0.3, 0.3, 0.1) }))
}

/** The brush on its rest, ready: a bamboo handle, a wet black tip, a small river stone under it. */
function brushArt() {
  return s('svg', { class: 't39e-brush-art', viewBox: '0 0 120 54', 'aria-hidden': 'true' },
    s('ellipse', { cx: 62, cy: 46, rx: 54, ry: 6, class: 't39e-brush-sh' }),
    s('path', { class: 't39e-rest', d: blob(70, 40, 13, 7, 3996, 0.15, 12), fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
    s('path', { class: 't39e-handle', d: stroke([[8, 44], [60, 30], [100, 19]], 5.4, 0.02, 0.02, 0.9) }),
    s('path', { class: 't39e-node', d: stroke([[37, 34], [38, 39]], 1.6, 0.1, 0.1, 0.5) + stroke([[71, 25], [72, 31]], 1.6, 0.1, 0.1, 0.5) }),
    s('path', { class: 't39e-ferrule', d: stroke([[98, 20], [106, 17.8]], 6.4, 0.02, 0.02, 0.9) }),
    s('path', { class: 't39e-tip', d: `M105 15Q113 14 119 18Q113 21 106 21Z` }))
}
