import { s } from '../../core/dom'
import { blob, curve, rng, stroke, type Pt } from '../../ui/part2/ink'
import type { TideArt } from '../../ui/part2/tide'
import type { PondGeo } from '../../ui/part2/perspectives'
import { grass, hills, mist, reeds, toro, wash, water } from '../../ui/part2/paint'
import { factoryArm, figure, type Pose } from './robot'

const f1 = (n: number) => n.toFixed(1)

/**
 * Scene 1 · Vạch đích lùi dần: a running track curving along a lake under the moon; the finish is a red silk ribbon
 * between two stone lanterns. Each season rises as a figure on the track: robots stumbling and falling, the human
 * record, a robot in full stride, a factory arm for "today".
 */
export const raceArt: TideArt = {
  back({ w, h, ground, xs, roll, seed }) {
    const n = xs.length - 1
    const lake0 = ground - h * 0.3, lake1 = ground - h * 0.1
    const fx = (xs[n - 1] + xs[n]) / 2 // the finish, just before today
    const r = rng(seed + 3)
    let lines = ''
    for (let i = 0; i < 3; i++) {
      const y = ground - h * 0.075 + i * h * 0.03
      lines += stroke(curve([roll + 8, y + 2], [w * 0.5, y - 3], [fx - 18, y], 20), 1 + r() * 0.6, 0.05, 0.1, 0.2)
    }
    const lanternH = h * 0.2
    return [
      mist(w * 0.5, lake0 - h * 0.12, w * 0.7, h * 0.3),
      hills(roll, w - roll, lake0 + 2, h * 0.3, seed, 0.88, 6),
      water(roll, lake0, w - roll, lake1, seed + 1, undefined, true),
      mist(w * 0.5, lake0 + 2, w * 0.7, h * 0.05),
      reeds(xs[0] + 30, lake1 + 2, h * 0.12, seed + 2, 7),
      reeds(w * 0.62, lake1 + 2, h * 0.1, seed + 4, 5),
      s('path', { class: 't21r-track', d: `M${roll} ${f1(lake1 + 1)}Q${f1(w * 0.5)} ${f1(lake1 - 4)} ${f1(w - roll)} ${f1(lake1 + 1)}V${f1(ground + 4)}H${roll}Z`, filter: 'url(#ink-wash)' }),
      s('path', { class: 't21r-lane', d: lines }),
      s('g', { transform: `translate(${f1(fx - lanternH * 0.42)} ${f1(ground - 2)})` }, toro(0, 0, lanternH, true)),
      s('g', { transform: `translate(${f1(fx + lanternH * 0.42)} ${f1(ground + 2)})` }, toro(0, 0, lanternH * 1.05, true)),
      s('path', { class: 't21r-ribbon', d: stroke(curve([fx - lanternH * 0.42, ground - lanternH * 0.48], [fx, ground - lanternH * 0.36], [fx + lanternH * 0.42, ground - lanternH * 0.5], 10), 3.2, 0.1, 0.1, 0.6), filter: 'url(#ink-rough)' }),
      grass(xs[1] - 10, ground + 2, 18, seed + 5),
    ]
  },
  mark(i, size) {
    const k = (size * 1.5) / 90
    const marks: [Pose | 'arm', boolean][] = [['stumble', false], ['run', true], ['run', false], ['arm', false]]
    const [pose, human] = marks[Math.min(i, marks.length - 1)]
    const g = s('g', { transform: `scale(${k.toFixed(3)})` }, pose === 'arm' ? factoryArm() : figure(pose, human))
    // the first race: one robot down behind the stumbling one
    if (i === 0) g.prepend(s('g', { transform: 'translate(-34 0) scale(0.85)' }, figure('fallen')))
    return g
  },
}

/** A pine bough reaching in from the left edge at height y: a gnarled limb and pads of needle fans. */
export function bough(x1: number, y: number, seed: number): SVGGElement {
  const r = rng(seed)
  const limb = curve([-20, y - 10], [x1 * 0.5, y + 18], [x1, y + 4], 20)
  const twig = curve(limb[11], [limb[11][0] + 20, limb[11][1] - 26], [limb[11][0] + 46, limb[11][1] - 30], 8)
  let needles = '', pads = ''
  const tips: Pt[] = [limb[3], limb[8], limb[14], limb[20], twig[8]]
  for (let k = 0; k < tips.length; k++) {
    const [px, py] = tips[k]
    const w = 52 + r() * 22
    pads += blob(px, py - 8, w * 0.55, w * 0.2, seed + k, 0.22, 14)
    for (let f = 0; f < 3; f++) {
      const ox = px + (f - 1) * w * 0.32 + (r() - 0.5) * 4, oy = py - 2
      for (let j = 0; j < 15; j++) {
        const a = Math.PI * (1.08 + (j / 14) * 0.84) + (r() - 0.5) * 0.08
        const l = w * (0.28 + r() * 0.1)
        needles += stroke([[ox, oy], [ox + Math.cos(a) * l, oy + Math.sin(a) * l * 0.6]], 1 + r() * 0.5, 0.05, 0.6, 0.15)
      }
    }
  }
  return s('g', { class: 'p2p-pine' },
    s('path', { class: 'p2p-pad', d: pads, filter: 'url(#ink-wash)' }),
    s('path', { class: 'p2p-trunk', d: stroke(limb, 7, 0.02, 0.6, 0.25) + stroke(twig, 3.4, 0.05, 0.6, 0.2), filter: 'url(#ink-rough)' }),
    s('path', { class: 'p2p-needle', d: needles }))
}

