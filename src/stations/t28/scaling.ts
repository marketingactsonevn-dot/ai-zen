import { fill, h, nextId, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { blob, clamp, curve, onSize, p2Defs, rng, stableHeight, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist, moon, pine, toro, wash } from '../../ui/part2/paint'
import { C } from './data'
import { bamboo } from './brush'
import { guide } from '../../ui/part2/guide'

const G = C.scenes.scaling
const f1 = (n: number) => n.toFixed(1)
const P = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`
const rad = (d: number) => (d * Math.PI) / 180

/** A water jar (chum) standing on (0, 0), W wide, H tall: wide belly, short neck, rolled rim. */
function jarPath(W: number, H: number) {
  const X = (k: number) => f1(k * W)
  const Y = (k: number) => f1(-k * H)
  return `M${X(-0.3)} ${Y(0)}L${X(0.3)} ${Y(0)}C${X(0.43)} ${Y(0.05)} ${X(0.54)} ${Y(0.34)} ${X(0.5)} ${Y(0.58)}C${X(0.47)} ${Y(0.78)} ${X(0.38)} ${Y(0.9)} ${X(0.29)} ${Y(0.945)}L${X(0.33)} ${Y(1)}L${X(-0.33)} ${Y(1)}L${X(-0.29)} ${Y(0.945)}C${X(-0.38)} ${Y(0.9)} ${X(-0.47)} ${Y(0.78)} ${X(-0.5)} ${Y(0.58)}C${X(-0.54)} ${Y(0.34)} ${X(-0.43)} ${Y(0.05)} ${X(-0.3)} ${Y(0)}Z`
}

/**
 * a glazed stone jar in its own svg: shadow, body, the lantern warm on its belly, fine cracks in the glaze, the moon on its
 * shoulder; seen from a little above, so its fill shows as a water line in the mouth (a surface that sinks behind the near
 * lip as the jar empties: the station moves `water` down by up to `depth` px)
 */
function jarArt(W: number, H: number, seed: number, id: string): { svg: SVGSVGElement; water: SVGGElement; hi: SVGPathElement; depth: number } {
  const r = rng(seed)
  const d = jarPath(W, H)
  let crack = ''
  for (let k = 0; k < 4; k++) {
    let p: Pt = [(r() - 0.5) * W * 0.55, -H * (0.12 + r() * 0.34)]
    const pts: Pt[] = [p]
    for (let j = 0; j < 5; j++) pts.push((p = [p[0] + (r() - 0.5) * W * 0.08, p[1] - H * (0.015 + r() * 0.04)]))
    crack += stroke(pts, Math.max(0.5, W * 0.0045), 0.2, 0.3, 0.3)
  }
  const band = stroke(curve([-W * 0.47, -H * 0.76], [0, -H * 0.68], [W * 0.47, -H * 0.76], 12), Math.max(1.2, W * 0.012), 0.1, 0.1, 0.3)
  const flank = stroke([...curve([W * 0.3, -H * 0.94], [W * 0.6, -H * 0.58], [W * 0.42, -H * 0.06], 12), [W * 0.26, 0]], Math.max(3, W * 0.13), 0.1, 0.2, 0.3)
  const rim = stroke(curve([-W * 0.28, -H * 0.93], [-W * 0.02, -H * 0.99], [W * 0.3, -H * 0.93], 12), Math.max(1.2, W * 0.018), 0.3, 0.3, 0.1)
  const mrx = W * 0.31, mry = H * 0.085
  const water = s('g', { class: 't28s-water' },
    s('ellipse', { class: 't28s-wsurf', cx: 0, cy: f1(-H + mry * 0.12), rx: f1(mrx * 0.96), ry: f1(mry * 0.92) }),
    s('path', { class: 't28s-glint', d: stroke([[-mrx * 0.55, -H - mry * 0.05], [-mrx * 0.05, -H - mry * 0.32], [mrx * 0.35, -H - mry * 0.2]], Math.max(1, mry * 0.22), 0.3, 0.3, 0.2) }))
  const hi = s('path', { class: 't28s-jar-hi', d: stroke(curve([-W * 0.3, -H * 0.74], [-W * 0.43, -H * 0.5], [-W * 0.35, -H * 0.24], 10), Math.max(2, W * 0.04), 0.3, 0.3, 0.2) })
  const svg = s('svg', { class: 't28s-jar-art', viewBox: `${f1(-W * 0.75)} ${f1(-H * 1.12)} ${f1(W * 1.5)} ${f1(H * 1.25)}`, 'aria-hidden': 'true' },
    s('defs', null,
      s('clipPath', { id: `${id}-m` }, s('ellipse', { cx: 0, cy: f1(-H), rx: f1(mrx), ry: f1(mry) })),
      s('radialGradient', { id: `${id}-l`, cx: 0.22, cy: 0.62, r: 0.62 },
        s('stop', { offset: 0, style: 'stop-color:var(--lantern);stop-opacity:.7' }),
        s('stop', { offset: 0.55, style: 'stop-color:var(--lantern);stop-opacity:.22' }),
        s('stop', { offset: 1, style: 'stop-color:var(--lantern);stop-opacity:0' }))),
    s('ellipse', { class: 't28s-jar-sh', cx: f1(W * 0.25), cy: 2, rx: f1(W * 0.72), ry: f1(H * 0.07) }),
    s('path', { class: 't28s-jarbody', d, filter: 'url(#ink-rough)' }),
    s('path', { class: 't28s-belly', d, fill: `url(#${id}-l)` }),
    s('path', { class: 't28s-crack', d: crack }),
    s('path', { class: 't28s-band', d: band }),
    s('path', { class: 't28s-flank', d: flank }),
    hi,
    s('path', { class: 't28s-rim', d: rim }),
    s('ellipse', { class: 't28s-mouth', cx: 0, cy: f1(-H), rx: f1(mrx), ry: f1(mry) }),
    s('g', { 'clip-path': `url(#${id}-m)` }, water),
    s('path', { class: 't28s-lip', d: stroke(curve([-W * 0.34, -H * 0.99], [0, -H * 0.9], [W * 0.34, -H * 0.99], 10), Math.max(2, W * 0.03), 0.1, 0.1, 0.4) }))
  return { svg, water, hi, depth: mry * 2.1 }
}

