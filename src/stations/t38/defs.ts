import './defs.css'
import { fill, h, nextId, s } from '../../core/dom'
import { L } from '../../core/content'
import { onPrefs } from '../../core/prefs'
import { sliced } from '../../core/chunk'
import { blob, clamp, onDigit, onSize, rng, seedOf, shuffledIdx, stableHeight, stroke, type Pt } from '../../ui/part2/ink'
import type { SceneDef } from '../types'
import { C } from './shell'
import { pine, toro } from '../../ui/part2/paint'
import { brush, canvas, col, dprOf, fit, glow, grainOver, inkHills, mistBank, mix, moonDisc, paintRock, palette, sky, type Pal } from './ink2d'

const D = C.scenes.defs
const P = D.perspectives
const f1 = (n: number) => n.toFixed(1)
const ell = (cx: number, cy: number, rx: number, ry: number) => `M${f1(cx - rx)} ${f1(cy)}a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(rx * 2)} 0a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(-rx * 2)} 0Z`
const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 16): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]
  })

/**
 * The vessel each definition stands in (JSON order of the views) and the moon it shows once water is poured:
 * OpenAI → a celadon tea bowl, a coin with a square hole (work that pays); DeepMind → a split-bamboo trough, a ladder
 * (levels); Hendrycks & co → a bronze basin, a ten-spoke wheel inked to 27 % then 57 % (a radar chart in the water);
 * Microsoft & OpenAI → a stone tsukubai, the council's vermilion seal (the scene's one vermilion point).
 * Box: viewBox −64 −62 128 96, foot on y = 0 (the carved name stone is HTML, in front). `vis` = the vessel's own
 * width in box units (sizes are set by it), `w` = its water surface.
 */
const BOX = [-64, -62, 128, 96]
const VESSELS = [
  { kind: 'bowl', vis: 92, w: [0, -35.4, 40.5, 8.7] },
  { kind: 'trough', vis: 104, w: [0, -21.7, 47, 5.8] },
  { kind: 'basin', vis: 101, w: [0, -28.6, 45, 11.2] },
  { kind: 'tsukubai', vis: 97, w: [0, -36.7, 29, 7.8] },
] as const
/** the wheel's ten spokes (Hendrycks et al.: ten cognitive areas, 10 % each): an illustrative uneven profile averaging 0.57 */
const SPOKES = [0.82, 0.74, 0.66, 0.38, 0.62, 0.7, 0.44, 0.5, 0.36, 0.48]

function sign(kind: string, cx: number, cy: number, rx: number, ry: number): SVGElement {
  const k = ry / rx // reflections lie flat: squash the sign to the water's ellipse
  if (kind === 'bowl') {
    const r = rx * 0.5
    return s('g', { class: 't38d-sign' },
      s('path', { class: 't38d-moonlit', d: ell(cx, cy, r, r * k * 1.1) }),
      s('path', { class: 't38d-cut', d: `M${f1(cx - r * 0.3)} ${f1(cy - r * k * 0.32)}h${f1(r * 0.6)}v${f1(r * k * 0.64)}h${f1(-r * 0.6)}Z` }),
      s('path', { class: 't38d-lit', d: stroke(Array.from({ length: 21 }, (_, i) => [cx + Math.cos((i / 20) * Math.PI * 2) * r * 0.78, cy + Math.sin((i / 20) * Math.PI * 2) * r * k * 0.86] as Pt), 0.8, 0.05, 0.05, 0.5) }))
  }
  if (kind === 'trough') {
    // a ladder lying along the trough's water: two rails, rungs (the levels)
    let rungs = ''
    for (let i = 0; i < 8; i++) {
      const x = cx - rx * 0.72 + (rx * 1.44 * i) / 7
      rungs += `M${f1(x)} ${f1(cy - ry * 0.46)}V${f1(cy + ry * 0.46)}`
    }
    return s('g', { class: 't38d-sign' },
      s('path', { class: 't38d-moonlit', d: ell(cx, cy, rx * 0.84, ry * 0.7) }),
      s('path', { class: 't38d-rung', d: rungs }),
      s('path', { class: 't38d-rail', d: `M${f1(cx - rx * 0.8)} ${f1(cy - ry * 0.46)}H${f1(cx + rx * 0.8)}M${f1(cx - rx * 0.8)} ${f1(cy + ry * 0.46)}H${f1(cx + rx * 0.8)}` }))
  }
  if (kind === 'basin') {
    const R = rx * 0.64
    const pt = (i: number, v: number): Pt => {
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2
      return [cx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v * k]
    }
    let spokes = ''
    for (let i = 0; i < 10; i++) spokes += `M${f1(cx)} ${f1(cy)}L${pt(i, 1).map(f1).join(' ')}`
    const poly = (sc: number) => `M${SPOKES.map((v, i) => pt(i, v * sc).map(f1).join(' ')).join('L')}Z`
    return s('g', { class: 't38d-sign' },
      s('path', { class: 't38d-moonlit', d: ell(cx, cy, R, R * k) }),
      s('path', { class: 't38d-spoke', d: spokes }),
      s('path', { class: 't38d-radar was', d: poly(0.47) }),
      s('path', { class: 't38d-radar now', d: poly(1) }))
  }
  // the council's seal: a square vermilion stamp, carved with a cross of white lines
  const w = rx * 0.64
  return s('g', { class: 't38d-sign' },
    s('path', { class: 't38d-moonlit', d: ell(cx, cy, rx * 0.84, ry * 0.8) }),
    s('path', { class: 't38d-seal', d: `M${f1(cx - w / 2)} ${f1(cy - w * k * 0.62)}l${f1(w)} ${f1(-w * 0.04)}l${f1(w * 0.03)} ${f1(w * k * 1.22)}l${f1(-w * 1.02)} ${f1(w * 0.03)}Z` }),
    s('path', { class: 't38d-seal-cut', d: `M${f1(cx)} ${f1(cy - w * k * 0.48)}V${f1(cy + w * k * 0.5)}M${f1(cx - w * 0.36)} ${f1(cy)}H${f1(cx + w * 0.36)}` }))
}

