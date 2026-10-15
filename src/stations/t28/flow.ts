import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { blob, stoneArt, type Pt } from '../../ui/part2/ink'
import { C } from './data'
import { f1, frame } from './frame'

const G = C.scenes.loop
// step k carries the money to island TO[k]; the facts that belong to each step
const TO = [1, 2, 0, 0]
const FACT: (number | null)[] = [0, 2, null, 1]

/** Three stone islands on the moon lake; a silver stream runs NVIDIA → AI company → data centre → back to NVIDIA. */
export function flowScene(ctx: SceneCtx) {
  const list = h('ol', { class: 't28f-list' })
  const panel = h('div', { class: 'gf-panel t28f-panel', 'aria-live': 'polite' }, h('p', { class: 'gf-eyebrow' }, G.flowLabel), list)
  const { root, over } = frame(ctx, 't28f', [G.insight as Fact], panel, draw)
  ctx.prompt(G.prompt)
  let step = 0
  let arcs: SVGPathElement[] = []
  const isles = G.islands.map((name, i) =>
    h('button', { class: 'gf-hit t28f-isle', type: 'button', onClick: () => go(i) }, h('span', { class: 'gf-tagline' }, name)))
  over.append(...isles)
  mark()

  function mark() {
    isles.forEach((b, i) => {
      const next = step < TO.length && TO[step] === i
      b.classList.toggle('next', next)
      b.setAttribute('aria-label', next ? fill(G.flowAria, { n: step + 1, text: G.flow[step] }) : G.islands[i])
    })
  }

  function go(i: number) {
    if (step >= TO.length || TO[step] !== i) return
    const k = step++
    arcs[Math.min(k, 2)]?.classList.add('lit')
    const f = FACT[k]
    list.append(h('li', { class: 'gf-new' }, h('p', { class: 't28f-step' }, G.flow[k]), f == null ? null : ctx.fact(G.facts[f] as Fact, 'p', 't28f-fact')))
    list.lastElementChild?.scrollIntoView({ block: 'nearest' })
    mark()
    if (step === TO.length) {
      root.classList.add('round')
      ctx.insight(G.insight as Fact)
      ctx.chime('ok')
    } else ctx.chime('soft')
  }

  function draw(w: number, hh: number) {
    const svg = root.querySelector('svg')!
    const cx = w / 2, cy = hh * 0.52
    const rx = Math.min(w * 0.4, hh * 0.72), ry = Math.min(rx * 0.62, hh * 0.38)
    const pts: Pt[] = [[cx, cy - ry * 0.78], [cx + rx * 0.72, cy + ry * 0.5], [cx - rx * 0.72, cy + ry * 0.5]]
    const sw = Math.max(64, Math.min(130, rx * 0.36))
    // the stream bends outward between islands, drawn tail → head so the dash runs with the money
    arcs = [0, 1, 2].map((k) => {
      const a = pts[k], b = pts[(k + 1) % 3]
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2
      const ox = (mx - cx) * 0.55, oy = (my - cy) * 0.55
      const ra = sw * 0.42
      const dir = (p: Pt, q: Pt) => { const l = Math.hypot(q[0] - p[0], q[1] - p[1]); return [(q[0] - p[0]) / l, (q[1] - p[1]) / l] }
      const c: Pt = [mx + ox, my + oy]
      const [ax, ay] = dir(a, c), [bx, by] = dir(b, c)
      const d = `M${f1(a[0] + ax * ra)} ${f1(a[1] + ay * ra)}Q${f1(c[0])} ${f1(c[1])} ${f1(b[0] + bx * ra)} ${f1(b[1] + by * ra)}`
      return s('path', { class: 't28f-arc', d, pathLength: 1 })
    })
    if (step) arcs.slice(0, Math.min(step, 3)).forEach((a) => a.classList.add('lit'))
    svg.replaceChildren(
      s('ellipse', { cx: f1(w * 0.88), cy: f1(hh * 0.1), rx: 70, ry: 70, fill: 'url(#p2-halo)' }),
      s('circle', { class: 'gf-moon', cx: f1(w * 0.88), cy: f1(hh * 0.1), r: 16 }),
      s('path', { class: 'gf-water', d: blob(cx, cy, rx * 1.12, ry * 1.18, 21, 0.04, 28) }),
      s('path', { class: 'gf-glint', d: `M${f1(cx - rx * 0.1)} ${f1(cy + ry * 0.05)}h${f1(rx * 0.2)}M${f1(cx - rx * 0.16)} ${f1(cy + ry * 0.16)}h${f1(rx * 0.32)}M${f1(cx - rx * 0.06)} ${f1(cy + ry * 0.27)}h${f1(rx * 0.12)}` }),
      s('g', { class: 't28f-arcs' }, ...arcs.map((a) => s('path', { class: 't28f-bed', d: a.getAttribute('d')! })), ...arcs),
      ...pts.map((p, k) => s('g', { transform: `translate(${f1(p[0])} ${f1(p[1] + sw * 0.18)})` },
        s('ellipse', { class: 't28f-shore', cx: 0, cy: 0, rx: f1(sw * 0.62), ry: f1(sw * 0.16) }),
        stoneArt(sw * 0.8, sw * 0.42, 70 + k * 13))))
    isles.forEach((b, k) => {
      const [x, y] = pts[k]
      Object.assign(b.style, { left: `${f1(x - sw / 2)}px`, top: `${f1(y - sw * 0.2)}px`, width: `${f1(sw)}px`, height: `${f1(sw * 0.62)}px` })
    })
  }
}
