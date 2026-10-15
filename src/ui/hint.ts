import { h } from '../core/dom'
import { L, stationsOfPart } from '../core/content'
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

/**
 * Spec B.5, never a lock: the first time a Part 2 route opens while fewer than 12 Part 1 stations are visited,
 * a light card suggests the Day Garden first. Shown once; any navigation, Esc or either button dismisses it.
 */
export function partTwoAdvice() {
  const KEY = 'part2-advice'
  if (progress.hintSeen(KEY) || stationsOfPart(1).filter((st) => progress.isVisited(st.id)).length >= 12) return
  progress.markHint(KEY)
  const go = h('button', { class: 'btn primary', type: 'button' }, L.partTwoAdviceGo)
  const back = h('a', { class: 'btn ghost', href: '#/vuon' }, L.partTwoAdviceBack)
  const card = h('div', { class: 'toast part-advice', role: 'dialog', 'aria-labelledby': 'part-advice-t' },
    h('span', { id: 'part-advice-t' }, L.partTwoAdvice), go, back)
  const prev = document.activeElement as HTMLElement | null
  const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
  const close = () => {
    // give focus back, not to <body>: prev is gone when the card opened right after a route change
    if (card.contains(document.activeElement))
      (prev?.isConnected && prev !== document.body ? prev : document.querySelector<HTMLElement>('.garden .pstone') ?? document.getElementById('main'))?.focus({ preventScroll: true })
    card.remove()
    removeEventListener('keydown', onKey)
    removeEventListener('hashchange', close)
  }
  go.addEventListener('click', close)
  addEventListener('keydown', onKey)
  addEventListener('hashchange', close) // "Về Vườn Ngày", a stone, the I · II switch…
  document.body.append(card)
  go.focus({ preventScroll: true })
}
