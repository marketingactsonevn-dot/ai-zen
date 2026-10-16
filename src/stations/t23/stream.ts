import { fill, h, nextId, s } from '../../core/dom'
import type { SceneCtx } from '../types'
import { rng } from '../../ui/part2/ink'
import { C } from './data'
import { canvas, clamp, f1, fbm, field, lerp, mix, put, rgba, rig, sm, softEllipse, stone, vn, type Pal, type Pt, type RGB, type Rig } from './lit'

const K = C.scenes.stream
const TAU = Math.PI * 2
/** the moon grazes from the far upper right: light comes from beyond the terraces, a little toward us */
const LIGHT: [number, number, number] = (() => {
  const v = [0.5, -0.62, 0.6]
  const l = Math.hypot(v[0], v[1], v[2])
  return [v[0] / l, v[1] / l, v[2] / l] as [number, number, number]
})()

type E4 = [number, number, number, number]
type Lay = {
  /** y of each tier's lip (tier 0 = the far one, above the valley), and the height of the steep face that drops from it */
  lips: number[]
  faces: number[]
  aus: E4 // pond cx, cy, rx (share of W), ry (share of H)
  tex: E4
  rocks: { dallas: E4; capital: E4 } // cx, cy, w (W), h (H)
  cleft: { dallas: Pt; capital: Pt }
  sluice: Record<string, Pt>
  weir: Pt
  cal: Pt
  ausName: Pt
  q: E4 // question slab x0, y0, x1, y1
  cut: [number, number, number] // the shortcut's label: x, y, side (1 = it ends at x)
  /** water carried in bamboo (kakehi): its centre line, near end first */
  pipes: Record<string, Pt[]>
  /** a thin rill finding its own way down the terraces (the shortcut) */
  rills: Record<string, Pt[]>
  /** water over a lip: the notch, the foot in the pond below, the curtain's width (share of W) */
  falls: Record<string, [Pt, Pt, number]>
  /** three other cascades on the hillsides: x, top, bottom */
  casc: [number, number, number][]
  moon: Pt
}

const WIDE: Lay = {
  lips: [0.27, 0.45, 0.68],
  faces: [0.045, 0.07, 0.095],
  aus: [0.555, 0.345, 0.066, 0.035],
  tex: [0.47, 0.523, 0.125, 0.062],
  rocks: { dallas: [0.35, 0.81, 0.15, 0.2], capital: [0.785, 0.815, 0.13, 0.19] },
  cleft: { dallas: [0.37, 0.737], capital: [0.775, 0.742] },
  sluice: { dallas: [0.37, 0.742], capital: [0.775, 0.749], texas: [0.53, 0.458], austin: [0.604, 0.39] },
  weir: [0.43, 0.46],
  cal: [0.33, 0.6],
  ausName: [0.555, 0.305],
  q: [0.035, 0.735, 0.255, 0.9],
  cut: [0.205, 0.55, 1],
  pipes: {
    'dallas>texas': [[0.37, 0.737], [0.395, 0.71], [0.418, 0.686]],
    'capital>austin': [[0.775, 0.742], [0.7, 0.56], [0.623, 0.352]],
  },
  rills: { 'dallas>austin': [[0.33, 0.775], [0.255, 0.715], [0.222, 0.635], [0.235, 0.545], [0.29, 0.475], [0.4, 0.405], [0.5, 0.37]] },
  falls: { 'dallas>texas': [[0.42, 0.682], [0.432, 0.588], 0.026], 'texas>austin': [[0.53, 0.452], [0.545, 0.383], 0.017] },
  casc: [[0.09, 0.17, 0.4], [0.24, 0.22, 0.41], [0.92, 0.19, 0.4]],
  moon: [0.86, 0.075],
}
const TALL: Lay = {
  lips: [0.31, 0.46, 0.65],
  faces: [0.03, 0.055, 0.075],
  aus: [0.55, 0.377, 0.15, 0.028],
  tex: [0.4, 0.525, 0.22, 0.05],
  rocks: { dallas: [0.27, 0.74, 0.3, 0.12], capital: [0.77, 0.75, 0.28, 0.11] },
  cleft: { dallas: [0.3, 0.705], capital: [0.76, 0.715] },
  sluice: { dallas: [0.3, 0.71], capital: [0.76, 0.72], texas: [0.36, 0.468], austin: [0.62, 0.417] },
  weir: [0.6, 0.477],
  cal: [0.745, 0.578],
  ausName: [0.55, 0.343],
  q: [0.03, 0.83, 0.62, 0.965],
  cut: [0.1, 0.595, 0],
  pipes: {
    'dallas>texas': [[0.3, 0.705], [0.32, 0.678], [0.34, 0.654]],
    'capital>austin': [[0.76, 0.715], [0.92, 0.57], [0.7, 0.38]],
  },
  rills: { 'dallas>austin': [[0.17, 0.725], [0.07, 0.645], [0.05, 0.555], [0.09, 0.475], [0.2, 0.415], [0.41, 0.385]] },
  falls: { 'dallas>texas': [[0.34, 0.652], [0.36, 0.578], 0.05], 'texas>austin': [[0.36, 0.462], [0.43, 0.408], 0.034] },
  casc: [[0.07, 0.16, 0.29], [0.3, 0.2, 0.29], [0.93, 0.19, 0.29]],
  moon: [0.84, 0.065],
}

/**
 * Scene 3 — HIGH, from the source: we stand at the top of a terraced cascade and look down the valley. Each terrace ends
 * in a stone lip that catches the moon on its edge; below it a steep face (in shadow) drops to the next pond. Near and
 * big, two springs break from clefts in rocks carved "Dallas" and "capital"; bamboo pipes (kakehi) carry them. In the
 * middle the pool "Texas" behind its carved weir; far below, the small pool "Austin" holds the moon. Lift each sluice
 * stone in turn and the water finds its way: white curtains fall from lip to pond, the pools fill, Austin fills → the
 * insight. Then lift Texas out and set California in: the water reroutes and the last pool reads "Sacramento", while mist
 * thickens over the three other cascades on the hillsides (the method's limit).
 */
