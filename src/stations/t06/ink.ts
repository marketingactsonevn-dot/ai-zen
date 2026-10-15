import raw from '../../content/tram-06.json'
import type { Fact, StationContent } from '../../core/content'
import { h, nextId, s } from '../../core/dom'
import { createLoop } from '../../core/loop'
import type { SceneCtx } from '../types'

/** Sumi-e toolkit for Trạm 6: tapered brush strokes, organic blobs, text measuring, stable layout. */
export type Pt = [number, number]
export type Copy = string | Fact

interface Pick { label: string; aria?: string }
export interface T6 extends StationContent {
  scenes: {
    life: {
      label: string; art: string; hold: string; holdMore: string; holdAria: string; prune: string; ask: string
      steps: Pick[]; cloud: string; shoots: string[]; shootAria: string; scroll: string; rules: string[]; shears: string
      question: string; askAria: string; answer: string
      insights: { text: Copy; detail: Copy }[]
    }
    think: {
      label: string; art: string; prompt: string; question: string; fast: string; slow: string; fastAria: string; slowAria: string
      fastAnswer: string; steps: string[]; slowAnswer: string; time: string; cost: string; again: string; insight: Copy; detail: Copy
    }
    hallu: {
      label: string; art: string; prompt: string; question: string; stones: { text: string; aria: string; ok: boolean; note?: Copy }[]
      gap: string; fixed: string; fixedNote: Copy; insight: Copy; detail: Copy
    }
    rag: {
      label: string; art: string; prompt: string; question: string; memory: string; lookup: string; memoryAria: string; lookupAria: string; lantern: string
      guess: string; guessNote: string; shelves: string[]; answer: string; cite: string; citeNote: string; again: string; insight: Copy; detail: Copy
    }
    pond: {
      label: string; art: string; prompt: string; streams: { label: string; aria: string }[]; model: string; diveAria: string
      surfaceAria: string; patterns: string; unknown: string; insight: Copy; detail: Copy; deep: Copy; deepDetail: Copy
    }
  }
}
export const C = raw as unknown as T6

const f1 = (n: number) => (Math.round(n * 10) / 10).toString()
const P = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Deterministic PRNG (mulberry32): the art looks the same on every visit. */
export function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Catmull-Rom through control points → dense polyline (≈ step px apart). */
export function spline(pts: Pt[], step = 3): Pt[] {
  if (pts.length < 2) return pts.slice()
  const out: Pt[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step))
    for (let j = 0; j < n; j++) {
      const t = j / n, t2 = t * t, t3 = t2 * t
      const c = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3)
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
}

/** A tapered brush stroke along pts: filled outline `d`, centreline `c` (for draw-in masks) and its length. */
export function brush(pts: Pt[], w: number, o: BrushOpt = {}) {
  const C = spline(pts)
  const n = C.length
  const L = [0]
  for (let i = 1; i < n; i++) L.push(L[i - 1] + Math.hypot(C[i][0] - C[i - 1][0], C[i][1] - C[i - 1][1]))
  const len = L[n - 1] || 1
  const a = o.a ?? 0.12, b = o.b ?? 0.35, min = o.min ?? 0.14, wob = o.wob ?? 0.08
  const lft: Pt[] = [], rgt: Pt[] = []
  let hs = 0, he = 0
  for (let i = 0; i < n; i++) {
    const t = L[i] / len
    const k = Math.max(min, Math.sqrt(Math.min(1, a ? t / a : 1))) * Math.max(min, Math.min(1, b ? (1 - t) / b : 1) ** 0.7) * (1 + wob * Math.sin(t * 11 + w * 3))
    const hw = (w * k) / 2
    const A = C[Math.max(0, i - 1)], B = C[Math.min(n - 1, i + 1)]
    const dl = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1
    const nx = -(B[1] - A[1]) / dl, ny = (B[0] - A[0]) / dl
    lft.push([C[i][0] + nx * hw, C[i][1] + ny * hw])
    rgt.push([C[i][0] - nx * hw, C[i][1] - ny * hw])
    if (i === 0) hs = hw
    he = hw
  }
  const d = `M${lft.map(P).join('L')}A${f1(he)} ${f1(he)} 0 0 0 ${P(rgt[n - 1])}L${rgt.reverse().map(P).join('L')}A${f1(hs)} ${f1(hs)} 0 0 0 ${P(lft[0])}Z`
  return { d, c: `M${C.map(P).join('L')}`, len, pts: C }
}

