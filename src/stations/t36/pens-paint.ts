import { s } from '../../core/dom'
import { cssVar } from '../../core/prefs'
import { blob, rng, stroke } from '../../ui/part2/ink'
import { moon, water } from '../../ui/part2/paint'
import { ink, wood, woodG } from './kit'
import { koi } from './koi'

/**
 * The flat pens of scene 2 (pens): the same koi basin, seen from straight above, painted three ways on a 2D canvas —
 * Canvas 2D (flat shapes, outlines, no light), p5.js (watercolour washes and generated dots), Phaser (a tile board, pixel
 * sprites, hitbox rings). The still part is baked once per size / theme; the koi is drawn per frame on top, in the same
 * hand, from the 3D koi's swim angle. Nothing here allocates per frame.
 */

export type Flat = 'none' | 'canvas' | 'p5' | 'phaser'
export interface Pal { card: string; paper: string; paper2: string; ink: string; ink3: string; water: string; moss: string; mossC: string; rockHi: string; rockMid: string; rockLo: string; moon: string; red: string; lantern: string; umbra: string; wash: string; dark: boolean }
export const readPal = (): Pal => ({
  card: cssVar('--card'), paper: cssVar('--paper'), paper2: cssVar('--paper-2'), ink: cssVar('--ink'), ink3: cssVar('--ink-3'), water: cssVar('--water'),
  moss: cssVar('--moss'), mossC: cssVar('--moss-c'), rockHi: cssVar('--rock-hi'), rockMid: cssVar('--rock-mid'), rockLo: cssVar('--rock-lo'), moon: cssVar('--moon'),
  red: cssVar('--vermilion'), lantern: cssVar('--lantern'), umbra: cssVar('--umbra'), wash: cssVar('--wash'), dark: document.documentElement.dataset.theme === 'dark',
})

/** Where things lie in the basin, in units of its inner radius (x right, y toward the viewer) — shared with the 3D pond. */
export const PADS: [number, number, number, number][] = [[-0.52, 0.42, 0.2, 0.6], [-0.36, 0.62, 0.13, 2.2], [0.5, -0.5, 0.16, 4.1], [0.18, 0.74, 0.11, 1.2]]
export const SHARD: [number, number] = [0.42, -0.1]
/** the koi's path: radius (share of the basin) and how it breathes with the angle */
export const swimR = (a: number) => 0.56 + 0.07 * Math.sin(a * 0.7)

const TAU = Math.PI * 2
const TILE = 128
let grainTile: HTMLCanvasElement | null = null
/** one 128² paper-grain tile for the whole module (README: tables built once) */
function grain(): HTMLCanvasElement {
  if (grainTile) return grainTile
  const c = document.createElement('canvas')
  c.width = c.height = TILE
  const g = c.getContext('2d')!
  const img = g.createImageData(TILE, TILE)
  const r = rng(3611)
  for (let i = 0; i < TILE * TILE; i++) {
    const v = r()
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v > 0.5 ? 255 : 0
    img.data[i * 4 + 3] = Math.round(Math.abs(v - 0.5) * 2 * 40)
  }
  g.putImageData(img, 0, 0)
  grainTile = c
  return c
}

/** a circle drawn with a searching, jittered hand: `passes` light strokes */
function handCircle(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number, passes: number, jit: number) {
  const rr = rng(seed)
  for (let p = 0; p < passes; p++) {
    const a0 = rr() * TAU, span = TAU * (0.9 + rr() * 0.25), ox = (rr() - 0.5) * jit, oy = (rr() - 0.5) * jit
    g.beginPath()
    for (let i = 0; i <= 48; i++) {
      const a = a0 + (span * i) / 48
      const k = r * (1 + (rr() - 0.5) * jit * 0.004)
      const x = cx + ox + Math.cos(a) * k, y = cy + oy + Math.sin(a) * k
      if (i) g.lineTo(x, y)
      else g.moveTo(x, y)
    }
    g.stroke()
  }
}
const padPath = (g: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) => {
  g.beginPath()
  g.moveTo(x, y)
  g.arc(x, y, r, rot + 0.3, rot + TAU - 0.3)
  g.closePath()
}
const crescent = (g: CanvasRenderingContext2D, x: number, y: number, r: number) => {
  g.beginPath()
  g.arc(x, y, r, -1.9, 1.9)
  g.arc(x - r * 0.55, y, r * 0.86, 1.25, -1.25, true)
  g.closePath()
}

