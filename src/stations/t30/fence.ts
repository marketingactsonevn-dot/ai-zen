import { h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { stroke } from '../../ui/part2/ink'
import { C } from './data'
import { f1, frame } from '../t28/frame'

const G = C.scenes.fence

/** A bamboo fence tied with thorn rope round one very bright lamp that lights every crack in the city wall; only stamped lanterns pass. */
export function fenceScene(ctx: SceneCtx) {
  const read = h('div', { class: 't30f-read', 'aria-live': 'polite' })
  const more = h('div', { class: 't30f-more' })
  const panel = h('div', { class: 'gf-panel t30f-panel' }, read, more)
  const { root, over } = frame(ctx, 't30f', [G.insight as Fact], panel, draw)
  ctx.prompt(G.prompt)
  const gate = h('button', { class: 'gf-hit t30f-gate', type: 'button', 'aria-label': G.gateAria, onClick: knock }, h('span', { class: 'gf-tagline' }, G.gate))
  const guards = G.cases.map((c, i) => h('button', { class: 'gf-hit t30f-guard', type: 'button', 'aria-pressed': 'false', onClick: () => pick(i) },
    s('svg', { viewBox: '-20 -46 40 50', 'aria-hidden': 'true' },
      s('ellipse', { cx: 9, cy: -26, rx: 18, ry: 18, fill: 'url(#p2-halo)' }),
      s('path', { class: 'gf-ink', d: 'M-6 0L-4 -26Q0 -32 4 -26L6 0Z' }),
      s('circle', { class: 'gf-ink', cx: 0, cy: -34, r: 5 }),
      s('path', { class: 'gf-ink', d: stroke([[3, -22], [9, -30]], 2) }),
      s('rect', { class: 'gf-lantern', x: 5, y: -30, width: 9, height: 11, rx: 3 }),
      s('circle', { class: 't30f-seal', cx: 9.5, cy: -24.5, r: 2.2 })),
    h('span', { class: 'gf-tagline' }, c.name)))
  over.append(gate, ...guards)
  const seen = new Set<number>()
  read.append(h('p', { class: 'p2-question' }, G.group))

  function knock() {
    root.classList.remove('shake')
    void root.offsetWidth
    root.classList.add('shake', 'knocked')
    read.replaceChildren(h('p', { class: 't30f-denied gf-new' }, G.denied))
    if (!more.childElementCount) more.append(h('p', { class: 'gf-eyebrow' }, G.whyLabel), ctx.fact(G.why as Fact, 'p', 'gf-new'))
    ctx.chime('soft')
  }

  function pick(i: number) {
    guards.forEach((g, k) => g.setAttribute('aria-pressed', String(k === i)))
    seen.add(i)
    read.replaceChildren(h('p', { class: 'gf-who' }, G.cases[i].name), ctx.fact(G.cases[i].fact as Fact, 'p', 'gf-new'))
    if (seen.size === G.cases.length && !root.classList.contains('all')) {
      root.classList.add('all')
      more.append(h('p', { class: 'gf-eyebrow t30f-gap' }, G.debateLabel), ctx.fact(G.debate as Fact, 'p', 'gf-new'))
      ctx.insight(G.insight as Fact, G.detail)
      ctx.chime('ok')
    } else ctx.chime('soft')
  }

  function draw(w: number, hh: number) {
    const svg = root.querySelector('svg')!
    const cx = w / 2, cy = hh * 0.6
    const rx = Math.min(w * 0.3, hh * 0.55), ry = rx * 0.36
    const wy = hh * 0.2, wallH = Math.min(hh * 0.14, 60)
    // the city wall far behind, with cracks the lamp picks out
    let mer = ''
    for (let x = w * 0.02; x < w * 0.98; x += 26) mer += `M${f1(x)} ${f1(wy - wallH)}h14v-8h-14z`
    const cracks = [0.15, 0.36, 0.63, 0.86].map((k) => [w * k, wy - wallH * 0.5] as [number, number])
    const lampY = cy - ry * 0.3
    // the fence: posts round the ellipse, back half first, with thorn knots on the rope
    let posts = '', thorns = ''
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * Math.PI * 2
      if (Math.abs(a - Math.PI / 2) < 0.18) continue // the gate, front centre
      const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry
      const ph = ry * 0.9 + Math.sin(a * 3) * 2
      posts += `M${f1(x)} ${f1(y)}v${f1(-ph)}`
      thorns += `M${f1(x - 3)} ${f1(y - ph * 0.6 - 3)}l6 6m0 -6l-6 6`
    }
    svg.replaceChildren(
      s('rect', { class: 't30f-wall', x: f1(w * 0.02), y: f1(wy - wallH), width: f1(w * 0.96), height: f1(wallH), fill: 'url(#p2-rock)' }),
      s('path', { class: 'gf-ink', d: mer }),
      s('path', { class: 't30f-beam', d: cracks.map(([x, y]) => `M${f1(cx - 4)} ${f1(lampY)}L${f1(x - 10)} ${f1(y)}L${f1(x + 10)} ${f1(y)}Z`).join('') }),
      s('path', { class: 't30f-crack', d: cracks.map(([x, y]) => `M${f1(x - 6)} ${f1(y - wallH * 0.35)}l5 8l-4 6l6 9`).join('') }),
      s('ellipse', { class: 't30f-ground', cx: f1(cx), cy: f1(cy), rx: f1(rx * 1.02), ry: f1(ry * 1.04) }),
      s('ellipse', { cx: f1(cx), cy: f1(lampY), rx: f1(rx * 0.8), ry: f1(rx * 0.8), fill: 'url(#p2-halo)' }),
      s('path', { class: 'gf-ink-s', 'stroke-width': 1.4, d: `M${f1(cx)} ${f1(cy)}V${f1(lampY + 8)}` }),
      s('circle', { class: 't30f-lamp', cx: f1(cx), cy: f1(lampY), r: f1(Math.max(7, rx * 0.06)) }),
      s('path', { class: 't30f-post', d: posts, 'stroke-width': f1(Math.max(2.5, rx * 0.02)) }),
      s('ellipse', { class: 't30f-rope', cx: f1(cx), cy: f1(cy - ry * 0.55), rx: f1(rx), ry: f1(ry) }),
      s('path', { class: 't30f-thorn', d: thorns }))
    const gw = Math.max(70, rx * 0.4)
    Object.assign(gate.style, { left: `${f1(cx - gw / 2)}px`, top: `${f1(cy + ry - 16)}px`, width: `${f1(gw)}px`, height: '44px' })
    const gx = [cx - rx * 1.22, cx + rx * 1.22], gW = Math.max(56, Math.min(84, rx * 0.34))
    guards.forEach((g, i) => Object.assign(g.style, { left: `${f1(Math.max(4, Math.min(w - gW * 1.6 - 4, gx[i] - gW * 0.8)))}px`, top: `${f1(cy - gW * 0.9)}px`, width: `${f1(gW * 1.6)}px` }))
  }
}
