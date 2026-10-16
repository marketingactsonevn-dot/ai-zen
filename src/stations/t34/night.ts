import './night.css'
import { h, s } from '../../core/dom'
import { L, type Fact } from '../../core/content'
import { blob, clamp, curve, p2Defs, rng, stroke, type Pt } from '../../ui/part2/ink'
import { paperLantern, water } from '../../ui/part2/paint'
import { findTakeaway, takeaway } from '../../ui/part2/takeaway'
import type { SceneCtx } from '../types'

/**
 * Garden 12 (stations 34–36) painting kit on top of ui/part2/paint.ts: brushed wood (planks, posts, beams), lanterns
 * in several ink tones, pebbles, a workshop door, a hanging lamp. Static SVG, colours are tokens (night.css).
 */
export const F = (x: unknown) => x as Fact
export const f1 = (n: number) => (Math.round(n * 10) / 10).toString()
export const P = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`
type Filt = 'rough' | 'wash' | 'dry'

/** One painted path: class + (optional) one of the page's ink filters. */
export const ink = (d: string, cls: string, filter?: Filt, style?: string) =>
  s('path', { class: cls, d, filter: filter ? `url(#ink-${filter})` : null, style: style ?? null })

/** Lantern body gradients in several ink tones (index 0 = the kit's own warm paper). */
const TONES = ['--vermilion', '--moss-2', '--rock-mid', '--firefly', '--lantern']
export function gdefs() {
  p2Defs()
  if (document.getElementById('g12-defs')) return
  const stop = (o: number, c: string, a = 1) => s('stop', { offset: o, style: `stop-color:var(${c});stop-opacity:${a}` })
  document.getElementById('p2-defs')!.append(s('defs', { id: 'g12-defs' },
    ...TONES.map((c, i) => s('radialGradient', { id: `g12-tone-${i + 1}`, cx: 0.42, cy: 0.4, r: 0.66 }, stop(0, '--moon'), stop(0.5, c, 0.95), stop(1, c, 0.8))),
    // a pool of lamp light on a surface, and the cool beam of moonlight through a window
    s('radialGradient', { id: 'g12-pool' }, stop(0, '--lantern', 0.34), stop(0.5, '--lantern', 0.12), stop(1, '--lantern', 0)),
    s('linearGradient', { id: 'g12-beam', x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, '--moon', 0.42), stop(1, '--moon', 0.04)),
    // a feathered ellipse for masks: things fade out softly toward their edges
    s('radialGradient', { id: 'g12-feather' }, s('stop', { offset: 0.55, 'stop-color': '#fff' }), s('stop', { offset: 1, 'stop-color': '#000' }))))
}

/** Still water (paint.ts `water`) whose edges melt into the paper: a pond, a lake glimpsed beyond the path. */
let lakes = 0
export function lake(x0: number, y0: number, x1: number, y1: number, seed: number, moonX?: number): SVGGElement {
  gdefs()
  const id = `g12-lake-${++lakes}`
  return s('g', { class: 'g12-lake' },
    s('mask', { id, maskUnits: 'userSpaceOnUse', x: f1(x0), y: f1(y0 - 6), width: f1(x1 - x0), height: f1(y1 - y0 + 12) },
      s('rect', { x: f1(x0), y: f1(y0 - 6), width: f1(x1 - x0), height: f1(y1 - y0 + 12), fill: 'url(#g12-feather)' })),
    s('g', { mask: `url(#${id})` }, water(x0, y0, x1, y1, seed, moonX)))
}

/** A roof seen from the front over x0…x1: the eave line at y curling up at both ends, `tall` of sloped roof above it. */
export function roof(x0: number, x1: number, y: number, u: number, tall = 0): string {
  const m = (x0 + x1) / 2
  let d = `M${P([x0 - 16 * u, y - 3 * u])}Q${P([x0 - 6 * u, y + 3 * u])} ${P([x0 + 8 * u, y + 2 * u])}Q${P([m, y - 4 * u])} ${P([x1 - 8 * u, y + 2 * u])}Q${P([x1 + 6 * u, y + 3 * u])} ${P([x1 + 16 * u, y - 3 * u])}` +
    `L${P([x1 + 10 * u, y + 6 * u])}Q${P([m, y + 4 * u])} ${P([x0 - 10 * u, y + 6 * u])}Z`
  if (tall) d += `M${P([x0 - 4 * u, y - 1 * u])}Q${P([x0 + (x1 - x0) * 0.12, y - tall * 0.5])} ${P([x0 + (x1 - x0) * 0.22, y - tall])}L${P([x1 - (x1 - x0) * 0.22, y - tall])}Q${P([x1 - (x1 - x0) * 0.12, y - tall * 0.5])} ${P([x1 + 4 * u, y - 1 * u])}Z`
  return d
}

/** A paper lantern in ink tone `tone` (0 = warm paper, 1 vermilion, 2 moss, 3 stone, 4 firefly, 5 lantern). */
export function lantern(x: number, y: number, r: number, seed: number, cord: number, tone = 0): SVGGElement {
  gdefs()
  const g = paperLantern(x, y, r, seed, cord)
  if (tone) g.querySelector('.p2p-lamp-body')!.setAttribute('fill', `url(#g12-tone-${tone})`)
  return g
}

/**
 * A board, post or beam from a to b, t thick, as path data: the face (a near-even band), two grain strokes, the ink
 * edge on the shaded side and a moonlit rim on the lit side. Join several and paint them with `woodG`.
 */
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
  return s('g', { class: `g12-wood ${cls}` },
    ink(j('face'), 'g12-wood-face', 'rough'), ink(j('grain'), 'g12-wood-grain', 'dry'), ink(j('edge'), 'g12-wood-edge', 'rough'), ink(j('rim'), 'g12-rim'))
}

