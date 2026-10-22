import { h, s } from '../../core/dom'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import { cssVar, onPrefs } from '../../core/prefs'
import { blob, clamp, curve, onSize, rng, stableHeight, stroke, type Pt } from '../../ui/part2/ink'
import { pine } from '../../ui/part2/paint'
import { guide } from '../../ui/part2/guide'
import type { SceneCtx } from '../types'
import C from '../../content/tram-27.json'
import { F, f1, invite, nudge, wideZone } from './ink27'

const S = C.scenes.lamp

/** A token's colour as numbers (tokens are hex or rgb()), so the canvas can mix and fade it. */
type RGB = [number, number, number]
const rgbOf = (c: string): RGB => {
  if (c.startsWith('#')) {
    const n = c.length === 4 ? [...c.slice(1)].map((x) => x + x).join('') : c.slice(1, 7)
    return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)]
  }
  const m = c.match(/[\d.]+/g)
  return m ? [+m[0], +m[1], +m[2]] : [0, 0, 0]
}
const rgba = ([r, g, b]: RGB, a = 1) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
interface Col { dark: boolean; wash: RGB; moon: RGB; paper: RGB; mossA: RGB; mossB: RGB; mossC: RGB; bark: RGB }

/** Someone sitting on the moss: feet centre (x, y), seated height h, facing f (1 = right), kind (hair, posture). */
interface Sitter { x: number; y: number; h: number; f: 1 | -1; kind: number }

/**
 * Where everything stands (px in the scene). The lantern's cord ring slides along the long branch between x0 (above
 * the three people at the pine's foot: "far" from you) and x1 (above you, at the other end: "close"). Wide, the bottom
 * right stays open ground for the insight; tall, the opening line sits in the sky over the branch.
 */
interface Geo {
  W: number; H: number; land: boolean
  base: Pt; top: Pt; tw: number; branch: Pt[]
  x0: number; x1: number; rope: number; lr: [number, number]
  people: Sitter[]; me: Sitter; tray: Pt
  moon: Pt; hz: number; bed: [number, number, number, number]
  opener: [number, number, number]; near: [number, number, number]
}
function geo(W: number, H: number): Geo {
  const land = W / H > 1.05
  if (land) {
    const knots: Pt[] = [[W * 0.165, H * 0.13], [W * 0.25, H * 0.185], [W * 0.33, H * 0.162], [W * 0.43, H * 0.178], [W * 0.52, H * 0.158], [W * 0.61, H * 0.172], [W * 0.68, H * 0.142], [W * 0.75, H * 0.11]]
    const ph = H * 0.17
    return {
      W, H, land, base: [W * 0.1, H * 0.92], top: knots[0], tw: W * 0.042, branch: dense(knots, 8),
      x0: W * 0.29, x1: W * 0.6, rope: H * 0.13, lr: [clamp(H * 0.075, 46, 72), clamp(H * 0.095, 58, 92)],
      people: [{ x: W * 0.2, y: H * 0.765, h: ph, f: 1, kind: 0 }, { x: W * 0.385, y: H * 0.745, h: ph * 0.94, f: -1, kind: 1 }, { x: W * 0.325, y: H * 0.82, h: ph * 1.04, f: -1, kind: 2 }],
      me: { x: W * 0.575, y: H * 0.9, h: H * 0.23, f: 1, kind: 3 }, tray: [W * 0.285, H * 0.752],
      moon: [W * 0.87, H * 0.12], hz: H * 0.53, bed: [W * 0.4, H * 0.82, W * 0.5, H * 0.24],
      opener: [W * 0.755, H * 0.21, W * 0.22], near: [W * 0.245, H * 0.88, W * 0.27],
    }
  }
  const knots: Pt[] = [[W * 0.14, H * 0.215], [W * 0.27, H * 0.262], [W * 0.42, H * 0.244], [W * 0.58, H * 0.262], [W * 0.76, H * 0.25], [W * 0.98, H * 0.222]]
  const ph = H * 0.135
  return {
    W, H, land, base: [W * 0.07, H * 0.93], top: knots[0], tw: W * 0.1, branch: dense(knots, 8),
    x0: W * 0.37, x1: W * 0.76, rope: H * 0.1, lr: [clamp(W * 0.13, 40, 54), clamp(W * 0.165, 50, 68)],
    people: [{ x: W * 0.24, y: H * 0.755, h: ph, f: 1, kind: 0 }, { x: W * 0.5, y: H * 0.735, h: ph * 0.92, f: -1, kind: 1 }, { x: W * 0.38, y: H * 0.8, h: ph * 1.04, f: -1, kind: 2 }],
    me: { x: W * 0.7, y: H * 0.93, h: H * 0.2, f: 1, kind: 3 }, tray: [W * 0.37, H * 0.745],
    moon: [W * 0.84, H * 0.135], hz: H * 0.5, bed: [W * 0.45, H * 0.82, W * 0.62, H * 0.22],
    // tall: the close-up line takes the opener's place in the sky (the opener has faded by then)
    opener: [W * 0.05, H * 0.025, W * 0.9], near: [W * 0.05, H * 0.025, W * 0.9],
  }
}
/** Points along a polyline, densified (pines bend in elbows, not arcs). */
function dense(pts: Pt[], k: number): Pt[] {
  return pts.flatMap((p, i) => (i ? Array.from({ length: k }, (_, j) => {
    const a = pts[i - 1], t = (j + 1) / k
    return [a[0] + (p[0] - a[0]) * t, a[1] + (p[1] - a[1]) * t] as Pt
  }) : [p]))
}
/** The branch's underside at x (where the cord ring rides). */
function branchY(g: Geo, x: number): number {
  const b = g.branch
  for (let i = 1; i < b.length; i++) {
    if (b[i][0] >= x) {
      const a = b[i - 1], u = (x - a[0]) / (b[i][0] - a[0] || 1)
      return a[1] + (b[i][1] - a[1]) * u
    }
  }
  return b[b.length - 1][1]
}
const ringAt = (g: Geo, t: number): Pt => {
  const x = g.x0 + (g.x1 - g.x0) * t
  return [x, branchY(g, x) + g.tw * 0.12]
}
/** the ground under the lantern: from the people's moss to your spot */
const groundAt = (g: Geo, t: number) => {
  const py = g.people.reduce((a, p) => a + p.y, 0) / g.people.length
  return py + (g.me.y - py) * t * 0.92
}

