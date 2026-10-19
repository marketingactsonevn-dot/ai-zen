import './goal.css'
import { fill, h, nextId, s } from '../../core/dom'
import { blob, clamp, curve, onSize, rng, stableHeight, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist, moon, toro } from '../../ui/part2/paint'
import { diorama, type FloorGeo } from '../../ui/part2/depth'
import { findTakeaway, foldedTakeaway } from '../../ui/part2/takeaway'
import { guide, type Mark } from '../../ui/part2/guide'
import type { SceneCtx } from '../types'
import { C } from './shell'
import { f1, g13Defs, leafCloud, leafD, lines, mossBed } from './sumi'

/**
 * Scene 1 — a goal off by a hair (art direction §4 t37 `goal`): a proscenium stage seen low, at the paper gardener's
 * head height, pushed in so the sand and the stone path run off the foot of the frame. L0 a thick maple bough out of
 * focus entering the top-left corner (its own parallax layer, bokeh leaves), three wooden ema plaques hanging from it on
 * red cords, each one way of giving the order; a near stone bleeding off the bottom-left. L1 the paper gardener on
 * the path, folded paper, warm on the lamp side and cool on the moon side, his two shadows on the sand. L2 the great
 * maple in the left third, its long moon shadow raking the silver sand, the lantern and its warm pool, the gardener
 * dozing in it before a folding screen, the hut. L3 mist, far ranges, the moon setting in the west (left) and its
 * double in the pond. Drag a plaque into the paper gardener's sleeve (or tap / Enter): it reads, bows, and the night
 * passes in 2.2 s (the moon slides down, the maple's shadow sweeps the sand, the lamp burns out, dawn comes up in the
 * east, "next morning" is written in the sky with what the words did under it). The garden shows it: the maple felled
 * across the sand (`loose`), the moss scraped off (`better`), or the garden whole and the paper gardener at the door
 * with a stone, asking first (`best`). The dry branch stuck by the path turns time back. Low / reduced: a 200 ms
 * crossfade, no blur.
 */

const K = C.scenes.goal
type State = 'loose' | 'better' | 'best'
const NIGHT = 2.2
/** how far the stage runs on below the frame (share of its height): the sand goes on under the foot of the picture */
const BLEED = 0.16

/** The paper gardener, folded: straw hat, a head with its crease, kimono with a white collar and wide sleeves, obi,
 *  pleated hakama, sandals; the faces toward the lamp (right) warm, toward the moon (left) cool. Feet at (x, y), ~40 tall. */
export function paperMan(x: number, y: number, k = 1, shears = true): SVGGElement {
  const P = (dx: number, dy: number): Pt => [x + dx * k, y + dy * k]
  const poly = (...p: Pt[]) => `M${p.map(([a, b]) => `${a.toFixed(1)} ${b.toFixed(1)}`).join('L')}Z`
  const cold =
    poly(P(0, -34.2), P(-2.9, -32.4), P(-2.6, -29), P(0, -27.6)) + // head
    poly(P(-6.6, -27.4), P(-1.5, -27.3), P(0, -23.4), P(0, -19.4), P(-5.6, -19.4)) + // breast
    poly(P(-6.6, -27.4), P(-11.4, -24.6), P(-12.4, -14.8), P(-8.6, -14), P(-6.3, -20.4)) + // the open sleeve
    poly(P(-5.9, -16.8), P(0, -16.8), P(0, -0.4), P(-8.8, -0.6)) // hakama
  const warm =
    poly(P(0, -34.2), P(2.9, -32.4), P(2.6, -29), P(0, -27.6)) +
    poly(P(6.6, -27.4), P(1.5, -27.3), P(0, -23.4), P(0, -19.4), P(5.6, -19.4)) +
    poly(P(6.6, -27.4), P(10.6, -25.4), P(14.4, -19.8), P(12.2, -17.4), P(7.4, -21.2)) + // the arm reaching forward
    poly(P(5.9, -16.8), P(0, -16.8), P(0, -0.4), P(8.8, -0.6))
  const hatC = poly(P(-8.6, -32.6), P(0, -39.6), P(0, -32))
  const hatW = poly(P(8.6, -32.6), P(0, -39.6), P(0, -32))
  const edge =
    stroke([P(-8.6, -32.6), P(0, -39.6), P(8.6, -32.6)], 0.9 * k, 0.1, 0.1, 0.5) + stroke([P(-8.6, -32.6), P(0, -32), P(8.6, -32.6)], 0.8 * k, 0.1, 0.1, 0.5) +
    stroke([P(-2.9, -32.4), P(-2.6, -29), P(0, -27.6), P(2.6, -29), P(2.9, -32.4)], 0.7 * k, 0.1, 0.1, 0.5) +
    stroke([P(-6.6, -27.4), P(-11.4, -24.6), P(-12.4, -14.8), P(-8.6, -14)], 0.9 * k, 0.05, 0.1, 0.5) +
    stroke([P(6.6, -27.4), P(10.6, -25.4), P(14.4, -19.8)], 0.9 * k, 0.05, 0.1, 0.5) +
    stroke([P(-5.9, -16.8), P(-8.8, -0.6), P(8.8, -0.6), P(5.9, -16.8)], 1 * k, 0.05, 0.05, 0.5) +
    lines([[P(0, -16.8)[0], P(0, -16.8)[1], P(0, -0.6)[0], P(0, -0.6)[1]], [P(-3, -16.5)[0], P(-3, -16.5)[1], P(-4.6, -0.8)[0], P(-4.6, -0.8)[1]], [P(3, -16.5)[0], P(3, -16.5)[1], P(4.6, -0.8)[0], P(4.6, -0.8)[1]]], 0.55 * k, 0.1, 0.2)
  const collar = stroke([P(-1.6, -27.3), P(0.4, -23.6), P(1.8, -21)], 1.1 * k, 0.1, 0.4, 0.3) + stroke([P(1.6, -27.3), P(0, -24.6)], 1 * k, 0.1, 0.3, 0.3)
  const obi = poly(P(-5.8, -19.6), P(5.8, -19.6), P(5.9, -16.8), P(-5.9, -16.8))
  const sleeve = poly(P(-12.4, -14.8), P(-8.6, -14), P(-9, -15.6), P(-11.8, -16.2))
  const tool = shears
    ? stroke([P(13.4, -18.6), P(19.6, -27), P(23.2, -32.6)], 1.2 * k, 0.05, 0.7, 0.2) + stroke([P(13.4, -18.6), P(21, -25), P(25.6, -28.4)], 1.1 * k, 0.05, 0.7, 0.2) +
      stroke(curve(P(13.4, -18.6), P(10, -13.6), P(13.8, -12.6), 5), 0.9 * k, 0.2, 0.2, 0.4) + stroke(curve(P(13.4, -18.6), P(17.4, -13), P(15.4, -12), 5), 0.9 * k, 0.2, 0.2, 0.4)
    : ''
  return s('g', { class: 'g13-paper' },
    s('path', { class: 't37g-fold-cold', d: cold }),
    s('path', { class: 't37g-fold-warm', d: warm }),
    s('path', { class: 't37g-hat-c', d: hatC }),
    s('path', { class: 't37g-hat-w', d: hatW }),
    s('path', { class: 't37g-obi', d: obi }),
    s('path', { class: 't37g-sleeve-in', d: sleeve }),
    s('path', { class: 't37g-collar', d: collar }),
    s('path', { class: 'g13-ink t37g-edge', d: edge }),
    s('path', { class: 't37g-rim', d: stroke([P(-0.4, -39.2), P(-8, -32.9)], 0.8 * k, 0.2, 0.2, 0.3) + stroke([P(-11.2, -24.4), P(-12.2, -15.4)], 0.7 * k, 0.2, 0.2, 0.3) + stroke([P(-6, -16.4), P(-8.6, -1.2)], 0.7 * k, 0.2, 0.2, 0.3) }),
    s('path', { class: 't37g-sandal', d: blob(P(-4.2, -0.2)[0], P(-4.2, -0.2)[1], 2.6 * k, 0.9 * k, 3790, 0.1, 10) + blob(P(4.2, -0.2)[0], P(4.2, -0.2)[1], 2.6 * k, 0.9 * k, 3791, 0.1, 10) }),
    tool ? s('path', { class: 'g13-shears', d: tool }) : null)
}

