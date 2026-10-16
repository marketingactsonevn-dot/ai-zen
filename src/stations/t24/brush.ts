import { s } from '../../core/dom'
import { blob, rng, stroke, type Pt } from '../../ui/part2/ink'

/** Shared ink geometry for Trạm 24: tapered limbs, smooth centrelines, cloud pads of pine needles, paths. */
const f1 = (n: number) => (Math.round(n * 10) / 10).toString()
export const P = (pts: Pt[]) => `M${pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}`
export const Z = (pts: Pt[]) => `${P(pts)}Z`

/** Catmull-Rom through pts, k samples per span. */
export function spline(pts: Pt[], k = 8): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)]
    for (let j = 0; j < k; j++) {
      const t = j / k, t2 = t * t, t3 = t2 * t
      const c = (a: number, b: number, cc: number, d: number) => 0.5 * (2 * b + (cc - a) * t + (2 * a - 5 * b + 4 * cc - d) * t2 + (3 * b - a - 3 * cc + d) * t3)
      out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])])
    }
  }
  out.push(pts[pts.length - 1])
  return out
}

/** A limb of width w0 → w1 along pts (flare widens the foot): the outline and its two edges (left = facing -normal). */
export function taper(pts: Pt[], w0: number, w1: number, flare = 0, seed = 1) {
  const r = rng(seed)
  const L: Pt[] = [], R: Pt[] = []
  const n = pts.length
  pts.forEach((p, i) => {
    const t = i / (n - 1)
    const A = pts[Math.max(0, i - 1)], B = pts[Math.min(n - 1, i + 1)]
    const dl = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1
    const nx = -(B[1] - A[1]) / dl, ny = (B[0] - A[0]) / dl
    const hw = (w0 + (w1 - w0) * t + flare * Math.pow(1 - t, 7)) / 2
    const j = 1 + (r() - 0.5) * 0.08
    L.push([p[0] - nx * hw * j, p[1] - ny * hw * j])
    R.push([p[0] + nx * hw * j, p[1] + ny * hw * j])
  })
  return { d: `${P(L)}L${[...R].reverse().map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}Z`, L, R }
}

/**
 * A cloud pad of pine needles centred at (cx, cy), w × h: a scalloped dome over a flat belly. Returns the outline, its top
 * contour (left → right) and the needle fringe (fine strokes along the top and under the belly) as one path.
 */
export function pad(cx: number, cy: number, w: number, h: number, seed: number) {
  const r = rng(seed)
  const N = 26
  const bumps = 3 + Math.floor(r() * 2)
  const ph = r() * Math.PI
  const top: Pt[] = []
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const env = Math.pow(Math.sin(Math.PI * t), 0.5)
    const sc = 0.72 + 0.28 * Math.abs(Math.sin(Math.PI * t * bumps + ph))
    top.push([cx - w / 2 + w * t + (r() - 0.5) * w * 0.01, cy - h * env * sc])
  }
  const bot: Pt[] = []
  for (let i = N; i >= 0; i--) {
    const t = i / N
    bot.push([cx - w / 2 + w * t, cy + h * 0.26 * Math.pow(Math.sin(Math.PI * t), 0.8) + (r() - 0.5) * h * 0.05])
  }
  let fringe = ''
  for (let i = 1; i < N; i++) {
    const [x, y] = top[i]
    const out = (i / N - 0.5) * 1.6
    for (let k = 0; k < 3; k++) {
      const l = h * (0.16 + r() * 0.18)
      const a = -Math.PI / 2 + out * 0.9 + (r() - 0.5) * 0.9
      const x0 = x + (r() - 0.5) * w * 0.03, y0 = y + h * (0.05 + r() * 0.12)
      fringe += stroke([[x0, y0], [x0 + Math.cos(a) * l, y0 + Math.sin(a) * l]], Math.max(0.8, h * 0.035), 0.05, 0.7, 0.15)
    }
  }
  for (let i = 2; i < N - 1; i += 2) {
    const [x, y] = bot[i]
    const l = h * (0.1 + r() * 0.12)
    fringe += stroke([[x, y - h * 0.05], [x + (r() - 0.5) * l * 0.6, y + l]], Math.max(0.7, h * 0.03), 0.05, 0.7, 0.15)
  }
  return { d: Z([...top, ...bot]), top, fringe }
}

/** A gradient whose stops carry classes (colours from CSS tokens, so the theme switches with no JS). */
export function grad(id: string, kind: 'linear' | 'radial', at: Record<string, string | number>, stops: [number, string][]) {
  return s(kind === 'linear' ? 'linearGradient' : 'radialGradient', { id, ...at }, ...stops.map(([o, c]) => s('stop', { offset: o, class: c })))
}

/**
 * Pine foliage as tufts in three rows (belly → crown): each row one path of rounded tufts (fill darker below, lit on top),
 * needles fanning up out of every tuft (the upper-left ones catch the moon), and the spots where lacquer would shine.
 */
