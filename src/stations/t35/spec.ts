import { s } from '../../core/dom'
import { blob, clamp, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist, moon, toro } from '../../ui/part2/paint'
import type { PathGeo } from '../../ui/part2/steps'
import type { TideArt } from '../../ui/part2/tide'
import { bench, doorway, f1, hangingLamp, ink, lake, pebble, roof, wood, woodG } from '../t34/night'

/**
 * The blueprint lying flat on a bench, seen from above at an angle: a quad (near-left, near-right, far-right, far-left)
 * with eight lines of the drawing, each `.t35p-ln-k` — inked by CSS as the k-th stone of the path is placed.
 */
function blueprint(q: [Pt, Pt, Pt, Pt], seed: number): SVGElement[] {
  const [a, b, c, d] = q
  const at = (u: number, v: number): Pt => {
    const x0 = a[0] + (b[0] - a[0]) * u, y0 = a[1] + (b[1] - a[1]) * u
    const x1 = d[0] + (c[0] - d[0]) * u, y1 = d[1] + (c[1] - d[1]) * u
    return [x0 + (x1 - x0) * v, y0 + (y1 - y0) * v]
  }
  const w = Math.hypot(b[0] - a[0], b[1] - a[1])
  const lw = Math.max(1, w * 0.012)
  const line = (pts: [number, number][], k = 1) => stroke(pts.map(([u, v]) => at(u, v)), lw * k, 0.1, 0.15, 0.4)
  const ring = (cu: number, cv: number, ru: number, rv: number, a0 = 0, a1 = Math.PI * 2) =>
    line(Array.from({ length: 25 }, (_, i) => { const t = a0 + ((a1 - a0) * i) / 24; return [cu + Math.cos(t) * ru, cv + Math.sin(t) * rv] as [number, number] }))
  // a spec for the koi game, drawn as a plan: title, the screen, the pond, the koi, its path, notes, the seal
  const lines = [
    line([[0.1, 0.84], [0.62, 0.85]], 2.2),
    line([[0.1, 0.72], [0.56, 0.72]]) + line([[0.56, 0.72], [0.56, 0.16]]) + line([[0.56, 0.16], [0.1, 0.16]]) + line([[0.1, 0.16], [0.1, 0.72]]),
    ring(0.33, 0.44, 0.17, 0.2),
    line([[0.25, 0.46], [0.33, 0.52], [0.42, 0.45]], 1.6) + line([[0.25, 0.46], [0.33, 0.39], [0.42, 0.45]], 1.6) + line([[0.42, 0.45], [0.47, 0.5]]) + line([[0.42, 0.45], [0.47, 0.4]]),
    line([[0.2, 0.3], [0.3, 0.26], [0.42, 0.32]], 0.8) + line([[0.4, 0.34], [0.42, 0.32], [0.39, 0.3]], 0.8),
    line([[0.66, 0.66], [0.9, 0.66]]) + line([[0.66, 0.58], [0.86, 0.58]]) + line([[0.66, 0.5], [0.9, 0.5]]),
    line([[0.66, 0.38], [0.84, 0.38]]) + line([[0.66, 0.3], [0.9, 0.3]]) + line([[0.66, 0.22], [0.8, 0.22]]),
    ring(0.82, 0.84, 0.05, 0.07, -1.2, 4.6),
  ]
  const sheet = `M${[a, b, c, d].map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')}Z`
  return [
    s('path', { class: 't35p-sheet', d: sheet, filter: 'url(#ink-rough)' }),
    ink(stroke([a, b], lw * 1.4, 0.05, 0.05, 0.6), 'g12-edge'),
    ...lines.map((d, k) => ink(d, `t35p-ln t35p-ln-${k + 1}${k === 7 ? ' seal' : ''}`, 'rough')),
    // four river pebbles hold the corners down
    ...[a, b, c, d].map((p, k) => pebble(p[0] + (k % 3 ? -1 : 1) * w * 0.02, p[1] + (k < 2 ? -w * 0.01 : w * 0.01), w * (k < 2 ? 0.045 : 0.034), seed + k)),
  ]
}