/** the great maple in units (trunk foot at 0, 0; about 150 tall): the whole tree, and the stump it becomes */
function maple(): SVGGElement {
  const T = (pts: Pt[]) => pts.map(([x, y]) => [x - 86, y - 218] as Pt)
  const trunk = T(curve([86, 220], [76, 172], [98, 122], 16))
  // a rim hugging one side of the tapering trunk: side −1 west (moon), +1 east (lamp)
  const edgeOf = (pts: Pt[], side: number) => pts.slice(0, 13).map(([x, y], i) => {
    const t = i / 16
    return [x + side * 6 * Math.max(0.32, Math.min(1, (1 - t) / 0.45)), y] as Pt
  })
  const limbs =
    stroke(trunk, 12, 0.02, 0.45, 0.32) +
    stroke(T(curve([92, 152], [70, 130], [46, 120], 10)), 4.4, 0.05, 0.6, 0.2) +
    stroke(T(curve([96, 134], [122, 120], [148, 113], 10)), 4, 0.05, 0.6, 0.2) +
    stroke(T(curve([98, 124], [106, 102], [96, 84], 10)), 3.2, 0.05, 0.6, 0.2) +
    stroke(T(curve([90, 142], [72, 112], [66, 94], 10)), 2.8, 0.05, 0.6, 0.2) +
    stroke(T([[80, 220], [72, 222], [64, 221]]), 3, 0.1, 0.6, 0.3) + stroke(T([[92, 220], [101, 222], [110, 222]]), 2.6, 0.1, 0.6, 0.3) + // roots
    lines([[58, 122, 52, 108], [130, 117, 138, 101], [104, 98, 118, 88], [70, 104, 80, 92], [46, 120, 36, 116], [148, 113, 158, 116]].map(([a, b, c, d]) => [a - 86, b - 218, c - 86, d - 218]), 1.4, 0.1, 0.5)
  const crowns: [number, number, number, number, number][] = [[50, 112, 22, 11, 16], [80, 96, 26, 13, 20], [106, 84, 24, 11, 18], [134, 104, 24, 11, 18], [152, 114, 13, 7, 7], [72, 122, 16, 7, 9]].map(([x, y, a, b, n]) => [x - 86, y - 218, a, b, n])
  const canopy = crowns.map(([x, y, rx, ry, n], i) => leafCloud(x, y, rx, ry, Math.round(n * 1.8), 3.3, 3700 + i)).join('')
  const far = crowns.map(([x, y, rx, ry, n], i) => leafCloud(x - 3, y - 3, rx * 1.2, ry * 1.25, n, 3.6, 3730 + i)).join('')
  const dark = crowns.map(([x, y, rx, ry, n], i) => leafCloud(x + 2, y + 4, rx * 0.8, ry * 0.7, Math.round(n * 0.7), 3, 3720 + i)).join('')
  const rings = Array.from({ length: 5 }, (_, i) => `M${f1(-6.4 + i * 1.2)} -12a${f1(6.4 - i * 1.2)} ${f1(2.2 - i * 0.4)} 0 1 0 ${f1(12.8 - i * 2.4)} 0a${f1(6.4 - i * 1.2)} ${f1(2.2 - i * 0.4)} 0 1 0 ${f1(-12.8 + i * 2.4)} 0`).join('')
  return s('g', { class: 't37g-maple-art' },
    s('g', { class: 't37g-whole' },
      s('path', { class: 't37g-leaf-far', d: far }),
      s('path', { class: 'g13-ink t37g-trunk', d: limbs, filter: 'url(#ink-rough)' }),
      // the moon is low on the left: a cold rim down the trunk's west side, the lamp's warmth faint on its east
      s('path', { class: 't37g-trunk-lit', d: stroke(edgeOf(trunk, -0.72), 2.2, 0.15, 0.5, 0.2) }),
      s('path', { class: 't37g-trunk-warm', d: stroke(edgeOf(trunk, 0.7), 1.6, 0.3, 0.5, 0.2) }),
      s('path', { class: 't37g-leaf-dk', d: dark }),
      s('path', { class: 'g13-leaf', d: canopy })),
    // the stump left when the order only said "no leaves": a cut face with its rings, chips on the sand
    s('g', { class: 't37g-stump' },
      s('path', { class: 'g13-ink', d: stroke([[0, 1], [0.5, -12]], 14, 0, 0, 1) + lines([[-12, 2, -7, -2], [10, 1, 15, 3], [17, -6, 21, -7]], 1.8), filter: 'url(#ink-rough)' }),
      s('ellipse', { class: 't37g-cut', cx: 0.5, cy: -12, rx: 7.4, ry: 2.6 }),
      s('path', { class: 't37g-rings', d: rings }),
      s('path', { class: 't37g-chips', d: lines([[-20, 6, -15, 5], [22, 8, 27, 9], [12, 12, 16, 11], [-24, -1, -20, 0]], 1.6) })))
}

/** the felled maple lying across the sand, seen from the side: it fell east from its stump (the prop stands at the
 *  stump), the sawn end with its rings, bark lit by the moon along the top, limbs broken under it, the crown heaped red at
 *  the far end. hh = the trunk's thickness × 2.4 (px); everything else follows from it */
