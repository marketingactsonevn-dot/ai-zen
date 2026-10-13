import { nextId, s } from '../../core/dom'
import type { gsap } from '../../core/anim'

/** Sumi-e toolkit: tapered brush strokes as filled outlines, ink washes, and a mask that lets strokes draw themselves. */
export type Pt = [number, number]
export type TL = ReturnType<typeof gsap.timeline>

const f1 = (n: number) => Math.round(n * 10) / 10
const P = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`

export const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
export const poly = (pts: Pt[]) => `M${pts.map(P).join('L')}Z`
export const ell = (cx: number, cy: number, rx: number, ry = rx) => `M${f1(cx - rx)} ${f1(cy)}a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(2 * rx)} 0a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(-2 * rx)} 0Z`
export const rect = (x: number, y: number, w: number, h: number): Pt[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]
export const rrD = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`

/** Points on an ellipse arc, angles in degrees (0 = right, 90 = down). */
export function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 24): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as Pt
  })
}

/** A rounded rectangle traced as one brush loop that overlaps where it started. */
export function rrPts(x: number, y: number, w: number, h: number, r: number): Pt[] {
  return [
    [x + r + 4, y],
    ...arc(x + w - r, y + r, r, r, -90, 0, 4),
    ...arc(x + w - r, y + h - r, r, r, 0, 90, 4),
    ...arc(x + r, y + h - r, r, r, 90, 180, 4),
    ...arc(x + r, y + r, r, r, 180, 270, 4),
    [x + r + 12, y - 0.5],
  ]
}

/** Hand-writing squiggle (loops like cursive) from x0 to x1 on baseline y. */
export function cursive(x0: number, y: number, x1: number, amp = 5, seed = 0): Pt[] {
  const out: Pt[] = []
  for (let t = 0; t <= x1 - x0; t += 2) {
    const k = t * 0.55 + seed
    out.push([x0 + t + 3 * Math.cos(k), y - amp * Math.sin(k) * (0.65 + 0.35 * Math.sin(t * 0.11 + seed))])
  }
  return out
}

/** Deterministic random for landscapes (mulberry32). */
export function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Ink-wash mountain silhouettes standing on `base` between x0 and x1. */
export function peaks(r: () => number, x0: number, x1: number, base: number, hMin: number, hMax: number, step: number) {
  const out: { d: string; mx: number; hgt: number; hw: number }[] = []
  for (let mx = x0; mx < x1; mx += step * (0.6 + r() * 0.8)) {
    const hgt = hMin + r() * (hMax - hMin)
    const hw = hgt * (1.1 + r() * 0.9)
    const pts: Pt[] = []
    for (let i = 0; i <= 16; i++) {
      const u = 1 - Math.abs((i / 16) * 2 - 1)
      pts.push([mx - hw + (i / 8) * hw, base - hgt * u ** (1.35 + r() * 0.2) + (i % 16 ? (r() - 0.5) * hgt * 0.06 : 0)])
    }
    out.push({ d: poly(pts), mx, hgt, hw })
  }
  return out
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
  /** share of the length used to press in (0 = blunt start) */
  a?: number
  /** share of the length used to lift off */
  b?: number
  /** thinnest the tips get, as a share of w */
  min?: number
  /** pressure wobble */
  wob?: number
  straight?: boolean
  cls?: string
  /** not drawn by the automatic sequence; an extra animates it */
  late?: boolean
  /** extra width factor along the stroke (t = 0…1, point) */
  wf?: (t: number, p: Pt) => number
}

