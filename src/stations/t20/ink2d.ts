import { h, s } from '../../core/dom'
import { cssVar } from '../../core/prefs'
import { blob, curve, rock, rng, stroke, type Pt } from '../../ui/part2/ink'

/**
 * Trạm 20's Canvas 2D ink kit: token colours read once (mount / onPrefs), a sized canvas, and lit ink painters — a stone
 * with three tones, a brushy terminator, dry strokes in its shadow, moss on top, an ink edge and a moon rim, plus its
 * contact and long cast shadow. Everything paints into a given context; nothing here runs per frame on its own.
 */

export type RGB = [number, number, number, number]
const NAMES = ['paper', 'paper-2', 'wash', 'ink', 'ink-2', 'ink-3', 'rock-hi', 'rock-mid', 'rock-lo', 'umbra', 'step-hi', 'step-mid', 'step-lo', 'moss-a', 'moss-b', 'moss-c', 'water', 'mist', 'moon', 'moon-rim', 'lantern', 'firefly', 'vermilion', 'rake', 'rake-hi'] as const
export type Pal = Record<(typeof NAMES)[number], RGB> & { dark: boolean; mistA: number; key: string }

function parse(v: string): RGB {
  if (v.startsWith('#')) {
    const x = v.length === 4 ? v.slice(1).split('').map((c) => c + c).join('') : v.slice(1, 7)
    return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16), 1]
  }
  const m = v.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0]
  return [m[0], m[1], m[2], m[3] ?? 1]
}

/** The Part 2 tokens as numbers (read on mount and in onPrefs; compare `key` before repainting). */
export function palette(): Pal {
  const p = { dark: document.documentElement.dataset.theme === 'dark', mistA: parseFloat(cssVar('--mist-a')) || 0.5, key: '' } as Pal
  for (const n of NAMES) {
    const v = cssVar(`--${n}`)
    p.key += v
    p[n] = parse(v)
  }
  return p
}

