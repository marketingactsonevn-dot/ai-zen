import './glossary.css'
import data from '../content/glossary.json'
import { fill, h, s } from '../core/dom'
import { ALL_STATIONS, GARDENS, type Fact, type Garden } from '../core/content'
import { cssVar, onPrefs, prefs } from '../core/prefs'
import { gsap } from '../core/anim'
import { createLoop } from '../core/loop'
import { progress } from '../core/progress'
import { fact, tag } from '../ui/fact'
import { setCrumb } from '../ui/topbar'
import { octaves } from '../ui/ink'

interface Term {
  id: string
  term: string
  full?: string
  vi: string
  aka?: string[]
  def: string
  station: number
  kind?: 'prediction'
  key?: boolean
  fact?: Fact
}
const G = data as unknown as Omit<typeof data, 'terms'> & { terms: Term[] }

type Pt = [number, number]
/** Stone families: pale granite, warm river sandstone, a flat cool slate, and dark basalt for the anchor words. */
type Fam = 'granite' | 'sand' | 'slate' | 'basalt'
const SLATES = new Set(['mesh', 'skill'])
/** One dark anchor stone per big garden; the other key words are simply larger stones. */
const ANCHORS = new Set(['llm', 'token', 'diffusion', 'agent'])

interface Stone {
  t: Term
  i: number
  fam: Fam
  anchor: boolean
  key: boolean
  hay: string
  defN: string
  alts: string[]
  el: HTMLButtonElement
  body: HTMLElement
  ground: SVGSVGElement
  shadow: SVGEllipseElement
  cres: SVGPathElement
  label: HTMLElement
  alias: HTMLElement
  rock: SVGSVGElement
  ring: SVGSVGElement
  w1: number // one-line text width at REF px
  w2: number // widest word at REF px (0 = one word)
  two: boolean
  dome: boolean
  ly: number // label centre, as a share of the stone's height
  uw: number // size at f = 1
  uh: number
  ufk: number
  fk: number
  w: number
  h: number
  x: number
  y: number
  z: number
  shown: boolean
  defOnly: boolean
  aka: string
  shape: string
}
/** A small unnamed pebble that keeps a group of word stones company. */
interface Acc {
  seed: number
  fam: Fam
  uw: number
  uh: number
  w: number
  h: number
  x: number
  y: number
  el: SVGSVGElement
  shape: string
}
interface Item {
  w: number
  h: number
  acc: boolean
}
/** One way to gather an island's stones: centres relative to the group's top-left, at f = 1. */
interface Pack {
  pos: Pt[]
  cw: number
  ch: number
  top: number
}
interface Island {
  g: Garden
  stones: Stone[]
  acc: Acc[]
  packs: Pack[]
  peb: HTMLElement
  pebArt: SVGSVGElement
  name: HTMLElement
  nameW: number
  px: number
  py: number
  nx: number
}
interface Shape {
  pk: Pack
  cw: number
  ch: number
  capW: number
  capH: number
  w: number
  h: number
}
interface Band {
  ids: number[]
  sh: Shape[]
  w: number
  h: number
}
interface Plan {
  f: number
  bands: Band[]
  totalH: number
  sx: number
  sy: number
  score: number
}
/** A rounded box on the sand; the rakes keep their distance from it. */
interface Blob {
  cx: number
  cy: number
  hx: number
  hy: number
  r: number
}

const REF = 20
const TAU = Math.PI * 2
const N = 40 // contour samples per stone
const NAME = 0.84 // garden name size (× f)
/** Stone proportions (× f): roomy on wide screens, compact on phones and short screens. */
const SZ = {
  wide: { pad: 3.0, line: 2.85, two: 3.75, dome: 3.2, domeA: [1.16, 1.5], maxA: 2.4, anchor: 1.28, key: 1.18 },
  compact: { pad: 1.7, line: 2.25, two: 3.05, dome: 2.45, domeA: [1.08, 1.32], maxA: 2.9, anchor: 1.1, key: 1.06 },
}
const ASPECTS = [0.9, 1.25, 1.7, 2.3, 3.1, 4.2]
/** The numbered marker stone keeps a legible size on phones. */
const pebW = (ff: number) => Math.max(ff * 1.5, 20)
const nameFs = (ff: number) => Math.max(11.5, ff * NAME)
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const rnd = (k: number) => {
  const x = Math.sin(k * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}
/** Deterministic PRNG (mulberry32): the garden looks the same on every visit. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const norm = (t: string) =>
  t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, ' ').trim()
const f1 = (n: number) => Math.round(n * 10) / 10
const P = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`

/** Closed Catmull-Rom → cubic Bézier path. */
function closed(pts: Pt[]): string {
  const n = pts.length
  let d = `M${P(pts[0])}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n]
    d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${P(p2)}`
  }
  return d + 'Z'
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

/** A filled sumi-e stroke: quick press (`head`), long taper (`tail` < 1 keeps it fuller), never thinner than `min`. */
function brush(pts: Pt[], w: number, head = 0.14, tail = 0.7, min = 0.1): string {
  const n = Math.max(12, (pts.length - 1) * 12)
  const S = spline(pts, n)
  const L: Pt[] = [], R: Pt[] = []
  S.forEach((p, i) => {
    const a = S[Math.max(0, i - 1)], b = S[Math.min(n, i + 1)]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    const nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len
    const t = i / n
    const k = t < head ? Math.sqrt(Math.sin((t / head) * Math.PI * 0.5)) : Math.cos(((t - head) / (1 - head)) * Math.PI * 0.5) ** tail
    const hw = (w / 2) * Math.max(min, k)
    L.push([p[0] + nx * hw, p[1] + ny * hw])
    R.push([p[0] - nx * hw, p[1] - ny * hw])
  })
  return `M${L.map(P).join('L')}L${R.reverse().map(P).join('L')}Z`
}

/** A brush ring (ensō): one tapered stroke, pressed in, lifted off, never quite closed. */
function enso(cx: number, cy: number, r: number, w: number, a0 = -1.9, sweep = 5.6, ry = r): string {
  const n = 72
  const out: Pt[] = [], inn: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const a = a0 + sweep * t
    const press = Math.min(1, t / 0.07) * (1 - 0.82 * t ** 1.6)
    const ww = w * (0.18 + 0.82 * press) * (1 + 0.07 * Math.sin(t * 29))
    const k = 1 + 0.03 * Math.sin(t * 4.2 + 1)
    out.push([cx + Math.cos(a) * (r * k + ww / 2), cy + Math.sin(a) * (ry * k + ww / 2)])
    inn.push([cx + Math.cos(a) * (r * k - ww / 2), cy + Math.sin(a) * (ry * k - ww / 2)])
  }
  return `M${[...out, ...inn.reverse()].map(P).join('L')}Z`
}

/** A horizontal brush swash: pressed at the start, thinning to a dry tail. */
function swash(len: number, w: number, y: number, seed = 1): string {
  const n = 40
  const top: Pt[] = [], bot: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const x = 2 + t * (len - 4)
    const cy = y + Math.sin(t * 2.6 + seed) * w * 0.35 - t * w * 0.3
    const ww = w * Math.min(1, t / 0.06) * (1 - 0.86 * t ** 1.3) * (1 + 0.1 * Math.sin(t * 31 + seed))
    top.push([x, cy - ww / 2])
    bot.push([x, cy + ww / 2])
  }
  return `M${[...top, ...bot.reverse()].map(P).join('L')}Z`
}

/** A small irregular blob (moss clump, dot of lichen). */
function clump(cx: number, cy: number, r: number, seed: number): string {
  const R = rng(seed)
  const pts: Pt[] = []
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + R() * 0.5
    const k = 0.7 + R() * 0.45
    pts.push([cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k * 0.8])
  }
  return closed(pts)
}

/**
 * A garden stone's silhouette filling a w×h box, sampled clockwise from 3 o'clock:
 * a rounded or peaked crown with an off-centre summit, a heavy flat base, cut facets on the shoulders, a unique wobble.
 */
function rockPts(w: number, hh: number, seed: number, fam: Fam, dome = false): Pt[] {
  const r = rng(seed)
  const cx = w / 2, cy = hh / 2, rx = w / 2 - 1.2, ry = hh / 2 - 1.2
  const eTop = dome ? (fam === 'slate' ? 0.78 : 0.98 + r() * 0.2) : { granite: 0.86, sand: 0.96, slate: 0.6, basalt: 0.8 }[fam] + (r() - 0.5) * 0.22
  const eBot = { granite: 0.5, sand: 0.6, slate: 0.4, basalt: 0.46 }[fam]
  const skew = (r() - 0.5) * (dome ? 0.7 : 0.55)
  const tilt = fam === 'slate' ? (r() < 0.5 ? -1 : 1) * (0.1 + r() * 0.08) : (r() - 0.5) * 0.16
  const ph = [r() * TAU, r() * TAU, r() * TAU]
  const pts: Pt[] = []
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU
    const c = Math.cos(a), sn = Math.sin(a)
    const e = sn < 0 ? eTop : eBot
    let x = Math.sign(c) * Math.abs(c) ** e
    let y = Math.sign(sn) * Math.abs(sn) ** e
    if (sn < 0) {
      x += skew * (1 - Math.abs(x)) * -sn
      y += tilt * x * -sn
    }
    // a slow swell across the crown: one shoulder higher, a soft saddle, never a straight ridge
    const crown = sn < 0 ? 0.05 * -sn * Math.sin(2 * a + ph[1]) : 0
    const k = 1 + crown + 0.03 * Math.sin(3 * a + ph[0]) + 0.018 * Math.sin(5 * a + ph[1]) + 0.01 * Math.sin(7 * a + ph[2])
    pts.push([clamp(cx + rx * x * k, 0.8, w - 0.8), clamp(cy + ry * y * k, 0.8, hh - 0.8)])
  }
  const cuts = fam === 'basalt' ? [-1, 1] : fam === 'sand' ? [] : [r() < 0.5 ? -1 : 1]
  for (const side of cuts) {
    const ca = 1.5 * Math.PI + side * (0.55 + r() * 0.35)
    const hw = 0.2 + r() * 0.12
    const i0 = Math.round(((ca - hw) / TAU) * N), i1 = Math.round(((ca + hw) / TAU) * N)
    const A = pts[i0 % N], B = pts[i1 % N]
    for (let i = i0 + 1; i < i1; i++) {
      const t = (i - i0) / (i1 - i0)
      pts[i % N] = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]
    }
  }
  return pts
}
const idx = (i: number) => ((i % N) + N) % N
/** Outward unit normal at contour sample i. */
function nrm(pts: Pt[], i: number): Pt {
  const a = pts[idx(i - 1)], b = pts[idx(i + 1)]
  const tx = b[0] - a[0], ty = b[1] - a[1]
  const l = Math.hypot(tx, ty) || 1
  return [ty / l, -tx / l]
}
/** Contour samples between two angles, each pushed out (d > 0) or in (d < 0) along its normal. */
function along(pts: Pt[], a0: number, a1: number, d: (t: number) => number): Pt[] {
  const i0 = Math.round((a0 / TAU) * N), i1 = Math.round((a1 / TAU) * N)
  const out: Pt[] = []
  for (let i = i0; i <= i1; i++) {
    const p = pts[idx(i)], n = nrm(pts, i), k = d((i - i0) / Math.max(1, i1 - i0))
    out.push([p[0] + n[0] * k, p[1] + n[1] * k])
  }
  return out
}
const poly = (pts: Pt[]) => `M${pts.map(P).join('L')}`
/** Dry-brush rim on the shadow side of a contour: swells along the base, breaks into streaks. */
const rimOf = (pts: Pt[], u: number, a0 = -0.55, a1 = Math.PI - 0.1) =>
  `${poly(along(pts, a0, a1, () => 0.3))}L${along(pts, a0, a1, (t) => -(0.3 + 2.3 * u * Math.sin(Math.PI * Math.min(1, t * 1.12)) ** 0.7)).reverse().map(P).join('L')}Z`

