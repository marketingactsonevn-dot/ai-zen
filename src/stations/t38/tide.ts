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
import { brush, canvas, col, dprOf, fillD, fit, glow, grainOver, inkHills, mistBank, mix, moonDisc, paintRock, palette, sky, type Pal, type RGB } from './ink2d'

const T = C.scenes.tide
const MS = T.tide.milestones
const N = MS.length // stops 0…N−1 milestones, N = the moon on the horizon (ahead, in the mist)
const f1 = (n: number) => n.toFixed(1)

/**
 * Where the shadow's tip lies at each stop, along a bamboo rule marked evenly in hours (u = hours / 4, so 16 h is u = 4;
 * audit 38-2: a linear rule, so the leap from 2 h to 16 h shows): METR's 1 h, 2 h 17, ≥ 16 h (its 8.5–55 h interval
 * is the penumbra), then the moon on the horizon: the shadow runs on past the broken end of the rule. `peg` = leaves a
 * tag on the stake. The results with no length (IMO gold) are not on the rule: the detail tells them.
 */
const U = (hours: number) => hours / 4
const STOPS = [
  { u: U(1), peg: true },
  { u: U(2.28), peg: true },
  { u: U(16), peg: true, lo: U(8.5), hi: U(55) },
  { u: 30 },
] as { u: number; peg?: boolean; lo?: number; hi?: number }[]
/** the stakes that pin the rule down and get their hours written once the shadow reaches them (T.hours, same order) */
const MARKS = [1, 2, 4, 8, 16].map(U)
const U_MAX = U(18.4) // the length the rule is laid out for
const U_SLAT = U(17.3) // where the rule breaks off: METR has run out of tasks long enough to measure
const OFF = 10000 // shadows are cast from shapes drawn this far off the canvas
/** u (doublings) at t (0 first milestone … 1 the horizon): piecewise linear between the stops */
const uAt = (t: number) => {
  const x = clamp(t, 0, 1) * N
  const i = Math.min(N - 1, Math.floor(x)), f = x - i
  return STOPS[i].u + (STOPS[i + 1].u - STOPS[i].u) * f
}

/**
 * The sand garden for a stage W × H (audit 38-2): the bamboo pole stands on the right third, about 60 % of the frame
 * tall; the moon goes down an arc behind it and to its right, toward the western horizon; the rule runs from the pole's
 * foot down to the left on a diagonal into the near sand, so the moon's shadow, falling away from it (toward us and to
 * the left, where the dawn is), lies along the rule and fills the width as the moon gets low.
 */
function rig(W: number, H: number) {
  const wide = W / H > 1.1
  const hz = H * (wide ? 0.34 : 0.35)
  const mr = clamp(Math.min(W, H) * 0.045, 14, 27)
  const F: Pt = wide ? [W * 0.665, H * 0.655] : [W * 0.68, H * 0.6]
  const Hp = wide ? H * 0.57 : H * 0.51
  const pw = wide ? clamp(H * 0.03, 12, 22) : clamp(W * 0.032, 10, 14)
  const ax = F[0] + pw * 1.6, rx = Math.max(30, W * (wide ? 0.95 : 0.965) - mr - ax)
  const ry = hz - H * (wide ? 0.065 : 0.07)
  const moonAt = (t: number): Pt => {
    const th = ((84 - 79 * clamp(t, 0, 1)) * Math.PI) / 180
    return [ax + rx * Math.cos(th), hz - ry * Math.sin(th)]
  }
  // the rule: tied at the pole's foot, laid down toward the near left; nearer hours look longer (perspective)
  const C0: Pt = [F[0] - pw * 0.3, F[1] + pw * 0.3]
  const E: Pt = wide ? [W * 0.05, H * 0.93] : [W * 0.06, H * 0.955]
  const Lr = Math.hypot(E[0] - C0[0], E[1] - C0[1])
  const D: Pt = [(E[0] - C0[0]) / Lr, (E[1] - C0[1]) / Lr]
  const c = wide ? 0.4 : 0
  const s = (u: number) => {
    const f = u / U_MAX
    return (Lr * f * (1 + c * f)) / (1 + c)
  }
  const tip = (u: number): Pt => [C0[0] + D[0] * s(u), C0[1] + D[1] * s(u)]
  const persp = (u: number) => 1 + 0.75 * clamp(u / U_MAX, 0, 1.3)
  /** the rule's centre line at x (for keeping words off it) */
  const ruleY = (x: number) => C0[1] + ((x - C0[0]) * D[1]) / D[0]
  return { W, H, wide, hz, moonAt, mr, F, Hp, pw, C0, D, tip, persp, ruleY }
}
type Rig = ReturnType<typeof rig>

