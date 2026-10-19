import './trays.css'
import { fill, h, nextId, s } from '../../core/dom'
import { onPrefs } from '../../core/prefs'
import { sliced } from '../../core/chunk'
import { blob, clamp, curve, onDigit, onSize, rng, seedOf, shuffledIdx, stableHeight, stroke, type Pt } from '../../ui/part2/ink'
import { guide, type Mark } from '../../ui/part2/guide'
import type { SceneCtx } from '../types'
import { C } from './shell'
import { brush, canvas, col, dprOf, fillD, fit, glow, grainOver, inkHills, mistBank, mix, moonDisc, palette, sky, type Pal } from './ink2d'

const K = C.scenes.trays
const f1 = (n: number) => n.toFixed(1)
type Box = { x: number; y: number; w: number; h: number } // centre and size, px

/** Where everything lies for a stage W × H (the painting runs to the window's edges): the veranda runs from the basket
 *  (near left, cut by the frame) up to the mist (far right), where the moon is setting behind the farthest tray. */
function geo(W: number, H: number) {
  const wide = W / H > 1.05
  const B = (x: number, y: number, w: number, hh: number): Box => ({ x: x * W, y: y * H, w: w * W, h: hh * H })
  const g = wide
    ? {
        trays: [B(0.54, 0.76, 0.3, 0.19), B(0.745, 0.505, 0.225, 0.145), B(0.885, 0.3, 0.17, 0.11)],
        basket: B(0.15, 0.86, 0.36, 0.46),
        peb: [clamp(W * 0.085, 104, 132), clamp(H * 0.075, 40, 50)],
        tpeb: [clamp(W * 0.075, 92, 118), clamp(H * 0.06, 30, 40)],
        edge: [[-0.02, 0.47], [1.02, 0.36]] as Pt[],
        vp: [W * 0.97, H * 0.17] as Pt,
        hz: H * 0.3,
      }
    : {
        trays: [B(0.5, 0.585, 0.86, 0.13), B(0.56, 0.405, 0.7, 0.1), B(0.6, 0.245, 0.6, 0.085)],
        basket: B(0.5, 0.885, 1.12, 0.28),
        peb: [Math.min(W * 0.27, 104), clamp(H * 0.062, 34, 40)],
        tpeb: [Math.min(W * 0.29, 118), clamp(H * 0.054, 30, 34)],
        edge: [[-0.02, 0.33], [1.02, 0.29]] as Pt[],
        vp: [W * 0.9, H * 0.12] as Pt,
        hz: H * 0.2,
      }
  const ft = g.trays[2]
  const moon: Pt = [ft.x + ft.w * 0.2, ft.y - ft.h * 0.62]
  return { W, H, wide, ...g, moon, mr: ft.h * (wide ? 0.42 : 0.5), edgeY: (x: number) => (g.edge[0][1] + ((g.edge[1][1] - g.edge[0][1]) * (x / W - g.edge[0][0])) / (g.edge[1][0] - g.edge[0][0])) * H }
}
type Geo = ReturnType<typeof geo>

/** Centres of n pebbles lying in tray j (a staggered grid in its hollow; they overlap a little when crowded). */
function traySlots(G: Geo, j: number, n: number): Pt[] {
  const t = G.trays[j]
  const sc = [1, 0.94, 0.88][j]
  const pw = G.tpeb[0] * sc, ph = G.tpeb[1] * sc
  const iw = t.w * 0.82, ih = t.h * 0.58
  const cols = Math.max(Math.min(n, 2), Math.min(n, Math.floor(iw / (pw * 0.92))))
  const rows = Math.ceil(n / cols)
  const dx = Math.min(pw * 1.04, iw / cols), dy = Math.min(ph * 1.1, (ih - ph * 0.3) / Math.max(1, rows - 1 || 1))
  return Array.from({ length: n }, (_, k) => {
    const c = k % cols, r = Math.floor(k / cols)
    const inRow = r === rows - 1 ? n - r * cols : cols
    return [t.x + (c - (inRow - 1) / 2) * dx + (r % 2 ? dx * 0.12 : 0), t.y - t.h * 0.06 + (r - (rows - 1) / 2) * (rows > 1 ? dy : 0)] as Pt
  })
}
/** The eight places in the basket: a loose heap in its mouth, stones leaning on each other (stable per layout). */
const HEAP: Pt[] = [[-0.66, -0.56], [0.04, -0.64], [0.7, -0.5], [-0.42, 0.04], [0.3, 0.02], [0.92, 0.12], [-0.08, 0.62], [0.62, 0.68]]
const HEAP_TALL: Pt[] = [[-1, -0.66], [0, -0.72], [1, -0.62], [-0.9, 0.04], [0.08, 0], [1.02, 0.08], [-0.48, 0.72], [0.52, 0.68]]
function basketSlots(G: Geo): Pt[] {
  const b = G.basket
  const mx = b.x + (G.wide ? b.w * 0.02 : 0), my = b.y - b.h * (G.wide ? 0.16 : 0.12)
  const rx = b.w * (G.wide ? 0.4 : 0.3), ry = b.h * (G.wide ? 0.3 : 0.34)
  const r = rng(3801)
  return (G.wide ? HEAP : HEAP_TALL).map(([u, v]) => [mx + (u + (r() - 0.5) * 0.06) * rx, my + (v + (r() - 0.5) * 0.06) * ry] as Pt)
}

/** A closed outline through `pts` with rounded corners (radius per corner), hand-cut: each side wobbles a little. */
function cut(pts: Pt[], rad: number, seed: number) {
  const r = rng(seed)
  const q = new Path2D()
  const n = pts.length
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2 + (r() - 0.5) * 1.6, (a[1] + b[1]) / 2 + (r() - 0.5) * 1.2]
  q.moveTo(...mid(pts[n - 1], pts[0]))
  for (let i = 0; i < n; i++) q.arcTo(pts[i][0], pts[i][1], ...mid(pts[i], pts[(i + 1) % n]), rad * (0.8 + r() * 0.4))
  q.closePath()
  return q
}
/** granite speckle over a region already clipped */
function speckle(g: CanvasRenderingContext2D, p: Pal, x: number, y: number, w: number, hh: number, n: number, r: () => number) {
  for (let i = 0; i < n; i++) {
    const gx = x + r() * w, gy = y + r() * hh
    g.fillStyle = r() < 0.55 ? col(p.umbra, p.dark ? 0.45 : 0.22) : p.dark ? col(p.moon, 0.1) : col(p['rake-hi'], 0.75)
    g.fillRect(gx, gy, 0.9 + r() * 1.4, 0.8 + r() * 0.8)
  }
}

