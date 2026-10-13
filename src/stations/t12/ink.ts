import { h, s } from '../../core/dom'
import type { SceneCtx } from '../types'
import type { Fact } from '../../core/content'

/** Sumi-e helpers for Trạm 12: tapered strokes, wobbly washes, stones with a word on them. */
export type Pt = [number, number]

export const f1 = (n: number) => (Math.round(n * 10) / 10).toString()
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Deterministic PRNG (mulberry32): the garden looks the same on every visit. */
export function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Catmull-Rom spline through pts, n + 1 samples. */
function spline(pts: Pt[], n: number): Pt[] {
  const seg = pts.length - 1
  const out: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * seg
    const k = Math.min(seg - 1, Math.floor(t))
    const u = t - k
    const p0 = pts[Math.max(0, k - 1)], p1 = pts[k], p2 = pts[k + 1], p3 = pts[Math.min(seg, k + 2)]
    const c = (j: 0 | 1) =>
      0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * u + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * u * u + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * u * u * u)
    out.push([c(0), c(1)])
  }
  return out
}

/** A filled brush stroke: quick press (`head`), long lift-off (`tail` < 1 stays fuller), `min` = thinnest tip. */
export function stroke(pts: Pt[], w: number, o: { head?: number; tail?: number; min?: number; wob?: number; press?: (t: number) => number } = {}): string {
  const n = Math.max(14, (pts.length - 1) * 14)
  const P = spline(pts, n)
  const head = o.head ?? 0.14
  const tail = o.tail ?? 0.7
  const min = o.min ?? 0.1
  const wob = o.wob ?? 0
  const L: Pt[] = [], R: Pt[] = []
  P.forEach((p, i) => {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n, i + 1)]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    const nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len
    const t = i / n
    const f = t < head ? Math.sqrt(Math.sin((t / head) * Math.PI * 0.5)) : Math.pow(Math.cos(((t - head) / (1 - head)) * Math.PI * 0.5), tail)
    const hw = (w / 2) * Math.max(min, f) * (1 + wob * Math.sin(t * 13 + w)) * (o.press ? o.press(t) : 1)
    L.push([p[0] + nx * hw, p[1] + ny * hw])
    R.push([p[0] - nx * hw, p[1] - ny * hw])
  })
  return `M${L.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')}L${R.reverse().map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')}Z`
}

/** The centre line of a stroke (for masks that draw it in). */
export function spine(pts: Pt[], n = 40): string {
  return `M${spline(pts, n).map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')}`
}

/** The radius factor of an irregular round shape at angle a (the same seed always gives the same stone). */
export function shapeK(seed: number, wob: number) {
  const r = rng(seed)
  const ph = [r() * 6.3, r() * 6.3, r() * 6.3]
  return (a: number) => 1 + wob * (Math.sin(2 * a + ph[0]) * 0.6 + Math.sin(3 * a + ph[1]) * 0.35 + Math.sin(5 * a + ph[2]) * 0.2)
}

/** A smooth closed path through pts (quadratic curves through the midpoints). */
export function closed(pts: Pt[]): string {
  const n = pts.length
  const mid = (a: Pt, b: Pt) => `${f1((a[0] + b[0]) / 2)} ${f1((a[1] + b[1]) / 2)}`
  let d = `M${mid(pts[n - 1], pts[0])}`
  for (let i = 0; i < n; i++) d += `Q${f1(pts[i][0])} ${f1(pts[i][1])} ${mid(pts[i], pts[(i + 1) % n])}`
  return d + 'Z'
}

/** An irregular closed shape (stone, wash, puddle) around (cx, cy). */
export function blob(cx: number, cy: number, rx: number, ry: number, seed = 1, wob = 0.08, n = 22): string {
  const k = shapeK(seed, wob)
  return closed(Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    return [cx + Math.cos(a) * rx * k(a), cy + Math.sin(a) * ry * k(a)] as Pt
  }))
}

/**
 * The ink of a stone's outline (same seed and wobble as its blob): a brush that presses along the shadow side,
 * from the upper right round the bottom to the lower left, and lifts off at both ends; a hairline on the lit side.
 */
