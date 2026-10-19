import './tide.css'
import { fill, h, viDate } from '../../core/dom'
import { L } from '../../core/content'
import { createLoop } from '../../core/loop'
import { onPrefs } from '../../core/prefs'
import { sliced } from '../../core/chunk'
import { clamp, onSize, rng, stableHeight, stroke, type Pt } from '../../ui/part2/ink'
import { guide } from '../../ui/part2/guide'
import type { SceneDef } from '../types'
import { C } from './shell'
import { brush, canvas, col, dprOf, fillD, fit, glow, grainOver, inkHills, mistBank, mix, moonDisc, palette, sky, type Pal, type RGB } from './ink2d'

const T = C.scenes.tide
const MS = T.tide.milestones
const N = MS.length // stops 0…N−1 milestones, N = the moon on the horizon (ahead, in the mist)
const f1 = (n: number) => n.toFixed(1)

/**
 * Where the shadow's tip lies at each stop, along a cord marked evenly in hours (u = hours / 4, so 16 h is u = 4; audit
 * 38-2: a linear cord, so the leap from 2 h to 16 h shows): METR's 1 h, 2 h 17, ≥ 16 h (its 8.5–55 h interval is the
 * penumbra), then the moon on the horizon: the shadow runs off into the dawn. `peg` = leaves a tag on the cord. The two
 * results with no length (IMO gold, Navier–Stokes) are not on the cord: the detail tells the first.
 */
const U = (hours: number) => hours / 4
const STOPS = [
  { u: U(1), peg: true },
  { u: U(2.28), peg: true },
  { u: U(16), peg: true, lo: U(8.5), hi: U(55) },
  { u: 30 },
] as { u: number; peg?: boolean; lo?: number; hi?: number }[]
/** the notches that get their hours written once the shadow reaches them (T.hours, same order) */
const MARKS = [1, 2, 4, 8, 16].map(U)
const U_MAX = U(18.4) // where the cord frays and breaks
const OFF = 10000 // shadows are cast from shapes drawn this far off the canvas
/** u (doublings) at t (0 first milestone … 1 the horizon): piecewise linear between the stops */
const uAt = (t: number) => {
  const x = clamp(t, 0, 1) * N
  const i = Math.min(N - 1, Math.floor(x)), f = x - i
  return STOPS[i].u + (STOPS[i + 1].u - STOPS[i].u) * f
}

/**
 * The sand garden for a stage W × H, seen from a little above: the horizon, the moon's arc from high over the middle
 * down to the western horizon (right), the bamboo pole near right, and the knotted cord on the sand. Wide: the cord
 * runs left along the sand; tall: it runs diagonally from near bottom right up to the dawn mist top left. The shadow
 * always goes from the pole's foot to a point on the cord, so the notches are where shadows end, one per doubling.
 */
function rig(W: number, H: number) {
  const wide = W / H > 1.1
  const hz = H * (wide ? 0.42 : 0.47)
  const mr = clamp(Math.min(W, H) * 0.045, 14, 27)
  const F: Pt = [W * (wide ? 0.8 : 0.8), H * (wide ? 0.79 : 0.79)]
  const Hp = H * (wide ? 0.47 : 0.38)
  const pw = clamp(H * 0.023, 8, 15)
  // the moon's arc stays on the far side of the pole, to its right, all the way down (audit 38-2: the shadow falls left,
  // so the moon is never left of the pole): from high over it down to the western horizon
  const ax = F[0] + pw, rx = Math.max(24, W * 0.975 - mr - ax)
  const ry = hz - H * (wide ? 0.1 : 0.3)
  const moonAt = (t: number): Pt => {
    const th = ((84 - 78 * clamp(t, 0, 1)) * Math.PI) / 180
    return [ax + rx * Math.cos(th), hz - ry * Math.sin(th)]
  }
  const C0: Pt = [W * (wide ? 0.755 : 0.71), H * (wide ? 0.885 : 0.9)]
  let D: Pt = wide ? [-1, -0.13] : [-0.74, -0.67]
  const dl = Math.hypot(D[0], D[1])
  D = [D[0] / dl, D[1] / dl]
  const Lmax = Math.min((C0[1] - (hz + H * 0.05)) / -D[1], (C0[0] - W * 0.04) / -D[0])
  const c = 0.09
  const S = (Lmax * 0.86) / (U_MAX / (1 + c * U_MAX)) // the cord ends a little short of the mist
  const s = (u: number) => (S * u) / (1 + c * Math.max(u, -0.5))
  const tip = (u: number): Pt => [C0[0] + D[0] * s(u), C0[1] + D[1] * s(u)]
  const persp = (u: number) => 1 / (1 + c * Math.max(0, u) * 1.4)
  return { W, H, wide, hz, moonAt, mr, F, Hp, pw, C0, D, tip, persp }
}
type Rig = ReturnType<typeof rig>

