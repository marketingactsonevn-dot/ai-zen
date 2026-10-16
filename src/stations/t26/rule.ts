import { s } from '../../core/dom'
import { blob, curve, rng, stoneArt, stroke } from '../../ui/part2/ink'
import type { TideArt } from '../../ui/part2/tide'
import { grass, hills, mist, pine } from '../../ui/part2/paint'
import { bamboo, f1 } from '../t25/kit'

const ink = (d: string, cls = 't26r-ink') => s('path', { class: `zk-ink ${cls}`, d, filter: 'url(#ink-rough)' })
const rockFill = (d: string) => [s('path', { class: 't26r-stone', d, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }), s('path', { d, fill: 'url(#p2-shade)' })]
const shadow = (w: number) => s('ellipse', { class: 't26r-sh', cx: f1(w * 0.06), cy: 1.5, rx: f1(w * 0.55), ry: f1(Math.max(2.5, w * 0.08)) })

/** 0 · the call: a letter scroll half unrolled on a low stand, columns of writing, a red cord on the roll. */
function scroll(z: number, seed: number) {
  const r = rng(seed)
  const w = z * 1.2, hh = z * 0.5, y = -z * 0.16, x0 = -w * 0.5, x1 = w * 0.22
  let cols = ''
  for (let c = 0; c < 5; c++) {
    const x = x1 - w * 0.08 - c * w * 0.12
    for (let yy = y - hh * 0.84; yy < y - hh * 0.14; yy += 3.2 + r() * 2.4) if (r() < 0.82) cols += stroke([[x - 1.6, yy], [x + 1.6, yy + 0.5]], 1.4, 0.2, 0.2, 0.3)
  }
  const sheet = `M${f1(x0)} ${f1(y)}L${f1(x1)} ${f1(y)}L${f1(x1)} ${f1(y - hh)}L${f1(x0 + 2)} ${f1(y - hh * 0.97)}Z`
  return s('g', null, shadow(w),
    ...rockFill(`M${f1(-w * 0.52)} 0L${f1(-w * 0.47)} ${f1(-z * 0.16)}L${f1(w * 0.47)} ${f1(-z * 0.16)}L${f1(w * 0.52)} 0Z`),
    s('path', { class: 't26r-paper', d: sheet }),
    ink(stroke([[x0, y - hh * 0.97], [x1, y - hh]], 1.6, 0.1, 0.1, 0.3) + stroke([[x0, y], [x1, y]], 1.6, 0.1, 0.1, 0.3) + stroke([[x0, y], [x0 + 2, y - hh * 0.97]], 1.4, 0.1, 0.1, 0.3), 't26r-ink t26r-edge'),
    ink(cols, 't26r-ink t26r-text'),
    s('path', { class: 't26r-seal', d: blob(x0 + w * 0.08, y - hh * 0.22, 2.6, 2.6, 2, 0.1, 8) }),
    // the roll: a short cylinder with its end showing
    s('path', { class: 't26r-paper', d: `M${f1(x1)} ${f1(y - hh * 1.04)}L${f1(x1 + w * 0.2)} ${f1(y - hh * 1.04)}L${f1(x1 + w * 0.2)} ${f1(y + 1)}L${f1(x1)} ${f1(y + 1)}Z` }),
    s('path', { class: 't26r-wood', d: blob(x1 + w * 0.21, y - hh * 0.52, w * 0.035, hh * 0.56, 3, 0.04, 10) }),
    ink(stroke([[x1, y - hh * 1.04], [x1 + w * 0.2, y - hh * 1.04]], 1.4, 0.1, 0.1, 0.3) + stroke([[x1, y + 1], [x1 + w * 0.2, y + 1]], 1.4, 0.1, 0.1, 0.3)),
    s('path', { class: 't26r-cord', d: stroke([[x1 + w * 0.1, y - hh * 1.06], [x1 + w * 0.12, y - hh * 0.5], [x1 + w * 0.1, y + 1]], 2.2, 0.1, 0.1, 0.3) + stroke([[x1 + w * 0.11, y - hh * 0.4], [x1 + w * 0.2, y + hh * 0.16]], 1.6, 0.1, 0.5, 0.2) + stroke([[x1 + w * 0.11, y - hh * 0.4], [x1 + w * 0.04, y + hh * 0.18]], 1.6, 0.1, 0.5, 0.2) }))
}

