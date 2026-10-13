import { s } from '../../core/dom'
import { arc, brush, ell, lantern, poly, rng, stone, stroke, wash, type Pt } from './ink'

const brushD = (pts: Pt[], w: number) => brush(pts, w, { a: 0.25, b: 0.45, min: 0.2 }).d

/**
 * Four ink pictures in a 400 × 300 box (ground ≈ y 250), each ten times wider than the last:
 * five drops on a lotus leaf → a glass → a wooden bath → a garden pond.
 * Each picture holds the previous vessel, small, at `proxy` — the zoom flies from one into the other.
 */
export interface Vessel {
  g: SVGGElement
  /** 0 → 1: how full (drives the water) */
  fill(k: number): void
  /** where the previous picture's vessel sits, small (bottom-centre) and its scale */
  proxy?: { at: Pt; k: number }
  /** where this picture's own vessel stands (bottom-centre), for the next zoom */
  self: Pt
  /** in-picture label anchor */
  label: Pt
  /** anchor for an extra caption (picture 3: where the data centre stands) */
  note?: Pt
  /** the falling drops (picture 0 only) */
  drops?: { mouth: Pt; beads: SVGGElement[]; at: Pt[] }
}

const layers = (low: boolean) => {
  const g = s('g')
  const body = s('g', low ? null : { filter: 'url(#ink-wash)' })
  const dry = s('g', low ? null : { filter: 'url(#ink-dry)' })
  const ink = s('g', low ? null : { filter: 'url(#ink-rough)' })
  const top = s('g')
  g.append(body, dry, ink, top)
  return { g, body, dry, ink, top }
}

function ripples(into: SVGGElement, cx: number, cy: number, rx: number, n: number, op = 0.5) {
  for (let i = 0; i < n; i++) {
    const k = 1 + i * 0.45
    into.append(stroke(arc(cx, cy, rx * k, rx * k * 0.22, 200 - i * 6, 340 + i * 6, 18), 1.1, 'k3', { a: 0.25, b: 0.3, min: 0.3 }, op * (1 - i * 0.22)))
  }
}

/** A drinking glass (used full size in picture 1 and as the proxy in picture 2). */
function glass(L: ReturnType<typeof layers>, cx: number, base: number, H: number, level?: SVGPathElement) {
  const k = H / 144
  const rT = 46 * k
  const rB = 37 * k
  const top = base - H
  L.body.append(wash(ell(cx + 10 * k, base + 2 * k, rB * 1.5, 7 * k), 0.12))
  if (level) L.body.append(level)
  L.ink.append(
    stroke([[cx - rT, top], [cx - rB, base - 4 * k]], 3 * k, 'k', { straight: true, a: 0.05, b: 0.15 }),
    stroke([[cx + rT, top], [cx + rB, base - 4 * k]], 1.6 * k, 'k', { straight: true, a: 0.08, b: 0.2 }, 0.8),
    stroke(arc(cx, top, rT, 8.5 * k, 182, 538, 30), 1.5 * k, 'k', { a: 0.05, b: 0.1, min: 0.4 }, 0.85),
    stroke(arc(cx, base - 4 * k, rB, 6.5 * k, 8, 172, 16), 2.4 * k, 'k', { a: 0.1, b: 0.2 }),
  )
  L.top.append(stroke([[cx - rT * 0.62, top + 16 * k], [cx - rB * 0.66, base - 22 * k]], 2.6 * k, 'p', { straight: true, a: 0.3, b: 0.4, min: 0.2 }, 0.7))
  return { top, rT, rB }
}

