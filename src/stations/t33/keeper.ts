import raw from '../../content/tram-33.json'
import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { live, night, stroke } from '../t31/kit'

const K = raw.scenes.keeper

/** Porch post with a wind chime, the pond the keeper walks round with a lantern, the thick notebook (viewBox 0 0 600 220). */
function porchArt(): SVGSVGElement {
  const chime = s('g', { class: 't33k-chime' },
    s('path', { class: 'g11-ink2', d: stroke([[110, 40], [110, 62]], 1, 0, 0) }),
    s('path', { class: 'g11-ink', d: 'M96 62Q110 52 124 62L122 76H98Z' }),
    s('path', { class: 'g11-ink2', d: stroke([[110, 76], [110, 104]], 0.8, 0, 0) }),
    s('rect', { class: 't33k-tag', x: 104, y: 104, width: 12, height: 26, rx: 1 }))
  return s('svg', { class: 't33k-art', viewBox: '0 0 600 220', 'aria-hidden': 'true' },
    // porch post and eave
    s('path', { class: 'g11-ink', d: stroke([[40, 220], [42, 30]], 9, 0.02, 0.02, 0.7) }),
    s('path', { class: 'g11-ink', d: stroke([[0, 34], [90, 30], [170, 40]], 8, 0.05, 0.2, 0.4) }),
    chime,
    // the pond and the keeper's path
    s('ellipse', { class: 't33k-pond', cx: 380, cy: 176, rx: 170, ry: 30 }),
    s('path', { class: 'g11-ink3', 'fill-opacity': 0.5, d: stroke([[214, 176], [300, 206], [460, 206], [548, 176]], 1.4, 0.1, 0.1) }),
    s('ellipse', { class: 'g11-moon t33k-moonr', cx: 430, cy: 176, rx: 16, ry: 4 }),
    s('g', { class: 't33k-keeper' },
      s('path', { class: 'g11-ink', d: 'M292 196C290 170 296 150 304 146C312 150 318 170 316 196Z' }),
      s('circle', { class: 'g11-ink', cx: 304, cy: 140, r: 7 }),
      s('path', { class: 'g11-ink', d: stroke([[312, 162], [326, 168]], 2, 0, 0) }),
      s('circle', { class: 'g11-lan-glow', cx: 328, cy: 176, r: 18, style: 'opacity:.35' }),
      s('ellipse', { class: 'g11-lan-body', cx: 328, cy: 177, rx: 5, ry: 7, style: 'fill-opacity:.95' })),
    // the notebook on a stone by the path
    s('path', { class: 'g11-ink2', d: 'M500 120l40-6 4 26-40 6z' }),
    s('path', { class: 'g11-paper', d: stroke([[506, 124], [536, 120]], 1.2, 0, 0) + stroke([[507, 130], [534, 126]], 1.2, 0, 0) }))
}

/** Scene 1 — the resident keeper: send one message, watch the chime ring and the keeper write it down; then compare kinds. */
export function keeperScene(ctx: SceneCtx) {
  const reply = h('p', { class: 't33k-msg in', hidden: true }, K.reply)
  const send = h('button', { class: 'g11-pill t33k-send', type: 'button', 'aria-label': K.sendAria }, K.send)
  const panel = live('t33k-panel')
  const tabs = K.kinds.map((kd, i) => h('button', { class: 'g11-pill', type: 'button', 'aria-pressed': 'false', 'aria-label': fill(K.kindAria, { name: kd.name }), onClick: () => show(i) }, kd.name))
  const kinds = h('div', { class: 't33k-kinds', hidden: true }, h('div', { class: 't33k-tabs' }, ...tabs), panel)
  const root = h('div', { class: 'g11 t33k', role: 'group', 'aria-label': K.aria },
    night(),
    h('p', { class: 'visually-hidden' }, K.art),
    porchArt(),
    h('div', { class: 't33k-chat' }, h('p', { class: 't33k-msg out' }, K.message), reply, send),
    kinds)
  ctx.art.append(root)

  function show(i: number) {
    const kd = K.kinds[i]
    tabs.forEach((t, k) => t.setAttribute('aria-pressed', String(k === i)))
    panel.say(
      h('p', { class: 't33k-what' }, kd.what),
      ...kd.examples.map((ex) => h('div', { class: 't33k-ex' },
        h('p', { class: 't33k-exn' }, ex.name),
        ctx.fact(ex.fact as Fact, 'p', 't33k-fact'),
        'claim' in ex && ex.claim ? ctx.fact(ex.claim as Fact, 'p', 't33k-fact') : '')))
  }

  send.addEventListener('click', () => {
    send.hidden = true
    root.classList.add('rung')
    ctx.chime('soft')
    const t = window.setTimeout(() => {
      reply.hidden = false
      kinds.hidden = false
      show(0)
      ctx.insight(K.insight as Fact, K.detail)
      tabs[0].focus({ preventScroll: true })
    }, ctx.reduced ? 0 : 900)
    ctx.onCleanup(() => clearTimeout(t))
  })
  ctx.prompt(K.prompt)
}
