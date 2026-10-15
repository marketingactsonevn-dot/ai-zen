import { h, s } from '../core/dom'
import { L } from '../core/content'
import { prefs } from '../core/prefs'
import { icon } from './icons'

/**
 * Vườn Trăng (spec B.1, B.4): the taiko-bashi between the two maps, the "trăng lên" crossing, and the night art
 * of the Part 2 map — pond with the moon and its reflection, stone lanterns, fireflies. Everything here is static
 * SVG/DOM; the only motion is CSS (opacity/transform on small layers), switched off at quality=low and reduced motion.
 */

type Pt = { x: number; y: number }
const rnd = (k: number) => {
  const x = Math.sin(k * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}
const f1 = (v: number) => v.toFixed(1)

// ───────── the bridge ─────────

/**
 * Taiko-bashi in side elevation (160 × 84, water line at y 57): a high drum arch whose reflection closes it into a
 * full circle — a moon in the water — ink outlines over a light wash, railing and posts, vermilion giboshi.
 */
function bridgeArt(): SVGSVGElement {
  const deckY = (x: number) => {
    const t = (x - 2) / 156
    return 54 - 160 * t * (1 - t)
  }
  const railY = (x: number) => {
    const t = (x - 6) / 148
    return 40 - 160 * t * (1 - t)
  }
  const xs = [6, 22, 40, 60, 80, 100, 120, 138, 154]
  const posts = xs.map((x) => `M${x} ${f1(railY(x))}V${f1(deckY(x) - 0.5)}`).join('')
  const mid = xs.map((x, i) => `${i ? 'L' : 'M'}${x} ${f1((railY(x) + deckY(x)) / 2)}`).join('')
  const giboshi = (x: number) =>
    s('path', { class: 'br-gibo', d: `M${x - 3} ${f1(railY(x) + 0.4)}q0-4 3-6.6q3 2.6 3 6.6z` })
  return s('svg', { class: 'bridge-art', viewBox: '0 0 160 84', 'aria-hidden': 'true' },
    // the arch's reflection closes it into a circle; the stream runs under it in broken strokes
    s('path', { class: 'br-reflect', d: 'M22 57A58 27 0 0 0 138 57' }),
    s('path', { class: 'br-water', d: 'M0 58.5q9-1.2 18 0M30 61q14-1.4 28 0M100 61q14-1.4 30 0M142 58.5q9-1.2 18 0M58 66q11-1 22 0M88 70q9-.8 16 0' }),
    s('g', { class: 'br-ink' },
      s('path', { class: 'br-body', d: 'M2 54Q80 -26 158 54L150 57L138 57A58 27 0 0 0 22 57L10 57Z' }),
      s('path', { class: 'br-fascia', d: 'M2 54Q80 -26 158 54L152 56Q80 -8 8 56Z' }),
      s('path', { class: 'br-rail', d: `M6 40Q80 -40 154 40${posts}` }),
      s('path', { class: 'br-midrail', d: mid })),
    giboshi(6),
    giboshi(154))
}

/**
 * The taiko-bashi link. Part 1: at the end of the stone path, out to the right edge, into the Moon Garden.
 * Part 2: at the start of its path, back out over the left edge to the Day Garden. Placed by the map's layout().
 */
export function bridgeLink(toPart: 1 | 2): HTMLAnchorElement {
  const href = toPart === 2 ? '#/vuon-trang' : '#/vuon'
  const label = toPart === 2
    ? h('span', { class: 'bridge-label' }, L.partTwo, icon('arrowR', 'icon sm'))
    : h('span', { class: 'bridge-label' }, icon('arrowL', 'icon sm'), L.partOne)
  const a = h('a', {
    class: 'bridge',
    href,
    'data-to': toPart,
    'aria-label': toPart === 2 ? L.toPartTwo : L.toPartOne,
    title: toPart === 2 ? L.bridgeHint : L.toPartOne,
  }, bridgeArt(), label)
  a.addEventListener('click', (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return // new tab / window: a plain link
    e.preventDefault()
    crossBridge(href, toPart, document.activeElement === a)
  })
  return a
}

// ───────── "trăng lên": the crossing between the two maps ─────────

let crossing = false

/**
 * rich: the night (or the dawn, going back) washes over from the top (from the bottom) in ~0.5 s, the maps swap
 * under it, then it lifts in ~0.4 s while the moon rises; calm: a 0.4 s fade through the other garden's paper.
 * Only opacity/transform, WAAPI; reduced motion: an instant swap. The router unmounts the old map before mounting
 * the new one, under the veil, so two maps are never alive at once.
 */
export function crossBridge(href: string, toPart: 1 | 2, refocus: boolean) {
  if (crossing) return
  // keyboard crossing: carry focus onto the new map (unless something, e.g. the B.5 card, already took it)
  const focusNew = () => {
    if (refocus && (document.activeElement === document.body || !document.activeElement))
      document.querySelector<HTMLElement>('.garden .pstone[data-here], .garden .pstone')?.focus({ preventScroll: true })
  }
  if (prefs.reduced) {
    addEventListener('hashchange', focusNew, { once: true })
    location.hash = href
    return
  }
  const at = location.hash
  crossing = true
  const calm = prefs.calm
  const veil = h('div', { class: `moonrise to-${toPart}`, 'aria-hidden': 'true' })
  const moon = toPart === 2 && !calm ? h('div', { class: 'moonrise-moon', 'aria-hidden': 'true' }) : null
  document.body.append(veil)
  if (moon) document.body.append(moon)
  const from = toPart === 2 ? '-100%' : '100%'
  const cover = calm
    ? veil.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-in', fill: 'both' })
    : veil.animate([{ transform: `translateY(${from})` }, { transform: 'translateY(0)' }], { duration: 520, easing: 'cubic-bezier(0.45, 0.05, 0.55, 0.95)', fill: 'both' })
  moon?.animate([{ opacity: 0, transform: 'translateY(60px) scale(0.92)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], { duration: 900, easing: 'cubic-bezier(0.215, 0.61, 0.355, 1)', fill: 'both' })
  let safety = 0
  const reveal = () => {
    removeEventListener('hashchange', reveal)
    clearTimeout(safety)
    focusNew()
    const out = veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: calm ? 200 : 420, easing: 'ease-out', fill: 'both' })
    moon?.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-24px)' }], { duration: 420, easing: 'ease-out', fill: 'both' })
    out.finished.then(done, done)
  }
  const done = () => {
    veil.remove()
    moon?.remove()
    crossing = false
  }
  cover.finished.then(() => {
    if (location.hash !== at) return reveal() // the viewer went elsewhere under the veil (Back, keyboard): just lift it
    addEventListener('hashchange', reveal) // after the router's own listener: the new map is mounted when this runs
    safety = window.setTimeout(reveal, 900)
    location.hash = href
  }, done)
}

// ───────── night art: pond, moon, reflection ─────────

export type Night = { pond: Pt & { rx: number; ry: number }; moon: Pt & { r: number }; w: number; h: number; portrait: boolean }

/** Organic pond outline: an ellipse with a gentle wobble, a little fuller on the near (lower) side. */
function pondPath(p: Night['pond']) {
  const n = 14
  const pts: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const k = 1 + (rnd(i * 7.3 + 2) - 0.5) * 0.09 + (Math.sin(a) > 0 ? 0.03 : 0)
    pts.push([p.x + Math.cos(a) * p.rx * k, p.y + Math.sin(a) * p.ry * k])
  }
  let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], q1 = pts[i], q2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n]
    const k = 1 / 6
    d += `C${f1(q1[0] + (q2[0] - p0[0]) * k)} ${f1(q1[1] + (q2[1] - p0[1]) * k)} ${f1(q2[0] - (p3[0] - q1[0]) * k)} ${f1(q2[1] - (p3[1] - q1[1]) * k)} ${f1(q2[0])} ${f1(q2[1])}`
  }
  return d + 'Z'
}