/** Stone lantern (tōrō) in sumi-e brushwork, drawn in a 120×220 box. */
function lanternArt(cls: string): SVGSVGElement {
  const wash = [
    'M60 9C66 16 69 22 67 28C65 33 55 33 53 28C51 22 54 16 60 9Z',
    'M60 29C78 41 96 52 118 56L113 68L7 68L2 56C24 52 42 41 60 29Z',
    'M35 70L85 70L86 116L34 116Z',
    'M17 117L103 117L93 135L27 135Z',
    'M48 135L72 135L74 199L46 199Z',
    'M13 199L107 199L111 213L9 213Z',
  ]
  const strokes = [
    brush([[60, 31], [44, 42], [24, 53], [7, 59], [1, 54]], 8.5, 0.08, 0.55, 0.18),
    brush([[60, 31], [76, 42], [96, 53], [113, 59], [119, 54]], 9.5, 0.08, 0.55, 0.18),
    brush([[5, 64], [38, 69], [82, 69], [115, 64]], 5.5, 0.1, 0.5, 0.3),
    brush([[57, 31], [60, 26], [63, 31]], 4, 0.3, 0.9, 0.4),
    brush([[37, 71], [37.6, 94], [37, 116]], 7, 0.1, 0.35, 0.45),
    brush([[83, 71], [83.4, 94], [83.8, 116]], 8.5, 0.1, 0.35, 0.45),
    brush([[32, 74], [60, 72.5], [88, 74]], 4.5, 0.1, 0.6, 0.3),
    brush([[31, 114], [60, 115.5], [89, 114]], 5.5, 0.1, 0.6, 0.3),
    brush([[15, 118], [60, 116], [105, 118]], 6, 0.08, 0.5, 0.3),
    brush([[27, 134], [60, 135.5], [93, 134]], 4, 0.1, 0.6, 0.3),
    brush([[16, 120], [27, 133]], 3, 0.2, 0.6, 0.3),
    brush([[104, 120], [93, 133]], 4.5, 0.2, 0.6, 0.3),
    brush([[49.5, 137], [48, 168], [47, 198]], 4, 0.1, 0.4, 0.3),
    brush([[70.5, 137], [72.5, 168], [73.5, 198]], 6, 0.1, 0.4, 0.3),
    brush([[47.5, 165], [60, 163.5], [72.5, 165]], 3.5, 0.2, 0.7, 0.3),
    brush([[13, 200], [60, 198], [107, 200]], 5, 0.08, 0.5, 0.3),
    brush([[7, 212], [60, 214.5], [113, 212]], 7, 0.06, 0.45, 0.3),
    brush([[108, 201], [111, 211]], 4, 0.2, 0.6, 0.4),
  ]
  const jewel = 'M60 8C65 15 69 21 67 27C65 32 55 32 53 27C51 21 55 15 60 8Z'
  const grass = [
    [[12, 213], [9, 200], [3, 191]],
    [[16, 213], [17, 198], [23, 187]],
    [[21, 214], [25, 204], [32, 198]],
    [[99, 214], [102, 203], [109, 195]],
    [[104, 213], [105, 200], [102, 190]],
  ].map((p) => brush(p as Pt[], 2.8, 0.15, 0.9, 0.1))
  return s('svg', { class: `gl-lantern ${cls}`, viewBox: '0 0 120 220', 'aria-hidden': 'true' },
    s('g', { class: 'gl-lg-wrap' }, s('circle', { class: 'gl-lg', cx: 60, cy: 94, r: 92, fill: 'url(#gl-glow)' })),
    s('ellipse', { class: 'gl-lt-ground', cx: 60, cy: 214, rx: 64, ry: 7, filter: 'url(#ink-wash)' }),
    s('path', { class: 'gl-lt-win', d: 'M43 79C53 78 67 78 77 79L77 110C67 111 53 111 43 110Z', fill: 'url(#gl-win)' }),
    s('g', { class: 'gl-lt-wash', filter: 'url(#ink-wash)' }, ...wash.map((d) => s('path', { d }))),
    s('path', { class: 'gl-lt-roof', d: wash[1], filter: 'url(#ink-wash)' }),
    s('g', { class: 'gl-lt-ink', filter: 'url(#ink-rough)' }, s('path', { d: jewel }), ...strokes.map((d) => s('path', { d }))),
    s('g', { class: 'gl-lt-grass' }, ...grass.map((d) => s('path', { d }))))
}

/** Rice paper for the reading card: hand-cut sides, a deckled bottom, hung from a scroll rod. */
function paperArt(w: number, hh: number, seed: number): SVGSVGElement {
  const r = rng(seed)
  const pts: Pt[] = [[0, 6], [w, 6]]
  for (let y = 22; y < hh - 10; y += 24) pts.push([w + (r() - 0.5) * 1.8, y])
  for (let x = w; x > 2; x -= 6 + r() * 9) pts.push([x, hh - 2.5 + (r() - 0.5) * 4 - (r() < 0.18 ? 2.5 : 0)])
  pts.push([0, hh - 2])
  for (let y = hh - 22; y > 22; y -= 24) pts.push([(r() - 0.5) * 1.8, y])
  const d = `M${pts.map(P).join('L')}Z`
  return s('svg', { class: 'gl-paper', viewBox: `0 0 ${f1(w)} ${f1(hh)}`, width: f1(w), height: f1(hh), 'aria-hidden': 'true' },
    s('path', { class: 'gl-pp-bleed', d, filter: 'url(#ink-wash)' }),
    s('path', { class: 'gl-pp', d }),
    s('path', { class: 'gl-pp-edge', d, filter: 'url(#ink-wash)' }),
    s('path', { class: 'gl-rod', d: brush([[-13, 5], [w / 2, 4], [w + 13, 5]], 6.5, 0.05, 0.25, 0.75), filter: 'url(#ink-rough)' }),
    s('circle', { class: 'gl-rod', cx: -14, cy: 5, r: 4.4 }),
    s('circle', { class: 'gl-rod', cx: w + 14, cy: 5, r: 4.4 }))
}

/**
 * Set a group of stones the way a gardener does: the largest first, each next one laid against a stone already set,
 * at whatever angle keeps the group closest to an ellipse of aspect A — with raked sand between them.
 * Clearances are measured on rounded outlines, so stones meet diagonally as well as side by side.
 * The small pebbles settle at the foot of the group's main stone.
 */
function pack(items: Item[], A: number, seed: number, compact: boolean): Pack {
  const R = rng(seed)
  const n = items.length
  const ord = items.map((_, k) => k).sort((a, b) => items[b].w * items[b].h - items[a].w * items[a].h)
  const pos: Pt[] = Array.from({ length: n }, (): Pt => [0, 0])
  // wide groups stretch sideways but still drift up and down — never a row of stones on a ruler
  const sx = Math.sqrt(A), sy = 1 / Math.sqrt(Math.min(A, 2.2))
  const host = ord[0]
  // the group's centre of gravity sits a little off its main stone, so no two groups are mirror images
  const ox = (R() - 0.5) * 1.6, oy = (R() - 0.5) * 0.6
  const E = 2.6
  const ext = (a: Item, b: Item): Pt => {
    const [gx, gy] = a.acc || b.acc ? [0.2, 0.12] : compact ? [0.44, 0.36] : [0.95, 0.62]
    return [(a.w + b.w) / 2 + gx, (a.h + b.h) / 2 + gy]
  }
  const clear = (a: Item, b: Item, dx: number, dy: number) => {
    const [ex, ey] = ext(a, b)
    return (Math.abs(dx) / ex) ** E + (Math.abs(dy) / ey) ** E >= 0.998
  }
  const done: number[] = [host]
  for (const k of ord.slice(1)) {
    const a = items[k]
    let best: Pt = [0, 0], bc = Infinity
    for (const j of done) {
      const [ex, ey] = ext(a, items[j])
      for (let qq = 0; qq < 18; qq++) {
        const th = (qq / 18) * TAU + R() * 0.25
        const c = Math.cos(th), sn = Math.sin(th)
        const d = 1.002 / ((Math.abs(c) / ex) ** E + (Math.abs(sn) / ey) ** E) ** (1 / E)
        const x = pos[j][0] + c * d, y = pos[j][1] + sn * d
        if (!done.every((m) => m === j || clear(a, items[m], x - pos[m][0], y - pos[m][1]))) continue
        const hx = x - pos[host][0], hy = y - pos[host][1]
        const cost = a.acc
          ? Math.hypot(hx * 0.6, (hy - items[host].h * 0.32) * 2.2) + R() * 0.6
          : ((x - ox) / sx) ** 2 + ((y - oy) / sy) ** 2 + R() * 0.6
        if (cost < bc) (bc = cost), (best = [x, y])
      }
    }
    pos[k] = best
    done.push(k)
  }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  items.forEach((it, k) => {
    x0 = Math.min(x0, pos[k][0] - it.w / 2)
    x1 = Math.max(x1, pos[k][0] + it.w / 2)
    y0 = Math.min(y0, pos[k][1] - it.h / 2)
    y1 = Math.max(y1, pos[k][1] + it.h / 2)
  })
  let top = 0
  items.forEach((it, k) => {
    if (!it.acc && pos[k][1] - it.h / 2 < pos[top][1] - items[top].h / 2) top = k
  })
  return { pos: pos.map(([x, y]): Pt => [x - x0, y - y0]), cw: x1 - x0, ch: y1 - y0, top }
}

