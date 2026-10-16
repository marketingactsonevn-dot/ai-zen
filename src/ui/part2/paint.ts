import { s } from '../../core/dom'
import { blob, curve, p2Defs, rng, stroke, type Pt } from './ink'

/**
 * Painted night scenery for Part 2 scenes (sumi-e under the moon): ink-wash mountains, the moon, mist, still water,
 * pines, reeds, lanterns, a brushed frame. Static SVG only: no loop, colours are tokens (wash, mist, moon, lantern, water),
 * edges come from the page's ink filters (#ink-rough / #ink-wash / #ink-dry, lighter at quality=low).
 * Build once per layout; never animate a filtered element (animate a parent <g>). Styles: part2.css "paint".
 */

const f1 = (n: number) => (Math.round(n * 10) / 10).toString()
const P = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`
const line = (pts: Pt[]) => `M${pts.map(P).join('L')}`

/** Gradients the painted pieces use (added to the page's p2 defs once). */
function defs() {
  p2Defs()
  if (document.getElementById('p2-paint')) return
  const stop = (o: number, c: string, a: number | string = 1) => s('stop', { offset: o, style: `stop-color:var(${c});stop-opacity:${a}` })
  document.getElementById('p2-defs')!.append(s('defs', { id: 'p2-paint' },
    // a mountain wash: dense on the ridge, thinning into mist at the foot
    s('linearGradient', { id: 'p2-wash-v', x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, '--wash', 0.95), stop(0.45, '--wash', 0.5), stop(1, '--wash', 0)),
    s('radialGradient', { id: 'p2-disc', cx: 0.42, cy: 0.38, r: 0.7 }, stop(0, '--moon'), stop(0.8, '--moon'), stop(1, '--moon', 0.8)),
    s('radialGradient', { id: 'p2-lamp' }, stop(0, '--lantern', 0.55), stop(0.42, '--lantern', 0.16), stop(1, '--lantern', 0)),
    s('radialGradient', { id: 'p2-lamp-body', cx: 0.45, cy: 0.42, r: 0.62 }, stop(0, '--moon'), stop(0.45, '--lantern'), stop(1, '--lantern', 0.86)),
    s('radialGradient', { id: 'p2-fog' }, stop(0, '--mist', 'var(--mist-a)'), stop(0.6, '--mist', 'calc(var(--mist-a) * 0.45)'), stop(1, '--mist', 0)),
    s('linearGradient', { id: 'p2-water-v', x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, '--water', 0.5), stop(0.35, '--water', 0.82), stop(1, '--water', 0.96)),
    s('radialGradient', { id: 'p2-road' }, stop(0, '--moon', 0.32), stop(0.6, '--moon', 0.08), stop(1, '--moon', 0))))
}

/** A mountain ridge from x0 to x1 standing on `base`, up to `h` tall: a few sharp crowns, concave flanks, small breaks. */
export function ridge(x0: number, x1: number, base: number, h: number, seed: number, peaks = 3): Pt[] {
  const r = rng(seed)
  const W = x1 - x0
  const B = Array.from({ length: peaks }, (_, i) => ({ c: x0 + (W * (i + 0.5 + (r() - 0.5) * (peaks > 1 ? 0.7 : 0.15))) / peaks, w: (W * (0.28 + r() * 0.22)) / Math.sqrt(peaks), a: h * (0.42 + r() * 0.5), k: 1.1 + r() * 0.6 }))
  B[Math.floor(r() * peaks)].a = h
  const ph = [r() * 9, r() * 9, r() * 9]
  const N = Math.max(28, Math.round(W / 7))
  return Array.from({ length: N + 1 }, (_, i) => {
    const x = x0 + (W * i) / N
    let y = h * 0.05
    for (const b of B) {
      const t = Math.abs(x - b.c) / b.w
      if (t < 1) y = Math.max(y, b.a * Math.pow(1 - t, b.k))
    }
    y += h * 0.025 * (Math.sin(x * 0.06 + ph[0]) + 0.6 * Math.sin(x * 0.17 + ph[1]) + 0.35 * Math.sin(x * 0.43 + ph[2]))
    return [x, base - Math.max(0, y)] as Pt
  })
}

/**
 * One layer of ink mountains. depth 0 = near (dark wash, a broken brushed ridge, texture strokes down the flanks,
 * a moonlit edge), 1 = far (a pale wash only). The foot always melts into nothing, so mist can sit below it.
 */
export function hills(x0: number, x1: number, base: number, h: number, seed: number, depth = 0.5, peaks = 3): SVGGElement {
  defs()
  const top = ridge(x0, x1, base, h, seed, peaks)
  const r = rng(seed + 3)
  const g = s('g', { class: 'p2p-hills' },
    s('path', { class: 'p2p-hill', d: `M${f1(x0)} ${f1(base)}L${top.map(P).join('L')}L${f1(x1)} ${f1(base)}Z`, style: `--o:${(0.16 + (1 - depth) * 0.5).toFixed(2)}`, filter: 'url(#ink-wash)' }))
  if (depth > 0.6) return g
  // the ridge in two or three strokes with dry gaps, heavier on the crowns
  const cuts = [0, 0.3 + r() * 0.12, 0.62 + r() * 0.12, 1].map((k) => Math.round(k * (top.length - 1)))
  let ink = ''
  for (let i = 0; i < cuts.length - 1; i++) {
    const seg = top.slice(cuts[i] + (i ? 2 : 0), cuts[i + 1] + 1)
    if (seg.length > 2) ink += stroke(seg, (1.4 + (1 - depth) * 2.2) * (0.8 + r() * 0.5), 0.12, 0.3, 0.15)
  }
  // texture: short dry strokes falling down the flanks from below the ridge
  let cun = ''
  for (let i = 2; i < top.length - 2; i += 2 + Math.floor(r() * 3)) {
    const [x, y] = top[i]
    const dy = base - y
    if (dy < h * 0.25 || r() < 0.35) continue
    const slope = top[i + 1][1] - top[i - 1][1] > 0 ? 1 : -1
    const len = dy * (0.18 + r() * 0.3)
    cun += stroke(curve([x, y + 2], [x + slope * len * 0.25, y + len * 0.5], [x + slope * len * 0.12, y + len], 6), 1 + r() * 1.6, 0.1, 0.5, 0.1)
  }
  const crown = top.reduce((a, b) => (b[1] < a[1] ? b : a))
  const ci = top.indexOf(crown)
  g.append(
    s('path', { class: 'p2p-cun', d: cun, filter: 'url(#ink-dry)' }),
    s('path', { class: 'p2p-ridge', d: ink, style: `opacity:${(0.4 + (1 - depth) * 0.4).toFixed(2)}`, filter: 'url(#ink-rough)' }),
    s('path', { class: 'p2p-rim', d: stroke(top.slice(Math.max(0, ci - 8), ci + 3).map(([x, y]) => [x - 1.2, y - 1] as Pt), 1.6, 0.3, 0.2, 0.1) }))
  return g
}

/** A soft bank of mist (radial fog, no filter): lay it over the foot of a hill layer or across water. */
export function mist(cx: number, cy: number, rx: number, ry: number): SVGEllipseElement {
  defs()
  return s('ellipse', { class: 'p2p-mist', cx: f1(cx), cy: f1(cy), rx: f1(rx), ry: f1(ry), fill: 'url(#p2-fog)' })
}

/** The moon: halo, warm disc, faint seas, an ink rim and (optionally) a breath of cloud drawn across it. */
export function moon(cx: number, cy: number, r: number, seed = 1, cloud = true): SVGGElement {
  defs()
  const q = rng(seed)
  const lens = (x0: number, y0: number, len: number, w: number) =>
    `M${f1(x0)} ${f1(y0)}Q${f1(x0 + len * 0.45)} ${f1(y0 - w * 1.6)} ${f1(x0 + len)} ${f1(y0 - w * 0.5)}Q${f1(x0 + len * 0.55)} ${f1(y0 + w * 0.5)} ${f1(x0)} ${f1(y0)}Z`
  return s('g', { class: 'p2p-moon' },
    s('circle', { cx: f1(cx), cy: f1(cy), r: f1(r * 4.2), fill: 'url(#p2-halo)', class: 'p2p-halo' }),
    s('circle', { cx: f1(cx), cy: f1(cy), r: f1(r), fill: 'url(#p2-disc)' }),
    s('path', { class: 'p2p-maria', d: blob(cx - r * 0.28, cy - r * 0.18, r * 0.34, r * 0.24, seed, 0.2) + blob(cx + r * 0.24, cy + r * 0.12, r * 0.24, r * 0.3, seed + 1, 0.2) + blob(cx - r * 0.04, cy + r * 0.48, r * 0.18, r * 0.11, seed + 2, 0.2) }),
    s('circle', { class: 'p2p-moon-rim', cx: f1(cx), cy: f1(cy), r: f1(r) }),
    cloud ? s('path', { class: 'p2p-cloud', d: lens(cx - r * (1.6 + q() * 0.6), cy + r * (0.35 + q() * 0.3), r * (2.7 + q()), r * 0.24) + lens(cx - r * 0.3, cy + r * (0.8 + q() * 0.2), r * 2.1, r * 0.15) }) : null)
}

/**
 * Still water over x0…x1, y0…y1: a dark body that deepens toward the viewer (optional), dry-brush ripples that grow longer
 * as they come near, and the moon's broken road under moonX (if given).
 */
export function water(x0: number, y0: number, x1: number, y1: number, seed: number, moonX?: number, body = true): SVGGElement {
  defs()
  const r = rng(seed)
  const W = x1 - x0, H = y1 - y0
  let rip = ''
  const n = Math.round(Math.max(8, (W * H) / 5200))
  for (let i = 0; i < n; i++) {
    const t = Math.pow(r(), 0.8)
    const y = y0 + H * t
    const len = W * (0.02 + t * 0.07) * (0.5 + r())
    const x = x0 + r() * (W - len)
    rip += stroke([[x, y], [x + len * 0.5, y + (r() - 0.5) * 1.2], [x + len, y]], 0.8 + t * 1.6, 0.3, 0.3, 0.1)
  }
  let road = ''
  if (moonX != null) {
    for (let y = y0 + 3, i = 0; y < y1; y += 2.5 + (y - y0) * 0.05 + r() * 3, i++) {
      const near = (y - y0) / H
      if (r() > 0.85 - near * 0.3) continue
      const len = W * (0.02 + near * 0.05) * (0.5 + r())
      const x = moonX + (r() - 0.5) * W * (0.03 + near * 0.08) - len / 2
      road += stroke([[x, y], [x + len, y + (r() - 0.5)]], 0.9 + near * 1.8, 0.25, 0.25, 0.1)
    }
  }
  return s('g', { class: 'p2p-water' },
    body ? s('rect', { class: 'p2p-water-body', x: f1(x0), y: f1(y0), width: f1(W), height: f1(H), fill: 'url(#p2-water-v)' }) : null,
    moonX != null ? s('ellipse', { cx: f1(moonX), cy: f1(y0 + H * 0.45), rx: f1(W * 0.12), ry: f1(H * 0.6), fill: 'url(#p2-road)' }) : null,
    s('path', { class: 'p2p-ripple', d: rip }),
    road ? s('path', { class: 'p2p-road', d: road }) : null)
}

/**
 * A pine painted in a few strokes: a gnarled trunk leaning from (x, y) up `h`, bark marks, limbs that dip then lift,
 * and at each tip a pad of needles — fans of fine strokes over a pale wash. dir: 1 leans right, -1 left.
 */
export function pine(x: number, y: number, h: number, seed: number, dir = 1): SVGGElement {
  defs()
  const r = rng(seed)
  const lean = h * (0.2 + r() * 0.12) * dir
  // an S-bend: two quadratic pieces
  const mid: Pt = [x + lean * 0.35 - dir * h * (0.06 + r() * 0.05), y - h * 0.5]
  const trunk = [...curve([x, y], [x + dir * h * 0.08, y - h * 0.25], mid, 10), ...curve(mid, [x + lean * 0.5 - dir * h * 0.1, y - h * 0.78], [x + lean, y - h], 10).slice(1)]
  const tw = h * 0.042
  let bark = ''
  for (let i = 0; i < 7; i++) {
    const k = 1 + Math.floor(r() * 16)
    const [bx, by] = trunk[k]
    bark += stroke([[bx - tw * 0.35, by + h * 0.01], [bx, by - h * 0.012], [bx + tw * 0.3, by - h * 0.03]], tw * 0.22, 0.2, 0.4, 0.2)
  }
  let limbs = ''
  const tips: [Pt, number][] = [[trunk[trunk.length - 1], 1.15]]
  for (let i = 0; i < 4; i++) {
    const k = 8 + i * 3 + Math.floor(r() * 2)
    const [bx, by] = trunk[Math.min(trunk.length - 2, k)]
    const side = i % 2 ? -dir : dir
    const L = h * (0.2 + r() * 0.2) * (i ? 1 : 1.3)
    const end: Pt = [bx + side * L, by - L * (0.08 + r() * 0.22)]
    limbs += stroke(curve([bx, by], [bx + side * L * 0.45, by + L * 0.14], end, 10), tw * (0.62 - i * 0.08), 0.02, 0.6, 0.25)
    tips.push([end, 0.7 + r() * 0.35])
    if (r() < 0.6) {
      const sub: Pt = [bx + side * L * 0.55, by + L * 0.02 - L * 0.25]
      limbs += stroke(curve([bx + side * L * 0.45, by + L * 0.06], [bx + side * L * 0.5, by - L * 0.08], sub, 6), tw * 0.3, 0.02, 0.6, 0.2)
      tips.push([sub, 0.5 + r() * 0.2])
    }
  }
  const pads: SVGElement[] = []
  let needles = ''
  for (const [[px, py], k] of tips) {
    const w = h * 0.3 * k
    pads.push(s('path', { class: 'p2p-pad', d: blob(px, py - w * 0.08, w * 0.55, w * 0.2, seed + Math.round(px), 0.22, 16), filter: 'url(#ink-wash)' }))
    // two or three fans along the pad: fine strokes radiating up and out from a pivot under the pad's crown
    const fans = 2 + Math.round(r())
    for (let f = 0; f < fans; f++) {
      const ox = px + (f - (fans - 1) / 2) * w * 0.34 + (r() - 0.5) * w * 0.08
      const oy = py + w * 0.04
      const len = w * (0.3 + r() * 0.08)
      for (let j = 0; j < 17; j++) {
        const a = Math.PI * (1.08 + (j / 14) * 0.84) + (r() - 0.5) * 0.08
        const l = len * (0.75 + r() * 0.35)
        needles += stroke([[ox, oy], [ox + Math.cos(a) * l, oy + Math.sin(a) * l * 0.62]], 1 + r() * 0.7 + h * 0.002, 0.05, 0.6, 0.15)
      }
    }
  }
  return s('g', { class: 'p2p-pine' },
    ...pads,
    s('path', { class: 'p2p-trunk', d: stroke(trunk, tw, 0.02, 0.45, 0.28) + limbs, filter: 'url(#ink-rough)' }),
    s('path', { class: 'p2p-bark', d: bark, filter: 'url(#ink-dry)' }),
    s('path', { class: 'p2p-needle', d: needles }))
}

/** Reeds at the water's edge: thin leaning blades from (x, y), some with a seed head. */
export function reeds(x: number, y: number, h: number, seed: number, n = 7): SVGPathElement {
  const r = rng(seed)
  let d = ''
  for (let i = 0; i < n; i++) {
    const bx = x + (r() - 0.5) * h * 0.4
    const hh = h * (0.5 + r() * 0.5)
    const bend = (r() - 0.35) * hh * 0.35
    const w = Math.max(1.6, h * 0.035) * (0.7 + r() * 0.6)
    d += stroke(curve([bx, y], [bx + bend * 0.2, y - hh * 0.6], [bx + bend, y - hh], 10), w, 0.05, 0.5, 0.1)
    if (r() < 0.4) d += stroke(curve([bx + bend * 0.85, y - hh * 0.92], [bx + bend * 1.05, y - hh * 1.04], [bx + bend * 1.08, y - hh * 1.16], 5), w * 2.2, 0.35, 0.45, 0.3)
  }
  return s('path', { class: 'p2p-reeds', d, filter: 'url(#ink-rough)' })
}

/** A few blades of grass in a tuft at (x, y). */
export function grass(x: number, y: number, w: number, seed: number): SVGPathElement {
  const r = rng(seed)
  let d = ''
  for (let i = 0; i < 6; i++) {
    const bx = x + (r() - 0.5) * w
    const hh = w * (0.3 + r() * 0.5)
    const lean = (r() - 0.5) * hh * 0.9
    d += stroke(curve([bx, y], [bx + lean * 0.3, y - hh * 0.6], [bx + lean, y - hh], 6), 1 + r(), 0.05, 0.8, 0.1)
  }
  return s('path', { class: 'p2p-grass', d })
}

/** A wash of ink in any shape (bleeding edge): ground shadows, washes behind things, a pool. */
export function wash(d: string, opacity = 0.2, cls = 'p2p-wash'): SVGPathElement {
  return s('path', { class: cls, d, style: `opacity:${opacity}`, filter: 'url(#ink-wash)' })
}

/** A frame brushed in four strokes that overshoot at the corners (cards, panels, door frames). */
export function brushFrame(x: number, y: number, w: number, h: number, seed: number, wgt = 2.2): SVGPathElement {
  const r = rng(seed)
  const j = () => (r() - 0.5) * wgt * 1.2
  const o = () => wgt * (1.5 + r() * 2.5)
  const d =
    stroke([[x - o(), y + j()], [x + w / 2, y + j()], [x + w + o(), y + j()]], wgt, 0.08, 0.2, 0.25) +
    stroke([[x + w + j(), y - o() * 0.5], [x + w + j(), y + h / 2], [x + w + j(), y + h + o()]], wgt * 0.9, 0.1, 0.25, 0.25) +
    stroke([[x + w + o() * 0.5, y + h + j()], [x + w / 2, y + h + j()], [x - o(), y + h + j()]], wgt * 1.1, 0.1, 0.2, 0.25) +
    stroke([[x + j(), y + h + o() * 0.4], [x + j(), y + h / 2], [x + j(), y - o()]], wgt * 0.85, 0.1, 0.3, 0.25)
  return s('path', { class: 'p2p-frame', d, filter: 'url(#ink-rough)' })
}

/** A paper lantern (chōchin) hanging under (x, y): its halo, cord, ribbed glowing body, lacquered caps. */
export function paperLantern(x: number, y: number, r: number, seed = 1, cord = r * 1.2): SVGGElement {
  defs()
  const q = rng(seed)
  const cy = y + cord + r * 1.25
  let ribs = ''
  for (let i = 1; i < 5; i++) {
    const t = -1 + (i * 2) / 5
    const yy = cy + t * r * 1.1
    const hw = r * Math.sqrt(1 - t * t * 0.92)
    ribs += stroke(curve([x - hw, yy], [x, yy + r * 0.12], [x + hw, yy], 8), 0.7 + q() * 0.4, 0.15, 0.15, 0.2)
  }
  const cap = (yy: number, w: number) => `M${f1(x - w)} ${f1(yy - r * 0.11)}h${f1(w * 2)}v${f1(r * 0.22)}h${f1(-w * 2)}Z`
  return s('g', { class: 'p2p-lantern' },
    s('circle', { cx: f1(x), cy: f1(cy), r: f1(r * 3.4), fill: 'url(#p2-lamp)', class: 'p2p-lamp-halo' }),
    s('path', { class: 'p2p-cord', d: `M${f1(x)} ${f1(y)}V${f1(cy - r * 1.2)}` }),
    s('ellipse', { cx: f1(x), cy: f1(cy), rx: f1(r), ry: f1(r * 1.25), fill: 'url(#p2-lamp-body)', class: 'p2p-lamp-body' }),
    s('path', { class: 'p2p-lamp-rib', d: ribs }),
    s('path', { class: 'p2p-lamp-cap', d: cap(cy - r * 1.22, r * 0.5) + cap(cy + r * 1.22, r * 0.55), filter: 'url(#ink-rough)' }))
}

/** A Kasuga stone lantern (tōrō) standing at (x, y), H tall, painted: stone in washes, a lit firebox, curled roof, jewel. */
export function toro(x: number, y: number, H: number, lit = true): SVGGElement {
  defs()
  const u = H / 10
  const X = (v: number) => f1(x + v * u)
  const Y = (v: number) => f1(y - v * u)
  const quad = (l0: number, r0: number, b: number, l1: number, r1: number, t: number) => `M${X(l0)} ${Y(b)}L${X(r0)} ${Y(b)}L${X(r1)} ${Y(t)}L${X(l1)} ${Y(t)}Z`
  const stone =
    quad(-1.2, 1.2, 0, -0.9, 0.9, 0.9) + quad(-0.38, 0.38, 0.9, -0.32, 0.32, 4.5) + quad(-1.35, 1.35, 4.5, -1.0, 1.0, 5.3) +
    `M${X(-1.9)} ${Y(7.25)}Q${X(-1.3)} ${Y(7.55)} ${X(-0.9)} ${Y(8.1)}Q${X(-0.4)} ${Y(8.7)} ${X(0)} ${Y(8.75)}Q${X(0.4)} ${Y(8.7)} ${X(0.9)} ${Y(8.1)}Q${X(1.3)} ${Y(7.55)} ${X(1.9)} ${Y(7.25)}Q${X(2.05)} ${Y(7.5)} ${X(1.95)} ${Y(7.7)}Q${X(1.2)} ${Y(7.7)} ${X(0.95)} ${Y(7.3)}L${X(-0.95)} ${Y(7.3)}Q${X(-1.2)} ${Y(7.7)} ${X(-1.95)} ${Y(7.7)}Q${X(-2.05)} ${Y(7.5)} ${X(-1.9)} ${Y(7.25)}Z` +
    blob(x, y - 9.25 * u, u * 0.42, u * 0.42, 3, 0.1, 10)
  const posts = `M${X(-0.95)} ${Y(5.3)}h${f1(u * 0.32)}V${Y(7.3)}h${f1(-u * 0.32)}ZM${X(0.63)} ${Y(5.3)}h${f1(u * 0.32)}V${Y(7.3)}h${f1(-u * 0.32)}Z`
  return s('g', { class: `p2p-toro${lit ? ' lit' : ''}` },
    s('ellipse', { class: 'p2p-contact', cx: X(0.3), cy: Y(-0.1), rx: f1(u * 2), ry: f1(u * 0.42) }),
    lit ? s('circle', { cx: X(0), cy: Y(6.3), r: f1(u * 3.4), fill: 'url(#p2-lamp)', class: 'p2p-lamp-halo' }) : null,
    s('path', { class: 'p2p-toro-stone', d: stone, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
    s('path', { class: 'p2p-toro-shade', d: stone, fill: 'url(#p2-shade)' }),
    s('rect', { class: 'p2p-toro-fire', x: X(-0.63), y: Y(7.3), width: f1(u * 1.26), height: f1(u * 2) }),
    s('path', { class: 'p2p-toro-stone', d: posts, fill: 'url(#p2-rock)' }),
    s('path', { class: 'p2p-toro-ink', d: stroke([[x - 1.9 * u, y - 7.3 * u], [x, y - 7.42 * u], [x + 1.95 * u, y - 7.3 * u]], u * 0.22, 0.1, 0.1, 0.3) + stroke([[x - 1.3 * u, y - 4.5 * u], [x + 1.35 * u, y - 4.52 * u]], u * 0.16, 0.1, 0.2, 0.3) + stroke([[x - 1.2 * u, y], [x + 1.2 * u, y + 0.04 * u]], u * 0.2, 0.1, 0.2, 0.3), filter: 'url(#ink-rough)' }))
}

/** Stepping stones in perspective from (x0, y0) to (x1, y1): flat brushed ovals, larger as they come near. */
export function steppingStones(a: Pt, b: Pt, n: number, size: number, seed: number): SVGGElement {
  const r = rng(seed)
  const g = s('g', { class: 'p2p-steps' })
  for (let i = 0; i < n; i++) {
    const t = i / Math.max(1, n - 1)
    const x = a[0] + (b[0] - a[0]) * t + (r() - 0.5) * size * 0.6
    const y = a[1] + (b[1] - a[1]) * t
    const k = 0.55 + 0.45 * ((y - Math.min(a[1], b[1])) / (Math.abs(b[1] - a[1]) || 1))
    const rx = size * k * (0.85 + r() * 0.3), ry = rx * 0.34
    g.append(
      s('ellipse', { class: 'p2p-step-sh', cx: f1(x + rx * 0.08), cy: f1(y + ry * 0.45), rx: f1(rx * 1.04), ry: f1(ry) }),
      s('path', { class: 'p2p-step', d: blob(x, y, rx, ry, seed + i, 0.1, 14), filter: 'url(#ink-rough)' }),
      s('path', { class: 'p2p-step-hi', d: stroke(curve([x - rx * 0.6, y - ry * 0.35], [x - rx * 0.1, y - ry * 0.85], [x + rx * 0.5, y - ry * 0.5], 6), Math.max(1, ry * 0.25), 0.3, 0.3, 0.1) }))
  }
  return g
}

/** A line of ink in one brush stroke (a filled taper) — the plain stroke() wrapped with the rough edge. */
export function brush(pts: Pt[], w: number, cls = 'p2p-brush', a = 0.12, b = 0.3): SVGPathElement {
  return s('path', { class: cls, d: stroke(pts, w, a, b, 0.15), filter: 'url(#ink-rough)' })
}

/** A plain polyline path for things that only need a thin even line (cords, threads, horizons). */
export const thread = (pts: Pt[], cls = 'p2p-thread') => s('path', { class: cls, d: line(pts) })
