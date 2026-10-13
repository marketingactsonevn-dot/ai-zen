import { s } from '../../core/dom'
// The sumi-e toolkit from Trạm 3 (tapered brush outlines, washes, a self-drawing pen) — shared, read-only.
import { arc, brush, ell, Pen, peaks, poly, rrD, rrPts, rng, type Pt } from '../t03/brush'
import type { AppId } from './data'

export { arc, brush, ell, Pen, poly, rrD, rrPts, rng, type Pt }
export const S = { straight: true }
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
export const f1 = (n: number) => Math.round(n * 10) / 10

const cv = document.createElement('canvas').getContext('2d')
/** Width of a line of serif text at `px` (to lay out words in the art before they are drawn). */
export function textW(t: string, px: number, weight = 400) {
  if (!cv) return t.length * px * 0.55
  cv.font = `${weight} ${px}px 'Noto Serif', Georgia, serif`
  return cv.measureText(t).width
}

export type Box = { x: number; y: number; w: number; h: number }
export const hit = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

/** Far hills in ink wash standing on the horizon `hy`, with a band of mist over their feet. */
export function horizon(id: string, W: number, H: number, hy: number) {
  const r = rng(11)
  const g = s('g', { class: 't16-horizon', 'aria-hidden': 'true' })
  const far = peaks(r, -W * 0.05, W * 1.05, hy, H * 0.05, H * 0.13, W * 0.15)
  const near = peaks(r, -W * 0.02, W * 1.02, hy + H * 0.012, H * 0.025, H * 0.07, W * 0.2)
  g.append(
    s('defs', null, s('linearGradient', { id: `${id}-mist`, x1: 0, y1: 0, x2: 0, y2: 1 },
      s('stop', { offset: 0, class: 'mist0' }),
      s('stop', { offset: 0.55, class: 'mist1' }),
      s('stop', { offset: 1, class: 'mist0' }))),
    ...far.map((m) => s('path', { d: m.d, class: 'k3', 'fill-opacity': 0.1, filter: 'url(#ink-wash)' })),
    ...near.map((m) => s('path', { d: m.d, class: 'k3', 'fill-opacity': 0.16, filter: 'url(#ink-wash)' })),
    s('rect', { x: 0, y: hy - H * 0.05, width: W, height: H * 0.1, fill: `url(#${id}-mist)` }))
  return g
}

/** A pen whose picture sits at (x, y) with scale k; static (no self-drawing masks). */
export function placed(x: number, y: number, k: number, fx: 'full' | 'root' | 'none' = 'full') {
  const p = new Pen(false, fx)
  p.root.setAttribute('transform', `translate(${f1(x)} ${f1(y)}) scale(${k.toFixed(4)})`)
  return p
}

// ───────────────────────── the stone lantern = an AI agent ─────────────────────────
export interface LanternOpt {
  /** proportions: 1 = kasuga (tall); <1 squat, wide roof (yukimi-like) */
  tall?: number
  roof?: number
  moss?: number
}
export interface Lantern {
  /** the window opening (dark when unlit) */
  win: SVGPathElement
  /** warm light filling the window, with its flame — tween its opacity */
  lit: SVGGElement
  flame: SVGPathElement
  /** window centre and top, in local units (base centre = 0,0) */
  wy: number
  top: number
}

