import { h, s } from '../../core/dom'
import content from '../../content/tram-05.json'

/** Trạm 5 shared bits: the visitor's chosen question (kept across scenes), sumi-e helpers, the journey header. */
export interface Question {
  text: string
  tokens: [string, number][]
  words: string[]
  /** attn[i] = [[j, weight]…] — token i (0 = hidden instruction sheet) looks back at earlier token j */
  attn: [number, number][][]
  hint: number
  /** the reply: `lead` tokens, then the word drawn in scene 4 (one token per syllable), then `tail` */
  next: { lead: string[]; cands: { w: string; p: number }[]; tail: string[] }
}

export const C = content
export const QUESTIONS = content.questions as unknown as Question[]
/** The question the visitor sent in scene 1; every later scene follows it.
 *  A sentence of their own is cut in scene 1 only (demo tokenizer); the later scenes follow the nearest sample (`q`). */
export const state = { q: 0, own: null as null | { text: string; tokens: [string, number][] }, picked: -1 }
export const question = () => QUESTIONS[state.q] ?? QUESTIONS[0]

/** The written reply carries the word drawn in scene 4 (the likeliest one if scene 4 was skipped).
 *  `at`…`to` = the drawn word's tokens. */
export function reply() {
  const { lead, cands, tail } = question().next
  const w = cands[state.picked] ?? cands[0]
  const mid = w.w.split(' ').map((x) => ` ${x}`)
  return { tokens: [...lead, ...mid, ...tail], at: lead.length, to: lead.length + mid.length }
}

/** The sample question that shares the most words with the visitor's own sentence (0 when none). */
export function nearest(text: string) {
  const ws = new Set(text.toLowerCase().normalize('NFC').split(/[^\p{L}\p{M}]+/u))
  let best = 0, score = 0
  QUESTIONS.forEach((q, i) => {
    const sc = q.words.filter((w) => ws.has(w)).length
    if (sc > score) (score = sc), (best = i)
  })
  return best
}

export type Pt = [number, number]

/** Deterministic PRNG (mulberry32): the same art on every visit. */
export function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

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

/** A filled, tapered brush stroke along pts: quick press-in (`head`), long lift-off (`tail` < 1 keeps it fuller). */
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