function felled(hh: number): SVGGElement {
  const R = hh * 0.42, len = hh * 7.2, cy = -R * 0.92
  const x0 = R * 0.9, x1 = x0 + len
  const r = rng(3786)
  const bark = stroke([[x0, cy], [x0 + len * 0.45, cy + R * 0.06], [x1, cy + R * 0.2]], R * 2, 0, 0.3, 0.5)
  let grain = ''
  for (let i = 0; i < 9; i++) {
    const y = cy - R * 0.7 + (i % 5) * R * 0.32 + r() * R * 0.1, a = x0 + R * 0.6 + r() * len * 0.5
    grain += stroke([[a, y], [a + len * (0.15 + r() * 0.25), y + R * 0.06]], Math.max(0.7, R * 0.06), 0.3, 0.3, 0.1)
  }
  const ring = (k: number) => `M${f1(x0 - R * 0.45 * k)} ${f1(cy)}a${f1(R * 0.45 * k)} ${f1(R * k)} 0 1 0 ${f1(R * 0.9 * k)} 0a${f1(R * 0.45 * k)} ${f1(R * k)} 0 1 0 ${f1(-R * 0.9 * k)} 0`
  // limbs: two snapped stubs on top, the crown's limbs splayed up and out at the far end
  const limbs =
    stroke([[x0 + len * 0.32, cy - R * 0.8], [x0 + len * 0.36, cy - R * 2.1]], R * 0.36, 0.05, 0.5, 0.4) +
    stroke([[x0 + len * 0.58, cy - R * 0.7], [x0 + len * 0.66, cy - R * 1.6]], R * 0.3, 0.05, 0.5, 0.4) +
    stroke(curve([x1 - R, cy], [x1 + len * 0.1, cy - hh * 1.1], [x1 + len * 0.16, cy - hh * 1.6], 10), R * 0.5, 0.05, 0.7, 0.2) +
    stroke(curve([x1 - R * 0.6, cy + R * 0.3], [x1 + len * 0.16, cy + R * 0.2], [x1 + len * 0.28, cy - hh * 0.3], 10), R * 0.42, 0.05, 0.7, 0.2) +
    stroke(curve([x1 - R * 2, cy - R * 0.6], [x1 + len * 0.02, cy - hh * 0.9], [x1 + len * 0.04, cy - hh * 1.9], 10), R * 0.34, 0.05, 0.7, 0.2)
  return s('g', { class: 't37g-felled-art' },
    s('ellipse', { class: 't37g-felled-sh', cx: f1(x0 + len * 0.55), cy: f1(R * 0.1), rx: f1(len * 0.62), ry: f1(R * 0.36) }),
    s('path', { class: 't37g-leaf-dk', d: leafScatter(x1 + len * 0.12, cy - hh * 0.5, len * 0.16, hh * 0.9, 40, Math.max(2.6, hh * 0.1), 3784) }),
    s('path', { class: 'g13-ink', d: limbs, filter: 'url(#ink-rough)' }),
    s('path', { class: 't37g-log', d: bark, filter: 'url(#ink-rough)' }),
    s('path', { class: 't37g-log-grain', d: grain }),
    s('path', { class: 't37g-log-lit', d: stroke([[x0 + R * 0.5, cy - R * 0.84], [x0 + len * 0.5, cy - R * 0.8], [x1 - R, cy - R * 0.64]], Math.max(1, R * 0.16), 0.1, 0.3, 0.2) }),
    s('ellipse', { class: 't37g-cut', cx: f1(x0), cy: f1(cy), rx: f1(R * 0.45), ry: f1(R) }),
    s('path', { class: 't37g-rings', d: ring(0.78) + ring(0.56) + ring(0.34) + ring(0.14) }),
    s('path', { class: 'g13-leaf', d: leafCloud(x1 + len * 0.14, cy - hh * 0.4, len * 0.2, hh * 1.1, 18, Math.max(2.8, hh * 0.11), 3785) + leafScatter(x1 + len * 0.14, cy - hh * 0.4, len * 0.22, hh * 1.2, 40, Math.max(2.4, hh * 0.09), 3787) }))
}

/** the dozing gardener: a robed mound, arm over his knees, the straw hat tipped over his face (feet at 0, 0; ~32 tall) */
function dozer(): SVGGElement {
  const X = (x: number) => x * 1.25, Y = (y: number) => y * 1.25
  const pt = (q: number[][]) => q.map(([a, b]) => [X(a), Y(b)] as Pt)
  const dz = (d: string) => d.replace(/(-?[\d.]+) (-?[\d.]+)/g, (_, a: string, b: string) => `${X(+a).toFixed(1)} ${Y(+b).toFixed(1)}`)
  return s('g', { class: 't37g-dozer' },
    s('path', { class: 't37g-robe', d: dz('M-10 0Q-12 -14 -6 -21Q0 -25 6 -22Q12 -17 12 -8Q13 -2 15 0Z'), filter: 'url(#ink-wash)' }),
    s('path', { class: 't37g-robe-warm', d: dz('M6 -22Q12 -17 12 -8Q13 -2 15 0L9 0Q8 -10 4 -20Z') }),
    s('path', { class: 'g13-ink', d:
      stroke(pt([[-9.5, 0], [-11.5, -12], [-6, -20.5]]), 2.6, 0.05, 0.3, 0.35) +
      stroke(pt([[-5, -17], [3, -11.5], [10.5, -14]]), 1.9, 0.1, 0.25, 0.35) +
      stroke(pt([[11, -12], [12.5, -5], [14.5, -0.5]]), 1.4, 0.15, 0.3, 0.35) +
      stroke(pt([[-8, -0.6], [3, -0.2], [14, -0.6]]), 1, 0.2, 0.2, 0.3), filter: 'url(#ink-rough)' }),
    s('path', { class: 't37g-hat', d: dz('M-11.5 -19.5Q1 -25.5 13.5 -23.5L13 -21.8Q1 -22.5 -11 -17.8ZM-6.5 -20.8Q-1.5 -28.8 1 -30Q4 -28.5 8.5 -23Z'), filter: 'url(#ink-rough)' }),
    s('path', { class: 't37g-hat-rib', d: lines([[X(0.8), Y(-29), X(-3.5), Y(-21.5)], [X(1.4), Y(-29), X(5), Y(-22.8)]], 0.6) }))
}

/** a four-leaf folding screen behind the sleeper; once the lesson is told it shows two small wordless pictures */
function screen(): SVGGElement {
  const leaves = [[-30, -40, -15, -44], [-15, -44, 0, -40], [0, -40, 15, -44], [15, -44, 30, -40]]
  return s('g', { class: 't37g-screen' },
    ...leaves.map(([x0, t0, x1, t1], i) => s('path', { class: `t37g-panel p${i % 2}`, d: `M${x0} 0L${x0} ${t0}L${x1} ${t1}L${x1} 0Z` })),
    s('path', { class: 'g13-ink', d: lines([[-30, 0, -30, -40], [-15, 0, -15, -44], [0, 0, 0, -40], [15, 0, 15, -44], [30, 0, 30, -40]], 0.9) }),
    // a red block flipped on its back atop a blue one (the reward read "the red block's base is high")
    s('g', { class: 't37g-pics' },
      s('rect', { class: 't37g-blue', x: -25, y: -14, width: 9, height: 7 }),
      s('rect', { class: 't37g-red', x: -24.5, y: -21, width: 8, height: 7, transform: 'rotate(180 -20.5 -17.5)' }),
      s('path', { class: 't37g-flip', d: 'M-12 -22q3 -4 0 -8' }),
      // a little boat going round and round instead of to the finish
      s('ellipse', { class: 't37g-wake', cx: 13, cy: -22, rx: 9, ry: 5 }),
      s('path', { class: 't37g-boat', d: 'M16 -18.5h6l-1.5 2h-3z' }),
      s('path', { class: 't37g-flag', d: 'M25 -34v8M25 -34l4 1.5l-4 1.5' })))
}

