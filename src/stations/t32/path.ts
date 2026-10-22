import raw from '../../content/tram-32.json'
import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { guide, type Mark } from '../../ui/part2/guide'
import type { SceneDef } from '../types'
import type { StepPath } from '../../ui/part2/types'
import { stepPath, type PathGeo, type SlotGeo } from '../../ui/part2/steps'
import { blob, clamp, curve, rng, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist, moon, pine, wash } from '../../ui/part2/paint'

const K = raw.scenes.lamps
const f1 = (n: number) => (Math.round(n * 10) / 10).toString()

/**
 * Scene 4 — "Thắp đèn đầu tiên": build a stone lantern (tōrō) on its footing in the moss. The four steps are its four
 * parts — the base (kiso), the round shaft (sao), the fire box on its platform (hibukuro), the roof with its jewel
 * (kasa, hōju) — lying in the moss with their contact shadows, each with its step on a small brushed tag beside it. Set
 * them in order and the lantern rises, part on part; the roof in: the fire box lights, its glow spills on the moss, and
 * far off in the mist your house's window lights too. 2.5D: painted flats with the stepPath stones as the parts.
 */

/** each part's width and height, as shares of the stone box's width (the box is the same for all; the art overflows it) */
const PW = [0.74, 0.24, 0.62, 0.98]
const PH = [0.2, 0.5, 0.38, 0.36]

/** the scene's layout, set in slots() (it runs first on every layout) and read by pile(), art() and the tags */
const G = {
  row: true,
  hz: 0, // where the far ground meets the mist
  foot: [0, 0] as Pt, // the lantern's centre x and the ground line under its base
  unit: 100, // the stone box's width
  boxH: 40, // the stone box's height
  S: 1, // the parts' scale
  slot: [] as Pt[], // the parts' places (centres), base to roof
  stele: { x: 0, y: 0, w: 0, h: 0 }, // the standing stone the steps are carved on (left, top, width, height)
  house: [0, 0, 0] as [number, number, number], // your house far off: centre x, ground y, wall width
}

/** the parts' places, bottom (base) to top (roof): each sits on the one below */
function slots(g: SlotGeo): Pt[] {
  const [w, bh] = g.size
  const row = g.row
  const H = g.h - g.top
  G.row = row
  G.unit = w
  G.boxH = bh
  // the camera low: a big lantern at the lower third, the steps' stone behind it to the left, the house far off on the other side
  G.S = row ? 1.45 : 1.05
  G.hz = g.top + H * (row ? 0.42 : 0.22)
  const x = row ? g.w * 0.5 : g.w * 0.68
  const ground = g.top + H * (row ? 0.78 : 0.58)
  G.foot = [x, ground]
  G.stele = row
    ? { x: g.w * 0.27 - 95, y: g.top + H * 0.6 - 236, w: 190, h: 236 }
    : { x: 10, y: g.top + H * 0.3, w: Math.min(132, x - G.S * w * 0.49 - 16), h: H * 0.25 }
  G.house = row ? [g.w * 0.8, G.hz + 6, 112] : [g.w * 0.2, G.hz + 4, 64]
  let y = ground
  G.slot = Array.from({ length: g.n }, (_, i) => {
    const hh = PH[i] * G.S * w
    const c: Pt = [x, y - hh / 2]
    y -= hh * 0.97
    return c
  })
  // a resize: the steps already carved follow their stone
  document.querySelectorAll<HTMLElement>('.t32p .p2s-stone.placed').forEach((el) => {
    const k = PARTS.findIndex((c) => el.querySelector(`.${c}`))
    if (k >= 0) carve(el, k)
  })
  return G.slot
}
const PARTS = ['t32p-part0', 't32p-part1', 't32p-part2', 't32p-part3']

/** where the loose parts lie in the moss: an arc in front, two each side of the footing, the near pair lower and closer */
function pile(g: SlotGeo): Pt[] {
  const u = G.unit
  const [fx, fy] = G.foot
  const H = g.h - g.top
  if (g.row) return [[fx - u * 2.45, fy - u * 0.12], [fx + u * 2.45, fy - u * 0.14], [fx - u * 1.32, fy + u * 0.42], [fx + u * 1.36, fy + u * 0.4]]
  return [[g.w * 0.26, g.top + H * 0.68], [g.w * 0.75, g.top + H * 0.69], [g.w * 0.27, g.top + H * 0.885], [g.w * 0.74, g.top + H * 0.885]]
}

/** a step set in the lantern: its tag is carved on the standing stone, base at the foot of the stone, roof at its top */
function carve(el: HTMLElement, k: number) {
  const { x, y, w, h } = G.stele
  const pad = G.row ? 16 : 9
  const head = G.row ? 40 : 30 // the tier count is carved across the stone's crown
  const line = (h - head - pad) / 4
  const [sx, sy] = G.slot[k] ?? [0, 0]
  const bx = sx - G.unit / 2, by = sy - G.boxH / 2 // the part's box, where its tag lives
  el.style.setProperty('--lx', `${f1(x + pad - bx)}px`)
  el.style.setProperty('--ly', `${f1(y + head + (3 - k) * line - by)}px`)
  el.style.setProperty('--lw', `${f1(w - pad * 2)}px`)
  el.style.setProperty('--lh', `${f1(line)}px`)
}

/** stone speckle inside a rect (x0, y0, w, h): small grains, light and dark */
function speckle(r: () => number, x0: number, y0: number, w: number, hh: number, n: number) {
  let d = ''
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * w, y = y0 + r() * hh, s0 = 0.6 + r() * 1.2
    d += `M${f1(x)} ${f1(y)}h${f1(s0)}v${f1(s0)}h${f1(-s0)}Z`
  }
  return d
}

