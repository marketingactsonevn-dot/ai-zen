import { fill, h, nextId, s } from '../../core/dom'
import { createLoop } from '../../core/loop'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { blob, clamp, curve, onSize, p2Defs, rng, stableHeight, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist, moon, pine, toro, wash } from '../../ui/part2/paint'
import { C } from './data'
import { bamboo } from './brush'

const G = C.scenes.scaling
const TOTAL = 100
const VIEW = 62 // the basin's plane leans back this far: we look down on it from just under 30°
const TILT = 13 // degrees at a corner
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

/** Barycentric weights of p in triangle (a, b, c), clamped into it */
function bary(p: Pt, a: Pt, b: Pt, c: Pt): [number, number, number] {
  const d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
  let u = ((b[1] - c[1]) * (p[0] - c[0]) + (c[0] - b[0]) * (p[1] - c[1])) / d
  let v = ((c[1] - a[1]) * (p[0] - c[0]) + (a[0] - c[0]) * (p[1] - c[1])) / d
  let w = 1 - u - v
  u = Math.max(0, u)
  v = Math.max(0, v)
  w = Math.max(0, w)
  const t = u + v + w
  return [u / t, v / t, w / t]
}

/**
 * Lớn lên cần thêm xẻng (art direction §4 t28 `scaling`, 2.5D): a triangular stone basin on a mossy plinth, seen 20° from
 * above in true CSS perspective; its three corners spill into three jars (Data front left, Size at the back, Compute front
 * right). Drag the basin to tilt it: the silver drops run downhill, split by where it leans (barycentric), so a level
 * basin shares them evenly. Each jar is a slider; the sapling on its stone leans away from the jar that runs short.
 */
