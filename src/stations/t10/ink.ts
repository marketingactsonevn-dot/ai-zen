import raw from '../../content/tram-10.json'
import type { Fact, StationContent } from '../../core/content'
import { cssVar } from '../../core/prefs'
import type { Quality } from '../../core/prefs'

interface T10 extends StationContent {
  scenes: {
    voice: {
      label: string; prompt: string; art: string; voicesLabel: string; readAs: string; voices: string[]; langLabel: string
      langs: { name: string; lang: string; text: string }[]; same: string; brand: Fact
      insight: string; detail: string; dubInsight: string; dubDetail: string
    }
    consent: {
      label: string; prompt: string; owner: string; name: string; copy: string; copyAria: string; waiting: string; askPrompt: string
      slip: string[]; ask: string; seal: string; tag: string; art: string; insight: string; detail: Fact
    }
    stream: {
      label: string; prompt: string; group: string; art: string; moods: { name: string; rest: string }[]; melody: string; harmony: string
      brand: Fact; insight: string; detail: string; mark: string; rightsInsight: string; rightsDetail: Fact
    }
  }
}
export const C = raw as unknown as T10

export type Pt = [number, number]
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))

/** Deterministic random (mulberry32). */
export function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** '#rrggbb' token → rgba() with alpha (canvas helpers read tokens as hex). */
export const rgba = (hex: string, a: number) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`
}

const f1 = (n: number) => Math.round(n * 10) / 10

/** Catmull-Rom through control points → dense polyline. */
function spline(pts: Pt[], step = 4): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step))
    for (let j = 0; j < n; j++) {
      const t = j / n
      const c = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t)
      out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])])
    }
  }
  out.push(pts[pts.length - 1])
  return out
}

/** Filled outline (SVG path d) of a tapered brush stroke: presses in, swells, lifts off. */
export function brush(pts: Pt[], w: number, o: { a?: number; b?: number; min?: number; wob?: number } = {}): string {
  const C2 = pts.length > 2 ? spline(pts) : spline(pts, Math.max(1, Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) / 6))
  const n = C2.length
  const L = [0]
  for (let i = 1; i < n; i++) L.push(L[i - 1] + Math.hypot(C2[i][0] - C2[i - 1][0], C2[i][1] - C2[i - 1][1]))
  const len = L[n - 1] || 1
  const a = o.a ?? 0.14
  const b = o.b ?? 0.32
  const min = o.min ?? 0.16
  const wob = o.wob ?? 0.1
  const lft: string[] = []
  const rgt: string[] = []
  for (let i = 0; i < n; i++) {
    const t = L[i] / len
    const k = Math.max(min, Math.sqrt(Math.min(1, a ? t / a : 1))) * Math.max(min, Math.min(1, b ? (1 - t) / b : 1) ** 0.7) * (1 + wob * Math.sin(t * 11 + w * 3))
    const hw = (w * k) / 2
    const A = C2[Math.max(0, i - 1)]
    const B = C2[Math.min(n - 1, i + 1)]
    const dl = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1
    const nx = -(B[1] - A[1]) / dl
    const ny = (B[0] - A[0]) / dl
    lft.push(`${f1(C2[i][0] + nx * hw)} ${f1(C2[i][1] + ny * hw)}`)
    rgt.push(`${f1(C2[i][0] - nx * hw)} ${f1(C2[i][1] - ny * hw)}`)
  }
  return `M${lft.join('L')}L${rgt.reverse().join('L')}Z`
}

/** Points on a circle arc (degrees, 0 = right, 90 = down). */
export function arc(cx: number, cy: number, r: number, a0: number, a1: number, n = 48): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as Pt
  })
}

/** Size a canvas to its CSS box at device resolution; returns a context drawing in CSS px. */
export function fitCanvas(cv: HTMLCanvasElement, W: number, H: number, quality: Quality) {
  const dpr = Math.min(devicePixelRatio || 1, quality === 'low' ? 1.25 : 2)
  cv.width = Math.max(1, Math.round(W * dpr))
  cv.height = Math.max(1, Math.round(H * dpr))
  cv.style.width = `${W}px`
  cv.style.height = `${H}px`
  const g = cv.getContext('2d')!
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  return g
}

export interface Pal {
  ink: string; ink2: string; ink3: string; paper: string; paper2: string; card: string
  moss: string; moss2: string; mossSoft: string; stone: string; stone2: string; stone3: string
  verm: string; vermSoft: string; rake: string; rakeHi: string; dark: boolean
}
export function palette(): Pal {
  return {
    ink: cssVar('--ink'), ink2: cssVar('--ink-2'), ink3: cssVar('--ink-3'), paper: cssVar('--paper'), paper2: cssVar('--paper-2'), card: cssVar('--card'),
    moss: cssVar('--moss'), moss2: cssVar('--moss-2'), mossSoft: cssVar('--moss-soft'), stone: cssVar('--stone'), stone2: cssVar('--stone-2'), stone3: cssVar('--stone-3'),
    verm: cssVar('--vermilion'), vermSoft: cssVar('--vermilion-soft'), rake: cssVar('--rake'), rakeHi: cssVar('--rake-hi'), dark: document.documentElement.dataset.theme === 'dark',
  }
}

/** Re-run fn whenever the theme / garden palette changes (covers the prefs toggle and direct attribute edits). */
export function watchTheme(fn: () => void) {
  const mo = new MutationObserver(fn)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-garden'] })
  return () => mo.disconnect()
}

/** setTimeout that the scene clears on unmount. */
export function timers() {
  const ids = new Set<number>()
  return {
    later(fn: () => void, ms: number) {
      const id = window.setTimeout(() => (ids.delete(id), fn()), ms)
      ids.add(id)
    },
    clear: () => (ids.forEach(clearTimeout), ids.clear()),
  }
}

/** Fill a ribbon of varying half-width along a polyline (cheap per-frame brush for canvas). */
export function ribbon(g: CanvasRenderingContext2D, pts: Pt[], hw: (i: number, t: number) => number) {
  const n = pts.length
  if (n < 2) return
  const L: Pt[] = []
  const R: Pt[] = []
  for (let i = 0; i < n; i++) {
    const A = pts[Math.max(0, i - 1)]
    const B = pts[Math.min(n - 1, i + 1)]
    const dl = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1
    const nx = -(B[1] - A[1]) / dl
    const ny = (B[0] - A[0]) / dl
    const w = hw(i, i / (n - 1))
    L.push([pts[i][0] + nx * w, pts[i][1] + ny * w])
    R.push([pts[i][0] - nx * w, pts[i][1] - ny * w])
  }
  g.moveTo(L[0][0], L[0][1])
  for (let i = 1; i < n; i++) g.lineTo(L[i][0], L[i][1])
  for (let i = n - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1])
  g.closePath()
}
