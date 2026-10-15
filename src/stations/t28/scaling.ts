import { fill, h, nextId, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { blob, stroke, type Pt } from '../../ui/part2/ink'
import { C } from './data'
import { clamp, f1, frame } from './frame'

const G = C.scenes.scaling
const TOTAL = 100

/** Share 100 silver drops between three stone jars (data · size · compute): the sapling grows only when all three are full together. */
export function scalingScene(ctx: SceneCtx) {
  const cid = nextId('t28s')
  const vals = G.jars.map(() => 0)
  const left = h('p', { class: 't28s-left' }, fill(G.remaining, { n: TOTAL }))
  const status = h('p', { class: 't28s-status', 'aria-live': 'polite' })
  const inputs = G.jars.map((j, i) => {
    const out = h('output', { class: 't28s-val' }, '0')
    const inp = h('input', { type: 'range', min: 0, max: TOTAL, step: 1, value: 0, 'aria-label': fill(G.slider, { name: j.name }), 'aria-valuetext': fill(G.valueText, { n: 0, name: j.name }) })
    inp.addEventListener('input', () => set(i, Number(inp.value), inp, out))
    return h('label', { class: 't28s-row', title: j.aria }, h('span', { class: 't28s-name' }, j.name), inp, out)
  })
  const panel = h('div', { class: 'gf-panel t28s-panel' }, ...inputs, left, status)
  const { root } = frame(ctx, 't28s', [...G.insights as Fact[]], panel, draw)
  ctx.prompt(G.prompt)

  let fills: SVGRectElement[] = []
  let jarH = 1, jarBase = 0
  let tree: SVGGElement | null = null
  let stage = 0 // 0 nothing yet · 1 first insight · 2 balanced

  function set(i: number, v: number, inp: HTMLInputElement, out: HTMLOutputElement) {
    const others = vals.reduce((a, b, k) => (k === i ? a : a + b), 0)
    v = Math.min(v, TOTAL - others)
    vals[i] = v
    inp.value = String(v)
    out.textContent = String(v)
    inp.setAttribute('aria-valuetext', fill(G.valueText, { n: v, name: G.jars[i].name }))
    update()
  }

  function update() {
    const sum = vals.reduce((a, b) => a + b, 0)
    left.textContent = fill(G.remaining, { n: TOTAL - sum })
    fills.forEach((r, i) => {
      const hh = jarH * clamp(vals[i] / 50, 0, 1)
      r.setAttribute('y', f1(jarBase - hh))
      r.setAttribute('height', f1(hh))
    })
    const lo = Math.min(...vals), hi = Math.max(...vals)
    const low = vals.indexOf(lo)
    const grow = clamp(lo / 30, 0, 1)
    const tilt = sum ? ((hi - lo) / TOTAL) * 26 * (low === 0 ? -1 : 1) : 0
    if (tree) tree.style.transform = `rotate(${f1(tilt)}deg) scale(${f1(0.3 + grow * 0.7)})`
    const balanced = lo >= 26 && hi - lo <= 10
    status.textContent = !sum ? '' : balanced ? G.balanced : fill(G.lopsided, { name: G.jars[low].name })
    root.classList.toggle('ok', balanced)
    if (sum && stage === 0) {
      stage = 1
      ctx.insight(G.insights[0] as Fact)
    }
    if (balanced && stage < 2) {
      stage = 2
      ctx.insight(G.insights[1] as Fact, G.detail)
      ctx.chime('ok')
    }
  }

  function draw(w: number, hh: number) {
    const svg = root.querySelector('svg')!
    const u = Math.min(w / 3.4, hh / 2.3)
    const ground = hh * 0.9
    const jw = Math.min(u * 0.72, w * 0.22), jh = Math.min(jw * 1.05, hh * 0.32)
    jarH = jh * 0.78
    jarBase = ground - jh * 0.08
    const xs = [w * 0.2, w * 0.5, w * 0.8]
    // the jar: a squat, wide-shouldered pot, mouth up
    const pot = (x: number) => {
      const p: Pt[] = [[x - jw * 0.28, ground - jh], [x - jw * 0.5, ground - jh * 0.7], [x - jw * 0.46, ground - jh * 0.2], [x - jw * 0.3, ground], [x + jw * 0.3, ground], [x + jw * 0.46, ground - jh * 0.2], [x + jw * 0.5, ground - jh * 0.7], [x + jw * 0.28, ground - jh]]
      return `M${p.map((q) => `${f1(q[0])} ${f1(q[1])}`).join('L')}Z`
    }
    fills = xs.map((x) => s('rect', { x: f1(x - jw * 0.5), y: f1(jarBase), width: f1(jw), height: 0 }))
    const jars = xs.map((x, i) => s('g', null,
      s('ellipse', { class: 't28s-shadow', cx: f1(x + jw * 0.05), cy: f1(ground + 2), rx: f1(jw * 0.5), ry: f1(jh * 0.07) }),
      s('path', { class: 't28s-jar', d: pot(x), fill: 'url(#p2-rock)' }),
      s('clipPath', { id: `${cid}-${i}` }, s('path', { d: pot(x) })),
      s('g', { 'clip-path': `url(#${cid}-${i})` }, s('g', { class: 't28s-fill' }, fills[i])),
      s('path', { class: 'gf-ink-s', d: pot(x), 'stroke-width': 1.6 }),
      s('ellipse', { class: 't28s-mouth', cx: f1(x), cy: f1(ground - jh), rx: f1(jw * 0.28), ry: f1(jh * 0.05) }),
      s('text', { class: 'gf-label', x: f1(x), y: f1(ground - jh - 10), 'text-anchor': 'middle' }, G.jars[i].name)))
    // the sapling stands behind the middle jar, rooted on a low mound
    const tx = w * 0.5, ty = ground - jh - 26, th = Math.min(hh * 0.5, ty - hh * 0.06)
    const trunk: Pt[] = [[tx, ty], [tx - th * 0.03, ty - th * 0.4], [tx + th * 0.02, ty - th * 0.75], [tx, ty - th]]
    tree = s('g', { class: 't28s-tree', style: `transform-origin:${f1(tx)}px ${f1(ty)}px` },
      s('path', { class: 'gf-ink', d: stroke(trunk, Math.max(4, th * 0.05), 0.05, 0.4, 0.25) }),
      s('path', { class: 'gf-ink', d: stroke([[tx, ty - th * 0.5], [tx - th * 0.22, ty - th * 0.72]], Math.max(2, th * 0.025)) + stroke([[tx, ty - th * 0.62], [tx + th * 0.24, ty - th * 0.82]], Math.max(2, th * 0.022)) }),
      ...[[-0.24, 0.76, 0.16], [0.25, 0.86, 0.15], [0, 1.02, 0.2], [-0.1, 0.88, 0.12], [0.12, 0.7, 0.11]].map(([dx, dy, r], i) =>
        s('path', { class: 't28s-leaf', d: blob(tx + dx * th, ty - dy * th, r * th, r * th * 0.72, 40 + i, 0.15) })))
    const sx = w * 0.08, sy = hh * 0.12
    svg.replaceChildren(
      s('ellipse', { cx: f1(w * 0.86), cy: f1(hh * 0.12), rx: f1(u * 0.5), ry: f1(u * 0.5), fill: 'url(#p2-halo)' }),
      s('circle', { class: 'gf-moon', cx: f1(w * 0.86), cy: f1(hh * 0.12), r: f1(u * 0.1) }),
      s('path', { class: 't28s-ground', d: stroke([[w * 0.03, ground + 2], [w * 0.5, ground + 4], [w * 0.97, ground + 1]], 3, 0.1, 0.1, 0.3) }),
      s('path', { class: 't28s-mound', d: blob(tx, ty + 4, th * 0.2, 7, 3, 0.1) }),
      tree,
      s('path', { class: 't28s-spout', d: stroke([[sx - 20, sy - 8], [sx + u * 0.6, sy + u * 0.12]], Math.max(5, u * 0.07), 0.02, 0.05, 0.6) }),
      s('g', { class: 't28s-drops' }, ...[0, 1, 2].map((i) => s('circle', { cx: f1(sx + u * 0.62), cy: f1(sy + u * 0.2), r: 2.6, style: `animation-delay:${i * 0.8}s` }))),
      ...jars)
    update()
  }
}
