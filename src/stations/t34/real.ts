import { s } from '../../core/dom'
import { blob, clamp, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist, toro } from '../../ui/part2/paint'
import type { PondGeo } from '../../ui/part2/perspectives'
import { circleStones, f1, ink, onTop, P, wood, woodG } from './night'

/** A model standing on (x, y), H tall, in brush strokes: [coat wash, ink strokes, vermilion scarf]. */
function model(x: number, y: number, H: number): [string, string, string] {
  const k = (a: number, b: number): Pt => [x + a * H, y - b * H]
  const coat = `M${P(k(-0.085, 0.8))}Q${P(k(-0.11, 0.55))} ${P(k(-0.15, 0.31))}L${P(k(0.13, 0.3))}Q${P(k(0.1, 0.55))} ${P(k(0.085, 0.8))}Q${P(k(0, 0.835))} ${P(k(-0.085, 0.8))}Z`
  const strokes =
    blob(x, y - H * 0.915, H * 0.052, H * 0.064, 7, 0.08, 10) +
    stroke([k(-0.04, 0.3), k(-0.045, 0.15), k(-0.05, 0)], H * 0.032, 0.05, 0.2, 0.5) +
    stroke([k(0.03, 0.3), k(0.045, 0.15), k(0.065, 0.005)], H * 0.032, 0.05, 0.2, 0.5) +
    stroke([k(0.085, 0.78), k(0.16, 0.62), k(0.1, 0.5)], H * 0.026, 0.1, 0.3, 0.5) +
    stroke([k(-0.08, 0.78), k(-0.11, 0.6), k(-0.12, 0.44)], H * 0.026, 0.1, 0.3, 0.5) +
    stroke([k(-0.085, 0.8), k(-0.12, 0.56), k(-0.15, 0.31)], H * 0.02, 0.1, 0.1, 0.3) +
    stroke([k(-0.15, 0.31), k(0, 0.29), k(0.13, 0.3)], H * 0.018, 0.1, 0.1, 0.3)
  const scarf = stroke([k(-0.06, 0.83), k(0.02, 0.8), k(0.07, 0.83)], H * 0.04, 0.2, 0.2, 0.4) + stroke([k(0.05, 0.82), k(0.07, 0.7), k(0.05, 0.6)], H * 0.026, 0.1, 0.4, 0.3)
  return [coat, strokes, scarf]
}

/** The same pose mirrored below y0 (feet at y0, head down), drawn as a faceted avatar: straight thin lines, no brush. */
function avatar(x: number, y0: number, H: number): string {
  const k = (a: number, b: number) => `${f1(x + a * H)} ${f1(y0 + b * H)}`
  const head = Array.from({ length: 6 }, (_, i) => k(Math.cos((i * Math.PI) / 3) * 0.058, 0.915 + Math.sin((i * Math.PI) / 3) * 0.066))
  return `M${head.join('L')}Z` +
    `M${k(-0.085, 0.8)}L${k(-0.11, 0.55)}L${k(-0.15, 0.31)}L${k(0.13, 0.3)}L${k(0.1, 0.55)}L${k(0.085, 0.8)}Z` +
    `M${k(-0.11, 0.55)}L${k(0.1, 0.55)}L${k(-0.15, 0.31)}M${k(0, 0.8)}L${k(0.1, 0.55)}M${k(-0.085, 0.8)}L${k(0, 0.66)}L${k(0.085, 0.8)}` +
    `M${k(-0.04, 0.3)}L${k(-0.05, 0)}M${k(0.03, 0.3)}L${k(0.065, 0)}M${k(0.085, 0.78)}L${k(0.16, 0.62)}L${k(0.1, 0.5)}M${k(-0.08, 0.78)}L${k(-0.12, 0.44)}`
}

/**
 * Scene 4's painting (perspectiveCircle art): the night lake flat as a mirror, a wooden bridge over its far side with a
 * model standing on it — and under the water her reflection is an avatar drawn in another ink. Beside each of the
 * four stones a small lantern waits; it lights once that stone has been heard (CSS :has on the stone's data-heard).
 */
