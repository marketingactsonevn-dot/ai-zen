import raw from '../../content/tram-19.json'
import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { onSize, stableHeight, stroke } from '../../ui/part2/ink'
import { findTakeaway, takeaway } from '../../ui/part2/takeaway'

const T = raw.scenes.stele

/** Scene 3 · read the stele without being fooled: sweep a lantern over a mock press release, five faint marks appear. */
export function steleScene(ctx: SceneCtx) {
  const stableH = stableHeight(ctx, [T.insight as Fact])
  const found = new Set<number>()
  const roof = s('svg', { class: 't19s-roof', viewBox: '0 0 300 40', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    s('path', { class: 't19s-eave', d: 'M0 38Q60 30 110 14L150 2L190 14Q240 30 300 38Q250 33 150 31Q50 33 0 38Z' }),
    s('path', { class: 't19s-eave-ink', d: stroke([[4, 37], [70, 27], [150, 3], [230, 27], [296, 37]], 2.4, 0.1, 0.1) }))
  const glow = h('div', { class: 't19s-glow', 'aria-hidden': 'true' })
  const lines = T.lines.map((l, i) => {
    const sign = h('span', { class: 't19s-sign', 'aria-hidden': 'true' }, l.sign)
    const b = h('button', { class: 't19s-line', type: 'button', 'aria-label': l.aria, onClick: () => reveal(i) }, h('span', { class: 't19s-text' }, l.text), sign)
    b.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && reveal(i))
    return b
  })
  const stele = h('div', { class: 't19s-stele', role: 'group', 'aria-label': T.lanternAria },
    glow,
    h('p', { class: 't19s-title' }, T.mockTitle),
    h('div', { class: 't19s-lines' }, ...lines))
  const count = h('p', { class: 'p2-eyebrow t19s-count' }, fill(T.found, { n: 0 }))
  const read = h('div', { class: 't19s-read' })
  const doneBtn = h('button', { class: 't19s-done', type: 'button', onClick: openCard }, T.done)
  doneBtn.hidden = true
  const side = h('div', { class: 't19s-side' }, count, read, doneBtn, ctx.fact(T.mockNote as Fact, 'p', 't19s-note'))
  const hall = h('div', { class: 't19s-hall' }, roof, stele)
  const root = h('div', { class: 't19 t19s' }, hall, side)
  ctx.art.append(root)
  ctx.prompt(T.prompt)

  let box: DOMRect | null = null
  stele.addEventListener('pointerenter', () => (box = stele.getBoundingClientRect()))
  stele.addEventListener('pointermove', (e) => {
    if (!box) return
    glow.style.transform = `translate(${e.clientX - box.left}px, ${e.clientY - box.top}px)`
    glow.classList.add('on')
  })
  stele.addEventListener('pointerleave', () => glow.classList.remove('on'))
  ctx.onCleanup(onSize(ctx.art, () => {
    box = null
    root.style.height = `${stableH(ctx.art.clientHeight)}px`
  }))

  function reveal(i: number) {
    const l = T.lines[i]
    lines[i].classList.add('found')
    lines[i].setAttribute('aria-label', `${l.aria} · ${l.sign}`)
    read.setAttribute('aria-live', 'polite')
    read.replaceChildren(h('p', { class: 't19s-sign-big' }, l.sign), h('p', { class: 't19s-q' }, l.question))
    if (found.has(i)) return
    found.add(i)
    ctx.chime('tap')
    count.textContent = fill(T.found, { n: found.size })
    if (found.size === T.lines.length) {
      doneBtn.hidden = false
      ctx.insight(T.insight as Fact, T.detail as Fact)
    }
  }

  function openCard() {
    const card = findTakeaway(T.takeaway)
    if (!card || root.classList.contains('carded')) return
    root.classList.add('carded')
    const wrap = h('div', { class: 't19s-card' }, takeaway(card))
    root.append(wrap)
    ;(wrap.querySelector('button') as HTMLElement | null)?.focus({ preventScroll: true })
  }
}
