import './kit.css'
import { h, nextId, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { onSize, p2Defs, rng, stableHeight, stroke, type Pt } from '../../ui/part2/ink'
import type { SceneCtx } from '../types'

/** Garden 9 (stations 25–27) ink kit: one SVG layer + HTML controls over it, laid out once per size. */
export const F = (x: unknown) => x as Fact
export const f1 = (n: number) => n.toFixed(1)
export const P = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`

export function place(el: HTMLElement, x: number, y: number, w?: number) {
  el.style.left = `${f1(x)}px`
  el.style.top = `${f1(y)}px`
  if (w != null) el.style.width = `${f1(w)}px`
}

/**
 * The scene root: a hidden description of the art, one SVG layer, and `layout(W, H, Hraw)` on every size change
 * (H = the art height once the tallest insight is showing, so nothing jumps when it appears).
 */
export function stage(ctx: SceneCtx, cls: string, art: string, copies: unknown[], layout: (W: number, H: number, Hraw: number) => void) {
  p2Defs()
  if (!document.getElementById('zk-defs')) {
    const stop = (o: number, a: number) => s('stop', { offset: o, style: `stop-color:var(--lantern);stop-opacity:${a}` })
    document.body.append(s('svg', { id: 'zk-defs', width: 0, height: 0, 'aria-hidden': 'true', style: 'position:absolute' },
      s('defs', null, s('radialGradient', { id: 'zk-lamp' }, stop(0, 0.55), stop(0.4, 0.2), stop(1, 0)))))
  }
  const svg = s('svg', { class: 'zk-svg', 'aria-hidden': 'true' })
  const root = h('div', { class: `zk ${cls}` }, h('p', { class: 'visually-hidden' }, art), svg)
  ctx.art.append(root)
  const stable = stableHeight(ctx, copies as Fact[])
  const run = () => {
    const W = root.clientWidth, Hraw = root.clientHeight
    if (!W || !Hraw) return
    svg.setAttribute('viewBox', `0 0 ${W} ${Hraw}`)
    layout(W, stable(Hraw), Hraw)
  }
  ctx.onCleanup(onSize(root, run))
  return { root, svg }
}

/** A linear (vertical by default) or radial gradient whose stops read CSS tokens: returns `url(#id)`. */
export function grad(svg: SVGSVGElement, stops: [number, string, number][], kind: 'v' | 'h' | 'r' = 'v') {
  const id = nextId('zkg')
  const st = stops.map(([o, c, a]) => s('stop', { offset: o, style: `stop-color:var(${c});stop-opacity:${a}` }))
  const g = kind === 'r' ? s('radialGradient', { id }, ...st) : s('linearGradient', { id, x1: 0, y1: 0, x2: kind === 'h' ? 1 : 0, y2: kind === 'v' ? 1 : 0 }, ...st)
  svg.append(s('defs', null, g))
  return `url(#${id})`
}

/** The moon: a soft halo and a pale disc with a faint ink rim. */
export function moon(x: number, y: number, r: number) {
  return s('g', { class: 'zk-moon' },
    s('circle', { cx: x, cy: y, r: r * 3.2, fill: 'url(#p2-halo)' }),
    s('circle', { class: 'zk-moon-disc', cx: x, cy: y, r }))
}

/** Concentric ripples on water seen at an angle. */
export function rings(cx: number, cy: number, rx: number, ry: number, n = 3, cls = 'zk-ring') {
  return s('g', { class: cls }, ...Array.from({ length: n }, (_, i) => s('ellipse', { cx, cy, rx: rx * (1 + i * 0.55), ry: ry * (1 + i * 0.55), style: `--i:${i}` })))
}

/** Short horizontal brush dashes over water (light on the surface, like a script of ripples). */
export function dashes(x0: number, y0: number, w: number, hgt: number, n: number, seed: number, cls = 'zk-dash') {
  const r = rng(seed)
  let d = ''
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * w, y = y0 + r() * hgt, len = 10 + r() * 46
    d += stroke([[x, y], [x + len * 0.5, y - 1 - r()], [x + len, y]], 1.2 + r() * 1.8, 0.3, 0.4, 0.2)
  }
  return s('path', { class: cls, d })
}

/** A clump of reeds standing on (x, y): tapered blades leaning a little. */
export function reeds(x: number, y: number, n: number, hgt: number, seed: number) {
  const r = rng(seed)
  let d = ''
  for (let i = 0; i < n; i++) {
    const bx = x + (r() - 0.5) * hgt * 0.5, hh = hgt * (0.55 + r() * 0.45), lean = (r() - 0.5) * hgt * 0.4
    d += stroke([[bx, y], [bx + lean * 0.3, y - hh * 0.5], [bx + lean, y - hh]], 1.6 + r() * 1.4, 0.05, 0.8)
  }
  return s('path', { class: 'zk-reed', d, filter: 'url(#ink-rough)' })
}

/** A stone lantern (tōrō) standing on (x, y), `t` tall; its window (`.zk-win`) glows when the group has `.lit`. */
export function toro(x: number, y: number, t: number) {
  const u = t / 10
  const R = (x0: number, y0: number, w: number, hh: number) => `M${P([x + x0 - w / 2, y - y0])}h${f1(w)}v${f1(-hh)}h${f1(-w)}Z`
  const roof = `M${P([x - 2.6 * u, y - 7 * u])}Q${P([x - 1.2 * u, y - 7.3 * u])} ${P([x, y - 8.6 * u])}Q${P([x + 1.2 * u, y - 7.3 * u])} ${P([x + 2.6 * u, y - 7 * u])}L${P([x + 2.2 * u, y - 7.5 * u])}L${P([x - 2.2 * u, y - 7.5 * u])}Z`
  return s('g', { class: 'zk-toro' },
    s('ellipse', { class: 'zk-glow', cx: x, cy: y - 6 * u, rx: 6 * u, ry: 6 * u }),
    s('ellipse', { class: 'zk-sh', cx: x + u * 0.6, cy: y, rx: 2.6 * u, ry: 0.5 * u }),
    s('path', { class: 'zk-stone', d: R(0, 0, 3.4 * u, 0.9 * u) + R(0, 0.9 * u, 1.4 * u, 3.2 * u) + R(0, 4.1 * u, 3.2 * u, 0.7 * u), fill: 'url(#p2-rock)' }),
    s('path', { class: 'zk-stone', d: R(0, 4.8 * u, 2.3 * u, 2.2 * u), fill: 'url(#p2-rock)' }),
    s('path', { class: 'zk-win', d: R(0, 5.2 * u, 1.1 * u, 1.3 * u) }),
    s('path', { class: 'zk-stone', d: roof, fill: 'url(#p2-rock)' }),
    s('path', { class: 'zk-stone', d: `M${P([x - 0.35 * u, y - 8.5 * u])}q${f1(0.35 * u)} ${f1(-1.1 * u)} ${f1(0.7 * u)} 0Z`, fill: 'url(#p2-rock)' }))
}

/** Rake lines in the sand: gentle parallel curves between y0 and y1. */
export function rake(W: number, y0: number, y1: number, n: number, seed: number) {
  const r = rng(seed)
  let d = ''
  for (let i = 0; i < n; i++) {
    const y = y0 + ((y1 - y0) * (i + 0.5)) / n, a = (r() - 0.5) * 6
    d += `M${P([-10, y + a])}Q${P([W * 0.5, y - a - 4])} ${P([W + 10, y + a])}`
  }
  return s('path', { class: 'zk-rake', d })
}
