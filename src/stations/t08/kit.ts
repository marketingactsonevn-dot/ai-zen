import raw from '../../content/tram-08.json'
import type { Fact, StationContent } from '../../core/content'
import { h, s } from '../../core/dom'
import type { SceneCtx } from '../types'

// ───────── Content ─────────
type Copy = string | Fact
export interface Concept { id: string; name: string; term: string; caption: Copy; words: string[] }
export interface T08 extends StationContent {
  scenes: {
    block: { label: string; prompt: string; art: string; slider: string; step: string; first: string; last: string; time: string; play: string; unplay: string; noWebgl: string; insight: Copy; detail: Copy }
    glitch: { label: string; prompt: string; group: string; found: string; clips: { id: string; name: string; aria: string; found: string; word?: string; variants?: string[] }[]; insight: Copy; detail: Copy }
    concepts: { label: string; prompt: string; group: string; screen: string; items: Concept[]; insight: Copy; detail: Copy }
    models: { label: string; prompt: string; pond: string; needsGroup: string; modelAria: string; close: string; needs: { id: string; name: string }[]; models: { company: string; model: string; name: string; needs: string[]; also?: string; alsoLabel?: string }[]; insight: Copy; detail: Copy }
    prompt: { label: string; prompt: string; screen: string; group: string; parts: { id: string; name: string; words: string }[]; rule: string; insight: Copy; detail: Copy }
    sora: { label: string; prompt: string; art: string; slider: string; year: string; screen: string; lanterns: string; events: { day: string; title: string; fact: Fact; short: Fact }[]; reasons: string[]; reasonFact: Fact; insight: Copy; detail: Copy }
  }
}
export const C = raw as unknown as T08

// ───────── Sumi-e geometry ─────────
export type Pt = [number, number]
const f1 = (n: number) => Math.round(n * 10) / 10
const P = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}
export const poly = (pts: Pt[]) => `M${pts.map(P).join('L')}Z`
export const ell = (cx: number, cy: number, rx: number, ry = rx) =>
  `M${f1(cx - rx)} ${f1(cy)}a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(2 * rx)} 0a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(-2 * rx)} 0Z`

/** Points on an ellipse arc, degrees (0 = right, 90 = down). */
export function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 24): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as Pt
  })
}

/** Deterministic random (mulberry32). */
export function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Catmull-Rom through control points → dense polyline. */
export function spline(pts: Pt[], straight = false, step = 3): Pt[] {
  if (pts.length < 2) return pts
  const out: Pt[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p0 = straight ? p1 : (pts[i - 1] ?? p1)
    const p3 = straight ? p2 : (pts[i + 2] ?? p2)
    // capped: a runaway point (e.g. a projection blowing up) must never stall the page
    const d = Math.hypot(p2[0] - p1[0], p2[1] - p1[1])
    const n = Number.isFinite(d) ? Math.min(240, Math.max(1, Math.ceil(d / step))) : 1
    for (let j = 0; j < n; j++) {
      const t = j / n
      const t2 = t * t
      const t3 = t2 * t
      const c = (a: number, b: number, cc: number, d: number) => 0.5 * (2 * b + (cc - a) * t + (2 * a - 5 * b + 4 * cc - d) * t2 + (3 * b - a - 3 * cc + d) * t3)
      out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])])
    }
  }
  out.push(pts[pts.length - 1])
  return out
}

export interface BrushOpt {
  /** share of the length used to press in */
  a?: number
  /** share of the length used to lift off */
  b?: number
  /** thinnest tip, as a share of w */
  min?: number
  /** pressure wobble */
  wob?: number
  straight?: boolean
}

