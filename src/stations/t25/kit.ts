import './kit.css'
import { h, nextId, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { blob, curve, onSize, p2Defs, rng, stableHeight, stroke, type Pt } from '../../ui/part2/ink'
import type { SceneCtx, SceneDef } from '../types'
import type { PondGeo } from '../../ui/part2/perspectives'

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
  const defs = s('defs')
  DEFS.set(svg, defs)
  const root = h('div', { class: `zk ${cls}` }, h('p', { class: 'visually-hidden' }, art), svg)
  ctx.art.append(root)
  const stable = stableHeight(ctx, copies as Fact[])
  const run = () => {
    const W = root.clientWidth, Hraw = root.clientHeight
    if (!W || !Hraw) return
    svg.setAttribute('viewBox', `0 0 ${W} ${Hraw}`)
    defs.replaceChildren()
    layout(W, stable(Hraw), Hraw)
    svg.prepend(defs) // gradients made by grad() during this layout
  }
  ctx.onCleanup(onSize(root, run))
  return { root, svg }
}

const DEFS = new WeakMap<SVGSVGElement, SVGDefsElement>()

/** A linear (vertical by default) or radial gradient whose stops read CSS tokens, kept in the stage's defs: `url(#id)`. */
export function grad(svg: SVGSVGElement, stops: [number, string, number][], kind: 'v' | 'h' | 'r' = 'v', at?: [number, number, number, number]) {
  const id = nextId('zkg')
  const st = stops.map(([o, c, a]) => s('stop', { offset: o, style: `stop-color:var(${c});stop-opacity:${a}` }))
  const g = kind === 'r' ? s('radialGradient', { id }, ...st)
    : at ? s('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1: f1(at[0]), y1: f1(at[1]), x2: f1(at[2]), y2: f1(at[3]) }, ...st) // in scene px
    : s('linearGradient', { id, x1: 0, y1: 0, x2: kind === 'h' ? 1 : 0, y2: kind === 'v' ? 1 : 0 }, ...st)
  DEFS.get(svg)!.append(g)
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

/** The polyline moved sideways by d (left of travel when d > 0). */
export function offset(pts: Pt[], d: number): Pt[] {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    return [p[0] + ((b[1] - a[1]) / L) * d, p[1] - ((b[0] - a[0]) / L) * d] as Pt
  })
}

/** A line laid in short brush strokes with dry gaps between them (banks, edges, flow lines); `keep` = share of strokes drawn. */
export function broken(pts: Pt[], w: number, seed: number, keep = 0.85, run = 8): string {
  const r = rng(seed)
  let d = ''
  for (let i = 0; i < pts.length - 2; ) {
    const len = Math.max(2, Math.round(run * (0.5 + r())))
    const seg = pts.slice(i, i + len + 1)
    if (seg.length > 2 && r() < keep) d += stroke(seg, w * (0.6 + r() * 0.7), 0.15, 0.3, 0.12)
    i += len + 1 + Math.floor(r() * 3)
  }
  return d
}

