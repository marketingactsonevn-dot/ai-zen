import { s } from '../../core/dom'
import { clamp } from '../../ui/part2/ink'
import { hills, mist, moon } from '../../ui/part2/paint'
import type { PathGeo } from '../../ui/part2/steps'
import { bamboo, blob, ground, rng, stroke, type Pt } from './kit'

const f1 = (n: number) => (Math.round(n * 10) / 10).toString()

/** A celadon bowl standing on (cx, cy = rim centre), bw half-wide, its water holding the whole moon. */
export function moonBowl(cx: number, cy: number, bw: number, seed: number): SVGGElement {
  const ry = bw * 0.24
  const body = `M${f1(cx - bw)} ${f1(cy)}C${f1(cx - bw * 0.96)} ${f1(cy + bw * 0.5)} ${f1(cx - bw * 0.55)} ${f1(cy + bw * 0.74)} ${f1(cx - bw * 0.3)} ${f1(cy + bw * 0.78)}L${f1(cx - bw * 0.32)} ${f1(cy + bw * 0.9)}L${f1(cx + bw * 0.32)} ${f1(cy + bw * 0.9)}L${f1(cx + bw * 0.3)} ${f1(cy + bw * 0.78)}C${f1(cx + bw * 0.55)} ${f1(cy + bw * 0.74)} ${f1(cx + bw * 0.96)} ${f1(cy + bw * 0.5)} ${f1(cx + bw)} ${f1(cy)}Z`
  const rim: Pt[] = Array.from({ length: 17 }, (_, i) => { const a = (Math.PI * i) / 16; return [cx + Math.cos(a) * bw, cy + Math.sin(a) * ry] as Pt })
  return s('g', { class: 'g11-bowl' },
    ground(cx + bw * 0.1, cy + bw * 0.92, bw * 1.15, bw * 0.16, seed, 0.24),
    s('path', { class: 'g11-bowl-glaze', d: body, filter: 'url(#ink-rough)' }),
    s('path', { d: body, fill: 'url(#p2-shade)' }),
    s('path', { class: 'g11-moonlit', d: stroke([[cx - bw * 0.86, cy + bw * 0.12], [cx - bw * 0.7, cy + bw * 0.46], [cx - bw * 0.42, cy + bw * 0.64]], bw * 0.07, 0.2, 0.3, 0.2) }),
    s('path', { class: 'g11-wash g11-bowl-ink', d: stroke(rim.slice(2).reverse(), bw * 0.06, 0.1, 0.2, 0.3) + stroke([[cx + bw * 0.98, cy + bw * 0.1], [cx + bw * 0.7, cy + bw * 0.6], [cx + bw * 0.3, cy + bw * 0.8]], bw * 0.05, 0.1, 0.3, 0.3), filter: 'url(#ink-rough)' }),
    s('ellipse', { class: 'g11-bowl-in', cx: f1(cx), cy: f1(cy), rx: f1(bw), ry: f1(ry) }),
    s('ellipse', { class: 'g11-bowl-water', cx: f1(cx), cy: f1(cy + ry * 0.14), rx: f1(bw * 0.88), ry: f1(ry * 0.78) }),
    s('ellipse', { class: 'g11-bowl-glow', cx: f1(cx + bw * 0.08), cy: f1(cy + ry * 0.12), rx: f1(bw * 0.5), ry: f1(ry * 0.6), fill: 'url(#p2-halo)' }),
    s('ellipse', { class: 'g11-bowl-moon', cx: f1(cx + bw * 0.08), cy: f1(cy + ry * 0.12), rx: f1(bw * 0.22), ry: f1(ry * 0.42) }),
    s('path', { class: 'g11-moonlit', d: stroke([[cx - bw * 0.92, cy - ry * 0.2], [cx - bw * 0.4, cy - ry * 0.95], [cx + bw * 0.3, cy - ry * 0.95]], bw * 0.05, 0.2, 0.4, 0.2) }))
}

