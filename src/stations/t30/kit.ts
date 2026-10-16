import { h, s } from '../../core/dom'
import { blob, curve, rng, stroke, type Pt } from '../../ui/part2/ink'

/**
 * Station 30 brushes on top of the Part 2 kit (own copies, so other stations' rewrites never move this one): bamboo,
 * small ink figures, a far-shore house, potted saplings, a wooden bucket, sheets of paper, a hanging paper slip.
 * Static SVG; colours come from classes in style.css (tokens only). Moving pieces carry no filter (animate a parent).
 */

export const f1 = (n: number) => (Math.round(n * 10) / 10).toString()
export const P = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`
export const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

/** A bamboo culm from a to b, w thick: a near-even stroke, darker node rings, a moonlit edge, a cut mouth at b. */
export function bamboo(a: Pt, b: Pt, w: number, seed: number, mouth = true, bend?: number): SVGGElement {
  const r = rng(seed)
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
  const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L
  const nx = -uy, ny = ux
  const bow = bend ?? (r() - 0.5) * w * 0.6
  const body = curve(a, [(a[0] + b[0]) / 2 + nx * bow, (a[1] + b[1]) / 2 + ny * bow], b, 16)
  let nodes = ''
  const step = Math.max(w * 3.2, 18) * (0.9 + r() * 0.3)
  for (let d = step * (0.4 + r() * 0.4); d < L - w; d += step * (0.85 + r() * 0.3)) {
    const [x, y] = body[Math.round((d / L) * 16)]
    nodes += stroke([[x + nx * w * 0.62, y + ny * w * 0.62], [x + ux * 0.6, y + uy * 0.6], [x - nx * w * 0.62, y - ny * w * 0.62]], Math.max(1, w * 0.22), 0.2, 0.2, 0.5)
  }
  const edge = body.map(([x, y]) => [x - nx * w * 0.24, y - ny * w * 0.24] as Pt)
  return s('g', { class: 't30-bamboo' },
    s('path', { class: 't30-culm', d: stroke(body, w, 0.02, 0.02, 0.86) }),
    s('path', { class: 't30-node', d: nodes }),
    s('path', { class: 't30-culm-hi', d: stroke(edge.slice(1, -1), Math.max(0.8, w * 0.16), 0.2, 0.2, 0.2) }),
    mouth ? s('ellipse', { class: 't30-mouth', cx: f1(b[0]), cy: f1(b[1]), rx: f1(w * 0.5), ry: f1(w * 0.26), transform: `rotate(${f1((Math.atan2(uy, ux) * 180) / Math.PI + 90)} ${f1(b[0])} ${f1(b[1])})` }) : null)
}

/** A small standing figure in a few strokes, feet at (x, y), `hh` tall, facing dir: hat, robe, an arm forward. */
export function figure(x: number, y: number, hh: number, seed: number, dir = 1, opt: { hat?: 'cone' | 'cap'; stoop?: number; arm?: number } = {}): string {
  const r = rng(seed)
  const u = hh / 10
  const st = (opt.stoop ?? 0.2) * dir
  const neck: Pt = [x + st * u * 3, y - u * 7.6 + Math.abs(st) * u * 1.5]
  const head: Pt = [neck[0] + st * u * 1.4, neck[1] - u * 1.1]
  let d = stroke(curve(neck, [x + st * u * 1.6, y - u * 4], [x - dir * u * 0.3, y - u * 0.3], 8), u * 2.6, 0.12, 0.05, 0.55)
  d += stroke([[x - dir * u * 1.4, y - u * 0.2], [x + dir * u * 0.4, y - u * 0.1], [x + dir * u * 1.5, y - u * 0.3]], u * 0.9, 0.2, 0.2, 0.4)
  d += blob(head[0], head[1], u * 0.62, u * 0.7, seed, 0.1, 10)
  if (opt.hat === 'cone') d += `M${P([head[0] - u * 2, head[1] - u * 0.1])}Q${P([head[0], head[1] - u * 2.2])} ${P([head[0] + u * 2, head[1] - u * 0.1])}Q${P([head[0], head[1] - u * 0.5])} ${P([head[0] - u * 2, head[1] - u * 0.1])}Z`
  else if (opt.hat === 'cap') d += blob(head[0], head[1] - u * 0.6, u * 0.8, u * 0.4, seed + 1, 0.05, 8)
  const lift = opt.arm ?? 0
  d += stroke(curve([neck[0] + dir * u * 0.2, neck[1] + u * 0.8], [neck[0] + dir * u * 1.6, neck[1] + u * (2.2 - lift)], [neck[0] + dir * u * (2.4 + r() * 0.3), neck[1] + u * (2.2 - lift * 1.6)], 6), u * 0.9, 0.1, 0.3, 0.4)
  return d
}

/** A small far-shore house (feet at x, y; s = width): roof, wall, a window that lights up (its own element). */
export function house(x: number, y: number, w: number, seed: number) {
  const r = rng(seed)
  const hh = w * (0.42 + r() * 0.12)
  const roof = `M${P([x - w * 0.62, y - hh])}Q${P([x - w * 0.3, y - hh - w * 0.08])} ${P([x, y - hh - w * 0.36])}Q${P([x + w * 0.3, y - hh - w * 0.08])} ${P([x + w * 0.62, y - hh])}Q${P([x, y - hh - w * 0.05])} ${P([x - w * 0.62, y - hh])}Z`
  const wall = `M${P([x - w * 0.46, y])}L${P([x - w * 0.46, y - hh])}L${P([x + w * 0.46, y - hh])}L${P([x + w * 0.46, y])}Z`
  const wx = x + (r() - 0.5) * w * 0.3, wy = y - hh * 0.55
  return {
    body: s('g', { class: 't30-house' }, s('path', { class: 't30-house-wall', d: wall }), s('path', { class: 't30-house-roof', d: roof })),
    win: s('g', { class: 't30-win' },
      s('circle', { class: 't30-win-glow', cx: f1(wx), cy: f1(wy), r: f1(w * 0.9), fill: 'url(#p2-lamp)' }),
      s('rect', { class: 't30-win-pane', x: f1(wx - w * 0.12), y: f1(wy - w * 0.1), width: f1(w * 0.24), height: f1(w * 0.2) })),
    door: [wx, wy] as Pt,
    h: hh,
  }
}

/** A potted sapling standing on (x, y), k tall: clay pot, a thin stem, two or three leaf pads, a bamboo stake. */
export function sapling(x: number, y: number, k: number, seed: number, stake = true): SVGGElement {
  const r = rng(seed)
  const pw = k * 0.42
  const pot = `M${P([x - pw * 0.55, y - pw * 0.78])}L${P([x + pw * 0.55, y - pw * 0.78])}L${P([x + pw * 0.4, y])}Q${P([x, y + pw * 0.08])} ${P([x - pw * 0.4, y])}Z`
  const top: Pt = [x + (r() - 0.5) * k * 0.1, y - k]
  const stem = curve([x, y - pw * 0.78], [x - k * 0.08, y - k * 0.55], top, 8)
  let leaves = ''
  ;[[0.55, -1], [0.75, 1], [1, -0.2]].forEach(([t, side], i) => {
    const [lx, ly] = stem[Math.round(t * 8)]
    leaves += blob(lx + side * k * 0.13, ly - k * 0.03, k * 0.15, k * 0.08, seed + i, 0.25, 9)
  })
  return s('g', { class: 't30-sapling' },
    s('ellipse', { class: 't30-contact', cx: f1(x + pw * 0.1), cy: f1(y), rx: f1(pw * 0.8), ry: f1(pw * 0.16) }),
    stake ? s('path', { class: 't30-stake', d: stroke([[x + pw * 0.22, y - pw * 0.6], [x + pw * 0.26, y - k * 0.82]], Math.max(1, k * 0.035), 0.05, 0.1, 0.6) }) : null,
    s('path', { class: 't30-limb', d: stroke(stem, Math.max(1, k * 0.04), 0.05, 0.5, 0.3) }),
    s('path', { class: 't30-leaf', d: leaves }),
    s('path', { class: 't30-clay', d: pot }),
    s('path', { class: 't30-clay-hi', d: stroke([[x - pw * 0.42, y - pw * 0.7], [x - pw * 0.3, y - pw * 0.08]], Math.max(1, pw * 0.1), 0.2, 0.2, 0.2) }))
}

/** A blossoming tree: an ink wash crown, a few limbs, vermilion blossoms (the one focal point of its scene). */
export function blossom(x: number, y: number, R: number, seed: number): SVGElement[] {
  const r = rng(seed)
  const base: Pt = [x - R * 0.1, y]
  const top: Pt = [x + R * 0.1, y - R * 1.35]
  const trunk = curve(base, [x - R * 0.4, y - R * 0.7], top, 10)
  let limbs = stroke(trunk, Math.max(2, R * 0.12), 0.02, 0.7, 0.25), dots = ''
  ;[[0.35, -1], [0.5, 1], [0.7, -1], [0.85, 1], [1, -1]].forEach(([k, side], i) => {
    const [bx, by] = trunk[Math.round(k * 10)]
    const L = R * (0.45 + r() * 0.35) * (i === 4 ? 0.6 : 1)
    const pts = curve([bx, by], [bx + side * L * 0.4, by - L * 0.05], [bx + side * L, by - L * (0.35 + r() * 0.3)], 8)
    limbs += stroke(pts, Math.max(1, R * 0.05), 0.05, 0.7, 0.2)
    for (let j = 2; j < 9; j += 2) {
      const [px, py] = pts[j]
      dots += blob(px + (r() - 0.5) * R * 0.14, py - R * 0.05 - r() * R * 0.1, R * 0.055, R * 0.055, seed + i * 7 + j, 0.2, 6)
    }
  })
  return [
    s('path', { class: 't30-crown', d: blob(x, y - R * 1.3, R * 0.95, R * 0.6, seed, 0.3, 14), filter: 'url(#ink-wash)' }),
    s('path', { class: 't30-limb', d: limbs, filter: 'url(#ink-rough)' }),
    s('path', { class: 't30-flower', d: dots }),
  ]
}

/** A wooden bucket hanging from (x, y) on a short bail: staves, two hoops. */
export function bucket(x: number, y: number, bw: number) {
  const bh = bw * 0.9
  const top = y + bw * 0.5
  const body = `M${f1(x - bw / 2)} ${f1(top)}L${f1(x + bw / 2)} ${f1(top)}L${f1(x + bw * 0.4)} ${f1(top + bh)}Q${f1(x)} ${f1(top + bh + bw * 0.12)} ${f1(x - bw * 0.4)} ${f1(top + bh)}Z`
  const hoop = (k: number) => stroke(curve([x - bw * (0.5 - k * 0.1), top + bh * k], [x, top + bh * k + bw * 0.12], [x + bw * (0.5 - k * 0.1), top + bh * k], 6), Math.max(1, bw * 0.08), 0.1, 0.1, 0.5)
  let staves = ''
  for (let i = 1; i < 5; i++) {
    const t = i / 5
    staves += `M${f1(x - bw / 2 + bw * t)} ${f1(top + 1)}L${f1(x - bw * 0.4 + bw * 0.8 * t)} ${f1(top + bh - 1)}`
  }
  const bail = `M${f1(x - bw / 2)} ${f1(top)}Q${f1(x)} ${f1(y - bw * 0.2)} ${f1(x + bw / 2)} ${f1(top)}`
  return { body, hoops: hoop(0.22) + hoop(0.8), staves, bail, top, bh }
}

/** A sheet of paper lying or flying: a slightly warped quad with brushed lines of writing. */
export function sheet(c: Pt, w: number, hh: number, tilt: number, seed: number): { page: string; text: string } {
  const r = rng(seed)
  const a = (tilt * Math.PI) / 180
  const at = (u: number, v: number): Pt => [c[0] + Math.cos(a) * u - Math.sin(a) * v, c[1] + Math.sin(a) * u + Math.cos(a) * v]
  const sag = hh * 0.05 * (r() - 0.3)
  const page = `M${P(at(-w / 2, -hh / 2))}Q${P(at(0, -hh / 2 + sag))} ${P(at(w / 2, -hh / 2))}L${P(at(w / 2 + sag, hh / 2))}Q${P(at(0, hh / 2 + sag))} ${P(at(-w / 2, hh / 2))}Z`
  let text = ''
  const rows = Math.max(2, Math.round(hh / Math.max(4, w * 0.16)))
  for (let i = 0; i < rows; i++) {
    const v = -hh / 2 + (hh * (i + 0.8)) / (rows + 0.6)
    text += `M${P(at(-w * 0.34, v))}L${P(at(-w * 0.34 + w * (0.4 + r() * 0.3), v))}`
  }
  return { page, text }
}

/** Points on an ellipse from angle a0 to a1 (degrees, y down). */
export function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 24): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as Pt
  })
}

/** A slip of rice paper hung in the scene on two threads (facts read on paper, not on a UI card). */
export function paperSlip(cls = ''): HTMLElement {
  return h('div', { class: `t30-slip ${cls}` })
}
