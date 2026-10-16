import raw from '../../content/tram-38.json'
import type { Fact } from '../../core/content'
import { h } from '../../core/dom'
import { onSize, stableHeight } from '../../ui/part2/ink'
import { inkSheet } from '../t37/sumi'
import type { T38 } from './types'
import type { SceneCtx } from '../types'

export const C = raw as unknown as T38

/**
 * Scene root sized to the art height the tallest insight leaves (no jump when it appears), with the art description for
 * screen readers and a fixed-viewBox ink painting that scales by CSS (no per-size redraw). `svg` is the painting's layer.
 */
export function shell(ctx: SceneCtx, cls: string, art: string, copies: (Fact | string | undefined)[], viewBox: string) {
  const stable = stableHeight(ctx, copies)
  const { svg, layer } = inkSheet('t38-svg', viewBox)
  const panel = h('div', { class: 't38-panel' })
  const root = h('div', { class: `t38 ${cls}` }, h('p', { class: 'visually-hidden' }, art), h('div', { class: 't38-stage' }, svg), panel)
  ctx.art.append(root)
  ctx.onCleanup(onSize(ctx.art, () => {
    root.style.height = `${Math.max(240, stable(ctx.art.clientHeight))}px`
  }))
  return { root, svg: layer, sheet: svg, panel }
}
