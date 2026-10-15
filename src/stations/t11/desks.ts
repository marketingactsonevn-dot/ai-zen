import { s } from '../../core/dom'
import { gsap } from '../../core/anim'
import { Pen, brush, drawIn, arc, cursive, ell, poly, rrD, rrPts, type Pt, type TL } from '../t03/brush'

/**
 * Six desks of the AI team, brushed in sumi-e on a low table (viewBox 240×180).
 * Each desk owns a small "job": the worker sitting there does its work once when asked,
 * and a tiny idle gesture (a brush sways, a reel creeps, the crane breathes) the room plays now and then.
 */
export const DESK_IDS = ['text', 'image', 'video', '3d', 'voice', 'agent'] as const
export type DeskId = (typeof DESK_IDS)[number]

export interface Desk {
  svg: SVGSVGElement
  /** brush the desk in on a timeline; returns the end time */
  draw(tl: TL, at?: number, total?: number): number
  /** the worker does its job once (instant under reduced motion) */
  work(): void
  /** a small idle gesture (null while the job runs); the caller owns the returned timeline */
  idle(): TL | null
}

type Job = (tl: TL) => void
interface Build {
  job: Job
  /** a few seconds of quiet life, played on a fresh timeline */
  idle?: (tl: TL) => void
  /** things hidden until the first job (strokes revealed by a mask, fills faded in) */
  hide?: SVGElement[]
  /** vermilion only while the job happens: these cool to ink / moss once it is done */
  hot?: SVGElement[]
}

const lateMasks = (lines: { m?: SVGPathElement }[]) => lines.map((l) => l.m).filter((m): m is SVGPathElement => !!m)
const kids = (g: SVGGElement) => [...g.children] as SVGElement[]

/** A low desk: one pressed-and-lifted stroke for the top, thin legs, a pool of shadow. Width varies per desk. */
function table(p: Pen, x0: number, x1: number) {
  const cx = (x0 + x1) / 2
  const hw = (x1 - x0) / 2
  p.wash(ell(cx, 169, hw + 6, 6.5), 0.11)
  p.line([[x0, 131.2], [x0 + hw * 0.45, 128.8], [x1 - hw * 0.5, 128.3], [x1, 130.8]], 6, { a: 0.09, b: 0.13, min: 0.28, wob: 0.09 })
  p.line([[x0 + 10, 137.5], [x1 - 12, 138.4]], 1.3, { a: 0.2, b: 0.2, min: 0.3, cls: 'k3' })
  p.line([[x0 + 20, 133], [x0 + 17.5, 168]], 4, { a: 0.04, b: 0.55, min: 0.3, cls: 'k2' })
  p.line([[x1 - 20, 133], [x1 - 17, 168]], 4, { a: 0.04, b: 0.55, min: 0.3, cls: 'k2' })
}
export const TABLE: Record<DeskId, [number, number]> = { text: [20, 220], image: [36, 210], video: [26, 214], '3d': [48, 194], voice: [64, 176], agent: [22, 220] }