/** the gardener's hut: thatch with its thickness and dark eave, a door, a window that lights when the paper gardener
 *  knocks (foot at 0, 0; 100 wide, 64 tall) */
function hut(): SVGGElement {
  let straw = ''
  for (let i = 0; i < 14; i++) {
    const t = i / 13, x = -46 + t * 92
    straw += stroke([[x * 0.2, -60 + Math.abs(t - 0.5) * 18], [x, -31]], 0.8, 0.2, 0.3, 0.2)
  }
  return s('g', { class: 't37g-hut' },
    s('path', { class: 't37g-wall', d: 'M-38 0V-32H38V0Z' }),
    s('path', { class: 't37g-wall-sh', d: 'M-38 0V-32H-14V0Z' }),
    s('path', { class: 't37g-eave-sh', d: 'M-38 -32H38V-26Q0 -24 -38 -26Z' }),
    s('rect', { class: 't37g-door', x: -26, y: -27, width: 13, height: 27 }),
    s('rect', { class: 't37g-win', x: 14, y: -24, width: 15, height: 11 }),
    s('path', { class: 'g13-ink', d: lines([[21.5, -24, 21.5, -13], [14, -18.5, 29, -18.5]], 0.8) }),
    s('path', { class: 't37g-thatch', d: 'M-52 -30Q-30 -52 0 -64Q30 -52 52 -30Q48 -26 40 -28Q20 -40 0 -46Q-20 -40 -40 -28Q-48 -26 -52 -30Z', filter: 'url(#ink-wash)' }),
    s('path', { class: 't37g-thatch-under', d: 'M-52 -30Q-48 -26 -40 -28Q-20 -38 0 -43Q20 -38 40 -28Q48 -26 52 -30Q46 -24 38 -25Q0 -30 -38 -25Q-46 -24 -52 -30Z' }),
    s('path', { class: 't37g-straw', d: straw }),
    s('path', { class: 't37g-thatch-rim', d: stroke(curve([-50, -31], [-28, -54], [0, -63], 12), 1.6, 0.1, 0.4, 0.2) }),
    s('path', { class: 'g13-ink', d: stroke(curve([-52, -30], [0, -72], [52, -30], 16), 2, 0.1, 0.1, 0.4) + lines([[-38, 0, -38, -30], [38, 0, 38, -30], [-40, 0, 40, 0]], 1.4), filter: 'url(#ink-rough)' }))
}

/** a basket with the scraped moss rolled up in it */
function basket(): SVGGElement {
  return s('g', { class: 't37g-basket' },
    s('path', { class: 't37g-moss-roll', d: blob(-4, -13, 9, 5, 371, 0.25) + blob(6, -12, 7, 4.5, 372, 0.25) }),
    s('path', { class: 't37g-weave', d: 'M-14 -10L-11 0H11L14 -10Z' }),
    s('path', { class: 'g13-ink', d: lines([[-14, -10, 14, -10], [-12.5, -5, 12.5, -5]], 0.8) + stroke([[-14, -10], [-11, 0], [11, 0], [14, -10]], 1.1, 0.1, 0.1, 0.4) }))
}

/** a dry branch stuck upright in the sand: the way back to last night (foot at 0, 0; ~60 tall) */
function dryBranch(): SVGGElement {
  return s('g', { class: 't37g-dry' },
    s('path', { class: 'g13-ink', d: stroke(curve([0, 0], [-2, -30], [3, -58], 10), 2.4, 0.05, 0.6, 0.3) + stroke(curve([-1, -24], [-10, -34], [-14, -42], 6), 1.2, 0.05, 0.6, 0.2) + stroke(curve([1, -38], [9, -44], [12, -52], 6), 1, 0.05, 0.6, 0.2), filter: 'url(#ink-rough)' }),
    s('path', { class: 't37g-dryleaf', d: leafD(-14, -43, 2.6, 160) + leafD(12, -53, 2.2, -20) }))
}

/** n small maple leaves scattered in an ellipse: one star polygon each (the brushed leafD is kept for the big ones) */
function leafScatter(cx: number, cy: number, rx: number, ry: number, n: number, size: number, seed: number): string {
  const r = rng(seed)
  let d = ''
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, k = Math.sqrt(r()), x = cx + Math.cos(a) * rx * k, y = cy + Math.sin(a) * ry * k
    const R = size * (0.7 + r() * 0.6), t0 = r() * Math.PI * 2
    d += 'M' + Array.from({ length: 10 }, (_, j) => {
      const t = t0 + (j / 10) * Math.PI * 2, q = j % 2 ? R * 0.42 : R * (j === 0 ? 1 : 0.8)
      return `${f1(x + Math.cos(t) * q)} ${f1(y + Math.sin(t) * q * 0.62)}`
    }).join('L') + 'Z'
  }
  return d
}

/** a figure's shadow laid on the sand (top view): feet at (x, y), stretched `len` along unit (ux, uy), `w` wide */
function lyingShadow(x: number, y: number, ux: number, uy: number, len: number, w: number, seed: number): string {
  const P = (t: number, side: number): Pt => [x + ux * len * t - uy * w * side, y + uy * len * t + ux * w * side]
  return stroke([P(0, 0), P(0.35, 0.05), P(0.82, 0)], w, 0.06, 0.12, 0.35) + blob(...P(0.9, 0), w * 0.75, w * 0.5, seed, 0.2, 12)
}

/** where each piece stands (x across the near view, z 0 near … 1 far; w, h shares of the stage height) */
type Spot = [number, number, number, number]
type Plan = { maple: Spot; toro: Spot; dozer: Spot; screen: Spot; man: Spot; hut: Spot; man2: Spot; basket: Spot; dry: Spot; log: Spot; pond: [number, number]; moon: [number, number, number] }
const WIDE: Plan = {
  maple: [0.02, 0.42, 0.3, 1.5], toro: [0.59, 0.5, 0.1, 0.37], dozer: [0.73, 0.54, 0.12, 0.12], screen: [0.8, 0.6, 0.14, 0.19],
  man: [0.32, 0.36, 0.12, 0.33], hut: [1.2, 0.78, 0.22, 0.38], man2: [1.1, 0.74, 0.08, 0.22], basket: [0.19, 0.3, 0.08, 0.08],
  dry: [0.46, 0.18, 0.05, 0.18], log: [0.04, 0.435, 0.02, 0.12], pond: [-0.2, 0.62], moon: [0.1, 0.35, 0.045],
}
const TALL: Plan = {
  maple: [-0.03, 0.45, 0.4, 1.7], toro: [0.5, 0.5, 0.12, 0.28], dozer: [0.68, 0.56, 0.14, 0.1], screen: [0.77, 0.62, 0.16, 0.15],
  man: [0.21, 0.3, 0.16, 0.26], hut: [1.18, 0.8, 0.3, 0.31], man2: [1.06, 0.76, 0.1, 0.18], basket: [-0.04, 0.3, 0.1, 0.07],
  dry: [0.4, 0.16, 0.06, 0.16], log: [-0.01, 0.465, 0.02, 0.13], pond: [0.62, 0.62], moon: [0.78, 0.15, 0.055],
}

