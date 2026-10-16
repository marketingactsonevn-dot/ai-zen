import { h, s } from '../../core/dom'
import { blob, clamp, curve, rng, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist, pine, toro } from '../../ui/part2/paint'
import { stepPath, type SlotGeo } from '../../ui/part2/steps'
import type { StepPath } from '../../ui/part2/types'
import type { SceneCtx } from '../types'
import C from '../../content/tram-27.json'
import { F, f1, P } from './ink27'

const S = C.scenes.path
const SCALE = [1, 0.88, 0.77, 0.68] // near steps big, far steps small
const PILE_K = { land: [0.96, 1.04, 0.93, 1.02], tall: [0.86, 0.84, 1, 0.98] } // loose slabs: the nearer, the bigger

/** Where the path, the house and the hut's doorway are (px in the scene), from the circle of the component's own sizes. */
interface Geo { w: number; h: number; land: boolean; size: Pt; slots: Pt[]; pile: Pt[]; door: number; lintel: number; sill: number; house: Pt; hh: number; moon: Pt }
function geo(g: SlotGeo): Geo {
  const { w, h: H, size } = g
  const land = g.row
  const n = 4
  const slots = Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1)
    return land
      ? ([w * (0.4 + 0.3 * t + 0.035 * Math.sin(Math.PI * t * 1.6)), H * (0.635 - 0.27 * t)] as Pt)
      : ([w * (0.56 + 0.07 * Math.sin(Math.PI * t * 1.4) - 0.03 * t), H * (0.53 - 0.31 * t)] as Pt)
  })
  // the loose slabs lie scattered on the boards at the threshold, nearer ones bigger (PILE_K)
  const pile: Pt[] = (land ? [[0.31, 0.875], [0.5, 0.905], [0.675, 0.86], [0.86, 0.9]] : [[0.29, 0.735], [0.72, 0.765], [0.3, 0.9], [0.75, 0.915]])
    .map(([x, y]) => [w * x, H * y] as Pt)
  return {
    w, h: H, land, size, slots, pile,
    door: land ? w * 0.22 : w * 0.13, lintel: land ? H * 0.07 : H * 0.05, sill: land ? H * 0.775 : H * 0.665,
    house: land ? [w * 0.82, H * 0.33] : [w * 0.66, H * 0.16], hh: land ? H * 0.17 : H * 0.11, moon: land ? [w * 0.58, H * 0.14] : [w * 0.3, H * 0.09],
  }
}

/** Far away, behind everything: the sky glow, the moon, ranges, the valley mist. */
function far(g: Geo): SVGElement[] {
  const { w, h: H } = g
  const [mx, my] = g.moon
  const R = clamp(Math.min(w, H) * 0.035, 12, 26)
  return [
    s('circle', { cx: f1(mx), cy: f1(my), r: f1(R * 6), fill: 'url(#p2-halo)', class: 't27p-glow' }),
    s('circle', { class: 't27p-moon', cx: f1(mx), cy: f1(my), r: f1(R) }),
    hills(-w * 0.1, w * 1.1, g.house[1] + g.hh * 0.2, H * 0.2, 2790, 0.92, g.land ? 6 : 3),
    mist(w * 0.6, g.house[1] + g.hh * 0.1, w * 0.7, H * 0.06),
    hills(w * 0.3, w * 1.15, g.house[1] + g.hh * 0.45, H * 0.1, 2791, 0.6, 2),
    mist(w * 0.65, g.house[1] + g.hh * 0.5, w * 0.6, H * 0.05),
  ]
}