/** Kasuga-style stone lantern, base centre at 0,0, about 230 units tall. Light from the upper left. */
export function lantern(p: Pen, o: LanternOpt = {}): Lantern {
  const t = o.tall ?? 1
  const rw = o.roof ?? 1
  const Y = (y: number) => (y < -24 ? -24 + (y + 24) * (y < -98 ? 1 : t) - (y < -98 ? 74 * (t - 1) : 0) : y)
  const P = (pts: Pt[]) => pts.map(([x, y]) => [x, Y(y)] as Pt)
  const R = (pts: Pt[]) => pts.map(([x, y]) => [x * rw, Y(y)] as Pt)
  const base: Pt[] = [[-48, 0], [48, 0], [46, -10], [36, -14], [30, -24], [-30, -24], [-36, -14], [-46, -10]]
  const pillar: Pt[] = [[-13, -24], [13, -24], [11, -61], [13, -98], [-13, -98], [-11, -61]]
  const plat: Pt[] = [[-15, -98], [15, -98], [38, -108], [42, -116], [-42, -116], [-38, -108]]
  const box: Pt[] = [[-30, -116], [30, -116], [28, -164], [-28, -164]]
  const roof: Pt[] = [[-14, -194], [14, -194], [50, -175], [64, -176], [71, -183], [69, -172], [58, -165], [-58, -165], [-69, -172], [-71, -183], [-64, -176], [-50, -175]]
  const jy = Y(-197)
  const jewel = `M-12 ${jy}C-17 ${jy - 10} -8 ${jy - 22} 0 ${jy - 33}C8 ${jy - 22} 17 ${jy - 10} 12 ${jy}Z`
  // stone bodies: one soft wash each, edges bleeding a little into the paper
  p.wash(ell(6, 1, 64, 7), 0.16, 'sh')
  for (const pts of [base, pillar, plat, box]) p.wash(poly(P(pts)), 1, 'stn')
  p.wash(poly(R(roof)), 1, 'stn')
  p.wash(ell(0, jy, 17, 4.5), 1, 'stn')
  p.wash(jewel, 1, 'stn')
  // shadow faces with dry-brush grain
  p.dry(poly(P([[4, -24], [13, -24], [11, -61], [13, -98], [5, -98], [3, -61]])), 0.42, 'sh')
  p.dry(poly(P([[16, -116], [30, -116], [28, -164], [16, -164]])), 0.36, 'sh')
  p.dry(poly(R([[14, -194], [50, -175], [64, -176], [69, -172], [58, -165], [20, -165], [6, -192]])), 0.38, 'sh')
  p.dry(poly(P([[8, -24], [30, -24], [36, -14], [46, -10], [48, 0], [16, 0]])), 0.3, 'sh')
  p.dry(poly(P([[10, -98], [15, -98], [38, -108], [42, -116], [16, -116]])), 0.32, 'sh')
  // the window: dark opening, and the light that fills it
  const wTop = Y(-156)
  const wBot = Y(-124)
  const win = p.solid(rrD(-12, wTop, 24, wBot - wTop, 2), 'win')
  const lit = p.group()
  const wy = (wTop + wBot) / 2
  const flame = s('path', { class: 'flame', d: `M0 ${wy + 9}C-6 ${wy + 9} -6.5 ${wy + 1} 0 ${wy - 10}C6.5 ${wy + 1} 6 ${wy + 9} 0 ${wy + 9}Z` })
  // light spilling out of the opening onto the stone, a warm wash inside it, and the flame
  lit.append(
    s('ellipse', { class: 'bloom', cx: 0, cy: wy, rx: 44, ry: 40 }),
    s('path', { class: 'lit', d: rrD(-10.6, wTop + 1.4, 21.2, wBot - wTop - 2.8, 1.5) }),
    flame)
  p.line(arc(-21, Y(-141), 4.2, 4.2, -80, 260, 14), 1.1, { a: 0.2, b: 0.3, cls: 'k3' })
  p.line(arc(21, Y(-141), 4.2, 4.2, 100, 440, 14), 1.4, { a: 0.2, b: 0.3, cls: 'k2' })
  lit.setAttribute('opacity', '0')
  // outlines: thin and grey where the light falls, heavy on the shadow side
  p.line(P([[-46, -10], [-36, -14], [-30, -24]]), 2.2, { a: 0.1, b: 0.2, cls: 'k2' })
  p.line(P([[30, -24], [36, -14], [46, -10]]), 3, { a: 0.1, b: 0.2 , cls: 'e' })
  p.line(P([[-50, 0], [50, 0]]), 3.6, { ...S, a: 0.05, b: 0.12 , cls: 'e' })
  p.line(P([[47, -10], [48, -1]]), 3, { ...S, a: 0.1, b: 0.2 , cls: 'e' })
  p.line(P([[-13, -25], [-11, -61], [-13, -97]]), 1.8, { a: 0.1, b: 0.2, cls: 'k2' })
  p.line(P([[13, -25], [11, -61], [13, -97]]), 3.6, { a: 0.08, b: 0.15 , cls: 'e' })
  p.line(P([[-14, -58], [14, -58]]), 2.4, { ...S, a: 0.1, b: 0.2 , cls: 'e' })
  p.line(P([[-13, -64], [13, -64]]), 1.4, { ...S, a: 0.1, b: 0.2, cls: 'k2' })
  p.line(P([[-15, -98], [-38, -108], [-42, -116]]), 2, { a: 0.1, b: 0.1, cls: 'k2' })
  p.line(P([[15, -98], [38, -108], [42, -116]]), 3, { a: 0.1, b: 0.1 , cls: 'e' })
  p.line(P([[-43, -116], [43, -116]]), 2.6, { ...S, a: 0.05, b: 0.1 , cls: 'e' })
  for (const x of [-26, -9, 9, 26]) p.line(P([[x - 7, -103], [x, -111], [x + 7, -103]]), 1.2, { a: 0.2, b: 0.3, cls: 'k3' })
  p.line(P([[-30, -117], [-28, -163]]), 1.8, { ...S, a: 0.1, b: 0.1, cls: 'k2' })
  p.line(P([[30, -117], [28, -163]]), 3.4, { ...S, a: 0.1, b: 0.1 , cls: 'e' })
  p.line(P([[-21, -118], [-20, -162]]), 1.2, { ...S, a: 0.2, b: 0.2, cls: 'k3' })
  p.line(P([[21, -118], [20, -162]]), 1.2, { ...S, a: 0.2, b: 0.2, cls: 'k3' })
  p.line(rrPts(-12, wTop, 24, wBot - wTop, 2), 2.2, { a: 0.05, b: 0.1 , cls: 'e' })
  p.line(R([[-14, -194], [-50, -175], [-64, -176], [-71, -183]]), 2.8, { a: 0.05, b: 0.35 , cls: 'e' })
  p.line(R([[14, -194], [50, -175], [64, -176], [71, -183]]), 4, { a: 0.05, b: 0.35 , cls: 'e' })
  p.line(R([[-69, -172], [-58, -165], [58, -165], [69, -172]]), 2.4, { a: 0.1, b: 0.1 , cls: 'e' })
  p.line(R([[-6, -193], [-28, -167]]), 1.2, { ...S, a: 0.1, b: 0.5, cls: 'k3' })
  p.line(R([[7, -193], [30, -167]]), 1.6, { ...S, a: 0.1, b: 0.5, cls: 'k2' })
  p.line(arc(0, jy, 17, 4.5, 0, 180, 12), 2, { a: 0.1, b: 0.2 , cls: 'e' })
  p.line([[-12, jy - 1], [-15, jy - 9], [-8, jy - 21], [0, jy - 33]], 1.8, { a: 0.05, b: 0.1, cls: 'k2' })
  p.line([[0, jy - 33], [8, jy - 21], [15, jy - 9], [12, jy - 1]], 3, { a: 0.1, b: 0.1 , cls: 'e' })
  // moss on the roof's shoulder and the base
  const r = rng(Math.round((o.moss ?? 1) * 17))
  for (let k = 0; k < 9; k++) p.solid(ell(-58 + r() * 34, Y(-170 - r() * 8), 1.6 + r() * 2.6, 1 + r() * 1.4), 'm').setAttribute('fill-opacity', (0.5 + r() * 0.45).toFixed(2))
  for (let k = 0; k < 8; k++) p.solid(ell(-46 + r() * 30, -2 - r() * 7, 1.6 + r() * 2.4, 1 + r() * 1.2), 'm').setAttribute('fill-opacity', (0.5 + r() * 0.45).toFixed(2))
  // the light lives outside the filtered layers: a flickering flame must not re-run the ink filters every frame
  ;(lit.parentNode?.parentNode as SVGGElement | null)?.append(lit)
  return { win, lit, flame, wy, top: jy - 33 }
}

