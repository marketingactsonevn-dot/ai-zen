import { fill, h, s } from '../../core/dom'
import type { SceneCtx } from '../types'
import { C } from './content'
import { F, nightSky, paperLantern } from '../t34/night'

const K = C.scenes.line
const N = K.stations.length

/** Scene 4 — an ink cord across the workshop with eight paper lanterns: light them to join the line, set a vermilion stone where a person must approve. */
export function lineScene(ctx: SceneCtx) {
  const lit = new Set<number>()
  const stones = new Set<number>()
  let done = false
  // one cord drawn twice: across (wide) and down (narrow); CSS shows the one that fits
  const seg = (i: number, across: boolean) => {
    const a = (i + 0.5) * 100, b = (i + 1.5) * 100
    return s('path', { class: 't35d-seg', d: across ? `M${a} 8Q${(a + b) / 2} 26 ${b} 8` : `M30 ${a}Q35 ${(a + b) / 2} 30 ${b}`, 'vector-effect': 'non-scaling-stroke' })
  }
  const segs: SVGPathElement[][] = []
  const across = s('svg', { class: 't35d-cord t35d-across', viewBox: `0 0 ${N * 100} 30`, preserveAspectRatio: 'none', 'aria-hidden': 'true' })
  const down = s('svg', { class: 't35d-cord t35d-down', viewBox: `0 0 60 ${N * 100}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' })
  for (let i = 0; i < N - 1; i++) {
    const p = [seg(i, true), seg(i, false)]
    across.append(p[0])
    down.append(p[1])
    segs.push(p)
  }
  const cells = K.stations.map((st, i) => {
    const lamp = h('button', { class: 't35d-lamp', type: 'button', 'aria-pressed': 'false', 'aria-label': fill(K.stationAria, { n: i + 1, name: st.name }), onClick: () => light(i) },
      s('svg', { viewBox: '0 0 40 46', 'aria-hidden': 'true' }, paperLantern(20, 0, 8, 1.05)),
      h('span', { class: 't35d-name' }, st.name))
    const stone = h('button', { class: 't35d-stone', type: 'button', 'aria-pressed': 'false', 'aria-label': fill(K.stoneAria, { name: st.name }), onClick: () => seal(i) })
    return { el: h('li', { class: 't35d-cell' }, lamp, stone), lamp, stone }
  })
  const note = h('div', { class: 't35d-note', 'aria-live': 'polite' })
  const root = h('div', { class: 't35 t35d' },
    nightSky(800, 600, [690, 110, 22]),
    h('p', { class: 'visually-hidden' }, K.art),
    h('p', { class: 'p2-eyebrow t35d-task' }, K.task),
    h('div', { class: 't35d-wrap' }, across, down, h('ol', { class: 't35d-line', 'aria-label': K.lineAria }, ...cells.map((c) => c.el))),
    note)
  ctx.art.append(root)
  ctx.prompt(K.prompt)

  function paint() {
    segs.forEach((p, i) => p.forEach((el) => el.classList.toggle('on', lit.has(i) && lit.has(i + 1))))
  }
  function light(i: number) {
    if (lit.has(i)) return
    lit.add(i)
    cells[i].lamp.setAttribute('aria-pressed', 'true')
    ctx.chime('tap')
    paint()
    check()
  }
  function seal(i: number) {
    const st = K.stations[i]
    const on = !stones.has(i)
    if (on) stones.add(i)
    else stones.delete(i)
    cells[i].stone.setAttribute('aria-pressed', String(on))
    if (on) note.replaceChildren(h('p', null, st.human ? (st as { why?: string }).why ?? '' : K.extraStone))
    else note.replaceChildren()
    ctx.chime(on ? 'soft' : 'low')
    check()
  }
  function check() {
    if (done) return
    const missing = K.stations.filter((x, i) => x.human && !stones.has(i)).length
    if (lit.size === N && missing === 0) {
      done = true
      root.classList.add('is-done')
      note.replaceChildren(h('p', { class: 't35d-done' }, K.done), ctx.fact(F(K.facts[0]), 'p', 't35d-fact'))
      ctx.insight(F(K.insight), K.detail)
    } else if (lit.size === N) {
      note.append(h('p', { class: 't35d-miss' }, fill(K.missingStone, { n: missing })))
    }
  }
}