/** A carved stone tray seen from low on the veranda: long shadow, a chiselled face in shade, a lit chamfer and a rough
 *  rim, a hollow holding its contents (raked dry gravel, half a tray of water holding the sky, or fog to the brim). */
function paintTray(g: CanvasRenderingContext2D, p: Pal, t: Box, kind: string, seed: number) {
  const r = rng(seed)
  const { x, y, w, h: hh } = t
  const x0 = x - w / 2, y0 = y - hh / 2
  const nar = w * 0.045 // the far edge is narrower: we look down on it
  const fh = hh * 0.5
  const rad = hh * 0.12
  const top: Pt[] = [[x0 + nar, y0], [x0 + w - nar, y0], [x0 + w, y0 + hh], [x0, y0 + hh]]
  const body: Pt[] = [[x0 + nar, y0 + hh * 0.2], [x0 + w - nar, y0 + hh * 0.2], [x0 + w - 1, y0 + hh + fh], [x0 + 1, y0 + hh + fh]]
  // the long shadow toward the near left (the moon sets far right), and the dark line of contact
  glow(g, x - w * 0.26, y0 + hh + fh * 0.98, w * 0.7, hh * 0.3, p.umbra, p.dark ? 0.75 : 0.34, 0.5)
  glow(g, x, y0 + hh + fh + 1, w * 0.56, hh * 0.08, p.umbra, p.dark ? 0.9 : 0.55, 0.5)
  // the face: in shade, a little lighter toward the right where the moon grazes it
  const fg = g.createLinearGradient(x0, 0, x0 + w, 0)
  fg.addColorStop(0, col(mix(p['rock-lo'], p.umbra, p.dark ? 0.6 : 0.42)))
  fg.addColorStop(0.7, col(mix(p['rock-mid'], p['rock-lo'], 0.55)))
  fg.addColorStop(1, col(mix(p['rock-mid'], p['rock-hi'], 0.2)))
  g.fillStyle = fg
  const bp = cut(body, rad, seed)
  g.fill(bp)
  g.save()
  g.clip(bp)
  speckle(g, p, x0, y0 + hh * 0.2, w, hh * 0.8 + fh, Math.min(600, (w * (hh + fh)) / 22), r)
  // chisel strokes: a slant of short tool marks, strata across
  for (let i = 0; i < 26; i++) {
    const cx = x0 + w * (0.02 + r() * 0.96), cy = y0 + hh + fh * (0.08 + r() * 0.84)
    brush(g, [[cx, cy], [cx + w * (0.012 + r() * 0.03), cy + fh * (0.08 + r() * 0.14)]], 0.7 + r() * 0.9, col(p.dark ? p.umbra : p.wash, p.dark ? 0.5 : 0.2), 0.3, 0.4, 0.15)
  }
  for (let k = 1; k < 3; k++) brush(g, [[x0, y0 + hh + fh * k * 0.33], [x0 + w, y0 + hh + fh * k * 0.33 + 1]], 0.8, col(p.dark ? p.umbra : p.wash, p.dark ? 0.35 : 0.12), 0.4, 0.4, 0.1)
  const fo = g.createLinearGradient(0, y0 + hh, 0, y0 + hh + fh)
  fo.addColorStop(0, col(p.umbra, 0))
  fo.addColorStop(1, col(p.umbra, p.dark ? 0.5 : 0.28))
  g.fillStyle = fo
  g.fillRect(x0, y0 + hh, w, fh + 2)
  g.restore()
  // the rim: lit stone with chisel hatching across it
  const tp = cut(top, rad, seed + 1)
  const rg = g.createLinearGradient(x0 + w, y0, x0, y0 + hh)
  rg.addColorStop(0, col(p['rock-hi']))
  rg.addColorStop(1, col(mix(p['rock-hi'], p['rock-mid'], 0.55)))
  g.fillStyle = rg
  g.fill(tp)
  g.save()
  g.clip(tp)
  speckle(g, p, x0, y0, w, hh, Math.min(260, (w * hh) / 30), r)
  for (let i = 0; i < 46; i++) {
    const u = r()
    const ex = x0 + nar + u * (w - nar * 2), side = r() < 0.5
    const yy = side ? y0 + 1 + r() * 3 : y0 + hh - 2 - r() * 4
    brush(g, [[ex, yy], [ex + 1.5, yy + (side ? 2.5 : -3)]], 0.7, col(p.dark ? p.umbra : p['rock-lo'], 0.45), 0.3, 0.3, 0.2)
  }
  g.restore()
  // the hollow (inset by the rim's thickness; narrower at the back)
  const tk = Math.max(7, Math.min(w, hh * 2.4) * 0.075)
  const hol: Pt[] = [[x0 + nar + tk * 1.05, y0 + tk * 0.5], [x0 + w - nar - tk * 1.05, y0 + tk * 0.5], [x0 + w - tk, y0 + hh - tk * 0.75], [x0 + tk, y0 + hh - tk * 0.75]]
  const hp = cut(hol, rad * 0.6, seed + 2)
  const ix = x0 + tk, iy = y0 + tk * 0.5, iw = w - tk * 2, ih = hh - tk * 1.25
  g.save()
  g.clip(hp)
  const sand = p.dark ? mix(p['rock-mid'], p['step-mid'], 0.45) : mix(p['step-hi'], p['rock-hi'], 0.45)
  g.fillStyle = col(kind === 'far' ? mix(sand, p.mist, p.dark ? 0.25 : 0.55) : sand)
  g.fillRect(ix, iy, iw, ih)
  if (kind !== 'far') speckle(g, p, ix, iy, iw, ih, Math.min(700, (iw * ih) / 22), r)
  // raked gravel: parallel furrows in perspective, a dark groove and a lit ridge each
  const rake = (y1: number, y2: number, n: number) => {
    for (let k = 1; k < n; k++) {
      const ly = y1 + ((y2 - y1) * Math.pow(k / n, 1.2))
      const pts: Pt[] = Array.from({ length: 16 }, (_, i) => [ix + (iw * i) / 15, ly + Math.sin(i * 0.9 + k) * 1] as Pt)
      brush(g, pts, 1.2 + (k / n) * 0.8, col(p.dark ? p.umbra : p.wash, p.dark ? 0.45 : 0.2), 0.1, 0.1, 0.3)
      brush(g, pts.map(([a, b]) => [a, b + 1.6] as Pt), 1, p.dark ? col(p.moon, 0.16) : col(p['rake-hi'], 0.95), 0.1, 0.1, 0.3)
    }
  }
  if (kind === 'good') {
    rake(iy, iy + ih, 7)
  } else if (kind === 'learning') {
    // the back half gravel, the near half under water holding the sky and the rim's reflection, a moon glint, rings
    const wl = iy + ih * 0.42
    rake(iy, wl, 4)
    const wg = g.createLinearGradient(0, wl, 0, iy + ih)
    wg.addColorStop(0, col(mix(p.water, p.moon, p.dark ? 0.12 : 0.3), 0.94))
    wg.addColorStop(1, col(mix(p.water, p.umbra, 0.2), 0.97))
    g.fillStyle = wg
    g.beginPath()
    g.moveTo(ix, wl)
    for (let i = 0; i <= 16; i++) g.lineTo(ix + (iw * i) / 16, wl + Math.sin(i * 1.3) * 0.8)
    g.lineTo(ix + iw, iy + ih)
    g.lineTo(ix, iy + ih)
    g.closePath()
    g.fill()
    // the far rim upside down in the water: a pale band, broken by the ripples
    for (let k = 0; k < 5; k++) brush(g, [[ix + iw * (0.05 + r() * 0.2), wl + ih * (0.08 + k * 0.035)], [ix + iw * (0.55 + r() * 0.4), wl + ih * (0.08 + k * 0.035)]], 1.2, p.dark ? col(p['rock-hi'], 0.18) : col(p['rock-hi'], 0.7), 0.3, 0.3, 0.1)
    brush(g, [[ix, wl], [ix + iw, wl + 0.5]], 1.4, p.dark ? col(p.moon, 0.35) : col(p['rake-hi'], 0.95), 0.1, 0.1, 0.3)
    glow(g, ix + iw * 0.72, wl + ih * 0.32, iw * 0.16, ih * 0.08, p.moon, p.dark ? 0.85 : 0.7, 0.4)
    for (let k = 0; k < 2; k++) {
      g.beginPath()
      g.ellipse(ix + iw * 0.36, wl + ih * 0.3, iw * (0.08 + k * 0.07), ih * (0.05 + k * 0.045), 0, 0, Math.PI * 2)
      g.strokeStyle = p.dark ? col(p.moon, 0.3 - k * 0.12) : col(p['rake-hi'], 0.9 - k * 0.35)
      g.lineWidth = 1
      g.stroke()
    }
  } else {
    for (let k = 0; k < 4; k++) mistBank(g, p, ix + iw * (0.15 + k * 0.25), iy + ih * (0.3 + (k % 2) * 0.35), iw * 0.4, ih * 0.55, 1.6)
  }
  // the inner far wall in shade
  const sg = g.createLinearGradient(0, iy, 0, iy + ih * 0.38)
  sg.addColorStop(0, col(p.umbra, p.dark ? 0.62 : 0.34))
  sg.addColorStop(1, col(p.umbra, 0))
  g.fillStyle = sg
  g.fillRect(ix, iy, iw, ih * 0.38)
  g.restore()
  // ink: the face's foot, the chamfer of the near edge catching the light, the rim's back edge; chips; moss at a corner
  brush(g, [[x0 + rad * 0.5, y0 + hh + fh], [x, y0 + hh + fh + 1], [x0 + w - rad * 0.5, y0 + hh + fh]], 2, col(p.dark ? p.umbra : p.wash, p.dark ? 0.8 : 0.5), 0.1, 0.1, 0.4)
  brush(g, [[x0 + rad * 0.4, y0 + hh + 1.4], [x, y0 + hh + 1.8], [x0 + w - rad * 0.4, y0 + hh + 1.4]], 1.8, p.dark ? col(p.moon, 0.32) : col(p['rake-hi'], 1), 0.15, 0.15, 0.3)
  brush(g, [[x0 + rad * 0.4, y0 + hh + 3.4], [x, y0 + hh + 3.8], [x0 + w - rad * 0.4, y0 + hh + 3.4]], 1, col(p.dark ? p.umbra : p.wash, p.dark ? 0.5 : 0.25), 0.2, 0.2, 0.3)
  brush(g, [[x0 + nar + rad, y0 + 0.8], [x, y0], [x0 + w - nar - rad, y0 + 0.8]], 1.5, p.dark ? col(p.moon, 0.45) : col(p['rake-hi'], 1), 0.2, 0.2, 0.2)
  for (let i = 0; i < 4; i++) {
    const cx = x0 + w * (0.12 + r() * 0.76)
    fillD(g, blob(cx, y0 + hh - 0.5, 2.5 + r() * 3, 1.5, seed + 20 + i, 0.3, 8), col(p.dark ? p.umbra : p['rock-lo'], 0.55))
  }
  fillD(g, blob(x0 + w * 0.05, y0 + hh * 0.9, w * 0.03, hh * 0.09, seed + 30, 0.35, 12), col(p['moss-b'], 0.85))
  fillD(g, blob(x0 + w * 0.06, y0 + hh * 0.84, w * 0.017, hh * 0.05, seed + 31, 0.35, 10), col(p['moss-a'], 0.8))
}

