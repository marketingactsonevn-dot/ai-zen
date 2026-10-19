import { fill, h, s } from '../../core/dom'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import type { SceneCtx } from '../types'
import { onSize, p2Defs, stableHeight, stoneArt } from '../../ui/part2/ink'
import { grass, water } from '../../ui/part2/paint'
import { C } from './data'
import { blob, curve, drawIn, f1, hills, measure, mist, moon, reeds, rng, stroke, wash, type Pt } from './kit'

const K = C.scenes.lantern
/** the clause break before "vì" (the word before "nó"): a stretch of open water, where the reading is written */
const GAP = K.pivot - 1
/** centre to centre along the river, in lantern radii */
const STEP0 = 2.5

/** Catmull-Rom through pts, n samples per span. */
function spline(pts: Pt[], n: number): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)]
    for (let j = 0; j < n; j++) {
      const t = j / n, t2 = t * t, t3 = t2 * t
      const c = (a: number, b: number, cc: number, d: number) => 0.5 * (2 * b + (cc - a) * t + (2 * a - 5 * b + 4 * cc - d) * t2 + (3 * b - a - 3 * cc + d) * t3)
      out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])])
    }
  }
  out.push(pts[pts.length - 1])
  return out
}

/** a lantern on the river: centre, radius, its lean with the current (deg) */
type Lamp = { x: number; y: number; r: number; tilt: number; w?: number }

/**
 * Scene 1 (2.5D) — seen from a wooden bridge, an ink river winds in an S from the near bank to the horizon under a small
 * high moon. The sentence floats on it as paper lanterns in reading order, sunk a little in the water, big near, small
 * far; the spare ending waits unlit in an eddy at the river's end. Touch "nó": it flares, lifts, and threads of moonlight
 * arc to every word, as bright as its weight — each lantern's glow and its streak on the water follow that weight too.
 * Drag the eddy's lantern into the sentence and the brightest thread swings from "mèo" to "chuột".
 * Four parallax planes (sky, far shore, river, bridge) follow the pointer, a drag or the phone's tilt.
 */
