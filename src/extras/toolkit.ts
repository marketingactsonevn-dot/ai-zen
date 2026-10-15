import './toolkit.css'
import { fill, h } from '../core/dom'
import { ALL_STATIONS, L, PARTS, displayNo, gardensOfPart } from '../core/content'
import { setCrumb } from '../ui/topbar'
import { TOOLKIT, takeaway } from '../ui/part2/takeaway'
import type { Takeaway } from '../ui/part2/types'

const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

/**
 * #/do-nghe — Túi đồ nghề (spec C.2): every take-away card of Part 2 hanging on shelves, one shelf per garden, with
 * search, garden and topic filters, copy buttons and a link back to each card's station. A plain list: no canvas.
 */
export function render(root: HTMLElement): () => void {
  setCrumb(L.toolkit)
  const cards = TOOLKIT.cards
  const gardens = gardensOfPart(2).filter((g) => cards.some((c) => g.stations.some((st) => st.id === c.station)))
  const topics = [...new Set(cards.map((c) => c.topic).filter((t): t is string => !!t))]
  let garden = 0
  let topic = ''

  const title = h('h1', { tabindex: '-1' }, L.toolkit)
  const q = h('input', { class: 'tk-search', type: 'search', placeholder: L.toolkitSearch, 'aria-label': L.toolkitSearch, autocomplete: 'off' })
  const count = h('p', { class: 'tk-count', role: 'status' })
  const chips = <T,>(label: string, opts: [T, string][], pick: (v: T) => void) => {
    const btns = opts.map(([v, text], i) => {
      const b = h('button', { class: 'tk-chip', type: 'button', 'aria-pressed': String(i === 0) }, text)
      b.addEventListener('click', () => {
        btns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)))
        pick(v)
        apply()
      })
      return b
    })
    return h('div', { class: 'tk-chips', role: 'group', 'aria-label': label }, h('span', { class: 'tk-chips-label' }, label), ...btns)
  }

  // one shelf per garden (cards whose station is unknown hang on a last shelf without a name)
  const items: { li: HTMLElement; card: Takeaway; garden: number; hay: string }[] = []
  const shelf = (gid: number, name: string | null, list: Takeaway[]) => {
    const ul = h('ul', { class: 'tk-grid', role: 'list' }, ...list.map((c, i) => {
      const st = ALL_STATIONS.find((x) => x.id === c.station)
      const from = st ? h('a', { class: 'tk-from', href: `#/tram/${st.id}` }, fill(L.toolkitFrom, { n: displayNo(st.id), title: st.title })) : null
      const li = h('li', { class: 'tk-item', style: `--i:${Math.min(i, 8)}` }, takeaway(c, from))
      items.push({ li, card: c, garden: gid, hay: norm([c.title, c.body, c.note, c.topic, st?.title].filter(Boolean).join(' ')) })
      return li
    }))
    return h('section', { class: 'tk-shelf', 'data-garden': gid }, name ? h('h2', { class: 'tk-shelf-name' }, name) : null, h('span', { class: 'tk-rod', 'aria-hidden': 'true' }), ul)
  }
  const shelves = gardens.map((g) => shelf(g.id, `${fill(L.gardenOf, { n: g.id })} · ${g.name}`, cards.filter((c) => g.stations.some((st) => st.id === c.station))))
  const loose = cards.filter((c) => !gardens.some((g) => g.stations.some((st) => st.id === c.station)))
  if (loose.length) shelves.push(shelf(0, null, loose))
  const none = h('p', { class: 'tk-none' }, cards.length ? L.toolkitNone : L.toolkitSoon)

  function apply() {
    const nq = norm(q.value.trim())
    let n = 0
    for (const it of items) {
      const on = (!garden || it.garden === garden) && (!topic || it.card.topic === topic) && (!nq || it.hay.includes(nq))
      it.li.hidden = !on
      if (on) n++
    }
    shelves.forEach((sh) => (sh.hidden = !sh.querySelector('.tk-item:not([hidden])')))
    none.hidden = n > 0
    count.textContent = n === cards.length ? fill(L.toolkitCount, { n }) : fill(L.toolkitCountFiltered, { n, total: cards.length })
  }

  root.append(
    h('header', { class: 'tk-head sand' },
      h('div', { class: 'wrap' },
        h('p', { class: 'eyebrow' }, PARTS[1].name),
        title,
        h('p', { class: 'tk-lede' }, L.toolkitLede),
        cards.length ? h('div', { class: 'tk-tools' },
          q,
          gardens.length > 1 ? chips(L.toolkitGardens, [[0, L.toolkitAll], ...gardens.map((g) => [g.id, g.name] as [number, string])], (v) => (garden = v)) : null,
          topics.length > 1 ? chips(L.toolkitTopics, [['', L.toolkitAll], ...topics.map((t) => [t, t] as [string, string])], (v) => (topic = v)) : null,
          count) : null)),
    h('div', { class: 'wrap tk-body' },
      ...shelves,
      none,
      h('p', { class: 'tk-caveat' }, L.toolkitCaveat),
      h('p', { class: 'tk-back' }, h('a', { class: 'btn ghost', href: PARTS[1].route }, L.backToMap))))
  q.addEventListener('input', apply)
  apply()
  title.focus({ preventScroll: true })
  return () => {}
}