/** A band along a path between two offsets across its width (-0.5 = left of travel … 0.5 = right), the width tapering by t. */
function ribbon(pts: Pt[], wid: (t: number) => number, o0: number, o1: number, seed: number): string {
  const n = pts.length
  const A: Pt[] = [], B: Pt[] = []
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]
    const dl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    const nx = -(b[1] - a[1]) / dl, ny = (b[0] - a[0]) / dl
    const w = wid(i / (n - 1)) * (1 + 0.07 * Math.sin(i * 1.9 + seed) + 0.04 * Math.sin(i * 5.3 + seed * 2))
    A.push([p[0] + nx * w * o0, p[1] + ny * w * o0])
    B.push([p[0] + nx * w * o1, p[1] + ny * w * o1])
  })
  return `M${A.map(P).join('L')}L${B.reverse().map(P).join('L')}Z`
}
const P = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`

/**
 * The night behind (canvas, drawn once per size and theme): a ridge of far pines standing in the mist, an old pine from
 * the lower left with its long branch over the top (needle pads lit by the moon on their upper tips), surface roots, and
 * a moss floor wide enough for everyone to sit on. Night in both themes (the warm lantern carries the scene).
 */
function* paint(c2: CanvasRenderingContext2D, g: Geo, col: Col, dpr: number) {
  const { W, H, tw, base, top } = g
  const r = rng(2770)
  c2.setTransform(dpr, 0, 0, dpr, 0, 0)
  c2.clearRect(0, 0, W, H)
  const fill = (d: string, color: RGB, a = 1) => {
    c2.globalAlpha = a
    c2.fillStyle = rgba(color)
    c2.fill(new Path2D(d))
  }
  const dark = col.dark
  const [mx, my] = g.moon
  fill(blob(mx, my, Math.min(W, H) * 0.032, Math.min(W, H) * 0.032, 2771, 0.02, 20), col.moon, 0.95)
  yield
  // far: two ridges in mist, a row of pines on the nearer one, their feet fading into the haze (no outline: behind mist)
  const hz = g.hz
  const ridge = (k: number, amp: number, ph: number) => {
    let d = `M-10 ${f1(hz + H * 0.1)}`
    for (let x = -10; x <= W + 10; x += 10) d += `L${f1(x)} ${f1(hz - k - Math.max(0, Math.sin(x * 0.004 + ph) * amp + Math.sin(x * 0.017 + ph) * amp * 0.25))}`
    return d + `L${f1(W + 10)} ${f1(hz + H * 0.1)}Z`
  }
  const far = mix(col.wash, dark ? col.moon : col.paper, dark ? 0.1 : 0.35)
  fill(ridge(H * 0.06, H * 0.07, 1.4), far, dark ? 0.45 : 0.3)
  const pinesC = mix(col.wash, dark ? col.moon : col.paper, dark ? 0.06 : 0.2)
  let row = ''
  for (let i = 0; i < (g.land ? 15 : 7); i++) {
    const x = (i + 0.3 + r() * 0.5) * (W / (g.land ? 15 : 7)), hh = H * (0.07 + r() * 0.06)
    for (const p of pine(x, hz + H * 0.005, hh, 2900 + i, r() < 0.5 ? 1 : -1).querySelectorAll('path')) row += p.getAttribute('d') ?? ''
    if (i % 5 === 4) yield
  }
  fill(row, pinesC, dark ? 0.55 : 0.35)
  const haze = c2.createLinearGradient(0, hz - H * 0.06, 0, hz + H * 0.08)
  haze.addColorStop(0, rgba(far, 0))
  haze.addColorStop(0.6, rgba(far, dark ? 0.55 : 0.6))
  haze.addColorStop(1, rgba(far, 0))
  c2.globalAlpha = 1
  c2.fillStyle = haze
  c2.fillRect(0, hz - H * 0.06, W, H * 0.14)
  fill(ridge(-H * 0.01, H * 0.035, 3.1), mix(col.wash, far, 0.4), dark ? 0.7 : 0.45)
  yield
  // the moss ground: a soft dark bed under everyone, cushions of lighter moss, tufts thinning out at its ragged edge
  const [cx, cy, MX, MY] = g.bed
  const bed = c2.createRadialGradient(cx, cy, 0, cx, cy, MX)
  bed.addColorStop(0, rgba(mix(col.mossB, col.wash, dark ? 0.35 : 0.3), dark ? 0.92 : 0.8))
  bed.addColorStop(0.65, rgba(mix(col.mossB, col.wash, dark ? 0.45 : 0.4), dark ? 0.6 : 0.5))
  bed.addColorStop(1, rgba(col.mossB, 0))
  c2.save()
  c2.translate(cx, cy)
  c2.scale(1, MY / MX)
  c2.translate(-cx, -cy)
  c2.globalAlpha = 1
  c2.fillStyle = bed
  c2.fill(new Path2D(blob(cx, cy, MX, MX, 2772, 0.1, 40)))
  c2.restore()
  yield
  const tones = [col.mossA, col.mossC, mix(col.mossB, col.wash, 0.5)]
  const tuft = ['', '', '']
  for (let i = 0; i < (g.land ? 900 : 420); i++) {
    const a = r() * Math.PI * 2, q = Math.pow(r(), 0.6)
    const x = cx + Math.cos(a) * MX * q * (0.9 + r() * 0.2), y = cy + Math.sin(a) * MY * q
    const near = clamp((y - (cy - MY)) / (MY * 2), 0, 1)
    const l = (1.5 + r() * 3) * (0.5 + near)
    tuft[i % 3] += stroke([[x, y], [x + (r() - 0.5) * l * 0.8, y - l]], 0.8 + near, 0.1, 0.5, 0.3)
    if (i % 150 === 149) yield
  }
  tuft.forEach((d, i) => fill(d, tones[i], dark ? 0.42 : 0.34))
  let fallen = ''
  for (let i = 0; i < (g.land ? 60 : 30); i++) {
    const a = r() * Math.PI * 2, q = Math.sqrt(r())
    const x = cx + Math.cos(a) * MX * q * 0.9, y = cy + Math.sin(a) * MY * q * 0.9, l = 5 + r() * 9, ang = r() * Math.PI
    fallen += stroke([[x, y], [x + Math.cos(ang) * l, y + Math.sin(ang) * l * 0.4]], 0.9, 0.2, 0.3, 0.3)
  }
  fill(fallen, mix(col.bark, col.moon, dark ? 0.15 : 0.1), dark ? 0.5 : 0.35)
  yield
  // a round limb in three tones across its width (shade, bark, moonlit side), bark plates, a moon rim
  const lit = mix(col.bark, col.moon, dark ? 0.24 : 0.22)
  const limb = (pts: Pt[], wid: (t: number) => number, seed: number, litSide: 1 | -1, plates: number) => {
    const o = (v: number) => v * litSide
    fill(ribbon(pts, wid, -0.5, 0.5, seed), col.wash, dark ? 0.96 : 0.9)
    fill(ribbon(pts, wid, o(-0.22), o(0.5), seed), col.bark, dark ? 0.9 : 0.85)
    fill(ribbon(pts, wid, o(0.12), o(0.47), seed + 1), lit, dark ? 0.55 : 0.6)
    fill(ribbon(pts, wid, o(-0.5), o(-0.3), seed + 2), col.wash, dark ? 0.7 : 0.55)
    let fis = '', lips = ''
    const n = pts.length
    for (let i = 0; i < plates; i++) {
      const k = 1 + Math.floor(r() * (n - 4)), t = k / (n - 1), w = wid(t)
      const a = pts[k], b = pts[Math.min(n - 1, k + 2)]
      const dl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / dl, ny = (b[0] - a[0]) / dl
      const off = (r() - 0.5) * 0.85 * w
      const p0: Pt = [a[0] + nx * off, a[1] + ny * off], p1: Pt = [b[0] + nx * (off + (r() - 0.5) * w * 0.12), b[1] + ny * (off + (r() - 0.5) * w * 0.12)]
      fis += stroke([p0, [(p0[0] + p1[0]) / 2 + (r() - 0.5) * 3, (p0[1] + p1[1]) / 2], p1], 1 + r() * Math.max(1.4, w * 0.06), 0.3, 0.3, 0.1)
      if (r() < 0.5) fis += stroke([p0, [p0[0] + nx * w * 0.16 * (r() < 0.5 ? 1 : -1), p0[1] + ny * w * 0.16]], 1.1, 0.2, 0.4, 0.1)
      if (off * litSide > 0) lips += stroke([[p0[0] + nx * 1.6, p0[1] + ny * 1.6], [p1[0] + nx * 1.6, p1[1] + ny * 1.6]], 0.9, 0.3, 0.3, 0.1)
    }
    fill(fis, col.wash, dark ? 0.9 : 0.75)
    fill(lips, col.moon, dark ? 0.3 : 0.4)
    fill(ribbon(pts, wid, o(0.4), o(0.5), seed + 3), col.moon, dark ? 0.36 : 0.32)
  }
  // surface roots: from the trunk's foot, low over the moss toward the people, sinking into it
  for (let i = 0; i < 4; i++) {
    const dir = i === 0 ? -1 : 1
    const len = W * (g.land ? 0.05 + i * 0.035 : 0.08 + i * 0.05)
    const end: Pt = [base[0] + len * dir, base[1] + H * (0.012 + i * 0.008) - (i === 3 ? H * 0.04 : 0)]
    const w0 = tw * (0.62 - i * 0.1)
    limb(curve([base[0] + dir * tw * 0.3, base[1] - tw * 0.3], [base[0] + len * dir * 0.5, base[1] - H * 0.01], end, 14), (t) => w0 * (1 - t * 0.85), 30 + i, dir > 0 ? -1 : 1, 6)
  }
  yield
  // the trunk: an old pine bending up from the lower left, thick at the foot, tapering into the branch
  const trunk = [...curve([base[0] - tw * 0.3, H + 40], [base[0] + tw * 1.4, H * 0.66], [top[0] - tw * 0.2, H * 0.42], 18), ...curve([top[0] - tw * 0.2, H * 0.42], [top[0] - tw * 1.2, H * 0.22], top, 12).slice(1)]
  limb(trunk, (t) => tw * (1.25 - t * 0.5), 11, 1, g.land ? 90 : 55)
  yield
  // the long branch over the top: in elbows, tapering to its tip; the ring rides its underside
  const bw = (t: number) => tw * (0.56 - t * 0.42)
  limb(g.branch, bw, 21, -1, g.land ? 44 : 26)
  yield
  // needle clusters: fans from a twig's end massed into flat cloud pads above the branch (a few drooping), the
  // upper-right tips catching the moon; none hang where the cord ring runs
  const pads: [number, number, number][] = g.land
    ? [[0.03, -1, 1.2], [0.14, -1, 1.25], [0.3, -1, 1.05], [0.45, -1, 1.15], [0.6, -1, 0.95], [0.76, -1, 1], [0.92, -1, 0.8], [1, -1, 0.6]]
    : [[0.04, -1, 1.1], [0.25, -1, 1], [0.48, -1, 1.05], [0.7, -1, 0.95], [0.92, -1, 0.85]]
  const unit = g.land ? H * 0.15 : W * 0.2
  const needle = mix(col.bark, col.moon, dark ? 0.12 : 0.2)
  for (const [t, side, k] of pads) {
    const i = Math.round(t * (g.branch.length - 1))
    const [bx, by] = g.branch[i]
    const pw = unit * k
    const px = bx + (r() - 0.4) * pw * 0.3, py = by + side * pw * 0.2
    let twig = stroke([[bx, by], [(bx + px) / 2 + (r() - 0.5) * 6, (by + py) / 2], [px, py]], Math.max(1.4, bw(t) * 0.35), 0.1, 0.6, 0.3)
    let mass = '', nd = '', ndLit = '', rim = ''
    const fans = 5 + Math.round(k * 3)
    for (let f = 0; f < fans; f++) {
      const u = f / (fans - 1) - 0.5
      const fx = px + u * pw * 1.15 + (r() - 0.5) * pw * 0.08, fy = py - Math.cos(u * Math.PI) * pw * 0.16 + (r() - 0.5) * pw * 0.05
      const R = pw * (0.2 + 0.12 * Math.cos(u * Math.PI) + r() * 0.05)
      twig += stroke([[px, py], [fx, fy + R * 0.15]], 1.1, 0.1, 0.4, 0.4)
      mass += blob(fx, fy - R * 0.2, R * 0.85, R * 0.42, 2800 + f + i * 10, 0.25, 12)
      for (let j = 0; j < 19; j++) {
        const a = Math.PI * (1.02 + (j / 18) * 0.96) + (r() - 0.5) * 0.08
        const l = R * (0.75 + r() * 0.35)
        const tip: Pt = [fx + Math.cos(a) * l, fy + Math.sin(a) * l * 0.62]
        const ndl = stroke([[fx, fy], tip], 1 + r() * 1.1, 0.04, 0.55, 0.12)
        if (a > Math.PI * 1.3) ndLit += ndl
        else nd += ndl
        if (a > Math.PI * 1.45 && a < Math.PI * 1.95 && r() < 0.75) rim += stroke([[fx + (tip[0] - fx) * 0.5, fy + (tip[1] - fy) * 0.5], tip], 1.2, 0.2, 0.4, 0.1)
      }
    }
    fill(mass, mix(col.bark, col.wash, 0.5), dark ? 0.6 : 0.5)
    fill(twig, col.bark, 0.95)
    fill(nd, col.wash, dark ? 0.95 : 0.9)
    fill(ndLit, needle, dark ? 0.9 : 0.85)
    fill(rim, col.moon, dark ? 0.75 : 0.9)
    yield
  }
  c2.globalAlpha = 1
}

/**
 * A person sitting on the moss, seen from the side and a little behind (feet centre x, y; seated height h; facing f):
 * kneeling (seiza: back over the heels, forearms on the lap), or, for you, knees drawn up and hugged. A head on a neck,
 * the arm parted from the body by a fold, a collar, hair; the strokes the lantern lights (crown, shoulders, forearms,
 * lap) and the moon's rim on the right-hand edges. Unit coordinates: h = 1, y up is negative, facing right.
 */
const POSE = {
  kneel: {
    body: [[-0.34, 0], [-0.37, -0.08, -0.31, -0.14, -0.27, -0.2], [-0.31, -0.33, -0.25, -0.48, -0.17, -0.58], [-0.11, -0.64, -0.02, -0.665, 0.06, -0.645],
      [0.12, -0.625, 0.165, -0.575, 0.17, -0.5], [0.18, -0.41, 0.165, -0.33, 0.2, -0.27], [0.26, -0.215, 0.34, -0.2, 0.4, -0.175], [0.45, -0.155, 0.47, -0.11, 0.445, -0.075],
      [0.48, -0.05, 0.52, -0.02, 0.5, 0]],
    head: [0.05, -0.765], arm: [[0.1, -0.585], [0.175, -0.36], [0.27, -0.235], [0.42, -0.165]], collar: [[0.02, -0.65], [0.09, -0.56], [0.11, -0.5]],
    lit: [[[-0.2, -0.56], [-0.1, -0.64], [0.03, -0.665], [0.13, -0.62]], [[0.22, -0.25], [0.32, -0.205], [0.43, -0.17]], [[0.3, -0.12], [0.42, -0.08], [0.5, -0.02]]],
    moon: [[0.06, -0.645], [0.15, -0.6], [0.17, -0.48], [0.165, -0.36]],
  },
  hug: {
    body: [[-0.3, 0], [-0.35, -0.1, -0.34, -0.26, -0.28, -0.38], [-0.23, -0.5, -0.13, -0.585, -0.02, -0.605], [0.06, -0.615, 0.12, -0.585, 0.155, -0.53],
      [0.2, -0.505, 0.28, -0.51, 0.34, -0.525], [0.4, -0.535, 0.445, -0.51, 0.435, -0.445], [0.46, -0.3, 0.47, -0.15, 0.45, 0]],
    head: [0.1, -0.71], arm: [[0.08, -0.56], [0.2, -0.48], [0.32, -0.47], [0.42, -0.46]], collar: [[0.04, -0.61], [0.1, -0.54]],
    lit: [[[-0.12, -0.58], [-0.02, -0.605], [0.09, -0.6], [0.16, -0.54]], [[0.2, -0.5], [0.3, -0.505], [0.42, -0.5]], [[0.44, -0.42], [0.46, -0.28]]],
    moon: [[0.155, -0.53], [0.24, -0.505], [0.36, -0.52], [0.44, -0.46], [0.46, -0.3]],
  },
}
function sitter(p: Sitter) {
  const { x, y, h: u, f, kind } = p
  const pose = kind === 3 ? POSE.hug : POSE.kneel
  const Q = (px: number, py: number): Pt => [x + f * px * u, y + py * u]
  const q = (px: number, py: number) => P(Q(px, py))
  const [s0, ...cs] = pose.body as number[][]
  const body = `M${q(s0[0], s0[1])}` + cs.map((c) => `C${q(c[0], c[1])} ${q(c[2], c[3])} ${q(c[4], c[5])}`).join('') + 'Z'
  const [hx, hy] = Q(pose.head[0], pose.head[1])
  const neck = `M${q(pose.head[0] - 0.045, pose.head[1] + 0.1)}L${q(pose.head[0] - 0.035, pose.head[1] + 0.06)}L${q(pose.head[0] + 0.05, pose.head[1] + 0.06)}L${q(pose.head[0] + 0.06, pose.head[1] + 0.11)}Z`
  const head = blob(hx, hy, u * 0.098, u * 0.115, Math.round(x), 0.05, 14) + neck
  // hair: short (a friend), a bun (your mother), tied back (a colleague), loose and falling forward (you)
  const back = -f * u
  const hair = kind === 1
    ? blob(hx + back * 0.025, hy - u * 0.035, u * 0.095, u * 0.085, 2851, 0.1, 12) + blob(hx + back * 0.085, hy - u * 0.075, u * 0.05, u * 0.045, 2852, 0.1, 10)
    : kind === 2
      ? blob(hx + back * 0.03, hy - u * 0.03, u * 0.096, u * 0.095, 2853, 0.1, 12) + stroke([[hx + back * 0.08, hy - u * 0.02], [hx + back * 0.15, hy + u * 0.04], [hx + back * 0.13, hy + u * 0.09]], u * 0.04, 0.3, 0.6, 0.3)
      : kind === 3
        ? blob(hx + back * 0.02, hy - u * 0.02, u * 0.105, u * 0.11, 2856, 0.12, 12) + stroke([[hx - back * 0.02, hy - u * 0.08], [hx - back * 0.09, hy + u * 0.02]], u * 0.035, 0.3, 0.5, 0.2)
        : blob(hx + back * 0.025, hy - u * 0.045, u * 0.1, u * 0.075, 2854, 0.14, 12)
  const pts = (a: number[][]) => a.map(([px, py]) => Q(px, py))
  const fold = stroke(pts(pose.arm), u * 0.022, 0.3, 0.5, 0.2) + stroke(pts(pose.collar), u * 0.016, 0.3, 0.4, 0.2)
  // a cup in your mother's hands
  const cup = kind === 1 ? blob(...Q(0.43, -0.215), u * 0.035, u * 0.03, 2858, 0.05, 8) : ''
  const warm = stroke(Array.from({ length: 9 }, (_, k) => {
    const a = Math.PI * (1.1 + k * 0.1)
    return [hx + Math.cos(a) * u * 0.1, hy + Math.sin(a) * u * 0.118] as Pt
  }), u * 0.028, 0.2, 0.3, 0.1) + pose.lit.map((l) => stroke(pts(l), u * 0.03, 0.2, 0.3, 0.1)).join('')
  const moon = stroke(pts(pose.moon), u * 0.016, 0.2, 0.3, 0.1)
  return { body: body + cup, head, hair, fold, warm, moon }
}

/** The tea tray between the three: a low lacquer tray, a pot and two cups, steam no — it is late. */
function tray([x, y]: Pt, u: number) {
  const top = blob(x, y, u * 0.34, u * 0.08, 2861, 0.04, 16)
  const pot = blob(x - u * 0.1, y - u * 0.08, u * 0.075, u * 0.065, 2862, 0.06, 12) + stroke([[x - u * 0.03, y - u * 0.1], [x + u * 0.03, y - u * 0.14]], u * 0.02, 0.2, 0.5, 0.2) + `M${f1(x - u * 0.13)} ${f1(y - u * 0.15)}h${f1(u * 0.06)}v${f1(u * 0.02)}h${f1(-u * 0.06)}Z`
  const cups = blob(x + u * 0.08, y - u * 0.03, u * 0.03, u * 0.025, 2863, 0.05, 8) + blob(x + u * 0.17, y + u * 0.01, u * 0.03, u * 0.025, 2864, 0.05, 8)
  return { top, things: pot + cups }
}

/** Scene 2 — "the lamp at your side": slide the lantern along the branch to you, then back to the people at the pine. */
export const lampScene = {
  label: S.label,
  mount(ctx: SceneCtx) {
    const calm = ctx.quality === 'low' || ctx.reduced
    const cv = h('canvas', { class: 't27l-cv', 'aria-hidden': 'true' })
    const c2 = cv.getContext('2d')!
    const figs = s('svg', { class: 't27l-figs', 'aria-hidden': 'true' })
    const pool = h('div', { class: 't27l-pool', 'aria-hidden': 'true' })
    const q = h('p', { class: 't27l-q' }, S.question)
    const body = s('svg', { class: 't27l-body', viewBox: '-60 -84 120 168', 'aria-hidden': 'true' })
    const handle = h('i', { class: 't27l-handle' })
    const paper = h('div', {
      class: 't27l-paper', role: 'slider', tabindex: '0', 'aria-label': S.aria,
      'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-orientation': 'horizontal',
    }, body, q, handle)
    const lamp = h('div', { class: 't27l-lamp' }, h('i', { class: 't27l-cord' }), h('i', { class: 't27l-ring' }), paper)
    const opener = ctx.fact(F(S.opener), 'p', 't27l-text t27l-opener')
    const near = ctx.fact(F(S.near), 'p', 't27l-text t27l-near')
    const root = h('div', { class: `t27l${calm ? ' is-calm' : ''}` },
      h('p', { class: 'visually-hidden' }, S.art, ' ', S.people), cv, figs, pool, lamp, opener, near)
    ctx.art.append(root)
    ctx.prompt(S.prompt)
    const stable = stableHeight(ctx, [F(S.insight)])

    const stop = (o: number, c: string, a: number | string = 1) => s('stop', { offset: o, style: `stop-color:${c};stop-opacity:${a}` })
    // the lantern body: bamboo hoops with the paper bellying between them, faint panel seams, the wire frame and the
    // candle seen through it, a hot core, lacquered caps, a cold moon edge
    let hoops = '', bands = '', seams = ''
    for (let i = 1; i < 8; i++) {
      const t = -1 + (i * 2) / 8, y = t * 70, hw = 56 * Math.sqrt(1 - t * t * 0.92)
      hoops += stroke(curve([-hw, y], [0, y + 7], [hw, y], 12), 1.2, 0.08, 0.08, 0.4)
      bands += stroke(curve([-hw * 0.98, y + 2.2], [0, y + 9], [hw * 0.98, y + 2.2], 12), 4.2, 0.1, 0.1, 0.3)
    }
    for (const u of [-0.72, -0.36, 0, 0.36, 0.72]) {
      seams += stroke(Array.from({ length: 15 }, (_, i) => {
        const t = -1 + (i / 14) * 2
        return [u * 56 * Math.sqrt(1 - t * t * 0.92) * (1 - 0.06 * Math.abs(u)), t * 70] as Pt
      }), 0.9, 0.1, 0.1, 0.4)
    }
    body.append(
      s('defs', null,
        s('radialGradient', { id: 't27l-paperG', cx: 0.5, cy: 0.6, r: 0.6, fx: 0.47, fy: 0.62 },
          stop(0, 'var(--moon)'), stop(0.22, 'color-mix(in srgb, var(--moon) 45%, var(--lantern))'), stop(0.62, 'var(--lantern)'),
          stop(0.9, 'color-mix(in srgb, var(--lantern) 70%, var(--umbra))'), stop(1, 'color-mix(in srgb, var(--lantern) 55%, var(--umbra))')),
        s('radialGradient', { id: 't27l-core', cx: 0.5, cy: 0.5, r: 0.5 }, stop(0, 'var(--moon)', 0.95), stop(0.4, 'var(--moon)', 0.5), stop(1, 'var(--lantern)', 0)),
        s('radialGradient', { id: 't27l-inner', cx: 0.5, cy: 0.5, r: 0.5 }, stop(0, 'var(--lantern)', 0.75), stop(0.5, 'var(--lantern)', 0.25), stop(1, 'var(--lantern)', 0))),
      s('ellipse', { class: 't27l-halo', cx: 0, cy: 6, rx: 150, ry: 170, fill: 'url(#p2-lamp)' }),
      s('ellipse', { class: 't27l-halo t27l-halo-in', cx: 0, cy: 8, rx: 84, ry: 96, fill: 'url(#t27l-inner)' }),
      s('ellipse', { class: 't27l-paper-b', cx: 0, cy: 0, rx: 56, ry: 72, fill: 'url(#t27l-paperG)' }),
      s('path', { class: 't27l-frame', d: stroke([[0, -66], [0, 34]], 1.6, 0.1, 0.1, 0.5) + 'M-9 50h18l-3 -14h-12Z' }),
      s('ellipse', { class: 't27l-core', cx: 0, cy: 26, rx: 30, ry: 34, fill: 'url(#t27l-core)' }),
      s('path', { class: 't27l-band', d: bands, filter: 'url(#ink-wash)' }),
      s('path', { class: 't27l-seam', d: seams }),
      s('path', { class: 't27l-rib', d: hoops }),
      s('path', { class: 't27l-limb', d: 'M0 -72A56 72 0 1 1 0 72A56 72 0 1 1 0 -72ZM0 -66A51 66 0 1 0 0 66A51 66 0 1 0 0 -66Z' }),
      s('path', { class: 't27l-cap', d: 'M-26 -81h52l-3 12h-46zM-29 69h58l-3 12h-52z', filter: 'url(#ink-rough)' }),
      s('path', { class: 't27l-caphi', d: stroke([[-22, -79.5], [20, -79.5]], 1.4, 0.2, 0.2, 0.2) + stroke([[-25, 70.5], [24, 70.5]], 1.4, 0.2, 0.2, 0.2) }),
      s('path', { class: 't27l-rimline', d: stroke(Array.from({ length: 14 }, (_, i) => [Math.cos(-0.4 - i * 0.09) * 56, Math.sin(-0.4 - i * 0.09) * 72] as Pt), 2, 0.2, 0.3, 0.2) }))

    // ── guide: the ring's way is the branch itself: three notches cut in the bark (far · middle · close), their names
    // just under it; a dot on the lantern ──
    const gd = guide(ctx)
    let G: Geo | null = null
    const notches = S.ticks.map((l) => h('div', { class: 't27l-notch', 'aria-hidden': 'true' }, h('i'), h('span', null, l)))
    root.append(...notches)
    let dot: ReturnType<typeof gd.dot> | null = gd.dot(handle, { dir: [1, 0] })

    // ── state: t = where the ring is (0 far, at the people … 1 close, at you), with a lean of the lantern as it moves ──
    const st = { t: 0.3, tt: 0.3, a: 0, av: 0 }
    let step = 0
    function apply() {
      const g = G
      if (!g) return
      const [rx, ry] = ringAt(g, st.t)
      lamp.style.transform = `translate3d(${f1(rx)}px,${f1(ry)}px,0) rotate(${(st.a * 57.2958).toFixed(2)}deg)`
      // light: the three are lit while the lantern is over them; you, as it comes to you; the pool on the ground under it
      const lp = clamp(1 - st.t * 1.3, 0, 1), lm = clamp((st.t - 0.15) / 0.75, 0, 1)
      root.style.setProperty('--lp', lp.toFixed(3))
      root.style.setProperty('--lm', lm.toFixed(3))
      root.style.setProperty('--ld', clamp((st.t - 0.45) / 0.45, 0, 1).toFixed(3))
      const gy = groundAt(g, st.t)
      pool.style.transform = `translate3d(${f1(rx)}px,${f1(gy)}px,0) translate(-50%,-50%)`
      notches.forEach((n, i) => n.classList.toggle('on', st.t >= i / 2 - 0.02))
      paper.setAttribute('aria-valuenow', String(Math.round(st.t * 100)))
      paper.setAttribute('aria-valuetext', S.ticks[Math.round(st.t * 2)])
      if (step === 0 && st.t > 0.9) reachNear()
      else if (step === 1 && st.t < 0.1) reachFar()
    }
    const loop = createLoop(root, (_t, dt) => {
      if (dt > 0) {
        const prev = st.t
        st.t += (st.tt - st.t) * (1 - Math.exp(-dt * 8)) // the lantern is a little heavy: it trails the hand
        const vel = (st.t - prev) / dt
        st.av += (-28 * (st.a - clamp(-vel * 0.45, -0.45, 0.45)) - 4.5 * st.av) * dt
        st.a += st.av * dt
      }
      apply()
      return Math.abs(st.tt - st.t) > 0.0008 || Math.abs(st.a) > 0.002 || Math.abs(st.av) > 0.002
    })
    ctx.onCleanup(() => loop.dispose())
    const go = (t: number) => {
      st.tt = clamp(t, 0, 1)
      if (calm) {
        st.t = st.tt
        apply()
      } else loop.start()
    }

    function reachNear() {
      step = 1
      root.classList.add('is-near')
      ctx.chime('soft')
      ctx.prompt(S.promptBack)
      if (dot) dot.el.style.setProperty('--dx', '-1')
    }
    function reachFar() {
      step = 2
      root.classList.remove('is-near')
      root.classList.add('is-done')
      dot?.done()
      dot = null
      root.classList.add('notched')
      ctx.chime('ok')
      ctx.insight(F(S.insight), F(S.detail))
    }

    // ── input: drag the lantern (or anywhere along its groove) left and right; arrows / Home / End when focused ──
    let rect: DOMRect | null = null
    const tAt = (clientX: number) => {
      const g = G!
      rect ??= root.getBoundingClientRect()
      return ((clientX - rect.left) - g.x0) / (g.x1 - g.x0)
    }
    root.addEventListener('pointerdown', (e) => {
      const g = G
      if (!g || e.button) return
      rect = root.getBoundingClientRect()
      const [rx, ry] = ringAt(g, st.t)
      const x = e.clientX - rect.left, y = e.clientY - rect.top
      const onLamp = Math.abs(x - rx) < Math.max(g.lr[0] + 12, 36) && y > ry - 10 && y < ry + g.rope + g.lr[1] * 2 + 34
      if (!onLamp) return
      const dx = x - (g.x0 + (g.x1 - g.x0) * st.t)
      root.setPointerCapture(e.pointerId)
      root.classList.add('is-drag')
      const move = (ev: PointerEvent) => go(tAt(ev.clientX - dx))
      const up = () => {
        root.removeEventListener('pointermove', move)
        root.removeEventListener('pointerup', up)
        root.removeEventListener('pointercancel', up)
        root.classList.remove('is-drag')
      }
      root.addEventListener('pointermove', move)
      root.addEventListener('pointerup', up)
      root.addEventListener('pointercancel', up)
    })
    paper.addEventListener('keydown', (e) => {
      const k = e.key
      const d = k === 'ArrowRight' || k === 'ArrowUp' ? 0.25 : k === 'ArrowLeft' || k === 'ArrowDown' ? -0.25 : 0
      if (d) go(Math.round((st.tt + d) * 4) / 4)
      else if (k === 'Home') go(0)
      else if (k === 'End') go(1)
      else return
      e.preventDefault()
    })
    // H7: standing still, the lantern sways a little the way it should go
    invite(ctx, () => step < 2 && nudge(ctx, lamp, step === 0 ? 11 : -11, 0))
    // a test hook for the shot scripts (desk and phone take the same path as a drag)
    ;(window as unknown as { __t27lamp?: (t: number) => void }).__t27lamp = go
    ctx.onCleanup(() => delete (window as unknown as { __t27lamp?: unknown }).__t27lamp)

    // ── layout: paint once per size and theme (the first time soaking in), place the people, the words, the lantern ──
    let job: { cancel(): void } | null = null
    let first = true
    let col = {} as Col
    const readCol = () => {
      const v = (n: string) => rgbOf(cssVar(n))
      const next: Col = { dark: document.documentElement.dataset.theme === 'dark', wash: v('--wash'), moon: v('--moon'), paper: v('--paper'), mossA: v('--moss-a'), mossB: v('--moss-b'), mossC: v('--moss-c'), bark: mix(v('--rock-lo'), v('--wash'), 0.45) }
      const changed = JSON.stringify(next) !== JSON.stringify(col)
      col = next
      return changed
    }
    function draw() {
      const g = G
      if (!g) return
      const dpr = Math.min(2, devicePixelRatio || 1)
      job?.cancel()
      if (first || ctx.reduced) {
        cv.width = Math.round(g.W * dpr)
        cv.height = Math.round(g.H * dpr)
        job = sliced(paint(c2, g, col, dpr), { sync: ctx.reduced })
        first = false
        return
      }
      // a redraw (size, theme) paints off screen in one go, then swaps in: no flicker
      const off = document.createElement('canvas')
      off.width = Math.round(g.W * dpr)
      off.height = Math.round(g.H * dpr)
      const it = paint(off.getContext('2d')!, g, col, dpr)
      while (!it.next().done);
      cv.width = off.width
      cv.height = off.height
      c2.drawImage(off, 0, 0)
    }
    function people(g: Geo) {
      const all = [...g.people, g.me]
      const out: SVGElement[] = [
        s('defs', null,
          s('linearGradient', { id: 't27l-litTop', x1: 0, y1: 0, x2: 0.15, y2: 1 }, stop(0, 'var(--lantern)', 0.85), stop(0.45, 'var(--lantern)', 0.28), stop(1, 'var(--lantern)', 0)),
          s('linearGradient', { id: 't27l-litMe', x1: 0.9, y1: 0, x2: 0.2, y2: 0.9 }, stop(0, 'var(--lantern)', 0.95), stop(0.5, 'var(--lantern)', 0.3), stop(1, 'var(--lantern)', 0)),
          s('radialGradient', { id: 't27l-cast' }, stop(0, 'var(--umbra)', 0.55), stop(1, 'var(--umbra)', 0))),
      ]
      const t = tray(g.tray, g.people[0].h)
      for (const p of all) {
        // the moon (upper right) throws each shadow a little to the left; a contact shadow under the robe
        out.push(s('ellipse', { class: 't27l-cast', cx: f1(p.x - p.h * 0.35), cy: f1(p.y + p.h * 0.01), rx: f1(p.h * 0.62), ry: f1(p.h * 0.07), fill: 'url(#t27l-cast)' }))
        out.push(s('ellipse', { class: 't27l-contact', cx: f1(p.x + p.f * p.h * 0.1), cy: f1(p.y), rx: f1(p.h * 0.45), ry: f1(p.h * 0.035) }))
      }
      out.push(s('ellipse', { class: 't27l-contact', cx: f1(g.tray[0]), cy: f1(g.tray[1] + 2), rx: f1(g.people[0].h * 0.36), ry: f1(g.people[0].h * 0.03) }))
      out.push(s('path', { class: 't27l-tray', d: t.top, filter: 'url(#ink-rough)' }), s('path', { class: 't27l-tray-things', d: t.things }),
        s('path', { class: 't27l-tray-lit', d: t.top + t.things }))
      for (const p of all) {
        const f = sitter(p)
        const me = p === g.me
        const cls = me ? 't27l-me' : 't27l-fig'
        out.push(s('g', { class: cls },
          s('path', { class: 't27l-fig-body', d: f.body + f.head, filter: 'url(#ink-rough)' }),
          s('path', { class: 't27l-fig-hair', d: f.hair, filter: 'url(#ink-wash)' }),
          s('path', { class: 't27l-fig-fold', d: f.fold }),
          s('path', { class: 't27l-fig-lit', d: f.body + f.head, fill: `url(#${me ? 't27l-litMe' : 't27l-litTop'})` }),
          s('path', { class: 't27l-fig-warm', d: f.warm }),
          s('path', { class: 't27l-fig-moon', d: f.moon }),
          me ? null : s('path', { class: 't27l-fig-dim', d: f.body + f.head + f.hair })))
      }
      return out
    }
    function layout() {
      const W = root.clientWidth, Hr = root.clientHeight
      if (W < 60 || Hr < 60) return
      const H = wideZone() ? Hr : stable(Hr)
      const g = (G = geo(W, H))
      Object.assign(cv.style, { width: `${W}px`, height: `${H}px` })
      figs.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
      Object.assign(figs.style, { width: `${W}px`, height: `${H}px` })
      figs.replaceChildren(...people(g))
      const pw = g.land ? W * 0.3 : W * 0.62, ph = g.land ? H * 0.22 : H * 0.15
      Object.assign(pool.style, { width: `${f1(pw)}px`, height: `${f1(ph)}px` })
      const [lw, lh] = g.lr
      Object.assign(lamp.style, { width: `${f1(lw * 2)}px`, height: `${f1(g.rope + lh * 2)}px`, marginLeft: `${f1(-lw)}px` })
      lamp.style.setProperty('--rope', `${f1(g.rope)}px`)
      lamp.style.setProperty('--lw', `${f1(lw * 2)}px`)
      lamp.style.setProperty('--lh', `${f1(lh * 2)}px`)
      const place = (el: HTMLElement, [x, y, w]: [number, number, number]) => Object.assign(el.style, { left: `${f1(x)}px`, top: `${f1(y)}px`, width: `${f1(w)}px` })
      notches.forEach((n, i) => {
        const x = g.x0 + ((g.x1 - g.x0) * i) / 2, y = branchY(g, x), w = g.tw * (0.56 - 0.42 * ((x - g.top[0]) / (g.branch[g.branch.length - 1][0] - g.top[0])))
        Object.assign(n.style, { left: `${f1(x)}px`, top: `${f1(y)}px` })
        n.style.setProperty('--bw', `${f1(Math.max(6, w * 0.8))}px`)
      })
      place(opener, g.opener)
      place(near, g.near)
      readCol()
      draw()
      apply()
      gd.refresh()
    }
    ctx.onCleanup(onSize(root, () => {
      rect = null
      layout()
    }))
    ctx.onCleanup(() => job?.cancel())
    ctx.onCleanup(onPrefs(() => readCol() && draw()))
  },
}
