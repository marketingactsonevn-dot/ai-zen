import './exam.css'
import data from '../content/exam.json'
import data2 from '../content/exam-2.json'
import { fill, h, s } from '../core/dom'
import { cssVar, onPrefs, prefs } from '../core/prefs'
import { gsap } from '../core/anim'
import { createLoop } from '../core/loop'
import { load, save } from '../core/store'
import { chime } from '../core/sound'
import { ensoBrush } from '../ui/brush'
import { setCrumb } from '../ui/topbar'
import { icon } from '../ui/icons'
import { progress } from '../core/progress'
import { PARTS, displayNo, stationsOfPart } from '../core/content'

/*
 * Bài thi cuối — a stone gate at dawn; ten questions are ten stepping stones through it;
 * the stones you set gather around an ensō (your score); then your name is brushed onto a
 * rice-paper certificate (Canvas2D, 1600×1131) you can save as a PNG.
 */

// set by render(): one exam page is mounted at a time (Part 1 = exam.json, Part 2 = exam-2.json)
let D = data
let N = D.questions.length
let PART = 1
type Q = (typeof data.questions)[number]
type Pt = [number, number]
type Saved = { name?: string; score?: number; picks?: number[] }

// ───────────────────────── geometry & brush toolkit ─────────────────────────
const f1 = (n: number) => String(Math.round(n * 10) / 10)
const P = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/** Deterministic PRNG (mulberry32) so every visit draws the same garden. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Open Catmull-Rom through pts, `per` samples per segment. */
function spline(pts: Pt[], per = 10): Pt[] {
  if (pts.length < 3) {
    const [a, b] = pts
    return Array.from({ length: per + 1 }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / per, a[1] + ((b[1] - a[1]) * i) / per] as Pt)
  }
  const out: Pt[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2
    for (let j = 0; j < per; j++) {
      const t = j / per, t2 = t * t, t3 = t2 * t
      const c = (a: number, b: number, c2: number, d: number) => 0.5 * (2 * b + (c2 - a) * t + (2 * a - 5 * b + 4 * c2 - d) * t2 + (3 * b - a - 3 * c2 + d) * t3)
      out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])])
    }
  }
  out.push(pts[pts.length - 1])
  return out
}

/** A tapered sumi-e stroke as a filled outline. a = press-in share, b = lift-off share, min = thinnest tip. */
function brush(pts: Pt[], w: number, a = 0.12, b = 0.4, min = 0.12, wob = 0.08): string {
  const C = spline(pts, 10)
  const n = C.length
  const L = [0]
  for (let i = 1; i < n; i++) L.push(L[i - 1] + Math.hypot(C[i][0] - C[i - 1][0], C[i][1] - C[i - 1][1]))
  const len = L[n - 1] || 1
  const lft: Pt[] = []
  const rgt: Pt[] = []
  for (let i = 0; i < n; i++) {
    const t = L[i] / len
    const k = Math.max(min, Math.sqrt(Math.min(1, a ? t / a : 1))) * Math.max(min, Math.min(1, b ? (1 - t) / b : 1) ** 0.7) * (1 + wob * Math.sin(t * 11 + w))
    const A = C[Math.max(0, i - 1)], B = C[Math.min(n - 1, i + 1)]
    const dl = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1
    const nx = -(B[1] - A[1]) / dl, ny = (B[0] - A[0]) / dl
    const hw = (w * k) / 2
    lft.push([C[i][0] + nx * hw, C[i][1] + ny * hw])
    rgt.push([C[i][0] - nx * hw, C[i][1] - ny * hw])
  }
  return `M${lft.map(P).join('L')}L${rgt.reverse().map(P).join('L')}Z`
}

/** Closed smooth curve through pts (cubic Catmull-Rom). */
function closed(pts: Pt[], k = 1 / 6): string {
  const n = pts.length
  let d = `M${P(pts[0])}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n]
    d += `C${f1(p1[0] + (p2[0] - p0[0]) * k)} ${f1(p1[1] + (p2[1] - p0[1]) * k)} ${f1(p2[0] - (p3[0] - p1[0]) * k)} ${f1(p2[1] - (p3[1] - p1[1]) * k)} ${P(p2)}`
  }
  return d + 'Z'
}

/** A garden stone: weathered outline, a little taller on top, a flat foot so it sits in the sand. */
function stoneD(cx: number, cy: number, rx: number, ry: number, seed: number, n = 11): string {
  const r = rng(seed * 7 + 3)
  const pts: Pt[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.3
    const k = 0.9 + r() * 0.15
    let y = cy + Math.sin(a) * ry * k
    if (Math.sin(a) > 0) y = Math.min(y, cy + ry * 0.74)
    else y += Math.sin(a) * ry * 0.08
    pts.push([cx + Math.cos(a) * rx * k, y])
  }
  return closed(pts, 1 / 7)
}

/** A flat stepping slab: a softened rectangle (superellipse) with a weathered edge and a flat foot. */
function slabD(cx: number, cy: number, rx: number, ry: number, seed: number): string {
  const r = rng(seed * 5 + 11)
  const n = 30, e = 2 / 3.6
  const pts: Pt[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const c = Math.cos(a), sn = Math.sin(a)
    let y = cy + ry * Math.sign(sn) * Math.abs(sn) ** e * (1 + (r() - 0.5) * 0.1)
    if (sn > 0) y = Math.min(y, cy + ry * 0.82)
    pts.push([cx + rx * Math.sign(c) * Math.abs(c) ** e * (1 + (r() - 0.5) * 0.012), y])
  }
  return closed(pts)
}

/** Wobbly ellipse (wash, puddle, leaf). */
function blob(cx: number, cy: number, rx: number, ry: number, seed: number, wob = 0.1, n = 14): string {
  const r = rng(seed * 13 + 1)
  const ph = [r() * 6.3, r() * 6.3]
  const pts: Pt[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const k = 1 + wob * (Math.sin(2 * a + ph[0]) * 0.6 + Math.sin(3 * a + ph[1]) * 0.4)
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k])
  }
  return closed(pts)
}

const ell = (cx: number, cy: number, rx: number, ry: number) =>
  `M${f1(cx - rx)} ${f1(cy)}a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(2 * rx)} 0a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(-2 * rx)} 0Z`
const rr = (x: number, y: number, w: number, hh: number, r: number) =>
  `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + hh - r}Q${x + w} ${y + hh} ${x + w - r} ${y + hh}H${x + r}Q${x} ${y + hh} ${x} ${y + hh - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`
function arcPts(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 24): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as Pt
  })
}

// ───────────────────────── raked sand (shared by screen + certificate) ─────────────────────────
/** An obstacle the rake goes around: a rounded box; sq squashes it (perspective), s scales ring spacing (depth). */
interface Obs { x: number; y: number; hw: number; hh: number; sq?: number; s?: number }

function sdf(o: Obs, px: number, py: number): number {
  const sq = o.sq ?? 1
  const dx = Math.abs(px - o.x)
  const dy = Math.abs(py - o.y) / sq
  const hh = o.hh / sq
  const r = Math.min(o.hw, hh)
  const qx = dx - (o.hw - r), qy = dy - (hh - r)
  return (Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r) / (o.s ?? 1)
}

const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** Raked rows (three tone groups, so rows vary a little in pressure) + rings around the obstacles. */
interface Rake { rows: Path2D[]; rings: Path2D }

/**
 * Raked rows broken around obstacles + concentric rings around them (iso-lines, marching squares).
 * Rows undulate on one long shared swell (so neighbours stay parallel) plus a small per-row wobble.
 * Obstacles are culled per row/cell by their vertical reach, so big screens stay cheap.
 */
function rakePath(box: [number, number, number, number], rows: number[], obs: Obs[], gap: number, K: number, wave = 3, cell = 4): Rake {
  const [x0, y0, x1, y1] = box
  const out: Rake = { rows: [new Path2D(), new Path2D(), new Path2D()], rings: new Path2D() }
  const reach = (K + 1) * gap
  const span = obs.map((o) => {
    const e = o.hh + reach * (o.s ?? 1) * (o.sq ?? 1) + 2
    return { o, t: o.y - e, b: o.y + e }
  })
  const near = (ya: number, yb: number) => span.filter((sp) => sp.b >= ya && sp.t <= yb).map((sp) => sp.o)
  const field = (list: Obs[], x: number, y: number) => {
    let m = 1e9
    for (const o of list) {
      const v = sdf(o, x, y)
      if (v < m) m = v
    }
    return m
  }
  const limit = (K + 0.55) * gap
  rows.forEach((y, ri) => {
    const lg = Math.abs((rows[ri + 1] ?? rows[ri - 1] ?? y + gap) - y) || gap
    const amp = Math.min(wave, lg * 0.3)
    const ph = hash(ri) * 6.28
    const list = near(y - amp * 1.3 - 1, y + amp * 1.3 + 1)
    const p = out.rows[Math.floor(hash(ri + 17) * 3)]
    let pen = false
    for (let x = x0; x <= x1 + 4; x += 4) {
      const yy = y + amp * (Math.sin(x / 330 + y / 260) + 0.28 * Math.sin(x / 115 + ph))
      if (!list.length || field(list, x, yy) > limit) {
        if (pen) p.lineTo(x, yy)
        else p.moveTo(x, yy)
        pen = true
      } else pen = false
    }
  })
  if (!obs.length || K < 1) return out
  const c = cell
  const nx = Math.ceil((x1 - x0) / c) + 1, ny = Math.ceil((y1 - y0) / c) + 1
  const F = new Float32Array(nx * ny)
  for (let j = 0; j < ny; j++) {
    const Y = y0 + j * c
    const list = near(Y - c, Y + c)
    for (let i = 0; i < nx; i++) F[j * nx + i] = list.length ? field(list, x0 + i * c, Y) : 1e9
  }
  const top = K * gap
  const pts: Pt[] = []
  for (let j = 0; j < ny - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const a = F[j * nx + i], b = F[j * nx + i + 1], cc = F[(j + 1) * nx + i + 1], dd = F[(j + 1) * nx + i]
      const mn = Math.min(a, b, cc, dd)
      if (mn > top) continue
      const mx = Math.max(a, b, cc, dd)
      const X = x0 + i * c, Y = y0 + j * c
      for (let k = Math.max(1, Math.ceil(mn / gap)); k <= K && k * gap <= mx; k++) {
        const lv = k * gap
        pts.length = 0
        const edge = (v1: number, v2: number, ax: number, ay: number, bx: number, by: number) => {
          if (v1 < lv !== v2 < lv) {
            const t = (lv - v1) / (v2 - v1)
            pts.push([ax + (bx - ax) * t, ay + (by - ay) * t])
          }
        }
        edge(a, b, X, Y, X + c, Y)
        edge(b, cc, X + c, Y, X + c, Y + c)
        edge(cc, dd, X + c, Y + c, X, Y + c)
        edge(dd, a, X, Y + c, X, Y)
        for (let q = 0; q + 1 < pts.length; q += 2) {
          out.rings.moveTo(pts[q][0], pts[q][1])
          out.rings.lineTo(pts[q + 1][0], pts[q + 1][1])
        }
      }
    }
  return out
}

// ───────────────────────── one ink scene per question (viewBox 160×100); answering changes the picture ─────────────────────────
const ink = (d: string, o?: number) => `<path class="em-ink" d="${d}"${o ? ` opacity="${o}"` : ''}/>`
const rim = (d: string, o?: number) => `<path class="em-rim" d="${d}"${o ? ` opacity="${o}"` : ''}/>`
const wash = (d: string, o?: number) => `<path class="em-wash" d="${d}"${o ? ` opacity="${o}"` : ''}/>`
const stn = (d: string) => `<path class="em-stone" d="${d}"/><path class="em-rim" d="${d}"/>`
const dot = (x: number, y: number, r: number, cls = 'em-ink', o?: number) => `<circle class="${cls}" cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}"${o ? ` opacity="${o}"` : ''}/>`
const grp = (cls: string, inner: string, attrs = '') => `<g class="${cls}"${attrs}>${inner}</g>`
/** a soft pool of wash behind the whole scene, so it reads as a painting, not an icon */
const pool = (seed: number, cx = 80, cy = 52, rx = 76, ry = 44) => `<path class="em-pool" d="${blob(cx, cy, rx, ry, seed, 0.16)}"/>`
const ground = (y: number, seed: number) =>
  wash(blob(80, y + 2.5, 70, 5, seed, 0.22), 0.4) + ink(brush([[6, y], [80, y + 1.4], [154, y - 0.8]], 1.3, 0.2, 0.4, 0.12), 0.26)
/** a line that draws itself on answer (pathLength reveal) */
const thread = (d: string, cls: string) => `<path class="${cls}" d="${d}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>`
/** cursive "writing" on an absolute x grid, so pieces cut from one line join seamlessly */
function scribble(x0: number, x1: number, y: number, amp: number, seed: number): Pt[] {
  const out: Pt[] = []
  for (let x = x0; x <= x1 + 0.01; x += 2.2) {
    const k = x * 0.55 + seed
    out.push([x + 2.6 * Math.cos(k), y - amp * Math.sin(k) * (0.6 + 0.4 * Math.sin(x * 0.11 + seed))])
  }
  return out
}
const turn = (pts: Pt[], o: Pt, deg: number) => {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a)
  return pts.map(([x, y]) => [o[0] + (x - o[0]) * c - (y - o[1]) * sn, o[1] + (x - o[0]) * sn + (y - o[1]) * c] as Pt)
}

type Pick = (sel: string) => Element[]
type TL = gsap.core.Timeline
interface SceneDef {
  draw: () => string
  /** the "before" state, set once the picture is in the page */
  init?: ($: Pick) => void
  /** what the picture does once the visitor has answered */
  react: ($: Pick, tl: TL) => void
}

const WRITE_NEXT = scribble(86, 116.8, 62, 5.5, 2.1)
const WRITE_END = WRITE_NEXT[WRITE_NEXT.length - 1]
const CAIRN = [[80, 84, 22, 6.5], [78.5, 73.6, 17.5, 5.2], [81.5, 64.6, 14, 4.5], [79.5, 57, 10.5, 3.8], [80.5, 50.9, 7.5, 3.1], [80, 46.4, 4.4, 2.4]] as const
/** where each cairn stone lies on the sand before the answer (0 = the base, already in place) */
const CAIRN_SAND: Pt[] = [[80, 84], [33, 86], [124, 87.4], [147, 88], [10, 88.4], [104.5, 89]]