export function tufts(cx: number, cy: number, w: number, h: number, seed: number) {
  const r = rng(seed)
  const rows = ['', '', '']
  let dark = '', lit = ''
  const gl: Pt[] = []
  const base = Math.max(2, Math.round(w / (h * 0.8)))
  for (let j = 0; j < 3; j++) {
    const n = Math.max(1, Math.round(base * (1 - j * 0.34)))
    const span = w * (0.86 - j * 0.24)
    const yy = cy - j * h * 0.3
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1)
      const x = cx - span / 2 + span * t + (r() - 0.5) * h * 0.25
      const y = yy - Math.sin(Math.PI * t) * h * 0.1 + (r() - 0.5) * h * 0.06
      const rr = h * (0.36 + r() * 0.12) * (1 - j * 0.08)
      rows[j] += blob(x, y, rr * 1.18, rr * 0.78, seed * 7 + j * 13 + i, 0.14, 14)
      for (let k = 0; k < 12; k++) {
        const a = Math.PI * (1.04 + (k / 11) * 0.92) + (r() - 0.5) * 0.12
        const l = rr * (0.8 + r() * 0.45)
        const ox = x + (r() - 0.5) * rr * 0.4, oy = y + rr * 0.32
        const seg = stroke([[ox, oy], [ox + Math.cos(a) * l, oy + Math.sin(a) * l * 0.82]], Math.max(0.75, h * 0.024), 0.05, 0.65, 0.15)
        if (k < 5 && j > 0) lit += seg
        else dark += seg
      }
      if (j === 2 || (j === 1 && r() < 0.6)) gl.push([x - rr * 0.38, y - rr * 0.42])
    }
  }
  return { rows, dark, lit, gl }
}

/** One pine needle: a thin wedge from (x0, y0) to its point (x1, y1). */
const needle = (x0: number, y0: number, x1: number, y1: number, w: number) => {
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1
  const nx = (-dy / l) * w * 0.5, ny = (dx / l) * w * 0.5
  return `M${f1(x0 + nx)} ${f1(y0 + ny)}L${f1(x1)} ${f1(y1)}L${f1(x0 - nx)} ${f1(y0 - ny)}Z`
}

/**
 * A pine pad seen from below, against the moon: a lumpy dark belly (the underside we look up at), fans of needles from
 * pivots along its dome, a few hanging under it, and the needles on the moon's side (upper left) set apart for the rim
 * light. Returns path data per tone: belly, dark, mid, rim. `grow` scales the needles (a near pad has longer ones).
 */
export function needlePad(cx: number, cy: number, w: number, h: number, seed: number, grow = 1, spread = 1) {
  const r = rng(seed)
  let belly = '', dark = '', mid = '', rim = ''
  const lumps = Math.max(3, Math.round(w / (h * 0.7)))
  for (let i = 0; i < lumps; i++) {
    const t = (i + 0.5) / lumps
    const env = Math.sin(Math.PI * t)
    belly += blob(cx - w / 2 + w * t + (r() - 0.5) * h * 0.2, cy + h * 0.06 - env * h * 0.12, (w / lumps) * 0.72, h * (0.18 + env * 0.18), seed + i * 3, 0.22, 12)
  }
  const N = Math.max(6, Math.round(w / (h * 0.2)))
  const nw = Math.max(0.75, h * 0.018)
  for (let i = 0; i < N; i++) {
    const t = (i + 0.1 + r() * 0.8) / N
    const env = Math.pow(Math.sin(Math.PI * t), 0.6)
    const px = cx - w / 2 + w * t, py = cy - h * env * 0.34 + h * 0.06
    const fan = 20 + Math.floor(r() * 9)
    for (let k = 0; k < fan; k++) {
      // mostly up and out; the pad's ends lean outward
      const q = (k / (fan - 1) - 0.5) * 2
      const a = Math.PI * 1.5 + q * Math.PI * 0.52 * spread + (t - 0.5) * 0.7 + (r() - 0.5) * 0.18
      const L = h * (0.42 + r() * 0.36) * (0.75 + env * 0.4) * grow * (1 - Math.abs(q) * 0.25)
      const ox = px + (r() - 0.5) * h * 0.16, oy = py + h * (0.04 + r() * 0.12)
      const d = needle(ox, oy, ox + Math.cos(a) * L, oy + Math.sin(a) * L * 0.8, nw * (0.7 + r() * 0.7))
      const up = Math.sin(a) < -0.45
      if (up && (t < 0.55 || Math.cos(a) < -0.3) && r() < 0.65) rim += d
      else if (r() < 0.55) mid += d
      else dark += d
    }
    for (let k = 0; k < 4; k++) {
      const a = Math.PI * (0.22 + r() * 0.56)
      const L = h * (0.16 + r() * 0.16) * grow
      const oy = cy + h * (0.1 + r() * 0.12)
      dark += needle(px + (r() - 0.5) * h * 0.2, oy, px + Math.cos(a) * L, oy + Math.sin(a) * L, nw * 0.8)
    }
  }
  return { belly, dark, mid, rim }
}
