import { h, s } from '../../core/dom'
import { blob, clamp, curve, onSize, p2Defs, rng, stableHeight, stroke, type Pt } from '../../ui/part2/ink'
import { findTakeaway, foldedTakeaway } from '../../ui/part2/takeaway'
import { guide, type Mark, type Track } from '../../ui/part2/guide'
import type { SceneCtx } from '../types'
import C from '../../content/tram-27.json'
import { F, f1, invite, lin, nudge, rad, wideZone } from './ink27'

const K = C.scenes.flatter
const LIE = -118 // a mirror lying face down toward you, hinged at its stand (degrees about its handle's end)
const HANDLE = 0.25 // the handle's length below the disc, in disc diameters

/**
 * The room, seen from a low seat: a lacquer tray fills the lower two thirds, the tatami round it, a shoji window high on
 * the right letting in the moon. Plane coordinates: X across (px at the tray's front edge), Z into the room from the
 * front edge (same px); screen scale s(Z) = 1 / (1 + Z / L) toward a horizon above the frame (the camera looks down).
 */
interface Geo {
  W: number; H: number; land: boolean
  cx: number; yF: number; hY: number; L: number
  tw: number; td: number; th: number; D: number
  stand: [Pt, Pt]; slip: Pt; zone: [number, number]
}
function geo(W: number, H: number): Geo {
  const land = W / H > 1.05
  const k = land ? 0.72 : 0.8 // the back edge's scale
  // wide: the tray runs nearly edge to edge (its front-left corner is the insight's zone once the gilded mirror stands)
  const tw = land ? Math.min(W * 0.96, 1400) : W * 0.94
  const td = land ? tw * 0.6 : tw * 1.45
  const yF = H * (land ? 0.94 : 0.94), yB = H * (land ? 0.38 : 0.24)
  const hY = (yB - k * yF) / (1 - k)
  const L = td / (1 / k - 1)
  // the stands: staggered (the gilded one further back on the left, the bronze one nearer on the right), so a mirror
  // standing never covers the other one or the question slip (wide: at the back between them; tall: pasted on the wall
  // top right, above where the bronze one's top comes to)
  return land
    ? { W, H, land, cx: W / 2, yF, hY, L, tw, td, th: Math.max(12, tw * 0.024), D: Math.min(tw * 0.24, H * 0.45, 320),
        stand: [[-tw * 0.25, td * 0.72], [tw * 0.25, td * 0.52]], slip: [0, td * 0.93], zone: [0, 0] }
    : { W, H, land, cx: W / 2, yF, hY, L, tw, td, th: Math.max(10, tw * 0.03), D: W * 0.46,
        stand: [[-tw * 0.23, td * 0.8], [tw * 0.23, td * 0.47]], slip: [0, 0], zone: [0, 0] }
}
const sc = (g: Geo, Z: number) => 1 / (1 + Z / g.L)
/** a point of the tray's plane on screen, and its scale there */
const proj = (g: Geo, X: number, Z: number): [number, number, number] => {
  const k = sc(g, Z)
  return [g.cx + X * k, g.hY + (g.yF - g.hY) * k, k]
}

