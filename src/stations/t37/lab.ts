import './lab.css'
import { h, s } from '../../core/dom'
import { sliced } from '../../core/chunk'
import { blob, clamp, onSize, rng, stableHeight, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist, moon, pine, wash } from '../../ui/part2/paint'
import { guide, type Mark } from '../../ui/part2/guide'
import type { SceneCtx } from '../types'
import { C } from './shell'
import { bamboo, f1, g13Defs, lines, mossBed } from './sumi'

/**
 * Scene 2 — the sealed test room (art direction §4 t37 `lab`; audit 37-2 "the bamboo blind"): the corner of a tea house
 * in true CSS 3D (preserve-3d, perspective ≈1100 px), seen from a fixed 35° (30° in a tall frame) so the lit shōji and
 * the side garden are in view together. On the shōji (a 10 × 10 kumiko lattice) the paper gardener's shadow kneels
 * upright before the test table: the AI in the test room. Out in the garden the low moon behind the house corner lays
 * its second shadow long on the moss, on the main path where the stone path forks. A bamboo blind hangs rolled over the
 * shōji: pull its handle down (or the arrow keys) and the room is no longer watched — the shadow on the paper, seen
 * through the slats, stays upright; the one outside turns down the other path. The first time: look at the two
 * shadows, then the insight, then the three ways of testing get their names (the stack of papers on the table, a
 * vermilion sleeve prying at a shōji cell, a bearer at the gate with a lantern on a pole); the box sealed with red tape
 * on the veranda is a separate story (Astra), told by the company itself.
 * Low: changes are instant.
 */

const K = C.scenes.lab

/** a kneeling figure in shadow (feet at 0, 0; ≈ 34 tall) */
const KNEEL = 'M-1 -40a6 6.4 0 1 0 0.1 0zM-9 -30Q-1 -34 7 -30Q11 -18 12 -3Q13 0 10 1H-12Q-14 0 -13 -4Q-11 -18 -9 -30Z'

/** flat stones laid on the gravel: a contact shadow toward you, the stone's thickness, a rough top, a moonlit far rim,
 *  moss in the joints. pts in ground units, size(i) its half-width */
