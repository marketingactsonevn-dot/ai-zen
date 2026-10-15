import { h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { blob, stroke } from '../../ui/part2/ink'
import { C } from './data'
import { f1, frame } from '../t28/frame'

const G = C.scenes.gate

/** One garden, one gate: a lime wall with a little window (closed model) or a bamboo gate thrown open, saplings carried home (open weights). */
export function gateScene(ctx: SceneCtx) {
  let isOpen = false
  const seen = new Set<boolean>([false])
  const seg = (o: boolean) => h('button', { class: 'btn', type: 'button', 'aria-pressed': String(o === isOpen), onClick: () => set(o) }, o ? G.open : G.closed)
  const bC = seg(false), bO = seg(true)
  const rows = G.tradeoffs.map((t) => h('div', { class: 't30g-row' }, h('dt', null, t.name), h('dd', null, t.closed)))
  const dl = h('dl', { class: 't30g-list', 'aria-live': 'polite' }, ...rows)
  const note = h('p', { class: 't30g-note' })
  const panel = h('div', { class: 'gf-panel t30g-panel' }, h('div', { class: 'gf-seg', role: 'group', 'aria-label': G.toggleAria }, bC, bO), h('p', { class: 'gf-eyebrow' }, G.tradeoffLabel), dl, note)
  const { root } = frame(ctx, 't30g', [G.insight as Fact], panel, draw)
  ctx.prompt(G.prompt)

  function set(o: boolean) {
    if (o === isOpen) return
    isOpen = o
    bC.setAttribute('aria-pressed', String(!o))
    bO.setAttribute('aria-pressed', String(o))
    root.classList.toggle('open', o)
    G.tradeoffs.forEach((t, i) => { (rows[i].lastChild as HTMLElement).textContent = o ? t.open : t.closed })
    seen.add(o)
    if (seen.size === 2 && !note.textContent) {
      note.textContent = G.caveat
      ctx.insight(G.insight as Fact, G.detail as Fact)
      ctx.chime('ok')
    } else ctx.chime('soft')
  }

  function draw(w: number, hh: number) {
    const svg = root.querySelector('svg')!
    const wy = hh * 0.6 // foot of the wall
    const wh = Math.min(hh * 0.28, w * 0.2)
    const gx = w / 2, gw = Math.min(w * 0.2, wh * 1.3)
    const capH = Math.max(8, wh * 0.13)
    // the garden behind the wall: trees and a flowering branch peeping over
    const trees = [0.14, 0.3, 0.72, 0.88].map((k, i) => s('path', { class: 't30g-tree', d: blob(w * k, wy - wh - hh * 0.05, w * 0.09, hh * 0.1, 50 + i, 0.18) }))
    const blossoms = [0.2, 0.26, 0.78, 0.82, 0.68].map((k, i) => s('circle', { class: 't30g-flower', cx: f1(w * k), cy: f1(wy - wh - hh * (0.06 + (i % 3) * 0.03)), r: 3.2 }))
    const wall = (xa: number, xb: number) => s('g', null,
      s('rect', { class: 't30g-wall', x: f1(xa), y: f1(wy - wh), width: f1(xb - xa), height: f1(wh), fill: 'url(#p2-rock)' }),
      s('rect', { class: 't30g-plinth', x: f1(xa), y: f1(wy - wh * 0.16), width: f1(xb - xa), height: f1(wh * 0.16) }),
      s('path', { class: 'gf-ink', d: stroke([[xa - 6, wy - wh], [xb + 6, wy - wh - 1]], capH, 0.03, 0.03, 0.7) }))
    const door = (side: -1 | 1) => s('g', { class: `t30g-door t30g-door-${side < 0 ? 'l' : 'r'}`, style: `transform-origin:${f1(gx + (side * gw) / 2)}px ${f1(wy)}px` },
      s('rect', { class: 't30g-bamboo', x: f1(side < 0 ? gx - gw / 2 : gx), y: f1(wy - wh * 0.9), width: f1(gw / 2), height: f1(wh * 0.9) }),
      s('path', { class: 'gf-ink-s', 'stroke-width': 1.2, d: Array.from({ length: 4 }, (_, i) => `M${f1((side < 0 ? gx - gw / 2 : gx) + (gw / 8) * (i + 0.5))} ${f1(wy - wh * 0.9)}v${f1(wh * 0.9)}`).join('') + `M${f1(side < 0 ? gx - gw / 2 : gx)} ${f1(wy - wh * 0.6)}h${f1(gw / 2)}` }))
    const lantern = (x: number) => s('g', null,
      s('ellipse', { cx: f1(x), cy: f1(wy - wh - 14), rx: 34, ry: 34, fill: 'url(#p2-halo)' }),
      s('rect', { class: 'gf-lantern', x: f1(x - 6), y: f1(wy - wh - 22), width: 12, height: 15, rx: 4 }))
    // saplings in pots, carried out into the visitor's own yard
    const pots = [-1.3, 0, 1.25].map((k, i) => {
      const x = gx + k * gw * 0.9, y = wy + (hh - wy) * (0.45 + (i % 2) * 0.2)
      return s('g', { class: 't30g-pot', style: `--i:${i}` },
        s('path', { class: 'gf-ink', d: `M${f1(x - 9)} ${f1(y - 12)}h18l-3 12h-12z` }),
        s('path', { class: 't30g-tree', d: blob(x, y - 24, 10, 12, 60 + i, 0.2) }),
        s('path', { class: 'gf-ink', d: stroke([[x, y - 12], [x, y - 22]], 2) }))
    })
    svg.replaceChildren(
      s('ellipse', { cx: f1(w * 0.5), cy: f1(hh * 0.1), rx: 70, ry: 70, fill: 'url(#p2-halo)' }),
      s('circle', { class: 'gf-moon', cx: f1(w * 0.5), cy: f1(hh * 0.1), r: 15 }),
      ...trees, ...blossoms,
      ...[0, 1, 2, 3].map((i) => s('ellipse', { class: 't30g-step', cx: f1(gx + (i % 2 ? 6 : -6)), cy: f1(wy + (hh - wy) * (0.14 + i * 0.22)), rx: f1(gw * (0.18 + i * 0.04)), ry: f1(5 + i * 2) })),
      wall(w * 0.03, gx - gw / 2), wall(gx + gw / 2, w * 0.97),
      s('rect', { class: 't30g-inside', x: f1(gx - gw / 2), y: f1(wy - wh * 0.9), width: f1(gw), height: f1(wh * 0.9) }),
      s('path', { class: 't30g-tree', d: blob(gx, wy - wh * 0.35, gw * 0.3, wh * 0.3, 77, 0.2) }),
      door(-1), door(1),
      s('g', { class: 't30g-window' },
        s('rect', { class: 't30g-hole', x: f1(gx - gw * 0.12), y: f1(wy - wh * 0.62), width: f1(gw * 0.24), height: f1(wh * 0.22), rx: 3 }),
        s('circle', { class: 't30g-flower', cx: f1(gx), cy: f1(wy - wh * 0.51), r: 4 })),
      s('rect', { class: 't30g-post', x: f1(gx - gw / 2 - 7), y: f1(wy - wh - 4), width: 7, height: f1(wh + 4) }),
      s('rect', { class: 't30g-post', x: f1(gx + gw / 2), y: f1(wy - wh - 4), width: 7, height: f1(wh + 4) }),
      lantern(gx - gw / 2 - 4), lantern(gx + gw / 2 + 4),
      ...pots)
  }
}