// ───────────────────────── a river stone (an app) ─────────────────────────
/** A rounded boulder centred on 0,0 (its foot at y ≈ 0.48r). Returns the foot height for labels. */
export function boulder(p: Pen, r: number, seed: number, sx = 1.1, sy = 0.8) {
  const q = rng(seed)
  const s1 = q() * 6
  const s2 = q() * 6
  const f = sy / 0.8
  const pt = (deg: number): Pt => {
    const t = (deg * Math.PI) / 180
    const k = 1 + 0.05 * Math.sin(2 * t + s1) + 0.04 * Math.sin(3 * t + s2)
    let y = Math.sin(t) * r * k * sy - r * 0.06 * f
    if (y > r * 0.42 * f) y = r * 0.42 * f + (y - r * 0.42 * f) * 0.25
    return [Math.cos(t) * r * k * sx, y]
  }
  const ring = (a0: number, a1: number, n = 20) => Array.from({ length: n + 1 }, (_, i) => pt(a0 + ((a1 - a0) * i) / n))
  p.wash(ell(r * 0.2, r * 0.48 * f, r * 1.14 * sx, r * 0.16), 0.24, 'sh')
  p.wash(poly(ring(0, 360, 36)), 1, 'stn')
  p.dry(brush(ring(-30, 130, 16).map(([x, y]) => [x * 0.86, y * 0.86] as Pt), r * 0.34, { a: 0.2, b: 0.3 }).d, 0.32, 'sh')
  p.line(ring(-34, 150, 22), Math.max(1.6, r * 0.085), { a: 0.12, b: 0.3, wob: 0.16 , cls: 'e' })
  p.line(ring(170, 300, 16), Math.max(1, r * 0.035), { a: 0.25, b: 0.35, cls: 'k2' })
  p.line(ring(205, 255, 8).map(([x, y]) => [x * 0.82, y * 0.78] as Pt), Math.max(1, r * 0.05), { a: 0.3, b: 0.4, cls: 'rim' })
  for (let k = 0; k < 6; k++) {
    const [x, y] = pt(120 + q() * 60)
    p.solid(ell(x * (0.85 + q() * 0.2), y * (0.9 + q() * 0.15), r * (0.03 + q() * 0.04) + 0.6, r * (0.02 + q() * 0.03) + 0.5), 'm').setAttribute('fill-opacity', (0.5 + q() * 0.4).toFixed(2))
  }
  return r * 0.48 * f
}

