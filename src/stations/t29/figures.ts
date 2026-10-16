import { s } from '../../core/dom'
import { blob, curve, p2Defs, rng, stroke, type Pt } from '../../ui/part2/ink'
import { f1, P } from './rig'

/** Gradients this station's figures use, added once to the page's Part 2 defs (stops read tokens: no JS on theme change). */
export function t29Defs() {
  p2Defs()
  if (document.getElementById('t29-defs')) return
  const stop = (o: number, c: string, a: number) => s('stop', { offset: o, style: `stop-color:var(${c});stop-opacity:${a}` })
  document.getElementById('p2-defs')!.append(s('defs', { id: 't29-defs' },
    // lantern light from the left on a figure: warm on its back, gone by its front
    s('linearGradient', { id: 't29-warm', x1: 0, y1: 0.2, x2: 1, y2: 0.6 }, stop(0, '--lantern', 0.62), stop(0.55, '--lantern', 0.2), stop(1, '--lantern', 0.04)),
    // a paper roll lying on the desk: moonlit top edge, round shade underneath
    s('linearGradient', { id: 't29-roll', x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, '--moon', 0.5), stop(0.3, '--moon', 0), stop(0.62, '--umbra', 0.06), stop(1, '--umbra', 0.42)),
    // soft clouds: a pale puff, a rain-heavy one; a warm dry glow; rain streaks fading as they fall
    s('radialGradient', { id: 't29-puff' }, stop(0, '--mist', 0.95), stop(0.55, '--mist', 0.6), stop(1, '--mist', 0)),
    s('radialGradient', { id: 't29-rainc' }, stop(0, '--rock-lo', 0.9), stop(0.6, '--rock-lo', 0.55), stop(1, '--rock-lo', 0)),
    s('radialGradient', { id: 't29-dry' }, stop(0, '--lantern', 0.22), stop(0.6, '--lantern', 0.07), stop(1, '--lantern', 0)),
    s('linearGradient', { id: 't29-ground', x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, '--paper-2', 0), stop(0.25, '--rock-lo', 0.22), stop(1, '--rock-lo', 0.5)),
    // a stone cylinder seen from the front (the moon on its right), a shaft falling into the dark, a shading top→bottom
    s('linearGradient', { id: 't29-cyl', x1: 0, y1: 0, x2: 1, y2: 0 }, stop(0, '--umbra', 0.62), stop(0.22, '--umbra', 0.3), stop(0.6, '--umbra', 0.08), stop(0.84, '--umbra', 0.02), stop(1, '--umbra', 0.4)),
    s('linearGradient', { id: 't29-shaft', x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, '--umbra', 0.55), stop(0.55, '--umbra', 0.85), stop(1, '--umbra', 0.96)),
    s('linearGradient', { id: 't29-dusk', x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, '--umbra', 0), stop(0.5, '--umbra', 0.1), stop(1, '--umbra', 0.4)),
    s('radialGradient', { id: 't29-glint' }, stop(0, '--moon', 0.9), stop(0.35, '--moon', 0.35), stop(1, '--moon', 0)),
    s('radialGradient', { id: 't29-lamp' }, stop(0, '--lantern', 0.85), stop(0.4, '--lantern', 0.3), stop(1, '--lantern', 0))))
}

/** A scribe kneeling at (x, y) (knees on the floor line), `hh` tall, in profile facing right: a pale robe under a strong ink
 *  contour (heavy down the back), a wide sleeve, a sash, folds, the face in paper, the winged scholar's cap in solid ink.
 *  The writing forearm is drawn by the caller (it moves) from `elbow`. */