/** One vessel (view i), its water with the moon in it, and its name stone, in the box. */
function vessel(i: number, seed: number): SVGElement {
  const V = VESSELS[i]
  const [wx, wy, wrx, wry] = V.w
  const r = rng(seed)
  const parts: (SVGElement | string)[] = [
    s('ellipse', { class: 't38d-sel', cx: 0, cy: -22, rx: 62, ry: 40 }),
    s('ellipse', { class: 't38d-contact', cx: 3, cy: 0.6, rx: V.kind === 'bowl' ? 22 : V.kind === 'trough' ? 50 : 42, ry: 3.6 }),
  ]
  const body = (d: string, grad: string) => [s('path', { class: 't38d-body', d, fill: `url(#t38d-g-${grad})` }), s('path', { class: 't38d-shade', d })]
  // an ink stroke down the shaded side (no outline: the form is held by its tones)
  const inkSide = (pts: Pt[], w: number) => s('path', { class: 't38d-inkside', d: stroke(pts, w, 0.1, 0.5, 0.15) })
  const glaze = (pts: Pt[], w: number, gx: number, gy: number) => [
    s('path', { class: 't38d-glaze', d: stroke(pts, w, 0.3, 0.4, 0.1) }),
    s('ellipse', { class: 't38d-glint', cx: gx, cy: gy, rx: w * 0.42, ry: w * 0.85, transform: `rotate(-24 ${gx} ${gy})` }),
  ]
  const lip = (cy: number, rx: number, ry: number, grad: string, hol: number) => [
    s('path', { class: 't38d-lip', d: ell(0, cy, rx, ry), fill: `url(#t38d-g-${grad})` }),
    s('path', { class: 't38d-hollow', d: ell(0, cy + 0.4, rx - hol, ry - hol * 0.3) }),
    // the moon low on the left lights the lip's back edge (and grazes its near left)
    s('path', { class: 't38d-rim', d: stroke(arc(0, cy, rx - 0.6, ry - 0.4, 192, 292), 1.7, 0.2, 0.3, 0.1) }),
    s('path', { class: 't38d-rim soft', d: stroke(arc(0, cy, rx - 0.4, ry - 0.2, 118, 172, 10), 1.2, 0.3, 0.3, 0.1) }),
  ]
  if (V.kind === 'bowl') {
    const d = 'M-46 -36C-45 -15-29 -4-15 -3L-15 0H15V-3C29 -4 45 -15 46 -36Z'
    parts.push(...body(d, 'celadon'),
      s('path', { class: 't38d-foot', d: 'M-15 -3.4H15V0H-15Z' }),
      inkSide([[45, -30], [33, -10], [16, -3.4]], 1.8),
      ...glaze([[-39, -29], [-34, -17], [-24, -9]], 4.4, -37.5, -25),
      // a fine crackle in the glaze
      s('path', { class: 't38d-crackle', d: 'M-30 -24l4 3 2 6M-12 -16l3 4-2 5M20 -22l-3 5 3 3M8 -10l4 3' }),
      ...lip(-36, 46, 11, 'celadon-lip', 3.6))
  } else if (V.kind === 'trough') {
    parts.push(
      s('path', { class: 't38d-stake', d: stroke([[-42, 0.5], [-31, -15]], 2.6, 0.1, 0.1, 0.6) + stroke([[-29, 0.5], [-40, -15]], 2.6, 0.1, 0.1, 0.6) + stroke([[30, 0.5], [41, -15]], 2.6, 0.1, 0.1, 0.6) + stroke([[43, 0.5], [32, -15]], 2.6, 0.1, 0.1, 0.6) }),
      ...body('M-52 -22Q-52 -8-45 -8H45Q52 -8 52 -22Z', 'bamboo'),
      s('path', { class: 't38d-node', d: 'M-17 -9V-21.2M23 -9V-21.2' }),
      s('path', { class: 't38d-node hi', d: 'M-16 -9.4V-21M24 -9.4V-21' }),
      inkSide([[51, -18], [46, -9], [30, -8.2]], 1.5),
      ...glaze([[-47, -16.5], [-10, -16.8], [36, -16.2]], 2.2, -40, -16.6),
      ...lip(-22, 52, 7.4, 'bamboo-lip', 3.2),
      s('path', { class: 't38d-bamboo-end', d: ell(-51.6, -15.5, 2.6, 7.2) + ell(51.6, -15.5, 2.6, 7.2) }),
      s('path', { class: 't38d-bamboo-in', d: ell(-51.6, -15.5, 1.3, 5.2) + ell(51.6, -15.5, 1.3, 5.2) }))
  } else if (V.kind === 'basin') {
    parts.push(
      s('path', { class: 't38d-legs', d: stroke([[-28, -9], [-31, 0]], 3.4, 0.1, 0.1, 0.7) + stroke([[28, -9], [31, 0]], 3.4, 0.1, 0.1, 0.7) + stroke([[2, -8], [2, 1.5]], 3.6, 0.1, 0.1, 0.7) }),
      ...body('M-50 -29C-48 -15-37 -8-25 -7H25C37 -8 48 -15 50 -29Z', 'bronze'),
      s('path', { class: 't38d-patina', d: blob(-30, -16, 7, 3, seed + 3, 0.3, 10) + blob(20, -12, 9, 2.4, seed + 4, 0.3, 10) + blob(38, -19, 4, 2, seed + 5, 0.3, 8) }),
      s('path', { class: 't38d-band', d: stroke(arc(0, -24.5, 47.5, 9.6, 12, 168, 18), 1.1, 0.1, 0.1, 0.4) }),
      inkSide([[49, -24], [40, -11], [25, -7.2]], 1.7),
      ...glaze([[-45, -24], [-36, -14], [-22, -9.6]], 3.4, -42, -21),
      ...lip(-29, 50.5, 13.2, 'bronze-lip', 3.4))
  } else {
    const d = 'M-47 -37C-50 -20-40 -3-21 -0.5H21C40 -3 50 -20 47 -37Z'
    let speck = ''
    let pale = ''
    for (let k = 0; k < 46; k++) {
      const x = (r() - 0.5) * 84, y = -34 + r() * 32
      if (Math.abs(x) > 44 - (y + 34) * 0.55) continue
      if (r() < 0.6) speck += ell(x, y, 0.5 + r() * 0.5, 0.4 + r() * 0.3)
      else pale += ell(x, y, 0.5 + r() * 0.4, 0.4 + r() * 0.3)
    }
    parts.push(...body(d, 'granite'),
      s('path', { class: 't38d-speck', d: speck }),
      s('path', { class: 't38d-speck pale', d: pale }),
      s('path', { class: 't38d-chisel', d: stroke([[-36, -28], [-30, -24]], 1, 0.3, 0.3, 0.1) + stroke([[-20, -14], [-12, -11]], 0.9, 0.3, 0.3, 0.1) + stroke([[14, -24], [24, -20]], 1, 0.3, 0.3, 0.1) }),
      inkSide([[47, -32], [38, -12], [21, -1]], 2),
      s('path', { class: 't38d-lip', d: blob(0, -37, 48, 13.5, seed, 0.03, 26), fill: 'url(#t38d-g-granite-top)' }),
      s('path', { class: 't38d-rim', d: stroke(arc(0, -37, 47, 12.8, 192, 290), 1.8, 0.2, 0.3, 0.1) }),
      s('path', { class: 't38d-moss', d: blob(-36, -40, 8, 3.4, seed + 5, 0.3, 12) + blob(-42, -28, 4, 6, seed + 6, 0.3, 10) }),
      s('path', { class: 't38d-hollow', d: ell(0, -36.4, 31.4, 8.8) }),
      s('path', { class: 't38d-rim soft', d: stroke(arc(0, -36.4, 31, 8.6, 20, 160, 12), 1, 0.3, 0.3, 0.1) }))
  }
  // the water: sky at the back, the moon's disc and its halo (before), the definition's sign (after), ripples
  const cid = nextId('t38d-w')
  const mr = Math.min(wrx * 0.3, wry * 2.2), mry = Math.min(wry * 0.72, mr * 0.52)
  const mx = wx - wrx * 0.2, my = wy - wry * 0.1
  parts.push(s('g', { class: 't38d-water' },
    s('clipPath', { id: cid }, s('path', { d: ell(wx, wy, wrx, wry) })),
    s('path', { class: 't38d-surface', d: ell(wx, wy, wrx, wry) }),
    s('g', { 'clip-path': `url(#${cid})` },
      s('path', { class: 't38d-sky', d: ell(wx, wy - wry * 0.9, wrx * 1.1, wry * 0.55) }),
      s('ellipse', { class: 't38d-halo', cx: f1(mx), cy: f1(my), rx: f1(mr * 2.3), ry: f1(mry * 2.3) }),
      s('ellipse', { class: 't38d-disc', cx: f1(mx), cy: f1(my), rx: f1(mr), ry: f1(mry) }),
      s('path', { class: 't38d-glints', d: `M${f1(mx - mr * 1.2)} ${f1(my + mry * 1.5)}h${f1(mr * 0.9)}M${f1(mx + mr * 0.2)} ${f1(my + mry * 1.9)}h${f1(mr * 1.3)}M${f1(mx - mr * 0.5)} ${f1(my + mry * 2.4)}h${f1(mr * 0.7)}` }),
      sign(V.kind, wx, wy, wrx, wry),
      ...[0, 1, 2].map((k) => s('path', { class: 't38d-rip', style: `--k:${k}`, d: ell(wx, wy, wrx * 0.5, wry * 0.5) }))),
    // the meniscus: a thread of light along the water's near edge
    s('path', { class: 't38d-meniscus', d: stroke(arc(wx, wy, wrx - 0.5, wry - 0.3, 25, 155, 12), 0.9, 0.3, 0.3, 0.1) })))
  parts.push(s('path', { class: 't38d-pour', d: `M${f1(wx - 3)} -64Q${f1(wx - 1.5)} ${f1(wy - 18)} ${f1(wx)} ${f1(wy)}` }))
  return s('svg', { class: `t38d-art t38d-${V.kind}`, viewBox: BOX.join(' '), 'aria-hidden': 'true' }, ...parts)
}

