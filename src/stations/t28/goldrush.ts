import { s } from '../../core/dom'
import { curve, rng, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist, paperLantern } from '../../ui/part2/paint'
import type { TideArt } from '../../ui/part2/tide'
import { f1 } from './frame'
import { figure, P } from './brush'

/** One shovel lying along p → q: a wooden handle with a D-grip at p, the blade at q (all strokes, no fill rules). */
function shovel(p: Pt, q: Pt, k: number): { wood: string; blade: string } {
  const L = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1
  const ux = (q[0] - p[0]) / L, uy = (q[1] - p[1]) / L
  const nx = -uy, ny = ux
  const bw = k * 0.32, bl = k * 0.42
  const b0: Pt = [q[0] - ux * bl * 0.1, q[1] - uy * bl * 0.1]
  const tip: Pt = [q[0] + ux * bl, q[1] + uy * bl]
  const blade = `M${P([b0[0] + nx * bw * 0.5, b0[1] + ny * bw * 0.5])}L${P([b0[0] + nx * bw * 0.5 + ux * bl * 0.7, b0[1] + ny * bw * 0.5 + uy * bl * 0.7])}Q${P([tip[0] + nx * bw * 0.2, tip[1] + ny * bw * 0.2])} ${P(tip)}Q${P([tip[0] - nx * bw * 0.2, tip[1] - ny * bw * 0.2])} ${P([b0[0] - nx * bw * 0.5 + ux * bl * 0.7, b0[1] - ny * bw * 0.5 + uy * bl * 0.7])}L${P([b0[0] - nx * bw * 0.5, b0[1] - ny * bw * 0.5])}Z`
  const grip = stroke(curve([p[0] + nx * k * 0.1, p[1] + ny * k * 0.1], [p[0] - ux * k * 0.16, p[1] - uy * k * 0.16], [p[0] - nx * k * 0.1, p[1] - ny * k * 0.1], 6), Math.max(0.9, k * 0.05), 0.1, 0.1, 0.5)
  return { wood: stroke([p, q], Math.max(1, k * 0.06), 0.05, 0.05, 0.7) + grip, blade }
}