export function streamScene(ctx: SceneCtx) {
  const ids = K.nodes.map((n) => n.id)
  const still = ctx.quality === 'low' || ctx.reduced
  let step = 0
  let swapped = false
  let L: Lay = WIDE
  let W = 0, H = 0
  const X = (x: number) => x * W, Y = (y: number) => y * H

  const R = rig(ctx, { cls: 't23s', art: K.art, copies: [K.insight], persp: 1000, swing: 0.03, bleed: true, build })
  const Lsky = R.layer(0, 't23s-sky')
  const Lfar = R.layer(50, 't23s-far')
  const Lmid = R.layer(100, 't23s-mid')
  const Lnear = R.layer(170, 't23s-near')
  const Lflow = R.layer(175, 't23s-flowl')
  const Lfront = R.layer(240, 't23s-front')
  const Ltext = R.layer(176, 't23s-text')
  const skyArt = h('div', { class: 't23-abs' })
  const fogs = [0, 1, 2].map((i) => h('i', { class: `t23s-fog f${i}` }))
  Lsky.append(skyArt, ...fogs)
  const farArt = h('div', { class: 't23-abs' })
  const ausWater = h('div', { class: 't23s-pool aus' })
  const ausRim = h('div', { class: 't23-abs' })
  Lfar.append(farArt, ausWater, ausRim)
  const midArt = h('div', { class: 't23-abs' })
  const texWater = h('div', { class: 't23s-pool tex' })
  const texRim = h('div', { class: 't23-abs' })
  Lmid.append(midArt, texWater, texRim)
  const flows = s('svg', { class: 't23s-flows', 'aria-hidden': 'true' })
  Lflow.append(flows)
  const nearArt = h('div', { class: 't23-abs' })
  const pipeArt = h('div', { class: 't23-abs' })
  Lnear.append(nearArt, pipeArt)
  // every word sits above the water's paths, so no channel ever runs through a name
  const weir = h('div', { class: 't23s-slab weir' }, h('span', { class: 't23-carve' }, K.nodes[2].label))
  const cal = h('button', { class: 't23s-slab cal', type: 'button', 'aria-label': K.swapAria, 'aria-pressed': 'false', disabled: true }, h('span', { class: 't23-carve' }, K.swapTo))
  const ausName = h('p', { class: 't23s-name t23-carve small' }, K.nodes[3].label)
  const cutLab = h('span', { class: 't23s-cut', 'aria-hidden': 'true' }, K.shortcut)
  const names = { dallas: h('p', { class: 't23s-name t23-carve' }, K.nodes[0].label), capital: h('p', { class: 't23s-name t23-carve' }, K.nodes[1].label) }
  Ltext.append(weir, cal, ausName, cutLab, names.dallas, names.capital)
  const qArt = h('div', { class: 't23-abs' })
  const q = h('p', { class: 't23s-q t23-carve' }, K.question)
  Lfront.append(qArt, q)
  // the sluice stones: one button each, in the order the water must be followed
  const sluices = K.nodes.map((n, i) => h('button', { class: `t23s-sluice t23-grab s-${n.id}`, type: 'button', onClick: () => go(i) }, h('i', { class: 't23s-sh' }), h('i', { class: 't23s-st' })))
  const over = h('div', { class: 't23-over' }, ...sluices)
  R.view.append(over)
  const limit = h('div', { class: 't23s-limit', 'data-off': '' }, ctx.fact(K.limit, 'p', 't23-note'))
  R.root.append(limit)
  ctx.prompt(K.prompt)
  sync()

  const P = (pt: Pt): Pt => [X(pt[0]), Y(pt[1])]
  const lipY = (k: number, x: number) => {
    // terraces follow the contour: they curve up toward the sides, wobble a little where the water has worn the lip
    const u = x / W - 0.5
    return Y(L.lips[k]) - Y(0.07) * u * u * 4 + Math.sin(x * 0.012 + k * 2) * Y(0.003)
  }

  function* build(R: Rig, first: boolean): Generator<unknown, void> {
    W = R.W
    H = R.H
    const p = R.pal
    const wide = W / H > 1.1
    L = wide ? WIDE : TALL
    const fresh: [HTMLElement, Node[]][] = []
    const out = (el: HTMLElement, ...kids: Node[]) => (first ? el.replaceChildren(...kids) : fresh.push([el, kids]))
    const tone: [RGB, RGB, RGB, RGB] = p.dark ? [p.hi, p.mid, p.lo, p.umbra] : [mix(p.hi, p.mid, 0.4), mix(p.mid, p.lo, 0.3), mix(p.lo, p.umbra, 0.1), mix(p.umbra, p.lo, 0.25)]
    const mt: [RGB, RGB, RGB] = p.dark ? [p.mossC, p.mossA, p.mossB] : [mix(p.mossC, p.paper, 0.15), p.mossA, p.mossB]
    const sOpts = { tone, mossTone: mt, rim: p.dark ? p.moon : p.wash, rimA: p.dark ? 0.6 : 0.36, light: LIGHT, up: 'y' as const, inkA: 0.55, grain: 0.05, amb: 0.16, dry: 0.25 }
    // farther = paler in the valley's mist
    const HAZE = [0.45, 0.22, 0]
    const hazeC: RGB = p.dark ? mix(p.paper, p.mist, 0.22) : mix(p.paper, p.card, 0.4)
    const hz = (c: RGB, k: number) => mix(c, hazeC, HAZE[k])
    const hzT = (t: [RGB, RGB, RGB, RGB], k: number): [RGB, RGB, RGB, RGB] => [hz(t[0], k), hz(t[1], k), hz(t[2], k), hz(t[3], k)]
    const waterC = p.dark ? { far: mix(p.paper, p.mist, 0.36), near: mix(p.paper, p.mist, 0.16) } : { far: mix(p.water, p.card, 0.6), near: mix(p.water, p.wash, 0.2) }

    // ── the valley under the moon: sky, two ranges, three other cascades on the slopes, each with its own mist
    {
      const c = canvas(W, H, R.dpr)
      const g = c.g
      const hzY = Y(L.lips[0])
      const sky = g.createLinearGradient(0, 0, 0, hzY)
      sky.addColorStop(0, rgba(p.paper, 0))
      sky.addColorStop(0.5, rgba(p.dark ? mix(p.paper, p.mist, 0.1) : p.card, 0.7))
      sky.addColorStop(1, rgba(p.dark ? mix(p.paper, p.mist, 0.2) : p.card, 1))
      g.fillStyle = sky
      g.fillRect(0, 0, W, hzY + Y(0.1))
      const [mx, my] = P(L.moon)
      const mr = Math.min(W, H) * 0.03
      const mg = g.createRadialGradient(mx, my, 0, mx, my, mr * 8)
      mg.addColorStop(0, rgba(p.moon, p.dark ? 0.4 : 0.55))
      mg.addColorStop(1, rgba(p.moon, 0))
      g.fillStyle = mg
      g.fillRect(mx - mr * 8, my - mr * 8, mr * 16, mr * 16)
      g.fillStyle = rgba(p.moon)
      g.beginPath()
      g.arc(mx, my, mr, 0, TAU)
      g.fill()
      const ridge = (base: number, amp: number, seed: number, col: RGB, a: number) => {
        g.fillStyle = rgba(col, a)
        g.beginPath()
        g.moveTo(0, base + amp)
        for (let x = 0; x <= W; x += 5) g.lineTo(x, base - amp * (0.3 + 0.7 * fbm(x * 0.005 + seed, seed, 4)) - Math.abs(x / W - 0.5) * amp * 1.2)
        g.lineTo(W, H)
        g.lineTo(0, H)
        g.closePath()
        g.fill()
      }
      ridge(hzY * 0.62, hzY * 0.3, 5, p.dark ? mix(p.wash, p.mist, 0.16) : mix(p.wash, p.paper, 0.8), 0.95)
      ridge(hzY * 0.85, hzY * 0.25, 11, p.dark ? mix(p.wash, p.mist, 0.08) : mix(p.wash, p.paper, 0.66), 0.97)
      // the other cascades: stepped white threads down the slopes, a tiny pool at each step, a breath of mist on each
      const r = rng(2360)
      for (const [cx, y0, y1] of L.casc) {
        let x = X(cx)
        const n = 4
        for (let k = 0; k < n; k++) {
          const ya = Y(y0 + ((y1 - y0) * k) / n), yb = Y(y0 + ((y1 - y0) * (k + 0.8)) / n)
          const w = Math.max(2, W * (0.003 + k * 0.0012))
          const fg = g.createLinearGradient(0, ya, 0, yb)
          fg.addColorStop(0, rgba(p.dark ? p.moon : p.card, p.dark ? 0.32 : 0.9))
          fg.addColorStop(1, rgba(p.dark ? p.mist : p.card, p.dark ? 0.15 : 0.55))
          g.fillStyle = fg
          g.beginPath()
          g.moveTo(x - w * 0.5, ya)
          g.lineTo(x + w * 0.5, ya)
          g.lineTo(x + w * 0.9, yb)
          g.lineTo(x - w * 0.9, yb)
          g.closePath()
          g.fill()
          g.fillStyle = rgba(p.dark ? mix(p.paper, p.mist, 0.35) : mix(p.water, p.card, 0.5), p.dark ? 0.5 : 0.7)
          g.beginPath()
          g.ellipse(x + w * 0.4, yb + w * 0.4, w * 3.2, w * 0.9, 0, 0, TAU)
          g.fill()
          softEllipse(g, x, yb - w, w * 5, w * 2.2, p.mist, p.dark ? 0.12 : 0.5)
          x += (r() - 0.5) * W * 0.012 + w
        }
      }
      // the slopes falling away on both sides of the cascade, dark under the mist
      for (const sd of [-1, 1]) {
        const sg = g.createLinearGradient(sd < 0 ? 0 : W, 0, W / 2, 0)
        sg.addColorStop(0, rgba(p.dark ? mix(p.wash, p.mossB, 0.2) : mix(p.wash, p.paper, 0.7), p.dark ? 0.85 : 0.4))
        sg.addColorStop(1, rgba(p.dark ? mix(p.wash, p.mossB, 0.2) : mix(p.wash, p.paper, 0.55), 0))
        g.fillStyle = sg
        g.beginPath()
        g.moveTo(sd < 0 ? 0 : W, hzY * 0.95)
        g.quadraticCurveTo(W / 2 + sd * W * 0.2, hzY * 1.05, W / 2 + sd * W * 0.12, H)
        g.lineTo(sd < 0 ? 0 : W, H)
        g.closePath()
        g.fill()
      }
      const mist = g.createLinearGradient(0, hzY * 0.6, 0, H)
      mist.addColorStop(0, rgba(p.mist, 0))
      mist.addColorStop(0.2, rgba(p.mist, p.dark ? 0.18 : 0.6))
      mist.addColorStop(0.6, rgba(p.dark ? mix(p.paper, p.mist, 0.12) : p.mist, p.dark ? 0.3 : 0.45))
      mist.addColorStop(1, rgba(p.paper, 0))
      g.fillStyle = mist
      g.fillRect(0, hzY * 0.6, W, H)
      out(skyArt, c.c)
      fogs.forEach((f, i) => {
        const [cx, y0, y1] = L.casc[i]
        Object.assign(f.style, { left: `${f1(X(cx) - W * 0.08)}px`, top: `${f1(Y(y0 - 0.04))}px`, width: `${f1(W * 0.16)}px`, height: `${f1(Y(y1 - y0 + 0.08))}px` })
      })
      yield
    }
    // ── a terrace: its tread (stone and moss, lit at its far edge), the steep face that drops from its lip (rock-lo,
    //    streaked, only its top catching the moon), the dressed stones along the lip; farther ones paler
    const halfW = (k: number, d: number) => (wide ? 0.2 + k * 0.08 : 0.32 + k * 0.07) + (Math.max(0, d) / H) * (wide ? 0.45 : 0.3)
    const sideA = (k: number, x: number, d: number) => 1 - sm(halfW(k, d) - 0.1, halfW(k, d) + 0.05, Math.abs(x / W - 0.5))
    const terrace = function* (k: number) {
      const fh = Y(L.faces[k])
      const top = lipY(k, W / 2) - fh - Y(0.02)
      const c = canvas(W, H - top, R.dpr)
      const g = c.g
      g.translate(0, -top)
      const base = hz(p.dark ? mix(p.lo, p.mossB, 0.4) : mix(p.mid, p.mossC, 0.35), k)
      const dark = hz(p.dark ? mix(p.umbra, p.lo, 0.55) : mix(p.lo, p.mossB, 0.3), k)
      const lit = hz(p.dark ? mix(p.mid, p.mossC, 0.35) : mix(p.hi, p.mossC, 0.3), k)
      const moss = hz(p.dark ? p.mossB : p.mossA, k)
      const face = hz(p.dark ? mix(p.lo, p.umbra, 0.3) : mix(p.lo, p.wash, 0.12), k)
      const faceD = hz(p.dark ? mix(p.umbra, p.lo, 0.25) : mix(p.lo, p.umbra, 0.4), k)
      const f = yield* field(W, H - top, 4, (x, yy, o) => {
        const y = yy + top
        const d = y - lipY(k, x)
        const n = fbm(x * 0.005 + k * 9, y * 0.011, 4), m = fbm(x * 0.018 + 40, y * 0.036 + k, 3)
        let cc: RGB
        let a: number
        if (d < 0) {
          // the face: streaks running down it, darker toward its foot, a soft top where it meets the tier below
          const st = fbm(x * 0.025 + k * 7, y * 0.006, 3), ck = vn(x * 0.11 + k * 3, y * 0.004)
          cc = mix(face, faceD, sm(0.4, 0.7, st) * 0.6 + (1 + d / fh) * 0.25)
          cc = mix(cc, faceD, sm(0.86, 0.95, ck) * 0.6) // a few cracks running down
          cc = mix(cc, moss, sm(0.6, 0.78, m) * 0.35)
          a = sm(-fh * 1.05, -fh * 0.7, d)
        } else {
          cc = mix(dark, base, sm(0.3, 0.68, n))
          cc = mix(cc, moss, sm(0.55, 0.72, m) * 0.55)
          cc = mix(cc, lit, (1 - sm(0, Y(0.05), d)) * 0.45)
          cc = mix(cc, dark, sm(Y(0.12), Y(0.34), d) * 0.45)
          a = 1
        }
        // the terraces are a stepped hillside round the cascade: they melt into the valley mist at the sides
        a *= sideA(k, x + (n - 0.5) * W * 0.1, Math.max(0, d)) * (1 - sm(H * 0.94, H * 1.02, y))
        o[0] = cc[0]; o[1] = cc[1]; o[2] = cc[2]; o[3] = a
      })
      put(g, f, 0, top, W, H - top)
      g.save()
      g.globalCompositeOperation = 'source-atop'
      // the lip's top: a band of dressed stone, its far edge silver in the grazing moon, its near side shadowed
      const th = Y(0.006 + k * 0.004)
      const edge: Pt[] = []
      for (let x = -12; x <= W + 12; x += 4) edge.push([x, lipY(k, x)])
      g.fillStyle = rgba(hz(p.dark ? mix(p.mid, p.lo, 0.2) : mix(p.stepMid, p.mid, 0.3), k))
      g.beginPath()
      edge.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
      for (let i = edge.length - 1; i >= 0; i--) g.lineTo(edge[i][0], edge[i][1] + th)
      g.fill()
      const sg = g.createLinearGradient(0, lipY(k, W / 2) + th, 0, lipY(k, W / 2) + th * 4)
      sg.addColorStop(0, rgba(p.umbra, p.dark ? 0.5 : 0.25))
      sg.addColorStop(1, rgba(p.umbra, 0))
      g.fillStyle = sg
      g.beginPath()
      edge.forEach(([x, y], i) => (i ? g.lineTo(x, y + th) : g.moveTo(x, y + th)))
      for (let i = edge.length - 1; i >= 0; i--) g.lineTo(edge[i][0], edge[i][1] + th * 4)
      g.fill()
      g.lineCap = 'round'
      g.lineWidth = 1.2 + (2 - k) * 0.6
      for (let i = 1; i < edge.length; i++) {
        const [x0, y0] = edge[i - 1], [x1, y1] = edge[i]
        // brighter toward the moon's side
        const a = (p.dark ? 0.85 - HAZE[k] * 0.4 : 1) * sm(0.2, 0.55, vn(x0 * 0.012, k * 3 + 1)) * (0.55 + 0.45 * (x0 / W))
        if (a < 0.03) continue
        g.strokeStyle = rgba(p.dark ? p.moon : p.card, a)
        g.beginPath()
        g.moveTo(x0, y0)
        g.lineTo(x1, y1)
        g.stroke()
      }
      g.restore()
      Object.assign(c.c.style, { top: `${f1(top)}px` })
      return c
    }
    // a wet dark stain down the face where a fall will run (before the water comes, the stone remembers it)
    const stain = (g: CanvasRenderingContext2D, key: string) => {
      const [[lx, ly], [fx, fy], fw] = L.falls[key]
      const [x0, y0] = P([lx, ly]), [x1, y1] = P([fx, fy]), w = X(fw)
      const sg = g.createLinearGradient(0, y0, 0, y1)
      sg.addColorStop(0, rgba(p.umbra, p.dark ? 0.55 : 0.3))
      sg.addColorStop(1, rgba(p.umbra, p.dark ? 0.3 : 0.15))
      g.fillStyle = sg
      g.beginPath()
      g.moveTo(x0 - w * 0.5, y0)
      g.lineTo(x0 + w * 0.5, y0)
      g.lineTo(x1 + w * 0.8, y1)
      g.lineTo(x1 - w * 0.8, y1)
      g.closePath()
      g.fill()
      // the notch worn into the lip
      g.fillStyle = rgba(p.umbra, p.dark ? 0.6 : 0.3)
      g.beginPath()
      g.ellipse(x0, y0 + 1, w * 0.62, Math.max(2, w * 0.14), 0, 0, TAU)
      g.fill()
    }
    // stones in clusters along a lip, skipping the notches and the pipes
    const lipStones = function* (g: CanvasRenderingContext2D, k: number, n: number, sz: number, skip: number[]) {
      const r = rng(2370 + k)
      for (let i = 0; i < n; i++) {
        const x0 = (W * (i + 0.15 + r() * 0.7)) / n
        if (skip.some((sx) => Math.abs(x0 - X(sx)) < W * 0.05) || r() < 0.3 || sideA(k, x0, 0) < 0.5) continue
        const m = 1 + Math.floor(r() * 3)
        for (let j = 0; j < m; j++) {
          const x = x0 + (j - m / 2) * sz * 0.9 + (r() - 0.5) * sz * 0.4
          const y = lipY(k, x) + sz * (0.05 + r() * 0.25)
          const w = sz * (0.6 + r() * 1.1), hh = w * (0.45 + r() * 0.25)
          softEllipse(g, x - w * 0.15, y + hh * 0.25, w * 0.55, hh * 0.3, p.umbra, p.dark ? 0.6 : 0.3)
          const st = yield* stone({ ...sOpts, tone: hzT(tone, k), w, h: hh, seed: 2380 + k * 50 + i * 7 + j, flat: 0.45, wob: 0.18, bump: 0.03, moss: 0.45 }, R.dpr)
          g.drawImage(st, x - w / 2, y - hh * 0.75, w, hh)
        }
      }
    }
    /**
     * A pond: its dry bowl and the stones of its far bank on the terrace (the water, added later, covers their feet);
     * the stones of its near bank on their own canvas, over the water. Varied sizes, overlapping, mossy.
     */
    const pond = function* (g: CanvasRenderingContext2D, e: E4, k: number, seed: number) {
      const [cx, cy, rx, ry] = [X(e[0]), Y(e[1]), X(e[2]), Y(e[3])]
      const r = rng(seed)
      // the bowl: a dark hollow, its far inner wall in shadow, a few pebbles on the bottom
      softEllipse(g, cx, cy + ry * 0.1, rx * 1.12, ry * 1.25, p.umbra, p.dark ? 0.6 : 0.3)
      const bg = g.createRadialGradient(cx, cy + ry * 0.35, ry * 0.2, cx, cy, rx)
      bg.addColorStop(0, rgba(hz(p.dark ? mix(p.lo, p.umbra, 0.4) : mix(p.lo, p.wash, 0.3), k)))
      bg.addColorStop(1, rgba(hz(p.dark ? p.umbra : mix(p.lo, p.umbra, 0.3), k)))
      g.fillStyle = bg
      g.beginPath()
      g.ellipse(cx, cy, rx, ry, 0, 0, TAU)
      g.fill()
      for (let i = 0; i < 14; i++) {
        const a = r() * TAU, q = Math.sqrt(r()) * 0.75
        g.fillStyle = rgba(hz(p.dark ? p.lo : p.mid, k), 0.6)
        g.beginPath()
        g.ellipse(cx + Math.cos(a) * rx * q, cy + Math.sin(a) * ry * q, rx * 0.03, ry * 0.06, 0, 0, TAU)
        g.fill()
      }
      // the rim stones round the ellipse: big and small, a second one behind some
      const stones: [number, number, number, number, number][] = []
      let a = -Math.PI + r() * 0.3
      while (a < Math.PI) {
        const big = r() < 0.35
        const sz = Math.max(8, ry * (big ? 0.7 + r() * 0.45 : 0.32 + r() * 0.28)) * (wide ? 1 : 1.15)
        const w = sz * (1.3 + r() * 0.9), hh = sz * (0.75 + r() * 0.35)
        const q = 1.0 + r() * 0.06
        stones.push([cx + Math.cos(a) * (rx * q + w * 0.22), cy + Math.sin(a) * (ry * q + hh * 0.15), w, hh, a])
        // the next one: close, overlapping, or after a gap of mossy bank
        a += (w * (0.7 + r() * 0.5)) / Math.max(rx * Math.abs(Math.sin(a)) + ry * Math.abs(Math.cos(a)) * 2.4, 1) + (r() < 0.22 ? 0.35 + r() * 0.3 : 0.02)
      }
      stones.sort((u, v) => u[1] - v[1])
      const front = canvas(rx * 2 + ry * 6, ry * 2 + ry * 5, R.dpr)
      const fx0 = cx - rx - ry * 3, fy0 = cy - ry - ry * 2
      front.g.translate(-fx0, -fy0)
      for (const [x, y, w, hh, an] of stones) {
        const near = Math.sin(an) > 0.15
        const gg = near ? front.g : g
        softEllipse(gg, x - w * 0.12, y + hh * 0.3, w * 0.58, hh * 0.32, p.umbra, p.dark ? 0.6 : 0.3)
        const st = yield* stone({ ...sOpts, tone: hzT(tone, k), w, h: hh, seed: (x * 7 + y * 3) | 0, flat: 0.4, wob: 0.16, bump: 0.035, moss: 0.3 + r() * 0.4, height: 0.9 }, R.dpr)
        gg.drawImage(st, x - w / 2, y - hh * 0.72, w, hh)
      }
      Object.assign(front.c.style, { left: `${f1(fx0)}px`, top: `${f1(fy0)}px` })
      return front.c
    }
    // the water of a pond: the sky held in its far part, darker toward us, the moon on it, the shadow of its far bank
    const water = (el: HTMLElement, e: E4, seed: number, moon: number) => {
      const [cx, cy, rx, ry] = [X(e[0]), Y(e[1]), X(e[2]), Y(e[3])]
      const c = canvas(rx * 2, ry * 2, R.dpr)
      const g = c.g
      g.save()
      g.beginPath()
      g.ellipse(rx, ry, rx * 0.97, ry * 0.93, 0, 0, TAU)
      g.clip()
      const wg = g.createLinearGradient(0, 0, 0, ry * 2)
      wg.addColorStop(0, rgba(waterC.far))
      wg.addColorStop(1, rgba(waterC.near))
      g.fillStyle = wg
      g.fillRect(0, 0, rx * 2, ry * 2)
      const sh = g.createLinearGradient(0, 0, 0, ry * 0.7)
      sh.addColorStop(0, rgba(p.umbra, p.dark ? 0.5 : 0.28))
      sh.addColorStop(1, rgba(p.umbra, 0))
      g.fillStyle = sh
      g.fillRect(0, 0, rx * 2, ry * 0.7)
      // the moon: a bright broken streak on the far right of the water
      const mx = rx * 1.45, my = ry * 0.85
      const mg = g.createRadialGradient(mx, my, 0, mx, my, ry * 0.9)
      mg.addColorStop(0, rgba(p.moon, 0.95 * moon))
      mg.addColorStop(0.35, rgba(p.moon, 0.5 * moon))
      mg.addColorStop(1, rgba(p.moon, 0))
      g.fillStyle = mg
      g.save()
      g.translate(mx, my)
      g.scale(0.55, 1)
      g.beginPath()
      g.arc(0, 0, ry * 0.9, 0, TAU)
      g.fill()
      g.restore()
      const r = rng(seed)
      g.lineCap = 'round'
      for (let i = 0; i < 9; i++) {
        const y = ry * (0.3 + r() * 1.4), len = rx * (0.06 + r() * 0.22)
        const x = i < 4 ? mx + (r() - 0.5) * rx * 0.2 : rx * (0.3 + r() * 1.3)
        g.strokeStyle = rgba(p.dark ? p.moon : p.card, (i < 4 ? 0.9 : 0.45) * (p.dark ? 0.7 : 1))
        g.lineWidth = 0.8 + r() * 0.9
        g.beginPath()
        g.moveTo(x - len / 2, y)
        g.lineTo(x + len / 2, y)
        g.stroke()
      }
      g.restore()
      Object.assign(el.style, { left: `${f1(cx - rx)}px`, top: `${f1(cy - ry)}px`, width: `${f1(rx * 2)}px`, height: `${f1(ry * 2)}px` })
      out(el, c.c)
    }
    // far tier (Austin)
    {
      const c = yield* terrace(0)
      const g = c.g
      const front = yield* pond(g, L.aus, 0, 2420)
      yield* lipStones(g, 0, wide ? 12 : 7, Math.min(W, H) * 0.028, [])
      out(farArt, c.c)
      out(ausRim, front)
      water(ausWater, L.aus, 2402, 1)
      yield
    }
    // middle tier (Texas): its face drops into Austin's tier, with the curtain's stain in it
    {
      const c = yield* terrace(1)
      const g = c.g
      stain(g, 'texas>austin')
      const front = yield* pond(g, L.tex, 1, 2421)
      yield* lipStones(g, 1, wide ? 10 : 6, Math.min(W, H) * 0.04, [L.falls['texas>austin'][0][0], L.weir[0]])
      out(midArt, c.c)
      out(texRim, front)
      water(texWater, L.tex, 2401, 0.8)
      yield
    }
    // near tier (the source): its face drops into Texas; two rocks with clefts
    {
      const c = yield* terrace(2)
      const g = c.g
      stain(g, 'dallas>texas')
      yield* lipStones(g, 2, wide ? 9 : 5, Math.min(W, H) * 0.052, [L.falls['dallas>texas'][0][0], L.rills['dallas>austin'][1][0], L.pipes['capital>austin'][1][0]])
      for (const id of ['dallas', 'capital'] as const) {
        const [cx, cy, rw, rh] = L.rocks[id]
        const w = X(rw), hh = Y(rh)
        softEllipse(g, X(cx) - w * 0.12, Y(cy) + hh * 0.38, w * 0.66, hh * 0.22, p.umbra, p.dark ? 0.75 : 0.38)
        const st = yield* stone({ ...sOpts, w, h: hh, seed: id === 'dallas' ? 2391 : 2392, flat: 0.38, wob: 0.14, bump: 0.035, height: 0.9, moss: 0.4, sq: 2.6 }, R.dpr)
        g.drawImage(st, X(cx) - w / 2, Y(cy) - hh / 2, w, hh)
        // the cleft: a dark crack the spring comes out of, wet below it
        const [kx, ky] = P(L.cleft[id])
        g.fillStyle = rgba(p.umbra, 0.9)
        g.beginPath()
        g.moveTo(kx - w * 0.05, ky - hh * 0.02)
        g.quadraticCurveTo(kx, ky - hh * 0.12, kx + w * 0.04, ky - hh * 0.03)
        g.quadraticCurveTo(kx + w * 0.012, ky + hh * 0.1, kx - w * 0.01, ky + hh * 0.2)
        g.quadraticCurveTo(kx - w * 0.02, ky + hh * 0.08, kx - w * 0.05, ky - hh * 0.02)
        g.fill()
      }
      out(nearArt, c.c)
      yield
      // the kakehi: split bamboo on crossed posts, its nodes closer and its bore thinner as it runs away from us
      const pc = canvas(W, H, R.dpr)
      for (const pts of Object.values(L.rills)) rill(pc.g, p, pts.map(P))
      for (const pts of Object.values(L.pipes)) kakehi(pc.g, p, pts.map(P), Math.max(6, W * (wide ? 0.012 : 0.026)), false)
      out(pipeArt, pc.c)
      yield
    }
    // the question slab in the foreground, lit, whole inside the frame
    {
      const [x0, y0, x1, y1] = L.q
      const w = X(x1 - x0), hh = Y(y1 - y0)
      const st = yield* stone({ ...sOpts, w, h: hh, seed: 2399, slab: 0.12, sq: 3.2, wob: 0.06, bump: 0.02, height: 0.25, moss: 0.18, light: [0.3, -0.75, 0.6] }, R.dpr)
      const c = canvas(w, hh + hh * 0.2, R.dpr)
      softEllipse(c.g, w * 0.46, hh * 0.92, w * 0.5, hh * 0.18, p.umbra, p.dark ? 0.7 : 0.35)
      c.g.drawImage(st, 0, 0, w, hh)
      Object.assign(c.c.style, { left: `${f1(X(x0))}px`, top: `${f1(Y(y0))}px` })
      out(qArt, c.c)
      Object.assign(q.style, { left: `${f1(X(x0) + w * 0.09)}px`, top: `${f1(Y(y0) + hh * 0.2)}px`, width: `${f1(w * 0.82)}px`, fontSize: `${f1(clamp(W * 0.012, 14, 17))}px` })
      yield
    }
    // the weir and the California slab, the sluice stones, the words
    {
      const fs = clamp(W * (wide ? 0.012 : 0.038), 14, 17)
      const slab = function* (el: HTMLElement, at: Pt, w: number, hh: number, seed: number, flat: boolean) {
        const st = yield* stone({ ...sOpts, w, h: hh, seed, slab: flat ? 0.18 : 0.1, sq: 3.4, wob: 0.06, bump: 0.04, height: flat ? 0.3 : 0.5, moss: 0.25 }, R.dpr)
        st.style.cssText = `width:${f1(w)}px;height:${f1(hh)}px;left:0;top:0`
        Object.assign(el.style, { left: `${f1(X(at[0]) - w / 2)}px`, top: `${f1(Y(at[1]) - hh)}px`, width: `${f1(w)}px`, height: `${f1(hh)}px`, fontSize: `${f1(fs)}px` })
        out(el, st, el.lastElementChild as HTMLElement)
      }
      yield* slab(weir, L.weir, Math.max(76, fs * 5.2), fs * (wide ? 2.6 : 2.3), 2403, false)
      yield* slab(cal, L.cal, Math.max(100, fs * 7), fs * 2.3, 2404, true)
      const ss = Math.max(26, Math.min(W, H) * 0.045)
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i]
        const at = P(L.sluice[id])
        const sz = ss * (id === 'austin' ? 0.62 : id === 'texas' ? 0.78 : 1)
        const st = yield* stone({ ...sOpts, w: sz, h: sz * 0.7, seed: 2410 + i, flat: 0.4, wob: 0.12, bump: 0.04, moss: 0.2 }, R.dpr)
        st.style.cssText = 'width:100%;height:100%;left:0;top:0'
        const box = Math.max(44, sz * 1.5)
        Object.assign(sluices[i].style, { left: `${f1(at[0] - box / 2)}px`, top: `${f1(at[1] - box / 2)}px`, width: `${f1(box)}px`, height: `${f1(box)}px`, '--sz': `${f1(sz)}px` })
        out(sluices[i].lastElementChild as HTMLElement, st)
      }
      for (const [el, at] of [[names.dallas, L.rocks.dallas], [names.capital, L.rocks.capital]] as [HTMLElement, E4][]) {
        Object.assign(el.style, { left: `${f1(X(at[0]) - X(at[2]) * 0.42)}px`, top: `${f1(Y(at[1]) + Y(at[3]) * 0.04)}px`, width: `${f1(X(at[2]) * 0.84)}px`, fontSize: `${f1(clamp(W * 0.014, 15, 19))}px` })
      }
      const an = P(L.ausName)
      Object.assign(ausName.style, { left: `${f1(an[0] - 80)}px`, top: `${f1(an[1] - fs * 1.15)}px`, width: '160px', fontSize: `${f1(fs)}px` })
      const [cx, cy, side] = L.cut
      Object.assign(cutLab.style, { left: `${f1(X(cx))}px`, top: `${f1(Y(cy))}px`, translate: side ? '-100% 0' : '0 0', textAlign: side ? 'right' : 'left', maxWidth: wide ? 'none' : `${f1(W * 0.2)}px`, fontSize: `${f1(Math.max(14, fs - 1))}px` })
    }
    for (const [el, kids] of fresh) el.replaceChildren(...kids)
    Object.assign(limit.style, wide ? { left: `${f1(R.gut + 4)}px`, right: 'auto', top: '6px', width: `${f1(Math.min(380, W * 0.28))}px` } : { left: `${f1(R.gut + 2)}px`, right: 'auto', top: '2px', width: `${f1((W - R.gut * 2) * 0.62)}px` })
    flows.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    drawFlow(false)
  }

  /** The water: a pipe's water drawn in when both its ends are reached; curtains fall over the lips; pools fill. */
  function drawFlow(animate: boolean, only?: string) {
    if (!W) return
    const filled = new Set(ids.slice(0, step))
    const kids: SVGElement[] = []
    // water does not turn corners: a smooth curve through the channel's points
    const line = (pts: Pt[]) => {
      const q = pts.map(P)
      let d = `M${f1(q[0][0])} ${f1(q[0][1])}`
      for (let i = 1; i < q.length - 1; i++) d += `Q${f1(q[i][0])} ${f1(q[i][1])} ${f1((q[i][0] + q[i + 1][0]) / 2)} ${f1((q[i][1] + q[i + 1][1]) / 2)}`
      return d + `L${f1(q[q.length - 1][0])} ${f1(q[q.length - 1][1])}`
    }
    const anim: [SVGElement, number][] = []
    // a spring gushes from each cleft that is open
    for (const id of ['dallas', 'capital'] as const) {
      if (!filled.has(id)) continue
      const [x, y] = P(L.cleft[id])
      const g = s('g', { class: 'spring' }, s('ellipse', { cx: f1(x), cy: f1(y + 3), rx: f1(W * 0.012), ry: f1(W * 0.005) }), s('path', { d: `M${f1(x - 3)} ${f1(y + 2)}q3 -9 6 0`, class: 'gush' }))
      kids.push(g)
      if (animate && only === id && !still) anim.push([g, 0])
    }
    for (const [a, b] of K.edges) {
      if (!filled.has(a) || !filled.has(b)) continue
      const key = `${a}>${b}`
      const pipe = L.pipes[key] ?? L.rills[key]
      const thin = !!L.rills[key]
      if (pipe) {
        const d = line(pipe)
        const c = s('path', { class: `core${thin ? ' cut' : ''}`, d, pathLength: 1 })
        kids.push(c)
        if (animate && b === only) anim.push([c, 0])
      }
      const fall = L.falls[key]
      if (fall) {
        const f = curtain(fall, key === 'texas>austin' ? 0.8 : 1)
        kids.push(f)
        if (animate && b === only && !still) anim.push([f, 700])
      }
    }
    flows.replaceChildren(...kids)
    for (const [el, delay] of anim) {
      if (el.tagName === 'path') {
        el.style.strokeDasharray = '1'
        if (!still) el.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 1500, delay, easing: 'cubic-bezier(.3,.1,.2,1)', fill: 'backwards' })
      } else el.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 1100, delay, easing: 'cubic-bezier(.3,.1,.2,1)', fill: 'backwards' })
    }
    R.root.classList.toggle('tex-full', filled.has('texas'))
    R.root.classList.toggle('aus-full', filled.has('austin'))
  }

  /** A curtain of white water over a lip: the glassy bend at the notch, streaks widening down the face, foam and spray
   *  where it lands in the pond below (up the screen: it falls away from us, down the valley). */
  function curtain([lip, foot, fw]: [Pt, Pt, number], k: number) {
    const [x0, y0] = P(lip), [x1, y1] = P(foot)
    const w0 = X(fw) * 0.5, w1 = w0 * 1.18
    const id = nextId('t23s-fall')
    const grad = s('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1: f1(x0), y1: f1(y0), x2: f1(x1), y2: f1(y1) }, s('stop', { offset: 0, class: 'fs0' }), s('stop', { offset: 1, class: 'fs1' }))
    const spray = s('radialGradient', { id: `${id}-s` }, s('stop', { offset: 0, class: 'sp0' }), s('stop', { offset: 1, class: 'sp1' }))
    const r = rng(Math.round(x0 * 7 + y0))
    const streaks: SVGElement[] = []
    for (let i = 0; i < 6; i++) {
      const u = -0.8 + (i / 5) * 1.6 + (r() - 0.5) * 0.18
      const e = (r() - 0.5) * w0 * 0.25
      streaks.push(s('path', { class: 'streak', style: `opacity:${(0.45 + r() * 0.55).toFixed(2)}`, d: `M${f1(x0 + u * w0)} ${f1(y0)}C${f1(x0 + u * w0 + e)} ${f1(y0 + (y1 - y0) * 0.35)} ${f1(x1 + u * w1 - e)} ${f1(y0 + (y1 - y0) * 0.7)} ${f1(x1 + u * w1)} ${f1(y1 + (r() - 0.5) * 2)}` }))
    }
    // foam where it lands: a few broken bubbles in a soft cloud of spray
    const foam: SVGElement[] = []
    for (let i = 0; i < 7; i++) foam.push(s('ellipse', { class: 'foam', cx: f1(x1 + (r() - 0.5) * w1 * 2.4), cy: f1(y1 + (r() - 0.5) * w1 * 0.4), rx: f1(w1 * (0.15 + r() * 0.25)), ry: f1(Math.max(1, w1 * (0.06 + r() * 0.08))) }))
    return s('g', { class: 'fall', style: `--k:${k}` },
      s('defs', null, grad, spray),
      s('ellipse', { cx: f1(x1), cy: f1(y1 - w1 * 0.5), rx: f1(w1 * 2.8), ry: f1(w1 * 1.3), fill: `url(#${id}-s)` }),
      s('path', { class: 'sheet', d: `M${f1(x0 - w0)} ${f1(y0)}L${f1(x0 + w0)} ${f1(y0)}L${f1(x1 + w1)} ${f1(y1)}L${f1(x1 - w1)} ${f1(y1)}Z`, fill: `url(#${id})` }),
      ...streaks,
      s('ellipse', { class: 'bend', cx: f1(x0), cy: f1(y0 + 0.5), rx: f1(w0 * 1.02), ry: f1(Math.max(1.2, w0 * 0.12)) }),
      ...foam)
  }

  function sync() {
    sluices.forEach((b, i) => {
      const n = K.nodes[i]
      const isNext = i === step
      b.classList.toggle('next', isNext)
      b.classList.toggle('up', i < step)
      b.setAttribute('aria-disabled', String(!isNext))
      b.setAttribute('aria-label', isNext ? fill(K.stepAria, { label: label(i) }) : `${n.aria}${swapped && n.id !== 'dallas' && n.id !== 'capital' ? ` · ${label(i)}` : ''}`)
    })
  }
  function label(i: number) {
    return swapped && ids[i] === 'texas' ? K.swapTo : swapped && ids[i] === 'austin' ? K.swapResult : K.nodes[i].label
  }

  function go(i: number) {
    if (i !== step) return
    step++
    ctx.chime(step === ids.length ? 'ok' : 'tap')
    drawFlow(true, ids[i])
    sync()
    if (step === ids.length) {
      cal.disabled = false
      cal.classList.add('ready')
      ctx.insight(K.insight, K.detail)
    } else sluices[step].focus({ preventScroll: true })
  }

  // lift by dragging a sluice stone upward too
  for (const [i, b] of sluices.entries()) {
    let y0 = NaN
    b.addEventListener('pointerdown', (e) => void (y0 = e.clientY))
    b.addEventListener('pointermove', (e) => {
      if (Number.isNaN(y0) || y0 - e.clientY < 18) return
      y0 = NaN
      go(i)
    })
    b.addEventListener('pointerup', () => void (y0 = NaN))
  }

  cal.addEventListener('click', () => {
    swapped = !swapped
    R.root.classList.toggle('swapped', swapped)
    cal.setAttribute('aria-pressed', String(swapped))
    ;(weir.lastElementChild as HTMLElement).textContent = swapped ? K.swapTo : K.nodes[2].label
    ;(cal.lastElementChild as HTMLElement).textContent = swapped ? K.nodes[2].label : K.swapTo
    ausName.textContent = label(3)
    if (!still) for (const el of [weir, cal]) el.animate([{ transform: 'translateY(-14px)', opacity: 0.3 }, { transform: 'none', opacity: 1 }], { duration: 900, easing: 'cubic-bezier(.3,.1,.2,1)' })
    if (!still) ausName.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1200 })
    delete limit.dataset.off
    ctx.chime('soft')
    sync()
    const keep = step
    step = 0
    drawFlow(false)
    step = keep
    drawFlow(true, 'austin')
  })
}

