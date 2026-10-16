import { onPrefs } from '../../core/prefs'
import { rng, stroke, type Pt } from '../../ui/part2/ink'
import { ridge } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'

/**
 * Station 34 canvas kit: Part 2 tokens read into numbers (on mount and on theme change only), value noise for brush
 * wobble, HiDPI layers, and a few painted pieces (soft light, mist, ink ridges, the moon, a tapered brush) so the
 * scenes can paint real light and depth in Canvas 2D. No frame loop here; scenes redraw on events.
 */

export type C4 = [number, number, number, number]
export interface Tok {
  dark: boolean
  paper: C4; paper2: C4; card: C4; ink: C4; ink2: C4; ink3: C4; wash: C4; umbra: C4
  rockHi: C4; rockMid: C4; rockLo: C4; stepHi: C4; stepMid: C4; stepLo: C4
  mossA: C4; mossB: C4; mossC: C4; water: C4; mist: C4; mistA: number; moon: C4; moonRim: C4
  lantern: C4; firefly: C4; vermilion: C4
}

let probe: CanvasRenderingContext2D | null = null
/** Any CSS colour → [r, g, b, a] (the browser normalises it for us). */
export function parse(str: string): C4 {
  probe ??= document.createElement('canvas').getContext('2d')!
  probe.fillStyle = '#000'
  probe.fillStyle = str || '#000'
  const v = String(probe.fillStyle)
  if (v[0] === '#') return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16), 1]
  const m = v.match(/[\d.]+/g)!.map(Number)
  return [m[0], m[1], m[2], m[3] ?? 1]
}

/** Read the page's Part 2 tokens (getComputedStyle: mount / onPrefs only, never in a frame). */
export function readTok(): Tok {
  const cs = getComputedStyle(document.documentElement)
  const c = (n: string) => parse(cs.getPropertyValue(n).trim())
  return {
    dark: document.documentElement.dataset.theme === 'dark',
    paper: c('--paper'), paper2: c('--paper-2'), card: c('--card'), ink: c('--ink'), ink2: c('--ink-2'), ink3: c('--ink-3'), wash: c('--wash'), umbra: c('--umbra'),
    rockHi: c('--rock-hi'), rockMid: c('--rock-mid'), rockLo: c('--rock-lo'), stepHi: c('--step-hi'), stepMid: c('--step-mid'), stepLo: c('--step-lo'),
    mossA: c('--moss-a'), mossB: c('--moss-b'), mossC: c('--moss-c'), water: c('--water'), mist: c('--mist'), mistA: parseFloat(cs.getPropertyValue('--mist-a')) || 0.5,
    moon: c('--moon'), moonRim: c('--moon-rim'), lantern: c('--lantern'), firefly: c('--firefly'), vermilion: c('--vermilion'),
  }
}
const key = (t: Tok) => JSON.stringify(t)

/** Call fn(tok) when the colours really change (onPrefs also fires for sound / quality). Returns the first tokens. */
export function watchTok(ctx: SceneCtx, fn: (t: Tok) => void): Tok {
  let t = readTok()
  let k = key(t)
  ctx.onCleanup(onPrefs(() => {
    const n = readTok(), nk = key(n)
    if (nk === k) return
    t = n
    k = nk
    fn(n)
  }))
  return t
}

