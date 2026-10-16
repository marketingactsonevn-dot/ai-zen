import './kit.css'
import { fill, h, nextId, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx, SceneDef } from '../types'
import { blob, curve, onSize, p2Defs, rng, stableHeight, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills as paintHills, mist, moon as paintMoon, paperLantern, pine, reeds, toro, wash, water } from '../../ui/part2/paint'

/** Garden 8 (Trạm 22–24) toolkit: one SVG + HTML overlay per scene, the painted night shore (paint.ts), buttons and sliders. */
export const f1 = (n: number) => n.toFixed(1)
export const px = (n: number) => `${n.toFixed(1)}px`

/** Place an absolutely positioned element (left/top, optional width). */
export function put(el: HTMLElement, x: number, y: number, w?: number) {
  el.style.left = px(x)
  el.style.top = px(y)
  if (w != null) el.style.width = px(w)
}

/** Scene root at the art's stable height (no jump when the insight grows the foot); draw(W, H) on every resize. */
export function stage(ctx: SceneCtx, cls: string, art: string, copies: (Fact | string | undefined)[], draw: (W: number, H: number) => void) {
  p2Defs()
  const stableH = stableHeight(ctx, copies)
  const svg = s('svg', { class: 'g8-svg', 'aria-hidden': 'true' })
  const root = h('div', { class: `g8 ${cls}` }, h('p', { class: 'visually-hidden' }, art), svg)
  ctx.art.append(root)
  const box = { W: 0, H: 0 }
  const layout = () => {
    const W = ctx.art.clientWidth
    const H = stableH(ctx.art.clientHeight)
    if (W < 40 || H < 40) return
    box.W = W
    box.H = H
    root.style.height = px(H)
    svg.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    draw(W, H)
  }
  ctx.onCleanup(onSize(ctx.art, layout))
  return { root, svg, box, redraw: () => box.W && draw(box.W, box.H) }
}

/** A pill button in the Part 2 style. */
export function btn(text: string, aria: string | null, onClick: () => void, cls = '') {
  return h('button', { class: `btn ghost g8-btn ${cls}`, type: 'button', 'aria-label': aria, onClick }, text)
}

/** A labelled native range slider (keyboard ← → for free); valueText gets {n} and {total}. */
export function slider(label: string, aria: string, max: number, valueText: string, onInput: (v: number) => void, ends?: [string, string]) {
  const input = h('input', { type: 'range', class: 'g8-range', min: 0, max, step: 1, value: 0, 'aria-label': aria }) as HTMLInputElement
  const set = (v: number) => {
    input.value = String(v)
    input.setAttribute('aria-valuetext', fill(valueText, { n: v, total: max }))
    input.style.setProperty('--fill', `${((v / max) * 100).toFixed(1)}%`)
  }
  set(0)
  input.addEventListener('input', () => {
    const v = Number(input.value)
    set(v)
    onInput(v)
  })
  const el = h('div', { class: 'g8-slider' },
    h('span', { class: 'g8-slider-label', 'aria-hidden': 'true' }, label),
    ends ? h('div', { class: 'g8-slider-row' }, h('span', { class: 'g8-end', 'aria-hidden': 'true' }, ends[0]), input, h('span', { class: 'g8-end', 'aria-hidden': 'true' }, ends[1])) : input)
  return { el, input, set }
}

/** The far shore under the moon, for a scene whose water starts at y = wy: moonlit mist behind a far ink range, a nearer
 *  ridge on one side (side 1 right, -1 left, 0 none), mist on the waterline, then the lake down to y1 with the
 *  moon's broken road under mx. The moon itself sits at (mx, my) with radius mr (my < 0: no moon). */
export function nightShore(W: number, wy: number, y1: number, o: { seed: number; mx: number; my: number; mr: number; hh: number; side?: -1 | 0 | 1; water?: boolean }): SVGElement[] {
  const side = o.side ?? 1
  const out: SVGElement[] = [mist(W * 0.5, wy - o.hh * 0.7, W * 0.75, o.hh * 1.6)]
  if (o.my >= 0) out.push(paintMoon(o.mx, o.my, o.mr, o.seed, true))
  out.push(paintHills(-W * 0.05, W * 1.05, wy, o.hh, o.seed, 0.88, Math.max(3, Math.round(W / 240))))
  if (side) out.push(side > 0 ? paintHills(W * 0.6, W * 1.06, wy + 1, o.hh * 1.15, o.seed + 1, 0.4, 3) : paintHills(-W * 0.06, W * 0.4, wy + 1, o.hh * 1.15, o.seed + 1, 0.4, 3))
  if (o.water !== false) out.push(...lake(W, wy, y1, o.seed + 2, o.mx))
  out.push(mist(W * 0.5, wy, W * 0.7, Math.max(10, o.hh * 0.32)))
  return out
}