function stepStones(pts: Pt[], size: (i: number) => number, seed: number): SVGGElement {
  const r = rng(seed)
  let sh = '', side = '', face = '', rim = '', moss = ''
  pts.forEach(([x, y], i) => {
    const rx = size(i) * (0.85 + r() * 0.3), ry = rx * (0.62 + r() * 0.16)
    sh += blob(x + rx * 0.06, y + ry * 0.42, rx * 1.12, ry * 1.05, seed + i * 3, 0.08, 14)
    side += blob(x, y + ry * 0.24, rx, ry, seed + i, 0.1, 16)
    face += blob(x, y, rx, ry, seed + i, 0.1, 16)
    rim += stroke(Array.from({ length: 9 }, (_, q) => {
      const a = Math.PI * (1.08 + q * 0.105)
      return [x + Math.cos(a) * rx * 0.9, y + Math.sin(a) * ry * 0.9] as Pt
    }), Math.max(1.4, rx * 0.09), 0.3, 0.3, 0.1)
    for (let k = 0; k < 5; k++) {
      const a = r() * Math.PI * 2
      moss += blob(x + Math.cos(a) * rx * 1.06, y + Math.sin(a) * ry * 1.08, rx * (0.08 + r() * 0.1), ry * 0.12, seed + i * 7 + k, 0.3, 8)
    }
  })
  return s('g', { class: 't37l-stones' },
    s('path', { class: 't37l-stone-sh', d: sh }),
    s('path', { class: 't37l-stone-side', d: side }),
    s('path', { class: 't37l-stone', d: face, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
    s('path', { class: 't37l-stone-rim', d: rim }),
    s('path', { class: 't37l-stone-moss', d: moss }))
}

export function labScene(ctx: SceneCtx) {
  g13Defs()
  // low: the same view, every change instant
  const still = ctx.quality === 'low'
  const tallAtMount = ctx.art.clientHeight > ctx.art.clientWidth
  const stable = stableHeight(ctx, [K.insight])

  // ── the house and garden, drawn once in plane units (100 = one u); layout only sizes the planes. Heavy brushwork is
  // passed as a thunk and painted in slices after mount (sliced), so the scene mounts without a long task.
  type Kid = SVGElement | string | null | (() => SVGElement)
  const later: [SVGSVGElement, () => SVGElement, Node | null][] = []
  const fillIn = (svg: SVGSVGElement, kids: Kid[]) => {
    for (const k of kids) {
      if (typeof k !== 'function') k && svg.append(k)
      else {
        const mark = document.createComment('')
        svg.append(mark)
        later.push([svg, k, mark])
      }
    }
    return svg
  }
  const plane = (cls: string, w: number, hh: number, ...kids: Kid[]) =>
    h('div', { class: `t37l-plane ${cls}`, style: `--w:${w};--h:${hh}` }, fillIn(s('svg', { viewBox: `0 0 ${w * 100} ${hh * 100}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' }), kids))
  const G = (x: number, z: number): Pt => [(x + 9) * 100, (z + 6) * 100]

  // the ground: 16 u across (x −9…7), 12 deep (z −6…6), gravel (the plane's own background) with moss in it.
  // Two stone paths: one from your feet to the veranda, one round the fence's end to a fork in the side garden, where it
  // splits: the main way to the gate, the other way off into the dark under the bamboo.
  const fork = G(2.5, -1.2)
  const frontLine = [G(-1.3, 5.8), G(-1.6, 4.3), G(-1.3, 2.9), G(-1.0, 1.55)]
  const mainLine = [G(0.5, 1.6), G(2.3, 1.3), G(3.2, 0.4), G(2.9, -0.5), fork, G(2.85, -2.4), G(3.25, -3.3)]
  const sideLine = [fork, G(3.8, -2.0), G(4.8, -2.9), G(5.7, -3.9)]
  const front = stonesPath(frontLine, 5)
  const main = stonesPath(mainLine, 11)
  const side = stonesPath(sideLine, 5).slice(1)
  // the shadow lies head-first along a path from the fork: its angle (svg degrees) for the main path and for the other
  const along = ([x, y]: Pt) => Math.atan2(x - fork[0], -(y - fork[1])) * (180 / Math.PI)
  const onMain = along(G(3.25, -3.3)), turn = along(G(5.7, -3.9)) - onMain
  const ground = plane('t37l-ground', 16, 12,
    () => s('g', { class: 't37l-mossbeds' }, ...([[1.4, -0.6, 1.3, 0.7], [4.2, -0.7, 1.6, 0.8], [2.0, -3.0, 1.4, 0.8], [5.2, -3.4, 1.5, 0.9], [-6.2, 1.6, 1.6, 0.8], [-5.2, -1.2, 1.2, 0.6], [3.6, 2.4, 1.4, 0.7]] as const).map(([x, z, a, b], i) => mossBed(...G(x, z), a * 100, b * 100, 3722 + i))),
    // raked gravel lanes under the stones: the paths read as paths, the fork as a fork
    s('path', { class: 't37l-lane', d: stroke(frontLine, 95, 0.06, 0.1, 0.7) + stroke(mainLine, 92, 0.04, 0.12, 0.6) + stroke(sideLine, 84, 0.04, 0.4, 0.35) }),
    // the house's own shadow toward you (the moon is low behind it), and the fence's along its foot
    wash(blob(...G(-2, 1.6), 260, 110, 3727, 0.12), 0.34, 'p2p-wash t37l-cast'),
    s('path', { class: 't37l-cast t37l-fencefoot', d: blob(...G(1.5, 0.55), 150, 22, 3726, 0.15) }),
    // the lamp's warm spill from the shōji onto the gravel in front
    s('ellipse', { class: 't37l-spill', cx: G(-2, 1.5)[0], cy: G(-2, 1.5)[1], rx: 260, ry: 130 }),
    () => stepStones(front, (i) => 30 + i * 3, 3728),
    () => stepStones(main, (i) => 32 - i * 1.4, 3729),
    () => stepStones(side, (i) => 26 - i * 2.2, 3730),
    // the second shadow: from the fork it lies along the main path toward the gate, or turns down the other one
    () => s('g', { class: 't37l-second', style: `transform-origin:${fork[0]}px ${fork[1]}px;--turn:${f1(turn)}deg` },
      s('path', { class: 't37l-shadow2', d: longShadow(fork, onMain, 640) })),
    // where the other path goes: into the dark under the bamboo
    wash(blob(...G(6.1, -4.3), 190, 90, 3734, 0.2), 0.5, 'p2p-wash t37l-cast'))

  // the front: a lit shōji in a dark frame, the kumiko lattice, the kneeling shadow, the table and its papers
  let lattice = ''
  for (let i = 1; i < 10; i++) lattice += `M${40 + i * 32} 30V250M40 ${30 + i * 22}H360`
  const frontWall = plane('t37l-front', 4, 2.6,
    s('rect', { class: 't37l-paper', x: 40, y: 30, width: 320, height: 220 }),
    s('rect', { class: 't37l-glow', x: 40, y: 30, width: 320, height: 220 }),
    s('path', { class: 't37l-shadow', d: KNEEL, transform: 'translate(170 246) scale(2.7)', filter: 'url(#ink-wash)' }),
    s('path', { class: 't37l-shadow', d: 'M212 196h90v8h-90zM222 204v42M292 204v42M236 178h44v18h-44zM240 172h36v6h-36z', filter: 'url(#ink-wash)' }),
    s('path', { class: 't37l-lattice', d: lattice }),
    // the cell the red sleeve is working at: its paper torn
    s('path', { class: 't37l-tear', d: 'M74 140l10 -6l9 5l5 -4l4 8l-7 6l-12 -2z' }),
    s('path', { class: 't37l-frame', d: 'M0 0H400V260H0ZM34 24V256H366V24Z', 'fill-rule': 'evenodd' }),
    // under the eave the top of the wall is in deep shade
    s('rect', { class: 't37l-eaveshade', width: 400, height: 34 }),
    s('path', { class: 'g13-ink', d: lines([[200, 30, 200, 250]], 4) + lines([[34, 24, 366, 24], [34, 256, 366, 256], [34, 24, 34, 256], [366, 24, 366, 256]], 3), filter: 'url(#ink-rough)' }))
  // the side: plaster, a low barred window, dark (the light is all on the front); the moon behind rims its far edge
  const sideWall = plane('t37l-side', 3, 2.6,
    s('rect', { class: 't37l-plaster', width: 300, height: 260 }),
    s('rect', { class: 't37l-plaster-sh', width: 300, height: 260 }),
    s('rect', { class: 't37l-eaveshade', width: 300, height: 40 }),
    s('rect', { class: 't37l-win', x: 120, y: 120, width: 90, height: 60 }),
    s('path', { class: 't37l-rimlight', d: stroke([[296, 40], [297, 258]], 5, 0.1, 0.1, 0.4) }),
    s('path', { class: 'g13-ink', d: lines([[135, 120, 135, 180], [150, 120, 150, 180], [165, 120, 165, 180], [180, 120, 180, 180], [195, 120, 195, 180]], 1.6) + lines([[0, 0, 0, 260], [300, 0, 300, 260], [0, 2, 300, 2], [0, 258, 300, 258], [118, 118, 212, 118], [118, 182, 212, 182]], 3), filter: 'url(#ink-rough)' }))

  // the roof: hipped, 35° pitch, laid with round kawara tiles (columns of lit crests and dark troughs, courses across);
  // the front slope a trapezoid, the side slope a triangle; moonlight along the ridge and down the hips
  const tiles = (w: number, shape: string, id: string) => {
    let trough = '', crest = '', course = ''
    for (let x = 9; x < w; x += 19) {
      trough += `M${x} 0V293`
      crest += `M${x + 7} 0V293`
    }
    for (let y = 280; y > 0; y -= 21) course += `M0 ${y}${Array.from({ length: Math.ceil(w / 19) }, () => 'q9.5 4 19 0').join('')}`
    return s('g', null,
      s('defs', null, s('clipPath', { id }, s('path', { d: shape }))),
      s('g', { 'clip-path': `url(#${id})` },
        s('path', { class: 't37l-trough', d: trough }),
        s('path', { class: 't37l-crest', d: crest }),
        s('path', { class: 't37l-course', d: course })))
  }
  const uid = `t37l${Math.round(Math.random() * 1e6)}`
  const FS = 'M0 293L240 0H340L580 293Z', SS = 'M0 293L240 0L480 293Z'
  const roofF = plane('t37l-roof-f', 5.8, 2.93,
    s('path', { class: 't37l-tiles-bg', d: FS }),
    () => tiles(580, FS, `${uid}f`),
    s('path', { class: 't37l-roof-lit', d: FS }),
    s('path', { class: 'g13-ink', d: stroke([[0, 287], [580, 287]], 13, 0.03, 0.03, 0.5) + stroke([[2, 292], [240, 2]], 6, 0.1, 0.1, 0.4) + stroke([[578, 292], [340, 2]], 6, 0.1, 0.1, 0.4) + stroke([[240, 2], [340, 2]], 9, 0.1, 0.1, 0.4), filter: 'url(#ink-rough)' }),
    s('path', { class: 't37l-ridge-rim', d: stroke([[236, 6], [344, 6]], 4, 0.1, 0.1, 0.4) + stroke([[345, 8], [570, 282]], 4, 0.05, 0.4, 0.2) + stroke([[235, 8], [80, 196]], 2.4, 0.05, 0.6, 0.2) }))
  const roofS = plane('t37l-roof-s', 4.8, 2.93,
    s('path', { class: 't37l-tiles-bg', d: SS }),
    () => tiles(480, SS, `${uid}s`),
    s('path', { class: 't37l-roof-sh', d: SS }),
    s('path', { class: 'g13-ink', d: stroke([[0, 287], [480, 287]], 13, 0.03, 0.03, 0.5) + stroke([[2, 292], [240, 2], [478, 292]], 6, 0.1, 0.1, 0.4), filter: 'url(#ink-rough)' }),
    s('path', { class: 't37l-ridge-rim', d: stroke([[244, 8], [470, 282]], 4.6, 0.05, 0.3, 0.2) + stroke([[236, 8], [12, 280]], 3, 0.05, 0.5, 0.2) }))
  // the eave's thickness: a fascia board under each slope's edge, and the dark underside between it and the wall
  const fasciaF = plane('t37l-fascia-f', 5.8, 0.18, s('rect', { class: 't37l-fascia', width: 580, height: 18 }), s('path', { class: 't37l-fascia-hi', d: stroke([[4, 2], [576, 2]], 2.4, 0.05, 0.05, 0.5) }))
  const fasciaS = plane('t37l-fascia-s', 4.8, 0.18, s('rect', { class: 't37l-fascia', width: 480, height: 18 }), s('path', { class: 't37l-fascia-hi', d: stroke([[4, 2], [476, 2]], 2.4, 0.05, 0.05, 0.5) }))
  const soffitF = plane('t37l-soffit-f', 5.8, 0.9, s('rect', { class: 't37l-soffit', width: 580, height: 90 }), s('path', { class: 't37l-rafters', d: Array.from({ length: 14 }, (_, i) => `M${20 + i * 41} 0V90`).join('') }))
  const soffitS = plane('t37l-soffit-s', 0.9, 4.8, s('rect', { class: 't37l-soffit', width: 90, height: 480 }), s('path', { class: 't37l-rafters', d: Array.from({ length: 12 }, (_, i) => `M0 ${20 + i * 40}H90`).join('') }))
  // the veranda and its edge
  let boards = ''
  for (let i = 1; i < 6; i++) boards += `M0 ${i * 15}H440`
  const deck = plane('t37l-deck', 4.4, 0.9, s('rect', { class: 't37l-wood', width: 440, height: 90 }), s('path', { class: 't37l-boards', d: boards }), s('rect', { class: 't37l-deck-glow', width: 440, height: 90 }))
  const riser = plane('t37l-riser', 4.4, 0.35, s('rect', { class: 't37l-wood-dk', width: 440, height: 35 }), s('path', { class: 'g13-ink', d: lines([[0, 1, 440, 1], [20, 0, 20, 35], [420, 0, 420, 35]], 2.4) }))
  // the wing fence (sode-gaki) that hides the side garden from the front: culms with nodes, three tied rails, a capped
  // top, end posts; backlit by the moon, so every culm has a cold rim on its far side
  const FW = 280
  const fenceArt = () => {
    let cane = '', node = '', hi = ''
    for (let x = 16, i = 0; x < FW - 12; x += 10.5, i++) {
      const b = bamboo([[x, 236], [x + 0.6, 34]], 8.4, 3760 + i, 34)
      cane += b.cane
      node += b.nodes
      hi += stroke([[x + 3, 232], [x + 3.4, 38]], 1.6, 0.1, 0.1, 0.4)
    }
    let rails = '', railHi = '', ties = ''
    for (const y of [72, 140, 206]) {
      rails += stroke([[2, y], [FW - 2, y - 2]], 10, 0.02, 0.02, 0.6)
      railHi += stroke([[4, y - 3.5], [FW - 4, y - 5.5]], 2, 0.05, 0.05, 0.5)
      for (let x = 26; x < FW - 10; x += 31.5) ties += `M${f1(x - 4)} ${f1(y - 6)}l8 10M${f1(x + 4)} ${f1(y - 6)}l-8 10`
    }
    return s('g', null,
      s('path', { class: 'g13-bamboo t37l-cane', d: cane }),
      s('path', { class: 'g13-node', d: node }),
      s('path', { class: 't37l-fence-rim', d: hi }),
      s('path', { class: 'g13-bamboo t37l-rail', d: rails }),
      s('path', { class: 't37l-fence-rim', d: railHi }),
      s('path', { class: 't37l-ties', d: ties }),
      s('path', { class: 't37l-post', d: stroke([[6, 240], [6, 14]], 13, 0.02, 0.02, 0.8) + stroke([[FW - 6, 240], [FW - 6, 14]], 13, 0.02, 0.02, 0.8), filter: 'url(#ink-rough)' }),
      s('path', { class: 't37l-cap', d: `M-2 30Q${FW / 2} 6 ${FW + 2} 30L${FW + 2} 40Q${FW / 2} 18 -2 40Z` }),
      s('path', { class: 't37l-fence-rim', d: stroke([[FW - 2, 16], [FW - 2, 236]], 2.6, 0.05, 0.05, 0.5) + stroke([[0, 29], [FW / 2, 11], [FW, 28]], 2.2, 0.1, 0.1, 0.4) }))
  }
  const fence = plane('t37l-fence', 2.8, 2.4, fenceArt)
  // the fence's thickness at its free end: the cut ends of the rails and the post, seen as you round the corner
  const fenceEnd = plane('t37l-fence-end', 0.14, 2.4, s('rect', { class: 't37l-fence-edge', width: 14, height: 240 }), s('path', { class: 't37l-fence-rim', d: lines([[3, 14, 3, 238]], 2.4) }))
  // the garden gate at the end of the main path: bamboo posts and lintel, culms between, the moon behind it
  const gate = plane('t37l-gate', 1.6, 2.2, () => {
    let cane = '', node = ''
    for (let i = 0; i < 11; i++) {
      const b = bamboo([[34 + i * 9.5, 216], [34 + i * 9.5, 70]], 6.4, 3780 + i, 30)
      cane += b.cane
      node += b.nodes
    }
    return s('g', null,
      s('path', { class: 'g13-bamboo t37l-cane', d: cane }),
      s('path', { class: 'g13-node', d: node }),
      s('path', { class: 'g13-ink', d: lines([[20, 220, 20, 30], [140, 220, 140, 30], [0, 34, 160, 28], [10, 54, 150, 50]], 9), filter: 'url(#ink-rough)' }),
      s('path', { class: 't37l-fence-rim', d: lines([[24, 216, 24, 34], [144, 216, 144, 34], [2, 30, 158, 24]], 2) }))
  })
  // the sealed box on the veranda: front, top and side faces, the red paper seal over its lid
  const boxF = plane('t37l-box-f', 0.6, 0.4, s('rect', { class: 't37l-wood', width: 60, height: 40 }), s('rect', { class: 't37l-seal', x: 24, y: 0, width: 12, height: 40 }))
  const boxT = plane('t37l-box-t', 0.6, 0.45, s('rect', { class: 't37l-wood-hi', width: 60, height: 45 }), s('rect', { class: 't37l-seal', x: 24, y: 0, width: 12, height: 45 }))
  const boxS = plane('t37l-box-s', 0.45, 0.4, s('rect', { class: 't37l-wood-dk', width: 45, height: 40 }))

  // figures and the lantern are paper cut-outs that keep facing you as you walk (billboards)
  const cut = (cls: string, w: number, hh: number, ...kids: Kid[]) =>
    h('div', { class: `t37l-cut ${cls}`, style: `--w:${w};--h:${hh}` }, fillIn(s('svg', { viewBox: `${-w * 50} ${-hh * 100} ${w * 100} ${hh * 100}`, 'aria-hidden': 'true', overflow: 'visible' }), kids))
  // the red sleeve: crouched on one knee at the shōji, its back to you, an arm up prying a cell with a thin blade, the
  // wide sleeve hanging; the paper's glow rims it
  const red = cut('t37l-red', 1.1, 1.3,
    s('ellipse', { class: 't37l-contact', cx: 2, cy: 0, rx: 44, ry: 7 }),
    s('path', { class: 't37l-robe', d: 'M-34 0Q-40 -26 -26 -48Q-14 -70 6 -74Q24 -72 26 -52Q30 -28 40 -6Q42 0 36 1Z', filter: 'url(#ink-wash)' }),
    s('path', { class: 't37l-robe-dk', d: 'M-34 0Q-38 -22 -26 -40Q-18 -30 -12 -6Q-10 0 -14 1Z' }),
    s('path', { class: 't37l-sleeve', d: 'M-6 -72Q-26 -86 -34 -104L-22 -110Q-14 -94 2 -84Q4 -60 -8 -42Q-22 -38 -26 -46Q-12 -56 -6 -72Z' }),
    s('path', { class: 't37l-skin', d: stroke([[-24, -106], [-30, -112]], 5, 0.1, 0.3, 0.4) }),
    s('path', { class: 't37l-blade', d: stroke([[-30, -112], [-44, -126]], 2.2, 0.05, 0.7, 0.2) }),
    s('circle', { class: 't37l-head', cx: 10, cy: -86, r: 12 }),
    s('path', { class: 't37l-head', d: 'M4 -97q6 -9 13 -3q-3 2 -2 6z' }),
    s('path', { class: 't37l-warmrim', d: stroke([[-2, -97], [10, -99], [20, -92]], 2.2, 0.2, 0.2, 0.3) + stroke([[-26, -48], [-10, -68], [4, -74]], 2.4, 0.2, 0.3, 0.3) + stroke([[-33, -103], [-24, -94], [-6, -86]], 2, 0.2, 0.3, 0.3) }),
    s('path', { class: 'g13-ink', d: stroke([[-34, 0], [-38, -24], [-26, -48], [6, -74], [26, -52], [40, -6]], 2.2, 0.05, 0.05, 0.4) + stroke([[2, -60], [12, -30], [18, -6]], 1.4, 0.2, 0.3, 0.3), filter: 'url(#ink-rough)' }))
  // the bearer at the gate: a tall robe, a straw hat, a pole over the shoulder with a paper lantern hung from its tip
  const keeper = cut('t37l-keeper', 1.2, 1.9,
    s('ellipse', { class: 't37l-contact', cx: 0, cy: 0, rx: 30, ry: 6 }),
    s('circle', { class: 't37l-lamp-glow', cx: 52, cy: -108, r: 64, fill: 'url(#p2-lamp)' }),
    s('path', { class: 't37l-person', d: 'M-19 0Q-22 -60 -14 -104Q-4 -114 8 -112Q18 -100 18 -60Q20 -20 22 0Z', filter: 'url(#ink-wash)' }),
    s('circle', { class: 't37l-person', cx: 0, cy: -122, r: 10.5 }),
    s('path', { class: 't37l-hatk', d: 'M-26 -122L0 -142L26 -122Q0 -118 -26 -122Z' }),
    s('path', { class: 't37l-pole', d: stroke([[-12, -74], [24, -96], [54, -148]], 3, 0.05, 0.05, 0.6) }),
    s('path', { class: 'g13-ink', d: stroke([[8, -104], [20, -96], [24, -92]], 6, 0.1, 0.3, 0.4) + stroke([[-19, 0], [-22, -60], [-14, -104]], 1.8, 0.1, 0.1, 0.4), filter: 'url(#ink-rough)' }),
    s('path', { class: 't37l-cord', d: 'M54 -148V-130' }),
    s('ellipse', { class: 't37l-lamp-body', cx: 54, cy: -112, rx: 12, ry: 16 }),
    s('path', { class: 't37l-ribs', d: [-10, -4, 2, 8].map((y) => `M${f1(54 - Math.sqrt(1 - (y / 16) ** 2) * 12)} ${-112 + y}H${f1(54 + Math.sqrt(1 - (y / 16) ** 2) * 12)}`).join('') }),
    s('path', { class: 't37l-moonrim', d: stroke([[16, -104], [18, -60], [20, -4]], 2, 0.1, 0.2, 0.3) + stroke([[2, -141], [25, -122]], 1.6, 0.1, 0.1, 0.4) }))
  const chochin = cut('t37l-chochin', 0.7, 1.1,
    s('path', { class: 't37l-cord', d: 'M0 -110V-74' }),
    s('circle', { class: 't37l-halo', cx: 0, cy: -42, r: 58, fill: 'url(#p2-lamp)' }),
    s('ellipse', { class: 't37l-paperl', cx: 0, cy: -42, rx: 24, ry: 32 }),
    s('path', { class: 't37l-ribs', d: [-22, -11, 0, 11, 22].map((y) => `M${-Math.sqrt(1 - (y / 32) ** 2) * 24} ${-42 + y}H${Math.sqrt(1 - (y / 32) ** 2) * 24}`).join('') }),
    s('path', { class: 't37l-caps', d: 'M-12 -76h24v6h-24zM-12 -14h24v6h-24z' }))

  // ── the 3D world
  const world = h('div', { class: 't37l-world' }, ground, deck, riser, frontWall, sideWall, fence, fenceEnd, gate, boxF, boxT, boxS, soffitF, soffitS, fasciaF, fasciaS, roofF, roofS, red, keeper, chochin)
  // the moon sits low behind the house corner on the right: it throws the second shadow and backlights the fence
  const sky = s('svg', { class: 't37l-sky', 'aria-hidden': 'true', viewBox: '0 0 1000 400', preserveAspectRatio: 'xMidYMax slice' },
    s('circle', { class: 't37l-moonglow', cx: 720, cy: 306, r: 260 }),
    mist(500, 250, 700, 80),
    moon(720, 300, 34, 3740, true),
    hills(-200, 1200, 336, 110, 3741, 0.9, 6),
    hills(-100, 600, 348, 54, 3742, 0.6, 3),
    pine(900, 356, 130, 3743, -1),
    mist(500, 344, 650, 30))
  const skyEl = h('div', { class: 't37l-skyw' }, sky)
  const view = h('div', { class: 't37l-view', role: 'group', 'aria-label': K.aria, 'aria-description': K.hint }, world)
  // the bamboo blind over the shōji: a roll at the top, slats that come down to --p (0 open … 1 down), the handle with a
  // vermilion tassel on its lower edge (the thing to pull: a ≥ 44 px target that rides down with the blind)
  const slats = h('i', { class: 't37l-slats', 'aria-hidden': 'true' })
  const pull = h('button', {
    class: 't37l-pull', type: 'button', role: 'slider', 'aria-label': K.toggle, 'aria-orientation': 'vertical',
    'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0', 'aria-valuetext': K.watched,
  }, h('i', { class: 't37l-tassel', 'aria-hidden': 'true' }))
  const blind = h('div', { class: 't37l-blind' }, slats, h('i', { class: 't37l-roll', 'aria-hidden': 'true' }), pull)
  frontWall.append(blind)
  // the things to touch, inside the 3D planes so they sit on the right spot
  const tag = (el: HTMLElement, cls: string, label: string, fn: () => void) => {
    const b = h('button', { class: `t37l-hit ${cls}`, type: 'button', 'aria-label': label, onClick: fn })
    el.append(b)
    return b
  }
  const note = h('div', { class: 't37l-note', hidden: true })
  const status = h('p', { class: 't37l-status' }, K.watched)
  const tools = [tag(frontWall, 'papers', K.tools[0].name, () => tell(0)), tag(red, 'red', K.tools[1].name, () => tell(1)), tag(keeper, 'keeper', K.tools[2].name, () => tell(2))]
  const box = tag(boxF, 'box', K.exampleLabel, () => tell(3))
  // their names, flat on the picture over each one (the view is fixed, so placed once per layout); shown once the blind
  // has been down (audit 37-2)
  const names = [...K.tools.map((t) => t.name), K.exampleLabel].map((t) => h('span', { class: 't37l-tag' }, t))
  const tagLayer = h('div', { class: 't37l-tags', 'aria-hidden': 'true' }, ...names)
  const root = h('div', { class: `t37l${still ? ' still' : ''}${tallAtMount ? ' tall' : ''}` }, h('p', { class: 'visually-hidden' }, K.art), skyEl, view, tagLayer, note, status)
  ctx.art.append(root)
  // the brushwork soaks in after mount, one piece per slice (reduced motion: at once)
  const job = sliced((function* () {
    for (const [svg, k, mark] of later) {
      svg.insertBefore(k(), mark)
      yield
    }
  })(), { sync: ctx.reduced, budget: 6 })
  ctx.onCleanup(job.cancel)
  ctx.prompt(K.prompt)

  // ── one fixed view from 35°: the shōji and the side garden both seen (no walking round, audit 37-2)
  const yaw = tallAtMount ? 30 : 35
  root.style.setProperty('--yaw', f1(yaw))
  skyEl.style.transform = `translateX(${f1(-yaw * 1.6)}px)`

  // ── guide: H1 on the handle (leans down when idle), H2 a groove beside the window from "open" to "down"
  const g = guide(ctx)
  let grab: Mark | null = g.dot(pull, { dir: [0, 1] })
  const way = g.track(() => {
    const a = ctx.art.getBoundingClientRect(), r = blind.getBoundingClientRect()
    const x = r.left - a.left - (tallAtMount ? 8 : 16)
    return [[x, r.top - a.top + 4], [x, r.bottom - a.top - 4]]
  }, { ticks: 2, labels: tallAtMount ? undefined : [K.open, K.down] }) // a phone has no room left of the window for words
  const toolDots: (Mark | null)[] = []

  // ── the blind: drag its handle (or tap it, or ↑ ↓ Home End Enter); let go past half way and it drops, else it rolls up
  let p = 0
  let down = false
  let told = false
  const seen = new Set<number>()
  const setP = (v: number) => {
    p = clamp(v, 0, 1)
    blind.style.setProperty('--p', p.toFixed(3))
    pull.setAttribute('aria-valuenow', String(Math.round(p * 100)))
    way.set(p)
  }
  function commit(d: boolean) {
    setP(d ? 1 : 0)
    if (d === down) return
    down = d
    root.classList.toggle('dark', down)
    status.textContent = down ? K.unwatched : K.watched
    pull.setAttribute('aria-valuetext', status.textContent)
    if (!down || told) return
    // the first time down: look at the two shadows, then what it means, then the three ways of testing
    told = true
    grab?.done()
    grab = null
    status.setAttribute('aria-live', 'polite')
    ctx.prompt(K.steps[0], 'ok')
    const t = window.setTimeout(() => {
      ctx.insight(K.insight, K.detail)
      ctx.prompt(K.steps[1])
      root.classList.add('tested')
      tools.forEach((b, i) => (toolDots[i] = g.dot(b, { dir: [0, -1] })))
    }, ctx.reduced || still ? 0 : 2200)
    ctx.onCleanup(() => clearTimeout(t))
  }
  let drag: { id: number; y: number; p0: number; span: number; moved: boolean } | null = null
  pull.addEventListener('pointerdown', (e) => {
    if (e.button) return
    drag = { id: e.pointerId, y: e.clientY, p0: p, span: Math.max(40, blind.getBoundingClientRect().height), moved: false }
    pull.setPointerCapture(e.pointerId)
  })
  pull.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return
    const dy = e.clientY - drag.y
    if (!drag.moved && Math.abs(dy) < 5) return
    if (!drag.moved) (drag.moved = true), root.classList.add('pulling')
    setP(drag.p0 + dy / drag.span)
  })
  const up = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return
    const moved = drag.moved
    drag = null
    root.classList.remove('pulling')
    if (moved) {
      pull.dataset.dragged = '1'
      setTimeout(() => delete pull.dataset.dragged)
      commit(p >= 0.5)
    }
  }
  pull.addEventListener('pointerup', up)
  pull.addEventListener('pointercancel', up)
  pull.addEventListener('click', () => !pull.dataset.dragged && commit(!down))
  pull.addEventListener('keydown', (e) => {
    const to = ({ ArrowDown: true, PageDown: true, End: true, ArrowUp: false, PageUp: false, Home: false } as Record<string, boolean>)[e.key]
    if (to === undefined) return
    e.preventDefault()
    commit(to)
  })
  // H7: standing still before the first pull, the blind slips down a little and rolls back
  let nudge = 0
  const invite = () => {
    if (told || drag || ctx.reduced) return
    setP(0.06)
    clearTimeout(nudge)
    nudge = window.setTimeout(() => !drag && setP(0), 700)
  }
  ctx.el.addEventListener('p2:idle', invite)
  ctx.onCleanup(() => {
    ctx.el.removeEventListener('p2:idle', invite)
    clearTimeout(nudge)
  })

  // ── the three ways of testing (and the company's own story in the sealed box)
  let shown = -1
  function tell(i: number) {
    if (shown === i && !note.hidden) return void (note.hidden = true, (shown = -1))
    shown = i
    tools.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)))
    box.setAttribute('aria-pressed', String(i === 3))
    note.hidden = false
    note.dataset.k = String(i)
    if (i < 3) note.replaceChildren(h('p', { class: 't37l-name' }, K.tools[i].name), h('p', { class: 't37l-what' }, K.tools[i].what))
    else note.replaceChildren(h('p', { class: 't37l-name' }, K.exampleLabel), ctx.fact(K.example, 'p', 't37l-what'))
    note.setAttribute('aria-live', 'polite')
    if (i < 3 && !seen.has(i)) {
      seen.add(i)
      toolDots[i]?.done()
      toolDots[i] = null
      if (told && seen.size === 3) ctx.complete()
    }
  }
  tools.forEach((b) => b.setAttribute('aria-pressed', 'false'))
  box.setAttribute('aria-pressed', 'false')

  // ── layout: one unit u for the whole house; planes are sized in u, the art inside them is resolution-free. The roof's
  // ridge keeps clear of the frame's top at every yaw; a tall frame stands the house a little left so the side garden fits
  ctx.onCleanup(onSize(ctx.art, () => {
    const H = Math.max(240, stable(ctx.art.clientHeight))
    root.style.height = `${H}px`
    const W = ctx.art.clientWidth
    const tall = H > W
    const u = tall ? Math.min(W / 9.4, H / 10) : Math.min(W / 13.4, H / 7.6)
    root.style.setProperty('--u', `${f1(u)}px`)
    world.style.left = `${f1(W * (tall ? 0.46 : 0.55))}px`
    // a narrow sky keeps its right side: the moon low beside the house corner
    sky.setAttribute('preserveAspectRatio', tall ? 'xMaxYMax slice' : 'xMidYMax slice')
    world.style.top = `${f1(H * (tall ? 0.63 : 0.73))}px`
    view.style.perspectiveOrigin = `${f1(W * 0.5)}px ${f1(H * 0.3)}px`
    root.classList.toggle('tall', tall)
    g.refresh()
    cancelAnimationFrame(tagRaf)
    tagRaf = requestAnimationFrame(placeTags)
  }))
  // read every box first, then write
  let tagRaf = 0
  ctx.onCleanup(() => cancelAnimationFrame(tagRaf))
  function placeTags() {
    const a = root.getBoundingClientRect()
    const at = [...tools, box].map((b) => b.getBoundingClientRect())
    at.forEach((r, i) => (names[i].style.transform = `translate(${f1(r.left - a.left + r.width / 2)}px, ${f1(r.top - a.top - 6)}px) translate(-50%, -100%)`))
  }
}