// ───────── Chữ · LLM: a writing slope, three lines of handwriting and a tiny bar chart ─────────
function textDesk(p: Pen): Build {
  p.solid(rrD(28, 121, 28, 7, 3), 'm2')
  p.solid(ell(42, 122.6, 8, 1.8), 'k')
  p.line([[150, 52], [170, 127]], 2.6, { cls: 'k2', a: 0.05, b: 0.1 })
  const sheet: Pt[] = [[66, 58], [150, 50], [157, 122], [70, 126]]
  p.solid(poly(sheet), 'card')
  p.solid(poly([[66, 58], [150, 50], [151, 59], [67, 67]]), 'shade')
  p.line([...sheet, [66, 58], [74, 57.3]], 2.2, { a: 0.04, b: 0.04, min: 0.6, straight: true })
  // the sheet leans back: lines follow its top edge
  const sk = (pts: Pt[]) => pts.map(([x, y]) => [x + (y - 58) * 0.05, y - (x - 66) * 0.095] as Pt)
  for (let i = 0; i < 4; i++) p.line(sk([[76, 79 + i * 12], [146, 79 + i * 12]]), 0.6, { a: 0.1, b: 0.1, min: 0.5, wob: 0, straight: true, cls: 'k3' })
  // the writing has its own layer: the ruled lines' masks must not reveal it before the job
  p.sub()
  const lines = [0, 1, 2].map((i) =>
    p.line(sk(cursive(78, 75 + i * 12, i === 2 ? 112 : 142 - i * 6, 3.4, i * 2.3)), 1.7, { a: 0.04, b: 0.18, min: 0.45, wob: 0.25, late: true }))
  const bars = ([[122, 7], [131, 12], [140, 18]] as const).map(([x, hh], i) =>
    p.line(sk([[x, 117], [x, 117 - hh]]), 5, { a: 0, b: 0, min: 1, wob: 0, straight: true, late: true, cls: i === 2 ? 'v' : 'k2' }))
  // two brushes standing in a pot: their own layer, so they can sway
  const brushes = p.sub()
  p.line([[181, 104], [172, 60]], 3, { a: 0, b: 0, min: 1, wob: 0, straight: true, cls: 'k2' })
  p.line([[172, 61], [170, 47]], 4.4, { a: 0.05, b: 0.95, min: 0.08, straight: true })
  p.line([[190, 104], [198, 66]], 3, { a: 0, b: 0, min: 1, wob: 0, straight: true, cls: 'k2' })
  p.line([[198, 67], [200, 54]], 4, { a: 0.05, b: 0.95, min: 0.08, straight: true })
  p.sub()
  p.solid('M174 103 L176.5 127 Q186 130 195.5 127 L198 103 Z', 'm')
  p.solid(ell(186, 103, 12, 3), 'm2')
  p.back()
  const ms = lateMasks([...lines, ...bars])
  return {
    hide: ms,
    hot: [bars[2].el],
    job(tl) {
      lines.forEach((l, i) => tl.fromTo(l.m!, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.6, ease: 'power1.inOut' }, i * 0.5))
      bars.forEach((b, i) => tl.fromTo(b.m!, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.35, ease: 'power2.out' }, 1.5 + i * 0.18))
    },
    idle(tl) {
      tl.set(brushes, { svgOrigin: '186 106' })
      tl.to(brushes, { keyframes: [{ rotation: 2.6, duration: 1.3 }, { rotation: -1.4, duration: 1.4 }, { rotation: 0, duration: 1.2 }], ease: 'sine.inOut' })
    },
  }
}

// ───────── AI ảnh: a table easel, a painting that appears, a small camera ─────────
function imageDesk(p: Pen): Build {
  p.line([[121, 40], [124, 127]], 2, { cls: 'k3', straight: true, a: 0.05, b: 0.05 })
  p.line([[97, 127], [114, 30]], 3.2, { a: 0.04, b: 0.1, min: 0.6, straight: true, cls: 'k2' })
  p.line([[145, 127], [128, 30]], 3.2, { a: 0.04, b: 0.1, min: 0.6, straight: true, cls: 'k2' })
  // the canvas stands in front of the easel legs, the painting in front of the canvas
  p.sub()
  p.solid(rrD(80, 36, 78, 64, 2), 'card')
  p.line(rrPts(80, 36, 78, 64, 2), 2.2, { a: 0.03, b: 0.03, min: 0.6 })
  p.line([[83, 103.5], [157, 103.5]], 4.4, { a: 0.04, b: 0.06, min: 0.6 })
  p.sub()
  const far = p.wash(poly([[83, 97], [95, 77], [104, 84], [119, 63], [133, 78], [141, 74], [155, 97]]), 0.2)
  const near = p.wash(poly([[83, 98], [101, 89], [119, 93], [137, 86], [155, 91], [155, 98]]), 0.5)
  const sun = p.solid(ell(140, 53, 6.5), 'v')
  const ridge = p.line([[84, 96], [95, 78], [104, 85], [119, 64], [133, 79], [141, 75], [154, 95]], 1.8, { a: 0.1, b: 0.25, min: 0.3, late: true })
  const mist = p.line([[90, 87], [112, 85], [130, 87]], 1.2, { a: 0.3, b: 0.4, min: 0.2, late: true, cls: 'k3' })
  p.back()
  // camera
  p.solid(rrD(168, 107, 38, 21, 4), 'm')
  p.solid(rrD(176, 101, 13, 7, 2), 'm')
  p.solid(ell(188, 117.5, 8.2), 'card')
  p.solid(ell(188, 117.5, 4.8), 'm2')
  p.solid(ell(199, 111, 1.6), 'card')
  p.line([[172, 109.5], [202, 109.5]], 1, { a: 0.2, b: 0.3, min: 0.3, cls: 'hl' })
  const glint = p.top(s('path', { class: 't11-glint', d: ell(185.6, 115.4, 2.1, 1.3), opacity: 0 }))
  const rays = ([[-60, 9, 15], [-90, 9, 16], [-120, 9, 15]] as const).map(([a, r0, r1]) => {
    const t = (a * Math.PI) / 180
    return p.line([[182.5 + Math.cos(t) * r0, 101 + Math.sin(t) * r0], [182.5 + Math.cos(t) * r1, 101 + Math.sin(t) * r1]], 1.6, { a: 0.2, b: 0.6, min: 0.3, straight: true, late: true, cls: 'v' })
  })
  const fills = [far, near, sun]
  return {
    hide: [...fills, ...lateMasks([ridge, mist, ...rays])],
    hot: [sun],
    job(tl) {
      rays.forEach((r) => tl.fromTo(r.m!, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.18 }, 0))
      tl.fromTo(rays.map((r) => r.el), { opacity: 1 }, { opacity: 0, duration: 0.5 }, 0.35)
      tl.fromTo(ridge.m!, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.9, ease: 'power1.inOut' }, 0.3)
      tl.fromTo(far, { opacity: 0 }, { opacity: 1, duration: 0.9 }, 0.8)
      tl.fromTo(near, { opacity: 0 }, { opacity: 1, duration: 0.9 }, 1.05)
      tl.fromTo(mist.m!, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.6 }, 1.3)
      tl.set(sun, { svgOrigin: '140 53' }, 0)
      tl.fromTo(sun, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.9, ease: 'back.out(2.2)' }, 1.5)
    },
    idle(tl) {
      // light slides across the lens
      tl.fromTo(glint, { opacity: 0, x: -1.5 }, { opacity: 0.9, x: 0.5, duration: 0.9, ease: 'sine.out' })
      tl.to(glint, { opacity: 0, x: 2, duration: 1.4, ease: 'sine.in' })
    },
  }
}

