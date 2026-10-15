// Tiny sumi-e toolkit for Canvas2D: colours, seeded noise, splines and a bristle brush.

export type RGB = [number, number, number]
export interface Pt {
  x: number
  y: number
}

export function parseColor(c: string): RGB {
  c = c.trim()
  if (c.startsWith('#')) {
    let hex = c.slice(1)
    if (hex.length <= 4) hex = [...hex].map((x) => x + x).join('')
    const n = parseInt(hex.slice(0, 6), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const m = c.match(/[\d.]+/g)
  return m ? [+m[0], +m[1], +m[2]] : [0, 0, 0]
}
export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
export const rgba = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${+a.toFixed(3)})`

/** mulberry32 — the same seed paints the same tree every time. */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Smooth 1-D value noise in [0, 1]. */
export function noise1(seed: number) {
  const r = rng(seed)
  const tab = Array.from({ length: 256 }, r)
  return (x: number) => {
    const i = Math.floor(x)
    const f = x - i
    const a = tab[i & 255]
    const b = tab[(i + 1) & 255]
    return a + (b - a) * f * f * (3 - 2 * f)
  }
}

export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

/** Catmull-Rom through pts, resampled to an even arc-length step (px). */
export function spline(pts: Pt[], step: number): Pt[] {
  const raw: Pt[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    for (let k = 0; k < 24; k++) {
      const t = k / 24
      const t2 = t * t
      const t3 = t2 * t
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
      raw.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) })
    }
  }
  raw.push(pts[pts.length - 1])
  const out: Pt[] = [raw[0]]
  let acc = 0
  for (let i = 1; i < raw.length; i++) {
    const a = raw[i - 1]
    const b = raw[i]
    let d = Math.hypot(b.x - a.x, b.y - a.y)
    let from = a
    while (acc + d >= step) {
      const t = (step - acc) / d
      const p = { x: from.x + (b.x - from.x) * t, y: from.y + (b.y - from.y) * t }
      out.push(p)
      d -= step - acc
      from = p
      acc = 0
    }
    acc += d
  }
  const last = raw[raw.length - 1]
  if (Math.hypot(last.x - out[out.length - 1].x, last.y - out[out.length - 1].y) > step * 0.3) out.push(last)
  return out
}

export function normals(path: Pt[]): Pt[] {
  return path.map((_, i) => {
    const a = path[Math.max(0, i - 1)]
    const b = path[Math.min(path.length - 1, i + 1)]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const l = Math.hypot(dx, dy) || 1
    return { x: -dy / l, y: dx / l }
  })
}

// ───────── The big brush: trunk, branches, the pot's rim ─────────

export interface SumiOpts {
  color: RGB
  /** opacity of the loaded stroke */
  alpha: number
  seed: number
  /** 0..1: how much the brush runs dry (flying white), more toward the tip */
  dry: number
  /** which normal side faces away from the light (gets the pressed dark edge) */
  side: number
  /** paper colour, for the flying white */
  paper: RGB
}

/**
 * One sumi-e stroke of width W[k] along an evenly sampled path, painted the way a loaded brush leaves it:
 * a pale wash that bleeds at the edges, then the hairs — dozens of fine streaks whose ink runs out in patches
 * (flying white), grouped across neighbouring hairs, more on the lit side and toward the tip — and a pressed,
 * slightly ragged dark edge on the shadow side. Tones change along the stroke, never in hard bands across it.
 */
export function sumi(g: CanvasRenderingContext2D, path: Pt[], W: number[], o: SumiOpts) {
  const n = path.length
  if (n < 2) return
  const nm = normals(path)
  const sd = o.side
  const r = rng(o.seed)
  const nzA = noise1(o.seed * 13 + 1)
  const nzB = noise1(o.seed * 7 + 2)
  const nzD = noise1(o.seed * 5 + 3)
  const nzH = noise1(o.seed * 3 + 4)
  const step = Math.hypot(path[1].x - path[0].x, path[1].y - path[0].y) || 1
  const total = step * (n - 1)
  const maxW = Math.max(...W)
  const a = o.alpha
  const P = (k: number, u: number) => {
    const off = u * W[k] * 0.5 * sd
    return { x: path[k].x + nm[k].x * off, y: path[k].y + nm[k].y * off }
  }
  // ragged edges: the lit side breaks more than the pressed shadow side
  const eL = (k: number) => -(0.84 + 0.16 * nzA((k * step) / 7))
  const eS = (k: number) => 0.92 + 0.08 * nzB((k * step) / 9)
  const shape = (u0: (k: number) => number, u1: (k: number) => number) => {
    g.beginPath()
    for (let k = 0; k < n; k++) {
      const p = P(k, u1(k))
      g.lineTo(p.x, p.y)
    }
    for (let k = n - 1; k >= 0; k--) {
      const p = P(k, u0(k))
      g.lineTo(p.x, p.y)
    }
    g.closePath()
  }
  const band = (u0: (k: number) => number, u1: (k: number) => number, al: number) => {
    shape(u0, u1)
    g.fillStyle = rgba(o.color, al)
    g.fill()
  }
  /** thin strokes read as one dark line; broad ones as a wash full of hair marks */
  const solid = 1 - clamp((maxW - 3) / 34)
  g.save()
  // 1 · the wash the hairs leave behind, feathered so the edge bleeds instead of cutting
  for (const [f, al] of [[1, 0.13], [0.9, 0.11], [0.74, 0.1]] as const) band((k) => eL(k) * f, (k) => eS(k) * f, a * (al + solid * 0.1))
  // the shadow side holds more ink: a noise-edged band, feathered by two half-strength passes either side
  const sh = (d: number) => (k: number) => 0.06 + 0.3 * nzA((k * step) / 29 + 7) + d
  band(sh(0), eS, a * 0.14)
  band(sh(0.06), eS, a * 0.07)
  band(sh(-0.06), eS, a * 0.07)
  // 2 · the hairs
  g.lineCap = 'round'
  g.lineJoin = 'round'
  const N = clamp(Math.round(maxW / 1.6), 4, 48)
  for (let i = 0; i < N; i++) {
    const u0 = -1 + (2 * (i + 0.5)) / N + (r() - 0.5) * (1.1 / N)
    const shadowK = smooth(0.1, 1, u0)
    const base = a * (0.2 + 0.42 * shadowK + 0.4 * solid) * (0.75 + 0.5 * r())
    const lwF = (1 / N) * (1.1 + r() * 0.9)
    const edge = Math.abs(u0) > 0.8
    const ph = r() * 100
    const dryBias = u0 < 0 ? 1.3 : 0.8
    const fq = 7 + 7 * r()
    const vis = (k: number) => {
      const t = k / (n - 1)
      // dry patches are shared by neighbouring hairs (small offset per hair), so the paper shows in streaks
      const dry = o.dry * dryBias * (0.2 + 0.95 * t) * (0.35 + 1.1 * nzD((k * step) / 50 + i * 0.05))
      const v = nzB((k * step) / fq + ph)
      return v > dry * 0.9 - 0.08
    }
    const at = (k: number) => P(k, edge ? u0 + (nzH((k * step) / 5 + ph) - 0.5) * 0.12 : u0)
    // one path per run of ink, broken where the hair skips
    let k = 0
    while (k < n) {
      while (k < n && !vis(k)) k++
      const k0 = k
      const lim = k0 + Math.max(4, Math.round((24 + r() * 40) / step))
      while (k < n && k < lim && vis(k)) k++
      if (k - k0 < 2) continue
      const km = (k0 + k) >> 1
      const lw = W[km] * lwF
      const fade = 1 - 0.3 * (km / (n - 1))
      const al = base * fade * (0.7 + 0.6 * nzA((km * step) / 31 + ph)) * Math.min(1, lw / 0.45)
      g.beginPath()
      for (let j = k0; j < k; j++) {
        const p = at(j)
        g.lineTo(p.x, p.y)
      }
      g.lineWidth = Math.max(0.45, lw)
      g.strokeStyle = rgba(o.color, Math.min(1, al))
      g.stroke()
    }
  }
  // 3 · the pressed edge on the shadow side: dark, thin, a little ragged
  const pe = (d: number) => (k: number) => 0.78 + 0.1 * nzA((k * step) / 13 + 3) + d
  band(pe(0), eS, a * (0.32 + solid * 0.2))
  band(pe(0.07), eS, a * 0.16)
  // and a thinner, broken contour on the lit side
  const le = (d: number) => (k: number) => eL(k) + 0.07 + 0.09 * nzH((k * step) / 17 + 40) + d
  band(eL, le(0), a * 0.2)
  band(eL, le(0.06), a * 0.1)
  // 4 · wet pools where the ink gathered and dried darker (inside the stroke)
  shape(eL, eS)
  g.clip()
  for (let i = 0, m = Math.round(total / 60); i < m; i++) {
    const k = Math.floor(r() * n)
    const p = P(k, -0.1 + r() * 0.9)
    const rr = W[k] * (0.25 + r() * 0.3)
    const sg = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr * 1.6)
    sg.addColorStop(0, rgba(o.color, a * (0.06 + r() * 0.08)))
    sg.addColorStop(1, rgba(o.color, 0))
    g.fillStyle = sg
    g.save()
    g.translate(p.x, p.y)
    const b = path[Math.min(n - 1, k + 1)]
    const q = path[Math.max(0, k - 1)]
    g.rotate(Math.atan2(b.y - q.y, b.x - q.x))
    g.scale(2.6, 1)
    g.translate(-p.x, -p.y)
    g.fillRect(p.x - rr * 1.6, p.y - rr * 1.6, rr * 3.2, rr * 3.2)
    g.restore()
  }
  // 5 · a few long streaks of bare paper where the brush ran driest (lit side, toward the tip)
  const streaks = Math.round((total / 70) * o.dry)
  for (let i = 0; i < streaks; i++) {
    const k0 = Math.floor((0.25 + 0.7 * r()) * (n - 2))
    if (W[k0] < 6) continue
    const k1 = Math.min(n - 1, k0 + Math.round((20 + r() * 50) / step))
    const u = -0.9 + r() * 0.9
    g.beginPath()
    for (let k = k0; k <= k1; k++) {
      const p = P(k, u + (k - k0) * 0.0015)
      g.lineTo(p.x, p.y)
    }
    g.lineWidth = Math.max(0.5, W[k0] * (0.015 + r() * 0.03))
    g.strokeStyle = rgba(o.paper, 0.14 + r() * 0.22)
    g.stroke()
  }
  g.restore()
}

// ───────── Small brushwork: tapered strokes, dabs and wash blots (pictograms, twigs, stems) ─────────

export interface InkLineOpts {
  /** full width at the belly of the stroke, px */
  w: number
  color: RGB
  alpha?: number
  /** width factor where the brush touches down (0..1) */
  head?: number
  /** width factor at the lifted tip (0..1) */
  tail?: number
  /** draw only the first part (0..1) — a stroke being written */
  upTo?: number
  seed?: number
}

const lineNoise = noise1(4242)
/** One brush stroke through pts: touches down, swells, lifts to a tip. Filled shape, not a hairline. */
export function inkLine(g: CanvasRenderingContext2D, pts: Pt[], o: InkLineOpts) {
  const upTo = o.upTo ?? 1
  if (upTo <= 0 || pts.length < 2) return
  const full = spline(pts, Math.max(0.35, o.w * 0.22))
  const n = Math.max(2, Math.round(full.length * Math.min(1, upTo)))
  const path = full.slice(0, n)
  if (path.length < 2) return
  const nm = normals(path)
  const head = o.head ?? 0.7
  const tail = o.tail ?? 0.18
  const sd = (o.seed ?? 0) * 13.7
  const N = full.length - 1
  const wAt = (k: number) => {
    const t = k / N
    const f = t < 0.12 ? head + (1 - head) * smooth(0, 0.12, t) : t > 0.55 ? 1 + (tail - 1) * smooth(0.55, 1, t) : 1
    return o.w * f * (0.92 + 0.16 * lineNoise(sd + k * 0.15))
  }
  const fill = (scale: number, shift: number, alpha: number) => {
    g.beginPath()
    for (let k = 0; k < path.length; k++) {
      const w = wAt(k) * 0.5
      g.lineTo(path[k].x + nm[k].x * (w * scale + shift * w), path[k].y + nm[k].y * (w * scale + shift * w))
    }
    for (let k = path.length - 1; k >= 0; k--) {
      const w = wAt(k) * 0.5
      g.lineTo(path[k].x - nm[k].x * (w * scale - shift * w), path[k].y - nm[k].y * (w * scale - shift * w))
    }
    g.closePath()
    g.fillStyle = rgba(o.color, alpha)
    g.fill()
  }
  const a = o.alpha ?? 1
  fill(1, 0, a * 0.82)
  // the loaded core of the brush, leaning to one side
  fill(0.5, 0.3, a * 0.3)
  // round touch-down
  const w0 = wAt(0) * 0.5
  g.beginPath()
  g.arc(path[0].x, path[0].y, w0, 0, Math.PI * 2)
  g.fillStyle = rgba(o.color, a * 0.82)
  g.fill()
}

/** A small ragged ink dot. */
export function dab(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: RGB, alpha: number, seed = 0) {
  g.beginPath()
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2
    const rr = r * (0.84 + 0.2 * lineNoise(seed * 7.3 + i * 0.9))
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.92)
  }
  g.closePath()
  g.fillStyle = rgba(color, alpha)
  g.fill()
}

/** Soft ink-wash blot: a bleeding edge, pigment settled toward the bottom and a broken dried line there (cached, 4 shapes per colour). */
const washes = new Map<string, HTMLCanvasElement>()
export function wash(color: RGB, rim: RGB, variant: number): HTMLCanvasElement {
  const v = variant & 3
  const key = `${color.map((c) => c | 0).join(',')}|${rim.map((c) => c | 0).join(',')}|${v}`
  let c = washes.get(key)
  if (c) return c
  const S = 128
  c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  const nz = noise1(171 + v * 19)
  const pts = (rad: number, j: number) =>
    Array.from({ length: 61 }, (_, i) => {
      const a = (i / 60) * Math.PI * 2
      const rr = rad * (0.8 + 0.2 * nz(i * 0.22 + j * 3.1) + 0.05 * Math.sin(a * 3 + v))
      return { x: S / 2 + Math.cos(a) * rr, y: S / 2 + Math.sin(a) * rr, a }
    })
  const shape = (rad: number, j: number) => {
    g.beginPath()
    for (const p of pts(rad, j)) g.lineTo(p.x, p.y)
    g.closePath()
  }
  // layered translucent shapes make a soft, bleeding edge
  for (let j = 0; j < 6; j++) {
    shape(S * (0.47 - j * 0.04), j)
    g.fillStyle = rgba(color, 0.27)
    g.fill()
  }
  // pigment settles toward the lower edge as the wash dries
  g.save()
  shape(S * 0.47, 0)
  g.clip()
  const lg = g.createLinearGradient(0, S * 0.45, 0, S * 0.97)
  lg.addColorStop(0, rgba(rim, 0))
  lg.addColorStop(1, rgba(rim, 0.3))
  g.fillStyle = lg
  g.fillRect(0, 0, S, S)
  g.restore()
  // a broken dried line along the lower part of the edge
  const edge = pts(S * 0.465, 0)
  g.lineCap = 'round'
  for (let i = 1; i < edge.length; i++) {
    const a = edge[i].a
    const k = Math.sin(a) // 1 at the bottom
    if (k < 0.15) continue
    g.beginPath()
    g.moveTo(edge[i - 1].x, edge[i - 1].y)
    g.lineTo(edge[i].x, edge[i].y)
    g.lineWidth = S * 0.014
    g.strokeStyle = rgba(rim, 0.4 * k * (0.55 + 0.45 * nz(i * 0.7 + 40)))
    g.stroke()
  }
  if (washes.size > 60) washes.clear()
  washes.set(key, c)
  return c
}

/** Soft dab sprites (radial gradients) cached per colour. `wet` has a darker rim like a dried wash. */
const sprites = new Map<string, HTMLCanvasElement>()
export function sprite(color: RGB, wet: boolean): HTMLCanvasElement {
  const key = `${color.map((c) => c | 0).join(',')}|${wet}`
  let c = sprites.get(key)
  if (c) return c
  c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  if (wet) {
    gr.addColorStop(0, rgba(color, 0.62))
    gr.addColorStop(0.6, rgba(color, 0.7))
    gr.addColorStop(0.85, rgba(color, 0.8))
    gr.addColorStop(1, rgba(color, 0))
  } else {
    gr.addColorStop(0, rgba(color, 1))
    gr.addColorStop(0.45, rgba(color, 0.75))
    gr.addColorStop(1, rgba(color, 0))
  }
  g.fillStyle = gr
  g.fillRect(0, 0, 64, 64)
  if (sprites.size > 80) sprites.clear()
  sprites.set(key, c)
  return c
}

/** Irregular ink-wash blotch (ragged edge, a little granulation) — 4 variants per colour. */
const blotches = new Map<string, HTMLCanvasElement>()
/** its edge noise, built once per variant (a foliage pad asks for hundreds of blotches, nearly every one a new colour) */
const blotchNz = [0, 1, 2, 3].map((v) => noise1(71 + v * 13))
export function blotch(color: RGB, variant: number): HTMLCanvasElement {
  const v = variant & 3
  const key = `${color.map((c) => c | 0).join(',')}|${v}`
  let c = blotches.get(key)
  if (c) return c
  c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const nz = blotchNz[v]
  const r = rng(5 + v)
  g.beginPath()
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2
    const rr = 27 * (0.74 + 0.26 * nz(i * 0.35 + v * 9))
    g.lineTo(32 + Math.cos(a) * rr, 32 + Math.sin(a) * rr)
  }
  g.closePath()
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 30)
  gr.addColorStop(0, rgba(color, 0.95))
  gr.addColorStop(0.7, rgba(color, 0.75))
  gr.addColorStop(1, rgba(color, 0.35))
  g.fillStyle = gr
  g.fill()
  // granulation: pigment settling in the paper
  g.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < 70; i++) {
    g.fillStyle = `rgba(0,0,0,${(0.1 + r() * 0.25).toFixed(2)})`
    g.fillRect(4 + r() * 56, 4 + r() * 56, 1 + r() * 2, 1 + r() * 2)
  }
  if (blotches.size > 120) blotches.clear()
  blotches.set(key, c)
  return c
}

