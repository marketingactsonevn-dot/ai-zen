import './night.css'
import { h, s } from '../../core/dom'
import { L, type Fact } from '../../core/content'
import { p2Defs, rng, stroke, type Pt } from '../../ui/part2/ink'
import { findTakeaway, takeaway } from '../../ui/part2/takeaway'
import type { SceneCtx } from '../types'

/** Small night-garden kit shared by Garden 12 (stations 34–36): fixed-viewBox art scaled by CSS, so no layout code. */
export const F = (x: unknown) => x as Fact
const v = (name: string, op = 1) => `fill:var(${name});opacity:${op}`

/** A moon with its halo, then a few moonlit water strokes below `waterY`, in a W×H viewBox. */
export function nightSky(W: number, H: number, moon: [number, number, number], waterY?: number, seed = 3): SVGSVGElement {
  p2Defs()
  const [mx, my, mr] = moon
  const svg = s('svg', { class: 'g12-sky', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'xMidYMid slice', 'aria-hidden': 'true' },
    s('circle', { cx: mx, cy: my, r: mr * 3.2, fill: 'url(#p2-halo)' }),
    s('circle', { cx: mx, cy: my, r: mr, style: v('--moon', 0.95) }))
  if (waterY != null) {
    const r = rng(seed)
    for (let i = 0; i < 9; i++) {
      const y = waterY + 8 + r() * (H - waterY - 12)
      const x = mx - 60 + r() * 120 + (i % 2 ? -W * 0.3 : W * 0.25) * r()
      const len = 30 + r() * 90
      svg.append(s('path', { d: stroke([[x, y], [x + len / 2, y - 1.5], [x + len, y]], 2.2, 0.3, 0.4), style: v(i < 4 ? '--moon' : '--ink', i < 4 ? 0.5 : 0.12) }))
    }
  }
  return svg
}

/** A hanging paper lantern centred on x, its cord from y = top; `lit` paints it with --lantern. */
export function paperLantern(x: number, top: number, len: number, sc = 1, tone = '--lantern'): SVGGElement {
  const y = top + len
  return s('g', { class: 'g12-lantern' },
    s('path', { d: `M${x} ${top}L${x} ${y}`, style: 'stroke:var(--ink);stroke-opacity:.45;stroke-width:1' }),
    s('ellipse', { class: 'g12-glow', cx: x, cy: y + 13 * sc, rx: 26 * sc, ry: 26 * sc, fill: 'url(#p2-halo)' }),
    s('path', { d: `M${x - 9 * sc} ${y + 3 * sc}Q${x - 14 * sc} ${y + 13 * sc} ${x - 9 * sc} ${y + 23 * sc}L${x + 9 * sc} ${y + 23 * sc}Q${x + 14 * sc} ${y + 13 * sc} ${x + 9 * sc} ${y + 3 * sc}Z`, style: `fill:var(${tone});stroke:var(--ink);stroke-opacity:.5;stroke-width:${0.8 * sc}` }),
    s('path', { d: `M${x - 6 * sc} ${y + 1 * sc}h${12 * sc}v${2.5 * sc}h${-12 * sc}ZM${x - 6 * sc} ${y + 23 * sc}h${12 * sc}v${2.5 * sc}h${-12 * sc}Z`, style: v('--ink', 0.7) }),
    s('path', { d: `M${x - 11 * sc} ${y + 13 * sc}H${x + 11 * sc}`, style: 'stroke:var(--ink);stroke-opacity:.2;stroke-width:.8' }))
}

/** A stone lantern (tōrō) standing on (x, y). */
export function toro(x: number, y: number, sc = 1): SVGGElement {
  const P = (pts: Pt[]) => 'M' + pts.map(([a, b]) => `${(x + a * sc).toFixed(1)} ${(y + b * sc).toFixed(1)}`).join('L') + 'Z'
  return s('g', { class: 'g12-toro' },
    s('ellipse', { class: 'g12-glow', cx: x, cy: y - 20 * sc, rx: 22 * sc, ry: 22 * sc, fill: 'url(#p2-halo)' }),
    s('path', { d: P([[-7, 0], [7, 0], [5, -3], [-5, -3]]), fill: 'url(#p2-rock)' }),
    s('path', { d: P([[-2.5, -3], [2.5, -3], [2.5, -14], [-2.5, -14]]), fill: 'url(#p2-rock)' }),
    s('path', { d: P([[-6, -14], [6, -14], [6, -24], [-6, -24]]), fill: 'url(#p2-rock)' }),
    s('path', { class: 'g12-fire', d: P([[-3, -16], [3, -16], [3, -22], [-3, -22]]) }),
    s('path', { d: P([[-11, -24], [11, -24], [4, -30], [-4, -30]]), fill: 'url(#p2-rock)' }),
    s('path', { d: P([[-11, -24], [11, -24], [4, -30], [-4, -30]]), style: 'fill:none;stroke:var(--ink);stroke-opacity:.35;stroke-width:.8' }))
}

/**
 * A "take-away" pill that opens a toolkit card in a paper sheet over the scene (Esc / Đóng closes it).
 * Returns the pill; the caller places it.
 */
export function cardButton(ctx: SceneCtx, host: HTMLElement, id: string): HTMLButtonElement | null {
  const card = findTakeaway(id)
  if (!card) return null
  const close = h('button', { class: 'g12-close', type: 'button' }, L.close)
  const sheet = h('div', { class: 'g12-sheet', role: 'region', 'aria-label': L.takeaway, hidden: true }, close, takeaway(card))
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