/** The still painting: dawn on the left (east), hills, the far edge of the sand in mist, raked furrows converging on the
 *  distance, rings round the pole's foot, the knotted cord, the moon's faint road with a tick at every stop. */
function paintBack(g: CanvasRenderingContext2D, p: Pal, R: Rig) {
  const { W, H, hz, F, tip, persp, wide } = R
  sky(g, p, W, H, hz, W * 0.05, 1.25)
  inkHills(g, p, -W * 0.05, W * 1.05, hz + 2, H * 0.12, 3851, 0.92, wide ? 7 : 4)
  mistBank(g, p, W * 0.5, hz, W * 0.7, H * 0.06, 1)
  inkHills(g, p, W * 0.45, W * 1.08, hz + H * 0.015, H * 0.1, 3852, 0.62, 3, 1)
  mistBank(g, p, W * 0.75, hz + H * 0.02, W * 0.4, H * 0.04, 1.1)
  // the sand: pale and fogged at the far edge, warmer and darker toward us
  const sandFar = p.dark ? mix(p.paper, p['rock-lo'], 0.4) : mix(p.paper, p['step-hi'], 0.55)
  const sandNear = p.dark ? mix(p['rock-lo'], p['step-mid'], 0.3) : mix(p['step-hi'], p['rock-mid'], 0.5)
  const sg = g.createLinearGradient(0, hz, 0, H)
  sg.addColorStop(0, col(sandFar, 0))
  sg.addColorStop(0.16, col(sandFar))
  sg.addColorStop(1, col(sandNear))
  g.fillStyle = sg
  g.fillRect(0, hz - H * 0.01, W, H - hz + H * 0.01)
  // dawn breathing on the sand at the left, the moon's sheen on the right
  const dw: RGB = [p.dawn[0], p.dawn[1], p.dawn[2], 1]
  glow(g, 0, hz + H * 0.08, W * 0.5, H * 0.25, dw, p.dark ? 0.14 : 0.3, 0.4)
  glow(g, W * 0.82, hz + H * 0.12, W * 0.3, H * 0.12, p.dark ? p.moon : p['step-hi'], p.dark ? 0.1 : 0.4, 0.5)
  // raked furrows converging on a point beyond the horizon: dark furrow + lit ridge, fading into the far mist
  const vp: Pt = [W * (wide ? 0.42 : 0.3), hz - H * 0.3]
  const y0 = hz + H * 0.012
  const furrow = new Path2D(), ridge = new Path2D()
  for (let i = 0; i <= 64; i++) {
    const bx = -W * 1.2 + (W * 3.4 * i) / 64
    const at = (y: number): Pt => [vp[0] + ((bx - vp[0]) * (y - vp[1])) / (H - vp[1]), y]
    const a = at(y0), b = at(H + 2)
    const w = 1.1 + ((Math.abs(b[0] - a[0]) + (H - y0)) / (W + H)) * 1.2
    furrow.addPath(new Path2D(stroke([a, b], w, 0.05, 0.05, 0.3)))
    ridge.addPath(new Path2D(stroke([[a[0] + 1, a[1]], [b[0] + 3.2, b[1]]], w * 0.7, 0.05, 0.05, 0.3)))
  }
  const fade = (c: RGB, a: number) => {
    const lg = g.createLinearGradient(0, hz, 0, H)
    lg.addColorStop(0, col(c, 0))
    lg.addColorStop(0.25, col(c, a * 0.5))
    lg.addColorStop(1, col(c, a))
    return lg
  }
  g.save()
  g.beginPath()
  g.rect(0, y0, W, H)
  g.clip()
  g.fillStyle = fade(p.dark ? p.umbra : p.wash, p.dark ? 0.6 : 0.26)
  g.fill(furrow)
  g.fillStyle = fade(p.dark ? p.moon : p['rake-hi'], p.dark ? 0.07 : 0.95)
  g.fill(ridge)
  // rings raked round the pole's foot (they cut the straight furrows)
  const sandAt = mix(sandFar, sandNear, (F[1] - hz) / (H - hz))
  for (let k = 3; k >= 1; k--) {
    g.beginPath()
    g.ellipse(F[0], F[1] + 2, W * 0.03 * k + 10, (W * 0.03 * k + 10) * 0.24, 0, 0, Math.PI * 2)
    g.lineWidth = W * 0.012 + 3
    g.strokeStyle = col(sandAt)
    g.stroke()
    g.lineWidth = 2.6
    g.strokeStyle = col(p.dark ? p.umbra : p.wash, p.dark ? 0.28 : 0.1)
    g.stroke()
    g.beginPath()
    g.ellipse(F[0], F[1] + 3.6, W * 0.03 * k + 10, (W * 0.03 * k + 10) * 0.24, 0, 0.2, Math.PI - 0.2)
    g.strokeStyle = p.dark ? col(p.moon, 0.06) : col(p['rake-hi'], 0.8)
    g.lineWidth = 1.6
    g.stroke()
  }
  g.restore()
  // the far edge of the sand dissolves into the mist; the dawn mist deepest on the left where the cord goes
  const fg = g.createLinearGradient(0, hz - H * 0.07, 0, hz + H * 0.13)
  const fc = p.dark ? mix(p.paper, p.mist, 0.3) : p.mist
  fg.addColorStop(0, col(fc, 0))
  fg.addColorStop(0.35, col(fc, p.dark ? 0.55 : 0.85))
  fg.addColorStop(0.5, col(fc, p.dark ? 0.5 : 0.8))
  fg.addColorStop(1, col(fc, 0))
  g.fillStyle = fg
  g.fillRect(0, hz - H * 0.07, W, H * 0.2)
  const end = tip(U_MAX + 1.5)
  mistBank(g, p, end[0], end[1], W * (wide ? 0.22 : 0.4), H * 0.12, 1.6)
  // the cord: a twisted rope along the sand, a knot at each doubling, frayed past 16 h
  const rope = p.dark ? mix(p['step-mid'], p.lantern, 0.25) : mix(p['step-lo'], p.lantern, 0.3)
  const cordPts: Pt[] = Array.from({ length: 30 }, (_, i) => tip(-0.15 + ((U_MAX + 0.15) * i) / 29))
  fillD(g, stroke(cordPts.map(([x, y]) => [x + 1, y + 2] as Pt), 2.6, 0.02, 0.05, 0.5), col(p.umbra, p.dark ? 0.5 : 0.18))
  fillD(g, stroke(cordPts, 3, 0.02, 0.05, 0.6), col(rope))
  let twist = ''
  for (let i = 0; i < 90; i++) {
    const u = -0.1 + ((U_MAX + 0.1) * i) / 89
    const [x, y] = tip(u)
    const k = persp(u) * 1.6
    twist += `M${f1(x - k)} ${f1(y - k)}l${f1(k * 1.4)} ${f1(k * 1.5)}`
  }
  g.strokeStyle = col(p.dark ? p.umbra : p.wash, p.dark ? 0.5 : 0.35)
  g.lineWidth = 0.7
  g.stroke(new Path2D(twist))
  const r = rng(3853)
  let fray = ''
  for (let k = 0; k < 9; k++) {
    const [x, y] = tip(U_MAX + r() * 0.12)
    fray += `M${f1(x)} ${f1(y)}l${f1(-4 - r() * 7)} ${f1((r() - 0.5) * 5)}`
  }
  g.strokeStyle = col(rope, 0.9)
  g.lineWidth = 0.9
  g.stroke(new Path2D(fray))
  // an ink tick at every hour on the cord (the written notches get a stake)
  for (let hr = 1; hr <= 16; hr++) {
    const u = U(hr)
    if (MARKS.includes(u)) continue
    const [x, y] = tip(u)
    brush(g, [[x - 1, y - 4 * persp(u)], [x + 1, y + 4 * persp(u)]], 1.1, col(p.dark ? p.umbra : p.wash, 0.5), 0.1, 0.1, 0.4)
  }
  // the moon's road: faint dots along its arc, and a small ink tick at every stop
  let road = ''
  for (let k = 0; k <= 60; k++) {
    const [mx, my] = R.moonAt(k / 60)
    road += `M${f1(mx)} ${f1(my)}h0.1`
  }
  g.strokeStyle = col(p.dark ? p.moon : p.wash, p.dark ? 0.22 : 0.2)
  g.lineWidth = 2
  g.lineCap = 'round'
  g.stroke(new Path2D(road))
  for (let i = 0; i <= N; i++) {
    const a = R.moonAt(i / N), b = R.moonAt(i / N + 0.004)
    const tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1
    const nx = ty / tl, ny = -tx / tl // outward from the arc
    const l = i === N ? 11 : 8
    brush(g, [[a[0] + nx * 4, a[1] + ny * 4], [a[0] + nx * (4 + l), a[1] + ny * (4 + l)]], 1.8, col(p.dark ? p.moon : p.wash, p.dark ? 0.5 : 0.55), 0.1, 0.3, 0.3)
  }
  grainOver(g, p, W, H)
}

