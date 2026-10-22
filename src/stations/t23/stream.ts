import { h, nextId, s } from '../../core/dom'
import type { SceneCtx } from '../types'
import { rng } from '../../ui/part2/ink'
import { guide, type Drop, type Mark } from '../../ui/part2/guide'
import { C } from './data'
import { canvas, clamp, f1, fbm, field, lerp, mix, put, rgba, rig, sm, softEllipse, stone, vn, type Pal, type Pt, type RGB, type Rig } from './lit'

const K = C.scenes.stream
const TAU = Math.PI * 2

/**
 * The hillside in metres: X runs downhill toward us, Y up, Z along the contour (left to right). Terrace k is a level strip
 * at height LV[k] between wall k-1 and wall k (their lines on the ground, X as a function of Z); wall k drops from LV[k]
 * to LV[k+1] and faces downhill, toward us, so its face, its moonlit lip and the water falling over it are all seen.
 * A camera across the valley looks up the slope a little from above. Water only ever goes down: over a wall, down its
 * face, into the terrace below.
 */
const LV: Record<number, number> = { [-3]: 4.5, [-2]: 3, [-1]: 1.5, 0: 0, 1: -1.5, 2: -3, 3: -4.5 }
/** a wall's line on the ground, X as a smooth function of Z through [Z, X] points (Catmull-Rom) */
function spline(pts: [number, number][]) {
  return (z: number) => {
    const n = pts.length
    if (z <= pts[0][0]) return pts[0][1]
    if (z >= pts[n - 1][0]) return pts[n - 1][1]
    let i = 0
    while (z > pts[i + 1][0]) i++
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)]
    const dz = p2[0] - p1[0], t = (z - p1[0]) / dz
    const m1 = ((p2[1] - p0[1]) / (p2[0] - p0[0] || 1)) * dz, m2 = ((p3[1] - p1[1]) / (p3[0] - p1[0] || 1)) * dz
    const t2 = t * t, t3 = t2 * t
    return (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2
  }
}

type Pond = { k: number; z0: number; z1: number; inL: [number, number]; inR: [number, number] }
type Cam = { X: number; Y: number; Z: number; pitch: number; f: number; cx: number; cy: number }
type Stone5 = [number, number, number, number, number]
type Lay = {
  cam: Cam
  /** each wall: [Z, X] points; lower walls bulge out round the pond they hold */
  walls: Record<number, [number, number][]>
  zEnd: Record<number, number>
  ponds: Record<'src' | 'tex' | 'aus', Pond>
  /** outlets: the wall, its Z, the width of the notch (m) */
  falls: Record<'dallas>texas' | 'texas>austin' | 'cal>austin', [number, number, number]>
  /** the rill: Z where it goes over walls 0 and 1, and how far past wall 1 it runs along the lowest terrace */
  rill: [number, number, number]
  /** stones on terraces: [terrace, X past the wall above (m), Z, width (m), height (m)] */
  basin: Stone5
  dallas: Stone5
  capital: Stone5
  ausName: Stone5
  cal: [number, number, number]
  rest: [number, number, number]
  /** the flume: from the capital rock over wall 0 into a stone cup on terrace 1 (at this Z), then over wall 1 into Austin */
  cupZ: number
  /** pines and clipped shrubs: [kind, terrace, X past the wall above, Z, size (m)] */
  flora: ['pine' | 'shrub', number, number, number, number][]
  moon: Pt
  /** the three other cascades on the far mountain: x share, top and bottom (shares of H, from the far ridge) */
  casc: [number, number, number][]
  far: number // where the far mountain stands (share of H)
}

const WALLS: Record<number, [number, number][]> = {
  [-4]: [[-16, -12], [24, -12]],
  [-3]: [[-16, -8.6], [-4, -8.2], [4, -8.8], [12, -8.4], [24, -8.0]],
  [-2]: [[-16, -5.2], [-6, -5.0], [2, -5.5], [8, -5.1], [14, -4.6], [24, -4.4]],
  [-1]: [[-16, -2.0], [-6, -1.6], [0, -2.0], [6, -1.7], [12, -1.2], [24, -0.8]],
  0: [[-16, 1.6], [-4, 1.8], [1, 2.0], [4, 2.5], [7, 2.6], [10, 2.2], [14, 1.8], [24, 1.6]],
  1: [[-16, 5.2], [-4, 5.3], [2, 5.4], [6, 5.9], [9, 6.3], [12, 6.2], [16, 5.6], [24, 5.3]],
  2: [[-16, 8.8], [-4, 8.9], [2, 9.0], [7, 9.3], [11, 10.0], [14, 10.3], [17, 9.9], [24, 9.2]],
  3: [[-16, 12.6], [0, 12.8], [10, 13.4], [18, 13.6], [26, 13.2]],
}
const WIDE: Lay = {
  cam: { X: 32, Y: 9.5, Z: 7, pitch: 18, f: 2.5, cx: 0.5, cy: 0.43 },
  walls: WALLS,
  zEnd: { [-3]: 10.5, [-2]: 12, [-1]: 13.5, 0: 15.5, 1: 18, 2: 21, 3: 23 },
  ponds: {
    src: { k: 0, z0: 1.4, z1: 10.2, inL: [2.0, 2.0], inR: [0.1, 0.1] },
    tex: { k: 1, z0: 4.4, z1: 12.2, inL: [0.08, 0.9], inR: [0.1, 0.1] },
    aus: { k: 2, z0: 8.9, z1: 16.4, inL: [0.1, 0.4], inR: [0.35, 0.5] },
  },
  falls: { 'dallas>texas': [0, 5.2, 0.6], 'texas>austin': [1, 11.3, 0.5], 'cal>austin': [1, 10.5, 0.5] },
  rill: [1.8, 1.9, 1.3],
  basin: [0, 0.9, -2.0, 6.0, 1.8],
  dallas: [0, 3.0, 6.2, 2.4, 1.2],
  capital: [0, 3.2, 11.4, 2.5, 1.25],
  ausName: [2, 4.0, 17.0, 2.3, 1.0],
  cal: [1, 2.2, 3.4],
  rest: [1, 0.3, 9.0],
  cupZ: 14.0,
  flora: [['shrub', 0, 0.5, 13.0, 1.5], ['shrub', 0, 0.4, -4.6, 1.3], ['shrub', 2, 0.7, -1.5, 1.4], ['shrub', 1, 0.4, 15.4, 1.2], ['shrub', -1, 0.6, 3.5, 1.3]],
  moon: [0.87, 0.13],
  casc: [[0.8, 0.1, 0.3], [0.88, 0.08, 0.34], [0.96, 0.12, 0.3]],
  far: 0.36,
}
const TALL: Lay = {
  cam: { X: 30, Y: 18, Z: 8.0, pitch: 32, f: 2.05, cx: 0.5, cy: 0.37 },
  walls: WALLS,
  zEnd: { [-3]: 9, [-2]: 10, [-1]: 11, 0: 12.8, 1: 14, 2: 15.5, 3: 16.5 },
  ponds: {
    src: { k: 0, z0: 5.4, z1: 10.6, inL: [2.0, 2.0], inR: [0.1, 0.1] },
    tex: { k: 1, z0: 5.8, z1: 10.9, inL: [0.08, 0.8], inR: [0.1, 0.1] },
    aus: { k: 2, z0: 7.0, z1: 12.1, inL: [0.1, 0.35], inR: [0.35, 0.45] },
  },
  falls: { 'dallas>texas': [0, 7.7, 0.5], 'texas>austin': [1, 9.7, 0.45], 'cal>austin': [1, 9.0, 0.45] },
  rill: [5.6, 5.0, 1.0],
  basin: [0, 0.5, 5.1, 5.6, 2.3],
  dallas: [0, 3.0, 9.0, 1.9, 0.95],
  capital: [0, 3.2, 11.4, 2.0, 1.0],
  ausName: [2, 4.1, 10.9, 2.0, 0.9],
  cal: [1, 2.2, 4.6],
  rest: [1, 0.25, 8.6],
  cupZ: 12.4,
  flora: [['shrub', 2, 0.6, 3.6, 1.1], ['shrub', 0, 0.4, 12.2, 1.1]],
  moon: [0.84, 0.07],
  casc: [[0.66, 0.05, 0.2], [0.8, 0.04, 0.22], [0.93, 0.06, 0.2]],
  far: 0.2,
}

/**
 * Scene 3 — a terraced cascade under the high moon, seen from across the valley: stone-walled ponds step down the hill
 * toward us. High on the left the question basin and the source pond; below its wall the middle pond "Texas" behind its
 * carved weir; lowest and nearest the pond "Austin" that holds the moon. Beat 1: tilt the bamboo trough at the basin —
 * the source pond fills, spills by the rock "Dallas" into the middle pond, runs through bamboo from the rock "capital"
 * terrace by terrace down to Austin, and a thin rill skips the middle pond; the middle pond fills and falls over its weir
 * into Austin. Beat 2 (audit v3 23-3, the main act): drag the "Texas" weir out of the wall and set "California" in the
 * gap: the water falls through the new notch, the last pond is carved again "Sacramento", mist thickens on the three
 * other cascades with the method's limit beside them, then the insight (after the evidence).
 */