/**
 * A hexagonal block seen a little from above, the moon to the upper left: its top, and the four faces toward us — the
 * left one lit, the front-left mid, the front-right dimmer, the right in shade — as quads (corner points) and paths.
 */
function hexBlock(cx: number, yTop: number, rw: number, hh: number, tilt: number) {
  const ry = rw * tilt
  const A = [7, 9, 11, 1, 3, 5].map((k) => (Math.PI * k) / 6) // 0 back-left … 3 front-right, 4 front, 5 front-left
  const top = A.map((a): Pt => [cx + Math.cos(a) * rw, yTop + Math.sin(a) * ry])
  const bot = top.map(([x, y]): Pt => [x, y + hh])
  const quad = (i: number, j: number): Pt[] => [top[i], top[j], bot[j], bot[i]]
  const path = (pts: Pt[]) => `M${pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')}Z`
  const q = { lit: quad(0, 5), mid: quad(5, 4), dim: quad(4, 3), dark: quad(3, 2) }
  return {
    q,
    top: path(top),
    lit: path(q.lit), mid: path(q.mid), dim: path(q.dim), dark: path(q.dark),
    edge: [bot[0], bot[5], bot[4], bot[3], bot[2]] as Pt[],
    rim: [top[0], top[5], top[4]] as Pt[],
  }
}
const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
/** a point on a face quad [top a, top b, bottom b, bottom a] at (u across, v down) */
const onFace = (f: Pt[], u: number, v: number): Pt => lerp(lerp(f[0], f[1], u), lerp(f[3], f[2], u), v)
/** the four faces of a hex block, toned */
const faces = (b: ReturnType<typeof hexBlock>) => [
  s('path', { class: 't32p-lit', d: b.lit }), s('path', { class: 't32p-face', d: b.mid }), s('path', { class: 't32p-dim', d: b.dim }), s('path', { class: 't32p-shade', d: b.dark }), s('path', { class: 't32p-top', d: b.top }),
]

