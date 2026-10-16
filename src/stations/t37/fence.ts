import { fill, h, s } from '../../core/dom'
import { blob, curve, rng, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist, moon, wash } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import { C, shell } from './shell'
import { leafD, rakeRings } from './sumi'

const K = C.scenes.fence
const N = K.layers.length
const FLIES = 20
/** fireflies still reaching the sapling after k layers (illustration: every layer stops some, none stops all) */
const LEAK = [20, 11, 6, 4, 2, 1, 1]
const CX = 200, CY = 206
const ringR = (k: number) => 46 + k * 23
const FLAT = 0.62

/**
 * One ring of yotsume-gaki round the sapling: bamboo posts (taller and heavier toward the viewer) and two rails,
 * broken by three gaps at their own angles. Split in a far half (behind the sapling) and a near half (in front).
 */
function ring(k: number): [SVGGElement, SVGGElement] {
  const r = rng(80 + k)
  const R = ringR(k)
  const gaps = [0, 1, 2].map((i) => (i * 120 + r() * 80) * (Math.PI / 180))
  const gap = 0.36
  const at = (a: number): [number, number, number] => {
    const y = CY + Math.sin(a) * R * FLAT
    const near = (Math.sin(a) + 1) / 2
    return [CX + Math.cos(a) * R, y, (9 + near * 8) * (1 + k * 0.05)]
  }
  const half = { far: { posts: '', rails: '' }, near: { posts: '', rails: '' } }
  for (let i = 0; i < 3; i++) {
    const a0 = gaps[i] + gap / 2, a1 = (i < 2 ? gaps[i + 1] : gaps[0] + Math.PI * 2) - gap / 2
    // rails: split where the ring crosses its widest point, so each part lands in its half
    let run: { far: boolean; pts: [Pt[], Pt[], Pt[]] } | null = null
    const flush = () => {
      if (run && run.pts[0].length > 1) {
        const side = run.far ? half.far : half.near
        side.rails += stroke(run.pts[0], 1.5, 0.1, 0.1, 0.5) + stroke(run.pts[1], 1.3, 0.1, 0.1, 0.5) + stroke(run.pts[2], 1.2, 0.1, 0.1, 0.5)
      }
    }
    for (let a = a0; a <= a1 + 1e-6; a += 0.05) {
      const [x, y, hh] = at(a)
      const far = Math.sin(a) < 0
      if (!run || run.far !== far) {
        flush()
        run = { far, pts: [[], [], []] }
      }
      run.pts[0].push([x, y - hh * 0.3])
      run.pts[1].push([x, y - hh * 0.62])
      run.pts[2].push([x, y - hh * 0.92])
    }
    flush()
    for (let a = a0 + 0.04; a < a1; a += (21 + r() * 5) / R) {
      const [x, y, hh] = at(a)
      const w = 1.5 + ((Math.sin(a) + 1) / 2) * 1.3
      ;(Math.sin(a) < 0 ? half.far : half.near).posts += stroke([[x, y + 1], [x + (r() - 0.5) * 0.8, y - hh]], w, 0.05, 0.08, 0.6)
    }
  }
  const part = (p: { posts: string; rails: string }, cls: string) =>
    s('g', { class: `t37f-ring ${cls}`, style: `transform-origin:${CX}px ${CY}px` },
      s('path', { class: 't37f-post', d: p.posts, filter: 'url(#ink-rough)' }),
      s('path', { class: 't37f-rail', d: p.rails }))
  return [part(half.far, 'far'), part(half.near, 'near')]
}

/** Where firefly i rests once k layers stand: at the sapling, or just outside the ring that stopped it. */
function spot(i: number, k: number): [number, number] {
  const a = (i * 137.5 * Math.PI) / 180
  let R = 16 + (i % 5) * 7
  let up = 14 + ((i * 7) % 5) * 7 // fireflies near the sapling hover round its crown
  if (i >= LEAK[k]) {
    let m = 0
    while (i < LEAK[m + 1]) m++
    R = ringR(m) + 9 + (i % 3) * 3
    up = 6 + (i % 4) * 4
  }
  return [CX + Math.cos(a) * R, CY - up + Math.sin(a) * R * FLAT]
}

