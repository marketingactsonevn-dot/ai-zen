import raw from '../../content/tram-32.json'
import { h } from '../../core/dom'
import type { Fact } from '../../core/content'
import { codeScroll } from '../../ui/part2/code'
import type { CodeScroll } from '../../ui/part2/types'
import type { SceneCtx } from '../types'
import { cardSheet, lantern } from '../t31/kit'

const K = raw.scenes.scroll

/** Scene 4 — a calligraphy scroll on the bamboo wall, rolled up; pull the cord and it unrolls into four Ollama commands. */
export function scrollScene(ctx: SceneCtx) {
  const fold = h('div', { class: 't32x-fold' }, h('div', { class: 't32x-inner' }, codeScroll(K.code as CodeScroll)))
  const cord = h('button', { class: 't32x-cord', type: 'button', 'aria-expanded': 'false', 'aria-label': K.prompt }, lantern('on'), h('span', null, K.prompt))
  const note = h('p', { class: 't32x-note', hidden: true }, K.modelNote)
  const root = h('div', { class: 'g11 t32x', role: 'group', 'aria-label': K.aria },
    h('p', { class: 'visually-hidden' }, K.art),
    h('span', { class: 't32x-rod', 'aria-hidden': 'true' }),
    fold, cord, note)
  ctx.art.append(root)
  const sheet = cardSheet(root, K.takeaway, ctx.onCleanup)
  cord.addEventListener('click', () => {
    root.classList.add('open')
    cord.hidden = true
    note.hidden = false
    ctx.chime('soft')
    ctx.insight(K.insight as Fact, K.detail as Fact)
    sheet.show()
    ;(fold.querySelector('pre, [tabindex]') as HTMLElement | null)?.focus({ preventScroll: true })
  })
  ctx.prompt(K.prompt)
}
