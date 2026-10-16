import { h } from '../../core/dom'
import type { Fact } from '../../core/content'
import { cssVar, onPrefs } from '../../core/prefs'
import { onSize, p2Defs, stableHeight } from '../../ui/part2/ink'
import type { SceneCtx } from '../types'

/** Station 25 helpers (2.5D water scenes): scene root, token colours, ambient motion that sleeps, CSS-3D projection. */
export const F = (x: unknown) => x as Fact
export const f1 = (n: number) => n.toFixed(1)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const sstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * The scene root (absolute, fills ctx.art) with the painting's description for screen readers. layout(W, H, Hraw) runs
 * once per size; H is the art height with the tallest insight showing, so nothing jumps when it appears.
 */
export function frame(ctx: SceneCtx, cls: string, art: string, copies: unknown[], layout: (W: number, H: number, Hraw: number) => void) {
  p2Defs()
  const root = h('div', { class: `t25 ${cls}` }, h('p', { class: 'visually-hidden' }, art))
  ctx.art.append(root)
  const stable = stableHeight(ctx, copies as Fact[])
  ctx.onCleanup(onSize(root, () => {
    const W = root.clientWidth, Hraw = root.clientHeight
    if (W && Hraw) layout(W, stable(Hraw), Hraw)
  }))
  return root
}

/** Token colours read once (mount / theme change), for canvases. `fn` reruns only when a colour really changed. */
export function tokens<T extends string>(names: readonly T[], ctx: SceneCtx, fn: (c: Record<T, string>) => void) {
  let last = ''
  const read = () => {
    const c = {} as Record<T, string>
    for (const n of names) c[n] = cssVar(`--${n}`)
    const key = names.map((n) => c[n]).join('|')
    if (key === last) return
    last = key
    fn(c)
  }
  ctx.onCleanup(onPrefs(read))
  read()
}

/**
 * Living motion (drift, swirl, drips) at quality=high only: on while there is input, asleep after `sec` s without any
 * (pointer, key, wheel), awake again on the next one. Never on under low / reduced motion.
 */
export function ambient(ctx: SceneCtx, el: HTMLElement, set: (on: boolean) => void, sec = 10) {
  if (ctx.reduced || ctx.quality === 'low') return set(false)
  let t = 0
  let on = false
  const wake = () => {
    if (!on) set((on = true))
    clearTimeout(t)
    t = window.setTimeout(() => set((on = false)), sec * 1000)
  }
  el.addEventListener('pointermove', wake, { passive: true })
  el.addEventListener('pointerdown', wake, { passive: true })
  el.addEventListener('wheel', wake, { passive: true })
  addEventListener('keydown', wake)
  wake()
  ctx.onCleanup(() => {
    clearTimeout(t)
    removeEventListener('keydown', wake)
  })
}

/** An inline SVG as a CSS url() (masks, backgrounds): vector, so it stays sharp under any 3D scale. */
export const svgUrl = (w: number, hh: number, inner: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${f1(w)}' height='${f1(hh)}' viewBox='0 0 ${f1(w)} ${f1(hh)}'>${inner}</svg>`)}")`

/**
 * CSS 3D, done by hand where the DOM cannot tell us: the screen point of a point on a plane laid at (left, top) with
 * transform-origin (ox, oy) and `rotateX(a) rotateZ(z)` then translateZ(tz), seen through `perspective: P` from (px, py).
 * Returns [x, y, scale] (scale = how much that spot is magnified).
 */
export function project(p: [number, number], o: { left: number; top: number; ox: number; oy: number; a: number; z?: number; tz?: number; P: number; px: number; py: number }, up = 0): [number, number, number] {
  let x = p[0] - o.ox, y = p[1] - o.oy
  if (o.z) {
    const c = Math.cos(o.z), s = Math.sin(o.z)
    ;[x, y] = [x * c - y * s, x * s + y * c]
  }
  // `up` lifts the point off the plane along its normal (the top of something standing there)
  const ca = Math.cos(o.a), sa = Math.sin(o.a)
  const Y = y * ca - up * sa, Z = y * sa + up * ca + (o.tz ?? 0)
  const k = o.P / (o.P - Z)
  return [o.px + (o.left + o.ox + x - o.px) * k, o.py + (o.top + o.oy + Y - o.py) * k, k]
}