/** one carved granite part of the lantern, drawn in a w × h box (centred, overflowing it), its shadow on the moss under it */
function piece(i: number, { w, h, seed }: { w: number; h: number; seed: number }): SVGElement {
  const r = rng(seed)
  const cx = w / 2, cy = h / 2
  const pw = PW[i] * G.S * w, ph = PH[i] * G.S * w
  const y0 = cy - ph / 2, y1 = cy + ph / 2
  const g = s('g', { class: `t32p-part t32p-part${i}` })
  const body = s('g', { class: 't32p-body' })
  const cast = (rx: number, yy: number) => s('ellipse', { class: 't32p-cast', cx: f1(cx + rx * 0.12), cy: f1(yy + 1), rx: f1(rx * 1.12), ry: f1(Math.max(3, rx * 0.16)) })
  const tilt = 0.24
  if (i === 0) {
    // kiso: a hexagonal plinth, a low lotus step on it, moss at its foot
    const hb = hexBlock(cx, y0 + ph * 0.38, pw / 2, ph * 0.5, tilt)
    const hs = hexBlock(cx, y0 + ph * 0.08, pw * 0.34, ph * 0.3, tilt)
    g.append(cast(pw / 2, y1))
    body.append(
      ...faces(hb), ...faces(hs),
      s('path', { class: 't32p-grain', d: speckle(r, cx - pw / 2, y0 + ph * 0.4, pw, ph * 0.55, 40) }),
      s('path', { class: 't32p-ink', d: stroke(hb.edge, 1.6, 0.1, 0.1, 0.4) + stroke(hs.edge, 1.2, 0.1, 0.1, 0.4), filter: 'url(#ink-rough)' }),
      s('path', { class: 't32p-rim', d: stroke(hb.rim, 1.2, 0.2, 0.3, 0.2) + stroke(hs.rim, 1, 0.2, 0.3, 0.2) }),
      s('path', { class: 't32p-moss', d: blob(cx - pw * 0.3, y1 - ph * 0.08, pw * 0.16, ph * 0.1, seed + 3, 0.35) + blob(cx + pw * 0.28, y1 - ph * 0.04, pw * 0.1, ph * 0.08, seed + 4, 0.35) + blob(cx - pw * 0.05, y0 + ph * 0.42, pw * 0.12, ph * 0.05, seed + 5, 0.3) }))
  } else if (i === 1) {
    // sao: a round column swelling a little at its middle, a carved ring (fushi) round its waist
    const rw = pw / 2, ry = rw * 0.3
    const sw = rw * 1.04
    const col = `M${f1(cx - rw)} ${f1(y0 + ry)}C${f1(cx - sw)} ${f1(cy - ph * 0.15)} ${f1(cx - sw)} ${f1(cy + ph * 0.15)} ${f1(cx - rw)} ${f1(y1 - ry)}A${f1(rw)} ${f1(ry)} 0 0 0 ${f1(cx + rw)} ${f1(y1 - ry)}C${f1(cx + sw)} ${f1(cy + ph * 0.15)} ${f1(cx + sw)} ${f1(cy - ph * 0.15)} ${f1(cx + rw)} ${f1(y0 + ry)}A${f1(rw)} ${f1(ry)} 0 0 0 ${f1(cx - rw)} ${f1(y0 + ry)}Z`
    const band = (yy: number) => `M${f1(cx - sw)} ${f1(yy)}A${f1(sw)} ${f1(ry)} 0 0 0 ${f1(cx + sw)} ${f1(yy)}`
    g.append(s('ellipse', { class: 't32p-cast t32p-cast-lie', cx: f1(cx + ph * 0.06), cy: f1(cy + rw + 1), rx: f1(ph * 0.56), ry: f1(Math.max(3, rw * 0.32)) }), cast(rw, y1))
    body.append(
      s('path', { class: 't32p-face', d: col }),
      s('path', { class: 't32p-lit', d: `M${f1(cx - rw * 0.55)} ${f1(y0 + ry * 1.6)}C${f1(cx - rw * 0.7)} ${f1(cy)} ${f1(cx - rw * 0.7)} ${f1(cy)} ${f1(cx - rw * 0.55)} ${f1(y1 - ry * 0.4)}L${f1(cx - rw * 0.1)} ${f1(y1 - ry * 0.1)}L${f1(cx - rw * 0.1)} ${f1(y0 + ry * 2)}Z` }),
      s('path', { class: 't32p-shade', d: `M${f1(cx + rw * 0.3)} ${f1(y0 + ry * 1.9)}C${f1(cx + sw)} ${f1(cy - ph * 0.1)} ${f1(cx + sw)} ${f1(cy + ph * 0.1)} ${f1(cx + rw)} ${f1(y1 - ry)}L${f1(cx + rw * 0.3)} ${f1(y1)}Z` }),
      s('ellipse', { class: 't32p-top', cx: f1(cx), cy: f1(y0 + ry), rx: f1(rw), ry: f1(ry) }),
      s('path', { class: 't32p-grain', d: speckle(r, cx - rw, y0 + ry, rw * 2, ph - ry * 2, 34) }),
      s('path', { class: 't32p-band', d: band(cy - 2) + band(cy + 2) }),
      s('path', { class: 't32p-ink', d: stroke([[cx + rw, y0 + ry], [cx + sw, cy], [cx + rw, y1 - ry]], 1.5, 0.1, 0.1, 0.4) + stroke(curve([cx - rw, y1 - ry], [cx, y1 + ry * 0.9], [cx + rw, y1 - ry], 8), 1.6, 0.1, 0.1, 0.4), filter: 'url(#ink-rough)' }),
      s('path', { class: 't32p-rim', d: stroke(curve([cx - rw + 1, y0 + ry], [cx - rw * 0.3, y0 - ry * 0.2], [cx + rw * 0.4, y0 + ry * 0.1], 8), 1.1, 0.2, 0.3, 0.2) }),
      s('path', { class: 't32p-moss', d: blob(cx - rw * 0.4, y1 - ph * 0.12, rw * 0.35, ph * 0.04, seed + 6, 0.35) }))
  } else if (i === 2) {
    // the platform (chūdai), then the fire box (hibukuro) on it: hexagonal, a window cut through its front, a round moon
    // window and a crescent in its sides; a halo for when it burns
    const ch = ph * 0.26, bh = ph * 0.62
    const plat = hexBlock(cx, y1 - ch * 0.9, pw / 2, ch * 0.7, tilt)
    const box = hexBlock(cx, y0 + ph * 0.06, pw * 0.36, bh, tilt)
    const cap = hexBlock(cx, y0, pw * 0.4, ph * 0.08, tilt)
    const win = (f: Pt[], u0: number, u1: number, v0: number, v1: number) => `M${[onFace(f, u0, v0), onFace(f, u1, v0), onFace(f, u1, v1), onFace(f, u0, v1)].map((q) => `${f1(q[0])} ${f1(q[1])}`).join('L')}Z`
    const mc = onFace(box.q.lit, 0.5, 0.48)
    g.append(cast(pw / 2, y1))
    body.append(
      s('circle', { class: 't32p-halo', cx: f1(cx), cy: f1(y0 + ph * 0.35), r: f1(pw * 1.1), fill: 'url(#p2-lamp)' }),
      ...faces(plat), ...faces(box).slice(0, 4),
      s('path', { class: 't32p-win', d: win(box.q.mid, 0.2, 0.8, 0.16, 0.84) }),
      s('path', { class: 't32p-win', d: win(box.q.dim, 0.3, 0.7, 0.24, 0.76) }),
      s('ellipse', { class: 't32p-win', cx: f1(mc[0]), cy: f1(mc[1]), rx: f1(pw * 0.045), ry: f1(bh * 0.16) }),
      ...faces(cap),
      s('path', { class: 't32p-grain', d: speckle(r, cx - pw / 2, y0, pw, ph, 40) }),
      s('path', { class: 't32p-ink', d: stroke(plat.edge, 1.5, 0.1, 0.1, 0.4) + stroke(box.edge, 1.3, 0.1, 0.1, 0.4) + stroke(cap.edge, 1.1, 0.1, 0.1, 0.4), filter: 'url(#ink-rough)' }),
      s('path', { class: 't32p-rim', d: stroke(plat.rim, 1.1, 0.2, 0.3, 0.2) + stroke(cap.rim, 1, 0.2, 0.3, 0.2) }),
      s('path', { class: 't32p-moss', d: blob(cx + pw * 0.3, y1 - ch * 0.5, pw * 0.1, ch * 0.18, seed + 7, 0.35) }))
  } else {
    // kasa: a broad hexagonal roof, its six corners curling up (warabide), a lotus cup and the jewel (hōju) on top
    const ey = y0 + ph * 0.66, rw = pw / 2, ry = rw * tilt * 0.9
    const eave: Pt[] = [[cx - rw, ey - ph * 0.16], [cx - rw * 0.86, ey + ph * 0.02], [cx - rw * 0.5, ey + ry * 0.55], [cx, ey + ry * 0.72], [cx + rw * 0.5, ey + ry * 0.55], [cx + rw * 0.86, ey + ph * 0.02], [cx + rw, ey - ph * 0.16]]
    const peak: Pt = [cx, y0 + ph * 0.26]
    const pts = (a: Pt[]) => a.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')
    const roof = `M${pts(eave)}Q${f1(cx + rw * 0.55)} ${f1(ey - ph * 0.18)} ${f1(cx + rw * 0.2)} ${f1(peak[1] + ph * 0.06)}L${f1(cx - rw * 0.2)} ${f1(peak[1] + ph * 0.06)}Q${f1(cx - rw * 0.55)} ${f1(ey - ph * 0.18)} ${f1(eave[0][0])} ${f1(eave[0][1])}Z`
    const under = `M${pts(eave.slice(1, 6))}L${f1(cx + rw * 0.8)} ${f1(ey + ph * 0.1)}Q${f1(cx)} ${f1(ey + ry * 1.25)} ${f1(cx - rw * 0.8)} ${f1(ey + ph * 0.1)}Z`
    const ridge = (a: Pt) => stroke(curve([cx, peak[1] + ph * 0.07], [(cx + a[0]) / 2, (peak[1] + a[1]) / 2 + ph * 0.06], a, 8), 1.2, 0.1, 0.2, 0.3)
    const hoju = `M${f1(cx)} ${f1(y0)}C${f1(cx + pw * 0.06)} ${f1(y0 + ph * 0.06)} ${f1(cx + pw * 0.07)} ${f1(y0 + ph * 0.15)} ${f1(cx)} ${f1(y0 + ph * 0.17)}C${f1(cx - pw * 0.07)} ${f1(y0 + ph * 0.15)} ${f1(cx - pw * 0.06)} ${f1(y0 + ph * 0.06)} ${f1(cx)} ${f1(y0)}Z`
    g.append(cast(rw * 0.9, y1))
    body.append(
      s('path', { class: 't32p-shade', d: under }),
      s('path', { class: 't32p-face', d: roof }),
      s('path', { class: 't32p-lit', d: `M${f1(eave[1][0])} ${f1(eave[1][1])}L${f1(eave[2][0])} ${f1(eave[2][1])}L${f1(eave[3][0])} ${f1(eave[3][1])}L${f1(cx - rw * 0.05)} ${f1(peak[1] + ph * 0.07)}L${f1(cx - rw * 0.2)} ${f1(peak[1] + ph * 0.06)}Q${f1(cx - rw * 0.55)} ${f1(ey - ph * 0.18)} ${f1(eave[0][0])} ${f1(eave[0][1])}Z` }),
      s('path', { class: 't32p-shade', d: `M${f1(eave[3][0])} ${f1(eave[3][1])}L${f1(eave[4][0])} ${f1(eave[4][1])}L${f1(eave[5][0])} ${f1(eave[5][1])}L${f1(eave[6][0])} ${f1(eave[6][1])}Q${f1(cx + rw * 0.55)} ${f1(ey - ph * 0.18)} ${f1(cx + rw * 0.2)} ${f1(peak[1] + ph * 0.06)}L${f1(cx + rw * 0.05)} ${f1(peak[1] + ph * 0.07)}Z` }),
      s('path', { class: 't32p-grain', d: speckle(r, cx - rw * 0.7, peak[1] + ph * 0.1, rw * 1.4, ph * 0.3, 40) }),
      s('path', { class: 't32p-ink', d: ridge(eave[3]) + ridge(eave[1]) + ridge(eave[5]) }),
      s('path', { class: 't32p-ink', d: stroke(eave, 2, 0.06, 0.06, 0.45), filter: 'url(#ink-rough)' }),
      s('ellipse', { class: 't32p-top', cx: f1(cx), cy: f1(peak[1] + ph * 0.05), rx: f1(pw * 0.1), ry: f1(pw * 0.025) }),
      s('path', { class: 't32p-face', d: `M${f1(cx - pw * 0.09)} ${f1(peak[1] + ph * 0.05)}Q${f1(cx)} ${f1(peak[1] - ph * 0.08)} ${f1(cx + pw * 0.09)} ${f1(peak[1] + ph * 0.05)}Z` }),
      s('path', { class: 't32p-face', d: hoju }),
      s('path', { class: 't32p-shade', d: `M${f1(cx + pw * 0.01)} ${f1(y0 + ph * 0.02)}C${f1(cx + pw * 0.06)} ${f1(y0 + ph * 0.07)} ${f1(cx + pw * 0.07)} ${f1(y0 + ph * 0.15)} ${f1(cx)} ${f1(y0 + ph * 0.17)}Z` }),
      s('path', { class: 't32p-rim', d: stroke(curve(eave[0], [cx - rw * 0.5, ey - ph * 0.22], [cx - rw * 0.18, peak[1] + ph * 0.08], 10), 1.3, 0.2, 0.3, 0.15) + stroke([[cx - pw * 0.04, y0 + ph * 0.04], [cx - pw * 0.05, y0 + ph * 0.11]], 1.1, 0.2, 0.3, 0.2) }),
      s('path', { class: 't32p-moss', d: blob(cx - rw * 0.42, ey - ph * 0.2, rw * 0.2, ph * 0.04, seed + 8, 0.35) + blob(cx + rw * 0.3, ey - ph * 0.16, rw * 0.12, ph * 0.03, seed + 9, 0.35) }))
  }
  g.append(body)
  return g
}

