// The "fruits" of the AI family tree, each a small painting in the tree's own brush language: a persimmon with an
// eye in it (AI nhận diện), a bunch of ink berries with one ripe for you (AI gợi ý), a little jointed arm holding a
// fruit it picked (Robot), a hanging calligraphy brush (AI tạo sinh); plain plum blossoms on its young branch;
// and, when a blossom is chosen, the brush paints that medium as a small picture on the empty paper.
import type { Palette } from './bonsai'
import { clamp, dab, inkLine, mix, rgba, rng, smooth, wash, type Pt, type RGB } from './paint'

type XY = [number, number]
type Tone = 'ink' | 'verm' | 'paper'
interface Mark {
  /** a brush stroke through these points */
  p?: XY[]
  /** stroke width in box units */
  w?: number
  head?: number
  tail?: number
  /** an ink dot [x, y, r] */
  dot?: [number, number, number]
  /** a wash: a soft-edged filled shape */
  wash?: XY[]
  /** opacity (strokes and dots 1, washes 0.3 by default) */
  a?: number
  tone?: Tone
}

const toneOf = (t: Tone | undefined, ink: RGB, pal: Palette) => (t === 'verm' ? pal.verm : t === 'paper' ? (pal.dark ? pal.paper : pal.card) : ink)

/** A wash laid with a soft, slightly bleeding edge: the shape filled a few times with jittered corners. */
function washShape(g: CanvasRenderingContext2D, pts: Pt[], color: RGB, alpha: number, seed: number) {
  const r = rng(seed * 31 + 7)
  const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length
  const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length
  for (const [f, al] of [[1.03, 0.45], [1, 0.45], [0.95, 0.45]] as const) {
    g.beginPath()
    for (const p of pts) {
      const j = () => (r() - 0.5) * 0.9
      g.lineTo(cx + (p.x - cx) * f + j(), cy + (p.y - cy) * f + j())
    }
    g.closePath()
    g.fillStyle = rgba(color, alpha * al)
    g.fill()
  }
}

/** Paint marks drawn in a box of `box` units, centred at (cx, cy), `size` px wide. k ∈ [0, 1] paints them in order. */
function paintMarks(g: CanvasRenderingContext2D, marks: Mark[], box: number, cx: number, cy: number, size: number, ink: RGB, pal: Palette, alpha = 1, upto?: { i: number; u: number }) {
  const sc = size / box
  const P = ([x, y]: XY): Pt => ({ x: cx + (x - box / 2) * sc, y: cy + (y - box / 2) * sc })
  marks.forEach((m, i) => {
    let u = 1
    if (upto) {
      if (i > upto.i) return
      if (i === upto.i) u = upto.u
    }
    if (u <= 0) return
    const col = toneOf(m.tone, ink, pal)
    if (m.wash) washShape(g, m.wash.map(P), col, (m.a ?? 0.3) * alpha * u, i + box)
    if (m.dot) {
      const p = P([m.dot[0], m.dot[1]])
      dab(g, p.x, p.y, Math.max(0.7, m.dot[2] * sc) * (0.4 + 0.6 * u), col, (m.a ?? 0.95) * alpha * Math.min(1, u * 2), i + 3)
    }
    if (m.p) inkLine(g, m.p.map(P), { w: Math.max(0.9, (m.w ?? 2.8) * sc), color: col, alpha: (m.a ?? 1) * alpha, head: m.head, tail: m.tail, upTo: u, seed: i + 5 })
  })
}
const rect = (x0: number, y0: number, x1: number, y1: number): XY[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]

const cache = new Map<string, HTMLCanvasElement>()
function cached(key: string, wpx: number, hpx: number, d: number, paint: (g: CanvasRenderingContext2D) => void) {
  let c = cache.get(key)
  if (c) return c
  c = document.createElement('canvas')
  c.width = Math.ceil(wpx * d)
  c.height = Math.ceil(hpx * d)
  const g = c.getContext('2d')!
  g.setTransform(d, 0, 0, d, 0, 0)
  paint(g)
  if (cache.size > 90) cache.clear()
  cache.set(key, c)
  return c
}
const palKey = (pal: Palette) => `${pal.dark}|${pal.ink.join()}|${pal.verm.join()}|${pal.paper.join()}`

// ───────── swinging on the cord ─────────
export interface Swing {
  t0: number
  amp: number
}
/** A damped pendulum after a tap, plus the slow breeze. */
export function swingAngle(sw: Swing, now: number, t: number, phase: number, breeze: boolean) {
  const dt = now - sw.t0
  let a = dt > 0 ? sw.amp * Math.exp(-dt * 1.2) * Math.sin(dt * 3.3) : 0
  if (breeze) a += 0.028 * Math.sin(t * 0.85 + phase)
  return a
}
export const swinging = (sw: Swing, now: number) => sw.amp * Math.exp(-(now - sw.t0) * 1.2) > 0.003

/** A soft warm glow. By night light is added (never a dark stain): a lifted vermilion, blended additively. */
export function warmGlow(g: CanvasRenderingContext2D, x: number, y: number, r: number, pal: Palette, a: number) {
  if (a <= 0 || r <= 0) return
  const col = pal.dark ? mix(pal.verm, pal.ink, 0.35) : pal.verm
  const al = pal.dark ? a * 0.55 : a
  const gl = g.createRadialGradient(x, y, 0, x, y, r)
  gl.addColorStop(0, rgba(col, al))
  gl.addColorStop(0.5, rgba(col, al * 0.4))
  gl.addColorStop(1, rgba(col, 0))
  const op = g.globalCompositeOperation
  if (pal.dark) g.globalCompositeOperation = 'lighter'
  g.fillStyle = gl
  g.fillRect(x - r, y - r, r * 2, r * 2)
  g.globalCompositeOperation = op
}