/**
 * A young tree in brush, foot at (0, 0), th tall: a tapering S-bent trunk with a moonlit edge, limbs, and leaf clusters of
 * slender brush dabs in four values, the outermost ones rim-lit by the moon's halo behind (no filters: it sways).
 */
function sapling(th: number, seed: number): SVGElement[] {
  const r = rng(seed)
  const top: Pt = [th * 0.04, -th]
  const trunk = curve([0, 0], [-th * 0.12, -th * 0.55], top, 14)
  let wood = stroke(trunk, Math.max(3, th * 0.06), 0.02, 0.95, 0.22)
  const edge = trunk.slice(1, 12).map(([x, y], i) => [x + th * (0.016 - i * 0.0011), y] as Pt)
  let lit = stroke(edge, Math.max(1, th * 0.012), 0.2, 0.4, 0.2)
  let bark = ''
  for (let i = 0; i < 6; i++) {
    const [bx, by] = trunk[1 + Math.floor(r() * 8)]
    bark += stroke([[bx - th * 0.012, by], [bx + th * 0.008, by - th * (0.02 + r() * 0.03)]], Math.max(0.8, th * 0.006), 0.3, 0.3, 0.2)
  }
  const tips: Pt[] = [top]
  ;[[0.42, -1, 0.34], [0.56, 1, 0.3], [0.72, -1, 0.22], [0.82, 1, 0.19]].forEach(([t, side, len]) => {
    const [bx, by] = trunk[Math.round(t * 14)]
    const L = th * len
    const end: Pt = [bx + side * L, by - L * (0.4 + r() * 0.2)]
    const limb = curve([bx, by], [bx + side * L * 0.5, by - L * 0.02], end, 8)
    wood += stroke(limb, Math.max(1.4, th * 0.024), 0.05, 0.8, 0.2)
    if (side > 0) lit += stroke(limb.slice(1, 6).map(([x, y]) => [x, y - th * 0.006] as Pt), Math.max(0.7, th * 0.006), 0.3, 0.3, 0.2)
    tips.push(end)
  })
  const tone = ['', '', '', '', '']
  let pads = ''
  tips.forEach(([tx, ty], k) => {
    const R = th * (k ? 0.13 : 0.16)
    pads += blob(tx, ty - R * 0.25, R * 1.2, R * 0.72, seed + k, 0.3, 14)
    for (let i = 0; i < 44; i++) {
      const a = r() * Math.PI * 2
      const dd = Math.sqrt(r())
      const px = tx + Math.cos(a) * dd * R * 1.25, py = ty + Math.sin(a) * dd * R * 0.78 - R * 0.25
      // leaves droop out from the cluster's heart; slender dabs, three to four points of a bent brush
      const ang = Math.atan2(py - ty, px - tx) + (r() - 0.5) * 0.9
      const len = R * (0.22 + r() * 0.2)
      const q: Pt = [px + Math.cos(ang) * len, py + Math.sin(ang) * len + len * 0.25]
      const m: Pt = [(px + q[0]) / 2 + Math.cos(ang + 1.57) * len * 0.15, (py + q[1]) / 2 + Math.sin(ang + 1.57) * len * 0.15]
      const leaf = stroke(curve([px, py], m, q, 6), len * (0.24 + r() * 0.1), 0.55, 0.5, 0.18)
      // value: dark under the cluster, light on top; the outer rim toward the halo catches the moon
      const up = (ty - py) / R
      const v = dd > 0.8 && up > 0 && r() < 0.4 ? 4 : up > 0.3 ? (r() < 0.65 ? 2 : 3) : up < -0.3 ? 0 : r() < 0.55 ? 1 : 2
      tone[v] += leaf
    }
  })
  return [
    s('path', { class: 't28s-pad', d: pads }),
    s('path', { class: 't28s-wood', d: wood }),
    s('path', { class: 't28s-bark', d: bark }),
    s('path', { class: 't28s-wood-lit', d: lit }),
    ...tone.map((d, v) => s('path', { class: `t28s-lf t28s-lf${v}`, d })),
  ]
}

/** Gopher, waiting on its own knoll in the mist: a trunk four times the sapling's, gnarled, under a thin starved crown */
function ghostTree(x: number, y: number, th: number, seed: number): SVGElement[] {
  const r = rng(seed)
  const tw = th * 0.11
  // a root flare, a squat trunk that forks into two limbs under the crown
  const trunk = `M${P([x - tw * 1.7, y])}C${P([x - tw * 0.8, y - th * 0.03])} ${P([x - tw * 0.62, y - th * 0.16])} ${P([x - tw * 0.55, y - th * 0.3])}C${P([x - tw * 0.5, y - th * 0.4])} ${P([x - tw * 0.9, y - th * 0.47])} ${P([x - tw * 1.3, y - th * 0.52])}L${P([x - tw * 0.9, y - th * 0.55])}C${P([x - tw * 0.4, y - th * 0.5])} ${P([x - tw * 0.1, y - th * 0.46])} ${P([x + tw * 0.1, y - th * 0.5])}C${P([x + tw * 0.3, y - th * 0.54])} ${P([x + tw * 0.6, y - th * 0.56])} ${P([x + tw * 0.9, y - th * 0.58])}L${P([x + tw * 1.1, y - th * 0.54])}C${P([x + tw * 0.62, y - th * 0.46])} ${P([x + tw * 0.55, y - th * 0.38])} ${P([x + tw * 0.56, y - th * 0.26])}C${P([x + tw * 0.62, y - th * 0.1])} ${P([x + tw * 0.95, y - th * 0.02])} ${P([x + tw * 1.8, y])}Z`
  let bark = ''
  for (let i = 0; i < 10; i++) {
    const yy = y - th * (0.04 + r() * 0.52), xx = x + (r() - 0.5) * tw * 0.8
    bark += stroke([[xx, yy], [xx + (r() - 0.5) * tw * 0.2, yy - th * (0.05 + r() * 0.07)]], Math.max(1, tw * 0.07), 0.2, 0.4, 0.2)
  }
  const limbs = stroke(curve([x + tw * 0.9, y - th * 0.57], [x + tw * 1.8, y - th * 0.64], [x + tw * 2.8, y - th * 0.6], 8), tw * 0.2, 0.05, 0.7, 0.3)
    + stroke(curve([x - tw * 1.1, y - th * 0.53], [x - tw * 1.9, y - th * 0.62], [x - tw * 2.6, y - th * 0.6], 8), tw * 0.17, 0.05, 0.7, 0.3)
  return [s('path', { class: 't28s-ghost-body', d: trunk + limbs, filter: 'url(#ink-wash)' }), s('path', { class: 't28s-ghost-bark', d: bark })]
}

