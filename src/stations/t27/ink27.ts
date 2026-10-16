import { s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { blob, curve, rng, stroke, type Pt } from '../../ui/part2/ink'

/** Station 27 painting kit: gradients that read tokens, a moss boulder with real light, a lit stone lantern. */
export const F = (x: unknown) => x as Fact
export const f1 = (n: number) => n.toFixed(1)
export const P = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`
export const poly = (pts: Pt[]) => `M${pts.map(P).join('L')}Z`

type Stop = [number, string, number | string]
const stops = (st: Stop[]) => st.map(([o, c, a]) => s('stop', { offset: o, style: `stop-color:var(${c});stop-opacity:${a}` }))
/** A linear gradient (bounding box units unless `user`). */
export const lin = (id: string, x1: number, y1: number, x2: number, y2: number, st: Stop[], user = false) =>
  s('linearGradient', { id, x1: f1(x1), y1: f1(y1), x2: f1(x2), y2: f1(y2), ...(user ? { gradientUnits: 'userSpaceOnUse' } : {}) }, ...stops(st))
export const rad = (id: string, st: Stop[], at?: { cx: number; cy: number; r: number; fx?: number; fy?: number }) =>
  s('radialGradient', at ? { id, gradientUnits: 'userSpaceOnUse', cx: f1(at.cx), cy: f1(at.cy), r: f1(at.r), ...(at.fx != null ? { fx: f1(at.fx), fy: f1(at.fy!) } : {}) } : { id }, ...stops(st))

/** A jagged crack through pts: a dark split with a moonlit lower lip. */
export function crack(pts: Pt[], w: number, seed: number) {
  const r = rng(seed)
  const z: Pt[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]]
    for (let k = 0; k < 4; k++) {
      const t = k / 4
      z.push([a[0] + (b[0] - a[0]) * t + (r() - 0.5) * w * 0.8, a[1] + (b[1] - a[1]) * t + (r() - 0.5) * w * 1.2])
    }
  }
  z.push(pts[pts.length - 1])
  return { split: stroke(z, w, 0.25, 0.3, 0.15), lip: stroke(z.map(([x, y]) => [x + w * 0.2, y + w * 0.75] as Pt), w * 0.45, 0.3, 0.3, 0.1) }
}

/** A boulder's outline standing on (x, y): a lopsided dome (crown left of centre), a broad sunk foot, a wobbling contour. */
export function domePts(x: number, y: number, w: number, h: number, seed: number, crown = -0.12): Pt[] {
  const r = rng(seed)
  const ph = [r() * 6, r() * 6, r() * 6]
  const N = 44
  const pts: Pt[] = []
  for (let i = 0; i <= N; i++) {
    const t = i / N // 0 = left foot … 1 = right foot, over the top
    const a = Math.PI * (1 - t)
    const c = Math.cos(a), sn = Math.sin(a)
    // fuller on the left shoulder, a long slope down the right; the crown pushed toward `crown`
    const sx = Math.sign(c) * Math.pow(Math.abs(c), 0.82)
    const lean = (1 - Math.abs(c)) * crown
    const k = 1 + 0.035 * (Math.sin(t * 9 + ph[0]) + 0.6 * Math.sin(t * 17 + ph[1]) + 0.4 * Math.sin(t * 29 + ph[2]))
    const hh = h * Math.pow(sn, t < 0.5 + crown * 0.5 ? 0.6 : 0.68) * k
    pts.push([x + (sx * 0.5 + lean * 0.5) * w * (0.97 + 0.03 * k), y - hh])
  }
  pts[0] = [x - w * 0.5, y]
  pts[N] = [x + w * 0.5, y]
  return pts
}

/**
 * A moss boulder standing on (x, y), w × h, lit by the moon from the upper right in three tones (p2-rock): a lit cap
 * (--rock-hi) over the crown and right shoulder, a mid half-tone, a shadow side (--rock-lo) down the left, each edge a
 * wavering brushed terminator; a core shadow along the shadow's edge, dry strokes in the shade, moss on the crown, a moon
 * rim on the upper right, a faint warm breath from the lantern low on the right flank, contact shadow and raked rings.
 */
export function boulder(id: string, x: number, y: number, w: number, h: number, seed: number, o: { moss?: number; warm?: number; rings?: number; extra?: SVGElement[]; crown?: number } = {}): SVGElement[] {
  const r = rng(seed + 5)
  const pts = domePts(x, y, w, h, seed, o.crown ?? -0.12)
  const n = pts.length
  const out = `M${pts.map(P).join('L')}Q${f1(x)} ${f1(y + h * 0.04)} ${P(pts[0])}Z`
  const crown = pts.reduce((a, b) => (b[1] < a[1] ? b : a))
  const ci = pts.indexOf(crown)
  // a terminator from a to b: a quadratic belly through c, nudged off line by a brushed wobble (never a smooth arc)
  const term = (a: Pt, c: Pt, b: Pt, k: number) => curve(a, c, b, 16).map(([px, py], i) => {
    const t = i / 15, e = Math.sin(t * Math.PI)
    return [px + e * (Math.sin(t * 7.3 + seed + k) * w * 0.022 + Math.sin(t * 19 + seed * 1.7 + k) * w * 0.009 + (r() - 0.5) * w * 0.012), py + e * (r() - 0.5) * h * 0.02] as Pt
  })
  // lit cap: the contour from the left shoulder over the crown down the right flank, closed by a terminator bellying down-left
  const ia = Math.max(3, ci - Math.round(n * 0.16)), ib = Math.min(n - 3, Math.round(n * 0.9))
  const tLit = term(pts[ib], [x - w * 0.02, y - h * 0.22], pts[ia], 1)
  const lit = `M${pts.slice(ia, ib + 1).map(P).join('L')}L${tLit.map(P).join('L')}Z`
  // shadow side: a crescent hugging the left flank and the foot, its terminator bellying toward the lower left
  const is = Math.max(2, ia - 3)
  const tShade = term(pts[is], [x - w * 0.16, y - h * 0.18], [x + w * 0.26, y + 3], 2)
  const shade = `M${pts.slice(0, is + 1).map(P).join('L')}L${tShade.map(P).join('L')}L${f1(x - w * 0.5)} ${f1(y + 4)}Z`
  // the core: darkest just inside the shadow edge; bounce light along the far left contour
  const core = stroke(tShade.map(([px, py], i) => [px - w * 0.03 * Math.sin((i / 15) * Math.PI), py + h * 0.04 * Math.sin((i / 15) * Math.PI)] as Pt), w * 0.1, 0.3, 0.2, 0.3)
  const bounce = stroke(pts.slice(1, Math.max(3, is - 1)).map(([px, py]) => [px + w * 0.035, py + h * 0.02] as Pt), w * 0.03, 0.4, 0.3, 0.1)
  // the brush along each terminator: dry, broken
  const edgeBrush = stroke(tLit.slice(2, 14), w * 0.012, 0.3, 0.3, 0.1) + stroke(tShade.slice(1, 13), w * 0.016, 0.2, 0.3, 0.1)
  // texture: dry strokes falling down the shaded flank, a few on the half-tone; faint seams across the lit face
  let cun = ''
  for (let i = 2; i < n - 2; i++) {
    const [px, py] = pts[i]
    const inShade = i <= is + 2
    if (r() < (inShade ? 0.3 : 0.86)) continue
    const len = h * (0.12 + r() * 0.32), dir = px < crown[0] ? -1 : 1
    cun += stroke(curve([px - dir * 2, py + 6], [px + dir * len * 0.12, py + len * 0.5], [px - dir * len * 0.05, py + len], 6), 1 + r() * 2.2, 0.1, 0.5, 0.1)
  }
  for (let i = 0; i < 5; i++) {
    const px = x - w * (0.42 - r() * 0.22), py = y - h * (0.1 + r() * 0.4), len = h * (0.1 + r() * 0.16)
    cun += stroke([[px, py], [px + w * 0.02, py + len * 0.5], [px - w * 0.01, py + len]], 1 + r() * 1.6, 0.2, 0.5, 0.1)
  }
  let seams = ''
  for (let i = 0; i < 2; i++) {
    const yy = y - h * (0.42 + i * 0.18), x0 = x + w * (0.04 + r() * 0.08)
    seams += stroke(curve([x0, yy], [x0 + w * 0.12, yy - h * 0.05], [x0 + w * (0.24 + r() * 0.08), yy + h * 0.02], 8), 1.1, 0.25, 0.4, 0.1)
  }
  // moss on the crown: a ragged cap whose lower edge drips, lit tufts on top, a dark seam under it
  let moss = '', mossHi = '', mossLo = ''
  const m = o.moss ?? 0.6
  if (m > 0) {
    const i0 = Math.max(2, Math.round(ci - n * m * 0.32)), i1 = Math.min(n - 3, Math.round(ci + n * m * 0.26))
    const band = pts.slice(i0, i1 + 1)
    const L = band.length
    const depth = (k: number) => h * (0.03 + 0.11 * Math.sin((k / (L - 1)) * Math.PI) * (0.6 + 0.4 * Math.sin(k * 1.7 + seed)) + r() * 0.02)
    const lower = band.map(([px, py], k) => [px + (r() - 0.5) * 3, py + depth(k)] as Pt)
    moss = `M${band.map(([px, py]) => P([px, py - 2])).join('L')}L${[...lower].reverse().map(P).join('L')}Z`
    lower.forEach(([px, py], k) => {
      if (r() < 0.3) moss += blob(px, py + h * 0.02, w * 0.008 + r() * w * 0.01, h * (0.02 + r() * 0.03), seed + k, 0.25, 8)
    })
    mossLo = stroke(lower, Math.max(1.2, h * 0.012), 0.2, 0.2, 0.2)
    for (let k = 0; k < L; k++) {
      const [px, py] = band[k]
      if (r() < 0.5 && px > crown[0] - w * 0.1) mossHi += blob(px + (r() - 0.2) * 5, py + h * 0.012, w * 0.01 + r() * w * 0.012, h * 0.014, seed + k + 50, 0.3, 7)
    }
  }
  // the moon rim: a thin bright sliver just inside the upper-right contour
  const rim = stroke(pts.slice(Math.max(0, ci - 3), Math.round(n * 0.84)).map(([a, b]) => [a - 1.4, b + 2] as Pt), Math.max(1.8, w * 0.008), 0.15, 0.4, 0.1)
  const edge = stroke(pts.slice(0, ci - 1), Math.max(2, w * 0.01), 0.05, 0.25, 0.35) + stroke(pts.slice(Math.round(n * 0.78)), Math.max(1.4, w * 0.006), 0.3, 0.05, 0.3) +
    stroke([[x - w * 0.49, y + 1], [x - w * 0.1, y + h * 0.035], [x + w * 0.49, y + 1]], Math.max(2, w * 0.009), 0.1, 0.1, 0.4)
  let rings = ''
  for (let k = 0; k < (o.rings ?? 3); k++) {
    const rx = w * 0.6 + k * Math.max(14, w * 0.06), ry = rx * 0.085
    rings += stroke(Array.from({ length: 41 }, (_, i) => [x + Math.cos((i / 40) * Math.PI * 2) * rx, y + h * 0.015 + Math.sin((i / 40) * Math.PI * 2) * ry] as Pt), 1.2, 0, 0, 1)
  }
  const clip = `${id}-c`
  return ([
    s('defs', null,
      s('clipPath', { id: clip }, s('path', { d: out })),
      lin(`${id}-hi`, 0, y - h, 0, y - h * 0.2, [[0, '--rock-hi', 1], [1, '--rock-hi', 0.75]], true),
      rad(`${id}-warm`, [[0, '--lantern', 0.9], [1, '--lantern', 0]], { cx: x + w * 0.5, cy: y - h * 0.18, r: w * 0.3 }),
      lin(`${id}-foot`, 0, y - h * 0.3, 0, y, [[0, '--umbra', 0], [1, '--umbra', 0.45]], true),
      rad(`${id}-sh`, [[0, '--umbra', 0.6], [0.55, '--umbra', 0.28], [1, '--umbra', 0]])),
    s('path', { class: 't27-rings', d: rings }),
    s('ellipse', { class: 't27-cast', cx: f1(x - w * 0.44), cy: f1(y + h * 0.05), rx: f1(w * 0.7), ry: f1(Math.max(6, h * 0.08)), fill: `url(#${id}-sh)` }),
    s('ellipse', { class: 't27-contact', cx: f1(x + w * 0.02), cy: f1(y + h * 0.02), rx: f1(w * 0.55), ry: f1(Math.max(4, h * 0.045)) }),
    s('path', { class: 't27-rock-mid', d: out, filter: 'url(#ink-rough)' }),
    s('g', { 'clip-path': `url(#${clip})` },
      s('path', { class: 't27-rock-lit', d: lit, fill: `url(#${id}-hi)`, filter: 'url(#ink-wash)' }),
      s('path', { class: 't27-rock-lo', d: shade, filter: 'url(#ink-wash)' }),
      s('path', { class: 't27-rock-core', d: core, filter: 'url(#ink-wash)' }),
      s('path', { class: 't27-rock-bounce', d: bounce, filter: 'url(#ink-wash)' }),
      s('rect', { x: f1(x - w * 0.6), y: f1(y - h * 0.32), width: f1(w * 1.2), height: f1(h * 0.34), fill: `url(#${id}-foot)` }),
      (o.warm ?? 0) > 0 ? s('rect', { class: 't27-rock-warm', x: f1(x + w * 0.15), y: f1(y - h * 0.55), width: f1(w * 0.4), height: f1(h * 0.6), fill: `url(#${id}-warm)`, style: `--w:${o.warm}` }) : null,
      s('path', { class: 't27-rock-term', d: edgeBrush, filter: 'url(#ink-dry)' }),
      s('path', { class: 't27-rock-cun', d: cun, filter: 'url(#ink-dry)' }),
      s('path', { class: 't27-rock-seam', d: seams }),
      ...(o.extra ?? []),
      moss ? s('path', { class: 't27-moss', d: moss, filter: 'url(#ink-wash)' }) : null,
      mossLo ? s('path', { class: 't27-moss-lo', d: mossLo }) : null,
      mossHi ? s('path', { class: 't27-moss-hi', d: mossHi }) : null),
    s('path', { class: 't27-rim', d: rim }),
    s('path', { class: 't27-edge', d: edge, filter: 'url(#ink-rough)' }),
  ] as (SVGElement | null)[]).filter((e): e is SVGElement => !!e)
}