/**
 * Bake the still part of one flat painting into `out` (css size w × h at dpr). The basin sits in the middle; `R` = its
 * inner radius in css px. Returns the geometry the per-frame koi needs.
 */
export function bake(out: HTMLCanvasElement, kind: Flat, w: number, h: number, dpr: number, P: Pal): { cx: number; cy: number; R: number } {
  out.width = Math.max(1, Math.round(w * dpr))
  out.height = Math.max(1, Math.round(h * dpr))
  const g = out.getContext('2d')!
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.36
  const RO = R * 1.36 // the basin's outer lip
  const r = rng(360 + kind.length)
  g.lineCap = g.lineJoin = 'round'
  // the sheet itself: paper, a whisper of grain
  g.fillStyle = kind === 'phaser' ? P.paper2 : P.card
  g.fillRect(0, 0, w, h)
  const at = (u: number, v: number): [number, number] => [cx + u * R, cy + v * R]

  if (kind === 'none' || kind === 'canvas') {
    const faint = kind === 'none'
    // raked sand round the basin: long, flat, even lines
    g.strokeStyle = P.ink3
    g.globalAlpha = faint ? 0.1 : 0.22
    g.lineWidth = 1
    for (let y = 8; y < h; y += 9) {
      g.beginPath()
      let started = false
      for (let x = 0; x <= w; x += 12) {
        const d = Math.hypot(x - cx, y - cy)
        if (d < RO + 10) {
          started = false
          continue
        }
        if (started) g.lineTo(x, y)
        else g.moveTo(x, y), (started = true)
      }
      g.stroke()
    }
    g.globalAlpha = 1
    if (!faint) {
      // flat fills: stone ring, water, pads, the shard — one colour each, no light
      g.fillStyle = P.rockMid
      g.beginPath()
      g.arc(cx, cy, RO, 0, TAU)
      g.arc(cx, cy, R, 0, TAU, true)
      g.fill()
      g.fillStyle = P.water
      g.globalAlpha = P.dark ? 0.9 : 0.55
      g.beginPath()
      g.arc(cx, cy, R, 0, TAU)
      g.fill()
      g.globalAlpha = 1
      g.fillStyle = P.mossC
      for (const [u, v, k, rot] of PADS) padPath(g, ...at(u, v), k * R, rot), g.fill()
      g.fillStyle = P.moon
      crescent(g, ...at(...SHARD), R * 0.09)
      g.fill()
    }
    // the hand: outlines in charcoal, a little searching
    g.strokeStyle = P.ink
    g.globalAlpha = faint ? 0.34 : 0.75
    g.lineWidth = faint ? 0.9 : 1.3
    handCircle(g, cx, cy, R, 11, faint ? 2 : 3, 3)
    handCircle(g, cx, cy, RO, 12, faint ? 2 : 3, 4)
    if (faint) {
      // the underdrawing waits for a pen: pads, the shard, the koi's path in a light pencil
      g.globalAlpha = 0.3
      for (const [u, v, k, rot] of PADS) padPath(g, ...at(u, v), k * R, rot), g.stroke()
      crescent(g, ...at(...SHARD), R * 0.09)
      g.stroke()
      g.setLineDash([3, 6])
      g.beginPath()
      g.arc(cx, cy, R * 0.6, 0, TAU)
      g.stroke()
      g.setLineDash([])
      // the koi, roughed in: a long oval and a split tail
      const [kx, ky] = at(-0.5, -0.35)
      g.globalAlpha = 0.38
      g.beginPath()
      g.ellipse(kx, ky, R * 0.22, R * 0.07, -0.7, 0, TAU)
      g.moveTo(kx + R * 0.15, ky - R * 0.16)
      g.lineTo(kx + R * 0.3, ky - R * 0.24)
      g.lineTo(kx + R * 0.22, ky - R * 0.06)
      g.closePath()
      g.stroke()
    } else {
      // ripples: short level dashes
      g.globalAlpha = 0.35
      g.lineWidth = 1
      for (let i = 0; i < 9; i++) {
        const u = (r() - 0.5) * 1.2, v = (r() - 0.5) * 1.3
        const [x, y] = at(u, v)
        g.beginPath()
        g.moveTo(x - R * 0.08, y)
        g.lineTo(x + R * 0.08, y)
        g.stroke()
      }
      g.globalAlpha = 0.8
      g.lineWidth = 1.1
      for (const [u, v, k, rot] of PADS) padPath(g, ...at(u, v), k * R, rot), g.stroke()
      crescent(g, ...at(...SHARD), R * 0.09)
      g.stroke()
    }
    g.globalAlpha = 1
  } else if (kind === 'p5') {
    // washes: water blooms that dry with darker edges, a grey ring with granulation, green pads, splashes
    const wash = (x: number, y: number, rad: number, col: string, a: number) => {
      const gr = g.createRadialGradient(x, y, rad * 0.1, x, y, rad)
      g.globalAlpha = a
      gr.addColorStop(0, col)
      gr.addColorStop(0.75, col)
      gr.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = gr
      g.beginPath()
      g.arc(x, y, rad, 0, TAU)
      g.fill()
    }
    for (let i = 0; i < 18; i++) {
      const a = r() * TAU, d = RO * (1.02 + r() * 0.08)
      wash(cx + Math.cos(a) * d, cy + Math.sin(a) * d, R * (0.12 + r() * 0.12), P.rockMid, 0.16)
    }
    // the basin's stone ring as one wet wash, its inner lip darker where the colour pooled as it dried
    g.globalAlpha = P.dark ? 0.55 : 0.4
    g.strokeStyle = P.rockMid
    g.lineWidth = RO - R
    g.beginPath()
    g.arc(cx, cy, (R + RO) / 2, 0, TAU)
    g.stroke()
    wash(cx, cy, R * 0.98, P.water, P.dark ? 0.55 : 0.32)
    for (let i = 0; i < 9; i++) {
      const a = r() * TAU, d = R * (0.2 + r() * 0.6)
      wash(cx + Math.cos(a) * d, cy + Math.sin(a) * d, R * (0.22 + r() * 0.2), i % 3 ? P.water : P.moss, 0.14)
    }
    g.globalAlpha = 0.7
    g.strokeStyle = P.rockLo
    g.lineWidth = R * 0.035
    g.beginPath()
    g.arc(cx, cy, R * 1.0, 0, TAU)
    g.stroke()
    g.globalAlpha = 0.35
    g.lineWidth = R * 0.02
    g.beginPath()
    g.arc(cx, cy, RO * 0.99, 0, TAU)
    g.stroke()
    // granulation in the stone wash
    g.fillStyle = P.rockLo
    for (let i = 0; i < 420; i++) {
      const a = r() * TAU, d = R * 1.04 + r() * (RO - R) * 0.95
      g.globalAlpha = 0.18 + r() * 0.25
      g.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1.2, 1.2)
    }
    for (const [u, v, k] of PADS) {
      const [x, y] = at(u, v)
      wash(x, y, k * R * 1.15, P.moss, 0.45)
      wash(x + k * R * 0.2, y - k * R * 0.2, k * R * 0.6, P.mossC, 0.4)
    }
    wash(...at(...SHARD), R * 0.2, P.moon, 0.85)
    wash(...at(...SHARD), R * 0.5, P.moon, 0.18)
    // generated splashes: noise-scattered dots the way a sketch with random() looks
    for (let i = 0; i < 50; i++) {
      const a = r() * TAU, d = R * (0.1 + r() * 1.6)
      g.globalAlpha = 0.12 + r() * 0.28
      g.fillStyle = [P.red, P.moss, P.water, P.lantern][i % 4]
      g.beginPath()
      g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1 + r() * R * 0.025, 0, TAU)
      g.fill()
    }
    g.globalAlpha = 1
  } else {
    // a board of tiles: sand, stone, water in two tones, pads and the moon as sprites — then the grid over all
    const T = Math.max(10, R / 5.2)
    const ox = cx - Math.ceil(cx / T) * T, oy = cy - Math.ceil(cy / T) * T
    for (let y = oy; y < h; y += T) for (let x = ox; x < w; x += T) {
      const d = Math.hypot(x + T / 2 - cx, y + T / 2 - cy)
      const c = (Math.round((x - ox) / T) + Math.round((y - oy) / T)) % 2
      g.fillStyle = d < R ? (c ? P.water : mixHex(P.water, P.wash, 0.18)) : d < RO ? (c ? P.rockMid : P.rockHi) : c ? P.paper2 : mixHex(P.paper2, P.card, 0.5)
      g.globalAlpha = d < R && !P.dark ? 0.75 : 1
      g.fillRect(x, y, T, T)
      if (d >= R && d < RO) {
        // a bevel on each stone tile
        g.globalAlpha = 0.35
        g.fillStyle = P.rockLo
        g.fillRect(x, y + T - 2, T, 2)
        g.fillRect(x + T - 2, y, 2, T)
      }
    }
    g.globalAlpha = 1
    for (const [u, v, k] of PADS) {
      const [x, y] = at(u, v)
      const n = Math.max(1, Math.round((k * R * 2) / T))
      const sx = Math.floor((x - ox) / T) * T + ox, sy = Math.floor((y - oy) / T) * T + oy
      g.fillStyle = P.moss
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (!(i === n - 1 && j === 0 && n > 1)) g.fillRect(sx + i * T, sy + j * T, T, T)
    }
    const [mx, my] = at(...SHARD)
    g.fillStyle = P.moon
    const q = T * 0.5
    for (const [i, j] of [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [2, 0]]) g.fillRect(mx + i * q - q, my + j * q - q / 2, q, q)
    g.strokeStyle = P.ink
    g.globalAlpha = P.dark ? 0.22 : 0.16
    g.lineWidth = 1
    g.beginPath()
    for (let x = ox; x <= w; x += T) g.moveTo(Math.round(x) + 0.5, 0), g.lineTo(Math.round(x) + 0.5, h)
    for (let y = oy; y <= h; y += T) g.moveTo(0, Math.round(y) + 0.5), g.lineTo(w, Math.round(y) + 0.5)
    g.stroke()
    g.globalAlpha = 1
  }
  // grain over everything, then the sheet's own edge
  const pat = g.createPattern(grain(), 'repeat')
  if (pat) {
    g.globalAlpha = P.dark ? 0.35 : 0.5
    g.fillStyle = pat
    g.fillRect(0, 0, w, h)
    g.globalAlpha = 1
  }
  return { cx, cy, R }
}

