import { fill, h, nextId, s } from '../../core/dom'
import { blob, curve, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist, moon, reeds, toro, wash, water } from '../../ui/part2/paint'
import { findTakeaway, takeaway } from '../../ui/part2/takeaway'
import type { SceneCtx } from '../types'
import { C, shell } from './shell'
import { along, fog, leafCloud, leafD, lines, mossBed, rakeD, rakeRings, stonesOn } from './sumi'

const K = C.scenes.goal

/** The paper gardener: folded facets, a brushed outline, shears in the right hand. Feet at (x, y). */
export function paperMan(x: number, y: number, k = 1, shears = true): SVGGElement {
  const P = (dx: number, dy: number): Pt => [x + dx * k, y + dy * k]
  const poly = (...p: Pt[]) => `M${p.map(([a, b]) => `${a.toFixed(1)} ${b.toFixed(1)}`).join('L')}Z`
  const light = poly(P(0, -34), P(-5, -29), P(0, -24)) + poly(P(-8, -21), P(0, -22), P(0, 0), P(-12, 0)) + poly(P(-8, -21), P(-13, -10), P(-10, -9))
  const shade = poly(P(0, -34), P(5, -29), P(0, -24)) + poly(P(0, -22), P(8, -21), P(12, 0), P(0, 0)) + poly(P(8, -21), P(15, -12), P(12, -10))
  const edge = stroke([P(0, -34), P(-5, -29), P(0, -24), P(5, -29), P(0, -34)], 0.9 * k, 0.1, 0.1, 0.5) +
    stroke([P(-8, -21), P(-12, 0), P(12, 0), P(8, -21)], 1.1 * k, 0.05, 0.1, 0.5) + stroke([P(0, -22), P(0, 0)], 0.7 * k, 0.1, 0.2, 0.3) +
    stroke([P(-8, -21), P(-13, -10)], 0.9 * k, 0.1, 0.3, 0.3) + stroke([P(8, -21), P(15, -12)], 0.9 * k, 0.1, 0.3, 0.3) +
    lines([[x - 5 * k, y, x - 6 * k, y + 2 * k], [x + 5 * k, y, x + 6 * k, y + 2 * k]], 1.2 * k)
  const tool = shears
    ? stroke([P(15, -12), P(21, -22), P(25, -29)], 1.3 * k, 0.05, 0.7, 0.2) + stroke([P(15, -12), P(23, -20), P(28, -24)], 1.2 * k, 0.05, 0.7, 0.2) +
      stroke(curve(P(15, -12), P(11, -7), P(15, -6), 5), 0.9 * k, 0.2, 0.2, 0.4) + stroke(curve(P(15, -12), P(19, -6), P(17, -5), 5), 0.9 * k, 0.2, 0.2, 0.4)
    : ''
  return s('g', { class: 'g13-paper' },
    s('ellipse', { class: 'p2p-contact', cx: (x + 2 * k).toFixed(1), cy: (y + 1).toFixed(1), rx: (14 * k).toFixed(1), ry: (2.6 * k).toFixed(1) }),
    s('path', { class: 'g13-fold-a', d: light }),
    s('path', { class: 'g13-fold-b', d: shade }),
    s('path', { class: 'g13-ink', d: edge, filter: 'url(#ink-rough)' }),
    tool ? s('path', { class: 'g13-shears', d: tool }) : null)
}