/** Moonlight broken on the water: short horizontal strokes in a column under the moon, longer near the reflection. */
function glitter(n: Night, seed: number, cls: string) {
  const { pond: p, moon: m } = n
  const top = p.y - p.ry * 0.82
  const bottom = p.y + p.ry * 0.9
  const cy = p.y - p.ry * 0.18
  const step = Math.max(3.2, p.ry * 0.055)
  let d = ''
  let i = 0
  for (let y = top; y < bottom; y += step * (0.8 + rnd(seed + i) * 0.5)) {
    i++
    if (Math.abs(y - cy) < m.r * 0.55) continue // the reflected disc itself
    const near = 1 - Math.min(1, Math.abs(y - cy) / (p.ry * 1.1))
    if (rnd(seed + i * 3.1) > 0.35 + near * 0.6) continue
    const len = m.r * (0.25 + near * 1.15) * (0.5 + rnd(seed + i * 5.7))
    const x = m.x + (rnd(seed + i * 9.1) - 0.5) * m.r * (0.6 + near * 1.3)
    d += `M${f1(x - len / 2)} ${f1(y)}h${f1(len)}`
  }
  return s('path', { class: cls, d })
}

/**
 * The night layer under the rocks: a mist pool where the moon hangs, the moon (halo, disc, a breath of cloud), and
 * the pond: dark still water holding the reflected moon and its broken light, a brushed rim, two lily pads.
 */
