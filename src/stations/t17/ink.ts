import { h, nextId, s } from '../../core/dom'
import { octaves } from '../../ui/ink'

/** Sumi-e helpers for Trạm 17: tapered brush strokes, raked sand with ripple rings, stones and islands. */
export type Pt = [number, number]

const f1 = (n: number) => Math.round(n * 10) / 10
const P = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
export const ell = (cx: number, cy: number, rx: number, ry = rx) =>
  `M${f1(cx - rx)} ${f1(cy)}a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(2 * rx)} 0a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(-2 * rx)} 0Z`
export const poly = (pts: Pt[]) => `M${pts.map(P).join('L')}Z`

/** Deterministic random (mulberry32). */
export function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export const hash = (str: string) => [...str].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 7)

/** Points on an ellipse arc, degrees (0 = right, 90 = down). */
export function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 24): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as Pt
  })
}

function spline(pts: Pt[], step = 4, closed = false): Pt[] {
  const out: Pt[] = []
  const m = pts.length
  const at = (i: number) => pts[(i + m) % m]
  for (let i = 0; i < (closed ? m : m - 1); i++) {
    const p1 = pts[i]
    const p2 = closed ? at(i + 1) : pts[i + 1]
    const p0 = closed ? at(i - 1) : (pts[i - 1] ?? p1)
    const p3 = closed ? at(i + 2) : (pts[i + 2] ?? p2)
    const n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step))
    for (let j = 0; j < n; j++) {
      const t = j / n
      const t2 = t * t
      const t3 = t2 * t
      const c = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3)
      out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])])
    }
  }
  if (!closed) out.push(pts[pts.length - 1])
  return out
}

/** A smooth closed outline through pts (Catmull-Rom). */
export const blob = (pts: Pt[]) => `M${spline(pts, 4, true).map(P).join('L')}Z`

/** Filled outline of a tapered brush stroke along pts (a = press-in share, b = lift-off share). */
export function brush(pts: Pt[], w: number, o: { a?: number; b?: number; min?: number; wob?: number } = {}) {
  const C = spline(pts)
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
  return `M${lft.map(P).join('L')}A${f1(he)} ${f1(he)} 0 0 0 ${P(rgt[n - 1])}L${rgt.reverse().map(P).join('L')}A${f1(hs)} ${f1(hs)} 0 0 0 ${P(lft[0])}Z`
}