function art(svg: SVGGElement) {
  const pid = nextId('t37p')
  const pond = blob(320, 230, 68, 16, 4, 0.06)
  // the stone path from the viewer up to the lantern, curving under the maple
  const way = along(curve([178, 262], [118, 232], [150, 211], 16).concat(curve([150, 211], [190, 200], [238, 196], 10).slice(1)), 8)
  // the maple: brushed trunk and limbs, red ink dabs gathered at the tips
  const limbs =
    stroke(curve([86, 218], [78, 172], [98, 122], 16), 8, 0.02, 0.45, 0.32) +
    stroke(curve([92, 152], [70, 130], [46, 120], 10), 3.4, 0.05, 0.6, 0.2) +
    stroke(curve([96, 134], [122, 120], [148, 113], 10), 3.1, 0.05, 0.6, 0.2) +
    stroke(curve([98, 124], [106, 102], [96, 84], 10), 2.6, 0.05, 0.6, 0.2) +
    stroke(curve([90, 142], [72, 112], [66, 94], 10), 2.2, 0.05, 0.6, 0.2) +
    lines([[58, 122, 52, 108], [130, 117, 138, 101], [104, 98, 118, 88], [70, 104, 80, 92], [46, 120, 36, 116], [148, 113, 158, 116]], 1.2, 0.1, 0.5)
  const crowns: [number, number, number, number, number][] = [[50, 112, 22, 11, 16], [80, 96, 26, 13, 20], [106, 84, 24, 11, 18], [134, 104, 24, 11, 18], [152, 114, 13, 7, 7], [72, 122, 16, 7, 9]]
  const canopy = crowns.map(([x, y, rx, ry, n], i) => leafCloud(x, y, rx, ry, Math.round(n * 1.8), 3.3, 3700 + i)).join('')
  const far = crowns.map(([x, y, rx, ry, n], i) => leafCloud(x - 3, y - 3, rx * 1.2, ry * 1.25, n, 3.6, 3730 + i)).join('')
  const dark = crowns.map(([x, y, rx, ry, n], i) => leafCloud(x + 2, y + 4, rx * 0.8, ry * 0.7, Math.round(n * 0.7), 3, 3720 + i)).join('')
  const fallen = way.map(([x, y], i) => leafCloud(x, y, 17 - i, 6 - i * 0.3, 13 - i, 2.8 - i * 0.14, 3740 + i)).join('') +
    leafCloud(118, 236, 36, 11, 16, 2.6, 3750) + leafCloud(212, 212, 28, 7, 9, 2.2, 3751) + leafCloud(96, 222, 30, 6, 10, 2.5, 3752)
  // the dozing gardener: a robed mound against the lantern, arm over his knees, the straw hat tipped over his face
  const X = (x: number) => 271 + x * 1.25, Y = (y: number) => 194 + y * 1.25
  const pt = (q: number[][]) => q.map(([a, b]) => [X(a), Y(b)] as Pt)
  const dz = (d: string) => d.replace(/(-?[\d.]+) (-?[\d.]+)/g, (_, a: string, b: string) => `${X(+a).toFixed(1)} ${Y(+b).toFixed(1)}`)
  const dozer = s('g', { class: 't37g-dozer' },
    s('ellipse', { class: 'p2p-contact', cx: X(3), cy: Y(0.4), rx: 17, ry: 2.2 }),
    s('path', { class: 't37g-robe', d: dz('M-10 0Q-12 -14 -6 -21Q0 -25 6 -22Q12 -17 12 -8Q13 -2 15 0Z'), filter: 'url(#ink-wash)' }),
    s('path', { class: 'g13-ink', d:
      stroke(pt([[-9.5, 0], [-11.5, -12], [-6, -20.5]]), 2.6, 0.05, 0.3, 0.35) +
      stroke(pt([[-5, -17], [3, -11.5], [10.5, -14]]), 1.9, 0.1, 0.25, 0.35) +
      stroke(pt([[11, -12], [12.5, -5], [14.5, -0.5]]), 1.4, 0.15, 0.3, 0.35) +
      stroke(pt([[-8, -0.6], [3, -0.2], [14, -0.6]]), 1, 0.2, 0.2, 0.3), filter: 'url(#ink-rough)' }),
    s('path', { class: 'g13-ink', d: blob(X(15), Y(-0.6), 2.6, 1.3, 377, 0.2, 8) + blob(X(10.8), Y(-13.6), 1.9, 1.5, 378, 0.2, 8) }),
    s('path', { class: 't37g-hat', d: dz('M-11.5 -19.5Q1 -25.5 13.5 -23.5L13 -21.8Q1 -22.5 -11 -17.8ZM-6.5 -20.8Q-1.5 -28.8 1 -30Q4 -28.5 8.5 -23Z'), filter: 'url(#ink-rough)' }),
    s('path', { class: 't37g-hat-rib', d: lines([[X(0.8), Y(-29), X(-3.5), Y(-21.5)], [X(1.4), Y(-29), X(5), Y(-22.8)]], 0.6) }))
  const broom = s('path', { class: 'g13-ink', d: stroke([[236, 156], [231, 186]], 1.2, 0.1, 0.1, 0.5) + Array.from({ length: 6 }, (_, i) => stroke(curve([231.3, 184], [229.5 + i * 1.2, 190], [228 + i * 1.8, 195.5], 4), 0.7, 0.1, 0.5, 0.3)).join('') })
  const ripples = [6, 10, 15].map((r) => stroke(curve([346 - r, 232], [346, 232 + r * 0.32], [346 + r, 232], 8), 0.7, 0.3, 0.3, 0.1)).join('')
  svg.append(
    mist(200, 96, 300, 86),
    moon(318, 50, 15, 37, true),
    hills(-30, 430, 150, 70, 371, 0.9, 6),
    hills(220, 440, 160, 50, 372, 0.6, 2),
    hills(-40, 150, 162, 42, 373, 0.66, 2),
    mist(200, 160, 270, 20),
    s('path', { class: 'g13-rake', d: rakeD(-10, 410, 172, 262, 8.5, 374, 2.5) }),
    s('g', { class: 't37g-moss' }, ...([[84, 222, 42, 9], [124, 248, 28, 6], [222, 210, 30, 5], [300, 250, 40, 7], [168, 227, 16, 4]] as const).map(([x, y, rx, ry]) => mossBed(x, y, rx, ry, x * 7 + y))),
    s('g', { class: 't37g-pond' },
      s('clipPath', { id: pid }, s('path', { d: pond })),
      s('path', { class: 'g13-water', d: pond, filter: 'url(#ink-wash)' }),
      s('g', { 'clip-path': `url(#${pid})` }, fog(318, 216, 72, 6), water(250, 213, 390, 248, 375, 318, false), s('ellipse', { class: 't37g-refl', cx: 318, cy: 219, rx: 8, ry: 2.2 })),
      s('path', { class: 'g13-rim', d: stroke(curve([254, 232], [320, 256], [388, 230], 18), 1.8, 0.15, 0.2, 0.2), filter: 'url(#ink-rough)' })),
    reeds(388, 232, 30, 376, 7),
    grass(254, 236, 14, 377),
    stonesOn(way, (i) => 16 - i * 1.25, 378),
    s('g', { class: 't37g-stump' },
      s('path', { class: 'g13-rake', d: rakeRings(87, 220, 13, 34, 6, 0.3, 379, 1) }),
      s('path', { class: 'g13-ink', d: stroke([[87, 221], [88, 205]], 10, 0, 0, 1) + lines([[78, 222, 82, 218], [95, 221, 99, 223], [100, 214, 104, 213]], 1.4), filter: 'url(#ink-rough)' }),
      s('ellipse', { class: 't37g-cut', cx: 88, cy: 205, rx: 5.4, ry: 1.9 }),
      s('path', { class: 't37g-chips', d: lines([[70, 226, 74, 225], [104, 228, 108, 229], [96, 232, 99, 231], [66, 218, 69, 219]], 1.2) })),
    s('g', { class: 't37g-tree' },
      wash(blob(86, 220, 26, 5, 380, 0.2), 0.25),
      ...crowns.map(([x, y, rx, ry], i) => wash(blob(x, y, rx * 1.15, ry * 1.25, 3760 + i, 0.25), 0.14, 'p2p-wash g13-leaf-wash')),
      s('path', { class: 't37g-leaf-far', d: far }),
      s('path', { class: 'g13-ink t37g-trunk', d: limbs, filter: 'url(#ink-rough)' }),
      s('path', { class: 't37g-leaf-dk', d: dark }),
      s('path', { class: 'g13-leaf', d: canopy })),
    s('g', { class: 't37g-leaves' }, s('path', { class: 'g13-leaf', d: fallen })),
    broom,
    toro(250, 193, 46, true),
    dozer,
    s('g', { class: 't37g-move' }, paperMan(198, 199, 1.1)),
    s('path', { class: 't37g-ask', d: Array.from({ length: 8 }, (_, i) => {
      const t = (i + 0.5) / 8, x = 214 + 52 * t, y = 172 - Math.sin(t * Math.PI) * 26 - t * 4
      return blob(x, y, 1.7, 1.4, 3790 + i, 0.15, 8)
    }).join('') }),
    s('g', { class: 't37g-drift' }, s('path', { class: 'p2p-ripple', d: ripples }), s('path', { class: 'g13-leaf', d: leafD(346, 230, 3.4, 40) })),
    s('g', { transform: 'translate(236 258)' }, stoneArt(30, 17, 381)),
    s('g', { transform: 'translate(26 254)' }, stoneArt(24, 14, 382)),
    grass(218, 260, 16, 383),
    grass(48, 252, 14, 384))
}