export function scribe(x: number, y: number, hh: number, seed: number): { parts: SVGElement[]; elbow: Pt } {
  const u = hh / 10
  const X = (k: number) => x + u * k
  const Y = (k: number) => y - u * k
  const neck: Pt = [X(0.6), Y(6.9)]
  const head: Pt = [X(1.25), Y(7.85)]
  const robe = `M${P([X(-3.6), y])}Q${P([X(-3.9), Y(3.2)])} ${P([X(-1.8), Y(5.6)])}Q${P([X(-0.6), Y(6.9)])} ${P(neck)}Q${P([X(1.8), Y(6.3)])} ${P([X(2.2), Y(4.4)])}Q${P([X(2.6), Y(1.8)])} ${P([X(3.8), Y(0.6)])}L${P([X(3.6), y])}Z`
  const back = curve([X(-3.5), Y(0.1)], [X(-4.0), Y(3.4)], [X(-1.6), Y(5.75)], 12).concat(curve([X(-1.6), Y(5.75)], [X(-0.6), Y(6.85)], [X(0.4), Y(6.95)], 6).slice(1))
  const chest = curve([X(0.9), Y(6.8)], [X(1.9), Y(6.1)], [X(2.1), Y(4.5)], 8)
  const sleeve = `M${P([X(0.0), Y(6.1)])}Q${P([X(2.2), Y(5.6)])} ${P([X(3.3), Y(3.9)])}Q${P([X(3.9), Y(3.0)])} ${P([X(3.5), Y(2.4)])}Q${P([X(2.7), Y(2.3)])} ${P([X(2.1), Y(2.9)])}Q${P([X(1.2), Y(4.0)])} ${P([X(-0.4), Y(4.6)])}Z`
  const ink =
    stroke(back, u * 0.62, 0.05, 0.2, 0.15) +
    stroke(chest, u * 0.34, 0.15, 0.4, 0.2) +
    stroke(curve([X(0.0), Y(6.15)], [X(2.2), Y(5.65)], [X(3.4), Y(3.8)], 8), u * 0.42, 0.1, 0.25, 0.25) +
    stroke(curve([X(3.5), Y(2.45)], [X(2.6), Y(2.3)], [X(2.0), Y(3.0)], 6), u * 0.3, 0.2, 0.3, 0.3) +
    stroke([[X(-3.6), y], [X(0), Y(-0.08)], [X(3.7), Y(0.05)]], u * 0.4, 0.1, 0.1, 0.3)
  const folds =
    stroke(curve([X(-2.2), Y(4.6)], [X(-1.5), Y(2.8)], [X(-1.9), Y(0.6)], 8), u * 0.16, 0.2, 0.4, 0.1) +
    stroke(curve([X(-0.6), Y(3.8)], [X(0.0), Y(2.2)], [X(0.6), Y(0.5)], 8), u * 0.13, 0.2, 0.4, 0.1) +
    stroke(curve([X(1.6), Y(4.6)], [X(2.0), Y(4.2)], [X(2.6), Y(3.4)], 6), u * 0.1, 0.2, 0.4, 0.1)
  const sash = stroke(curve([X(-3.0), Y(3.1)], [X(-0.4), Y(2.6)], [X(2.2), Y(3.0)], 10), u * 0.3, 0.15, 0.15, 0.3) +
    stroke(curve([X(-0.6), Y(2.75)], [X(-0.9), Y(1.8)], [X(-0.5), Y(1.0)], 6), u * 0.18, 0.1, 0.5, 0.2)
  const face = blob(head[0], head[1], u * 0.82, u * 0.92, seed, 0.06, 12)
  const faceInk = stroke(curve([head[0] - u * 0.7, head[1] - u * 0.5], [head[0] - u * 0.95, head[1] + u * 0.4], [head[0] - u * 0.1, head[1] + u * 0.9], 8), u * 0.22, 0.2, 0.4, 0.2) +
    stroke([[head[0] + u * 0.25, head[1] - u * 0.05], [head[0] + u * 0.6, head[1] + u * 0.02]], u * 0.12, 0.2, 0.2, 0.3) +
    stroke([[head[0] + u * 0.2, head[1] + u * 0.75], [head[0] + u * 0.35, head[1] + u * 1.7]], u * 0.1, 0.1, 0.8, 0.1) +
    stroke([[head[0] + u * 0.45, head[1] + u * 0.7], [head[0] + u * 0.75, head[1] + u * 1.5]], u * 0.08, 0.1, 0.8, 0.1)
  const cap = blob(head[0] - u * 0.05, head[1] - u * 0.78, u * 0.98, u * 0.55, seed + 1, 0.05, 10) +
    stroke([[head[0] - u * 2.2, head[1] - u * 0.55], [head[0] - u * 1.4, head[1] - u * 0.75], [head[0] - u * 0.8, head[1] - u * 0.85]], u * 0.42, 0.35, 0.05, 0.4) +
    stroke([[head[0] + u * 0.7, head[1] - u * 0.85], [head[0] + u * 1.3, head[1] - u * 0.78], [head[0] + u * 2.1, head[1] - u * 0.6]], u * 0.42, 0.05, 0.35, 0.4)
  return {
    parts: [
      s('path', { class: 't29f-robe', d: robe }),
      s('path', { class: 't29f-warm', d: robe }),
      s('path', { class: 't29f-robe t29f-sleeve', d: sleeve }),
      s('path', { class: 't29f-sash', d: sash }),
      s('path', { class: 't29f-fold', d: folds }),
      s('path', { class: 't29f-ink', d: ink, filter: 'url(#ink-rough)' }),
      s('path', { class: 't29f-rim', d: stroke(back.slice(3, 15).map(([a, b]) => [a - u * 0.05, b - u * 0.1] as Pt), u * 0.16, 0.2, 0.4, 0.1) }),
      s('path', { class: 't29f-face', d: face }),
      s('path', { class: 't29f-ink', d: faceInk }),
      s('path', { class: 't29f-cap', d: cap, filter: 'url(#ink-rough)' }),
    ],
    elbow: [X(3.0), Y(2.8)],
  }
}

