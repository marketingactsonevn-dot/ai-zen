import { h, s } from '../../core/dom'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import { cssVar, onPrefs } from '../../core/prefs'
import { blob, clamp, curve, rng, stroke, type Pt } from '../../ui/part2/ink'
import { perspectiveCircle } from '../../ui/part2/perspectives'
import type { Perspectives } from '../../ui/part2/types'
import type { SceneCtx } from '../types'
import C from '../../content/tram-27.json'
import { domePts, F, f1, P } from './ink27'

const S = C.scenes.lamp
const SEEDS = [2781, 2784, 2789, 2793]

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
interface Col { dark: boolean; wash: RGB; moon: RGB; mossA: RGB; mossB: RGB; mossC: RGB; bark: RGB }

/** Where everything stands (px in the scene): the pine's hook, the lantern, the arc of stones round the spot under it, the words. */
interface Geo {
  W: number; H: number; land: boolean
  hook: Pt; rope: number; lr: [number, number]
  c: Pt; rx: number; ry: number; sw: number
  feet: Pt[]; sc: number[]; reach: number; text: [number, number, number]
  base: Pt; tw: number; top: Pt
}
/** The arc: back-left, round the front, to back-right (degrees on the ground ellipse; y down, so 90° is nearest). */
const ARC = [205, 128, 52, -25]
function geo(W: number, H: number): Geo {
  const land = W / H > 1.05
  const hook: Pt = land ? [W * 0.56, H * 0.17] : [W * 0.57, H * 0.13]
  const lr: [number, number] = land ? [clamp(H * 0.12, 56, 86), clamp(H * 0.15, 70, 106)] : [clamp(W * 0.18, 50, 66), clamp(W * 0.23, 64, 84)]
  const c: Pt = land ? [W * 0.56, H * 0.62] : [W * 0.57, H * 0.55]
  const rx = land ? Math.min(W * 0.29, H * 0.6) : W * 0.33
  const ry = land ? H * 0.16 : H * 0.085
  const sw = land ? clamp(rx * 0.34, 92, 136) : clamp(W * 0.2, 60, 78)
  const feet = ARC.map((d) => [c[0] + rx * Math.cos((d * Math.PI) / 180), c[1] + ry * Math.sin((d * Math.PI) / 180)] as Pt)
  // nearer stones are bigger: the arc is seen in perspective
  const sc = ARC.map((d) => 0.78 + 0.3 * (Math.sin((d * Math.PI) / 180) + 1) / 2)
  const tw = land ? W * 0.05 : W * 0.065
  const base: Pt = land ? [W * 0.15, H * 0.86] : [W * 0.07, H * 0.8]
  const top: Pt = land ? [W * 0.21, H * 0.13] : [W * 0.13, H * 0.1]
  // the words lie on the ground: inside the arc under the pool (wide), or on the moss in front of it, right of the trunk (tall)
  const inner = rx * Math.abs(Math.cos((ARC[1] * Math.PI) / 180)) - sw * sc[1] * 0.5 - 14
  const text: [number, number, number] = land
    ? [c[0] - Math.min(inner, 220), c[1] - ry * 0.3, Math.min(inner, 220) * 2]
    : [Math.max(base[0] + tw * 2, W * 0.2), c[1] + ry * 0.95 + 8, W - Math.max(base[0] + tw * 2, W * 0.2) - 10]
  return { W, H, land, hook, rope: land ? H * 0.075 : H * 0.055, lr, c, rx, ry, sw, feet, sc, reach: rx * 1.65, text, base, tw, top }
}

/** Four stones of one size but their own character (w, h of the dome in the stone box). */
const DIMS: Pt[] = [[94, 52], [86, 60], [98, 50], [88, 57]]

/**
 * A stone of the arc (in the circle's stone box: viewBox -60 -70 120 90, foot on y = 0): dark by night; four washes of
 * lamplight (its left, right, top and the face toward you) mixed by where the pool is, its shadow thrown the other way.
 */
