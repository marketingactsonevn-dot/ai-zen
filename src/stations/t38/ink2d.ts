import { h } from '../../core/dom'
import { cssVar } from '../../core/prefs'
import { blob, rng, stroke, type Pt } from '../../ui/part2/ink'
import { ridge } from '../../ui/part2/paint'

/**
 * Trạm 38's Canvas 2D ink kit (copied from t20's and grown): Part 2 tokens as numbers (read on mount and in onPrefs,
 * compare `key` before repainting), sized canvases, value noise, glows, the moon, lit stones, ink hills and a paper grain
 * tile. Nothing here runs per frame on its own.
 */

export type RGB = [number, number, number, number]
const NAMES = ['paper', 'paper-2', 'card', 'wash', 'ink', 'ink-2', 'ink-3', 'rock-hi', 'rock-mid', 'rock-lo', 'umbra', 'step-hi', 'step-mid', 'step-lo', 'moss-a', 'moss-b', 'moss-c', 'water', 'mist', 'moon', 'moon-rim', 'lantern', 'vermilion', 'rake', 'rake-hi', 'dawn'] as const
export type Pal = Record<(typeof NAMES)[number], RGB> & { dark: boolean; mistA: number; key: string }

function parse(v: string): RGB {
  if (v.startsWith('#')) {
    const x = v.length === 4 ? v.slice(1).split('').map((c) => c + c).join('') : v.slice(1, 7)
    return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16), 1]
  }
  const m = v.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0]
  return [m[0], m[1], m[2], m[3] ?? 1]
}

/** The Part 2 tokens as numbers. */
export function palette(): Pal {
  const p = { dark: document.documentElement.dataset.theme === 'dark', mistA: parseFloat(cssVar('--mist-a')) || 0.5, key: '' } as Pal
  for (const n of NAMES) {
    const v = cssVar(`--${n}`)
    p.key += v
    p[n] = parse(v)
  }
  p.key += p.dark
  return p
}