/** The house in the valley: a sweeping roof, a veranda, paper doors warm with lamplight and people sitting round a tray. */
function house(g: Geo): SVGElement[] {
  const [x, y] = g.house, hh = g.hh
  const r = rng(2792)
  const w = hh * 1.8, wall = hh * 0.5, eave = y - wall - hh * 0.04
  const roof = `M${f1(x - w * 0.64)} ${f1(eave + hh * 0.06)}Q${f1(x - w * 0.42)} ${f1(eave)} ${f1(x - w * 0.3)} ${f1(y - hh * 0.95)}L${f1(x + w * 0.3)} ${f1(y - hh * 0.95)}Q${f1(x + w * 0.42)} ${f1(eave)} ${f1(x + w * 0.64)} ${f1(eave + hh * 0.06)}Z`
  const dx0 = x - w * 0.42, dw = w * 0.84, dy0 = y - wall * 0.92, dh = wall * 0.8
  let lattice = ''
  for (let i = 1; i < 12; i++) lattice += `M${f1(dx0 + (dw * i) / 12)} ${f1(dy0)}v${f1(dh)}`
  for (let j = 1; j < 4; j++) lattice += `M${f1(dx0)} ${f1(dy0 + (dh * j) / 4)}h${f1(dw)}`
  const fig = (fx: number, k: number) => blob(fx, dy0 + dh * 0.42, dh * 0.1 * k, dh * 0.12 * k, Math.round(fx), 0.08, 8) +
    `M${f1(fx - dh * 0.21 * k)} ${f1(dy0 + dh * 0.86)}Q${f1(fx)} ${f1(dy0 + dh * 0.34)} ${f1(fx + dh * 0.21 * k)} ${f1(dy0 + dh * 0.86)}Z`
  const people = fig(dx0 + dw * 0.24, 1) + fig(dx0 + dw * 0.47, 0.92) + fig(dx0 + dw * 0.7, 1.05) + `M${f1(dx0 + dw * 0.3)} ${f1(dy0 + dh * 0.8)}h${f1(dw * 0.4)}v${f1(dh * 0.06)}h${f1(-dw * 0.4)}Z`
  let tiles = ''
  for (let i = 0; i < 16; i++) {
    const xx = x - w * 0.29 + w * 0.58 * (i / 15)
    tiles += stroke([[xx, y - hh * 0.93], [xx + (xx - x) * 0.42, eave + 2 + r() * 2]], 1.1, 0.2, 0.3, 0.3)
  }
  return [
    s('ellipse', { class: 't27p-warm', cx: f1(x), cy: f1(y + hh * 0.06), rx: f1(w * 1.1), ry: f1(hh * 0.35), fill: 'url(#p2-lamp)' }),
    s('path', { class: 't27p-wall', d: `M${f1(x - w * 0.46)} ${f1(y - wall)}h${f1(w * 0.92)}v${f1(wall)}h${f1(-w * 0.92)}Z`, filter: 'url(#ink-rough)' }),
    s('path', { class: 't27p-shoji', d: `M${f1(dx0)} ${f1(dy0)}h${f1(dw)}v${f1(dh)}h${f1(-dw)}Z` }),
    s('path', { class: 't27p-people', d: people, filter: 'url(#ink-wash)' }),
    s('path', { class: 't27p-lattice', d: lattice }),
    // the middle pair of paper doors slides aside once the path is lit: inside, warm light and someone at the tray
    s('path', { class: 't27p-open', d: `M${f1(dx0 + dw * 0.37)} ${f1(dy0)}h${f1(dw * 0.26)}v${f1(dh)}h${f1(-dw * 0.26)}Z` }),
    s('path', { class: 't27p-inside', d: fig(dx0 + dw * 0.47, 0.92) + `M${f1(dx0 + dw * 0.38)} ${f1(dy0 + dh * 0.8)}h${f1(dw * 0.24)}v${f1(dh * 0.06)}h${f1(-dw * 0.24)}Z` }),
    s('g', { class: 't27p-door', style: `--open:${f1(-dw * 0.26)}px` },
      s('path', { class: 't27p-shoji t27p-shoji-door', d: `M${f1(dx0 + dw * 0.37)} ${f1(dy0)}h${f1(dw * 0.26)}v${f1(dh)}h${f1(-dw * 0.26)}Z` }),
      s('path', { class: 't27p-lattice', d: Array.from({ length: 3 }, (_, k) => `M${f1(dx0 + dw * (0.37 + 0.065 * (k + 1)))} ${f1(dy0)}v${f1(dh)}`).join('') + Array.from({ length: 3 }, (_, k) => `M${f1(dx0 + dw * 0.37)} ${f1(dy0 + (dh * (k + 1)) / 4)}h${f1(dw * 0.26)}`).join('') })),
    s('path', { class: 't27p-roof', d: roof, filter: 'url(#ink-rough)' }),
    s('path', { class: 't27p-tiles', d: tiles }),
    s('path', { class: 't27p-ink', d: stroke([[x - w * 0.64, eave + hh * 0.06], [x - w * 0.4, eave - 1], [x, eave - 2], [x + w * 0.4, eave - 1], [x + w * 0.64, eave + hh * 0.06]], 2.4, 0.05, 0.05, 0.4) + stroke([[x - w * 0.55, y + 1], [x + w * 0.55, y + 2]], 3, 0.05, 0.05, 0.5), filter: 'url(#ink-rough)' }),
  ]
}