/** The room behind the tray: a dark wall, a shoji window high on the right (the moon's source), its soft beam. */
function room(g: Geo): SVGElement[] {
  const { W, H } = g
  const [, yBack] = proj(g, 0, g.td * (g.land ? 1.6 : 1.1))
  const wy = Math.max(H * 0.02, yBack - H * 0.02) // where the wall meets the mats
  const wx = W * (g.land ? 0.7 : 0.06), ww = W * (g.land ? 0.22 : 0.4), wh = Math.min(wy * 0.8, H * 0.24), wt = wy * 0.08
  let lat = ''
  for (let i = 1; i < 4; i++) lat += `M${f1(wx + (ww * i) / 4)} ${f1(wt)}v${f1(wh)}`
  for (let j = 1; j < 5; j++) lat += `M${f1(wx)} ${f1(wt + (wh * j) / 5)}h${f1(ww)}`
  // the beam: from the window down across the mats and the tray, wide and soft at its feet
  const [bx0, by0] = proj(g, g.tw * 0.15, g.td * 0.15), [bx1, by1] = proj(g, g.tw * 0.55, g.td * 0.05)
  const beam = `M${f1(wx + ww * 0.1)} ${f1(wt + wh)}L${f1(wx + ww * 0.95)} ${f1(wt + wh)}L${f1(bx1)} ${f1(by1)}L${f1(bx0)} ${f1(by0)}Z`
  return [
    s('defs', null,
      lin('t27g-wallG', 0, 0, 0, 1, [[0, '--t27-wall-hi', 1], [1, '--t27-wall', 1]]),
      lin('t27g-beamG', 0, 0, 0, 1, [[0, '--moon', 0.3], [0.55, '--moon', 0.12], [1, '--moon', 0]]),
      s('filter', { id: 't27g-soft', x: '-20%', y: '-20%', width: '140%', height: '140%' }, s('feGaussianBlur', { stdDeviation: g.land ? 14 : 9 }))),
    s('rect', { x: 0, y: 0, width: f1(W), height: f1(wy + 2), fill: 'url(#t27g-wallG)' }),
    // the window: paper glowing with the moon, its lattice, a dark frame; a low sill rail under it
    s('rect', { class: 't27g-shoji', x: f1(wx), y: f1(wt), width: f1(ww), height: f1(wh) }),
    s('path', { class: 't27g-shoji-lat', d: lat }),
    s('rect', { class: 't27g-shoji-frame', x: f1(wx - 3), y: f1(wt - 3), width: f1(ww + 6), height: f1(wh + 6) }),
    s('path', { class: 't27g-rail', d: `M0 ${f1(wy - 4)}H${f1(W)}v5H0Z` }),
    s('path', { class: 't27g-beam', d: beam, fill: 'url(#t27g-beamG)', filter: 'url(#t27g-soft)' }),
  ]
}

/** Tatami on the floor, laid in perspective round the tray: mats with dark cloth borders (heri), the weave along them. */
function tatami(g: Geo): SVGElement[] {
  const r = rng(2725)
  const mat = g.tw * (g.land ? 0.55 : 0.8), md = mat * 0.5
  let heri = '', weave = '', tones = ''
  const Z0 = -g.td * 0.4, Z1 = g.td * 1.6
  for (let z = Z0, row = 0; z < Z1; z += md, row++) {
    const off = (row % 2) * mat * 0.5
    for (let x = -g.tw * 2 - off; x < g.tw * 2; x += mat) {
      const a = proj(g, x, z), b = proj(g, x + mat, z), c = proj(g, x + mat, z + md), d = proj(g, x, z + md)
      const quad = (p: number[], q: number[], u: number[], v: number[]) => `M${f1(p[0])} ${f1(p[1])}L${f1(q[0])} ${f1(q[1])}L${f1(u[0])} ${f1(u[1])}L${f1(v[0])} ${f1(v[1])}Z`
      if (r() < 0.45) tones += quad(a, b, c, d)
      // the two long edges carry a cloth border
      const e = 0.04
      heri += quad(a, b, proj(g, x + mat, z + md * e), proj(g, x, z + md * e)) + quad(proj(g, x, z + md * (1 - e)), proj(g, x + mat, z + md * (1 - e)), c, d)
      for (let k = 1; k < 7; k++) {
        const p = proj(g, x, z + (md * k) / 7), q = proj(g, x + mat, z + (md * k) / 7)
        weave += `M${f1(p[0])} ${f1(p[1])}L${f1(q[0])} ${f1(q[1])}`
      }
    }
  }
  // the far mats fade into the room's dusk
  const [, y0] = proj(g, 0, g.td * (g.land ? 1.6 : 1.1)), [, y1] = proj(g, 0, g.td * 0.55)
  return [
    s('path', { class: 't27g-mat-tone', d: tones }),
    s('path', { class: 't27g-weave', d: weave }),
    s('path', { class: 't27g-heri', d: heri }),
    s('defs', null, lin('t27g-farG', 0, y0, 0, y1, [[0, '--t27-wall', 0.85], [1, '--t27-wall', 0]], true)),
    s('rect', { x: 0, y: f1(y0), width: f1(g.W), height: f1(Math.max(0, y1 - y0)), fill: 'url(#t27g-farG)' }),
  ]
}

