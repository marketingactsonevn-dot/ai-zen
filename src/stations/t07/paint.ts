import { s } from '../../core/dom'
import { cssVar } from '../../core/prefs'
import { blob, brush, ell, peaks, rng, type Pt } from './ink'

/**
 * The three pictures the diffusion scene "finds" in the noise. Each is a 1000×1000 sumi-e painting built as a
 * standalone SVG (its own filters, literal colours read from the tokens), rasterised once into a canvas and
 * handed to the shader as a texture.
 */
export interface Pal {
  bg: string
  ink: string
  ink2: string
  ink3: string
  stone: string
  moss: string
  moss2: string
  verm: string
  card: string
}

export function palette(el: Element): Pal {
  const v = (n: string) => cssVar(n, el)
  return { bg: v('--card'), ink: v('--ink'), ink2: v('--ink-2'), ink3: v('--ink-3'), stone: v('--stone'), moss: v('--moss'), moss2: v('--moss-2'), verm: v('--vermilion'), card: v('--paper') }
}

type A = Record<string, unknown>
const P = (d: string, fill: string, a: A = {}) => s('path', { d, fill, ...a })
const B = (pts: Pt[], w: number, fill: string, o: Parameters<typeof brush>[2] = {}, a: A = {}) => P(brush(pts, w, o).d, fill, a)

function frame(p: Pal) {
  const svg = s('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 1000 1000', width: 1024, height: 1024 })
  svg.append(s('defs', null,
    s('filter', { id: 'rough', x: '-5%', y: '-5%', width: '110%', height: '110%' },
      s('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.03', numOctaves: '2', seed: '3', result: 'n' }),
      s('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: '7', xChannelSelector: 'R', yChannelSelector: 'G' })),
    s('filter', { id: 'wash', x: '-20%', y: '-20%', width: '140%', height: '140%' },
      s('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.014', numOctaves: '3', seed: '7', result: 'n' }),
      s('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: '22', xChannelSelector: 'R', yChannelSelector: 'G', result: 'd' }),
      s('feGaussianBlur', { in: 'd', stdDeviation: '3' })),
    s('filter', { id: 'dry', x: '-10%', y: '-10%', width: '120%', height: '120%' },
      s('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.6 0.035', numOctaves: '2', seed: '11', result: 'n' }),
      s('feColorMatrix', { in: 'n', type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 1.55', result: 'm' }),
      s('feComposite', { in: 'SourceGraphic', in2: 'm', operator: 'in' })),
    s('filter', { id: 'mist', x: '-30%', y: '-60%', width: '160%', height: '220%' }, s('feGaussianBlur', { stdDeviation: '26' })),
    s('linearGradient', { id: 'sky', x1: 0, y1: 0, x2: 0, y2: 1 },
      s('stop', { offset: 0, 'stop-color': p.ink, 'stop-opacity': 0.1 }),
      s('stop', { offset: 0.55, 'stop-color': p.ink, 'stop-opacity': 0 })),
    s('linearGradient', { id: 'fade', x1: 0, y1: 0, x2: 0, y2: 1 },
      s('stop', { offset: 0, 'stop-color': p.ink, 'stop-opacity': 1 }),
      s('stop', { offset: 1, 'stop-color': p.ink, 'stop-opacity': 0 })),
    s('linearGradient', { id: 'crag', x1: 0, y1: 0, x2: 1, y2: 0.3 },
      s('stop', { offset: 0, 'stop-color': p.ink, 'stop-opacity': 0.55 }),
      s('stop', { offset: 0.55, 'stop-color': p.ink, 'stop-opacity': 0.2 }),
      s('stop', { offset: 1, 'stop-color': p.ink, 'stop-opacity': 0.04 }))),
  s('rect', { width: 1000, height: 1000, fill: p.bg }),
  s('rect', { width: 1000, height: 1000, fill: 'url(#sky)' }))
  return svg
}

/** Red sun or moon with a soft halo. */
const orb = (p: Pal, x: number, y: number, r: number) => [
  s('circle', { cx: x, cy: y, r: r * 1.5, fill: p.verm, 'fill-opacity': 0.1, filter: 'url(#mist)' }),
  s('circle', { cx: x, cy: y, r, fill: p.verm, 'fill-opacity': 0.9, filter: 'url(#wash)' }),
]

const birds = (p: Pal, pts: Pt[]) =>
  pts.map(([x, y], i) => B([[x - 13, y - 5], [x - 2, y + 2], [x + 15, y - 7 - i]], 4.5, p.ink, { a: 0.3, b: 0.4 }))

const mistBand = (p: Pal, cx: number, cy: number, rx: number, ry: number, op = 0.95) =>
  P(ell(cx, cy, rx, ry), p.bg, { 'fill-opacity': op, filter: 'url(#mist)' })

/** Pine needle pads: a pale wash under a fan of short needle strokes radiating upwards. */
function pad(p: Pal, x: number, y: number, rx: number, ry: number, seed: number) {
  const r = rng(seed)
  const g = s('g')
  g.append(P(blob(x, y, rx * 1.05, ry * 0.95, seed, 0.2, 20), p.ink, { 'fill-opacity': 0.22, filter: 'url(#wash)' }))
  const n = Math.round(10 + rx / 3)
  const fan = s('g', { filter: 'url(#rough)' })
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const x0 = x + (t - 0.5) * rx * 1.5
    const y0 = y + ry * 0.45 - Math.sin(t * Math.PI) * ry * 0.35
    const a = -Math.PI / 2 + (t - 0.5) * 2.3 + (r() - 0.5) * 0.25
    const len = ry * (1.3 + r() * 0.8) * (0.75 + Math.sin(t * Math.PI) * 0.4)
    fan.append(B([[x0, y0], [x0 + Math.cos(a) * len * 0.55, y0 + Math.sin(a) * len * 0.55], [x0 + Math.cos(a) * len, y0 + Math.sin(a) * len]], 3.6 + r() * 1.6, p.ink, { a: 0.05, b: 0.75, min: 0.1 }, { 'fill-opacity': (0.65 + r() * 0.3).toFixed(2) }))
  }
  // the base line that gathers the needles
  fan.append(B([[x - rx * 0.78, y + ry * 0.5], [x, y + ry * 0.62], [x + rx * 0.78, y + ry * 0.45]], 3.2, p.ink, { a: 0.1, b: 0.3 }, { 'fill-opacity': 0.8 }))
  g.append(fan)
  return g
}