/** A small stone lying flat at (x, y): contact shadow, rock wash, an ink underside and a moonlit crown. */
export function pebble(x: number, y: number, rx: number, seed: number, ry = rx * 0.62): SVGGElement {
  const d = blob(x, y - ry * 0.5, rx, ry, seed, 0.12, 14)
  return s('g', { class: 'g12-pebble' },
    s('ellipse', { class: 'g12-contact', cx: f1(x + rx * 0.1), cy: f1(y), rx: f1(rx * 1.1), ry: f1(Math.max(1.5, ry * 0.35)) }),
    s('path', { d, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
    s('path', { d, fill: 'url(#p2-shade)' }),
    ink(stroke(curve([x - rx * 0.9, y - ry * 0.3], [x, y + ry * 0.35], [x + rx * 0.95, y - ry * 0.4], 8), Math.max(1, rx * 0.12), 0.2, 0.2, 0.2), 'g12-edge', 'rough'),
    ink(stroke(curve([x - rx * 0.6, y - ry * 0.95], [x - rx * 0.1, y - ry * 1.38], [x + rx * 0.45, y - ry * 1.05], 6), Math.max(0.8, rx * 0.12), 0.3, 0.3, 0.1), 'g12-rim'))
}

/** A lamp hanging from a cord at (x, y0): its pool of light falls on a surface at `floor` (if given). */
export function hangingLamp(x: number, y0: number, cord: number, r: number, seed: number, floor?: [number, number]): SVGGElement {
  gdefs()
  return s('g', { class: 'g12-hang' },
    floor ? s('ellipse', { class: 'g12-pool', cx: f1(x), cy: f1(floor[0]), rx: f1(floor[1]), ry: f1(floor[1] * 0.3), fill: 'url(#g12-pool)' }) : null,
    paperLantern(x, y0, r, seed, cord))
}

/**
 * A workshop doorway (x, y = bottom-left, w × h): a brushed frame and lintel under a small eave, a shoji leaf slid
 * aside and the opening — `open` shows the night outside (moonlight on the floor), else a warm lamp-lit room.
 */
export function doorway(x: number, y: number, w: number, hh: number, seed: number, open = true): SVGGElement {
  gdefs()
  const r = rng(seed)
  const t = Math.max(3, w * 0.09)
  const frame = [
    wood([x, y], [x, y - hh], t, seed),
    wood([x + w, y], [x + w, y - hh], t, seed + 1),
    wood([x - t * 1.2, y - hh], [x + w + t * 1.2, y - hh - t * 0.2], t * 1.1, seed + 2),
  ]
  // the gate's roof: eaves curling up, a sloped face and a moonlit ridge
  const u = w / 40
  const ey = y - hh - t * 1.3
  const eave = roof(x - w * 0.18, x + w * 1.18, ey, u, w * 0.34)
  // a shoji leaf half slid over the right of the opening: frame + lattice
  const lx = x + w * 0.52, lw = w * 0.46
  let lat = ''
  for (let i = 1; i < 4; i++) lat += stroke([[lx + 1, y - (hh * i) / 4], [lx + lw - 1, y - (hh * i) / 4 + (r() - 0.5)]], Math.max(0.7, t * 0.18), 0.1, 0.1, 0.5)
  lat += stroke([[lx + lw / 2, y - 2], [lx + lw / 2, y - hh + 2]], Math.max(0.7, t * 0.18), 0.1, 0.1, 0.5)
  return s('g', { class: `g12-door${open ? ' open' : ''}` },
    s('rect', { class: 'g12-door-in', x: f1(x), y: f1(y - hh), width: f1(w), height: f1(hh) }),
    open ? null : s('ellipse', { class: 'g12-door-warm', cx: f1(x + w * 0.4), cy: f1(y - hh * 0.45), rx: f1(w * 0.7), ry: f1(hh * 0.6), fill: 'url(#g12-pool)' }),
    open ? s('path', { class: 'g12-door-spill', d: `M${P([x + t * 0.5, y])}L${P([x + w - t * 0.5, y])}L${P([x + w * 1.5, y + hh * 0.22])}L${P([x - w * 0.5, y + hh * 0.22])}Z`, fill: 'url(#g12-beam)' }) : null,
    s('rect', { class: 'g12-shoji', x: f1(lx), y: f1(y - hh), width: f1(lw), height: f1(hh) }),
    ink(lat, 'g12-lattice', 'rough'),
    woodG(frame),
    ink(eave, 'g12-eave', 'rough'),
    ink(stroke([[x + w * 0.1, ey - w * 0.34], [x + w * 0.5, ey - w * 0.355], [x + w * 0.9, ey - w * 0.34]], 1.4 * u, 0.2, 0.2, 0.2), 'g12-rim'),
    paperLantern(x + w * 1.08, ey + 5 * u, w * 0.1, seed, w * 0.12))
}

/** A low workbench: a thick top from x0 to x1 at y, legs down `hh`, a stretcher between them. */
export function bench(x0: number, x1: number, y: number, hh: number, seed: number): SVGGElement {
  const t = Math.max(4, hh * 0.16)
  return woodG([
    wood([x0 + t, y + t * 0.6], [x0 + t * 1.3, y + hh], t * 0.9, seed + 1),
    wood([x1 - t, y + t * 0.6], [x1 - t * 1.3, y + hh], t * 0.9, seed + 2),
    wood([x0 + t * 1.2, y + hh * 0.7], [x1 - t * 1.2, y + hh * 0.72], t * 0.5, seed + 3),
    wood([x0, y], [x1, y + 0.5], t, seed),
  ], 'g12-bench')
}

/**
 * perspectiveCircle art hook helpers. The hook paints *behind* the pond; `onTop` lifts a group above the water once the
 * pond has been drawn (things on or in the water: a bridge, a reflection). `circleStones` = where the component puts its
 * n stones for this pond (same maths as perspectives.ts layout), so lamps/candles can stand beside them.
 */
export function onTop<T extends SVGElement>(el: T): T {
  queueMicrotask(() => el.ownerSVGElement?.append(el))
  return el
}
export function circleStones(g: { w: number; h: number; cx: number; cy: number; rx: number; ry: number }, n: number) {
  let bw = clamp(Math.min(g.w, g.h * 1.7) * 0.19, 64, 140)
  if (Math.min(g.w / 2 - bw * 1.15, (g.h / 2 - (bw * 0.75) * 1.2) / 0.46, bw * 2.3) < 50) bw = 60
  const bh = bw * 0.75
  const RX = g.rx + bw * 0.62, RY = g.ry + bh * 0.56
  return { bw, bh, pts: Array.from({ length: n }, (_, k) => {
    const a = ((-90 + 180 / n + (k * 360) / n) * Math.PI) / 180
    return [g.cx + RX * Math.cos(a), g.cy + RY * Math.sin(a)] as Pt
  }) }
}

/**
 * A "take-away" pill that opens a toolkit card in a paper sheet over the scene (Esc / Đóng closes it).
 * Returns the pill; the caller places it.
 */
export function cardButton(ctx: SceneCtx, host: HTMLElement, id: string): HTMLButtonElement | null {
  const card = findTakeaway(id)
  if (!card) return null
  const close = h('button', { class: 'g12-close', type: 'button' }, L.close)
  const sheet = h('div', { class: 'g12-sheet', role: 'region', 'aria-label': L.takeaway, hidden: true }, close, takeaway(card, null, ctx.onCleanup))
  const btn = h('button', { class: 'g12-pill', type: 'button', 'aria-expanded': 'false' }, L.takeaway)
  const set = (open: boolean) => {
    sheet.hidden = !open
    btn.setAttribute('aria-expanded', String(open))
    ;(open ? close : btn).focus()
  }
  btn.addEventListener('click', () => set(true))
  close.addEventListener('click', () => set(false))
  const esc = (e: KeyboardEvent) => e.key === 'Escape' && !sheet.hidden && set(false)
  addEventListener('keydown', esc)
  ctx.onCleanup(() => removeEventListener('keydown', esc))
  host.append(sheet)
  return btn
}