const pts = (a: Pt[]) => a.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')

/** your house far off on a rise: a stone plinth, plastered walls between dark posts, a lattice window (dark until the end),
 * a hipped roof whose eaves rest on the wall plate and reach past it, a small pine at its side, its shadow on the ground */
function houseArt(hx: number, gy: number, hw: number, seed: number): SVGElement {
  const wh = hw * 0.4, plinth = hw * 0.05
  const x0 = hx - hw / 2, x1 = hx + hw / 2
  const wt = gy - plinth - wh // the wall plate
  const ov = hw * 0.17, rh = hw * 0.34 // the eaves' reach past the walls, the roof's height
  const ey = wt + hw * 0.035 // the eave's lower edge comes down over the wall plate: no daylight between
  const roof = `M${f1(x0 - ov)} ${f1(ey)}Q${f1(x0 - ov * 0.4)} ${f1(ey - hw * 0.02)} ${f1(x0 + hw * 0.08)} ${f1(wt - rh * 0.55)}L${f1(x0 + hw * 0.24)} ${f1(wt - rh)}L${f1(x1 - hw * 0.24)} ${f1(wt - rh)}L${f1(x1 - hw * 0.08)} ${f1(wt - rh * 0.55)}Q${f1(x1 + ov * 0.4)} ${f1(ey - hw * 0.02)} ${f1(x1 + ov)} ${f1(ey)}Z`
  const lit = `M${f1(x0 - ov)} ${f1(ey)}Q${f1(x0 - ov * 0.4)} ${f1(ey - hw * 0.02)} ${f1(x0 + hw * 0.08)} ${f1(wt - rh * 0.55)}L${f1(x0 + hw * 0.24)} ${f1(wt - rh)}L${f1(x0 + hw * 0.3)} ${f1(wt - rh * 0.6)}L${f1(x0 + hw * 0.12)} ${f1(ey)}Z`
  const under = `M${f1(x0 - ov)} ${f1(ey)}L${f1(x1 + ov)} ${f1(ey)}L${f1(x1 + ov * 0.2)} ${f1(ey + hw * 0.035)}L${f1(x0 - ov * 0.2)} ${f1(ey + hw * 0.035)}Z`
  const ridge = `M${f1(x0 + hw * 0.2)} ${f1(wt - rh - hw * 0.035)}L${f1(x1 - hw * 0.2)} ${f1(wt - rh - hw * 0.035)}`
  const posts = [0.02, 0.36, 0.64, 0.98].map((u) => `M${f1(x0 + hw * u - hw * 0.018)} ${f1(wt)}h${f1(hw * 0.036)}V${f1(gy - plinth)}h${f1(-hw * 0.036)}Z`).join('')
  const wx0 = x0 + hw * 0.08, wx1 = x0 + hw * 0.32, wy0 = wt + wh * 0.26, wy1 = wt + wh * 0.72
  let lat = ''
  for (let i = 1; i < 4; i++) lat += `M${f1(wx0 + ((wx1 - wx0) * i) / 4)} ${f1(wy0)}V${f1(wy1)}`
  lat += `M${f1(wx0)} ${f1((wy0 + wy1) / 2)}H${f1(wx1)}`
  const door = `M${f1(x0 + hw * 0.43)} ${f1(wt + wh * 0.2)}H${f1(x0 + hw * 0.6)}V${f1(gy - plinth)}H${f1(x0 + hw * 0.43)}Z`
  return s('g', { class: 't32p-house' },
    s('circle', { class: 't32p-house-glow', cx: f1(x0 + hw * 0.2), cy: f1(wt + wh * 0.5), r: f1(hw * 0.9), fill: 'url(#p2-lamp)' }),
    wash(blob(hx + hw * 0.22, gy + 2, hw * 0.85, hw * 0.06, seed + 1, 0.2), 0.32),
    s('path', { class: 't32p-house-spill', d: blob(x0 + hw * 0.2, gy + hw * 0.05, hw * 0.4, hw * 0.05, seed + 2, 0.2) }),
    s('path', { class: 't32p-house-plinth', d: `M${f1(x0 - hw * 0.03)} ${f1(gy)}V${f1(gy - plinth)}H${f1(x1 + hw * 0.03)}V${f1(gy)}Z` }),
    s('path', { class: 't32p-house-wall', d: `M${f1(x0)} ${f1(gy - plinth)}V${f1(wt)}H${f1(x1)}V${f1(gy - plinth)}Z` }),
    s('path', { class: 't32p-house-shade', d: `M${f1(x0 + hw * 0.64)} ${f1(gy - plinth)}V${f1(wt)}H${f1(x1)}V${f1(gy - plinth)}Z` }),
    s('path', { class: 't32p-house-win', d: `M${f1(wx0)} ${f1(wy0)}H${f1(wx1)}V${f1(wy1)}H${f1(wx0)}Z` }),
    s('path', { class: 't32p-house-lat', d: lat }),
    s('path', { class: 't32p-house-door', d: door }),
    s('path', { class: 't32p-house-post', d: posts + `M${f1(x0)} ${f1(wt)}H${f1(x1)}v${f1(hw * 0.03)}H${f1(x0)}Z` }),
    s('path', { class: 't32p-house-under', d: under }),
    s('path', { class: 't32p-house-roof', d: roof }),
    s('path', { class: 't32p-house-rooflit', d: lit }),
    s('path', { class: 't32p-house-ridge', d: ridge }),
    s('path', { class: 't32p-ink', d: stroke([[x0 - ov, ey], [x0 + hw * 0.2, ey + 0.5], [x1 + ov, ey]], 1.4, 0.05, 0.05, 0.5) }),
    pine(x1 + hw * 0.38, gy + 1, hw * 0.95, seed + 5, -1))
}