/** A trunk: a pale body, a dark contour on the shadow side and a few bark marks. */
function trunk(p: Pal, pts: Pt[], w: number, seed: number) {
  const r = rng(seed)
  const g = s('g', { filter: 'url(#rough)' })
  g.append(B(pts, w, p.ink, { a: 0.03, b: 0.65, min: 0.14, wob: 0.15 }, { 'fill-opacity': 0.55 }))
  g.append(B(pts.map(([x, y]) => [x - w * 0.32, y + w * 0.08] as Pt), w * 0.3, p.ink, { a: 0.05, b: 0.6, min: 0.2, wob: 0.3 }, { 'fill-opacity': 0.9 }))
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i]
    g.append(B([[x - w * 0.2, y - 3], [x + w * 0.15 + r() * 4, y + 4]], w * 0.18, p.ink, { a: 0.2, b: 0.4 }, { 'fill-opacity': 0.7 }))
  }
  return g
}

function pagoda(p: Pal, cx: number, by: number) {
  const g = s('g', { filter: 'url(#rough)' })
  g.append(P(`M${cx - 66} ${by}L${cx + 66} ${by}L${cx + 58} ${by - 12}L${cx - 58} ${by - 12}Z`, p.ink, { 'fill-opacity': 0.9 }))
  let y = by - 12
  ;[[118, 36], [96, 30], [76, 26]].forEach(([w, hh]) => {
    // body with a lit doorway, then a roof whose eaves curl up
    g.append(P(`M${cx - w * 0.28} ${y}L${cx + w * 0.28} ${y}L${cx + w * 0.28} ${y - hh}L${cx - w * 0.28} ${y - hh}Z`, p.ink2, { 'fill-opacity': 0.92 }))
    g.append(P(`M${cx - 7} ${y}L${cx + 7} ${y}L${cx + 7} ${y - hh * 0.62}L${cx - 7} ${y - hh * 0.62}Z`, p.verm, { 'fill-opacity': 0.75 }))
    y -= hh
    const r = y + 2
    g.append(P(`M${cx - w / 2 - 6} ${r - 12}Q${cx - w / 2 + 14} ${r + 3} ${cx - w * 0.3} ${r + 1}L${cx + w * 0.3} ${r + 1}Q${cx + w / 2 - 14} ${r + 3} ${cx + w / 2 + 6} ${r - 12}L${cx + w * 0.2} ${r - 19}L${cx - w * 0.2} ${r - 19}Z`, p.ink))
    y = r - 19
  })
  g.append(B([[cx, y + 2], [cx, y - 46]], 5, p.ink, { a: 0.05, b: 0.6 }))
  for (const k of [0, 1, 2]) g.append(P(ell(cx, y - 12 - k * 9, 7 - k * 1.5, 2.2), p.ink))
  return g
}