/** Scene 3 — six bamboo fences, each holed somewhere else; fewer fireflies reach the sapling with every layer. */
export function fenceScene(ctx: SceneCtx) {
  const { root, svg, panel } = shell(ctx, 't37f', K.art, [K.insight], '0 10 400 330')
  const rings = K.layers.map((_, k) => ring(k))
  const flies = Array.from({ length: FLIES }, () => s('g', { class: 't37f-fly' }, s('circle', { class: 'glow', r: 7, fill: 'url(#g13-ember)' }), s('circle', { class: 'core', r: 1.9 })))
  flies.forEach((f, i) => f.style.setProperty('--d', `${(i % 7) * 0.4}s`))
  // the sapling: a young maple on a moss island, three green dabs of leaves
  const sapling = s('g', { class: 't37f-sap' },
    s('path', { class: 'g13-ink', d: stroke(curve([CX, CY + 2], [CX - 4, CY - 18], [CX + 2, CY - 38], 10), 3, 0.02, 0.5, 0.35) + stroke(curve([CX - 1, CY - 20], [CX - 8, CY - 26], [CX - 14, CY - 28], 6), 1.2, 0.05, 0.6, 0.2) + stroke(curve([CX + 1, CY - 28], [CX + 8, CY - 32], [CX + 12, CY - 38], 6), 1.1, 0.05, 0.6, 0.2), filter: 'url(#ink-rough)' }),
    s('path', { class: 't37f-leaf', d: leafD(CX - 15, CY - 29, 6, -20) + leafD(CX + 13, CY - 40, 5.5, 25) + leafD(CX + 2, CY - 42, 6.5, 0) + leafD(CX - 6, CY - 34, 4, -40) }))
  svg.append(
    mist(200, 70, 280, 56),
    moon(344, 52, 14, 3730, true),
    hills(-30, 430, 108, 54, 3731, 0.9, 6),
    hills(-20, 170, 116, 34, 3732, 0.62, 2),
    mist(200, 112, 280, 18),
    // raked sand in rings round the island, like ripples spreading on water
    s('path', { class: 'g13-rake', d: rakeRings(CX, CY + 2, 44, 150, 11, FLAT, 3733, 1.2) }),
    s('path', { class: 'g13-rake t37f-rake-out', d: rakeRings(CX, CY + 4, 162, 236, 13, FLAT, 3741, 1) }),
    wash(blob(CX + 3, CY + 4, 40, 15, 3734, 0.16), 0.55, 'p2p-wash g13-moss'),
    wash(blob(CX + 6, CY + 7, 36, 8, 3735, 0.16), 0.3),
    s('g', { transform: `translate(${CX + 26} ${CY + 9})` }, stoneArt(22, 13, 3736)),
    grass(CX - 26, CY + 8, 12, 3737),
    ...rings.map(([far]) => far),
    sapling,
    ...rings.map(([, near]) => near),
    s('g', { transform: 'translate(46 318)' }, stoneArt(34, 18, 3738)),
    s('g', { transform: 'translate(356 312)' }, stoneArt(26, 14, 3739)),
    grass(372, 316, 16, 3740),
    ...flies)

  let built = 0
  const count = h('p', { class: 't37f-count' })
  const leak = h('p', { class: 't37f-leak' })
  const add = h('button', { class: 'btn primary t37f-add', type: 'button', onClick: next })
  const info = h('div', { class: 't37f-info' })
  const list = h('ol', { class: 't37f-list' })
  panel.append(h('div', { class: 't37f-meter' }, count, h('span', null, leak, ' ', ctx.tag('illustration'))), add, info, list)
  let live = false
  let told = false

  function draw() {
    rings.forEach((g, k) => g.forEach((p) => p.classList.toggle('on', k < built)))
    flies.forEach((f, i) => {
      const [x, y] = spot(i, built)
      f.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
      f.classList.toggle('in', i < LEAK[built])
    })
    count.textContent = fill(K.count, { n: built })
    leak.textContent = fill(K.leak, { n: LEAK[built] })
    const nextL = K.layers[built]
    add.textContent = nextL ? `${K.add} · ${nextL.name}` : K.reset
    add.setAttribute('aria-label', nextL ? fill(K.addAria, { name: nextL.name }) : K.reset)
    root.dataset.built = String(built)
  }
  function next() {
    if (built >= N) {
      built = 0
      info.replaceChildren()
      list.replaceChildren()
      draw()
      return
    }
    const L = K.layers[built]
    built++
    draw()
    info.replaceChildren(
      h('h3', { class: 't37f-name' }, `${built}. ${L.name}`),
      h('p', { class: 't37f-what' }, L.what),
      ...(L.fact ? [ctx.fact(L.fact, 'p', 't37f-fact')] : []),
      ...(L.station ? [h('a', { class: 't37-link', href: `#/tram/${L.station}` }, fill(K.seeStation, { n: L.station }))] : []))
    list.append(h('li', null, L.name))
    if (!live) (info.setAttribute('aria-live', 'polite'), (live = true))
    if (built === N && !told) (ctx.insight(K.insight, K.detail), (told = true))
  }
  draw()
  ctx.prompt(K.prompt)
}