/**
 * A lake from the far waterline wy down to a near shore that curves up toward the sides (lowest, y1, in the middle):
 * the water a wash with a bleeding edge (no rectangle), ripples and the moon's road clipped to it, the near bank a
 * pale wash with a broken brushed shoreline.
 */
function lake(W: number, wy: number, y1: number, seed: number, mx?: number): SVGElement[] {
  const r = rng(seed)
  const D = y1 - wy
  const shore: Pt[] = Array.from({ length: 25 }, (_, i) => {
    const t = i / 24
    const dip = Math.sin(Math.PI * Math.pow(t, 0.9))
    return [W + 24 - (W + 48) * t, wy + D * (0.6 + 0.4 * dip) + Math.sin(t * 11 + seed) * D * 0.012] as Pt
  })
  const P = (pts: Pt[]) => pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')
  const body = `M-24 ${f1(wy)}L${f1(W + 24)} ${f1(wy)}L${P(shore)}Z`
  const id = nextId('g8lake')
  let line = ''
  for (let i = 0; i < 4; i++) {
    const a = Math.floor(r() * 6) + i * 6, b = Math.min(24, a + 3 + Math.floor(r() * 4))
    line += stroke(shore.slice(a, b + 1).map(([x, y]) => [x, y + 1] as Pt), 1.6 + r() * 1.6, 0.25, 0.3, 0.1)
  }
  return [
    s('defs', null, s('clipPath', { id }, s('path', { d: body }))),
    // (no filter on the body: a displacement filter over this much area bands in Chrome; the bank's wash softens the edge)
    s('path', { class: 'p2p-water-body', d: body, fill: 'url(#p2-water-v)' }),
    s('g', { 'clip-path': `url(#${id})` }, water(0, wy, W, y1, seed, mx, false)),
    wash(`M${P(shore)}L${f1(-24)} ${f1(y1 + D)}L${f1(W + 24)} ${f1(y1 + D)}Z`, 0.12, 'p2p-wash g8-bank'),
    s('path', { class: 'g8-shoreline', d: line, filter: 'url(#ink-rough)' }),
  ]
}

/** Several short brushed lines [x0, y0, x1, y1] as one path. */
export const brushLines = (ls: number[][], w: number, a = 0.15, b = 0.15) => ls.map(([x0, y0, x1, y1]) => stroke([[x0, y0], [x1, y1]], w, a, b, 0.4)).join('')

export { paintMoon as moon, paintHills as hills, mist, wash, reeds, grass, pine, toro, paperLantern, curve, stoneArt }

/** Draw a path in (WAAPI on stroke-dashoffset, pathLength 1); nothing under reduced motion. */
export function drawIn(ctx: SceneCtx, el: SVGPathElement, ms = 1200, delay = 0) {
  el.setAttribute('pathLength', '1')
  el.style.strokeDasharray = '1'
  if (ctx.reduced) return
  el.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: ms, delay, easing: 'cubic-bezier(.3,.1,.2,1)', fill: 'backwards' })
}

/** Text width for the serif face at size 1 (canvas measure, read once per call; no layout). */
let measureCtx: CanvasRenderingContext2D | null = null
let serif = ''
export function measure(text: string, size: number) {
  measureCtx ??= document.createElement('canvas').getContext('2d')
  if (!serif) serif = getComputedStyle(document.documentElement).getPropertyValue('--serif').trim() || 'serif'
  if (!measureCtx) return text.length * size * 0.5
  measureCtx.font = `${size}px ${serif}`
  return measureCtx.measureText(text).width
}

export { blob, stroke, rng, type Pt }

/**
 * A perspectiveCircle whose stones each get their own painted shape (tall, lying, mossy…): the shared component draws
 * stoneArt for all of them, so after it mounts the stone in each button's little SVG (viewBox -60 -70 120 90, standing on
 * y = 0) is swapped for paint[k]. Numbers, halo and selection styling stay the component's.
 */
export function withStones(def: SceneDef, paint: (() => SVGElement)[]): SceneDef {
  return {
    label: def.label,
    mount(ctx) {
      const off = def.mount(ctx)
      ctx.art.querySelectorAll('.p2c-stone-art').forEach((svg, k) => svg.querySelector('.p2-stone')?.replaceWith(paint[k % paint.length]()))
      return off
    },
  }
}