function scenePagoda(p: Pal) {
  const svg = frame(p)
  const r = rng(7)
  svg.append(...orb(p, 700, 255, 112), ...birds(p, [[540, 200], [585, 232], [520, 248]]))
  for (const [base, h0, h1, op] of [[650, 110, 240, 0.09], [710, 70, 170, 0.15]] as const)
    for (const d of peaks(r, -60, 1060, base, h0, h1, 150)) svg.append(P(d, 'url(#fade)', { 'fill-opacity': op, filter: 'url(#wash)' }))
  svg.append(mistBand(p, 520, 700, 760, 70))
  // the crag: a pale wash (lit side left as paper), axe-cut dry strokes on the shadow side, broken contours
  const crag: Pt[] = [[-30, 1030], [18, 880], [58, 770], [96, 690], [126, 628], [150, 566], [182, 520], [206, 474], [236, 442], [266, 410], [300, 390], [338, 393], [370, 410], [392, 438], [404, 474], [428, 504], [454, 562], [474, 602], [506, 646], [546, 708], [594, 790], [650, 884], [706, 1030]]
  svg.append(P(`M${crag.map((q) => q.join(' ')).join('L')}Z`, 'url(#crag)', { filter: 'url(#wash)' }))
  const inside = (x: number, y: number) => {
    let c = false
    for (let i = 0, j = crag.length - 1; i < crag.length; j = i++) {
      const [xi, yi] = crag[i]
      const [xj, yj] = crag[j]
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
    }
    return c
  }
  const tex = s('g', { filter: 'url(#dry)' })
  for (let i = 0, n = 0; i < 400 && n < 34; i++) {
    const x = 40 + r() * 520
    const y = 420 + r() * 520
    // denser and darker towards the shadowed left flank
    if (!inside(x, y) || !inside(x + 50, y + 40) || r() > 1.15 - x / 560) continue
    n++
    // axe-cut strokes: each its own length, lean and weight, a few short and squat
    const len = r() < 0.3 ? 18 + r() * 26 : 40 + r() * 90
    const ang = 2.05 + (r() - 0.5) * 0.8
    const bend = (r() - 0.5) * 0.5
    tex.append(B([[x, y], [x + Math.cos(ang) * len * 0.5, y + Math.sin(ang) * len * 0.5], [x + Math.cos(ang + bend) * len, y + Math.sin(ang + bend) * len]], 8 + r() * 30, p.ink, { a: 0.04 + r() * 0.1, b: 0.4 + r() * 0.3 }, { 'fill-opacity': (0.22 + r() * 0.45).toFixed(2) }))
  }
  svg.append(tex)
  const ct = s('g', { filter: 'url(#rough)' })
  ct.append(B(crag.slice(1, 10).reverse(), 13, p.ink, { a: 0.05, b: 0.35, wob: 0.3 }))
  ct.append(B(crag.slice(10, 15), 10, p.ink, { a: 0.1, b: 0.3, wob: 0.3 }))
  ct.append(B(crag.slice(16, 21), 7, p.ink, { a: 0.3, b: 0.5, wob: 0.3 }, { 'fill-opacity': 0.75 }))
  for (const f of [[[262, 430], [236, 500], [244, 560], [214, 640]], [[340, 420], [318, 498], [330, 580], [300, 680], [312, 760]], [[150, 600], [128, 680], [140, 760]]] as Pt[][])
    ct.append(B(f, 6, p.ink, { a: 0.2, b: 0.6 }, { 'fill-opacity': 0.5 }))
  // moss dots along the ridge
  for (const [x, y] of [[214, 468], [246, 436], [372, 416], [400, 452], [134, 612], [104, 680], [432, 512]] as Pt[])
    ct.append(P(blob(x, y, 7 + r() * 5, 5 + r() * 3, Math.round(x), 0.3, 10), p.ink, { 'fill-opacity': 0.85 }))
  svg.append(ct, pagoda(p, 296, 392))
  // a pine leaning out from the cliff edge towards the moon
  svg.append(trunk(p, [[396, 440], [430, 414], [476, 398], [528, 372], [580, 364]], 17, 3),
    trunk(p, [[476, 398], [492, 352], [520, 330]], 7, 4),
    pad(p, 470, 376, 44, 14, 3), pad(p, 532, 350, 52, 15, 5), pad(p, 584, 362, 34, 11, 9), pad(p, 520, 320, 30, 10, 13), pad(p, 436, 404, 26, 9, 17))
  svg.append(mistBand(p, 360, 880, 560, 80), mistBand(p, 820, 820, 260, 40, 0.7))
  // a far mountain on the right standing out of the mist
  for (const d of peaks(rng(31), 700, 980, 820, 120, 160, 400)) svg.append(P(d, 'url(#fade)', { 'fill-opacity': 0.28, filter: 'url(#wash)' }))
  for (let i = 0; i < 6; i++) {
    const y = 900 + i * 16
    const x = 640 + r() * 200
    svg.append(B([[x, y], [x + 60 + r() * 110, y + (r() - 0.5) * 4]], 3 + r() * 2, p.ink, { a: 0.2, b: 0.4 }, { 'fill-opacity': 0.25 }))
  }
  return svg
}

