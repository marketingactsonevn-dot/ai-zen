import '../../ui/part2/part2.css'
import { h } from '../../core/dom'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { clamp, onSize, p2Defs, stableHeight } from '../../ui/part2/ink'

/** Trạm 24 toolkit (own copy, the garden-8 kit in t22 is read-only): scene root, placement, a CSS-3D depth rig, idle. */
export const f1 = (n: number) => n.toFixed(1)
export const px = (n: number) => `${n.toFixed(1)}px`

export function put(el: HTMLElement | SVGElement, x: number, y: number, w?: number) {
  el.style.left = px(x)
  el.style.top = px(y)
  if (w != null) el.style.width = px(w)
}

/**
 * Scene root at the art's stable height (no jump when the insight grows the foot). draw(W, H) runs on every resize; if it
 * returns a generator, the first draw soaks in with sliced() and later ones run in one go (README A.10).
 */
export function stage(ctx: SceneCtx, cls: string, art: string, copies: (Fact | string | undefined)[], draw: (W: number, H: number) => void | Generator) {
  p2Defs()
  const stableH = stableHeight(ctx, copies)
  const root = h('div', { class: `t24 ${cls}` }, h('p', { class: 'visually-hidden' }, art))
  ctx.art.append(root)
  const box = { W: 0, H: 0 }
  let job: { cancel(): void } | null = null
  let first = true
  const layout = () => {
    const W = ctx.art.clientWidth
    const H = stableH(ctx.art.clientHeight)
    if (W < 40 || H < 40) return
    box.W = W
    box.H = H
    root.style.height = px(H)
    root.classList.toggle('narrow', W / H < 1.05)
    job?.cancel()
    const g = draw(W, H)
    if (g) job = sliced(g, { sync: ctx.reduced || !first })
    first = false
  }
  ctx.onCleanup(onSize(ctx.art, layout))
  ctx.onCleanup(() => job?.cancel())
  return { root, box }
}

/**
 * "Living" motion (mist drift, blinking fireflies) only at quality=high and only for 10 s after the last input: the root
 * carries .is-live meanwhile, CSS hangs its loops on it (README art direction §3.5).
 */
export function alive(ctx: SceneCtx, root: HTMLElement, idle = 10000) {
  if (ctx.reduced || ctx.quality === 'low') return () => {}
  let t = 0
  const poke = () => {
    root.classList.add('is-live')
    clearTimeout(t)
    t = window.setTimeout(() => root.classList.remove('is-live'), idle)
  }
  poke()
  const evs = ['pointermove', 'pointerdown', 'keydown', 'wheel'] as const
  evs.forEach((e) => root.addEventListener(e, poke, { passive: true }))
  const off = () => {
    clearTimeout(t)
    evs.forEach((e) => root.removeEventListener(e, poke))
  }
  ctx.onCleanup(off)
  return poke
}

export interface Rig {
  /** the 3D world (preserve-3d) inside the host */
  world: HTMLElement
  /** a full-frame layer at depth z (share of the perspective distance: + far, − near, 0 = the subject's plane) */
  layer(z: number, cls?: string): HTMLElement
  /** the viewer's place, -1…1 each way, as last drawn */
  readonly view: { x: number; y: number }
  set(x: number, y: number): void
  /** perspective distance in px (after layout) */
  readonly P: number
  layout(W: number, H: number, eye: number): void
  /** run fn every frame of the rig's own loop (one loop per scene) until it returns false: tweens, drags that settle */
  drive(fn: (dt: number) => boolean): void
  dispose(): void
}

/**
 * Layers at true depths in CSS perspective; the world turns a few degrees about the subject's plane as the viewer moves
 * (pointer, drag, tilt or set()), so far flats slide one way and near ones the other. Each layer is scaled back so it looks
 * as drawn at rest. Compositor-only transforms; one createLoop that runs only while the view settles; no tracking at
 * quality=low or under reduced motion (the scene still calls set() for its own moves).
 */