// ───────── AI video: an old film camera, reels that turn, a beam of light ─────────
function videoDesk(p: Pen): Build {
  const beam = p.wash(poly([[178, 95], [228, 72], [228, 132], [178, 109]]), 0.13)
  p.solid(rrD(76, 80, 80, 45, 5), 'm')
  p.line([[84, 89], [148, 89]], 1.2, { cls: 'hl', a: 0.1, b: 0.1 })
  p.line([[86, 116], [126, 116.6]], 1.6, { cls: 'hl', a: 0.3, b: 0.5, min: 0.2 })
  p.line([[134, 98], [134, 117]], 1, { cls: 'hl', a: 0.3, b: 0.3, min: 0.3 })
  p.solid(poly([[155, 93], [176, 86], [176, 118], [155, 111]]), 'm')
  p.solid(ell(177, 102, 3.4, 16.5), 'm2')
  p.line([[77, 101], [66, 105], [64, 114]], 2.6, { a: 0.05, b: 0.3 })
  p.solid(ell(64, 115, 2.6), 'k')
  const reel = (cx: number, cy: number, r: number) => {
    const g = p.sub()
    p.solid(ell(cx, cy, r), 'm2')
    for (let k = 0; k < 3; k++) {
      const a = (k * 2 * Math.PI) / 3 - Math.PI / 2
      p.solid(ell(cx + Math.cos(a) * r * 0.52, cy + Math.sin(a) * r * 0.52, r * 0.24), 'p')
    }
    p.solid(ell(cx, cy, r * 0.13), 'p')
    p.line(arc(cx, cy, r, r, -80, 290, 30), 2, { a: 0.06, b: 0.1, min: 0.5 })
    p.back()
    return { g, o: `${cx} ${cy}` }
  }
  const reels = [reel(99, 62, 17), reel(138, 57, 22)]
  // little frames streaming out in the beam
  const frames = [0, 1, 2].map((i) => p.top(s('rect', { class: 't11-frame', x: 184 + i * 13, y: 96 - i * 3.2, width: 9, height: 12 + i * 3.4, rx: 1 })))
  return {
    hide: [beam, ...frames],
    job(tl) {
      reels.forEach((r, i) => {
        tl.set(r.g, { rotation: 0, svgOrigin: r.o }, 0)
        tl.to(r.g, { rotation: i ? 300 : 420, duration: 2.6, ease: 'power2.inOut' }, 0)
      })
      tl.fromTo(beam, { opacity: 0 }, { opacity: 1, duration: 0.6 }, 0.3)
      frames.forEach((f, i) => tl.fromTo(f, { opacity: 0, x: -10 }, { opacity: 0.85, x: 0, duration: 0.5, repeat: 1, yoyo: true, repeatDelay: 0.5 }, 0.5 + i * 0.22))
      tl.to(beam, { opacity: 0.35, duration: 0.8 }, 2.2)
    },
    idle(tl) {
      // the reels creep on a little (their inner layers turn, so the job's own spin is untouched)
      reels.forEach((r, i) => tl.to(kids(r.g), { rotation: `+=${i ? 34 : 46}`, svgOrigin: r.o, duration: 3.2, ease: 'power1.inOut' }, 0))
    },
  }
}

