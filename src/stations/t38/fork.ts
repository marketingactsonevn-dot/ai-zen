import { fill, h, nextId, s } from '../../core/dom'
import { blob, curve, rng, stroke } from '../../ui/part2/ink'
import type { SceneCtx } from '../types'
import { C, moon, shell } from './shell'

const K = C.scenes.fork
type Id = 'speed' | 'share' | 'control'
const lv = (v: number) => (v < 34 ? 'low' : v > 66 ? 'high' : 'mid')
const GX = 200, GY = 112

/** The five gardens that can wait at the end of the path (one shows at a time). */
function gardens() {
  const r = rng(38)
  const g = (id: string, ...kids: SVGElement[]) => s('g', { class: 't38f-garden', 'data-id': id }, ...kids)
  const wild = Array.from({ length: 34 }, () => {
    const x = GX - 86 + r() * 172, y = GY + 26 - r() * 8
    return s('path', { class: r() > 0.4 ? 'grass' : 'ink', d: stroke(curve([x, y], [x + (r() - 0.5) * 30, y - 20 - r() * 16], [x + (r() - 0.5) * 50, y - 34 - r() * 26]), 2.2 + r() * 2) })
  })
  const trees = [GX - 62, GX - 26, GX + 26, GX + 62].map((x, i) => s('path', { class: 'tree', d: blob(x, GY + 4 - (i % 2) * 6, 15, 13, x, 0.1) }))
  const commons = [
    ...trees,
    s('path', { class: 'rail', d: `M${GX - 96} ${GY + 26}h82M${GX + 14} ${GY + 26}h82M${GX - 96} ${GY + 20}h82M${GX + 14} ${GY + 20}h82` }),
    s('path', { class: 'post', d: `M${GX - 14} ${GY + 30}v-26M${GX + 14} ${GY + 30}v-26M${GX - 18} ${GY + 4}h36` }),
  ]
  const walled = [
    s('path', { class: 'tree', d: blob(GX + 20, GY - 22, 22, 16, 5, 0.1) }),
    s('rect', { class: 'wall', x: GX - 80, y: GY - 14, width: 160, height: 42 }),
    s('path', { class: 'roof', d: `M${GX - 86} ${GY - 14}h172l-6 -7h-160z` }),
  ]
  const terraces = Array.from({ length: 5 }, (_, i) => s('path', { class: 'terrace', d: stroke(curve([GX - 92 + i * 10, GY + 26 - i * 11], [GX, GY + 20 - i * 11], [GX + 92 - i * 10, GY + 26 - i * 11]), 4, 0.1, 0.1, 0.5) }))
  const drift = [GX - 40, GX + 16, GX - 6, GX + 40].map((x, i) => s('path', { class: 'fog', d: stroke([[x - 54, GY + 22 - i * 9], [x + 54, GY + 20 - i * 9]], 2.4, 0.4, 0.4, 0.1) }))
  return [g('wild', ...wild), g('commons', ...commons), g('walled', ...walled), g('terraces', ...terraces), g('drift', ...drift)]
}

/** A bamboo well-sweep lever beside the path; its arm tilts with the slider. */
const lever = (x: number, y: number) => {
  const arm = s('g', { class: 't38f-arm', style: `transform-origin:${x}px ${y - 40}px` },
    s('path', { class: 'bamboo', d: stroke([[x - 34, y - 40], [x + 34, y - 40]], 3.4, 0.05, 0.05, 0.7) }),
    s('circle', { class: 'weight', cx: x - 34, cy: y - 40, r: 4 }))
  return { arm, el: s('g', null, s('path', { class: 'bamboo', d: stroke([[x, y], [x, y - 42]], 3, 0.05, 0.05, 0.8) }), arm) }
}

