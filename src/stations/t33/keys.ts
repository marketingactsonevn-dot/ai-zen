import raw from '../../content/tram-33.json'
import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import { blob, clamp, curve, onSize, rng, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist, toro } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import './keys.css'
import { cardSheet, f1, live, P, parallax, t33Defs } from './kit'

const K = raw.scenes.keys
const N = K.keys.length
const rect = (x: number, y: number, w: number, hh: number) => `M${f1(x)} ${f1(y)}h${f1(w)}v${f1(hh)}h${f1(-w)}Z`
const quad = (a: Pt, b: Pt, c: Pt, d: Pt) => `M${P(a)}L${P(b)}L${P(c)}L${P(d)}Z`

/** A bronze key hanging bow-up (viewBox -20 0 40 120): five different bows and bits, a moonlit edge that slides as it swings. */
function keyArt(i: number) {
  const bows = [
    'M0 2A15 15 0 1 1 -0.01 2ZM0 10A7 7 0 1 0 0.01 10Z',
    'M0 1C10 1 16 8 12 15C18 18 16 30 6 30H-6C-16 30 -18 18 -12 15C-16 8 -10 1 0 1ZM0 9A6 6 0 1 0 0.01 9Z',
    'M-14 2H14V30H-14ZM-6 9H6V22H-6Z',
    'M0 4C6 -4 18 2 12 14L0 30L-12 14C-18 2 -6 -4 0 4ZM0 11A5 5 0 1 0 0.01 11Z',
    'M0 1C11 1 16 9 16 16C16 24 10 31 0 31C-10 31 -16 24 -16 16C-16 9 -11 1 0 1ZM-3 8H3V24H-3Z',
  ]
  const bits = [
    'M3 92h12v6h-6v6h8v8h-14Z', 'M3 90h9v4h5v8h-5v4h7v8h-16Z', 'M3 94h14v20h-5v-6h-4v6h-5Z', 'M3 88h8v8h6v6h-6v12h-8Z', 'M3 92h15v4h-8v4h8v4h-8v4h8v6h-15Z',
  ]
  return s('svg', { class: 't33y-keyart', viewBox: '-20 0 40 120', 'aria-hidden': 'true' },
    s('path', { class: 't33y-keysh', d: bows[i] + `M-3.4 30h6.8v86h-6.8Z` + bits[i], transform: 'translate(2.5 3)' }),
    s('path', { class: 't33y-bronze', d: bows[i] + `M-3.4 29h6.8v87h-6.8Z` + bits[i], 'fill-rule': 'evenodd' }),
    s('path', { class: 't33y-keyink', d: stroke([[3.4, 31], [3.4, 115]], 1.4, 0.05, 0.05, 0.6) + stroke(curve([12, 6], [16, 16], [8, 28], 6), 1.6, 0.1, 0.1, 0.4) }),
    s('g', { class: 't33y-glint' }, s('path', { class: 't33y-glintp', d: stroke([[-2.2, 36], [-2.2, 70]], 1.5, 0.3, 0.3, 0.1) + stroke(curve([-12, 8], [-9, 2], [-2, 2], 6), 1.6, 0.3, 0.3, 0.1) })))
}

/** The house behind the lantern, seen out of focus (px W × H): five doors along a long eave, their paper faintly lit. */
function houseArt(W: number, doors: { x: number; w: number }[], y0: number, y1: number, seed: number) {
  const r = rng(seed)
  const L = doors[0].x - doors[0].w * 0.8, R = doors[doors.length - 1].x + doors[doors.length - 1].w * 0.8
  let lat = '', thatch = ''
  for (const d of doors) {
    for (let k = 1; k < 3; k++) lat += stroke([[d.x - d.w / 2 + (d.w * k) / 3, y0 + (y1 - y0) * 0.08], [d.x - d.w / 2 + (d.w * k) / 3, y1]], 1.2, 0.02, 0.02, 0.6)
    for (let k = 1; k < 5; k++) lat += stroke([[d.x - d.w / 2, y0 + ((y1 - y0) * k) / 5], [d.x + d.w / 2, y0 + ((y1 - y0) * k) / 5]], 1, 0.02, 0.02, 0.6)
  }
  const ey = y0 - (y1 - y0) * 0.16
  for (let i = 0; i < 60; i++) {
    const x = L - 30 + r() * (R - L + 60)
    thatch += stroke([[x, ey - 2], [x - 6, ey - (y1 - y0) * (0.2 + r() * 0.35)]], 1 + r(), 0.1, 0.4, 0.1)
  }
  return [
    mist(W * 0.62, y1, W * 0.6, (y1 - y0) * 0.5),
    s('path', { class: 't33y-hroof', d: `M${f1(L - 40)} ${f1(ey)}L${f1(R + 40)} ${f1(ey)}L${f1(R - 30)} ${f1(ey - (y1 - y0) * 0.65)}L${f1(L + 30)} ${f1(ey - (y1 - y0) * 0.65)}Z`, filter: 'url(#ink-wash)' }),
    s('path', { class: 't33y-hthatch', d: thatch }),
    s('path', { class: 't33y-heave', d: rect(L - 40, ey - 4, R - L + 80, (y1 - y0) * 0.16 + 6) }),
    s('path', { class: 't33y-hwall', d: rect(L, y0 - 2, R - L, y1 - y0 + 4) }),
    ...doors.map((d) => s('path', { class: 't33y-hpaper', d: rect(d.x - d.w / 2, y0 + (y1 - y0) * 0.06, d.w, (y1 - y0) * 0.94) })),
    s('path', { class: 't33y-hlat', d: lat }),
    s('path', { class: 't33y-hpost', d: doors.map((d) => rect(d.x - d.w / 2 - 5, y0, 5, y1 - y0) + rect(d.x + d.w / 2, y0, 5, y1 - y0)).join('') }),
    s('path', { class: 't33y-hsill', d: rect(L - 10, y1, R - L + 20, (y1 - y0) * 0.06) }),
  ]
}

