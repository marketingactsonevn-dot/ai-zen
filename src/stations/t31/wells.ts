import raw from '../../content/tram-31.json'
import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { createLoop } from '../../core/loop'
import { clamp, onSize, stoneArt } from '../../ui/part2/ink'
import { grass, hills, mist, moon, paperLantern, wash } from '../../ui/part2/paint'
import { guide, type Mark } from '../../ui/part2/guide'
import type { SceneCtx } from '../types'
import { bamboo, ground, live, night, rng, stroke, blob, type Pt } from './kit'

const K = raw.scenes.wells
const f1 = (n: number) => (Math.round(n * 10) / 10).toString()

// a well in viewBox 0 0 220 210: rim centre (CX, RY), radii RX × ER, the body down to BOT
const CX = 110, RY = 116, RX = 64, ER = 15, BOT = 174

/** Points along the front half of an ellipse round CX at height y (left → right when reversed, right → left as given). */
const front = (y: number, rx = RX, ry = ER, n = 18): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = (Math.PI * i) / n
    return [CX + Math.cos(a) * rx, y + Math.sin(a) * ry] as Pt
  })

/** A small clay jar standing on (x, y), k ≈ its height / 13: glazed body, neck, lip, a paper label with a red seal. */
export function jar(x: number, y: number, k: number, seed: number): SVGGElement {
  const r = rng(seed)
  const w = 5 + r() * 1.2
  const body = `M${f1(x - w * k)} ${f1(y)}C${f1(x - (w + 2.6) * k)} ${f1(y - 6 * k)} ${f1(x - w * k)} ${f1(y - 10 * k)} ${f1(x - 2.3 * k)} ${f1(y - 10.6 * k)}L${f1(x - 2.3 * k)} ${f1(y - 12.4 * k)}L${f1(x + 2.3 * k)} ${f1(y - 12.4 * k)}L${f1(x + 2.3 * k)} ${f1(y - 10.6 * k)}C${f1(x + w * k)} ${f1(y - 10 * k)} ${f1(x + (w + 2.6) * k)} ${f1(y - 6 * k)} ${f1(x + w * k)} ${f1(y)}Z`
  return s('g', { class: 't31w-jar' },
    s('path', { class: 'g11-clay', d: body, filter: 'url(#ink-rough)' }),
    s('path', { class: 't31w-jar-sh', d: body }),
    s('path', { class: 'g11-wash t31w-jar-ink', d: stroke([[x - 3 * k, y - 12.6 * k], [x + 3.2 * k, y - 12.5 * k]], 1.6 * k, 0.1, 0.1, 0.4) + stroke([[x + (w + 1.6) * k, y - 6 * k], [x + w * k, y - 1 * k], [x - w * k, y]], 1.1 * k, 0.1, 0.3, 0.3) }),
    s('path', { class: 'g11-label', d: `M${f1(x - 2.8 * k)} ${f1(y - 8.2 * k)}l${f1(5.4 * k)} -0.3l0.2 ${f1(4.4 * k)}l${f1(-5.4 * k)} 0.3Z` }),
    s('path', { class: 'g11-seal', d: stroke([[x - 1.2 * k, y - 6.6 * k], [x + 1.1 * k, y - 6.7 * k]], 1.3 * k, 0.1, 0.1, 0.5) }),
    s('path', { class: 'g11-moonlit', d: stroke([[x - (w + 0.8) * k, y - 4 * k], [x - (w - 0.4) * k, y - 8 * k], [x - 2.6 * k, y - 9.8 * k]], 1.1 * k, 0.2, 0.3, 0.2) }))
}

