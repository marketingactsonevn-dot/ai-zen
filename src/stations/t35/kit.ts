import './kit.css'
import { s } from '../../core/dom'
import { createLoop } from '../../core/loop'
import type { Fact } from '../../core/content'
import { blob, clamp, curve, p2Defs, rng, stroke, type Pt } from '../../ui/part2/ink'
import { paperLantern } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'

/**
 * Station 35's own painting kit (garden 12, "workshop under the moon"): brushed wood, pebbles, roofs, ferns, lantern tones
 * and a pointer drift for layered scenes. Copied from t34/night.ts (another station's file) so this station stands alone.
 * Static SVG; colours are tokens (kit.css).
 */
export const F = (x: unknown) => x as Fact
export const f1 = (n: number) => (Math.round(n * 10) / 10).toString()
export const P = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`
type Filt = 'rough' | 'wash' | 'dry'

/** One painted path: class + (optional) one of the page's ink filters. */
export const ink = (d: string, cls: string, filter?: Filt, style?: string) =>
  s('path', { class: cls, d, filter: filter ? `url(#ink-${filter})` : null, style: style ?? null })

/** Gradients the station paints with (added to the page's p2 defs once). Stops read tokens: no JS on theme change. */
export function gdefs() {
  p2Defs()
  if (document.getElementById('t35k-defs')) return
  const stop = (o: number, c: string, a: number | string = 1) => s('stop', { offset: o, style: `stop-color:var(${c});stop-opacity:${a}` })
  document.getElementById('p2-defs')!.append(s('defs', { id: 't35k-defs' },
    s('radialGradient', { id: 't35k-pool' }, stop(0, '--lantern', 0.5), stop(0.45, '--lantern', 0.16), stop(1, '--lantern', 0)),
    s('radialGradient', { id: 't35k-moonpool' }, stop(0, '--moon', 0.42), stop(0.5, '--moon', 0.12), stop(1, '--moon', 0)),
    s('linearGradient', { id: 't35k-beam', x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, '--moon', 0.42), stop(1, '--moon', 0.03)),
    // cut stone and boulders read their tones from --t35-* (kit.css sets them per theme: the dawn stone needs more body)
    s('linearGradient', { id: 't35k-slab', x1: 0, y1: 0, x2: 0.12, y2: 1 }, stop(0, '--t35-s1'), stop(0.55, '--t35-s2'), stop(1, '--t35-s3')),
    s('linearGradient', { id: 't35k-tread', x1: 0, y1: 1, x2: 0, y2: 0 }, stop(0, '--t35-s1'), stop(1, '--t35-s2')),
    s('linearGradient', { id: 't35k-rock', x1: 0, y1: 0, x2: 0.3, y2: 1 }, stop(0, '--t35-b1'), stop(0.55, '--t35-b2'), stop(1, '--t35-b3')),
    s('linearGradient', { id: 't35k-bank', x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, '--rock-mid'), stop(1, '--rock-lo')),
    s('linearGradient', { id: 't35k-moss', x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, '--moss-b'), stop(1, '--moss-a')),
    s('linearGradient', { id: 't35k-wall', x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, '--wash', 0.9), stop(1, '--wash', 0.6)),
    // the turn of a rolled cylinder: shade, a lit band, shade
    s('linearGradient', { id: 't35k-cyl', x1: 0, y1: 0, x2: 1, y2: 0 }, stop(0, '--umbra', 0.55), stop(0.3, '--umbra', 0.05), stop(0.42, '--moon', 0.18), stop(0.6, '--umbra', 0.08), stop(1, '--umbra', 0.6)),
    s('radialGradient', { id: 't35k-cool', cx: 0.42, cy: 0.4, r: 0.66 }, stop(0, '--moon'), stop(0.55, '--mist', 0.9), stop(1, '--mist', 0.7)),
    s('radialGradient', { id: 't35k-seal', cx: 0.42, cy: 0.4, r: 0.66 }, stop(0, '--lantern'), stop(0.6, '--vermilion'), stop(1, '--vermilion', 0.85)),
    // feathered masks: things fade out softly toward their edges
    s('radialGradient', { id: 't35k-feather' }, s('stop', { offset: 0.55, 'stop-color': '#fff' }), s('stop', { offset: 1, 'stop-color': '#000' })),
    s('linearGradient', { id: 't35k-fadex', x1: 0, y1: 0, x2: 1, y2: 0 },
      s('stop', { offset: 0, 'stop-color': '#000' }), s('stop', { offset: 0.22, 'stop-color': '#fff' }), s('stop', { offset: 0.78, 'stop-color': '#fff' }), s('stop', { offset: 1, 'stop-color': '#000' })),
    s('mask', { id: 't35k-fade', maskContentUnits: 'objectBoundingBox' }, s('rect', { width: 1, height: 1, fill: 'url(#t35k-fadex)' }))))
}

/** A roof seen from the front over x0…x1: the eave line at y curling up at both ends, `tall` of sloped roof above it. */
export function roof(x0: number, x1: number, y: number, u: number, tall = 0): string {
  const m = (x0 + x1) / 2
  let d = `M${P([x0 - 16 * u, y - 3 * u])}Q${P([x0 - 6 * u, y + 3 * u])} ${P([x0 + 8 * u, y + 2 * u])}Q${P([m, y - 4 * u])} ${P([x1 - 8 * u, y + 2 * u])}Q${P([x1 + 6 * u, y + 3 * u])} ${P([x1 + 16 * u, y - 3 * u])}` +
    `L${P([x1 + 10 * u, y + 6 * u])}Q${P([m, y + 4 * u])} ${P([x0 - 10 * u, y + 6 * u])}Z`
  if (tall) d += `M${P([x0 - 4 * u, y - 1 * u])}Q${P([x0 + (x1 - x0) * 0.12, y - tall * 0.5])} ${P([x0 + (x1 - x0) * 0.22, y - tall])}L${P([x1 - (x1 - x0) * 0.22, y - tall])}Q${P([x1 - (x1 - x0) * 0.12, y - tall * 0.5])} ${P([x1 + 4 * u, y - 1 * u])}Z`
  return d
}

/** A paper lantern; `cool` swaps its warm body for a moon-and-mist one (a lamp far off in the cold). */
export function lantern(x: number, y: number, r: number, seed: number, cord: number, cool = false): SVGGElement {
  gdefs()
  const g = paperLantern(x, y, r, seed, cord)
  if (cool) g.querySelector('.p2p-lamp-body')!.setAttribute('fill', 'url(#t35k-cool)')
  return g
}

/** A board, post or beam from a to b, t thick: a near-even face, two grain strokes, an ink edge, a moonlit rim. */
export type Wood = { face: string; grain: string; edge: string; rim: string }
export function wood(a: Pt, b: Pt, t: number, seed: number, bow = 0): Wood {
  const r = rng(seed)
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
  const nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len
  const mid: Pt = [(a[0] + b[0]) / 2 + nx * bow, (a[1] + b[1]) / 2 + ny * bow]
  const line = (o: number, k0 = 0, k1 = 1) => curve(a, mid, b, 12).slice(Math.round(k0 * 12), Math.round(k1 * 12) + 1).map(([x, y]) => [x + nx * o, y + ny * o] as Pt)
  let grain = ''
  for (let i = 0; i < 2; i++) {
    const k0 = r() * 0.4, k1 = k0 + 0.3 + r() * 0.3
    grain += stroke(line((r() - 0.5) * t * 0.5, k0, Math.min(1, k1)), Math.max(0.6, t * 0.07), 0.3, 0.3, 0.1)
  }
  return {
    face: stroke(line(0), t, 0.015, 0.015, 0.9),
    grain,
    edge: stroke(line(t * 0.42, 0.02, 0.98), Math.max(0.8, t * 0.16), 0.1, 0.15, 0.3),
    rim: stroke(line(-t * 0.4, 0.05 + r() * 0.1, 0.6 + r() * 0.3), Math.max(0.6, t * 0.1), 0.3, 0.3, 0.1),
  }
}
export function woodG(parts: Wood[], cls = ''): SVGGElement {
  const j = (k: keyof Wood) => parts.map((p) => p[k]).join('')
  return s('g', { class: `t35k-wood ${cls}` },
    ink(j('face'), 't35k-wood-face', 'rough'), ink(j('grain'), 't35k-wood-grain', 'dry'), ink(j('edge'), 't35k-wood-edge', 'rough'), ink(j('rim'), 't35k-rim'))
}

/** A small stone lying at (x, y): contact shadow, rock wash, an ink underside and a moonlit crown. */
export function pebble(x: number, y: number, rx: number, seed: number, ry = rx * 0.62): SVGGElement {
  const d = blob(x, y - ry * 0.5, rx, ry, seed, 0.12, 14)
  return s('g', { class: 't35k-pebble' },
    s('ellipse', { class: 't35k-contact', cx: f1(x + rx * 0.1), cy: f1(y), rx: f1(rx * 1.1), ry: f1(Math.max(1.5, ry * 0.35)) }),
    s('path', { d, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
    s('path', { d, fill: 'url(#p2-shade)' }),
    ink(stroke(curve([x - rx * 0.9, y - ry * 0.3], [x, y + ry * 0.35], [x + rx * 0.95, y - ry * 0.4], 8), Math.max(1, rx * 0.12), 0.2, 0.2, 0.2), 't35k-edge', 'rough'),
    ink(stroke(curve([x - rx * 0.6, y - ry * 0.95], [x - rx * 0.1, y - ry * 1.38], [x + rx * 0.45, y - ry * 1.05], 6), Math.max(0.8, rx * 0.12), 0.3, 0.3, 0.1), 't35k-rim'))
}

/** A fern frond from (x, y) arching `len` toward angle a (radians, 0 = right, -π/2 = up): rachis + paired leaflets. Path data. */
export function fern(x: number, y: number, len: number, a: number, seed: number, bend = 0.5): string {
  const r = rng(seed)
  const end: Pt = [x + Math.cos(a) * len, y + Math.sin(a) * len]
  // the frond droops: control point lifted along the start direction, the tip falls toward gravity
  const c: Pt = [x + Math.cos(a) * len * 0.55, y + Math.sin(a) * len * 0.55 - len * bend * 0.35]
  const spine = curve([x, y], c, [end[0], end[1] + len * bend * 0.25], 22)
  let d = stroke(spine, Math.max(1.2, len * 0.012), 0.05, 0.6, 0.15)
  for (let i = 2; i < spine.length - 1; i++) {
    const t = i / (spine.length - 1)
    const [px, py] = spine[i]
    const [qx, qy] = spine[i + 1]
    const dir = Math.atan2(qy - py, qx - px)
    const L = len * 0.2 * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (0.85 + r() * 0.3)
    for (const side of [-1, 1]) {
      const b = dir + side * (1.0 + r() * 0.2) + 0.25
      const tip: Pt = [px + Math.cos(b) * L, py + Math.sin(b) * L + L * 0.25]
      const mid: Pt = [px + Math.cos(b) * L * 0.5, py + Math.sin(b) * L * 0.5 - L * 0.08]
      d += stroke(curve([px, py], mid, tip, 6), Math.max(1.4, L * 0.24), 0.08, 0.7, 0.2)
    }
  }
  return d
}

/** A cut-stone face w × h at (x, y) (top-left): a slightly irregular slab outline. */
export function slab(x: number, y: number, w: number, h: number, seed: number, j = 0.012): string {
  const r = rng(seed)
  const q = () => (r() - 0.5) * Math.min(w, h) * j * 4
  const k = Math.min(w, h) * 0.06
  return `M${P([x + k, y + q()])}L${P([x + w * 0.5, y + q()])}L${P([x + w - k, y + q()])}Q${P([x + w, y])} ${P([x + w + q(), y + k])}` +
    `L${P([x + w + q(), y + h - k])}Q${P([x + w, y + h])} ${P([x + w - k, y + h + q()])}L${P([x + k, y + h + q()])}Q${P([x, y + h])} ${P([x + q(), y + h - k])}` +
    `L${P([x + q(), y + k])}Q${P([x, y])} ${P([x + k, y + q()])}Z`
}

/**
 * Pointer drift for a layered scene: each element shifts by k px per unit of pointer offset (-1…1), eased in one
 * createLoop that runs only while it settles. Off under reduced motion and at quality=low. Returns set(x, y) to steer it.
 */
export function drift(ctx: SceneCtx, host: HTMLElement, layers: [HTMLElement | SVGElement, number, number?][]) {
  const tgt = { x: 0, y: 0 }, cur = { x: 0, y: 0 }
  const off = ctx.reduced || ctx.quality === 'low'
  const apply = () => {
    for (const [el, k, ky] of layers) el.style.transform = `translate3d(${(cur.x * k).toFixed(2)}px, ${(cur.y * (ky ?? k * 0.5)).toFixed(2)}px, 0)`
  }
  const loop = createLoop(host, (_t, dt) => {
    const f = dt > 0 ? 1 - Math.exp(-dt * 4) : 1
    cur.x += (tgt.x - cur.x) * f
    cur.y += (tgt.y - cur.y) * f
    apply()
    return Math.abs(tgt.x - cur.x) + Math.abs(tgt.y - cur.y) > 0.002
  })
  let rect: DOMRect | null = null
  const set = (x: number, y: number) => {
    if (off) return
    tgt.x = clamp(x, -1, 1)
    tgt.y = clamp(y, -1, 1)
    loop.start()
  }
  const enter = () => void (rect = host.getBoundingClientRect())
  const move = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    rect ??= host.getBoundingClientRect()
    set(((e.clientX - rect.left) / rect.width) * 2 - 1, ((e.clientY - rect.top) / rect.height) * 2 - 1)
  }
  const leave = () => set(0, 0)
  if (!off) {
    host.addEventListener('pointerenter', enter)
    host.addEventListener('pointermove', move)
    host.addEventListener('pointerleave', leave)
  }
  ctx.onCleanup(() => {
    loop.dispose()
    host.removeEventListener('pointerenter', enter)
    host.removeEventListener('pointermove', move)
    host.removeEventListener('pointerleave', leave)
  })
  return { set, resize: () => void (rect = null) }
}