/**
 * One door, in focus (it opens when its key is given): the room behind it painted as a small lit box — back wall in lamp
 * light, darker side walls and ceiling, tatami running to the sill — and what the room holds, soft-edged in that light.
 */
function doorArt(i: number, d: { x: number; w: number }, y0: number, y1: number, seed: number) {
  const r = rng(seed)
  const x0 = d.x - d.w / 2, x1 = d.x + d.w / 2, hh = y1 - y0
  // the room box: the back wall sits in, the floor runs out to the sill
  const bx0 = x0 + d.w * 0.18, bx1 = x1 - d.w * 0.18, by0 = y0 + hh * 0.14, by1 = y0 + hh * 0.66
  const bw = bx1 - bx0, bh = by1 - by0, cx = d.x
  const room = [
    s('path', { class: 't33y-rback', d: rect(bx0, by0, bw, bh) }),
    s('path', { class: 't33y-rside', d: quad([x0, y0], [bx0, by0], [bx0, by1], [x0, y1]) + quad([x1, y0], [bx1, by0], [bx1, by1], [x1, y1]) }),
    s('path', { class: 't33y-rceil', d: quad([x0, y0], [x1, y0], [bx1, by0], [bx0, by0]) }),
    s('path', { class: 't33y-rfloor', d: quad([bx0, by1], [bx1, by1], [x1, y1], [x0, y1]) }),
  ]
  // tatami seams running toward the back wall, one cross seam
  let mats = ''
  for (const f of [0.33, 0.67]) mats += stroke([[bx0 + bw * f, by1], [x0 + d.w * f, y1]], 0.9, 0.05, 0.05, 0.5)
  const my = by1 + (y1 - by1) * 0.45, mx0 = bx0 + (x0 - bx0) * 0.45, mx1 = bx1 + (x1 - bx1) * 0.45
  mats += stroke([[mx0, my], [mx1, my]], 0.9, 0.05, 0.05, 0.5)
  room.push(s('path', { class: 't33y-rmat', d: mats }))
  const fy = by1 + (y1 - by1) * 0.55 // where things stand on the floor
  const u = bw / 10
  const things: SVGElement[] = []
  if (i === 0) {
    // the library: three shelves of bound books and scrolls along the back wall
    let books = '', light = '', boards = ''
    for (let row = 0; row < 3; row++) {
      const sy = by0 + bh * (0.3 + row * 0.32)
      boards += rect(bx0 + u * 0.3, sy, bw - u * 0.6, Math.max(1.6, bh * 0.035))
      for (let x = bx0 + u * 0.6; x < bx1 - u * 1.2; ) {
        const w = u * (0.55 + r() * 0.5), hb = bh * (0.16 + r() * 0.09)
        const path = rect(x, sy - hb, w, hb)
        if (r() < 0.55) books += path
        else light += path
        x += w + u * 0.12
      }
    }
    things.push(s('path', { class: 't33y-books', d: books }), s('path', { class: 't33y-books2', d: light }), s('path', { class: 't33y-shelf', d: boards }),
      s('path', { class: 't33y-scroll', d: stroke([[cx - u * 3, fy], [cx + u * 2, fy - hh * 0.02]], Math.max(3, hh * 0.035), 0.1, 0.1, 0.8) }))
  } else if (i === 1) {
    // the writing desk: low table, paper, the inkstone and brush, a cushion before it
    const tw = u * 6.4, ty = fy - hh * 0.08
    things.push(
      s('path', { class: 't33y-cushion', d: blob(cx, fy + hh * 0.07, u * 2.4, hh * 0.035, seed + 1, 0.15, 12) }),
      s('path', { class: 't33y-desk', d: quad([cx - tw / 2, ty], [cx + tw / 2, ty], [cx + tw / 2 + u * 0.5, ty + hh * 0.035], [cx - tw / 2 - u * 0.5, ty + hh * 0.035]) + rect(cx - tw / 2, ty + hh * 0.035, u * 0.5, hh * 0.09) + rect(cx + tw / 2 - u * 0.5, ty + hh * 0.035, u * 0.5, hh * 0.09) }),
      s('path', { class: 't33y-sheet', d: quad([cx - u * 2.2, ty - 0.5], [cx + u * 0.6, ty - 0.5], [cx + u * 0.9, ty + hh * 0.025], [cx - u * 2.4, ty + hh * 0.025]) }),
      s('path', { class: 't33y-inkst', d: rect(cx + u * 1.3, ty - hh * 0.012, u * 1.4, hh * 0.022) + stroke([[cx + u * 1.1, ty - hh * 0.03], [cx + u * 2.9, ty - hh * 0.06]], 1.4, 0.1, 0.4, 0.3) }),
      s('path', { class: 't33y-scroll', d: stroke([[bx0 + bw * 0.3, by0 + bh * 0.08], [bx0 + bw * 0.3, by0 + bh * 0.62]], Math.max(4, u * 1.2), 0.05, 0.05, 0.9) }))
  } else if (i === 2) {
    // the hearth: a sunken square of ash with embers, the kettle on its hook from the beam
    const hw = u * 4, hy = fy - hh * 0.02
    things.push(
      s('path', { class: 't33y-hearthf', d: quad([cx - hw / 2, hy - hh * 0.04], [cx + hw / 2, hy - hh * 0.04], [cx + hw / 2 + u * 0.8, hy + hh * 0.05], [cx - hw / 2 - u * 0.8, hy + hh * 0.05]) }),
      s('path', { class: 't33y-ember', d: blob(cx, hy + hh * 0.005, u * 1.4, hh * 0.022, seed + 2, 0.3, 10) }),
      s('path', { class: 't33y-hook', d: stroke([[cx, by0 - hh * 0.1], [cx, hy - hh * 0.2]], Math.max(2, u * 0.35), 0.02, 0.02, 0.8) }),
      s('path', { class: 't33y-kettle', d: `M${f1(cx - u * 1.5)} ${f1(hy - hh * 0.12)}Q${f1(cx - u * 1.8)} ${f1(hy - hh * 0.03)} ${f1(cx)} ${f1(hy - hh * 0.028)}Q${f1(cx + u * 1.8)} ${f1(hy - hh * 0.03)} ${f1(cx + u * 1.5)} ${f1(hy - hh * 0.12)}Q${f1(cx)} ${f1(hy - hh * 0.2)} ${f1(cx - u * 1.5)} ${f1(hy - hh * 0.12)}Z`, filter: 'url(#ink-rough)' }),
      s('path', { class: 't33y-steam', d: stroke(curve([cx + u * 0.4, hy - hh * 0.2], [cx - u * 0.8, hy - hh * 0.3], [cx + u * 0.3, hy - hh * 0.42], 10), Math.max(1.6, u * 0.4), 0.2, 0.6, 0.1) }))
  } else if (i === 3) {
    // the mail gate: the back wall opens onto the night garden; a letter box on its post by the path
    const ox0 = bx0 + bw * 0.12, ox1 = bx1 - bw * 0.12
    things.push(
      s('path', { class: 't33y-outside', d: rect(ox0, by0 + bh * 0.06, ox1 - ox0, bh * 0.94) }),
      s('path', { class: 't33y-outhill', d: `M${f1(ox0)} ${f1(by0 + bh * 0.7)}Q${f1(ox0 + (ox1 - ox0) * 0.35)} ${f1(by0 + bh * 0.5)} ${f1(ox1)} ${f1(by0 + bh * 0.66)}V${f1(by1)}H${f1(ox0)}Z` }),
      s('path', { class: 't33y-post', d: rect(cx + u * 1.2, fy - hh * 0.3, u * 0.5, hh * 0.3) }),
      s('path', { class: 't33y-box', d: rect(cx + u * 0.3, fy - hh * 0.34, u * 2.3, hh * 0.09) }),
      s('path', { class: 't33y-sheet', d: rect(cx + u * 0.9, fy - hh * 0.37, u * 1.1, hh * 0.035) }),
      s('path', { class: 't33y-stones', d: blob(cx - u * 1.2, fy + hh * 0.05, u * 1.3, hh * 0.022, seed + 3, 0.15, 10) + blob(cx - u * 0.4, fy - hh * 0.03, u * 0.9, hh * 0.016, seed + 4, 0.15, 10) }))
  } else {
    // the money chest: a tansu with iron bands and a lock plate, a few coins
    const tw = u * 5.6, th = hh * 0.2, ty = fy - th
    things.push(
      s('path', { class: 't33y-chest', d: rect(cx - tw / 2, ty, tw, th) }),
      s('path', { class: 't33y-chesttop', d: quad([cx - tw / 2, ty], [cx + tw / 2, ty], [cx + tw / 2 - u * 0.5, ty - hh * 0.04], [cx - tw / 2 + u * 0.5, ty - hh * 0.04]) }),
      s('path', { class: 't33y-iron', d: rect(cx - tw / 2, ty + th * 0.3, tw, th * 0.07) + rect(cx - tw / 2, ty + th * 0.72, tw, th * 0.07) + rect(cx - u * 0.6, ty + th * 0.36, u * 1.2, th * 0.3) }),
      s('path', { class: 't33y-coin', d: blob(cx + tw / 2 + u * 0.6, fy + hh * 0.02, u * 0.5, hh * 0.012, seed + 5, 0.05, 8) + blob(cx + tw / 2 + u * 1.4, fy + hh * 0.035, u * 0.45, hh * 0.011, seed + 6, 0.05, 8) }))
  }
  // the lamp light: warm at the back, falling off toward the corners
  const lightG = s('path', { class: 't33y-rlight', d: rect(x0, y0, d.w, hh) })
  return [
    ...room,
    ...things,
    lightG,
    s('path', { class: 't33y-dpaper', d: rect(x0 - d.w * 0.62, y0, d.w * 0.66, hh) }),
    s('path', { class: 't33y-dlat', d: [1, 2].map((k) => stroke([[x0 - d.w * 0.62 + (d.w * 0.66 * k) / 3, y0], [x0 - d.w * 0.62 + (d.w * 0.66 * k) / 3, y1]], 1, 0.02, 0.02, 0.6)).join('') + [1, 2, 3, 4].map((k) => stroke([[x0 - d.w * 0.62, y0 + (hh * k) / 5], [x0 + d.w * 0.04, y0 + (hh * k) / 5]], 1, 0.02, 0.02, 0.6)).join('') }),
    s('path', { class: 't33y-dframe', d: rect(x0 - 4, y0 - 3, d.w + 8, 4) + rect(x0 - 4, y0, 4, hh) + rect(x1, y0, 4, hh), filter: 'url(#ink-rough)' }),
    s('path', { class: 't33y-spill', d: `M${f1(x0)} ${f1(y1)}L${f1(x1)} ${f1(y1)}L${f1(x0 + d.w * 1.5)} ${f1(y1 + hh * 0.35)}L${f1(x0 - d.w * 0.5)} ${f1(y1 + hh * 0.35)}Z` }),
  ]
}

