import { s } from '../../core/dom'
import { blob, clamp, curve, rng, stroke, type Pt } from '../../ui/part2/ink'
import type { SceneCtx } from '../types'
import { f1, fog, polyD } from '../t37/sumi'

/**
 * The stone trays and the rattan basket of scene 4, painted behind their HTML (drop buttons and pebbles stay HTML and
 * sit on top). Drawn at the element's own pixel size, redrawn only when that size changes.
 */

/** A slab outline: a rounded rectangle with a hand-cut wobble, as points (closed). */
function slab(x: number, y: number, w: number, h: number, rad: number, seed: number): Pt[] {
  const r = rng(seed)
  const R = Math.min(rad, w / 2, h / 2)
  const pts: Pt[] = []
  const corner = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i <= 4; i++) {
      const a = ((a0 + i * 22.5) * Math.PI) / 180
      pts.push([cx + Math.cos(a) * R + (r() - 0.5) * 0.8, cy + Math.sin(a) * R + (r() - 0.5) * 0.8])
    }
  }
  const edge = (x0: number, y0: number, x1: number, y1: number) => {
    const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 26))
    for (let i = 1; i < n; i++) pts.push([x0 + ((x1 - x0) * i) / n + (r() - 0.5) * 0.9, y0 + ((y1 - y0) * i) / n + (r() - 0.5) * 0.9])
  }
  corner(x + R, y + R, 180)
  edge(x + R, y, x + w - R, y)
  corner(x + w - R, y + R, 270)
  edge(x + w, y + R, x + w, y + h - R)
  corner(x + w - R, y + h - R, 0)
  edge(x + w - R, y + h, x + R, y + h)
  corner(x + R, y + h - R, 90)
  edge(x, y + h - R, x, y + R)
  return pts
}
const closed = (p: Pt[]) => `${polyD(p)}Z`

/** Gravel: n small stones scattered over a box, as one d. */
function gravel(x: number, y: number, w: number, h: number, n: number, size: number, seed: number) {
  const r = rng(seed)
  let d = ''
  for (let i = 0; i < n; i++) d += blob(x + r() * w, y + r() * h, size * (0.6 + r() * 0.7), size * (0.45 + r() * 0.45), seed + i, 0.2, 7)
  return d
}

