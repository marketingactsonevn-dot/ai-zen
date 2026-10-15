// Procedural sumi-e bonsai (informal upright "moyogi") painted on Canvas2D.
// Static layers are painted once per size/theme into offscreen canvases; the frame loop only composites
// them (growth mask, swaying foliage pads, glow, water ripples).
import { sliced } from '../../core/chunk'
import { createLoop, type Loop } from '../../core/loop'
import { cssVar, type Quality } from '../../core/prefs'
import { blotch, clamp, dab, inkLine, mix, noise1, normals, parseColor, rgba, rng, smooth, spline, sprite, sumi, type Pt, type RGB } from './paint'

export interface Palette {
  dark: boolean
  paper: RGB
  ink: RGB
  /** darkest tone available on this paper (ink by day, shadow by night) */
  deep: RGB
  /** the ink the wood is painted in (by night: a dim pewter with a breath of moss, so the moon and foliage lead) */
  wood: RGB
  stone2: RGB
  stone3: RGB
  moss: RGB
  moss2: RGB
  verm: RGB
  mossSoft: RGB
  vermSoft: RGB
  card: RGB
  rake: string
  rakeHi: string
}

export function readPalette(): Palette {
  const dark = document.documentElement.dataset.theme === 'dark'
  const c = (n: string) => parseColor(cssVar(n))
  const paper = c('--paper')
  const ink = c('--ink')
  return {
    dark,
    paper,
    ink,
    deep: dark ? mix(paper, [0, 0, 0], 0.55) : ink,
    wood: dark ? mix(mix(ink, paper, 0.34), c('--moss'), 0.18) : ink,
    stone2: c('--stone-2'),
    stone3: c('--stone-3'),
    moss: c('--moss'),
    moss2: c('--moss-2'),
    verm: c('--vermilion'),
    mossSoft: c('--moss-soft'),
    vermSoft: c('--vermilion-soft'),
    card: c('--card'),
    rake: cssVar('--rake'),
    rakeHi: cssVar('--rake-hi'),
  }
}

// ───────── Geometry, in tree units: origin = soil at the trunk, y up, apex ≈ 1 ─────────
type P2 = [number, number]
interface LimbDef {
  pts: P2[]
  w0: number
  w1: number
  /** window inside the wood growth progress G */
  g: [number, number]
  flare?: number
  dry?: number
}

const TRUNK: LimbDef = {
  pts: [[0.012, -0.035], [-0.03, 0.09], [-0.025, 0.2], [0.05, 0.31], [0.085, 0.41], [0.04, 0.53], [-0.035, 0.64], [-0.025, 0.77], [0.025, 0.9]],
  w0: 0.112,
  w1: 0.016,
  g: [0, 0.55],
  flare: 0.035,
  dry: 0.8,
}
const LIMBS: LimbDef[] = [
  // nebari — surface roots: each arches out of the trunk's flare and dives into the soil, at its own length
  { pts: [[-0.035, 0.09], [-0.09, 0.064], [-0.16, 0.038], [-0.23, 0.016], [-0.29, -0.004]], w0: 0.052, w1: 0.009, g: [0.04, 0.3], dry: 0.35 },
  { pts: [[-0.015, 0.064], [-0.055, 0.046], [-0.1, 0.028], [-0.14, 0.01]], w0: 0.03, w1: 0.007, g: [0.06, 0.28], dry: 0.35 },
  { pts: [[0.02, 0.09], [0.08, 0.062], [0.15, 0.036], [0.23, 0.014], [0.31, -0.006]], w0: 0.052, w1: 0.009, g: [0.06, 0.3], dry: 0.35 },
  { pts: [[0.025, 0.058], [0.065, 0.04], [0.11, 0.02], [0.135, 0.006]], w0: 0.028, w1: 0.006, g: [0.08, 0.32], dry: 0.35 },
  // first branch, long and low to the left
  { pts: [[-0.015, 0.24], [-0.12, 0.27], [-0.25, 0.25], [-0.38, 0.28], [-0.52, 0.305], [-0.64, 0.33]], w0: 0.048, w1: 0.006, g: [0.2, 0.62] },
  { pts: [[-0.25, 0.255], [-0.28, 0.3], [-0.31, 0.34]], w0: 0.014, w1: 0.004, g: [0.45, 0.72] },
  { pts: [[-0.44, 0.29], [-0.46, 0.33], [-0.5, 0.36]], w0: 0.012, w1: 0.003, g: [0.5, 0.78] },
  // second branch to the right
  { pts: [[0.08, 0.395], [0.18, 0.43], [0.29, 0.445], [0.41, 0.48], [0.53, 0.5], [0.61, 0.525]], w0: 0.042, w1: 0.006, g: [0.32, 0.74] },
  { pts: [[0.29, 0.445], [0.32, 0.49], [0.34, 0.53]], w0: 0.012, w1: 0.003, g: [0.55, 0.82] },
  // third branch, back-left
  { pts: [[-0.03, 0.62], [-0.11, 0.655], [-0.2, 0.665], [-0.31, 0.695], [-0.4, 0.72]], w0: 0.03, w1: 0.005, g: [0.46, 0.84] },
  // small right branch below the apex
  { pts: [[-0.03, 0.74], [0.05, 0.77], [0.13, 0.785], [0.22, 0.81]], w0: 0.022, w1: 0.004, g: [0.56, 0.9] },
  // apex twigs
  { pts: [[0.015, 0.86], [-0.07, 0.9], [-0.15, 0.925]], w0: 0.014, w1: 0.003, g: [0.62, 0.95] },
  { pts: [[0.02, 0.87], [0.09, 0.905], [0.16, 0.93]], w0: 0.012, w1: 0.003, g: [0.64, 0.97] },
]

export interface PadDef {
  id: string
  c: P2
  rx: number
  ry: number
  /** sway pivot (where the branch carries the pad) */
  pivot: P2
  /** window inside the foliage bloom progress F */
  f: [number, number]
  seed: number
}
export const PADS: PadDef[] = [
  { id: 'robot', c: [-0.27, 0.75], rx: 0.19, ry: 0.066, pivot: [-0.12, 0.66], f: [0.24, 0.84], seed: 31 },
  { id: 'deco', c: [0.18, 0.835], rx: 0.13, ry: 0.05, pivot: [0.08, 0.78], f: [0.32, 0.9], seed: 47 },
  { id: 'gen', c: [0.0, 0.935], rx: 0.21, ry: 0.078, pivot: [0.02, 0.87], f: [0.4, 1], seed: 59 },
  { id: 'rec', c: [0.41, 0.55], rx: 0.25, ry: 0.077, pivot: [0.24, 0.45], f: [0.12, 0.72], seed: 23 },
  { id: 'recog', c: [-0.45, 0.36], rx: 0.29, ry: 0.084, pivot: [-0.22, 0.26], f: [0, 0.6], seed: 11 },
]

/** Tree extents in units (for layout): pads, pot and its feet. */
export const EXTENT = { left: -0.76, right: 0.68, top: 1.04, bottom: -0.16 }
const POT = { top: 0, lip: -0.03, bottom: -0.128, feet: -0.152, half: 0.43, halfBottom: 0.39 }
const GROUND = -0.152
const soilNz = noise1(61)
/** top of the soil mound (tree units) — highest at the trunk, meeting the rim at ±0.37 */
export function soilTop(x: number) {
  const u = (x + 0.37) / 0.74
  if (u <= 0 || u >= 1) return -0.012
  return -0.012 + 0.024 * Math.pow(Math.sin(Math.PI * u), 0.7) + 0.014 * Math.exp(-((x / 0.12) ** 2)) + 0.006 * (soilNz(u * 9) - 0.5)
}

interface Dab {
  x: number
  y: number
  r: number
  sx: number
  rot: number
  a: number
  col: RGB
  wet: boolean
  /** soft round sprite instead of a ragged blotch */
  soft?: boolean
  v?: number
  /** bloom threshold 0..1 */
  th: number
}
interface Needle {
  x: number
  y: number
  ang: number
  len: number
  lw: number
  a: number
  col: RGB
  th: number
}

interface PadRuntime {
  def: PadDef
  canvas: HTMLCanvasElement
  /** canvas origin in CSS px */
  x0: number
  y0: number
  dabs: Dab[]
  needles: Needle[]
  bloomDrawn: number
  /** by night, the pad tinted warm (for the light of a chosen pad), and the bloom it was tinted at */
  lit?: HTMLCanvasElement
  litAt?: number
}