/** An irregular closed shape (stone, wash, cloud) around (cx, cy). */
export function blob(cx: number, cy: number, rx: number, ry: number, seed = 1, wob = 0.08, n = 22): string {
  const r = rng(seed)
  const ph = [r() * 6.3, r() * 6.3, r() * 6.3]
  const pts: Pt[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const k = 1 + wob * (Math.sin(2 * a + ph[0]) * 0.6 + Math.sin(3 * a + ph[1]) * 0.35 + Math.sin(5 * a + ph[2]) * 0.2)
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k])
  }
  const mid = (a: Pt, b: Pt) => `${f1((a[0] + b[0]) / 2)} ${f1((a[1] + b[1]) / 2)}`
  let d = `M${mid(pts[n - 1], pts[0])}`
  for (let i = 0; i < n; i++) d += `Q${f1(pts[i][0])} ${f1(pts[i][1])} ${mid(pts[i], pts[(i + 1) % n])}`
  return d + 'Z'
}

export const ell = (cx: number, cy: number, rx: number, ry = rx) =>
  `M${f1(cx - rx)} ${f1(cy)}a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(2 * rx)} 0a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(-2 * rx)} 0Z`

/** Points on an ellipse arc, degrees (0 = right, 90 = down). */
export function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 24): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as Pt
  })
}

/** A sheet of rice paper with soft, hand-torn edges. */
export function sheet(x: number, y: number, w: number, hh: number, seed = 1): string {
  const r = rng(seed)
  const pts: Pt[] = []
  const side = (x0: number, y0: number, x1: number, y1: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const t = i / n
      pts.push([x0 + (x1 - x0) * t + (r() - 0.5) * 1.6, y0 + (y1 - y0) * t + (r() - 0.5) * 1.6])
    }
  }
  side(x, y, x + w, y, 9)
  side(x + w, y, x + w, y + hh, 7)
  side(x + w, y + hh, x, y + hh, 9)
  side(x, y + hh, x, y, 7)
  return `M${pts.map(P).join('L')}Z`
}

let mctx: CanvasRenderingContext2D | null = null
/** Width of a string in the serif at `size` px. */
export function measure(text: string, size: number, weight = 400): number {
  mctx ??= document.createElement('canvas').getContext('2d')
  if (!mctx) return text.length * size * 0.52
  mctx.font = `${weight} ${size}px "Noto Serif", Georgia, serif`
  return mctx.measureText(text).width
}

// A.10: a page's first measure() pays one-off font work (each weight; a system fallback for glyphs the serif lacks, such
// as "→": ≈25 ms at 4× CPU). Pay it in idle time once the station loads, not inside a scene's mount: every character
// the scenes measure, once per weight, one idle task each.
const glyphs = [...new Set([...C.scenes.think.steps, C.scenes.think.slowAnswer, C.scenes.think.fastAnswer, ...C.scenes.hallu.stones.map((x) => x.text), C.scenes.hallu.fixed].join(''))].join('')
for (const wt of [400, 500]) (window.requestIdleCallback ?? setTimeout)(() => measure(glyphs, 100, wt))

/** A theme-coloured SVG layer filling the art, sized in CSS px (viewBox = px). */
export function layer(cls = ''): SVGSVGElement {
  return s('svg', { class: `t6-svg ${cls}`.trim(), 'aria-hidden': 'true' })
}

/**
 * The art height once the tallest insight of this scene is showing: compose in that height from the start,
 * so nothing jumps when the insight grows the foot (same idea as Trạm 2).
 */
export function stableHeight(ctx: SceneCtx, copies: Copy[]) {
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
      for (const c of copies) {
        box.replaceChildren(ctx.fact(c, 'p', 'insight-text'), h('button', { class: 'insight-more', type: 'button', tabindex: '-1' }, '…'))
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

/** Re-layout on size changes (one per frame) and once the fonts are in (line breaks change). */
export function onSize(ctx: SceneCtx, el: HTMLElement, fn: () => void, reset?: () => void) {
  let raf = 0
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(fn)
  })
  ro.observe(el)
  let alive = true
  document.fonts?.ready.then(() => alive && (reset?.(), fn()))
  ctx.onCleanup(() => {
    alive = false
    ro.disconnect()
    cancelAnimationFrame(raf)
  })
}