/** Shared gradients for one SVG (ids are unique: two scenes overlap while they cross-fade). */
export function defs(svg: SVGSVGElement) {
  const id = { stone: nextId('t17s'), glow: nextId('t17g'), warm: nextId('t17w'), dry: nextId('t17d') }
  svg.append(s('defs', null,
    s('linearGradient', { id: id.stone, x1: 0, y1: 0, x2: 0.25, y2: 1 }, s('stop', { offset: 0, class: 'gs0' }), s('stop', { offset: 1, class: 'gs1' })),
    s('radialGradient', { id: id.glow }, s('stop', { offset: 0, class: 'gl0' }), s('stop', { offset: 1, class: 'gl1' })),
    s('radialGradient', { id: id.warm }, s('stop', { offset: 0, class: 'wm0' }), s('stop', { offset: 1, class: 'wm1' })),
    // dry brush that streaks ALONG a horizontal stroke (long in x, broken in y), with uneven gaps
    s('filter', { id: id.dry, x: '-10%', y: '-30%', width: '120%', height: '160%' },
      s('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.045 0.5', numOctaves: octaves(3), seed: 23, result: 'n' }),
      s('feColorMatrix', { in: 'n', type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.6 1.75', result: 'm' }),
      s('feComposite', { in: 'SourceGraphic', in2: 'm', operator: 'in' }))))
  return id
}

/** A small hollow ring after a name the brief marks "verify" (the legend says what it means). */
export const vf = (label: string) => h('span', { class: 't17-vf', title: label }, h('span', { class: 'visually-hidden' }, ` (${label})`))

/** A raked river: a channel of sand whose lines follow its centre line (start → end), widening from w0 to w1. */
export interface River {
  pts: Pt[]
  w0: number
  w1: number
  n: number
}

export interface Ring {
  x: number
  y: number
  /** innermost ring radius (x); rings are ellipses rx × rx·k */
  r0: number
  n: number
}

/**
 * Raked sand: straight rakes that widen toward the viewer and stop where each stone's ripple rings begin.
 * Rings shed their outer lines until neighbours no longer touch. Returns the group (append it first).
 */
export function sand(W: number, H: number, rings: Ring[], o: { top?: number; gap?: number; k?: number; fade?: number; keep?: boolean; rivers?: River[] } = {}) {
  const top = o.top ?? 0
  const gap = o.gap ?? 8
  const k = o.k ?? 0.36
  const R = (r: Ring) => r.r0 + r.n * gap
  for (let guard = 0; guard < (o.keep ? 0 : 14); guard++) {
    let ok = true
    for (const [i, a] of rings.entries())
      for (const b of rings.slice(i + 1))
        if (Math.hypot(a.x - b.x, (a.y - b.y) / k) < R(a) + R(b) + gap * 0.6) {
          ok = false
          const big = a.n >= b.n ? a : b
          if (big.n > 0) big.n--
          else if (big === a && b.n > 0) b.n--
        }
    if (ok) break
  }
  const mid = nextId('t17k')
  const fid = nextId('t17f')
  const g = s('g', { class: 't17-sand' })
  const fade = o.fade ?? H * 0.1
  const holes = () => rings.map((r) => s('path', { d: ell(r.x, r.y, R(r) + 1, (R(r) + 1) * k), fill: '#000' }))
  // each river: its outline (cut out of the straight rakes) and its own lines following the channel
  const rivers = (o.rivers ?? []).map((rv) => {
    const C = spline(rv.pts, 6)
    const n = C.length
    const side = (u: number) =>
      C.map((p, i) => {
        const A = C[Math.max(0, i - 1)]
        const B = C[Math.min(n - 1, i + 1)]
        const dl = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1
        const hw = rv.w0 + ((rv.w1 - rv.w0) * i) / Math.max(1, n - 1)
        return [p[0] - ((B[1] - A[1]) / dl) * hw * u, p[1] + ((B[0] - A[0]) / dl) * hw * u] as Pt
      })
    const lines = Array.from({ length: rv.n }, (_, j) => side(rv.n > 1 ? (-1 + (2 * j) / (rv.n - 1)) * 0.82 : 0))
    return { band: poly([...side(1), ...side(-1).reverse()]), lines }
  })
  g.append(s('defs', null,
    s('linearGradient', { id: fid, x1: 0, y1: 0, x2: 0, y2: 1 },
      s('stop', { offset: clamp(top / H, 0, 1), 'stop-color': '#fff', 'stop-opacity': 0 }),
      s('stop', { offset: clamp((top + fade) / H, 0, 1), 'stop-color': '#fff', 'stop-opacity': 1 })),
    s('mask', { id: mid, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H },
      s('rect', { x: 0, y: 0, width: W, height: H, fill: `url(#${fid})` }),
      ...rivers.map((rv) => s('path', { d: rv.band, fill: '#000' })),
      ...holes()),
    s('mask', { id: `${mid}-r`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H },
      s('rect', { x: 0, y: 0, width: W, height: H, fill: `url(#${fid})` }),
      ...holes())))
  const rk = s('g', { mask: `url(#${mid})` })
  for (let y = top, j = 0; y < H + 10; j++) {
    const pts: string[] = []
    for (let x = -10; x <= W + 24; x += 24) pts.push(`${x} ${(y + 1.1 * Math.sin(x / 41 + j * 0.7)).toFixed(1)}`)
    const d = `M${pts.join('L')}`
    rk.append(s('path', { d, class: 'rk' }), s('path', { d, class: 'rk-hi', transform: 'translate(0 1.5)' }))
    y += 6 + 10 * ((y - top) / Math.max(1, H - top))
  }
  g.append(rk)
  const rg = s('g', { mask: `url(#${mid}-o)` })
  // ring sets fade out with the sand at the top edge too
  g.append(s('defs', null, s('mask', { id: `${mid}-o`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, s('rect', { x: 0, y: 0, width: W, height: H, fill: `url(#${fid})` }))))
  for (const r of rings)
    for (let j = 0; j <= r.n; j++) {
      const rx = r.r0 + j * gap
      const d = ell(r.x, r.y, rx, rx * k)
      rg.append(s('path', { d, class: 'rk' }), s('path', { d, class: 'rk-hi', transform: 'translate(0 1.5)' }))
    }
  g.append(rg)
  if (rivers.length) {
    const rv = s('g', { mask: `url(#${mid}-r)` })
    for (const r of rivers)
      for (const l of r.lines) {
        const d = `M${l.map(P).join('L')}`
        rv.append(s('path', { d, class: 'rk' }), s('path', { d, class: 'rk-hi', transform: 'translate(0 1.5)' }))
      }
    g.append(rv)
  }
  return g
}

/**
 * A stone seen from the side (for cairns): flat bottom, softly domed top, ink edge, shaded underside,
 * a lit rim and a few dry-brush strokes. (x, y) is the middle of its base line.
 */
export function pebble(x: number, y: number, rx: number, ry: number, seed: number, id: { stone: string; dry: string }, o: { moss?: boolean } = {}) {
  const r = rng(seed)
  const pts: Pt[] = []
  const cy = y - ry
  const tilt = (r() - 0.5) * 0.12
  for (let a = 0; a < 360; a += 12) {
    const t = (a * Math.PI) / 180
    const j = 1 + (r() - 0.5) * 0.07
    const sy = Math.sin(t)
    // flatter base, fuller shoulders
    const yy = sy > 0 ? sy ** 0.7 : -((-sy) ** 0.85)
    pts.push([x + rx * j * Math.cos(t), cy + ry * j * yy + tilt * rx * Math.cos(t)])
  }
  const body = blob(pts)
  const lower = pts.filter((_, i) => i <= 15) // 0°→180°: the base
  const upper = pts.slice(18, 27) // upper-left shoulder
  const g = s('g', { class: 't17-peb' })
  g.append(
    s('path', { class: 'sh', 'fill-opacity': 0.18, d: ell(x + rx * 0.06, y + ry * 0.04, rx * 1.02, ry * 0.26), filter: 'url(#ink-wash)' }),
    s('g', { filter: 'url(#ink-rough)' },
      s('path', { d: body, fill: `url(#${id.stone})` }),
      s('path', { class: 'sh', 'fill-opacity': 0.2, d: brush(lower.slice(1, 15), ry * 0.9, { a: 0.3, b: 0.3, min: 0.3 }) }),
      s('path', { class: 'sh', 'fill-opacity': 0.75, d: brush(lower.slice(0, 16), Math.max(1.4, ry * 0.12), { a: 0.2, b: 0.25 }) }),
      s('path', { class: 'edge', 'fill-opacity': 0.7, d: brush([...pts.slice(16), pts[0]], Math.max(1, ry * 0.06), { a: 0.25, b: 0.3 }) }),
      s('path', { class: 'rim', d: brush(upper.map(([a, b]) => [a + rx * 0.06, b + ry * 0.16] as Pt), Math.max(1.2, ry * 0.14), { a: 0.35, b: 0.4 }) })),
    // dry-brush grain: a few broken strokes of uneven length that follow the stone's curve
    grain())
  function grain() {
    const gg = s('g', { filter: `url(#${id.dry})`, class: 'sh', 'fill-opacity': 0.34 })
    const n = 3 + Math.floor(r() * 3)
    for (let i = 0; i < n; i++) {
      const depth = 0.35 + r() * 0.55 // how far down the face
      const a0 = 200 + r() * 70
      const len = 25 + r() * 60
      const pts = arc(x + (r() - 0.5) * rx * 0.2, cy + ry * depth, rx * (0.55 + r() * 0.3), ry * (0.5 + r() * 0.4), a0, Math.min(335, a0 + len), 8)
      gg.append(s('path', { d: brush(pts, ry * (0.07 + r() * 0.12), { a: 0.15 + r() * 0.2, b: 0.3 + r() * 0.3, min: 0.12, wob: 0.25 }) }))
    }
    return gg
  }
  if (o.moss) {
    const mg = s('g', { class: 'm', filter: 'url(#ink-rough)' })
    // a little moss in the shadow at the foot of the lowest stone
    for (let i = 0; i < 7; i++) {
      const t = Math.PI * (0.6 + r() * 0.3)
      mg.append(s('path', { d: ell(x + Math.cos(t) * rx * 0.86, y - ry * 0.08 - r() * ry * 0.18, rx * (0.018 + r() * 0.022), ry * (0.05 + r() * 0.05)), 'fill-opacity': (0.35 + r() * 0.35).toFixed(2) }))
    }
    g.append(mg)
  }
  return g
}

/**
 * A moss island in the raked sand (seen at a slant): a bleeding green wash, denser moss near the stones,
 * a dark lip of wet earth at the front and a soft shadow. (x, y) is its centre.
 */
export function isle(x: number, y: number, rx: number, ry: number, seed: number) {
  const r = rng(seed)
  const shape = (sx: number, sy: number, jit: number, dx = 0, dy = 0) => {
    const pts: Pt[] = []
    for (let a = 0; a < 360; a += 20) {
      const t = (a * Math.PI) / 180
      const j = 1 + (r() - 0.5) * jit
      pts.push([x + dx + rx * sx * j * Math.cos(t), y + dy + ry * sy * j * Math.sin(t)])
    }
    return pts
  }
  const outer = shape(1, 1, 0.22)
  const front = outer.slice(1, 9) // 20° → 160°: the near rim
  const g = s('g', { class: 't17-isle' })
  g.append(
    s('path', { class: 'sh', 'fill-opacity': 0.12, d: ell(x + rx * 0.05, y + ry * 0.55, rx * 1.08, ry * 0.75), filter: 'url(#ink-wash)' }),
    s('path', { class: 'm', 'fill-opacity': 0.22, d: blob(outer), filter: 'url(#ink-wash)' }),
    s('path', { class: 'm', 'fill-opacity': 0.26, d: blob(shape(0.8, 0.7, 0.3, -rx * 0.04, -ry * 0.1)), filter: 'url(#ink-wash)' }),
    s('path', { class: 'm', 'fill-opacity': 0.3, d: blob(shape(0.5, 0.45, 0.35, rx * 0.06, -ry * 0.2)), filter: 'url(#ink-wash)' }),
    s('path', { class: 'sh', 'fill-opacity': 0.55, d: brush(front.map(([a, b]) => [a, b + ry * 0.06] as Pt), Math.max(1.4, ry * 0.12), { a: 0.25, b: 0.35 }), filter: 'url(#ink-rough)' }))
  // moss dabs: thick at the heart, scattering toward the rim
  // a few tufts at the rim where the moss meets the sand
  const mg = s('g', { class: 'm dabs', filter: 'url(#ink-rough)' })
  const nm = 5 + Math.round(rx / 14)
  for (let i = 0; i < nm; i++) {
    const t = Math.PI * (0.1 + r() * 0.8) + (r() < 0.35 ? Math.PI : 0)
    const f = 0.82 + r() * 0.2
    mg.append(s('path', { d: ell(x + rx * f * Math.cos(t), y + ry * f * Math.sin(t), rx * 0.02 + 1 + r() * 1.4, ry * 0.05 + 0.7 + r() * 0.8), 'fill-opacity': (0.3 + r() * 0.35).toFixed(2) }))
  }
  g.append(mg)
  return g
}

/** Ink-wash ridges standing on `base` between x0 and x1 (the far shore at dusk). */
export function peaks(r: () => number, x0: number, x1: number, base: number, hMin: number, hMax: number, step: number) {
  const out: string[] = []
  for (let mx = x0; mx < x1; mx += step * (0.6 + r() * 0.8)) {
    const hgt = hMin + r() * (hMax - hMin)
    const hw = hgt * (1.6 + r() * 1.2)
    const pts: Pt[] = []
    for (let i = 0; i <= 16; i++) {
      const u = 1 - Math.abs((i / 16) * 2 - 1)
      pts.push([mx - hw + (i / 8) * hw, base - hgt * u ** (1.35 + r() * 0.2) + (i % 16 ? (r() - 0.5) * hgt * 0.06 : 0)])
    }
    out.push(poly(pts))
  }
  return out
}

/** Tiny brushed glyphs for the kinds of work (decorative; the chip carries the word). */
export function catGlyph(k: string) {
  const B = (pts: Pt[], w: number) => s('path', { d: brush(pts, w, { a: 0.2, b: 0.35, min: 0.3, wob: 0.05 }) })
  const parts: SVGElement[] = {
    text: [B([[4, 8], [12, 7.4], [20, 8]], 2.2), B([[4, 13], [16, 12.6]], 2), B([[4, 18], [11, 17.6]], 1.8)],
    image: [B([[3.5, 5], [20.5, 5], [20.5, 19], [3.5, 19], [3.5, 5.6]], 1.5), B([[5, 17], [10, 10.5], [13.5, 14.5], [16, 12.5], [19.5, 17]], 1.7), s('circle', { cx: 16.5, cy: 8.6, r: 1.6 })],
    video: [B([[3.5, 6], [20.5, 6], [20.5, 18], [3.5, 18], [3.5, 6.6]], 1.5), s('path', { d: 'M10 9.2 15.4 12 10 14.8Z' })],
    '3d': [B([[12, 3.5], [20, 7.8], [20, 16.4], [12, 20.5], [4, 16.4], [4, 7.8], [12, 3.9]], 1.5), B([[4.4, 8], [12, 12.2], [19.6, 8]], 1.3), B([[12, 12.4], [12, 20]], 1.3)],
    audio: [B([[4, 12], [6, 8], [8, 16], [10, 5], [12, 19], [14, 7], [16, 15], [18, 10], [20, 12]], 1.4)],
  }[k] ?? []
  return s('svg', { class: 't17-glyph', viewBox: '0 0 24 24', 'aria-hidden': 'true' }, ...parts)
}