/** A track along the ground at y across 0…w: a pale wash band, two dry lane strokes. */
export function track(w: number, y: number, seed: number): SVGElement[] {
  const r = rng(seed)
  return [
    wash(blob(w / 2, y + 6, w * 0.52, 14, seed, 0.06, 22), 0.16),
    s('path', { class: 't21r-lane', d: stroke([[-10, y + 1], [w * 0.5, y - 1 + r()], [w + 10, y + 2]], 1.6, 0.05, 0.05, 0.2) + stroke([[20, y + 15], [w * 0.5, y + 14], [w - 20, y + 17]], 1.1, 0.1, 0.1, 0.2) }),
  ]
}


/**
 * Scene 4 · the far shore of the moon lake: a village of low roofs, one factory with a chimney and a breath of smoke —
 * where robots might work — and a stone lantern on the near bank.
 */
export function farShore({ w, h, cx, cy, rx, ry, seed }: PondGeo): SVGElement[] {
  const r = rng(seed)
  const base = cy - ry * 0.95
  // a village: walls in a pale wash, heavy roofs with flicked eaves, nearer houses a little larger
  let roofs = '', walls = ''
  for (let i = 0; i < 6; i++) {
    const x = cx - rx * 1.2 + i * rx * 0.27 + r() * rx * 0.08, wd = rx * (0.13 + r() * 0.07), hh = wd * 0.55
    const y = base + (r() - 0.5) * ry * 0.06
    walls += `M${f1(x - wd * 0.36)} ${f1(y - hh * 0.45)}h${f1(wd * 0.72)}v${f1(hh * 0.45)}h${f1(-wd * 0.72)}Z`
    roofs += `M${f1(x - wd * 0.58)} ${f1(y - hh * 0.38)}Q${f1(x - wd * 0.3)} ${f1(y - hh * 0.5)} ${f1(x - wd * 0.2)} ${f1(y - hh)}H${f1(x + wd * 0.2)}Q${f1(x + wd * 0.3)} ${f1(y - hh * 0.5)} ${f1(x + wd * 0.58)} ${f1(y - hh * 0.38)}Z`
  }
  const fx = cx + rx * 0.75, fw = rx * 0.34
  const factory = `M${f1(fx - fw / 2)} ${f1(base)}V${f1(base - fw * 0.3)}l${f1(fw * 0.25)} ${f1(-fw * 0.14)}v${f1(fw * 0.14)}l${f1(fw * 0.25)} ${f1(-fw * 0.14)}v${f1(fw * 0.14)}l${f1(fw * 0.25)} ${f1(-fw * 0.14)}V${f1(base)}Z` +
    `M${f1(fx + fw * 0.3)} ${f1(base - fw * 0.3)}h${f1(fw * 0.07)}V${f1(base - fw * 0.95)}h${f1(-fw * 0.07)}Z`
  const smoke = stroke(curve([fx + fw * 0.34, base - fw * 0.98], [fx + fw * 0.6, base - fw * 1.4], [fx + fw * 1.3, base - fw * 1.5], 12), fw * 0.12, 0.05, 0.6, 0.2)
  return [
    mist(cx, cy - ry * 1.3, w * 0.62, ry * 1.1),
    hills(-w * 0.05, w * 1.05, base - ry * 0.05, Math.min(ry * 1.3, h * 0.28), seed, 0.86, 5),
    mist(cx, base, rx * 2.6, ry * 0.3),
    s('path', { class: 't21c-wall', d: walls }),
    s('path', { class: 't21c-shore', d: roofs + factory, filter: 'url(#ink-rough)' }),
    s('path', { class: 't21c-smoke', d: smoke, filter: 'url(#ink-wash)' }),
    s('g', { transform: `translate(${f1(cx - rx * 1.32)} ${f1(cy + ry * 0.25)})` }, toro(0, 0, Math.max(34, ry * 0.9), true)),
  ]
}