/** The near garden down the slope (in the component's own art layer): the hillside, a gravel bed under the path, pines, a small lantern beside every step. */
function slope(g: Geo, lamps: SVGGElement[]): SVGElement[] {
  const { w, h: H, slots, size } = g
  const r = rng(2793)
  const top = g.house[1] + g.hh * 0.15
  // the hillside falling away from the doorway toward the valley
  const hill = `M0 ${f1(H)}L0 ${f1(top + H * 0.2)}Q${f1(w * 0.35)} ${f1(top + H * 0.08)} ${f1(w * 0.6)} ${f1(top + H * 0.02)}Q${f1(w * 0.85)} ${f1(top - H * 0.01)} ${f1(w)} ${f1(top + H * 0.03)}L${f1(w)} ${f1(H)}Z`
  let tufts = ''
  for (let i = 0; i < (g.land ? 520 : 240); i++) {
    const x = r() * w, y = top + H * 0.03 + Math.pow(r(), 0.8) * (H - top)
    const k = (y - top) / (H - top)
    tufts += blob(x, y, 0.8 + k * 2.6, 0.5 + k * 1.3, i, 0.3, 6)
  }
  // the gravel bed the steps sink into, wider near
  const c = slots.map(([x, y]) => [x, y] as Pt)
  const bed = [...curve([c[0][0] - size[0] * 0.2, H * 1.02], [c[0][0] - size[0] * 0.1, (H + c[0][1]) / 2], c[0], 6), ...c.slice(1)]
  bed.push([c[c.length - 1][0] + (c[3][0] - c[2][0]) * 0.8, c[3][1] + (c[3][1] - c[2][1]) * 0.8])
  bed.push([g.house[0] - g.hh * 0.6, g.house[1] + g.hh * 0.05])
  let bedD = '', grit = ''
  for (let i = 0; i < bed.length - 1; i++) {
    const k = i / (bed.length - 1)
    bedD += stroke([bed[i], bed[i + 1]], size[0] * (0.95 - k * 0.7), 0.02, 0.02, 0.8)
    for (let j = 0; j < 40; j++) {
      const t = r(), a = bed[i], b = bed[i + 1], spread = size[0] * (0.42 - k * 0.32)
      grit += blob(a[0] + (b[0] - a[0]) * t + (r() - 0.5) * spread, a[1] + (b[1] - a[1]) * t + (r() - 0.5) * spread * 0.3, 0.8 + (1 - k) * 1.6, 0.5 + (1 - k) * 0.9, i * 50 + j, 0.3, 6)
    }
  }
  // the hollows waiting for the slabs, sized by distance: shallow dips lined with moss, shade at their back lip,
  // moonlight on their front lip, a ring of tufts round each
  let hollows = '', mossy = '', lips = '', backs = '', ring = ''
  slots.forEach(([x, y], i) => {
    const k = SCALE[i], rx = size[0] * 0.5 * k, ry = size[1] * 0.42 * k, cy = y + size[1] * 0.08 * k
    hollows += blob(x, cy, rx, ry, 2799 + i, 0.08, 20)
    mossy += blob(x + rx * 0.06, cy + ry * 0.12, rx * 0.86, ry * 0.7, 2803 + i, 0.12, 16)
    const arc = (a0: number, a1: number, s0: number) => Array.from({ length: 13 }, (_, j) => {
      const a = Math.PI * (a0 + (j / 12) * (a1 - a0))
      return [x + Math.cos(a) * rx * s0, cy + Math.sin(a) * ry * s0] as Pt
    })
    lips += stroke(arc(0.12, 0.88, 1), 1.6 * k + 0.6, 0.2, 0.2, 0.2)
    backs += stroke(arc(1.08, 1.92, 0.9), ry * 0.42, 0.25, 0.25, 0.2)
    for (let j = 0; j < 22; j++) {
      const a = r() * Math.PI * 2, q = 1 + r() * 0.25, tx = x + Math.cos(a) * rx * q, ty = cy + Math.sin(a) * ry * q, l = (2 + r() * 4) * k
      ring += stroke([[tx, ty], [tx + (r() - 0.5) * l * 0.6, ty - l]], 0.8 + k * 0.6, 0.1, 0.6, 0.2)
    }
  })
  const pines = [
    pine(g.land ? w * 0.95 : w * 0.95, top + H * 0.22, H * (g.land ? 0.42 : 0.24), 2794, -1),
    pine(g.land ? w * 0.3 : w * 0.2, top + H * 0.1, H * (g.land ? 0.3 : 0.18), 2795, 1),
  ]
  // a small stone lantern beside each step, dark until its stone is set
  slots.forEach(([x, y], i) => {
    const k = SCALE[i]
    const lx = x + (g.land ? size[0] * 0.62 * k : (i % 2 ? -1 : 1) * size[0] * 0.66 * k), ly = y + size[1] * 0.35 * k
    const lh = size[1] * 1.5 * k
    lamps[i].replaceChildren(
      s('circle', { class: 't27p-lamphalo', cx: f1(lx), cy: f1(ly - lh * 0.62), r: f1(lh * 0.9), fill: 'url(#p2-lamp)' }),
      s('ellipse', { class: 't27p-lamppool', cx: f1(lx), cy: f1(ly + 2), rx: f1(lh * 0.9), ry: f1(lh * 0.16), fill: 'url(#p2-lamp)' }),
      toro(lx, ly, lh, false))
  })
  return [
    // the slope comes up out of the valley mist: no edge, only a wash that thickens toward you
    s('defs', null, s('linearGradient', { id: 't27p-hillG', gradientUnits: 'userSpaceOnUse', x1: 0, y1: f1(top - H * 0.04), x2: 0, y2: f1(H) }, s('stop', { offset: 0, style: 'stop-color:var(--t27-hill);stop-opacity:0' }), s('stop', { offset: 0.3, style: 'stop-color:var(--t27-hill);stop-opacity:.55' }), s('stop', { offset: 0.75, style: 'stop-color:var(--t27-hill-near);stop-opacity:.85' }), s('stop', { offset: 1, style: 'stop-color:var(--t27-hill-near);stop-opacity:.95' }))),
    s('path', { d: hill, fill: 'url(#t27p-hillG)' }),
    s('path', { class: 't27p-tuft', d: tufts }),
    mist(w * 0.62, top + H * 0.04, w * 0.75, H * 0.1),
    mist(w * 0.2, top + H * 0.12, w * 0.5, H * 0.07),
    mist(w * 0.85, top + H * 0.2, w * 0.4, H * 0.06),
    s('path', { class: 't27p-bed', d: bedD, filter: 'url(#ink-wash)' }),
    s('path', { class: 't27p-grit', d: grit }),
    s('path', { class: 't27p-hollow', d: hollows, filter: 'url(#ink-wash)' }),
    s('path', { class: 't27p-hollow-moss', d: mossy, filter: 'url(#ink-wash)' }),
    s('path', { class: 't27p-hollow-back', d: backs, filter: 'url(#ink-wash)' }),
    s('path', { class: 't27p-hollow-lip', d: lips }),
    s('path', { class: 't27p-tuft', d: ring }),
    ...pines,
    ...lamps,
  ]
}

