import { fill, h, s } from '../../core/dom'
import { blob, curve, rng, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist, moon, wash } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import { C } from './shell'
import { inkSheet, leafD, rakeRings } from './sumi'
import { HOLES, LEAK, RR, YAW0 } from './fence-plan'

/**
 * The fence scene without WebGL (art direction §4 t37 `fence`, "Low / no WebGL"): the same six rings in a 3/4 ink
 * painting. Posts carry a moonlit edge and a dark body, every ring a soft shadow band, the fireflies rest where the 3D
 * wave would leave them, and a fixed red thread runs through the one slit that survives all six. Static SVG; the build
 * button and the layer card sit in a side panel.
 */
const K = C.scenes.fence
const N = K.layers.length
const FLIES = 20
const CX = 200, CY = 206
const FLAT = 0.62
/** metres → painting units */
const U = 46 / RR[0]
/** seen from the 3D scene's first view: azimuth YAW0 is the front */
const at = (a: number, R: number): Pt => [CX + Math.sin(a - YAW0) * R, CY + Math.cos(a - YAW0) * R * FLAT]

/** one ring: far half (behind the sapling) and near half (in front), posts with a lit edge, two rails, a shadow band */
function ring(k: number): [SVGGElement, SVGGElement] {
  const r = rng(80 + k)
  const R = RR[k] * U
  const hw = 0.3 / RR[k]
  const holes = HOLES[k].slice().sort((a, b) => a - b)
  const half = { far: { posts: '', lit: '', rails: '', shade: '' }, near: { posts: '', lit: '', rails: '', shade: '' } }
  const side = (a: number) => (Math.cos(a - YAW0) < 0 ? half.far : half.near)
  for (let i = 0; i < 3; i++) {
    const a0 = holes[i] + hw, a1 = (i < 2 ? holes[i + 1] : holes[0] + Math.PI * 2) - hw
    const H = (a: number) => (9 + ((Math.cos(a - YAW0) + 1) / 2) * 8) * (1 + k * 0.05)
    // rails, split where the ring crosses its widest point so each piece lands in its half
    let run: { far: boolean; pts: [Pt[], Pt[], Pt[]] } | null = null
    const flush = () => {
      if (!run || run.pts[0].length < 2) return
      const sd = run.far ? half.far : half.near
      sd.rails += stroke(run.pts[0], 1.5, 0.1, 0.1, 0.5) + stroke(run.pts[1], 1.3, 0.1, 0.1, 0.5)
      sd.shade += stroke(run.pts[2], 3.2, 0.2, 0.2, 0.2)
    }
    for (let a = a0; a <= a1 + 1e-6; a += 0.05) {
      const [x, y] = at(a, R)
      const hh = H(a)
      const far = Math.cos(a - YAW0) < 0
      if (!run || run.far !== far) (flush(), (run = { far, pts: [[], [], []] }))
      run.pts[0].push([x, y - hh * 0.4])
      run.pts[1].push([x, y - hh * 0.75])
      // the shadow band thrown away from the moon (west, painting left): down-right on the sand
      run.pts[2].push([x + 4, y + 2.5])
    }
    flush()
    const n = Math.max(1, Math.round(((a1 - a0) * RR[k]) / 0.27))
    for (let j = 0; j <= n; j++) {
      const a = a0 + ((a1 - a0) * j) / n
      const [x, y] = at(a, R)
      const hh = H(a) * (j === 0 || j === n ? 1.15 : 1)
      const w = 1.5 + ((Math.cos(a - YAW0) + 1) / 2) * 1.3
      const lean = (r() - 0.5) * 0.8
      side(a).posts += stroke([[x, y + 1], [x + lean, y - hh]], w, 0.05, 0.08, 0.6)
      // the moonlit edge, on the moon's (left) side
      side(a).lit += stroke([[x - w * 0.32, y - 1], [x - w * 0.32 + lean, y - hh + 1]], Math.max(0.5, w * 0.3), 0.1, 0.2, 0.3)
    }
  }
  const part = (p: typeof half.far, cls: string) =>
    s('g', { class: `t37ff-ring ${cls}` },
      s('path', { class: 't37ff-shade', d: p.shade }),
      s('path', { class: 't37ff-post', d: p.posts, filter: 'url(#ink-rough)' }),
      s('path', { class: 't37ff-lit', d: p.lit }),
      s('path', { class: 't37ff-rail', d: p.rails }))
  return [part(half.far, 'far'), part(half.near, 'near')]
}

/** where firefly i rests once k rings stand: on the sapling's leaves, or just outside the ring that stopped it */
function spot(i: number, k: number): Pt {
  const a = (i * 137.5 * Math.PI) / 180
  if (i < LEAK[k]) return [CX + Math.cos(a) * (8 + (i % 4) * 4), CY - 30 - (i % 5) * 3 + Math.sin(a) * 5]
  let m = 0
  while (i < LEAK[m + 1]) m++
  const [x, y] = at(a, RR[m] * U + 9 + (i % 3) * 3)
  return [x, y - 8 - (i % 4) * 4]
}

