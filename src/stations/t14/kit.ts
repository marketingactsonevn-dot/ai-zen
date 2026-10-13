import { h, s } from '../../core/dom'
import type { SceneCtx } from '../types'
import type { Copy } from './data'
import { dryFilter } from './art'

/**
 * The art height once the tallest insight of this scene is showing. Compose in that height from the
 * start so nothing jumps (or slides out from under a finger) when the insight grows the foot.
 */
export function stableHeight(ctx: SceneCtx, copies: Copy[]) {
  const foot = ctx.el.querySelector<HTMLElement>('.scene-foot')
  let probeW = -1
  let need = 0
  return (artH: number) => {
    if (!foot) return artH
    if (foot.clientWidth !== probeW) {
      probeW = foot.clientWidth
      const box = h('div', { class: 'scene-insight', 'aria-hidden': 'true', style: 'position:absolute;left:0;right:0;bottom:0;visibility:hidden;pointer-events:none' })
      foot.append(box)
      let max = 0
      for (const c of copies) {
        box.replaceChildren(ctx.fact(c, 'p', 'insight-text'), h('button', { class: 'insight-more', type: 'button', tabindex: '-1' }, '…'))
        max = Math.max(max, box.offsetHeight)
      }
      box.remove()
      const cs = getComputedStyle(foot)
      need = Math.max(parseFloat(cs.minHeight) || 0, max + (parseFloat(cs.paddingBottom) || 0))
    }
    return Math.round(artH - Math.max(0, need - foot.offsetHeight))
  }
}

/** Re-run layout on resize (one frame later) and once the fonts are in; returns stop. */
export function onLayout(el: HTMLElement, fn: () => void) {
  let raf = 0
  let alive = true
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(fn)
  })
  ro.observe(el)
  document.fonts?.ready.then(() => alive && fn())
  return () => {
    alive = false
    ro.disconnect()
    cancelAnimationFrame(raf)
  }
}

/** Gradients every scene uses: the AI's warm glow and the lantern light. Ids are unique per mount. */
export function glowDefs(id: string) {
  return s('defs', null,
    s('radialGradient', { id: `${id}-glow` }, s('stop', { offset: 0, class: 'gl0' }), s('stop', { offset: 0.55, class: 'gl1' }), s('stop', { offset: 1, class: 'gl2' })),
    s('radialGradient', { id: `${id}-lamp` }, s('stop', { offset: 0, class: 'lp0' }), s('stop', { offset: 1, class: 'lp1' })),
    dryFilter())
}