/** points along a polyline through `pts`, n of them (for stepping stones) */
function stonesPath(pts: Pt[], n: number): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * (pts.length - 1), j = Math.min(pts.length - 2, Math.floor(t)), u = t - j
    out.push([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * u, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * u])
  }
  return out
}

/**
 * A walking figure's shadow laid long on the ground, as a low moon draws it: feet at `at`, head `len` away along the
 * direction `deg` (svg degrees, 0 = up the page). Brushed in ground units, so it keeps its shape at any scale.
 */
function longShadow(at: Pt, deg: number, len: number): string {
  const a = (deg * Math.PI) / 180, ux = Math.sin(a), uy = -Math.cos(a), vx = -uy, vy = ux
  // figure space: across (w) and along (0 feet … 1 head), mapped onto the ground
  const P = (w: number, t: number): Pt => [at[0] + ux * t * len + vx * w * len, at[1] + uy * t * len + vy * w * len]
  const B = (pts: [number, number][], wd: number) => stroke(pts.map(([w, t]) => P(w, t)), wd * len * 1.35, 0.15, 0.25, 0.3)
  const [hx, hy] = P(0.01, 0.92)
  return blob(hx, hy, len * 0.055, len * 0.05, 3735, 0.1, 10) +
    B([[0, 0.84], [0.005, 0.66], [0, 0.5]], 0.11) + // the torso
    B([[-0.01, 0.52], [-0.05, 0.26], [-0.08, 0.02]], 0.05) + // the leg in front
    B([[0.01, 0.52], [0.04, 0.27], [0.1, 0.05]], 0.045) + // the leg behind
    B([[-0.03, 0.8], [-0.07, 0.64], [-0.06, 0.5]], 0.032) + // the arms, swinging
    B([[0.03, 0.8], [0.08, 0.66], [0.11, 0.55]], 0.03)
}
