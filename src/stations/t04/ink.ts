// Canvas sumi-e helpers for Trạm 4: theme colours, tapered brush strokes, ink washes, raked sand.
import { cssVar } from '../../core/prefs'

export type Pt = [number, number]
export type RGBA = [number, number, number, number]

/** '#rrggbb' or 'rgb(a)(…)' → [r, g, b, a] */
export function rgba(css: string): RGBA {
  const m = css.match(/^#([0-9a-f]{6})$/i)
  if (m) {
    const n = parseInt(m[1], 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1]
  }
  const v = css.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 1]
  return [v[0], v[1], v[2], v[3] ?? 1]
}
export const col = ([r, g, b]: RGBA, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${Math.max(0, Math.min(1, a)).toFixed(3)})`
export const mix = (a: RGBA, b: RGBA, t: number): RGBA => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, 1]

export interface Pal {
  dark: boolean
  ink: RGBA
  ink2: RGBA
  ink3: RGBA
  paper: RGBA
  paper2: RGBA
  card: RGBA
  stone: RGBA
  stone2: RGBA
  stone3: RGBA
  moss: RGBA
  moss2: RGBA
  mossSoft: RGBA
  ver: RGBA
  verSoft: RGBA
}
export function readPal(): Pal {
  const v = (n: string) => rgba(cssVar(n))
  return {
    dark: document.documentElement.dataset.theme === 'dark',
    ink: v('--ink'),
    ink2: v('--ink-2'),
    ink3: v('--ink-3'),
    paper: v('--paper'),
    paper2: v('--paper-2'),
    card: v('--card'),
    stone: v('--stone'),
    stone2: v('--stone-2'),
    stone3: v('--stone-3'),
    moss: v('--moss'),
    moss2: v('--moss-2'),
    mossSoft: v('--moss-soft'),
    ver: v('--vermilion'),
    verSoft: v('--vermilion-soft'),
  }
}

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Catmull-Rom spline through pts, n+1 samples. */
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

/**
 * A filled brush stroke along pts: quick press (`head`), long taper (`tail`), never thinner than `min`.
 * `wob` adds a slow tremble of the width so it reads as a hand-made stroke.
 */
export function brush(g: CanvasRenderingContext2D, pts: Pt[], w: number, o: { head?: number; tail?: number; min?: number; wob?: number; seed?: number; upTo?: number } = {}) {
  const n = Math.max(16, (pts.length - 1) * 16)
  const P = spline(pts, n)
  const head = o.head ?? 0.12
  const tail = o.tail ?? 0.7
  const min = o.min ?? 0.12
  const wob = o.wob ?? 0.12
  const sd = o.seed ?? 1
  const last = Math.max(1, Math.round(n * (o.upTo ?? 1)))
  const L: Pt[] = [], R: Pt[] = []
  for (let i = 0; i <= last; i++) {
    const p = P[i]
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n, i + 1)]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    const nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len
    const t = i / n
    const f = t < head ? Math.sqrt(Math.sin((t / head) * Math.PI * 0.5)) : Math.pow(Math.cos(((t - head) / (1 - head)) * Math.PI * 0.5), tail)
    const tremble = 1 + wob * (Math.sin(t * 23 + sd) * 0.6 + Math.sin(t * 57 + sd * 3) * 0.4)
    const hw = (w / 2) * Math.max(min, f) * tremble
    L.push([p[0] + nx * hw, p[1] + ny * hw])
    R.push([p[0] - nx * hw, p[1] - ny * hw])
  }
  g.beginPath()
  g.moveTo(L[0][0], L[0][1])
  for (let i = 1; i < L.length; i++) g.lineTo(L[i][0], L[i][1])
  for (let i = R.length - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1])
  g.closePath()
  g.fill()
}

/** Soft, feathered ink wash (elliptical radial gradient). */
export function wash(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, c: RGBA, a: number, soft = 0.3) {
  if (rx < 0.5 || ry < 0.5 || a <= 0) return
  g.save()
  g.translate(x, y)
  g.scale(1, ry / rx)
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx)
  gr.addColorStop(0, col(c, a))
  gr.addColorStop(soft, col(c, a * 0.85))
  gr.addColorStop(0.7, col(c, a * 0.32))
  gr.addColorStop(1, col(c, 0))
  g.fillStyle = gr
  g.beginPath()
  g.arc(0, 0, rx, 0, Math.PI * 2)
  g.fill()
  g.restore()
}

/** One raked furrow: a wavy line whose width swells and thins, broken like a brush running dry. */
export function furrow(g: CanvasRenderingContext2D, y0: number, x0: number, x1: number, hw: number, amp: number, k: number) {
  if (x1 - x0 < 6) return
  const n = Math.max(4, Math.round((x1 - x0) / 9))
  const top: Pt[] = [], bot: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const u = i / n
    const x = x0 + (x1 - x0) * u
    const y = y0 + Math.sin(x * 0.009 + k * 0.7) * amp + Math.sin(x * 0.027 + k) * amp * 0.35
    const w = hw * Math.pow(Math.sin(Math.PI * u), 0.6) * (0.75 + 0.25 * Math.sin(x * 0.045 + k))
    top.push([x, y - w])
    bot.push([x, y + w])
  }
  g.beginPath()
  g.moveTo(top[0][0], top[0][1])
  for (let i = 1; i < top.length; i++) g.lineTo(top[i][0], top[i][1])
  for (let i = bot.length - 1; i >= 0; i--) g.lineTo(bot[i][0], bot[i][1])
  g.closePath()
  g.fill()
}

export interface Ring {
  x: number
  y: number
  /** half-width of the stone group (screen px) */
  rx: number
  /** half-depth of the innermost ring (screen px); defaults to a shallow stadium */
  ry?: number
}

/** A stadium-like loop (superellipse) around a stone group, seen in perspective. */
function loop(r: Ring, grow: number, n = 72): Pt[] {
  const rx = r.rx + grow
  const ry = (r.ry ?? Math.min(26, 10 + r.rx * 0.12)) + grow * 0.34
  const pts: Pt[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const c = Math.cos(a), sn = Math.sin(a)
    pts.push([r.x + Math.sign(c) * Math.pow(Math.abs(c), 0.62) * rx, r.y + Math.sign(sn) * Math.pow(Math.abs(sn), 0.9) * ry])
  }
  return pts
}

/**
 * A raked sand bed seen slightly from above, drawn in screen space.
 * `y` is the line stones rest on; furrows run behind (up to `back`) and in front (down to `front`).
 * Around each ring centre the furrows part and curve into concentric rings, like sand raked around a rock.
 */
export function sandBed(g: CanvasRenderingContext2D, pal: Pal, o: { x0: number; x1: number; y: number; back: number; front: number; rows: number; rings: Ring[]; seed?: number; alpha?: number }) {
  const { x0, x1, y, back, front, rows, rings } = o
  const A = o.alpha ?? 1
  const sd = o.seed ?? 3
  const span = x1 - x0
  const cx = (x0 + x1) / 2
  // the bed itself: a feathered wash, slightly cooler than the paper
  const bedC = pal.dark ? mix(pal.paper2, pal.moss2, 0.12) : mix(pal.paper2, pal.stone2, 0.35)
  wash(g, cx, y + (front - back) * 0.1, span * 0.56, (front + back) * 0.9, bedC, (pal.dark ? 0.85 : 0.75) * A, 0.45)
  g.save()
  if (rings.length) {
    g.beginPath()
    g.rect(x0 - 50, y - back - 40, span + 100, back + front + 80)
    for (const r of rings) loop(r, 36).forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)))
    g.clip('evenodd')
  }
  const ink = pal.ink3
  for (let k = 0; k < rows; k++) {
    const f = k / (rows - 1) // 0 = far back, 1 = front
    const yy = y - back + (back + front) * Math.pow(f, 1.35)
    const near = 0.25 + 0.75 * f
    const half = span * (0.4 + 0.1 * Math.sin(k * 1.7 + sd)) * (0.82 + 0.18 * f)
    g.fillStyle = col(ink, ((pal.dark ? 0.16 : 0.15) + near * (pal.dark ? 0.16 : 0.2)) * A)
    // broken into a few long strokes
    let segStart = -1
    const xa = cx - half, xb = cx + half
    for (let x = xa; x <= xb + 8; x += 8) {
      const on = x <= xb && Math.sin(x * 0.008 + k * 2.3 + sd) + Math.sin(x * 0.031 - k + sd) * 0.45 > -0.6
      if (on && segStart < 0) segStart = x
      if (!on && segStart >= 0) {
        furrow(g, yy, segStart, x, 0.3 + near * 1.05, 0.6 + near * 1.4, k + sd)
        segStart = -1
      }
    }
  }
  g.restore()
  // rings: three concentric, a little uneven, thicker in front
  for (const r of rings) {
    for (let j = 0; j < 3; j++) {
      const P = loop(r, 8 + j * 12)
      g.fillStyle = col(ink, (pal.dark ? 0.32 : 0.34) * A * (1 - j * 0.16))
      const outer: Pt[] = [], inner: Pt[] = []
      P.forEach(([px, py], i) => {
        const a = (i / P.length) * Math.PI * 2
        const fr = (Math.sin(a) + 1) / 2 // 1 at the front of the ring
        const w = 0.35 + fr * 0.95
        const dx = px - r.x, dy = (py - r.y) * 2.4
        const len = Math.hypot(dx, dy) || 1
        outer.push([px + (dx / len) * w, py + (dy / len) * w * 0.8])
        inner.push([px - (dx / len) * w, py - (dy / len) * w * 0.8])
      })
      g.beginPath()
      outer.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)))
      g.closePath()
      inner.reverse().forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)))
      g.closePath()
      g.fill('evenodd')
    }
  }
}