/** The rattan basket, cut by the frame: a cylinder of woven cane (over-under strips between stakes, rounder at the sides),
 *  a thick wrapped rim lit on top, the dark woven mouth, the handle arching behind, its shadow on the boards. */
function paintBasket(g: CanvasRenderingContext2D, p: Pal, b: Box, seed: number) {
  const r = rng(seed)
  const cane = p.dark ? mix(p['step-lo'], p.lantern, 0.24) : mix(p['step-mid'], p.lantern, 0.34)
  const caneHi = mix(cane, p.dark ? p['step-hi'] : p['rake-hi'], p.dark ? 0.35 : 0.5)
  const caneD = mix(cane, p.umbra, 0.5)
  const mx = b.x, my = b.y - b.h * 0.14, rx = b.w * 0.5, ry = b.h * 0.36
  const bot = b.y + b.h
  // the handle arching behind, the shadow on the boards
  brush(g, curve([mx - rx * 0.86, my - ry * 0.2], [mx, my - ry * 2.6], [mx + rx * 0.86, my - ry * 0.2], 30), Math.max(6, b.w * 0.024), col(caneD), 0.02, 0.02, 0.8)
  brush(g, curve([mx - rx * 0.8, my - ry * 0.4], [mx - rx * 0.05, my - ry * 2.45], [mx + rx * 0.6, my - ry * 0.9], 24), Math.max(1.4, b.w * 0.005), p.dark ? col(p.moon, 0.25) : col(p['rake-hi'], 0.8), 0.3, 0.3, 0.1)
  glow(g, mx + rx * 0.45, b.y + b.h * 0.42, rx * 1.3, ry * 0.6, p.umbra, p.dark ? 0.75 : 0.36, 0.5)
  // the wall: woven strips following the curve of the cylinder
  const wall = new Path2D()
  wall.ellipse(mx, my, rx, ry, 0, 0, Math.PI)
  wall.lineTo(mx - rx * 0.94, bot)
  wall.lineTo(mx + rx * 0.94, bot)
  wall.closePath()
  g.fillStyle = col(caneD)
  g.fill(wall)
  g.save()
  g.clip(wall)
  const rows = 11, cols = 22
  const rowH = (bot - my) / rows
  for (let k = 0; k < rows; k++) {
    for (let i = 0; i < cols; i++) {
      const a0 = Math.PI * (1 - (i + (k % 2) * 0.5) / cols), a1 = Math.PI * (1 - (i + 0.86 + (k % 2) * 0.5) / cols)
      const xa = mx + Math.cos(a0) * rx, xb = mx + Math.cos(a1) * rx
      const sag = (a: number) => Math.sin(a) * ry * 0.9
      const ya = my + sag(a0) + k * rowH + rowH * 0.15, yb = my + sag(a1) + k * rowH + rowH * 0.15
      const lit = 0.5 + 0.5 * Math.cos((a0 + a1) / 2 - Math.PI * 0.75) // lit toward the upper left
      const st = new Path2D()
      st.moveTo(xa, ya)
      st.lineTo(xb, yb)
      st.lineTo(xb, yb + rowH * 0.72)
      st.lineTo(xa, ya + rowH * 0.72)
      st.closePath()
      const sg = g.createLinearGradient(0, ya, 0, ya + rowH * 0.72)
      sg.addColorStop(0, col(mix(cane, caneHi, lit * 0.8)))
      sg.addColorStop(1, col(mix(cane, caneD, 0.55)))
      g.fillStyle = sg
      g.fill(st)
      if (r() < 0.25) brush(g, [[xa + (xb - xa) * 0.2, ya + rowH * 0.3], [xa + (xb - xa) * 0.7, yb + rowH * 0.32]], 0.5, col(caneD, 0.6), 0.3, 0.3, 0.2)
    }
  }
  // the cylinder: darker at both sides, deepest on the right
  const sh = g.createLinearGradient(mx - rx, 0, mx + rx, 0)
  sh.addColorStop(0, col(p.umbra, p.dark ? 0.45 : 0.25))
  sh.addColorStop(0.3, col(p.umbra, 0))
  sh.addColorStop(0.62, col(p.umbra, 0.04))
  sh.addColorStop(1, col(p.umbra, p.dark ? 0.7 : 0.45))
  g.fillStyle = sh
  g.fillRect(mx - rx, my, rx * 2, bot - my)
  g.restore()
  // the mouth: the far inside wall woven and catching a little light, the bottom in shade
  const mouth = new Path2D()
  mouth.ellipse(mx, my, rx * 0.93, ry * 0.86, 0, 0, Math.PI * 2)
  const mg = g.createLinearGradient(0, my - ry, 0, my + ry)
  mg.addColorStop(0, col(mix(cane, p.umbra, 0.2)))
  mg.addColorStop(0.5, col(mix(cane, p.umbra, 0.55)))
  mg.addColorStop(1, col(mix(cane, p.umbra, 0.85)))
  g.fillStyle = mg
  g.fill(mouth)
  g.save()
  g.clip(mouth)
  for (let k = 0; k < 6; k++) {
    for (let i = 0; i < 18; i++) {
      const a0 = Math.PI * (1 + (i + (k % 2) * 0.5) / 18), a1 = Math.PI * (1 + (i + 0.82 + (k % 2) * 0.5) / 18)
      const yo = k * ry * 0.13
      const xa = mx + Math.cos(a0) * rx * 0.93, xb = mx + Math.cos(a1) * rx * 0.93
      const ya = my + Math.sin(a0) * ry * 0.86 + yo, yb = my + Math.sin(a1) * ry * 0.86 + yo
      fillD(g, `M${f1(xa)} ${f1(ya)}L${f1(xb)} ${f1(yb)}L${f1(xb)} ${f1(yb + ry * 0.09)}L${f1(xa)} ${f1(ya + ry * 0.09)}Z`, col(mix(cane, p.umbra, 0.25 + k * 0.1), 0.75))
    }
  }
  const bottom = g.createRadialGradient(mx, my + ry * 0.3, 0, mx, my + ry * 0.3, rx * 0.9)
  bottom.addColorStop(0, col(mix(cane, p.umbra, 0.7), 0.9))
  bottom.addColorStop(1, col(mix(cane, p.umbra, 0.7), 0))
  g.fillStyle = bottom
  g.fillRect(mx - rx, my - ry, rx * 2, ry * 2)
  g.restore()
  // the wrapped rim: a thick band, its underside in shade, its top lit, bound with diagonal wraps
  const rw = Math.max(7, b.w * 0.03)
  g.lineWidth = rw
  g.strokeStyle = col(caneD)
  g.beginPath()
  g.ellipse(mx, my + rw * 0.35, rx * 0.965, ry * 0.9, 0, 0, Math.PI * 2)
  g.stroke()
  g.strokeStyle = col(cane)
  g.beginPath()
  g.ellipse(mx, my, rx * 0.965, ry * 0.9, 0, 0, Math.PI * 2)
  g.stroke()
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2
    const px = mx + Math.cos(a) * rx * 0.965, py = my + Math.sin(a) * ry * 0.9
    brush(g, [[px - rw * 0.3, py - rw * 0.45], [px + rw * 0.3, py + rw * 0.45]], 1.1, col(caneD, 0.85), 0.2, 0.2, 0.3)
  }
  brush(g, curve([mx - rx * 0.95, my - ry * 0.2], [mx - rx * 0.4, my - ry * 1.02], [mx + rx * 0.45, my - ry * 0.9], 18), Math.max(1.6, rw * 0.28), p.dark ? col(p.moon, 0.4) : col(p['rake-hi'], 1), 0.3, 0.3, 0.1)
}

