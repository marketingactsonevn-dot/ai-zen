import './trays.css'
import { fill, h, nextId, s } from '../../core/dom'
import { onPrefs } from '../../core/prefs'
import { sliced } from '../../core/chunk'
import { blob, clamp, curve, onDigit, onSize, rng, seedOf, shuffledIdx, stableHeight, stroke, type Pt } from '../../ui/part2/ink'
import { guide, type Mark } from '../../ui/part2/guide'
import type { SceneCtx } from '../types'
import { C } from './shell'
import { brush, canvas, col, dprOf, fillD, fit, glow, grainOver, inkHills, mistBank, mix, moonDisc, noise, paintRock, palette, sky, type Pal, type RGB } from './ink2d'

const K = C.scenes.trays
const f1 = (n: number) => n.toFixed(1)
type Box = { x: number; y: number; w: number; h: number } // centre and size, px

/**
 * Where everything lies for a stage W × H (the painting runs to the window's edges): the veranda's boards run from the
 * basket (near left) up toward the setting moon (far right); the three trays stand on the boards along that diagonal,
 * each turned to the boards' perspective. Tall: the diagonal becomes a climb, trays staggered left–right, the basket
 * across the foot. A pine bough reaches into the top left, the blind hangs from the eave along the top.
 */
function geo(W: number, H: number) {
  const wide = W / H > 1.05
  const B = (x: number, y: number, w: number, hh: number): Box => ({ x: x * W, y: y * H, w: w * W, h: hh * H })
  const g = wide
    ? {
        trays: [B(0.5, 0.775, 0.3, 0.17), B(0.715, 0.555, 0.22, 0.125), B(0.872, 0.42, 0.155, 0.085)],
        basket: B(0.13, 0.84, 0.25, 0.3),
        peb: [clamp(W * 0.08, 100, 128), clamp(H * 0.075, 44, 50)],
        tpeb: [clamp(W * 0.072, 90, 114), clamp(H * 0.058, 30, 38)],
        edge: [[-0.02, 0.47], [1.02, 0.34]] as Pt[],
        vp: [W * 1.02, H * 0.22] as Pt,
        hz: H * 0.27,
      }
    : {
        trays: [B(0.42, 0.635, 0.66, 0.105), B(0.62, 0.44, 0.54, 0.08), B(0.55, 0.29, 0.44, 0.058)],
        basket: B(0.36, 0.92, 0.72, 0.2),
        peb: [Math.min(W * 0.29, 108), 46],
        tpeb: [Math.min(W * 0.27, 100), clamp(H * 0.05, 28, 32)],
        edge: [[-0.02, 0.255], [1.02, 0.215]] as Pt[],
        vp: [W * 1.05, H * 0.11] as Pt,
        hz: H * 0.165,
      }
  const mr = clamp(H * 0.036, 13, 26)
  const moon: Pt = wide ? [W * 0.905, g.hz - mr * 0.35] : [W * 0.84, g.hz - mr * 0.5]
  const slope = ((g.edge[1][1] - g.edge[0][1]) * H) / ((g.edge[1][0] - g.edge[0][0]) * W)
  return { W, H, wide, ...g, moon, mr, slope, edgeY: (x: number) => (g.edge[0][1] + ((g.edge[1][1] - g.edge[0][1]) * (x / W - g.edge[0][0])) / (g.edge[1][0] - g.edge[0][0])) * H }
}
type Geo = ReturnType<typeof geo>

/** Centres of n pebbles lying in tray j (a staggered grid in its hollow; they overlap a little when crowded). */
function traySlots(G: Geo, j: number, n: number): Pt[] {
  const t = G.trays[j]
  const sc = [1, 0.94, 0.88][j]
  const pw = G.tpeb[0] * sc, ph = G.tpeb[1] * sc
  const iw = t.w * 0.8, ih = t.h * 0.62
  const cols = Math.max(Math.min(n, 2), Math.min(n, Math.floor(iw / (pw * 0.92))))
  const rows = Math.ceil(n / cols)
  const dx = Math.min(pw * 1.04, iw / cols), dy = Math.min(ph * 1.1, (ih - ph * 0.3) / Math.max(1, rows - 1 || 1))
  return Array.from({ length: n }, (_, k) => {
    const c = k % cols, r = Math.floor(k / cols)
    const inRow = r === rows - 1 ? n - r * cols : cols
    const x = t.x + (c - (inRow - 1) / 2) * dx + (r % 2 ? dx * 0.12 : 0)
    return [x, t.y - t.h * 0.04 + (r - (rows - 1) / 2) * (rows > 1 ? dy : 0) + (x - t.x) * G.slope] as Pt
  })
}
/** The eight places in the basket: a loose heap in its mouth, stones leaning on each other (stable per layout). */
const HEAP: Pt[] = [[-0.66, -0.56], [0.04, -0.64], [0.7, -0.5], [-0.42, 0.04], [0.3, 0.02], [0.92, 0.12], [-0.08, 0.62], [0.62, 0.68]]
const HEAP_TALL: Pt[] = [[-1, -0.7], [0, -0.76], [1, -0.66], [-0.9, 0.02], [0.08, -0.02], [1.02, 0.06], [-0.48, 0.74], [0.52, 0.7]]
function basketSlots(G: Geo): Pt[] {
  const b = G.basket
  const mx = b.x + (G.wide ? b.w * 0.04 : 0), my = b.y - b.h * (G.wide ? 0.16 : 0.12)
  const rx = b.w * (G.wide ? 0.4 : 0.3), ry = b.h * (G.wide ? 0.3 : 0.34)
  const r = rng(3801)
  return (G.wide ? HEAP : HEAP_TALL).map(([u, v]) => [mx + (u + (r() - 0.5) * 0.06) * rx, my + (v + (r() - 0.5) * 0.06) * ry] as Pt)
}

/** granite speckle over a region already clipped */
function speckle(g: CanvasRenderingContext2D, p: Pal, x: number, y: number, w: number, hh: number, n: number, r: () => number, k = 1) {
  for (let i = 0; i < n; i++) {
    const gx = x + r() * w, gy = y + r() * hh
    g.fillStyle = r() < 0.55 ? col(p.umbra, (p.dark ? 0.45 : 0.22) * k) : p.dark ? col(p.moon, 0.1 * k) : col(p['rake-hi'], 0.75 * k)
    g.fillRect(gx, gy, 0.9 + r() * 1.4, 0.8 + r() * 0.8)
  }
}
const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

/**
 * A tray standing on the boards, turned to their perspective (long sides along the veranda's edge, the far side a little
 * narrower). Its top lies at (x, y); its wall drops `fh` to the boards on the near side (we look along the boards toward
 * the moon, so the near wall is in shade and only the far rim catches the light). Three materials, three heights:
 * good = a low block of hewn granite, irregular and chipped, raked dry gravel in its hollow · learning = a wooden tray
 * of four mitred boards on two runners, pegged at the corners, flooded, the setting moon broken in its water · far = a
 * low, soft stone tray grown over with moss, fog to the brim.
 */