/** rgba() of a token at a share of its own alpha. */
export const col = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${Math.max(0, Math.min(1, c[3] * a)).toFixed(3)})`
export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t]
/** A token flattened over the paper (for tokens with alpha, e.g. --dawn, --rake). */
export const flat = (p: Pal, c: RGB, over: RGB = p.paper): RGB => [over[0] + (c[0] - over[0]) * c[3], over[1] + (c[1] - over[1]) * c[3], over[2] + (c[2] - over[2]) * c[3], 1]

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

const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453
  return s - Math.floor(s)
}
/** Smooth 1D value noise in -1…1. */
export function noise(x: number, seed = 0) {
  const i = Math.floor(x), f = x - i
  const u = f * f * (3 - 2 * f)
  return (hash(i + seed * 57.13) * (1 - u) + hash(i + 1 + seed * 57.13) * u) * 2 - 1
}
/** Smooth 2D value noise in 0…1. */
export function noise2(x: number, y: number, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy)
  const k = (a: number, b: number) => hash(a * 12.9898 + b * 78.233 + seed * 37.719)
  const a = k(ix, iy), b = k(ix + 1, iy), c = k(ix, iy + 1), d = k(ix + 1, iy + 1)
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy
}
/** fbm of noise2, 0…1. */
export function fbm(x: number, y: number, seed = 0, oct = 4) {
  let v = 0, a = 0.5, n = 0
  for (let i = 0; i < oct; i++) {
    v += noise2(x, y, seed + i * 7) * a
    n += a
    x *= 2.03
    y *= 2.03
    a *= 0.5
  }
  return v / n
}

/** 128² paper grain, 0…1 (module-level, built once). */
export const GRAIN = (() => {
  const g = new Float32Array(128 * 128)
  const r = rng(3801)
  for (let i = 0; i < g.length; i++) g[i] = r()
  // one box blur pass so the grain is fibrous, not pixel salt
  const o = new Float32Array(g.length)
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 128; x++) o[y * 128 + x] = (g[y * 128 + x] * 2 + g[y * 128 + ((x + 1) & 127)] + g[y * 128 + ((x + 127) & 127)] + g[((y + 1) & 127) * 128 + x]) / 5
  return o
})()

/** Fill an ink.ts path string (stroke / blob / rock) in a colour. */
export function fillD(g: CanvasRenderingContext2D, d: string, style: string | CanvasGradient) {
  g.fillStyle = style
  g.fill(new Path2D(d))
}
/** A brushed stroke (ink.ts `stroke`) in a colour. */
export const brush = (g: CanvasRenderingContext2D, pts: Pt[], w: number, style: string, a = 0.15, b = 0.35, min = 0.2) => fillD(g, stroke(pts, w, a, b, min), style)

const GLOW = new Map<string, CanvasGradient>() // unit radial gradients per colour × strength (a context's gradients work on any context)
/** A soft radial glow / fog bank. */
export function glow(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, c: RGB, a: number, mid = 0.45) {
  if (rx < 1 || ry < 1 || a <= 0) return
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
  glow(g, x, y, rx, ry, p.mist, Math.min(1, p.mistA * k * (p.dark ? 2.2 : 1)), 0.6)

/** The moon: halo, warm disc, faint seas; `sink` 0…1 hides its lower part behind the horizon line at y + r·(1 − 2·sink). */
export function moonDisc(g: CanvasRenderingContext2D, p: Pal, x: number, y: number, r: number, seed = 1, halo = 1) {
  glow(g, x, y, r * 5, r * 5, p.moon, (p.dark ? 0.36 : 0.55) * halo, 0.25)
  glow(g, x, y, r * 2, r * 2, p.moon, (p.dark ? 0.5 : 0.7) * halo, 0.4)
  const d = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r)
  d.addColorStop(0, col(p.moon))
  d.addColorStop(0.8, col(p.moon))
  d.addColorStop(1, col(p.moon, 0.85))
  g.fillStyle = d
  g.beginPath()
  g.arc(x, y, r, 0, Math.PI * 2)
  g.fill()
  fillD(g, blob(x - r * 0.28, y - r * 0.18, r * 0.34, r * 0.24, seed, 0.2) + blob(x + r * 0.24, y + r * 0.12, r * 0.24, r * 0.3, seed + 1, 0.2), col(p.wash, p.dark ? 0.08 : 0.06))
  if (!p.dark) {
    // by day the disc is pale on a pale sky: a thin ink rim gives it its edge
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.strokeStyle = col(p.wash, 0.22)
    g.lineWidth = 1
    g.stroke()
  }
}

/** The sky behind a scene: paper → paper-2 wash, and the dawn breaking low at (dx, hz). */
export function sky(g: CanvasRenderingContext2D, p: Pal, W: number, H: number, hz: number, dx: number, dawn = 1) {
  const sg = g.createLinearGradient(0, 0, 0, H)
  sg.addColorStop(0, col(p.dark ? mix(p.paper, p.wash, 0.5) : p['paper-2']))
  sg.addColorStop(Math.min(0.95, hz / H), col(p.paper))
  sg.addColorStop(1, col(p.paper))
  g.fillStyle = sg
  g.fillRect(0, 0, W, H)
  const dw: RGB = [p.dawn[0], p.dawn[1], p.dawn[2], 1]
  glow(g, dx, hz, W * 0.55 * dawn, H * 0.42 * dawn, dw, p.dark ? 0.22 : 0.5, 0.35)
  glow(g, dx, hz, W * 0.22 * dawn, H * 0.12 * dawn, dw, p.dark ? 0.3 : 0.6, 0.4)
}

/** A range of ink hills on (x0…x1, base), `depth` 0 near (dark, a lit ridge) … 1 far (a pale wash), feet in mist. */
export function inkHills(g: CanvasRenderingContext2D, p: Pal, x0: number, x1: number, base: number, hh: number, seed: number, depth: number, peaks = 4, light = -1) {
  const pts = ridge(x0, x1, base, hh, seed, peaks)
  const path = new Path2D()
  path.moveTo(x0, base + 2)
  for (const [x, y] of pts) path.lineTo(x, y)
  path.lineTo(x1, base + 2)
  path.closePath()
  const top = Math.min(...pts.map((q) => q[1]))
  const tone = p.dark ? mix(p.wash, p['rock-lo'], 0.55 - depth * 0.3) : mix(p.wash, p.paper, 0.45 + depth * 0.45)
  const lg = g.createLinearGradient(0, top, 0, base)
  lg.addColorStop(0, col(tone, p.dark ? 0.95 : 0.9 - depth * 0.3))
  lg.addColorStop(1, col(tone, 0))
  g.fillStyle = lg
  g.fill(path)
  if (depth < 0.7) {
    // the moonlit flank of each peak: a pale wash on the side toward the moon
    g.save()
    g.clip(path)
    for (let i = 1; i < pts.length - 1; i++) {
      const [x, y] = pts[i]
      if (y > pts[i - 1][1] || y > pts[i + 1][1]) continue
      const w = (base - y) * 1.4
      glow(g, x + light * w * 0.28, y + (base - y) * 0.35, w * 0.35, (base - y) * 0.5, p.dark ? p.moon : p.paper, p.dark ? 0.1 : 0.4, 0.5)
    }
    g.restore()
    brush(g, pts, (1.3 - depth) * 1.6, col(p.dark ? p.wash : p.wash, p.dark ? 0.6 : 0.35 - depth * 0.15), 0.1, 0.2, 0.15)
  }
}

export interface RockOpts {
  /** moon side: 1 = right, -1 = left */
  light?: number
  moss?: number
  /** long cast shadow, as a share of the stone's width (0 = contact only) */
  cast?: number
  dark?: number
}

/** A lit garden stone standing on (x, y), w × h (ink.ts `rock` silhouette): cast + contact shadow, three tones across
 *  the light, a brushy terminator, dry strokes in the shade, moss on the crown, ink edge and moon rim. */
export function paintRock(g: CanvasRenderingContext2D, p: Pal, x: number, y: number, w: number, hh: number, seed: number, o: RockOpts = {}, shape?: { top: Pt[]; d: string }) {
  const L = o.light ?? 1
  const r = rng(seed)
  const { top, d } = shape ?? rockShape(w, hh, seed)
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
  const fg = g.createLinearGradient(0, -hh * 0.45, 0, 0)
  fg.addColorStop(0, col(p.umbra, 0))
  fg.addColorStop(1, col(p.umbra, p.dark ? 0.55 : 0.32))
  g.fillStyle = fg
  g.fillRect(-w, -hh * 0.5, w * 2, hh * 0.6)
  for (let i = 0; i < 4; i++) {
    const y0 = -hh * (0.2 + r() * 0.6), x0 = -L * w * (0.12 + r() * 0.3)
    fillD(g, stroke([[x0, y0], [x0 - L * w * (0.1 + r() * 0.12), y0 + hh * (0.08 + r() * 0.1)], [x0 - L * w * (0.2 + r() * 0.1), y0 + hh * (0.2 + r() * 0.1)]], 1 + w * 0.02, 0.3, 0.4, 0.15), col(p.wash, p.dark ? 0.4 : 0.14))
  }
  if (o.moss) {
    const crown = top.reduce((a, b) => (b[1] < a[1] ? b : a))
    const mw = w * (0.22 + o.moss * 0.26)
    fillD(g, blob(crown[0] + L * w * 0.06, crown[1] + hh * 0.06, mw, hh * (0.08 + o.moss * 0.1), seed + 3, 0.3, 16), col(p['moss-b'], 0.9))
    fillD(g, blob(crown[0] + L * w * 0.1, crown[1] + hh * 0.03, mw * 0.6, hh * 0.06, seed + 4, 0.3, 12), col(p['moss-a'], 0.85))
  }
  g.restore()
  const n = top.length
  const shade = L > 0 ? top.slice(0, Math.floor(n * 0.62)) : top.slice(Math.floor(n * 0.38))
  const lit = L > 0 ? top.slice(Math.floor(n * 0.4), n - 2) : top.slice(2, Math.floor(n * 0.6))
  fillD(g, stroke(shade, Math.max(1.2, w * 0.03), 0.15, 0.3, 0.25), col(p.dark ? p.umbra : p.wash, p.dark ? 0.8 : 0.5))
  fillD(g, stroke(lit.map(([a, b]) => [a - L * 0.6, b + 0.8] as Pt), Math.max(1, w * 0.022), 0.3, 0.3, 0.1), p.dark ? col(p.moon, 0.55) : col(p['rake-hi'], 1))
  g.restore()
}

/** A rounded field stone silhouette standing on y = 0 (same shape family as ink.ts `rock`, flatter). */
export function rockShape(w: number, hh: number, seed: number): { top: Pt[]; d: string } {
  const r = rng(seed)
  const top: Pt[] = []
  const n = 18
  const peak = (r() - 0.5) * 0.3
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const a = Math.PI * (1 - t)
    const bulge = Math.pow(Math.sin(a), 0.7 + r() * 0.08)
    top.push([Math.cos(a) * w * 0.5, -hh * bulge * (1 + peak * Math.cos(a)) * (0.94 + r() * 0.06)])
  }
  const P = (q: Pt) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`
  return { top, d: `M${top.map(P).join('L')}Q0 ${(hh * 0.05).toFixed(1)} ${P(top[0])}Z` }
}