/** Goldrush scroll: a seller's tent by the track under far gold hills; at each milestone a heap of shovels, taller each time. */
export function goldrushArt(n: number): TideArt {
  return {
    back({ w, h, ground, xs, seed }) {
      const gap = xs[1] - xs[0]
      const tw = Math.min(h * 0.3, gap * 0.85), th = tw * 0.82
      const tx = (xs[n - 1] + xs[n]) / 2 + gap * 0.08
      const tg = ground - h * 0.05 // the tent stands a little behind the track
      const r = rng(seed + 5)
      // the tent: two poles, a sagging canvas roof with a scalloped valance, a lantern, the seller and shovels for sale
      const roof = `M${P([tx - tw * 0.62, tg - th * 0.6])}Q${P([tx, tg - th * 0.5])} ${P([tx + tw * 0.62, tg - th * 0.64])}L${P([tx + tw * 0.32, tg - th])}Q${P([tx, tg - th * 1.04])} ${P([tx - tw * 0.34, tg - th * 0.97])}Z`
      let val = `M${P([tx - tw * 0.62, tg - th * 0.6])}`
      for (let i = 0; i < 6; i++) {
        const x0 = tx - tw * 0.62 + (tw * 1.24 * i) / 6, x1 = tx - tw * 0.62 + (tw * 1.24 * (i + 1)) / 6
        const y0 = tg - th * (0.6 + 0.04 * (i / 6)), y1 = tg - th * (0.6 + 0.04 * ((i + 1) / 6))
        val += `Q${P([(x0 + x1) / 2, (y0 + y1) / 2 + th * 0.1])} ${P([x1, y1])}`
      }
      val += `L${P([tx + tw * 0.62, tg - th * 0.64])}Q${P([tx, tg - th * 0.54])} ${P([tx - tw * 0.62, tg - th * 0.6])}Z`
      let wares = ''
      for (let i = 0; i < 4; i++) {
        const x = tx + tw * (0.38 + i * 0.07)
        const sh = shovel([x - th * 0.1, tg - th * (0.62 - i * 0.02)], [x + th * 0.06, tg - th * 0.12], th * 0.36)
        wares += sh.wood + sh.blade
      }
      const poles = stroke([[tx - tw * 0.55, tg], [tx - tw * 0.55, tg - th * 0.6]], Math.max(1.4, tw * 0.025), 0.05, 0.1, 0.6) +
        stroke([[tx + tw * 0.55, tg], [tx + tw * 0.55, tg - th * 0.64]], Math.max(1.4, tw * 0.025), 0.05, 0.1, 0.6)
      const goldHills = hills(w * 0.06, w * 0.62, ground - h * 0.06, h * 0.42, seed + 2, 0.55, 3)
      return [
        mist(w * 0.45, ground - h * 0.4, w * 0.7, h * 0.42),
        hills(-w * 0.02, w * 1.02, ground - h * 0.12, h * 0.34, seed + 1, 0.9, 6),
        goldHills,
        mist(w * 0.4, ground - h * 0.05, w * 0.6, h * 0.14),
        // tiny prospectors with shovels on their shoulders, walking toward the tent
        ...[0.32, 0.44, 0.52].map((k, i) => s('path', { class: 'gb-figure t28r-walker', d: figure(w * k + (r() - 0.5) * 10, ground - h * 0.03, h * (0.07 - i * 0.008), seed + 9 + i, 1, { hat: 'cone', stoop: 0.25 }) + stroke([[w * k - h * 0.02, ground - h * 0.075], [w * k + h * 0.05, ground - h * 0.1]], 1, 0.1, 0.1, 0.5) })),
        s('ellipse', { class: 'gb-shadow', cx: f1(tx + tw * 0.05), cy: f1(tg + 1), rx: f1(tw * 0.75), ry: f1(Math.max(3, th * 0.06)) }),
        s('path', { class: 't28r-pole', d: poles, filter: 'url(#ink-rough)' }),
        s('path', { class: 'gb-figure', d: figure(tx - tw * 0.1, tg, th * 0.5, seed + 3, 1, { hat: 'cap', stoop: 0.1 }) }),
        s('path', { class: 't28r-crate', d: `M${P([tx - tw * 0.02, tg])}h${f1(tw * 0.3)}v${f1(-th * 0.2)}h${f1(-tw * 0.3)}Z`, filter: 'url(#ink-rough)' }),
        s('path', { class: 't28r-wares', d: wares }),
        s('path', { class: 'gb-plaster t28r-canvas', d: roof, filter: 'url(#ink-rough)' }),
        s('path', { class: 'gb-stone-sh', d: roof }),
        s('path', { class: 't28r-valance', d: val, filter: 'url(#ink-rough)' }),
        paperLantern(tx - tw * 0.5, tg - th * 0.58, Math.max(3.5, tw * 0.05), seed, Math.max(4, th * 0.06)),
      ]
    },
    mark(i, size, seed) {
      const r = rng(seed)
      const k = size
      const H = k * (0.28 + i * 0.3), W = k * (1 + i * 0.36)
      const surf = (x: number) => -H * Math.max(0, 1 - Math.pow(Math.abs(x - W * 0.04) / (W * 0.6), 1.7))
      const pts: Pt[] = []
      for (let j = 0; j <= 16; j++) {
        const x = -W * 0.6 + (W * 1.2 * j) / 16
        pts.push([x, surf(x) + (j % 3 ? 0 : (r() - 0.5) * H * 0.06)])
      }
      const mound = `M${P(pts[0])}L${pts.slice(1).map(P).join('L')}Z`
      // shovels stuck in the heap: handles up and outward, blades buried to the shoulder; more every season
      let wood = '', blades = '', cun = '', lyW = '', lyB = ''
      const count = 2 + i * 2
      for (let j = 0; j < count; j++) {
        const x = (((j + 0.5) / count) - 0.5) * W * 0.9 + (r() - 0.5) * W * 0.05
        const len = k * (0.5 + r() * 0.2)
        if (j % 3 === 1) {
          // one lying down the slope, blade toward the foot, on top of the heap
          const dir = x < W * 0.04 ? -1 : 1
          const y = surf(x) * 0.9
          const x2 = x + dir * len * 0.8, y2 = Math.min(-1, surf(x2) * 0.9)
          const sh = shovel([x, y], [x2, y2], k * 0.5)
          lyW += sh.wood
          lyB += sh.blade
          continue
        }
        const y = surf(x) * (0.7 + r() * 0.25)
        const lean = (x / (W * 0.6)) * 50 + (r() - 0.5) * 30
        const a = ((-90 + lean) * Math.PI) / 180
        const grip: Pt = [x + Math.cos(a) * len, y + Math.sin(a) * len]
        const sh = shovel(grip, [x, y], k * 0.46)
        wood += sh.wood
        blades += sh.blade
      }
      for (let j = 0; j < 4 + i * 2; j++) {
        const x = (r() - 0.5) * W * 0.9, y = surf(x) * (0.2 + r() * 0.6)
        cun += stroke([[x, y], [x + k * 0.12, y + (r() - 0.3) * k * 0.08]], 1 + r(), 0.2, 0.4, 0.1)
      }
      return s('g', { class: 't28r-heap' },
        s('ellipse', { class: 'gb-shadow', cx: f1(W * 0.08), cy: 1.5, rx: f1(W * 0.62), ry: f1(Math.max(2.5, H * 0.08)) }),
        s('path', { class: 't28r-wares', d: wood }),
        s('path', { class: 't28r-blade', d: blades }),
        s('path', { class: 't28r-earth', d: mound, filter: 'url(#ink-rough)' }),
        s('path', { class: 't28r-cun', d: cun }),
        s('path', { class: 't28r-wares', d: lyW }),
        s('path', { class: 't28r-blade', d: lyB }),
        s('path', { class: 'gb-rim-hi', d: stroke(pts.slice(2, 9).map(([x, y]) => [x, y + 1.2] as Pt), Math.max(1, k * 0.03), 0.2, 0.4, 0.1) }))
    },
  }
}