/**
 * The veranda boards at the sill, where the four slabs lie (they stay when the hut slides away): planks running out
 * toward the garden, converging on the house, alternating a shade, butt joints closer together as they recede, a sheen
 * of moonlight across them, the sill beam with its lit edge.
 */
function deck(g: Geo): SVGElement[] {
  const { w, h: H, sill } = g
  const r = rng(2798)
  const post = Math.max(14, w * 0.022)
  const vx = g.house[0], top = sill + post * 0.7
  const at = (x0: number, y: number) => vx + (x0 - vx) * (0.62 + 0.38 * ((y - top) / (H - top))) // a plank line at depth y
  const n = g.land ? 16 : 9
  const pitch = (w * 1.6) / n
  let even = '', joints = '', gaps = ''
  for (let i = -Math.ceil(n * 0.3); i < n; i++) {
    const a = w * -0.3 + i * pitch, b = a + pitch
    if (i % 2 === 0) even += `M${f1(at(a, H + 4))} ${f1(H + 4)}L${f1(at(a, top))} ${f1(top)}L${f1(at(b, top))} ${f1(top)}L${f1(at(b, H + 4))} ${f1(H + 4)}Z`
    gaps += `M${f1(at(a, H + 4))} ${f1(H + 4)}L${f1(at(a, top))} ${f1(top)}`
    // butt joints: staggered, spaced by depth
    for (let y = top + 6 + r() * 10; y < H; y += (10 + (y - top) * 0.9) * (0.8 + r() * 0.6)) joints += `M${f1(at(a, y))} ${f1(y)}L${f1(at(b, y))} ${f1(y)}`
  }
  let grain = ''
  for (let i = 0; i < 30; i++) {
    const y = top + r() * (H - top), x = r() * w
    grain += stroke([[x, y], [x + (vx - x) * 0.08, y - (y - top) * 0.06]], 0.8, 0.3, 0.3, 0.2)
  }
  return [
    s('defs', null,
      s('linearGradient', { id: 't27p-deckG', x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, style: 'stop-color:var(--t27-wood-hi)' }), s('stop', { offset: 0.55, style: 'stop-color:var(--t27-wood)' }), s('stop', { offset: 1, style: 'stop-color:var(--t27-wood-lo)' })),
      s('linearGradient', { id: 't27p-sheen', gradientUnits: 'userSpaceOnUse', x1: f1(w * 0.75), y1: f1(top), x2: f1(w * 0.35), y2: f1(H) }, s('stop', { offset: 0, style: 'stop-color:var(--moon);stop-opacity:0' }), s('stop', { offset: 0.45, style: 'stop-color:var(--moon);stop-opacity:.5' }), s('stop', { offset: 1, style: 'stop-color:var(--moon);stop-opacity:0' }))),
    s('path', { d: `M0 ${f1(sill)}H${f1(w)}V${f1(H)}H0Z`, fill: 'url(#t27p-deckG)' }),
    s('path', { class: 't27p-plank', d: even }),
    s('path', { class: 't27p-sheen', d: `M0 ${f1(top)}H${f1(w)}V${f1(H)}H0Z`, fill: 'url(#t27p-sheen)' }),
    s('path', { class: 't27p-boards', d: gaps }),
    s('path', { class: 't27p-joints', d: joints }),
    s('path', { class: 't27p-grain', d: grain }),
    s('path', { class: 't27p-wood', d: `M0 ${f1(sill)}H${f1(w)}v${f1(post * 0.7)}H0Z`, filter: 'url(#ink-rough)' }),
    s('path', { class: 't27p-woodhi', d: stroke([[0, sill + 1.5], [w, sill + 1.5]], 1.4, 0.1, 0.1, 0.2) }),
  ]
}