/**
 * Faceted granite, foot centre at (0, 0), w × h: hard planes (a moonlit top, a front lit warm from the lantern on the left,
 * a dark right side), chipped edges, moss in the cracks, a hard line of moonlight along the back edge.
 */
function granite(w: number, h: number, seed: number): SVGGElement {
  const r = rng(seed)
  const j = (v: number, k = 0.025) => v + (r() - 0.5) * k * 2
  const X = (k: number) => j(k) * w, Y = (k: number) => -j(k, 0.02) * h
  const v = {
    bl: [X(-0.5), 0], l1: [X(-0.54), Y(0.3)], l2: [X(-0.47), Y(0.62)], t1: [X(-0.34), Y(0.84)], t2: [X(0.0), Y(0.96)],
    t3: [X(0.33), Y(0.9)], r1: [X(0.5), Y(0.7)], r2: [X(0.55), Y(0.33)], br: [X(0.48), 0],
    f1: [X(-0.2), Y(0.6)], e: [X(0.01), Y(0.585)], f2: [X(0.21), Y(0.57)],
    a0: [X(-0.33), 0], a1: [X(-0.29), Y(0.3)], b0: [X(0.07), 0], b1: [X(0.04), Y(0.28)], c0: [X(0.34), 0], c1: [X(0.31), Y(0.33)],
  } as Record<string, Pt>
  const M = (...ks: string[]) => `M${ks.map((k) => P(v[k])).join('L')}Z`
  // chips: little bites out of the front top edge, the bite's own floor in shadow
  let chips = ''
  for (const [p0, p1, t] of [['f1', 'e', 0.45], ['e', 'f2', 0.6], ['l2', 'f1', 0.5]] as [string, string, number][]) {
    const a: Pt = [v[p0][0] + (v[p1][0] - v[p0][0]) * t, v[p0][1] + (v[p1][1] - v[p0][1]) * t]
    const s0 = w * (0.025 + r() * 0.02)
    chips += `M${P([a[0] - s0, a[1]])}L${P([a[0] + s0 * 0.15, a[1] + s0 * 0.85])}L${P([a[0] + s0, a[1] + s0 * 0.1])}Z`
  }
  // the seams between facets run as cracks; moss sits in them and along the top edge
  let cracks = '', moss = ''
  for (const [p0, p1] of [['f1', 'a1'], ['a1', 'a0'], ['e', 'b1'], ['b1', 'b0'], ['f2', 'c1'], ['c1', 'c0']]) {
    const pts: Pt[] = Array.from({ length: 6 }, (_, i) => [v[p0][0] + (v[p1][0] - v[p0][0]) * (i / 5) + (r() - 0.5) * w * 0.012, v[p0][1] + (v[p1][1] - v[p0][1]) * (i / 5)] as Pt)
    cracks += stroke(pts, Math.max(1, w * 0.006), 0.1, 0.3, 0.4)
    for (let i = 1; i < 5; i += 2) if (r() < 0.75) moss += blob(pts[i][0] + w * 0.006, pts[i][1], w * (0.01 + r() * 0.012), h * (0.025 + r() * 0.02), seed + i * 7 + cracks.length, 0.35, 8)
  }
  let crackX = ''
  for (let k = 0; k < 3; k++) {
    let p: Pt = [w * (-0.25 + k * 0.22 + (r() - 0.5) * 0.06), -h * (0.4 - r() * 0.15)]
    const pts: Pt[] = [p]
    for (let i = 0; i < 4; i++) pts.push((p = [p[0] + w * (0.02 + r() * 0.025), p[1] + (r() - 0.4) * h * 0.05]))
    crackX += stroke(pts, Math.max(0.7, w * 0.0035), 0.2, 0.3, 0.3)
  }
  moss += blob(v.f1[0] + w * 0.05, v.f1[1] + h * 0.03, w * 0.06, h * 0.035, seed + 77, 0.3, 10) + blob(v.f2[0] - w * 0.03, v.f2[1] + h * 0.03, w * 0.05, h * 0.03, seed + 78, 0.3, 10)
  let grain = ''
  for (let k = 0; k < 40; k++) {
    const x = (r() - 0.5) * w * 0.95, y = -h * (0.04 + r() * 0.52)
    grain += blob(x, y, w * 0.003 + r() * w * 0.004, w * 0.0025, seed + 100 + k, 0.2, 6)
  }
  return s('g', { class: 't28s-granite' },
    s('ellipse', { class: 't28s-gr-sh', cx: f1(w * 0.12), cy: 2, rx: f1(w * 0.62), ry: f1(Math.max(4, h * 0.1)) }),
    s('path', { class: 't28s-gr-fa', d: M('bl', 'l1', 'l2', 'f1', 'a1', 'a0'), filter: 'url(#ink-rough)' }),
    s('path', { class: 't28s-gr-fb', d: M('a0', 'a1', 'f1', 'e', 'b1', 'b0'), filter: 'url(#ink-rough)' }),
    s('path', { class: 't28s-gr-fc', d: M('b0', 'b1', 'e', 'f2', 'c1', 'c0'), filter: 'url(#ink-rough)' }),
    s('path', { class: 't28s-gr-side', d: M('c0', 'c1', 'f2', 'r1', 'r2', 'br'), filter: 'url(#ink-rough)' }),
    s('path', { class: 't28s-gr-top', d: M('l2', 't1', 't2', 't3', 'r1', 'f2', 'e', 'f1'), filter: 'url(#ink-rough)' }),
    s('path', { class: 't28s-gr-chip', d: chips }),
    s('path', { class: 't28s-gr-grain', d: grain }),
    s('path', { class: 't28s-gr-crack', d: cracks + crackX }),
    s('path', { class: 't28s-gr-moss', d: moss }),
    s('path', { class: 't28s-gr-edge', d: stroke([v.l2, v.f1, v.e, v.f2, v.r1], Math.max(1.2, w * 0.006), 0.05, 0.05, 0.4) }),
    s('path', { class: 't28s-gr-rim', d: stroke([v.l2, v.t1, v.t2, v.t3, v.r1], Math.max(1.4, w * 0.008), 0.15, 0.2, 0.2) }))
}