/** 1 · the programme opens: a bamboo gate, one leaf swung half open. */
function gate(z: number, seed: number) {
  const w = z * 1.05, hh = z * 1.1
  const posts = [bamboo([-w * 0.42, 2], [-w * 0.42, -hh], z * 0.09, seed, 2), bamboo([w * 0.42, 2], [w * 0.42, -hh], z * 0.09, seed + 1, 2)]
  const top = bamboo([-w * 0.56, -hh * 0.9], [w * 0.56, -hh * 0.93], z * 0.08, seed + 2, 2)
  let slats = ''
  // the open leaf: hinged on the left post, swung toward us — narrower, its top edge tilting
  const lx = -w * 0.38, rx = w * 0.02
  for (let i = 0; i < 5; i++) {
    const t = i / 4, x = lx + (rx - lx) * t
    slats += stroke([[x, -2 - t * hh * 0.03], [x + 0.6, -hh * (0.76 - t * 0.06)]], z * 0.06, 0.03, 0.05, 0.7)
  }
  slats += stroke([[lx, -hh * 0.2], [rx, -hh * 0.22]], z * 0.045, 0.05, 0.05, 0.6) + stroke([[lx, -hh * 0.58], [rx, -hh * 0.64]], z * 0.045, 0.05, 0.05, 0.6)
  return s('g', null, shadow(w),
    s('path', { class: 't26r-light', d: `M${f1(rx + 2)} 0L${f1(w * 0.4)} 0L${f1(w * 0.4)} ${f1(-hh * 0.86)}L${f1(rx + 2)} ${f1(-hh * 0.8)}Z` }),
    s('path', { class: 'zk-cane', d: posts[0].cane + posts[1].cane + top.cane, filter: 'url(#ink-rough)' }),
    s('path', { class: 'zk-knot', d: posts[0].knots + posts[1].knots + top.knots }),
    s('path', { class: 'zk-cane t26r-slat', d: slats, filter: 'url(#ink-rough)' }),
    ink(stroke([[-w * 0.47, -hh * 0.86], [-w * 0.37, -hh * 0.8]], 1.4, 0.2, 0.2, 0.3) + stroke([[w * 0.37, -hh * 0.88], [w * 0.47, -hh * 0.82]], 1.4, 0.2, 0.2, 0.3)))
}

/** 2 · a door that can be closed: plank door in a stone frame, its bar lifted aside, ready. */
function door(z: number, seed: number) {
  const w = z * 0.9, hh = z * 1.12
  const r = rng(seed)
  let planks = ''
  for (let i = 1; i < 4; i++) planks += stroke([[-w * 0.32 + i * w * 0.16, -2], [-w * 0.32 + i * w * 0.16 + (r() - 0.5), -hh * 0.82]], 1.2, 0.1, 0.1, 0.4)
  const frame = `M${f1(-w * 0.5)} 0L${f1(-w * 0.5)} ${f1(-hh)}L${f1(w * 0.5)} ${f1(-hh)}L${f1(w * 0.5)} 0L${f1(w * 0.36)} 0L${f1(w * 0.36)} ${f1(-hh * 0.86)}L${f1(-w * 0.36)} ${f1(-hh * 0.86)}L${f1(-w * 0.36)} 0Z`
  return s('g', null, shadow(w),
    ...rockFill(frame),
    s('path', { class: 't26r-wood', d: `M${f1(-w * 0.34)} 0L${f1(-w * 0.34)} ${f1(-hh * 0.84)}L${f1(w * 0.34)} ${f1(-hh * 0.84)}L${f1(w * 0.34)} 0Z`, filter: 'url(#ink-rough)' }),
    ink(planks, 't26r-ink t26r-plank'),
    s('path', { class: 't26r-iron', d: blob(-w * 0.2, -hh * 0.44, w * 0.05, w * 0.05, 2, 0.1, 8) + blob(w * 0.2, -hh * 0.44, w * 0.05, w * 0.05, 3, 0.1, 8) }),
    // the bar, lifted and leaning at the right of the frame: one move to drop it across
    s('path', { class: 't26r-bar', d: stroke([[w * 0.56, -2], [w * 0.62, -hh * 0.5], [w * 0.66, -hh * 0.98]], z * 0.09, 0.05, 0.05, 0.8), filter: 'url(#ink-rough)' }),
    ink(stroke([[-w * 0.5, -hh], [w * 0.5, -hh - 1]], z * 0.07, 0.05, 0.05, 0.6)))
}