export function streamScene(ctx: SceneCtx) {
  const still = ctx.quality === 'low' || ctx.reduced
  /** 0 dry · 1 the source spills (Dallas fall, the rill) · 2 the flume runs · 3 Texas full · 4 Texas → Austin, Austin full */
  let stage = 0
  let swapped = false
  let lifted = false
  let L: Lay = WIDE
  let W = 0, H = 0
  const wallFn: Record<number, (z: number) => number> = {}
  const wall = (k: number, z: number) => wallFn[k](z)
  let cam = { F: [0, 0], U: [0, 0], fH: 1 }
  /** world → screen [x, y, px per metre there] */
  const P = (X: number, Y: number, Z: number): [number, number, number] => {
    const c = L.cam
    const vx = X - c.X, vy = Y - c.Y
    const d = vx * cam.F[0] + vy * cam.F[1]
    const sc = cam.fH / d
    return [W * c.cx + sc * (Z - c.Z), H * c.cy - sc * (vx * cam.U[0] + vy * cam.U[1]), sc]
  }
  const xy = (X: number, Y: number, Z: number): Pt => { const q = P(X, Y, Z); return [q[0], q[1]] }
  /** a pond's two edges at z (X), or null outside it */
  const edges = (pd: Pond, z: number): [number, number] | null => {
    if (z < pd.z0 || z > pd.z1) return null
    const u = (z - pd.z0) / (pd.z1 - pd.z0)
    const l = wall(pd.k - 1, z) + lerp(pd.inL[0], pd.inL[1], u), r = wall(pd.k, z) - lerp(pd.inR[0], pd.inR[1], u)
    // rounded ends: the banks close in over the last metres
    const e = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u * 2 - 1), 4)), 1 / 3)
    const c = (l + r) / 2, hw = ((r - l) / 2) * e
    return [c - hw, c + hw]
  }
  const pondPath = (pd: Pond, y: number, n = 48): Pt[] => {
    const back: Pt[] = [], front: Pt[] = []
    for (let i = 0; i <= n; i++) {
      const z = pd.z0 + ((pd.z1 - pd.z0) * i) / n
      const e = edges(pd, z)!
      back.push(xy(e[0], y, z))
      front.push(xy(e[1], y, z))
    }
    return [...back, ...front.reverse()]
  }

  const R = rig(ctx, { cls: 't23s', art: K.art, copies: [K.insight], persp: 1000, swing: 0.03, bleed: true, build })
  const Lsky = R.layer(0, 't23s-sky')
  const Lland = R.layer(70, 't23s-land')
  const skyArt = h('div', { class: 't23-abs' })
  const fogs = [0, 1, 2].map((i) => h('i', { class: `t23s-fog f${i}` }))
  Lsky.append(skyArt, ...fogs)
  const landArt = h('div', { class: 't23-abs' })
  const pools = { src: h('div', { class: 't23s-pool src' }), tex: h('div', { class: 't23s-pool tex' }), aus: h('div', { class: 't23s-pool aus' }) }
  const flows = s('svg', { class: 't23s-flows', 'aria-hidden': 'true' })
  const rocksArt = h('div', { class: 't23-abs' })
  // the carved words sit on their stones, over the water's paths, so no channel ever runs through a name
  const weir = h('div', { class: 't23s-slab weir' }, h('span', { class: 't23-carve' }, K.nodes[2].label))
  const cal = h('button', { class: 't23s-slab cal', type: 'button', 'aria-label': K.swapAria, 'aria-pressed': 'false', disabled: true }, h('span', { class: 't23-carve' }, K.swapTo))
  const ausName = h('p', { class: 't23s-name t23-carve small' }, K.nodes[3].label)
  const cutLab = h('span', { class: 't23s-cut', 'aria-hidden': 'true' }, K.shortcut)
  const names = { dallas: h('p', { class: 't23s-name t23-carve' }, K.nodes[0].label), capital: h('p', { class: 't23s-name t23-carve' }, K.nodes[1].label) }
  const q = h('p', { class: 't23s-q t23-carve' }, K.question)
  // the bamboo trough at the basin's lip: tilt it (tap, drag down, Enter) and the question pours into the source pond
  // a split bamboo spout resting in the fork of a stand: its back end under the basin's lip, a peg to tilt it by, its
  // mouth cut on the slant over the pond. The svg turns about the fork (45% along).
  const handle = h('span', { class: 't23s-handle' })
  const bid = nextId('t23s-bam')
  const pour = h('button', { class: 't23s-pour', type: 'button', 'aria-label': K.pourAria }, s('svg', { viewBox: '-60 -26 120 44', 'aria-hidden': 'true' },
    s('defs', null, s('linearGradient', { id: bid, x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, class: 'b0' }), s('stop', { offset: 0.35, class: 'b1' }), s('stop', { offset: 1, class: 'b2' }))),
    s('path', { class: 'peg', d: 'M-49 -6L-50 -21' }),
    s('ellipse', { class: 'pegtop', cx: -50, cy: -21.5, rx: 3, ry: 1.8 }),
    s('path', { class: 'tube', fill: `url(#${bid})`, d: 'M-55 -9L47 -9L58 0L50 9L-55 9Q-60 9 -60 0Q-60 -9 -55 -9Z' }),
    s('path', { class: 'bore', d: 'M-56 -4L52 -4' }),
    s('path', { class: 'node', d: 'M-30 -9.5v19M-1 -9.5v19M27 -9.5v19' }),
    s('path', { class: 'lit', d: 'M-54 -7.4L46 -7.4' }),
    s('ellipse', { class: 'mouth', cx: 53.5, cy: -0.5, rx: 3, ry: 8, transform: 'rotate(30 53.5 -0.5)' }),
    s('path', { class: 'water', d: 'M-50 -4L54 -4', pathLength: 1 }),
    s('path', { class: 'spill', d: 'M57 0q8 2 10 16', pathLength: 1 })), handle)
  Lland.append(landArt, pools.src, pools.tex, pools.aus, rocksArt, flows, names.dallas, names.capital, ausName, cutLab, q, weir, cal, pour)
  // what the water stands for, from the start; the method's limit shows by the three misty cascades after the swap
  const decode = h('p', { class: 't23-note t23s-decode' }, K.decode)
  const limit = h('div', { class: 't23s-lim', 'data-off': '' }, ctx.fact(K.limit, 'p', 't23-note'))
  R.root.append(decode, limit)
  ctx.prompt(K.prompt)
  const gd = guide(ctx)
  let mark: Mark | null = gd.dot(handle, { dir: [0, 1] })
  let hole: Drop | null = null
  let home: Pt = [0, 0]

  function* build(R: Rig, first: boolean): Generator<unknown, void> {
    W = R.W
    H = R.H
    const p = R.pal
    const wide = W / H > 1.1
    L = wide ? WIDE : TALL
    for (const [k, pts] of Object.entries(L.walls)) wallFn[+k] = spline(pts)
    {
      const ph = (L.cam.pitch * Math.PI) / 180
      cam = { F: [-Math.cos(ph), -Math.sin(ph)], U: [-Math.sin(ph), Math.cos(ph)], fH: L.cam.f * H }
    }
    const fresh: [HTMLElement, Node[]][] = []
    const out = (el: HTMLElement, ...kids: Node[]) => (first ? el.replaceChildren(...kids) : fresh.push([el, kids]))
    const tone: [RGB, RGB, RGB, RGB] = p.dark ? [p.hi, p.mid, p.lo, p.umbra] : [mix(p.hi, p.mid, 0.4), mix(p.mid, p.lo, 0.3), mix(p.lo, p.umbra, 0.1), mix(p.umbra, p.lo, 0.25)]
    const mt: [RGB, RGB, RGB] = p.dark ? [mix(p.mossC, p.mid, 0.3), mix(p.mossA, p.lo, 0.3), mix(p.mossB, p.umbra, 0.3)] : [mix(p.mossC, p.paper, 0.25), mix(p.mossA, p.mid, 0.3), mix(p.mossB, p.lo, 0.3)]
    const sOpts = { tone, mossTone: mt, rim: p.dark ? p.moon : p.wash, rimA: p.dark ? 0.62 : 0.4, up: 'y' as const, inkA: 0.55, grain: 0.05, amb: 0.16, dry: 0.25 }
    // the valley's haze: farther up the hill (fewer px per metre) = paler and bluer
    const hazeC: RGB = p.dark ? mix(p.paper, p.mist, 0.22) : mix(p.paper, p.card, 0.35)
    const s0 = P(wall(0, L.cam.Z), LV[0], L.cam.Z)[2]
    const hz = (c: RGB, sc: number) => mix(c, hazeC, clamp((0.95 - sc / s0) * 1.6, 0, 0.75))
    const sample = (zA: number, zB: number, n: number) => Array.from({ length: n + 1 }, (_, i) => zA + ((zB - zA) * i) / n)
    const zL = L.cam.Z - (W / 2 / s0) * 1.6 // beyond the frame's left edge

    // ── the sky over the hill's shoulder: the high small moon, the far mountain with three other cascades, mist
    {
      const c = canvas(W, H, R.dpr)
      const g = c.g
      const sky = g.createLinearGradient(0, 0, 0, H * 0.7)
      sky.addColorStop(0, rgba(p.dark ? mix(p.paper, p.wash, 0.2) : p.paper, 0))
      sky.addColorStop(0.5, rgba(p.dark ? mix(p.paper, p.mist, 0.1) : mix(p.paper, p.card, 0.5), 0.8))
      sky.addColorStop(1, rgba(p.dark ? mix(p.paper, p.mist, 0.2) : p.card, 1))
      g.fillStyle = sky
      g.fillRect(0, 0, W, H)
      const [mx, my] = [W * L.moon[0], H * L.moon[1]]
      const mr = Math.max(9, Math.min(W, H) * 0.026)
      const mg = g.createRadialGradient(mx, my, 0, mx, my, mr * 9)
      mg.addColorStop(0, rgba(p.moon, p.dark ? 0.42 : 0.6))
      mg.addColorStop(0.3, rgba(p.moon, p.dark ? 0.12 : 0.2))
      mg.addColorStop(1, rgba(p.moon, 0))
      g.fillStyle = mg
      g.fillRect(mx - mr * 9, my - mr * 9, mr * 18, mr * 18)
      g.fillStyle = rgba(p.moon)
      g.beginPath()
      g.arc(mx, my, mr, 0, TAU)
      g.fill()
      const ridge = (base: number, amp: number, seed: number, col: RGB, a: number) => {
        g.fillStyle = rgba(col, a)
        g.beginPath()
        g.moveTo(0, H)
        for (let x = 0; x <= W + 6; x += 5) g.lineTo(x, base - amp * (0.25 + 0.75 * fbm(x * 0.0045 + seed, seed, 4)) * (0.5 + 0.5 * Math.sin((x / W) * 2.6 + seed)))
        g.lineTo(W, H)
        g.closePath()
        g.fill()
      }
      ridge(H * L.far, H * 0.16, 5, p.dark ? mix(p.wash, p.mist, 0.16) : mix(p.wash, p.paper, 0.8), 0.95)
      // across the valley on the right a nearer hill, its skyline caught by the moon; down its face the other three
      // cascades fall in steps from notches in that skyline and pool in their own mist (water on rock, not in the air)
      const r = rng(2360)
      const hx0 = W * (wide ? 0.72 : 0.5)
      const hillTop = (x: number) => H * (L.far - 0.02) - H * (wide ? 0.09 : 0.06) * sm(hx0, W, x) * (0.75 + 0.25 * fbm(x * 0.01, 7, 3)) - H * 0.015 * Math.sin(x * 0.02)
      {
        const hc: RGB = p.dark ? mix(p.wash, p.mist, 0.05) : mix(p.wash, p.paper, 0.58)
        const hg = g.createLinearGradient(0, H * (L.far - 0.12), 0, H * (L.far + 0.16))
        hg.addColorStop(0, rgba(hc, 1))
        hg.addColorStop(0.6, rgba(hc, 0.9))
        hg.addColorStop(1, rgba(hc, 0))
        g.fillStyle = hg
        g.beginPath()
        g.moveTo(hx0 - W * 0.06, H * (L.far + 0.2))
        for (let x = hx0 - W * 0.06; x <= W + 6; x += 4) g.lineTo(x, hillTop(x) + H * 0.02 * (1 - sm(hx0 - W * 0.06, hx0, x)))
        g.lineTo(W + 6, H * (L.far + 0.2))
        g.closePath()
        g.fill()
        // the moon behind it lights its skyline: a soft pale band just under the edge, fading in from the left
        for (const [wd, al] of [[5, 0.06], [2, 0.14]] as [number, number][]) {
          for (let x = hx0; x < W + 6; x += 4) {
            g.strokeStyle = rgba(p.dark ? p.moon : p.card, (p.dark ? al : al * 3) * sm(hx0, hx0 + W * 0.08, x))
            g.lineWidth = wd
            g.beginPath()
            g.moveTo(x, hillTop(x) + wd * 0.4)
            g.lineTo(x + 4, hillTop(x + 4) + wd * 0.4)
            g.stroke()
          }
        }
      }
      for (const [cx0, , len] of L.casc) {
        const x = Math.max(hx0 + W * 0.03, W * cx0)
        const y0 = hillTop(x) + 1, y1 = y0 + H * len * 0.45
        const fw = Math.max(2.2, W * 0.0024)
        // the notch it has worn in the skyline, and the dark ravine below it
        g.fillStyle = rgba(p.dark ? mix(p.wash, p.umbra, 0.4) : mix(p.wash, p.paper, 0.5), 0.9)
        g.beginPath()
        g.moveTo(x - fw * 3, y0 - 1)
        g.lineTo(x, y0 + fw * 2)
        g.lineTo(x + fw * 3, y0 - 1)
        g.closePath()
        g.fill()
        softEllipse(g, x, lerp(y0, y1, 0.55), fw * 4, (y1 - y0) * 0.55, p.dark ? mix(p.wash, p.umbra, 0.3) : mix(p.wash, p.paper, 0.55), p.dark ? 0.45 : 0.35)
        // the fall: one ribbon kinking over two ledges, a wide faint body and a bright core, foam where it strikes
        const pts: Pt[] = [[x, y0]]
        for (let d = 1; d <= 3; d++) pts.push([x + (r() - 0.5) * fw * 2.4, lerp(y0, y1, d / 3)])
        const path = () => {
          g.beginPath()
          g.moveTo(pts[0][0], pts[0][1])
          for (let i = 1; i < pts.length; i++) g.quadraticCurveTo(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * 0.1, (pts[i - 1][1] + pts[i][1]) / 2, pts[i][0], pts[i][1])
        }
        g.lineCap = 'round'
        g.strokeStyle = rgba(p.dark ? mix(p.moon, p.mist, 0.4) : p.card, p.dark ? 0.16 : 0.45)
        g.lineWidth = fw * 2.4
        path()
        g.stroke()
        const fg = g.createLinearGradient(0, y0, 0, y1)
        fg.addColorStop(0, rgba(p.dark ? p.moon : p.card, p.dark ? 0.6 : 0.95))
        fg.addColorStop(1, rgba(p.dark ? mix(p.moon, p.mist, 0.4) : p.card, p.dark ? 0.2 : 0.6))
        g.strokeStyle = fg
        g.lineWidth = fw * 0.6
        path()
        g.stroke()
        for (let i = 1; i < pts.length; i++) softEllipse(g, pts[i][0], pts[i][1], fw * (3 + i * 1.5), fw * 1.3, p.dark ? p.moon : p.card, p.dark ? 0.18 : 0.5)
        softEllipse(g, x, y1 + H * 0.01, fw * 14, fw * 4, p.dark ? p.mist : p.card, p.dark ? 0.16 : 0.6)
      }
      ridge(H * (L.far + 0.1), H * 0.08, 11, p.dark ? mix(p.wash, p.mist, 0.09) : mix(p.wash, p.paper, 0.68), 0.97)
      const mist = g.createLinearGradient(0, H * L.far, 0, H)
      mist.addColorStop(0, rgba(p.mist, 0))
      mist.addColorStop(0.3, rgba(p.mist, p.dark ? 0.2 : 0.6))
      mist.addColorStop(1, rgba(p.dark ? mix(p.paper, p.mist, 0.18) : p.mist, p.dark ? 0.4 : 0.7))
      g.fillStyle = mist
      g.fillRect(0, H * L.far, W, H * (1 - L.far))
      out(skyArt, c.c)
      fogs.forEach((f, i) => {
        const [cx, y0, y1] = L.casc[i]
        void y0
        void y1
        const fx = Math.max(hx0 + W * 0.03, W * cx)
        Object.assign(f.style, { left: `${f1(fx - W * 0.06)}px`, top: `${f1(hillTop(fx) - H * 0.01)}px`, width: `${f1(W * 0.12)}px`, height: `${f1(H * 0.16)}px` })
      })
      yield
    }

    // ── the hillside, from the top down (each nearer terrace covers the one above): the wooded crest, then each terrace's
    //    tread (moss on stone) and its wall (dressed stones near the water, the lip silver in the moon)
    const land = canvas(W, H, R.dpr)
    const g = land.g
    {
      // the crest: a slope from the highest terrace up to a line of pines, ending down the hill's shoulder on the right
      const zs = sample(zL, L.zEnd[-3] + 1.5, 60)
      const foot = zs.map((z) => xy(wall(-4, z) + 0.4, LV[-3], z))
      const top = zs.map((z) => xy(wall(-4, z) - 3, LV[-3] + 3.8 - sm(L.zEnd[-3] - 6, L.zEnd[-3] + 1.5, z) * 3.6, z))
      poly(g, [...foot, ...top.slice().reverse()])
      const a = foot[10], b = top[10]
      const sg = g.createLinearGradient(a[0], a[1], b[0], b[1])
      sg.addColorStop(0, rgba(hz(p.dark ? mix(p.lo, p.mossB, 0.45) : mix(p.mid, p.mossB, 0.3), 0.6 * s0)))
      sg.addColorStop(1, rgba(p.dark ? mix(p.wash, p.mossB, 0.3) : mix(p.wash, p.paper, 0.62), 0.95))
      g.fillStyle = sg
      g.fill()
      const r = rng(2365)
      for (let i = 0; i < 18; i++) {
        const z = lerp(zL + 1, L.zEnd[-3] - 1, i / 17 + (r() - 0.5) * 0.03)
        const rise = 1 - sm(L.zEnd[-3] - 6, L.zEnd[-3] + 1.5, z)
        const [x, y, sc] = P(wall(-4, z) - 2.6 - r() * 0.5, LV[-3] + 3.3 * rise + 0.3, z)
        pine(g, p, x, y, sc * (2.6 + r() * 2.2), hz(p.dark ? mix(p.umbra, p.mossB, 0.3) : mix(p.wash, p.mossB, 0.35), sc))
      }
      yield
    }
    const pondKeys = Object.keys(L.ponds) as (keyof Lay['ponds'])[]
    for (const k of [-3, -2, -1, 0, 1, 2, 3]) {
      const zE = L.zEnd[k]
      const zs = sample(zL, zE, 100)
      const back = zs.map((z) => xy(wall(k - 1, z), LV[k], z)), lip = zs.map((z) => xy(wall(k, z), LV[k], z))
      const tread: Pt[] = [...back, ...lip.slice().reverse()]
      const base = p.dark ? mix(mix(p.lo, p.mid, 0.3), p.mossA, 0.42) : mix(p.mid, p.mossB, 0.28)
      const sc = P(wall(k, L.cam.Z), LV[k], L.cam.Z)[2]
      const tg = g.createLinearGradient(back[50][0], back[50][1], lip[50][0], lip[50][1])
      tg.addColorStop(0, rgba(hz(p.dark ? mix(base, p.umbra, 0.35) : mix(base, p.lo, 0.25), sc)))
      tg.addColorStop(1, rgba(hz(base, sc)))
      poly(g, tread)
      g.fillStyle = tg
      g.fill()
      if (k < 0 || k > 2) {
        // terraces off the water's way sit back in the mist
        g.fillStyle = rgba(hazeC, p.dark ? 0.3 : 0.4)
        g.fill()
      }
      // moss and stone along the terrace: soft streaks along the contour; the shade at the foot of the wall above
      g.save()
      poly(g, tread)
      g.clip()
      const r = rng(2370 + k)
      g.lineCap = 'round'
      for (let i = 0; i < 26; i++) {
        const u = 0.15 + r() * 0.8
        const zA = lerp(zL, zE, r()), zB = zA + 1.5 + r() * 4
        const a = P(lerp(wall(k - 1, zA), wall(k, zA), u), LV[k], zA), b = P(lerp(wall(k - 1, zB), wall(k, zB), u), LV[k], zB)
        const lit = r() < 0.5
        g.strokeStyle = rgba(lit ? (p.dark ? mix(p.mossC, p.mid, 0.5) : mix(p.mossC, p.hi, 0.5)) : p.dark ? p.umbra : p.lo, (p.dark ? 0.26 : 0.2) * (k < 0 ? 0.6 : 1))
        g.lineWidth = Math.max(0.8, a[2] * 0.12 * (0.4 + r()))
        g.beginPath()
        g.moveTo(a[0], a[1])
        g.lineTo(b[0], b[1])
        g.stroke()
      }
      g.strokeStyle = rgba(p.umbra, p.dark ? 0.5 : 0.25)
      g.lineWidth = Math.max(3, sc * 0.35)
      line(g, back)
      g.stroke()
      g.restore()
      // the dry beds of the ponds on this terrace: a wet dark hollow with pebbles (the water fills it later)
      for (const key of pondKeys) {
        const pd = L.ponds[key]
        if (pd.k !== k) continue
        const path = pondPath(pd, LV[k])
        poly(g, path)
        g.fillStyle = rgba(p.dark ? mix(p.umbra, p.lo, 0.4) : mix(p.lo, p.wash, 0.22), p.dark ? 0.9 : 0.6)
        g.fill()
        g.save()
        poly(g, path)
        g.clip()
        const rp = rng(2390 + k)
        for (let i = 0; i < 34; i++) {
          const z = lerp(pd.z0, pd.z1, rp())
          const e = edges(pd, z)
          if (!e) continue
          const [x, y, s1] = P(lerp(e[0], e[1], rp()), LV[k], z)
          g.fillStyle = rgba(p.dark ? p.lo : p.mid, 0.55)
          g.beginPath()
          g.ellipse(x, y, s1 * 0.12, s1 * 0.05, 0, 0, TAU)
          g.fill()
        }
        // the bank's inner slope on the far side, lit a little by the moon
        g.strokeStyle = rgba(p.dark ? mix(p.mid, p.moon, 0.15) : mix(p.hi, p.card, 0.3), p.dark ? 0.22 : 0.35)
        g.lineWidth = Math.max(1, sc * 0.06)
        line(g, path.slice(0, 49))
        g.stroke()
        g.restore()
      }
      // the wall below this terrace's lip (the lowest one: a slope down into the valley's mist)
      const yF = k === 3 ? LV[3] - 4 : LV[k + 1]
      const dx = k === 3 ? 2.5 : 0
      const foot = zs.map((z) => xy(wall(k, z) + dx, yF, z))
      poly(g, [...lip, ...foot.slice().reverse()])
      const fc = p.dark ? mix(p.lo, p.umbra, 0.25) : mix(p.lo, p.wash, 0.12)
      const fg = g.createLinearGradient(lip[50][0], lip[50][1], foot[50][0], foot[50][1])
      fg.addColorStop(0, rgba(hz(fc, sc)))
      fg.addColorStop(1, k === 3 ? rgba(hazeC, 0) : rgba(hz(p.dark ? p.umbra : mix(p.lo, p.umbra, 0.35), sc)))
      g.fillStyle = fg
      g.fill()
      if (k >= 0 && k < 3) yield* masonry(g, p, k, zs, P, (z) => wall(k, z), hz)
      // the lip: dressed stone edged in moonlight where it holds a pond, dimmer elsewhere; it fades at the far end
      g.lineCap = 'round'
      const held = (z: number) => pondKeys.some((key) => L.ponds[key].k === k && z > L.ponds[key].z0 - 0.6 && z < L.ponds[key].z1 + 0.6)
      for (let i = 1; i < zs.length; i++) {
        const za = zs[i - 1], zb = zs[i]
        const a = P(wall(k, za), LV[k], za), b = P(wall(k, zb), LV[k], zb)
        const fade = 1 - sm(zE - 3, zE, zb)
        const on = k >= 0 && k < 3 && held(zb)
        g.strokeStyle = rgba(p.umbra, (p.dark ? 0.7 : 0.35) * fade)
        g.lineWidth = Math.max(1, a[2] * 0.1)
        g.beginPath()
        g.moveTo(a[0], a[1] + a[2] * 0.08)
        g.lineTo(b[0], b[1] + b[2] * 0.08)
        g.stroke()
        const lit = (p.dark ? 0.92 : 0.85) * fade * (on ? 1 : k < 0 || k > 2 ? 0.3 : 0.5) * (0.6 + 0.4 * sm(0.3, 0.6, vn(zb * 1.6, k * 3.1)))
        g.strokeStyle = rgba(p.dark ? p.moon : p.ink, lit)
        g.lineWidth = Math.max(0.8, a[2] * (on ? 0.055 : 0.035))
        g.beginPath()
        g.moveTo(a[0], a[1])
        g.lineTo(b[0], b[1])
        g.stroke()
      }
      // the terrace runs out round the hill's shoulder: its far end melts into the valley's mist behind it
      {
        const zf = zE - (k < 0 ? 5 : 3.5)
        const ea = xy(wall(k, zf), LV[k], zf), eb = xy(wall(k, zE), LV[k], zE)
        g.save()
        g.beginPath()
        const sub = (pts: Pt[]) => pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
        sub([...back, ...lip.slice().reverse()])
        g.closePath()
        sub([...lip, ...foot.slice().reverse()])
        g.closePath()
        g.clip()
        g.globalCompositeOperation = 'destination-out'
        const eg = g.createLinearGradient(ea[0], 0, eb[0], 0)
        eg.addColorStop(0, '#0000')
        eg.addColorStop(1, '#000')
        g.fillStyle = eg
        g.fillRect(ea[0], 0, W - ea[0] + 10, H)
        g.restore()
      }
      // grass hanging over the lip here and there: a few dry strokes
      const rm = rng(2375 + k)
      for (let i = 0; i < 46; i++) {
        const z = lerp(zL + 1, zE - 2, rm())
        const [x, y, s1] = P(wall(k, z), LV[k], z)
        const l = s1 * 0.22 * (0.5 + rm())
        g.strokeStyle = rgba(hz(p.dark ? mix(p.mossA, p.lo, 0.2) : mix(p.mossB, p.mid, 0.2), s1), (p.dark ? 0.65 : 0.55) * (k < 0 || k > 2 ? 0.5 : 1))
        g.lineWidth = Math.max(0.6, s1 * 0.025)
        g.beginPath()
        g.moveTo(x, y)
        g.quadraticCurveTo(x + l * 0.35, y + l * 0.15, x + l * (rm() - 0.3) * 0.6, y + l)
        g.stroke()
      }
      yield
    }
    // the eye stays on the cascade: away from the water's way the hillside dissolves into the valley's mist; where the
    // veil is thin, a mottle of moss and stone
    {
      const ctr = (pd: Pond, u: number): Pt => { const z = lerp(pd.z0, pd.z1, u); const e = edges(pd, z)!; return xy((e[0] + e[1]) / 2, LV[pd.k], z) }
      const [bk, bdx, bz] = L.basin
      const way: Pt[] = [xy(wall(bk - 1, bz) + bdx, LV[bk], bz), ctr(L.ponds.src, 0.3), ctr(L.ponds.src, 0.8), ctr(L.ponds.tex, 0.4), ctr(L.ponds.tex, 0.9), ctr(L.ponds.aus, 0.5), ctr(L.ponds.aus, 0.95)]
      const dist = (x: number, y: number) => {
        let d = 1e9
        for (let i = 1; i < way.length; i++) {
          const [ax, ay] = way[i - 1], [bx, by] = way[i]
          const vx = bx - ax, vy = by - ay
          const t = clamp(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy || 1), 0, 1)
          d = Math.min(d, Math.hypot(x - ax - vx * t, y - ay - vy * t))
        }
        return d
      }
      const vc: RGB = p.dark ? mix(p.paper, p.mist, 0.16) : mix(p.mist, p.paper, 0.3)
      const k0 = Math.min(W, H * 1.8)
      const veil = yield* field(W, H, 8, (x, y, o) => {
        const d = dist(x, y) / k0
        const n = fbm(x * 0.006, y * 0.01 + 4, 3)
        const m = fbm(x * 0.012 + 9, y * 0.02, 3) - 0.5
        const a = sm(0.07, 0.3, d + (n - 0.5) * 0.12) * (p.dark ? 0.82 : 0.9)
        const c = m > 0 ? (p.dark ? mix(p.mossA, p.mid, 0.5) : mix(p.mossC, p.hi, 0.5)) : p.umbra
        const am = Math.abs(m) * (p.dark ? 0.4 : 0.3) * (1 - a)
        const t = a / (a + am || 1)
        o[0] = c[0] + (vc[0] - c[0]) * t; o[1] = c[1] + (vc[1] - c[1]) * t; o[2] = c[2] + (vc[2] - c[2]) * t
        o[3] = Math.min(1, a + am)
      })
      g.save()
      g.globalCompositeOperation = 'source-atop'
      put(g, veil, 0, 0, W, H)
      g.restore()
      yield
    }
    // the high moon from the upper right washes the near side of the cascade: a broad soft light over the land
    {
      const [mx, my] = [W * L.moon[0], H * L.moon[1]]
      const mg = g.createRadialGradient(mx, my, 0, mx, my, Math.hypot(W, H) * 0.75)
      mg.addColorStop(0, rgba(p.moon, p.dark ? 0.16 : 0.12))
      mg.addColorStop(0.5, rgba(p.moon, p.dark ? 0.07 : 0.05))
      mg.addColorStop(1, rgba(p.moon, 0))
      g.save()
      g.globalCompositeOperation = 'source-atop'
      g.fillStyle = mg
      g.fillRect(0, 0, W, H)
      g.restore()
    }
    // the top of the hill goes up into the night mist: a pale band over the highest terraces, the shape of a far peak in it
    {
      const mc: RGB = p.dark ? mix(p.paper, p.mist, 0.24) : mix(p.mist, p.paper, 0.2)
      const band = H * 0.3
      const vg = g.createLinearGradient(0, 0, 0, band)
      vg.addColorStop(0, rgba(mc, p.dark ? 0.9 : 0.95))
      vg.addColorStop(0.55, rgba(mc, p.dark ? 0.45 : 0.6))
      vg.addColorStop(1, rgba(mc, 0))
      g.save()
      g.globalCompositeOperation = 'source-atop'
      g.fillStyle = vg
      g.fillRect(0, 0, W, band)
      // a far peak and its shoulder half lost in that mist (ink wash, no edge on its foot)
      const pk = p.dark ? mix(p.wash, p.mist, 0.12) : mix(p.wash, p.paper, 0.62)
      const pg = g.createLinearGradient(0, H * 0.02, 0, band * 0.85)
      pg.addColorStop(0, rgba(pk, p.dark ? 0.75 : 0.55))
      pg.addColorStop(1, rgba(pk, 0))
      g.fillStyle = pg
      g.beginPath()
      g.moveTo(-10, band)
      for (let x = -10; x <= W * 0.62; x += 6) {
        const u = x / (W * 0.62)
        const h0 = H * (0.2 - 0.16 * Math.sin(Math.PI * Math.min(1, u * 1.3)) * (0.75 + 0.25 * fbm(x * 0.006, 2, 3)))
        g.lineTo(x, h0)
      }
      g.lineTo(W * 0.62, band)
      g.closePath()
      g.fill()
      g.restore()
    }
    // thin wisps of mist lying along the walls (the falls' spray and the valley's night air)
    {
      const r = rng(2367)
      for (const k of [-1, 0, 1, 2]) {
        for (let i = 0; i < 3; i++) {
          const z = lerp(zL + 3, L.zEnd[k] - 2, (i + 0.3 + r() * 0.4) / 3)
          const [x, y, sc] = P(wall(k, z), lerp(LV[k], LV[k + 1], 0.6), z)
          softEllipse(g, x, y, sc * (3 + r() * 3), sc * 0.28, p.dark ? mix(p.paper, p.mist, 0.35) : p.mist, p.dark ? 0.14 : 0.45)
        }
      }
      yield
    }
    groove(g, p, rillPts(true))
    out(landArt, land.c)
    yield

    // ── the water of each pond: drawn now, shown when it fills (the dry bed shows until then)
    const water = (key: keyof Lay['ponds'], moon: number) => {
      const pd = L.ponds[key]
      const path = pondPath(pd, LV[pd.k] - 0.06)
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
      for (const [x, y] of path) (x0 = Math.min(x0, x)), (y0 = Math.min(y0, y)), (x1 = Math.max(x1, x)), (y1 = Math.max(y1, y))
      x0 -= 4; y0 -= 4; x1 += 4; y1 += 4
      const c = canvas(x1 - x0, y1 - y0, R.dpr)
      const wg = c.g
      wg.translate(-x0, -y0)
      wg.save()
      poly(wg, path)
      wg.clip()
      // the sky held in the water: brightest under the far bank (it mirrors the sky above the hill), darker toward us
      const gr = wg.createLinearGradient(0, y0, 0, y1)
      gr.addColorStop(0, rgba(p.dark ? mix(p.paper, p.mist, 0.5) : mix(p.water, p.card, 0.62)))
      gr.addColorStop(0.55, rgba(p.dark ? mix(p.paper, p.mist, 0.26) : mix(p.water, p.card, 0.22)))
      gr.addColorStop(1, rgba(p.dark ? mix(p.paper, p.mist, 0.1) : mix(p.water, p.wash, 0.18)))
      wg.fillStyle = gr
      wg.fillRect(x0, y0, x1 - x0, y1 - y0)
      // the dark mirror of the wall above along the far bank, broken by ripples
      const sc = P(wall(pd.k, (pd.z0 + pd.z1) / 2), LV[pd.k], (pd.z0 + pd.z1) / 2)[2]
      wg.strokeStyle = rgba(p.dark ? mix(p.umbra, p.lo, 0.3) : mix(p.lo, p.wash, 0.3), p.dark ? 0.6 : 0.4)
      wg.lineWidth = Math.max(3, sc * 0.5)
      line(wg, path.slice(0, 49))
      wg.stroke()
      const r = rng(2400 + pd.k)
      wg.lineCap = 'round'
      for (let i = 0; i < 26; i++) {
        const z = lerp(pd.z0 + 0.5, pd.z1 - 0.5, r())
        const e = edges(pd, z)
        if (!e) continue
        const [x, y, s1] = P(lerp(e[0], e[1], 0.25 + r() * 0.7), LV[pd.k], z)
        const len = s1 * (0.4 + r() * 1.2)
        wg.strokeStyle = rgba(p.dark ? p.mist : p.card, (p.dark ? 0.24 : 0.55) * (0.4 + r() * 0.6))
        wg.lineWidth = Math.max(0.6, s1 * 0.03)
        wg.beginPath()
        wg.moveTo(x - len / 2, y)
        wg.lineTo(x + len / 2, y)
        wg.stroke()
      }
      if (moon > 0) {
        // the high moon in the water, under the far bank: a soft glow, a bright broken oval, glints
        const zm = lerp(pd.z0, pd.z1, 0.66)
        const e = edges(pd, zm)!
        const [mx, my, s1] = P(lerp(e[0], e[1], 0.3), LV[pd.k], zm)
        const rr = s1 * 0.75
        const mg = wg.createRadialGradient(mx, my, 0, mx, my, rr * 3)
        mg.addColorStop(0, rgba(p.moon, (p.dark ? 0.55 : 0.75) * moon))
        mg.addColorStop(0.35, rgba(p.moon, 0.18 * moon))
        mg.addColorStop(1, rgba(p.moon, 0))
        wg.fillStyle = mg
        wg.fillRect(mx - rr * 3, my - rr * 3, rr * 6, rr * 6)
        // the disc itself: a soft bright oval, two ripples cut through it, glints scattered round it
        const dg = wg.createRadialGradient(mx, my, 0, mx, my, rr * 0.85)
        dg.addColorStop(0, rgba(p.dark ? p.moon : p.card, 0.98 * moon))
        dg.addColorStop(0.7, rgba(p.dark ? p.moon : p.card, 0.85 * moon))
        dg.addColorStop(1, rgba(p.dark ? p.moon : p.card, 0))
        wg.fillStyle = dg
        wg.save()
        wg.translate(mx, my)
        wg.scale(1, 0.36)
        wg.beginPath()
        wg.arc(0, 0, rr * 0.85, 0, TAU)
        wg.fill()
        wg.restore()
        wg.lineCap = 'round'
        wg.strokeStyle = rgba(p.dark ? mix(p.paper, p.mist, 0.3) : mix(p.water, p.card, 0.3), 0.75 * moon)
        wg.lineWidth = Math.max(1, rr * 0.06)
        for (const [dy, l] of [[-0.06, 0.7], [0.12, 0.85]]) {
          wg.beginPath()
          wg.moveTo(mx - rr * l, my + rr * dy)
          wg.lineTo(mx + rr * l * 0.9, my + rr * dy)
          wg.stroke()
        }
        wg.strokeStyle = rgba(p.dark ? p.moon : p.card, 0.6 * moon)
        wg.lineWidth = Math.max(1, rr * 0.06)
        for (const [ox, oy, l] of [[-1.5, 0.45, 0.5], [1.3, -0.35, 0.4], [0.4, 0.65, 0.35], [-0.8, -0.5, 0.3], [1.6, 0.3, 0.25]]) {
          wg.beginPath()
          wg.moveTo(mx + ox * rr - l * rr, my + oy * rr)
          wg.lineTo(mx + ox * rr + l * rr, my + oy * rr)
          wg.stroke()
        }
      }
      wg.restore()
      // the near bank: a thin bright edge where the water meets the stone
      wg.strokeStyle = rgba(p.dark ? p.moon : p.card, p.dark ? 0.4 : 0.75)
      wg.lineWidth = 1
      line(wg, path.slice(49))
      wg.stroke()
      Object.assign(c.c.style, { left: '0', top: '0' })
      Object.assign(pools[key].style, { left: `${f1(x0)}px`, top: `${f1(y0)}px`, width: `${f1(x1 - x0)}px`, height: `${f1(y1 - y0)}px` })
      out(pools[key], c.c)
    }
    water('src', 0)
    water('tex', 0)
    water('aus', 1)
    yield

    // ── stones: the rocks carved "Dallas" and "capital" at the source's outlets, the stone by the last pond, boulders on
    //    the lips; the flume from "capital" down to Austin, terrace by terrace; the question basin with its trough
    const rocks = canvas(W, H, R.dpr)
    const rg = rocks.g
    const fs = clamp(W * (wide ? 0.0125 : 0.042), 14, 18)
    const rockAt = function* (k: number, dx: number, z: number, w: number, hh: number, seed: number, moss = 0.35, sq = 2.4) {
      const [x, y, sc] = P(wall(k - 1, z) + dx, LV[k], z)
      const ww = w * sc, h2 = hh * sc
      softEllipse(rg, x - ww * 0.1, y + h2 * 0.04, ww * 0.6, h2 * 0.18, p.umbra, p.dark ? 0.8 : 0.4)
      const st = yield* stone({ ...sOpts, tone: [hz(tone[0], sc), hz(tone[1], sc), hz(tone[2], sc), hz(tone[3], sc)], w: ww, h: h2, seed, flat: 0.4, wob: 0.14, bump: 0.035, height: 0.9, moss, sq }, R.dpr)
      rg.drawImage(st, x - ww / 2, y - h2 * 0.9, ww, h2)
      return [x, y - h2 * 0.45, sc] as [number, number, number]
    }
    // a few boulders resting on the lips, away from the outlets and the words
    const rr = rng(2380)
    const clear = (k: number, z: number) =>
      Math.abs(z - L.falls['dallas>texas'][1]) > 1.6 && Math.abs(z - L.dallas[2]) > 1.8 && Math.abs(z - L.capital[2]) > 1.8 && Math.abs(z - L.rill[k === 0 ? 0 : 1]) > 1 && Math.abs(z - L.basin[2]) > 2 &&
      (k !== 1 || (Math.abs(z - L.falls['texas>austin'][1]) > 1.6 && Math.abs(z - L.cupZ) > 1.6 && Math.abs(z - L.cal[2]) > 1.8))
    for (const k of [0, 1]) {
      for (let i = 0; i < 12; i++) {
        const z = lerp(zL + 2, L.zEnd[k] - 3, i / 11) + (rr() - 0.5)
        if (!clear(k, z) || rr() < 0.4) continue
        yield* rockAt(k, wall(k, z) - wall(k - 1, z) - 0.35, z, 0.9 + rr() * 0.8, 0.55 + rr() * 0.35, 2385 + k * 31 + i, 0.45)
      }
    }
    // the near foreground: reeds by the lowest terrace's edge and two boulders, toward the right (the left stays calm
    // for the words)
    {
      const fr = rng(2386)
      const reedC: RGB = p.dark ? mix(p.umbra, p.mossB, 0.35) : mix(p.wash, p.mossB, 0.45)
      for (const [ux, n] of wide ? [[0.58, 7], [0.74, 9], [0.93, 11]] : [[0.62, 5], [0.9, 7]]) {
        for (let i = 0; i < n; i++) {
          const x = W * ux + (fr() - 0.5) * W * 0.05, y = H + 4
          const hh2 = H * (0.08 + fr() * 0.09), lean = (fr() - 0.3) * hh2 * 0.4
          rg.strokeStyle = rgba(reedC, 0.92)
          rg.lineWidth = 1.2 + fr() * 1.6
          rg.lineCap = 'round'
          rg.beginPath()
          rg.moveTo(x, y)
          rg.quadraticCurveTo(x + lean * 0.3, y - hh2 * 0.6, x + lean, y - hh2)
          rg.stroke()
          if (fr() < 0.35) {
            rg.strokeStyle = rgba(p.dark ? p.moon : p.card, p.dark ? 0.3 : 0.5)
            rg.lineWidth = 0.8
            rg.beginPath()
            rg.moveTo(x + 1, y - hh2 * 0.3)
            rg.quadraticCurveTo(x + lean * 0.3 + 1, y - hh2 * 0.6, x + lean + 1, y - hh2)
            rg.stroke()
          }
        }
      }
      for (const [ux, uy, ws, seed] of wide ? [[0.66, 0.985, 0.075, 2387], [0.84, 0.99, 0.06, 2388]] : [[0.76, 0.99, 0.18, 2387]]) {
        const w2 = W * ws, h2 = w2 * 0.5
        const x = W * ux, y = H * uy
        softEllipse(rg, x - w2 * 0.1, y, w2 * 0.6, h2 * 0.2, p.umbra, p.dark ? 0.8 : 0.4)
        const st = yield* stone({ ...sOpts, w: w2, h: h2, seed, flat: 0.4, wob: 0.15, bump: 0.035, height: 0.9, moss: 0.5 }, R.dpr)
        rg.drawImage(st, x - w2 / 2, y - h2 * 0.9, w2, h2)
      }
    }
    const [dk, ddx, dz, dw, dh] = L.dallas
    const dal = yield* rockAt(dk, ddx, dz, dw, dh, 2391, 0.3)
    const [ck, cdx, cz, cw, ch] = L.capital
    const cap = yield* rockAt(ck, cdx, cz, cw, ch, 2392, 0.3)
    const [ak, adx, az, aw, ah] = L.ausName
    const aus = yield* rockAt(ak, adx, az, aw, ah, 2393, 0.25)
    // pines on the higher terraces, clipped shrubs here and there: cushions of dark leaves, the moon on their shoulders
    for (const [kind, k, dx, z, size] of L.flora) {
      const [x, y, sc] = P(wall(k - 1, z) + dx, LV[k], z)
      const c = hz(p.dark ? mix(p.umbra, p.mossB, 0.4) : mix(p.wash, p.mossB, 0.42), sc)
      softEllipse(rg, x - size * sc * 0.15, y + sc * 0.05, size * sc * 0.55, size * sc * 0.12, p.umbra, p.dark ? 0.7 : 0.35)
      if (kind === 'pine') pine(rg, p, x, y, size * sc, c)
      else {
        const w = size * sc, hh = size * sc * 0.62
        const leaf: [RGB, RGB, RGB, RGB] = p.dark ? [mix(p.mossC, p.mid, 0.3), p.mossA, mix(p.mossB, p.umbra, 0.4), p.umbra] : [mix(p.mossC, p.hi, 0.3), p.mossA, p.mossB, mix(p.mossB, p.wash, 0.5)]
        const st = yield* stone({ tone: [hz(leaf[0], sc), hz(leaf[1], sc), hz(leaf[2], sc), hz(leaf[3], sc)], w, h: hh, seed: (z * 97) | 0, flat: 0.55, wob: 0.2, bump: 0.16, height: 0.9, rim: p.dark ? p.moon : p.wash, rimA: p.dark ? 0.35 : 0.25, up: 'y', inkA: 0.35, grain: 0.12, dry: 0.6 }, R.dpr)
        rg.drawImage(st, x - w / 2, y - hh * 0.92, w, hh)
      }
      yield
    }
    // the flume: split bamboo from the capital rock's outlet over wall 0 into a stone cup on the middle terrace, then a
    // second length over wall 1 into Austin, each on crossed posts standing on the terrace under it
    for (const seg of flume().segs) kakehi(rg, p, seg)
    {
      // a stone bowl on a short stone post standing on the middle terrace: the first length pours into it, the second
      // leaves from its rim
      const [x, y, sc] = P(wall(0, L.cupZ) + 1.3, LV[1], L.cupZ)
      softEllipse(rg, x - sc * 0.12, y + sc * 0.04, sc * 0.6, sc * 0.16, p.umbra, p.dark ? 0.85 : 0.42)
      const post = yield* stone({ ...sOpts, w: sc * 0.55, h: sc * 0.5, seed: 2397, slab: 0.12, sq: 3, wob: 0.06, bump: 0.03, height: 0.5, moss: 0.3 }, R.dpr)
      rg.drawImage(post, x - sc * 0.275, y - sc * 0.48, sc * 0.55, sc * 0.5)
      softEllipse(rg, x, y - sc * 0.42, sc * 0.5, sc * 0.08, p.umbra, p.dark ? 0.7 : 0.35)
      const st = yield* stone({ ...sOpts, w: sc * 1.1, h: sc * 0.55, seed: 2398, flat: 0.25, wob: 0.1, bump: 0.03, height: 0.7, moss: 0.4, sq: 2.2 }, R.dpr)
      rg.drawImage(st, x - sc * 0.55, y - sc * 0.92, sc * 1.1, sc * 0.55)
      rg.fillStyle = rgba(p.dark ? mix(p.umbra, p.paper, 0.4) : mix(p.water, p.wash, 0.2))
      rg.beginPath()
      rg.ellipse(x, y - sc * 0.8, sc * 0.36, sc * 0.08, 0, 0, TAU)
      rg.fill()
    }
    // the basin: a stone cistern at the source's near end, the question carved on its face
    {
      const [bk, bdx, bz, bw, bh] = L.basin
      const [bx, by, sc] = P(wall(bk - 1, bz) + bdx, LV[bk], bz)
      const w = bw * sc, hh = bh * sc
      softEllipse(rg, bx - w * 0.06, by + hh * 0.04, w * 0.58, hh * 0.15, p.umbra, p.dark ? 0.85 : 0.42)
      const st = yield* stone({ ...sOpts, w, h: hh, seed: 2399, slab: 0.14, sq: 2.7, wob: 0.09, bump: 0.03, height: 0.4, moss: 0.25 }, R.dpr)
      const left = bx - w / 2, top = by - hh * 0.92
      rg.drawImage(st, left, top, w, hh)
      // its water: a dark lens at the top with the moon's glint
      rg.fillStyle = rgba(p.dark ? mix(p.umbra, p.paper, 0.45) : mix(p.water, p.wash, 0.25))
      rg.beginPath()
      rg.ellipse(bx, top + hh * 0.13, w * 0.38, hh * 0.06, 0, 0, TAU)
      rg.fill()
      rg.strokeStyle = rgba(p.dark ? p.moon : p.card, 0.7)
      rg.lineWidth = 1.2
      rg.beginPath()
      rg.ellipse(bx, top + hh * 0.13, w * 0.37, hh * 0.055, 0, -0.4, 0.9)
      rg.stroke()
      Object.assign(q.style, { left: `${f1(left + w * 0.08)}px`, top: `${f1(top + hh * 0.26)}px`, width: `${f1(w * 0.86)}px`, fontSize: `${f1(wide ? clamp(W * 0.0105, 14, 16) : 13)}px` })
      // the trough: from the basin's lip out over the source pond, its far end lower once tilted
      const a: Pt = [left + w * 1.0, top + hh * (wide ? 0.3 : 0.86)]
      const ez = L.ponds.src.z0 + (wide ? 1.2 : 0.55)
      const e = edges(L.ponds.src, ez)!
      const bq = P(lerp(e[0], e[1], wide ? 0.4 : 0.3), LV[0], ez)
      const len = clamp(Math.hypot(bq[0] - a[0], bq[1] - a[1]) * 1.3, wide ? 110 : 70, wide ? 200 : 94), ang = Math.atan2(bq[1] - a[1], bq[0] - a[0])
      const deg = (ang * 180) / Math.PI - 3
      Object.assign(pour.style, { left: `${f1((a[0] + bq[0]) / 2 - len / 2)}px`, top: `${f1((a[1] + bq[1]) / 2 - 22)}px`, width: `${f1(len)}px`, height: '44px', '--a': `${f1(deg)}deg` })
      Object.assign(handle.style, { left: `${f1(len * (10 / 120))}px`, top: `${f1(22 - len * ((21.5 - 4) / 120))}px` })
      // the stand: two poles crossed under the fork, their feet on the terrace, lashed where they cross
      {
        const mxp = (a[0] + bq[0]) / 2, myp = (a[1] + bq[1]) / 2
        const rad = (deg * Math.PI) / 180, k = -len * 0.05 // the fork sits 45% along the spout
        const fx = mxp + Math.cos(rad) * k, fy = myp + Math.sin(rad) * k + 2
        const legH = Math.max(18, sc * 0.7), spread = legH * 0.5
        const wood: RGB = p.dark ? mix(p.lo, p.lantern, 0.12) : mix(p.lo, p.lantern, 0.2)
        softEllipse(rg, fx, fy + legH, spread * 1.5, Math.max(3, legH * 0.12), p.umbra, p.dark ? 0.8 : 0.4)
        rg.lineCap = 'round'
        rg.strokeStyle = rgba(p.dark ? mix(wood, p.mid, 0.3) : mix(wood, p.umbra, 0.35))
        rg.lineWidth = Math.max(2.6, sc * 0.09)
        rg.beginPath()
        rg.moveTo(fx - spread * 0.35, fy - legH * 0.18)
        rg.lineTo(fx + spread, fy + legH)
        rg.moveTo(fx + spread * 0.35, fy - legH * 0.18)
        rg.lineTo(fx - spread, fy + legH)
        rg.stroke()
        rg.strokeStyle = rgba(p.dark ? p.moon : p.card, 0.6)
        rg.lineWidth = Math.max(1, sc * 0.025)
        rg.beginPath()
        rg.moveTo(fx + spread * 0.35 + 1, fy - legH * 0.18)
        rg.lineTo(fx - spread + 1, fy + legH)
        rg.stroke()
        rg.strokeStyle = rgba(p.dark ? mix(p.lantern, p.lo, 0.5) : mix(p.lo, p.lantern, 0.4), 0.9)
        rg.lineWidth = Math.max(1.5, sc * 0.05)
        rg.beginPath()
        rg.moveTo(fx - spread * 0.18, fy + legH * 0.06)
        rg.lineTo(fx + spread * 0.18, fy + legH * 0.06)
        rg.stroke()
      }
    }
    out(rocksArt, rocks.c)
    yield
    Object.assign(names.dallas.style, { left: `${f1(dal[0] - 90)}px`, top: `${f1(dal[1] - fs * 0.62)}px`, width: '180px', fontSize: `${f1(fs * 1.1)}px` })
    Object.assign(names.capital.style, { left: `${f1(cap[0] - 90)}px`, top: `${f1(cap[1] - fs * 0.62)}px`, width: '180px', fontSize: `${f1(fs)}px` })
    Object.assign(ausName.style, { left: `${f1(aus[0] - 90)}px`, top: `${f1(aus[1] - fs * 0.6)}px`, width: '180px', fontSize: `${f1(fs)}px` })
    // the shortcut's words lie beside its rill, on the lowest terrace, above it
    {
      const [, z1, x2] = L.rill
      const zm = lerp(z1, L.ponds.aus.z0, 0.42)
      const [x, y] = P(wall(1, zm) + x2 - 0.5, LV[2], zm)
      Object.assign(cutLab.style, { left: `${f1(x)}px`, top: `${f1(y - fs * 1.5)}px`, translate: '-50% 0', textAlign: 'center', width: `${f1(Math.min(W * 0.4, 260))}px`, fontSize: `${f1(Math.max(13, fs - 2))}px` })
    }

    // ── the weir slab in the middle pond's notch, and "California" lying on the bank beside the pond
    {
      const slab = function* (el: HTMLElement, at: Pt, w: number, hh: number, seed: number) {
        const st = yield* stone({ ...sOpts, w, h: hh, seed, slab: 0.1, sq: 2.7, wob: 0.12, bump: 0.04, height: 0.5, moss: 0.2 }, R.dpr)
        st.style.cssText = `width:${f1(w)}px;height:${f1(hh)}px;left:0;top:0`
        Object.assign(el.style, { left: `${f1(at[0] - w / 2)}px`, top: `${f1(at[1] - hh * 0.9)}px`, width: `${f1(w)}px`, height: `${f1(hh)}px`, fontSize: `${f1(fs)}px` })
        out(el, h('i', { class: 't23s-slab-sh' }), st, ...el.querySelectorAll(':scope > .t23-carve, :scope > .p2g-dot'))
      }
      const wz = L.falls['texas>austin'][1]
      const wb = xy(wall(1, wz) - 0.15, LV[1], wz)
      yield* slab(weir, wb, Math.max(84, fs * 5.6), fs * 2.4, 2403)
      const [ck2, cdx2, cz2] = L.cal
      yield* slab(cal, xy(wall(ck2 - 1, cz2) + cdx2, LV[ck2], cz2), Math.max(112, fs * 7.4), fs * 2.3, 2404)
      const [rk, rdx, rz] = L.rest
      const rest = xy(wall(rk - 1, rz) + rdx, LV[rk], rz)
      weir.style.setProperty('--rx', `${f1(rest[0] - wb[0])}px`)
      weir.style.setProperty('--ry', `${f1(rest[1] - wb[1])}px`)
      home = [wb[0], wb[1] - fs * 1.1]
    }
    for (const [el, kids] of fresh) el.replaceChildren(...kids)
    // the notes: what the water stands for (top left), the limit beside the misty cascades (by the moon)
    Object.assign(decode.style, wide ? { left: `${f1(R.gut + 4)}px`, top: '6px', width: `${f1(Math.min(400, W * 0.3))}px` } : { left: `${f1(R.gut + 2)}px`, top: '2px', width: `${f1((W - R.gut * 2) * 0.62)}px` })
    Object.assign(limit.style, wide ? { left: `${f1(W * 0.62)}px`, top: `${f1(H * 0.05)}px`, width: `${f1(W * 0.2)}px`, textAlign: 'right' } : { left: `${f1(R.gut + 2)}px`, top: `${f1(H * 0.115)}px`, width: `${f1(W * 0.8)}px`, textAlign: 'left' })
    flows.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    drawFlow(false)
  }

  /** The rill's course: from the source pond over the near ends of both walls, then along the lowest terrace to Austin. */
  function rillPts(bed: boolean): Pt[] {
    const [z0, z1, x2] = L.rill
    const zA = L.ponds.aus.z0 + 0.6
    const pts: [number, number, number][] = [
      [wall(0, z0) - 0.7, LV[0] - (bed ? 0 : 0.04), z0], [wall(0, z0), LV[0], z0], [wall(0, z0) + 0.06, LV[1], z0 + 0.05],
      [lerp(wall(0, z0), wall(1, z1), 0.55), LV[1], lerp(z0, z1, 0.5)], [wall(1, z1), LV[1], z1], [wall(1, z1) + 0.06, LV[2], z1 + 0.05],
      [wall(1, z1 + 1) + x2 * 0.7, LV[2], z1 + 1], [wall(1, lerp(z1, zA, 0.3)) + x2 * 1.15, LV[2], lerp(z1, zA, 0.3)], [wall(1, lerp(z1, zA, 0.55)) + x2 * 0.8, LV[2], lerp(z1, zA, 0.55)],
      [wall(1, lerp(z1, zA, 0.8)) + x2 * 1.1, LV[2], lerp(z1, zA, 0.8)], [wall(1, zA) + x2 * 0.8, LV[2], zA],
    ]
    return pts.map(([x, y, z]) => xy(x, y, z))
  }

  /** The flume's two lengths, each [x, y, px/m, px down to the ground under it]: capital rock → cup → Austin. */
  function flume() {
    const cz = L.capital[2] - 0.9, zc = L.cupZ, ze = Math.min(L.ponds.aus.z1 - 1.5, zc + 0.8)
    const ground = (x: number, z: number) => (x < wall(0, z) ? LV[0] : x < wall(1, z) ? LV[1] : LV[2])
    const seg = (X0: number, Y0: number, Z0: number, X1: number, Y1: number, Z1: number) =>
      Array.from({ length: 9 }, (_, i) => {
        const t = i / 8
        const x = lerp(X0, X1, t), y = lerp(Y0, Y1, t), z = lerp(Z0, Z1, t)
        const [sx, sy, sc] = P(x, y, z)
        return [sx, sy, sc, P(x, ground(x, z), z)[1] - sy] as [number, number, number, number]
      })
    const a = seg(wall(0, cz) - 0.6, LV[0] + 0.55, cz, wall(0, zc) + 1.1, LV[1] + 0.9, zc)
    const b = seg(wall(0, zc) + 1.5, LV[1] + 0.82, zc, wall(1, ze) + 1.2, LV[2] + 0.35, ze)
    return { segs: [a, b] }
  }

  /** The water: falls over the walls, the flume's thread, the rill; pools show as they fill. */
  function drawFlow(animate: boolean, only?: string) {
    if (!W) return
    const kids: SVGElement[] = []
    const anim: [SVGElement, number][] = []
    const curve = (pts: Pt[]) => {
      let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`
      for (let i = 1; i < pts.length - 1; i++) d += `Q${f1(pts[i][0])} ${f1(pts[i][1])} ${f1((pts[i][0] + pts[i + 1][0]) / 2)} ${f1((pts[i][1] + pts[i + 1][1]) / 2)}`
      return d + `L${f1(pts[pts.length - 1][0])} ${f1(pts[pts.length - 1][1])}`
    }
    if (stage >= 1) {
      const f = fall('dallas>texas', 1)
      kids.push(f)
      if (animate && only === 'dallas') anim.push([f, 300])
      const r = s('path', { class: 'core cut', d: curve(rillPts(false)), pathLength: 1 })
      kids.push(r)
      if (animate && only === 'dallas') anim.push([r, 900])
    }
    if (stage >= 2) {
      flume().segs.forEach((seg, i) => {
        const pts = seg.map((q) => [q[0], q[1] - q[2] * 0.04] as Pt)
        const c = s('path', { class: 'core', d: curve(pts), pathLength: 1 })
        const [ex, ey, esc, eg] = seg[seg.length - 1]
        const sp = s('path', { class: 'core', d: `M${f1(ex)} ${f1(ey)}q${f1(esc * 0.18)} ${f1(esc * 0.05)} ${f1(esc * 0.2)} ${f1(Math.max(6, eg * 0.9))}`, pathLength: 1 })
        kids.push(c, sp)
        if (animate && only === 'capital') anim.push([c, i * 1100], [sp, i * 1100 + 900])
      })
    }
    if (stage >= 4 && !lifted) {
      const f = fall(swapped ? 'cal>austin' : 'texas>austin', 0.85)
      kids.push(f)
      if (animate && (only === 'austin' || only === 'swap')) anim.push([f, 200])
    }
    flows.replaceChildren(...kids)
    for (const [el, delay] of anim) {
      if (still) continue
      if (el.tagName === 'path') {
        el.style.strokeDasharray = '1'
        el.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 1300, delay, easing: 'cubic-bezier(.3,.1,.2,1)', fill: 'backwards' })
      } else el.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 1000, delay, easing: 'cubic-bezier(.3,.1,.2,1)', fill: 'backwards' })
    }
    R.root.classList.toggle('src-full', stage >= 1)
    R.root.classList.toggle('tex-full', stage >= 3)
    R.root.classList.toggle('aus-full', stage >= 4)
  }

  /** A curtain of white water over its wall at the notch: the glassy bend on the lip, streaks down the face, foam and a
   *  soft spray in the pond at its foot. */
  function fall(key: keyof Lay['falls'], k: number) {
    const [wk, z, nw] = L.falls[key]
    const a0 = P(wall(wk, z - nw / 2), LV[wk], z - nw / 2), a1 = P(wall(wk, z + nw / 2), LV[wk], z + nw / 2)
    const b0 = P(wall(wk, z - nw / 2) + 0.3, LV[wk + 1], z - nw / 2), b1 = P(wall(wk, z + nw / 2) + 0.3, LV[wk + 1], z + nw / 2)
    const id = nextId('t23s-fall')
    const grad = s('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1: f1(a0[0]), y1: f1(a0[1]), x2: f1(b0[0]), y2: f1(b0[1]) }, s('stop', { offset: 0, class: 'fs0' }), s('stop', { offset: 1, class: 'fs1' }))
    const spray = s('radialGradient', { id: `${id}-s` }, s('stop', { offset: 0, class: 'sp0' }), s('stop', { offset: 1, class: 'sp1' }))
    const r = rng(Math.round(a0[0] * 7 + a0[1]))
    const streaks: SVGElement[] = []
    for (let i = 0; i < 8; i++) {
      const u = 0.05 + (i / 7) * 0.9 + (r() - 0.5) * 0.06
      const ax = lerp(a0[0], a1[0], u), ay = lerp(a0[1], a1[1], u), bx = lerp(b0[0], b1[0], u), by = lerp(b0[1], b1[1], u)
      // over the lip the water bows out toward us, then drops
      const ox = (bx - ax) * 1.2
      streaks.push(s('path', { class: 'streak', style: `opacity:${(0.45 + r() * 0.55).toFixed(2)}`, d: `M${f1(ax)} ${f1(ay)}C${f1(ax + ox)} ${f1(ay + (by - ay) * 0.15)} ${f1(bx)} ${f1(ay + (by - ay) * 0.5)} ${f1(bx + (r() - 0.5) * 2)} ${f1(by)}` }))
    }
    const fx = (b0[0] + b1[0]) / 2, fy = (b0[1] + b1[1]) / 2, fw = Math.hypot(b1[0] - b0[0], b1[1] - b0[1])
    const foam: SVGElement[] = []
    for (let i = 0; i < 9; i++) foam.push(s('ellipse', { class: 'foam', cx: f1(fx + (r() - 0.5) * fw * 1.6), cy: f1(fy + (r() - 0.2) * fw * 0.25), rx: f1(fw * (0.08 + r() * 0.16)), ry: f1(Math.max(1, fw * (0.03 + r() * 0.04))) }))
    return s('g', { class: 'fall', style: `--k:${k}` },
      s('defs', null, grad, spray),
      s('ellipse', { cx: f1(fx), cy: f1(fy), rx: f1(fw * 1.5), ry: f1(fw * 0.45), fill: `url(#${id}-s)` }),
      s('path', { class: 'sheet', d: `M${f1(a0[0])} ${f1(a0[1])}L${f1(a1[0])} ${f1(a1[1])}C${f1(a1[0] + (b1[0] - a1[0]) * 1.2)} ${f1(a1[1] + 2)} ${f1(b1[0])} ${f1(a1[1] + (b1[1] - a1[1]) * 0.45)} ${f1(b1[0])} ${f1(b1[1])}L${f1(b0[0])} ${f1(b0[1])}C${f1(b0[0])} ${f1(a0[1] + (b0[1] - a0[1]) * 0.45)} ${f1(a0[0] + (b0[0] - a0[0]) * 1.2)} ${f1(a0[1] + 2)} ${f1(a0[0])} ${f1(a0[1])}Z`, fill: `url(#${id})` }),
      ...streaks,
      s('path', { class: 'bend', d: `M${f1(a0[0])} ${f1(a0[1])}L${f1(a1[0])} ${f1(a1[1])}` }),
      ...foam)
  }

  // ── beat 1: tilt the trough; the water runs on by itself, one outlet after another
  const timers: number[] = []
  ctx.onCleanup(() => timers.forEach(clearTimeout))
  const at = (ms: number, fn: () => void) => (still ? fn() : void timers.push(window.setTimeout(fn, ms)))
  function tilt() {
    if (pour.disabled) return
    pour.disabled = true
    pour.classList.remove('beckon')
    pour.classList.add('tilted')
    mark?.done()
    mark = null
    ctx.chime('tap')
    at(700, () => ((stage = 1), drawFlow(true, 'dallas'), ctx.chime('tap')))
    at(2000, () => ((stage = 2), drawFlow(true, 'capital'), ctx.chime('tap')))
    at(3400, () => ((stage = 3), drawFlow(true, 'texas')))
    at(4400, () => ((stage = 4), drawFlow(true, 'austin'), ctx.chime('ok'), ready()))
  }
  pour.addEventListener('click', tilt)
  let py = NaN
  pour.addEventListener('pointerdown', (e) => void (py = e.clientY))
  pour.addEventListener('pointermove', (e) => void (!Number.isNaN(py) && e.clientY - py > 12 && ((py = NaN), tilt())))
  pour.addEventListener('pointerup', () => void (py = NaN))

  // ── beat 2: drag "Texas" out of the weir's notch (or Enter on it), then "California" into the gap
  function ready() {
    weir.classList.add('live')
    weir.setAttribute('role', 'button')
    weir.setAttribute('tabindex', '0')
    weir.setAttribute('aria-label', K.liftAria)
    ctx.prompt(K.lift)
    mark = gd.dot(weir, { dir: [0, -1] })
  }
  /** a slab follows the pointer from where it was picked up; let go → done(moved px, client point) */
  function draggable(el: HTMLElement, done: (moved: number, x: number, y: number) => void) {
    let id = -1, x0 = 0, y0 = 0, dx = 0, dy = 0
    el.addEventListener('pointerdown', (e) => {
      if (!el.classList.contains('live')) return
      id = e.pointerId
      x0 = e.clientX
      y0 = e.clientY
      dx = dy = 0
      el.setPointerCapture(id)
      el.classList.add('held')
      hole?.lift(true)
    })
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return
      dx = e.clientX - x0
      dy = e.clientY - y0
      el.style.translate = `${f1(dx)}px ${f1(dy)}px`
    })
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return
      id = -1
      el.classList.remove('held')
      done(Math.hypot(dx, dy), e.clientX, e.clientY)
    }
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && el.classList.contains('live') && (e.preventDefault(), done(0, NaN, NaN)))
  }
  draggable(weir, () => {
    if (lifted || swapped) return
    lifted = true
    // set down on the bank beyond the pond; the notch it leaves is the place to drop the other one
    weir.classList.remove('live', 'beckon')
    weir.removeAttribute('role')
    weir.removeAttribute('tabindex')
    weir.style.translate = ''
    weir.classList.add('lifted')
    mark?.done()
    // the gap, in the art's px (the view bleeds past the art by the gutter)
    hole = gd.drop(() => [home[0] - R.gut, home[1]], { w: weir.offsetWidth + 16, h: weir.offsetHeight + 8, round: false })
    hole.lift(true)
    ctx.chime('soft')
    ctx.prompt(K.drop)
    drawFlow(false)
    cal.disabled = false
    cal.classList.add('live')
    mark = gd.dot(cal, { dir: [0.8, 0.5] })
    cal.focus({ preventScroll: true })
  })
  draggable(cal, (moved, x, y) => {
    if (swapped || !lifted) return
    if (moved > 8) {
      const v = R.view.getBoundingClientRect()
      if (Math.hypot(x - v.left - home[0], y - v.top - home[1]) > 90) {
        cal.style.translate = ''
        gd.wrong(K.dropWrong, cal)
        beckon(cal)
        return
      }
    }
    swap()
  })
  /** the thing to use breathes vermilion twice (a wrong move, or six seconds of stillness) */
  function beckon(el: HTMLElement) {
    el.classList.remove('beckon')
    void el.offsetWidth
    el.classList.add('beckon')
  }
  // six seconds of stillness: what waits for the hand nudges the way it should go (8–12 px), and breathes vermilion
  const nudge = () => {
    if (swapped || ctx.reduced) return
    const el = !pour.disabled ? pour : !lifted ? (weir.classList.contains('live') ? weir : null) : cal
    if (!el) return
    const [tx, ty, rot] = el === pour ? [0, 0, 7] : el === weir ? [0, -10, 0] : [10, -4, 0]
    el.animate([{ translate: '0 0', rotate: '0deg' }, { translate: `${tx}px ${ty}px`, rotate: `${rot}deg`, offset: 0.4 }, { translate: '0 0', rotate: '0deg' }], { duration: 900, iterations: 2, easing: 'ease-in-out', composite: 'add' })
    beckon(el)
  }
  ctx.el.addEventListener('p2:idle', nudge)
  ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', nudge))

  // (a tap or Enter on California, without dragging, sets it in too)
  function swap() {
    swapped = true
    lifted = false
    R.root.classList.add('swapped')
    cal.classList.remove('live', 'beckon')
    cal.disabled = true
    cal.setAttribute('aria-pressed', 'true')
    cal.style.translate = ''
    // the weir's place now holds California; Texas lies on the bank where California lay (the carved words, not the dot)
    weir.querySelector('.t23-carve')!.textContent = K.swapTo
    cal.querySelector('.t23-carve')!.textContent = K.nodes[2].label
    weir.classList.remove('lifted')
    ausName.textContent = K.swapResult
    if (!still) for (const el of [weir, cal]) el.animate([{ transform: 'translateY(-12px)', opacity: 0.3 }, { transform: 'none', opacity: 1 }], { duration: 900, easing: 'cubic-bezier(.3,.1,.2,1)' })
    if (!still) ausName.animate([{ opacity: 0, filter: 'blur(3px)' }, { opacity: 1, filter: 'blur(0)' }], { duration: 1400 })
    mark?.done()
    hole?.hit()
    delete limit.dataset.off
    ctx.chime('ok')
    drawFlow(true, 'swap')
    ctx.insight(K.insight, K.detail)
  }
}

