import { h, nextId, s } from '../../core/dom'
import { ensoBrush } from '../../ui/brush'
import type { SceneCtx } from '../types'
import type { Copy } from './data'

/** Sumi-e toolkit for Trạm 18 (same brush model as Trạm 3): tapered strokes as filled outlines, washes, stones. */
export type Pt = [number, number]

const f1 = (n: number) => Math.round(n * 10) / 10
const P = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`

export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
export const poly = (pts: Pt[]) => `M${pts.map(P).join('L')}Z`
export const ell = (cx: number, cy: number, rx: number, ry = rx) =>
  `M${f1(cx - rx)} ${f1(cy)}a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(2 * rx)} 0a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(-2 * rx)} 0Z`

/** Points on an ellipse arc, angles in degrees (0 = right, 90 = down). */
export function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 24): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as Pt
  })
}

/** mulberry32 — the same seed draws the same picture every time. */
export function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Catmull-Rom through control points → dense polyline. */
function spline(pts: Pt[], straight = false, step = 4): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p0 = straight ? p1 : (pts[i - 1] ?? p1)
    const p3 = straight ? p2 : (pts[i + 2] ?? p2)
    const n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step))
    for (let j = 0; j < n; j++) {
      const t = j / n
      const t2 = t * t
      const t3 = t2 * t
      const c = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3)
      out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])])
    }
  }
  out.push(pts[pts.length - 1])
  return out
}

export interface LineOpt {
  /** share of the length used to press in */
  a?: number
  /** share of the length used to lift off */
  b?: number
  /** thinnest the tips get, as a share of w */
  min?: number
  /** pressure wobble */
  wob?: number
  straight?: boolean
  step?: number
}

/** Filled outline of a tapered brush stroke along pts (d) + its centreline (c). */
export function brush(pts: Pt[], w: number, o: LineOpt = {}) {
  const C = spline(pts, o.straight, o.step)
  const n = C.length
  const L = [0]
  for (let i = 1; i < n; i++) L.push(L[i - 1] + Math.hypot(C[i][0] - C[i - 1][0], C[i][1] - C[i - 1][1]))
  const len = L[n - 1] || 1
  const a = o.a ?? 0.14
  const b = o.b ?? 0.32
  const min = o.min ?? 0.16
  const wob = o.wob ?? 0.1
  const lft: Pt[] = []
  const rgt: Pt[] = []
  let hs = 0
  let he = 0
  for (let i = 0; i < n; i++) {
    const t = L[i] / len
    const k = Math.max(min, Math.sqrt(Math.min(1, a ? t / a : 1))) * Math.max(min, Math.min(1, b ? (1 - t) / b : 1) ** 0.7) * (1 + wob * Math.sin(t * 11 + w * 3))
    const hw = (w * k) / 2
    const A = C[Math.max(0, i - 1)]
    const B = C[Math.min(n - 1, i + 1)]
    const dl = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1
    const nx = -(B[1] - A[1]) / dl
    const ny = (B[0] - A[0]) / dl
    lft.push([C[i][0] + nx * hw, C[i][1] + ny * hw])
    rgt.push([C[i][0] - nx * hw, C[i][1] - ny * hw])
    if (i === 0) hs = hw
    he = hw
  }
  const d = `M${lft.map(P).join('L')}A${f1(he)} ${f1(he)} 0 0 0 ${P(rgt[n - 1])}L${rgt.reverse().map(P).join('L')}A${f1(hs)} ${f1(hs)} 0 0 0 ${P(lft[0])}Z`
  return { d, c: `M${C.map(P).join('L')}`, len }
}

/** A brushed path element (class picks the colour). */
export const stroke = (pts: Pt[], w: number, cls = 'k', o: LineOpt = {}, op?: number) =>
  s('path', { d: brush(pts, w, o).d, class: cls, 'fill-opacity': op })
export const wash = (d: string, op = 0.1, cls = 'k') => s('path', { d, class: cls, 'fill-opacity': op })

/** Ink-wash mountain silhouettes standing on `base` between x0 and x1. */
export function peaks(r: () => number, x0: number, x1: number, base: number, hMin: number, hMax: number, step: number) {
  const out: string[] = []
  for (let mx = x0; mx < x1; mx += step * (0.6 + r() * 0.8)) {
    const hgt = hMin + r() * (hMax - hMin)
    const hw = hgt * (1.1 + r() * 0.9)
    const pts: Pt[] = []
    for (let i = 0; i <= 16; i++) {
      const u = 1 - Math.abs((i / 16) * 2 - 1)
      pts.push([mx - hw + (i / 8) * hw, base - hgt * u ** (1.35 + r() * 0.2) + (i % 16 ? (r() - 0.5) * hgt * 0.06 : 0)])
    }
    out.push(poly(pts))
  }
  return out
}

/** A garden stone seen from the front-above: shadow, dark flank, lit top, rim highlight. Returns a <g>. */
export function stone(r: () => number, x: number, y: number, rx: number, ry: number, tall = 0.5, grad = 't18-stone') {
  const g = s('g')
  const th = ry * tall * 2
  const pts: Pt[] = []
  for (let a = 0; a <= 360; a += 15) {
    const t = (a * Math.PI) / 180
    const j = 1 + (r() - 0.5) * 0.14
    pts.push([x + rx * j * Math.cos(t), y + ry * j * Math.sin(t) - (Math.sin(t) < 0 ? th * 0.55 * -Math.sin(t) : 0)])
  }
  pts[pts.length - 1] = pts[0]
  const lower = pts.slice(0, 13)
  const drop = (a: number) => th * (0.5 + 0.5 * Math.sin(Math.PI * clamp((a - x + rx) / (2 * rx))))
  const under = lower.map(([a, b]) => [a, b + drop(a) * 0.5] as Pt)
  const flank = `M${lower.map(P).join('L')}L${under.slice().reverse().map(P).join('L')}Z`
  g.append(
    s('path', { class: 'sh', 'fill-opacity': 0.13, d: ell(x + rx * 0.16, y + ry * 0.62 + th * 0.25, rx * 1.2, ry * 0.72), filter: 'url(#ink-wash)' }),
    s('path', { class: 'st-f', d: flank }),
    s('path', { d: poly(pts), fill: `url(#${grad})` }),
    s('path', { class: 'sh', 'fill-opacity': 0.85, d: brush(under.slice(1), Math.max(1.4, rx * 0.07), { a: 0.12, b: 0.45 }).d }),
    s('path', { class: 'k', 'fill-opacity': 0.5, d: brush(pts.slice(14, 23), Math.max(1, rx * 0.035), { a: 0.25, b: 0.4 }).d }),
    s('path', { class: 'rim', d: brush(pts.slice(15, 21), Math.max(1, rx * 0.05), { a: 0.25, b: 0.4 }).d }),
  )
  return g
}