/** The still painting: dawn low in the east (left), hills, three layers of mist, the raked sand catching the moon on its
 *  crests, a rock group with its rings, the bamboo rule pinned to the sand, a near rock and grass at the frame's edge. */
function paintBack(g: CanvasRenderingContext2D, p: Pal, R: Rig) {
  const { W, H, hz, F, wide } = R
  sky(g, p, W, H, hz, W * 0.04, 1.2)
  const dw: RGB = [p.dawn[0], p.dawn[1], p.dawn[2], 1]
  // dawn is not up yet: only a low raking band of light along the eastern horizon, under the far hills
  glow(g, W * 0.12, hz - H * 0.012, W * 0.42, H * 0.022, dw, p.dark ? 0.32 : 0.6, 0.5)
  inkHills(g, p, -W * 0.05, W * 1.05, hz + 2, H * 0.12, 3851, 0.92, wide ? 7 : 4)
  mistBank(g, p, W * 0.5, hz, W * 0.7, H * 0.06, 1)
  inkHills(g, p, W * 0.42, W * 1.08, hz + H * 0.015, H * 0.1, 3852, 0.62, 3, 1)
  mistBank(g, p, W * 0.75, hz + H * 0.02, W * 0.4, H * 0.04, 1.1)
  // the sand: fogged at the far edge, warmer and darker toward us
  const sandFar = p.dark ? mix(p.paper, p['rock-lo'], 0.4) : mix(p.paper, p['step-hi'], 0.55)
  const sandNear = p.dark ? mix(p['rock-lo'], p['step-mid'], 0.3) : mix(p['step-hi'], p['rock-mid'], 0.5)
  const sandAt = (y: number) => mix(sandFar, sandNear, clamp((y - hz) / (H - hz), 0, 1))
  const sg = g.createLinearGradient(0, hz, 0, H)
  sg.addColorStop(0, col(sandFar, 0))
  sg.addColorStop(0.12, col(sandFar))
  sg.addColorStop(1, col(sandNear))
  g.fillStyle = sg
  g.fillRect(0, hz - H * 0.01, W, H - hz + H * 0.01)
  glow(g, 0, hz + H * 0.06, W * 0.45, H * 0.16, dw, p.dark ? 0.1 : 0.22, 0.4)
  glow(g, W * 0.86, hz + H * 0.1, W * 0.3, H * 0.12, p.dark ? p.moon : p['step-hi'], p.dark ? 0.1 : 0.4, 0.5)
  // raked sand: the rake's tines leave grooves in sets of four, each groove a thin line in shade with a crest the low
  // moon catches from behind (brightest toward the moon on the right; the dawn's warmth on the far left crests)
  const passes = wide ? 15 : 12
  const r = rng(3853)
  g.save()
  g.beginPath()
  g.rect(0, hz + H * 0.012, W, H)
  g.clip()
  const shade = (a: number) => {
    const lg = g.createLinearGradient(0, 0, W, 0)
    lg.addColorStop(0, col(p.dark ? p.umbra : p.wash, a * 0.75))
    lg.addColorStop(1, col(p.dark ? p.umbra : p.wash, a))
    return lg
  }
  const lit = (a: number) => {
    const lg = g.createLinearGradient(0, 0, W, 0)
    lg.addColorStop(0, p.dark ? col(dw, 0.3 * a) : col(dw, 0.45 * a))
    lg.addColorStop(0.32, p.dark ? col(p.moon, 0.07 * a) : col(p['rake-hi'], 0.45 * a))
    lg.addColorStop(1, p.dark ? col(p.moon, 0.24 * a) : col(p['rake-hi'], 0.85 * a))
    return lg
  }
  for (let k = 0; k < passes; k++) {
    const t = Math.pow((k + 0.6) / passes, 1.7)
    const y0 = hz + H * 0.02 + (H - hz) * t
    const amp = 0.8 + t * 5, ph = r() * 6, fq = 0.35 + r() * 0.25
    const gap = 1.6 + t * 6.5
    const a = Math.min(1, t * 2.4 + 0.25)
    for (let j = 0; j < 4; j++) {
      const pts: Pt[] = Array.from({ length: 41 }, (_, i) => [(W * (i - 1)) / 38, y0 + j * gap + Math.sin(i * fq + ph) * amp + Math.sin(i * 1.9 + k) * amp * 0.12] as Pt)
      fillD(g, stroke(pts.map(([x, yy]) => [x, yy + 0.6 + t * 1.2] as Pt), 0.5 + t * 1.6, 0.05, 0.05, 0.5), shade((p.dark ? 0.5 : 0.16) * a))
      fillD(g, stroke(pts, 0.35 + t * 0.9, 0.05, 0.05, 0.5), lit(a))
    }
  }
  // rings raked round the pole's foot and round the rock group (they cut the straight rows)
  const rings = (cx: number, cy: number, r0: number, n: number, k0 = 0.24) => {
    const sand = sandAt(cy)
    for (let k = n; k >= 1; k--) {
      const rr = r0 * (1 + k * 0.55)
      g.beginPath()
      g.ellipse(cx, cy + 2, rr, rr * k0, 0, 0, Math.PI * 2)
      g.lineWidth = r0 * 0.42 + 3
      g.strokeStyle = col(sand)
      g.stroke()
      g.lineWidth = 2.2
      g.strokeStyle = col(p.dark ? p.umbra : p.wash, p.dark ? 0.4 : 0.14)
      g.stroke()
      g.beginPath()
      g.ellipse(cx, cy + 0.6, rr, rr * k0, 0, Math.PI + 0.25, Math.PI * 2 - 0.25)
      g.strokeStyle = p.dark ? col(p.moon, 0.18) : col(p['rake-hi'], 0.9)
      g.lineWidth = 1.3
      g.stroke()
    }
  }
  rings(F[0], F[1], R.pw * 2.2, 3)
  const rk: Pt = wide ? [W * 0.2, hz + H * 0.13] : [W * 0.2, hz + H * 0.1]
  const rs = wide ? H * 0.17 : W * 0.24
  rings(rk[0] + rs * 0.12, rk[1] - rs * 0.04, rs * 0.42, 2, 0.2)
  g.restore()
  // the rock group: one tall stone and a low one, moss on their crowns, shadows thrown toward us and the dawn
  paintRock(g, p, rk[0], rk[1], rs, rs * 0.5, 3855, { light: 1, moss: 0.9, cast: 0.9 })
  paintRock(g, p, rk[0] + rs * 0.62, rk[1] + rs * 0.06, rs * 0.5, rs * 0.2, 3856, { light: 1, moss: 0.6, cast: 0.8 })
  // the far edge of the sand dissolves into the mist; a thin veil drifts across the middle distance
  const fg = g.createLinearGradient(0, hz - H * 0.07, 0, hz + H * 0.13)
  const fc = p.dark ? mix(p.paper, p.mist, 0.3) : p.mist
  fg.addColorStop(0, col(fc, 0))
  fg.addColorStop(0.35, col(fc, p.dark ? 0.55 : 0.85))
  fg.addColorStop(0.5, col(fc, p.dark ? 0.5 : 0.8))
  fg.addColorStop(1, col(fc, 0))
  g.fillStyle = fg
  g.fillRect(0, hz - H * 0.07, W, H * 0.2)
  mistBank(g, p, W * 0.36, hz + H * 0.17, W * 0.42, H * 0.035, 0.9)
  slat(g, p, R)
  // the near edge: a big mossy rock cut by the frame (dark, soft), grass at its foot and at the left
  paintRock(g, p, W * (wide ? 0.95 : 1.0), H * 1.06, wide ? H * 0.42 : W * 0.46, wide ? H * 0.28 : W * 0.3, 3857, { light: 1, moss: 0.35, dark: 0.55 })
  const grass = (x: number, y: number, n: number, hh: number, seed: number) => {
    const q = rng(seed)
    for (let i = 0; i < n; i++) {
      const bx = x + (q() - 0.5) * hh * 1.4, lean = (q() - 0.6) * hh * 0.6
      brush(g, [[bx, y], [bx + lean * 0.4, y - hh * (0.5 + q() * 0.3)], [bx + lean, y - hh * (0.8 + q() * 0.4)]], 1.4 + q() * 1.2, col(p.dark ? p.umbra : p.wash, p.dark ? 0.85 : 0.5), 0.1, 0.6, 0.1)
    }
  }
  grass(W * (wide ? 0.79 : 0.72), H * 0.99, 9, H * 0.07, 3858)
  grass(W * 0.02, H * 0.86, 6, H * 0.05, 3859)
  // the ground mist the shadow runs into once the moon is down, toward the dawn
  mistBank(g, p, W * 0.02, H * 0.97, W * (wide ? 0.2 : 0.4), H * 0.09, 1.3)
  grainOver(g, p, W, H)
}

