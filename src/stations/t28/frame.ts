import './frame.css'
import { h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { clamp, onSize, p2Defs, stableHeight } from '../../ui/part2/ink'

/**
 * Garden 10 (t28–t30) scene frame: an SVG stage (drawn at its pixel size) with an HTML layer over it for buttons, plus an
 * optional panel — beside the stage on wide screens, under it on tall ones. `draw` runs on every resize; it must be static.
 */
export function frame(ctx: SceneCtx, cls: string, copies: (Fact | string | undefined)[], panel: HTMLElement | null, draw: (w: number, h: number, wide: boolean) => void) {
  p2Defs()
  const svg = s('svg', { class: 'gf-svg', 'aria-hidden': 'true' })
  const over = h('div', { class: 'gf-over' })
  const stage = h('div', { class: 'gf-stage' }, svg, over)
  const root = h('div', { class: `gf ${cls}` }, stage, panel)
  ctx.art.append(root)
  const stableH = stableHeight(ctx, copies)
  ctx.onCleanup(onSize(ctx.art, () => {
    const W = ctx.art.clientWidth
    const H = stableH(ctx.art.clientHeight)
    if (W < 40 || H < 40) return
    const wide = W / H > 1.15
    root.style.height = `${Math.round(H)}px`
    root.classList.toggle('wide', wide)
    if (panel) panel.style.width = wide ? `${Math.round(Math.min(390, W * 0.36))}px` : ''
    if (panel) panel.style.maxHeight = wide ? `${Math.round(H)}px` : `${Math.round(H * 0.46)}px`
    // one read after the writes above: the stage gets what the panel leaves
    const sw = stage.clientWidth, sh = stage.clientHeight
    if (sw < 20 || sh < 20) return
    svg.setAttribute('viewBox', `0 0 ${sw} ${sh}`)
    draw(sw, sh, wide)
  }))
  return { root, svg, over, stage }
}

export const f1 = (n: number) => (Math.round(n * 10) / 10).toString()
export { clamp }