function sceneLake(p: Pal) {
  const svg = frame(p)
  const r = rng(19)
  svg.append(...orb(p, 650, 430, 64), ...birds(p, [[760, 300], [800, 326]]))
  for (const [base, h0, h1, op, x1] of [[548, 50, 140, 0.13, 1060], [560, 30, 80, 0.22, 520]] as const)
    for (const d of peaks(r, -60, x1, base, h0, h1, 130)) svg.append(P(d, 'url(#fade)', { 'fill-opacity': op, filter: 'url(#wash)' }))
  svg.append(mistBand(p, 520, 552, 700, 26))
  const water = s('g', { filter: 'url(#rough)' })
  for (let i = 0; i < 26; i++) {
    const y = 585 + (i / 26) ** 1.3 * 400
    const x = r() * 900
    water.append(B([[x, y], [x + 50 + r() * 200, y + (r() - 0.5) * 3]], 2.5 + (i / 26) * 4, p.ink, { a: 0.3, b: 0.4 }, { 'fill-opacity': 0.12 + r() * 0.18 }))
  }
  for (let i = 0; i < 10; i++) {
    const y = 572 + i * 15
    const hw = 52 - i * 4 + r() * 10
    const x = 650 + (r() - 0.5) * 16
    water.append(B([[x - hw, y], [x + hw, y + (r() - 0.5) * 2]], 7 - i * 0.4, p.verm, { a: 0.3, b: 0.3 }, { 'fill-opacity': 0.75 - i * 0.06 }))
  }
  svg.append(water)
  // the boat and the fisherman, mirrored faintly
  const boat = s('g', { filter: 'url(#rough)' })
  boat.append(
    P(`M440 676Q500 640 560 676Z`, p.ink, { 'fill-opacity': 0.72 }),
    B([[392, 674], [450, 700], [550, 702], [616, 672]], 26, p.ink, { a: 0.25, b: 0.25, min: 0.3 }),
    B([[592, 676], [596, 634]], 11, p.ink, { a: 0.2, b: 0.2 }),
    P('M572 636L620 636L596 616Z', p.ink),
    B([[600, 652], [700, 560]], 3.2, p.ink, { a: 0.05, b: 0.4 }),
    B([[700, 560], [706, 640]], 1.4, p.ink2, { a: 0, b: 0 }, { 'fill-opacity': 0.6 }))
  svg.append(boat)
  for (let i = 0; i < 5; i++) svg.append(B([[420 + i * 8, 726 + i * 11], [600 - i * 12, 724 + i * 11]], 7 - i, p.ink, { a: 0.3, b: 0.3 }, { 'fill-opacity': 0.24 - i * 0.03, filter: 'url(#dry)' }))
  // a pine on a rock in the foreground, reaching over the water
  // the rock: a pale wash, a few axe-cut strokes, one dark contour along its top
  svg.append(P(blob(140, 960, 250, 90, 4, 0.12), p.ink, { 'fill-opacity': 0.32, filter: 'url(#wash)' }))
  const rock = s('g', { filter: 'url(#dry)' })
  for (let i = 0; i < 9; i++) rock.append(B([[30 + i * 34, 900 + (i % 3) * 14], [10 + i * 34, 970]], 22, p.ink, { a: 0.1, b: 0.5 }, { 'fill-opacity': 0.4 }))
  svg.append(rock, B([[-20, 900], [80, 872], [200, 878], [330, 920], [400, 1000]], 8, p.ink, { a: 0.05, b: 0.4, wob: 0.3 }, { filter: 'url(#rough)' }))
  svg.append(trunk(p, [[118, 905], [150, 790], [128, 660], [176, 526], [244, 436], [334, 394], [436, 366], [534, 356]], 30, 5),
    trunk(p, [[176, 528], [112, 478], [60, 446]], 12, 9),
    pad(p, 250, 404, 66, 20, 21), pad(p, 364, 364, 76, 22, 23), pad(p, 474, 340, 60, 18, 25), pad(p, 92, 444, 44, 15, 27), pad(p, 196, 474, 40, 13, 29), pad(p, 304, 336, 42, 13, 31), pad(p, 548, 350, 34, 11, 33))
  return svg
}