// ───────── AI 3D: a turntable, a wireframe serum bottle that spins and then gets its surface ─────────
const R3 = (y: number) =>
  y >= 72 ? 21 :
  y >= 62 ? 9 + 12 * (0.5 - 0.5 * Math.cos(((y - 62) / 10) * Math.PI)) :
  y >= 54 ? 9 :
  y >= 46 ? 11 :
  8 * Math.sqrt(Math.max(0, 1 - ((y - 40) / 14) ** 2))
function threeDesk(p: Pen): Build {
  p.solid('M70 121v5a50 8 0 0 0 100 0v-5Z', 'm')
  p.solid(ell(120, 121, 50, 8), 'st')
  p.line(arc(120, 121, 50, 8, -5, 360, 40), 1.6, { a: 0.05, b: 0.05, min: 0.5 })
  const ys: number[] = []
  for (let y = 117; y >= 26; y -= 1.5) ys.push(y)
  const left = ys.map((y) => [120 - R3(y), y] as Pt)
  const right = ys.map((y) => [120 + R3(y), y] as Pt)
  const skin = p.solid(`M${left.map((q) => q.join(' ')).join('L')}L${[...right].reverse().map((q) => q.join(' ')).join('L')}Z`, 'skin')
  const shade = p.solid(`M120 117L${right.map((q) => q.join(' ')).join('L')}L120 26Z`, 'shade')
  p.line(left, 2, { a: 0.03, b: 0.03, min: 0.5 })
  p.line(right, 2, { a: 0.03, b: 0.03, min: 0.5 })
  // wireframe: crisp thin lines, re-drawn as the turntable turns
  const wire = p.top(s('g', { class: 't11-wire' }))
  const rings = [114, 102, 90, 78, 67, 59, 50, 41, 32].map((y) => s('ellipse', { cx: 120, cy: y, rx: R3(y), ry: R3(y) * 0.2 }))
  const N = 10
  const mers = Array.from({ length: N }, () => s('path'))
  wire.append(...rings, ...mers)
  const turn = { phi: 0.25 }
  const ysM = ys.filter((_, i) => i % 2 === 0) // paint runs every frame of a turn
  const paint = () => {
    mers.forEach((m, k) => {
      const th = turn.phi + (k * 2 * Math.PI) / N
      const c = Math.cos(th)
      m.setAttribute('d', `M${ysM.map((y) => `${(120 + R3(y) * Math.sin(th)).toFixed(1)} ${(y + R3(y) * 0.2 * c).toFixed(1)}`).join('L')}`)
      m.setAttribute('stroke-opacity', (c > 0 ? 0.35 + 0.5 * c : 0.14).toFixed(2))
    })
  }
  paint()
  return {
    hide: [skin, shade],
    job(tl) {
      tl.set(wire, { opacity: 1 }, 0)
      tl.set([skin, shade], { opacity: 0 }, 0)
      tl.to(turn, { phi: `+=${Math.PI * 2}`, duration: 2.6, ease: 'power2.inOut', onUpdate: paint }, 0)
      tl.to([skin, shade], { opacity: 1, duration: 1.1, ease: 'power1.out' }, 1.9)
      tl.to(wire, { opacity: 0.3, duration: 1.1 }, 1.9)
    },
    idle(tl) {
      // one meridian's worth of turn: the cage looks the same after, so it never jumps
      tl.to(turn, { phi: `+=${(Math.PI * 2) / N}`, duration: 3, ease: 'power1.inOut', onUpdate: paint })
    },
  }
}

