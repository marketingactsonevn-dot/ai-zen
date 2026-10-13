import { s } from '../../core/dom'
import { Pen, arc, brush, ell, peaks, poly, rng, rrD, rrPts, type Pt } from '../t03/brush'

/** Sumi-e pictures for Trạm 14, each drawn in its own local box (origin noted per picture). */

export type { Pt }
export { ell, brush }
const S = { straight: true }
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
/** smooth closed outline through pts (for flat fills) */
export const closed = (pts: Pt[]) => brush(pts, 0.01).c + 'Z'

/** A flat fill (paper, stone…) under an ink picture. */
function picture(bg: [string, string][], draw: (p: Pen) => void, cls = '') {
  const g = s('g', cls ? { class: cls } : null)
  for (const [d, c] of bg) g.append(s('path', { d, class: c }))
  const p = new Pen(false)
  draw(p)
  g.append(p.root)
  return g
}
/** Dry brush along a horizontal stroke: the streaks run with it (the shared ink-dry runs them across). */
export function dryFilter() {
  return s('filter', { id: 't14-dryh', x: '-4%', y: '-80%', width: '108%', height: '260%' },
    s('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.012 0.55', numOctaves: '2', seed: '8', result: 'n' }),
    s('feColorMatrix', { in: 'n', type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.3 1.7', result: 'm' }),
    s('feComposite', { in: 'SourceGraphic', in2: 'm', operator: 'in' }))
}
function dryH(paths: [string, number][], cls = 'k2') {
  return s('g', { filter: 'url(#t14-dryh)', class: cls }, ...paths.map(([d, op]) => s('path', { d, 'fill-opacity': op })))
}
/** a small soft dab (a wash filter would shred something this small) */
function dab(p: Pen, d: string, op: number, cls = 'k') {
  p.solid(d, cls).setAttribute('fill-opacity', String(op))
}

// ───────── dawn behind a scene: a pale sun (a moon at night), far ridges dissolving in mist ─────────
export interface Sky {
  W: number
  /** the horizon, y */
  hz: number
  sun?: Pt
  R?: number
  /** far ridges: [x0, x1, lowest, highest, opacity] */
  ridges: [number, number, number, number, number][]
  seed: number
  low?: boolean
}
export function skyArt(id: string, o: Sky) {
  const stops = (...c: [number, string][]) => c.map(([offset, cls]) => s('stop', { offset, class: cls }))
  const g = s('g', { class: 't14-sky' },
    s('defs', null,
      s('radialGradient', { id: `${id}-sun` }, ...stops([0, 'sun0'], [0.84, 'sun1'], [0.97, 'sun2'], [1, 'sun3'])),
      s('radialGradient', { id: `${id}-halo` }, ...stops([0.3, 'halo0'], [1, 'halo1'])),
      s('linearGradient', { id: `${id}-rdg`, x1: 0, y1: 0, x2: 0, y2: 1 }, ...stops([0, 'rdg0'], [1, 'rdg1'])),
      s('linearGradient', { id: `${id}-mist`, x1: 0, y1: 0, x2: 0, y2: 1 }, ...stops([0, 'mist0'], [0.72, 'mist1'], [1, 'mist0']))))
  if (o.sun && o.R) {
    const [x, y] = o.sun
    g.append(
      s('circle', { cx: x, cy: y, r: o.R * 2.8, fill: `url(#${id}-halo)` }),
      s('circle', { cx: x, cy: y, r: o.R, fill: `url(#${id}-sun)`, filter: o.low ? null : 'url(#ink-rough)' }))
  }
  const r = rng(o.seed)
  const far = s('g', { mask: `url(#${id}-skm)` })
  g.append(s('defs', null,
    s('linearGradient', { id: `${id}-skg`, x1: 0, y1: 0, x2: 1, y2: 0 },
      s('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 0 }), s('stop', { offset: 0.1, 'stop-color': '#fff' }),
      s('stop', { offset: 0.9, 'stop-color': '#fff' }), s('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 })),
    s('mask', { id: `${id}-skm`, maskUnits: 'userSpaceOnUse', x: 0, y: -10, width: o.W, height: o.hz + 60 },
      s('rect', { x: 0, y: -10, width: o.W, height: o.hz + 60, fill: `url(#${id}-skg)` }))), far)
  for (const [x0, x1, h0, h1, op] of o.ridges) {
    if (h1 < 8) continue
    const rg = s('g', o.low ? null : { filter: 'url(#ink-wash)' })
    for (const { d } of peaks(r, x0, x1, o.hz + 2, h0, h1, (h0 + h1) * 0.95))
      rg.append(s('path', { d, fill: `url(#${id}-rdg)`, 'fill-opacity': (op * (0.7 + r() * 0.6)).toFixed(3) }))
    far.append(rg)
  }
  const mh = clamp(o.hz * 0.5, 18, 90)
  far.append(s('rect', { x: -10, y: o.hz - mh * 0.78, width: o.W + 20, height: mh, fill: `url(#${id}-mist)` }))
  return g
}

/** Straight raked furrows from the horizon down, opening up as they come closer. Holes stay smooth (rings go there). */
export function sandArt(id: string, W: number, H: number, top: number, holes: [number, number, number, number][]) {
  const span = Math.max(30, (H - top) * 0.35)
  const defs = s('defs', null,
    s('linearGradient', { id: `${id}-sf`, gradientUnits: 'userSpaceOnUse', x1: 0, y1: top, x2: 0, y2: top + span },
      s('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 0 }), s('stop', { offset: 1, 'stop-color': '#fff' })),
    s('linearGradient', { id: `${id}-ss`, x1: 0, y1: 0, x2: 1, y2: 0 },
      s('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 0 }), s('stop', { offset: 0.07, 'stop-color': '#fff' }),
      s('stop', { offset: 0.93, 'stop-color': '#fff' }), s('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 })),
    s('mask', { id: `${id}-sm`, maskUnits: 'userSpaceOnUse', x: -20, y: top - 6, width: W + 40, height: H - top + 12 },
      s('rect', { x: -20, y: top - 6, width: W + 40, height: H - top + 12, fill: `url(#${id}-sf)` }),
      ...holes.map(([cx, cy, rx, ry]) => s('path', { d: ell(cx, cy, rx, ry), fill: '#000' }))),
    s('mask', { id: `${id}-ss2`, maskUnits: 'userSpaceOnUse', x: 0, y: top - 6, width: W, height: H - top + 12 },
      s('rect', { x: 0, y: top - 6, width: W, height: H - top + 12, fill: `url(#${id}-ss)` })),
    s('linearGradient', { id: `${id}-sb`, gradientUnits: 'userSpaceOnUse', x1: 0, y1: H - Math.min(80, (H - top) * 0.3), x2: 0, y2: H },
      s('stop', { offset: 0, 'stop-color': '#fff' }), s('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 })),
    s('mask', { id: `${id}-sb2`, maskUnits: 'userSpaceOnUse', x: -20, y: top - 6, width: W + 40, height: H - top + 12 },
      s('rect', { x: -20, y: top - 6, width: W + 40, height: H - top + 12, fill: `url(#${id}-sb)` })))
  const lines = s('g', { mask: `url(#${id}-sm)` })
  for (let y = top + 3, n = 0; y < H + 6; n++) {
    const pts: string[] = []
    for (let x = -10; x <= W + 24; x += 24) pts.push(`${x} ${(y + 1.1 * Math.sin(x / 43 + n * 0.7)).toFixed(1)}`)
    const d = `M${pts.join('L')}`
    lines.append(s('path', { d, class: 'rk' }), s('path', { d, class: 'rk-hi', transform: 'translate(0 1.4)' }))
    y += 4.5 + 11 * Math.min(1, (y - top) / Math.max(1, H - top))
  }
  return s('g', { class: 't14-sand' }, defs, s('g', { mask: `url(#${id}-sb2)` }, s('g', { mask: `url(#${id}-ss2)` }, lines)))
}

/** Raked rings around something on the sand. */
export function ringsArt(cx: number, cy: number, rx0: number, ratio: number, n: number, gap: number) {
  const g = s('g')
  for (let i = 0; i < n; i++) {
    const rx = rx0 + i * gap
    const d = ell(cx, cy, rx, rx * ratio)
    g.append(s('path', { d, class: 'rk' }), s('path', { d, class: 'rk-hi', transform: 'translate(0 1.3)' }))
  }
  return g
}

// ───────── a flat garden stone seen at an angle · centre of its top 0,0 ─────────
/**
 * Washed in, not outlined: a pale top that darkens away from the light, a shadowed flank, a dry-brush rim
 * along the far edge, a light contour at the foot and a little moss. `seed` varies the silhouette.
 */
export function stoneArt(rx: number, ry: number, seed: number, moss = 4) {
  const r = rng(Math.round(seed * 9973))
  const pts: Pt[] = []
  const N = 24
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2
    const f = 1 + 0.09 * Math.sin(2 * a + seed) + 0.065 * Math.sin(3 * a + seed * 1.7) + 0.035 * Math.sin(5 * a + seed * 2.9)
    pts.push([rx * f * Math.cos(a), ry * f * Math.sin(a)])
  }
  const th = ry * 0.42
  const top = closed([...pts, pts[0]])
  const lower = pts.filter((p) => p[1] >= -ry * 0.04).sort((a, b) => b[0] - a[0])
  const side = poly([...lower, ...lower.slice().reverse().map(([x, y]) => [x, y + th] as Pt)])
  const far = pts.filter((p) => p[1] < ry * 0.1).sort((a, b) => a[0] - b[0])
  const g = s('g', { class: 't14-stone' })
  g.append(
    s('path', { d: ell(rx * 0.16, th + ry * 0.3, rx * 1.08, ry * 0.5), class: 'shd', filter: 'url(#ink-wash)' }),
    s('path', { d: side, class: 'st-f' }),
    s('path', { d: top, class: 'st-t' }))
  const p = new Pen(false)
  // the top darkens toward the near right; the flank sinks into shadow
  p.wash(closed([...pts, pts[0]].map(([x, y]) => [x * 0.62 + rx * 0.3, y * 0.52 + ry * 0.34] as Pt)), 0.07)
  p.wash(side, 0.1)
  // light catches the upper-left lip
  const lip = pts.filter(([x, y]) => y < 0 && x < rx * 0.35).sort((a, b) => a[0] - b[0]).map(([x, y]) => [x * 0.86, y * 0.74 + ry * 0.04] as Pt)
  if (lip.length > 2) p.solid(brush(lip, ry * 0.14 + 0.9, { a: 0.3, b: 0.45, min: 0.15 }).d, 'rim')
  // a light contour at the foot
  p.line(lower.map(([x, y]) => [x, y + th] as Pt), ry * 0.06 + 1.1, { a: 0.22, b: 0.28, min: 0.25, cls: 'edge' })
  // a dry brush just inside the far edge, a few faint hairs of grain across the top
  const dry: [string, number][] = [[brush(far.map(([x, y]) => [x * 0.95, y * 0.84 + ry * 0.05] as Pt), ry * 0.1 + 1.1, { a: 0.25, b: 0.35, min: 0.2, wob: 0.3 }).d, 0.38]]
  for (let i = 0; i < 2; i++) {
    const y = ry * (-0.25 + i * 0.32 + r() * 0.1)
    const x0 = -rx * (0.55 - r() * 0.25)
    dry.push([brush([[x0, y], [x0 + rx * (0.55 + r() * 0.3), y + ry * 0.05]], ry * 0.07 + 0.7, { a: 0.25, b: 0.5, min: 0.2 }).d, 0.14])
  }
  // moss gathers on one side of the foot
  const side0 = r() > 0.5 ? 1 : -1
  for (let j = 0; j < moss; j++) {
    const a = (side0 > 0 ? 0.2 : Math.PI - 0.2) + (r() - 0.5) * 0.9
    const rr = (1.6 + r() * 2.4) * clamp(rx / 50, 0.6, 1.3)
    p.solid(ell(Math.cos(a) * rx * (0.9 + r() * 0.14), Math.max(0, Math.sin(a)) * ry + th * (0.3 + r() * 0.7), rr, rr * 0.72), j % 3 ? 'm' : 'm2')
  }
  g.append(p.root, dryH(dry))
  return g
}

// ───────── the brain (side view, front to the left) · centre 0,0 · ~146 × 106 ─────────
const BRAIN: Pt[] = [[-60, 22], [-71, 6], [-73, -14], [-64, -34], [-46, -49], [-22, -57], [4, -58], [28, -53], [48, -42], [63, -26], [71, -6], [70, 12], [60, 24], [46, 28], [53, 35], [49, 44], [35, 48], [22, 44], [16, 36], [0, 34], [-16, 36], [-34, 34], [-50, 30], [-60, 22]]
const GYRI: [Pt[], number][] = [
  [[[-44, 15], [-24, 9], [-4, 5], [16, -3], [36, -5]], 3.4],
  [[[8, -56], [2, -44], [7, -33], [-1, -21], [3, -10]], 2.8],
  [[[-64, -6], [-52, -12], [-46, -25], [-34, -30], [-31, -42], [-18, -49]], 2.4],
  [[[-58, 6], [-46, 0], [-36, -9], [-23, -12], [-17, -26], [-8, -33]], 2.2],
  [[[18, -50], [23, -39], [16, -29], [25, -19], [39, -22], [45, -34], [55, -29]], 2.3],
  [[[62, -12], [52, -7], [46, 5]], 2],
  [[[-46, 24], [-30, 21], [-16, 24], [-2, 18], [12, 21], [27, 15], [40, 18]], 2.2],
  [[[24, 40], [34, 38], [46, 38]], 1.6],
  [[[27, 45], [37, 44], [46, 42]], 1.3],
]
export function brainArt() {
  const body = closed(BRAIN)
  return picture([[body, 'bfill']], (p) => {
    p.wash(body, 0.08)
    p.wash(closed([[-58, 18], [-30, 28], [10, 30], [44, 26], [64, 12], [52, 2], [12, 10], [-30, 12]]), 0.14)
    p.line([[18, 42], [22, 52], [23, 62]], 8, { a: 0.02, b: 0.6, min: 0.3 })
    p.line(BRAIN.slice(0, 14), 3.6, { a: 0.05, b: 0.12, min: 0.35 })
    p.line(BRAIN.slice(13), 2.6, { a: 0.1, b: 0.1, min: 0.35 })
    for (const [pts, w] of GYRI) p.line(pts, w, { a: 0.18, b: 0.35, min: 0.2 })
  }, 't14-brain')
}

// ───────── the glass jar · centre 0,0 (the brain floats at 0,-8) · base top at y 70 ─────────
export function jarArt() {
  const base = s('g', { transform: 'translate(0 76)' }, stoneArt(124, 21, 2.2, 5))
  const back = picture([['M-94 64V-30A94 84 0 0 1 94 -30V64A94 12 0 0 1 -94 64Z', 'glass']], (p) => {
    p.line(arc(0, 64, 94, 12, 182, 358, 22), 1.2, { a: 0.2, b: 0.2, cls: 'k3' })
  })
  const front = picture([], (p) => {
    p.line([[-94, 64], [-94, -30], ...arc(0, -30, 94, 84, 180, 268, 18)], 2.2, { a: 0.06, b: 0.3, cls: 'k2' })
    p.line([...arc(0, -30, 94, 84, 274, 360, 18), [94, -30], [94, 64]], 1.9, { a: 0.3, b: 0.08, cls: 'k2' })
    p.line(arc(0, 64, 94, 12, 4, 176, 24), 2.2, { a: 0.1, b: 0.1, cls: 'k2' })
    p.line([[0, -113], [0, -120]], 3, { ...S, cls: 'k2' })
    p.line(arc(0, -126, 11, 6.5, 0, 360, 22), 1.8, { a: 0.05, b: 0.05, min: 0.6, cls: 'k2' })
    p.solid(brush([[-80, 52], [-82, 0], [-77, -42], [-58, -78], [-38, -97]], 7, { a: 0.3, b: 0.4, min: 0.1 }).d, 'hi')
    p.solid(brush([[-62, -96], [-50, -103]], 3, { a: 0.3, b: 0.4 }).d, 'hi')
    p.solid(brush([[66, -72], [78, -42], [82, -6]], 3.6, { a: 0.4, b: 0.4, min: 0.1 }).d, 'hi')
    p.solid(brush([[-58, 70], [-26, 74]], 2.4, { a: 0.4, b: 0.4 }).d, 'hi')
    p.solid(ell(-4, -128, 4, 1.6), 'hi')
  })
  front.insertBefore(s('path', { d: ell(0, -126, 11, 6.5), class: 'glass' }), front.firstChild)
  return { base, back, front }
}

/** A speech bubble with ink "words" (what a chatbot gives back). Origin at its tail. */
export function bubbleArt(seed: number) {
  const w = 30 + (seed % 3) * 6
  return picture([[rrD(-w / 2, -22, w, 16, 7), 'card']], (p) => {
    p.line(rrPts(-w / 2, -22, w, 16, 7), 1.3, { a: 0.15, b: 0.2, min: 0.4 })
    p.line([[-4, -7], [-1, 0], [3, -7]], 1.2, S)
    p.line([[-w / 2 + 6, -14], [w / 2 - 8 - (seed % 2) * 6, -14]], 1.8, { a: 0.05, b: 0.5, min: 0.3, cls: 'k2' })
  })
}

// ───────── tools · centre 0,0 · ~100 × 80, standing on a flat stone ─────────
export interface Tool {
  g: SVGGElement
  /** vermilion marks that appear when a hand uses the tool */
  act: SVGGElement
  /** the part that moves when used */
  lift: SVGGElement
  /** the stone's top centre, y (ripples spread from here) */
  stone: number
  /** the stone's lowest point, y (the name goes under it) */
  foot: number
}

/** A loose ink outline: thin where the brush lifts, heavier where it presses. */
const OUT = { a: 0.12, b: 0.22, min: 0.3, wob: 0.22 }
const TXT = { a: 0.05, b: 0.6, min: 0.2 }

function tool(parts: SVGGElement[], act: SVGGElement, base: number, seed: number, back: SVGGElement[] = []): Tool {
  const lift = s('g', null, ...parts, act)
  const sy = base + 5
  const stone = s('g', { transform: `translate(0 ${sy})` }, stoneArt(54, 12, seed, 3))
  // the object's own shadow, where it stands on the stone
  const contact = s('path', { d: ell(4, base + 1, 40, 3.2), class: 'shd', filter: 'url(#ink-wash)' })
  return { g: s('g', { class: 't14-tool' }, stone, contact, ...back, lift), act, lift, stone: sy, foot: sy + 12 * 1.1 + 5 }
}

export function browserArt(): Tool {
  const body = picture([[rrD(-50, -38, 100, 76, 9), 'card']], (p) => {
    p.wash(rrD(-50, -38, 100, 76, 9), 0.035)
    p.wash('M-50 -22V-29A9 9 0 0 1 -41 -38H41A9 9 0 0 1 50 -29V-22Z', 0.12)
    p.line(rrPts(-50, -38, 100, 76, 9), 2.2, OUT)
    p.line([[-47, -22], [6, -21.4], [47, -22.4]], 1.1, { a: 0.1, b: 0.5, min: 0.2, cls: 'k2' })
    ;[-40, -32.5, -25].forEach((x, i) => dab(p, ell(x, -30, 2.3), 0.55 - i * 0.15))
    dab(p, rrD(-14, -34, 56, 8, 4), 0.08)
    // a landscape on the page, then lines of text
    p.wash(rrD(-40, -12, 32, 25, 3), 0.1)
    p.wash(poly([[-40, 13], [-31, 1], [-25, 7], [-18, -3], [-8, 13]]), 0.2)
    p.line([[-38, 10], [-31, 1], [-25, 6], [-18, -3], [-11, 9]], 1.3, { a: 0.1, b: 0.45, min: 0.25 })
    p.line([[0, -8], [22, -8.6], [40, -8]], 2, TXT)
    p.line([[0, 1], [32, 1.4]], 1.3, { ...TXT, cls: 'k2' })
    p.line([[0, 9], [37, 8.6]], 1.3, { ...TXT, cls: 'k2' })
    p.line([[-40, 25], [24, 25.4]], 1.3, { ...TXT, cls: 'k2' })
  })
  const act = s('g', { class: 't14-act' },
    s('circle', { cx: 20, cy: 14, r: 9, class: 'ring-v' }),
    s('path', { d: poly([[20, 14], [20, 30], [24, 26], [27.5, 33], [31, 31.5], [27.5, 25], [33, 25]]), class: 'k t14-cursor' }))
  return tool([body], act, 38, 1.4)
}

export function filesArt(): Tool {
  const BK: Pt[] = [[-30, -46], [34, -42], [30, 40], [-34, 36]]
  const back = picture([[poly(BK), 'card']], (p) => {
    p.wash(poly(BK), 0.07)
    p.line([...BK, BK[0]], 1.4, { ...S, a: 0.1, b: 0.2, min: 0.3, cls: 'k2' })
  })
  const sheet: Pt[] = [[-40, -36], [14, -36], [32, -18], [32, 46], [-40, 46]]
  const front = picture([[poly(sheet), 'card']], (p) => {
    p.wash(poly(sheet), 0.03)
    p.line([...sheet, sheet[0]], 2, { ...S, a: 0.06, b: 0.15, min: 0.3, wob: 0.2 })
    p.wash(poly([[14, -36], [14, -18], [32, -18]]), 0.16)
    p.line([[14, -36], [14.5, -18], [32, -18]], 1.3, { ...S, a: 0.1, b: 0.3, min: 0.3 })
    p.line([[-30, -20], [4, -20.5]], 2, TXT)
    for (const [y, x1] of [[-6, 22], [6, 16], [18, 22], [30, 6]]) p.line([[-30, y], [x1, y + 0.4]], 1.3, { ...TXT, cls: 'k2' })
  })
  const act = s('g', { class: 't14-act' }, s('path', { d: rrD(12, 26, 13, 13, 2.5), class: 'v' }), s('path', { d: rrD(14.5, 28.5, 8, 8, 1.5), class: 'card', 'fill-opacity': 0.55 }))
  return tool([front], act, 46, 3.1, [back])
}

export function calendarArt(): Tool {
  const body = picture([[rrD(-46, -32, 92, 80, 7), 'card']], (p) => {
    p.wash(rrD(-46, -32, 92, 80, 7), 0.035)
    p.wash('M-46 -14V-25A7 7 0 0 1 -39 -32H39A7 7 0 0 1 46 -25V-14Z', 0.18)
    p.line(rrPts(-46, -32, 92, 80, 7), 2.2, OUT)
    p.line([[-44, -14], [0, -13.4], [44, -14.2]], 1.1, { a: 0.1, b: 0.5, min: 0.2, cls: 'k2' })
    // the binder rings: two short pressed strokes
    p.line([[-24, -41], [-23.6, -26]], 3.2, { a: 0.15, b: 0.3, min: 0.4 })
    p.line([[24, -41], [24.4, -26]], 3.2, { a: 0.15, b: 0.3, min: 0.4 })
    // the days: soft dabs, a few already taken
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 4; c++) dab(p, rrD(-35 + c * 20, -4 + r * 15, 10, 8, 3), [0.06, 0.1, 0.16][(r * 4 + c * 3) % 3])
  })
  const act = s('g', { class: 't14-act' }, s('path', { d: brush(arc(10, 15, 11, 9, -70, 255, 28), 2.4, { a: 0.1, b: 0.4, min: 0.2 }).d, class: 'v' }))
  return tool([body], act, 48, 4.6)
}

export function mailArt(): Tool {
  const body = picture([[rrD(-48, -30, 96, 62, 5), 'card']], (p) => {
    p.wash(rrD(-48, -30, 96, 62, 5), 0.035)
    p.wash(poly([[-46, -28], [0, 6], [46, -28]]), 0.1)
    p.line(rrPts(-48, -30, 96, 62, 5), 2.2, OUT)
    p.line([[-45, -27], [-20, -8], [0, 6], [20, -8], [45, -27]], 1.8, { a: 0.08, b: 0.12, min: 0.35 })
    p.line([[-45, 29], [-14, 6]], 1.1, { a: 0.1, b: 0.5, min: 0.2, cls: 'k2' })
    p.line([[45, 29], [14, 6]], 1.1, { a: 0.1, b: 0.5, min: 0.2, cls: 'k2' })
  })
  const act = s('g', { class: 't14-act' }, s('circle', { cx: 0, cy: 8, r: 6.5, class: 'v' }))
  return tool([body], act, 32, 0.6)
}

// ───────── an ink arm: shoulder S0 → touch point T ─────────
const BOW: Pt[] = [[0, 0], [0.26, 0.7], [0.56, 1], [0.84, 0.55], [1, 0]]
/**
 * One calligraphic stroke: pressed hard at the shoulder, thinning as the brush runs dry, a few hairs of
 * paper showing through, and three bristles splaying where it touches. `bend` bows it to one side.
 */
export function armShape(S0: Pt, T: Pt, w: number, bend: number) {
  const dx = T[0] - S0[0]
  const dy = T[1] - S0[1]
  const L = Math.hypot(dx, dy) || 1
  const nx = -dy / L
  const ny = dx / L
  const bow = (t: number) => {
    const i = Math.min(BOW.length - 2, BOW.findIndex((b) => b[0] >= t) - 1)
    const [t0, b0] = BOW[Math.max(0, i)]
    const [t1, b1] = BOW[Math.max(0, i) + 1]
    return (b0 + ((b1 - b0) * (t - t0)) / (t1 - t0 || 1)) * bend * L
  }
  const at = (t: number, o = 0): Pt => [S0[0] + dx * t + nx * (bow(t) + o), S0[1] + dy * t + ny * (bow(t) + o)]
  const END = 0.84
  const pts = [0, 0.26, 0.56, 0.72, END].map((t) => at(t))
  // width along the body (u = 0…1): full at the shoulder, a slight swell at the elbow, running out toward the tip
  const wf = (u: number) => (1 - 0.68 * u) * (1 + 0.1 * Math.exp(-(((u - 0.62) / 0.08) ** 2)))
  const body = brush(pts, w, { a: 0.02, b: 0.06, min: 0.6, wob: 0.14, wf })
  const wash = brush(pts, w * 2.1, { a: 0.1, b: 0.3, min: 0.3, wf })
  // flying white: a few broken hairs of paper where the brush runs dry, toward the end
  const hairs = ([[-0.22, 0.5, 0.8], [0.04, 0.6, 0.83], [0.24, 0.46, 0.7]] as [number, number, number][]).map(([o, t0, t1], i) => {
    const hp = [t0, (t0 + t1) / 2, t1].map((t) => at(t, o * w * wf(t / END)))
    return brush(hp, Math.max(0.55, w * (0.09 - i * 0.012)), { a: 0.4, b: 0.4, min: 0.1 }).d
  })
  // the tip: the bristles part a little and press onto the tool, ending on one short touch line
  const E = at(END)
  const ux = T[0] - E[0]
  const uy = T[1] - E[1]
  const ul = Math.hypot(ux, uy) || 1
  const qx = -uy / ul
  const qy = ux / ul
  const tw = w * wf(1)
  const tips = [-1, 0, 1].map((i) => {
    const b: Pt = [E[0] + qx * i * tw * 0.28 - (ux / ul) * tw * 0.5, E[1] + qy * i * tw * 0.28 - (uy / ul) * tw * 0.5]
    const reach = 1 - Math.abs(i) * 0.1
    const e: Pt = [E[0] + ux * reach + qx * i * w * 0.36, E[1] + uy * reach + qy * i * w * 0.36]
    const m: Pt = [(b[0] + e[0]) / 2 + qx * i * w * 0.08, (b[1] + e[1]) / 2 + qy * i * w * 0.08]
    return brush([b, m, e], tw * (i ? 0.46 : 0.6), { a: 0.05, b: 0.6, min: 0.15 }).d
  })
  return { d: body.d, c: body.c, wash: wash.d, hairs, tips, dir: [ux / ul, uy / ul] as Pt }
}

/** An ink stroke that draws itself: the filled shape is shown through a mask stroke along its centreline. */
export function selfDrawing(d: string, c: string, w: number, maskId: string, cls = 'k') {
  const m = s('path', { d: c, pathLength: 1, class: 't14-m', 'stroke-width': (w * 1.6 + 8).toFixed(1), 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1 })
  const mask = s('mask', { id: maskId, maskUnits: 'userSpaceOnUse', x: -4000, y: -4000, width: 9000, height: 9000 }, m)
  const el = s('path', { d, class: cls, mask: `url(#${maskId})` })
  return { el, mask, m }
}

/** The whole arm as SVG: wash, body (self-drawing), hairs; the hand (bristles + dab) to fade in after. */
export function armArt(a: ReturnType<typeof armShape>, w: number, maskId: string) {
  const sd = selfDrawing(a.d, a.c, w, maskId, 'arm')
  const wash = s('path', { d: a.wash, class: 'arm-w', mask: `url(#${maskId})` })
  const hairs = a.hairs.map((d) => s('path', { d, class: 'p', mask: `url(#${maskId})` }))
  const hand = s('g', { class: 't14-hand' }, ...a.tips.map((d) => s('path', { d, class: 'arm' })))
  return { mask: sd.mask, m: sd.m, wash, body: sd.el, hairs, hand }
}

// ───────── anatomy pieces ─────────

/** Paper lantern (short-term memory) · centre 0,0 · cord rises to y = -top */
export function paperLantern(top: number) {
  const g = s('g', { class: 't14-lantern' })
  const glow = s('ellipse', { cx: 0, cy: 0, rx: 70, ry: 70, class: 'lamp-glow' })
  const body = closed([...arc(0, 0, 26, 32, -90, 270, 24)])
  const pic = picture([[body, 'lamp']], (p) => {
    p.line([[0, -top], [0, -36]], 1.3, { ...S, a: 0.02, b: 0.02, min: 0.6 })
    p.wash(closed(arc(8, 4, 16, 26, -90, 270, 18)), 0.08)
    for (const y of [-22, -11, 0, 11, 22]) {
      const hw = 26 * Math.sqrt(1 - (y / 32) ** 2)
      p.line([[-hw, y], [0, y + 2.5], [hw, y]], 1, { a: 0.1, b: 0.1, min: 0.5, cls: 'k2' })
    }
    p.line(arc(0, 0, 26, 32, -80, 80, 16), 2.2, { a: 0.1, b: 0.1 })
    p.line(arc(0, 0, 26, 32, 100, 260, 16), 2.4, { a: 0.1, b: 0.1 })
    p.solid(rrD(-14, -37, 28, 7, 2))
    p.solid(rrD(-14, 30, 28, 7, 2))
    p.line([[0, 37], [0, 50]], 1.6, S)
    for (const dx of [-3, 0, 3]) p.line([[0, 48], [dx, 60]], 1.2, { a: 0.1, b: 0.6 })
  })
  g.append(glow, pic)
  return { g, glow }
}

/** Stone lantern / tōrō (long-term memory) · base centre 0,0, ~ 92 × 140 */
export function stoneLantern() {
  const roof: Pt[] = [[-46, -97], [-31, -104], [-15, -117], [0, -126], [15, -117], [31, -104], [46, -97]]
  const pieces: [string, string][] = [
    [poly([[-32, 0], [-28, -13], [28, -13], [32, 0]]), 'stn'],
    [poly([[-10, -13], [-9, -60], [9, -60], [10, -13]]), 'stn'],
    [poly([[-31, -60], [-26, -70], [26, -70], [31, -60]]), 'stn'],
    [poly([[-19, -70], [-19, -98], [19, -98], [19, -70]]), 'stn'],
    [rrD(-9, -93, 18, 18, 2), 'lampwin'],
    [closed([...roof, [42, -95], [-42, -95]]), 'stn'],
    [ell(0, -133, 6.5, 7.5), 'stn'],
  ]
  return picture(pieces, (p) => {
    p.wash(ell(8, 2, 52, 7), 0.2)
    p.wash(poly([[2, -13], [10, -13], [9, -60], [2, -60]]), 0.3)
    p.wash(poly([[6, -70], [19, -70], [19, -98], [6, -98]]), 0.28)
    p.wash(closed([[0, -126], [15, -117], [31, -104], [46, -97], [10, -97]]), 0.3)
    p.line([[-32, 0], [-28, -13], [28, -13], [32, 0]], 2.4, { ...S, a: 0.05, b: 0.05 })
    p.line([[-10, -13], [-9, -60]], 2, { a: 0.1, b: 0.1 })
    p.line([[10, -13], [9, -60]], 2.6, { a: 0.1, b: 0.1 })
    p.line([[-31, -60], [-26, -70], [26, -70], [31, -60], [-31, -60]], 2.2, { ...S, a: 0.03, b: 0.03, min: 0.5 })
    p.line([[-19, -70], [-19, -98]], 2, S)
    p.line([[19, -70], [19, -98]], 2.6, S)
    p.line([[-9, -93], [9, -93], [9, -75], [-9, -75], [-9, -93]], 1.4, { ...S, a: 0.05, b: 0.05, min: 0.5, cls: 'k2' })
    p.line(roof, 3.4, { a: 0.06, b: 0.06, min: 0.35 })
    p.line([[-42, -96], [42, -96]], 1.6, { ...S, cls: 'k2' })
    p.line(arc(0, -133, 6.5, 7.5, -80, 250, 16), 1.8)
    for (const [x, y, r] of [[-30, -100, 3.2], [-22, -106, 2.4], [24, -106, 2], [-26, -3, 2.6], [22, -4, 2]] as const) p.solid(ell(x, y, r, r * 0.7), 'm')
  }, 't14-toro')
}

/** Unrolled handscroll with three steps (the plan) · centre 0,0 · ~210 × 86 */
export function scrollArt() {
  return picture([[rrD(-92, -34, 184, 68, 2), 'card']], (p) => {
    p.wash(rrD(-92, -34, 184, 8, 1), 0.22)
    p.wash(rrD(-92, 26, 184, 8, 1), 0.22)
    p.line([[-92, -34], [92, -34]], 1.4, { ...S, cls: 'k2' })
    p.line([[-92, 34], [92, 34]], 1.4, { ...S, cls: 'k2' })
    for (const x of [-97, 97]) {
      p.line([[x, -41], [x, 41]], 8, { ...S, a: 0.02, b: 0.02, min: 0.8 })
      p.solid(ell(x, -43, 3.6, 2.6))
      p.solid(ell(x, 43, 3.6, 2.6))
    }
    ;[-14, 2, 18].forEach((y, i) => {
      p.line(arc(-68, y, 5.5, 5.5, -60, 290, 14), 1.4, { a: 0.1, b: 0.2, min: 0.4 })
      p.line([[-52, y], [[52, 34, 18][i], y + (i % 2 ? -1 : 1)]], 2.2, { a: 0.06, b: 0.3, cls: 'k2' })
      if (i < 2) p.line([[-73, y - 1], [-69, y + 4], [-61, y - 8]], 2.4, { a: 0.1, b: 0.4, cls: 'm' })
    })
    p.solid(ell(-68, 18, 2.6), 'v')
  }, 't14-scroll')
}

/** Low table with a laptop, files and a tea cup (the work environment) · table-top centre 0,0, legs to y 80 */
export function deskArt() {
  const CUP: Pt[] = [[-152, -16], [-128, -16], [-130, -4], [-136, 0], [-144, 0], [-150, -4]]
  return picture([
    [poly([[-156, 0], [156, 0], [156, 11], [-156, 11]]), 'wood'],
    [rrD(-62, -88, 124, 80, 6), 'card'],
    [poly([[-72, -6], [72, -6], [82, 0], [-82, 0]]), 'st-t'],
    [rrD(90, -12, 52, 12, 2), 'card'],
    [rrD(86, -24, 52, 12, 2), 'card'],
    [closed(CUP), 'st-t'],
  ], (p) => {
    p.wash(ell(0, 84, 176, 9), 0.15)
    p.line([[-160, 0], [0, -0.6], [160, 0.4]], 2.2, { a: 0.02, b: 0.05, min: 0.4 })
    p.line([[-156, 11], [156, 11]], 1.3, { ...S, a: 0.02, b: 0.05, min: 0.4, cls: 'k2' })
    p.line([[-134, 12], [-136, 80]], 6.5, { a: 0.03, b: 0.35, min: 0.4 })
    p.line([[134, 12], [136, 80]], 6.5, { a: 0.03, b: 0.35, min: 0.4 })
    // laptop
    p.line(rrPts(-62, -88, 124, 80, 6), 2, OUT)
    dab(p, rrD(-54, -80, 108, 12, 3), 0.07)
    for (const x of [-48, -42, -36]) dab(p, ell(x, -74, 1.7), 0.45)
    dab(p, rrD(-24, -77, 52, 6, 3), 0.08)
    dab(p, rrD(-48, -62, 34, 40, 3), 0.07)
    dab(p, poly([[-48, -22], [-38, -36], [-31, -29], [-23, -40], [-14, -22]]), 0.16)
    p.line([[-46, -24], [-38, -35], [-31, -28], [-23, -39], [-16, -24]], 1.2, { a: 0.1, b: 0.45, min: 0.25 })
    for (const [y, x1] of [[-58, 44], [-48, 38], [-38, 44], [-28, 30]]) p.line([[-6, y], [x1, y + 0.4]], y === -58 ? 1.9 : 1.3, { ...TXT, cls: y === -58 ? 'k' : 'k2' })
    p.line([[-72, -6], [72, -6], [82, 0], [-82, 0], [-72, -6]], 1.4, { ...S, a: 0.03, b: 0.03, min: 0.5, cls: 'k2' })
    // files
    p.line(rrPts(90, -12, 52, 12, 2), 1.2, { a: 0.1, b: 0.2, min: 0.4, cls: 'k2' })
    p.line(rrPts(86, -24, 52, 12, 2), 1.5, { a: 0.1, b: 0.2, min: 0.4 })
    dab(p, rrD(86, -30, 22, 7, 2), 0.22)
    p.line([[96, -18], [126, -18.4]], 1.1, { ...TXT, cls: 'k2' })
    // tea cup + steam
    p.wash(closed(CUP), 0.12)
    p.line(CUP.slice(1).concat([CUP[0]]), 1.6, { a: 0.05, b: 0.1, min: 0.4 })
    p.line([[-153, -16], [-127, -16]], 1.3, S)
    p.line([[-142, -24], [-138, -32], [-142, -40], [-138, -48]], 1.1, { a: 0.2, b: 0.6, cls: 'k3' })
    p.line([[-133, -26], [-130, -34], [-133, -41]], 1, { a: 0.2, b: 0.6, cls: 'k3' })
    p.root.append(dryH([[brush([[-160, 3], [0, 2], [160, 3.5]], 6, { a: 0.02, b: 0.05, min: 0.4 }).d, 0.45]], 'k'))
  }, 't14-desk')
}

/** Bamboo fence (yotsume-gaki) · base from 0,0 to len,0, ~92 tall */
export function fenceArt(len: number) {
  const posts = [0, len / 2, len]
  return picture([], (p) => {
    p.wash(ell(len / 2, 4, len / 2 + 16, 6), 0.16)
    for (let x = 22; x < len - 8; x += 24) p.line([[x, -2], [x + 0.6, -86]], 2.6, { a: 0.03, b: 0.1, min: 0.5, cls: 'k2' })
    for (const y of [-30, -58, -82]) p.line([[-8, y], [len * 0.5, y + 1.5], [len + 8, y]], 4, { a: 0.02, b: 0.04, min: 0.5 })
    for (const x of posts) {
      p.line([[x, 2], [x - 0.5, -94]], 8, { a: 0.02, b: 0.02, min: 0.8 })
      for (const y of [-26, -62]) p.line([[x - 5, y], [x + 5, y]], 1.6, { ...S, cls: 'p' })
    }
    for (let x = 22; x < len - 8; x += 48) {
      p.line([[x - 3, -61], [x + 3, -55]], 1.5, S)
      p.line([[x + 3, -61], [x - 3, -55]], 1.5, S)
    }
  }, 't14-fence')
}

/** Sekimori-ishi: a small stone tied with black rope, "do not pass" · base centre 0,0 */
export function ropeStoneArt() {
  const body = closed([[-19, -2], [-20, -14], [-12, -25], [2, -28], [15, -23], [20, -11], [18, -2]])
  return picture([[body, 'stn']], (p) => {
    p.wash(ell(6, 1, 26, 4.5), 0.25)
    p.wash(closed([[2, -26], [15, -22], [20, -11], [18, -2], [4, -2]]), 0.3)
    p.line([[-19, -2], [-20, -14], [-12, -25], [2, -28], [15, -23], [20, -11], [18, -2]], 2.2, { a: 0.1, b: 0.1 })
    p.line([[-18, -12], [-6, -22], [8, -26], [17, -20]], 2.4, { a: 0.1, b: 0.1, min: 0.5 })
    p.line([[-12, -24], [0, -18], [12, -8], [18, -4]], 2.2, { a: 0.1, b: 0.1, min: 0.5 })
    p.line(arc(0, -33, 5, 5, 200, 520, 16), 2, { a: 0.1, b: 0.1 })
    p.line([[2, -28], [-6, -36], [-12, -38]], 1.5, { a: 0.1, b: 0.6 })
    p.line([[2, -28], [10, -37], [16, -38]], 1.5, { a: 0.1, b: 0.6 })
  }, 't14-rope')
}

/** Pine branch reaching in from the left, needles in fans · origin at its root */
export function pineArt(len: number) {
  return picture([], (p) => {
    const B: Pt[] = [[-len * 0.12, 4], [len * 0.12, -6], [len * 0.3, 4], [len * 0.48, -4], [len * 0.66, 8], [len * 0.84, 3], [len, 12]]
    const twigA: Pt[] = [B[2], [len * 0.36, -16], [len * 0.42, -30]]
    const twigB: Pt[] = [B[4], [len * 0.74, -12], [len * 0.82, -22]]
    const twigC: Pt[] = [B[3], [len * 0.56, 18], [len * 0.62, 26]]
    p.wash(brush(B, 26, { a: 0.05, b: 0.5 }).d, 0.08)
    p.line(B, 13, { a: 0.02, b: 0.55, min: 0.18, wob: 0.18 })
    p.line(twigA, 5, { a: 0.05, b: 0.5, min: 0.25 })
    p.line(twigB, 4.4, { a: 0.05, b: 0.5, min: 0.25 })
    p.line(twigC, 3.6, { a: 0.05, b: 0.5, min: 0.25 })
    p.dry(brush(B.slice(0, 5), 11, { a: 0.1, b: 0.3 }).d, 0.55, 'p')
    const fans: [Pt, number, number][] = [[twigA[2], 1.1, -0.1], [twigB[2], 1, 0.15], [[len * 0.16, -8], 0.85, -0.25], [[len * 0.95, 9], 0.8, 0.35], [twigC[2], 0.75, 0.6], [[len * 0.52, -6], 0.7, 0]]
    for (const [[x, y], k, tilt] of fans) {
      p.wash(ell(x, y - 10 * k, 30 * k, 15 * k), 0.16, 'm')
      for (let layer = 0; layer < 2; layer++)
        for (let i = 0; i < 15; i++) {
          const a = Math.PI * (1.08 + (i / 14) * 0.84) + tilt + layer * 0.06
          const r = (layer ? 20 : 26) * k * (0.8 + 0.2 * Math.sin(i * 2.7 + layer))
          p.line([[x, y], [x + Math.cos(a) * r, y + Math.sin(a) * r * 0.82]], (layer ? 1.1 : 1.5) * k + 0.3, { a: 0.03, b: 0.75, min: 0.12, cls: layer ? 'm' : 'k' })
        }
      p.solid(ell(x, y, 2.6 * k + 1), 'k')
    }
  }, 't14-pine')
}

/** Small tools held in the hands · centre 0,0 · ~30 */
export function handTool(kind: 'search' | 'mail' | 'click' | 'file') {
  if (kind === 'search')
    return picture([[ell(-3, -3, 10), 'card']], (p) => {
      p.line(arc(-3, -3, 10, 10, -40, 300, 22), 2.4, { a: 0.05, b: 0.1 })
      p.line([[4, 4], [13, 13]], 4.4, { ...S, a: 0.05, b: 0.05, min: 0.6 })
      p.solid(brush([[-8, -6], [-5, -9]], 2, S).d, 'hi')
    })
  if (kind === 'mail')
    return picture([[rrD(-13, -9, 26, 18, 2), 'card']], (p) => {
      p.line(rrPts(-13, -9, 26, 18, 2), 1.8, { a: 0.05, b: 0.05, min: 0.5 })
      p.line([[-12, -8], [0, 2], [12, -8]], 1.5, S)
    })
  if (kind === 'click')
    return picture([[poly([[-4, -12], [-4, 8], [1, 3], [5, 12], [9, 10], [5, 1], [12, 1]]), 'card']], (p) => {
      p.line([[-4, -12], [-4, 8], [1, 3], [5, 12], [9, 10], [5, 1], [12, 1], [-4, -12]], 1.8, { ...S, a: 0.03, b: 0.03, min: 0.6 })
      p.line(arc(-4, -12, 7, 7, 150, 300, 8), 1.2, { a: 0.2, b: 0.2, cls: 'k3' })
    })
  return picture([[poly([[-10, -13], [5, -13], [10, -8], [10, 13], [-10, 13]]), 'card']], (p) => {
    p.line([[-10, -13], [5, -13], [10, -8], [10, 13], [-10, 13], [-10, -13]], 1.8, { ...S, a: 0.03, b: 0.03, min: 0.6 })
    for (const y of [-5, 1, 7]) p.line([[-6, y], [6, y]], 1.2, { ...S, cls: 'k2' })
  })
}