/**
 * The seesaw: a long dressed stone with a groove along its top (the water runs in it), rounded ends, chisel marks, moss
 * and a moonlit top edge; its axis runs from (0, 0) to (2A, 0), bt thick. The two runs in the groove (centre → each end)
 * show how the pour splits.
 */
function beamArt(A: number, bt: number, seed: number): { svg: SVGSVGElement; runs: SVGPathElement[] } {
  const r = rng(seed)
  const L = 2 * A, h2 = bt / 2
  const body = `M${f1(h2)} ${f1(-h2)}L${f1(L - h2)} ${f1(-h2 - 1)}Q${f1(L + h2 * 0.5)} 0 ${f1(L - h2)} ${f1(h2)}L${f1(h2)} ${f1(h2 + 1)}Q${f1(-h2 * 0.5)} 0 ${f1(h2)} ${f1(-h2)}Z`
  const side = `M${f1(h2 * 0.6)} ${f1(h2 * 0.15)}L${f1(L - h2 * 0.6)} ${f1(h2 * 0.1)}Q${f1(L + h2 * 0.2)} ${f1(h2 * 0.6)} ${f1(L - h2)} ${f1(h2)}L${f1(h2)} ${f1(h2 + 1)}Q${f1(-h2 * 0.2)} ${f1(h2 * 0.6)} ${f1(h2 * 0.6)} ${f1(h2 * 0.15)}Z`
  let chisel = '', moss = ''
  for (let k = 0; k < 12; k++) {
    const x = h2 + r() * (L - bt), y = (r() - 0.2) * h2 * 0.8
    chisel += stroke([[x, y], [x + bt * (0.4 + r() * 0.6), y + (r() - 0.5) * 2]], Math.max(0.8, bt * 0.05), 0.3, 0.4, 0.2)
  }
  for (let k = 0; k < 6; k++) moss += blob(h2 + r() * (L - bt), h2 * 0.75, bt * (0.25 + r() * 0.35), bt * 0.13, seed + k, 0.3, 8)
  const groove = (x0: number, x1: number) => stroke([[x0, -h2 * 0.5], [(x0 + x1) / 2, -h2 * 0.56], [x1, -h2 * 0.5]], Math.max(1.6, bt * 0.24), 0.1, 0.1, 0.3)
  const runs = [s('path', { class: 't28s-run', d: groove(A, A * 0.16) }), s('path', { class: 't28s-run', d: groove(A, A * 1.84) })]
  const svg = s('svg', {
    class: 't28s-beam-art', viewBox: `${f1(-bt)} ${f1(-bt * 1.5)} ${f1(L + 2 * bt)} ${f1(bt * 3)}`, 'aria-hidden': 'true',
    style: `left:${f1(-bt)}px;top:${f1(-bt * 1.5)}px;width:${f1(L + 2 * bt)}px;height:${f1(bt * 3)}px`,
  },
  s('path', { class: 't28s-beam-body', d: body, filter: 'url(#ink-rough)' }),
  s('path', { class: 't28s-beam-side', d: side }),
  s('path', { class: 't28s-chisel', d: chisel }),
  s('path', { class: 't28s-gr-moss', d: moss }),
  s('path', { class: 't28s-beam-groove', d: groove(A * 0.14, A * 1.86) }),
  ...runs,
  s('path', { class: 't28s-rimlight', d: stroke([[h2, -h2], [A, -h2 - 1.2], [L - h2, -h2 - 1]], Math.max(1.2, bt * 0.08), 0.2, 0.2, 0.3) }))
  return { svg, runs }
}

/** The bamboo tap's handle: a wooden T on a short stem, seen from the front (it turns a quarter for each ×10). */
function valveArt(): SVGSVGElement {
  return s('svg', { viewBox: '-24 -24 48 48', 'aria-hidden': 'true' },
    s('circle', { class: 't28s-valve-glow', r: 22, fill: 'url(#p2-lamp)' }),
    s('g', { class: 't28s-valve' },
      s('path', { class: 't28s-valve-wood', d: stroke([[-17, 0], [0, -1], [17, 0]], 6.5, 0.15, 0.15, 0.4) }),
      s('path', { class: 't28s-valve-wood', d: stroke([[0, -13], [0.5, 0], [0, 13]], 5, 0.2, 0.2, 0.4) }),
      s('circle', { class: 't28s-valve-hub', r: 4.2 })))
}

const TILT = 14 // the seesaw's lean at full tilt, degrees
const A0 = 0.8 // it starts leaning to the Size end, as the industry did before 2022 (Gopher)
const BAL = 0.12 // |lean| / TILT under this counts as level

/**
 * Lớn lên cần thêm xẻng (art direction §4 t28 `scaling`; audit v3 28-2, reworked): a sapling on a stone seesaw. The bamboo
 * tap is the compute: turn it three times (×10, ×100, ×1000) and the pour doubles down the pipe, the sapling gains one
 * equal step each time against a carved measuring stake (an illustration). Then the seesaw: Data on the left, Model size on
 * the right, at first leaning hard to Size (so the water runs there, as it all ran into Gopher, the big tree in the mist).
 * Drag it level and the same water splits evenly: the sapling outgrows Gopher.
 */
