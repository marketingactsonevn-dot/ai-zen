import './fork.css'
import { fill, h, nextId, s } from '../../core/dom'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import { onPrefs } from '../../core/prefs'
import { blob, clamp, curve, onSize, p2Defs, rng, stableHeight, stroke, type Pt } from '../../ui/part2/ink'
import { guide } from '../../ui/part2/guide'
import type { SceneCtx } from '../types'
import { C } from './shell'
import { brush, canvas, col, dprOf, fillD, fit, glow, grainOver, inkHills, mistBank, mix, moonDisc, palette, sky, stepStone, type Pal } from './ink2d'
import { createTable, type Lv, type TrayView } from './table'

const K = C.scenes.fork
type Id = 'speed' | 'share' | 'control'
const lv = (v: number) => (v < 34 ? 'low' : v > 66 ? 'high' : 'mid')
const f1 = (n: number) => n.toFixed(1)
const TILT = 20 // the sweep's beam swings ±20°

/**
 * Where everything stands for a stage W × H (the painting runs to the window's edges). Three stone paths start at our
 * feet and converge on the tray's pedestal; each path's mouth has its well-sweep beside it, the bucket hanging over
 * the path; a band of mist lies across each path half way in. Wide: levers along the foot; tall: tray in the upper
 * half, the three levers in a row at the foot.
 */
function geo(W: number, H: number) {
  const wide = W / H > 1.05
  const hz = H * (wide ? 0.3 : 0.27)
  const HW = wide ? Math.min(W * 0.2, H * 0.48) : W * 0.42
  const cx = W * 0.5
  const yN = wide ? hz + HW * 0.6 + H * 0.05 : H * 0.49
  const ped = HW * (wide ? 0.2 : 0.17)
  const foot = yN + ped
  const LH = wide ? clamp(H * 0.27, 110, 205) : clamp(H * 0.21, 92, 132)
  const beam = wide ? LH * 1.1 : Math.min(LH * 0.9, W * 0.22)
  const end = (side: number): Pt => [cx + side * HW * 0.6, foot + H * 0.02]
  const paths: Pt[][] = wide
    ? [[[W * 0.21, H * 1.03], [W * 0.27, H * 0.82], end(-1)], [[W * 0.5, H * 1.03], [W * 0.5, H * 0.86], [cx, foot + H * 0.025]], [[W * 0.79, H * 1.03], [W * 0.73, H * 0.82], end(1)]]
    : [[[W * 0.2, H * 0.9], [W * 0.18, H * 0.76], end(-1)], [[W * 0.5, H * 0.9], [W * 0.5, H * 0.78], [cx, foot + H * 0.02]], [[W * 0.8, H * 0.9], [W * 0.82, H * 0.76], end(1)]]
  // well-sweeps: foot x, bucket side (+1 = bucket to the right, over the path)
  // one convention for all three (audit 38-3): the bucket end is on the right, and up = high
  const levers: { x: number; y: number; d: number }[] = wide
    ? [{ x: W * 0.115, y: H - 30, d: 1 }, { x: W * 0.43, y: H - 26, d: 1 }, { x: W * 0.7, y: H - 30, d: 1 }]
    : [{ x: W / 6 - beam * 0.12, y: H - 64, d: 1 }, { x: W / 2 - beam * 0.12, y: H - 64, d: 1 }, { x: (W * 5) / 6 - beam * 0.12, y: H - 64, d: 1 }]
  // mist bands across each path, a little more than half way in
  const mists = paths.map((pp) => {
    const [x, y] = curve(pp[0], pp[1], pp[2], 20)[14]
    return { x, y, w: W * (wide ? 0.25 : 0.4), h: H * (wide ? 0.11 : 0.08) }
  })
  return { W, H, wide, hz, HW, cx, yN, ped, foot, LH, beam, paths, levers, mists }
}
type Geo = ReturnType<typeof geo>

/** The far layer: dawn sky, the moon touching the hills on the left, two ranges and the valley mist. */
function paintFar(g: CanvasRenderingContext2D, p: Pal, G: Geo) {
  const { W, H, hz } = G
  sky(g, p, W, H, hz, W * 0.74, 1)
  const mr = clamp(H * 0.036, 12, 26)
  moonDisc(g, p, W * (G.wide ? 0.12 : 0.15), hz - mr * (G.wide ? 0.25 : 0.4), mr, 3861, 1)
  inkHills(g, p, -W * 0.05, W * 1.05, hz + 2, H * 0.12, 3862, 0.92, 7)
  mistBank(g, p, W * 0.5, hz, W * 0.7, H * 0.05, 1)
  inkHills(g, p, -W * 0.1, W * 0.4, hz + H * 0.02, H * 0.13, 3863, 0.55, 3, -1)
  inkHills(g, p, W * 0.62, W * 1.1, hz + H * 0.02, H * 0.11, 3864, 0.6, 3, -1)
  mistBank(g, p, W * 0.18, hz + H * 0.02, W * 0.3, H * 0.04, 1)
  mistBank(g, p, W * 0.84, hz + H * 0.02, W * 0.3, H * 0.04, 1)
  grainOver(g, p, W, H)
}

/** Perspective share of a ground point: 0 at the horizon … 1 at the frame's foot. */
const depthOf = (G: Geo, y: number) => clamp((y - G.hz) / (G.H - G.hz), 0.02, 1.1)

/** One stone path: a swept bed of finer sand narrowing into the distance, edged in ink, and stepping stones along it,
 *  big and far apart at our feet, small and close where it meets the pedestal. */
