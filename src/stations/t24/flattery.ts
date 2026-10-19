import { h, s } from '../../core/dom'
import type { SceneCtx } from '../types'
import { C } from './data'
import { alive, f1, put, rig, stage } from './kit'
import { blob, clamp, curve, rng, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist, moon, water, wash } from '../../ui/part2/paint'
import { grad, needlePad, spline, taper } from './brush'

const K = C.scenes.flattery

// The bonsai in tree units: origin = the soil at the trunk, x right, y up, apex ≈ 1.
const TRUNK: Pt[] = [[0, 0], [-0.07, 0.1], [-0.06, 0.22], [0.04, 0.33], [0.075, 0.45], [0.01, 0.57], [-0.06, 0.68], [-0.035, 0.8], [0.015, 0.9]]
type Pad = [number, number, number, number] // x, y, w, h (tree units)
type Limb = { pts: Pt[]; w: [number, number]; pads: Pad[]; back?: boolean }
const LIMBS: Limb[] = [
  { pts: [[0.03, 0.52], [0.13, 0.58], [0.25, 0.6]], w: [0.04, 0.012], pads: [[0.25, 0.63, 0.26, 0.085]], back: true },
  { pts: [[0.0, 0.8], [0.11, 0.84], [0.19, 0.85]], w: [0.026, 0.009], pads: [[0.19, 0.875, 0.2, 0.068]], back: true },
  { pts: [[-0.05, 0.29], [-0.18, 0.35], [-0.33, 0.33], [-0.47, 0.36]], w: [0.055, 0.012], pads: [[-0.45, 0.4, 0.4, 0.11], [-0.22, 0.395, 0.2, 0.07]] },
  { pts: [[-0.055, 0.66], [-0.15, 0.71], [-0.26, 0.72]], w: [0.036, 0.01], pads: [[-0.26, 0.755, 0.3, 0.09]] },
  { pts: [[0.015, 0.9], [0.01, 0.94]], w: [0.03, 0.02], pads: [[-0.08, 0.885, 0.22, 0.07], [0.03, 0.965, 0.34, 0.11]] },
]
// the flattering branch, hinged at the trunk: it reaches out of the picture toward the viewer, so it thickens and its pads
// grow toward the tip (painted foreshortening); the last pad runs off the frame. Points: tree units, the tip past the edge.
const JOINT: Pt = [0.07, 0.42]
const FLAT: Pt[] = [JOINT, [0.3, 0.5], [0.66, 0.47], [1.06, 0.53], [1.55, 0.585], [2.3, 0.6]]
// pads on short twigs above the limb: x, y, w, h, needle growth (tree units)
const FPADS: [number, number, number, number, number][] = [[0.42, 0.55, 0.26, 0.12, 1], [0.9, 0.58, 0.44, 0.17, 1.08], [1.42, 0.665, 0.66, 0.24, 1.16], [2.12, 0.72, 0.98, 0.32, 1.25]]

/** Pruning shears lying on the ledge (viewBox 0 0 120 56): lacquered vermilion loops, steel blades with a moonlit edge. */
function shearsArt() {
  return s('svg', { viewBox: '0 0 120 56', 'aria-hidden': 'true' },
    s('ellipse', { class: 't24t-sh-shadow', cx: 64, cy: 46, rx: 52, ry: 6 }),
    s('path', { class: 't24t-sh-blade', d: 'M58 27 L6 15 Q2 16 4 19 L54 33 Z' }),
    s('path', { class: 't24t-sh-blade b2', d: 'M58 29 L8 34 Q4 33 6 30 L55 24 Z' }),
    s('path', { class: 't24t-sh-edge', d: 'M54 25.5 L9 16.5' }),
    s('circle', { class: 't24t-sh-pin', cx: 57, cy: 28, r: 3.2 }),
    s('path', { class: 't24t-sh-grip', d: stroke(curve([60, 27], [80, 14], [100, 14], 10), 7, 0.05, 0.1, 0.6) + stroke(curve([60, 30], [82, 40], [104, 38], 10), 7, 0.05, 0.1, 0.6), filter: 'url(#ink-rough)' }),
    s('path', { class: 't24t-sh-loop', d: blob(104, 14, 11, 8, 3, 0.08) + blob(108, 38, 11, 8, 4, 0.08) }),
    s('path', { class: 't24t-sh-hole', d: blob(104, 14, 6, 3.6, 5, 0.1) + blob(108, 38, 6, 3.6, 6, 0.1) }),
    s('path', { class: 't24t-sh-gloss', d: stroke(curve([66, 23], [80, 15], [96, 13], 6), 1.6, 0.3, 0.3, 0.1) }))
}

/** A tag on a cord: the cord, then the plate with a short line; touch or focus turns it to read the whole sentence. */
function tag(cls: string, short: string, full: string, aria: string, label: string) {
  return h('button', { class: `t24t-tag ${cls}`, type: 'button', 'aria-label': aria, 'aria-expanded': 'false' },
    h('span', { class: 't24t-cord', 'aria-hidden': 'true' }),
    h('span', { class: 't24t-plate', 'aria-hidden': 'true' }, h('span', { class: 't24t-k' }, label), h('span', { class: 't24t-short' }, short), h('span', { class: 't24t-full' }, full)))
}

/**
 * Scene 2 ★ — looking up from below a stone ledge at an old pine bonsai towering against the moon. One honey-glossed branch
 * reaches out of the picture toward whoever looks at it, a gold-leaf tag of praise on it; every time it catches your eye a
 * few golden fireflies (likes) settle on it. The honest branch's plain wooden tag hangs half turned away. Prune the
 * flattering branch: it falls into the dark, the tree straightens, the honest tag turns round.
 */
