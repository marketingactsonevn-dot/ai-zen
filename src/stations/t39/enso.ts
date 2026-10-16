import { fill, h, nextId, s } from '../../core/dom'
import { progress } from '../../core/progress'
import { ensoBrush } from '../../ui/brush'
import { blob, rng, stoneArt, stroke } from '../../ui/part2/ink'
import { hills, mist } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import { C, shell } from './shell'
import { crescent, dawnGlow, f1, lines, mossBed, rakeRings } from '../t37/sumi'

const K = C.scenes.enso
const PART2 = Array.from({ length: 21 }, (_, i) => 19 + i)

/** Scene 5 — one brushed ensō at sunrise; inside it, a stone for every Moon Garden station the visitor walked. */
export function ensoScene(ctx: SceneCtx) {
  const { root, svg, panel } = shell(ctx, 't39e', K.art, [K.insight], '0 0 400 400')
  const r = rng(39)
  const mid = nextId('t39m')
  // the ensō: the shared hand-brushed ring (ui/brush.ts) at twice its size, revealed by a stroked mask (only the mask's
  // dash moves, nothing filtered does)
  const b = ensoBrush(5)
  const reveal = s('path', { class: 'reveal', d: b.spine, fill: 'none', 'stroke-width': 42, 'stroke-linecap': 'round', pathLength: 1 })
  // the garden inside: raked rings, moss, and a stone for each Part 2 station (painted if walked, a faint outline if not)
  const spots = PART2.map((id, i) => {
    const a = i * 2.4, rr = 16 + Math.sqrt(i) * 21
    return { id, x: 200 + Math.cos(a) * rr, y: 214 + Math.sin(a) * rr * 0.5, k: 0.75 + r() * 0.5 }
  }).sort((p, q) => p.y - q.y)
  const stones = spots.map(({ id, x, y, k }) => {
    const depth = 0.7 + ((y - 160) / 110) * 0.5
    const w = 17 * k * depth, hh = w * (0.5 + r() * 0.25)
    return progress.isVisited(id)
      ? s('g', { transform: `translate(${f1(x)} ${f1(y)})` }, stoneArt(w, hh, id * 13))
      : s('path', { class: 't39e-ghost', d: blob(x, y - hh * 0.1, w * 0.5, hh * 0.25, id, 0.15, 12) })
  })
  svg.append(
    s('defs', null, s('mask', { id: mid, maskUnits: 'userSpaceOnUse', x: -20, y: -20, width: 240, height: 240 }, reveal)),
    dawnGlow(256, 318, 170, 110, 3),
    s('g', { class: 't39e-sunrise' },
      s('circle', { cx: 262, cy: 322, r: 60, fill: 'url(#g13-sun)' }),
      s('circle', { class: 't39e-sun', cx: 262, cy: 322, r: 21, filter: 'url(#ink-wash)' })),
    s('g', { class: 't39e-moon' }, crescent(338, 66, 13, 0.62, 160)),
    hills(20, 380, 334, 44, 3940, 0.9, 7),
    hills(30, 170, 338, 30, 3941, 0.62, 2),
    mist(200, 336, 200, 14),
    s('path', { class: 'g13-rake t39e-rake', d: rakeRings(200, 220, 26, 120, 13, 0.5, 3942, 1) }),
    mossBed(146, 252, 26, 6, 3943), mossBed(258, 196, 22, 5, 3944), mossBed(214, 268, 18, 4, 3945),
    s('g', { class: 't39e-stones' }, ...stones),
    s('path', { class: 't39e-guide', d: b.body, transform: 'scale(2)' }),
    s('g', { transform: 'scale(2)', mask: `url(#${mid})` },
      s('path', { class: 'enso-bleed', d: b.body, filter: 'url(#ink-wash)' }),
      s('path', { class: 'enso-body', d: b.body, filter: 'url(#ink-rough)' }),
      ...b.streaks.map((d) => s('path', { class: 'enso-hair', d }))),
    s('g', { class: 't39e-seal', transform: 'translate(200 376) rotate(-4)' },
      s('rect', { class: 't39e-seal-ink', x: -11, y: -13, width: 22, height: 26, rx: 2, filter: 'url(#ink-rough)' }),
      s('path', { class: 't39e-seal-cut', d: lines([[-6, -7, 6, -7], [0, -7, 0, 7], [-6, 7, 6, 7]], 1.8, 0.1, 0.1) + stroke([[-6, 0], [-2, 0]], 1.6, 0.1, 0.1, 0.4) })))

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
