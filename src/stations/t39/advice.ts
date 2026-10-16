import { s } from '../../core/dom'
import { clamp, stroke } from '../../ui/part2/ink'
import { hills, mist, toro } from '../../ui/part2/paint'
import { C } from './shell'
import { crescent, dawnGlow, f1, fog, leafD, mossBed, paintedCircle, stoneSpots } from '../t37/sumi'

const A = C.scenes.advice

/** Scene 4 — three stone lanterns round a small puddle in the moss garden; the leaf on the water turns to the one that speaks. */
export const adviceScene = paintedCircle(A.perspectives, { label: A.label, prompt: A.prompt, detail: A.insight }, 't39v', (g) => {
  const { w, cx, cy, rx, ry, seed } = g
  const n = A.perspectives.stones.length
  const { bw, bh, pts } = stoneSpots(g, n)
  const hy = cy - ry * 1.6
  const lampH = clamp(bh * 1.7, 50, 150)
  const back: SVGElement[] = [
    dawnGlow(cx + rx * 0.5, hy, rx * 1.4, Math.min(ry * 1.4, hy), 3),
    fog(cx, hy - ry * 0.2, w * 0.6, ry),
    crescent(Math.max(24, cx - rx * 1.3), Math.max(18, hy * 0.3), clamp(rx * 0.06, 7, 14), 0.6, 160),
    hills(-w * 0.03, w * 1.03, hy, Math.min(ry * 0.8, hy * 0.45), seed, 0.92, 7),
    mist(cx, hy + 2, w * 0.6, ry * 0.3),
    // the moss garden all round the puddle
    mossBed(cx - rx * 0.8, cy + ry * 1.28, rx * 0.5, ry * 0.16, seed + 1),
    mossBed(cx + rx * 0.9, cy + ry * 1.22, rx * 0.4, ry * 0.14, seed + 2),
    mossBed(cx + rx * 0.1, cy - ry * 1.28, rx * 0.7, ry * 0.14, seed + 3),
    mossBed(cx - rx * 1.22, cy - ry * 0.2, rx * 0.22, ry * 0.3, seed + 4),
    mossBed(cx + rx * 1.22, cy, rx * 0.22, ry * 0.3, seed + 5),
  ]
  // a lantern behind each stone (beside it for the near one), its light falling on its own part of the water
  const pools: SVGElement[] = []
  const lamps: SVGElement[] = [] // a near lantern stands in front of the water
  pts.forEach(({ a, x, y }, k) => {
    const near = Math.sin(a) > 0.5
    const lx = near ? x + bw * 0.95 : x + Math.cos(a) * bw * 0.55, ly = near ? y + bh * 0.05 : y - bh * 0.42
    ;(near ? lamps : back).push(s('g', { class: 't39v-lamp', 'data-k': k }, toro(lx, ly, lampH, true)))
    pools.push(s('ellipse', { class: 't39v-pool', 'data-k': k, cx: f1(cx + Math.cos(a) * rx * 0.55), cy: f1(cy + Math.sin(a) * ry * 0.55), rx: f1(rx * 0.5), ry: f1(ry * 0.45), fill: 'url(#p2-lamp)' }))
  })
  // the leaf adrift in the middle, turned toward the lantern that speaks (CSS picks the angle per stone)
  const lr = clamp(rx * 0.085, 7, 16)
  const turns = pts.map(({ x, y }) => (Math.atan2((y - cy) / 0.62, x - cx) * 180) / Math.PI + 90)
  const leaf = s('g', { class: 't39v-leaf', style: turns.map((t, k) => `--t${k}:${f1(t)}deg`).join(';') },
    s('ellipse', { class: 't39v-leaf-sh', cx: 1.5, cy: 2, rx: f1(lr * 0.9), ry: f1(lr * 0.4) }),
    s('path', { class: 't39v-leaf-body', d: leafD(0, 0, lr, 0) }),
    s('path', { class: 't39v-leaf-vein', d: stroke([[0, lr * 0.5], [0, -lr * 0.8]], Math.max(0.6, lr * 0.08), 0.1, 0.5, 0.3) }))
  const front: SVGElement[] = [
    ...pools,
    ...lamps,
    s('g', { transform: `translate(${f1(cx - rx * 0.24)} ${f1(cy + ry * 0.22)}) scale(1 0.62)` }, leaf),
  ]
  return { back, front }
})
