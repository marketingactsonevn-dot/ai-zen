import { s } from '../../core/dom'
import { blob, clamp, curve, rng, shuffledIdx, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist, moon } from '../../ui/part2/paint'
import { C } from './shell'
import { dawnGlow, f1, fog, lines, mossBed, paintedCircle } from '../t37/sumi'

const D = C.scenes.defs
/** the moon each definition casts into the well (JSON order): a coin, a ladder, a ten-spoked wheel, a council seal */
const SIGNS = ['coin', 'ladder', 'wheel', 'seal'] as const

const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 24): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]
  })
const ell = (cx: number, cy: number, rx: number, ry: number, sweep: 0 | 1) =>
  `M${f1(cx - rx)} ${f1(cy)}A${f1(rx)} ${f1(ry)} 0 1 ${sweep} ${f1(cx + rx)} ${f1(cy)}A${f1(rx)} ${f1(ry)} 0 1 ${sweep} ${f1(cx - rx)} ${f1(cy)}Z`

/** One sign drawn into the moon's reflection at (x, y), radius m (flattened like a reflection). Ink cuts + moonlit lines. */
function sign(kind: (typeof SIGNS)[number], x: number, y: number, m: number): { cut: string; lit: string } {
  const q = m * 0.5 // the reflection is squashed to half height
  if (kind === 'coin') {
    return { cut: `M${f1(x - m * 0.28)} ${f1(y - q * 0.28)}h${f1(m * 0.56)}v${f1(q * 0.56)}h${f1(-m * 0.56)}Z`, lit: stroke(arc(x, y, m * 1.25, q * 1.25, 0, 360, 32), 1.3, 0.05, 0.05, 0.6) }
  }
  if (kind === 'ladder') {
    let lit = stroke([[x - m * 0.42, y + q * 2.4], [x - m * 0.36, y - q * 2.6]], 1.6, 0.1, 0.2, 0.4) + stroke([[x + m * 0.42, y + q * 2.4], [x + m * 0.36, y - q * 2.6]], 1.6, 0.1, 0.2, 0.4)
    let cut = ''
    for (let i = -2; i <= 2; i++) {
      const yy = y + i * q * 0.95
      const line = stroke([[x - m * 0.4, yy], [x + m * 0.4, yy - 0.3]], 1.4, 0.1, 0.1, 0.5)
      if (Math.abs(i) <= 1) cut += line
      else lit += line
    }
    return { cut, lit }
  }
  if (kind === 'wheel') {
    let cut = ''
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      cut += stroke([[x + Math.cos(a) * m * 0.12, y + Math.sin(a) * q * 0.12], [x + Math.cos(a) * m * 0.95, y + Math.sin(a) * q * 0.95]], 1.1, 0.05, 0.2, 0.4)
    }
    return { cut, lit: stroke(arc(x, y, m * 1.18, q * 1.18, 0, 360, 32), 1.6, 0.05, 0.05, 0.6) }
  }
  // the council seal: a square stamp with a carved cross
  const w = m * 0.95
  return {
    cut: stroke([[x - w * 0.5, y], [x + w * 0.5, y]], 1.3, 0.1, 0.1, 0.4) + stroke([[x, y - q * 0.9], [x, y + q * 0.9]], 1.3, 0.1, 0.1, 0.4),
    lit: stroke([[x - w, y - q * 1.1], [x + w, y - q * 1.1], [x + w, y + q * 1.1], [x - w, y + q * 1.1], [x - w, y - q * 1.15]], 1.7, 0.02, 0.02, 0.7),
  }
}