export function rig(ctx: SceneCtx, host: HTMLElement, o: { strength?: number; track?: boolean; onView?: (x: number, y: number) => void } = {}): Rig {
  const S = o.strength ?? 3.2
  const world = h('div', { class: 't24-world' })
  host.classList.add('t24-rig')
  host.append(world)
  const layers: { el: HTMLElement; z: number }[] = []
  let P = 1000, W = 0, H = 0, eye = 0
  const tgt = { x: 0, y: 0 }, cur = { x: 0, y: 0 }
  const place = (l: { el: HTMLElement; z: number }) => {
    const z = l.z * P
    l.el.style.transformOrigin = `${f1(W / 2)}px ${f1(eye)}px`
    l.el.style.transform = `translateZ(${f1(-z)}px) scale(${((P + z) / P).toFixed(4)})`
  }
  const apply = () => {
    world.style.transform = `rotateX(${(cur.y * S * 0.4).toFixed(3)}deg) rotateY(${(-cur.x * S).toFixed(3)}deg)`
    o.onView?.(cur.x, cur.y)
  }
  const drivers: ((dt: number) => boolean)[] = []
  const loop = createLoop(host, (_t, dt) => {
    const f = dt > 0 ? 1 - Math.exp(-dt * 4.2) : 1
    cur.x += (tgt.x - cur.x) * f
    cur.y += (tgt.y - cur.y) * f
    apply()
    for (let i = drivers.length - 1; i >= 0; i--) if (!drivers[i](dt)) drivers.splice(i, 1)
    return drivers.length > 0 || Math.abs(tgt.x - cur.x) + Math.abs(tgt.y - cur.y) > 0.001
  }, { essential: true })
  const set = (x: number, y: number) => {
    tgt.x = clamp(x, -1, 1)
    tgt.y = clamp(y, -1, 1)
    if (ctx.reduced) (cur.x = tgt.x), (cur.y = tgt.y), apply()
    else loop.start()
  }
  // pointer / drag / tilt
  let rect: DOMRect | null = null
  let drag: { id: number; x: number; y: number; bx: number; by: number } | null = null
  let g0x = NaN, g0y = NaN
  const onEnter = () => void (rect = host.getBoundingClientRect())
  const onMove = (e: PointerEvent) => {
    if (drag && e.pointerId === drag.id) return set(drag.bx + (e.clientX - drag.x) / (rect!.width * 0.4), drag.by + (e.clientY - drag.y) / (rect!.height * 0.5))
    if (e.pointerType !== 'mouse') return
    rect ??= host.getBoundingClientRect()
    set(((e.clientX - rect.left) / rect.width) * 2 - 1, ((e.clientY - rect.top) / rect.height) * 2 - 1)
  }
  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' || (e.target as Element).closest('button, [role=slider]')) return
    rect = host.getBoundingClientRect()
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, bx: tgt.x, by: tgt.y }
  }
  const onUp = (e: PointerEvent) => {
    if (drag && e.pointerId === drag.id) drag = null
  }
  const onTilt = (e: DeviceOrientationEvent) => {
    if (e.gamma == null || e.beta == null || drag) return
    if (Number.isNaN(g0x)) (g0x = e.gamma), (g0y = e.beta)
    set((e.gamma - g0x) / 18, (e.beta - g0y) / 18)
  }
  const track = o.track !== false && !ctx.reduced && ctx.quality !== 'low'
  if (track) {
    host.addEventListener('pointerenter', onEnter)
    host.addEventListener('pointermove', onMove)
    host.addEventListener('pointerdown', onDown)
    host.addEventListener('pointerup', onUp)
    host.addEventListener('pointercancel', onUp)
    addEventListener('deviceorientation', onTilt)
  }
  let disposed = false
  const dispose = () => {
    if (disposed) return
    disposed = true
    loop.dispose()
    removeEventListener('deviceorientation', onTilt)
    host.removeEventListener('pointerenter', onEnter)
    host.removeEventListener('pointermove', onMove)
    host.removeEventListener('pointerdown', onDown)
    host.removeEventListener('pointerup', onUp)
    host.removeEventListener('pointercancel', onUp)
  }
  ctx.onCleanup(dispose)
  return {
    world,
    layer(z, cls = '') {
      const el = h('div', { class: `t24-layer ${cls}` })
      const l = { el, z }
      layers.push(l)
      world.append(el)
      if (W) place(l)
      return el
    },
    view: cur,
    set,
    get P() {
      return P
    },
    layout(w, hh, e) {
      W = w
      H = hh
      eye = e
      P = Math.round(Math.max(H * 1.3, W * 0.7))
      host.style.perspective = `${P}px`
      host.style.perspectiveOrigin = `50% ${f1(eye)}px`
      world.style.transformOrigin = `${f1(W / 2)}px ${f1(eye)}px`
      layers.forEach(place)
      apply()
    },
    drive(fn) {
      drivers.push(fn)
      loop.start()
    },
    dispose,
  }
}

/** A tween in a rig's loop: fn(k) with k eased 0 → 1 over ms (power2.inOut); at once under reduced motion. */
export function tween(ctx: SceneCtx, R: Rig, ms: number, fn: (k: number) => void, done?: () => void) {
  if (ctx.reduced || ms <= 0) {
    fn(1)
    done?.()
    return
  }
  let t = 0
  R.drive((dt) => {
    t = Math.min(1, t + (dt * 1000) / ms)
    fn(t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
    if (t >= 1) done?.()
    return t < 1
  })
}