/** rgba() of a token at a share of its own alpha. */
export const col = (c: RGB, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, c[3] * a)).toFixed(3)})`
export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t]

export const canvas = (cls: string) => h('canvas', { class: cls, 'aria-hidden': 'true' })
/** DPR cap per quality (createStage's 2 / 1.25). */
export const dprOf = (low: boolean) => Math.min(devicePixelRatio || 1, low ? 1.25 : 2)
/** Size a canvas to W × H css px; returns its context in css px. */
export function fit(c: HTMLCanvasElement, W: number, H: number, dpr: number) {
  c.width = Math.max(1, Math.round(W * dpr))
  c.height = Math.max(1, Math.round(H * dpr))
  c.style.width = `${W}px`
  c.style.height = `${H}px`
  const g = c.getContext('2d')!
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  return g
}
/** An offscreen sprite: paint(g) in a w × h css-px box. */
export function sprite(w: number, h: number, dpr: number, paint: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas')
  const g = fit(c, w, h, dpr)
  paint(g)
  return c
}

/** Smooth 1D value noise in -1…1. */
export function noise(x: number, seed = 0) {
  const i = Math.floor(x), f = x - i
  const hsh = (n: number) => {
    const s = Math.sin((n + seed * 57.13) * 127.1) * 43758.5453
    return (s - Math.floor(s)) * 2 - 1
  }
  const u = f * f * (3 - 2 * f)
  return hsh(i) * (1 - u) + hsh(i + 1) * u
}

/** Fill an ink.ts path string (stroke / blob / rock) in a colour. */
export function fillD(g: CanvasRenderingContext2D, d: string, style: string | CanvasGradient) {
  g.fillStyle = style
  g.fill(new Path2D(d))
}

const GLOW = new Map<string, CanvasGradient>() // unit radial gradients, one per colour × strength (reused across frames)
/** A soft radial glow / fog bank. */
export function glow(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, c: RGB, a: number, mid = 0.45) {
  if (rx < 1 || ry < 1) return
  const key = `${c[0]},${c[1]},${c[2]},${c[3]}|${a.toFixed(3)}|${mid}`
  let gr = GLOW.get(key)
  if (!gr) {
    gr = g.createRadialGradient(0, 0, 0, 0, 0, 1)
    gr.addColorStop(0, col(c, a))
    gr.addColorStop(mid, col(c, a * 0.45))
    gr.addColorStop(1, col(c, 0))
    if (GLOW.size > 400) GLOW.clear()
    GLOW.set(key, gr)
  }
  g.save()
  g.translate(x, y)
  g.scale(rx, ry)
  g.fillStyle = gr
  g.fillRect(-1, -1, 2, 2)
  g.restore()
}
/** Mist at the token's own strength (dense by day, a faint blue breath by night). */
export const mistBank = (g: CanvasRenderingContext2D, p: Pal, x: number, y: number, rx: number, ry: number, k = 1) =>
  glow(g, x, y, rx, ry, p.mist, p.mistA * k, 0.6)

/** The moon: halo, warm disc, faint seas, a breath of cloud. */
export function moonDisc(g: CanvasRenderingContext2D, p: Pal, x: number, y: number, r: number, seed = 1, halo = 1) {
  glow(g, x, y, r * 4.4, r * 4.4, p.moon, (p.dark ? 0.42 : 0.6) * halo, 0.3)
  const d = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r)
  d.addColorStop(0, col(p.moon))
  d.addColorStop(0.8, col(p.moon))
  d.addColorStop(1, col(p.moon, 0.85))
  g.fillStyle = d
  g.beginPath()
  g.arc(x, y, r, 0, Math.PI * 2)
  g.fill()
  fillD(g, blob(x - r * 0.28, y - r * 0.18, r * 0.34, r * 0.24, seed, 0.2) + blob(x + r * 0.24, y + r * 0.12, r * 0.24, r * 0.3, seed + 1, 0.2), col(p.wash, p.dark ? 0.08 : 0.06))
  g.strokeStyle = col(p.dark ? p.moon : p.wash, p.dark ? 0.5 : 0.18)
  g.lineWidth = 0.8
  g.stroke()
}

export interface RockOpts {
  /** moon side: 1 = right (garden 7), -1 = left */
  light?: number
  /** moss on the crown 0…1 */
  moss?: number
  /** long cast shadow, as a share of the stone's width (0 = contact only) */
  cast?: number
  /** a polished stone: tighter, brighter rim */
  gloss?: boolean
  /** tone: 0 = garden stone, 1 = darkest (basalt) */
  dark?: number
}

/**
 * A lit garden stone standing on (x, y), w × h (ink.ts `rock` silhouette): long cast shadow away from the moon, contact
 * shadow, face graded hi → mid → lo across the light, a brushy terminator with dry strokes in the shade, umbra at the
 * foot, moss on the crown, an ink edge on the dark side and a moon rim on the lit side.
 */
/** A standing slab for carved words (stele, shore stone): flat-ish crown, near-straight flanks, standing on y = 0. */
export function slab(w: number, h: number, seed: number): { top: Pt[]; d: string } {
  const r = rng(seed)
  const ctrl: Pt[] = [[-0.5, 0], [-0.5 + r() * 0.03, -0.55], [-0.47 + r() * 0.03, -0.9], [-0.3, -0.98 - r() * 0.02], [0.05 + (r() - 0.5) * 0.2, -1], [0.34, -0.97 + r() * 0.02], [0.48, -0.86], [0.5 - r() * 0.03, -0.45], [0.5, 0]]
  const top: Pt[] = []
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)]
    for (let j = 0; j < 4; j++) {
      const t = j / 4, t2 = t * t, t3 = t2 * t
      const c = (a: number, b: number, cc: number, d: number) => 0.5 * (2 * b + (cc - a) * t + (2 * a - 5 * b + 4 * cc - d) * t2 + (3 * b - a - 3 * cc + d) * t3)
      top.push([c(p0[0], p1[0], p2[0], p3[0]) * w, Math.min(0, c(p0[1], p1[1], p2[1], p3[1])) * h])
    }
  }
  top.push([w / 2, 0])
  const P = (q: Pt) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`
  return { top, d: `M${top.map(P).join('L')}Q0 ${(h * 0.04).toFixed(1)} ${P(top[0])}Z` }
}

