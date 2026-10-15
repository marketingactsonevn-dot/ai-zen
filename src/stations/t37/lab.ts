import { h, s } from '../../core/dom'
import { blob, curve, stroke } from '../../ui/part2/ink'
import type { SceneCtx } from '../types'
import { C, lantern, moon, shell } from './shell'

const K = C.scenes.lab

/** A kneeling figure's silhouette, feet at (0, 0), ≈ 34 tall. */
const figure = (cls: string) =>
  s('g', { class: cls }, s('g', { class: 'fig' }, s('circle', { cx: 0, cy: -30, r: 5 }), s('path', { d: 'M-9 0q-2 -16 3 -22q6 -3 12 0q5 6 3 22z' })))

function art(svg: SVGSVGElement) {
  const sand = s('g', { class: 't37l-sand' })
  for (let i = 0; i < 5; i++) sand.append(s('path', { d: `M-10 ${226 + i * 17}q120 -4 210 0t220 2` }))
  // two ways out of the tea room: the straight lit path and the side path into the dark
  const ways = s('g', { class: 't37l-ways' },
    s('path', { class: 'main', d: stroke(curve([200, 214], [196, 252], [186, 300]), 26, 0.05, 0.1, 0.8) }),
    s('path', { class: 'side', d: stroke(curve([206, 222], [262, 236], [344, 226]), 14, 0.05, 0.6, 0.3) }))
  // the tea room: roof, lit shōji wall with its lattice, the figure's straight shadow on the paper
  const room = s('g', { class: 't37l-room' })
  const shoji = s('rect', { class: 'shoji', x: 140, y: 120, width: 120, height: 88 })
  const lattice = s('g', { class: 'lattice' })
  for (let i = 1; i < 6; i++) lattice.append(s('path', { d: `M${140 + i * 20} 120v88` }))
  for (let j = 1; j < 4; j++) lattice.append(s('path', { d: `M140 ${120 + j * 22}h120` }))
  room.append(
    s('path', { class: 'ink', d: 'M122 122q78 -46 156 0l-8 -6q-70 -36 -140 0z' }),
    s('path', { class: 'ink', d: 'M134 120h132l-4 -6h-124z' }),
    shoji, figure('t37l-in'), lattice,
    s('rect', { class: 'frame', x: 140, y: 120, width: 120, height: 88 }),
    s('path', { class: 'ink', d: stroke([[132, 210], [268, 210]], 4) }))
  ;(room.querySelector('.t37l-in') as SVGGElement).setAttribute('transform', 'translate(200 200)')
  // the second shadow out in the garden: at the door when watched, off down the side path when not
  const out = s('g', { class: 't37l-out', transform: 'translate(214 232)' }, figure('t37l-walk'))
  const bushes = s('g', { class: 't37l-bush' })
  for (const [x, y, rx, ry] of [[70, 214, 52, 22], [336, 206, 46, 20], [38, 240, 30, 12]]) bushes.append(s('path', { d: blob(x, y, rx, ry, x, 0.14) }))
  svg.append(moon(62, 50, 12), sand, bushes, ways, room, out, lantern(104, 252, 0.8))
}

/** Scene 2 — the sealed test room: the paper gardener behaves while it believes it is watched. */
export function labScene(ctx: SceneCtx) {
  const { root, svg, panel } = shell(ctx, 't37l', K.art, [K.insight], '20 30 360 270')
  art(svg)
  let watched = true
  let told = false
  const state = h('span', { class: 't37-sw-state' }, K.on)
  const sw = h('button', { class: 't37-switch', type: 'button', role: 'switch', 'aria-checked': 'true', onClick: flip },
    h('span', { class: 't37-sw-track', 'aria-hidden': 'true' }, h('span', { class: 't37-sw-knob' })), h('span', { class: 't37-sw-label' }, K.toggle, state))
  const status = h('p', { class: 't37-status' }, K.watched)
  const what = h('p', { class: 't37-what' })
  const tools = K.tools.map((t, i) => h('button', { class: 't37-chip', type: 'button', 'aria-pressed': String(i === 0), onClick: () => tool(i) }, t.name))
  const example = h('div', { class: 't37-example', hidden: true }, h('p', { class: 'p2-eyebrow' }, K.exampleLabel), ctx.fact(K.example, 'p', 't37-ex-text'))
  panel.append(sw, status,
    h('div', { class: 't37-tools' }, h('p', { class: 'p2-eyebrow' }, K.toolsLabel), h('div', { class: 't37-chips', role: 'group', 'aria-label': K.toolsLabel }, ...tools), what),
    example)
  tool(0)

  function tool(i: number) {
    tools.forEach((b, j) => b.setAttribute('aria-pressed', String(i === j)))
    what.textContent = K.tools[i].what
  }
  function flip() {
    watched = !watched
    root.dataset.unwatched = String(!watched)
    sw.setAttribute('aria-checked', String(watched))
    state.textContent = watched ? K.on : K.off
    status.textContent = watched ? K.watched : K.unwatched
    if (!told) {
      told = true
      status.setAttribute('aria-live', 'polite')
      example.hidden = false
      ctx.insight(K.insight, K.detail)
    }
  }
  ctx.prompt(K.prompt)
}