// ───────────────────────── generic ink icons (no brand marks) ─────────────────────────
/** A small icon centred on 0,0, about 28 units across. */
export function appIcon(p: Pen, id: AppId, w = 2.2, cls = 'k') {
  const o = { a: 0.08, b: 0.2, cls }
  switch (id) {
    case 'drive': // a folder
      p.line([[-13, -4], [-13, 10], [13, 10], [13, -3], [0, -3], [-3, -8], [-11, -8], [-13, -5]], w, { ...S, ...o })
      p.line([[-13, -1], [13, -1]], w * 0.6, { ...S, ...o, cls: 'k3' })
      break
    case 'gmail': // an envelope
      p.line(rrPts(-13, -9, 26, 18, 2), w, o)
      p.line([[-12, -8], [0, 2], [12, -8]], w * 0.8, { ...S, ...o })
      break
    case 'slack': // a speech bubble
      p.line(rrPts(-13, -11, 26, 17, 6), w, o)
      p.line([[-5, 6], [-8, 13], [1, 6]], w * 0.8, { ...S, ...o })
      for (const x of [-6, 0, 6]) p.solid(ell(x, -2.5, 1.5), cls)
      break
    case 'figma': // a pen nib (design)
      p.line([[0, -13], [9, 1], [4, 12], [-4, 12], [-9, 1], [0, -13]], w, { ...S, ...o })
      p.line([[0, -13], [0, 0]], w * 0.6, { ...S, ...o })
      p.solid(ell(0, 2, 2.2), cls)
      p.line([[-5, 15], [5, 15]], w * 0.8, { ...S, ...o })
      break
    case 'db': // a cylinder
      p.line(arc(0, -8, 11, 4, 0, 360, 20), w, o)
      p.line([[-11, -8], [-11, 9]], w, { ...S, ...o })
      p.line([[11, -8], [11, 9]], w, { ...S, ...o })
      p.line(arc(0, 0.5, 11, 4, 0, 180, 12), w * 0.6, { ...o, cls: 'k3' })
      p.line(arc(0, 9, 11, 4, 0, 180, 12), w, o)
      break
    case 'blender': // a cube (3D)
      p.line([[0, -13], [12, -6], [12, 7], [0, 14], [-12, 7], [-12, -6], [0, -13]], w, { ...S, ...o })
      p.line([[-12, -6], [0, 1], [12, -6]], w * 0.7, { ...S, ...o })
      p.line([[0, 1], [0, 14]], w * 0.7, { ...S, ...o })
      break
  }
}

