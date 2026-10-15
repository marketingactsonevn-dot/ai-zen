import { h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../../stations/types'

/** Small sumi-e helpers shared by the Part 2 components (B.7): seeded randomness, ink shapes, copy to clipboard. */
export type Pt = [number, number]

const f1 = (n: number) => (Math.round(n * 10) / 10).toString()
const P = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/** Deterministic PRNG (mulberry32): the same data draws the same garden on every visit. */
export function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A stable number from text (FNV-1a), so a component seeds itself from its own data. */
export function seedOf(text: string) {
  let x = 2166136261
  for (let i = 0; i < text.length; i++) x = Math.imul(x ^ text.charCodeAt(i), 16777619)
  return x >>> 0
}

/** Fisher–Yates with a seed: a fixed, data-dependent order (indices into the input). */
export function shuffledIdx(n: number, seed: number): number[] {
  const r = rng(seed)
  const a = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** An irregular closed shape (stone, wash, moss) around (cx, cy). */
export function blob(cx: number, cy: number, rx: number, ry: number, seed = 1, wob = 0.08, n = 20): string {
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
  for (let i = 0; i < n; i++) d += `Q${P(pts[i])} ${mid(pts[i], pts[(i + 1) % n])}`
  return d + 'Z'
}

/**
 * A garden stone seen from the side, standing on y = 0 and centred on x = 0: its top profile from the left foot over to
 * the right foot (a seeded, lopsided crown), plus the closed outline. Same w × h for every seed: only the character changes.
 */
export function rock(w: number, h: number, seed: number): { top: Pt[]; d: string } {
  const r = rng(seed)
  const peak = (r() - 0.5) * 0.5 // where the crown sits, as a share of w
  const ctrl: Pt[] = [
    [-0.5, 0],
    [-0.5 + r() * 0.04, -0.3 - r() * 0.2],
    [-0.36 + r() * 0.06, -0.78 - r() * 0.12],
    [peak - 0.08, -0.96 - r() * 0.04],
    [peak + 0.1, -1],
    [0.3 + r() * 0.06, -0.72 - r() * 0.16],
    [0.49, -0.24 - r() * 0.2],
    [0.5, 0],
  ]
  const top: Pt[] = []
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)]
    for (let j = 0; j < 5; j++) {
      const t = j / 5, t2 = t * t, t3 = t2 * t
      const c = (a: number, b: number, cc: number, d: number) => 0.5 * (2 * b + (cc - a) * t + (2 * a - 5 * b + 4 * cc - d) * t2 + (3 * b - a - 3 * cc + d) * t3)
      top.push([c(p0[0], p1[0], p2[0], p3[0]) * w, Math.min(0, c(p0[1], p1[1], p2[1], p3[1])) * h])
    }
  }
  top.push([w / 2, 0])
  return { top, d: `M${top.map(P).join('L')}Q0 ${f1(h * 0.07)} ${P(top[0])}Z` }
}

/**
 * Theme gradients every Part 2 SVG may use, defined once for the page (stops read CSS tokens, so no JS on theme change):
 * url(#p2-rock) stone face, url(#p2-shade) its shadowed flank, url(#p2-halo) moonlight glow, url(#p2-mist) fog.
 */
export function p2Defs() {
  if (document.getElementById('p2-defs')) return
  const stop = (o: number, c: string, a = 1) => s('stop', { offset: o, style: `stop-color:var(${c});stop-opacity:${a}` })
  document.body.append(s('svg', { id: 'p2-defs', width: 0, height: 0, 'aria-hidden': 'true', style: 'position:absolute' },
    s('defs', null,
      s('linearGradient', { id: 'p2-rock', x1: 0, y1: 0, x2: 0.3, y2: 1 }, stop(0, '--rock-hi'), stop(0.55, '--rock-mid'), stop(1, '--rock-lo')),
      s('linearGradient', { id: 'p2-shade', x1: 0.2, y1: 0, x2: 1, y2: 0.6 }, stop(0, '--umbra', 0), stop(0.55, '--umbra', 0.08), stop(1, '--umbra', 0.42)),
      s('radialGradient', { id: 'p2-halo' }, stop(0, '--moon', 0.6), stop(0.45, '--moon', 0.2), stop(1, '--moon', 0)),
      s('linearGradient', { id: 'p2-mist', x1: 0, y1: 0, x2: 1, y2: 0 }, stop(0, '--paper', 0), stop(1, '--paper', 0.96)))))
}