/** 3 · the new rule: an upright stele, rounded crown, lines carved down its face, on a plinth. */
function stele(z: number, seed: number) {
  const w = z * 0.68, hh = z * 1.35
  const r = rng(seed)
  const slab = `M${f1(-w * 0.5)} ${f1(-z * 0.16)}L${f1(-w * 0.47)} ${f1(-hh * 0.8)}Q${f1(-w * 0.45)} ${f1(-hh)} ${f1(0)} ${f1(-hh * 1.02)}Q${f1(w * 0.45)} ${f1(-hh)} ${f1(w * 0.47)} ${f1(-hh * 0.8)}L${f1(w * 0.5)} ${f1(-z * 0.16)}Z`
  let carve = ''
  for (let c = 0; c < 4; c++) {
    const x = w * (0.26 - c * 0.17)
    for (let y = -hh * 0.82; y < -z * 0.3; y += 4 + r() * 3) if (r() < 0.8) carve += stroke([[x - 2.4, y], [x + 2.4, y + 0.4]], 1.5, 0.2, 0.2, 0.3)
  }
  return s('g', null, shadow(w * 1.3),
    ...rockFill(`M${f1(-w * 0.68)} 0L${f1(-w * 0.6)} ${f1(-z * 0.17)}L${f1(w * 0.6)} ${f1(-z * 0.17)}L${f1(w * 0.68)} 0Z` + slab),
    ink(carve, 't26r-ink t26r-carve'),
    s('path', { class: 't26r-rim', d: stroke(curve([-w * 0.44, -hh * 0.78], [-w * 0.4, -hh * 0.98], [w * 0.05, -hh * 1.0], 8), 1.6, 0.2, 0.4, 0.1) }))
}

/** 4 · today: a boundary stone (sekimori-ishi) tied with a black cord — do not pass, for now only by custom. */
function boundary(z: number, seed: number) {
  const w = z * 0.62
  return s('g', null,
    stoneArt(w * 1.4, w * 0.5, seed + 5),
    s('g', { transform: `translate(0 ${f1(-w * 0.5)})` },
      shadow(w * 0.6),
      s('path', { class: 't26r-stone', d: blob(0, -w * 0.32, w * 0.36, w * 0.33, seed, 0.06, 12), fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
      s('path', { d: blob(0, -w * 0.32, w * 0.36, w * 0.33, seed, 0.06, 12), fill: 'url(#p2-shade)' }),
      s('path', { class: 't26r-rope', d: stroke(curve([-w * 0.34, -w * 0.28], [0, -w * 0.12], [w * 0.34, -w * 0.3], 8), 2.4, 0.05, 0.05, 0.6) + stroke(curve([0, -w * 0.66], [w * 0.1, -w * 0.32], [0, -w * 0.02], 8), 2.4, 0.05, 0.05, 0.6) + stroke(curve([-w * 0.02, -w * 0.66], [-w * 0.18, -w * 0.82], [-w * 0.1, -w * 0.9], 5), 2, 0.1, 0.4, 0.3) + stroke(curve([w * 0.02, -w * 0.66], [w * 0.18, -w * 0.8], [w * 0.12, -w * 0.9], 5), 2, 0.1, 0.4, 0.3) + blob(0, -w * 0.67, 3, 2.6, 4, 0.1, 8), filter: 'url(#ink-rough)' })))
}

/** The scroll's painting for "Luật & phúc lợi": far hills, a pine on a near rise, mist gathering toward today. */
export const ruleArt: TideArt = {
  back({ w, h, ground, xs, roll, seed }) {
    const r = rng(seed)
    const tufts = xs.slice(0, -1).map((x, i) => grass(x + (xs[1] - xs[0]) * (0.45 + r() * 0.1), ground + 2, 14 + r() * 8, seed + 40 + i))
    return [
      mist(w * 0.4, ground - h * 0.4, w * 0.6, h * 0.36),
      hills(roll, w - roll, ground - h * 0.12, Math.min(h * 0.3, 110), seed, 0.9, 6),
      hills(roll + w * 0.12, w * 0.62, ground - h * 0.03, Math.min(h * 0.18, 70), seed + 1, 0.72, 3),
      pine(xs[1] + (xs[2] - xs[1]) * 0.5, ground - Math.min(h * 0.18, 70) * 0.7, Math.min(h * 0.34, 120), seed + 2, -1),
      mist(w * 0.5, ground - h * 0.08, w * 0.62, h * 0.12),
      ...tufts,
    ]
  },
  mark(i, size, seed) {
    const z = size * 1.05
    return [() => scroll(z, seed), () => gate(z, seed), () => door(z, seed), () => stele(z, seed), () => boundary(z, seed)][Math.min(i, 4)]()
  },
}

