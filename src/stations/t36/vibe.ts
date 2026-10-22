import './vibe.css'
import { fill, h, s } from '../../core/dom'
import { cssVar, onPrefs } from '../../core/prefs'
import { sliced } from '../../core/chunk'
import { blob, clamp, curve, rng, rock, stroke, type Pt } from '../../ui/part2/ink'
import { grass, reeds } from '../../ui/part2/paint'
import { perspectiveCircle } from '../../ui/part2/perspectives'
import { guide, type Mark } from '../../ui/part2/guide'
import type { Perspectives } from '../../ui/part2/types'
import type { SceneCtx } from '../types'
import { C } from './content'
import { f1, gdefs, ink, zonedHeight } from './kit'
import { koi } from './koi'

const K = C.scenes.vibe
const CODE = (C.scenes.carve.code as { code: string }).code.split('\n')
const TAU = Math.PI * 2
/** what each voice does to the water (by its index in perspectives.stones): focus 0 = the surface … 1 = the bottom */
const FOCUS = [0, 1, 0.8, 0.3, 0.35]
/** the candle stones' arc along the near edge (k left → right): x, y as shares of the stage, size against the stone box */
const ARC = {
  wide: { x: [0.085, 0.27, 0.5, 0.73, 0.915], y: [0.985, 0.955, 0.93, 0.955, 0.985], s: [1.8, 1.45, 1.25, 1.45, 1.8] },
  tall: { x: [0.1, 0.3, 0.5, 0.7, 0.9], y: [0.97, 0.935, 0.91, 0.935, 0.97], s: [1.9, 1.7, 1.55, 1.7, 1.9] },
}
/** the pond in the stage: a wide oval seen from 60° above, banks visible all round */
const pondOf = (W: number, H: number, wide: boolean) => {
  const rx = wide ? W * 0.41 : W * 0.46
  return { cx: W / 2, cy: wide ? H * 0.37 : H * 0.4, rx, ry: Math.min(rx * 0.87, wide ? H * 0.3 : H * 0.29) }
}

/** where each candle's wick stands in its stone's box (viewBox −60 −70 120 90), by slot k */
const WICK: Pt[] = []

/** a candle stone in the near edge (viewBox −60 −70 120 90, foot on y = 0): a rock of its own shape, its dish, wax, flame */
function candleStone(k: number, seed: number): SVGElement {
  const r = rng(seed)
  // five different rocks: a long flat one, a tall one, a round one, a wedge, a broad one
  const shape = [[1.12, 0.78, -0.2], [0.86, 1.15, 0.15], [0.96, 0.92, 0], [1.02, 1.0, 0.3], [1.15, 0.8, -0.1]][k % 5]
  const w = 104 * shape[0], hh = 46 * shape[1]
  const { top, d } = rock(w, hh, seed)
  const peak = top.reduce((a, p) => (p[1] < a[1] ? p : a), top[0])
  const cx = peak[0] * 0.6 + shape[2] * 8, cy = peak[1] + 6
  WICK[k] = [cx, cy - 6]
  return s('g', { class: `t36v-cs t36v-k${k}` },
    s('ellipse', { class: 't36v-contact', cx: 6, cy: 2, rx: f1(w * 0.58), ry: 8 }),
    s('g', { class: 't36v-rock' },
      s('path', { d, fill: 'url(#p2-rock)' }),
      s('path', { d, fill: 'url(#p2-shade)' }),
      r() < 0.6 ? s('path', { class: 't36v-moss', d: blob(-w * 0.2, -hh * 0.25, w * 0.18, hh * 0.12, seed + 3, 0.3, 10) }) : '',
      s('path', { class: 't36v-rim', d: stroke(top.slice(3, 26), 3, 0.3, 0.4, 0.15) })),
    s('ellipse', { class: 't36v-pool', cx: f1(cx), cy: f1(cy + 6), rx: 60, ry: 30, fill: 'url(#t36v-warm)' }),
    s('ellipse', { class: 't36v-dish', cx: f1(cx), cy: f1(cy + 3), rx: 9, ry: 2.6 }),
    s('rect', { class: 't36v-wax', x: f1(cx - 3.2), y: f1(cy - 10), width: 6.4, height: 13, rx: 1 }),
    // wax run down the candle and spread on the stone round its dish
    s('path', { class: 't36v-drip', d: `M${f1(cx - 3.2)} ${f1(cy - 8)}q-1.4 5 -0.6 9q1 2 1.6 0l0.4 -6ZM${f1(cx + 1.4)} ${f1(cy - 9)}q0.6 6 1.8 9q1.2 1.5 1.8 -0.4l-0.4 -8.6Z` + blob(cx - 6, cy + 4, 4.5, 1.6, seed + 5, 0.2, 8) + blob(cx + 7, cy + 4.6, 3.2, 1.2, seed + 6, 0.2, 8) }),
    s('path', { class: 't36v-flame', d: `M${f1(cx)} ${f1(cy - 22)}Q${f1(cx + 4)} ${f1(cy - 15)} ${f1(cx)} ${f1(cy - 10)}Q${f1(cx - 4)} ${f1(cy - 15)} ${f1(cx)} ${f1(cy - 22)}Z` }),
    s('circle', { class: 't36v-glow', cx: f1(cx), cy: f1(cy - 15), r: 26, fill: 'url(#t36v-warm)' }),
    s('circle', { class: 't36v-wring', cx: f1(cx), cy: f1(cy - 6), r: 7 }))
}