/** Shared gradient defs for stones (stop colours come from CSS classes so both themes work). */
export function stoneDefs(id = 't18-stone') {
  return s('linearGradient', { id, x1: 0, y1: 0, x2: 0.35, y2: 1 }, s('stop', { offset: 0, class: 'gs0' }), s('stop', { offset: 1, class: 'gs1' }))
}

/** Fit a vbW × vbH picture into W × H (contain), aligned by ax/ay (0 = start, 0.5 = centre, 1 = end). */
export function fit(W: number, H: number, vbW: number, vbH: number, ax = 0.5, ay = 0.5) {
  const k = Math.min(W / vbW, H / vbH)
  const w = vbW * k
  const hh = vbH * k
  return { k, w, h: hh, x: (W - w) * ax, y: (H - hh) * ay }
}

/** Absolutely place an element (px). */
export function place(el: HTMLElement | SVGElement, x: number, y: number, w?: number, hh?: number) {
  const st = (el as HTMLElement).style
  st.left = `${x}px`
  st.top = `${y}px`
  if (w != null) st.width = `${w}px`
  if (hh != null) st.height = `${hh}px`
}

/**
 * Keep `root` (absolute, inside ctx.art) the same height whether or not the insight is showing: the tallest insight
 * this scene can reveal is measured up front, and the root reserves that room, so the picture never jumps.
 */
