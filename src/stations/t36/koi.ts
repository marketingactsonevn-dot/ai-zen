import { s } from '../../core/dom'
import { blob, curve, rng, stroke, type Pt } from '../../ui/part2/ink'

/**
 * A koi seen from above, painted in a few strokes: pale body tapering to the tail, vermilion patches, fins in thin ink,
 * a split tail. Head at (x, y), swimming toward angle `a` (radians) — the body trails behind it — `len` long.
 */
export function koi(x: number, y: number, len: number, a: number, seed: number, bend = 0.18): SVGGElement {
  const r = rng(seed)
  const ux = -Math.cos(a), uy = -Math.sin(a) // from head toward tail
  const nx = -uy, ny = ux
  const at = (t: number, side = 0): Pt => [x + ux * len * t + nx * (side + Math.sin(t * Math.PI) * bend * len * 0.5), y + uy * len * t + ny * (side + Math.sin(t * Math.PI) * bend * len * 0.5)]
  const spine = Array.from({ length: 13 }, (_, i) => at((i / 12) * 0.8))
  const tailEnd = at(0.8)
  const w = len * 0.24
  const lobe = (dir: number) => stroke(curve(tailEnd, at(0.92, dir * len * 0.06), at(1.02, dir * len * 0.16), 6), len * 0.09, 0.15, 0.5, 0.15)
  const fin = (dir: number) => stroke(curve(at(0.24, dir * w * 0.4), at(0.3, dir * w * 0.9), at(0.4, dir * w * 1.2), 6), len * 0.06, 0.2, 0.6, 0.2)
  const patch = (t: number, k: number) => { const [px, py] = at(t, (r() - 0.5) * w * 0.25); return blob(px, py, w * (0.26 + r() * 0.12), w * (0.2 + r() * 0.1), seed + k, 0.25, 10) }
  const eye = (dir: number) => { const [ex, ey] = at(0.05, dir * w * 0.26); return `M${(ex + 0.8).toFixed(1)} ${ey.toFixed(1)}a0.8 0.8 0 1 0 -1.6 0a0.8 0.8 0 1 0 1.6 0Z` }
  return s('g', { class: 't36-koi' },
    s('path', { class: 't36-koi-fin', d: lobe(1) + lobe(-1) + fin(1) + fin(-1), filter: 'url(#ink-wash)' }),
    s('path', { class: 't36-koi-body', d: stroke(spine, w, 0.2, 0.75, 0.18), filter: 'url(#ink-rough)' }),
    s('path', { class: 't36-koi-red', d: patch(0.08, 1) + patch(0.3, 2) + (r() < 0.6 ? patch(0.5, 3) : ''), filter: 'url(#ink-wash)' }),
    s('path', { class: 't36-koi-ink', d: stroke(spine.slice(0, 10).map(([px, py]) => [px + nx * w * 0.45, py + ny * w * 0.45] as Pt), Math.max(0.6, len * 0.012), 0.2, 0.4, 0.2) + eye(1) + eye(-1) }))
}
