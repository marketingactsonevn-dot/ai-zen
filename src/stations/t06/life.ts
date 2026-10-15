import { fill, h, nextId, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import { createLoop } from '../../core/loop'
import { cssVar } from '../../core/prefs'
import type { SceneCtx } from '../types'
import { blob, brush, C, clamp, defs, ell, layer, onSize, onTheme, passFocus, place, rng, sheet, spline, stableHeight, stone, type Pt } from './ink'

const L = C.scenes.life

/* ───────── The tree, in its own 400 × 400 space (trunk base at 198, 324) ───────── */
interface St { pts: Pt[]; w: number; t0: number; t1: number; a?: number; b?: number; min?: number }
const BASE: Pt = [198, 324]
const TRUNK: St = { pts: [[198, 326], [193, 298], [200, 270], [218, 244], [214, 214], [197, 190], [192, 166], [203, 142], [218, 122], [231, 102], [243, 84]], w: 30, t0: 0, t1: 0.62, a: 0.02, b: 0.96, min: 0.15 }
const WOOD: St[] = [
  TRUNK,
  { pts: [[194, 319], [176, 323], [157, 330], [138, 335]], w: 10, t0: 0.04, t1: 0.3, a: 0.05, b: 0.8 },
  { pts: [[203, 319], [223, 323], [244, 330], [264, 333]], w: 9, t0: 0.05, t1: 0.32, a: 0.05, b: 0.8 },
  { pts: [[206, 262], [180, 257], [152, 261], [124, 255], [96, 246]], w: 12, t0: 0.3, t1: 0.6, a: 0.03, b: 0.9, min: 0.22 },
  { pts: [[152, 261], [140, 270], [124, 274]], w: 4.5, t0: 0.42, t1: 0.6 },
  { pts: [[215, 238], [242, 229], [272, 231], [300, 222], [328, 213]], w: 11, t0: 0.34, t1: 0.64, a: 0.03, b: 0.9, min: 0.22 },
  { pts: [[272, 231], [284, 241], [300, 243]], w: 4, t0: 0.46, t1: 0.66 },
  { pts: [[199, 188], [176, 177], [152, 176], [128, 166], [108, 158]], w: 8, t0: 0.4, t1: 0.72, a: 0.04, b: 0.9, min: 0.22 },
  { pts: [[196, 163], [224, 158], [250, 149], [274, 141]], w: 7, t0: 0.46, t1: 0.76, a: 0.04, b: 0.9, min: 0.22 },
]
/** foliage cloud-pads: centre, radii, growth window */
const PADS = [
  { c: [100, 232], r: [64, 22], t: [0.45, 0.74] },
  { c: [150, 250], r: [30, 11], t: [0.5, 0.74] },
  { c: [298, 204], r: [58, 21], t: [0.5, 0.8] },
  { c: [124, 146], r: [48, 18], t: [0.6, 0.86] },
  { c: [268, 129], r: [42, 16], t: [0.64, 0.88] },
  { c: [238, 70], r: [54, 25], t: [0.7, 0.96] },
] as const
/** the three unruly shoots pre-training leaves; fine-tuning cuts them */
const SHOOTS = [
  { pts: [[246, 84], [262, 64], [276, 48], [296, 34], [322, 20]] as Pt[], cut: [282, 44] as Pt, lab: [334, 6] as Pt, twigs: [[[296, 34], [306, 41], [318, 41]], [[262, 64], [255, 50]]] as Pt[][], tufts: [[322, 19, 13, 7], [300, 33, 9, 5], [256, 49, 8, 5]] },
  { pts: [[316, 220], [338, 232], [360, 241], [382, 252], [398, 268]] as Pt[], cut: [336, 231] as Pt, lab: [384, 286] as Pt, twigs: [[[360, 241], [368, 228]], [[382, 252], [393, 247]]] as Pt[][], tufts: [[398, 268, 12, 7], [368, 226, 9, 5]] },
  { pts: [[134, 258], [114, 272], [90, 284], [66, 290], [42, 302]] as Pt[], cut: [118, 270] as Pt, lab: [48, 324] as Pt, twigs: [[[90, 284], [83, 298]], [[66, 290], [58, 279]]] as Pt[][], tufts: [[42, 302, 13, 7], [83, 300, 8, 5], [58, 277, 8, 5]] },
]
const BLOSSOMS: Pt[] = [[212, 56], [234, 49], [256, 57], [222, 74], [250, 76], [271, 67]]
const ASK_AT: Pt = [326, 352]
const SHEARS_REST: Pt = [350, 350]
const WORDS = ['chữ', 'sông', 'the', 'và', 'code', 'mưa', 'of', 'học', 'data', 'yêu', 'nhà', 'is', '=', '{ }', '1+1', 'là', 'river', 'ánh', 'sáng', 'print', 'gió', 'a', 'ơi', '→', 'tree', 'đá', 'sách', 'web', 'trăng', 'if', 'phố', 'mây']

const ease = (t: number) => 1 - (1 - t) ** 3
const prog = (G: number, t0: number, t1: number) => clamp((G - t0) / (t1 - t0), 0, 1)
const tf = (c: Pt, k: number) => `translate(${c[0]} ${c[1]}) scale(${k.toFixed(4)}) translate(${-c[0]} ${-c[1]})`

/**
 * One cloud-pad of pine, painted: a bleeding halo, overlapping translucent moss washes (overlaps darken like layered ink),
 * a darker flat underside, light on the top-left bumps, and fans of needles in rough and dry brush on the rim.
 */
function pad(cx: number, cy: number, rx: number, ry: number, seed: number) {
  const r = rng(seed)
  const g = s('g')
  g.append(s('path', { class: 'm', 'fill-opacity': 0.12, d: blob(cx, cy + ry * 0.05, rx * 1.16, ry * 1.36, seed, 0.18), filter: 'url(#ink-wash)' }))
  const n = Math.max(3, Math.round(rx / 13))
  const puffs = Array.from({ length: n }, (_, k) => {
    const u = -0.76 + (1.52 * k) / (n - 1) + (r() - 0.5) * 0.08
    const hgt = (1 - u * u) ** 0.6
    const R = rx * (0.22 + 0.12 * hgt + r() * 0.05)
    return { x: cx + u * rx, y: cy - ry * (0.02 + 0.34 * hgt) + (r() - 0.5) * ry * 0.14, R, Ry: R * (ry / rx) * 2.05 }
  })
  const wash = s('g', { filter: 'url(#ink-wash)' })
  wash.append(s('path', { class: 'md', 'fill-opacity': 0.5, d: blob(cx, cy + ry * 0.28, rx * 0.95, ry * 0.46, seed + 1, 0.1) }))
  puffs.forEach((p, k) => wash.append(s('path', { class: 'm', 'fill-opacity': (0.36 + r() * 0.14).toFixed(2), d: blob(p.x, p.y, p.R, p.Ry, seed * 13 + k, 0.14, 16) })))
  wash.append(s('path', { class: 'm', 'fill-opacity': 0.42, d: blob(cx, cy + ry * 0.1, rx * 0.84, ry * 0.5, seed + 2, 0.1) }))
  const hi = s('g', { class: 'm2', filter: 'url(#ink-wash)' })
  puffs.forEach((p, k) => k % 2 === 0 && hi.append(s('path', { 'fill-opacity': 0.3, d: blob(p.x - p.R * 0.3, p.y - p.Ry * 0.35, p.R * 0.48, p.Ry * 0.32, seed * 17 + k, 0.2, 12) })))
  // pine needles: little radiating bursts painted all over the mass (denser and darker low down), a few hanging from the lip
  let fanD = ''
  let dryD = ''
  const nf = Math.max(5, Math.round(rx / 4.2))
  for (let i = 0; i < nf; i++) {
    const p = puffs[Math.floor(r() * n)]
    const hang = i % 6 === 5
    const ang = r() * Math.PI * 2
    const dist = Math.sqrt(r()) * 0.8
    const bx = hang ? p.x + (r() - 0.5) * p.R * 1.4 : p.x + Math.cos(ang) * p.R * dist
    const by = hang ? cy + ry * (0.42 + r() * 0.12) : p.y + Math.sin(ang) * p.Ry * dist * 0.8 + p.Ry * 0.1
    const a0 = hang ? 90 + (r() - 0.5) * 50 : -90 + (bx - cx) / rx * 40 + (r() - 0.5) * 30
    const k = hang ? 4 + Math.floor(r() * 2) : 6 + Math.floor(r() * 4)
    const spread = hang ? 60 : 140 + r() * 30
    const len = ry * (hang ? 0.26 + r() * 0.12 : 0.32 + r() * 0.2)
    let d = ''
    for (let j = 0; j < k; j++) {
      const a = ((a0 + (j / (k - 1) - 0.5) * spread + (r() - 0.5) * 10) * Math.PI) / 180
      const l = len * (0.75 + r() * 0.4)
      d += brush([[bx, by], [bx + Math.cos(a) * l, by + Math.sin(a) * l]], 1.1 + r() * 0.6, { a: 0.05, b: 0.85, min: 0.1, wob: 0 }).d
    }
    if (i % 3 === 1) dryD += d
    else fanD += d
  }
  g.append(wash, hi,
    s('path', { class: 'md', 'fill-opacity': 0.8, d: fanD, filter: 'url(#ink-rough)' }),
    s('path', { class: 'md', 'fill-opacity': 0.85, d: dryD, filter: 'url(#ink-dry)' }))
  return g
}

/** The mossy rock the tree grows on (ishitsuki): a low mound, shaded right, dry-brush cracks, moss at the roots. */
function mound(grad: string) {
  const topPts: Pt[] = [[104, 347], [118, 337], [138, 328], [163, 322], [188, 318], [212, 317.5], [238, 320.5], [262, 326], [284, 334], [304, 347]]
  const top = spline(topPts)
  const d = `M${top.map((p) => p.map((n) => n.toFixed(1)).join(' ')).join('L')}Q258 352 204 352.5Q150 352 104 347Z`
  const r = rng(8)
  const moss = s('g', { class: 'm', filter: 'url(#ink-rough)' })
  for (let k = 0; k < 34; k++) {
    const x = 150 + r() * 112
    const yTop = 318 + ((x - 205) / 100) ** 2 * 26
    moss.append(s('path', { d: ell(x, yTop + 1 + r() * 4, 1.2 + r() * 2.6, 0.8 + r() * 1.2), 'fill-opacity': (0.45 + r() * 0.45).toFixed(2) }))
  }
  return s('g', null,
    s('path', { class: 't6-sh', 'fill-opacity': 0.16, d: ell(206, 350, 116, 7), filter: 'url(#ink-wash)' }),
    s('path', { d, fill: `url(#${grad})`, filter: 'url(#ink-rough)' }),
    s('path', { class: 't6-sh', 'fill-opacity': 0.1, d: blob(206, 346, 92, 6, 2, 0.15), filter: 'url(#ink-wash)' }),
    s('path', { class: 't6-sh', 'fill-opacity': 0.16, d: blob(266, 339, 40, 10, 3, 0.2), filter: 'url(#ink-wash)' }),
    s('path', { class: 't6-sh', 'fill-opacity': 0.07, d: blob(146, 340, 30, 7, 6, 0.2), filter: 'url(#ink-wash)' }),
    s('g', { class: 't6-sh', 'fill-opacity': 0.5, filter: 'url(#ink-dry)' },
      s('path', { d: brush([[132, 336], [156, 331], [176, 333]], 3.2, { a: 0.2, b: 0.5 }).d }),
      s('path', { d: brush([[232, 330], [254, 335], [274, 343]], 3.6, { a: 0.2, b: 0.5 }).d }),
      s('path', { d: brush([[178, 344], [206, 345], [236, 343]], 2.6, { a: 0.3, b: 0.4 }).d })),
    s('path', { class: 't6-sh', 'fill-opacity': 0.62, d: brush(top.slice(0, Math.round(top.length * 0.62)), 2.8, { a: 0.06, b: 0.5 }).d, filter: 'url(#ink-rough)' }),
    s('path', { class: 't6-sh', 'fill-opacity': 0.5, d: brush([[112, 348], [160, 352.4], [214, 352.8], [262, 351], [300, 347.5]], 2.2, { a: 0.1, b: 0.3 }).d }),
    moss)
}

/** Hand shears in ink, pivot at (0, 0), blades pointing +x. Returns the group and the two blades. */
function shears() {
  const bladeA = s('g', null,
    s('path', { class: 'k', d: 'M0 -1.2Q16 -7 34 -2.2Q20 1 0 1.4Z', filter: 'url(#ink-rough)' }),
    s('path', { class: 'k', d: brush([[-2, 0], [-10, -6], [-20, -10]], 3).d }),
    s('path', { class: 'k', 'fill-opacity': 0.85, d: brush([[-20, -10], [-30, -17], [-34, -10], [-26, -4], [-20, -10]], 2.6, { a: 0.1, b: 0.1, min: 0.6 }).d }))
  const bladeB = s('g', null,
    s('path', { class: 'k2', d: 'M0 1.2Q16 7 34 2.2Q20 -1 0 -1.4Z', filter: 'url(#ink-rough)' }),
    s('path', { class: 'k2', d: brush([[-2, 0], [-10, 6], [-20, 10]], 3).d }),
    s('path', { class: 'k2', 'fill-opacity': 0.85, d: brush([[-20, 10], [-30, 17], [-34, 10], [-26, 4], [-20, 10]], 2.6, { a: 0.1, b: 0.1, min: 0.6 }).d }))
  const g = s('g', { class: 't6l-shears' }, bladeB, bladeA, s('circle', { class: 'v', r: 2 }))
  return { g, bladeA, bladeB }
}

/** Scene 1 — the bonsai lifecycle: rain of words (pre-training) → pruning by people and principles (fine-tuning) → the shaped tree answers (inference). */
export function lifeScene(ctx: SceneCtx) {
  const stable = stableHeight(ctx, L.insights.map((x) => x.text))
  const svg = layer()
  const g = defs(svg)
  const canvas = h('canvas', { class: 't6l-rain', 'aria-hidden': 'true' })
  const root = h('div', { class: 't6 t6l' }, h('p', { class: 'visually-hidden' }, L.art), svg, canvas)
  ctx.art.append(root)

  /* ── world (tree space) ── */
  const world = s('g')
  const sand = s('g', { class: 't6l-sand' })
  for (const [rx, ry] of [[128, 24], [162, 31], [198, 38], [236, 46], [276, 54]]) {
    sand.append(s('path', { class: 'rake-hi', d: ell(206, 347, rx, ry), transform: 'translate(0 1.6)' }), s('path', { class: 'rake', d: ell(206, 347, rx, ry) }))
  }
  const soak = s('path', { class: 'k', d: blob(206, 336, 118, 20, 5, 0.12), filter: 'url(#ink-wash)', 'fill-opacity': 0.04 })

  // the library cloud: layered washes holding rows of tiny writing, soft at the edges
  const cloud = s('g', { class: 't6l-cloud' })
  const fadeId = nextId('t6lf')
  cloud.append(s('defs', null,
    s('radialGradient', { id: `${fadeId}-g`, cx: 0.5, cy: 0.5, r: 0.5 }, s('stop', { offset: 0.55, 'stop-color': '#fff' }), s('stop', { offset: 1, 'stop-color': '#000' })),
    s('mask', { id: fadeId, maskUnits: 'userSpaceOnUse', x: 10, y: -4, width: 380, height: 92 }, s('rect', { x: 10, y: -4, width: 380, height: 92, fill: `url(#${fadeId}-g)` }))))
  for (const [cx, cy, rx, ry, op, sd] of [[200, 42, 178, 36, 0.045, 9], [150, 36, 110, 26, 0.035, 3], [262, 48, 104, 22, 0.035, 5]]) {
    cloud.append(s('path', { class: 'k', 'fill-opacity': op, d: blob(cx, cy, rx, ry, sd, 0.16), filter: 'url(#ink-wash)' }))
  }
  const cr = rng(31)
  const rows = s('g', { class: 'k3 t6l-rows', mask: `url(#${fadeId})` })
  for (let i = 0; i < 7; i++) {
    let str = ''
    while (str.length < 120) str += WORDS[Math.floor(cr() * WORDS.length)] + ' '
    rows.append(s('text', { x: 10 - cr() * 30, y: 14 + i * 9.6, 'font-size': 7 }, str))
  }
  cloud.append(rows)

  const rock = mound(g.stone)

  // the growing tree
  const grow = s('g')
  const woodMask = s('mask', { id: nextId('t6lm'), maskUnits: 'userSpaceOnUse', x: -60, y: -60, width: 520, height: 520 })
  const wood = s('g', { mask: `url(#${woodMask.id})` })
  const woodInk = s('g', { filter: 'url(#ink-rough)' })
  const woodDry = s('g', { filter: 'url(#ink-rough)' })
  const bark = s('g', { class: 'hl', 'fill-opacity': 0.38, filter: 'url(#ink-dry)' })
  const woodWash = s('g', { class: 'w2', 'fill-opacity': 0.26, filter: 'url(#ink-wash)' })
  wood.append(woodWash, woodInk, woodDry, bark)
  const reveals = WOOD.map((w) => {
    const b = brush(w.pts, w.w, { a: w.a ?? 0.08, b: w.b ?? 0.6, min: w.min ?? 0.18 })
    // the trunk and the thick limbs: a dry, streaky body over a soft grey wash; the thin twigs: one rough stroke
    if (w.w > 8) {
      woodWash.append(s('path', { d: brush(w.pts, w.w * 1.3, { a: w.a ?? 0.08, b: w.b ?? 0.6, min: 0.3 }).d }))
      woodInk.append(s('path', { class: 'w2', 'fill-opacity': 0.72, d: b.d }))
      // the shadow half of the limb, a second pass of darker ink
      woodDry.append(s('path', { class: 'w2', 'fill-opacity': 0.75, d: brush(w.pts.map(([x, y]) => [x + w.w * 0.2, y + w.w * 0.06] as Pt), w.w * 0.55, { a: w.a ?? 0.08, b: w.b ?? 0.6, min: w.min ?? 0.18 }).d }))
    } else woodInk.append(s('path', { class: 'w2', 'fill-opacity': 0.9, d: b.d }))
    const full = w.w * 1.7 + 6
    const m = s('path', { class: 't6-mask', d: b.c, 'stroke-width': full, pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1 })
    woodMask.append(m)
    return { m, w, full }
  })
  // bark: pale dry-brush streaks down the trunk (paper showing through), a few dark knots
  const tr = TRUNK.pts
  const br = rng(64)
  for (let k = 0; k < 4; k++) {
    const off = -8 + k * 3 + (br() - 0.5) * 2
    const from = Math.floor(br() * 3), to = 4 + Math.floor(br() * 5)
    bark.append(s('path', { d: brush(tr.slice(from, to).map(([x, y], i) => [x + off * (1 - i * 0.08), y] as Pt), 3 + br() * 4, { a: 0.25, b: 0.45, min: 0.2 }).d }))
  }
  for (const [x, y, rx] of [[196, 214, 1.8], [212, 248, 1.5]] as const) {
    woodInk.append(s('path', { class: 'w2', 'fill-opacity': 0.6, d: blob(x, y, rx, rx * 1.4, x, 0.2, 10) }))
  }

  const shootEls = SHOOTS.map((sh, i) => {
    const mask = s('mask', { id: nextId('t6ls'), maskUnits: 'userSpaceOnUse', x: -60, y: -60, width: 520, height: 520 })
    const inner = s('g', { mask: `url(#${mask.id})` })
    const ink = s('g', { filter: 'url(#ink-rough)' })
    const b = brush(sh.pts, 4.2, { a: 0.05, b: 0.7, min: 0.2 })
    ink.append(s('path', { class: 'w2', d: b.d }))
    // the reveal runs a little past the tip, so the end tuft is never cut off
    const [p1, p2] = sh.pts.slice(-2)
    const ext: Pt = [p2[0] + (p2[0] - p1[0]) * 0.9, p2[1] + (p2[1] - p1[1]) * 0.9]
    const m = s('path', { class: 't6-mask', d: brush([...sh.pts, ext], 1).c, 'stroke-width': 46, pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1 })
    mask.append(m)
    for (const tw of sh.twigs) ink.append(s('path', { class: 'w2', d: brush(tw, 2.2, { a: 0.1, b: 0.6 }).d }))
    inner.append(ink)
    sh.tufts.forEach(([x, y, rx, ry], k) => inner.append(pad(x, y, rx, ry, 40 + i * 5 + k)))
    const wrap = s('g', null, mask, inner)
    return { wrap, m }
  })
  const pads = PADS.map((p, i) => {
    const el = pad(p.c[0], p.c[1], p.r[0], p.r[1], 11 + i * 3)
    return { el, p, anchor: [p.c[0], p.c[1] + p.r[1]] as Pt }
  })
  const blossoms = s('g', { class: 't6l-bloom' })
  const blooms = BLOSSOMS.map(([x, y], i) => {
    const b = s('g', { transform: tf([x, y], 0), opacity: 0 })
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + i
      b.append(s('path', { class: 'v', 'fill-opacity': 0.82, d: ell(x + Math.cos(a) * 3.3, y + Math.sin(a) * 3.3, 2.3, 2.3) }))
    }
    b.append(s('path', { class: 'v', d: ell(x, y, 1.9) }), s('path', { class: 'p', 'fill-opacity': 0.9, d: ell(x, y, 0.8) }))
    blossoms.append(b)
    return b
  })
  const lightPath = [ASK_AT, [292, 348], [252, 340], [214, 330], ...TRUNK.pts.slice(0, -1), [249, 74]] as Pt[]
  const light = s('path', { class: 't6l-light', d: brush(lightPath, 1).c, pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1 })
  const bead = s('circle', { class: 't6l-bead', r: 3.2, opacity: 0 })
  grow.append(...shootEls.map((x) => x.wrap), woodMask, wood, ...pads.map((x) => x.el), blossoms, light, bead)

  // sapling: what the visitor sees before it rains
  const sapling = s('g', { filter: 'url(#ink-rough)' },
    s('path', { class: 'w2', d: brush([[198, 326], [197, 312], [200, 300]], 3.4, { a: 0.05, b: 0.6 }).d }),
    s('path', { class: 'm', d: blob(191, 302, 8, 3.4, 3, 0.1), transform: 'rotate(-22 191 302)' }),
    s('path', { class: 'm', 'fill-opacity': 0.8, d: blob(207, 297, 7.5, 3.2, 4, 0.1), transform: 'rotate(24 207 297)' }))

  // the question stone (stage 3)
  const askStone = s('g', { opacity: 0 }, stone(ASK_AT[0], ASK_AT[1], 24, 9, g.stone, 21, 7),
    s('path', { class: 'v', 'fill-opacity': 0.9, d: brush([[ASK_AT[0] - 4, ASK_AT[1] - 3], [ASK_AT[0] - 1, ASK_AT[1] - 6], [ASK_AT[0] + 3, ASK_AT[1] - 4], [ASK_AT[0] + 1, ASK_AT[1] - 1], [ASK_AT[0] + 0.5, ASK_AT[1] + 1]], 1.6, { a: 0.2, b: 0.2, min: 0.5 }).d }),
    s('circle', { class: 'v', cx: ASK_AT[0] + 0.5, cy: ASK_AT[1] + 3.2, r: 0.9 }))
  const sh = shears()
  const shearsG = s('g', { opacity: 0 }, sh.g)
  const cloudWrap = s('g', null, cloud)
  world.append(sand, soak, cloudWrap, rock, grow, sapling, askStone, shearsG)

  /* ── the principles scroll (screen space; unrolls in stage 2) ── */
  const clipId = nextId('t6lc')
  const clipRect = s('rect', { x: -10, y: 0, width: 140, height: 0 })
  const ruleEls = L.rules.map((t, i) => s('text', { class: 'k t6l-rule', x: 60, y: 74 + i * 30, 'text-anchor': 'middle', 'font-size': 19 }, t))
  const scrollBody = s('g', { 'clip-path': `url(#${clipId})` },
    s('path', { class: 'card', d: sheet(12, 10, 96, 150, 6) }),
    s('path', { class: 'k', 'fill-opacity': 0.06, d: sheet(12, 10, 96, 150, 6), filter: 'url(#ink-wash)' }),
    s('path', { class: 'k3', 'fill-opacity': 0.5, d: brush([[16, 13], [104, 13]], 1.2, { a: 0.1, b: 0.1, min: 0.6 }).d }),
    s('text', { class: 'k3 t6l-head', x: 60, y: 38, 'text-anchor': 'middle', 'font-size': 14 }, L.scroll),
    s('path', { class: 'k3', 'fill-opacity': 0.6, d: brush([[42, 47], [60, 45.5], [78, 47]], 1.2, { a: 0.3, b: 0.4 }).d }),
    ...ruleEls,
    s('rect', { class: 'v', x: 86, y: 140, width: 11, height: 11, rx: 1.5, 'fill-opacity': 0.85, filter: 'url(#ink-rough)' }))
  const bottomRod = s('g', { class: 'w2' }, s('path', { d: brush([[4, 160], [116, 160]], 7, { a: 0.04, b: 0.04, min: 0.7 }).d, filter: 'url(#ink-rough)' }),
    s('path', { d: ell(3, 160, 4.2, 5) }), s('path', { d: ell(117, 160, 4.2, 5) }))
  const scroll = s('g', { opacity: 0 },
    s('defs', null, s('clipPath', { id: clipId }, clipRect)),
    s('path', { class: 'k2', d: brush([[34, 6], [60, -14], [86, 6]], 1.3, { a: 0.1, b: 0.1, min: 0.7 }).d }),
    scrollBody, bottomRod,
    s('path', { class: 'w2', d: brush([[4, 7], [116, 7]], 6, { a: 0.04, b: 0.04, min: 0.7 }).d, filter: 'url(#ink-rough)' }),
    s('path', { class: 'w2', d: ell(3, 7, 4, 4.6) }), s('path', { class: 'w2', d: ell(117, 7, 4, 4.6) }))
  // the answer's thread (stage 3)
  const thread = s('path', { class: 't6l-thread', pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1 })
  svg.append(world, scroll, thread)

  /* ── HTML: steps, hit areas, the few words ── */
  let stage = 0
  let unlocked = 0
  const chips = L.steps.map((st, i) =>
    h('button', { class: 't6l-chip', type: 'button', 'aria-label': st.aria, onClick: () => chip(i) }, h('span', { class: 't6l-dot', 'aria-hidden': 'true' }), st.label))
  const steps = h('nav', { class: 't6l-steps', 'aria-label': L.label }, chips[0], h('i', { 'aria-hidden': 'true' }), chips[1], h('i', { 'aria-hidden': 'true' }), chips[2])
  const holdBtn = h('button', { class: 't6-hit t6l-hold', type: 'button', 'aria-label': L.holdAria })
  const cutBtns = SHOOTS.map((_, i) => h('button', { class: 't6-hit t6l-cut', type: 'button', 'aria-label': fill(L.shootAria, { name: L.shoots[i] }), hidden: true, onClick: () => cut(i) }))
  const askBtn = h('button', { class: 't6-hit t6l-ask', type: 'button', 'aria-label': L.askAria, hidden: true, onClick: () => ask() })
  const cloudLab = h('span', { class: 't6-lab t6l-cloudlab', 'aria-hidden': 'true' }, L.cloud)
  const shootLabs = L.shoots.map((t) => h('span', { class: 't6-lab t6l-shootlab', 'aria-hidden': 'true' }, t))
  const shearsLab = h('span', { class: 't6-lab t6l-shearslab', 'aria-hidden': 'true' }, L.shears)
  const askLab = h('span', { class: 't6-lab t6l-asklab', 'aria-hidden': 'true' }, L.question)
  const answer = h('p', { class: 't6l-answer', 'aria-live': 'polite', tabindex: '-1' })
  for (const el of [...shootLabs, shearsLab, askLab]) el.style.opacity = '0'
  root.append(steps, holdBtn, ...cutBtns, askBtn, cloudLab, ...shootLabs, shearsLab, askLab, answer)

  /* ── layout ── */
  let W = 1, Hh = 1, sc = 1, ox = 0, oy = 0, dpr = 1
  let portrait = false
  let scrollBox = { x: 0, y: 0, k: 1 }
  const px = (p: Pt | readonly number[]): Pt => [ox + p[0] * sc, oy + p[1] * sc]
  const cctx = canvas.getContext('2d')

  function layout() {
    W = root.clientWidth
    Hh = root.clientHeight
    if (!W || !Hh) return
    const H = stable.H(Hh)
    const land = W / H > 1.15
    const short = land && H < 340
    root.classList.toggle('short', short)
    const top = short ? 6 : 54
    const availH = H - top - 6
    const EX0 = 22, EX1 = 404, EY0 = 0, EY1 = 404
    sc = Math.min((land ? Math.min(W * 0.6, W - 300) : W - 6) / (EX1 - EX0), availH / (EY1 - EY0))
    sc = Math.max(0.3, sc)
    ox = W / 2 - ((EX0 + EX1) / 2) * sc + (short ? 60 : 0)
    oy = top + (availH - (EY1 - EY0) * sc) * (land ? 0.5 : 0.3) - EY0 * sc
    world.setAttribute('transform', `translate(${ox.toFixed(1)} ${oy.toFixed(1)}) scale(${sc.toFixed(4)})`)
    svg.setAttribute('viewBox', `0 0 ${W} ${Hh}`)
    // scroll: beside the tree when there is room, otherwise in the empty sky top-left
    const k = Math.max(0.76, Math.min(1.45, sc * 0.95))
    const sideX = ox + EX0 * sc - 120 * k - 18
    portrait = sideX < 8
    scrollBox = portrait ? { x: Math.max(6, ox + 14 * sc), y: oy + 10 * sc, k: Math.max(0.66, sc * 0.75) } : { x: sideX, y: oy + 40 * sc, k }
    scroll.setAttribute('transform', `translate(${scrollBox.x.toFixed(1)} ${scrollBox.y.toFixed(1)}) scale(${scrollBox.k.toFixed(3)})`)

    // hit areas
    const a = px([60, 20]), b = px([380, 360])
    place(holdBtn, a[0], a[1], b[0] - a[0], b[1] - a[1])
    SHOOTS.forEach((sh, i) => {
      const [x, y] = px(sh.cut)
      place(cutBtns[i], x - 24, y - 24, 48, 48)
    })
    const q = px(ASK_AT)
    const aw = Math.max(64, 60 * sc)
    place(askBtn, q[0] - aw / 2, q[1] - 26, aw, 52)
    // words
    const fs = clamp(14 * sc, 13, 17)
    root.style.setProperty('--t6-fs', `${fs}px`)
    label(cloudLab, px([200, 100]), 'c')
    SHOOTS.forEach((sh, i) => label(shootLabs[i], px(sh.lab), 'c'))
    label(shearsLab, px([SHEARS_REST[0] + 2, SHEARS_REST[1] + 26]), 'c')
    label(askLab, px([ASK_AT[0], ASK_AT[1] + 20]), 'c')
    // answer: right of the crown, or in the sky top-left on narrow screens
    const ar = px([300, 34])
    if (!portrait && W - ar[0] > 170) {
      place(answer, ar[0], ar[1], Math.min(300, W - ar[0] - 10))
      answer.dataset.side = 'r'
    } else {
      const al = px([20, 8])
      place(answer, Math.max(6, al[0]), Math.max(4, al[1]), Math.max(150, 168 * sc))
      answer.dataset.side = 'l'
    }
    // rain canvas
    dpr = Math.min(ctx.quality === 'low' ? 1 : 2, devicePixelRatio || 1)
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(Hh * dpr)
    canvas.style.width = `${W}px`
    canvas.style.height = `${Hh}px`
    if (stage === 2 && answer.textContent) drawThread()
    if (stage === 1 && !busy) placeShears(SHEARS_REST)
  }

  /** In-art word near a point (px), kept inside the art. */
  function label(el: HTMLElement, p: Pt, align: 'c' | 'l') {
    const w = el.offsetWidth || 80
    const x = align === 'c' ? p[0] - w / 2 : p[0]
    place(el, clamp(x, 4, W - w - 4), p[1] - (el.offsetHeight || 20) / 2)
  }

  function placeShears(p: Pt, rot = -18) {
    shearsG.setAttribute('transform', `translate(${p[0]} ${p[1]}) rotate(${rot}) scale(1.3)`)
  }

  /* ── growth (pre-training) ── */
  let G = 0
  let Gt = 0
  function render() {
    const k = 0.3 + 0.7 * ease(G)
    grow.setAttribute('transform', tf(BASE, k))
    grow.setAttribute('opacity', ease(prog(G, 0.06, 0.24)).toFixed(3))
    // a young trunk is thin: the reveal mask widens as the tree matures
    const girth = 0.22 + 0.78 * ease(prog(G, 0.08, 0.72))
    for (const { m, w, full } of reveals) {
      m.setAttribute('stroke-dashoffset', (1 - prog(G, w.t0, w.t1)).toFixed(4))
      m.setAttribute('stroke-width', (full * girth).toFixed(2))
    }
    for (const { el, p, anchor } of pads) {
      const q = ease(prog(G, p.t[0], p.t[1]))
      el.setAttribute('transform', tf(anchor, 0.2 + 0.8 * q))
      el.setAttribute('opacity', q.toFixed(3))
    }
    for (const { m } of shootEls) m.setAttribute('stroke-dashoffset', (1 - prog(G, 0.72, 0.99)).toFixed(4))
    sapling.setAttribute('transform', tf(BASE, 1 + 1.3 * ease(prog(G, 0, 0.24))))
    sapling.setAttribute('opacity', (1 - prog(G, 0.14, 0.3)).toFixed(3))
    soak.setAttribute('fill-opacity', (0.04 + G * 0.12).toFixed(3))
    // the library thins as it rains out: the visible progress of the hold
    cloud.setAttribute('opacity', (1 - 0.88 * G).toFixed(3))
    cloud.setAttribute('transform', tf([200, 42], 1 - 0.18 * G))
    cloudLab.style.opacity = String(1 - prog(G, 0.12, 0.45))
  }

  /* ── rain of words ── */
  interface Drop { x: number; y: number; v: number; dx: number; w: string; a: number; top: number; ground: number; soak: number; fs: number; font: string }
  const drops: Drop[] = []
  let raining = false
  let burst = 0
  let ink = cssVar('--ink')
  onTheme(ctx, () => (ink = cssVar('--ink')))
  const rr = rng(77)
  let last = 0
  /** One frame of rain + growth; returns whether another is needed. Own wall clock: growth caps a frame at 0.12 s, not 0.05. */
  function frame(): boolean {
    const now = performance.now()
    const raw = (now - last) / 1000 || 0.016
    const dt = Math.min(0.05, raw)
    last = now
    const on = raining || burst > 0 || settle
    burst = Math.max(0, burst - dt)
    // growth follows wall time (slow frames must not make the hold longer)
    if (on && stage === 0) Gt = Math.min(1, Gt + Math.min(0.12, raw) * (raining ? 0.3 : 0.42))
    G += (Gt - G) * Math.min(1, dt * 2.6)
    if (Math.abs(Gt - G) < 0.0005) G = Gt
    render()
    // spawn
    if (on && cctx) {
      const n = (ctx.quality === 'low' ? 9 : 17) * dt * (raining ? 1 : 0.5)
      for (let i = 0; i < n + (rr() < n % 1 ? 1 : 0); i++) {
        const x = ox + (50 + rr() * 300) * sc
        const d: Drop = { x, y: oy + (34 + rr() * 30) * sc, v: (130 + rr() * 110) * Math.max(0.7, sc), dx: -10 + rr() * 5, w: WORDS[Math.floor(rr() * WORDS.length)], a: 0, top: 0.18 + rr() * 0.22, ground: oy + (310 + rr() * 26) * sc, soak: 0, fs: clamp((8.5 + rr() * 4) * sc, 10, 16), font: '' }
        d.font = `400 ${d.fs.toFixed(1)}px "Noto Serif", Georgia, serif`
        drops.push(d)
      }
    }
    if (cctx) {
      cctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      cctx.clearRect(0, 0, W, Hh)
      cctx.fillStyle = ink
      cctx.textAlign = 'center'
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]
        if (d.y < d.ground) {
          d.y += d.v * dt
          d.x += d.dx * dt
          d.a = Math.min(d.top, d.a + dt * 2)
        } else {
          d.soak += dt * 2.4
          d.a = d.top * (1 - d.soak)
        }
        if (d.soak >= 1) {
          drops.splice(i, 1)
          continue
        }
        cctx.globalAlpha = d.a
        cctx.font = d.font
        cctx.fillText(d.w, d.x, d.y)
        if (d.soak > 0) {
          cctx.globalAlpha = 0.25 * (1 - d.soak)
          cctx.beginPath()
          cctx.ellipse(d.x, d.y + 3, 3 + d.soak * 12 * sc, (1 + d.soak * 3) * sc, 0, 0, Math.PI * 2)
          cctx.strokeStyle = ink
          cctx.lineWidth = 0.8
          cctx.stroke()
        }
      }
      cctx.globalAlpha = 1
    }
    if (stage === 0 && G >= 0.999 && Gt >= 1) grown()
    return on || drops.length > 0 || Math.abs(Gt - G) > 0.0005
  }
  // essential: the hold IS the interaction (under ctx.reduced it never kicks); an OS reduced-motion switch mid-hold must not freeze the growth
  const rain = createLoop(root, frame, { essential: true })
  const kick = () => {
    if (rain.running) return
    last = performance.now()
    rain.start()
  }
  function rainOn() {
    if (stage !== 0 || unlocked > 0) return
    if (ctx.reduced) {
      Gt = G = 1
      render()
      grown()
      return
    }
    raining = true
    burst = Math.max(burst, 0.6)
    kick()
  }
  /** Let go: past the middle the shower finishes softly on its own; earlier, ask for a little more. */
  let settle = false
  function rainOff() {
    if (!raining) return
    raining = false
    if (stage !== 0 || done.has(0)) return
    if (Gt > 0.3) {
      settle = true
      kick()
    } else if (Gt > 0.02) ctx.prompt(L.holdMore)
  }
  holdBtn.addEventListener('pointerdown', (e) => {
    holdBtn.setPointerCapture?.(e.pointerId)
    rainOn()
  })
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) holdBtn.addEventListener(ev, rainOff)
  let keyHeld = false
  holdBtn.addEventListener('keydown', (e) => {
    if (e.key !== ' ' && e.key !== 'Enter') return
    e.preventDefault()
    if (!keyHeld) {
      keyHeld = true
      rainOn()
    }
  })
  holdBtn.addEventListener('keyup', (e) => {
    if (e.key !== ' ' && e.key !== 'Enter') return
    keyHeld = false
    rainOff()
  })
  holdBtn.addEventListener('click', (e) => {
    // assistive tech "click" (no pointer, no key): a long shower
    if (e.detail === 0 && !keyHeld) {
      rainOn()
      burst = 2.5
    }
  })

  /* ── stages ── */
  function syncChips() {
    chips.forEach((c, i) => {
      c.disabled = i > unlocked
      c.classList.toggle('on', i === stage)
      c.classList.toggle('done', done.has(i))
      c.classList.toggle('ready', i === unlocked && i !== stage)
      if (i === stage) c.setAttribute('aria-current', 'step')
      else c.removeAttribute('aria-current')
    })
    const hide = stage !== 0 || done.has(0)
    if (hide) passFocus(holdBtn, chips[unlocked])
    holdBtn.hidden = hide
  }
  const done = new Set<number>()
  function finish(i: number) {
    if (done.has(i)) return
    done.add(i)
    unlocked = Math.min(2, Math.max(unlocked, i + 1))
    const ins = L.insights[i]
    ctx.insight(ins.text, ins.detail)
    ctx.chime('ok')
    syncChips()
    if (i === 1) passFocus(chips[1], chips[2])
  }
  function grown() {
    raining = false
    settle = false
    finish(0)
    if (!ctx.reduced) ctx.anim(() => gsap.to(cloud, { opacity: 0, duration: 1.4, ease: 'power2.out' }))
    else cloud.setAttribute('opacity', '0')
  }
  function clearInsight() {
    const old = ctx.el.querySelector<HTMLElement>('.scene-insight')
    if (!old) return
    if (ctx.reduced) old.remove()
    else gsap.to(old, { opacity: 0, duration: 0.4, onComplete: () => old.remove() })
  }
  function chip(i: number) {
    if (i === stage) return
    if (i < stage || done.has(i)) {
      ctx.insight(L.insights[i].text, L.insights[i].detail)
      return
    }
    if (i > unlocked) return
    stage = i
    syncChips()
    clearInsight()
    ctx.anim(() => (i === 1 ? enterPrune() : enterAsk()))
  }

  /* stage 2 — pruning */
  const cutDone = new Set<number>()
  let busy = 0
  function enterPrune() {
    ctx.prompt(L.prune)
    const R = ctx.reduced
    placeShears(SHEARS_REST)
    cutBtns.forEach((b) => (b.hidden = false))
    if (R) {
      gsap.set(scroll, { opacity: 1 })
      gsap.set(clipRect, { attr: { height: 176 } })
      gsap.set([shearsG], { opacity: 1 })
      gsap.set([...shootLabs, shearsLab], { opacity: 1 })
      return
    }
    const tl = gsap.timeline()
    tl.set(scroll, { opacity: 1 })
    tl.fromTo(clipRect, { attr: { height: 0 } }, { attr: { height: 176 }, duration: 1.6, ease: 'power2.inOut' }, 0)
    tl.fromTo(bottomRod, { y: -152 }, { y: 0, duration: 1.6, ease: 'power2.inOut' }, 0)
    tl.from(ruleEls, { opacity: 0, y: 4, duration: 0.8, stagger: 0.35, ease: 'power2.out' }, 1.1)
    tl.fromTo(shearsG, { opacity: 0 }, { opacity: 1, duration: 0.9 }, 0.6)
    tl.fromTo([shearsLab, ...shootLabs], { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.9, stagger: 0.12, ease: 'power3.out' }, 0.9)
  }
  function cut(i: number) {
    if (cutDone.has(i)) return
    cutDone.add(i)
    const nextCut = cutBtns.find((_, k) => k !== i && !cutDone.has(k))
    passFocus(cutBtns[i], nextCut ?? chips[1])
    cutBtns[i].hidden = true
    ctx.chime('tap')
    const toTree = SHOOTS[i].cut
    const fallX = i === 2 ? -16 : 18
    const after = () => {
      if (cutDone.size === SHOOTS.length) finish(1)
    }
    if (ctx.reduced) {
      shootEls[i].wrap.setAttribute('opacity', '0')
      shootLabs[i].style.opacity = '0'
      after()
      return
    }
    busy++
    ctx.anim(() => {
      const tl = gsap.timeline({ onComplete: () => (busy--, after()) })
      const from = { x: SHEARS_REST[0], y: SHEARS_REST[1], r: -18 }
      const ang = i === 0 ? 30 : i === 1 ? -60 : 50
      tl.to(from, {
        x: toTree[0] - 24 * Math.cos((ang * Math.PI) / 180),
        y: toTree[1] - 24 * Math.sin((ang * Math.PI) / 180),
        r: ang,
        duration: 0.6,
        ease: 'power3.inOut',
        onUpdate: () => placeShears([from.x, from.y], from.r),
      })
      tl.to(sh.bladeA, { rotation: -20, svgOrigin: '0 0', duration: 0.35, ease: 'power2.out' }, 0.1)
      tl.to(sh.bladeB, { rotation: 20, svgOrigin: '0 0', duration: 0.35, ease: 'power2.out' }, 0.1)
      tl.to([sh.bladeA, sh.bladeB], { rotation: 0, svgOrigin: '0 0', duration: 0.14, ease: 'power2.in' }, 0.6)
      tl.to(shootEls[i].wrap, { rotation: i === 2 ? -28 : 34, svgOrigin: `${toTree[0]} ${toTree[1]}`, x: fallX, y: 90, opacity: 0, duration: 1.3, ease: 'power2.in' }, 0.7)
      tl.to(shootLabs[i], { y: 40, opacity: 0, duration: 1, ease: 'power2.in' }, 0.7)
      tl.to(from, { x: SHEARS_REST[0], y: SHEARS_REST[1], r: -18, duration: 0.8, ease: 'power3.inOut', onUpdate: () => placeShears([from.x, from.y], from.r) }, 1.05)
    })
  }

  /* stage 3 — the shaped tree answers */
  function enterAsk() {
    ctx.prompt(L.ask)
    askBtn.hidden = false
    if (ctx.reduced) {
      gsap.set([shearsG, shearsLab], { opacity: 0 })
      gsap.set([askStone, askLab], { opacity: 1 })
      if (portrait) gsap.set(scroll, { opacity: 0 })
      return
    }
    const tl = gsap.timeline()
    tl.to([shearsG, shearsLab], { opacity: 0, duration: 0.6 }, 0)
    if (portrait) tl.to(clipRect, { attr: { height: 0 }, duration: 1.1, ease: 'power2.inOut' }, 0).to(bottomRod, { y: -152, duration: 1.1, ease: 'power2.inOut' }, 0).to(scroll, { opacity: 0, duration: 0.4 }, 0.9)
    tl.fromTo(askStone, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out' }, 0.3)
    tl.fromTo(askLab, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' }, 0.7)
  }
  let asked = false
  function ask() {
    if (asked) return
    asked = true
    passFocus(askBtn, answer)
    askBtn.hidden = true
    ctx.chime('soft')
    answer.textContent = L.answer
    const end = () => {
      drawThread()
      finish(2)
    }
    if (ctx.reduced) {
      gsap.set(light, { attr: { 'stroke-dashoffset': 0 }, opacity: 0.8 })
      blooms.forEach((b, i) => b.setAttribute('transform', tf(BLOSSOMS[i], 1)))
      gsap.set(blooms, { opacity: 1 })
      end()
      return
    }
    ctx.anim(() => {
      const lp = { t: 0 }
      const len = light.getTotalLength()
      const tl = gsap.timeline()
      tl.set(bead, { opacity: 1 })
      tl.fromTo(light, { attr: { 'stroke-dashoffset': 1 }, opacity: 0.9 }, { attr: { 'stroke-dashoffset': 0 }, duration: 2.2, ease: 'power1.inOut' }, 0)
      tl.to(lp, {
        t: 1, duration: 2.2, ease: 'power1.inOut',
        onUpdate: () => {
          const p = light.getPointAtLength(lp.t * len)
          bead.setAttribute('cx', p.x.toFixed(1))
          bead.setAttribute('cy', p.y.toFixed(1))
        },
      }, 0)
      tl.to(bead, { opacity: 0, duration: 0.5 }, 2.1)
      blooms.forEach((b, i) => {
        const o = { k: 0 }
        tl.to(o, { k: 1, duration: 0.9, ease: 'back.out(2.4)', onUpdate: () => b.setAttribute('transform', tf(BLOSSOMS[i], o.k)) }, 2.1 + i * 0.12)
        tl.to(b, { opacity: 1, duration: 0.4 }, 2.1 + i * 0.12)
      })
      tl.to(light, { opacity: 0.35, duration: 1.6 }, 2.6)
      tl.fromTo(answer, { opacity: 0, clipPath: 'inset(0 100% 0 0)' }, { opacity: 1, clipPath: 'inset(0 -4% 0 0)', duration: 1.6, ease: 'power2.out', clearProps: 'clipPath' }, 2.6)
      tl.add(end, 3.2)
      tl.fromTo(thread, { attr: { 'stroke-dashoffset': 1 } }, { attr: { 'stroke-dashoffset': 0 }, duration: 1, ease: 'power2.out' }, 3.2)
    })
  }
  function drawThread() {
    // a faint vermilion hair from the blossoms to the answer
    const a = px([258, 56])
    const r = answer.getBoundingClientRect()
    const o = root.getBoundingClientRect()
    const right = answer.dataset.side === 'r'
    const b: Pt = right ? [r.left - o.left - 6, r.top - o.top + 14] : [r.right - o.left - 30, r.bottom - o.top + 4]
    const m: Pt = [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 12]
    thread.setAttribute('d', `M${a[0].toFixed(1)} ${a[1].toFixed(1)}Q${m[0].toFixed(1)} ${m[1].toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`)
  }

  render()
  syncChips()
  onSize(ctx, root, layout, stable.reset)
  layout()
  ctx.prompt(L.hold)
  if (!ctx.reduced) {
    gsap.from(cloudWrap, { opacity: 0, y: -10, duration: 2, ease: 'power2.out' })
    // the library breathes: its rows of writing drift slowly, alternate ways
    const rowEls = [...rows.children] as SVGTextElement[]
    rowEls.forEach((el, i) => gsap.to(el, { x: (i % 2 ? -1 : 1) * 14, duration: 7 + i, ease: 'sine.inOut', repeat: -1, yoyo: true }))
  }

  return () => {
    rain.dispose()
    drops.length = 0
  }
}