/** the steps' standing stone: a rough slab with a rounded crown, its lit left edge, a shaded side, moss at its foot */
function steleArt(seed: number): SVGElement {
  const { x, y, w, h } = G.stele
  const r = rng(seed)
  const b = y + h, t = Math.max(8, w * 0.06) // its foot on the ground, the side's thickness
  // a natural upright boulder (not a dressed slab): wider at its foot, a crown sloping off to the right with a notch
  const F: [number, number][] = [[0, 1], [-0.04, 0.78], [0.0, 0.5], [0.05, 0.24], [0.14, 0.08], [0.3, 0.0], [0.47, 0.03], [0.56, 0.0], [0.7, 0.07], [0.84, 0.15], [0.97, 0.34], [1.02, 0.62], [1.05, 0.86], [1.04, 1]]
  const face: Pt[] = F.map(([u, v]) => [x + u * w, y + v * h])
  const jit = face.map(([px, py], i): Pt => (i && i < face.length - 1 ? [px + (r() - 0.5) * 2.4, py + (r() - 0.5) * 2.4] : [px, py]))
  const side = `M${f1(x + w * 0.97)} ${f1(y + h * 0.34)}L${f1(x + w * 1.02 + t)} ${f1(y + h * 0.42)}L${f1(x + w * 1.05 + t)} ${f1(b - 3)}L${f1(x + w * 1.04)} ${f1(b)}Z`
  const cracks = stroke([[x + w * 0.7, y + h * 0.05], [x + w * 0.74, y + h * 0.16], [x + w * 0.69, y + h * 0.24]], 1.2, 0.1, 0.4, 0.2) + stroke([[x + w * 0.08, b - h * 0.25], [x + w * 0.14, b - h * 0.18]], 1, 0.1, 0.4, 0.2)
  return s('g', { class: 't32p-stele' },
    wash(blob(x + w * 0.75, b + 3, w * 0.75, Math.max(6, w * 0.07), seed + 2, 0.2), 0.42),
    s('path', { class: 't32p-shade', d: side }),
    s('path', { class: 't32p-stele-face', d: `M${pts(jit)}Z` }),
    s('path', { class: 't32p-stele-lit', d: `M${pts(jit.slice(0, 7))}L${f1(x + w * 0.2)} ${f1(y + h * 0.18)}L${f1(x + w * 0.1)} ${f1(b)}Z` }),
    s('path', { class: 't32p-stele-foot', d: `M${f1(x - w * 0.04)} ${f1(y + h * 0.78)}Q${f1(x + w * 0.5)} ${f1(y + h * 0.72)} ${f1(x + w * 1.05)} ${f1(y + h * 0.86)}L${f1(x + w * 1.04)} ${f1(b)}L${f1(x)} ${f1(b)}Z` }),
    s('path', { class: 't32p-strata', d: [0.2, 0.47, 0.7, 0.9].map((v, i) => stroke([[x + w * (0.04 + r() * 0.1), y + h * v], [x + w * 0.5, y + h * (v + (r() - 0.5) * 0.04)], [x + w * (0.86 + r() * 0.1), y + h * (v + 0.02 + (r() - 0.5) * 0.03)]], 1.6 + i * 0.3, 0.3, 0.4, 0.1)).join('') }),
    s('path', { class: 't32p-grain', d: speckle(r, x + 4, y + 10, w - 8, h - 14, 70) }),
    s('path', { class: 't32p-ink', d: stroke(jit.slice(8), 1.8, 0.05, 0.1, 0.4) + cracks, filter: 'url(#ink-rough)' }),
    s('path', { class: 't32p-rim', d: stroke(jit.slice(1, 8), 1.3, 0.2, 0.3, 0.15) }),
    s('path', { class: 't32p-moss', d: blob(x + w * 0.3, b - 3, w * 0.32, 5, seed + 3, 0.35) + blob(x + w * 0.82, b - 2, w * 0.2, 4, seed + 4, 0.35) + blob(x + w * 0.3, y + h * 0.03, w * 0.16, 4, seed + 5, 0.3) + blob(x + w * 0.1, y + h * 0.16, w * 0.06, 6, seed + 8, 0.3) }),
    grass(x - 4, b + 2, 26, seed + 6), grass(x + w + t + 2, b + 1, 20, seed + 7))
}

