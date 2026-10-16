import './current.css'
import { fill, h, s } from '../../core/dom'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import { blob, clamp, curve, rng, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist, moon, pine, reeds, ridge } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import C from '../../content/tram-25.json'
import { P as PT, broken, offset, smooth } from './kit'
import { F, ambient, f1, frame, lerp, project, sstep, tokens } from './art'

const K = C.scenes.current
const A0 = 72 // surface tilt (deg from facing us): slanting, from the bank …
const A1 = 18 // … looking straight down into the water
const TW = 192 // fibre tile width (plane px)
const P_SHORT = [0.12, 0.45, 0.85] // illustration only: chance a boat takes the shortcut, by lever notch

// The stream as it should look in the slanting view (shares of the art box), back-projected onto the plane at layout.
// landscape: 3/4 from the bank, flowing left → right · portrait: standing at the source, looking downstream
const PATHS = {
  land: {
    hero: [0.31, 0.68] as Pt,
    head: [[-0.04, 0.97], [0.1, 0.84], [0.2, 0.74], [0.31, 0.68], [0.44, 0.62]] as Pt[],
    long: [[0.44, 0.62], [0.41, 0.53], [0.45, 0.465], [0.54, 0.425], [0.64, 0.4], [0.72, 0.375], [0.79, 0.36], [0.85, 0.35]] as Pt[],
    short: [[0.44, 0.62], [0.56, 0.655], [0.68, 0.665], [0.78, 0.635], [0.86, 0.595]] as Pt[],
  },
  tall: {
    hero: [0.5, 0.8] as Pt,
    head: [[0.44, 1.12], [0.52, 0.95], [0.49, 0.82], [0.5, 0.72]] as Pt[],
    long: [[0.5, 0.72], [0.37, 0.65], [0.29, 0.57], [0.38, 0.49], [0.28, 0.43], [0.2, 0.385], [0.16, 0.355]] as Pt[],
    short: [[0.5, 0.72], [0.62, 0.64], [0.7, 0.55], [0.75, 0.46], [0.79, 0.4]] as Pt[],
  },
}

/** Schlick's Fresnel reflectance for water (F0 ≈ 0.02) at a view angle of `deg` from the surface normal. */
const schlick = (deg: number) => 0.02 + 0.98 * Math.pow(1 - Math.cos((deg * Math.PI) / 180), 5)

type Along = { len: number; at(d: number): [number, number, number] }
function along(pts: Pt[]): Along {
  const L = [0]
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  const len = L[L.length - 1]
  return {
    len,
    at(d) {
      d = clamp(d, 0, len)
      let i = 1
      while (i < L.length - 1 && L[i] < d) i++
      const t = (d - L[i - 1]) / (L[i] - L[i - 1] || 1)
      const [a, b] = [pts[i - 1], pts[i]]
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[1] - a[1], b[0] - a[0])]
    },
  }
}

/** A paper boat side on, standing on y = 0 (about 32 × 20 at k = 1); the hero's sail is a paper sheet of its own. */
function boatSide(k: number, sail = true): SVGElement[] {
  const P = (x: number, y: number) => `${f1(x * k)} ${f1(y * k)}`
  return ([
    s('path', { class: 't25c-paper', d: `M${P(-15, -6)}L${P(-10, 0)}L${P(10, 0)}L${P(15, -6)}Z` }),
    s('path', { class: 't25c-paper2', d: `M${P(-15, -6)}L${P(-10, 0)}L${P(-5, -6)}ZM${P(15, -6)}L${P(10, 0)}L${P(5, -6)}Z` }),
    sail ? s('path', { class: 't25c-paper', d: `M${P(-7, -6)}L${P(0, -19)}L${P(7, -6)}Z` }) : null,
    s('path', { class: 't25c-fold', d: `M${P(-15, -6)}L${P(-10, 0)}L${P(10, 0)}L${P(15, -6)}Z${sail ? `M${P(-7, -6)}L${P(0, -19)}L${P(7, -6)}M${P(0, -18)}L${P(0, -6)}` : ''}` }),
  ] as (SVGElement | null)[]).filter((e): e is SVGElement => !!e)
}
/**
 * The same boat seen from straight above, bow along +x, centred on 0, 0: a long folded hull, its two side flaps (one
 * in shade), the sail's ridge down the middle catching the moon, and a soft shadow on the water.
 */
function boatTop(k: number): SVGElement[] {
  const P = (x: number, y: number) => `${f1(x * k)} ${f1(y * k)}`
  return [
    s('path', { class: 't25c-boat-sh', d: `M${P(-14, 3)}L${P(-6, -2)}L${P(9, -2)}L${P(18, 3)}L${P(9, 8)}L${P(-6, 8)}Z` }),
    s('path', { class: 't25c-paper', d: `M${P(-16, 0)}L${P(-8, -5)}L${P(8, -5)}L${P(16, 0)}L${P(8, 5)}L${P(-8, 5)}Z` }),
    s('path', { class: 't25c-paper2', d: `M${P(-16, 0)}L${P(-8, 5)}L${P(8, 5)}L${P(16, 0)}Z` }),
    s('path', { class: 't25c-ridge', d: `M${P(-7, 0)}L${P(0, -1.6)}L${P(7, 0)}L${P(0, 1.6)}Z` }),
    s('path', { class: 't25c-fold', d: `M${P(-16, 0)}L${P(16, 0)}M${P(-8, -5)}L${P(-4, 0)}L${P(-8, 5)}M${P(8, -5)}L${P(4, 0)}L${P(8, 5)}` }),
  ]
}

/** The stone lantern's head above its post (viewBox −42 −66 84 68, the post starts at y = 0): roof, fire box, glow. */
function lanternHead(): SVGElement[] {
  return [
    s('ellipse', { class: 't25c-lglow', cx: 0, cy: -24, rx: 40, ry: 30, fill: 'url(#t25c-lglow)' }),
    // the roof: lit top, a dark eave underneath, upturned corners; the jewel on top
    s('path', { class: 't25c-roof', d: 'M-38 -40Q-22 -44 -8 -56L0 -60L8 -56Q22 -44 38 -40Q34 -37 28 -38L-28 -38Q-34 -37 -38 -40Z', fill: 'url(#p2-rock)' }),
    s('path', { class: 't25c-eave', d: 'M-30 -38L30 -38L26 -34L-26 -34Z' }),
    s('path', { class: 't25c-roof', d: 'M-4 -59Q-6 -63 0 -66Q6 -63 4 -59Z', fill: 'url(#p2-rock)' }),
    s('path', { class: 't25c-roofrim', d: 'M2 -59.5L9 -55.5Q22 -44 37 -40.4', fill: 'none' }),
    // the fire box: stone frame, a warm paper window, a cap below
    s('path', { class: 't25c-box', d: 'M-16 -34L16 -34L15 -8L-15 -8Z' }),
    s('path', { class: 't25c-boxdk', d: 'M-16 -34L-8 -34L-8 -8L-15 -8Z' }),
    s('path', { class: 't25c-win', d: 'M-7 -30L8 -30L8 -12L-7 -12Z' }),
    s('path', { class: 't25c-winbar', d: 'M0.5 -30L0.5 -12M-7 -21L8 -21', fill: 'none' }),
    s('path', { class: 't25c-box', d: 'M-20 -8L20 -8L18 0L-18 0Z' }),
    s('path', { class: 't25c-boxdk', d: 'M-20 -8L-10 -8L-9 0L-18 0Z' }),
  ]
}