/** Run fn when the theme or garden palette changes (canvas colours). */
export function onTheme(ctx: SceneCtx, fn: () => void) {
  const mo = new MutationObserver(fn)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-garden'] })
  ctx.onCleanup(() => mo.disconnect())
}

/** A frame loop on the scene's art (pauses offscreen, hidden tab, reduced motion), disposed on cleanup. dt in seconds (≤ 0.05). step returns false to idle until start(). */
export function loop(ctx: SceneCtx, step: (dt: number) => void | boolean) {
  const l = createLoop(ctx.art, (_t, dt) => step(dt))
  l.start()
  ctx.onCleanup(l.dispose)
  return l
}

/** Theme gradients one SVG needs (stone tops, glow): returns their ids. */
export function defs(svg: SVGSVGElement) {
  const id = nextId('t6g')
  svg.append(s('defs', null,
    s('linearGradient', { id: `${id}-st`, x1: 0, y1: 0, x2: 0.3, y2: 1 },
      s('stop', { offset: 0, class: 't6-gs0' }),
      s('stop', { offset: 1, class: 't6-gs1' })),
    s('radialGradient', { id: `${id}-glow` },
      s('stop', { offset: 0, class: 't6-glow0' }),
      s('stop', { offset: 1, class: 't6-glow1' }))))
  return { stone: `${id}-st`, glow: `${id}-glow` }
}

/** A garden stone seen at an angle: shadow, dark flank, lit top, a brushed edge underneath and a pale back rim. */
export function stone(cx: number, cy: number, rx: number, ry: number, grad: string, seed = 1, th = ry * 0.55, rough = true): SVGGElement {
  const r = rng(seed)
  const pts: Pt[] = []
  for (let a = 0; a <= 360; a += 12) {
    const t = (a * Math.PI) / 180
    const j = 1 + (r() - 0.5) * 0.1
    pts.push([cx + rx * j * Math.cos(t), cy + ry * j * Math.sin(t)])
  }
  pts[pts.length - 1] = pts[0]
  const lower = pts.slice(0, 16)
  const drop = (x: number) => th * (0.7 + 0.3 * Math.sin(Math.PI * clamp((x - cx + rx) / (2 * rx), 0, 1)))
  const under = lower.map(([x, y]) => [x, y + drop(x)] as Pt)
  const top = `M${pts.map(P).join('L')}Z`
  const flank = `M${lower.map(P).join('L')}L${under.slice().reverse().map(P).join('L')}Z`
  const fx = rough ? { filter: 'url(#ink-rough)' } : null
  return s('g', null,
    s('path', { class: 't6-sh', 'fill-opacity': 0.14, d: ell(cx + rx * 0.08, cy + ry * 0.7 + th * 0.6, rx * 1.12, ry * 0.85), filter: 'url(#ink-wash)' }),
    s('path', { class: 't6-flank', d: flank, ...fx }),
    s('path', { d: top, fill: `url(#${grad})`, ...fx }),
    s('path', { class: 't6-sh', 'fill-opacity': 0.6, d: brush(under.slice(1), Math.max(1.4, rx * 0.04), { a: 0.12, b: 0.45 }).d, ...fx }),
    s('path', { class: 'k', 'fill-opacity': 0.5, d: brush(lower.slice(4, 15), Math.max(1, rx * 0.022), { a: 0.3, b: 0.3 }).d }),
    s('path', { class: 't6-rim', d: brush(pts.slice(17, 26), Math.max(1.2, rx * 0.045), { a: 0.25, b: 0.4 }).d }))
}

/** Before a focused control is hidden or disabled, hand keyboard focus to the next logical one. */
export function passFocus(from: Element | null, to: HTMLElement | null | undefined) {
  if (from && to && document.activeElement === from) to.focus({ preventScroll: true })
}

/** Place an absolutely positioned element (px). */
export function place(el: HTMLElement, x: number, y: number, w?: number, hh?: number) {
  el.style.left = `${x}px`
  el.style.top = `${y}px`
  if (w != null) el.style.width = `${w}px`
  if (hh != null) el.style.height = `${hh}px`
}