// ───────── the fruits ─────────
export type FruitId = 'recog' | 'rec' | 'robot'

/** Where a fruit's painting sits relative to its anchor (centre cx, cy) and how far it reaches sideways — for its name. */
export function fruitBox(id: FruitId, R: number, L: number) {
  if (id === 'recog') return { cx: 0, cy: L + R * 0.92, half: R }
  if (id === 'rec') return { cx: R * 0.6 * BUNCH, cy: R * 1.85 * BUNCH, half: R * 0.62 * BUNCH }
  return { cx: -R * 0.3, cy: R * 1.2, half: R * 0.85 }
}

/** AI nhận diện: a persimmon hanging on its stem, an eye brushed into it — unripe ink by default, ripe vermilion when chosen. */
function persimmon(R: number, L: number, ripe: boolean, pal: Palette, d: number) {
  const m = Math.ceil(R * 0.35) + 2
  const W = R * 2 + m * 2
  const H = L + R * 1.85 + m * 2
  return {
    m,
    img: cached(`ps|${R.toFixed(1)}|${L.toFixed(1)}|${ripe}|${palKey(pal)}|${d}`, W, H, d, (g) => {
      g.translate(W / 2, m)
      const dark = pal.dark
      const cy = L + R * 0.92
      const rx = R * 0.98
      const ry = R * 0.86
      const body = ripe ? (dark ? pal.verm : mix(pal.verm, pal.paper, 0.14)) : mix(pal.paper, pal.ink, dark ? 0.3 : 0.26)
      const rim = ripe ? mix(pal.verm, pal.deep, dark ? 0.15 : 0.4) : mix(pal.paper, pal.ink, dark ? 0.48 : 0.62)
      // the stem: a short woody stroke, a little crooked
      inkLine(g, [{ x: 0, y: -1 }, { x: R * 0.07, y: (cy - ry) * 0.5 }, { x: R * 0.02, y: cy - ry + R * 0.12 }], { w: Math.max(1, R * 0.09), color: pal.wood, alpha: dark ? 0.75 : 0.9, head: 1, tail: 0.7, seed: 21 })
      // the fruit: one boneless wash — pigment settled low, a dried line along its lower edge
      g.globalAlpha = ripe ? 0.95 : dark ? 0.9 : 0.82
      g.drawImage(wash(body, rim, 1), -rx * 1.19, cy - ry * 1.19, rx * 2.38, ry * 2.38)
      g.globalAlpha = 1
      // where the light falls the paper shows through
      g.save()
      g.beginPath()
      g.ellipse(0, cy, rx * 0.92, ry * 0.92, 0, 0, Math.PI * 2)
      g.clip()
      const hx = -rx * 0.36
      const hy = cy - ry * 0.4
      const hl = g.createRadialGradient(hx, hy, 0, hx, hy, R * 0.75)
      const lc = dark ? pal.ink : pal.card
      hl.addColorStop(0, rgba(lc, dark ? 0.16 : 0.5))
      hl.addColorStop(1, rgba(lc, 0))
      g.fillStyle = hl
      g.fillRect(-rx, cy - ry, rx * 2, ry * 2)
      g.restore()
      // the calyx: four pressed leaves and a dot
      const top = cy - ry * 0.9
      const cal = dark ? mix(pal.moss, pal.paper, 0.45) : mix(pal.moss, pal.ink, 0.62)
      for (const [a, l] of [[-2.75, 0.36], [-2.05, 0.28], [-1.05, 0.3], [-0.38, 0.38]] as const) {
        inkLine(g, [{ x: 0, y: top }, { x: Math.cos(a) * R * l * 0.55, y: top + Math.sin(a) * R * l * 0.35 + R * 0.04 }, { x: Math.cos(a) * R * l, y: top + Math.sin(a) * R * l * 0.5 + R * 0.06 }], { w: Math.max(1, R * 0.16), color: cal, alpha: 0.92, head: 0.9, tail: 0.2, seed: a * 10 })
      }
      dab(g, 0, top, Math.max(0.8, R * 0.09), cal, 0.95, 2)
      // the eye, brushed into the fruit: a pressed upper lid, a lighter lower lid, the iris with a glint
      const eye = dark ? pal.deep : pal.ink
      const ex = R * 0.08
      const ey = cy + R * 0.14
      const E = (x: number, y: number) => ({ x: ex + x * R * 0.82, y: ey + y * R * 0.82 })
      // (soft, as if brushed into the wet wash — a painted eye, not an icon stamped on it)
      inkLine(g, [E(-0.5, 0.08), E(-0.24, -0.14), E(0.16, -0.17), E(0.5, 0.0)], { w: Math.max(1, R * 0.075), color: eye, alpha: 0.62, head: 0.25, tail: 0.1, seed: 3 })
      inkLine(g, [E(-0.34, 0.13), E(-0.02, 0.22), E(0.36, 0.08)], { w: Math.max(0.6, R * 0.035), color: eye, alpha: 0.28, head: 0.4, tail: 0.15, seed: 4 })
      dab(g, ex + R * 0.03, ey + R * 0.02, Math.max(1, R * 0.105), eye, 0.66, 5)
    }),
  }
}