/** A round wooden bath (ofuro): dry-brushed staves, two pressed bamboo hoops, a dark inside; `shine` lies on the water. */
function tub(L: ReturnType<typeof layers>, cx: number, base: number, rx: number, water?: SVGPathElement, shine?: SVGPathElement) {
  const k = rx / 150
  const top = base - 108 * k
  const ry = 34 * k
  const r = rng(Math.round(rx * 7))
  const side = poly([...arc(cx, top, rx, ry, 0, 180, 24), ...arc(cx, base, rx * 0.95, ry * 0.9, 180, 0, 24)])
  L.body.append(
    wash(ell(cx + 16 * k, base + 5 * k, rx * 1.12, 15 * k), 0.13),
    s('path', { class: 'p', d: poly([...arc(cx, top, rx, ry, 180, 360, 24), ...arc(cx, base, rx * 0.95, ry * 0.9, 0, 180, 24)]) }),
    wash(side, 0.1),
    // the shadow side of the barrel, and the dark inside
    wash(poly([...arc(cx, top, rx, ry, 0, 70, 10), ...arc(cx, base, rx * 0.95, ry * 0.9, 70, 0, 10)]), 0.14),
    wash(ell(cx, top, rx * 0.95, ry * 0.86), 0.34),
  )
  if (water) L.body.append(water)
  if (shine) L.top.append(shine)
  // staves: irregular widths, each a dry stroke that follows the curve of the body
  let a = 5 + r() * 4
  while (a < 176) {
    const t0 = (a * Math.PI) / 180
    const x1 = cx + rx * Math.cos(t0)
    const x2 = cx + rx * 0.95 * Math.cos(t0)
    const y1 = top + ry * Math.sin(t0)
    const y2 = base + ry * 0.9 * Math.sin(t0)
    const lit = Math.cos(t0) < 0
    L.dry.append(stroke([[x1, y1 + 2 * k], [x2, y2 - 2 * k]], (5 + r() * 5) * k, 'k', { straight: true, a: 0.06, b: 0.12, min: 0.6, wob: 0.15 }, (lit ? 0.1 : 0.18) + r() * 0.08))
    L.ink.append(stroke([[x1, y1 + (3 + r() * 6) * k], [x2, y2 - (4 + r() * 10) * k]], (0.9 + r() * 0.6) * k + 0.3, 'k2', { straight: true, a: 0.2, b: 0.35, min: 0.3 }, 0.35 + r() * 0.25))
    a += 9 + r() * 9
  }
  // two hoops pressed on with the brush: heavy where they turn away, lifting off at the lit side
  for (const f of [0.2, 0.78]) {
    const y = top + (base - top) * f
    const rr = rx * (1 - 0.05 * f)
    const ryy = ry * (1 - 0.1 * f)
    L.ink.append(
      stroke(arc(cx, y, rr, ryy, 176, 96, 16), 3.6 * k + 0.4, 'k', { a: 0.2, b: 0.4, min: 0.3 }, 0.9),
      stroke(arc(cx, y, rr, ryy, 88, 4, 16), 2.6 * k + 0.4, 'k', { a: 0.25, b: 0.4, min: 0.3 }, 0.7),
      stroke(arc(cx, y + 3.5 * k, rr * 0.995, ryy, 170, 20, 18), 1 * k + 0.2, 'k2', { a: 0.3, b: 0.4, min: 0.3 }, 0.4),
    )
  }
  L.ink.append(
    stroke(arc(cx, top, rx, ry, 176, 352, 32), 2.4 * k + 0.4, 'k', { a: 0.1, b: 0.3, min: 0.3 }),
    stroke(arc(cx, top, rx, ry, 8, 168, 22), 1.6 * k + 0.3, 'k', { a: 0.2, b: 0.4, min: 0.3 }, 0.75),
    stroke([[cx - rx, top + 2 * k], [cx - rx * 0.975, top + 54 * k], [cx - rx * 0.95, base]], 3.4 * k + 0.4, 'k', { a: 0.05, b: 0.3, min: 0.3 }),
    stroke([[cx + rx, top + 6 * k], [cx + rx * 0.95, base - 6 * k]], 1.6 * k + 0.3, 'k', { straight: true, a: 0.15, b: 0.4, min: 0.3 }, 0.7),
    stroke(arc(cx, base, rx * 0.95, ry * 0.9, 14, 168, 20), 2.6 * k + 0.4, 'k', { a: 0.15, b: 0.35, min: 0.3 }),
  )
  return { top, ry }
}

