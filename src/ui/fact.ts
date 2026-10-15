import { h, nextId, viDate } from '../core/dom'
import { getSource, L, type Fact, type FactKind } from '../core/content'
import { confidenceMark } from './part2/marks'

export type TagKind = Exclude<FactKind, 'fact'> | 'verify'

export function tag(kind: TagKind): HTMLElement {
  return h('span', { class: `tag tag-${kind}` }, L.kinds[kind])
}

/** Small ⓘ button; hover / focus / tap reveals the source card. */
export function sourceButton(sourceId: string, asOf?: string): HTMLElement {
  const src = getSource(sourceId)
  const id = nextId('src')
  const btn = h('button', { class: 'src-btn', type: 'button', 'aria-expanded': 'false', 'aria-controls': id, 'aria-label': L.openSource }, 'i')
  const title = src?.url
    ? h('a', { href: src.url, target: '_blank', rel: 'noopener noreferrer' }, src.title)
    : h('span', { class: 'src-title' }, src?.title ?? sourceId)
  const meta = [src?.publisher, viDate(src?.date)].filter(Boolean).join(' · ')
  const pop = h('span', { class: 'src-pop', id },
    h('span', { class: 'src-label' }, L.source),
    title,
    meta ? h('span', { class: 'src-meta' }, meta) : null,
    src?.note ? h('span', { class: 'src-note' }, src.note) : null,
    asOf ? h('span', { class: 'src-meta' }, `${L.asOf}: ${viDate(asOf)}`) : null,
  )
  return popover(btn, pop)
}

/** Wrap a button and its card: hover / focus / tap opens it, placed inside the screen (source ⓘ, Part 2 marks). */
function popover(btn: HTMLElement, pop: HTMLElement): HTMLElement {
  const wrap = h('span', { class: 'src' }, btn, pop)
  const place = () => {
    pop.style.setProperty('--dx', '0px')
    wrap.classList.remove('below')
    const r = pop.getBoundingClientRect()
    const dx = r.left < 8 ? 8 - r.left : r.right > innerWidth - 8 ? innerWidth - 8 - r.right : 0
    pop.style.setProperty('--dx', `${dx}px`)
    if (r.top < 70) wrap.classList.add('below')
  }
  wrap.addEventListener('mouseenter', place)
  btn.addEventListener('focus', place)
  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    const open = !wrap.classList.contains('open')
    closeAll()
    if (open) {
      wrap.classList.add('open')
      btn.setAttribute('aria-expanded', 'true')
      place()
    }
  })
  return wrap
}

function closeAll() {
  document.querySelectorAll('.src.open').forEach((w) => {
    w.classList.remove('open')
    w.querySelector(':scope > button')?.setAttribute('aria-expanded', 'false')
  })
}
document.addEventListener('click', (e) => {
  if (!(e.target as Element).closest?.('.src-pop')) closeAll()
})
document.addEventListener('keydown', (e) => e.key === 'Escape' && closeAll())

/** A sentence that is either plain copy (string) or a sourced Fact (adds tags + ⓘ). */
export function fact(f: Fact | string, as: 'p' | 'span' | 'li' | 'div' = 'p', cls = ''): HTMLElement {
  const el = h(as, { class: `fact ${cls}`.trim() })
  if (typeof f === 'string') {
    el.textContent = f
    return el
  }
  el.append(h('span', { class: 'fact-text' }, f.text))
  // Part 2 (B.7.3): an ink confidence mark replaces the kind tag; Part 1 keeps its tags exactly as before
  const mark = document.documentElement.dataset.part === '2' ? confidenceMark(f) : null
  if (mark) el.append(' ', popover(...mark))
  else if (f.kind && f.kind !== 'fact') el.append(' ', tag(f.kind))
  if (f.verify) el.append(' ', tag('verify'))
  el.append(' ', sourceButton(f.source, f.asOf))
  return el
}
