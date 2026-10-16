import { s } from '../../core/dom'
import { clamp } from '../../ui/part2/ink'
import { grass, hills, mist, moon, paperLantern } from '../../ui/part2/paint'
import type { PathGeo } from '../../ui/part2/steps'
import { ground, stroke } from '../t31/kit'

const f1 = (n: number) => (Math.round(n * 10) / 10).toString()

/** A small cottage standing on (x, y), k ≈ its height / 60: dark until the path is done, then its window and lantern light. */
function cottage(x: number, y: number, k: number, seed: number): SVGGElement {
  const X = (v: number) => f1(x + v * k), Y = (v: number) => f1(y - v * k)
  return s('g', { class: 't32p-end' },
    s('circle', { class: 't32p-halo', cx: X(-6), cy: Y(18), r: f1(46 * k), fill: 'url(#p2-lamp)' }),
    ground(x, y + 2 * k, 50 * k, 6 * k, seed, 0.26),
    s('rect', { class: 't32s-wall', x: X(-26), y: Y(32), width: f1(52 * k), height: f1(32 * k) }),
    s('rect', { class: 't32p-win', x: X(-18), y: Y(25), width: f1(16 * k), height: f1(13 * k) }),
    s('path', { class: 'g11-wash t32s-lat', d: stroke([[x - 10 * k, y - 25 * k], [x - 10 * k, y - 12 * k]], 0.9 * k, 0.1, 0.1, 0.4) + stroke([[x - 18 * k, y - 18.5 * k], [x - 2 * k, y - 18.5 * k]], 0.9 * k, 0.1, 0.1, 0.4) }),
    s('rect', { class: 't32s-door', x: X(6), y: Y(22), width: f1(12 * k), height: f1(22 * k) }),
    s('path', { class: 't32s-roof', d: `M${X(-40)} ${Y(29)}Q${X(-20)} ${Y(37)} ${X(0)} ${Y(55)}Q${X(20)} ${Y(37)} ${X(40)} ${Y(29)}Q${X(22)} ${Y(33)} ${X(0)} ${Y(44)}Q${X(-22)} ${Y(33)} ${X(-40)} ${Y(29)}Z`, filter: 'url(#ink-wash)' }),
    s('path', { class: 'g11-wash t32s-ink', d: stroke([[x - 41 * k, y - 29 * k], [x - 20 * k, y - 38 * k], [x, y - 55.5 * k], [x + 20 * k, y - 38 * k], [x + 41 * k, y - 29 * k]], 2.2 * k, 0.1, 0.1, 0.4) + stroke([[x - 26 * k, y - 31 * k], [x - 26 * k, y]], 1.8 * k, 0.1, 0.1, 0.4) + stroke([[x + 26 * k, y - 31 * k], [x + 26 * k, y]], 2 * k, 0.1, 0.1, 0.4), filter: 'url(#ink-rough)' }),
    paperLantern(x + 34 * k, y - 30 * k, 5 * k, seed + 1, 4 * k),
    grass(x - 30 * k, y + 1, 16 * k, seed + 2))
}

/**
 * Scene 4 art (four steps to the first lamp) — a hillside under the moon, the path climbing to a dark cottage whose window
 * and eave lantern light once every step is in place.
 */
export function firstLampArt(g: PathGeo): SVGElement[] {
  const { w, h, row, last, top, pathY, seed } = g
  if (row) {
    const skyH = pathY - top
    const k = clamp(skyH / 150, 0.7, 1.5)
    return [
      mist(w * 0.5, top + skyH * 0.66, w * 0.6, skyH * 0.45),
      moon(w * 0.84, top + Math.max(20, skyH * 0.24), clamp(skyH * 0.1, 10, 22), seed, true),
      hills(-w * 0.04, w * 1.04, pathY - 20, skyH * 0.55, seed, 0.88, 6),
      hills(w * 0.05, w * 0.55, pathY - 16, skyH * 0.42, seed + 1, 0.58, 2),
      mist(w * 0.5, pathY - 22, w * 0.6, skyH * 0.14),
      cottage(Math.min(last[0] + 18 * k, w - 44 * k), last[1] + 4, k, seed + 2),
    ]
  }
  const k = clamp(w / 520, 0.55, 0.8)
  return [mist(w * 0.75, h * 0.5, w * 0.4, h * 0.4), cottage(last[0] + 6, last[1] + 58 * k, k, seed + 2)]
}