/** Scene 2 — the sand garden at moonset: drag the moon down its arc; the pole's shadow runs out along the cord. */
export const tideScene: SceneDef = {
  label: T.label,
  mount(ctx) {
    const stable = stableHeight(ctx, [T.insight])
    const low = ctx.quality === 'low'
    const back = canvas('t38m-cv')
    const live = canvas('t38m-cv')
    const valueText = (i: number) => (i < N ? fill(T.valueText, { date: viDate(MS[i].date), label: MS[i].label }) : L.horizon)
    const moon = h('div', {
      class: 't38m-moon', role: 'slider', tabindex: '0', 'aria-label': T.slider,
      'aria-valuemin': '0', 'aria-valuemax': String(N), 'aria-valuenow': '0', 'aria-valuetext': valueText(0),
    })
    const tag = h('p', { class: 't38m-tag', 'aria-hidden': 'true' })
    const eyebrow = h('p', { class: 'p2-eyebrow t38m-eyebrow' })
    const factBox = h('div')
    // the key to the picture first (audit 38-2: the shadow is the length of work), then the stop's reading
    const read = h('div', { class: 't38m-read' }, h('p', { class: 't38m-legend' }, T.legend), eyebrow, factBox)
    // the hours written on the cord: each appears only when the shadow gets there (no answer waiting on the cord)
    const hrs = T.hours.map((t) => h('p', { class: 't38m-len', 'aria-hidden': 'true' }, t))
    const root = h('div', { class: 't38m' }, h('p', { class: 'visually-hidden' }, T.art), back, live, ...hrs, tag, read, moon)
    ctx.art.append(root)
    ctx.prompt(T.prompt)
    // H1 on the moon (it leans down when idle), H2 + H4: the arc as a groove with one numbered tick per stop
    const g = guide(ctx)
    const grab = g.dot(moon, { dir: [0.2, 1] })
    const way = g.track(() => (samples.length ? samples.filter((_, k) => k % 6 === 0) : [[0, 0], [1, 0]]), { ticks: N + 1, labels: STOPS.map((_, i) => String(i + 1)) })
    let marked = 0

    let R: Rig | null = null
    let p: Pal = palette()
    let dpr = dprOf(low)
    let samples: Pt[] = []
    let shown = 0, target = 0, tt = 0
    let at = -1, reached = 0
    let told = false
    let dragging = false

    function show(i: number) {
      if (i === at) return
      at = i
      moon.setAttribute('aria-valuenow', String(i))
      moon.setAttribute('aria-valuetext', valueText(i))
      if (i > reached && i === 2 && i < N) ctx.prompt(T.next) // past the third mark: on to the horizon
      reached = Math.max(reached, i)
      root.classList.toggle('is-cmp', reached >= 2)
      root.classList.toggle('is-end', i === N)
      tag.textContent = i < N ? viDate(MS[i].date) : L.today
      if (i < N) {
        eyebrow.textContent = MS[i].label
        factBox.replaceChildren(ctx.fact(MS[i].fact, 'p', 't38m-fact'))
      } else {
        eyebrow.textContent = L.horizon
        factBox.replaceChildren(ctx.fact(T.tide.horizon, 'p', 't38m-fact mist'))
      }
      if (!read.hasAttribute('aria-live') && i > 0) read.setAttribute('aria-live', 'polite')
      if (!ctx.reduced) read.animate([{ opacity: 0.2, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: 'ease-out' })
      if (i === N && !told) {
        told = true
        grab.done()
        ctx.insight(T.insight, T.detail)
      }
    }
    function moveTo(t: number, snap: boolean) {
      tt = clamp(t, 0, 1)
      const near = Math.round(tt * N)
      if (snap || low) tt = near / N
      target = tt
      show(near)
      if (ctx.reduced || low) shown = target
      loop.wake()
      if (!ctx.reduced && !low) loop.start()
    }
    const tAt = (x: number, y: number) => {
      let best = 0, bd = Infinity
      samples.forEach(([sx, sy], k) => {
        const d = (sx - x) ** 2 + (sy - y) ** 2
        if (d < bd) (bd = d), (best = k)
      })
      return best / (samples.length - 1)
    }

    // drag the moon (or anywhere in the sky): it follows its arc, and settles on the nearest stop when let go
    let rx0 = 0, ry0 = 0
    root.addEventListener('pointerdown', (e) => {
      if (e.button || !R || (e.target as Element).closest('.t38m-read, .t38m-len')) return
      const rr = root.getBoundingClientRect()
      rx0 = rr.left
      ry0 = rr.top
      const x = e.clientX - rx0, y = e.clientY - ry0
      const [mx, my] = R.moonAt(shown)
      if (y > R.hz + 20 && Math.hypot(x - mx, y - my) > R.mr * 2.6) return
      dragging = true
      root.classList.add('drag')
      root.setPointerCapture(e.pointerId)
      moon.focus({ preventScroll: true })
      moveTo(tAt(x, y), false)
      ctx.chime('soft')
    })
    root.addEventListener('pointermove', (e) => dragging && moveTo(tAt(e.clientX - rx0, e.clientY - ry0), false))
    const end = () => {
      if (!dragging) return
      dragging = false
      root.classList.remove('drag')
      moveTo(tt, true)
    }
    root.addEventListener('pointerup', end)
    root.addEventListener('pointercancel', end)
    moon.addEventListener('keydown', (e) => {
      const k = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[e.key]
      const to = k ? clamp(at + k, 0, N) : e.key === 'Home' ? 0 : e.key === 'End' ? N : -1
      if (to < 0) return
      e.preventDefault()
      moveTo(to / N, true)
    })

    // the moving parts on one canvas, drawn only while the moon moves: shadows, the notch stakes, tags, stones, pole, moon
    const loop = createLoop(root, (_t, dt) => {
      if (dt > 0) shown += (target - shown) * (1 - Math.exp(-dt * 8))
      else shown = target
      draw()
      return Math.abs(target - shown) > 0.0005
    })
    ctx.onCleanup(() => loop.dispose())

    function draw() {
      if (!R) return
      const g = live.getContext('2d')!
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, R.W, R.H)
      const { F, Hp, pw, tip, persp } = R
      const u = uAt(shown)
      const ink: RGB = p.dark ? p.umbra : mix(p.wash, p.umbra, 0.3)
      const k = p.dark ? 1.3 : 0.85
      /** a soft, wide, dark shadow from the pole's foot to `to`, blurred (the canvas's own shadow blur, cast from a shape
       *  drawn off the canvas), its penumbra widening toward the tip */
      const shadow = (to: Pt, a: number, fadeTo = 0.6) => {
        const dx = to[0] - F[0], dy = to[1] - F[1], l = Math.hypot(dx, dy) || 1
        const nx = -dy / l, ny = dx / l
        const w1 = pw * (1.15 + l / (R!.H * 0.42))
        for (const [m, aa, blur] of [[2, 0.4, pw * 2.4], [1, 0.75, pw * 0.55]] as const) {
          const h0 = (pw * 0.9 * m) / 2, h1 = (w1 * m) / 2
          g.save()
          g.translate(-OFF, 0)
          g.shadowColor = col(ink, Math.min(1, a * aa * k))
          g.shadowBlur = blur * dpr
          g.shadowOffsetX = OFF * dpr
          const lg = g.createLinearGradient(F[0], F[1], to[0], to[1])
          lg.addColorStop(0, '#000')
          lg.addColorStop(1, `rgba(0,0,0,${fadeTo})`)
          g.fillStyle = lg
          g.beginPath()
          g.moveTo(F[0] + nx * h0, F[1] + ny * h0)
          g.lineTo(to[0] + nx * h1, to[1] + ny * h1)
          g.quadraticCurveTo(to[0] + (dx / l) * h1 * 1.2, to[1] + (dy / l) * h1 * 1.2, to[0] - nx * h1, to[1] - ny * h1)
          g.lineTo(F[0] - nx * h0, F[1] - ny * h0)
          g.closePath()
          g.fill()
          g.restore()
        }
        return [dx / l, dy / l, l] as const
      }
      // shadows lie on the sand only: past the far edge they are lost in the mist
      g.save()
      g.beginPath()
      g.rect(0, R.hz + R.H * 0.02, R.W, R.H)
      g.clip()
      // 03/2025 stays on the sand as a pale ghost once the moon has gone past 08/2025: the 16 × is two shadows side by side
      const ghost = clamp(shown * N - 1.2, 0, 1)
      if (ghost > 0) {
        shadow(tip(0), 0.7 * ghost, 1)
        // remembered, not cast: a dashed ink edge round the old shadow
        const to = tip(0), dx = to[0] - F[0], dy = to[1] - F[1], l = Math.hypot(dx, dy) || 1
        const nx = -dy / l, ny = dx / l, hw = pw * 0.75
        g.setLineDash([3, 4])
        g.strokeStyle = col(p.dark ? p.moon : p.wash, (p.dark ? 0.35 : 0.5) * ghost)
        g.lineWidth = 1
        g.beginPath()
        g.moveTo(F[0] + nx * hw, F[1] + ny * hw)
        g.lineTo(to[0] + nx * hw * 1.3, to[1] + ny * hw * 1.3)
        g.lineTo(to[0] - nx * hw * 1.3, to[1] - ny * hw * 1.3)
        g.lineTo(F[0] - nx * hw, F[1] - ny * hw)
        g.stroke()
        g.setLineDash([])
      }
      // the shadow now; past the cord's end (today) it runs on into the dawn mist
      const to = u > U_MAX + 0.2 ? tip(Math.min(u, 40)) : tip(u)
      const [ux, uy, len] = shadow(to, 1, u > U_MAX + 0.2 ? 0 : 0.6)
      // at 03/2026 its tip blurs into the 8.5–55 h interval (the penumbra)
      const s3 = STOPS[2]
      const near3 = clamp(1 - Math.abs(shown * N - 2) * 1.6, 0, 1)
      if (near3 > 0) {
        const a = tip(s3.lo!), b = tip(Math.min(s3.hi!, U_MAX + 1.3))
        const m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
        g.save()
        g.translate(m[0], m[1])
        g.rotate(Math.atan2(b[1] - a[1], b[0] - a[0]))
        glow(g, 0, 0, Math.hypot(b[0] - a[0], b[1] - a[1]) / 2, pw * 2.2, ink, 0.32 * k * near3, 0.5)
        g.restore()
      }
      g.restore()
      // the notch stakes at 1, 2, 4, 8, 16 h, each throwing its own small shadow the same way as the pole's; the shadow
      // reaching one writes its hours beside it
      const sl = len / Hp // shadow length per unit of height
      let on = 0
      for (let n = 0; n < MARKS.length; n++) {
        if (u >= MARKS[n] - 0.02) on = n + 1
        const [x, y] = tip(MARKS[n])
        const q = persp(MARKS[n])
        const hs = R.H * 0.06 * q, ws = Math.max(3, pw * 0.5 * q)
        const sx = ux * Math.min(hs * sl, 70 * q), sy = uy * Math.min(hs * sl, 70 * q)
        g.strokeStyle = col(ink, 0.32 * k)
        g.lineWidth = ws * 1.1
        g.lineCap = 'round'
        g.beginPath()
        g.moveTo(x, y)
        g.lineTo(x + sx, y + sy)
        g.stroke()
        stake(g, p, x, y, ws, hs, n === 4 && reached >= 2 ? 1 : 0)
      }
      if (on > marked) {
        for (let n = marked; n < on; n++) hrs[n].classList.add('on')
        marked = on
      }
      way.set(shown)
      // tags where a measured shadow touched the cord; stones risen beside the pole for results with no length
      STOPS.forEach((st, i) => {
        if (i > reached || i >= N) return
        if (st.peg) {
          const [x, y] = tip(st.u)
          const q = persp(st.u)
          const hs = R!.H * 0.06 * q
          g.fillStyle = col(i === 2 ? p.vermilion : p.card, 0.95)
          g.beginPath()
          g.moveTo(x + 1, y - hs * 0.92)
          g.lineTo(x + 1 + 9 * q, y - hs * 0.84)
          g.lineTo(x + 1 + 8 * q, y - hs * 0.55)
          g.lineTo(x + 1, y - hs * 0.62)
          g.closePath()
          g.fill()
        }
      })
      // the pole: a bamboo gnomon, lit on the moon's side, knots, a lashing at the top
      pole(g, p, F[0], F[1], Hp, pw)
      // the moon: the thing you drag
      const [mx, my] = R.moonAt(shown)
      moonDisc(g, p, mx, my, R.mr, 3854, dragging ? 1.6 : 1.25)
      Object.assign(moon.style, { left: `${f1(mx)}px`, top: `${f1(my)}px`, width: `${f1(R.mr * 3)}px`, height: `${f1(R.mr * 3)}px` })
      const right = mx > R.W * 0.6
      Object.assign(tag.style, { left: `${f1(mx + (right ? -R.mr * 1.4 : R.mr * 1.4))}px`, top: `${f1(my - R.mr * 1.3)}px` })
      tag.classList.toggle('l', right)
    }

    function layout() {
      const W = root.clientWidth
      const H = Math.max(260, stable(ctx.art.clientHeight))
      if (W < 60) return
      root.style.height = `${f1(H)}px`
      R = rig(W, H)
      root.classList.toggle('wide', R.wide)
      samples = Array.from({ length: 121 }, (_, k) => R!.moonAt(k / 120))
      hrs.forEach((el, n) => {
        const [x, y] = R!.tip(MARKS[n])
        Object.assign(el.style, { left: `${f1(x)}px`, top: `${f1(y + 7)}px` })
      })
      paint()
      g.refresh()
    }
    let job: { cancel(): void } | null = null
    let drawn = false
    function paint() {
      if (!R) return
      const run = () => {
        dpr = dprOf(low)
        paintBack(fit(back, R!.W, R!.H, dpr), p, R!)
        fit(live, R!.W, R!.H, dpr)
        drawn = true
        if (at < 0) show(0)
        draw()
      }
      job?.cancel()
      if (drawn) return run()
      job = sliced((function* () { yield; run() })(), { sync: ctx.reduced })
    }
    ctx.onCleanup(() => job?.cancel())
    ctx.onCleanup(onSize(ctx.art, layout))
    ctx.onCleanup(onPrefs(() => {
      const q = palette()
      if (q.key === p.key) return
      p = q
      paint()
    }))
  },
}