/** One carved stone tray at w × h: shadow, front face, the rim (brushed edge, lit lip), the hollow and what lies in it. */
export function trayArt(svg: SVGSVGElement, kind: string, w: number, h: number, seed: number) {
  const r = rng(seed)
  const t = clamp(Math.min(w, h) * 0.085, 7, 12) // rim width
  const face = t * 0.75 // the front face below the rim
  const rad = clamp(Math.min(w, h) * 0.16, 10, 22)
  const outer = slab(2, 2, w - 4, h - 4 - face, rad, seed)
  const ix = t + 2, iy = t + 1, iw = w - 2 * t - 4, ih = h - 2 * t - face - 2
  const inner = slab(ix, iy, iw, ih, rad * 0.62, seed + 1)
  const cid = `t38v-${seed.toString(36)}-${Math.round(w)}x${Math.round(h)}`
  const top = outer.filter(([, y]) => y < h * 0.4)
  const area = iw * ih
  const contents: SVGElement[] = []
  if (kind === 'good') {
    // dry white gravel, raked into a few lines
    let rake = '', rakeHi = ''
    for (let k = 1; k <= 3; k++) {
      const y = iy + (ih * k) / 4 + (r() - 0.5) * 3
      const pts = Array.from({ length: 12 }, (_, i) => [ix + (iw * i) / 11, y + Math.sin(i * 0.9 + k) * 1.4] as Pt)
      rake += stroke(pts, 1.6, 0.08, 0.08, 0.3)
      rakeHi += stroke(pts.map(([x, yy]) => [x, yy + 1.6] as Pt), 1.2, 0.08, 0.08, 0.3)
    }
    contents.push(
      s('rect', { class: 't38v-dry', x: ix, y: iy, width: f1(iw), height: f1(ih) }),
      s('path', { class: 't38v-pebble-dk', d: gravel(ix, iy, iw, ih, Math.min(160, area / 140), 1.6, seed + 3) }),
      s('path', { class: 't38v-pebble-hi', d: gravel(ix, iy, iw, ih, Math.min(220, area / 90), 1.5, seed + 4) }),
      s('path', { class: 't38v-rake', d: rake }),
      s('path', { class: 't38v-rake-hi', d: rakeHi }))
  } else if (kind === 'learning') {
    // half-soaked: wet gravel above, water rising over the lower half, the moon caught in it
    const wl = iy + ih * 0.46
    const edge = Array.from({ length: 16 }, (_, i) => [ix + (iw * i) / 15, wl + Math.sin(i * 1.3 + 1) * 1.2] as Pt)
    let rip = ''
    for (let k = 0; k < 5; k++) {
      const y = wl + 5 + k * ((iy + ih - wl - 6) / 5), x0 = ix + r() * iw * 0.5, len = iw * (0.15 + r() * 0.3)
      rip += stroke([[x0, y], [x0 + len, y + (r() - 0.5)]], 0.9, 0.3, 0.3, 0.1)
    }
    const gx = ix + iw * 0.68, gy = wl + (iy + ih - wl) * 0.42
    contents.push(
      s('rect', { class: 't38v-wet', x: ix, y: iy, width: f1(iw), height: f1(ih) }),
      s('path', { class: 't38v-pebble-dk', d: gravel(ix, iy, iw, wl - iy, Math.min(110, (iw * (wl - iy)) / 110), 1.6, seed + 3) }),
      s('path', { class: 't38v-pebble-hi t38v-wet-hi', d: gravel(ix, iy, iw, wl - iy, Math.min(80, (iw * (wl - iy)) / 160), 1.4, seed + 4) }),
      s('path', { class: 't38v-pool', d: `${polyD(edge)}L${f1(ix + iw)} ${f1(iy + ih + 2)}L${f1(ix)} ${f1(iy + ih + 2)}Z`, filter: 'url(#ink-wash)' }),
      s('path', { class: 't38v-shore', d: stroke(edge, 1.2, 0.05, 0.05, 0.4) }),
      s('path', { class: 't38v-ripple', d: rip }),
      s('ellipse', { class: 't38v-glint', cx: f1(gx), cy: f1(gy), rx: f1(clamp(iw * 0.06, 5, 12)), ry: f1(clamp(iw * 0.018, 1.6, 3.4)) }),
      s('path', { class: 't38v-ripple t38v-glint-road', d: [1, 2, 3].map((k) => stroke([[gx - 6 - k * 2, gy + k * 3.4], [gx + 6 + k * 2, gy + k * 3.4]], 0.9, 0.3, 0.3, 0.1)).join('') }))
  } else {
    // still far off: the gravel lies under thick mist
    let wisp = ''
    for (let k = 0; k < 4; k++) {
      const y = iy + ih * (0.2 + k * 0.2), x0 = ix + r() * iw * 0.3
      wisp += stroke([[x0, y], [x0 + iw * 0.35, y - 2], [x0 + iw * (0.55 + r() * 0.2), y]], 1.6, 0.4, 0.4, 0.1)
    }
    contents.push(
      s('rect', { class: 't38v-dim', x: ix, y: iy, width: f1(iw), height: f1(ih) }),
      s('path', { class: 't38v-pebble-dk', d: gravel(ix, iy, iw, ih, Math.min(120, area / 160), 1.6, seed + 3) }),
      ...[0, 1, 2, 3].map((k) => fog(ix + iw * (0.2 + k * 0.22), iy + ih * (0.3 + (k % 2) * 0.35), iw * 0.42, ih * 0.42, 'g13-fog t38v-fog')),
      s('path', { class: 't38v-wisp', d: wisp, filter: 'url(#ink-wash)' }))
  }
  svg.setAttribute('viewBox', `0 0 ${f1(w)} ${f1(h)}`)
  svg.replaceChildren(
    s('clipPath', { id: cid }, s('path', { d: closed(inner) })),
    s('path', { class: 't38v-shadow', d: closed(slab(6, h * 0.3, w - 8, h * 0.7 - 1, rad, seed + 2)), filter: 'url(#ink-wash)' }),
    s('path', { class: 't38v-face', d: closed(slab(2, h - face - rad - 4, w - 4, face + rad + 2, rad, seed + 5)), filter: 'url(#ink-rough)' }),
    s('path', { class: 't38v-rim', d: closed(outer), filter: 'url(#ink-rough)' }),
    s('path', { class: 't38v-rim-sh', d: closed(outer) }),
    s('g', { 'clip-path': `url(#${cid})` }, ...contents,
      // the hollow's own shade under the far lip
      s('path', { class: 't38v-hollow', d: stroke(inner.filter(([, y]) => y < iy + rad * 0.7), t * 1.1, 0.1, 0.1, 0.5), filter: 'url(#ink-wash)' })),
    s('path', { class: 'g13-ink t38v-edge', d: stroke(inner.filter(([, y]) => y < iy + ih * 0.5), 1.4, 0.1, 0.1, 0.4) + stroke(outer.slice(Math.floor(outer.length * 0.45), Math.floor(outer.length * 0.8)), 2, 0.1, 0.15, 0.3), filter: 'url(#ink-rough)' }),
    s('path', { class: 't38v-lip', d: stroke(top.slice(1, Math.max(2, Math.floor(top.length * 0.7))), Math.max(1.2, t * 0.18), 0.2, 0.3, 0.1) }))
}