export const rgba = (c: C4, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${Math.max(0, Math.min(1, c[3] * a)).toFixed(3)})`
export const mix = (a: C4, b: C4, t: number): C4 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t]
export const lum = (c: C4) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
export const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}

// value noise on a seeded lattice (built once for the module)
const PERM = (() => {
  const r = rng(3434)
  const p = Array.from({ length: 256 }, (_, i) => i)
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[p[i], p[j]] = [p[j], p[i]]
  }
  return Float32Array.from([...p, ...p].map((v) => v / 255))
})()
/** Smooth value noise in 0…1. */
export function noise(x: number, y = 0): number {
  const xi = Math.floor(x), yi = Math.floor(y)
  const xf = x - xi, yf = y - yi
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
  const X = xi & 255, Y = yi & 255
  const a = PERM[X + PERM[Y] * 255 | 0], b = PERM[X + 1 + PERM[Y] * 255 | 0]
  const c = PERM[X + PERM[Y + 1] * 255 | 0], d = PERM[X + 1 + PERM[Y + 1] * 255 | 0]
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
export const fbm = (x: number, y = 0) => noise(x, y) * 0.55 + noise(x * 2.1 + 7, y * 2.1 + 3) * 0.3 + noise(x * 4.3 + 1, y * 4.3 + 9) * 0.15

/** Px from the bottom of the art's laid-out height hh down to the player's bottom edge: a painting bleeds under the
 *  scene foot (insight, prompt pill, rail) so water / sand runs to the bottom and melts into the paper. Read-only. */
export function bleedBelow(ctx: SceneCtx, hh: number): number {
  return Math.max(0, ctx.el.clientHeight - ctx.art.offsetTop - hh)
}

/** Words written on water (§3.6): a flipped copy at 20 % under el, inert and hidden from readers. Call after filling el. */
export function mirrorOf(el: HTMLElement, into: HTMLElement) {
  const m = el.cloneNode(true) as HTMLElement
  m.removeAttribute('id')
  m.removeAttribute('aria-live')
  m.querySelectorAll('[id]').forEach((x) => x.removeAttribute('id'))
  into.replaceChildren(...m.childNodes)
  into.setAttribute('aria-hidden', 'true')
  into.inert = true
}

/** Device pixel ratio for a layer: full at high quality (cap), lighter at low. */
export const dprFor = (ctx: SceneCtx, cap = 2) => Math.min(devicePixelRatio || 1, ctx.quality === 'low' ? 1.25 : cap)

export interface Layer {
  cv: HTMLCanvasElement
  g: CanvasRenderingContext2D
  w: number
  h: number
  /** resize the backing store (CSS size w × h); true when it changed (the layer is then blank) */
  size(w: number, h: number, dpr: number): boolean
  /** clear and reset the transform to CSS px */
  clear(): void
}
export function layer(cls: string): Layer {
  const cv = document.createElement('canvas')
  cv.className = cls
  cv.setAttribute('aria-hidden', 'true')
  const g = cv.getContext('2d')!
  let dpr = 1
  const L: Layer = {
    cv, g, w: 0, h: 0,
    size(w, h, d) {
      const W = Math.max(1, Math.round(w * d)), H = Math.max(1, Math.round(h * d))
      L.w = w
      L.h = h
      dpr = d
      cv.style.width = `${w}px`
      cv.style.height = `${h}px`
      if (cv.width === W && cv.height === H) return false
      cv.width = W
      cv.height = H
      return true
    },
    clear() {
      g.setTransform(1, 0, 0, 1, 0, 0)
      g.globalAlpha = 1
      g.globalCompositeOperation = 'source-over'
      g.clearRect(0, 0, cv.width, cv.height)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
    },
  }
  return L
}

/** A soft pool of light / shade: an ellipse whose alpha falls from a (centre) to 0 (edge), optionally rotated. */
export function soft(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, c: C4, a: number, rot = 0, core = 0) {
  if (rx < 0.5 || ry < 0.5 || a <= 0) return
  g.save()
  g.translate(x, y)
  if (rot) g.rotate(rot)
  g.scale(1, ry / rx)
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx)
  gr.addColorStop(0, rgba(c, a))
  if (core) gr.addColorStop(core, rgba(c, a * 0.9))
  gr.addColorStop(0.55, rgba(c, a * 0.32))
  gr.addColorStop(1, rgba(c, 0))
  g.fillStyle = gr
  g.beginPath()
  g.arc(0, 0, rx, 0, Math.PI * 2)
  g.fill()
  g.restore()
}

/** A bank of mist in the token colour (paler and denser by day, a breath at night). */
export function mist(g: CanvasRenderingContext2D, T: Tok, x: number, y: number, rx: number, ry: number, k = 1) {
  soft(g, x, y, rx, ry, T.mist, Math.min(1, T.mistA * k * (T.dark ? 1.6 : 0.9)))
}

/** Fill a brush shape (ink.ts path data) in colour c. */
export function brush(g: CanvasRenderingContext2D, d: string, c: C4, a = 1) {
  if (!d) return
  g.fillStyle = rgba(c, a)
  g.fill(new Path2D(d))
}
/** A tapered brush stroke through pts. */
export const inkLine = (g: CanvasRenderingContext2D, pts: Pt[], w: number, c: C4, a = 1, ta = 0.15, tb = 0.35, min = 0.2) => pts.length > 1 && brush(g, stroke(pts, w, ta, tb, min), c, a)

/** Points → closed polygon path on g (no fill). */
export function poly(g: CanvasRenderingContext2D, pts: Pt[], close = true) {
  g.beginPath()
  g.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1])
  if (close) g.closePath()
}

/** A vertical gradient fill style between y0 and y1. */
export function vgrad(g: CanvasRenderingContext2D, y0: number, y1: number, stops: [number, C4, number][]) {
  const gr = g.createLinearGradient(0, y0, 0, y1)
  for (const [o, c, a] of stops) gr.addColorStop(clamp01(o), rgba(c, a))
  return gr
}

/** One range of ink mountains melting into mist at the foot (wash) with a dry ridge stroke when near. */
export function mountains(g: CanvasRenderingContext2D, T: Tok, x0: number, x1: number, base: number, h: number, seed: number, peaks: number, depth: number) {
  const top = ridge(x0, x1, base, h, seed, peaks)
  const a = (0.16 + (1 - depth) * 0.5) * (T.dark ? 1.7 : 1)
  poly(g, [[x0, base], ...top, [x1, base]])
  g.fillStyle = vgrad(g, base - h, base, [[0, T.wash, 0.95 * a], [0.45, T.wash, 0.5 * a], [1, T.wash, 0]])
  g.fill()
  if (depth > 0.6) return
  const r = rng(seed + 3)
  const cuts = [0, 0.3 + r() * 0.12, 0.62 + r() * 0.12, 1].map((k) => Math.round(k * (top.length - 1)))
  for (let i = 0; i < cuts.length - 1; i++) {
    const seg = top.slice(cuts[i] + (i ? 2 : 0), cuts[i + 1] + 1)
    if (seg.length > 2) inkLine(g, seg, (1.2 + (1 - depth) * 1.8) * (0.8 + r() * 0.5), T.wash, (0.35 + (1 - depth) * 0.4) * (T.dark ? 1 : 0.8), 0.12, 0.3, 0.15)
  }
  // moonlit edge on the crown
  const crown = top.reduce((p, q) => (q[1] < p[1] ? q : p))
  const ci = top.indexOf(crown)
  inkLine(g, top.slice(Math.max(0, ci - 7), ci + 3).map(([x, y]) => [x - 1, y - 1] as Pt), 1.4, T.dark ? T.moon : T.card, T.dark ? 0.28 : 0.6, 0.3, 0.2, 0.1)
}

/** The moon: halo, disc with faint seas, a breath of cloud. */
export function moonDisc(g: CanvasRenderingContext2D, T: Tok, x: number, y: number, r: number, seed = 1, halo = 1, cloud = true) {
  soft(g, x, y, r * 5.5, r * 5.5, T.moon, (T.dark ? 0.3 : 0.5) * halo)
  soft(g, x, y, r * 2.2, r * 2.2, T.moon, (T.dark ? 0.35 : 0.45) * halo)
  const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r)
  gr.addColorStop(0, rgba(mix(T.moon, [255, 255, 255, 1], 0.4)))
  gr.addColorStop(0.75, rgba(T.moon))
  gr.addColorStop(1, rgba(mix(T.moon, T.lantern, 0.25)))
  g.fillStyle = gr
  g.beginPath()
  g.arc(x, y, r, 0, Math.PI * 2)
  g.fill()
  const q = rng(seed)
  for (let i = 0; i < 3; i++) soft(g, x + (q() - 0.5) * r, y + (q() - 0.5) * r, r * (0.2 + q() * 0.18), r * (0.16 + q() * 0.14), T.lantern, 0.22)
  g.strokeStyle = rgba(T.dark ? T.lantern : T.ink, T.dark ? 0.25 : 0.18)
  g.lineWidth = 1
  g.stroke()
  if (!cloud) return
  // a thin cloud across the lower half
  g.save()
  g.beginPath()
  g.ellipse(x - r * 0.2, y + r * 0.45, r * 1.9, r * 0.12, -0.04, 0, Math.PI * 2)
  g.fillStyle = rgba(T.dark ? T.paper : T.mist, T.dark ? 0.7 : 0.75)
  g.fill()
  g.restore()
}

let tile: HTMLCanvasElement | null = null
const pats = new WeakMap<CanvasRenderingContext2D, CanvasPattern>()
/** Paper / clay grain over a rect (one 128² noise tile for the whole module). */
export function grain(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a: number) {
  if (!tile) {
    tile = document.createElement('canvas')
    tile.width = tile.height = 128
    const t = tile.getContext('2d')!
    const im = t.createImageData(128, 128)
    const r = rng(77)
    for (let i = 0; i < im.data.length; i += 4) {
      const v = 128 + (r() - 0.5) * 255 * (r() < 0.06 ? 1 : 0.45)
      im.data[i] = im.data[i + 1] = im.data[i + 2] = v
      im.data[i + 3] = 255
    }
    t.putImageData(im, 0, 0)
  }
  let p = pats.get(g)
  if (!p) {
    p = g.createPattern(tile, 'repeat')!
    pats.set(g, p)
  }
  g.save()
  g.globalAlpha = a
  g.globalCompositeOperation = 'overlay'
  g.fillStyle = p
  g.fillRect(x, y, w, h)
  g.restore()
}
