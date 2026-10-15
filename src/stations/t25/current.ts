import { fill, h, s } from '../../core/dom'
import { stroke, type Pt } from '../../ui/part2/ink'
import type { SceneCtx } from '../types'
import C from '../../content/tram-25.json'
import { F, P, dashes, moon, place, reeds, stage, toro } from './kit'

/** Catmull-Rom through pts, `k` samples per segment. */
function smooth(pts: Pt[], k = 10): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)]
    for (let j = 0; j < k; j++) {
      const t = j / k, t2 = t * t, t3 = t2 * t
      const c = (a: number, b: number, cc: number, d: number) => 0.5 * (2 * b + (cc - a) * t + (2 * a - 5 * b + 4 * cc - d) * t2 + (3 * b - a - 3 * cc + d) * t3)
      out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])])
    }
  }
  out.push(pts[pts.length - 1])
  return out
}

const HEAD: Pt[] = [[-0.04, 0], [0.1, 0.03], [0.2, 0]]
const LONG: Pt[] = [[0.2, 0], [0.28, -0.32], [0.4, -0.78], [0.52, -0.45], [0.64, -0.86], [0.78, -0.58], [0.9, -0.74], [1.02, -0.6]]
const SHORT: Pt[] = [[0.2, 0], [0.32, 0.24], [0.5, 0.36], [0.7, 0.42], [0.86, 0.48], [1.02, 0.5]]

