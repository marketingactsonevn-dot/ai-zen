import { h } from '../../core/dom'
import { cssVar, onPrefs } from '../../core/prefs'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { onSize, rng, stableHeight } from '../../ui/part2/ink'

/**
 * Garden 8's painted light for Trạm 23 (art direction §3): the colour tokens as numbers, value noise, stones lit pixel by
 * pixel (ink terminator, moss on the up-facing side, moon rim, broken ink contour), and a "rig": flat layers at depths
 * that move with a tilt (pointer, drag) and a camera lean — 2.5D with one createLoop that runs only while something moves.
 * Everything heavy is a generator for sliced(); a re-layout or a theme change bakes into detached canvases, then swaps.
 */
export type RGB = [number, number, number]
export type Pt = [number, number]

const TOK = {
  paper: '--paper', paper2: '--paper-2', card: '--card', ink: '--ink', ink2: '--ink-2', ink3: '--ink-3', wash: '--wash', water: '--water',
  mist: '--mist', moon: '--moon', rim: '--moon-rim', lantern: '--lantern', red: '--vermilion', hi: '--rock-hi', mid: '--rock-mid', lo: '--rock-lo',
  umbra: '--umbra', mossA: '--moss-a', mossB: '--moss-b', mossC: '--moss-c', stepHi: '--step-hi', stepMid: '--step-mid', stepLo: '--step-lo', moss: '--moss',
} as const
export type Pal = Record<keyof typeof TOK, RGB> & { rimA: number; mistA: number; dark: boolean; key: string }

let probe: CanvasRenderingContext2D | null = null
function parse(str: string): [RGB, number] {
  probe ??= document.createElement('canvas').getContext('2d')
  if (!probe) return [[128, 128, 128], 1]
  probe.fillStyle = '#000'
  probe.fillStyle = str || '#000'
  const v = String(probe.fillStyle)
  if (v[0] === '#') return [[parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16)], 1]
  const m = v.match(/[\d.]+/g)?.map(Number) ?? [128, 128, 128, 1]
  return [[m[0], m[1], m[2]], m[3] ?? 1]
}

