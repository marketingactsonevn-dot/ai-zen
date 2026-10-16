import './g39.css'
import { nextId, s } from '../../core/dom'
import { cssVar } from '../../core/prefs'
import { createLoop } from '../../core/loop'
import { blob, curve, p2Defs, rng, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'

/**
 * Garden 13 at sunrise (station 39): brush pieces the kit (ui/part2/paint.ts) does not have — a thin moon, the dawn glow,
 * the rising sun, moss, maple leaves, raked rings — plus the shared bits of the t39 scenes (token colours for canvases, a
 * paper-grain tile, a pointer/gyro parallax). Copied from the garden's t37/sumi.ts so this station owns its pieces.
 * Static SVG, colours are tokens (g39.css); animate parent <g>s only.
 */

export const f1 = (n: number) => (Math.round(n * 10) / 10).toString()
export const f2 = (n: number) => (Math.round(n * 100) / 100).toString()
export const D2R = Math.PI / 180
const P = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`
export const polyD = (pts: Pt[]) => `M${pts.map(P).join('L')}`

/** Gradients of this station (dawn, sun, lamp, fog), once per page in the p2 defs. Stops read tokens: no JS on theme change. */
export function g39Defs() {
  p2Defs()
  if (document.getElementById('g39-defs')) return
  const stop = (o: number, c: string, a: number | string = 1) => s('stop', { offset: o, style: `stop-color:var(${c});stop-opacity:${a}` })
  document.getElementById('p2-defs')!.append(s('defs', { id: 'g39-defs' },
    s('radialGradient', { id: 'g39-dawn' }, stop(0, '--dawn'), stop(0.55, '--dawn', 0.55), stop(1, '--dawn', 0)),
    s('radialGradient', { id: 'g39-sun' }, stop(0, '--lantern', 0.7), stop(0.25, '--lantern', 0.3), stop(0.6, '--lantern', 0.08), stop(1, '--lantern', 0)),
    s('radialGradient', { id: 'g39-lamp' }, stop(0, '--lantern', 0.6), stop(0.42, '--lantern', 0.18), stop(1, '--lantern', 0)),
    s('radialGradient', { id: 'g39-fog' }, stop(0, '--mist', 'var(--mist-a)'), stop(0.65, '--mist', 'calc(var(--mist-a) * 0.5)'), stop(1, '--mist', 0)),
    s('radialGradient', { id: 'g39-topstone', cx: 0.42, cy: 0.3, r: 0.75 }, stop(0, '--rock-hi'), stop(0.55, '--rock-mid'), stop(1, '--rock-lo')),
    s('radialGradient', { id: 'g39-ao' }, stop(0, '--umbra', 0.5), stop(0.6, '--umbra', 0.2), stop(1, '--umbra', 0)),
    s('linearGradient', { id: 'g39-sky', x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, '--paper', 1), stop(0.55, '--paper', 1), stop(1, '--mist', 'var(--mist-a)')),
    s('linearGradient', { id: 'g39-dawnv', x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, '--dawn', 0), stop(0.6, '--dawn', 0.5), stop(1, '--dawn', 1)),
    s('linearGradient', { id: 'g39-wood', x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, '--step-hi'), stop(0.5, '--step-mid'), stop(1, '--step-lo')),
    s('radialGradient', { id: 'g39-cast' }, stop(0, '--umbra', 0.34), stop(0.5, '--umbra', 0.14), stop(1, '--umbra', 0)),
    s('radialGradient', { id: 'g39-lidshade', cx: 0.78, cy: 0.42, r: 0.9 }, stop(0, '--paper', 0.28), stop(0.45, '--paper', 0), stop(0.75, '--umbra', 0.12), stop(1, '--umbra', 0.4)),
    s('linearGradient', { id: 'g39-topface', x1: 0.3, y1: 0, x2: 0.5, y2: 1 }, stop(0, '--rock-hi'), stop(0.7, '--rock-mid'), stop(1, '--rock-mid', 0.6)),
    // a stone's side wall under a low sun on the right: shade on the left, warm stone on the lit side
    s('linearGradient', { id: 'g39-wall', x1: 0, y1: 0, x2: 1, y2: 0 }, stop(0, '--umbra', 0.9), stop(0.35, '--rock-lo'), stop(0.8, '--rock-mid'), stop(1, '--rock-hi')),
    // a stone lantern's granite: shade on the left, the dawn warm on its right edge
    s('linearGradient', { id: 'g39-lampstone', x1: 0, y1: 0, x2: 1, y2: 0 }, stop(0, '--t39-granite-lo'), stop(0.55, '--t39-granite'), stop(1, '--t39-granite-hi')),
    // a shadow running toward the viewer, fading as it comes
    s('linearGradient', { id: 'g39-shadowv', x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, '--umbra', 0.42), stop(0.35, '--umbra', 0.2), stop(1, '--umbra', 0)),
    s('filter', { id: 'g39-glow', x: '-20%', y: '-60%', width: '140%', height: '220%' }, s('feGaussianBlur', { stdDeviation: 3 })),
    // a lotus leaf cupped round its stem: deeper green in the cup, paler toward the rim
    s('radialGradient', { id: 'g39-lotus', cx: 0.5, cy: 0.5, r: 0.5 }, stop(0, '--moss-b'), stop(0.45, '--moss-a'), stop(0.92, '--moss-c'), stop(1, '--moss-a'))))
}

/** Several short brushed lines [x0, y0, x1, y1] as one path d. */
export const lines = (ls: number[][], w: number, a = 0.15, b = 0.15) => ls.map(([x0, y0, x1, y1]) => stroke([[x0, y0], [x1, y1]], w, a, b, 0.4)).join('')

/** A thin moon fading into the day: the lit limb, the ashen rest of the disc, a small halo. tilt° turns the limb. */
export function crescent(cx: number, cy: number, r: number, thin = 0.68, tilt = -20): SVGGElement {
  g39Defs()
  const d = `M0 ${f1(-r)}A${f1(r)} ${f1(r)} 0 0 0 0 ${f1(r)}A${f1(r * thin)} ${f1(r)} 0 0 1 0 ${f1(-r)}Z`
  return s('g', { class: 'g39-crescent', transform: `translate(${f1(cx)} ${f1(cy)}) rotate(${tilt})` },
    s('circle', { r: f1(r * 3), fill: 'url(#p2-halo)', class: 'g39-crescent-halo' }),
    s('circle', { r: f1(r), class: 'g39-crescent-ash' }),
    s('path', { d, class: 'g39-crescent-lit' }))
}

/** The first light: a warm glow (layers of the --dawn token) rising behind (cx, cy). */
export function dawnGlow(cx: number, cy: number, rx: number, ry: number, layers = 2): SVGGElement {
  g39Defs()
  return s('g', { class: 'g39-dawn' },
    ...Array.from({ length: layers }, (_, i) => s('ellipse', { cx: f1(cx), cy: f1(cy), rx: f1(rx * (1 - i * 0.35)), ry: f1(ry * (1 - i * 0.3)), fill: 'url(#g39-dawn)' })))
}

/** Mist that reads in both themes (paper-white by day, a faint blue veil by night). */
export const fog = (cx: number, cy: number, rx: number, ry: number, cls = 'g39-fog') =>
  (g39Defs(), s('ellipse', { class: cls, cx: f1(cx), cy: f1(cy), rx: f1(rx), ry: f1(ry), fill: 'url(#g39-fog)' }))

/** The sun just clearing the horizon at (cx, cy), radius r: a wide glow, a flare along the horizon, the disc. */
export function sun(cx: number, cy: number, r: number): SVGGElement {
  g39Defs()
  return s('g', { class: 'g39-sun' },
    s('circle', { cx: f1(cx), cy: f1(cy), r: f1(r * 7), fill: 'url(#g39-sun)', class: 'g39-sun-glow' }),
    s('ellipse', { cx: f1(cx), cy: f1(cy + r * 0.6), rx: f1(r * 16), ry: f1(r * 1.1), fill: 'url(#g39-sun)', class: 'g39-sun-flare' }),
    s('circle', { cx: f1(cx), cy: f1(cy), r: f1(r), class: 'g39-sun-disc' }))
}

/**
 * The dawn sky over a horizon at hz (w × h): paper sky warming to the horizon, the sun rising at sunX, the last thin moon
 * up on the left, two ranges of far hills melting into a mist band. Returns the pieces back to front.
 */
export function dawnSky(w: number, h: number, hz: number, sunX: number, seed: number, o: { moon?: Pt; sunR?: number; hillH?: number; sunY?: number } = {}): SVGElement[] {
  g39Defs()
  const sr = o.sunR ?? Math.max(10, Math.min(30, h * 0.04))
  const hh = o.hillH ?? Math.min(h * 0.16, 130)
  const [mx, my] = o.moon ?? [w * 0.14, Math.max(26, hz * 0.22)]
  return [
    s('rect', { class: 'g39-skyfill', x: -2, y: -2, width: f1(w + 4), height: f1(hz + 4), fill: 'url(#g39-sky)' }),
    s('rect', { class: 'g39-skydawn', x: -2, y: f1(hz * 0.2), width: f1(w + 4), height: f1(hz * 0.8 + 2), fill: 'url(#g39-dawnv)' }),
    dawnGlow(sunX, hz, w * 0.42, hz * 0.7, 3),
    crescent(mx, my, Math.max(7, Math.min(16, h * 0.022)), 0.62, 160),
    sun(sunX, o.sunY ?? hz - sr * 0.15, sr),
    hills(-w * 0.04, w * 1.04, hz + 2, hh, seed, 0.94, 7),
    fog(w * 0.5, hz - hh * 0.2, w * 0.7, hh * 0.5),
    hills(-w * 0.06, w * 0.46, hz + 3, hh * 0.62, seed + 1, 0.72, 3),
    hills(w * 0.62, w * 1.06, hz + 3, hh * 0.5, seed + 2, 0.76, 2),
    mist(w * 0.5, hz + 2, w * 0.7, Math.max(10, hh * 0.18)),
  ]
}

/** A bed of moss: a soft green wash, a darker heart, a scatter of dabs at its edge. */
export function mossBed(x: number, y: number, rx: number, ry: number, seed: number): SVGGElement {
  const r = rng(seed)
  let dots = ''
  for (let i = 0; i < Math.round(rx / 2.2); i++) {
    const a = r() * Math.PI * 2, k = 0.55 + r() * 0.6
    dots += blob(x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k, 0.7 + r() * 1.3, 0.5 + r() * 0.7, seed + i, 0.2, 8)
  }
  return s('g', { class: 'g39-mossbed' },
    s('path', { class: 'g39-moss g39-moss-a', d: blob(x, y, rx, ry, seed, 0.25), filter: 'url(#ink-wash)' }),
    s('path', { class: 'g39-moss g39-moss-b', d: blob(x - rx * 0.1, y + ry * 0.1, rx * 0.55, ry * 0.6, seed + 1, 0.3), filter: 'url(#ink-wash)' }),
    s('path', { class: 'g39-moss-dot', d: dots }))
}

/** A maple leaf as one ink dab: five lobes brushed from the stalk (pointed tips), turned a°. d only. */
export function leafD(x: number, y: number, r: number, a: number): string {
  const lobes = [[-90, 1], [-38, 0.86], [-142, 0.86], [8, 0.52], [172, 0.52]]
  let d = ''
  for (const [deg, k] of lobes) {
    const t = ((deg + a) * Math.PI) / 180
    const L = r * k
    d += stroke([[x, y], [x + Math.cos(t) * L * 0.45, y + Math.sin(t) * L * 0.45], [x + Math.cos(t) * L, y + Math.sin(t) * L]], r * 0.7 * k + 0.4, 0, 0.7, 0.1)
  }
  const t = ((90 + a) * Math.PI) / 180
  return d + stroke([[x, y], [x + Math.cos(t) * r * 0.55, y + Math.sin(t) * r * 0.55]], r * 0.12 + 0.3, 0, 0.3, 0.4)
}

/** Rings of raked sand round (cx, cy) (radius rx0…rx1, flattened by k), each a few passes with dry gaps. d only. */
export function rakeRings(cx: number, cy: number, rx0: number, rx1: number, gap: number, k: number, seed: number, w = 1.2): string {
  const r = rng(seed)
  let d = ''
  for (let R = rx0; R <= rx1; R += gap) {
    let a = r() * 60
    while (a < 360 + 10) {
      const len = 40 + r() * 100
      const a1 = Math.min(a + len, a + 352)
      const pts: Pt[] = Array.from({ length: 13 }, (_, i) => {
        const t = ((a + ((a1 - a) * i) / 12) * Math.PI) / 180
        return [cx + Math.cos(t) * R, cy + Math.sin(t) * R * k]
      })
      d += stroke(pts, w * (0.8 + r() * 0.5), 0.15, 0.15, 0.1)
      a = a1 + 6 + r() * 22
    }
  }
  return d
}

/** A brushed rim along a curve (moonlit / sunlit edge), d only. */
export const rim = (a: Pt, c: Pt, b: Pt, w: number) => stroke(curve(a, c, b, 12), w, 0.3, 0.3, 0.1)

/** A clip-path id wrapper: returns [id, the <clipPath>]. */
export function clip(d: string): [string, SVGClipPathElement] {
  const id = nextId('g39c')
  return [id, s('clipPath', { id }, s('path', { d }))]
}

/** The tokens a canvas paints with, read once (mount, onPrefs). */
export type Tok = Record<'paper' | 'paper2' | 'ink' | 'wash' | 'umbra' | 'rake' | 'rakeHi' | 'dawn' | 'lantern' | 'moon' | 'mist' | 'water' | 'rockHi' | 'rockMid' | 'rockLo' | 'mossA' | 'mossB' | 'mossC' | 'stepHi' | 'stepMid' | 'stepLo' | 'vermilion', string>
const TOK: [keyof Tok, string][] = [['paper', '--paper'], ['paper2', '--paper-2'], ['ink', '--ink'], ['wash', '--wash'], ['umbra', '--umbra'], ['rake', '--rake'], ['rakeHi', '--rake-hi'], ['dawn', '--dawn'], ['lantern', '--lantern'], ['moon', '--moon'], ['mist', '--mist'], ['water', '--water'], ['rockHi', '--rock-hi'], ['rockMid', '--rock-mid'], ['rockLo', '--rock-lo'], ['mossA', '--moss-a'], ['mossB', '--moss-b'], ['mossC', '--moss-c'], ['stepHi', '--step-hi'], ['stepMid', '--step-mid'], ['stepLo', '--step-lo'], ['vermilion', '--vermilion']]
export function readTok(): Tok {
  const cs = getComputedStyle(document.documentElement)
  const t = {} as Tok
  for (const [k, v] of TOK) t[k] = cs.getPropertyValue(v).trim()
  return t
}
/** A token colour (#rgb, #rrggbb, rgb(), rgba()) at alpha a (multiplied with its own), for canvas gradients. */
export function rgba(c: string, a: number): string {
  let r = 0, g = 0, b = 0, k = 1
  const m = c.match(/rgba?\(([^)]+)\)/)
  if (m) {
    const v = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number)
    ;[r, g, b] = v
    k = v[3] ?? 1
  } else if (c[0] === '#') {
    const x = c.length === 4 ? c.slice(1).split('').map((ch) => ch + ch).join('') : c.slice(1, 7)
    r = parseInt(x.slice(0, 2), 16)
    g = parseInt(x.slice(2, 4), 16)
    b = parseInt(x.slice(4, 6), 16)
  }
  return `rgba(${r},${g},${b},${(k * a).toFixed(3)})`
}
export const dark = () => document.documentElement.dataset.theme === 'dark'
export { cssVar }

/** A 128² paper/sand grain tile, built once per page (module scope). */
let grainTile: HTMLCanvasElement | null = null
export function grain(): HTMLCanvasElement {
  if (grainTile) return grainTile
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const img = g.createImageData(128, 128)
  const r = rng(3939)
  for (let i = 0; i < 128 * 128; i++) {
    const v = r()
    const k = v < 0.5 ? 0 : 255
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = k
    img.data[i * 4 + 3] = Math.round(Math.abs(v - 0.5) * 2 * 255 * (r() < 0.35 ? 1 : 0.3))
  }
  g.putImageData(img, 0, 0)
  grainTile = c
  return c
}

/**
 * Pointer / tilt parallax for a 2.5D scene: calls apply(x, y) (each -1…1, eased) from one createLoop that runs only
 * while the view settles. Off at quality=low and under reduced motion (the scene stays at 0, 0).
 */
export function parallax(ctx: SceneCtx, host: HTMLElement, apply: (x: number, y: number) => void, gyro = true) {
  if (ctx.reduced || ctx.quality === 'low') return { set() {}, kick() {} }
  let tx = 0, ty = 0, x = 0, y = 0
  let W = 1, H = 1, L = 0, T = 0
  const ro = new ResizeObserver(() => {
    const r = host.getBoundingClientRect()
    W = r.width || 1
    H = r.height || 1
    L = r.left
    T = r.top
  })
  ro.observe(host)
  const loop = createLoop(host, (_t, dt) => {
    const k = 1 - Math.exp(-(dt || 0.016) * 4)
    x += (tx - x) * k
    y += (ty - y) * k
    apply(x, y)
    return Math.abs(tx - x) + Math.abs(ty - y) > 0.002
  })
  const set = (nx: number, ny: number) => {
    tx = Math.max(-1, Math.min(1, nx))
    ty = Math.max(-1, Math.min(1, ny))
    loop.start()
  }
  const move = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    set(((e.clientX - L) / W) * 2 - 1, ((e.clientY - T) / H) * 2 - 1)
  }
  const scroll = () => {
    const r = host.getBoundingClientRect()
    L = r.left
    T = r.top
  }
  const tilt = (e: DeviceOrientationEvent) => {
    if (e.gamma == null || e.beta == null) return
    set(e.gamma / 25, (e.beta - 45) / 30)
  }
  host.addEventListener('pointermove', move)
  window.addEventListener('scroll', scroll, { passive: true })
  if (gyro) window.addEventListener('deviceorientation', tilt)
  ctx.onCleanup(() => {
    ro.disconnect()
    loop.dispose()
    host.removeEventListener('pointermove', move)
    window.removeEventListener('scroll', scroll)
    window.removeEventListener('deviceorientation', tilt)
  })
  return { set, kick: () => loop.start() }
}

/**
 * Living motion (koi, drifting mist) runs as CSS animation only at quality=high; this marks the scene root `.is-idle`
 * after `secs` without input (CSS pauses the animation there) and clears it on the next pointer / key / wheel.
 */
export function idle(ctx: SceneCtx, root: HTMLElement, secs = 10) {
  if (ctx.reduced || ctx.quality === 'low') return root.classList.add('is-idle')
  let t = 0
  const wake = () => {
    root.classList.remove('is-idle')
    clearTimeout(t)
    t = window.setTimeout(() => root.classList.add('is-idle'), secs * 1000)
  }
  wake()
  const evs = ['pointermove', 'pointerdown', 'keydown', 'wheel'] as const
  for (const e of evs) addEventListener(e, wake, { passive: true })
  ctx.onCleanup(() => {
    clearTimeout(t)
    for (const e of evs) removeEventListener(e, wake)
  })
}

/** A smooth closed path through pts (midpoint quadratic curves). */
export function smoothD(pts: Pt[]): string {
  const n = pts.length
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  let d = `M${P(mid(pts[n - 1], pts[0]))}`
  for (let i = 0; i < n; i++) d += `Q${P(pts[i])} ${P(mid(pts[i], pts[(i + 1) % n]))}`
  return d + 'Z'
}