/** A seamless tile of ink fibres along the flow (x wraps), on a clear ground; `rough` = the desperate current. */
function fibreTile(color: string, rough: boolean, seed: number, done: (url: string) => void) {
  const TH = 64, D = 2
  const c = document.createElement('canvas')
  c.width = TW * D
  c.height = TH * D
  const g = c.getContext('2d')!
  g.scale(D, D)
  g.strokeStyle = g.fillStyle = color
  g.lineCap = 'round'
  const r = rng(seed)
  for (let i = 0; i < (rough ? 30 : 20); i++) {
    const y0 = TH * (0.14 + r() * 0.72)
    const k1 = 1 + Math.floor(r() * 2), k2 = 2 + Math.floor(r() * 3) // whole waves per tile: it repeats seamlessly
    const a1 = (rough ? 5 : 1.8) * (0.4 + r()), a2 = (rough ? 2.6 : 0.7) * r()
    const p1 = r() * 6.28, p2 = r() * 6.28
    const t0 = r(), span = 0.3 + r() * 0.6, w = 0.5 + r() * (rough ? 2 : 1.4)
    g.globalAlpha = 0.2 + r() * 0.55
    const y = (t: number) => y0 + a1 * Math.sin(6.2832 * k1 * t + p1) + a2 * Math.sin(6.2832 * k2 * t + p2)
    const steps = Math.round(56 * span)
    for (let j = 0; j < steps; j++) {
      const ta = t0 + j / 56, tb = ta + 1 / 56
      g.lineWidth = w * (0.25 + 0.75 * Math.sin((Math.PI * (j + 0.5)) / steps))
      for (const sh of [0, -TW]) {
        const xa = (ta % 1) * TW + sh
        g.beginPath()
        g.moveTo(xa, y(ta))
        g.lineTo(xa + TW / 56, y(tb))
        g.stroke()
      }
    }
  }
  for (let i = 0; i < (rough ? 70 : 40); i++) { // silt riding the current
    g.globalAlpha = 0.15 + r() * 0.4
    g.beginPath()
    g.arc(r() * TW, TH * (0.1 + r() * 0.8), 0.4 + r() * 0.9, 0, 6.2832)
    g.fill()
  }
  c.toBlob((b) => b && done(URL.createObjectURL(b)))
}

/** A spiral of dry ink: the desperate eddy turning under the boat. */
function swirl(R: number, seed: number): string {
  const r = rng(seed)
  let d = ''
  for (let arm = 0; arm < 6; arm++) {
    const pts: Pt[] = []
    const a0 = (arm / 6) * Math.PI * 2 + r() * 0.4, R0 = R * (0.55 + r() * 0.45)
    for (let i = 0; i <= 22; i++) {
      const t = i / 22, rr = R0 * (1 - t * 0.9), a = a0 + t * Math.PI * (2.2 + r() * 0.4)
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.92])
    }
    d += stroke(pts, R * (0.05 + r() * 0.06), 0.05, 0.6, 0.15)
  }
  return d
}

interface Geo {
  W: number
  H: number
  land: boolean
  P: number
  PW: number
  PD: number
  piv: Pt
  sx: number
  sy: number
  px: number
  py: number
  ww: number
  head: Pt[]
  lg: Pt[]
  sh: Pt[]
  rides: [Along, Along] // source → long landing, source → short landing
  landing: [Pt, Pt]
  /** plane point (element px) under a spot of the slanting view given in shares of the art box */
  at: (u: number, v: number) => Pt
  moon: Pt
}

function plan(W: number, H: number): Geo {
  const land = W / H > 1.05
  const D = land ? PATHS.land : PATHS.tall
  // camera: principal point mid-frame, a fairly wide lens so the 3/4 view keeps its horizon (≈ 21% down) in frame
  const P = H * (land ? 0.9 : 0.95), px = W / 2, py = H * 0.5
  const sx = D.hero[0] * W, sy = D.hero[1] * H
  const ra = (A0 * Math.PI) / 180, ca = Math.cos(ra), sa = Math.sin(ra)
  // screen → plane (relative to the hero spot) in the slanting view: the inverse of project()
  const un = ([u, v]: Pt): Pt => {
    const ys = Math.max(v * H, py - P / Math.tan(ra) + H * 0.04) // never past the horizon
    const y = ((ys - sy) * P) / (P * ca + (ys - py) * sa)
    const k = P / (P - y * sa)
    return [(u * W - px) / k - (sx - px), y]
  }
  const rel = { head: smooth(D.head).map(un), lg: smooth(D.long).map(un), sh: smooth(D.short).map(un) }
  const ww = land ? Math.max(70, W * 0.085) : Math.max(56, W * 0.22)
  // the plane: the stream plus a margin of bank (kept small: every px of it is rasterised)
  const all = [...rel.head, ...rel.lg, ...rel.sh]
  const x0 = Math.min(...all.map((p) => p[0])) - ww * 2.6, x1 = Math.max(...all.map((p) => p[0])) + ww * 2.6
  const y0 = Math.min(...all.map((p) => p[1])) - ww * 3.6, y1 = Math.max(...all.map((p) => p[1])) + ww * 1.6
  const E = (p: Pt): Pt => [p[0] - x0, p[1] - y0]
  const head = rel.head.map(E), lg = rel.lg.map(E), sh = rel.sh.map(E)
  const join = (b: Pt[]) => along([...head.slice(0, -2), ...b])
  const moonAt: Pt = land ? [W * 0.62, H * 0.1] : [W * 0.82, H * 0.075]
  return { W, H, land, P, PW: x1 - x0, PD: y1 - y0, piv: E([0, 0]), sx, sy, px, py, ww, head, lg, sh, rides: [join(lg), join(sh)], landing: [lg[lg.length - 1], sh[sh.length - 1]], at: (u, v) => E(un([u, v])), moon: moonAt }
}

/**
 * ★ Scene 2 — a moonlit stream splits round a reed bed: the long way to the lit lantern, the short way through the reeds.
 * The stream is one CSS-3D plane. Slanting, the water is a mirror of moon and calm words; tilted until we look straight
 * down, the mirror clears (Schlick's Fresnel curve) and the ink current shows. The lever sets the inner current; paper
 * boats choose their way. Words live in a screen layer pinned to the 3D things they belong to, so they always read.
 */