type Foot = { x: number; y: number; vw: number }
/** The world (px) for a stage W × H: vessels along the veranda's edge receding to the dawn (near = big; the far one
 *  stays ≥ ~120 px wide so its water reads); the world runs 32 % below the frame so the camera can lift. */
function worldOf(W: number, H: number) {
  const wide = W / H > 1.15
  const Hw = Math.round(H * 1.32)
  const F: Foot[] = wide
    ? [[0.165, 0.75, 0.4, 0], [0.385, 0.615, 0.32, 0], [0.56, 0.515, 0.265, 136], [0.71, 0.44, 0.225, 126]].map(([x, y, w, m]) => ({ x: W * x, y: H * y, vw: Math.max(H * w, m) }))
    : [[0.34, 0.86, 0.42], [0.5, 0.67, 0.34], [0.62, 0.505, 0.28], [0.72, 0.355, 0.24]].map(([x, y, w]) => ({ x: W * x, y: H * y, vw: W * w }))
  // the name stone's carved letters: px, from near to far
  const nf = F.map((f) => clamp(f.vw * (wide ? 0.07 : 0.09), 12, 16))
  return { W, H, Hw, wide, hz: H * (wide ? 0.35 : 0.24), F, nf, nx: wide ? 0.1 : 0.26 }
}
type World = ReturnType<typeof worldOf>

