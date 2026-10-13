// Sumi-e helpers for Trạm 13: tapered filled strokes, wobbly blobs, handwriting squiggles.
export type Pt = [number, number]

export const f1 = (n: number) => (Math.round(n * 10) / 10).toString()

/** Deterministic PRNG (mulberry32) so the art is the same on every visit. */
export function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Catmull-Rom spline through pts, n+1 samples (passes through every control point). */
export function spline(pts: Pt[], n: number): Pt[] {
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

/** Filled brush stroke through control points: quick press (`head`), long taper (`tail` < 1 stays fuller). */
export function stroke(pts: Pt[], w: number, o: { head?: number; tail?: number; min?: number; seg?: number } = {}): string {
  const n = Math.max(10, (pts.length - 1) * (o.seg ?? 10))
  const P = pts.length > 2 ? spline(pts, n) : spline([pts[0], ...pts], n)
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

/** The same control points as a plain centre line (for uniform "vector" outlines or dash animations). */
export function line(pts: Pt[], seg = 8): string {
  const P = pts.length > 2 ? spline(pts, (pts.length - 1) * seg) : pts
  return `M${P.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')}`
}

/** An irregular closed shape (stone, wash, puddle) around (cx, cy). */
export function blob(cx: number, cy: number, rx: number, ry: number, seed = 1, wob = 0.08, n = 22): string {
  const r = rng(seed)
  const ph = [r() * 6.3, r() * 6.3, r() * 6.3]
  const pts: Pt[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const k = 1 + wob * (Math.sin(2 * a + ph[0]) * 0.6 + Math.sin(3 * a + ph[1]) * 0.35 + Math.sin(5 * a + ph[2]) * 0.2)
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k])
  }
  const mid = (a: Pt, b: Pt) => `${f1((a[0] + b[0]) / 2)} ${f1((a[1] + b[1]) / 2)}`
  let d = `M${mid(pts[n - 1], pts[0])}`
  for (let i = 0; i < n; i++) d += `Q${f1(pts[i][0])} ${f1(pts[i][1])} ${mid(pts[i], pts[(i + 1) % n])}`
  return d + 'Z'
}

/** Hand-writing squiggle on baseline y from x0 to x1 (a stroked path, read as "words" from afar). */
export function scribble(x0: number, y: number, x1: number, seed = 0, amp = 2.6): string {
  const r = rng(seed + 1)
  let d = `M${f1(x0)} ${f1(y)}`
  let x = x0
  while (x < x1 - 4) {
    // a "word": a few loops, then a small gap
    const wl = Math.min(x1 - x, 10 + r() * 22)
    for (let t = 0; t < wl; t += 2.4) {
      const k = (x + t) * 0.9 + seed
      d += `L${f1(x + t + Math.cos(k) * 1.1)} ${f1(y - amp * Math.abs(Math.sin(k)) * (0.6 + 0.4 * r()))}`
    }
    x += wl + 4 + r() * 3
    if (x < x1 - 4) d += `M${f1(x)} ${f1(y)}`
  }
  return d
}
