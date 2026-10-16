import { fill, h, s } from '../../core/dom'
import { blob, curve, rng, stroke, type Pt } from '../../ui/part2/ink'
import { moon, water } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import { C } from './content'
import { F, f1, gdefs, ink, wood, woodG } from '../t34/night'
import { koi } from './koi'

const K = C.scenes.pens
type Draw = () => SVGElement[]

const ell = (cx: number, cy: number, rx: number, ry: number, a0 = 0, a1 = Math.PI * 2, n = 32) =>
  Array.from({ length: n + 1 }, (_, i) => { const t = a0 + ((a1 - a0) * i) / n; return [cx + Math.cos(t) * rx, cy + Math.sin(t) * ry] as Pt })

/** The same koi pond, painted with five pens (viewBox 240 × 160). */
const PAINT: Record<string, Draw> = {
  // charcoal: thin, searching outlines, a little hatching
  canvas: () => {
    const r = rng(11)
    let d = ''
    for (let k = 0; k < 3; k++) d += stroke(ell(120 + (r() - 0.5) * 3, 92 + (r() - 0.5) * 2, 92 + (r() - 0.5) * 4, 50 + (r() - 0.5) * 3, r(), r() + 5.6), 0.9, 0.1, 0.1, 0.3)
    d += stroke(ell(190, 32, 13, 13, 0, 6.3, 20), 0.9, 0.1, 0.1, 0.3)
    for (let k = 0; k < 9; k++) d += stroke([[52 + k * 6, 128 - k * 0.6], [60 + k * 6, 118 - k * 0.6]], 0.7, 0.2, 0.2, 0.3)
    const fish = stroke([[96, 92], [112, 84], [132, 86], [146, 92], [132, 99], [112, 99], [96, 92]], 0.9, 0.05, 0.05, 0.5) + stroke([[146, 92], [158, 84], [156, 100], [146, 92]], 0.9, 0.05, 0.05, 0.5)
    return [ink(d, 't36p-charcoal', 'dry'), ink(fish, 't36p-red-line', 'dry')]
  },
  // p5: loose washes of colour, splashes, the koi in two strokes
  p5: () => {
    const r = rng(5)
    const blots = Array.from({ length: 14 }, (_, i) => ink(blob(40 + r() * 160, 52 + r() * 84, 8 + r() * 18, 6 + r() * 12, 50 + i, 0.3, 12), `t36p-blot ${['water', 'moss', 'water', 'lantern'][i % 4]}`, 'wash'))
    let dots = ''
    for (let i = 0; i < 22; i++) dots += blob(30 + r() * 180, 30 + r() * 110, 1 + r() * 2, 1 + r() * 2, 70 + i, 0.3, 6)
    return [...blots, ink(dots, 't36p-blot moss', 'rough'),
      ink(blob(188, 32, 18, 18, 80, 0.12, 12), 't36p-blot moon', 'wash'),
      ink(stroke(curve([90, 98], [118, 76], [150, 90], 10), 14, 0.3, 0.6, 0.2) + stroke([[150, 90], [164, 80]], 7, 0.2, 0.6, 0.2) + stroke([[150, 90], [162, 102]], 7, 0.2, 0.6, 0.2), 't36p-red', 'wash')]
  },
  // phaser: the pond laid out on tiles like a board, sprites in square blocks
  phaser: () => {
    const out: SVGElement[] = []
    let tiles = '', grid = ''
    for (let y = 40; y < 150; y += 12) for (let x = 24; x < 216; x += 12) {
      const dx = (x + 6 - 120) / 92, dy = (y + 6 - 92) / 50
      if (dx * dx + dy * dy < 1) tiles += `M${x + 1} ${y + 1}h10v10h-10Z`
    }
    for (let x = 24; x <= 216; x += 12) grid += stroke([[x, 38], [x, 150]], 0.5, 0.1, 0.1, 0.5)
    for (let y = 40; y <= 148; y += 12) grid += stroke([[22, y], [218, y]], 0.5, 0.1, 0.1, 0.5)
    out.push(ink(tiles, 't36p-tile', 'rough'), ink(grid, 't36p-grid'))
    let fish = '', mn = ''
    for (const [x, y] of [[100, 88], [112, 88], [124, 88], [136, 88], [112, 76], [124, 100], [88, 88], [148, 80], [148, 96]]) fish += `M${x + 1} ${y + 1}h10v10h-10Z`
    for (const [x, y] of [[184, 16], [196, 16], [184, 28], [196, 28]]) mn += `M${x + 1} ${y + 1}h10v10h-10Z`
    out.push(ink(fish, 't36p-red', 'rough'), ink(mn, 't36p-moonblock', 'rough'))
    return out
  },
  // three: depth — a floor in perspective, the koi lit from the moon with its shadow on the pond bed
  three: () => {
    let floor = ''
    for (let i = 0; i < 7; i++) floor += stroke([[120 + (i - 3) * 14, 40], [120 + (i - 3) * 52, 158]], 0.7, 0.1, 0.1, 0.4)
    for (const [y, k] of [[56, 0], [78, 1], [108, 2], [148, 3]] as const) floor += stroke([[64 - k * 22, y], [176 + k * 22, y]], 0.7, 0.1, 0.1, 0.4)
    return [
      ink(floor, 't36p-perspective'),
      s('ellipse', { class: 't36p-depth', cx: 120, cy: 100, rx: 80, ry: 32 }),
      s('circle', { cx: 196, cy: 30, r: 34, fill: 'url(#p2-halo)' }),
      s('circle', { class: 't36p-moon', cx: 196, cy: 30, r: 10 }),
      s('path', { class: 't36p-beam', d: 'M188 36L204 36L150 112L104 112Z' }),
      ink(blob(126, 112, 30, 6, 90, 0.2), 'p2p-wash t36p-shadow', 'wash'),
      koi(102, 96, 52, Math.PI + 0.12, 3602, 0.12),
    ]
  },
  // engine: the big framed piece — water, the moon and its road, two koi, lily pads, a heavy wooden frame
  engine: () => [
    s('rect', { class: 't36p-bg', x: 10, y: 10, width: 220, height: 140 }),
    water(12, 60, 228, 150, 3603, 168),
    s('circle', { cx: 168, cy: 34, r: 40, fill: 'url(#p2-halo)' }),
    moon(168, 34, 13, 3604, true),
    ink(blob(64, 120, 12, 5, 91, 0.2, 10) + blob(84, 132, 8, 3.5, 92, 0.2, 10), 't36p-pad', 'wash'),
    koi(92, 98, 46, 0.3, 3605),
    koi(150, 122, 34, Math.PI - 0.4, 3606),
    woodG([wood([4, 6], [236, 6], 9, 3607), wood([4, 154], [236, 154], 9, 3608), wood([6, 4], [6, 156], 9, 3609), wood([234, 4], [234, 156], 9, 3610)], 't36p-frame-wood'),
  ],
}

