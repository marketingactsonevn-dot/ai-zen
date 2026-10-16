import { nextId, s } from '../../core/dom'
import { blob, curve, rng, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist, moon } from '../../ui/part2/paint'
import { f1 } from './frame'

/**
 * Garden 10 (t28–t30) brushes on top of the Part 2 kit: bamboo, a far night sky, a crescent moon, small ink figures,
 * paper sheets, a wooden bucket. Static SVG; colours come from classes in frame.css (tokens only). Pieces that move are
 * built without filters so a parent <g> can carry the motion.
 */

export const P = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`
export const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

/** A bamboo culm from a to b, w thick: a near-even stroke, darker node rings, a moonlit edge, a cut mouth at b. */
export function bamboo(a: Pt, b: Pt, w: number, seed: number, mouth = true, cls = '', bend?: number): SVGGElement {
  const r = rng(seed)
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
  const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L
  const nx = -uy, ny = ux
  const bow = bend ?? (r() - 0.5) * w * 0.6
  const mid: Pt = [(a[0] + b[0]) / 2 + nx * bow, (a[1] + b[1]) / 2 + ny * bow]
  const body = curve(a, mid, b, 16)
  let nodes = ''
  const step = Math.max(w * 3.2, 22) * (0.9 + r() * 0.3)
  for (let d = step * (0.4 + r() * 0.4); d < L - w; d += step * (0.85 + r() * 0.3)) {
    const t = d / L
    const [x, y] = body[Math.round(t * 16)]
    nodes += stroke([[x + nx * w * 0.62, y + ny * w * 0.62], [x + ux * 0.6, y + uy * 0.6], [x - nx * w * 0.62, y - ny * w * 0.62]], Math.max(1, w * 0.22), 0.2, 0.2, 0.5)
  }
  const edge = body.map(([x, y]) => [x - nx * w * 0.24, y - ny * w * 0.24] as Pt)
  return s('g', { class: `gb-bamboo ${cls}` },
    s('path', { class: 'gb-culm', d: stroke(body, w, 0.02, 0.02, 0.86), filter: 'url(#ink-rough)' }),
    s('path', { class: 'gb-node', d: nodes }),
    s('path', { class: 'gb-culm-hi', d: stroke(edge.slice(1, -1), Math.max(0.8, w * 0.16), 0.2, 0.2, 0.2) }),
    mouth ? s('ellipse', { class: 'gb-mouth', cx: f1(b[0]), cy: f1(b[1]), rx: f1(w * 0.5), ry: f1(w * 0.26), transform: `rotate(${f1((Math.atan2(uy, ux) * 180) / Math.PI + 90)} ${f1(b[0])} ${f1(b[1])})` }) : null)
}

/** The far night: a moonlit sky glow, the moon, one or two ink ranges on `horizon`, mist on their feet. */
export function nightSky(w: number, horizon: number, seed: number, m: [number, number, number] | null, rangeH = horizon * 0.5, near = true): SVGElement[] {
  return [
    mist(w * 0.5, horizon - rangeH * 0.6, w * 0.7, rangeH * 0.9),
    m ? moon(m[0], m[1], m[2], seed, true) : null,
    hills(-w * 0.05, w * 1.05, horizon, rangeH, seed + 1, 0.88, Math.max(3, Math.round(w / 220))),
    near ? hills(-w * 0.04, w * 0.42, horizon + rangeH * 0.08, rangeH * 0.62, seed + 2, 0.6, 2) : null,
    near ? hills(w * 0.6, w * 1.04, horizon + rangeH * 0.1, rangeH * 0.5, seed + 3, 0.62, 2) : null,
    mist(w * 0.5, horizon, w * 0.66, rangeH * 0.2),
  ].filter(Boolean) as SVGElement[]
}

/** A crescent moon (lit side right): halo, a disc cut by a mask, a faint ghost of the dark part, a thread of cloud. */
export function crescent(cx: number, cy: number, r: number): SVGGElement {
  const id = nextId('gb-cres')
  return s('g', { class: 'gb-crescent' },
    s('circle', { cx: f1(cx), cy: f1(cy), r: f1(r * 3.4), fill: 'url(#p2-halo)', class: 'gb-cres-halo' }),
    s('circle', { class: 'gb-cres-ghost', cx: f1(cx), cy: f1(cy), r: f1(r) }),
    s('mask', { id }, s('circle', { cx: f1(cx), cy: f1(cy), r: f1(r + 1), fill: '#fff' }), s('circle', { cx: f1(cx - r * 0.42), cy: f1(cy - r * 0.16), r: f1(r * 0.9), fill: '#000' })),
    s('circle', { cx: f1(cx), cy: f1(cy), r: f1(r), fill: 'url(#p2-disc)', mask: `url(#${id})` }),
    s('path', { class: 'p2p-cloud', d: stroke([[cx - r * 2.2, cy + r * 0.7], [cx - r * 0.2, cy + r * 0.55], [cx + r * 1.6, cy + r * 0.8]], r * 0.16, 0.3, 0.3, 0.1) }))
}

