import raw from '../../content/tram-33.json'
import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { onDigit } from '../../ui/part2/ink'
import type { SceneCtx } from '../types'
import { lantern, live, night, stroke } from '../t31/kit'

const K = raw.scenes.house

/** Scene 4 — a five-bay wooden house in section: light each bay (model, tools, skills, memory, channel) to read it. */
export function houseScene(ctx: SceneCtx) {
  const lit = new Set<number>()
  const panel = live('t33h-panel')
  const note = h('p', { class: 't33h-note', hidden: true }, K.note)
  const rooms = K.rooms.map((r, i) => {
    const [a, b] = r.name.split(/:\s*/)
    return h('button', { class: 't33h-room', type: 'button', 'aria-pressed': 'false', 'aria-label': fill(K.roomAria, { name: r.name }), onClick: () => light(i) },
      lantern(), h('span', { class: 't33h-a' }, a), b ? h('span', { class: 't33h-b' }, b) : null)
  })
  const roof = s('svg', { class: 't33h-roof', viewBox: '0 0 1000 90', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    s('path', { class: 'g11-ink', d: 'M0 86C160 70 300 30 500 10C700 30 840 70 1000 86C840 78 160 78 0 86Z' }),
    s('path', { class: 'g11-ink2', d: stroke([[120, 72], [500, 26], [880, 72]], 2, 0.1, 0.1) }))
  const root = h('div', { class: 'g11 t33h', role: 'group', 'aria-label': K.aria },
    night(),
    h('p', { class: 'visually-hidden' }, K.art),
    h('div', { class: 't33h-house' }, roof, h('div', { class: 't33h-bays' }, ...rooms), h('span', { class: 't33h-floor', 'aria-hidden': 'true' })),
    panel, note)
  ctx.art.append(root)

  function light(i: number) {
    const r = K.rooms[i]
    rooms.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)))
    rooms[i].classList.add('on')
    const st = (r as { station?: number }).station
    panel.say(h('p', { class: 't33h-name' }, r.name), h('p', { class: 't33h-what' }, r.what),
      st ? h('a', { class: 't33h-link', href: `#/tram/${st}` }, fill(K.seeStation, { n: st })) : '')
    if (lit.has(i)) return
    lit.add(i)
    ctx.chime('tap')
    if (lit.size === K.rooms.length) {
      note.hidden = false
      ctx.insight(K.insight as Fact, K.detail as Fact)
    }
  }
  ctx.onCleanup(onDigit((d) => d <= rooms.length && rooms[d - 1].click()))
  ctx.prompt(K.prompt)
}
