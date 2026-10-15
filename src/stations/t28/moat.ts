import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { blob, stroke, type Pt } from '../../ui/part2/ink'
import { C } from './data'
import { f1, frame } from './frame'

const G = C.scenes.moat
const ANG = [200, 335, 95] // where each boat waits on the moat (degrees, 0 = east, y down)

/** A stone castle on an island, a black moat of moonlight, countless bamboo bridges (CUDA) — and three lantern boats rowing in. */
export function moatScene(ctx: SceneCtx) {
  const card = h('div', { class: 't28m-read' }, h('p', { class: 'p2-question' }, G.group))
  const panel = h('div', { class: 'gf-panel t28m-panel', 'aria-live': 'polite' }, card)
  const { root, over } = frame(ctx, 't28m', [G.insight as Fact], panel, draw)
  ctx.prompt(G.prompt)
  const seen = new Set<number>()
  const boats = G.boats.map((b, i) =>
    h('button', { class: 'gf-hit t28m-boat', type: 'button', 'aria-pressed': 'false', 'aria-label': fill(G.boatAria, { name: b.name }), onClick: () => pick(i) },
      s('svg', { viewBox: '-40 -40 80 56', 'aria-hidden': 'true' },
        s('ellipse', { class: 't28m-glow', cx: 6, cy: -18, rx: 26, ry: 22, fill: 'url(#p2-halo)' }),
        s('path', { class: 'gf-ink', d: 'M-34 0Q0 14 34 0L28 8Q0 18 -28 8Z' }),
        s('path', { class: 'gf-ink', d: stroke([[6, 2], [6, -24]], 2) + stroke([[-18, 3], [-30, 16]], 2.4) }),
        s('rect', { class: 'gf-lantern t28m-lamp', x: 1, y: -30, width: 10, height: 13, rx: 4 })),
      h('span', { class: 'gf-tagline' }, b.name)))
  over.append(...boats)

  function pick(i: number) {
    boats.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)))
    boats[i].classList.add('near')
    seen.add(i)
    const b = G.boats[i]
    card.replaceChildren(h('p', { class: 'gf-who' }, b.name), ctx.fact(b.fact as Fact, 'p', 'gf-new'))
    if (seen.size === G.boats.length && !root.classList.contains('all')) {
      root.classList.add('all')
      ctx.insight(G.insight as Fact, G.detail as Fact)
      ctx.chime('ok')
    } else ctx.chime('soft')
  }

  function draw(w: number, hh: number) {
    const svg = root.querySelector('svg')!
    const cx = w / 2, cy = hh * 0.5
    const RX = Math.min(w * 0.46, hh * 0.95), RY = Math.min(RX * 0.5, hh * 0.42)
    const ix = RX * 0.5, iy = RY * 0.5
    const mid = (a: number, k: number): Pt => [cx + Math.cos(a) * RX * k, cy + Math.sin(a) * RY * k]
    // bamboo bridges across the moat: the code everyone already walks on
    let bridges = ''
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + 0.11
      const p = mid(a, 0.5), q = mid(a, 0.9)
      bridges += stroke([p, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2 - 3], q], Math.max(2, RX * 0.012), 0.1, 0.1, 0.5)
    }
    // the castle: walls, three towers, a gate
    const bw = ix * 0.9, bh = iy * 1.5, base = cy + iy * 0.2
    const tower = (x: number, tw: number, th: number) => `M${f1(x - tw / 2)} ${f1(base)}V${f1(base - th)}h${f1(tw)}V${f1(base)}Z`
    const merlons = (x: number, y: number, tw: number) => Array.from({ length: 3 }, (_, k) => `M${f1(x - tw / 2 + (k * tw) / 2.5)} ${f1(y)}h${f1(tw / 5)}v${f1(-tw / 6)}h${f1(-tw / 5)}Z`).join('')
    const castle = s('g', { class: 't28m-castle' },
      s('path', { class: 't28m-wall', fill: 'url(#p2-rock)', d: `M${f1(cx - bw / 2)} ${f1(base)}V${f1(base - bh * 0.55)}H${f1(cx + bw / 2)}V${f1(base)}Z` + tower(cx - bw / 2, bw * 0.24, bh * 0.85) + tower(cx + bw / 2, bw * 0.24, bh * 0.85) + tower(cx, bw * 0.3, bh) }),
      s('path', { class: 'gf-ink', d: merlons(cx - bw / 2, base - bh * 0.85, bw * 0.24) + merlons(cx + bw / 2, base - bh * 0.85, bw * 0.24) + merlons(cx, base - bh, bw * 0.3) }),
      s('path', { class: 'gf-ink', d: `M${f1(cx - bw * 0.07)} ${f1(base)}v${f1(-bh * 0.22)}a${f1(bw * 0.07)} ${f1(bw * 0.07)} 0 0 1 ${f1(bw * 0.14)} 0v${f1(bh * 0.22)}Z` }),
      s('path', { class: 'gf-ink-s', 'stroke-width': 1.4, d: `M${f1(cx - bw / 2 - bw * 0.12)} ${f1(base)}H${f1(cx + bw / 2 + bw * 0.12)}` }),
      s('rect', { class: 'gf-lantern', x: f1(cx - 3), y: f1(base - bh * 0.7), width: 6, height: 8, rx: 2 }),
      s('text', { class: 'gf-title', x: f1(cx), y: f1(base + iy * 0.55), 'text-anchor': 'middle' }, G.castle))
    const mr = Math.min(RX * 0.08, 30)
    svg.replaceChildren(
      s('ellipse', { cx: f1(cx + RX * 0.62), cy: f1(cy - RY * 1.02), rx: f1(mr * 3.4), ry: f1(mr * 3.4), fill: 'url(#p2-halo)' }),
      s('circle', { class: 'gf-moon', cx: f1(cx + RX * 0.62), cy: f1(cy - RY * 1.02), r: f1(mr) }),
      s('path', { class: 't28m-bank', d: blob(cx, cy + 4, RX * 1.04, RY * 1.08, 5, 0.03, 28) }),
      s('path', { class: 'gf-water', d: blob(cx, cy, RX, RY, 9, 0.03, 28) }),
      s('path', { class: 'gf-glint', d: `M${f1(cx + RX * 0.5)} ${f1(cy + RY * 0.62)}h${f1(RX * 0.16)}M${f1(cx + RX * 0.45)} ${f1(cy + RY * 0.72)}h${f1(RX * 0.24)}M${f1(cx + RX * 0.52)} ${f1(cy + RY * 0.8)}h${f1(RX * 0.1)}` }),
      s('path', { class: 't28m-bridge', d: bridges }),
      s('path', { class: 't28m-island', d: blob(cx, cy, ix, iy, 13, 0.06), fill: 'url(#p2-rock)' }),
      castle,
      s('text', { class: 'gf-label t28m-cuda', x: 4, y: 16 }, G.moatLabel))
    const bwPx = Math.max(64, Math.min(104, RX * 0.3))
    boats.forEach((b, i) => {
      const a = (ANG[i] * Math.PI) / 180
      const [x, y] = mid(a, 0.98)
      const [nx, ny] = mid(a, 0.72)
      Object.assign(b.style, { left: `${f1(Math.max(30, Math.min(w - bwPx - 30, x - bwPx / 2)))}px`, top: `${f1(y - bwPx * 0.55)}px`, width: `${f1(bwPx)}px` })
      b.style.setProperty('--dx', `${f1(nx - x)}px`)
      b.style.setProperty('--dy', `${f1(ny - y)}px`)
    })
  }
}