export function paintRock(g: CanvasRenderingContext2D, p: Pal, x: number, y: number, w: number, hh: number, seed: number, o: RockOpts & { shape?: 'rock' | 'slab' } = {}) {
  const L = o.light ?? 1
  const r = rng(seed)
  const { top, d } = (o.shape === 'slab' ? slab : rock)(w, hh, seed)
  const body = new Path2D(d)
  const tone = o.dark ?? 0
  const hi = mix(p['rock-hi'], p['rock-lo'], tone * 0.75), mid = mix(p['rock-mid'], p.umbra, tone * 0.6), lo = mix(p['rock-lo'], p.umbra, tone * 0.7)
  g.save()
  g.translate(x, y)
  if (o.cast) glow(g, -L * w * (0.3 + o.cast * 0.5), -hh * 0.01, w * (0.45 + o.cast * 0.7), Math.max(2, hh * 0.1), p.umbra, p.dark ? 0.55 : 0.3, 0.55)
  glow(g, L * -w * 0.04, 0, w * 0.6, Math.max(2.5, hh * 0.1), p.umbra, p.dark ? 0.8 : 0.42, 0.5)
  const lg = g.createLinearGradient(L * w * 0.5, -hh, -L * w * 0.45, -hh * 0.1)
  lg.addColorStop(0, col(hi))
  lg.addColorStop(0.5, col(mid))
  lg.addColorStop(1, col(lo))
  g.fillStyle = lg
  g.fill(body)
  g.save()
  g.clip(body)
  // the terminator: a wavy line down the stone, the shade side washed with umbra
  const tx = -L * w * (0.02 + r() * 0.1)
  g.beginPath()
  g.moveTo(-L * w, -hh * 1.2)
  for (let i = 0; i <= 12; i++) {
    const t = i / 12
    g.lineTo(tx + L * w * 0.12 * t + noise(t * 3.2, seed) * w * 0.07, -hh * 1.2 + hh * 1.25 * t)
  }
  g.lineTo(-L * w, hh * 0.2)
  g.closePath()
  g.fillStyle = col(p.umbra, p.dark ? 0.42 : 0.24)
  g.fill()
  // the foot sinks into umbra
  const fg = g.createLinearGradient(0, -hh * 0.45, 0, 0)
  fg.addColorStop(0, col(p.umbra, 0))
  fg.addColorStop(1, col(p.umbra, p.dark ? 0.55 : 0.32))
  g.fillStyle = fg
  g.fillRect(-w, -hh * 0.5, w * 2, hh * 0.6)
  // dry strokes in the shade, grain on the face
  for (let i = 0; i < 4; i++) {
    const y0 = -hh * (0.2 + r() * 0.6), x0 = -L * w * (0.12 + r() * 0.3)
    fillD(g, stroke([[x0, y0], [x0 - L * w * (0.1 + r() * 0.12), y0 + hh * (0.08 + r() * 0.1)], [x0 - L * w * (0.2 + r() * 0.1), y0 + hh * (0.2 + r() * 0.1)]], 1 + w * 0.02, 0.3, 0.4, 0.15), col(p.wash, p.dark ? 0.4 : 0.14))
  }
  for (let i = 0; i < 3; i++) {
    const y0 = -hh * (0.3 + r() * 0.4), x0 = L * w * (r() * 0.25)
    fillD(g, stroke([[x0, y0], [x0 + w * 0.14, y0 + hh * 0.05]], 0.8 + w * 0.012, 0.3, 0.5, 0.2), col(p.ink, p.dark ? 0.08 : 0.1))
  }
  // moss on the crown, toward the light
  if (o.moss) {
    const crown = top.reduce((a, b) => (b[1] < a[1] ? b : a))
    const mw = w * (0.22 + o.moss * 0.26)
    fillD(g, blob(crown[0] + L * w * 0.06, crown[1] + hh * 0.06, mw, hh * (0.08 + o.moss * 0.1), seed + 3, 0.3, 16), col(p['moss-b'], 0.9))
    fillD(g, blob(crown[0] + L * w * 0.1, crown[1] + hh * 0.03, mw * 0.6, hh * 0.06, seed + 4, 0.3, 12), col(p['moss-a'], 0.85))
    g.fillStyle = col(p['moss-c'], 0.7)
    for (let i = 0; i < 9; i++) g.fillRect(crown[0] + (r() - 0.4) * mw * 1.4, crown[1] + r() * hh * 0.14, 1.4, 1.4)
  }
  g.restore()
  // ink edge (shade side, heavier) and moon rim (lit side)
  const n = top.length
  const shade = L > 0 ? top.slice(0, Math.floor(n * 0.62)) : top.slice(Math.floor(n * 0.38))
  const lit = L > 0 ? top.slice(Math.floor(n * 0.4), n - 2) : top.slice(2, Math.floor(n * 0.6))
  fillD(g, stroke(shade, Math.max(1.2, w * 0.03), 0.15, 0.3, 0.25), col(p.dark ? p.umbra : p.wash, p.dark ? 0.8 : 0.5))
  fillD(g, stroke(lit.map(([a, b]) => [a - L * 0.6, b + 0.8] as Pt), Math.max(1, w * (o.gloss ? 0.03 : 0.022)), 0.3, 0.3, 0.1), p.dark ? col(p.moon, o.gloss ? 0.85 : 0.55) : col(p['rake-hi'], 1))
  g.restore()
}

