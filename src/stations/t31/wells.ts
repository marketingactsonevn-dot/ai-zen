import raw from '../../content/tram-31.json'
import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { createLoop } from '../../core/loop'
import { clamp, onSize } from '../../ui/part2/ink'
import { grass, hills, mist, moon, paperLantern, wash } from '../../ui/part2/paint'
import { guide, type Mark } from '../../ui/part2/guide'
import type { SceneCtx } from '../types'
import { bamboo, live, night, rng, stroke, blob, type Pt } from './kit'
import './wells.css'

const K = raw.scenes.wells
const f1 = (n: number) => (Math.round(n * 10) / 10).toString()

// a well in viewBox 0 92 220 108: rim centre (CX, RY), radii RX × ER, the drum's side down to BOT (its front foot at BOT + ER)
const CX = 110, RY = 116, RX = 64, ER = 15, BOT = 174
// the dressed stone set into the drum's front, the well's name cut into it: its top and bottom courses (svg units)
const TAB_T = RY + 11, TAB_B = BOT - 5, TAB_HW = 34, TAB_A = Math.acos(TAB_HW / RX)
// where the things brought up stand on the rim: its left end, the back, its right end (svg units)
const SLOTS: Pt[] = [1.06, 1.5, 1.94].map((a) => [CX + Math.cos(a * Math.PI) * 60, RY + Math.sin(a * Math.PI) * 13.6] as Pt)

/** Points along the front half of the drum at height y (right → left as given). */
const front = (y: number, rx = RX, ry = ER, n = 18, a0 = 0, a1 = Math.PI): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n
    return [CX + Math.cos(a) * rx, y + Math.sin(a) * ry] as Pt
  })

/** A small clay jar standing on (x, y), k ≈ its height / 13: glazed body, neck, lip, a paper label with a red seal. */
export function jar(x: number, y: number, k: number, seed: number): SVGGElement {
  const r = rng(seed)
  const w = 5 + r() * 1.2
  const body = `M${f1(x - w * k)} ${f1(y)}C${f1(x - (w + 2.6) * k)} ${f1(y - 6 * k)} ${f1(x - w * k)} ${f1(y - 10 * k)} ${f1(x - 2.3 * k)} ${f1(y - 10.6 * k)}L${f1(x - 2.3 * k)} ${f1(y - 12.4 * k)}L${f1(x + 2.3 * k)} ${f1(y - 12.4 * k)}L${f1(x + 2.3 * k)} ${f1(y - 10.6 * k)}C${f1(x + w * k)} ${f1(y - 10 * k)} ${f1(x + (w + 2.6) * k)} ${f1(y - 6 * k)} ${f1(x + w * k)} ${f1(y)}Z`
  return s('g', { class: 't31w-jar' },
    s('ellipse', { class: 't31w-item-sh', cx: f1(x + 2 * k), cy: f1(y + 0.3), rx: f1((w + 1.5) * k), ry: f1(1.3 * k) }),
    s('path', { class: 'g11-clay', d: body, filter: 'url(#ink-rough)' }),
    s('path', { class: 't31w-jar-sh', d: body }),
    s('path', { class: 'g11-wash t31w-jar-ink', d: stroke([[x - 3 * k, y - 12.6 * k], [x + 3.2 * k, y - 12.5 * k]], 1.6 * k, 0.1, 0.1, 0.4) + stroke([[x + (w + 1.6) * k, y - 6 * k], [x + w * k, y - 1 * k], [x - w * k, y]], 1.1 * k, 0.1, 0.3, 0.3) }),
    s('path', { class: 'g11-label', d: `M${f1(x - 2.8 * k)} ${f1(y - 8.2 * k)}l${f1(5.4 * k)} -0.3l0.2 ${f1(4.4 * k)}l${f1(-5.4 * k)} 0.3Z` }),
    s('path', { class: 'g11-seal', d: stroke([[x - 1.2 * k, y - 6.6 * k], [x + 1.1 * k, y - 6.7 * k]], 1.3 * k, 0.1, 0.1, 0.5) }),
    s('path', { class: 'g11-moonlit', d: stroke([[x - (w + 0.8) * k, y - 4 * k], [x - (w - 0.4) * k, y - 8 * k], [x - 2.6 * k, y - 9.8 * k]], 1.1 * k, 0.2, 0.3, 0.2) }))
}

/**
 * A mossy well of uneven field stones, seen just above its mouth (viewBox 0 92 220 108): stones of every size in
 * wandering courses, darker and paler ones, moss at the foot, the moon on its left flank and far rim; black water with the
 * moon in it (code glinting in the GitHub well, labelled jars in the Hugging Face well); a dressed stone set into the
 * front for the name; a group on the far rim for the things brought up; a ring on the mouth that glows as a drop target.
 */
