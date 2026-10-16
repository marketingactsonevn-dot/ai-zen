import { fill, h, s } from '../../core/dom'
import { blob, rng, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import { grass, mist, moon, reeds, toro } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import C from '../../content/tram-25.json'
import { F, P, broken, f1, offset, place, smooth, stage } from './kit'

const LONG: Pt[] = [[0.2, 0], [0.28, -0.32], [0.4, -0.78], [0.52, -0.45], [0.64, -0.86], [0.78, -0.58], [0.9, -0.74], [1.02, -0.6]]
const SHORT: Pt[] = [[0.2, 0], [0.32, 0.24], [0.5, 0.36], [0.7, 0.42], [0.86, 0.48], [1.02, 0.5]]

/** Ink flow lines along a stretch of water: short dry strokes at random offsets inside it. */
function flows(pts: Pt[], wd: number, seed: number, n: number) {
  const r = rng(seed)
  let d = ''
  for (let i = 0; i < n; i++) {
    const a = Math.floor(r() * (pts.length - 10))
    d += stroke(offset(pts.slice(a, a + 5 + Math.floor(r() * 12)), (r() - 0.5) * wd * 0.62), 1 + r() * 1.5, 0.25, 0.4, 0.1)
  }
  return d
}

/** A paper boat, side on, about 30 × 18 around (0, 0). */
function paperBoat(): SVGElement[] {
  const hull: Pt[] = [[-14, -1], [-9, 6], [9, 6], [14, -1]]
  return [
    s('ellipse', { class: 't25c-boat-sh', cx: 1.5, cy: 7, rx: 13, ry: 2.2 }),
    s('path', { class: 't25c-paper', d: `M${hull.map(P).join('L')}Z` }),
    s('path', { class: 't25c-paper2', d: 'M-14 -1L-9 6L-4.5 -1ZM14 -1L9 6L4.5 -1Z' }),
    s('path', { class: 't25c-paper', d: 'M-6.5 -1L0 -12.5L6.5 -1Z' }),
    s('path', { class: 't25c-fold', d: stroke([...hull, [-14, -1]], 1.1, 0.05, 0.05, 0.5) + stroke([[-6.5, -1], [0, -12.5], [6.5, -1]], 1, 0.1, 0.1, 0.5) + stroke([[0, -12], [0.3, -1]], 0.7, 0.2, 0.2, 0.4) + stroke([[-14, -1], [14, -1]], 0.8, 0.1, 0.1, 0.4) }),
  ]
}

/** Two stone posts on the banks and a board across the channel between them: `.t25c-plank` slides out when the gate opens. */
function sluice(c: Pt, dir: Pt, wd: number, seed: number) {
  const n: Pt = [-dir[1], dir[0]]
  const at = (k: number): Pt => [c[0] + n[0] * wd * k, c[1] + n[1] * wd * k]
  const ps = wd * 0.3
  const post = (p: Pt, i: number) => [
    s('path', { class: 't25c-post', d: blob(p[0], p[1], ps, ps * 0.9, seed + i, 0.16, 8), fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
    s('path', { class: 'zk-ink t25c-post-ink', d: stroke([[p[0] - ps * 0.7, p[1] + ps * 0.55], [p[0] + ps * 0.2, p[1] + ps * 0.85], [p[0] + ps * 0.85, p[1] + ps * 0.2]], Math.max(1.4, ps * 0.22), 0.2, 0.2, 0.2) }),
  ]
  const a = at(-0.62), b = at(0.62)
  const plank = s('g', { class: 't25c-plank', style: `--ox:${f1(-dir[0] * wd * 0.55)}px;--oy:${f1(-dir[1] * wd * 0.55)}px` },
    s('path', { class: 't25c-board', d: stroke([a, b], wd * 0.24, 0.02, 0.02, 0.9), filter: 'url(#ink-rough)' }),
    s('path', { class: 'zk-ink t25c-grain', d: stroke(offset([a, b], wd * 0.04), 0.8, 0.2, 0.2, 0.3) }))
  return s('g', { class: 't25c-sluice' }, plank, ...post(a, 0), ...post(b, 1))
}

/** Scene 2 — a moonlit stream seen from above splits round the reeds: turn the inner current and watch the paper boat. */
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
    s('svg', { viewBox: '-16 -14 32 23', width: 38, height: 27, 'aria-hidden': 'true' }, ...paperBoat()))
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
    const A = land ? (H - y0) * 0.4 : W * 0.4
    const M = ([u, v]: Pt): Pt => (land ? [W * 0.07 + u * L, y0 + (H - y0) * 0.5 + v * A] : [W * 0.5 + v * A, y0 + 8 + u * L])
    const head = smooth([[land ? -0.12 : -0.03, 0], [0.1, 0.03], [0.2, 0]]).map(M)
    const lg = smooth(LONG).map(M)
    const sh = smooth(SHORT).map(M)
    const ww = Math.max(16, A * 0.2)
    const path = (pts: Pt[]) => `path('M${pts.map(P).join('L')}')`
    paths = [path([...head, ...lg.slice(1)]), path(head), path([...head, ...sh.slice(1)])]
    const r = rng(2520)
    const end = lg[lg.length - 1], send = sh[sh.length - 1]
    const lt = Math.min(W, H) * (land ? 0.16 : 0.13)
    const tor = land ? M([0.95, -1.0]) : M([0.78, -1.08])
    const mo = land ? [W * 0.9, y0 + 30] : [W * 0.86, y0 + 26]
    const mr = Math.min(W, H) * 0.028
    // the moon's reflection on the long branch, where it runs widest
    const ri = Math.round(lg.length * 0.4), [rx, ry] = lg[ri]
    const dirAt = (pts: Pt[], i: number): Pt => {
      const [a, b] = [pts[Math.max(0, i - 2)], pts[Math.min(pts.length - 1, i + 2)]]
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
      return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]
    }
    const nearest = (pts: Pt[], p: Pt) => pts.reduce((bi, q, i) => (Math.hypot(q[0] - p[0], q[1] - p[1]) < Math.hypot(pts[bi][0] - p[0], pts[bi][1] - p[1]) ? i : bi), 0)
    const g1 = nearest(lg, M([0.25, -0.2])), g2 = nearest(sh, M([0.25, 0.2]))
    const gi1 = Math.max(g1, 5), gi2 = Math.max(g2, 5)
    // ground: tufts and a few stones along the outer banks, reeds on the island and thick along the short cut
    const tufts = [0.12, 0.33, 0.5, 0.66, 0.82].map((t, i) => {
      const k = Math.round(t * (lg.length - 1)), p = offset([lg[Math.max(0, k - 1)], lg[k], lg[Math.min(lg.length - 1, k + 1)]], -ww * 0.9)[1]
      return grass(p[0], p[1], 16 + r() * 10, 2530 + i)
    })
    const isl = Array.from({ length: 5 }, (_, i) => M([0.36 + i * 0.12, -0.05 + (i % 2) * 0.1]))
    const shortReeds = sh.filter((_, i) => i > 12 && i % 7 === 3).flatMap((p, i) => {
      const k = sh.indexOf(p)
      const two = offset([sh[k - 1], p, sh[k + 1]], ww * 0.75)[1], one = offset([sh[k - 1], p, sh[k + 1]], -ww * 0.75)[1]
      return [reeds(one[0], one[1], Math.max(24, A * 0.2), 2540 + i, 6), reeds(two[0], two[1], Math.max(20, A * 0.17), 2560 + i, 5)]
    })
    const stones: [number, number, number][] = [[0.27, 0.02, 0.7], [0.33, -0.08, 0.5], [0.58, -0.98, 0.9]]
    // moss on both banks: a soft wash wider than the water, and dots of moss along its edge
    const banksOf: [Pt[], number][] = [[head, ww * 1.15], [lg, ww], [sh, ww * 0.9]]
    // moss on both banks: a soft wash wider than the water, then clusters of moss dots along its edge
    let dots = ''
    banksOf.forEach(([p, wd]) => {
      for (const side of [-1, 1]) {
        const o = offset(p, side * wd * 0.85)
        for (let k = 1; k < o.length - 1; k += 3 + Math.floor(r() * 5)) {
          if (r() < 0.3) continue
          const [x, y] = o[k]
          for (let j = 2 + Math.floor(r() * 5); j > 0; j--) {
            const dx = (r() - 0.5) * wd * 0.9, dy = (r() - 0.5) * wd * 0.6, sz = 2.6 + r() * 3.2
            dots += stroke([[x + dx, y + dy], [x + dx + sz * 0.8, y + dy + sz * 0.5]], sz, 0.35, 0.35, 0.45)
          }
        }
      }
    })
    // the open ground: a few tufts out in it
    const field = Array.from({ length: 7 }, (_, i) => {
      const p = M([0.05 + i * 0.15 + r() * 0.05, (i % 2 ? 1 : -1) * (1.05 + r() * 0.25)])
      return grass(p[0], p[1], 14 + r() * 10, 2610 + i)
    })
    svg.replaceChildren(
      mist(mo[0], mo[1], W * 0.25, H * 0.12),
      moon(mo[0], mo[1], mr, 2521, true),
      s('path', { class: 't25c-moss', d: banksOf.map(([p, wd]) => stroke(p, wd * 2.5, 0.05, 0.08, 0.5)).join(''), filter: 'url(#ink-wash)' }),
      ...field,
      s('path', { class: 't25c-dots', d: dots }),
      s('path', { class: 't25c-water', d: stroke(head, ww * 1.15, 0.02, 0.02, 0.8) + stroke(lg, ww, 0.02, 0.05, 0.6) + stroke(sh, ww * 0.9, 0.02, 0.05, 0.6), filter: 'url(#ink-wash)' }),
      s('path', { class: 't25c-shine', d: stroke(head, ww * 0.42, 0.1, 0.1, 0.3) + stroke(lg, ww * 0.32, 0.05, 0.2, 0.3) + stroke(sh, ww * 0.3, 0.05, 0.2, 0.3) }),
      s('ellipse', { class: 'zk-moonink t25c-refl', cx: f1(rx), cy: f1(ry), rx: f1(ww * 0.34), ry: f1(ww * 0.3) }),
      s('path', { class: 'zk-moonink t25c-refl2', d: [-1, 0, 1].map((k) => stroke([[rx - ww * (0.45 - Math.abs(k) * 0.1), ry + k * ww * 0.36 + ww * 0.05], [rx + ww * (0.45 - Math.abs(k) * 0.1), ry + k * ww * 0.36]], 1.6, 0.3, 0.3, 0.2)).join('') }),
      s('path', { class: 't25c-flow', d: flows(head, ww * 1.15, 2522, 10) }),
      longG = s('g', { class: 't25c-branch' }, s('path', { d: flows(lg, ww, 2523, 34) })),
      shortG = s('g', { class: 't25c-branch' }, s('path', { d: flows(sh, ww * 0.9, 2524, 24) })),
      s('path', { class: 'zk-ink t25c-bank', d: [[head, ww * 1.15], [lg.slice(3), ww], [sh.slice(3), ww * 0.9]].map(([p, wd], i) => broken(offset(p as Pt[], (wd as number) / 2 + 1.5), 2.4, 2525 + i, 0.8) + broken(offset(p as Pt[], -(wd as number) / 2 - 1.5), 2.4, 2528 + i, 0.8)).join(''), filter: 'url(#ink-rough)' }),
      ...tufts,
      ...stones.map(([u, v, k], i) => {
        const p = M([u, v])
        return s('g', { transform: `translate(${f1(p[0])} ${f1(p[1])})` }, stoneArt(ww * 1.4 * k, ww * 0.8 * k, 2570 + i))
      }),
      ...isl.map((p, i) => reeds(p[0], p[1] + 6, Math.max(26, A * 0.22), 2580 + i, 7)),
      ...shortReeds,
      s('path', { class: 't25c-pier', d: [0, 1, 2, 3].map((k) => {
        const c = offset(lg.slice(-6), ww * (0.1 - k * 0.32))[3]
        const d0 = dirAt(lg, lg.length - 3)
        return stroke([[c[0] - d0[0] * ww * 0.5, c[1] - d0[1] * ww * 0.5], [c[0] + d0[0] * ww * 0.5, c[1] + d0[1] * ww * 0.5]], ww * 0.22, 0.05, 0.05, 0.8)
      }).join(''), filter: 'url(#ink-rough)' }),
      toro(tor[0], tor[1] + lt * 0.5, lt, true),
      s('g', { class: 't25c-gate-0' }, sluice(lg[gi1], dirAt(lg, gi1), ww, 2590)),
      s('g', { class: 't25c-gate-1' }, sluice(sh[gi2], dirAt(sh, gi2), ww * 0.9, 2595)))
    // labels: each road's meaning at its end, each gate's word at its mouth
    const lw = Math.min(land ? 220 : W * 0.44, 240)
    const ga = lg[gi1], gb = sh[gi2]
    if (land) {
      place(careful, Math.min(end[0] - lw * 0.6, W - lw - 8), end[1] + ww, lw)
      place(shortcut, Math.min(send[0] - lw * 0.6, W - lw - 8), send[1] + ww, lw)
      place(gates[0], ga[0] - 60, ga[1] - ww - 28, 120)
      place(gates[1], gb[0] - 60, gb[1] + ww * 0.9, 120)
      place(said, 16, H - 8 - 150, Math.min(300, W * 0.26))
    } else {
      place(careful, 8, end[1] + 10, lw)
      place(shortcut, W - lw - 8, send[1] + 10, lw)
      place(gates[0], ga[0] - ww - 92, ga[1] - 10, 90)
      place(gates[1], gb[0] + ww + 4, gb[1] - 10, 90)
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
    longG.style.opacity = String([0.95, 0.45, 0.18][mood])
    shortG.style.opacity = String([0.15, 0.42, 0.95][mood])
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