function stoneArt(k: number): SVGElement {
  const [w, hh] = DIMS[k]
  const pts = domePts(0, 0, w, hh, SEEDS[k], k % 2 ? 0.1 : -0.14)
  const d = `M${pts.map(P).join('L')}Q0 4 ${P(pts[0])}Z`
  const n = pts.length
  const r = rng(SEEDS[k] + 1)
  let moss = '', cun = ''
  for (let i = 0; i < 6; i++) {
    const [x, y] = pts[Math.round(n * (0.3 + r() * 0.4))]
    moss += blob(x + (r() - 0.5) * 8, y + 3, 4 + r() * 6, 2 + r() * 2, SEEDS[k] + i, 0.3, 8)
  }
  for (let i = 0; i < 5; i++) {
    const x = -w * 0.4 + r() * w * 0.8, y = -hh * (0.15 + r() * 0.45)
    cun += stroke([[x, y], [x + (r() - 0.5) * 4, y + hh * (0.12 + r() * 0.15)]], 1 + r() * 1.2, 0.2, 0.5, 0.1)
  }
  return s('g', { class: 't27l-st' },
    s('ellipse', { class: 't27l-st-sh', cx: 0, cy: 3, rx: w * 0.58, ry: 9 }),
    s('ellipse', { class: 't27l-st-contact', cx: 0, cy: 1.5, rx: w * 0.5, ry: 3.5 }),
    s('path', { class: 't27l-st-base', d, filter: 'url(#ink-rough)' }),
    s('path', { class: 't27l-st-l', d, fill: 'url(#t27l-litL)' }),
    s('path', { class: 't27l-st-r', d, fill: 'url(#t27l-litR)' }),
    s('path', { class: 't27l-st-t', d, fill: 'url(#t27l-litT)' }),
    s('path', { class: 't27l-st-f', d, fill: 'url(#t27l-litF)' }),
    s('path', { class: 't27l-st-cun', d: cun }),
    s('path', { class: 't27l-st-moss', d: moss, filter: 'url(#ink-wash)' }),
    s('path', { class: 't27l-st-rim', d: stroke(pts.slice(Math.round(n * 0.35), Math.round(n * 0.85)).map(([x, y]) => [x - 0.5, y + 1.2] as Pt), 1.6, 0.2, 0.3, 0.1) }),
    s('path', { class: 't27l-st-ink', d: stroke(pts.slice(0, Math.round(n * 0.45)), 2.2, 0.05, 0.3, 0.3) + stroke([[-w * 0.49, 0.5], [0, 3], [w * 0.49, 0.5]], 2, 0.1, 0.1, 0.4), filter: 'url(#ink-rough)' }))
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
/** Points along a polyline, densified (pines bend in elbows, not arcs). */
const dense = (pts: Pt[], k: number): Pt[] => pts.flatMap((p, i) => (i ? Array.from({ length: k }, (_, j) => {
  const a = pts[i - 1], t = (j + 1) / k
  return [a[0] + (p[0] - a[0]) * t, a[1] + (p[1] - a[1]) * t] as Pt
}) : [p]))

/**
 * The night behind (canvas, drawn once per size and theme): an old pine from the lower left, its long branch over the
 * top, needle clusters lit by the moon on their upper tips, a moss floor. Almost dark in both themes (dusk in light).
 */
function* paint(c2: CanvasRenderingContext2D, g: Geo, col: Col, dpr: number) {
  const { W, H, hook, tw, base, top } = g
  const r = rng(2770)
  c2.setTransform(dpr, 0, 0, dpr, 0, 0)
  c2.clearRect(0, 0, W, H)
  const fill = (d: string, color: RGB, a = 1) => {
    c2.globalAlpha = a
    c2.fillStyle = rgba(color)
    c2.fill(new Path2D(d))
  }
  const dark = col.dark
  // the dusk wash, the vignette and the moon's glow are the canvas element's CSS background (no full-canvas raster here)
  const mx = W * 0.86, my = g.land ? H * 0.13 : H * 0.08
  fill(blob(mx, my, Math.min(W, H) * 0.035, Math.min(W, H) * 0.035, 2771, 0.02, 20), col.moon, 0.95)
  yield
  // far: a low ridge in mist, its foot fading into the haze
  const hz = H * (g.land ? 0.48 : 0.42)
  let ridge = `M-10 ${f1(hz + H * 0.08)}`
  for (let x = -10; x <= W + 10; x += 10) ridge += `L${f1(x)} ${f1(hz - Math.max(0, Math.sin(x * 0.005 + 1.4) * H * 0.07 + Math.sin(x * 0.019) * H * 0.018))}`
  ridge += `L${f1(W + 10)} ${f1(hz + H * 0.08)}Z`
  const rg = c2.createLinearGradient(0, hz - H * 0.08, 0, hz + H * 0.08)
  rg.addColorStop(0, rgba(col.wash, dark ? 0.5 : 0.3))
  rg.addColorStop(1, rgba(col.wash, 0))
  c2.globalAlpha = 1
  c2.fillStyle = rg
  c2.fill(new Path2D(ridge))
  yield
  // the moss ground: a soft dark bed, cushions of lighter moss, sparse tufts thinning out at its ragged edge
  const [cx, cy] = g.c
  const MX = g.rx * 1.45, MY = g.ry * 1.9, mcy = cy + g.ry * 0.2
  const bed = c2.createRadialGradient(cx, mcy, 0, cx, mcy, MX)
  bed.addColorStop(0, rgba(mix(col.mossB, col.wash, dark ? 0.35 : 0.3), dark ? 0.9 : 0.75))
  bed.addColorStop(0.6, rgba(mix(col.mossB, col.wash, dark ? 0.45 : 0.4), dark ? 0.55 : 0.45))
  bed.addColorStop(1, rgba(col.mossB, 0))
  c2.save()
  c2.translate(cx, mcy)
  c2.scale(1, MY / MX)
  c2.translate(-cx, -mcy)
  c2.globalAlpha = 1
  c2.fillStyle = bed
  c2.fill(new Path2D(blob(cx, mcy, MX, MX, 2772, 0.1, 40)))
  c2.restore()
  yield
  const tones = [col.mossA, col.mossC, mix(col.mossB, col.wash, 0.5)]
  const tuft = ['', '', '']
  for (let i = 0; i < (g.land ? 700 : 340); i++) {
    const a = r() * Math.PI * 2, q = Math.pow(r(), 0.6)
    const x = cx + Math.cos(a) * MX * q * (0.9 + r() * 0.2), y = mcy + Math.sin(a) * MY * q
    const near = clamp((y - (mcy - MY)) / (MY * 2), 0, 1)
    const l = (1.5 + r() * 3) * (0.5 + near)
    tuft[i % 3] += stroke([[x, y], [x + (r() - 0.5) * l * 0.8, y - l]], 0.8 + near, 0.1, 0.5, 0.3)
    if (i % 120 === 119) yield
  }
  tuft.forEach((d, i) => fill(d, tones[i], dark ? 0.4 : 0.32))
  yield
  // fallen needles scattered on the moss
  let fallen = ''
  for (let i = 0; i < (g.land ? 50 : 26); i++) {
    const a = r() * Math.PI * 2, q = Math.sqrt(r())
    const x = cx + Math.cos(a) * MX * q * 0.9, y = mcy + Math.sin(a) * MY * q * 0.9, l = 5 + r() * 9, ang = r() * Math.PI
    fallen += stroke([[x, y], [x + Math.cos(ang) * l, y + Math.sin(ang) * l * 0.4]], 0.9, 0.2, 0.3, 0.3)
  }
  fill(fallen, mix(col.bark, col.moon, dark ? 0.15 : 0.1), dark ? 0.5 : 0.35)
  yield
  // a round limb in three tones across its width (shade left of travel or below, bark, moonlit side), plates, a moon rim
  const lit = mix(col.bark, col.moon, dark ? 0.32 : 0.42)
  const limb = (pts: Pt[], wid: (t: number) => number, seed: number, litSide: 1 | -1, plates: number) => {
    const o = (v: number) => v * litSide
    fill(ribbon(pts, wid, -0.5, 0.5, seed), col.wash, dark ? 0.96 : 0.88)
    fill(ribbon(pts, wid, o(-0.22), o(0.5), seed), col.bark, dark ? 0.9 : 0.85)
    fill(ribbon(pts, wid, o(0.12), o(0.47), seed + 1), lit, dark ? 0.55 : 0.6)
    fill(ribbon(pts, wid, o(-0.5), o(-0.3), seed + 2), col.wash, dark ? 0.7 : 0.55)
    // bark plates: fissures along the limb, short cracks across it, little moonlit lips on the lit side
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
    fill(ribbon(pts, wid, o(0.4), o(0.5), seed + 3), col.moon, dark ? 0.45 : 0.55)
  }
  // roots: from the trunk's foot, low over the ground, sinking into the moss
  for (let i = 0; i < 3; i++) {
    const dir = i === 0 ? -1 : 1
    const len = W * (g.land ? 0.05 + i * 0.03 : 0.07 + i * 0.04)
    const end: Pt = [base[0] + len * dir, base[1] + H * (0.03 + i * 0.012)]
    const w0 = tw * (0.6 - i * 0.12)
    limb(curve([base[0] + dir * tw * 0.3, base[1] - tw * 0.3], [base[0] + len * dir * 0.5, base[1] - H * 0.005], end, 14), (t) => w0 * (1 - t * 0.85), 30 + i, dir > 0 ? -1 : 1, 6)
  }
  yield
  // the trunk: an old pine bending up from the lower left, thick at the foot, tapering into the branch
  const trunk = [...curve([base[0] - tw * 0.3, H + 40], [base[0] + tw * 1.4, H * 0.66], [top[0] - tw * 0.2, H * 0.4], 18), ...curve([top[0] - tw * 0.2, H * 0.4], [top[0] - tw * 1.3, H * 0.2], top, 12).slice(1)]
  limb(trunk, (t) => tw * (1.25 - t * 0.5), 11, 1, g.land ? 90 : 55)
  yield
  // the long branch: out of the trunk's top in a few elbows, tapering to the hook and past it
  const span = hook[0] - top[0]
  const knots: Pt[] = [top, [top[0] + span * 0.18, top[1] + H * 0.045], [top[0] + span * 0.45, hook[1] - H * 0.03], [top[0] + span * 0.74, hook[1] - H * 0.005], [hook[0], hook[1] - H * 0.02], [hook[0] + W * 0.07, hook[1] - H * 0.045]]
  const branch = dense(knots, 6)
  const bw = (t: number) => tw * (0.62 - t * 0.5)
  limb(branch, bw, 21, -1, g.land ? 40 : 24)
  yield
  // needle clusters: fans of strokes from a twig's end (upper fans, a few drooping), massed into flat cloud pads;
  // the upper-right tips catch the moon
  const pads: [number, number, number][] = [[0.04, -1, 1.25], [0.2, 1, 1.05], [0.32, -1, 1.3], [0.5, -1, 1.1], [0.6, 1, 0.85], [0.74, -1, 1], [0.9, -1, 0.75], [1, 1, 0.55]]
  const unit = g.land ? H * 0.16 : W * 0.21
  const needle = mix(col.bark, col.moon, dark ? 0.12 : 0.2)
  for (const [t, side, k] of pads) {
    const i = Math.round(t * (branch.length - 1))
    const [bx, by] = branch[i]
    const pw = unit * k
    const px = bx + (r() - 0.4) * pw * 0.4, py = by + side * pw * (side < 0 ? 0.2 : 0.16)
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
      for (let j = 0; j < 5; j++) {
        const a = Math.PI * (0.15 + r() * 0.7), l = R * (0.3 + r() * 0.3)
        nd += stroke([[fx, fy], [fx + Math.cos(a) * l, fy + Math.sin(a) * l * 0.7]], 0.8, 0.05, 0.5, 0.15)
      }
    }
    fill(mass, mix(col.bark, col.wash, 0.5), dark ? 0.6 : 0.5)
    fill(twig, col.bark, 0.95)
    fill(nd, col.wash, dark ? 0.95 : 0.9)
    fill(ndLit, needle, dark ? 0.9 : 0.85)
    fill(rim, col.moon, dark ? 0.75 : 0.9)
    yield
  }
  // the hook: a short twig where the cord is tied
  fill(stroke([[hook[0] + W * 0.02, hook[1] - H * 0.02], [hook[0] + 2, hook[1] - 2], [hook[0], hook[1]]], 3, 0.1, 0.3, 0.4), col.bark, 1)
  c2.globalAlpha = 1
}