export function currentScene(ctx: SceneCtx) {
  const names = [K.calm, K.neutral, K.desperate]
  let mood = 1
  const seen = new Set<number>([1])
  const shown = [false, false]
  let a = A0, tgt = A0
  const piles: [number, number] = [0, 0]
  let G: Geo | null = null
  let first = true
  let job: { cancel(): void } | null = null
  let tiles: [string, string] = ['', '']
  const flows: Animation[][] = [[], [], []] // head (+ the eddy), long, short
  let live = false

  const back = s('svg', { class: 't25c-back', 'aria-hidden': 'true' })
  const plane = h('div', { class: 't25c-plane' })
  const view = h('div', { class: 't25c-view' }, plane)
  const near = s('svg', { class: 't25c-near', 'aria-hidden': 'true' })
  const tags = h('div', { class: 't25c-tags' })
  const tiltEl = h('div', { class: 't25c-tilt', role: 'slider', tabindex: '0', 'aria-label': K.tiltAria, 'aria-orientation': 'vertical', 'aria-valuemin': String(A1), 'aria-valuemax': String(A0) })
  const lever = h('div', { class: 't25c-lever', role: 'slider', tabindex: '0', 'aria-label': K.dialAria, 'aria-valuemin': '0', 'aria-valuemax': '2' })
  const note = h('div', { class: 't25c-note', hidden: true }, ctx.fact(F(K.illustration), 'p'))
  // the dial's name and the illustration note: a quiet caption up in the sky, off the stream and its banks
  const cap = h('div', { class: 't25c-cap' }, h('p', { class: 't25c-dial' }, K.dial), note)
  // the AI's calm sentence is written on the hero boat's paper sail
  const strip = h('div', { class: 't25c-strip' }, h('p', null, K.said))
  const calmNote = h('div', { class: 't25c-saidnote', 'aria-hidden': 'true' }, h('p', null, K.saidNote), h('p', { class: 'flip' }, K.saidNote))
  const hero = h('div', { class: 't25c-boat t25c-hero', role: 'img', 'aria-label': K.boat })
  // the other words live on things, in a screen layer pinned to them (so they always read): a wooden board on a stake
  // at the head of the stream, the stone lantern's post, paper flags on the bamboo stakes, two carved stone lintels.
  // ax / ay: which point of the element sits on its spot (0 … 1); flip: hangs to the left of its pole near the right edge
  type Pin = { el: HTMLElement; p: Pt; up: number; ax: number; ay: number; w: number; flip?: boolean }
  const pins: Pin[] = []
  const boardEl = h('div', { class: 't25c-board' }, h('p', null, K.task), h('i', { class: 't25c-stake' }))
  const lanternEl = h('div', { class: 't25c-lantern' },
    s('svg', { class: 't25c-lhead', viewBox: '-42 -66 84 68', 'aria-hidden': 'true' }, ...lanternHead()),
    h('p', { class: 't25c-post', 'aria-hidden': 'true' }, ...K.carefulPost.map((w) => h('span', null, w))),
    h('p', { class: 'visually-hidden' }, K.careful),
    h('i', { class: 't25c-plinth' }))
  const flagEls = K.shortcutFlags.map((w) => h('span', { class: 't25c-flag', 'aria-hidden': 'true' }, w))
  const lintels = [K.calm, K.desperate].map((w) => h('p', { class: 't25c-lintel' }, w))
  tags.append(boardEl, lanternEl, ...flagEls, h('p', { class: 'visually-hidden' }, K.shortcut), ...lintels)
  const boats: { el: HTMLElement; ride: 0 | 1; d: number; v: number }[] = []
  const parked: HTMLElement[][] = [[], []]
  let spawn = 0 // boats still to release
  let clock = 0

  const root = frame(ctx, 't25c', K.art, K.insights, layout)
  root.append(back, view, near, tags, tiltEl, cap)

  // the two fibre tiles are baked when the page is idle (one per idle slot), never on the mount path; again on theme change
  const ric = window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 120))
  const cic = window.cancelIdleCallback ?? window.clearTimeout
  let idle = 0
  let gone = false
  tokens(['wash', 'mist'] as const, ctx, (c) => {
    const col = document.documentElement.dataset.theme === 'dark' ? c.mist : c.wash
    const out: [string, string] = ['', '']
    const bake = (i: number) => (idle = ric(() => fibreTile(col, i === 1, 2551 + i, (u) => {
      if (gone) return URL.revokeObjectURL(u)
      out[i] = u
      if (i === 0) return bake(1)
      tiles.forEach((t) => t && URL.revokeObjectURL(t))
      tiles = out
      plane.style.setProperty('--t25c-calm', `url(${out[0]})`)
      plane.style.setProperty('--t25c-rough', `url(${out[1]})`)
    })))
    cic(idle)
    bake(0)
  })
  ctx.onCleanup(() => {
    gone = true
    cic(idle)
    tiles.forEach((t) => t && URL.revokeObjectURL(t))
    flows.forEach((l) => l.forEach((an) => an.cancel()))
  })

  // ── the lever (role=slider: ← → Home End; drag it sideways; a tap steps it on)
  function setMood(m: number) {
    m = clamp(Math.round(m), 0, 2)
    lever.setAttribute('aria-valuenow', String(m))
    lever.setAttribute('aria-valuetext', fill(K.valueText, { name: names[m] }))
    if (m === mood) return
    mood = m
    root.dataset.mood = String(m)
    rate()
    seen.add(m)
    note.hidden = false
    calmNote.classList.add('on')
    ctx.chime('tap')
    if (ctx.reduced || ctx.quality === 'low') {
      for (let i = 0; i < 6; i++) land(Math.random() < P_SHORT[m] ? 1 : 0)
    } else {
      spawn = 6
      clock = 1.2
      loop.start()
    }
    if (!shown[0] && seen.has(0) && seen.has(2)) {
      shown[0] = true
      ctx.insight(F(K.insights[0]), F(K.insights[0].detail))
    }
    check()
  }
  lever.addEventListener('keydown', (e) => {
    const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key]
    if (d) setMood(mood + d)
    else if (e.key === 'Home') setMood(0)
    else if (e.key === 'End') setMood(2)
    else return
    e.preventDefault()
  })
  let lg0: { x: number; m: number; id: number } | null = null
  lever.addEventListener('pointerdown', (e) => {
    e.stopPropagation()
    lever.setPointerCapture(e.pointerId)
    lg0 = { x: e.clientX, m: mood, id: e.pointerId }
  })
  lever.addEventListener('pointermove', (e) => lg0 && e.pointerId === lg0.id && setMood(lg0.m + (e.clientX - lg0.x) / 46))
  lever.addEventListener('pointerup', (e) => {
    if (lg0 && Math.abs(e.clientX - lg0.x) < 6) setMood(mood === 2 ? 0 : mood + 1)
    lg0 = null
  })
  lever.addEventListener('pointercancel', () => (lg0 = null))

  // ── the tilt (role=slider, vertical: ↓ looks further down; or drag up/down anywhere on the scene)
  const setTilt = (v: number, now = false) => {
    tgt = clamp(v, A1, A0)
    tiltEl.setAttribute('aria-valuenow', String(Math.round(tgt)))
    tiltEl.setAttribute('aria-valuetext', fill(K.tiltText, { n: Math.round(90 - tgt) }))
    if (now || ctx.reduced) {
      a = tgt
      apply()
      check()
    } else loop.start()
  }
  tiltEl.addEventListener('keydown', (e) => {
    const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key]
    if (d) setTilt(tgt + d * 8)
    else if (e.key === 'Home') setTilt(A1)
    else if (e.key === 'End') setTilt(A0)
    else return
    e.preventDefault()
  })
  const twoFrames = ctx.quality === 'low' || ctx.reduced
  let tg0: { y: number; a: number; id: number } | null = null
  root.addEventListener('pointerdown', (e) => {
    if ((e.target as Element).closest('.t25c-lever, .t25c-cap')) return
    tg0 = { y: e.clientY, a: tgt, id: e.pointerId }
    root.setPointerCapture(e.pointerId)
  })
  root.addEventListener('pointermove', (e) => tg0 && e.pointerId === tg0.id && setTilt(tg0.a - (e.clientY - tg0.y) * 0.22))
  const endTilt = () => {
    if (!tg0) return
    tg0 = null
    if (twoFrames) setTilt(tgt < (A0 + A1) / 2 ? A1 : A0) // low / reduced: two still views
  }
  root.addEventListener('pointerup', endTilt)
  root.addEventListener('pointercancel', endTilt)

  function check() {
    if (shown[1] || mood !== 2 || a > 36) return
    shown[1] = true
    ctx.insight(F(K.insights[1]), K.insights[1].detail)
    ctx.chime('soft')
  }

  // ── one loop: the tilt easing to its target (heavy, damped), boats drifting; it sleeps when both are done
  const loop = createLoop(root, (_t, dt) => {
    let busy = false
    if (Math.abs(tgt - a) > 0.05) {
      a += (tgt - a) * (dt > 0 ? 1 - Math.exp(-dt * 6) : 1)
      apply()
      busy = true
    } else if (a !== tgt) {
      a = tgt
      apply()
    }
    if (spawn > 0) {
      clock += dt
      if (clock >= 1.5) {
        clock = 0
        spawn--
        launch(Math.random() < P_SHORT[mood] ? 1 : 0)
      }
      busy = true
    }
    for (let i = boats.length - 1; i >= 0; i--) {
      const b = boats[i]
      b.d += b.v * dt
      if (b.d >= G!.rides[b.ride].len) {
        boats.splice(i, 1)
        b.el.remove()
        land(b.ride)
        continue
      }
      const [x, y, ang] = G!.rides[b.ride].at(b.d)
      b.el.style.transform = `translate3d(${f1(x)}px, ${f1(y)}px, 0)`
      b.el.style.setProperty('--ang', `${ang.toFixed(2)}rad`) // the top-view sprite points along the flow
      busy = true
    }
    check()
    return busy
  }, { essential: true })
  ctx.onCleanup(() => loop.dispose())

  /** A boat box on the plane, centred on its spot: the flat top view fills it, the side view stands on its middle line. */
  function boatEl(k: number, el = h('div', { class: 't25c-boat' }), sail = true) {
    const w = 34 * k, ht = 16 * k, hs = 22 * k
    Object.assign(el.style, { left: `${f1(-w / 2)}px`, top: `${f1(-ht / 2)}px`, width: `${f1(w)}px`, height: `${f1(ht)}px` })
    const side = s('svg', { class: 'side', viewBox: `${f1(-17 * k)} ${f1(-21 * k)} ${f1(w)} ${f1(hs)}`, width: f1(w), height: f1(hs), 'aria-hidden': 'true' }, ...boatSide(k, sail))
    side.style.top = `${f1(ht / 2 - hs)}px`
    el.replaceChildren(s('svg', { class: 'top', viewBox: `${f1(-17 * k)} ${f1(-8 * k)} ${f1(w)} ${f1(ht)}`, width: f1(w), height: f1(ht), 'aria-hidden': 'true' }, ...boatTop(k)), side)
    return el
  }
  function launch(ride: 0 | 1) {
    if (!G) return
    const el = boatEl(G.ww / 60)
    plane.append(el)
    boats.push({ el, ride, d: 0, v: G.ww * (ride ? 3.4 : 2.7) })
  }
  /** a boat comes in at its landing: they moor in rows, the oldest drifting off past nine */
  function land(ride: 0 | 1) {
    piles[ride]++
    if (!G) return
    const g = G
    const list = parked[ride]
    if (list.length >= 9) list.shift()!.remove()
    const el = boatEl(g.ww / 64)
    list.push(el)
    const path = ride ? g.sh : g.lg
    list.forEach((b, i) => {
      const n = list.length - 1 - i
      const p = offset(path.slice(-12 - Math.floor(n / 3) * 5, path.length - Math.floor(n / 3) * 5), ((n % 3) - 1) * g.ww * 0.28)
      const [x, y] = p[p.length - 1], [x0, y0] = p[p.length - 2]
      b.style.transform = `translate3d(${f1(x)}px, ${f1(y)}px, 0)`
      b.style.setProperty('--ang', `${Math.atan2(y - y0, x - x0).toFixed(2)}rad`)
    })
    plane.append(el)
  }
  function rate() {
    const sp = [[0.5, 1, 0.35], [0.6, 0.85, 0.45], [0.35, 0.6, 1.5]][mood]
    flows.forEach((list, i) => list.forEach((an) => (an.playbackRate = sp[i])))
  }

  // ── tilt → plane transform, Fresnel, the sky falling away, words following their things
  let o = { left: 0, top: 0, ox: 0, oy: 0 }
  function apply() {
    if (!G) return
    const g = G
    const rad = (a * Math.PI) / 180
    const down = (A0 - a) / (A0 - A1) // 0 slanting … 1 straight down
    const tz = -g.P * 0.25 * down
    plane.style.transform = `translateZ(${f1(tz)}px) rotateX(${a.toFixed(2)}deg)`
    // Schlick's curve between the two ends: a mirror when slanting, clear glass looking straight down
    const fr = clamp((schlick(a) - schlick(A1)) / (schlick(A0) - schlick(A1)), 0, 1)
    root.style.setProperty('--fres', (0.04 + 0.88 * fr).toFixed(3))
    // below about 35° the standing things and their words are gone: only the currents, the boats (seen from above), the eddy
    root.style.setProperty('--side', sstep(35, 52, a).toFixed(3))
    root.style.setProperty('--sky', sstep(44, 66, a).toFixed(3))
    root.style.setProperty('--tilt', `${(-a).toFixed(2)}deg`)
    const view1 = { ...o, a: rad, tz, P: g.P, px: g.px, py: g.py }
    const far = project([g.PW / 2, 0], view1)[1]
    const far0 = project([g.PW / 2, 0], { ...view1, a: (A0 * Math.PI) / 180, tz: 0 })[1]
    back.style.transform = `translateY(${f1(Math.min(0, far - far0))}px)`
    for (const pn of pins) {
      const [x, y] = project(pn.p, view1, pn.up)
      const ax = pn.flip ? (x > g.W * 0.6 ? 1 : 0) : pn.ax
      if (pn.flip) pn.el.classList.toggle('left', ax === 1)
      // keep the thing's words inside the frame
      const xc = clamp(x, g.W * 0.03 + ax * pn.w, g.W * 0.97 - (1 - ax) * pn.w)
      pn.el.style.transform = `translate(${f1(xc)}px, ${f1(y)}px) translate(${-ax * 100}%, ${-pn.ay * 100}%)`
    }
  }

  // ── painting (once per size; the first one soaks in)
  function layout(W: number, H: number) {
    G = plan(W, H)
    const g = G
    o = { left: g.sx - g.piv[0], top: g.sy - g.piv[1], ox: g.piv[0], oy: g.piv[1] }
    Object.assign(plane.style, { left: `${f1(o.left)}px`, top: `${f1(o.top)}px`, width: `${f1(g.PW)}px`, height: `${f1(g.PD)}px`, transformOrigin: `${f1(o.ox)}px ${f1(o.oy)}px` })
    view.style.perspective = `${f1(g.P)}px`
    view.style.perspectiveOrigin = `${f1(g.px)}px ${f1(g.py)}px`
    root.classList.toggle('land', g.land)
    job?.cancel()
    job = sliced(paint(g), { sync: ctx.reduced || !first })
    first = false
  }

  function* paint(g: Geo) {
    const { W, H, PW, PD, ww, head, lg, sh } = g
    const r = rng(2525)
    const view0 = { ...o, a: (A0 * Math.PI) / 180, P: g.P, px: g.px, py: g.py }
    const kAt = (p: Pt) => Math.max(0.3, project(p, view0)[2]) // how big that spot looks when slanting
    const hz = project([PW / 2, 0], view0)[1]
    const pick = (pts: Pt[], t: number) => pts[Math.round(clamp(t, 0, 1) * (pts.length - 1))]
    /** a point beside the channel at t: d > 0 = left of the flow */
    const beside = (pts: Pt[], t: number, d: number): Pt => {
      const k = clamp(Math.round(t * (pts.length - 1)), 1, pts.length - 2)
      return offset(pts.slice(k - 1, k + 2), d)[1]
    }
    const svg = (cls: string, ...kids: (SVGElement | null)[]) => s('svg', { class: cls, viewBox: `0 0 ${f1(PW)} ${f1(PD)}`, width: f1(PW), height: f1(PD), 'aria-hidden': 'true' }, ...kids)
    const bands = (k: number) => [stroke(head, ww * 1.15 * k, 0.05, 0.05, 0.7), stroke(lg, ww * k, 0.04, 0.08, 0.6), stroke(sh, ww * 0.92 * k, 0.04, 0.08, 0.6)].join('')

    // ── the sky beyond the far bank (screen space): moon, two ranges, mist lying where the plane ends
    const [mx, my] = g.moon
    back.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    back.replaceChildren(
      s('defs', null, s('radialGradient', { id: 't25c-lglow' }, s('stop', { offset: 0, style: 'stop-color:var(--lantern);stop-opacity:.6' }), s('stop', { offset: 0.45, style: 'stop-color:var(--lantern);stop-opacity:.18' }), s('stop', { offset: 1, style: 'stop-color:var(--lantern);stop-opacity:0' }))),
      mist(mx, my, W * 0.42, H * 0.22),
      moon(mx, my, Math.min(W, H) * (g.land ? 0.036 : 0.055), 2522, true),
      hills(-W * 0.1, W * 1.1, hz + H * 0.03, H * (g.land ? 0.15 : 0.1), 2523, 0.9, 5),
      hills(W * 0.3, W * 1.08, hz + H * 0.035, H * (g.land ? 0.08 : 0.06), 2524, 0.55, 3),
      mist(W * 0.5, hz + H * 0.03, W * 0.8, H * 0.08),
      pine(W * (g.land ? 0.09 : 0.12), hz + H * 0.04, H * (g.land ? 0.26 : 0.18), 2526, 1),
      mist(W * 0.15, hz + H * 0.05, W * 0.4, H * 0.06))
    yield

    // ── key places on the plane
    const lamp = g.land ? beside(lg, 0.97, ww * 0.9) : beside(lg, 0.8, ww * 0.95)
    const gateA = pick(lg, 0.2), gateB = pick(sh, 0.3)
    const tip = pick(lg, 0.07), tip2 = pick(sh, 0.09)
    const lev: Pt = [lerp(tip[0], tip2[0], 0.5), lerp(tip[1], tip2[1], 0.5) - ww * 0.15]
    const board = g.land ? beside(head, 0.42, ww * 1.55) : beside(head, 0.2, ww * 1.15)
    const isl = Array.from({ length: 11 }, (_, i) => {
      const t = 0.3 + (i / 10) * 0.62, u = 0.32 + ((i * 7) % 5) * 0.09
      const a0 = pick(lg, t), b0 = pick(sh, t)
      return [lerp(a0[0], b0[0], u), lerp(a0[1], b0[1], u)] as Pt
    })
    const fringe = [0.5, 0.78].map((t) => beside(sh, t, -ww * 0.8))
    const nearReeds = [[0.42, -2.1], [0.6, -1.7], [0.74, -2.6]].map(([t, d]) => beside(sh, t, d * ww))
    // the bamboo stakes stand along the short branch's outer bank toward its landing, each with a paper flag
    const stakes = flagEls.map((_, i) => beside(sh, (g.land ? 0.46 : 0.44) + (i / Math.max(1, flagEls.length - 1)) * (g.land ? 0.48 : 0.54), -ww * (g.land ? 0.95 : 0.75)))
    const stakeH = stakes.map((_, i) => ww * (g.land ? 1.05 + (i % 2) * 0.35 : 1.1))
    const rocks: [Pt, number][] = [[beside(head, 0.62, -ww * 0.85), 0.42], [beside(lg, 0.5, ww * 0.8), 0.5], [beside(sh, 0.55, -ww * 2.3), 0.62]]

    // ── the water (one flat layer under everything): bed — shallows show sand, the deep is ink — and over it the
    // mirror: the night sky held in the water, lighter toward the far bank; the moon's road (the screen column under
    // the moon laid back onto the plane, so it converges like the banks do); the lamp's warm streak; banks hanging toward us
    const mu = mx / W
    const wet = (p: Pt) => [head, lg, sh].some((pts) => pts.some((q) => Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) < ww * 0.75))
    const roadLine = Array.from({ length: 60 }, (_, i) => g.at(mu, 0.3 + i * 0.0125))
    let road = ''
    for (let v = 0.3; v < 1.02; v += 0.0025) {
      const near = (v - 0.3) / 0.72
      const p = g.at(mu + (r() - 0.5) * (0.012 + near * 0.05), v)
      if (r() < 0.15 || !wet(p)) continue
      const k = kAt(p)
      const len = (ww * (0.35 + near * 0.5) * (0.5 + r())) / k
      road += stroke([[p[0] - len / 2, p[1]], [p[0] + len / 2, p[1] + (r() - 0.5) * 2]], (ww * (0.2 + near * 0.12)) / k, 0.3, 0.3, 0.15)
    }
    // the far bank held upside down in the mirror: the near range and the pine, drawn deeper than a true mirror would
    // so it reaches the water we can see
    const hb = hz + H * 0.03, hh0 = H * (g.land ? 0.15 : 0.1), reach = (H * (g.land ? 0.62 : 0.56) - hb) / hh0
    const rid = ridge(-W * 0.1, W * 1.1, hb, hh0, 2523, 5).filter((_, i) => i % 2 === 0)
    const reflTop = rid.map(([X]) => g.at(X / W, hb / H)), reflBot = rid.map(([X, Y]) => g.at(X / W, Math.min(1.05, (hb + (hb - Y) * reach) / H)))
    const pxp = W * (g.land ? 0.09 : 0.12), pb = hz + H * 0.04, pl = H * (g.land ? 0.26 : 0.18) * reach * 0.8
    const pineR = [g.at((pxp - W * 0.025) / W, pb / H), g.at((pxp + W * 0.03) / W, pb / H), g.at((pxp + W * 0.05) / W, Math.min(1.05, (pb + pl) / H)), g.at((pxp - W * 0.04) / W, Math.min(1.05, (pb + pl) / H))]
    const farRefl = `M${reflTop.map(PT).join('L')}L${[...reflBot].reverse().map(PT).join('L')}ZM${pineR.map(PT).join('L')}Z`
    let ripple = '' // the mirror's skin: thin bright breaks across the reflection
    for (let i = 0; i < 60; i++) {
      const p = g.at(r(), 0.3 + r() * 0.5)
      if (!wet(p)) continue
      const k = kAt(p), len = (ww * (0.3 + r() * 0.8)) / k
      ripple += stroke([[p[0] - len / 2, p[1]], [p[0] + len / 2, p[1] + (r() - 0.5) * 2]], Math.max(1, (ww * 0.03) / k), 0.3, 0.3, 0.1)
    }
    // the water darkens toward both banks (the banks' shade and their overhang)
    const bankDk = ([[head, ww * 1.15], [lg, ww], [sh, ww * 0.92]] as [Pt[], number][]).map(([pts, wd]) => stroke(offset(pts, wd * 0.4), ww * 0.32, 0.04, 0.06, 0.5) + stroke(offset(pts, -wd * 0.4), ww * 0.32, 0.04, 0.06, 0.5)).join('')
    let hang = ''
    const hangAt = (p: Pt, w: number, len: number, seed: number, n = 5) => {
      const q = rng(seed)
      for (let i = 0; i < n; i++) {
        const x = p[0] + (q() - 0.5) * w, y = p[1] + ww * 0.1
        hang += stroke([[x, y], [x + (q() - 0.5) * w * 0.15, y + len * (0.5 + q() * 0.5)]], w * (0.08 + q() * 0.12), 0.1, 0.7, 0.1)
      }
    }
    isl.forEach((p, i) => hangAt(p, ww * 0.7, ww * 2.6, 2610 + i))
    fringe.forEach((p, i) => hangAt(p, ww * 0.6, ww * 2.2, 2630 + i))
    stakes.forEach((p, i) => hangAt(p, ww * 0.1, ww * 2.4, 2640 + i, 1))
    hangAt(gateA, ww * 1.1, ww * 2, 2645, 3)
    hangAt(gateB, ww * 1.1, ww * 2, 2646, 3)
    const glow = roadLine.filter(wet).map((p, i) => s('ellipse', { cx: f1(p[0]), cy: f1(p[1]), rx: f1((ww * 1.3) / kAt(p)), ry: f1((ww * 1.6) / kAt(p)), fill: 'url(#t25c-glowg)', style: `opacity:${(0.35 + (i % 3) * 0.12).toFixed(2)}` }))
    const water = svg('t25c-water',
      s('defs', null,
        // a plain vector clip (no blurred mask: the plane is large and every filtered pixel is rasterised)
        s('clipPath', { id: 't25c-wclip' }, s('path', { d: bands(1) })),
        s('linearGradient', { id: 't25c-sky', x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0.25, class: 't25c-sky0' }), s('stop', { offset: 0.7, class: 't25c-sky1' }), s('stop', { offset: 1, class: 't25c-sky2' })),
        s('radialGradient', { id: 't25c-glowg' }, s('stop', { offset: 0, class: 't25c-glow0' }), s('stop', { offset: 1, class: 't25c-glow1' })),
        s('linearGradient', { id: 't25c-lamp', x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, style: 'stop-color:var(--lantern);stop-opacity:.85' }), s('stop', { offset: 1, style: 'stop-color:var(--lantern);stop-opacity:0' }))),
      s('g', { 'clip-path': 'url(#t25c-wclip)' },
        s('rect', { class: 't25c-shallow', width: f1(PW), height: f1(PD) }),
        s('path', { class: 't25c-deep', d: bands(0.55) }),
        s('g', { class: 't25c-mirror' },
          s('rect', { width: f1(PW), height: f1(PD), fill: 'url(#t25c-sky)' }),
          s('path', { class: 't25c-farrefl', d: farRefl, filter: 'url(#ink-wash)' }),
          s('path', { class: 't25c-ripple', d: ripple }),
          ...glow,
          s('path', { class: 't25c-hang', d: hang }),
          s('path', { d: stroke([[lamp[0], lamp[1] + ww * 0.2], [lamp[0] + 4, lamp[1] + ww * 5]], ww * 0.55, 0.05, 0.9, 0.2), fill: 'url(#t25c-lamp)' }),
          s('path', { class: 't25c-road', d: road })),
        s('path', { class: 't25c-bankdk', d: bankDk, filter: 'url(#ink-wash)' })))
    yield

    // ── the current over the bed: soft-edged segments along each channel, a tile of fibres sliding in each (compositor
    // only); under the mirror's sheen they fade with the Fresnel term
    flows.forEach((l) => l.forEach((an) => an.cancel()))
    const lanes = ([[head, ww * 1.0, 0], [lg, ww * 0.9, 1], [sh, ww * 0.84, 2]] as [Pt[], number, number][]).map(([pts, wd, k]) => {
      const al = along(pts)
      const L = wd * 0.8
      const lane = h('div', { class: `t25c-lane t25c-lane-${k}` })
      const list: Animation[] = []
      for (let d = 0; d < al.len; d += L) {
        const [x, y, ang] = al.at(d + L / 2)
        const seg = h('div', { class: 't25c-seg', style: `left:${f1(x - L * 1.1)}px;top:${f1(y - wd / 2)}px;width:${f1(L * 2.2)}px;height:${f1(wd)}px;transform:rotate(${f1((ang * 180) / Math.PI)}deg)` })
        const fib = h('div', { class: `t25c-fib${k === 2 ? ' rough' : ''}`, style: `width:${f1(L * 2.2 + TW)}px;left:${f1(-TW)}px;background-position:${f1(-((d - L * 0.6) % TW))}px 50%` })
        seg.append(fib)
        lane.append(seg)
        if (!ctx.reduced && ctx.quality !== 'low') {
          const an = fib.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${TW}px)` }], { duration: 5200, iterations: Infinity })
          if (!live) an.pause()
          list.push(an)
        }
      }
      flows[k] = list
      return lane
    })
    const flowsEl = h('div', { class: 't25c-flows' }, ...lanes)
    const eddy = h('div', { class: 't25c-eddy', style: `left:${f1(g.piv[0] - ww * 0.75)}px;top:${f1(g.piv[1] - ww * 0.75)}px;width:${f1(ww * 1.5)}px;height:${f1(ww * 1.5)}px` },
      s('svg', { viewBox: `${f1(-ww * 0.75)} ${f1(-ww * 0.75)} ${f1(ww * 1.5)} ${f1(ww * 1.5)}`, 'aria-hidden': 'true' }, s('path', { d: swirl(ww * 0.7, 2559) })))
    flowsEl.append(eddy)
    if (!ctx.reduced && ctx.quality !== 'low') {
      const an = eddy.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(-360deg)' }], { duration: 9000, iterations: Infinity })
      if (!live) an.pause()
      flows[0].push(an)
    }
    rate()
    yield

    // ── the banks (one flat layer over the water): moss and gravel on the ground (kept off the water), the wet edge,
    // the lamp's warm pool, soft shadows thrown toward us, broken ink edges, flat stones, the pier, stepping stones
    const shadow = (p: Pt, w: number, hh: number) => blob(p[0] - hh * 0.08, p[1] + hh * 0.32, w * 0.36, hh * 0.34, Math.round(p[0] + p[1]), 0.2, 12)
    // moss in a few cushions on the banks (a dark foot, a lit crown), not scattered pads
    let moss = '', mossLt = ''
    const clumps: Pt[] = [beside(head, 0.7, ww * 1.4), beside(head, 0.45, -ww * 1.35), beside(lg, 0.38, ww * 1.25), beside(lg, 0.72, -ww * 1.3), beside(sh, 0.4, -ww * 1.45), beside(sh, 0.84, ww * 1.15), beside(lg, 0.9, ww * 1.5)]
    clumps.forEach((c, j) => {
      for (let i = 0; i < 5; i++) {
        const x = c[0] + (r() - 0.5) * ww * 0.9, y = c[1] + (r() - 0.5) * ww * 0.5, rx = ww * (0.14 + r() * 0.22), ry = rx * (0.55 + r() * 0.25)
        moss += blob(x, y, rx, ry, 2800 + j * 9 + i, 0.3, 12)
        mossLt += blob(x + rx * 0.12, y - ry * 0.2, rx * 0.68, ry * 0.6, 2850 + j * 9 + i, 0.3, 10)
      }
    })
    let gravel = ''
    for (let i = 0; i < 150; i++) {
      const q = beside([head, lg, sh][i % 3], 0.05 + r() * 0.9, (r() < 0.5 ? -1 : 1) * ww * (0.62 + r() * 0.9))
      gravel += blob(q[0], q[1], 2 + r() * 3, 1.4 + r() * 2, i, 0.25, 6)
    }
    let edge = ''
    ;([[head, ww * 1.15], [lg.slice(2), ww], [sh.slice(2), ww * 0.92]] as [Pt[], number][]).forEach(([p, wd], i) => {
      edge += broken(offset(p, wd / 2 + 1), Math.max(2, ww * 0.04), 2530 + i, 0.75) + broken(offset(p, -wd / 2 - 1), Math.max(2, ww * 0.04), 2540 + i, 0.75)
    })
    // flat stones and grass lean out over the edges: the water's line is broken, not cut
    let flat = '', flatSh = '', grass = ''
    for (let i = 0; i < 16; i++) {
      const pts = [head, lg, sh][i % 3], side = r() < 0.5 ? -1 : 1, wd = [ww * 1.15, ww, ww * 0.92][i % 3]
      const q = beside(pts, 0.08 + r() * 0.84, side * (wd / 2 + ww * (r() * 0.08 - 0.02)))
      const rx = ww * (0.13 + r() * 0.12), ry = ww * (0.09 + r() * 0.08)
      flatSh += blob(q[0] - rx * 0.15, q[1] + ry * 0.45, rx * 1.05, ry, 2720 + i, 0.12, 12)
      flat += blob(q[0], q[1], rx, ry, 2700 + i, 0.12, 12)
    }
    for (let i = 0; i < 36; i++) {
      const k = i % 3, pts = [head, lg, sh][k], wd = [ww * 1.15, ww, ww * 0.92][k], side = r() < 0.5 ? -1 : 1, tt = 0.05 + r() * 0.9
      const foot = beside(pts, tt, side * (wd / 2 + ww * 0.12)), tipP = beside(pts, tt + (r() - 0.5) * 0.04, side * (wd / 2 - ww * (0.1 + r() * 0.12)))
      for (let b = 0; b < 4; b++) {
        const f: Pt = [foot[0] + (r() - 0.5) * ww * 0.18, foot[1] + (r() - 0.5) * ww * 0.1], e: Pt = [tipP[0] + (r() - 0.5) * ww * 0.2, tipP[1] + (r() - 0.5) * ww * 0.12]
        grass += stroke(curve(f, [(f[0] + e[0]) / 2, (f[1] + e[1]) / 2 - ww * 0.06], e, 5), Math.max(1.2, ww * 0.025), 0.05, 0.7, 0.15)
      }
    }
    const e0 = g.landing[0], e1 = lg[lg.length - 4]
    const dir = Math.atan2(e0[1] - e1[1], e0[0] - e1[0])
    let planks = ''
    for (let i = 0; i < 6; i++) {
      const c: Pt = [e0[0] + Math.cos(dir) * ww * (0.2 + i * 0.22), e0[1] + Math.sin(dir) * ww * (0.2 + i * 0.22)]
      const n: Pt = [-Math.sin(dir) * ww * 0.6, Math.cos(dir) * ww * 0.6]
      planks += stroke([[c[0] - n[0], c[1] - n[1]], [c[0] + n[0], c[1] + n[1]]], ww * 0.16, 0.02, 0.02, 0.9)
    }
    let tops = '', sides = '', rims = ''
    ;[-0.62, -0.2, 0.22, 0.64].forEach((d, i) => {
      const q = beside(head, g.land ? 0.2 : 0.18, d * ww * 1.3)
      const rx = ww * (0.26 + (i % 2) * 0.05), ry = rx * 0.78
      sides += blob(q[0], q[1] + ry * 0.35, rx, ry, 2750 + i, 0.1, 14)
      tops += blob(q[0], q[1], rx, ry, 2750 + i, 0.1, 14)
      rims += stroke(Array.from({ length: 9 }, (_, j) => [q[0] + Math.cos(Math.PI * (1.08 + j * 0.1)) * rx * 0.86, q[1] + Math.sin(Math.PI * (1.08 + j * 0.1)) * ry * 0.86] as Pt), rx * 0.09, 0.3, 0.3, 0.1)
    })
    const banks = svg('t25c-banks',
      s('defs', null,
        s('mask', { id: 't25c-dry', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: f1(PW), height: f1(PD) }, s('rect', { width: f1(PW), height: f1(PD), fill: '#fff' }), s('path', { d: bands(0.9), fill: '#000' })),
        s('radialGradient', { id: 't25c-pool' }, s('stop', { offset: 0, style: 'stop-color:var(--lantern);stop-opacity:.5' }), s('stop', { offset: 0.4, style: 'stop-color:var(--lantern);stop-opacity:.14' }), s('stop', { offset: 1, style: 'stop-color:var(--lantern);stop-opacity:0' })),
        s('linearGradient', { id: 't25c-fade', x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, style: 'stop-color:#fff;stop-opacity:0' }), s('stop', { offset: 0.22, style: 'stop-color:#fff;stop-opacity:1' })),
        s('mask', { id: 't25c-far', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: f1(PW), height: f1(PD) }, s('rect', { width: f1(PW), height: f1(PD), fill: 'url(#t25c-fade)' }))),
      s('g', { mask: 'url(#t25c-far)' },
        s('g', { mask: 'url(#t25c-dry)' },
          s('path', { class: 't25c-moss', d: moss, filter: 'url(#ink-rough)' }),
          s('path', { class: 't25c-mosslt', d: mossLt }),
          s('path', { class: 't25c-moss2', d: bands(1.9) }),
          s('path', { class: 't25c-gravel', d: gravel }),
          s('path', { class: 't25c-wet', d: bands(1.45) }),
          s('path', { class: 't25c-wet', d: bands(1.2) })),
        s('ellipse', { cx: f1(lamp[0]), cy: f1(lamp[1] + ww * 0.6), rx: f1(ww * 3.4), ry: f1(ww * 2.6), fill: 'url(#t25c-pool)' }),
        s('path', { class: 't25c-cast t25c-castup', d: [shadow(lamp, ww * 0.6, ww * 2.4), shadow(lev, ww * 0.4, ww * 1), shadow(board, ww * 1.8, ww * 1.2), shadow(gateA, ww, ww), shadow(gateB, ww, ww), ...isl.map((p) => shadow(p, ww * 0.6, ww * 1.4)), ...stakes.map((p, i) => shadow(p, ww * 0.3, stakeH[i]))].join('') }),
        s('path', { class: 't25c-cast', d: flatSh }),
        s('path', { class: 't25c-flat', d: flat }),
        s('path', { class: 't25c-flatlit', d: flat, transform: `translate(${f1(ww * 0.03)} ${f1(-ww * 0.03)}) scale(1)` }),
        s('path', { class: 't25c-planks', d: planks, filter: 'url(#ink-rough)' }),
        s('path', { class: 't25c-edge', d: edge }),
        s('path', { class: 't25c-grass', d: grass }),
        s('path', { class: 't25c-cast', d: sides, transform: `translate(${f1(ww * 0.12)} ${f1(ww * 0.18)})` }),
        s('path', { class: 't25c-sside', d: sides }),
        s('path', { class: 't25c-stop', d: tops, filter: 'url(#ink-rough)' }),
        s('path', { class: 't25c-srim', d: rims })))
    yield

    // ── standing things: billboards rising off the plane (tilting down shows their tops)
    const prop = (p: Pt, w: number, hh: number, kids: (SVGElement | null)[], cls = '', ...extra: HTMLElement[]) =>
      h('div', { class: `t25c-prop ${cls}`, style: `left:${f1(p[0] - w / 2)}px;top:${f1(p[1] - hh)}px;width:${f1(w)}px;height:${f1(hh)}px` },
        s('svg', { viewBox: `${f1(-w / 2)} ${f1(-hh)} ${f1(w)} ${f1(hh)}`, width: f1(w), height: f1(hh), 'aria-hidden': 'true' }, ...kids), ...extra)
    const props: HTMLElement[] = []
    // bamboo stakes, alternating heights so their paper flags (screen layer) do not touch
    stakes.forEach((p, i) => props.push(prop(p, ww * 0.4, stakeH[i] * 1.04, [
      s('path', { class: 't25c-cane', d: stroke([[0, 0], [(i - 1.5) * 1.5, -stakeH[i]]], ww * 0.055, 0.02, 0.02, 0.9) }),
      s('path', { class: 't25c-canelt', d: stroke([[ww * 0.012, -stakeH[i] * 0.05], [(i - 1.5) * 1.5 + ww * 0.012, -stakeH[i] * 0.95]], ww * 0.014, 0.1, 0.1, 0.5) }),
      s('path', { class: 't25c-knot', d: [0.35, 0.7].map((k) => stroke([[-ww * 0.035, -stakeH[i] * k], [ww * 0.035, -stakeH[i] * k - 1]], ww * 0.018, 0.2, 0.2, 0.5)).join('') }),
    ])))
    isl.forEach((p, i) => props.push(prop(p, ww * 1.3, ww * 1.9, [reeds(0, 0, ww * (1.15 + ((i * 5) % 4) * 0.18), 2580 + i, 9)], 't25c-reed')))
    fringe.forEach((p, i) => props.push(prop(p, ww * 1.1, ww * 1.5, [reeds(0, 0, ww * (1 + (i % 2) * 0.25), 2660 + i, 7)], 't25c-reed')))
    nearReeds.forEach((p, i) => props.push(prop(p, ww * 1.2, ww * 1.4, [reeds(0, 0, ww * (0.9 + (i % 2) * 0.3), 2680 + i, 8)], 't25c-reed')))
    rocks.forEach(([p, k], i) => props.push(prop(p, ww * k * 1.3, ww * k * 0.8, [stoneArt(ww * k, ww * k * 0.58, 2670 + i)])))
    // two sluice gates just past the fork (each word on a stone plaque, pinned below); the lever on the island's tip
    const gate = (p: Pt, k: number) => {
      const wd = ww * 1.12, ph = ww * 0.64
      const post = (x: number) => s('g', null,
        s('path', { class: 't25c-post', d: `M${f1(x - ww * 0.08)} 0L${f1(x - ww * 0.075)} ${f1(-ph)}L${f1(x + ww * 0.075)} ${f1(-ph)}L${f1(x + ww * 0.08)} 0Z` }),
        s('path', { class: 't25c-postdk', d: `M${f1(x - ww * 0.08)} 0L${f1(x - ww * 0.075)} ${f1(-ph)}L${f1(x - ww * 0.03)} ${f1(-ph)}L${f1(x - ww * 0.035)} 0Z` }),
        s('path', { class: 't25c-postlt', d: `M${f1(x + ww * 0.045)} 0L${f1(x + ww * 0.045)} ${f1(-ph)}L${f1(x + ww * 0.075)} ${f1(-ph)}L${f1(x + ww * 0.08)} 0Z` }))
      let boards = ''
      for (let b = 1; b < 5; b++) boards += stroke([[-wd * 0.44 + (wd * 0.88 * b) / 5, -ww * 0.05], [-wd * 0.44 + (wd * 0.88 * b) / 5, -ww * 0.36]], 1.2, 0.1, 0.1, 0.6)
      return prop(p, wd * 1.3, ww * 0.95, [
        s('g', { class: 't25c-plank' },
          s('path', { class: 't25c-wood', d: `M${f1(-wd * 0.44)} ${f1(-ww * 0.04)}L${f1(-wd * 0.44)} ${f1(-ww * 0.36)}L${f1(wd * 0.44)} ${f1(-ww * 0.37)}L${f1(wd * 0.44)} ${f1(-ww * 0.03)}Z`, filter: 'url(#ink-rough)' }),
          s('path', { class: 't25c-woodln', d: boards }),
          s('path', { class: 't25c-wet', d: `M${f1(-wd * 0.44)} ${f1(-ww * 0.04)}L${f1(-wd * 0.44)} ${f1(-ww * 0.12)}L${f1(wd * 0.44)} ${f1(-ww * 0.12)}L${f1(wd * 0.44)} ${f1(-ww * 0.03)}Z` })),
        post(-wd * 0.5), post(wd * 0.5),
      ], `t25c-gate t25c-gate-${k}`)
    }
    props.push(gate(gateA, 0), gate(gateB, 1))
    const u = ww / 100 // the lever drawn in a 100-unit box
    const grain = stroke([[-1.5 * u, -30 * u], [-1 * u, -70 * u]], 0.9 * u, 0.2, 0.2, 0.5) + stroke([[1.8 * u, -34 * u], [1.4 * u, -62 * u]], 0.7 * u, 0.2, 0.2, 0.5)
    const arm = s('g', { class: 't25c-arm' },
      s('path', { class: 't25c-wood', d: `M${f1(-3.2 * u)} ${f1(-22 * u)}L${f1(-2.2 * u)} ${f1(-82 * u)}L${f1(2.2 * u)} ${f1(-82 * u)}L${f1(3.2 * u)} ${f1(-22 * u)}Z` }),
      s('path', { class: 't25c-woodlt', d: `M${f1(1.4 * u)} ${f1(-22 * u)}L${f1(1 * u)} ${f1(-82 * u)}L${f1(2.2 * u)} ${f1(-82 * u)}L${f1(3.2 * u)} ${f1(-22 * u)}Z` }),
      s('path', { class: 't25c-woodln', d: grain }),
      // the grip: cord wound round the top
      s('path', { class: 't25c-grip', d: `M${f1(-3.2 * u)} ${f1(-80 * u)}L${f1(-3.2 * u)} ${f1(-100 * u)}Q0 ${f1(-104 * u)} ${f1(3.2 * u)} ${f1(-100 * u)}L${f1(3.2 * u)} ${f1(-80 * u)}Z` }),
      s('path', { class: 't25c-gripln', d: [84, 88, 92, 96].map((y) => stroke([[-3.2 * u, -y * u], [3.2 * u, -(y + 2) * u]], 0.8 * u, 0.1, 0.1, 0.6)).join('') }))
    props.push(prop(lev, ww * 1.6, ww * 1.15, [
      arm,
      // the pivot block: a squat stone, lit top, mid face, dark left side; the axle pin; a small seal
      s('path', { class: 't25c-post', d: `M${f1(-14 * u)} 0L${f1(-13 * u)} ${f1(-26 * u)}L${f1(13 * u)} ${f1(-27 * u)}L${f1(14 * u)} 0Z`, filter: 'url(#ink-rough)' }),
      s('path', { class: 't25c-postdk', d: `M${f1(-14 * u)} 0L${f1(-13 * u)} ${f1(-26 * u)}L${f1(-7 * u)} ${f1(-26.3 * u)}L${f1(-7.5 * u)} 0Z` }),
      s('path', { class: 't25c-postlt', d: `M${f1(-13 * u)} ${f1(-26 * u)}L${f1(13 * u)} ${f1(-27 * u)}L${f1(11 * u)} ${f1(-31 * u)}L${f1(-11 * u)} ${f1(-30 * u)}Z` }),
      s('circle', { class: 't25c-axle', cx: 0, cy: f1(-22 * u), r: f1(2.6 * u) }),
      s('rect', { class: 't25c-seal', x: f1(5 * u), y: f1(-14 * u), width: f1(5.5 * u), height: f1(5.5 * u), rx: f1(0.6 * u), transform: `rotate(-6 ${f1(7.7 * u)} ${f1(-11 * u)})` }),
    ], 't25c-leverpost', lever))
    // words pinned to their things (screen layer: never hidden behind a reed, never smaller than they can be read)
    pins.length = 0
    pins.push({ el: boardEl, p: board, up: 0, ax: 0.5, ay: 1, w: 0 }, { el: lanternEl, p: lamp, up: 0, ax: 0.5, ay: 1, w: 0 })
    stakes.forEach((p, i) => pins.push({ el: flagEls[i], p, up: stakeH[i] * 0.97, ax: 0, ay: 0, w: 0, flip: true }))
    ;[gateA, gateB].forEach((p, i) => {
      lintels[i].style.minWidth = `${f1(ww * 1.12 * 1.28 * kAt(p))}px` // as wide as the gate
      pins.push({ el: lintels[i], p, up: ww * 0.63, ax: 0.5, ay: 1, w: 0 })
    })
    // the boat that carries the AI's calm sentence, moored above the fork: the sentence is on its paper sail
    const hk = ww / (g.land ? 34 : 30)
    boatEl(hk, hero, false)
    hero.style.transform = `translate3d(${f1(g.piv[0])}px, ${f1(g.piv[1])}px, 0)`
    const sw = g.land ? 176 : 142
    Object.assign(strip.style, { left: `${f1(g.piv[0] - sw / 2)}px`, width: `${sw}px`, bottom: `${f1(PD - g.piv[1] + 6 * hk - 1)}px` })
    Object.assign(calmNote.style, { left: `${f1(g.piv[0] - 90)}px`, width: '180px', bottom: `${f1(PD - g.piv[1] - ww * 0.5)}px` })
    plane.replaceChildren(water, flowsEl, banks, ...props, hero, strip, calmNote)
    boats.forEach((b) => plane.append(b.el))
    parked.forEach((l) => (l.length = 0))
    const counts = [...piles] as [number, number]
    piles[0] = piles[1] = 0
    counts.forEach((n, ride) => {
      for (let i = 0; i < Math.min(n, 9); i++) land(ride as 0 | 1)
      piles[ride] = n
    })
    apply()
    pins.forEach((pn) => (pn.w = pn.el.offsetWidth)) // one read for all the pinned words
    apply()
    yield

    // ── reeds right in front of us, out of focus (pre-blurred at high, never animated)
    near.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    near.replaceChildren(
      reeds(W * 0.03, H * 1.04, H * (g.land ? 0.46 : 0.3), 2690, 11),
      reeds(W * (g.land ? 0.98 : 0.96), H * 1.04, H * (g.land ? 0.36 : 0.24), 2691, 8))
  }

  root.dataset.mood = '1'
  setMood(1)
  setTilt(A0, true)
  ambient(ctx, root, (on) => {
    live = on
    flows.forEach((l) => l.forEach((an) => (on ? an.play() : an.pause())))
  })
  ctx.prompt(K.prompt)
}