/** Two paper seals (ofuda) pasted in an X across a door, a vermilion stamp where they cross, brushed words down each strip. */
function ofuda(d: { x: number; w: number }, y0: number, y1: number, seed: number) {
  const r = rng(seed)
  const hh = y1 - y0, sw = Math.max(8, d.w * 0.12)
  const cx = d.x, cy = y0 + hh * 0.5
  const strip = (ang: number) => {
    const L = Math.hypot(d.w, hh) * 0.5, c = Math.cos(ang), sn = Math.sin(ang)
    const ax = c * L, ay = sn * L, nx = -sn * sw / 2, ny = c * sw / 2
    // a torn end: three short jags
    const tear = (px: number, py: number, k: number) => `L${f1(px + nx * k + c * (r() * 2))} ${f1(py + ny * k + sn * (r() * 2))}`
    const paper = `M${f1(cx - ax + nx)} ${f1(cy - ay + ny)}L${f1(cx + ax + nx)} ${f1(cy + ay + ny)}${tear(cx + ax, cy + ay, 0.3)}${tear(cx + ax, cy + ay, -0.4)}L${f1(cx + ax - nx)} ${f1(cy + ay - ny)}L${f1(cx - ax - nx)} ${f1(cy - ay - ny)}${tear(cx - ax, cy - ay, -0.3)}${tear(cx - ax, cy - ay, 0.4)}Z`
    let words = ''
    for (let k = 0; k < 7; k++) {
      const f = -0.8 + (k / 6) * 1.6
      if (Math.abs(f) < 0.22) continue
      const px = cx + ax * f, py = cy + ay * f
      words += stroke([[px - c * sw * 0.18 - nx * 0.4, py - sn * sw * 0.18 - ny * 0.4], [px + c * sw * 0.18 + nx * 0.3, py + sn * sw * 0.18 + ny * 0.3]], Math.max(1, sw * 0.12), 0.2, 0.3, 0.3)
    }
    return { paper, words }
  }
  const a = strip(Math.atan2(hh, d.w)), b = strip(-Math.atan2(hh, d.w))
  const ss = sw * 1.25
  return [
    s('path', { class: 't33y-ofsh', d: a.paper + b.paper, transform: 'translate(2 3)', filter: 'url(#ink-wash)' }),
    s('path', { class: 't33y-ofudap', d: a.paper }),
    s('path', { class: 't33y-ofudap', d: b.paper }),
    s('path', { class: 't33y-ofink', d: a.words + b.words }),
    s('path', { class: 't33y-stamp', d: rect(cx - ss / 2, cy - ss / 2, ss, ss), transform: `rotate(${f1((r() - 0.5) * 16)} ${f1(cx)} ${f1(cy)})`, filter: 'url(#ink-rough)' }),
    s('path', { class: 't33y-stampin', d: stroke([[cx - ss * 0.25, cy - ss * 0.22], [cx + ss * 0.22, cy - ss * 0.22]], Math.max(1, ss * 0.09), 0.1, 0.1, 0.5) + stroke([[cx, cy - ss * 0.3], [cx, cy + ss * 0.3]], Math.max(1, ss * 0.1), 0.1, 0.2, 0.5) + stroke([[cx - ss * 0.24, cy + ss * 0.12], [cx + ss * 0.2, cy + ss * 0.2]], Math.max(1, ss * 0.08), 0.1, 0.2, 0.5) }),
  ]
}