/** the floor in top view: the path, its leaves, moss and scraped earth, the pond, light and shadow on the sand */
function floorArt(f: FloorGeo, L: Plan, H: number): SVGElement[] {
  const W = f.at(1, 0)[0] - f.at(0, 0)[0] // floor px across the near view
  const r = rng(3701)
  const A = (x: number, z: number) => f.at(x, z)
  const at = (p: Spot | [number, number]) => A(p[0], p[1])
  // the moon is low in the west behind the maple: shadows run right and toward you
  const ux = 0.86, uy = 0.5
  // the path: from under your feet, past the paper gardener, round to the lantern
  const [mx0] = at(L.man), [tx, ty] = at(L.toro)
  const ctrl: Pt[] = [A(L.dry[0] + 0.02, -0.02), A(L.dry[0] - 0.01, 0.12), A((mx0 / W + L.toro[0]) / 2.1, 0.3), A(L.toro[0] - 0.05, L.toro[1] - 0.06), [tx - W * 0.02, ty + W * 0.004]]
  const pts: Pt[] = []
  for (let i = 0; i < 11; i++) {
    const t = i / 10, j = Math.min(3, Math.floor(t * 4)), u = t * 4 - j
    pts.push([ctrl[j][0] + (ctrl[j + 1][0] - ctrl[j][0]) * u, ctrl[j][1] + (ctrl[j + 1][1] - ctrl[j][1]) * u])
  }
  const kids: SVGElement[] = []
  let side = '', face = '', rim = '', hi = ''
  pts.forEach(([x, y], i) => {
    const rx = W * (0.05 - i * 0.0026) * (0.85 + r() * 0.3), ry = rx * (0.68 + r() * 0.15)
    side += blob(x, y + ry * 0.32, rx, ry, 3710 + i, 0.1, 16)
    face += blob(x, y, rx, ry, 3710 + i, 0.1, 16)
    const arc = (a0: number, k: number): Pt[] => Array.from({ length: 9 }, (_, q) => {
      const a = Math.PI * (a0 + q * 0.06)
      return [x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k]
    })
    rim += stroke(arc(1.05, 0.86), Math.max(1.5, rx * 0.1), 0.3, 0.3, 0.1)
    hi += stroke(arc(1.6, 0.8), Math.max(1.2, rx * 0.07), 0.3, 0.3, 0.1)
  })
  const mossAt: [number, number, number][] = [[L.maple[0] + 0.1, L.maple[1] - 0.03, 0.1], [L.toro[0] + 0.06, L.toro[1] - 0.1, 0.07], [L.man[0] - 0.12, L.man[1] - 0.12, 0.05], [L.dozer[0] + 0.03, L.dozer[1] - 0.04, 0.05]]
  // the pond under the moon: its bank, the water, the moon's double and its broken road
  const [qx, qy] = at(L.pond)
  const qd = blob(qx, qy, W * 0.13, W * 0.07, 3750, 0.06)
  let road = ''
  for (let i = 0; i < 9; i++) {
    const t = i / 8, y = qy - W * 0.03 + t * W * 0.08, l = W * (0.01 + t * 0.03) * (0.6 + r() * 0.6)
    road += stroke([[qx + W * 0.005 - l / 2, y], [qx + W * 0.005 + l / 2, y + 0.5]], 1.2 + t * 2.4, 0.3, 0.3, 0.1)
  }
  // shadows: the maple's long one, the paper gardener's two (moon, lamp), the lantern's
  const [fx, fy] = at(L.maple)
  const ph = L.man[3] * H, th = L.toro[3] * H
  const [px, py] = at(L.man)
  kids.push(
    // silver sand: the low moon's sheen raking in from the left, brightest near the pond
    s('ellipse', { class: 't37g-sheen', cx: f1(qx + W * 0.25), cy: f1(qy + W * 0.04), rx: f1(W * 0.9), ry: f1(W * 0.2) }),
    s('g', { class: 't37g-moss' }, ...mossAt.map(([x, z, k], i) => {
      const [cx, cy] = A(x, z)
      return mossBed(cx, cy, W * k, W * k * 0.5, 3720 + i)
    })),
    s('g', { class: 't37g-scraped' }, ...mossAt.map(([x, z, k], i) => {
      const [cx, cy] = A(x, z)
      return s('path', { class: 't37g-earth', d: blob(cx, cy, W * k, W * k * 0.45, 3730 + i, 0.3), filter: 'url(#ink-wash)' })
    })),
    s('path', { class: 't37g-bank', d: blob(qx + W * 0.006, qy + W * 0.008, W * 0.15, W * 0.085, 3751, 0.06), filter: 'url(#ink-wash)' }),
    s('path', { class: 'g13-water', d: qd }),
    s('path', { class: 't37g-road', d: road }),
    s('ellipse', { class: 't37g-refl', cx: f1(qx + W * 0.005), cy: f1(qy - W * 0.02), rx: f1(W * 0.024), ry: f1(W * 0.012) }),
    s('path', { class: 'p2p-ripple', d: [0.04, 0.07, 0.1].map((k) => stroke(curve([qx - W * k, qy + W * 0.01], [qx, qy + W * k * 0.35], [qx + W * k, qy + W * 0.01], 8), 1, 0.3, 0.3, 0.1)).join('') }),
    // the maple's long moon shadow raking the sand, the crown's dapple at its end; the night sweeps it round
    s('g', { class: 't37g-mshadow', style: `transform-origin:${f1(fx)}px ${f1(fy)}px` },
      s('path', { class: 't37g-sh t37g-sh-maple', d: stroke([[fx, fy], [fx + ux * W * 0.3, fy + uy * W * 0.3], [fx + ux * W * 0.62, fy + uy * W * 0.62]], W * 0.03, 0.02, 0.2, 0.4) }),
      s('path', { class: 't37g-sh t37g-sh-crown', d: blob(fx + ux * W * 0.82, fy + uy * W * 0.82, W * 0.2, W * 0.08, 3740, 0.35) + blob(fx + ux * W * 0.7, fy + uy * W * 0.6, W * 0.1, W * 0.05, 3741, 0.4) }),
      s('path', { class: 't37g-dapple', d: Array.from({ length: 16 }, (_, i) => blob(fx + ux * W * (0.66 + r() * 0.3) + (r() - 0.5) * W * 0.14, fy + uy * W * (0.7 + r() * 0.2) + (r() - 0.5) * W * 0.05, W * 0.012, W * 0.006, 3742 + i, 0.3, 10)).join('') })),
    // the lamp's warm pool on the sand round the lantern, reaching the paper gardener and the sleeper
    s('ellipse', { class: 't37g-pool', cx: f1(tx), cy: f1(ty + W * 0.01), rx: f1(W * 0.3), ry: f1(W * 0.14) }),
    s('ellipse', { class: 't37g-pool core', cx: f1(tx), cy: f1(ty + W * 0.004), rx: f1(W * 0.13), ry: f1(W * 0.055), fill: 'url(#g13-sun)' }),
    s('path', { class: 't37g-sh t37g-sh-man', d: lyingShadow(px, py, ux, uy, ph * 1.9, ph * 0.2, 3743) }),
    s('path', { class: 't37g-sh t37g-sh-lamp', d: lyingShadow(px, py, -0.94, -0.34, ph * 0.9, ph * 0.22, 3744) }),
    s('path', { class: 't37g-sh', d: lyingShadow(tx, ty, ux, uy, th * 1.5, th * 0.18, 3745) }),
    s('path', { class: 'p2d-shadow t37g-pathsh', d: side, opacity: 0.35 }),
    s('path', { class: 'p2d-side', d: side }),
    s('path', { class: 'p2d-face', d: face, filter: 'url(#ink-rough)' }),
    s('path', { class: 'p2d-rim', d: rim }),
    s('path', { class: 't37g-step-warm', d: hi }),
    // the last leaf drifting into the moon's double (only once the maple is gone)
    s('g', { class: 't37g-drift', style: `transform-origin:${f1(qx)}px ${f1(qy)}px` }, s('path', { class: 'g13-leaf', d: leafD(qx - W * 0.04, qy + W * 0.01, W * 0.009, 40) })))
  // fallen leaves over the path (gone by morning in every version: it was the order)
  kids.push(s('g', { class: 't37g-leaves' }, s('path', { class: 'g13-leaf', d: pts.map(([x, y], i) => leafScatter(x, y, W * 0.05, W * 0.03, 10 - (i >> 1), W * 0.007, 3760 + i)).join('') + leafScatter(...A(L.maple[0] + 0.18, L.maple[1] - 0.12), W * 0.1, W * 0.05, 18, W * 0.007, 3770) })))
  // the felled crown's leaves spilled wide over the sand
  const [lx, ly] = at(L.log), ll = L.log[3] * H * 7.6
  kids.push(s('g', { class: 't37g-felled' }, s('path', { class: 'g13-leaf', d: leafScatter(lx + ll * 1.05, ly + W * 0.03, W * 0.2, W * 0.07, 60, W * 0.008, 3781) + leafScatter(lx + ll * 0.5, ly + W * 0.05, ll * 0.5, W * 0.03, 26, W * 0.007, 3782) })))
  return kids
}