/** Read the Part 2 tokens once (mount, onPrefs). `key` changes only when a colour does. */
export function readPal(): Pal {
  const out = {} as Pal
  let key = ''
  for (const [k, name] of Object.entries(TOK)) {
    const raw = cssVar(name)
    key += raw
    const [c, a] = parse(raw)
    ;(out as unknown as Record<string, RGB>)[k] = c
    if (k === 'rim') out.rimA = a
  }
  out.mistA = parseFloat(cssVar('--mist-a')) || 0.5
  out.dark = document.documentElement.dataset.theme === 'dark'
  out.key = key + out.dark
  return out
}

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const sm = (a: number, b: number, t: number) => {
  const x = clamp((t - a) / (b - a), 0, 1)
  return x * x * (3 - 2 * x)
}
export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
export const rgba = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${+a.toFixed(3)})`
export const f1 = (n: number) => n.toFixed(1)

// ── value noise: one 256² table for the module, bilinear with a smooth fade
const NS = 256
const NT = (() => {
  const r = rng(2323)
  const t = new Float32Array(NS * NS)
  for (let i = 0; i < t.length; i++) t[i] = r()
  return t
})()
export function vn(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y)
  const fx = x - xi, fy = y - yi
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy)
  const x0 = xi & 255, y0 = yi & 255, x1 = (x0 + 1) & 255, y1 = (y0 + 1) & 255
  const a = NT[y0 * NS + x0], b = NT[y0 * NS + x1], c = NT[y1 * NS + x0], d = NT[y1 * NS + x1]
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
export function fbm(x: number, y: number, oct = 3) {
  // each octave turned ~37° and shifted, so the value-noise grid never shows as blocks
  let s = 0, n = 0, a = 0.5, px = x, py = y
  for (let i = 0; i < oct; i++) {
    s += a * vn(px, py)
    n += a
    a *= 0.5
    const nx = (px * 0.8 - py * 0.6) * 2.03 + 17.1
    py = (px * 0.6 + py * 0.8) * 2.03 + 3.7
    px = nx
  }
  return s / n
}

/** A canvas of w × h CSS px at `dpr`, its context already scaled to CSS px. */
export function canvas(w: number, h: number, dpr: number) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w * dpr))
  c.height = Math.max(1, Math.round(h * dpr))
  c.style.width = `${f1(w)}px`
  c.style.height = `${f1(h)}px`
  const g = c.getContext('2d')!
  g.scale(dpr, dpr)
  return { c, g }
}

/** The moon of garden 8: high, from the upper right, a little in front (screen x right, y down, z toward the viewer). */
export const MOON: [number, number, number] = (() => {
  const v = [0.42, -0.5, 0.76]
  const l = Math.hypot(v[0], v[1], v[2])
  return [v[0] / l, v[1] / l, v[2] / l] as [number, number, number]
})()

export interface StoneOpts {
  w: number
  h: number
  seed: number
  /** hi, mid, lo, umbra */
  tone: [RGB, RGB, RGB, RGB]
  light?: [number, number, number]
  /** moon rim: colour and strength (light theme: an ink rim; dark: a pale one) */
  rim?: RGB
  rimA?: number
  /** 0…1 and the three moss tones (lit, mid, shade) */
  moss?: number
  mossTone?: [RGB, RGB, RGB]
  /** 'z' = seen from above (moss on the crown), 'y' = seen from the side (moss on the upper face) */
  up?: 'z' | 'y'
  ink?: RGB
  inkA?: number
  /** dome profile: 0.5 a pebble, 0.2 a flat-topped boulder; slab > 0 = a flat slab with a bevel this wide */
  flat?: number
  slab?: number
  /** outline wobble, surface bumps, relief strength, height of the dome (share of the radius) */
  wob?: number
  bump?: number
  height?: number
  /** squareness of the outline (2 = ellipse, 4 = rounded box) */
  sq?: number
  /** raised (white) / cut (black) marks drawn on 50% grey in CSS px, read back as height */
  relief?: (g: CanvasRenderingContext2D, w: number, h: number) => void
  reliefK?: number
  /** wet/lacquer sheen of the moon */
  gloss?: number
  glossC?: RGB
  grain?: number
  /** ambient lift: the shadow side stays in the low wash instead of falling to umbra (0…0.4) */
  amb?: number
  /** dry-brush streaks in the shade (0…1, default 0.5) */
  dry?: number
}

/**
 * A stone lit pixel by pixel (the "thang mực loang", §3.3): hi / mid / lo / umbra with the terminator wobbled like a brush,
 * moss where the face turns up, a moon rim on the moon side, a broken ink contour heavier in shadow, paper grain.
 * Returns a canvas `w × h` CSS px at `dpr` (yield between rows: run it in sliced()).
 */
export function* stone(o: StoneOpts, dpr: number): Generator<void, HTMLCanvasElement> {
  const W = Math.max(2, Math.round(o.w * dpr)), H = Math.max(2, Math.round(o.h * dpr))
  const r = rng(o.seed)
  const ox = r() * 200, oy = r() * 200
  const wob = o.wob ?? 0.12, sq = o.sq ?? 2
  const RT = new Float32Array(97)
  for (let i = 0; i < 97; i++) {
    const a = (i / 96) * Math.PI * 2
    RT[i] = 1 + wob * (fbm(ox + Math.cos(a) * 1.4, oy + Math.sin(a) * 1.4, 3) - 0.5) * 2.2
  }
  let rel: Uint8ClampedArray | null = null
  if (o.relief) {
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const g = c.getContext('2d', { willReadFrequently: true })!
    g.fillStyle = 'rgb(128,128,128)'
    g.fillRect(0, 0, W, H)
    g.scale(dpr, dpr)
    o.relief(g, o.w, o.h)
    rel = g.getImageData(0, 0, W, H).data
  }
  const hgt = new Float32Array(W * H), dd = new Float32Array(W * H)
  const flat = o.flat ?? 0.45, slab = o.slab ?? 0, bump = o.bump ?? 0.06, rk = o.reliefK ?? 0.12
  const nf = 7 / Math.min(o.w, o.h)
  for (let y = 0; y < H; y++) {
    const v = ((y + 0.5) / H) * 2 - 1
    for (let x = 0; x < W; x++) {
      const u = ((x + 0.5) / W) * 2 - 1
      const i = y * W + x
      const a = Math.atan2(v, u)
      const t = ((a / (Math.PI * 2) + 1) % 1) * 96
      const ti = t | 0
      const rr = RT[ti] + (RT[ti + 1] - RT[ti]) * (t - ti)
      const rho = sq === 2 ? Math.sqrt(u * u + v * v) : Math.pow(Math.pow(Math.abs(u), sq) + Math.pow(Math.abs(v), sq), 1 / sq)
      const d = rho / rr
      dd[i] = d
      if (d >= 1) continue
      let hh = slab ? 1 - sm(1 - slab, 1, d) * 0.9 : Math.pow(1 - d * d, flat)
      hh += bump * (fbm(ox + (x / dpr) * nf, oy + (y / dpr) * nf, 3) - 0.5)
      if (rel) hh += ((rel[i * 4] - 128) / 128) * rk
      hgt[i] = hh
    }
    if ((y & 15) === 15) yield
  }
  const img = new ImageData(W, H)
  const px = img.data
  const [Lx, Ly, Lz] = o.light ?? MOON
  const Lxy = Math.hypot(Lx, Ly) || 1
  const [hi, mid, lo, um] = o.tone
  const ink = o.ink ?? um, inkA = o.inkA ?? 0.7
  const rim = o.rim, rimA = o.rimA ?? 0
  const moss = o.moss ?? 0, mt = o.mossTone
  const up = o.up ?? 'z'
  const gloss = o.gloss ?? 0, gc = o.glossC ?? hi
  const grain = o.grain ?? 0.07
  const amb = o.amb ?? 0, dry = o.dry ?? 0.5
  const k = Math.min(W, H) * 0.5 * (o.height ?? 0.7) // height of the crown in pixels
  const aa = Math.min(W, H) * 0.5
  const c: RGB = [0, 0, 0]
  const tone = (t: number, out: RGB, A: RGB, B: RGB, C: RGB, D: RGB) => {
    // four washes with narrow, brushy transitions (no smooth airbrush)
    let p: RGB, q: RGB, f: number
    if (t < 0.3) (p = D), (q = C), (f = sm(0.12, 0.3, t))
    else if (t < 0.56) (p = C), (q = B), (f = sm(0.34, 0.54, t))
    else (p = B), (q = A), (f = sm(0.6, 0.84, t))
    out[0] = p[0] + (q[0] - p[0]) * f
    out[1] = p[1] + (q[1] - p[1]) * f
    out[2] = p[2] + (q[2] - p[2]) * f
  }
  const m3: RGB = [0, 0, 0]
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      const d = dd[i]
      if (d >= 1) continue
      const hx = (hgt[i + (x < W - 1 ? 1 : 0)] - hgt[i - (x > 0 ? 1 : 0)]) * k
      const hy = (hgt[i + (y < H - 1 ? W : 0)] - hgt[i - (y > 0 ? W : 0)]) * k
      let nx = -hx * 0.5, ny = -hy * 0.5, nz = 1
      const nl = Math.hypot(nx, ny, nz)
      nx /= nl
      ny /= nl
      nz /= nl
      const ndl = nx * Lx + ny * Ly + nz * Lz
      const n1 = fbm(ox + (x / dpr) * nf * 0.9, oy + (y / dpr) * nf * 0.9, 2)
      let t = (ndl - 0.28) / 0.72 + (n1 - 0.5) * 0.3
      t = amb + (1 - amb) * clamp(t, 0, 1)
      tone(t, c, hi, mid, lo, um)
      // dry brush in the shadow: pale streaks along the stone
      if (t < 0.34 && dry > 0) {
        const st = vn(ox + (x / dpr) * 0.06, oy + (y / dpr) * 0.9)
        const f = sm(0.62, 0.8, st) * (0.34 - t) * dry
        c[0] += (mid[0] - c[0]) * f
        c[1] += (mid[1] - c[1]) * f
        c[2] += (mid[2] - c[2]) * f
      }
      if (moss > 0 && mt) {
        const upness = up === 'z' ? nz : clamp(-ny * 1.6 + 0.2, 0, 1)
        const mn = fbm(ox * 0.3 + (x / dpr) * nf * 0.7, oy * 0.3 + (y / dpr) * nf * 0.7, 3)
        const mm = sm(0.46, 0.66, mn * 0.75 + upness * 0.5 - (1 - moss) * 0.62) * (1 - sm(0.8, 0.96, d)) * 0.9
        if (mm > 0) {
          tone(clamp(t + 0.1, 0, 1), m3, mt[0], mt[0], mt[1], mt[2])
          c[0] += (m3[0] - c[0]) * mm
          c[1] += (m3[1] - c[1]) * mm
          c[2] += (m3[2] - c[2]) * mm
        }
      }
      if (gloss > 0) {
        const rv = 2 * ndl * nz - Lz
        const sp = Math.pow(clamp(rv, 0, 1), 18) * gloss
        c[0] += (gc[0] - c[0]) * sp
        c[1] += (gc[1] - c[1]) * sp
        c[2] += (gc[2] - c[2]) * sp
      }
      if (rim && rimA > 0) {
        const side = (nx * Lx + ny * Ly) / (Math.hypot(nx, ny) * Lxy + 1e-4)
        const rf = sm(0.84, 0.97, d) * clamp(side, 0, 1) * rimA
        c[0] += (rim[0] - c[0]) * rf
        c[1] += (rim[1] - c[1]) * rf
        c[2] += (rim[2] - c[2]) * rf
      }
      // the contour: an ink edge, broken by noise, heavier on the shadow side
      const e = sm(0.9 - (1 - t) * 0.07, 1, d) * inkA * (0.55 + 0.45 * vn(ox + x * 0.2 / dpr, oy + y * 0.2 / dpr)) * (0.55 + (1 - t) * 0.6)
      c[0] += (ink[0] - c[0]) * e
      c[1] += (ink[1] - c[1]) * e
      c[2] += (ink[2] - c[2]) * e
      const gr = 1 + (NT[(y & 255) * NS + (x & 255)] - 0.5) * grain
      const j = i * 4
      px[j] = c[0] * gr
      px[j + 1] = c[1] * gr
      px[j + 2] = c[2] * gr
      px[j + 3] = clamp((1 - d) * aa * 0.9, 0, 1) * 255
    }
    if ((y & 15) === 15) yield
  }
  const out = document.createElement('canvas')
  out.width = W
  out.height = H
  out.getContext('2d')!.putImageData(img, 0, 0)
  return out
}

/** Paper grain over a painted canvas (one 128² tile for the module). */
let grainTile: HTMLCanvasElement | null = null
export function grain(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a = 0.06) {
  if (!grainTile) {
    grainTile = document.createElement('canvas')
    grainTile.width = grainTile.height = 128
    const tg = grainTile.getContext('2d')!
    const img = tg.createImageData(128, 128)
    for (let i = 0; i < 128 * 128; i++) {
      const v = (NT[i * 3 % (NS * NS)] * 0.6 + vn((i % 128) * 0.5, (i / 128) * 0.5) * 0.4) * 255
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v
      img.data[i * 4 + 3] = 255
    }
    tg.putImageData(img, 0, 0)
  }
  const pat = g.createPattern(grainTile, 'repeat')
  if (!pat) return
  g.save()
  g.globalAlpha = a
  g.globalCompositeOperation = 'overlay'
  g.fillStyle = pat
  g.fillRect(x, y, w, h)
  g.restore()
}

/** Melt a painted canvas into the paper at its edges (baked once: no CSS mask to recomposite every frame). Shares of w / h. */
export function fadeEdges(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, l: number, r: number, t: number, b: number) {
  g.save()
  g.globalCompositeOperation = 'destination-in'
  const hg = g.createLinearGradient(x, 0, x + w, 0)
  hg.addColorStop(0, '#0000')
  hg.addColorStop(Math.max(0.001, l), '#000')
  hg.addColorStop(Math.min(0.999, 1 - r), '#000')
  hg.addColorStop(1, '#0000')
  g.fillStyle = hg
  g.fillRect(x, y, w, h)
  const vg = g.createLinearGradient(0, y, 0, y + h)
  vg.addColorStop(0, '#0000')
  vg.addColorStop(Math.max(0.001, t), '#000')
  vg.addColorStop(Math.min(0.999, 1 - b), '#000')
  vg.addColorStop(1, '#0000')
  g.fillStyle = vg
  g.fillRect(x, y, w, h)
  g.restore()
}

/** A soft shadow (or glow) without a blur filter: an elliptical radial gradient, opaque at the centre. */
export function softEllipse(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, c: RGB, a: number, rot = 0) {
  g.save()
  g.translate(x, y)
  g.rotate(rot)
  g.scale(1, ry / rx)
  const rg = g.createRadialGradient(0, 0, 0, 0, 0, rx)
  rg.addColorStop(0, rgba(c, a))
  rg.addColorStop(0.55, rgba(c, a * 0.75))
  rg.addColorStop(1, rgba(c, 0))
  g.fillStyle = rg
  g.beginPath()
  g.arc(0, 0, rx, 0, Math.PI * 2)
  g.fill()
  g.restore()
}

/** A soft band along a line (a pole's shadow): a few strokes, wider and fainter outward. */
export function softLine(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w: number, c: RGB, a: number) {
  g.save()
  g.lineCap = 'round'
  for (const [k, f] of [[2.2, 0.25], [1.5, 0.35], [0.9, 0.5]]) {
    g.strokeStyle = rgba(c, a * f)
    g.lineWidth = w * k
    g.beginPath()
    g.moveTo(x0, y0)
    g.lineTo(x1, y1)
    g.stroke()
  }
  g.restore()
}

/**
 * A soft painted field at low resolution (washes are soft anyway), stretched up: fn(x, y) in CSS px writes [r, g, b, a].
 * `step` px per sample.
 */
export function* field(w: number, h: number, step: number, fn: (x: number, y: number, out: number[]) => void): Generator<void, HTMLCanvasElement> {
  const W = Math.max(2, Math.ceil(w / step) + 1), H = Math.max(2, Math.ceil(h / step) + 1)
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const img = new ImageData(W, H)
  const out = [0, 0, 0, 0]
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      fn(x * step, y * step, out)
      const j = (y * W + x) * 4
      img.data[j] = out[0]
      img.data[j + 1] = out[1]
      img.data[j + 2] = out[2]
      img.data[j + 3] = out[3] * 255
    }
    if ((y & 7) === 7) yield
  }
  c.getContext('2d')!.putImageData(img, 0, 0)
  return c
}

/** Draw a field canvas stretched to w × h at (x, y) (smoothing on). */
export function put(g: CanvasRenderingContext2D, src: CanvasImageSource, x: number, y: number, w: number, h: number) {
  g.imageSmoothingEnabled = true
  g.imageSmoothingQuality = 'high'
  g.drawImage(src, x, y, w, h)
}

/** Place an absolutely positioned element. */
export function place(el: HTMLElement, x: number, y: number, w?: number) {
  el.style.left = `${f1(x)}px`
  el.style.top = `${f1(y)}px`
  if (w != null) el.style.width = `${f1(w)}px`
}

// ── the rig: layers at depth z (px; + toward the viewer), a camera lean (the "80°" of a top view), a tilt

export interface Rig {
  root: HTMLElement
  view: HTMLElement
  /** a layer at depth z (a number, or read at every frame): draw in world px (z = 0 is the screen at rest) */
  layer(z: number | (() => number), cls?: string): HTMLElement
  /** world (x, y, z) → screen (x, y) and the scale there */
  proj(x: number, y: number, z: number, out?: number[]): number[]
  /** the visible world rect at depth z (with a margin for tilt), [x0, y0, x1, y1] */
  span(z: number, m?: number): [number, number, number, number]
  /** scale of a layer at z */
  sc(z: number): number
  readonly W: number
  readonly H: number
  readonly cx: number
  readonly cy: number
  readonly P: number
  readonly dpr: number
  /** the page gutter the root bleeds over on each side (0 without `bleed`) */
  readonly gut: number
  pal: Pal
  tilt: { x: number; y: number }
  /** per-frame work of the scene: return true while it still moves */
  tick(fn: (dt: number, t: number) => boolean): void
  /** run the loop (an interaction began) */
  wake(): void
  /** viewer input: keeps the living motion on for `idle` s (quality high, no reduced motion) */
  touch(): void
  /** living motion allowed now */
  live(): boolean
  /** apply the layer transforms now (after moving the camera by hand) */
  apply(): void
}

export interface RigOpts {
  cls: string
  art: string
  copies: (Fact | string | undefined)[]
  /** perspective distance as a share of max(W, H) */
  persp?: number
  /** camera lean: screen-y shift per px of height (tan of the tilt from vertical / horizontal) */
  lean?: number
  /** tilt swing per px of depth at full tilt */
  swing?: number
  /** pointer parallax: 'hover' (mouse moves it), 'drag' (touch/pen drag), both by default */
  parallax?: boolean
  /** layout: the scene (re)builds for W × H; a generator run in sliced() (first time soaks in, later swaps at the end) */
  build: (rig: Rig, first: boolean) => Generator<unknown, void>
  /** called when palette changed (theme) — default: rebuild */
  idle?: number
  /** run past the page gutters to the window's edges; the top and the foot melt into the paper */
  bleed?: boolean
}

/**
 * Mount the rig: a root at the scene's stable height (no jump when the insight grows the foot), a view that fades into
 * the paper at its edges, layers moved only by transform. build() runs on every size / theme change.
 */
export function rig(ctx: SceneCtx, o: RigOpts): Rig {
  const stableH = stableHeight(ctx, o.copies)
  const view = h('div', { class: 't23-view' })
  const root = h('div', { class: `t23 ${o.cls}${o.bleed ? ' bleed' : ''}` }, h('p', { class: 'visually-hidden' }, o.art), view, o.bleed ? h('i', { class: 't23-edge', 'aria-hidden': 'true' }) : null)
  ctx.art.append(root)
  const layers: { el: HTMLElement; z: () => number }[] = []
  const ticks: ((dt: number, t: number) => boolean)[] = []
  const tilt = { x: 0, y: 0 }
  const tgt = { x: 0, y: 0 }
  let lastInput = -1e9
  let liveT = 0
  const idleMs = (o.idle ?? 10) * 1000
  const lean = o.lean ?? 0, swing = o.swing ?? 0.05
  const R = {
    root, view, tilt,
    W: 0, H: 0, cx: 0, cy: 0, P: 1000, gut: 0,
    dpr: Math.min(ctx.quality === 'low' ? 1 : 2, devicePixelRatio || 1),
    pal: readPal(),
    layer(z: number | (() => number), cls = '') {
      const el = h('div', { class: `t23-layer ${cls}` })
      layers.push({ el, z: typeof z === 'number' ? () => z : z })
      view.append(el)
      return el
    },
    sc: (z: number) => R.P / (R.P - z),
    proj(x: number, y: number, z: number, out: number[] = [0, 0, 0]) {
      const s = R.P / (R.P - z)
      out[0] = R.cx + (x - R.cx) * s + tilt.x * z * swing
      out[1] = R.cy + (y - R.cy) * s + tilt.y * z * swing - z * lean
      out[2] = s
      return out
    },
    span(z: number, m = 40): [number, number, number, number] {
      const s = R.P / (R.P - z)
      const ox = Math.abs(z * swing) + m, oy = Math.abs(z * swing) + Math.abs(z * lean) + m
      return [R.cx - (R.cx + ox) / s, R.cy - (R.cy + oy) / s, R.cx + (R.W - R.cx + ox) / s, R.cy + (R.H - R.cy + oy) / s]
    },
    tick: (fn: (dt: number, t: number) => boolean) => void ticks.push(fn),
    wake: () => loop.start(),
    touch() {
      lastInput = performance.now()
      loop.start()
      if (ctx.quality !== 'high' || ctx.reduced) return
      root.classList.add('is-live')
      clearTimeout(liveT)
      liveT = setTimeout(() => root.classList.remove('is-live'), idleMs)
    },
    live: () => ctx.quality === 'high' && !ctx.reduced && performance.now() - lastInput < idleMs,
    apply,
  } as Rig & { W: number; H: number; cx: number; cy: number; P: number; gut: number }

  function apply() {
    for (const l of layers) {
      const z = l.z()
      const s = R.P / (R.P - z)
      l.el.style.transformOrigin = `${f1(R.cx)}px ${f1(R.cy)}px`
      l.el.style.transform = `translate(${f1(tilt.x * z * swing)}px,${f1(tilt.y * z * swing - z * lean)}px) scale(${s.toFixed(4)})`
    }
  }

  const loop = createLoop(root, (t, dt) => {
    const f = dt > 0 ? 1 - Math.exp(-dt * 4.5) : 1
    tilt.x += (tgt.x - tilt.x) * f
    tilt.y += (tgt.y - tilt.y) * f
    let more = Math.abs(tgt.x - tilt.x) + Math.abs(tgt.y - tilt.y) > 0.002
    apply()
    for (const fn of ticks) more = fn(dt, t) || more
    return more
  })
  ctx.onCleanup(() => (loop.dispose(), clearTimeout(liveT)))
  if (ctx.quality === 'high' && !ctx.reduced) R.touch()

  // ── parallax: mouse hover leans the view a little; a touch drag on the background leans it more, then it springs back
  if (o.parallax !== false && !ctx.reduced) {
    let rect: DOMRect | null = null
    let drag: { id: number; x: number; y: number } | null = null
    const set = (x: number, y: number) => {
      tgt.x = clamp(x, -1, 1)
      tgt.y = clamp(y, -1, 1)
      R.touch()
    }
    const onMove = (e: PointerEvent) => {
      if (drag) {
        if (e.pointerId !== drag.id) return
        return set((e.clientX - drag.x) / (rect!.width * 0.3), (e.clientY - drag.y) / (rect!.height * 0.3))
      }
      if (e.pointerType !== 'mouse') return
      rect ??= view.getBoundingClientRect()
      set((((e.clientX - rect.left) / rect.width) * 2 - 1) * 0.55, (((e.clientY - rect.top) / rect.height) * 2 - 1) * 0.55)
    }
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || (e.target as Element).closest('button, [role="slider"], .t23-grab')) return
      rect = view.getBoundingClientRect()
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY }
    }
    const onUp = (e: PointerEvent) => {
      if (drag && e.pointerId !== drag.id) return
      drag = null
      set(0, 0)
    }
    view.addEventListener('pointerenter', () => void (rect = view.getBoundingClientRect()))
    view.addEventListener('pointermove', onMove)
    view.addEventListener('pointerdown', onDown)
    view.addEventListener('pointerup', onUp)
    view.addEventListener('pointercancel', onUp)
    view.addEventListener('pointerleave', onUp)
  }

  let job: { cancel(): void } | null = null
  let first = true
  let built = ''
  function layout() {
    const aw = ctx.art.clientWidth
    const W = o.bleed ? root.clientWidth : aw // one read: the root's width is set by CSS alone
    const H = stableH(ctx.art.clientHeight)
    if (W < 40 || H < 40) return
    const key = `${W}x${H}|${R.pal.key}`
    if (key === built) return
    built = key
    root.style.height = `${f1(H)}px`
    Object.assign(R, { W, H, cx: W / 2, cy: H / 2, P: Math.max(W, H) * (o.persp ?? 1.6), gut: Math.max(0, (W - aw) / 2) })
    job?.cancel()
    const run = o.build(R, first)
    job = sliced(
      (function* () {
        yield* run
        apply()
      })(),
      { sync: ctx.reduced },
    )
    first = false
  }
  ctx.onCleanup(() => job?.cancel())
  ctx.onCleanup(onSize(ctx.art, layout))
  ctx.onCleanup(
    onPrefs(() => {
      const p = readPal()
      if (p.key === R.pal.key) return
      R.pal = p
      built = ''
      layout()
    }),
  )
  return R
}

/** Swap a layer's content in one go (after a bake): old children out, new in. */
export function swap(el: Element, ...kids: (Node | null | undefined | false)[]) {
  el.replaceChildren(...(kids.filter(Boolean) as Node[]))
}

/** A layer canvas covering the visible world at depth z: returns the canvas (positioned) and a context in world px. */
export function sheet(R: Rig, z: number, m = 40, dprMul = 1, only?: [number, number, number, number]) {
  const sp = R.span(z, m)
  // only: the world rect actually painted (a pond, a pole) — no need to carry the whole view as a texture
  const [x0, y0, x1, y1] = only ? [Math.max(sp[0], only[0]), Math.max(sp[1], only[1]), Math.min(sp[2], only[2]), Math.min(sp[3], only[3])] : sp
  const s = R.sc(z)
  const d = R.dpr * s * dprMul
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round((x1 - x0) * d))
  c.height = Math.max(1, Math.round((y1 - y0) * d))
  Object.assign(c.style, { position: 'absolute', left: `${f1(x0)}px`, top: `${f1(y0)}px`, width: `${f1(x1 - x0)}px`, height: `${f1(y1 - y0)}px` })
  const g = c.getContext('2d')!
  g.setTransform(d, 0, 0, d, -x0 * d, -y0 * d)
  return { c, g, x0, y0, x1, y1, d }
}
