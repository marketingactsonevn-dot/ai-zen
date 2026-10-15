import { fill, h, s } from '../../core/dom'
import { blob, curve, rng, stroke, type Pt } from '../../ui/part2/ink'
import { findTakeaway, takeaway } from '../../ui/part2/takeaway'
import type { SceneCtx } from '../types'
import { C, lantern, moon, shell } from './shell'

const K = C.scenes.goal

/** A five-lobed maple leaf at (x, y), size r, turned a degrees. */
const leaf = (x: number, y: number, r: number, a: number) => {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const ang = ((i * 36 - 90) * Math.PI) / 180
    const rr = i % 2 ? r * 0.45 : r
    pts.push(`${(Math.cos(ang) * rr).toFixed(1)} ${(Math.sin(ang) * rr).toFixed(1)}`)
  }
  return s('path', { d: `M${pts.join('L')}Z`, transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${a.toFixed(0)})` })
}

function art(svg: SVGSVGElement) {
  const r = rng(37)
  const g = (cls: string) => s('g', { class: cls })
  // raked sand and the far hedge in the mist
  const sand = g('t37g-sand')
  for (let i = 0; i < 6; i++) sand.append(s('path', { d: `M-10 ${178 + i * 20}q100 ${-6 + i} 210 0t220 ${2 - i}` }))
  const hedge = s('path', { class: 't37g-hedge', d: `M-10 172${Array.from({ length: 11 }, (_, i) => `Q${i * 40 + 20} ${150 - r() * 18} ${i * 40 + 40} 168`).join('')}L410 176L-10 176Z` })
  // the pond with the moon in it
  const pond = g('t37g-pond')
  pond.append(s('path', { class: 'water', d: blob(318, 246, 74, 20, 4, 0.06) }), s('ellipse', { class: 'refl', cx: 334, cy: 244, rx: 11, ry: 2.6 }))
  // the maple: brushed trunk and branches, a canopy of red wash and leaves
  const tree = g('t37g-tree')
  const trunk: Pt[][] = [curve([92, 214], [86, 170], [104, 112]), curve([97, 160], [78, 140], [62, 124]), curve([100, 140], [122, 126], [138, 118])]
  for (const [i, p] of trunk.entries()) tree.append(s('path', { class: 'ink', d: stroke(p, i ? 3.2 : 7.5) }))
  for (const [x, y, rx, ry] of [[100, 104, 46, 26], [66, 120, 26, 16], [138, 114, 26, 16]]) tree.append(s('path', { class: 'wash', d: blob(x, y, rx, ry, x, 0.12) }))
  for (let i = 0; i < 26; i++) tree.append(leaf(54 + r() * 100, 86 + r() * 44, 3 + r() * 2.5, r() * 70))
  const stump = g('t37g-stump')
  stump.append(s('path', { class: 'ink', d: 'M85 214q-1 -10 1 -18h13q2 8 0 18z' }), s('ellipse', { class: 'cut', cx: 92.5, cy: 196, rx: 7, ry: 2.4 }))
  // moss beds beside the path
  const moss = g('t37g-moss')
  for (const [x, y, rx, ry] of [[146, 254, 30, 7], [214, 222, 24, 6], [60, 236, 26, 6], [270, 278, 20, 5]]) moss.append(s('path', { d: blob(x, y, rx, ry, x + y, 0.18) }))
  // stepping stones and the fallen leaves on them
  const path = g('t37g-path')
  const stones: Pt[] = [[44, 284], [82, 268], [122, 252], [164, 240], [204, 232], [242, 222]]
  for (const [i, [x, y]] of stones.entries()) path.append(s('path', { d: blob(x, y, 17 - i, 5.5 - i * 0.3, i * 7, 0.1) }))
  const leaves = g('t37g-leaves')
  for (let i = 0; i < 22; i++) {
    const [x, y] = stones[Math.floor(r() * stones.length)]
    leaves.append(leaf(x + (r() - 0.5) * 34, y + (r() - 0.5) * 12, 2.6 + r() * 2, r() * 360))
  }
  // the sleeping gardener by the lantern, the paper gardener waiting with shears
  const sleeper = g('t37g-sleeper')
  sleeper.append(
    s('path', { class: 'ink', d: stroke(curve([266, 214], [268, 196], [279, 186]), 6) }),
    s('circle', { class: 'head', cx: 283, cy: 181, r: 5.2 }),
    s('path', { class: 'ink', d: stroke([[262, 214], [292, 214]], 3) }),
  )
  const paper = g('t37g-paper')
  paper.append(
    s('path', { class: 'fold', d: 'M176 226l-11 -26h22z' }),
    s('path', { class: 'fold2', d: 'M176 226l0 -26h11z' }),
    s('path', { class: 'fold', d: 'M168 199l8 -13 8 13z' }),
    s('path', { class: 'shears', d: 'M186 208l12 -8M186 212l12 -3' }),
  )
  const ask = s('path', { class: 't37g-ask', d: 'M190 196q40 -40 86 -20' })
  const drift = s('g', { class: 't37g-drift' }, leaf(296, 244, 4, 30))
  svg.append(moon(340, 84, 12), hedge, sand, pond, moss, path, leaves, stump, tree, lantern(250, 216, 0.95), sleeper, paper, ask, drift)
}

/** Scene 1 — word the order three ways; the paper gardener does exactly what the words say. */
export function goalScene(ctx: SceneCtx) {
  const { root, svg, panel } = shell(ctx, 't37g', K.art, [K.insight], '0 46 400 250')
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
    result.replaceChildren(h('p', { class: 'p2-eyebrow' }, K.morning), h('p', { class: 't37-res-text' }, o.result), ...(o.ok && card ? [takeaway(card)] : []), retry)
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