/**
 * The hut around you: the dark post and lintel, an open sliding door, and a person hunched at a glowing screen, seen
 * from behind: a rounded back in two tones with creases, the cold blue of the screen on the rim of the head, the
 * shoulders and the door frame, its glow spilt over the wall and the desk.
 */
function hut(g: Geo): SVGElement[] {
  const { w, h: H, door, lintel, sill } = g
  const post = Math.max(14, w * 0.022)
  const px = g.land ? w * 0.1 : w * 0.05, py = g.land ? H * 0.6 : H * 0.5, ph = g.land ? H * 0.34 : H * 0.26
  const X = (v: number) => f1(px + v * ph), Y = (v: number) => f1(py + v * ph)
  // the back: hips wide on the floor, the spine curving forward, shoulders rolled toward the screen (upper right)
  const body = `M${X(-0.44)} ${Y(0.56)}C${X(-0.5)} ${Y(0.3)} ${X(-0.42)} ${Y(0.02)} ${X(-0.2)} ${Y(-0.1)}C${X(-0.06)} ${Y(-0.17)} ${X(0.12)} ${Y(-0.2)} ${X(0.28)} ${Y(-0.1)}` +
    `C${X(0.4)} ${Y(-0.03)} ${X(0.46)} ${Y(0.12)} ${X(0.44)} ${Y(0.3)}L${X(0.48)} ${Y(0.56)}Z`
  const arm = `M${X(0.3)} ${Y(-0.05)}C${X(0.42)} ${Y(-0.02)} ${X(0.5)} ${Y(0.08)} ${X(0.58)} ${Y(0.1)}L${X(0.6)} ${Y(0.16)}C${X(0.5)} ${Y(0.16)} ${X(0.4)} ${Y(0.14)} ${X(0.34)} ${Y(0.12)}Z`
  const neck = `M${X(0.02)} ${Y(-0.16)}Q${X(0.08)} ${Y(-0.22)} ${X(0.16)} ${Y(-0.17)}L${X(0.18)} ${Y(-0.12)}Q${X(0.08)} ${Y(-0.13)} ${X(0.02)} ${Y(-0.11)}Z`
  const head = blob(px + ph * 0.13, py - ph * 0.28, ph * 0.125, ph * 0.145, 2797, 0.05, 14)
  const hair = blob(px + ph * 0.11, py - ph * 0.32, ph * 0.115, ph * 0.105, 2796, 0.08, 12)
  const folds = stroke(curve([px - ph * 0.3, py + ph * 0.02], [px - ph * 0.12, py + ph * 0.12], [px + ph * 0.02, py + ph * 0.32], 8), ph * 0.02, 0.2, 0.4, 0.1) +
    stroke(curve([px - ph * 0.08, py - ph * 0.08], [px - ph * 0.02, py + ph * 0.12], [px - ph * 0.1, py + ph * 0.4], 8), ph * 0.016, 0.3, 0.4, 0.1) +
    stroke(curve([px + ph * 0.18, py - ph * 0.02], [px + ph * 0.26, py + ph * 0.18], [px + ph * 0.2, py + ph * 0.42], 8), ph * 0.014, 0.3, 0.4, 0.1)
  const blades = stroke(curve([px - ph * 0.24, py - ph * 0.06], [px - ph * 0.12, py - ph * 0.1], [px - ph * 0.04, py + ph * 0.06], 8), ph * 0.05, 0.3, 0.4, 0.1) +
    stroke(curve([px + ph * 0.3, py - ph * 0.06], [px + ph * 0.22, py - ph * 0.1], [px + ph * 0.12, py + ph * 0.06], 8), ph * 0.05, 0.3, 0.4, 0.1)
  // the screen, seen past the shoulder: a thin bezel, a bright field with a few blurred lines of text, its stand
  const sx = px + ph * 0.66, sy = py - ph * 0.3, sw = ph * 0.5, sh = ph * 0.34
  let lines = ''
  for (let k = 0; k < 5; k++) lines += `M${f1(sx - sw * 0.38)} ${f1(sy - sh * 0.3 + k * sh * 0.14)}h${f1(sw * (0.5 + ((k * 37) % 30) / 100))}`
  const rim = stroke(curve([px - ph * 0.12, py - ph * 0.12], [px + ph * 0.14, py - ph * 0.21], [px + ph * 0.36, py + ph * 0.0], 12), ph * 0.014, 0.2, 0.3, 0.1) +
    stroke(Array.from({ length: 9 }, (_, k) => [px + ph * 0.13 + Math.cos(-1.9 + k * 0.3) * ph * 0.125, py - ph * 0.28 + Math.sin(-1.9 + k * 0.3) * ph * 0.145] as Pt), ph * 0.012, 0.2, 0.3, 0.1) +
    stroke(curve([px + ph * 0.36, py - ph * 0.04], [px + ph * 0.48, py + ph * 0.04], [px + ph * 0.58, py + ph * 0.1], 8), ph * 0.01, 0.2, 0.3, 0.1)
  // the sliding door pushed open behind the post: a shoji panel, its lattice
  const sd0 = door - post * 0.5 - w * 0.12, sdw = w * 0.12
  let sl = ''
  for (let i = 1; i < 3; i++) sl += `M${f1(sd0 + (sdw * i) / 3)} ${f1(lintel)}V${f1(sill)}`
  for (let j = 1; j < 6; j++) sl += `M${f1(sd0)} ${f1(lintel + ((sill - lintel) * j) / 6)}h${f1(sdw)}`
  const stop = (o: number, c: string, a: number | string = 1) => s('stop', { offset: o, style: `stop-color:${c};stop-opacity:${a}` })
  return [
    s('defs', null,
      s('radialGradient', { id: 't27p-blue' }, stop(0, 'var(--t27-screen)', 0.6), stop(0.45, 'var(--t27-screen)', 0.2), stop(1, 'var(--t27-screen)', 0)),
      s('radialGradient', { id: 't27p-scr', cx: 0.45, cy: 0.4, r: 0.75 }, stop(0, 'color-mix(in srgb, var(--t27-screen) 40%, #fff)'), stop(0.6, 'var(--t27-screen)'), stop(1, 'color-mix(in srgb, var(--t27-screen) 60%, var(--umbra))')),
      // the back turned away from the screen: darkest on the left, a cold breath of the screen on the right
      s('linearGradient', { id: 't27p-back', x1: 0, y1: 0.2, x2: 1, y2: 0 }, stop(0, 'var(--t27-figure)'), stop(0.6, 'var(--t27-figure)'), stop(1, 'color-mix(in srgb, var(--t27-figure) 72%, var(--t27-screen))')),
      s('radialGradient', { id: 't27p-lit', gradientUnits: 'userSpaceOnUse', cx: f1(sx), cy: f1(sy), r: f1(ph * 0.95) }, stop(0, 'var(--t27-screen)', 0.5), stop(0.6, 'var(--t27-screen)', 0.14), stop(1, 'var(--t27-screen)', 0))),
    // the hut's dark interior: left of the post and above the lintel
    s('path', { class: 't27p-dark', d: `M0 0H${f1(w)}V${f1(lintel)}H${f1(door)}V${f1(sill)}H0Z` }),
    // the screen's glow on the wall and the desk
    s('ellipse', { class: 't27p-screenglow', cx: f1(sx), cy: f1(sy), rx: f1(ph * 1.5), ry: f1(ph * 1.15), fill: 'url(#t27p-blue)' }),
    s('ellipse', { class: 't27p-screenglow', cx: f1(sx - ph * 0.1), cy: f1(py + ph * 0.18), rx: f1(ph * 0.8), ry: f1(ph * 0.12), fill: 'url(#t27p-blue)' }),
    s('path', { class: 't27p-shoji-in', d: `M${f1(sd0)} ${f1(lintel)}h${f1(sdw)}V${f1(sill)}h${f1(-sdw)}Z` }),
    s('path', { class: 't27p-slat', d: sl }),
    s('path', { class: 't27p-desk', d: `M${X(0.28)} ${Y(0.14)}H${f1(sx + sw * 0.62)}v${f1(ph * 0.05)}H${X(0.28)}Z` }),
    s('path', { class: 't27p-bezel', d: `M${f1(sx - sw / 2 - 3)} ${f1(sy - sh / 2 - 3)}h${f1(sw + 6)}v${f1(sh + 6)}h${f1(-sw - 6)}Z` + `M${f1(sx - sw * 0.06)} ${f1(sy + sh / 2 + 3)}h${f1(sw * 0.12)}l${f1(sw * 0.05)} ${f1(ph * 0.12)}h${f1(-sw * 0.22)}Z` }),
    s('path', { class: 't27p-screen', d: `M${f1(sx - sw / 2)} ${f1(sy - sh / 2)}h${f1(sw)}v${f1(sh)}h${f1(-sw)}Z`, fill: 'url(#t27p-scr)' }),
    s('path', { class: 't27p-scrtext', d: lines }),
    s('path', { class: 't27p-person', d: body + arm + neck, fill: 'url(#t27p-back)', filter: 'url(#ink-rough)' }),
    s('path', { class: 't27p-person-lit', d: body + arm + neck, fill: 'url(#t27p-lit)' }),
    s('path', { class: 't27p-blade', d: blades, filter: 'url(#ink-wash)' }),
    s('path', { class: 't27p-fold', d: folds }),
    s('path', { class: 't27p-person t27p-head', d: head, fill: 'url(#t27p-back)' }),
    s('path', { class: 't27p-person-lit', d: head, fill: 'url(#t27p-lit)' }),
    s('path', { class: 't27p-hair', d: hair, filter: 'url(#ink-wash)' }),
    s('path', { class: 't27p-rimblue', d: rim }),
    // the post and lintel, rimmed cold by the screen on their inner edges
    s('path', { class: 't27p-wood', d: `M${f1(door - post)} 0h${f1(post)}V${f1(sill)}h${f1(-post)}Z` + `M0 ${f1(lintel - post * 0.9)}H${f1(w)}v${f1(post * 0.9)}H0Z`, filter: 'url(#ink-rough)' }),
    s('path', { class: 't27p-rimblue', d: stroke([[door - post - 1, lintel], [door - post - 1, sill]], 2.2, 0.1, 0.4, 0.1) + stroke([[0, lintel + 1], [door - post, lintel + 1]], 1.8, 0.05, 0.4, 0.1) }),
    s('path', { class: 't27p-woodhi', d: stroke([[door - 1.5, lintel + 4], [door - 1.5, sill]], 1.4, 0.1, 0.1, 0.2) }),
  ]
}

