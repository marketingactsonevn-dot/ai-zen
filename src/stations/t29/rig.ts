import { h } from '../../core/dom'
import { createLoop } from '../../core/loop'
import { clamp, type Pt } from '../../ui/part2/ink'
import type { SceneCtx } from '../types'

/** Number → short string for SVG / CSS. */
export const f1 = (n: number) => (Math.round(n * 10) / 10).toString()
export const P = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`
export { clamp }

export interface RigOpts {
  /** camera home: yaw (deg, + swings the right side away), pitch (deg looking down) */
  yaw: number
  pitch: number
  /** hover parallax in degrees (mouse only, not under reduced motion); default 2 */
  tilt?: number
  /** drag on the stage turns the camera within home ± this many degrees (0 = no drag) */
  drag?: number
  /** called with the camera's current yaw / pitch (deg) whenever it moves (a 2D backdrop follows) */
  onMove?: (yaw: number, pitch: number) => void
}

export interface Rig {
  /** the perspective box (fills the host) */
  el: HTMLElement
  /** the world: origin at the focus point, y down, z toward the viewer; children are placed with put()/plane()/stand() */
  cam: HTMLElement
  /** perspective distance and focus point (px in el); call on every layout */
  frame(P: number, fx: number, fy: number): void
  /** move the camera home (animated unless reduced): yaw, pitch, a vertical lift in px, a dolly toward the focus in px, a pan in px */
  home(yaw: number, pitch: number, lift?: number, zoom?: number, pan?: number): void
  /** a card that always faces the camera: its transform is the counter-yaw (place it with an at() anchor) */
  bill(el: HTMLElement): void
  clearBills(): void
  readonly yaw: number
  /** true while a drag turned the camera (so a click right after it can be ignored) */
  readonly dragged: boolean
}

/**
 * A small CSS-3D camera rig (no WebGL): a perspective box, a preserve-3d world turned by yaw/pitch about a focus point,
 * hover parallax and drag-to-turn, one createLoop that runs only while the camera settles. Billboards counter-turn so
 * paper figures keep facing the viewer. Reduced motion: every move is a cut.
 */
export function rig(ctx: SceneCtx, host: HTMLElement, o: RigOpts): Rig {
  const el = h('div', { class: 't29-rig' })
  const cam = h('div', { class: 't29-cam' })
  el.append(cam)
  host.append(el)
  const tilt = ctx.reduced ? 0 : (o.tilt ?? 2)
  const tgt = { yaw: o.yaw, pitch: o.pitch, lift: 0, zoom: 0, pan: 0, dy: 0, hx: 0, hy: 0 }
  const cur = { ...tgt }
  const bills: HTMLElement[] = []
  let lastBill = NaN

  const apply = () => {
    const yaw = cur.yaw + cur.dy + cur.hx
    cam.style.transform = `translate3d(${f1(cur.pan)}px,${f1(cur.lift)}px,${f1(cur.zoom)}px) rotateX(${(-(cur.pitch + cur.hy)).toFixed(2)}deg) rotateY(${yaw.toFixed(2)}deg)`
    if (Math.abs(yaw - lastBill) > 0.05) {
      lastBill = yaw
      const t = `rotateY(${(-yaw).toFixed(2)}deg)`
      for (const b of bills) b.style.transform = t
    }
    o.onMove?.(yaw, cur.pitch + cur.hy)
  }
  const loop = createLoop(el, (_t, dt) => {
    const f = dt > 0 ? 1 - Math.exp(-dt * 4.2) : 1
    let d = 0
    for (const k of ['yaw', 'pitch', 'lift', 'zoom', 'pan', 'dy', 'hx', 'hy'] as const) {
      cur[k] += (tgt[k] - cur[k]) * f
      d += Math.abs(tgt[k] - cur[k])
    }
    apply()
    return d > 0.01
  })
  const go = () => {
    if (ctx.reduced) Object.assign(cur, tgt), apply()
    else loop.start()
  }

  // drag to turn (pointer on the stage itself; interactive children stop their own events)
  let drag: { id: number; x: number; y0: number; moved: boolean } | null = null
  let dragged = false
  let rect: DOMRect | null = null
  const range = o.drag ?? 0
  el.addEventListener('pointerdown', (e) => {
    dragged = false
    // controls handle their own drags (they let the event bubble so the scene's prompt still fades)
    if (!range || e.button || (e.target as Element).closest('button, [role="button"], [role="slider"]')) return
    drag = { id: e.pointerId, x: e.clientX, y0: tgt.dy, moved: false }
  })
  el.addEventListener('pointermove', (e) => {
    if (drag && e.pointerId === drag.id) {
      const dx = e.clientX - drag.x
      if (!drag.moved && Math.abs(dx) < 6) return
      if (!drag.moved) el.setPointerCapture(e.pointerId)
      drag.moved = dragged = true
      tgt.dy = clamp(drag.y0 + dx * 0.16, -range, range)
      return go()
    }
    if (!tilt || e.pointerType !== 'mouse') return
    rect ??= el.getBoundingClientRect()
    tgt.hx = (((e.clientX - rect.left) / rect.width) * 2 - 1) * tilt
    tgt.hy = (((e.clientY - rect.top) / rect.height) * 2 - 1) * tilt * 0.4
    go()
  })
  const up = (e: PointerEvent) => {
    if (drag && e.pointerId === drag.id) drag = null
  }
  el.addEventListener('pointerup', up)
  el.addEventListener('pointercancel', up)
  el.addEventListener('pointerleave', () => {
    rect = null
    if (tilt && !drag) (tgt.hx = tgt.hy = 0), go()
  })
  ctx.onCleanup(() => loop.dispose())

  return {
    el,
    cam,
    frame(Pd, fx, fy) {
      el.style.perspective = `${f1(Pd)}px`
      el.style.perspectiveOrigin = `${f1(fx)}px ${f1(fy)}px`
      cam.style.left = `${f1(fx)}px`
      cam.style.top = `${f1(fy)}px`
      rect = null
      apply()
    },
    home(yaw, pitch, lift = 0, zoom = 0, pan = 0) {
      Object.assign(tgt, { yaw, pitch, lift, zoom, pan })
      go()
    },
    bill(b) {
      bills.push(b)
      b.style.transform = `rotateY(${(-(cur.yaw + cur.dy + cur.hx)).toFixed(2)}deg)`
    },
    clearBills() {
      bills.length = 0
      lastBill = NaN
    },
    get yaw() {
      return cur.yaw + cur.dy
    },
    get dragged() {
      return dragged
    },
  }
}

/** A flat card lying on the ground plane at height y (px, negative = up), centred on (x, z), w across and d deep. */
export function plane(cls: string, x: number, y: number, z: number, w: number, d: number, extra = ''): HTMLElement {
  return h('div', { class: `t29-face ${cls}`, style: `width:${f1(w)}px;height:${f1(d)}px;transform:translate3d(${f1(x - w / 2)}px,${f1(y - d / 2)}px,${f1(z)}px) rotateX(90deg)${extra}` })
}

/** A vertical card facing +z, its foot centred at (x, y, z), w × h px; ry turns it about its foot. */
export function stand(cls: string, x: number, y: number, z: number, w: number, hh: number, ry = 0): HTMLElement {
  return h('div', { class: `t29-face t29-stand ${cls}`, style: `width:${f1(w)}px;height:${f1(hh)}px;transform:${standAt(x, y, z, w, hh)}${ry ? ` rotateY(${ry}deg)` : ''}` })
}
export const standAt = (x: number, y: number, z: number, w: number, hh: number) => `translate3d(${f1(x - w / 2)}px,${f1(y - hh)}px,${f1(z)}px)`
export const at3 = (x: number, y: number, z: number) => `translate3d(${f1(x)}px,${f1(y)}px,${f1(z)}px)`

/** An anchor at (x, y, z) holding a billboard card w × h whose foot is the anchor: [anchor, card]. Register card with rig.bill(). */
export function billboard(cls: string, x: number, y: number, z: number, w: number, hh: number, ...kids: (Node | null)[]): [HTMLElement, HTMLElement] {
  const card = h('div', { class: `t29-bill ${cls}`, style: `left:${f1(-w / 2)}px;top:${f1(-hh)}px;width:${f1(w)}px;height:${f1(hh)}px` }, ...kids)
  return [h('div', { class: 't29-at', style: `transform:${at3(x, y, z)}` }, card), card]
}

/** Where a world point (garden units) lands relative to the focus under the rig's camera (yaw, pitch in deg; cam = the
 *  perspective distance in garden units): [x, y] in garden units at the focus plane (× k = px). Same maths as the CSS. */
export function project(yaw: number, pitch: number, cam: number, [x, y, z]: [number, number, number]): [number, number] {
  const a = (yaw * Math.PI) / 180, p = (pitch * Math.PI) / 180
  const x1 = x * Math.cos(a) + z * Math.sin(a), z1 = -x * Math.sin(a) + z * Math.cos(a)
  const y2 = y * Math.cos(p) + z1 * Math.sin(p), z2 = -y * Math.sin(p) + z1 * Math.cos(p)
  const s = cam / (cam - z2)
  return [x1 * s, y2 * s]
}