export function realArt(g: PondGeo): SVGElement[] {
  const { w, cx, cy, rx, ry, seed } = g
  const half = rx * 0.82
  const yEnd = cy - ry * 0.98, rise = ry * 0.36
  const deck = (x: number) => yEnd - rise * (1 - ((x - cx) / half) ** 2)
  const arch: Pt[] = Array.from({ length: 17 }, (_, i) => { const x = cx - half + (i * 2 * half) / 16; return [x, deck(x)] })
  const rail = arch.map(([x, y]) => [x, y - ry * 0.2] as Pt)
  const posts = [0, 3, 6, 10, 13, 16].map((i) => wood(arch[i], rail[i], Math.max(2, rx * 0.012), seed + i))
  const legs = [2, 6, 10, 14].map((i) => wood(arch[i], [arch[i][0], yEnd + ry * 0.04], Math.max(2.4, rx * 0.016), seed + 30 + i))
  const fx = cx - rx * 0.3, fy = deck(fx) - 1
  const H = clamp(ry * 0.95, 34, 130)
  const [coat, body, scarf] = model(fx, fy, H)
  // reflections: the water line just under the bridge; the bridge's arch and the avatar mirrored below it
  const yw = yEnd + ry * 0.05
  const mirror = (y: number) => yw + (yw - y) * 0.9
  let ghost = ''
  for (let i = 0; i < 16; i += 2) ghost += stroke([[arch[i][0], mirror(arch[i][1])], [arch[i + 1][0], mirror(arch[i + 1][1])], [arch[i + 2][0], mirror(arch[i + 2][1])]], Math.max(1.5, ry * 0.035), 0.2, 0.2, 0.3)
  let breaks = ''
  for (let i = 0; i < 7; i++) {
    const y = mirror(fy) + (H * (i + 0.6)) / 7
    breaks += stroke([[fx - H * 0.22, y], [fx + H * 0.24, y + 0.6]], 1.2 + (i % 3) * 0.5, 0.2, 0.2, 0.2)
  }
  const clipId = `t34r-clip-${seed}`
  const { pts, bw, bh } = circleStones(g, 4)
  const lamps = pts.map(([x, y], k) => {
    const side = x < cx ? -1 : 1
    return s('g', { class: `t34r-lamp t34r-lamp-${k + 1}` }, toro(x + side * bw * 0.64, y + bh * 0.12, bh * 0.82, true))
  })
  return [
    mist(cx, cy - ry * 1.4, w * 0.62, ry * 1.2),
    hills(-w * 0.05, w * 1.05, cy - ry * 0.8, Math.min(ry * 1.3, cy - ry * 0.8), seed, 0.88, 5),
    mist(cx, cy - ry * 0.85, rx * 2.4, ry * 0.45),
    onTop(s('g', { class: 't34r-front' },
      s('clipPath', { id: clipId }, s('path', { d: blob(cx, cy, rx, ry, seed, 0.05) })),
      s('g', { 'clip-path': `url(#${clipId})` },
        ink(ghost, 't34r-ghost', 'wash'),
        s('path', { class: 't34r-avatar', d: avatar(fx, mirror(fy), H) }),
        ink(breaks, 't34r-break')),
      woodG([...legs]),
      ink(stroke(arch, Math.max(4, ry * 0.075), 0.02, 0.02, 0.8), 't34r-deck', 'rough'),
      ink(stroke(arch.map(([x, y]) => [x, y - 1.5] as Pt), Math.max(1, ry * 0.018), 0.1, 0.1, 0.2), 'g12-rim'),
      woodG([...posts, { face: stroke(rail, Math.max(2, ry * 0.03), 0.05, 0.05, 0.6), grain: '', edge: '', rim: '' }]),
      ink(coat, 't34r-coat', 'wash'),
      ink(body, 't34r-body', 'rough'),
      ink(scarf, 't34r-scarf', 'rough'),
      ...lamps)),
  ]
}