/** Lantern geometry in units of `H / 10` from its foot (x, y): where the firebox's two windows are, for a face. */
export const lanternWindows = (x: number, y: number, H: number): [Pt, Pt, number] => {
  const u = H / 10
  return [[x - u * 0.46, y - u * 6.05], [x + u * 0.46, y - u * 6.05], u * 0.3]
}

/**
 * A Kasuga stone lantern standing on (x, y), H tall, seen from a little left and below its roof: base, post, platform,
 * a firebox with a round "sun" and a crescent "moon" window (lit), a curled roof whose underside catches the flame,
 * the jewel. Moon from the upper right (right faces lit), warm light pooled on the sand round its foot.
 */
export function lantern(id: string, x: number, y: number, H: number, lit = true): SVGElement[] {
  return lanternParts(id, x, y, H, lit).filter((e): e is SVGElement => !!e)
}
function lanternParts(id: string, x: number, y: number, H: number, lit: boolean): (SVGElement | null)[] {
  const u = H / 10
  const X = (v: number) => x + v * u, Y = (v: number) => y - v * u
  const quad = (l0: number, r0: number, b: number, l1: number, r1: number, t: number) => `M${f1(X(l0))} ${f1(Y(b))}L${f1(X(r0))} ${f1(Y(b))}L${f1(X(r1))} ${f1(Y(t))}L${f1(X(l1))} ${f1(Y(t))}Z`
  const side = (l0: number, b: number, l1: number, t: number, d: number) => `M${f1(X(l0))} ${f1(Y(b))}L${f1(X(l0 - d))} ${f1(Y(b + d * 0.25))}L${f1(X(l1 - d))} ${f1(Y(t + d * 0.25))}L${f1(X(l1))} ${f1(Y(t))}Z`
  const lens = (cx: number, cy: number, rx: number, ry: number) => `M${f1(X(cx - rx))} ${f1(Y(cy))}Q${f1(X(cx))} ${f1(Y(cy + ry * 2))} ${f1(X(cx + rx))} ${f1(Y(cy))}Q${f1(X(cx))} ${f1(Y(cy - ry * 2))} ${f1(X(cx - rx))} ${f1(Y(cy))}Z`
  // fronts (lit from the right) and the left sides we see (in shade)
  const fronts =
    quad(-1.3, 1.3, 0, -1.05, 1.05, 0.75) + quad(-0.42, 0.42, 0.75, -0.36, 0.36, 4.2) + quad(-0.95, 0.95, 4.2, -1.35, 1.35, 5.0) +
    quad(-1.0, 1.0, 5.0, -1.0, 1.0, 7.0)
  const sides = side(-1.3, 0, -1.05, 0.75, 0.42) + side(-0.95, 4.2, -1.35, 5.0, 0.4) + side(-1.0, 5.0, -1.0, 7.0, 0.42)
  // the roof: broad eaves with curled tips, sloping up to a cap
  const roof = `M${f1(X(-2.25))} ${f1(Y(7.45))}Q${f1(X(-2.05))} ${f1(Y(7.1))} ${f1(X(-1.6))} ${f1(Y(7.05))}L${f1(X(1.6))} ${f1(Y(7.05))}Q${f1(X(2.05))} ${f1(Y(7.1))} ${f1(X(2.25))} ${f1(Y(7.45))}` +
    `Q${f1(X(1.9))} ${f1(Y(7.35))} ${f1(X(1.55))} ${f1(Y(7.4))}Q${f1(X(0.9))} ${f1(Y(7.7))} ${f1(X(0.45))} ${f1(Y(8.25))}L${f1(X(-0.45))} ${f1(Y(8.25))}Q${f1(X(-0.9))} ${f1(Y(7.7))} ${f1(X(-1.55))} ${f1(Y(7.4))}Q${f1(X(-1.9))} ${f1(Y(7.35))} ${f1(X(-2.25))} ${f1(Y(7.45))}Z`
  const under = `M${f1(X(-1.6))} ${f1(Y(7.05))}L${f1(X(1.6))} ${f1(Y(7.05))}L${f1(X(1.15))} ${f1(Y(6.9))}L${f1(X(-1.15))} ${f1(Y(6.9))}Z`
  const jewel = lens(0, 8.35, 0.55, 0.08) +
    `M${f1(X(-0.42))} ${f1(Y(8.45))}Q${f1(X(-0.55))} ${f1(Y(8.95))} ${f1(X(-0.1))} ${f1(Y(9.35))}Q${f1(X(0))} ${f1(Y(9.55))} ${f1(X(0.06))} ${f1(Y(9.75))}Q${f1(X(0.1))} ${f1(Y(9.5))} ${f1(X(0.12))} ${f1(Y(9.35))}Q${f1(X(0.55))} ${f1(Y(8.95))} ${f1(X(0.42))} ${f1(Y(8.45))}Z`
  const [wl, wr, wr0] = lanternWindows(x, y, H)
  const sun = blob(wl[0], wl[1], wr0, wr0 * 1.05, 7, 0.04, 14)
  // crescent: the outer disc less a disc shifted left
  const cr = wr0 * 1.05
  const moonWin = `M${f1(wr[0])} ${f1(wr[1] - cr)}A${f1(cr)} ${f1(cr)} 0 1 1 ${f1(wr[0])} ${f1(wr[1] + cr)}A${f1(cr * 0.82)} ${f1(cr * 0.9)} 0 1 0 ${f1(wr[0])} ${f1(wr[1] - cr)}Z`
  const sideWin = side(-1.09, 5.55, -1.09, 6.55, 0.25)
  const r = rng(Math.round(H))
  let moss = ''
  for (let i = 0; i < 9; i++) moss += blob(X(-1.4 + r() * 2.6), Y(7.3 + r() * 0.5) + u * 0.05, u * (0.12 + r() * 0.15), u * 0.06, 90 + i, 0.3, 8)
  for (let i = 0; i < 5; i++) moss += blob(X(-1.0 + r() * 2), Y(0.75) + u * 0.04, u * (0.1 + r() * 0.14), u * 0.05, 120 + i, 0.3, 8)
  const ink =
    stroke([[X(-2.25), Y(7.45)], [X(-1.6), Y(7.05)], [X(1.6), Y(7.05)], [X(2.25), Y(7.45)]], u * 0.16, 0.1, 0.1, 0.3) +
    stroke([[X(-1.05), Y(0.75)], [X(-1.3), Y(0)], [X(1.3), Y(0)]], u * 0.14, 0.05, 0.2, 0.3) +
    stroke([[X(-0.42), Y(0.75)], [X(-0.36), Y(4.2)]], u * 0.1, 0.1, 0.1, 0.3) +
    stroke([[X(-1.35), Y(5.0)], [X(-0.95), Y(4.2)], [X(0.95), Y(4.2)]], u * 0.12, 0.1, 0.2, 0.3) +
    stroke([[X(-1.0), Y(7.0)], [X(-1.0), Y(5.0)], [X(1.0), Y(5.0)]], u * 0.12, 0.1, 0.2, 0.3) +
    stroke([[X(-0.45), Y(8.25)], [X(-0.9), Y(7.7)], [X(-1.55), Y(7.4)]], u * 0.1, 0.2, 0.2, 0.3)
  const rim = stroke([[X(0.45), Y(8.22)], [X(0.9), Y(7.68)], [X(1.55), Y(7.38)], [X(2.2), Y(7.43)]], u * 0.08, 0.2, 0.3, 0.2) +
    stroke([[X(1.02), Y(5.05)], [X(1.02), Y(6.95)]], u * 0.07, 0.2, 0.2, 0.2) + stroke([[X(0.38), Y(0.8)], [X(0.34), Y(4.15)]], u * 0.06, 0.2, 0.2, 0.2) +
    stroke([[X(1.07), Y(0.05)], [X(1.3), Y(0.05)]], u * 0.06, 0.2, 0.2, 0.2) + stroke([[X(0.96), Y(4.25)], [X(1.34), Y(4.97)]], u * 0.06, 0.2, 0.2, 0.2)
  return [
    s('defs', null,
      lin(`${id}-f`, 0, 0, 1, 0, [[0, '--rock-mid', 1], [0.55, '--rock-hi', 1], [0.85, '--rock-hi', 1], [1, '--rock-mid', 1]]),
      lin(`${id}-post`, 0, 0, 1, 0, [[0, '--rock-lo', 1], [0.45, '--rock-mid', 1], [0.78, '--rock-hi', 1], [1, '--rock-mid', 1]]),
      rad(`${id}-pool`, [[0, '--lantern', 0.6], [0.45, '--lantern', 0.22], [1, '--lantern', 0]]),
      rad(`${id}-halo`, [[0, '--lantern', 0.55], [0.35, '--lantern', 0.2], [1, '--lantern', 0]]),
      rad(`${id}-win`, [[0, '--moon', 1], [0.55, '--lantern', 1], [1, '--lantern', 0.9]]),
      rad(`${id}-under`, [[0, '--lantern', 0.95], [1, '--lantern', 0]], { cx: x, cy: Y(6.95), r: u * 1.8 }),
      rad(`${id}-cast`, [[0, '--umbra', 0.5], [1, '--umbra', 0]])),
    s('ellipse', { class: 't27-pool t27-pool-wide', cx: f1(x - u * 0.6), cy: f1(y + u * 0.2), rx: f1(u * 10), ry: f1(u * 1.5), fill: `url(#${id}-pool)` }),
    s('ellipse', { class: 't27-pool', cx: f1(x + u * 0.2), cy: f1(y + u * 0.1), rx: f1(u * 5.2), ry: f1(u * 0.8), fill: `url(#${id}-pool)` }),
    s('ellipse', { class: 't27-cast', cx: f1(X(-1.9)), cy: f1(y + u * 0.18), rx: f1(u * 2.4), ry: f1(u * 0.26), fill: `url(#${id}-cast)` }),
    s('ellipse', { class: 't27-contact', cx: f1(x), cy: f1(y + u * 0.04), rx: f1(u * 1.45), ry: f1(u * 0.14) }),
    lit ? s('circle', { class: 't27-halo', cx: f1(x), cy: f1(Y(6.05)), r: f1(u * 3.8), fill: `url(#${id}-halo)` }) : null,
    s('path', { class: 't27-l-side', d: sides, filter: 'url(#ink-rough)' }),
    s('path', { class: 't27-l-front', d: fronts, fill: `url(#${id}-f)`, filter: 'url(#ink-rough)' }),
    s('path', { class: 't27-l-front', d: quad(-0.42, 0.42, 0.75, -0.36, 0.36, 4.2), fill: `url(#${id}-post)` }),
    s('path', { class: 't27-l-top', d: lens(0, 5.0, 1.35, 0.07) }),
    s('path', { class: 't27-l-recess', d: stroke([[X(-0.92), Y(5.12)], [X(-0.92), Y(6.92)], [X(0.92), Y(6.92)]], u * 0.12, 0.05, 0.05, 0.5) }),
    s('path', { class: 't27-l-win', d: sun + moonWin, fill: `url(#${id}-win)` }),
    s('path', { class: 't27-l-win t27-l-sidewin', d: sideWin }),
    s('path', { class: 't27-l-under', d: under }),
    lit ? s('path', { class: 't27-l-glow', d: under, fill: `url(#${id}-under)` }) : null,
    s('path', { class: 't27-l-roof', d: roof, fill: `url(#${id}-f)`, filter: 'url(#ink-rough)' }),
    s('path', { class: 't27-l-roofsh', d: `M${f1(X(-2.25))} ${f1(Y(7.45))}Q${f1(X(-1.9))} ${f1(Y(7.35))} ${f1(X(-1.55))} ${f1(Y(7.4))}Q${f1(X(-0.9))} ${f1(Y(7.7))} ${f1(X(-0.45))} ${f1(Y(8.25))}L${f1(X(-0.1))} ${f1(Y(8.25))}Q${f1(X(-0.5))} ${f1(Y(7.6))} ${f1(X(-1.4))} ${f1(Y(7.12))}Z`, filter: 'url(#ink-wash)' }),
    s('path', { class: 't27-l-front', d: jewel, fill: `url(#${id}-f)`, filter: 'url(#ink-rough)' }),
    s('path', { class: 't27-moss', d: moss, filter: 'url(#ink-wash)' }),
    s('path', { class: 't27-rim', d: rim }),
    s('path', { class: 't27-edge', d: ink, filter: 'url(#ink-rough)' }),
  ]
}