/** A small standing figure in a few strokes, feet at (x, y), `hh` tall, facing dir: hat, robe, an arm forward. */
export function figure(x: number, y: number, hh: number, seed: number, dir = 1, opt: { hat?: 'cone' | 'cap'; stoop?: number } = {}): string {
  const r = rng(seed)
  const u = hh / 10
  const st = (opt.stoop ?? 0.2) * dir
  const neck: Pt = [x + st * u * 3, y - u * 7.6]
  const head: Pt = [neck[0] + st * u * 1.2, neck[1] - u * 1.1]
  let d = ''
  // robe: a broad tapered stroke from the shoulders to the hem, flaring
  d += stroke(curve(neck, [x + st * u * 1.6, y - u * 4], [x - dir * u * 0.3, y - u * 0.3], 8), u * 2.6, 0.12, 0.05, 0.55)
  d += stroke([[x - dir * u * 1.4, y - u * 0.2], [x + dir * u * 0.4, y - u * 0.1], [x + dir * u * 1.5, y - u * 0.3]], u * 0.9, 0.2, 0.2, 0.4)
  // head and hat
  d += blob(head[0], head[1], u * 0.62, u * 0.7, seed, 0.1, 10)
  if (opt.hat === 'cone') d += `M${P([head[0] - u * 2, head[1] - u * 0.1])}Q${P([head[0], head[1] - u * 2.2])} ${P([head[0] + u * 2, head[1] - u * 0.1])}Q${P([head[0], head[1] - u * 0.5])} ${P([head[0] - u * 2, head[1] - u * 0.1])}Z`
  else if (opt.hat === 'cap') d += blob(head[0], head[1] - u * 0.6, u * 0.8, u * 0.4, seed + 1, 0.05, 8)
  // a sleeve forward (what it holds is drawn by the caller)
  d += stroke(curve([neck[0] + dir * u * 0.2, neck[1] + u * 0.8], [neck[0] + dir * u * 1.6, neck[1] + u * 2.2], [neck[0] + dir * u * (2.4 + r() * 0.3), neck[1] + u * 2.2], 6), u * 0.9, 0.1, 0.3, 0.4)
  return d
}

/** A wooden bucket hanging from (x, y) on a short bail: staves, two hoops; returns its path parts. */
export function bucket(x: number, y: number, bw: number): { body: string; hoops: string; bail: string; mouth: [number, number, number, number] } {
  const bh = bw * 0.9
  const top = y + bw * 0.5
  const body = `M${f1(x - bw / 2)} ${f1(top)}L${f1(x + bw / 2)} ${f1(top)}L${f1(x + bw * 0.4)} ${f1(top + bh)}Q${f1(x)} ${f1(top + bh + bw * 0.12)} ${f1(x - bw * 0.4)} ${f1(top + bh)}Z`
  const hoop = (k: number) => stroke(curve([x - bw * (0.5 - k * 0.1), top + bh * k], [x, top + bh * k + bw * 0.12], [x + bw * (0.5 - k * 0.1), top + bh * k], 6), Math.max(1, bw * 0.08), 0.1, 0.1, 0.5)
  const bail = `M${f1(x - bw / 2)} ${f1(top)}Q${f1(x)} ${f1(y - bw * 0.2)} ${f1(x + bw / 2)} ${f1(top)}`
  return { body, hoops: hoop(0.22) + hoop(0.8), bail, mouth: [x, top, bw / 2, bw * 0.12] }
}

/** A sheet of paper lying or flying: a slightly warped quad with brushed lines of writing; `k` = how much text. */
export function sheet(c: Pt, w: number, hh: number, tilt: number, seed: number, k = 1): { page: string; text: string } {
  const r = rng(seed)
  const a = (tilt * Math.PI) / 180
  const at = (u: number, v: number): Pt => [c[0] + Math.cos(a) * u - Math.sin(a) * v, c[1] + Math.sin(a) * u + Math.cos(a) * v]
  const sag = hh * 0.05 * (r() - 0.3)
  const page = `M${P(at(-w / 2, -hh / 2))}Q${P(at(0, -hh / 2 + sag))} ${P(at(w / 2, -hh / 2))}L${P(at(w / 2 + sag, hh / 2))}Q${P(at(0, hh / 2 + sag))} ${P(at(-w / 2, hh / 2))}Z`
  let text = ''
  const rows = Math.max(2, Math.round((hh / Math.max(5, w * 0.12)) * k))
  for (let i = 0; i < rows; i++) {
    const v = -hh / 2 + (hh * (i + 0.8)) / (rows + 0.6)
    const len = w * (0.45 + r() * 0.35)
    text += stroke([at(-w * 0.36, v), at(-w * 0.36 + len, v + (r() - 0.5))], Math.max(0.8, hh * 0.035), 0.2, 0.3, 0.2)
  }
  return { page, text }
}

/**
 * perspectiveCircle paints its `art` behind the pond, then the pond over it. To paint inside the water (a reflection, a
 * well's inner wall) or over its rim, hand one of the art elements here: fn runs right after that same layout pass, with
 * the pond's SVG and the group clipped to the water. (Kit request: an `inPond` hook would make this unnecessary.)
 */
export function intoPond(marker: SVGElement, fn: (svg: SVGSVGElement, water: SVGGElement) => void) {
  queueMicrotask(() => {
    const svg = marker.ownerSVGElement
    const g = svg?.querySelector<SVGGElement>(':scope > g[clip-path]')
    if (svg && g) fn(svg, g)
  })
}

/** Points on an ellipse from angle a0 to a1 (degrees, y down). */
export function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 24): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as Pt
  })
}