/** a hex colour mixed toward another (both CSS colours as the tokens give them: #rrggbb) */
function mixHex(a: string, b: string, k: number) {
  const p = (c: string) => (c.startsWith('#') && c.length >= 7 ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) : [128, 128, 128])
  const A = p(a), B = p(b)
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`
}

// a reusable spine for the per-frame koi (x, y, half-width) — no allocation in the frame
const SP = new Float32Array(14 * 3)
/** the tail's root (x, y), its direction (ux, uy) and the koi's length — module scratch, so nothing is made per frame */
const TL = new Float32Array(5)
function outline(g: CanvasRenderingContext2D, c: number, s0: number) {
  g.beginPath()
  for (let i = 0; i < 14; i++) {
    const k = i ? i - 1 : 0, dx = SP[i * 3] - SP[k * 3] || -c, dy = SP[i * 3 + 1] - SP[k * 3 + 1] || -s0, l = Math.hypot(dx, dy) || 1
    const nx = -dy / l, ny = dx / l, hw = SP[i * 3 + 2]
    if (i) g.lineTo(SP[i * 3] + nx * hw, SP[i * 3 + 1] + ny * hw)
    else g.moveTo(SP[0] + nx * hw, SP[1] + ny * hw)
  }
  for (let i = 13; i >= 0; i--) {
    const k = i ? i - 1 : 0, dx = SP[i * 3] - SP[k * 3] || -c, dy = SP[i * 3 + 1] - SP[k * 3 + 1] || -s0, l = Math.hypot(dx, dy) || 1
    const nx = -dy / l, ny = dx / l, hw = SP[i * 3 + 2]
    g.lineTo(SP[i * 3] - nx * hw, SP[i * 3 + 1] - ny * hw)
  }
  g.closePath()
}
function tail(g: CanvasRenderingContext2D) {
  const tx = TL[0], ty = TL[1], ux = TL[2], uy = TL[3], L = TL[4]
  g.beginPath()
  g.moveTo(tx, ty)
  g.quadraticCurveTo(tx + ux * L * 0.1 - uy * L * 0.04, ty + uy * L * 0.1 + ux * L * 0.04, tx + ux * L * 0.2 - uy * L * 0.13, ty + uy * L * 0.2 + ux * L * 0.13)
  g.quadraticCurveTo(tx + ux * L * 0.1, ty + uy * L * 0.1, tx + ux * L * 0.2 + uy * L * 0.13, ty + uy * L * 0.2 - ux * L * 0.13)
  g.closePath()
}
function patch(g: CanvasRenderingContext2D, i: number, k: number, ang: number) {
  g.beginPath()
  g.ellipse(SP[i * 3], SP[i * 3 + 1], SP[i * 3 + 2] * 0.8 * k, SP[i * 3 + 2] * 1.05 * k, ang, 0, TAU)
}
/**
 * The koi at (x, y) heading `ang` (radians, screen space), `L` long, tail wave `ph` — drawn in the hand of `kind`.
 * `hit` = how close it is to the moon shard (0…1, Phaser flashes its hitbox).
 */
export function drawKoi(g: CanvasRenderingContext2D, kind: Flat, x: number, y: number, ang: number, L: number, ph: number, P: Pal, hit: number) {
  const c = Math.cos(ang), s0 = Math.sin(ang)
  if (kind === 'phaser') {
    // a pixel sprite, turned whole; its hitbox ring
    const q = L / 10
    g.save()
    g.translate(x, y)
    g.rotate(ang)
    for (let j = 0; j < SPRITE.length; j++) for (let i = 0; i < 10; i++) {
      const ch = SPRITE[j][i]
      if (ch === '.') continue
      g.fillStyle = ch === 'r' ? P.red : ch === 't' ? P.rockMid : P.card
      g.fillRect((5 - i) * q - q, (j - 2.5) * q, q, q)
    }
    g.fillStyle = P.ink
    g.fillRect(3 * q, -1.5 * q, q * 0.6, q * 0.6)
    g.restore()
    g.strokeStyle = P.red
    g.lineWidth = 1 + hit * 2
    g.globalAlpha = 0.55 + hit * 0.45
    g.beginPath()
    g.arc(x, y, L * 0.42, 0, TAU)
    g.stroke()
    g.globalAlpha = 1
    return
  }
  // the spine: from the head back, bending with the tail wave
  for (let i = 0; i < 14; i++) {
    const t = i / 13
    const bend = Math.sin(ph - t * 4.2) * L * 0.07 * t * t
    const px = x - c * L * t * 0.82 - s0 * bend, py = y - s0 * L * t * 0.82 + c * bend
    SP[i * 3] = px
    SP[i * 3 + 1] = py
    SP[i * 3 + 2] = L * 0.13 * Math.sin(Math.PI * Math.min(1, t * 0.95 + 0.12)) * (1 - t * 0.55)
  }
  // the tail: two lobes off the last spine point
  const tx = SP[13 * 3], ty = SP[13 * 3 + 1]
  const bx = tx - SP[12 * 3], by = ty - SP[12 * 3 + 1], bl = Math.hypot(bx, by) || 1
  TL[0] = tx
  TL[1] = ty
  TL[2] = bx / bl
  TL[3] = by / bl
  TL[4] = L
  if (kind === 'p5') {
    g.globalAlpha = 0.35
    g.fillStyle = P.water
    g.beginPath()
    g.ellipse(x - c * L * 0.4 + 4, y - s0 * L * 0.4 + 6, L * 0.5, L * 0.16, ang, 0, TAU)
    g.fill()
    g.globalAlpha = 0.95
    g.fillStyle = P.dark ? P.moon : P.card
    outline(g, c, s0)
    g.fill()
    g.strokeStyle = P.dark ? P.moon : P.ink3
    g.lineWidth = 1
    g.globalAlpha = 0.6
    g.stroke()
    tail(g)
    g.globalAlpha = 0.6
    g.fill()
    g.fillStyle = P.red
    for (let q = 0; q < P5PATCH.length; q += 3) {
      g.globalAlpha = P5PATCH[q + 2]
      patch(g, P5PATCH[q], P5PATCH[q + 1], ang)
      g.fill()
    }
    // the sketch's generated wake: dots spiralling off the tail
    g.fillStyle = P.lantern
    for (let i = 0; i < 12; i++) {
      const t = i / 12, sp = 1 + t * 3
      g.globalAlpha = (1 - t) * 0.55
      g.beginPath()
      g.arc(tx + TL[2] * L * t * 1.4 + Math.sin(ph * 0.5 + i * 1.7) * L * 0.08 * sp, ty + TL[3] * L * t * 1.4 + Math.cos(ph * 0.5 + i * 1.3) * L * 0.08 * sp, 1.2 + (1 - t) * 1.6, 0, TAU)
      g.fill()
    }
    g.globalAlpha = 1
    return
  }
  // Canvas 2D: flat fills and a clean line, no light at all
  g.fillStyle = P.card
  g.strokeStyle = P.ink
  g.lineWidth = 1.2
  tail(g)
  g.fill()
  g.stroke()
  outline(g, c, s0)
  g.fill()
  g.stroke()
  g.fillStyle = P.red
  patch(g, 2, 1, ang)
  g.fill()
  patch(g, 6, 0.9, ang)
  g.fill()
  g.fillStyle = P.ink
  g.beginPath()
  g.arc(SP[3] - s0 * L * 0.05, SP[4] + c * L * 0.05, 1.3, 0, TAU)
  g.arc(SP[3] + s0 * L * 0.05, SP[4] - c * L * 0.05, 1.3, 0, TAU)
  g.fill()
}
// (spine index, size, alpha) for the watercolour patches; the Phaser koi as a pixel sprite (r = red, w = white, t = tail)
const P5PATCH = [2, 1.3, 0.35, 2, 0.9, 0.45, 6, 1.2, 0.3, 6, 0.8, 0.4, 9, 0.7, 0.3]
const SPRITE = ['..rrww....', '.wrrwwrw.t', 'wwwwrrwwtt', '.wwwwwww.t', '..ww......']

// ── no WebGL: the 3D pens become paintings (viewBox 240 × 160) ──
const ell = (cx: number, cy: number, rx: number, ry: number) => Array.from({ length: 33 }, (_, i) => [cx + Math.cos((i / 32) * TAU) * rx, cy + Math.sin((i / 32) * TAU) * ry] as [number, number])
export function paintedDepth(id: 'three' | 'engine'): SVGSVGElement {
  const svg = s('svg', { class: 't36p-svg', viewBox: '0 0 240 160', preserveAspectRatio: 'xMidYMid slice', 'aria-hidden': 'true' })
  if (id === 'three') {
    let floor = ''
    for (let i = 0; i < 7; i++) floor += stroke([[120 + (i - 3) * 14, 40], [120 + (i - 3) * 52, 158]], 0.7, 0.1, 0.1, 0.4)
    for (const [y, k] of [[56, 0], [78, 1], [108, 2], [148, 3]] as const) floor += stroke([[64 - k * 22, y], [176 + k * 22, y]], 0.7, 0.1, 0.1, 0.4)
    svg.append(
      s('rect', { class: 't36p-svg-bg', x: 0, y: 0, width: 240, height: 160 }),
      ink(floor, 't36p-svg-line'),
      s('ellipse', { class: 't36p-svg-water', cx: 120, cy: 100, rx: 80, ry: 32 }),
      ink(stroke(ell(120, 100, 82, 33), 3, 0.05, 0.05, 0.6), 't36p-svg-rim', 'rough'),
      s('circle', { cx: 196, cy: 30, r: 34, fill: 'url(#p2-halo)' }),
      moon(196, 30, 10, 3601, false),
      ink(blob(126, 112, 30, 6, 90, 0.2), 'p2p-wash t36p-svg-shadow', 'wash'),
      koi(102, 96, 52, Math.PI + 0.12, 3602, 0.12))
  } else {
    svg.append(
      s('rect', { class: 't36p-svg-bg', x: 0, y: 0, width: 240, height: 160 }),
      water(0, 60, 240, 160, 3603, 168),
      s('circle', { cx: 168, cy: 34, r: 40, fill: 'url(#p2-halo)' }),
      moon(168, 34, 13, 3604, true),
      ink(blob(64, 120, 12, 5, 91, 0.2, 10) + blob(84, 132, 8, 3.5, 92, 0.2, 10), 't36p-svg-pad', 'wash'),
      koi(92, 98, 46, 0.3, 3605),
      koi(150, 122, 34, Math.PI - 0.4, 3606),
      woodG([wood([4, 6], [236, 6], 9, 3607), wood([4, 154], [236, 154], 9, 3608), wood([6, 4], [6, 156], 9, 3609), wood([234, 4], [234, 156], 9, 3610)]))
  }
  return svg
}