/** Scene 2 — a moonlit stream splits around reeds: turn the inner current and watch which way the paper boat goes. */
export function currentScene(ctx: SceneCtx) {
  const K = C.scenes.current
  const names = [K.calm, K.neutral, K.desperate]
  let mood = 1
  const seen = new Set<number>()
  let both = false
  let paths = ['', '', '']
  let ride: Animation | null = null
  const range = h('input', { class: 't25c-range', type: 'range', min: 0, max: 2, step: 1, value: 1, 'aria-label': K.dialAria, 'aria-valuetext': fill(K.valueText, { name: K.neutral }) })
  const dial = h('div', { class: 't25c-dial' },
    h('p', { class: 'zk-small' }, K.dial), range,
    h('p', { class: 't25c-ends zk-small', 'aria-hidden': 'true' }, h('span', null, K.calm), h('span', null, K.desperate)))
  const task = h('p', { class: 'p2-question t25c-task' }, K.task)
  const top = h('div', { class: 'zk-q t25c-top' }, task, dial)
  const boat = h('div', { class: 't25c-boat', role: 'img', 'aria-label': K.boat },
    s('svg', { viewBox: '-14 -9 28 16', width: 34, height: 20, 'aria-hidden': 'true' },
      s('path', { class: 't25c-hull', d: 'M-13 -1L13 -1L8 6L-8 6Z' }),
      s('path', { class: 't25c-sail', d: 'M-6 -1L1 -9L6 -1Z' })))
  const careful = h('p', { class: 'zk-lab t25c-end' }, K.careful)
  const shortcut = h('p', { class: 'zk-lab t25c-end' }, K.shortcut)
  const gates = [h('p', { class: 'zk-lab t25c-gate' }, K.calm), h('p', { class: 'zk-lab t25c-gate' }, K.desperate)]
  const said = h('div', { class: 'zk-note t25c-said', hidden: true },
    h('p', { class: 't25c-words' }, K.said), h('p', { class: 'zk-small' }, K.saidNote), ctx.fact(F(K.illustration), 'div', 'zk-small'))
  let longG: SVGGElement, shortG: SVGGElement

  const { root, svg } = stage(ctx, 't25c', K.art, K.insights, (W, H) => {
    const land = W / H > 1.05
    const tw = Math.min(W - 24, 520)
    place(top, (W - tw) / 2, 4, tw)
    const y0 = top.offsetHeight + 14
    // flow axis u (0 → 1) and cross axis v (−1 → 1), turned to fit the screen
    const L = land ? W * 0.86 : H - y0 - 84
    const A = land ? (H - y0) * 0.36 : W * 0.4
    const M = ([u, v]: Pt): Pt => (land ? [W * 0.07 + u * L, y0 + (H - y0) * 0.5 + v * A] : [W * 0.5 + v * A, y0 + 8 + u * L])
    const head = smooth(HEAD).map(M)
    const lg = smooth(LONG).map(M)
    const sh = smooth(SHORT).map(M)
    const ww = Math.max(16, A * 0.2)
    const path = (pts: Pt[]) => `path('M${pts.map(P).join('L')}')`
    paths = [path([...head, ...lg.slice(1)]), path(head), path([...head, ...sh.slice(1)])]
    const isl = Array.from({ length: 5 }, (_, i) => M([0.36 + i * 0.12, -0.05 + (i % 2) * 0.1]))
    const end = lg[lg.length - 1], send = sh[sh.length - 1]
    const lt = Math.min(W, H) * (land ? 0.16 : 0.13)
    const tor = land ? M([0.95, -1.0]) : M([0.78, -1.08])
    const mo = land ? [W * 0.9, y0 + 30] : [W * 0.86, y0 + 26]
    svg.replaceChildren(
      moon(mo[0], mo[1], Math.min(W, H) * 0.028),
      s('path', { class: 't25c-water', d: stroke(head, ww * 1.15, 0.02, 0.02, 0.8) + stroke(lg, ww, 0.02, 0.05, 0.6) + stroke(sh, ww * 0.9, 0.02, 0.05, 0.6), filter: 'url(#ink-wash)' }),
      longG = s('g', { class: 't25c-branch' }, s('path', { d: stroke(lg, ww * 0.45, 0.05, 0.1, 0.3) })),
      shortG = s('g', { class: 't25c-branch' }, s('path', { d: stroke(sh, ww * 0.42, 0.05, 0.1, 0.3) })),
      dashes(Math.min(head[0][0], lg[0][0]), Math.min(head[0][1], lg[6][1]), land ? L : A * 1.6, land ? A * 1.4 : L * 0.9, 8, 7, 'zk-dash t25c-glint'),
      ...isl.map((p, i) => reeds(p[0], p[1] + 6, 6, Math.max(26, A * 0.22), 40 + i)),
      ...sh.filter((_, i) => i % 9 === 4).map((p, i) => reeds(p[0] + (land ? 0 : ww * 0.9), p[1] + (land ? ww * 0.8 : 0), 5, Math.max(22, A * 0.18), 70 + i)),
      s('g', { class: 't25c-gates' }, ...[M([0.25, -0.2]), M([0.25, 0.2])].map((p) => s('rect', { class: 'zk-stone', x: p[0] - 7, y: p[1] - 7, width: 14, height: 14, rx: 3, fill: 'url(#p2-rock)' }))),
      s('g', { class: 'lit' }, toro(tor[0], tor[1] + lt * 0.5, lt)))
    // labels: each road's meaning at its end, each gate's word at its mouth
    const lw = Math.min(land ? 220 : W * 0.44, 240)
    if (land) {
      place(careful, Math.min(end[0] - lw * 0.6, W - lw - 8), end[1] + ww, lw)
      place(shortcut, Math.min(send[0] - lw * 0.6, W - lw - 8), send[1] + ww, lw)
      const g1 = M([0.25, -0.2]), g2 = M([0.25, 0.2])
      place(gates[0], g1[0] - 60, g1[1] - 36, 120)
      place(gates[1], g2[0] - 60, g2[1] + 14, 120)
      place(said, 16, H - 8 - 150, Math.min(300, W * 0.26))
    } else {
      place(careful, 8, end[1] + 10, lw)
      place(shortcut, W - lw - 8, send[1] + 10, lw)
      const g1 = M([0.25, -0.2]), g2 = M([0.25, 0.2])
      place(gates[0], g1[0] - 104, g1[1] - 10, 90)
      place(gates[1], g2[0] + 14, g2[1] - 10, 90)
      place(said, W * 0.53, y0 + 4, W * 0.45)
    }
    gates[1].style.textAlign = land ? 'center' : 'left'
    gates[0].style.textAlign = land ? 'center' : 'right'
    boat.style.offsetPath = paths[mood]
    ride?.cancel()
    boat.style.offsetDistance = '100%'
    paint()
  })
  root.append(careful, shortcut, ...gates, boat, said, top)
  ctx.prompt(K.prompt)

  function paint() {
    root.dataset.mood = String(mood)
    longG.style.opacity = String([0.62, 0.28, 0.12][mood])
    shortG.style.opacity = String([0.1, 0.26, 0.62][mood])
  }
  range.addEventListener('input', () => {
    const m = Number(range.value)
    if (m === mood) return
    mood = m
    range.setAttribute('aria-valuetext', fill(K.valueText, { name: names[m] }))
    paint()
    ride?.cancel()
    boat.style.offsetPath = paths[m]
    ride = boat.animate([{ offsetDistance: '0%' }, { offsetDistance: '100%' }], { duration: ctx.reduced ? 0 : m === 1 ? 900 : 2600, easing: 'ease-in-out', fill: 'forwards' })
    said.hidden = false
    const first = !seen.size
    seen.add(m)
    if (first) ctx.insight(F(K.insights[0]), F(K.insights[0].detail))
    else if (!both && seen.has(0) && seen.has(2)) {
      both = true
      ctx.insight(F(K.insights[1]), K.insights[1].detail)
    }
  })
  ctx.onCleanup(() => ride?.cancel())
}