/**
 * The lacquer tray on the mats: its top in perspective (black rim, red-black floor, gold maki-e grasses and a crescent
 * at the back corners, a gloss), the front face with its thickness, two small wooden stands (a slotted block each) the
 * mirrors' handles are seated in, a contact shadow along its foot.
 */
function tray(g: Geo): SVGElement[] {
  const r = rng(2720)
  const { tw, td, th } = g
  const pt = (X: number, Z: number) => proj(g, X, Z)
  const quad = (pts: number[][]) => `M${pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')}Z`
  const fl = pt(-tw / 2, 0), fr = pt(tw / 2, 0), bl = pt(-tw / 2, td), br = pt(tw / 2, td)
  const b = tw * 0.04
  const il = pt(-tw / 2 + b, b), ir = pt(tw / 2 - b, b), jl = pt(-tw / 2 + b, td - b), jr = pt(tw / 2 - b, td - b)
  // maki-e at the back corners: grasses bending left, a crescent right (clear of where the mirrors lie)
  let grass = ''
  for (let i = 0; i < 9; i++) {
    const [x, y, k] = pt(-tw * 0.44 + i * tw * 0.016, td * 0.78)
    const hh = td * (0.12 + r() * 0.08) * k * 0.6, lean = (r() - 0.6) * hh * 0.6
    grass += stroke(curve([x, y], [x + lean * 0.3, y - hh * 0.6], [x + lean, y - hh], 10), (1.2 + r()) * k, 0.05, 0.75, 0.1)
  }
  const [mx, my, mk] = pt(tw * 0.41, td * 0.83), cr = tw * 0.035 * mk
  const crescent = `M${f1(mx)} ${f1(my - cr)}A${f1(cr)} ${f1(cr * 0.62)} 0 1 1 ${f1(mx)} ${f1(my + cr * 0.24)}A${f1(cr * 0.8)} ${f1(cr * 0.5)} 0 1 0 ${f1(mx)} ${f1(my - cr)}Z`
  const front = `M${f1(fl[0])} ${f1(fl[1])}L${f1(fr[0])} ${f1(fr[1])}L${f1(fr[0])} ${f1(fr[1] + th)}L${f1(fl[0])} ${f1(fl[1] + th)}Z`
  const side = `M${f1(fr[0])} ${f1(fr[1])}L${f1(br[0])} ${f1(br[1])}L${f1(br[0])} ${f1(br[1] + th * 0.7)}L${f1(fr[0])} ${f1(fr[1] + th)}Z`
  // the stands: a small block with a slot, seated on the floor of the tray where each mirror's handle ends
  const stands = g.stand.map(([X, Z]) => {
    const [x, y, k] = pt(X, Z), w = g.D * 0.44 * k, hh = g.D * 0.13 * k
    return `M${f1(x - w / 2)} ${f1(y)}L${f1(x + w / 2)} ${f1(y)}L${f1(x + w * 0.42)} ${f1(y - hh)}L${f1(x - w * 0.42)} ${f1(y - hh)}Z`
  }).join('')
  return [
    s('defs', null,
      rad('t27g-floor', [[0, '--t27-lac-hi', 1], [0.7, '--t27-lac', 1], [1, '--t27-lac-lo', 1]], { cx: g.cx - tw * 0.1, cy: (il[1] + jl[1]) / 2, r: tw * 0.7 }),
      lin('t27g-gloss', 0, 0, 1, 1, [[0, '--moon', 0], [0.45, '--moon', 0], [0.55, '--moon', 0.12], [0.65, '--moon', 0], [1, '--moon', 0]]),
      lin('t27g-frontG', 0, 0, 0, 1, [[0, '--t27-lac-rim', 1], [1, '--umbra', 1]])),
    s('path', { class: 't27g-trayshadow', d: quad([[fl[0] - tw * 0.02, fl[1] + th + 2], [fr[0] + tw * 0.03, fr[1] + th + 2], [fr[0] + tw * 0.05, fr[1] + th + tw * 0.03], [fl[0] - tw * 0.04, fl[1] + th + tw * 0.03]]), filter: 'url(#t27g-soft)' }),
    s('path', { class: 't27g-rim', d: quad([fl, fr, br, bl]) }),
    s('path', { d: quad([il, ir, jr, jl]), fill: 'url(#t27g-floor)' }),
    s('path', { class: 't27g-inner', d: quad([il, ir, jr, jl]) }),
    s('path', { class: 't27g-makie', d: grass }),
    s('path', { class: 't27g-makie t27g-moon', d: crescent }),
    s('path', { d: quad([il, ir, jr, jl]), fill: 'url(#t27g-gloss)' }),
    s('path', { class: 't27g-front', d: front, fill: 'url(#t27g-frontG)' }),
    s('path', { class: 't27g-side', d: side }),
    s('path', { class: 't27g-rimhi', d: stroke([[bl[0] + 4, bl[1] + 1.4], [br[0] - 4, br[1] + 1.4]], 1.4, 0.1, 0.1, 0.3) + stroke([[br[0] - 1.2, br[1] + 3], [fr[0] - 1.2, fr[1] - 3]], 1.4, 0.1, 0.1, 0.3) + stroke([[fl[0] + 3, fl[1] + 1], [fr[0] - 3, fr[1] + 1]], 1.2, 0.1, 0.1, 0.3) }),
    s('path', { class: 't27g-stand', d: stands }),
  ]
}