/** The whole back painting: dawn sky, the moon going down behind the far tray, the pond, the veranda's boards, trays, basket. */
function paintScene(g: CanvasRenderingContext2D, p: Pal, G: Geo) {
  const { W, H, hz } = G
  sky(g, p, W, H, hz, W * 0.08, 0.8)
  inkHills(g, p, -W * 0.05, W * 1.05, hz + 2, H * 0.1, 3896, 0.92, 7)
  mistBank(g, p, W * 0.5, hz + 2, W * 0.7, H * 0.05, 1)
  // the setting moon, low behind the farthest tray, deep in the haze
  const [mx, my] = G.moon
  moonDisc(g, p, mx, my, G.mr, 3895, 1.3)
  // the pond beyond the veranda: dark water, the moon's broken road, mist thickening toward the far tray
  const e0 = G.edgeY(0), e1 = G.edgeY(W)
  const wg = g.createLinearGradient(0, hz, 0, Math.max(e0, e1))
  wg.addColorStop(0, col(mix(p.water, p.mist, p.dark ? 0.1 : 0.5), 0.2))
  wg.addColorStop(1, col(mix(p.water, p.paper, p.dark ? 0 : 0.3), 0.85))
  g.fillStyle = wg
  g.beginPath()
  g.moveTo(0, hz + H * 0.01)
  g.lineTo(W, hz + H * 0.01)
  g.lineTo(W, e1 + 2)
  g.lineTo(0, e0 + 2)
  g.closePath()
  g.fill()
  for (let k = 0; k < 9; k++) {
    const yy = hz + H * 0.02 + ((Math.max(e0, e1) - hz) * k) / 9
    const len = W * (0.02 + k * 0.012)
    brush(g, [[mx - len, yy], [mx + len * 0.6, yy + 0.5]], 0.8 + k * 0.2, col(p.moon, p.dark ? 0.5 : 0.7), 0.3, 0.3, 0.1)
  }
  // the veranda: warm boards fanning from the far right toward us
  const floor = new Path2D()
  floor.moveTo(-2, e0)
  floor.lineTo(W + 2, e1)
  floor.lineTo(W + 2, H + 2)
  floor.lineTo(-2, H + 2)
  floor.closePath()
  const wood = p.dark ? mix(p['step-lo'], p.lantern, 0.1) : mix(p['step-hi'], p.lantern, 0.2)
  const fgr = g.createLinearGradient(W * 0.8, e1, W * 0.3, H)
  fgr.addColorStop(0, col(mix(wood, p.dark ? p['step-mid'] : p['step-hi'], 0.3)))
  fgr.addColorStop(0.5, col(wood))
  fgr.addColorStop(1, col(mix(wood, p.umbra, p.dark ? 0.6 : 0.3)))
  g.fillStyle = fgr
  g.fill(floor)
  g.save()
  g.clip(floor)
  const r = rng(3897)
  const vp = G.vp
  for (let i = 1; i < 16; i++) {
    const t = i / 15
    const end: Pt = [W * 1.05 - W * 1.9 * Math.pow(t, 1.2), H + 4]
    brush(g, [vp, end], 0.6 + t * 1.8, col(p.dark ? p.umbra : p.wash, p.dark ? 0.45 : 0.18), 0.05, 0.05, 0.6)
    for (let k = 0; k < 4; k++) {
      const t0 = 0.3 + r() * 0.65, t1 = t0 + 0.03 + r() * 0.05
      const e2: Pt = [end[0] + W * 0.05 * (1 + t), end[1]]
      brush(g, [[vp[0] + (e2[0] - vp[0]) * t0, vp[1] + (e2[1] - vp[1]) * t0], [vp[0] + (e2[0] - vp[0]) * t1, vp[1] + (e2[1] - vp[1]) * t1]], 0.5 + t, col(p.dark ? p.umbra : p.wash, p.dark ? 0.2 : 0.07), 0.3, 0.3, 0.2)
    }
  }
  g.restore()
  brush(g, [[-2, e0], [W + 2, e1]], 2.2, p.dark ? col(p.moon, 0.35) : col(p['rake-hi'], 1), 0.02, 0.02, 0.5)
  brush(g, [[-2, e0 + 2.5], [W + 2, e1 + 2.5]], 1.6, col(p.dark ? p.umbra : p.wash, p.dark ? 0.7 : 0.35), 0.02, 0.02, 0.5)
  const kinds = K.trays.map((t) => t.id)
  for (let j = 2; j >= 0; j--) {
    paintTray(g, p, G.trays[j], kinds[j], 3898 + j * 13)
    if (j === 2) {
      // depth haze over the far tray: it stays a tray, only paler and softer
      const ft = G.trays[2]
      mistBank(g, p, ft.x, ft.y + ft.h * 0.2, ft.w * 0.95, ft.h * 1.2, 1.1)
    }
  }
  paintBasket(g, p, G.basket, 3899)
  grainOver(g, p, W, H)
}