/** A bamboo filter cut open (x centre, base y, T tall, tw wide): water on top, then gravel, sand, charcoal, gravel. */
function filterTube(x: number, base: number, T: number, tw: number, seed: number): SVGGElement {
  const r = rng(seed)
  const top = base - T
  const ix = x - tw * 0.3, iw = tw * 0.6
  const y0 = top + T * 0.14, y1 = base - T * 0.08
  const L = (k: number) => y0 + (y1 - y0) * k
  const bands = [0, 0.16, 0.42, 0.64, 0.84, 1]
  let gravel = '', sand = '', coal = '', seams = ''
  for (const [a, b, kind] of [[bands[1], bands[2], 'g'], [bands[2], bands[3], 's'], [bands[3], bands[4], 'c'], [bands[4], bands[5], 'g']] as const) {
    const ya = L(a), yb = L(b)
    seams += stroke([[ix, ya], [ix + iw, ya + (r() - 0.5)]], 1, 0.1, 0.1, 0.4)
    const cnt = kind === 's' ? 26 : kind === 'c' ? 7 : 9
    for (let i = 0; i < cnt; i++) {
      const px = ix + 2 + r() * (iw - 4), py = ya + 2 + r() * (yb - ya - 4)
      if (kind === 'g') gravel += blob(px, py, 1.6 + r() * 2, 1.2 + r() * 1.4, seed + i, 0.2, 8)
      else if (kind === 's') sand += blob(px, py, 0.6, 0.6, 1, 0, 6)
      else coal += blob(px, py, 2 + r() * 2.4, 1.6 + r() * 1.6, seed + 40 + i, 0.35, 8)
    }
  }
  return s('g', { class: 't31f-tube' },
    ground(x, base + 2, tw * 1.3, tw * 0.22, seed + 1, 0.22),
    bamboo([x, base + 2], [x, top], tw, seed + 2, T * 0.3),
    s('rect', { class: 't31f-cut', x: f1(ix), y: f1(y0), width: f1(iw), height: f1(y1 - y0), rx: 2 }),
    s('rect', { class: 't31f-water', x: f1(ix), y: f1(y0), width: f1(iw), height: f1(L(bands[1]) - y0) }),
    s('path', { class: 't31f-sand', d: sand }),
    s('path', { class: 't31f-coal', d: coal, filter: 'url(#ink-wash)' }),
    s('path', { class: 't31f-gravel', d: gravel, fill: 'url(#p2-rock)' }),
    s('path', { class: 'g11-wash t31f-seam', d: seams }),
    s('path', { class: 'g11-wash t31f-edge', d: stroke([[ix, y0], [ix - 0.5, y1]], 1.6, 0.1, 0.1, 0.4) + stroke([[ix + iw, y0], [ix + iw + 0.4, y1]], 1.6, 0.1, 0.1, 0.4), filter: 'url(#ink-rough)' }))
}

/** A thin falling stream with a couple of drops, from a to b. */
const stream = (a: Pt, b: Pt) =>
  s('path', { class: 't31f-stream', d: stroke([a, [(a[0] + b[0]) / 2 + 1, (a[1] + b[1]) / 2], b], 2, 0.05, 0.3, 0.3) + stroke([[b[0] + 3, b[1] - 6], [b[0] + 3.4, b[1] - 2]], 2.2, 0.3, 0.5, 0.3) + stroke([[b[0] - 3, b[1] - 14], [b[0] - 2.8, b[1] - 10]], 1.8, 0.3, 0.5, 0.3) })

/**
 * Scene 5 art — the water filter under the well spout: a bamboo filter cut open (gravel, sand, charcoal) where the path
 * starts, the numbered stones as its layers, and at the end a ceramic bowl of clear water holding the whole moon.
 */
export function cleanArt(g: PathGeo): SVGElement[] {
  const { w, h, row, first, last, top, pathY, seed } = g
  if (row) {
    const skyH = pathY - top
    const T = clamp(skyH * 0.86, 80, 280)
    const tw = clamp(T * 0.22, 26, 54)
    const tx = Math.max(first[0] + 26 + Math.max(tw * 1.4, 70), tw) // over the first stone, clear of the edge
    const base = pathY - 10
    const bw = clamp(w * 0.042, 28, 58)
    const bx = Math.min(last[0] + bw * 0.5, w - bw - 8)
    const by = last[1] + bw * 0.5
    const sp0: Pt = [-12, Math.max(top + 6, base - T - skyH * 0.1)], sp1: Pt = [tx - 3, Math.max(top + 14, base - T - 8)]
    return [
      mist(w * 0.5, top + skyH * 0.66, w * 0.62, skyH * 0.46),
      moon(w * 0.8, top + Math.max(20, skyH * 0.24), clamp(skyH * 0.1, 10, 22), seed, true),
      hills(-w * 0.04, w * 1.04, pathY - 22, skyH * 0.5, seed, 0.88, 6),
      hills(w * 0.4, w * 0.96, pathY - 18, skyH * 0.36, seed + 1, 0.6, 2),
      mist(w * 0.55, pathY - 24, w * 0.6, skyH * 0.14),
      // the well's spout, the stream into the filter, the filter, its outlet onto the first stone
      bamboo(sp0, sp1, clamp(tw * 0.42, 8, 14), seed + 3, 50),
      stream([sp1[0] + 2, sp1[1] + 3], [tx, base - T + 4]),
      filterTube(tx, base, T, tw, seed + 4),
      stream([tx, base + 2], [tx + 1, pathY + 10]),
      moonBowl(bx, by, bw, seed + 6),
      stream([last[0] - 10, last[1] - 2], [bx - bw * 0.3, by - 2]),
    ]
  }
  // two columns (phone): the path itself is the filter — bamboo walls either side, the bowl under it
  const cx = first[0]
  const half = cx + 7
  const bw = clamp(cx * 0.42, 22, 36)
  const r = rng(seed)
  return [
    bamboo([cx - half, first[1] + 6], [cx - half + (r() - 0.5) * 2, last[1] - 4], 7, seed + 3, 70),
    bamboo([cx + half, first[1] + 6], [cx + half + (r() - 0.5) * 2, last[1] - 4], 7, seed + 4, 70),
    moonBowl(cx, last[1] + bw * 0.36, bw, seed + 6),
    mist(w * 0.75, h * 0.5, w * 0.4, h * 0.4),
  ]
}
