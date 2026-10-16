import raw from '../../content/tram-33.json'
import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { grass, paperLantern, reeds, steppingStones, water } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import { blob, curve, ground, live, night, plank, stroke } from '../t31/kit'

const K = raw.scenes.keeper

/** Several short brushed lines [x0, y0, x1, y1] as one path. */
const lines = (ls: number[][], w: number) => ls.map(([a, b, c, d]) => stroke([[a, b], [c, d]], w, 0.15, 0.15, 0.4)).join('')

/**
 * Midnight (viewBox 0 0 600 230): the dark main house and its porch post with a wind chime (left), the pond with the
 * moon in it, and the gardener going round it with a lantern and the thick notebook under his arm.
 */
function porchArt(): SVGSVGElement {
  const pond = blob(392, 178, 168, 30, 3302, 0.08, 22)
  // the chime: a bronze bell, its clapper and the paper strip the wind catches
  const chime = s('g', { class: 't33k-chime' },
    s('path', { class: 'g11-thread', d: 'M128 52V70' }),
    s('path', { class: 't33k-bell', d: 'M118 82Q117 70 128 68Q139 70 138 82Z', filter: 'url(#ink-rough)' }),
    s('path', { class: 'g11-moonlit', d: stroke([[121, 80], [122, 73], [126, 70]], 1.4, 0.2, 0.3, 0.2) }),
    s('path', { class: 'g11-thread', d: 'M128 82V108' }),
    s('circle', { class: 't33k-bell', cx: 128, cy: 86, r: 2 }),
    s('path', { class: 't33k-tag', d: 'M123 108h10l1 28h-12Z' }),
    s('path', { class: 'g11-wash t33k-tagink', d: lines([[125.5, 114, 130.5, 114], [125.5, 119, 131, 119], [126, 124, 130, 124]], 0.9) }))
  let tiles = ''
  for (let x = -6; x < 196; x += 9) tiles += stroke([[x, 34 + x * 0.06], [x + 2, 50 + x * 0.05]], 1.3, 0.2, 0.3, 0.3)
  // the gardener: hat, robe, the lantern on a short pole, the notebook under the arm — a few strokes
  const keeper = s('g', { class: 't33k-keeper' },
    s('ellipse', { class: 't33k-shadow', cx: 290, cy: 206, rx: 16, ry: 3 }),
    s('path', { class: 't33k-robe', d: 'M280 205Q279 186 284 170Q287 160 292 158Q299 160 301 170Q305 186 303 205Z', filter: 'url(#ink-wash)' }),
    s('path', { class: 'g11-wash t33k-fig', d: stroke([[287, 162], [284, 182], [281, 204]], 2.4, 0.1, 0.3, 0.3) + stroke([[296, 163], [300, 184], [302, 204]], 2, 0.1, 0.3, 0.3) + stroke(curve([296, 166], [306, 172], [312, 168], 6), 2.4, 0.1, 0.3, 0.4), filter: 'url(#ink-rough)' }),
    s('circle', { class: 't33k-head', cx: 292, cy: 153, r: 5 }),
    s('path', { class: 't33k-hat', d: 'M276 152Q292 136 308 152Q292 148 276 152Z', filter: 'url(#ink-rough)' }),
    s('path', { class: 't33k-book', d: 'M281 170l10 -2 2 13 -10 2Z' }),
    s('path', { class: 't33k-pages', d: lines([[282.5, 173, 290.5, 171.5], [283, 176.5, 291, 175], [283.5, 180, 291.5, 178.5]], 0.7) }),
    s('path', { class: 'g11-wash t33k-pole', d: stroke([[311, 168], [324, 160]], 1.6, 0.1, 0.1, 0.4) }),
    paperLantern(325, 160, 6, 3303, 6))
  return s('svg', { class: 't33k-art', viewBox: '0 0 600 230', 'aria-hidden': 'true' },
    // the main house, lights out: a wall of dark shōji behind the post
    s('rect', { class: 't33k-wall', x: -40, y: 54, width: 170, height: 150 }),
    s('path', { class: 'g11-wash t33k-lat', d: lines([[-40, 100, 130, 100], [-40, 150, 130, 150], [0, 56, 0, 202], [44, 56, 44, 202], [88, 56, 88, 202]], 1.2) + lines([[-40, 125, 130, 125], [-40, 175, 130, 175], [22, 56, 22, 202], [66, 56, 66, 202], [110, 56, 110, 202]], 0.7), filter: 'url(#ink-rough)' }),
    plank(-40, 200, 186, 8, 3304),
    // the eave and its tiles, the post
    s('path', { class: 't33k-eave', d: 'M-40 26L196 40Q204 44 198 50L-40 56Z', filter: 'url(#ink-wash)' }),
    s('path', { class: 't33k-tiles', d: tiles }),
    s('path', { class: 'g11-wash t33k-ink', d: stroke([[-40, 55], [100, 52], [200, 48]], 3, 0.02, 0.1, 0.4) + stroke([[-40, 26], [196, 40]], 2.4, 0.02, 0.05, 0.4), filter: 'url(#ink-rough)' }),
    s('path', { class: 'g11-wood-face t33k-post', d: stroke([[148, 210], [147, 130], [149, 50]], 9, 0.02, 0.02, 0.85), filter: 'url(#ink-rough)' }),
    s('path', { class: 'g11-wash t33k-ink', d: stroke([[152, 208], [153, 52]], 1.8, 0.1, 0.1, 0.3) }),
    s('path', { class: 'g11-wash t33k-hook', d: stroke([[128, 50], [128, 53]], 2, 0.1, 0.1, 0.5) }),
    chime,
    // the pond: dark water, the moon's road, reeds, the stones round its edge
    ground(392, 194, 190, 18, 3305, 0.16),
    s('path', { class: 't33k-pond', d: pond, filter: 'url(#ink-wash)' }),
    s('defs', null, s('clipPath', { id: 't33k-clip' }, s('path', { d: pond }))),
    s('g', { 'clip-path': 'url(#t33k-clip)' }, water(220, 146, 566, 210, 3306, 470, false), s('ellipse', { class: 't33k-moonr', cx: 470, cy: 162, rx: 14, ry: 3.6 })),
    s('path', { class: 'g11-wash t33k-ink', d: stroke(curve([226, 178], [392, 214], [558, 178], 20), 2, 0.1, 0.1, 0.3), filter: 'url(#ink-rough)' }),
    reeds(546, 172, 34, 3307, 7),
    reeds(236, 168, 26, 3308, 5),
    steppingStones([200, 208], [380, 218], 5, 14, 3309),
    grass(176, 212, 18, 3310),
    s('path', { class: 'g11-mossy', d: blob(180, 214, 22, 4, 3311, 0.3, 10), filter: 'url(#ink-wash)' }),
    keeper)
}

/** Scene 1 — the resident keeper: send one message, watch the chime ring and the keeper write it down; then compare kinds. */
export function keeperScene(ctx: SceneCtx) {
  const reply = h('p', { class: 't33k-msg in g11-dopaper', hidden: true }, K.reply)
  const send = h('button', { class: 'g11-pill t33k-send', type: 'button', 'aria-label': K.sendAria }, K.send)
  const panel = live('t33k-panel')
  const tabs = K.kinds.map((kd, i) => h('button', { class: 'g11-pill', type: 'button', 'aria-pressed': 'false', 'aria-label': fill(K.kindAria, { name: kd.name }), onClick: () => show(i) }, kd.name))
  const kinds = h('div', { class: 't33k-kinds', hidden: true }, h('div', { class: 't33k-tabs' }, ...tabs), panel)
  const root = h('div', { class: 'g11 t33k', role: 'group', 'aria-label': K.aria },
    night(),
    h('p', { class: 'visually-hidden' }, K.art),
    porchArt(),
    h('div', { class: 't33k-chat' }, h('p', { class: 't33k-msg out g11-dopaper' }, K.message), reply, send),
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