/** The brush arm from the elbow to the hand at `hand` (the group the caller animates). */
export function arm(elbow: Pt, hand: Pt, sh: number): SVGElement[] {
  const sleeve = curve(elbow, [elbow[0] + sh * 0.1, elbow[1] + sh * 0.02], [hand[0] - sh * 0.06, hand[1] - sh * 0.05], 8)
  return [
    s('path', { class: 't29f-robe', d: stroke(sleeve, Math.max(3, sh * 0.075), 0.05, 0.4, 0.5) }),
    s('path', { class: 't29f-face', d: blob(hand[0] - sh * 0.02, hand[1] - sh * 0.035, sh * 0.04, sh * 0.03, 2913, 0.15, 8) }),
    s('path', { class: 't29f-ink', d: stroke(sleeve, Math.max(1, sh * 0.02), 0.1, 0.3, 0.3) +
      stroke([[hand[0] - sh * 0.04, hand[1] - sh * 0.16], [hand[0], hand[1] - sh * 0.04], [hand[0] + sh * 0.012, hand[1] + sh * 0.02]], Math.max(1.2, sh * 0.02), 0.05, 0.5, 0.15) }),
  ]
}

/** A paper runner (small figure, a rolled scroll on the shoulder), walking, `hh` tall, foot at (0, 0). */
export function runner(hh: number): SVGElement {
  const u = hh / 10
  const body = `M${f1(-u * 1.3)} 0L${f1(-u * 0.4)} ${f1(-u * 4.2)}Q${f1(-u * 1.2)} ${f1(-u * 6.4)} ${f1(-u * 0.2)} ${f1(-u * 7.3)}L${f1(u * 0.9)} ${f1(-u * 7.2)}Q${f1(u * 1.7)} ${f1(-u * 5.8)} ${f1(u * 0.9)} ${f1(-u * 4.2)}L${f1(u * 1.9)} 0L${f1(u * 0.9)} 0L${f1(u * 0.3)} ${f1(-u * 3)}L${f1(-u * 0.3)} 0Z`
  return s('g', { class: 't29f-runner' },
    s('ellipse', { class: 't29f-contact', cx: f1(u * 0.6), cy: 0, rx: f1(u * 2.2), ry: f1(u * 0.5) }),
    s('path', { class: 't29f-body', d: body }),
    s('circle', { class: 't29f-body', cx: f1(u * 0.25), cy: f1(-u * 8.2), r: f1(u * 1.05) }),
    s('path', { class: 't29f-scroll', d: `M${f1(-u * 1.8)} ${f1(-u * 7.4)}l${f1(u * 4)} ${f1(-u * 1.5)}l${f1(u * 0.5)} ${f1(u * 1.2)}l${f1(-u * 4)} ${f1(u * 1.5)}Z` }))
}