/** The painting behind the vessels: dawn sky, the moon going down on the left, a garden in mist, the veranda full width. */
function paintStage(g: CanvasRenderingContext2D, p: Pal, Wd: World) {
  const { W, H, Hw, hz, F, wide } = Wd
  sky(g, p, W, Hw, hz, W * 0.96, 0.9)
  const mr = clamp(H * (wide ? 0.05 : 0.04), 13, 32)
  const mx = W * (wide ? 0.085 : 0.15), my = hz - mr * 0.35
  moonDisc(g, p, mx, my, mr, 3881, 1.15)
  inkHills(g, p, -W * 0.05, W * 1.05, hz + 2, H * 0.13, 3882, 0.9, wide ? 6 : 4)
  mistBank(g, p, W * 0.5, hz + 2, W * 0.7, H * 0.05, 1)
  inkHills(g, p, W * 0.16, W * 0.72, hz + H * 0.03, H * 0.11, 3883, 0.6, 3, -1)
  // the garden below: sand toward the mist, raked rows, mossy rocks, a lit lantern far right
  const gg = g.createLinearGradient(0, hz, 0, Hw)
  const sand = p.dark ? mix(p.paper, p['rock-lo'], 0.35) : mix(p.paper, p['rock-hi'], 0.5)
  gg.addColorStop(0, col(p.dark ? mix(p.paper, p.mist, 0.12) : p.mist, 0))
  gg.addColorStop(0.12, col(sand, 0.85))
  gg.addColorStop(1, col(sand))
  g.fillStyle = gg
  g.fillRect(0, hz + H * 0.02, W, Hw)
  for (let i = 1; i < 16; i++) {
    const t = Math.pow(i / 16, 1.6), y = hz + H * 0.03 + H * 0.6 * t
    brush(g, [[0, y], [W * 0.5, y + 2], [W, y - 1]], 0.6 + t * 1.2, col(p.dark ? p.umbra : p.wash, (p.dark ? 0.3 : 0.08) * Math.min(1, t * 3)), 0.3, 0.3, 0.15)
  }
  if (wide) {
    paintRock(g, p, W * 0.27, hz + H * 0.16, H * 0.12, H * 0.055, 3885, { light: -1, moss: 0.8, cast: 0.6 })
    paintRock(g, p, W * 0.47, hz + H * 0.095, H * 0.075, H * 0.035, 3886, { light: -1, moss: 0.6, cast: 0.6 })
  } else paintRock(g, p, W * 0.28, hz + H * 0.09, H * 0.08, H * 0.036, 3885, { light: -1, moss: 0.8, cast: 0.6 })
  glow(g, W * (wide ? 0.87 : 0.9), hz + H * 0.03, H * 0.12, H * 0.12, p.lantern, p.dark ? 0.35 : 0.25, 0.3)
  // the veranda: its edge runs through the vessels' feet, from beyond the left frame into the dawn fog on the right
  const a = F[0], b = F[F.length - 1]
  const slope = (b.y - a.y) / (b.x - a.x)
  const ey = (x: number) => a.y + (x - a.x) * slope
  const vp: Pt = [W * 1.3, ey(W * 1.3)]
  const floor = new Path2D()
  floor.moveTo(-4, ey(-4))
  floor.lineTo(W + 4, ey(W + 4))
  floor.lineTo(W + 4, Hw + 4)
  floor.lineTo(-4, Hw + 4)
  floor.closePath()
  const wood = p.dark ? mix(p['step-lo'], p.lantern, 0.1) : mix(p['step-hi'], p.lantern, 0.2)
  const fg = g.createLinearGradient(W * 0.55, ey(W * 0.55), W * 0.5, Hw)
  fg.addColorStop(0, col(mix(wood, p.dark ? p['step-mid'] : p['step-hi'], 0.3)))
  fg.addColorStop(0.45, col(wood))
  fg.addColorStop(1, col(mix(wood, p.umbra, p.dark ? 0.62 : 0.34)))
  g.fillStyle = fg
  g.fill(floor)
  g.save()
  g.clip(floor)
  const r = rng(3887)
  // board seams fan out from the vanishing point toward the near frame; grain along them
  for (let i = 1; i < 16; i++) {
    const t = i / 15
    const end: Pt = [W * 1.2 - W * 2.1 * Math.pow(t, 1.25), Hw + 4]
    brush(g, [vp, end], 0.6 + t * 1.8, col(p.dark ? p.umbra : p.wash, p.dark ? 0.45 : 0.2), 0.05, 0.05, 0.6)
    brush(g, [[vp[0], vp[1] + 1], [end[0] + 2.5, end[1]]], 0.4 + t * 0.8, p.dark ? col(p.moon, 0.06) : col(p['rake-hi'], 0.6), 0.05, 0.05, 0.6)
    for (let k = 0; k < 6; k++) {
      const t0 = 0.25 + r() * 0.7, t1 = t0 + 0.03 + r() * 0.06, off = (r() - 0.5) * 0.04
      const e2: Pt = [end[0] + W * (0.06 + off) * (1 + t), end[1]]
      brush(g, [[vp[0] + (e2[0] - vp[0]) * t0, vp[1] + (e2[1] - vp[1]) * t0], [vp[0] + (e2[0] - vp[0]) * t1, vp[1] + (e2[1] - vp[1]) * t1]], 0.5 + t, col(p.dark ? p.umbra : p.wash, p.dark ? 0.22 : 0.07), 0.3, 0.3, 0.2)
    }
  }
  // the moon's sheen along the boards near the edge
  glow(g, W * 0.4, ey(W * 0.4) + H * 0.05, W * 0.45, H * 0.05, p.dark ? p.moon : p['step-hi'], p.dark ? 0.12 : 0.5, 0.5)
  // the vessels' long shadows across the boards, away from the moon
  for (const f of F) {
    glow(g, f.x + f.vw * 0.62, f.y + f.vw * 0.05, f.vw * 0.78, f.vw * 0.1, p.umbra, p.dark ? 0.6 : 0.26, 0.5)
    glow(g, f.x + f.vw * 0.08, f.y + f.vw * 0.01, f.vw * 0.55, f.vw * 0.05, p.umbra, p.dark ? 0.7 : 0.3, 0.5)
  }
  g.restore()
  // the edge: a moonlit lip, a dark line under it
  brush(g, [[-4, ey(-4)], [W + 4, ey(W + 4)]], 2.2, p.dark ? col(p.moon, 0.4) : col(p['rake-hi'], 1), 0.02, 0.02, 0.5)
  brush(g, [[-4, ey(-4) + 2.5], [W + 4, ey(W + 4) + 2.5]], 1.6, col(p.dark ? p.umbra : p.wash, p.dark ? 0.7 : 0.4), 0.02, 0.02, 0.5)
  // the far end of the veranda dissolves into the dawn fog
  const fogX = wide ? W * 0.74 : W * 0.6
  const fog = g.createLinearGradient(fogX, 0, W, 0)
  const fc = p.dark ? mix(p.paper, p.mist, 0.3) : p.mist
  fog.addColorStop(0, col(fc, 0))
  fog.addColorStop(0.55, col(fc, p.dark ? 0.4 : 0.6))
  fog.addColorStop(1, col(fc, p.dark ? 0.7 : 0.92))
  g.fillStyle = fog
  g.fillRect(fogX, 0, W - fogX, Hw)
  mistBank(g, p, W * 0.98, ey(W * 0.98), W * (wide ? 0.22 : 0.4), H * 0.2, 1.4)
  mistBank(g, p, W * 0.9, hz + H * 0.06, W * 0.3, H * 0.1, 1.2)
  grainOver(g, p, W, Hw)
  return { mx, my }
}

