import { h, s } from '../../core/dom'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import type { SceneCtx } from '../../stations/types'
import { blob, clamp, onSize, rng, stoneArt, stroke, type Pt } from './ink'
import { hills, mist, moon, pine, toro, wash } from './paint'
import './part2.css'
import './depth.css'

/**
 * A layered ink diorama without WebGL (README "depth"): painted SVG flats at depths behind a raked sand floor laid in true
 * CSS perspective, paper cut-outs standing on it with soft cast shadows, depth haze (far = paler, softer), parallax
 * from pointer / drag / gyro / set(). Compositor-only transforms; one createLoop that runs only while the view settles;
 * still under reduced motion. Colours are tokens (no JS on theme change).
 */

/** Screen-space geometry a backdrop flat is drawn in (it is scaled back so it looks drawn at depth 0). */
export interface DioGeo {
  w: number
  h: number
  /** y where the floor melts into the mist: stand mountains, water, the far shore on it */
  horizon: number
  seed: number
}
/** The floor in top view: u across (0…w), v toward the viewer (0 = far edge, d = near edge). */
export interface FloorGeo {
  w: number
  d: number
  seed: number
  /** floor point of a prop position (x 0…1 across the near view, z 0 near … 1 far) */
  at(x: number, z: number): Pt
}
/** A cut-out standing on the floor. w, h: shares of the art height (its size at the near edge); art(w, h) gets px and draws standing on y = 0, centred on x = 0. */
export interface DioProp {
  x: number
  z: number
  w: number
  h: number
  art: (w: number, h: number) => SVGElement | SVGElement[]
  /** cast shadow length as a share of h (default 0.6; 0 = only the contact shadow) */
  shadow?: number
  /** rake rings round its foot (default true) */
  ring?: boolean
}
export interface DioramaOpts {
  /** aria-label; makes the diorama role="img" (leave it out when props hold buttons) */
  label?: string
  seed?: number
  /** backdrop flats beyond the floor, depth 0 (at the floor's far edge) … 1 (sky) */
  layers?: { depth: number; art: (g: DioGeo) => SVGElement | SVGElement[] }[]
  /** raked sand floor with `stones` stepping stones receding (default 6); art adds your own top-view marks */
  floor?: { art?: (g: FloorGeo) => SVGElement | SVGElement[]; stones?: number } | false
  props?: DioProp[]
  /** tilt with the phone */
  gyro?: boolean
  /** parallax swing in degrees (default 2.6) */
  strength?: number
}
export interface Diorama {
  el: HTMLElement
  /** one element per prop (same order): add buttons, classes, listeners */
  props: HTMLElement[]
  /** steer the parallax yourself (scroll, a slider…): x, y in -1…1 */
  set(x: number, y: number): void
  dispose(): void
}

const f1 = (n: number) => (Math.round(n * 10) / 10).toString()
const list = (x: SVGElement | SVGElement[]) => (Array.isArray(x) ? x : [x])