/** Scene 2 — a paper lantern on a pine branch that always agrees: it leans after you; bring it to a stone to hear it. */
export const lampScene = {
  label: S.label,
  mount(ctx: SceneCtx) {
    let G: Geo | null = null
    let api: { pick(k: number): void } | null = null
    let root: HTMLElement | null = null
    let heard = -1
    let all = false
    const got = new Set<number>()
    const lowish = ctx.quality === 'low' || ctx.reduced
    const cv = h('canvas', { class: 't27l-cv', 'aria-hidden': 'true' })
    const c2 = cv.getContext('2d')!
    const pool = h('div', { class: 't27l-pool', 'aria-hidden': 'true' })
    const q = h('p', { class: 't27l-q' }, S.question)
    const body = s('svg', { class: 't27l-body', viewBox: '-60 -84 120 168', 'aria-hidden': 'true' })
    const lamp = h('div', { class: 't27l-lamp' }, h('i', { class: 't27l-cord' }), h('div', { class: 't27l-paper' }, body, q))
    const stop = (o: number, c: string, a = 1) => s('stop', { offset: o, style: `stop-color:${c};stop-opacity:${a}` })
    const defs = s('svg', { width: 0, height: 0, 'aria-hidden': 'true', style: 'position:absolute' }, s('defs', null,
      s('linearGradient', { id: 't27l-litL', x1: 0, y1: 0, x2: 1, y2: 0.3 }, stop(0, 'var(--lantern)', 0.95), stop(0.65, 'var(--lantern)', 0)),
      s('linearGradient', { id: 't27l-litR', x1: 1, y1: 0, x2: 0, y2: 0.3 }, stop(0, 'var(--lantern)', 0.95), stop(0.65, 'var(--lantern)', 0)),
      s('linearGradient', { id: 't27l-litT', x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, 'var(--lantern)', 0.85), stop(0.7, 'var(--lantern)', 0)),
      s('linearGradient', { id: 't27l-litF', x1: 0, y1: 1, x2: 0, y2: 0 }, stop(0, 'var(--lantern)', 0.9), stop(0.75, 'var(--lantern)', 0)),
      // the paper: hot where the flame is (low centre), lantern orange, deeper and browner where it curves away
      s('radialGradient', { id: 't27l-paperG', cx: 0.5, cy: 0.6, r: 0.6, fx: 0.47, fy: 0.62 },
        stop(0, 'var(--moon)'), stop(0.22, 'color-mix(in srgb, var(--moon) 45%, var(--lantern))'), stop(0.62, 'var(--lantern)'),
        stop(0.9, 'color-mix(in srgb, var(--lantern) 70%, var(--umbra))'), stop(1, 'color-mix(in srgb, var(--lantern) 55%, var(--umbra))')),
      s('radialGradient', { id: 't27l-core', cx: 0.5, cy: 0.5, r: 0.5 }, stop(0, 'var(--moon)', 0.95), stop(0.4, 'var(--moon)', 0.5), stop(1, 'var(--lantern)', 0)),
      s('radialGradient', { id: 't27l-inner', cx: 0.5, cy: 0.5, r: 0.5 }, stop(0, 'var(--lantern)', 0.75), stop(0.5, 'var(--lantern)', 0.25), stop(1, 'var(--lantern)', 0))))
    // the lantern body: bamboo hoops with the paper bellying between them (each band shaded at its hoops), faint seams of
    // the paper panels, the wire frame and the candle seen through it, a hot core, lacquered caps, a cold moon edge
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
    const frame = stroke([[0, -66], [0, 34]], 1.6, 0.1, 0.1, 0.5) + 'M-9 50h18l-3 -14h-12Z'
    body.append(
      s('ellipse', { class: 't27l-halo', cx: 0, cy: 6, rx: 150, ry: 170, fill: 'url(#p2-lamp)' }),
      s('ellipse', { class: 't27l-halo t27l-halo-in', cx: 0, cy: 8, rx: 84, ry: 96, fill: 'url(#t27l-inner)' }),
      s('ellipse', { class: 't27l-paper-b', cx: 0, cy: 0, rx: 56, ry: 72, fill: 'url(#t27l-paperG)' }),
      s('path', { class: 't27l-frame', d: frame }),
      s('ellipse', { class: 't27l-core', cx: 0, cy: 26, rx: 30, ry: 34, fill: 'url(#t27l-core)' }),
      s('path', { class: 't27l-band', d: bands, filter: 'url(#ink-wash)' }),
      s('path', { class: 't27l-seam', d: seams }),
      s('path', { class: 't27l-rib', d: hoops }),
      s('path', { class: 't27l-limb', d: 'M0 -72A56 72 0 1 1 0 72A56 72 0 1 1 0 -72ZM0 -66A51 66 0 1 0 0 66A51 66 0 1 0 0 -66Z' }),
      s('path', { class: 't27l-cap', d: 'M-26 -81h52l-3 12h-46zM-29 69h58l-3 12h-52z', filter: 'url(#ink-rough)' }),
      s('path', { class: 't27l-caphi', d: stroke([[-22, -79.5], [20, -79.5]], 1.4, 0.2, 0.2, 0.2) + stroke([[-25, 70.5], [24, 70.5]], 1.4, 0.2, 0.2, 0.2) }),
      s('path', { class: 't27l-rimline', d: stroke(Array.from({ length: 14 }, (_, i) => [Math.cos(-0.4 - i * 0.09) * 56, Math.sin(-0.4 - i * 0.09) * 72] as Pt), 2, 0.2, 0.3, 0.2) }))

    // ── the lantern's swing: a damped spring toward whoever is near; the pool of light slides under it ──
    const st = { a: 0, v: 0, tgt: 0, glow: 0.7, glowT: 0.7, dwell: 0, near: -1 }
    let stones: HTMLElement[] = []
    function apply() {
      if (!G) return
      const g = G
      const a = st.a
      lamp.style.transform = `translate3d(${f1(g.hook[0])}px,${f1(g.hook[1])}px,0) rotate(${(-a * 57.2958).toFixed(2)}deg)`
      const px = g.hook[0] + Math.sin(a) * g.reach, py = g.c[1] + g.ry * 0.05
      const bloom = all ? 1.6 : 1
      pool.style.transform = `translate3d(${f1(px - g.rx * 0.575)}px,${f1(py - g.ry * 0.62)}px,0) scale(${bloom})`
      pool.style.opacity = (0.35 + st.glow * 0.65).toFixed(3)
      lamp.style.setProperty('--glow', st.glow.toFixed(3))
      // each stone: the faces turned toward the pool lit (its side, its top, or the face toward you when the pool is in
      // front of it), its shadow thrown the other way, longer the brighter
      for (let k = 0; k < stones.length; k++) {
        const dx = (px - g.feet[k][0]) / g.rx, dy = (py - g.feet[k][1]) / g.ry
        const d = Math.hypot(dx, dy) || 1
        const ux = dx / d, uy = dy / d
        const I = all ? 0.6 : clamp(1.35 - d * 0.75, 0, 1) * (0.45 + st.glow * 0.55)
        const el = stones[k]
        el.style.setProperty('--l', (I * Math.max(0.12, -ux)).toFixed(3))
        el.style.setProperty('--r', (I * Math.max(0.12, ux)).toFixed(3))
        el.style.setProperty('--f', (I * Math.max(0, uy)).toFixed(3))
        el.style.setProperty('--t', (I * (0.35 + 0.45 * Math.max(0, -uy))).toFixed(3))
        el.style.setProperty('--sx', f1(-ux * 30 * (0.4 + I)))
        el.style.setProperty('--sy', f1(-uy * 9 * (0.4 + I)))
        el.style.setProperty('--sl', I.toFixed(3))
      }
    }
    const loop = createLoop(ctx.art, (_t, dt) => {
      if (dt > 0) {
        const acc = -15 * (st.a - st.tgt) - 3.4 * st.v
        st.v += acc * dt
        st.a += st.v * dt
        st.glow += (st.glowT - st.glow) * (1 - Math.exp(-dt * 4))
      }
      apply()
      // guiding the pool onto a stone and holding it there a moment: that stone speaks
      if (G && !all && dt > 0) {
        const px = G.hook[0] + Math.sin(st.a) * G.reach
        let k = -1
        G.feet.forEach(([x], i) => Math.abs(px - x) < G!.sw * 0.4 && (k = i))
        if (k >= 0 && k !== heard) {
          st.dwell = k === st.near ? st.dwell + dt : 0
          st.near = k
          if (st.dwell > 0.45) api?.pick(k)
        } else st.dwell = 0
      }
      return Math.abs(st.v) > 0.002 || Math.abs(st.a - st.tgt) > 0.002 || Math.abs(st.glow - st.glowT) > 0.004 || st.dwell > 0
    })
    ctx.onCleanup(() => loop.dispose())
    const aimAt = (a: number, glow = st.glowT) => {
      st.tgt = clamp(a, -0.62, 0.62)
      st.glowT = glow
      if (lowish) {
        st.a = st.tgt
        st.glow = st.glowT
        apply()
      } else loop.start()
    }
    const angleTo = (k: number) => (G ? Math.asin(clamp((G.feet[k][0] - G.hook[0]) / G.reach, -1, 1)) : 0)

    let hold: { x: number; y: number } | null = null
    let rect: DOMRect | null = null
    const follow = (e: PointerEvent) => {
      if (!G || all || lowish) return
      if (hold) {
        if (Math.hypot(e.clientX - hold.x, e.clientY - hold.y) < 50) return
        hold = null
      }
      rect ??= ctx.art.getBoundingClientRect()
      const x = e.clientX - rect.left, y = e.clientY - rect.top
      const lx = G.hook[0] + Math.sin(st.a) * G.rope * 2, ly = G.hook[1] + G.rope * 2
      const near = 1 - clamp(Math.hypot(x - lx, y - ly) / (G.W * 0.5), 0, 1)
      aimAt(Math.atan2(x - G.hook[0], Math.max(40, y - G.hook[1])) * 0.95, 0.45 + near * 0.55)
    }

    const def = perspectiveCircle(S.perspectives as Perspectives, {
      label: S.label, prompt: S.prompt, detail: F(S.insight),
      place: () => ({ x: 0, y: 0 }),
      stone: (k) => stoneArt(k),
      onHear: (k) => {
        heard = k
        got.add(k)
        st.dwell = 0
        hold = { x: -1e4, y: -1e4 }
        if (got.size === 4 && !all) {
          all = true
          return aimAt(0, 1)
        }
        if (!all) aimAt(angleTo(k), 1)
      },
      stage: (host, a) => {
        api = a
        root = host.closest('.p2c')
        root?.classList.add('t27l')
        if (lowish) root?.classList.add('is-calm')
        host.append(defs, cv, pool, lamp)
        a.onLayout(() => layout(host))
        // the whole scene is the lantern's room: it follows the mouse, or a finger dragged across it
        const onMove = (e: PointerEvent) => (e.pointerType === 'mouse' || e.buttons) && follow(e)
        ctx.art.addEventListener('pointermove', onMove)
        ctx.art.addEventListener('pointerdown', follow)
        ctx.art.addEventListener('pointerenter', () => void (rect = null))
        return () => {
          ctx.art.removeEventListener('pointermove', onMove)
          ctx.art.removeEventListener('pointerdown', follow)
        }
      },
    })

    // ── layout: the circle places its parts in a box; this scene spreads them over the whole art ──
    let job: { cancel(): void } | null = null
    let first = true
    let col = {} as Col
    const readCol = () => {
      const v = (n: string) => rgbOf(cssVar(n))
      const next: Col = { dark: document.documentElement.dataset.theme === 'dark', wash: v('--wash'), moon: v('--moon'), mossA: v('--moss-a'), mossB: v('--moss-b'), mossC: v('--moss-c'), bark: mix(v('--rock-lo'), v('--wash'), 0.45) }
      const changed = JSON.stringify(next) !== JSON.stringify(col)
      col = next
      return changed
    }
    function draw() {
      if (!G) return
      const dpr = Math.min(2, devicePixelRatio || 1)
      const g = G
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
    function layout(host: HTMLElement) {
      if (!root) return
      const W = ctx.art.clientWidth, H = parseFloat(root.style.height) || ctx.art.clientHeight
      const g = (G = geo(W, H))
      const stage = host.parentElement!
      Object.assign(stage.style, { left: '0px', top: '0px', width: `${W}px`, height: `${H}px` })
      Object.assign(cv.style, { width: `${W}px`, height: `${H}px` })
      Object.assign(pool.style, { width: `${f1(g.rx * 1.15)}px`, height: `${f1(g.ry * 1.25)}px` })
      const [lw, lh] = g.lr
      Object.assign(lamp.style, { width: `${f1(lw * 2)}px`, height: `${f1(g.rope + lh * 2)}px`, marginLeft: `${f1(-lw)}px` })
      lamp.style.setProperty('--rope', `${f1(g.rope)}px`)
      lamp.style.setProperty('--lw', `${f1(lw * 2)}px`)
      lamp.style.setProperty('--lh', `${f1(lh * 2)}px`)
      stones = [...root.querySelectorAll<HTMLElement>('.p2c-stone')]
      stones.forEach((b, k) => {
        const [x, y] = g.feet[k]
        const w = g.sw * g.sc[k], hh = (w * 90) / 120
        Object.assign(b.style, { left: `${f1(x - w / 2)}px`, top: `${f1(y - hh * (70 / 90))}px`, width: `${f1(w)}px`, height: `${f1(hh)}px`, zIndex: String(Math.round(y)) })
      })
      // the words lie on the ground: the card is tipped back in perspective, its top edge farthest away
      const card = root.querySelector<HTMLElement>('.p2c-card')
      if (card) {
        const [x, y, w] = g.text
        Object.assign(card.style, { left: `${f1(x)}px`, top: `${f1(y)}px`, width: `${f1(w)}px`, maxHeight: `${f1(Math.max(60, H - y))}px`, transform: `perspective(${f1(Math.max(600, w * 2.2))}px) rotateX(${g.land ? 26 : 18}deg)` })
      }
      readCol()
      draw()
      apply()
    }
    ctx.onCleanup(() => job?.cancel())
    ctx.onCleanup(onPrefs(() => readCol() && draw()))
    return def.mount(ctx)
  },
}
