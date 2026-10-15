import { h } from '../../core/dom'
import { L } from '../../core/content'
import { stepPath } from '../../ui/part2/steps'
import { codeScroll } from '../../ui/part2/code'
import type { CodeScroll, StepPath } from '../../ui/part2/types'
import type { SceneCtx } from '../types'
import { C } from './content'
import { F } from '../t34/night'

const K = C.scenes.carve

/** Scene 3 — seven stones from the timber pile to the door (stepPath), with the code scroll and the seven sample prompts one tap away. */
export function carveScene(ctx: SceneCtx) {
  const off = stepPath(K.steps as StepPath, { label: K.label, prompt: K.prompt, insight: F(K.insight), detail: K.detail }).mount(ctx)
  if (off) ctx.onCleanup(off)
  const close = h('button', { class: 'g12-close', type: 'button' }, L.close)
  const sheet = h('div', { class: 'g12-sheet t36k-sheet', role: 'region', 'aria-label': K.codeAria, hidden: true }, close,
    h('div', { class: 't36k-body' },
      h('div', { class: 't36k-code' }, codeScroll(K.code as CodeScroll, { title: K.fileName })),
      h('div', { class: 't36k-prompts' }, h('p', { class: 'p2-eyebrow' }, K.promptLabel),
        h('ol', null, ...K.prompts.map((p, i) => h('li', null, h('span', { class: 't36k-step' }, K.steps.steps[i].label), p))))))
  const open = h('button', { class: 'g12-pill t36k-open', type: 'button', 'aria-expanded': 'false' }, K.fileName, ' · ', K.promptLabel)
  const set = (on: boolean) => {
    sheet.hidden = !on
    open.setAttribute('aria-expanded', String(on))
    ;(on ? close : open).focus()
  }
  open.addEventListener('click', () => set(true))
  close.addEventListener('click', () => set(false))
  const esc = (e: KeyboardEvent) => e.key === 'Escape' && !sheet.hidden && set(false)
  addEventListener('keydown', esc)
  ctx.onCleanup(() => removeEventListener('keydown', esc))
  ctx.art.append(h('div', { class: 't36 t36k' }, open, sheet))
}