/** Mount a diorama filling `host` (positioned). Cleans itself up with ctx.onCleanup. */
export function diorama(ctx: SceneCtx, host: HTMLElement, o: DioramaOpts): Diorama {
  const seed = o.seed ?? 1
  const S = o.strength ?? 2.6
  const el = h('div', o.label ? { class: 'p2d', role: 'img', 'aria-label': o.label } : { class: 'p2d', 'aria-hidden': 'true' })
  const world = h('div', { class: 'p2d-world' })
  el.append(world)
  host.append(el)
  const props = (o.props ?? []).map(() => h('div', { class: 'p2d-prop' }))

  let job: { cancel(): void } | null = null
  let first = true
  function layout() {
    const W = el.clientWidth, H = el.clientHeight
    if (!W || !H) return
    const P = Math.round(Math.max(H * 1.25, W * 0.65)) // perspective distance
    const hy = Math.round(H * 0.3) // eye level
    const FD = Math.round(P * 1.6), FW = Math.round(W * 1.9)
    const horizon = hy + ((H - hy) * P) / (P + FD)
    el.style.perspective = `${P}px`
    el.style.perspectiveOrigin = `50% ${hy}px`
    world.style.transformOrigin = `${W / 2}px ${hy}px ${-FD * 0.8}px`
    const g: DioGeo = { w: W, h: H, horizon, seed }
    const soft = ctx.quality !== 'low'
    // a flat beyond the floor, scaled back about the eye point so it looks as drawn; paler and softer with depth
    const flat = (d: number, kids: SVGElement[], cls = 'p2d-layer') => {
      const z = FD + d * P
      const blur = soft && d > 0.45 ? `;filter:blur(${(d * 1.3).toFixed(1)}px)` : ''
      return s('svg', { class: cls, viewBox: `0 0 ${W} ${H}`, width: W, height: H, style: `transform-origin:${W / 2}px ${hy}px;transform:translateZ(${-z}px) scale(${((P + z) / P).toFixed(4)});opacity:${(1 - d * 0.42).toFixed(2)}${blur}` }, ...kids)
    }
    const at = (x: number, z: number): Pt => [(FW - W) / 2 + x * W, FD * (1 - z * 0.9)]
    function* draw() {
      world.replaceChildren()
      for (const l of [...(o.layers ?? [])].sort((a, b) => b.depth - a.depth)) {
        world.append(flat(l.depth, list(l.art(g))))
        yield
      }
      // the mist wall where the floor ends
      world.append(flat(0, [mist(W * 0.5, horizon, W * 0.8, H * 0.08), mist(W * 0.15, horizon + H * 0.02, W * 0.45, H * 0.05), mist(W * 0.85, horizon + H * 0.01, W * 0.45, H * 0.06)], 'p2d-layer p2d-mistwall'))
      yield
      if (o.floor === false) return
      const fl = o.floor ?? {}
      const fg: FloorGeo = { w: FW, d: FD, seed, at }
      const r = rng(seed + 11)
      // raked rows across the floor (they recede for free), then rings round the props' feet
      let rows = ''
      for (let v = 10; v < FD; v += 17) {
        const pts: Pt[] = []
        for (let i = 0; i <= 16; i++) pts.push([(FW * i) / 16, v + Math.sin(i * 0.9 + v * 0.05) * 2.2])
        rows += `M${pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')}`
      }
      const kids: SVGElement[] = [s('rect', { class: 'p2d-sand', width: FW, height: FD }), s('path', { class: 'p2d-rake', d: rows }), s('path', { class: 'p2d-rake-hi', d: rows, transform: 'translate(0 2.4)' })]
      const shadow = (cx: number, cy: number, w: number, len: number, k: number) => {
        // thrown right and away from the moon-key light, plus a dark foot
        kids.push(wash(blob(0, 0, w * 0.42 + len * 0.5, w * 0.26 + len * 0.06, k, 0.18), 0.26, 'p2p-wash p2d-shadow'))
        kids[kids.length - 1].setAttribute('transform', `translate(${f1(cx + len * 0.42)} ${f1(cy - len * 0.3)}) rotate(-36)`)
        kids.push(s('ellipse', { class: 'p2d-foot', cx: f1(cx), cy: f1(cy - w * 0.04), rx: f1(w * 0.5), ry: f1(w * 0.2) }))
      }
      ;(o.props ?? []).forEach((p, i) => {
        const [u, v] = at(p.x, p.z)
        const pw = p.w * H, ph = p.h * H
        if (p.ring !== false) {
          kids.push(s('ellipse', { class: 'p2d-sand', cx: f1(u), cy: f1(v), rx: f1(pw * 0.55 + 62), ry: f1(pw * 0.4 + 62) }))
          let d = ''
          for (let k = 0; k < 4; k++) d += blob(u, v, pw * 0.55 + 10 + k * 16, pw * 0.4 + 10 + k * 16, seed + i, 0.03, 28)
          kids.push(s('path', { class: 'p2d-ring', d }))
        }
        shadow(u, v, pw, ph * (p.shadow ?? 0.6), seed + i)
      })
      // stepping stones from the near edge toward the mist: a top face, the side seen below it, a moonlit far edge
      const n = fl.stones ?? 6
      const rs = clamp(W * 0.06, 26, 92)
      for (let i = 0; i < n; i++) {
        const t = n > 1 ? i / (n - 1) : 0
        const [cx, cy] = at(0.3 + 0.2 * t + Math.sin(t * Math.PI) * 0.12 + (r() - 0.5) * 0.03, 0.04 + t * 0.72)
        const rx = rs * (0.85 + r() * 0.3), ry = rx * (0.72 + r() * 0.12)
        kids.push(wash(blob(cx + rx * 0.4, cy - ry * 0.3, rx * 1.05, ry, seed + i, 0.12), 0.3, 'p2p-wash p2d-shadow'))
        kids.push(s('path', { class: 'p2d-side', d: blob(cx, cy + ry * 0.26, rx, ry, seed + i, 0.1, 16) }))
        kids.push(s('path', { class: 'p2d-face', d: blob(cx, cy, rx, ry, seed + i, 0.1, 16), filter: 'url(#ink-rough)' }))
        const arc: Pt[] = []
        for (let k = 0; k <= 8; k++) {
          const a = Math.PI * (1.05 + k * 0.06)
          arc.push([cx + Math.cos(a) * rx * 0.86, cy + Math.sin(a) * ry * 0.86])
        }
        kids.push(s('path', { class: 'p2d-rim', d: stroke(arc, Math.max(1.5, rx * 0.09), 0.3, 0.3, 0.1) }))
        if (r() < 0.5) kids.push(s('path', { class: 'p2d-moss', d: blob(cx + rx * 0.25, cy + ry * 0.2, rx * 0.3, ry * 0.2, seed + i * 3, 0.3) }))
      }
      if (fl.art) kids.push(...list(fl.art(fg)))
      const floor = h('div', { class: 'p2d-floor', style: `width:${FW}px;height:${FD}px;left:${(W - FW) / 2}px;top:${H - FD}px` },
        s('svg', { class: 'p2d-floor-art', viewBox: `0 0 ${FW} ${FD}`, width: FW, height: FD }, ...kids))
      world.append(floor)
      yield
      ;(o.props ?? []).forEach((p, i) => {
        const [u, v] = at(p.x, p.z)
        const pw = Math.round(p.w * H), ph = Math.round(p.h * H)
        const el = props[i]
        el.style.cssText = `left:${f1(u - pw / 2)}px;top:${f1(v - ph)}px;width:${pw}px;height:${ph}px;opacity:${(1 - p.z * 0.4).toFixed(2)}`
        el.replaceChildren(s('svg', { viewBox: `${-pw / 2} ${-ph} ${pw} ${ph}`, width: pw, height: ph }, ...list(p.art(pw, ph))))
        floor.append(el)
      })
    }
    job?.cancel()
    // only the first draw soaks in; a re-layout draws in one go (README A.10)
    job = sliced(draw(), { sync: ctx.reduced || !first })
    first = false
  }
  const offSize = onSize(el, layout)

  // ── parallax: target → current with damping, written as one compositor-only transform
  const tgt = { x: 0, y: 0 }, cur = { x: 0, y: 0 }
  const apply = () => void (world.style.transform = `rotateX(${(-cur.y * S * 0.45).toFixed(3)}deg) rotateY(${(cur.x * S).toFixed(3)}deg)`)
  const loop = createLoop(el, (_t, dt) => {
    const f = dt > 0 ? 1 - Math.exp(-dt * 5) : 1
    cur.x += (tgt.x - cur.x) * f
    cur.y += (tgt.y - cur.y) * f
    apply()
    return Math.abs(tgt.x - cur.x) + Math.abs(tgt.y - cur.y) > 0.002
  })
  const set = (x: number, y: number) => {
    tgt.x = clamp(x, -1, 1)
    tgt.y = clamp(y, -1, 1)
    if (ctx.reduced) (cur.x = tgt.x), (cur.y = tgt.y), apply()
    else loop.start()
  }
  let rect: DOMRect | null = null
  let drag: { id: number; x: number; y: number; bx: number; by: number } | null = null
  const g0 = { x: NaN, y: NaN }
  const onEnter = () => void (rect = el.getBoundingClientRect())
  const onMove = (e: PointerEvent) => {
    if (drag && e.pointerId === drag.id) return set(drag.bx + ((e.clientX - drag.x) / (rect!.width * 0.35)), drag.by + ((e.clientY - drag.y) / (rect!.height * 0.35)))
    if (e.pointerType !== 'mouse') return
    rect ??= el.getBoundingClientRect()
    set(((e.clientX - rect.left) / rect.width) * 2 - 1, ((e.clientY - rect.top) / rect.height) * 2 - 1)
  }
  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return
    rect = el.getBoundingClientRect()
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, bx: tgt.x, by: tgt.y }
  }
  const onUp = (e: PointerEvent) => {
    if (drag && e.pointerId !== drag.id) return
    drag = null
    set(0, 0)
  }
  const onTilt = (e: DeviceOrientationEvent) => {
    if (e.gamma == null || e.beta == null || drag) return
    if (Number.isNaN(g0.x)) (g0.x = e.gamma), (g0.y = e.beta)
    set((e.gamma - g0.x) / 20, (e.beta - g0.y) / 20)
  }
  if (!ctx.reduced) {
    el.addEventListener('pointerenter', onEnter)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('pointerleave', onUp)
    if (o.gyro) addEventListener('deviceorientation', onTilt)
  }
  apply()

  let disposed = false
  const dispose = () => {
    if (disposed) return
    disposed = true
    job?.cancel()
    offSize()
    loop.dispose()
    removeEventListener('deviceorientation', onTilt)
    el.remove()
  }
  ctx.onCleanup(dispose)
  return { el, props, set, dispose }
}