function paintPath(g: CanvasRenderingContext2D, p: Pal, G: Geo, pp: Pt[], seed: number) {
  const pts = curve(pp[0], pp[1], pp[2], 40)
  const r = rng(seed)
  const half = (y: number) => (G.wide ? G.W * 0.05 : G.W * 0.085) * Math.pow(depthOf(G, y), 1.15)
  const left: Pt[] = [], right: Pt[] = []
  pts.forEach(([x, y], i) => {
    const [ax, ay] = pts[Math.max(0, i - 1)], [bx, by] = pts[Math.min(pts.length - 1, i + 1)]
    const tx = bx - ax, ty = by - ay, l = Math.hypot(tx, ty) || 1
    const w = half(y) * (1 + Math.sin(i * 1.7 + seed) * 0.05)
    left.push([x - (ty / l) * w, y + (tx / l) * w * 0.4])
    right.push([x + (ty / l) * w, y - (tx / l) * w * 0.4])
  })
  const bed = new Path2D()
  bed.moveTo(...left[0])
  left.forEach((q) => bed.lineTo(...q))
  for (let i = right.length - 1; i >= 0; i--) bed.lineTo(...right[i])
  bed.closePath()
  const bedC = p.dark ? mix(p['rock-lo'], p['step-mid'], 0.35) : mix(p['step-hi'], p['rock-hi'], 0.35)
  const lg = g.createLinearGradient(0, G.foot, 0, G.H)
  lg.addColorStop(0, col(bedC, 0.35))
  lg.addColorStop(1, col(bedC, 0.95))
  g.fillStyle = lg
  g.fill(bed)
  // its edges: a dark line of small pebbles, darker toward us
  brush(g, left, 1.2, col(p.dark ? p.umbra : p.wash, p.dark ? 0.5 : 0.22), 0.02, 0.3, 0.2)
  brush(g, right, 1.2, col(p.dark ? p.umbra : p.wash, p.dark ? 0.5 : 0.22), 0.02, 0.3, 0.2)
  // stepping stones, alternating a little either side of the line
  const n = G.wide ? 9 : 8
  for (let i = n - 1; i >= 0; i--) {
    const t = Math.pow(i / (n - 1), 0.72) * 0.96 + (r() - 0.5) * 0.03
    const [x, y] = pts[Math.round(clamp(t, 0, 1) * (pts.length - 1))]
    const d = depthOf(G, y)
    const rx = half(y) * (0.58 + r() * 0.55)
    const sx = x + (i % 2 ? 1 : -1) * rx * (0.1 + r() * 0.25)
    // moss in the gap before it
    if (i > 0 && r() < 0.7) fillD(g, blob(sx + (r() - 0.5) * rx, y + rx * (0.25 + 0.2 * d), rx * (0.25 + r() * 0.2), rx * 0.07 * (1 + d), seed + 40 + i, 0.4, 10), col(p['moss-b'], 0.55 * Math.min(1, d * 1.5)))
    stepStone(g, p, sx, y, rx, rx * (0.18 + 0.22 * d) * (0.85 + r() * 0.3), seed + i, -1, clamp(0.55 - d * 1.1, 0, 0.55))
  }
}

