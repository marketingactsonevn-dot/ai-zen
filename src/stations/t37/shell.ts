import raw from '../../content/tram-37.json'
import type { Fact, StationContent } from '../../core/content'
import { h } from '../../core/dom'
import { onSize, stableHeight } from '../../ui/part2/ink'
import type { Perspectives } from '../../ui/part2/types'
import type { SceneCtx } from '../types'
import { inkSheet } from './sumi'

interface Opt { id: string; say: string; result: string; ok: boolean }
interface Layer { id: string; name: string; what: string; station?: number; fact?: Fact }
export interface T37 extends StationContent {
  takeaways: string[]
  scenes: {
    goal: { label: string; art: string; prompt: string; group: string; optionAria: string; morning: string; retry: string; options: Opt[]; insight: Fact; detail: Fact }
    lab: {
      label: string; art: string; prompt: string; toggle: string; on: string; off: string; watched: string; unwatched: string
      toolsLabel: string; tools: { id: string; name: string; what: string }[]; insight: Fact; detail: Fact; exampleLabel: string; example: Fact
    }
    fence: {
      label: string; art: string; prompt: string; add: string; addAria: string; count: string; leak: string; reset: string; seeStation: string
      layers: Layer[]; insight: Fact; detail: Fact
    }
    views: { label: string; art: string; prompt: string; group: string; stoneAria: string; perspectives: Perspectives; insight: Fact; detail: Fact }
  }
}
export const C = raw as unknown as T37

/**
 * Scene root sized to the art height the tallest insight leaves (no jump when it appears), with the art description for
 * screen readers and a fixed-viewBox ink painting that scales by CSS (no per-size redraw). `svg` is the painting's layer.
 */
export function shell(ctx: SceneCtx, cls: string, art: string, copies: (Fact | string | undefined)[], viewBox: string) {
  const stable = stableHeight(ctx, copies)
  const { svg, layer } = inkSheet('t37-svg', viewBox)
  const panel = h('div', { class: 't37-panel' })
  const root = h('div', { class: `t37 ${cls}` }, h('p', { class: 'visually-hidden' }, art), h('div', { class: 't37-stage' }, svg), panel)
  ctx.art.append(root)
  ctx.onCleanup(onSize(ctx.art, () => {
    root.style.height = `${Math.max(240, stable(ctx.art.clientHeight))}px`
  }))
  return { root, svg: layer, sheet: svg, panel }
}
