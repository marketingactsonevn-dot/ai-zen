import { s } from '../../core/dom'
import { blob, clamp, curve, rng, shuffledIdx, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist, moon, wash } from '../../ui/part2/paint'
import { C } from './shell'
import { along, dawnGlow, f1, fog, mossBed, paintedCircle, stoneSpots, stonesOn } from './sumi'

const V = C.scenes.views
/** what each view (in the JSON's order) looks out on: far storm clouds, village smoke close by, a blazing dawn, the middle path */
const KINDS = ['storm', 'smoke', 'dawn', 'path'] as const

/** Scene 4 — four stones round the pond under a setting moon, each facing its own horizon. */
export const viewsScene = paintedCircle(V.perspectives, { label: V.label, prompt: V.prompt, detail: [V.insight, V.detail] }, 't37v', (g) => {
  const { w, cx, cy, rx, ry, seed } = g
  const r = rng(seed + 11)
  const hy = cy - ry * 1.42 // the far horizon, a strip of ground beyond the far bank
  const sr = clamp(rx * 0.13, 10, 24)
  const order = shuffledIdx(V.perspectives.stones.length, seed)
  const spots = stoneSpots(g, order.length).pts
  const sideOf = (vi: number) => (spots[order.indexOf(vi)].x < cx ? -1 : 1)
  const out: SVGElement[] = [
    fog(cx, hy - ry * 0.4, w * 0.62, ry * 1.6),
    moon(cx + rx * 0.06, hy - sr * 0.45, sr, seed, false), // low, about to set behind the range
    fog(cx + rx * 0.06, hy - sr * 0.05, sr * 3, sr * 0.32),
  ]
  const front: SVGElement[] = []
  for (const [vi, kind] of KINDS.entries()) {
    const sd = sideOf(vi)
    if (kind === 'dawn') {
      // a blazing dawn: the glow, the sun's rim on the horizon, long streaks of cloud lit from below
      const x = clamp(cx + sd * rx * 0.95, w * 0.12, w * 0.88)
      let lit = '', dark = ''
      for (let i = 0; i < 6; i++) {
        const y = hy - sr * (1.4 + i * 0.95 + r() * 0.4), len = rx * (0.5 + r() * 0.45) * (1 - i * 0.08), x0 = x - len * (0.35 + r() * 0.3)
        if (y < sr) break
        const pts: [number, number][] = [[x0, y], [x0 + len * 0.5, y - sr * 0.12], [x0 + len, y + sr * 0.05]]
        dark += stroke(pts, sr * (0.32 + r() * 0.2), 0.3, 0.4, 0.06)
        lit += stroke(pts.map(([px, py]) => [px + sr * 0.2, py + sr * 0.16] as [number, number]), sr * (0.16 + r() * 0.1), 0.3, 0.45, 0.06)
      }
      out.push(dawnGlow(x, hy, rx * 1.15, Math.min(ry * 1.6, hy * 1.1), 3),
        s('circle', { cx: f1(x), cy: f1(hy + sr * 0.3), r: f1(sr * 3), fill: 'url(#g13-sun)' }),
        s('path', { class: 't37v-sun', d: `M${f1(x - sr * 1.3)} ${f1(hy + 1)}A${f1(sr * 1.3)} ${f1(sr * 1.3)} 0 0 1 ${f1(x + sr * 1.3)} ${f1(hy + 1)}Z`, filter: 'url(#ink-rough)' }),
        s('path', { class: 't37v-dawncloud', d: dark, filter: 'url(#ink-wash)' }),
        s('path', { class: 't37v-rays', d: lit, filter: 'url(#ink-wash)' }))
    } else if (kind === 'storm') {
      // far storm clouds: a heavy wash piled up over a flat dark base, dry streaks along it, rain slanting down to the range
      const x = clamp(cx + sd * rx * 0.9, w * 0.18, w * 0.82), ch = Math.min(ry * 0.75, hy * 0.62), base = hy - Math.max(ry * 0.25, hy * 0.18)
      const cw = rx * 1.0
      let rain = '', streaks = '', rim = ''
      for (let i = 0; i < 22; i++) {
        const x0 = x + (r() - 0.5) * cw * 0.7
        rain += stroke([[x0, base], [x0 - ch * 0.22, base + (hy - base) * (0.6 + r() * 0.4)]], 0.8 + r() * 0.7, 0.2, 0.5, 0.1)
      }
      const puffs: SVGElement[] = []
      for (let i = 0; i < 6; i++) {
        const t = i / 5, px = x + (t - 0.5) * cw * 0.8 + (r() - 0.5) * cw * 0.1, up = Math.sin(t * Math.PI) * ch * 0.55 + r() * ch * 0.15
        const pr = cw * (0.13 + r() * 0.06) * (0.8 + Math.sin(t * Math.PI) * 0.4)
        puffs.push(wash(blob(px, base - up - pr * 0.3, pr, pr * 0.7, seed + 40 + i, 0.32), 0.12 + r() * 0.1, 'p2p-wash t37v-cloud'))
        rim += stroke(curve([px - pr * 0.75, base - up - pr * 0.6], [px, base - up - pr * 1.2], [px + pr * 0.7, base - up - pr * 0.7], 8), Math.max(0.9, pr * 0.08), 0.3, 0.3, 0.1)
      }
      for (let i = 0; i < 4; i++) {
        const yy = base - i * ch * 0.06, len = cw * (0.9 - i * 0.15), x0 = x - len / 2 + (r() - 0.5) * cw * 0.1
        streaks += stroke([[x0, yy], [x0 + len * 0.5, yy - ch * 0.03], [x0 + len, yy]], ch * (0.07 + r() * 0.04), 0.25, 0.35, 0.06)
      }
      out.push(
        s('path', { class: 't37v-rain', d: rain, filter: 'url(#ink-dry)' }),
        ...puffs,
        wash(blob(x, base - ch * 0.05, cw * 0.5, ch * 0.12, seed + 46, 0.12), 0.4, 'p2p-wash t37v-cloud'),
        s('path', { class: 't37v-streak', d: streaks, filter: 'url(#ink-wash)' }),
        s('path', { class: 't37v-cloud-rim', d: rim }),
        s('path', { class: 't37v-bolt', d: stroke([[x + cw * 0.08, base], [x - cw * 0.01, base + (hy - base) * 0.45], [x + cw * 0.05, base + (hy - base) * 0.5], [x - cw * 0.04, hy - 3]], 1.3, 0.1, 0.5, 0.2) }))
    } else if (kind === 'smoke') {
      // a village close by on this side: thatched roofs, a lit window, smoke leaning up into the sky
      const x = clamp(cx + sd * rx * 1.12, w * 0.12, w * 0.88), y = hy + ry * 0.2
      const u = clamp(rx * 0.09, 7, 16)
      let roofs = '', walls = '', smoke = '', win = ''
      for (const [dx, dy, k] of [[-1.7, -0.6, 0.8], [0.3, 0, 1], [1.9, -1.0, 0.65]] as const) {
        const hx = x + dx * u * sd, hb = y + dy * u, q = u * k
        walls += `M${f1(hx - q)} ${f1(hb)}h${f1(q * 2)}v${f1(-q * 0.9)}h${f1(-q * 2)}Z`
        roofs += `M${f1(hx - q * 1.45)} ${f1(hb - q * 0.75)}Q${f1(hx - q * 0.6)} ${f1(hb - q * 1.9)} ${f1(hx)} ${f1(hb - q * 2.05)}Q${f1(hx + q * 0.6)} ${f1(hb - q * 1.9)} ${f1(hx + q * 1.45)} ${f1(hb - q * 0.75)}Z`
        win += `M${f1(hx - q * 0.55)} ${f1(hb - q * 0.62)}h${f1(q * 0.42)}v${f1(q * 0.36)}h${f1(-q * 0.42)}Z`
        smoke += stroke(curve([hx + q * 0.3, hb - q * 1.9], [hx - sd * u * 1.6, hb - ry * 0.8], [hx + sd * u * 1.2, hy - ry * (0.45 + r() * 0.4)], 14), u * 0.75, 0.05, 0.85, 0.12)
      }
      front.push(
        s('path', { class: 't37v-smoke', d: smoke, filter: 'url(#ink-wash)' }),
        mossBed(x, y + u * 0.3, u * 4, u * 0.9, seed + 31),
        s('path', { class: 't37v-wall', d: walls, filter: 'url(#ink-rough)' }),
        s('path', { class: 't37v-win', d: win }),
        s('path', { class: 't37v-roof', d: roofs, filter: 'url(#ink-rough)' }),
        grass(x + sd * u * 3.4, y + u * 0.5, u * 1.8, seed + 32))
    } else {
      // the middle path: from the near bank round the pond and on to the far horizon, two worn edges and a few stones
      const a: Pt = [cx + sd * rx * 1.08, cy + ry * 0.62], m: Pt = [cx + sd * rx * 1.42, cy - ry * 0.5], b: Pt = [cx + sd * rx * 0.42, hy + 1]
      const mid = curve(a, m, b, 22)
      const half = (i: number) => (1 - i / 22) * rx * 0.075 + 1
      const edge = (o: number) => mid.map(([x, y], i) => [x + o * half(i), y] as Pt)
      out.push(
        s('path', { class: 't37v-path', d: `M${edge(-1).map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}L${edge(1).reverse().map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}Z`, filter: 'url(#ink-wash)' }),
        s('path', { class: 'g13-ink t37v-edge', d: stroke(edge(-1), 1.3, 0.05, 0.6, 0.2) + stroke(edge(1), 1.1, 0.05, 0.6, 0.2), filter: 'url(#ink-rough)' }),
        stonesOn(along(mid, 6, 0.08, 0.7), (i) => rx * (0.05 - i * 0.006), seed + 50))
    }
  }
  out.push(
    hills(-w * 0.03, w * 1.03, hy, Math.min(ry * 1.1, hy * 0.42), seed, 0.9, 6),
    mist(cx, hy - 2, rx * 2.2, ry * 0.32),
    ...front)
  return { back: out }
})