/** A slab's chipped outline as a clip-path polygon (rough corners, a nick or two along the edges). */
function chipped(r: () => number) {
  const c = () => `${f1(3 + r() * 6)}%`, e = () => `${f1(r() * 3)}%`
  return `polygon(${c()} 0, 38% ${e()}, 71% 0, calc(100% - ${c()}) ${e()}, 100% 30%, calc(100% - ${e()}) 72%, calc(100% - ${c()}) 100%, 55% calc(100% - ${e()}), 18% 100%, ${e()} calc(100% - ${c()}), 0 45%, ${e()} 12%)`
}

/** Scene 1 — four vessels on the veranda at moonset; each definition pours water in, and the moon shows its shape. */
export const defsScene: SceneDef = {
  label: D.label,
  mount(ctx) {
    const n = P.stones.length
    const order = shuffledIdx(n, seedOf(P.stones.map((x) => x.who).join('|'))) // order[k] = the view slot k (near → far) holds
    const stable = stableHeight(ctx, [P.common])
    const low = ctx.quality === 'low'
    const cv = canvas('t38d-cv')
    const garden = s('svg', { class: 't38d-garden', 'aria-hidden': 'true' })
    const mists = [0, 1, 2, 3].map((i) => h('div', { class: `t38d-mist m${i}`, 'aria-hidden': 'true' }, h('i'), h('i')))
    const threads = s('svg', { class: 't38d-threads', 'aria-hidden': 'true' })
    const stop = (o: number, c: string, a = 1) => s('stop', { offset: o, style: `stop-color:${c};stop-opacity:${a}` })
    const lin = (id: string, x2: number, y2: number, ...st: SVGElement[]) => s('linearGradient', { id: `t38d-g-${id}`, x1: 0, y1: 0, x2, y2 }, ...st)
    const defs = s('svg', { class: 't38d-defs', width: 0, height: 0, 'aria-hidden': 'true' }, s('defs', null,
      lin('celadon', 1, 0.25, stop(0, 'color-mix(in srgb, var(--moss-c) 45%, var(--rock-hi))'), stop(0.42, 'color-mix(in srgb, var(--moss-c) 78%, var(--rock-mid))'), stop(1, 'color-mix(in srgb, var(--moss-b) 70%, var(--umbra))')),
      lin('celadon-lip', 1, 0.3, stop(0, 'color-mix(in srgb, var(--moss-c) 35%, var(--rock-hi))'), stop(1, 'color-mix(in srgb, var(--moss-c) 70%, var(--rock-mid))')),
      lin('bamboo', 1, 0.2, stop(0, 'color-mix(in srgb, var(--moss-a) 55%, var(--lantern))'), stop(0.5, 'color-mix(in srgb, var(--moss-b) 70%, var(--lantern))'), stop(1, 'color-mix(in srgb, var(--moss-b) 60%, var(--umbra))')),
      lin('bamboo-lip', 1, 0.2, stop(0, 'color-mix(in srgb, var(--lantern) 45%, var(--step-hi))'), stop(1, 'color-mix(in srgb, var(--moss-a) 50%, var(--step-mid))')),
      lin('bronze', 1, 0.25, stop(0, 'color-mix(in srgb, var(--lantern) 55%, var(--rock-hi))'), stop(0.45, 'color-mix(in srgb, var(--lantern) 38%, var(--rock-mid))'), stop(1, 'color-mix(in srgb, var(--lantern) 14%, var(--umbra))')),
      lin('bronze-lip', 1, 0.3, stop(0, 'color-mix(in srgb, var(--lantern) 40%, var(--rock-hi))'), stop(1, 'color-mix(in srgb, var(--lantern) 35%, var(--rock-mid))')),
      lin('granite', 1, 0.25, stop(0, 'var(--rock-hi)'), stop(0.45, 'var(--rock-mid)'), stop(1, 'color-mix(in srgb, var(--rock-lo) 70%, var(--umbra))')),
      lin('granite-top', 1, 0.6, stop(0, 'var(--rock-hi)'), stop(1, 'color-mix(in srgb, var(--rock-hi) 55%, var(--rock-mid))')),
      lin('shade', 0, 1, stop(0, 'var(--umbra)', 0), stop(0.45, 'var(--umbra)', 0.04), stop(1, 'var(--umbra)', 0.42)),
      lin('water', 0, 1, stop(0, 'color-mix(in srgb, var(--water) 55%, var(--mist))'), stop(0.5, 'var(--water)'), stop(1, 'color-mix(in srgb, var(--water) 70%, var(--umbra))')),
      lin('slab', 0, 1, stop(0, 'var(--rock-mid)'), stop(1, 'color-mix(in srgb, var(--rock-lo) 80%, var(--umbra))')),
      s('radialGradient', { id: 't38d-g-halo' }, stop(0, 'var(--moon)', 0.75), stop(0.45, 'var(--moon)', 0.22), stop(1, 'var(--moon)', 0)),
      s('radialGradient', { id: 't38d-g-contact' }, stop(0, 'var(--umbra)', 0.75), stop(1, 'var(--umbra)', 0)),
      s('radialGradient', { id: 't38d-g-sel' }, stop(0, 'var(--lantern)', 0.4), stop(1, 'var(--lantern)', 0))))
    const r0 = rng(3889)
    const btns = order.map((vi, k) => h('button', {
      class: 't38d-v', type: 'button', style: `--k:${k}`, 'aria-pressed': 'false', 'aria-keyshortcuts': String(k + 1),
      'aria-label': fill(D.stoneAria, { who: P.stones[vi].who }), onClick: () => pick(k),
    }, vessel(vi, 3890 + vi * 17),
    // the low stone in front, the author's name cut into its face (a chipped slab, each a little different)
    h('span', { class: 't38d-name', 'aria-hidden': 'true', style: `--tilt:${f1((r0() - 0.5) * 3)}deg` },
      h('span', { class: 't38d-name-in', style: `clip-path:${chipped(r0)}` }, ...(D.names[vi] ?? '').split('\n').flatMap((l, j) => (j ? [h('br'), l] : [l]))))))
    const vessels = h('div', { class: 't38d-vessels', role: 'group', 'aria-label': D.group }, ...btns)
    const world = h('div', { class: 't38d-world' }, cv, ...mists, garden, vessels, threads)
    const who = h('p', { class: 't38d-who' })
    const view = h('div', { class: 't38d-view-box' })
    const count = h('p', { class: 't38d-count' })
    const strip = h('div', { class: 't38d-strip', role: 'region', 'aria-label': D.strip, hidden: true }, who, view, count)
    const cord = s('svg', { class: 't38d-cord', 'aria-hidden': 'true' }, s('path'))
    const root = h('div', { class: 't38d' }, h('p', { class: 'visually-hidden' }, D.art), defs, world, cord, strip)
    ctx.art.append(root)
    ctx.prompt(D.prompt)

    const heard = new Set<number>()
    let sel = -1
    let Wd: World | null = null
    let moonAt: Pt = [0, 0]
    let p = palette()

    function pick(k: number) {
      if (k < 0 || k >= n) return
      const vi = order[k]
      const st = P.stones[vi]
      btns.forEach((b, j) => b.setAttribute('aria-pressed', String(j === k)))
      sel = k
      const b = btns[k]
      if (!heard.has(k)) {
        heard.add(k)
        b.classList.add('heard')
        if (!ctx.reduced && !low) {
          b.classList.add('pouring')
          setTimeout(() => b.classList.remove('pouring'), 2600)
        }
        world.dataset.clear = String(heard.size)
      }
      who.textContent = st.who
      view.replaceChildren(ctx.fact(st.view, 'p', 't38d-view'))
      count.textContent = fill(L.heard, { n: heard.size, total: n })
      const first = strip.hidden
      strip.hidden = false
      if (first) strip.setAttribute('aria-live', 'polite') // after the first fill: not read out on entering the scene
      if (!ctx.reduced) strip.animate([{ opacity: 0, transform: 'translateY(-6px) rotate(-0.8deg)' }, { opacity: 1, transform: 'rotate(-0.8deg)' }], { duration: 700, delay: 250, easing: 'ease-out', fill: 'backwards' })
      frame()
      if (heard.size === n && !root.classList.contains('is-all')) {
        root.classList.add('is-all')
        ctx.insight(P.common, D.insight)
        ctx.chime('ok')
      } else ctx.chime('soft')
    }

    /** the camera: listening, it lifts / leans toward the vessel so its paper strip hangs under it, inside the frame */
    function frame() {
      if (!Wd) return
      const { W, H, Hw, wide, F } = Wd
      if (sel < 0) {
        world.style.transform = 'none'
        world.style.setProperty('--cz', '1')
        return
      }
      const f = F[sel]
      const sw = wide ? Math.min(420, W * 0.28) : W - 32
      strip.style.width = `${f1(sw)}px`
      const sh = strip.offsetHeight // the one read: the strip's text height for this view
      const z = wide ? 1.04 : clamp(170 / f.vw, 1, 1.6)
      // world → screen: q·z + t
      let tx = wide ? f.x * (1 - z) : W * 0.5 - f.x * z
      tx = clamp(tx, W - W * z, 0)
      const slabY = f.y + Wd.nf[sel] * 2.5 + 16, slabX = f.x + f.vw * Wd.nx
      let ty: number, top: number, left: number
      if (wide) {
        ty = f.y * (1 - z)
        top = slabY * z + ty + 14
        left = clamp(f.x * z + tx - f.vw * 0.42 * z, W * 0.035, W - sw - W * 0.035)
        if (top + sh > H - 12) {
          // no room under it (the near vessels): the strip lies on the boards to the right of its name stone
          top = Math.max(H * 0.3, H - 12 - sh)
          left = clamp(slabX * z + tx + Wd.nf[sel] * 4 + 18, W * 0.035, W - sw - W * 0.035)
        }
      } else {
        top = H - sh - 8
        ty = top - 14 - slabY * z
        left = 16
      }
      ty = clamp(ty, H - Hw * z, 0)
      if (!wide) top = Math.max(top, slabY * z + ty + 10)
      world.style.transform = `translate(${f1(tx)}px, ${f1(ty)}px) scale(${z.toFixed(3)})`
      world.style.setProperty('--cz', z.toFixed(3)) // the name stones keep their letter size while the camera leans in
      Object.assign(strip.style, { left: `${f1(left)}px`, top: `${f1(top)}px` })
      // the cord: from under the name stone down to the strip's top edge
      const ax = slabX * z + tx, ay = slabY * z + ty
      const side = ax < left - 8 // the strip lies beside the stone, not under it: the cord runs to its upper left corner
      const bx = side ? left + 18 : clamp(ax, left + 22, left + sw - 22), by = top + 2
      cord.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
      const a0: Pt = side ? [ax + Wd.nf[sel] * 3.6, ay - Wd.nf[sel] * 1.2] : [ax, ay - 2]
      ;(cord.firstChild as SVGPathElement).setAttribute('d', `M${f1(a0[0])} ${f1(a0[1])}C${f1(a0[0] + (side ? 14 : 0))} ${f1(a0[1] + 12)} ${f1(bx)} ${f1(by - 14)} ${f1(bx)} ${f1(by)}`)
      cord.classList.toggle('on', by - a0[1] > 4)
    }

    function layout() {
      const W = root.clientWidth
      const H = stable(ctx.art.clientHeight)
      if (W < 40 || H < 40) return
      root.style.height = `${f1(H)}px`
      Wd = worldOf(W, H)
      root.classList.toggle('wide', Wd.wide)
      Object.assign(world.style, { width: `${f1(W)}px`, height: `${f1(Wd.Hw)}px` })
      Wd.F.forEach((f, k) => {
        const V = VESSELS[order[k]]
        const bw = (f.vw * BOX[2]) / V.vis, bh = (bw * BOX[3]) / BOX[2]
        Object.assign(btns[k].style, { left: `${f1(f.x - bw / 2)}px`, top: `${f1(f.y - bh * (-BOX[1] / BOX[3]))}px`, width: `${f1(bw)}px`, height: `${f1(bh)}px`, zIndex: String(Math.round(f.y)) })
        btns[k].style.setProperty('--nf', `${f1(Wd!.nf[k])}px`)
        btns[k].style.setProperty('--foot', `${f1(bh * (-BOX[1] / BOX[3]))}px`)
        btns[k].style.setProperty('--nx', `${f1(bw / 2 + f.vw * Wd!.nx)}px`)
      })
      paint()
      frame()
    }

    let job: { cancel(): void } | null = null
    let drawn = false
    function paint() {
      if (!Wd) return
      const run = () => {
        const at = paintStage(fit(cv, Wd!.W, Wd!.Hw, dprOf(low)), p, Wd!)
        moonAt = [at.mx, at.my]
        decor()
        drawn = true
      }
      job?.cancel()
      if (drawn) return run()
      job = sliced((function* () { yield; run() })(), { sync: ctx.reduced })
    }
    /** the garden's pine and lantern, the mist veils (one lifts per definition heard), the threads of moonlight */
    function decor() {
      const { W, H, Hw, hz, F, wide } = Wd!
      garden.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(Hw)}`)
      garden.replaceChildren(
        wide ? pine(W * 0.24, hz + H * 0.21, H * 0.44, 3884, -1) : pine(W * 0.1, hz + H * 0.2, H * 0.3, 3884, 1),
        toro(W * (wide ? 0.87 : 0.9), hz + H * (wide ? 0.1 : 0.06), H * (wide ? 0.12 : 0.08), true))
      const band = (m: HTMLElement, y: number, x0: number, x1: number, th: number) =>
        Object.assign(m.style, { left: `${f1(x0)}px`, top: `${f1(y - th / 2)}px`, width: `${f1(x1 - x0)}px`, height: `${f1(th)}px` })
      band(mists[0], hz + H * 0.24, -W * 0.05, W * 0.75, H * 0.14)
      band(mists[1], hz + H * 0.15, W * 0.1, W * 1.05, H * 0.14)
      band(mists[2], hz + H * 0.06, -W * 0.05, W * 0.8, H * 0.12)
      band(mists[3], hz - H * 0.03, W * 0.15, W * 1.05, H * 0.13)
      threads.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(Hw)}`)
      threads.replaceChildren(...F.map((f, k) => {
        const V = VESSELS[order[k]]
        const sc = f.vw / V.vis
        const tx = f.x + V.w[0] * sc, ty = f.y + V.w[1] * sc
        const [mx, my] = moonAt
        return s('path', { d: `M${f1(mx)} ${f1(my)}Q${f1((mx + tx) / 2)} ${f1(Math.min(my, ty) - H * 0.05)} ${f1(tx)} ${f1(ty)}`, style: `--k:${k}` })
      }))
    }

    ctx.onCleanup(() => job?.cancel())
    ctx.onCleanup(onSize(ctx.art, layout))
    ctx.onCleanup(onDigit((d) => d <= n && (pick(d - 1), btns[d - 1].focus({ preventScroll: true }))))
    ctx.onCleanup(onPrefs(() => {
      const q = palette()
      if (q.key === p.key) return
      p = q
      paint()
    }))
  },
}