/** the night round the lantern: moon behind a pine, far hills, your house on a rise, mist; one ground of moss all the way to
 * the frame's foot (darker near), a raked gravel bed round a natural footing stone, the steps' stone, near grass */
function art(g: PathGeo): SVGElement[] {
  const { w, h, top, seed } = g
  const row = G.row, hz = G.hz
  const [fx, fy] = G.foot
  const u = G.unit * G.S
  const r = rng(seed + 7)
  // the ground: a gently rolling far edge, one continuous floor to below the frame
  const edge: Pt[] = []
  for (let i = 0; i <= 24; i++) edge.push([-20 + ((w + 40) * i) / 24, hz + Math.sin(i * 0.9 + seed) * 3 + (r() - 0.5) * 2])
  const ground = `M${pts(edge)}L${f1(w + 20)} ${f1(h + 30)}L-20 ${f1(h + 30)}Z`
  // moss: short dry blades over the whole floor, bigger and denser toward the viewer
  let tufts = '', hi = ''
  const nT = row ? 520 : 260
  for (let i = 0; i < nT; i++) {
    const d = r() ** 0.7, ty = hz + 6 + (h - hz) * d, tx = r() * w
    const k = 0.5 + d * 1.6
    const st = stroke([[tx, ty], [tx + (1.5 + r() * 3) * k, ty - (1.5 + r() * 2.5) * k]], (0.8 + r() * 0.8) * k, 0.2, 0.5, 0.2)
    if (r() < 0.28) hi += st
    else tufts += st
  }
  // the gravel bed round the footing, raked in rings
  const gw = u * (row ? 1.15 : 1.0), gh = gw * (row ? 0.2 : 0.24)
  let rake = ''
  for (let i = 1; i <= 5; i++) {
    const k = 0.38 + i * 0.13
    const ring: Pt[] = []
    for (let j = 0; j <= 40; j++) {
      const a = (j / 40) * Math.PI * 2
      ring.push([fx + Math.cos(a) * gw * k + (r() - 0.5) * 1.5, fy + gh * 0.15 + Math.sin(a) * gh * k + (r() - 0.5) * 1.2])
    }
    rake += stroke(ring, 1 + i * 0.12, 0.02, 0.02, 0.5)
  }
  let peb = ''
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2, d = 1.02 + r() * 0.25
    peb += blob(fx + Math.cos(a) * d * gw, fy + gh * 0.15 + Math.sin(a) * d * gh, 3 + r() * 5, 2 + r() * 3, seed + 30 + i, 0.2, 10)
  }
  // the footing: a natural flat stone, its top a little lit, its thickness in shade, its shadow away from the moon
  const fw = PW[0] * u * 0.66, ft = Math.max(6, fw * 0.12)
  const ftop = blob(fx, fy + 1, fw, fw * 0.17, seed + 41, 0.07, 22)
  const fside = blob(fx + 2, fy + 1 + ft * 0.75, fw * 0.99, fw * 0.17 + ft * 0.4, seed + 41, 0.07, 22)
  const lampY = fy - (PH[0] + PH[1] + PH[2] * 0.6) * u
  const lantH = (PH[0] + PH[1] + PH[2] + PH[3]) * u * 0.97
  // the lantern's shadow on the gravel, growing with each tier (away from the moon: toward the right and the viewer)
  const shadows = [0.2, 0.55, 0.8, 1].map((k, i) => s('path', { class: `t32p-lshadow t32p-ls${i}`, d: `M${f1(fx - u * 0.18)} ${f1(fy + 2)}Q${f1(fx + lantH * k * 0.5)} ${f1(fy + 2 + lantH * k * 0.1)} ${f1(fx + lantH * k * 0.95)} ${f1(fy + lantH * k * 0.16)}Q${f1(fx + lantH * k * 0.5)} ${f1(fy + lantH * k * 0.22)} ${f1(fx + u * 0.16)} ${f1(fy + 8)}Z`, filter: 'url(#ink-wash)' }))
  const sr = clamp(Math.min(w, h) * (row ? 0.05 : 0.045), 14, 34)
  const [hx, hy, hw] = G.house
  // the near dark: a rough band of shade along the foot of the frame and a dark stone cut by its corner
  let near = `M-20 ${f1(h - (row ? 40 : 26))}`
  for (let i = 0; i <= 12; i++) near += `L${f1((w * i) / 12)} ${f1(h - (row ? 30 : 18) - Math.sin(i * 1.7 + seed) * 8 - r() * 6)}`
  near += `L${f1(w + 20)} ${f1(h + 30)}L-20 ${f1(h + 30)}Z`
  return [
    s('defs', null,
      s('radialGradient', { id: 't32p-skyg', cx: 0.5, cy: 0.1, r: 0.62 },
        s('stop', { offset: 0, class: 't32p-sky0' }), s('stop', { offset: 0.6, class: 't32p-sky1' }), s('stop', { offset: 1, class: 't32p-sky2' })),
      s('linearGradient', { id: 't32p-groundg', x1: 0, y1: f1(hz), x2: 0, y2: f1(h), gradientUnits: 'userSpaceOnUse' },
        s('stop', { offset: 0, class: 't32p-g0' }), s('stop', { offset: 0.35, class: 't32p-g1' }), s('stop', { offset: 1, class: 't32p-g2' }))),
    s('ellipse', { class: 't32p-sky', cx: f1(w / 2), cy: f1(top), rx: f1(w * 0.8), ry: f1(hz - top + 80), fill: 'url(#t32p-skyg)' }),
    moon(row ? w * 0.21 : w * 0.84, top + (row ? (hz - top) * 0.3 : (hz - top) * 0.32), sr, seed + 1, true),
    mist(w * 0.55, top + (hz - top) * 0.45, w * 0.6, (hz - top) * 0.16),
    hills(-w * 0.05, w * 1.05, hz + 4, (hz - top) * (row ? 0.6 : 0.5), seed + 4, 0.95, 6),
    mist(w * 0.5, hz - (hz - top) * 0.22, w * 0.75, (hz - top) * 0.2),
    hills(row ? w * 0.48 : -w * 0.1, row ? w * 1.1 : w * 0.6, hz + 6, (hz - top) * 0.32, seed + 5, 0.6, 2),
    mist(w * 0.5, hz - 2, w * 0.9, (hz - top) * 0.1),
    s('path', { class: 't32p-ground', d: ground, fill: 'url(#t32p-groundg)' }),
    mist(w * 0.5, hz + (h - hz) * 0.06, w * 0.8, (h - hz) * 0.07),
    // the rise your house stands on, a soft darker swell on the far ground
    wash(blob(hx, hy + 3, hw * (row ? 1.9 : 1.6), hw * 0.14, seed + 9, 0.2), 0.3),
    houseArt(hx, hy, hw, seed + 50),
    ...(row ? [pine(w * 0.04, hz + (h - hz) * 0.3, (h - top) * 0.62, seed + 60, 1)] : []),
    s('path', { class: 't32p-tuft', d: tufts }),
    s('path', { class: 't32p-bed-hi', d: hi }),
    steleArt(seed + 70),
    s('path', { class: 't32p-gravel', d: blob(fx, fy + gh * 0.15, gw * 1.12, gh * 1.12, seed + 3, 0.12, 30), filter: 'url(#ink-wash)' }),
    s('path', { class: 't32p-rake', d: rake }),
    s('path', { class: 't32p-peb', d: peb }),
    ...shadows,
    // the lantern's warmth once it burns: a pool on the gravel and a glow round the fire box (behind the parts)
    s('ellipse', { class: 't32p-glow', cx: f1(fx), cy: f1(fy + 4), rx: f1(gw * 1.3), ry: f1(gh * 1.6), fill: 'url(#p2-lamp)' }),
    s('ellipse', { class: 't32p-glow t32p-glow-hi', cx: f1(fx), cy: f1(lampY), rx: f1(u * 1.2), ry: f1(u * 0.9), fill: 'url(#p2-lamp)' }),
    wash(blob(fx + fw * 0.45, fy + ft + 3, fw * 1.4, fw * 0.12, seed + 6, 0.2), 0.36),
    s('path', { class: 't32p-shade', d: fside }),
    s('path', { class: 't32p-footing', d: ftop }),
    s('path', { class: 't32p-footing-lit', d: blob(fx - fw * 0.35, fy - fw * 0.03, fw * 0.5, fw * 0.08, seed + 42, 0.15, 16) }),
    s('path', { class: 't32p-moss', d: blob(fx + fw * 0.7, fy + ft * 0.6, fw * 0.18, ft * 0.45, seed + 43, 0.35) + blob(fx - fw * 0.8, fy + ft * 0.4, fw * 0.12, ft * 0.35, seed + 44, 0.35) }),
    s('path', { class: 't32p-ink', d: stroke(curve([fx - fw, fy + 2], [fx, fy + fw * 0.2 + ft], [fx + fw, fy + 2], 14), 2, 0.1, 0.1, 0.3), filter: 'url(#ink-rough)' }),
    s('path', { class: 't32p-near', d: near, filter: 'url(#ink-wash)' }),
    ...(row ? [wash(blob(w * 0.985, h - 6, w * 0.06, 34, seed + 80, 0.3), 0.75, 't32p-nearrock')] : []),
    grass(w * 0.03, h - 4, row ? 70 : 44, seed + 8),
    grass(w * 0.11, h + 2, row ? 50 : 30, seed + 12),
    grass(w * 0.9, h - 2, row ? 80 : 46, seed + 9),
    grass(w * 0.8, h + 2, row ? 54 : 30, seed + 13),
  ]
}