/** A kura (white storehouse) in the mist, w × h, foot on (0, 0): plaster walls, a dark wainscot, a heavy roof, one lit door. */
export function kura(w: number, hh: number, seed: number): SVGElement[] {
  const r = rng(seed)
  const wall = hh * 0.52, roof = hh * 0.34
  const x0 = -w * 0.36, x1 = w * 0.36
  const eave = `M${f1(x0 - w * 0.12)} ${f1(-wall + 2)}Q${f1(0)} ${f1(-wall - roof * 0.12)} ${f1(x1 + w * 0.12)} ${f1(-wall + 2)}L${f1(x1 - w * 0.02)} ${f1(-wall - roof * 0.62)}Q${f1(0)} ${f1(-wall - roof * 0.7)} ${f1(x0 + w * 0.02)} ${f1(-wall - roof * 0.62)}Z`
  const ridge = stroke([[x0 - w * 0.02, -wall - roof * 0.64], [0, -wall - roof * 0.74], [x1 + w * 0.02, -wall - roof * 0.64]], Math.max(3, hh * 0.05), 0.05, 0.05, 0.6)
  let tiles = ''
  for (let i = 0; i < 9; i++) {
    const x = x0 - w * 0.06 + ((x1 - x0 + w * 0.12) * (i + 0.5)) / 9
    tiles += stroke([[x * 0.92, -wall - roof * 0.6], [x, -wall - roof * 0.05]], 1 + r() * 0.6, 0.1, 0.1, 0.4)
  }
  const dw = w * 0.13, dh = wall * 0.5
  return [
    s('path', { class: 't29f-kura-wall', d: `M${f1(x0)} 0L${f1(x0)} ${f1(-wall)}L${f1(x1)} ${f1(-wall)}L${f1(x1)} 0Z` }),
    s('path', { class: 't29f-kura-shade', d: `M${f1(x0 + w * 0.5)} 0L${f1(x0 + w * 0.5)} ${f1(-wall)}L${f1(x1)} ${f1(-wall)}L${f1(x1)} 0Z` }),
    s('path', { class: 't29f-kura-base', d: `M${f1(x0 - 2)} 0L${f1(x0 - 2)} ${f1(-wall * 0.28)}L${f1(x1 + 2)} ${f1(-wall * 0.28)}L${f1(x1 + 2)} 0Z` }),
    s('path', { class: 't29f-kura-grid', d: Array.from({ length: 7 }, (_, i) => `M${f1(x0 + ((x1 - x0) * (i + 0.5)) / 7)} ${f1(-wall * 0.27)}V0`).join('') + `M${f1(x0)} ${f1(-wall * 0.14)}H${f1(x1)}` }),
    s('rect', { class: 't29f-kura-door', x: f1(-dw / 2 - w * 0.08), y: f1(-dh - wall * 0.02), width: f1(dw), height: f1(dh), rx: 1 }),
    s('rect', { class: 't29f-kura-win', x: f1(w * 0.12), y: f1(-wall * 0.82), width: f1(w * 0.06), height: f1(wall * 0.12) }),
    s('path', { class: 't29f-kura-roof', d: eave }),
    s('path', { class: 't29f-kura-tile', d: tiles }),
    s('path', { class: 't29f-kura-roof', d: ridge }),
  ]
}
