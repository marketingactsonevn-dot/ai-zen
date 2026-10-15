import { h, s } from '../../core/dom'
import { stroke } from '../../ui/part2/ink'
import { codeScroll } from '../../ui/part2/code'
import type { CodeScroll } from '../../ui/part2/types'
import type { SceneCtx } from '../types'
import { C } from './content'
import { F, paperLantern } from '../t34/night'

const K = C.scenes.scroll

/** Scene 2 — a scroll hung on a wooden peg under a lantern; tap its tie and it unrolls into a real SKILL.md. */
export function scrollScene(ctx: SceneCtx) {
  const rod = s('svg', { class: 't35s-rod', viewBox: '0 0 400 60', preserveAspectRatio: 'xMidYMax meet', 'aria-hidden': 'true' },
    paperLantern(352, 0, 8, 1),
    s('path', { d: stroke([[18, 46], [382, 46]], 9, 0.03, 0.03, 0.8), style: 'fill:var(--ink);opacity:.85' }),
    s('circle', { cx: 16, cy: 46, r: 6, style: 'fill:var(--vermilion)' }),
    s('circle', { cx: 384, cy: 46, r: 6, style: 'fill:var(--vermilion)' }),
    s('path', { d: 'M200 46 L184 20 L216 20Z', style: 'fill:none;stroke:var(--ink);stroke-opacity:.5;stroke-width:1.2' }))
  const paper = h('div', { class: 't35s-paper', id: 't35s-paper', hidden: true }, codeScroll(K.code as CodeScroll, { title: K.fileName }))
  const tie = h('button', { class: 't35s-tie', type: 'button', 'aria-expanded': 'false', 'aria-controls': 't35s-paper', 'aria-label': K.codeAria, onClick: open },
    h('span', { class: 't35s-file' }, K.fileName))
  const facts = h('div', { class: 't35s-facts' })
  const root = h('div', { class: 't35 t35s' }, h('p', { class: 'visually-hidden' }, K.art),
    h('div', { class: 't35s-hang' }, rod, tie, paper), facts)
  ctx.art.append(root)
  ctx.prompt(K.prompt)

  function open() {
    tie.hidden = true
    tie.setAttribute('aria-expanded', 'true')
    paper.hidden = false
    root.classList.add('is-open')
    ctx.chime('soft')
    facts.replaceChildren(...K.facts.map((f) => ctx.fact(F(f), 'p')))
    paper.querySelector<HTMLElement>('button, [tabindex]')?.focus()
    ctx.insight(F(K.insight), K.detail)
  }
}