/**
 * The open hand of the gardener coming in from the lower right, palm up (viewBox 0 0 400 300): a cupped palm with its pads and
 * lines, four fingers with their joints, the thumb on the far side, the knuckles' shadow, the cuff, and its shadow below.
 */
function handArt() {
  const finger = (R: Pt, T: Pt, w0: number, w1: number, bow: number) => {
    const dx = T[0] - R[0], dy = T[1] - R[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy, ny = ux
    const M: Pt = [(R[0] + T[0]) / 2 + nx * bow, (R[1] + T[1]) / 2 + ny * bow]
    const p = (x: number, y: number) => `${f1(x)} ${f1(y)}`
    const d = `M${p(R[0] + nx * w0 / 2, R[1] + ny * w0 / 2)}Q${p(M[0] + nx * (w0 + w1) / 4, M[1] + ny * (w0 + w1) / 4)} ${p(T[0] + nx * w1 / 2, T[1] + ny * w1 / 2)}A${f1(w1 / 2)} ${f1(w1 / 2)} 0 0 0 ${p(T[0] - nx * w1 / 2, T[1] - ny * w1 / 2)}Q${p(M[0] - nx * (w0 + w1) / 4, M[1] - ny * (w0 + w1) / 4)} ${p(R[0] - nx * w0 / 2, R[1] - ny * w0 / 2)}Z`
    const at = (f: number): Pt => [R[0] + dx * f + nx * bow * 4 * f * (1 - f), R[1] + dy * f + ny * bow * 4 * f * (1 - f)]
    const wAt = (f: number) => w0 + (w1 - w0) * f
    const crease = (f: number) => {
      const [x, y] = at(f), w = wAt(f) * 0.36
      return stroke(curve([x + nx * w, y + ny * w], [x - ux * 2.5, y - uy * 2.5], [x - nx * w, y - ny * w], 6), 1.3, 0.3, 0.3, 0.2)
    }
    // shaded side (toward the viewer, below) and lit edge (far side, the lantern above)
    const shade = stroke(Array.from({ length: 9 }, (_, k) => { const f = 0.05 + k * 0.11, [x, y] = at(f), w = wAt(f) / 2 - 1.2; return [x - nx * w, y - ny * w] as Pt }), 3.2, 0.1, 0.3, 0.2)
    const lit = stroke(Array.from({ length: 9 }, (_, k) => { const f = 0.08 + k * 0.1, [x, y] = at(f), w = wAt(f) / 2 - 1.4; return [x + nx * w, y + ny * w] as Pt }), 1.8, 0.2, 0.3, 0.1)
    const pad = blob(...at(0.9), wAt(0.9) * 0.3, wAt(0.9) * 0.24, Math.round(T[0] + T[1]), 0.1, 10)
    return { d, creases: crease(0.42) + crease(0.72), shade, lit, pad }
  }
  const fingers = [
    finger([158, 141], [66, 134], 30, 24, -5),
    finger([155, 165], [50, 162], 31, 25, -3),
    finger([158, 188], [60, 192], 29, 23, 2),
    finger([166, 208], [96, 216], 24, 19, 4),
  ]
  const thumb = finger([248, 148], [168, 108], 35, 26, 8)
  const palm = 'M150 126C190 116 236 120 266 138C288 150 304 158 318 166L326 222C296 236 252 242 214 234C190 229 172 222 160 214C146 192 142 152 150 126Z'
  return s('svg', { class: 't33y-hand', viewBox: '0 0 400 300', 'aria-hidden': 'true' },
    // the hand's shadow on the ground far below: soft, offset down-left
    s('path', { class: 't33y-handsh', d: blob(190, 268, 150, 22, 3371, 0.15, 20), filter: 'url(#ink-wash)' }),
    s('path', { class: 't33y-skin t33y-thumb', d: thumb.d }),
    s('path', { class: 't33y-shade', d: thumb.shade }),
    s('path', { class: 't33y-lit', d: thumb.lit }),
    s('path', { class: 't33y-crease', d: thumb.creases }),
    s('path', { class: 't33y-skin', d: palm }),
    // the cupped hollow, the thenar pad lit, the knuckle mounts under the fingers
    s('path', { class: 't33y-hollow', d: blob(214, 184, 38, 24, 3372, 0.15, 16), filter: 'url(#ink-wash)' }),
    s('path', { class: 't33y-pad', d: blob(250, 160, 30, 18, 3373, 0.15, 14) + blob(178, 136, 22, 9, 3374, 0.15, 10) + blob(174, 162, 20, 9, 3375, 0.15, 10) + blob(178, 186, 18, 8, 3376, 0.15, 10), filter: 'url(#ink-wash)' }),
    s('path', { class: 't33y-crease', d: stroke(curve([168, 150], [214, 140], [262, 154], 10), 1.6, 0.2, 0.3, 0.2) + stroke(curve([172, 176], [214, 168], [256, 184], 10), 1.5, 0.2, 0.3, 0.2) + stroke(curve([262, 146], [236, 186], [262, 226], 12), 1.6, 0.2, 0.3, 0.2) }),
    ...fingers.flatMap((f, i) => [
      s('path', { class: `t33y-skin t33y-f${i}`, d: f.d }),
      s('path', { class: 't33y-pad', d: f.pad }),
      s('path', { class: 't33y-shade', d: f.shade }),
      s('path', { class: 't33y-lit', d: f.lit }),
      s('path', { class: 't33y-crease', d: f.creases }),
    ]),
    // the outline: thicker and darker on the side away from the lantern
    s('path', { class: 't33y-handink', d: stroke(curve([160, 214], [196, 232], [252, 238], 12), 2.6, 0.1, 0.2, 0.3) + stroke(curve([252, 238], [296, 236], [326, 222], 10), 2.4, 0.1, 0.2, 0.3) + stroke(curve([92, 232], [130, 230], [164, 216], 8), 1.8, 0.2, 0.3, 0.3), filter: 'url(#ink-rough)' }),
    s('path', { class: 't33y-handrim', d: stroke(curve([170, 96], [214, 114], [262, 138], 12), 1.8, 0.2, 0.3, 0.1) + stroke(curve([60, 122], [104, 122], [150, 126], 10), 1.4, 0.2, 0.3, 0.1) }),
    // the cuff of the gardener's sleeve, the arm going out of frame
    s('path', { class: 't33y-sleeve', d: 'M314 150C340 140 372 136 400 138V300H330C326 270 324 244 326 222C320 196 316 172 314 150Z', filter: 'url(#ink-wash)' }),
    s('path', { class: 't33y-sleeveink', d: stroke(curve([314, 150], [312, 190], [328, 232], 10), 4, 0.05, 0.2, 0.4) + stroke(curve([328, 232], [324, 268], [334, 300], 8), 3.2, 0.05, 0.3, 0.4), filter: 'url(#ink-rough)' }),
    s('path', { class: 't33y-sleevefold', d: stroke(curve([346, 150], [340, 210], [356, 290], 10), 2, 0.2, 0.3, 0.2) + stroke(curve([374, 144], [366, 200], [382, 290], 10), 1.6, 0.2, 0.3, 0.2) }))
}

interface KeyState { x: number; y: number; a: number; tx: number; ty: number; ta: number; lag: number }

/** Scene 2 — a ring of bronze keys under a stone lantern: hand the gardener only the keys this one job needs. */
export function keysScene(ctx: SceneCtx) {
  t33Defs()
  const low = ctx.quality === 'low'
  const still = low || ctx.reduced
  const given = new Set<string>()
  let solved = false

  const back = s('svg', { class: 't33-night t33y-back', 'aria-hidden': 'true' })
  const house = s('svg', { class: 't33y-house', 'aria-hidden': 'true' })
  const doorsSvg = s('svg', { class: 't33y-doors', 'aria-hidden': 'true' })
  const roofSvg = s('svg', { class: 't33y-roof', 'aria-hidden': 'true' })
  const blurLayer = h('div', { class: 't33y-far' }, house, doorsSvg)
  const risks = K.keys.map((k) => h('p', { class: 't33y-risk t33-ink' }, k.risk))
  const riskBox = h('div', { class: 't33y-risks', 'aria-hidden': 'true' }, ...risks)
  blurLayer.append(riskBox)
  const say = live('t33y-say t33-ink')
  const hand = h('div', { class: 't33y-handbox' }, handArt())
  const check = h('button', { class: 't33y-plaque', type: 'button' }, h('span', null, K.check))
  const task = h('p', { class: 't33y-task t33-ink' }, K.task)
  const keyEls = K.keys.map((k, i) => {
    const tag = h('span', { class: 't33y-tag' }, h('span', { class: 't33y-string', 'aria-hidden': 'true' }), h('span', { class: 't33y-tagp' }, k.label))
    const b = h('button', { class: 't33y-key', type: 'button', 'aria-pressed': 'false' }, keyArt(i), tag)
    return { k, b, tag, glint: b.querySelector('.t33y-glint') as SVGGElement }
  })
  const ringEl = h('div', { class: 't33y-ring', 'aria-hidden': 'true' })
  const root = h('div', { class: `t33 t33y${low ? ' low' : ''}`, role: 'group', 'aria-label': K.aria },
    back, blurLayer, roofSvg, task, say, hand, ringEl, ...keyEls.map((x) => x.b), check,
    h('p', { class: 'visually-hidden' }, K.art))
  ctx.art.append(root)
  ctx.prompt(K.prompt)
  const px = parallax(ctx, root, [[blurLayer, 0.3], [roofSvg, 0.9]], 12)
  const sheet = cardSheet(root, K.takeaway, ctx.onCleanup)

  // ── geometry
  const G = { W: 0, H: 0, ring: [0, 0] as Pt, L: 0, spread: 0, palm: [] as [number, number, number][], mobile: false, doors: [] as { x: number; w: number }[], y0: 0, y1: 0, hand: { x: 0, y: 0, s: 1 } }
  const keys: KeyState[] = K.keys.map(() => ({ x: 0, y: 0, a: 0, tx: 0, ty: 0, ta: 0, lag: 0 }))
  let swing = 0, vel = 0
  let dragKey = -1
  const homeOf = (i: number): [number, number, number] => {
    const id = K.keys[i].id
    if (given.has(id)) {
      const order = K.keys.filter((k) => given.has(k.id)).findIndex((k) => k.id === id)
      return G.palm[order]
    }
    return [G.ring[0], G.ring[1], -G.spread + (2 * G.spread * i) / (N - 1)]
  }
  /**
   * The tags on the ring: sorted by where each bit hangs, each takes the first height (row) where it clears its neighbour,
   * and its string is lengthened by how much higher its bit swings, so a row is a level line. In the palm: all short.
   */
  const tagRows = () => {
    const kw = G.L * 0.27, tw = G.mobile ? 84 : 126
    const free = K.keys.map((k, i) => ({ i, on: given.has(k.id), a: ((-G.spread + (2 * G.spread * i) / (N - 1)) * Math.PI) / 180 }))
    const order = free.filter((f) => !f.on).map((f) => ({ ...f, x: -Math.sin(f.a) * 2.9 * kw })).sort((p, q) => p.x - q.x)
    const last: number[] = []
    const rowOf = new Map<number, number>()
    for (const f of order) {
      let row = 0
      while (last[row] !== undefined && f.x - last[row] < tw) row++
      last[row] = f.x
      rowOf.set(f.i, row)
    }
    const inHand = K.keys.filter((k) => given.has(k.id))
    keyEls.forEach(({ k, tag }, i) => {
      // in the palm the first key lies lowest: on a phone its tag hangs one row lower so the two tags clear each other
      const row = rowOf.get(i) ?? (inHand.length > 1 && inHand[0].id === k.id ? 1 : 0)
      tag.style.setProperty('--row', String(row))
      tag.style.setProperty('--lift', rowOf.has(i) ? `${f1(2.9 * kw * (1 - Math.cos(free[i].a)))}px` : '0px')
    })
  }

  let job: { cancel(): void } | null = null
  let first = true
  function layout() {
    const W = root.clientWidth, H = root.clientHeight
    if (!W || !H) return
    const mobile = W < 640
    G.W = W
    G.H = H
    G.mobile = mobile
    G.ring = mobile ? [W * 0.62, H * 0.11] : [W * 0.27, H * 0.18]
    G.L = mobile ? H * 0.18 : H * 0.4
    G.spread = mobile ? 36 : 26
    // the hand: palm up, coming in from the lower right, kept inside the frame (its sleeve melts into the night)
    const hs = mobile ? (W * 0.8) / 400 : Math.min((W * 0.38) / 400, (H * 0.56) / 300)
    G.hand = mobile ? { x: W - 400 * hs + W * 0.02, y: H - 300 * hs - 36, s: hs } : { x: W - 400 * hs - W * 0.005, y: H - 300 * hs, s: hs }
    hand.style.cssText = `left:${f1(G.hand.x)}px;top:${f1(G.hand.y)}px;width:${f1(400 * hs)}px;height:${f1(300 * hs)}px`
    // where given keys lie: bows on the fingers, shafts across the palm; the first two far enough apart that their tags hang clear
    const HP = (x: number, y: number): [number, number] => [G.hand.x + x * hs, G.hand.y + y * hs]
    G.palm = [[84, 206, -74], [102, 158, -70], [92, 184, -72], [110, 136, -68], [80, 226, -76]].map(([x, y, a]) => [...HP(x, y), a] as [number, number, number])
    // a phone stacks it: keys, then the house, then the verdict and the take-away slip just above the hand
    let y0 = H * 0.2, y1 = H * 0.4
    if (mobile) {
      const pillTop = G.hand.y + 92 * hs - 46
      sheet.pill.style.top = `${f1(pillTop)}px`
      say.style.top = `${f1(pillTop - 48)}px`
      y1 = pillTop - 56
      y0 = y1 - H * 0.11
    } else {
      sheet.pill.style.top = ''
      say.style.top = ''
    }
    const dl = mobile ? W * 0.03 : W * 0.42, dr = mobile ? W * 0.97 : W * 0.97
    const dw = mobile ? (dr - dl) / 5 - 8 : (dr - dl) / 5 - 26
    G.doors = K.keys.map((_, i) => ({ x: dl + ((dr - dl) * (i + 0.5)) / 5, w: dw }))
    G.y0 = y0
    G.y1 = y1
    root.style.setProperty('--kw', `${f1(G.L * 0.27)}px`)
    tagRows()
    root.style.setProperty('--kh', `${f1(G.L)}px`)
    for (const g of [back, house, doorsSvg, roofSvg]) g.setAttribute('viewBox', `0 0 ${W} ${H}`)
    risks.forEach((p, i) => (p.style.cssText = `left:${f1(G.doors[i].x)}px;top:${f1(y1 + H * 0.025)}px;width:${f1(G.doors[i].w + 16)}px`))
    ringEl.style.transform = `translate(${f1(G.ring[0])}px, ${f1(G.ring[1])}px)`

    function* draw() {
      back.replaceChildren(
        s('circle', { class: 't33y-moonhalo', cx: f1(W * 0.92), cy: f1(H * 0.04), r: f1(Math.min(W, H) * 0.3) }),
        mist(W * 0.6, y0 - H * 0.12, W * 0.6, H * 0.12),
        hills(W * 0.2, W * 1.05, y0 - H * 0.04, H * 0.16, 3320, 0.95, 5))
      yield
      house.replaceChildren(...houseArt(W, G.doors, y0, y1, 3321))
      doorsSvg.replaceChildren(...G.doors.map((d, i) => {
        const gate = G.doors[3]
        const trail = stroke(curve([d.x, y1 + 4], [(d.x + gate.x) / 2, y1 + (y1 - y0) * 0.5], [gate.x, y1 + 6], 16), 3, 0.1, 0.1, 0.4)
        return s('g', { class: `t33y-door t33y-d${i}` },
          s('g', { class: 't33y-open' }, ...doorArt(i, d, y0, y1, 3360 + i * 7)),
          s('path', { class: 't33y-trail', d: trail }),
          s('g', { class: 't33y-ofuda' }, ...ofuda(d, y0, y1, 3390 + i)),
          s('g', { class: 't33y-locked' }, s('path', { class: 't33y-lockp', d: stroke([[d.x - d.w * 0.5, y0 + 6], [d.x + d.w * 0.5, y1 - 6]], 3, 0.1, 0.1, 0.5) + stroke([[d.x + d.w * 0.5, y0 + 6], [d.x - d.w * 0.5, y1 - 6]], 3, 0.1, 0.1, 0.5) })))
      }))
      yield
      // a great stone lantern, so close that the frame cuts it: its lit firebox on the left, the keys hung from its roof's corner
      const [rx, ry] = G.ring
      const u = mobile ? H * 0.05 : H * 0.085
      const lx = rx - 1.92 * u, ly = ry - H * 0.035 + 7.45 * u
      // "Giao việc" hangs from the roof's other corner
      check.style.left = `${f1(Math.max(8, lx - 1.95 * u - check.offsetWidth / 2))}px`
      check.style.top = `${f1(ly - 7.3 * u + 22)}px`
      const r = rng(3322)
      let chisel = ''
      for (let i = 0; i < 26; i++) {
        const x = lx - 1.8 * u + r() * 3.6 * u, y = ly - 7.5 * u - r() * 1.1 * u
        chisel += stroke([[x, y], [x + u * (0.1 + r() * 0.2), y + (r() - 0.5) * 2]], 1 + r() * 1.2, 0.2, 0.4, 0.1)
      }
      roofSvg.replaceChildren(
        s('circle', { class: 't33y-firehalo', cx: f1(lx), cy: f1(ly - 6.3 * u), r: f1(u * 5) }),
        toro(lx, ly, 10 * u, true),
        s('path', { class: 't33y-chisel', d: chisel }),
        s('path', { class: 't33y-moss', d: blob(lx - 0.6 * u, ly - 8.2 * u, u * 0.9, u * 0.16, 3323, 0.4, 14) + blob(lx + 0.9 * u, ly - 7.95 * u, u * 0.5, u * 0.1, 3324, 0.4, 10), filter: 'url(#ink-wash)' }),
        s('path', { class: 't33y-flame', d: `M${f1(lx)} ${f1(ly - 5.45 * u)}q${f1(-u * 0.32)} ${f1(-u * 0.5)} 0 ${f1(-u * 1.25)}q${f1(u * 0.34)} ${f1(u * 0.75)} 0 ${f1(u * 1.25)}Z` }),
        s('path', { class: 't33y-moonedge', d: stroke(curve([lx - 1.9 * u, ly - 7.28 * u], [lx, ly - 7.45 * u], [lx + 1.9 * u, ly - 7.28 * u], 12), Math.max(1.6, u * 0.03), 0.1, 0.2, 0.2) }),
        s('path', { class: 't33y-cord', d: `M${f1(lx + 1.82 * u)} ${f1(ly - 7.3 * u)}Q${f1(rx + 3)} ${f1((ly - 7.3 * u + ry) / 2 + 4)} ${f1(rx)} ${f1(ry - 14)}M${f1(lx - 1.82 * u)} ${f1(ly - 7.3 * u)}V${f1(ly - 7.3 * u + 22)}` }))
      if (first) for (let i = 0; i < N; i++) {
        const [x, y, a] = homeOf(i)
        Object.assign(keys[i], { x, y, a, tx: x, ty: y, ta: a })
      }
      settleTargets()
      write(true)
    }
    job?.cancel()
    job = sliced(draw(), { sync: ctx.reduced || !first })
    first = false
    px.resize()
  }
  ctx.onCleanup(onSize(root, layout))
  ctx.onCleanup(() => job?.cancel())

  // ── motion: keys ease toward their homes; the ring is a damped pendulum; one loop that stops when all is still
  function settleTargets() {
    for (let i = 0; i < N; i++) {
      if (i === dragKey) continue
      const [x, y, a] = homeOf(i)
      Object.assign(keys[i], { tx: x, ty: y, ta: a })
    }
  }
  function write(snap = false) {
    keys.forEach((k, i) => {
      if (snap) Object.assign(k, { x: k.tx, y: k.ty, a: k.ta })
      const onRing = !given.has(K.keys[i].id) && i !== dragKey
      const a = k.a + (onRing ? swing + k.lag : 0)
      keyEls[i].b.style.transform = `translate(${f1(k.x)}px,${f1(k.y)}px) rotate(${a.toFixed(2)}deg)`
      // the tag hangs straight down from the bit whatever the key does
      keyEls[i].tag.style.transform = `rotate(${(-a).toFixed(2)}deg)`
      keyEls[i].glint.style.transform = `translateY(${f1((swing + k.lag) * 1.6 + (i % 2) * 8)}px)`
    })
    ringEl.style.transform = `translate(${f1(G.ring[0])}px, ${f1(G.ring[1])}px) rotate(${swing.toFixed(2)}deg)`
  }
  const loop = createLoop(root, (_t, dt) => {
    let moving = false
    // pendulum: θ'' = −k θ − c θ'
    if (!draggingRing) {
      const acc = -26 * swing - 2.2 * vel
      vel += acc * dt
      swing += vel * dt
    }
    if (Math.abs(swing) + Math.abs(vel) > 0.05) moving = true
    else if (!draggingRing) (swing = 0), (vel = 0)
    const f = 1 - Math.exp(-dt * 9)
    keys.forEach((k, i) => {
      // each key lags the ring a little, so the bunch jangles
      const want = i === dragKey ? 0 : swing * (0.12 + 0.05 * i)
      k.lag += (want - k.lag) * (1 - Math.exp(-dt * (5 + i)))
      if (i === dragKey) return
      k.x += (k.tx - k.x) * f
      k.y += (k.ty - k.y) * f
      k.a += (k.ta - k.a) * f
      if (Math.abs(k.tx - k.x) + Math.abs(k.ty - k.y) + Math.abs(k.ta - k.a) > 0.3) moving = true
      if (Math.abs(k.lag - want) > 0.05) moving = true
    })
    write()
    return moving || draggingRing || dragKey >= 0
  }, { essential: true })
  ctx.onCleanup(() => loop.dispose())
  const kick = () => (ctx.reduced ? (settleTargets(), write(true)) : loop.start())

  // ── the ring: drag sideways to swing it
  let draggingRing = false
  let ringX0 = 0
  const ringZone = (x: number, y: number) => Math.hypot(x - G.ring[0], (y - G.ring[1] - G.L * 0.5) * 0.8) < G.L * 0.75
  root.addEventListener('pointerdown', (e) => {
    if (still || dragKey >= 0 || (e.target as Element).closest('button')) return
    const r = root.getBoundingClientRect()
    if (!ringZone(e.clientX - r.left, e.clientY - r.top)) return
    draggingRing = true
    ringX0 = e.clientX - swing * 3
    root.setPointerCapture(e.pointerId)
    loop.start()
  })
  root.addEventListener('pointermove', (e) => {
    if (!draggingRing) return
    const s2 = clamp((e.clientX - ringX0) / 3, -28, 28)
    vel = (s2 - swing) * 20
    swing = s2
  })
  const ringUp = () => {
    if (!draggingRing) return
    draggingRing = false
    if (Math.abs(swing) > 8) ctx.chime('tap')
  }
  root.addEventListener('pointerup', ringUp)
  root.addEventListener('pointercancel', ringUp)

  // ── a key: tap (or Enter) to give / take back; or pick it up and drop it in the open hand
  const label = () => keyEls.forEach(({ k, b }) => {
    const on = given.has(k.id)
    b.setAttribute('aria-pressed', String(on))
    b.setAttribute('aria-label', fill(K.keyAria, { label: k.label, state: on ? K.given : K.kept }))
  })
  function toggle(i: number, to?: boolean) {
    const id = K.keys[i].id
    const on = to ?? !given.has(id)
    if (on) given.add(id)
    else given.delete(id)
    root.classList.toggle(`g-${i}`, on)
    root.classList.remove('judged', 'too-many', 'too-few', 'right')
    label()
    tagRows()
    settleTargets()
    kick()
    ctx.chime('tap')
    say.say(on ? h('span', null, h('strong', null, `${K.keys[i].label}: `), K.keys[i].risk) : '')
  }
  keyEls.forEach(({ b }, i) => {
    let p0: Pt | null = null, moved = false, rel: Pt = [0, 0]
    b.addEventListener('pointerdown', (e) => {
      if (still) return
      const r = root.getBoundingClientRect()
      p0 = [e.clientX, e.clientY]
      moved = false
      rel = [e.clientX - r.left - keys[i].x, e.clientY - r.top - keys[i].y]
      b.setPointerCapture(e.pointerId)
    })
    b.addEventListener('pointermove', (e) => {
      if (!p0) return
      if (!moved && Math.hypot(e.clientX - p0[0], e.clientY - p0[1]) < 8) return
      if (!moved) {
        moved = true
        dragKey = i
        b.classList.add('held')
        loop.start()
      }
      const r = root.getBoundingClientRect()
      keys[i].x = e.clientX - r.left - rel[0]
      keys[i].y = e.clientY - r.top - rel[1]
      keys[i].a += (-20 - keys[i].a) * 0.2
      keys[i].tx = keys[i].x
      keys[i].ty = keys[i].y
      keys[i].ta = keys[i].a
    })
    const up = (e: PointerEvent) => {
      if (!p0) return
      p0 = null
      if (!moved) return
      dragKey = -1
      b.classList.remove('held')
      const r = root.getBoundingClientRect()
      const x = e.clientX - r.left, y = e.clientY - r.top
      // dropped on the hand (its box, a little generous) = given
      const inHand = x > G.hand.x + 20 * G.hand.s && y > G.hand.y + 70 * G.hand.s
      toggle(i, inHand)
      // the click that follows a drag is not a tap
      setTimeout(() => (moved = false), 0)
    }
    b.addEventListener('pointerup', up)
    b.addEventListener('pointercancel', up)
    b.addEventListener('click', () => !moved && toggle(i))
  })

  // ── "Giao việc": the gardener goes to work with the keys in his hand
  check.addEventListener('click', () => {
    const extra = K.keys.map((k, i) => (given.has(k.id) && !k.need ? i : -1)).filter((i) => i >= 0)
    const missing = K.keys.map((k, i) => (k.need && !given.has(k.id) ? i : -1)).filter((i) => i >= 0)
    root.classList.remove('too-many', 'too-few', 'right')
    for (let i = 0; i < N; i++) root.classList.remove(`x-${i}`, `m-${i}`)
    void root.offsetWidth
    root.classList.add('judged')
    if (extra.length) {
      extra.forEach((i) => root.classList.add(`x-${i}`))
      root.classList.add('too-many')
      ctx.chime('low')
      return say.say(h('span', { class: 'bad' }, fill(K.tooMany, { n: extra.length })))
    }
    if (missing.length) {
      missing.forEach((i) => root.classList.add(`m-${i}`))
      root.classList.add('too-few')
      ctx.chime('low')
      return say.say(h('span', { class: 'bad' }, K.tooFew))
    }
    root.classList.add('right')
    ctx.chime('ok')
    say.say(K.right)
    if (solved) return
    solved = true
    ctx.insight(K.insight as Fact, K.detail as Fact)
    sheet.show()
  })
  label()
  tagRows()
}