// ───────── Giọng nói: a studio microphone, sound rippling out like water ─────────
function voiceDesk(p: Pen): Build {
  p.solid(ell(120, 126, 25, 3.8), 'm')
  p.line([[120, 124], [120, 93]], 4, { a: 0.02, b: 0.02, min: 0.8, straight: true })
  p.line(arc(120, 60, 19, 31, 182, -2, 20), 3, { a: 0.08, b: 0.08, min: 0.6 })
  p.solid(rrD(106, 26, 28, 58, 14), 'card')
  for (let y = 36; y <= 76; y += 5) {
    const dy = y < 40 ? 40 - y : y > 70 ? y - 70 : 0
    const hw = Math.sqrt(Math.max(0, 14 * 14 - dy * dy)) - 3.5
    if (y < 52 || y > 60) p.line([[120 - hw, y], [120 + hw, y]], 1, { a: 0.1, b: 0.1, min: 0.6, straight: true, cls: 'k3' })
  }
  p.solid(rrD(106, 53, 28, 6, 1), 'm2')
  p.line(rrPts(106, 26, 28, 58, 14), 2.6, { a: 0.03, b: 0.03, min: 0.6 })
  p.sub()
  const waves = [0, 1, 2].map((k) => {
    const r = 28 + k * 12
    return [
      p.line(arc(120, 55, r, r, -34, 34, 12), 2.6 - k * 0.5, { a: 0.3, b: 0.3, min: 0.15, late: true, cls: k ? 'k2' : 'v' }),
      p.line(arc(120, 55, r, r, 214, 146, 12), 2.6 - k * 0.5, { a: 0.3, b: 0.3, min: 0.15, late: true, cls: k ? 'k2' : 'v' }),
    ]
  })
  p.back()
  // a breath of sound, close to the grille (idle only)
  const breath = p.top(s('g', { class: 't11-breath', opacity: 0 },
    s('path', { d: brush(arc(120, 55, 22, 22, -26, 26, 10), 1.3, { a: 0.3, b: 0.3, min: 0.2 }).d }),
    s('path', { d: brush(arc(120, 55, 22, 22, 206, 154, 10), 1.3, { a: 0.3, b: 0.3, min: 0.2 }).d })))
  return {
    hide: lateMasks(waves.flat()),
    hot: waves[0].map((w) => w.el),
    job(tl) {
      for (let rep = 0; rep < 2; rep++)
        waves.forEach((pair, k) => {
          const t = rep * 1.2 + k * 0.22
          tl.fromTo(pair.map((w) => w.m!), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.4, ease: 'power2.out' }, t)
          tl.fromTo(pair.map((w) => w.el), { opacity: 1 }, { opacity: rep ? 1 : 0, duration: 0.6 }, t + 0.45)
        })
    },
    idle(tl) {
      tl.set(breath, { svgOrigin: '120 55' })
      tl.fromTo(breath, { opacity: 0, scale: 0.86 }, { opacity: 0.7, scale: 1, duration: 1, ease: 'sine.out' })
      tl.to(breath, { opacity: 0, scale: 1.2, duration: 1.6, ease: 'sine.in' })
    },
  }
}

