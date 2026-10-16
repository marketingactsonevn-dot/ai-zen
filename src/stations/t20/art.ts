import { s } from '../../core/dom'
import { blob, rng, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import type { PondGeo } from '../../ui/part2/perspectives'
import type { TideArt } from '../../ui/part2/tide'
import { grass, hills, mist, reeds, wash } from '../../ui/part2/paint'

const f1 = (n: number) => n.toFixed(1)

/** A course of brushed stones along a curve (a well's rim): rock-faced blobs, ink-edged, a moonlit top on each. */
export function rimStones(pts: Pt[], size: number, seed: number, cls = 't20-rim'): SVGGElement {
  const r = rng(seed)
  let d = '', hi = ''
  for (const [x, y] of pts) {
    const w = size * (0.75 + r() * 0.5), hh = size * (0.45 + r() * 0.2)
    d += blob(x, y, w / 2, hh / 2, Math.round(x * 7 + y), 0.14, 12)
    hi += stroke([[x - w * 0.32, y - hh * 0.28], [x, y - hh * 0.42], [x + w * 0.25, y - hh * 0.3]], Math.max(1, hh * 0.18), 0.3, 0.3, 0.1)
  }
  return s('g', { class: cls },
    s('path', { class: 't20-rim-stone', d, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
    s('path', { class: 't20-rim-hi', d: hi }))
}

/** Points along an ellipse arc (degrees). */
export const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n: number): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / Math.max(1, n - 1)) * Math.PI) / 180
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as Pt
  })

/**
 * Scene 1 · Giếng sỏi: the scroll is the long mouth of an old well under the moon — stone courses on both lips, dark
 * water between. Each milestone is a pebble that has just dropped in: rings spreading on the water, the pebble sinking
 * a little deeper than the one before.
 */
export const wellArt: TideArt = {
  back({ w, h, ground, xs, roll, seed }) {
    const n = xs.length - 1
    const x0 = xs[0] - 40, x1 = xs[Math.max(0, n - 1)] + 40
    const far = ground - h * 0.2, near = ground - h * 0.075
    const mid = (far + near) / 2, ry = (near - far) / 2
    const mouth = `M${f1(x0)} ${f1(mid)}C${f1(x0)} ${f1(far)} ${f1(x0 + ry)} ${f1(far)} ${f1(x0 + ry * 2)} ${f1(far)}L${f1(x1 - ry * 2)} ${f1(far)}C${f1(x1 - ry)} ${f1(far)} ${f1(x1)} ${f1(far)} ${f1(x1)} ${f1(mid)}C${f1(x1)} ${f1(near)} ${f1(x1 - ry)} ${f1(near)} ${f1(x1 - ry * 2)} ${f1(near)}L${f1(x0 + ry * 2)} ${f1(near)}C${f1(x0 + ry)} ${f1(near)} ${f1(x0)} ${f1(near)} ${f1(x0)} ${f1(mid)}Z`
    const r = rng(seed + 4)
    let glint = ''
    for (let i = 0; i < 26; i++) {
      const x = x0 + ry * 2 + r() * (x1 - x0 - ry * 4), y = far + (near - far) * (0.45 + r() * 0.45)
      const len = 8 + r() * 26
      glint += stroke([[x, y], [x + len, y + (r() - 0.5)]], 1 + r() * 0.8, 0.3, 0.3, 0.1)
    }
    const lip = (y: number, k: number, sd: number, inset = 0) => {
      const pts: Pt[] = []
      for (let x = x0 + 6 + inset; x < x1 - 4; x += 16 * k + r() * 8) pts.push([x, y + (r() - 0.5) * 2])
      return rimStones(pts, 20 * k, sd)
    }
    // the curb's outer face: two courses of stones from the near lip down to the ground
    const face = `M${f1(x0 + ry)} ${f1(near)}H${f1(x1 - ry)}L${f1(x1 - ry * 0.6)} ${f1(ground)}H${f1(x0 + ry * 0.6)}Z`
    return [
      mist(w * 0.5, ground - h * 0.42, w * 0.7, h * 0.36),
      hills(roll, w - roll, ground - h * 0.2, h * 0.32, seed, 0.9, 6),
      mist(w * 0.5, ground - h * 0.2, w * 0.6, h * 0.08),
      wash(blob((x0 + x1) / 2, near + 4, (x1 - x0) * 0.55, h * 0.06, seed + 5, 0.1), 0.2),
      lip(far - 2, 0.75, seed + 6),
      s('path', { class: 't20-well-water', d: mouth }),
      s('path', { class: 't20-well-wall', d: `M${f1(x0 + ry)} ${f1(far)}H${f1(x1 - ry)}V${f1(far + (near - far) * 0.45)}Q${f1((x0 + x1) / 2)} ${f1(far + (near - far) * 0.25)} ${f1(x0 + ry)} ${f1(far + (near - far) * 0.45)}Z`, filter: 'url(#ink-wash)' }),
      s('path', { class: 't20-well-glint', d: glint }),
      s('path', { class: 't20-well-face', d: face, fill: 'url(#p2-rock)' }),
      lip((near + ground) / 2 + 2, 0.8, seed + 10, 8),
      lip(ground - 2, 0.85, seed + 11),
      lip(near + 1, 1, seed + 7),
      grass(x0 - 6, near + 4, 22, seed + 8),
      grass(x1 + 8, near + 4, 18, seed + 9),
    ]
  },
  mark(i, size, seed) {
    const y = -size * 0.62 - 6
    const r = rng(seed)
    const sink = 3 + i * 1.6
    return s('g', { class: 't20-drop' },
      s('g', { transform: `translate(${f1((r() - 0.5) * 6)} ${f1(y + sink)})`, style: `opacity:${Math.max(0.25, 0.85 - i * 0.07).toFixed(2)}` }, stoneArt(size * 0.32, size * 0.2, seed)),
      ...[0.3, 0.55, 0.85].map((k) => s('ellipse', { class: 't20-ring', cx: 0, cy: f1(y), rx: f1(size * k), ry: f1(size * k * 0.2) })))
  },
}

/** Scene 4 · the four stones stand round the mouth of a moon well: a ring of rim stones round the water, moss, grass. */
export function wellRing(g: PondGeo): SVGElement[] {
  const { cx, cy, rx, ry, seed, w, h } = g
  return [
    mist(cx, cy - ry * 1.3, w * 0.62, ry * 1.1),
    hills(-w * 0.05, w * 1.05, cy - ry * 0.75, Math.min(ry * 1.4, h * 0.3), seed, 0.85, 5),
    mist(cx, cy - ry * 0.8, rx * 2.4, ry * 0.5),
    rimStones(arc(cx, cy, rx * 1.08, ry * 1.13, 0, 348, 30), Math.max(12, rx * 0.17), seed + 3),
    wash(blob(cx - rx * 0.7, cy + ry * 1.1, rx * 0.35, ry * 0.12, seed + 4, 0.2), 0.16, 'p2p-wash p2c-moss'),
    reeds(cx + rx * 1.15, cy + ry * 0.4, Math.max(16, ry * 0.7), seed + 5, 6),
  ]
}