/** Filled outline of a tapered stroke along pts + its centreline. */
export function brush(pts: Pt[], w: number, o: LineOpt = {}) {
  const C = spline(pts, o.straight)
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
    const k = Math.max(min, Math.sqrt(Math.min(1, a ? t / a : 1))) * Math.max(min, Math.min(1, b ? (1 - t) / b : 1) ** 0.7) * (1 + wob * Math.sin(t * 11 + w * 3)) * (o.wf ? o.wf(t, C[i]) : 1)
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

/**
 * A pine bough along `pts` (w = its width at the root): a knotted dry stroke, short twigs, and fans of
 * needles over soft foliage pads, the way sumi-e paints pine. Returns path data to colour as you like.
 */
export function pine(r: () => number, pts: Pt[], w: number, n = 4) {
  const out = { bough: brush(pts, w, { a: 0.03, b: 0.8, min: 0.12, wob: 0.22 }).d, twigs: [] as string[], pads: [] as string[], needles: [] as string[] }
  const L = w * 3.4
  for (let i = 0; i < n; i++) {
    const u = (0.28 + (0.7 * i) / Math.max(1, n - 1)) * (pts.length - 1)
    const base = lerp(pts[Math.floor(u)], pts[Math.min(pts.length - 1, Math.floor(u) + 1)], u % 1)
    const up = i % 3 === 2 ? 0.55 : -1
    const c: Pt = [base[0] + (r() - 0.5) * w * 2.4, base[1] + up * w * (1.6 + r() * 1.4)]
    const sz = L * (1 - i * 0.12)
    out.twigs.push(brush([base, lerp(base, c, 0.5).map((v, k) => v + (k ? -w * 0.3 : w * 0.3)) as Pt, c], w * 0.32, { a: 0.05, b: 0.5 }).d)
    out.pads.push(ell(c[0], c[1] - sz * 0.25, sz * 1.25, sz * 0.62))
    const m = 11
    for (let k = 0; k < m; k++) {
      const a = ((-172 + (164 * k) / (m - 1) + (r() - 0.5) * 9) * Math.PI) / 180
      const len = sz * (0.7 + r() * 0.4) * (0.75 + 0.25 * Math.sin((k / (m - 1)) * Math.PI))
      out.needles.push(brush([[c[0] + Math.cos(a) * sz * 0.12, c[1] + Math.sin(a) * sz * 0.12], [c[0] + Math.cos(a) * len, c[1] + Math.sin(a) * len]], Math.max(0.6, w * 0.16), { straight: true, a: 0.04, b: 0.8, min: 0.1, wob: 0 }).d)
    }
  }
  return out
}

interface Layer {
  outer: SVGGElement
  wash: SVGGElement
  dry: SVGGElement
  solid: SVGGElement
  ink: SVGGElement
  mask?: SVGMaskElement
}
export interface Line {
  el: SVGPathElement
  /** the mask stroke (live pens only): tween its strokeDashoffset 1 → 0 to draw */
  m?: SVGPathElement
}

/**
 * A pen draws one illustration into `root`. A live pen keeps a mask per layer so the strokes can be
 * revealed in order (drawIn); a ghost pen draws the same picture statically, for the quiet state.
 * Ghosts are cheap: one ink-rough filter on the whole picture (`fx: 'root'`) or none (`fx: 'none'`).
 */
export class Pen {
  readonly root = s('g', { class: 'v-art' })
  readonly draws: { m: SVGPathElement; len: number }[] = []
  readonly fades: SVGElement[] = []
  private readonly defs = s('defs')
  private readonly main: Layer
  private cur: Layer

  constructor(readonly live: boolean, private readonly fx: 'full' | 'root' | 'none' = 'full') {
    if (fx === 'root') this.root.setAttribute('filter', 'url(#ink-rough)')
    this.root.append(this.defs)
    this.main = this.cur = this.layer()
  }

  private layer(transform?: string): Layer {
    const f = (id: string) => (this.fx === 'full' ? { filter: `url(#${id})` } : null)
    const outer = s('g', { transform })
    const wash = s('g', f('ink-wash'))
    const dry = s('g', f('ink-dry'))
    const solid = s('g', f('ink-rough'))
    const ink = s('g', f('ink-rough'))
    let mask: SVGMaskElement | undefined
    if (this.live) {
      const id = nextId('t3m')
      mask = s('mask', { id, maskUnits: 'userSpaceOnUse', x: -120, y: -120, width: 540, height: 540 })
      this.defs.append(mask)
      ink.setAttribute('mask', `url(#${id})`)
      this.fades.push(wash, dry, solid)
    }
    outer.append(wash, dry, solid, ink)
    this.root.append(outer)
    return { outer, wash, dry, solid, ink, mask }
  }

  /** Start a separately movable layer (its mask moves with it). */
  sub(transform?: string): SVGGElement {
    this.cur = this.layer(transform)
    return this.cur.outer
  }
  back() {
    this.cur = this.main
  }

  line(pts: Pt[], w: number, o: LineOpt = {}): Line {
    const { d, c, len } = brush(pts, w, o)
    const el = s('path', { d, class: o.cls ?? 'k' })
    this.cur.ink.append(el)
    if (!this.cur.mask) return { el }
    const m = s('path', { d: c, pathLength: 1, 'stroke-width': f1(w * 1.4 + 6), class: 'v-m' })
    this.cur.mask.append(m)
    if (!o.late) this.draws.push({ m, len })
    return { el, m }
  }

  wash(d: string, op = 0.12, cls = 'k') {
    const el = s('path', { d, class: cls, 'fill-opacity': op })
    this.cur.wash.append(el)
    return el
  }

  /** Dry-brush texture (streaky, broken edges): ridges, bark, the grain of a stroke. */
  dry(d: string, op = 0.5, cls = 'k') {
    const el = s('path', { d, class: cls, 'fill-opacity': op })
    this.cur.dry.append(el)
    return el
  }

  solid(d: string, cls = 'k', into?: SVGElement) {
    const el = s('path', { d, class: cls })
    ;(into ?? this.cur.solid).append(el)
    return el
  }

  /** A plain group inside the current solid layer (for things an extra moves one by one). */
  group(): SVGGElement {
    const g = s('g')
    this.cur.solid.append(g)
    return g
  }

  /** In-picture words (live only — the quiet ghost shows no text). */
  text(str: string, x: number, y: number, size: number, cls = 'k'): SVGTextElement | null {
    if (!this.live) return null
    const el = s('text', { x, y, 'font-size': size, class: `v-t ${cls}`, 'text-anchor': 'middle' }, str)
    this.cur.outer.append(el)
    this.fades.push(el)
    return el
  }

  /** Something the picture owns but draws itself later (snow, a travelling dot): added on top. */
  top<T extends SVGElement>(el: T): T {
    this.root.append(el)
    return el
  }
}

/** Animate a live pen: strokes draw in order, then washes / solids / words fade up. Returns the end time. */
export function drawIn(pen: Pen, tl: TL, total = 1.7, at = 0): number {
  const sum = pen.draws.reduce((a, d) => a + d.len, 0) || 1
  let t = at
  for (const d of pen.draws) {
    const dur = 0.1 + (d.len / sum) * total
    tl.fromTo(d.m, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: dur, ease: 'power1.inOut' }, t)
    t += dur * 0.7
  }
  if (pen.fades.length) tl.fromTo(pen.fades, { opacity: 0 }, { opacity: 1, duration: 0.9, ease: 'power1.out' }, Math.max(at, t - 0.6))
  return t + 0.25
}

export interface Extra {
  /** add the picture's own story to the timeline after it is drawn (use fromTo so replays reset) */
  play?(tl: TL, at: number): void
  /** ambient loop while the picture is in focus; returns stop */
  loop?(): () => void
}
export type Picture = (p: Pen, words: Art) => Extra | void
export interface Art {
  mark: string
  words: string[]
  steps: string[]
}