export interface Ripple {
  t0: number
  x: number
  y: number
  big: boolean
}

export interface PaintingOpts {
  host: HTMLElement
  quality: Quality
  reduced: boolean
  /** where the tree sits: scale s (px per unit), the screen position of the origin, and the height H the picture is composed in */
  layout: (w: number, h: number) => { s: number; ox: number; oy: number; H?: number }
  grown: boolean
  onLayout?: () => void
  /** extra brushwork painted over the tree each frame (CSS px); returns true while it is still moving */
  overlay?: (g: CanvasRenderingContext2D, t: number, now: number) => boolean
  /** brushwork painted behind the foliage (young branches that grow out of a pad) */
  underlay?: (g: CanvasRenderingContext2D) => void
}

const DUR_DROP = 0.7

export class Painting {
  readonly canvas = document.createElement('canvas')
  private g = this.canvas.getContext('2d')!
  w = 0
  h = 0
  /** height the picture is composed in (≤ h): the art keeps this layout when the insight grows the foot */
  H = 0
  s = 1
  ox = 0
  oy = 0
  private dpr = 1
  pal: Palette = readPalette()
  private bg = document.createElement('canvas')
  private pot = document.createElement('canvas')
  private wood = document.createElement('canvas')
  private tmp = document.createElement('canvas')
  private limbs: { path: Pt[]; W: number[]; g: [number, number] }[] = []
  private pads: PadRuntime[] = []
  private moss: Dab[] = []
  /** growth: wood G, foliage F, moss M — all 0..1 */
  G = 0
  F = 0
  M = 0
  /** per pad id: selected glow 0..1 and hover 0..1 */
  glow: Record<string, number> = {}
  hover: Record<string, number> = {}
  /** extra breeze amplitude (a shiver after watering) */
  gust = 0
  sway = true
  /** a faint vermilion breath on the tappable pads, until the first choice */
  breath = false
  private busy = false
  ripples: Ripple[] = []
  drops: { t0: number; x: number }[] = []
  private lp: Loop
  private t0 = performance.now()
  private ro: ResizeObserver
  private dirty = true
  private built = false
  private destroyed = false
  private ready = false
  /** the layers being painted in slices (see layers()); settled once a painting has finished */
  private job: { cancel(): void } | null = null
  private painting = false
  private settled = false

  constructor(private o: PaintingOpts) {
    this.canvas.className = 't02-canvas'
    this.canvas.setAttribute('aria-hidden', 'true')
    o.host.append(this.canvas)
    if (o.grown) this.G = this.F = this.M = 1
    // gsap tweens these maps: every key must exist before the first tween
    for (const p of PADS) this.glow[p.id] = this.hover[p.id] = 0
    this.sway = !o.reduced && o.quality === 'high'
    // runs while something moves, then stops; invalidate()/water() restart it (wake() = one frame under reduced motion)
    this.lp = createLoop(o.host, () => this.tick())
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(o.host)
    this.resize()
    this.ready = true
    this.lp.start()
  }

  /** CSS px of a point in tree units */
  px(x: number, y: number): Pt {
    return { x: this.ox + x * this.s, y: this.oy - y * this.s }
  }

  padBox(id: string) {
    const d = PADS.find((p) => p.id === id)!
    const c = this.px(d.c[0], d.c[1])
    return { x: c.x, y: c.y - d.ry * this.s * 0.35, rx: d.rx * this.s, ry: d.ry * this.s * 1.45 }
  }

  /** Repaint in the new theme's colours. */
  rethemed() {
    this.pal = readPalette()
    this.build()
  }

  /** Re-run the layout without a size change (e.g. once the web fonts have loaded). */
  relayout() {
    if (!this.built) return
    // same composition (fonts were already in): the layers are already right, only the words around them move
    const L = this.o.layout(this.w, this.h)
    const dpr = Math.min(devicePixelRatio || 1, this.o.quality === 'high' ? 2 : 1.5)
    if (L.s === this.s && L.ox === this.ox && L.oy === this.oy && Math.min(this.h, L.H ?? this.h) === this.H && dpr === this.dpr) this.o.onLayout?.()
    else this.build()
  }

  resize() {
    const r = this.o.host.getBoundingClientRect()
    const w = Math.round(r.width)
    const h = Math.round(r.height)
    if (!w || !h) return
    if (this.built && w === this.w) {
      if (h === this.h) return
      // the foot grew (an insight appeared) under a picture already composed for it: the painting stays as it is
      const L = this.o.layout(w, h)
      if (h >= this.H && L.s === this.s && L.ox === this.ox && L.oy === this.oy && Math.min(h, L.H ?? h) === this.H) return
    }
    this.w = w
    this.h = h
    this.build()
  }

  private build() {
    if (!this.w || this.destroyed) return
    this.job?.cancel()
    const q = this.o.quality === 'high'
    this.dpr = Math.min(devicePixelRatio || 1, q ? 2 : 1.5)
    const { s, ox, oy, H } = this.o.layout(this.w, this.h)
    this.s = s
    this.ox = ox
    this.oy = oy
    this.H = Math.min(this.h, H ?? this.h)
    for (const c of [this.canvas, this.bg, this.pot, this.wood, this.tmp]) {
      c.width = Math.round(this.w * this.dpr)
      c.height = Math.round(this.h * this.dpr)
    }
    this.canvas.style.width = `${this.w}px`
    this.canvas.style.height = `${this.h}px`
    this.buildPads()
    this.buildMoss()
    this.built = true
    // the first painting soaks in a few strokes per frame while the scene fades in (one long task otherwise, spec A.10);
    // once it has been painted, a rebuild (resize, theme, fonts) is synchronous as before
    this.painting = true
    this.job = sliced(this.layers(), { sync: this.o.reduced || this.settled })
    if (this.painting) this.lp.start()
    // paint right away: resizing cleared the canvas, and waiting for the next frame would flash
    this.dirty = false
    this.frame((performance.now() - this.t0) / 1000, performance.now() / 1000)
    if (this.ready) this.o.onLayout?.()
  }

  /** The static layers, a stroke or a dab per step (frame() composites whatever is painted so far). */
  private *layers() {
    yield* this.paintBg()
    yield* this.paintPot()
    yield* this.paintWood()
    for (const p of this.pads) {
      const f = this.bloomOf(p)
      if (f > 0) yield* this.padSteps(p, f)
    }
    this.painting = false
    this.settled = true
    this.dirty = true
  }

  private bloomOf(p: PadRuntime) {
    return clamp((this.F - p.def.f[0]) / (p.def.f[1] - p.def.f[0]))
  }

  private ctx2(c: HTMLCanvasElement) {
    const g = c.getContext('2d')!
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    g.clearRect(0, 0, this.w, this.h)
    return g
  }

  // ───────── background: sun (moon at night), raked sand, the soil mound ─────────
  private *paintBg() {
    const g = this.ctx2(this.bg)
    const { pal, s } = this
    const r = rng(5)
    const sun = this.px(0.36, 0.74)
    const R = 0.28 * s
    // a flat wash disc (vermilion sun by day, pale moon by night): the pigment dries denser at its rim,
    // and a scatter of granulation breaks any banding
    const disc = pal.dark ? mix(pal.paper, pal.ink, 0.75) : pal.verm
    const dk = pal.dark ? 1.75 : 1
    if (pal.dark) {
      const halo = g.createRadialGradient(sun.x, sun.y, R * 0.9, sun.x, sun.y, R * 2.3)
      halo.addColorStop(0, rgba(disc, 0.1))
      halo.addColorStop(0.35, rgba(disc, 0.045))
      halo.addColorStop(1, rgba(disc, 0))
      g.fillStyle = halo
      g.fillRect(sun.x - R * 2.3, sun.y - R * 2.3, R * 4.6, R * 4.6)
      // a faint ring of moonlit haze
      const ring = g.createRadialGradient(sun.x, sun.y, R * 1.08, sun.x, sun.y, R * 1.42)
      ring.addColorStop(0, rgba(disc, 0))
      ring.addColorStop(0.4, rgba(disc, 0.05))
      ring.addColorStop(1, rgba(disc, 0))
      g.fillStyle = ring
      g.fillRect(sun.x - R * 1.42, sun.y - R * 1.42, R * 2.84, R * 2.84)
    }
    const dg = g.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, R)
    dg.addColorStop(0, rgba(disc, 0.1 * dk))
    dg.addColorStop(0.85, rgba(disc, 0.13 * dk))
    dg.addColorStop(0.97, rgba(disc, 0.16 * dk))
    dg.addColorStop(1, rgba(disc, 0))
    g.fillStyle = dg
    g.beginPath()
    g.arc(sun.x, sun.y, R, 0, Math.PI * 2)
    g.fill()
    g.save()
    g.beginPath()
    g.arc(sun.x, sun.y, R * 0.99, 0, Math.PI * 2)
    g.clip()
    for (let i = 0; i < 46; i++) {
      const a = r() * Math.PI * 2
      const d = Math.sqrt(r()) * R
      const big = i < 8
      const rr = R * (big ? 0.25 + r() * 0.2 : 0.008 + r() * 0.02)
      g.globalAlpha = big ? 0.025 : 0.06 + r() * 0.08
      g.drawImage(blotch(disc, i), sun.x + Math.cos(a) * d - rr, sun.y + Math.sin(a) * d - rr * 0.8, rr * 2, rr * 1.6)
    }
    g.restore()
    g.globalAlpha = 1
    yield