/** A river stone painted in ink behind a word: wash shadow, body, lit top, darker belly, dry-brush rim. */
export function stoneArt(seed: number) {
  const base = blob(60, 31, 55, 25, seed, 0.1, 18)
  return s('svg', { class: 't5-st', viewBox: '0 0 120 64', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    s('path', { class: 't5-st-shadow', d: blob(63, 41, 54, 19, seed + 7, 0.1) }),
    s('path', { class: 't5-st-base', d: base }),
    s('path', { class: 't5-st-hi', d: blob(50, 21, 38, 11, seed + 3, 0.14, 14) }),
    s('path', { class: 't5-st-low', d: stroke([[10, 36], [40, 52], [80, 53], [110, 35]], 5, { head: 0.2, tail: 0.6, min: 0.2 }) }),
    s('path', { class: 't5-st-rim', d: base, 'vector-effect': 'non-scaling-stroke', filter: 'url(#ink-dry)' }))
}

/** A zone of raked sand that the grooves part around: a capsule from (x0, y) to (x1, y), half-height `ry`. */
export interface Isle {
  x0: number
  x1: number
  y: number
  ry: number
}

/** Raked sand over a W×H px box: wavy grooves (a shadow line + a lit line under it) that part around each isle,
 *  which gets `rings` concentric raked outlines instead. Returns the two layers (style .t5-rk-lo / .t5-rk-hi). */
export function rake(W: number, H: number, isles: Isle[], o: { step?: number; rings?: number; seed?: number } = {}) {
  const step = o.step ?? 9
  const rings = o.rings ?? 3
  const ph = (o.seed ?? 1) * 1.7
  const pad = rings * step - step * 0.35
  const inIsle = (x: number, y: number) =>
    isles.some((z) => Math.hypot(x < z.x0 ? x - z.x0 : x > z.x1 ? x - z.x1 : 0, y - z.y) < z.ry + pad)
  const ds: string[] = []
  for (let y0 = step * 0.6; y0 < H; y0 += step) {
    let d = ''
    let on = false
    for (let x = -4; x <= W + 6; x += 6) {
      const y = y0 + Math.sin(x * 0.011 + y0 * 0.21 + ph) * 1.6 + Math.sin(x * 0.037 + ph) * 0.5
      if (inIsle(x, y)) {
        on = false
        continue
      }
      d += `${on ? 'L' : 'M'}${x} ${y.toFixed(1)}`
      on = true
    }
    if (d) ds.push(d)
  }
  for (const z of isles) {
    for (let k = 0; k < rings; k++) {
      const r = z.ry + step * (k + 0.55)
      ds.push(`M${f1(z.x0)} ${f1(z.y - r)}H${f1(z.x1)}A${f1(r)} ${f1(r)} 0 0 1 ${f1(z.x1)} ${f1(z.y + r)}H${f1(z.x0)}A${f1(r)} ${f1(r)} 0 0 1 ${f1(z.x0)} ${f1(z.y - r)}Z`)
    }
  }
  const d = ds.join('')
  return [s('path', { class: 't5-rk-lo', d }), s('path', { class: 't5-rk-hi', d })]
}

/** Rice-paper slip with hand-torn (deckled) edges all round and a few fibres, stretched behind a note. */
export function paperArt(seed: number) {
  const r = rng(seed * 31 + 5)
  const j = (a: number) => (r() - 0.5) * a
  const top = Array.from({ length: 21 }, (_, i) => `${f1(i * 5)} ${f1(1.2 + j(1.5))}`)
  const right = Array.from({ length: 6 }, (_, i) => `${f1(99.4 - Math.abs(j(1)))} ${f1(4 + i * 6.4)}`)
  const bot = Array.from({ length: 21 }, (_, i) => `${f1(100 - i * 5)} ${f1(38.8 + j(1.5))}`)
  const left = Array.from({ length: 6 }, (_, i) => `${f1(0.6 + Math.abs(j(1)))} ${f1(36 - i * 6.4)}`)
  const d = `M${[...top, ...right, ...bot, ...left].join('L')}Z`
  const fib = Array.from({ length: 7 }, () => {
    const x = 4 + r() * 88, y = 4 + r() * 32, l = 2 + r() * 5
    return `M${f1(x)} ${f1(y)}q${f1(l / 2)} ${f1(j(2.4))} ${f1(l)} ${f1(j(1.6))}`
  }).join('')
  return s('svg', { class: 't5-paper', viewBox: '0 0 100 40', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    s('path', { class: 't5-paper-body', d }),
    s('path', { class: 't5-paper-fiber', d: fib }))
}

/** The folded instruction sheet (system prompt): a small letter folded in three, with a vermilion seal. */
export function sheetArt() {
  return s('svg', { class: 't5-sheet-art', viewBox: '0 0 60 64', 'aria-hidden': 'true' },
    s('path', { class: 't5-sh-shadow', d: blob(32, 56, 24, 5, 5, 0.1) }),
    s('path', { class: 't5-sh-back', d: 'M9 12 L50 9 L52 52 L11 55 Z' }),
    s('path', { class: 't5-sh-fold', d: 'M9 12 L50 9 L48.5 25 L10 27.5 Z' }),
    s('path', { class: 't5-sh-line', d: stroke([[15, 36], [27, 35.4], [44, 34.6]], 2.2, { tail: 0.9 }) }),
    s('path', { class: 't5-sh-line', d: stroke([[15, 43], [25, 42.6], [37, 42.2]], 2.2, { tail: 0.9 }) }),
    s('path', { class: 't5-sh-crease', d: 'M10 27.5 L48.5 25' }),
    s('circle', { class: 't5-sh-seal', cx: 43, cy: 46, r: 4.2 }))
}

/** Five stones along a brushed line — "you are here" on the question's journey. Decorative (the rail announces scenes). */
export function journey(k: number): HTMLElement {
  const steps = C.journey.map((label, i) =>
    h('span', { class: `t5-j-step${i < k ? ' is-past' : i === k ? ' is-now' : ''}` },
      h('span', { class: 't5-j-dot' }),
      h('span', { class: 't5-j-label' }, label)))
  const line = s('svg', { class: 't5-j-line', viewBox: '0 0 400 8', preserveAspectRatio: 'none' },
    s('path', { d: stroke([[2, 4.4], [140, 3.6], [270, 4.4], [398, 3.8]], 2.4, { head: 0.04, tail: 0.5, min: 0.25 }) }))
  return h('div', { class: 't5-journey', 'aria-hidden': 'true', style: `--k:${k}` }, line, ...steps)
}

/** Token text as shown on a stone: leading space dropped. */
export const tokText = (t: string) => t.trim() || t