/** A thin rill's bed: a wet dark groove finding its way down the terraces, a pale lip on the moon's side. */
function rill(g: CanvasRenderingContext2D, p: Pal, pts: Pt[]) {
  g.save()
  g.lineCap = 'round'
  g.lineJoin = 'round'
  const path = (dx: number, dy: number) => {
    g.beginPath()
    g.moveTo(pts[0][0] + dx, pts[0][1] + dy)
    for (let i = 1; i < pts.length - 1; i++) g.quadraticCurveTo(pts[i][0] + dx, pts[i][1] + dy, (pts[i][0] + pts[i + 1][0]) / 2 + dx, (pts[i][1] + pts[i + 1][1]) / 2 + dy)
    g.lineTo(pts[pts.length - 1][0] + dx, pts[pts.length - 1][1] + dy)
  }
  g.strokeStyle = rgba(p.umbra, p.dark ? 0.5 : 0.25)
  g.lineWidth = 4
  path(0, 0)
  g.stroke()
  g.strokeStyle = rgba(p.dark ? p.mid : p.card, p.dark ? 0.35 : 0.6)
  g.lineWidth = 1
  path(1.5, -1.5)
  g.stroke()
  g.restore()
}

/**
 * A kakehi: split bamboo along pts (screen px, near end first), on crossed posts, lit from the moon's side, a dark bore
 * along its open top for the water, nodes at intervals that shrink with distance. `w` is its width at the near end.
 */