/** A mossy stone well with a bamboo frame, a little roof and a bamboo bucket on a rope; code glints or jars in the water. */
export function wellArt(kind: string, seed: number, cls = 't31w-art', bare = false): SVGSVGElement {
  const r = rng(seed)
  // stone courses on the drum: curved joints following the front of the ellipse, staggered upright joints
  const levels = [RY + 15, RY + 30, RY + 45]
  let courses = ''
  for (const y of levels) {
    const arc = front(y)
    const cut = 5 + Math.floor(r() * 8)
    courses += stroke(arc.slice(0, cut), 1.3, 0.1, 0.2, 0.3) + stroke(arc.slice(cut + 1), 1.4, 0.1, 0.15, 0.3)
  }
  let joints = '', dark = ''
  const tops = [RY + 4, ...levels]
  for (let k = 0; k < tops.length; k++) {
    const y0 = tops[k], y1 = levels[k] ?? BOT
    for (let a = (k % 2 ? 0.22 : 0.48) + r() * 0.1; a < Math.PI - 0.12; a += 0.46 + r() * 0.1) {
      const x = CX + Math.cos(a) * RX, sy = Math.sin(a) * ER
      joints += stroke([[x, y0 + sy + 1], [x + (r() - 0.5) * 1.5, y1 + sy - 1]], 1.1, 0.2, 0.2, 0.4)
      if (r() < 0.35) {
        const xm = CX + Math.cos(a + 0.23) * RX * 0.98
        dark += blob(xm, (y0 + y1) / 2 + Math.sin(a + 0.23) * ER, 7 + Math.sin(a) * 4, (y1 - y0) * 0.36, seed + k * 13 + Math.round(a * 10), 0.2, 10)
      }
    }
  }
  // the rim: a ring of cut stones seen from above
  let rim = ''
  for (let a = r() * 0.4; a < Math.PI * 2; a += 0.5 + r() * 0.14) {
    rim += stroke([[CX + Math.cos(a) * 53, RY - 1 + Math.sin(a) * 11], [CX + Math.cos(a) * 67, RY + Math.sin(a) * 16.5]], 1, 0.2, 0.2, 0.4)
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
  // a small hip roof: ridge with upturned ends, a thick thatch body, tile lines and a dark eave
  const roof = `M${CX - 104} 27Q${CX - 96} 33 ${CX - 84} 32Q${CX - 44} 22 ${CX} 5Q${CX + 44} 22 ${CX + 84} 32Q${CX + 96} 33 ${CX + 104} 27Q${CX + 104} 36 ${CX + 94} 41Q${CX + 50} 33 ${CX} 19Q${CX - 50} 33 ${CX - 94} 41Q${CX - 104} 36 ${CX - 104} 27Z`
  let tiles = ''
  for (let x = CX - 86; x <= CX + 86; x += 8.5) {
    const t = Math.abs(x - CX) / 94
    const y = 6 + t * 25
    tiles += stroke([[x, y + 1], [x + (x - CX) * 0.06, y + 13 - t * 3]], 1.2, 0.2, 0.3, 0.3)
  }
  const frame = bare ? [] : [
    // the frame: two bamboo posts, a crossbar, a small roof with tiles
    bamboo([CX - 82, BOT + 10], [CX - 80, 34], 6.4, seed + 2, 32),
    bamboo([CX + 82, BOT + 10], [CX + 80, 34], 6.4, seed + 3, 32),
    bamboo([CX - 94, 44], [CX + 94, 42], 5.2, seed + 4, 46),
    s('path', { class: 't31w-roof', d: roof, filter: 'url(#ink-wash)' }),
    s('path', { class: 't31w-tiles', d: tiles }),
    s('path', { class: 'g11-wash t31w-ridge', d: stroke([[CX - 104, 27], [CX - 84, 31], [CX - 44, 21], [CX, 4.5], [CX + 44, 21], [CX + 84, 31], [CX + 104, 27]], 3, 0.06, 0.06, 0.4) + stroke([[CX - 94, 41], [CX - 50, 33], [CX, 19.5], [CX + 50, 33], [CX + 94, 41]], 2, 0.1, 0.1, 0.4), filter: 'url(#ink-rough)' }),
    // pulley and rope, and the bamboo bucket (dips on a right drop)
    s('circle', { class: 't31w-pulley', cx: CX, cy: 47, r: 5.5 }),
    s('g', { class: 't31w-bucket' },
      s('path', { class: 'g11-thread', d: `M${CX} 47V76` }),
      s('path', { class: 'g11-wash t31w-handle', d: stroke(curveArcUp(CX, 79, 11), 1.4, 0.1, 0.1, 0.4) }),
      bamboo([CX, 77], [CX, 99], 20, seed + 5, 19, 'g11-bamboo t31w-tub'),
      s('path', { class: 'g11-wash t31w-hoop', d: stroke([[CX - 10, 82], [CX + 10, 82.6]], 1.3, 0.1, 0.1, 0.4) + stroke([[CX - 10, 94], [CX + 10, 94.4]], 1.3, 0.1, 0.1, 0.4) })),
  ]
  return s('svg', { class: cls, viewBox: bare ? '0 92 220 108' : '0 0 220 210', 'aria-hidden': 'true' },
    bare ? '' : ground(CX + 6, BOT + 10, 98, 13, seed + 1, 0.2),
    ...frame,
    // the drum: stone face, shaded flank, mortar courses and joints, a few darker stones, moss
    s('path', { class: 't31w-body', d: body, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
    s('path', { d: body, fill: 'url(#p2-shade)' }),
    s('path', { class: 'g11-wash t31w-dark', d: dark, filter: 'url(#ink-wash)' }),
    s('path', { class: 'g11-wash t31w-course', d: courses + joints }),
    s('path', { class: 'g11-wash t31w-edge', d: stroke(front(BOT).reverse(), 2.2, 0.1, 0.1, 0.3) + stroke([[CX + RX, RY + 2], [CX + RX + 0.5, BOT]], 2, 0.1, 0.1, 0.4) + stroke([[CX - RX, RY + 2], [CX - RX - 0.4, BOT]], 1.2, 0.1, 0.1, 0.3), filter: 'url(#ink-rough)' }),
    s('path', { class: 'g11-moonlit t31w-lit', d: stroke([[CX - RX + 2.5, RY + 6], [CX - RX + 2, BOT - 4]], 2.2, 0.2, 0.3, 0.2) }),
    // the rim, the dark mouth, the far inner wall and the water
    s('ellipse', { class: 't31w-rimstone', cx: CX, cy: RY, rx: 67, ry: 16.5, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
    s('path', { class: 'g11-wash t31w-rimjoint', d: rim }),
    s('ellipse', { class: 't31w-hole', cx: CX, cy: RY - 1, rx: 53, ry: 11 }),
    s('ellipse', { class: 't31w-pool', cx: CX, cy: RY + 1.4, rx: 50, ry: 9.2 }),
    s('ellipse', { class: 't31w-moonr', cx: CX + 18, cy: RY + 2, rx: 6, ry: 2.6 }),
    water,
    s('path', { class: 'g11-wash t31w-edge', d: stroke(front(RY, 67, 16.5).reverse(), 2.4, 0.06, 0.06, 0.3), filter: 'url(#ink-rough)' }),
    // the lantern's warmth on one side of the drum (shown by the scene), the things set on the rim
    bare ? s('ellipse', { class: 't31w-warm', cx: CX + 52, cy: (RY + BOT) / 2 + 4, rx: 30, ry: 40, fill: 'url(#p2-lamp)' }) : '',
    bare ? s('g', { class: 't31w-items' }) : '',
    s('path', { class: 'g11-moonlit', d: stroke(Array.from({ length: 10 }, (_, i) => { const a = Math.PI * (1.12 + i * 0.05); return [CX + Math.cos(a) * 66, RY + Math.sin(a) * 16] as Pt }), 1.8, 0.2, 0.3, 0.2) }),
    // the far edge of the rim catches the cold moon
    s('path', { class: 't31w-farrim', d: stroke(Array.from({ length: 17 }, (_, i) => { const a = Math.PI * (1.04 + i * 0.0575); return [CX + Math.cos(a) * 66.4, RY - 0.4 + Math.sin(a) * 16.2] as Pt }), 2.4, 0.2, 0.2, 0.3) }),
    s('path', { class: 'g11-mossy', d: blob(CX - 48, RY + 13, 17, 5, seed + 6, 0.3, 12) + blob(CX + 40, RY + 16, 13, 3.6, seed + 7, 0.3, 12) + blob(CX - 30, BOT + 13, 24, 5, seed + 8, 0.3, 12) + blob(CX + 56, BOT + 6, 10, 6, seed + 9, 0.3, 12), filter: 'url(#ink-wash)' }),
    s('path', { class: 'g11-mossy t31w-drip', d: stroke([[CX - 56, RY + 13], [CX - 55, RY + 24]], 3, 0.1, 0.6, 0.2) + stroke([[CX - 40, RY + 16], [CX - 40, RY + 22]], 2.4, 0.1, 0.6, 0.2) + stroke([[CX + 44, RY + 17], [CX + 45, RY + 26]], 2.6, 0.1, 0.6, 0.2) }),
    grass(CX - 72, BOT + 14, 22, seed + 10),
    grass(CX + 68, BOT + 13, 18, seed + 11),
    kind === 'github' || bare ? '' : s('g', null, jar(CX + 88, BOT + 14, 1.5, seed + 12), jar(CX + 74, BOT + 17, 1.1, seed + 13)))
}

/** A small arc (a fish scale) opening downward at (x, y). */
function curveArc(x: number, y: number, w: number): Pt[] {
  return Array.from({ length: 7 }, (_, i) => { const a = Math.PI * (1 + i / 6); return [x + Math.cos(a) * w, y + Math.sin(a) * w * 0.45] as Pt })
}
/** A bucket handle: an arc w wide over (x, y). */
function curveArcUp(x: number, y: number, w: number): Pt[] {
  return Array.from({ length: 9 }, (_, i) => { const a = Math.PI * (1 + i / 8); return [x + Math.cos(a) * w, y + Math.sin(a) * w * 0.9] as Pt })
}


/** A rolled scroll of code standing on the rim (x, y = its foot), k ≈ height / 14, with a glyph on its wrapper. */
function scrollItem(x: number, y: number, k: number, glyph: number): SVGGElement {
  const w = 5.2 * k, hh = 13 * k
  const g = [`M${f1(x - 1.6 * k)} ${f1(y - hh * 0.62)}l${f1(1.4 * k)} ${f1(-1.6 * k)}M${f1(x - 1.6 * k)} ${f1(y - hh * 0.62)}l${f1(1.4 * k)} ${f1(1.6 * k)}M${f1(x + 1.6 * k)} ${f1(y - hh * 0.62)}l${f1(-1.4 * k)} ${f1(-1.6 * k)}M${f1(x + 1.6 * k)} ${f1(y - hh * 0.62)}l${f1(-1.4 * k)} ${f1(1.6 * k)}`, // < >
    `M${f1(x - 1.8 * k)} ${f1(y - hh * 0.7)}l${f1(1.6 * k)} ${f1(1.2 * k)}l${f1(-1.6 * k)} ${f1(1.2 * k)}M${f1(x + 0.2 * k)} ${f1(y - hh * 0.45)}h${f1(1.8 * k)}`, // >_
    `M${f1(x - 0.8 * k)} ${f1(y - hh * 0.8)}q${f1(-1.4 * k)} 0 ${f1(-1.2 * k)} ${f1(1.2 * k)}q0 ${f1(1 * k)} ${f1(-1 * k)} ${f1(1.1 * k)}q${f1(1 * k)} ${f1(0.1 * k)} ${f1(1 * k)} ${f1(1.1 * k)}q${f1(-0.2 * k)} ${f1(1.2 * k)} ${f1(1.2 * k)} ${f1(1.2 * k)}M${f1(x + 0.8 * k)} ${f1(y - hh * 0.8)}q${f1(1.4 * k)} 0 ${f1(1.2 * k)} ${f1(1.2 * k)}q0 ${f1(1 * k)} ${f1(1 * k)} ${f1(1.1 * k)}q${f1(-1 * k)} ${f1(0.1 * k)} ${f1(-1 * k)} ${f1(1.1 * k)}q${f1(0.2 * k)} ${f1(1.2 * k)} ${f1(-1.2 * k)} ${f1(1.2 * k)}`, // { }
  ][glyph % 3]
  return s('g', { class: 't31w-item' },
    s('ellipse', { class: 't31w-item-sh', cx: f1(x + 1.5 * k), cy: f1(y + 0.4), rx: f1(w * 1.2), ry: f1(1.4 * k) }),
    s('rect', { class: 'g11-card', x: f1(x - w), y: f1(y - hh), width: f1(w * 2), height: f1(hh), rx: f1(0.8 * k) }),
    s('ellipse', { class: 't31w-item-end', cx: f1(x), cy: f1(y - hh), rx: f1(w), ry: f1(1.3 * k) }),
    s('path', { class: 'g11-seal', d: stroke([[x - w, y - hh * 0.25], [x + w, y - hh * 0.25]], 1.6 * k, 0.05, 0.05, 0.4) }),
    s('path', { class: 't31w-glyph', d: g }))
}

/** The bucket, drawn about (0, 0) = where the rope ties on: a hoop handle, bamboo staves, two hoops, water at the brim. */
function bucketArt(): { g: SVGGElement; dark: SVGElement; water: SVGElement; drips: SVGElement; cargo: SVGGElement } {
  const dark = s('path', { class: 't31w-b-dark', d: 'M-21 14L21 14L18 52Q0 56 -18 52Z' })
  const water = s('ellipse', { class: 't31w-b-water', cx: 0, cy: 15.5, rx: 18, ry: 3.6 })
  const drips = s('g', { class: 't31w-b-drips' }, ...[-12, -2, 9, 15].map((x, i) => s('ellipse', { cx: x, cy: 56 + (i % 2) * 6, rx: 1.3, ry: 2.4, style: `animation-delay:${i * 0.18}s` })))
  const cargo = s('g', { class: 't31w-b-cargo' })
  let staves = ''
  for (let x = -16; x <= 16; x += 6.4) staves += stroke([[x * 1.08, 15], [x, 52]], 0.9, 0.1, 0.1, 0.3)
  const g = s('g', null,
    s('path', { class: 'g11-wash t31w-b-handle', d: stroke(Array.from({ length: 13 }, (_, i) => { const a = Math.PI * (1 + i / 12); return [Math.cos(a) * 23, 14 + Math.sin(a) * 15] as Pt }), 2.2, 0.1, 0.1, 0.5) }),
    cargo,
    s('path', { class: 't31w-b-body', d: 'M-22 14L22 14L18.5 52Q0 57 -18.5 52Z', filter: 'url(#ink-rough)' }),
    s('path', { d: 'M-22 14L22 14L18.5 52Q0 57 -18.5 52Z', fill: 'url(#p2-shade)' }),
    s('path', { class: 'g11-wash t31w-b-stave', d: staves }),
    s('path', { class: 'g11-wash t31w-b-hoop', d: stroke([[-21.5, 21], [0, 22.4], [21.5, 21]], 2.4, 0.05, 0.05, 0.6) + stroke([[-19.5, 44], [0, 45.6], [19.5, 44]], 2.4, 0.05, 0.05, 0.6) }),
    s('ellipse', { class: 't31w-b-rim', cx: 0, cy: 14, rx: 22, ry: 4.4 }),
    water,
    s('path', { class: 'g11-moonlit', d: stroke([[-19, 18], [-17, 36], [-15.5, 50]], 2.2, 0.2, 0.3, 0.2) }),
    dark, drips)
  return { g, dark, water, drips, cargo }
}

/** one well as laid out (px in the scene): centre x, svg foot `by`, svg size ww × hh (s = px per svg unit), mouth y, rim top */
type Well = { cx: number; by: number; ww: number; hh: number; s: number; my: number; rim: number }
type Geo = { W: number; H: number; tall: boolean; px: number; py: number; bs: number; beam: number; wells: Well[] }

// where the things brought up stand on a rim (svg units), and which way each one's little tag hangs (x, y: −1 / 1)
const SLOTS: [number, number, number, number][] = [[54, 119, -1, 1], [70, 105, -1, -1], [166, 119, 1, 1]]

/**
 * Scene 1 — two moss-grown wells on a stone courtyard under one pulley beam, symmetric, seen just above their mouths
 * (stacked far and near on a tall screen): code glints in the GitHub well, labelled jars sit in the Hugging Face well,
 * each well's name on a wooden plaque. The bucket hangs on its rope close to the camera (big, a little soft) with the
 * current thing on its paper tag: drag it (it swings) and let go over a well, or tap a well. The right well sends the
 * thing back up as an object that stays on that rim with a tiny tag; the wrong one sends the bucket up empty, dripping.
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
  const say = live('visually-hidden')
  const sky = h('div', { class: 't31w2-sky', 'aria-hidden': 'true' })
  const back = h('div', { class: 't31w2-back' }, night({ hills: false, moon: false }))
  const mid = s('svg', { class: 't31w2-mid', 'aria-hidden': 'true' })
  const front = s('svg', { class: 't31w2-front', 'aria-hidden': 'true' })
  const rope = s('path', { class: 't31w2-rope' })
  const shade = s('ellipse', { class: 't31w2-shade', rx: 40, ry: 7, filter: 'url(#ink-wash)' }) // the bucket's shadow on the flagstones in front
  const pulley = s('circle', { class: 't31w-pulley', r: 8 }) // it runs along the beam to the well the bucket goes down
  let pvx = 0
  const B = bucketArt()
  // the bucket is the nearest thing: its own layer, a touch out of focus
  const bucketG = s('svg', { class: 't31w2-bucket', viewBox: '-30 -14 60 76', 'aria-hidden': 'true' }, B.g)
  const flash = s('g', { class: 't31w2-flash' }, s('ellipse', { class: 't31w2-ring', cx: 0, cy: 0, rx: 40, ry: 8 }), s('ellipse', { class: 't31w2-beam', cx: 0, cy: -40, rx: 26, ry: 46, fill: 'url(#p2-lamp)' }))
  const fore = s('g', { class: 't31w2-fore' })
  front.append(shade, rope, pulley, fore)
  const tag = h('p', { class: 't31w2-tag g11-dopaper' })
  const pails = K.wells.map((w, k) => {
    const art = wellArt(w.id, 3100 + k * 40, 't31w-art', true)
    const things = art.querySelector('.t31w-items') as SVGGElement
    // the well's name on a small wooden plaque hung from the beam
    const plaque = h('p', { class: 't31w2-plaque' }, h('span', null, w.name), h('small', null, w.holds))
    // a pointer target over each well (the bucket is the keyboard's way in)
    const zone = h('button', { class: 't31w2-zone', type: 'button', tabindex: '-1', 'aria-hidden': 'true', onClick: () => !busy && drop(k) })
    return { w, art, things, plaque, zone, got: [] as { slot: number; el: HTMLElement }[] }
  })
  const bucket = h('button', { class: 't31w2-grip', type: 'button', 'aria-describedby': 't31w2-help' })
  const help = h('p', { class: 'visually-hidden', id: 't31w2-help' }, K.aria)
  const tags = h('div', { class: 't31w2-tags', 'aria-hidden': 'true' })
  const root = h('div', { class: 'g11 g11-nomoon t31w2', role: 'group', 'aria-label': K.aria },
    back, h('p', { class: 'visually-hidden' }, K.art), mid, tags, ...pails.flatMap((p) => [p.plaque, p.zone]), front, bucketG, tag, bucket, sky, help, say)
  ctx.art.append(root)

  // ── the pendulum: angle th from the vertical under the pulley, rope length len; drag sets the bucket directly
  let g: Geo | null = null
  let th = 0, om = 0, len = 0, rest = 0
  let drag: { id: number; x: number; y: number; vx: number; t: number } | null = null
  let busy = false
  // a drop in flight: well j, phase time t (s); down 0…0.7, flash 0.7…1.15, up 1.15…1.95
  let fall: { j: number; t: number; ok: boolean; x0: number; y0: number } | null = null
  const par = { x: 0, y: 0, tx: 0, ty: 0 }
  const leanTo = (j: number) => (g ? Math.atan2(g.wells[j].cx - g.px, g.wells[j].my - g.py) * 0.26 : 0)
  const place = (bx: number, by: number, k: number, dark: number) => {
    const G = g!
    const a = (-Math.atan2(bx - pvx, by - G.py) * 180) / Math.PI
    // the svg's (0, 0) is where the rope ties on: 30 × 14 px into its 60 × 76 box, scaled by bs / 46
    // drawn at its own size (sharp, then softened a touch); scaled only while it goes down a well
    const sc = G.bs / 46
    bucketG.style.transform = `translate(${f1(bx)}px, ${f1(by)}px) rotate(${f1(a)}deg)${k !== 1 ? ` scale(${k.toFixed(3)})` : ''} translate(${f1(-30 * sc)}px, ${f1(-14 * sc)}px)`
    B.dark.style.opacity = dark.toFixed(2)
    rope.setAttribute('d', `M${f1(pvx)} ${f1(G.py)}L${f1(bx)} ${f1(by)}`)
    pulley.setAttribute('cx', f1(pvx))
    bucket.style.transform = `translate(${f1(bx - G.bs * 0.6)}px, ${f1(by - G.bs * 0.05)}px)`
    // the moon is high behind: the shadow falls on the flagstones in front of the bucket, toward the camera
    const foot = by + G.bs * 1.2 * k
    const fy = Math.min(G.H * 0.97, foot + (G.H - foot) * 0.55)
    shade.setAttribute('transform', `translate(${f1(bx - G.bs * 0.12)} ${f1(fy)}) scale(${((G.bs / 64) * k).toFixed(3)})`)
    shade.style.opacity = (0.3 * (1 - dark)).toFixed(2)
    // the tag hangs off the bucket's side, inside the frame (the left on a tall screen, where the near well's rim things are right)
    tag.style.transform = G.tall
      ? `translate(${f1(bx - G.bs * 0.5 * k - 4)}px, ${f1(by + G.bs * 0.42 * k)}px) translateX(-100%) rotate(3deg) scale(${Math.max(0.5, k).toFixed(3)})`
      : `translate(${f1(bx + G.bs * 0.5 * k)}px, ${f1(by + G.bs * 0.62 * k)}px) rotate(-4deg) scale(${Math.max(0.5, k).toFixed(3)})`
  }
  const loop = createLoop(root, (_t, dt) => {
    if (!g) return false
    const d = Math.min(dt, 0.05)
    let moving = false
    // parallax: back drifts least, the bucket layer most
    par.x += (par.tx - par.x) * Math.min(1, d * 5)
    par.y += (par.ty - par.y) * Math.min(1, d * 5)
    back.style.transform = `translate(${f1(par.x * -5)}px, ${f1(par.y * -3)}px)`
    front.style.transform = `translate(${f1(par.x * 7)}px, ${f1(par.y * 4)}px)`
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
    const bx = g.px + Math.sin(th) * len, by = g.py + Math.cos(th) * len
    place(bx, by, 1, 0)
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
    let wells: Well[], beam: number, bs: number, tie: number
    if (tall) {
      // stacked: the far well up on the left, the near one lower on the right, the bucket in front at the foot
      beam = H * 0.13
      const far = mk(W * 0.38, W * 0.98, H * 0.235)
      const near = mk(W * 0.62, W * 1.06, far.by - far.hh * 0.08)
      wells = [far, near]
      bs = clamp(W * 0.27, 70, 120)
      tie = near.by - near.hh * 0.25
    } else {
      // side by side, big, the bucket hanging between and in front of them
      const ww = clamp(Math.min(W * 0.37, H * 0.74), 160, 520)
      beam = H * 0.13
      const rim = Math.max(beam + 92, H * 0.265)
      wells = [W / 2 - ww * 0.565, W / 2 + ww * 0.565].map((cx) => mk(cx, ww, rim))
      bs = clamp(Math.min(ww * 0.48, H * 0.34), 80, 250)
      tie = wells[0].by - wells[0].hh * 0.7
    }
    g = { W, H, tall, px: tall ? W * 0.6 : W / 2, py: beam + 6, bs, beam, wells }
    tag.style.maxWidth = tall ? `${f1(g.px - bs * 0.5 - 14)}px` : ''
    pvx = g.px
    pulley.setAttribute('cy', f1(g.py))
    pulley.setAttribute('r', f1(tall ? 6 : clamp(W * 0.007, 6, 11)))
    rest = tie - g.py
    len ||= rest
    Object.assign(bucketG.style, { width: `${f1((60 * bs) / 46)}px`, height: `${f1((76 * bs) / 46)}px` })
    paint(W, H, tall)
    // the wells, their plaques, the pointer zones (the near well's on top)
    pails.forEach((p, k) => {
      const w = wells[k]
      p.art.setAttribute('x', f1(w.cx - w.ww / 2))
      p.art.setAttribute('y', f1(w.by - w.hh))
      p.art.setAttribute('width', f1(w.ww))
      p.art.setAttribute('height', f1(w.hh))
      ;(p.art.querySelector('.t31w-warm') as SVGElement).setAttribute('cx', String(tall ? (k ? 58 : 162) : k ? 162 : 58))
      // hung from the beam over the well (desktop); on a tall screen the far one hangs right of its well, the near one
      // stands on a stake left of its well
      const pw = tall ? 112 : clamp(w.ww * 0.36, 120, 190)
      const px = tall ? (k ? 8 : W - pw - 6) : w.cx - pw / 2 + w.ww * 0.1
      const top = tall ? (k ? w.rim - 18 : beam + 18) : beam + 16
      Object.assign(p.plaque.style, { transform: `translate(${f1(px)}px, ${f1(top)}px)`, width: `${f1(pw)}px` })
      p.plaque.style.setProperty('--cord', `${f1(top - beam - 4)}px`)
      p.plaque.classList.toggle('stake', tall && k === 1)
      p.plaque.style.setProperty('--stake', `${f1(w.by - w.hh * 0.18 - top)}px`)
      const dw = 134 * w.s // the drum
      Object.assign(p.zone.style, { transform: `translate(${f1(w.cx - dw / 2)}px, ${f1(w.rim - 10)}px)`, width: `${f1(dw)}px`, height: `${f1(w.by - w.hh * 0.12 - w.rim + 10)}px` })
      p.got.forEach(({ slot, el }) => tagAt(el, w, slot, W))
    })
    bucket.style.width = bucket.style.height = `${f1(bs * 1.2)}px`
    settle()
  }
  /** a placed thing's tiny tag, beside it on the rim (px) */
  function tagAt(el: HTMLElement, w: Well, slot: number, W: number) {
    const [x, y, dx, dy] = SLOTS[slot]
    const X = w.cx - w.ww / 2 + x * w.s, Y = w.by - w.hh + (y - 92) * w.s
    const tw = +(el.dataset.w ||= String(el.offsetWidth)) // read once, when it is first placed
    const left = clamp(dx < 0 ? X - 6 * w.s - tw : X + 6 * w.s, 6, W - tw - 6)
    el.style.transform = `translate(${f1(left)}px, ${f1(dy > 0 ? Y + 2 * w.s : Y - 24 * w.s)}px)${dy < 0 ? ' translateY(-100%)' : ''}`
  }

  /** the courtyard, the pulley beam on two posts with a lantern each, foreground stones (px, drawn per layout) */
  function paint(W: number, H: number, tall: boolean) {
    mid.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    front.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    const G = g!
    const r = rng(3171)
    const w0 = G.wells[0], wN = G.wells[G.wells.length - 1]
    const hz = w0.by - w0.hh * (tall ? 1.05 : 1.15) // where the courtyard melts into mist
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
    for (const [x, w0r, h0] of [[0.1, 0.11, 0.05], [0.2, 0.08, 0.04], [0.82, 0.12, 0.055], [0.93, 0.07, 0.035]]) {
      const cx = W * x, ww0 = W * w0r, hh0 = H * h0
      roofs += `M${f1(cx - ww0 / 2)} ${f1(hz)}L${f1(cx - ww0 * 0.42)} ${f1(hz - hh0 * 0.55)}Q${f1(cx)} ${f1(hz - hh0 * 1.1)} ${f1(cx + ww0 * 0.42)} ${f1(hz - hh0 * 0.55)}L${f1(cx + ww0 / 2)} ${f1(hz)}Z`
    }
    for (let x = W * 0.02; x < W * 0.3; x += 7 + r() * 5) fence += stroke([[x, hz + 2], [x + (r() - 0.5) * 2, hz - 12 - r() * 8]], 2.4, 0.04, 0.1, 0.5)
    // the beam on two posts standing on the flagstones beside the wells, a paper lantern hung inside each post
    const postX = tall ? [W * 0.045, W * 0.955] : [w0.cx - w0.ww * 0.5, wN.cx + wN.ww * 0.5]
    const postB = tall ? w0.by - w0.hh * 0.05 : w0.by - w0.hh * 0.16
    const pw = tall ? 9 : clamp(W * 0.009, 9, 15)
    const posts = postX.map((x, k) => bamboo([x, postB + 6], [x + (k ? -2 : 2), G.beam - 8], pw, 3180 + k, 60))
    const beam = bamboo([postX[0] - 12, G.beam + 4], [postX[1] + 12, G.beam], tall ? 10 : clamp(W * 0.01, 10, 16), 3182, 90)
    const lr = tall ? 9 : clamp(W * 0.012, 10, 18)
    const lamps = postX.map((x, k) => {
      const lx = x + (k ? -1 : 1) * lr * 2.4, ly = G.beam + (postB - G.beam) * (tall ? 0.18 : 0.3)
      // its warm pool on the flagstones below (and a little toward the camera)
      const fy = postB + lr * 1.4
      return s('g', { class: 't31w2-lamp' },
        s('ellipse', { class: 't31w2-pool', cx: f1(lx), cy: f1(fy), rx: f1(lr * 9), ry: f1(lr * 2.2), fill: 'url(#p2-lamp)' }),
        s('ellipse', { class: 't31w2-pool2', cx: f1(lx), cy: f1(fy), rx: f1(lr * 3.6), ry: f1(lr * 0.9) }),
        s('path', { class: 'g11-wood-ink', d: stroke([[x, ly - lr * 1.9], [lx, ly - lr * 1.9]], 2.4, 0.1, 0.1, 0.5) }),
        paperLantern(lx, ly - lr * 1.9, lr, 3190 + k, lr * 0.8))
    })
    // each well throws its shadow forward and a little left (the moon is high behind, on the right)
    const shadows = G.wells.map((w, k) => wash(blob(w.cx - w.ww * 0.1, w.by + w.hh * 0.06, w.ww * 0.34, w.hh * 0.13, 3200 + k, 0.16), 0.3, 'p2p-wash t31w2-cast'))
    const mr = tall ? 14 : clamp(W * 0.019, 18, 30)
    mid.replaceChildren(
      moon(tall ? W * 0.86 : W * 0.82, tall ? H * 0.055 : Math.max(mr * 1.6, G.beam - mr * 1.5), mr, 3167, true),
      hills(-W * 0.1, W * 1.1, hz + 4, H * 0.2, 3168, 0.9, 5),
      mist(W * 0.5, hz - H * 0.06, W * 0.7, H * 0.08),
      hills(-W * 0.05, W * 0.55, hz + 6, H * 0.1, 3169, 0.55, 2),
      s('path', { class: 't31w2-roofs', d: roofs, filter: 'url(#ink-wash)' }),
      s('path', { class: 'g11-bamboo-culm t31w2-fence', d: fence }),
      mist(W * 0.5, hz + 4, W * 0.75, H * 0.05),
      s('ellipse', { class: 't31w2-floor', cx: f1(W / 2), cy: f1((hz + H) / 2 + (H - hz) * 0.1), rx: f1(W * 0.62), ry: f1((H - hz) * 0.62), fill: 'url(#p2-halo)' }),
      s('path', { class: 'g11-wash t31w2-dark', d: dark.join(''), filter: 'url(#ink-wash)' }),
      ...grout.map((d, k) => s('path', { class: `t31w2-grout t31w2-c${k}`, d })),
      ...joints.map((d, k) => s('path', { class: `g11-wash t31w2-joint t31w2-c${k}`, d })),
      s('path', { class: 'g11-mossy t31w2-moss', d: moss.join('') }),
      ...lamps, ...shadows,
      ...posts, beam,
      ...pails.map((p) => p.art),
      flash)
    // the near corners: mossy boulders cut by the frame, lit along their crowns, grass in front
    const nb = tall ? W * 0.34 : clamp(W * 0.13, 90, 210)
    const corner = (x: number, sd: number, flip: boolean) => s('g', { class: 't31w2-near', transform: `translate(${f1(x)} ${f1(H - nb * 0.04)})${flip ? ' scale(-1 1)' : ''}` },
      stoneArt(nb * 1.6, nb * 0.7, sd),
      s('path', { class: 'g11-mossy t31w2-nearmoss', d: blob(-nb * 0.14, -nb * 0.56, nb * 0.36, nb * 0.08, sd + 1, 0.3, 12) + blob(nb * 0.32, -nb * 0.4, nb * 0.22, nb * 0.06, sd + 2, 0.3, 10) + blob(-nb * 0.55, -nb * 0.2, nb * 0.16, nb * 0.07, sd + 5, 0.3, 10), filter: 'url(#ink-wash)' }),
      grass(-nb * 0.2, -nb * 0.06, nb * 0.5, sd + 3), grass(nb * 0.5, 0, nb * 0.4, sd + 4))
    fore.replaceChildren(corner(W * 0.075, 3210, false), corner(W * 0.93, 3220, true))
  }
  ctx.onCleanup(onSize(root, layout))

  // ── the current thing on the bucket's tag, the bucket's own name for keyboards and screen readers
  function showItem() {
    const it = items[i]
    tag.replaceChildren(it ? it.label : K.done)
    tag.classList.remove('bad')
    tag.hidden = !it
    bucket.setAttribute('aria-label', it ? fill(K.itemAria, { item: it.aria, well: K.wells[sel].name }) : K.done)
    B.cargo.replaceChildren()
  }
  function drop(j: number) {
    const it = items[i]
    if (!it || busy || !g) return
    sel = j
    busy = true
    const ok = it.well === K.wells[j].id
    ctx.chime('soft')
    const bx = g.px + Math.sin(th) * len, by = g.py + Math.cos(th) * len
    fall = { j, t: 0, ok, x0: bx, y0: by }
    if (ok) B.cargo.replaceChildren(K.wells[j].id === 'github' ? scrollItem(0, 18, 1.6, i) : jar(0, 18, 1.4, 3300 + i))
    B.drips.classList.toggle('on', !ok)
    B.water.style.opacity = ok ? '1' : '0'
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
      // say why: what that well holds (H6)
      const why = (K.wrongIn as Record<string, string>)[K.wells[j].id] ?? K.wrong
      ctx.chime('low')
      tag.replaceChildren(why)
      tag.classList.add('bad')
      say.say(why)
      ctx.prompt(why, 'wrong')
      later(() => B.drips.classList.remove('on'), 1600)
      settle()
      return
    }
    ctx.chime('tap')
    const it = items[i]
    const p = pails[j]
    // the thing stays on that well's rim with a tiny tag of its name
    const slot = p.got.length % SLOTS.length
    const [x, y] = SLOTS[slot]
    p.things.append(K.wells[j].id === 'github' ? scrollItem(x, y, 1.7, i) : jar(x, y, 1.35 + (slot % 2) * 0.2, 3300 + i))
    const el = h('span', { class: `t31w2-itag${SLOTS[slot][3] < 0 ? ' up' : ''}` }, it.tag)
    tags.append(el)
    p.got.push({ slot, el })
    tagAt(el, g.wells[j], slot, g.W)
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
    // a keyboard Enter / Space, or a tap that did not move: drop into the well it leans to
    if (e.detail === 0) drop(sel)
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

  showItem()
  ctx.prompt(K.prompt)
  // H1: a dot on the bucket's grip until the first need is met (it rides with the bucket)
  let dot: Mark | null = guide(ctx).dot(bucket, { dir: [0, 1] })
}
