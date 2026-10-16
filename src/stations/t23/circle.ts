import { s } from '../../core/dom'
import { blob, curve, f1, stoneArt, stroke } from '../t22/kit'

/** Scene 4's four stones (art: a tall upright stone, a lying stone, a mossy stone, a stone carved with a seal). */
export const circleStones: (() => SVGElement)[] = [
  () => stoneArt(52, 68, 2341),
  () => stoneArt(110, 34, 2342),
  () => {
    let tufts = ''
    for (let i = 0; i < 9; i++) {
      const x = -30 + i * 7.5, y = -44 + Math.abs(i - 4) * 2.2
      tufts += stroke(curve([x, y + 3], [x + 1, y - 1], [x + (i % 2 ? 3 : -2), y - 4], 4), 1.6, 0.1, 0.6, 0.2)
    }
    return s('g', null, stoneArt(90, 52, 2343),
      s('path', { class: 'g8c-moss', d: blob(-4, -44, 36, 9, 2345, 0.25, 16) + blob(28, -26, 9, 6, 2346, 0.3, 12), filter: 'url(#ink-wash)' }),
      s('path', { class: 'g8c-tuft', d: tufts }))
  },
  () => {
    const x = 15, y = -40, w = 14, hh = 16
    const cut = stroke([[x + 3.5, y + 4], [x + 3.5, y + hh - 4]], 1.6, 0.1, 0.1, 0.5) + stroke([[x + 7.5, y + 4], [x + 11.5, y + 4], [x + 11.5, y + 9], [x + 7.5, y + 9], [x + 7.5, y + 13]], 1.4, 0.1, 0.1, 0.5)
    return s('g', null, stoneArt(84, 56, 2344),
      s('rect', { class: 'g8c-seal', x: f1(x), y: f1(y), width: w, height: hh, rx: 1.5, filter: 'url(#ink-rough)' }),
      s('path', { class: 'g8c-seal-cut', d: cut }))
  },
]