    // raked sand: rings around the pot, a few straight rake lines beyond — fading into the paper on every side
    const sand = document.createElement('canvas')
    sand.width = this.bg.width
    sand.height = this.bg.height
    const sg = sand.getContext('2d')!
    sg.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    const base = this.px(0, GROUND)
    const k = 0.17
    const rings = 5
    // the rings always close inside the picture
    const fit = Math.min(1, (Math.min(base.x, this.w - base.x) - 10) / (0.55 * s + (rings - 1) * 0.055 * s * 1.05))
    const ring0 = 0.55 * s * fit
    const gap = Math.max(5, 0.055 * s * fit)
    const line = (draw: (dy: number) => void) => {
      sg.lineWidth = 1
      sg.strokeStyle = pal.rake
      draw(0)
      sg.strokeStyle = pal.rakeHi
      draw(1)
    }
    for (let i = 0; i < rings; i++) {
      const rx = ring0 + i * gap * 1.05
      line((dy) => {
        sg.beginPath()
        sg.ellipse(base.x, base.y + dy, rx, rx * k, 0, 0, Math.PI * 2)
        sg.stroke()
      })
    }
    const outer = ring0 + (rings - 1) * gap * 1.05
    const ext = Math.max(base.x, this.w - base.x) + 10
    const straight = (y: number) => {
      const ph = r() * 6
      line((dy) => {
        sg.beginPath()
        for (let x = base.x - ext; x <= base.x + ext; x += 12) sg.lineTo(x, y + dy + Math.sin(x / 140 + ph) * 1.2)
        sg.stroke()
      })
    }
    sg.save()
    sg.beginPath()
    sg.rect(0, 0, this.w, this.h)
    sg.ellipse(base.x, base.y, outer + gap * 0.5, (outer + gap * 0.5) * k, 0, 0, Math.PI * 2)
    sg.clip('evenodd')
    let y = base.y - outer * k - gap * 1.1
    for (let i = 0; i < 3; i++, y -= gap * (1.2 + i * 0.45)) straight(y)
    y = base.y + outer * k + gap * 1.1
    for (let i = 0; i < 7 && y < this.H; i++, y += gap * (1.05 + i * 0.3)) straight(y)
    sg.restore()
    // fade: an ellipse around the pot (no line ever ends in a hard cut), and nothing below the composed height
    sg.globalCompositeOperation = 'destination-in'
    const rx = Math.max(outer * 1.15, Math.min(Math.max(outer * 1.7, this.w * 0.42), base.x - 2, this.w - base.x - 2))
    const ry = Math.max(outer * k * 3.4, rx * 0.26)
    sg.save()
    sg.translate(base.x, base.y)
    sg.scale(1, ry / rx)
    const fade = sg.createRadialGradient(0, 0, outer * 0.5, 0, 0, rx)
    fade.addColorStop(0, 'rgba(0,0,0,1)')
    fade.addColorStop(0.55, 'rgba(0,0,0,0.8)')
    fade.addColorStop(1, 'rgba(0,0,0,0)')
    sg.fillStyle = fade
    sg.fillRect(-rx, -rx, rx * 2, rx * 2)
    sg.restore()
    const vf = sg.createLinearGradient(0, this.H - gap * 3, 0, this.H)
    vf.addColorStop(0, 'rgba(0,0,0,1)')
    vf.addColorStop(1, 'rgba(0,0,0,0)')
    sg.fillStyle = vf
    sg.fillRect(0, 0, this.w, this.h)
    g.save()
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.drawImage(sand, 0, 0)
    g.restore()
    yield

    // contact shadow under the pot
    g.save()
    g.translate(base.x, base.y)
    g.scale(1, 0.16)
    const sh = g.createRadialGradient(0, 0, 0, 0, 0, 0.56 * s)
    sh.addColorStop(0, rgba(pal.dark ? [0, 0, 0] : pal.ink, pal.dark ? 0.5 : 0.2))
    sh.addColorStop(1, rgba(pal.dark ? [0, 0, 0] : pal.ink, 0))
    g.fillStyle = sh
    g.beginPath()
    g.arc(0, 0, 0.56 * s, 0, Math.PI * 2)
    g.fill()
    g.restore()