export function stable(ctx: SceneCtx, copies: Copy[], root: HTMLElement) {
  const foot = ctx.el.querySelector<HTMLElement>('.scene-foot')
  let probeW = -1
  let need = 0
  const measure = () => {
    if (!foot || foot.clientWidth === probeW) return
    probeW = foot.clientWidth
    const box = h('div', { class: 'scene-insight', 'aria-hidden': 'true', style: 'position:absolute;left:0;right:0;bottom:0;visibility:hidden;pointer-events:none' })
    foot.append(box)
    let max = 0
    for (const c of copies) {
      box.replaceChildren(ctx.fact(c, 'p', 'insight-text'), h('button', { class: 'insight-more', type: 'button', tabindex: '-1' }, '…'))
      max = Math.max(max, box.offsetHeight)
    }
    box.remove()
    const cs = getComputedStyle(foot)
    need = Math.max(parseFloat(cs.minHeight) || 0, max + (parseFloat(cs.paddingBottom) || 0))
  }
  const apply = () => {
    measure()
    root.style.bottom = `${foot ? Math.max(0, need - foot.offsetHeight) : 0}px`
  }
  return { apply, reset: () => void (probeW = -1) }
}

/**
 * Run `fn` now, on every resize of the art, and once the fonts are in (line breaks change).
 * `lean`: skip the reruns that would redo the same layout — the observer's first report of the size `fn` just
 * used, and the fonts when none are loading (for scenes whose layout reads no transformed box, so a rerun can't differ).
 */
export function watch(ctx: SceneCtx, fn: () => void, lean = false) {
  const size = () => `${ctx.art.clientWidth}x${ctx.art.clientHeight}`
  let last = ''
  const run = () => {
    if (lean) last = size()
    fn()
  }
  const ro = new ResizeObserver(() => (!lean || last !== size()) && run())
  ro.observe(ctx.art)
  let alive = true
  if (!lean) document.fonts?.ready.then(() => alive && fn())
  ctx.onCleanup(() => {
    alive = false
    ro.disconnect()
  })
  run()
  if (lean && document.fonts?.status === 'loading') document.fonts.ready.then(() => alive && run())
}

/** Call fn when the light/dark theme flips (canvas scenes repaint their colours). */
export function onTheme(ctx: SceneCtx, fn: () => void) {
  let last = document.documentElement.dataset.theme
  const mo = new MutationObserver(() => {
    const now = document.documentElement.dataset.theme
    if (now !== last) {
      last = now
      fn()
    }
  })
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  ctx.onCleanup(() => mo.disconnect())
}

/** Defer work out of gsap's render loop (never revert / rebuild inside a tween callback). */
export const later = (fn: () => void) => void setTimeout(fn)

/** Convex hull (monotone chain), counter-clockwise. */
export function hull(pts: Pt[]): Pt[] {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lo: Pt[] = []
  const up: Pt[] = []
  for (const q of p) {
    while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop()
    lo.push(q)
  }
  for (const q of p.reverse()) {
    while (up.length > 1 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop()
    up.push(q)
  }
  return [...lo.slice(0, -1), ...up.slice(0, -1)]
}

/** n points evenly spaced along a closed polygon. */
export function resample(poly: Pt[], n: number): Pt[] {
  const L = [0]
  for (let i = 1; i <= poly.length; i++) {
    const a = poly[i - 1]
    const b = poly[i % poly.length]
    L.push(L[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]))
  }
  const tot = L[L.length - 1]
  const out: Pt[] = []
  let j = 0
  for (let i = 0; i < n; i++) {
    const d = (tot * i) / n
    while (L[j + 1] < d) j++
    const a = poly[j]
    const b = poly[(j + 1) % poly.length]
    const t = (d - L[j]) / (L[j + 1] - L[j] || 1)
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
  }
  return out
}

/**
 * A kasuga stone lantern in ink, standing at x on the ground line b, about 57·k tall.
 * `wash` wants the ink-wash filter, `ink` the rough one; `lamp` is the lit window (animate its opacity).
 */