export function goalScene(ctx: SceneCtx) {
  g13Defs()
  const low = ctx.quality === 'low' || ctx.reduced
  const stable = stableHeight(ctx, [K.insight])
  const card = findTakeaway(C.takeaways[0])
  const root = h('div', { class: `t37g${low ? ' still' : ''}` })
  const stageEl = h('div', { class: 't37g-stage' })
  const sky = h('div', { class: 't37g-sky', 'aria-hidden': 'true' })
  const morning = h('p', { class: 't37g-morning', 'aria-hidden': 'true' }, K.morning)
  const fore = s('svg', { class: 't37g-fore', 'aria-hidden': 'true' })
  const foreEl = h('div', { class: 't37g-l0' }, fore)
  const bough = s('svg', { class: 't37g-bough', 'aria-hidden': 'true' })
  const boughEl = h('div', { class: 't37g-lb' }, bough)
  const emas = h('div', { class: 't37g-emas', role: 'group', 'aria-label': K.group })
  const caption = h('div', { class: 't37g-caption', hidden: true })
  const kept = h('div', { class: 't37g-kept', hidden: true })
  // who the paper gardener is, said once where it stands (audit 37-1)
  const legend = h('p', { class: 't37g-legend' }, K.legend)
  root.append(h('p', { class: 'visually-hidden' }, K.art), stageEl, sky, foreEl, boughEl, emas, morning, caption, kept, legend)
  ctx.art.append(root)
  ctx.prompt(K.prompt)
  const g = guide(ctx)
  let retryDot: Mark | null = null

  // ── the stage: L3 / L2 / L1 as a diorama (backdrop flats, the floor in true perspective, cut-outs standing on it)
  const P = { maple: 0, toro: 1, dozer: 2, screen: 3, man: 4, hut: 5, man2: 6, basket: 7, dry: 8, log: 9 }
  const tallAtMount = ctx.art.clientHeight > ctx.art.clientWidth
  const L = tallAtMount ? TALL : WIDE
  root.classList.toggle('tall', tallAtMount)
  const prop = ([x, z, w, hh]: Spot, art: (w: number, h: number) => SVGElement, ring = false) => ({ x, z, w, h: hh, shadow: 0, ring, art })
  let stageH = 0
  const d = diorama(ctx, stageEl, {
    seed: 37,
    strength: 1.6,
    layers: [
      { depth: 1, art: (g) => [s('g', { class: 't37g-moon' }, moon(g.w * L.moon[0], g.h * L.moon[1], Math.min(g.w, g.h) * L.moon[2], 3702, true))] },
      { depth: 0.8, art: (g) => [mist(g.w * 0.5, g.horizon - g.h * 0.1, g.w * 0.8, g.h * 0.14), hills(-g.w * 0.15, g.w * 1.15, g.horizon, g.h * 0.26, 3703, 0.9, 5)] },
      { depth: 0.4, art: (g) => [hills(-g.w * 0.2, g.w * 0.5, g.horizon, g.h * 0.12, 3704, 0.55, 2), hills(g.w * 0.62, g.w * 1.25, g.horizon, g.h * 0.1, 3705, 0.6, 2), mist(g.w * 0.5, g.horizon - g.h * 0.01, g.w * 0.9, g.h * 0.045)] },
    ],
    floor: { stones: 0, art: (f) => floorArt(f, L, (stageH = stageEl.clientHeight)) },
    props: [
      prop(L.maple, (_w, hh) => s('g', { transform: `scale(${f1(hh / 150)})` }, maple())),
      prop(L.toro, (_w, hh) => toro(0, 0, hh, true)),
      prop(L.dozer, (_w, hh) => s('g', { transform: `scale(${f1(hh / 32)})` }, dozer())),
      prop(L.screen, (_w, hh) => s('g', { transform: `scale(${f1(hh / 44)})` }, screen())),
      prop(L.man, (_w, hh) => s('g', { class: 't37g-man' }, paperMan(0, 0, hh / 40))),
      prop(L.hut, (_w, hh) => s('g', { transform: `scale(${f1(hh / 64)})` }, hut())),
      prop(L.man2, (_w, hh) => s('g', { class: 't37g-asker' }, paperMan(0, 0, hh / 40, false), s('g', { transform: `translate(${f1(hh * 0.36)} ${f1(-hh * 0.42)})` }, stoneArt(hh * 0.26, hh * 0.17, 3790)))),
      prop(L.basket, (_w, hh) => s('g', { transform: `scale(${f1(hh / 22)})` }, basket())),
      prop(L.dry, (_w, hh) => s('g', { transform: `scale(${f1(hh / 60)})` }, dryBranch())),
      prop(L.log, (_w, hh) => felled(hh)),
    ],
  })
  const props = d.props
  const cls = ['maple', 'toro', 'dozer', 'screen', 'man', 'hut', 'man2', 'basket', 'dry', 'log']
  props.forEach((p, i) => p.classList.add(`t37g-p-${cls[i]}`))
  // the dry branch is a button laid over the branch (the diorama redraws its props, so it lives in the overlay)
  const retry = h('button', { class: 't37g-retry', type: 'button', 'aria-label': K.retry, onClick: reset }, h('span', { class: 't37g-retry-label', 'aria-hidden': 'true' }, K.retry))
  root.append(retry)
  retry.hidden = true
  const placeRetry = () => {
    if (retry.hidden) return
    const a = props[P.dry].getBoundingClientRect(), b = root.getBoundingClientRect()
    Object.assign(retry.style, { left: `${f1(a.left - b.left - 12)}px`, top: `${f1(a.top - b.top - 12)}px`, width: `${f1(a.width + 24)}px`, height: `${f1(a.height + 24)}px` })
  }

  // ── L0: the near stone and its leaves bleeding off the bottom-left; the bough, out of focus, entering the top-left
  // corner on a layer of its own; the plaques hang from it on red cords
  let hooks: Pt[] = []
  /** floor y (px in the frame) of the sand at depth z, the same sums as depth.ts: for the plaques' shadows */
  const floorY = (z: number) => {
    const Hs = stageH || root.clientHeight * (1 + BLEED), Wn = root.clientWidth
    const Pp = Math.round(Math.max(Hs * 1.25, Wn * 0.65)), hy = Math.round(Hs * 0.3)
    return hy + ((Hs - hy) * Pp) / (Pp + Pp * 1.6 * z * 0.9)
  }
  function drawFore() {
    const W = root.clientWidth, H = root.clientHeight
    if (W < 40 || H < 40) return
    const t = tallAtMount
    const H0 = H * (1 + BLEED)
    fore.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H0)}`)
    const r = rng(3799)
    // the near stone at the foot, half out of the frame, a few red leaves on it and on the sand
    const sw = t ? W * 0.62 : clamp(W * 0.24, 220, 380), sh = t ? H * 0.12 : clamp(H * 0.17, 80, 140)
    fore.replaceChildren(
      s('g', { class: 't37g-l0-stone', transform: `translate(${f1(t ? W * 0.02 : W * 0.03)} ${f1(H * 1.08)})` }, stoneArt(sw, sh, 3798)),
      s('path', { class: 't37g-l0-leaf near', d: leafCloud(W * 0.07, H * 0.99, sw * 0.32, H * 0.03, 9, Math.min(W, H) * 0.024, 3797) + leafCloud(sw * 0.62, H * 1.04, sw * 0.2, H * 0.02, 5, Math.min(W, H) * 0.02, 3796) }))
    // the bough: thick at the corner, tapering across the top, bokeh where its leaves are (1.4× nearer than the maple)
    // the bough's layer covers only the top of the frame: its blur is rastered over that band, not the whole picture
    bough.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H * 0.44)}`)
    const end: Pt = t ? [W * 0.64, -H * 0.02] : [W * 0.88, -H * 0.03]
    const line = curve([-W * 0.05, t ? H * 0.17 : H * 0.26], t ? [W * 0.3, H * 0.02] : [W * 0.36, H * 0.02], end, 30)
    const thick = t ? W * 0.11 : clamp(H * 0.085, 36, 64)
    let twigs = ''
    const tips: Pt[] = []
    for (const u of [0.22, 0.4, 0.58, 0.74, 0.9]) {
      const [x, y] = line[Math.round(u * 30)]
      const tip: Pt = [x + thick * (0.8 + r()), y + thick * (0.5 + r() * 0.8)]
      twigs += stroke([[x, y], [(x + tip[0]) / 2, (y + tip[1]) / 2 - thick * 0.1], tip], thick * (0.26 - u * 0.12), 0.05, 0.7, 0.2)
      tips.push(tip)
    }
    let leaves = '', bokeh: SVGElement[] = []
    for (const [x, y] of [line[3], line[8], ...tips]) {
      leaves += leafCloud(x, y + thick * 0.2, thick * 1.1, thick * 0.6, 5, thick * 0.32, Math.round(r() * 1e4))
      for (let i = 0; i < 3; i++) {
        const R = thick * (0.28 + r() * 0.42)
        bokeh.push(s('circle', { class: `t37g-bokeh${r() < 0.3 ? ' warm' : ''}`, cx: f1(x + (r() - 0.5) * thick * 2.4), cy: f1(y + (r() - 0.2) * thick * 1.4), r: f1(R) }))
      }
    }
    bough.replaceChildren(
      s('path', { class: 't37g-bough-wood', d: stroke(line, thick, 0.0, 0.85, 0.12) + twigs }),
      s('path', { class: 't37g-bough-rim', d: stroke(line.map(([x, y]) => [x - thick * 0.08, y - thick * 0.3] as Pt).slice(0, 22), thick * 0.14, 0.05, 0.6, 0.2) }),
      ...bokeh,
      s('path', { class: 't37g-bough-leaf', d: leaves }))
    // where the plaques hang (wide: from the bough's far half, staggered; tall: a short chain low on the right)
    hooks = t ? [0, 1, 2].map((i) => [W * 0.69, H * (0.4 + i * 0.205)] as Pt) : [0.6, 0.74, 0.88].map((u, i) => [line[Math.round(u * 30)][0], H * [0.12, 0.2, 0.15][i]] as Pt)
    layoutEmas(line)
  }

  // ── the ema plaques: wooden boards on red cords, buttons you can drag into the paper gardener's sleeve
  const state: { picked: State | null; busy: boolean } = { picked: null, busy: false }
  const tilt = [-3.2, 2.4, -1.4], depth = [1, 0.94, 0.97]
  const btns = K.options.map((o, i) => {
    const b = h('button', { class: 't37g-ema', type: 'button', 'data-opt': o.id, 'aria-label': fill(K.optionAria, { say: o.say }), style: `--i:${i};--tilt:${tilt[i]}deg;--k:${depth[i]}` },
      h('span', { class: 't37g-ema-cord', 'aria-hidden': 'true' }),
      h('span', { class: 't37g-ema-board' },
        h('span', { class: 't37g-ema-edge', 'aria-hidden': 'true' }),
        h('span', { class: 't37g-ema-face' }, h('span', { class: 't37g-ema-text' }, o.say)),
        h('span', { class: 't37g-ema-knot', 'aria-hidden': 'true' })))
    b.addEventListener('pointerdown', (e) => down(e, i))
    b.addEventListener('click', () => !dragged && pick(i))
    emas.append(b)
    return b
  })
  const emaSh = s('svg', { class: 't37g-ema-sh', 'aria-hidden': 'true' })
  const shId = nextId('t37g-sh')
  emas.prepend(emaSh)
  function layoutEmas(line: Pt[]) {
    const t = tallAtMount
    const W = root.clientWidth, H = root.clientHeight
    const w = t ? Math.min(W * 0.56, 230) : clamp(W * 0.135, 172, 214)
    const sh: SVGElement[] = []
    btns.forEach((b, i) => {
      const [x, y] = hooks[i] ?? [0, 0]
      b.style.width = `${f1(w)}px`
      b.style.left = `${f1(x - w / 2)}px`
      b.style.top = `${f1(y)}px`
      // the cord runs up to the bough (wide) or to the plaque above (tall)
      const top = t ? (i ? hooks[i - 1][1] + 40 : H * 0.3) : line[Math.round([0.6, 0.74, 0.88][i] * 30)][1]
      b.style.setProperty('--cord', `${f1(Math.max(14, y - top))}px`)
      // its soft shadow on the sand below and to the right (the moon is low in the west)
      const fy = floorY(t ? 0.22 + i * 0.05 : 0.3 + i * 0.04)
      sh.push(s('ellipse', { cx: f1(x + w * 0.22), cy: f1(fy), rx: f1(w * 0.55), ry: f1(w * 0.09), fill: `url(#${shId})` }))
    })
    emaSh.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H * (1 + BLEED))}`)
    emaSh.replaceChildren(s('defs', null, s('radialGradient', { id: shId }, s('stop', { offset: 0, class: 't37g-shstop', 'stop-opacity': 1 }), s('stop', { offset: 1, class: 't37g-shstop', 'stop-opacity': 0 }))), ...sh)
    emas.classList.toggle('chain', t)
  }

  let dragged = false
  let drag: { i: number; id: number; x: number; y: number } | null = null
  const off = { x: 0, y: 0 }
  function down(e: PointerEvent, i: number) {
    if (state.busy || state.picked || e.button !== 0) return
    dragged = false
    drag = { i, id: e.pointerId, x: e.clientX, y: e.clientY }
    btns[i].setPointerCapture(e.pointerId)
  }
  const target = () => props[P.man].getBoundingClientRect()
  emas.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y
    if (!dragged && Math.hypot(dx, dy) < 6) return
    dragged = true
    const b = btns[drag.i]
    b.classList.add('drag')
    off.x = dx
    off.y = dy
    b.style.transform = `translate(${f1(dx)}px, ${f1(dy)}px) rotate(${f1(clamp(dx * 0.03, -8, 8))}deg)`
    const t = target(), over = e.clientX > t.left - 40 && e.clientX < t.right + 40 && e.clientY > t.top - 50 && e.clientY < t.bottom + 30
    root.classList.toggle('over', over)
  })
  const up = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return
    const i = drag.i
    drag = null
    const b = btns[i]
    b.classList.remove('drag')
    if (!dragged) return
    const t = target(), over = e.clientX > t.left - 40 && e.clientX < t.right + 40 && e.clientY > t.top - 50 && e.clientY < t.bottom + 30
    root.classList.remove('over')
    if (over) pick(i)
    else (b.style.transform = ''), (off.x = off.y = 0)
    setTimeout(() => (dragged = false))
  }
  emas.addEventListener('pointerup', up)
  emas.addEventListener('pointercancel', up)

  // ── the order given: it reads, bows, the night passes, and the garden shows what the words did
  let told = false
  const timers: number[] = []
  ctx.onCleanup(() => timers.forEach(clearTimeout))
  const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms))
  function pick(i: number) {
    if (state.busy || state.picked) return
    const o = K.options[i]
    state.busy = true
    btns.forEach((b, j) => b.setAttribute('aria-pressed', String(i === j)))
    // the plaque flies into the sleeve
    const b = btns[i]
    if (!low) {
      const t = target(), r = b.getBoundingClientRect()
      b.style.transform = `translate(${f1(off.x + t.left + t.width * 0.3 - r.left - r.width / 2)}px, ${f1(off.y + t.top + t.height * 0.6 - r.top - r.height / 2)}px) scale(0.12) rotate(-12deg)`
    }
    off.x = off.y = 0
    b.classList.add('given')
    root.classList.add('reading')
    const done = () => {
      root.classList.remove('reading', 'night')
      root.dataset.state = o.id
      state.picked = o.id as State
      state.busy = false
      emas.classList.add('gone')
      caption.hidden = false
      caption.dataset.ok = String(o.ok)
      caption.replaceChildren(h('p', { class: 't37g-res' }, o.result))
      caption.setAttribute('aria-live', 'polite')
      kept.hidden = !(o.ok && card)
      // the card to keep once the order is right: a folded slip, opened by a touch (it never covers the garden by itself)
      if (o.ok && card) kept.replaceChildren(foldedTakeaway([card], ctx.onCleanup))
      retry.hidden = false
      placeRetry()
      // the insight only once the visitor has seen a morning go wrong (audit 37-1: never before the evidence); until
      // then, and after a careless order, the dry branch rewinds the night
      if (!o.ok && !told) {
        told = true
        root.classList.add('told')
        ctx.insight(K.insight, K.detail)
      }
      if (!told || !o.ok) {
        ctx.prompt(o.ok ? K.tryLoose : K.rewind)
        retryDot ??= g.dot(retry, { dir: [0, -1] })
        g.refresh()
      }
    }
    if (low) {
      root.classList.add('morning')
      return later(done, 200)
    }
    later(() => root.classList.add('night'), 700)
    later(() => root.classList.add('morning'), 700 + NIGHT * 1000 * 0.75)
    later(done, 700 + NIGHT * 1000)
  }
  /** the dry branch: back to last night */
  function reset() {
    if (state.busy || !state.picked) return
    delete root.dataset.state
    root.classList.remove('morning')
    state.picked = null
    emas.classList.remove('gone')
    btns.forEach((b) => (b.classList.remove('given'), (b.style.transform = ''), b.setAttribute('aria-pressed', 'false')))
    caption.hidden = kept.hidden = true
    retry.hidden = true
    retryDot?.done()
    retryDot = null
    ctx.prompt(K.again)
    btns[0].focus()
  }

  // parallax: the bough swings most (±18/±8 px), the near stone and the plaques a little less; the diorama turns ±1.6°
  const onMove = (e: PointerEvent) => {
    if (low || e.pointerType !== 'mouse') return
    const r = root.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width - 0.5) * 2, y = ((e.clientY - r.top) / r.height - 0.5) * 2
    boughEl.style.transform = `translate(${f1(-x * 18)}px, ${f1(-y * 8)}px)`
    foreEl.style.transform = `translate(${f1(-x * 12)}px, ${f1(-y * 6)}px)`
    emas.style.transform = `translate(${f1(-x * 9)}px, ${f1(-y * 4)}px)`
  }
  root.addEventListener('pointermove', onMove)
  ctx.onCleanup(onSize(ctx.art, () => {
    root.style.height = `${Math.max(240, stable(ctx.art.clientHeight))}px`
    drawFore()
    placeRetry()
  }))
}