/** each part set in place stacks above the ones below it; its step is carved on the standing stone; the shadow grows */
function onPlace(k: number) {
  const el = document.querySelector(`.t32p .t32p-part${k}`)?.closest<HTMLElement>('.p2s-stone')
  if (!el) return
  el.style.zIndex = String(2 + k)
  carve(el, k)
  el.closest('.t32p')?.setAttribute('data-tier', String(k + 1))
}

/**
 * The scene, wrapped round stepPath: no numbers on the parts (the order is read from the lantern itself, base to roof, each
 * part's tag naming its tier); a wrong part slides back and the right tier shows as a faint ghost where it goes, the prompt
 * saying why (after one miss, the dot sits on the right part); a count of the tiers by the lantern; the prompt per tier.
 * Done: the window far off lights, and two seconds later the insight comes under the lantern. The card stays folded.
 */
export function firstLamp(): SceneDef {
  return {
    label: K.stepsLabel,
    mount(ctx) {
      ctx.art.classList.add('t32p')
      ctx.art.append(h('p', { class: 'visually-hidden' }, K.stepsArt))
      const n = K.steps.steps.length
      let placed = 0, wrongs = 0
      let dot: Mark | null = null
      const stoneOf = (i: number) => [...ctx.art.querySelectorAll<HTMLElement>('.p2s-stone')].find((el) => el.querySelector('.p2s-label')?.textContent === K.steps.steps[i].label)
      const clearGhost = () => ctx.art.querySelectorAll('.p2s-slot.ghost').forEach((el) => (el.classList.remove('ghost'), el.replaceChildren()))
      const def = stepPath(K.steps as StepPath, {
        label: K.stepsLabel, prompt: K.stepPrompts[0], slots, pile, piece, art,
        onPlace(k) {
          onPlace(k)
          placed = k + 1
          wrongs = 0
          clearGhost()
          dot?.done()
          dot = null
          count.set(placed)
          if (placed < n) return step(placed)
          // the roof is on: the fire box and the far window light (CSS); the insight waits for that moment to be seen
          const id = setTimeout(() => ctx.insight(K.stepsInsight as Fact, K.stepsDetail as Fact), ctx.reduced ? 300 : 2000)
          ctx.onCleanup(() => clearTimeout(id))
        },
      })
      const out = def.mount(ctx)
      // the guide after the path: its marks lay out after the path has placed the lantern's footing
      const g = guide(ctx)
      const step = g.steps(K.stepPrompts)
      const count = g.count(K.tierCount, n, () => [G.stele.x + G.stele.w / 2, G.stele.y + (G.row ? 24 : 18)]) // carved across the steps' stone's crown
      // each part's tag names its tier ("Đế · …"): the order can be read from the lantern
      K.steps.steps.forEach((_, i) => stoneOf(i)?.querySelector('.p2s-label')?.setAttribute('data-tier', K.tiers[i]))
      // a wrong part (stepPath shakes it back and writes its own line, hidden here): say which tier comes first, show its ghost
      const note = ctx.art.querySelector('.p2s-note')
      if (note) {
        const mo = new MutationObserver(() => {
          if (!note.classList.contains('wrong') || !note.textContent) return
          note.textContent = ''
          g.wrong(fill(K.stepWrong, { tier: K.tiers[placed].toLowerCase() }))
          const right = stoneOf(placed)
          const slot = ctx.art.querySelectorAll('.p2s-slot')[placed]
          const art = right?.querySelector('.p2s-art')
          if (slot && art && !slot.classList.contains('ghost')) slot.classList.add('ghost'), slot.replaceChildren(art.cloneNode(true))
          if (++wrongs === 1 && right && !dot) dot = g.dot(right, { dir: [0, -1] })
        })
        mo.observe(note, { attributes: true, attributeFilter: ['class'], childList: true })
        ctx.onCleanup(() => mo.disconnect())
      }
      return out
    },
  }
}
