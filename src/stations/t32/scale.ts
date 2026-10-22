import raw from '../../content/tram-32.json'
import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import { onPrefs } from '../../core/prefs'
import { blob, curve, rng, rock, stroke, type Pt } from '../../ui/part2/ink'
import type { Detail, SceneCtx } from '../types'
import { guide, type Mark } from '../../ui/part2/guide'
import { brush, clamp, fit, grainOver, live, mix, palette, rgba, stageSize, type Pal, type RGB } from './kit'

const K = raw.scenes.scale
type Side = 'local' | 'cloud'
const f1 = (n: number) => n.toFixed(1)

/** where each weight lies in the shallows: [x share, row (0 far … 1 near), size], by weight index (the sides mixed) */
const SPOTS_W: [number, number, number][] = [[0.3, 0, 0.84], [0.15, 1, 1.04], [0.73, 0, 0.8], [0.51, 0, 0.88], [0.4, 1, 1.12], [0.68, 1, 1]]
const SPOTS_T: [number, number, number][] = [[0.2, 0, 0.86], [0.24, 1, 1], [0.82, 0, 0.84], [0.51, 0, 0.9], [0.55, 1, 1.02], [0.85, 1, 0.98]]
/** hammer marks on the copper (unit disc, deterministic) */
const DENTS = (() => { const r = rng(3360); return Array.from({ length: 16 }, () => [r() * 1.7 - 0.85, 0.25 + r() * 0.65, 0.04 + r() * 0.05] as const) })()

/**
 * Scene 1 — a steelyard hung from an old pine bough across a great moon, seen from low on the water. Left pan: your
 * house with its oil lamp; right pan: a silver cloud over a small moon. A slip with a job hangs from the beam (three jobs
 * in turn); lift the carved river stone that is the reason that matters for it and drop it on the scale: it settles on its
 * own side, the beam tips firmly that way (the answer), the copper pans swing on their chains, a paper tag with the reason
 * hangs under the pan, the water mirrors it all. A stone that is not the reason is thrown back. 2.5D: painted flats at
 * depths (sky, bough, scale, water) with a little parallax, the stones DOM over the water; one loop for the spring.
 */
