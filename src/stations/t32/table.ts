import raw from '../../content/tram-32.json'
import { fill, h } from '../../core/dom'
import type { Fact } from '../../core/content'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import { onPrefs } from '../../core/prefs'
import { blob, curve, rng, type Pt } from '../../ui/part2/ink'
import type { Detail, SceneCtx } from '../types'
import { guide, type Mark } from '../../ui/part2/guide'
import { brush, camera, cardSheet, clamp, ease, easeOut, fit, fitCamera, flatEllipse, flatSprite, grainOver, live, mix, palette, poly, polyClip, rgba, softPool, stageSize, type Cam, type Pal, type RGB, type V3 } from './kit'

const K = raw.scenes.table
type Model = (typeof K.models)[number]
const num = (n: number) => n.toLocaleString(document.documentElement.lang || 'vi')
const RAMS = K.ramOptions
/** table length (m) for a RAM size: a gentle power keeps 8 → 64 GB inside one close frame; every ratio on the table is exact */
const LEN = (ram: number) => 1.75 * (ram / 8) ** 0.2
const ROWS = [[3, 2], [4, 3, 2], [5, 4, 3], [5, 4, 3, 2], [6, 5, 4, 3]]
/** roll radius of model k on the table / on the shelf (m) */
const RT = (k: number) => 0.036 + k * 0.003
const RS = (k: number) => 0.02 + k * 0.0016

/** Where things stand in the room (garden metres, y up, the camera on +z). Wide and tall screens get their own room. */
function room(tall: boolean) {
  // tl: the table's length scale (a phone gets a shorter room); the ratios on the table do not change with it
  // a tea room: the round window sits low (people sit on the floor), the table close under it, the camera close in
  return tall
    ? { tall, tl: 0.8, wallZ: -1.75, TY: 0.36, zB: -1.3, zF: -0.78, xR: 0.74, win: { x: -0.1, y: 1.1, r: 0.54 }, shelf: { x0: -1.0, x1: 0.98, y: 1.98, d: 0.24 }, lamp: { x: 0.66, z: -1.56 }, press: { x: 0.66, z: 0.06 }, rule: { x0: -1.02, x1: 0.98, y0: 2.2, y1: 2.62 }, yaw: 4, pitch: 25, fov: 46 }
    : { tall, tl: 1.25, wallZ: -1.75, TY: 0.36, zB: -1.38, zF: -0.74, xR: 1.05, win: { x: -0.5, y: 1.04, r: 0.62 }, shelf: { x0: -2.3, x1: -1.28, y: 1.02, d: 0.22 }, lamp: { x: 0.86, z: -1.56 }, press: { x: 1.54, z: -1.02 }, rule: { x0: 0.38, x1: 1.34, y0: 1.06, y1: 1.56 }, yaw: 9, pitch: 18, fov: 34 }
}
type Room = ReturnType<typeof room>

/** One roll of a bundle: row j (0 = bottom), y above the base, z offset from the bundle's middle, a little x jitter. */
type Roll = { y: number; z: number; ja: number; jb: number; spin: number }
function rollsOf(k: number, r: number, seed: number): Roll[] {
  const rr = rng(seed)
  const out: Roll[] = []
  ROWS[k].forEach((n, j) => {
    for (let d = 0; d < n; d++) out.push({ y: r + j * r * 1.72, z: (d - (n - 1) / 2) * r * 2.04, ja: rr() * r * 1.4, jb: rr() * r * 1.4, spin: rr() * 6.3 })
  })
  return out
}
/** the rolls that roll off the front edge first: the front of the top rows */
const spillOrder = (rolls: Roll[]) => rolls.map((_, i) => i).sort((a, b) => rolls[b].z - rolls[a].z || rolls[b].y - rolls[a].y)

type Sprites = { roll: HTMLCanvasElement; rollQ: HTMLCanvasElement; moon: HTMLCanvasElement; lamp: HTMLCanvasElement; shade: HTMLCanvasElement; pool: HTMLCanvasElement; sheet: () => HTMLCanvasElement }
function sprites(P: Pal): Sprites {
  const cv = (w: number, hh: number, paint: (c: CanvasRenderingContext2D) => void) => {
    const e = document.createElement('canvas')
    e.width = w
    e.height = hh
    paint(e.getContext('2d')!)
    return e
  }
  const paper = mix(P['step-hi'], P.moon, P.dark ? 0.3 : 0.4)
  let sheet: HTMLCanvasElement | undefined
  const lin = (q: boolean) => cv(4, 64, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 64)
    // moonlit crown → paper → the shaded belly → a little light bounced off the table
    g.addColorStop(0, rgba(mix(paper, P.moon, 0.7)))
    g.addColorStop(0.18, rgba(paper))
    g.addColorStop(0.55, rgba(mix(paper, P['step-lo'], q ? 0.55 : 0.4)))
    g.addColorStop(0.86, rgba(mix(P['step-lo'], P.umbra, P.dark ? 0.55 : 0.35)))
    g.addColorStop(1, rgba(mix(P['step-lo'], P.lantern, 0.25)))
    c.fillStyle = g
    c.fillRect(0, 0, 4, 64)
  })
  const rad = (col: RGB, a0: number, a1 = 0) => cv(64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, rgba(col, a0))
    g.addColorStop(0.45, rgba(col, a0 * 0.55))
    g.addColorStop(1, rgba(col, a1))
    c.fillStyle = g
    c.fillRect(0, 0, 64, 64)
  })
  return {
    roll: lin(false), rollQ: lin(true),
    moon: rad(P.moon, 1), lamp: rad(P.lantern, 1), shade: rad(P.umbra, 1),
    pool: cv(128, 128, (c) => {
      // the moon's pool: the window's round of light, bright and even, soft at its rim, the pine bough's shadow across it
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 64)
      g.addColorStop(0, rgba(P.moon, 1))
      g.addColorStop(0.62, rgba(P.moon, 0.88))
      g.addColorStop(0.84, rgba(P.moon, 0.32))
      g.addColorStop(1, rgba(P.moon, 0))
      c.fillStyle = g
      c.fillRect(0, 0, 128, 128)
      c.globalCompositeOperation = 'destination-out'
      const r = rng(3295)
      c.fillStyle = 'rgba(0,0,0,0.42)'
      c.fill(brush(curve([-6, 30], [40, 44], [84, 24], 12), 7, 0.02, 0.6, 0.3))
      for (let i = 0; i < 70; i++) {
        const x = 8 + r() * 76, y = 14 + r() * 26, a = -Math.PI * (0.15 + r() * 0.7), l = 6 + r() * 9
        c.fill(brush([[x, y], [x + Math.cos(a) * l, y + Math.sin(a) * l]], 1.4, 0.05, 0.6, 0.2))
      }
    }),
    // painted on first use (a scroll only unrolls after a spill), not at mount
    sheet: () => (sheet ??= cv(96, 256, (c) => {
      // the unrolled paper: washi, columns of brushed characters running down it, a red seal at the foot
      c.fillStyle = rgba(paper)
      c.fillRect(0, 0, 96, 256)
      const r = rng(3297)
      c.fillStyle = rgba(P['step-lo'], 0.08)
      for (let i = 0; i < 90; i++) c.fillRect(r() * 96, r() * 256, 0.6, 6 + r() * 20)
      const inkC = P.dark ? mix(P.wash, P.umbra, 0.5) : P.ink
      for (let col = 0; col < 5; col++) {
        const x = 80 - col * 15
        for (let y = 14; y < 220 - (col % 3) * 30; y += 13) {
          const n = 2 + Math.floor(r() * 4)
          for (let k = 0; k < n; k++) {
            const sx = x - 5 + r() * 8, sy = y + r() * 9, a = r() < 0.5 ? (r() - 0.5) * 0.4 : Math.PI / 2 + (r() - 0.5) * 0.5, l = 3 + r() * 6
            c.fillStyle = rgba(inkC, 0.7 + r() * 0.3)
            c.fill(brush([[sx, sy], [sx + Math.cos(a) * l, sy + Math.sin(a) * l]], 1.8 + r() * 1.4, 0.1, 0.5, 0.3))
          }
        }
      }
      c.fillStyle = rgba(P.vermilion, 0.85)
      c.fillRect(10, 222, 12, 12)
      c.fillStyle = rgba(paper, 0.7)
      c.fillRect(13, 225, 2, 6)
      c.fillRect(17, 225, 2, 6)
      const e = c.createLinearGradient(0, 0, 96, 0)
      e.addColorStop(0, rgba(P.umbra, 0.12))
      e.addColorStop(0.12, rgba(P.umbra, 0))
      e.addColorStop(0.88, rgba(P.umbra, 0))
      e.addColorStop(1, rgba(P.umbra, 0.16))
      c.fillStyle = e
      c.fillRect(0, 0, 96, 256)
    })),
  }
}

