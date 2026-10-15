import raw from '../../content/tram-31.json'
import { fill, h } from '../../core/dom'
import type { Fact } from '../../core/content'
import { onDigit } from '../../ui/part2/ink'
import type { SceneCtx } from '../types'
import { cardSheet, lantern, live, night } from './kit'

const K = raw.scenes.card

/** Scene 3 — a moss-covered stele (the model card); the lantern makes each carved line legible and says what to read in it. */
export function cardScene(ctx: SceneCtx) {
  const lit = new Set<number>()
  const read = live('t31c-read')
  const rows = K.lines.map((ln, n) => {
    const b = h('button', { class: 't31c-line', type: 'button', 'aria-label': fill(K.lineAria, { n: n + 1, label: ln.label }), onClick: () => light(n) },
      lantern(),
      h('span', { class: 't31c-label' }, ln.label),
      h('span', { class: 't31c-value' }, ln.value))
    return b
  })
  const stele = h('div', { class: 't31c-stele' },
    h('p', { class: 'g11-mock' }, K.mock),
    h('p', { class: 't31c-model' }, K.model),
    h('div', { class: 't31c-lines' }, ...rows))
  const root = h('div', { class: 'g11 t31c', role: 'group', 'aria-label': K.aria },
    night(),
    h('p', { class: 'visually-hidden' }, K.art),
    h('div', { class: 't31c-wrap' }, stele, read))
  ctx.art.append(root)
  const sheet = cardSheet(root, K.takeaway)

  function light(n: number) {
    const ln = K.lines[n]
    rows.forEach((r, k) => r.classList.toggle('cur', k === n))
    rows[n].classList.add('on')
    read.say(h('p', { class: 'p2-eyebrow' }, ln.label), h('p', { class: 't31c-readp' }, ln.read))
    if (lit.has(n)) return
    lit.add(n)
    ctx.chime('tap')
    if (lit.size === K.lines.length) {
      ctx.chime('ok')
      ctx.insight(K.insight as Fact, K.detail as Fact)
      sheet.show()
    }
  }
  ctx.onCleanup(onDigit((d) => d <= rows.length && rows[d - 1].click()))
  ctx.prompt(K.prompt)
}