function poly(g: CanvasRenderingContext2D, pts: Pt[]) {
  g.beginPath()
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
  g.closePath()
}
function line(g: CanvasRenderingContext2D, pts: Pt[]) {
  g.beginPath()
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
}

/** A pine on the crest: a trunk and four tiers of needles, the moon on their right shoulders (th = height in px). */
function pine(g: CanvasRenderingContext2D, p: Pal, x: number, y: number, th: number, c: RGB) {
  g.strokeStyle = rgba(c)
  g.lineWidth = Math.max(1, th * 0.05)
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(x, y)
  g.quadraticCurveTo(x - th * 0.05, y - th * 0.5, x + th * 0.04, y - th)
  g.stroke()
  for (let j = 0; j < 4; j++) {
    const yy = y - th * (0.38 + j * 0.19), ww = th * (0.4 - j * 0.08)
    g.fillStyle = rgba(c, 0.96)
    g.beginPath()
    g.moveTo(x - ww, yy + th * 0.05)
    g.quadraticCurveTo(x - ww * 0.2, yy - th * 0.11, x + ww * 1.1, yy + th * 0.02)
    g.quadraticCurveTo(x, yy + th * 0.03, x - ww, yy + th * 0.05)
    g.fill()
    g.fillStyle = rgba(p.dark ? mix(p.mossC, p.moon, 0.2) : mix(p.mossC, p.card, 0.3), 0.32)
    g.beginPath()
    g.ellipse(x + ww * 0.5, yy - th * 0.02, ww * 0.42, th * 0.022, -0.15, 0, TAU)
    g.fill()
  }
}