/** The ground: raked sand toward the mist, three stone paths, and the carved pedestal with its shadows. */
function paintGround(g: CanvasRenderingContext2D, p: Pal, G: Geo) {
  const { W, H, hz, cx, yN, HW, ped, foot } = G
  const sandNear = p.dark ? mix(p.paper, p['rock-lo'], 0.45) : mix(p.paper, p['step-hi'], 0.6)
  const sg = g.createLinearGradient(0, hz, 0, H)
  sg.addColorStop(0, col(p.dark ? mix(p.paper, p.mist, 0.12) : p.mist, 0))
  sg.addColorStop(0.12, col(sandNear, 0.75))
  sg.addColorStop(1, col(sandNear))
  g.fillStyle = sg
  g.fillRect(0, hz, W, H - hz)
  // raked rows: closer together toward the horizon, a dark furrow and a lit ridge each
  for (let i = 1; i < 34; i++) {
    const t = Math.pow(i / 34, 1.7)
    const y = hz + (H - hz) * t
    const pts: Pt[] = []
    for (let k = 0; k <= 24; k++) pts.push([(W * k) / 24, y + Math.sin(k * 0.8 + i) * (1 + t * 2)])
    brush(g, pts, 0.6 + t * 1.6, col(p.dark ? p.umbra : p.wash, (p.dark ? 0.35 : 0.1) * Math.min(1, t * 3)), 0.3, 0.3, 0.15)
    brush(g, pts.map(([x, yy]) => [x, yy + 1 + t * 1.5] as Pt), 0.5 + t, p.dark ? col(p.moon, 0.06 * t) : col(p['rake-hi'], 0.7 * Math.min(1, t * 3)), 0.3, 0.3, 0.15)
  }
  // rings raked round the pedestal
  for (let k = 0; k < 4; k++) {
    g.beginPath()
    g.ellipse(cx, foot - ped * 0.1, HW * (1.2 + k * 0.14), HW * (0.2 + k * 0.045), 0, 0, Math.PI * 2)
    g.strokeStyle = col(p.dark ? p.umbra : p.wash, p.dark ? 0.22 : 0.06)
    g.lineWidth = 2.4
    g.stroke()
  }
  G.paths.forEach((pp, i) => paintPath(g, p, G, pp, 3871 + i * 7))
  // the pedestal: a dressed block on a wider plinth; its long shadow thrown right by the setting moon, dark at its foot
  const pw = HW * 0.84, top = yN - 3, bot = foot, pl = ped * 0.26
  glow(g, cx + HW * 1.05, bot - 1, HW * 1.65, ped * 0.5, p.umbra, p.dark ? 0.65 : 0.3, 0.55)
  glow(g, cx + HW * 0.1, bot + 1, pw * 1.3, ped * 0.3, p.umbra, p.dark ? 0.9 : 0.55, 0.5)
  const stone = (x0: number, x1: number, y0: number, y1: number, lit: number) => {
    const fg = g.createLinearGradient(x0, 0, x1, 0)
    fg.addColorStop(0, col(mix(p['rock-mid'], p['rock-hi'], lit)))
    fg.addColorStop(0.35, col(mix(p['rock-mid'], p['rock-lo'], 0.45)))
    fg.addColorStop(1, col(mix(p['rock-lo'], p.umbra, p.dark ? 0.55 : 0.4)))
    g.fillStyle = fg
    g.fillRect(x0, y0, x1 - x0, y1 - y0)
  }
  stone(cx - pw * 1.1, cx + pw * 1.1, bot - pl, bot, 0.5)
  stone(cx - pw, cx + pw, top, bot - pl, 0.3)
  // chisel marks and grain over the body
  const r = rng(3879)
  g.save()
  g.beginPath()
  g.rect(cx - pw * 1.1, top, pw * 2.2, bot - top)
  g.clip()
  for (let i = 0; i < 70; i++) {
    const x = cx - pw * 1.08 + r() * pw * 2.16, y = top + r() * (bot - top)
    brush(g, [[x, y], [x + 3 + r() * 6, y + (r() - 0.5) * 2]], 0.7 + r() * 0.6, col(p.dark ? p.umbra : p.wash, p.dark ? 0.45 : 0.16), 0.3, 0.4, 0.2)
  }
  for (let i = 0; i < 220; i++) {
    const x = cx - pw * 1.1 + r() * pw * 2.2, y = top + r() * (bot - top)
    g.fillStyle = r() < 0.5 ? col(p.umbra, p.dark ? 0.4 : 0.18) : p.dark ? col(p.moon, 0.08) : col(p['rake-hi'], 0.5)
    g.fillRect(x, y, 1 + r(), 1)
  }
  // the tray's overhang shades the block's top; the plinth's top edge and the block's left edge catch the moon
  const sh = g.createLinearGradient(0, top, 0, top + ped * 0.45)
  sh.addColorStop(0, col(p.umbra, p.dark ? 0.75 : 0.45))
  sh.addColorStop(1, col(p.umbra, 0))
  g.fillStyle = sh
  g.fillRect(cx - pw, top, pw * 2, ped * 0.45)
  g.restore()
  const rim = p.dark ? col(p.moon, 0.4) : col(p['rake-hi'], 1)
  brush(g, [[cx - pw * 1.1, bot - pl], [cx + pw * 1.1, bot - pl]], 1.6, rim, 0.05, 0.4, 0.2)
  brush(g, [[cx - pw + 0.5, top + ped * 0.3], [cx - pw + 0.5, bot - pl]], 1.5, rim, 0.2, 0.2, 0.2)
  brush(g, [[cx - pw * 1.1, bot], [cx, bot + 0.6], [cx + pw * 1.1, bot]], 2, col(p.dark ? p.umbra : p.wash, p.dark ? 0.8 : 0.5), 0.1, 0.1, 0.4)
  // moss at its foot
  fillD(g, blob(cx - pw * 1.04, bot - 1, pw * 0.07, ped * 0.1, 3878, 0.3, 12), col(p['moss-b'], 0.8))
  fillD(g, blob(cx + pw * 0.95, bot - 0.5, pw * 0.05, ped * 0.07, 3877, 0.3, 10), col(p['moss-b'], 0.65))
  mistBank(g, p, W * 0.5, hz + H * 0.07, W * 0.6, H * 0.06, 1.2)
  grainOver(g, p, W, H)
}

/**
 * One hanetsurube in SVG, standing on (0, 0), LH tall: a thick bamboo post with knots and a forked top lashed with rope,
 * a bamboo beam on an axle (rotates), a roped counterweight stone with mass (and its shadow on the sand), a wooden
 * bucket with hoops. The low / high words ride the beam's two tips (bucket end = high).
 */