/** AI gợi ý: a hanging bunch of small ink-wash berries, one ripening vermilion — the pick for you. */
const BERRIES: [number, number, number, number][] = [
  // x, y, radius (× R from the anchor), ink tone; the pick is index 3
  [0.36, 1.32, 0.2, 0.62],
  [0.7, 1.3, 0.19, 0.4],
  [0.22, 1.72, 0.21, 0.78],
  [0.6, 1.7, 0.28, 0],
  [1.0, 1.62, 0.18, 0.32],
  [0.4, 2.1, 0.2, 0.5],
  [0.78, 2.12, 0.19, 0.66],
  [0.58, 2.46, 0.17, 0.44],
]
const PICK = 3
/** the bunch's size (× R) */
const BUNCH = 1.35
function drawBerries(g: CanvasRenderingContext2D, R: number, k: number, sel: number, pal: Palette) {
  const dark = pal.dark
  const Z = R * BUNCH
  const P = (x: number, y: number): Pt => ({ x: x * Z, y: y * Z })
  const pk = BERRIES[PICK]
  warmGlow(g, pk[0] * Z, pk[1] * Z, R * 1.8, pal, 0.32 * sel * smooth(0.4, 0.9, k))
  // the stalk, then a fine twig to every berry
  const stalk = smooth(0, 0.4, k)
  const wood = { color: pal.wood, alpha: dark ? 0.6 : 0.88 }
  inkLine(g, [P(0, -0.02), P(0.12, 0.55), P(0.56, 1.05)], { ...wood, w: Math.max(1, R * 0.08), head: 1, tail: 0.35, upTo: stalk, seed: 31 })
  const kOf = (i: number) => smooth(0.2 + 0.06 * i, 0.6 + 0.06 * i, k)
  // the fine twigs first, from the stalk's tip out to each berry, so no line crosses a fruit
  const hub = P(0.56, 1.05)
  BERRIES.forEach(([x, y, r], i) => {
    const ki = kOf(i)
    if (ki <= 0) return
    const from = y < 1.5 ? hub : y < 2 ? P(0.58, 1.45) : P(0.6, 1.85)
    const to = P(x, y - r * 0.6)
    inkLine(g, [from, { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - R * 0.05 }, to], { ...wood, w: Math.max(0.7, R * 0.035), head: 0.9, tail: 0.6, upTo: ki, seed: 40 + i })
  })
  // then the berries, back to front, the pick laid last
  for (const i of [0, 1, 2, 4, 5, 6, 7, PICK]) {
    const [x, y, r, tone] = BERRIES[i]
    const ki = kOf(i)
    if (ki <= 0) continue
    const rr = r * Z * (0.45 + 0.55 * ki)
    const cx = x * Z
    const cy = y * Z
    const one = (body: RGB, rim: RGB, a: number) => {
      if (a <= 0.003) return
      g.globalAlpha = a * ki
      g.drawImage(wash(body, rim, i), cx - rr * 1.19, cy - rr * 1.19, rr * 2.38, rr * 2.38)
    }
    if (i === PICK) {
      one(mix(pal.paper, pal.verm, dark ? 0.45 : 0.5), mix(pal.paper, pal.verm, dark ? 0.6 : 0.8), dark ? 0.85 : 0.95)
      one(dark ? pal.verm : mix(pal.verm, pal.paper, 0.12), mix(pal.verm, pal.deep, dark ? 0.15 : 0.4), sel)
    } else {
      const t = dark ? 0.22 + tone * 0.3 : 0.3 + tone * 0.45
      one(mix(pal.paper, pal.ink, t), mix(pal.paper, pal.ink, Math.min(0.9, t + 0.22)), dark ? 0.85 : 0.82)
    }
    g.globalAlpha = 1
    // the dark eye at the blossom end of each berry, as grapes are painted
    dab(g, cx + rr * 0.12, cy + rr * 0.52, Math.max(0.6, rr * 0.13), dark ? pal.deep : pal.ink, 0.55 * ki, i)
  }
}