/** A dry-stone wall's face (ishigaki): stones of every length laid in two wandering courses, now and then one big stone
 *  through both, each its own tone with a moonlit top edge and a shaded foot, dark joints with moss in them, wet streaks
 *  down from the lip; paler with distance. */
function* masonry(g: CanvasRenderingContext2D, p: Pal, k: number, zs: number[], P: (X: number, Y: number, Z: number) => [number, number, number], wl: (z: number) => number, hz: (c: RGB, s: number) => RGB): Generator<void, void> {
  const top = LV[k] - 0.04, bot = LV[k + 1] + 0.03
  const r = rng(2500 + k)
  const zEnd = zs[zs.length - 1] - 2
  const midY = (z: number) => lerp(top, bot, 0.48 + 0.1 * Math.sin(z * 1.3 + k) + 0.04 * Math.sin(z * 3.7))
  const gap = 0.05
  const scr = (y: number, z: number): Pt => { const v = P(wl(z), y, z); return [v[0], v[1]] }
  const joints: Pt[] = []
  const stoneAt = (za: number, zb: number, ya: (z: number) => number, yb: (z: number) => number) => {
    const sc = P(wl(za), top, za)[2]
    // an irregular rounded outline: corners eased in by different amounts, the edges bowed a little
    const ins = () => 0.06 + r() * 0.08
    const zA = za + (zb - za) * ins(), zB = zb - (zb - za) * ins(), zM = (za + zb) / 2 + (r() - 0.5) * (zb - za) * 0.2
    const tY = (z: number) => ya(z) - 0.03 - r() * 0.03, bY = (z: number) => yb(z) + 0.03 + r() * 0.03
    const pts: Pt[] = [scr(tY(zA), za + (zb - za) * 0.02), scr(tY(zM) + 0.02, zM), scr(tY(zB), zb - (zb - za) * 0.02), scr((tY(zb) + bY(zb)) / 2, zb), scr(bY(zB), zb - (zb - za) * 0.03), scr(bY(zM) - 0.02, zM), scr(bY(zA), za + (zb - za) * 0.03), scr((tY(za) + bY(za)) / 2, za)]
    const v = r()
    const t0 = p.dark ? mix(mix(p.lo, p.mid, 0.12), v < 0.5 ? p.umbra : p.hi, v < 0.5 ? 0.25 * (0.5 - v) * 2 : 0.3 * (v - 0.5) * 2) : mix(mix(p.lo, p.mid, 0.4), v < 0.5 ? p.wash : p.hi, v < 0.5 ? 0.2 * (0.5 - v) * 2 : 0.35 * (v - 0.5) * 2)
    g.beginPath()
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2
      i ? g.quadraticCurveTo(x0, y0, mx, my) : g.moveTo(mx, my)
    }
    const [x0, y0] = pts[0], [x1, y1] = pts[1]
    g.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
    g.closePath()
    const cg = g.createLinearGradient(0, pts[1][1], 0, pts[5][1])
    cg.addColorStop(0, rgba(hz(mix(t0, p.dark ? p.moon : p.card, 0.12), sc)))
    cg.addColorStop(1, rgba(hz(mix(t0, p.umbra, 0.3), sc)))
    g.fillStyle = cg
    g.fill()
    // its top edge, turned up to the moon
    g.strokeStyle = rgba(p.dark ? mix(p.mid, p.moon, 0.45) : mix(p.hi, p.card, 0.5), (p.dark ? 0.55 : 0.6) * (0.5 + r() * 0.5))
    g.lineWidth = Math.max(0.7, sc * 0.03)
    g.beginPath()
    g.moveTo(...pts[0])
    g.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1])
    g.stroke()
    joints.push(pts[2], pts[4])
  }
  let zt = zs[0] + r() * 0.5, zb = zs[0]
  let guard = 0
  while (Math.min(zt, zb) < zEnd && guard++ < 400) {
    if (Math.abs(zt - zb) < 0.3 && r() < 0.2) {
      const za = Math.max(zt, zb), len = 0.9 + r() * 0.9
      stoneAt(za, Math.min(za + len, zEnd), () => top, () => bot)
      zt = zb = za + len + gap
    } else if (zt <= zb) {
      const len = 0.35 + r() * 1.1
      stoneAt(zt, Math.min(zt + len, zEnd), () => top, midY)
      zt += len + gap
    } else {
      const len = 0.4 + r() * 1.2
      stoneAt(zb, Math.min(zb + len, zEnd), midY, () => bot)
      zb += len + gap
    }
    if ((guard & 15) === 15) yield
  }
  // moss in the joints, and wet streaks down the face from the lip
  for (const [x, y] of joints) {
    if (r() < 0.45) continue
    const s = 2 + r() * 4
    g.fillStyle = rgba(p.dark ? mix(p.mossA, p.mossC, r() * 0.5) : mix(p.mossB, p.mossA, r()), 0.6)
    g.beginPath()
    g.ellipse(x + (r() - 0.5) * 3, y, s, s * 0.5, (r() - 0.5) * 0.8, 0, TAU)
    g.fill()
  }
  g.lineCap = 'round'
  for (let i = 0; i < 40; i++) {
    const z = lerp(zs[0], zEnd, r())
    const a = P(wl(z), top, z), b = P(wl(z), lerp(top, bot, 0.3 + r() * 0.6), z)
    g.strokeStyle = rgba(p.umbra, p.dark ? 0.22 : 0.12)
    g.lineWidth = Math.max(0.8, a[2] * 0.05)
    g.beginPath()
    g.moveTo(a[0], a[1])
    g.lineTo(b[0], b[1])
    g.stroke()
  }
}