/** A river stone for one pebble: an irregular body lit from the upper left, its underside in shade, a soft highlight,
 *  a contact shadow; stretched to the pebble's box (each one a different shape). */
function pebbleArt(seed: number) {
  const r = rng(seed)
  const body = blob(50 + (r() - 0.5) * 3, 29, 46 - r() * 3, 24 - r() * 3, seed, 0.16 + r() * 0.08, 14)
  return s('svg', { class: 't38t-stone', viewBox: '0 0 100 62', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    s('ellipse', { class: 't38t-stone-cast', cx: 54, cy: 54, rx: 46, ry: 7 }),
    s('path', { class: 't38t-stone-body', d: body }),
    s('path', { class: 't38t-stone-under', d: body }),
    s('path', { class: 't38t-stone-hi', d: stroke([[18 + r() * 6, 15 + r() * 3], [34, 9 + r() * 2], [54 + r() * 8, 9]], 5, 0.3, 0.5, 0.1) }),
    s('path', { class: 't38t-stone-rim', d: body, 'vector-effect': 'non-scaling-stroke' }))
}

/** Scene 4 — sort the engraved pebbles: throw each into a tray (dry, half under water, in mist), then raise the blind. */
export function traysScene(ctx: SceneCtx) {
  const stable = stableHeight(ctx, [K.insight])
  const keysId = nextId('t38k')
  const order = shuffledIdx(K.tasks.length, seedOf(K.tasks.map((t) => t.id).join()))
  const ids = K.tasks.map((t) => t.id)
  const trayOf = (id: string) => K.trays.findIndex((t) => t.id === id)
  const placed: Record<string, number> = {}
  const inTray: string[][] = K.trays.map(() => [])
  let sel = ''
  let compared = false
  let G: Geo | null = null
  const pos = new Map<string, Box>()
  // each stone its own size and lie
  const rs = rng(3812)
  const look = new Map(ids.map((id) => [id, { w: 0.88 + rs() * 0.24, h: 0.9 + rs() * 0.22, rot: (rs() - 0.5) * 10 }]))

  const cv = canvas('t38t-cv')
  const rays = h('div', { class: 't38t-rays', 'aria-hidden': 'true' }, ...K.trays.map((_, j) => h('i', { class: 't38t-ray', style: `--j:${j}` })))
  const warm = h('div', { class: 't38t-warms', 'aria-hidden': 'true' }, ...K.trays.map((_, j) => h('i', { class: 't38t-warm', style: `--j:${j}` })))
  const veil = h('div', { class: 't38t-veil', 'aria-hidden': 'true' }, h('i'), h('i'))
  const paths = s('svg', { class: 't38t-paths', 'aria-hidden': 'true' })
  const fx = h('div', { class: 't38t-fx', 'aria-hidden': 'true' })
  const stop = (o: number, c: string, a = 1) => s('stop', { offset: o, style: `stop-color:${c};stop-opacity:${a}` })
  const defs = s('svg', { class: 't38t-defs', width: 0, height: 0, 'aria-hidden': 'true' }, s('defs', null,
    s('radialGradient', { id: 't38t-g-peb', cx: 0.36, cy: 0.3, r: 0.75 }, stop(0, 'var(--rock-hi)'), stop(0.5, 'color-mix(in srgb, var(--rock-hi) 45%, var(--rock-mid))'), stop(1, 'var(--rock-lo)')),
    s('linearGradient', { id: 't38t-g-under', x1: 0, y1: 0, x2: 0.25, y2: 1 }, stop(0, 'var(--umbra)', 0), stop(0.55, 'var(--umbra)', 0.04), stop(1, 'var(--umbra)', 0.42)),
    s('radialGradient', { id: 't38t-g-cast' }, stop(0, 'var(--umbra)', 0.55), stop(1, 'var(--umbra)', 0))))
  const pebs = new Map(K.tasks.map((t, n) => [t.id, h('button', {
    class: 't38t-peb', type: 'button', 'aria-pressed': 'false', 'aria-describedby': keysId, 'aria-label': t.label, 'data-id': t.id,
  }, pebbleArt(3820 + n * 11), h('span', { class: 't38t-full', 'aria-hidden': 'true' }, t.label), h('span', { class: 't38t-short', 'aria-hidden': 'true' }, t.short))]))
  const dents = new Map(K.tasks.map((t) => [t.id, h('i', { class: 't38t-dent', 'aria-hidden': 'true' })]))
  const trayBtns = K.trays.map((t, i) => h('button', { class: 't38t-tray', type: 'button', 'data-id': t.id, onClick: () => sel && put(sel, i) },
    h('span', { class: 't38t-tray-name' }, h('b', { 'aria-hidden': 'true' }, String(i + 1)), t.name)))
  // words in the scene: the stone in hand on a paper tag; with the light, the match on the blind's edge and the
  // editors' note cut into the near tray's face
  const tag = h('p', { class: 't38t-tag', hidden: true })
  const match = h('p', { class: 't38t-match', hidden: true })
  const note = h('div', { class: 't38t-note-face', hidden: true }, ctx.fact(K.expertNote, 'p', 't38t-note'))
  const pull = h('button', { class: 't38t-pull', type: 'button', hidden: true, onClick: compare }, h('span', null, K.compare))
  const blind = h('div', { class: 't38t-blind', 'aria-hidden': 'true' }, h('i', { class: 't38t-slats' }), h('i', { class: 't38t-bar' }))
  const root = h('div', { class: 't38t' },
    h('p', { class: 'visually-hidden' }, K.art),
    h('p', { class: 'visually-hidden', id: keysId }, K.keys),
    defs, cv, warm, ...dents.values(), paths, ...trayBtns, note, rays, ...order.map((i) => pebs.get(ids[i])!), veil, fx, tag, blind, match, h('div', { class: 't38t-cord' }, pull))
  ctx.art.append(root)
  ctx.prompt(fill(K.prompt, { n: 0, total: K.tasks.length }))
  // H1: a dot on the top pebble of the basket until the first throw; then on the curtain's cord when all are placed
  const g = guide(ctx)
  let dot: Mark | null = g.dot(pebs.get(ids[order[0]])!, { dir: [1, -0.4] })

  // ── where each pebble lies now
  function target(id: string): Box {
    if (!G) return { x: 0, y: 0, w: 0, h: 0 }
    const j = compared ? trayOf(K.tasks.find((t) => t.id === id)!.expert) : placed[id] ?? -1
    const lk = look.get(id)!
    if (j < 0) {
      const [x, y] = basketSlots(G)[order.indexOf(ids.indexOf(id))]
      return { x, y, w: G.peb[0] * lk.w, h: G.peb[1] * lk.h }
    }
    const list = compared ? K.tasks.filter((t) => t.expert === K.trays[j].id).map((t) => t.id) : inTray[j]
    const [x, y] = traySlots(G, j, list.length)[list.indexOf(id)]
    const sc = [1, 0.94, 0.88][j]
    return { x, y, w: G.tpeb[0] * sc * (0.94 + (lk.w - 1) * 0.5), h: G.tpeb[1] * sc * (0.96 + (lk.h - 1) * 0.5) }
  }
  function apply(id: string, b: Box) {
    const el = pebs.get(id)!
    pos.set(id, b)
    const j = compared ? trayOf(K.tasks.find((t) => t.id === id)!.expert) : placed[id] ?? -1
    Object.assign(el.style, { left: `${f1(b.x - b.w / 2)}px`, top: `${f1(b.y - b.h / 2)}px`, width: `${f1(b.w)}px`, height: `${f1(b.h)}px`, zIndex: String(10 + Math.round(b.y)), rotate: `${f1(look.get(id)!.rot * (j < 0 ? 1 : 0.35))}deg` })
    el.classList.toggle('in', j >= 0)
    el.dataset.tray = j >= 0 ? K.trays[j].id : ''
  }
  /** move a pebble to its place: thrown in an arc (from where it was let go), or rolled along the dotted path */
  function fly(id: string, from: Box | null, arc: number, dur: number) {
    const el = pebs.get(id)!
    const b = target(id)
    const a = from ?? pos.get(id) ?? b
    apply(id, b)
    if (ctx.reduced || !from && a === b) return Promise.resolve()
    const dx = a.x - b.x, dy = a.y - b.y, sx = a.w / b.w, sy = a.h / b.h
    const anim = el.animate([
      { transform: `translate(${f1(dx)}px, ${f1(dy)}px) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})` },
      { transform: `translate(${f1(dx * 0.45)}px, ${f1(dy * 0.45 - arc)}px) scale(${((sx + 1) / 2).toFixed(3)}, ${((sy + 1) / 2).toFixed(3)})`, offset: 0.5 },
      { transform: 'none' },
    ], { duration: dur, easing: 'cubic-bezier(0.3, 0.1, 0.4, 1)' })
    return anim.finished.then(() => undefined, () => undefined)
  }
  function land(j: number, b: Box) {
    if (ctx.reduced) return
    const kind = K.trays[j].id
    const e = h('i', { class: `t38t-land ${kind}`, style: `left:${f1(b.x)}px;top:${f1(b.y + b.h * 0.3)}px;width:${f1(b.w * 1.4)}px;height:${f1(b.h * 0.9)}px` })
    fx.append(e)
    setTimeout(() => e.remove(), 1400)
    ctx.chime('soft')
  }

  function layout() {
    const W = root.clientWidth
    const H = Math.max(300, stable(ctx.art.clientHeight))
    if (W < 60) return
    root.style.height = `${H}px`
    G = geo(W, H)
    root.classList.toggle('wide', G.wide)
    K.trays.forEach((_, j) => {
      const t = G!.trays[j]
      Object.assign(trayBtns[j].style, { left: `${f1(t.x - t.w / 2)}px`, top: `${f1(t.y - t.h / 2)}px`, width: `${f1(t.w)}px`, height: `${f1(t.h * 1.5)}px` })
      // a beam from the blind down to the tray, its slats; a warm pool on the tray
      const len = t.y + t.h * 0.3 + H * 0.04, dx = len * 0.32
      Object.assign((rays.children[j] as HTMLElement).style, { left: `${f1(t.x - t.w * 0.48)}px`, top: `${f1(t.y + t.h * 0.3 - len)}px`, width: `${f1(t.w * 0.96)}px`, height: `${f1(len)}px`, transform: `rotate(${f1((-Math.atan2(dx, len) * 180) / Math.PI)}deg)` })
      Object.assign((warm.children[j] as HTMLElement).style, { left: `${f1(t.x - t.w * 0.7)}px`, top: `${f1(t.y - t.h * 0.9)}px`, width: `${f1(t.w * 1.4)}px`, height: `${f1(t.h * 2.2)}px` })
    })
    // the editors' note: cut into the near tray's face (wide); on a phone the face is too low, so it hangs under the match
    const t0 = G.trays[0]
    Object.assign(note.style, G.wide
      ? { left: `${f1(t0.x - t0.w * 0.45)}px`, top: `${f1(t0.y + t0.h * 0.5 + 21)}px`, width: `${f1(t0.w * 0.9)}px` }
      : { left: '16px', top: '44px', width: `${f1(W - 32)}px` })
    root.classList.toggle('note-top', !G.wide)
    const ft = G.trays[2]
    Object.assign(veil.style, { left: `${f1(ft.x - ft.w * 0.75)}px`, top: `${f1(ft.y - ft.h * 1.1)}px`, width: `${f1(ft.w * 1.5)}px`, height: `${f1(ft.h * 2.2)}px` })
    ids.forEach((id) => apply(id, target(id)))
    // expert hollows (shown once compared) and, for every pebble that was off, its dotted path
    K.tasks.forEach((t) => {
      const j = trayOf(t.expert)
      const list = K.tasks.filter((x) => x.expert === t.expert).map((x) => x.id)
      const [x, y] = traySlots(G!, j, list.length)[list.indexOf(t.id)]
      const sc = [1, 0.94, 0.88][j]
      Object.assign(dents.get(t.id)!.style, { left: `${f1(x)}px`, top: `${f1(y)}px`, width: `${f1(G!.tpeb[0] * sc * 1.04)}px`, height: `${f1(G!.tpeb[1] * sc * 0.9)}px` })
    })
    drawPaths()
    placeTag()
    job?.cancel()
    if (drawn) return paintScene(fit(cv, W, H, dprOf(ctx.quality === 'low')), p, G!)
    job = sliced((function* () {
      yield
      paintScene(fit(cv, W, H, dprOf(ctx.quality === 'low')), p, G!)
      drawn = true
    })(), { sync: ctx.reduced })
  }
  let job: { cancel(): void } | null = null
  let drawn = false
  let p: Pal = palette()
  ctx.onCleanup(() => job?.cancel())

  /** where a pebble the visitor placed would lie (for the dotted path after compare) */
  const userPlace = (id: string): Pt | null => {
    if (!G) return null
    const j = placed[id]
    if (j == null || j < 0) return null
    return traySlots(G, j, inTray[j].length)[inTray[j].indexOf(id)]
  }
  function drawPaths() {
    if (!G) return
    paths.setAttribute('viewBox', `0 0 ${f1(G.W)} ${f1(G.H)}`)
    if (!compared) return void paths.replaceChildren()
    paths.replaceChildren(...K.tasks.filter((t) => trayOf(t.expert) !== placed[t.id]).flatMap((t) => {
      const a = userPlace(t.id)
      const b = target(t.id)
      if (!a) return []
      const c: Pt = [(a[0] + b.x) / 2, Math.min(a[1], b.y) - G!.H * 0.06]
      return [s('path', { class: 't38t-path', d: `M${f1(a[0])} ${f1(a[1])}Q${f1(c[0])} ${f1(c[1])} ${f1(b.x)} ${f1(b.y)}` }),
        s('ellipse', { class: 't38t-ghost', cx: f1(a[0]), cy: f1(a[1]), rx: f1(G!.tpeb[0] * 0.42), ry: f1(G!.tpeb[1] * 0.4) })]
    }))
  }

  // ── choosing and placing
  let tagFor = ''
  function label() {
    const task = K.tasks.find((t) => t.id === sel)
    trayBtns.forEach((b, i) => b.setAttribute('aria-label', task ? fill(K.pickAria, { task: task.label, tray: K.trays[i].name }) : K.trays[i].name))
    root.dataset.picking = String(!!task)
  }
  /** the paper tag over a stone: its whole name while in hand; with the light, why the experts put it there */
  function say(id: string) {
    const t = K.tasks.find((x) => x.id === id)
    tagFor = t ? id : ''
    tag.hidden = !t
    if (!t) return
    tag.replaceChildren(h('b', null, t.label), compared ? h('span', null, t.why) : '')
    if (!tag.hasAttribute('aria-live')) tag.setAttribute('aria-live', 'polite')
    placeTag()
  }
  function placeTag() {
    const b = tagFor && pos.get(tagFor)
    if (!b || !G) return
    const tw = Math.min(G.wide ? 300 : G.W - 32, 300)
    Object.assign(tag.style, { width: `${f1(tw)}px`, left: `${f1(clamp(b.x - tw / 2, 16, G.W - tw - 16))}px`, top: `${f1(b.y - b.h * 0.55)}px` })
  }
  function choose(id: string) {
    sel = sel === id || compared ? '' : id
    pebs.forEach((b, k) => b.setAttribute('aria-pressed', String(k === sel)))
    say(compared ? id : sel)
    label()
  }
  function put(id: string, j: number, from: Box | null = null) {
    if (compared) return
    const was = placed[id] ?? -1
    if (was >= 0) inTray[was].splice(inTray[was].indexOf(id), 1)
    placed[id] = j
    inTray[j].push(id)
    sel = ''
    pebs.forEach((b) => b.setAttribute('aria-pressed', 'false'))
    label()
    // the others in the tray shuffle over to make room; the pebble flies in
    inTray[j].forEach((o) => o !== id && fly(o, null, 0, 360))
    if (was >= 0) inTray[was].forEach((o) => fly(o, null, 0, 360))
    const dist = from ? Math.hypot(from.x - target(id).x, from.y - target(id).y) : 200
    fly(id, from ?? pos.get(id) ?? null, Math.min(160, 40 + dist * 0.35), from ? 620 : 700).then(() => G && land(j, target(id)))
    pebs.get(id)!.focus({ preventScroll: true })
    say('')
    dot?.done()
    dot = null
    const m = Object.keys(placed).length
    if (m < ids.length) return ctx.prompt(fill(K.prompt, { n: m, total: ids.length }))
    if (!pull.hidden) return
    pull.hidden = false
    ctx.prompt(K.pullPrompt)
    dot = g.dot(pull, { dir: [0, -1] })
  }
  function compare() {
    if (compared) return
    let n = 0
    for (const t of K.tasks) {
      const ok = placed[t.id] === trayOf(t.expert)
      if (ok) n++
      pebs.get(t.id)!.dataset.match = String(ok)
    }
    const from = new Map(ids.map((id) => [id, pos.get(id)!]))
    compared = true
    root.classList.add('lit')
    pull.hidden = true
    match.hidden = false
    match.textContent = fill(K.match, { n, total: ids.length })
    match.setAttribute('aria-live', 'polite')
    note.hidden = false
    sel = ''
    pebs.forEach((b) => b.setAttribute('aria-pressed', 'false'))
    label()
    say('')
    drawPaths()
    // the light comes in through the slats, near tray first; the pebbles that were off roll along their dotted paths
    const wrong = ids.filter((id) => pebs.get(id)!.dataset.match === 'false')
    ids.forEach((id) => {
      if (wrong.includes(id)) apply(id, from.get(id)!)
      else fly(id, from.get(id)!, 0, 600)
    })
    wrong.forEach((id, k) => {
      const t = window.setTimeout(() => fly(id, from.get(id)!, 30, 900), ctx.reduced ? 0 : 900 + k * 260)
      ctx.onCleanup(() => clearTimeout(t))
    })
    ctx.chime('ok')
    dot?.done()
    dot = null
    // the pebbles that were off are lifted one by one with why AI Zen put them elsewhere (2 s each), then the insight
    // (audit 38-4: the reasons come before the conclusion)
    const step = ctx.reduced ? 0 : 2000, t0 = ctx.reduced ? 0 : 1300
    wrong.forEach((id, k) => {
      const t = window.setTimeout(() => say(id), t0 + k * step)
      ctx.onCleanup(() => clearTimeout(t))
    })
    const t = window.setTimeout(() => {
      ctx.insight(K.insight, [K.detail, K.jobs])
      if (wrong.length) ctx.prompt(K.why)
    }, Math.max(ctx.reduced ? 0 : 2900, t0 + wrong.length * step))
    ctx.onCleanup(() => clearTimeout(t))
  }

  // ── pointer: tap to choose, or pick up and throw
  pebs.forEach((el, id) => {
    let start: { x: number; y: number; id: number } | null = null
    let dragging = false
    let moved = false
    let rootRect: DOMRect | null = null
    el.addEventListener('pointerdown', (e) => {
      if (e.button || compared) return
      start = { x: e.clientX, y: e.clientY, id: e.pointerId }
      dragging = false
      el.setPointerCapture(e.pointerId) // a quick flick leaves the pebble before the first move
    })
    el.addEventListener('pointermove', (e) => {
      if (!start || e.pointerId !== start.id) return
      const dx = e.clientX - start.x, dy = e.clientY - start.y
      if (!dragging && Math.hypot(dx, dy) > 7) {
        dragging = true
        el.classList.add('drag')
        rootRect = root.getBoundingClientRect()
      }
      if (dragging) el.style.transform = `translate(${f1(dx)}px, ${f1(dy)}px) scale(1.08)`
    })
    const end = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return
      const was = start
      start = null
      if (!dragging) return
      dragging = false
      moved = true
      el.classList.remove('drag')
      el.style.transform = ''
      const b = pos.get(id)!
      const from: Box = { ...b, x: b.x + e.clientX - was.x, y: b.y + e.clientY - was.y }
      // the tray under the hand, else the nearest one if let go above the basket, else back into the basket
      const x = e.clientX - (rootRect?.left ?? 0), y = e.clientY - (rootRect?.top ?? 0)
      let j = G ? G.trays.findIndex((t) => Math.abs(x - t.x) < t.w * 0.62 && Math.abs(y - t.y) < t.h * 1.1) : -1
      if (j < 0 && G && y < G.basket.y - G.basket.h * 0.5) {
        let best = 1e9
        G.trays.forEach((t, k) => {
          const d = Math.hypot(x - t.x, y - t.y)
          if (d < best) (best = d), (j = k)
        })
      }
      if (j >= 0) put(id, j, from)
      else fly(id, from, 20, 400)
    }
    el.addEventListener('pointerup', end)
    el.addEventListener('pointercancel', end)
    el.addEventListener('click', () => {
      if (moved) return void (moved = false)
      choose(id)
    })
  })
  ctx.onCleanup(onDigit((n) => n <= K.trays.length && sel && put(sel, n - 1)))
  ctx.onCleanup(onSize(ctx.art, layout))
  ctx.onCleanup(onPrefs(() => {
    const q = palette()
    if (q.key === p.key || !G) return
    p = q
    paintScene(fit(cv, G.W, G.H, dprOf(ctx.quality === 'low')), p, G)
  }))
  label()
}