export function lanternScene(ctx: SceneCtx) {
  p2Defs()
  const N = K.words.length
  const SLOT = N, EDDY = N + 1
  let end = 0 // the ending in the sentence; the other one waits in the eddy
  let lit = false
  let swapped = false
  let busy = false
  const low = ctx.quality === 'low'
  const still = low || ctx.reduced
  const stableH = stableHeight(ctx, [K.insight])
  const layer = (cls: string) => {
    const svg = s('svg', { class: 'g8l2-svg', 'aria-hidden': 'true' })
    return { el: h('div', { class: `g8l2-layer ${cls}` }, svg), svg }
  }
  const sky = layer('sky'), far = layer('far'), river = layer('river'), fore = layer('fore')
  const pivotBtn = h('button', { class: 'g8l2-hit', type: 'button', 'aria-label': K.pivotAria, onClick: tap })
  const eddyBtn = h('button', { class: 'g8l2-hit eddy', type: 'button' })
  const read = h('p', { class: 'g8l2-read', 'data-off': '' })
  const note = h('div', { class: 'g8l2-note', 'data-off': '' })
  // the reading rides with the river, written on its open water; the illustration mark sits up in a corner of the sky
  const says = h('div', { class: 'g8l2-says' }, read)
  river.el.append(pivotBtn, eddyBtn)
  const root = h('div', { class: `g8l2${still ? '' : ' moving'}` }, h('p', { class: 'visually-hidden' }, K.art), sky.el, far.el, river.el, fore.el, says, note)
  ctx.art.append(root)
  ctx.prompt(K.prompt)
  const lanG = s('g'), threads = s('g', { class: 'g8l2-threads' }), reflG = s('g')
  let lamps: Lamp[] = []
  let box = { W: 0, H: 0 }

  const words = () => [...K.words, K.endings[end].word, K.endings[1 - end].word]

  function* draw(W: number, H: number) {
    box = { W, H }
    root.style.height = `${f1(H)}px`
    for (const L of [sky, far, river, fore]) L.svg.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    const wide = W > H
    const r = rng(2201)
    const yh = H * (wide ? 0.3 : 0.22) // the horizon
    const depth = (y: number) => Math.max(0, (y - yh) / (H - yh)) // 1 at the frame's foot … 0 on the horizon (∝ 1 / distance)
    // the river's centreline, painted in shares of the frame: in under the bridge, an S, out to the horizon
    const ctrl: Pt[] = (wide
      ? [[0.68, 1.12], [0.58, 0.97], [0.38, 0.875], [0.2, 0.785], [0.28, 0.695], [0.58, 0.63], [0.8, 0.56], [0.68, 0.485], [0.44, 0.445], [0.3, 0.4], [0.42, 0.357], [0.56, 0.33], [0.6, 0.315], [0.56, 0.306], [0.52, 0.301]]
      : [[0.72, 1.12], [0.64, 0.97], [0.26, 0.885], [0.1, 0.8], [0.28, 0.72], [0.74, 0.66], [0.9, 0.58], [0.72, 0.5], [0.26, 0.455], [0.1, 0.395], [0.3, 0.335], [0.62, 0.29], [0.7, 0.256], [0.6, 0.232], [0.52, 0.221]]
    ).map(([x, y]) => [x * W, y * H] as Pt)
    const line = spline(ctrl, 18)
    // lanterns shrink more slowly than the river narrows, so the far words stay readable (≥ 12 px)
    const size = (y: number) => Math.pow(Math.max(0.02, depth(y)), wide ? 0.5 : 0.26)
    const yA = H * (wide ? 0.87 : 0.86), yB = H * (wide ? 0.41 : 0.31) // "Con" … the furthest the slot after "quá" may go
    const hw = (y: number) => (wide ? W * 0.085 : W * 0.17) * Math.pow(depth(y), 0.9) + 2 // the river's half-width
    const bank = (side: number, k = 1) => line.map(([x, y], i) => {
      const [a, b] = [line[Math.max(0, i - 1)], line[Math.min(line.length - 1, i + 1)]]
      const tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1
      const w = hw(y) * k * (1 + 0.1 * Math.sin(i * 0.6 + side * 2))
      // across the river is foreshortened: the ground recedes
      return [x - (ty / l) * w * side, Math.max(yh, y + (tx / l) * w * side * 0.5)] as Pt
    })
    const left = bank(1), right = bank(-1)
    const P2 = (pts: Pt[]) => pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')
    const band = (k0: number, k1: number, side: number) => `M${P2(bank(side, k0))}L${P2(bank(side, k1).reverse())}Z`
    const strip = (k: number) => `M${P2(bank(1, k))}L${P2(bank(-1, k).reverse())}Z`
    const poly = strip(1)

    // ── the lanterns: along the river from "Con" to the slot, spaced by their own size; a climb on screen counts for
    // less than a run across (they are taller than wide), and the clause break before "vì" keeps open water for the reading
    const seg = line.filter(([, y]) => y <= yA + 0.5 && y >= yh + (H - yh) * 0.04)
    const acc = [0]
    for (let i = 1; i < seg.length; i++) acc.push(acc[i - 1] + Math.hypot(seg[i][0] - seg[i - 1][0], (seg[i][1] - seg[i - 1][1]) / 1.6) / size(seg[i][1]))
    const idx = (u: number) => {
      const i = acc.findIndex((a) => a >= u - 1e-6)
      return i < 0 ? seg.length - 1 : i
    }
    const UB = acc[Math.max(0, seg.findIndex(([, y]) => y <= yB))] || acc[acc.length - 1]
    const fsz = wide ? Math.max(19.2, Math.min(27.2, W * 0.023)) : 16
    const tw = Math.max(...K.endings.map((e) => measure(e.read, fsz)))
    const tangent = (i: number) => {
      const a = seg[Math.max(0, i - 2)], b = seg[Math.min(seg.length - 1, i + 2)]
      return Math.atan2(b[1] - a[1], b[0] - a[0])
    }
    const q0 = rng(2207)
    const tilts = Array.from({ length: N + 2 }, () => (q0() - 0.5) * 3)
    const lampAt = (u: number, k: number, j: number): Lamp => {
      const i = idx(u)
      const [x, y] = seg[i]
      // it leans a few degrees with the current, each with its own swing
      const r = rN * size(y) * k
      // how wide it reads: the lantern, or its word where that spills over (words never go below 12 px)
      const len = j < N ? [...K.words[j]].length : Math.max(...K.endings.map((e) => [...e.word].length))
      const fs = Math.max(12, Math.min(22, r * 0.52)), twr = len * fs * 0.52
      const w = Math.max(r, Math.max((12 / fs) * twr, Math.min(twr, r * 1.7)) / 2 + 2)
      return { x, y, r, w, tilt: Math.max(-7, Math.min(7, Math.cos(tangent(i)) * 5)) + tilts[j] }
    }
    const maxR = wide ? 52 : 34
    const STEP = wide ? STEP0 : 2.35
    let rN = Math.min(maxR, UB / (STEP * N))
    // spare river (lanterns at their largest) becomes breathing room between them
    let step = Math.min(3.3, Math.max(STEP, UB / (rN * N)))
    const extra = Array.from({ length: N + 1 }, () => 0) // extra river (normalized) before lantern k
    const sAt = (k: number) => {
      let u = rN * step * k
      for (let j = 1; j <= Math.min(k, N); j++) u += extra[j]
      return u
    }
    const meet = (a: Lamp, b: Lamp) => Math.abs(a.x - b.x) < 0.97 * ((a.w ?? a.r) + (b.w ?? b.r)) && Math.abs(a.y - b.y) < 1.2 * (a.r + b.r)
    // where the reading goes: open water at the clause break (or just beside the river there), clear of every lantern
    // ("nó" both on the water and lifted) and inside the frame; null while there is no such room
    const clear = (x0: number, y0: number, x1: number, y1: number) => lamps.every((L, k) => {
      const hit = (y: number) => x0 < L.x + L.r * 1.05 && L.x - L.r * 1.05 < x1 && y0 < y + L.r * 1.15 && y - L.r * 1.4 < y1
      return !hit(L.y) && !(k === K.pivot && hit(L.y - L.r * 1.3))
    })
    const spotFor = (): Pt | null => {
      const i = idx((sAt(GAP - 1) + sAt(GAP)) / 2), th = tangent(i)
      const [x, y] = seg[i]
      for (const k of wide ? [0] : [0, 0.4, -0.4, 0.8, -0.8]) {
        const cx = Math.min(W - tw / 2 - 10, Math.max(tw / 2 + 10, x - Math.sin(th) * tw * k)), cy = y + Math.cos(th) * tw * k * 0.5
        if (cy > H * 0.08 && cy < H * 0.8 && clear(cx - tw / 2 - 8, cy - fsz * 0.8, cx + tw / 2 + 8, cy + fsz * 1.6)) return [cx, cy]
      }
      return null
    }
    // lay them out, then make room: for the reading at the clause break, and wherever two lanterns would meet across a
    // bend of the river (the later one moves on)
    let spot: Pt | null = null
    for (let pass = 0; pass < 30; pass++) {
      lamps = Array.from({ length: N + 1 }, (_, k) => lampAt(sAt(k), 1, k))
      let more = 0
      spot = spotFor()
      if (!spot) (extra[GAP] += rN * 0.6), (more += rN * 0.6)
      const lifted = { ...lamps[K.pivot], y: lamps[K.pivot].y - lamps[K.pivot].r * 1.3 }
      for (let i = 0; i < N; i++) {
        const j = lamps.findIndex((L, j2) => j2 > i && (meet(lamps[i], L) || (i === K.pivot && meet(lifted, L)) || (j2 === K.pivot && meet(lamps[i], lifted))))
        if (j < 0) continue
        extra[j] += rN * 0.4
        more += rN * 0.4
        break
      }
      if (!more) break
      const free = UB - extra.reduce((x, y) => x + y, 0)
      rN = Math.min(maxR, free / (STEP * N))
      step = Math.min(3.3, Math.max(STEP, free / (rN * N)))
    }
    // the eddy: further on, where the river turns on itself, roomy enough for two lanterns
    let ue = sAt(N) + rN * step * 1.3
    const uEnd = acc[acc.length - 1] * 0.97
    const eddyAt = () => {
      const L = lampAt(Math.min(uEnd, ue), 0.94, N + 1)
      L.x += (L.x < W / 2 ? -1 : 1) * hw(L.y) * 0.25
      return L
    }
    let E = eddyAt()
    while (ue < uEnd && lamps.some((L) => meet(L, E))) (ue += rN * 0.5), (E = eddyAt())
    E.tilt = -3
    lamps.push(E)
    const mx = W * (wide ? 0.8 : 0.76), my = H * (wide ? 0.1 : 0.075), mr = Math.min(W, H) * (wide ? 0.026 : 0.034)

    // ── sky: the moon high and small, a breath of cloud, the far ranges melting into mist
    sky.svg.replaceChildren(
      mist(W * 0.5, yh - H * 0.08, W * 0.75, H * 0.16),
      moon(mx, my, mr, 23, true),
      hills(-W * 0.05, W * 1.05, yh + 2, H * (wide ? 0.13 : 0.08), 221, 0.92, Math.max(3, Math.round(W / 260))),
      mist(W * 0.5, yh - 4, W * 0.6, H * 0.035))
    yield
    // ── far shore: a nearer ridge on the outside of the far bend, mist lying on the water line
    far.svg.replaceChildren(
      hills(wide ? W * 0.52 : W * 0.4, W * 1.08, yh + 3, H * (wide ? 0.1 : 0.07), 224, 0.45, 2),
      hills(-W * 0.08, wide ? W * 0.3 : W * 0.45, yh + 3, H * (wide ? 0.07 : 0.05), 225, 0.55, 2),
      mist(W * 0.62, yh + 2, W * 0.4, H * 0.03),
      mist(W * 0.2, yh + 4, W * 0.3, H * 0.025))
    yield
    // ── the river plane: the land (mossy banks), the water (darker under the banks, the moon's sheen down its middle,
    // its broken road and glints, clipped), the eddy's spiral, lanterns, threads
    const clip = `g8l2-clip-${Math.round(W)}`
    let edges = '', moss = '', glints = ''
    for (const side of [left, right]) {
      for (let i = 0; i < side.length - 4; i += 3 + Math.floor(r() * 3)) {
        const a = side.slice(i, i + 4 + Math.floor(r() * 4)).filter(([, y]) => y > yh + 2)
        const d = a.length ? (a[0][1] - yh) / (H - yh) : 0
        if (a.length > 2 && r() > 0.2) edges += stroke(a, 1 + d * 4.5, 0.25, 0.3, 0.15)
      }
    }
    // moss along the banks: short tufted strokes leaning out over the water's edge
    for (const [side, sg] of [[left, 1], [right, -1]] as [Pt[], number][]) {
      for (let i = 1; i < side.length - 1; i++) {
        const [x, y] = side[i]
        if (y < yh + 4 || y > H + 10) continue
        const d = (y - yh) / (H - yh)
        const out = bank(sg, 1.25)[i]
        const n = 1 + Math.floor(r() * 2.6)
        for (let k = 0; k < n; k++) {
          const t = r(), bx = x + (out[0] - x) * t + (r() - 0.5) * 6, by = y + (out[1] - y) * t
          const len = 3 + d * 16 * (0.5 + r())
          moss += stroke([[bx, by], [bx + (r() - 0.5) * len * 0.6, by - len * (0.4 + r() * 0.3)]], 1.2 + d * 3, 0.1, 0.6, 0.2)
        }
      }
    }
    // the moon on the water: glints all along the river, a broken road under the moon itself
    for (let i = 2; i < line.length; i += 2) {
      const [x, y] = line[i]
      if (y < yh + 2 || y > H) continue
      const d = (y - yh) / (H - yh), w0 = hw(y)
      const under = Math.max(0, 1 - Math.abs(x - mx) / (W * 0.09))
      if (r() > 0.32 + under * 0.6) continue
      const len = w0 * (0.12 + r() * 0.35) * (1 + under)
      const gx = x + (r() - 0.5) * w0 * 1.1 - len / 2
      glints += stroke([[gx, y], [gx + len, y + (r() - 0.5)]], 0.8 + d * 2.4 + under * 1.2, 0.3, 0.3, 0.1)
    }
    // tufts and pebbles on the banks, larger near
    const bankBits: SVGElement[] = []
    for (const side of [left, right]) {
      for (let i = 2; i < side.length; i += 5 + Math.floor(r() * 5)) {
        const [x, y] = side[i]
        if (y < yh + 6 || y > H * 0.94 || x < -20 || x > W + 20) continue
        const d = (y - yh) / (H - yh)
        if (Math.hypot(x - E.x, y - E.y) < E.r * 3) continue
        if (r() < 0.5) bankBits.push(grass(x + (r() - 0.5) * 20, y + 2, 14 + d * 46, 2230 + i))
        else bankBits.push(s('g', { transform: `translate(${f1(x)} ${f1(y + 3)})` }, stoneArt(10 + d * 34, 5 + d * 16, 2240 + i)))
      }
    }
    // the eddy: the river widens into a round pool there, its water turning in a broken spiral
    const ex = E.x, ey = E.y + E.r * 1.2 * 0.66
    const pool = blob(ex, ey + E.r * 0.1, E.r * 3.1, E.r * 0.95, 2209, 0.06)
    river.svg.replaceChildren(
      s('defs', null,
        s('clipPath', { id: clip }, s('path', { d: poly + pool })),
        s('linearGradient', { id: 'g8l2-river', x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, class: 'g8l2-rv0' }), s('stop', { offset: 0.45, class: 'g8l2-rv1' }), s('stop', { offset: 1, class: 'g8l2-rv2' })),
        s('radialGradient', { id: 'g8l2-core', cx: 0.46, cy: 0.42, r: 0.62 }, s('stop', { offset: 0, class: 'g8l2-c0' }), s('stop', { offset: 0.38, class: 'g8l2-c1' }), s('stop', { offset: 0.8, class: 'g8l2-c2' }), s('stop', { offset: 1, class: 'g8l2-c3' })),
        s('radialGradient', { id: 'g8l2-core-p', cx: 0.46, cy: 0.42, r: 0.62 }, s('stop', { offset: 0, class: 'g8l2-c0' }), s('stop', { offset: 0.38, class: 'g8l2-p1' }), s('stop', { offset: 0.8, class: 'g8l2-p2' }), s('stop', { offset: 1, class: 'g8l2-c3' })),
        s('radialGradient', { id: 'g8l2-halo' }, s('stop', { offset: 0, class: 'g8l2-h0' }), s('stop', { offset: 0.4, class: 'g8l2-h1' }), s('stop', { offset: 1, class: 'g8l2-h2' })),
        s('linearGradient', { id: 'g8l2-streak', x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, class: 'g8l2-s0' }), s('stop', { offset: 1, class: 'g8l2-s1' }))),
      wash(strip(2.2) + pool, 1, 'p2p-wash g8l2-shore'),
      s('path', { class: 'g8l2-water', d: poly + pool, fill: 'url(#g8l2-river)' }),
      s('g', { 'clip-path': `url(#${clip})` },
        // darker in the shadow of the banks, lighter where the moon lies along the middle
        s('path', { class: 'g8l2-deep', d: band(1.05, 0.62, 1) + band(1.05, 0.62, -1) }),
        s('path', { class: 'g8l2-deep', d: band(1.05, 0.86, 1) + band(1.05, 0.86, -1) }),
        s('path', { class: 'g8l2-moonsheen', d: strip(0.5) }),
        s('path', { class: 'g8l2-moonsheen', d: strip(0.22) }),
        s('ellipse', { class: 'g8l2-deep', cx: f1(ex), cy: f1(ey), rx: f1(E.r * 2.6), ry: f1(E.r * 0.7) }),
        water(0, yh, W, H, 2202, mx, false),
        s('path', { class: 'g8l2-glint', d: glints })),
      s('path', { class: 'g8l2-swirl', d: swirl(ex, ey, E.r) }),
      s('path', { class: 'g8l2-edge', d: edges, filter: 'url(#ink-rough)' }),
      s('path', { class: 'g8l2-moss', d: moss }),
      ...bankBits,
      mist(W * 0.5, yh + (H - yh) * 0.06, W * 0.55, H * 0.025),
      reflG, lanG, threads)
    yield
    // ── the bridge we stand on: a big rail of old wood cutting across the corner, out of focus, grain and a moonlit
    // edge; a mossy stone and reeds bottom left, soft too
    const bx0 = W * (wide ? 0.6 : 0.5), by0 = H * 1.04, bx1 = W + 30, by1 = H * (wide ? 0.78 : 0.86), bt = H * (wide ? 0.085 : 0.06)
    const px = W * (wide ? 0.9 : 0.88), pw = Math.max(26, W * (wide ? 0.038 : 0.08))
    const py = by0 + ((by1 - by0) * (px - bx0)) / (bx1 - bx0)
    const railTop: Pt[] = [[bx0, by0], [(bx0 + bx1) / 2, (by0 + by1) / 2 - bt * 0.04], [bx1, by1]]
    const rail = `M${f1(bx0)} ${f1(by0)}L${f1(bx1)} ${f1(by1)}L${f1(bx1)} ${f1(by1 + bt)}L${f1(bx0)} ${f1(by0 + bt)}Z`
    const post = `M${f1(px - pw / 2)} ${f1(H + 20)}L${f1(px - pw / 2)} ${f1(py - bt * 1.2)}Q${f1(px - pw * 0.1)} ${f1(py - bt * 1.75)} ${f1(px + pw / 2)} ${f1(py - bt * 1.35)}L${f1(px + pw / 2)} ${f1(H + 20)}Z`
    const rq = rng(2261)
    let grain = '', grainHi = ''
    for (let k = 0; k < 7; k++) {
      const o = bt * (0.18 + k * 0.11 + (rq() - 0.5) * 0.05)
      const a0 = rq() * 0.3, a1 = 0.5 + rq() * 0.5
      const P = (t: number, dy: number): Pt => [bx0 + (bx1 - bx0) * t, by0 + (by1 - by0) * t + o + dy]
      const pts = Array.from({ length: 9 }, (_, j) => P(a0 + ((a1 - a0) * j) / 8, Math.sin(j * 1.3 + k) * bt * 0.025))
      if (k % 3 === 2) grainHi += stroke(pts, Math.max(1, bt * 0.03), 0.2, 0.3, 0.2)
      else grain += stroke(pts, Math.max(1, bt * 0.04), 0.15, 0.3, 0.2)
    }
    for (let k = 0; k < 4; k++) {
      const x = px - pw * 0.3 + k * pw * 0.2 + (rq() - 0.5) * 3
      grain += stroke([[x, H + 10], [x + (rq() - 0.5) * 3, py - bt * (0.6 + rq() * 0.5)]], Math.max(1, pw * 0.05), 0.1, 0.3, 0.2)
    }
    const knotX = bx0 + (bx1 - bx0) * 0.42, knotY = by0 + (by1 - by0) * 0.42 + bt * 0.5
    fore.svg.replaceChildren(
      s('defs', null,
        s('filter', { id: 'g8l2-soft', x: '-20%', y: '-20%', width: '140%', height: '140%' }, s('feGaussianBlur', { stdDeviation: wide ? 2.6 : 1.8 })),
        s('linearGradient', { id: 'g8l2-wood', x1: 0, y1: 0, x2: 0.15, y2: 1 }, s('stop', { offset: 0, class: 'g8l2-w0' }), s('stop', { offset: 0.5, class: 'g8l2-w1' }), s('stop', { offset: 1, class: 'g8l2-w2' }))),
      s('g', { filter: low ? null : 'url(#g8l2-soft)' },
        s('g', { transform: `translate(${f1(W * (wide ? 0.03 : -0.02))} ${f1(H * 1.01)})` }, stoneArt(W * (wide ? 0.15 : 0.36), H * (wide ? 0.13 : 0.1), 2251)),
        reeds(W * (wide ? 0.1 : 0.14), H * 1.0, H * (wide ? 0.3 : 0.22), 2252, 9),
        s('path', { class: 'g8l2-rail', d: rail + post, fill: 'url(#g8l2-wood)' }),
        s('path', { class: 'g8l2-grain', d: grain + blob(knotX, knotY, bt * 0.16, bt * 0.08, 2262, 0.2) }),
        s('path', { class: 'g8l2-grain hi', d: grainHi }),
        // the moon catches the rail's upper edge and the post's shoulder
        s('path', { class: 'g8l2-rail-hi', d: stroke(railTop.map(([x, y]) => [x, y + 1.5] as Pt), Math.max(2.4, bt * 0.07), 0.04, 0.04, 0.4) + stroke([[px - pw * 0.42, H], [px - pw * 0.42, py - bt * 1.2], [px, py - bt * 1.62]], Math.max(1.8, pw * 0.09), 0.1, 0.2, 0.3) }),
        reeds(W * (wide ? 0.97 : 0.98), H * 1.0, H * (wide ? 0.2 : 0.14), 2253, 5)))
    // the reading: on the open water at the clause break, between "chuột" and "vì"
    const [rx, ry] = spot ?? seg[idx((sAt(GAP - 1) + sAt(GAP)) / 2)]
    Object.assign(says.style, { left: `${f1(rx)}px`, top: `${f1(ry)}px`, fontSize: `${f1(fsz)}px` })
    place(pivotBtn, lamps[K.pivot], 1.4)
    place(eddyBtn, lamps[EDDY], 1.6)
    yield
    paint()
    drawThreads(false)
  }

  function place(b: HTMLElement, L: Lamp, k: number) {
    const w = Math.max(48, L.r * 2 * k), hh = Math.max(56, L.r * 2.6 * k)
    Object.assign(b.style, { left: `${f1(L.x - w / 2)}px`, top: `${f1(L.y - hh / 2)}px`, width: `${f1(w)}px`, height: `${f1(hh)}px` })
  }

  /** 0 = out (the eddy's spare ending), else how brightly it burns: softly before "nó" is touched, then by its weight */
  const glowOf = (i: number) => {
    if (i === EDDY) return 0
    if (i === K.pivot) return lit ? 1 : 0.62
    if (!lit) return 0.5
    if (i === SLOT) return 0.3 // the ending: "nó" weighs only the ten words before it
    const wts = K.endings[end].weights
    return 0.28 + 0.72 * Math.pow((wts[i] ?? 0) / Math.max(...wts), 0.75)
  }

  /** The lanterns far to near (so near ones overlap), each with its light and broken streak on the water below it. */
  function paint() {
    const ws = words()
    reflG.replaceChildren()
    lanG.replaceChildren()
    const order = lamps.map((_, i) => i).sort((a, b) => lamps[a].y - lamps[b].y)
    for (const i of order) {
      const L = lamps[i]
      const glow = glowOf(i)
      const kind = `${i === K.pivot ? ' pivot' : ''}${i === EDDY ? ' eddy' : ''}${i === SLOT ? ' slot' : ''}`
      const { halo, body, wl, refl } = lantern(L, ws[i], glow, i)
      const lift = `--lift:${f1(-L.r * 1.3)}px`
      reflG.append(s('g', { class: `g8l2-on${kind}`, style: `transform:translate(${f1(L.x)}px,${f1(L.y)}px)`, 'data-i': i }, ...refl))
      // the body lifts inside a clip that stays at the waterline, so "nó" rises out of the water whole
      lanG.append(s('g', { class: `g8l2-lan${kind}`, style: `transform:translate(${f1(L.x)}px,${f1(L.y)}px)`, 'data-i': i },
        s('g', { class: 'g8l2-bob', style: `animation-delay:${f1(-((i * 2.37) % 7))}s` },
          s('g', { class: 'g8l2-lift', style: lift }, halo),
          s('g', { 'clip-path': `url(#g8l2-wl-${i})` }, s('g', { class: 'g8l2-lift', style: lift }, ...body)),
          ...wl)))
    }
  }

  /**
   * A paper lantern (chōchin) of radius r centred on 0, 0, sunk to y = yw: an additive halo, dó paper lit from a warm
   * core, darker ribs, lacquer caps, the word; at the waterline a bright meniscus and a broken ring; under it (refl) the
   * light's long streak down the water and its broken dashes, as long and bright as its glow. Unlit: cold grey paper.
   */
  function lantern(L: Lamp, word: string, glow: number, i: number): { halo: SVGElement; body: SVGElement[]; wl: SVGElement[]; refl: SVGElement[] } {
    const { r } = L
    const q = rng(11 + i)
    const ry = r * 1.2, yw = ry * 0.66
    const wl = r * Math.sqrt(Math.max(0, 1 - (yw / ry) ** 2)) * 1.04 // half-width at the waterline
    let ribs = ''
    for (let k = 1; k < 6; k++) {
      const t = -1 + (k * 2) / 6
      const yy = t * ry * 0.92
      const hw = r * Math.sqrt(1 - t * t * 0.9)
      ribs += stroke(curve([-hw, yy], [0, yy + ry * 0.1], [hw, yy], 8), Math.max(0.8, r * 0.035) * (0.8 + q() * 0.4), 0.15, 0.15, 0.2)
    }
    const shape = blob(0, 0, r, ry, 11 + i, 0.03, 22)
    const cap = (yy: number, w: number) => `M${f1(-w)} ${f1(yy - ry * 0.07)}Q0 ${f1(yy - ry * 0.13)} ${f1(w)} ${f1(yy - ry * 0.07)}L${f1(w * 0.92)} ${f1(yy + ry * 0.08)}L${f1(-w * 0.92)} ${f1(yy + ry * 0.08)}Z`
    const fs = Math.max(12, Math.min(22, r * 0.52))
    const tw = word.length * fs * 0.52
    const fit = Math.max(12 / fs, tw > r * 1.7 ? (r * 1.7) / tw : 1)
    const cid = `g8l2-wl-${i}`
    const ring = (k: number) => {
      const rx = wl * k, rr = Math.max(1.5, rx * 0.2)
      let d = ''
      for (let a = q() * 0.8; a < Math.PI * 2; a += 0.7 + q() * 0.6) {
        const b = a + 0.35 + q() * 0.45
        d += stroke(Array.from({ length: 7 }, (_, j) => {
          const t = a + ((b - a) * j) / 6
          return [Math.cos(t) * rx, yw + 1 + Math.sin(t) * rr] as Pt
        }), Math.max(0.8, r * (0.05 - k * 0.012)), 0.3, 0.3, 0.1)
      }
      return d
    }
    const front = Array.from({ length: 13 }, (_, j) => {
      const t = (j / 12) * Math.PI
      return [Math.cos(t) * wl, yw + Math.sin(t) * wl * 0.2] as Pt
    })
    // the streak: long and bright as the lantern burns, broken into dashes as it nears us
    const len = r * (0.8 + glow * 3.6)
    let dashes = ''
    for (let k = 0; k < 10; k++) {
      const yy = yw + 3 + (k / 10) * len
      const w = r * (1.15 - k * 0.08) * (0.55 + q() * 0.6)
      const xx = (q() - 0.5) * r * 0.25 - w / 2
      dashes += stroke([[xx, yy], [xx + w * 0.5, yy + (q() - 0.5) * 1.4], [xx + w, yy]], Math.max(1.1, r * (0.12 - k * 0.009)), 0.3, 0.3, 0.1)
    }
    const rot = `rotate(${f1(L.tilt)} 0 ${f1(yw)})`
    return {
      halo: s('circle', { class: 'g8l2-halo', r: f1(r * (1.8 + glow * 2.2)), fill: 'url(#g8l2-halo)', style: `opacity:${f1(glow * 0.95)}` }),
      body: [
        s('defs', null, s('clipPath', { id: cid }, s('rect', { x: f1(-r * 3), y: f1(-ry * 4), width: f1(r * 6), height: f1(ry * 4 + yw) }))),
        s('g', { transform: rot },
          s('path', { class: 'g8l2-paper', d: shape }),
          s('path', { class: 'g8l2-core', d: shape, fill: i === K.pivot ? 'url(#g8l2-core-p)' : 'url(#g8l2-core)', style: `opacity:${f1(glow)}` }),
          s('path', { class: 'g8l2-rib', d: ribs }),
          s('path', { class: 'g8l2-shade', d: `M${f1(r * 0.1)} ${f1(-ry * 0.97)}A${f1(r)} ${f1(ry)} 0 0 1 ${f1(r * 0.1)} ${f1(ry * 0.97)}A${f1(r * 0.62)} ${f1(ry)} 0 0 0 ${f1(r * 0.1)} ${f1(-ry * 0.97)}Z` }),
          s('path', { class: 'g8l2-sheen', d: stroke(curve([-r * 0.62, -ry * 0.55], [-r * 0.86, 0], [-r * 0.6, ry * 0.4], 8), r * 0.12, 0.3, 0.3, 0.1) }),
          s('path', { class: 'g8l2-cap', d: cap(-ry * 0.98, r * 0.6) + cap(ry * 0.98, r * 0.66) }),
          s('path', { class: 'g8l2-hook', d: stroke([[0, -ry * 1.05], [1, -ry * 1.32]], 1.6, 0.1, 0.3, 0.4) }),
          s('text', { class: 'g8l2-word', y: f1(fs * 0.34 - ry * 0.1), 'font-size': f1(fs * fit), 'text-anchor': 'middle' }, word)),
      ],
      // where it meets the water: a bright meniscus round its front, a broken ring spreading out
      wl: [
        s('path', { class: 'g8l2-men', d: stroke(front, Math.max(1, r * 0.06), 0.2, 0.2, 0.2) }),
        s('path', { class: 'g8l2-ring', d: ring(1.45) + ring(2.05) }),
      ],
      refl: [
        s('g', { class: 'g8l2-rf' },
          s('path', { class: 'g8l2-streak', d: `M${f1(-r * 0.42)} ${f1(yw)}Q${f1(-r * 0.16)} ${f1(yw + len * 0.7)} 0 ${f1(yw + len)}Q${f1(r * 0.16)} ${f1(yw + len * 0.7)} ${f1(r * 0.42)} ${f1(yw)}Z`, fill: 'url(#g8l2-streak)', style: `opacity:${f1(Math.min(1, glow * 1.15))}` }),
          s('path', { class: 'g8l2-refl', d: dashes, style: `opacity:${f1(0.08 + glow * 0.8)}` })),
        s('ellipse', { class: 'g8l2-sit', cx: f1(r * 0.06), cy: f1(yw + 2), rx: f1(wl * 1.15), ry: f1(Math.max(2, wl * 0.22)) }),
      ],
    }
  }

  /** the eddy: a broken spiral of brush strokes, wound round (x, y), wide enough to hold two lanterns */
  function swirl(x: number, y: number, r: number) {
    let d = ''
    const turns = 2.4, n = 64
    for (let j = 0; j < n; j++) {
      if (j % 8 > 5) continue
      const pts: Pt[] = []
      for (let k = 0; k <= 4; k++) {
        const t = (j + k / 4) / n, a = t * turns * Math.PI * 2 + 0.6, rr = r * (0.7 + t * 2.4)
        pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.28])
      }
      d += stroke(pts, Math.max(0.9, r * (0.03 + (j / n) * 0.05)), 0.3, 0.3, 0.15)
    }
    return d
  }

  /** From "nó" (lifted): a thread of moonlight arcing up and down to every word, as thick and bright as its weight. */
  function drawThreads(animate: boolean) {
    threads.replaceChildren()
    if (!lit || !lamps.length) return
    const wts = K.endings[end].weights
    const top = K.endings[end].points
    const a = lamps[K.pivot]
    const ax = a.x, ay = a.y - a.r * 1.2 * 1.08 - a.r * 1.3
    const order = wts.map((w, i) => [w, i] as const).filter(([, i]) => i !== K.pivot).sort((x, y) => x[0] - y[0])
    const k = Math.max(0.7, Math.min(1.3, box.W / 1100))
    for (const [w, i] of order) {
      const b = lamps[i]
      const bx = b.x, by = b.y - b.r * 1.38
      const lift = b.r * 2.2 + Math.abs(bx - ax) * 0.16 + 16
      const d = `M${f1(ax)} ${f1(ay)}Q${f1((ax + bx) / 2)} ${f1(Math.min(ay, by) - lift)} ${f1(bx)} ${f1(by)}`
      const strong = i === top
      const p = s('path', { class: `g8l2-thread${strong ? ' top' : ''}`, d, 'stroke-width': f1((strong ? 2.6 : 0.5 + w * 7) * k), style: `opacity:${f1(strong ? 1 : Math.min(0.85, 0.18 + w * 1.9))}` })
      if (strong) threads.append(s('path', { class: 'g8l2-thread glow', d, 'stroke-width': f1((8 + w * 14) * k) }))
      threads.append(p)
      if (animate) drawIn(ctx, p, strong ? 1500 : 1000, strong ? 300 : 80 * (N - i))
      if (strong) threads.append(s('circle', { class: 'g8l2-knot', cx: f1(bx), cy: f1(by), r: f1(3.2 * k) }))
    }
  }

  function setRead() {
    const e = K.endings[end]
    read.replaceChildren(h('span', null, e.read), h('span', { class: 'r', 'aria-hidden': 'true' }, e.read), h('span', { class: 'visually-hidden' }, ` · ${fill(K.threadAria, { word: words()[e.points] })}`))
    delete read.dataset.off
  }
  const ariaSwap = () => eddyBtn.setAttribute('aria-label', fill(K.swapAria, { word: K.endings[1 - end].word }))
  ariaSwap()

  let liftRaf = 0
  ctx.onCleanup(() => cancelAnimationFrame(liftRaf))
  function tap() {
    if (busy) return
    const first = !lit
    if (first) {
      lit = true
      // what the threads mean, said once where they appear, with the illustration mark (not repeated in the detail)
      note.replaceChildren(h('p', { class: 'g8-note g8l2-decode' }, K.decode), ctx.fact(K.weightsNote, 'p', 'g8-note'))
      delete note.dataset.off
      setRead()
      read.setAttribute('aria-live', 'polite')
      ctx.prompt(K.swapPrompt)
    }
    ctx.chime('soft')
    paint()
    drawThreads(true)
    // lift on the next frame, so "nó" rises and its streak shortens and fades as it goes (CSS transitions)
    if (first) liftRaf = requestAnimationFrame(() => root.classList.add('lit'))
  }

  /** The eddy's lantern drifts into the sentence, the other one out to the eddy; every thread re-weighs. */
  function swap(from?: Lamp) {
    if (busy || !lamps.length) return
    busy = true
    const done = () => {
      end = 1 - end
      ariaSwap()
      busy = false
      paint()
      if (!lit) tap()
      else drawThreads(true), setRead()
      ctx.chime('tap')
      if (!swapped) {
        swapped = true
        ctx.insight(K.insight, K.detail)
      }
    }
    if (ctx.reduced) return done()
    if (low) {
      // quality=low: a crossfade instead of the drift
      const out = lanG.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' })
      out.onfinish = () => {
        done()
        out.cancel()
        lanG.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260 })
      }
      return
    }
    const a = lamps[SLOT], b = from ?? lamps[EDDY]
    const move = (i: number, from: Lamp, to: Lamp) => {
      for (const g of [lanG, reflG].map((p) => p.querySelector<SVGGElement>(`[data-i="${i}"]`))) {
        g?.animate([{ transform: `translate(${f1(from.x)}px,${f1(from.y)}px)` }, { transform: `translate(${f1(to.x)}px,${f1(to.y)}px) scale(${f1(to.r / from.r)})` }], { duration: 1300, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'forwards' })
      }
    }
    threads.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' }).onfinish = () => threads.replaceChildren()
    move(SLOT, a, b)
    move(EDDY, b, a)
    setTimeout(() => {
      threads.getAnimations().forEach((x) => x.cancel())
      done()
    }, 1320)
  }

  // the eddy lantern: tap it, Enter on it, or drag it to the end of the sentence
  let drag: { id: number; x: number; y: number; moved: boolean } | null = null
  eddyBtn.addEventListener('pointerdown', (e) => {
    if (busy) return
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false }
    eddyBtn.setPointerCapture(e.pointerId)
  })
  eddyBtn.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y
    if (!drag.moved && Math.hypot(dx, dy) < 6) return
    drag.moved = true
    const L = lamps[EDDY]
    for (const g of [lanG, reflG].map((p) => p.querySelector<SVGGElement>(`[data-i="${EDDY}"]`))) if (g) g.style.transform = `translate(${f1(L.x + dx)}px,${f1(L.y + dy)}px)`
  })
  const up = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return
    const d = drag
    drag = null
    const L = lamps[EDDY], S = lamps[SLOT]
    const near = Math.hypot(L.x + e.clientX - d.x - S.x, L.y + e.clientY - d.y - S.y) < Math.max(70, S.r * 2.6)
    if (d.moved && !near) {
      for (const g of [lanG, reflG].map((p) => p.querySelector<SVGGElement>(`[data-i="${EDDY}"]`))) if (g) g.style.transform = `translate(${f1(L.x)}px,${f1(L.y)}px)`
      return
    }
    // dropped on the slot: it drifts in from where the hand left it
    swap(d.moved ? { ...L, x: L.x + e.clientX - d.x, y: L.y + e.clientY - d.y } : undefined)
  }
  eddyBtn.addEventListener('pointerup', up)
  eddyBtn.addEventListener('pointercancel', () => {
    drag = null
    paint()
  })
  eddyBtn.addEventListener('click', (e) => {
    // keyboard (Enter / Space) arrives as a click with detail 0; pointer taps are handled on pointerup
    if (e.detail === 0) swap()
  })

  // ── parallax: sky ±4, far shore ±8, river ±14, bridge ±22 px, following the mouse, a drag or the phone's tilt
  const tgt = { x: 0, y: 0 }, cur = { x: 0, y: 0 }
  const AMP: [HTMLElement, number][] = [[sky.el, 4], [far.el, 8], [river.el, 14], [says, 14], [fore.el, 22]]
  const apply = () => AMP.forEach(([el, a]) => void (el.style.transform = `translate3d(${f1(-cur.x * a)}px,${f1(-cur.y * a * 0.5)}px,0)`))
  const loop = createLoop(root, (_t, dt) => {
    const f = dt > 0 ? 1 - Math.exp(-dt * 4) : 1
    cur.x += (tgt.x - cur.x) * f
    cur.y += (tgt.y - cur.y) * f
    apply()
    return Math.abs(tgt.x - cur.x) + Math.abs(tgt.y - cur.y) > 0.002
  })
  ctx.onCleanup(() => loop.dispose())
  // living motion (the lanterns' slow bob) only at high, and only until 10 s pass without input
  let idleT = 0
  const wake = () => {
    if (still) return
    root.classList.add('live')
    clearTimeout(idleT)
    idleT = window.setTimeout(() => root.classList.remove('live'), 10000)
  }
  ctx.onCleanup(() => clearTimeout(idleT))
  if (!still) {
    let rect: DOMRect | null = null
    let touch: { id: number; x: number; y: number } | null = null
    const set = (x: number, y: number) => {
      tgt.x = Math.max(-1, Math.min(1, x))
      tgt.y = Math.max(-1, Math.min(1, y))
      loop.start()
    }
    root.addEventListener('pointerenter', () => void (rect = root.getBoundingClientRect()))
    root.addEventListener('pointermove', (e) => {
      wake()
      if (touch && e.pointerId === touch.id) return set((e.clientX - touch.x) / 160, (e.clientY - touch.y) / 160)
      if (e.pointerType !== 'mouse') return
      rect ??= root.getBoundingClientRect()
      set(((e.clientX - rect.left) / rect.width) * 2 - 1, ((e.clientY - rect.top) / rect.height) * 2 - 1)
    })
    root.addEventListener('pointerdown', (e) => {
      wake()
      if (e.pointerType !== 'mouse' && !(e.target as Element).closest('button')) touch = { id: e.pointerId, x: e.clientX, y: e.clientY }
    })
    const release = () => void ((touch = null), set(0, 0))
    root.addEventListener('pointerup', release)
    root.addEventListener('pointercancel', release)
    root.addEventListener('pointerleave', () => set(0, 0))
    wake()
  }

  // the first painting soaks in over a few frames; a re-layout paints in one go (README A.10)
  let job: { cancel(): void } | null = null
  let first = true
  ctx.onCleanup(() => job?.cancel())
  ctx.onCleanup(onSize(ctx.art, () => {
    const W = ctx.art.clientWidth, H = stableH(ctx.art.clientHeight)
    if (W < 40 || H < 40) return
    job?.cancel()
    job = sliced(draw(W, H), { sync: ctx.reduced || !first })
    first = false
  }))
}