    // the soil: a low mound of ink wash above the rim, where the roots will grip
    for (const [lift, a] of [[0.008, 0.09], [0, 0.12], [-0.009, 0.12]] as const) {
      g.beginPath()
      for (let i = 0; i <= 48; i++) {
        const x = -0.37 + (0.74 * i) / 48
        const p = this.px(x, soilTop(x) + lift * Math.sin((Math.PI * i) / 48))
        g.lineTo(p.x, p.y)
      }
      const e = this.px(0.37, -0.02)
      const b0 = this.px(-0.37, -0.02)
      g.lineTo(e.x, e.y)
      g.lineTo(b0.x, b0.y)
      g.closePath()
      g.fillStyle = rgba(pal.ink, pal.dark ? a * 1.1 : a)
      g.fill()
    }
    // grains
    for (let i = 0; i < 40; i++) {
      const x = -0.34 + r() * 0.68
      const p = this.px(x, -0.006 + r() * (soilTop(x) + 0.004))
      dab(g, p.x, p.y, Math.max(0.6, s * (0.0018 + r() * 0.0025)), pal.ink, 0.25 + r() * 0.3, i)
    }
    // a soft mound of darker soil where the trunk rises (the roots grip here)
    for (const [dx, w, hh, a] of [[-0.02, 0.34, 0.05, 0.16], [0.03, 0.24, 0.04, 0.2], [-0.005, 0.16, 0.035, 0.22]] as const) {
      const c = this.px(dx, soilTop(dx) - 0.004)
      g.globalAlpha = pal.dark ? a * 0.8 : a
      g.drawImage(blotch(pal.dark ? pal.wood : pal.ink, Math.round(w * 10)), c.x - (w * s) / 2, c.y - (hh * s) / 2, w * s, hh * s)
    }
    g.globalAlpha = 1
  }

  // ───────── the shallow pot: glazed ceramic in ink wash — a lip with a pressed rim line, small feet, a potter's chop ─────────
  private *paintPot() {
    const g = this.ctx2(this.pot)
    const { pal, s } = this
    const P = (x: number, y: number) => this.px(x, y)
    const dark = pal.dark
    const r = rng(808)
    const nz = noise1(808)
    // a glazed pot painted in ink: a deep moss-black glaze by day, moonlit slate by night
    const glaze = dark ? mix(pal.paper, pal.ink, 0.24) : mix(pal.ink, pal.moss, 0.2)
    const pool = dark ? mix(pal.paper, pal.deep, 0.6) : pal.ink
    const sheen = dark ? pal.ink : pal.card
    const LIP = { top: -0.004, bot: -0.027, half: 0.446 }
    const B = { top: LIP.bot + 0.003, half: 0.428, bottom: POT.bottom, foot: 0.392 }
    const body = () => {
      g.beginPath()
      for (const sd of [1, -1]) {
        const a = P(sd * B.half, B.top)
        const c1 = P(sd * (B.half + 0.006), (B.top + B.bottom) / 2 + 0.01)
        const c = P(sd * (B.foot + 0.006), B.bottom + 0.016)
        const dc = P(sd * B.foot, B.bottom)
        const d = P(sd * (B.foot - 0.024), B.bottom - 0.001)
        if (sd > 0) {
          g.moveTo(P(-B.half, B.top).x, a.y)
          g.lineTo(a.x, a.y)
          g.quadraticCurveTo(c1.x, c1.y, c.x, c.y)
          g.quadraticCurveTo(dc.x, dc.y, d.x, d.y)
          // the foot line sags a hair, as a thrown pot does
          for (let i = 1; i < 24; i++) {
            const x = B.foot - 0.024 - (2 * (B.foot - 0.024) * i) / 24
            const p = P(x, B.bottom - 0.001 - 0.003 * Math.sin((Math.PI * i) / 24) - 0.0015 * nz(i * 0.7))
            g.lineTo(p.x, p.y)
          }
        } else {
          g.lineTo(d.x, d.y)
          g.quadraticCurveTo(dc.x, dc.y, c.x, c.y)
          g.quadraticCurveTo(c1.x, c1.y, a.x, a.y)
        }
      }
      g.closePath()
    }
    // small cloud feet, tucked under the body
    for (const fx of [-0.3, 0.3]) {
      const fw = 0.042
      const a = P(fx - fw, B.bottom + 0.006)
      const b = P(fx + fw, B.bottom + 0.006)
      const lo = P(fx, POT.feet)
      g.beginPath()
      g.moveTo(a.x, a.y)
      g.bezierCurveTo(a.x, lo.y - 0.004 * s, a.x + 0.016 * s, lo.y, lo.x, lo.y)
      g.bezierCurveTo(b.x - 0.016 * s, lo.y, b.x, lo.y - 0.004 * s, b.x, b.y)
      g.closePath()
      g.fillStyle = rgba(pool, dark ? 0.6 : 0.68)
      g.fill()
    }
    // the body: a soft bleed at its edge, then the glaze
    body()
    g.lineJoin = 'round'
    g.lineWidth = 3
    g.strokeStyle = rgba(glaze, 0.08)
    g.stroke()
    g.fillStyle = rgba(glaze, dark ? 0.62 : 0.66)
    g.fill()
    g.save()
    body()
    g.clip()
    const yT = P(0, B.top).y
    const yB = P(0, B.bottom).y
    const x0 = P(-B.half - 0.02, 0).x
    const x1 = P(B.half + 0.02, 0).x
    // glaze thins at the shoulder and pools toward the foot
    const vg = g.createLinearGradient(0, yT, 0, yB)
    vg.addColorStop(0, rgba(sheen, dark ? 0.06 : 0.16))
    vg.addColorStop(0.45, rgba(sheen, 0))
    vg.addColorStop(0.7, rgba(pool, 0))
    vg.addColorStop(1, rgba(pool, dark ? 0.3 : 0.32))
    g.fillStyle = vg
    g.fillRect(x0, yT, x1 - x0, yB - yT + 2)
    // the glaze's own variation: soft mottling where it ran thick or thin
    for (let i = 0; i < 18; i++) {
      const x = -0.4 + r() * 0.8
      const y = B.top - r() * (B.top - B.bottom)
      const w = (0.05 + r() * 0.12) * s
      const p = P(x, y)
      const c = r() < 0.55 ? pool : sheen
      g.globalAlpha = (c === pool ? 0.06 : dark ? 0.03 : 0.07) + r() * 0.05
      g.drawImage(blotch(c, i), p.x - w / 2, p.y - w * 0.2, w, w * 0.4)
    }
    g.globalAlpha = 1
    yield
    // a few soft runs where the glaze slid down from the lip
    for (let i = 0; i < 6; i++) {
      const x = -0.36 + (0.72 * (i + 0.2 + r() * 0.6)) / 6
      const len = (0.18 + r() * 0.3) * (B.top - B.bottom)
      const a = P(x, B.top)
      const b = P(x + (r() - 0.5) * 0.008, B.top - len)
      inkLine(g, [a, { x: (a.x + b.x) / 2 + (r() - 0.5) * 1.5, y: (a.y + b.y) / 2 }, b], { w: Math.max(1.2, (0.01 + r() * 0.008) * s), color: pool, alpha: (dark ? 0.08 : 0.07) + r() * 0.05, head: 1, tail: 0.25, seed: i })
    }
    // the gloss: one long soft reflection on the shoulder, a finer one under the lip
    g.save()
    const gl = P(-0.17, B.top - 0.034)
    g.translate(gl.x, gl.y)
    g.scale(1, 0.14)
    const hg = g.createRadialGradient(0, 0, 0, 0, 0, 0.24 * s)
    hg.addColorStop(0, rgba(sheen, dark ? 0.12 : 0.42))
    hg.addColorStop(1, rgba(sheen, 0))
    g.fillStyle = hg
    g.fillRect(-0.24 * s, -0.24 * s, 0.48 * s, 0.48 * s)
    g.restore()
    inkLine(g, [P(-0.37, B.top - 0.011), P(-0.05, B.top - 0.0105), P(0.3, B.top - 0.012)], { w: Math.max(0.8, 0.0035 * s), color: sheen, alpha: dark ? 0.12 : 0.36, head: 0.3, tail: 0.1, seed: 31 })
    // the lip casts a thin shadow on the body
    const ls = g.createLinearGradient(0, yT, 0, yT + 0.022 * s)
    ls.addColorStop(0, rgba(pool, dark ? 0.32 : 0.3))
    ls.addColorStop(1, rgba(pool, 0))
    g.fillStyle = ls
    g.fillRect(x0, yT, x1 - x0, 0.022 * s)
    // granulation: the glaze pooled in the pits of the clay
    for (let i = 0; i < 40; i++) {
      const p = P(-0.42 + r() * 0.84, B.top - r() * (B.top - B.bottom))
      dab(g, p.x, p.y, Math.max(0.5, s * (0.0008 + r() * 0.0012)), pool, 0.1 + r() * 0.14, i)
    }
    g.restore()
    yield
    // the contour, firmer along the foot
    body()
    g.lineWidth = Math.max(1, 0.0028 * s)
    g.strokeStyle = rgba(dark ? sheen : pool, dark ? 0.1 : 0.32)
    g.stroke()
    // the lip: a band of thicker glaze, with a dark rim line pressed along its top
    const lip = () => {
      const a = P(-LIP.half, LIP.top)
      const b = P(LIP.half, LIP.bot)
      g.beginPath()
      g.roundRect(a.x, a.y, b.x - a.x, b.y - a.y, (b.y - a.y) / 2)
    }
    lip()
    g.fillStyle = rgba(mix(glaze, pool, dark ? 0.2 : 0.12), dark ? 0.8 : 0.78)
    g.fill()
    const sheenLine = spline([P(-LIP.half + 0.01, LIP.bot + 0.008), P(0, LIP.bot + 0.0075), P(LIP.half - 0.01, LIP.bot + 0.009)], 2)
    inkLine(g, sheenLine, { w: Math.max(0.8, 0.004 * s), color: sheen, alpha: dark ? 0.14 : 0.32, head: 0.4, tail: 0.3, seed: 33 })
    const rim = spline([P(-LIP.half - 0.002, LIP.top - 0.003), P(-0.1, LIP.top - 0.0015), P(0.2, LIP.top - 0.0035), P(LIP.half + 0.002, LIP.top - 0.004)], 1.2)
    const rw = Math.max(1.6, 0.011 * s)
    sumi(g, rim, rim.map((_, k) => rw * (0.75 + 0.25 * Math.sin((k / (rim.length - 1)) * Math.PI))), { color: dark ? mix(pal.paper, pal.ink, 0.5) : pool, alpha: dark ? 0.7 : 0.95, seed: 406, dry: 0.3, side: 1, paper: pal.paper })
    yield
    // the potter's chop, pressed into the glaze: a small vermilion seal with a carved border and character
    const seal = P(0.285, -0.084)
    const z = Math.max(7, 0.03 * s)
    const zh = z * 1.22
    const sc = document.createElement('canvas')
    const d = Math.max(1, this.dpr)
    const S = Math.ceil(zh * 1.5)
    sc.width = sc.height = Math.ceil(S * d)
    const sg = sc.getContext('2d')!
    sg.setTransform(d, 0, 0, d, (S * d) / 2, (S * d) / 2)
    const sr = rng(77)
    sg.rotate(-0.035)
    sg.beginPath()
    sg.roundRect(-z / 2, -zh / 2, z, zh, z * 0.14)
    sg.fillStyle = rgba(dark ? pal.verm : mix(pal.verm, pal.ink, 0.12), dark ? 0.72 : 0.86)
    sg.fill()
    const cut = dark ? mix(glaze, pal.paper, 0.4) : mix(glaze, pal.card, 0.55)
    const cw = Math.max(0.6, z * 0.08)
    sg.strokeStyle = rgba(cut, 0.85)
    sg.lineWidth = cw
    sg.beginPath()
    sg.roundRect(-z / 2 + z * 0.14, -zh / 2 + z * 0.14, z - z * 0.28, zh - z * 0.28, z * 0.06)
    sg.stroke()
    for (const [a, b] of [[[-0.17, -0.3], [-0.16, 0.3]], [[0.15, -0.31], [0.16, 0.29]], [[-0.24, -0.02], [0.24, -0.01]], [[-0.17, 0.16], [0.16, 0.17]]] as const)
      inkLine(sg, [{ x: a[0] * z, y: a[1] * zh }, { x: b[0] * z, y: b[1] * zh }], { w: cw * 1.1, color: cut, alpha: 0.85, head: 0.9, tail: 0.7 })
    // the stamp didn't take everywhere
    sg.globalCompositeOperation = 'destination-out'
    for (let i = 0; i < 34; i++) {
      sg.fillStyle = `rgba(0,0,0,${(0.2 + sr() * 0.5).toFixed(2)})`
      const sz = (0.4 + sr() * 1) * Math.max(0.6, z / 20)
      sg.fillRect((sr() - 0.5) * z, (sr() - 0.5) * zh, sz, sz)
    }
    g.drawImage(sc, seal.x - S / 2, seal.y - S / 2, S, S)
  }

  // ───────── wood: trunk, branches, roots — each one loaded brush stroke ─────────
  private *paintWood() {
    const g = this.ctx2(this.wood)
    const { pal, s } = this
    const dark = pal.dark
    const q = this.o.quality === 'high'
    this.limbs = []
    const all = [TRUNK, ...LIMBS]
    // the trunk first; each branch and root grows out of it, fading in from inside the trunk
    for (const [i, d] of all.entries()) {
      const path = spline(d.pts.map(([x, y]) => this.px(x, y)), q ? 1.1 : 1.6)
      const nz = noise1(900 + i)
      const width = (t: number) => {
        const base = d.w0 + (d.w1 - d.w0) * Math.pow(t, 0.85) + (d.flare ?? 0) * Math.exp(-t / 0.05)
        return Math.max(0.6, base * s * (0.94 + 0.12 * nz(t * 6)))
      }
      const W = path.map((_, k) => width(k / Math.max(1, path.length - 1)))
      this.limbs.push({ path, W, g: d.g })
      const nm = normals(path)
      // the shadow side faces away from the light (upper left)
      let lean = 0
      for (const v of nm) lean += v.x * 0.45 + v.y * 0.9
      const side = lean >= 0 ? 1 : -1
      const thin = d.w0 < 0.03
      const opts = { color: pal.wood, alpha: dark ? (thin ? 0.42 : 0.3) : thin ? 0.94 : 0.95, seed: 100 + i * 17, dry: d.dry ?? (thin ? 0.15 : 0.45), side, paper: pal.paper }
      // the trunk and its roots rise out of the soil (see below); each branch grows out of the trunk
      this.grownOut(g, path, W, opts, i === 0 ? 0 : d.w0 * s * (i <= 4 ? 0.35 : 1))
      if (i === 0) this.bark(g, path, W, nm, side)
      yield
    }
    // moss dots (苔点): a few ink dabs scattered just inside the trunk's edges, in small clusters
    const r = rng(321)
    const trunk = this.limbs[0]
    const tn = normals(trunk.path)
    for (let i = 0; i < 7; i++) {
      const k = Math.floor((0.12 + r() * 0.72) * (trunk.path.length - 1))
      const sd = r() < 0.7 ? 1 : -1
      const m = r() < 0.45 ? 2 : 1
      for (let j = 0; j < m; j++) {
        const kk = Math.min(trunk.path.length - 1, k + j * Math.round(3 + r() * 5))
        const p = trunk.path[kk]
        const off = sd * trunk.W[kk] * (0.27 + r() * 0.13)
        const rr = Math.max(0.8, s * (0.0022 + r() * 0.003))
        g.save()
        g.translate(p.x + tn[kk].x * off, p.y + tn[kk].y * off)
        g.rotate(Math.atan2(tn[kk].y, tn[kk].x) + Math.PI / 2)
        g.scale(1, 1.5)
        dab(g, 0, 0, rr, dark ? pal.wood : pal.deep, (dark ? 0.45 : 0.75) * (0.7 + 0.3 * r()), i * 3 + j)
        g.restore()
      }
    }
    // the wood sinks into the soil: it thins out just above the mound's curve, so the trunk's flare and every root
    // dive in with a soft, uneven edge instead of ending in a cut
    g.save()
    g.globalCompositeOperation = 'destination-out'
    const nz = noise1(77)
    for (let j = 0; j < 9; j++) {
      g.beginPath()
      for (let i = 0; i <= 64; i++) {
        const x = -0.5 + i / 64
        const p = this.px(x, soilTop(x) + 0.014 - j * 0.0024 + 0.005 * (nz(i * 0.45 + j * 0.3) - 0.5))
        g.lineTo(p.x, p.y)
      }
      g.lineTo(this.w, this.h)
      g.lineTo(0, this.h)
      g.closePath()
      g.fillStyle = 'rgba(0,0,0,0.3)'
      g.fill()
    }
    g.restore()
  }

  /** A branch or root grows out of the trunk: painted apart, then faded in along its first fadeLen px so the joint is seamless. */
  private grownOut(g: CanvasRenderingContext2D, path: Pt[], W: number[], o: Parameters<typeof sumi>[3], fadeLen: number) {
    const pad = Math.max(...W) + 4
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (const p of path) {
      x0 = Math.min(x0, p.x - pad)
      y0 = Math.min(y0, p.y - pad)
      x1 = Math.max(x1, p.x + pad)
      y1 = Math.max(y1, p.y + pad)
    }
    const d = this.dpr
    const tg = this.tmp.getContext('2d')!
    tg.setTransform(1, 0, 0, 1, 0, 0)
    tg.clearRect(x0 * d - 1, y0 * d - 1, (x1 - x0) * d + 2, (y1 - y0) * d + 2)
    tg.setTransform(d, 0, 0, d, 0, 0)
    tg.globalCompositeOperation = 'source-over'
    tg.save()
    tg.beginPath()
    tg.rect(x0, y0, x1 - x0, y1 - y0)
    tg.clip()
    sumi(tg, path, W, o)
    const a = path[0]
    let k = 0
    let acc = 0
    while (k < path.length - 1 && acc < fadeLen) {
      acc += Math.hypot(path[k + 1].x - path[k].x, path[k + 1].y - path[k].y)
      k++
    }
    const b = path[k]
    if (a !== b) {
      const fg = tg.createLinearGradient(a.x, a.y, b.x, b.y)
      fg.addColorStop(0, 'rgba(0,0,0,0)')
      fg.addColorStop(1, 'rgba(0,0,0,1)')
      tg.globalCompositeOperation = 'destination-in'
      tg.fillStyle = fg
      tg.fillRect(x0, y0, x1 - x0, y1 - y0)
    }
    tg.restore()
    tg.globalCompositeOperation = 'source-over'
    g.save()
    g.setTransform(1, 0, 0, 1, 0, 0)
    const sx = Math.max(0, Math.floor(x0 * d))
    const sy = Math.max(0, Math.floor(y0 * d))
    const sw = Math.min(this.tmp.width - sx, Math.ceil((x1 - x0) * d))
    const sh = Math.min(this.tmp.height - sy, Math.ceil((y1 - y0) * d))
    if (sw > 0 && sh > 0) g.drawImage(this.tmp, sx, sy, sw, sh, sx, sy, sw, sh)
    g.restore()
  }

  /** pine bark (鱗皴): small open crescent scales at irregular intervals, gathered toward the shadow side */
  private bark(g: CanvasRenderingContext2D, path: Pt[], W: number[], nm: Pt[], side: number) {
    const r = rng(733)
    const { pal } = this
    const col = pal.dark ? pal.wood : pal.deep
    g.save()
    g.lineCap = 'round'
    const n = path.length
    const unit = Math.max(6, this.s * 0.03) / 1.1
    let k = Math.floor(n * 0.1)
    while (k < n * 0.86) {
      const w = W[k]
      if (w >= 7) {
        const m = 1 + Math.floor(r() * 2.2)
        for (let j = 0; j < m; j++) {
          const u = clamp(side * (-0.3 + r() * 1.05), -0.7, 0.78)
          const kk = clamp(k + Math.round((r() - 0.5) * unit), 0, n - 1)
          const p = path[kk]
          const nx = nm[kk].x
          const ny = nm[kk].y
          const c = { x: p.x + nx * u * w * 0.5, y: p.y + ny * u * w * 0.5 }
          const len = w * (0.1 + r() * 0.4)
          const bow = len * (0.25 + r() * 0.3) * (r() < 0.75 ? 1 : -1)
          // tangent (up the trunk) = (ny, -nx)
          const shade = 0.55 + 0.45 * smooth(-0.3, 0.8, u * side)
          g.strokeStyle = rgba(col, (pal.dark ? 0.2 : 0.48) * (0.45 + 0.55 * r()) * shade)
          g.lineWidth = Math.max(0.6, w * (0.018 + r() * 0.024))
          g.beginPath()
          g.moveTo(c.x - nx * len * 0.5, c.y - ny * len * 0.5)
          g.quadraticCurveTo(c.x - ny * bow, c.y + nx * bow, c.x + nx * len * 0.5, c.y + ny * len * 0.5)
          g.stroke()
        }
      }
      k += Math.max(2, Math.round(unit * (0.5 + r() * 1.7)))
    }
    g.restore()
  }

  // ───────── foliage pads: clouds of soft dabs and needle flecks ─────────
  private buildPads() {
    const { pal, s } = this
    const q = this.o.quality === 'high'
    const under = pal.dark ? mix(pal.moss, pal.paper, 0.58) : mix(pal.moss, pal.ink, 0.42)
    const midC = pal.moss
    const hi = pal.dark ? mix(pal.moss, pal.ink, 0.14) : mix(pal.moss2, pal.paper, 0.12)
    const needleC = pal.dark ? mix(pal.moss, pal.paper, 0.55) : mix(pal.moss, pal.ink, 0.5)
    const needleHi = pal.dark ? mix(pal.moss, pal.ink, 0.45) : mix(pal.moss2, pal.paper, 0.35)
    this.pads = PADS.map((def) => {
      const r = rng(def.seed)
      const rx = def.rx * s
      const ry = def.ry * s
      const m = Math.max(10, ry * 0.9)
      const x0 = this.px(def.c[0], 0).x - rx - m
      const y0 = this.px(0, def.c[1]).y - ry * 1.55 - m
      const cw = rx * 2 + m * 2
      const ch = ry * 2.6 + m * 2
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(cw * this.dpr)
      canvas.height = Math.ceil(ch * this.dpr)
      // local coords: pad centre
      const cx = rx + m
      const cy = ry * 1.55 + m
      const piv = { x: (def.pivot[0] - def.c[0]) * s + cx, y: -(def.pivot[1] - def.c[1]) * s + cy }
      const dist = (x: number, y: number) => Math.hypot((x - piv.x) / rx, (y - piv.y) / ry)
      const maxD = 2.6
      // puffs along the top make the lumpy cloud silhouette; the underside stays flat
      const nP = 3 + Math.round(def.rx / def.ry / 1.1)
      const puffs = Array.from({ length: nP }, (_, i) => {
        const u = -0.74 + (1.48 * i) / (nP - 1) + (r() - 0.5) * 0.08
        const h = Math.pow(1 - u * u, 0.6)
        return { u, v: -0.12 + 0.42 * h + (r() - 0.5) * 0.12, R: 0.5 + 0.38 * h + r() * 0.12 }
      })
      const bottom = (u: number) => -0.6 + 0.22 * u * u
      const dabs: Dab[] = []
      const area = Math.PI * rx * ry * 1.4
      const n = Math.round(clamp(area / (q ? 30 : 60), q ? 90 : 50, q ? 420 : 180))
      let guard = 0
      while (dabs.length < n && guard++ < n * 20) {
        const p = puffs[Math.floor(r() * nP)]
        const a = r() * Math.PI * 2
        const d = Math.sqrt(r()) * p.R
        const u = p.u + (Math.cos(a) * d * def.ry) / def.rx
        const v = p.v + Math.sin(a) * d
        if (Math.abs(u) > 1.02 || v < bottom(u)) continue
        const top = 1.1
        const t = clamp((v - bottom(u)) / (top - bottom(u)))
        let col = t < 0.42 ? mix(under, midC, smooth(0, 0.42, t)) : mix(midC, hi, smooth(0.5, 1, t))
        col = mix(col, r() < 0.5 ? under : hi, r() * 0.12)
        const x = cx + u * rx
        const y = cy - v * ry
        dabs.push({
          x,
          y,
          r: ry * (0.12 + r() * 0.15) * (t < 0.3 ? 1.25 : 1) * (q ? 1 : 1.3),
          sx: 1.2 + r() * 0.7,
          rot: (r() - 0.5) * 0.8,
          a: (pal.dark ? 0.2 : 0.22) + r() * (pal.dark ? 0.18 : 0.22),
          col,
          wet: false,
          v: Math.floor(r() * 4),
          th: clamp(dist(x, y) / maxD) * 0.75 + r() * 0.1,
        })
      }
      // needle clusters on the crown and along the lower lip
      const needles: Needle[] = []
      const nc = Math.round(clamp(rx / 3.2, 8, 38) * (q ? 1 : 0.6))
      for (let i = 0; i < nc; i++) {
        const onTop = r() < 0.62
        const p = puffs[Math.floor(r() * nP)]
        const a = onTop ? -Math.PI / 2 + (r() - 0.5) * 2.2 : Math.PI / 2 + (r() - 0.5) * 1.4
        const u = clamp(p.u + (Math.cos(a) * p.R * 0.85 * def.ry) / def.rx, -1, 1)
        const v = onTop ? p.v - Math.sin(a) * p.R * 0.85 : bottom(u) + 0.08
        const x = cx + u * rx
        const y = cy - v * ry
        const k = onTop ? 9 + Math.floor(r() * 6) : 5 + Math.floor(r() * 4)
        const base = onTop ? -Math.PI / 2 + u * 0.6 : Math.PI / 2 + u * 0.4
        for (let j = 0; j < k; j++) {
          needles.push({
            x: x + (r() - 0.5) * 3,
            y: y + (r() - 0.5) * 3,
            ang: base + (j / (k - 1) - 0.5) * (onTop ? 2.6 : 1.6) + (r() - 0.5) * 0.18,
            len: ry * (0.3 + r() * 0.28),
            lw: Math.max(0.55, ry * (0.016 + r() * 0.014)),
            a: 0.45 + r() * 0.4,
            col: onTop && r() < 0.3 ? needleHi : needleC,
            th: clamp(dist(x, y) / maxD) * 0.75 + 0.2,
          })
        }
      }
      // a soft darker wash along the flat underside
      for (let i = 0; i < Math.round(6 + rx / 12); i++) {
        const u = (r() - 0.5) * 1.6
        const x = cx + u * rx
        const y = cy - (bottom(u) + 0.1) * ry
        dabs.push({ x, y, r: ry * (0.16 + r() * 0.12), sx: 2.6 + r() * 1.6, rot: (r() - 0.5) * 0.15, a: 0.22 + r() * 0.18, col: mix(under, pal.deep, 0.35), wet: false, soft: true, th: clamp(dist(x, y) / maxD) * 0.75 + 0.05 })
      }
      dabs.sort((a, b) => b.y - a.y)
      // one broad wash per puff underneath everything, so the pad reads as one mass
      dabs.unshift(
        ...puffs.map((p) => {
          const x = cx + p.u * rx
          const y = cy - (p.v - 0.1) * ry
          return { x, y, r: p.R * ry * 1.05, sx: 1.5, rot: 0, a: pal.dark ? 0.26 : 0.22, col: mix(midC, under, 0.35), wet: false, soft: true, th: clamp(dist(x, y) / maxD) * 0.6 }
        }),
      )
      // loose speckles around the silhouette
      for (let i = 0; i < Math.round(nc * 1.1); i++) {
        const p = puffs[Math.floor(r() * nP)]
        const a = r() * Math.PI * 2
        const d = p.R * (0.9 + r() * 0.35)
        const u = p.u + (Math.cos(a) * d * def.ry) / def.rx
        const v = Math.max(bottom(u) - 0.1, p.v + Math.sin(a) * d)
        const x = cx + u * rx
        const y = cy - v * ry
        needles.push({ x, y, ang: r() * 6, len: 0.3, lw: Math.max(0.7, ry * (0.025 + r() * 0.035)), a: 0.2 + r() * 0.35, col: needleC, th: clamp(dist(x, y) / maxD) * 0.8 + 0.15 })
      }
      return { def, canvas, x0, y0, dabs, needles, bloomDrawn: -1 }
    })
  }

  private paintPad(p: PadRuntime, bloom: number) {
    const steps = this.padSteps(p, bloom)
    while (!steps.next().done);
  }

  /** paintPad, a dab or a needle per step */
  private *padSteps(p: PadRuntime, bloom: number) {
    const g = p.canvas.getContext('2d')!
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    g.clearRect(0, 0, p.canvas.width, p.canvas.height)
    if (bloom <= 0) return
    const { pal } = this
    if (pal.dark) {
      // faint moss glow under night foliage
      let sx = 0
      let sy = 0
      for (const d of p.dabs) (sx += d.x), (sy += d.y)
      const n = p.dabs.length || 1 // no dabs → the origin, as before
      const rr = p.def.rx * this.s * 1.15
      g.save()
      g.translate(sx / n, sy / n)
      g.scale(1, (p.def.ry / p.def.rx) * 2.2)
      const gl = g.createRadialGradient(0, 0, 0, 0, 0, rr)
      gl.addColorStop(0, rgba(pal.moss, 0.16 * bloom))
      gl.addColorStop(1, rgba(pal.moss, 0))
      g.fillStyle = gl
      g.beginPath()
      g.arc(0, 0, rr, 0, Math.PI * 2)
      g.fill()
      g.restore()
    }
    for (const d of p.dabs) {
      const k = clamp((bloom - d.th) / 0.22)
      if (k <= 0) continue
      const rr = d.r * (0.55 + 0.45 * k)
      g.save()
      g.translate(d.x, d.y)
      g.rotate(d.rot)
      g.scale(d.sx, 1)
      g.globalAlpha = d.a * k
      g.drawImage(d.soft || d.v == null ? sprite(d.col, d.wet) : blotch(d.col, d.v), -rr, -rr, rr * 2, rr * 2)
      g.restore()
      yield
    }
    g.lineCap = 'round'
    for (const n of p.needles) {
      const k = clamp((bloom - n.th) / 0.2)
      if (k <= 0) continue
      g.strokeStyle = rgba(n.col, n.a * k)
      g.lineWidth = n.lw
      g.beginPath()
      g.moveTo(n.x, n.y)
      g.lineTo(n.x + Math.cos(n.ang) * n.len * k, n.y + Math.sin(n.ang) * n.len * k)
      g.stroke()
      yield
    }
    p.bloomDrawn = bloom
  }

  private litOf(p: PadRuntime) {
    if (p.lit && p.litAt === p.bloomDrawn) return p.lit
    const c = (p.lit ??= document.createElement('canvas'))
    c.width = p.canvas.width
    c.height = p.canvas.height
    const lg = c.getContext('2d')!
    lg.drawImage(p.canvas, 0, 0)
    lg.globalCompositeOperation = 'source-in'
    lg.fillStyle = rgba(mix(this.pal.verm, this.pal.ink, 0.3))
    lg.fillRect(0, 0, c.width, c.height)
    p.litAt = p.bloomDrawn
    return c
  }

  private buildMoss() {
    const r = rng(91)
    const { pal, s } = this
    this.moss = []
    // small crisp moss dots in a few clumps on the soil, clear of the trunk
    for (const cx of [-0.3, -0.21, -0.12, 0.13, 0.22, 0.31]) {
      const n = 4 + Math.floor(r() * 5)
      for (let i = 0; i < n; i++) {
        const x = cx + (r() - 0.5) * 0.07
        const p = this.px(x, soilTop(x) - 0.004 + r() * 0.01)
        const deep = r() < 0.45
        this.moss.push({ x: p.x, y: p.y, r: Math.max(0.9, s * (0.004 + r() * 0.0055)), sx: 1, rot: 0, a: 0.7 + r() * 0.3, col: deep ? mix(pal.moss, pal.deep, 0.4) : pal.moss, wet: false, v: i, th: Math.abs(x) * 1.6 * 0.7 + r() * 0.2 })
      }
    }
  }

  // ───────── interaction helpers ─────────
  water() {
    if (this.o.reduced) return
    const now = performance.now() / 1000
    for (let i = 0; i < 3; i++) this.drops.push({ t0: now + i * 0.16, x: (i - 1) * 0.035 })
    this.gust = 1
    this.invalidate()
  }

  invalidate() {
    this.dirty = true
    this.lp.start()
    this.lp.wake()
  }

  // ───────── frame loop ─────────
  private tick() {
    const now = performance.now() / 1000
    const t = (performance.now() - this.t0) / 1000
    const animating = this.painting || this.sway || this.busy || (this.breath && !this.o.reduced) || this.ripples.length > 0 || this.drops.length > 0 || (this.G === 0 && !this.o.reduced)
    if (!this.dirty && !animating) return false // idle: stop until invalidate()
    this.dirty = false
    this.frame(t, now)
  }

  private frame(t: number, now: number) {
    const g = this.g
    const { pal, s } = this
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.clearRect(0, 0, this.canvas.width, this.canvas.height)
    g.drawImage(this.bg, 0, 0)

    // ripples on the sand and the soil (expired ones dropped in place: no new array per frame)
    let live = 0
    for (const rp of this.ripples) if (now - rp.t0 < 3.2) this.ripples[live++] = rp
    this.ripples.length = live
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    const ripC = this.ripples.length ? (pal.dark ? pal.ink : mix(pal.moss, pal.ink, 0.5)) : pal.ink
    for (const rp of this.ripples) {
      const age = (now - rp.t0) / 3.2
      if (age < 0) continue
      const cx = this.ox + rp.x * s
      const cy = this.oy - rp.y * s
      for (let k = 0; k < 3; k++) {
        const a = age - k * 0.09
        if (a <= 0) continue
        // ripples spread over the sand but never past the picture's edge
        const R = Math.min((0.3 + Math.pow(a, 0.7) * 0.95) * s, Math.min(cx, this.w - cx) - 3)
        const alpha = (1 - a) * (k === 0 ? 0.7 : 0.4) * (pal.dark ? 1.1 : 1)
        g.lineWidth = k === 0 ? 1.8 : 1.2
        g.strokeStyle = rgba(ripC, alpha)
        g.beginPath()
        g.ellipse(cx, cy, R, R * 0.17, 0, 0, Math.PI * 2)
        g.stroke()
      }
    }
    // seed (before growth)
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    const seedK = 1 - smooth(0, 0.08, this.G)
    if (seedK > 0) {
      const cx = this.ox + 0.005 * s
      const cy = this.oy - 0.036 * s
      // a soft vermilion breath around the seed: "start here"
      const br = this.o.reduced ? 0.7 : 0.55 + 0.45 * Math.sin(t * 2.2)
      const hr = 0.09 * s * (1 + 0.15 * br)
      const halo = g.createRadialGradient(cx, cy, 0, cx, cy, hr)
      halo.addColorStop(0, rgba(pal.verm, (pal.dark ? 0.36 : 0.32) * br * seedK))
      halo.addColorStop(1, rgba(pal.verm, 0))
      g.fillStyle = halo
      g.beginPath()
      g.arc(cx, cy, hr, 0, Math.PI * 2)
      g.fill()
      // half-buried: the soil covers its lower third
      const cut = this.oy - (0.036 - 0.0045) * s
      g.save()
      g.beginPath()
      g.rect(cx - 0.05 * s, cy - 0.05 * s, 0.1 * s, cut - (cy - 0.05 * s))
      g.clip()
      g.translate(cx, cy)
      g.rotate(-0.3)
      g.fillStyle = rgba(pal.wood, 0.82 * seedK)
      g.beginPath()
      g.ellipse(0, 0, 0.024 * s, 0.013 * s, 0, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = rgba(pal.wood, 0.25 * seedK)
      g.beginPath()
      g.ellipse(0.004 * s, 0.002 * s, 0.017 * s, 0.008 * s, 0, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = rgba(pal.paper, 0.2 * seedK)
      g.beginPath()
      g.ellipse(-0.007 * s, -0.005 * s, 0.007 * s, 0.0025 * s, 0, 0, Math.PI * 2)
      g.fill()
      g.restore()
      // a lip of soil where it sits
      g.save()
      g.translate(cx, cut)
      g.scale(1, 0.22)
      const lip = g.createRadialGradient(0, 0, 0, 0, 0, 0.034 * s)
      lip.addColorStop(0, rgba(pal.wood, 0.3 * seedK))
      lip.addColorStop(1, rgba(pal.wood, 0))
      g.fillStyle = lip
      g.fillRect(-0.034 * s, -0.034 * s, 0.068 * s, 0.068 * s)
      g.restore()
    }

    // wood (masked while it grows)
    g.setTransform(1, 0, 0, 1, 0, 0)
    if (this.G >= 1) {
      g.drawImage(this.wood, 0, 0)
    } else if (this.G > 0) {
      const tg = this.tmp.getContext('2d')!
      tg.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
      tg.globalCompositeOperation = 'source-over'
      tg.clearRect(0, 0, this.w, this.h)
      tg.fillStyle = '#000'
      tg.beginPath()
      for (const l of this.limbs) {
        const k = clamp((this.G - l.g[0]) / (l.g[1] - l.g[0]))
        if (k <= 0) continue
        const end = Math.floor(k * (l.path.length - 1))
        for (let i = 0; i <= end; i += 2) {
          const p = l.path[i]
          const rr = l.W[i] * 0.62 + 2
          tg.moveTo(p.x + rr, p.y)
          tg.arc(p.x, p.y, rr, 0, Math.PI * 2)
        }
      }
      tg.fill()
      tg.setTransform(1, 0, 0, 1, 0, 0)
      tg.globalCompositeOperation = 'source-in'
      tg.drawImage(this.wood, 0, 0)
      tg.globalCompositeOperation = 'source-over'
      g.drawImage(this.tmp, 0, 0)
    }

    // moss on the soil, over the roots' ends
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    for (const d of this.moss) {
      const k = clamp((this.M - d.th) / 0.3)
      if (k <= 0) continue
      dab(g, d.x, d.y, d.r * (0.5 + 0.5 * k), d.col, d.a * k, d.v)
    }

    g.setTransform(1, 0, 0, 1, 0, 0)
    g.drawImage(this.pot, 0, 0)
    if (this.o.underlay && this.ready) {
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
      this.o.underlay(g)
      g.setTransform(1, 0, 0, 1, 0, 0)
    }

    // foliage pads
    this.gust *= 0.985
    if (this.gust < 0.01) this.gust = 0
    for (const p of this.pads) {
      const f = this.bloomOf(p)
      if (f <= 0) continue
      // (while the layers soak in, layers() paints the pads)
      if (!this.painting && (Math.abs(f - p.bloomDrawn) > 0.004 || (f === 1 && p.bloomDrawn !== 1))) this.paintPad(p, f)
      // the small pad beside the crown belongs to the crown (AI tạo sinh)
      const id = p.def.id === 'deco' ? 'gen' : p.def.id
      const glow = this.glow[id] ?? 0
      const idle = this.breath && !this.o.reduced ? 0.35 * (0.5 - 0.5 * Math.cos(t * 1.3 + p.def.seed)) : 0
      const hov = (this.hover[id] ?? 0) + idle
      const ph = p.def.seed * 0.7
      const amp = this.sway ? 1 + this.gust * 5 : 0
      const rot = amp * 0.006 * Math.sin(t * 0.8 + ph) + this.gust * 0.01 * Math.sin(t * 7 + ph)
      const breathe = this.sway ? 1 + 0.012 * Math.sin(t * 1.1 + ph * 1.3) + glow * 0.02 : 1 + glow * 0.02
      const pivX = this.ox + p.def.pivot[0] * s
      const pivY = this.oy - p.def.pivot[1] * s
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
      if (glow > 0 || hov > 0) {
        // = padBox(p.def.id), inlined so a glowing frame allocates nothing
        const d = p.def
        const cx = this.ox + d.c[0] * s
        const cy = this.oy - d.c[1] * s - d.ry * s * 0.35
        const crx = d.rx * s
        const cry = d.ry * s * 1.45
        const sy = (cry / crx) * 1.25
        // keep the glow inside the picture: no hard cut at the art edge
        const R = Math.max(4, Math.min(crx * 1.35, cx - 2, this.w - cx - 2, (cy - 2) / sy, (this.H - cy - 2) / sy))
        g.save()
        g.translate(cx, cy)
        g.scale(1, sy)
        const gl = g.createRadialGradient(0, 0, 0, 0, 0, R)
        if (pal.dark) {
          // by night it is light, never a stain: added to the dark, a pale warm core falling off through vermilion
          g.globalCompositeOperation = 'lighter'
          const a = glow * 0.17 + hov * 0.05
          gl.addColorStop(0, rgba(mix(pal.verm, pal.ink, 0.5), a))
          gl.addColorStop(0.3, rgba(pal.verm, a * 0.5))
          gl.addColorStop(0.7, rgba(pal.verm, a * 0.12))
          gl.addColorStop(1, rgba(pal.verm, 0))
        } else {
          const a = glow * 0.38 + hov * 0.12
          gl.addColorStop(0, rgba(pal.verm, a))
          gl.addColorStop(0.55, rgba(pal.verm, a * 0.45))
          gl.addColorStop(1, rgba(pal.verm, 0))
        }
        g.fillStyle = gl
        g.beginPath()
        g.arc(0, 0, R, 0, Math.PI * 2)
        g.fill()
        g.restore()
        g.globalCompositeOperation = 'source-over'
      }
      g.translate(pivX, pivY)
      g.rotate(rot)
      g.scale(breathe, breathe)
      g.translate(-pivX, -pivY)
      g.drawImage(p.canvas, p.x0, p.y0, p.canvas.width / this.dpr, p.canvas.height / this.dpr)
      if (glow > 0 || hov > 0) {
        // the foliage catches the light: lifted by day, lit warm from within by night
        g.globalCompositeOperation = pal.dark ? 'lighter' : 'screen'
        g.globalAlpha = pal.dark ? glow * 0.09 + hov * 0.04 : glow * 0.4 + hov * 0.18
        g.drawImage(pal.dark ? this.litOf(p) : p.canvas, p.x0, p.y0, p.canvas.width / this.dpr, p.canvas.height / this.dpr)
        g.globalAlpha = 1
        g.globalCompositeOperation = 'source-over'
      }
    }

    // fruits, twigs, labels' ink — painted by the scene
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    this.busy = this.o.overlay && this.ready ? this.o.overlay(g, t, now) : false

    // falling water drops
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    // (in place, like the ripples: no new array per frame)
    const dropC = this.drops.length ? (pal.dark ? pal.ink : mix(pal.moss, pal.ink, 0.35)) : pal.ink
    let kept = 0
    for (const d of this.drops) {
      const a = (now - d.t0) / DUR_DROP
      if (a >= 1) {
        if (d.x === 0) this.ripples.push({ t0: now, x: 0, y: GROUND, big: true }, { t0: now + 0.5, x: 0, y: GROUND, big: true })
        continue
      }
      this.drops[kept++] = d
      if (a < 0) continue
      const y = 0.62 - (0.62 - 0.02) * a * a
      const cx = this.ox + d.x * s
      const cy = this.oy - y * s
      const z = 0.016 * s
      g.fillStyle = rgba(dropC, 0.55 * (1 - a * 0.3))
      g.beginPath()
      g.moveTo(cx, cy - z * 2.2)
      g.quadraticCurveTo(cx + z, cy - z * 0.2, cx, cy + z * 0.9)
      g.quadraticCurveTo(cx - z, cy - z * 0.2, cx, cy - z * 2.2)
      g.fill()
    }
    this.drops.length = kept
  }

  destroy() {
    this.destroyed = true
    this.job?.cancel()
    this.lp.dispose()
    this.ro.disconnect()
    this.canvas.remove()
    for (const c of [this.canvas, this.bg, this.pot, this.wood, this.tmp, ...this.pads.flatMap((p) => (p.lit ? [p.canvas, p.lit] : [p.canvas]))]) c.width = c.height = 0
  }
}