/**
 * Scene 5 — "is vibing enough?" (art direction §4 t36 `vibe`, perspectiveCircle with its own stage): looking down some
 * 60° into a deep clear pond that fills the frame, its banks of sand, stone and moss all round. On the surface the koi
 * game is playing (the koi on its round, a shard of moon, the moon's road); on the bottom, under the water, the game's
 * source is written in ink on flat stones — baked sharp, bent by the water, caustics drifting over it. Five candle stones
 * of different shapes stand in an arc along the near edge, the outer two big, cut by the frame, out of focus. Each voice
 * lights its candle (its flame laid as a long warm streak on the water), its words come up on the water beside it, and the
 * pond is re-set: the focus at the surface or down on the code, red cracks through half the lines, a paper lantern with a
 * seal floating up, a lashed bamboo fence round the shallows. Drag up or down on the water to move the focus yourself.
 * All five: the water stills and an ensō shows on it.
 */
export function vibeScene(ctx: SceneCtx) {
  gdefs()
  if (!document.getElementById('t36v-defs')) {
    const st = (o: number, c: string, a: number) => s('stop', { offset: o, style: `stop-color:var(${c});stop-opacity:${a}` })
    document.getElementById('p2-defs')!.append(s('defs', { id: 't36v-defs' },
      s('radialGradient', { id: 't36v-warm' }, st(0, '--lantern', 0.7), st(0.4, '--lantern', 0.25), st(1, '--lantern', 0)),
      s('linearGradient', { id: 't36v-streak', x1: 0, y1: 1, x2: 0, y2: 0 }, st(0, '--lantern', 0.6), st(0.35, '--lantern', 0.28), st(1, '--lantern', 0)),
      s('radialGradient', { id: 't36v-moonglow' }, st(0, '--moon', 0.5), st(1, '--moon', 0)),
      s('linearGradient', { id: 't36v-sheen', x1: 0, y1: 0, x2: 0, y2: 1 }, st(0, '--moon', 0.3), st(0.45, '--moon', 0.07), st(0.7, '--moon', 0)),
      s('radialGradient', { id: 't36v-moondisc' }, st(0, '--moon', 1), st(0.6, '--moon', 0.9), st(1, '--moon', 0))))
  }
  const low = ctx.quality === 'low'
  const calm = low || ctx.reduced
  const data = K.perspectives as Perspectives
  const stableH = zonedHeight(ctx, [data.common])
  let focus = 0.15
  let size = { W: 0, H: 0, wide: true }
  const measure = () => {
    const W = ctx.art.clientWidth, H = stableH(ctx.art.clientHeight)
    size = { W, H, wide: W / H > 1.15 }
    return size
  }

  // ── the stage's layers: bottom (sharp + soft), caustics, cracks, surface, things that come and go
  const bSoft = h('canvas', { class: 't36v-bottom soft', 'aria-hidden': 'true' })
  const bSharp = h('canvas', { class: 't36v-bottom sharp', 'aria-hidden': 'true' })
  const caus = h('div', { class: 't36v-caustic', 'aria-hidden': 'true' }, h('i'))
  const deep = h('div', { class: 't36v-deep' }, bSoft, bSharp, calm ? null : caus)
  const surf = s('svg', { class: 't36v-surf', 'aria-hidden': 'true' })
  const koiSvg = s('svg', { class: 't36v-koi', viewBox: '0 0 100 60' }, koi(78, 30, 62, 0.05, 3611, 0.16))
  const koiRot = h('div', { class: 't36v-koirot', 'aria-hidden': 'true' }, h('div', { class: 't36v-koispin' }, koiSvg))
  const front = s('svg', { class: 't36v-front', 'aria-hidden': 'true' })
  // a bamboo depth stake standing in the water at the right: notched at the surface and at the bottom; a ring of rush on
  // it shows where the eye is focused (the visible track of the drag)
  const ring = h('div', { class: 't36v-float', 'aria-hidden': 'true' }, h('i'))
  const marks = h('div', { class: 't36v-marks', 'aria-hidden': 'true' }, h('span', { class: 't36v-mtop' }, K.focusTop), h('span', { class: 't36v-mbot' }, K.focusBottom), ring)
  let feet: { x: number; y: number; s: number }[] = []

  let job = 0
  const comp = perspectiveCircle(data, {
    label: K.label, prompt: K.prompt, detail: K.detail,
    // the term defined before the first voice, not by whichever stone happens to say it
    question: K.question,
    stage: (host, api) => {
      host.classList.add('t36v-stage')
      host.append(deep, surf, koiRot, front, marks)
      // drag up or down on the water: the focus follows (down = deeper)
      let drag: { id: number; y: number; f: number } | null = null
      host.addEventListener('pointerdown', (e) => {
        if (e.button) return
        drag = { id: e.pointerId, y: e.clientY, f: focus }
        host.setPointerCapture(e.pointerId)
        wake()
      })
      host.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.id) return
        setFocus(clamp(drag.f + (e.clientY - drag.y) / Math.max(120, size.H * 0.6), 0, 1), true)
        if (focusMark && Math.abs(e.clientY - drag.y) > 20) {
          // the focus found by hand: the ring's dot goes, the prompt counts the voices left
          focusMark.done()
          focusMark = null
          moveDot()
          if (heard < 5) ctx.prompt(fill(K.left, { n: 5 - heard }))
        }
      })
      const up = (e: PointerEvent) => {
        if (drag && e.pointerId === drag.id) drag = null
      }
      host.addEventListener('pointerup', up)
      host.addEventListener('pointercancel', up)
      api.onLayout((_g, f) => {
        feet = f
        cancelAnimationFrame(job)
        // the canvases are painted the frame after the stones are placed (keeps the layout frame short)
        job = requestAnimationFrame(() => paint())
      })
      return () => cancelAnimationFrame(job)
    },
    place: (k) => {
      // the stage fills the art (vibe.css); the stones stand in an arc along the near edge, the outer ones cut by it
      const { W, H, wide } = k ? size : measure()
      const a = wide ? ARC.wide : ARC.tall
      return { x: W * a.x[k], y: H * a.y[k], s: a.s[k], z: k === 0 || k === 4 ? 30 : 20 }
    },
    stone: (k, _g, i) => candleStone(k, 3620 + i * 7),
    onHear: (k, i) => hear(k, i),
  })
  comp.mount(ctx)
  const root = ctx.art.querySelector<HTMLElement>('.p2c')!
  root.classList.add('t36v')
  if (calm) root.classList.add('calm')
  setFocus(focus, false)
  let heard = 0
  let focusMark: Mark | null = null
  // H1, one vermilion focus at a time: the dot on the wick of the candle to light next (the middle ones first); the other
  // unlit wicks breathe a faint ink ring (vibe.css)
  const GD = guide(ctx)
  const btns = [...root.querySelectorAll<HTMLElement>('.p2c-stone')]
  const ORDER = [2, 1, 3, 0, 4]
  const lit = new Set<number>()
  let nextK = 2
  const wickDot: Mark = GD.dot(() => {
    // read in the guide's layout pass (after the stones are placed): the wick inside the stone's box
    const b = btns[nextK]
    if (!b) return [-99, -99] as Pt
    const r = b.getBoundingClientRect(), a = ctx.art.getBoundingClientRect(), [wx, wy] = WICK[nextK] ?? [0, -20]
    return [r.left - a.left + ((wx + 60) / 120) * r.width, r.top - a.top + ((wy + 70) / 90) * r.height] as Pt
  }, { dir: [0, -1] })
  let wickDone = false
  /** the dot moves on to the next unlit candle; it steps aside while the depth stake carries the dot */
  const moveDot = () => {
    if (wickDone) return
    const k = ORDER.find((x) => !lit.has(x))
    if (k == null) return wickDot.done(), (wickDone = true)
    nextK = k
    wickDot.el.classList.toggle('out', !!focusMark)
    GD.refresh()
  }

  // ── living motion (the koi's round, caustics, flames) rests after 10 s without input
  let idleT = 0
  function wake() {
    root.classList.remove('idle')
    clearTimeout(idleT)
    idleT = window.setTimeout(() => root.classList.add('idle'), 10000)
  }
  wake()
  root.addEventListener('pointermove', wake)
  ctx.onCleanup(() => clearTimeout(idleT))

  function setFocus(f: number, byHand: boolean) {
    focus = f
    root.style.setProperty('--f', f.toFixed(3))
    root.classList.toggle('byhand', byHand)
  }
  /** a voice heard: its candle lit, the focus moved; its words come up on the water beside that candle */
  function hear(k: number, i: number) {
    wake()
    lit.add(k)
    heard++
    if (heard === 1) {
      // after the first voice: the hidden gesture (drag the water up or down to look at the code below), shown and said
      focusMark = GD.dot(ring, { dir: [0, 1] })
      marks.classList.add('on')
      ctx.prompt(K.focusPrompt)
    } else if (heard < 5 && !focusMark) ctx.prompt(fill(K.left, { n: 5 - heard }))
    setFocus(FOCUS[i], false)
    if (heard === 5) (focusMark?.done(), (focusMark = null))
    moveDot()
    root.dataset.voice = String(i)
    root.classList.add(`v${i}`)
    const b = root.querySelectorAll<HTMLElement>('.p2c-stone')[k]
    if (!b) return
    const { W, wide } = size
    const cw = wide ? Math.min(540, W * 0.4) : W - 20
    const x = clamp(b.offsetLeft + b.offsetWidth / 2, cw / 2 + 12, W - cw / 2 - 12)
    root.style.setProperty('--cx', `${f1(x)}px`)
    root.style.setProperty('--cw', `${f1(cw)}px`)
    // on the water just above the stone (its box's top is above the rock's crown)
    root.style.setProperty("--cb", `${f1(size.H - b.offsetTop + (wide ? 6 : 34))}px`)
  }

  // ── painting: the bottom (two focuses), the surface, the near things; colours read here, on mount and theme change
  let last = ''
  ctx.onCleanup(onPrefs(() => {
    const key = cssVar('--water') + cssVar('--ink')
    if (key === last || !size.W) return
    paint()
  }))
  /** paint the stage in three slices (bed, its soft copy, the surface): no long task on a slow phone */
  function* painting() {
    last = cssVar('--water') + cssVar('--ink')
    const { W: w, H: hh, wide } = size
    const W = Math.round(w), H = Math.round(hh)
    const dpr = Math.min(devicePixelRatio || 1, low ? 1.25 : 2)
    const p = pondOf(w, hh, wide)
    const waterD = blob(p.cx, p.cy, p.rx, p.ry, 3629, 0.07, 40)
    deep.style.clipPath = `path('${waterD}')`
    const off = yield* paintBottom(W, H, dpr, p)
    // the soft copy: the same bed, blurred (a filter where the canvas has one; else shrunk and grown back gently)
    for (const c of [bSharp, bSoft]) {
      c.width = off.width
      c.height = off.height
    }
    const sx: CanvasRenderingContext2D = bSoft.getContext('2d')!
    if (typeof (sx as { filter?: string }).filter === 'string') {
      sx.filter = `blur(${f1(3.2 * dpr)}px)`
      sx.drawImage(off, 0, 0)
      sx.filter = 'none'
    } else {
      const q = document.createElement('canvas')
      q.width = Math.max(1, Math.round(off.width / 3))
      q.height = Math.max(1, Math.round(off.height / 3))
      const qx = q.getContext('2d')!
      qx.imageSmoothingQuality = 'high'
      qx.drawImage(off, 0, 0, q.width, q.height)
      sx.imageSmoothingQuality = 'high'
      sx.drawImage(q, 0, 0, off.width, off.height)
    }
    bSharp.getContext('2d')!.drawImage(off, 0, 0)
    yield
    paintSurface(w, hh, p, waterD, wide)
    // the koi's round: an ellipse in the middle of the water (the parent squashes the turn to the 60° view)
    // (the upper left of the water is kept clear for the insight: the koi circles right of it)
    Object.assign(koiRot.style, { left: `${f1(p.cx + p.rx * 0.33)}px`, top: `${f1(p.cy - p.ry * 0.1)}px` })
    const kw = clamp(p.rx * 0.4, 110, 210), kr = p.rx * 0.16
    // the depth stake on the right: where the surface and the bottom are, and the ring between them
    const set = (k: string, v: number) => root.style.setProperty(k, `${f1(v)}px`)
    set('--sx', p.cx + p.rx * 0.8)
    set('--st', p.cy - p.ry * 0.3)
    set('--sw', p.cy - p.ry * 0.08)
    set('--sb', p.cy + p.ry * 0.36)
    Object.assign(koiSvg.style, { left: `${f1(kr - kw / 2)}px`, top: `${f1(-kw * 0.3)}px`, width: `${f1(kw)}px`, height: `${f1(kw * 0.6)}px` })
  }
  let slices: { cancel(): void } | null = null
  ctx.onCleanup(() => slices?.cancel())
  function paint() {
    if (!size.W) measure()
    slices?.cancel()
    slices = sliced(painting(), { sync: ctx.reduced, budget: 8 })
  }

  /** the pond's bed: sandy shallows darkening to the deep middle, flat stones with the game's code written on them */
  function* paintBottom(W: number, H: number, dpr: number, p: { cx: number; cy: number; rx: number; ry: number }): Generator<void, HTMLCanvasElement> {
    const { cx, cy, rx, ry } = p
    const c = document.createElement('canvas')
    c.width = Math.round(W * dpr)
    c.height = Math.round(H * dpr)
    const g = c.getContext('2d')!
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    const dark = document.documentElement.dataset.theme === 'dark'
    const moonC = cssVar('--moon'), water = cssVar('--water'), wash = cssVar('--wash'), stepMid = cssVar('--step-mid'), stepLo = cssVar('--step-lo'), moss = cssVar('--moss-b'), sand = cssVar('--rock-mid')
    const r = rng(3630)
    // depth: sandy shallows at the rim, dark in the middle
    g.save()
    g.translate(cx, cy)
    g.scale(1, ry / rx)
    const bed = g.createRadialGradient(0, 0, rx * 0.05, 0, 0, rx * 1.02)
    bed.addColorStop(0, dark ? mixc(water, wash, 0.4) : mixc(water, wash, 0.42))
    bed.addColorStop(0.55, dark ? mixc(water, sand, 0.14) : mixc(water, wash, 0.16))
    bed.addColorStop(0.86, dark ? mixc(sand, water, 0.62) : mixc(water, sand, 0.3))
    bed.addColorStop(1, dark ? mixc(sand, water, 0.45) : mixc(sand, water, 0.35))
    g.fillStyle = bed
    g.fillRect(-rx * 1.2, -rx * 1.2, rx * 2.4, rx * 2.4)
    g.restore()
    // pebbles in the shallows
    for (let i = 0; i < 70; i++) {
      const a = r() * TAU, d = 0.8 + r() * 0.22
      g.fillStyle = r() < 0.5 ? stepMid : stepLo
      g.globalAlpha = 0.45
      g.beginPath()
      g.ellipse(cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, 3 + r() * 7, 2 + r() * 4, r(), 0, TAU)
      g.fill()
    }
    g.globalAlpha = 1
    // three flat stones on the bed, foreshortened; the code written on them in ink, bent a little by the water
    const slabs: [number, number, number, number, number][] = [[0.2, -0.42, 0.4, 0.36, -0.06], [0.56, -0.12, 0.36, 0.36, 0.05], [0.27, 0.16, 0.46, 0.32, 0.02]]
    let line = 0
    const fs = clamp(rx * 0.03, 10, 15)
    g.font = `500 ${fs}px ui-monospace, 'SF Mono', Menlo, Consolas, monospace`
    g.textBaseline = 'top'
    const cwid = g.measureText('M').width
    for (const [u, v, sw, sh, rot] of slabs) {
      const x = cx + u * rx, y = cy + v * ry, w2 = sw * rx, h2 = sh * ry
      g.save()
      g.translate(x, y)
      g.rotate(rot)
      g.beginPath()
      const pts: Pt[] = []
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * TAU
        const k = 1 + (r() - 0.5) * 0.08
        // a flat river slab: rounded, uneven, one edge chipped
        const kk = k + Math.sin(a * 3 + line) * 0.06 + (i === 5 ? -0.12 : 0)
        pts.push([Math.cos(a) * w2 * 0.56 * kk * Math.abs(Math.cos(a)) ** 0.45, Math.sin(a) * h2 * 0.58 * kk * Math.abs(Math.sin(a)) ** 0.45])
      }
      pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)))
      g.closePath()
      const sg = g.createLinearGradient(0, -h2 / 2, 0, h2 / 2)
      // seen through the water: the stone takes the water's colour
      sg.addColorStop(0, dark ? mixc(stepLo, water, 0.1) : mixc(stepMid, water, 0.45))
      sg.addColorStop(1, dark ? mixc(stepLo, water, 0.4) : mixc(stepLo, water, 0.5))
      g.fillStyle = sg
      g.shadowColor = 'rgba(0,0,0,0.35)'
      g.shadowBlur = 14
      g.shadowOffsetY = 7
      g.fill()
      g.shadowColor = 'transparent'
      g.strokeStyle = moss
      g.globalAlpha = 0.4
      g.lineWidth = 3
      g.stroke()
      g.globalAlpha = 1
      // the code, char by char, each lifted and shifted by the water's slow wave (refraction), at full resolution
      // the code in silver ink, written on the stone
      g.fillStyle = dark ? mixc(moonC, water, 0.18) : wash
      g.globalAlpha = dark ? 0.86 : 0.8
      const rows = Math.max(3, Math.floor((h2 * 0.86) / (fs * 1.32)))
      const cols = Math.floor((w2 * 0.86) / cwid)
      for (let k = 0; k < rows && line < CODE.length; k++, line++) {
        const t = CODE[line].length > cols ? `${CODE[line].slice(0, cols - 1)}…` : CODE[line]
        const y0 = -h2 * 0.42 + k * fs * 1.32
        for (let j = 0; j < t.length; j++) {
          const ch = t[j]
          if (ch === ' ') continue
          const x0 = -w2 * 0.43 + j * cwid
          g.fillText(ch, x0 + Math.sin(y0 * 0.09 + j * 0.05) * 0.9, y0 + Math.sin(x0 * 0.045 + k * 0.8) * 1.3)
        }
      }
      g.globalAlpha = 1
      g.restore()
      yield // one slab per slice: the code is written char by char
    }
    return c
  }

  /** the surface (SVG): banks all round, the moon road, pads, a shard; then the near things that come and go */
  function paintSurface(w: number, hh: number, p: { cx: number; cy: number; rx: number; ry: number }, waterD: string, wide: boolean) {
    const { cx, cy, rx, ry } = p
    surf.setAttribute('viewBox', `0 0 ${f1(w)} ${f1(hh)}`)
    front.setAttribute('viewBox', `0 0 ${f1(w)} ${f1(hh)}`)
    const r = rng(3633)
    const mx = cx + rx * 0.32, my = cy - ry * 0.55
    let road = ''
    for (let i = 0; i < 18; i++) {
      const t = i / 17, y = my + t * ry * 0.95, len = rx * (0.03 + t * 0.11) * (0.5 + r())
      road += stroke([[mx - len / 2 + (r() - 0.5) * rx * 0.04 * t, y], [mx + len / 2, y + (r() - 0.5) * 2]], 1.4 + t * 1.6, 0.2, 0.2, 0.1)
    }
    const pads = [[-0.78, 0.36, 0.06], [-0.3, 0.6, 0.05], [0.7, -0.1, 0.06], [0.58, 0.44, 0.045]].map(([u, v, k]) => s('path', { class: 't36v-pad', d: `M${f1(cx + u * rx)} ${f1(cy + v * ry)}m${f1(k * rx)} 0a${f1(k * rx)} ${f1(k * rx * 0.8)} 0 1 1 ${f1(-k * rx * 0.3)} ${f1(-k * rx * 0.5)}L${f1(cx + u * rx)} ${f1(cy + v * ry)}z` }))
    const shard = (x: number, y: number, k: number) => `M${f1(x)} ${f1(y)}q${f1(3.5 * k)} ${f1(-1.2 * k)} ${f1(4.6 * k)} ${f1(2 * k)}q${f1(-2.6 * k)} ${f1(-1.4 * k)} ${f1(-4.6 * k)} ${f1(-2 * k)}Z`
    // the banks: stones set round the water's edge (smaller toward the far side), moss between them, grass, reeds
    const edge: SVGElement[] = []
    let mossD = ''
    // groups of one to three stones round the far half and the sides, gaps of sand and moss between them
    const spots: [number, number][] = []
    for (let a = Math.PI * 0.94; a < Math.PI * 2.08; ) {
      const n = 1 + Math.floor(r() * 3)
      for (let k = 0; k < n; k++) spots.push([a + k * 0.07, k ? 0.5 + r() * 0.4 : 0.8 + r() * 0.7])
      a += 0.16 + n * 0.07 + r() * (low ? 0.5 : 0.32)
    }
    for (const [i, [a, big]] of spots.entries()) {
      const far = Math.max(0, -Math.sin(a)) // 1 at the far bank
      const ex = cx + Math.cos(a) * rx * (1.02 + r() * 0.03), ey = cy + Math.sin(a) * ry * (1.03 + r() * 0.03)
      const sw = rx * 0.1 * big * (1 - far * 0.45), sh = sw * (0.4 + r() * 0.3)
      const { top, d } = rock(sw, sh, 3640 + i)
      edge.push(s('g', { transform: `translate(${f1(ex)} ${f1(ey + sh * 0.25)})` },
        s('ellipse', { class: 't36v-bsh', cx: f1(sw * 0.1), cy: 1, rx: f1(sw * 0.6), ry: f1(sh * 0.2) }),
        s('path', { d, fill: 'url(#p2-rock)' }), s('path', { d, fill: 'url(#p2-shade)' }),
        s('path', { class: 't36v-brim', d: stroke(top.slice(4, 22), Math.max(1, sh * 0.06), 0.3, 0.4, 0.15) })))
      if (r() < 0.7) mossD += blob(ex + (r() - 0.5) * sw, ey + sh * 0.3, sw * 0.5, sh * 0.25, 3660 + i, 0.3, 10)
    }
    // the near sides of the bank (left and right, under the candle stones' shoulders)
    for (const side of [-1, 1]) {
      const a = side < 0 ? Math.PI * 0.86 : Math.PI * 0.14
      const ex = cx + Math.cos(a) * rx * 1.04, ey = cy + Math.sin(a) * ry * 1.05
      const sw = rx * 0.14, sh = sw * 0.5
      edge.push(s('g', { transform: `translate(${f1(ex)} ${f1(ey)})` }, s('path', { d: rock(sw, sh, 3690 + side).d, fill: 'url(#p2-rock)' }), s('path', { d: rock(sw, sh, 3690 + side).d, fill: 'url(#p2-shade)' })))
    }
    surf.replaceChildren(
      // the far half of the water mirrors the sky; the near half lets you see down
      s('path', { d: waterD, fill: 'url(#t36v-sheen)' }),
      // the bank all round: earth and sand, darker away from the water; a wet dark line where it meets the water
      s('path', { class: 't36v-bank', d: `M-20 -20H${f1(w + 20)}V${f1(hh + 20)}H-20Z${waterD}`, 'fill-rule': 'evenodd' }),
      // the pond's stone wall: its far inner face shows as a crescent above the water, the lip throws a shadow all round
      s('clipPath', { id: 't36v-wclip2' }, s('path', { d: waterD })),
      s('g', { 'clip-path': 'url(#t36v-wclip2)' },
        s('path', { class: 't36v-wall', d: `${waterD}${blob(cx, cy + ry * 0.075, rx * 0.985, ry * 0.95, 3629, 0.07, 40)}`, 'fill-rule': 'evenodd' }),
        s('path', { class: 't36v-lipsh', d: waterD, filter: low ? null : 'url(#ink-wash)' })),
      s('path', { class: 't36v-wet', d: waterD, filter: 'url(#ink-wash)' }),
      ink(mossD, 't36v-bmoss', 'wash'),
      ...edge,
      reeds(cx - rx * 0.98, cy - ry * 0.35, Math.max(24, ry * 0.5), 3670, 7),
      reeds(cx + rx * 1.0, cy - ry * 0.55, Math.max(18, ry * 0.36), 3671, 5),
      grass(cx - rx * 0.55, cy - ry * 1.12, Math.max(14, rx * 0.06), 3672),
      grass(cx + rx * 0.3, cy - ry * 1.1, Math.max(12, rx * 0.05), 3673),
      // the moon's broken road and its glow on the water
      s('ellipse', { cx: f1(mx), cy: f1(my + ry * 0.4), rx: f1(rx * 0.2), ry: f1(ry * 0.55), fill: 'url(#t36v-moonglow)' }),
      s('ellipse', { cx: f1(mx), cy: f1(my), rx: f1(rx * 0.06), ry: f1(rx * 0.034), fill: 'url(#t36v-moondisc)' }),
      ink(road, 't36v-road', 'dry'),
      ...pads,
      s('g', { class: 't36v-shardg' }, ink(shard(cx + rx * 0.1, cy + ry * 0.3, clamp(rx * 0.01, 2, 5)), 't36v-shard', 'rough')),
      s('g', { class: 't36v-rings' }, ...[0.06, 0.1, 0.15].map((k) => s('ellipse', { cx: f1(cx + rx * 0.12), cy: f1(cy + ry * 0.32), rx: f1(rx * k), ry: f1(rx * k * 0.55) }))))
    // the near things: candle flames laid on the water, cracks through half the code (Veracode), the lantern rising
    // (Collins), the lashed fence round the shallows (newcomer), the ensō
    let cracks = ''
    for (let i = 0; i < 7; i++) {
      const x0 = cx + (r() - 0.6) * rx * 0.8, y0 = cy - ry * 0.15 + (r() - 0.5) * ry * 0.6
      const pts: Pt[] = [[x0, y0]]
      for (let k = 0; k < 4; k++) pts.push([pts[k][0] + rx * (0.03 + r() * 0.05), pts[k][1] + (r() - 0.5) * ry * 0.08])
      cracks += stroke(pts, 1.6, 0.1, 0.4, 0.3)
    }
    // the fence: stakes in an arc round the left shallows, two cords lashed to each, their shadows on the water
    const fc: Pt = [cx - rx * 0.55, cy + ry * 0.45]
    const stakes: Pt[] = [], tips: Pt[] = []
    let stakeD = '', shadowD = ''
    const nS = wide ? 15 : 11
    for (let i = 0; i < nS; i++) {
      const a = Math.PI * (0.12 + (i / (nS - 1)) * 0.76)
      const x = fc[0] + Math.cos(a) * rx * 0.26, y = fc[1] + Math.sin(a) * ry * 0.26
      const hgt = ry * (0.15 + (i % 3) * 0.022), sw = Math.max(1.8, rx * 0.007)
      stakes.push([x, y])
      tips.push([x, y - hgt])
      stakeD += `M${f1(x - sw)} ${f1(y)}L${f1(x - sw * 0.9)} ${f1(y - hgt)}Q${f1(x)} ${f1(y - hgt - sw * 1.5)} ${f1(x + sw * 0.9)} ${f1(y - hgt)}L${f1(x + sw)} ${f1(y)}Z`
      // a node on each stake
      stakeD += `M${f1(x - sw * 1.1)} ${f1(y - hgt * 0.55)}h${f1(sw * 2.2)}v${f1(sw * 0.6)}h${f1(-sw * 2.2)}Z`
      shadowD += stroke([[x + 2, y + 1], [x + hgt * 0.5, y + hgt * 0.18]], sw * 1.6, 0.1, 0.4, 0.4)
    }
    const cord = (k: number) => stakes.map(([x, y], i) => [x, y - (y - tips[i][1]) * k] as Pt)
    let ties = ''
    for (const k of [0.35, 0.75]) for (const [x, y] of cord(k)) ties += `M${f1(x - 3)} ${f1(y - 2.4)}L${f1(x + 3)} ${f1(y + 2.4)}M${f1(x + 3)} ${f1(y - 2.4)}L${f1(x - 3)} ${f1(y + 2.4)}`
    const lx = cx + rx * 0.55, ly = cy - ry * 0.36, lr = clamp(rx * 0.035, 9, 22)
    const enso = Array.from({ length: 41 }, (_, i) => { const a = -1.75 + (i / 40) * Math.PI * 1.88; return [cx + rx * 0.34 + Math.cos(a) * rx * 0.2, cy - ry * 0.1 + Math.sin(a) * ry * 0.34] as Pt })
    // each candle's flame, laid on the water as a long warm streak running up from the stone
    const streaks = feet.map((f, k) => {
      const rr = rng(3680 + k)
      const y0 = f.y - 48 * f.s, len = Math.min(hh * 0.24, Math.max(40, y0 - (cy - ry * 0.2)))
      let d = ''
      for (let i = 0; i < 12; i++) {
        const t = i / 11, y = y0 - t * len, wd = (10 + 26 * f.s) * (1 - t * 0.7) * (0.5 + rr())
        d += stroke([[f.x - wd / 2 + (rr() - 0.5) * 8, y], [f.x + wd / 2, y + (rr() - 0.5) * 2]], 1.6 + (1 - t) * 2.2, 0.2, 0.2, 0.1)
      }
      return s('g', { class: `t36v-streak t36v-sk${k}` },
        s('ellipse', { cx: f1(f.x), cy: f1(y0 - len * 0.35), rx: f1(14 + 22 * f.s), ry: f1(len * 0.6), fill: 'url(#t36v-warm)' }),
        ink(d, 't36v-glint', 'dry'))
    })
    front.replaceChildren(
      s('clipPath', { id: 't36v-wclip' }, s('path', { d: waterD })),
      s('g', { 'clip-path': 'url(#t36v-wclip)' }, s('g', { class: 't36v-streaks', filter: low ? null : 'url(#ink-wash)' }, ...streaks)),
      s('g', { class: 't36v-cracks' }, ink(cracks, 't36v-crack', 'rough')),
      s('g', { class: 't36v-fence' },
        ink(shadowD, 't36v-fshadow', 'wash'),
        s('path', { class: 't36v-stake', d: stakeD }),
        ...[0.35, 0.75].map((k) => s('path', { class: 't36v-rope', d: stroke(curve(cord(k)[0], cord(k)[Math.floor(nS / 2)], cord(k)[nS - 1], 18), 1.1, 0.1, 0.1, 0.5) })),
        s('path', { class: 't36v-tie', d: ties })),
      // the depth stake: bamboo, its top above the water, its foot down on the bed (seen through the water)
      s('g', { class: 't36v-stake2' },
        s('path', { class: 't36v-spole', d: `M${f1(cx + rx * 0.8 - 2.5)} ${f1(cy - ry * 0.3)}h5V${f1(cy - ry * 0.08)}h-5Z` }),
        s('path', { class: 't36v-spole t36v-under', d: `M${f1(cx + rx * 0.8 - 2.2)} ${f1(cy - ry * 0.08)}h4.4V${f1(cy + ry * 0.36)}h-4.4Z` }),
        s('ellipse', { class: 't36v-swl', cx: f1(cx + rx * 0.8), cy: f1(cy - ry * 0.08), rx: 9, ry: 2.4 }),
        s('path', { class: 't36v-snotch', d: `M${f1(cx + rx * 0.8 - 5)} ${f1(cy - ry * 0.08)}h10M${f1(cx + rx * 0.8 - 5)} ${f1(cy + ry * 0.36)}h10` })),
      s('g', { class: 't36v-lantern' },
        s('ellipse', { cx: f1(lx), cy: f1(ly), rx: f1(lr * 4), ry: f1(lr * 2.2), fill: 'url(#t36v-warm)' }),
        s('rect', { class: 't36v-lbody', x: f1(lx - lr * 0.7), y: f1(ly - lr * 1.1), width: f1(lr * 1.4), height: f1(lr * 1.5), rx: f1(lr * 0.25) }),
        s('rect', { class: 't36v-lseal', x: f1(lx - lr * 0.22), y: f1(ly - lr * 0.62), width: f1(lr * 0.44), height: f1(lr * 0.44) }),
        s('path', { class: 't36v-lcap', d: `M${f1(lx - lr * 0.8)} ${f1(ly - lr * 1.1)}h${f1(lr * 1.6)}M${f1(lx - lr * 0.8)} ${f1(ly + lr * 0.4)}h${f1(lr * 1.6)}` })),
      s('g', { class: 't36v-ensog' }, ink(stroke(enso, Math.max(4, rx * 0.025), 0.06, 0.55, 0.12), 't36v-enso', 'rough')))
  }
}

function mixc(a: string, b: string, k: number) {
  const p = (c: string) => (c.startsWith('#') && c.length >= 7 ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) : [128, 128, 128])
  const A = p(a), B = p(b)
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`
}