/**
 * A stone slab for step i, seen from above at 30° (in its w × h box): an irregular top face in three tones (moonlit
 * upper right, mid, a shaded left with a brushed edge), its thick front edge, moss in the low corner, a contact shadow.
 */
function slab(i: number, { w, h: hh, seed }: { w: number; h: number; seed: number }): SVGElement {
  const r = rng(seed)
  // an irregular six-sided top face, corners softened twice (Chaikin)
  const nv = 5 + (seed % 3)
  let poly: Pt[] = Array.from({ length: nv }, (_, k) => {
    const a = Math.PI * 2 * (k / nv) + (r() - 0.5) * 0.7 + 0.3
    const q = 0.4 + r() * 0.1
    return [w / 2 + Math.cos(a) * w * q * 1.06, hh * 0.42 + Math.sin(a) * hh * (0.36 + r() * 0.08)] as Pt
  })
  for (let it = 0; it < 1; it++) poly = poly.flatMap((p, k) => {
    const q = poly[(k + 1) % poly.length]
    return [[p[0] * 0.75 + q[0] * 0.25, p[1] * 0.75 + q[1] * 0.25], [p[0] * 0.25 + q[0] * 0.75, p[1] * 0.25 + q[1] * 0.75]] as Pt[]
  })
  const face = `M${poly.map(P).join('L')}Z`
  // the front edge: the lower half of the outline pushed down by the slab's thickness
  const th = hh * 0.18
  const lowIdx = poly.filter((p) => p[1] > hh * 0.42).sort((a, b) => a[0] - b[0])
  const edge = lowIdx.length > 2 ? `M${lowIdx.map(P).join('L')}L${[...lowIdx].reverse().map(([x, y]) => P([x, y + th])).join('L')}Z` : ''
  // three tones: a lit region upper right and a shaded one left, each closed by a wobbling brushed line
  const wob = (t: number) => Math.sin(t * 9 + seed) * w * 0.02 + (r() - 0.5) * w * 0.015
  const lit = `M${f1(w * 0.3)} ${f1(-2)}L${f1(w + 2)} ${f1(-2)}L${f1(w + 2)} ${f1(hh * 0.7)}` + Array.from({ length: 9 }, (_, k) => {
    const t = k / 8
    return `L${f1(w * (0.88 - 0.5 * t) + wob(t))} ${f1(hh * (0.7 - 0.62 * t))}`
  }).join('') + 'Z'
  const shade = `M${f1(-2)} ${f1(-2)}L${f1(w * 0.2)} ${f1(-2)}` + Array.from({ length: 9 }, (_, k) => {
    const t = k / 8
    return `L${f1(w * (0.22 + 0.08 * Math.sin(t * Math.PI)) + wob(t + 3))} ${f1(hh * t)}`
  }).join('') + `L${f1(-2)} ${f1(hh)}Z`
  let moss = '', cun = ''
  for (let k = 0; k < 5; k++) moss += blob(w * (0.12 + r() * 0.3), hh * (0.5 + r() * 0.2), w * (0.03 + r() * 0.04), hh * 0.05, seed + k, 0.3, 8)
  for (let k = 0; k < 6; k++) {
    const x = w * (0.08 + r() * 0.2), y = hh * (0.25 + r() * 0.4)
    cun += stroke([[x, y], [x + w * 0.02, y + hh * 0.12]], 1 + r(), 0.2, 0.5, 0.1)
  }
  const clip = `t27p-sc${i}-${seed}`
  return s('g', { class: 't27p-slab' },
    s('defs', null, s('clipPath', { id: clip }, s('path', { d: face }))),
    s('ellipse', { class: 't27p-slab-sh', cx: f1(w * 0.46), cy: f1(hh * 0.86 + th), rx: f1(w * 0.5), ry: f1(hh * 0.14) }),
    edge ? s('path', { class: 't27p-slab-edge', d: edge, filter: 'url(#ink-rough)' }) : null,
    s('path', { class: 't27p-slab-mid', d: face, filter: 'url(#ink-rough)' }),
    s('g', { 'clip-path': `url(#${clip})` },
      s('path', { class: 't27p-slab-lit', d: lit, filter: 'url(#ink-wash)' }),
      s('path', { class: 't27p-slab-lo', d: shade, filter: 'url(#ink-wash)' }),
      s('path', { class: 't27p-slab-cun', d: cun }),
      s('path', { class: 't27p-slab-moss', d: moss, filter: 'url(#ink-wash)' })),
    s('path', { class: 't27p-slab-rim', d: stroke(poly.slice(0, Math.round(poly.length * 0.4)).map(([x, y]) => [x - 0.6, y + 1] as Pt), 1.4, 0.2, 0.3, 0.1) }))
}

