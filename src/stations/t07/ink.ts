import { h, nextId, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'

/** Sumi-e toolkit for Trạm 7 (same stroke model as Trạm 3, kept local so stations stay independent). */
export type Pt = [number, number]

const f1 = (n: number) => Math.round(n * 10) / 10
const P = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`

export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
export const poly = (pts: Pt[]) => `M${pts.map(P).join('L')}Z`
export const ell = (cx: number, cy: number, rx: number, ry = rx) =>
  `M${f1(cx - rx)} ${f1(cy)}a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(2 * rx)} 0a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(-2 * rx)} 0Z`

/** Points on an ellipse arc, degrees (0 = right, 90 = down). */
export function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 24): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as Pt
  })
}

/** Deterministic random (mulberry32). */
export function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A wobbly closed blob (pebbles, leaves, washes). */
export function blob(cx: number, cy: number, rx: number, ry: number, seed: number, wob = 0.1, n = 18) {
  const r = rng(seed)
  const k = Array.from({ length: 3 }, () => [r() * 6.28, 0.5 + r()])
  const pts: Pt[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const j = 1 + wob * k.reduce((acc, [ph, f], m) => acc + Math.sin(a * (m + 2) * f + ph) / (m + 1), 0) * 0.6
    pts.push([cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j])
  }
  return smoothClosed(pts)
}

/** Closed smooth path through points (quadratic midpoints). */
export function smoothClosed(pts: Pt[]) {
  const n = pts.length
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  let d = `M${P(mid(pts[n - 1], pts[0]))}`
  for (let i = 0; i < n; i++) d += `Q${P(pts[i])} ${P(mid(pts[i], pts[(i + 1) % n]))}`
  return `${d}Z`
}

/** Ink-wash mountain silhouettes on `base` between x0 and x1. */
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

/** Catmull-Rom through control points → dense polyline. */
export function spline(pts: Pt[], step = 4): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p0 = pts[i - 1] ?? p1
    const p3 = pts[i + 2] ?? p2
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
  /** share of the length used to press in (0 = blunt start) */
  a?: number
  /** share of the length used to lift off */
  b?: number
  /** thinnest the tips get, as a share of w */
  min?: number
  /** pressure wobble */
  wob?: number
  step?: number
  /** extra width factor along the stroke */
  wf?: (t: number) => number
}

/** Filled outline of a tapered brush stroke along pts; `c` is its centreline (for draw-on masks). */
export function brush(pts: Pt[], w: number, o: LineOpt = {}) {
  const C = spline(pts, o.step ?? Math.max(1.5, w * 0.4))
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
    const k = Math.max(min, Math.sqrt(Math.min(1, a ? t / a : 1))) * Math.max(min, Math.min(1, b ? (1 - t) / b : 1) ** 0.7) * (1 + wob * Math.sin(t * 11 + w * 3)) * (o.wf ? o.wf(t) : 1)
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

/** Shorthand: a brush stroke path element with a class. */
export const stroke = (pts: Pt[], w: number, cls: string, o: LineOpt = {}, attrs: Record<string, unknown> = {}) =>
  s('path', { d: brush(pts, w, o).d, class: cls, ...attrs })
export const path = (d: string, cls: string, attrs: Record<string, unknown> = {}) => s('path', { d, class: cls, ...attrs })

/** Repaint when the theme or garden palette changes (any way of switching counts). */
export function watchTheme(ctx: SceneCtx, fn: () => void) {
  const d = document.documentElement
  let last = `${d.dataset.theme}|${d.dataset.garden}`
  const mo = new MutationObserver(() => {
    const now = `${d.dataset.theme}|${d.dataset.garden}`
    if (now === last) return
    last = now
    fn()
  })
  mo.observe(d, { attributes: true, attributeFilter: ['data-theme', 'data-garden'] })
  ctx.onCleanup(() => mo.disconnect())
}

/**
 * The art height once this scene's tallest insight is showing, so the picture is composed for it from the
 * start and nothing jumps when the foot grows.
 */
export function stableHeight(ctx: SceneCtx, copies: (Fact | string)[], more = true) {
  const foot = ctx.el.querySelector<HTMLElement>('.scene-foot')
  let probe = ''
  let need = 0
  return (artH: number) => {
    if (!foot) return artH
    // re-measure when the width changes or the web fonts arrive (they change the line breaks)
    const key = `${foot.clientWidth}|${document.fonts?.status}`
    if (key !== probe) {
      probe = key
      const box = h('div', { class: 'scene-insight', 'aria-hidden': 'true', style: 'position:absolute;left:0;right:0;bottom:0;visibility:hidden;pointer-events:none' })
      foot.append(box)
      let max = 0
      for (const c of copies) {
        box.replaceChildren(ctx.fact(c, 'p', 'insight-text'), more ? h('button', { class: 'insight-more', type: 'button', tabindex: '-1' }, '…') : '')
        max = Math.max(max, box.offsetHeight)
      }
      box.remove()
      const cs = getComputedStyle(foot)
      need = Math.max(parseFloat(cs.minHeight) || 0, max + (parseFloat(cs.paddingBottom) || 0))
    }
    return artH - Math.max(0, need - foot.offsetHeight)
  }
}

/** Run fn on the next frame after size changes (one per frame), and once now. */
export function onSize(ctx: SceneCtx, el: Element, fn: () => void) {
  let raf = 0
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(fn)
  })
  ro.observe(el)
  document.fonts?.ready.then(() => ctx.el.isConnected && fn())
  ctx.onCleanup(() => {
    ro.disconnect()
    cancelAnimationFrame(raf)
  })
  fn()
}

/** Convex hull (monotone chain) — the outline a rake follows around a group of stones. */
export function hull(pts: Pt[]): Pt[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const half = (list: Pt[]) => {
    const out: Pt[] = []
    for (const q of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], q) <= 0) out.pop()
      out.push(q)
    }
    out.pop()
    return out
  }
  return [...half(p), ...half(p.reverse())]
}

/**
 * A garden stone in sumi-e, drawn in a 120 × 56 body box: an ink-wash body lit from the upper left, a dry-brush
 * rim on the shadow side, a soft cast shadow on the sand and a hidden vermilion brush ring (shown when pressed).
 * The svg overhangs its host by the margins below, so the host box is the stone itself.
 */
export function inkStone(seed: number, moss = false): SVGSVGElement {
  const r = rng(seed)
  const gid = nextId('t7sg')
  const cid = nextId('t7sc')
  const cx = 60
  const cy = 28
  const ph = [r() * 6.28, r() * 6.28, r() * 6.28]
  // each stone leans its crown to one side and is fuller at one end, like a river stone
  const lean = (r() - 0.5) * 2
  const egg = (r() - 0.5) * 0.16
  const pts: Pt[] = []
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2
    const j = 1 + 0.05 * Math.sin(a * 2 + ph[0]) + 0.03 * Math.sin(a * 3 + ph[1]) + 0.015 * Math.sin(a * 5 + ph[2])
    const sx = Math.cos(a)
    const sy = Math.sin(a)
    const end = 1 + egg * sx
    // seen from above at an angle: fuller crown, flatter underside
    pts.push([cx + sx * 57 * j + (sy < 0 ? sy * sy * lean * 7 : 0), cy + sy * 26.5 * j * end * (sy > 0 ? 0.92 : 1.03)])
  }
  const body = smoothClosed(pts)
  const lower = pts.slice(1, 16) // right → bottom → left: the shadowed rim
  const upper = pts.slice(18, 29) // upper left: the lit edge
  const g = (cls: string, filter: string, ...k: SVGElement[]) => s('g', { class: cls, filter }, ...k)
  const dry = Array.from({ length: 3 }, (_, k) => {
    const x = 30 + k * 26 + r() * 10
    const y = 24 + r() * 12
    return s('path', { d: brush([[x, y], [x + 14 + r() * 10, y + 5 + r() * 5]], 5 + r() * 4, { a: 0.2, b: 0.5 }).d })
  })
  const mossDabs = moss
    ? Array.from({ length: 9 }, (_, k) => {
      const p = pts[11 + Math.floor(r() * 6)]
      return s('path', { d: ell(p[0] + (r() - 0.3) * 6, p[1] - r() * 4 - 1, 1.6 + r() * 2.2, 1.1 + r() * 1.3), 'fill-opacity': (0.55 + r() * 0.4).toFixed(2), 'data-k': k })
    })
    : []
  return s('svg', { class: 't7-st', viewBox: '-12 -10 144 84', preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' },
    s('defs', null,
      s('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0.35, y2: 1 }, s('stop', { offset: 0, class: 't7-g0' }), s('stop', { offset: 1, class: 't7-g1' })),
      s('clipPath', { id: cid }, s('path', { d: body }))),
    s('path', { class: 't7-st-sh', d: ell(cx + 7, cy + 21, 60, 11), filter: 'url(#ink-wash)' }),
    s('path', { class: 't7-st-body', d: body, fill: `url(#${gid})`, filter: 'url(#ink-rough)' }),
    s('g', { 'clip-path': `url(#${cid})` },
      s('path', { class: 't7-st-shade', d: ell(cx + 20, cy + 17, 62, 25), filter: 'url(#ink-wash)' }),
      s('path', { class: 't7-st-sheen', d: ell(cx - 18, cy - 13, 34, 8), filter: 'url(#ink-wash)' }),
      g('t7-st-dry', 'url(#ink-dry)', ...dry)),
    s('path', { class: 't7-st-rim', d: brush(lower, 3.4, { a: 0.18, b: 0.38, wob: 0.25 }).d, filter: 'url(#ink-rough)' }),
    s('path', { class: 't7-st-hair', d: brush(upper, 1.5, { a: 0.3, b: 0.35, wob: 0.3 }).d, filter: 'url(#ink-rough)' }),
    g('t7-st-moss', 'url(#ink-rough)', ...mossDabs),
    s('path', { class: 't7-st-ring', d: brush(arc(cx, cy + 1, 67, 34, -60, 255, 64), 2.6, { a: 0.08, b: 0.45, wob: 0.2 }).d, filter: 'url(#ink-rough)' }))
}
