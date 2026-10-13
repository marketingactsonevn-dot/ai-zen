// Sumi-e drawing helpers: tapered filled strokes, wobbly wash blobs, text wrapping for SVG.
import { s } from '../../core/dom'

export type Pt = [number, number]

/** Deterministic PRNG (mulberry32) so the art looks the same on every visit. */
export function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Catmull-Rom spline through pts, n+1 samples. */
function spline(pts: Pt[], n: number): Pt[] {
  const seg = pts.length - 1
  const out: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * seg
    const k = Math.min(seg - 1, Math.floor(t))
    const u = t - k
    const p0 = pts[Math.max(0, k - 1)], p1 = pts[k], p2 = pts[k + 1], p3 = pts[Math.min(seg, k + 2)]
    const c = (j: 0 | 1) =>
      0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * u + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * u * u + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * u * u * u)
    out.push([c(0), c(1)])
  }
  return out
}

const f1 = (n: number) => n.toFixed(1)

/**
 * A filled brush stroke: quick press at the start (`head`), then a long taper (`tail` < 1 keeps it fuller).
 * Returns path data; fill it and add filter="url(#ink-rough)" for a ragged edge.
 */
export function stroke(pts: Pt[], w: number, o: { head?: number; tail?: number; min?: number } = {}): string {
  const n = Math.max(14, (pts.length - 1) * 14)
  const P = spline(pts, n)
  const head = o.head ?? 0.14
  const tail = o.tail ?? 0.7
  const min = o.min ?? 0.1
  const L: Pt[] = [], R: Pt[] = []
  P.forEach((p, i) => {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n, i + 1)]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    const nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len
    const t = i / n
    const f = t < head ? Math.sqrt(Math.sin((t / head) * Math.PI * 0.5)) : Math.pow(Math.cos(((t - head) / (1 - head)) * Math.PI * 0.5), tail)
    const hw = (w / 2) * Math.max(min, f)
    L.push([p[0] + nx * hw, p[1] + ny * hw])
    R.push([p[0] - nx * hw, p[1] - ny * hw])
  })
  return `M${L.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')}L${R.reverse().map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')}Z`
}

/** Points of an irregular closed shape around (cx, cy), starting at the right and turning clockwise on screen. */
export function blobPts(cx: number, cy: number, rx: number, ry: number, seed = 1, wob = 0.08, n = 22): Pt[] {
  const r = rng(seed)
  const ph = [r() * 6.3, r() * 6.3, r() * 6.3]
  const pts: Pt[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const k = 1 + wob * (Math.sin(2 * a + ph[0]) * 0.6 + Math.sin(3 * a + ph[1]) * 0.35 + Math.sin(5 * a + ph[2]) * 0.2)
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k])
  }
  return pts
}