/** Scene 4 — from the screen-lit hut, down the moonlit steps to a house where people sit together: four habits, in order. */
export const pathScene = {
  label: S.label,
  mount(ctx: SceneCtx) {
    const lamps = [0, 1, 2, 3].map(() => s('g', { class: 't27p-lamp' }))
    const farSvg = s('svg', { class: 't27p-svg', 'aria-hidden': 'true' })
    const houseSvg = s('svg', { class: 't27p-svg', 'aria-hidden': 'true' })
    const hutSvg = s('svg', { class: 't27p-svg', 'aria-hidden': 'true' })
    const deckSvg = s('svg', { class: 't27p-svg', 'aria-hidden': 'true' })
    const deckL = h('div', { class: 't27p-L t27p-deck' }, deckSvg)
    const farL = h('div', { class: 't27p-L t27p-far' }, farSvg)
    const houseL = h('div', { class: 't27p-L t27p-house' }, houseSvg)
    const hutL = h('div', { class: 't27p-L t27p-hut' }, hutSvg)
    let G: Geo | null = null
    let root: HTMLElement | null = null
    const step = (k: number) => {
      root?.style.setProperty('--p', String((k + 1) / 4))
      lamps[k].classList.add('on')
    }
    const def = stepPath(S.steps as StepPath, {
      label: S.label, prompt: S.prompt, insight: F(S.insight),
      slots: (g) => (G = geo(g)).slots,
      pile: (g) => (G ?? geo(g)).pile,
      piece: (i, g) => slab(i, g),
      onPlace: (k) => {
        step(k)
        // a placed slab is drawn (not boxed) at its step's distance: its art and words shrink, its button stays put
        root?.querySelectorAll<HTMLElement>('.p2s-stone.placed').forEach((el) => el.style.setProperty('--k', String(SCALE[+(el.querySelector('.p2s-key')?.textContent ?? 1) - 1] ?? 1)))
      },
      art: (pg) => {
        const g = G
        if (!g || !root) return []
        const vb = `0 0 ${f1(pg.w)} ${f1(pg.h)}`
        for (const v of [farSvg, houseSvg, hutSvg, deckSvg]) v.setAttribute('viewBox', vb)
        deckSvg.replaceChildren(...deck(g))
        farSvg.replaceChildren(...far(g))
        houseSvg.replaceChildren(...house(g))
        hutSvg.replaceChildren(...hut(g))
        houseL.style.transformOrigin = `${f1(g.house[0])}px ${f1(g.house[1])}px`
        // loose slabs: nearer ones a little bigger (their key is their pile place until they are set)
        root.querySelectorAll<HTMLElement>('.p2s-stone:not(.placed)').forEach((el) => el.style.setProperty('--k', String((g.land ? PILE_K.land : PILE_K.tall)[+(el.querySelector('.p2s-key')?.textContent ?? 1) - 1] ?? 1)))
        // the take-away: a paper card under the veranda lamp (right, below the house; on a phone across the foot), scrolling inside
        const sheet = root.querySelector<HTMLElement>('.p2s-sheet')
        if (sheet) Object.assign(sheet.style, g.land
          ? { left: 'auto', right: `${f1(g.w * 0.035)}px`, top: `${f1(g.h * 0.44)}px`, bottom: 'auto', width: `${f1(Math.min(400, g.w * 0.34))}px`, maxHeight: `${f1(g.h * 0.54)}px` }
          : { left: '6px', right: '6px', top: `${f1(g.h * 0.5)}px`, bottom: 'auto', width: 'auto', maxHeight: `${f1(g.h * 0.49)}px` })
        // the hint line sits between the path and the stones at the sill
        const note = root.querySelector<HTMLElement>('.p2s-note')
        if (note) Object.assign(note.style, g.land ? { top: `${f1(g.h * 0.71)}px`, left: `${f1(g.door + 12)}px`, width: `${f1(g.w - g.door - 24)}px`, textAlign: 'center' } : { top: `${f1(g.h * 0.585)}px`, left: '4px', width: `${f1(g.w - 8)}px`, textAlign: 'center' })
        return slope(g, lamps)
      },
    })
    const off = def.mount(ctx)
    root = ctx.art.querySelector<HTMLElement>('.p2s')
    if (root) {
      root.classList.add('t27p')
      if (ctx.quality === 'low') root.classList.add('is-calm')
      // far + house behind the component's art, the hut in front of the path but under the stones
      root.prepend(farL, houseL)
      root.querySelector('.p2s-line')?.after(deckL, hutL)
    }
    return off
  },
}