function paintTray(g: CanvasRenderingContext2D, p: Pal, G: Geo, t: Box, kind: string, seed: number) {
  const r = rng(seed)
  const { x, y, w, h: d } = t
  const sl = G.slope
  const wood = kind === 'learning', fog = kind === 'far' ? 1 : 0, stone = kind === 'good'
  /** (u, v) in −1…1 on the tray's top (v −1 far … 1 near) → screen */
  const P = (u: number, v: number, drop = 0): Pt => {
    const k = (1 - v) / 2
    return [x + ((u * w) / 2) * (1 - 0.08 * k) + w * 0.03 * k, y + (v * d) / 2 + ((u * w) / 2) * sl + drop]
  }
  const fh = d * (stone ? 0.46 : wood ? 0.3 : 0.16)
  const feet = wood ? d * 0.2 : 0
  // the outline: a rounded rectangle (wood: crisp), hewn stone wobbles and has chips bitten out of its rim
  const N = 72
  const ex = wood ? 14 : stone ? 5 : 3.4
  const amp = wood ? 0 : stone ? 0.035 : 0.05
  const chips = stone ? [0.9, 2.3, 4.1, 5.2].map((c) => c + r() * 0.3) : []
  const ring = (mu: number, mv: number, a2 = amp) => Array.from({ length: N }, (_, i) => {
    const th = (i / N) * Math.PI * 2
    const c = Math.cos(th), sn = Math.sin(th)
    let m = 1 + a2 * noise(th * 3.1, seed) + a2 * 0.5 * noise(th * 9.3, seed + 3)
    for (const ch of chips) m -= 0.045 * Math.max(0, 1 - Math.abs(((th - ch + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * 9)
    return [Math.sign(c) * Math.pow(Math.abs(c), 2 / ex) * mu * m, Math.sign(sn) * Math.pow(Math.abs(sn), 2 / ex) * mv * m] as Pt
  })
  const outer = ring(1, 1)
  const path = (uv: Pt[], drop = 0) => {
    const q = new Path2D()
    uv.forEach(([u, v], i) => (i ? q.lineTo(...P(u, v, drop)) : q.moveTo(...P(u, v, drop))))
    q.closePath()
    return q
  }
  const woodC = p.dark ? mix(p['step-lo'], p.lantern, 0.16) : mix(p['step-mid'], p.lantern, 0.22)
  const hi = wood ? mix(woodC, p.dark ? p['step-hi'] : p['rake-hi'], 0.4) : fog ? mix(p['rock-mid'], p['moss-c'], 0.3) : mix(p['rock-hi'], p['rock-mid'], p.dark ? 0.5 : 0.55)
  const mid = wood ? woodC : mix(p['rock-mid'], p['rock-lo'], p.dark ? 0.35 : 0.3)
  const lo = wood ? mix(woodC, p.umbra, 0.6) : mix(p['rock-lo'], p.umbra, p.dark ? 0.4 : 0.5)
  const veil = (c: RGB) => (fog ? mix(c, p.dark ? mix(p.paper, p.mist, 0.25) : p.mist, p.dark ? 0.5 : 0.55) : c)
  const base = fh + feet
  // shadows on the boards: the long one toward the near left (away from the moon), then the dark line of contact
  glow(g, ...P(-0.35, 1, base + d * 0.12), w * 0.66, d * 0.36, p.umbra, (p.dark ? 0.7 : 0.32) * (1 - fog * 0.4), 0.5)
  if (wood) for (const u of [-0.72, 0.72]) glow(g, ...P(u, 0.75, base + 1), w * 0.12, d * 0.06, p.umbra, p.dark ? 0.95 : 0.6, 0.5)
  else {
    g.fillStyle = col(p.umbra, (p.dark ? 0.6 : 0.3) * (1 - fog * 0.4))
    g.fill(path(ring(1.03, 1.06), base + 1.5))
  }
  if (wood) {
    // two runners under the tray, a shadowed gap between it and the boards
    g.fillStyle = col(p.umbra, p.dark ? 0.55 : 0.28)
    g.fill(path(ring(0.98, 0.98), base))
    for (const u of [-0.72, 0.72]) {
      const a = P(u - 0.07, 1, fh), b2 = P(u + 0.07, 1, fh)
      const rg2 = g.createLinearGradient(a[0], 0, b2[0], 0)
      rg2.addColorStop(0, col(mix(woodC, p.umbra, 0.65)))
      rg2.addColorStop(1, col(mix(woodC, p.umbra, 0.4)))
      g.fillStyle = rg2
      g.fillRect(a[0], a[1] - 1, b2[0] - a[0], feet + 1)
      const c2 = P(u - 0.07, -0.6, fh)
      g.fillStyle = col(mix(woodC, p.umbra, 0.7))
      g.fillRect(c2[0], c2[1], a[0] - c2[0] + 1.5, a[1] - c2[1] + feet)
    }
  }
  // the wall: the near half of the outline, from the top edge down to the base, in shade, lighter toward the moon (right)
  const front = outer.filter(([, v]) => v >= -0.05).sort((A, B) => A[0] - B[0])
  const wall = new Path2D()
  front.forEach(([u, v], i) => (i ? wall.lineTo(...P(u, v)) : wall.moveTo(...P(u, v))))
  for (let i = front.length - 1; i >= 0; i--) {
    const [u, v] = front[i]
    wall.lineTo(...P(u, v, fh + (stone ? noise(u * 7, seed + 9) * d * 0.02 : 0)))
  }
  wall.closePath()
  const L0 = P(-1, 1), R0 = P(1, 1)
  const wg = g.createLinearGradient(L0[0], 0, R0[0], 0)
  wg.addColorStop(0, col(veil(mix(lo, p.umbra, 0.2))))
  wg.addColorStop(0.7, col(veil(lo)))
  wg.addColorStop(1, col(veil(mix(mid, lo, 0.5))))
  g.fillStyle = wg
  g.fill(wall)
  g.save()
  g.clip(wall)
  if (stone) {
    speckle(g, p, L0[0], L0[1] - d, w, fh + d * 1.5, Math.min(420, (w * fh) / (p.dark ? 20 : 40)), r, p.dark ? 0.9 : 0.5)
    // tool marks: short parallel strokes hewn across the face, strata, a darker foot
    for (let i = 0; i < 40; i++) {
      const q = P(-1 + r() * 2, 1, fh * (0.1 + r() * 0.8))
      brush(g, [q, [q[0] + w * 0.012, q[1] + fh * (0.12 + r() * 0.12)]], 0.8 + r() * 0.8, col(p.dark ? p.umbra : p.wash, p.dark ? 0.55 : 0.24), 0.3, 0.4, 0.15)
    }
    for (const k of [0.38, 0.7]) brush(g, [P(-1, 1, fh * k), P(0, 1, fh * k + 1), P(1, 1, fh * k)], 0.9, col(p.dark ? p.umbra : p.wash, p.dark ? 0.4 : 0.15), 0.4, 0.4, 0.1)
  } else if (wood) {
    // the near board: grain along it, a seam where two boards are joined, pegs at the corners
    for (let i = 0; i < 16; i++) {
      const v0 = r(), a0 = -1 + r() * 1.6
      brush(g, [P(a0, 1, fh * v0), P(a0 + 0.25 + r() * 0.3, 1, fh * v0 + (r() - 0.5) * 1.5)], 0.6, col(p.dark ? p.umbra : p.wash, p.dark ? 0.45 : 0.2), 0.3, 0.3, 0.2)
    }
    brush(g, [P(-1, 1, fh * 0.5), P(1, 1, fh * 0.5)], 1, col(p.umbra, p.dark ? 0.7 : 0.4), 0.05, 0.05, 0.5)
    for (const u of [-0.93, 0.93]) {
      brush(g, [P(u, 1, 1), P(u, 1, fh - 1)], 1.2, col(p.umbra, 0.65), 0.05, 0.05, 0.5)
      for (const k of [0.28, 0.72]) {
        g.fillStyle = col(p.umbra, 0.7)
        g.beginPath()
        g.arc(...P(u * 0.97, 1, fh * k), 1.5, 0, Math.PI * 2)
        g.fill()
      }
    }
  }
  const sh = g.createLinearGradient(0, L0[1], 0, L0[1] + fh)
  sh.addColorStop(0, col(p.umbra, 0))
  sh.addColorStop(1, col(p.umbra, (p.dark ? 0.45 : 0.28) * (1 - fog * 0.5)))
  g.fillStyle = sh
  g.fillRect(L0[0] - 4, Math.min(L0[1], R0[1]) - d * 0.2, w + 8, fh + d)
  g.restore()
  // the top: the rim all round, lit toward the far edge
  const top = path(outer)
  const tg = g.createLinearGradient(0, P(0, -1)[1], 0, P(0, 1)[1])
  tg.addColorStop(0, col(veil(hi)))
  tg.addColorStop(1, col(veil(mix(mid, lo, 0.2))))
  g.fillStyle = tg
  g.fill(top)
  g.save()
  g.clip(top)
  if (stone) speckle(g, p, L0[0], P(0, -1)[1] - 4, w, d + 8, Math.min(320, (w * d) / (p.dark ? 22 : 50)), r, p.dark ? 1 : 0.5)
  if (wood) {
    // four mitred boards: a diagonal joint at each corner, grain running along each board
    for (const [cu, cv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) brush(g, [P(cu, cv), P(cu * 0.86, cv * 0.62)], 1, col(p.umbra, p.dark ? 0.75 : 0.45), 0.05, 0.05, 0.5)
    for (let i = 0; i < 14; i++) {
      const v0 = r() < 0.5 ? -0.85 - r() * 0.1 : 0.82 + r() * 0.12, a0 = -0.8 + r() * 1.2
      brush(g, [P(a0, v0), P(a0 + 0.3 + r() * 0.3, v0)], 0.55, col(p.umbra, p.dark ? 0.4 : 0.2), 0.3, 0.3, 0.2)
    }
  }
  g.restore()
  // the hollow, inset by the rim's thickness
  const tk = Math.max(5, Math.min(w, d * 2.4) * (wood ? 0.055 : stone ? 0.07 : 0.05))
  const inner = ring(1 - (2 * tk) / w, 1 - (2.2 * tk) / d, amp * 0.6)
  const hp = path(inner)
  const bx = P(-1, 0)[0], by = P(0, -1)[1] - Math.abs(w * sl), bw = w * 1.05, bh = d + Math.abs(w * sl) * 2
  g.save()
  g.clip(hp)
  const sand = p.dark ? mix(p['rock-lo'], p['step-mid'], 0.4) : mix(p['step-mid'], p['rock-mid'], 0.5)
  g.fillStyle = col(veil(fog ? mix(p['moss-b'], p['rock-mid'], 0.4) : sand))
  g.fillRect(bx - 4, by - 4, bw + 8, bh + 8)
  const rake = (v0: number, v1: number, n: number) => {
    for (let k = 1; k < n; k++) {
      const v = v0 + ((v1 - v0) * k) / n
      const pts: Pt[] = Array.from({ length: 18 }, (_, i) => {
        const q = P(-1 + (2 * i) / 17, v)
        return [q[0], q[1] + Math.sin(i * 0.9 + k) * 0.8] as Pt
      })
      brush(g, pts.map(([a2, b2]) => [a2, b2 + 0.8] as Pt), 1.1, col(p.dark ? p.umbra : p.wash, (p.dark ? 0.55 : 0.24) * (1 - fog * 0.7)), 0.1, 0.1, 0.3)
      brush(g, pts, 0.8, p.dark ? col(p.moon, 0.2 * (1 - fog * 0.7)) : col(p['rake-hi'], 0.95 * (1 - fog * 0.7)), 0.1, 0.1, 0.3)
    }
  }
  if (stone) {
    speckle(g, p, bx, by, bw, bh, Math.min(600, (bw * bh) / (p.dark ? 24 : 48)), r, p.dark ? 1 : 0.5)
    rake(-0.95, 0.95, 9)
    // a stone left standing in the gravel, rings raked round it
    const sc = P(0.55, -0.15)
    for (let k = 2; k >= 1; k--) {
      g.beginPath()
      g.ellipse(sc[0], sc[1] + 1, d * 0.12 * k + 4, d * 0.05 * k + 2, Math.atan(sl), 0, Math.PI * 2)
      g.lineWidth = 3
      g.strokeStyle = col(sand)
      g.stroke()
      g.lineWidth = 0.9
      g.strokeStyle = p.dark ? col(p.moon, 0.2) : col(p['rake-hi'], 0.9)
      g.stroke()
    }
    fillD(g, blob(sc[0], sc[1] - d * 0.04, d * 0.1, d * 0.07, seed + 11, 0.2, 14), col(mix(p['rock-mid'], p.umbra, 0.3)))
    fillD(g, blob(sc[0] + d * 0.02, sc[1] - d * 0.08, d * 0.05, d * 0.025, seed + 12, 0.3, 10), p.dark ? col(p.moon, 0.35) : col(p['rake-hi'], 0.8))
  } else if (wood) {
    rake(-0.92, -0.45, 3)
    const WL = P(-1, -0.42), WR = P(1, -0.42)
    const water = new Path2D()
    water.moveTo(...WL)
    for (let i = 1; i <= 12; i++) water.lineTo(WL[0] + ((WR[0] - WL[0]) * i) / 12, WL[1] + ((WR[1] - WL[1]) * i) / 12 + Math.sin(i * 1.4) * 0.7)
    water.lineTo(...P(1.1, 1.2))
    water.lineTo(...P(-1.1, 1.2))
    water.closePath()
    const wgr = g.createLinearGradient(0, WL[1], 0, P(0, 1)[1])
    wgr.addColorStop(0, col(mix(p.water, p.dark ? p.paper : p.mist, 0.25)))
    wgr.addColorStop(1, col(mix(p.water, p.umbra, p.dark ? 0.35 : 0.2)))
    g.fillStyle = wgr
    g.fill(water)
    g.save()
    g.clip(water)
    // the far boards upside down in it (dark, broken), the moon's road under the moon's side, a ring or two
    for (let k = 0; k < 4; k++) brush(g, [P(-0.9 + r() * 0.2, -0.36 + k * 0.08), P(0.1 + r() * 0.8, -0.36 + k * 0.08)], 1.6, col(p.umbra, p.dark ? 0.55 : 0.3), 0.3, 0.3, 0.1)
    for (let k = 0; k < 9; k++) {
      const v = -0.3 + k * 0.14, q = P(0.62, v)
      const len = w * (0.02 + (k / 9) * 0.06) * (0.7 + r() * 0.6)
      brush(g, [[q[0] - len + (r() - 0.5) * 4, q[1]], [q[0] + len * 0.6, q[1] + 0.4]], 0.9 + k * 0.13, col(p.moon, (p.dark ? 0.75 : 0.85) * (1 - k * 0.075)), 0.3, 0.3, 0.1)
    }
    for (let k = 0; k < 2; k++) {
      const q = P(-0.25, 0.35)
      g.beginPath()
      g.ellipse(q[0], q[1], w * (0.06 + k * 0.05), d * (0.06 + k * 0.04), Math.atan(sl), 0, Math.PI * 2)
      g.strokeStyle = p.dark ? col(p.moon, 0.28 - k * 0.1) : col(p['rake-hi'], 0.85 - k * 0.3)
      g.lineWidth = 0.9
      g.stroke()
    }
    g.restore()
    brush(g, [WL, WR], 1.2, p.dark ? col(p.moon, 0.35) : col(p['rake-hi'], 0.95), 0.1, 0.1, 0.3)
  } else {
    // moss and a few pebbles under the fog
    for (let i = 0; i < 9; i++) fillD(g, blob(...P(-0.8 + r() * 1.6, -0.6 + r() * 1.2), w * (0.05 + r() * 0.06), d * (0.08 + r() * 0.08), seed + 40 + i, 0.4, 12), col(p['moss-a'], 0.35))
  }
  // the inner far wall in shade
  const ig = g.createLinearGradient(0, P(0, -1)[1], 0, P(0, -0.2)[1])
  ig.addColorStop(0, col(p.umbra, (p.dark ? 0.6 : 0.32) * (1 - fog * 0.5)))
  ig.addColorStop(1, col(p.umbra, 0))
  g.fillStyle = ig
  g.fillRect(bx - 4, by - 4, bw + 8, bh)
  g.restore()
  // the hollow's lip: its far inner edge in shade, its near inner edge catching the light
  const inFar = inner.filter(([, v]) => v < -0.2).sort((A, B) => A[0] - B[0]).map(([u, v]) => P(u, v))
  const inNear = inner.filter(([, v]) => v > 0.2).sort((A, B) => A[0] - B[0]).map(([u, v]) => P(u, v))
  brush(g, inFar, 1.6, col(p.umbra, (p.dark ? 0.7 : 0.4) * (1 - fog * 0.5)), 0.15, 0.15, 0.3)
  brush(g, inNear, 1.2, p.dark ? col(p.moon, 0.3 * (1 - fog * 0.5)) : col(p['rake-hi'], 0.9), 0.15, 0.15, 0.3)
  // edges: the far rim lit by the moon behind, the near lip's chamfer, the wall's foot; moss
  const lit = (a: number) => (p.dark ? col(p.moon, a * (1 - fog * 0.4)) : col(p['rake-hi'], 1 - fog * 0.3))
  const far = outer.filter(([, v]) => v < -0.4).sort((A, B) => A[0] - B[0]).map(([u, v]) => P(u, v))
  brush(g, far, 1.8, lit(0.55), 0.2, 0.2, 0.2)
  brush(g, front.map(([u, v]) => P(u, v, 1)), 1.3, lit(0.28), 0.15, 0.15, 0.3)
  brush(g, front.map(([u, v]) => P(u, v, fh)), 1.8, col(p.dark ? p.umbra : p.wash, (p.dark ? 0.8 : 0.45) * (1 - fog * 0.5)), 0.1, 0.1, 0.4)
  if (stone) {
    fillD(g, blob(...P(-0.94, 0.8), w * 0.04, d * 0.1, seed + 30, 0.35, 12), col(p['moss-b'], 0.85))
    fillD(g, blob(...P(-0.95, 1, fh * 0.6), w * 0.02, fh * 0.35, seed + 31, 0.35, 10), col(p['moss-a'], 0.8))
    for (let i = 0; i < 7; i++) {
      const q = P(0.86 + r() * 0.08, 1, fh + 1)
      brush(g, [q, [q[0] + (r() - 0.3) * d * 0.15, q[1] - d * (0.12 + r() * 0.16)]], 1.1, col(p['moss-b'], 0.9), 0.1, 0.6, 0.1)
    }
  }
  if (fog) {
    // moss over the low rim all round, then the fog to the brim; only the far rim's light still reads
    for (let i = 0; i < 16; i++) {
      const [u, v] = outer[Math.floor(r() * N)]
      fillD(g, blob(...P(u * 0.97, v * 0.97), w * (0.03 + r() * 0.04), d * (0.06 + r() * 0.06), seed + 60 + i, 0.4, 10), col(veil(p['moss-b']), 0.85))
    }
    for (let k = 0; k < 4; k++) mistBank(g, p, x - w * 0.35 + k * w * 0.25, y + (k % 2 ? d * 0.25 : -d * 0.1), w * 0.4, d * 0.7, 1.8)
    brush(g, far, 1.6, lit(0.45), 0.2, 0.2, 0.2)
  }
  const NL = P(-0.75, 1), NR = P(0.75, 1)
  return { NL, NR, fh }
}

/** The rattan basket: a cylinder of woven cane (over-under strips between stakes), a thick wrapped rim lit on top, the
 *  woven inside, the handle arching behind (low on a phone), its shadow on the boards. */
function paintBasket(g: CanvasRenderingContext2D, p: Pal, b: Box, seed: number, wide: boolean) {
  const r = rng(seed)
  const cane = p.dark ? mix(p['step-lo'], p.lantern, 0.24) : mix(p['step-mid'], p.lantern, 0.34)
  const caneHi = mix(cane, p.dark ? p['step-hi'] : p['rake-hi'], p.dark ? 0.35 : 0.5)
  const caneD = mix(cane, p.umbra, 0.5)
  const mx = b.x, my = b.y - b.h * 0.14, rx = b.w * 0.5, ry = b.h * 0.36
  const bot = b.y + b.h
  const arch = wide ? 2.4 : 1.25
  // the handle arching behind, the shadow on the boards (toward the near left: the moon is far right)
  brush(g, curve([mx - rx * 0.86, my - ry * 0.2], [mx, my - ry * arch], [mx + rx * 0.86, my - ry * 0.2], 30), Math.max(6, b.w * 0.026), col(caneD), 0.02, 0.02, 0.8)
  brush(g, curve([mx - rx * 0.8, my - ry * 0.4], [mx - rx * 0.05, my - ry * (arch - 0.15)], [mx + rx * 0.6, my - ry * 0.9], 24), Math.max(1.4, b.w * 0.005), p.dark ? col(p.moon, 0.25) : col(p['rake-hi'], 0.8), 0.3, 0.3, 0.1)
  glow(g, mx - rx * 0.3, b.y + b.h * 0.42, rx * 1.3, ry * 0.6, p.umbra, p.dark ? 0.75 : 0.36, 0.5)
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
      const lit = 0.5 + 0.5 * Math.cos((a0 + a1) / 2 - Math.PI * 0.3) // lit toward the right (the moon)
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
  const sh = g.createLinearGradient(mx - rx, 0, mx + rx, 0)
  sh.addColorStop(0, col(p.umbra, p.dark ? 0.7 : 0.45))
  sh.addColorStop(0.38, col(p.umbra, 0.04))
  sh.addColorStop(0.7, col(p.umbra, 0))
  sh.addColorStop(1, col(p.umbra, p.dark ? 0.45 : 0.25))
  g.fillStyle = sh
  g.fillRect(mx - rx, my, rx * 2, bot - my)
  g.restore()
  // the mouth: the far inside wall woven and catching a little light, a woven floor (not a hole)
  const mouth = new Path2D()
  mouth.ellipse(mx, my, rx * 0.93, ry * 0.86, 0, 0, Math.PI * 2)
  const mg = g.createLinearGradient(0, my - ry, 0, my + ry)
  mg.addColorStop(0, col(mix(cane, p.umbra, 0.22)))
  mg.addColorStop(0.55, col(mix(cane, p.umbra, p.dark ? 0.45 : 0.32)))
  mg.addColorStop(1, col(mix(cane, p.umbra, p.dark ? 0.55 : 0.4)))
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
      fillD(g, `M${f1(xa)} ${f1(ya)}L${f1(xb)} ${f1(yb)}L${f1(xb)} ${f1(yb + ry * 0.09)}L${f1(xa)} ${f1(ya + ry * 0.09)}Z`, col(mix(cane, p.umbra, 0.2 + k * 0.08), 0.8))
    }
  }
  // the floor: a coiled weave, in shade toward the near wall
  for (let k = 1; k < 7; k++) {
    g.beginPath()
    g.ellipse(mx, my + ry * 0.32, rx * 0.12 * k, ry * 0.07 * k, 0, 0, Math.PI * 2)
    g.strokeStyle = col(mix(cane, p.umbra, 0.6), 0.5)
    g.lineWidth = 1.2
    g.stroke()
  }
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
  brush(g, curve([mx - rx * 0.4, my - ry * 0.95], [mx + rx * 0.4, my - ry * 1.02], [mx + rx * 0.95, my - ry * 0.2], 18), Math.max(1.6, rw * 0.28), p.dark ? col(p.moon, 0.4) : col(p['rake-hi'], 1), 0.3, 0.3, 0.1)
}

/** A pine bough reaching into the top left from a trunk beyond the frame: a limb, twigs, pads of needles, the moon's
 *  rim on their right edges. */
function bough(g: CanvasRenderingContext2D, p: Pal, G: Geo) {
  const { W, H, wide } = G
  const ink = p.dark ? mix(p['moss-b'], p.umbra, 0.62) : mix(p.wash, p.umbra, 0.2)
  const rimC = p.dark ? col(p.moon, 0.42) : col(p['rake-hi'], 0.9)
  const y0 = H * (wide ? 0.19 : 0.12)
  const limb = curve([-W * 0.03, y0 - H * 0.04], [W * (wide ? 0.12 : 0.2), y0 - H * 0.035], [W * (wide ? 0.29 : 0.46), y0 + H * 0.035], 26)
  brush(g, limb, wide ? 13 : 8, col(ink, 0.95), 0.05, 0.85, 0.25)
  brush(g, limb.map(([x, y]) => [x + 1, y - (wide ? 4 : 2.5)] as Pt).slice(2), 1.4, rimC, 0.1, 0.5, 0.2)
  /** a pad of needles: a dense fan (a dark mass with a needled fringe), the moon catching its right-hand tips */
  const pad = (cx: number, cy: number, rx: number, ry: number, seed: number) => {
    const q = rng(seed)
    fillD(g, blob(cx, cy - ry * 0.1, rx * 0.6, ry * 0.22, seed, 0.3, 16), col(ink, 0.6))
    let dk = '', lt = ''
    for (let i = 0; i < 96; i++) {
      const a = Math.PI * (1.08 + q() * 0.84), len = rx * (0.4 + q() * 0.5)
      const bx = cx + Math.cos(a) * rx * 0.25, by = cy + Math.sin(a) * ry * 0.1
      const seg = stroke([[bx, by], [bx + Math.cos(a) * len, by + Math.sin(a) * len * (ry / rx)]], wide ? 1.7 : 1.3, 0.15, 0.6, 0.1)
      if (Math.cos(a) > 0.25 && q() < 0.45) lt += seg
      else dk += seg
    }
    fillD(g, dk, col(ink, 0.95))
    fillD(g, lt, rimC)
  }
  const twigs: [number, number, number][] = wide ? [[0.3, -1, 1], [0.5, 1, 0.8], [0.68, -1, 1.1], [0.86, 1, 0.9], [1, -1, 0.8]] : [[0.35, -1, 1], [0.6, 1, 0.8], [0.85, -1, 1], [1, 1, 0.8]]
  const s0 = wide ? H * 0.07 : W * 0.085
  twigs.forEach(([t, side, k], i) => {
    const [bx, by] = limb[Math.round(t * (limb.length - 1))]
    const tx = bx + s0 * 0.9 * k, ty = by + side * s0 * 0.55 * k - s0 * 0.3
    brush(g, [[bx, by], [(bx + tx) / 2, (by + ty) / 2 - 3], [tx, ty]], wide ? 3.2 : 2.2, col(ink, 0.9), 0.1, 0.6, 0.2)
    pad(tx, ty, s0 * 1.25 * k, s0 * 0.8 * k, 3812 + i)
  })
}

/** The veranda's two eave posts at the frame's edges, near and dark (the lintel and blind hang between them, the boards
 *  run on under them); their inner edges catch the moon; a brace at each top. */
function posts(g: CanvasRenderingContext2D, p: Pal, G: Geo) {
  const { W, H, wide } = G
  const pw = wide ? W * 0.026 : W * 0.035
  const wood = p.dark ? mix(p['step-lo'], p.umbra, 0.55) : mix(p['step-lo'], p.wash, 0.45)
  const top = Math.max(52, H * (wide ? 0.115 : 0.095)) * 0.3
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? -2 : W - pw + 2
    const lg = g.createLinearGradient(x0, 0, x0 + pw, 0)
    lg.addColorStop(0, col(side < 0 ? mix(wood, p.umbra, 0.3) : wood))
    lg.addColorStop(1, col(side < 0 ? wood : mix(wood, p.umbra, 0.3)))
    g.fillStyle = lg
    g.fillRect(x0, 0, pw, H)
    const r = rng(side < 0 ? 3816 : 3817)
    for (let i = 0; i < 9; i++) {
      const gx = x0 + pw * (0.15 + r() * 0.7)
      brush(g, [[gx, H * r()], [gx + (r() - 0.5) * 2, H * (0.1 + r() * 0.9)]], 0.7, col(p.umbra, p.dark ? 0.5 : 0.25), 0.3, 0.3, 0.2)
    }
    const ie = side < 0 ? x0 + pw - 1 : x0 + 1
    brush(g, [[ie, top], [ie, H]], 1.4, p.dark ? col(p.moon, 0.3) : col(p['rake-hi'], 0.7), 0.05, 0.05, 0.5)
    // the brace: a short diagonal from the post up into the lintel
    const bx = side < 0 ? x0 + pw : x0, bl = pw * 2.6
    fillD(g, stroke([[bx, top + bl], [bx - side * bl, top - 2]], pw * 0.42, 0.05, 0.05, 0.8), col(wood))
  }
}

/** The whole back painting: dawn sky, the moon going down beyond the far tray, the pond, the veranda's boards with grain,
 *  the trays and the basket, the bough. Returns where each tray's near face is (for the names cut into it). */
function paintScene(g: CanvasRenderingContext2D, p: Pal, G: Geo) {
  const { W, H, hz } = G
  sky(g, p, W, H, hz, W * 0.06, 0.8)
  inkHills(g, p, -W * 0.05, W * 1.05, hz + 2, H * 0.1, 3896, 0.92, 7)
  mistBank(g, p, W * 0.5, hz + 2, W * 0.7, H * 0.05, 1)
  const [mx, my] = G.moon
  moonDisc(g, p, mx, my, G.mr, 3895, 1.3)
  // the pond beyond the veranda: water darker than the sky, the moon's broken road, mist toward the far end
  const e0 = G.edgeY(0), e1 = G.edgeY(W)
  const wg = g.createLinearGradient(0, hz, 0, Math.max(e0, e1))
  wg.addColorStop(0, col(mix(p.water, p.dark ? p.paper : p.mist, 0.3)))
  wg.addColorStop(1, col(mix(p.water, p.umbra, p.dark ? 0.3 : 0.15)))
  g.fillStyle = wg
  g.beginPath()
  g.moveTo(0, hz + H * 0.008)
  g.lineTo(W, hz + H * 0.008)
  g.lineTo(W, e1 + 2)
  g.lineTo(0, e0 + 2)
  g.closePath()
  g.fill()
  for (let k = 0; k < 10; k++) {
    const yy = hz + H * 0.014 + ((Math.max(e0, e1) - hz) * Math.pow(k / 10, 1.3))
    const len = W * (0.012 + k * 0.008)
    brush(g, [[mx - len, yy], [mx + len * 0.6, yy + 0.5]], 0.8 + k * 0.15, col(p.moon, (p.dark ? 0.55 : 0.75) * (1 - k * 0.07)), 0.3, 0.3, 0.1)
  }
  // dawn low in the east (left): a raking warm line along the far shore, under the hills
  const dw: RGB = [p.dawn[0], p.dawn[1], p.dawn[2], 1]
  glow(g, W * 0.1, hz + H * 0.004, W * 0.34, H * 0.012, dw, p.dark ? 0.45 : 0.7, 0.5)
  mistBank(g, p, W * 0.25, hz + H * 0.04, W * 0.35, H * 0.035, 1)
  // the veranda: warm boards fanning from the far right toward us, with grain, knots, a damp stain or two
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
  for (let i = 1; i < 18; i++) {
    const t = i / 17
    const end: Pt = [W * 1.05 - W * 2.1 * Math.pow(t, 1.2), H + 4]
    brush(g, [vp, end], 0.6 + t * 1.8, col(p.dark ? p.umbra : p.wash, p.dark ? 0.45 : 0.18), 0.05, 0.05, 0.6)
    brush(g, [[vp[0], vp[1] + 1], [end[0] + 2.5, end[1]]], 0.4 + t * 0.7, p.dark ? col(p.moon, 0.05) : col(p['rake-hi'], 0.5), 0.05, 0.05, 0.6)
    for (let k = 0; k < 6; k++) {
      const t0 = 0.3 + r() * 0.65, t1 = t0 + 0.03 + r() * 0.06
      const e2: Pt = [end[0] + W * 0.05 * (1 + t), end[1]]
      brush(g, [lerp(vp, e2, t0), lerp(vp, e2, t1)], 0.5 + t, col(p.dark ? p.umbra : p.wash, p.dark ? 0.22 : 0.08), 0.3, 0.3, 0.2)
    }
    if (r() < 0.45) {
      // a knot: an eye of rings in the grain
      const at = lerp(vp, [end[0] + W * 0.05 * (1 + t), end[1]], 0.45 + r() * 0.5)
      const kr = 2 + t * 5
      for (let q = 0; q < 3; q++) {
        g.beginPath()
        g.ellipse(at[0], at[1], kr * (1 + q * 0.7), kr * (0.4 + q * 0.25), -0.4, 0, Math.PI * 2)
        g.strokeStyle = col(p.dark ? p.umbra : p.wash, (p.dark ? 0.4 : 0.14) / (q + 1))
        g.lineWidth = 0.9
        g.stroke()
      }
    }
  }
  // damp stains and the moon's sheen on the far boards
  glow(g, W * 0.32, H * 0.62, W * 0.08, H * 0.04, p.umbra, p.dark ? 0.25 : 0.08, 0.6)
  glow(g, W * 0.7, H * 0.93, W * 0.1, H * 0.05, p.umbra, p.dark ? 0.25 : 0.08, 0.6)
  glow(g, W * 0.82, G.edgeY(W * 0.82) + H * 0.05, W * 0.25, H * 0.06, p.dark ? p.moon : p['step-hi'], p.dark ? 0.1 : 0.4, 0.5)
  g.restore()
  brush(g, [[-2, e0], [W + 2, e1]], 2.2, p.dark ? col(p.moon, 0.35) : col(p['rake-hi'], 1), 0.02, 0.02, 0.5)
  brush(g, [[-2, e0 + 2.5], [W + 2, e1 + 2.5]], 1.6, col(p.dark ? p.umbra : p.wash, p.dark ? 0.7 : 0.35), 0.02, 0.02, 0.5)
  const kinds = K.trays.map((t) => t.id)
  const faces: { NL: Pt; NR: Pt; fh: number }[] = []
  for (let j = 2; j >= 0; j--) faces[j] = paintTray(g, p, G, G.trays[j], kinds[j], 3898 + j * 13)
  paintBasket(g, p, G.basket, 3899, G.wide)
  // the bough balances the trays on a wide frame; a phone's top band keeps the words, and its near right corner gets a
  // mossy stone with grass beside the basket instead
  if (G.wide) bough(g, p, G)
  else {
    paintRock(g, p, W * 0.88, H * 0.965, W * 0.3, W * 0.2, 3818, { light: 1, moss: 0.9, cast: 0.7 })
    const q = rng(3819)
    for (let i = 0; i < 9; i++) {
      const gx = W * (0.78 + q() * 0.08), gy = H * 0.99
      brush(g, [[gx, gy], [gx + (q() - 0.4) * W * 0.05, gy - H * (0.04 + q() * 0.05)]], 1.3, col(p['moss-b'], 0.9), 0.1, 0.6, 0.1)
    }
  }
  posts(g, p, G)
  grainOver(g, p, W, H)
  return faces
}

/** A river stone for one pebble: an irregular body lit from the far right (the moon), its underside in shade, a quartz
 *  vein or two, a warm or cool cast, a soft highlight, a contact shadow; stretched to the pebble's box. */
function pebbleArt(seed: number) {
  const r = rng(seed)
  const body = blob(50 + (r() - 0.5) * 3, 29, 46 - r() * 3, 24 - r() * 3, seed, 0.16 + r() * 0.08, 14)
  const vy = 18 + r() * 22
  const vein = stroke([[8 + r() * 10, vy + (r() - 0.5) * 8], [40 + r() * 20, vy + (r() - 0.5) * 14], [88 - r() * 8, vy + (r() - 0.5) * 10]], 1.4 + r(), 0.2, 0.4, 0.2)
  return s('svg', { class: 't38t-stone', viewBox: '0 0 100 62', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    s('ellipse', { class: 't38t-stone-cast', cx: 46, cy: 54, rx: 46, ry: 7 }),
    s('path', { class: 't38t-stone-body', d: body }),
    s('path', { class: 't38t-stone-tint', d: body }),
    s('path', { class: 't38t-stone-vein', d: vein }),
    s('path', { class: 't38t-stone-under', d: body }),
    s('path', { class: 't38t-stone-hi', d: stroke([[46 + r() * 6, 9 + r() * 2], [66, 9 + r() * 2], [82 + r() * 6, 16 + r() * 3]], 5, 0.3, 0.5, 0.1) }),
    s('path', { class: 't38t-stone-rim', d: body, 'vector-effect': 'non-scaling-stroke' }))
}

/** The bamboo blind hanging from the eave across the top: a dark lintel, slats of split bamboo (each its own tone, a node
 *  here and there), two tying cords with knots, a rolled bottom edge. One SVG, drawn per layout. */
function blindArt(W: number, hh: number) {
  const r = rng(3813)
  const lintel = Math.max(10, hh * 0.16)
  const hem = Math.max(7, hh * 0.11)
  const roll = Math.max(9, hh * 0.15)
  const ties = [0, 0.18, 0.5, 0.82, 1]
  const sag = hh * 0.13
  // the hem sags a little between the ties: the bottom edge is a run of shallow scallops, not a ruled line
  const base = hh - roll * 0.5
  const bottomAt = (x: number) => {
    const u = x / W
    let i = 0
    while (i < ties.length - 2 && u > ties[i + 1]) i++
    const f = (u - ties[i]) / (ties[i + 1] - ties[i])
    return base - sag + Math.sin(Math.PI * f) * sag
  }
  const edge: string[] = []
  for (let k = 0; k <= 60; k++) edge.push(`${f1((W * k) / 60)} ${f1(bottomAt((W * k) / 60))}`)
  const cid = nextId('t38t-bl')
  const slats: SVGElement[] = []
  let nodes = ''
  for (let y = lintel + hem; y < base + 2; ) {
    const t = 3.6 + r() * 1.8
    const k = r()
    slats.push(s('rect', { class: `t38t-slat t${k < 0.33 ? 0 : k < 0.66 ? 1 : 2}`, x: 0, y: f1(y), width: f1(W), height: f1(t) }))
    for (let i = 0; i < W / 120; i++) nodes += `M${f1(r() * W)} ${f1(y + 0.4)}v${f1(t - 0.8)}`
    y += t + 1.4 + r() * 0.8
  }
  const cords: SVGElement[] = ties.slice(1, -1).map((u) => {
    let knots = ''
    for (let y = lintel + hem + 2; y < bottomAt(u * W) - 2; y += 9) knots += `M${f1(u * W - 2.6)} ${f1(y)}l5.2 3.4M${f1(u * W + 2.6)} ${f1(y)}l-5.2 3.4`
    const y1 = bottomAt(u * W) + roll * 0.5
    // the tie runs on below the hem and ends in a knot and a short tassel
    return s('g', null,
      s('path', { class: 't38t-tie', d: `M${f1(u * W)} ${f1(lintel)}V${f1(y1 + hh * 0.16)}${knots}` }),
      s('circle', { class: 't38t-knot', cx: f1(u * W), cy: f1(y1 + hh * 0.16), r: 2.6 }),
      s('path', { class: 't38t-tassel', d: `M${f1(u * W - 2.4)} ${f1(y1 + hh * 0.17)}L${f1(u * W - 3.6)} ${f1(y1 + hh * 0.34)}H${f1(u * W + 3.6)}L${f1(u * W + 2.4)} ${f1(y1 + hh * 0.17)}Z` }))
  })
  const rollPath = `M${edge.join('L')}`
  return s('svg', { class: 't38t-blind-svg', viewBox: `0 0 ${f1(W)} ${f1(hh * 1.4)}`, width: f1(W), height: f1(hh * 1.4), 'aria-hidden': 'true' },
    s('clipPath', { id: cid }, s('path', { d: `M0 ${f1(lintel)}H${f1(W)}V${f1(bottomAt(W))}L${edge.slice().reverse().join('L')}Z` })),
    s('g', { class: 't38t-blind-fall' },
      // the morning haze outside, seen through the gaps between the slats (brighter toward the moon, right)
      s('g', { 'clip-path': `url(#${cid})` },
        s('rect', { class: 't38t-haze', x: 0, y: f1(lintel), width: f1(W), height: f1(hh) }),
        ...slats,
        s('path', { class: 't38t-node', d: nodes })),
      ...cords,
      s('path', { class: 't38t-roll', d: rollPath, 'stroke-width': f1(roll) }),
      s('path', { class: 't38t-roll-hi', d: rollPath, 'stroke-width': f1(roll * 0.2), transform: `translate(0 ${f1(-roll * 0.22)})` })),
    s('rect', { class: 't38t-hem', x: -2, y: f1(lintel - 1), width: f1(W + 4), height: f1(hem + 1) }),
    s('rect', { class: 't38t-hem-edge', x: -2, y: f1(lintel + hem - 1.6), width: f1(W + 4), height: 1.2 }),
    s('rect', { class: 't38t-lintel', x: -2, y: 0, width: f1(W + 4), height: f1(lintel) }),
    s('rect', { class: 't38t-lintel-hi', x: -2, y: f1(lintel - 2), width: f1(W + 4), height: 1.4 }))
}

/** Scene 4 — sort the engraved pebbles: throw each into a tray (dry, flooded, in fog), then pull the blind up. */
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
  // each stone its own size, lie and cast (warm / cool)
  const rs = rng(3812)
  const look = new Map(ids.map((id, n) => [id, { w: 0.88 + rs() * 0.24, h: 0.9 + rs() * 0.22, rot: (rs() - 0.5) * 10, tint: n % 3 }]))

  const cv = canvas('t38t-cv')
  const rays = h('div', { class: 't38t-rays', 'aria-hidden': 'true' }, ...K.trays.map((_, j) => h('i', { class: 't38t-ray', style: `--j:${j}` })))
  const warm = h('div', { class: 't38t-warms', 'aria-hidden': 'true' }, ...K.trays.map((_, j) => h('i', { class: 't38t-warm', style: `--j:${j}` })))
  const veil = h('div', { class: 't38t-veil', 'aria-hidden': 'true' }, h('i'), h('i'))
  const paths = s('svg', { class: 't38t-paths', 'aria-hidden': 'true' })
  const fx = h('div', { class: 't38t-fx', 'aria-hidden': 'true' })
  const stop = (o: number, c: string, a = 1) => s('stop', { offset: o, style: `stop-color:${c};stop-opacity:${a}` })
  const defs = s('svg', { class: 't38t-defs', width: 0, height: 0, 'aria-hidden': 'true' }, s('defs', null,
    s('radialGradient', { id: 't38t-g-peb', cx: 0.64, cy: 0.3, r: 0.75 }, stop(0, 'var(--rock-hi)'), stop(0.5, 'color-mix(in srgb, var(--rock-hi) 45%, var(--rock-mid))'), stop(1, 'var(--rock-lo)')),
    s('linearGradient', { id: 't38t-g-under', x1: 0.25, y1: 0, x2: 0, y2: 1 }, stop(0, 'var(--umbra)', 0), stop(0.55, 'var(--umbra)', 0.04), stop(1, 'var(--umbra)', 0.42)),
    s('radialGradient', { id: 't38t-g-cast' }, stop(0, 'var(--umbra)', 0.55), stop(1, 'var(--umbra)', 0)),
    s('linearGradient', { id: 't38t-g-haze', x1: 0, y1: 0, x2: 1, y2: 0 }, stop(0, 'color-mix(in srgb, var(--dawn) 70%, var(--mist))', 0.75), stop(0.45, 'var(--mist)', 0.55), stop(1, 'var(--moon)', 0.85))))
  const pebs = new Map(K.tasks.map((t, n) => [t.id, h('button', {
    class: `t38t-peb tint${look.get(t.id)!.tint}`, type: 'button', 'aria-pressed': 'false', 'aria-describedby': keysId, 'aria-label': t.label, 'data-id': t.id,
  }, pebbleArt(3820 + n * 11), h('span', { class: 't38t-short', 'aria-hidden': 'true' }, t.short))]))
  const dents = new Map(K.tasks.map((t) => [t.id, h('i', { class: 't38t-dent', 'aria-hidden': 'true' })]))
  const trayBtns = K.trays.map((t, i) => h('button', { class: 't38t-tray', type: 'button', 'data-id': t.id, 'aria-label': t.name, onClick: () => sel && put(sel, i) }))
  // the names cut into the trays' near faces (outside the buttons so they can sit over the fog veil)
  const names = K.trays.map((t, i) => h('span', { class: 't38t-tray-name', 'data-id': t.id, 'aria-hidden': 'true' }, h('b', null, String(i + 1)), t.name))
  // words in the scene, one block at a time: the stone in hand (its whole name), then, with the light, why AI Zen put an
  // off stone elsewhere; the match is cut along the near tray's far rim (a count, like the one on the basket)
  const tag = h('p', { class: 't38t-tag', hidden: true })
  const match = h('p', { class: 't38t-match', hidden: true })
  const pull = h('button', { class: 't38t-pull', type: 'button', hidden: true, 'aria-label': K.compare, onClick: compare }, h('i', { class: 't38t-toggle', 'aria-hidden': 'true' }), h('span', { 'aria-hidden': 'true' }, K.compare))
  const blind = h('div', { class: 't38t-blind', 'aria-hidden': 'true' })
  const countAt = h('i', { class: 't38t-count-at', 'aria-hidden': 'true' })
  const root = h('div', { class: 't38t' },
    h('p', { class: 'visually-hidden' }, K.art),
    h('p', { class: 'visually-hidden', id: keysId }, K.keys),
    defs, cv, warm, ...dents.values(), paths, ...trayBtns, rays, ...order.map((i) => pebs.get(ids[i])!), veil, ...names, fx, countAt, tag, blind, match, h('div', { class: 't38t-cord' }, pull))
  ctx.art.append(root)
  ctx.prompt(fill(K.prompt, { n: 0, total: K.tasks.length }))
  // H1: a dot on the top pebble of the basket until the first throw; then on the blind's toggle when all are placed.
  // H4: the count cut on the basket's rim from the start.
  const g = guide(ctx)
  let dot: Mark | null = g.dot(pebs.get(ids[order[0]])!, { dir: [1, -0.4] })
  const counter = g.count(K.placed, ids.length, countAt)
  let insightEl: HTMLElement | null = null

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
    const blindH = Math.max(52, H * (G.wide ? 0.115 : 0.095))
    blind.replaceChildren(blindArt(W, blindH))
    blind.style.height = `${f1(blindH)}px`
    root.style.setProperty('--blind', `${f1(blindH)}px`)
    K.trays.forEach((_, j) => {
      const t = G!.trays[j]
      Object.assign(trayBtns[j].style, { left: `${f1(t.x - t.w / 2)}px`, top: `${f1(t.y - t.h * 0.6)}px`, width: `${f1(t.w)}px`, height: `${f1(t.h * 1.6)}px` })
      // a slatted beam from the blind down to the tray; a warm pool on it (it also wakes when a stone is in hand)
      const len = t.y + t.h * 0.3 - blindH * 0.6, dx = len * 0.32
      Object.assign((rays.children[j] as HTMLElement).style, { left: `${f1(t.x - t.w * 0.48)}px`, top: `${f1(t.y + t.h * 0.3 - len)}px`, width: `${f1(t.w * 0.96)}px`, height: `${f1(len)}px`, transform: `rotate(${f1((-Math.atan2(dx, len) * 180) / Math.PI)}deg)` })
      Object.assign((warm.children[j] as HTMLElement).style, { left: `${f1(t.x - t.w * 0.7)}px`, top: `${f1(t.y - t.h * 0.95)}px`, width: `${f1(t.w * 1.4)}px`, height: `${f1(t.h * 2.2)}px` })
    })
    const ft = G.trays[2]
    Object.assign(veil.style, { left: `${f1(ft.x - ft.w * 0.75)}px`, top: `${f1(ft.y - ft.h * 1.1)}px`, width: `${f1(ft.w * 1.5)}px`, height: `${f1(ft.h * 2.2)}px` })
    // the count on the basket's rim, in front
    const b = G.basket
    Object.assign(countAt.style, { left: `${f1(b.x + (G.wide ? b.w * 0.05 : -b.w * 0.25))}px`, top: `${f1(b.y - b.h * 0.14 + b.h * 0.36 * 0.9 + (G.wide ? 18 : 14))}px` })
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
    const run = () => {
      const faces = paintScene(fit(cv, W, H, dprOf(ctx.quality === 'low')), p, G!)
      const rot = `${f1((Math.atan(G!.slope) * 180) / Math.PI)}deg`
      faces.forEach((f, j) => Object.assign(names[j].style, { left: `${f1((f.NL[0] + f.NR[0]) / 2)}px`, top: `${f1((f.NL[1] + f.NR[1]) / 2 + f.fh * (G!.wide ? 0.32 : 0.5))}px`, rotate: rot }))
      // the match cut under the near tray's name (wide), or written on the boards just beyond its far rim (tall)
      const f = faces[0]
      Object.assign(match.style, G!.wide
        ? { left: `${f1((f.NL[0] + f.NR[0]) / 2)}px`, top: `${f1((f.NL[1] + f.NR[1]) / 2 + f.fh * 0.7)}px`, rotate: rot }
        : { left: '16px', top: `${f1(Math.max(52, G!.H * 0.095) * 0.42 + 14)}px`, rotate: '0deg', transform: 'translate(0, -50%)' })
      drawn = true
      g.refresh()
    }
    if (drawn) return run()
    job = sliced((function* () {
      yield
      run()
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
      // the way it rolled: a dotted track on the boards between the two trays, and the hollow it left
      const c: Pt = [(a[0] + b.x) / 2, Math.max(a[1], b.y) + G!.H * 0.03]
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
  /** the words for a stone: its whole name while in hand; with the light, why AI Zen put it where it is. One block: while
   *  it shows after the insight, the insight steps back */
  function say(id: string) {
    const t = K.tasks.find((x) => x.id === id)
    tagFor = t ? id : ''
    tag.hidden = !t
    insightEl?.classList.toggle('t38-hush', !!t)
    pebs.forEach((b, k) => b.classList.toggle('told', k === tagFor && compared))
    if (!t) return
    tag.replaceChildren(h('b', null, t.label), compared ? h('span', null, t.why) : '')
    if (!tag.hasAttribute('aria-live')) tag.setAttribute('aria-live', 'polite')
    placeTag()
  }
  /** the stone's words stand in the quiet water beyond the veranda (wide: left, under the bough; tall: under the blind) */
  function placeTag() {
    if (!tagFor || !G) return
    const tw = G.wide ? Math.min(380, G.W * 0.28) : G.W - 32
    Object.assign(tag.style, G.wide ? { width: `${f1(tw)}px`, left: `${f1(G.W * 0.045)}px`, top: `${f1(G.H * 0.3)}px` } : { width: `${f1(G.moon[0] - G.mr * 1.8 - 16)}px`, left: '16px', top: `${f1(Math.max(52, G.H * 0.095) * 0.42 + 30)}px` })
  }
  function choose(id: string) {
    sel = sel === id || compared ? '' : id
    pebs.forEach((b, k) => b.setAttribute('aria-pressed', String(k === sel)))
    say(compared ? (tagFor === id ? '' : id) : sel)
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
    counter.set(m)
    if (m < ids.length) return ctx.prompt(fill(K.prompt, { n: m, total: ids.length }))
    if (!pull.hidden) return
    pull.hidden = false
    root.classList.add('all-in')
    ctx.prompt(K.pullPrompt)
    dot = g.dot(pull.firstChild as Element, { dir: [0, 1] })
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
    counter.done()
    match.hidden = false
    match.textContent = fill(K.match, { n, total: ids.length })
    match.setAttribute('aria-live', 'polite')
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
    // (audit 38-4: the reasons come before the conclusion); the editors' note joins the detail
    const step = ctx.reduced ? 0 : 2000, t0 = ctx.reduced ? 0 : 1300
    wrong.forEach((id, k) => {
      const t = window.setTimeout(() => say(id), t0 + k * step)
      ctx.onCleanup(() => clearTimeout(t))
    })
    const t = window.setTimeout(() => {
      say('')
      insightEl = ctx.insight(K.insight, [K.expertNote, K.detail, K.jobs])
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
        root.dataset.picking = 'true' // H3: the trays wake while a stone is carried
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
      label()
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
  // H7: standing still 6 s, a stone in the basket rolls a little toward the trays
  const onIdle = () => {
    if (ctx.reduced || compared) return
    const id = ids.find((x) => placed[x] == null)
    if (!id) return
    pebs.get(id)!.animate([{ translate: '0 0', rotate: '0deg' }, { translate: '10px -3px', rotate: '7deg', offset: 0.45 }, { translate: '0 0', rotate: '0deg' }], { duration: 1100, easing: 'ease-in-out', composite: 'add' })
  }
  ctx.el.addEventListener('p2:idle', onIdle)
  ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', onIdle))
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
