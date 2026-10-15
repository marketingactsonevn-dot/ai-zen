import { fill, h, nextId, s } from '../../core/dom'
import { progress } from '../../core/progress'
import { blob, rng } from '../../ui/part2/ink'
import type { SceneCtx } from '../types'
import { C, moon, shell } from './shell'

const K = C.scenes.enso
const PART2 = Array.from({ length: 21 }, (_, i) => 19 + i)

/** Scene 5 — one brushed ensō at sunrise; inside it, a stone for every Moon Garden station the visitor walked. */
export function ensoScene(ctx: SceneCtx) {
  const { root, svg, panel } = shell(ctx, 't39e', K.art, [K.insight], '0 0 400 400')
  const r = rng(39)
  const mid = nextId('t39m')
  // the ensō: a filled brush ring revealed by a stroked mask (only the mask's dash animates, nothing filtered moves)
  const ring = (rad: number, w: number) => {
    const pts: string[] = []
    for (let i = 0; i <= 64; i++) {
      const a = -1.9 + (i / 64) * 5.9
      const rr = rad + Math.sin(i * 0.7) * 2 + (i / 64) * 6
      pts.push(`${(200 + Math.cos(a) * rr).toFixed(1)} ${(200 + Math.sin(a) * rr).toFixed(1)}`)
    }
    return s('path', { d: `M${pts.join('L')}`, fill: 'none', 'stroke-width': w, 'stroke-linecap': 'round' })
  }
  const brush = ring(150, 16)
  brush.setAttribute('class', 'brush')
  const reveal = ring(150, 30)
  reveal.setAttribute('class', 'reveal')
  reveal.setAttribute('pathLength', '1')
  const stones = PART2.map((id, i) => {
    const a = i * 2.4, rr = 22 + Math.sqrt(i) * 24
    const x = 200 + Math.cos(a) * rr, y = 210 + Math.sin(a) * rr * 0.7
    return s('path', { class: progress.isVisited(id) ? 'st on' : 'st', d: blob(x, y, 9 + r() * 4, 5 + r() * 2, id, 0.12) })
  })
  svg.append(s('defs', null, s('mask', { id: mid, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 400, height: 400 }, reveal)),
    moon(340, 60, 14), s('g', { class: 't39e-stones' }, ...stones), s('g', { mask: `url(#${mid})` }, brush),
    s('g', { class: 't39e-seal' }, s('rect', { x: 186, y: 362, width: 28, height: 28, rx: 3 }), s('path', { d: 'M193 370h14M200 370v14M193 384h14' })))

  const visited = PART2.filter((id) => progress.isVisited(id)).length
  const all = Array.from({ length: 39 }, (_, i) => i + 1).filter((id) => progress.isVisited(id)).length
  const draw = h('button', { class: 'btn primary t39e-draw', type: 'button', 'aria-label': K.drawAria, onClick: go }, K.draw)
  const stats = h('div', { class: 't39e-stats', hidden: true },
    h('p', null, fill(K.visited, { n: visited })), h('p', null, fill(K.visitedAll, { n: all })),
    h('div', { class: 't39e-go' },
      h('a', { class: 'btn primary', href: '#/bai-thi-trang', 'aria-label': K.examAria }, K.exam),
      h('a', { class: 'btn ghost', href: '#/do-nghe', 'aria-label': K.toolkitAria }, K.toolkit)))
  panel.append(draw, stats)

  function go() {
    root.dataset.drawn = 'true'
    draw.hidden = true
    stats.hidden = false
    ;(stats.querySelector('a') as HTMLElement).focus()
    ctx.insight(K.insight)
  }
  ctx.prompt(K.prompt)
}
