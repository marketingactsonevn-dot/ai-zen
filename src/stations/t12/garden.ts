import { s } from '../../core/dom'
import { blob, f1, lerp, rng, stroke, type Pt } from './ink'
import { octaves } from '../../ui/ink'

/**
 * The back of a dry garden: an earthen wall with a tiled cap (the Ryōan-ji kind), the soft shapes of trees
 * beyond it, washed so pale that words can sit on them. Drawn in pixels from x0 to x1, the wall's foot at yh.
 */
export function backWall(x0: number, x1: number, yh: number, wallH: number, lowQ: boolean, seed = 3): SVGGElement {
  const r = rng(seed)
  const wash = (cls: string) => s('g', { class: cls, filter: lowQ ? null : 'url(#ink-wash)' })
  const trees = wash('t12-trees')
  const top = yh - wallH
  // tree crowns beyond the wall: clusters of soft blobs, a few taller ones
  const crowns: [number, number][] = []
  for (let x = x0 + (x1 - x0) * 0.04, i = 0; x < x1; i++) {
    const big = r() > 0.55
    const rx = wallH * (big ? 2.4 : 1.5) * (0.8 + r() * 0.5)
    const ry = rx * (0.5 + r() * 0.2)
    const cy = top - ry * (big ? 0.55 : 0.25)
    trees.append(s('path', { d: blob(x, cy, rx, ry, seed * 31 + i, 0.16, 20), 'fill-opacity': (0.5 + r() * 0.5).toFixed(2) }))
    if (big) {
      trees.append(s('path', { d: blob(x + rx * 0.35, cy - ry * 0.5, rx * 0.55, ry * 0.5, seed * 37 + i, 0.2, 16), 'fill-opacity': '0.6' }))
      crowns.push([x, rx])
    }
    x += rx * (1.1 + r() * 0.9)
  }
  // the wall face, its oil stains, the tile cap and the shadow it throws on the face
  const face = s('path', { class: 't12-wall', d: `M${f1(x0)} ${f1(top)}L${f1(x1)} ${f1(top)}L${f1(x1)} ${f1(yh)}L${f1(x0)} ${f1(yh)}Z` })
  const stains = wash('t12-stain')
  for (let x = x0, i = 0; x < x1; i++) {
    const w = wallH * (0.6 + r() * 1.6)
    stains.append(s('path', { d: blob(x + w / 2, top + wallH * (0.45 + r() * 0.3), w * 0.5, wallH * (0.25 + r() * 0.3), seed * 7 + i, 0.25, 14), 'fill-opacity': (0.25 + r() * 0.75).toFixed(2) }))
    x += w * (1 + r() * 1.5)
  }
  // every big crown leans over the wall and hides the cap: the eave is a few soft dry-brush strokes, not a ruled line
  const gaps = crowns.map(([x, rx]) => [x - rx * 0.42, x + rx * 0.5] as [number, number])
  const over = wash('t12-over')
  gaps.forEach(([a, b], i) => {
    const cx = (a + b) / 2
    const w = (b - a) / 2
    over.append(s('path', { d: blob(cx, top - wallH * 0.08, w * 1.05, wallH * 0.34, seed * 53 + i, 0.24, 18) }), s('path', { d: blob(cx + w * 0.3, top + wallH * 0.12, w * 0.55, wallH * 0.22, seed * 59 + i, 0.28, 14), 'fill-opacity': '0.7' }))
  })
  // the runs of wall between the crowns; the longest five get a stroke each, each a little shorter than its run
  const runs: [number, number][] = []
  let from = x0 - 20
  for (const [a, b] of gaps) {
    if (a > from) runs.push([from, a])
    from = Math.max(from, b)
  }
  if (x1 + 20 > from) runs.push([from, x1 + 20])
  const cap = s('g', { class: 't12-cap', filter: lowQ ? null : 'url(#t12-dryh)' })
  for (const [a, b] of runs.sort((p, q) => q[1] - q[0] - (p[1] - p[0])).slice(0, 5)) {
    const len = b - a
    if (len < wallH * 1.5) continue
    const s0 = a + len * (0.02 + r() * 0.1)
    const s1 = b - len * (0.02 + r() * 0.14)
    const y = top - wallH * 0.06
    const pts: Pt[] = [0, 0.33, 0.67, 1].map((t) => [lerp(s0, s1, t), y + Math.sin(t * 5 + seed + a * 0.01) * wallH * 0.03] as Pt)
    cap.append(s('path', { d: stroke(pts, Math.max(2.4, wallH * 0.17) * (0.8 + r() * 0.35), { head: 0.1, tail: 0.6, min: 0.12, wob: 0.12 }) }))
  }
  const foot = s('path', { class: 't12-wallfoot', d: stroke([[x0 - 20, yh], [(x0 + x1) / 2, yh + 0.5], [x1 + 20, yh]], Math.max(1, wallH * 0.05), { head: 0.02, tail: 0.04, min: 0.5 }) })
  const shadow = s('path', { class: 't12-wallshade', d: `M${f1(x0)} ${f1(top)}L${f1(x1)} ${f1(top)}L${f1(x1)} ${f1(top + wallH * 0.28)}L${f1(x0)} ${f1(top + wallH * 0.28)}Z` })
  return s('g', { class: 't12-back' }, trees, face, stains, shadow, cap, over, foot)
}