/** Robot: a little jointed arm hung under its pad, painted like the tree — tapered strokes, ink-wash knuckles — its gripper pinching a fruit by the stalk. */
function drawArm(g: CanvasRenderingContext2D, R: number, k: number, sel: number, pal: Palette, t: number, idle: boolean) {
  const dark = pal.dark
  const ink = dark ? mix(pal.ink, pal.paper, 0.3) : pal.ink
  const A = dark ? 0.78 : 0.9
  const ga = smooth(0, 0.35, k)
  const u = smooth(0, 1, k)
  const n1 = idle ? 0.05 * Math.sin(t * 0.6) : 0
  const n2 = idle ? 0.09 * Math.sin(t * 0.8 + 1) : 0
  // shoulder angle from straight down (+ = outward, to the left), elbow folds back under it
  const a1 = 0.08 + 0.5 * u + n1
  const a2 = a1 - (2.5 - 1.35 * u) + n2
  const S = { x: 0, y: R * 0.17 }
  const E = { x: S.x - Math.sin(a1) * R * 0.95, y: S.y + Math.cos(a1) * R * 0.95 }
  const Wr = { x: E.x - Math.sin(a2) * R * 0.78, y: E.y + Math.cos(a2) * R * 0.78 }
  const a3 = a2 - 0.25
  const dir = { x: -Math.sin(a3), y: Math.cos(a3) }
  const nrm = { x: dir.y, y: -dir.x }
  const F = (along: number, side: number) => ({ x: Wr.x + dir.x * along * R + nrm.x * side * R, y: Wr.y + dir.y * along * R + nrm.y * side * R })
  /** a point along a→b, pushed sideways by `s` of its length (a limb's gentle bow) */
  const at = (a: Pt, b: Pt, f: number, s = 0) => ({ x: a.x + (b.x - a.x) * f - (b.y - a.y) * s, y: a.y + (b.y - a.y) * f + (b.x - a.x) * s })
  // the gripper's pinch, and the fruit hanging under it
  const pinch = F(0.27, 0)
  const fr = R * 0.15 * (0.5 + 0.5 * u)
  const fc = { x: pinch.x + R * 0.025, y: pinch.y + R * 0.1 + fr * 0.9 }
  warmGlow(g, fc.x, fc.y, R * 1.1, pal, 0.22 * sel)
  g.globalAlpha = ga
  const W = (w: number, min: number) => Math.max(min, R * w)
  // where it hangs from the pad: a short pressed stub, like a twig
  inkLine(g, [{ x: R * 0.18, y: -R * 0.03 }, { x: R * 0.07, y: R * 0.05 }, S], { w: W(0.15, 1.1), color: ink, alpha: A, head: 1, tail: 0.75, seed: 7 })
  // upper arm: pressed at the shoulder, lifting toward the elbow, with a dry streak where the brush ran out
  inkLine(g, [S, at(S, E, 0.5, 0.06), E], { w: W(0.24, 1.4), color: ink, alpha: A * 0.9, head: 1, tail: 0.5, seed: 9 })
  inkLine(g, [at(S, E, 0.25, 0.03), at(S, E, 0.48, 0.07), at(S, E, 0.68, 0.05)], { w: W(0.04, 0.5), color: dark ? pal.paper : pal.card, alpha: 0.24, head: 0.3, tail: 0.1, seed: 19 })
  // forearm: finer, a lighter load of ink
  inkLine(g, [E, at(E, Wr, 0.5, -0.06), Wr], { w: W(0.18, 1.1), color: ink, alpha: A * 0.82, head: 0.95, tail: 0.45, seed: 10 })
  // knuckles: soft ink-wash blots with a darker heart, as knots are painted on a branch
  const knot = (p: Pt, r: number, v: number) => {
    g.globalAlpha = ga * 0.92
    g.drawImage(wash(mix(pal.paper, ink, 0.55), mix(pal.paper, ink, 0.88), v), p.x - r * 1.19, p.y - r * 1.19, r * 2.38, r * 2.38)
    g.globalAlpha = ga
    dab(g, p.x + r * 0.08, p.y + r * 0.12, W(r / R * 0.34, 0.6), ink, A * 0.7, v + 11)
  }
  knot(S, R * 0.15, 1)
  knot(E, R * 0.13, 2)
  knot(Wr, R * 0.095, 3)
  // the gripper: two claws meeting like a beak — the far one paler, behind — pinching the stalk of a fruit it has picked
  for (const [sd, a] of [[1, A * 0.55], [-1, A]] as const)
    inkLine(g, [F(0.02, sd * 0.05), F(0.13, sd * (0.1 + 0.05 * (1 - u))), F(0.27, sd * 0.02)], { w: W(0.085, 0.8), color: ink, alpha: a, head: 1, tail: 0.12, seed: 15 + sd })
  // the fruit hangs straight down from the pinch: a short stalk, a wash that ripens to vermilion when chosen
  inkLine(g, [pinch, { x: pinch.x + R * 0.02, y: pinch.y + R * 0.06 }, { x: fc.x, y: fc.y - fr * 0.7 }], { w: W(0.04, 0.6), color: pal.wood, alpha: dark ? 0.75 : 0.9, head: 0.8, tail: 0.8, seed: 23 })
  const lay = (body: RGB, rim: RGB, a: number) => {
    if (a <= 0.003) return
    g.globalAlpha = ga * a
    g.drawImage(wash(body, rim, 2), fc.x - fr * 1.22, fc.y - fr * 1.12, fr * 2.44, fr * 2.3)
  }
  lay(mix(pal.paper, ink, dark ? 0.3 : 0.28), mix(pal.paper, ink, dark ? 0.5 : 0.6), 0.9 * (1 - 0.8 * sel))
  lay(dark ? pal.verm : mix(pal.verm, pal.paper, 0.14), mix(pal.verm, pal.deep, dark ? 0.15 : 0.4), 0.95 * sel)
  g.globalAlpha = ga
  // where the light falls, and the little calyx where the stalk meets it
  dab(g, fc.x - fr * 0.38, fc.y - fr * 0.2, Math.max(0.5, fr * 0.26), dark ? pal.ink : pal.card, dark ? 0.16 : 0.42, 14)
  dab(g, fc.x, fc.y - fr * 0.78, Math.max(0.5, fr * 0.2), dark ? mix(pal.moss, pal.paper, 0.45) : mix(pal.moss, pal.ink, 0.62), 0.9, 16)
  g.globalAlpha = 1
}

/**
 * A fruit hanging from a pad (`at`, the anchor on its underside; L, the stem length; R, its size), warmed when chosen.
 * k ∈ [0, 1] brings it in: the persimmon lowers on its stem, the cards fall out of the pad, the arm unfolds.
 */
export function drawFruit(g: CanvasRenderingContext2D, id: FruitId, at: Pt, L: number, R: number, k: number, sel: number, pal: Palette, angle: number, t: number, idle: boolean) {
  if (k <= 0) return
  g.save()
  g.translate(at.x, at.y)
  g.rotate(angle)
  const b = fruitBox(id, R, L)
  if (id === 'recog') {
    const drop = (1 - smooth(0.15, 0.8, k)) * R * 0.5
    const kb = smooth(0.1, 0.7, k)
    warmGlow(g, 0, b.cy - drop, R * 2.1, pal, 0.3 * sel * kb)
    const d = Math.max(1, Math.round(g.getTransform().a * 2) / 2)
    const calm = persimmon(R, L, false, pal, d)
    const ripe = persimmon(R, L, true, pal, d)
    const iw = calm.img.width / d
    const ih = calm.img.height / d
    for (const [im, a] of [[calm, kb * (1 - sel)], [ripe, kb * sel]] as const) {
      if (a <= 0.003) continue
      g.globalAlpha = a
      g.drawImage(im.img, -iw / 2, -im.m - drop, iw, ih)
    }
    g.globalAlpha = 1
  } else if (id === 'rec') {
    drawBerries(g, R, k, sel, pal)
  } else drawArm(g, R, k, sel, pal, t, idle)
  g.restore()
}