/** A stepping stone lying on the ground at (x, y), rx × ry on screen: side, top face lit from `light`, rim, moss. */
export function stepStone(g: CanvasRenderingContext2D, p: Pal, x: number, y: number, rx: number, ry: number, seed: number, light = -1, fade = 0) {
  const r = rng(seed)
  const top = new Path2D(blob(x, y, rx, ry, seed, 0.1, 16))
  const side = new Path2D(blob(x, y + ry * 0.32, rx * 0.98, ry, seed, 0.1, 16))
  glow(g, x - light * rx * 0.35, y + ry * 0.5, rx * 1.3, ry * 0.9, p.umbra, (p.dark ? 0.5 : 0.22) * (1 - fade), 0.5)
  const hiT = p.dark ? mix(p['step-mid'], p['rock-hi'], 0.5) : mix(p['rock-hi'], p['rock-mid'], 0.35)
  const loT = p.dark ? p['rock-mid'] : p['rock-mid']
  g.fillStyle = col(mix(p.dark ? p['rock-lo'] : p['rock-lo'], p.paper, fade * 0.7))
  g.fill(side)
  const lg = g.createLinearGradient(x + light * rx, y - ry, x - light * rx * 0.6, y + ry)
  lg.addColorStop(0, col(mix(hiT, p.paper, fade * 0.6)))
  lg.addColorStop(1, col(mix(loT, p.paper, fade * 0.6)))
  g.fillStyle = lg
  g.fill(top)
  if (r() < 0.55 && fade < 0.6) fillD(g, blob(x - light * rx * 0.3, y + ry * 0.2, rx * 0.32, ry * 0.25, seed + 5, 0.3, 10), col(p['moss-b'], 0.5 * (1 - fade)))
  const arc: Pt[] = []
  for (let k = 0; k <= 8; k++) {
    const a = Math.PI * (light < 0 ? 1.05 + k * 0.06 : 1.95 - k * 0.06)
    arc.push([x + Math.cos(a) * rx * 0.86, y + Math.sin(a) * ry * 0.86])
  }
  brush(g, arc, Math.max(1, rx * 0.07), p.dark ? col(p.moon, 0.35 * (1 - fade)) : col(p['rake-hi'], 1 - fade), 0.3, 0.3, 0.1)
  const low: Pt[] = []
  for (let k = 0; k <= 10; k++) {
    const a = Math.PI * (0.05 + k * 0.09)
    low.push([x + Math.cos(a) * rx, y + ry * 0.3 + Math.sin(a) * ry])
  }
  brush(g, low, Math.max(0.8, rx * 0.05), col(p.dark ? p.umbra : p.wash, (p.dark ? 0.6 : 0.35) * (1 - fade)), 0.2, 0.3, 0.2)
}