/** Filled outline of a tapered brush stroke along pts (the sumi-e line). */
export function brush(pts: Pt[], w: number, o: BrushOpt = {}): string {
  const C0 = spline(pts, o.straight)
  const n = C0.length
  if (n < 2) return ''
  const L = [0]
  for (let i = 1; i < n; i++) L.push(L[i - 1] + Math.hypot(C0[i][0] - C0[i - 1][0], C0[i][1] - C0[i - 1][1]))
  const len = L[n - 1] || 1
  const a = o.a ?? 0.14
  const b = o.b ?? 0.32
  const min = o.min ?? 0.16
  const wob = o.wob ?? 0.1
  const lft: Pt[] = []
  const rgt: Pt[] = []
  let hs = 0
  let he = 0
  for (let i = 0; i < n; i++) {
    const t = L[i] / len
    const k = Math.max(min, Math.sqrt(Math.min(1, a ? t / a : 1))) * Math.max(min, Math.min(1, b ? (1 - t) / b : 1) ** 0.7) * (1 + wob * Math.sin(t * 11 + w * 3))
    const hw = (w * k) / 2
    const A = C0[Math.max(0, i - 1)]
    const B = C0[Math.min(n - 1, i + 1)]
    const dl = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1
    const nx = -(B[1] - A[1]) / dl
    const ny = (B[0] - A[0]) / dl
    lft.push([C0[i][0] + nx * hw, C0[i][1] + ny * hw])
    rgt.push([C0[i][0] - nx * hw, C0[i][1] - ny * hw])
    if (i === 0) hs = hw
    he = hw
  }
  return `M${lft.map(P).join('L')}A${f1(he)} ${f1(he)} 0 0 0 ${P(rgt[n - 1])}L${rgt.reverse().map(P).join('L')}A${f1(hs)} ${f1(hs)} 0 0 0 ${P(lft[0])}Z`
}

/** An irregular pebble outline (closed, smooth). */
export function pebble(cx: number, cy: number, rx: number, ry: number, r: () => number, wob = 0.08): string {
  const pts: Pt[] = []
  const n = 14
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2
    const j = 1 + (r() - 0.5) * wob * 2
    pts.push([cx + rx * j * Math.cos(t), cy + ry * j * Math.sin(t) * (Math.sin(t) > 0 ? 0.92 : 1.04)])
  }
  const mid = (p: Pt, q: Pt): Pt => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
  let d = `M${P(mid(pts[n - 1], pts[0]))}`
  for (let i = 0; i < n; i++) d += `Q${P(pts[i])} ${P(mid(pts[i], pts[(i + 1) % n]))}`
  return d + 'Z'
}

/** SVG path element with a class (fill comes from the station stylesheet). */
export const path = (d: string, cls = 'k', extra?: Record<string, unknown>) => s('path', { d, class: cls, ...extra })

// ───────── Layout helpers ─────────

/**
 * The art height once the tallest insight of this scene is showing. Pictures are composed in that height from
 * the start, so nothing jumps when the insight grows the foot.
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
  let alive = true
  ctx.onCleanup(() => void (alive = false))
  return {
    H,
    /** fonts change line breaks: call fn once they are in */
    afterFonts(fn: () => void) {
      document.fonts?.ready.then(() => {
        if (!alive) return
        probeW = -1
        fn()
      })
    },
  }
}

/** Re-run fn when the theme flips (any way of switching it). */
export function onTheme(ctx: SceneCtx, fn: () => void) {
  let last = document.documentElement.dataset.theme
  const mo = new MutationObserver(() => {
    const now = document.documentElement.dataset.theme
    if (now === last) return
    last = now
    fn()
  })
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-garden'] })
  ctx.onCleanup(() => mo.disconnect())
}

/** ResizeObserver → fn(w, h) on the next frame; returns a disposer. */
export function watchSize(el: HTMLElement, fn: (w: number, h: number) => void) {
  let raf = 0
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => {
      const w = el.clientWidth
      const hh = el.clientHeight
      if (w && hh) fn(w, hh)
    })
  })
  ro.observe(el)
  return () => (ro.disconnect(), cancelAnimationFrame(raf))
}

/** A RAF clock that runs while `on` is true; returns stop. */
export function loop(fn: (t: number, dt: number) => void) {
  let raf = 0
  let last = performance.now()
  let t = 0
  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    t += dt
    fn(t, dt)
    raf = requestAnimationFrame(tick)
  }
  const start = () => {
    if (raf) return
    last = performance.now()
    raf = requestAnimationFrame(tick)
  }
  const stop = () => {
    cancelAnimationFrame(raf)
    raf = 0
  }
  const onVis = () => (document.hidden ? stop() : start())
  document.addEventListener('visibilitychange', onVis)
  start()
  return () => {
    stop()
    document.removeEventListener('visibilitychange', onVis)
  }
}