/** Scene 2 ★ — a low tea table under a round moon window: the table top is your RAM, each model a bundle of scrolls. */
export function tableScene(ctx: SceneCtx) {
  const low = ctx.quality === 'low'
  const still = low || ctx.reduced
  let ram = 16
  // starts at the 4-bit version: the 8B fits a 16 GB table the first time; the press shows how heavy the original is
  let q4 = true
  let sel = -1 // the model on the table
  let placed = 0
  const told = new Set<string>()

  // ── state of things (animated in the stage's one loop) ──
  let Lnow = LEN(ram) // table length shown (scaled by the room on layout)
  let Lfrom = Lnow, Lto = Lnow, tL = 1
  let lenNow = 0, lenFrom = 0, lenTo = 0, tLen = 1 // bundle length on the table
  let pressQ = 1, pressFrom = 1, pressTo = 1, tPress = 1, crank = 0
  let spillN = 0, tSpill = 1 // rolls rolled off, their roll-out progress
  let fly: { k: number; t: number; from: [number, number, number, number, number]; back: boolean } | null = null
  let drag: { k: number; x: number; z: number } | null = null
  let nudge = 0, tNudge = 1
  let hover = -1

  const gbOf = (m: Model) => (q4 ? m.gbQ4 : m.gb16)
  const fitOf = (r: number) => (r <= K.fitRule.roomy ? 'roomy' : r <= K.fitRule.tight ? 'tight' : 'spill')

  // ── DOM ──
  const roomCv = h('canvas', { class: 't32-cv t32-bleed', 'aria-hidden': 'true' })
  const liveCv = h('canvas', { class: 't32-cv t32-bleed', 'aria-hidden': 'true' })
  const airCv = h('canvas', { class: 't32-cv', 'aria-hidden': 'true' })
  const tag = live('t32t-tag')
  tag.hidden = true
  const str = h('i', { class: 't32t-string', 'aria-hidden': 'true', hidden: true, style: 'left:0;top:0;height:17px' })
  const rule = h('div', { class: 't32-paper t32t-rule', hidden: true }, ctx.fact(K.rule as Fact, 'p', 't32t-rule-p'))
  const sizeEls: HTMLElement[] = []
  const models = K.models.map((m, k) => {
    const size = h('span', { class: 't32t-gb' })
    sizeEls.push(size)
    const b = h('button', { class: 't32t-model', type: 'button', 'aria-pressed': 'false' },
      h('span', { class: 't32-wood' }, h('span', { class: 't32t-ml' }, m.label), size))
    b.addEventListener('click', () => !b.dataset.dragged && place(k))
    b.addEventListener('pointerdown', (e) => grab(k, e))
    b.addEventListener('pointerenter', () => ((hover = k), wake()))
    b.addEventListener('pointerleave', () => ((hover = -1), wake()))
    b.addEventListener('focus', () => ((hover = k), wake()))
    b.addEventListener('blur', () => ((hover = -1), wake()))
    return b
  })
  const shelfEl = h('div', { class: 't32t-shelf', role: 'group', 'aria-label': K.modelsLabel }, ...models)
  const ramText = h('span', { class: 't32t-ramn' })
  const ramEl = h('div', { class: 't32t-ram', role: 'slider', tabindex: '0', 'aria-label': K.ramLabel, 'aria-valuemin': '0', 'aria-valuemax': String(RAMS.length - 1) },
    ramText)
  // the table's own words, burnt into its front apron: its length is your RAM
  const apron = h('p', { class: 't32t-apron' }, K.ramLabel)
  // the RAM notches cut into the mat's edge right under the table's front, where its end plank comes to: 8 · 16 · 32 · 64
  const notches = RAMS.map((r) => h('span', { class: 't32t-notch', 'aria-hidden': 'true' }, String(r)))
  const pressText = h('span', { class: 't32t-pressn' })
  const pressEl = h('button', { class: 't32t-press', type: 'button', 'aria-pressed': 'true', 'aria-label': K.pressAria }, h('span', { class: 't32-wood' }, pressText))
  const root = h('div', { class: 't32 t32t', role: 'group', 'aria-label': K.aria },
    roomCv, liveCv, airCv,
    h('div', { class: 't32-mist', 'aria-hidden': 'true' }),
    h('p', { class: 'visually-hidden' }, K.art),
    rule, shelfEl, apron, ...notches, ramEl, pressEl, str, tag)
  ctx.art.append(root)
  const sheet = cardSheet(root, K.takeaway, ctx.onCleanup)

  // ── geometry ──
  let W = 0, H = 0, tall = false
  let R: Room = room(false)
  let cam: Cam = camera([0, 2, 4], [0, 0.5, -1], 35, 100, 100)
  let P: Pal = palette()
  let SP = sprites(P)
  let cR: CanvasRenderingContext2D | null = null
  let cL: CanvasRenderingContext2D | null = null
  let cA: CanvasRenderingContext2D | null = null
  let dpr = 1
  const rollSets = K.models.map((_, k) => ({ table: rollsOf(k, RT(k), 3200 + k), shelf: rollsOf(k, RS(k), 3200 + k) }))
  const spillOrd = rollSets.map((s) => spillOrder(s.table))
  const shelfLen = (k: number) => {
    const slot = (R.shelf.x1 - R.shelf.x0) / K.models.length
    return slot * (0.5 + k * 0.08)
  }
  const shelfPose = (k: number): [number, number, number, number, number] => {
    const slot = (R.shelf.x1 - R.shelf.x0) / K.models.length
    const cx = R.shelf.x0 + slot * (k + 0.5), l = shelfLen(k)
    return [cx - l / 2, cx + l / 2, R.shelf.y + 0.03, R.wallZ + R.shelf.d * 0.52, 0]
  }
  const zMid = () => (R.zB + R.zF) / 2
  const xL = () => R.xR - Lnow
  const xTea = () => R.xR - Lnow * 0.25 // where the tea set begins: 25 % of the table stays for the OS, apps and context
  /** the bundle on the table: right against the tea set, as long as its share of the RAM (capped at the free top) */
  const tablePose = (len: number): [number, number, number, number, number] => {
    const x1 = xTea() - 0.02
    return [Math.max(xL() + 0.03, x1 - len), x1, R.TY, zMid(), 1]
  }
  const ratio = () => (sel < 0 ? 0 : gbOf(K.models[sel]) / ram)
  const wantLen = () => Math.min(ratio(), 1.6) * Lnow

  // ── the room: painted once per size / theme (sliced on the first paint) ──
  function* paintRoom(c: CanvasRenderingContext2D) {
    const { wallZ, win, shelf, lamp } = R
    // night interior: the plaster sits a step darker than the paper so the window, the moon's pool and the lamp carry the light
    const wall = P.dark ? mix(P.paper, P.wash, 0.25) : mix(P['paper-2'], P.wash, 0.3)
    const side = mix(wall, P.umbra, P.dark ? 0.35 : 0.16)
    const xa = R.tall ? -1.8 : -3.25, xb = 9
    const wood = P.dark ? mix(mix(P['rock-lo'], P.lantern, 0.12), P.wash, 0.3) : mix(mix(P['rock-lo'], P.lantern, 0.18), P.ink, 0.3)
    c.clearRect(0, 0, W, H)
    // the back wall: moon spill round the window, the lamp's warmth low on the right, the top lost in the dark
    polyClip(c, cam, [[xa, 0, wallZ], [xb, 0, wallZ], [xb, 5, wallZ], [xa, 5, wallZ]])
    c.fillStyle = rgba(wall)
    c.fill()
    c.save()
    c.clip()
    glowAt(c, win.x, win.y - 0.1, wallZ + 0.01, win.r * 3.2, SP.moon, P.dark ? 0.22 : 0.5)
    glowAt(c, lamp.x, 0.5, wallZ + 0.01, 1.9, SP.lamp, P.dark ? 0.32 : 0.36)
    cam.p(0, 2.9, wallZ)
    const top = c.createLinearGradient(0, cam.o[1], 0, cam.o[1] + H * 0.35)
    top.addColorStop(0, rgba(P.dark ? P.umbra : P.wash, P.dark ? 0.5 : 0.22))
    top.addColorStop(1, rgba(P.dark ? P.umbra : P.wash, 0))
    c.fillStyle = top
    c.fillRect(0, 0, W, H)
    grainOver(c, W, H, P.dark ? 0.5 : 0.4)
    c.restore()
    // the left wall, in shadow, running toward the viewer: the room's corner
    polyClip(c, cam, [[xa, 0, wallZ], [xa, 0, 3], [xa, 5, 3], [xa, 5, wallZ]])
    c.fillStyle = rgba(side)
    c.fill()
    c.save()
    c.clip()
    glowAt(c, xa, 1.2, wallZ + 0.8, 1.6, SP.moon, P.dark ? 0.05 : 0.18)
    grainOver(c, W, H, 0.4)
    c.restore()
    yield
    // posts (hashira), the rail (nageshi), skirting boards: dark wood
    const beam = (x0: number, x1: number, y0: number, y1: number, d = 0.06) => {
      poly(c, cam, [[x0, y0, wallZ + d], [x1, y0, wallZ + d], [x1, y1, wallZ + d], [x0, y1, wallZ + d]])
      c.fillStyle = rgba(wood)
      c.fill()
    }
    beam(xa, xb, 0, 0.07, 0.02)
    beam(xa, xb, R.tall ? 2.62 : 1.9, R.tall ? 2.74 : 2.0)
    polyClip(c, cam, [[xa + 0.02, 0, wallZ], [xa + 0.02, 0, 3], [xa + 0.02, 0.07, 3], [xa + 0.02, 0.07, wallZ]])
    c.fillStyle = rgba(wood)
    c.fill()
    for (const px of R.tall ? [xa + 0.07, 1.42] : [xa + 0.07, 2.12]) {
      beam(px - 0.07, px + 0.07, 0, 5, 0.08)
      // the post's grain and its moonlit edge
      c.strokeStyle = rgba(P.dark ? P.umbra : P.ink, 0.25)
      c.lineWidth = 0.8
      c.beginPath()
      for (const dx of [-0.035, -0.005, 0.03]) {
        cam.p(px + dx, 0.05, wallZ + 0.08); c.moveTo(cam.o[0], cam.o[1])
        cam.p(px + dx * 0.8, 3, wallZ + 0.08); c.lineTo(cam.o[0], cam.o[1])
      }
      c.stroke()
    }
    yield
    // the round window (marumado): night sky, the moon, far hills in mist, a pine bough; the deep reveal and a brushed rim
    const ring: Pt[] = []
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * Math.PI * 2
      ring.push(cam.pt(win.x + Math.cos(a) * win.r, win.y + Math.sin(a) * win.r, wallZ))
    }
    const [wcx, wcy] = cam.pt(win.x, win.y, wallZ)
    const wr = Math.abs(cam.pt(win.x + win.r, win.y, wallZ)[0] - wcx)
    c.save()
    c.beginPath()
    ring.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)))
    c.clip()
    const sky = c.createLinearGradient(0, wcy - wr, 0, wcy + wr)
    sky.addColorStop(0, rgba(P.dark ? mix(P.wash, P.paper, 0.6) : mix(P.water, P.mist, 0.45)))
    sky.addColorStop(0.65, rgba(P.dark ? mix(P.paper, P.mist, 0.18) : mix(P.mist, P.paper, 0.3)))
    sky.addColorStop(1, rgba(P.dark ? mix(P.paper, P.mist, 0.3) : P.mist))
    c.fillStyle = sky
    c.fillRect(wcx - wr * 1.2, wcy - wr * 1.2, wr * 2.4, wr * 2.4)
    const mx = wcx + wr * 0.3, my = wcy - wr * 0.22, mr = wr * 0.3
    c.globalAlpha = P.dark ? 0.85 : 1
    c.drawImage(SP.moon, mx - mr * 3.2, my - mr * 3.2, mr * 6.4, mr * 6.4)
    c.globalAlpha = 1
    c.fillStyle = rgba(P.moon)
    c.beginPath()
    c.arc(mx, my, mr, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = rgba(P.dark ? P['rock-hi'] : P['rock-mid'], P.dark ? 0.16 : 0.22)
    c.fill(new Path2D(blob(mx - mr * 0.25, my - mr * 0.12, mr * 0.36, mr * 0.24, 41, 0.3)))
    c.fill(new Path2D(blob(mx + mr * 0.32, my + mr * 0.32, mr * 0.24, mr * 0.17, 42, 0.3)))
    c.strokeStyle = rgba(P.dark ? P.wash : P.ink, 0.25)
    c.lineWidth = 1
    c.stroke()
    // far ridges, paler with distance, and the mist at their feet
    const hill = (base: number, hgt: number, seed: number, col: RGB, a: number) => {
      c.beginPath()
      c.moveTo(wcx - wr * 1.2, wcy + wr * 1.2)
      for (let i = 0; i <= 30; i++) {
        const t = i / 30
        const pk = Math.max(0, Math.sin(t * 5.3 + seed)) ** 1.6 * 0.7 + Math.sin(t * 13 + seed * 3) * 0.08
        c.lineTo(wcx - wr * 1.2 + t * wr * 2.4, wcy + wr * base - hgt * wr * pk)
      }
      c.lineTo(wcx + wr * 1.2, wcy + wr * 1.2)
      c.fillStyle = rgba(col, a)
      c.fill()
    }
    hill(0.42, 0.5, 2, P.dark ? mix(P.wash, P.mist, 0.18) : mix(P.water, P.mist, 0.35), 0.8)
    c.globalAlpha = P.dark ? 0.3 : 0.7
    c.drawImage(SP.moon, wcx - wr * 1.5, wcy + wr * 0.12, wr * 3, wr * 0.55)
    c.globalAlpha = 1
    hill(0.72, 0.36, 5, P.dark ? P.wash : mix(P.water, P.wash, 0.25), 0.9)
    c.globalAlpha = P.dark ? 0.25 : 0.6
    c.drawImage(SP.moon, wcx - wr * 1.4, wcy + wr * 0.5, wr * 2.8, wr * 0.45)
    c.globalAlpha = 1
    // a pine bough from the upper left, needles in dark fans
    const inkC = P.dark ? mix(P.wash, P.umbra, 0.5) : P.ink
    c.fillStyle = rgba(inkC, 0.92)
    const bough = curve([wcx - wr * 1.15, wcy - wr * 0.62], [wcx - wr * 0.35, wcy - wr * 0.28], [wcx + wr * 0.18, wcy - wr * 0.62], 18)
    c.fill(brush(bough, wr * 0.075, 0.02, 0.55, 0.25))
    c.fill(brush(curve([wcx - wr * 0.5, wcy - wr * 0.38], [wcx - wr * 0.3, wcy - wr * 0.05], [wcx - wr * 0.05, wcy + wr * 0.02], 10), wr * 0.035, 0.05, 0.6, 0.2))
    const r = rng(77)
    for (const [fx, fy, fw] of [[-0.78, -0.5, 0.36], [-0.42, -0.4, 0.42], [-0.02, -0.56, 0.34], [0.16, -0.68, 0.24], [-0.1, 0.02, 0.3], [-0.95, -0.66, 0.22]] as const) {
      const x = wcx + fx * wr, y = wcy + fy * wr, w = fw * wr
      c.fillStyle = rgba(inkC, 0.35)
      c.fill(new Path2D(blob(x, y + w * 0.08, w * 0.55, w * 0.18, 90 + fx * 10, 0.25, 16)))
      c.fillStyle = rgba(inkC, 0.9)
      for (let j = 0; j < 26; j++) {
        const a = Math.PI * (0.02 + (j / 25) * 0.96) + (r() - 0.5) * 0.12
        const l = w * (0.36 + r() * 0.22)
        c.fill(brush([[x, y - w * 0.05], [x + Math.cos(a) * l, y + Math.sin(a) * l * 0.55]], 0.9 + r() * 0.8, 0.05, 0.6, 0.15))
      }
    }
    c.restore()
    // the reveal: the wall's thickness, its lower inside lit by the moon behind
    c.fillStyle = rgba(mix(wall, P.umbra, P.dark ? 0.45 : 0.3))
    c.beginPath()
    ring.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)))
    for (let i = 48; i >= 0; i--) {
      const a = (i / 48) * Math.PI * 2
      cam.p(win.x + Math.cos(a) * win.r * 0.95, win.y + Math.sin(a) * win.r * 0.95, wallZ - 0.16)
      c.lineTo(cam.o[0], cam.o[1])
    }
    c.fill('evenodd')
    c.fillStyle = rgba(P.dark ? P.wash : P.ink, P.dark ? 0.9 : 0.75)
    c.fill(brush(ring.slice(2, 26), Math.max(2.6, wr * 0.045), 0.1, 0.12, 0.3))
    c.fill(brush(ring.slice(24, 48), Math.max(1.6, wr * 0.02), 0.2, 0.2, 0.2))
    c.fillStyle = rgba(P.moon, P.dark ? 0.5 : 0.9)
    c.fill(brush(ring.slice(30, 45), Math.max(1.4, wr * 0.022), 0.3, 0.3, 0.1))
    yield
    // the wall shelf (tsuri-dana): plank, two brackets, its soft shadow on the plaster
    const { x0, x1, y, d } = shelf
    c.save()
    c.globalAlpha = P.dark ? 0.5 : 0.22
    poly(c, cam, [[x0 + 0.03, y - 0.02, wallZ + 0.002], [x1 + 0.1, y - 0.02, wallZ + 0.002], [x1 + 0.04, y - 0.3, wallZ + 0.002], [x0 + 0.1, y - 0.26, wallZ + 0.002]])
    c.fillStyle = rgba(P.umbra)
    c.fill()
    c.restore()
    for (const bx of [x0 + 0.2, x1 - 0.2]) {
      poly(c, cam, [[bx - 0.018, y - 0.24, wallZ], [bx + 0.018, y - 0.24, wallZ], [bx + 0.018, y - 0.03, wallZ + d * 0.85], [bx - 0.018, y - 0.03, wallZ + d * 0.85]])
      c.fillStyle = rgba(wood)
      c.fill()
    }
    box(c, x0, x1, y - 0.035, y, wallZ, wallZ + d, mix(wood, P['rock-mid'], 0.4), mix(wood, P.umbra, 0.15), mix(wood, P.umbra, 0.3))
    yield
    // the tatami: straw mats in perspective, a fine weave, black cloth borders running to the window wall
    const straw = P.dark ? mix(P['rock-lo'], P['moss-b'], 0.4) : mix(mix(P['step-mid'], P['moss-c'], 0.35), P.wash, 0.1)
    polyClip(c, cam, [[xa, 0, wallZ], [xb, 0, wallZ], [xb, 0, 8], [xa, 0, 8]])
    c.fillStyle = rgba(straw)
    c.fill()
    c.save()
    c.clip()
    c.globalCompositeOperation = P.dark ? 'screen' : 'source-over'
    glowAt(c, lamp.x, 0.001, lamp.z + 0.25, 1.9, SP.lamp, P.dark ? 0.55 : 0.5, true)
    glowAt(c, lamp.x - 0.1, 0.001, lamp.z + 0.15, 0.8, SP.lamp, P.dark ? 0.5 : 0.4, true)
    c.globalCompositeOperation = 'source-over'
    glowAt(c, R.xR - 1.1 * R.tl, 0.001, R.zF + 0.5, 2, SP.moon, P.dark ? 0.08 : 0.3, true)
    c.strokeStyle = rgba(P.dark ? P.umbra : P.ink, P.dark ? 0.28 : 0.07)
    c.lineWidth = 0.6
    c.beginPath()
    for (let zz = wallZ; zz < cam.eye[2] - 0.8; zz += 0.05) {
      cam.p(xa, 0, zz)
      c.moveTo(cam.o[0], cam.o[1])
      cam.p(xb, 0, zz)
      c.lineTo(cam.o[0], cam.o[1])
    }
    c.stroke()
    c.fillStyle = rgba(P.dark ? P.wash : mix(P.ink, P.wash, 0.5), P.dark ? 0.85 : 0.3)
    for (let xx = xa + 0.9; xx <= xb; xx += 0.9) polyClip(c, cam, [[xx - 0.016, 0, wallZ], [xx + 0.016, 0, wallZ], [xx + 0.016, 0, 8], [xx - 0.016, 0, 8]]), c.fill()
    c.strokeStyle = rgba(P.dark ? P.umbra : P.ink, 0.22)
    c.lineWidth = 1
    c.beginPath()
    for (const zz of [wallZ + 1.8, wallZ + 3.6]) {
      cam.p(xa, 0, zz); c.moveTo(cam.o[0], cam.o[1])
      cam.p(xb, 0, zz); c.lineTo(cam.o[0], cam.o[1])
    }
    c.stroke()
    // a cloth border (heri) crossing the mats right under the table's front: the RAM notches are cut into it
    polyClip(c, cam, [[xa, 0.001, R.zF - 0.015], [xb, 0.001, R.zF - 0.015], [xb, 0.001, R.zF + 0.07], [xa, 0.001, R.zF + 0.07]])
    c.fillStyle = rgba(P.dark ? P.wash : mix(P.ink, P.wash, 0.4), P.dark ? 0.9 : 0.55)
    c.fill()
    // the near floor sinks into the dark; a soft seam where it meets the walls
    cam.p(0, 0, R.zF + 0.3)
    const near = c.createLinearGradient(0, cam.o[1], 0, H)
    near.addColorStop(0, rgba(P.dark ? P.umbra : P.wash, 0))
    near.addColorStop(1, rgba(P.dark ? P.umbra : P.wash, P.dark ? 0.5 : 0.25))
    c.fillStyle = near
    c.fillRect(0, 0, W, H)
    grainOver(c, W, H, 0.45)
    c.restore()
    c.save()
    c.globalAlpha = P.dark ? 0.45 : 0.18
    c.fillStyle = rgba(P.umbra)
    poly(c, cam, [[xa, 0, wallZ], [xb, 0, wallZ], [xb, 0, wallZ + 0.3], [xa, 0, wallZ + 0.3]])
    c.fill()
    polyClip(c, cam, [[xa, 0, wallZ], [xa + 0.3, 0, wallZ], [xa + 0.3, 0, 8], [xa, 0, 8]])
    c.fill()
    c.restore()
    yield
    // a breath of mist over the far mats: the wall's foot dissolves, the room gets depth
    {
      cam.p(0, 0.55, wallZ)
      const y0 = cam.o[1]
      cam.p(0, 0, wallZ + 1.1)
      const g = c.createLinearGradient(0, y0, 0, cam.o[1])
      const m = P.dark ? P.mist : P.mist
      g.addColorStop(0, rgba(m, 0))
      g.addColorStop(0.55, rgba(m, P.dark ? 0.07 : 0.4))
      g.addColorStop(1, rgba(m, 0))
      c.fillStyle = g
      c.fillRect(0, y0, W, cam.o[1] - y0)
    }
    yield
    // the floor lamp (andon): paper panels glowing in a light wooden frame on four short feet, a handle over the top
    const { x: lx, z: lz } = lamp
    softPool(c, cam, lx, 0.002, lz + 0.05, 0.22, 0.18, rgba(P.umbra), P.dark ? 0.7 : 0.35)
    const glowP = mix(P.lantern, P.moon, P.dark ? 0.3 : 0.4)
    box(c, lx - 0.14, lx + 0.14, 0.1, 0.66, lz - 0.14, lz + 0.14, mix(glowP, P.moon, 0.3), glowP, mix(glowP, P.lantern, 0.55), false)
    c.save()
    poly(c, cam, [[lx - 0.14, 0.1, lz + 0.14], [lx + 0.14, 0.1, lz + 0.14], [lx + 0.14, 0.66, lz + 0.14], [lx - 0.14, 0.66, lz + 0.14]])
    c.clip()
    cam.p(lx, 0.36, lz + 0.14)
    const core = c.createRadialGradient(cam.o[0], cam.o[1], 0, cam.o[0], cam.o[1], 0.3 * cam.k(cam.o[2]))
    core.addColorStop(0, rgba(P.moon, 0.85))
    core.addColorStop(1, rgba(P.moon, 0))
    c.fillStyle = core
    c.fillRect(0, 0, W, H)
    c.restore()
    c.fillStyle = rgba(wood)
    for (const [ax, az] of [[-0.15, 0.15], [0.15, 0.15], [0.15, -0.15]]) {
      poly(c, cam, [[lx + ax - 0.013, 0, lz + az], [lx + ax + 0.013, 0, lz + az], [lx + ax + 0.013, 0.68, lz + az], [lx + ax - 0.013, 0.68, lz + az]])
      c.fill()
    }
    for (const yy of [0.1, 0.38, 0.66]) {
      poly(c, cam, [[lx - 0.16, yy, lz + 0.15], [lx + 0.16, yy, lz + 0.15], [lx + 0.16, yy + 0.022, lz + 0.15], [lx - 0.16, yy + 0.022, lz + 0.15]])
      c.fill()
    }
    c.strokeStyle = rgba(wood)
    c.lineWidth = 2
    c.beginPath()
    cam.p(lx - 0.1, 0.68, lz); c.moveTo(cam.o[0], cam.o[1])
    cam.p(lx - 0.1, 0.8, lz); c.lineTo(cam.o[0], cam.o[1])
    cam.p(lx + 0.1, 0.8, lz); c.lineTo(cam.o[0], cam.o[1])
    cam.p(lx + 0.1, 0.68, lz); c.lineTo(cam.o[0], cam.o[1])
    c.stroke()
    c.globalCompositeOperation = P.dark ? 'screen' : 'source-over'
    glowAt(c, lx, 0.38, lz + 0.14, 0.95, SP.lamp, P.dark ? 0.7 : 0.45)
    c.globalCompositeOperation = 'source-over'
    yield
    // the room's edges in the dark, heavier at the top
    const v = c.createRadialGradient(W * 0.55, H * 0.5, Math.min(W, H) * 0.28, W * 0.5, H * 0.45, Math.max(W, H) * 0.75)
    v.addColorStop(0, rgba(P.umbra, 0))
    v.addColorStop(1, rgba(P.dark ? P.umbra : P.wash, P.dark ? 0.6 : 0.28))
    c.fillStyle = v
    c.fillRect(0, 0, W, H)
  }

  /** A painted box (x0..x1, y0..y1, z0..z1): top, the face toward the viewer, and the end facing the camera. */
  function box(c: CanvasRenderingContext2D, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, top: RGB, front: RGB, side: RGB, edge = true) {
    const ex = cam.eye[0]
    if (ex < x0 || ex > x1) {
      const sx = ex < x0 ? x0 : x1
      poly(c, cam, [[sx, y0, z0], [sx, y0, z1], [sx, y1, z1], [sx, y1, z0]])
      c.fillStyle = rgba(side)
      c.fill()
    }
    poly(c, cam, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]])
    c.fillStyle = rgba(front)
    c.fill()
    if (cam.eye[1] > y1) {
      poly(c, cam, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]])
      c.fillStyle = rgba(top)
      c.fill()
    }
    if (!edge) return
    c.strokeStyle = rgba(P.dark ? P.wash : P.ink, P.dark ? 0.85 : 0.6)
    c.lineWidth = 1.6
    c.lineCap = 'round'
    c.beginPath()
    cam.p(x0, y1, z1); c.moveTo(cam.o[0], cam.o[1])
    cam.p(x1, y1, z1); c.lineTo(cam.o[0], cam.o[1])
    c.stroke()
    c.lineWidth = 0.9
    c.beginPath()
    cam.p(x1, y1, z1); c.moveTo(cam.o[0], cam.o[1])
    cam.p(x1, y0, z1); c.lineTo(cam.o[0], cam.o[1])
    cam.p(x0, y0, z1); c.lineTo(cam.o[0], cam.o[1])
    c.stroke()
    c.lineCap = 'butt'
  }

  /** A soft radial glow (sprite) centred on a world point, radius in metres; `flat` lays it on the floor plane. */
  function glowAt(c: CanvasRenderingContext2D, x: number, y: number, z: number, rad: number, sp: HTMLCanvasElement, a: number, flat = false) {
    const d = cam.p(x, y, z)
    const cx = cam.o[0], cy = cam.o[1], rr = rad * cam.k(d)
    c.globalAlpha = a
    if (flat) {
      cam.p(x, y, z + rad)
      const ry = Math.abs(cam.o[1] - cy) || rr * 0.4
      c.drawImage(sp, cx - rr, cy - ry, rr * 2, ry * 2)
    } else c.drawImage(sp, cx - rr, cy - rr, rr * 2, rr * 2)
    c.globalAlpha = 1
  }

  // ── the live layer: table, moonlight, tea set, bundles, press, rolled-off scrolls ──
  const inkS = () => rgba(P.dark ? P.wash : P.ink, P.dark ? 0.9 : 0.62)
  let INK = inkS(), RIM = rgba(P.moon, 0.7), CORD = rgba(mix(P['ink-2'], P.lantern, 0.25)), ENDC = rgba(mix(P['step-hi'], P.moon, 0.2))

  function cyl(c: CanvasRenderingContext2D, x0: number, x1: number, y: number, z: number, r: number, spin: number, sp: HTMLCanvasElement) {
    const vy = y - cam.eye[1], vz = z - cam.eye[2]
    const nl = Math.hypot(vy, vz) || 1
    const ny = (-vz / nl) * r, nz = (vy / nl) * r
    cam.p(x0, y + ny, z + nz)
    const ax = cam.o[0], ay = cam.o[1]
    cam.p(x1, y + ny, z + nz)
    const bx = cam.o[0], by = cam.o[1]
    cam.p(x1, y - ny, z - nz)
    const cx = cam.o[0], cy = cam.o[1]
    cam.p(x0, y - ny, z - nz)
    const dx = cam.o[0], dy = cam.o[1]
    c.save()
    c.beginPath()
    c.moveTo(ax, ay); c.lineTo(bx, by); c.lineTo(cx, cy); c.lineTo(dx, dy)
    c.closePath()
    c.clip()
    const vx = dx - ax, vyy = dy - ay
    c.setTransform(dpr * (bx - ax), dpr * (by - ay), dpr * vx * 1.12, dpr * vyy * 1.12, dpr * (ax - vx * 0.06), dpr * (ay - vyy * 0.06))
    c.drawImage(sp, 0, 0, 1, 1)
    c.setTransform(dpr, 0, 0, dpr, 0, 0)
    c.restore()
    c.lineWidth = Math.max(0.8, r * cam.k(cam.p(x0, y, z)) * 0.12)
    c.strokeStyle = INK
    c.beginPath(); c.moveTo(dx, dy); c.lineTo(cx, cy); c.stroke()
    c.lineWidth *= 0.6
    c.strokeStyle = RIM
    c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke()
    // the rolled end that faces the camera, its spiral turning as the roll turns
    const ex = cam.eye[0]
    if (ex < x0 || ex > x1) {
      const xe = ex < x0 ? x0 : x1
      c.beginPath()
      for (let i = 0; i <= 16; i++) {
        const a = (i / 16) * Math.PI * 2
        cam.p(xe, y + Math.cos(a) * r, z + Math.sin(a) * r)
        if (i) c.lineTo(cam.o[0], cam.o[1])
        else c.moveTo(cam.o[0], cam.o[1])
      }
      c.fillStyle = ENDC
      c.fill()
      c.strokeStyle = INK
      c.lineWidth = Math.max(0.7, c.lineWidth * 1.3)
      c.stroke()
      c.beginPath()
      for (let i = 0; i < 20; i++) {
        const a = spin + i * 0.78, q = r * (0.9 - i * 0.042)
        cam.p(xe, y + Math.cos(a) * q, z + Math.sin(a) * q)
        if (i) c.lineTo(cam.o[0], cam.o[1])
        else c.moveTo(cam.o[0], cam.o[1])
      }
      c.lineWidth *= 0.8
      c.stroke()
    }
  }

  /** a bundle lying along x (x0..x1) on a base at height y, centred on z: rolls, two cords, a contact shadow */
  function bundle(c: CanvasRenderingContext2D, k: number, x0: number, x1: number, y: number, z: number, onTable: number, skip: number) {
    const set = onTable > 0.5 ? rollSets[k].table : rollSets[k].shelf
    const r = onTable > 0.5 ? RT(k) : RS(k)
    const hw = ROWS[k][0] * r * 1.02 + r * 0.2
    flatSprite(c, cam, (x0 + x1) / 2, y + 0.001, z + r * 0.6, (x1 - x0) / 2 + r * 1.2, hw * 1.25, SP.shade, P.dark ? 0.7 : 0.4, dpr)
    const ord = spillOrd[k]
    const sp = q4 ? SP.rollQ : SP.roll
    for (let i = 0; i < set.length; i++) {
      if (onTable > 0.5 && skip && ord.indexOf(i) < skip) continue
      const rl = set[i]
      cyl(c, x0 + rl.ja, x1 - rl.jb, y + rl.y, z + rl.z, r, rl.spin, sp)
    }
    // cords round the pile (three when pressed tight), the knot on top
    const hh = (ROWS[k].length - 1) * r * 1.72 + r * 2.1
    const n = q4 ? 3 : 2
    c.strokeStyle = CORD
    c.lineWidth = Math.max(1, 0.012 * cam.k(cam.p(x0, y, z)))
    for (let j = 0; j < n; j++) {
      const xc = x0 + (x1 - x0) * ((j + 1) / (n + 1))
      c.beginPath()
      for (let i = 0; i <= 14; i++) {
        const t = -0.12 * Math.PI + (i / 14) * 1.24 * Math.PI
        cam.p(xc, y + hh * 0.5 + Math.sin(t) * hh * 0.52, z + Math.cos(t) * hw * (q4 ? 0.98 : 1.04))
        if (i) c.lineTo(cam.o[0], cam.o[1])
        else c.moveTo(cam.o[0], cam.o[1])
      }
      c.stroke()
    }
  }
  let SHADE = rgba(P.umbra)

  /** a cup (yunomi) standing at (cx, cz) on height b: celadon body shaded round, tea in its mouth, a moonlit lip */
  function cup(c: CanvasRenderingContext2D, cx: number, cz: number, b: number, sc: number) {
    const cr = 0.03 * sc, ch = 0.046 * sc
    softPool(c, cam, cx + 0.01, b + 0.0005, cz + 0.008, cr * 1.6, cr * 1.25, SHADE, P.dark ? 0.7 : 0.45, 3)
    const d = cam.p(cx, b, cz)
    const bx = cam.o[0], by = cam.o[1], k = cam.k(d), rb = cr * 0.84 * k
    cam.p(cx, b, cz + cr)
    const e = clamp((cam.o[1] - by) / (cr * k), 0.15, 0.9)
    cam.p(cx, b + ch, cz)
    const tx = cam.o[0], ty = cam.o[1], rt = cr * k
    const g = c.createLinearGradient(tx - rt, 0, tx + rt, 0)
    g.addColorStop(0, rgba(mix(GLZ, P.umbra, 0.4)))
    g.addColorStop(0.3, rgba(mix(GLZ, P.moon, 0.35)))
    g.addColorStop(0.62, rgba(GLZ))
    g.addColorStop(1, rgba(mix(GLZ, P.lantern, 0.4)))
    c.fillStyle = g
    c.beginPath()
    c.moveTo(tx - rt, ty)
    c.lineTo(bx - rb, by)
    c.ellipse(bx, by, rb, rb * e, 0, Math.PI, 0, true)
    c.lineTo(tx + rt, ty)
    c.ellipse(tx, ty, rt, rt * e, 0, 0, Math.PI, true)
    c.fill()
    c.strokeStyle = INK
    c.lineWidth = 0.8
    c.stroke()
    c.fillStyle = rgba(mix(GLZ, P.umbra, 0.3))
    c.beginPath(); c.ellipse(tx, ty, rt, rt * e, 0, 0, Math.PI * 2); c.fill()
    c.fillStyle = rgba(mix(mix(P.moss, P.lantern, 0.55), P.umbra, P.dark ? 0.2 : 0))
    c.beginPath(); c.ellipse(tx, ty + rt * e * 0.25, rt * 0.82, rt * e * 0.72, 0, 0, Math.PI * 2); c.fill()
    c.strokeStyle = RIM
    c.lineWidth = 1
    c.beginPath(); c.ellipse(tx, ty, rt, rt * e, 0, 0.1, Math.PI - 0.1); c.stroke()
  }

  /** the teapot (kyusu): a squat clay body shaded round, a side handle toward the lamp, a spout toward the window, lid and knob */
  function teapot(c: CanvasRenderingContext2D, px: number, pz: number, b: number, sc: number) {
    const pr = 0.07 * sc
    softPool(c, cam, px + 0.02, b + 0.0005, pz + 0.012, pr * 1.45, pr * 1.05, SHADE, P.dark ? 0.75 : 0.5, 4)
    const d = cam.p(px, b + pr * 0.8, pz)
    const cx = cam.o[0], cy = cam.o[1], rr = pr * cam.k(d)
    // the handle (behind, to the right)
    cam.p(px + pr * 0.8, b + pr * 0.85, pz - pr * 0.35)
    const h0: Pt = [cam.o[0], cam.o[1]]
    cam.p(px + pr * 1.85, b + pr * 1.1, pz - pr * 1.0)
    const h1: Pt = [cam.o[0], cam.o[1]]
    c.fillStyle = rgba(mix(CLAY, P.umbra, 0.3))
    c.fill(brush([h0, h1], rr * 0.34, 0.02, 0.02, 0.75))
    c.beginPath(); c.arc(h1[0], h1[1], rr * 0.13, 0, Math.PI * 2); c.fill()
    // the body
    const g = c.createRadialGradient(cx - rr * 0.38, cy - rr * 0.4, rr * 0.04, cx - rr * 0.1, cy - rr * 0.1, rr * 1.25)
    g.addColorStop(0, rgba(mix(CLAY, P.moon, 0.6)))
    g.addColorStop(0.3, rgba(mix(CLAY, P.moon, 0.14)))
    g.addColorStop(0.72, rgba(CLAY))
    g.addColorStop(1, rgba(mix(CLAY, P.umbra, 0.6)))
    const body = new Path2D()
    body.ellipse(cx, cy, rr, rr * 0.8, 0, 0, Math.PI * 2)
    c.fillStyle = g
    c.fill(body)
    c.save()
    c.clip(body)
    const warm = c.createRadialGradient(cx + rr * 1.35, cy + rr * 0.1, 0, cx + rr * 1.35, cy + rr * 0.1, rr * 1.1)
    warm.addColorStop(0, rgba(P.lantern, P.dark ? 0.55 : 0.45))
    warm.addColorStop(1, rgba(P.lantern, 0))
    c.fillStyle = warm
    c.fillRect(cx - rr, cy - rr, rr * 2, rr * 2)
    c.restore()
    c.strokeStyle = INK
    c.lineWidth = 0.9
    c.stroke(body)
    // the spout (front left, rising)
    cam.p(px - pr * 0.82, b + pr * 0.62, pz + pr * 0.25)
    const s0: Pt = [cam.o[0], cam.o[1]]
    cam.p(px - pr * 1.6, b + pr * 1.12, pz + pr * 0.5)
    const s1: Pt = [cam.o[0], cam.o[1]]
    const sg = c.createLinearGradient(s0[0], s0[1] - rr * 0.2, s0[0], s0[1] + rr * 0.2)
    sg.addColorStop(0, rgba(mix(CLAY, P.moon, 0.35)))
    sg.addColorStop(1, rgba(mix(CLAY, P.umbra, 0.35)))
    c.fillStyle = sg
    c.fill(brush(curve(s0, [(s0[0] + s1[0]) / 2, s0[1] - rr * 0.05], s1, 8), rr * 0.36, 0.02, 0.9, 0.4))
    c.fillStyle = rgba(mix(CLAY, P.umbra, 0.6))
    c.beginPath(); c.ellipse(s1[0], s1[1], rr * 0.08, rr * 0.05, -0.5, 0, Math.PI * 2); c.fill()
    // lid, its seam, the knob, a glint of moon on the shoulder
    c.fillStyle = rgba(mix(CLAY, P.moon, 0.08))
    c.beginPath(); c.ellipse(cx, cy - rr * 0.66, rr * 0.48, rr * 0.15, 0, 0, Math.PI * 2); c.fill()
    c.strokeStyle = rgba(mix(CLAY, P.umbra, 0.65))
    c.lineWidth = 0.9
    c.stroke()
    c.fillStyle = rgba(mix(CLAY, P.umbra, 0.2))
    c.beginPath(); c.ellipse(cx, cy - rr * 0.8, rr * 0.11, rr * 0.09, 0, 0, Math.PI * 2); c.fill()
    c.fillStyle = rgba(P.moon, P.dark ? 0.55 : 0.75)
    c.beginPath(); c.ellipse(cx - rr * 0.4, cy - rr * 0.36, rr * 0.2, rr * 0.08, -0.6, 0, Math.PI * 2); c.fill()
    c.beginPath(); c.ellipse(cx - rr * 0.05, cy - rr * 0.84, rr * 0.05, rr * 0.03, 0, 0, Math.PI * 2); c.fill()
  }

  function teaSet(c: CanvasRenderingContext2D) {
    const x0 = xTea() + 0.02 + nudge, x1 = R.xR - 0.03, zc = zMid(), y = R.TY
    const w = x1 - x0
    const sc = clamp(w / 0.48, 0.72, 1.2) // a short table gets a smaller set
    const tx = (x0 + x1) / 2, trz = 0.2 * sc
    // a round wooden tray: its shadow, the rim's thickness, the top, the turned well
    softPool(c, cam, tx + 0.01, y + 0.001, zc + 0.02, w * 0.5, trz * 1.1, SHADE, P.dark ? 0.6 : 0.32, 4)
    c.fillStyle = rgba(WD.dk)
    flatEllipse(c, cam, tx, y + 0.002, zc, w * 0.47, trz, 32)
    c.fill()
    c.fillStyle = rgba(WD.hi)
    flatEllipse(c, cam, tx, y + 0.014, zc, w * 0.47, trz, 32)
    c.fill()
    c.fillStyle = rgba(mix(WD.hi, WD.lo, 0.35))
    flatEllipse(c, cam, tx, y + 0.0145, zc, w * 0.42, trz * 0.88, 32)
    c.fill()
    const b = y + 0.015
    // farther things first: the cup behind the pot, the pot, the two cups in front
    cup(c, x0 + w * 0.76, zc - 0.09 * sc, b, sc)
    teapot(c, x0 + w * 0.32, zc - 0.02, b, sc)
    cup(c, x0 + w * 0.86, zc + 0.05 * sc, b, sc)
    cup(c, x0 + w * 0.6, zc + 0.11 * sc, b, sc)
  }

  function table(c: CanvasRenderingContext2D) {
    const { TY, zB, zF, xR } = R
    const x0 = xL()
    const ins = 0.09
    // the table's soft shadow on the mat, then a dark contact under each leg, then the legs (back, then front) and the apron
    softPool(c, cam, (x0 + xR) / 2, 0.001, (zB + zF) / 2 + 0.05, (xR - x0) / 2 + 0.1, (zF - zB) / 2 + 0.12, SHADE, P.dark ? 0.55 : 0.3, 5)
    const legs = [[x0 + ins, zB + ins], [xR - ins, zB + ins], [x0 + ins, zF - ins], [xR - ins, zF - ins]]
    for (const [lx, lz] of legs) softPool(c, cam, lx + 0.012, 0.001, lz + 0.02, 0.08, 0.06, SHADE, P.dark ? 0.95 : 0.6, 4)
    for (const [lx, lz] of legs) box(c, lx - 0.032, lx + 0.032, 0, TY - 0.04, lz - 0.032, lz + 0.032, WD.mid, WD.lo, WD.dk, false)
    box(c, x0 + 0.05, xR - 0.05, TY - 0.1, TY - 0.04, zB + 0.04, zF - 0.04, WD.mid, mix(WD.lo, P.umbra, 0.25), WD.dk, false)
    // the slab
    box(c, x0, xR, TY - 0.045, TY, zB, zF, WD.hi, WD.lo, WD.dk)
    // warm lamp light along the front edge (stronger toward the lamp)
    c.save()
    poly(c, cam, [[x0, TY - 0.045, zF], [xR, TY - 0.045, zF], [xR, TY, zF], [x0, TY, zF]])
    c.clip()
    cam.p(xR, TY, zF)
    const gx = cam.o[0]
    cam.p(x0, TY, zF)
    const g = c.createLinearGradient(cam.o[0], 0, gx, 0)
    g.addColorStop(0, rgba(P.lantern, 0))
    g.addColorStop(1, rgba(P.lantern, P.dark ? 0.35 : 0.25))
    c.fillStyle = g
    c.fillRect(0, 0, W, H)
    c.restore()
    // grain along the top, the leaf seam of the end plank (the part that slides out with more RAM), a finger pull at its end
    c.strokeStyle = rgba(P.dark ? P.umbra : P['rock-lo'], P.dark ? 0.4 : 0.35)
    c.lineWidth = 0.7
    c.beginPath()
    for (let i = 0; i < 9; i++) {
      const zz = zB + 0.04 + (i / 8) * (zF - zB - 0.08)
      const a = x0 + 0.2 + ((i * 37) % 11) * 0.03
      cam.p(a, TY + 0.0005, zz)
      c.moveTo(cam.o[0], cam.o[1])
      cam.p(xR - 0.1 - ((i * 23) % 7) * 0.05, TY + 0.0005, zz + 0.006)
      c.lineTo(cam.o[0], cam.o[1])
    }
    c.stroke()
    c.strokeStyle = INK
    c.lineWidth = 1.2
    c.beginPath()
    cam.p(x0 + 0.16, TY + 0.0005, zB); c.moveTo(cam.o[0], cam.o[1])
    cam.p(x0 + 0.16, TY + 0.0005, zF); c.lineTo(cam.o[0], cam.o[1])
    cam.p(x0 + 0.16, TY - 0.045, zF); c.lineTo(cam.o[0], cam.o[1])
    c.stroke()
    c.fillStyle = rgba(P.umbra, P.dark ? 0.5 : 0.3)
    flatEllipse(c, cam, x0 + 0.07, TY + 0.0006, zMid(), 0.03, 0.1, 16)
    c.fill()
    // the RAM notches: a V cut in the front edge and the size carved under it, wherever the end plank stops
    const fs = clamp(0.03 * cam.k(cam.p(xR, TY, zF)), 8, 12)
    c.font = `600 ${fs.toFixed(1)}px ${serif}`
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    for (const n of RAMS) {
      const xn = xR - LEN(n) * R.tl
      if (xn < x0 - 0.002 || xn > xTea() - 0.2) continue
      c.strokeStyle = rgba(P.umbra, 0.75)
      c.lineWidth = 1.2
      c.beginPath()
      cam.p(xn - 0.012, TY, zF); c.moveTo(cam.o[0], cam.o[1])
      cam.p(xn, TY - 0.016, zF); c.lineTo(cam.o[0], cam.o[1])
      cam.p(xn + 0.012, TY, zF); c.lineTo(cam.o[0], cam.o[1])
      c.stroke()
      if (Math.abs(xn - x0) < 0.02) continue // the end itself carries the live size
      cam.p(xn + 0.05, TY - 0.024, zF)
      c.fillStyle = rgba(P.moon, P.dark ? 0.18 : 0.4)
      c.fillText(String(n), cam.o[0], cam.o[1] + 0.8)
      c.fillStyle = rgba(P.umbra, P.dark ? 0.85 : 0.6)
      c.fillText(String(n), cam.o[0], cam.o[1])
    }
  }

  /** the free part of the top (what the model leaves of it): centre x, half length */
  const free = () => {
    const x0 = xL() + 0.05, x1 = xTea() - 0.04
    return [(x0 + x1) / 2, Math.max(0.05, (x1 - x0) / 2)]
  }
  /** the moon's pool on the free part of the top: the window's round of light with the pine's shadow in it */
  function moonlight(c: CanvasRenderingContext2D) {
    const [cx, rx] = free()
    const zc = zMid() - 0.02, rz = (R.zF - R.zB) * 0.44
    c.save()
    c.globalCompositeOperation = P.dark ? 'screen' : 'source-over'
    flatSprite(c, cam, cx, R.TY + 0.001, zc, Math.min(rx * 1.1, 0.75), rz * 1.12, SP.pool, P.dark ? 0.95 : 1, dpr)
    c.restore()
  }
  /** the moonbeam's corners on screen (window left, window right, table right, table left), kept for the motes */
  const BQ = new Float64Array(8)
  // dust in the moonbeam: the one living motion here (high quality, no reduced motion, stops 10 s after the last input)
  const MOTES = 26
  const mote = new Float32Array(MOTES * 4)
  { const r = rng(3290); for (let i = 0; i < mote.length; i++) mote[i] = r() }
  let MOTE = rgba(P.moon, 0.9)
  const airOn = !still
  let idle = 0
  function motes(time: number) {
    const c = cA
    if (!c || !W) return
    c.clearRect(0, 0, W, H)
    if (!BQ[0] && !BQ[1]) return
    c.fillStyle = MOTE
    for (let i = 0; i < MOTES; i++) {
      const u = mote[i * 4], sp = 0.012 + mote[i * 4 + 1] * 0.02, ph = mote[i * 4 + 2] * 6.28, sz = 0.6 + mote[i * 4 + 3] * 1.3
      const v = (mote[i * 4 + 1] + time * sp) % 1 // down the beam, slowly
      const uu = Math.min(1, Math.max(0, u + Math.sin(time * 0.35 + ph) * 0.06))
      // bilinear inside the beam quad: top edge (window) to bottom edge (table)
      const tx = BQ[0] + (BQ[2] - BQ[0]) * uu, ty = BQ[1] + (BQ[3] - BQ[1]) * uu
      const bx = BQ[6] + (BQ[4] - BQ[6]) * uu, by = BQ[7] + (BQ[5] - BQ[7]) * uu
      const x = tx + (bx - tx) * v, y = ty + (by - ty) * v
      c.globalAlpha = Math.sin(Math.PI * v) * (0.35 + 0.35 * Math.sin(time * 1.3 + ph)) * (P.dark ? 1 : 0.8)
      c.fillRect(x, y, sz, sz)
    }
    c.globalAlpha = 1
  }
  /** the shaft of moonlight from the window down to the pool: a wide soft one and a brighter core, cool, the room's key light */
  function beam(c: CanvasRenderingContext2D) {
    const { win, wallZ, TY } = R
    const [cx, rx0] = free()
    const rx = Math.min(rx0 * 1.05, 0.72), zc = zMid()
    const col = mix(P.moon, P.mist, 0.3)
    c.save()
    c.globalCompositeOperation = P.dark ? 'screen' : 'source-over'
    cam.p(win.x, win.y + win.r * 0.3, wallZ)
    const gy0 = cam.o[1]
    cam.p(cx, TY, zc)
    const gy1 = cam.o[1]
    for (const [wk, tk, a] of [[1, 1.18, 0.55], [0.7, 0.82, 1]] as const) {
      c.beginPath()
      cam.p(win.x - win.r * 0.88 * wk, win.y + win.r * 0.25, wallZ); c.moveTo(cam.o[0], cam.o[1])
      if (a === 1) (BQ[0] = cam.o[0]), (BQ[1] = cam.o[1])
      cam.p(win.x + win.r * 0.88 * wk, win.y + win.r * 0.25, wallZ); c.lineTo(cam.o[0], cam.o[1])
      if (a === 1) (BQ[2] = cam.o[0]), (BQ[3] = cam.o[1])
      cam.p(cx + rx * tk, TY, zc + 0.16); c.lineTo(cam.o[0], cam.o[1])
      if (a === 1) (BQ[4] = cam.o[0]), (BQ[5] = cam.o[1])
      cam.p(cx - rx * tk, TY, zc + 0.16); c.lineTo(cam.o[0], cam.o[1])
      if (a === 1) (BQ[6] = cam.o[0]), (BQ[7] = cam.o[1])
      c.closePath()
      const g = c.createLinearGradient(0, gy0, 0, gy1)
      g.addColorStop(0, rgba(col, (P.dark ? 0.16 : 0.34) * a))
      g.addColorStop(0.6, rgba(col, (P.dark ? 0.09 : 0.2) * a))
      g.addColorStop(1, rgba(col, (P.dark ? 0.06 : 0.12) * a))
      c.fillStyle = g
      c.fill()
    }
    c.restore()
  }

  /** a wooden block with grain on its front face */
  function wbox(c: CanvasRenderingContext2D, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
    box(c, x0, x1, y0, y1, z0, z1, WD.hi, WD.mid, WD.lo)
    c.strokeStyle = rgba(WD.dk, 0.45)
    c.lineWidth = 0.7
    c.beginPath()
    const along = x1 - x0 > y1 - y0
    for (let i = 1; i < 4; i++) {
      const u = i / 4 + Math.sin(i * 2.3 + x0 * 7) * 0.05
      if (along) {
        cam.p(x0 + 0.01, y0 + (y1 - y0) * u, z1); c.moveTo(cam.o[0], cam.o[1])
        cam.p(x1 - 0.01, y0 + (y1 - y0) * (u + 0.04), z1); c.lineTo(cam.o[0], cam.o[1])
      } else {
        cam.p(x0 + (x1 - x0) * u, y0 + 0.01, z1); c.moveTo(cam.o[0], cam.o[1])
        cam.p(x0 + (x1 - x0) * (u + 0.05), y1 - 0.01, z1); c.lineTo(cam.o[0], cam.o[1])
      }
    }
    c.stroke()
  }

  /** the wooden screw press: a heavy base, two posts, a crossbeam, the platen riding a big wooden screw, a capstan bar on top */
  function press(c: CanvasRenderingContext2D) {
    const { x, z } = R.press
    const q = pressQ
    softPool(c, cam, x + 0.03, 0.001, z + 0.05, 0.32, 0.21, SHADE, P.dark ? 0.75 : 0.42, 4)
    wbox(c, x - 0.25, x + 0.25, 0, 0.075, z - 0.15, z + 0.15)
    // a little bundle between the plates, squeezed shorter as the screw goes down
    const bl = 0.3 * (1 - q * 0.71)
    const spT = q4 ? SP.rollQ : SP.roll
    for (const [dz, dy] of [[-0.035, 0], [0.035, 0], [0, 0.058]]) cyl(c, x - bl / 2, x + bl / 2, 0.075 + 0.03 + dy, z + dz, 0.03, 0, spT)
    for (const px of [x - 0.2, x + 0.2]) wbox(c, px - 0.032, px + 0.032, 0.075, 0.6, z - 0.032, z + 0.032)
    const py = 0.36 - q * 0.13
    // the screw: a turned wooden shaft, its thread running as the bar turns
    const d = cam.p(x, py + 0.04, z)
    const sx = cam.o[0], sb = cam.o[1], sr = 0.026 * cam.k(d)
    cam.p(x, 0.78, z)
    const st = cam.o[1]
    const sg = c.createLinearGradient(sx - sr, 0, sx + sr, 0)
    sg.addColorStop(0, rgba(WD.dk))
    sg.addColorStop(0.35, rgba(mix(WD.hi, P.moon, 0.2)))
    sg.addColorStop(1, rgba(WD.lo))
    c.fillStyle = sg
    c.fillRect(sx - sr, st, sr * 2, sb - st)
    c.save()
    c.beginPath()
    c.rect(sx - sr, st, sr * 2, sb - st)
    c.clip()
    c.strokeStyle = rgba(WD.dk, 0.9)
    c.lineWidth = Math.max(1, sr * 0.28)
    const pitch = Math.max(4, sr * 0.9), ph = (((crank / (Math.PI * 2)) % 1) + 1) % 1
    c.beginPath()
    for (let yy = st - pitch + ph * pitch; yy < sb + pitch; yy += pitch) {
      c.moveTo(sx - sr, yy)
      c.lineTo(sx + sr, yy - pitch * 0.55)
    }
    c.stroke()
    c.restore()
    wbox(c, x - 0.175, x + 0.175, py, py + 0.042, z - 0.105, z + 0.105)
    wbox(c, x - 0.29, x + 0.29, 0.6, 0.68, z - 0.055, z + 0.055)
    // the capstan bar through the screw's head, turning with the crank; one end worn red where the hand grips it
    const hx = Math.cos(crank) * 0.19, hz = Math.sin(crank) * 0.19
    cam.p(x - hx, 0.76, z - hz)
    const ax = cam.o[0], ay = cam.o[1]
    cam.p(x + hx, 0.76, z + hz)
    const bx = cam.o[0], by = cam.o[1]
    c.lineCap = 'round'
    c.strokeStyle = rgba(WD.dk)
    c.lineWidth = Math.max(3, 0.022 * cam.k(d))
    c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke()
    c.strokeStyle = rgba(mix(WD.hi, P.moon, 0.25), 0.7)
    c.lineWidth = 1
    c.beginPath(); c.moveTo(ax, ay - 1); c.lineTo(bx, by - 1); c.stroke()
    c.fillStyle = rgba(WD.lo)
    c.beginPath(); c.ellipse(sx, st + 2, sr * 1.25, sr * 0.55, 0, 0, Math.PI * 2); c.fill()
    c.strokeStyle = rgba(mix(P.vermilion, WD.dk, 0.2))
    c.lineWidth = Math.max(4, 0.03 * cam.k(d))
    c.beginPath(); c.moveTo(bx + (ax - bx) * 0.12, by + (ay - by) * 0.12); c.lineTo(bx, by); c.stroke()
    c.lineCap = 'butt'
  }

  /** the rolls that slid off: down over the front edge, then across the mat toward the viewer; the first one unrolls */
  function spilled(c: CanvasRenderingContext2D) {
    if (!spillN || sel < 0) return
    const k = sel
    const [x0, x1] = tablePose(lenNow)
    const set = rollSets[k].table, ord = spillOrd[k]
    const r = RT(k)
    const sp = q4 ? SP.rollQ : SP.roll
    for (let n = spillN - 1; n >= 0; n--) {
      const rl = set[ord[n]]
      const t = clamp(tSpill * 1.25 - n * 0.12, 0, 1)
      const zEnd = R.zF + 0.24 + n * 0.13 + (n === 0 ? 0.14 : 0)
      let y: number, z: number
      const zEdge = R.zF + r * 0.4
      if (t < 0.22) {
        const u = t / 0.22
        z = zMid() + rl.z + (zEdge - zMid() - rl.z) * u * u
        y = R.TY + rl.y
      } else if (t < 0.4) {
        const u = (t - 0.22) / 0.18
        z = zEdge + u * 0.2
        y = R.TY + rl.y + (r - R.TY - rl.y) * u * u
      } else {
        const u = easeOut((t - 0.4) / 0.6)
        z = zEdge + 0.2 + (zEnd - zEdge - 0.2) * u
        y = r
      }
      const spin = rl.spin + (z - zMid()) / r
      if (n === 0 && t > 0.4) {
        // the paper of the first roll lies on the mat behind it: brushed columns, its first edge curling up off the mat
        const z0 = Math.max(zEdge + 0.16, z - 0.42)
        const xa = x0 + rl.ja, xb = x1 - rl.jb
        softPool(c, cam, (xa + xb) / 2 + 0.01, 0.001, (z0 + z) / 2 + 0.01, (xb - xa) / 2 + 0.02, (z - z0) / 2 + 0.02, SHADE, P.dark ? 0.45 : 0.25, 3)
        c.save()
        poly(c, cam, [[xa, 0.003, z0], [xb, 0.003, z0], [xb, 0.003, z], [xa, 0.003, z]])
        c.clip()
        cam.p(xa, 0.003, z0)
        const ax = cam.o[0], ay = cam.o[1]
        cam.p(xb, 0.003, z0)
        const bx = cam.o[0], by = cam.o[1]
        cam.p(xa, 0.003, z)
        c.setTransform(dpr * (bx - ax), dpr * (by - ay), dpr * (cam.o[0] - ax), dpr * (cam.o[1] - ay), dpr * ax, dpr * ay)
        const tex = SP.sheet()
        c.drawImage(tex, 0, 0, tex.width, tex.height * clamp((z - z0) / 0.42, 0.05, 1), 0, 0, 1, 1)
        c.setTransform(dpr, 0, 0, dpr, 0, 0)
        c.restore()
        cyl(c, xa, xb, 0.011, z0, 0.011, 0, sp)
      }
      softPool(c, cam, (x0 + x1) / 2, 0.001, z + 0.02, (x1 - x0) / 2, r * 1.6, SHADE, P.dark ? 0.6 : 0.35, 3)
      cyl(c, x0 + rl.ja, x1 - rl.jb, y, z, n === 0 && t > 0.4 ? r * (1 - 0.35 * (t - 0.4) / 0.6) : r, spin, sp)
    }
  }
  /** warm wood (table, press, tray), celadon glaze, the teapot's clay */
  const woods = () => {
    const t = (cl: RGB) => mix(cl, P.lantern, P.dark ? 0.16 : 0.22)
    return { hi: t(P.dark ? mix(P['rock-mid'], P['rock-hi'], 0.3) : mix(P['rock-mid'], P['rock-lo'], 0.2)), mid: t(P.dark ? P['rock-mid'] : mix(P['rock-mid'], P['rock-lo'], 0.5)), lo: t(mix(P['rock-lo'], P.umbra, P.dark ? 0.2 : 0.1)), dk: t(mix(P['rock-lo'], P.umbra, 0.45)) }
  }
  let WD = woods()
  const glz = () => (P.dark ? mix(P['moss-c'], P['step-hi'], 0.35) : mix(P['moss-c'], P.card, 0.3))
  const clay = () => (P.dark ? mix(mix(P.vermilion, P.umbra, 0.45), P['rock-mid'], 0.3) : mix(mix(P.vermilion, P['rock-lo'], 0.45), P.ink, 0.3))
  let GLZ = glz(), CLAY = clay()
  let serif = 'serif'

  function drawLive() {
    const c = cL
    if (!c || !W) return
    c.clearRect(0, 0, W, H)
    beam(c)
    // shelf bundles (the chosen one is on the table or in the air)
    for (let k = 0; k < K.models.length; k++) {
      if (k === sel || fly?.k === k || drag?.k === k) continue
      const [a, b, y, z] = shelfPose(k)
      const lift = hover === k ? 0.025 : 0
      bundle(c, k, a, b, y + lift, z, 0, 0)
    }
    table(c)
    moonlight(c)
    teaSet(c)
    if (sel >= 0 && !(fly && fly.k === sel)) {
      const [a, b, y, z] = tablePose(lenNow)
      bundle(c, sel, a, b, y, z, 1, spillN)
    }
    press(c)
    spilled(c)
    if (fly) {
      const t = ease(fly.t)
      const to = fly.back ? shelfPose(fly.k) : tablePose(wantLen())
      const f = fly.from
      const lerp = (i: number) => f[i] + (to[i] - f[i]) * t
      bundle(c, fly.k, lerp(0), lerp(1), lerp(2) + Math.sin(Math.PI * t) * 0.35, lerp(3), t > 0.5 ? to[4] : f[4], 0)
    }
    if (drag) {
      const len = Math.min(gbOf(K.models[drag.k]) / ram, 1.3) * Lnow
      softPool(c, cam, drag.x, R.TY + 0.002, drag.z, len / 2, 0.2, SHADE, 0.3, 3)
      bundle(c, drag.k, drag.x - len / 2, drag.x + len / 2, R.TY + 0.22, drag.z, 1, 0)
    }
  }

  // ── the one loop: tweens of table length, bundle length, press, fly, roll-out, nudge ──
  const loop = createLoop(root, (time, dt) => {
    let busy = false
    const step = (t: number, dur: number) => {
      if (t >= 1) return 1
      busy = true
      return Math.min(1, t + (still ? 1 : dt / dur))
    }
    tL = step(tL, 0.55)
    Lnow = Lfrom + (Lto - Lfrom) * ease(tL)
    tLen = step(tLen, 0.6)
    lenNow = lenFrom + (lenTo - lenFrom) * ease(tLen)
    tPress = step(tPress, 0.9)
    pressQ = pressFrom + (pressTo - pressFrom) * ease(tPress)
    if (tPress < 1) crank += dt * 9 * (pressTo > pressFrom ? 1 : -1)
    if (fly) {
      fly.t = step(fly.t, 0.75)
      if (fly.t >= 1) landed()
    }
    if (spillN) tSpill = step(tSpill, 1.9)
    tNudge = step(tNudge, 0.5)
    nudge = tNudge < 1 ? Math.sin(tNudge * Math.PI * 3) * 0.02 * (1 - tNudge) + 0.03 * ease(Math.min(1, tNudge * 2)) : nudgeRest
    // the room is redrawn only while something in it moves; the motes alone redraw only their own thin layer
    if (busy || drag || !dt || dirty) {
      dirty = false
      drawLive()
      place2dom()
    }
    idle += dt
    const air = airOn && idle < 10
    if (air) motes(time)
    else if (cA && airWas) cA.clearRect(0, 0, W, H)
    airWas = air
    return busy || !!drag || air
  }, { essential: true })
  let dirty = false, airWas = false
  root.addEventListener('pointermove', () => {
    idle = 0
    if (airOn && !loop.running) loop.start()
  })
  ctx.onCleanup(() => loop.dispose())
  let nudgeRest = 0
  const wake = () => {
    dirty = true
    if (!loop.running) loop.wake()
  }
  const run = () => {
    dirty = true
    idle = 0
    loop.start()
  }

  // ── actions ──
  function place(k: number, from?: [number, number, number, number, number]) {
    if (fly) return
    if (sel >= 0 && sel !== k) {
      // the old bundle goes back to its place on the shelf
      spillN = 0
    }
    const prev = sel
    sel = -1
    spillN = 0
    fly = { k, t: still ? 1 : 0, from: from ?? shelfPose(k), back: false }
    if (prev === k) fly.from = tablePose(lenNow)
    models.forEach((b, j) => b.setAttribute('aria-pressed', String(j === k)))
    ctx.chime('soft')
    run()
  }
  function landed() {
    if (!fly) return
    const { k, back } = fly
    fly = null
    if (back) return
    sel = k
    lenNow = lenFrom = lenTo = wantLen()
    tLen = 1
    settle(true)
    placed++
    rule.hidden = false
    // the steps: a bundle on the table → the table's end board (your RAM) → the press (the original's weight)
    if (placed === 1 && step === 0) (step = 1), ctx.prompt(K.prompts[1]), point(ramEl, [-1, 0])
    if (placed >= 3) {
      sheet.show()
      tell('fit')
    }
  }
  let step = 0
  /** the fit after a change: state on the tag, rolls off the edge, the tea set pushed when it is tight */
  function settle(fresh: boolean) {
    if (sel < 0) return
    const m = K.models[sel]
    const r = ratio()
    const kind = fitOf(r) as keyof typeof K.states
    root.dataset.fit = kind
    const n = kind === 'spill' ? clamp(1 + Math.round((r - 1) * 2), 1, Math.max(1, Math.floor(spillOrd[sel].length / 2))) : 0
    if (n !== spillN || fresh) {
      spillN = n
      tSpill = n && !still ? 0 : 1
    }
    const push = kind === 'tight' ? 1 : 0
    if (push && nudgeRest === 0 && !still) tNudge = 0
    nudgeRest = push * 0.03
    tag.hidden = str.hidden = false
    tag.say(h('strong', null, `${m.label} · ${fill(K.sizeText, { gb: num(gbOf(m)) })}`), h('span', null, K.states[kind]), h('small', { class: 't32t-decode' }, fill(K.sizeDecode, { label: m.label, n: m.params })))
    ctx.chime(kind === 'spill' ? 'low' : 'tap')
    run()
  }
  function setRam(i: number, glide = true) {
    const n = RAMS[clamp(i, 0, RAMS.length - 1)]
    const changed = n !== ram
    ram = n
    Lfrom = Lnow
    Lto = LEN(ram) * R.tl
    tL = glide && !still ? 0 : 1
    if (tL === 1) Lnow = Lto
    ramText.textContent = fill(K.ramText, { n: ram })
    ramEl.setAttribute('aria-valuenow', String(RAMS.indexOf(ram)))
    ramEl.setAttribute('aria-valuetext', fill(K.ramText, { n: ram }))
    labelModels()
    if (sel >= 0) {
      lenFrom = lenNow
      // the bundle's share of the new table, in the new table's metres
      lenTo = Math.min(gbOf(K.models[sel]) / ram, 1.6) * Lto
      tLen = tL
      if (tLen === 1) lenNow = lenTo
      if (changed) settle(false)
    }
    notches.forEach((n, i) => n.classList.toggle('on', RAMS[i] <= ram))
    if (changed && step === 1) (step = 2), ctx.prompt(K.prompts[2]), point(pressEl, [0, 1])
    run()
  }
  function setBits(on: boolean) {
    if (on === q4) return
    q4 = on
    pressFrom = pressQ
    pressTo = q4 ? 1 : 0
    tPress = still ? 1 : 0
    if (still) pressQ = pressTo
    pressEl.setAttribute('aria-pressed', String(q4))
    pressText.textContent = K.bits[q4 ? 1 : 0].label
    labelModels()
    if (sel >= 0) {
      lenFrom = lenNow
      lenTo = wantLen()
      tLen = tPress
      if (tLen === 1) lenNow = lenTo
      settle(false)
    }
    ctx.chime('soft')
    tell('press')
    if (step === 2) step = 3, point(null)
    run()
  }
  /** two lessons, each once, after its evidence: three bundles placed → the half-the-table rule; the press → compression */
  function tell(what: 'fit' | 'press') {
    if (told.has(what)) return
    told.add(what)
    ctx.insight((what === 'fit' ? K.insightFit : K.insightPress) as Fact, K.detail as Detail)
    root.classList.add('told') // one block of words: the rule board's text fades (the insight says it)
  }
  function labelModels() {
    K.models.forEach((m, k) => {
      const gb = num(gbOf(m))
      sizeEls[k].textContent = fill(K.sizeText, { gb })
      models[k].setAttribute('aria-label', fill(K.modelAria, { label: m.label, gb, ram }))
    })
  }

  // drag a bundle off the shelf: it hangs over the room at true scale for this table; let go over the table to set it down
  function grab(k: number, e: PointerEvent) {
    if (e.button || fly) return
    const b = models[k]
    const sx = e.clientX, sy = e.clientY
    const box0 = root.getBoundingClientRect()
    let moved = false
    delete b.dataset.dragged
    b.setPointerCapture(e.pointerId)
    const at = (ev: PointerEvent) => {
      if (!cam.floor(ev.clientX - box0.left, ev.clientY - box0.top, R.TY + 0.22)) return false
      drag = { k, x: cam.o[0], z: clamp(cam.o[2], R.zB - 1.2, R.zF + 1.4) }
      return true
    }
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return
      moved = true
      if (sel === k) sel = -1
      at(ev)
      run()
    }
    const up = (ev: PointerEvent) => {
      b.removeEventListener('pointermove', move)
      b.removeEventListener('pointerup', up)
      b.removeEventListener('pointercancel', up)
      if (!moved) return
      b.dataset.dragged = '1'
      setTimeout(() => delete b.dataset.dragged)
      const d = drag
      drag = null
      const over = d && d.x > xL() - 0.5 && d.x < R.xR + 0.3 && d.z > R.zB - 0.7 && d.z < R.zF + 0.8
      const len = d ? Math.min(gbOf(K.models[k]) / ram, 1.3) * Lnow : 0
      const from: [number, number, number, number, number] = d ? [d.x - len / 2, d.x + len / 2, R.TY + 0.22, d.z, 1] : shelfPose(k)
      if (over && ev.type === 'pointerup') place(k, from)
      else {
        fly = { k, t: still ? 1 : 0, from, back: true }
        if (sel === k) sel = -1
        run()
      }
    }
    b.addEventListener('pointermove', move)
    b.addEventListener('pointerup', up)
    b.addEventListener('pointercancel', up)
  }

  // the RAM end plank: drag it out / in along the table, it snaps to 8 / 16 / 32 / 64
  ramEl.addEventListener('keydown', (e) => {
    const i = RAMS.indexOf(ram)
    const k = e.key
    const to = k === 'ArrowRight' || k === 'ArrowUp' ? i + 1 : k === 'ArrowLeft' || k === 'ArrowDown' ? i - 1 : k === 'Home' ? 0 : k === 'End' ? RAMS.length - 1 : -2
    if (to === -2) return
    e.preventDefault()
    // right = more RAM; the plank slides out to the left
    setRam(to)
  })
  ramEl.addEventListener('pointerdown', (e) => {
    if (e.button) return
    const box0 = root.getBoundingClientRect()
    ramEl.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) => {
      if (!cam.floor(ev.clientX - box0.left, ev.clientY - box0.top, R.TY)) return
      Lnow = clamp(R.xR - cam.o[0], LEN(RAMS[0]) * R.tl * 0.92, LEN(RAMS[RAMS.length - 1]) * R.tl * 1.04)
      Lfrom = Lto = Lnow
      tL = 1
      if (sel >= 0) lenNow = lenTo = Math.min(gbOf(K.models[sel]) / ram, 1.6) * Lnow
      run()
    }
    const up = () => {
      ramEl.removeEventListener('pointermove', move)
      ramEl.removeEventListener('pointerup', up)
      ramEl.removeEventListener('pointercancel', up)
      let best = 0
      RAMS.forEach((n, i) => Math.abs(LEN(n) * R.tl - Lnow) < Math.abs(LEN(RAMS[best]) * R.tl - Lnow) && (best = i))
      setRam(best)
    }
    ramEl.addEventListener('pointermove', move)
    ramEl.addEventListener('pointerup', up)
    ramEl.addEventListener('pointercancel', up)
  })
  // the press: click / Enter turns the crank; or turn it by hand (drag round the screw)
  pressEl.addEventListener('click', () => !pressEl.dataset.dragged && setBits(!q4))
  pressEl.addEventListener('pointerdown', (e) => {
    if (e.button) return
    const box0 = root.getBoundingClientRect()
    cam.p(R.press.x, 0.62, R.press.z)
    const cx = cam.o[0] + box0.left, cy = cam.o[1] + box0.top
    let last = Math.atan2(e.clientY - cy, e.clientX - cx), turned = 0
    delete pressEl.dataset.dragged
    pressEl.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) => {
      const a = Math.atan2(ev.clientY - cy, ev.clientX - cx)
      let d = a - last
      if (d > Math.PI) d -= Math.PI * 2
      if (d < -Math.PI) d += Math.PI * 2
      last = a
      turned += d
      crank += d
      if (Math.abs(turned) > 0.4) pressEl.dataset.dragged = '1'
      if (Math.abs(turned) > Math.PI * 1.6) {
        turned = 0
        setBits(!q4)
      }
      run()
    }
    const up = () => {
      pressEl.removeEventListener('pointermove', move)
      pressEl.removeEventListener('pointerup', up)
      pressEl.removeEventListener('pointercancel', up)
      setTimeout(() => delete pressEl.dataset.dragged)
    }
    pressEl.addEventListener('pointermove', move)
    pressEl.addEventListener('pointerup', up)
    pressEl.addEventListener('pointercancel', up)
  })

  // ── DOM over the canvas: hit areas and labels follow the projected things ──
  const px = (n: number) => `${n.toFixed(1)}px`
  function place2dom() {
    if (!W) return
    // the state tag is tied to the bundle's front cord and hangs over the table's edge
    if (sel >= 0 && !tag.hidden) {
      const [a, b] = tablePose(lenNow)
      cam.p(clamp(a + (b - a) * (tall ? 0.6 : 0.72), xL() + 0.25, xTea() - 0.12), R.TY - 0.01, R.zF + 0.01)
      tag.style.transform = str.style.transform = `translate(${px(cam.o[0])}, ${px(cam.o[1])})`
    }
    // the size burnt into the end plank's front face
    cam.p(xL() + 0.08, R.TY - 0.023, R.zF)
    ramEl.style.transform = `translate(${px(Math.max(cam.o[0], 40))}, ${px(cam.o[1])})`
    // the apron's words, centred on the front of the table under the free top
    cam.p((xL() + xTea()) / 2, R.TY - 0.04, R.zF)
    apron.style.transform = `translate(${px(cam.o[0])}, ${px(cam.o[1])})`
  }
  function layoutDom() {
    const slot = (R.shelf.x1 - R.shelf.x0) / K.models.length
    models.forEach((b, k) => {
      const cx = R.shelf.x0 + slot * (k + 0.5)
      cam.p(cx - slot * 0.46, R.shelf.y + 0.26, R.wallZ + R.shelf.d)
      const x0 = cam.o[0], y0 = cam.o[1]
      cam.p(cx + slot * 0.46, R.shelf.y - 0.01, R.wallZ + R.shelf.d)
      Object.assign(b.style, { left: px(x0), top: px(y0), width: px(cam.o[0] - x0), height: px(cam.o[1] - y0) })
    })
    const { x, z } = R.press
    cam.p(x - 0.3, 0.82, z)
    const a = cam.o[0], bb = cam.o[1]
    cam.p(x + 0.3, 0, z + 0.15)
    Object.assign(pressEl.style, { left: px(a), top: px(bb), width: px(cam.o[0] - a), height: px(cam.o[1] - bb) })
    // the rule hangs on the wall beside the window, a sheet of paper sized to its patch of plaster
    const { x0, x1, y0, y1 } = R.rule
    cam.p(x0, y1, R.wallZ)
    const rx = cam.o[0], ry = cam.o[1]
    cam.p(x1, y0, R.wallZ)
    Object.assign(rule.style, { left: px(rx), top: px(ry), width: px(cam.o[0] - rx) })
    cam.p(x0, R.tall ? 2.62 : 1.9, R.wallZ)
    rule.style.setProperty('--cord', px(clamp(ry - cam.o[1], 8, 22))) // two short cords to their nails
    // the notches on the mat under the table's front edge (only those inside the frame)
    RAMS.forEach((r, i) => {
      cam.p(R.xR - LEN(r) * R.tl + 0.03, 0.002, R.zF - 0.01)
      notches[i].hidden = cam.o[0] < 14 || cam.o[0] > W - 14
      notches[i].style.transform = `translate(${px(cam.o[0])}, ${px(cam.o[1])})`
    })
    root.classList.toggle('tall', tall)
    place2dom()
  }

  let bake: { cancel(): void } | null = null
  let painted = false
  function layout() {
    const [w, hh] = stageSize(ctx)
    if (w < 40 || hh < 40) return
    if (w === W && hh === H && painted) return
    W = w
    H = hh
    tall = W / H < 0.9
    R = room(tall)
    root.style.height = px(H)
    const Lmax = LEN(RAMS[RAMS.length - 1]) * R.tl
    Lnow = Lfrom = Lto = LEN(ram) * R.tl
    tL = 1
    if (sel >= 0) lenNow = lenFrom = lenTo = wantLen()
    // the frame holds the longest table, the press, the shelf, the window and the rule, close: the table fills most of the width
    const box: V3[] = [
      // the longest table may run off the left edge (its end plank's size stays in view): the frame holds the 32 GB one
      [R.xR - Math.min(Lmax, LEN(32) * R.tl), 0.05, R.zF], [R.xR, 0, R.zF], [R.press.x + 0.29, 0, R.press.z + 0.15], [R.press.x - 0.29, 0, R.press.z + 0.15], [R.press.x, 0.8, R.press.z],
      [R.shelf.x0, R.shelf.y + 0.24, R.wallZ], [R.shelf.x1, R.shelf.y + 0.24, R.wallZ],
      [R.win.x, R.win.y + R.win.r + 0.04, R.wallZ], [R.rule.x0, R.rule.y1, R.wallZ], [R.rule.x1, R.rule.y1, R.wallZ],
    ]
    serif = getComputedStyle(root).getPropertyValue('--serif') || 'serif'
    cam = fitCamera({ yaw: R.yaw, pitch: R.pitch, fov: R.fov, W, H, box, rect: tall ? [W * 0.03, H * 0.05, W * 0.97, H * 0.88] : [W * 0.03, H * 0.04, W * 0.97, H * 0.93] })
    dpr = Math.min(devicePixelRatio || 1, low ? 1 : 1.5)
    cR = fit(roomCv, W, H, low)
    cL = fit(liveCv, W, H, low)
    cA = airOn ? fit(airCv, W, H, low) : null
    bake?.cancel()
    const job = paintRoom(cR)
    bake = sliced(job, { sync: ctx.reduced || painted })
    painted = true
    layoutDom()
    g.refresh()
    drawLive()
    if (airOn) loop.start() // the motes drift for a while, then everything rests
  }
  ctx.onCleanup(() => bake?.cancel())
  const ro = new ResizeObserver(() => requestAnimationFrame(layout))
  ro.observe(ctx.el)
  ctx.onCleanup(() => ro.disconnect())
  ctx.onCleanup(onPrefs(() => {
    const next = palette()
    if (next.key === P.key) return
    P = next
    SP = sprites(P)
    MOTE = rgba(P.moon, 0.9)
    INK = inkS(); RIM = rgba(P.moon, 0.7); CORD = rgba(mix(P['ink-2'], P.lantern, 0.25)); ENDC = rgba(mix(P['step-hi'], P.moon, 0.2)); SHADE = rgba(P.umbra)
    WD = woods(); GLZ = glz(); CLAY = clay()
    if (cR) {
      bake?.cancel()
      bake = sliced(paintRoom(cR), { sync: true })
    }
    drawLive()
  }))

  // ── guidance: one dot at a time (the 8B bundle → the end plank → the press), the plank easing out when the room waits ──
  const g = guide(ctx)
  let dot: Mark | null = null
  function point(el: HTMLElement | null, dir: [number, number] = [0, 1]) {
    dot?.done()
    dot = el ? g.dot(el, { dir }) : null
  }
  const onIdle = () => {
    if (step !== 1 || still || fly) return
    const L0 = LEN(ram) * R.tl
    Lfrom = Lnow, Lto = L0 + 0.08, tL = 0
    run()
    const id = setTimeout(() => ((Lfrom = Lnow), (Lto = L0), (tL = 0), run()), 650)
    ctx.onCleanup(() => clearTimeout(id))
  }
  ctx.el.addEventListener('p2:idle', onIdle)
  ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', onIdle))
  setRam(RAMS.indexOf(16), false)
  pressText.textContent = K.bits[q4 ? 1 : 0].label
  point(models[1], [1, 0.4])
  ctx.prompt(K.prompt)
}
