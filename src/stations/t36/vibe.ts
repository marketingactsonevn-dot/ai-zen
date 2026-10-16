import { s } from '../../core/dom'
import { blob, rng, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist, pine } from '../../ui/part2/paint'
import type { PondGeo } from '../../ui/part2/perspectives'
import { circleStones, f1, gdefs, ink, onTop, roof, wood, woodG } from '../t34/night'

/**
 * Scene 5's painting (perspectiveCircle art): a small pavilion and pines on the far shore; on each of the five stones a
 * candle that lights once the stone has been heard; the speaker's words fall as a shadow of script on the water while
 * their stone is chosen; with all five lit the water stills and an ensō shows on it. All by CSS (:has on the stones).
 */
export function vibeArt(g: PondGeo): SVGElement[] {
  gdefs()
  const { w, cx, cy, rx, ry, seed } = g
  const r = rng(seed)
  const { pts, bw, bh } = circleStones(g, 5)
  const candles = pts.map(([x, y], k) => {
    const top = y - bh * 0.6
    const ch = bh * 0.3, cw = Math.max(3, bw * 0.05)
    return s('g', { class: `t36v-candle t36v-c${k + 1}` },
      s('circle', { class: 't36v-halo', cx: f1(x), cy: f1(top - ch - cw), r: f1(bh * 0.55), fill: 'url(#p2-lamp)' }),
      s('ellipse', { class: 't36v-dish', cx: f1(x), cy: f1(top), rx: f1(cw * 1.8), ry: f1(cw * 0.5) }),
      s('rect', { class: 't36v-wax', x: f1(x - cw / 2), y: f1(top - ch), width: f1(cw), height: f1(ch) }),
      ink(stroke([[x - cw / 2, top - ch], [x - cw / 2, top]], 0.8, 0.1, 0.1, 0.5), 'g12-rim'),
      ink(`M${f1(x)} ${f1(top - ch - cw * 2.6)}Q${f1(x + cw * 0.8)} ${f1(top - ch - cw * 0.8)} ${f1(x)} ${f1(top - ch - 0.5)}Q${f1(x - cw * 0.8)} ${f1(top - ch - cw * 0.8)} ${f1(x)} ${f1(top - ch - cw * 2.6)}Z`, 't36v-flame'))
  })
  // a shadow of script on the water in front of each stone: short vertical columns of brushed marks
  const words = pts.map(([x, y], k) => {
    const wx = cx + (x - cx) * 0.42, wy = cy + (y - cy) * 0.38
    let d = ''
    for (let c = 0; c < 3; c++) for (let j = 0; j < 3; j++) {
      const mx = wx + (c - 1) * rx * 0.07, my = wy - ry * 0.18 + j * ry * 0.15
      d += stroke([[mx - rx * 0.02, my], [mx + rx * 0.015 * (r() - 0.3), my + ry * 0.06]], 1.6 + r() * 1.4, 0.2, 0.3, 0.2) + (r() < 0.6 ? stroke([[mx - rx * 0.02, my + ry * 0.03], [mx + rx * 0.02, my + ry * 0.028]], 1.2, 0.2, 0.2, 0.2) : '')
    }
    return ink(d, `t36v-words t36v-w${k + 1}`, 'wash')
  })
  const enso = Array.from({ length: 41 }, (_, i) => { const a = -1.75 + (i / 40) * Math.PI * 1.88; return [cx + Math.cos(a) * rx * 0.42, cy + Math.sin(a) * ry * 0.62] as Pt })
  const clip = `t36v-clip-${seed}`
  const px = cx - rx * 0.5, py = cy - ry * 1.05, pw = rx * 0.26
  return [
    mist(cx, cy - ry * 1.4, w * 0.62, ry * 1.2),
    hills(-w * 0.05, w * 1.05, cy - ry * 0.75, ry * 1.2, seed, 0.88, 5),
    mist(cx, cy - ry * 0.85, rx * 2.4, ry * 0.45),
    // the pavilion on the far shore, two pines leaning over the water
    woodG([wood([px, py], [px, py - pw * 0.7], pw * 0.07, seed + 1), wood([px + pw, py], [px + pw, py - pw * 0.7], pw * 0.07, seed + 2)]),
    ink(roof(px, px + pw, py - pw * 0.72, pw / 50, pw * 0.36), 'g12-eave', 'rough'),
    pine(cx + rx * 0.82, cy - ry * 0.9, ry * 1.5, seed + 3, -1),
    onTop(s('g', { class: 't36v-front' },
      s('clipPath', { id: clip }, s('path', { d: blob(cx, cy, rx, ry, seed, 0.05) })),
      s('g', { 'clip-path': `url(#${clip})` }, ...words,
        ink(stroke(enso, Math.max(4, rx * 0.05), 0.06, 0.55, 0.12), 't36v-enso', 'rough')),
      ...candles)),
  ]
}
