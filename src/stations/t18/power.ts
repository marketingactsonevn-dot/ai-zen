import { h, nextId, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { C } from './data'
import { arc, brush, clamp, ell, fit, later, peaks, place, poly, rng, stable, stone, stoneDefs, stroke, wash, watch, type Pt } from './ink'

const S = C.scenes.power
const VW = 800
const VH = 560
type Tween = ReturnType<typeof gsap.to>

// ───────── drawing helpers (viewBox units) ─────────

/** A lattice transmission tower; returns its wire attachment points (upper L/R, lower L/R). */
function pylon(x: number, base: number, hg: number, ink: SVGGElement, thin: SVGGElement) {
  const k = hg / 200
  const w = hg * 0.3
  const topY = base - hg
  const neck = base - hg * 0.86
  const L0: Pt = [x - w / 2, base]
  const R0: Pt = [x + w / 2, base]
  const L1: Pt = [x - hg * 0.035, neck]
  const R1: Pt = [x + hg * 0.035, neck]
  const lx = (y: number) => L0[0] + ((L1[0] - L0[0]) * (base - y)) / (base - neck)
  const rx = (y: number) => R0[0] + ((R1[0] - R0[0]) * (base - y)) / (base - neck)
  ink.append(
    stroke([L0, L1], 3.4 * k + 0.6, 'k', { straight: true, a: 0.02, b: 0.12, min: 0.5 }),
    stroke([R0, R1], 3 * k + 0.6, 'k', { straight: true, a: 0.02, b: 0.12, min: 0.5 }),
    stroke([L1, [x, topY], R1], 2.2 * k + 0.5, 'k', { straight: true, a: 0.1, b: 0.1, min: 0.5 }),
  )
  // lattice: zig-zag braces between the legs
  const zig: Pt[] = []
  for (let i = 0, y = base; y > neck + 2; i++, y -= hg * 0.085) zig.push([i % 2 ? rx(y) : lx(y), y])
  thin.append(stroke(zig, 1.3 * k + 0.35, 'k2', { straight: true, a: 0.02, b: 0.05, min: 0.6, wob: 0 }))
  const y1 = base - hg * 0.6
  const y2 = base - hg * 0.79
  const s1 = hg * 0.3
  const s2 = hg * 0.21
  for (const [yy, sp] of [[y1, s1], [y2, s2]]) {
    ink.append(stroke([[x - sp, yy], [x + sp, yy]], 2.4 * k + 0.5, 'k', { straight: true, a: 0.06, b: 0.06, min: 0.5 }))
    thin.append(
      stroke([[x - sp, yy], [lx(yy + hg * 0.07), yy + hg * 0.07]], 1.2 * k + 0.3, 'k2', { straight: true, a: 0.05, b: 0.05, min: 0.6 }),
      stroke([[x + sp, yy], [rx(yy + hg * 0.07), yy + hg * 0.07]], 1.2 * k + 0.3, 'k2', { straight: true, a: 0.05, b: 0.05, min: 0.6 }),
    )
  }
  // insulators hang under each arm tip
  const tips: Pt[] = []
  for (const [yy, sp] of [[y2, s2], [y1, s1]]) {
    for (const sd of [-1, 1]) {
      const t: Pt = [x + sd * sp * 0.94, yy + hg * 0.055]
      ink.append(stroke([[t[0], yy], t], 2 * k + 0.4, 'k', { straight: true, a: 0.2, b: 0.2, min: 0.6, wob: 0 }))
      tips.push(t)
    }
  }
  return tips
}

type Layers = { body: SVGGElement; ink: SVGGElement; thin: SVGGElement; dry: SVGGElement }

/** A hyperbolic cooling tower in ink: a paper body with a washed shadow flank, dry-brush grain, a broken outline. */
function tower(cx: number, base: number, top: number, hw0: number, hww: number, g: Layers) {
  const H = base - top
  const yw = top + 0.2 * H
  const c = (base - yw) / Math.sqrt((hw0 / hww) ** 2 - 1)
  const half = (y: number) => hww * Math.sqrt(1 + ((y - yw) / c) ** 2)
  const left: Pt[] = []
  const right: Pt[] = []
  const at = (f: number, side: number): Pt => {
    const y = top + H * f
    return [cx + side * half(y), y]
  }
  for (let i = 0; i <= 16; i++) {
    left.push(at(i / 16, -1))
    right.push(at(i / 16, 1))
  }
  const ht = half(top)
  const k = hw0 / 56
  const shade = (f0: number, f1: number) => {
    const pts: Pt[] = []
    for (let i = 0; i <= 16; i++) pts.push([cx - half(top + (H * i) / 16) * f0, top + (H * i) / 16])
    for (let i = 16; i >= 0; i--) pts.push([cx - half(top + (H * i) / 16) * f1, top + (H * i) / 16])
    return poly(pts)
  }
  g.body.append(
    s('path', { d: poly([...left, ...right.slice().reverse()]), class: 'p' }),
    wash(poly([...left, ...right.slice().reverse()]), 0.06),
    // the shadow flank, darkest at the edge, and a lighter wash turning toward the light
    wash(shade(1, 0.38), 0.17),
    wash(shade(1, 0.75), 0.12),
    wash(ell(cx, top + 1, ht * 0.96, ht * 0.17), 0.55),
  )
  // dry-brush grain dragged down the shadow side
  for (const [f, w, op] of [[0.86, 9, 0.2], [0.66, 7, 0.14], [0.46, 6, 0.1], [-0.6, 5, 0.06]] as const) {
    const pts: Pt[] = []
    for (let i = 1; i <= 15; i++) {
      const y = top + (H * i) / 16
      pts.push([cx - half(y) * f, y])
    }
    g.dry.append(stroke(pts, w * k, 'k', { a: 0.1, b: 0.2, min: 0.5, wob: 0.2 }, op))
  }
  // a broken outline: heavy on the shadow side, lifting off where the light falls
  g.ink.append(
    stroke(left.slice(0, 9), 3.2 * k, 'k', { a: 0.04, b: 0.3, min: 0.3 }),
    stroke(left.slice(10), 3.6 * k, 'k', { a: 0.2, b: 0.12, min: 0.35 }),
    stroke(right.slice(1, 7), 1.5 * k, 'k', { a: 0.2, b: 0.4, min: 0.25 }, 0.7),
    stroke(right.slice(9, 16), 1.8 * k, 'k', { a: 0.3, b: 0.3, min: 0.25 }, 0.75),
    stroke(arc(cx, top + 1, ht, ht * 0.18, 172, 300, 14), 2.4 * k, 'k', { a: 0.1, b: 0.3 }),
    stroke(arc(cx, top + 1, ht, ht * 0.18, 318, 372, 8), 1.4 * k, 'k', { a: 0.3, b: 0.3 }, 0.7),
    stroke(arc(cx, top + 1.5, ht * 0.98, ht * 0.17, 14, 160, 14), 1.2 * k, 'k2', { a: 0.3, b: 0.4 }, 0.5),
  )
  // legs: little arches at the foot, and the basin rim
  const n = 7
  for (let i = 0; i < n; i++) {
    const x = cx - hw0 * 0.9 + (i * hw0 * 1.8) / (n - 1)
    g.ink.append(stroke([[x - 3.5 * k, base], [x, base - 7 * k], [x + 3.5 * k, base]], 1.2 * k, 'k', { straight: true, a: 0.1, b: 0.1, min: 0.5 }, 0.7))
  }
  g.body.append(wash(poly([[cx - hw0 * 1.02, base - 7 * k], [cx + hw0 * 1.02, base - 7 * k], [cx + hw0 * 1.02, base], [cx - hw0 * 1.02, base]]), 0.2))
  g.ink.append(stroke([[cx - hw0 * 1.04, base - 7 * k], [cx + hw0 * 1.02, base - 7.5 * k]], 1.6 * k, 'k', { a: 0.05, b: 0.4 }, 0.7))
  return { mouth: [cx, top] as Pt, ht }
}

/** The server room seen through a cut-away: an ink-wash band, racks as dry vertical strokes. Returns the rack columns. */
function racks(x0: number, x1: number, y0: number, y1: number, n: number, g: Layers, r: () => number) {
  g.body.append(wash(poly([[x0, y0], [x1, y0 + 1], [x1, y1], [x0, y1 - 1]]), 0.5, 'sh rk'))
  const cols: [number, number][] = []
  const w = (x1 - x0) / n
  for (let i = 0; i < n; i++) {
    const x = x0 + w * i + w * 0.14
    const cw = w * 0.72
    cols.push([x, cw])
    g.dry.append(
      stroke([[x + cw * 0.5, y0 + 3], [x + cw * 0.52, y1 - 3]], cw * (0.9 + r() * 0.15), 'k2 rk', { straight: true, a: 0.04, b: 0.08, min: 0.7, wob: 0.12 }, 0.3 + r() * 0.12),
    )
    g.ink.append(stroke([[x + 0.6, y0 + 4 + r() * 4], [x + 0.4, y1 - 3 - r() * 6]], 1.4, 'sh', { straight: true, a: 0.1, b: 0.3, min: 0.3 }, 0.55))
  }
  return cols
}

/** A long low hall seen from the front, with a cut-away band showing the racks. */
function hall(x0: number, x1: number, roof: number, base: number, depth: number, g: Layers) {
  const dx = depth
  const dy = -depth * 0.65
  g.body.append(
    s('path', { class: 'p', d: poly([[x0, base], [x0, roof], [x0 + dx, roof + dy], [x1 + dx, roof + dy], [x1 + dx, base + dy * 0.8], [x1, base]]) }),
    wash(poly([[x0, roof], [x1, roof], [x1 + dx, roof + dy], [x0 + dx, roof + dy]]), 0.14),
    wash(poly([[x1, roof], [x1 + dx, roof + dy], [x1 + dx, base + dy * 0.8], [x1, base]]), 0.24),
    wash(poly([[x0, roof], [x1, roof], [x1, base], [x0, base]]), 0.05),
  )
  g.ink.append(
    stroke([[x0 - 4, roof], [x1 + 2, roof]], 3.6, 'k', { straight: true, a: 0.03, b: 0.12 }),
    stroke([[x0, roof], [x0 + dx, roof + dy], [x1 + dx, roof + dy]], 1.8, 'k', { straight: true, a: 0.05, b: 0.15 }),
    stroke([[x1, roof], [x1 + dx, roof + dy], [x1 + dx, base + dy * 0.8]], 1.6, 'k', { straight: true, a: 0.05, b: 0.3 }),
    stroke([[x0, roof + 2], [x0, base]], 3, 'k', { straight: true, a: 0.05, b: 0.1 }),
    stroke([[x1, roof + 2], [x1, base]], 2.2, 'k', { straight: true, a: 0.05, b: 0.2 }),
    stroke([[x0 - 10, base], [x1 + dx + 6, base - 1]], 2.6, 'k', { a: 0.03, b: 0.2 }),
  )
}

// ───────── the scene ─────────

export function powerScene(ctx: SceneCtx) {
  const r = rng(18)
  const low = ctx.quality === 'low'
  const uid = nextId('t18p')
  const id = (n: string) => `${uid}-${n}`

  const svg = s('svg', { class: 't18p-svg', viewBox: `0 0 ${VW} ${VH}`, 'aria-hidden': 'true' })
  // everything that moves lives in its own unfiltered layer, so the ink filters below are painted once
  const over = s('svg', { class: 't18p-svg t18p-over', viewBox: `0 0 ${VW} ${VH}`, 'aria-hidden': 'true' })
  const defs = s('defs', null,
    stoneDefs(),
    s('linearGradient', { id: id('fade'), x1: 0, y1: 0, x2: 0, y2: 1 },
      s('stop', { offset: 0, class: 'fd0' }), s('stop', { offset: 1, class: 'fd1' })),
    s('radialGradient', { id: id('steam') }, s('stop', { offset: 0, class: 'sm0' }), s('stop', { offset: 0.55, class: 'sm1' }), s('stop', { offset: 1, class: 'sm2' })),
    s('radialGradient', { id: id('steamhi') }, s('stop', { offset: 0, class: 'smh0' }), s('stop', { offset: 1, class: 'smh1' })),
    s('radialGradient', { id: id('haze') }, s('stop', { offset: 0, class: 'hz0' }), s('stop', { offset: 0.6, class: 'hz1' }), s('stop', { offset: 1, class: 'hz2' })),
    s('radialGradient', { id: id('heat') }, s('stop', { offset: 0, class: 'ht0' }), s('stop', { offset: 1, class: 'ht1' })),
    s('linearGradient', { id: id('hfade'), x1: 0, y1: 0, x2: 1, y2: 0 },
      s('stop', { offset: 0, 'stop-color': '#fff' }), s('stop', { offset: 0.62, 'stop-color': '#fff' }), s('stop', { offset: 1, 'stop-color': '#000' })),
    s('linearGradient', { id: id('pfade'), x1: 0, y1: 0, x2: 1, y2: 0 },
      s('stop', { offset: 0, 'stop-color': '#000' }), s('stop', { offset: 0.14, 'stop-color': '#fff' }), s('stop', { offset: 0.9, 'stop-color': '#fff' }), s('stop', { offset: 1, 'stop-color': '#000' })),
    s('linearGradient', { id: id('vfade'), x1: 0, y1: 0, x2: 0, y2: 1 },
      s('stop', { offset: 0, 'stop-color': '#fff' }), s('stop', { offset: 0.55, 'stop-color': '#fff' }), s('stop', { offset: 1, 'stop-color': '#000' })),
    s('mask', { id: id('rake'), maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: VW, height: VH },
      s('rect', { x: -20, y: 460, width: 360, height: 110, fill: `url(#${id('hfade')})` }),
      s('path', { d: ell(128, 506, 62, 24), fill: '#000' })),
    s('mask', { id: id('pond'), maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: VW, height: VH },
      s('rect', { x: 240, y: 440, width: 580, height: 130, fill: `url(#${id('pfade')})` })),
  )
  svg.append(defs)

  const layer = (filter?: string, cls?: string) => {
    const g = s('g', { filter: filter && !low ? `url(#${filter})` : undefined, class: cls })
    svg.append(g)
    return g
  }

  // sky: a soft dusk sun, far ridges dissolving into the haze
  const sky = layer()
  // the dusk sun: a vermilion wash that bleeds into the paper, no rim
  const bleed = low ? null : { filter: 'url(#ink-wash)' }
  sky.append(
    s('circle', { cx: 320, cy: 146, r: 50, class: 'sunsoft', 'fill-opacity': 0.28, ...bleed }),
    s('circle', { cx: 318, cy: 143, r: 38, class: 'sunsoft', 'fill-opacity': 0.85, ...bleed }),
    s('path', { class: 'sunsoft', 'fill-opacity': 0.5, d: ell(312, 136, 22, 18), ...bleed }),
  )
  const ridges = layer('ink-wash')
  for (const [b, h0, h1, op] of [[352, 34, 92, 0.07], [366, 22, 58, 0.1]] as const) {
    for (const d of peaks(r, -40, 840, b, h0, h1, 96)) ridges.append(s('path', { d, fill: `url(#${id('fade')})`, 'fill-opacity': op }))
  }

  // a low band of evening mist where the far ridges meet the plain
  svg.append(s('ellipse', { cx: 470, cy: 366, rx: 520, ry: 30, fill: `url(#${id('haze')})` }), s('ellipse', { cx: 700, cy: 330, rx: 260, ry: 22, fill: `url(#${id('haze')})` }))

  // 2030: the skyline grows — a second hall and a third tower rise behind (hidden until then)
  const more = s('g', { class: 't18p-more', opacity: 0 })
  svg.append(more)
  {
    const g = { body: s('g', low ? null : { filter: 'url(#ink-wash)' }), dry: s('g', low ? null : { filter: 'url(#ink-dry)' }), ink: s('g', low ? null : { filter: 'url(#ink-rough)' }), thin: s('g') }
    more.append(g.body, g.dry, g.ink, g.thin)
    hall(388, 604, 244, 300, 22, g)
    racks(398, 594, 254, 292, 6, g, r)
    // roof fans on the new hall, standing still in the distance
    for (const fx of [440, 500, 560]) {
      g.body.append(wash(ell(fx, 236, 13, 4.2), 0.16))
      g.ink.append(stroke(arc(fx, 236, 13, 4.2, 0, 180, 12), 1.3, 'k', { a: 0.2, b: 0.2 }, 0.8), stroke(arc(fx, 236, 13, 4.2, 200, 330, 10), 0.9, 'k', { a: 0.3, b: 0.3 }, 0.5))
    }
    tower(728, 420, 206, 46, 28, g)
  }

  // ground, pond and raked sand — all edges dissolve into the paper
  const ground = layer('ink-wash')
  ground.append(wash(ell(420, 444, 400, 16), 0.08), wash(ell(560, 452, 260, 9), 0.06))
  const pond = s('g', { mask: `url(#${id('pond')})` })
  svg.append(pond)
  const pondWash = s('g', low ? null : { filter: 'url(#ink-wash)' })
  pond.append(pondWash)
  for (let i = 0; i < 9; i++) {
    const y = 462 + i * 10 + r() * 4
    const x0 = 250 + r() * 60
    const x1 = 760 + r() * 60
    pondWash.append(stroke([[x0, y], [(x0 + x1) / 2, y - 1.5 + r() * 3], [x1, y + 1]], 10 + r() * 9, 'k', { a: 0.25, b: 0.3, min: 0.2, wob: 0.15 }, 0.035 + (i < 2 ? 0.03 : 0) + r() * 0.025))
  }
  // reflections: each structure is answered in the water by broken horizontal strokes
  for (const [x0, x1, op] of [[338, 602, 0.16], [636, 746, 0.14], [740, 790, 0.11], [226, 254, 0.1]] as const) {
    for (let j = 0; j < 7; j++) {
      const y = 463 + j * 8.5 + r() * 2
      const shrink = (x1 - x0) * j * 0.06
      let x = x0 + shrink * 0.5 + r() * 6
      const end = x1 - shrink * 0.5
      while (x < end - 6) {
        const l = Math.min(end - x, 14 + r() * (x1 - x0) * 0.4)
        pondWash.append(stroke([[x, y], [x + l * 0.5, y + (r() - 0.5) * 1.5], [x + l, y]], 3.6 - j * 0.3, 'k', { a: 0.2, b: 0.3, min: 0.3 }, op * (1 - j * 0.11)))
        x += l + 4 + r() * 12
      }
    }
  }
  const water = s('g', low ? null : { filter: 'url(#ink-rough)' })
  pond.append(water)
  for (let i = 0; i < 16; i++) {
    const x = 290 + r() * 480
    const y = 468 + r() * 78
    const l = 14 + r() * 44
    water.append(stroke([[x, y], [x + l * 0.5, y - 0.6], [x + l, y]], 1 + r() * 0.9, 'k3', { a: 0.3, b: 0.4 }, 0.5))
  }
  const rake = s('g', { mask: `url(#${id('rake')})` })
  for (let i = 0; i < 8; i++) {
    const y = 472 + i * 11.5
    const pts: Pt[] = []
    for (let x = -10; x <= 330; x += 20) pts.push([x, y + Math.sin(x / 46 + i * 0.3) * 1.6])
    rake.append(stroke(pts, 1.1, 'k3', { a: 0.02, b: 0.02, min: 0.5, wob: 0.05 }, 0.6))
  }
  svg.append(rake)
  for (const k of [1, 1.28, 1.56]) svg.append(stroke(arc(128, 506, 56 * k, 21 * k, 186, 534, 40), 1.1, 'k3', { a: 0.1, b: 0.1, min: 0.4, wob: 0.04 }, 0.6))
  svg.append(stone(r, 128, 502, 34, 13, 0.7))

  // structures
  const body = layer('ink-wash')
  const dry = layer('ink-dry')
  const ink = layer('ink-rough')
  const thin = layer()
  const G = { body, ink, thin, dry }
  const towers = [tower(764, 428, 268, 44, 27, G), tower(690, 440, 238, 56, 34, G)]
  hall(340, 600, 300, 438, 28, G)
  const cols = racks(352, 588, 316, 414, 7, G, r)
  // the substation gantry beside the hall
  ink.append(
    stroke([[300, 438], [300, 358]], 2.4, 'k', { straight: true, a: 0.04, b: 0.1 }),
    stroke([[332, 438], [332, 358]], 2.4, 'k', { straight: true, a: 0.04, b: 0.1 }),
    stroke([[294, 360], [338, 360]], 2.4, 'k', { straight: true, a: 0.06, b: 0.06 }),
    stroke([[332, 382], [340, 382]], 2, 'k', { straight: true, a: 0.1, b: 0.1 }),
  )
  // a transformer at the foot of the gantry: a washed block with dry-brushed cooling fins
  body.append(wash(poly([[290, 416], [318, 415], [319, 438], [289, 438]]), 0.22), wash(poly([[318, 415], [326, 419], [326, 437], [319, 438]]), 0.34))
  for (let x = 293; x < 317; x += 4.6) dry.append(stroke([[x, 418], [x + 0.4, 436]], 2.6, 'k', { straight: true, a: 0.1, b: 0.2, min: 0.6 }, 0.28))
  ink.append(
    stroke([[289, 415], [304, 414.4], [319, 415]], 1.8, 'k', { a: 0.1, b: 0.3 }),
    stroke([[289, 416], [289, 438]], 1.6, 'k', { straight: true, a: 0.1, b: 0.3 }),
    stroke([[300, 414], [300, 406]], 1.2, 'k', { straight: true, a: 0.2, b: 0.2 }),
    stroke([[310, 414], [310, 406]], 1.2, 'k', { straight: true, a: 0.2, b: 0.2 }),
  )
  // the intake pipe from the pond to the big tower
  ink.append(stroke([[604, 470], [628, 452], [650, 446], [664, 440]], 2.4, 'k2', { a: 0.1, b: 0.1 }, 0.8))
  // three pylons walking in from the grid
  const far = (op: number) => {
    const a = s('g', { opacity: op })
    const b = s('g', { opacity: op })
    ink.append(a)
    thin.append(b)
    return [a, b] as const
  }
  const tips = ([[42, 372, 64, 0.38], [136, 400, 122, 0.62], [240, 438, 196, 1]] as const).map(([x, b, hg, op]) => pylon(x, b, hg, ...far(op)))
  const gantry: Pt[] = [[296, 366], [310, 366], [322, 366], [336, 366]]

  // ───────── the living layer (no filters: it moves) ─────────
  const live = s('g', { class: 't18p-live' })
  over.append(live)
  const wires: SVGPathElement[] = []
  const pulses: SVGPathElement[] = []
  const wire = (a: Pt, b: Pt, w: number) => {
    const sag = Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.07
    const d = `M${a[0]} ${a[1]}Q${(a[0] + b[0]) / 2} ${(a[1] + b[1]) / 2 + sag} ${b[0]} ${b[1]}`
    const el = s('path', { d, class: 'wire', 'stroke-width': w })
    const p = s('path', { d, class: 'pulse', 'stroke-width': w * 2.4, pathLength: 1, 'stroke-dasharray': '0.07 0.93', 'stroke-dashoffset': 1, opacity: 0 })
    wires.push(el)
    pulses.push(p)
  }
  for (let j = 0; j < 4; j++) {
    wire(tips[0][j], tips[1][j], 0.6)
    wire(tips[1][j], tips[2][j], 0.85)
    wire(tips[2][j], gantry[j], 1)
  }
  live.append(...wires, ...pulses)
  const intake = s('path', { d: 'M604 470L628 452L650 446L664 440', class: 'flow', pathLength: 1, 'stroke-dasharray': '0.12 0.88', 'stroke-dashoffset': 1, opacity: 0 })
  live.append(intake)

  // heat: a warm glow behind the roof and inside the cut-away
  const heatGlow = s('ellipse', { cx: 482, cy: 300, rx: 210, ry: 92, fill: `url(#${id('heat')})`, opacity: 0 })
  live.prepend(heatGlow)
  const warm = s('path', { class: 'v', d: poly([[352, 316], [588, 317], [588, 414], [352, 413]]), 'fill-opacity': 0.12, opacity: 0 })
  // status lights: tiny irregular dabs scattered down each rack
  const leds: SVGPathElement[] = []
  for (const [x, cw] of cols) {
    for (let y = 324 + r() * 5; y < 406; y += 5.5 + r() * 6) {
      const c = s('path', { class: 'led', d: ell(x + cw * (0.2 + r() * 0.6), y, 0.9 + r() * 1.2, 0.7 + r() * 0.7) })
      leds.push(c)
      live.append(c)
    }
  }
  live.append(warm)
  // roof fans (flattened discs whose blades turn)
  const blades: SVGGElement[] = []
  for (const fx of [400, 470, 540]) {
    const cx = fx + 14
    const cy = 291
    const spin = s('g', { class: 'blades' }, ...[0, 120, 240].map((a) => s('path', { d: 'M0 0C4 -3 12 -3 15 0C12 2 4 2 0 0Z', transform: `rotate(${a})`, class: 'k2' })))
    blades.push(spin)
    live.append(
      s('g', { transform: `translate(${cx} ${cy}) scale(1 0.32)` }, s('circle', { r: 16, class: 'fan' }), spin),
      stroke(arc(cx, cy, 16, 5.2, 0, 180, 12), 1.6, 'k', { a: 0.2, b: 0.2 }),
    )
  }
  // heat shimmer rising over the roof
  const shimmer = [410, 456, 504, 552].map((x, i) => {
    const pts: Pt[] = []
    for (let y = 0; y <= 46; y += 6) pts.push([x + Math.sin(y / 7 + i) * 3, 276 - y])
    const el = stroke(pts, 1.6, 'k3', { a: 0.3, b: 0.5, min: 0.2 })
    el.setAttribute('opacity', '0')
    live.append(el)
    return el
  })
  // steam puffs: grey belly, paper-lit crown
  const steamG = s('g', { class: 't18p-steam' })
  over.append(steamG)
  const mkPuff = () => s('g', { opacity: 0 }, s('circle', { r: 24, cy: 3, fill: `url(#${id('steam')})` }), s('circle', { r: 19, cx: -3, cy: -4, fill: `url(#${id('steamhi')})` }))
  const nPuff = low ? 4 : 8
  const puffs = towers.map(() => Array.from({ length: nPuff }, mkPuff))
  // 2030 doubles the plumes: a second set waits in its own group
  const puffs2 = towers.map(() => Array.from({ length: nPuff }, mkPuff))
  const steam2 = s('g', { opacity: 0 }, ...puffs2.flat())
  steamG.append(...puffs.flat(), steam2)

  // ───────── DOM: stage, labels, chart ─────────
  const stage = h('div', { class: 't18p-stage' }, svg, over)
  const labs = (['grid', 'heat', 'steam'] as const).map((k) => h('p', { class: 't18-lab t18p-lab', 'aria-hidden': 'true' }, S.labels[k]))
  const labWide: Pt[] = [[150, 262], [482, 226], [628, 128]]
  const labTall: Pt[] = [[262, 222], [524, 228], [668, 132]]
  const hit = h('button', { class: 't18p-hit', type: 'button', 'aria-label': S.run })
  const status = h('p', { class: 'visually-hidden', 'aria-live': 'polite' })

  const barSvg = (cls: string) => s('svg', { class: `t18p-bar ${cls}`, 'aria-hidden': 'true' })
  const bar24 = barSvg('b24')
  const bar30 = barSvg('b30')
  const yb = ['2024', '2030'].map((y, i) => h('button', { class: 't18p-yr', type: 'button', 'aria-pressed': String(i === 0), 'aria-label': `${S.years}: ${y}`, onClick: () => setYear(i) }, y))
  const row24 = h('div', { class: 't18p-row' },
    yb[0], bar24,
    h('div', { class: 't18p-val' }, ctx.fact(S.v2024, 'span', 't18p-num'), h('span', { class: 't18p-note' }, S.share)))
  const jp = ctx.fact(S.japan, 'p', 't18p-jp')
  const row30 = h('div', { class: 't18p-row r30' },
    yb[1], bar30,
    h('div', { class: 't18p-val' }, ctx.fact(S.v2030, 'span', 't18p-num')), jp)
  const chart = h('div', { class: 't18p-chart', role: 'group', 'aria-label': S.chart }, h('p', { class: 't18p-cap', 'aria-hidden': 'true' }, S.chart), row24, row30, h('p', { class: 't18p-unit' }, S.unit))
  chart.hidden = true

  const root = h('div', { class: 't18 t18p' }, h('p', { class: 'visually-hidden' }, S.art), stage, ...labs, hit, chart, status)
  ctx.art.append(root)
  const st = stable(ctx, [S.insight2024, S.insight2030], root)

  let ran = false
  let year = 0
  let withChart = false
  let wide = true
  let box = { x: 0, y: 0, w: 0, h: 0 }
  // portrait screens crop to the hall and towers; the power lines walk in from the left edge
  const FULL = { x: 0, y: 0, w: VW, h: VH }
  const CROP = { x: 220, y: 70, w: 580, h: 490 }
  let vb = FULL
  const loops: Tween[] = []
  let blink = 0

  // ───────── layout ─────────
  function target() {
    const W = root.clientWidth
    const H = root.clientHeight
    wide = W / H > 1.05
    root.classList.toggle('wide', wide)
    root.classList.toggle('short', wide && H < 330)
    const nv = wide ? FULL : CROP
    if (nv !== vb) {
      vb = nv
      for (const el of [svg, over]) el.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`)
    }
    if (!withChart) return fit(W, H, vb.w, vb.h)
    if (wide) {
      const cw = H < 330 ? clamp(W * 0.44, 250, 360) : clamp(W * 0.32, 250, 400)
      const f = fit(W - cw - 24, H, vb.w, vb.h)
      return { ...f, x: f.x * 0.6 }
    }
    const ch = chart.offsetHeight
    const f = fit(W, H - ch - 12, vb.w, vb.h)
    return { ...f, y: ch + 12 + f.y * 0.6 }
  }

  function placeChart() {
    const W = root.clientWidth
    const H = root.clientHeight
    if (wide) {
      const cw = H < 330 ? clamp(W * 0.44, 250, 360) : clamp(W * 0.32, 250, 400)
      chart.style.width = `${cw}px`
      place(chart, W - cw, Math.max(0, (H - chart.offsetHeight) / 2))
    } else {
      chart.style.width = `${Math.min(W, 460)}px`
      place(chart, (W - Math.min(W, 460)) / 2, 0)
    }
    drawBars()
  }

  function placeLabels() {
    const W = root.clientWidth
    const k = box.w / vb.w
    const at = wide ? labWide : labTall
    labs.forEach((el, i) => {
      const x = box.x + (at[i][0] - vb.x) * k
      const y = box.y + (at[i][1] - vb.y) * k
      const w = el.offsetWidth
      const left = clamp(x - w / 2, 4, W - w - 4)
      place(el, left, Math.max(0, y - el.offsetHeight))
    })
  }

  function apply(b: typeof box) {
    box = b
    place(stage, b.x, b.y, b.w, b.h)
    place(hit, b.x, b.y, b.w, b.h)
    placeLabels()
  }

  function layout(anim = false) {
    st.apply()
    if (withChart) placeChart()
    const t = target()
    if (anim && !ctx.reduced && !low) {
      const from = { ...box }
      ctx.anim(() => gsap.to(from, { ...t, duration: 1.3, ease: 'power3.inOut', onUpdate: () => apply(from) }))
    } else apply(t)
  }

  // ───────── bars (brushed, sized to the chart) ─────────
  let barW = 0
  const japanAt = 0.95
  function drawBars() {
    const w = bar24.getBoundingClientRect().width
    if (!w || Math.abs(w - barW) < 0.5) return
    barW = w
    for (const b of [bar24, bar30]) b.setAttribute('viewBox', `0 0 ${w} 24`)
    const L = w - 6
    const l24 = (L * 415) / 945
    bar24.replaceChildren(
      s('path', { class: 'k', 'fill-opacity': 0.12, d: brush([[3, 13], [l24 * 0.5, 12.4], [l24, 12.8]], 15, { a: 0.04, b: 0.18, min: 0.4 }).d, filter: 'url(#ink-wash)' }),
      s('path', { class: 'k b-ink', 'fill-opacity': 0.82, d: brush([[3, 12], [l24 * 0.5, 11.6], [l24, 12.2]], 9, { a: 0.05, b: 0.3, min: 0.3, wob: 0.06 }).d, filter: 'url(#ink-rough)' }),
    )
    const jx = L * japanAt
    bar30.replaceChildren(
      s('path', { class: 'k b-guide', d: brush([[3, 12], [L, 12]], 1, { straight: true, a: 0.01, b: 0.01, min: 1, wob: 0 }).d }),
      s('path', { class: 'k b-ink', 'fill-opacity': 0.42, d: brush([[3, 12], [L * 0.5, 11.4], [L, 12.4]], 11, { a: 0.03, b: 0.3, min: 0.25, wob: 0.08 }).d, filter: 'url(#ink-rough)' }),
      s('path', { class: 'v b-jp', d: brush([[jx, 1], [jx + 0.5, 23]], 2.6, { straight: true, a: 0.15, b: 0.25, min: 0.4 }).d }),
    )
    syncBars(false)
  }

  function syncBars(anim: boolean) {
    const inks = [bar24.querySelector('.b-ink'), bar30.querySelector('.b-ink'), bar30.querySelector('.b-jp')]
    const on = [ran, year === 1 || shown30, year === 1 || shown30]
    inks.forEach((el, i) => {
      if (!el) return
      if (anim && on[i] && !ctx.reduced) gsap.fromTo(el, { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, transformOrigin: '0% 50%', duration: i === 2 ? 0.8 : 1.6, delay: i === 2 ? 1.2 : 0.1, ease: 'power3.out' })
      else gsap.set(el, { scaleX: on[i] ? 1 : 0, opacity: on[i] ? 1 : 0, transformOrigin: '0% 50%' })
    })
    row30.classList.toggle('on', year === 1 || shown30)
    row30.classList.toggle('dim', shown30 && year === 0)
  }

  // ───────── motion ─────────
  function puffLoop(list: SVGGElement[], m: Pt, scale: number, delay = 0) {
    list.forEach((p, i) => {
      const dur = 6 + r() * 2.5
      const dx = (50 + r() * 70) * scale
      const dy = (150 + r() * 70) * scale
      const tl = gsap.timeline({ repeat: -1, delay: delay + (i * dur) / list.length })
      tl.set(p, { x: m[0] + (r() - 0.5) * 8 * scale, y: m[1] + 4, scale: 0.4 * scale, opacity: 0 })
      // rises straight out of the mouth, then the evening wind leans it over
      tl.to(p, { y: m[1] - dy * 0.38, x: m[0] + dx * 0.1, scale: 1.3 * scale, duration: dur * 0.38, ease: 'sine.out' })
      tl.to(p, { y: m[1] - dy, x: m[0] + dx, scale: (2.8 + r() * 1.2) * scale, duration: dur * 0.62, ease: 'sine.inOut' })
      tl.to(p, { opacity: 0.9, duration: dur * 0.2, ease: 'sine.out' }, 0)
      tl.to(p, { opacity: 0, duration: dur * 0.55, ease: 'sine.in' }, dur * 0.45)
      loops.push(tl as unknown as Tween)
    })
  }

  function staticPuffs(list: SVGGElement[], m: Pt, scale: number) {
    list.forEach((p, i) => {
      const t = (i + 0.5) / list.length
      gsap.set(p, { x: m[0] + 60 * t * scale, y: m[1] - 140 * t * scale, scale: (0.5 + 1.8 * t) * scale, opacity: 0.85 * (1 - t * 0.7) })
    })
  }

  function startBlink() {
    leds.forEach((l) => l.classList.toggle('on', r() < 0.55))
    if (ctx.reduced) return
    blink = window.setInterval(() => {
      for (let i = 0; i < 4; i++) leds[(r() * leds.length) | 0].classList.toggle('on')
      if (r() < 0.25) leds[(r() * leds.length) | 0].classList.toggle('hot')
    }, 110)
  }

  function run() {
    if (ran) {
      // already running: one more surge along the lines
      if (!ctx.reduced) ctx.anim(() => pulses.forEach((p, i) => gsap.fromTo(p, { strokeDashoffset: 1, opacity: 1 }, { strokeDashoffset: 0, duration: 1.1, delay: (i % 4) * 0.08, ease: 'none' })))
      ctx.chime('tap')
      return
    }
    ran = true
    hit.setAttribute('aria-label', S.running)
    status.textContent = `${S.labels.grid} · ${S.labels.heat} · ${S.labels.steam}`
    ctx.chime('soft')
    const reveal = () => {
      withChart = true
      chart.hidden = false
      layout(true)
      syncBars(true)
    }
    if (ctx.reduced) {
      pulses.forEach((p) => gsap.set(p, { strokeDashoffset: 0.5, opacity: 1 }))
      gsap.set(intake, { strokeDashoffset: 0.5, opacity: 1 })
      gsap.set([heatGlow, warm], { opacity: 1 })
      gsap.set(shimmer, { opacity: 0.5 })
      towers.forEach((t, i) => staticPuffs(puffs[i], t.mouth, i ? 1 : 0.8))
      gsap.set(labs, { opacity: 1 })
      startBlink()
      reveal()
      ctx.insight(S.insight2024, S.detail2024)
      return
    }
    ctx.anim(() => {
      const tl = gsap.timeline()
      tl.set(pulses, { opacity: 1 }, 0)
      pulses.forEach((p, i) => {
        const seg = Math.floor(i / 4) // 0 far → 2 near: the surge walks toward the hall
        loops.push(gsap.fromTo(p, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.5, ease: 'none', repeat: -1, delay: seg * 0.5 + (i % 4) * 0.13 }))
      })
      tl.fromTo(labs[0], { opacity: 0, y: 8, filter: 'blur(4px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.1, ease: 'power3.out' }, 0.5)
      tl.add(startBlink, 1.1)
      tl.to(heatGlow, { opacity: 1, duration: 2.4, ease: 'sine.inOut' }, 1.1)
      tl.to(warm, { opacity: 1, duration: 2, ease: 'sine.inOut' }, 1.2)
      tl.add(() => {
        blades.forEach((b, i) => loops.push(gsap.to(b, { rotation: 360, svgOrigin: '0 0', duration: 0.9 + i * 0.15, ease: 'none', repeat: -1 })))
        shimmer.forEach((el, i) => loops.push(gsap.fromTo(el, { y: 6, opacity: 0 }, { keyframes: [{ opacity: 0.55, y: -4, duration: 1.1 }, { opacity: 0, y: -16, duration: 1.3 }], ease: 'sine.inOut', repeat: -1, delay: i * 0.55 })))
      }, 1.4)
      tl.fromTo(labs[1], { opacity: 0, y: 8, filter: 'blur(4px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.1, ease: 'power3.out' }, 1.6)
      tl.add(() => {
        loops.push(gsap.fromTo(intake, { strokeDashoffset: 1, opacity: 1 }, { strokeDashoffset: 0, duration: 1.4, ease: 'none', repeat: -1 }))
        towers.forEach((t, i) => puffLoop(puffs[i], t.mouth, i ? 1 : 0.8, i * 0.4))
      }, 2)
      tl.fromTo(labs[2], { opacity: 0, y: 8, filter: 'blur(4px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.1, ease: 'power3.out' }, 2.7)
      tl.add(() => later(reveal), 3.6)
      tl.fromTo(chart, { opacity: 0 }, { opacity: 1, duration: 1.2, ease: 'power2.out' }, 4)
      tl.add(() => ctx.insight(S.insight2024, S.detail2024), 4.6)
    })
  }

  let shown30 = false
  let moreOn = false
  function setYear(i: number) {
    if (i === year) return
    year = i
    yb.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)))
    const first = i === 1 && !shown30
    if (i === 1) shown30 = true
    row30.classList.add('seen')
    if (first) syncBars(true)
    else syncBars(false)
    const on = i === 1
    ctx.anim(() => {
      if (ctx.reduced) gsap.set(more, { opacity: on ? 1 : 0 })
      else gsap.to(more, { opacity: on ? 1 : 0, duration: on ? 2 : 1, ease: 'power2.inOut' })
      if (ctx.reduced) gsap.set(steam2, { opacity: on ? 1 : 0 })
      else gsap.to(steam2, { opacity: on ? 1 : 0, duration: 1.6, ease: 'power2.inOut' })
      if (on && !moreOn) {
        moreOn = true
        if (ctx.reduced) towers.forEach((t, j) => staticPuffs(puffs2[j], [t.mouth[0] + 6, t.mouth[1]], j ? 1.1 : 0.9))
        else towers.forEach((t, j) => puffLoop(puffs2[j], [t.mouth[0] + 6, t.mouth[1]], j ? 1.1 : 0.9, 0.2 + j * 0.3))
      }
      // the lines carry twice the surge
      pulses.forEach((p) => p.setAttribute('stroke-dasharray', on ? '0.06 0.44' : '0.07 0.93'))
      if (!ctx.reduced) gsap.to(heatGlow, { scale: on ? 1.3 : 1, svgOrigin: '482 300', duration: 1.6, ease: 'power2.inOut' })
    })
    if (on) ctx.insight(S.insight2030, S.detail2030)
    else ctx.insight(S.insight2024, S.detail2024)
  }

  hit.addEventListener('click', run)
  watch(ctx, () => {
    st.reset()
    barW = 0
    layout(false)
  })
  ctx.prompt(S.prompt)

  // the picture unrolls like a handscroll
  if (!ctx.reduced) {
    gsap.fromTo(stage, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 2.4, ease: 'power2.inOut', delay: 0.3, clearProps: 'clipPath' })
    gsap.from([ridges, sky], { opacity: 0, duration: 2.2, delay: 0.6, ease: 'power1.out' })
  }
  gsap.set(labs, { opacity: 0 })

  return () => {
    clearInterval(blink)
    loops.forEach((t) => t.kill())
  }
}