/** A thin rill's bed: a wet dark groove finding its way down the terraces, a pale lip on the moon's side. */
function groove(g: CanvasRenderingContext2D, p: Pal, pts: Pt[]) {
  g.save()
  g.lineCap = 'round'
  g.lineJoin = 'round'
  const path = (dx: number, dy: number) => {
    g.beginPath()
    g.moveTo(pts[0][0] + dx, pts[0][1] + dy)
    for (let i = 1; i < pts.length - 1; i++) g.quadraticCurveTo(pts[i][0] + dx, pts[i][1] + dy, (pts[i][0] + pts[i + 1][0]) / 2 + dx, (pts[i][1] + pts[i + 1][1]) / 2 + dy)
    g.lineTo(pts[pts.length - 1][0] + dx, pts[pts.length - 1][1] + dy)
  }
  g.strokeStyle = rgba(p.umbra, p.dark ? 0.32 : 0.2)
  g.lineWidth = 3.5
  path(0, 0)
  g.stroke()
  g.strokeStyle = rgba(p.dark ? p.mid : p.card, p.dark ? 0.25 : 0.5)
  g.lineWidth = 0.8
  path(0.8, -1.6)
  g.stroke()
  g.restore()
}

/**
 * A kakehi: split bamboo along pts ([x, y, px/m, px down to the ground], high end first), on crossed posts standing on
 * the ground under it, lit from the moon's side, a dark bore along its open top for the water, nodes along it.
 */
