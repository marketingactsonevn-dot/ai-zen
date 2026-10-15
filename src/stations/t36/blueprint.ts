import { fill, h, s } from '../../core/dom'
import { stroke } from '../../ui/part2/ink'
import type { SceneCtx } from '../types'
import { C } from './content'
import { cardButton, F } from '../t34/night'

const K = C.scenes.blueprint

/** The koi-pond sketch: one ink layer per spec piece (idea, rules, controls, end, style, device). */
function sketch(): [SVGSVGElement, SVGGElement[]] {
  const ink = (o: number) => `fill:var(--ink);opacity:${o}`
  const layers = [
    s('g', null, // idea: the pond and its koi
      s('ellipse', { cx: 80, cy: 66, rx: 62, ry: 38, style: 'fill:var(--water);opacity:.35' }),
      s('path', { d: stroke([[22, 70], [60, 98], [120, 96], [142, 62]], 2.4, 0.2, 0.3), style: ink(0.6) }),
      s('path', { d: 'M62 70 Q78 58 96 66 Q80 76 62 70Z M60 70 l-8 -6 l1 12Z', style: 'fill:var(--vermilion)' })),
    s('g', null, // rules: falling moon shards and a dry leaf
      s('path', { d: 'M104 20 l6 -4 l2 7Z M120 34 l5 -5 l3 6Z', style: 'fill:var(--moon);stroke:var(--ink);stroke-opacity:.4;stroke-width:.6' }),
      s('path', { d: 'M40 28 Q48 18 56 26 Q48 34 40 28Z', style: 'fill:var(--lantern);opacity:.75' })),
    s('g', null, // controls: a fingertip and its ripple
      s('circle', { cx: 104, cy: 82, r: 9, style: 'fill:none;stroke:var(--ink);stroke-opacity:.45;stroke-width:1' }),
      s('path', { d: stroke([[112, 100], [106, 86]], 6, 0.05, 0.3, 0.5), style: ink(0.55) })),
    s('g', null, // end: the ensō that holds the score
      s('path', { d: stroke(Array.from({ length: 30 }, (_, i) => { const a = -1.4 + i * 0.2; return [140 + Math.cos(a) * 12, 18 + Math.sin(a) * 12] as [number, number] }), 2.6, 0.1, 0.5), style: ink(0.8) })),
    s('g', null, // style: an ink-wash sky band
      s('path', { d: stroke([[6, 12], [60, 8], [96, 12]], 12, 0.3, 0.5, 0.1), style: ink(0.12) })),
    s('g', null, // device: the phone frame around it all
      s('rect', { x: 3, y: 3, width: 154, height: 114, rx: 12, style: 'fill:none;stroke:var(--ink);stroke-opacity:.55;stroke-width:1.6' })),
  ]
  return [s('svg', { class: 't36b-sketch', viewBox: '0 0 160 120', 'aria-hidden': 'true' }, ...layers), layers]
}

/** Scene 1 — a drawing table: six paper pieces; each choice inks one corner of the pond and one line of spec.md. */
export function blueprintScene(ctx: SceneCtx) {
  const chosen: number[] = K.pieces.map(() => -1)
  let cur = 0
  const [art, layers] = sketch()
  const lines = K.pieces.map((p) => h('li', null, h('span', { class: 't36b-key' }, p.label), h('span', { class: 't36b-val' }, '…')))
  const tabs = K.pieces.map((p, i) => h('button', { class: 't36b-tab', type: 'button', 'aria-label': p.label, 'aria-current': 'false', onClick: () => show(i) }, String(i + 1)))
  const head = h('p', { class: 't36b-head' })
  const opts = h('div', { class: 't36b-opts' })
  const tail = h('div', { class: 't36b-tail' })
  const sheet = h('div', { class: 't36b-sheet' },
    h('div', { class: 't36b-top' }, h('p', { class: 't36b-title' }, K.specTitle), art),
    h('ol', { class: 't36b-spec' }, ...lines))
  const root = h('div', { class: 't36 t36b' }, h('p', { class: 'visually-hidden' }, K.art),
    h('div', { class: 't36b-pick' }, h('div', { class: 't36b-tabs', role: 'group', 'aria-label': K.group }, ...tabs), head, opts, tail),
    sheet)
  ctx.art.append(root)
  ctx.prompt(K.prompt)
  const pill = cardButton(ctx, root, K.takeaway)
  show(0)

  function show(i: number) {
    cur = i
    const p = K.pieces[i]
    tabs.forEach((t, k) => {
      t.setAttribute('aria-current', String(k === i))
      t.classList.toggle('done', chosen[k] >= 0)
    })
    head.textContent = p.label
    opts.replaceChildren(...p.options.map((o, k) => h('button', { class: 't36b-opt', type: 'button', 'aria-pressed': String(chosen[i] === k), 'aria-label': fill(K.pieceAria, { piece: p.label, option: o }), onClick: () => choose(k) }, o)))
  }
  function choose(k: number) {
    const first = chosen[cur] < 0
    chosen[cur] = k
    lines[cur].lastElementChild!.textContent = K.pieces[cur].options[k]
    lines[cur].classList.add('on')
    layers[cur].classList.add('on')
    ctx.chime('tap')
    const next = chosen.findIndex((c) => c < 0)
    if (next >= 0) {
      show(first ? next : cur)
      if (first) opts.querySelector<HTMLElement>('button')?.focus()
      return
    }
    show(cur)
    if (!tail.childElementCount) {
      tail.append(ctx.fact(F(K.facts[0]), 'p', 't36b-fact'))
      if (pill) tail.append(pill)
      ctx.insight(F(K.insight), K.detail)
    }
  }
}