/** A pen standing in the pot (viewBox 30 × 220, tip up): charcoal, a wet brush, a flat brush, a fine pen, a big brush. */
function pen(id: string): SVGSVGElement {
  const shaft = (w: number, y0: number, cls: string, nodes = false) => [
    ink(stroke([[15, y0], [15.4, 130], [15, 220]], w, 0.01, 0.01, 0.9), cls, 'rough'),
    nodes ? ink(stroke([[15 - w * 0.6, 120], [15 + w * 0.6, 120.5]], 1.4, 0.1, 0.1, 0.5) + stroke([[15 - w * 0.6, 170], [15 + w * 0.6, 170.5]], 1.4, 0.1, 0.1, 0.5), 'g12-edge') : null,
    ink(stroke([[15 - w * 0.28, y0 + 6], [15 - w * 0.25, 200]], Math.max(0.8, w * 0.16), 0.1, 0.2, 0.2), 'g12-rim'),
  ].filter(Boolean) as SVGElement[]
  const tip = (w: number, len: number, cls: string) => ink(`M15 0Q${f1(15 + w * 0.7)} ${f1(len * 0.55)} ${f1(15 + w / 2)} ${f1(len)}L${f1(15 - w / 2)} ${f1(len)}Q${f1(15 - w * 0.7)} ${f1(len * 0.55)} 15 0Z`, cls, 'rough')
  const ferrule = (w: number, y: number, hh: number) => ink(`M${f1(15 - w / 2)} ${f1(y)}h${f1(w)}v${f1(hh)}h${f1(-w)}Z`, 't36p-ferrule', 'rough')
  const parts: Record<string, SVGElement[]> = {
    canvas: [...shaft(7, 10, 't36p-coal'), ink('M11.5 10L15 3L18.5 8Z', 't36p-coal', 'rough')],
    p5: [...shaft(6, 46, 't36p-bamboo', true), ferrule(7.5, 40, 9), tip(10, 42, 't36p-hair')],
    phaser: [...shaft(6, 40, 't36p-lacquer'), ferrule(12, 30, 12), ink('M9 2L21 2L21 32L9 32Z', 't36p-hair', 'rough')],
    three: [...shaft(5, 26, 't36p-metal'), ink('M12.5 26L15 0L17.5 26Z', 't36p-metal', 'rough')],
    engine: [...shaft(10, 60, 't36p-bamboo gold', true), ferrule(12, 52, 12), tip(18, 54, 't36p-hair')],
  }
  return s('svg', { class: 't36p-shaft', viewBox: '0 0 30 220', preserveAspectRatio: 'xMidYMax meet', 'aria-hidden': 'true' }, ...parts[id])
}

