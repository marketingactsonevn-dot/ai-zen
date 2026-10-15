import './kit.css'
import { fill, h, nextId, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { blob, onSize, p2Defs, rng, stableHeight, stroke, type Pt } from '../../ui/part2/ink'

/** Garden 8 (Trạm 22–24) toolkit: one SVG + HTML overlay per scene, moon/water backdrops, buttons and sliders. */
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

/** The moon with its halo. */
export function moon(x: number, y: number, r: number) {
  return s('g', { class: 'g8-moon' },
    s('circle', { cx: f1(x), cy: f1(y), r: f1(r * 4.2), fill: 'url(#p2-halo)' }),
    s('circle', { class: 'g8-moon-disc', cx: f1(x), cy: f1(y), r: f1(r) }))
}

/** Far hills in the mist along y (two washes). */
export function hills(W: number, y: number, hgt: number, seed: number) {
  const g = s('g', { class: 'g8-hills' })
  for (const [k, op] of [[0, 0.07], [1, 0.11]] as const) {
    const r = rng(seed + k)
    const pts: Pt[] = []
    for (let i = 0; i <= 12; i++) pts.push([(i / 12) * W * 1.1 - W * 0.05, y - hgt * (k ? 0.55 : 1) * (0.35 + 0.65 * Math.abs(Math.sin(i * 0.8 + r() * 2.4)))])
    g.append(s('path', { class: 'k', 'fill-opacity': op, d: `M${f1(-W * 0.05)} ${f1(y)}L${pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')}L${f1(W * 1.05)} ${f1(y)}Z`, filter: 'url(#ink-wash)' }))
  }
  return g
}

/** A band of night water from y0 to y1 with a moon path at mx and a few glints. */
export function waterBand(W: number, y0: number, y1: number, mx: number, seed: number) {
  const id = nextId('g8w')
  const r = rng(seed)
  let glint = ''
  for (let i = 0; i < 18; i++) {
    const y = y0 + 6 + r() * (y1 - y0 - 12)
    const near = 1 - Math.min(1, Math.abs(r() - 0.5) * 2)
    const len = 10 + near * 50 * r()
    const x = mx + (r() - 0.5) * W * (0.12 + (1 - near) * 0.5)
    glint += `M${f1(x - len / 2)} ${f1(y)}h${f1(len)}`
  }
  return s('g', { class: 'g8-water' },
    s('defs', null, s('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 },
      s('stop', { offset: 0, style: 'stop-color:var(--water);stop-opacity:.55' }),
      s('stop', { offset: 1, style: 'stop-color:var(--water);stop-opacity:.95' }))),
    s('path', { d: `M0 ${f1(y0)}Q${f1(W * 0.3)} ${f1(y0 - 4)} ${f1(W * 0.55)} ${f1(y0 + 2)}T${f1(W)} ${f1(y0)}L${f1(W)} ${f1(y1)}L0 ${f1(y1)}Z`, fill: `url(#${id})` }),
    s('path', { class: 'g8-shore', d: stroke([[-4, y0 + 1], [W * 0.3, y0 - 3], [W * 0.55, y0 + 2], [W + 4, y0]], 2.2, 0.1, 0.1, 0.3), filter: 'url(#ink-rough)' }),
    s('path', { class: 'g8-glint', d: glint }))
}

/** A soft lantern-coloured glow (own gradient, so it follows the --lantern token). */
export function glowDefs(svg: SVGSVGElement) {
  const id = nextId('g8g')
  svg.append(s('defs', null, s('radialGradient', { id },
    s('stop', { offset: 0, style: 'stop-color:var(--lantern);stop-opacity:.75' }),
    s('stop', { offset: 0.45, style: 'stop-color:var(--lantern);stop-opacity:.22' }),
    s('stop', { offset: 1, style: 'stop-color:var(--lantern);stop-opacity:0' }))))
  return `url(#${id})`
}

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