/** A ready moonlit garden (moon, three ranges, stepping stones, a lantern, a rock, a pine): the demo, and stage3d's fallback. */
export function nightGarden(): DioramaOpts {
  return {
    seed: 4,
    layers: [
      { depth: 1, art: (g) => moon(g.w * 0.7, g.h * 0.15, Math.min(g.w, g.h) * 0.06, 2) },
      { depth: 0.75, art: (g) => hills(-g.w * 0.2, g.w * 1.2, g.horizon, g.h * 0.34, 21, 0.85, 4) },
      { depth: 0.4, art: (g) => [hills(-g.w * 0.25, g.w * 0.7, g.horizon, g.h * 0.24, 7, 0.45, 2), hills(g.w * 0.5, g.w * 1.25, g.horizon, g.h * 0.17, 9, 0.5, 2)] },
      { depth: 0.08, art: (g) => hills(-g.w * 0.15, g.w * 0.4, g.horizon, g.h * 0.08, 31, 0.15, 2) },
    ],
    props: [
      { x: 0.12, z: 0.1, w: 0.2, h: 0.13, art: (w, h) => stoneArt(w, h, 3) },
      { x: 0.76, z: 0.32, w: 0.11, h: 0.26, art: (_w, h) => toro(0, 0, h, true) },
      { x: 0.56, z: 0.62, w: 0.1, h: 0.06, art: (w, h) => stoneArt(w, h, 7) },
      { x: 0.95, z: 0.5, w: 0.24, h: 0.5, art: (_w, h) => pine(0, 0, h, 9, -1), ring: false },
    ],
  }
}