/** AI tạo sinh: a calligraphy brush hanging by its cord; its tip is loaded with vermilion when chosen. */
export function drawBrush(g: CanvasRenderingContext2D, at: Pt, R: number, k: number, sel: number, pal: Palette, angle: number, cord = 1) {
  if (k <= 0) return
  const ink = pal.dark ? mix(pal.ink, pal.paper, 0.12) : pal.ink
  g.save()
  g.translate(at.x, at.y)
  g.rotate(angle)
  const Ls = R * 0.5
  if (cord > 0)
    inkLine(g, [{ x: 0, y: -1 }, { x: R * 0.04, y: Ls * 0.5 }, { x: 0, y: Ls + R * 0.12 }], {
      w: Math.max(1, R * 0.05),
      color: ink,
      alpha: 0.7 * cord,
      head: 1,
      tail: 0.8,
      upTo: smooth(0, 0.3, k),
    })
  const kb = smooth(0.25, 0.75, k)
  if (kb > 0) {
    const hTop = Ls + R * 0.2
    const hBot = hTop + R * 1.35
    const y1 = hBot + R * 0.16
    const tip = y1 + R * 0.95
    const mid = (hTop + tip) / 2
    g.save()
    g.translate(0, mid)
    g.scale(0.7, 1.25)
    warmGlow(g, 0, 0, R * 1.7, pal, 0.26 * sel * kb)
    g.restore()
    g.globalAlpha = kb
    // the cord's little loop
    if (cord > 0) {
      g.strokeStyle = rgba(ink, 0.7 * cord)
      g.lineWidth = Math.max(1, R * 0.045)
      g.beginPath()
      g.ellipse(0, Ls + R * 0.08, R * 0.065, R * 0.1, 0, 0, Math.PI * 2)
      g.stroke()
    }
    // bamboo handle with two nodes
    inkLine(g, [{ x: 0, y: hTop }, { x: 0.3, y: hBot }], { w: R * 0.19, color: ink, alpha: pal.dark ? 0.5 : 0.6, head: 0.95, tail: 0.95 })
    for (const f of [0.34, 0.7]) {
      const y = hTop + (hBot - hTop) * f
      inkLine(g, [{ x: -R * 0.11, y }, { x: R * 0.11, y: y + R * 0.012 }], { w: Math.max(1, R * 0.045), color: ink, alpha: 0.85, head: 0.8, tail: 0.6 })
    }
    // ferrule
    g.fillStyle = rgba(ink, pal.dark ? 0.75 : 0.88)
    g.beginPath()
    g.roundRect(-R * 0.13, hBot - R * 0.02, R * 0.26, R * 0.18, R * 0.03)
    g.fill()
    // the hair: a loaded tip
    const hair = () => {
      g.beginPath()
      g.moveTo(-R * 0.15, y1)
      g.bezierCurveTo(-R * 0.22, y1 + R * 0.38, -R * 0.1, y1 + R * 0.72, 0, tip)
      g.bezierCurveTo(R * 0.1, y1 + R * 0.72, R * 0.22, y1 + R * 0.38, R * 0.15, y1)
      g.closePath()
    }
    hair()
    g.fillStyle = rgba(ink, pal.dark ? 0.75 : 0.92)
    g.fill()
    if (sel > 0) {
      g.save()
      hair()
      g.clip()
      const vg = g.createLinearGradient(0, y1 + R * 0.35, 0, tip)
      vg.addColorStop(0, rgba(pal.verm, 0))
      vg.addColorStop(1, rgba(pal.verm, sel))
      g.fillStyle = vg
      g.fillRect(-R * 0.3, y1, R * 0.6, tip - y1 + 1)
      g.restore()
      // a drop gathering at the tip
      dab(g, 0, tip + R * 0.13, R * 0.075 * sel, pal.verm, 0.9 * sel, 3)
    }
    // a glint of wet ink along the hair
    inkLine(g, [{ x: -R * 0.07, y: y1 + R * 0.1 }, { x: -R * 0.04, y: y1 + R * 0.55 }], { w: R * 0.035, color: pal.paper, alpha: pal.dark ? 0.25 : 0.4, head: 0.6, tail: 0.1 })
    g.globalAlpha = 1
  }
  g.restore()
}
/** Distance from the cord's anchor to the brush's tip. */
export const brushTip = (R: number) => R * 3.16
/** Lowest point of the hanging brush, relative to its cord's anchor (for laying out its name). */
export const brushLength = (R: number) => R * 3.25

/**
 * A five-petal plum blossom: white with a fine broken outline while unopened by the visitor, a pale plum once seen,
 * full vermilion while chosen. Stamens are fine hairs with dots around a green heart. scale varies each blossom a little.
 */