export function scaleScene(ctx: SceneCtx) {
  const low = ctx.quality === 'low'
  const still = low || ctx.reduced
  const placed: Record<Side, number[]> = { local: [], cloud: [] }
  let sel = -1 // the lifted stone (tap / keys)
  let done = false
  let task = 0 // the job hanging from the beam
  let busyTask = false // between two jobs: the answer is showing
  let wrongs = 0 // missed tries on this job (after one, the dot shows the stone)
  const T = K.tasks.length
  const idOf = (k: number) => K.weights[k].id

  // ── DOM: painted layers, then the stones in the water, the pans' hit areas, the reason tags ──
  const skyCv = h('canvas', { class: 't32-cv t32-bleed', 'aria-hidden': 'true' })
  const scaleCv = h('canvas', { class: 't32-cv t32-bleed', 'aria-hidden': 'true' })
  const waterCv = h('canvas', { class: 't32-cv t32-bleed t32s-water', 'aria-hidden': 'true' })
  const boughCv = h('canvas', { class: 't32-cv t32-bleed t32s-bough', 'aria-hidden': 'true' })
  const say = live('t32s-say visually-hidden') // spoken only: the tags and the slip show it
  const tags: Record<Side, HTMLElement[]> = { local: [], cloud: [] }
  const tagH = new Map<HTMLElement, number>()
  const pans: Record<Side, HTMLButtonElement> = {} as Record<Side, HTMLButtonElement>
  for (const sd of K.sides) {
    const id = sd.id as Side
    pans[id] = h('button', { class: 't32s-pan', type: 'button', 'data-side': id, 'aria-label': sd.aria, onClick: () => (sel >= 0 ? drop(sel) : undefined) })
  }
  const stones = K.weights.map((w, k) => {
    const b = h('button', { class: 't32s-stone', type: 'button', 'aria-pressed': 'false', style: `--i:${k}` }, h('span', { class: 't32s-carve' }, w.label))
    b.addEventListener('click', () => !b.dataset.dragged && lift(k))
    b.addEventListener('pointerdown', (e) => grab(k, e))
    b.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        drop(k)
      }
    })
    return b
  })
  const tagBox = h('div', { class: 't32s-tagbox' })
  // the job on a paper slip hung from the beam's middle: its count, the job, then the answer once the beam has tipped
  const slipN = h('small', null), slipJob = h('b', null), slipAns = h('span', { class: 't32s-ans' })
  const slip = h('p', { class: 't32s-job' }, slipN, slipJob, slipAns)
  const root = h('div', { class: 't32 t32s', role: 'group', 'aria-label': K.aria },
    skyCv, scaleCv, waterCv, boughCv,
    h('div', { class: 't32-mist', 'aria-hidden': 'true' }),
    h('p', { class: 'visually-hidden' }, K.art),
    slip, pans.local, pans.cloud, tagBox,
    h('div', { class: 't32s-stones', role: 'group', 'aria-label': K.stonesLabel }, ...stones),
    say)
  ctx.art.append(root)

  // ── geometry (px in the stage) ──
  let W = 0, H = 0, tall = false
  let G = { yw: 0, mx: 0, my: 0, mr: 0, px: 0, py: 0, A: 0, rx: 0, hang: 0 }
  /** each stone: its waterline centre, width, dome height above the water, depth below it */
  let SG: { x: number; y: number; w: number; hd: number; hb: number }[] = []
  let tagW = 0
  let P: Pal = palette()
  let serif = 'serif'
  let cS: CanvasRenderingContext2D | null = null, cC: CanvasRenderingContext2D | null = null, cW: CanvasRenderingContext2D | null = null, cB: CanvasRenderingContext2D | null = null

  // ── physics: beam angle on a damped spring, each pan a damped pendulum, parallax easing ──
  let th = 0, thV = 0
  const sw2: Record<Side, number[]> = { local: [0, 0], cloud: [0, 0] } // pan swing angle, its speed
  let parX = 0, parY = 0, parTX = 0, parTY = 0
  const target = () => clamp((placed.local.length - placed.cloud.length) * -0.22, -0.24, 0.24) // the reason's side sinks, firmly
  let ripples: { x: number; y: number; t: number }[] = []

  /** the beam's two ends and the pans hanging under them (with their swing) */
  const ends = () => {
    const c = Math.cos(th), s = Math.sin(th)
    const L: Pt = [G.px - G.A * c, G.py - G.A * s], R: Pt = [G.px + G.A * c, G.py + G.A * s]
    return { L, R }
  }
  const panAt = (side: Side, e: Pt): Pt => {
    const a = sw2[side][0]
    return [e[0] + Math.sin(a) * G.hang, e[1] + Math.cos(a) * G.hang]
  }

  // ── the old bough: one limb line shared by the bough painting and its shadow on the moon ──
  let limb: Pt[] = []
  let limbW = 0
  const limbAt = (x: number) => limb.reduce((b, p) => (Math.abs(p[0] - x) < Math.abs(b[0] - x) ? p : b))
  function boughGeo() {
    const { px, mr } = G
    const top = G.py - mr * 0.78
    const line = [...curve([-W * 0.1, top + H * 0.15], [W * 0.16, top - H * 0.07], [px - W * 0.05, top], 18), ...curve([px - W * 0.05, top], [px + W * 0.16, top + H * 0.02], [W * 1.03, top - H * (tall ? 0.06 : 0.1)], 18).slice(1)]
    const r = rng(3330)
    limb = line.map(([x, y], i) => [x, y + Math.sin(i * 1.3) * H * 0.007 + (r() - 0.5) * H * 0.005] as Pt)
    limbW = Math.max(13, Math.min(H * 0.05, W * 0.05))
  }
  /** a tapering body along pts (w0 → w1): the outline, and its top and bottom edges */
  function taper(pts: Pt[], w0: number, w1: number, wob = 0.12, seed = 1) {
    const r = rng(seed)
    const top: Pt[] = [], bot: Pt[] = []
    pts.forEach((p, i) => {
      const t = i / (pts.length - 1)
      const A = pts[Math.max(0, i - 1)], B = pts[Math.min(pts.length - 1, i + 1)]
      const dl = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1
      const nx = (B[1] - A[1]) / dl, ny = -(B[0] - A[0]) / dl // toward the top of the screen for a left-to-right line
      const hw = ((w0 + (w1 - w0) * t ** 0.8) / 2) * (1 + (r() - 0.5) * wob + Math.sin(i * 0.9) * wob * 0.4)
      top.push([p[0] + nx * hw, p[1] + ny * hw])
      bot.push([p[0] - nx * hw, p[1] - ny * hw])
    })
    const path = new Path2D()
    top.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)))
    for (let i = bot.length - 1; i >= 0; i--) path.lineTo(bot[i][0], bot[i][1])
    path.closePath()
    return { path, top, bot }
  }
  /** the twigs off the limb: [x share, rise, spread] (a phone has fewer, bigger) */
  const twigs = (): [number, number, number][] => tall
    ? [[0.07, 0.08, 0.3], [0.34, 0.06, 0.26], [0.64, 0.075, 0.28], [0.9, 0.05, 0.22]]
    : [[0.04, 0.07, 0.17], [0.17, 0.09, 0.16], [0.34, 0.055, 0.13], [0.6, 0.065, 0.13], [0.72, 0.095, 0.16], [0.87, 0.06, 0.14]]

  // ── painting ──
  function* paintSky(c: CanvasRenderingContext2D) {
    const { yw, mx, my, mr } = G
    c.clearRect(0, 0, W, H)
    const sky = c.createLinearGradient(0, 0, 0, yw)
    sky.addColorStop(0, rgba(P.dark ? mix(P.wash, P.paper, 0.5) : mix(P.water, P.mist, 0.55)))
    sky.addColorStop(0.75, rgba(P.dark ? mix(P.paper, P.mist, 0.12) : mix(P.mist, P.paper, 0.3)))
    sky.addColorStop(1, rgba(P.dark ? mix(P.paper, P.mist, 0.22) : P.mist))
    c.fillStyle = sky
    c.fillRect(0, 0, W, yw + 2)
    // the moon: a wide halo, the disc, its seas, a wisp of cloud across its foot
    const halo = c.createRadialGradient(mx, my, mr * 0.9, mx, my, mr * 3.6)
    halo.addColorStop(0, rgba(P.dark ? P.moon : mix(P.moon, P.lantern, 0.2), P.dark ? 0.32 : 0.5))
    halo.addColorStop(1, rgba(P.moon, 0))
    c.fillStyle = halo
    c.fillRect(0, 0, W, yw)
    const disc = c.createRadialGradient(mx - mr * 0.25, my - mr * 0.3, mr * 0.1, mx, my, mr)
    disc.addColorStop(0, rgba(mix(P.moon, P.card, P.dark ? 0.1 : 0.35)))
    disc.addColorStop(1, rgba(P.dark ? mix(P.moon, P.lantern, 0.12) : mix(P.moon, P.lantern, 0.22)))
    c.fillStyle = disc
    c.beginPath()
    c.arc(mx, my, mr, 0, Math.PI * 2)
    c.fill()
    c.save()
    c.clip()
    c.fillStyle = rgba(P.dark ? P['rock-hi'] : P['rock-mid'], P.dark ? 0.14 : 0.2)
    c.fill(new Path2D(blob(mx - mr * 0.3, my - mr * 0.15, mr * 0.34, mr * 0.22, 3301, 0.3)))
    c.fill(new Path2D(blob(mx + mr * 0.28, my + mr * 0.3, mr * 0.26, mr * 0.18, 3302, 0.3)))
    c.fill(new Path2D(blob(mx + mr * 0.05, my - mr * 0.5, mr * 0.16, mr * 0.1, 3303, 0.3)))
    // the bough's soft shadow across the disc (offset down and right, in three thin passes for a soft edge)
    const sh = taper(limb, limbW * 1.1, limbW * 0.25, 0.1, 3331)
    c.fillStyle = rgba(P.umbra, P.dark ? 0.13 : 0.09)
    for (const [dx, dy] of [[0.05, 0.1], [0.08, 0.13], [0.03, 0.15]]) {
      c.save()
      c.translate(mr * dx, mr * dy)
      c.fill(sh.path)
      for (const [fx, up, fw] of twigs()) {
        const [x, y] = limbAt(fx * W)
        c.beginPath()
        c.ellipse(x + fw * W * 0.12, y - up * H, fw * W * 0.42, fw * W * 0.16, 0, 0, Math.PI * 2)
        c.fill()
      }
      c.restore()
    }
    c.restore()
    c.strokeStyle = rgba(P.dark ? P.wash : P.ink, P.dark ? 0.2 : 0.3)
    c.lineWidth = P.dark ? 1 : 1.4
    c.beginPath()
    c.arc(mx, my, mr, 0, Math.PI * 2)
    c.stroke()
    // long wisps of cloud drawn across the sky, one over the moon's foot
    const wr = rng(3306)
    for (let i = 0; i < 6; i++) {
      const y = H * (0.12 + i * 0.075) + (wr() - 0.5) * H * 0.03, x = W * (0.1 + wr() * 0.8), len = W * (0.18 + wr() * 0.25)
      c.fillStyle = rgba(P.dark ? mix(P.mist, P.paper, 0.4) : P.mist, P.dark ? 0.1 + wr() * 0.08 : 0.35 + wr() * 0.3)
      c.fill(brush([[x - len / 2, y], [x, y - H * 0.006], [x + len / 2, y + H * 0.004]], H * (0.008 + wr() * 0.012), 0.4, 0.4, 0.05))
    }
    c.fillStyle = rgba(P.dark ? mix(P.mist, P.paper, 0.5) : P.mist, P.dark ? 0.35 : 0.85)
    c.fill(new Path2D(blob(mx + mr * 0.5, my + mr * 0.82, mr * 1.5, mr * 0.12, 3304, 0.25)))
    c.fill(new Path2D(blob(mx - mr * 1.4, my + mr * 1.2, mr * 1.1, mr * 0.08, 3305, 0.25)))
    yield
    // far ridges in two washes, mist at their feet, sitting on the water line
    const ridge = (base: number, hgt: number, seed: number, col: RGB, a: number) => {
      const r = rng(seed)
      c.beginPath()
      c.moveTo(-10, base + 4)
      for (let i = 0; i <= 40; i++) {
        const t = i / 40
        const pk = Math.max(0, Math.sin(t * 6.2 + seed)) ** 1.5 * 0.75 + Math.sin(t * 17 + seed) * 0.06 + r() * 0.03
        c.lineTo(t * (W + 20) - 10, base - hgt * pk)
      }
      c.lineTo(W + 10, base + 4)
      c.fillStyle = rgba(col, a)
      c.fill()
    }
    ridge(yw - 2, H * 0.16, 7, P.dark ? mix(P.wash, P.mist, 0.14) : mix(P.water, P.mist, 0.35), 0.75)
    mistBand(c, yw - H * 0.05, H * 0.07, P.dark ? 0.12 : 0.65)
    ridge(yw + 1, H * 0.09, 11, P.dark ? P.wash : mix(P.water, P.wash, 0.2), 0.85)
    mistBand(c, yw - H * 0.01, H * 0.035, P.dark ? 0.16 : 0.7)
    yield
    // still water: darker than the sky in the dark (brighter reflections), a mid blue-grey in the light
    const wg = c.createLinearGradient(0, yw, 0, H)
    wg.addColorStop(0, rgba(P.dark ? mix(P.water, P.mist, 0.08) : mix(P.water, P.mist, 0.45)))
    wg.addColorStop(1, rgba(P.dark ? P.water : mix(P.water, P.wash, 0.12)))
    c.fillStyle = wg
    c.fillRect(0, yw, W, H - yw)
    mistBand(c, yw + H * 0.008, H * 0.018, P.dark ? 0.1 : 0.4)
    // the moon's road: broken dry strokes, longer toward the viewer
    const r = rng(3310)
    c.fillStyle = rgba(P.moon, P.dark ? 0.75 : 0.85)
    for (let y = yw + 3; y < H; y += 3 + (y - yw) * 0.05) {
      const near = (y - yw) / (H - yw)
      if (r() < 0.25) continue
      const len = mr * (0.3 + near * 1.6) * (0.4 + r())
      const x = mx + (r() - 0.5) * mr * (0.6 + near * 0.8)
      c.fill(brush([[x - len / 2, y], [x + len / 2, y + (r() - 0.5)]], 1 + near * 2.4, 0.3, 0.3, 0.2))
    }
    grainOver(c, W, H, P.dark ? 0.45 : 0.35)
  }
  function mistBand(c: CanvasRenderingContext2D, y: number, hh: number, a: number) {
    const g = c.createLinearGradient(0, y - hh, 0, y + hh)
    g.addColorStop(0, rgba(P.mist, 0))
    g.addColorStop(0.5, rgba(P.mist, a))
    g.addColorStop(1, rgba(P.mist, 0))
    c.fillStyle = g
    c.fillRect(0, y - hh, W, hh * 2)
  }

  /** the water's surface over the reflection: faint ripple lines and the dark near edge */
  function paintWater(c: CanvasRenderingContext2D) {
    const { yw } = G
    c.clearRect(0, 0, W, H)
    const r = rng(3320)
    c.strokeStyle = rgba(P.dark ? P.wash : mix(P.water, P.mist, 0.5), P.dark ? 0.55 : 0.5)
    c.lineWidth = 1
    c.beginPath()
    for (let y = yw + 4; y < H; y += 4 + (y - yw) * 0.04) {
      for (let x = -20; x < W; ) {
        const len = 30 + r() * 120
        c.moveTo(x, y)
        c.lineTo(x + len, y + (r() - 0.5) * 0.8)
        x += len + 20 + r() * 60
      }
    }
    c.stroke()
    c.fillStyle = rgba(P.dark ? P.mist : P.paper, P.dark ? 0.08 : 0.4)
    c.fillRect(0, yw, W, 1.2)
  }

  /** the old bough from beyond the top left, past the moon: a tapering limb of scaly bark, twigs, fans of needles */
  function* paintBough(c: CanvasRenderingContext2D) {
    c.clearRect(0, 0, W, H)
    const ink = P.dark ? mix(P.wash, P.umbra, 0.35) : mix(P.ink, P['rock-lo'], 0.3)
    const far = P.dark ? mix(P.wash, P.mist, 0.12) : mix(P.ink, P.mist, 0.55)
    const r = rng(3332)
    // needle pads behind the limb first, paler: the bough has depth
    for (const [fx, up, fw] of twigs()) {
      const [x, y] = limbAt(fx * W + fw * W * 0.25)
      pad(c, x + fw * W * 0.22, y - up * H * 0.5, fw * W * 0.95, far, 0.5, r)
      yield
    }
    yield
    // the limb: dark bark, the moonlit top rounded off, scaly plates, dry streaks, a moon edge
    const L = taper(limb, limbW, limbW * 0.18, 0.14, 3333)
    c.fillStyle = rgba(ink)
    c.fill(L.path)
    c.save()
    c.clip(L.path)
    const lit = P.dark ? mix(P['rock-mid'], P.moon, 0.15) : mix(P['rock-lo'], P['rock-mid'], 0.4)
    const band = taper(L.top.map(([x, y], i) => [x * 0.62 + limb[i][0] * 0.38, y * 0.62 + limb[i][1] * 0.38] as Pt), limbW * 0.5, limbW * 0.1, 0.3, 3334)
    c.fillStyle = rgba(lit, P.dark ? 0.32 : 0.5)
    c.fill(band.path)
    // bark plates: short curved scales across the limb, darker, thicker at the trunk end
    c.strokeStyle = rgba(P.dark ? P.umbra : P.ink, P.dark ? 0.7 : 0.6)
    c.lineCap = 'round'
    for (let i = 1; i < limb.length - 2; i++) {
      const t = i / limb.length
      const w = limbW * (1 - 0.8 * t ** 0.8)
      const [ax, ay] = limb[i], [bx, by] = limb[i + 1]
      for (let j = 0; j < 3; j++) {
        const u = r(), v = (r() - 0.5) * 0.8
        const x = ax + (bx - ax) * u, y = ay + (by - ay) * u + v * w * 0.8
        c.lineWidth = Math.max(0.7, w * 0.07)
        c.beginPath()
        c.ellipse(x, y, w * (0.22 + r() * 0.14), w * (0.1 + r() * 0.07), Math.atan2(by - ay, bx - ax) + (r() - 0.5) * 0.4, Math.PI * (0.1 + r() * 0.2), Math.PI * (0.9 + r() * 0.2))
        c.stroke()
      }
    }
    c.fillStyle = rgba(P.dark ? P['rock-hi'] : P['rock-mid'], P.dark ? 0.16 : 0.28)
    for (let i = 0; i < 16; i++) {
      const a = Math.floor(r() * (limb.length - 8)), n = 4 + Math.floor(r() * 5)
      const off = (r() - 0.5) * limbW * 0.5
      c.fill(brush(limb.slice(a, a + n).map(([x, y]) => [x, y + off] as Pt), 1 + r() * 1.6, 0.3, 0.4, 0.1))
    }
    c.restore()
    c.lineCap = 'butt'
    c.fillStyle = rgba(P.moon, P.dark ? 0.4 : 0.6)
    c.fill(brush(L.top.slice(2, Math.floor(L.top.length * 0.8)), 1.4, 0.15, 0.4, 0.2))
    c.fillStyle = rgba(P.dark ? P.umbra : P.ink, 0.5)
    c.fill(brush(L.bot.slice(0, Math.floor(L.bot.length * 0.7)), 2, 0.05, 0.5, 0.2))
    yield
    // twigs rising off the limb, each carrying a flat pad of needles on top (the sumi-e pine), some across the moon
    for (const [fx, up, fw] of twigs()) {
      const [x, y] = limbAt(fx * W)
      const tx = x + fw * W * 0.12, ty = y - up * H
      const tw = curve([x, y], [x + fw * W * 0.02, y - up * H * 0.6], [tx, ty + fw * W * 0.04], 10)
      c.fillStyle = rgba(ink, 0.95)
      c.fill(taper(tw, Math.max(4, limbW * 0.34), 1.8, 0.2, 3340 + fx * 100).path)
      for (const d of [-1, 1]) c.fill(taper(curve([tx, ty + fw * W * 0.04], [tx + d * fw * W * 0.12, ty + fw * W * 0.03], [tx + d * fw * W * 0.3, ty + fw * W * 0.01], 6), 2.2, 0.8, 0.2, 3350).path)
      pad(c, tx, ty, fw * W, ink, 0.95, r)
      yield
    }
    // the hanging cord down to the steelyard's pivot
    const [, cy] = limbAt(G.px)
    c.strokeStyle = rgba(P.dark ? P['ink-3'] : P['ink-2'], 0.8)
    c.lineWidth = 1.4
    c.beginPath()
    c.moveTo(G.px, cy + limbW * 0.2)
    c.lineTo(G.px, G.py - H * 0.02)
    c.stroke()
  }

  /**
   * One pad of pine needles centred on (x, y), w wide: a faint wash for its body, then fans of thin tapered needles
   * along a low arch (opening upward, tilting out at the ends), a short fringe hanging under it, moonlit needles on top.
   */
  function pad(c: CanvasRenderingContext2D, x: number, y: number, w: number, col: RGB, a: number, r: () => number) {
    c.fillStyle = rgba(col, a * 0.16)
    c.fill(new Path2D(blob(x, y - w * 0.07, w * 0.5, w * 0.15, 3345 + Math.round(x), 0.3, 18)))
    const fans = Math.max(4, Math.round(w / 34))
    for (let f = 0; f < fans; f++) {
      const u = fans > 1 ? f / (fans - 1) : 0.5
      const fx = x - w * 0.4 + u * w * 0.8 + (r() - 0.5) * w * 0.04
      const fy = y - w * 0.06 * Math.sin(Math.PI * u) + (r() - 0.5) * w * 0.02
      const rad = w * (0.17 + 0.07 * Math.sin(Math.PI * u)) * (0.85 + r() * 0.3)
      const dir = -Math.PI / 2 + (u - 0.5) * 1.1
      const n = 26
      for (let j = 0; j < n; j++) {
        const v = j / (n - 1)
        const ang = dir - Math.PI * 0.52 + v * Math.PI * 1.04 + (r() - 0.5) * 0.1
        const len = rad * (0.6 + 0.4 * Math.sin(v * Math.PI)) * (0.8 + r() * 0.35)
        const bx = fx + (r() - 0.5) * rad * 0.2, by = fy + (r() - 0.5) * rad * 0.08
        c.fillStyle = rgba(col, a * (0.5 + r() * 0.5))
        c.fill(brush([[bx, by], [bx + Math.cos(ang) * len * 0.55, by + Math.sin(ang) * len * 0.5], [bx + Math.cos(ang) * len, by + Math.sin(ang) * len * 0.86]], 1 + r() * 0.9, 0.04, 0.7, 0.12))
      }
      // the short fringe hanging under the pad
      for (let j = 0; j < 7; j++) {
        const ang = Math.PI / 2 + (r() - 0.5) * 1.6, len = rad * (0.25 + r() * 0.2)
        c.fillStyle = rgba(col, a * (0.5 + r() * 0.4))
        c.fill(brush([[fx, fy], [fx + Math.cos(ang) * len, fy + Math.sin(ang) * len]], 0.9 + r() * 0.6, 0.05, 0.7, 0.15))
      }
    }
    // moonlight caught on the crest of the pad
    c.fillStyle = rgba(P.moon, P.dark ? 0.32 : 0.4)
    for (let j = 0; j < 16; j++) {
      const u = r(), bx = x - w * 0.38 + u * w * 0.76, by = y - w * 0.06 * Math.sin(Math.PI * u)
      const ang = -Math.PI / 2 + (r() - 0.5) * 1.6, len = w * (0.12 + r() * 0.08)
      c.fill(brush([[bx, by], [bx + Math.cos(ang) * len, by + Math.sin(ang) * len * 0.86]], 0.7 + r() * 0.5, 0.05, 0.7, 0.12))
    }
  }

  // ── the steelyard, every frame it moves: beam, chains, pans, their loads, and the same upside down in the water ──
  const copper = () => mix(mix(P.lantern, P.vermilion, 0.42), P['rock-lo'], P.dark ? 0.35 : 0.3)
  function drawScale(c: CanvasRenderingContext2D, flip: boolean) {
    const { L, R } = ends()
    const cu = copper()
    // the beam: a lacquered rod with copper ends and tick marks
    c.lineCap = 'round'
    c.strokeStyle = rgba(P.dark ? mix(P['rock-lo'], P.wash, 0.2) : mix(P.ink, P['rock-lo'], 0.4))
    c.lineWidth = Math.max(4, G.A * 0.028)
    c.beginPath(); c.moveTo(L[0], L[1]); c.lineTo(R[0], R[1]); c.stroke()
    c.strokeStyle = rgba(P.moon, flip ? 0.2 : 0.55)
    c.lineWidth = 1.2
    const nx = Math.sin(th) * c.lineWidth * 1.4, ny = -Math.cos(th) * 2
    c.beginPath(); c.moveTo(L[0] + nx, L[1] + ny); c.lineTo(R[0] + nx, R[1] + ny); c.stroke()
    c.strokeStyle = rgba(cu)
    c.lineWidth = 1.2
    c.beginPath()
    for (let i = -8; i <= 8; i++) {
      if (!i) continue
      const t = i / 9
      const x = G.px + G.A * t * Math.cos(th), y = G.py + G.A * t * Math.sin(th)
      c.moveTo(x, y - 3); c.lineTo(x, y + 3)
    }
    c.stroke()
    c.lineCap = 'butt'
    c.fillStyle = rgba(cu)
    for (const e of [L, R]) {
      c.beginPath(); c.arc(e[0], e[1], Math.max(3.5, G.A * 0.016), 0, Math.PI * 2); c.fill()
    }
    // the pivot block and hook
    c.fillStyle = rgba(P.dark ? P['rock-mid'] : P['ink-2'])
    c.beginPath(); c.arc(G.px, G.py, Math.max(4, G.A * 0.02), 0, Math.PI * 2); c.fill()
    if (!flip) names(c)
    pan(c, 'local', L, flip)
    pan(c, 'cloud', R, flip)
  }

  /** the two sides' names, brushed along the beam near its ends (they tip with it) */
  function names(c: CanvasRenderingContext2D) {
    const fs = tall ? 11.5 : clamp(G.A * 0.04, 13, 16)
    c.save()
    c.font = `italic 500 ${fs}px ${serif}`
    c.textAlign = 'center'
    c.textBaseline = 'alphabetic'
    c.fillStyle = rgba(P.dark ? P.ink : P['ink-2'])
    c.shadowColor = rgba(P.dark ? P.paper : P.mist, 0.95)
    c.shadowBlur = 5
    c.strokeStyle = rgba(P.dark ? P.paper : P.mist, P.dark ? 0.8 : 0.7)
    c.lineWidth = 3
    c.lineJoin = 'round'
    K.sides.forEach((sd, i) => {
      const t = (i ? 1 : -1) * (tall ? 0.56 : 0.6)
      c.save()
      c.translate(G.px + G.A * t * Math.cos(th), G.py + G.A * t * Math.sin(th))
      c.rotate(th)
      const lines = tall ? sd.name.replace(' (', '\n(').split('\n') : [sd.name]
      lines.forEach((ln, j) => {
        const y = -8 - (lines.length - 1 - j) * fs * 1.15
        c.strokeText(ln, 0, y) // a halo of sky round the letters, so they read over the moon too
        c.fillText(ln, 0, y)
      })
      c.restore()
    })
    c.restore()
  }

  /** a chain of links from a to b: open ovals alternating with links seen edge-on */
  function chain(c: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, a: number) {
    const len = Math.hypot(bx - ax, by - ay), ang = Math.atan2(by - ay, bx - ax)
    const step = tall ? 4.2 : 5.2
    const n = Math.max(2, Math.floor(len / step))
    c.strokeStyle = rgba(P.dark ? mix(P['rock-hi'], copper(), 0.3) : mix(P['ink-2'], copper(), 0.3), a)
    c.lineWidth = 0.9
    c.beginPath()
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n
      const x = ax + (bx - ax) * t, y = ay + (by - ay) * t
      if (i % 2) {
        c.moveTo(x - Math.cos(ang) * step * 0.55, y - Math.sin(ang) * step * 0.55)
        c.lineTo(x + Math.cos(ang) * step * 0.55, y + Math.sin(ang) * step * 0.55)
      } else {
        c.moveTo(x + Math.cos(ang) * step * 0.62, y + Math.sin(ang) * step * 0.62)
        c.ellipse(x, y, step * 0.62, step * 0.3, ang, 0, Math.PI * 2)
      }
    }
    c.stroke()
  }

  function pan(c: CanvasRenderingContext2D, side: Side, e: Pt, flip: boolean) {
    const [x, y] = panAt(side, e)
    const rx = G.rx, ry = rx * 0.17, depth = rx * 0.42
    const cu = copper()
    // the back chain first, paler (it is farther), to the far side of the rim
    chain(c, e[0], e[1], x + rx * 0.04, y - ry * 0.95, 0.38)
    // the load (it stands in the bowl, so the bowl hides its foot)
    if (side === 'local') house(c, x, y, rx)
    else cloud(c, x, y, rx)
    placed[side].forEach((k, i) => {
      const sx = x + (i - (placed[side].length - 1) / 2) * rx * 0.42, sy = y - ry * 0.3
      stoneDot(c, sx, sy, rx * 0.2, k)
    })
    // the copper bowl seen a little from below: its round underside, a foot ring, hammer marks, the rolled lip
    const body = new Path2D()
    body.ellipse(x, y, rx, ry, 0, Math.PI, 0, true)
    body.bezierCurveTo(x + rx * 0.98, y + depth * 0.7, x + rx * 0.5, y + depth, x, y + depth)
    body.bezierCurveTo(x - rx * 0.5, y + depth, x - rx * 0.98, y + depth * 0.7, x - rx, y)
    body.closePath()
    const g = c.createLinearGradient(x - rx, y, x + rx, y)
    g.addColorStop(0, rgba(mix(cu, P.umbra, 0.45)))
    g.addColorStop(0.28, rgba(mix(cu, P.moon, flip ? 0.05 : 0.32)))
    g.addColorStop(0.5, rgba(cu))
    g.addColorStop(0.82, rgba(mix(cu, P.umbra, 0.32)))
    g.addColorStop(1, rgba(side === 'local' ? mix(cu, P.lantern, 0.4) : mix(cu, P.umbra, 0.5)))
    c.fillStyle = g
    c.fill(body)
    c.save()
    c.clip(body)
    const v = c.createLinearGradient(0, y, 0, y + depth)
    v.addColorStop(0, rgba(P.umbra, 0))
    v.addColorStop(1, rgba(P.umbra, P.dark ? 0.45 : 0.3))
    c.fillStyle = v
    c.fillRect(x - rx, y, rx * 2, depth + 2)
    c.fillStyle = rgba(P.moon, flip ? 0.05 : 0.16)
    for (const [dx, dy, r0] of DENTS) {
      c.beginPath()
      c.ellipse(x + dx * rx, y + dy * depth, rx * r0, rx * r0 * 0.45, 0, 0, Math.PI * 2)
      c.fill()
    }
    c.restore()
    c.strokeStyle = rgba(mix(cu, P.umbra, 0.55))
    c.lineWidth = 1.2
    c.beginPath()
    c.ellipse(x, y + depth * 0.9, rx * 0.26, rx * 0.06, 0, 0, Math.PI * 2)
    c.stroke()
    c.strokeStyle = rgba(P.dark ? P.wash : P.ink, P.dark ? 0.7 : 0.5)
    c.lineWidth = 1.1
    c.stroke(body)
    // the lip: the near half of the rim, rolled, catching the moon
    c.lineWidth = Math.max(2, rx * 0.04)
    c.strokeStyle = rgba(mix(cu, P.moon, flip ? 0.1 : 0.45))
    c.beginPath()
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI)
    c.stroke()
    // the near chains over the bowl
    chain(c, e[0], e[1], x - rx * 0.97, y + ry * 0.25, 0.9)
    chain(c, e[0], e[1], x + rx * 0.97, y + ry * 0.25, 0.9)
    if (side === 'local' && !flip) {
      // the lamp's warmth on the chains and the bowl
      c.save()
      c.globalCompositeOperation = P.dark ? 'screen' : 'source-over'
      const lg = c.createRadialGradient(x - rx * 0.1, y - rx * 0.35, 0, x - rx * 0.1, y - rx * 0.35, rx * 1.3)
      lg.addColorStop(0, rgba(P.lantern, P.dark ? 0.5 : 0.35))
      lg.addColorStop(1, rgba(P.lantern, 0))
      c.fillStyle = lg
      c.fillRect(x - rx * 1.5, y - rx * 1.6, rx * 3, rx * 2.6)
      c.restore()
    }
  }

  /**
   * The two loads, painted once per layout / theme into sprites (drawn every frame the scale moves, never rebuilt there):
   * your house — a stone footing, plastered walls between dark posts, a lit lattice window, a thick hipped roof whose eaves
   * rest on the wall plate and reach past it — and a soft cumulus with a moonlit rim over half a small moon.
   */
  let houseSp: HTMLCanvasElement | null = null, cloudSp: HTMLCanvasElement | null = null
  function loads() {
    const rx = G.rx
    const dp = Math.min(devicePixelRatio || 1, low ? 1 : 1.5)
    const mk = (w: number, hh: number) => {
      const e = document.createElement('canvas')
      e.width = Math.ceil(w * dp)
      e.height = Math.ceil(hh * dp)
      const g = e.getContext('2d')!
      g.scale(dp, dp)
      return [e, g] as const
    }
    // the house, in a box rx*1.3 wide, rx*0.95 tall; its foot at the box's bottom centre
    {
      const bw = rx * 1.3, bh = rx * 0.95
      const [e, g] = mk(bw, bh)
      const x = bw / 2, foot = bh - 1, w = rx * 0.86, wh = rx * 0.34, pl = rx * 0.05
      const wt = foot - pl - wh, ov = rx * 0.16, rh = rx * 0.4, ey = wt + rx * 0.03
      const x0 = x - w / 2, x1 = x + w / 2
      g.fillStyle = rgba(P['rock-lo'])
      g.fillRect(x0 - 3, foot - pl, w + 6, pl)
      const wall = g.createLinearGradient(x0, 0, x1, 0)
      wall.addColorStop(0, rgba(P.dark ? mix(P['rock-hi'], P.moon, 0.15) : mix(P.card, P['rock-hi'], 0.3)))
      wall.addColorStop(1, rgba(P.dark ? mix(P['rock-mid'], P.umbra, 0.3) : mix(P['rock-hi'], P['rock-mid'], 0.6)))
      g.fillStyle = wall
      g.fillRect(x0, wt, w, wh)
      // the window, lit by the oil lamp inside, its lattice; a door
      const wx = x0 + w * 0.12, ww = w * 0.36, wy = wt + wh * 0.22, whh = wh * 0.5
      const lit = g.createRadialGradient(wx + ww / 2, wy + whh / 2, 0, wx + ww / 2, wy + whh / 2, ww * 0.7)
      lit.addColorStop(0, rgba(mix(P.lantern, P.moon, 0.5)))
      lit.addColorStop(1, rgba(P.lantern))
      g.fillStyle = lit
      g.fillRect(wx, wy, ww, whh)
      g.strokeStyle = rgba(mix(P['rock-lo'], P.umbra, 0.4), 0.9)
      g.lineWidth = 1
      g.beginPath()
      for (let i = 1; i < 4; i++) g.moveTo(wx + (ww * i) / 4, wy), g.lineTo(wx + (ww * i) / 4, wy + whh)
      g.moveTo(wx, wy + whh / 2); g.lineTo(wx + ww, wy + whh / 2)
      g.stroke()
      g.fillStyle = rgba(mix(P.wash, P['rock-lo'], 0.4), 0.85)
      g.fillRect(x0 + w * 0.6, wt + wh * 0.18, w * 0.2, wh * 0.82 - 0.5)
      // posts and the wall plate
      g.fillStyle = rgba(P.dark ? mix(P.wash, P['rock-lo'], 0.3) : mix(P.ink, P['rock-lo'], 0.4))
      for (const u of [0, 0.5, 1]) g.fillRect(x0 + w * u - 2, wt, 4, wh)
      g.fillRect(x0, wt, w, 3)
      // the eaves' shadow on the wall, the roof's underside, the roof (a lit left pitch), the ridge
      g.fillStyle = rgba(P.umbra, 0.35)
      g.fillRect(x0, wt, w, rx * 0.06)
      const roof = new Path2D()
      roof.moveTo(x0 - ov, ey)
      roof.quadraticCurveTo(x0 - ov * 0.3, ey - rx * 0.02, x0 + w * 0.08, wt - rh * 0.6)
      roof.lineTo(x0 + w * 0.28, wt - rh)
      roof.lineTo(x1 - w * 0.28, wt - rh)
      roof.lineTo(x1 - w * 0.08, wt - rh * 0.6)
      roof.quadraticCurveTo(x1 + ov * 0.3, ey - rx * 0.02, x1 + ov, ey)
      roof.closePath()
      g.fillStyle = rgba(P.dark ? mix(P.wash, P['rock-lo'], 0.35) : mix(P.ink, P.wash, 0.3))
      g.fill(roof)
      g.save()
      g.clip(roof)
      g.fillStyle = rgba(P.moon, P.dark ? 0.16 : 0.2)
      g.beginPath(); g.moveTo(x0 - ov, ey); g.lineTo(x0 + w * 0.28, wt - rh); g.lineTo(x0 + w * 0.36, wt - rh * 0.4); g.lineTo(x0 + w * 0.1, ey); g.fill()
      // tile courses
      g.strokeStyle = rgba(P.umbra, 0.4)
      g.lineWidth = 0.8
      g.beginPath()
      for (let i = 1; i < 5; i++) { const yy = wt - rh + (rh * i) / 5 + rx * 0.01; g.moveTo(x0 - ov, yy); g.lineTo(x1 + ov, yy) }
      g.stroke()
      g.restore()
      g.fillStyle = rgba(P.umbra, 0.7)
      g.fillRect(x0 - ov * 0.8, ey - 1, w + ov * 1.6, 2.5)
      g.strokeStyle = rgba(P.dark ? P.wash : P.ink)
      g.lineWidth = 3
      g.lineCap = 'round'
      g.beginPath(); g.moveTo(x0 + w * 0.24, wt - rh - 1); g.lineTo(x1 - w * 0.24, wt - rh - 1); g.stroke()
      houseSp = e
    }
    // the cloud, in a box rx*1.3 wide, rx*0.8 tall; its base at the box's bottom centre
    {
      const bw = rx * 1.3, bh = rx * 0.8
      const [e, g] = mk(bw, bh)
      const x = bw / 2, base = bh - rx * 0.04
      g.fillStyle = rgba(P.moon)
      g.beginPath(); g.arc(x + rx * 0.24, base - rx * 0.5, rx * 0.2, 0, Math.PI * 2); g.fill()
      const body = P.dark ? mix(P.mist, P['rock-hi'], 0.35) : mix(P.card, P.mist, 0.35)
      const shade = mix(body, P.umbra, P.dark ? 0.5 : 0.28)
      // lobes from the back (low, wide) to the front (the crown), each lit from the upper left, shaded under
      const lobes: [number, number, number][] = [[-0.38, -0.12, 0.17], [0.38, -0.13, 0.16], [-0.16, -0.27, 0.22], [0.13, -0.32, 0.23], [-0.02, -0.14, 0.28], [0.28, -0.1, 0.17], [-0.3, -0.06, 0.15]]
      lobes.forEach(([dx, dy, r], i) => {
        const cx = x + dx * rx, cy = base + dy * rx, rr = r * rx
        const gr = g.createRadialGradient(cx - rr * 0.35, cy - rr * 0.45, rr * 0.1, cx, cy, rr * 1.05)
        gr.addColorStop(0, rgba(mix(body, P.moon, P.dark ? 0.35 : 0.5)))
        gr.addColorStop(0.6, rgba(body))
        gr.addColorStop(1, rgba(shade))
        g.fillStyle = gr
        g.fill(new Path2D(blob(cx, cy, rr, rr * 0.9, 3390 + i, 0.08, 16)))
      })
      // a flat, shaded base where it sits in the bowl
      const fb = g.createLinearGradient(0, base - rx * 0.12, 0, base)
      fb.addColorStop(0, rgba(shade, 0))
      fb.addColorStop(1, rgba(shade, 0.9))
      g.fillStyle = fb
      g.fillRect(x - rx * 0.56, base - rx * 0.12, rx * 1.12, rx * 0.12)
      // the moon's rim on the crown
      g.strokeStyle = rgba(P.moon, P.dark ? 0.75 : 0.9)
      g.lineWidth = 1.4
      g.lineCap = 'round'
      g.beginPath()
      g.arc(x - rx * 0.16, base - rx * 0.27, rx * 0.22, Math.PI * 1.05, Math.PI * 1.6)
      g.moveTo(x + rx * 0.13 + Math.cos(Math.PI * 1.15) * rx * 0.23, base - rx * 0.32 + Math.sin(Math.PI * 1.15) * rx * 0.23)
      g.arc(x + rx * 0.13, base - rx * 0.32, rx * 0.23, Math.PI * 1.15, Math.PI * 1.7)
      g.stroke()
      cloudSp = e
    }
  }
  function house(c: CanvasRenderingContext2D, x: number, y: number, rx: number) {
    if (houseSp) c.drawImage(houseSp, x - rx * 0.65, y - rx * 0.95 + rx * 0.04, rx * 1.3, rx * 0.95)
  }
  function cloud(c: CanvasRenderingContext2D, x: number, y: number, rx: number) {
    if (cloudSp) c.drawImage(cloudSp, x - rx * 0.65, y - rx * 0.8 + rx * 0.06, rx * 1.3, rx * 0.8)
  }
  function stoneDot(c: CanvasRenderingContext2D, x: number, y: number, r: number, k: number) {
    const g = c.createLinearGradient(x, y - r, x, y + r * 0.6)
    g.addColorStop(0, rgba(P['rock-hi']))
    g.addColorStop(1, rgba(P['rock-lo']))
    c.fillStyle = g
    c.fill(new Path2D(blob(x, y - r * 0.2, r, r * 0.62, 3350 + k, 0.12, 12)))
  }

  /** where the tags hang under a pan: a fan of short strings (wide), a chain one under another (tall) */
  function hangTags(c: CanvasRenderingContext2D, side: Side, x: number, y: number) {
    const list = tags[side]
    if (!list.length) return
    const bx = x, by = y + G.rx * 0.42
    const swing = sw2[side][0]
    c.strokeStyle = rgba(P.dark ? P['ink-3'] : P['ink-2'], 0.75)
    c.lineWidth = 0.8
    c.beginPath()
    if (tall) {
      const cx = clamp(bx, tagW / 2 + 4, W - tagW / 2 - 4)
      let ty = by + 12
      c.moveTo(bx, by)
      list.forEach((el) => {
        c.lineTo(cx, ty)
        el.style.transform = `translate(${f1(cx - tagW / 2)}px, ${f1(ty)}px) rotate(${f1(swing * 20)}deg)`
        ty += (tagH.get(el) ?? 30) + 9
        c.moveTo(cx, ty - 9)
      })
    } else {
      const n = list.length, gap = 10
      list.forEach((el, i) => {
        const dx = (i - (n - 1) / 2) * (tagW + gap), dy = 22 + (i % 2) * 16
        const tx = clamp(bx + dx, tagW / 2 + 6, W - tagW / 2 - 6), ty = by + dy
        c.moveTo(bx + (tx - bx) * 0.12, by)
        c.lineTo(tx, ty)
        el.style.transform = `translate(${f1(tx - tagW / 2)}px, ${f1(ty)}px) rotate(${f1(swing * 22 + (i - 1) * 1.5)}deg)`
      })
    }
    c.stroke()
  }

  function drawLive() {
    const c = cC
    if (!c || !W) return
    c.clearRect(0, 0, W, H)
    // the reflection: the whole steelyard upside down about the water line, dimmer
    c.save()
    c.beginPath()
    c.rect(0, G.yw, W, H - G.yw)
    c.clip()
    c.translate(0, G.yw * 2)
    c.scale(1, -1)
    c.globalAlpha = P.dark ? 0.32 : 0.28
    drawScale(c, true)
    c.restore()
    // rings round the stones still in the water, and ripples where a stone fell back
    c.lineWidth = 1
    stones.forEach((b, k) => {
      if (b.hidden || b.classList.contains('drag')) return
      const g = SG[k]
      for (let i = 0; i < 3; i++) {
        c.strokeStyle = rgba(P.moon, (P.dark ? 0.28 : 0.45) * (1 - i * 0.3))
        c.beginPath()
        c.ellipse(g.x, g.y + 1 + i * 1.5, g.w * (0.56 + i * 0.14), g.w * (0.075 + i * 0.022), 0, 0, Math.PI * 2)
        c.stroke()
      }
    })
    for (const rp of ripples) {
      const k = rp.t
      c.strokeStyle = rgba(P.moon, (1 - k) * 0.6)
      c.lineWidth = 1.2
      for (let i = 0; i < 3; i++) {
        const rr = (k * 1.2 - i * 0.18) * G.rx * 1.4
        if (rr <= 0) continue
        c.beginPath(); c.ellipse(rp.x, rp.y, rr, rr * 0.22, 0, 0, Math.PI * 2); c.stroke()
      }
    }
    drawScale(c, false)
    const { L, R } = ends()
    for (const [side, e] of [['local', L], ['cloud', R]] as const) {
      const [x, y] = panAt(side, e)
      hangTags(c, side, x, y)
      pans[side].style.transform = `translate(${f1(x - G.rx * 1.05)}px, ${f1(y - G.rx * 0.95)}px)`
    }
  }

  const loop = createLoop(root, (_, dt) => {
    let busy = false
    if (still) {
      th = target()
      sw2.local[0] = sw2.cloud[0] = 0
    } else if (dt > 0) {
      // the beam: spring toward the balance of the stones, damped; the pans: pendulums kicked by the beam's motion
      const k = 26, d = 4.2
      const acc = (target() - th) * k - thV * d
      thV += acc * dt
      th += thV * dt
      for (const side of ['local', 'cloud'] as const) {
        const s = sw2[side]
        const a = -s[0] * 18 - s[1] * 2.2 - acc * 0.12 * (side === 'local' ? 1 : -1)
        s[1] += a * dt
        s[0] += s[1] * dt
        if (Math.abs(s[0]) > 0.002 || Math.abs(s[1]) > 0.01) busy = true
      }
      if (Math.abs(target() - th) > 0.001 || Math.abs(thV) > 0.003) busy = true
      ripples = ripples.filter((rp) => (rp.t += dt / 1.4) < 1)
      if (ripples.length) busy = true
      // parallax: the near bough moves most, the sky least
      parX += (parTX - parX) * Math.min(1, dt * 5)
      parY += (parTY - parY) * Math.min(1, dt * 5)
      if (Math.abs(parTX - parX) > 0.002 || Math.abs(parTY - parY) > 0.002) busy = true
      skyCv.style.transform = `translate(${(parX * -4).toFixed(2)}px, ${(parY * -2).toFixed(2)}px)`
      boughCv.style.transform = `translate(${(parX * 12).toFixed(2)}px, ${(parY * 6).toFixed(2)}px)`
    }
    drawLive()
    return busy
  }, { essential: true })
  ctx.onCleanup(() => loop.dispose())
  const run = () => loop.start()
  if (!still) {
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || !W) return
      const b = root.getBoundingClientRect()
      parTX = clamp((e.clientX - b.left) / W - 0.5, -0.5, 0.5) * 2
      parTY = clamp((e.clientY - b.top) / H - 0.5, -0.5, 0.5) * 2
      run()
    }
    root.addEventListener('pointermove', onMove)
  }

  // ── actions ──
  function lift(k: number) {
    if (done || busyTask || stones[k].hidden) return
    sel = k
    stones.forEach((b, j) => b.setAttribute('aria-pressed', String(j === k)))
    root.classList.add('lifting')
    labelAll()
    ctx.chime('tap')
  }
  function labelAll() {
    const w = sel >= 0 ? K.weights[sel] : null
    const side = (k: number) => K.sides[K.weights[k].side === 'local' ? 0 : 1].name
    stones.forEach((b, k) => b.setAttribute('aria-label', fill(K.weightAria, { label: K.weights[k].label, side: side(k) })))
    for (const sd of K.sides) pans[sd.id as Side].setAttribute('aria-label', w && sel >= 0 ? fill(K.weightAria, { label: w.label, side: side(sel) }) : sd.aria)
  }

  // ── the jobs: the slip, the prompt, the dot ──
  const g = guide(ctx)
  let dot: Mark | null = null
  const need = () => K.tasks[task].need as string[]
  /** the stone that is (still) the answer to this job */
  const answer = () => stones.findIndex((b, k) => need().includes(idOf(k)) && !b.hidden)
  function showTask() {
    const t = K.tasks[task]
    slipN.textContent = fill(K.taskCount, { n: task + 1, total: T })
    slipJob.textContent = t.label
    slipAns.textContent = ''
    slip.classList.remove('answered')
    if (task) slip.setAttribute('aria-live', 'polite') // after the first fill only
    ctx.prompt(task ? fill(K.taskTpl, { n: task + 1, total: T, task: t.short }) : K.prompt)
    wrongs = 0
    // the first job teaches the gesture: the dot sits on its stone, leaning up toward the scale; later jobs only after a miss
    dot?.done()
    dot = task === 0 ? g.dot(stones[answer()], { dir: [0, -1] }) : null
  }
  function nextTask() {
    // the stones go back into the water, the tags come down, the beam rights itself, the next slip
    for (const side of ['local', 'cloud'] as const) {
      for (const k of placed[side]) {
        stones[k].hidden = false
        home(k)
        ripples.push({ x: SG[k].x, y: SG[k].y, t: 0 })
      }
      placed[side] = []
      tags[side] = []
    }
    tagBox.replaceChildren()
    tagH.clear()
    busyTask = false
    task++
    showTask()
    run()
  }

  function drop(k: number) {
    const w = K.weights[k]
    if (!w || stones[k].hidden || done || busyTask) return
    const side = w.side as Side
    root.classList.remove('lifting')
    if (!need().includes(w.id)) {
      // not the reason for this job: the pan jolts and throws it back into the water (H6: the prompt says why)
      sw2[side][1] += side === 'local' ? -2.4 : 2.4
      ripples.push({ x: SG[k].x, y: SG[k].y, t: 0 })
      home(k)
      sel = -1
      stones[k].setAttribute('aria-pressed', 'false')
      ctx.chime('low')
      g.wrong(K.wrong, stones[k])
      say.say(K.wrong)
      if (++wrongs === 1 && !dot) dot = g.dot(stones[answer()], { dir: [0, -1] })
      run()
      return
    }
    // the reason settles on its own side, whichever pan it was dropped on
    placed[side].push(k)
    stones[k].hidden = true
    sel = -1
    sw2[side][1] += side === 'local' ? 1.2 : -1.2
    // a paper tag on a string under the pan: only the one just placed
    const tag = h('p', { class: 't32s-tag' }, h('b', null, w.label), h('span', null, w.why))
    tags[side].push(tag)
    tagBox.append(tag)
    tag.style.width = `${tagW.toFixed(0)}px`
    tagH.set(tag, tag.offsetHeight)
    say.say(w.why)
    ctx.chime('tap')
    run()
    if (answer() >= 0) return stones[answer()].focus({ preventScroll: true })
    // the beam has tipped: the answer on the slip, then the next job (or the insight after the last)
    dot?.done()
    dot = null
    slipAns.textContent = K.tasks[task].verdict
    slip.classList.add('answered')
    g.ok(slip)
    if (task < T - 1) {
      busyTask = true
      ctx.prompt(K.tasks[task].verdict, 'ok')
      const id = setTimeout(nextTask, ctx.reduced ? 1600 : 2600)
      ctx.onCleanup(() => clearTimeout(id))
      return
    }
    done = true
    root.classList.add('is-done')
    ctx.insight(K.insight as Fact, K.detail as Detail)
    ctx.chime('ok')
  }
  const home = (k: number) => {
    const g = SG[k]
    stones[k].style.transform = `translate(${f1(g.x - g.w / 2)}px, ${f1(g.y - g.hd)}px)`
  }

  // drag a stone out of the shallows: it follows the hand; let go over a pan to set it there
  function grab(k: number, e: PointerEvent) {
    if (e.button || done || busyTask) return
    const b = stones[k]
    const sx = e.clientX, sy = e.clientY
    const box = root.getBoundingClientRect()
    let moved = false
    delete b.dataset.dragged
    b.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return
      if (!moved) b.classList.add('drag'), root.classList.add('lifting'), run()
      moved = true
      b.style.transform = `translate(${f1(ev.clientX - box.left - SG[k].w / 2)}px, ${f1(ev.clientY - box.top - SG[k].hd)}px)`
      // the pan under the hand lights
      const over = overPan(ev.clientX - box.left, ev.clientY - box.top)
      root.dataset.aim = over ?? ''
    }
    const up = (ev: PointerEvent) => {
      b.removeEventListener('pointermove', move)
      b.removeEventListener('pointerup', up)
      b.removeEventListener('pointercancel', up)
      b.classList.remove('drag')
      root.dataset.aim = ''
      if (!moved) return
      root.classList.remove('lifting')
      b.dataset.dragged = '1'
      setTimeout(() => delete b.dataset.dragged)
      const over = ev.type === 'pointerup' ? overPan(ev.clientX - box.left, ev.clientY - box.top) : null
      if (over) drop(k)
      else home(k), run()
    }
    b.addEventListener('pointermove', move)
    b.addEventListener('pointerup', up)
    b.addEventListener('pointercancel', up)
  }
  function overPan(x: number, y: number): Side | null {
    const { L, R } = ends()
    for (const [side, e] of [['local', L], ['cloud', R]] as const) {
      const [px, py] = panAt(side, e)
      if (Math.abs(x - px) < G.rx * 1.35 && y > py - G.rx * 1.3 && y < py + G.rx * 0.9) return side
    }
    return null
  }

  /** a river stone half sunk in the shallows (w wide, hd above the water, hb below): SVG under its carved name */
  function stoneArt(k: number, w: number, hd: number, hb: number): SVGElement {
    const seed = 3370 + k * 17
    const { top, d } = rock(w, hd, seed)
    const r = rng(seed + 1)
    const id = `t32s-${k}`
    const under = `M${f1(-w / 2)} 0C${f1(-w * 0.5)} ${f1(hb * 0.7)} ${f1(-w * 0.28)} ${f1(hb)} 0 ${f1(hb)}C${f1(w * 0.3)} ${f1(hb)} ${f1(w * 0.5)} ${f1(hb * 0.7)} ${f1(w / 2)} 0Z`
    let grain = ''
    for (let i = 0; i < 22; i++) {
      const x = (r() - 0.5) * w * 0.8, y = -r() * hd * 0.75
      grain += `M${f1(x)} ${f1(y)}h${f1(0.8 + r() * 1.6)}v${f1(0.8 + r())}h${f1(-1.2)}Z`
    }
    const n = top.length
    const stop = (o: number, v: string, a = 1) => s('stop', { offset: o, style: `stop-color:var(${v});stop-opacity:${a}` })
    return s('svg', { class: 't32s-art', viewBox: `${f1(-w / 2)} ${f1(-hd)} ${f1(w)} ${f1(hd + hb)}`, 'aria-hidden': 'true' },
      s('defs', null,
        s('linearGradient', { id: `${id}-f`, x1: 0.15, y1: 0, x2: 0.7, y2: 1 }, stop(0, '--rock-hi'), stop(0.5, '--rock-mid'), stop(1, '--rock-lo')),
        s('radialGradient', { id: `${id}-m`, cx: 0.32, cy: 0.18, r: 0.55 }, stop(0, '--moon', 0.55), stop(1, '--moon', 0)),
        s('linearGradient', { id: `${id}-w`, x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, '--water', 0.55), stop(1, '--water', 0.95)),
        s('clipPath', { id: `${id}-c` }, s('path', { d }))),
      s('path', { class: 't32s-under', d: under }),
      s('path', { d, fill: `url(#${id}-f)` }),
      s('g', { 'clip-path': `url(#${id}-c)` },
        s('path', { d, fill: `url(#${id}-m)` }),
        s('path', { class: 't32s-wetband', d: `M${f1(-w / 2)} ${f1(-hd * 0.2)}H${f1(w / 2)}V0H${f1(-w / 2)}Z` }),
        s('path', { class: 't32s-shade', d: `M${f1(w * 0.12)} ${f1(-hd)}C${f1(w * 0.3)} ${f1(-hd * 0.6)} ${f1(w * 0.26)} ${f1(-hd * 0.2)} ${f1(w * 0.1)} 0H${f1(w / 2)}V${f1(-hd)}Z` })),
      s('path', { class: 't32s-grain', d: grain }),
      s('path', { class: 't32s-moss', d: blob(-w * (0.12 + r() * 0.12), -hd * 0.86, w * 0.13, hd * 0.07, seed + 3, 0.35) }),
      s('path', { class: 't32s-ink', d: stroke(top.slice(Math.floor(n * 0.5)), Math.max(1.6, w * 0.022), 0.2, 0.1, 0.3), filter: 'url(#ink-rough)' }),
      s('path', { class: 't32s-rim', d: stroke(top.slice(Math.floor(n * 0.08), Math.floor(n * 0.55)), Math.max(1.3, w * 0.016), 0.3, 0.4, 0.15) }),
      s('g', { class: 't32s-wet' },
        s('path', { d: under, fill: `url(#${id}-w)` }),
        s('path', { class: 't32s-refl', d, transform: `translate(0 ${f1(hb * 0.2)}) scale(1 -0.45)` }),
        s('path', { class: 't32s-line', d: stroke([[-w * 0.53, 0.5], [-w * 0.2, -0.3], [w * 0.15, 0.6], [w * 0.53, 0]], 1.4, 0.2, 0.2, 0.3) })))
  }

  // ── layout ──
  let job: { cancel(): void } | null = null
  let painted = false
  function layout() {
    const [w, hh] = stageSize(ctx)
    if (w < 40 || hh < 40) return
    if (w === W && hh === H && painted) return
    W = w
    H = hh
    tall = W / H < 0.9
    root.style.height = `${H}px`
    root.classList.toggle('tall', tall)
    serif = getComputedStyle(root).getPropertyValue('--serif') || 'serif'
    G = tall
      ? { yw: H * 0.6, mx: W * 0.55, my: H * 0.2, mr: Math.min(W * 0.26, H * 0.11), px: W * 0.5, py: H * 0.21, A: W * 0.31, rx: W * 0.12, hang: H * 0.11 }
      : { yw: H * 0.62, mx: W * 0.535, my: H * 0.28, mr: H * 0.17, px: W * 0.52, py: H * 0.28, A: Math.min(W * 0.27, H * 0.62), rx: Math.min(W * 0.075, H * 0.13), hang: H * 0.16 }
    boughGeo()
    loads()
    // the stones lie scattered in the shallows at two depths (the near ones bigger and lower), between the water line and the foot
    const artH = ctx.art.clientHeight || H * 0.86
    const band = Math.max(70, artH - G.yw - (tall ? 40 : 46))
    const base = tall ? W * 0.3 : clamp(W * 0.122, 140, 180)
    // each river stone its own build: some low and broad, some high-domed
    const DOME = [0.46, 0.4, 0.52, 0.44, 0.38, 0.5]
    SG = K.weights.map((_, k) => {
      const [fx, row, sc] = (tall ? SPOTS_T : SPOTS_W)[k]
      const sw = base * sc
      return { x: fx * W, y: G.yw + band * (row ? 0.66 : 0.24) + ((k * 7) % 3) * 3, w: sw, hd: sw * DOME[k] * (tall ? 1.05 : 1), hb: sw * 0.13 }
    })
    stones.forEach((b, k) => {
      const g = SG[k]
      Object.assign(b.style, { width: `${f1(g.w)}px`, height: `${f1(g.hd + g.hb)}px`, zIndex: String(Math.round(g.y)) })
      b.style.setProperty('--hd', `${f1(g.hd)}px`)
      b.querySelector('.t32s-art')?.remove()
      b.prepend(stoneArt(k, g.w, g.hd, g.hb))
      if (!b.classList.contains('drag')) home(k)
    })
    pans.local.style.width = pans.cloud.style.width = `${f1(G.rx * 2.1)}px`
    pans.local.style.height = pans.cloud.style.height = `${f1(G.rx * 1.6)}px`
    tagW = tall ? clamp(W * 0.36, 112, 150) : clamp(G.rx * 1.45, 118, 150)
    for (const side of ['local', 'cloud'] as const) for (const t of tags[side]) t.style.width = `${tagW.toFixed(0)}px`
    for (const side of ['local', 'cloud'] as const) for (const t of tags[side]) tagH.set(t, t.offsetHeight)
    // the slip hangs on a short cord under the pivot, between the pans
    Object.assign(slip.style, { left: `${f1(G.px)}px`, top: `${f1(G.py + G.rx * (tall ? 0.5 : 0.4))}px`, width: `${f1(tall ? W * 0.34 : Math.min(G.A * 0.62, 240))}px` })
    cS = fit(skyCv, W, H, low)
    cC = fit(scaleCv, W, H, low)
    cW = fit(waterCv, W, H, low)
    cB = fit(boughCv, W, H, low)
    job?.cancel()
    const sky = cS, bough = cB
    job = sliced((function* () {
      yield* paintSky(sky)
      yield* paintBough(bough)
    })(), { sync: ctx.reduced || painted })
    paintWater(cW)
    painted = true
    th = target()
    drawLive()
  }
  ctx.onCleanup(() => job?.cancel())
  const ro = new ResizeObserver(() => requestAnimationFrame(layout))
  ro.observe(ctx.el)
  ctx.onCleanup(() => ro.disconnect())
  ctx.onCleanup(onPrefs(() => {
    const next = palette()
    if (next.key === P.key) return
    P = next
    if (W) loads()
    if (cS && cB && cW) {
      job?.cancel()
      const sky = cS, bough = cB
      job = sliced((function* () {
        yield* paintSky(sky)
        yield* paintBough(bough)
      })(), { sync: true })
      paintWater(cW)
    }
    drawLive()
  }))
  // standing still: the stone that is the answer (or the first one) lifts out of the water and settles back (H7)
  const onIdle = () => {
    if (done || busyTask || still) return
    const k = answer()
    if (k < 0) return
    stones[k].classList.remove('bob')
    void stones[k].offsetWidth
    stones[k].classList.add('bob')
    ripples.push({ x: SG[k].x, y: SG[k].y, t: 0 })
    run()
  }
  ctx.el.addEventListener('p2:idle', onIdle)
  ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', onIdle))
  labelAll()
  showTask()
}
