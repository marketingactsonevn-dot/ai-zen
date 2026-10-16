import { s } from '../../core/dom'
import { blob, clamp, curve, rng, stroke, type Pt } from '../../ui/part2/ink'
import type { PondGeo } from '../../ui/part2/perspectives'
import { perspectiveCircle } from '../../ui/part2/perspectives'
import type { Perspectives } from '../../ui/part2/types'
import { hills, mist, moon, paperLantern, pine } from '../../ui/part2/paint'
import C from '../../content/tram-27.json'
import { F, f1, pondWithFront } from '../t25/kit'

/** Where the lantern hangs: at the end of the pine's long branch, just above the far side of the pond. */
const hook = ({ cx, cy, ry }: PondGeo): Pt => [cx + ry * 0.1, cy - ry * 1.78]

/** Behind the pond: hills and the moon off to the right, a pine on the far bank reaching one long branch out over the water. */
function back(g: PondGeo): SVGElement[] {
  const { w, cx, cy, rx, ry, seed } = g
  const r = rng(seed)
  const base: Pt = [cx - rx * 1.05, cy - ry * 0.82]
  const ph = Math.min(ry * 2.5, base[1] - 8)
  const fork: Pt = [base[0] + ph * 0.2, base[1] - ph * 0.72]
  const [hx, hy] = hook(g)
  const limb = curve(fork, [(fork[0] + hx) / 2, fork[1] - ry * 0.55], [hx + rx * 0.12, hy - ry * 0.05], 16)
  let needles = '', pads = ''
  for (const k of [6, 10, 14, 16]) {
    const [px, py] = limb[k]
    const pw = ry * (0.5 + r() * 0.3)
    pads += blob(px, py - pw * 0.12, pw * 0.55, pw * 0.18, seed + k, 0.25, 14)
    for (let j = 0; j < 14; j++) {
      const a = Math.PI * (1.08 + (j / 13) * 0.84), l = pw * (0.24 + r() * 0.12)
      needles += stroke([[px, py], [px + Math.cos(a) * l, py + Math.sin(a) * l * 0.6]], 1 + r() * 0.6, 0.05, 0.6, 0.15)
    }
  }
  const sr = clamp(rx * 0.11, 9, 22)
  return [
    mist(cx, cy - ry * 1.4, w * 0.6, ry * 1.1),
    moon(cx + rx * 0.95, Math.max(sr * 1.8, cy - ry * 2.5), sr, seed + 1, true),
    hills(-w * 0.05, w * 1.05, cy - ry * 0.75, ry * 1.1, seed, 0.9, 5),
    mist(cx, cy - ry * 0.8, rx * 2.4, ry * 0.45),
    pine(base[0], base[1], ph, seed + 2, 1),
    s('path', { class: 'p2p-pad', d: pads, filter: 'url(#ink-wash)' }),
    s('path', { class: 'p2p-trunk', d: stroke(limb, Math.max(3, ph * 0.03), 0.05, 0.6, 0.25), filter: 'url(#ink-rough)' }),
    s('path', { class: 'p2p-needle', d: needles }),
  ]
}

/** Above the water: the paper lantern leaning toward whoever comes near, and its warm smear on the pond. */
function front(g: PondGeo): SVGElement[] {
  const { cy, rx, ry, seed } = g
  const [hx, hy] = hook(g)
  const lr = clamp(rx * 0.075, 8, 22)
  return [
    s('ellipse', { class: 't27l-smear', cx: f1(hx), cy: f1(cy - ry * 0.45), rx: f1(rx * 0.12), ry: f1(ry * 0.42), fill: 'url(#p2-lamp)' }),
    s('g', { class: 't27l-lamp', style: `transform-origin:${f1(hx)}px ${f1(hy)}px` }, paperLantern(hx, hy, lr, seed + 4, ry * 0.12)),
  ]
}

const S = C.scenes.lamp
export const lampScene = pondWithFront(
  (art) => perspectiveCircle(S.perspectives as Perspectives, { label: S.label, prompt: S.prompt, question: S.question, detail: F(S.insight), art, sky: false }),
  back, front)
