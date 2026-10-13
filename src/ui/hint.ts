import { h } from '../core/dom'
import { L } from '../core/content'
import { progress } from '../core/progress'

/** First-time hint ("thử kéo viên đá này"); disappears on first interaction with the anchor and never returns. */
export function hint(anchor: HTMLElement, key: string, text: string) {
  if (progress.hintSeen(key)) return
  if (['static', ''].includes(getComputedStyle(anchor).position)) anchor.style.position = 'relative'
  let gone = false
  const done = () => {
    if (gone) return
    gone = true
    progress.markHint(key)
    pill.classList.add('out')
    setTimeout(() => pill.remove(), 450)
    anchor.removeEventListener('pointerdown', done)
    anchor.removeEventListener('keydown', done)
  }
  const pill = h('div', { class: 'hint', role: 'note' },
    h('span', { class: 'hint-dot', 'aria-hidden': 'true' }),
    h('span', null, text),
    h('button', { class: 'hint-x', type: 'button', 'aria-label': L.hideHint, onClick: done }, '×'),
  )
  anchor.addEventListener('pointerdown', done)
  anchor.addEventListener('keydown', done)
  anchor.append(pill)
}
