import { h, nextId, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { blob, brush, C, clamp, ell, layer, loop, onSize, passFocus, place, rng, spline, stableHeight, type Pt } from './ink'

const N = C.scenes.pond

/** The three springs' objects, painted in ink, centred at (0, 0), ≈ 60 units wide, standing on y ≈ 20. */
function icon(kind: number) {
  const g = s('g')
  const ink = (pts: Pt[], w: number, op = 0.8, o: { a?: number; b?: number; min?: number } = {}) =>
    s('path', { class: 'k', 'fill-opacity': op, d: brush(pts, w, { a: o.a ?? 0.1, b: o.b ?? 0.25, min: o.min ?? 0.35 }).d })
  if (kind === 0) {
    // text: a small stack of stab-bound books, page edges toward us
    const book = (x0: number, x1: number, y0: number, y1: number, rot: number, seed: number) => {
      const b = s('g', { transform: `rotate(${rot} ${(x0 + x1) / 2} ${(y0 + y1) / 2})` })
      const r = rng(seed)
      b.append(
        s('path', { class: 'card', d: `M${x0} ${y0}L${x1} ${y0}L${x1 + 1} ${y1}L${x0} ${y1}Z`, filter: 'url(#ink-rough)' }),
        s('path', { class: 'k', 'fill-opacity': 0.1, d: blob(x1 - 8, (y0 + y1) / 2, 10, (y1 - y0) * 0.5, seed, 0.2), filter: 'url(#ink-wash)' }),
        s('path', { class: 't6p-cover', d: brush([[x0 - 1, y0 + 0.6], [x1 + 1, y0 + 0.4]], 2.4, { a: 0.02, b: 0.04, min: 0.8, wob: 0.1 }).d, filter: 'url(#ink-rough)' }),
        s('path', { class: 't6p-cover', d: brush([[x0 - 1, y1 - 0.6], [x1 + 1.5, y1 - 0.4]], 2.4, { a: 0.02, b: 0.04, min: 0.8, wob: 0.1 }).d, filter: 'url(#ink-rough)' }),
      )
      for (let i = 1; i < 4; i++) {
        const y = y0 + ((y1 - y0) * i) / 4
        b.append(ink([[x0 + 5 + r() * 3, y], [x1 - 2 - r() * 4, y + 0.2]], 0.5, 0.28, { min: 0.5 }))
      }
      // the stab binding on the spine end
      for (let i = 0; i < 3; i++) b.append(ink([[x0 + 2.2, y0 + 1.4 + i * ((y1 - y0 - 2.8) / 2) - 0.8], [x0 + 2.2, y0 + 1.4 + i * ((y1 - y0 - 2.8) / 2) + 0.8]], 1, 0.6, { min: 0.8 }))
      return b
    }
    g.append(
      s('path', { class: 't6-sh', 'fill-opacity': 0.12, d: ell(2, 19, 30, 3.4), filter: 'url(#ink-wash)' }),
      book(-27, 26, 8, 18, 0, 3), book(-23, 24, -2, 8, -2.5, 5), book(-25, 19, -11, -2, 2, 7),
      s('path', { class: 'm', 'fill-opacity': 0.8, d: brush([[8, -11], [9, -4], [7.5, 2]], 1.6, { a: 0.1, b: 0.5 }).d }),
    )
  } else if (kind === 1) {
    // images: a little hanging scroll holding an ink landscape
    g.append(
      s('path', { class: 't6-sh', 'fill-opacity': 0.1, d: ell(2, 21, 18, 2.6), filter: 'url(#ink-wash)' }),
      ink([[-9, -29], [0, -37], [9, -29]], 0.9, 0.6, { a: 0.1, b: 0.1, min: 0.6 }),
      s('path', { class: 't6p-mount', d: 'M-14 -27L14 -27L14 16L-14 16Z', filter: 'url(#ink-rough)' }),
      s('path', { class: 'card', d: 'M-10.5 -22L10.5 -22L10.5 11L-10.5 11Z' }),
      // far ridge, near peak, mist between, a pine on the shore
      s('path', { class: 'k', 'fill-opacity': 0.16, d: 'M-10.5 -2L-6 -9L-2 -5L3 -13L10.5 -4L10.5 4L-10.5 4Z', filter: 'url(#ink-wash)' }),
      s('path', { class: 'k', 'fill-opacity': 0.42, d: 'M-10.5 6L-5 -4L-1 1L2 -2L7 5L10.5 3L10.5 11L-10.5 11Z', filter: 'url(#ink-wash)' }),
      s('path', { class: 'card', 'fill-opacity': 0.85, d: brush([[-10.5, 2], [0, 1], [10.5, 2.6]], 3, { a: 0.3, b: 0.3, min: 0.2 }).d, filter: 'url(#ink-wash)' }),
      ink([[-6, 9], [-6.4, 3]], 0.9, 0.7),
      s('path', { class: 'md', 'fill-opacity': 0.8, d: blob(-6.4, 3.4, 3, 1.4, 4, 0.2, 10) }),
      s('path', { class: 'v', 'fill-opacity': 0.8, d: 'M6 -19h2.6v2.6H6Z' }),
      s('path', { class: 'w2', d: brush([[-16.5, -27], [16.5, -27]], 3, { a: 0, b: 0, min: 1, wob: 0 }).d, filter: 'url(#ink-rough)' }),
      s('path', { class: 'w2', d: brush([[-17, 16.5], [17, 16.5]], 3.6, { a: 0, b: 0, min: 1, wob: 0 }).d, filter: 'url(#ink-rough)' }),
      s('path', { class: 't6r-cap', d: ell(-17.5, 16.5, 1.8, 2.4) }), s('path', { class: 't6r-cap', d: ell(17.5, 16.5, 1.8, 2.4) }),
    )
  } else {
    // sound: a grey-bronze singing bowl on its cushion, the striker leaning on it, the hum spreading in rings
    const rings = s('g', { class: 't6p-hum' })
    ;[[30, 6.4, 0.42], [39, 8.4, 0.28], [48, 10.4, 0.16]].forEach(([rx, ry, op], k) => {
      for (const [a0, a1] of [[200, 330], [350, 520]]) {
        const pts: Pt[] = Array.from({ length: 14 }, (_, i) => {
          const a = ((a0 + ((a1 - a0) * i) / 13 + k * 17) * Math.PI) / 180
          return [Math.cos(a) * rx, 15 + Math.sin(a) * ry] as Pt
        })
        rings.append(ink(pts, 1.2, op, { a: 0.3, b: 0.4, min: 0.2 }))
      }
    })
    g.append(
      rings,
      s('path', { class: 't6p-cushion', d: blob(0, 15, 21, 5.4, 9, 0.12), filter: 'url(#ink-wash)' }),
      s('path', { class: 't6p-bowl', d: 'M-19 -5Q-18.5 13 0 14Q18.5 13 19 -5Z', filter: 'url(#ink-rough)' }),
      s('path', { class: 't6-sh', 'fill-opacity': 0.24, d: 'M4 -3Q17 -3 18.6 -4Q18 11 2 13.6Z', filter: 'url(#ink-wash)' }),
      s('path', { class: 't6-sh', 'fill-opacity': 0.42, d: ell(0, -5, 19, 4.2) }),
      s('path', { class: 't6p-bowl', 'fill-opacity': 0.9, d: ell(0, -4.2, 16.5, 2.8) }),
      s('path', { class: 't6-rim', 'fill-opacity': 0.55, d: brush([[-16, -1], [-14.5, 5], [-9, 10]], 2, { a: 0.2, b: 0.5 }).d, filter: 'url(#ink-dry)' }),
      ink([[-19, -5], [-17, 6], [0, 14], [17, 6], [19, -5]], 1.6, 0.7),
      ink([[-19, -5], [0, -9.2], [19, -5]], 0.9, 0.45),
      s('path', { class: 'w1', d: brush([[13, 13], [24, 2], [33, -7]], 3, { a: 0, b: 0, min: 1, wob: 0 }).d, filter: 'url(#ink-rough)' }),
      s('path', { class: 't6p-cushion', d: brush([[12, 14], [16, 10]], 4.6, { a: 0, b: 0, min: 1, wob: 0 }).d }),
    )
  }
  return g
}

interface Stream { xy: number[]; cum: number[]; len: number; open: boolean; parts: { el: SVGElement; t: number; v: number }[]; inlet: Pt; g: SVGGElement }

/** Scene 5 — text, images and sound flow into one pond (multimodal); below the surface, patterns and mist (the honest note). */
export function pondScene(ctx: SceneCtx) {
  const stable = stableHeight(ctx, [N.insight, N.deep])
  const svg = layer()
  const bg = s('g')
  const streamsG = s('g')
  const pondG = s('g')
  const fx = s('g')
  const springs = s('g')
  const deep = s('g', { opacity: 0 })
  const surface = s('g', { class: 't6p-surface' }, bg, streamsG, pondG, fx, springs)
  svg.append(surface, deep)
  const springBtns = N.streams.map((st, i) => h('button', { class: 't6-hit t6p-spring', type: 'button', 'aria-label': st.aria, 'aria-pressed': 'false', onClick: () => open(i) }))
  const springLabs = N.streams.map((st) => h('span', { class: 't6-lab t6p-lab', 'aria-hidden': 'true' }, st.label))
  const modelLab = h('span', { class: 't6-lab t6p-model', 'aria-hidden': 'true' }, N.model)
  const diveBtn = h('button', { class: 't6-btn t6p-dive', type: 'button', hidden: true }, N.diveAria)
  const pondHit = h('button', { class: 't6-hit t6p-pondhit', type: 'button', 'aria-label': N.diveAria, hidden: true })
  const patLab = h('span', { class: 't6-lab t6p-deeplab', 'aria-hidden': 'true' }, N.patterns)
  const unkLab = h('span', { class: 't6-lab t6p-deeplab t6p-unk', 'aria-hidden': 'true' }, N.unknown)
  for (const el of [modelLab, patLab, unkLab]) el.style.opacity = '0'
  const root = h('div', { class: 't6 t6p' }, h('p', { class: 'visually-hidden' }, N.art), svg, ...springLabs, modelLab, patLab, unkLab, ...springBtns, pondHit, diveBtn)
  ctx.art.append(root)

  let W = 1, H = 1
  let pc: Pt = [0, 0]
  let prx = 100, pry = 36
  let streams: Stream[] = []
  const opened = new Set<number>()
  let dived = false
  /** the stream/deep loop (motion only): idles until a spring opens or the pond is dived */
  let flow: ReturnType<typeof loop> | null = null
  let moon: SVGGElement | null = null
  let k = 1
  let deepPts: { x: number; y: number; vx: number; vy: number; sz: number; ink: number }[] = []
  let mist: SVGGElement | null = null
  let clipCircle: SVGCircleElement | null = null

  function layout() {
    W = root.clientWidth
    const Hraw = root.clientHeight
    if (!W || !Hraw) return
    H = stable.H(Hraw)
    svg.setAttribute('viewBox', `0 0 ${W} ${Hraw}`)
    const land = W / H > 1.1
    k = clamp(Math.min(W / 900, H / 520), 0.62, 1.5)
    // pond
    prx = land ? Math.min(W * 0.25, H * 0.5) : W * 0.42
    pry = prx * (land ? 0.34 : 0.4)
    pc = [W / 2, H - pry - (land ? H * 0.08 : 70)]
    // springs: left, top, right
    // tall screens: keep the springs within reach of the pond, not pinned to the top
    const y0 = Math.max(70 * k + 30, pc[1] - pry - W * 0.62)
    const sp: Pt[] = land
      ? [[W * 0.15, H * 0.34], [W * 0.5, H * 0.1 + 40 * k], [W * 0.85, H * 0.34]]
      : [[W * 0.18, y0], [W * 0.5, y0 - 16 * k - 8], [W * 0.82, y0]]
    const inlets: Pt[] = [[pc[0] - prx * 0.72, pc[1] - pry * 0.7], [pc[0], pc[1] - pry * 0.98], [pc[0] + prx * 0.72, pc[1] - pry * 0.7]]
    bg.replaceChildren()
    streamsG.replaceChildren()
    pondG.replaceChildren()
    springs.replaceChildren()
    const r = rng(17)
    // raked sand around the pond
    for (let i = 1; i <= 4; i++) {
      const d = ell(pc[0], pc[1] + pry * 0.1, prx * (1.12 + i * 0.16), pry * (1.2 + i * 0.2))
      bg.append(s('path', { class: 'rake-hi', d, transform: 'translate(0 1.4)', opacity: (1 - i * 0.18).toFixed(2) }), s('path', { class: 'rake', d, opacity: (1 - i * 0.18).toFixed(2) }))
    }
    const old = streams
    streams = sp.map((p, i) => {
      const a: Pt = [p[0], p[1] + 30 * k]
      const b = inlets[i]
      // a meandering centreline that widens towards the pond
      const dx = b[0] - a[0], dy = b[1] - a[1]
      const L = Math.hypot(dx, dy) || 1
      const nx = -dy / L, ny = dx / L
      const amp = Math.min(L * 0.09, 26 * k) * (i === 1 ? 1 : 0.8)
      const ctl: Pt[] = Array.from({ length: 7 }, (_, j) => {
        const u = j / 6
        const off = Math.sin(u * Math.PI * 1.6 + i * 1.3) * amp * Math.sin(u * Math.PI)
        return [a[0] + dx * u + nx * off, a[1] + dy * u + ny * off] as Pt
      })
      const line = spline(ctl, 4)
      const lft: Pt[] = [], rgt: Pt[] = []
      line.forEach((q, j) => {
        const u = j / (line.length - 1)
        const A = line[Math.max(0, j - 1)], B = line[Math.min(line.length - 1, j + 1)]
        const d = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1
        const w = (5 + 13 * u ** 1.6) * k * (1 + 0.12 * Math.sin(j * 0.7 + i))
        lft.push([q[0] - ((B[1] - A[1]) / d) * w, q[1] + ((B[0] - A[0]) / d) * w])
        rgt.push([q[0] + ((B[1] - A[1]) / d) * w, q[1] - ((B[0] - A[0]) / d) * w])
      })
      const P = (q: Pt) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`
      const bedD = `M${lft.map(P).join('L')}L${rgt.slice().reverse().map(P).join('L')}Z`
      streamsG.append(
        s('path', { class: 't6-sh', 'fill-opacity': 0.06, d: bedD, transform: 'translate(2 3)', filter: 'url(#ink-wash)' }),
        s('path', { class: 't6p-water', d: bedD, filter: 'url(#ink-rough)' }),
        s('path', { class: 'p', 'fill-opacity': 0.55, d: brush(line.slice(Math.round(line.length * 0.15), Math.round(line.length * 0.8)).map(([x, y]) => [x + 2, y] as Pt), 1.4 * k, { a: 0.3, b: 0.4, min: 0.2 }).d }),
      )
      // banks: broken strokes, a pause here and there like a real brush
      for (const side of [lft, rgt]) {
        const n = side.length
        for (const [f0, f1] of [[0, 0.38], [0.45, 0.78], [0.84, 1]]) {
          const seg = side.slice(Math.round(f0 * (n - 1)), Math.round(f1 * (n - 1)) + 1)
          if (seg.length > 1) streamsG.append(s('path', { class: 'k', 'fill-opacity': 0.42, d: brush(seg, 1.5 * k + 0.4, { a: 0.2, b: 0.3, min: 0.25 }).d, filter: 'url(#ink-rough)' }))
        }
      }
      // the centreline as the `M…L…` polyline (0.1 px) the things ride along; placeParts walks it by arc length
      const xy: number[] = []
      const cum = [0]
      line.forEach((q, j) => {
        xy.push(+q[0].toFixed(1), +q[1].toFixed(1))
        if (j) cum.push(cum[j - 1] + Math.hypot(xy[2 * j] - xy[2 * j - 2], xy[2 * j + 1] - xy[2 * j - 1]))
      })
      const g = s('g')
      streamsG.append(g)
      const st: Stream = { xy, cum, len: cum[cum.length - 1], open: old[i]?.open ?? false, parts: [], inlet: b, g }
      makeParts(st, i)
      return st
    })
    // the pond: pebble rim, water, a pale moon (the one model) that brightens as streams arrive
    pondG.append(
      s('path', { class: 't6-sh', 'fill-opacity': 0.1, d: ell(pc[0], pc[1] + pry * 0.16, prx * 1.1, pry * 1.16), filter: 'url(#ink-wash)' }),
      s('path', { class: 't6p-water', d: blob(pc[0], pc[1], prx, pry, 4, 0.04, 30), filter: 'url(#ink-rough)' }),
      s('path', { class: 'm', 'fill-opacity': 0.08, d: blob(pc[0], pc[1] + pry * 0.1, prx * 0.9, pry * 0.8, 6, 0.06), filter: 'url(#ink-wash)' }),
    )
    for (let i = 0; i < 4; i++) {
      const y = pc[1] - pry * 0.5 + i * pry * 0.32
      const half = prx * Math.sqrt(Math.max(0, 1 - ((y - pc[1]) / pry) ** 2)) * 0.7
      pondG.append(s('path', { class: 'p', 'fill-opacity': 0.55, d: brush([[pc[0] - half + r() * 20, y], [pc[0] + half * (0.2 + r() * 0.5), y + 1]], 1.6, { a: 0.3, b: 0.4, min: 0.2 }).d }))
    }
    const mg = nextId('t6pm')
    pondG.append(s('defs', null, s('radialGradient', { id: mg }, s('stop', { offset: 0, class: 't6p-mg0' }), s('stop', { offset: 1, class: 't6p-mg1' }))))
    const mr = Math.min(pry * 0.9, prx * 0.3)
    moon = s('g', { opacity: (0.2 + opened.size * 0.27).toFixed(2) },
      s('ellipse', { cx: pc[0], cy: pc[1], rx: prx * 0.62, ry: pry * 0.78, fill: `url(#${mg})` }),
      s('path', { class: 't6p-moon', d: blob(pc[0], pc[1], mr * 1.45, mr * 0.56, 12, 0.08), filter: 'url(#ink-wash)' }),
      s('path', { class: 't6p-moon', 'fill-opacity': 0.6, d: blob(pc[0] - mr * 0.15, pc[1] - mr * 0.05, mr * 0.9, mr * 0.32, 13, 0.1), filter: 'url(#ink-wash)' }),
      // the water breaks the reflection into shimmering bars
      ...[[-0.2, 0.9, 0.5], [0.22, 0.7, 0.75], [0.42, 0.45, 0.6]].map(([dy, w, x]) =>
        s('path', { class: 'p', 'fill-opacity': 0.7, d: brush([[pc[0] - mr * w * x * 1.6, pc[1] + dy * mr], [pc[0] + mr * w * (1 - x) * 1.6, pc[1] + dy * mr + 0.5]], Math.max(1.2, mr * 0.06), { a: 0.3, b: 0.3, min: 0.2 }).d })))
    pondG.append(moon)
    // rim: a few big rocks and scattered pebbles, clustered like a real pond edge
    for (const [deg, sz] of [[198, 1], [214, 0.6], [338, 0.85], [350, 0.5], [104, 0.7]] as const) {
      const a = (deg * Math.PI) / 180
      const x = pc[0] + Math.cos(a) * prx * 1.02, y = pc[1] + Math.sin(a) * pry * 1.04
      const rr = 15 * k * sz * (Math.sin(a) > 0 ? 1.1 : 0.85)
      pondG.append(s('path', { class: 't6-sh', 'fill-opacity': 0.14, d: ell(x + rr * 0.15, y + rr * 0.4, rr * 1.15, rr * 0.45), filter: 'url(#ink-wash)' }),
        s('path', { class: 't6t-pb1', d: blob(x, y, rr, rr * 0.62, deg, 0.14, 12), filter: 'url(#ink-rough)' }),
        s('path', { class: 't6-rim', 'fill-opacity': 0.8, d: blob(x - rr * 0.2, y - rr * 0.24, rr * 0.5, rr * 0.2, deg + 1, 0.2, 10) }),
        s('path', { class: 't6-sh', 'fill-opacity': 0.4, d: brush([[x - rr, y + rr * 0.1], [x - rr * 0.2, y + rr * 0.62], [x + rr, y + rr * 0.05]], Math.max(1, rr * 0.08), { a: 0.2, b: 0.3 }).d }))
    }
    for (let i = 0; i < Math.round(prx / 14); i++) {
      const a = Math.PI * (0.15 + r() * 0.75) + (r() > 0.5 ? Math.PI : 0)
      const x = pc[0] + Math.cos(a) * prx * (1.03 + r() * 0.04), y = pc[1] + Math.sin(a) * pry * (1.05 + r() * 0.05)
      const sz = (2.4 + r() * 3) * k
      pondG.append(s('path', { class: i % 3 ? 't6t-pb3' : 't6t-pb2', d: blob(x, y, sz, sz * 0.6, i + 2, 0.15, 10) }))
    }
    // the springs: a small pool and the icon above it
    sp.forEach((p, i) => {
      const g = s('g', { transform: `translate(${p[0].toFixed(1)} ${p[1].toFixed(1)}) scale(${k.toFixed(3)})` },
        s('path', { class: 't6p-water', d: blob(0, 31, 27, 6.6, 20 + i, 0.08), filter: 'url(#ink-rough)' }),
        s('path', { class: 'k', 'fill-opacity': 0.38, d: brush([[-26, 31], [-12, 37], [12, 37], [26, 31]], 1.4, { a: 0.1, b: 0.2 }).d, filter: 'url(#ink-rough)' }),
        s('path', { class: 'p', 'fill-opacity': 0.6, d: brush([[-14, 30], [8, 30.6]], 1.4, { a: 0.3, b: 0.3, min: 0.2 }).d }),
        icon(i))
      springs.append(g)
      const bw = 92 * k, bh = 96 * k
      place(springBtns[i], p[0] - bw / 2, p[1] - 40 * k, bw, bh)
      lab(springLabs[i], p[0], p[1] - 32 * k - (springLabs[i].offsetHeight || 26))
    })
    lab(modelLab, pc[0], pc[1] - 12)
    place(pondHit, pc[0] - prx, pc[1] - pry, prx * 2, pry * 2)
    placeDive()
    root.style.setProperty('--t6-fs', `${clamp(15 * k, 13, 18)}px`)
    buildDeep()
  }
  function lab(el: HTMLElement, cx: number, y: number) {
    const w = el.offsetWidth || 60
    place(el, clamp(cx - w / 2, 2, W - w - 2), y)
  }
  function placeDive() {
    const dw = diveBtn.offsetWidth || 170
    if (pc[1] + pry + 14 + 46 <= H) place(diveBtn, clamp(pc[0] - dw / 2, 4, W - dw - 4), pc[1] + pry + 14)
    else place(diveBtn, pc[0] + prx + 16 + dw < W ? pc[0] + prx + 16 : Math.max(4, pc[0] - prx - 16 - dw), pc[1] - 22)
  }

  const GLYPHS = ['a', 'ă', 'k', 'ơ', 'm', 'chữ', 'g', 'ê', 't', 'y']
  /** The things a stream carries: letters, little pictures, sound waves. */
  function makeParts(st: Stream, i: number) {
    st.g.replaceChildren()
    st.parts = []
    const n = ctx.quality === 'low' ? 6 : 10
    const r = rng(i * 31 + 3)
    for (let j = 0; j < n; j++) {
      let el: SVGElement
      if (i === 0) el = s('text', { class: 'k2 t6p-glyph', 'font-size': (11 * k).toFixed(1), 'text-anchor': 'middle' }, GLYPHS[j % GLYPHS.length])
      else if (i === 1) el = s('g', null, s('rect', { class: 'card', x: -5 * k, y: -4 * k, width: 10 * k, height: 8 * k }), s('path', { class: 'k', 'fill-opacity': 0.55, d: `M${-4 * k} ${3 * k}L${-1 * k} ${-1 * k}L${1 * k} ${1.5 * k}L${3 * k} ${-0.5 * k}L${4.5 * k} ${3 * k}Z` }), s('rect', { class: 't6p-tile', x: -5 * k, y: -4 * k, width: 10 * k, height: 8 * k }))
      else el = s('path', { class: 'k2', 'fill-opacity': 0.7, d: brush([[-6 * k, 0], [-3 * k, -4 * k], [0, 0], [3 * k, 4 * k], [6 * k, 0]], 1.4 * k, { a: 0.2, b: 0.2, min: 0.4 }).d })
      el.setAttribute('opacity', '0')
      st.g.append(el)
      st.parts.push({ el, t: j / n + r() * 0.05, v: 0.11 + r() * 0.04 })
    }
    if (st.open) placeParts(st, true)
  }
  function placeParts(st: Stream, show: boolean) {
    const { xy, cum } = st
    for (const p of st.parts) {
      // the point path.getPointAtLength(p.t * len) gives on this polyline, without a style/layout flush per particle per frame
      const d = clamp(p.t * st.len, 0, st.len)
      let j = 1
      while (j < cum.length - 1 && cum[j] < d) j++
      const f = cum[j] > cum[j - 1] ? (d - cum[j - 1]) / (cum[j] - cum[j - 1]) : 0
      const x = xy[2 * j - 2] + (xy[2 * j] - xy[2 * j - 2]) * f
      const y = xy[2 * j - 1] + (xy[2 * j + 1] - xy[2 * j - 1]) * f
      p.el.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`)
      // fade in at the spring, fade out into the pond
      const a = show ? Math.min(1, p.t * 6, (1 - p.t) * 5) : 0
      p.el.setAttribute('opacity', a.toFixed(2))
    }
  }

  function ripple(at: Pt, big = false) {
    if (ctx.reduced) return
    const e = s('ellipse', { class: 't6h-ring', cx: at[0], cy: at[1], rx: 4, ry: 1.5 })
    fx.append(e)
    gsap.to(e, { attr: { rx: (big ? prx * 0.8 : 26 * k), ry: (big ? pry * 0.8 : 9 * k) }, opacity: 0, duration: big ? 2.6 : 1.6, ease: 'power2.out', onComplete: () => e.remove() })
  }

  function open(i: number) {
    if (opened.has(i) || dived) return
    opened.add(i)
    streams[i].open = true
    flow?.start()
    springBtns[i].setAttribute('aria-pressed', 'true')
    passFocus(springBtns[i], springBtns.find((_, k) => !opened.has(k)) ?? (opened.size === 3 ? (diveBtn.hidden = false, diveBtn) : null))
    springBtns[i].disabled = true
    springLabs[i].classList.add('on')
    ctx.chime('soft')
    if (ctx.reduced) placeParts(streams[i], true)
    if (moon) {
      const o = 0.2 + opened.size * 0.27
      if (ctx.reduced) moon.setAttribute('opacity', String(o))
      else ctx.anim(() => gsap.to(moon, { opacity: o, duration: 1.4 }))
    }
    if (opened.size === 3) {
      ctx.insight(N.insight, N.detail)
      ctx.chime('ok')
      ctx.anim(() => {
        if (!ctx.reduced) {
          ripple(pc, true)
          gsap.fromTo(modelLab, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 1.2, delay: 0.6, ease: 'power3.out' })
        } else modelLab.style.opacity = '1'
        diveBtn.hidden = false
        diveBtn.classList.add('ready')
        pondHit.hidden = false
        lab(modelLab, pc[0], pc[1] - 12)
        placeDive()
        if (!ctx.reduced) {
          gsap.fromTo(diveBtn, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 1, delay: 1.4, ease: 'power3.out' })
          // the moon breathes: something lies below
          if (moon) gsap.to(moon, { opacity: 0.62, duration: 2.2, delay: 1.6, repeat: -1, yoyo: true, ease: 'sine.inOut' })
        }
      })
      // left alone for a while, the water clears by itself and shows the depths
      if (!ctx.reduced) idle = setTimeout(() => !dived && dive(), 9000)
    }
  }

  /** Below the surface: points of varied weight joined by dry hairlines (patterns), around a mist that does not clear. */
  let dc: Pt = [0, 0]
  let dR = 100
  let dotEls: SVGPathElement[] = []
  let threadEls: SVGPathElement[] = []
  function buildDeep() {
    deep.replaceChildren()
    dc = [W / 2, H * 0.47]
    dR = Math.min(W * 0.47, H * 0.47)
    const cid = nextId('t6pd')
    clipCircle = s('circle', { cx: dc[0], cy: dc[1], r: dived ? dR : 0 })
    deep.append(s('defs', null,
      s('clipPath', { id: cid }, clipCircle),
      s('radialGradient', { id: `${cid}-w`, cx: 0.5, cy: 0.42, r: 0.62 }, s('stop', { offset: 0, class: 't6p-dg0' }), s('stop', { offset: 0.7, class: 't6p-dg1' }), s('stop', { offset: 1, class: 't6p-dg2' }))))
    const inner = s('g', { 'clip-path': `url(#${cid})` })
    inner.append(s('circle', { cx: dc[0], cy: dc[1], r: dR + 4, fill: `url(#${cid}-w)` }))
    const r = rng(41)
    // slow currents of deeper water
    for (let i = 0; i < 4; i++) {
      inner.append(s('path', { class: 'm', 'fill-opacity': (0.05 + r() * 0.05).toFixed(3), d: blob(dc[0] + (r() - 0.5) * dR, dc[1] + (r() - 0.3) * dR * 0.9, dR * (0.4 + r() * 0.3), dR * (0.12 + r() * 0.1), 60 + i, 0.25), filter: 'url(#ink-wash)' }))
    }
    if (deepPts.length !== 40) {
      deepPts = Array.from({ length: 40 }, () => {
        const a = r() * Math.PI * 2
        const d = 0.25 + Math.sqrt(r()) * 0.7
        return { x: Math.cos(a) * d, y: Math.sin(a) * d, vx: (r() - 0.5) * 0.02, vy: (r() - 0.5) * 0.02, sz: 0.8 + r() ** 2 * 2.8, ink: Math.floor(r() * 3) }
      })
    }
    threadEls = [s('path', { class: 't6p-thread t1' }), s('path', { class: 't6p-thread t2' })]
    dotEls = [s('path', { class: 't6p-dot d0' }), s('path', { class: 't6p-dot d1' }), s('path', { class: 't6p-dot d2' })]
    mist = s('g', { class: 't6p-mist', filter: 'url(#ink-wash)' })
    const mr = dR * 0.34
    for (let i = 0; i < 5; i++) mist.append(s('path', { d: blob(dc[0] + (r() - 0.5) * mr * 0.6, dc[1] + (r() - 0.5) * mr * 0.4, mr * (0.7 + r() * 0.45), mr * (0.5 + r() * 0.3), 50 + i, 0.2), 'fill-opacity': (0.4 + r() * 0.3).toFixed(2) }))
    inner.append(...threadEls, ...dotEls, mist)
    // the porthole's rim: one brush circle that does not quite close
    ring = s('path', { class: 'k', 'fill-opacity': 0.4, d: brush(Array.from({ length: 48 }, (_, j) => {
      const a = (-80 + j * 7.2) * (Math.PI / 180)
      return [dc[0] + Math.cos(a) * dR, dc[1] + Math.sin(a) * dR] as Pt
    }), Math.max(1.6, dR * 0.014), { a: 0.04, b: 0.45, min: 0.15 }).d, filter: 'url(#ink-rough)', opacity: dived ? 1 : 0 })
    deep.append(inner, ring)
    drawDeep()
    lab(unkLab, dc[0], dc[1] - 12)
    lab(patLab, dc[0] - dR * 0.42, dc[1] - dR * 0.62)
  }
  let ring: SVGPathElement | null = null
  // drawDeep runs every frame once dived: its buffers are reused, not rebuilt
  const dd = ['', '', '']
  const tl = ['', '']
  let dp: Pt[] = []
  let links: number[] = []
  function drawDeep() {
    if (!dotEls.length) return
    dd[0] = dd[1] = dd[2] = ''
    tl[0] = tl[1] = ''
    if (dp.length !== deepPts.length) {
      dp = deepPts.map((): Pt => [0, 0])
      links = deepPts.map(() => 0)
    }
    for (let i = 0; i < dp.length; i++) {
      dp[i][0] = dc[0] + deepPts[i].x * dR
      dp[i][1] = dc[1] + deepPts[i].y * dR * 0.92
      links[i] = 0
    }
    for (let i = 0; i < dp.length; i++) {
      const a = dp[i]
      const sz = deepPts[i].sz * clamp(dR / 260, 0.8, 1.6)
      dd[deepPts[i].ink] += `M${(a[0] - sz).toFixed(1)} ${a[1].toFixed(1)}a${sz.toFixed(1)} ${sz.toFixed(1)} 0 1 0 ${(sz * 2).toFixed(1)} 0a${sz.toFixed(1)} ${sz.toFixed(1)} 0 1 0 ${(-sz * 2).toFixed(1)} 0`
      for (let j = i + 1; j < dp.length; j++) {
        if (links[i] >= 3 || links[j] >= 3) continue
        const b = dp[j]
        const d = Math.hypot(a[0] - b[0], a[1] - b[1])
        // threads thin out towards the mist: the middle stays unseen
        const m = Math.hypot((a[0] + b[0]) / 2 - dc[0], (a[1] + b[1]) / 2 - dc[1]) / dR
        if (d < dR * 0.27 && m > 0.32) {
          links[i]++
          links[j]++
          tl[d < dR * 0.17 ? 0 : 1] += `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`
        }
      }
    }
    for (let m = 0; m < dotEls.length; m++) dotEls[m].setAttribute('d', dd[m])
    for (let m = 0; m < threadEls.length; m++) threadEls[m].setAttribute('d', tl[m])
  }

  let idle = 0
  const still = () => {
    if (!idle) return
    clearTimeout(idle)
    idle = setTimeout(() => !dived && dive(), 9000)
  }
  root.addEventListener('pointerdown', still)
  ctx.el.addEventListener('keydown', still)
  ctx.onCleanup(() => clearTimeout(idle))
  function dive() {
    clearTimeout(idle)
    idle = 0
    diveBtn.classList.remove('ready')
    dived = !dived
    flow?.start()
    pondHit.setAttribute('aria-label', dived ? N.surfaceAria : N.diveAria)
    diveBtn.textContent = dived ? N.surfaceAria : N.diveAria
    root.classList.toggle('dived', dived)
    ctx.chime('soft')
    if (dived) ctx.insight(N.deep, N.deepDetail)
    const R = dR
    if (ctx.reduced) {
      deep.setAttribute('opacity', dived ? '1' : '0')
      ring?.setAttribute('opacity', dived ? '1' : '0')
      clipCircle?.setAttribute('r', dived ? String(R) : '0')
      for (const el of [patLab, unkLab]) el.style.opacity = dived ? '1' : '0'
      return
    }
    ctx.anim(() => {
      if (dived) {
        gsap.set(deep, { opacity: 1 })
        gsap.fromTo(clipCircle, { attr: { r: prx * 0.4 } }, { attr: { r: R }, duration: 1.8, ease: 'power3.inOut' })
        gsap.fromTo(ring, { opacity: 0 }, { opacity: 1, duration: 0.8, delay: 1.2 })
        gsap.fromTo([patLab, unkLab], { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 1.2, stagger: 0.4, delay: 1.2, ease: 'power3.out' })
      } else {
        gsap.to([patLab, unkLab, ring], { opacity: 0, duration: 0.4 })
        gsap.to(clipCircle, { attr: { r: 0 }, duration: 1.4, ease: 'power3.inOut', onComplete: () => void gsap.set(deep, { opacity: 0 }) })
      }
    })
  }
  diveBtn.addEventListener('click', dive)
  pondHit.addEventListener('click', dive)

  if (!ctx.reduced) {
    let t = 0
    flow = loop(ctx, (dt) => {
      t += dt
      let busy = dived
      for (const st of streams) {
        if (!st.open) continue
        busy = true
        for (const p of st.parts) {
          p.t += p.v * dt
          if (p.t >= 1) {
            p.t -= 1
            if (Math.random() < 0.6) ripple(st.inlet)
          }
        }
        placeParts(st, true)
      }
      if (dived) {
        for (const p of deepPts) {
          p.x += p.vx * dt
          p.y += p.vy * dt
          if (Math.hypot(p.x, p.y) > 0.95) (p.vx *= -1), (p.vy *= -1)
        }
        drawDeep()
        mist?.setAttribute('transform', `rotate(${(Math.sin(t * 0.2) * 6).toFixed(2)} ${dc[0]} ${dc[1]})`)
      }
      return busy
    })
  }

  onSize(ctx, root, layout, stable.reset)
  layout()
  ctx.prompt(N.prompt)
  if (!ctx.reduced) gsap.from([pondG, streamsG, springs], { opacity: 0, duration: 1.6, stagger: 0.25, ease: 'power2.out', delay: 0.3 })
}