/** Tools on a batten (a saw, a mallet, a square, two chisels), the batten centred on x at y, about u tall. */
function tools(x: number, y: number, u: number, seed: number): SVGElement[] {
  const pegs = [-0.9, -0.35, 0.15, 0.55, 0.8].map((k) => x + k * u)
  const saw = `M${f1(pegs[0] - u * 0.05)} ${f1(y + u * 0.08)}L${f1(pegs[0] + u * 0.07)} ${f1(y + u * 0.1)}L${f1(pegs[0] + u * 0.12)} ${f1(y + u * 0.9)}L${f1(pegs[0] - u * 0.12)} ${f1(y + u * 0.92)}Z`
  let teeth = ''
  for (let i = 0; i < 12; i++) { const yy = y + u * (0.14 + i * 0.065); teeth += stroke([[pegs[0] - u * 0.12 + i * 0.002 * u, yy], [pegs[0] - u * 0.16, yy + u * 0.03]], 1, 0.2, 0.2, 0.3) }
  return [
    woodG([wood([x - u * 1.1, y], [x + u * 1.05, y + 1], Math.max(4, u * 0.06), seed)], 't35p-beam'),
    ink(saw, 't35p-steel', 'rough'),
    ink(teeth + stroke([[pegs[0], y + u * 0.02], [pegs[0], y + u * 0.12]], u * 0.07, 0.1, 0.1, 0.6), 'g12-edge'),
    ink(stroke([[pegs[1], y + u * 0.04], [pegs[1] + u * 0.02, y + u * 0.62]], u * 0.05, 0.05, 0.1, 0.6) + blob(pegs[1] + u * 0.02, y + u * 0.7, u * 0.13, u * 0.09, seed + 1, 0.1, 10), 't35p-wood-tool', 'rough'),
    ink(stroke([[pegs[2], y + u * 0.06], [pegs[2], y + u * 0.78]], u * 0.05, 0.02, 0.02, 0.9) + stroke([[pegs[2], y + u * 0.78], [pegs[2] + u * 0.32, y + u * 0.78]], u * 0.05, 0.02, 0.02, 0.9), 't35p-steel', 'rough'),
    ink([3, 4].map((k) => stroke([[pegs[k], y + u * 0.05], [pegs[k], y + u * 0.32]], u * 0.07, 0.05, 0.05, 0.8) + stroke([[pegs[k], y + u * 0.32], [pegs[k], y + u * 0.6]], u * 0.035, 0.02, 0.4, 0.4)).join(''), 't35p-wood-tool', 'rough'),
  ]
}