/** Scene 1 — word the order three ways; the paper gardener does exactly what the words say. */
export function goalScene(ctx: SceneCtx) {
  const { root, svg, panel } = shell(ctx, 't37g', K.art, [K.insight], '0 30 400 236')
  art(svg)
  const card = findTakeaway(C.takeaways[0])
  const result = h('div', { class: 't37-result', hidden: true })
  let live = false
  const btns = K.options.map((o) =>
    h('button', { class: 't37-opt', type: 'button', 'aria-pressed': 'false', 'aria-label': fill(K.optionAria, { say: o.say }), onClick: () => pick(o.id) }, o.say))
  const retry = h('button', { class: 'btn ghost t37-retry', type: 'button', onClick: reset }, K.retry)
  panel.append(h('div', { class: 't37-opts', role: 'group', 'aria-label': K.group }, ...btns), result)
  let told = false

  function pick(id: string) {
    const o = K.options.find((x) => x.id === id)!
    root.dataset.state = id
    btns.forEach((b, i) => b.setAttribute('aria-pressed', String(K.options[i].id === id)))
    result.hidden = false
    result.dataset.ok = String(o.ok)
    result.replaceChildren(h('p', { class: 'p2-eyebrow' }, K.morning), h('p', { class: 't37-res-text' }, o.result), ...(o.ok && card ? [takeaway(card, null, ctx.onCleanup)] : []), retry)
    if (!live) (result.setAttribute('aria-live', 'polite'), (live = true))
    if (!told) (ctx.insight(K.insight, K.detail), (told = true))
  }
  function reset() {
    delete root.dataset.state
    btns.forEach((b) => b.setAttribute('aria-pressed', 'false'))
    result.hidden = true
    btns[0].focus()
  }
  ctx.prompt(K.prompt)
}