// ───────────────────────── plug & port ─────────────────────────
/** The one plug shape every app shares (a pill, like USB-C). Centre 0,0, pointing right. */
export function plugShape(k = 1) {
  const g = s('g', { class: 't16-plug' })
  g.append(
    s('path', { class: 'plug-tip', d: rrD(-13 * k, -3 * k, 5 * k, 6 * k, 1.5 * k) }),
    s('path', { class: 'plug-tip', d: rrD(2 * k, -3.3 * k, 10 * k, 6.6 * k, 3.3 * k) }),
    s('path', { class: 'plug-body', d: rrD(-10 * k, -5.5 * k, 14 * k, 11 * k, 4 * k) }),
    s('path', { class: 'plug-line', d: rrD(6 * k, -0.7 * k, 4 * k, 1.4 * k, 0.7 * k) }))
  return g
}

/** A low, wide river stone with the universal socket carved in its face. Centre of the socket = 0,0. */
export function portStone(p: Pen, w = 70) {
  const q = rng(5)
  const pt = (deg: number): Pt => {
    const t = (deg * Math.PI) / 180
    const k = 1 + 0.04 * Math.sin(2 * t + 1.3) + 0.03 * Math.sin(3 * t + 0.4)
    let y = Math.sin(t) * w * 0.36 * k - w * 0.02
    if (y > w * 0.24) y = w * 0.24 + (y - w * 0.24) * 0.25
    return [Math.cos(t) * w * 0.56 * k, y]
  }
  const ring = (a0: number, a1: number, n = 20) => Array.from({ length: n + 1 }, (_, i) => pt(a0 + ((a1 - a0) * i) / n))
  p.wash(ell(w * 0.08, w * 0.27, w * 0.66, w * 0.09), 0.26, 'sh')
  p.wash(poly(ring(0, 360, 40)), 1, 'stn')
  p.dry(brush(ring(-20, 120, 16).map(([x, y]) => [x * 0.84, y * 0.8] as Pt), w * 0.16, { a: 0.2, b: 0.3 }).d, 0.3, 'sh')
  p.line(ring(-30, 160, 24), Math.max(1.8, w * 0.045), { a: 0.12, b: 0.3, wob: 0.14 , cls: 'e' })
  p.line(ring(175, 300, 14), Math.max(1, w * 0.02), { a: 0.25, b: 0.35, cls: 'k2' })
  for (let k = 0; k < 7; k++) {
    const [x, y] = pt(150 + q() * 50)
    p.solid(ell(x * (0.85 + q() * 0.2), y * (0.9 + q() * 0.1), w * 0.012 + 0.8 + q() * 1.4, w * 0.008 + 0.6 + q()), 'm').setAttribute('fill-opacity', (0.5 + q() * 0.4).toFixed(2))
  }
  // the socket: a carved pill with its tongue
  p.solid(rrD(-w * 0.19, -w * 0.07, w * 0.38, w * 0.14, w * 0.07), 'k')
  p.solid(rrD(-w * 0.115, -w * 0.016, w * 0.23, w * 0.032, w * 0.016), 'stn')
  p.line(arc(0, 0, w * 0.215, w * 0.095, 200, 340, 10), Math.max(1, w * 0.018), { a: 0.3, b: 0.3, cls: 'rim' })
}

// ───────────────────────── raked sand ─────────────────────────
export interface Ring {
  x: number
  y: number
  /** inner radius (x); rings are flattened 0.34 in y */
  r: number
  n: number
}

