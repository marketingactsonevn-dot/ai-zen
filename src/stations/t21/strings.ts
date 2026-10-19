import raw from '../../content/tram-21.json'
import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import { onPrefs } from '../../core/prefs'
import type { SceneCtx } from '../types'
import { blob, clamp, curve, onSize, p2Defs, rng, stableHeight, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist, moon as moonArt, pine, toro as toroArt } from '../../ui/part2/paint'
import { guide, type Mark } from '../../ui/part2/guide'
import { findTakeaway, foldedTakeaway } from '../../ui/part2/takeaway'
import { FRONT, bake, bamboo, col, figure, fit, glow, joints, JI, mix, palette, pick, pose, ramp, toneRamp, veil, type Pal, type RGB, type Sprite, type Tones } from './cv'

const R = raw.scenes.strings

// world (metres): two lanes run away from the finish line along +z and bend left in the distance; the camera orbits a
// pivot between the runners
const ZP = 6, D = 6, CAMH = 1.1, YAW = (35 * Math.PI) / 180
const LANE = 2.3, FIN = 4.4 // half width of the track; z of the finish line and its posts
const RX = [-1.12, 1.12] // the two runners: remote-controlled (left), autonomous (right)
const BAR: [number, number, number] = [-2.05, 2.15, 5.6] // the controller's bar, under the pine bough
const BAR_W = 0.95
const bend = (z: number) => (z > 9 ? -0.0032 * (z - 9) ** 2 : 0)
const ZS = Float32Array.from({ length: 41 }, (_, i) => -1 + 1.6 * (130 / 1.6) ** (i / 40)) // track samples, near → far
// what stands along the track, far → near once sorted by depth: pines (0–2), unlit stone lanterns (3), bamboo rail posts
// on both verges (4); [x, z, height m, kind]
const SIDE: number[][] = (() => {
  const r = rng(2117)
  const a: number[][] = []
  for (let z = 13; z < 74; z += 7 + r() * 6) a.push([(r() < 0.5 ? -1 : 1) * (6 + r() * 4), z, 6 + r() * 2.4, Math.floor(r() * 3)])
  for (const [x, z] of [[-3.7, 8.5], [3.7, 13], [-3.7, 21], [3.7, 29], [-3.7, 40], [3.7, 52], [-3.7, 66]]) a.push([x, z, 1.8, 3])
  for (let z = FIN + 1.2; z < 62; z += 2.3) a.push([-LANE - 0.55, z, 1, 4], [LANE + 0.55, z, 1, 4])
  return a
})()
const NSIDE = SIDE.length
const SZ = new Float32Array(NSIDE), SO = new Int16Array(NSIDE) // camera depth this frame, draw order
const VZ = [44, 26, 14] // where the mist hangs between the depths

/** The pine bough reaching in from beyond the frame, the conical-hat controller sitting on it with the wooden control bar
 *  and a small lamp (art units ≈ 1.85 cm). */
function boughArt(): SVGGElement {
  const r = rng(2104)
  // the limb: thick where the frame cuts it (up left), tapering out over the track; a sub-branch climbing to a pad
  const limb = [...curve([-520, -150], [-190, -40], [60, 40], 18), ...curve([60, 40], [150, 66], [236, 58], 10).slice(1)]
  const twig = curve(limb[15], [limb[15][0] + 26, limb[15][1] - 40], [limb[15][0] + 70, limb[15][1] - 52], 8)
  const twig2 = curve(limb[7], [limb[7][0] + 40, limb[7][1] - 60], [limb[7][0] + 120, limb[7][1] - 70], 8)
  const off = (pts: Pt[], d: number) => pts.map(([x, y], i) => [x, y + d * (1 - i / pts.length)] as Pt)
  let needles = '', pads = ''
  const tips: Pt[] = [limb[4], limb[10], limb[16], limb[22], limb[27], twig[8], twig2[8]]
  tips.forEach(([px, py], k) => {
    const w = 70 + r() * 34
    pads += blob(px, py - 10, w * 0.58, w * 0.22, 2104 + k, 0.24, 16)
    for (let f = 0; f < 3; f++) {
      const ox = px + (f - 1) * w * 0.34 + (r() - 0.5) * 4, oy = py - 3
      for (let j = 0; j < 17; j++) {
        const a = Math.PI * (1.06 + (j / 16) * 0.88) + (r() - 0.5) * 0.08
        const l = w * (0.3 + r() * 0.1)
        needles += stroke([[ox, oy], [ox + Math.cos(a) * l, oy + Math.sin(a) * l * 0.6]], 1.2 + r() * 0.6, 0.05, 0.6, 0.15)
      }
    }
  })
  let bark = ''
  for (let i = 1; i < 16; i++) {
    const [bx, by] = limb[i]
    const w = 40 * (1 - i / 30)
    bark += stroke([[bx - w * 0.5, by - w * 0.08], [bx, by + w * 0.06], [bx + w * 0.4, by - w * 0.02]], 2 + r() * 2, 0.2, 0.3, 0.2)
  }
  // the controller: a conical hat, the face in its shadow, a robe sitting on the bough, legs over the edge, both hands on
  // a wooden control bar with a crosspiece (marionette style)
  const hat = 'M95 36L124 11L153 34Q125 41 95 36Z'
  const body = 'M112 41L136 41Q144 52 146 64L104 64Q106 52 112 41Z' + blob(124, 39, 7, 5.6, 7, 0.1, 10)
  const limbs = stroke(curve([113, 63], [106, 74], [111, 94], 6), 7, 0.1, 0.25, 0.5) + stroke(curve([135, 63], [143, 76], [138, 95], 6), 7, 0.1, 0.25, 0.5) +
    stroke(curve([114, 45], [106, 62], [113, 79], 6), 5.4, 0.1, 0.2, 0.5) + stroke(curve([134, 45], [147, 62], [143, 78], 6), 5.4, 0.1, 0.2, 0.5) +
    blob(113, 80, 3.4, 3, 3, 0.1, 8) + blob(143, 79, 3.4, 3, 4, 0.1, 8)
  return s('g', null,
    s('path', { class: 'p2p-pad', d: pads }),
    s('path', { class: 'p2p-trunk', d: stroke(limb, 46, 0.0, 0.75, 0.12) + stroke(twig, 9, 0.05, 0.6, 0.2) + stroke(twig2, 12, 0.05, 0.6, 0.2) }),
    s('path', { class: 't21-under', d: stroke(off(limb.slice(0, 20), 12), 18, 0.0, 0.6, 0.15) }),
    s('path', { class: 't21-bark', d: bark }),
    s('path', { class: 't21-litedge', d: stroke(off(limb.slice(0, 24), -16), 4, 0.05, 0.5, 0.2) }),
    s('path', { class: 'p2p-needle', d: needles }),
    s('path', { class: 't21-sit', d: body + limbs }),
    s('path', { class: 't21-sit', d: hat }),
    s('path', { class: 't21-hatlit', d: stroke([[125, 12.5], [140, 23], [152, 33]], 2.2, 0.1, 0.3, 0.3) }),
    s('path', { class: 't21-cord', d: stroke([[103, 82], [101.5, 88]], 0.9, 0, 0, 1) }),
    s('ellipse', { class: 't21-lamp', cx: 101, cy: 93, rx: 4.2, ry: 5.4 }),
    s('path', { class: 't21-wood2', d: 'M103 80.6L158 80.1L158.4 85L103.4 85.6Z' }),
    s('path', { class: 't21-wood', d: 'M101.5 78.2L156.5 77.6L158 80.1L103 80.6Z' }),
    s('path', { class: 't21-wood2', d: 'M127.5 73.5L131.5 73.4L132.6 89L128.6 89.1Z' }),
    s('path', { class: 't21-wood', d: 'M127.7 72L131.2 71.9L131.5 73.4L127.5 73.5Z' }))
}
const BAR_ART: Pt = [130, 81] // the bar's centre in the bough art
const LAMP_ART: Pt = [101, 93]
const ART_PER_M = 1 / 0.0185 // ≈ 54 art units per metre