/** Scene 3 — three levers by a three-way fork in the mist; the garden at the end of the path changes with them. */
export function forkScene(ctx: SceneCtx) {
  const { root, svg, panel } = shell(ctx, 't38f', K.art, [K.insight], '20 40 360 260')
  const hills = s('path', { class: 't38f-hills', d: 'M0 150q60 -26 110 -6t100 -10t100 4t100 -4V160H0z' })
  // stepping stones: one way up from the viewer, splitting into three that shrink into the mist
  const paths = s('g', { class: 't38f-paths' })
  const ways = [curve([200, 298], [196, 252], [200, 218], 7), ...[[124, 156], [200, 150], [276, 156]].map(([x, y]) => curve([200, 210], [(x + 200) / 2, 192], [x, y], 6))]
  ways.forEach((w, wi) => w.forEach(([x, y], i) => {
    const k = wi ? 0.75 - i * 0.1 : 1.25 - i * 0.07
    if (wi && i === 0) return
    paths.append(s('path', { d: blob(x, y, 11 * k, 3.6 * k, wi * 9 + i, 0.12) }))
  }))
  const dawnId = nextId('t38dawn')
  const stop = (o: number, a: number) => s('stop', { offset: o, style: `stop-color:var(--dawn);stop-opacity:${a}` })
  const gs = gardens()
  const levers = [lever(118, 286), lever(286, 276), lever(330, 296)]
  svg.append(s('defs', null, s('radialGradient', { id: dawnId, cx: 0.5, cy: 0.95, r: 0.75 }, stop(0, 1), stop(1, 0))),
    s('rect', { x: 20, y: 40, width: 360, height: 120, fill: `url(#${dawnId})` }), moon(70, 146, 13), hills, paths, ...gs,
    s('ellipse', { class: 't38f-mist', cx: 200, cy: 152, rx: 210, ry: 10 }), ...levers.map((l) => l.el))

  const vals: Record<Id, number> = { speed: 50, share: 50, control: 50 }
  const name = h('h3', { class: 't38f-name' })
  const text = h('p', { class: 't38f-text' })
  const card = h('div', { class: 't38f-card' }, name, text, ctx.fact(K.note, 'p', 't38f-note'))
  let live = false
  let told = false
  const inputs = K.sliders.map((sl, i) => {
    const input = h('input', { type: 'range', min: 0, max: 100, step: 1, value: 50, class: 't38f-range' })
    input.addEventListener('input', () => {
      vals[sl.id] = Number(input.value)
      levers[i].arm.style.transform = `rotate(${((vals[sl.id] - 50) * 0.5).toFixed(1)}deg)`
      draw()
    })
    input.addEventListener('change', () => {
      if (!live) (card.setAttribute('aria-live', 'polite'), (live = true))
      if (!told) (ctx.insight(K.insight), (told = true))
    })
    return h('label', { class: 't38f-sl' }, h('span', { class: 't38f-lab' }, sl.label), input,
      h('span', { class: 't38f-ends', 'aria-hidden': 'true' }, h('span', null, sl.low), h('span', null, sl.high)))
  })
  panel.append(...inputs, card,
    h('details', { class: 't38f-mists' }, h('summary', null, K.mistsLabel),
      ...K.mists.map((m) => h('div', { class: 't38f-mist-item' }, h('p', { class: 'p2-eyebrow' }, m.who), ctx.fact(m.view, 'p', 't38f-view')))))

  function draw() {
    const sc = K.scenarios.find((x) => Object.entries(x.when).every(([k, want]) => lv(vals[k as Id]) === want)) ?? K.scenarios[K.scenarios.length - 1]
    root.dataset.garden = sc.id
    name.textContent = sc.name
    text.textContent = sc.text
    K.sliders.forEach((sl, i) => {
      const l = lv(vals[sl.id])
      inputs[i].querySelector('input')!.setAttribute('aria-valuetext', fill(K.sliderAria, { label: sl.label, value: l === 'low' ? sl.low : l === 'high' ? sl.high : vals[sl.id] }))
    })
  }
  draw()
  ctx.prompt(K.prompt)
}
