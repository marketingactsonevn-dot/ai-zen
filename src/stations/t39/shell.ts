import raw from '../../content/tram-39.json'
import type { Fact } from '../../core/content'
import { h, s } from '../../core/dom'
import { onSize, p2Defs, stableHeight } from '../../ui/part2/ink'
import type { T39 } from './types'
import type { SceneCtx } from '../types'

export const C = raw as unknown as T39

/**
 * Scene root sized to the art height the tallest insight leaves (no jump when it appears), with the art description for
 * screen readers and a fixed-viewBox ink SVG that scales by CSS (no per-size redraw).
 */
export function shell(ctx: SceneCtx, cls: string, art: string, copies: (Fact | string | undefined)[], viewBox: string) {
  p2Defs()
  const stable = stableHeight(ctx, copies)
  const svg = s('svg', { class: 't39-svg', viewBox, preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true' })
  const panel = h('div', { class: 't39-panel' })
  const root = h('div', { class: `t39 ${cls}` }, h('p', { class: 'visually-hidden' }, art), h('div', { class: 't39-stage' }, svg), panel)
  ctx.art.append(root)
  ctx.onCleanup(onSize(ctx.art, () => {
    root.style.height = `${Math.max(240, stable(ctx.art.clientHeight))}px`
  }))
  return { root, svg, panel }
}

/** Night sky pieces shared by the scenes: the moon with its halo. */
export const moon = (x: number, y: number, r: number) =>
  s('g', { class: 't39-moon' }, s('circle', { cx: x, cy: y, r: r * 3.2, fill: 'url(#p2-halo)' }), s('circle', { cx: x, cy: y, r, class: 'moon' }))

/** A stone lantern (tōrō) standing on (x, y), height ≈ 60 × k. */
export function lantern(x: number, y: number, k = 1) {
  const g = s('g', { class: 't39-toro', transform: `translate(${x} ${y}) scale(${k})` })
  g.append(
    s('ellipse', { cx: 0, cy: 0, rx: 16, ry: 3.5, class: 'sh' }),
    s('path', { d: 'M-10 0h20l-3-6h-14z', class: 'st' }),
    s('rect', { x: -3.5, y: -26, width: 7, height: 20, class: 'st' }),
    s('path', { d: 'M-11 -26h22l-2-4h-18z', class: 'st' }),
    s('rect', { x: -8, y: -42, width: 16, height: 12, class: 'light' }),
    s('path', { d: 'M-8 -42v12M8 -42v12', class: 'edge' }),
    s('path', { d: 'M-17 -42q17 -4 34 0l-6 -9h-22z', class: 'st' }),
    s('circle', { cx: 0, cy: -54, r: 3, class: 'st' }),
  )
  return g
}