/** Tile the paper grain over a canvas region (multiply-ish, very light). */
export function grainOver(g: CanvasRenderingContext2D, p: Pal, W: number, H: number, k = 1) {
  const t = grainTile(p)
  g.save()
  g.globalAlpha = (p.dark ? 0.35 : 0.5) * k
  g.fillStyle = g.createPattern(t, 'repeat')!
  g.fillRect(0, 0, W, H)
  g.restore()
}
let tileKey = ''
let tile: HTMLCanvasElement | null = null
function grainTile(p: Pal) {
  if (tile && tileKey === p.key) return tile
  tileKey = p.key
  tile = document.createElement('canvas')
  tile.width = tile.height = 128
  const g = tile.getContext('2d')!
  const im = g.createImageData(128, 128)
  const ink = p.dark ? [0, 0, 0] : [p.wash[0], p.wash[1], p.wash[2]]
  for (let i = 0; i < GRAIN.length; i++) {
    const v = GRAIN[i]
    im.data[i * 4] = ink[0]
    im.data[i * 4 + 1] = ink[1]
    im.data[i * 4 + 2] = ink[2]
    im.data[i * 4 + 3] = Math.max(0, (v - 0.5) * 2) * 40
  }
  g.putImageData(im, 0, 0)
  return tile
}