/** 0 — the bamboo spout drips five drops onto a lotus leaf. */
function leaf(low: boolean): Vessel {
  const L = layers(low)
  const r = rng(5)
  // water below, a few strokes
  for (let i = 0; i < 5; i++) {
    const y = 262 + i * 8
    L.body.append(stroke([[40 + i * 12, y], [200, y - 1], [370 - i * 10, y + 1]], 6 - i * 0.6, 'k', { a: 0.3, b: 0.3, min: 0.2 }, 0.05))
  }
  ripples(L.ink, 238, 266, 22, 3, 0.6)
  // a closed lotus bud rising beside the post
  L.ink.append(stroke([[118, 268], [124, 220], [132, 182], [138, 166]], 2.4, 'k2', { a: 0.1, b: 0.1 }))
  const bud = 'M138 128C146 140 152 152 148 162C145 169 131 170 128 163C124 154 130 140 138 128Z'
  L.body.append(s('path', { d: bud, class: 'bud' }))
  L.ink.append(
    s('path', { d: bud, class: 'k', 'fill-opacity': 0 }),
    stroke([[138, 129], [134, 146], [136, 166]], 1.4, 'k', { a: 0.2, b: 0.3 }, 0.6),
    stroke([[138, 128], [148, 144], [149, 160], [143, 168]], 1.6, 'k', { a: 0.1, b: 0.4 }, 0.8),
  )
  L.body.append(s('path', { d: 'M138 128C141 132 143 136 144 140C140 139 136 137 134 134C135 132 136 130 138 128Z', class: 'v', 'fill-opacity': 0.55 }))
  // the bamboo post and its spout: each joint a single loaded stroke, knuckles at the nodes
  const seg = (a: Pt, b: Pt, w: number) => {
    L.body.append(stroke([a, b], w, 'm', { straight: true, a: 0.04, b: 0.06, min: 0.85, wob: 0.03 }, 0.5))
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const l = Math.hypot(dx, dy)
    const n: Pt = [-dy / l, dx / l]
    const e = (p: Pt, k: number): Pt => [p[0] + n[0] * w * k, p[1] + n[1] * w * k]
    L.ink.append(
      stroke([e(a, 0.42), e(b, 0.42)], w * 0.14, 'k', { straight: true, a: 0.1, b: 0.1, min: 0.4 }, 0.75),
      stroke([e(a, -0.4), e(b, -0.4)], w * 0.07, 'k', { straight: true, a: 0.2, b: 0.2, min: 0.4 }, 0.45),
    )
  }
  const knot = (p: Pt, w: number, ang = 0) => {
    const c = Math.cos(ang)
    const sn = Math.sin(ang)
    const q = (dx: number, dy: number): Pt => [p[0] + dx * c - dy * sn, p[1] + dx * sn + dy * c]
    L.ink.append(stroke([q(-w * 0.62, 1), q(-w * 0.2, -1.5), q(w * 0.2, -1), q(w * 0.6, 1.5)], 3, 'k', { a: 0.15, b: 0.3, min: 0.3 }))
  }
  for (const [y0, y1] of [[254, 194], [188, 124], [118, 74]]) seg([30, y0], [30, y1], 21)
  knot([30, 191], 21)
  knot([30, 121], 21)
  L.ink.append(stroke([[18, 77], [42, 66]], 2.4, 'k', { straight: true, a: 0.2, b: 0.2 }))
  L.body.append(wash(ell(30, 72, 10, 4), 0.5))
  const A: Pt = [40, 98]
  const B: Pt = [214, 120]
  const ang = Math.atan2(B[1] - A[1], B[0] - A[0])
  const pt = (t: number): Pt => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]
  for (const [t0, t1] of [[0, 0.33], [0.37, 0.68], [0.72, 1]]) seg(pt(t0), pt(t1), 13)
  knot(pt(0.35), 13, ang + Math.PI / 2)
  knot(pt(0.7), 13, ang + Math.PI / 2)
  L.body.append(wash(ell(B[0] + 1, B[1], 3, 6), 0.7))
  L.ink.append(stroke(arc(B[0] + 1, B[1], 3.6, 6.6, -80, 280, 16), 1.4, 'k', { a: 0.1, b: 0.1 }))
  // the leaf: a shallow wavy cup of green ink, pale veins, a darker near rim
  const lc: Pt = [238, 214]
  L.ink.append(stroke([[lc[0], 228], [lc[0] - 2, 248], [lc[0] + 1, 268]], 3, 'k2', { a: 0.1, b: 0.3 }))
  const edge: Pt[] = []
  for (let a = 0; a <= 360; a += 8) {
    const t = (a * Math.PI) / 180
    const w = 1 + 0.035 * Math.sin(t * 7 + 0.5) + 0.02 * Math.sin(t * 13)
    edge.push([lc[0] + 104 * w * Math.cos(t), lc[1] + 27 * w * Math.sin(t) + (Math.sin(t) > 0 ? 0 : -4 * Math.sin(t) * 0)])
  }
  edge[edge.length - 1] = edge[0]
  L.body.append(
    s('path', { d: poly(edge), class: 'm', 'fill-opacity': 0.55 }),
    wash(ell(lc[0] - 6, lc[1] - 5, 74, 13), 0.3, 'm2'),
    wash(ell(lc[0] + 10, lc[1] + 9, 84, 12), 0.22, 'k'),
  )
  for (let a = 0; a < 360; a += 26) {
    const t = ((a + r() * 8) * Math.PI) / 180
    L.ink.append(stroke([[lc[0], lc[1] - 3], [lc[0] + 92 * Math.cos(t), lc[1] - 3 + 23 * Math.sin(t)]], 1.1, 'p', { straight: true, a: 0.1, b: 0.5, min: 0.2 }, 0.45))
  }
  L.ink.append(
    stroke(edge.slice(2, 22), 2.6, 'k', { a: 0.06, b: 0.2 }, 0.75),
    stroke(edge.slice(25, 43), 1, 'k', { a: 0.2, b: 0.3 }, 0.35),
  )
  // five beads of water (shown one by one)
  const at: Pt[] = [[226, 210], [244, 213], [236, 205], [254, 207], [218, 216]]
  const beads = at.map(([x, y]) => s('g', { opacity: 0 },
    s('path', { d: ell(x + 1, y + 3, 6, 2), class: 'k', 'fill-opacity': 0.18 }),
    s('path', { d: ell(x, y, 5.6, 4.6), class: 'bead' }),
    s('path', { d: ell(x - 1.8, y - 1.6, 1.6, 1.2), class: 'p' })))
  L.top.append(...beads)
  return { g: L.g, fill: () => {}, self: [238, 230], label: [310, 168], drops: { mouth: [B[0] + 1, B[1] + 6], beads, at } }
}