export function drawBlossom(g: CanvasRenderingContext2D, c: Pt, rb: number, k: number, sel: number, seen: boolean, pal: Palette, rot: number, scale: number, seed: number) {
  if (k <= 0) return
  const kk = smooth(0, 1, k)
  const r = rb * (0.3 + 0.7 * kk) * scale
  warmGlow(g, c.x, c.y, r * 2.2, pal, 0.24 * sel * kk)
  const white = pal.dark ? mix(pal.paper, pal.ink, 0.72) : pal.card
  const plum = pal.dark ? mix(white, pal.verm, 0.3) : mix(white, pal.verm, 0.2)
  const hot = pal.dark ? mix(pal.ink, pal.verm, 0.7) : mix(pal.vermSoft, pal.verm, 0.7)
  const col = mix(seen ? plum : white, hot, sel)
  const line = pal.dark ? mix(pal.paper, pal.ink, 0.35) : pal.ink
  const outline = (pal.dark ? 0.3 : 0.5) * (1 - 0.6 * sel) * (seen ? 0.6 : 1)
  const rr = rng(seed * 13 + 1)
  g.save()
  g.translate(c.x, c.y)
  g.rotate(rot)
  // petals open from a closed bud; one soft gradient across the flower: paler at the heart, fuller at the rims
  const open = smooth(0.25, 1, kk)
  const heart = mix(col, pal.dark ? pal.ink : pal.card, pal.dark ? 0.35 : 0.6)
  const gr = g.createRadialGradient(0, 0, r * 0.1, 0, 0, r * 1.05)
  gr.addColorStop(0, rgba(heart, 0.96 * kk))
  gr.addColorStop(1, rgba(col, 0.96 * kk))
  g.fillStyle = gr
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2 + (rr() - 0.5) * 0.25
    const d = r * 0.52 * open
    const pr = r * (0.3 + 0.16 * open) * (0.92 + rr() * 0.16)
    g.beginPath()
    g.ellipse(Math.cos(a) * d, Math.sin(a) * d, pr, pr * 0.94, a, 0, Math.PI * 2)
    g.fill()
  }
  g.lineCap = 'round'
  if (open > 0.3)
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2
      const px = Math.cos(a) * r * 0.52
      const py = Math.sin(a) * r * 0.52
      g.strokeStyle = rgba(line, outline * open)
      g.lineWidth = Math.max(0.6, r * 0.05)
      g.beginPath()
      g.arc(px, py, r * 0.44, a - 1.35 + (i % 2) * 0.25, a + 1.1 + ((i + seed) % 3) * 0.18)
      g.stroke()
    }
  // stamens: fine hairs with dark tips around a green heart
  const sk = smooth(0.5, 1, open)
  if (open > 0.5) {
    const n = 7
    const sc = pal.dark ? mix(pal.ink, pal.verm, 0.25) : mix(pal.ink, pal.verm, 0.25 + 0.35 * sel)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rr() * 0.4
      const L = r * (0.36 + rr() * 0.16) * sk
      g.strokeStyle = rgba(sc, 0.55)
      g.lineWidth = Math.max(0.45, r * 0.03)
      g.beginPath()
      g.moveTo(0, 0)
      g.lineTo(Math.cos(a) * L, Math.sin(a) * L)
      g.stroke()
      dab(g, Math.cos(a) * L, Math.sin(a) * L, Math.max(0.55, r * 0.06), sc, 0.85, i)
    }
    dab(g, 0, 0, Math.max(0.7, r * 0.1), mix(pal.moss, pal.ink, 0.3), 0.9 * sk, 9)
  }
  g.restore()
}

