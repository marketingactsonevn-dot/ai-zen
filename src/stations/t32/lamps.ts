import raw from '../../content/tram-32.json'
import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { onDigit, onSize, p2Defs } from '../../ui/part2/ink'
import type { SceneCtx } from '../types'
import { blob, curve, flame, ground, live, plank, room, stroke } from '../t31/kit'

const K = raw.scenes.lamps
const f1 = (n: number) => (Math.round(n * 10) / 10).toString()

/** Three lamps (viewBox 0 0 80 110, standing on y = 104): a paper lantern with its lid open, a dish oil lamp with a wick to trim, a bare flame in a glass chimney. Lit by `.on` on the button. */
function lampArt(id: string): SVGSVGElement {
  p2Defs()
  const kids: (SVGElement | string)[] = [ground(42, 104, 30, 4, 3270, 0.3)]
  if (id === 'lmstudio') {
    const cx = 40, cy = 66, rx = 21, ry = 27
    let ribs = ''
    for (let i = 1; i < 6; i++) {
      const tt = -1 + (i * 2) / 6
      const y = cy + tt * ry * 0.92
      const hw = rx * Math.sqrt(1 - tt * tt * 0.9)
      ribs += stroke(curve([cx - hw, y], [cx, y + 2.6], [cx + hw, y], 8), 0.9, 0.15, 0.15, 0.2)
    }
    kids.push(
      s('circle', { class: 't32l-halo', cx, cy, r: 56, fill: 'url(#p2-lamp)' }),
      s('ellipse', { class: 't32l-paper', cx, cy, rx, ry, fill: 'url(#p2-lamp-body)' }),
      s('ellipse', { class: 't32l-shade', cx, cy, rx, ry }),
      flame(cx, cy - ry + 6, 0.42),
      s('path', { class: 't32l-rib', d: ribs }),
      // the bottom ring, and the lid lifted open on its hinge
      s('path', { class: 't32l-cap', d: `M${cx - 11} ${cy + ry - 2}h22v6h-22Z`, filter: 'url(#ink-rough)' }),
      // the top ring, and its lid tipped open on a hinge at the left
      s('path', { class: 't32l-cap', d: `M${cx - 9} ${cy - ry - 2}h18v4h-18Z` }),
      s('g', { transform: `rotate(-52 ${cx - 10} ${cy - ry - 2})` },
        s('ellipse', { class: 't32l-cap', cx: cx, cy: cy - ry - 3, rx: 11, ry: 3 }),
        s('path', { class: 't32l-cap', d: `M${cx - 2} ${cy - ry - 5}q2 -5 4 0Z` })),
      s('path', { class: 'g11-wash t32l-ink', d: stroke([[cx, cy + ry + 4], [cx + 0.6, 103]], 2, 0.1, 0.1, 0.4) }))
  } else if (id === 'ollama') {
    // a glazed dish on a short stand, the wick lying over its lip, a pick to trim it
    const dish = `M10 76Q14 90 38 91Q60 90 66 78L74 74Q70 72 64 74Q40 79 12 73Q9 73 10 76Z`
    kids.push(
      s('circle', { class: 't32l-halo', cx: 66, cy: 62, r: 50, fill: 'url(#p2-lamp)' }),
      s('path', { class: 't32l-glaze', d: `M28 91L24 103H52L48 91Z`, filter: 'url(#ink-rough)' }),
      s('path', { class: 't32l-glaze', d: dish, filter: 'url(#ink-rough)' }),
      s('path', { d: dish, fill: 'url(#p2-shade)' }),
      s('path', { class: 't32l-oil', d: `M16 75Q40 79 62 75Q40 82 16 75Z` }),
      s('path', { class: 'g11-moonlit', d: stroke([[14, 78], [24, 86], [36, 88]], 1.6, 0.2, 0.3, 0.2) }),
      s('path', { class: 'g11-wash t32l-wick', d: stroke(curve([44, 77], [60, 72], [69, 70], 8), 2.4, 0.1, 0.2, 0.4) }),
      flame(70, 70, 0.62),
      s('path', { class: 'g11-wash t32l-ink', d: stroke([[10, 76], [38, 91.5], [66, 78], [74, 74]], 1.6, 0.1, 0.1, 0.3) + stroke([[24, 103], [52, 103]], 1.8, 0.1, 0.1, 0.3), filter: 'url(#ink-rough)' }),
      s('path', { class: 'g11-wash t32l-pick', d: stroke([[4, 102], [18, 84]], 1.3, 0.05, 0.4, 0.3) }))
  } else {
    // a bare flame inside a glass chimney on a brass foot
    const glass = `M30 26C28 46 20 56 21 72C22 88 58 88 59 72C60 56 52 46 50 26Z`
    kids.push(
      s('circle', { class: 't32l-halo', cx: 40, cy: 62, r: 54, fill: 'url(#p2-lamp)' }),
      flame(40, 76, 1.05),
      s('path', { class: 't32l-glass', d: glass }),
      s('path', { class: 'g11-wash t32l-ink', d: stroke([[30, 26], [27, 46], [21, 64], [22, 80], [30, 86]], 1.4, 0.1, 0.2, 0.3) + stroke([[50, 26], [53, 46], [59, 64], [58, 80], [50, 86]], 1.6, 0.1, 0.2, 0.3) + stroke([[29, 26], [51, 26]], 1.4, 0.1, 0.1, 0.4), filter: 'url(#ink-rough)' }),
      s('path', { class: 't32l-glint', d: stroke([[27, 52], [24, 66], [26, 78]], 2, 0.2, 0.3, 0.2) + stroke([[47, 34], [49, 46]], 1.4, 0.2, 0.3, 0.2) }),
      s('path', { class: 't32l-brass', d: `M24 86Q40 92 56 86L58 92Q40 97 22 92ZM30 94h20l3 10H27Z`, filter: 'url(#ink-rough)' }),
      s('path', { class: 'g11-wash t32l-ink', d: stroke([[27, 104], [53, 104]], 1.8, 0.1, 0.1, 0.3) }))
  }
  return s('svg', { class: 't32l-svg', viewBox: '0 0 80 110', 'aria-hidden': 'true' }, ...kids)
}