/** A lotus pad from above: one wash with its notch left as a gap of paper, veins radiating from the centre. */
function leaf(p: Pal, x: number, y: number, rad: number, notch: number, seed: number) {
  const r = rng(seed)
  const a0 = (notch * Math.PI) / 180
  const gap = 0.07 + r() * 0.05
  const pts: Pt[] = [[x, y]]
  const n = 40
  for (let i = 0; i <= n; i++) {
    const a = a0 + gap + (i / n) * (Math.PI * 2 - 2 * gap)
    const w = 1 + Math.sin(a * 3 + seed) * 0.03 + Math.sin(a * 7 + seed * 2) * 0.015
    pts.push([x + Math.cos(a) * rad * w, y + Math.sin(a) * rad * 0.94 * w])
  }
  const outline = `M${pts.map((q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join('L')}Z`
  const g = s('g')
  g.append(P(outline, p.moss, { 'fill-opacity': 0.5, filter: 'url(#wash)' }),
    // a deeper wash pooled on one side, the rim lit on the other
    P(blob(x + rad * 0.18, y + rad * 0.14, rad * 0.62, rad * 0.55, seed + 3, 0.12, 22), p.moss, { 'fill-opacity': 0.22, filter: 'url(#wash)' }))
  const veins = s('g', { filter: 'url(#rough)' })
  const nv = 13
  for (let k = 0; k < nv; k++) {
    const t = a0 + gap * 1.6 + (k / (nv - 1)) * (Math.PI * 2 - 3.2 * gap)
    const bend = (r() - 0.5) * 0.12
    veins.append(B([[x + Math.cos(t) * rad * 0.06, y + Math.sin(t) * rad * 0.06], [x + Math.cos(t + bend) * rad * 0.5, y + Math.sin(t + bend) * rad * 0.47], [x + Math.cos(t + bend * 1.6) * rad * 0.9, y + Math.sin(t + bend * 1.6) * rad * 0.85]], Math.max(2.4, rad * 0.022), p.moss2, { a: 0.05, b: 0.75 }, { 'fill-opacity': 0.55 }))
  }
  // the rim: a broken darker contour on the shadow side only
  const rim = pts.slice(Math.round(n * 0.45), Math.round(n * 0.85) + 1)
  g.append(veins, B(rim, Math.max(3, rad * 0.03), p.moss2, { a: 0.2, b: 0.3, wob: 0.3 }, { 'fill-opacity': 0.6, filter: 'url(#rough)' }), P(ell(x, y, rad * 0.045), p.moss2))
  return g
}

/**
 * A koi in a few brush strokes: a body that swells behind the head and thins to the tail, translucent fins,
 * a split tail flicked as two strokes, coloured patches washed in, and a few dry-brush scale marks.
 */