export function flatteryScene(ctx: SceneCtx) {
  let cut = false
  let catches = 0
  const still = ctx.reduced || ctx.quality === 'low'
  const S = 3.2 // world swing (deg) at the edge of the view

  const host = h('div', { class: 't24t-host' })
  const { root } = stage(ctx, 't24t', K.art, [K.insight], draw)
  root.append(host)
  const R = rig(ctx, host, { strength: S, onView })
  const svg = (cls: string) => s('svg', { class: `t24-svg ${cls}`, 'aria-hidden': 'true' })
  // far → near
  const skySvg = svg('t24t-skyart')
  const farSvg = svg('t24t-farart')
  const mistSvg = svg('t24t-mistart')
  const standSvg = svg('t24t-stand')
  const treeSvg = svg('t24t-treeart')
  const branchSvg = svg('t24t-branchart')
  const glossSvg = svg('t24t-glossart')
  const ledgeSvg = svg('t24t-ledgeart')
  const edgeSvg = svg('t24t-edgeart')
  R.layer(2.4, 't24t-l-sky').append(skySvg)
  R.layer(1.05, 't24t-l-far').append(farSvg)
  R.layer(0.5, 't24t-l-mist').append(h('div', { class: 't24t-drift' }, mistSvg))
  const treeLayer = R.layer(0, 't24t-l-tree')
  const nearLayer = R.layer(-0.12, 't24t-l-near')
  R.layer(-0.32, 't24t-l-edge').append(edgeSvg)

  // the flattering branch is its own 3D plane hinged at the trunk; its gloss slides as you move; likes perch on it
  const flies = h('div', { class: 't24t-flies' })
  const goldTag = tag('gold', K.flatterShort, K.flatter, `${K.flatterLabel}: ${K.flatter}`, K.flatterLabel)
  const flatLabel = h('span', { class: 't24t-label flat', 'aria-hidden': 'true' }, K.flatterLabel)
  const branch = h('div', { class: 't24t-branch' }, branchSvg, glossSvg, flies, flatLabel, goldTag)
  const realTag = tag('real turned', K.honestShort, K.honest, `${K.honestLabel}: ${K.honest}`, K.honestLabel)
  const realLabel = h('span', { class: 't24t-label honest', 'aria-hidden': 'true' }, K.honestLabel)
  const treeBox = h('div', { class: 't24t-treebox' }, treeSvg, branch, realTag, realLabel)
  treeLayer.append(standSvg, treeBox)
  // the viewer's words on a paper slip pinned under a pebble at the ledge's lip, hanging down its face; the shears
  const pebble = s('svg', { class: 't24t-pebble', 'aria-hidden': 'true', viewBox: '-40 -30 80 34' }, stoneArt(70, 26, 2431))
  const slip = h('div', { class: 't24t-slip t24-paper' }, h('span', { class: 't24t-fold', 'aria-hidden': 'true' }), h('p', null, K.userSays), pebble)
  const shears = h('button', { class: 't24t-shears', type: 'button', 'aria-label': K.pruneAria }, shearsArt())
  nearLayer.append(ledgeSvg, slip, shears)
  for (const t of [goldTag, realTag]) t.addEventListener('click', () => t.setAttribute('aria-expanded', String(t.getAttribute('aria-expanded') !== 'true')))
  ctx.prompt(K.prompt)
  // what the fireflies stand for, once, beside the visitor's own words; after the cut, what really happened
  const decode = h('p', { class: 't24t-decode' }, K.decode)
  const real = h('div', { class: 't24t-real', 'data-off': '' }, ctx.fact(K.detail, 'p'))
  root.append(decode, real)
  const poke = alive(ctx, root)

  // geometry shared by draw / onView / prune
  const G = { W: 0, H: 0, u: 0, tx: 0, soil: 0, ly: 0, hz: 0, jx: 0, jy: 0, xe: 0, xs: 1, bs: 1, wide: true }
  const X = (x: number) => G.tx + x * G.u * G.xs // a narrow screen gets a more upright tree
  const BX = (x: number) => G.jx + (x - JOINT[0]) * G.u * G.bs // along the flattering branch
  const Y = (y: number) => G.soil - y * G.u

  function* draw(W: number, H: number) {
    const wide = W / H >= 1.05
    const hz = H * (wide ? 0.78 : 0.74) // eye level: the far shore, low in the frame (we stand low and look up)
    const ly = H * (wide ? 0.67 : 0.66) // the ledge's lip, above eye level: we see under it, not onto it
    const u = wide ? Math.min(H * 0.6, W * 0.3) : Math.min(H * 0.56, W * 0.86)
    const tx = W * (wide ? 0.33 : 0.37)
    const standH = u * 0.11, potH = u * 0.09
    const soil = ly - standH - potH * 0.55 // the trunk rises from behind the pot's rim
    Object.assign(G, { W, H, u, tx, soil, ly, hz, wide, xs: wide ? 1 : 0.78, xe: wide ? W * 0.62 : W * 0.78 })
    G.jx = X(JOINT[0])
    G.jy = Y(JOINT[1])
    G.bs = wide ? 1 : (W - 26 - G.jx) / ((FPADS[2][0] - JOINT[0]) * u) // the third pad just inside the right edge
    for (const el of [skySvg, farSvg, mistSvg, standSvg, treeSvg, branchSvg, glossSvg, ledgeSvg, edgeSvg]) el.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    R.layout(W, H, hz)

    // 1 · sky: the moon high behind the crown (upper left), its halo; a far range whose peaks stand above the ledge
    const mx = X(-0.3), my = Math.max(H * 0.1, Y(1.02)), mr = u * (wide ? 0.075 : 0.085)
    skySvg.replaceChildren(
      s('circle', { class: 't24t-skyglow', cx: f1(mx), cy: f1(my), r: f1(Math.max(W, H) * 0.6), fill: 'url(#p2-halo)' }),
      moon(mx, my, mr, 2424, true),
      hills(-W * 0.2, W * 1.2, hz, H * (wide ? 0.34 : 0.3), 2425, 0.92, wide ? 5 : 3),
      mist(W * 0.5, hz - H * 0.08, W * 0.9, H * 0.16))
    yield
    // the night lake under the far shore (right of the ledge), the nearer range, the moon's glints, mist on the water
    farSvg.replaceChildren(
      hills(W * 0.45, W * 1.25, hz + 1, H * (wide ? 0.16 : 0.12), 2426, 0.55, 3),
      hills(W * 0.78, W * 1.2, hz + 1, H * 0.08, 2427, 0.3, 2),
      mist(W * 0.72, hz - H * 0.015, W * 0.5, H * 0.04),
      s('rect', { class: 't24t-lake', x: f1(-W * 0.2), y: f1(hz), width: f1(W * 1.4), height: f1(H - hz + H * 0.3), fill: 'url(#p2-water-v)' }),
      water(-W * 0.2, hz, W * 1.2, H * 1.1, 2428, W * 0.86, false),
      mist(W * 0.7, hz + 3, W * 0.6, H * 0.03))
    yield
    // 2 · the drifting band of mist between the ranges and the tree
    mistSvg.replaceChildren(
      mist(W * 0.2, hz - H * 0.2, W * 0.42, H * 0.05),
      mist(W * 0.78, hz - H * 0.26, W * 0.5, H * 0.045),
      mist(W * 0.55, hz - H * 0.06, W * 0.6, H * 0.04))
    yield
    // 3 · the stand on the ledge seen from below, the pot, then the tree
    drawStand(standH, potH)
    yield
    drawTree()
    yield
    drawBranch()
    yield
    // 5 · the ledge's lip and face (with the stand's moon shadow), foreground pine and bamboo out of focus
    drawLedge(W, H)
    yield
    drawEdge(W, H)
    // DOM pieces in the scene: the honest tag under the low left pad, its label beside it
    const [ax, ay] = wide ? [X(-0.4), Y(0.4) + u * 0.07] : [X(-0.24), Y(0.755) + u * 0.06]
    put(realTag, ax, ay)
    realTag.style.setProperty('--cl', `${f1(u * 0.05)}px`)
    put(realLabel, ax - 10, ay - 6)
    realTag.style.setProperty('--ox', `${f1(clamp(ax, 104, W - 104) - ax)}px`) // opened, the plate is wider: keep it in the frame
    // the slip hangs over the lip, left of the stand's legs; the shears lie on the lip to the right of the stand
    const sw = wide ? clamp(W * 0.22, 250, 320) : Math.min(W - 40, 230)
    put(slip, wide ? W * 0.05 : 14, ly - 4, sw)
    const shW = wide ? clamp(u * 0.32, 100, 130) : 90
    shears.style.width = `${f1(shW)}px`
    put(shears, wide ? tx + u * 0.42 : Math.min(G.xe - shW * 0.4, W - shW - 8), ly - shW * 0.34)
    onView(R.view.x, R.view.y)
  }

  /** The stand and pot from below: lacquered legs, the slab's underside, the pot's front and foot; backlit, rimmed left. */
  function drawStand(standH: number, potH: number) {
    const { u, tx, ly } = G
    const sw = u * 0.66, slab = standH * 0.24
    const top = ly - standH // the slab's front edge
    const pw = u * 0.56, ptop = top - potH
    const leg = (x: number, back: boolean) => `M${f1(x - u * 0.022)} ${f1(top + slab)}C${f1(x - u * 0.02)} ${f1(top + standH * 0.7)} ${f1(x - u * 0.045)} ${f1(top + standH * 0.92)} ${f1(x - u * (back ? 0.03 : 0.06))} ${f1(ly)}L${f1(x + u * 0.02)} ${f1(ly)}C${f1(x + u * 0.01)} ${f1(top + standH * 0.8)} ${f1(x + u * 0.022)} ${f1(top + standH * 0.5)} ${f1(x + u * 0.022)} ${f1(top + slab)}Z`
    // from below we see under the slab: a dark band receding behind its front edge
    const under = `M${f1(tx - sw / 2)} ${f1(top + slab)}L${f1(tx + sw / 2)} ${f1(top + slab)}L${f1(tx + sw * 0.44)} ${f1(top + slab + standH * 0.16)}L${f1(tx - sw * 0.44)} ${f1(top + slab + standH * 0.16)}Z`
    // and under the pot: its foot ring curving down toward us
    const pot = `M${f1(tx - pw / 2)} ${f1(ptop)}L${f1(tx + pw / 2)} ${f1(ptop)}L${f1(tx + pw * 0.45)} ${f1(ptop + potH * 0.82)}Q${f1(tx)} ${f1(ptop + potH * 1.02)} ${f1(tx - pw * 0.45)} ${f1(ptop + potH * 0.82)}Z`
    standSvg.replaceChildren(
      s('defs', null,
        grad('t24t-lac', 'linear', { x1: 0, y1: 0, x2: 1, y2: 0 }, [[0, 't24t-lac0'], [0.35, 't24t-lac1'], [1, 't24t-lac2']]),
        grad('t24t-clay', 'linear', { x1: 0, y1: 0, x2: 1, y2: 0.4 }, [[0, 't24t-clay0'], [0.45, 't24t-clay1'], [1, 't24t-clay2']])),
      s('path', { class: 't24t-legs back', d: leg(tx - sw * 0.3, true) + leg(tx + sw * 0.3, true) }),
      s('path', { class: 't24t-under', d: under }),
      s('path', { class: 't24t-legs', d: leg(tx - sw * 0.44, false) + leg(tx + sw * 0.44, false), fill: 'url(#t24t-lac)' }),
      s('path', { class: 't24t-apron', d: `M${f1(tx - sw * 0.44)} ${f1(top + slab)}Q${f1(tx)} ${f1(top + slab + standH * 0.3)} ${f1(tx + sw * 0.44)} ${f1(top + slab)}Z`, fill: 'url(#t24t-lac)' }),
      s('rect', { class: 't24t-slab', x: f1(tx - sw / 2), y: f1(top), width: f1(sw), height: f1(slab), rx: f1(slab * 0.4), fill: 'url(#t24t-lac)' }),
      s('path', { class: 't24t-lac-hi', d: stroke([[tx - sw * 0.48, top + slab * 0.2], [tx - sw * 0.1, top + slab * 0.15]], Math.max(1.4, slab * 0.22), 0.3, 0.5, 0.1) }),
      s('path', { class: 't24t-pot-feet', d: `M${f1(tx - pw * 0.38)} ${f1(ptop + potH * 0.8)}h${f1(pw * 0.1)}v${f1(potH * 0.2)}h${f1(-pw * 0.1)}ZM${f1(tx + pw * 0.28)} ${f1(ptop + potH * 0.8)}h${f1(pw * 0.1)}v${f1(potH * 0.2)}h${f1(-pw * 0.1)}Z` }),
      s('path', { class: 't24t-pot', d: pot, fill: 'url(#t24t-clay)', filter: 'url(#ink-rough)' }),
      s('rect', { class: 't24t-lip', x: f1(tx - pw * 0.52), y: f1(ptop - potH * 0.04), width: f1(pw * 1.04), height: f1(potH * 0.22), rx: 2, fill: 'url(#t24t-clay)' }),
      s('path', { class: 't24t-pot-hi', d: stroke([[tx - pw * 0.5, ptop - potH * 0.02], [tx + pw * 0.05, ptop - potH * 0.03]], 1.6, 0.2, 0.6, 0.1) }),
      s('path', { class: 't24t-pot-band', d: stroke([[tx - pw * 0.46, ptop + potH * 0.5], [tx + pw * 0.46, ptop + potH * 0.5]], 1.4, 0.1, 0.1, 0.4) }))
  }

  /** One pad of needles as seen from below, against the moon (honey: the flattering branch's lacquer). */
  function padArt([x, y, w, hh]: Pad, seed: number, honey: boolean, grow = 1): SVGElement[] {
    const { u } = G
    const cx = honey ? BX(x) : X(x), cy = Y(y), pw = w * u * (honey ? Math.max(0.7, G.bs) : G.xs), ph = hh * u * (honey ? 1 : 1.75)
    const p = needlePad(cx, cy, pw, ph, seed, grow * (honey ? 0.78 : 1.15), honey ? 0.62 : 1)
    const c = honey ? 't24t-h' : 't24t-'
    return [
      s('path', { class: `${c}belly`, d: p.belly, filter: 'url(#ink-wash)' }),
      s('path', { class: `${c}nd`, d: p.dark }),
      s('path', { class: `${c}nm`, d: p.mid }),
      s('path', { class: `${c}nr`, d: p.rim }),
    ]
  }

  function drawTree() {
    const { u } = G
    const pt = (p: Pt): Pt => [X(p[0]), Y(p[1])]
    const back: SVGElement[] = [], front: SVGElement[] = []
    // a limb: wood (lit edge toward the moon, upper left), then its pads
    const limb = (l: Limb, k: number, out: SVGElement[]) => {
      const c = spline(l.pts.map(pt), 6)
      const t = taper(c, u * l.w[0], u * l.w[1], 0, 2450 + k)
      out.push(s('path', { class: 't24t-wood', d: t.d, filter: 'url(#ink-rough)' }),
        s('path', { class: 't24t-wood-rim', d: stroke(t.L, Math.max(1, u * 0.006), 0.2, 0.2, 0.2) }))
      l.pads.forEach((p, j) => out.push(...padArt(p, 2460 + k * 7 + j, false)))
    }
    LIMBS.forEach((l, k) => l.back && limb(l, k, back))
    // the trunk: flared foot, bark plates in dry brush, the moonlit edge on the left
    const c = spline(TRUNK.map(pt), 8)
    const t = taper(c, u * 0.13, u * 0.03, u * 0.1, 2451)
    const r = rng(2452)
    let bark = ''
    for (let i = 2; i < c.length - 4; i += 2) {
      const [x, y] = c[i]
      const w = u * (0.13 - (0.1 * i) / c.length) * 0.4
      bark += stroke(curve([x - w * (0.4 + r() * 0.5), y + u * 0.01], [x, y - u * 0.012], [x + w * (0.2 + r() * 0.6), y - u * 0.02]), Math.max(1, u * 0.007), 0.2, 0.4, 0.2)
    }
    const litC = c.map(([x, y], i) => [x - u * (0.13 - (0.1 * i) / c.length) * 0.2, y] as Pt)
    const lt = taper(litC, u * 0.06, u * 0.012, u * 0.04, 2453)
    let ridges = ''
    for (let k = 0; k < 7; k++) {
      const off = -0.32 + k * 0.1
      const a0 = Math.floor(r() * 10), a1 = Math.min(c.length - 2, a0 + 10 + Math.floor(r() * 26))
      const seg = c.slice(a0, a1).map(([x, y], i) => [x + off * u * (0.13 - (0.1 * (a0 + i)) / c.length), y] as Pt)
      if (seg.length > 2) ridges += stroke(seg, Math.max(0.8, u * 0.005), 0.2, 0.2, 0.2)
    }
    const trunk = [
      s('path', { class: 't24t-wood', d: t.d, filter: 'url(#ink-rough)' }),
      s('path', { class: 't24t-wood-lit', d: lt.d, filter: 'url(#ink-wash)' }),
      s('path', { class: 't24t-bark', d: bark + ridges, filter: 'url(#ink-dry)' }),
      s('path', { class: 't24t-wood-rim', d: stroke(t.L.slice(4), Math.max(1.2, u * 0.008), 0.1, 0.2, 0.2) }),
      // the jin: a short bleached deadwood spike near the apex
      s('path', { class: 't24t-jin', d: stroke(curve(pt([0.0, 0.86]), pt([-0.04, 0.93]), pt([-0.02, 1.0]), 6), u * 0.012, 0.05, 0.9, 0.1) }),
    ]
    LIMBS.forEach((l, k) => !l.back && limb(l, k, front))
    treeSvg.replaceChildren(
      s('defs', null, grad('t24t-back', 'radial', {}, [[0, 't24t-bl0'], [0.5, 't24t-bl1'], [1, 't24t-bl2']])),
      // the moon behind the crown: a cool backlight the whole tree stands in
      s('ellipse', { class: 't24t-backlight', cx: f1(X(-0.15)), cy: f1(Y(0.85)), rx: f1(u * 0.95), ry: f1(u * 0.8), fill: 'url(#t24t-back)' }),
      ...back, ...trunk, ...front)
    treeBox.style.transformOrigin = `${f1(G.tx)}px ${f1(G.soil)}px`
  }

  /** The honey branch: thickening as it comes toward us, honey needles, drips; the gloss in its own layer; the gold tag. */
  function drawBranch() {
    const { u, W } = G
    const pt = (p: Pt): Pt => [BX(p[0]), Y(p[1])]
    const c = spline(FLAT.map(pt), 10)
    const t = taper(c, u * 0.038, u * 0.085, 0, 2470) // reversed taper: the far end (at the trunk) is the thin one
    // short twigs from the limb up into each pad
    let twigs = ''
    FPADS.forEach(([x, y, w], j) => {
      const k = Math.round((0.25 + j * 0.2) * (c.length - 1))
      for (const dx of [-0.25, 0.2]) {
        const b = c[Math.min(c.length - 1, Math.max(0, k + Math.round(dx * 8)))]
        twigs += taper(curve(b, [(b[0] + BX(x + dx * w)) / 2, b[1] - u * 0.02], [BX(x + dx * w * 0.8), Y(y - 0.02)], 6), u * (0.018 + j * 0.006), u * 0.006, 0, 2476 + j).d
      }
    })
    const pads = FPADS.flatMap(([x, y, w, hh, g], j) => padArt([x, y, w, hh], 2480 + j, true, g))
    const r = rng(2475)
    let gloss = '', drips = ''
    FPADS.forEach(([x, y, w, hh]) => {
      const cx = BX(x), cy = Y(y), pw = w * u * Math.max(0.7, G.bs), ph = hh * u
      for (let k = 0; k < 4; k++) {
        const gx = cx - pw * 0.35 + k * pw * 0.2 + (r() - 0.5) * pw * 0.05, gy = cy - ph * (0.18 + Math.sin(Math.PI * (0.15 + k * 0.2)) * 0.2)
        gloss += stroke(curve([gx - ph * 0.2, gy + ph * 0.04], [gx, gy - ph * 0.04], [gx + ph * 0.26, gy - ph * 0.01], 6), Math.max(1.2, ph * 0.03), 0.35, 0.35, 0.1)
      }
      drips += blob(cx - pw * 0.1, cy + ph * 0.42, ph * 0.03, ph * 0.07, Math.round(x * 100), 0.05, 8) + blob(cx + pw * 0.22, cy + ph * 0.36, ph * 0.025, ph * 0.055, Math.round(x * 100) + 1, 0.05, 8)
    })
    branchSvg.replaceChildren(
      s('path', { class: 't24t-wood flat', d: t.d + twigs, filter: 'url(#ink-rough)' }),
      s('path', { class: 't24t-hwood-lit', d: stroke(t.L, Math.max(1.4, u * 0.01), 0.1, 0.2, 0.2) }),
      ...pads,
      s('path', { class: 't24t-drip', d: drips }))
    glossSvg.replaceChildren(s('path', { class: 't24t-gloss', d: gloss }))
    branch.style.transformOrigin = `${f1(G.jx)}px ${f1(G.jy)}px`
    // the gold tag hangs from the branch under the second pad; the label sits under the branch near the joint
    const [gx, gy] = pt([G.wide ? 0.98 : 1.0, 0.51])
    put(goldTag, Math.min(gx, W - 50), gy)
    goldTag.style.setProperty('--ox', `${f1(clamp(Math.min(gx, W - 50), 104, W - 104) - Math.min(gx, W - 50))}px`)
    goldTag.style.setProperty('--cl', `${f1(u * 0.06)}px`)
    put(flatLabel, X(0.22), Y(0.375))
    // the likes already perched (all of them at low / reduced: there is no viewer to catch)
    flies.replaceChildren()
    if (still) for (let i = 0; i < 9; i++) perch(i, false)
    else for (let i = 0; i < catches * 3; i++) perch(i, false)
  }

  /**
   * The ledge seen from below: a broken lip against the sky with boulders sitting on it (rimmed by the moon behind), the
   * dark underside of its overhang, a rugged face of jutting planes, crevices and strata dropping out of the frame, moss
   * hanging over its shelves; the stand's moon shadow falls toward us down the face. It breaks off on the right in a
   * jutting outcrop; beyond it, the lake.
   */
  function drawLedge(W: number, H: number) {
    const r = rng(2434)
    const { xe, ly, u, tx } = G
    const lip: Pt[] = []
    for (let i = 0; i <= 52; i++) {
      const x = -W * 0.08 + ((xe + W * 0.08) * i) / 52
      lip.push([x, ly + (r() - 0.5) * H * 0.008 + Math.sin(i * 0.37 + 2) * H * 0.012 - Math.abs(Math.sin(i * 0.9 + 1)) * H * 0.008])
    }
    const nose: Pt = [xe + H * 0.07, ly + H * 0.015]
    const tipC = curve(lip[lip.length - 1], [xe + H * 0.045, ly - H * 0.016], nose, 6).slice(1)
    const underside = curve(nose, [xe + H * 0.02, ly + H * 0.08], [xe - H * 0.06, ly + H * 0.1], 10)
    const drop = curve([xe - H * 0.06, ly + H * 0.1], [xe - H * 0.01, ly + H * 0.26], [xe + H * 0.05, H * 1.3], 10)
    const outline: Pt[] = [...lip, ...tipC, ...underside.slice(1), ...drop.slice(1), [-W * 0.1, H * 1.3]]
    const face = `M${outline.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}Z`
    // the overhang's underside: a dark band right under the lip, deepest under the outcrop
    const under = `M${lip.map(([x, y]) => `${f1(x)} ${f1(y + 2)}`).join('L')}L${f1(xe - H * 0.06)} ${f1(ly + H * 0.1)}L${f1(-W * 0.08)} ${f1(ly + H * 0.055)}Z`
    // jutting planes of rock catching the lake's light, crevices between them, strata, moss
    let planes = '', cracks = '', strata = '', moss = '', needles = '', hang = ''
    const n = Math.max(7, Math.round((xe + W * 0.08) / (H * 0.08)))
    for (let i = 0; i < n; i++) {
      const x0 = -W * 0.06 + r() * (xe + W * 0.02), y0 = ly + H * (0.08 + Math.pow(r(), 0.8) * 0.3)
      const w = H * (0.08 + r() * 0.16), hh = H * (0.05 + r() * 0.1), sl = (r() - 0.3) * hh
      planes += `M${f1(x0)} ${f1(y0)}L${f1(x0 + w)} ${f1(y0 + sl * 0.4)}L${f1(x0 + w * 0.9 + sl)} ${f1(y0 + hh)}L${f1(x0 + sl * 0.6)} ${f1(y0 + hh * 0.8)}Z`
      cracks += stroke([[x0 - 2, y0], [x0 + w * 0.5, y0 + sl * 0.2 - 1], [x0 + w + 2, y0 + sl * 0.4]], 1.2 + r() * 1.2, 0.2, 0.3, 0.2)
      if (r() < 0.6) cracks += stroke(curve([x0 + w * 0.9 + sl, y0 + hh], [x0 + w * 0.95 + sl + (r() - 0.5) * 14, y0 + hh + H * 0.05], [x0 + w + sl + (r() - 0.5) * 20, y0 + hh + H * (0.08 + r() * 0.1)], 6), 1.6 + r() * 2, 0.15, 0.5, 0.2)
    }
    for (let k = 0; k < 5; k++) {
      const y = ly + H * (0.12 + k * 0.06) + (r() - 0.5) * 6, x0 = -W * 0.1 + r() * W * 0.1
      const x1 = xe - H * 0.05 + (y - ly) * 0.15
      strata += stroke([[x0, y], [x0 + (x1 - x0) * 0.3, y + (r() - 0.5) * 10], [x0 + (x1 - x0) * 0.65, y + (r() - 0.5) * 10], [x1, y + H * 0.012]], 0.9 + r() * 1.4, 0.2, 0.3, 0.15)
    }
    // moss: cushions along the lip, its strands hanging over the edge toward us
    for (let i = 0; i < 18; i++) {
      const x = -W * 0.05 + r() * (xe + W * 0.04)
      if (Math.abs(x - tx) < u * 0.32) continue // the stand's feet
      const w = 14 + r() * 36
      moss += blob(x, ly + 2, w, 4 + r() * 5, 2436 + i, 0.35, 14)
      for (let k = 0; k < 3; k++) hang += stroke([[x - w * 0.6 + r() * w * 1.2, ly + 3], [x - w * 0.5 + r() * w, ly + 8 + r() * 14]], 1.6 + r() * 1.4, 0.1, 0.5, 0.2)
    }
    // pine needles fallen at the lip, sticking out over it
    for (let i = 0; i < 30; i++) {
      const x = tx - u * 0.7 + r() * u * 1.6, y = ly - 1 + r() * 3
      const a = (r() - 0.5) * 1.2 + (r() < 0.5 ? 0 : Math.PI), l = 5 + r() * 9
      needles += stroke([[x, y], [x + Math.cos(a) * l, y + Math.sin(a) * l * 0.35]], 1, 0.1, 0.1, 0.3)
    }
    // boulders sitting on the lip, only their tops against the sky (we are below)
    const boulders = [[0.04, 0.2, 0.07], [0.17, 0.12, 0.05], [xe / W - 0.1, 0.16, 0.06], [xe / W - 0.03, 0.09, 0.04]].map(([x, w, hh], i) =>
      s('g', { transform: `translate(${f1(x * W)} ${f1(ly + 3)})` }, stoneArt(w * u * 1.6, hh * H, 2437 + i, 'p2-stone t24t-boulder')))
    // the stand's moon shadow: legs and pot thrown toward us down the face, leaning right (the moon is up to the left)
    const sh0 = tx - u * 0.3, sh1 = tx + u * 0.3
    const shadow = `M${f1(sh0)} ${f1(ly + 4)}L${f1(sh1)} ${f1(ly + 4)}Q${f1(sh1 + u * 0.12)} ${f1(ly + H * 0.12)} ${f1(sh1 + u * 0.16)} ${f1(ly + H * 0.26)}L${f1(sh0 + u * 0.22)} ${f1(ly + H * 0.3)}Q${f1(sh0 + u * 0.04)} ${f1(ly + H * 0.14)} ${f1(sh0)} ${f1(ly + 4)}Z`
    ledgeSvg.replaceChildren(
      s('defs', null,
        grad('t24t-face', 'linear', { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, 't24t-fc0'], [0.25, 't24t-fc1'], [1, 't24t-fc2']]),
        s('clipPath', { id: 't24t-faceclip' }, s('path', { d: face }))),
      ...boulders,
      s('path', { class: 't24t-face', d: face, fill: 'url(#t24t-face)', filter: 'url(#ink-wash)' }),
      s('g', { 'clip-path': 'url(#t24t-faceclip)' },
        s('path', { class: 't24t-plane', d: planes, filter: 'url(#ink-wash)' }),
        s('path', { class: 't24t-under', d: under, filter: 'url(#ink-wash)' }),
        s('path', { class: 't24t-crack', d: cracks + strata, filter: 'url(#ink-dry)' }),
        wash(shadow, 0.42, 'p2p-wash t24t-moonshadow')),
      s('path', { class: 't24t-ledgemoss', d: moss + hang, filter: 'url(#ink-rough)' }),
      s('path', { class: 't24t-ledgerim', d: stroke([...lip, ...tipC], 2.4, 0.05, 0.2, 0.3) }),
      s('path', { class: 't24t-underrim', d: stroke(underside, 1.6, 0.1, 0.3, 0.2) }),
      s('path', { class: 't24t-fallen', d: needles }))
  }

  /** Out of focus at the frame's corners: bamboo leaves bottom left, a pine twig rising bottom right, needles top left. */
  function drawEdge(W: number, H: number) {
    const r = rng(2435)
    const L0 = Math.min(W, H) * (G.wide ? 0.22 : 0.2)
    let bamboo = '', culm = '', pine = ''
    const leaf = (x: number, y: number, a: number, L: number) => {
      const w = L * 0.14
      const ex = x + Math.cos(a) * L, ey = y + Math.sin(a) * L
      const nx = -Math.sin(a) * w, ny = Math.cos(a) * w
      bamboo += `M${f1(x)} ${f1(y)}Q${f1(x + (ex - x) * 0.35 + nx)} ${f1(y + (ey - y) * 0.35 + ny)} ${f1(ex)} ${f1(ey)}Q${f1(x + (ex - x) * 0.4 - nx * 0.7)} ${f1(y + (ey - y) * 0.4 - ny * 0.7)} ${f1(x)} ${f1(y)}Z`
    }
    // bamboo: a culm rising out of the bottom-left corner, twigs and long leaves
    const b0: Pt = [-L0 * 0.25, G.H + L0 * 0.3], b1: Pt = [L0 * 0.25, G.H - L0 * 1.4]
    culm += stroke([b0, b1], Math.max(5, L0 * 0.08), 0.05, 0.3, 0.5)
    for (let k = 0; k < 3; k++) {
      const t0 = 0.35 + k * 0.25
      const bx = b0[0] + (b1[0] - b0[0]) * t0, by = b0[1] + (b1[1] - b0[1]) * t0
      const tw: Pt = [bx + L0 * (0.25 + r() * 0.2), by - L0 * (0.1 + r() * 0.15)]
      culm += stroke([[bx, by], tw], Math.max(1.6, L0 * 0.022), 0.05, 0.3, 0.3)
      for (let j = 0; j < 4; j++) leaf(tw[0], tw[1], Math.PI * (-0.2 + j * 0.13 + (r() - 0.5) * 0.08 - k * 0.04), L0 * (0.8 + r() * 0.45))
    }
    // pine needles: a twig rising into the bottom-right corner and a few fans hanging into the top-left one
    const fan = (ox: number, oy: number, a0: number, a1: number, n: number, len: number) => {
      for (let k = 0; k < n; k++) {
        const a = a0 + ((a1 - a0) * k) / (n - 1) + (r() - 0.5) * 0.08
        const l = len * (0.65 + r() * 0.4)
        pine += stroke([[ox, oy], [ox + Math.cos(a) * l, oy + Math.sin(a) * l]], Math.max(1.8, len * 0.02), 0.05, 0.6, 0.2)
      }
    }
    pine += stroke(curve([W + L0 * 0.1, G.H + L0 * 0.2], [W - L0 * 0.4, G.H - L0 * 0.3], [W - L0 * 0.9, G.H - L0 * 0.55], 8), Math.max(3, L0 * 0.045), 0.05, 0.4, 0.4)
    for (let f = 0; f < 4; f++) fan(W - L0 * (0.2 + f * 0.22), G.H - L0 * (0.12 + f * 0.13), Math.PI * 1.05, Math.PI * 1.75, 20, L0 * 0.7)
    for (let f = 0; f < 2; f++) fan(-L0 * 0.05 + f * L0 * 0.25, -L0 * 0.1, Math.PI * 0.15, Math.PI * 0.6, 14, L0 * 0.55)
    edgeSvg.replaceChildren(
      s('defs', null, s('filter', { id: 't24t-soft', x: '-20%', y: '-20%', width: '140%', height: '140%' }, s('feGaussianBlur', { stdDeviation: ctx.quality === 'low' ? 2 : 5 }))),
      s('g', { class: 't24t-bamboo', filter: 'url(#t24t-soft)' }, s('path', { d: culm }), s('path', { d: bamboo })),
      s('g', { class: 't24t-nearpine', filter: 'url(#t24t-soft)' }, s('path', { d: pine })))
  }

  // ── the branch follows the viewer
  let zone = 1, zoneT = 0
  function onView(x: number, y: number) {
    if (!G.W) return
    if (cut) return
    const yaw = -x * 16
    const sc = 1 + catches * 0.04
    branch.style.transform = `rotateY(${yaw.toFixed(2)}deg) rotateX(${(-y * 6).toFixed(2)}deg) rotateZ(${(y * 3 - x * 2).toFixed(2)}deg) scale(${sc.toFixed(3)})`
    // the gold tag turns its face to the viewer whatever the branch does; the gloss slides over the lacquer
    goldTag.style.transform = `rotateY(${(-yaw + x * S).toFixed(2)}deg)`
    flatLabel.style.transform = `rotateY(${(-yaw + x * S).toFixed(2)}deg)`
    glossSvg.style.transform = `translate(${f1(x * G.u * 0.06)}px, ${f1(y * G.u * 0.025)}px)`
    if (still) return
    const z = x < -0.3 ? 0 : x > 0.3 ? 2 : 1
    if (z !== zone) {
      zone = z
      clearTimeout(zoneT)
      zoneT = window.setTimeout(() => !cut && caught(z), 650)
    }
  }
  ctx.onCleanup(() => clearTimeout(zoneT))
  // the first looks count too: it catches the eye as you arrive, and again a little later
  if (!still) {
    zoneT = window.setTimeout(() => !cut && caught(1), 1200)
    const t2 = window.setTimeout(() => !cut && catches < 2 && caught(2), 3200)
    ctx.onCleanup(() => clearTimeout(t2))
  }

  /** It caught the viewer's eye from this side: a few likes fly in and perch, the branch grows and shines. */
  function caught(side: number) {
    if (catches >= 5) return
    catches++
    root.style.setProperty('--shine', String(Math.min(1, 0.5 + catches * 0.1)))
    for (let k = 0; k < 3; k++) perch((catches - 1) * 3 + k, true, side)
    onView(R.view.x, R.view.y)
    ctx.chime('soft')
  }

  function perch(i: number, fly: boolean, side = 1) {
    const r = rng(2490 + i)
    const p = FPADS[1 + (i % 3)]
    const x = BX(p[0] + (r() - 0.5) * p[2] * 0.6), y = Y(p[1] + p[3] * (0.1 + r() * 0.5))
    const f = h('i', { class: 't24t-fly', style: `left:${f1(Math.min(x, G.W - 12))}px;top:${f1(y)}px;--d:${(r() * 4).toFixed(2)}s` })
    flies.append(f)
    if (!fly || ctx.reduced) return
    const fromX = side === 0 ? -G.W * 0.6 : side === 2 ? G.W * 0.3 : (r() - 0.5) * G.W * 0.3
    const fromY = side === 1 ? G.H * 0.6 : (r() - 0.3) * G.H * 0.4
    f.animate([
      { transform: `translate(${f1(fromX)}px, ${f1(fromY)}px) scale(.6)`, opacity: 0 },
      { transform: `translate(${f1(fromX * 0.4)}px, ${f1(fromY * 0.25 - 40)}px) scale(1.15)`, opacity: 1, offset: 0.55 },
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
    ], { duration: 1300 + r() * 700, delay: (i % 3) * 160, easing: 'cubic-bezier(.3,.1,.3,1)', fill: 'backwards' })
  }

  // ── pruning: drag the shears onto the branch's joint, or press / Enter
  let drag: { id: number; x: number; y: number; moved: boolean } | null = null
  shears.addEventListener('pointerdown', (e) => {
    if (cut) return
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false }
    shears.setPointerCapture(e.pointerId)
    shears.classList.add('held')
    poke()
  })
  shears.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y
    if (Math.hypot(dx, dy) > 6) drag.moved = true
    shears.style.translate = `${f1(dx)}px ${f1(dy)}px`
  })
  const drop = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return
    const d = drag
    drag = null
    shears.classList.remove('held')
    if (!d.moved) return // a plain press: the click handler prunes
    const r = shears.getBoundingClientRect(), a = ctx.art.getBoundingClientRect()
    const cx = r.left + r.width * 0.2 - a.left, cy = r.top + r.height * 0.45 - a.top
    // near the joint, or anywhere along the first stretch of the branch
    const near = Math.hypot(cx - G.jx, cy - G.jy) < G.u * 0.25 || (cx > G.jx - 20 && cx < BX(0.7) && Math.abs(cy - Y(0.48)) < G.u * 0.16)
    if (near) prune()
    else shears.animate([{ translate: shears.style.translate }, { translate: '0px 0px' }], { duration: ctx.reduced ? 0 : 420, easing: 'cubic-bezier(.3,1.4,.5,1)' })
    if (!near) shears.style.translate = ''
    suppress = true
  }
  let suppress = false
  shears.addEventListener('pointerup', drop)
  shears.addEventListener('pointercancel', drop)
  shears.addEventListener('click', () => {
    if (suppress) return void (suppress = false)
    prune()
  })

  function prune() {
    if (cut) return
    cut = true
    clearTimeout(zoneT)
    root.classList.add('cut')
    shears.setAttribute('aria-disabled', 'true')
    goldTag.disabled = true
    realTag.setAttribute('aria-live', 'polite')
    realTag.classList.remove('turned')
    realTag.setAttribute('aria-expanded', 'true')
    const quick = ctx.reduced || ctx.quality === 'low'
    if (!quick) {
      // the branch falls slowly with its gold tag into the dark; the likes scatter; the tree springs upright
      const from = branch.style.transform || 'none'
      branch.animate([
        { transform: from, opacity: 1 },
        { transform: `${from} translateY(${f1(G.H * 0.06)}px) rotateZ(10deg)`, opacity: 1, offset: 0.25 },
        { transform: `${from} translateY(${f1(G.H * 0.7)}px) rotateZ(38deg)`, opacity: 0 },
      ], { duration: 2200, easing: 'cubic-bezier(.45,0,.8,.5)', fill: 'forwards' })
      flies.querySelectorAll<HTMLElement>('.t24t-fly').forEach((f, i) => {
        const a = (i / 7) * Math.PI * 2
        f.animate([{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${f1(Math.cos(a) * 160)}px, ${f1(Math.sin(a) * 90 - 120)}px)`, opacity: 0 }], { duration: 1400, delay: i * 40, easing: 'ease-out', fill: 'forwards' })
      })
      treeBox.animate([{ transform: 'rotate(2.4deg)' }, { transform: 'rotate(-1.1deg)', offset: 0.45 }, { transform: 'rotate(0.4deg)', offset: 0.75 }, { transform: 'rotate(0deg)' }], { duration: 1500, delay: 350, easing: 'ease-out', fill: 'backwards' })
      shears.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 900, delay: 500, fill: 'forwards' })
    }
    ctx.chime('ok')
    delete real.dataset.off
    const t = setTimeout(() => ctx.insight(K.insight, K.cause), quick ? 0 : 900)
    ctx.onCleanup(() => clearTimeout(t))
    R.set(0, 0)
  }
}