/** A brushed garden stone (w × h, standing on y = 0, centred on x = 0): contact shadow, face, shaded flank, ink edge, grain, moonlit rim. */
export function stoneArt(w: number, h: number, seed: number, cls = 'p2-stone'): SVGGElement {
  const { top, d } = rock(w, h, seed)
  const r = rng(seed + 9)
  const n = top.length
  const grain = (k: number) => {
    const x0 = (k ? 0.05 : -0.38) * w + r() * w * 0.08, y0 = -h * (0.14 + r() * 0.12)
    return stroke([[x0, y0], [x0 + w * (0.12 + r() * 0.1), y0 + h * (0.04 + k * 0.03)], [x0 + w * (0.22 + r() * 0.08), y0 + h * 0.12]], 1.6, 0.3, 0.5, 0.2)
  }
  return s('g', { class: cls },
    s('ellipse', { class: 'p2-stone-sh', cx: w * 0.05, cy: 1.5, rx: w * 0.56, ry: Math.max(3, h * 0.12) }),
    s('path', { class: 'p2-stone-face', d, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
    s('path', { class: 'p2-stone-flank', d, fill: 'url(#p2-shade)' }),
    s('path', { class: 'p2-stone-ink', d: stroke(top.slice(Math.floor(n * 0.42)), Math.max(1.6, w * 0.035), 0.25, 0.1, 0.3), filter: 'url(#ink-rough)' }),
    s('path', { class: 'p2-stone-grain', d: grain(0) + grain(1) }),
    s('path', { class: 'p2-stone-rim', d: stroke(top.slice(Math.floor(n * 0.1), Math.floor(n * 0.6)), Math.max(1.4, w * 0.03), 0.3, 0.4, 0.15) }))
}

/** A tapered brush stroke through pts (≥ 2 points, straight segments are fine): a filled outline. */
export function stroke(pts: Pt[], w: number, a = 0.15, b = 0.35, min = 0.2): string {
  const L = [0]
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  const len = L[L.length - 1] || 1
  const lft: Pt[] = []
  const rgt: Pt[] = []
  pts.forEach((p, i) => {
    const t = L[i] / len
    const k = Math.max(min, Math.min(1, a ? t / a : 1)) * Math.max(min, Math.min(1, b ? (1 - t) / b : 1)) * (1 + 0.08 * Math.sin(t * 9 + w))
    const A = pts[Math.max(0, i - 1)], B = pts[Math.min(pts.length - 1, i + 1)]
    const dl = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1
    const nx = -(B[1] - A[1]) / dl, ny = (B[0] - A[0]) / dl
    const hw = (w * k) / 2
    lft.push([p[0] + nx * hw, p[1] + ny * hw])
    rgt.push([p[0] - nx * hw, p[1] - ny * hw])
  })
  return `M${lft.map(P).join('L')}L${rgt.reverse().map(P).join('L')}Z`
}

/** Points along a quadratic curve (for brushed paths). */
export function curve(a: Pt, c: Pt, b: Pt, n = 24): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n, u = 1 - t
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]] as Pt
  })
}

/**
 * Copy text: the Clipboard API, else select `el`'s text and try the old execCommand.
 * Resolves 'copied', or 'selected' when the text is only selected (the viewer presses Ctrl+C themselves).
 */
export async function copyText(text: string, el: HTMLElement): Promise<'copied' | 'selected'> {
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    const sel = getSelection()
    const range = document.createRange()
    range.selectNodeContents(el)
    sel?.removeAllRanges()
    sel?.addRange(range)
    try {
      if (document.execCommand('copy')) {
        sel?.removeAllRanges()
        return 'copied'
      }
    } catch {
      /* the selection stays for a manual copy */
    }
    return 'selected'
  }
}

/** Run fn on the element's size (one per frame, first report included) and again once fonts are in; cleanup returned. */
export function onSize(el: Element, fn: () => void): () => void {
  let raf = 0
  let alive = true
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(fn)
  })
  ro.observe(el)
  if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(() => alive && fn())
  return () => {
    alive = false
    ro.disconnect()
    cancelAnimationFrame(raf)
  }
}

/** Digit keys 1–9 anywhere on the page while a scene is up (not while typing, not with modifiers); cleanup returned. */
export function onDigit(fn: (n: number) => void): () => void {
  const k = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey || !/^[1-9]$/.test(e.key)) return
    if ((e.target as Element).closest?.('input, textarea, select, [contenteditable]')) return
    fn(Number(e.key))
  }
  addEventListener('keydown', k)
  return () => removeEventListener('keydown', k)
}

/**
 * The art height once the scene's tallest insight is showing (same idea as Part 1 stations): lay out in that height from
 * the start, so nothing jumps when the insight grows the foot. Measures once per foot width.
 */
export function stableHeight(ctx: SceneCtx, copies: (Fact | string | undefined)[]) {
  const foot = ctx.el.querySelector<HTMLElement>('.scene-foot')
  let probeW = -1
  let need = 0
  return (artH: number) => {
    if (!foot) return artH
    if (foot.clientWidth !== probeW) {
      probeW = foot.clientWidth
      const box = h('div', { class: 'scene-insight', 'aria-hidden': 'true', style: 'position:absolute;left:0;right:0;bottom:0;visibility:hidden;pointer-events:none' })
      foot.append(box)
      let max = 0
      for (const c of copies) {
        if (!c) continue
        box.replaceChildren(ctx.fact(c, 'p', 'insight-text'), h('button', { class: 'insight-more', type: 'button', tabindex: '-1' }, '…'))
        max = Math.max(max, box.offsetHeight)
      }
      box.remove()
      const cs = getComputedStyle(foot)
      need = Math.max(parseFloat(cs.minHeight) || 0, max + (parseFloat(cs.paddingBottom) || 0))
    }
    return artH - Math.max(0, need - foot.offsetHeight)
  }
}