export function stoneInk(cx: number, cy: number, rx: number, ry: number, seed: number, wob: number, w: number) {
  const k = shapeK(seed, wob)
  const along = (a0: number, a1: number, inset: number) =>
    Array.from({ length: 15 }, (_, i) => {
      const a = ((a0 + ((a1 - a0) * i) / 14) * Math.PI) / 180
      return [cx + Math.cos(a) * (rx * k(a) - inset), cy + Math.sin(a) * (ry * k(a) - inset)] as Pt
    })
  return {
    dark: stroke(along(-55, 168, w * 0.32), w, { head: 0.34, tail: 0.9, min: 0.04 }),
    lit: stroke(along(196, 292, w * 0.1), w * 0.3, { head: 0.3, tail: 0.6, min: 0.1 }),
  }
}

/** Points on an ellipse arc; angles in radians. */
export function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 24): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as Pt
  })
}

/** A raked ring around a stone: a brushed ellipse that does not quite close, like a real rake lift. */
export function ring(cx: number, cy: number, rx: number, ry: number, w: number, seed: number): string {
  const r = rng(seed)
  const a0 = -Math.PI / 2 + (r() - 0.5) * 1.2
  const pts = arc(cx, cy, rx, ry, a0, a0 + Math.PI * 2 * (0.93 + r() * 0.05), 36).map(([x, y], i) => [x + Math.sin(i * 0.7 + seed) * w * 0.25, y] as Pt)
  return stroke(pts, w, { head: 0.04, tail: 0.25, min: 0.25 })
}

/** A river stone in ink: soft shadow, body, lit top, a darker belly, a brushed contour on the shadow side. */
export function stoneArt(seed: number, cls = 't12-stone-art') {
  const ink = stoneInk(60, 30, 55, 24, seed, 0.1, 4.2)
  return s('svg', { class: cls, viewBox: '0 0 120 64', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    s('path', { class: 't12-st-shadow', d: blob(64, 42, 56, 17, seed + 7, 0.1) }),
    s('path', { class: 't12-st-base', d: blob(60, 30, 55, 24, seed, 0.1, 18) }),
    s('path', { class: 't12-st-hi', d: blob(48, 21, 36, 10, seed + 3, 0.16, 14) }),
    s('path', { class: 't12-st-low', d: stroke([[9, 34], [38, 50], [82, 51], [112, 33]], 6, { head: 0.2, tail: 0.6, min: 0.2 }) }),
    s('g', { class: 't12-st-ink', filter: 'url(#ink-rough)' }, s('path', { class: 't12-st-rim', d: ink.dark }), s('path', { class: 't12-st-lit', d: ink.lit })))
}

export type Copy = string | Fact

/**
 * The art height once the tallest insight of this scene is showing: compose in that height from the start,
 * so nothing jumps (or slides out from under a finger) when the insight grows the foot.
 */
export function stableHeight(ctx: SceneCtx, copies: [Copy, Copy?][]) {
  const foot = ctx.el.querySelector<HTMLElement>('.scene-foot')
  let probeW = -1
  let need = 0
  const H = (artH: number) => {
    if (!foot) return artH
    if (foot.clientWidth !== probeW) {
      probeW = foot.clientWidth
      const box = h('div', { class: 'scene-insight', 'aria-hidden': 'true', style: 'position:absolute;left:0;right:0;bottom:0;visibility:hidden;pointer-events:none' })
      foot.append(box)
      let max = 0
      for (const [c, d] of copies) {
        box.replaceChildren(ctx.fact(c, 'p', 'insight-text'), d ? h('button', { class: 'insight-more', type: 'button', tabindex: '-1' }, '…') : '')
        max = Math.max(max, box.offsetHeight)
      }
      box.remove()
      const cs = getComputedStyle(foot)
      need = Math.max(parseFloat(cs.minHeight) || 0, max + (parseFloat(cs.paddingBottom) || 0))
    }
    return artH - Math.max(0, need - foot.offsetHeight)
  }
  return { H, reset: () => void (probeW = -1) }
}

/** Run fn again once the web fonts are in (they change text widths). */
export function afterFonts(ctx: SceneCtx, fn: () => void) {
  let alive = true
  ctx.onCleanup(() => void (alive = false))
  document.fonts?.ready.then(() => alive && fn())
}