export function lantern(x: number, b: number, k: number) {
  const W = s('g')
  const I = s('g')
  const X = (d: number) => x + d * k
  const Y = (d: number) => b - d * k
  W.append(
    wash(ell(X(7), Y(-1.5), 30 * k, 4.2 * k), 0.2),
    wash(poly([[X(-9), Y(39)], [X(9), Y(39)], [X(9.5), Y(26)], [X(-9.5), Y(26)]]), 0.3),
    wash(poly([[X(-3.4), Y(23)], [X(3.4), Y(23)], [X(3.8), Y(3)], [X(-3.8), Y(3)]]), 0.45),
  )
  const lamp = s('path', { class: 'v', 'fill-opacity': 0.55, d: poly([[X(-5.6), Y(37.5)], [X(5.6), Y(37.5)], [X(5.8), Y(28)], [X(-5.8), Y(28)]]) })
  // the roof: a heavy cap whose eaves flick up at the corners
  const roof = `M${X(-27)} ${Y(43.5)}C${X(-22)} ${Y(40)} ${X(-16)} ${Y(39.5)} ${X(0)} ${Y(40.5)}C${X(16)} ${Y(39.5)} ${X(22)} ${Y(40)} ${X(27)} ${Y(43.5)}C${X(17)} ${Y(44)} ${X(7)} ${Y(48)} ${X(0)} ${Y(53)}C${X(-7)} ${Y(48)} ${X(-17)} ${Y(44)} ${X(-27)} ${Y(43.5)}Z`
  I.append(
    stroke([[X(-14), Y(0)], [X(0), Y(0.4)], [X(14), Y(0)]], 3.6 * k, 'k', { a: 0.08, b: 0.2, min: 0.4 }),
    stroke([[X(-9), Y(3)], [X(9), Y(3)]], 2.4 * k, 'k', { straight: true, a: 0.1, b: 0.2, min: 0.5 }, 0.85),
    stroke([[X(-3.6), Y(4)], [X(-3.2), Y(23)]], 2.2 * k, 'k', { straight: true, a: 0.1, b: 0.2, min: 0.4 }),
    stroke([[X(3.8), Y(4)], [X(3.2), Y(23)]], 1.2 * k, 'k', { straight: true, a: 0.2, b: 0.3, min: 0.4 }, 0.7),
    stroke([[X(-13), Y(24.5)], [X(0), Y(25.4)], [X(13), Y(24.5)]], 3.2 * k, 'k', { a: 0.06, b: 0.15, min: 0.5 }),
    stroke([[X(-8.6), Y(39)], [X(-9), Y(26)]], 2 * k, 'k', { straight: true, a: 0.1, b: 0.2, min: 0.5 }),
    stroke([[X(8.6), Y(39)], [X(9), Y(26)]], 1.4 * k, 'k', { straight: true, a: 0.1, b: 0.3, min: 0.5 }, 0.8),
    s('path', { class: 'k', 'fill-opacity': 0.82, d: roof }),
    stroke([[X(-27), Y(43.5)], [X(-16), Y(39.6)], [X(0), Y(40.3)], [X(16), Y(39.6)], [X(27), Y(43.5)]], 2.2 * k, 'k', { a: 0.1, b: 0.1, min: 0.3 }),
    stroke([[X(0), Y(52.5)], [X(0.2), Y(55)]], 1.8 * k, 'k', { straight: true, a: 0.2, b: 0.2 }),
    s('path', { class: 'k', d: ell(X(0.2), Y(57), 2.4 * k, 2.8 * k) }),
  )
  return { wash: W, ink: I, lamp }
}

/** A hand-brushed ensō (from the app's brand brush) that can be drawn in along its spine. */
export function enso(cls: string, seed = 5) {
  const b = ensoBrush(seed)
  const id = nextId('t18enso')
  const reveal = s('path', { d: b.spine, fill: 'none', stroke: '#fff', 'stroke-width': 30, 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': '1.02 1', 'stroke-dashoffset': 0 })
  const svg = s('svg', { class: cls, viewBox: '0 0 200 200', 'aria-hidden': 'true' },
    s('defs', null, s('mask', { id, maskUnits: 'userSpaceOnUse', x: -20, y: -20, width: 240, height: 240 }, reveal)),
    s('g', { mask: `url(#${id})` },
      s('path', { d: b.body, class: 'enso-body' }),
      ...b.streaks.slice(0, 4).map((d) => s('path', { d, class: 'enso-hair', fill: 'none', 'stroke-width': 2.2, 'stroke-linecap': 'round' }))))
  return { svg, reveal }
}