/** The rule: a split-bamboo slat lying on the sand from the pole's foot, wider toward us, a notch cut at every hour,
 *  roped to a stake at 1, 2, 4, 8 and 16 h, broken off past 17 h; a cord loop ties it to the pole. */
function slat(g: CanvasRenderingContext2D, p: Pal, R: Rig) {
  const { tip, persp, D } = R
  const n: Pt = [-D[1], D[0]] // the slat's width direction (toward us)
  const cane = p.dark ? mix(p['step-mid'], p.lantern, 0.22) : mix(p['step-hi'], p.lantern, 0.32)
  const wAt = (u: number) => 2.4 * persp(u) + 1.2
  const us = Array.from({ length: 48 }, (_, i) => -0.08 + ((U_SLAT + 0.08) * i) / 47)
  const edge = (side: number, drop = 0) => us.map((u) => {
    const [x, y] = tip(u), w = wAt(u)
    return [x + n[0] * w * side, y + n[1] * w * side + drop * w] as Pt
  })
  const poly = (a: Pt[], b: Pt[]) => {
    const q = new Path2D()
    q.moveTo(...a[0])
    a.forEach((v) => q.lineTo(...v))
    for (let i = b.length - 1; i >= 0; i--) q.lineTo(...b[i])
    q.closePath()
    return q
  }
  // its shadow on the sand, its near side in shade, its top lit along the far edge
  g.fillStyle = col(p.umbra, p.dark ? 0.55 : 0.22)
  g.fill(poly(edge(-1, 0.6), edge(1, 1.4)))
  g.fillStyle = col(mix(cane, p.umbra, 0.55))
  g.fill(poly(edge(1), edge(1, 0.9)))
  const top = poly(edge(-1), edge(1))
  g.fillStyle = col(cane)
  g.fill(top)
  brush(g, edge(-0.85), 0.9, p.dark ? col(p.moon, 0.4) : col(p['rake-hi'], 1), 0.02, 0.02, 0.5)
  // bamboo nodes every few hours, a notch at every hour (deeper at the stakes)
  for (let hr = 1; hr <= 17; hr++) {
    const u = U(hr)
    const [x, y] = tip(u), w = wAt(u)
    const big = MARKS.includes(u)
    const a: Pt = [x - n[0] * w * 0.95, y - n[1] * w * 0.95], b: Pt = [x + n[0] * w * (big ? 1.05 : 0.5), y + n[1] * w * (big ? 1.05 : 0.5)]
    brush(g, [a, b], big ? 1.6 : 1, col(p.dark ? p.umbra : p.wash, p.dark ? 0.85 : 0.6), 0.05, 0.05, 0.5)
    brush(g, [[a[0] + D[0] * 1.2, a[1] + D[1] * 1.2], [b[0] + D[0] * 1.2, b[1] + D[1] * 1.2]], 0.7, p.dark ? col(p.moon, 0.3) : col(p['rake-hi'], 0.9), 0.05, 0.05, 0.5)
  }
  // the break: a few splinters past the last hour
  const q = rng(3854)
  const [ex, ey] = tip(U_SLAT), we = wAt(U_SLAT)
  for (let k = 0; k < 5; k++) {
    const o = (q() - 0.5) * 1.6 * we
    brush(g, [[ex + n[0] * o, ey + n[1] * o], [ex + D[0] * (6 + q() * 12) + n[0] * (o + (q() - 0.5) * 4), ey + D[1] * (6 + q() * 12) + n[1] * (o + (q() - 0.5) * 4)]], 0.9, col(cane, 0.9), 0.05, 0.6, 0.1)
  }
  // rope: a loop round the pole's foot, a lashing at each stake
  const rope = p.dark ? mix(p['step-lo'], p.lantern, 0.3) : mix(p['step-lo'], p.lantern, 0.35)
  const [fx, fy] = R.F
  brush(g, [[fx - R.pw * 0.8, fy + 1], [fx, fy + R.pw * 0.32], [fx + R.pw * 0.75, fy + 1]], 1.4, col(rope), 0.1, 0.1, 0.5)
  for (const u of MARKS) {
    const [x, y] = tip(u), w = wAt(u)
    for (const o of [-0.3, 0.25]) brush(g, [[x - n[0] * w * 1.6 + D[0] * o * w, y - n[1] * w * 1.6 + D[1] * o * w], [x + n[0] * w * 1.2 + D[0] * (o + 0.5) * w, y + n[1] * w * 1.2 + D[1] * (o + 0.5) * w]], 1.1, col(rope), 0.1, 0.1, 0.5)
  }
}