/** Draws into `host` (the 3D stage's box); returns its cleanup. */
export function fenceFlat(ctx: SceneCtx, host: HTMLElement): () => void {
  const { svg: sheet, layer: svg } = inkSheet('t37-svg', '0 10 400 330')
  const panel = h('div', { class: 't37ff-panel' })
  const root = h('div', { class: 't37ff' }, h('div', { class: 't37ff-stage' }, sheet), panel)
  host.append(root)
  const rings = K.layers.map((_, k) => ring(k))
  const flies = Array.from({ length: FLIES }, () => s('circle', { class: 't37ff-fly', r: 2.2 }))
  const sapling = s('g', null,
    s('path', { class: 'g13-ink', d: stroke(curve([CX, CY + 2], [CX - 4, CY - 18], [CX + 2, CY - 38], 10), 3, 0.02, 0.5, 0.35) + stroke(curve([CX - 1, CY - 20], [CX - 8, CY - 26], [CX - 14, CY - 28], 6), 1.2, 0.05, 0.6, 0.2) + stroke(curve([CX + 1, CY - 28], [CX + 8, CY - 32], [CX + 12, CY - 38], 6), 1.1, 0.05, 0.6, 0.2), filter: 'url(#ink-rough)' }),
    s('path', { class: 't37ff-leaf', d: leafD(CX - 15, CY - 29, 6, -20) + leafD(CX + 13, CY - 40, 5.5, 25) + leafD(CX + 2, CY - 42, 6.5, 0) + leafD(CX - 6, CY - 34, 4, -40) }))
  // the one line through every ring: from the near edge, through the slit, to the sapling
  const [sx, sy] = at(HOLES[N - 1][0], RR[N - 1] * U + 60)
  const thread = s('path', { class: 't37ff-thread', d: stroke([[sx, sy - 8], [CX, CY - 12]], 1.4, 0.05, 0.05, 0.5) })
  svg.append(
    mist(200, 70, 280, 56),
    moon(52, 58, 14, 3730, true),
    hills(-30, 430, 108, 54, 3731, 0.9, 6),
    hills(-20, 170, 116, 34, 3732, 0.62, 2),
    mist(200, 112, 280, 18),
    s('path', { class: 'g13-rake', d: rakeRings(CX, CY + 2, 44, 236, 11, FLAT, 3733, 1.1) }),
    wash(blob(CX + 3, CY + 4, 40, 15, 3734, 0.16), 0.55, 'p2p-wash g13-moss'),
    s('g', { transform: `translate(${CX + 26} ${CY + 9})` }, stoneArt(22, 13, 3736)),
    grass(CX - 26, CY + 8, 12, 3737),
    ...rings.map(([far]) => far),
    sapling,
    thread,
    ...rings.map(([, near]) => near),
    s('g', { transform: 'translate(46 318)' }, stoneArt(34, 18, 3738)),
    s('g', { transform: 'translate(356 312)' }, stoneArt(26, 14, 3739)),
    ...flies)

  let built = 0
  const count = h('p', { class: 't37ff-count' })
  const leak = h('p', { class: 't37ff-leak' })
  const add = h('button', { class: 'btn primary t37ff-add', type: 'button', onClick: next })
  const info = h('div', { class: 't37ff-info' })
  panel.append(count, h('p', null, leak, ' ', ctx.tag('illustration')), add, info)
  let told = false

  function draw() {
    rings.forEach((g, k) => g.forEach((p) => p.classList.toggle('on', k < built)))
    flies.forEach((f, i) => {
      const [x, y] = spot(i, built)
      f.setAttribute('cx', x.toFixed(1))
      f.setAttribute('cy', y.toFixed(1))
    })
    thread.classList.toggle('on', built > 0)
    count.textContent = fill(K.count, { n: built })
    leak.textContent = fill(K.leak, { n: LEAK[built] })
    const nl = K.layers[built]
    add.textContent = nl ? `${K.add} · ${nl.name}` : K.reset
    add.setAttribute('aria-label', nl ? fill(K.addAria, { name: nl.name }) : K.reset)
  }
  function next() {
    if (built >= N) {
      built = 0
      info.replaceChildren()
      return draw()
    }
    const L = K.layers[built++]
    draw()
    info.replaceChildren(
      h('h3', { class: 't37ff-name' }, `${built}. ${L.name}`),
      h('p', null, L.what),
      ...(L.fact ? [ctx.fact(L.fact, 'p', 't37ff-fact')] : []),
      ...(L.station ? [h('a', { class: 't37-link', href: `#/tram/${L.station}` }, fill(K.seeStation, { n: L.station }))] : []))
    info.setAttribute('aria-live', 'polite')
    if (built === N && !told) (ctx.insight(K.insight, K.detail), (told = true))
  }
  draw()
  return () => root.remove()
}