/** Scene 2 — a bamboo pen pot: the same koi pond drawn five times, once per pen (canvas, p5, Phaser, Three.js, engine). */
export function pensScene(ctx: SceneCtx) {
  gdefs()
  const seen = new Set<number>()
  const sources = C.sources as Record<string, { url?: string }>
  const canvas = s('svg', { class: 't36p-art', viewBox: '0 0 240 160', 'aria-hidden': 'true' })
  const layer = s('g')
  canvas.append(layer)
  const card = h('div', { class: 't36p-card', 'aria-live': 'polite' })
  const pens = K.pens.map((p, i) =>
    h('button', { class: `t36p-pen t36p-${p.id}`, type: 'button', 'aria-pressed': 'false', 'aria-label': fill(K.penAria, { name: p.name }), onClick: () => pick(i) },
      pen(p.id), h('span', { class: 't36p-name' }, p.name)))
  // the bamboo pot the pens stand in (drawn over their feet)
  const pot = s('svg', { class: 't36p-potart', viewBox: '0 0 200 90', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    s('ellipse', { class: 'g12-contact', cx: 104, cy: 86, rx: 104, ry: 5 }),
    ink('M6 12Q100 22 194 12L190 84Q100 92 10 84Z', 't36p-pot-body', 'rough'),
    ink(stroke([[8, 40], [100, 46], [192, 40]], 2.6, 0.05, 0.05, 0.5) + stroke([[9, 44], [100, 50], [191, 44]], 1.2, 0.05, 0.05, 0.5) + stroke([[10, 12], [8, 50], [10, 84]], 3, 0.1, 0.1, 0.4) + stroke([[190, 12], [192, 50], [190, 84]], 4.4, 0.1, 0.1, 0.4), 'g12-edge', 'rough'),
    ink([40, 70, 120, 150].map((x) => stroke([[x, 18], [x + 1, 38]], 0.8, 0.3, 0.3, 0.1) + stroke([[x + 6, 54], [x + 7, 80]], 0.8, 0.3, 0.3, 0.1)).join(''), 'g12-wood-grain', 'dry'),
    ink(stroke([[24, 18], [22, 50], [24, 80]], 3, 0.2, 0.3, 0.1), 'g12-rim'),
    s('ellipse', { class: 't36p-pot-mouth', cx: 100, cy: 12, rx: 94, ry: 6 }))
  const root = h('div', { class: 't36 t36p' }, h('p', { class: 'visually-hidden' }, K.art),
    h('div', { class: 't36p-pot', role: 'group', 'aria-label': K.group }, ...pens, pot),
    h('div', { class: 't36p-frame g12-paper big' }, canvas),
    card)
  ctx.art.append(root)
  ctx.prompt(K.prompt)
  layer.append(...PAINT.canvas().map((el) => (el.setAttribute('opacity', '0.4'), el)))

  function pick(i: number) {
    const p = K.pens[i]
    seen.add(i)
    pens.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)))
    layer.replaceChildren(...PAINT[p.id]())
    layer.classList.remove('in')
    void canvas.getBoundingClientRect()
    layer.classList.add('in')
    ctx.chime('tap')
    const url = sources[p.source]?.url
    card.replaceChildren(
      h('h3', { class: 't36p-title' }, p.name),
      h('p', null, h('span', { class: 'p2-eyebrow' }, K.fitsLabel), h('br'), p.fits),
      h('p', null, h('span', { class: 'p2-eyebrow' }, K.askLabel), h('br'), h('q', { class: 't36p-ask' }, p.ask.replace(/^[“"]|[”"]$/g, ''))),
      p.id === 'phaser' ? ctx.fact(F(K.facts[0]), 'p', 't36p-fact') : '',
      url ? h('a', { class: 't36p-docs', href: url, target: '_blank', rel: 'noopener' }, K.docsLabel) : '')
    if (seen.size === K.pens.length) ctx.insight(F(K.insight), K.detail)
  }
}