function leverArt(LH: number, beam: number, seed: number, d: number, lo: string, hi: string) {
  const a1 = beam * 0.38, a2 = beam * 0.62
  const py = -LH * 0.8
  const pw = Math.max(6, LH * 0.075)
  const bw = Math.max(5, LH * 0.056)
  const r = rng(seed)
  const rings = (x0: number, y0: number, x1: number, y1: number, w: number, n: number) => {
    let dk = '', lt = ''
    for (let i = 1; i < n; i++) {
      const t = (i + (r() - 0.5) * 0.25) / n
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t
      const nx = -(y1 - y0), ny = x1 - x0, l = Math.hypot(nx, ny)
      const ux = (nx / l) * w * 0.52, uy = (ny / l) * w * 0.52
      const ax = ((x1 - x0) / l) * 1.2, ay = ((y1 - y0) / l) * 1.2
      dk += `M${f1(x - ux)} ${f1(y - uy)}L${f1(x + ux)} ${f1(y + uy)}`
      lt += `M${f1(x - ux + ax)} ${f1(y - uy + ay)}L${f1(x + ux + ax)} ${f1(y + uy + ay)}`
    }
    return [s('path', { class: 't38f-knot', d: dk, 'stroke-width': f1(Math.max(1.2, w * 0.2)) }), s('path', { class: 't38f-knot-hi', d: lt, 'stroke-width': f1(Math.max(0.8, w * 0.12)) })]
  }
  // the post: a tapered cane, lit on its left (the moon), with a fork at the top
  const post = `M${f1(-pw / 2)} 0L${f1(-pw * 0.42)} ${f1(py + pw * 1.6)}L${f1(pw * 0.42)} ${f1(py + pw * 1.6)}L${f1(pw / 2)} 0Z`
  const prong = (sx: number) => stroke([[sx * pw * 0.32, py + pw * 1.8], [sx * pw * 0.95, py - pw * 1.1]], pw * 0.62, 0.08, 0.15, 0.6)
  const lash = Array.from({ length: 4 }, (_, i) => stroke([[-pw * 0.7, py + pw * (1.5 + i * 0.42)], [pw * 0.7, py + pw * (1.3 + i * 0.42)]], pw * 0.2, 0.1, 0.1, 0.6)).join('')
  // the beam (rotates about the axle)
  const arm = s('g', { class: 't38f-arm' },
    s('rect', { class: 't38f-beam', x: f1(-a1), y: f1(-bw / 2), width: f1(a1 + a2), height: f1(bw), rx: f1(bw * 0.45) }),
    s('rect', { class: 't38f-beam-hi', x: f1(-a1 * 0.95), y: f1(-bw * 0.36), width: f1((a1 + a2) * 0.97), height: f1(bw * 0.18), rx: f1(bw * 0.09) }),
    ...rings(-a1, 0, a2, 0, bw, 6),
    s('ellipse', { class: 't38f-cut', cx: f1(a2), cy: 0, rx: f1(bw * 0.18), ry: f1(bw * 0.48) }),
    s('circle', { class: 't38f-axle', cx: 0, cy: 0, r: f1(bw * 0.42) }))
  // the counterweight: a stone with mass, roped twice, hanging from the short end
  const sw = LH * 0.2, sh = LH * 0.15
  const weight = s('g', { class: 't38f-weight' },
    s('path', { class: 't38f-rope', d: `M0 0V${f1(LH * 0.07)}`, 'stroke-width': f1(Math.max(1.4, LH * 0.011)) }),
    s('path', { class: 't38f-stone', d: blob(0, LH * 0.07 + sh * 0.55, sw / 2, sh / 2, seed + 5, 0.12, 16), fill: 'url(#t38f-g-stone)' }),
    s('path', { class: 't38f-stone-sh', d: blob(sw * 0.12, LH * 0.07 + sh * 0.7, sw * 0.36, sh * 0.32, seed + 6, 0.2, 12) }),
    s('path', { class: 't38f-stone-hi', d: stroke([[-sw * 0.38, LH * 0.07 + sh * 0.45], [-sw * 0.2, LH * 0.07 + sh * 0.14], [sw * 0.08, LH * 0.07 + sh * 0.08]], Math.max(1, sw * 0.06), 0.2, 0.2, 0.2) }),
    s('path', { class: 't38f-wrap', d: stroke([[-sw * 0.46, LH * 0.07 + sh * 0.42], [0, LH * 0.07 + sh * 0.56], [sw * 0.46, LH * 0.07 + sh * 0.4]], Math.max(1.2, LH * 0.012), 0.1, 0.1, 0.6) + stroke([[-sw * 0.08, LH * 0.07 + sh * 0.02], [sw * 0.02, LH * 0.07 + sh * 0.6], [-sw * 0.04, LH * 0.07 + sh * 1.02]], Math.max(1.2, LH * 0.012), 0.1, 0.1, 0.6) }))
  // the bucket: staves, two hoops, a rope bail
  const ropeL = LH * 0.2, bH = LH * 0.13, bW = LH * 0.12
  const bucket = s('g', { class: 't38f-bucket' },
    s('path', { class: 't38f-rope', d: `M0 0V${f1(ropeL - bH * 0.4)}`, 'stroke-width': f1(Math.max(1.1, LH * 0.009)) }),
    s('path', { class: 't38f-rope', d: stroke(curve([-bW / 2, ropeL], [0, ropeL - bH * 0.8], [bW / 2, ropeL], 8), 1, 0.05, 0.05, 0.6) }),
    s('path', { class: 't38f-pail', d: `M${f1(-bW / 2)} ${f1(ropeL)}H${f1(bW / 2)}L${f1(bW * 0.42)} ${f1(ropeL + bH)}H${f1(-bW * 0.42)}Z`, fill: 'url(#t38f-g-pail)' }),
    s('path', { class: 't38f-staves', d: [-0.25, 0, 0.25].map((k) => `M${f1(bW * k)} ${f1(ropeL + 1)}L${f1(bW * k * 0.85)} ${f1(ropeL + bH - 1)}`).join('') }),
    s('path', { class: 't38f-band', d: `M${f1(-bW * 0.49)} ${f1(ropeL + bH * 0.22)}H${f1(bW * 0.49)}M${f1(-bW * 0.44)} ${f1(ropeL + bH * 0.8)}H${f1(bW * 0.44)}` }),
    s('ellipse', { class: 't38f-mouth', cx: 0, cy: f1(ropeL), rx: f1(bW / 2), ry: f1(bW * 0.12) }))
  // shadows on the sand: the post's, thrown right (the moon is low on the left); the stone's, under it, following it
  const wshadow = s('ellipse', { class: 't38f-wshadow', cx: 0, cy: 0, rx: f1(sw * 0.7), ry: f1(sh * 0.16) })
  const shadow = s('g', null,
    s('ellipse', { class: 't38f-contact', cx: f1(pw * 0.6), cy: 0, rx: f1(LH * 0.13), ry: f1(LH * 0.025) }),
    s('path', { class: 't38f-cast', d: stroke([[pw, 0], [d * LH * 0.55, LH * 0.03], [d * LH * 1.05, LH * 0.05]], pw * 1.6, 0.05, 0.6, 0.2) }),
    wshadow)
  // H2: the bucket's way, a dotted arc on the lever round its axle, ticked high · middle · low
  const arcR = a2 + LH * 0.03
  const arcPt = (deg: number): Pt => [Math.cos((deg * Math.PI) / 180) * arcR, py + Math.sin((deg * Math.PI) / 180) * arcR]
  let ticks = ''
  for (const deg of [-TILT, 0, TILT]) {
    const [x0, y0] = arcPt(deg), k = 1 + 9 / arcR
    ticks += `M${f1(x0)} ${f1(y0)}L${f1(x0 * k)} ${f1(py + (y0 - py) * k)}`
  }
  const way = s('g', { class: 't38f-way' },
    s('path', { class: 't38f-way-arc', d: `M${arcPt(-TILT - 3).map(f1).join(' ')}A${f1(arcR)} ${f1(arcR)} 0 0 1 ${arcPt(TILT + 3).map(f1).join(' ')}` }),
    s('path', { class: 't38f-way-tick', d: ticks }))
  const hiT = s('text', { class: 't38f-tip hi', 'text-anchor': 'middle' }, hi)
  const loT = s('text', { class: 't38f-tip lo', 'text-anchor': 'middle' }, lo)
  // the part that takes the pointer: the beam's swing and the hanging bucket (≥ 44 px), not the whole post's box
  const sw0 = Math.sin((TILT * Math.PI) / 180) * a2
  const hit = s('rect', { class: 't38f-hit', x: f1(-a1 - 8), y: f1(py - sw0 - 22), width: f1(a1 + a2 + 26), height: f1(sw0 * 2 + LH * 0.36 + 22) })
  const el = s('g', null,
    hit,
    s('g', { transform: `scale(${d} 1)` },
      shadow,
      s('path', { class: 't38f-cane', d: post, fill: 'url(#t38f-g-cane)' }),
      ...rings(0, -LH * 0.02, 0, py + pw * 1.6, pw, 5),
      s('path', { class: 't38f-cane', d: prong(-1) + prong(1), fill: 'url(#t38f-g-cane)' }),
      s('path', { class: 't38f-tie', d: lash }),
      way, weight, bucket, arm,
      s('path', { class: 't38f-grass', d: Array.from({ length: 7 }, (_, i) => stroke([[(i - 3) * LH * 0.02, 0], [(i - 3) * LH * 0.03 + (r() - 0.5) * LH * 0.04, -LH * (0.05 + r() * 0.06)]], 1.2, 0.05, 0.6, 0.1)).join('') })),
    hiT, loT)
  return { el, arm, weight, bucket, wshadow, hiT, loT, a1, a2, py, d }
}