/** 1 — a glass of water, about 260 mL. */
function cup(low: boolean): Vessel {
  const L = layers(low)
  L.body.append(stroke([[30, 252], [200, 250], [370, 253]], 2.4, 'k', { a: 0.2, b: 0.3 }, 0.35))
  const level = s('path', { class: 'water' })
  const base = 244
  const H = 150
  const { top, rT, rB } = glass(L, 200, base, H, level)
  L.top.append(stone(rng(3), 314, 247, 22, 7, 0.6, 't18d-pstone'))
  const fill = (k: number) => {
    const y = base - 4 - (base - 4 - (top + 18)) * k
    const t = (y - top) / (base - top)
    const rw = rT + (rB - rT) * t
    level.setAttribute('d', k <= 0.01 ? '' : poly([...arc(200, y, rw * 0.97, 7, 180, 360, 16), ...arc(200, base - 4, rB * 0.97, 6, 0, 180, 16)]))
  }
  return { g: L.g, fill, self: [200, base], label: [200, top - 34] }
}

/** 2 — a wooden bath, about 260 litres; the glass stands beside it. */
function bath(low: boolean): Vessel {
  const L = layers(low)
  L.body.append(stroke([[10, 254], [200, 251], [392, 255]], 2.4, 'k', { a: 0.2, b: 0.3 }, 0.35))
  const water = s('path', { class: 'water' })
  const shine = s('path', { class: 'p', 'fill-opacity': 0.75 })
  const cx = 186
  const base = 236
  const rx = 138
  const { top, ry } = tub(L, cx, base, rx, water, shine)
  // the glass from the last picture, now tiny beside the bath
  glass(L, 352, 244, 22)
  // a little steam
  for (const [x, ph] of [[150, 0], [214, 1.4]]) {
    const pts: Pt[] = []
    for (let y = 0; y <= 50; y += 5) pts.push([x + Math.sin(y / 8 + ph) * 5, top - 8 - y])
    L.ink.append(stroke(pts, 2, 'k3', { a: 0.4, b: 0.5, min: 0.2 }, 0.45))
  }
  const fill = (k: number) => {
    const y = top + ry * 0.2 + (1 - k) * 46
    const w = rx * 0.93 * (0.94 + 0.06 * k)
    water.setAttribute('d', k <= 0.01 ? '' : ell(cx, y, w, ry * 0.78 * (0.94 + 0.06 * k)))
    // the evening sky caught on the water: one long bright streak and a short one
    shine.setAttribute('d', k <= 0.3 ? '' : `${brushD([[cx - w * 0.62, y - ry * 0.18], [cx - w * 0.1, y - ry * 0.26], [cx + w * 0.34, y - ry * 0.2]], 4.2)}${brushD([[cx + w * 0.1, y + ry * 0.2], [cx + w * 0.42, y + ry * 0.16]], 2.4)}`)
    shine.setAttribute('fill-opacity', String(0.75 * Math.min(1, (k - 0.3) / 0.4)))
  }
  return { g: L.g, fill, proxy: { at: [352, 244], k: 22 / 150 }, self: [cx, base], label: [cx, top - 70] }
}