export function scalingScene(ctx: SceneCtx) {
  p2Defs()
  const id = nextId('t28s')
  const still = ctx.reduced || ctx.quality === 'low'
  const stableH = stableHeight(ctx, [...(G.insights as Fact[])])
  const g = guide(ctx)
  const step = g.steps(G.prompts)
  step(0)

  const sky = s('svg', { class: 't28s-sky', 'aria-hidden': 'true' })
  const ghost = s('svg', { class: 't28s-ghost', 'aria-hidden': 'true' })
  const ground = s('svg', { class: 't28s-ground', 'aria-hidden': 'true' })
  const stick = s('svg', { class: 't28s-stick', 'aria-hidden': 'true' })
  const tree = h('div', { class: 't28s-tree' })
  const pipe = s('svg', { class: 't28s-pipe', 'aria-hidden': 'true' })
  const front = s('svg', { class: 't28s-front', 'aria-hidden': 'true' })
  const compute = h('p', { class: 't28s-left' }, G.compute)
  const levelWord = h('p', { class: 't28s-levelword', 'aria-hidden': 'true' }, G.level)
  const tap = h('button', { class: 't28s-tap', type: 'button', 'aria-label': G.tapAria }, valveArt())
  const drops = Array.from({ length: 5 }, () => h('i', { class: 't28s-drop' }))
  const jars = G.jars.map((j) => {
    const [main, sub] = j.name.split(' · ')
    const name = h('span', { class: 't28s-jname' }, h('b', null, main), sub ? h('small', null, sub) : null)
    return { el: h('div', { class: `t28s-jar t28s-jar-${j.id}`, 'aria-hidden': 'true' }, name), name, art: null as null | ReturnType<typeof jarArt> }
  })
  const hit = h('div', { class: 't28s-beam-hit', role: 'slider', tabindex: '0', 'aria-label': G.beamAria, 'aria-valuemin': '0', 'aria-valuemax': '100' })
  const beamArtBox = h('div', { class: 't28s-beam-box' })
  const beam = h('div', { class: 't28s-beam' }, beamArtBox, jars[0].el, jars[1].el, hit)
  const root = h('div', { class: 't28s', role: 'group', 'aria-label': G.art }, sky, ghost, ground, stick, pipe, beam, tree, front, compute, levelWord, tap, ...drops)
  ctx.art.append(root)

  let n = 0 // quarter turns of the tap: ×10 compute each
  let a = TILT * A0 // the seesaw's lean, + = the Size end (right) down
  let done = false
  let runs: SVGPathElement[] = []
  let marks: SVGElement[] = []
  let geo = { cx: 0, cy: 0, A: 1, bt: 1, foot: 0, mouth: [0, 0] as Pt, land: [0, 0] as Pt, tap: [0, 0] as Pt }
  const share = () => 0.5 + (0.5 * a) / TILT // the part of the pour that runs to the Size end
  const imb = () => Math.abs(a) / TILT
  const end = (side: number): Pt => [geo.cx + side * geo.A * 0.84 * Math.cos(rad(a)), geo.cy + side * geo.A * 0.84 * Math.sin(rad(a)) - geo.bt * 2.4]

  // guide marks: the dot on the tap and the groove along the pipe (×10 · ×100 · ×1000); later the level outline and a dot
  // on the heavy end of the seesaw
  const tapDot = g.dot(tap, { dir: [0.7, 0.7] })
  const way = g.track(() => [geo.tap, geo.mouth], { ticks: 4, labels: G.ticks })
  let level: ReturnType<typeof g.drop> | null = null
  let heavy: ReturnType<typeof g.dot> | null = null

  function render() {
    const sz = share()
    const parts = [1 - sz, sz]
    beam.style.setProperty('--a', `${f1(a)}deg`)
    jars.forEach((j, k) => {
      if (j.art) j.art.water.style.transform = `translateY(${f1((1 - clamp((parts[k] * n * 1.7) / 3, 0, 1)) * j.art.depth)}px)`
    })
    runs.forEach((p, k) => (p.style.opacity = n ? f1(0.12 + parts[k] * 0.88) : '0'))
    // one equal step per ×10 of compute; with all of it poured, the more level the seesaw the taller (level: past Gopher)
    const sc = done ? 1 : n < 3 ? 0.4 + 0.15 * n : 0.85 + 0.07 * clamp(1 - imb() / A0, 0, 1)
    const lean = n ? -a * 0.45 : 0 // it reaches toward the jar that runs short
    tree.style.transform = `translate(${f1(geo.cx)}px, ${f1(geo.foot)}px) rotate(${f1(lean)}deg) scale(${sc.toFixed(3)})`
    marks.forEach((m, k) => m.classList.toggle('on', k <= n))
    const data = Math.round((1 - sz) * 100)
    hit.setAttribute('aria-valuenow', String(data))
    hit.setAttribute('aria-valuetext', fill(G.valueText, { data, size: 100 - data }))
    root.classList.toggle('is-level', imb() < BAL)
  }

  /** a few drops down the thread from the spout to the seesaw (WAAPI, no loop) */
  function pour(k: number) {
    if (still) return
    const [mx, my] = geo.mouth, [lx, ly] = geo.land
    drops.slice(0, k).forEach((d, i) => d.animate([
      { transform: `translate(${f1(mx)}px, ${f1(my)}px) scale(0.6)`, opacity: 0 },
      { transform: `translate(${f1(mx)}px, ${f1(my + 6)}px) scale(1)`, opacity: 1, offset: 0.15 },
      { transform: `translate(${f1(lx)}px, ${f1(ly)}px) scale(1, 1.3)`, opacity: 0.9, offset: 0.92 },
      { transform: `translate(${f1(lx)}px, ${f1(ly)}px) scale(1.8, 0.3)`, opacity: 0 },
    ], { duration: 560, delay: i * 140, easing: 'cubic-bezier(.5,0,1,.6)' }))
  }

  // ── step 1: turn the tap (click, Enter, Space), three quarter turns
  tap.addEventListener('click', () => {
    if (n >= 3) return
    n++
    root.dataset.n = String(n)
    tap.style.setProperty('--turn', `${n * 90}deg`)
    way.set(n / 3)
    pour(2 + n)
    render()
    if (n < 3) return void ctx.chime('soft')
    tapDot.done()
    tap.disabled = true
    root.classList.add('is-full')
    ctx.chime('ok')
    ctx.insight(G.insights[0] as Fact)
    // step 2: the seesaw wakes — its level outline (H3) and a dot on the heavy end (lift it)
    step(1)
    level = g.drop(() => [geo.cx, geo.cy], { w: geo.A * 2 + geo.bt * 2, h: geo.bt + 16, round: false })
    heavy = g.dot(() => end(a >= 0 ? 1 : -1), { dir: [0, -1] })
    if (document.activeElement === tap) hit.focus({ preventScroll: true })
  })

  // ── step 2: tilt the seesaw by its ends (drag: the end under the pointer follows it), ← → on it
  function settle() {
    heavy?.at(() => end(a >= 0 ? 1 : -1))
    if (imb() >= BAL) {
      // H6: say which jar runs short and what to do
      g.wrong(fill(G.lopsided, { name: G.jars[a > 0 ? 0 : 1].name.split(' · ')[0] }))
      return
    }
    a = 0
    done = true
    render()
    level?.hit()
    heavy?.done()
    g.ok(hit)
    root.classList.add('reveal')
    hit.setAttribute('aria-disabled', 'true')
    ctx.chime('ok')
    ctx.insight(G.insights[1] as Fact, G.detail as Fact)
  }
  let drag = -1, box: DOMRect | null = null
  const follow = (e: PointerEvent) => {
    const dx = e.clientX - box!.left - geo.cx, dy = e.clientY - box!.top - geo.cy
    if (Math.abs(dx) < geo.A * 0.12) return
    a = clamp((Math.atan(dy / dx) * 180) / Math.PI, -TILT, TILT)
    render()
  }
  hit.addEventListener('pointerdown', (e) => {
    if (e.button || done) return
    if (n < 3) return void g.wrong(G.prompts[0], hit) // the water is not poured yet: turn the tap first
    drag = e.pointerId
    box = root.getBoundingClientRect()
    hit.setPointerCapture(e.pointerId)
    root.classList.add('is-drag')
    level?.lift(true)
    follow(e)
  })
  hit.addEventListener('pointermove', (e) => e.pointerId === drag && follow(e))
  const up = (e: PointerEvent) => {
    if (e.pointerId !== drag) return
    drag = -1
    root.classList.remove('is-drag')
    level?.lift(false)
    settle()
  }
  hit.addEventListener('pointerup', up)
  hit.addEventListener('pointercancel', up)
  hit.addEventListener('keydown', (e) => {
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    if (!d || done) return
    e.preventDefault()
    if (n < 3) return void g.wrong(G.prompts[0], hit)
    a = clamp(Math.round((a + d * TILT * 0.1) / (TILT * 0.1)) * TILT * 0.1, -TILT, TILT)
    render()
    if (imb() < BAL) settle()
    else heavy?.at(() => end(a >= 0 ? 1 : -1))
  })

  // H7: after 6 s still, the spout lets a big drop go (step 1) or the seesaw bobs once (step 2)
  const invite = () => {
    if (still || done) return
    if (n < 3) pour(1)
    else beam.animate([{ translate: '0 0' }, { translate: '0 4px' }, { translate: '0 0' }], { duration: 900, easing: 'ease-in-out' })
  }
  ctx.el.addEventListener('p2:idle', invite)
  ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', invite))

  // ── layout: everything is drawn once per size
  function layout() {
    const W = ctx.art.clientWidth
    const H = stableH(ctx.art.clientHeight)
    if (W < 60 || H < 60) return
    root.style.height = `${f1(H)}px`
    const wide = W / H > 1.15
    root.classList.toggle('tall', !wide)
    const r = wide ? Math.min(H * 0.4, W * 0.2) : Math.min(W * 0.3, H * 0.2)
    const cx = W * 0.5, cy = H * (wide ? 0.68 : 0.66)
    const bt = Math.max(10, r * 0.12), A = r * 1.28
    const hp = r * 0.5 // the fulcrum stone's height
    const groundY = cy + hp
    const foot = cy - bt / 2
    // the crown at its full height stays clear of the frame's top (audit: under y 80)
    const th = Math.max(60, Math.min(wide ? H * 0.42 : H * 0.26, (foot - 80) / 1.12))
    geo = { ...geo, cx, cy, A, bt, foot }
    ;[sky, ghost, ground, stick, pipe, front].forEach((v) => v.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`))
    // ── sky: the moon behind the sapling's full crown, far ranges, mist
    const horizon = cy - r * 0.32
    const moonY = Math.max(H * 0.13, foot - th * 0.95)
    sky.replaceChildren(
      mist(W * 0.5, horizon - r * 0.4, W * 0.7, H * 0.18),
      moon(cx + r * 0.08, moonY, Math.max(20, Math.min(W, H) * 0.07), 2801, true),
      hills(-W * 0.05, W * 1.05, horizon - r * 0.08, H * 0.2, 2805, 0.9, wide ? 5 : 3),
      hills(-W * 0.04, W * 0.45, horizon + r * 0.02, H * 0.13, 2806, 0.62, 2),
      hills(W * 0.58, W * 1.04, horizon + r * 0.05, H * 0.11, 2807, 0.6, 2),
      mist(W * 0.5, horizon + r * 0.12, W * 0.75, H * 0.06))
    // ── Gopher on its knoll in the mist (right third, about 70 % of the sapling's full height): its Size jar spilling,
    // its Data jar near empty; its name carved on the knoll
    const gx = W * (wide ? 0.8 : 0.8), gy = wide ? horizon + r * 0.06 : cy - r * 1.15, gh = th * (wide ? 0.72 : 0.6)
    const gj = (x: number, k: number, lvl: number) => {
      const jw = gh * (wide ? 0.17 : 0.26), jh = jw * 1.1
      const cid = `${id}-g${k}`
      return s('g', { transform: `translate(${f1(x)} ${f1(gy + 1)})` },
        s('clipPath', { id: cid }, s('path', { d: jarPath(jw, jh) })),
        s('ellipse', { class: 't28s-jar-sh', cx: f1(jw * 0.2), cy: 1, rx: f1(jw * 0.65), ry: f1(jh * 0.06) }),
        s('path', { class: 't28s-gjar', d: jarPath(jw, jh) }),
        s('rect', { class: 't28s-gwater', x: f1(-jw * 0.6), y: f1(-jh * Math.min(lvl, 1)), width: f1(jw * 1.2), height: f1(jh), 'clip-path': `url(#${cid})` }),
        lvl > 1 ? s('path', { class: 't28s-gspill', d: stroke(curve([jw * 0.3, -jh], [jw * 0.6, -jh * 0.6], [jw * 0.55, 0], 8), Math.max(1.5, jw * 0.06), 0.1, 0.4, 0.3) }) : null,
        s('text', { class: 't28s-gname', x: 0, y: f1(-jh * 0.42), 'text-anchor': 'middle', 'font-size': f1(clamp(jw * 0.2, 9, 12)) }, G.jars[k].name.split(' · ')[0]))
    }
    const knoll = `M${P([gx - gh * 0.95, gy + gh * 0.05])}C${P([gx - gh * 0.6, gy - gh * 0.07])} ${P([gx - gh * 0.25, gy - gh * 0.08])} ${P([gx, gy - gh * 0.07])}C${P([gx + gh * 0.3, gy - gh * 0.06])} ${P([gx + gh * 0.65, gy - gh * 0.03])} ${P([gx + gh * 1, gy + gh * 0.06])}Z`
    ghost.replaceChildren(
      s('g', { class: 't28s-ghost-tree' },
        wash(knoll, 0.7, 'p2p-wash t28s-knoll'),
        pine(gx + gh * 0.02, gy - gh * 0.5, gh * 0.5, 2821, -1),
        ...ghostTree(gx, gy - gh * 0.05, gh, 2808),
        gj(gx - gh * 0.5, 1, 1.02), gj(gx + gh * 0.52, 0, 0.12)),
      s('g', { class: 't28s-ghost-mist' }, mist(gx, gy - gh * 0.5, gh * 0.8, gh * 0.6), mist(gx, gy - gh * 0.04, gh * 1.2, gh * 0.18)),
      s('text', { class: 't28s-gtitle', x: f1(gx), y: f1(gy + Math.max(18, gh * 0.12)), 'text-anchor': 'middle', 'font-size': f1(clamp(gh * 0.09, 13, 17)) }, G.gopher))
    // ── ground: a moss plane receding to the mist, tufts and pebbles, the lantern low on the left, the fulcrum boulder
    const lampX = wide ? cx - r * 2.35 : W * 0.07
    const gr = rng(2840)
    const plane = `M${P([-W * 0.3, horizon])}C${P([W * 0.3, horizon - r * 0.04])} ${P([W * 0.7, horizon - r * 0.04])} ${P([W * 1.3, horizon])}L${P([W * 1.3, H * 1.3])}L${P([-W * 0.3, H * 1.3])}Z`
    const depthY = (z: number) => horizon + (H * 1.05 - horizon) * z ** 1.7
    let tufts = '', pebbles = '', pebHi = ''
    for (let i = 0; i < (wide ? 34 : 22); i++) {
      const z = 0.06 + gr() * 0.94
      const y = depthY(z), sc = 0.25 + z * 1.1
      const x = gr() * W * 1.1 - W * 0.05
      if (Math.abs(x - cx) < A * 1.1 && y > horizon && y < groundY + r * 0.2) continue // not under the seesaw
      const bw = (wide ? 26 : 16) * sc
      for (let b = 0; b < 5; b++) {
        const bx = x + (b - 2) * bw * 0.16 + (gr() - 0.5) * bw * 0.1
        tufts += stroke(curve([bx, y], [bx + (gr() - 0.5) * bw * 0.25, y - bw * 0.3], [bx + (b - 2) * bw * 0.12 + (gr() - 0.5) * bw * 0.2, y - bw * (0.45 + gr() * 0.35)], 5), Math.max(0.8, bw * 0.06), 0.05, 0.8, 0.1)
      }
      if (i % 3 === 0) {
        const pw = (wide ? 18 : 12) * sc * (0.6 + gr() * 0.6)
        const px = x + bw * 0.6
        pebbles += blob(px, y + pw * 0.05, pw, pw * 0.42, 2850 + i, 0.15, 10)
        pebHi += stroke([[px - pw * 0.6, y - pw * 0.22], [px, y - pw * 0.36], [px + pw * 0.5, y - pw * 0.25]], Math.max(0.8, pw * 0.1), 0.3, 0.3, 0.2)
      }
    }
    ground.replaceChildren(
      s('defs', null, s('linearGradient', { id: `${id}-gp`, x1: 0, y1: f1(horizon - r * 0.05), x2: 0, y2: f1(H), gradientUnits: 'userSpaceOnUse' },
        s('stop', { offset: 0, style: 'stop-color:var(--moss-a);stop-opacity:0' }),
        s('stop', { offset: 0.14, style: 'stop-color:var(--moss-a);stop-opacity:var(--t28s-moss-k)' }),
        s('stop', { offset: 0.7, style: 'stop-color:var(--moss-b);stop-opacity:var(--t28s-moss-k)' }),
        s('stop', { offset: 1, style: 'stop-color:var(--moss-b);stop-opacity:0' }))),
      s('path', { d: plane, fill: `url(#${id}-gp)` }),
      s('circle', { cx: f1(lampX), cy: f1(groundY - H * 0.08), r: f1(r * 1.4), fill: 'url(#p2-lamp)', class: 't28s-lampglow' }),
      s('path', { class: 't28s-tuft', d: tufts }),
      s('path', { class: 't28s-peb', d: pebbles }),
      s('path', { class: 't28s-peb-hi', d: pebHi }),
      wash(blob(cx + r * 0.3, groundY + r * 0.06, A * 1.05, r * 0.16, 2810, 0.15), 0.42, 'p2p-wash t28s-shadow'),
      s('g', { transform: `translate(${f1(cx)} ${f1(groundY)})` }, granite(r * 1.05, hp * 1.04, 2822)),
      grass(cx - r * 0.62, groundY + 4, Math.max(12, r * 0.16), 2812),
      grass(cx + r * 0.6, groundY + 6, Math.max(10, r * 0.13), 2813),
      s('g', { transform: `translate(${f1(lampX)} ${f1(groundY + H * (wide ? 0.02 : 0.08))})` }, toro(0, 0, Math.max(60, r * 0.75), true)))
    // ── the seesaw: a stone beam on the boulder, a jar standing on each end (kept upright as it leans)
    Object.assign(beam.style, { left: `${f1(cx - A)}px`, top: `${f1(cy)}px`, width: `${f1(2 * A)}px`, transformOrigin: `${f1(A)}px 0px` })
    const ba = beamArt(A, bt, 2824)
    runs = ba.runs
    beamArtBox.replaceChildren(ba.svg)
    const jw = r * (wide ? 0.5 : 0.52), jh = jw * 1.08
    jars.forEach((j, k) => {
      const x = k ? A * 1.84 : A * 0.16
      j.art = jarArt(jw, jh, 2814 + k, `${id}-j${k}`)
      const bw = jw * 1.5, bh = jh * 1.25
      Object.assign(j.el.style, { left: `${f1(x - bw / 2)}px`, top: `${f1(-bt / 2 - jh * 1.12)}px`, width: `${f1(bw)}px`, height: `${f1(bh)}px` })
      j.el.style.setProperty('--foot', `${f1(jh * 1.12)}px`)
      j.el.style.setProperty('--below', `${f1(jh * 1.12 + bt * 0.9 + 6)}px`)
      j.el.style.setProperty('--fs', `${f1(clamp(jw * 0.13, 12, 15))}px`)
      j.el.replaceChildren(j.art.svg, j.name)
    })
    Object.assign(hit.style, { left: `${f1(-bt)}px`, top: `${f1(-bt / 2 - jh * 1.2)}px`, width: `${f1(2 * A + 2 * bt)}px`, height: `${f1(jh * 1.2 + bt * 1.8)}px` })
    Object.assign(levelWord.style, { left: `${f1(cx + A + bt + 10)}px`, top: `${f1(cy)}px` })
    // ── the sapling (drawn once, scaled and leaned by transform), the bamboo pipe and its tap
    tree.replaceChildren(s('svg', { viewBox: `${f1(-th * 0.6)} ${f1(-th * 1.1)} ${f1(th * 1.2)} ${f1(th * 1.15)}`, style: `width:${f1(th * 1.2)}px;height:${f1(th * 1.15)}px;left:${f1(-th * 0.6)}px;top:${f1(-th * 1.1)}px` },
      s('ellipse', { class: 't28s-halo', cx: 0, cy: f1(-th * 0.6), rx: f1(th * 0.55), ry: f1(th * 0.5), fill: 'url(#p2-halo)' }),
      ...sapling(th, 2803)))
    const pw = Math.max(14, Math.min(26, r * 0.09))
    const mouth: Pt = [cx - r * 0.24, foot - r * (wide ? 0.95 : 1.05)]
    geo.mouth = [mouth[0] - pw * 0.15, mouth[1] + pw * 0.6]
    geo.land = [cx - r * 0.12, foot - bt * 0.3]
    const start: Pt = [cx - r * (wide ? 1.9 : 1.32), mouth[1] - r * (wide ? 0.42 : 0.5)]
    const t0 = 0.24
    const post: Pt = [start[0] + (mouth[0] - start[0]) * t0, start[1] + (mouth[1] - start[1]) * t0 + pw * 0.75]
    const pfoot: Pt = [post[0] - pw * 0.2, groundY - r * 0.2]
    let thread = ''
    for (let i = 0; i < 9; i++) {
      const t = ((i + 0.6) / 9) ** 1.6
      const x = geo.mouth[0] + (geo.land[0] - geo.mouth[0]) * t, y = geo.mouth[1] + (geo.land[1] - geo.mouth[1]) * t
      const k = 0.7 + t * 0.6
      thread += `M${P([x, y - pw * 0.17 * k])}Q${P([x + pw * 0.1 * k, y + pw * 0.04])} ${P([x, y + pw * 0.1 * k])}Q${P([x - pw * 0.1 * k, y + pw * 0.04])} ${P([x, y - pw * 0.17 * k])}Z`
    }
    const cord = stroke([[post[0] - pw * 0.6, post[1] - pw * 0.55], [post[0] + pw * 0.55, post[1] - pw * 0.25]], Math.max(1, pw * 0.1), 0.2, 0.2, 0.4)
      + stroke([[post[0] - pw * 0.55, post[1] - pw * 0.2], [post[0] + pw * 0.6, post[1] - pw * 0.6]], Math.max(1, pw * 0.1), 0.2, 0.2, 0.4)
    pipe.replaceChildren(
      bamboo(pfoot, post, pw * 0.85, 2823, true, '', pw * 0.15),
      bamboo([start[0] - pw * 1.2, start[1] - pw * 0.25], mouth, pw, 2815, true, '', -pw * 0.9),
      s('path', { class: 't28s-cord', d: cord }),
      s('path', { class: 't28s-hang', d: blob(geo.mouth[0], geo.mouth[1], pw * 0.16, pw * 0.22, 2816, 0.05, 8) }),
      s('path', { class: 't28s-thread', d: thread }),
      s('ellipse', { class: 't28s-ripple', cx: f1(geo.land[0]), cy: f1(geo.land[1]), rx: f1(pw * 0.9), ry: f1(pw * 0.3) }))
    geo.tap = [start[0] + pw * 0.2, start[1] - pw * 0.15]
    Object.assign(tap.style, { left: `${f1(geo.tap[0])}px`, top: `${f1(geo.tap[1])}px` })
    // the words cut along the pipe (a phone: level, above the tap)
    const ang = (Math.atan2(mouth[1] - start[1], mouth[0] - start[0]) * 180) / Math.PI
    const mid: Pt = [start[0] + (mouth[0] - start[0]) * 0.55, start[1] + (mouth[1] - start[1]) * 0.55]
    if (wide) Object.assign(compute.style, { left: `${f1(mid[0])}px`, top: `${f1(mid[1] - pw * 1.3)}px`, transform: `translate(-50%, -50%) rotate(${f1(ang)}deg)`, maxWidth: '' })
    else Object.assign(compute.style, { left: '12px', top: `${f1(Math.max(6, geo.tap[1] - 64))}px`, transform: 'none', maxWidth: `${f1(W * 0.62)}px` })
    // ── the measuring stake beside the sapling: a notch for each step it can gain (an illustration, not data)
    const sx = cx + r * (wide ? 0.66 : 0.7)
    const lv = (k: number) => foot - th * (0.4 + 0.15 * k)
    marks = [0, 1, 2, 3].map((k) => s('path', { class: 't28s-mark', d: stroke([[sx - 9, lv(k)], [sx + 9, lv(k) + 0.5]], 2.6, 0.1, 0.1, 0.4) }))
    stick.replaceChildren(
      s('path', { class: 't28s-stake', d: stroke([[sx, groundY - r * 0.1], [sx + 0.5, lv(3) - th * 0.06]], Math.max(3, r * 0.025), 0.05, 0.2, 0.5) }),
      ...marks,
      s('text', { class: 't28s-illus', x: f1(sx + 12), y: f1(lv(3) - th * 0.04), 'font-size': 13 }, G.illus))
    // ── the near bank: a dark mossy edge cut by the frame
    let blades = ''
    const fr = rng(2817)
    for (let i = 0; i < 26; i++) {
      const x = i < 13 ? fr() * W * 0.2 : W - fr() * W * 0.18, y = H - fr() * H * 0.02, bl = wide ? 1 : 0.6
      blades += stroke(curve([x, H + 2], [x + (fr() - 0.5) * 10, y - H * 0.03 * bl], [x + (fr() - 0.5) * 18, y - H * (0.03 + fr() * 0.035) * bl], 5), 1.4 + fr() * 1.6, 0.05, 0.8, 0.1)
    }
    front.replaceChildren(s('path', { class: 't28s-blades', d: blades }))
    render()
    g.refresh()
  }
  ctx.onCleanup(onSize(ctx.art, layout))
}