/** A small bamboo stake standing on (x, y): side in shade, lit toward the moon, a cut top. `tie` = a vermilion band. */
function stake(g: CanvasRenderingContext2D, p: Pal, x: number, y: number, w: number, hh: number, tie: number) {
  glow(g, x + 1, y + 0.5, w * 1.6, Math.max(1.2, w * 0.45), p.umbra, p.dark ? 0.8 : 0.45, 0.5)
  const lg = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0)
  const cane = p.dark ? mix(p['moss-b'], p['step-mid'], 0.4) : mix(p['moss-b'], p['step-hi'], 0.25)
  lg.addColorStop(0, col(mix(cane, p.umbra, 0.45)))
  lg.addColorStop(0.65, col(cane))
  lg.addColorStop(1, col(mix(cane, p.dark ? p.moon : p['rake-hi'], 0.45)))
  g.fillStyle = lg
  g.fillRect(x - w / 2, y - hh, w, hh)
  g.fillStyle = col(p.dark ? p.umbra : p.wash, 0.5)
  g.fillRect(x - w / 2, y - hh * 0.55, w, Math.max(0.8, w * 0.25))
  g.fillStyle = col(mix(cane, p.dark ? p.moon : p['rake-hi'], 0.6))
  g.beginPath()
  g.ellipse(x, y - hh, w / 2, w * 0.2, 0, 0, Math.PI * 2)
  g.fill()
  if (tie) {
    g.fillStyle = col(p.vermilion, 0.9)
    g.fillRect(x - w / 2 - 0.5, y - hh * 0.3, w + 1, Math.max(1.4, w * 0.35))
  }
}