export function wellArt(kind: string, seed: number): SVGSVGElement {
  const r = rng(seed)
  // wandering courses: each a little higher or lower, with stones of uneven length between upright joints
  const levels = [RY + 12 + r() * 3, RY + 26 + r() * 4, RY + 41 + r() * 3]
  let courses = '', joints = '', dark = '', pale = ''
  const tops = [RY + 3, ...levels]
  for (let k = 0; k < tops.length; k++) {
    const y0 = tops[k], y1 = levels[k] ?? BOT
    const tilt = (r() - 0.5) * 2.4
    if (k < levels.length) {
      const arc = front(y1).map(([x, y]) => [x, y + ((x - CX) / RX) * tilt] as Pt)
      const cut = 4 + Math.floor(r() * 10)
      courses += stroke(arc.slice(0, cut), 1.4, 0.1, 0.2, 0.3) + stroke(arc.slice(cut + 1), 1.5, 0.1, 0.15, 0.3)
    }
    for (let a = 0.1 + r() * 0.3; a < Math.PI - 0.1; a += 0.3 + r() * 0.36) {
      const x = CX + Math.cos(a) * RX, sy = Math.sin(a) * ER
      joints += stroke([[x, y0 + sy + 1.2], [x + (r() - 0.5) * 2.4, y1 + sy - 1]], 1.2, 0.2, 0.2, 0.4)
      const am = a + 0.15, xm = CX + Math.cos(am) * RX * 0.97, ym = (y0 + y1) / 2 + Math.sin(am) * ER
      const t = r()
      if (t < 0.3) dark += blob(xm, ym, 5 + Math.sin(am) * 5, (y1 - y0) * 0.36, seed + k * 13 + Math.round(a * 10), 0.24, 10)
      else if (t > 0.72) pale += blob(xm, ym - 1, 4 + Math.sin(am) * 4, (y1 - y0) * 0.28, seed + k * 17 + Math.round(a * 10), 0.24, 10)
    }
  }
  // the rim: a ring of cut stones of uneven length, seen from above
  let rim = ''
  for (let a = r() * 0.4; a < Math.PI * 2; a += 0.38 + r() * 0.3) {
    rim += stroke([[CX + Math.cos(a) * 53, RY - 1 + Math.sin(a) * 11], [CX + Math.cos(a) * 67, RY + Math.sin(a) * 16.5]], 1.1, 0.2, 0.2, 0.4)
  }
  const body = `M${CX - RX} ${RY}L${CX - RX} ${BOT}A${RX} ${ER} 0 0 0 ${CX + RX} ${BOT}L${CX + RX} ${RY}Z`
  const water = s('g', { class: 't31w-water' })
  if (kind === 'github') {
    // lines of code glinting on the water like fish scales
    let code = ''
    ;[[-5, 0], [-1.6, 7], [1.8, 7], [5.2, 14], [8.4, 0]].forEach(([dy, ind]) => {
      const y = RY + 1 + dy
      const hw = 47 * Math.sqrt(Math.max(0, 1 - (dy / 9.5) ** 2)) - 3
      for (let x = CX - hw + ind; x < CX + hw - 4; ) {
        const len = 2.5 + r() * 7
        if (x + len > CX + hw) break
        code += stroke([[x, y], [x + len, y - 0.2]], 1.3, 0.25, 0.25, 0.3)
        x += len + 2 + r() * 4
      }
    })
    let scales = ''
    for (let i = 0; i < 6; i++) {
      const x = CX - 30 + r() * 60, y = RY - 2 + r() * 7
      scales += stroke(curveArc(x, y, 3 + r() * 2), 0.9, 0.3, 0.3, 0.2)
    }
    water.append(s('path', { class: 't31w-code', d: code }), s('path', { class: 't31w-scale', d: scales }))
  } else {
    for (const [x, y, k, sd] of [[CX - 26, RY + 4, 0.95, 1], [CX + 1, RY - 1, 0.8, 2], [CX + 27, RY + 5, 1.05, 3]]) {
      water.append(
        s('ellipse', { class: 't31w-ring', cx: x, cy: y + 0.4, rx: 8 * k, ry: 1.8 * k }),
        jar(x, y + 0.5, k, seed + sd))
    }
  }
  // the dressed stone in the front: follows the drum's curve, lit along its top and left edges, a dark seam round it
  const tt = front(TAB_T, RX - 0.5, ER, 10, TAB_A, Math.PI - TAB_A), tb = front(TAB_B, RX - 0.5, ER, 10, TAB_A, Math.PI - TAB_A)
  const tab = `M${tt.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}L${[...tb].reverse().map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}Z`
  return s('svg', { class: 't31w-art', viewBox: '0 92 220 108', 'aria-hidden': 'true' },
    // the drum: stone face, shaded flank, uneven stones, mortar courses and joints, moss
    s('path', { class: 't31w-body', d: body, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
    s('path', { d: body, fill: 'url(#p2-shade)' }),
    s('path', { class: 'g11-wash t31w-dark', d: dark, filter: 'url(#ink-wash)' }),
    s('path', { class: 't31w-pale', d: pale, filter: 'url(#ink-wash)' }),
    s('path', { class: 'g11-wash t31w-course', d: courses + joints }),
    s('path', { class: 't31w-tab-seam', d: tab, filter: 'url(#ink-rough)' }),
    s('path', { class: 't31w-tab', d: tab, filter: 'url(#ink-rough)' }),
    s('path', { d: tab, fill: 'url(#p2-shade)' }),
    s('path', { class: 't31w-tab-grain', d: Array.from({ length: 26 }, () => { const x = CX + (r() - 0.5) * TAB_HW * 1.8, y = TAB_T + 4 + r() * (TAB_B - TAB_T - 2) + ER * Math.sqrt(Math.max(0, 1 - ((x - CX) / RX) ** 2)); return blob(x, y, 0.5 + r() * 1.1, 0.4 + r() * 0.6, seed + 40, 0.3, 6) }).join('') }),
    s('path', { class: 't31w-tab-lit', d: stroke([...tt].reverse().map(([x, y]) => [x, y + 0.7] as Pt), 1.2, 0.2, 0.2, 0.2) + stroke([tt[tt.length - 1], [tb[tb.length - 1][0], tb[tb.length - 1][1] - 1]], 1.1, 0.2, 0.2, 0.2) }),
    s('path', { class: 'g11-wash t31w-edge', d: stroke(front(BOT).reverse(), 2.2, 0.1, 0.1, 0.3) + stroke([[CX + RX, RY + 2], [CX + RX + 0.5, BOT]], 2.2, 0.1, 0.1, 0.4) + stroke([[CX - RX, RY + 2], [CX - RX - 0.4, BOT]], 1.2, 0.1, 0.1, 0.3), filter: 'url(#ink-rough)' }),
    s('path', { class: 'g11-moonlit t31w-lit', d: stroke([[CX - RX + 2.5, RY + 6], [CX - RX + 2, BOT - 4]], 2.4, 0.2, 0.3, 0.2) }),
    // the rim, the dark mouth, the water with the moon in it
    s('ellipse', { class: 't31w-rimstone', cx: CX, cy: RY, rx: 67, ry: 16.5, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
    s('path', { class: 'g11-wash t31w-rimjoint', d: rim }),
    s('ellipse', { class: 't31w-hole', cx: CX, cy: RY - 1, rx: 53, ry: 11 }),
    s('ellipse', { class: 't31w-pool', cx: CX, cy: RY + 1.4, rx: 50, ry: 9.2 }),
    s('ellipse', { class: 't31w-moonr', cx: CX - 18, cy: RY + 2, rx: 6, ry: 2.6 }),
    water,
    s('path', { class: 'g11-wash t31w-edge', d: stroke(front(RY, 67, 16.5).reverse(), 2.4, 0.06, 0.06, 0.3), filter: 'url(#ink-rough)' }),
    // the lanterns' warmth on the outer flank, the moon on the near rim (left) and the far rim
    s('ellipse', { class: 't31w-warm', cx: CX + 52, cy: (RY + BOT) / 2 + 4, rx: 30, ry: 40, fill: 'url(#p2-lamp)' }),
    s('path', { class: 'g11-moonlit', d: stroke(Array.from({ length: 10 }, (_, i) => { const a = Math.PI * (0.62 + i * 0.045); return [CX + Math.cos(a) * 66, RY + Math.sin(a) * 16] as Pt }), 1.8, 0.2, 0.3, 0.2) }),
    s('path', { class: 't31w-farrim', d: stroke(Array.from({ length: 17 }, (_, i) => { const a = Math.PI * (1.04 + i * 0.0575); return [CX + Math.cos(a) * 66.4, RY - 0.4 + Math.sin(a) * 16.2] as Pt }), 2.4, 0.2, 0.2, 0.3) }),
    // the drop target: the mouth's ring glows while the bucket is carried
    s('ellipse', { class: 't31w-aim', cx: CX, cy: RY, rx: 60, ry: 13.8 }),
    s('path', { class: 'g11-mossy', d: blob(CX - 48, RY + 13, 17, 5, seed + 6, 0.3, 12) + blob(CX + 44, RY + 15, 11, 3.6, seed + 7, 0.3, 12) + blob(CX - 34, BOT + 12, 26, 5, seed + 8, 0.3, 12) + blob(CX + 50, BOT + 8, 14, 6, seed + 9, 0.3, 12) + blob(CX - 60, BOT + 2, 7, 9, seed + 14, 0.3, 10), filter: 'url(#ink-wash)' }),
    s('path', { class: 'g11-mossy t31w-drip', d: stroke([[CX - 56, RY + 13], [CX - 55, RY + 24]], 3, 0.1, 0.6, 0.2) + stroke([[CX - 40, RY + 16], [CX - 40, RY + 22]], 2.4, 0.1, 0.6, 0.2) + stroke([[CX + 46, RY + 16], [CX + 47, RY + 23]], 2.6, 0.1, 0.6, 0.2) }),
    grass(CX - 70, BOT + 13, 24, seed + 10),
    grass(CX + 66, BOT + 12, 18, seed + 11),
    s('g', { class: 't31w-items' }))
}

/** A small arc (a fish scale) opening downward at (x, y). */
function curveArc(x: number, y: number, w: number): Pt[] {
  return Array.from({ length: 7 }, (_, i) => { const a = Math.PI * (1 + i / 6); return [x + Math.cos(a) * w, y + Math.sin(a) * w * 0.45] as Pt })
}

/** A rolled scroll of code standing on the rim (x, y = its foot), k ≈ height / 14, with a glyph on its wrapper. */
function scrollItem(x: number, y: number, k: number, glyph: number): SVGGElement {
  const w = 5.2 * k, hh = 13 * k
  const g = [`M${f1(x - 1.6 * k)} ${f1(y - hh * 0.62)}l${f1(1.4 * k)} ${f1(-1.6 * k)}M${f1(x - 1.6 * k)} ${f1(y - hh * 0.62)}l${f1(1.4 * k)} ${f1(1.6 * k)}M${f1(x + 1.6 * k)} ${f1(y - hh * 0.62)}l${f1(-1.4 * k)} ${f1(-1.6 * k)}M${f1(x + 1.6 * k)} ${f1(y - hh * 0.62)}l${f1(-1.4 * k)} ${f1(1.6 * k)}`, // < >
    `M${f1(x - 1.8 * k)} ${f1(y - hh * 0.7)}l${f1(1.6 * k)} ${f1(1.2 * k)}l${f1(-1.6 * k)} ${f1(1.2 * k)}M${f1(x + 0.2 * k)} ${f1(y - hh * 0.45)}h${f1(1.8 * k)}`, // >_
    `M${f1(x - 0.8 * k)} ${f1(y - hh * 0.8)}q${f1(-1.4 * k)} 0 ${f1(-1.2 * k)} ${f1(1.2 * k)}q0 ${f1(1 * k)} ${f1(-1 * k)} ${f1(1.1 * k)}q${f1(1 * k)} ${f1(0.1 * k)} ${f1(1 * k)} ${f1(1.1 * k)}q${f1(-0.2 * k)} ${f1(1.2 * k)} ${f1(1.2 * k)} ${f1(1.2 * k)}M${f1(x + 0.8 * k)} ${f1(y - hh * 0.8)}q${f1(1.4 * k)} 0 ${f1(1.2 * k)} ${f1(1.2 * k)}q0 ${f1(1 * k)} ${f1(1 * k)} ${f1(1.1 * k)}q${f1(-1 * k)} ${f1(0.1 * k)} ${f1(-1 * k)} ${f1(1.1 * k)}q${f1(0.2 * k)} ${f1(1.2 * k)} ${f1(-1.2 * k)} ${f1(1.2 * k)}`, // { }
  ][glyph % 3]
  return s('g', { class: 't31w-item' },
    s('ellipse', { class: 't31w-item-sh', cx: f1(x + 2 * k), cy: f1(y + 0.4), rx: f1(w * 1.25), ry: f1(1.4 * k) }),
    s('path', { class: 't31w-scroll', d: `M${f1(x - w)} ${f1(y)}L${f1(x - w)} ${f1(y - hh)}A${f1(w)} ${f1(1.3 * k)} 0 0 1 ${f1(x + w)} ${f1(y - hh)}L${f1(x + w)} ${f1(y)}A${f1(w)} ${f1(1.3 * k)} 0 0 1 ${f1(x - w)} ${f1(y)}Z` }),
    s('path', { class: 't31w-scroll-sh', d: `M${f1(x + w * 0.3)} ${f1(y - hh)}L${f1(x + w)} ${f1(y - hh)}L${f1(x + w)} ${f1(y)}L${f1(x + w * 0.3)} ${f1(y + 0.5)}Z` }),
    s('ellipse', { class: 't31w-item-end', cx: f1(x), cy: f1(y - hh), rx: f1(w), ry: f1(1.3 * k) }),
    s('path', { class: 'g11-seal', d: stroke([[x - w, y - hh * 0.25], [x + w, y - hh * 0.25]], 1.6 * k, 0.05, 0.05, 0.4) }),
    s('path', { class: 't31w-glyph', d: g }),
    s('path', { class: 'g11-moonlit', d: stroke([[x - w + 0.6, y - hh + 1.5], [x - w + 0.6, y - 1.5]], 0.9 * k, 0.2, 0.2, 0.2) }))
}

/** The thing a well gives up (its own kind), at (x, y) = its foot. */
const thing = (well: string, x: number, y: number, k: number, n: number) => (well === 'github' ? scrollItem(x, y, k, n) : jar(x, y, k * 0.95, 3300 + n))

/**
 * The bucket, drawn about (0, 0) = where the rope ties on: an iron bail, old wooden staves with a lit left edge, two
 * dark iron hoops, a lip of end grain, water at the brim.
 */
function bucketArt(): { g: SVGGElement; dark: SVGElement; water: SVGElement; drips: SVGElement; cargo: SVGGElement } {
  const dark = s('path', { class: 't31w-b-dark', d: 'M-21 14L21 14L18 52Q0 56 -18 52Z' })
  const water = s('ellipse', { class: 't31w-b-water', cx: 0, cy: 15.5, rx: 18, ry: 3.6 })
  const drips = s('g', { class: 't31w-b-drips' }, ...[-12, -2, 9, 15].map((x, i) => s('ellipse', { cx: x, cy: 56 + (i % 2) * 6, rx: 1.3, ry: 2.4, style: `animation-delay:${i * 0.18}s` })))
  const cargo = s('g', { class: 't31w-b-cargo' })
  const r = rng(3131)
  let staves = '', grain = ''
  for (let x = -16; x <= 16; x += 5.4 + r() * 1.6) {
    staves += stroke([[x * 1.08, 15.5], [x, 53]], 1, 0.1, 0.1, 0.3)
    grain += stroke([[x * 1.08 + 2, 24 + r() * 6], [x + 2.2, 34 + r() * 8]], 0.5, 0.2, 0.4, 0.2)
  }
  const shell = 'M-22 14L22 14L18.5 52Q0 57 -18.5 52Z'
  const g = s('g', null,
    s('path', { class: 't31w-b-bail', d: stroke(Array.from({ length: 13 }, (_, i) => { const a = Math.PI * (1 + i / 12); return [Math.cos(a) * 23, 16 + Math.sin(a) * 16] as Pt }), 2.2, 0.1, 0.1, 0.5) }),
    cargo,
    s('path', { class: 't31w-b-body', d: shell, filter: 'url(#ink-rough)' }),
    s('path', { d: shell, fill: 'url(#p2-shade)' }),
    s('path', { class: 't31w-b-grain', d: grain }),
    s('path', { class: 'g11-wash t31w-b-stave', d: staves }),
    s('path', { class: 't31w-b-hoop', d: stroke([[-21.6, 20.5], [0, 22.6], [21.6, 20.5]], 2.8, 0.05, 0.05, 0.6) + stroke([[-19.4, 44], [0, 46.2], [19.4, 44]], 2.8, 0.05, 0.05, 0.6) }),
    s('path', { class: 't31w-b-rivet', d: stroke([[-21, 17.5], [-20.4, 21]], 2, 0.1, 0.1, 0.4) + stroke([[21, 17.5], [20.4, 21]], 2, 0.1, 0.1, 0.4) }),
    s('ellipse', { class: 't31w-b-rim', cx: 0, cy: 14, rx: 22, ry: 4.4 }),
    s('ellipse', { class: 't31w-b-in', cx: 0, cy: 14.6, rx: 19.4, ry: 3.4 }),
    water,
    s('path', { class: 'g11-moonlit', d: stroke([[-20, 17], [-18.2, 35], [-17, 50]], 2.2, 0.2, 0.3, 0.2) }),
    dark, drips)
  return { g, dark, water, drips, cargo }
}

/** one well as laid out (px in the scene): centre x, svg foot `by`, svg size ww × hh (s = px per svg unit), mouth y, rim top */
type Well = { cx: number; by: number; ww: number; hh: number; s: number; my: number; rim: number }
type Geo = { W: number; H: number; tall: boolean; px: number; py: number; bs: number; beam: number; wells: Well[]; hook: Pt[]; cnt: Pt }

/**
 * Scene 1 — two mossy wells on a flagstone yard under one pulley beam, symmetric, seen just above their mouths (stacked
 * far and near on a tall screen). Code glints in the GitHub well, labelled jars sit in the Hugging Face well; each name
 * is cut into a dressed stone in the drum. The old wooden bucket hangs on its rope from the pulley, a paper tag on the
 * rope saying what you need: drag it (it swings) and let go over a well, or tap a well. The right well sends up the
 * thing, which stays on its far rim and is cut into the stone under the name; the wrong one sends up the other well's
 * kind of thing, dripping, and the prompt says why. Six little hooks on the beam count the needs met.
 */
export function wellsScene(ctx: SceneCtx) {
  const low = ctx.quality === 'low'
  const still = ctx.reduced || low
  const items = K.items
  let i = 0
  let sel = 0
  let chosen = false // the bucket hangs straight until a well is chosen
  const timers: number[] = []
  const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms))
  ctx.onCleanup(() => timers.forEach(clearTimeout))
  ctx.textZone('bl')
  const say = live('visually-hidden')
  const back = h('div', { class: 't31w2-back' }, night({ hills: false, moon: false }))
  const mid = s('svg', { class: 't31w2-mid', 'aria-hidden': 'true' })
  const front = s('svg', { class: 't31w2-front', 'aria-hidden': 'true' })
  const rope = s('path', { class: 't31w2-rope' })
  const ropeHi = s('path', { class: 't31w2-rope-hi' })
  const strand = s('path', { class: 't31w2-string' }) // a tall screen: the tag's string from the bucket's foot
  const shade = s('ellipse', { class: 't31w2-shade', rx: 40, ry: 7, filter: 'url(#ink-wash)' }) // the bucket's shadow on the flagstones
  const pulley = s('g', { class: 't31w2-pulley' }, s('circle', { class: 't31w-pulley', r: 1 }), s('circle', { class: 't31w-axle', r: 1 }))
  let pvx = 0
  const B = bucketArt()
  const bucketG = s('svg', { class: 't31w2-bucket', viewBox: '-30 -14 60 76', 'aria-hidden': 'true' }, B.g)
  const flash = s('g', { class: 't31w2-flash' }, s('ellipse', { class: 't31w2-ring', cx: 0, cy: 0, rx: 40, ry: 8 }), s('ellipse', { class: 't31w2-beam', cx: 0, cy: -40, rx: 26, ry: 46, fill: 'url(#p2-lamp)' }))
  const hooks = s('g', { class: 't31w2-hooks' }) // the counter: six hooks on the beam
  const fore = s('g', { class: 't31w2-fore' })
  front.append(fore)
  const ropeSvg = s('svg', { class: 't31w2-ropes', 'aria-hidden': 'true' }, shade, rope, ropeHi, pulley, strand)
  const tag = h('p', { class: 't31w2-tag g11-dopaper' })
  const met: string[] = [] // the well of each need met, in order
  const pails = K.wells.map((w, k) => {
    const art = wellArt(w.id, 3100 + k * 40)
    const things = art.querySelector('.t31w-items') as SVGGElement
    // the name cut into the dressed stone in the drum; the things brought up are cut under it, one by one
    const cut = h('em')
    const tab = h('p', { class: 't31w2-tab', 'aria-hidden': 'true' }, h('span', null, w.name), h('small', null, w.holds), cut)
    // a pointer target over each well (the bucket is the keyboard's way in)
    const zone = h('button', { class: 't31w2-zone', type: 'button', tabindex: '-1', 'aria-hidden': 'true', onClick: () => !busy && drop(k) })
    return { w, art, things, tab, cut, zone, got: 0 }
  })
  const bucket = h('button', { class: 't31w2-grip', type: 'button', 'aria-describedby': 't31w2-help' })
  const help = h('p', { class: 'visually-hidden', id: 't31w2-help' }, K.aria)
  const root = h('div', { class: 'g11 g11-nomoon t31w2', role: 'group', 'aria-label': K.aria },
    back, h('p', { class: 'visually-hidden' }, K.art), mid, ...pails.flatMap((p) => [p.tab, p.zone]), ropeSvg, bucketG, front, tag, bucket, help, say)
  ctx.art.append(root)
  const G6 = guide(ctx)
  let g: Geo | null = null
  const count = G6.count(K.count, items.length, () => (g ? g.cnt : [0, 0]))

  // ── the pendulum: angle th from the vertical under the pulley, rope length len; drag sets the bucket directly
  let th = 0, om = 0, len = 0, rest = 0
  let drag: { id: number; x: number; y: number; vx: number; t: number } | null = null
  let busy = false
  // a drop in flight: well j, phase time t (s); down 0…0.7, flash 0.7…1.15, up 1.15…1.95
  let fall: { j: number; t: number; ok: boolean; x0: number; y0: number } | null = null
  const par = { x: 0, y: 0, tx: 0, ty: 0 }
  // a lean toward the chosen well, short of touching its drum
  const leanTo = (j: number) => (g ? Math.atan2(g.wells[j].cx - g.px, g.wells[j].my - g.py) * (g.tall ? 0.07 : 0.13) : 0)
  const place = (bx: number, by: number, k: number, dark: number) => {
    const G = g!
    const a = (-Math.atan2(bx - pvx, by - G.py) * 180) / Math.PI
    // the svg's (0, 0) is where the rope ties on: 30 × 14 units into its 60 × 76 box, scaled by bs / 46
    const sc = G.bs / 46
    bucketG.style.transform = `translate(${f1(bx)}px, ${f1(by)}px) rotate(${f1(a)}deg)${k !== 1 ? ` scale(${k.toFixed(3)})` : ''} translate(${f1(-30 * sc)}px, ${f1(-14 * sc)}px)`
    B.dark.style.opacity = dark.toFixed(2)
    rope.setAttribute('d', `M${f1(pvx)} ${f1(G.py)}L${f1(bx)} ${f1(by)}`)
    ropeHi.setAttribute('d', `M${f1(pvx - 1.2)} ${f1(G.py + 4)}L${f1(bx - 1.2)} ${f1(by - 2)}`)
    pulley.setAttribute('transform', `translate(${f1(pvx)} ${f1(G.py)})`)
    bucket.style.transform = `translate(${f1(bx - Math.max(48, G.bs * 1.2) / 2)}px, ${f1(by - G.bs * 0.05)}px)`
    // the moon is up on the left, behind: the shadow falls on the flagstones under the bucket, toward the camera and right
    const foot = by + G.bs * 1.18 * k
    const fy = G.tall ? foot + G.bs * 0.12 : Math.max(foot + G.bs * 0.1, G.wells[0].by - G.wells[0].hh * 0.04)
    shade.setAttribute('transform', `translate(${f1(bx + G.bs * 0.22)} ${f1(fy)}) scale(${((G.bs / 70) * k).toFixed(3)})`)
    shade.style.opacity = (0.34 * (1 - dark)).toFixed(2)
    if (G.tall) {
      // a tall screen: the tag hangs from the bucket's foot on a short string, out on the open flagstones
      const ty = Math.max(foot + 10, G.wells[1].by - G.wells[1].hh * 0.02)
      strand.setAttribute('d', tag.hidden ? '' : `M${f1(bx)} ${f1(by + G.bs * 1.12 * k)}L${f1(bx + 1)} ${f1(ty + 3)}`)
      tag.style.transform = `translate(${f1(bx - 20)}px, ${f1(ty)}px) rotate(${f1(a * 0.5 + 1.5)}deg)`
    } else {
      // tied on the rope halfway down, swinging with it
      const ax = pvx + (bx - pvx) * 0.5, ay = G.py + (by - G.py) * 0.5
      tag.style.transform = `translate(${f1(ax)}px, ${f1(ay - 12)}px) rotate(${f1(a)}deg) translateX(-50%)`
    }
  }
  const loop = createLoop(root, (_t, dt) => {
    if (!g) return false
    const d = Math.min(dt, 0.05)
    let moving = false
    // parallax: back drifts least, the near band most
    par.x += (par.tx - par.x) * Math.min(1, d * 5)
    par.y += (par.ty - par.y) * Math.min(1, d * 5)
    back.style.transform = `translate(${f1(par.x * -5)}px, ${f1(par.y * -3)}px)`
    front.style.transform = `translate(${f1(par.x * 6)}px, ${f1(par.y * 3)}px)`
    moving ||= Math.abs(par.tx - par.x) + Math.abs(par.ty - par.y) > 0.003
    if (fall) {
      fall.t += d
      const w = g.wells[fall.j]
      const t = fall.t
      if (t < 0.7) {
        const e = 1 - (1 - t / 0.7) ** 2
        pvx = g.px + (w.cx - g.px) * Math.min(1, e * 1.6)
        place(fall.x0 + (w.cx - fall.x0) * e, fall.y0 + (w.my - g.bs * 0.25 - fall.y0) * e, 1 - 0.62 * e, 0.75 * e)
      } else if (t < 1.15) {
        bucketG.style.opacity = '0'
        tag.style.opacity = '0'
        const u = (t - 0.7) / 0.45
        flash.setAttribute('transform', `translate(${f1(w.cx)} ${f1(w.my)}) scale(${(w.ww / 110).toFixed(3)})`)
        flash.style.opacity = (Math.sin(u * Math.PI) * 0.95).toFixed(2)
        ;(flash.firstChild as SVGElement).setAttribute('transform', `scale(${(0.4 + u * 1.1).toFixed(3)})`)
      } else if (t < 1.95) {
        flash.style.opacity = '0'
        bucketG.style.opacity = '1'
        const e = ((t - 1.15) / 0.8) ** 0.7
        pvx = w.cx + (g.px - w.cx) * Math.max(0, e * 1.4 - 0.4)
        const rx = g.px, ry = g.py + rest
        place(w.cx + (rx - w.cx) * e, w.my - g.bs * 0.25 + (ry - w.my + g.bs * 0.25) * e, 0.38 + 0.62 * e, 0.75 * (1 - e))
      } else {
        land()
      }
      return true
    }
    if (drag) return true
    // a damped pendulum toward its lean
    const goal = chosen && !busy ? leanTo(sel) : 0
    om += (-(9.8 / Math.max(0.5, len / 120)) * (Math.sin(th) - Math.sin(goal)) - 2.2 * om) * d
    th += om * d
    len += (rest - len) * Math.min(1, d * 6)
    pvx = g.px
    place(g.px + Math.sin(th) * len, g.py + Math.cos(th) * len, 1, 0)
    moving ||= Math.abs(om) > 0.002 || Math.abs(th - goal) > 0.002 || Math.abs(rest - len) > 0.3
    return moving
  })
  ctx.onCleanup(() => loop.dispose())
  const settle = () => {
    if (!g) return
    pails.forEach((p, k) => p.art.classList.toggle('sel', chosen && k === sel))
    if (still && !fall) {
      th = chosen ? leanTo(sel) : 0
      om = 0
      len = rest
      pvx = g.px
      place(g.px + Math.sin(th) * len, g.py + Math.cos(th) * len, 1, 0)
    } else loop.start()
  }

  function layout() {
    const W = root.clientWidth, H = root.clientHeight
    if (W < 80 || H < 80) return
    const tall = W < H * 0.8
    const mk = (cx: number, ww: number, rim: number): Well => {
      const s = ww / 220, hh = 108 * s
      const by = rim + hh - 7.5 * s // the rim's outer top is 7.5 units under the svg's top
      return { cx, by, ww, hh, s, my: by - hh + 24 * s, rim }
    }
    let wells: Well[], beam: number, bs: number, tie: number, px: number
    if (tall) {
      // stacked: the far well up and right of centre, the near one lower; the rope drops on the left, the bucket hangs
      // beside the near well and its tag below it on the open flagstones
      beam = H * 0.16
      const far = mk(W * 0.585, W * 0.88, H * 0.27)
      const near = mk(W * 0.63, W * 1.0, far.by - far.hh * 0.05)
      wells = [far, near]
      bs = clamp(W * 0.22, 64, 100)
      px = W * 0.16
      tie = near.by - near.hh * 0.1 - (54 * bs) / 46
    } else {
      // side by side, low and big (mouths at ~45 % of the height), the bucket hanging between them, half a drum wide
      const ww = clamp(Math.min(W * 0.42, H * 0.84), 180, 640)
      beam = H * 0.14
      const rim = H * 0.355
      wells = [W / 2 - ww * 0.56, W / 2 + ww * 0.56].map((cx) => mk(cx, ww, rim))
      bs = clamp(ww * 0.29, 60, 190)
      px = W / 2
      tie = wells[0].by - wells[0].hh * 0.16 - (54 * bs) / 46
    }
    // the counter: six hooks hung on the beam, three each side of the middle, the count carved after them
    const hk = tall ? 15 : clamp(W * 0.016, 16, 26)
    const hx0 = tall ? W * 0.5 : px
    const hook = [-3.5, -2.5, -1.5, 1.5, 2.5, 3.5].map((u) => [hx0 + u * hk, beam + 4] as Pt)
    g = { W, H, tall, px, py: beam + 6, bs, beam, wells, hook, cnt: [hook[5][0] + hk * 1.9, beam + hk * 1.4] }
    tag.classList.toggle('low', tall)
    tag.style.maxWidth = tall ? `${f1(Math.min(W * 0.62, 240))}px` : `${f1(clamp(W * 0.17, 150, 230))}px`
    pvx = px
    const pr = tall ? 6 : clamp(W * 0.0075, 6, 11)
    pulley.children[0].setAttribute('r', f1(pr))
    pulley.children[1].setAttribute('r', f1(pr * 0.32))
    rest = tie - g.py
    len ||= rest
    Object.assign(bucketG.style, { width: `${f1((60 * bs) / 46)}px`, height: `${f1((76 * bs) / 46)}px` })
    ropeSvg.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    paint(W, H, tall)
    // the wells, the names cut in their drums, the pointer zones
    pails.forEach((p, k) => {
      const w = wells[k]
      p.art.setAttribute('x', f1(w.cx - w.ww / 2))
      p.art.setAttribute('y', f1(w.by - w.hh))
      p.art.setAttribute('width', f1(w.ww))
      p.art.setAttribute('height', f1(w.hh))
      // the lantern's warmth on the flank toward its post
      ;(p.art.querySelector('.t31w-warm') as SVGElement).setAttribute('cx', String(tall ? 162 : k ? 162 : 58))
      // the dressed stone: 76 units wide, its middle bulging down with the drum
      const tw = (TAB_HW * 2 + 2) * w.s, top = w.by - w.hh + (TAB_T + ER * 0.82 - 92) * w.s, th2 = (TAB_B - TAB_T) * w.s
      Object.assign(p.tab.style, { transform: `translate(${f1(w.cx - tw / 2)}px, ${f1(top)}px)`, width: `${f1(tw)}px`, height: `${f1(th2)}px`, fontSize: `${f1(clamp(w.s * 6.3, 10, 17))}px` })
      const dw = 134 * w.s // the drum
      Object.assign(p.zone.style, { transform: `translate(${f1(w.cx - dw / 2)}px, ${f1(w.rim - 10)}px)`, width: `${f1(dw)}px`, height: `${f1(w.by - w.hh * 0.12 - w.rim + 10)}px` })
    })
    bucket.style.width = bucket.style.height = `${f1(Math.max(48, bs * 1.2))}px`
    count.at(g.cnt)
    settle()
  }

  /** the six hooks on the beam: empty iron hooks, or the little thing each need brought up */
  function drawHooks() {
    if (!g) return
    const k = g.tall ? 0.62 : clamp(g.W * 0.00072, 0.7, 1.1)
    hooks.replaceChildren(...g.hook.map(([x, y], n) => {
      const cord = 9 * k + (n % 3) * 3 * k
      const w = met[n]
      return s('g', { class: `t31w2-hook${w ? ' on' : ''}` },
        s('path', { class: 't31w2-cord', d: `M${f1(x)} ${f1(y)}V${f1(y + cord)}` }),
        w ? thing(w, x, y + cord + 15 * k, k, n) : s('circle', { class: 't31w2-ironhook', cx: f1(x), cy: f1(y + cord + 2.6 * k), r: f1(2.6 * k) }))
    }))
  }

  /** the courtyard, the pulley beam on two posts with a lantern each, a dark near band of gravel and grass (px, per layout) */
  function paint(W: number, H: number, tall: boolean) {
    mid.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    front.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    const G = g!
    const r = rng(3171)
    const w0 = G.wells[0], wN = G.wells[G.wells.length - 1]
    const hz = w0.by - w0.hh * (tall ? 1.05 : 1.12) // where the courtyard melts into mist
    const nearY = tall ? H * 0.86 : H * 0.79 // the top of the dark near band
    // flagstones in perspective: courses across, joints converging on the vanishing point behind the wells, dark grout,
    // the odd darker stone, moss in the cracks; all thinning into the mist
    const vx = W / 2, vy = hz - (H - hz) * 0.7
    const joints = ['', '', ''], grout = ['', '', ''], dark: string[] = [], moss: string[] = []
    for (let row = 0, y = H + 10; y > hz + 2 && row < 18; row++) {
      const k = (y - hz) / (H - hz) // 1 near … 0 far
      const sh = 5 + 44 * k * k + 6 * k
      const span = W * (0.34 + 0.4 * k)
      const band = k < 0.3 ? 2 : k < 0.6 ? 1 : 0
      const lw = 0.8 + 2.4 * k
      for (let x = vx - span; x < vx + span; ) {
        const len = span * (0.2 + r() * 0.35)
        const a: Pt = [x, y + (r() - 0.5) * 1.5], b: Pt = [x + len * 0.5, y + (r() - 0.5) * 2], c: Pt = [Math.min(vx + span, x + len), y + (r() - 0.5) * 1.5]
        joints[band] += stroke([a, b, c], lw, 0.2, 0.25, 0.3)
        grout[band] += stroke([[a[0], a[1] + lw * 0.7], [b[0], b[1] + lw * 0.7], [c[0], c[1] + lw * 0.7]], lw * 0.5, 0.2, 0.25, 0.3)
        x += len + 4 + r() * 18
      }
      // joints between stones in this course, aimed at the vanishing point
      const step = 30 + 120 * k
      for (let x = vx - span - ((vx - span) % step) + r() * step * 0.3; x < vx + span; x += step * (0.75 + r() * 0.5)) {
        const t = sh / Math.max(1, y - vy)
        const x2 = x + (vx - x) * t
        joints[band] += stroke([[x, y - 1], [x2, y - sh + 1]], lw * 0.85, 0.15, 0.15, 0.35)
        if (r() < 0.16) dark.push(`M${f1(x)} ${f1(y - 1)}L${f1(x + step * 0.8)} ${f1(y - 1)}L${f1(x2 + step * 0.8 * (1 - t))} ${f1(y - sh + 1)}L${f1(x2)} ${f1(y - sh + 1)}Z`)
        if (r() < 0.25) moss.push(blob(x, y - 1, 4 + 10 * k, 1 + 1.6 * k, 3300 + row * 7 + Math.round(x), 0.3, 8))
      }
      y -= sh
    }
    // the village behind: far roofs and a bamboo fence fading into the mist
    let roofs = '', fence = ''
    for (const [x, w0r, h0] of [[0.08, 0.11, 0.05], [0.19, 0.08, 0.04], [0.8, 0.12, 0.055], [0.92, 0.07, 0.035]]) {
      const cx = W * x, ww0 = W * w0r, hh0 = H * h0
      roofs += `M${f1(cx - ww0 / 2)} ${f1(hz)}L${f1(cx - ww0 * 0.42)} ${f1(hz - hh0 * 0.55)}Q${f1(cx)} ${f1(hz - hh0 * 1.1)} ${f1(cx + ww0 * 0.42)} ${f1(hz - hh0 * 0.55)}L${f1(cx + ww0 / 2)} ${f1(hz)}Z`
    }
    for (let x = W * 0.7; !tall && x < W * 0.98; x += 7 + r() * 5) fence += stroke([[x, hz + 2], [x + (r() - 0.5) * 2, hz - 12 - r() * 8]], 2.4, 0.04, 0.1, 0.5)
    // the beam on two posts standing on the flagstones beside the wells, a paper lantern hung inside each post
    const postX = tall ? [W * 0.045, W * 0.955] : [w0.cx - w0.ww * 0.5, wN.cx + wN.ww * 0.5]
    const postB = tall ? w0.by - w0.hh * 0.05 : w0.by - w0.hh * 0.14
    const pw = tall ? 9 : clamp(W * 0.009, 9, 15)
    const posts = postX.map((x, k) => bamboo([x, postB + 6], [x + (k ? -2 : 2), G.beam - 8], pw, 3180 + k, 60))
    // the posts' feet: a flat stone each, the post's shadow on the flagstones (away from the moon)
    const feet = postX.map((x, k) => s('g', null,
      wash(blob(x + pw * 2.6, postB + 8, pw * 3.2, pw * 0.5, 3186 + k, 0.2), 0.32, 'p2p-wash t31w2-cast'),
      s('ellipse', { class: 't31w2-footstone', cx: f1(x + 1), cy: f1(postB + 6), rx: f1(pw * 1.5), ry: f1(pw * 0.42) })))
    const beam = bamboo([postX[0] - 12, G.beam + 4], [postX[1] + 12, G.beam], tall ? 10 : clamp(W * 0.01, 10, 16), 3182, 90)
    // lashings where the beam sits on the posts
    const lash = postX.map((x) => s('path', { class: 'g11-wood-ink', d: stroke([[x - pw, G.beam - 3], [x + pw, G.beam + 5]], 2, 0.1, 0.1, 0.4) + stroke([[x - pw, G.beam + 5], [x + pw, G.beam - 3]], 2, 0.1, 0.1, 0.4) }))
    const lr = tall ? 9 : clamp(W * 0.012, 10, 18)
    const lamps = postX.map((x, k) => {
      const lx = x + (k ? -1 : 1) * lr * 2.4, ly = G.beam + (postB - G.beam) * (tall ? 0.2 : 0.3)
      // its warm pool on the flagstones below (and a little toward the camera)
      const fy = postB + lr * 1.4
      return s('g', { class: 't31w2-lamp' },
        s('ellipse', { class: 't31w2-pool', cx: f1(lx), cy: f1(fy), rx: f1(lr * 9), ry: f1(lr * 2.2), fill: 'url(#p2-lamp)' }),
        s('ellipse', { class: 't31w2-pool2', cx: f1(lx), cy: f1(fy), rx: f1(lr * 3.6), ry: f1(lr * 0.9) }),
        s('path', { class: 'g11-wood-ink', d: stroke([[x, ly - lr * 1.9], [lx, ly - lr * 1.9]], 2.4, 0.1, 0.1, 0.5) }),
        paperLantern(lx, ly - lr * 1.9, lr, 3190 + k, lr * 0.8))
    })
    // each well throws its shadow forward and to the right (the moon is up on the left, behind)
    const shadows = G.wells.map((w, k) => wash(blob(w.cx + w.ww * 0.12, w.by - w.hh * 0.02, w.ww * 0.34, w.hh * 0.12, 3200 + k, 0.16), 0.34, 'p2p-wash t31w2-cast'))
    const mr = tall ? 15 : clamp(W * 0.019, 18, 30)
    const mx = tall ? W * 0.4 : W * 0.2, my = tall ? H * 0.055 : Math.max(mr * 1.8, G.beam * 0.5)
    mid.replaceChildren(
      moon(mx, my, mr, 3167, true),
      hills(-W * 0.1, W * 1.1, hz + 4, H * 0.2, 3168, 0.9, 5),
      mist(W * 0.5, hz - H * 0.07, W * 0.75, H * 0.09),
      hills(W * 0.45, W * 1.1, hz + 6, H * 0.1, 3169, 0.55, 2),
      s('path', { class: 't31w2-roofs', d: roofs, filter: 'url(#ink-wash)' }),
      s('path', { class: 'g11-bamboo-culm t31w2-fence', d: fence }),
      mist(W * 0.5, hz + 4, W * 0.8, H * 0.055),
      s('ellipse', { class: 't31w2-floor', cx: f1(W * 0.42), cy: f1((hz + H) / 2), rx: f1(W * 0.62), ry: f1((H - hz) * 0.62), fill: 'url(#p2-halo)' }),
      s('path', { class: 'g11-wash t31w2-dark', d: dark.join(''), filter: 'url(#ink-wash)' }),
      ...grout.map((d, k) => s('path', { class: `t31w2-grout t31w2-c${k}`, d })),
      ...joints.map((d, k) => s('path', { class: `g11-wash t31w2-joint t31w2-c${k}`, d })),
      s('path', { class: 'g11-mossy t31w2-moss', d: moss.join('') }),
      ...lamps, ...shadows, ...feet,
      ...posts, beam, ...lash, hooks,
      ...pails.map((p) => p.art),
      flash)
    drawHooks()
    // the near band: dark gravel and grass across the foot, its crown catching the moon, a few pebbles lit on their left
    const top: Pt[] = []
    for (let x = -20; x <= W + 20; x += W / 14) top.push([x, nearY + (r() - 0.5) * H * 0.025 + Math.sin((x / W) * 5.2) * H * 0.008])
    const band = `M-20 ${f1(H + 20)}L${top.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}L${f1(W + 20)} ${f1(H + 20)}Z`
    let pebbles = '', lit = ''
    for (let n = 0; n < (tall ? 16 : 34); n++) {
      const x = tall ? r() * W : W * (0.4 + r() * 0.6), y = nearY + H * 0.012 + r() * (H - nearY) * 0.6
      const rr = (tall ? 3 : 4) + r() * (tall ? 5 : 8)
      pebbles += blob(x, y, rr, rr * 0.55, 3240 + n, 0.25, 9)
      lit += stroke([[x - rr * 0.8, y - rr * 0.1], [x - rr * 0.3, y - rr * 0.5], [x + rr * 0.3, y - rr * 0.52]], Math.max(1, rr * 0.22), 0.2, 0.3, 0.2)
    }
    // (a wide screen keeps the left of the band calm: the insight is written there)
    const tufts = Array.from({ length: tall ? 7 : 7 }, (_, n) => grass(tall ? (n + 0.3 + r() * 0.4) * (W / 7) : W * (0.44 + (n + r() * 0.5) * 0.08), nearY + H * 0.03 + r() * H * 0.03, (tall ? 26 : 40) + r() * 24, 3260 + n))
    fore.replaceChildren(
      s('path', { class: 't31w2-near', d: band, filter: 'url(#ink-wash)' }),
      s('path', { class: 'g11-moonlit t31w2-crown', d: stroke(top.slice(0, Math.ceil(top.length * 0.6)), tall ? 1.4 : 2, 0.1, 0.4, 0.2) }),
      s('path', { class: 't31w2-pebble', d: pebbles, filter: 'url(#ink-rough)' }),
      s('path', { class: 'g11-moonlit t31w2-pebble-lit', d: lit }),
      ...tufts)
  }
  ctx.onCleanup(onSize(root, layout))

  // ── the current need on the tag, the bucket's own name for keyboards and screen readers
  function showItem() {
    const it = items[i]
    tag.replaceChildren(it ? it.label : '')
    tag.hidden = !it
    bucket.setAttribute('aria-label', it ? fill(K.itemAria, { item: it.aria, well: K.wells[sel].name }) : K.done)
    B.cargo.replaceChildren()
  }
  function drop(j: number) {
    const it = items[i]
    if (!it || busy || !g) return
    sel = j
    busy = true
    root.classList.remove('carry')
    const ok = it.well === K.wells[j].id
    ctx.chime('soft')
    const bx = g.px + Math.sin(th) * len, by = g.py + Math.cos(th) * len
    fall = { j, t: 0, ok, x0: bx, y0: by }
    // the well gives up its own kind of thing: what you needed, or the other well's kind (H6: you see why it is wrong)
    B.cargo.replaceChildren(thing(K.wells[j].id, 0, 17, 1.6, i))
    B.drips.classList.toggle('on', !ok)
    B.water.style.opacity = ok ? '1' : '0.4'
    if (still) {
      // no swing: the bucket fades out and back with what it brought
      root.classList.add('t31w2-dip')
      later(land, ctx.reduced ? 0 : 450)
    } else loop.start()
  }
  function land() {
    if (!fall || !g) return
    const { j, ok } = fall
    fall = null
    busy = false
    root.classList.remove('t31w2-dip')
    flash.style.opacity = '0'
    bucketG.style.opacity = tag.style.opacity = '1'
    th = 0
    om = 0
    len = rest
    if (!ok) {
      // say why: what that well holds (H6); the bucket shows it, dripping, then empties
      const why = (K.wrongIn as Record<string, string>)[K.wells[j].id] ?? K.wrong
      ctx.chime('low')
      say.say(why)
      ctx.prompt(why, 'wrong')
      later(() => (B.drips.classList.remove('on'), B.cargo.replaceChildren(), (B.water.style.opacity = '1')), 2200)
      settle()
      return
    }
    ctx.chime('tap')
    const it = items[i]
    const p = pails[j]
    // the thing stays on that well's far rim; its name is cut into the stone under the well's
    const [x, y] = SLOTS[p.got % SLOTS.length]
    p.things.append(thing(K.wells[j].id, x, y, 1.45, i))
    p.cut.append(h('i', null, it.tag))
    p.got++
    met.push(K.wells[j].id)
    drawHooks()
    count.set(met.length)
    i++
    B.water.style.opacity = '1'
    showItem()
    dot?.done()
    dot = null
    if (i < items.length) return say.say(K.right), ctx.prompt(K.next), settle()
    say.say(K.done)
    root.classList.add('t31w2-done')
    chosen = false // all in: the bucket hangs straight and still
    ctx.insight(K.insight as Fact, K.detail as Fact)
    settle()
  }

  // ── input: drag the bucket (pointer), tap a well, or keys on the bucket
  const toLocal = (e: PointerEvent) => {
    const r = root.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top] as Pt
  }
  bucket.addEventListener('pointerdown', (e) => {
    if (busy || !g || e.button) return
    bucket.setPointerCapture(e.pointerId)
    const [x, y] = toLocal(e)
    drag = { id: e.pointerId, x, y, vx: 0, t: performance.now() }
    if (items[i]) root.classList.add('carry') // H3: both mouths light as places to drop
    loop.start()
  })
  bucket.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id || !g) return
    const [x, y] = toLocal(e)
    const now = performance.now()
    drag.vx = (x - drag.x) / Math.max(8, now - drag.t)
    Object.assign(drag, { x, y, t: now })
    th = Math.atan2(x - g.px, Math.max(10, y - g.py))
    len = clamp(Math.hypot(x - g.px, y - g.py), rest * 0.4, rest * 1.6)
    place(g.px + Math.sin(th) * len, g.py + Math.cos(th) * len, 1, 0)
  })
  const release = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id || !g) return
    const { x, y, vx } = drag
    drag = null
    root.classList.remove('carry')
    // let go over a well (the one whose mouth is nearest, when they overlap): it drops in; else it swings back
    let j = -1, best = Infinity
    g.wells.forEach((w, k) => {
      const dy = Math.abs(y - w.my)
      if (Math.abs(x - w.cx) < w.ww * 0.32 && y > w.rim - w.hh * 0.3 && y < w.by && dy < best) (best = dy), (j = k)
    })
    if (j >= 0) return drop(j)
    om = (vx * 1000) / Math.max(60, len)
    if (Math.abs(x - g.px) > 4) (sel = x < g.px ? 0 : 1), (chosen = true)
    showItem()
    settle()
  }
  bucket.addEventListener('pointerup', release)
  bucket.addEventListener('pointercancel', release)
  bucket.addEventListener('click', (e) => {
    // a keyboard Enter / Space: drop into the well it leans to; a tap that did not move: show the way (both mouths light)
    if (e.detail === 0) return drop(sel)
    if (!items[i] || busy) return
    root.classList.add('carry')
    later(() => root.classList.remove('carry'), 1400)
    ctx.prompt(K.prompt)
  })
  bucket.addEventListener('keydown', (e) => {
    const k = { ArrowLeft: 0, ArrowRight: 1, ArrowUp: 0, ArrowDown: 1, '1': 0, '2': 1 }[e.key]
    if (k == null || busy) return
    e.preventDefault()
    sel = k
    chosen = true
    showItem()
    settle()
  })
  root.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || still) return
    const r = root.getBoundingClientRect()
    par.tx = ((e.clientX - r.left) / r.width) * 2 - 1
    par.ty = ((e.clientY - r.top) / r.height) * 2 - 1
    loop.start()
  })
  // H7: standing still 6 s, the bucket swings a little toward the well that has the current need
  const nudge = () => {
    const it = items[i]
    if (!it || busy || drag || still || !g) return
    om += (K.wells.findIndex((w) => w.id === it.well) ? 1 : -1) * 0.42
    loop.start()
  }
  ctx.el.addEventListener('p2:idle', nudge)
  ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', nudge))

  showItem()
  ctx.prompt(K.prompt)
  // H1: a dot on the bucket's bail until the first need is met (it rides with the bucket)
  let dot: Mark | null = G6.dot(bucket, { dir: [0, 1] })
}
