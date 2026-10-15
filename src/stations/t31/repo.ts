import raw from '../../content/tram-31.json'
import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { cardSheet, live, night, stroke } from './kit'

const K = raw.scenes.repo
type Repo = (typeof K.repos)[number]

/** A wooden house under the moon (viewBox 0 0 200 150): the cared-for one glows, the copy has a shut door and cobwebs. */
function houseArt(trust: boolean): SVGSVGElement {
  const g = s('svg', { class: `t31r-art ${trust ? 'on' : ''}`, viewBox: '0 0 200 150', 'aria-hidden': 'true' },
    s('ellipse', { class: 't31w-shadow', cx: 100, cy: 140, rx: 90, ry: 6 }),
    s('path', { class: 'g11-card', d: 'M40 74h120v64H40z' }),
    s('path', { class: 'g11-ink', 'fill-opacity': 0.08, d: 'M40 74h120v64H40z' }),
    // eaves: a heavy curved roof
    s('path', { class: 'g11-ink', d: 'M14 80C50 70 70 46 100 40C130 46 150 70 186 80C150 76 50 76 14 80Z' }),
    s('path', { class: 'g11-ink', d: stroke([[40, 78], [40, 138]], 3, 0, 0, 0.8) + stroke([[160, 78], [160, 138]], 3, 0, 0, 0.8) + stroke([[30, 139], [170, 139]], 2.4, 0.1, 0.1) }),
    // door
    s('rect', { class: trust ? 't31r-glow' : 'g11-ink2', x: 86, y: 96, width: 28, height: 42, 'fill-opacity': trust ? 1 : 0.55 }),
    s('path', { class: 'g11-ink', d: stroke([[100, 96], [100, 138]], 1.2, 0, 0) }),
    // window
    s('rect', { class: trust ? 't31r-glow' : 'g11-ink3', x: 52, y: 92, width: 22, height: 18, 'fill-opacity': trust ? 1 : 0.35 }),
    s('path', { class: 'g11-ink', d: stroke([[52, 101], [74, 101]], 1, 0, 0) + stroke([[63, 92], [63, 110]], 1, 0, 0) }),
  )
  if (trust) {
    // a notice board of repairs and a hanging lantern
    g.append(
      s('rect', { class: 'g11-paper', x: 128, y: 94, width: 22, height: 16, stroke: 'none' }),
      s('path', { class: 'g11-ink2', d: stroke([[131, 99], [146, 99]], 1, 0, 0) + stroke([[131, 103], [143, 103]], 1, 0, 0) + stroke([[131, 107], [145, 107]], 1, 0, 0) }),
      s('path', { class: 'g11-ink', d: stroke([[172, 80], [172, 92]], 1, 0, 0) }),
      s('ellipse', { class: 't31r-glow', cx: 172, cy: 99, rx: 6, ry: 8 }))
  } else {
    // cobwebs in the eave corner, a crooked name board
    g.append(
      s('path', { class: 'g11-stroke t31r-web', d: 'M42 76L64 76M42 76L42 98M42 76L58 92M48 76Q47 82 42 82M55 76Q53 88 42 89M62 76Q58 92 42 96' }),
      s('g', { transform: 'rotate(-7 139 101)' }, s('rect', { class: 'g11-ink3', x: 126, y: 95, width: 26, height: 11, 'fill-opacity': 0.5 })))
  }
  return g
}

/** Scene 4 — two look-alike houses (repos): read six signals side by side, then choose the one to trust. */
export function repoScene(ctx: SceneCtx) {
  const say = live('g11-say t31r-say')
  const panel = live('t31r-panel')
  let picked = false
  const houses = K.repos.map((r) => {
    const val = h('p', { class: 't31r-val' })
    const pick = h('button', { class: 'g11-pill t31r-pick', type: 'button', 'aria-label': fill(K.pickAria, { name: r.name }), onClick: () => choose(r, el) }, K.pick)
    const el = h('div', { class: 't31r-house' }, houseArt(r.trust), h('p', { class: 't31r-name' }, r.name), val, pick)
    return { r, el, val, pick }
  })
  const chips = K.signals.map((sg) => h('button', { class: 'g11-pill t31r-chip', type: 'button', 'aria-pressed': 'false', onClick: () => show(sg.id) }, sg.label))
  const root = h('div', { class: 'g11 t31r', role: 'group', 'aria-label': K.aria },
    night(),
    h('p', { class: 'visually-hidden' }, K.art),
    h('p', { class: 'g11-mock t31r-mock' }, K.mock),
    h('div', { class: 't31r-row' }, ...houses.map((x) => x.el)),
    h('div', { class: 't31r-chips' }, ...chips),
    panel, say)
  ctx.art.append(root)
  const sheet = cardSheet(root, K.takeaway)

  function show(id: string) {
    const sg = K.signals.find((x) => x.id === id)!
    chips.forEach((c, k) => c.setAttribute('aria-pressed', String(K.signals[k].id === id)))
    for (const x of houses) x.val.textContent = (x.r.values as Record<string, string>)[id]
    panel.say(h('p', null, h('strong', null, sg.label), ' — ', sg.what), h('p', { class: 'visually-hidden' }, houses.map((x) => `${x.r.name}: ${(x.r.values as Record<string, string>)[id]}`).join('. ')))
    ctx.chime('tap')
  }

  function choose(r: Repo, el: HTMLElement) {
    for (const x of houses) x.el.classList.toggle('picked', x.el === el)
    say.say(r.trust ? K.right : h('span', { class: 'bad' }, K.wrong))
    ctx.chime(r.trust ? 'ok' : 'low')
    root.classList.add('judged')
    if (picked) return
    picked = true
    ctx.insight(K.insight as Fact, K.detail as Fact)
    sheet.show()
  }
  ctx.prompt(K.prompt)
}