/** The wooden shelf the lamps stand on (px W): plank, two brackets, a shadow on the wall. */
function paintShelf(svg: SVGSVGElement, W: number) {
  svg.setAttribute('viewBox', `0 0 ${f1(W)} 40`)
  const br = (x: number) => stroke(curve([x, 10], [x - 2, 26], [x + 14, 34], 8), 4, 0.05, 0.3, 0.4)
  svg.replaceChildren(
    s('path', { class: 't32l-wallsh', d: blob(W / 2, 22, W * 0.5, 12, 3271, 0.1, 16), filter: 'url(#ink-wash)' }),
    s('path', { class: 'g11-wood-face t32l-bracket', d: br(W * 0.12) + br(W * 0.84), filter: 'url(#ink-rough)' }),
    plank(-6, 0, W + 12, 10, 3272))
}

/** Scene 3 — three lamps on a shelf: LM Studio, Ollama, llama.cpp. Light each to read what it is and who it suits. */
export function lampsScene(ctx: SceneCtx) {
  const lit = new Set<string>()
  const panel = live('t32l-panel')
  const lamps = K.lamps.map((lp) => h('button', { class: 't32l-lamp', type: 'button', 'aria-pressed': 'false', 'aria-label': fill(K.lampAria, { name: lp.name }), onClick: () => light(lp.id) },
    lampArt(lp.id), h('span', { class: 't32l-name' }, lp.name), h('span', { class: 't32l-kind' }, lp.kind)))
  const shelfArt = s('svg', { class: 't32l-plank', 'aria-hidden': 'true' })
  const shelf = h('div', { class: 't32l-shelf' }, ...lamps, shelfArt)
  const root = h('div', { class: 'g11 t32l', role: 'group', 'aria-label': K.aria },
    room(3280),
    h('p', { class: 'visually-hidden' }, K.art),
    shelf,
    panel,
    h('p', { class: 't32l-change' }, K.changeNote))
  ctx.art.append(root)
  ctx.onCleanup(onSize(shelf, () => paintShelf(shelfArt, shelf.clientWidth)))

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