/** Scene 3 ★ — the fork at moonset: three well-sweeps, and the sand table at the end of the paths shapes itself to them. */
export function forkScene(ctx: SceneCtx) {
  p2Defs()
  const low = ctx.quality === 'low'
  const still = ctx.reduced || low
  const stable = stableHeight(ctx, [K.insight])
  const far = canvas('t38f-cv')
  const ground = canvas('t38f-cv')
  const tray = canvas('t38f-tray')
  const name = h('p', { class: 't38f-name' })
  const text = h('p', { class: 't38f-text' })
  const words = h('div', { class: 't38f-words' }, name, text)
  const noteP = ctx.fact(K.note, 'p', 't38f-note')
  // the note on a wooden board roped to a stake driven into the sand beside the table (wide); on a phone, under the words
  const note = h('div', { class: 't38f-stake' }, s('svg', { class: 't38f-post', viewBox: '0 0 10 60', preserveAspectRatio: 'none', 'aria-hidden': 'true' }, s('path', { d: stroke([[5, 60], [5.4, 30], [5, 0]], 5, 0.02, 0.05, 0.8) })), h('div', { class: 't38f-board' }, noteP))
  const vals: Record<Id, number> = { speed: 50, share: 50, control: 50 }
  const stop = (o: number, c: string, a = 1) => s('stop', { offset: o, style: `stop-color:${c};stop-opacity:${a}` })
  const defs = s('svg', { class: 't38f-defs', width: 0, height: 0, 'aria-hidden': 'true' }, s('defs', null,
    s('linearGradient', { id: 't38f-g-cane', x1: 0, y1: 0, x2: 1, y2: 0 }, stop(0, 'color-mix(in srgb, var(--moss-a) 55%, var(--lantern))'), stop(0.4, 'color-mix(in srgb, var(--moss-b) 70%, var(--lantern))'), stop(1, 'color-mix(in srgb, var(--moss-b) 55%, var(--umbra))')),
    s('linearGradient', { id: 't38f-g-beam', x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, 'color-mix(in srgb, var(--moss-a) 55%, var(--lantern))'), stop(0.5, 'color-mix(in srgb, var(--moss-b) 70%, var(--lantern))'), stop(1, 'color-mix(in srgb, var(--moss-b) 55%, var(--umbra))')),
    s('linearGradient', { id: 't38f-g-pail', x1: 0, y1: 0, x2: 1, y2: 0 }, stop(0, 'color-mix(in srgb, var(--step-hi) 70%, var(--lantern))'), stop(1, 'color-mix(in srgb, var(--step-lo) 75%, var(--umbra))')),
    s('radialGradient', { id: 't38f-g-stone', cx: 0.32, cy: 0.28, r: 0.8 }, stop(0, 'var(--rock-hi)'), stop(0.55, 'var(--rock-mid)'), stop(1, 'color-mix(in srgb, var(--rock-lo) 70%, var(--umbra))'))))

  // mist bands across the three paths: touch one and it parts; what people guess is written where the scenario's words
  // stand (one block at a time: the words and the insight step back while it is open)
  const mistEls = K.mists.map((m, i) => {
    const id = nextId('t38f-strip')
    const strip = h('div', { class: 't38f-strip', id, hidden: true }, h('p', { class: 'p2-eyebrow' }, m.who), ctx.fact(m.view, 'p', 't38f-view'))
    const btn = h('button', { class: 't38f-mist-btn', type: 'button', 'aria-expanded': 'false', 'aria-controls': id, onClick: () => openMist(i) }, h('span', { class: 'visually-hidden' }, m.who))
    const el = h('div', { class: 't38f-mist', style: `--i:${i}` }, h('i', { class: 't38f-veil a' }), h('i', { class: 't38f-veil b' }), h('i', { class: 't38f-veil c' }), btn)
    return { el, btn, strip }
  })
  const strips = h('div', { class: 't38f-strips' }, ...mistEls.map((m) => m.strip))
  let open = -1
  let insightEl: HTMLElement | null = null
  const seen = new Set<number>()
  let mistDot: { done(): void } | null = null
  function openMist(i: number) {
    seen.add(i)
    if (mistDot) {
      if (seen.size >= mistEls.length) (mistDot.done(), (mistDot = null))
      else g.refresh()
    }
    const was = open
    if (open >= 0) {
      mistEls[open].el.classList.remove('open')
      mistEls[open].btn.setAttribute('aria-expanded', 'false')
      mistEls[open].strip.hidden = true
    }
    open = was === i ? -1 : i
    root.classList.toggle('mist-open', open >= 0)
    insightEl?.classList.toggle('t38-hush', open >= 0)
    if (open < 0) return
    mistEls[i].el.classList.add('open')
    mistEls[i].btn.setAttribute('aria-expanded', 'true')
    mistEls[i].strip.hidden = false
    ctx.chime('soft')
  }

  // the three well-sweeps (role=slider)
  const levers = K.sliders.map((sl, i) => {
    const svg = s('svg', { class: 't38f-lever-svg', 'aria-hidden': 'true' })
    const now = h('small', { class: 't38f-now' })
    const nm = h('span', { class: 't38f-plaque', 'aria-hidden': 'true' }, sl.label, now)
    const el = h('div', { class: 't38f-lever', role: 'slider', tabindex: '0', 'aria-label': sl.label, 'aria-orientation': 'vertical', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '50' }, svg, nm)
    return { sl, i, el, svg, nm, now, art: null as ReturnType<typeof leverArt> | null, swing: 0, sv: 0, bx: 0, by: 0 }
  })

  const far0 = h('div', { class: 't38f-layer far' }, far)
  const mid0 = h('div', { class: 't38f-layer mid' }, ground, tray, note)
  const near0 = h('div', { class: 't38f-layer near' }, h('div', { class: 't38f-mists', role: 'group', 'aria-label': K.mistsLabel }, ...mistEls.map((m) => m.el)), ...levers.map((l) => l.el))
  const root = h('div', { class: 't38f' }, h('p', { class: 'visually-hidden' }, K.art), defs, far0, mid0, words, strips, near0)
  ctx.art.append(root)
  ctx.prompt(K.prompt)
  // H1: a dot on each lever until it has been pulled once; on each mist once the insight is out
  const g = guide(ctx)
  // one vermilion point at a time: on the bucket of the next lever not yet pulled, then on the next mist not yet opened
  const pulled = new Set<number>()
  const nextLever = () => levers.find((x) => !pulled.has(x.i))
  let leverDot: { done(): void } | null = g.dot(() => {
    const l = nextLever()
    return l ? [l.bx, l.by] : [-99, -99]
  }, { dir: [0, -1] })
  const usedLever = (i: number) => {
    if (pulled.has(i)) return
    pulled.add(i)
    if (!nextLever()) (leverDot?.done(), (leverDot = null))
    else g.refresh()
  }

  const table = createTable(low)
  let p: Pal = palette()
  let G: Geo | null = null
  let gutter = 0
  let view: TrayView | null = null
  let built = false
  let dirty = true
  let told = false
  let live = false

  const levels = (): Lv => ({ s: vals.speed / 100, c: vals.share / 100, k: vals.control / 100 })
  function drawTray(mixed = false) {
    if (!built || !view) return
    if (!mixed) table.mix(levels(), p)
    const g = tray.getContext('2d')!
    g.setTransform(1, 0, 0, 1, 0, 0)
    table.render(g, view, p)
    dirty = false
  }
  // one loop: redraws the tray when a lever moved (wake), swings the hanging stones while they settle
  const loop = createLoop(root, (_t, dt) => {
    if (dirty) drawTray()
    let moving = false
    for (const l of levers) {
      if (!l.art) continue
      if (dt > 0) {
        l.sv += (-l.swing * 38 - l.sv * 4.2) * dt
        l.swing += l.sv * dt
      }
      if (Math.abs(l.swing) + Math.abs(l.sv) > 0.02) moving = true
      else l.swing = l.sv = 0
      hang(l)
    }
    return moving
  })
  ctx.onCleanup(() => loop.dispose())

  const angle = (v: number) => ((50 - v) / 50) * TILT
  function hang(l: (typeof levers)[number]) {
    const a = l.art!
    const v = vals[l.sl.id as Id]
    const deg = angle(v)
    const th = (deg * Math.PI) / 180
    const ex = Math.cos(th) * a.a2, ey = a.py + Math.sin(th) * a.a2
    const wx = -Math.cos(th) * a.a1, wy = a.py - Math.sin(th) * a.a1
    a.arm.setAttribute('transform', `translate(0 ${f1(a.py)}) rotate(${deg.toFixed(2)})`)
    a.bucket.setAttribute('transform', `translate(${f1(ex)} ${f1(ey)}) rotate(${(l.swing * 57).toFixed(2)})`)
    a.weight.setAttribute('transform', `translate(${f1(wx)} ${f1(wy)}) rotate(${(-l.swing * 30).toFixed(2)})`)
    // the stone's shadow on the sand under it: sharper and darker the lower it hangs
    const lowW = (wy - a.py) / (a.a1 * 0.36 || 1) // −1 high … 1 low
    a.wshadow.setAttribute('transform', `translate(${f1(wx + G!.LH * 0.06)} 0) scale(${(1.15 - lowW * 0.2).toFixed(2)} 1)`)
    a.wshadow.style.opacity = (0.55 + lowW * 0.3).toFixed(2)
    // the words ride the beam's tips (mirrored levers: the svg group is flipped, the words are not)
    const k = lv(v)
    a.hiT.setAttribute('x', f1(a.d * ex))
    a.hiT.setAttribute('y', f1(ey - G!.LH * 0.09))
    a.loT.setAttribute('x', f1(a.d * wx))
    a.loT.setAttribute('y', f1(wy - G!.LH * 0.09))
    a.hiT.classList.toggle('on', k === 'high')
    a.loT.classList.toggle('on', k === 'low')
    // where the bucket hangs, in the art's px (for its dot)
    const at = G!.levers[l.i]
    l.bx = at.x + a.d * ex - gutter
    l.by = at.y + ey + G!.LH * 0.2
  }
  function setVal(l: (typeof levers)[number], v: number) {
    v = Math.round(clamp(v, 0, 100))
    const id = l.sl.id as Id
    const was = vals[id]
    if (v === was) return
    vals[id] = v
    if (!still) l.sv += ((v - was) / 50) * 2.2
    l.el.setAttribute('aria-valuenow', String(v))
    dirty = true
    if (l.art) hang(l)
    scenario()
    still ? loop.wake() : loop.start()
  }
  // the insight only after the visitor has made at least two different gardens (audit 38-3: after the evidence); then
  // the mists over the paths are the next thing to touch
  const made = new Set<string>()
  function done() {
    if (!live) (words.setAttribute('aria-live', 'polite'), (live = true))
    made.add(scId)
    if (told || made.size < 2) return
    told = true
    insightEl = ctx.insight(K.insight, K.detail)
    ctx.prompt(K.mistPrompt)
    // one block: the scenario keeps only its name over the table once the insight is out
    root.classList.add('t38f-mists-on', 'told')
    mistDot = g.dot(() => {
      const k = mistEls.findIndex((_, j) => !seen.has(j))
      const b = G && k >= 0 ? G.mists[k] : null
      return b ? [b.x - gutter, b.y] : [-99, -99]
    }, { dir: [0, -1] })
  }

  levers.forEach((l) => {
    let drag = false
    let pivotY = 0
    l.el.addEventListener('pointerdown', (e) => {
      if (e.button) return
      drag = true
      usedLever(l.i)
      ;(e.target as Element).setPointerCapture(e.pointerId)
      l.el.focus({ preventScroll: true })
      const r = l.svg.getBoundingClientRect()
      pivotY = r.top + (G ? G.LH + l.art!.py : 0)
      move(e.clientY)
      ctx.chime('soft')
    })
    const move = (y: number) => {
      const a2 = l.art?.a2 ?? 1
      const th = Math.asin(clamp((y - pivotY) / a2, -1, 1)) * (180 / Math.PI)
      setVal(l, 50 - (clamp(th, -TILT, TILT) / TILT) * 50)
    }
    l.el.addEventListener('pointermove', (e) => drag && move(e.clientY))
    const up = () => {
      if (!drag) return
      drag = false
      done()
    }
    l.el.addEventListener('pointerup', up)
    l.el.addEventListener('pointercancel', up)
    l.el.addEventListener('keydown', (e) => {
      const v = vals[l.sl.id as Id]
      const to = { ArrowUp: v + 5, ArrowRight: v + 5, ArrowDown: v - 5, ArrowLeft: v - 5, PageUp: v + 20, PageDown: v - 20, Home: 0, End: 100 }[e.key]
      if (to == null) return
      e.preventDefault()
      usedLever(l.i)
      setVal(l, to)
      done()
    })
  })
  // H7: standing still 6 s, a bucket not yet pulled bobs a little on its rope (the way to drag)
  const onIdle = () => {
    if (still || told) return
    const l = levers.find((x) => !pulled.has(x.i)) ?? levers[0]
    if (!l.art) return
    l.sv += 1.1
    loop.start()
  }
  ctx.el.addEventListener('p2:idle', onIdle)
  ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', onIdle))
  const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && open >= 0 && openMist(open)
  root.addEventListener('keydown', onEsc)

  let scId = ''
  function scenario() {
    const sc = K.scenarios.find((x) => Object.entries(x.when).every(([k, want]) => lv(vals[k as Id]) === want)) ?? K.scenarios[K.scenarios.length - 1]
    root.dataset.garden = sc.id
    if (sc.id !== scId) {
      scId = sc.id
      name.textContent = sc.name
      text.textContent = sc.text
      if (!ctx.reduced) words.animate([{ opacity: 0.15, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 600, easing: 'ease-out' })
    }
    levers.forEach((l) => {
      const v = vals[l.sl.id as Id], k = lv(v)
      const word = k === 'low' ? l.sl.low : k === 'high' ? l.sl.high : v
      l.el.setAttribute('aria-valuetext', fill(K.sliderAria, { label: l.sl.label, value: word }))
      l.now.textContent = k === 'mid' ? '' : String(word)
      l.now.dataset.k = k
    })
  }
  scenario()

  // parallax: three layers, ±8 px at the near one (mouse only, high quality, motion allowed)
  if (!still) {
    let rect: DOMRect | null = null
    const enter = () => void (rect = root.getBoundingClientRect())
    root.addEventListener('pointerenter', enter)
    root.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return
      rect ??= root.getBoundingClientRect()
      root.style.setProperty('--px', (((e.clientX - rect.left) / rect.width) * 2 - 1).toFixed(3))
      root.style.setProperty('--py', (((e.clientY - rect.top) / rect.height) * 2 - 1).toFixed(3))
    })
    root.addEventListener('pointerleave', () => (root.style.setProperty('--px', '0'), root.style.setProperty('--py', '0')))
  }

  function paintBack() {
    if (!G) return
    const dpr = dprOf(low)
    paintFar(fit(far, G.W, G.H, dpr), p, G)
    paintGround(fit(ground, G.W, G.H, dpr), p, G)
  }

  let job: { cancel(): void } | null = null
  let drawn = false
  function layout() {
    const W = root.clientWidth
    const H = Math.max(240, stable(ctx.art.clientHeight))
    if (W < 60) return
    root.style.height = `${H}px`
    G = geo(W, H)
    root.classList.toggle('wide', G.wide)
    // the tray canvas: just round the tray and what can rise from it
    const left = G.cx - G.HW * 1.14, top = G.yN - G.HW * 1.38
    const cw = G.HW * 2.28, ch = G.yN + 3 - top
    // render scale: sharp on phones, but never wider than ~760 px of software pixels (≈ 25 ms a redraw at 4× CPU)
    const rs = low ? Math.min(0.75, 420 / cw) : Math.min(Math.max(1, devicePixelRatio || 1), 760 / cw)
    Object.assign(tray.style, { left: `${f1(left)}px`, top: `${f1(top)}px`, width: `${f1(cw)}px`, height: `${f1(ch)}px` })
    tray.width = Math.round(cw * rs)
    tray.height = Math.round(ch * rs)
    view = { RW: tray.width, RH: tray.height, cx: (G.cx - left) * rs, yN: (G.yN - top) * rs, HW: G.HW * rs }
    // words over the sky (inside the gutter); the note on a stake beside the pedestal
    const gut = (W - ctx.art.clientWidth) / 2
    gutter = gut
    const ww = G.wide ? Math.min(560, W * 0.4) : W - gut * 2
    const wbox = G.wide ? { left: `${f1(G.cx - ww / 2)}px`, top: `${f1(H * 0.035)}px`, width: `${f1(ww)}px`, textAlign: 'center' } : { left: `${f1(gut)}px`, top: '0px', width: `${f1(ww)}px`, textAlign: 'center' }
    Object.assign(words.style, wbox)
    Object.assign(strips.style, wbox)
    if (G.wide) {
      if (noteP.parentElement !== note.lastChild) note.lastChild!.appendChild(noteP)
      const bw = Math.min(200, W * 0.14)
      Object.assign(note.style, { left: `${f1(G.cx - G.HW * 1.32 - bw)}px`, top: `${f1(G.yN - G.HW * 0.28)}px`, width: `${f1(bw)}px` })
      note.hidden = false
    } else {
      words.append(noteP)
      note.hidden = true
    }
    root.style.setProperty('--post', `${f1(G.wide ? G.foot + G.H * 0.02 - (G.yN - G.HW * 0.28) : 0)}px`)
    // mist bands and their strips
    mistEls.forEach((m, i) => {
      const b = G!.mists[i]
      Object.assign(m.el.style, { left: `${f1(b.x - b.w / 2)}px`, top: `${f1(b.y - b.h / 2)}px`, width: `${f1(b.w)}px`, height: `${f1(b.h)}px` })
    })
    // levers
    levers.forEach((l, i) => {
      const at = G!.levers[i]
      const a = leverArt(G!.LH, G!.beam, 3890 + i * 7, at.d, l.sl.low, l.sl.high)
      l.art = a
      const pad = 8
      const wL = a.a1 + G!.LH * 0.12 + pad, wR = a.a2 + G!.LH * 0.1 + pad
      const [vx0, vw] = at.d > 0 ? [-wL, wL + wR] : [-wR, wL + wR]
      const vh = G!.LH * 1.12
      l.svg.setAttribute('viewBox', `${f1(vx0)} ${f1(-G!.LH)} ${f1(vw)} ${f1(vh)}`)
      l.svg.setAttribute('width', f1(vw))
      l.svg.setAttribute('height', f1(vh))
      l.svg.replaceChildren(a.el)
      Object.assign(l.el.style, { left: `${f1(at.x + vx0)}px`, top: `${f1(at.y - G!.LH)}px`, width: `${f1(vw)}px`, height: `${f1(vh)}px` })
      // the name on a plaque under the post, kept inside the gutter
      const half = G!.wide ? 0 : 52
      Object.assign(l.nm.style, { left: `${f1(clamp(at.x, gut + half, W - gut - half) - at.x - vx0)}px`, top: `${f1(G!.LH + 6)}px` })
      hang(l)
    })
    g.refresh()
    job?.cancel()
    if (drawn) {
      // a re-layout after the first painting: one go, and the tray only re-rendered (its landscape is already mixed)
      paintBack()
      drawTray(!dirty)
      return
    }
    const steps = function* () {
      const dpr = dprOf(low)
      paintFar(fit(far, G!.W, G!.H, dpr), p, G!)
      yield
      paintGround(fit(ground, G!.W, G!.H, dpr), p, G!)
      yield
      yield* table.build()
      built = true
      // the landscape mixed and rendered in slices (together ≈ 40 ms at 4× CPU)
      const g = tray.getContext('2d')!
      g.setTransform(1, 0, 0, 1, 0, 0)
      yield* table.steps(levels(), p, g, view!)
      dirty = false
      drawn = true
    }
    job = sliced(steps(), { sync: ctx.reduced })
  }
  ctx.onCleanup(() => job?.cancel())
  ctx.onCleanup(onSize(ctx.art, layout))
  ctx.onCleanup(onPrefs(() => {
    const q = palette()
    if (q.key === p.key) return
    p = q
    paintBack()
    dirty = true
    loop.wake()
  }))
}