function koi(p: Pal, spine: Pt[], w: number, body: string, spot: string, seed: number, op = 0.92, spotOp = 0.9) {
  const r = rng(seed)
  const g = s('g')
  const n = spine.length - 1
  const at = (t: number): Pt => {
    const i = Math.min(n - 1, Math.floor(t * n))
    const f = t * n - i
    return [spine[i][0] + (spine[i + 1][0] - spine[i][0]) * f, spine[i][1] + (spine[i + 1][1] - spine[i][1]) * f]
  }
  const dir = (t: number) => {
    const [ax, ay] = at(Math.max(0, t - 0.03))
    const [bx, by] = at(Math.min(1, t + 0.03))
    return Math.atan2(by - ay, bx - ax)
  }
  const off = (t: number, side: number, k: number): Pt => {
    const [x, y] = at(t)
    const d = dir(t) + (side * Math.PI) / 2
    return [x + Math.cos(d) * w * k, y + Math.sin(d) * w * k]
  }
  // head → tail width: a rounded head, fullest a third of the way down, a slender tail root
  const prof = (t: number) => (t < 0.3 ? 0.6 + 0.4 * Math.sin((t / 0.3) * (Math.PI / 2)) : Math.max(0.1, Math.cos(((t - 0.3) / 0.7) * (Math.PI / 2)) ** 1.25))
  const shadow = spine.map(([x, y]) => [x + 22, y + 30] as Pt)
  g.append(B(shadow, w, p.ink, { a: 0, b: 0, min: 0.05, wf: prof }, { 'fill-opacity': 0.1, filter: 'url(#mist)' }))
  // pectoral fins: two pale fans swept back from behind the head
  for (const sd of [-1, 1]) {
    const [fx, fy] = off(0.22, sd, 0.3)
    const d = dir(0.22) + sd * 2.2
    g.append(B([[fx, fy], [fx + Math.cos(d) * w * 0.45, fy + Math.sin(d) * w * 0.45], [fx + Math.cos(d + sd * 0.45) * w * 0.8, fy + Math.sin(d + sd * 0.45) * w * 0.8]], w * 0.4, p.ink, { a: 0.05, b: 0.55, min: 0.1 }, { 'fill-opacity': 0.13, filter: 'url(#wash)' }))
    g.append(B([[fx, fy], [fx + Math.cos(d + sd * 0.3) * w * 0.75, fy + Math.sin(d + sd * 0.3) * w * 0.75]], 2.2, p.ink, { a: 0.1, b: 0.6 }, { 'fill-opacity': 0.25 }))
  }
  // the split tail: two strokes flicked apart from the tail root
  const [tx, ty] = at(0.97)
  const td = dir(0.95)
  for (const sd of [-1, 1]) {
    const d = td + sd * 0.38
    // each lobe a veil of thin ink, curling at its tip
    const tip: Pt = [tx + Math.cos(d + sd * 0.35) * w * 1.45, ty + Math.sin(d + sd * 0.35) * w * 1.45]
    const mid: Pt = [tx + Math.cos(d) * w * 0.75, ty + Math.sin(d) * w * 0.75]
    g.append(B([[tx - Math.cos(td) * w * 0.2, ty - Math.sin(td) * w * 0.2], mid, tip], w * 0.62, p.ink, { a: 0.15, b: 0.75, min: 0.05 }, { 'fill-opacity': 0.14, filter: 'url(#wash)' }))
    g.append(B([[tx, ty], [mid[0] + Math.cos(d + sd * 1.57) * w * 0.12, mid[1] + Math.sin(d + sd * 1.57) * w * 0.12], tip], 2.6, p.ink, { a: 0.1, b: 0.6 }, { 'fill-opacity': 0.4, filter: 'url(#rough)' }))
    g.append(B([[tx, ty], [mid[0] - Math.cos(d + sd * 1.57) * w * 0.1, mid[1] - Math.sin(d + sd * 1.57) * w * 0.1], [tip[0] - Math.cos(td) * w * 0.25, tip[1] - Math.sin(td) * w * 0.25]], 1.6, p.ink, { a: 0.2, b: 0.6 }, { 'fill-opacity': 0.25 }))
  }
  // a dark contour first (it shows round the pale body), then the body itself
  g.append(B(spine, w + 6, p.ink, { a: 0, b: 0, min: 0.05, wf: prof, wob: 0.05 }, { 'fill-opacity': 0.55, filter: 'url(#rough)' }),
    B(spine, w, body, { a: 0, b: 0, min: 0.05, wf: prof, wob: 0.03 }, { 'fill-opacity': op, filter: 'url(#rough)' }))
  // patches of colour, washed in along the back
  for (const [t0, k, len] of [[0.12, 0.55, 0.16], [0.42, 0.42, 0.2], [0.7, 0.3, 0.1]]) {
    const t1 = t0 + r() * 0.04
    const pts: Pt[] = [off(t1, (r() - 0.5) * 0.4, 0.1), at(t1 + len * 0.5), off(t1 + len, (r() - 0.5) * 0.4, 0.08)]
    g.append(B(pts, w * k * prof(t1 + len * 0.5), spot, { a: 0.3, b: 0.4, wob: 0.3 }, { 'fill-opacity': spotOp, filter: 'url(#wash)' }))
  }
  // dorsal fin: a dark line along the spine
  g.append(B([at(0.3), at(0.45), at(0.62)], w * 0.09, p.ink, { a: 0.25, b: 0.5 }, { 'fill-opacity': 0.35, filter: 'url(#rough)' }))
  // dry-brush scale marks on the shoulders
  const scales = s('g', { filter: 'url(#dry)' })
  for (let i = 0; i < 9; i++) {
    const t = 0.26 + i * 0.045
    const side = i % 2 ? 1 : -1
    const [x, y] = off(t, side, 0.22 * prof(t))
    const d = dir(t)
    scales.append(B([[x - Math.cos(d + 0.9 * side) * w * 0.08, y - Math.sin(d + 0.9 * side) * w * 0.08], [x, y], [x + Math.cos(d - 0.9 * side) * w * 0.08, y + Math.sin(d - 0.9 * side) * w * 0.08]], w * 0.06, p.ink, { a: 0.3, b: 0.3 }, { 'fill-opacity': 0.4 }))
  }
  g.append(scales)
  // eyes and a hint of the mouth
  for (const sd of [-1, 1]) {
    const [ex, ey] = off(0.07, sd, 0.2)
    g.append(P(ell(ex, ey, w * 0.045), p.ink))
  }
  const [mx, my] = at(0)
  const md = dir(0.02)
  g.append(B([[mx + Math.cos(md + 1.4) * w * 0.12, my + Math.sin(md + 1.4) * w * 0.12], [mx - Math.cos(md) * w * 0.04, my - Math.sin(md) * w * 0.04], [mx + Math.cos(md - 1.4) * w * 0.12, my + Math.sin(md - 1.4) * w * 0.12]], 2.4, p.ink, { a: 0.2, b: 0.2 }, { 'fill-opacity': 0.5 }))
  return g
}