/** A beveled metal rim (disc px): lit on its upper right, dark on its lower left, a fine inner lip. */
function bevel(i: number, c: number, R: number): SVGElement[] {
  return [
    s('circle', { cx: c, cy: c, r: R * 0.955, fill: 'none', stroke: `url(#t27g-bev${i})`, 'stroke-width': f1(R * 0.09) }),
    s('circle', { class: 't27g-bevel-in', cx: c, cy: c, r: R * 0.905, fill: 'none' }),
    s('circle', { class: 't27g-bevel-out', cx: c, cy: c, r: R * 0.995, fill: 'none' }),
  ]
}
const bevelDefs = (i: number) => lin(`t27g-bev${i}`, 0.85, 0.1, 0.15, 0.9, i
  ? [[0, '--t27-bronze-hi', 1], [0.45, '--t27-bronze', 1], [1, '--t27-bronze-lo', 1]]
  : [[0, '--t27-gold-hi', 1], [0.45, '--t27-gold', 1], [1, '--t27-gold-lo', 1]])

/** The back of a mirror (disc px): a gilded rim with a chrysanthemum in relief, or plain bronze with green patina. */
function mirrorBack(i: number, D: number): SVGElement[] {
  const c = D / 2, R = D / 2
  if (i === 0) {
    let petals = ''
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2
      const tip: Pt = [c + Math.cos(a) * R * 0.62, c + Math.sin(a) * R * 0.62]
      petals += `M${f1(c)} ${f1(c)}Q${f1(c + Math.cos(a - 0.2) * R * 0.4)} ${f1(c + Math.sin(a - 0.2) * R * 0.4)} ${f1(tip[0])} ${f1(tip[1])}Q${f1(c + Math.cos(a + 0.2) * R * 0.4)} ${f1(c + Math.sin(a + 0.2) * R * 0.4)} ${f1(c)} ${f1(c)}Z`
    }
    let bead = ''
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * Math.PI * 2
      bead += blob(c + Math.cos(a) * R * 0.8, c + Math.sin(a) * R * 0.8, R * 0.03, R * 0.03, k, 0.1, 8)
    }
    return [
      s('defs', null, bevelDefs(0)),
      s('circle', { class: 't27g-gold', cx: c, cy: c, r: R }),
      s('circle', { class: 't27g-gold-in', cx: c, cy: c, r: R * 0.86 }),
      s('path', { class: 't27g-gold-hi', d: petals + bead }),
      s('circle', { class: 't27g-gold', cx: c, cy: c, r: R * 0.12 }),
      ...bevel(0, c, R),
    ]
  }
  let pat = ''
  const r = rng(2726)
  for (let k = 0; k < 7; k++) pat += blob(c + (r() - 0.5) * R * 1.3, c + (r() - 0.5) * R * 1.3, R * (0.06 + r() * 0.1), R * (0.04 + r() * 0.08), 2727 + k, 0.35, 10)
  return [
    s('defs', null, bevelDefs(1), s('clipPath', { id: 't27g-bclip' }, s('circle', { cx: c, cy: c, r: R * 0.9 }))),
    s('circle', { class: 't27g-bronze', cx: c, cy: c, r: R }),
    s('circle', { class: 't27g-bronze-in', cx: c, cy: c, r: R * 0.9 }),
    s('path', { class: 't27g-patina', d: pat, filter: 'url(#ink-wash)', 'clip-path': 'url(#t27g-bclip)' }),
    s('circle', { class: 't27g-bronze', cx: c, cy: c, r: R * 0.14 }),
    s('circle', { class: 't27g-knob', cx: c - R * 0.03, cy: c - R * 0.03, r: R * 0.06 }),
    ...bevel(1, c, R),
  ]
}