export function scalingScene(ctx: SceneCtx) {
  p2Defs()
  const id = nextId('t28s')
  const still = ctx.reduced || ctx.quality === 'low'
  const stableH = stableHeight(ctx, [...(G.insights as Fact[])])
  ctx.prompt(G.prompt)

  const sky = s('svg', { class: 't28s-sky', 'aria-hidden': 'true' })
  const ghost = s('svg', { class: 't28s-ghost', 'aria-hidden': 'true' })
  const ground = s('svg', { class: 't28s-ground', 'aria-hidden': 'true' })
  const top = s('svg', { class: 't28s-top', 'aria-hidden': 'true' })
  // the stone's thickness: three copies of its outline stepping down under the top face
  const sides = [0, 1, 2, 3, 4, 5].map((k) => s('svg', { class: 't28s-side', style: `--k:${k}`, 'aria-hidden': 'true' }))
  const plane = h('div', { class: 't28s-plane' }, ...sides.slice().reverse(), top)
  const basin = h('div', { class: 't28s-basin', tabindex: '0', role: 'group', 'aria-label': G.art, 'aria-description': G.basinAria }, plane)
  const tree = h('div', { class: 't28s-tree' })
  const pipe = s('svg', { class: 't28s-pipe', 'aria-hidden': 'true' })
  const streams = s('svg', { class: 't28s-streams', 'aria-hidden': 'true' })
  const front = s('svg', { class: 't28s-front', 'aria-hidden': 'true' })
  const left = h('p', { class: 't28s-left' })
  const status = h('p', { class: 't28s-status' })
  const drops = Array.from({ length: 6 }, () => h('i', { class: 't28s-drop' }))
  const jars = G.jars.map((j, k) => {
    const name = h('span', { class: 't28s-name' }, j.name)
    const val = h('span', { class: 't28s-val' }, '0')
    const el = h('div', {
      class: `t28s-jar t28s-jar-${j.id}`, role: 'slider', tabindex: '0', 'aria-label': fill(G.slider, { name: j.name }), 'aria-description': j.aria,
      'aria-valuemin': '0', 'aria-valuemax': String(TOTAL), 'aria-valuenow': '0', 'aria-valuetext': fill(G.valueText, { n: 0, name: j.name }),
    }, name, val)
    el.addEventListener('keydown', (e) => {
      const d = { ArrowUp: 5, ArrowRight: 5, ArrowDown: -5, ArrowLeft: -5, PageUp: 10, PageDown: -10 }[e.key]
      if (!d) return
      e.preventDefault()
      nudge(k, d)
    })
    return { el, name, val, art: null as null | ReturnType<typeof jarArt> }
  })
  const root = h('div', { class: 't28s' }, sky, ghost, ground, jars[1].el, basin, tree, pipe, streams, jars[0].el, jars[2].el, front, left, status, ...drops)
  ctx.art.append(root)

  // the tilt point p in the basin's own plane (px, y toward the viewer); the corners; the split it gives
  let geo = { W: 1, H: 1, cx: 0, cy: 0, r: 1, persp: 1, mouth: [0, 0] as Pt, jar: [[0, 0], [0, 0], [0, 0]] as Pt[] }
  let corner: Pt[] = [[0, 0], [0, 0], [0, 0]]
  let p: Pt = [0, 0]
  let w: [number, number, number] = [1 / 3, 1 / 3, 1 / 3]
  let poured = 0, started = false, stage = 0 // 0 · 1 balanced once (insight 1) · 2 Gopher shown
  const cnt = [0, 0, 0], shownC = [-1, -1, -1]
  let lo = 0, bal = 0, lastLeft = -1
  /** whole drops per jar for the split w (largest remainders get the leftovers), into cnt */
  const counts = () => {
    let rest = TOTAL
    for (let k = 0; k < 3; k++) rest -= cnt[k] = Math.floor(w[k] * TOTAL)
    for (; rest > 0; rest--) {
      let best = 0
      for (let k = 1; k < 3; k++) if (w[k] * TOTAL - cnt[k] > w[best] * TOTAL - cnt[best]) best = k
      cnt[best]++
    }
  }
  const tilt = (): [number, number] => [(p[0] / geo.r) * TILT, (p[1] / geo.r) * TILT]
  /** CSS rotateX(VIEW) rotateX(-ty) rotateY(tx) about the basin centre, then the basin's perspective: plane point → screen */
  function project(x: number, y: number, z = 0): Pt {
    const [tx, ty] = tilt()
    const X = x * Math.cos(rad(tx)) + z * Math.sin(rad(tx))
    let Z = -x * Math.sin(rad(tx)) + z * Math.cos(rad(tx))
    let Y = y
    const a = rad(-ty), b = rad(VIEW)
    ;[Y, Z] = [Y * Math.cos(a) - Z * Math.sin(a), Y * Math.sin(a) + Z * Math.cos(a)]
    ;[Y, Z] = [Y * Math.cos(b) - Z * Math.sin(b), Y * Math.sin(b) + Z * Math.cos(b)]
    const k = geo.persp / (geo.persp - Z)
    return [geo.cx + X * k, geo.cy + Y * k]
  }
  const streamEls = [0, 1, 2].map(() => s('path', { class: 't28s-stream' }))
  streams.append(...streamEls)

  /** p moved: the basin leans, the split changes, the streams bend to the jars */
  function onTilt() {
    const [tx, ty] = tilt()
    plane.style.transform = `rotateX(${f1(VIEW)}deg) rotateX(${f1(-ty)}deg) rotateY(${f1(tx)}deg)`
    root.style.setProperty('--tilt', (p[0] / geo.r).toFixed(3))
    w = bary(p, corner[0], corner[1], corner[2])
    counts()
    lo = w.indexOf(Math.min(...w))
    bal = Math.max(...w) - Math.min(...w)
    jars.forEach((j, k) => {
      j.el.setAttribute('aria-valuenow', String(cnt[k]))
      j.el.setAttribute('aria-valuetext', fill(G.valueText, { n: cnt[k], name: G.jars[k].name }))
      const a = project(corner[k][0] * 1.08, corner[k][1] * 1.08, -4)
      const b = geo.jar[k]
      const m: Pt = [(a[0] + b[0]) / 2 + (a[0] - geo.cx) * 0.12, Math.min(a[1], b[1]) - 4]
      streamEls[k].setAttribute('d', stroke(curve(a, m, b, 10), 1 + w[k] * 7, 0.3, 0.6, 0.3))
    })
    const pool = top.querySelector<SVGGElement>('.t28s-pool')
    if (pool) pool.style.transform = `translate(${f1(p[0] * 0.35)}px, ${f1(p[1] * 0.35)}px)`
    levels()
  }
  /** the pour moved on (or the split changed): water in the jars, the drops left, the sapling, the insights */
  function levels() {
    for (let k = 0; k < 3; k++) {
      const n = Math.round((cnt[k] * poured) / TOTAL)
      const j = jars[k]
      streamEls[k].style.opacity = poured < TOTAL && started ? f1(0.25 + w[k]) : '0'
      if (n === shownC[k]) continue
      shownC[k] = n
      j.val.textContent = String(n)
      if (j.art) j.art.water.style.transform = `translateY(${f1((1 - clamp(n / 45, 0, 1)) * j.art.depth)}px)`
    }
    const sx = lo === 0 ? 1 : lo === 2 ? -1 : 0
    const lean = started ? sx * clamp(bal * 70, 0, 24) : 0
    const grow = started ? 0.6 + 0.4 * (poured / TOTAL) * clamp(1 - bal * 2.2, 0, 1) : 0.6
    const shoot = stage >= 2 ? 1.7 : 1
    const sc = still ? (shoot > 1 ? 1.7 : grow > 0.9 ? 1 : grow > 0.75 ? 0.8 : 0.6) : grow * shoot
    tree.style.transform = `translate(${f1(geo.cx)}px, ${f1(geo.cy)}px) rotate(${f1(lean)}deg) scale(${sc.toFixed(3)})`
    const left0 = TOTAL - Math.round(poured)
    if (left0 !== lastLeft) (lastLeft = left0), (left.textContent = fill(G.remaining, { n: left0 }))
    const balanced = bal < 0.1
    const st = !started ? '' : balanced ? G.balanced : fill(G.lopsided, { name: G.jars[lo].name })
    if (status.textContent !== st) status.textContent = st
    root.classList.toggle('ok', balanced && poured >= TOTAL)
    if (poured >= TOTAL && balanced && stage === 0) {
      stage = 1
      ctx.insight(G.insights[0] as Fact)
      ctx.chime('ok')
      // then the mist lifts off the old giant, and the sapling outgrows its crown
      const t = window.setTimeout(() => {
        stage = 2
        root.classList.add('reveal')
        ctx.insight(G.insights[1] as Fact, G.detail)
        levels()
      }, still ? 0 : 1700)
      ctx.onCleanup(() => clearTimeout(t))
    }
  }

  // ── the pour: 100 drops in about four seconds once the viewer first touches the basin or a jar
  let drop = 0, nextDrop = 0
  const loop = createLoop(root, (t, dt) => {
    poured = Math.min(TOTAL, poured + dt * 25)
    if (t >= nextDrop && poured < TOTAL) {
      nextDrop = t + 0.14
      const d = drops[drop++ % drops.length]
      const [mx, my] = geo.mouth
      const [bx, by] = project((Math.random() - 0.5) * geo.r * 0.12, (Math.random() - 0.5) * geo.r * 0.12, 0)
      d.animate([
        { transform: `translate(${f1(mx)}px, ${f1(my)}px) scale(0.6)`, opacity: 0 },
        { transform: `translate(${f1(mx)}px, ${f1(my + 6)}px) scale(1)`, opacity: 1, offset: 0.15 },
        { transform: `translate(${f1(bx)}px, ${f1(by)}px) scale(1, 1.3)`, opacity: 0.9, offset: 0.92 },
        { transform: `translate(${f1(bx)}px, ${f1(by)}px) scale(1.8, 0.3)`, opacity: 0 },
      ], { duration: 520, easing: 'cubic-bezier(.5,0,1,.6)' })
    }
    levels()
    return poured < TOTAL
  })
  ctx.onCleanup(() => loop.dispose())
  function begin() {
    if (started) return
    started = true
    if (!left.hasAttribute('aria-live')) left.setAttribute('aria-live', 'off')
    if (!status.hasAttribute('aria-live')) status.setAttribute('aria-live', 'polite')
    ctx.chime('soft')
    if (still) (poured = TOTAL), levels()
    else loop.start()
  }

  // ── input: drag the basin (the point under the pointer goes down), arrows on the focused basin, Up/Down on a jar
  const toPlane = (x: number, y: number): Pt => {
    const k = 1 / Math.cos(rad(VIEW))
    let q: Pt = [x - geo.cx, (y - geo.cy) * k]
    // keep it inside the triangle (a little in from the corners)
    const [a, b, c] = bary(q, corner[0], corner[1], corner[2])
    q = [a * corner[0][0] + b * corner[1][0] + c * corner[2][0], a * corner[0][1] + b * corner[1][1] + c * corner[2][1]]
    return [q[0] * 0.9, q[1] * 0.9]
  }
  let drag = -1, rect: DOMRect | null = null
  root.addEventListener('pointerdown', (e) => {
    if (e.button || (e.target as HTMLElement).closest('.t28s-jar')) return
    drag = e.pointerId
    rect = root.getBoundingClientRect()
    root.setPointerCapture(e.pointerId)
    p = toPlane(e.clientX - rect.left, e.clientY - rect.top)
    begin()
    onTilt()
  })
  root.addEventListener('pointermove', (e) => {
    if (e.pointerId !== drag || !rect) return
    p = toPlane(e.clientX - rect.left, e.clientY - rect.top)
    onTilt()
  })
  const up = (e: PointerEvent) => void (e.pointerId === drag && (drag = -1))
  root.addEventListener('pointerup', up)
  root.addEventListener('pointercancel', up)
  basin.addEventListener('keydown', (e) => {
    const d = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, Pt>)[e.key]
    if (!d) return
    e.preventDefault()
    const pt = geo.cx + p[0] + d[0] * geo.r * 0.08, py = geo.cy + (p[1] + d[1] * geo.r * 0.08) * Math.cos(rad(VIEW))
    p = toPlane(pt, py)
    begin()
    onTilt()
  })
  /** a jar's slider: give it n more drops (or fewer), the other two share the rest as they did */
  function nudge(k: number, n: number) {
    const c = cnt
    const want = clamp(c[k] + n, 0, TOTAL)
    const others = [0, 1, 2].filter((i) => i !== k)
    const was = c[others[0]] + c[others[1]]
    const nw: [number, number, number] = [0, 0, 0]
    nw[k] = want / TOTAL
    others.forEach((i) => (nw[i] = ((was ? c[i] / was : 0.5) * (TOTAL - want)) / TOTAL))
    p = [0, 1].map((ax) => (nw[0] * corner[0][ax] + nw[1] * corner[1][ax] + nw[2] * corner[2][ax]) * 0.999) as Pt
    begin()
    onTilt()
  }

  // ── layout: everything is drawn once per size
  function layout() {
    const W = ctx.art.clientWidth
    const H = stableH(ctx.art.clientHeight)
    if (W < 60 || H < 60) return
    root.style.height = `${f1(H)}px`
    const wide = W / H > 1.15
    // a phone frame: the diorama at about 0.85 and lower, so the moss fills the frame down to the bottom
    const r = wide ? Math.min(H * 0.44, W * 0.21) : Math.min(W * 0.29, H * 0.205)
    const cx = W * 0.5, cy = H * (wide ? 0.6 : 0.62)
    const old = geo.r
    geo = { ...geo, W, H, cx, cy, r, persp: Math.max(W, H) * 1.3 }
    if (old !== 1) p = [(p[0] * r) / old, (p[1] * r) / old]
    corner = [[-r * 0.866, r * 0.5], [0, -r], [r * 0.866, r * 0.5]]
    if (!started) p = [0, -r * 0.42] // it starts leaning toward Size, as the industry did before 2022
    Object.assign(basin.style, { left: `${f1(cx - r * 1.1)}px`, top: `${f1(cy - r * 1.1)}px`, width: `${f1(r * 2.2)}px`, height: `${f1(r * 2.2)}px`, perspective: `${f1(geo.persp)}px` })
    // the rim's thickness: six copies of its outline stepping down under the top face
    sides.forEach((v, k) => (v.style.transform = `translateZ(${f1(-r * 0.03 * (k + 1))}px)`))
    ;[sky, ghost, ground, pipe, streams, front].forEach((v) => v.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`))
    const seedR = rng(2802)
    const hp = r * 0.66 // the plinth's height on screen
    const cosV = Math.cos(rad(VIEW))
    const groundY = cy + hp
    // ── sky: moon right behind the sapling (it stands against the halo), far ranges, mist
    const th = wide ? H * 0.36 : H * 0.2
    const moonY = Math.max(H * 0.14, cy - r * cosV - th * 1.05)
    const horizon = cy - r * cosV * 0.35
    sky.replaceChildren(
      mist(W * 0.5, groundY - r * 0.9, W * 0.7, H * 0.18),
      moon(cx + r * 0.08, moonY, Math.max(20, Math.min(W, H) * 0.075), 2801, true),
      hills(-W * 0.05, W * 1.05, cy - r * cosV * 0.4, H * 0.2, 2805, 0.9, wide ? 5 : 3),
      hills(-W * 0.04, W * 0.45, cy - r * cosV * 0.2, H * 0.13, 2806, 0.62, 2),
      hills(W * 0.58, W * 1.04, cy - r * cosV * 0.15, H * 0.11, 2807, 0.6, 2),
      mist(W * 0.5, horizon, W * 0.75, H * 0.06))
    // ── Gopher on its own knoll behind the mist (right and back); its two jars stand on the knoll, names on their bodies
    // (a phone frame: higher in the mist and both jars right of the trunk, clear of the near Size jar)
    const gx = wide ? W * 0.82 : W * 0.8, gy = horizon + (wide ? r * 0.02 : -r * 0.32), gh = wide ? H * 0.34 : H * 0.16
    const gj = (x: number, k: number, lvl: number) => {
      const jw = gh * (wide ? 0.17 : 0.26), jh = jw * 1.1
      const cid = `${id}-g${k}`
      return s('g', { transform: `translate(${f1(x)} ${f1(gy + 1)})` },
        s('clipPath', { id: cid }, s('path', { d: jarPath(jw, jh) })),
        s('ellipse', { class: 't28s-jar-sh', cx: f1(jw * 0.2), cy: 1, rx: f1(jw * 0.65), ry: f1(jh * 0.06) }),
        s('path', { class: 't28s-gjar', d: jarPath(jw, jh) }),
        s('rect', { class: 't28s-gwater', x: f1(-jw * 0.6), y: f1(-jh * Math.min(lvl, 1)), width: f1(jw * 1.2), height: f1(jh), 'clip-path': `url(#${cid})` }),
        lvl > 1 ? s('path', { class: 't28s-gspill', d: stroke(curve([jw * 0.3, -jh], [jw * 0.6, -jh * 0.6], [jw * 0.55, 0], 8), Math.max(1.5, jw * 0.06), 0.1, 0.4, 0.3) }) : null,
        s('text', { class: 't28s-gname', x: 0, y: f1(-jh * 0.42), 'text-anchor': 'middle', 'font-size': f1(clamp(jw * 0.2, 9, 12)) }, G.jars[k].name))
    }
    const knoll = `M${P([gx - gh * 0.95, gy + gh * 0.05])}C${P([gx - gh * 0.6, gy - gh * 0.07])} ${P([gx - gh * 0.25, gy - gh * 0.08])} ${P([gx, gy - gh * 0.07])}C${P([gx + gh * 0.3, gy - gh * 0.06])} ${P([gx + gh * 0.65, gy - gh * 0.03])} ${P([gx + gh * 1, gy + gh * 0.06])}Z`
    ghost.replaceChildren(
      s('g', { class: 't28s-ghost-tree' },
        wash(knoll, 0.7, 'p2p-wash t28s-knoll'),
        pine(gx + gh * 0.02, gy - gh * 0.5, gh * 0.5, 2821, -1),
        ...ghostTree(gx, gy - gh * 0.05, gh, 2808),
        gj(gx - gh * (wide ? 0.5 : 0.12), 1, 1.02), gj(gx + gh * (wide ? 0.52 : 0.5), 0, 0.12)),
      s('g', { class: 't28s-ghost-mist' }, mist(gx, gy - gh * 0.5, gh * 0.8, gh * 0.6), mist(gx, gy - gh * 0.04, gh * 1.2, gh * 0.18)))
    // ── ground: a moss plane receding to the mist (no edges: it bleeds past the frame), tufts and pebbles that shrink with
    // distance, the lantern low on the left, the granite boulder and its shadow
    const lampX = wide ? cx - r * 2.3 : W * 0.1
    const gr = rng(2840)
    const plane = `M${P([-W * 0.3, horizon])}C${P([W * 0.3, horizon - r * 0.04])} ${P([W * 0.7, horizon - r * 0.04])} ${P([W * 1.3, horizon])}L${P([W * 1.3, H * 1.3])}L${P([-W * 0.3, H * 1.3])}Z`
    const depthY = (z: number) => horizon + (H * 1.05 - horizon) * z ** 1.7 // z: 0 far … 1 at the frame's foot
    let tufts = '', pebbles = '', pebHi = ''
    for (let i = 0; i < (wide ? 34 : 22); i++) {
      const z = 0.06 + gr() * 0.94
      const y = depthY(z), sc = 0.25 + z * 1.1
      const x = gr() * W * 1.1 - W * 0.05
      if (Math.abs(x - cx) < r * 1.35 && y > horizon && y < groundY + r * 0.3) continue // not under the basin
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
      wash(blob(cx + r * 0.45, groundY + r * 0.08, r * 1.35, r * 0.2, 2810, 0.15), 0.42, 'p2p-wash t28s-shadow'),
      s('g', { transform: `translate(${f1(cx)} ${f1(groundY + hp * 0.12)})` }, granite(r * 2.4, hp + r * cosV * 0.86, 2822)),
      grass(cx - r * 1.0, groundY + 4, Math.max(12, r * 0.18), 2812),
      grass(cx + r * 0.95, groundY + 6, Math.max(10, r * 0.14), 2813),
      s('g', { transform: `translate(${f1(lampX)} ${f1(groundY + H * 0.02)})` }, toro(0, 0, Math.max(60, r * 0.75), true)))
    // ── the basin: a stone triangle with rounded corners and three spouts, its water pooling toward the low corner
    const B = r * 2.2
    const tri = (k: number) => corner.map(([x, y]) => [x * k + B / 2, y * k + B / 2] as Pt)
    const round = (pts: Pt[], rr: number) => {
      let d = ''
      pts.forEach((pt, i) => {
        const a = pts[(i + pts.length - 1) % pts.length], b = pts[(i + 1) % pts.length]
        const u = (q: Pt, t: number): Pt => [pt[0] + (q[0] - pt[0]) * t, pt[1] + (q[1] - pt[1]) * t]
        d += `${i ? 'L' : 'M'}${P(u(a, rr))}Q${P(pt)} ${P(u(b, rr))}`
      })
      return d + 'Z'
    }
    const outer = round(tri(1.02), 0.16), inner = round(tri(0.8), 0.18)
    // the water stands a little below the rim: the far inner wall shows as a dark band (the rim's thickness)
    const sunk = round(tri(0.8).map(([x, y]) => [x + (B / 2 - x) * 0.05, y + (B / 2 - y) * 0.05 + r * 0.05] as Pt), 0.2)
    let spouts = ''
    corner.forEach(([x, y]) => {
      const L = Math.hypot(x, y)
      const ux = x / L, uy = y / L
      const nx = -uy, ny = ux
      const at = (t: number, o: number): Pt => [B / 2 + ux * r * t + nx * o, B / 2 + uy * r * t + ny * o]
      spouts += `M${P(at(0.78, -r * 0.05))}L${P(at(1.14, -r * 0.035))}L${P(at(1.14, r * 0.035))}L${P(at(0.78, r * 0.05))}Z`
    })
    // dark water: the moon's reflection, broken into a few silver strokes, slides with the tilt
    const mx = B / 2 + r * 0.12, my = B / 2 - r * 0.24
    let road = ''
    for (let k = 0; k < 5; k++) road += stroke([[mx - r * (0.1 - k * 0.012), my + r * (0.1 + k * 0.07)], [mx + r * (0.08 - k * 0.01), my + r * (0.1 + k * 0.07)]], Math.max(1, r * 0.018), 0.3, 0.3, 0.2)
    const pool = s('g', { class: 't28s-pool' },
      s('ellipse', { class: 't28s-deep', cx: f1(B / 2), cy: f1(B / 2), rx: f1(r * 0.55), ry: f1(r * 0.5) }),
      s('ellipse', { class: 't28s-moonglow', cx: f1(mx), cy: f1(my), rx: f1(r * 0.26), ry: f1(r * 0.24), fill: 'url(#p2-halo)' }),
      s('ellipse', { class: 't28s-moonref', cx: f1(mx), cy: f1(my), rx: f1(r * 0.1), ry: f1(r * 0.1) }),
      s('path', { class: 't28s-moonroad', d: road }))
    let chisel = ''
    for (let k = 0; k < 9; k++) {
      const a = seedR() * Math.PI * 2, d0 = r * (0.86 + seedR() * 0.1)
      const x = B / 2 + Math.cos(a) * d0 * 0.55, y = B / 2 + Math.sin(a) * d0 * 0.55
      chisel += stroke([[x, y], [x + r * 0.08, y + (seedR() - 0.5) * r * 0.04]], 1.4, 0.3, 0.4, 0.2)
    }
    top.setAttribute('viewBox', `0 0 ${f1(B)} ${f1(B)}`)
    sides.forEach((v) => {
      v.setAttribute('viewBox', `0 0 ${f1(B)} ${f1(B)}`)
      v.replaceChildren(s('path', { class: 't28s-stone-side', d: outer + spouts }))
    })
    top.replaceChildren(
      s('defs', null, s('clipPath', { id: `${id}-in` }, s('path', { d: sunk }))),
      s('path', { class: 't28s-stone', d: outer, filter: 'url(#ink-rough)' }),
      s('path', { class: 't28s-stone', d: spouts, filter: 'url(#ink-rough)' }),
      s('path', { class: 't28s-chisel', d: chisel }),
      s('path', { class: 't28s-rimlight', d: stroke(tri(1.0).slice(0, 2), Math.max(1.5, r * 0.012), 0.2, 0.2, 0.3) }),
      s('path', { class: 't28s-basin-wall', d: inner }),
      s('path', { class: 't28s-basin-water', d: sunk }),
      s('g', { 'clip-path': `url(#${id}-in)` }, pool),
      s('ellipse', { class: 't28s-fist', cx: f1(B / 2), cy: f1(B / 2), rx: f1(r * 0.13), ry: f1(r * 0.11) }))
    // ── the jars on the ground just past each corner (Size behind the basin, smaller with distance)
    const jw = r * 0.56, jh = jw * 1.08
    geo.jar = []
    jars.forEach((j, k) => {
      const back = k === 1
      const sc = back ? 0.82 : 1
      const qx = cx + corner[k][0] * 1.4
      const foot: Pt = back ? [qx + r * (wide ? 0.5 : 0.56), cy - r * 0.05] : wide ? [qx + (k ? 1 : -1) * r * 0.1, groundY + r * 0.1] : [cx + (k ? 1 : -1) * r * 0.95, groundY + r * 0.55]
      j.art = jarArt(jw * sc, jh * sc, 2814 + k, `${id}-j${k}`)
      const bw = jw * sc * 1.5, bh = jh * sc * 1.25
      Object.assign(j.el.style, { left: `${f1(foot[0] - bw / 2)}px`, top: `${f1(foot[1] - jh * sc * 1.12)}px`, width: `${f1(bw)}px`, height: `${f1(bh)}px` })
      j.el.style.setProperty('--fs', `${f1(Math.max(11, Math.min(14, jw * sc * 0.12)))}px`)
      j.el.replaceChildren(j.art.svg, j.name, j.val)
      shownC[k] = -1
      geo.jar[k] = [foot[0], foot[1] - jh * sc * 0.98]
    })
    // ── the sapling (drawn once, scaled and leaned by transform), the bamboo pipe dripping into the centre
    tree.replaceChildren(s('svg', { viewBox: `${f1(-th * 0.6)} ${f1(-th * 1.1)} ${f1(th * 1.2)} ${f1(th * 1.15)}`, style: `width:${f1(th * 1.2)}px;height:${f1(th * 1.15)}px;left:${f1(-th * 0.6)}px;top:${f1(-th * 1.1)}px` },
      s('ellipse', { class: 't28s-halo', cx: 0, cy: f1(-th * 0.6), rx: f1(th * 0.55), ry: f1(th * 0.5), fill: 'url(#p2-halo)' }),
      ...sapling(th, 2803)))
    const pw = Math.max(14, Math.min(26, r * 0.09))
    const mouth: Pt = [cx - r * 0.18, cy - r * cosV * 0.2 - th * 0.55]
    geo.mouth = [mouth[0] - pw * 0.15, mouth[1] + pw * 0.6]
    // the kakehi: a bamboo spout resting in the fork of a single post behind the Data jar, a thread of silver drops from
    // its mouth down to the basin's heart
    const start: Pt = [cx - r * (wide ? 1.75 : 1.25), mouth[1] - r * 0.3]
    const t0 = 0.24
    const post: Pt = [start[0] + (mouth[0] - start[0]) * t0, start[1] + (mouth[1] - start[1]) * t0 + pw * 0.75]
    const foot: Pt = [post[0] - pw * 0.2, groundY - r * cosV * 0.95]
    const land: Pt = [geo.mouth[0] + pw * 0.1, cy - r * cosV * 0.06]
    let thread = ''
    for (let i = 0; i < 9; i++) {
      const t = ((i + 0.6) / 9) ** 1.6 // they speed up as they fall
      const x = geo.mouth[0] + (land[0] - geo.mouth[0]) * t, y = geo.mouth[1] + (land[1] - geo.mouth[1]) * t
      const k = 0.7 + t * 0.6
      thread += `M${P([x, y - pw * 0.17 * k])}Q${P([x + pw * 0.1 * k, y + pw * 0.04])} ${P([x, y + pw * 0.1 * k])}Q${P([x - pw * 0.1 * k, y + pw * 0.04])} ${P([x, y - pw * 0.17 * k])}Z`
    }
    const cord = stroke([[post[0] - pw * 0.6, post[1] - pw * 0.55], [post[0] + pw * 0.55, post[1] - pw * 0.25]], Math.max(1, pw * 0.1), 0.2, 0.2, 0.4)
      + stroke([[post[0] - pw * 0.55, post[1] - pw * 0.2], [post[0] + pw * 0.6, post[1] - pw * 0.6]], Math.max(1, pw * 0.1), 0.2, 0.2, 0.4)
    pipe.replaceChildren(
      bamboo(foot, post, pw * 0.85, 2823, true, '', pw * 0.15),
      bamboo([start[0] - pw * 1.2, start[1] - pw * 0.25], mouth, pw, 2815, true, '', -pw * 0.9),
      s('path', { class: 't28s-cord', d: cord }),
      s('path', { class: 't28s-hang', d: blob(geo.mouth[0], geo.mouth[1], pw * 0.16, pw * 0.22, 2816, 0.05, 8) }),
      s('path', { class: 't28s-thread', d: thread }),
      s('ellipse', { class: 't28s-ripple', cx: f1(land[0]), cy: f1(land[1]), rx: f1(pw * 0.9), ry: f1(pw * 0.3) }))
    const ang = (Math.atan2(mouth[1] - start[1], mouth[0] - start[0]) * 180) / Math.PI
    const mid: Pt = [start[0] + (mouth[0] - start[0]) * 0.55, start[1] + (mouth[1] - start[1]) * 0.55]
    Object.assign(left.style, { left: `${f1(mid[0])}px`, top: `${f1(mid[1])}px`, transform: `translate(-50%, -50%) rotate(${f1(ang)}deg)`, fontSize: `${f1(clamp(pw * 0.62, 14, 16))}px` })
    Object.assign(status.style, { left: `${f1(cx)}px`, top: `${f1(groundY - hp * 0.42)}px` })
    // ── the near bank: a dark mossy edge cut by the frame
    let blades = ''
    const fr = rng(2817)
    for (let i = 0; i < 26; i++) {
      const x = i < 13 ? fr() * W * 0.2 : W - fr() * W * 0.18, y = H - fr() * H * 0.02, bl = wide ? 1 : 0.6
      blades += stroke(curve([x, H + 2], [x + (fr() - 0.5) * 10, y - H * 0.03 * bl], [x + (fr() - 0.5) * 18, y - H * (0.03 + fr() * 0.035) * bl], 5), 1.4 + fr() * 1.6, 0.05, 0.8, 0.1)
    }
    front.replaceChildren(s('path', { class: 't28s-blades', d: blades }))
    onTilt()
  }
  ctx.onCleanup(onSize(ctx.art, layout))
}
