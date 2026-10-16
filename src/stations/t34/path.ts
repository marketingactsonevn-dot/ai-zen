import { s } from '../../core/dom'
import { blob, clamp } from '../../ui/part2/ink'
import { grass, hills, mist, moon, pine, reeds, toro, wash } from '../../ui/part2/paint'
import type { PathGeo } from '../../ui/part2/steps'
import { doorway, f1, ink, lake, roof, wood, woodG } from './night'

/**
 * Scene 2's painting (stepPath art): the cobbled path across the night garden, from the workshop gate to the lakeside
 * where a stone lantern waits (it lights with the path, as `.p2s-end`).
 */
export function pathArt(g: PathGeo): SVGElement[] {
  const { w, h, row, first, last, top, pathY, seed } = g
  if (!row) {
    // phone: the path is a column — a gate frames its first stone, a lantern and a little lake wait at its foot
    const cw = first[0] * 2
    const lh = clamp(h * 0.12, 54, 84)
    const gy = Math.max(10, first[1] + 4)
    return [
      wash(blob(last[0] + cw * 0.3, last[1] + lh * 0.95, cw * 0.62, lh * 0.18, seed + 3, 0.2), 0.12),
      lake(last[0] - cw * 0.2, last[1] + lh * 0.6, last[0] + cw * 1.1, last[1] + lh * 1.2, seed + 4, last[0] + cw * 0.45),
      reeds(last[0] + cw * 0.78, last[1] + lh * 0.9, lh * 0.5, seed + 5, 6),
      s('g', { class: 'p2s-end' }, toro(last[0] - cw * 0.12, last[1] + lh * 0.98, lh, true)),
      woodG([
        wood([2, gy + 8], [3, gy + cw * 0.5], 6, seed + 6),
        wood([cw - 2, gy + 8], [cw - 3, gy + cw * 0.5], 6, seed + 7),
        wood([0, gy + 18], [cw, gy + 17], 4, seed + 9),
      ]),
      ink(roof(4, cw - 4, gy + 6, cw / 90, cw * 0.08), 'g12-eave', 'rough'),
    ]
  }
  const skyH = pathY - top
  const gh = clamp(skyH * 0.62, 56, 190)
  const gw = gh * 0.6
  const gx = Math.max(gw * 0.35, first[0] - gw * 0.15)
  const mr = clamp(skyH * 0.09, 10, 24)
  const mx = w * 0.68
  const lakeTop = pathY - Math.min(skyH * 0.26, 70)
  const lh = clamp(skyH * 0.4, 46, 120)
  return [
    mist(w * 0.5, top + skyH * 0.55, w * 0.62, skyH * 0.5),
    moon(mx, top + Math.max(mr * 1.8, skyH * 0.22), mr, seed, true),
    hills(-w * 0.04, w * 1.04, lakeTop + 4, skyH * 0.48, seed + 1, 0.9, 6),
    hills(w * 0.45, w * 1.05, lakeTop + 4, skyH * 0.32, seed + 2, 0.62, 2),
    mist(w * 0.6, lakeTop, w * 0.55, skyH * 0.12),
    // the lake beyond the end of the path, the moon's road on it
    lake(w * 0.3, lakeTop, w * 1.06, pathY - 4, seed + 3, mx),
    wash(`M${f1(w * 0.3)} ${f1(pathY - 6)}Q${f1(w * 0.65)} ${f1(pathY - 16)} ${f1(w + 4)} ${f1(pathY - 10)}L${f1(w + 4)} ${f1(pathY + 4)}L${f1(w * 0.3)} ${f1(pathY + 4)}Z`, 0.1),
    reeds(last[0] - lh * 0.6, pathY - 6, lh * 0.45, seed + 4, 7),
    // the workshop at the start: an old pine behind it, the gate open onto the path
    pine(gx - gw * 0.1, pathY - 2, Math.min(skyH * 0.92, gh * 1.3), seed + 5, -1),
    wash(blob(gx + gw * 0.5, pathY + 2, gw * 1.2, 9, seed + 6, 0.2), 0.16),
    doorway(gx, pathY - 2, gw, gh, seed + 7, true),
    grass(gx + gw * 1.25, pathY + 2, 22, seed + 8),
    s('g', { class: 'p2s-end' }, toro(last[0] + lh * 0.22, last[1] + 4, lh, true)),
  ]
}