/** Scene 2 — the sand garden at moonset: drag the moon down its arc; the pole's shadow runs out along the rule. */
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
    // one block at a time (audit 38-2): the key to the picture with the first reading, then each stop's reading written
    // on the sand above its stake; gone when the insight comes
    const legend = h('p', { class: 't38m-legend' }, T.legend)
    const read = h('div', { class: 't38m-read' }, legend, eyebrow, factBox)
    // the hours written by the rule: each appears only when the shadow gets there (no answer waiting on the rule)
    const hrs = T.hours.map((t, n) => h('p', { class: 't38m-len', style: `--k:${n}`, 'aria-hidden': 'true' }, t))
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
      root.classList.toggle('is-moved', reached > 0)
      tag.textContent = i < N ? viDate(MS[i].date) : L.today
      if (i < N) {
        eyebrow.textContent = `${viDate(MS[i].date)} · ${MS[i].label}`
        factBox.replaceChildren(ctx.fact(MS[i].fact, 'p', 't38m-fact'))
      }
      if (!read.hasAttribute('aria-live') && i > 0) read.setAttribute('aria-live', 'polite')
      placeRead()
      if (i < N && !ctx.reduced) read.animate([{ opacity: 0.2, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: 'ease-out' })
      if (i === N && !told) {
        told = true
        grab.done()
        // the projection ahead joins the detail: on screen only the insight
        ctx.insight(T.insight, [T.tide.horizon, ...T.detail])
      }
    }
    /** the reading stands on the sand just above its stake, clear of the pole and of the rule (wide); on a phone it
     *  keeps to the sky left of the pole */
    function placeRead() {
      if (!R || !R.wide) return
      const i = Math.min(at, N - 1)
      const [sx, sy] = R.tip(STOPS[i].u)
      const w = Math.min(340, R.W * 0.26)
      read.style.width = `${f1(w)}px`
      const hh = read.offsetHeight // the one read per stop: this reading's height
      const rightSide = sx > R.W * 0.45
      const left = rightSide ? Math.min(sx + 24, R.F[0] - R.pw * 1.6 - 10) - w : Math.max(sx - 26, R.W * 0.03)
      const stakeTop = sy - R.H * 0.045 * R.persp(STOPS[i].u)
      const bottom = Math.min(stakeTop - 16, R.ruleY(left + w) - 30)
      Object.assign(read.style, { left: `${f1(left)}px`, top: `${f1(Math.max(R.hz + 8, bottom - hh))}px` })
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
    // H7: standing still 6 s, the moon slips a little way down its arc and back (the way to drag)
    let nudge = 0
    const onIdle = () => {
      if (told || dragging || ctx.reduced || low || !R) return
      const home = target
      target = clamp(home + 0.022, 0, 1)
      loop.start()
      clearTimeout(nudge)
      nudge = window.setTimeout(() => {
        if (dragging) return
        target = home
        loop.start()
      }, 520)
    }
    ctx.el.addEventListener('p2:idle', onIdle)
    ctx.onCleanup(() => (ctx.el.removeEventListener('p2:idle', onIdle), clearTimeout(nudge)))

    // the moving parts on one canvas, drawn only while the moon moves: shadows, the stakes, tags, pole, moon
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
        const w1 = pw * (1.15 + l / (R!.H * 0.5))
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
      // shadows lie on the sand only
      g.save()
      g.beginPath()
      g.rect(0, R.hz + R.H * 0.02, R.W, R.H)
      g.clip()
      // 03/2025 stays on the sand as a pale ghost once the moon has gone past 08/2025: the 16 × is two shadows side by side
      const ghost = clamp(shown * N - 1.2, 0, 1)
      if (ghost > 0) {
        shadow(tip(0), 0.7 * ghost, 1)
        // remembered, not cast: an ink edge round the old shadow, lying on the sand
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
      // the shadow now; past the rule's end (today) it runs on out of the frame into the ground mist
      const to = tip(Math.min(u, 40))
      const [ux, uy, len] = shadow(to, 1, u > U_SLAT + 0.2 ? 0 : 0.6)
      // at 03/2026 its tip blurs into the 8.5–55 h interval (the penumbra)
      const s3 = STOPS[2]
      const near3 = clamp(1 - Math.abs(shown * N - 2) * 1.6, 0, 1)
      if (near3 > 0) {
        const a = tip(s3.lo!), b = tip(Math.min(s3.hi!, U_MAX + 1.6))
        const m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
        g.save()
        g.translate(m[0], m[1])
        g.rotate(Math.atan2(b[1] - a[1], b[0] - a[0]))
        glow(g, 0, 0, Math.hypot(b[0] - a[0], b[1] - a[1]) / 2, pw * 2.4, ink, 0.32 * k * near3, 0.5)
        g.restore()
      }
      g.restore()
      // the stakes at 1, 2, 4, 8, 16 h, driven in beside the rule, each throwing its own small shadow the same way as the
      // pole's; the shadow reaching one writes its hours beside it
      const sl = len / Hp // shadow length per unit of height
      let on = 0
      const n: Pt = [-R.D[1], R.D[0]]
      for (let m = 0; m < MARKS.length; m++) {
        if (u >= MARKS[m] - 0.02) on = m + 1
        const q = persp(MARKS[m])
        const [x0, y0] = tip(MARKS[m])
        const x = x0 - n[0] * (2.4 * q + 4), y = y0 - n[1] * (2.4 * q + 4)
        const hs = R.H * 0.045 * q, ws = Math.max(3.5, pw * 0.42 * q)
        const sx = ux * Math.min(hs * sl, 80 * q), sy = uy * Math.min(hs * sl, 80 * q)
        g.strokeStyle = col(ink, 0.32 * k)
        g.lineWidth = ws * 1.1
        g.lineCap = 'round'
        g.beginPath()
        g.moveTo(x, y)
        g.lineTo(x + sx, y + sy)
        g.stroke()
        stake(g, p, x, y, ws, hs, m === 4 && reached >= 2 ? 1 : 0)
      }
      if (on > marked) {
        for (let m = marked; m < on; m++) hrs[m].classList.add('on')
        marked = on
      }
      way.set(shown)
      // paper tags tied on the stakes where a measured shadow touched
      STOPS.forEach((st, i) => {
        if (i > reached || i >= N || !st.peg) return
        const q = persp(st.u)
        const [x0, y0] = tip(st.u)
        const x = x0 - n[0] * (2.4 * q + 4), y = y0 - n[1] * (2.4 * q + 4)
        const hs = R!.H * 0.045 * q
        g.fillStyle = col(i === 2 ? p.vermilion : p.card, 0.95)
        g.beginPath()
        g.moveTo(x + 1, y - hs * 0.92)
        g.lineTo(x + 1 + 9 * q, y - hs * 0.84)
        g.lineTo(x + 1 + 8 * q, y - hs * 0.55)
        g.lineTo(x + 1, y - hs * 0.62)
        g.closePath()
        g.fill()
      })
      // the pole: a bamboo gnomon, lit on the moon's side, knots, a lashing at the top
      pole(g, p, F[0], F[1], Hp, pw)
      // the moon: the thing you drag; its lower edge goes behind the far hills as it sets
      const [mx, my] = R.moonAt(shown)
      glow(g, mx, my, R.mr * 5, R.mr * 5, p.moon, (p.dark ? 0.36 : 0.55) * (dragging ? 1.5 : 1.2), 0.25)
      g.save()
      g.beginPath()
      g.rect(0, 0, R.W, R.hz + R.H * 0.004)
      g.clip()
      moonDisc(g, p, mx, my, R.mr, 3854, 0)
      g.restore()
      Object.assign(moon.style, { left: `${f1(mx)}px`, top: `${f1(my)}px`, width: `${f1(R.mr * 3)}px`, height: `${f1(R.mr * 3)}px` })
      // the date under the disc while the moon is high (clear of the top of the frame), over it near the horizon
      const under = my < R.hz - R.H * 0.12
      Object.assign(tag.style, { left: `${f1(mx)}px`, top: `${f1(under ? my + R.mr * 1.45 : my - R.mr * 1.35)}px` })
      tag.classList.toggle('under', under)
    }

    function layout() {
      const W = root.clientWidth
      const H = Math.max(260, stable(ctx.art.clientHeight))
      if (W < 60) return
      root.style.height = `${f1(H)}px`
      R = rig(W, H)
      root.classList.toggle('wide', R.wide)
      samples = Array.from({ length: 121 }, (_, k) => R!.moonAt(k / 120))
      hrs.forEach((el, m) => {
        const [x, y] = R!.tip(MARKS[m])
        // 1 h and 2 h lie close together by the pole: their words lean apart (wide: under the rule; a phone's steep
        // rule: either side of it in turn, clear of the stakes)
        if (R!.wide) Object.assign(el.style, { left: `${f1(x)}px`, top: `${f1(y + 4 * R!.persp(MARKS[m]) + 6)}px`, transform: `translateX(${m === 0 ? -12 : m === 1 ? -88 : -50}%)` })
        else {
          const right = m !== 1 && m !== 3
          Object.assign(el.style, { left: `${f1(x + (right ? (m === 4 ? 30 : 16) : -10))}px`, top: `${f1(y - 9)}px`, transform: `translateX(${right ? 0 : -100}%)` })
        }
      })
      paint()
      placeRead()
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

/** The bamboo pole: a tall cane on the sand, three tones across it (the moon is behind it on the right), knots with a
 *  lit lip, a rope lashing and a cut top; its contact shadow on the raked rings. */
function pole(g: CanvasRenderingContext2D, p: Pal, x: number, y: number, Hp: number, w: number) {
  glow(g, x - w * 0.6, y + 2, w * 2.8, w * 0.75, p.umbra, p.dark ? 0.85 : 0.5, 0.5)
  const cane = p.dark ? mix(p['moss-b'], p['step-lo'], 0.35) : mix(p['moss-b'], p.wash, 0.25)
  const lg = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0)
  lg.addColorStop(0, col(mix(cane, p.umbra, 0.55)))
  lg.addColorStop(0.45, col(cane))
  lg.addColorStop(0.8, col(mix(cane, p.dark ? p.moon : p['rake-hi'], p.dark ? 0.35 : 0.5)))
  lg.addColorStop(1, col(mix(cane, p.umbra, 0.15)))
  g.fillStyle = lg
  g.beginPath()
  g.moveTo(x - w / 2, y)
  g.lineTo(x - w * 0.42, y - Hp)
  g.lineTo(x + w * 0.42, y - Hp)
  g.lineTo(x + w / 2, y)
  g.closePath()
  g.fill()
  // the moon's rim down its right edge, a dry ink stroke down its shaded left
  brush(g, [[x + w * 0.44, y - 2], [x + w * 0.4, y - Hp * 0.5], [x + w * 0.36, y - Hp + 2]], Math.max(1, w * 0.1), p.dark ? col(p.moon, 0.55) : col(p['rake-hi'], 0.9), 0.05, 0.05, 0.5)
  brush(g, [[x - w * 0.44, y - 2], [x - w * 0.4, y - Hp * 0.6], [x - w * 0.36, y - Hp + 4]], Math.max(1, w * 0.12), col(p.dark ? p.umbra : p.wash, p.dark ? 0.6 : 0.35), 0.1, 0.4, 0.2)
  for (const t of [0.13, 0.31, 0.49, 0.67, 0.84]) {
    const yy = y - Hp * t
    const ww = w * (1 - t * 0.16)
    g.fillStyle = col(p.dark ? p.umbra : p.wash, p.dark ? 0.7 : 0.5)
    g.fillRect(x - ww / 2 - 0.6, yy, ww + 1.2, Math.max(1.4, w * 0.16))
    g.fillStyle = p.dark ? col(p.moon, 0.3) : col(p['rake-hi'], 0.85)
    g.fillRect(x - ww / 2 - 0.4, yy - Math.max(1, w * 0.12), ww + 0.8, Math.max(0.9, w * 0.12))
  }
  // the cut top and a lashing of rope with a loose end
  g.fillStyle = col(mix(cane, p.dark ? p.moon : p['rake-hi'], 0.5))
  g.beginPath()
  g.ellipse(x, y - Hp, w * 0.42, w * 0.16, 0, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = col(p.umbra, 0.6)
  g.beginPath()
  g.ellipse(x, y - Hp + 0.6, w * 0.26, w * 0.08, 0, 0, Math.PI * 2)
  g.fill()
  const rope = p.dark ? mix(p['step-mid'], p.lantern, 0.25) : mix(p['step-lo'], p.lantern, 0.3)
  for (let i = 0; i < 4; i++) fillD(g, stroke([[x - w * 0.56, y - Hp * 0.92 + i * w * 0.2], [x + w * 0.56, y - Hp * 0.92 + i * w * 0.2 - w * 0.1]], Math.max(1.4, w * 0.12), 0.1, 0.1, 0.6), col(rope))
  fillD(g, stroke([[x + w * 0.5, y - Hp * 0.92 + w * 0.5], [x + w * 1.4, y - Hp * 0.86 + w], [x + w * 1.1, y - Hp * 0.82 + w * 1.6]], 1.2, 0.1, 0.4, 0.3), col(rope, 0.9))
}