function sceneKoi(p: Pal) {
  const svg = frame(p)
  const ring = s('g', { filter: 'url(#rough)' })
  for (const [x, y, rr] of [[520, 520, 70], [520, 520, 130], [520, 520, 200], [330, 760, 60], [330, 760, 112]] as const)
    ring.append(P(brush(Array.from({ length: 33 }, (_, i) => [x + Math.cos(i / 5) * rr, y + Math.sin(i / 5) * rr * 0.92] as Pt), 3, { a: 0.2, b: 0.3 }).d, p.ink, { 'fill-opacity': 0.08 }))
  svg.append(ring, leaf(p, 200, 220, 190, 40, 2), leaf(p, 860, 170, 150, 140, 5), leaf(p, 120, 860, 130, 320, 9))
  // a kohaku (white with vermilion) and a dark koi circling each other
  svg.append(koi(p, [[372, 330], [440, 400], [510, 470], [566, 560], [598, 660], [596, 760]], 96, p.bg, p.verm, 3, 1))
  // the other one is all ink: a pale wash body with darker sumi patches
  svg.append(koi(p, [[800, 560], [722, 628], [632, 670], [530, 676], [440, 644]], 74, p.ink, p.ink, 11, 0.32, 0.55))
  svg.append(leaf(p, 830, 840, 210, 230, 13), leaf(p, 560, 120, 64, 200, 17))
  return svg
}

const SCENES = [scenePagoda, sceneLake, sceneKoi]

/** Rasterise painting i into a square canvas. */
export function paintCanvas(i: number, p: Pal, size = 1024): Promise<HTMLCanvasElement> {
  const svg = SCENES[i](p)
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }))
  return new Promise((ok, fail) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = c.height = size
      c.getContext('2d')!.drawImage(img, 0, 0, size, size)
      URL.revokeObjectURL(url)
      ok(c)
    }
    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      fail(e)
    }
    img.src = url
  })
}