/** Scene 4's painting (stepPath art): inside the workshop at night — the open door with the moon, a bench under a hanging lamp, the blueprint on it. */
export function specArt(g: PathGeo): SVGElement[] {
  const { w, h, row, first, last, top, pathY, seed } = g
  if (!row) {
    const cw = first[0] * 2
    const gy = Math.max(10, first[1] + 4)
    const bw = cw * 0.9, bx = last[0] - bw / 2, by = last[1] + clamp(h * 0.07, 30, 52)
    return [
      hangingLamp(last[0] + bw * 0.62, by - 64, 18, 8, seed + 1, [by - 4, bw * 0.55]),
      ...blueprint([[bx + bw * 0.04, by - 2], [bx + bw * 0.96, by - 2], [bx + bw * 0.84, by - bw * 0.3], [bx + bw * 0.16, by - bw * 0.3]], seed + 2),
      bench(bx - 6, bx + bw + 6, by, 22, seed + 3),
      woodG([wood([2, gy + 8], [3, gy + cw * 0.5], 6, seed + 6), wood([cw - 2, gy + 8], [cw - 3, gy + cw * 0.5], 6, seed + 7)]),
      ink(roof(4, cw - 4, gy + 6, cw / 90, cw * 0.08), 'g12-eave', 'rough'),
    ]
  }
  const skyH = pathY - top
  // the bench at the path's end, its top seen from above; the lamp hangs over it from the roof beam
  const bw = clamp(Math.min(w * 0.22, skyH * 1.25), 120, 300)
  const bx1 = Math.min(w - 8, last[0] + bw * 0.22), bx0 = bx1 - bw
  const by = pathY - 6
  const legH = clamp(skyH * 0.2, 22, 60)
  const ty = by - legH
  const deep = bw * 0.34
  const sheet: [Pt, Pt, Pt, Pt] = [[bx0 + bw * 0.16, ty - deep * 0.12], [bx1 - bw * 0.12, ty - deep * 0.14], [bx1 - bw * 0.2, ty - deep * 0.86], [bx0 + bw * 0.22, ty - deep * 0.84]]
  const benchTop = `M${f1(bx0)} ${f1(ty)}L${f1(bx1)} ${f1(ty)}L${f1(bx1 - bw * 0.08)} ${f1(ty - deep)}L${f1(bx0 + bw * 0.1)} ${f1(ty - deep)}Z`
  const dh = clamp(skyH * 0.7, 70, 210), dw = dh * 0.62
  const dx = Math.max(dw * 0.3, first[0] - dw * 0.1)
  const lampX = (bx0 + bx1) / 2
  return [
    // the roof beam, and the tools hanging on the wall between the door and the bench
    woodG([wood([-10, top + skyH * 0.1], [w + 10, top + skyH * 0.08], 10, seed + 4)], 't35p-beam'),
    ...tools(w * 0.5, top + skyH * 0.3, clamp(skyH * 0.42, 50, 130), seed + 5),
    // the door: open on the moonlit garden
    s('g', { 'clip-path': `url(#t35p-door-${seed})` },
      s('rect', { class: 't35p-night', x: f1(dx), y: f1(pathY - 2 - dh), width: f1(dw), height: f1(dh) }),
      moon(dx + dw * 0.42, pathY - dh * 0.72, Math.min(dw * 0.16, 20), seed, true),
      hills(dx - 10, dx + dw + 10, pathY - dh * 0.18, dh * 0.3, seed + 8, 0.7, 2),
      mist(dx + dw / 2, pathY - dh * 0.16, dw * 0.8, dh * 0.12)),
    s('clipPath', { id: `t35p-door-${seed}` }, s('rect', { x: f1(dx), y: f1(pathY - 2 - dh), width: f1(dw * 0.52), height: f1(dh) })),
    doorway(dx, pathY - 2, dw, dh, seed + 9, true),
    // the bench, the blueprint, the lamp
    hangingLamp(lampX, top + skyH * 0.12, Math.max(10, ty - deep - top - skyH * 0.12 - bw * 0.42), bw * 0.07, seed + 10, [ty - deep * 0.5, bw * 0.62]),
    ink(benchTop, 't35p-bench-top', 'rough'),
    ...blueprint(sheet, seed + 11),
    bench(bx0 - 4, bx1 + 4, ty, legH, seed + 12),
    ink(blob((bx0 + bx1) / 2, by + 2, bw * 0.6, 6, seed + 13, 0.2), 'p2p-wash t35p-floor', 'wash'),
  ]
}

/** Scene 3's painting (progressTide art): a long valley scroll; a stone lantern rises at each milestone, the last one unlit in the mist. */
export const moonsArt: TideArt = {
  back: ({ w, h, ground, xs, roll, seed }) => {
    const xt = xs[xs.length - 1]
    const fogX = xt + (w - roll - xt) * 0.55
    return [
      mist(w * 0.42, ground - h * 0.4, w * 0.62, h * 0.42),
      hills(roll, w - roll, ground - h * 0.1, h * 0.34, seed, 0.92, 7),
      hills(roll, w * 0.4, ground - h * 0.03, h * 0.46, seed + 1, 0.5, 2),
      hills(w * 0.52, xt, ground - h * 0.04, h * 0.3, seed + 2, 0.62, 2),
      mist(w * 0.5, ground - h * 0.06, w * 0.62, h * 0.12),
      lake(w * 0.2, ground - h * 0.1, xt - 20, ground - 1, seed + 3),
      s('g', { class: 't35m-unlit' }, toro(fogX, ground + 1, clamp(h * 0.2, 26, 64), false)),
    ]
  },
  mark: (_i, size) => toro(0, 0, size * 1.2, true),
}
