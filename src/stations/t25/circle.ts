import { s } from '../../core/dom'
import { blob, curve, rng, stroke, type Pt } from '../../ui/part2/ink'
import type { PondGeo } from '../../ui/part2/perspectives'
import { perspectiveCircle } from '../../ui/part2/perspectives'
import type { Perspectives } from '../../ui/part2/types'
import { hills, mist, reeds } from '../../ui/part2/paint'
import C from '../../content/tram-25.json'
import { pondWithFront } from './kit'

/** A weeping willow from (x, y), h tall, leaning `dir`: trunk and limbs, the hanging strands, a pale crown wash. */
function willow(x: number, y: number, h: number, seed: number, dir: number) {
  const r = rng(seed)
  const top: Pt = [x + dir * h * 0.16, y - h]
  const spine = curve([x, y], [x - dir * h * 0.1, y - h * 0.55], top, 16)
  let wood = stroke(spine, h * 0.055, 0.02, 0.55, 0.25)
  let strands = ''
  for (let i = 0; i < 5; i++) {
    const b = spine[8 + i * 2]
    const side = i % 2 ? -0.55 : 1
    const end: Pt = [b[0] + dir * side * h * (0.28 + r() * 0.22), b[1] - h * (0.04 + r() * 0.12)]
    wood += stroke(curve(b, [(b[0] + end[0]) / 2, end[1] - h * 0.1], end, 8), h * 0.02, 0.05, 0.6, 0.2)
    for (let k = 0; k < 10; k++) {
      const u = 0.15 + (k / 9) * 0.85
      const p: Pt = [b[0] + (end[0] - b[0]) * u, b[1] + (end[1] - b[1]) * u - Math.sin(u * Math.PI) * h * 0.09]
      const L = h * (0.28 + r() * 0.5) * (1 - i * 0.08)
      strands += stroke(curve(p, [p[0] + dir * L * 0.1, p[1] + L * 0.45], [p[0] + (r() - 0.3) * 8 * dir, p[1] + L], 7), 0.9 + r() * 0.9, 0.04, 0.55, 0.12)
    }
  }
  return [
    s('path', { class: 't25o-crown', d: blob(top[0] - dir * h * 0.05, y - h * 0.68, h * 0.5, h * 0.36, seed, 0.28, 16), filter: 'url(#ink-wash)' }),
    s('path', { class: 't25o-strand', d: strands }),
    s('path', { class: 't25o-wood', d: wood, filter: 'url(#ink-rough)' }),
  ]
}

/** Behind the pond: far hills in the mist, a willow on the far bank leaning over the water, reeds on the other side. */
function back({ w, cx, cy, rx, ry, seed }: PondGeo): SVGElement[] {
  const bank = cy - ry * 1.02
  const wh = Math.min(ry * 2.6, (bank - 14) / 1.06)
  return [
    mist(cx, cy - ry * 1.4, w * 0.6, ry * 1.1),
    hills(-w * 0.05, w * 1.05, cy - ry * 0.75, ry * 1.1, seed, 0.9, 5),
    mist(cx, cy - ry * 0.8, rx * 2.4, ry * 0.45),
    s('path', { class: 't25o-bank', d: stroke(curve([cx - rx * 1.5, bank + ry * 0.12], [cx, bank - ry * 0.14], [cx + rx * 1.5, bank + ry * 0.1], 20), Math.max(2, ry * 0.05), 0.1, 0.1, 0.2), filter: 'url(#ink-rough)' }),
    ...willow(cx - rx * 0.78, bank + ry * 0.05, wh, seed + 3, 1),
    reeds(cx + rx * 0.72, bank + ry * 0.08, ry * 0.7, seed + 4, 7),
  ]
}

/** In front of the water: thin mist drifting across it. */
function front({ cx, cy, rx, ry }: PondGeo): SVGElement[] {
  return [s('g', { class: 't25o-drift' },
    mist(cx - rx * 0.35, cy - ry * 0.3, rx * 0.8, ry * 0.26),
    mist(cx + rx * 0.42, cy + ry * 0.28, rx * 0.62, ry * 0.2),
    mist(cx - rx * 0.1, cy + ry * 0.82, rx * 1.1, ry * 0.2))]
}

const S = C.scenes.circle
export const circleScene = pondWithFront(
  (art) => perspectiveCircle(S.perspectives as Perspectives, { label: S.label, prompt: S.prompt, question: S.question, art }),
  back, front)