/** 3 — a garden pond about 10 × 10 m (≈ 260 m³ at 2,6 m deep); a stone lantern, a person and the bath for scale. */
function pond(low: boolean): Vessel {
  const L = layers(low)
  const r = rng(11)
  // 300 units = 10 m across, so a person (1,7 m) is ~51 units and the bath (≈1,2 m) ~36
  const cx = 180
  const cy = 206
  const RX = 150
  const RY = 38
  const shore: Pt[] = []
  for (let a = 0; a <= 360; a += 12) {
    const t = (a * Math.PI) / 180
    const j = 1 + 0.06 * Math.sin(t * 3 + 1) + 0.035 * Math.sin(t * 5)
    shore.push([cx + RX * j * Math.cos(t), cy + RY * j * Math.sin(t)])
  }
  shore[shore.length - 1] = shore[0]
  L.body.append(wash(ell(cx + 6, cy + 8, RX * 1.16, RY * 1.5), 0.07), wash(poly(shore), 0.1))
  const water = s('path', { class: 'water', d: poly(shore.map(([x, y]) => [cx + (x - cx) * 0.97, cy + (y - cy) * 0.94] as Pt)) })
  L.body.append(water)
  const shine = s('g')
  ripples(shine, cx + 18, cy + 4, 26, 4, 0.7)
  for (let i = 0; i < 6; i++) {
    const x = cx - 110 + r() * 200
    const y = cy - 12 + r() * 30
    shine.append(stroke([[x, y], [x + 16 + r() * 24, y]], 1.2, 'p', { a: 0.3, b: 0.3 }, 0.7))
  }
  L.top.append(shine)
  // the near shore: one pressed stroke that breaks where the light catches it
  L.ink.append(
    stroke(arc(cx, cy, RX * 1.01, RY * 1.08, 12, 70, 14), 1.8, 'k', { a: 0.1, b: 0.4, min: 0.3 }, 0.6),
    stroke(arc(cx, cy, RX * 1.01, RY * 1.08, 82, 168, 18), 2.2, 'k', { a: 0.15, b: 0.3, min: 0.3 }, 0.65),
  )
  // edging stones gathered in three loose groups along the far rim, never a dotted line
  const rock = (x: number, y: number, w: number, hh: number) => {
    L.body.append(s('path', { class: 'k', 'fill-opacity': (0.26 + r() * 0.2).toFixed(2), d: `M${x - w} ${y}C${x - w * 0.9} ${y - hh * 1.4} ${x + w * 0.6} ${y - hh * 1.5} ${x + w} ${y - hh * 0.1}C${x + w * 0.5} ${y + hh * 0.5} ${x - w * 0.6} ${y + hh * 0.5} ${x - w} ${y}Z` }))
    L.ink.append(stroke([[x - w * 0.95, y + 0.3], [x, y + hh * 0.35], [x + w * 0.9, y]], 1 + w * 0.06, 'k', { a: 0.2, b: 0.3 }, 0.7))
  }
  for (const [a0, n] of [[204, 5], [262, 3], [318, 4], [150, 2]] as const) {
    let a = a0
    for (let i = 0; i < n; i++) {
      const t = (a * Math.PI) / 180
      const w = (i === 1 ? 8 : 3.5) + r() * 4.5
      rock(cx + RX * 1.02 * Math.cos(t) + (r() - 0.5) * 3, cy + RY * 1.05 * Math.sin(t) - 1 + (r() - 0.5) * 2, w, 2.6 + r() * 2.4 + (i === 1 ? 2 : 0))
      a += 4 + r() * 6
    }
  }
  // a stone lantern on the far left bank (≈ 2 m)
  const lan = lantern(30, 182, 1.02)
  L.body.append(lan.wash)
  L.ink.append(lan.ink)
  L.top.append(lan.lamp)
  // a person standing on the near right bank, for scale: a robe of wash, a dab for the head
  const px = 334
  const pb = 210
  L.body.append(wash(ell(px + 9, pb + 1.5, 15, 3), 0.24))
  L.body.append(s('path', { class: 'k', 'fill-opacity': 0.55, d: `M${px - 3} ${pb - 41}C${px - 9} ${pb - 34} ${px - 11} ${pb - 18} ${px - 12} ${pb}L${px + 9} ${pb}C${px + 8} ${pb - 18} ${px + 7} ${pb - 34} ${px + 3} ${pb - 41}Z` }))
  L.ink.append(
    stroke([[px - 4, pb - 40], [px - 9, pb - 24], [px - 12, pb - 1]], 2.6, 'k', { a: 0.05, b: 0.4, min: 0.3 }),
    stroke([[px + 3.5, pb - 39], [px + 7, pb - 20], [px + 8.5, pb - 1]], 1.4, 'k', { a: 0.1, b: 0.4, min: 0.3 }, 0.7),
    stroke([[px - 13, pb], [px, pb + 0.6], [px + 10, pb]], 1.6, 'k', { a: 0.2, b: 0.3 }, 0.7),
  )
  L.top.append(s('path', { class: 'k', d: ell(px, pb - 46, 4.3, 5.2) }))
  // the bath from the last picture, beside them
  const tb = layers(true)
  tub(tb, 372, 212, 18)
  L.top.append(tb.g)
  const fill = (k: number) => {
    water.setAttribute('fill-opacity', String(0.08 + 0.3 * k))
    shine.setAttribute('opacity', String(k))
  }
  return { g: L.g, fill, proxy: { at: [372, 212], k: 18 / 138 }, self: [cx, cy + 40], label: [cx, 122], note: [cx, 272] }
}

export const VESSELS = [leaf, cup, bath, pond]