// ───────── the six small paintings (100 × 100 box) ─────────
const lantern: Mark[] = [
  // base, post, platform, light box (its window glowing), roof, jewel — a lit face and a shaded face
  { wash: [[28, 86], [48, 90.5], [48, 82], [28, 78.5]], a: 0.32 },
  { wash: [[48, 90.5], [71, 85.5], [71, 78], [48, 82]], a: 0.62 },
  { p: [[27, 78.6], [48, 82.2], [72, 78]], w: 1.6, a: 0.7, tail: 0.5 },
  { wash: [[42, 79], [49, 80.8], [49, 62], [42, 60.8]], a: 0.3 },
  { wash: [[49, 80.8], [57, 79], [57, 61], [49, 62]], a: 0.62 },
  { wash: [[33, 61], [49, 64.5], [49, 58], [33, 54.8]], a: 0.36 },
  { wash: [[49, 64.5], [66, 60.4], [66, 54], [49, 58]], a: 0.66 },
  { p: [[32.5, 54.8], [49, 58.2], [66.5, 54]], w: 1.5, a: 0.7, tail: 0.5 },
  { wash: [[37.5, 55], [49, 57.4], [49, 42], [37.5, 40]], a: 0.26 },
  { wash: [[49, 57.4], [61, 54.6], [61, 39.4], [49, 42]], a: 0.56 },
  { wash: [[40.5, 52.4], [46.4, 53.6], [46.4, 45.2], [40.5, 44]], a: 0.75, tone: 'verm' },
  { wash: [[21, 40.6], [49, 45.6], [49, 27]], a: 0.42 },
  { wash: [[49, 45.6], [78, 39.6], [49, 27]], a: 0.78 },
  { p: [[19.5, 38], [30, 42], [49, 46.2], [67, 42.4], [79.5, 37.2]], w: 3, head: 0.6, tail: 0.25 },
  { p: [[49, 27.5], [49, 21.5]], w: 2.2, head: 1, tail: 0.8 },
  { dot: [49, 19.2, 2.8] },
]
const bird = (cx: number, cy: number, pose: number): Mark[] => {
  // pose: 1 = wings up, 0 = level, -1 = down
  const wy = -pose * 7
  const tip = -pose * 11
  return [
    { p: [[cx - 1, cy], [cx - 6, cy + wy * 0.6], [cx - 12, cy + tip]], w: 2.4, head: 0.9, tail: 0.15 },
    { p: [[cx + 1, cy], [cx + 6, cy + wy * 0.55], [cx + 12.5, cy + tip * 0.95]], w: 2.4, head: 0.9, tail: 0.15 },
    { p: [[cx - 5, cy + 1.2], [cx + 4.5, cy - 0.4]], w: 3.3, head: 0.6, tail: 0.6 },
    { dot: [cx + 5.4, cy - 0.9, 1.6] },
    { p: [[cx - 4.6, cy + 1.2], [cx - 8.6, cy + 3.4]], w: 1.4, tail: 0.2 },
  ]
}
const frameStrip: Mark[] = [
  { p: [[4, 29], [96, 28.6]], w: 2.2, head: 0.8, tail: 0.7 },
  { p: [[4, 69], [96, 69.4]], w: 2.2, head: 0.8, tail: 0.7 },
  { p: [[34.6, 29.6], [34.8, 68.6]], w: 1.4, a: 0.75 },
  { p: [[65.4, 29.4], [65.2, 68.8]], w: 1.4, a: 0.75 },
  ...[10, 22, 34, 46, 58, 70, 82, 94].map((x): Mark => ({ dot: [x - 1, 24.6, 1.1], a: 0.7 })),
  ...[10, 22, 34, 46, 58, 70, 82, 94].map((x): Mark => ({ dot: [x - 1, 73.4, 1.1], a: 0.7 })),
]
const PAINTINGS: Record<string, Mark[]> = {
  // Chữ (LLM): the word "Chữ" in Vietnamese brush calligraphy, sealed in vermilion
  text: [
    { p: [[35, 37], [28, 31.5], [19, 34], [13, 45], [13.6, 58], [21, 67], [33, 66.4]], w: 5.4, head: 0.45, tail: 0.18 },
    { p: [[45, 20], [43.4, 44], [41.4, 68]], w: 4.4, head: 0.75, tail: 0.6 },
    { p: [[42.2, 53], [48.4, 45.6], [55.4, 47.4], [56.6, 58], [57.6, 68.4]], w: 3.8, head: 0.5, tail: 0.3 },
    { p: [[64.6, 47.6], [63.6, 59.6], [68.4, 68], [75.6, 66], [80.4, 57.6]], w: 4, head: 0.6, tail: 0.45 },
    { p: [[80.6, 46.6], [81.4, 58], [84.6, 68.6]], w: 3.8, head: 0.7, tail: 0.22 },
    { p: [[81, 47], [85.6, 43.8], [88.6, 39.6]], w: 2.6, head: 0.8, tail: 0.2 },
    { p: [[63.4, 36.4], [67.4, 32], [71.4, 35], [75.4, 37.2], [79.4, 32.6]], w: 2.6, head: 0.6, tail: 0.3 },
    { p: [[13, 79.6], [50, 78], [87, 80.6]], w: 1.6, a: 0.45, head: 0.6, tail: 0.15 },
    { wash: rect(86, 84, 93, 91), a: 0.9, tone: 'verm' },
  ],
  // Ảnh: a small ink landscape in a hanging scroll
  image: [
    { p: [[38, 8.5], [50, 1.5], [62, 8.5]], w: 1, a: 0.6, head: 1, tail: 1 },
    { p: [[21, 9], [79, 8.6]], w: 4.4, head: 0.95, tail: 0.9 },
    { wash: rect(26, 11, 74, 91), a: 0.1 },
    { wash: [[29, 64], [38, 48], [44, 52], [52, 37], [60, 46], [71, 64]], a: 0.2 },
    { p: [[30.5, 62], [38, 48.4], [44, 52.4], [52, 37.6], [60, 46.4], [69, 61]], w: 1.4, a: 0.55, head: 0.6, tail: 0.2 },
    { wash: [[27, 74], [35, 60], [43, 67], [51, 59], [62, 66], [73, 72], [73, 76], [27, 76]], a: 0.42 },
    { dot: [61, 26.5, 4.4], tone: 'verm', a: 0.9 },
    { p: [[34, 81.5], [49, 81]], w: 1.4, a: 0.5, tail: 0.3 },
    { p: [[53, 85], [67, 84.6]], w: 1.3, a: 0.45, tail: 0.3 },
    { p: [[21, 93], [79, 93.4]], w: 4.8, head: 0.95, tail: 0.9 },
  ],
  // Video: three frames of a bird in flight
  video: [...frameStrip, ...bird(19.5, 52, 1), ...bird(50, 48.5, 0), ...bird(80.5, 46, -1)],
  // Âm thanh: a temple bell and the sound rippling away from it
  audio: [
    { p: [[28, 13], [72, 12.6]], w: 3.4, head: 0.9, tail: 0.8 },
    { p: [[50, 13.4], [50.2, 21.6]], w: 2, a: 0.8 },
    { wash: [[39, 25], [44, 21.6], [56, 21.6], [61, 25], [62.4, 59], [66, 66.2], [34, 66.2], [37.6, 59]], a: 0.42 },
    { p: [[39.4, 24.6], [38.6, 44], [37.6, 59], [34, 66]], w: 2.6, head: 0.8, tail: 0.6 },
    { p: [[39.4, 24.6], [44, 21.2], [56, 21.2], [60.6, 24.6]], w: 2.6, head: 0.8, tail: 0.8 },
    { p: [[60.6, 24.6], [61.4, 44], [62.4, 59], [66, 66]], w: 2.6, head: 0.8, tail: 0.6 },
    { p: [[33, 66.6], [50, 67.2], [67, 66.6]], w: 3.4, head: 0.9, tail: 0.7 },
    { p: [[38.6, 36], [61.6, 35.8]], w: 1.4, a: 0.6 },
    { p: [[38, 51.6], [62.2, 51.4]], w: 1.4, a: 0.6 },
    { dot: [50, 58.6, 2.4], tone: 'verm' },
    { p: [[71, 35], [75.4, 44], [71, 53]], w: 1.8, a: 0.8, tail: 0.3 },
    { p: [[29, 35], [24.6, 44], [29, 53]], w: 1.8, a: 0.8, tail: 0.3 },
    { p: [[77.4, 30], [83.6, 44], [77.4, 58]], w: 1.5, a: 0.55, tail: 0.3 },
    { p: [[22.6, 30], [16.4, 44], [22.6, 58]], w: 1.5, a: 0.55, tail: 0.3 },
    { p: [[84, 25], [92, 44], [84, 63]], w: 1.2, a: 0.32, tail: 0.3 },
    { p: [[16, 25], [8, 44], [16, 63]], w: 1.2, a: 0.32, tail: 0.3 },
  ],
  // 3D: a stone lantern seen from three-quarters
  '3d': lantern,
  // Code: nested brackets written as calligraphy
  code: [
    { p: [[31, 11], [23.4, 14], [22.6, 30], [21.6, 43], [13, 50], [21.6, 57], [22.6, 70], [23.4, 86], [31, 89]], w: 3.8, head: 0.55, tail: 0.25 },
    { p: [[42.6, 35], [32, 50], [42.6, 65]], w: 3.4, head: 0.7, tail: 0.3 },
    { p: [[54.6, 31], [45.4, 69]], w: 3, head: 0.9, tail: 0.3, tone: 'verm' },
    { p: [[57.4, 35], [68, 50], [57.4, 65]], w: 3.4, head: 0.7, tail: 0.3 },
    { p: [[69, 11], [76.6, 14], [77.4, 30], [78.4, 43], [87, 50], [78.4, 57], [77.4, 70], [76.6, 86], [69, 89]], w: 3.8, head: 0.55, tail: 0.25 },
  ],
}