function kakehi(g: CanvasRenderingContext2D, p: Pal, pts: [number, number, number, number][]) {
  const n = pts.length
  const wid = (i: number) => pts[i][2] * 0.2
  const bam: [RGB, RGB, RGB] = p.dark ? [mix(p.mossC, p.moon, 0.35), mix(p.mossC, p.mid, 0.35), mix(p.mossA, p.lo, 0.4)] : [mix(p.mossC, p.stepHi, 0.4), mix(p.mossA, p.stepMid, 0.3), mix(p.mossB, p.wash, 0.3)]
  g.save()
  g.lineCap = 'round'
  g.lineJoin = 'round'
  // posts: a crossed pair at a third and two thirds of the length, standing on the ground with a contact shadow
  for (const i of [Math.round(n * 0.25), Math.round(n * 0.55), Math.round(n * 0.8)]) {
    const [x, y, , lg] = pts[i]
    const ww = wid(i)
    if (lg < ww) continue
    softEllipse(g, x - ww * 0.2, y + lg, ww * 1.6, ww * 0.35, p.umbra, p.dark ? 0.7 : 0.35)
    g.strokeStyle = rgba(mix(bam[2], p.umbra, 0.3))
    g.lineWidth = Math.max(1.2, ww * 0.24)
    g.beginPath()
    g.moveTo(x - ww * 0.8, y - ww * 0.15)
    g.lineTo(x + ww * 0.5, y + lg)
    g.moveTo(x + ww * 0.8, y - ww * 0.15)
    g.lineTo(x - ww * 0.5, y + lg)
    g.stroke()
    g.strokeStyle = rgba(p.dark ? mix(p.lantern, p.lo, 0.6) : mix(p.lo, p.lantern, 0.3), 0.8)
    g.lineWidth = Math.max(1, ww * 0.16)
    g.beginPath()
    g.moveTo(x - ww * 0.32, y + ww * 0.4)
    g.lineTo(x + ww * 0.32, y + ww * 0.4)
    g.stroke()
  }
  // the body: shadow side, the lit side toward the moon, the dark bore along the top
  for (const [col, k, off] of [[bam[2], 1, 0], [bam[1], 0.62, -0.12], [bam[0], 0.16, -0.3], [mix(bam[2], p.umbra, 0.55), 0.26, -0.2]] as [RGB, number, number][]) {
    g.strokeStyle = rgba(col)
    for (let i = 1; i < n; i++) {
      const ww = wid(i)
      g.lineWidth = Math.max(0.8, ww * k)
      g.beginPath()
      g.moveTo(pts[i - 1][0], pts[i - 1][1] + ww * off)
      g.lineTo(pts[i][0], pts[i][1] + ww * off)
      g.stroke()
    }
  }
  // nodes: a dark ring and its lit lip across the pipe
  let acc = 0
  for (let i = 1; i < n; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]
    const ww = wid(i)
    acc += Math.hypot(x1 - x0, y1 - y0)
    if (acc < ww * 4.5) continue
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
    g.moveTo(x1 - dx + ww * 0.12, y1 - dy)
    g.lineTo(x1 + dx + ww * 0.12, y1 + dy)
    g.stroke()
  }
  // the cut high end, its hollow
  const [ex, ey] = pts[0]
  const w = wid(0)
  g.fillStyle = rgba(mix(bam[2], p.umbra, 0.6))
  g.beginPath()
  g.ellipse(ex, ey, w * 0.32, w * 0.5, 0, 0, TAU)
  g.fill()
  g.strokeStyle = rgba(bam[0])
  g.lineWidth = Math.max(1, w * 0.1)
  g.stroke()
  g.restore()
}