/** A dry-brush filter whose streaks run sideways (for horizontal strokes); id 't12-dryh'. */
export function dryH(): SVGFilterElement {
  return s('filter', { id: 't12-dryh', x: '-5%', y: '-60%', width: '110%', height: '220%' },
    s('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.02 0.6', numOctaves: octaves(2), seed: '4', result: 'n' }),
    s('feColorMatrix', { in: 'n', type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.3 1.6', result: 'm' }),
    s('feComposite', { in: 'SourceGraphic', in2: 'm', operator: 'in' }))
}

/** A moss island: a soft green wash with darker tufts and a couple of pebbles (what a lantern stands in). */
export function mossIsland(cx: number, cy: number, rx: number, ry: number, lowQ: boolean, seed = 9): SVGGElement {
  const r = rng(seed)
  const g = s('g', { class: 't12-moss' })
  const wash = s('g', { filter: lowQ ? null : 'url(#ink-wash)' },
    s('path', { class: 't12-moss-a', d: blob(cx, cy, rx, ry, seed, 0.14, 26) }),
    s('path', { class: 't12-moss-b', d: blob(cx - rx * 0.12, cy - ry * 0.1, rx * 0.72, ry * 0.62, seed + 1, 0.2, 20) }))
  const tufts = s('g', { class: 't12-moss-t', filter: lowQ ? null : 'url(#ink-rough)' })
  for (let i = 0; i < 38; i++) {
    const a = r() * Math.PI * 2
    const d = Math.sqrt(r()) * 0.92
    const x = cx + Math.cos(a) * rx * d
    const y = cy + Math.sin(a) * ry * d
    const k = rx * (0.02 + r() * 0.035)
    tufts.append(s('path', { d: blob(x, y, k, k * 0.55, seed * 13 + i, 0.3, 8), 'fill-opacity': (0.3 + r() * 0.5).toFixed(2) }))
  }
  const peb = s('g', { filter: lowQ ? null : 'url(#ink-rough)' })
  for (const [ox, oy, k] of [[-0.62, 0.25, 0.07], [0.7, -0.15, 0.05], [0.52, 0.4, 0.04]]) {
    const x = cx + ox * rx
    const y = cy + oy * ry
    peb.append(s('path', { class: 't12-peb', d: blob(x, y, rx * k, rx * k * 0.55, seed + ox * 10, 0.12, 12) }), s('path', { class: 't12-peb-s', d: stroke([[x - rx * k, y + 0.5], [x, y + rx * k * 0.5], [x + rx * k, y]], Math.max(1, rx * k * 0.18), { head: 0.2, tail: 0.5 }) }))
  }
  g.append(wash, tufts, peb)
  return g
}

/** Raked sand between y0 and y1: grooves come in bands of three (one pass of the rake), closer together far away. */
export function rakeLines(x0: number, x1: number, y0: number, y1: number, scale = 1, seed = 1): SVGGElement {
  const g = s('g', { class: 't12-sand' })
  const r = rng(seed)
  let y = y0 + 4
  let k = 0
  while (y < y1 + 6) {
    const f = Math.min(1, Math.max(0, (y - y0) / Math.max(1, y1 - y0)))
    const gap = lerp(3.2, 11, f) * scale
    for (let j = 0; j < 3; j++) {
      const yy = y + j * gap
      if (yy > y1 + 6) break
      const w = lerp(0.45, 1.5, f) * scale
      const pts: Pt[] = []
      const ph = r() * 6
      for (let x = x0 - 20; x <= x1 + 20; x += Math.max(50, (x1 - x0) / 12)) pts.push([x, yy + Math.sin(x / 170 + ph + k * 0.3) * (0.4 + f * 1.1)])
      const op = lerp(0.35, 1, f).toFixed(2)
      g.append(
        s('path', { class: 't12-rake', 'fill-opacity': op, d: stroke(pts, w, { head: 0.02, tail: 0.04, min: 0.5, wob: 0.2 }) }),
        s('path', { class: 't12-rake-hi', 'fill-opacity': op, d: stroke(pts.map(([x, v]) => [x, v + w * 0.95 + 0.5] as Pt), w * 0.8, { head: 0.02, tail: 0.04, min: 0.5 }) }))
    }
    y += gap * 3 + lerp(3, 12, f) * scale
    k++
  }
  return g
}