/**
 * Scene 2 · Tự đi hay được giật dây — EYE, low at the finish line, canvas. Two identical ink robots run at us out of the
 * moonlight down a track that bends away between bamboo rails and unlit stone lanterns; a conical-hat controller sits on a
 * pine bough reaching in from beyond the frame, the wooden control bar and a small lamp in hand. The autonomous robot's
 * eyes throw their own cone of light, which pools on the sand; the other's eyes are dark. Pull the bar (the switch):
 * threads tighten from the bar to the left robot's head, hands and knee and catch the moon; its pool of light now comes
 * from the controller's lamp. Drag sideways to walk ±35° round the line: seen edge-on the threads vanish, seen slant they
 * shine. The two times stand on the lane boards at the finish (the winner's sealed in vermilion); first reveal: the
 * controlled lane's board slides back by the ×1.2 rule, leaving a long smear; the three facts come up in the sky.
 */
export function stringsScene(ctx: SceneCtx) {
  p2Defs()
  const stableH = stableHeight(ctx, [R.insight as Fact])
  const low = ctx.quality === 'low'
  const still = low || ctx.reduced

  const sky = s('svg', { class: 't21s-sky', 'aria-hidden': 'true' })
  const cv = h('canvas', { class: 't21s-cv', 'aria-hidden': 'true' })
  const fade = h('canvas', { class: 't21s-cv t21s-fade', 'aria-hidden': 'true' })
  // the bar under the bough is the switch: a hit area over the painted bar (its name is its aria-label; when the threads
  // are on, the name is written small along one of them)
  const toggle = h('button', { class: 't21s-toggle', type: 'button', 'aria-pressed': 'false', 'aria-label': R.toggleAria, onClick: flip })
  // the lane boards: the times written on the boards' faces, laid on them in perspective each frame
  const board = (label: string, time: string, note: string, cls: string) =>
    h('div', { class: `t21s-board ${cls}` }, h('p', { class: 't21s-label' }, label), h('p', { class: 't21s-time' }, time, cls === 'auto' ? h('i', { class: 't21s-seal', 'aria-hidden': 'true' }) : null), h('p', { class: 't21s-note' }, note))
  const tagL = board(R.remoteLabel, R.remoteTime, R.remoteNote, 'remote')
  const tagR = board(R.autoLabel, R.autoTime, R.autoNote, 'auto')
  const facts = h('ul', { class: 't21s-facts' }, ...R.facts.map((f) => ctx.fact(f as Fact, 'li')))
  facts.setAttribute('aria-hidden', 'true')
  const stage = h('div', {
    class: 't21s-stage', role: 'slider', tabindex: '0', 'aria-label': R.turnAria,
    'aria-valuemin': '-35', 'aria-valuemax': '35', 'aria-valuenow': '0', 'aria-valuetext': fill(R.turnValue, { n: 0 }),
  })
  const root = h('div', { class: 't21s' }, h('p', { class: 'visually-hidden' }, R.art), sky, cv, fade, stage, tagL, tagR, facts, toggle)
  if (still) root.classList.add('still')
  ctx.art.append(root)
  ctx.prompt(R.prompt)
  // H1 on the dark-eyed robot (the thing people touch first; a tap on it pulls the strings too) and on the bar
  const gd = guide(ctx)
  const at = (y: number): (() => Pt) => () => {
    const a = ctx.art.getBoundingClientRect(), r = root.getBoundingClientRect()
    return [r.left - a.left + SX(RX[0], ZP), r.top - a.top + SY(y, RX[0], ZP)]
  }
  const dots: Mark[] = [gd.dot(at(1.25), { dir: [0, -1] }), gd.dot(toggle, { dir: [0, 1] })]
  let turnArrow: Mark | null = null

  let W = 0, H = 0, F = 1, cx = 0, hy = 0, port = false, dpr = 1, moonX = 0
  let BW = 0.8, BH = 0.62, BIN = 0 // board size (m) and how far it hangs inward of its post
  let c2: CanvasRenderingContext2D | null = null
  let pal: Pal, ton: Tones[] = []
  let bough: Sprite | null = null, toro: Sprite | null = null, pines: Sprite[] = []
  let warm: HTMLCanvasElement | null = null, shade: HTMLCanvasElement | null = null, cone: HTMLCanvasElement | null = null, veilS: HTMLCanvasElement | null = null, sheen: HTMLCanvasElement | null = null
  let rGround: string[] = [], rTrack: string[] = [], rEdge: string[] = [], rBam: string[] = [], rNode: string[] = []
  let cRake = '', cDash = '', cLine = '', cShadow = '', cThread = '', cGlint = '', cPost = '', cPostHi = '', cBoard = '', cBoardHi = '', cGrain = '', cSmear = '', cSoak = '', cStreak = '', cBamLit = ''
  const fogK = (z: number) => 1 - Math.exp(-z / 38)

  // state
  const P0 = pose(), P1 = pose()
  P0.run = P1.run = 1
  let yaw = 0, yawT = 0, wired = 0, wiredT = 0, streak = 2, back = 0, backT = 0, time = 0, alive = 0, ready = false, first = true
  let cosA = 1, sinA = 0

  // projection about the orbit (x is bent with the track far away)
  const XC = (x: number, z: number) => x * cosA + (z - ZP) * sinA
  const ZC = (x: number, z: number) => -x * sinA + (z - ZP) * cosA + D
  const SX = (x: number, z: number) => cx + (XC(x, z) * F) / Math.max(0.3, ZC(x, z))
  const SY = (y: number, x: number, z: number) => hy + ((CAMH - y) * F) / Math.max(0.3, ZC(x, z))

  function strip(g: CanvasRenderingContext2D, x0: number, x1: number, fills: string | CanvasGradient) {
    g.fillStyle = fills
    g.beginPath()
    for (let i = 0; i < ZS.length; i++) {
      const z = ZS[i], b = bend(z)
      if (ZC(x0 + b, z) > 0.4) g.lineTo(SX(x0 + b, z), SY(0, x0 + b, z))
    }
    for (let i = ZS.length - 1; i >= 0; i--) {
      const z = ZS[i], b = bend(z)
      if (ZC(x1 + b, z) > 0.4) g.lineTo(SX(x1 + b, z), SY(0, x1 + b, z))
    }
    g.fill()
  }
  function line(g: CanvasRenderingContext2D, x: number, z0: number, z1: number) {
    g.beginPath()
    for (let i = 0; i < ZS.length; i++) {
      const z = ZS[i], xb = x + bend(z)
      if (z < z0 || z > z1 || ZC(xb, z) < 0.4) continue
      g.lineTo(SX(xb, z), SY(0, xb, z))
    }
    g.stroke()
  }
  // a veil of mist standing at camera depth zc, up to `top` m
  function airAt(g: CanvasRenderingContext2D, zc: number, top: number, a: number) {
    if (!veilS) return
    const y0 = Math.max(hy + ((CAMH - top) * F) / zc, hy - H * 0.14), y1 = hy + ((CAMH + 0.5) * F) / zc
    if (y1 <= y0) return
    g.globalAlpha = a
    g.drawImage(veilS, 0, y0, W, (y1 - y0) / 0.86)
    g.globalAlpha = 1
  }

  function frame() {
    if (!c2 || !ready) return
    const g = c2
    cosA = Math.cos(yaw)
    sinA = Math.sin(yaw)
    g.clearRect(0, 0, W, H)
    // the sky thickens into mist at the horizon across the whole width
    if (veilS) {
      const vh = H * 0.3
      g.globalAlpha = pal.dark ? 0.85 : 0.75
      g.drawImage(veilS, 0, hy - vh * 0.8, W, vh)
      g.globalAlpha = 1
    }
    // ground in bands from the fog at the horizon to the sand at our feet
    for (let i = 0; i < 16; i++) {
      const y0 = hy + ((H - hy) * i) / 16
      g.fillStyle = pick(rGround, fogK((CAMH * F) / Math.max(1, y0 + (H - hy) / 32 - hy)))
      g.fillRect(0, y0 - 0.5, W, (H - hy) / 16 + 1)
    }
    // the track: verge, two lanes of packed sand darker at their edges, raked lines, the moon's sheen, dashes, the line
    strip(g, -LANE - 0.9, LANE + 0.9, pick(rGround, 0.12))
    strip(g, -LANE, LANE, pick(rTrack, 0.08))
    strip(g, -LANE, -LANE + 0.4, cSoak)
    strip(g, LANE - 0.4, LANE, cSoak)
    strip(g, -0.16, 0.16, cSoak)
    if (sheen) {
      // the moon behind the runners lays a pale column on the sand under itself
      g.save()
      g.beginPath()
      for (let i = 0; i < ZS.length; i++) { const z = ZS[i], b = bend(z); if (ZC(-LANE + b, z) > 0.4) g.lineTo(SX(-LANE + b, z), SY(0, -LANE + b, z)) }
      for (let i = ZS.length - 1; i >= 0; i--) { const z = ZS[i], b = bend(z); if (ZC(LANE + b, z) > 0.4) g.lineTo(SX(LANE + b, z), SY(0, LANE + b, z)) }
      g.clip()
      g.globalAlpha = pal.dark ? 0.32 : 0.55
      const sw = (H - hy) * 0.55
      g.drawImage(sheen, moonX - Math.tan(yaw) * F - sw / 2, hy - 2, sw, (H - hy) * 1.2)
      g.restore()
      g.globalAlpha = 1
    }
    g.strokeStyle = cRake
    g.lineWidth = 0.9
    for (let r = 0; r < 22; r++) line(g, -LANE + 0.1 + r * ((2 * LANE - 0.2) / 21), -1, 70)
    // grit: short dry-brush flecks on the sand, fixed (the runners run on the spot; the dashes scroll)
    g.fillStyle = cStreak
    for (let i = 0; i < GRIT.length; i += 3) {
      const x = GRIT[i], z = GRIT[i + 1], l = GRIT[i + 2]
      if (ZC(x, z) < 0.8) continue
      const xa = SX(x + bend(z), z), ya = SY(0, x, z), xb = SX(x + bend(z + l), z + l), yb = SY(0, x, z + l)
      const w = Math.max(0.5, (0.02 * F) / ZC(x, z))
      g.beginPath()
      g.moveTo(xa - w, ya); g.lineTo(xa + w, ya); g.lineTo(xb, yb)
      g.fill()
    }
    g.strokeStyle = pick(rEdge, 0.2)
    g.lineWidth = 2
    line(g, -LANE, -1, 130)
    line(g, LANE, -1, 130)
    g.lineWidth = 1.4
    line(g, 0, -1, 130)
    g.fillStyle = cDash
    for (let j = 0; j < 12; j++) {
      const z0 = 70 - ((((j * 6 + time * 7) % 72) + 72) % 72), z1 = z0 + 2.4
      if (ZC(-0.6, z0) < 0.5) continue
      for (let k = 0; k < 2; k++) {
        const x = (k ? 1.12 : -1.12) + bend(z0), x1 = x + bend(z1) - bend(z0)
        g.globalAlpha = 1 - fogK(ZC(x, z0))
        g.beginPath()
        g.moveTo(SX(x - 0.04, z0), SY(0, x, z0)); g.lineTo(SX(x + 0.04, z0), SY(0, x, z0)); g.lineTo(SX(x1 + 0.03, z1), SY(0, x1, z1)); g.lineTo(SX(x1 - 0.03, z1), SY(0, x1, z1))
        g.fill()
      }
    }
    g.globalAlpha = 1
    // the finish line, painted across both lanes
    g.fillStyle = cLine
    g.beginPath()
    g.moveTo(SX(-LANE, FIN), SY(0, -LANE, FIN)); g.lineTo(SX(LANE, FIN), SY(0, LANE, FIN)); g.lineTo(SX(LANE, FIN + 0.22), SY(0, LANE, FIN + 0.22)); g.lineTo(SX(-LANE, FIN + 0.22), SY(0, -LANE, FIN + 0.22))
    g.fill()
    // the ×1.2 rule: the controlled lane's board slides back, a long smear where it stood
    const zl = FIN + back * 1.0
    if (back > 0.01) {
      g.fillStyle = cSmear
      g.beginPath()
      const xa = -LANE - 0.2, xb = -LANE + 0.9
      g.moveTo(SX(xa, FIN), SY(0, xa, FIN)); g.lineTo(SX(xb, FIN), SY(0, xb, FIN)); g.lineTo(SX(xb - 0.3, zl), SY(0, xb, zl)); g.lineTo(SX(xa + 0.1, zl), SY(0, xa, zl))
      g.fill()
    }
    // the sides of the track far → near, with mist between the depths
    for (let i = 0; i < NSIDE; i++) {
      SZ[i] = ZC(SIDE[i][0] + bend(SIDE[i][1]), SIDE[i][1])
      let j = i - 1
      while (j >= 0 && SZ[SO[j]] < SZ[i]) (SO[j + 1] = SO[j]), j--
      SO[j + 1] = i
    }
    let vi = 0
    for (let q = 0; q < NSIDE; q++) {
      const i = SO[q], zc = SZ[i]
      while (vi < VZ.length && zc < VZ[vi]) airAt(g, VZ[vi++], 9, pal.dark ? 0.32 : 0.28)
      if (zc < 0.8) continue
      side(g, i, zc)
    }
    while (vi < VZ.length) airAt(g, VZ[vi++], 9, pal.dark ? 0.32 : 0.28)
    // light: the autonomous robot's own eyes; the controller's lamp for the other one (when wired)
    beam(g, RX[1], 1, 1)
    if (wired > 0.02) beam(g, RX[0], 0, wired)
    // long moon shadows toward us and a soft contact pool, then the runners (the farther one first)
    for (let k = 0; k < 2; k++) {
      const x = RX[k], z = ZP
      g.fillStyle = cShadow
      g.beginPath()
      g.moveTo(SX(x - 0.25, z), SY(0, x, z)); g.lineTo(SX(x + 0.25, z), SY(0, x, z)); g.lineTo(SX(x - 1.1, z - 3.2), SY(0, x - 1.1, z - 3.2)); g.lineTo(SX(x - 1.6, z - 3.2), SY(0, x - 1.6, z - 3.2))
      g.fill()
      if (shade) {
        const zc = ZC(x, z), rx = (0.55 * F) / zc, ry = Math.max(2, (0.18 * CAMH * F) / (zc * zc) + 1.5)
        g.globalAlpha = pal.dark ? 0.85 : 0.55
        g.drawImage(shade, SX(x, z) - rx, SY(0, x, z) - ry, rx * 2, ry * 2)
        g.globalAlpha = 1
      }
    }
    const order = XC(RX[0], ZP) * sinA < XC(RX[1], ZP) * sinA ? 0 : 1
    for (let n = 0; n < 2; n++) {
      const k = n ? 1 - order : order
      const x = RX[k]
      const zc = ZC(x, ZP)
      const sx = SX(x, ZP)
      // backlit: the edge toward the moon catches it
      figure(g, sx, SY(0, x, ZP), F / zc, k ? P1 : P0, ton[Math.round(fogK(zc) * (ton.length - 1))], FRONT, sx < moonX - Math.tan(yaw) * F ? 1 : -1, k ? 1 : 0)
    }
    // the two finish posts and their boards
    postAt(g, -1, zl)
    postAt(g, 1, FIN)
    // the bough and its controller, then the threads (in front of everything)
    if (bough) {
      const bz = BAR[2], bx = BAR[0]
      const k = F / ZC(bx, bz)
      const q = k / (ART_PER_M * bough.scale)
      const px = SX(bx, bz), py = SY(BAR[1], bx, bz)
      g.drawImage(bough.cv, px - (bough.ax + BAR_ART[0] * bough.scale) * q, py - (bough.ay + BAR_ART[1] * bough.scale) * q, bough.cv.width * q, bough.cv.height * q)
      // the controller's small lamp glowing at the bar's end
      if (warm) {
        const lx = px + ((LAMP_ART[0] - BAR_ART[0]) * k) / ART_PER_M, ly = py + ((LAMP_ART[1] - BAR_ART[1]) * k) / ART_PER_M
        const r = 0.7 * k
        g.globalAlpha = 0.45 + 0.4 * wired
        g.drawImage(warm, lx - r / 2, ly - r / 2, r, r)
        g.globalAlpha = 1
      }
      threads(g, px, py, k)
      toggle.style.transform = `translate(${(px - 0.55 * k).toFixed(1)}px, ${(py - 0.3 * k).toFixed(1)}px)`
      toggle.style.width = `${(1.1 * k).toFixed(1)}px`
      toggle.style.height = `${Math.max(44, 0.5 * k).toFixed(1)}px`
    }
    place(zl)
  }

  function side(g: CanvasRenderingContext2D, i: number, zc: number) {
    const x = SIDE[i][0] + bend(SIDE[i][1]), z = SIDE[i][1], hm = SIDE[i][2], v = SIDE[i][3]
    const f = fogK(zc)
    if (v === 4) {
      // a bamboo post and its two rails on to the next post along the same verge
      const px = SX(x, z)
      if (px < -60 || px > W + 60) return
      const fi = Math.round(f * 24)
      bamboo(g, px, SY(0, x, z), px, SY(1.0, x, z), clamp((0.075 * F) / zc, 0.7, 30), (0.34 * F) / zc, rBam[fi], rNode[fi], cBamLit, x < 0 ? -1 : 1)
      const z2 = z + 2.3
      if (z2 < 62) {
        const x2 = SIDE[i][0] + bend(z2), rw = clamp((0.05 * F) / zc, 0.5, 20), seg = (0.7 * F) / zc
        bamboo(g, px, SY(0.88, x, z), SX(x2, z2), SY(0.88, x2, z2), rw, seg, rBam[fi], rNode[fi], cBamLit, x < 0 ? -1 : 1)
        bamboo(g, px, SY(0.46, x, z), SX(x2, z2), SY(0.46, x2, z2), rw * 0.9, seg, rBam[fi], rNode[fi], cBamLit, x < 0 ? -1 : 1)
      }
      return
    }
    const sp = v === 3 ? toro : pines[v]
    if (!sp) return
    const q = (F / zc) / ((v === 3 ? 100 : 400) / hm * sp.scale)
    g.globalAlpha = 1 - f * 0.35
    g.drawImage(sp.cv, SX(x, z) - sp.ax * q, SY(0, x, z) - sp.ay * q, sp.cv.width * q, sp.cv.height * q)
    g.globalAlpha = 1
  }

  // a cone of light from the eyes (own) or from the lamp up in the pine onto the sand ahead of the runner: a sprite with
  // its own falloff, mapped apex → source and base → the two sides of the pool, then the pool itself, an ellipse on the sand
  function beam(g: CanvasRenderingContext2D, x: number, own: number, a: number) {
    const z0 = ZP - 1.6
    const tx = SX(x, z0), ty = SY(0, x, z0)
    const zc0 = ZC(x, z0), kz = F / zc0
    let ox: number, oy: number
    if (own) {
      const k = F / ZC(x, ZP)
      const J = joints(P1)
      ox = SX(x, ZP) + J[JI.HEAD] * k
      oy = SY(0, x, ZP) - (J[JI.HEAD + 1] + 0.02) * k
    } else {
      const k = F / ZC(BAR[0], BAR[2])
      ox = SX(BAR[0], BAR[2]) + ((LAMP_ART[0] - BAR_ART[0]) * k) / ART_PER_M
      oy = SY(BAR[1], BAR[0], BAR[2]) + ((LAMP_ART[1] - BAR_ART[1]) * k) / ART_PER_M
    }
    const sp = 0.6 * kz
    if (cone) {
      const blx = tx - sp, brx = tx + sp
      const ca = (brx - blx) / 64, cb = 0
      const cc = (blx - ox + 32 * ca) / 256, cd = (ty - oy + 32 * cb) / 256
      g.globalAlpha = (pal.dark ? 0.75 : 0.9) * a
      g.setTransform(dpr * ca, dpr * cb, dpr * cc, dpr * cd, dpr * (ox - 32 * ca), dpr * (oy - 32 * cb))
      g.drawImage(cone, 0, 0)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    if (warm) {
      // the pool: a ground ellipse ~1.3 × 1.1 m where the cone lands, its depth squashed by the low eye; a brighter core
      const ry = Math.max(3, (SY(0, x, z0 - 0.55) - SY(0, x, z0 + 0.55)) / 2)
      g.globalAlpha = (pal.dark ? 0.75 : 0.42) * a
      g.drawImage(warm, tx - sp * 1.15, ty - ry * 1.2, sp * 2.3, ry * 2.4)
      g.globalAlpha = (pal.dark ? 0.55 : 0.5) * a
      g.drawImage(warm, tx - sp * 0.55, ty - ry * 0.55, sp * 1.1, ry * 1.1)
    }
    g.globalAlpha = 1
  }

  // a finish post (dir -1 left, 1 right) with its board: a stake and a wooden plaque facing us, the time laid on it in DOM
  const BQ = new Float32Array(12) // the two boards' screen corners: TL, TR, BL per board
  function postAt(g: CanvasRenderingContext2D, dir: number, z: number) {
    const x = dir * (LANE + 0.15)
    const zc = ZC(x, z)
    if (zc < 0.5) return
    const k = F / zc
    const px = SX(x, z), y0 = SY(0, x, z), y1 = SY(BH + 0.62, x, z)
    g.strokeStyle = cPost
    g.lineCap = 'butt'
    g.lineWidth = 0.11 * k
    g.beginPath(); g.moveTo(px, y0); g.lineTo(px, y1); g.stroke()
    g.strokeStyle = cPostHi
    g.lineWidth = Math.max(1, 0.016 * k)
    g.beginPath(); g.moveTo(px - 0.045 * k, y0 - 0.04 * k); g.lineTo(px - 0.045 * k, y1); g.stroke()
    // the plaque: its face, a lit top edge, a shadowed lower edge; hung inward of the post on narrow screens
    const xc0 = x - dir * BIN, xa = xc0 - BW / 2, xb = xc0 + BW / 2, ya = 0.62 + BH, yb = 0.62
    const o = dir < 0 ? 0 : 6
    BQ[o] = SX(xa, z); BQ[o + 1] = SY(ya, xa, z); BQ[o + 2] = SX(xb, z); BQ[o + 3] = SY(ya, xb, z); BQ[o + 4] = SX(xa, z); BQ[o + 5] = SY(yb, xa, z)
    const xbr = SX(xb, z), ybr = SY(yb, xb, z)
    g.fillStyle = cBoard
    g.beginPath()
    g.moveTo(BQ[o], BQ[o + 1]); g.lineTo(BQ[o + 2], BQ[o + 3]); g.lineTo(xbr, ybr); g.lineTo(BQ[o + 4], BQ[o + 5])
    g.fill()
    // a few grain lines along the planks, a dark frame, the moon on the top edge
    g.strokeStyle = cGrain
    g.lineWidth = Math.max(0.6, 0.006 * k)
    g.beginPath()
    for (let q = 1; q < 4; q++) {
      const t = q / 4 + 0.03 * Math.sin(q * 5)
      g.moveTo(BQ[o] + (BQ[o + 4] - BQ[o]) * t, BQ[o + 1] + (BQ[o + 5] - BQ[o + 1]) * t)
      g.lineTo(BQ[o + 2] + (xbr - BQ[o + 2]) * t, BQ[o + 3] + (ybr - BQ[o + 3]) * t)
    }
    g.stroke()
    g.strokeStyle = cPost
    g.lineWidth = Math.max(1.2, 0.028 * k)
    g.beginPath()
    g.moveTo(BQ[o], BQ[o + 1]); g.lineTo(BQ[o + 2], BQ[o + 3]); g.lineTo(xbr, ybr); g.lineTo(BQ[o + 4], BQ[o + 5]); g.closePath()
    g.stroke()
    g.strokeStyle = cBoardHi
    g.lineWidth = Math.max(1, 0.012 * k)
    g.beginPath(); g.moveTo(BQ[o], BQ[o + 1] - 0.012 * k); g.lineTo(BQ[o + 2], BQ[o + 3] - 0.012 * k); g.stroke()
  }

  // threads from the bar to the left runner's head, hands and knee: slack → taut, brighter the more slant we look
  const PICK = [JI.HEAD, JI.HAND_L, JI.HAND_R, JI.KNEE_L]
  function threads(g: CanvasRenderingContext2D, bx: number, by: number, k: number) {
    if (wired < 0.01) return
    const x = RX[0]
    const kr = F / ZC(x, ZP)
    const rx = SX(x, ZP), ry = SY(0, x, ZP)
    const J = joints(P0)
    const shine = 0.18 + 0.82 * Math.min(1, Math.abs(yaw) / YAW)
    g.lineCap = 'round'
    for (let i = 0; i < 4; i++) {
      const ax = bx + (-0.5 + i / 3) * BAR_W * cosA * k, ay = by + 0.03 * k
      const jx = rx + J[PICK[i]] * kr, jy = ry - (J[PICK[i] + 1] + (i ? 0 : 0.14)) * kr
      const sag = (1 - wired) * 60
      const mx = (ax + jx) / 2, my = (ay + jy) / 2 + sag
      g.globalAlpha = wired * shine
      g.strokeStyle = cThread
      g.lineWidth = 1.1
      g.beginPath()
      g.moveTo(ax, ay)
      g.quadraticCurveTo(mx, my, jx, jy)
      g.stroke()
      if (i === 1 && wired > 0.6) {
        // its name, written small along the thread
        g.save()
        g.globalAlpha = (wired - 0.6) * 2.5 * (0.45 + 0.55 * shine)
        g.translate(ax + (jx - ax) * 0.42, ay + (jy - ay) * 0.42 + sag * 0.4)
        let ang = Math.atan2(jy - ay, jx - ax)
        if (Math.abs(ang) > Math.PI / 2) ang += Math.PI
        g.rotate(ang)
        g.fillStyle = cThread
        g.font = `500 ${port ? 10 : 11}px ${pal.sans}`
        g.fillText(R.toggle, 6, -4)
        g.restore()
      }
      // a silver glint running down the thread after the pull
      if (streak < 1.2) {
        const u = clamp(streak - i * 0.06, 0, 1), u0 = Math.max(0, u - 0.12)
        g.globalAlpha = (1 - u) * (0.5 + 0.5 * shine)
        g.strokeStyle = cGlint
        g.lineWidth = 2.4
        g.beginPath()
        g.moveTo(ax + (jx - ax) * u0, ay + (jy - ay) * u0)
        g.lineTo(ax + (jx - ax) * u, ay + (jy - ay) * u)
        g.stroke()
      }
    }
    g.globalAlpha = 1
  }

  // DOM riding the world: each board's words laid on its face (an affine fit to three corners)
  function place(zl: number) {
    sky.style.transform = `translate3d(${(-Math.tan(yaw) * F).toFixed(1)}px, 0, 0)`
    for (let n = 0; n < 2; n++) {
      const el = n ? tagR : tagL, o = n ? 6 : 0
      const a = (BQ[o + 2] - BQ[o]) / bwPx, b = (BQ[o + 3] - BQ[o + 1]) / bwPx, c = (BQ[o + 4] - BQ[o]) / bhPx, d = (BQ[o + 5] - BQ[o + 1]) / bhPx
      el.style.transform = `matrix(${a.toFixed(4)},${b.toFixed(4)},${c.toFixed(4)},${d.toFixed(4)},${BQ[o].toFixed(1)},${BQ[o + 1].toFixed(1)})`
    }
    void zl
  }
  let bwPx = 168, bhPx = 128 // the boards' native size in CSS px (style.css), read per layout

  const loop = createLoop(root, (_t, dt) => {
    if (!ready) return false
    time += dt
    alive = Math.max(0, alive - dt)
    if (!still) {
      P0.phase = time * 1.45
      P1.phase = time * 1.45 + 0.5
    }
    const f = dt > 0 ? 1 - Math.exp(-dt * 7) : 1
    yaw += (yawT - yaw) * f
    wired += (wiredT - wired) * (dt > 0 ? 1 - Math.exp(-dt * 6) : 1)
    back += (backT - back) * (dt > 0 ? 1 - Math.exp(-dt * 1.6) : 1)
    if (streak < 1.2) streak += dt / 0.9
    frame()
    return alive > 0 || Math.abs(yawT - yaw) > 0.001 || Math.abs(wiredT - wired) > 0.004 || Math.abs(backT - back) > 0.004 || streak < 1.2
  })
  ctx.onCleanup(() => loop.dispose())
  const kick = () => {
    alive = still ? 0 : 10
    if (still) {
      yaw = yawT; wired = wiredT; back = backT; streak = 2
      loop.wake()
    } else loop.start()
  }

  function flip() {
    const on = toggle.getAttribute('aria-pressed') !== 'true'
    toggle.setAttribute('aria-pressed', String(on))
    root.classList.toggle('wired', on)
    if (still && ready) crossfade()
    wiredT = on ? 1 : 0
    if (on) streak = 0
    ctx.chime(on ? 'tap' : 'soft')
    if (first) {
      first = false
      backT = 1
      root.classList.add('shown')
      facts.removeAttribute('aria-hidden')
      ctx.insight(R.insight as Fact, R.detail as Fact)
      dots.forEach((d) => d.done())
      // the station's card (audit v3 t21: it had none), handed here as a folded slip
      const card = findTakeaway(raw.takeaways[0])
      if (card) root.append(h('div', { class: 't21s-card' }, foldedTakeaway([card], ctx.onCleanup)))
      if (!still) {
        // the hidden gesture: walk round the finish line to see the strings catch the moon from the side
        ctx.prompt(R.steps[0])
        turnArrow = gd.gesture('drag-h', at(-0.15), { r: 46 })
      }
    }
    kick()
  }
  function crossfade() {
    const g = fade.getContext('2d')
    if (!g) return
    fade.width = cv.width
    fade.height = cv.height
    g.drawImage(cv, 0, 0)
    fade.getAnimations().forEach((a) => a.cancel())
    if (!ctx.reduced) fade.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: 'ease-out', fill: 'forwards' })
  }

  // turn round the finish line: drag sideways, or ← → on the stage
  const setYaw = (deg: number) => {
    const d = Math.round(clamp(deg, -35, 35))
    yawT = (d * Math.PI) / 180
    stage.setAttribute('aria-valuenow', String(d))
    stage.setAttribute('aria-valuetext', fill(R.turnValue, { n: d }))
    kick()
  }
  let drag: { id: number; x: number; y0: number } | null = null
  let tap: { x: number; y: number } | null = null
  root.addEventListener('pointerdown', (e) => {
    if (e.button || (e.target as Element).closest('.t21s-toggle, .t21s-facts')) return
    tap = { x: e.clientX, y: e.clientY }
    if (still) return
    drag = { id: e.pointerId, x: e.clientX, y0: (yawT * 180) / Math.PI }
    root.setPointerCapture(e.pointerId)
    root.classList.add('grab')
  })
  root.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return
    setYaw(drag.y0 - ((e.clientX - drag.x) / Math.max(200, W)) * 90)
    if (turnArrow && Math.abs(e.clientX - drag.x) > 24) turnArrow.done(), (turnArrow = null)
  })
  // a tap (no drag) on the dark-eyed robot: who is steering it? — the same as pulling the bar
  root.addEventListener('pointerup', (e) => {
    const t = tap
    tap = null
    if (!t || Math.hypot(e.clientX - t.x, e.clientY - t.y) > 8) return
    const r = root.getBoundingClientRect()
    const px = e.clientX - r.left, py = e.clientY - r.top
    const x0 = SX(RX[0], ZP), y0 = SY(0, RX[0], ZP), y1 = SY(1.9, RX[0], ZP)
    if (Math.abs(px - x0) < Math.max(30, (y0 - y1) * 0.32) && py > y1 && py < y0) flip()
  })
  const end = () => {
    drag = null
    root.classList.remove('grab')
  }
  root.addEventListener('pointerup', end)
  root.addEventListener('pointercancel', end)
  stage.addEventListener('keydown', (e) => {
    const k = ({ ArrowRight: 7, ArrowUp: 7, ArrowLeft: -7, ArrowDown: -7 } as Record<string, number>)[e.key]
    const deg = Math.round((yawT * 180) / Math.PI)
    const to = k ? deg + k : e.key === 'Home' ? -35 : e.key === 'End' ? 35 : NaN
    if (Number.isNaN(to) || still) return
    e.preventDefault()
    setYaw(to)
  })

  function colours() {
    pal = palette()
    ton = toneRamp(pal, true)
    const p = pal
    rGround = ramp(p.dark ? mix(p.paper, p.rockLo, 0.5) : mix(p.paper2, p.rockMid, 0.3), p.fog)
    rTrack = ramp(p.dark ? mix(p.stepLo, p.paper, 0.25) : mix(p.stepHi, p.stepMid, 0.4), p.fog)
    rEdge = ramp(p.dark ? mix(p.ink3, p.paper, 0.3) : p.wash, p.fog, 24, p.dark ? 0.7 : 0.55)
    const stem = p.dark ? mix(mix(p.moss, p.lantern, 0.22), p.paper, 0.25) : mix(mix(p.moss, p.lantern, 0.2), p.wash, 0.18)
    rBam = ramp(stem, p.fog)
    rNode = ramp(mix(stem, p.umbra, 0.6), p.fog)
    cBamLit = p.dark ? col(p.moon, 0.38) : 'rgba(255,255,255,0.5)'
    cRake = p.dark ? col(p.moon, 0.06) : col(p.wash, 0.08)
    cDash = p.dark ? col(p.moon, 0.4) : 'rgba(255,255,255,0.95)'
    cLine = p.dark ? col(p.moon, 0.55) : 'rgba(255,255,255,0.95)'
    cShadow = p.dark ? 'rgba(0,0,0,0.4)' : col(p.umbra, 0.14)
    cThread = p.dark ? col(p.moon, 0.95) : col(p.ink2, 0.9)
    cGlint = p.dark ? col(mix(p.moon, [255, 255, 255], 0.5), 1) : 'rgba(255,255,255,1)'
    cPost = p.dark ? col(mix(p.rockLo, p.umbra, 0.2)) : col(mix(p.wash, p.rockLo, 0.55))
    cPostHi = p.dark ? col(p.moon, 0.6) : 'rgba(255,255,255,0.8)'
    // the plaque: pale weathered wood that carries ink (light) / a moonlit grey board that carries ivory (dark)
    cBoard = p.dark ? col(mix(p.rockLo, p.paper, 0.15)) : col(mix(mix(p.rockHi, p.stepMid, 0.35), p.lantern, 0.14))
    cBoardHi = p.dark ? col(p.moon, 0.55) : 'rgba(255,255,255,0.9)'
    cGrain = p.dark ? col(p.umbra, 0.3) : col(p.wash, 0.1)
    cSmear = p.dark ? 'rgba(0,0,0,0.35)' : col(p.wash, 0.12)
    cSoak = p.dark ? col(p.umbra, 0.22) : col(p.wash, 0.07)
    cStreak = p.dark ? col(p.moon, 0.08) : col(p.wash, 0.1)
  }
  function* sprites() {
    const p = pal
    const scale = Math.min(devicePixelRatio || 1, low ? 1 : 1.5) * 1.1
    // solid ink: the bough a silhouette against the moonlit sky, the controller darker still
    const trunk = col(p.dark ? mix(p.paper, p.umbra, 0.4) : mix(p.wash, p.fog, 0.12))
    const pad = col(p.dark ? mix(p.paper, p.fog, 0.5) : mix(p.wash, p.fog, 0.45))
    const needle = col(p.dark ? mix(p.paper, p.fog, 0.16) : p.wash)
    const sit = col(p.dark ? mix(p.paper, p.umbra, 0.7) : mix(p.wash, p.umbra, 0.3))
    const lit = p.dark ? col(p.moon) : 'rgba(255,255,255,1)'
    bough = bake(boughArt(), { x: -540, y: -175, w: 920, h: 300 }, scale, (cls) =>
      cls.includes('p2p-pad') ? { fill: pad, alpha: 0.95, soft: low ? 0 : 2 }
      : cls.includes('p2p-trunk') ? { fill: trunk, alpha: 1, soft: low ? 0 : 0.8 }
      : cls.includes('t21-under') ? { fill: col(p.umbra), alpha: p.dark ? 0.5 : 0.28 }
      : cls.includes('t21-bark') ? { fill: col(p.dark ? p.umbra : p.wash), alpha: 0.45 }
      : cls.includes('t21-litedge') ? { fill: lit, alpha: p.dark ? 0.42 : 0.6 }
      : cls.includes('p2p-needle') ? { fill: needle, alpha: 0.85 }
      : cls.includes('t21-sit') ? { fill: sit, alpha: 1 }
      : cls.includes('t21-hatlit') ? { fill: lit, alpha: p.dark ? 0.85 : 0.9 }
      : cls.includes('t21-cord') ? { fill: sit, alpha: 0.8 }
      : cls.includes('t21-lamp') ? { fill: col(p.lantern), alpha: 1 }
      : cls.includes('t21-wood2') ? { fill: col(mix(mix(p.lantern, p.rockLo, 0.55), p.umbra, p.dark ? 0.45 : 0.25)), alpha: 1 }
      : cls.includes('t21-wood') ? { fill: col(mix(p.lantern, p.rockMid, p.dark ? 0.55 : 0.4)), alpha: 1 }
      : null)
    yield
    const treePaint = (cls: string) =>
      cls.includes('p2p-pad') ? { fill: pad, alpha: 0.95, soft: low ? 0 : 1.4 }
      : cls.includes('p2p-trunk') ? { fill: trunk, alpha: 0.95, soft: low ? 0 : 0.7 }
      : cls.includes('p2p-bark') ? { fill: pad, alpha: 0.6 }
      : cls.includes('p2p-needle') ? { fill: needle, alpha: 0.85 }
      : null
    const sc = Math.min(devicePixelRatio || 1, low ? 1 : 1.25) * 0.6
    pines = [0, 1, 2].map((v) => bake(pine(0, 0, 400, 2170 + v * 5, v === 1 ? -1 : 1), { x: -320, y: -540, w: 660, h: 560 }, sc, treePaint))
    yield
    toro = bake(toroArt(0, 0, 100, false), { x: -40, y: -100, w: 80, h: 104 }, sc * 2, (cls, g2) => {
      if (cls.includes('p2p-toro-stone')) {
        const gr = g2.createLinearGradient(0, -95, 12, 0)
        gr.addColorStop(0, col(p.rockHi)); gr.addColorStop(0.55, col(p.rockMid)); gr.addColorStop(1, col(p.rockLo))
        return { fill: gr }
      }
      if (cls.includes('p2p-toro-shade')) {
        const gr = g2.createLinearGradient(-20, 0, 20, 0)
        gr.addColorStop(0, col(p.umbra, 0)); gr.addColorStop(0.55, col(p.umbra, 0.08)); gr.addColorStop(1, col(p.umbra, 0.42))
        return { fill: gr }
      }
      if (cls.includes('p2p-toro-fire')) return { fill: col(p.umbra), alpha: 0.55 }
      if (cls.includes('p2p-toro-ink')) return { fill: col(p.wash), alpha: 0.45 }
      return null
    })
    warm = glow(p.lantern, 64, 0.5)
    shade = glow(p.dark ? [0, 0, 0] : p.wash, 64, 0.7)
    veilS = veil(p.fog)
    sheen = glow(p.dark ? p.moon : mix(p.moon, [255, 255, 255], 0.5), 64, 0.7)
    cone = coneSprite(p.lantern)
    yield
  }
  /** A cone of light 64 × 256, apex at the top centre: bright at the source, falling off toward the ground, soft edges. */
  function coneSprite(c0: RGB) {
    const cvC = document.createElement('canvas')
    cvC.width = 64
    cvC.height = 256
    const g = cvC.getContext('2d')!
    const gr = g.createLinearGradient(0, 0, 0, 256)
    gr.addColorStop(0, col(c0, 0.85))
    gr.addColorStop(0.3, col(c0, 0.42))
    gr.addColorStop(1, col(c0, 0.16))
    g.fillStyle = gr
    // nested wedges: the core is denser than the edge
    for (let i = 0; i < 5; i++) {
      const w = 32 * (1 - i * 0.17)
      g.globalAlpha = 0.34
      g.beginPath()
      g.moveTo(32, 0)
      g.lineTo(32 + w, 256)
      g.lineTo(32 - w, 256)
      g.fill()
    }
    return cvC
  }
  function backdrop() {
    const span = W + 2 * F * Math.tan(YAW) + 40
    const x0 = (W - span) / 2
    sky.setAttribute('viewBox', `${x0.toFixed(0)} 0 ${span.toFixed(0)} ${H.toFixed(0)}`)
    sky.style.left = `${x0.toFixed(0)}px`
    sky.style.width = `${span.toFixed(0)}px`
    const base = hy + 2
    const mr = Math.min(W, H) * (port ? 0.06 : 0.045)
    // the moon behind the runners, a little left of centre: their left edges catch it
    const mx = (moonX = W * (port ? 0.42 : 0.44))
    sky.replaceChildren(
      mist(W * 0.5, base - H * 0.16, span * 0.4, H * 0.2),
      moonArt(mx, base - H * (port ? 0.24 : 0.22), mr, 2101, true),
      hills(x0, x0 + span, base, H * 0.15, 2161, 0.9, Math.round(span / 260)),
      hills(x0 + span * 0.45, x0 + span * 0.95, base + 1, H * 0.1, 2162, 0.62, 3),
      mist(W * 0.5, base, span * 0.45, H * 0.05),
    )
  }
  function layout() {
    const aw = ctx.art.clientWidth, w = root.clientWidth || aw, hh = stableH(ctx.art.clientHeight)
    if (aw < 60 || hh < 60) return
    // one read of the boards' native size (CSS), before any write
    bwPx = tagL.offsetWidth || bwPx
    bhPx = tagL.offsetHeight || bhPx
    root.style.height = `${hh.toFixed(1)}px`
    W = w
    H = hh
    port = H > aw * 1.05
    BAR[0] = port ? -1.5 : -2.05
    // portrait: the scene rides up, the facts take the foot of the picture; the boards hang inward of their posts
    hy = Math.round(H * (port ? 0.42 : 0.55))
    F = port ? W * 0.95 : Math.min(W * 0.6, H * 1.25)
    cx = W * 0.5
    BW = port ? 1.25 : 0.72
    BH = port ? 1.12 : 0.56
    BIN = port ? 0.72 : 0
    const r = fit(cv, W, H, low ? 1 : 1.75)
    c2 = r.c
    dpr = r.d
    root.classList.toggle('port', port)
    backdrop()
    if (ready) frame()
  }

  colours()
  ctx.onCleanup(onSize(ctx.art, () => (layout(), gd.refresh()))) // the guide's marks follow the robot's new place
  let job: ReturnType<typeof sliced> | null = null
  ctx.onCleanup(onPrefs(() => {
    const before = pal
    colours()
    if (before.dark === pal.dark && before.paper.join() === pal.paper.join()) return
    job?.cancel()
    job = sliced(sprites(), { sync: ctx.reduced })
    job.done.then(frame)
  }))
  job = sliced(sprites(), { sync: ctx.reduced })
  ctx.onCleanup(() => job?.cancel())
  job.done.then(() => {
    ready = true
    root.classList.add('ready')
    P0.phase = 0.1
    P1.phase = 0.6
    kick()
    frame()
  })
}

// dry-brush flecks on the sand: x, z, length (m)
const GRIT = (() => {
  const r = rng(2119)
  return Float32Array.from(Array.from({ length: 90 * 3 }, (_, i) => [-LANE + 0.1 + r() * (2 * LANE - 0.2), 0.5 + r() ** 1.6 * 40, 0.3 + r() * 1.2][i % 3]))
})()