/** Signed distance from a point to a rounded box. */
function sdBox(b: Blob, x: number, y: number): number {
  const qx = Math.abs(x - b.cx) - b.hx + b.r, qy = Math.abs(y - b.cy) - b.hy + b.r
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - b.r
}
const blob = (cx: number, cy: number, w: number, hh: number): Blob => ({ cx, cy, hx: w / 2, hy: hh / 2, r: (Math.min(w, hh) / 2) * 0.96 })

/** Glossary — "Vườn chữ": every term is a stone on raked sand, gathered into one group of stones per garden. */
export function render(root: HTMLElement): () => void {
  setCrumb(G.title)
  const total = G.terms.length
  const reduced = prefs.reduced
  const stationOf = (id: number) => ALL_STATIONS.find((st) => st.id === id)

  // ───────── DOM ─────────
  const h1 = h('h1', { class: 'gl-h1', id: 'gl-h', tabindex: '-1' }, G.title)
  const kicker = h('p', { class: 'gl-kicker' }, fill(G.kicker, { n: total }))
  const q = h('input', {
    class: 'gl-q',
    id: 'gl-q',
    type: 'search',
    placeholder: G.placeholder,
    'aria-label': G.searchLabel,
    'aria-describedby': 'gl-keys',
    'aria-controls': 'gl-field',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    enterkeyhint: 'search',
  })
  const clearBtn = h('button', { class: 'gl-clear', type: 'button', 'aria-label': G.clear, hidden: true },
    s('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, s('path', { d: 'M7 7l10 10M17 7L7 17' })))
  const lens = s('svg', { class: 'gl-lens', viewBox: '0 0 28 28', 'aria-hidden': 'true' },
    s('path', { d: enso(12, 12, 7.2, 2.4, -2.3, 5.5) }),
    s('path', { d: 'M17.4 17.6 L23.6 23.4', class: 'gl-lens-h' }))
  const line = s('svg', { class: 'gl-line', viewBox: '0 0 300 10', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    s('path', { d: swash(300, 3.2, 5, 0.6) }))
  const count = h('span', { class: 'gl-count', 'aria-live': 'polite' }, fill(G.count, { n: total }))
  const search = h('div', { class: 'gl-search' }, lens, q, count, clearBtn, line)
  // small screens keep the lantern in the head row, beside the title
  const mini = lanternArt('gl-mini')
  const head = h('header', { class: 'gl-head' },
    h('div', { class: 'gl-titles' }, h('div', { class: 'gl-hrow' }, h1, mini), kicker),
    h('div', { class: 'gl-find' }, search),
    h('p', { id: 'gl-keys', class: 'visually-hidden' }, G.keys))

  const sandA = h('canvas', { class: 'gl-sand' })
  const sandB = h('canvas', { class: 'gl-sand' })
  const fx = h('canvas', { class: 'gl-fx' })
  const sweep = h('div', { class: 'gl-sweep' }, sandA, sandB)
  const sandWrap = h('div', { class: 'gl-sandwrap', 'aria-hidden': 'true' }, sweep, fx)
  const sr = rng(4242)
  const dots = (cls: string) =>
    Array.from({ length: 30 }, () => s('circle', { class: cls, cx: f1(sr() * 41), cy: f1(sr() * 37), r: f1(0.35 + sr() * 0.75), 'fill-opacity': f1(0.25 + sr() * 0.75) }))
  const stops = (id: string, at: number[]) => at.map((o, k) => s('stop', { offset: String(o), class: `gl-${id}${k}` }))
  const defs = s('svg', { class: 'gl-defs', width: 0, height: 0, 'aria-hidden': 'true' },
    s('defs', null,
      s('radialGradient', { id: 'gl-granite', cx: '0.34', cy: '0.22', r: '1' }, ...stops('gr', [0, 0.55, 1])),
      s('radialGradient', { id: 'gl-sand', cx: '0.38', cy: '0.2', r: '1' }, ...stops('sa', [0, 0.55, 1])),
      s('linearGradient', { id: 'gl-slate', x1: '0', y1: '0', x2: '0.35', y2: '1' }, ...stops('sl', [0, 1])),
      s('radialGradient', { id: 'gl-basalt', cx: '0.3', cy: '0.18', r: '1.05' }, ...stops('ba', [0, 0.5, 1])),
      s('radialGradient', { id: 'gl-peb', cx: '0.36', cy: '0.26', r: '0.95' }, ...stops('pb', [0, 1])),
      s('linearGradient', { id: 'gl-ao', x1: '0', y1: '0', x2: '0', y2: '1' }, ...stops('ao', [0.45, 1])),
      s('radialGradient', { id: 'gl-sh' }, ...stops('sh', [0, 0.6, 1])),
      s('radialGradient', { id: 'gl-win', cx: '0.5', cy: '0.55', r: '0.62' }, ...stops('w', [0, 1])),
      s('radialGradient', { id: 'gl-glow' }, ...stops('gl', [0, 0.35, 1])),
      // dry brush for horizontal strokes: the hairs run along the stroke, not across it
      s('filter', { id: 'gl-dry', x: '-5%', y: '-30%', width: '110%', height: '160%' },
        s('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.05 0.8', numOctaves: octaves(2), seed: '5', result: 'n' }),
        s('feColorMatrix', { in: 'n', type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.6 1.75', result: 'm' }),
        s('feComposite', { in: 'SourceGraphic', in2: 'm', operator: 'in' })),
      s('pattern', { id: 'gl-speck', width: 41, height: 37, patternUnits: 'userSpaceOnUse' }, ...dots('gl-sp-d')),
      s('pattern', { id: 'gl-speck-l', width: 41, height: 37, patternUnits: 'userSpaceOnUse' }, ...dots('gl-sp-l'))))

  const groups = GARDENS.map((g) =>
    h('div', { class: 'gl-group', role: 'group', 'aria-label': fill(G.gardenGroup, { n: g.id, name: g.name }) }))
  const marks = h('div', { class: 'gl-marks', 'aria-hidden': 'true' })
  const lantern = lanternArt('gl-dock')
  const spill = h('div', { class: 'gl-spill', 'aria-hidden': 'true' })
  const stage = h('div', { class: 'gl-stage' }, sandWrap, spill, lantern, marks, ...groups)
  const empty = h('p', { class: 'gl-empty', hidden: true }, G.empty)
  const cardBody = h('div', { class: 'gl-card-in' })
  const card = h('div', { class: 'gl-card', id: 'gl-card', hidden: true, role: 'region', 'aria-labelledby': 'gl-card-term' }, cardBody)
  const live = h('p', { class: 'visually-hidden', 'aria-live': 'polite' })
  const field = h('div', { class: 'gl-field', id: 'gl-field', role: 'group', 'aria-label': G.fieldLabel }, defs, stage, empty, card)
  const section = h('section', { class: 'gl', 'aria-labelledby': 'gl-h' }, head, field, live)
  root.append(section)

  // ───────── stones & islands ─────────
  const stones: Stone[] = G.terms.map((t, i) => {
    const anchor = ANCHORS.has(t.id)
    const fam: Fam = anchor ? 'basalt' : SLATES.has(t.id) ? 'slate' : rnd(i * 5.3 + 2) < 0.38 ? 'sand' : 'granite'
    const label = h('span', { class: 'gl-t' })
    const alias = h('span', { class: 'gl-aka', 'aria-hidden': 'true' })
    const rock = s('svg', { class: 'gl-rock', 'aria-hidden': 'true' })
    const ring = s('svg', { class: 'gl-ring', 'aria-hidden': 'true' })
    const body = h('span', { class: 'gl-body' }, rock, label, ring)
    const shadow = s('ellipse', { class: 'gl-shadow', fill: 'url(#gl-sh)' })
    const cres = s('path', { class: 'gl-cres' })
    const ground = s('svg', { class: 'gl-ground', 'aria-hidden': 'true' }, shadow, cres)
    const el = h('button', {
      class: 'gl-stone',
      type: 'button',
      tabindex: '-1',
      'aria-expanded': 'false',
      'aria-controls': 'gl-card',
      'aria-describedby': 'gl-keys',
      'data-fam': fam,
      'data-key': t.key ? '' : null,
      'data-seen': progress.isVisited(t.station),
    }, ground, h('span', { class: 'gl-sink' }, body), alias)
    return {
      t, i, fam, anchor, key: !!t.key, el, body, ground, shadow, cres, label, alias, rock, ring,
      hay: norm([t.term, t.full ?? '', t.vi, ...(t.aka ?? [])].join(' ')),
      defN: norm(t.def),
      alts: [t.full ?? '', ...(t.aka ?? []), t.vi].filter(Boolean),
      w1: 0, w2: 0, two: false, dome: false, ly: 0.5, uw: 0, uh: 0, ufk: 1,
      fk: 16, w: 0, h: 0, x: 0, y: 0, z: 1, shown: true, defOnly: false, aka: '', shape: '',
    }
  })
  const gardenOf = (st: Stone) => stationOf(st.t.station)?.garden.id ?? 1
  const islands: Island[] = []
  for (const g of GARDENS) {
    const ss = stones.filter((st) => gardenOf(st) === g.id)
    const grp = groups[g.id - 1]
    if (!ss.length) {
      grp.remove()
      continue
    }
    grp.append(...ss.map((st) => st.el))
    const pebArt = s('svg', { class: 'gl-peb-art', 'aria-hidden': 'true' })
    const peb = h('span', { class: 'gl-peb' }, pebArt, h('span', { class: 'gl-peb-n' }, String(g.id)))
    const name = h('span', { class: 'gl-gname' }, g.name)
    // groups of an odd number read as calm: one or two small pebbles keep the word stones company
    const acc: Acc[] = Array.from({ length: ss.length % 2 ? 2 : 1 }, (_, k) => {
      const seed = g.id * 97 + k * 31
      const uw = 1.6 + rnd(seed) * 0.9
      return {
        seed, fam: rnd(seed + 3) < 0.5 ? 'sand' : 'granite', uw, uh: uw * (0.6 + rnd(seed + 1) * 0.16),
        w: 0, h: 0, x: 0, y: 0, el: s('svg', { class: 'gl-acc', 'aria-hidden': 'true' }), shape: '',
      }
    })
    marks.append(...acc.map((a) => a.el), peb, name)
    islands.push({ g, stones: ss, acc, packs: [], peb, pebArt, name, nameW: 0, px: 0, py: 0, nx: 0 })
  }
  let ordered: Stone[] = stones

  const meas = document.createElement('canvas').getContext('2d')!
  function measure() {
    const fam = cssVar('--serif') || 'serif'
    for (const st of stones) {
      meas.font = `${st.key ? 500 : 400} ${REF}px ${fam}`
      st.w1 = meas.measureText(st.t.term).width
      const words = st.t.term.split(' ')
      st.w2 = words.length > 1 ? Math.max(...words.map((w) => meas.measureText(w).width)) : 0
    }
    meas.font = `400 ${REF}px ${fam}`
    for (const is of islands) is.nameW = meas.measureText(is.g.name).width
    prepKey = ''
  }

  // ───────── state ─────────
  let W = 0, H = 0, f = 16, gap = 10
  let mode: 'dock' | 'side' | 'sheet' = 'dock'
  let D = 0
  let lant: { x: number; y: number; w: number; h: number } | null = null
  let sel: Stone | null = null
  let cur: Stone = stones[0]
  let nq = ''
  let alive = true
  let intro: gsap.core.Timeline | null = null
  const dpr = () => Math.min(devicePixelRatio || 1, prefs.quality === 'high' ? 2 : 1)
  const to = (t: gsap.TweenTarget, v: gsap.TweenVars) => (reduced ? gsap.set(t, v) : gsap.to(t, { overwrite: 'auto', ...v }))

  // ───────── stone sizes: decoupled from the word — short words get tall domed stones, key words larger ones ─────────
  let prepKey = ''
  let tight = false
  function prep(compact: boolean) {
    tight = compact
    const k = String(compact)
    if (prepKey === k) return
    prepKey = k
    const Z = compact ? SZ.compact : SZ.wide
    for (const st of stones) {
      const fk = st.anchor ? 1.14 : st.key ? 1.1 : 1
      const sc = st.anchor ? Z.anchor : st.key ? Z.key : 1
      st.two = st.w2 > 0 && st.w1 > REF * 5.2
      const tw = ((st.two ? st.w2 : st.w1) * fk) / REF
      st.dome = !st.two && tw < fk * 2.7
      const r1 = rnd(st.i * 3.1 + 1), r2 = rnd(st.i * 5.7 + 2)
      let hh: number, ww: number
      if (st.dome) {
        hh = fk * Z.dome * (0.94 + r2 * 0.14)
        ww = Math.max(tw + fk * Z.pad * 0.85, hh * (Z.domeA[0] + r1 * (Z.domeA[1] - Z.domeA[0])))
      } else {
        hh = fk * (st.two ? Z.two : Z.line) * (0.94 + r2 * 0.12)
        ww = Math.max((tw + fk * Z.pad) * (0.9 + r1 * 0.24), tw + fk * Z.pad * 0.8)
        hh = Math.max(hh, ww / Z.maxA)
      }
      if (st.fam === 'slate') (hh *= 0.88), (ww += fk * 0.5)
      st.ufk = fk
      st.uw = ww * sc
      st.uh = hh * sc
      st.ly = st.dome ? 0.63 : st.two ? 0.55 : 0.58
    }
    for (const is of islands) {
      const items: Item[] = [...is.stones.map((st) => ({ w: st.uw, h: st.uh, acc: false })), ...is.acc.map((a) => ({ w: a.uw, h: a.uh, acc: true }))]
      const seen = new Set<string>()
      is.packs = ASPECTS.map((A) => pack(items, A, is.g.id * 7919 + 17, compact)).filter((pk) => {
        const k2 = `${pk.cw.toFixed(1)}x${pk.ch.toFixed(1)}`
        return !seen.has(k2) && !!seen.add(k2)
      })
    }
  }

  // ───────── composition: groups of stones laid along an S across the field ─────────
  function shapeOf(is: Island, pk: Pack, ff: number): Shape {
    const capW = pebW(ff) + ff * 0.4 + (is.nameW * nameFs(ff)) / REF
    const capH = Math.max(ff * (tight ? 1.45 : 1.75), nameFs(ff) * (tight ? 1.75 : 1.9))
    const cw = pk.cw * ff, ch = pk.ch * ff
    return { pk, cw, ch, capW, capH, w: Math.max(cw, capW), h: ch + capH }
  }

  /** Groups look best as low rounded clumps, a little wider than tall — never a column, never a long line. */
  const clumpy = (sh: Shape) => Math.abs(Math.log(sh.w / sh.h / 1.8)) * (sh.w < sh.h ? 2 : 1)

  /** Choose one shape per island so the band fits the width; prefer a low band of well-shaped clumps. */
  function fitBand(ids: number[], shapes: Shape[][], aw: number, sx: number, ff: number): Band | null {
    let best: { pick: Shape[]; cost: number } | null = null
    const pick: Shape[] = []
    const dfs = (j: number, w: number) => {
      if (j === ids.length) {
        const hgt = Math.max(...pick.map((p) => p.h))
        const cost = (0.45 * hgt) / ff + pick.reduce((a, p) => a + clumpy(p) * 2, 0)
        if (!best || cost < best.cost) best = { pick: [...pick], cost }
        return
      }
      for (const sh of shapes[ids[j]]) {
        const nw = w + (j ? sx : 0) + sh.w
        if (nw > aw) continue
        pick.push(sh)
        dfs(j + 1, nw)
        pick.pop()
      }
    }
    dfs(0, 0)
    if (!best) return null
    const b: Shape[] = (best as { pick: Shape[] }).pick
    return { ids: [...ids], sh: b, w: b.reduce((a, p) => a + p.w, 0) + (b.length - 1) * sx, h: Math.max(...b.map((p) => p.h)) }
  }

  function plan(ff: number, aw: number, ah: number): Plan | null {
    const sx = ff * (tight ? 1.6 : 2.4), sy = ff * (tight ? 0.8 : 1.15)
    const shapes = islands.map((is) => is.packs.map((pk) => shapeOf(is, pk, ff)).filter((sh) => sh.w <= aw))
    if (shapes.some((l) => !l.length)) return null
    const n = islands.length
    let best: Plan | null = null
    for (let mask = 0; mask < 1 << (n - 1); mask++) {
      const bands: Band[] = []
      let ids: number[] = []
      let ok = true
      for (let i = 0; i < n && ok; i++) {
        ids.push(i)
        if (i === n - 1 || mask & (1 << i)) {
          const b = fitBand(ids, shapes, aw, sx, ff)
          if (b) bands.push(b)
          else ok = false
          ids = []
        }
      }
      if (!ok) continue
      const totalH = bands.reduce((a, b) => a + b.h, 0) + (bands.length - 1) * sy
      if (totalH > ah) continue
      const cw = Math.max(...bands.map((b) => b.w))
      // the composition should breathe the same amount across and down
      const score = Math.abs(Math.log(cw / aw) - Math.log(totalH / ah)) + bands.length * 0.03 +
        bands.reduce((a, b) => a + b.sh.reduce((c, sh) => c + clumpy(sh), 0), 0) * 0.45
      if (!best || score < best.score) best = { f: ff, bands, totalH, sx, sy, score }
    }
    return best
  }

  function choose(aw: number, ah: number, narrow: boolean): Plan {
    const fMax = clamp(Math.min(aw / 34, ah / 18), 12, 28)
    const fMin = narrow ? 12 : 10
    // the largest type that fits — or a little smaller, when that buys a clearly calmer composition
    let best: Plan | null = null, f0 = 0
    const kw = tight ? 0.995 : 0.97, kh = tight ? 0.99 : 0.95
    for (let ff = fMax; ff >= fMin; ff -= 0.5) {
      if (f0 && ff < f0 * 0.9) break
      const p = plan(ff, aw * kw, ah * kh)
      if (!p) continue
      f0 ||= ff
      p.score += (1 - ff / f0) * 5
      if (!best || p.score < best.score) best = p
    }
    for (let ff = fMin - 0.5; !best && ff >= 8; ff -= 0.5) best = plan(ff, aw * kw, ah * kh)
    return best ?? plan(8, aw, Infinity)!
  }

  function placeIsland(is: Island, sh: Shape, x: number, y: number) {
    const pk = sh.pk
    const ox = x + (sh.w - sh.cw) / 2, oy = y + sh.capH
    const n = is.stones.length
    is.stones.forEach((st, k) => {
      st.x = ox + pk.pos[k][0] * f
      st.y = oy + pk.pos[k][1] * f
    })
    is.acc.forEach((a, k) => {
      a.w = a.uw * f
      a.h = a.uh * f
      a.x = ox + pk.pos[n + k][0] * f
      a.y = oy + pk.pos[n + k][1] * f
    })
    // the garden's name is written on the sand just above its highest stone
    const pw = pebW(f)
    const top = is.stones[pk.top]
    const capL = clamp(top.x - top.w * 0.42, x, x + sh.w - sh.capW)
    is.px = capL + pw / 2
    is.py = y + sh.capH * 0.42
    is.nx = is.px + pw / 2 + f * 0.4
  }

  function compose(p: Plan, x0: number, aw: number, ah: number, top0: number) {
    const B = p.bands.length
    const freeV = ah - p.totalH
    const between = B > 1 ? Math.min(freeV / (B + 0.6), f * 3) : 0
    let y = top0 + (freeV - between * (B - 1)) / 2
    const order: Stone[] = []
    p.bands.forEach((b, bi) => {
      const n = b.ids.length
      const freeH = aw - b.w
      const odd = bi % 2 === 1
      const wts = [odd ? 1.1 : 0.35, ...b.ids.slice(1).map((_, j) => 0.7 + rnd(bi * 7 + j) * 0.6), odd ? 0.35 : 1.1]
      const sum = wts.reduce((a, v) => a + v, 0)
      let x = x0 + (freeH * wts[0]) / sum
      b.ids.forEach((id, j) => {
        const is = islands[id], sh = b.sh[j]
        let t = n > 1 ? j / (n - 1) : 0.5
        if (odd) t = 1 - t
        placeIsland(is, sh, x, y + (b.h - sh.h) * t)
        // keyboard order inside a group: left to right
        order.push(...[...is.stones].sort((a2, b2) => a2.x - b2.x))
        x += sh.w + p.sx + (freeH * wts[j + 1]) / sum
      })
      y += b.h + p.sy + between
    })
    ordered = order
  }

  // ───────── drawing the stones ─────────
  function paint(st: Stone) {
    const e = st.el.style
    st.z = 10 + Math.round((st.y + st.h / 2) / 4)
    e.left = `${f1(st.x)}px`
    e.top = `${f1(st.y)}px`
    e.zIndex = String(sel === st ? 900 : st.z)
    e.setProperty('--w', `${f1(st.w)}px`)
    e.setProperty('--h', `${f1(st.h)}px`)
    e.setProperty('--fs', `${f1(st.fk)}px`)
    e.setProperty('--ly', `${f1((st.ly - 0.5) * st.h)}px`)
    e.setProperty('--rot', `${f1((rnd(st.i * 7.7) - 0.5) * 3.5)}deg`)
    const key = `${f1(st.w)}x${f1(st.h)}`
    if (st.shape !== key) {
      st.shape = key
      const { w, h: hh, fam } = st
      const pts = rockPts(w, hh, st.i * 977 + 13, fam, st.dome)
      const r = rng(st.i * 31 + 5)
      const body = closed(pts)
      const u = clamp(hh / 40, 0.55, 1.6)
      // the lit plane: upper-left shoulder catching the dawn light
      const lit = along(pts, Math.PI + 0.2, 1.5 * Math.PI + 0.5, () => -0.6)
      const litD = `${poly(lit)}Q${f1(w * 0.4)} ${f1(hh * 0.46)} ${P(lit[0])}Z`
      // axe-cut texture strokes on the shadow side, following the form
      const cun = [
        brush(along(pts, 0.15 + r() * 0.15, 1.0 + r() * 0.25, (t) => -hh * (0.1 + 0.04 * Math.sin(t * Math.PI))), 2.8 * u, 0.2, 0.9, 0.15),
        brush(along(pts, 2.2, 2.55 + r() * 0.2, () => -hh * 0.11), 1.9 * u, 0.25, 0.8, 0.15),
      ].join('')
      const rimLight = poly(along(pts, Math.PI + 0.35, 1.5 * Math.PI + 0.65, () => -0.6))
      // moss clumps hugging the top shoulder (shown once the station has been visited)
      const moss: SVGElement[] = []
      for (let k = 0; k < 11; k++) {
        const tiny = k >= 7
        const a = 1.5 * Math.PI - 1.05 + (tiny ? (k - 7) * 0.24 + 0.1 : k * 0.13) + r() * 0.06
        const i = Math.round((a / TAU) * N)
        const p = pts[idx(i)], n = nrm(pts, i)
        const rr = tiny ? clamp(hh * 0.025, 0.7, 1.4) : clamp(hh * (0.045 + r() * 0.07), 1.3, 5.5)
        const inn = tiny ? hh * 0.13 + r() * hh * 0.05 : rr * (0.1 + r() * 0.4)
        moss.push(s('path', { class: `gl-m${k % 3}`, d: clump(p[0] - n[0] * inn, p[1] - n[1] * inn, rr, st.i * 13 + k), 'fill-opacity': f1(0.5 + r() * 0.45) }))
      }
      st.rock.setAttribute('viewBox', `0 0 ${f1(w)} ${f1(hh)}`)
      st.rock.replaceChildren(
        s('path', { d: body, fill: `url(#gl-${fam})` }),
        s('path', { d: body, fill: 'url(#gl-ao)' }),
        s('path', { d: body, fill: `url(#${fam === 'basalt' ? 'gl-speck-l' : 'gl-speck'})` }),
        s('path', { class: 'gl-r-lit', d: litD }),
        s('path', { class: 'gl-r-cun', d: cun }),
        s('path', { class: 'gl-r-rim', d: rimOf(pts, u), filter: 'url(#gl-dry)' }),
        s('path', { class: 'gl-r-rl', d: rimLight }),
        s('g', { class: 'gl-moss', filter: 'url(#ink-rough)' }, ...moss))
      // the sand it sits in: a contact crescent and a soft wash shadow, left behind when the stone is lifted
      const outer = along(pts, 0.25, Math.PI - 0.25, (t) => 0.4 + 2.6 * u * Math.sin(t * Math.PI))
      const inner = along(pts, 0.25, Math.PI - 0.25, () => -1)
      st.ground.setAttribute('viewBox', `0 0 ${f1(w)} ${f1(hh)}`)
      st.cres.setAttribute('d', `${poly(outer)}L${inner.reverse().map(P).join('L')}Z`)
      Object.entries({ cx: w * 0.53, cy: hh * 0.82, rx: w * 0.58, ry: hh * 0.3 }).forEach(([k, v]) => st.shadow.setAttribute(k, String(f1(v))))
      // focus: one vermilion brush loop around the stone
      st.ring.setAttribute('viewBox', `0 0 ${f1(w + 20)} ${f1(hh + 18)}`)
      st.ring.replaceChildren(s('path', { d: enso(w / 2 + 10, hh / 2 + 9, w / 2 + 6, 3, -2.2 + st.i, Math.PI * 2 + 0.55, hh / 2 + 5.5), filter: 'url(#ink-rough)' }))
    }
    renderLabel(st)
  }

  function paintAcc(a: Acc) {
    Object.assign(a.el.style, { left: `${f1(a.x)}px`, top: `${f1(a.y)}px`, width: `${f1(a.w)}px`, height: `${f1(a.h)}px`, zIndex: String(10 + Math.round((a.y + a.h / 2) / 4)) })
    const key = `${f1(a.w)}x${f1(a.h)}`
    if (a.shape === key) return
    a.shape = key
    const pts = rockPts(a.w, a.h, a.seed, a.fam, true)
    const body = closed(pts)
    a.el.setAttribute('viewBox', `0 0 ${f1(a.w)} ${f1(a.h)}`)
    a.el.replaceChildren(
      s('ellipse', { cx: f1(a.w * 0.54), cy: f1(a.h * 0.84), rx: f1(a.w * 0.62), ry: f1(a.h * 0.3), fill: 'url(#gl-sh)' }),
      s('path', { d: body, fill: `url(#gl-${a.fam})` }),
      s('path', { d: body, fill: 'url(#gl-ao)' }),
      s('path', { d: body, fill: 'url(#gl-speck)' }),
      s('path', { class: 'gl-r-rim', d: rimOf(pts, clamp(a.h / 40, 0.4, 1)), filter: 'url(#gl-dry)' }))
  }

  function paintMarker(is: Island) {
    const pw = pebW(f), ph = pw * 0.78
    Object.assign(is.peb.style, { left: `${f1(is.px)}px`, top: `${f1(is.py)}px`, width: `${f1(pw)}px`, height: `${f1(ph)}px` })
    const pts = rockPts(pw, ph, is.g.id * 71 + 3, 'sand')
    is.pebArt.setAttribute('viewBox', `0 0 ${f1(pw)} ${f1(ph)}`)
    is.pebArt.replaceChildren(
      s('path', { class: 'gl-peb-sh', d: closed(pts.map(([x, y]) => [x + 0.8, y + 1.6] as Pt)) }),
      s('path', { d: closed(pts), fill: 'url(#gl-peb)' }),
      s('path', { class: 'gl-r-rim', d: rimOf(pts, 0.6, -0.4, Math.PI - 0.2), filter: 'url(#gl-dry)' }))
    Object.assign(is.name.style, { left: `${f1(is.nx)}px`, top: `${f1(is.py)}px` })
  }

  /** The word a match came through when it was not the term itself: an English full name, an alias or the Vietnamese gloss. */
  function akaOf(st: Stone): string {
    if (!nq || (' ' + norm(st.t.term)).includes(' ' + nq)) return ''
    for (const a of st.alts) {
      if (!(' ' + norm(a)).includes(' ' + nq)) continue
      if (a.length <= 20) return a
      const first = nq.split(' ')[0]
      return a.split(/[\s-]+/).find((w) => norm(w).startsWith(first)) ?? a
    }
    return ''
  }

  function renderLabel(st: Stone) {
    const t = st.t.term
    const low = norm(t)
    let a = -1, b = -1
    if (nq && low.length === t.length) {
      a = (' ' + low).indexOf(' ' + nq)
      b = a < 0 ? -1 : a + nq.length
    }
    const kids: Node[] = []
    let buf = '', inMark = false
    const flush = () => {
      if (buf) kids.push(inMark ? h('mark', null, buf) : document.createTextNode(buf))
      buf = ''
    }
    for (let i = 0; i < t.length; i++) {
      const m = i >= a && i < b
      if (m !== inMark) (flush(), (inMark = m))
      if (st.two && t[i] === ' ') {
        flush()
        kids.push(h('br'))
      } else buf += t[i]
    }
    flush()
    st.label.replaceChildren(...kids)
    st.el.toggleAttribute('data-def', st.defOnly)
    st.alias.textContent = st.aka
    st.el.toggleAttribute('data-aka', !!st.aka)
    st.el.setAttribute('aria-label', fill(G.stoneLabel, { term: st.t.term, vi: st.t.vi, n: st.t.station }) +
      (st.aka ? ` · ${fill(G.akaMatch, { w: st.aka })}` : st.defOnly ? ` · ${G.defMatch}` : ''))
  }

  // ───────── layout ─────────
  let short = false
  const cardCache = new Map<string, number>()
  /** The tallest reading card at this width — the dock keeps that much sand free above the lantern. */
  function cardMax(cw: number): number {
    const k = `${Math.round(cw)}|${short}`
    const hit = cardCache.get(k)
    if (hit) return hit
    const wasHidden = card.hidden
    card.style.width = `${cw}px`
    card.style.visibility = 'hidden'
    card.hidden = false
    const longest = [...stones].sort((a, b) => b.t.def.length - a.t.def.length).slice(0, 3)
    let m = 0
    for (const st of new Set([...stones.filter((x) => x.t.fact || x.t.kind), ...longest])) {
      fillCard(st)
      m = Math.max(m, card.offsetHeight)
    }
    if (sel) fillCard(sel)
    card.hidden = wasHidden
    card.style.visibility = ''
    cardCache.set(k, m)
    return m
  }

  function layout() {
    W = field.clientWidth
    H = field.clientHeight
    if (!W || !H) return
    const m = clamp(W * 0.025, 10, 24)
    const px = clamp(W * 0.03, 12, 40)
    short = H < 560
    section.toggleAttribute('data-short', short)
    mode = 'sheet'
    let LH = 0
    if (W >= 760 && W / H >= 1.15) {
      D = clamp(W * 0.28, 300, 520)
      section.dataset.mode = 'dock'
      LH = Math.min(330, H * 0.64, H - cardMax(D - m * 1.5) - m * 2.4)
      mode = LH >= 120 ? 'dock' : 'side'
    }
    section.dataset.mode = mode
    prep(W < 560 || H < 480)
    const aw = (mode === 'dock' ? W - D : W - px) - px
    const top0 = tight ? 2 : 6, ah = H - top0 - (tight ? 4 : 10)
    const p = choose(aw, ah, W < 560)
    f = p.f
    gap = clamp(f * 0.62, 7, 14)
    for (const st of stones) (st.fk = st.ufk * f), (st.w = st.uw * f), (st.h = st.uh * f)
    section.style.setProperty('--f', `${f}px`)
    section.style.setProperty('--nf', `${f1(nameFs(f))}px`)
    // a small stone's touch target grows into the sand, never into its neighbour's
    section.style.setProperty('--tz', `${f1(f * (tight ? 0.2 : 0.3))}px`)
    compose(p, px, aw, ah, top0)
    stones.forEach(paint)
    islands.forEach((is) => (paintMarker(is), is.acc.forEach(paintAcc)))
    lant = null
    if (mode === 'dock') {
      const lw = (LH * 120) / 220
      lant = { x: W - D + (D - lw) * 0.66, y: H - LH - 4, w: lw, h: LH }
      Object.assign(lantern.style, { left: `${f1(lant.x)}px`, top: `${f1(lant.y)}px`, width: `${f1(lw)}px`, height: `${f1(LH)}px` })
      Object.assign(spill.style, { left: `${f1(lant.x + lw / 2)}px`, top: `${f1(lant.y + LH * 0.97)}px`, width: `${f1(lw * 4.2)}px`, height: `${f1(LH * 0.5)}px` })
    }
    drawSand(false)
    if (sel) placeCard(sel, false)
  }

  // ───────── sand ─────────
  let front = sandA, back = sandB
  sandB.style.opacity = '0'
  let fxKey = ''

  /** Smooth contours of one iso-level, stitched into polylines; crumbs and stray loops are dropped. */
  function contour(F: Float32Array, nx: number, ny: number, c: number, lv: number, minLen: number, out: Path2D) {
    const segs: number[] = [] // ax ay bx by
    const keys: number[] = [] // edge key of each endpoint
    const at = new Map<number, number[]>()
    const link = (k: number, end: number) => {
      const l = at.get(k)
      if (l) l.push(end)
      else at.set(k, [end])
    }
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const a = F[j * nx + i], b = F[j * nx + i + 1], cc = F[(j + 1) * nx + i + 1], dd = F[(j + 1) * nx + i]
        if (Math.min(a, b, cc, dd) > lv || Math.max(a, b, cc, dd) < lv) continue
        const x0 = i * c, y0 = j * c
        const pts: number[] = []
        const edge = (v1: number, v2: number, x1: number, y1: number, x2: number, y2: number, key: number) => {
          if (v1 < lv !== v2 < lv) {
            const t = (lv - v1) / (v2 - v1)
            pts.push(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, key)
          }
        }
        edge(a, b, x0, y0, x0 + c, y0, (j * nx + i) * 2)
        edge(b, cc, x0 + c, y0, x0 + c, y0 + c, (j * nx + i + 1) * 2 + 1)
        edge(cc, dd, x0 + c, y0 + c, x0, y0 + c, ((j + 1) * nx + i) * 2)
        edge(dd, a, x0, y0 + c, x0, y0, (j * nx + i) * 2 + 1)
        for (let p = 0; p + 5 < pts.length; p += 6) {
          const s0 = segs.length / 4
          segs.push(pts[p], pts[p + 1], pts[p + 3], pts[p + 4])
          keys.push(pts[p + 2], pts[p + 5])
          link(pts[p + 2], s0 * 2)
          link(pts[p + 5], s0 * 2 + 1)
        }
      }
    const used = new Uint8Array(segs.length / 4)
    const pt = (end: number): Pt => [segs[(end >> 1) * 4 + (end & 1) * 2], segs[(end >> 1) * 4 + (end & 1) * 2 + 1]]
    const walk = (end: number, line: Pt[]) => {
      // from the far end of a segment, keep stepping into the segment that shares that edge point
      for (;;) {
        const k = keys[end]
        const next = at.get(k)?.find((e) => !used[e >> 1])
        if (next == null) return
        used[next >> 1] = 1
        const other = next ^ 1
        line.push(pt(other))
        end = other
      }
    }
    for (let sgi = 0; sgi < used.length; sgi++) {
      if (used[sgi]) continue
      used[sgi] = 1
      const fwd: Pt[] = [pt(sgi * 2), pt(sgi * 2 + 1)]
      walk(sgi * 2 + 1, fwd)
      const bwd: Pt[] = []
      walk(sgi * 2, bwd)
      const lineP = [...bwd.reverse(), ...fwd]
      let len = 0
      for (let i = 1; i < lineP.length; i++) len += Math.hypot(lineP[i][0] - lineP[i - 1][0], lineP[i][1] - lineP[i - 1][1])
      if (len < minLen) continue
      out.moveTo(lineP[0][0], lineP[0][1])
      for (let i = 1; i < lineP.length - 1; i++)
        out.quadraticCurveTo(lineP[i][0], lineP[i][1], (lineP[i][0] + lineP[i + 1][0]) / 2, (lineP[i][1] + lineP[i + 1][1]) / 2)
      const e = lineP[lineP.length - 1]
      out.lineTo(e[0], e[1])
    }
  }

  function drawSand(fade: boolean) {
    if (!W || !H) return
    const target = fade && !reduced ? back : front
    const d = dpr()
    const pw = Math.round(W * d), ph = Math.round(H * d)
    if (target.width !== pw || target.height !== ph) (target.width = pw), (target.height = ph)
    const k = `${pw}x${ph}`
    if (fxKey !== k) (fxKey = k), (fx.width = pw), (fx.height = ph)
    const g = target.getContext('2d')!
    g.setTransform(d, 0, 0, d, 0, 0)
    g.clearRect(0, 0, W, H)

    const K = prefs.quality === 'high' ? 3 : 2
    // every stone, pebble and name keeps the rakes at bay; neighbouring rings melt into one soft envelope (smooth min)
    const blobs: Blob[] = []
    for (const is of islands) {
      for (const st of is.stones) if (st.shown) blobs.push(blob(st.x, st.y + st.h * 0.05, st.w * 0.97, st.h * 0.86))
      for (const a of is.acc) blobs.push(blob(a.x, a.y + a.h * 0.05, a.w * 0.96, a.h * 0.82))
      const pw = pebW(f)
      blobs.push(blob(is.px, is.py, pw * 0.92, pw * 0.7))
      const nw = (is.nameW * nameFs(f)) / REF
      blobs.push(blob(is.nx + nw / 2, is.py, nw + f * 0.2, nameFs(f) * 0.9))
    }
    if (lant) blobs.push(blob(lant.x + lant.w / 2, lant.y + lant.h * 0.965, lant.w * 0.9, lant.h * 0.045))

    const ks = gap * 1.5
    const cut = (K + 2.2) * gap
    const c = prefs.quality === 'high' ? 4 : 5
    const nx = Math.ceil(W / c) + 1, ny = Math.ceil(H / c) + 1
    const F = new Float32Array(nx * ny).fill(1e9)
    for (const b of blobs) {
      const i0 = Math.max(0, Math.floor((b.cx - b.hx - cut) / c)), i1 = Math.min(nx - 1, Math.ceil((b.cx + b.hx + cut) / c))
      const j0 = Math.max(0, Math.floor((b.cy - b.hy - cut) / c)), j1 = Math.min(ny - 1, Math.ceil((b.cy + b.hy + cut) / c))
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const v = sdBox(b, i * c, j * c), o = F[j * nx + i]
          const hk = Math.max(ks - Math.abs(v - o), 0) / ks
          F[j * nx + i] = Math.min(v, o) - hk * hk * ks * 0.25
        }
    }
    const rake = new Path2D()
    // straight rake rows across the open sand, stopping where the rings begin
    const limit = (K + 0.2) * gap
    for (let y = gap * 0.6; y < H; y += gap) {
      let x0 = NaN
      const yy = (x: number) => y + Math.sin(x / 230 + y / 41) * 0.9
      const run = (x1: number) => {
        // a short stub squeezed between two ring sets is not raked
        if (x1 - x0 >= gap * 3.5) {
          rake.moveTo(x0, yy(x0))
          for (let x = x0 + 8; x < x1; x += 8) rake.lineTo(x, yy(x))
          rake.lineTo(x1, yy(x1))
        }
        x0 = NaN
      }
      for (let x = -2; x <= W + 4; x += 4) {
        const v = F[Math.min(ny - 1, Math.round(yy(x) / c)) * nx + Math.min(nx - 1, Math.round(Math.max(0, x) / c))]
        if (v > limit) {
          if (Number.isNaN(x0)) x0 = x
        } else if (!Number.isNaN(x0)) run(x - 4)
      }
      if (!Number.isNaN(x0)) run(W + 4)
    }
    // rings fade as they leave the stones, so the outermost groove never draws a frame
    const rings: [Path2D, number][] = [[rake, 1]]
    for (let k2 = 1; k2 <= K; k2++) {
      const p = new Path2D()
      contour(F, nx, ny, c, (k2 - 0.3) * gap, gap * 5, p)
      rings.push([p, 0.95 - ((k2 - 1) / Math.max(1, K - 1)) * 0.45])
    }

    // each path inked twice: a light lip above, the groove below
    const dark = document.documentElement.dataset.theme === 'dark'
    const lip = dark ? cssVar('--ink-3') : cssVar('--rake-hi')
    for (const [col, dy, a, lw] of [[lip, -1, dark ? 0.3 : 0.85, 1], [cssVar('--rake'), 0, dark ? 0.95 : 0.85, dark ? 1.3 : 1]] as const) {
      g.save()
      g.translate(0, dy)
      g.strokeStyle = col
      g.lineWidth = lw
      for (const [p, k2] of rings) {
        g.globalAlpha = a * k2
        g.stroke(p)
      }
      g.restore()
    }
    gsap.killTweensOf([front, back])
    if (target === back) {
      // the sand is re-raked: the new pattern breathes in, the old one settles out
      gsap.to(back, { opacity: 1, duration: 0.9, ease: 'power2.inOut' })
      gsap.to(front, { opacity: 0, duration: 0.9, ease: 'power2.inOut' })
      ;[front, back] = [back, front]
    } else {
      front.style.opacity = '1'
      back.style.opacity = '0'
    }
  }

  // ───────── ripples, and the vermilion thread from a far stone to its card ─────────
  type Rip = { x: number; y: number; hw: number; hh: number; t: number; ver: boolean; reach: number }
  type Thread = { ax: number; ay: number; bx: number; by: number; t: number }
  const rips: Rip[] = []
  const threads: Thread[] = []
  const fxg = fx.getContext('2d')!
  // colours are read on mount and in onPrefs (theme), never per frame
  let ink = cssVar('--ink')
  let ver = cssVar('--vermilion')
  /** one coordinate of the thread's quadratic curve */
  const qb = (a: number, m: number, b: number, t: number) => (1 - t) ** 2 * a + 2 * (1 - t) * t * m + t * t * b
  const loop = createLoop(fx, () => {
    const g = fxg
    const d = dpr()
    g.setTransform(d, 0, 0, d, 0, 0)
    g.clearRect(0, 0, W, H)
    const now = performance.now()
    for (let i = rips.length - 1; i >= 0; i--) {
      const r = rips[i]
      const age = (now - r.t) / 1000 / (r.ver ? 2.4 : 1.9)
      if (age >= 1) {
        rips.splice(i, 1)
        continue
      }
      if (age < 0) continue
      for (let k = 0; k < 3; k++) {
        const a = age - k * 0.11
        if (a <= 0) continue
        const grow = 3 + (1 - (1 - a) ** 2.2) * r.reach
        g.globalAlpha = (1 - a) * (r.ver ? (k ? 0.22 : 0.55) : 0.16)
        g.strokeStyle = r.ver && k === 0 ? ver : ink
        g.lineWidth = r.ver && k === 0 ? 1.5 : 1
        g.beginPath()
        const rw = r.hw + grow, rh = r.hh + grow
        g.roundRect(r.x - rw, r.y - rh, rw * 2, rh * 2, Math.min(rw, rh))
        g.stroke()
      }
    }
    for (let i = threads.length - 1; i >= 0; i--) {
      const th = threads[i]
      const age = (now - th.t) / 1000
      if (age >= 2.8) {
        threads.splice(i, 1)
        continue
      }
      const p = 1 - (1 - Math.min(1, age / 1.05)) ** 3
      const fade = age < 1.3 ? 1 : 1 - (age - 1.3) / 1.5
      const mx = (th.ax + th.bx) / 2, my = Math.min(th.ay, th.by) - Math.hypot(th.bx - th.ax, th.by - th.ay) * 0.14
      g.strokeStyle = ver
      g.fillStyle = ver
      g.lineCap = 'round'
      const n = 64
      let px = qb(th.ax, mx, th.bx, 0), py = qb(th.ay, my, th.by, 0)
      for (let k = 1; k <= n * p; k++) {
        const t = k / n
        const x = qb(th.ax, mx, th.bx, t), y = qb(th.ay, my, th.by, t)
        // pressed where it leaves the stone, a dry hair by the time it reaches the paper
        g.globalAlpha = 0.6 * fade * (1 - t * 0.45)
        g.lineWidth = 0.7 + 1.8 * (1 - t) ** 1.4
        g.beginPath()
        g.moveTo(px, py)
        g.lineTo(x, y)
        g.stroke()
        px = x
        py = y
      }
      if (p < 1) {
        g.globalAlpha = 0.85 * fade
        g.beginPath()
        g.arc(qb(th.ax, mx, th.bx, p), qb(th.ay, my, th.by, p), 2.6, 0, TAU)
        g.fill()
      }
    }
    g.globalAlpha = 1
    return rips.length > 0 || threads.length > 0
  })
  const kick = () => void (alive && loop.start())
  function ripple(x: number, y: number, hw: number, hh: number, ver: boolean, reach: number) {
    if (reduced) return
    rips.push({ x, y, hw, hh, t: performance.now(), ver, reach })
    kick()
  }
  const rippleStone = (st: Stone, ver: boolean, reach = f * 5) =>
    ripple(st.x, st.y, st.w / 2, st.h / 2, ver, reach)

  // ───────── filter ─────────
  const inName = (st: Stone) => !nq || (' ' + st.hay).includes(' ' + nq)
  // word starts only ("pro" finds prompt and protocol, not "improvement"); definitions join in from 3 letters
  const inDef = (st: Stone) => nq.length >= 3 && (' ' + st.defN).includes(' ' + nq)
  const matches = (st: Stone) => inName(st) || inDef(st)
  function syncGardens() {
    for (const is of islands) {
      const off = !is.stones.some((st) => st.shown)
      is.peb.toggleAttribute('data-off', off)
      is.name.toggleAttribute('data-off', off)
      is.acc.forEach((a) => a.el.toggleAttribute('data-off', off))
    }
  }
  let sandTimer = 0
  function applyFilter() {
    nq = norm(q.value)
    clearBtn.hidden = !q.value
    let n = 0
    // a reading card whose stone is about to sink settles first, so the sinking wins the last word
    if (sel && !matches(sel)) close(false)
    for (const st of stones) {
      const on = matches(st)
      st.defOnly = on && !!nq && !inName(st)
      st.aka = on && !st.defOnly ? akaOf(st) : ''
      renderLabel(st)
      if (on) n++
      if (on === st.shown) continue
      st.shown = on
      st.el.inert = !on
      if (on) {
        to(st.body, { y: 0, scaleY: 1, autoAlpha: 1, duration: 1, ease: 'power3.out' })
        to(st.ground, { autoAlpha: 1, duration: 1, ease: 'power3.out' })
      } else {
        to(st.body, { y: st.h * 0.75, scaleY: 0.92, autoAlpha: 0, duration: 0.7, ease: 'power2.in' })
        to(st.ground, { autoAlpha: 0, duration: 0.6, ease: 'power2.in' })
      }
    }
    count.textContent = n === total ? fill(G.count, { n: total }) : fill(G.countFiltered, { n, total })
    empty.hidden = n > 0
    if (!cur.shown) setCur(ordered.find((st) => st.shown) ?? cur)
    syncGardens()
    clearTimeout(sandTimer)
    sandTimer = window.setTimeout(() => drawSand(true), reduced ? 0 : 160)
  }

  // ───────── selection & the reading card ─────────
  function setCur(st: Stone) {
    cur.el.tabIndex = -1
    cur = st
    cur.el.tabIndex = 0
  }
  setCur(stones[0])

  function lift(st: Stone, up: boolean) {
    to(st.body, up ? { y: -st.h * 0.22, scale: 1.05, duration: 0.85, ease: 'power3.out' } : { y: 0, scale: 1, duration: 0.7, ease: 'power3.out' })
    to(st.shadow, up
      ? { scale: 1.28, opacity: 0.5, transformOrigin: '50% 50%', duration: 0.85, ease: 'power3.out' }
      : { scale: 1, opacity: 1, transformOrigin: '50% 50%', duration: 0.7, ease: 'power3.out' })
  }

  function seal(n: number) {
    return s('svg', { class: 'gl-seal', viewBox: '0 0 40 40', 'aria-hidden': 'true' },
      s('path', { class: 'gl-seal-b', d: closed(rockPts(36, 36, n * 13, 'sand').map(([x, y]) => [x + 2, y + 2] as Pt)), filter: 'url(#ink-rough)' }),
      s('text', { x: '20', y: '26.5', 'text-anchor': 'middle' }, String(n)))
  }

  let brushEl: SVGSVGElement | null = null
  function fillCard(st: Stone) {
    const t = st.t
    const meta = stationOf(t.station)
    const seen = progress.isVisited(t.station)
    brushEl = s('svg', { class: 'gl-swash', viewBox: '0 0 160 14', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
      s('path', { d: swash(160, 6, 7, st.i), filter: 'url(#ink-rough)' }))
    cardBody.replaceChildren(
      h('button', { class: 'gl-x', type: 'button', 'aria-label': G.close, onClick: () => close(true) },
        s('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, s('path', { d: 'M7 7l10 10M17 7L7 17' }))),
      h('h2', { class: 'gl-term', id: 'gl-card-term' }, t.term),
      brushEl,
      h('p', { class: 'gl-vi' }, t.vi, t.full ? h('span', { class: 'gl-full', lang: 'en' }, t.full) : null),
      h('p', { class: 'gl-def' }, t.def),
      ...(t.kind ? [h('p', { class: 'gl-tags' }, tag(t.kind))] : []),
      ...(t.fact ? [fact(t.fact, 'p', 'gl-fact')] : []),
      h('a', { class: 'gl-go', href: `#/tram/${t.station}` },
        seal(t.station),
        h('span', { class: 'gl-go-t' },
          h('span', { class: 'gl-go-a' }, fill(G.see, { n: t.station })),
          h('span', { class: 'gl-go-s' }, (meta?.title ?? '') + (seen ? ` · ${G.seen}` : ''))),
        s('svg', { class: 'gl-go-arrow', viewBox: '0 0 24 24', 'aria-hidden': 'true' }, s('path', { d: 'M5 12h13M13 6.5l5.5 5.5-5.5 5.5' }))))
  }

  let paperKey = ''
  function dressCard() {
    const w = card.offsetWidth, hh = card.offsetHeight
    const k = `${w}x${hh}|${sel?.i}`
    if (!w || k === paperKey) return
    paperKey = k
    card.querySelector('.gl-paper')?.remove()
    card.prepend(paperArt(w, hh, (sel?.i ?? 0) + 3))
  }
  const cro = new ResizeObserver(dressCard)
  cro.observe(card)

  /**
   * Wide screens: the card hangs in the free sand of the dock, above the lantern, never over a stone.
   * Short landscape: a scroll on the right; phones: a scroll from the bottom — the garden slides so the lifted stone stays in view.
   */
  function placeCard(st: Stone, animate: boolean) {
    const m = clamp(W * 0.025, 10, 24)
    let cw: number, x: number, y: number, dx = 0, dy = 0
    const gapC = f * 1.2
    if (mode === 'dock') {
      cw = D - m * 1.5
      card.style.width = `${f1(cw)}px`
      x = W - D + m * 0.5
      y = m * 0.9
    } else if (mode === 'side') {
      cw = clamp(W * 0.4, 280, 380)
      card.style.width = `${f1(cw)}px`
      const ch = Math.min(card.offsetHeight, H - m)
      x = W - cw - m * 0.6 - 16 // room for the rod's knob
      y = clamp((H - ch) / 2, m * 0.5, H - ch - m * 0.5)
      const right = st.x + st.w / 2 + gapC
      dx = clamp(right - x, 0, Math.max(0, st.x - st.w / 2 - m))
    } else {
      cw = Math.min(W - m * 1.2 - 36, 560)
      card.style.width = `${f1(cw)}px`
      const ch = Math.min(card.offsetHeight, H * 0.66)
      x = (W - cw) / 2
      y = H - ch - m * 0.5
      const lifted = st.y - st.h / 2 - st.h * 0.22
      dy = clamp(st.y + st.h / 2 + 4 + gapC - y, 0, Math.max(0, lifted - m * 0.6))
    }
    card.style.left = `${f1(x)}px`
    card.style.top = `${f1(y)}px`
    to(stage, { x: -dx, y: -dy, duration: animate ? 0.9 : 0.5, ease: 'power3.out' })
  }

  function open(st: Stone) {
    if (sel === st) return
    const prev = sel
    sel = st
    if (prev) {
      lift(prev, false)
      prev.el.setAttribute('aria-expanded', 'false')
      prev.el.style.zIndex = String(prev.z)
    }
    st.el.setAttribute('aria-expanded', 'true')
    st.el.style.zIndex = '900'
    section.dataset.open = ''
    lift(st, true)
    rippleStone(st, true, f * 6)
    gsap.killTweensOf(card)
    fillCard(st)
    card.hidden = false
    placeCard(st, true)
    dressCard()
    live.textContent = `${st.t.term}. ${st.t.def}`
    if (reduced) {
      gsap.set(card, { autoAlpha: 1, x: 0, y: 0, clipPath: 'none' })
      return
    }
    // a word far from the dock sends a thin vermilion thread to its card, so the eye knows where to go
    const cx = parseFloat(card.style.left)
    if (mode === 'dock' && cx - st.x > W * 0.4) {
      threads.length = 0
      threads.push({ ax: st.x + st.w * 0.25, ay: st.y - st.h * 0.62, bx: cx - 6, by: parseFloat(card.style.top) + Math.min(64, card.offsetHeight * 0.2), t: performance.now() + 120 })
      kick()
    }
    const from = mode === 'dock'
      ? { autoAlpha: 1, x: 0, y: 0, clipPath: 'inset(-14px -24px 100% -24px)' }
      : mode === 'side' ? { autoAlpha: 0, x: 26, y: 0, clipPath: 'none' } : { autoAlpha: 0, x: 0, y: 34, clipPath: 'none' }
    gsap.fromTo(card, from, {
      autoAlpha: 1, x: 0, y: 0, clipPath: mode === 'dock' ? 'inset(-14px -24px -14px -24px)' : 'none', duration: mode === 'dock' ? 1.1 : 0.75, ease: 'power3.out',
      onComplete: () => void gsap.set(card, { clipPath: 'none' }),
    })
    gsap.fromTo(cardBody.querySelectorAll('.gl-term, .gl-vi, .gl-def, .gl-tags, .gl-fact, .gl-go'),
      { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.06, ease: 'power3.out', delay: 0.12 })
    if (brushEl) gsap.fromTo(brushEl, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.9, ease: 'power2.out', delay: 0.25 })
  }

  function close(focusStone: boolean) {
    if (!sel) return
    const st = sel
    sel = null
    delete section.dataset.open
    lift(st, false)
    st.el.setAttribute('aria-expanded', 'false')
    st.el.style.zIndex = String(st.z)
    gsap.killTweensOf(card)
    to(card, { autoAlpha: 0, y: mode === 'sheet' ? 20 : 6, duration: 0.35, ease: 'power2.in', onComplete: () => void (sel || (card.hidden = true)) })
    to(stage, { x: 0, y: 0, duration: 0.8, ease: 'power3.out' })
    if (focusStone && st.shown) st.el.focus({ preventScroll: true })
  }

  // ───────── input ─────────
  const visible = () => ordered.filter((st) => st.shown)
  function go(st: Stone | undefined) {
    if (!st) return
    st.el.focus({ preventScroll: true })
    if (sel) open(st)
  }
  function vertical(st: Stone, dir: 1 | -1) {
    let best: Stone | undefined, bs = Infinity
    for (const o of visible()) {
      const dy = (o.y - st.y) * dir
      if (dy < Math.min(st.h, o.h) * 0.45) continue
      const sc = dy + Math.abs(o.x - st.x) * 1.6
      if (sc < bs) (bs = sc), (best = o)
    }
    return best
  }

  stones.forEach((st) => {
    st.el.addEventListener('click', () => (sel === st ? close(false) : open(st)))
    st.el.addEventListener('focus', () => setCur(st))
    st.el.addEventListener('keydown', (e) => {
      const vis = visible()
      const k = vis.indexOf(st)
      let next: Stone | undefined
      switch (e.key) {
        case 'ArrowRight': next = vis[k + 1]; break
        case 'ArrowLeft': next = vis[k - 1]; break
        case 'ArrowDown': next = vertical(st, 1); break
        case 'ArrowUp': next = vertical(st, -1); break
        case 'Home': next = vis[0]; break
        case 'End': next = vis[vis.length - 1]; break
        case 'Escape':
          if (sel) (e.preventDefault(), close(true))
          return
        default:
          // typing on a stone continues the search
          if (e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) q.focus()
          return
      }
      e.preventDefault()
      go(next)
    })
  })

  q.addEventListener('input', applyFilter)
  q.addEventListener('keydown', (e) => {
    const first = visible()[0]
    if (e.key === 'ArrowDown' && first) {
      e.preventDefault()
      first.el.focus({ preventScroll: true })
    } else if (e.key === 'Enter' && first) {
      e.preventDefault()
      first.el.focus({ preventScroll: true })
      open(first)
    } else if (e.key === 'Escape' && q.value) {
      e.preventDefault()
      e.stopPropagation()
      q.value = ''
      applyFilter()
    }
  })
  clearBtn.addEventListener('click', () => {
    q.value = ''
    applyFilter()
    q.focus()
  })
  section.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !sel) return
    const t = e.target as Element
    if (t.closest('.gl-stone')) return
    // Escape on the source ⓘ first puts its note away; the next one closes the card
    const src = t.closest('.src')
    if (src && !src.classList.contains('gl-quiet')) {
      src.classList.add('gl-quiet')
      return
    }
    close(true)
  })
  const wake = (e: Event) => (e.target as Element).closest?.('.src')?.classList.remove('gl-quiet')
  cardBody.addEventListener('focusout', wake)
  cardBody.addEventListener('pointerdown', wake, true)
  // touching bare sand: a small ripple answers, and an open card settles away
  field.addEventListener('pointerdown', (e) => {
    if ((e.target as Element).closest('.gl-stone, .gl-card')) return
    const r = stage.getBoundingClientRect()
    ripple(e.clientX - r.left, e.clientY - r.top, 0, 0, false, f * 7)
    close(false)
  })

  // ───────── lifecycle ─────────
  measure()
  layout()
  let relayout = 0
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(relayout)
    relayout = requestAnimationFrame(layout)
  })
  ro.observe(field)
  const offPrefs = onPrefs(() => {
    ink = cssVar('--ink')
    ver = cssVar('--vermilion')
    if (W) drawSand(false)
  })
  const refit = () => {
    if (!alive) return
    cardCache.clear()
    measure()
    layout()
  }
  document.fonts?.ready.then(refit)
  document.fonts?.addEventListener('loadingdone', refit)

  if (!reduced) {
    sweep.classList.add('sweeping')
    const bodies = ordered.map((st) => st.body)
    intro = gsap.timeline({ onComplete: () => sweep.classList.remove('sweeping') })
    intro.fromTo(sweep, { '--sw': '-30%' }, { '--sw': '130%', duration: 2.6, ease: 'power2.inOut' }, 0)
      .from(h1, { opacity: 0, y: 10, filter: 'blur(8px)', duration: 1.4, ease: 'power3.out' }, 0.1)
      .from([kicker, search, count], { opacity: 0, y: 8, duration: 1.1, stagger: 0.1, ease: 'power3.out' }, 0.35)
      .from(bodies, { y: (i: number) => -ordered[i].h * 0.9, autoAlpha: 0, duration: 1.1, stagger: 0.045, ease: 'power3.out' }, 0.55)
      .from(ordered.map((st) => st.ground), { autoAlpha: 0, duration: 1.1, stagger: 0.045, ease: 'power3.out' }, 0.55)
      .from(marks.children, { opacity: 0, duration: 1.4, stagger: 0.05 }, 0.9)
      .from([lantern, mini], { opacity: 0, duration: 1.8, ease: 'power2.out' }, 0.6)
    ordered.forEach((st, i) => intro!.add(() => rippleStone(st, false, f * 2.6), 0.55 + i * 0.045 + 0.35))
  }
  h1.focus({ preventScroll: true })

  return () => {
    alive = false
    ro.disconnect()
    cro.disconnect()
    offPrefs()
    document.fonts?.removeEventListener('loadingdone', refit)
    loop.dispose()
    cancelAnimationFrame(relayout)
    clearTimeout(sandTimer)
    intro?.kill()
    gsap.killTweensOf([card, stage, sandA, sandB, brushEl, ...stones.flatMap((st) => [st.body, st.ground, st.shadow])].filter(Boolean))
    gsap.killTweensOf(cardBody.querySelectorAll('*'))
  }
}