/** Catmull-Rom through pts, `k` samples per segment. */
export function smooth(pts: Pt[], k = 10): Pt[] {
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

/** A character written in a few brush strokes (heng, shu, pie, na, dian) inside a `size` box whose top-left is (x, y). */
export function glyph(x: number, y: number, size: number, seed: number, w = size * 0.13): string {
  const r = rng(seed)
  const X = (u: number) => x + u * size, Y = (v: number) => y + v * size
  const j = () => (r() - 0.5) * 0.06
  const heng = (u0: number, u1: number, v: number) => stroke([[X(u0), Y(v + j())], [X((u0 + u1) / 2), Y(v - 0.03)], [X(u1), Y(v + 0.01 + j())]], w * (0.8 + r() * 0.4), 0.15, 0.25, 0.3)
  const shu = (u: number, v0: number, v1: number) => stroke([[X(u + j()), Y(v0)], [X(u + 0.01), Y((v0 + v1) / 2)], [X(u + j() * 0.5), Y(v1)]], w * (0.9 + r() * 0.4), 0.1, 0.35, 0.25)
  const dot = (u: number, v: number) => stroke([[X(u), Y(v)], [X(u + 0.08), Y(v + 0.1)]], w * 1.5, 0.3, 0.3, 0.4)
  let d = r() < 0.5 ? dot(0.45 + j(), 0.02) : heng(0.3, 0.7, 0.08)
  d += heng(0.08, 0.92, 0.32)
  if (r() < 0.65) d += shu(0.45 + j() * 2, 0.16, r() < 0.5 ? 0.95 : 0.6)
  const low = r()
  if (low < 0.4) {
    d += stroke(curve([X(0.48), Y(0.45)], [X(0.38), Y(0.75)], [X(0.08), Y(0.95)], 6), w, 0.1, 0.6, 0.15)
    d += stroke(curve([X(0.52), Y(0.5)], [X(0.66), Y(0.78)], [X(0.95), Y(0.92)], 6), w * 1.2, 0.55, 0.15, 0.2)
  } else if (low < 0.75) {
    d += shu(0.2, 0.52, 0.92) + heng(0.2, 0.8, 0.52) + shu(0.8, 0.52, 0.92) + heng(0.22, 0.78, 0.9)
  } else {
    d += heng(0.18, 0.82, 0.62) + heng(0.05, 0.95, 0.9)
  }
  if (r() < 0.5) d += dot(0.12 + r() * 0.7, 0.4 + r() * 0.4)
  return d
}

/**
 * A column of running script (thảo thư) down from (cx, y0), `hgt` tall, `wd` wide: one looping line lifted into strokes,
 * thick where each stroke lands. `breakUp` 0…1 lets the lower part come apart (wider gaps, drift sideways).
 */
export function cursive(cx: number, y0: number, hgt: number, wd: number, seed: number, w: number, breakUp = 0): string {
  const r = rng(seed)
  const N = 220
  const turns = Math.max(2, hgt / (wd * 0.7))
  const pts: Pt[] = []
  for (let i = 0; i <= N; i++) {
    const t = i / N, th = t * turns * Math.PI * 2
    const drift = breakUp * t * t * wd * 1.4 * Math.sin(th * 0.23 + seed)
    const k = 0.4 + 0.14 * Math.sin(th * 0.37 + seed) + 0.1 * Math.sin(th * 1.13 + seed * 2)
    pts.push([cx + Math.cos(th) * wd * k + drift, y0 + t * hgt - Math.sin(th) * wd * (0.2 + 0.14 * Math.sin(th * 0.53 + seed * 3))])
  }
  let d = ''
  for (let i = 0; i < N - 6; ) {
    const t = i / N
    const len = Math.round((14 + r() * 24) * (1 - breakUp * t * 0.75))
    const seg = pts.slice(i, Math.min(N, i + len) + 1)
    if (seg.length > 3) d += stroke(seg, w * (1 - t * 0.35) * (0.7 + r() * 0.6), 0.08, 0.6, 0.12)
    i += len + 2 + Math.round(r() * 5 + breakUp * t * 14)
  }
  return d
}

/** A small white pebble centred on (0, 0): contact shadow, body, a shaded lower rim, moonlight on the crown. */
export function pebble(r: number, seed: number): SVGElement[] {
  const ry = r * (0.56 + rng(seed)() * 0.12)
  const rim = Array.from({ length: 9 }, (_, i) => {
    const a = (0.05 + i * 0.11) * Math.PI
    return [Math.cos(a) * r * 0.97, Math.sin(a) * ry * 0.92] as Pt
  })
  return [
    s('ellipse', { class: 'zk-pb-sh', cx: r * 0.15, cy: ry * 0.75, rx: r * 1.08, ry: ry * 0.42 }),
    s('path', { class: 'zk-pb', d: blob(0, 0, r, ry, seed, 0.1, 12), filter: 'url(#ink-rough)' }),
    s('path', { class: 'zk-pb-ink', d: stroke(rim, Math.max(1.2, r * 0.16), 0.3, 0.3, 0.1) }),
    s('path', { class: 'zk-pb-hi', d: stroke([[-r * 0.55, -ry * 0.15], [-r * 0.15, -ry * 0.62], [r * 0.3, -ry * 0.5]], Math.max(1, r * 0.2), 0.3, 0.4, 0.1) }),
  ]
}

/** A leaf from (x, y) along angle `rot` (radians), `len` long: the blade and its midrib, as two path strings. */
export function leaf(x: number, y: number, len: number, rot: number, seed: number) {
  const r = rng(seed)
  const wd = len * (0.2 + r() * 0.1), bend = (r() - 0.5) * len * 0.25
  const c = Math.cos(rot), sn = Math.sin(rot)
  const T = (u: number, v: number): Pt => [x + u * c - v * sn, y + u * sn + v * c]
  return {
    blade: `M${P(T(0, 0))}Q${P(T(len * 0.4, -wd * 1.3 + bend))} ${P(T(len, bend * 0.6))}Q${P(T(len * 0.5, wd + bend))} ${P(T(0, 0))}Z`,
    rib: stroke([T(-len * 0.18, wd * 0.1), T(len * 0.45, bend * 0.25), T(len * 0.9, bend * 0.55)], Math.max(0.9, len * 0.035), 0.05, 0.4, 0.3),
  }
}

/** A length of bamboo from a to b, w thick: the cane and its knuckles (two path strings). */
export function bamboo(a: Pt, b: Pt, w: number, seed: number, joints = 3) {
  const r = rng(seed)
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
  const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L
  let knots = ''
  for (let i = 1; i <= joints; i++) {
    const t = (i - 0.3 + r() * 0.5) / (joints + 0.4)
    const x = a[0] + ux * L * t, y = a[1] + uy * L * t
    knots += stroke([[x - uy * w * 0.62, y + ux * w * 0.62], [x + ux * w * 0.08, y + uy * w * 0.08], [x + uy * w * 0.62, y - ux * w * 0.62]], Math.max(1, w * 0.2), 0.2, 0.2, 0.4)
  }
  return { cane: stroke([a, [(a[0] + b[0]) / 2 + uy * w * 0.05, (a[1] + b[1]) / 2], b], w, 0.03, 0.03, 0.85), knots }
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

/** A perspectiveCircle stone's foot (stage px) and its width. */
export type Foot = { x: number; y: number; w: number }

/**
 * A perspectiveCircle whose painting also lies in front of the pond (under the stones): `make` builds the scene with the
 * art hook it is given; `back(g)` goes behind the pond as usual, `front(g)` into a layer just above it, redrawn per layout.
 */
export function pondWithFront(make: (art: (g: PondGeo) => SVGElement[]) => SceneDef, back: (g: PondGeo, stones: Foot[]) => SVGElement[], front: (g: PondGeo, stones: Foot[]) => SVGElement[]): SceneDef {
  let host: HTMLElement | null = null
  let veil: SVGSVGElement | null = null
  const def = make((g) => {
    const pond = host?.querySelector('.p2c-pond')
    if (veil && pond && pond.nextElementSibling !== veil) pond.after(veil)
    // where each stone stands (its foot, stage px): the component has placed the buttons just before it paints
    const stones = [...(host?.querySelectorAll<HTMLElement>('.p2c-stone') ?? [])].map((b) => {
      const w = parseFloat(b.style.width) || 0, hh = parseFloat(b.style.height) || 0
      return { x: (parseFloat(b.style.left) || 0) + w / 2, y: (parseFloat(b.style.top) || 0) + (hh * 70) / 90, w }
    })
    veil?.setAttribute('viewBox', `0 0 ${f1(g.w)} ${f1(g.h)}`)
    veil?.replaceChildren(...front(g, stones))
    return back(g, stones)
  })
  return {
    label: def.label,
    mount(ctx) {
      host = ctx.art
      veil = s('svg', { class: 'zk-veil', 'aria-hidden': 'true' })
      return def.mount(ctx)
    },
  }
}