/** Painting order and timing: strokes take time by length, dots and washes by size, and the brush moves in the air between them. */
interface Plan {
  marks: Mark[]
  /** cumulative start of each mark's air move, of its painting, and the end */
  air: number[]
  start: number[]
  end: number[]
  total: number
}
const plans = new Map<string, Plan>()
const first = (m: Mark): XY => (m.p ? m.p[0] : m.dot ? [m.dot[0], m.dot[1]] : m.wash![0])
const last = (m: Mark): XY => (m.p ? m.p[m.p.length - 1] : m.dot ? [m.dot[0], m.dot[1]] : m.wash![m.wash!.length - 1])
const lenOf = (pts: XY[]) => pts.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0)
function plan(id: string): Plan {
  let p = plans.get(id)
  if (p) return p
  const marks = PAINTINGS[id]
  const air: number[] = []
  const start: number[] = []
  const end: number[] = []
  let t = 0
  let prev: XY | null = null
  for (const m of marks) {
    air.push(t)
    const f = first(m)
    if (prev) t += Math.hypot(f[0] - prev[0], f[1] - prev[1]) * 0.3
    start.push(t)
    t += m.p ? lenOf(m.p) : m.dot ? 6 : Math.sqrt(Math.abs(lenOf([...m.wash!, m.wash![0]]) * 4)) * 1.2
    end.push(t)
    prev = last(m)
  }
  p = { marks, air, start, end, total: t }
  plans.set(id, p)
  return p
}
const lerpXY = (a: XY, b: XY, u: number): XY => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]
function along(pts: XY[], u: number): XY {
  const L = lenOf(pts) * u
  let acc = 0
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    if (acc + d >= L) return lerpXY(pts[i - 1], pts[i], d ? (L - acc) / d : 0)
    acc += d
  }
  return pts[pts.length - 1]
}

/**
 * Paint medium `id` centred at (cx, cy), `size` px wide. k ∈ [0, 1] is the brush's progress. Returns where the
 * brush tip is (px), so a brush can be drawn painting it.
 */
export function drawPainting(g: CanvasRenderingContext2D, id: string, cx: number, cy: number, size: number, pal: Palette, k: number, alpha = 1): Pt {
  const pl = plan(id)
  const ink = pal.dark ? mix(pal.ink, pal.paper, 0.08) : pal.ink
  const sc = size / 100
  const P = ([x, y]: XY): Pt => ({ x: cx + (x - 50) * sc, y: cy + (y - 50) * sc })
  if (k >= 1) {
    const d = Math.max(1, Math.round(g.getTransform().a * 2) / 2)
    const S = size * 1.1
    const img = cached(`pt|${id}|${size.toFixed(1)}|${palKey(pal)}|${d}`, S, S, d, (cg) => paintMarks(cg, pl.marks, 100, S / 2, S / 2, size, ink, pal))
    g.globalAlpha = alpha
    g.drawImage(img, cx - S / 2, cy - S / 2, S, S)
    g.globalAlpha = 1
    return P(last(pl.marks[pl.marks.length - 1]))
  }
  const T = clamp(k) * pl.total
  let i = pl.marks.findIndex((_, j) => T < pl.end[j])
  if (i < 0) i = pl.marks.length - 1
  const m = pl.marks[i]
  let tip: XY
  let u = 0
  if (T < pl.start[i]) {
    // in the air, between the last mark and this one
    const from = i ? last(pl.marks[i - 1]) : first(m)
    const a = (T - pl.air[i]) / Math.max(1e-6, pl.start[i] - pl.air[i])
    tip = lerpXY(from, first(m), smooth(0, 1, a))
  } else {
    u = (T - pl.start[i]) / Math.max(1e-6, pl.end[i] - pl.start[i])
    tip = m.p ? along(m.p, u) : m.dot ? [m.dot[0], m.dot[1]] : along([...m.wash!, m.wash![0]], u)
  }
  paintMarks(g, pl.marks, 100, cx, cy, size, ink, pal, alpha, { i, u })
  return P(tip)
}