function kakehi(g: CanvasRenderingContext2D, p: Pal, pts: Pt[], w: number, faint: boolean) {
  // resample along the polyline's smooth curve (the same quadratic the water follows)
  const curve: Pt[] = []
  const qp = (a: Pt, c: Pt, b: Pt, t: number): Pt => [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]]
  let start: Pt = pts[0]
  for (let i = 1; i < pts.length - 1; i++) {
    const end: Pt = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2]
    for (let k = 0; k < 12; k++) curve.push(qp(start, pts[i], end, k / 12))
    start = end
  }
  curve.push(start, pts[pts.length - 1])
  const n = curve.length
  const wid = (i: number) => w * lerp(1, 0.38, i / (n - 1))
  const bam: [RGB, RGB, RGB] = p.dark ? [mix(p.mossC, p.stepMid, 0.45), mix(p.mossA, p.mid, 0.35), mix(p.mossB, p.umbra, 0.45)] : [mix(p.mossC, p.stepHi, 0.4), mix(p.mossA, p.stepMid, 0.3), mix(p.mossB, p.wash, 0.3)]
  g.save()
  g.globalAlpha = faint ? 0.72 : 1
  g.lineCap = 'round'
  g.lineJoin = 'round'
  // posts: a short crossed pair under the pipe every so often, and the pipe's shadow on the ground
  let acc = 0
  for (let i = 1; i < n; i++) {
    const [x0, y0] = curve[i - 1], [x1, y1] = curve[i]
    const ww = wid(i)
    g.strokeStyle = rgba(p.umbra, p.dark ? 0.45 : 0.22)
    g.lineWidth = ww * 0.9
    g.beginPath()
    g.moveTo(x0 - ww * 0.5, y0 + ww * 1.6)
    g.lineTo(x1 - ww * 0.5, y1 + ww * 1.6)
    g.stroke()
    acc += Math.hypot(x1 - x0, y1 - y0)
    if (acc > ww * 9 && i < n - 2) {
      acc = 0
      g.strokeStyle = rgba(mix(bam[2], p.umbra, 0.3))
      g.lineWidth = Math.max(1.2, ww * 0.22)
      g.beginPath()
      g.moveTo(x1 - ww * 0.55, y1 - ww * 0.2)
      g.lineTo(x1 + ww * 0.45, y1 + ww * 1.7)
      g.moveTo(x1 + ww * 0.55, y1 - ww * 0.2)
      g.lineTo(x1 - ww * 0.45, y1 + ww * 1.7)
      g.stroke()
    }
  }
  // the body: shadow side, then the lit side toward the moon (up and right), then the bore
  for (let i = 1; i < n; i++) {
    const [x0, y0] = curve[i - 1], [x1, y1] = curve[i]
    const ww = wid(i)
    g.strokeStyle = rgba(bam[2])
    g.lineWidth = ww
    g.beginPath()
    g.moveTo(x0, y0)
    g.lineTo(x1, y1)
    g.stroke()
  }
  for (let i = 1; i < n; i++) {
    const [x0, y0] = curve[i - 1], [x1, y1] = curve[i]
    const ww = wid(i)
    g.strokeStyle = rgba(bam[1])
    g.lineWidth = ww * 0.62
    g.beginPath()
    g.moveTo(x0 + ww * 0.12, y0 - ww * 0.12)
    g.lineTo(x1 + ww * 0.12, y1 - ww * 0.12)
    g.stroke()
    g.strokeStyle = rgba(bam[0])
    g.lineWidth = Math.max(0.8, ww * 0.16)
    g.beginPath()
    g.moveTo(x0 + ww * 0.3, y0 - ww * 0.3)
    g.lineTo(x1 + ww * 0.3, y1 - ww * 0.3)
    g.stroke()
    g.strokeStyle = rgba(mix(bam[2], p.umbra, 0.5), 0.85)
    g.lineWidth = Math.max(0.8, ww * 0.26)
    g.beginPath()
    g.moveTo(x0, y0)
    g.lineTo(x1, y1)
    g.stroke()
  }
  // nodes: a dark ring and its lit lip across the pipe, spaced by its width
  acc = 0
  for (let i = 1; i < n; i++) {
    const [x0, y0] = curve[i - 1], [x1, y1] = curve[i]
    acc += Math.hypot(x1 - x0, y1 - y0)
    const ww = wid(i)
    if (acc < ww * 4.2) continue
    acc = 0
    const an = Math.atan2(y1 - y0, x1 - x0) + Math.PI / 2
    const dx = Math.cos(an) * ww * 0.55, dy = Math.sin(an) * ww * 0.55
    g.strokeStyle = rgba(mix(bam[2], p.umbra, 0.45))
    g.lineWidth = Math.max(1, ww * 0.18)
    g.beginPath()
    g.moveTo(x1 - dx, y1 - dy)
    g.lineTo(x1 + dx, y1 + dy)
    g.stroke()
    g.strokeStyle = rgba(bam[0], 0.9)
    g.lineWidth = Math.max(0.7, ww * 0.08)
    g.beginPath()
    g.moveTo(x1 - dx + ww * 0.12, y1 - dy - ww * 0.06)
    g.lineTo(x1 + dx + ww * 0.12, y1 + dy - ww * 0.06)
    g.stroke()
  }
  // the near end: the cut bamboo, its hollow
  const [ex, ey] = curve[0]
  g.fillStyle = rgba(mix(bam[2], p.umbra, 0.6))
  g.beginPath()
  g.ellipse(ex, ey, w * 0.5, w * 0.3, -0.6, 0, TAU)
  g.fill()
  g.strokeStyle = rgba(bam[0])
  g.lineWidth = Math.max(1, w * 0.1)
  g.stroke()
  g.restore()
}