/**
 * Moss as a painter dots it (点苔): a faint bleeding wash, then a cluster of ink dots of three greens and a few dark
 * flecks, dense in the middle and thinning out — on a face that looks up. (x, y) the patch's centre, rx × ry its spread.
 */
export function mossDots(g: CanvasRenderingContext2D, p: Pal, x: number, y: number, rx: number, ry: number, seed: number, k = 1) {
  const r = rng(seed)
  fillD(g, blob(x, y, rx * 0.9, ry * 0.8, seed, 0.3, 14), col(p['moss-b'], 0.32 * k))
  const greens = [p['moss-a'], p['moss-b'], p['moss-c']]
  const n = Math.round(14 + rx * ry * 0.09)
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * (0.35 + r() * 0.65)
    const dot = 0.5 + r() * (1.2 + rx * 0.02) * (1 - d * 0.5)
    g.fillStyle = col(greens[Math.floor(r() * 3)], (0.5 + r() * 0.45) * k)
    g.beginPath()
    g.ellipse(x + Math.cos(a) * rx * d, y + Math.sin(a) * ry * d, dot * 1.3, dot, 0, 0, Math.PI * 2)
    g.fill()
  }
  // the dark flecks: short dabs of ink laid flat
  const ink = col(p.dark ? mix(p.umbra, p['moss-a'], 0.3) : p.wash, (p.dark ? 0.75 : 0.5) * k)
  for (let i = 0; i < 4 + rx * 0.08; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.8
    const cx = x + Math.cos(a) * rx * d, cy = y + Math.sin(a) * ry * d, l = 1.5 + r() * (2 + rx * 0.04)
    fillD(g, stroke([[cx - l, cy + 0.3], [cx, cy - 0.4], [cx + l, cy + 0.2]], 1.1 + r() * 1.4, 0.3, 0.4, 0.3), ink)
  }
}

/** Fill a path blurred by b css px (the canvas shadow trick: the shape is drawn far off-canvas, only its shadow lands).
 *  The context must carry only the dpr scale (no rotation). */
export function softFill(g: CanvasRenderingContext2D, path: Path2D, style: string, b: number, dpr: number) {
  g.save()
  g.shadowColor = style
  g.shadowBlur = b * dpr
  g.shadowOffsetX = 20000 * dpr
  g.translate(-20000, 0)
  g.fillStyle = '#000'
  g.fill(path)
  g.restore()
}

/** A brushed stroke (ink.ts `stroke`) in a colour. */
export const brush = (g: CanvasRenderingContext2D, pts: Pt[], w: number, style: string, a = 0.15, b = 0.35, min = 0.2) => fillD(g, stroke(pts, w, a, b, min), style)

/** A closed polygon as a Path2D. */
export function poly(pts: Pt[]) {
  const p = new Path2D()
  pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)))
  p.closePath()
  return p
}

/** A clump of reeds / fern fronds rising from (x, y): n blades of height ~h, leaning by `lean`. */
export function reeds(g: CanvasRenderingContext2D, x: number, y: number, hh: number, n: number, seed: number, style: string, lean = 0.2) {
  const r = rng(seed)
  for (let i = 0; i < n; i++) {
    const bx = x + (r() - 0.5) * hh * 0.3, H = hh * (0.55 + r() * 0.5), dx = (lean + (r() - 0.5) * 0.6) * H
    brush(g, [[bx, y], [bx + dx * 0.3, y - H * 0.5], [bx + dx, y - H]], 1.2 + r() * 1.6, style, 0.05, 0.6, 0.1)
  }
}