const SCENES: Record<string, SceneDef> = {
  // Q1 token — a written sentence breaks into four pebbles
  token: {
    draw: () => {
      const xs = [14, 47, 80, 113, 146]
      let out = pool(1) + ground(86, 1)
      for (let i = 0; i < 4; i++) out += grp('s-seg', ink(brush(scribble(xs[i], xs[i + 1], 50, 5, 1.3), 3.1, i ? 0 : 0.08, i === 3 ? 0.3 : 0, 0.22)))
      out += xs.slice(1, 4).map((x) => `<path class="em-ver s-cut" d="${brush([[x + 2, 39], [x - 2, 61]], 1.8, 0.25, 0.3, 0.2, 0)}"/>`).join('')
      out += ([[29, 80.5, 11, 6.2], [62.5, 82, 10, 5.8], [96, 81, 11.5, 6.4], [129.5, 82, 10.5, 6]] as const)
        .map(([x, y, rx, ry], i) => grp('s-peb', wash(ell(x + 1.5, y + ry * 0.75, rx * 1.15, ry * 0.42), 0.55) + stn(stoneD(x, y, rx, ry, i + 3))))
        .join('')
      return out
    },
    init: ($) => {
      gsap.set($('.s-peb'), { opacity: 0, y: -14 })
      gsap.set($('.s-cut'), { opacity: 0, scaleY: 0.2, transformOrigin: '50% 50%' })
    },
    react: ($, tl) => {
      tl.to($('.s-cut'), { opacity: 1, scaleY: 1, duration: 0.45, stagger: 0.12, ease: 'power2.out' }, 0)
        .to($('.s-seg'), { x: (i: number) => (i - 1.5) * 5, duration: 0.6, ease: 'power2.out' }, 0.35)
        .to($('.s-cut'), { opacity: 0, duration: 0.45 }, 1.05)
        .to($('.s-seg'), { y: 26, opacity: 0, scale: 0.5, transformOrigin: '50% 50%', duration: 0.7, stagger: 0.1, ease: 'power2.in' }, 1.0)
        .to($('.s-peb'), { opacity: 1, y: 0, duration: 0.9, stagger: 0.1, ease: 'back.out(1.7)' }, 1.45)
    },
  },
  // Q2 how a chatbot writes — three possible next words; the likeliest one gets written
  write: {
    draw: () => {
      const O: Pt = [86, 62]
      let out = pool(2) + ink(brush([[6, 86], [80, 87.4], [154, 85.5]], 1.1, 0.2, 0.4, 0.12), 0.2)
      out += ink(brush(scribble(9, 86, 62, 5.5, 2.1), 2.8, 0.06, 0, 0.25))
      ;([[0, 0.38, 2.8], [-17, 0.22, 2.3], [16, 0.13, 2.1]] as const).forEach(([deg, o, w], i) => {
        const pts = turn(WRITE_NEXT, O, deg)
        const e = pts[pts.length - 1]
        out += grp(`s-g${i}`, ink(brush(pts, w, 0, 0.3, 0.25)), ` opacity="${o}"`)
        out += dot(e[0] + 4.5, e[1], [2.6, 1.7, 1.3][i], i ? `em-ink s-d${i}` : 'em-ver s-d0', i ? [0, 0.35, 0.2][i] : undefined)
      })
      const k = 0.75
      const tool =
        ink(brush([[34 * k, -56 * k], [22 * k, -37 * k], [11.5 * k, -20 * k]], 5 * k, 0.04, 0.06, 0.8, 0)) +
        ink(brush([[12.5 * k, -22 * k], [8.5 * k, -14.5 * k]], 7.6 * k, 0.1, 0.1, 0.85, 0), 0.75) +
        ink(brush([[8.5 * k, -16 * k], [4 * k, -7.5 * k], [0, 0]], 9 * k, 0.22, 0.85, 0.05))
      return out + grp('s-brush', tool, ' transform="translate(104 44)"')
    },
    react: ($, tl) => {
      tl.to($('.s-g1, .s-g2, .s-d1, .s-d2'), { opacity: 0, duration: 0.9, ease: 'power2.inOut', stagger: 0.06 }, 0.15)
        .to($('.s-g0'), { opacity: 1, duration: 1.1, ease: 'power2.inOut' }, 0.35)
        .to($('.s-brush'), { x: WRITE_END[0] + 1, y: WRITE_END[1] - 3, duration: 1.3, ease: 'power3.inOut' }, 0.1)
        .to($('.s-d0'), { scale: 1.7, transformOrigin: '50% 50%', duration: 0.35, yoyo: true, repeat: 1, ease: 'power2.out' }, 1.3)
    },
  },
  // Q3 hallucination — the bright moon in the water; the mist lifts and you check the real sky
  moon: {
    draw: () => {
      const ring = arcPts(80, 27, 14, 14, -118, 212, 30)
      const end = ring[ring.length - 1]
      let out = pool(3, 80, 50, 76, 46)
      out += grp('s-moon', ink(brush(ring, 3.4, 0.08, 0.35, 0.15)) + dot(end[0] + 1.5, end[1] + 4.5, 2.1, 'em-ver'), ' opacity=".16"')
      out += `<path class="em-mist s-mist" d="${blob(80, 26, 46, 18, 5, 0.22)}"/><path class="em-mist s-mist" d="${blob(56, 34, 32, 9, 6, 0.25)}"/>`
      out += ink(brush([[10, 55], [80, 53.5], [150, 55.5]], 1.8, 0.12, 0.5, 0.12), 0.65)
      out += grp('s-ref',
        ink(brush(arcPts(80, 70, 14, 5, -150, 200, 30), 2.6, 0.1, 0.3, 0.2), 0.85) +
        ([[64, 96, 79.5], [68, 92, 85], [72.5, 87.5, 90]] as const)
          .map(([x0, x1, y], i) => grp('s-rip', ink(brush([[x0, y], [(x0 + x1) / 2, y - 0.6], [x1, y + 0.5]], 2.2 - i * 0.4, 0.2, 0.4, 0.2), 0.42 - i * 0.1)))
          .join(''))
      return out + ink(brush([[18, 66], [42, 66.6]], 1.2, 0.3, 0.5, 0.1), 0.24) + ink(brush([[114, 73], [142, 72.4]], 1.2, 0.3, 0.5, 0.1), 0.24)
    },
    react: ($, tl) => {
      tl.to($('.s-mist'), { opacity: 0, x: 26, duration: 1.8, ease: 'power2.inOut', stagger: 0.15 }, 0)
        .to($('.s-moon'), { opacity: 1, duration: 1.3, ease: 'power2.out' }, 0.45)
        .to($('.s-ref'), { opacity: 0.42, duration: 1.3 }, 0.6)
        .to($('.s-rip'), { x: 2.2, duration: 0.5, yoyo: true, repeat: 3, ease: 'sine.inOut', stagger: 0.08 }, 0.6)
    },
  },
  // Q4 diffusion — the noise clears into a mountain
  mist: {
    draw: () => {
      const r = rng(7)
      const ridge: Pt[] = [[30, 86], [52, 64], [72, 50], [90, 31], [103, 44], [115, 52], [129, 41], [143, 57], [158, 86]]
      let out = pool(4) + ground(87, 4)
      out += grp('s-mtn',
        `<path class="em-wet" d="M${spline(ridge, 6).map(P).join('L')}Z"/>` +
        ink(brush(ridge.slice(1, 8), 2.3, 0.12, 0.45, 0.12)) +
        ink(brush([[58, 72], [74, 66], [92, 71]], 1.2, 0.2, 0.5, 0.1), 0.35), ' opacity=".06"')
      out += dot(40, 25, 5.2, 'em-ver s-sun')
      for (let i = 0; i < 170; i++) out += dot(6 + r() * 148, 6 + r() * 84, 0.5 + r() * 1.3, 'em-ink s-n', +(0.15 + r() * 0.5).toFixed(2))
      return out
    },
    init: ($) => gsap.set($('.s-sun'), { opacity: 0, scale: 0.4, transformOrigin: '50% 50%' }),
    react: ($, tl) => {
      tl.to($('.s-n'), { opacity: 0, scale: 0.3, transformOrigin: '50% 50%', duration: 0.6, ease: 'power2.in', stagger: { each: 0.006, from: 'random' } }, 0)
        .to($('.s-mtn'), { opacity: 1, duration: 1.8, ease: 'power2.inOut' }, 0.25)
        .to($('.s-sun'), { opacity: 1, scale: 1, duration: 1.2, ease: 'power3.out' }, 1.0)
    },
  },
  // Q5 video — a thread through the frames holds, then frays where the object smears
  frames: {
    draw: () => {
      let out = pool(5) + ink(brush([[6, 25], [154, 25]], 1.1, 0.05, 0.05, 0.8, 0), 0.4) + ink(brush([[6, 75], [154, 75]], 1.1, 0.05, 0.05, 0.8, 0), 0.4)
      for (let x = 10; x <= 148; x += 9) out += `<rect class="em-ink" x="${x}" y="18.5" width="4" height="3" rx="0.8" opacity=".45"/><rect class="em-ink" x="${x}" y="78.5" width="4" height="3" rx="0.8" opacity=".45"/>`
      ;[12, 59, 106].forEach((x) => (out += `<path class="em-rim s-fr" d="${rr(x, 30, 42, 40, 3)}"/>`))
      out += dot(26, 58, 5) + dot(80, 49, 5)
      out += grp('s-f3', wash(blob(121, 45, 9.5, 3.6, 3, 0.25), 0.95) + `<path class="em-ink" d="${blob(129, 41, 6.4, 4.4, 5, 0.3)}" opacity=".8"/>` + dot(117, 51, 1.3, 'em-ink', 0.5))
      out += thread('M26 58C40 53 62 49 80 49', 'em-thread s-t1') + thread('M80 49C92 48.5 100 47 106 45.5L111 49.5L116 41.5L121 46L127 41', 'em-thread s-t2')
      return out
    },
    react: ($, tl) => {
      $('.s-fr').forEach((f, i) => tl.to(f, { opacity: 0.2, duration: 0.22, yoyo: true, repeat: 1, ease: 'power1.inOut' }, 0.1 + i * 0.35))
      tl.to($('.s-t1'), { attr: { 'stroke-dashoffset': 0 }, duration: 0.7, ease: 'power2.inOut' }, 0.25)
        .to($('.s-t2'), { attr: { 'stroke-dashoffset': 0 }, duration: 0.7, ease: 'power1.in' }, 0.95)
        .to($('.s-f3'), { x: 1.6, duration: 0.07, yoyo: true, repeat: 9, ease: 'none' }, 1.55)
    },
  },
  // Q6 which AI for which job — four desks; the 3D desk lifts and its cube turns
  desks: {
    draw: () => {
      const tools = [
        [44, 52, 60].map((y, i) => ink(brush([[15, y], [15 + [21, 15, 18][i], y + 0.4]], 1.9, 0.1, 0.3, 0.3))).join(''),
        rim(rr(51, 41, 22, 19, 2)) + ink(brush([[53, 58], [58.5, 50], [62, 54], [66.5, 48], [71, 58]], 1.4, 0.1, 0.3, 0.4), 0.8) + dot(67, 45.5, 1.7, 'em-ink', 0.6),
        grp('s-cube', `<path class="em-wash" d="M98 49.5L109 43.5L109 56L98 62Z"/>` + rim('M98 37.5L109 43.5L109 56L98 62L87 56L87 43.5ZM87 43.5L98 49.5L109 43.5M98 49.5V62')),
        rim(rr(121, 42, 26, 17, 2)) + rim('M129.7 42V59M138.3 42V59', 0.6) + [124, 133, 142].map((x) => `<rect class="em-ink" x="${x}" y="44" width="2" height="1.6" opacity=".5"/><rect class="em-ink" x="${x}" y="55.4" width="2" height="1.6" opacity=".5"/>`).join(''),
      ]
      let out = pool(6)
      ;[26, 62, 98, 134].forEach((x, i) => (out += grp(`s-desk s-k${i}`, wash(ell(x + 1, 83, 15, 3.4), 0.5) + stn(stoneD(x, 79, 13.5, 4.6, i + 9)) + tools[i])))
      return out + dot(98, 28.5, 2.6, 'em-ver s-pick')
    },
    init: ($) => gsap.set($('.s-pick'), { opacity: 0, scale: 0.4, transformOrigin: '50% 50%' }),
    react: ($, tl) => {
      tl.to($('.s-k0, .s-k1, .s-k3'), { opacity: 0.25, duration: 0.8, ease: 'power2.out' }, 0)
        .to($('.s-k2'), { y: -5, duration: 0.8, ease: 'power3.out' }, 0.1)
        .to($('.s-cube'), { scaleX: -1, transformOrigin: '50% 50%', duration: 0.6, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0.35)
        .to($('.s-pick'), { opacity: 1, scale: 1, duration: 0.8, ease: 'back.out(2)' }, 1.0)
    },
  },
  // Q7 prompt formula — scattered stones stack into a cairn, the vermilion one on top
  cairn: {
    draw: () => {
      let out = pool(7) + ground(91, 7) + wash(ell(81, 90.5, 27, 3.2), 0.55)
      CAIRN.forEach(([x, y, rx, ry], i) => {
        const body = i === 5 ? `<path class="em-ver" d="${stoneD(x, y, rx, ry, 31)}"/>` : stn(stoneD(x, y, rx, ry, i + 21))
        out += grp('s-cs', (i ? wash(ell(x + 1, y + ry * 0.85, rx * 1.05, ry * 0.32), 0.45) : '') + body)
      })
      return out
    },
    init: ($) => $('.s-cs').forEach((el, i) => i && gsap.set(el, { x: CAIRN_SAND[i][0] - CAIRN[i][0], y: CAIRN_SAND[i][1] - CAIRN[i][3] * 0.5 - CAIRN[i][1] })),
    react: ($, tl) =>
      $('.s-cs').forEach((el, i) => {
        if (!i) return
        const t = 0.15 + (i - 1) * 0.3
        tl.to(el, { x: 0, duration: 0.75, ease: 'power2.inOut' }, t)
          .to(el, { y: -6, duration: 0.45, ease: 'power2.out' }, t)
          .to(el, { y: 0, duration: 0.3, ease: 'power2.in' }, t + 0.45)
      }),
  },
  // Q8 agent & checkpoint — the bundle of files stops at the lantern; the lantern lights
  lantern: {
    draw: () => {
      let out = pool(8) + ink(brush([[6, 87], [80, 89], [154, 86]], 1.3, 0.2, 0.4, 0.15), 0.28)
      out += ([[14, 83, 7.5, 2.8], [34, 79, 6.8, 2.5], [55, 83, 7.2, 2.7], [118, 81, 6.5, 2.4], [138, 85, 6, 2.2]] as const)
        .map(([x, y, rx, ry], i) => stn(stoneD(x, y, rx, ry, i + 40)))
        .join('')
      out += dot(86, 54.5, 13, 'em-ver em-halo s-halo')
      out += stn(stoneD(86, 85, 12, 3.4, 51)) + ink(brush([[86, 83], [86, 63]], 5.6, 0.04, 0.04, 0.85, 0))
      out += `<rect class="em-paper" x="80.5" y="49.5" width="11" height="10" rx="1"/><rect class="em-ver s-light" x="80.5" y="49.5" width="11" height="10" rx="1"/>` + rim(rr(77, 46.5, 18, 16, 1.5))
      out += ink(brush([[68, 47.5], [77, 42], [86, 39.5], [95, 42], [104, 47.5]], 4.4, 0.25, 0.25, 0.35)) + dot(86, 35.5, 2)
      const sheet = (x: number, y: number, deg: number) => `<g transform="rotate(${deg} ${x + 9} ${y + 6.5})"><path class="em-paper" d="${rr(x, y, 18, 13, 1.2)}"/>${rim(rr(x, y, 18, 13, 1.2))}</g>`
      out += grp('s-files',
        wash(ell(25, 80, 12, 2.2), 0.5) + sheet(14, 62, -8) + sheet(15.5, 60.5, -2) + sheet(17, 59, 5) +
        ink(brush([[20.5, 63.5], [31.5, 64.6]], 1, 0.2, 0.3, 0.3, 0), 0.5) + ink(brush([[20, 67], [28.5, 67.8]], 1, 0.2, 0.3, 0.3, 0), 0.5))
      return out
    },
    init: ($) => gsap.set($('.s-light, .s-halo'), { opacity: 0 }),
    react: ($, tl) => {
      tl.to($('.s-files'), { x: 37, duration: 1.4, ease: 'power3.inOut' }, 0)
        .to($('.s-files'), { x: 34, duration: 0.5, ease: 'power2.out' }, 1.4)
        .to($('.s-light'), { opacity: 1, duration: 0.5 }, 1.2)
        .fromTo($('.s-halo'), { opacity: 0, scale: 0.5, transformOrigin: '50% 50%' }, { opacity: 0.32, scale: 1.4, duration: 1.3, ease: 'power2.out' }, 1.2)
    },
  },
  // Q9 MCP — one standard plug seats in the socket; the socket lights and reaches three apps
  plug: {
    draw: () => {
      const id = `exs-${++uid}`
      let out = pool(9) + `<defs><clipPath id="${id}"><rect x="-4" y="-8" width="168" height="116"/></clipPath></defs>`
      const apps: Pt[] = [[139, 27], [146, 54], [139, 81]]
      const glyph = [
        (x: number, y: number) => rim(`M${x - 4.2} ${y + 2.6}L${x} ${y - 4}L${x + 4.2} ${y + 2.6}Z`),
        (x: number, y: number) => rim(rr(x - 4.6, y - 3, 9.2, 6.2, 1)) + rim(`M${x - 4.4} ${y - 2.6}L${x} ${y + 0.6}L${x + 4.4} ${y - 2.6}`),
        (x: number, y: number) => rim(`M${x - 3.6} ${y}a3.6 3.6 0 1 0 7.2 0a3.6 3.6 0 1 0 -7.2 0`) + dot(x, y, 1.1),
      ]
      apps.forEach(([x, y], i) => {
        out += thread(`M108 55C118 55 ${x - 18} ${y} ${x - 10} ${y}`, 'em-line s-ln')
        out += grp('s-app', wash(ell(x + 1, y + 5.5, 10, 2.2), 0.5) + stn(stoneD(x, y, 10, 6.6, 70 + i)) + glyph[i](x, y - 0.6))
      })
      out += dot(92, 55, 21, 'em-ver s-glow')
      out += ink(brush(arcPts(92, 55, 16, 16, -150, 185, 30), 2.8, 0.08, 0.35, 0.2))
      out += `<rect class="em-ink" x="81" y="49.3" width="8.5" height="3" rx="1" opacity=".7"/><rect class="em-ink" x="81" y="57.6" width="8.5" height="3" rx="1" opacity=".7"/>`
      out += dot(104, 42.5, 2.2, 'em-ver s-led')
      out += `<g clip-path="url(#${id})"><g class="s-plug">` +
        ink(brush([[-30, 86], [-6, 84], [12, 76], [24, 63], [34, 57], [40, 55]], 3.2, 0, 0.06, 0.8, 0.04)) +
        `<path class="em-ink" d="${rr(38, 45, 20, 20, 4)}"/>` +
        `<rect class="em-ink" x="57" y="49" width="10" height="3.2" rx="1"/><rect class="em-ink" x="57" y="57.8" width="10" height="3.2" rx="1"/></g></g>`
      return out
    },
    init: ($) => {
      gsap.set($('.s-app'), { opacity: 0.35 })
      gsap.set($('.s-glow, .s-led'), { opacity: 0 })
    },
    react: ($, tl) => {
      tl.to($('.s-plug'), { x: 22, duration: 1.0, ease: 'power3.inOut' }, 0.1)
        .fromTo($('.s-glow'), { opacity: 0, scale: 0.4, transformOrigin: '50% 50%' }, { opacity: 0.3, scale: 1.25, duration: 1, ease: 'power2.out' }, 1.0)
        .to($('.s-led'), { opacity: 1, duration: 0.4 }, 1.0)
        .to($('.s-ln'), { attr: { 'stroke-dashoffset': 0 }, duration: 0.7, stagger: 0.15, ease: 'power2.out' }, 1.2)
        .to($('.s-app'), { opacity: 1, duration: 0.6, stagger: 0.15 }, 1.45)
    },
  },
  // Q10 good habits — one drop falls, and its rings spread outward (one question × billions)
  drop: {
    draw: () => {
      const d = 'M80 8C86 21 95 29 95 40A15 15 0 0 1 65 40C65 29 74 21 80 8Z'
      let out = pool(10, 80, 58, 76, 40)
      out += ink(brush([[8, 78], [80, 78.8], [152, 77.6]], 1, 0.2, 0.4, 0.1), 0.18)
      out += ([[13, 3.4, 0.8], [27, 6.4, 0.5], [43, 9.6, 0.32], [62, 13.5, 0.18]] as const)
        .map(([rx, ry, o], i) => grp('s-ring', ink(brush(arcPts(80, 78, rx, ry, 195, 520, 40), 1.9 - i * 0.25, 0.15, 0.3, 0.2), o)))
        .join('')
      out += dot(80, 78, 2, 'em-ver s-hit')
      out += grp('s-drop', `<path class="em-wash em-drop" d="${d}"/>` + rim(d))
      out += grp('s-leaf', ink(brush([[123, 89], [125.5, 79], [131, 71.5]], 1.5, 0.1, 0.3, 0.3), 0.7) + `<path class="em-moss" d="${blob(136, 68.5, 6.4, 2.8, 3, 0.12)}" transform="rotate(-28 136 68.5)"/>`)
      return out
    },
    init: ($) => gsap.set($('.s-ring, .s-hit'), { opacity: 0 }),
    react: ($, tl) => {
      tl.to($('.s-drop'), { y: 23, scaleY: 0.78, scaleX: 0.86, transformOrigin: '50% 100%', duration: 0.55, ease: 'power2.in' }, 0)
        .to($('.s-drop'), { opacity: 0, duration: 0.15 }, 0.5)
        .fromTo($('.s-hit'), { opacity: 0, scale: 0.3, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(3)' }, 0.55)
        .fromTo($('.s-ring'), { opacity: 0, scale: 0.25, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 1.6, ease: 'power2.out', stagger: 0.28 }, 0.55)
        .to($('.s-leaf'), { y: 2.2, rotation: 6, transformOrigin: '50% 100%', duration: 0.6, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 1.1)
    },
  },
}

function sceneArt(key: string) {
  const def = SCENES[key] ?? SCENES.token
  const svg = s('svg', { class: 'ex-emblem', viewBox: '-4 -4 168 108', 'aria-hidden': 'true' })
  svg.innerHTML = `<g class="em-g">${def.draw()}</g>`
  const $: Pick = (sel) => Array.from(svg.querySelectorAll(sel))
  return { svg, init: () => def.init?.($), react: (tl: TL) => def.react($, tl) }
}

// ───────────────────────── answer stones ─────────────────────────
let uid = 0
function stoneArt(slab: boolean, seed: number): SVGSVGElement {
  const [vw, vh] = slab ? [400, 84] : [280, 116]
  const cx = vw / 2, cy = slab ? 40 : 54
  const rx = slab ? 195 : 134, ry = slab ? 34 : 49
  const d = slab ? slabD(cx, cy, rx, ry, seed) : stoneD(cx, cy, rx, ry, seed)
  const r = rng(seed + 5)
  const id = `exc-${++uid}`
  const grain = [0, 1, 2].map((i) => {
    const y = cy - ry * 0.42 + i * ry * 0.3 + (r() - 0.5) * ry * 0.1
    return `<path class="st-grain" d="M${f1(cx - rx * 1.05)} ${f1(y + ry * 0.06)}Q${f1(cx + (r() - 0.5) * rx * 0.6)} ${f1(y - ry * (0.08 + r() * 0.12))} ${f1(cx + rx * 1.05)} ${f1(y)}"/>`
  })
  const svg = s('svg', { class: 'ex-stone-art', viewBox: `0 0 ${vw} ${vh}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' })
  svg.innerHTML =
    `<defs><clipPath id="${id}"><path d="${d}"/></clipPath></defs>` +
    `<ellipse class="st-shadow" cx="${f1(cx + rx * 0.05)}" cy="${f1(cy + ry * 0.82)}" rx="${f1(rx * 1.02)}" ry="${f1(ry * 0.22)}"/>` +
    `<path class="st-body" d="${d}"/>` +
    `<g clip-path="url(#${id})"><ellipse class="st-light" cx="${f1(cx - rx * 0.32)}" cy="${f1(cy - ry * 0.6)}" rx="${f1(rx * 0.72)}" ry="${f1(ry * 0.42)}"/>` +
    `<ellipse class="st-shade" cx="${f1(cx + rx * 0.35)}" cy="${f1(cy + ry * 0.85)}" rx="${f1(rx * 1.1)}" ry="${f1(ry * 0.5)}"/>${grain.join('')}` +
    `<path class="st-moss" d="${d}"/></g><path class="st-rim" d="${d}"/>`
  return svg
}

// ───────────────────────── the gate (intro art) ─────────────────────────
interface GateArt {
  back: SVGSVGElement
  svg: SVGSVGElement
  sun: SVGElement[]
  mtns: SVGElement[]
  draw: { reveal: SVGPathElement; at: number; dur: number }[]
  plaque: SVGElement[]
  stones: { g: SVGGElement; x: number; y: number; rx: number; ry: number; z: number }[]
  here: SVGElement
  birds: SVGGElement
  obs: Obs[]
  horizon: number
  focus: Pt
}

function ridge(r: () => number, x0: number, x1: number, base: number, hMin: number, hMax: number, step: number): string {
  const pts: Pt[] = []
  for (let x = x0; x <= x1 + step; x += step * (0.7 + r() * 0.6)) pts.push([x, base - (hMin + r() * (hMax - hMin))])
  return `M${f1(x0)} ${f1(base)}L${spline(pts, 8).map(P).join('L')}L${f1(pts[pts.length - 1][0])} ${f1(base)}Z`
}

/**
 * floor (portrait only): the y where the words begin — the path ends just above it, so the
 * visitor's first stone (and its vermilion ring) sits at their feet, never behind the copy.
 */
function gateArt(w: number, hh: number, portrait: boolean, drawn: boolean, floor = hh * 0.72): GateArt {
  // two layers so the morning mist can drift between the far hills and the gate
  const back = s('svg', { class: 'ex-gate', viewBox: `0 0 ${w} ${hh}`, 'aria-hidden': 'true' })
  const svg = s('svg', { class: 'ex-gate', viewBox: `0 0 ${w} ${hh}`, 'aria-hidden': 'true' })
  const defs = s('defs')
  svg.append(defs)
  const r = rng(12)
  const vx = portrait ? w / 2 : w * (w > 1100 ? 0.64 : 0.66)
  const top = 78
  const Sp = Math.min(w * 0.12, 46)
  const yNear = portrait ? Math.min(hh * 0.69, floor - Sp * 0.42) : hh * 0.91
  const gy = portrait ? yNear - (yNear - top) * 0.33 : hh * 0.79
  const gH = portrait ? Math.min((gy - top) * 0.78, w * 0.52) : Math.min(hh * 0.52, w * 0.34)
  const gW = gH * 1.18
  const H0 = gy - gH * 0.5
  const S = portrait ? Sp : Math.min(w, hh) * 0.115

  // dawn: a sun half-risen between the pillars, two washes of far hills, the horizon line
  const sunR = gH * 0.125
  const sunY = H0 - sunR * 0.2
  const halo = s('circle', { class: 'g-halo', cx: vx, cy: sunY, r: sunR * 2.6 })
  const sun = s('circle', { class: 'g-sun', cx: vx, cy: sunY, r: sunR })
  const mFar = s('path', { class: 'g-mtn far', d: ridge(r, -30, w + 30, H0 + 1, hh * 0.035, hh * 0.1, w / 8) })
  const mNear = s('path', { class: 'g-mtn near', d: ridge(r, -30, w + 30, H0 + 2, hh * 0.012, hh * 0.045, w / 13) })
  const hz = s('g', { class: 'g-hz' },
    s('path', { d: brush([[-10, H0 + 1.5], [vx - sunR * 2, H0 + 1]], 1.5, 0.02, 0.35, 0.15, 0) }),
    s('path', { d: brush([[vx + sunR * 2, H0 + 1], [w + 10, H0 + 1.5]], 1.5, 0.35, 0.02, 0.15, 0) }))
  // three birds gliding across the dawn sky, behind the gate
  const bs = Math.max(0.8, gH / 260)
  const wing = brush([[-9, -1.6], [-4.5, -3.6], [0, 0], [4.5, -3.8], [9.5, -1.8]], 1.7, 0.25, 0.25, 0.15, 0)
  const birds = s('g', null,
    ...([[0, 0, 1], [26, 9, 0.8], [-18, 15, 0.68]] as const).map(([bx, by, k]) =>
      s('g', { transform: `translate(${f1(bx * bs)} ${f1(by * bs)}) scale(${f1(k * bs * 1.3)})` }, s('path', { d: wing }))))
  back.append(halo, mFar, sun, mNear, hz, s('g', { class: 'g-birds', transform: `translate(${f1(w * 0.22)} ${f1(gy - gH * (portrait ? 1.24 : 1.2))})` }, birds))

  // ten stepping stones, receding through the gate toward the sun
  const zg = (yNear - H0) / (gy - H0)
  const stones: GateArt['stones'] = []
  const stoneG = (i: number) => {
    const z = 1 + i * 0.56
    const X = S * 1.05 * Math.sin(i * 1.2 + 0.7) * (i === 0 ? 0.5 : 1)
    const x = vx + X / z
    const y = H0 + (yNear - H0) / z
    const rx = (S / z) * (0.86 + r() * 0.28)
    const ry = rx * (0.36 - i * 0.012)
    const g = s('g', { class: 'g-stone', opacity: f1(1 - i * 0.06) })
    g.innerHTML =
      `<ellipse class="g-cshadow" cx="${f1(x + rx * 0.14)}" cy="${f1(y + ry * 0.72)}" rx="${f1(rx * 1.14)}" ry="${f1(ry * 0.42)}"/>` +
      `<path class="g-sbody" d="${stoneD(x, y, rx, ry, i + 60)}"/>` +
      `<ellipse class="g-shi" cx="${f1(x - rx * 0.28)}" cy="${f1(y - ry * 0.4)}" rx="${f1(rx * 0.46)}" ry="${f1(ry * 0.28)}"/>` +
      `<path class="g-srim" d="${stoneD(x, y, rx, ry, i + 60)}"/>`
    stones.push({ g, x, y, rx, ry, z })
    return g
  }
  const behind = s('g'), front = s('g')
  for (let i = 9; i >= 0; i--) (1 + i * 0.56 < zg ? front : behind).append(stoneG(i))
  stones.reverse()

  // the gate: pillars brushed downward, the curved lintel left → right, then the tie beam, then the plaque
  let k = 0
  const draw: GateArt['draw'] = []
  const stroke = (pts: Pt[], w2: number, a: number, b: number, min: number, at: number, dur: number, dry = false) => {
    const id = `exg-${++uid}`
    const C = spline(pts, 10)
    const reveal = s('path', { d: `M${C.map(P).join('L')}`, fill: 'none', stroke: '#fff', 'stroke-width': f1(w2 * 2.6), 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': drawn ? 0 : 1 })
    defs.append(s('mask', { id, maskUnits: 'userSpaceOnUse', x: -20, y: -20, width: w + 40, height: hh + 40 }, reveal))
    const d = brush(pts, w2, a, b, min, 0.05)
    // a wet stroke: bleed beneath, the body, a paler wash pooled inside, and the darker edge where the ink gathers
    const g = s('g', { mask: `url(#${id})` },
      s('path', { class: 'g-bleed', d }),
      s('path', { class: 'g-ink', d }),
      s('path', { class: 'g-inner', d: brush(pts, w2 * 0.46, a + 0.04, b + 0.06, min, 0.14) }),
      s('path', { class: 'g-edge', d }))
    if (dry) {
      // flying white where the brush runs dry: tapered paper hairs of uneven length, broken by random gaps
      const T = spline(pts, 14)
      const tail = T.slice(Math.floor(T.length * 0.55))
      const n = tail.length
      const nrm = tail.map((_, i) => {
        const A = tail[Math.max(0, i - 1)], B = tail[Math.min(n - 1, i + 1)]
        const L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1
        return [-(B[1] - A[1]) / L, (B[0] - A[0]) / L] as Pt
      })
      for (let j = 0; j < 8; j++) {
        const o = (r() - 0.5) * w2 * 0.74
        let i = Math.floor(r() * n * 0.4)
        while (i < n - 2) {
          const len = 3 + Math.floor(r() * n * 0.35)
          const seg = tail.slice(i, Math.min(n, i + len)).map((p, q) => [p[0] + nrm[i + q][0] * o, p[1] + nrm[i + q][1] * o] as Pt)
          if (seg.length > 2) g.append(s('path', { class: 'g-dry', d: brush(seg, Math.max(0.6, w2 * (0.03 + r() * 0.08)), 0.35, 0.45, 0.05, 0) }))
          i += len + 2 + Math.floor(r() * n * 0.2)
        }
      }
    }
    draw.push({ reveal, at, dur })
    k++
    return g
  }
  const pw = gW * 0.062
  const pillars = [-1, 1].map((sd, i) => stroke([[vx + sd * gW * 0.315, gy - gH * 0.93], [vx + sd * gW * 0.323, gy - gH * 0.45], [vx + sd * gW * 0.33, gy]], pw, 0.05, 0.08, 0.82, 0.4 + i * 0.22, 1.0, true))
  const shadows = [-1, 1].map((sd) => {
    const bx = vx + sd * gW * 0.33
    const L = gH * 0.3, dx = sd * gW * 0.07
    return s('path', { class: 'g-shadow', d: `M${f1(bx - pw / 2)} ${f1(gy)}L${f1(bx + pw / 2)} ${f1(gy)}L${f1(bx + dx + pw * 0.9)} ${f1(gy + L)}L${f1(bx + dx - pw * 0.7)} ${f1(gy + L)}Z` })
  })
  const kasagi = stroke([[vx - gW * 0.63, gy - gH * 1.05], [vx - gW * 0.42, gy - gH * 0.992], [vx, gy - gH * 0.978], [vx + gW * 0.42, gy - gH * 0.992], [vx + gW * 0.63, gy - gH * 1.05]], gH * 0.072, 0.1, 0.16, 0.38, 1.0, 1.1, true)
  const shimaki = stroke([[vx - gW * 0.53, gy - gH * 0.922], [vx + gW * 0.53, gy - gH * 0.918]], gH * 0.034, 0.04, 0.06, 0.78, 1.55, 0.8)
  const nuki = stroke([[vx - gW * 0.47, gy - gH * 0.728], [vx + gW * 0.47, gy - gH * 0.722]], gH * 0.042, 0.04, 0.06, 0.82, 1.8, 0.9, true)
  const ph = gH * 0.12, pW = gW * 0.08
  const pcy = gy - gH * 0.823
  const plaque = s('g', { class: 'g-plaque' },
    s('path', { class: 'g-plaque-bg', d: rr(vx - pW / 2, pcy - ph / 2, pW, ph, 2) }),
    s('rect', { class: 'g-seal', x: f1(vx - pW * 0.22), y: f1(pcy - ph * 0.3), width: f1(pW * 0.44), height: f1(ph * 0.6), rx: 1.2 }))
  const footings = [-1, 1].map((sd, i) => {
    const x = vx + sd * gW * 0.33
    const g = s('g', { class: 'g-stone' })
    g.innerHTML = `<ellipse class="g-cshadow" cx="${f1(x + pw * 0.2)}" cy="${f1(gy + pw * 0.22)}" rx="${f1(pw * 1.3)}" ry="${f1(pw * 0.34)}"/><path class="g-sbody" d="${stoneD(x, gy, pw * 1.05, pw * 0.38, 80 + i)}"/><path class="g-srim" d="${stoneD(x, gy, pw * 1.05, pw * 0.38, 80 + i)}"/>`
    return g
  })
  const gate = s('g', { class: 'g-gate' }, ...pillars, kasagi, shimaki, nuki, plaque)
  // the visitor's first stone breathes
  const s0 = stones[0]
  const here = s('ellipse', { class: 'g-here', cx: f1(s0.x), cy: f1(s0.y), rx: f1(s0.rx * 1.35), ry: f1(s0.ry * 1.6) })
  svg.append(behind, ...shadows, gate, ...footings, front, here)

  const obs: Obs[] = stones.map((st) => ({ x: st.x, y: st.y, hw: st.rx, hh: st.ry, sq: st.ry / st.rx, s: 1 / st.z }))
  footings.forEach((_, i) => obs.push({ x: vx + (i ? 1 : -1) * gW * 0.33, y: gy, hw: pw * 1.05, hh: pw * 0.38, sq: 0.34, s: 1 / zg }))
  return { back, svg, sun: [halo, sun], mtns: [mFar, mNear, hz], draw, plaque: [plaque, ...footings, ...shadows], stones, here, birds, obs, horizon: H0, focus: [vx, gy - gH * 0.42] }
}

// ───────────────────────── the certificate (fixed light paper, always looks the same) ─────────────────────────
const CW = 1600
const CH = 1131
const PAL = { paper: '#f3efe6', ink: '#1f1d1a', ink2: '#4b4741', ink3: '#7a746a', ver: '#c8402a', moss: '#56704a', hi: '#efebe2', mid: '#cdc7ba', lo: '#9a9488' }
const SERIF = '"Noto Serif", Georgia, serif'

function paperTexture(g: CanvasRenderingContext2D) {
  const r = rng(20261012)
  g.fillStyle = PAL.paper
  g.fillRect(0, 0, CW, CH)
  for (let i = 0; i < 16; i++) {
    const x = r() * CW, y = r() * CH, rad = 160 + r() * 460
    const gr = g.createRadialGradient(x, y, 0, x, y, rad)
    gr.addColorStop(0, `rgba(206,190,158,${(0.05 + r() * 0.07).toFixed(3)})`)
    gr.addColorStop(1, 'rgba(206,190,158,0)')
    g.fillStyle = gr
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2)
  }
  g.lineCap = 'round'
  const fibre = (n: number, col: string, a0: number, a1: number, l0: number, l1: number) => {
    for (let i = 0; i < n; i++) {
      const x = r() * CW, y = r() * CH, len = l0 + r() * (l1 - l0), a = r() * Math.PI * 2, bend = (r() - 0.5) * len * 0.4
      g.strokeStyle = `rgba(${col},${(a0 + r() * (a1 - a0)).toFixed(3)})`
      g.lineWidth = 0.5 + r() * 0.9
      g.beginPath()
      g.moveTo(x, y)
      g.quadraticCurveTo(x + (Math.cos(a) * len) / 2 - Math.sin(a) * bend, y + (Math.sin(a) * len) / 2 + Math.cos(a) * bend, x + Math.cos(a) * len, y + Math.sin(a) * len)
      g.stroke()
    }
  }
  fibre(1700, '122,102,70', 0.025, 0.075, 6, 30)
  fibre(600, '255,255,252', 0.25, 0.6, 8, 40)
  fibre(140, '122,102,70', 0.03, 0.06, 40, 110)
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(90,74,48,${(0.04 + r() * 0.1).toFixed(3)})`
    g.fillRect(r() * CW, r() * CH, 1 + r() * 1.2, 1 + r() * 1.2)
  }
  const vg = g.createRadialGradient(CW / 2, CH / 2, CH * 0.42, CW / 2, CH / 2, CW * 0.74)
  vg.addColorStop(0, 'rgba(120,96,60,0)')
  vg.addColorStop(1, 'rgba(120,96,60,0.17)')
  g.fillStyle = vg
  g.fillRect(0, 0, CW, CH)
}

/**
 * The brushed ensō: a bleeding shadow, the body with uneven pressure, flying-white hairs inside
 * where the brush dries, and tapered bristles that run on past the lift-off.
 * ink = "r,g,b"; hair = "r,g,b" of the paper, or null to cut the hairs out (transparent canvas, any theme).
 */
function ensoOn(g: CanvasRenderingContext2D, cx: number, cy: number, R: number, seed: number, ink = '31,29,26', hair: string | null = '243,239,230') {
  const b = ensoBrush(seed)
  const k = R / 76
  const body = new Path2D(b.body)
  // the ensō's centre-line radius and body width at t (t may run a little past 1 for the bristles)
  const radAt = (t: number) => 76 + Math.sin(t * 7 + seed) * 1.8 + Math.sin(t * 19 + seed * 2) * 0.7 + (t > 0.85 ? (t - 0.85) * 22 : 0)
  const widthAt = (t: number) => 16 * (t < 0.05 ? 0.7 + (t / 0.05) * 0.5 : 1.2 - 0.3 * t) * (t > 0.74 ? Math.max(0.08, 1 - ((t - 0.74) / 0.26) * 0.92) : 1)
  const at = (t: number, off: number): Pt => {
    const a = -2.05 + Math.PI * 1.8 * t
    const rad = radAt(t) + off
    return [100 + Math.cos(a) * rad, 100 + Math.sin(a) * rad]
  }
  g.save()
  g.translate(cx - 100 * k, cy - 100 * k)
  g.scale(k, k)
  g.save()
  g.shadowColor = `rgba(${ink},0.3)`
  g.shadowBlur = 16 * Math.min(1.6, k / 2)
  g.shadowOffsetX = 2
  g.shadowOffsetY = 3
  g.fillStyle = `rgba(${ink},0.2)`
  g.fill(body)
  g.restore()
  const gr = g.createLinearGradient(20, 10, 180, 190)
  gr.addColorStop(0, `rgba(${ink},0.97)`)
  gr.addColorStop(0.6, `rgba(${ink},0.9)`)
  gr.addColorStop(1, `rgba(${ink},0.78)`)
  g.fillStyle = gr
  g.fill(body)
  const r = rng(seed * 97 + 5)
  g.lineCap = 'round'
  g.save()
  g.clip(body)
  if (!hair) g.globalCompositeOperation = 'destination-out'
  const hc = hair ?? '0,0,0'
  for (let i = 0; i < 90; i++) {
    const t0 = 0.46 + r() * 0.48
    const t1 = Math.min(1.02, t0 + 0.05 + r() * 0.3)
    const o = (r() - 0.5) * 15
    g.strokeStyle = `rgba(${hc},${(0.18 + r() * 0.7 * (t0 - 0.36)).toFixed(3)})`
    g.lineWidth = 0.2 + r() * 0.6
    g.beginPath()
    for (let t = t0; t <= t1; t += 0.004) {
      const p = at(t, o * (t > 0.74 ? 1 - ((t - 0.74) / 0.26) * 0.85 : 1))
      if (t === t0) g.moveTo(p[0], p[1])
      else g.lineTo(p[0], p[1])
    }
    g.stroke()
  }
  g.restore()
  // bristles past the lift-off: each tapers and thins, broken by a gap or two
  for (let i = 0; i < 16; i++) {
    const off = (r() - 0.5) * 1.1
    let t = 0.8 + r() * 0.1
    const end = 0.99 + r() * 0.07
    const w0 = 0.35 + r() * 1.1
    while (t < end) {
      const piece = 0.025 + r() * 0.07
      const stop = Math.min(end, t + piece)
      for (let u = t; u < stop; u += 0.004) {
        const f = (u - 0.8) / (end - 0.8)
        const p = at(u, off * widthAt(Math.min(u, 1)) * 0.9)
        const q = at(u + 0.004, off * widthAt(Math.min(u + 0.004, 1)) * 0.9)
        g.strokeStyle = `rgba(${ink},${(0.55 * (1 - f) ** 0.8).toFixed(3)})`
        g.lineWidth = Math.max(0.15, w0 * (1 - f) ** 0.7)
        g.beginPath()
        g.moveTo(p[0], p[1])
        g.lineTo(q[0], q[1])
        g.stroke()
      }
      t = stop + 0.008 + r() * 0.03
    }
  }
  g.restore()
  return b
}

/** round: Part 2's seal — a round stamp with a ring cut inside, instead of Part 1's square one. */
function sealImage(lines: string[], round = false): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = 200
  const g = c.getContext('2d')!
  const r = rng(round ? 78 : 77)
  const j = () => (r() - 0.5) * 5
  const pts: Pt[] = [[22 + j(), 20 + j()], [100 + j(), 17 + j()], [180 + j(), 21 + j()], [183 + j(), 100 + j()], [179 + j(), 181 + j()], [100 + j(), 184 + j()], [20 + j(), 179 + j()], [17 + j(), 100 + j()]]
  g.fillStyle = PAL.ver
  g.fill(new Path2D(round ? blob(100, 100, 86, 86, 9, 0.025, 16) : closed(pts, 1 / 9)))
  g.strokeStyle = PAL.paper
  g.lineWidth = 4.5
  g.stroke(new Path2D(round ? ell(100, 100, 66, 66) : rr(36, 35, 128, 130, 6)))
  g.fillStyle = PAL.paper
  g.textAlign = 'center'
  g.textBaseline = 'alphabetic'
  g.font = `500 54px ${SERIF}`
  g.fillText(lines[0] ?? '', 100, 94)
  g.font = `500 44px ${SERIF}`
  g.fillText(lines[1] ?? '', 100, 145)
  // a real stamp never inks evenly: knock out specks and soft worn patches
  g.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < 520; i++) {
    // more wear along the rim than in the middle
    let x = 16 + r() * 168, y = 16 + r() * 168
    if (r() < 0.5) {
      const side = Math.floor(r() * 4)
      const e = 14 + r() * 14
      if (side === 0) x = e
      else if (side === 1) x = 200 - e
      else if (side === 2) y = e
      else y = 200 - e
    }
    g.globalAlpha = 0.25 + r() * 0.75
    g.beginPath()
    g.arc(x, y, 0.4 + r() * 1.8, 0, Math.PI * 2)
    g.fill()
  }
  for (let i = 0; i < 7; i++) {
    const x = 20 + r() * 160, y = 20 + r() * 160, rad = 10 + r() * 22
    const gr = g.createRadialGradient(x, y, 0, x, y, rad)
    gr.addColorStop(0, 'rgba(0,0,0,0.32)')
    gr.addColorStop(1, 'rgba(0,0,0,0)')
    g.globalAlpha = 1
    g.fillStyle = gr
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2)
  }
  return c
}

function certStone(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, seed: number) {
  // soft contact shadow: draw the ellipse off-canvas and keep only its blurred shadow
  g.save()
  g.shadowColor = 'rgba(31,29,26,0.2)'
  g.shadowBlur = 6
  g.shadowOffsetX = 10000
  g.fillStyle = '#000'
  g.beginPath()
  g.ellipse(x + rx * 0.12 - 10000, y + ry * 0.7, rx * 1.12, ry * 0.4, 0, 0, Math.PI * 2)
  g.fill()
  g.restore()
  const p = new Path2D(stoneD(x, y, rx, ry, seed))
  const gr = g.createLinearGradient(x - rx, y - ry, x + rx * 0.6, y + ry)
  gr.addColorStop(0, PAL.hi)
  gr.addColorStop(0.55, PAL.mid)
  gr.addColorStop(1, PAL.lo)
  g.fillStyle = gr
  g.fill(p)
  g.strokeStyle = 'rgba(31,29,26,0.32)'
  g.lineWidth = 1.2
  g.stroke(p)
}

const pad2 = (n: number) => String(n).padStart(2, '0')
const today = () => {
  const d = new Date()
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`
}

/** Everything except the name: paper, frame, title, lines, ensō with the score, seal, one stone per station of the part. */
function certBackground(score: number, right: boolean[], date: string, line1: string): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = CW
  c.height = CH
  const g = c.getContext('2d')!
  const C = D.cert
  paperTexture(g)
  // frame: two hairlines
  g.strokeStyle = 'rgba(31,29,26,0.34)'
  g.lineWidth = 1.6
  g.strokeRect(40, 40, CW - 80, CH - 80)
  g.strokeStyle = 'rgba(31,29,26,0.14)'
  g.lineWidth = 1
  g.strokeRect(52, 52, CW - 104, CH - 104)

  // the garden band: one stepping stone per station of this part, raked into the sand, two rocks at the end
  const ns = stationsOfPart(PART).length
  const rs = rng(ns)
  const path: { x: number; y: number; rx: number; ry: number }[] = []
  for (let i = 0; i < ns; i++) path.push({ x: 150 + (i * 1003) / (ns - 1) + (rs() - 0.5) * 12, y: 1016 + Math.sin(i * 0.72 + 0.4) * 13 + (i % 2 ? 5 : -4), rx: 11 + rs() * 7, ry: 0 }); path.forEach((p) => (p.ry = p.rx * (0.36 + rs() * 0.1)))
  const big = [{ x: 1326, y: 1010, rx: 60, ry: 25 }, { x: 1432, y: 1034, rx: 31, ry: 12.5 }]
  const obs: Obs[] = [...path, ...big].map((p) => ({ x: p.x, y: p.y + p.ry * 0.1, hw: p.rx * 1.02, hh: p.ry * 1.05 }))
  const rows: number[] = []
  for (let y = 952; y < 1072; y += 11) rows.push(y)
  const rake = rakePath([66, 940, 1534, 1072], rows, obs, 11, 3, 2.6)
  // rake on its own layer so it can fade out at the ends and toward the words
  const lay = document.createElement('canvas')
  lay.width = CW
  lay.height = CH
  const l = lay.getContext('2d')!
  l.lineWidth = 1.2
  ;[...rake.rows, rake.rings].forEach((p, i) => {
    l.globalAlpha = [1, 0.75, 0.55, 1][i]
    l.translate(0, -1)
    l.strokeStyle = 'rgba(255,255,250,0.45)'
    l.stroke(p)
    l.translate(0, 1)
    l.strokeStyle = 'rgba(31,29,26,0.17)'
    l.stroke(p)
  })
  l.globalAlpha = 1
  l.globalCompositeOperation = 'destination-in'
  const fx = l.createLinearGradient(56, 0, CW - 56, 0)
  fx.addColorStop(0, 'rgba(0,0,0,0)')
  fx.addColorStop(0.1, 'rgba(0,0,0,1)')
  fx.addColorStop(0.9, 'rgba(0,0,0,1)')
  fx.addColorStop(1, 'rgba(0,0,0,0)')
  l.fillStyle = fx
  l.fillRect(0, 0, CW, CH)
  const fy = l.createLinearGradient(0, 944, 0, 990)
  fy.addColorStop(0, 'rgba(0,0,0,0)')
  fy.addColorStop(1, 'rgba(0,0,0,1)')
  l.fillStyle = fy
  l.fillRect(0, 0, CW, CH) // destination-in clears outside the filled shape, so cover the whole sheet
  g.drawImage(lay, 0, 0)
  // paper beneath the cleared rake, then the stones
  path.forEach((p, i) => certStone(g, p.x, p.y, p.rx, p.ry, i + 100))
  big.forEach((p, i) => certStone(g, p.x, p.y, p.rx, p.ry, i + 140))

  // brand: the small ensō + vermilion dot, "AI Zen"
  const bx = 128, by = 108
  const mark = ensoOn(g, bx + 32, by + 32, 24, 3)
  const mk = 24 / 76
  g.fillStyle = PAL.ver
  g.beginPath()
  g.arc(bx + 32 + (mark.end[0] + 8 - 100) * mk, by + 32 + (mark.end[1] + 16 - 100) * mk, 15 * mk, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = PAL.ink
  g.textBaseline = 'alphabetic'
  g.font = `400 30px ${SERIF}`
  g.fillText(C.brand, bx + 80, by + 43)

  // the words
  const x0 = 128
  g.fillStyle = PAL.ink
  g.font = `300 128px ${SERIF}`
  g.fillText(C.title, x0 - 5, 376)
  g.fillStyle = 'rgba(31,29,26,0.82)'
  g.fill(new Path2D(brush([[x0 + 4, 424], [x0 + 170, 419], [x0 + 350, 422]], 6, 0.06, 0.6, 0.08, 0.1)))
  g.fillStyle = PAL.ink3
  g.font = `400 30px ${SERIF}`
  g.fillText(C.presented, x0, 520)
  g.fillStyle = PAL.ink2
  g.font = `300 38px ${SERIF}`
  g.fillText(line1, x0, 790)
  g.fillStyle = PAL.ink
  g.font = `400 46px ${SERIF}`
  g.fillText(C.line2, x0, 852)
  g.fillStyle = PAL.ink3
  g.font = `400 26px ${SERIF}`
  g.fillText(fill(C.date, { date }), x0, 912)

  // the score inside a brushed ensō, and the ten stones of this exam beneath it
  const cx = 1240, cy = 470, R = 246
  ensoOn(g, cx, cy, R, 5)
  g.textAlign = 'center'
  const big1 = String(score), of = `/${N}`
  g.font = `300 196px ${SERIF}`
  const w1 = g.measureText(big1).width
  g.font = `300 58px ${SERIF}`
  const w2 = g.measureText(of).width
  const sx = cx - (w1 + w2 + 6) / 2
  g.textAlign = 'left'
  g.fillStyle = PAL.ink
  g.font = `300 196px ${SERIF}`
  g.fillText(big1, sx, cy + 58)
  g.fillStyle = PAL.ink3
  g.font = `300 58px ${SERIF}`
  g.fillText(of, sx + w1 + 6, cy + 58)
  g.textAlign = 'center'
  g.font = `400 25px ${SERIF}`
  g.fillText(C.scoreLabel, cx, cy + 110)
  right.forEach((ok, i) => {
    const x = cx + (i - (N - 1) / 2) * 22
    const y = cy + 150 + (i % 2 ? 2 : -1)
    g.beginPath()
    g.ellipse(x, y, 7, 5, (i % 3) * 0.2 - 0.2, 0, Math.PI * 2)
    if (ok) {
      g.fillStyle = PAL.moss
      g.fill()
    } else {
      g.strokeStyle = 'rgba(31,29,26,0.4)'
      g.lineWidth = 1.4
      g.stroke()
    }
  })
  g.textAlign = 'left'
  // the vermilion seal, pressed below the ensō like the signature seal on a painting
  g.save()
  g.translate(cx + R * 0.66, cy + R * 1.6)
  g.rotate(-0.06)
  g.globalAlpha = 0.95
  g.globalCompositeOperation = 'multiply'
  g.drawImage(sealImage(C.seal, PART === 2), -56, -56, 112, 112)
  g.restore()
  if (PART === 2) certMoon(g, 1452, 126, 40)
  return c
}

/** Vườn Trăng: a pale moon in the top corner — a soft halo, an ivory wash, a hairline of ink, two faint seas. */
function certMoon(g: CanvasRenderingContext2D, x: number, y: number, R: number) {
  g.save()
  const halo = g.createRadialGradient(x, y, R * 0.8, x, y, R * 2.6)
  halo.addColorStop(0, 'rgba(214,188,120,0.2)')
  halo.addColorStop(1, 'rgba(214,188,120,0)')
  g.fillStyle = halo
  g.fillRect(x - R * 2.6, y - R * 2.6, R * 5.2, R * 5.2)
  const disc = new Path2D(blob(x, y, R, R, 4, 0.02, 18))
  const body = g.createRadialGradient(x - R * 0.35, y - R * 0.35, R * 0.1, x, y, R * 1.05)
  body.addColorStop(0, '#fdf8e8')
  body.addColorStop(1, '#efe0b4')
  g.fillStyle = body
  g.fill(disc)
  g.fillStyle = 'rgba(160,140,96,0.16)'
  g.fill(new Path2D(blob(x + R * 0.22, y - R * 0.12, R * 0.34, R * 0.26, 6, 0.2)))
  g.fill(new Path2D(blob(x - R * 0.3, y + R * 0.32, R * 0.22, R * 0.16, 8, 0.2)))
  g.strokeStyle = 'rgba(31,29,26,0.3)'
  g.lineWidth = 1.4
  g.stroke(disc)
  g.restore()
}

function certCompose(out: HTMLCanvasElement, bg: HTMLCanvasElement, name: string) {
  const g = out.getContext('2d')!
  g.clearRect(0, 0, CW, CH)
  g.drawImage(bg, 0, 0)
  const x0 = 128, maxW = 740
  const text = name.trim() || D.cert.namePlaceholder
  let size = 100
  g.font = `400 ${size}px ${SERIF}`
  const wm = g.measureText(text).width
  if (wm > maxW) size = Math.max(40, Math.floor((size * maxW) / wm))
  g.font = `400 ${size}px ${SERIF}`
  g.textBaseline = 'alphabetic'
  g.fillStyle = name.trim() ? PAL.ink : 'rgba(31,29,26,0.22)'
  g.fillText(text, x0 - 2, 650)
  const w = Math.max(420, Math.min(maxW, g.measureText(text).width))
  g.fillStyle = 'rgba(31,29,26,0.3)'
  g.fill(new Path2D(brush([[x0, 686], [x0 + w / 2, 684], [x0 + w + 20, 687]], 2.4, 0.04, 0.5, 0.1, 0.1)))
}

async function fontsReady() {
  const sample = 'Chứng nhận Trao cho đã đi hết trạm Hiểu dùng đúng cách Ngày Bài thi cuối AIZen 0123456789/ ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ'
  try {
    await Promise.all(['300 60px', '400 60px', '500 60px'].map((f) => document.fonts.load(`${f} "Noto Serif"`, sample)))
    await document.fonts.ready
  } catch {
    /* fall back to whatever serif is there */
  }
}

const slug = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)

// ───────────────────────── page ─────────────────────────
interface Stage {
  el: HTMLElement
  /** obstacles the rake flows around, in page px */
  obs(): Obs[]
  /** horizon y when the sand is seen in perspective */
  horizon?(): number
  /** y where the raked band reaches full strength (it fades out above) */
  band?(): number
  rings?: number
  /** areas where the sand is left smooth so the words read calmly */
  calm?(): HTMLElement[]
  layout?(): void
  /** redraw theme-dependent canvases */
  repaint?(): void
  destroy?(): void
}

/** "r,g,b" of any CSS colour (canvas normalises it to #rrggbb or rgba()). */
function rgbOf(col: string): string {
  const c = document.createElement('canvas').getContext('2d')!
  c.fillStyle = '#000'
  c.fillStyle = col
  const v = String(c.fillStyle)
  if (v[0] === '#') return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16)).join(',')
  return v.replace(/rgba?\(|\)|\s/g, '').split(',').slice(0, 3).join(',')
}

export function render(root: HTMLElement, { part = 1 }: { part?: number } = {}): () => void {
  PART = part
  D = part === 2 ? data2 : data
  N = D.questions.length
  // Part 2 keeps its own result: Part 1's 'exam' key is never touched from here
  const KEY = part === 2 ? 'exam2' : 'exam'
  setCrumb(D.title)
  const reduced = prefs.reduced
  const sand = h('canvas', { class: 'ex-sand', 'aria-hidden': 'true' })
  const fx = h('canvas', { class: 'ex-fx', 'aria-hidden': 'true' })
  const defs = s('svg', { class: 'ex-defs', width: 0, height: 0, 'aria-hidden': 'true' })
  defs.innerHTML =
    '<defs><linearGradient id="ex-stg" x1="0.1" y1="0" x2="0.7" y2="1"><stop offset="0" class="ex-g0"/><stop offset=".55" class="ex-g1"/><stop offset="1" class="ex-g2"/></linearGradient>' +
    '<linearGradient id="ex-sta" x1="0.15" y1="0" x2="0.6" y2="1"><stop offset="0" class="ex-a0"/><stop offset=".6" class="ex-a1"/><stop offset="1" class="ex-a2"/></linearGradient>' +
    '<radialGradient id="ex-sun"><stop offset="0" class="ex-s0"/><stop offset=".55" class="ex-s1"/><stop offset="1" class="ex-s2"/></radialGradient></defs>'
  const app = h('section', { class: 'ex', 'aria-label': D.title }, defs, sand, fx)
  root.append(app)

  let alive = true
  const timers = new Set<number>()
  const later = (fn: () => void, ms: number) => {
    const t = window.setTimeout(() => {
      timers.delete(t)
      if (alive) fn()
    }, ms)
    timers.add(t)
  }
  const gctx = gsap.context(() => {}, app)
  const anim = <T>(fn: () => T): T => {
    let out!: T
    gctx.add(() => {
      out = fn()
    })
    return out
  }

  const saved = load<Saved>(KEY, {})
  let name = typeof saved.name === 'string' ? saved.name.slice(0, 40) : ''
  let picks: number[] = []
  const rightOf = (p: number[]) => D.questions.map((q, i) => p[i] === q.answer)

  let W = 0, H = 0, dpr = 1
  const portrait = () => H > W * 1.05
  let stage: Stage | null = null

  /** page-px rect of an element ignoring transforms (stones may be mid-tween when the sand is raked) */
  const box = (el: HTMLElement) => {
    let x = 0, y = 0
    let e: HTMLElement | null = el
    while (e && e !== app) {
      x += e.offsetLeft
      y += e.offsetTop
      e = e.offsetParent as HTMLElement | null
    }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight }
  }

  // ── sand ──
  function paintSand() {
    if (!stage || !W) return
    const g = sand.getContext('2d')!
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, W, H)
    const gap = clamp(Math.min(W, H) / 76, 8, 14)
    const hz = stage.horizon?.()
    const rows: number[] = []
    if (hz == null) for (let y = gap * 0.6; y < H; y += gap) rows.push(y)
    else {
      const Dp = H - hz
      for (let z = 1, dz = gap / Dp; ; z += dz) {
        const y = hz + Dp / z
        if (y - hz < 3 || gap / (z * z) < 1.1) break
        rows.push(y)
      }
    }
    // ponytail: coarser contour grid on big or low-power screens; per-row obstacle culling does the rest
    const low = prefs.quality === 'low'
    const coarse = low || W * H > 1.5e6
    const rk = rakePath([-2, hz ?? 0, W + 2, H], rows, stage.obs(), gap, low ? 2 : stage.rings ?? 3, 3, coarse ? 7 : 4)
    const hi = cssVar('--rake-hi'), lo = cssVar('--rake')
    g.lineWidth = 1.05
    ;[...rk.rows, rk.rings].forEach((p, i) => {
      g.globalAlpha = [1, 0.74, 0.52, 1][i]
      g.translate(0, -0.9)
      g.strokeStyle = hi
      g.stroke(p)
      g.translate(0, 0.9)
      g.strokeStyle = lo
      g.stroke(p)
    })
    g.globalAlpha = 1
    g.globalCompositeOperation = 'destination-out'
    // the field softens toward the screen edges…
    const ex = Math.min(140, W * 0.09)
    const el = g.createLinearGradient(0, 0, ex, 0)
    el.addColorStop(0, 'rgba(0,0,0,1)')
    el.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = el
    g.fillRect(0, 0, ex, H)
    const er = g.createLinearGradient(W - ex, 0, W, 0)
    er.addColorStop(0, 'rgba(0,0,0,0)')
    er.addColorStop(1, 'rgba(0,0,0,1)')
    g.fillStyle = er
    g.fillRect(W - ex, 0, ex, H)
    // …and above the band where the stones lie
    const bt = stage.band?.()
    if (bt != null) {
      const f = g.createLinearGradient(0, bt - H * 0.28, 0, bt)
      f.addColorStop(0, 'rgba(0,0,0,1)')
      f.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = f
      g.fillRect(0, 0, W, bt)
    }
    // smooth sand under the words
    for (const c of stage.calm?.() ?? []) {
      const b = box(c)
      if (!b.w || !b.h) continue
      g.save()
      g.translate(b.x + b.w / 2, b.y + b.h / 2)
      g.scale(b.w / 2 + 70, b.h / 2 + 46)
      const rg = g.createRadialGradient(0, 0, 0, 0, 0, 1)
      rg.addColorStop(0, 'rgba(0,0,0,1)')
      rg.addColorStop(0.64, 'rgba(0,0,0,1)')
      rg.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = rg
      g.fillRect(-1, -1, 2, 2)
      g.restore()
    }
    if (hz != null) {
      // the far sand dissolves into the morning haze
      const f = g.createLinearGradient(0, hz, 0, hz + (H - hz) * 0.42)
      f.addColorStop(0, 'rgba(0,0,0,1)')
      f.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = f
      g.fillRect(0, hz - 2, W, H - hz + 2)
    }
    g.globalCompositeOperation = 'source-over'
  }
  function resandSoon(fade = true) {
    if (reduced || !fade) return paintSand()
    anim(() =>
      gsap.to(sand, {
        opacity: 0.15, duration: 0.35, ease: 'power1.in',
        onComplete: () => {
          if (!alive) return
          paintSand()
          gsap.to(sand, { opacity: 1, duration: 1, ease: 'power2.out' })
        },
      }))
  }

  // ── ripples & dust (only animates while something moves) ──
  type Ripple = { x: number; y: number; rx: number; ry: number; k: number; t: number; col: string; life: number; reach: number }
  const ripples: Ripple[] = []
  let motes: { x: number; y: number; v: number; r: number; ph: number }[] | null = null
  const fxg = fx.getContext('2d')!
  let inkCol = cssVar('--ink') // re-read in onPrefs (theme), never per frame
  const loop = createLoop(fx, (_, dt) => {
    const now = performance.now()
    fxg.setTransform(dpr, 0, 0, dpr, 0, 0)
    fxg.clearRect(0, 0, W, H)
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i]
      const age = (now - rp.t) / 1000 / rp.life
      if (age >= 1) {
        ripples.splice(i, 1)
        continue
      }
      for (let j = 0; j < 3; j++) {
        const a = age - j * 0.11
        if (a <= 0) continue
        const e = 1 - Math.pow(1 - a, 2.4)
        fxg.globalAlpha = (1 - a) * (j === 0 ? 0.55 : 0.28)
        fxg.strokeStyle = rp.col
        fxg.lineWidth = j === 0 ? 1.5 : 1
        fxg.beginPath()
        fxg.ellipse(rp.x, rp.y, rp.rx + e * rp.reach, rp.ry + e * rp.reach * rp.k, 0, 0, Math.PI * 2)
        fxg.stroke()
      }
    }
    if (motes) {
      fxg.fillStyle = inkCol
      for (const m of motes) {
        m.y -= (m.v * dt) / H
        if (m.y < -0.02) m.y = 1.02
        fxg.globalAlpha = 0.14 * (0.5 + 0.5 * Math.sin(now / 1300 + m.ph))
        fxg.beginPath()
        fxg.arc(m.x * W + Math.sin(now / 2400 + m.ph) * 12, m.y * H, m.r, 0, Math.PI * 2)
        fxg.fill()
      }
    }
    fxg.globalAlpha = 1
    return ripples.length > 0 || !!motes
  })
  const kick = () => {
    if (alive && !reduced) loop.start()
  }
  const ripple = (x: number, y: number, rx: number, ry: number, col: string, o: { k?: number; life?: number; reach?: number } = {}) => {
    if (reduced) return
    ripples.push({ x, y, rx, ry, k: o.k ?? 0.7, t: performance.now(), col, life: o.life ?? 2.4, reach: o.reach ?? 110 })
    kick()
  }
  const clearFx = () => {
    ripples.length = 0
    motes = null
    fxg.clearRect(0, 0, fx.width, fx.height)
  }

  // ── stage switching ──
  function go(next: Stage, exit = true) {
    const old = stage
    stage = next
    sand.style.opacity = '1'
    fx.style.opacity = '1'
    app.append(next.el)
    if (old) {
      old.destroy?.()
      if (reduced || !exit) old.el.remove()
      else {
        old.el.inert = true
        anim(() => gsap.to(old.el, { opacity: 0, filter: 'blur(6px)', duration: 0.5, ease: 'power2.in', onComplete: () => old.el.remove() }))
      }
    }
    next.layout?.()
  }

  // ═════════════ INTRO: the stone gate at dawn ═════════════
  function introStage(): Stage {
    const el = h('div', { class: 'ex-stage ex-intro' })
    const artBox = h('div', { class: 'ex-intro-art', role: 'img', 'aria-label': D.intro.art })
    const mists = [1, 2, 3].map((i) => h('div', { class: `ex-mist m${i}`, 'aria-hidden': 'true' }))
    const title = h('h1', { class: 'ex-intro-title', tabindex: '-1' }, D.intro.title)
    const meta = h('p', { class: 'ex-intro-meta' }, h('span', { class: 'ex-dot', 'aria-hidden': 'true' }), D.intro.meta)
    const line = h('p', { class: 'ex-intro-line' }, D.intro.line)
    const start = h('button', { class: 'btn primary ex-start', type: 'button' }, D.intro.start, icon('arrowR', 'icon sm'))
    const canResume = typeof saved.score === 'number' && Array.isArray(saved.picks) && saved.picks.length === N
    const resume = canResume ? h('button', { class: 'btn ghost ex-resume', type: 'button' }, fill(D.intro.resume, { score: saved.score! })) : null
    const actions = h('div', { class: 'ex-intro-actions' }, start, resume)
    const copy = h('div', { class: 'ex-intro-copy' }, title, meta, line, actions)
    el.append(artBox, copy)

    let art: GateArt | null = null
    let built = ''
    let played = false
    /** the stones are still falling: rake the sand plain, then re-rake around them once they land */
    let settled = false
    let idle: gsap.core.Tween | null = null
    let intro: gsap.core.Timeline | null = null
    const build = () => {
      const key = `${W}x${H}`
      if (key === built) return
      built = key
      if (played || reduced) settled = true
      art = gateArt(W, H, portrait(), played || reduced, box(copy).y - 14)
      artBox.replaceChildren(art.back, ...mists, art.svg)
      el.style.setProperty('--hz', `${art.horizon}px`)
      fly(art)
      if (!played && !reduced) play()
      played = true
    }
    let flight: gsap.core.Tween[] = []
    const fly = (a: GateArt) => {
      flight.forEach((tw) => tw.kill())
      flight = []
      if (reduced) return
      anim(() => {
        flight.push(gsap.fromTo(a.birds, { x: -W * 0.3, y: 0 }, { x: W * 0.95, y: -H * 0.06, duration: 52, ease: 'none', repeat: -1, delay: played ? 0 : 2.5 }))
        a.birds.querySelectorAll('path').forEach((p, i) =>
          flight.push(gsap.to(p, { scaleY: 0.3, transformOrigin: '50% 60%', duration: 0.75 + i * 0.13, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: i * 0.3 })))
      })
    }
    const play = () => {
      const a = art!
      motes = Array.from({ length: prefs.quality === 'high' ? 60 : 26 }, (_, i) => ({ x: Math.random(), y: Math.random(), v: 4 + Math.random() * 10, r: 0.6 + Math.random() * 1.3, ph: i * 1.7 }))
      kick()
      anim(() => {
        const tl = (intro = gsap.timeline())
        tl.from(a.sun, { opacity: 0, y: (i: number) => (i ? 26 : 34), duration: 3, ease: 'power2.out' }, 0)
          .from(a.mtns, { opacity: 0, duration: 2.4, stagger: 0.3 }, 0.1)
          .from(mists, { opacity: 0, duration: 2.6, stagger: 0.25 }, 0)
          .from(sand, { opacity: 0, duration: 2.2 }, 0.2)
        a.draw.forEach((d) => tl.to(d.reveal, { attr: { 'stroke-dashoffset': 0 }, duration: d.dur, ease: 'power2.inOut' }, d.at))
        tl.from(a.plaque, { opacity: 0, duration: 1, stagger: 0.08 }, 2.1)
          .from(a.plaque[0], { scale: 0.6, transformOrigin: '50% 50%', duration: 0.9, ease: 'back.out(2.4)' }, 2.1)
        a.stones.forEach((st, i) => {
          const t = 2.0 + i * 0.13
          tl.from(st.g, { opacity: 0, y: -8 / st.z, duration: 0.8, ease: 'power3.out' }, t)
            .call(() => ripple(st.x, st.y, st.rx, st.ry, cssVar('--ink'), { k: st.ry / st.rx, life: 2.2, reach: 70 / st.z }), [], t + 0.25)
        })
        tl.call(() => {
          settled = true
          resandSoon()
        }, [], 2.0 + (a.stones.length - 1) * 0.13 + 0.7)
        tl.from([title, meta, line, actions], { opacity: 0, y: 14, filter: 'blur(8px)', stagger: 0.16, duration: 1.3, ease: 'power3.out', clearProps: 'filter' }, 0.7)
          .add(() => {
            idle = gsap.delayedCall(4.4, function again() {
              const s0 = art?.stones[0]
              if (s0) ripple(s0.x, s0.y, s0.rx, s0.ry, cssVar('--vermilion'), { k: s0.ry / s0.rx, life: 2.6, reach: 60 })
              idle = gsap.delayedCall(4.4, again)
            })
          })
      })
    }

    let leaving = false
    const enter = (resumeIt: boolean) => {
      if (leaving) return
      leaving = true
      idle?.kill()
      intro?.kill()
      gsap.set([title, meta, line, actions], { clearProps: 'opacity,transform,filter' })
      if (resumeIt) picks = saved.picks!.slice()
      const nextStage = () => (resumeIt ? certStage() : quizStage())
      if (reduced || !art) {
        clearFx()
        go(nextStage(), false)
        return
      }
      const [fxp, fyp] = art.focus
      anim(() => {
        gsap.timeline({ onComplete: () => void later(() => (clearFx(), go(nextStage(), false)), 0) })
          .to(copy, { opacity: 0, x: -24, filter: 'blur(6px)', duration: 0.6, ease: 'power2.in' }, 0)
          .to(artBox, { scale: 2.3, opacity: 0, filter: 'blur(3px)', transformOrigin: `${fxp}px ${fyp}px`, duration: 1.25, ease: 'power2.in' }, 0.05)
          .to(mists, { scale: 1.7, opacity: 0, duration: 1.2, ease: 'power2.in' }, 0.05)
          .to([sand, fx], { opacity: 0, duration: 0.8 }, 0.3)
      })
    }
    start.addEventListener('click', () => enter(false))
    resume?.addEventListener('click', () => enter(true))

    return {
      el,
      obs: () => (art ? (settled ? art.obs : art.obs.slice(art.stones.length)) : []),
      horizon: () => art?.horizon ?? H * 0.5,
      rings: 3,
      calm: () => [copy],
      layout: () => {
        build()
        paintSand()
      },
      destroy: () => {
        idle?.kill()
        intro?.kill()
        flight.forEach((tw) => tw.kill())
        motes = null
      },
    }
  }

  // ═════════════ QUIZ: ten stones, one at a time ═════════════
  function quizStage(): Stage {
    picks = []
    const el = h('div', { class: 'ex-stage ex-quiz' })
    const rp = rng(41)
    const pstones = D.questions.map((_, i) =>
      h('span', { class: 'ex-ps', style: `--s:${(0.86 + rp() * 0.28).toFixed(2)};--dy:${(Math.sin(i * 1.1 + 0.5) * 4 + (rp() - 0.5) * 3).toFixed(1)}px;--rot:${((rp() - 0.5) * 24).toFixed(0)}deg;--gap:${(0.8 + rp() * 0.5).toFixed(2)}` }))
    const pathEl = h('div', { class: 'ex-path', 'aria-hidden': 'true' }, ...pstones)
    const status = h('p', { class: 'visually-hidden', 'aria-live': 'polite' })
    const body = h('div', { class: 'ex-qbody' })
    el.append(pathEl, status, body)

    let qi = -1
    let answered = false
    let btns: HTMLButtonElement[] = []
    let slabMode = false
    let cur: { box: HTMLElement; art: HTMLElement; head: HTMLElement; stones: HTMLElement; feed: HTMLElement; react: (tl: TL) => void } | null = null
    const slab = () => app.offsetWidth < 640

    function show(i: number) {
      qi = i
      answered = false
      const q: Q = D.questions[i]
      slabMode = slab()
      const r = rng(i * 31 + 7)
      const qid = `ex-q-${i}`
      const h2 = h('h2', { class: 'ex-q', id: qid, tabindex: '-1' }, q.q)
      btns = q.options.map((text, k) => {
        const b = h('button', { class: 'ex-stone', type: 'button', style: `--dy:${((k % 2 ? 12 : 0) + (r() - 0.5) * 8).toFixed(0)}px;--dx:${((k % 2 ? 1 : -1) * (3 + r() * 4)).toFixed(0)}px` },
          h('span', { class: 'ex-stone-in' }, stoneArt(slabMode, i * 10 + k + 1), h('span', { class: 'ex-key', 'aria-hidden': 'true' }, String.fromCharCode(65 + k)), h('span', { class: 'ex-stone-text' }, text)))
        b.addEventListener('click', () => pick(k))
        return b
      })
      const sc = sceneArt(q.art)
      const art = h('div', { class: 'ex-qart' }, sc.svg)
      const head = h('div', { class: 'ex-qhead' }, h('p', { class: 'ex-count' }, fill(D.quiz.count, { n: i + 1, total: N }), h('span', { class: 'ex-topic' }, ` · ${q.topic}`)), h2)
      const stones = h('div', { class: 'ex-stones', role: 'group', 'aria-labelledby': qid, 'aria-describedby': `${qid}-k` }, ...btns)
      const feed = h('div', { class: 'ex-feed' }, h('p', { class: 'ex-hint', 'aria-hidden': 'true' }, D.quiz.hint))
      const qbox = h('div', { class: 'ex-qbox' }, art,
        h('div', { class: 'ex-main' }, head, stones, feed, h('p', { class: 'visually-hidden', id: `${qid}-k` }, fill(D.quiz.keys, { n: q.options.length }))))
      const old = cur?.box
      cur = { box: qbox, art, head, stones, feed, react: sc.react }
      body.append(qbox)
      anim(() => sc.init())
      pstones.forEach((p, j) => p.classList.toggle('is-now', j === i))
      status.textContent = fill(D.quiz.status, { n: i + 1, total: N })
      h2.focus({ preventScroll: true })
      if (old) {
        if (reduced) old.remove()
        else anim(() => gsap.to(old, { opacity: 0, x: -40, filter: 'blur(6px)', duration: 0.45, ease: 'power2.in', onComplete: () => old.remove() }))
      }
      if (i > 0) resandSoon()
      else paintSand()
      if (!reduced) {
        anim(() => {
          const tl = gsap.timeline({ delay: old ? 0.3 : 0.15 })
          tl.fromTo(sc.svg, { clipPath: 'inset(-6% 100% -6% -6%)', opacity: 0.3 }, { clipPath: 'inset(-6% -6% -6% -6%)', opacity: 1, duration: 1.4, ease: 'power2.out', clearProps: 'clipPath' }, 0)
            .from(head.children, { opacity: 0, y: 12, filter: 'blur(6px)', duration: 1, stagger: 0.12, ease: 'power3.out', clearProps: 'filter' }, 0.15)
            .from(btns, { opacity: 0, y: 26, scale: 0.94, duration: 1, ease: 'power3.out', stagger: 0.09, clearProps: 'opacity,transform' }, 0.35)
            .from(feed, { opacity: 0, duration: 1.2 }, 1.2)
            .call(() => btns.forEach((b) => {
              const bb = box(b)
              ripple(bb.x + bb.w / 2, bb.y + bb.h * 0.55, bb.w * 0.42, bb.h * 0.36, cssVar('--ink'), { life: 1.6, reach: 26, k: 0.6 })
            }), [], 0.75)
        })
      }
    }

    function pick(k: number) {
      if (answered || !cur) return
      answered = true
      const q = D.questions[qi]
      picks[qi] = k
      const ok = k === q.answer
      btns.forEach((b, j) => {
        b.setAttribute('aria-disabled', 'true')
        if (j !== k && j !== q.answer) b.classList.add('is-dim')
      })
      const chosen = btns[k]
      const correct = btns[q.answer]
      const at = (b: HTMLElement) => {
        const bb = box(b)
        return [bb.x + bb.w / 2, bb.y + bb.h * 0.52, bb.w * 0.44, bb.h * 0.36] as const
      }
      if (ok) {
        chosen.classList.add('is-right')
        const [x, y, rx, ry] = at(chosen)
        ripple(x, y, rx, ry, cssVar('--moss'), { reach: 150, life: 2.8, k: 0.62 })
        later(() => ripple(x, y, rx, ry, cssVar('--moss'), { reach: 120, life: 2.6, k: 0.62 }), 380)
      } else {
        chosen.classList.add('is-wrong')
        const [x, y, rx, ry] = at(chosen)
        ripple(x, y, rx * 0.9, ry * 0.8, cssVar('--ink-3'), { reach: 22, life: 1.2, k: 0.5 })
        if (!reduced) anim(() => gsap.to(chosen, { y: 9, scale: 0.95, duration: 1.1, ease: 'power3.out' }))
        const reveal = () => {
          correct.classList.add('is-right', 'is-shown')
          const [cx, cy, crx, cry] = at(correct)
          ripple(cx, cy, crx, cry, cssVar('--moss'), { reach: 120, life: 2.6, k: 0.62 })
        }
        if (reduced) reveal()
        else later(reveal, 520)
      }
      // the picture answers too: the knowledge lands in the image, then in one line of words
      const react = cur.react
      anim(() => {
        const tl = gsap.timeline({ paused: true })
        react(tl)
        if (reduced) tl.progress(1)
        else tl.delay(ok ? 0.15 : 0.6).play()
      })
      pstones[qi].classList.add(ok ? 'is-right' : 'is-wrong')
      chime(ok ? 'ok' : 'low')
      const lastQ = qi === N - 1
      const next = h('button', { class: 'ex-next', type: 'button' }, h('span', { class: 'label' }, lastQ ? D.quiz.finish : D.quiz.next), icon('arrowR', 'icon sm'))
      next.addEventListener('click', advance)
      const text = h('p', { class: 'ex-explain' },
        h('span', { class: `ex-verdict ${ok ? 'ok' : 'no'}` }, ok ? D.quiz.right : D.quiz.wrong), ' ',
        ok ? null : h('span', { class: 'visually-hidden' }, fill(D.quiz.answerIs, { a: q.options[q.answer] }) + ' '),
        q.explain)
      cur.feed.replaceChildren(h('div', { class: 'ex-feed-in', role: 'status' }, text), next)
      if (!reduced)
        anim(() => {
          gsap.fromTo(text, { clipPath: 'inset(0 100% 0 0)', opacity: 0.2 }, { clipPath: 'inset(0 -2% 0 0)', opacity: 1, duration: 1.3, ease: 'power2.out', clearProps: 'clipPath', delay: ok ? 0.1 : 0.45 })
          gsap.from(next, { opacity: 0, x: -10, duration: 0.8, ease: 'power3.out', delay: ok ? 0.6 : 0.9 })
        })
      next.focus({ preventScroll: true })
    }

    function advance() {
      if (!answered) return
      if (qi < N - 1) show(qi + 1)
      else {
        const from = pstones.map((p) => p.getBoundingClientRect())
        go(resultStage(from))
      }
    }

    const onKey = (e: KeyboardEvent) => {
      if (stage?.el !== el || e.altKey || e.ctrlKey || e.metaKey) return
      const q = D.questions[qi]
      const key = e.key.toLowerCase()
      let k = '1234'.indexOf(key)
      if (k < 0) k = 'abcd'.indexOf(key)
      if (!answered && k >= 0 && k < q.options.length) {
        e.preventDefault()
        btns[k].focus({ preventScroll: true })
        pick(k)
      } else if (answered && (e.key === 'ArrowRight' || (e.key === 'Enter' && !(e.target as Element).closest?.('button, a')))) {
        e.preventDefault()
        advance()
      }
    }
    addEventListener('keydown', onKey)

    return {
      el,
      rings: 3,
      band: () => (cur ? box(cur.stones).y - 24 : H * 0.4),
      calm: () => (cur ? [cur.art, cur.head, cur.feed] : []),
      obs: () => [
        ...btns.map((b) => {
          const bb = box(b)
          return { x: bb.x + bb.w / 2, y: bb.y + bb.h * 0.5, hw: bb.w * 0.47, hh: bb.h * 0.4 }
        }),
        ...pstones.map((p) => {
          const bb = box(p)
          return { x: bb.x + bb.w / 2, y: bb.y + bb.h / 2, hw: bb.w * 0.5, hh: bb.h * 0.42 }
        }),
      ],
      layout: () => {
        if (qi < 0) show(0)
        else if (slab() !== slabMode) {
          slabMode = slab()
          btns.forEach((b, k) => b.querySelector('.ex-stone-art')?.replaceWith(stoneArt(slabMode, qi * 10 + k + 1)))
        }
        paintSand()
      },
      destroy: () => removeEventListener('keydown', onKey),
    }
  }

  // ═════════════ RESULT: your stones gather around the ensō ═════════════
  function resultStage(from?: DOMRect[]): Stage {
    const right = rightOf(picks)
    const score = right.filter(Boolean).length
    saved.score = score
    saved.picks = picks.slice()
    save(KEY, { ...saved, name })
    const el = h('div', { class: 'ex-stage ex-result' })
    // the ensō is painted on a canvas (pressure, flying white, tapered bristles) in the theme's ink
    const cv = h('canvas', { class: 'ex-res-enso', 'aria-hidden': 'true' })
    const seed = score + 2
    let drawnAt = ''
    const drawEnso = (force = false) => {
      const px = cv.clientWidth
      if (!px) return
      const d = Math.min(devicePixelRatio || 1, 2)
      const size = Math.round(px * d)
      const key = `${size}|${cssVar('--ink')}`
      if (key === drawnAt && !force) return
      drawnAt = key
      cv.width = cv.height = size
      const g = cv.getContext('2d')!
      g.clearRect(0, 0, size, size)
      ensoOn(g, size / 2, size / 2, size * 0.385, seed, rgbOf(cssVar('--ink')), null)
    }
    const num = h('span', { class: 'ex-res-n' }, reduced ? String(score) : '0')
    const scoreEl = h('p', { class: 'ex-res-score', 'aria-hidden': 'true' }, num, h('span', { class: 'ex-res-of' }, `/${N}`), h('span', { class: 'ex-res-l' }, D.result.scoreLabel))
    const rr2 = rng(score * 9 + 3)
    const ring = right.map((ok, i) => {
      const a = (-90 + (i * 360) / N + (rr2() - 0.5) * 10) * (Math.PI / 180)
      const rad = 46.5 + (rr2() - 0.5) * 3
      return h('span', { class: `ex-rs${ok ? ' is-right' : ' is-wrong'}`, style: `left:${(50 + Math.cos(a) * rad).toFixed(2)}%;top:${(50 + Math.sin(a) * rad).toFixed(2)}%;--rot:${((rr2() - 0.5) * 30).toFixed(0)}deg` })
    })
    const art = h('div', { class: 'ex-res-art' }, cv, scoreEl, ...ring)
    const artBox = h('div', { class: 'ex-res-artbox' }, art)
    const band = D.result.bands.find((bd) => score >= bd.min) ?? D.result.bands[D.result.bands.length - 1]
    const h2 = h('h2', { class: 'ex-res-msg', tabindex: '-1' }, h('span', { class: 'visually-hidden' }, fill(D.result.scoreAria, { n: score, total: N }) + ' '), band.text)
    // the stations worth a second visit: a row of small numbered stones; the topic shows on hover/focus
    const missed = D.questions.filter((_, i) => !right[i])
    const seen = new Set<number>()
    let review: HTMLElement | null = null
    if (missed.length) {
      const cap = h('p', { class: 'ex-review-label' }, D.result.review)
      const tip = (t: string) => () => (cap.textContent = t)
      const stones = missed.filter((q) => !seen.has(q.station) && seen.add(q.station)).map((q, i) => {
        const n = displayNo(q.station)
        const a = h('a', { class: 'ex-rev', href: `#/tram/${q.station}`, 'aria-label': fill(D.result.reviewLink, { n: PART === 1 ? q.station : n, topic: q.topic }), style: `--rot:${(((i * 37) % 19) - 9).toFixed(0)}deg;--dy:${(i % 2 ? 2 : -1)}px` },
          h('span', { class: 'ex-rev-n', 'aria-hidden': 'true' }, n))
        const on = tip(fill(D.result.reviewTip, { n, topic: q.topic }))
        const off = tip(D.result.review)
        a.addEventListener('pointerenter', on)
        a.addEventListener('focus', on)
        a.addEventListener('pointerleave', off)
        a.addEventListener('blur', off)
        return a
      })
      review = h('div', { class: 'ex-review' }, cap, h('div', { class: 'ex-review-list' }, ...stones))
    }
    const certBtn = h('button', { class: 'btn primary', type: 'button' }, D.result.cert, icon('arrowR', 'icon sm'))
    const again = h('button', { class: 'btn ghost', type: 'button' }, D.result.again)
    certBtn.addEventListener('click', () => go(certStage()))
    again.addEventListener('click', () => go(quizStage()))
    const copy = h('div', { class: 'ex-res-copy' }, h('p', { class: 'ex-eyebrow' }, D.result.eyebrow), h2, h('div', { class: 'ex-actions' }, certBtn, again), review)
    el.append(h('div', { class: 'ex-res' }, artBox, copy))
    chime('soft')
    let played = false

    return {
      el,
      rings: 5,
      band: () => box(art).y + box(art).h * 0.2,
      calm: () => [copy],
      obs: () => {
        const a = box(art)
        return [{ x: a.x + a.w / 2, y: a.y + a.h / 2, hw: a.w * 0.5, hh: a.h * 0.5 }]
      },
      repaint: () => drawEnso(true),
      layout: () => {
        drawEnso()
        paintSand()
        if (played) return
        played = true
        h2.focus({ preventScroll: true })
        if (reduced) return
        anim(() => {
          const tl = gsap.timeline({ delay: 0.35 })
          tl.from(sand, { opacity: 0, duration: 1.4 }, 0)
            .fromTo(cv, { '--sweep': '-14deg' }, { '--sweep': '372deg', duration: 2.4, ease: 'power2.inOut' }, 0.2)
            .from(scoreEl, { opacity: 0, filter: 'blur(8px)', duration: 1.2, clearProps: 'filter' }, 0.9)
            .to({ v: 0 }, { v: score, duration: 1.4, ease: 'power2.out', onUpdate() {
              num.textContent = String(Math.round((this.targets()[0] as { v: number }).v))
            } }, 1.0)
            .from(copy.children, { opacity: 0, y: 14, filter: 'blur(6px)', stagger: 0.14, duration: 1.1, ease: 'power3.out', clearProps: 'filter' }, 1.3)
          ring.forEach((st, i) => {
            const to = st.getBoundingClientRect()
            const fr = from?.[i]
            if (fr && fr.width) tl.from(st, { x: fr.left + fr.width / 2 - (to.left + to.width / 2), y: fr.top + fr.height / 2 - (to.top + to.height / 2), scale: fr.width / to.width, duration: 1.5, ease: 'power3.inOut' }, 0.05 + i * 0.05)
            else tl.from(st, { opacity: 0, scale: 0.5, duration: 0.8, ease: 'back.out(2)' }, 1 + i * 0.08)
            tl.call(() => {
              const bb = box(st)
              ripple(bb.x + bb.w / 2, bb.y + bb.h / 2, bb.w * 0.5, bb.h * 0.4, cssVar(right[i] ? '--moss' : '--ink-3'), { reach: 34, life: 1.8, k: 0.75 })
            }, [], 1.5 + i * 0.05)
          })
        })
      },
    }
  }

  // ═════════════ CERTIFICATE ═════════════
  function certStage(): Stage {
    const right = rightOf(picks)
    const score = right.filter(Boolean).length
    const date = today()
    // honest: the "all stations" line only when the visitor really walked every station of this part
    const sts = stationsOfPart(PART)
    const visited = sts.filter((st) => progress.isVisited(st.id)).length
    const whole = visited >= sts.length
    const el = h('div', { class: 'ex-stage ex-cert' })
    const canvas = h('canvas', { class: 'ex-cert-canvas', width: CW, height: CH, role: 'img' })
    const paper = h('div', { class: 'ex-cert-paper' }, canvas)
    const view = h('div', { class: 'ex-cert-view' }, paper)
    const h2 = h('h2', { class: 'ex-cert-h', tabindex: '-1' }, D.cert.heading)
    const input = h('input', { class: 'ex-name-input', id: 'ex-name', type: 'text', maxlength: 40, autocomplete: 'name', spellcheck: 'false', enterkeyhint: 'done', placeholder: D.cert.placeholder, 'aria-describedby': 'ex-cert-hint' })
    input.value = name
    const dlIcon = s('svg', { viewBox: '0 0 24 24', class: 'ex-dl-ico', 'aria-hidden': 'true' }, s('path', { d: 'M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19.5h14' }))
    const dl = h('button', { class: 'btn primary ex-dl', type: 'button' }, dlIcon, D.cert.download)
    const hint = h('p', { class: 'ex-cert-hint', id: 'ex-cert-hint', 'aria-live': 'polite' })
    const journey = whole ? null : h('p', { class: 'ex-cert-note' }, fill(D.cert.journey, { n: visited, total: sts.length }))
    const again = h('button', { class: 'btn ghost', type: 'button' }, D.cert.again)
    again.addEventListener('click', () => go(quizStage()))
    const side = h('div', { class: 'ex-cert-side' },
      h2,
      h('label', { class: 'ex-name-label', for: 'ex-name' }, D.cert.nameLabel),
      h('div', { class: 'ex-name' }, input),
      h('div', { class: 'ex-dl-wrap' }, dl), hint, journey,
      h('div', { class: 'ex-actions ex-cert-more' }, again, h('a', { class: 'btn ghost', href: PARTS.find((p) => p.id === PART)?.route ?? '#/vuon' }, D.cert.garden)))
    el.append(h('div', { class: 'ex-cert-grid' }, view, side))

    let bg: HTMLCanvasElement | null = null
    let frame = 0
    let savedT = 0
    const sync = () => {
      const has = !!name.trim()
      dl.setAttribute('aria-disabled', String(!has))
      dl.classList.toggle('is-off', !has)
      hint.textContent = has ? D.cert.ready : D.cert.needName
      canvas.setAttribute('aria-label', fill(D.cert.alt, { name: name.trim() || D.cert.namePlaceholder, score, date }))
    }
    const redraw = () => {
      frame = 0
      if (bg) certCompose(canvas, bg, name)
    }
    input.addEventListener('input', () => {
      name = input.value.slice(0, 40)
      sync()
      if (!frame) frame = requestAnimationFrame(redraw)
      clearTimeout(savedT)
      savedT = window.setTimeout(() => save(KEY, { ...saved, name }), 400)
    })
    const download = () => {
      if (!name.trim() || !bg) {
        input.focus()
        return
      }
      certCompose(canvas, bg, name)
      canvas.toBlob((blob) => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = h('a', { href: url, download: `${D.cert.file}${slug(name) ? `-${slug(name)}` : ''}.png`, hidden: true })
        document.body.append(a)
        a.click()
        a.remove()
        window.setTimeout(() => URL.revokeObjectURL(url), 4000)
        hint.textContent = D.cert.saved
        chime('ok')
      }, 'image/png')
    }
    dl.addEventListener('click', download)
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        download()
      }
    })
    sync()
    // blank paper first, then the drawn certificate once the serif has loaded
    const g0 = canvas.getContext('2d')!
    g0.fillStyle = PAL.paper
    g0.fillRect(0, 0, CW, CH)
    fontsReady().then(() => {
      if (!alive) return
      bg = certBackground(score, right, date, whole ? D.cert.line1 : D.cert.line1Exam)
      redraw()
      if (!reduced) anim(() => gsap.fromTo(canvas, { opacity: 0.35, filter: 'blur(4px)' }, { opacity: 1, filter: 'blur(0px)', duration: 1, ease: 'power2.out', clearProps: 'filter' }))
    })
    let played = false

    return {
      el,
      rings: 4,
      band: () => H * 0.35,
      calm: () => [side],
      obs: () => {
        const p = box(paper)
        return [{ x: p.x + p.w / 2, y: p.y + p.h / 2, hw: p.w / 2 + 2, hh: p.h / 2 + 2 }]
      },
      layout: () => {
        paintSand()
        if (played) return
        played = true
        if (name) h2.focus({ preventScroll: true })
        else input.focus({ preventScroll: true })
        if (reduced) return
        anim(() => {
          gsap.timeline({ delay: 0.3 })
            .from(sand, { opacity: 0, duration: 1.2 }, 0)
            .from(paper, { opacity: 0, y: 40, rotation: -2.5, duration: 1.5, ease: 'power3.out' }, 0.1)
            .from(side.children, { opacity: 0, y: 12, stagger: 0.1, duration: 1, ease: 'power3.out' }, 0.5)
        })
      },
      destroy: () => {
        cancelAnimationFrame(frame)
        clearTimeout(savedT)
        save(KEY, { ...saved, name })
      },
    }
  }

  // ── size, theme, start ──
  let relayout = 0
  const measure = () => {
    relayout = 0
    const r = app.getBoundingClientRect()
    W = Math.round(r.width)
    H = Math.round(r.height)
    if (!W || !H) return
    dpr = Math.min(devicePixelRatio || 1, prefs.quality === 'high' ? 2 : 1)
    for (const c of [sand, fx]) {
      c.width = Math.round(W * dpr)
      c.height = Math.round(H * dpr)
    }
    stage?.layout?.()
  }
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(relayout)
    relayout = requestAnimationFrame(measure)
  })
  ro.observe(app)
  const offPrefs = onPrefs(() => {
    inkCol = cssVar('--ink')
    if (!W) return
    paintSand()
    stage?.repaint?.()
  })

  const r0 = app.getBoundingClientRect()
  W = Math.round(r0.width)
  H = Math.round(r0.height)
  dpr = Math.min(devicePixelRatio || 1, prefs.quality === 'high' ? 2 : 1)
  for (const c of [sand, fx]) {
    c.width = Math.round(W * dpr)
    c.height = Math.round(H * dpr)
  }
  go(introStage())
  ;(app.querySelector('.ex-intro-title') as HTMLElement | null)?.focus({ preventScroll: true })

  return () => {
    alive = false
    stage?.destroy?.()
    ro.disconnect()
    offPrefs()
    loop.dispose()
    cancelAnimationFrame(relayout)
    timers.forEach((t) => clearTimeout(t))
    gctx.revert()
  }
}