/** Scene 1 — four carved stones round a well full of mist; each casts its own moon into it, each clears a veil. */
export const defsScene = paintedCircle(D.perspectives, { label: D.label, prompt: D.prompt, detail: D.insight }, 't38d', (g) => {
  const { w, cx, cy, rx, ry, seed } = g
  const r = rng(seed + 3)
  const hy = cy - ry * 1.55
  const sr = clamp(rx * 0.12, 9, 22)
  const mx = cx - rx * 0.62
  // the curb: a narrow ring of dressed stone round the water, its outer face going down a little toward the viewer
  const oy = cy + ry * 0.02, orx = rx * 1.13, ory = ry * 1.22, wallH = ry * 0.16
  const ring = ell(cx, oy, orx, ory, 1) + ell(cx, cy, rx * 1.03, ry * 1.07, 0)
  const wall = `M${f1(cx - orx)} ${f1(oy)}L${f1(cx - orx)} ${f1(oy + wallH)}A${f1(orx)} ${f1(ory)} 0 0 0 ${f1(cx + orx)} ${f1(oy + wallH)}L${f1(cx + orx)} ${f1(oy)}A${f1(orx)} ${f1(ory)} 0 0 1 ${f1(cx - orx)} ${f1(oy)}Z`
  let joints = '', tex = ''
  for (let i = 0; i < 14; i++) {
    const a = ((i + r() * 0.3) / 14) * Math.PI * 2
    joints += stroke([[cx + Math.cos(a) * rx * 1.05, cy + Math.sin(a) * ry * 1.09], [cx + Math.cos(a) * orx * 0.99, oy + Math.sin(a) * ory * 0.99]], 1.2, 0.1, 0.1, 0.4)
    const b = a + (0.15 + r() * 0.2)
    tex += stroke(arc(cx, (cy + oy) / 2, rx * (1.07 + r() * 0.04), ry * (1.12 + r() * 0.05), (a * 180) / Math.PI + 6, (b * 180) / Math.PI + 6, 6), 0.9, 0.3, 0.3, 0.1)
  }
  for (let i = 0; i < 11; i++) {
    const a = ((i + 0.5) / 11) * Math.PI
    const [x, y] = [cx + Math.cos(a) * orx, oy + Math.sin(a) * ory]
    joints += stroke([[x, y + wallH * (i % 2 ? 0.52 : 0.06)], [x, y + wallH * (i % 2 ? 0.96 : 0.48)]], 1, 0.1, 0.1, 0.4)
  }
  joints += stroke(arc(cx, oy + wallH * 0.5, orx, ory, 6, 174, 30), 0.9, 0.05, 0.05, 0.3)
  // the well frame on the far curb, in wood: two posts on stone footings, a crossbar and a tie beam, the pulley,
  // a rope over it (one end into the well, drawn over the water below) and a bucket resting on the curb
  const farY = cy - ry * 1.12, top0 = Math.max(farY - ry * 0.95, 14), pw = clamp(rx * 0.05, 5, 11), pr = clamp(rx * 0.055, 5, 12)
  const px = rx * 0.55, wy = top0 + pw * 0.6 + pr * 1.6
  const bw = clamp(rx * 0.1, 9, 20), bh = bw * 0.85, bx = cx + rx * 0.3
  let wood = '', woodSh = '', grain = ''
  for (const sd of [-1, 1]) {
    const x = cx + sd * px
    wood += stroke([[x, farY + 2], [x + sd * 0.4, (farY + top0) / 2], [x, top0 + 2]], pw, 0.01, 0.01, 0.9)
    woodSh += stroke([[x + pw * 0.32, farY + 1], [x + pw * 0.32, top0 + pw]], pw * 0.3, 0.02, 0.02, 0.8)
    grain += stroke([[x - pw * 0.15, farY - (farY - top0) * 0.1], [x - pw * 0.1, top0 + (farY - top0) * 0.35]], 0.7, 0.3, 0.3, 0.1)
  }
  wood += stroke([[cx - px - pw * 1.8, top0 + 1.5], [cx, top0 - 1], [cx + px + pw * 1.8, top0 + 1.5]], pw * 1.15, 0.03, 0.03, 0.8) +
    stroke([[cx - px - pw * 0.9, top0 + (farY - top0) * 0.3], [cx + px + pw * 0.9, top0 + (farY - top0) * 0.3]], pw * 0.6, 0.03, 0.03, 0.8)
  woodSh += stroke([[cx - px - pw * 1.6, top0 + pw * 0.45], [cx + px + pw * 1.6, top0 + pw * 0.45]], pw * 0.35, 0.03, 0.03, 0.8)
  const bucket = `M${f1(bx - bw / 2)} ${f1(farY - bh)}L${f1(bx + bw / 2)} ${f1(farY - bh)}L${f1(bx + bw * 0.4)} ${f1(farY)}L${f1(bx - bw * 0.4)} ${f1(farY)}Z`
  const back: SVGElement[] = [
    dawnGlow(cx + rx * 0.9, hy, rx * 1.3, Math.min(ry * 1.4, hy), 2),
    fog(cx, hy - ry * 0.3, w * 0.6, ry * 1.2),
    // the moon going down into blue-grey mist, veiled by two bands
    moon(mx, hy - sr * 0.15, sr, seed, false),
    fog(mx, hy - sr * 0.1, sr * 3.6, sr * 0.42),
    fog(mx + sr, hy - sr * 0.75, sr * 2.6, sr * 0.22),
    hills(-w * 0.03, w * 1.03, hy + 2, Math.min(ry * 0.9, hy * 0.4), seed, 0.92, 7),
    hills(w * 0.55, w * 1.05, hy + 6, Math.min(ry * 0.7, hy * 0.3), seed + 1, 0.7, 2),
    mist(cx, hy + 2, w * 0.62, ry * 0.36),
    mossBed(cx - orx * 0.95, oy + ory * 0.92, rx * 0.32, ry * 0.1, seed + 4),
    mossBed(cx + orx * 0.9, oy + ory * 0.98, rx * 0.26, ry * 0.08, seed + 5),
    s('ellipse', { class: 'p2p-contact', cx: f1(cx + rx * 0.05), cy: f1(oy + wallH + ory * 0.04), rx: f1(orx * 1.03), ry: f1(ory * 1.03) }),
    s('path', { class: 't38d-wall', d: wall, filter: 'url(#ink-rough)' }),
    s('path', { class: 't38d-wall-sh', d: wall }),
    s('path', { class: 't38d-curb', d: ring, 'fill-rule': 'evenodd', filter: 'url(#ink-rough)' }),
    s('path', { class: 't38d-joint', d: joints }),
    s('path', { class: 't38d-tex', d: tex, filter: 'url(#ink-dry)' }),
    s('path', { class: 'g13-ink t38d-edge', d: stroke(arc(cx, oy + wallH, orx, ory, 4, 176, 30), 2.2, 0.08, 0.08, 0.3) + stroke(arc(cx, oy, orx, ory, 180, 360, 30), 1.4, 0.1, 0.1, 0.3), filter: 'url(#ink-rough)' }),
    s('path', { class: 't38d-lip', d: stroke(arc(cx, cy, rx * 1.08, ry * 1.13, 196, 344, 26), Math.max(1.4, rx * 0.016), 0.2, 0.2, 0.1) }),
    ...[-1, 1].map((sd) => s('path', { class: 't38d-footing', d: blob(cx + sd * px, farY + 1, pw * 1.2, pw * 0.5, seed + 8 + sd, 0.15, 10) })),
    s('path', { class: 't38d-wood', d: wood, filter: 'url(#ink-rough)' }),
    s('path', { class: 't38d-wood-sh', d: woodSh }),
    s('path', { class: 't38d-grain', d: grain }),
    s('path', { class: 'g13-ink t38d-frame-ink', d: stroke([[cx - px - pw * 1.8, top0 + 1.5 - pw * 0.55], [cx, top0 - 1 - pw * 0.55], [cx + px + pw * 1.8, top0 + 1.5 - pw * 0.55]], 1.2, 0.05, 0.05, 0.4) + stroke([[cx, top0 + pw * 0.4], [cx, wy - pr]], 1.4, 0.05, 0.05, 0.6), filter: 'url(#ink-rough)' }),
    s('path', { class: 't38d-wheel', d: stroke(arc(cx, wy, pr, pr, 0, 360, 18), Math.max(1.6, pr * 0.32), 0.02, 0.02, 0.9) }),
    s('path', { class: 'g13-ink', d: lines([[cx - pr * 0.7, wy, cx + pr * 0.7, wy], [cx, wy - pr * 0.7, cx, wy + pr * 0.7]], 0.9) + blob(cx, wy, pr * 0.22, pr * 0.22, seed + 11, 0.1, 8) }),
    // the rope's other end comes down to the bucket resting on the curb
    s('path', { class: 't38d-rope', d: stroke([[cx + pr, wy], [bx, farY - bh * 1.55]], 1, 0.05, 0.05, 0.6) }),
    s('path', { class: 't38d-wood', d: bucket, filter: 'url(#ink-rough)' }),
    s('ellipse', { class: 't38d-mouth', cx: f1(bx), cy: f1(farY - bh), rx: f1(bw / 2), ry: f1(bw * 0.14) }),
    s('path', { class: 'g13-ink', d: lines([[bx - bw * 0.48, farY - bh * 0.72, bx + bw * 0.48, farY - bh * 0.72], [bx - bw * 0.43, farY - bh * 0.2, bx + bw * 0.43, farY - bh * 0.2]], 1.3) + stroke(curve([bx - bw * 0.5, farY - bh], [bx, farY - bh * 2], [bx + bw * 0.5, farY - bh], 10), 1, 0.05, 0.05, 0.6), filter: 'url(#ink-rough)' }),
    grass(cx - orx * 0.98, oy + wallH * 0.9, rx * 0.12, seed + 6),
    grass(cx + orx * 1.02, oy + wallH * 0.7, rx * 0.1, seed + 7),
  ]
  // over the water: the signs (each stone's moon) and four veils of mist, one per stone
  const order = shuffledIdx(D.perspectives.stones.length, seed)
  const m = rx * 0.17, sx = cx, sy = cy - ry * 0.08
  const wid = `t38d-w${seed.toString(36)}`
  const front: SVGElement[] = [
    s('path', { class: 't38d-rope', d: stroke([[cx - pr, wy], [cx - pr * 1.05, cy - ry * 0.42]], 1.1, 0.05, 0.35, 0.5) }),
    s('ellipse', { class: 't38d-ring', cx: f1(cx - pr * 1.05), cy: f1(cy - ry * 0.42), rx: f1(rx * 0.05), ry: f1(rx * 0.013) }),
    s('clipPath', { id: wid }, s('path', { d: blob(cx, cy, rx, ry, seed, 0.05) })),
    s('g', { 'clip-path': `url(#${wid})` },
      ...order.map((vi, k) => {
        const { cut, lit } = sign(SIGNS[vi], sx, sy, m)
        return s('g', { class: 't38d-sign', 'data-k': k }, s('path', { class: 't38d-cut', d: cut }), s('path', { class: 't38d-lit', d: lit }))
      }),
      ...order.map((_, k) => s('g', { class: 't38d-veil', 'data-k': k },
        fog(cx + (k % 2 ? 1 : -1) * rx * 0.18, cy - ry * 0.55 + k * ry * 0.36, rx * 0.95, ry * 0.2, 'g13-fog t38d-fog'),
        fog(cx - (k % 2 ? 1 : -1) * rx * 0.3, cy - ry * 0.4 + k * ry * 0.36, rx * 0.5, ry * 0.12, 'g13-fog t38d-fog')))),
  ]
  return { back, front }
})