/** Smooth path through points (quadratic curves between midpoints), closed or open. */
export function curve(pts: Pt[], closed = true): string {
  const n = pts.length
  const mid = (a: Pt, b: Pt) => `${f1((a[0] + b[0]) / 2)} ${f1((a[1] + b[1]) / 2)}`
  if (!closed) {
    let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`
    for (let i = 1; i < n - 1; i++) d += `Q${f1(pts[i][0])} ${f1(pts[i][1])} ${mid(pts[i], pts[i + 1])}`
    return `${d}L${f1(pts[n - 1][0])} ${f1(pts[n - 1][1])}`
  }
  let d = `M${mid(pts[n - 1], pts[0])}`
  for (let i = 0; i < n; i++) d += `Q${f1(pts[i][0])} ${f1(pts[i][1])} ${mid(pts[i], pts[(i + 1) % n])}`
  return d + 'Z'
}

/** An irregular closed shape (stone, wash, puddle) around (cx, cy). */
export function blob(cx: number, cy: number, rx: number, ry: number, seed = 1, wob = 0.08, n = 22): string {
  return curve(blobPts(cx, cy, rx, ry, seed, wob, n))
}

/** A sheet of paper with slightly soft, hand-cut edges. */
export function sheet(x: number, y: number, w: number, hgt: number, seed = 1): string {
  const r = rng(seed)
  const j = () => (r() - 0.5) * 1.6
  return `M${f1(x + j())} ${f1(y + j())}L${f1(x + w + j())} ${f1(y + j())}L${f1(x + w + j())} ${f1(y + hgt + j())}L${f1(x + j())} ${f1(y + hgt + j())}Z`
}

let measureCtx: CanvasRenderingContext2D | null = null
/** Width of a string in the serif at `size` px. */
export function measure(text: string, size: number, weight = 400): number {
  measureCtx ??= document.createElement('canvas').getContext('2d')
  if (!measureCtx) return text.length * size * 0.52
  measureCtx.font = `${weight} ${size}px "Noto Serif", Georgia, serif`
  return measureCtx.measureText(text).width
}

/** Greedy word-wrap measured with the real font (serif). */
export function wrap(text: string, maxW: number, size: number, weight = 400): string[] {
  const lines: string[] = []
  let line = ''
  for (const w of text.split(/\s+/)) {
    const next = line ? `${line} ${w}` : w
    if (line && measure(next, size, weight) > maxW) {
      lines.push(line)
      line = w
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

/**
 * A flat garden stone painted in ink, stretched to fill its box: a soft wash shadow, the body, a pale wash where the
 * light falls, the pigment pooling on the shaded lower edge, and a contour pressed hard on the shaded lower right
 * that thins to a broken hairline on the lit upper left.
 */
export function stoneArt(seed: number) {
  const pts = blobPts(60, 31, 54, 24, seed, 0.1, 24)
  const n = pts.length
  // blobPts starts at the right and turns clockwise (down first): index → angle
  const span = (a0: number, a1: number) => {
    const out: Pt[] = []
    for (let i = Math.round((a0 / (Math.PI * 2)) * n); i <= Math.round((a1 / (Math.PI * 2)) * n); i++) out.push(pts[((i % n) + n) % n])
    return out
  }
  return s('svg', { class: 't1-ws-art', viewBox: '0 0 120 64', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    s('path', { class: 't1-ws-shadow', d: blob(65, 39, 54, 20, seed + 7, 0.1) }),
    s('path', { class: 't1-ws-base', d: curve(pts) }),
    s('path', { class: 't1-ws-hi', d: blob(46, 23, 30, 9, seed + 3, 0.2, 14), filter: 'url(#ink-wash)' }),
    s('path', { class: 't1-ws-low', d: stroke(span(-0.15, Math.PI * 0.95), 9, { head: 0.3, tail: 0.5, min: 0.15 }), filter: 'url(#ink-wash)' }),
    s('path', { class: 't1-ws-rim', d: curve(span(-0.3, Math.PI * 0.9), false), 'vector-effect': 'non-scaling-stroke', filter: 'url(#ink-dry)' }),
    s('path', { class: 't1-ws-rim2', d: curve(span(Math.PI * 1.02, Math.PI * 1.62), false), 'vector-effect': 'non-scaling-stroke' }))
}

/** A dark ink pebble with a vermilion heart: the visitor's marker (scene 2's path, scene 1's sand ⟷ brain track). */
export function pebbleArt(rough: string | null) {
  return s('svg', { viewBox: '0 0 40 30', 'aria-hidden': 'true' },
    s('path', { class: 't1-mk-shadow', d: blob(23, 22, 16, 5.5, 4, 0.1) }),
    s('path', { class: 't1-mk-body', d: blob(20, 14, 15.5, 10.5, 5, 0.1, 16), filter: rough }),
    s('path', { class: 't1-mk-hi', d: blob(15.5, 9.5, 7.5, 3.4, 6, 0.15, 12) }),
    s('circle', { class: 't1-mk-dot', cx: 21, cy: 14.5, r: 3.4 }))
}