/** The rattan basket at w × h: a tall handle, the opening the pebbles lie in, a woven front wall and a wrapped rim. */
export function basketArt(svg: SVGSVGElement, w: number, h: number, pad: { top: number; bottom: number }) {
  const rimB = h - pad.bottom + 4 // the front rim, just under the last row of pebbles
  const rimT = pad.top - 6 // the back rim
  const side = 8
  const mouth = slab(side, rimT, w - side * 2, rimB - rimT, clamp((rimB - rimT) * 0.45, 18, 70), 3871)
  const wall = `M${side} ${f1(rimB - 6)}Q${f1(side + 2)} ${f1(h - 4)} ${f1(w * 0.18)} ${f1(h - 3)}L${f1(w * 0.82)} ${f1(h - 3)}Q${f1(w - side - 2)} ${f1(h - 4)} ${f1(w - side)} ${f1(rimB - 6)}Z`
  let beads = '', stakes = ''
  for (let k = 0; k < 3; k++) {
    const y = rimB + 3 + k * ((h - rimB - 6) / 3)
    for (let x = side + 6 + (k % 2) * 6; x < w - side - 4; x += 12) beads += blob(x, y, 5.4, 2.4, 3872 + k * 97 + Math.round(x), 0.12, 10)
  }
  let back = ''
  for (let x = side + 12; x < w - side - 6; x += 12) {
    stakes += stroke([[x, rimB], [x + (x - w / 2) * -0.03, h - 4]], 1, 0.1, 0.1, 0.5)
    back += stroke([[x, rimT + 2], [x, rimT + (rimB - rimT) * 0.4]], 0.8, 0.1, 0.6, 0.2)
  }
  const rimPts = (y: number): Pt[] => curve([side, y], [w / 2, y + 3], [w - side, y], 30)
  let wrap = ''
  for (const p of rimPts(rimB).filter((_, i) => i % 2 === 0)) wrap += stroke([[p[0] - 2.5, p[1] - 3], [p[0] + 2.5, p[1] + 3]], 1, 0.2, 0.2, 0.3)
  const handle = curve([w * 0.07, rimT + (rimB - rimT) * 0.55], [w * 0.5, -(rimB - rimT) * 0.45], [w * 0.93, rimT + (rimB - rimT) * 0.55], 30)
  let hwrap = ''
  for (let i = 3; i < handle.length - 3; i += 2) hwrap += stroke([[handle[i][0] - 2, handle[i][1] - 2.4], [handle[i][0] + 2, handle[i][1] + 2.4]], 0.9, 0.2, 0.2, 0.3)
  svg.setAttribute('viewBox', `0 0 ${f1(w)} ${f1(h)}`)
  svg.replaceChildren(
    s('ellipse', { class: 't38v-shadow', cx: f1(w / 2), cy: f1(h - 3), rx: f1(w * 0.44), ry: 5, filter: 'url(#ink-wash)' }),
    s('path', { class: 't38v-cane', d: stroke(handle, 7, 0.02, 0.02, 0.8), filter: 'url(#ink-rough)' }),
    s('path', { class: 't38v-cane-ink', d: hwrap }),
    s('path', { class: 't38v-inside', d: closed(mouth), filter: 'url(#ink-wash)' }),
    s('path', { class: 't38v-weave-in', d: back }),
    s('path', { class: 't38v-cane', d: stroke(rimPts(rimT), 6, 0.02, 0.02, 0.8), filter: 'url(#ink-rough)' }),
    s('path', { class: 't38v-wall', d: wall, filter: 'url(#ink-rough)' }),
    s('path', { class: 't38v-stake', d: stakes }),
    s('path', { class: 't38v-bead', d: beads }),
    s('path', { class: 't38v-wall-sh', d: wall }),
    s('path', { class: 't38v-cane', d: stroke(rimPts(rimB), 8, 0.02, 0.02, 0.8), filter: 'url(#ink-rough)' }),
    s('path', { class: 't38v-cane-ink', d: wrap }),
    s('path', { class: 'g13-hi', d: stroke(rimPts(rimB - 2).slice(3, 14), 1.4, 0.3, 0.3, 0.1) }))
}

/** Redraw some painted backings at their elements' sizes: one observer, all sizes read before any drawing. */
export function paintOnSize(ctx: SceneCtx, items: { el: HTMLElement; draw: (w: number, h: number) => void }[]) {
  let raf = 0
  const last = new Map<HTMLElement, string>()
  const run = () => {
    const sizes = items.map(({ el }) => [el.clientWidth, el.clientHeight])
    items.forEach((it, i) => {
      const [w, h] = sizes[i]
      const key = `${w}x${h}`
      if (!w || !h || last.get(it.el) === key) return
      last.set(it.el, key)
      it.draw(w, h)
    })
  }
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(run)
  })
  items.forEach(({ el }) => ro.observe(el))
  ctx.onCleanup(() => (ro.disconnect(), cancelAnimationFrame(raf)))
}
