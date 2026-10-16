import './part2.css'
import toolkit from '../../content/toolkit.json'
import { h, s, viDate } from '../../core/dom'
import { L, addSources } from '../../core/content'
import { sourceButton } from '../fact'
import type { Takeaway, ToolkitFile } from './types'
import { copyText } from './ink'

/** Every take-away card of Part 2 (toolkit.json); its sources resolve wherever a card is shown. */
export const TOOLKIT = toolkit as ToolkitFile
addSources(TOOLKIT.sources)

export const findTakeaway = (id?: string) => TOOLKIT.cards.find((c) => c.id === id)

/** "[TÊN SẢN PHẨM]": square brackets around upper-case words (any script) — the parts the reader replaces. */
const PH = /\[[^\]\n]{1,60}\]/g
const isPlaceholder = (t: string) => /\p{L}/u.test(t) && t === t.toLocaleUpperCase('vi')

/** The body with its placeholders wrapped in <mark>. */
function bodyNodes(text: string): (Node | string)[] {
  const out: (Node | string)[] = []
  let last = 0
  for (const m of text.matchAll(PH)) {
    if (!isPlaceholder(m[0])) continue
    out.push(text.slice(last, m.index), h('mark', { class: 'p2k-ph' }, m[0]))
    last = m.index + m[0].length
  }
  out.push(text.slice(last))
  return out
}

const COPY_ICON = 'M8 8h9.5a1.5 1.5 0 0 1 1.5 1.5V19a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 19V9.5A1.5 1.5 0 0 1 8 8zM4.5 15.5V5A1.5 1.5 0 0 1 6 3.5h9.5'
const DONE_ICON = 'M5 12.5l4.5 4.5L19 7.5'
const glyph = (d: string) => s('svg', { class: 'p2k-ico', viewBox: '0 0 24 24', 'aria-hidden': 'true' }, s('path', { d }))

/**
 * B.7.5 Thẻ mang về: a paper card whose body copies with one button (Clipboard API; else the text is selected for
 * Ctrl+C). Placeholders [IN HOA] are tinted. Plain DOM, no timers that outlive it: use it in a scene or on a page.
 */
export function takeaway(card: Takeaway, extra?: Node | null, onCleanup?: (fn: () => void) => void): HTMLElement {
  const body = h('pre', { class: 'p2k-body', tabindex: '0' }, ...bodyNodes(card.body))
  const hasPh = body.querySelector('.p2k-ph') != null
  const label = h('span', null, L.copy)
  const btn = h('button', { class: 'btn p2k-copy', type: 'button' }, glyph(COPY_ICON), label)
  const status = h('span', { class: 'p2k-status', role: 'status' })
  let timer = 0
  onCleanup?.(() => clearTimeout(timer)) // the 2.4 s "copied" reset dies with the scene
  btn.addEventListener('click', async () => {
    const how = await copyText(card.body, body)
    clearTimeout(timer)
    btn.classList.toggle('done', how === 'copied')
    btn.replaceChildren(glyph(how === 'copied' ? DONE_ICON : COPY_ICON), label)
    label.textContent = how === 'copied' ? L.copied : L.copy
    status.textContent = how === 'copied' ? L.copied : L.copySelected
    status.classList.toggle('visually-hidden', how === 'copied') // the button already says it
    timer = window.setTimeout(() => {
      btn.classList.remove('done')
      btn.replaceChildren(glyph(COPY_ICON), label)
      label.textContent = L.copy
      status.textContent = ''
    }, 2400)
  })
  return h('article', { class: 'p2k', 'data-type': card.type },
    h('span', { class: 'p2k-seal', 'aria-hidden': 'true' }),
    h('p', { class: 'p2-eyebrow' }, `${L.takeaway} · ${L.takeawayTypes[card.type]}`),
    h('h3', { class: 'p2k-title' }, card.title),
    body,
    card.note ? h('p', { class: 'p2k-note' }, card.note) : null,
    h('div', { class: 'p2k-foot' },
      hasPh ? h('span', { class: 'p2k-hint' }, h('mark', { class: 'p2k-ph', 'aria-hidden': 'true' }, '[ ]'), L.placeholderHint) : null,
      card.source || card.asOf
        ? h('span', { class: 'p2k-meta' }, card.asOf ? `${L.asOf} ${viDate(card.asOf)}` : null, card.source ? sourceButton(card.source, card.asOf) : null)
        : null,
      extra ?? null,
      btn,
      status))
}
