import { s } from '../../core/dom'
import { blob, curve, rng, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist, pine, wash } from '../../ui/part2/paint'
import { progressTide } from '../../ui/part2/tide'
import { C } from './shell'
import { bamboo, dawnGlow, fog, lines } from '../t37/sumi'

const T = C.scenes.tide
const N = T.tide.milestones.length

/**
 * A bamboo measuring stake with its knotted cord laid out on the silver sand, reaching off toward the dawn like a tree's
 * shadow at moonset: each milestone's cord is longer than the last; the last one's end frays into the mist.
 */
function stake(i: number, size: number, seed: number): SVGElement {
  const r = rng(seed)
  const H = size * (0.78 + r() * 0.12)
  const bw = Math.max(2.2, size * 0.085)
  const cane = bamboo([[0, 0], [r() - 0.5, -H * 0.5], [(r() - 0.5) * 1.5, -H]], bw, seed, H * 0.3)
  // longer with every milestone, and each a little steeper, so the cords fan out instead of lying on one line
  const L = size * (0.9 + i * 0.62 + (i >= 3 ? 0.9 : 0))
  const rise = L * (0.08 + i * 0.045)
  const end: Pt = [L, -rise]
  const cord = curve([bw * 0.6, -size * 0.04], [L * 0.5, -rise * 0.35 + size * 0.03], end, 18)
  const last = i === N - 1
  const keep = last ? 11 : 18
  let knots = '', fray = ''
  for (let k = 1; k * 3 < keep; k++) {
    const [x, y] = cord[k * 3]
    knots += blob(x, y, 1.7, 1.2, seed + k, 0.15, 6)
  }
  if (last) for (let k = keep; k < 18; k += 2) fray += stroke([cord[k], cord[k + 1]], 0.9, 0.3, 0.3, 0.2)
  const coil = stroke(curve([bw * 0.5, -H * 0.55], [bw * 3.2, -H * 0.42], [bw * 0.5, -H * 0.3], 6), 0.9, 0.1, 0.1, 0.5) +
    stroke(curve([bw * 0.5, -H * 0.5], [bw * 2.4, -H * 0.36], [bw * 0.6, -H * 0.24], 6), 0.8, 0.1, 0.1, 0.5)
  return s('g', { class: 't38m' },
    s('path', { class: 't38m-shadow', d: stroke(cord.slice(0, keep + 1).map(([x, y]) => [x, y + size * 0.05] as Pt), size * 0.16, 0.02, 0.85, 0.05), filter: 'url(#ink-wash)' }),
    s('ellipse', { class: 'p2p-contact', cx: 0, cy: 0.5, rx: size * 0.18, ry: size * 0.05 }),
    s('path', { class: 't38m-cord', d: stroke(cord.slice(0, keep + 1), 1.5, 0.02, last ? 0.4 : 0.06, 0.4) + coil }),
    fray ? s('path', { class: 't38m-fray', d: fray }) : '',
    s('path', { class: 't38m-knot', d: knots }),
    s('path', { class: 'g13-bamboo', d: cane.cane, filter: 'url(#ink-rough)' }),
    s('path', { class: 'g13-node', d: cane.nodes }),
    s('path', { class: 'g13-hi', d: cane.hi }),
    s('path', { class: 'g13-ink', d: lines([[-bw * 0.6, -H - 0.5, bw * 0.6, -H]], bw * 0.35) }))
}

/** Scene 2 — the long scroll at moonset: drag the moon and the measuring cords stretch out like shadows. */
export const tideScene = progressTide(T.tide, {
  label: T.label, prompt: T.prompt, insight: T.insight, detail: T.detail,
  art: {
    mark: stake,
    back: ({ w, h, ground, xs, roll, seed }) => {
      const hz = ground - h * 0.3 // the far shore
      const today = xs[xs.length - 1]
      // a lone pine on the left; its shadow runs out long across the sand
      const px = roll + 14
      return [
        dawnGlow(today + w * 0.08, hz, w * 0.34, h * 0.5, 3),
        fog(w * 0.42, hz - h * 0.12, w * 0.6, h * 0.32),
        hills(roll, w - roll, hz, h * 0.26, seed, 0.92, 8),
        hills(roll, w * 0.42, hz + 3, h * 0.2, seed + 1, 0.7, 3),
        mist(w * 0.5, hz + 2, w * 0.62, h * 0.07),
        wash(blob(w * 0.5, ground - h * 0.08, w * 0.5, h * 0.12, seed + 2, 0.1), 0.06),
        s('path', { class: 't38m-shadow', d: stroke(curve([px + 4, ground - h * 0.02], [w * 0.3, ground - h * 0.09], [w * 0.55, hz + h * 0.06], 20), h * 0.05, 0.02, 0.9, 0.05), filter: 'url(#ink-wash)' }),
        pine(px, ground - h * 0.02, h * 0.38, seed + 3, 1),
        fog(today + w * 0.06, ground - h * 0.14, w * 0.18, h * 0.3),
      ]
    },
  },
})
