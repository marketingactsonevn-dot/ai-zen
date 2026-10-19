import raw from '../../content/tram-32.json'
import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { guide, type Mark } from '../../ui/part2/guide'
import type { SceneDef } from '../types'
import type { StepPath } from '../../ui/part2/types'
import { stepPath, type PathGeo, type SlotGeo } from '../../ui/part2/steps'
import { blob, clamp, curve, rng, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist, moon, wash } from '../../ui/part2/paint'

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

/** where the stack stands: its centre x and the ground line under the base; the box width; the parts' scale (wide: larger) */
let foot: Pt = [0, 0]
let unit = 100
let S = 1

/** the parts' places, bottom (base) to top (roof): each sits on the one below */
function slots(g: SlotGeo): Pt[] {
  const [w] = g.size
  unit = w
  S = g.row ? 1.22 : 1
  const x = g.w * 0.5
  const ground = g.top + (g.h - g.top) * (g.row ? 0.72 : 0.5)
  foot = [x, ground]
  let y = ground
  return Array.from({ length: g.n }, (_, i) => {
    const hh = PH[i] * S * w
    const c: Pt = [x, y - hh / 2]
    y -= hh * 0.97
    return c
  })
}

/** where the loose parts lie in the moss: two each side of the footing (wide), two pairs in front of it (tall) */
function pile(g: SlotGeo): Pt[] {
  const [w] = g.size
  const [fx, fy] = foot
  if (g.row) return [[fx - w * 1.95, fy - w * 0.24], [fx + w * 1.72, fy - w * 0.26], [fx - w * 1.4, fy + w * 0.52], [fx + w * 1.4, fy + w * 0.48]]
  const d = g.h - fy
  return [[g.w * 0.27, fy + d * 0.24], [g.w * 0.74, fy + d * 0.22], [g.w * 0.25, fy + d * 0.62], [g.w * 0.75, fy + d * 0.62]]
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
  const pw = PW[i] * S * w, ph = PH[i] * S * w
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

/** the night round the lantern: moon, far hills and your house in the mist, the moss bed and its footing, near grass */
function art(g: PathGeo): SVGElement[] {
  const { w, h, row, top, seed } = g
  const [fx, fy] = foot
  const hz = row ? top + (h - top) * 0.36 : top + (h - top) * 0.2 // where the far ground meets the mist
  const r = rng(seed + 7)
  const hx = row ? w * 0.84 : w * 0.8, hy = hz + (row ? 14 : 8) // the house, far off on a rise
  const hk = row ? 1 : 0.75
  const house = s('g', { class: 't32p-house' },
    s('circle', { class: 't32p-house-glow', cx: f1(hx - 8 * hk), cy: f1(hy - 10 * hk), r: f1(70 * hk), fill: 'url(#p2-lamp)' }),
    s('path', { class: 't32p-house-wall', d: `M${f1(hx - 22 * hk)} ${f1(hy)}V${f1(hy - 18 * hk)}H${f1(hx + 22 * hk)}V${f1(hy)}Z` }),
    s('rect', { class: 't32p-house-win', x: f1(hx - 14 * hk), y: f1(hy - 14 * hk), width: f1(11 * hk), height: f1(8 * hk) }),
    s('path', { class: 't32p-house-roof', d: `M${f1(hx - 34 * hk)} ${f1(hy - 16 * hk)}Q${f1(hx - 14 * hk)} ${f1(hy - 20 * hk)} ${f1(hx - 2 * hk)} ${f1(hy - 32 * hk)}Q${f1(hx + 12 * hk)} ${f1(hy - 20 * hk)} ${f1(hx + 34 * hk)} ${f1(hy - 16 * hk)}Q${f1(hx)} ${f1(hy - 22 * hk)} ${f1(hx - 34 * hk)} ${f1(hy - 16 * hk)}Z`, filter: 'url(#ink-wash)' }),
    s('path', { class: 't32p-house-spill', d: blob(hx - 8 * hk, hy + 3 * hk, 30 * hk, 3 * hk, seed + 20, 0.2) }))
  // the moss bed: a broad soft mound round the footing, darker toward the viewer, raked sand beyond it
  const bw = w * (row ? 0.34 : 0.5), bh = (h - hz) * (row ? 0.22 : 0.3)
  const bed = blob(fx, fy + bh * 0.25, bw, bh, seed + 3, 0.18, 30)
  // short dry strokes of moss over the bed, denser toward the footing
  let tufts = '', hi = ''
  for (let i = 0; i < (row ? 320 : 200); i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r())
    const tx = fx + Math.cos(a) * d * bw, ty = fy + bh * 0.25 + Math.sin(a) * d * bh
    const st = stroke([[tx, ty], [tx + 2 + r() * 4, ty - 2 - r() * 3]], 1.2 + r(), 0.2, 0.5, 0.2)
    if (r() < 0.3) hi += st
    else tufts += st
  }
  let rake = ''
  for (let y = hz + 6; y < h; y += 6 + (y - hz) * 0.045) {
    for (let x = -10; x < w; ) {
      const len = 40 + r() * 140
      rake += stroke([[x, y], [x + len, y + (r() - 0.5) * 1.2]], 0.8 + (y - hz) / h * 1.2, 0.2, 0.2, 0.1)
      x += len + 10 + r() * 40
    }
  }
  // a few pebbles in the moss
  let peb = ''
  for (let i = 0; i < 12; i++) {
    const a = r() * Math.PI * 2, d = 0.55 + r() * 0.4
    peb += blob(fx + Math.cos(a) * d * bw, fy + bh * 0.25 + Math.sin(a) * d * bh, 3 + r() * 4, 2 + r() * 2, seed + 30 + i, 0.2, 10)
  }
  const sr = clamp(Math.min(w, h) * 0.055, 14, 34)
  const fw = PW[0] * S * unit * 0.72
  const lampY = fy - (PH[0] + PH[1] + PH[2] * 0.6) * S * unit
  return [
    // the night sky: a soft wash darkest at the top, fading out at every edge (no panel)
    s('defs', null, s('radialGradient', { id: 't32p-skyg', cx: 0.5, cy: 0.1, r: 0.62 },
      s('stop', { offset: 0, class: 't32p-sky0' }), s('stop', { offset: 0.6, class: 't32p-sky1' }), s('stop', { offset: 1, class: 't32p-sky2' }))),
    s('ellipse', { class: 't32p-sky', cx: f1(w / 2), cy: f1(top), rx: f1(w * 0.75), ry: f1(hz - top + 60), fill: 'url(#t32p-skyg)' }),
    moon(row ? w * 0.16 : w * 0.2, Math.max(sr * 1.6, top + (hz - top) * 0.3), sr, seed + 1, true),
    mist(w * 0.5, hz - (hz - top) * 0.2, w * 0.7, (hz - top) * 0.5),
    hills(-w * 0.05, w * 1.05, hz + 4, (hz - top) * 0.62, seed + 4, 0.9, 6),
    hills(w * 0.45, w * 1.1, hz + 6, (hz - top) * 0.34, seed + 5, 0.65, 2),
    house,
    mist(w * 0.5, hz + 4, w * 0.8, (h - hz) * 0.08),
    s('path', { class: 't32p-rake', d: rake }),
    s('path', { class: 't32p-bed', d: bed, filter: 'url(#ink-wash)' }),
    s('path', { class: 't32p-tuft', d: tufts }),
    s('path', { class: 't32p-bed-hi', d: hi }),
    s('path', { class: 't32p-peb', d: peb }),
    // the lantern's warmth once it burns: a pool on the moss and a glow round the fire box (behind the parts)
    s('ellipse', { class: 't32p-glow', cx: f1(fx), cy: f1(fy + 4), rx: f1(bw * 0.9), ry: f1(bh * 0.7), fill: 'url(#p2-lamp)' }),
    s('ellipse', { class: 't32p-glow t32p-glow-hi', cx: f1(fx), cy: f1(lampY), rx: f1(unit * S * 1.2), ry: f1(unit * S * 0.9), fill: 'url(#p2-lamp)' }),
    // the footing stone the lantern stands on, its shadow thrown away from the moon (to the right)
    wash(blob(fx + fw * 0.4, fy + 5, fw * 1.6, fw * 0.12, seed + 6, 0.2), 0.3),
    s('ellipse', { class: 't32p-footing', cx: f1(fx), cy: f1(fy + 2), rx: f1(fw * 1.1), ry: f1(fw * 0.16) }),
    s('path', { class: 't32p-ink', d: stroke(curve([fx - fw * 1.1, fy + 2], [fx, fy + fw * 0.36], [fx + fw * 1.1, fy + 2], 12), 2, 0.1, 0.1, 0.3), filter: 'url(#ink-rough)' }),
    // near grass at the frame's lower corners
    grass(w * 0.05, h - 6, 60, seed + 8),
    grass(w * 0.12, h - 2, 40, seed + 12),
    grass(w * 0.9, h - 4, 70, seed + 9),
    grass(w * 0.82, h, 44, seed + 13),
  ]
}

/** each part set in place stacks above the ones below it (the roof's eaves over the fire box, and so on) */
function onPlace(k: number) {
  const el = document.querySelector(`.t32p .t32p-part${k}`)?.closest<HTMLElement>('.p2s-stone')
  if (!el) return
  el.style.zIndex = String(2 + k)
  // its tag hangs left of the lantern: past the part's edge when the part is wider than its box, a string back to it
  const ov = Math.max(0, ((PW[k] * S - 1) / 2) * unit)
  el.style.setProperty('--ov', `${f1(ov)}px`)
  el.style.setProperty('--str', `${f1(16 + ov + (0.5 - (PW[k] * S) / 2) * unit)}px`)
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
      const count = g.count(K.tierCount, n, () => [foot[0], foot[1] + unit * S * 0.3]) // carved on the footing, under the lantern
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