export function drawNight(svg: SVGSVGElement, n: Night) {
  const { pond: p, moon: m } = n
  svg.setAttribute('viewBox', `0 0 ${n.w} ${n.h}`)
  const pd = pondPath(p)
  const ref = { x: m.x, y: p.y - p.ry * 0.18 }
  const stop = (o: number, c: string, a = 1) => s('stop', { offset: o, style: `stop-color:var(${c});stop-opacity:${a}` })
  const pad = (x: number, y: number, r: number, rot: number) =>
    s('path', { class: 'pond-pad', d: `M${f1(x)} ${f1(y)}m${f1(r)} 0a${f1(r)} ${f1(r * 0.55)} 0 1 1 ${f1(-r * 0.3)} ${f1(-r * 0.42)}L${f1(x)} ${f1(y)}z`, transform: `rotate(${rot} ${f1(x)} ${f1(y)})` })
  // a breath of cloud across the moon: a thin brush lens, thick in the middle, tapering to both tips
  const cloud = (x0: number, y0: number, len: number, wgt: number) =>
    s('path', { class: 'moon-cloud', d: `M${f1(x0)} ${f1(y0)}Q${f1(x0 + len * 0.45)} ${f1(y0 - wgt * 1.6)} ${f1(x0 + len)} ${f1(y0 - wgt * 0.5)}Q${f1(x0 + len * 0.55)} ${f1(y0 + wgt * 0.5)} ${f1(x0)} ${f1(y0)}Z` })
  svg.replaceChildren(
    s('defs', null,
      s('radialGradient', { id: 'nt-mist' }, stop(0, '--paper', 0.92), stop(0.55, '--paper', 0.6), stop(1, '--paper', 0)),
      s('radialGradient', { id: 'nt-halo' }, stop(0, '--moon', 0.42), stop(0.35, '--moon', 0.12), stop(1, '--moon', 0)),
      s('radialGradient', { id: 'nt-disc', cx: '0.42', cy: '0.38', r: '0.7' }, stop(0, '--moon'), stop(0.8, '--moon'), stop(1, '--moon', 0.82)),
      s('radialGradient', { id: 'nt-road', cx: '0.5', cy: '0.5', r: '0.5' }, stop(0, '--moon', 0.3), stop(0.6, '--moon', 0.07), stop(1, '--moon', 0)),
      s('radialGradient', { id: 'nt-far' }, stop(0, '--umbra', 0.5), stop(1, '--umbra', 0)),
      s('radialGradient', { id: 'nt-lamp' }, stop(0, '--lantern', 0.6), stop(0.45, '--lantern', 0.18), stop(1, '--lantern', 0)), // lanterns' halo
      // still water: a little sky in the middle, deepening toward the banks
      s('radialGradient', { id: 'nt-water', cx: '0.5', cy: '0.58', r: '0.62' }, stop(0, '--water', 0.8), stop(0.65, '--water', 0.92), stop(1, '--water')),
      s('clipPath', { id: 'nt-pond' }, s('path', { d: pd })),
      s('clipPath', { id: 'nt-moon' }, s('circle', { cx: f1(m.x), cy: f1(m.y), r: f1(m.r) }))),
    // the moon, in its own pool of mist so the raked rows fade out around it
    s('ellipse', { cx: f1(m.x), cy: f1(m.y), rx: f1(m.r * 4.6), ry: f1(m.r * 2.6), fill: 'url(#nt-mist)' }),
    s('circle', { cx: f1(m.x), cy: f1(m.y), r: f1(m.r * 3.6), fill: 'url(#nt-halo)' }),
    s('circle', { class: 'moon-disc', cx: f1(m.x), cy: f1(m.y), r: f1(m.r), fill: 'url(#nt-disc)' }),
    s('g', { 'clip-path': 'url(#nt-moon)', class: 'moon-maria' },
      s('ellipse', { cx: f1(m.x - m.r * 0.28), cy: f1(m.y - m.r * 0.2), rx: f1(m.r * 0.36), ry: f1(m.r * 0.26) }),
      s('ellipse', { cx: f1(m.x + m.r * 0.22), cy: f1(m.y + m.r * 0.1), rx: f1(m.r * 0.26), ry: f1(m.r * 0.32) }),
      s('ellipse', { cx: f1(m.x - m.r * 0.05), cy: f1(m.y + m.r * 0.45), rx: f1(m.r * 0.2), ry: f1(m.r * 0.13) })),
    s('circle', { class: 'moon-rim', cx: f1(m.x), cy: f1(m.y), r: f1(m.r) }),
    cloud(m.x - m.r * 1.9, m.y + m.r * 0.5, m.r * 2.9, m.r * 0.26),
    cloud(m.x - m.r * 0.4, m.y + m.r * 0.9, m.r * 2.3, m.r * 0.16),
    // the pond
    s('path', { class: 'pond-bank', d: pd, transform: `translate(${f1(p.rx * 0.02)} ${f1(p.ry * 0.07)})` }),
    s('path', { d: pd, fill: 'url(#nt-water)' }),
    s('g', { 'clip-path': 'url(#nt-pond)' },
      s('ellipse', { cx: f1(ref.x), cy: f1(p.y), rx: f1(m.r * 2.1), ry: f1(p.ry * 1.05), fill: 'url(#nt-road)' }),
      s('ellipse', { cx: f1(p.x), cy: f1(p.y - p.ry * 1.0), rx: f1(p.rx * 1.1), ry: f1(p.ry * 0.42), fill: 'url(#nt-far)' }),
      s('ellipse', { class: 'moon-reflect', cx: f1(ref.x), cy: f1(ref.y), rx: f1(m.r * 0.92), ry: f1(m.r * 0.5) }),
      s('path', { class: 'moon-reflect-cut', d: `M${f1(ref.x - m.r)} ${f1(ref.y + m.r * 0.08)}h${f1(m.r * 2)}M${f1(ref.x - m.r)} ${f1(ref.y - m.r * 0.22)}h${f1(m.r * 2)}` }),
      glitter(n, 11, 'pond-glitter'),
      // where something touched the water a moment ago
      ...[0.5, 0.95, 1.5].map((k) => s('ellipse', { class: 'pond-ring', cx: f1(p.x - p.rx * 0.42), cy: f1(p.y + p.ry * 0.12), rx: f1(p.rx * 0.12 * k), ry: f1(p.ry * 0.07 * k) }))),
    s('path', { class: 'pond-rim', d: pd }),
    pad(p.x - p.rx * 0.62, p.y + p.ry * 0.38, Math.max(4, p.rx * 0.06), 20),
    pad(p.x - p.rx * 0.5, p.y + p.ry * 0.56, Math.max(3, p.rx * 0.042), -35),
    pad(p.x + p.rx * 0.58, p.y - p.ry * 0.3, Math.max(3, p.rx * 0.045), 70))
}

