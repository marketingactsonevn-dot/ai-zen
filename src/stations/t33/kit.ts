import './kit.css'
import '../../ui/part2/part2.css'
import { h, s } from '../../core/dom'
import { L } from '../../core/content'
import { createLoop } from '../../core/loop'
import { clamp, curve, p2Defs, rng, stroke, type Pt } from '../../ui/part2/ink'
import { paperLantern } from '../../ui/part2/paint'
import { findTakeaway, takeaway } from '../../ui/part2/takeaway'
import type { SceneCtx } from '../types'

/** Station 33's own small kit (copied from the garden-11 kit so this station owns its look): lantern, live region, card sheet, parallax. */

export const f1 = (n: number) => (Math.round(n * 10) / 10).toString()
export const P = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`

/**
 * What the keys scene left in the gardener's hand, for the letter scene after it: is sending out guarded (the key kept
 * on the ring, or given with the vermilion thread)? null = the keys scene was never played (the letter scene then lets
 * the crane fly, and offers to seal the gate).
 */
export const guard: { send: boolean | null } = { send: null }

/** Gradients this station's SVG uses (stops read tokens, so a theme change needs no JS), added to the page once. */
export function t33Defs() {
  p2Defs()
  if (document.getElementById('t33-defs')) return
  const stop = (o: number, c: string, a: number) => s('stop', { offset: o, style: `stop-color:var(${c});stop-opacity:${a}` })
  document.getElementById('p2-defs')!.append(s('defs', { id: 't33-defs' },
    s('linearGradient', { id: 't33h-ao', x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, '--umbra', 0.5), stop(1, '--umbra', 0)),
    s('linearGradient', { id: 't33h-roofao', x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, '--umbra', 0.55), stop(0.6, '--umbra', 0.2), stop(1, '--umbra', 0.05)),
    s('linearGradient', { id: 't33h-roofwarm', x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, '--lantern', 0), stop(0.7, '--lantern', 0.08), stop(1, '--lantern', 0.3)),
    s('linearGradient', { id: 't33k-sandg', x1: 0, y1: 0, x2: 0, y2: 1 },
      s('stop', { offset: 0, style: 'stop-color:color-mix(in srgb, var(--paper-2) 70%, var(--card));stop-opacity:0' }),
      s('stop', { offset: 0.12, style: 'stop-color:color-mix(in srgb, var(--paper-2) 70%, var(--card));stop-opacity:1' }),
      s('stop', { offset: 1, style: 'stop-color:color-mix(in srgb, var(--paper-2) 80%, var(--rock-mid));stop-opacity:1' })),
    s('radialGradient', { id: 't33k-dawn', cx: 0.82, cy: 0.62, r: 0.75 }, s('stop', { offset: 0, style: 'stop-color:var(--lantern);stop-opacity:0.32' }), s('stop', { offset: 0.35, style: 'stop-color:var(--dawn);stop-opacity:1' }), s('stop', { offset: 1, style: 'stop-color:var(--dawn);stop-opacity:0' })),
    s('linearGradient', { id: 't33k-dawnband', x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, style: 'stop-color:var(--mist);stop-opacity:0' }), s('stop', { offset: 0.3, style: 'stop-color:var(--mist);stop-opacity:0.18' }), s('stop', { offset: 0.48, style: 'stop-color:var(--lantern);stop-opacity:0.3' }), s('stop', { offset: 0.62, style: 'stop-color:var(--dawn);stop-opacity:1' }), s('stop', { offset: 1, style: 'stop-color:var(--dawn);stop-opacity:0' })),
    s('linearGradient', { id: 't33y-bronze', x1: 0, y1: 0, x2: 1, y2: 0.25 }, s('stop', { offset: 0, style: 'stop-color:color-mix(in srgb, var(--lantern) 70%, #fff);stop-opacity:1' }), s('stop', { offset: 0.35, style: 'stop-color:color-mix(in srgb, var(--lantern) 55%, #7a4f26);stop-opacity:1' }), s('stop', { offset: 0.7, style: 'stop-color:color-mix(in srgb, var(--lantern) 30%, #4a2e14);stop-opacity:1' }), s('stop', { offset: 1, style: 'stop-color:#2a1a0c;stop-opacity:1' })),
    s('linearGradient', { id: 't33y-spill', x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, '--lantern', 0.55), stop(1, '--lantern', 0)),
    s('radialGradient', { id: 't33y-window', cx: 0.5, cy: 0.7, r: 0.7 }, s('stop', { offset: 0, style: 'stop-color:color-mix(in srgb, var(--moon) 50%, var(--lantern));stop-opacity:1' }), stop(0.6, '--lantern', 0.95), s('stop', { offset: 1, style: 'stop-color:color-mix(in srgb, var(--lantern) 50%, #5a3010);stop-opacity:1' })),
    s('linearGradient', { id: 't33y-skin', x1: 0, y1: 0, x2: 0.15, y2: 1 },
      s('stop', { offset: 0, style: 'stop-color:color-mix(in srgb, #e9bd97 62%, var(--rock-hi))' }),
      s('stop', { offset: 0.55, style: 'stop-color:color-mix(in srgb, #cf9670 62%, var(--rock-mid))' }),
      s('stop', { offset: 1, style: 'stop-color:color-mix(in srgb, #8e5f44 58%, var(--rock-lo))' })),
    s('radialGradient', { id: 't33y-rvig', cx: 0.5, cy: 0.42, r: 0.72 }, stop(0.35, '--umbra', 0), stop(1, '--umbra', 0.62)),
    s('linearGradient', { id: 't33w-stone', x1: 0, y1: 0, x2: 0.2, y2: 1 }, stop(0, '--rock-mid', 1), stop(0.5, '--rock-lo', 1), s('stop', { offset: 1, style: 'stop-color:color-mix(in srgb, var(--rock-lo) 70%, var(--umbra));stop-opacity:1' })),
    s('linearGradient', { id: 't33w-wet', x1: 0, y1: 0, x2: 1, y2: 0.4 }, stop(0, '--moon', 0.12), stop(0.5, '--moon', 0), stop(1, '--umbra', 0.2)),
    s('radialGradient', { id: 't33-warm' }, stop(0, '--lantern', 0.7), stop(0.45, '--lantern', 0.22), stop(1, '--lantern', 0)),
    s('radialGradient', { id: 't33-cold' }, stop(0, '--moon', 0.5), stop(1, '--moon', 0))))
}

/** A paper lantern (viewBox 0 0 40 64). Unlit it is pale paper; `.on` on it or an ancestor lights it (CSS only). */
export function lantern(cls = '', seed = 7): SVGSVGElement {
  p2Defs()
  const lamp = paperLantern(20, 0, 13.5, seed, 9)
  lamp.children[2].after(s('ellipse', { class: 't33-lan-shade', cx: 20, cy: 25.9, rx: 13.6, ry: 17 }))
  return s('svg', { class: `t33-lan ${cls}`.trim(), viewBox: '0 0 40 64', 'aria-hidden': 'true' },
    lamp,
    s('path', { class: 't33-tassel', d: stroke([[20, 44], [20.5, 52], [19.6, 61]], 2.2, 0.05, 0.6, 0.3) }))
}

/**
 * A clump of reeds painted blade by blade from (x, y): long leaves that taper to a point, leaning `lean` (−1 left … 1 right),
 * some bent over at the tip, a few cattail stems; paler blades behind, ink in front, a moonlit edge on some.
 */
export function reedClump(x: number, y: number, hgt: number, seed: number, n = 9, lean = 0): SVGGElement {
  const r = rng(seed)
  let back = '', front = '', heads = '', rim = ''
  for (let i = 0; i < n; i++) {
    const bx = x + (r() - 0.5) * hgt * 0.3
    const hh = hgt * (0.45 + r() * 0.55)
    const lw = Math.max(2.4, hgt * (0.028 + r() * 0.02))
    const a = lean * 0.38 + (r() - 0.5) * 0.55
    const droop = r() < 0.35
    const c: Pt = [bx + Math.sin(a) * hh * 0.3, y - hh * 0.62]
    const tip: Pt = droop ? [bx + Math.sin(a) * hh + Math.sign(a || 1) * hh * 0.28, y - hh * 0.8] : [bx + Math.sin(a) * hh, y - Math.cos(a) * hh]
    const leaf = stroke(curve([bx, y], c, tip, 16), lw, 0, 0.85, 0.05)
    if (i % 3 === 1) back += leaf
    else front += leaf
    if (r() < 0.5) rim += stroke(curve([bx - lw * 0.28, y - hh * 0.12], [c[0] - lw * 0.28, c[1]], tip, 12), lw * 0.2, 0.25, 0.6, 0.1)
    if (r() < 0.3) {
      const sh = hh * 1.12, b = a * 0.6
      const top: Pt = [bx + Math.sin(b) * sh, y - Math.cos(b) * sh]
      front += stroke([[bx, y], [top[0], top[1] + sh * 0.18]], Math.max(1.1, lw * 0.28), 0.05, 0.05, 0.5)
      heads += stroke([[top[0] - Math.sin(b) * sh * 0.18, top[1] + sh * 0.18], top], lw * 1.25, 0.3, 0.3, 0.45)
    }
  }
  return s('g', { class: 't33-reeds', 'aria-hidden': 'true' },
    s('path', { class: 't33-reeds-b', d: back, filter: 'url(#ink-rough)' }),
    s('path', { class: 't33-reeds-f', d: front, filter: 'url(#ink-rough)' }),
    s('path', { class: 't33-reeds-h', d: heads }),
    s('path', { class: 't33-reeds-rim', d: rim }))
}

/** A polite live region, made live only after its first fill (entering the scene is not read twice). */
export function live(cls: string): HTMLElement & { say(...kids: (Node | string)[]): void } {
  const el = h('div', { class: cls }) as unknown as HTMLElement & { say(...kids: (Node | string)[]): void }
  el.say = (...kids) => {
    el.replaceChildren(...kids)
    if (!el.hasAttribute('aria-live')) el.setAttribute('aria-live', 'polite')
  }
  return el
}

/** The take-away card behind a paper pill: the pill shows on `show()`, the card opens over the art as a sheet. */
export function cardSheet(root: HTMLElement, id: string, onCleanup?: (fn: () => void) => void) {
  const card = findTakeaway(id)
  const sheet = h('div', { class: 't33-sheet', hidden: true })
  const pill = h('button', { class: 't33-take', type: 'button', hidden: true, 'aria-expanded': 'false' }, L.takeaway)
  const close = () => {
    sheet.hidden = true
    pill.setAttribute('aria-expanded', 'false')
    pill.focus({ preventScroll: true })
  }
  pill.addEventListener('click', () => {
    if (!card) return
    if (!sheet.childElementCount) sheet.append(h('button', { class: 't33-close', type: 'button', 'aria-label': L.close, onClick: close }, '×'), takeaway(card, null, onCleanup))
    sheet.hidden = false
    pill.setAttribute('aria-expanded', 'true')
    ;(sheet.querySelector('.p2k-copy') as HTMLElement | null)?.focus({ preventScroll: true })
  })
  sheet.addEventListener('keydown', (e) => e.key === 'Escape' && (e.stopPropagation(), close()))
  root.append(pill, sheet)
  return { show: () => card && (pill.hidden = false), pill }
}

/**
 * Pointer / tilt parallax for painted layers (2.5D): each layer moves k × the swing (px) toward the pointer, damped in one
 * createLoop that stops when settled. Transform-only writes. Off at quality=low and under reduced motion (static).
 */
export function parallax(ctx: SceneCtx, host: HTMLElement, layers: [HTMLElement | SVGElement, number][], swing = 14) {
  const tgt = { x: 0, y: 0 }, cur = { x: 0, y: 0 }
  const apply = () => {
    for (const [el, k] of layers) el.style.transform = `translate3d(${(-cur.x * k * swing).toFixed(2)}px,${(-cur.y * k * swing * 0.5).toFixed(2)}px,0)`
  }
  const loop = createLoop(host, (_t, dt) => {
    const f = dt > 0 ? 1 - Math.exp(-dt * 4) : 1
    cur.x += (tgt.x - cur.x) * f
    cur.y += (tgt.y - cur.y) * f
    apply()
    return Math.abs(tgt.x - cur.x) + Math.abs(tgt.y - cur.y) > 0.002
  })
  let rect: DOMRect | null = null
  const set = (x: number, y: number) => {
    tgt.x = clamp(x, -1, 1)
    tgt.y = clamp(y, -1, 1)
    loop.start()
  }
  const move = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    rect ??= host.getBoundingClientRect()
    set(((e.clientX - rect.left) / rect.width) * 2 - 1, ((e.clientY - rect.top) / rect.height) * 2 - 1)
  }
  const leave = () => ((rect = null), set(0, 0))
  const g0 = { x: NaN, y: NaN }
  const tilt = (e: DeviceOrientationEvent) => {
    if (e.gamma == null || e.beta == null) return
    if (Number.isNaN(g0.x)) (g0.x = e.gamma), (g0.y = e.beta)
    set((e.gamma - g0.x) / 18, (e.beta - g0.y) / 18)
  }
  const on = !ctx.reduced && ctx.quality !== 'low'
  if (on) {
    host.addEventListener('pointermove', move)
    host.addEventListener('pointerleave', leave)
    addEventListener('deviceorientation', tilt)
  }
  ctx.onCleanup(() => {
    loop.dispose()
    host.removeEventListener('pointermove', move)
    host.removeEventListener('pointerleave', leave)
    removeEventListener('deviceorientation', tilt)
  })
  return { set: (x: number, y: number) => on && set(x, y), resize: () => void (rect = null) }
}