// ───────── Agent: a calendar, an envelope, and a paper crane that goes and does the job ─────────
function agentDesk(p: Pen): Build {
  p.top(s('path', { class: 't11-route', d: 'M76 66 Q128 4 172 92' }))
  p.solid(rrD(52, 74, 46, 52, 3), 'card')
  p.solid(rrD(52, 74, 46, 12, 3), 'm2')
  p.line(rrPts(52, 74, 46, 52, 3), 2, { a: 0.03, b: 0.03, min: 0.6 })
  p.line([[63, 68], [63, 80]], 2.6, { a: 0.05, b: 0.05, min: 0.7, straight: true })
  p.line([[87, 68], [87, 80]], 2.6, { a: 0.05, b: 0.05, min: 0.7, straight: true })
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) p.solid(ell(62 + c * 13, 96 + r * 10, 1.7), 'k3')
  p.sub()
  const tick = p.line([[69, 104], [74, 110], [85, 94]], 3, { a: 0.1, b: 0.45, min: 0.3, late: true, cls: 'v' })
  const env = p.sub()
  p.solid(rrD(148, 98, 48, 29, 2), 'card')
  p.line(rrPts(148, 98, 48, 29, 2), 2, { a: 0.03, b: 0.03, min: 0.6 })
  p.line([[149, 99.5], [172, 115], [195, 99.5]], 1.6, { a: 0.1, b: 0.1, min: 0.6 })
  p.back()
  // origami crane, resting above the table
  const crane = p.sub()
  const facet = (pts: Pt[], cls: string, w = 1.3) => {
    p.solid(poly(pts), cls)
    p.line([...pts, pts[0]], w, { a: 0.02, b: 0.02, min: 0.7, straight: true })
  }
  facet([[124, 58], [138, 27], [134, 60]], 'st')
  facet([[134, 61], [153, 44], [131, 58]], 'card')
  facet([[109, 62], [123, 54], [139, 62], [123, 68]], 'card')
  facet([[112, 61], [95, 42], [118, 59]], 'card')
  facet([[95, 42], [89, 47], [97, 45]], 'k', 1)
  facet([[117, 61], [101, 23], [130, 58]], 'card', 1.5)
  p.solid(poly([[117, 61], [108, 42], [124, 59]]), 'shade')
  p.back()
  return {
    hide: lateMasks([tick]),
    hot: [tick.el],
    job(tl) {
      tl.set(crane, { x: 0, y: 0, rotation: 0, svgOrigin: '122 58' }, 0)
      tl.to(crane, { keyframes: [
        { x: -8, y: -8, rotation: -6, duration: 0.35, ease: 'power2.out' },
        { x: -46, y: -6, rotation: 4, duration: 0.6, ease: 'power1.inOut' },
        { x: 6, y: -34, rotation: -4, duration: 0.6, ease: 'power1.inOut', delay: 0.25 },
        { x: 50, y: 6, rotation: 8, duration: 0.55, ease: 'power1.inOut' },
        { x: 0, y: 0, rotation: 0, duration: 0.8, ease: 'power2.inOut', delay: 0.5 },
      ] }, 0)
      tl.fromTo(tick.m!, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.4 }, 0.95)
      tl.set(env, { x: 0, y: 0, opacity: 1 }, 0)
      tl.to(env, { x: 34, y: -26, opacity: 0, duration: 0.6, ease: 'power2.in' }, 2.4)
      tl.set(env, { x: 0, y: 8 }, 3.05)
      tl.to(env, { y: 0, opacity: 1, duration: 0.7, ease: 'power2.out' }, 3.1)
    },
    idle(tl) {
      // the crane breathes: wings lift a hair, then settle (inner layers, so the job's flight is untouched)
      tl.to(kids(crane), { y: -2.4, rotation: -2.5, svgOrigin: '122 64', duration: 1.4, ease: 'sine.inOut', yoyo: true, repeat: 1 })
    },
  }
}

const BUILD: Record<DeskId, (p: Pen) => Build> = { text: textDesk, image: imageDesk, video: videoDesk, '3d': threeDesk, voice: voiceDesk, agent: agentDesk }

/** lite (quality 'low'): one ink filter on the whole desk instead of one per layer. */
export function makeDesk(id: DeskId, reduced: boolean, opts: { lite?: boolean } = {}): Desk {
  const p = new Pen(true, opts.lite ? 'root' : 'full')
  table(p, ...TABLE[id])
  const b = BUILD[id](p)
  const svg = s('svg', { class: 't11-dsvg', viewBox: '0 0 240 180', 'aria-hidden': 'true', focusable: 'false' }, p.root)
  for (const el of b.hide ?? []) {
    if (el.classList.contains('v-m')) el.style.strokeDashoffset = '1'
    else el.style.opacity = '0'
  }
  const hot = b.hot ?? []
  let cur: TL | null = null
  let still: TL | null = null
  return {
    svg,
    draw(tl, at = 0, total = 1.6) {
      if (reduced) return at
      return drawIn(p, tl, total, at)
    },
    work() {
      cur?.progress(1).kill()
      still?.progress(1).kill()
      still = null
      hot.forEach((e) => e.classList.remove('cool'))
      const tl = gsap.timeline()
      b.job(tl)
      if (reduced) {
        tl.progress(1).kill()
        hot.forEach((e) => e.classList.add('cool'))
      } else tl.call(() => hot.forEach((e) => e.classList.add('cool')), undefined, '+=0.5')
      cur = tl
    },
    idle() {
      if (reduced || !b.idle || cur?.isActive()) return null
      still?.progress(1).kill()
      still = gsap.timeline()
      b.idle(still)
      return still
    },
  }
}

/** Small ink glyph of a desk's object, without the table (for tabs). */
export function deskGlyph(id: DeskId): SVGSVGElement {
  // a quiet copy (one filter for the whole picture) showing the finished work: nothing hidden, no job
  const p = new Pen(true, 'root')
  const b = BUILD[id](p)
  b.hot?.forEach((e) => e.classList.add('cool'))
  return s('svg', { class: 't11-glyph', viewBox: '40 18 170 116', 'aria-hidden': 'true', focusable: 'false' }, p.root)
}
