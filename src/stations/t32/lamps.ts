import raw from '../../content/tram-32.json'
import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { onDigit } from '../../ui/part2/ink'
import type { SceneCtx } from '../types'
import { lantern, live, stroke } from '../t31/kit'

const K = raw.scenes.lamps

/** Three lamps (viewBox 0 0 80 110): a paper lantern with its lid open, an oil lamp with a wick, a bare flame in glass. */
function lampArt(id: string): SVGSVGElement {
  if (id === 'lmstudio') return lantern('t32l-svg')
  const flame = (x: number, y: number, k: number) => s('g', { class: 't32l-flame' },
    s('circle', { class: 'g11-lan-glow', cx: x, cy: y - 6 * k, r: 26 * k }),
    s('path', { class: 't32l-fire', d: `M${x} ${y - 22 * k}C${x + 7 * k} ${y - 12 * k} ${x + 7 * k} ${y - 2 * k} ${x} ${y}C${x - 7 * k} ${y - 2 * k} ${x - 7 * k} ${y - 12 * k} ${x} ${y - 22 * k}Z` }))
  if (id === 'ollama') {
    return s('svg', { class: 't32l-svg', viewBox: '0 0 80 110', 'aria-hidden': 'true' },
      flame(52, 62, 1),
      s('path', { class: 'g11-ink', d: stroke([[50, 64], [53, 70]], 2, 0, 0) }),
      s('path', { class: 'g11-ink', d: 'M10 74Q40 70 58 70L62 74Q50 96 36 96Q16 96 10 74Z' }),
      s('path', { class: 'g11-ink2', d: stroke([[12, 75], [40, 73], [56, 72]], 1.4, 0.1, 0.1) }),
      s('path', { class: 'g11-ink', d: stroke([[28, 96], [26, 104], [46, 104], [44, 96]], 2.4, 0, 0) }))
  }
  return s('svg', { class: 't32l-svg', viewBox: '0 0 80 110', 'aria-hidden': 'true' },
    flame(40, 66, 1.1),
    s('path', { class: 't32l-glass', d: 'M28 30C26 50 22 60 24 74C26 86 54 86 56 74C58 60 54 50 52 30Z' }),
    s('path', { class: 'g11-ink', d: stroke([[28, 30], [25, 56], [24, 74], [30, 84]], 1.4, 0.1, 0.1) + stroke([[52, 30], [55, 56], [56, 74], [50, 84]], 1.4, 0.1, 0.1) }),
    s('path', { class: 'g11-ink', d: 'M22 86h36l-3 18H25z' }))
}

/** Scene 3 — three lamps on a shelf: LM Studio, Ollama, llama.cpp. Light each to read what it is and who it suits. */
export function lampsScene(ctx: SceneCtx) {
  const lit = new Set<string>()
  const panel = live('t32l-panel')
  const lamps = K.lamps.map((lp) => h('button', { class: 't32l-lamp', type: 'button', 'aria-pressed': 'false', 'aria-label': fill(K.lampAria, { name: lp.name }), onClick: () => light(lp.id) },
    lampArt(lp.id), h('span', { class: 't32l-name' }, lp.name), h('span', { class: 't32l-kind' }, lp.kind)))
  const root = h('div', { class: 'g11 t32l', role: 'group', 'aria-label': K.aria },
    h('p', { class: 'visually-hidden' }, K.art),
    h('div', { class: 't32l-shelf' }, ...lamps),
    panel,
    h('p', { class: 't32l-change' }, K.changeNote))
  ctx.art.append(root)

  function light(id: string) {
    const k = K.lamps.findIndex((x) => x.id === id)
    const lp = K.lamps[k]
    lamps.forEach((b, j) => {
      b.setAttribute('aria-pressed', String(j === k))
      if (j === k) b.classList.add('on')
    })
    const upd = (lp as { update?: Fact }).update
    panel.say(
      h('p', { class: 'p2-eyebrow' }, lp.kind),
      h('h3', { class: 't32l-h' }, lp.name),
      h('p', { class: 't32l-what' }, lp.what),
      h('p', { class: 't32l-fit' }, lp.fit),
      ctx.fact(lp.fact as Fact, 'p', 't32l-fact'),
      upd ? ctx.fact(upd, 'p', 't32l-fact') : '',
      h('a', { class: 't32l-doc', href: lp.doc, target: '_blank', rel: 'noopener noreferrer' }, `${K.docLabel} ↗`))
    if (lit.has(id)) return
    lit.add(id)
    ctx.chime('tap')
    if (lit.size === K.lamps.length) ctx.insight(K.insight as Fact, K.detail)
  }
  ctx.onCleanup(onDigit((d) => d <= lamps.length && lamps[d - 1].click()))
  ctx.prompt(K.prompt)
}
