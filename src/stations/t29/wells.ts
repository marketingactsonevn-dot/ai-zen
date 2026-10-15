import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { blob, curve, stroke } from '../../ui/part2/ink'
import { C } from './data'
import { f1, frame } from '../t28/frame'

const G = C.scenes.wells
const LEVELS = [10, 6, 3, 1]

/** The great moon lake (AI data centres) drinks through underground streams; the three small wells at the garden's edge sink. */
export function wellsScene(ctx: SceneCtx) {
  let k = 0
  const gate = h('button', { class: 'btn t29w-gate', type: 'button', 'aria-label': G.gateAria, onClick: open }, G.gate)
  const read = h('div', { class: 't29w-read', 'aria-live': 'polite' })
  const sr = h('ul', { class: 'visually-hidden' })
  const panel = h('div', { class: 'gf-panel t29w-panel' }, gate, read, sr)
  const { root } = frame(ctx, 't29w', [G.insight as Fact], panel, draw)
  ctx.prompt(G.prompt)
  let pools: SVGCircleElement[] = []
  let lake: SVGGElement | null = null
  let rIn = 10
  say()

  function say() {
    sr.replaceChildren(...G.wells.map((w) => h('li', null, fill(G.wellAria, { name: w.name, n: LEVELS[k] }))))
  }
  function set() {
    pools.forEach((p) => p.setAttribute('r', f1(rIn * (0.18 + 0.82 * (LEVELS[k] / 10)))))
    root.style.setProperty('--lake', String(1 + k * 0.06))
    root.dataset.level = String(k)
  }

  function open() {
    if (k >= LEVELS.length - 1) return
    k++
    set()
    say()
    root.classList.remove('flow')
    void root.offsetWidth // restart the stream animation
    root.classList.add('flow')
    if (k <= G.facts.length) read.replaceChildren(ctx.fact(G.facts[k - 1] as Fact, 'p', 'gf-new'))
    if (k === LEVELS.length - 1) {
      gate.disabled = true
      ctx.insight(G.insight as Fact)
      ctx.chime('ok')
    } else ctx.chime('soft')
  }

  function draw(w: number, hh: number) {
    const svg = root.querySelector('svg')!
    const lx = w / 2, ly = hh * 0.3
    const lrx = Math.min(w * 0.36, hh * 0.55), lry = Math.min(lrx * 0.42, hh * 0.2)
    const wy = hh * 0.8
    const xs = [w * 0.17, w * 0.5, w * 0.83]
    rIn = Math.min(w * 0.075, hh * 0.09, 44)
    pools = xs.map(() => s('circle', { class: 't29w-pool', cx: 0, cy: 0, r: f1(rIn) }))
    const streams = xs.map((x, i) => {
      const end: [number, number] = [lx + (x - lx) * 0.45, ly + lry * 0.86]
      return s('path', { class: 't29w-stream', d: `M${f1(x)} ${f1(wy - rIn * 1.4)}Q${f1(x + (i - 1) * -10)} ${f1((wy + ly) / 2 + 20)} ${f1(end[0])} ${f1(end[1])}` })
    })
    lake = s('g', { class: 't29w-lake', style: `transform-origin:${f1(lx)}px ${f1(ly)}px` },
      s('path', { class: 'gf-water', d: blob(lx, ly, lrx, lry, 31, 0.04, 28) }),
      s('ellipse', { cx: f1(lx + lrx * 0.25), cy: f1(ly - lry * 0.2), rx: f1(lrx * 0.07), ry: f1(lry * 0.09), class: 't29w-moonr' }),
      s('path', { class: 'gf-glint', d: `M${f1(lx + lrx * 0.12)} ${f1(ly + lry * 0.2)}h${f1(lrx * 0.26)}M${f1(lx + lrx * 0.18)} ${f1(ly + lry * 0.34)}h${f1(lrx * 0.14)}` }))
    svg.replaceChildren(
      s('ellipse', { cx: f1(w * 0.9), cy: f1(hh * 0.07), rx: 60, ry: 60, fill: 'url(#p2-halo)' }),
      s('circle', { class: 'gf-moon', cx: f1(w * 0.9), cy: f1(hh * 0.07), r: 13 }),
      s('path', { class: 't29w-earth', d: blob(lx, ly, lrx * 1.12, lry * 1.25, 8, 0.05, 28) }),
      ...streams.map((p) => s('path', { class: 't29w-vein', d: p.getAttribute('d')! })),
      ...streams,
      lake,
      s('text', { class: 'gf-title', x: f1(lx), y: f1(ly + lry * 0.55), 'text-anchor': 'middle' }, G.lake),
      ...xs.map((x, i) => s('g', { transform: `translate(${f1(x)} ${f1(wy)})` },
        s('ellipse', { class: 't29w-shadow', cx: 3, cy: f1(rIn * 0.5), rx: f1(rIn * 1.5), ry: f1(rIn * 0.7) }),
        s('circle', { class: 't29w-rim', r: f1(rIn * 1.32), fill: 'url(#p2-rock)' }),
        s('circle', { class: 't29w-hole', r: f1(rIn) }),
        s('path', { class: 't29w-moss', d: stroke(curve([-rIn * 1.1, rIn * 0.6], [0, rIn * 1.5], [rIn * 1.1, rIn * 0.6], 10), 3, 0.3, 0.3, 0.2) }),
        pools[i],
        s('text', { class: 'gf-label', x: 0, y: f1(rIn * 1.32 + 18), 'text-anchor': 'middle' }, G.wells[i].name))))
    set()
  }
}