/** A second pattern of broken light over the reflection, cross-faded by CSS (rich only): the water seems to move. */
export function drawGlint(svg: SVGSVGElement, n: Night) {
  const { pond: p, moon: m } = n
  const x = m.x - m.r * 2.2, y = p.y - p.ry, w = m.r * 4.4, hh = p.ry * 2
  svg.setAttribute('viewBox', `${f1(x)} ${f1(y)} ${f1(w)} ${f1(hh)}`)
  Object.assign(svg.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${hh}px` })
  svg.replaceChildren(s('g', { 'clip-path': 'url(#nt-pond)' }, glitter(n, 47, 'pond-glitter')))
}

// ───────── stone lanterns ─────────

/** Kasuga-style tōrō (side view) standing at `base`, `H` tall: foot, post, platform, lit firebox, curled roof, jewel. */
export function lantern(svg: SVGSVGElement, base: Pt, H: number, garden: number) {
  const u = H / 10
  const { x, y } = base
  const X = (v: number) => f1(x + v * u)
  const Y = (v: number) => f1(y - v * u)
  const win = { x: x, y: y - 6.35 * u }
  svg.append(
    s('g', { class: 'lantern', 'data-garden': garden },
      s('ellipse', { class: 'rock-contact', cx: X(0.3), cy: Y(-0.1), rx: f1(u * 1.9), ry: f1(u * 0.42) }),
      s('circle', { cx: f1(win.x), cy: f1(win.y), r: f1(u * 2.8), fill: 'url(#nt-lamp)' }),
      s('g', { class: 'lantern-stone' },
        s('path', { d: `M${X(-1.2)} ${Y(0)}L${X(1.2)} ${Y(0)}L${X(0.9)} ${Y(0.9)}L${X(-0.9)} ${Y(0.9)}Z` }), // foot
        s('path', { d: `M${X(-0.38)} ${Y(0.9)}L${X(0.38)} ${Y(0.9)}L${X(0.32)} ${Y(4.5)}L${X(-0.32)} ${Y(4.5)}Z` }), // post
        s('path', { d: `M${X(-1.35)} ${Y(4.5)}L${X(1.35)} ${Y(4.5)}L${X(1.0)} ${Y(5.3)}L${X(-1.0)} ${Y(5.3)}Z` }), // platform
        s('path', { d: `M${X(-0.95)} ${Y(5.3)}L${X(0.95)} ${Y(5.3)}L${X(0.95)} ${Y(7.3)}L${X(-0.95)} ${Y(7.3)}Z` }), // firebox
        // roof: wide, sweeping down to upturned corners
        s('path', { d: `M${X(-1.9)} ${Y(7.25)}Q${X(-1.3)} ${Y(7.55)} ${X(-0.9)} ${Y(8.1)}Q${X(-0.4)} ${Y(8.7)} ${X(0)} ${Y(8.75)}Q${X(0.4)} ${Y(8.7)} ${X(0.9)} ${Y(8.1)}Q${X(1.3)} ${Y(7.55)} ${X(1.9)} ${Y(7.25)}Q${X(2.05)} ${Y(7.5)} ${X(1.95)} ${Y(7.7)}Q${X(1.2)} ${Y(7.7)} ${X(0.95)} ${Y(7.3)}L${X(-0.95)} ${Y(7.3)}Q${X(-1.2)} ${Y(7.7)} ${X(-1.95)} ${Y(7.7)}Q${X(-2.05)} ${Y(7.5)} ${X(-1.9)} ${Y(7.25)}Z` }),
        s('circle', { cx: X(0), cy: Y(9.25), r: f1(u * 0.42) })), // jewel
      s('rect', { class: 'lantern-window', x: X(-0.5), y: Y(7.0), width: f1(u), height: f1(u * 1.35), rx: f1(u * 0.12) }),
      s('path', { class: 'lantern-ink', d: `M${X(-0.95)} ${Y(5.3)}V${Y(7.3)}M${X(0.95)} ${Y(5.3)}V${Y(7.3)}M${X(-1.35)} ${Y(4.5)}H${X(1.35)}M${X(-1.2)} ${Y(0)}H${X(1.2)}` })))
}

/** Warm pools of lantern light on the sand (HTML, so the breathing is a compositor-only opacity animation). */
export function lanternGlow(at: Pt, r: number, i: number) {
  return h('span', { class: 'lglow', style: `left:${f1(at.x)}px;top:${f1(at.y)}px;--g:${f1(r * 2)}px;--d:${(-i * 1.7).toFixed(1)}s` })
}

/** Sparse fireflies drifting near the lanterns and the water (CSS keyframes; none at quality=low or reduced motion). */
export function firefly(at: Pt, i: number) {
  const dx = (rnd(i * 3.7) - 0.5) * 70, dy = (rnd(i * 5.1) - 0.5) * 50 - 12
  return h('span', { class: 'firefly', style: `left:${f1(at.x)}px;top:${f1(at.y)}px;--dx:${f1(dx)}px;--dy:${f1(dy)}px;--t:${(7 + rnd(i * 2.3) * 6).toFixed(1)}s;--d:${(-rnd(i * 8.9) * 9).toFixed(1)}s` })
}
