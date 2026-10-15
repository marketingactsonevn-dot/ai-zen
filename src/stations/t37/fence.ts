import { fill, h, s } from '../../core/dom'
import { curve, rng, stroke } from '../../ui/part2/ink'
import type { SceneCtx } from '../types'
import { C, moon, shell } from './shell'

const K = C.scenes.fence
const N = K.layers.length
const FLIES = 20
/** fireflies still reaching the sapling after k layers (illustration: every layer stops some, none stops all) */
const LEAK = [20, 11, 6, 4, 2, 1, 1]
const CX = 200, CY = 206
const ringR = (k: number) => 46 + k * 23

/** One ring of yotsume-gaki: two rails and posts, broken by three gaps at their own angles. */
function ring(k: number) {
  const r = rng(80 + k)
  const R = ringR(k)
  const gaps = [0, 1, 2].map((i) => (i * 120 + r() * 80) * (Math.PI / 180))
  const g = s('g', { class: 't37f-ring', style: `transform-origin:${CX}px ${CY}px` })
  const arcs: string[] = []
  const gap = 0.22
  for (let i = 0; i < 3; i++) {
    const a0 = gaps[i] + gap / 2, a1 = (i < 2 ? gaps[i + 1] : gaps[0] + Math.PI * 2) - gap / 2
    for (const rr of [R - 3, R + 3]) {
      const p = (a: number) => `${(CX + Math.cos(a) * rr).toFixed(1)} ${(CY + Math.sin(a) * rr * 0.62).toFixed(1)}`
      arcs.push(`M${p(a0)}A${rr} ${(rr * 0.62).toFixed(1)} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)}`)
    }
    for (let a = a0; a < a1; a += 0.16) {
      const x = CX + Math.cos(a) * R, y = CY + Math.sin(a) * R * 0.62
      arcs.push(`M${x.toFixed(1)} ${(y + 5).toFixed(1)}v-11`)
    }
  }
  g.append(s('path', { d: arcs.join('') }))
  return g
}

/** Where firefly i rests once k layers stand: at the sapling, or just outside the ring that stopped it. */
function spot(i: number, k: number): [number, number] {
  const a = (i * 137.5 * Math.PI) / 180
  let R = 10 + (i % 5) * 5
  if (i >= LEAK[k]) {
    let m = 0
    while (i < LEAK[m + 1]) m++
    R = ringR(m) + 9 + (i % 3) * 3
  }
  return [CX + Math.cos(a) * R, CY + Math.sin(a) * R * 0.62]
}

/** Scene 3 — six bamboo fences, each holed somewhere else; fewer fireflies reach the sapling with every layer. */
export function fenceScene(ctx: SceneCtx) {
  const { root, svg, panel } = shell(ctx, 't37f', K.art, [K.insight], '0 0 400 340')
  const rings = K.layers.map((_, k) => ring(k))
  const flies = Array.from({ length: FLIES }, () => s('g', { class: 't37f-fly' }, s('circle', { class: 'glow', r: 6 }), s('circle', { r: 2.2 })))
  flies.forEach((f, i) => f.style.setProperty('--d', `${(i % 7) * 0.4}s`))
  const sapling = s('g', { class: 't37f-sap' },
    s('ellipse', { class: 'sh', cx: CX, cy: CY + 4, rx: 16, ry: 4 }),
    s('path', { class: 'ink', d: stroke(curve([CX, CY + 2], [CX - 3, CY - 16], [CX + 2, CY - 34]), 3.4) }),
    s('path', { class: 'leafy', d: `M${CX + 1} ${CY - 24}q14 -10 18 -2q-8 8 -18 2zM${CX} ${CY - 18}q-14 -8 -18 0q8 8 18 0zM${CX + 2} ${CY - 33}q4 -12 12 -8q-4 10 -12 8z` }))
  const water = s('ellipse', { class: 't37f-water', cx: CX, cy: CY, rx: 186, ry: 118 })
  svg.append(water, moon(346, 40, 12), ...rings, sapling, ...flies)

  let built = 0
  const count = h('p', { class: 't37f-count' })
  const leak = h('p', { class: 't37f-leak' })
  const add = h('button', { class: 'btn primary t37f-add', type: 'button', onClick: next })
  const info = h('div', { class: 't37f-info' })
  const list = h('ol', { class: 't37f-list' })
  panel.append(h('div', { class: 't37f-meter' }, count, h('span', null, leak, ' ', ctx.tag('illustration'))), add, info, list)
  let live = false
  let told = false

  function draw() {
    rings.forEach((g, k) => g.classList.toggle('on', k < built))
    flies.forEach((f, i) => {
      const [x, y] = spot(i, built)
      f.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
      f.classList.toggle('in', i < LEAK[built])
    })
    count.textContent = fill(K.count, { n: built })
    leak.textContent = fill(K.leak, { n: LEAK[built] })
    const nextL = K.layers[built]
    add.textContent = nextL ? `${K.add} · ${nextL.name}` : K.reset
    add.setAttribute('aria-label', nextL ? fill(K.addAria, { name: nextL.name }) : K.reset)
    root.dataset.built = String(built)
  }
  function next() {
    if (built >= N) {
      built = 0
      info.replaceChildren()
      list.replaceChildren()
      draw()
      return
    }
    const L = K.layers[built]
    built++
    draw()
    info.replaceChildren(
      h('h3', { class: 't37f-name' }, `${built}. ${L.name}`),
      h('p', { class: 't37f-what' }, L.what),
      ...(L.fact ? [ctx.fact(L.fact, 'p', 't37f-fact')] : []),
      ...(L.station ? [h('a', { class: 't37-link', href: `#/tram/${L.station}` }, fill(K.seeStation, { n: L.station }))] : []))
    list.append(h('li', null, L.name))
    if (!live) (info.setAttribute('aria-live', 'polite'), (live = true))
    if (built === N && !told) (ctx.insight(K.insight, K.detail), (told = true))
  }
  draw()
  ctx.prompt(K.prompt)
}