/** A fern frond drooping from (x, y) toward angle a (radians), length len: a rachis with paired pinnae. */
export function fern(g: CanvasRenderingContext2D, x: number, y: number, len: number, a: number, seed: number, style: string) {
  const r = rng(seed)
  const pts: Pt[] = []
  const bend = (r() - 0.5) * 0.9 + 0.5
  for (let i = 0; i <= 10; i++) {
    const t = i / 10
    const ang = a + bend * t * t
    const last = pts[i - 1] ?? [x, y]
    pts.push(i ? [last[0] + Math.cos(ang) * len / 10, last[1] + Math.sin(ang) * len / 10] : [x, y])
  }
  brush(g, pts, 1.6, style, 0.05, 0.4, 0.2)
  for (let i = 2; i < 10; i++) {
    const [px, py] = pts[i]
    const ang = a + bend * (i / 10) ** 2
    const pl = len * 0.16 * (1 - i / 12)
    for (const sgn of [-1, 1]) {
      const pa = ang + sgn * 1.05
      brush(g, [[px, py], [px + Math.cos(pa) * pl * 0.6, py + Math.sin(pa) * pl * 0.6 + pl * 0.15], [px + Math.cos(pa) * pl, py + Math.sin(pa) * pl + pl * 0.4]], 2.2, style, 0.1, 0.5, 0.2)
    }
  }
}

/**
 * A block of stone with mass, for carved words: the front face (a slab, where the words are cut) and, behind it, its top
 * and its right flank receding up-right by (dx, dy) — the top moonlit and mossy, the flank a tone darker — standing on
 * (x, y) with its contact and long shadow. w × hh is the front face.
 */
export function paintBlock(g: CanvasRenderingContext2D, p: Pal, x: number, y: number, w: number, hh: number, dx: number, dy: number, seed: number, moss = 0, dark = 0) {
  const { top } = slab(w, hh, seed)
  const lit = mix(mix(p['rock-hi'], p['rock-lo'], dark * 0.6), p.moon, p.dark ? 0.12 : 0)
  const side = mix(p['rock-mid'], p.umbra, 0.25 + dark * 0.4)
  g.save()
  g.translate(x, y)
  glow(g, -w * 0.2, 0, w * 0.95, Math.max(3, hh * 0.12), p.umbra, p.dark ? 0.6 : 0.3, 0.55)
  // the mass behind the face: the crown swept back into a top, the right flank into a side
  const n = top.length
  for (let i = 0; i < n - 1; i++) {
    const [a, b] = top[i], [c, d] = top[i + 1]
    const flank = a > w * 0.4
    g.fillStyle = col(flank ? side : lit)
    g.beginPath()
    g.moveTo(a, b)
    g.lineTo(c, d)
    g.lineTo(c + dx, d + dy)
    g.lineTo(a + dx, b + dy)
    g.closePath()
    g.fill()
    g.strokeStyle = g.fillStyle
    g.lineWidth = 0.8
    g.stroke()
  }
  const crown: Pt[] = top.filter(([a]) => a <= w * 0.42).map(([a, b]) => [a + dx, b + dy] as Pt)
  fillD(g, stroke(crown, Math.max(1.2, w * 0.012), 0.2, 0.2, 0.3), col(p.dark ? p.umbra : p.wash, p.dark ? 0.8 : 0.45))
  fillD(g, stroke(top.filter(([a]) => a > w * 0.1 && a <= w * 0.42).map(([a, b]) => [a + dx * 0.5, b + dy * 0.5 + 0.5] as Pt), Math.max(1, w * 0.01), 0.3, 0.3, 0.2), col(p.dark ? p.moon : p['rake-hi'], p.dark ? 0.4 : 0.9))
  if (moss) {
    const r = rng(seed + 11)
    for (let k = 0; k < 2; k++) {
      const t = 0.2 + r() * 0.5, pt = top[Math.floor(n * t)]
      mossDots(g, p, pt[0] + dx * 0.5, pt[1] + dy * 0.5, w * (0.06 + moss * 0.06), Math.abs(dy) * 0.3, seed + k * 7, 0.9)
    }
  }
  g.restore()
  paintRock(g, p, x, y, w, hh, seed, { shape: 'slab', light: 1, cast: 0, dark })
}

/**
 * Words carved on a painted stone: an element whose background is a lit slab painted to its own size. Call paint() after
 * measuring (sizes read once per layout); dark: tone of the stone (darker by night so ivory letters read). With `mass`,
 * the slab is the face of a block whose top and flank show behind it.
 */