/** The bamboo pole: a tall cane on the sand, three tones across it (the moon is on the right), knots, a rope lashing. */
function pole(g: CanvasRenderingContext2D, p: Pal, x: number, y: number, Hp: number, w: number) {
  glow(g, x + 2, y + 1, w * 2.6, w * 0.7, p.umbra, p.dark ? 0.85 : 0.5, 0.5)
  const cane = p.dark ? mix(p['moss-b'], p['step-lo'], 0.35) : mix(p['moss-b'], p.wash, 0.25)
  const lg = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0)
  lg.addColorStop(0, col(mix(cane, p.umbra, 0.5)))
  lg.addColorStop(0.5, col(cane))
  lg.addColorStop(0.82, col(mix(cane, p.dark ? p.moon : p['rake-hi'], p.dark ? 0.35 : 0.5)))
  lg.addColorStop(1, col(mix(cane, p.umbra, 0.2)))
  g.fillStyle = lg
  g.beginPath()
  g.moveTo(x - w / 2, y)
  g.lineTo(x - w * 0.42, y - Hp)
  g.lineTo(x + w * 0.42, y - Hp)
  g.lineTo(x + w / 2, y)
  g.closePath()
  g.fill()
  for (const t of [0.16, 0.37, 0.58, 0.79]) {
    const yy = y - Hp * t
    const ww = w * (1 - t * 0.16)
    g.fillStyle = col(p.dark ? p.umbra : p.wash, p.dark ? 0.7 : 0.5)
    g.fillRect(x - ww / 2 - 0.4, yy, ww + 0.8, Math.max(1.2, w * 0.18))
    g.fillStyle = p.dark ? col(p.moon, 0.25) : col(p['rake-hi'], 0.8)
    g.fillRect(x - ww / 2, yy - Math.max(1, w * 0.12), ww, Math.max(0.8, w * 0.12))
  }
  // the cut top and a lashing of rope
  g.fillStyle = col(mix(cane, p.dark ? p.moon : p['rake-hi'], 0.5))
  g.beginPath()
  g.ellipse(x, y - Hp, w * 0.42, w * 0.16, 0, 0, Math.PI * 2)
  g.fill()
  const rope = p.dark ? mix(p['step-mid'], p.lantern, 0.25) : mix(p['step-lo'], p.lantern, 0.3)
  for (let i = 0; i < 4; i++) fillD(g, stroke([[x - w * 0.55, y - Hp * 0.9 + i * 2.6], [x + w * 0.55, y - Hp * 0.9 + i * 2.6 - 1.4]], 1.6, 0.1, 0.1, 0.6), col(rope))
  fillD(g, stroke([[x + w * 0.5, y - Hp * 0.9 + 5], [x + w * 1.4, y - Hp * 0.84 + 12], [x + w * 1.1, y - Hp * 0.8 + 20]], 1.2, 0.1, 0.4, 0.3), col(rope, 0.9))
}