/** Straight rakes from `top` down, broken around each stone by a set of concentric rings. */
export function sand(id: string, W: number, H: number, top: number, rings: Ring[], gap = 8) {
  const g = s('g', { class: 't16-sand', 'aria-hidden': 'true' })
  const R = (r: Ring) => r.r + r.n * gap
  const mask = s('mask', { id, maskUnits: 'userSpaceOnUse', x: -20, y: 0, width: W + 40, height: H },
    s('rect', { x: -20, y: 0, width: W + 40, height: H, fill: `url(#${id}-f)` }),
    ...rings.map((r) => s('path', { d: ell(r.x, r.y, R(r) + gap * 0.4, (R(r) + gap * 0.4) * 0.34), fill: '#000' })))
  g.append(s('defs', null,
    s('linearGradient', { id: `${id}-f`, x1: 0, y1: 0, x2: 0, y2: 1 },
      s('stop', { offset: clamp(top / H, 0, 1), 'stop-color': '#fff', 'stop-opacity': 0 }),
      s('stop', { offset: clamp((top + H * 0.14) / H, 0, 1), 'stop-color': '#fff', 'stop-opacity': 1 })),
    mask))
  const rk = s('g', { mask: `url(#${id})` })
  for (let y = top, k = 0; y < H + 10; k++) {
    const pts: string[] = []
    for (let x = -12; x <= W + 26; x += 26) pts.push(`${x} ${(y + 1.1 * Math.sin(x / 43 + k * 0.7)).toFixed(1)}`)
    const d = `M${pts.join('L')}`
    rk.append(s('path', { d, class: 'rk' }), s('path', { d, class: 'rk-hi', transform: 'translate(0 1.5)' }))
    y += 6 + 10 * ((y - top) / Math.max(1, H - top))
  }
  g.append(rk)
  const rg = s('g')
  for (const r of rings) {
    for (let j = 0; j <= r.n; j++) {
      const rx = r.r + j * gap
      const d = ell(r.x, r.y, rx, rx * 0.34)
      rg.append(s('path', { d, class: 'rk' }), s('path', { d, class: 'rk-hi', transform: 'translate(0 1.5)' }))
    }
  }
  g.append(rg)
  return g
}

/** Shrink ring counts until no two ring sets touch. */
export function fitRings(rings: Ring[], gap = 8) {
  const R = (r: Ring) => r.r + r.n * gap
  for (let guard = 0; guard < 16; guard++) {
    let ok = true
    for (const [i, a] of rings.entries())
      for (const b of rings.slice(i + 1))
        if (Math.hypot(a.x - b.x, (a.y - b.y) / 0.34) < R(a) + R(b) + gap) {
          ok = false
          const big = a.n >= b.n ? a : b
          if (big.n > 0) big.n--
          else return rings
        }
    if (ok) break
  }
  return rings
}

/** A cord between two points that sags a little under its own weight (cubic, as an SVG path). */
export function cordD(a: Pt, b: Pt, sag = 0.18, bend = 0) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const d = Math.hypot(dx, dy)
  const g = d * sag
  const c1: Pt = [a[0] + dx * 0.3 - dy * bend, a[1] + dy * 0.3 + g + dx * bend]
  const c2: Pt = [a[0] + dx * 0.72 - dy * bend, a[1] + dy * 0.72 + g * 0.8 + dx * bend]
  return `M${f1(a[0])} ${f1(a[1])}C${f1(c1[0])} ${f1(c1[1])} ${f1(c2[0])} ${f1(c2[1])} ${f1(b[0])} ${f1(b[1])}`
}

/** The window's warm light, its bloom and the flame (ids shared by every scene: same definitions, so duplicates are harmless). */
export function litDefs() {
  const f = document.createDocumentFragment()
  f.append(
    s('radialGradient', { id: 't16-litg', cy: '64%', r: '72%' },
      s('stop', { offset: 0, class: 'lit0' }),
      s('stop', { offset: 0.5, class: 'litm' }),
      s('stop', { offset: 1, class: 'lit1' })),
    s('radialGradient', { id: 't16-bloom' },
      s('stop', { offset: 0, class: 'bl0' }),
      s('stop', { offset: 0.45, class: 'bl1' }),
      s('stop', { offset: 1, class: 'bl2' })),
    s('radialGradient', { id: 't16-flame', cy: '70%', r: '60%' },
      s('stop', { offset: 0, class: 'fl0' }),
      s('stop', { offset: 1, class: 'fl1' })))
  return f
}

/** Light pooled around a lit lantern: a radial gradient (warm vermilion), id must be unique per scene. */
export function glowDefs(id: string) {
  return s('radialGradient', { id },
    s('stop', { offset: 0, class: 'glow0' }),
    s('stop', { offset: 0.45, class: 'glow1' }),
    s('stop', { offset: 1, class: 'glow2' }))
}