export function carved(cls: string, ...kids: (Node | string)[]) {
  const c = canvas('t20-carved-cv')
  const el = h('div', { class: `t20-carved ${cls}` }, c, ...kids)
  let seed = 0
  for (const ch of cls) seed = (seed * 31 + ch.charCodeAt(0)) | 0
  return {
    el,
    paint(p: Pal, w: number, hh: number, dpr: number, moss = 0, mass = 0) {
      const pad = Math.max(14, w * 0.08)
      const dx = w * 0.07 * mass, dy = -hh * 0.38 * mass
      const g = fit(c, w + pad * 2 + dx, hh + pad - dy, dpr)
      c.style.left = `${-pad}px`
      c.style.top = `${-pad * 0.35 + dy}px`
      const tone = p.dark ? 0.42 : 0
      if (mass) paintBlock(g, p, pad + w / 2, hh + pad * 0.3 - dy, w, hh, dx, dy, Math.abs(seed) + 7, moss, tone)
      else paintRock(g, p, pad + w / 2, hh + pad * 0.3, w, hh, Math.abs(seed) + 7, { shape: 'slab', light: 1, moss, cast: 0.25, dark: tone })
    },
  }
}

/**
 * A far range painted soft: crowns rounded from a few lopsided bumps and a little noise (never a cone), a wash that
 * thins into mist at the foot, dry texture strokes down the shaded (left) flanks and a moonlit edge on the right of each
 * crown. depth 0 near … 1 far: the farther, the paler, and past 0.6 only the wash.
 */
export function range(x0: number, x1: number, base: number, hh: number, seed: number, depth: number, peaks: number): SVGGElement {
  const r = rng(seed)
  const W = x1 - x0
  const B = Array.from({ length: peaks }, (_, i) => ({ c: x0 + (W * (i + 0.5 + (r() - 0.5) * 0.7)) / peaks, w: (W * (0.15 + r() * 0.16)) / Math.sqrt(peaks), a: hh * (0.35 + r() * 0.5), sk: (r() - 0.5) * 0.7 }))
  B[Math.floor(r() * peaks)].a = hh
  const ph = [r() * 9, r() * 9, r() * 9]
  const N = Math.max(40, Math.round(W / 6))
  const top: Pt[] = []
  for (let i = 0; i <= N; i++) {
    const x = x0 + (W * i) / N
    let y = hh * 0.04
    for (const b of B) {
      let t = (x - b.c) / b.w
      t *= t < 0 ? 1 + b.sk : 1 - b.sk
      y = Math.max(y, b.a / (1 + Math.abs(1.6 * t) ** 2.6)) // a rounded crown on long shoulders
    }
    y += hh * (0.035 * Math.sin(x * 0.04 + ph[0]) + 0.018 * Math.sin(x * 0.11 + ph[1]) + 0.008 * Math.sin(x * 0.37 + ph[2]))
    top.push([x, base - Math.max(0, y)])
  }
  const f1 = (n: number) => n.toFixed(1)
  const g = s('g', { class: 'p2p-hills' },
    s('path', { class: 'p2p-hill', d: `M${f1(x0)} ${f1(base)}L${top.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}L${f1(x1)} ${f1(base)}Z`, style: `--o:${(0.14 + (1 - depth) * 0.46).toFixed(2)}`, filter: 'url(#ink-wash)' }))
  if (depth > 0.6) return g
  let cun = '', rim = ''
  for (const b of B) {
    const ci = top.reduce((m, p, i) => (Math.abs(p[0] - b.c) < Math.abs(top[m][0] - b.c) ? i : m), 0)
    if (base - top[ci][1] < hh * 0.3) continue
    // texture: dry strokes falling from under the crown down the left flank
    for (let q = 0; q < 5; q++) {
      const i0 = Math.max(1, ci - 2 - Math.floor(r() * 10))
      const [x, y] = top[i0]
      const len = (base - y) * (0.2 + r() * 0.35)
      cun += stroke(curve([x + 1, y + 3], [x - len * 0.12, y + len * 0.5], [x - len * 0.05, y + len], 6), 1 + r() * 1.5, 0.1, 0.5, 0.1)
    }
    rim += stroke(top.slice(ci, Math.min(top.length, ci + 7)).map(([x, y]) => [x + 0.8, y + 0.6] as Pt), 1.6, 0.2, 0.4, 0.1)
  }
  g.append(s('path', { class: 'p2p-cun', d: cun, filter: 'url(#ink-dry)' }), s('path', { class: 'p2p-rim', d: rim }))
  return g
}
