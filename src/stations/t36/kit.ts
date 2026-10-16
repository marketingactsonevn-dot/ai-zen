import './kit.css'
import { h, s } from '../../core/dom'
import { L, type Fact } from '../../core/content'
import { curve, p2Defs, rng, stroke, type Pt } from '../../ui/part2/ink'
import { findTakeaway, takeaway } from '../../ui/part2/takeaway'
import type { SceneCtx } from '../types'

/**
 * Trạm 36's small painting kit (copied from t34's night kit, trimmed to what this station uses): ink paths, the page's
 * extra gradients, brushed wood, and the take-away pill with its paper sheet. Static SVG, colours are tokens (kit.css).
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
  if (document.getElementById('t36n-defs')) return
  const stop = (o: number, c: string, a = 1) => s('stop', { offset: o, style: `stop-color:var(${c});stop-opacity:${a}` })
  document.getElementById('p2-defs')!.append(s('defs', { id: 't36n-defs' },
    ...TONES.map((c, i) => s('radialGradient', { id: `t36n-tone-${i + 1}`, cx: 0.42, cy: 0.4, r: 0.66 }, stop(0, '--moon'), stop(0.5, c, 0.95), stop(1, c, 0.8))),
    // a pool of lamp light on a surface, and the cool beam of moonlight through a window
    s('radialGradient', { id: 't36n-pool' }, stop(0, '--lantern', 0.34), stop(0.5, '--lantern', 0.12), stop(1, '--lantern', 0)),
    s('linearGradient', { id: 't36n-beam', x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, '--moon', 0.42), stop(1, '--moon', 0.04)),
    // a feathered ellipse for masks: things fade out softly toward their edges
    s('radialGradient', { id: 't36n-feather' }, s('stop', { offset: 0.55, 'stop-color': '#fff' }), s('stop', { offset: 1, 'stop-color': '#000' }))))
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
  return s('g', { class: `t36n-wood ${cls}` },
    ink(j('face'), 't36n-wood-face', 'rough'), ink(j('grain'), 't36n-wood-grain', 'dry'), ink(j('edge'), 't36n-wood-edge', 'rough'), ink(j('rim'), 't36n-rim'))
}

/**
 * A "take-away" pill that opens a toolkit card in a paper sheet over the scene (Esc / Đóng closes it).
 * Returns the pill; the caller places it.
 */
export function cardButton(ctx: SceneCtx, host: HTMLElement, id: string): HTMLButtonElement | null {
  const card = findTakeaway(id)
  if (!card) return null
  const close = h('button', { class: 't36n-close', type: 'button' }, L.close)
  const sheet = h('div', { class: 't36n-sheet', role: 'region', 'aria-label': L.takeaway, hidden: true }, close, takeaway(card, null, ctx.onCleanup))
  const btn = h('button', { class: 't36n-pill', type: 'button', 'aria-expanded': 'false' }, L.takeaway)
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