/** The glass (disc px): a polished face, the night in it, a moon streak, a dark vignette to the beveled rim. */
function mirrorFace(i: number, D: number): SVGElement[] {
  const c = D / 2, R = D / 2
  const id = `t27g-f${i}`
  return [
    s('defs', null,
      rad(`${id}-g`, i ? [[0, '--t27-glass-hi', 1], [0.55, '--t27-glass', 1], [1, '--t27-glass-lo', 1]] : [[0, '--t27-gglass-hi', 1], [0.55, '--t27-gglass', 1], [1, '--t27-gglass-lo', 1]], { cx: D * 0.4, cy: D * 0.34, r: D * 0.66 }),
      lin(`${id}-st`, 0, 0, 1, 0, [[0, '--moon', 0], [0.42, '--moon', 0.14], [0.5, '--moon', 0.32], [0.58, '--moon', 0.14], [1, '--moon', 0]]),
      rad(`${id}-v`, [[0, '--umbra', 0], [0.72, '--umbra', 0], [1, '--umbra', 0.7]], { cx: c, cy: c, r: R * 0.92 }),
      s('clipPath', { id: `${id}-c` }, s('circle', { cx: c, cy: c, r: R * 0.91 })),
      bevelDefs(i)),
    s('circle', { cx: c, cy: c, r: R * 0.92, fill: `url(#${id}-g)` }),
    s('g', { 'clip-path': `url(#${id}-c)` },
      s('rect', { x: f1(c + R * 0.2), y: f1(-R * 0.4), width: f1(R * 0.5), height: f1(D * 1.4), fill: `url(#${id}-st)`, transform: `rotate(38 ${f1(c)} ${f1(c)})` }),
      s('circle', { cx: c, cy: c, r: R * 0.92, fill: `url(#${id}-v)` })),
    ...bevel(i, c, R),
  ]
}

/** Scene 3 — two hand mirrors lie face down on a lacquer tray, hinged in their stands: lift one up to hear its answer. */
export function flatterScene(ctx: SceneCtx) {
  p2Defs()
  const calm = ctx.quality === 'low' || ctx.reduced
  const M = [K.gilded, K.bronze]
  const seen = [false, false]
  const up = [0, 0]
  let done = false
  const card = findTakeaway(K.takeaway)
  const live = h('p', { class: 'visually-hidden', 'aria-live': 'polite' })

  const scene = s('svg', { class: 't27g-scene', 'aria-hidden': 'true' })
  const shadows = M.map((_, i) => h('i', { class: `t27g-msh t27g-msh${i}` }))
  const noteEl = ctx.fact(F(K.note), 'p', 't27g-note')
  const slip = h('div', { class: 't27g-slip' }, h('p', { class: 't27g-slip-q' }, K.question), noteEl)
  const fold = card ? foldedTakeaway([card], ctx.onCleanup) : null
  const foldBox = h('div', { class: 't27g-fold' }, fold, h('p', { class: 't27g-see' }, K.seeAlso))
  const mirrors = M.map((m, i) => {
    const back = s('svg', { class: 't27g-backsvg', 'aria-hidden': 'true' })
    const face = s('svg', { class: 't27g-facesvg', 'aria-hidden': 'true' })
    const sweep = h('i', { class: 't27g-sweep', 'aria-hidden': 'true' })
    const front = h('div', { class: 't27g-front' }, face, h('div', { class: 't27g-refl', 'aria-hidden': 'true' }, h('p', null, K.question)), h('p', { class: 't27g-ans' }, m.answer), sweep, h('i', { class: 't27g-handle' }))
    const rear = h('div', { class: 't27g-rear' }, back, h('i', { class: 't27g-handle' }))
    const rimTab = h('i', { class: 't27g-grip' }) // where the hand takes it: the rim nearest you while it lies
    const el = h('button', { class: `t27g-m t27g-m${i}`, type: 'button', 'aria-label': m.aria, 'aria-pressed': 'false' },
      h('div', { class: 't27g-card' }, front, rear), rimTab)
    return { el, back, face, sweep, rimTab }
  })
  const standFronts = M.map(() => s('svg', { class: 't27g-standfront', 'aria-hidden': 'true' }))
  // the slip stands in a small wooden card stand (a slotted block) on the tray, its foot in the slot
  const slipStand = s('svg', { class: 't27g-standfront t27g-slipstand', 'aria-hidden': 'true' })
  // the hidden gesture made visible: a faint ink stroke rising from the rim you lift (gone once that mirror has spoken)
  const ups = M.map(() => s('svg', { class: 't27g-up', viewBox: '-20 -70 40 76', 'aria-hidden': 'true' },
    s('path', { d: stroke([[0, 2], [3, -22], [-2, -44], [1, -62]], 2.4, 0.4, 0.05, 0.3) + stroke([[-9, -52], [1, -64], [9, -51]], 2, 0.3, 0.3, 0.2) })))
  const root = h('div', { class: `t27g${calm ? ' is-calm' : ''}` },
    h('p', { class: 'visually-hidden' }, K.art), scene, ...shadows, slip, foldBox, ...mirrors.map((m) => m.el), ...standFronts, slipStand, ...ups, live)
  ctx.art.append(root)
  ctx.prompt(K.prompt)
  // H1 a dot on the rim you lift; H2 a faint ink arc from that rim up to where the mirror's top will stand
  const gd = guide(ctx)
  let G: Geo | null = null
  const arc = (i: number): Pt[] => {
    const g = G
    if (!g) return [[0, 0], [1, 0]]
    const [X, Z] = g.stand[i]
    const [x, y, k] = proj(g, X, Z)
    const R = g.D * (1 + HANDLE) * k
    // the rim's way as the mirror turns up on its hinge: from lying toward you to standing over the stand
    return Array.from({ length: 10 }, (_, j) => {
      const a = ((LIE + (j / 9) * -LIE) * Math.PI) / 180
      return [x + (j - 4.5) * 0.4, y - Math.cos(a) * R] as Pt
    })
  }
  const dots: (Mark | null)[] = mirrors.map((m) => gd.dot(m.rimTab, { dir: [0, -1] }))
  const ways: (Track | null)[] = calm ? [null, null] : mirrors.map((_, i) => gd.track(() => arc(i), { ticks: 0 }))
  const stable = stableHeight(ctx, [F(K.insight)])

  function layout() {
    const W = root.clientWidth, Hr = root.clientHeight
    if (W < 60 || Hr < 60) return
    const H = wideZone() ? Hr : stable(Hr)
    const g = (G = geo(W, H))
    scene.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    Object.assign(scene.style, { width: `${f1(W)}px`, height: `${f1(H)}px` })
    scene.replaceChildren(...room(g), ...tatami(g), ...tray(g))
    const D = g.D
    root.style.setProperty('--D', `${f1(D)}px`)
    root.style.setProperty('--hd', `${f1(D * HANDLE)}px`)
    mirrors.forEach((m, i) => {
      m.back.setAttribute('viewBox', `0 0 ${f1(D)} ${f1(D)}`)
      m.back.replaceChildren(...mirrorBack(i, D))
      m.face.setAttribute('viewBox', `0 0 ${f1(D)} ${f1(D)}`)
      m.face.replaceChildren(...mirrorFace(i, D))
      const [X, Z] = g.stand[i]
      const [x, y, k] = proj(g, X, Z)
      // the element's foot (the handle's end) sits in the stand's slot; it turns about that foot
      Object.assign(m.el.style, { left: `${f1(x - D / 2)}px`, top: `${f1(y - D * (1 + HANDLE))}px`, zIndex: String(Math.round(y)) })
      m.el.style.setProperty('--k', k.toFixed(4))
      // the up-stroke stands just past the lying rim
      const [ux, uy, uk] = proj(g, X, Z - D * (1 + HANDLE) * 0.8)
      const side = g.land || i ? 1 : -1 // beside the lying disc, on its open side
      Object.assign(ups[i].style, { left: `${f1(ux + side * (D * 0.56 * uk + 6) - 20)}px`, top: `${f1(uy - 64)}px` })
      // the stand's front lip in front of the handle
      const sf = standFronts[i], w = D * 0.44 * k, hh = D * 0.13 * k
      sf.setAttribute('viewBox', `0 0 ${f1(w)} ${f1(hh + 2)}`)
      Object.assign(sf.style, { left: `${f1(x - w / 2)}px`, top: `${f1(y - hh)}px`, width: `${f1(w)}px`, height: `${f1(hh + 2)}px`, zIndex: String(Math.round(y) + 1) })
      sf.replaceChildren(s('path', { class: 't27g-standlip', d: `M0 ${f1(hh)}L${f1(w)} ${f1(hh)}L${f1(w * 0.92)} ${f1(hh * 0.25)}L${f1(w * 0.08)} ${f1(hh * 0.25)}Z` }),
        s('path', { class: 't27g-standhi', d: stroke([[w * 0.1, hh * 0.3], [w * 0.9, hh * 0.3]], 1.2, 0.1, 0.1, 0.2) }))
    })
    // the question slip at the back, folded paper casting a little shadow
    const [sx, sy] = proj(g, g.slip[0], g.slip[1])
    const sw = g.land ? Math.min(250, g.tw * 0.2) : g.W * 0.42
    slip.classList.toggle('on-wall', !g.land)
    slipStand.style.display = g.land ? '' : 'none'
    if (g.land) {
      const bw = sw * 0.62, bh = Math.max(10, sw * 0.07)
      Object.assign(slip.style, { left: `${f1(sx - sw / 2)}px`, top: 'auto', bottom: `${f1(Hr - sy + bh * 0.55)}px`, width: `${f1(sw)}px` })
      slipStand.setAttribute('viewBox', `${f1(-bw * 0.7)} ${f1(-bh)} ${f1(bw * 1.4)} ${f1(bh * 1.9)}`)
      Object.assign(slipStand.style, { left: `${f1(sx - bw * 0.7)}px`, top: `${f1(sy - bh)}px`, width: `${f1(bw * 1.4)}px`, height: `${f1(bh * 1.9)}px`, zIndex: '2' })
      slipStand.replaceChildren(
        s('ellipse', { class: 't27g-slipshadow', cx: f1(-bw * 0.06), cy: f1(bh * 0.15), rx: f1(bw * 0.66), ry: f1(bh * 0.5) }),
        s('path', { class: 't27g-standlip', d: `M${f1(-bw / 2)} 0L${f1(bw / 2)} 0L${f1(bw * 0.46)} ${f1(-bh)}L${f1(-bw * 0.46)} ${f1(-bh)}Z` }),
        s('path', { class: 't27g-standslot', d: `M${f1(-bw * 0.42)} ${f1(-bh * 0.82)}L${f1(bw * 0.42)} ${f1(-bh * 0.82)}` }),
        s('path', { class: 't27g-standhi', d: stroke([[-bw * 0.45, -bh * 0.96], [bw * 0.45, -bh * 0.96]], 1.2, 0.1, 0.1, 0.2) }))
    } else Object.assign(slip.style, { left: `${f1(g.W * 0.54)}px`, top: `${f1(g.H * 0.02)}px`, bottom: 'auto', width: `${f1(sw)}px` })
    // the take-away lies where the bronze mirror lay: revealed once it stands
    const [fx, fy] = proj(g, g.stand[1][0], g.stand[1][1] - D * (1 + HANDLE) * 0.55)
    const fw = Math.min(320, g.W * 0.8)
    Object.assign(foldBox.style, { left: `${f1(g.land ? fx - fw / 2 : g.cx - fw / 2)}px`, top: `${f1(fy - 26)}px`, width: `${f1(fw)}px` })
    mirrors.forEach((_, i) => pose(i, up[i]))
    gd.refresh()
  }
  ctx.onCleanup(onSize(root, layout))

  // ── a mirror's pose for lift t (0 face down toward you … 1 standing in its stand, its face to you) ──
  function pose(i: number, t: number) {
    const g = G
    if (!g) return
    const e = t * t * (3 - 2 * t)
    const a = LIE * (1 - e)
    const m = mirrors[i]
    m.el.style.transform = `scale(var(--k)) perspective(${f1(g.D * 4)}px) rotateX(${f1(a)}deg)`
    m.el.classList.toggle('is-up', e > 0.6)
    const [X, Z] = g.stand[i]
    // its shadow on the lacquer: under the disc while it lies, a short cast behind the stand as it stands
    const [x0, y0, k0] = proj(g, X, Z - g.D * (1 + HANDLE) * 0.55)
    const [x1, y1, k1] = proj(g, X - g.D * 0.3, Z + g.D * 0.1)
    const x = x0 + (x1 - x0) * e, y = y0 + (y1 - y0) * e, k = k0 + (k1 - k0) * e
    Object.assign(shadows[i].style, { transform: `translate3d(${f1(x)}px,${f1(y)}px,0) translate(-50%,-50%) scale(${(k * (1 - e * 0.35)).toFixed(3)},${(k * (0.5 - e * 0.25)).toFixed(3)})` })
  }
  function setUp(i: number, v: number) {
    up[i] = v
    mirrors[i].el.setAttribute('aria-pressed', String(v === 1))
    pose(i, v)
    if (v === 1) {
      if (!calm) mirrors[i].sweep.animate([{ transform: 'translateX(-130%) rotate(18deg)', opacity: 0 }, { opacity: 1, offset: 0.4 }, { transform: 'translateX(130%) rotate(18deg)', opacity: 0 }], { duration: 900, delay: 380, easing: 'ease-in-out' })
      saw(i)
    }
  }
  function saw(i: number) {
    live.textContent = `${M[i].label}: ${M[i].answer}`
    ctx.chime('soft')
    if (i === 1) root.classList.add('fold-on')
    if (seen[i]) return
    if (!seen[0] && !seen[1]) root.dataset.first = i ? 'bronze' : 'gilded' // the viewer's own pick, kept
    seen[i] = true
    root.classList.add('noted')
    dots[i]?.done()
    dots[i] = null
    ways[i]?.done()
    ways[i] = null
    ups[i].classList.add('out')
    if (!seen.every(Boolean)) ctx.prompt(K.promptNext)
    if (!done && seen.every(Boolean)) {
      done = true
      root.classList.add('done')
      window.setTimeout(() => {
        ctx.chime('ok')
        ctx.insight(F(K.insight), F(K.detail))
      }, ctx.reduced ? 0 : 1100)
    }
  }

  // ── drag the near rim upward to stand the mirror (it follows the hand), or tap / Enter to turn it ──
  mirrors.forEach((m, i) => {
    m.el.addEventListener('click', (e) => e.detail === 0 && setUp(i, up[i] ? 0 : 1))
    m.el.addEventListener('pointerdown', (e) => {
      if (e.button || !G) return
      const y0 = e.clientY, t0 = up[i]
      let t = t0, moved = false
      m.el.setPointerCapture(e.pointerId)
      const span = G.D * (1 + HANDLE) * 0.9
      const move = (ev: PointerEvent) => {
        if (!moved && Math.abs(ev.clientY - y0) < 6) return
        moved = true
        root.classList.add('drag')
        t = clamp(t0 + (y0 - ev.clientY) / span, 0, 1)
        ways[i]?.set(t)
        if (!calm) pose(i, t)
      }
      const end = () => {
        m.el.removeEventListener('pointermove', move)
        m.el.removeEventListener('pointerup', end)
        m.el.removeEventListener('pointercancel', end)
        root.classList.remove('drag')
        if (!moved) return setUp(i, up[i] ? 0 : 1)
        setUp(i, t > (t0 ? 0.6 : 0.4) ? 1 : 0)
      }
      m.el.addEventListener('pointermove', move)
      m.el.addEventListener('pointerup', end)
      m.el.addEventListener('pointercancel', end)
    })
  })
  // H7: standing still, the mirror not yet heard lifts its rim a few degrees and settles
  invite(ctx, () => {
    const i = seen.findIndex((x) => !x)
    if (i >= 0 && !up[i]) nudge(ctx, mirrors[i].el, 0, -6)
  })
}
