import raw from '../../content/tram-20.json'
import { h } from '../../core/dom'
import type { Fact } from '../../core/content'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import { onPrefs } from '../../core/prefs'
import type { SceneCtx } from '../types'
import type { Tide } from '../../ui/part2/types'
import type { TideGeo } from '../../ui/part2/tide'
import { progressTide } from '../../ui/part2/tide'
import { markGlyph, markOf } from '../../ui/part2/marks'
import { clamp, onSize, rng, stableHeight, stroke, type Pt } from '../../ui/part2/ink'
import { brush, canvas, col, dprOf, fern, fit, glow, mistBank, mix, mossDots, paintRock, palette, poly, reeds, softFill, sprite, type Pal } from './ink2d'

const S = raw.scenes.well
const T = S.tide as Tide
const TAU = Math.PI * 2
const K = 0.9 // the mouth seen from 65° above: an ellipse sin 65° high …
const COS = 0.42 // … and anything upright stands cos 65° tall
/** where each milestone's pebble comes to rest: depth d (0 mouth … 1 water) and its angle on the far wall (or on the water) */
const REST: { d: number; a: number; w?: [number, number] }[] = [
  { d: 0.15, a: 1.08 * Math.PI }, // the 2025 ledges, on the left wall, under the beam's shadow-free side
  { d: 0.28, a: 1.24 * Math.PI },
  { d: 0.55, a: 1.82 * Math.PI }, // Jacobian, deeper, on the right
  { d: 1, a: 0, w: [-0.38, 0.05] }, // Navier–Stokes reaches the water
  { d: 1, a: 0, w: [0.3, -0.1] }, // 722 drafts: a rain, not a stone
  { d: 1, a: 0, w: [0.05, 0.12] }, // today: the still water
]
// the well frame (× Rw): two square cedar posts on a diagonal, far-left and near-right, the beam high across them
const POST = 1.44, TF = 1.12 * Math.PI, TN = 0.12 * Math.PI, HB = 1.1, BW = 0.1, BH = 0.12, PW = 0.11

/**
 * Scene 1 · Giếng sỏi (canvas, TOP: looking down 65° into an old well). The moon runs an arc along the top of the frame
 * (the tide's slider, its own track); its beam — soft-edged, dust hanging in it — falls into the well and lands on the far
 * wall as a bent oval of light, and every shadow in the shaft (beam, rope, bucket) swings with it. The rim is a ring of
 * uneven blocks (lit tops, dark inner faces, ink-dot moss); a cedar frame stands on the diagonal, foreshortened, its beam
 * casting across the mouth. Each milestone is a pebble on the far rim: when the moon passes over it, it flips and drops,
 * shrinking with depth, to rest on a ledge deeper than the one before, its name cut into the wall beside it — 2025 high,
 * 2026 lower. Navier–Stokes hits the water: a splash, rings that break the moon's reflection; 722 drafts fall as a rain of
 * 722 drops; today the water stills and the Clay rule is a ring brushed and cut into it; the forecast is mist at the
 * bottom. The well is baked once (sliced); pebbles, beam, shadows and water are a light overlay redrawn on change; the
 * loop runs only while something falls or ripples.
 */
export function wellScene(ctx: SceneCtx) {
  const ms = T.milestones
  const n = ms.length
  const low = ctx.quality === 'low'
  const still = low || ctx.reduced
  const stableH = stableHeight(ctx, [S.insight as Fact])

  const base = canvas('t20w-base')
  const fx = canvas('t20w-fx')
  const tags = ms.map((m, i) => {
    const mk = markOf(m.fact as Fact)
    return h('p', { class: 't20w-tag' }, S.tide.milestones[i].short, mk ? markGlyph(mk) : '') // the full name is on the card
  })
  const yearOf = (m: (typeof ms)[number]) => m.date.slice(0, 4)
  const yearList = [...new Set(ms.map(yearOf))]
  const years = yearList.map((y) => h('span', { class: 't20w-year' }, y))
  const paint = h('div', { class: 't20w-paint', 'aria-hidden': 'true' }, base, fx, ...years, ...tags)

  // ── geometry (art px), computed when the tide lays out its band ──
  let W = 0, H = 0, Wc = 0, Hc = 0, Rw = 0, bx = 0, by = 0, wide = true
  const sc = (d: number) => 1 / (1 + 1.6 * d)
  const ringY = (d: number) => Hc + (1 - sc(d)) * Rw * 0.62
  /** a point of the frame (× Rw: X right, Y up, Z toward us) seen from above, with a little true perspective */
  const at3 = (X: number, Y: number, Z: number): Pt => {
    const s = 8 / (8 - Z * COS - Y * K)
    return [Wc + X * Rw * s, Hc + (Z * K - Y * COS) * Rw * s]
  }
  const moonAt = (t: number): Pt => {
    const A = Rw * 1.2
    const x = Wc - A + 2 * A * t
    const y = (wide ? H * 0.115 : H * 0.07) - Math.sin(Math.PI * t) * (wide ? H * 0.05 : H * 0.03)
    return [x - bx, y - by]
  }
  const rimAt = (t: number): Pt => {
    const x = Wc - Rw * 1.2 + 2.4 * Rw * t
    const u = clamp((x - Wc) / (Rw * 1.13), -0.97, 0.97)
    return [x, Hc - K * Rw * 1.13 * Math.sqrt(1 - u * u)]
  }
  /** the far-wall point at depth d straight below screen x (where the moonbeam lands) and the wall's angle there */
  const wallAt = (x: number, d: number): [number, number, number] => {
    const u = clamp((x - Wc) / (Rw * sc(d)), -0.96, 0.96)
    const a = Math.PI + Math.acos(-u) // far half: π … 2π
    return [x, ringY(d) + Math.sin(a) * Rw * sc(d) * K, a]
  }
  function geo(g: TideGeo) {
    W = ctx.art.clientWidth
    H = stableH(ctx.art.clientHeight)
    wide = W / H > 1.15
    bx = (W - g.w) / 2
    by = clamp(H * 0.04, 0, 24)
    Rw = wide ? Math.min(H * 0.34, W * 0.19) : Math.min(W * 0.29, H * 0.25) // the frame's posts stay inside the art
    Wc = wide ? W * 0.39 : W * 0.5
    Hc = wide ? H * 0.57 : H * 0.37
    return moonAt
  }

  // ── state ──
  let armed = false
  let tt = 0 // where the moon is (0 … 1)
  let at = 0 // nearest stop
  let now = 0
  const tf = new Float32Array(n).fill(-1) // when each pebble started to fall (−1: still on the rim)
  const LAND = 1.1
  let fog = false
  let pal: Pal = palette()
  let g: CanvasRenderingContext2D | null = null
  let dpr = 1
  let peb: HTMLCanvasElement[] = []
  let pebW: number[] = [] // each pebble's width on the rim (css px): deep ones start bigger so they still read at rest
  let beamSpr: HTMLCanvasElement | null = null // the moonbeam, soft-edged, in its own space (x along 0 … BL, y across)
  let beamHull: Path2D | null = null // the beam's silhouette (shadows fall everywhere but on it)
  let beamTop: Pt[] = []
  let shadowSpr: HTMLCanvasElement | null = null, shX = 0, shY = 0, offBeam: Path2D | null = null // the frame's shadow, blurred once
  let ropeTop: Pt = [0, 0]
  let job: ReturnType<typeof sliced> | null = null
  let ready = false
  const r0 = rng(2010)
  const drops = Array.from({ length: 722 }, () => [r0(), r0(), r0(), r0()]) // the 722 drafts as a rain: start, end, delay
  const dust = Array.from({ length: 34 }, () => [r0(), r0() * 2 - 1, r0(), r0()]) // motes in the beam: along, across, size, phase
  const BL = 220, BWD = 90 // the beam sprite's box

  const def = progressTide(T, {
    label: S.label, prompt: S.prompt, insight: S.insight as Fact, aria: S.moonAria,
    track: geo,
    onStep(i, t) {
      at = i
      tt = t
      if (armed) reach(t)
      loop.wake()
    },
  })
  def.mount(ctx)
  const root = ctx.art.querySelector<HTMLElement>('.p2t')!
  root.classList.add('t20w')
  root.prepend(paint, h('p', { class: 'visually-hidden' }, S.art))
  // the key to the marks, on screen from the start (audit v3 20-1: it was hidden in the detail)
  root.append(h('p', { class: 't20w-legend' }, S.legend))
  const arm = () => {
    armed = true
  }
  root.addEventListener('pointerdown', arm, { capture: true })
  root.addEventListener('keydown', arm, { capture: true })
  if (still) tf.fill(-LAND * 4) // low / reduced: every pebble already rests on its ledge, the rings frozen

  function reach(t: number) {
    let lag = 0
    for (let i = 0; i < n; i++) {
      if (tf[i] >= 0 || still || t < i / n - 0.02) continue
      tf[i] = now + lag
      lag += 0.28
      ctx.chime('soft')
    }
    if (t > 0.999) fog = true
    loop.start()
  }

  const loop = createLoop(root, (_t, dt) => {
    now += dt
    drawFx()
    // keep running while a pebble falls, the splash rings spread or the rain falls
    let busy = false
    for (let i = 0; i < n; i++) if (tf[i] >= 0 && now - tf[i] < LAND + 2.6) busy = true
    return busy
  })
  let raf0 = 0
  ctx.onCleanup(() => {
    loop.dispose()
    job?.cancel()
    cancelAnimationFrame(raf0)
  })

  function layout() {
    if (!Rw) return
    dpr = dprOf(low)
    root.classList.toggle('wide', wide)
    Object.assign(paint.style, { width: `${W}px`, height: `${H}px` })
    g = fit(fx, W, H, dpr)
    pebW = ms.map((_, i) => Math.max(Rw * 0.17, 21 / Math.max(0.55, sc(REST[i].d)))) // ≥ ~20 px where it rests
    frame()
    // labels: the years carved on the far wall; each pebble's name cut into the wall beside its ledge
    placeTags()
    job?.cancel()
    cancelAnimationFrame(raf0)
    const start = () => {
      job = sliced(bake(), { sync: ctx.reduced || ready, budget: 4 }) // small slices: each frame's raster stays short too
      job.done.then(() => {
        ready = true
        drawFx()
      })
    }
    // the first paint starts a frame later, so mounting (the tide's layout and ours) stays one short task
    if (ctx.reduced || ready) start()
    else raf0 = requestAnimationFrame(start)
  }

  /** the resting place of pebble i (art px) */
  function restAt(i: number): Pt {
    const p = REST[Math.min(i, REST.length - 1)]
    const s0 = sc(p.d)
    if (p.w) return [Wc + p.w[0] * Rw * s0, ringY(p.d) + p.w[1] * Rw * s0 * K]
    return [Wc + Math.cos(p.a) * Rw * s0 * 0.94, ringY(p.d) + Math.sin(p.a) * Rw * s0 * K * 0.94]
  }

  // the frame's geometry in screen px: the beam's faces and silhouette, where the rope leaves the pulley
  function frame() {
    const fp = [Math.cos(TF) * POST, Math.sin(TF) * POST], np = [Math.cos(TN) * POST, Math.sin(TN) * POST]
    const dl = Math.hypot(np[0] - fp[0], np[1] - fp[1]), ux = (np[0] - fp[0]) / dl, uz = (np[1] - fp[1]) / dl
    const e0 = [fp[0] - ux * 0.09, fp[1] - uz * 0.09], e1 = [np[0] + ux * 0.09, np[1] + uz * 0.09]
    const c = (e: number[], side: number, y: number) => at3(e[0] - uz * BW * 0.5 * side, y, e[1] + ux * BW * 0.5 * side)
    const yT = HB + BH / 2, yB = HB - BH / 2
    beamTop = [c(e0, -1, yT), c(e1, -1, yT), c(e1, 1, yT), c(e0, 1, yT), c(e0, 1, yB), c(e1, 1, yB), c(e1, -1, yB), c(e0, -1, yB)]
    beamHull = poly(hull(beamTop))
    ropeTop = at3(0, yB, 0)
  }

  // ── the baked well ──
  function* bake() {
    const P = pal
    const gb = fit(base, W, H, dpr)
    const r = rng(2011)
    // the ground round the well: dark earth and moss fading into the paper, gravel, a few stones
    glow(gb, Wc, Hc + Rw * 0.15, Rw * 2.6, Rw * 2.2, mix(P['moss-b'], P['rock-lo'], 0.5), P.dark ? 0.7 : 0.4, 0.55)
    glow(gb, Wc, Hc + Rw * 0.35, Rw * 1.8, Rw * 1.15, P.umbra, P.dark ? 0.5 : 0.16, 0.5)
    glow(gb, Wc + Rw * 0.4, Hc - Rw * 0.2, Rw * 1.6, Rw * 1.1, P.moon, P.dark ? 0.08 : 0.14, 0.4)
    gb.fillStyle = col(P.rake, 1.4)
    for (let i = 0; i < 900; i++) {
      const a = r() * TAU, rr = Rw * (1.3 + r() * r() * 1.4)
      gb.globalAlpha = 0.3 + r() * 0.5
      gb.fillRect(Wc + Math.cos(a) * rr, Hc + Math.sin(a) * rr * K, 1.2, 1.2)
    }
    gb.globalAlpha = 1
    for (let i = 0; i < 7; i++) {
      const a = r() * TAU, rr = Rw * (1.6 + r() * 0.7)
      const w = Rw * (0.08 + r() * 0.1)
      paintRock(gb, P, Wc + Math.cos(a) * rr, Hc + Math.sin(a) * rr * K, w, w * 0.5, 2012 + i, { light: 1, cast: 0.8, moss: r() < 0.4 ? 0.6 : 0 })
      if (i % 3 === 2) yield
    }
    yield

    // the shaft: rings of stone narrowing and darkening with depth down to a small disc of water
    gb.save()
    gb.beginPath()
    gb.ellipse(Wc, Hc, Rw, Rw * K, 0, 0, TAU)
    gb.clip()
    const top = P['rock-mid'], deep = mix(P.wash, P.umbra, 0.5)
    for (let i = 0; i <= 40; i++) {
      const d = i / 40
      gb.fillStyle = col(mix(mix(top, P['rock-lo'], Math.min(1, d * 2.2)), deep, Math.pow(d, 0.6) * (P.dark ? 0.95 : 0.85)))
      gb.beginPath()
      gb.ellipse(Wc, ringY(d), Rw * sc(d), Rw * sc(d) * K, 0, 0, TAU)
      gb.fill()
    }
    yield
    // stone courses and joints on the far wall, moss high up, drips of dark
    for (let c = 1; c < 16; c++) {
      const d = c / 16 - 0.02 + r() * 0.015
      const rx = Rw * sc(d), ry = rx * K, cy = ringY(d)
      const fade = 1 - d * 0.75
      gb.strokeStyle = col(P.umbra, (P.dark ? 0.75 : 0.45) * fade)
      gb.lineWidth = Math.max(0.7, 2.2 * sc(d))
      gb.beginPath()
      gb.ellipse(Wc, cy, rx, ry, 0, Math.PI * 1.03, Math.PI * 1.97)
      gb.stroke()
      gb.strokeStyle = col(P.dark ? P.moon : P['rake-hi'], (P.dark ? 0.12 : 0.5) * fade)
      gb.lineWidth = Math.max(0.5, 1.1 * sc(d))
      gb.beginPath()
      gb.ellipse(Wc, cy + 1.6 * sc(d), rx, ry, 0, Math.PI * 1.05, Math.PI * 1.95)
      gb.stroke()
      const d2 = (c + 1) / 16
      const rx2 = Rw * sc(d2), cy2 = ringY(d2)
      gb.strokeStyle = col(P.umbra, (P.dark ? 0.6 : 0.35) * fade)
      gb.lineWidth = Math.max(0.6, 1.6 * sc(d))
      for (let a = Math.PI * (1.05 + r() * 0.06); a < Math.PI * 1.95; a += 0.22 + r() * 0.2) {
        gb.beginPath()
        gb.moveTo(Wc + Math.cos(a) * rx, cy + Math.sin(a) * ry)
        gb.lineTo(Wc + Math.cos(a) * rx2, cy2 + Math.sin(a) * rx2 * K)
        gb.stroke()
      }
      if (c < 5) for (let m = 0; m < 2; m++) {
        const a = Math.PI * (1.08 + r() * 0.84)
        mossDots(gb, P, Wc + Math.cos(a) * rx, cy + Math.sin(a) * ry + 3, rx * 0.07 + r() * 5, 2.5 + r() * 2, 2013 + c * 7 + m, 0.8 * fade)
      }
      if (c % 4 === 0) yield
    }
    // the year courses: a carved band where 2025 ends and 2026 begins
    for (const d of [0.07, 0.36]) {
      gb.strokeStyle = col(P.dark ? P.moon : P['rake-hi'], P.dark ? 0.22 : 0.6)
      gb.lineWidth = 1.4 * sc(d)
      gb.beginPath()
      gb.ellipse(Wc, ringY(d) + 2, Rw * sc(d) * 0.995, Rw * sc(d) * K * 0.995, 0, Math.PI * 1.08, Math.PI * 1.92)
      gb.stroke()
    }
    // the ledges the pebbles land on: a flat stone jutting from the wall, lit on top, dark beneath
    for (let i = 0; i < 3; i++) {
      const [x, y] = restAt(i), lw = pebW[i] * sc(REST[i].d) * 0.85
      glow(gb, x - 2, y + lw * 0.3, lw * 0.9, lw * 0.28, P.umbra, P.dark ? 0.8 : 0.45, 0.5)
      gb.fillStyle = col(mix(P['rock-lo'], P.umbra, 0.4))
      gb.beginPath()
      gb.ellipse(x, y + lw * 0.1, lw * 0.75, lw * 0.2, 0, 0, TAU)
      gb.fill()
      gb.fillStyle = col(P.dark ? mix(P['rock-mid'], P['rock-hi'], 0.4) : mix(P['rock-hi'], P['rock-mid'], 0.3))
      gb.beginPath()
      gb.ellipse(x, y, lw * 0.72, lw * 0.16, 0, 0, TAU)
      gb.fill()
      gb.strokeStyle = col(P.dark ? P.umbra : P.wash, 0.5)
      gb.lineWidth = 0.8
      gb.stroke()
    }
    // a shadow down the left wall: the moon reaches the well over its right shoulder
    const sg = gb.createLinearGradient(Wc - Rw, 0, Wc + Rw * 0.2, 0)
    sg.addColorStop(0, col(P.umbra, P.dark ? 0.55 : 0.3))
    sg.addColorStop(1, col(P.umbra, 0))
    gb.fillStyle = sg
    gb.fillRect(Wc - Rw, Hc - Rw, Rw * 1.2, Rw * 2)
    // the water's dark body
    const wr = Rw * sc(1)
    gb.fillStyle = col(mix(P.water, P.umbra, P.dark ? 0.3 : 0.25))
    gb.beginPath()
    gb.ellipse(Wc, ringY(1), wr, wr * K, 0, 0, TAU)
    gb.fill()
    gb.restore()
    yield

    // the rim: a ring of uneven blocks — some long, some squat, gaps between them — each a lit top over a dark face
    const spans: number[] = [] // block, gap, block, gap … (a chip of stone sometimes wedged in a gap)
    for (let s = 0; s < TAU; ) {
      const w = r() < 0.3 ? 0.09 + r() * 0.07 : 0.2 + r() * 0.44, gap = 0.03 + r() * 0.07
      spans.push(w, gap)
      s += w + gap
    }
    const tot = spans.reduce((a, b) => a + b, 0)
    let a0 = -0.4 + r() * 0.3
    const blocks: { a: number; half: number; rin: number; rout: number; tall: number; seed: number; ex: number }[] = []
    for (let q = 0; q < spans.length; q += 2) {
      const w = (spans[q] / tot) * TAU, gap = (spans[q + 1] / tot) * TAU
      const chip = w < 0.15
      blocks.push({ a: a0 + w / 2, half: w / 2, rin: chip ? 1.06 + r() * 0.08 : 0.985 + r() * 0.02, rout: chip ? 1.2 + r() * 0.08 : 1.16 + r() * 0.24, tall: chip ? 0.07 + r() * 0.05 : 0.12 + r() * 0.13, seed: 2100 + q, ex: 0.28 + r() * 0.45 })
      a0 += w + gap
    }
    blocks.sort((p, q) => Math.sin(p.a) - Math.sin(q.a)) // far first
    for (const b of blocks) {
      const rr = rng(b.seed)
      const rm = (b.rin + b.rout) / 2, hr = (b.rout - b.rin) / 2
      const top: Pt[] = []
      const ph = [rr() * 6, rr() * 6, rr() * 6], notch = rr() * TAU
      for (let q = 0; q < 32; q++) {
        const th = (q / 32) * TAU
        const cu = Math.cos(th), sv = Math.sin(th)
        const u = Math.sign(cu) * Math.abs(cu) ** b.ex, v = Math.sign(sv) * Math.abs(sv) ** b.ex // boxy … rounded
        // a lopsided outline with one chipped corner
        const wob = 1 + 0.07 * Math.sin(th * 2 + ph[0]) + 0.05 * Math.sin(th * 3 + ph[1]) + 0.03 * Math.sin(th * 5 + ph[2]) - 0.1 * Math.max(0, Math.cos(th - notch)) ** 6
        const a = b.a + u * b.half * wob
        const rad = rm + v * hr * wob
        top.push([Wc + Math.cos(a) * Rw * rad, Hc + Math.sin(a) * Rw * rad * K])
      }
      const drop = b.tall * Rw * COS
      const body = poly(top)
      // its contact shadow and the dark crevice round it, then its face (the top pushed down: inner face far, outer near)
      softFill(gb, poly(top.map(([x, y]) => [x + 1, y + drop + 3] as Pt)), col(P.umbra, P.dark ? 0.9 : 0.5), 5, dpr)
      const face = gb.createLinearGradient(0, Hc - Rw, 0, Hc + Rw * 1.3)
      const near = Math.sin(b.a) > 0
      face.addColorStop(0, col(mix(P['rock-lo'], P.umbra, P.dark ? 0.55 : 0.4)))
      face.addColorStop(1, col(near ? mix(P['rock-mid'], P['rock-lo'], 0.55) : mix(P['rock-lo'], P.umbra, 0.5)))
      gb.fillStyle = face
      for (let k = 6; k >= 1; k--) gb.fill(poly(top.map(([x, y]) => [x, y + (drop * k) / 6] as Pt)))
      // the face's grain: a few vertical strokes, darker low down
      gb.save()
      gb.clip(poly(top.map(([x, y]) => [x, y + drop] as Pt)))
      for (let k = 0; k < 3; k++) {
        const pt = top[Math.floor(rr() * top.length)]
        brush(gb, [[pt[0], pt[1] + drop * 0.2], [pt[0] + 1, pt[1] + drop]], 1.2, col(P.umbra, 0.35), 0.2, 0.2, 0.3)
      }
      gb.restore()
      // the top: lit toward the moon (upper right), dimmer at the far side of the block
      const [cxm, cym] = [Wc + Math.cos(b.a) * Rw * rm, Hc + Math.sin(b.a) * Rw * rm * K]
      const lit = 0.7 + 0.3 * Math.cos(b.a + Math.PI * 0.3) * (0.75 + rr() * 0.35)
      const tg = gb.createLinearGradient(cxm + Rw * 0.12, cym - Rw * 0.1, cxm - Rw * 0.14, cym + Rw * 0.1)
      tg.addColorStop(0, col(mix(P['rock-hi'], P['rock-mid'], 1.15 - lit)))
      tg.addColorStop(1, col(mix(P['rock-mid'], P['rock-lo'], 0.6 - lit * 0.35)))
      gb.fillStyle = tg
      gb.fill(body)
      gb.save()
      gb.clip(body)
      // mottled stone: soft washes of the darker tones
      for (let k = 0; k < 4; k++) {
        const pt = top[Math.floor(rr() * top.length)]
        glow(gb, (pt[0] + cxm) / 2, (pt[1] + cym) / 2, Rw * (0.05 + rr() * 0.07), Rw * (0.03 + rr() * 0.04), k % 2 ? P['rock-lo'] : P['rock-mid'], P.dark ? 0.35 : 0.3, 0.5)
      }
      // pits and dry strokes on the top, and moss dotted where it faces the sky
      for (let k = 0; k < 4; k++) {
        const pt = top[Math.floor(rr() * top.length)]
        const x = (pt[0] + cxm * 2) / 3, y = (pt[1] + cym * 2) / 3
        brush(gb, [[x - 4, y], [x + 2, y + 1], [x + 7 + rr() * 6, y - 1]], 1 + rr() * 1.4, col(P.umbra, P.dark ? 0.3 : 0.16), 0.3, 0.4, 0.2)
      }
      if (rr() < 0.6) {
        const t = rr() < 0.5 ? 0.35 : -0.35
        const mx = cxm + Math.cos(b.a) * Rw * hr * t + (rr() - 0.5) * Rw * b.half * 0.6, my = cym + Math.sin(b.a) * Rw * hr * t * K
        mossDots(gb, P, mx, my, Rw * (0.06 + rr() * 0.06), Rw * (0.03 + rr() * 0.025), b.seed + 5)
      }
      gb.restore()
      // ink edge round the block, heavier on the side away from the moon; a moonlit lip on the side toward it
      gb.strokeStyle = col(P.dark ? P.umbra : P.wash, P.dark ? 0.85 : 0.45)
      gb.lineWidth = 1.2
      gb.stroke(body)
      const lip = top.filter((_, q) => q > 3 && q < 13).map(([x, y]) => [x - 0.5, y + 0.6] as Pt)
      brush(gb, lip, Math.max(1, Rw * 0.01), col(P.dark ? P.moon : P['rake-hi'], P.dark ? 0.35 * lit : 0.9), 0.2, 0.2, 0.2)
      yield
    }
    yield
    // the ground swallows the near blocks' feet: earth, grass and fern tufts along the outside of the ring
    const fc = col(P.dark ? mix(P['moss-c'], P.moon, 0.1) : P['moss-b'], P.dark ? 0.85 : 0.8)
    const fd = col(P.dark ? P['moss-a'] : mix(P['moss-b'], P.wash, 0.4), 0.85)
    for (let q = 0; q < 16; q++) {
      const a = Math.PI * (0.03 + (q / 15) * 0.94) + (r() - 0.5) * 0.08
      const rr = 1.3 + r() * 0.12
      const x = Wc + Math.cos(a) * Rw * rr, y = Hc + Math.sin(a) * Rw * rr * K + Rw * 0.06
      reeds(gb, x, y, Rw * (0.08 + r() * 0.1), 5 + Math.floor(r() * 4), 2200 + q, q % 3 ? fd : fc, (r() - 0.5) * 0.5)
      if (q % 5 === 4) yield
    }
    // ferns spilling over the rim into the shaft, and tufts on the ground
    for (const [a, len, sd] of [[1.06, 0.36, 1], [1.4, 0.26, 2], [1.9, 0.34, 3], [0.95, 0.3, 4], [0.1, 0.28, 5], [1.62, 0.2, 6]] as const) {
      const ang = a * Math.PI
      const x = Wc + Math.cos(ang) * Rw * 1.02, y = Hc + Math.sin(ang) * Rw * K * 1.02
      const into = Math.atan2(Hc - y, Wc - x)
      fern(gb, x, y, Rw * len, into + (sd % 2 ? 0.3 : -0.3), 2016 + sd, sd % 2 ? fc : fd)
      if (sd % 2 === 0) yield
    }
    for (const [a, rr, sd] of [[0.62, 1.5, 7], [0.32, 1.58, 8], [2.4, 1.5, 9]] as const) {
      const x = Wc + Math.cos(a) * Rw * rr, y = Hc + Math.sin(a) * Rw * rr * K
      for (let q = 0; q < 5; q++) fern(gb, x, y, Rw * 0.26, -Math.PI / 2 + (q - 2) * 0.5, 2020 + sd * 5 + q, q % 2 ? fc : fd)
      yield
    }
    yield
    // dissolve the edges into the paper
    gb.globalCompositeOperation = 'destination-in'
    const r1 = Math.min(Rw * 2.7, (H - Hc) / K - 4, Wc - 4, W - Wc - 4)
    const fade = gb.createRadialGradient(0, 0, Math.min(Rw * 1.5, r1 * 0.8), 0, 0, Math.max(r1, Rw * 1.6))
    fade.addColorStop(0, 'rgba(0,0,0,1)')
    fade.addColorStop(1, 'rgba(0,0,0,0)')
    gb.save()
    gb.translate(Wc, Hc)
    gb.scale(1, K)
    gb.fillStyle = fade
    gb.fillRect(-W * 2, -H * 3, W * 4, H * 6)
    gb.restore()
    gb.globalCompositeOperation = 'source-over'
    yield
    // the cedar frame: square posts (a lit flank toward the moon, a dark face toward us) and the beam on the diagonal,
    // foreshortened, its lit top, dark flank and end grain; the posts' shadows reach back across the ground
    const woodHi = P.dark ? mix(P['step-mid'], P.moon, 0.12) : mix(P['step-mid'], P['step-hi'], 0.3)
    const woodMid = P.dark ? mix(P['step-lo'], P['step-mid'], 0.3) : mix(P['step-lo'], P['step-mid'], 0.35)
    const woodLo = P.dark ? mix(P['step-lo'], P.umbra, 0.55) : mix(P['step-lo'], P.umbra, 0.45)
    const ink = col(P.dark ? P.umbra : P.wash, P.dark ? 0.9 : 0.55)
    const rim = col(P.dark ? P.moon : P['rake-hi'], P.dark ? 0.5 : 1)
    /** wood grain on a face: strokes along `along`, starting across the edge from → to */
    const grain = (pts: Pt[], from: Pt, to: Pt, along: Pt, a: number, seed: number) => {
      const rr = rng(seed)
      gb.save()
      gb.clip(poly(pts))
      for (let k = 0; k < 7; k++) {
        const t = rr()
        const x0 = from[0] + (to[0] - from[0]) * t, y0 = from[1] + (to[1] - from[1]) * t
        const l0 = rr() * 0.4, l1 = l0 + 0.3 + rr() * 0.5
        brush(gb, [[x0 + along[0] * l0, y0 + along[1] * l0], [x0 + along[0] * l1, y0 + along[1] * l1]], 0.8 + rr(), col(P.umbra, a), 0.2, 0.2, 0.2)
      }
      gb.restore()
    }
    for (const th of [TF, TN]) {
      const X = Math.cos(th) * POST, Z = Math.sin(th) * POST, yT = HB - BH / 2, hp = PW / 2
      const side = X > 0 ? -1 : 1 // we see the flank that faces the well; the one facing right (the moon) is lit
      const [fx0, fy0] = at3(X, 0, Z)
      // the post's shadow, thrown back and to the left over the ground
      softFill(gb, poly([at3(X - hp, 0, Z + hp), at3(X + hp, 0, Z + hp), at3(X + hp - 0.5, 0, Z - 0.42), at3(X - hp - 0.55, 0, Z - 0.4)]), col(P.umbra, P.dark ? 0.55 : 0.22), 4, dpr)
      glow(gb, fx0, fy0, Rw * 0.12, Rw * 0.05, P.umbra, P.dark ? 0.9 : 0.45)
      const front = [at3(X - hp, yT, Z + hp), at3(X + hp, yT, Z + hp), at3(X + hp, 0, Z + hp), at3(X - hp, 0, Z + hp)]
      const flank = [at3(X + side * hp, yT, Z - hp), at3(X + side * hp, yT, Z + hp), at3(X + side * hp, 0, Z + hp), at3(X + side * hp, 0, Z - hp)]
      gb.fillStyle = col(side > 0 ? woodHi : woodLo)
      gb.fill(poly(flank))
      grain(flank, flank[0], flank[1], [0, flank[3][1] - flank[0][1]], 0.3, 2300 + side)
      gb.fillStyle = col(woodMid)
      gb.fill(poly(front))
      grain(front, front[0], front[1], [front[3][0] - front[0][0], front[3][1] - front[0][1]], 0.35, 2302 + side)
      gb.strokeStyle = ink
      gb.lineWidth = 1
      gb.stroke(poly(front))
      gb.stroke(poly(flank))
    }
    // the beam: its shadow-side flank, the end grain toward us, then the moonlit top
    const [t0, t1, t2, t3, b3, b2, b1] = beamTop
    gb.fillStyle = col(woodLo)
    gb.fill(poly([t3, t2, b2, b3]))
    grain([t3, t2, b2, b3], t3, b3, [t2[0] - t3[0], t2[1] - t3[1]], 0.35, 2310)
    gb.fillStyle = col(woodMid)
    gb.fill(poly([t1, t2, b2, b1]))
    gb.strokeStyle = col(P.umbra, 0.4)
    gb.lineWidth = 0.8
    const [ex, ey] = [(t1[0] + b2[0]) / 2, (t1[1] + b2[1]) / 2]
    for (let k = 1; k < 4; k++) {
      gb.beginPath()
      gb.ellipse(ex, ey, Math.abs(t2[0] - t1[0]) * 0.13 * k, Math.abs(b1[1] - t1[1]) * 0.13 * k, 0, 0, TAU)
      gb.stroke()
    }
    const tg = gb.createLinearGradient(t0[0], t0[1], t2[0], t2[1])
    tg.addColorStop(0, col(mix(woodHi, woodMid, 0.35)))
    tg.addColorStop(1, col(woodHi))
    gb.fillStyle = tg
    gb.fill(poly([t0, t1, t2, t3]))
    grain([t0, t1, t2, t3], t0, t3, [t1[0] - t0[0], t1[1] - t0[1]], 0.25, 2311)
    gb.strokeStyle = ink
    gb.lineWidth = 1.1
    gb.stroke(beamHull!)
    brush(gb, [[t0[0], t0[1] + 0.8], [t1[0], t1[1] + 0.8]], Math.max(1.2, Rw * 0.008), rim, 0.1, 0.1, 0.3)
    // the pulley under the beam's middle, the rope down to a bucket hanging in the shaft
    const pr = Math.max(4, Rw * 0.045)
    gb.strokeStyle = col(woodLo)
    gb.lineWidth = Math.max(2, pr * 0.45)
    gb.beginPath()
    gb.ellipse(ropeTop[0], ropeTop[1] + pr * 0.8, pr, pr * 0.85, 0, 0, TAU)
    gb.stroke()
    gb.strokeStyle = rim
    gb.lineWidth = 1
    gb.beginPath()
    gb.ellipse(ropeTop[0], ropeTop[1] + pr * 0.8, pr, pr * 0.85, 0, Math.PI * 1.2, Math.PI * 1.8)
    gb.stroke()
    const bd = 0.16, by2 = ringY(bd), bs = sc(bd)
    brush(gb, [[ropeTop[0] + pr, ropeTop[1] + pr * 0.8], [Wc + pr * 0.5, (ropeTop[1] + by2) / 2], [Wc, by2 - Rw * 0.06 * bs]], 1.8, col(P.dark ? mix(P['step-mid'], P.moon, 0.2) : P['step-lo'], 0.95), 0.02, 0.02, 0.6)
    const bw = Rw * 0.12 * bs
    gb.fillStyle = col(mix(P['step-lo'], P.umbra, 0.3))
    gb.beginPath()
    gb.ellipse(Wc, by2, bw, bw * 0.8, 0, 0, TAU)
    gb.fill()
    gb.fillStyle = col(P.umbra, 0.9)
    gb.beginPath()
    gb.ellipse(Wc, by2 - bw * 0.1, bw * 0.75, bw * 0.55, 0, 0, TAU)
    gb.fill()
    gb.strokeStyle = col(P.dark ? P.moon : P['step-hi'], 0.6)
    gb.lineWidth = 1
    gb.beginPath()
    gb.ellipse(Wc, by2, bw, bw * 0.8, 0, Math.PI * 1.1, Math.PI * 1.9)
    gb.stroke()
    yield
    // the shadows the frame, the rope and the bucket throw into the shaft, blurred once into a sprite (drawFx slides it)
    shX = Wc - Rw * 1.7
    shY = Hc - Rw * 1.5
    offBeam = new Path2D()
    offBeam.rect(0, 0, W, H)
    offBeam.addPath(beamHull!)
    const shade = col(P.umbra, P.dark ? 0.6 : 0.34)
    shadowSpr = sprite(Rw * 3.4, Rw * 2.7, dpr, (sp) => {
      sp.translate(-shX, -shY)
      const [t0, t1, t2, t3] = beamTop
      softFill(sp, poly([t0, t1, t2, t3]), shade, Rw * 0.03, dpr)
      softFill(sp, new Path2D(stroke([ropeTop, [Wc + 2, (ropeTop[1] + by2) / 2], [Wc, by2]], 2.2, 0.05, 0.05, 0.6)), shade, 1.5, dpr)
      softFill(sp, ellipsePath(Wc, by2 + bw * 0.4, bw * 0.85, bw * 1.25, 0), col(P.umbra, P.dark ? 0.5 : 0.26), 3, dpr)
    })
    yield
    // the moonbeam in its own space: soft on both edges, fading as it goes down
    beamSpr = sprite(BL, BWD, dpr, (sp) => {
      for (let k = 0; k < 14; k++) {
        const f = 1 - k / 15
        sp.fillStyle = col(P.moon, 0.075)
        sp.beginPath()
        sp.moveTo(0, BWD / 2 - BWD * 0.07 * f)
        sp.lineTo(BL, BWD / 2 - BWD * 0.5 * f)
        sp.lineTo(BL, BWD / 2 + BWD * 0.5 * f)
        sp.lineTo(0, BWD / 2 + BWD * 0.07 * f)
        sp.fill()
      }
      sp.globalCompositeOperation = 'destination-in'
      const fg = sp.createLinearGradient(0, 0, BL, 0)
      fg.addColorStop(0, 'rgba(0,0,0,0.9)')
      fg.addColorStop(0.7, 'rgba(0,0,0,0.65)')
      fg.addColorStop(1, 'rgba(0,0,0,0.4)')
      sp.fillStyle = fg
      sp.fillRect(0, 0, BL, BWD)
    })
    // pebble sprites (one per milestone), carved with the milestone's mark
    yield
    peb = ms.map((m, i) => {
      const w = pebW[i]
      return sprite(w * 1.6, w * 1.1, dpr, (sp) => {
        paintRock(sp, P, w * 0.8, w * 0.85, w, w * 0.5, 2030 + i * 11, { light: 1, cast: 0.3 })
        const mk = markOf(m.fact as Fact)
        sp.strokeStyle = sp.fillStyle = col(P.dark ? P.moon : P.wash, P.dark ? 0.75 : 0.7)
        sp.lineWidth = 1.2
        const cx = w * 0.8, cy = w * 0.62, rr = w * 0.09
        sp.beginPath()
        if (mk === 'claim') {
          sp.moveTo(cx, cy - rr * 1.3)
          sp.lineTo(cx + rr * 1.3, cy)
          sp.lineTo(cx, cy + rr * 1.3)
          sp.lineTo(cx - rr * 1.3, cy)
          sp.closePath()
          sp.stroke()
        } else {
          sp.arc(cx, cy, rr, 0, TAU)
          sp.fill()
        }
      })
    })
  }

  // ── the labels: each name cut into the wall beside its ledge, wherever it fits inside the mouth and off the beam ──
  function placeTags() {
    const sz = tags.map((el) => [el.offsetWidth, el.offsetHeight]), ysz = years.map((el) => [el.offsetWidth, el.offsetHeight]) // one read
    const names: number[][] = [], cut: number[][] = [] // the names placed (wide), the years placed (always kept clear)
    const inside = (x: number, y: number) => ((x - Wc) / (Rw * 0.97)) ** 2 + ((y - Hc) / (Rw * K * 0.97)) ** 2 < 1
    const wr = Rw * sc(1), wy0 = ringY(1)
    const wet = (x: number, y: number) => ((x - Wc) / (wr + 4)) ** 2 + ((y - wy0) / (wr * K + 3)) ** 2 < 1
    const clear = (list: number[][], x: number, y: number, w: number, hh: number) => !list.some(([a, b, c, d]) => x < c + 4 && x + w > a - 4 && y < d + 3 && y + hh > b - 3)
    const fits = (x: number, y: number, w: number, hh: number, dry = true) => {
      const pts: Pt[] = [[x, y], [x + w, y], [x, y + hh], [x + w, y + hh], [x + w / 2, y], [x + w / 2, y + hh]]
      if (!pts.every(([px, py]) => inside(px, py) && !inHull(px, py) && !(dry && wet(px, py)))) return false
      return clear(cut, x, y, w, hh) && (!wide || clear(names, x, y, w, hh)) // tall: one name shows at a time
    }
    const placeNames = () => tags.forEach((el, i) => {
      const [w, hh] = sz[i]
      const [px, py] = restAt(i)
      const pr = (pebW[i] * sc(REST[i].d)) / 2 + 6
      const wy = ringY(1) - hh * 0.5
      const cands: Pt[] = i === n - 1 ? [[Wc - w / 2, ringY(1) + wr * K + 6], [Wc - w / 2, ringY(1) - wr * K - hh - 4]]
        : i === 3 ? [[Wc - wr - 8 - w, wy], [Wc + wr + 8, wy + hh * 1.3], [Wc - wr - 8 - w, wy - hh * 1.4]]
          : i === 4 ? [[Wc + wr + 8, wy], [Wc - wr - 8 - w, wy + hh * 1.3], [Wc + wr + 8, wy - hh * 1.4]]
            : [[px + pr, py - hh * 0.55], [px - pr - w, py - hh * 0.55], [px - w / 2, py + pr * 0.5], [px - w / 2, py - pr - hh]]
      const under: Pt = [Wc - w / 2, ringY(1) + wr * K + 6] // the open stone between the water and the near lip
      const pick = cands.find(([x, y]) => fits(x, y, w, hh, i < 3)) ?? (wide ? cands[0] : under)
      const x0 = clamp(pick[0], 4, W - w - 4), y0 = pick[1]
      names.push([x0, y0, x0 + w, y0 + hh])
      el.style.transform = `translate(${x0.toFixed(1)}px,${y0.toFixed(1)}px)`
    })
    // the years cut just under their course, at the first spot along it (from the right of centre) that is free
    const placeYears = () => years.forEach((el, k) => {
      const d = k === 0 ? 0.07 : 0.36, [w, hh] = ysz[k]
      const spots: Pt[] = [0.4, 0.55, 0.25, 0.7, 0.1, -0.1, -0.3, -0.5, -0.7].map((u) => {
        const x = Wc + u * Rw * sc(d)
        return [x - w / 2, ringY(d) - Rw * sc(d) * K * Math.sqrt(1 - u * u) + 3]
      })
      const offBeam = ([x, y]: Pt) => [0, 0.5, 1].every((u) => [0, 0.5, 1].every((v) => !inHull(x + w * u, y + hh * v)))
      const [x0, y0] = spots.find(([x, y]) => fits(x, y, w, hh)) ?? spots.find(offBeam) ?? spots[0]
      cut.push([x0, y0, x0 + w, y0 + hh])
      el.style.transform = `translate(${x0.toFixed(1)}px,${y0.toFixed(1)}px)`
    })
    // wide: the names first, the years where they still fit; tall (one name at a time): the years first, the name round them
    if (wide) {
      placeNames()
      cut.length = 0
      names.forEach((q) => cut.push(q))
      placeYears()
    } else {
      placeYears()
      placeNames()
    }
  }
  function inHull(x: number, y: number) {
    const p = hull(beamTop)
    let c = false
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      if ((p[i][1] > y) !== (p[j][1] > y) && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) c = !c
    }
    return c
  }

  // ── the overlay: beam, shadows, pebbles, water ──
  function drawFx() {
    if (!g || !ready) return
    const P = pal
    g.clearRect(0, 0, W, H)
    const [mxB, myB] = moonAt(tt)
    const mx = mxB + bx, my = myB + by
    // where the beam lands: the far wall opposite the moon, a third of the way down
    const pd = 0.38
    const [px, py, pa] = wallAt(Wc - (mx - Wc) * 0.5, pd)
    // the shadows of the frame, the rope and the bucket on the far wall, swinging with the moon (one blurred sprite, slid)
    const sx = -(mx - Wc) * 0.3, sy = Rw * 0.24
    if (shadowSpr) {
      g.save()
      g.beginPath()
      g.ellipse(Wc, Hc, Rw * 0.985, Rw * K * 0.985, 0, 0, TAU)
      g.clip()
      g.clip(offBeam!, 'evenodd')
      g.drawImage(shadowSpr, shX + sx, shY + sy, shadowSpr.width / dpr, shadowSpr.height / dpr)
      g.restore()
    }

    // the moonbeam: a soft shaft from the moon into the mouth, dust hanging in it, and the bent oval it lights
    if (beamSpr) {
      const len = Math.hypot(px - mx, py - my), ang = Math.atan2(py - my, px - mx), wd = Rw * 0.62
      g.save()
      g.globalCompositeOperation = P.dark ? 'lighter' : 'source-over'
      g.globalAlpha = P.dark ? 0.55 : 0.85
      g.translate(mx, my)
      g.rotate(ang)
      g.drawImage(beamSpr, 0, -wd / 2, len, wd)
      g.globalAlpha = 1
      g.fillStyle = col(P.dark ? P.moon : P['rake-hi'], 1)
      for (const [u, v, s, ph] of dust) {
        const uu = (u + (still ? 0 : 0.012 * Math.sin(now * 0.7 + ph * 9))) % 1
        const half = wd * (0.07 + 0.43 * uu) * 0.9
        g.globalAlpha = (0.25 + s * 0.6) * (1 - Math.abs(v)) * (P.dark ? 0.9 : 1)
        g.fillRect(uu * len, v * half + Math.sin(now * 0.5 + ph * 7) * 1.5, 0.8 + s * 1.2, 0.8 + s * 1.2)
      }
      g.restore()
      g.save()
      g.beginPath()
      g.ellipse(Wc, Hc, Rw * 0.985, Rw * K * 0.985, 0, 0, TAU)
      g.clip()
      g.globalCompositeOperation = P.dark ? 'lighter' : 'source-over'
      // the oval bends round the wall: lay it along the wall's tangent there, a soft halo and a brighter core
      const tan = Math.atan2(Math.cos(pa) * K, -Math.sin(pa))
      g.translate(px, py)
      g.rotate(tan)
      glow(g, 0, 0, Rw * 0.36, Rw * 0.2, P.moon, P.dark ? 0.32 : 0.5, 0.45)
      g.transform(1, 0, 0.22, 1, 0, 0)
      glow(g, 0, Rw * 0.01, Rw * 0.2, Rw * 0.09, P.moon, P.dark ? 0.4 : 0.6, 0.7)
      g.restore()
    }

    // pebbles: on the rim, falling (flipping, shrinking with depth), or at rest on their ledges
    for (let i = 0; i < n; i++) {
      if (i === 4 || !peb[i]) continue // the 722 drafts are a rain, drawn below
      const pw = peb[i].width / dpr, ph = peb[i].height / dpr
      const [x0, y0] = rimAt(i / n)
      const [x1, y1] = restAt(i)
      let x = x0, y = y0, s = 1, rot = 0, a = 1
      if (tf[i] !== -1) {
        const u = clamp((now - tf[i]) / LAND, 0, 1)
        const e = u * u
        x = x0 + (x1 - x0) * e
        y = y0 + (y1 - y0) * e - Math.sin(u * Math.PI) * Rw * 0.08
        s = 1 + (sc(REST[i].d) - 1) * e
        rot = u < 1 ? u * Math.PI * 2.2 : 0
        if (REST[i].w && u >= 1) a = Math.max(0, 1 - (now - tf[i] - LAND) * 1.5) // into the water
        if (REST[i].w && still) a = 0
      }
      tags[i].classList.toggle('on', tf[i] !== -1 && now - tf[i] >= LAND * 0.9)
      if (a <= 0) continue
      g.save()
      g.globalAlpha = a
      g.translate(x, y)
      g.rotate(rot)
      g.scale(s, s * (rot ? Math.abs(Math.cos(rot * 0.5)) * 0.6 + 0.4 : 1))
      g.drawImage(peb[i], -pw / 2, -ph * 0.75, pw, ph)
      g.restore()
      if (i === at && (still || tf[i] === -1)) glow(g, x, y - ph * 0.2 * s, pw * 0.9 * s, pw * 0.6 * s, P.moon, 0.35)
    }
    tags[4]?.classList.toggle('on', tf[4] !== -1 && now - tf[4] >= LAND * 0.5)
    const cur = Math.min(at, n - 1)
    tags.forEach((el, i) => el.classList.toggle('now', i === cur))

    // the water: the moon's reflection (whole, or broken by the splash), rings, the rain, the Clay ring, the forecast's fog
    const wr = Rw * sc(1), wy = ringY(1)
    g.save()
    g.beginPath()
    g.ellipse(Wc, wy, wr, wr * K, 0, 0, TAU)
    g.clip()
    const sTime = tf[3] === -1 ? -1 : now - tf[3] - LAND
    const calmT = tf[5] === -1 ? -1 : now - tf[5] - LAND
    const broken = sTime >= 0 && calmT < 0.8
    const mrx = Wc + (mx - Wc) * 0.12, mry = wy - wr * 0.18
    glow(g, mrx, mry, wr * 0.9, wr * 0.8, P.moon, P.dark ? 0.22 : 0.3, 0.4)
    g.fillStyle = col(P.moon, P.dark ? 0.9 : 0.95)
    if (!broken) {
      g.beginPath()
      g.ellipse(mrx, mry, wr * 0.24, wr * 0.22, 0, 0, TAU)
      g.fill()
    } else {
      // the reflection shattered into ripple-borne flakes, drifting apart then settling
      const amp = still ? 0.45 : Math.max(0.45, 1.2 - sTime * 0.3)
      g.lineCap = 'round'
      g.strokeStyle = g.fillStyle
      for (let q = 0; q < 20; q++) {
        const [a, b, c] = drops[q + 40]
        const yy = mry + (b - 0.5) * wr * 0.7 + Math.cos(q * 2.3) * wr * 0.05 * amp
        const xx = mrx + (a - 0.5) * wr * 0.7 + Math.sin(q * 1.7 + (still ? 0 : sTime * 2.4)) * wr * 0.2 * amp
        g.lineWidth = Math.max(1, wr * (0.012 + c * 0.02))
        g.globalAlpha = 0.35 + c * 0.6
        g.beginPath()
        g.moveTo(xx - wr * (0.02 + c * 0.06), yy)
        g.quadraticCurveTo(xx, yy - wr * 0.012, xx + wr * (0.02 + c * 0.06), yy + (a - 0.5) * 1.5)
        g.stroke()
      }
      g.globalAlpha = 1
    }
    g.strokeStyle = col(P.moon, 1)
    g.lineWidth = 1
    // the splash's rings, spreading then frozen
    if (sTime >= 0) {
      const [sx0, sy0] = restAt(3)
      for (let q = 0; q < 4; q++) {
        const age = still ? 1.6 + q * 0.5 : sTime - q * 0.35
        if (age < 0) continue
        const rr = Math.min(wr * 1.6, wr * (0.12 + age * 0.55))
        g.globalAlpha = (P.dark ? 0.55 : 0.75) * (still ? 0.45 : calmT >= 0 ? Math.max(0, 1 - calmT) : Math.max(0.25, 1 - age * 0.3))
        g.beginPath()
        g.ellipse(sx0, sy0, rr, rr * K, 0, 0, TAU)
        g.stroke()
      }
      // the splash: drops thrown up for a moment
      if (!still && sTime < 0.9) {
        g.globalAlpha = 1 - sTime / 0.9
        for (let q = 0; q < 14; q++) {
          const a = (q / 14) * TAU
          const u = sTime / 0.9
          g.fillRect(sx0 + Math.cos(a) * wr * 0.5 * u - 1, sy0 + Math.sin(a) * wr * 0.3 * u - Math.sin(u * Math.PI) * wr * 0.6 - 1, 2, 2)
        }
      }
      g.globalAlpha = 1
    }
    // the rain of 722 drafts: streaks falling from the mouth, then a field of tiny rings
    const rTime = tf[4] === -1 ? -1 : now - tf[4]
    g.restore()
    if (rTime >= 0) {
      g.save()
      g.beginPath()
      g.ellipse(Wc, Hc, Rw * 0.99, Rw * K * 0.99, 0, 0, TAU)
      g.clip()
      g.strokeStyle = col(P.dark ? P.moon : P.wash, P.dark ? 0.55 : 0.4)
      g.lineWidth = 0.8
      g.beginPath()
      for (const [a, b, c, dl] of drops) {
        const u = still ? 2 : (rTime - dl * 0.9) / 0.8
        if (u < 0 || u > 1) continue
        const x0 = Wc + (a - 0.5) * Rw * 1.6, y0 = Hc + (b - 0.5) * Rw * K * 1.2
        const x1 = Wc + (c - 0.5) * wr * 1.6, y1 = wy + (a - 0.5) * wr * K
        const x = x0 + (x1 - x0) * u * u, y = y0 + (y1 - y0) * u * u
        g.moveTo(x, y)
        g.lineTo(x - (x1 - x0) * 0.04, y - (y1 - y0) * 0.06 - 3)
      }
      g.stroke()
      g.restore()
      g.save()
      g.beginPath()
      g.ellipse(Wc, wy, wr, wr * K, 0, 0, TAU)
      g.clip()
      g.strokeStyle = col(P.moon, P.dark ? 0.35 : 0.6)
      g.lineWidth = 0.7
      g.globalAlpha = still ? 0.6 : calmT >= 0 ? Math.max(0, 1 - calmT) : clamp((rTime - 0.6) * 1.5, 0, 1)
      for (let q = 0; q < 40; q++) {
        const [a, b] = drops[q]
        const rr = wr * (0.03 + b * 0.05)
        g.beginPath()
        g.ellipse(Wc + (a - 0.5) * wr * 1.6, wy + (b - 0.5) * wr * K * 1.4, rr, rr * K, 0, 0, TAU)
        g.stroke()
      }
      g.restore()
    }
    // today: the water stills, and the Clay rule is a ring brushed round the moon and cut into the water — a dark groove
    // under a moonlit stroke that swells and thins and does not quite close
    if (calmT >= 0) {
      g.save()
      g.globalAlpha = still ? 1 : clamp(calmT, 0, 1)
      const ring = (rad: number, from: number, span: number, w: number, dy: number) => {
        const pts: Pt[] = []
        for (let q = 0; q <= 40; q++) {
          const a = from + (span * q) / 40
          const k = 1 + 0.03 * Math.sin(a * 3 + 1.3)
          pts.push([Wc + Math.cos(a) * wr * rad * k, wy + Math.sin(a) * wr * rad * k * K + dy])
        }
        return new Path2D(stroke(pts, w, 0.12, 0.3, 0.15))
      }
      g.fillStyle = col(P.umbra, P.dark ? 0.9 : 0.55)
      g.fill(ring(0.74, -2.2, TAU * 0.93, Math.max(2.4, wr * 0.05), 1.2))
      g.fillStyle = col(P.moon, P.dark ? 0.85 : 1)
      g.fill(ring(0.74, -2.2, TAU * 0.93, Math.max(2, wr * 0.042), 0))
      g.globalAlpha *= 0.55
      g.fill(ring(0.86, 0.9, TAU * 0.4, Math.max(1, wr * 0.018), 0))
      g.restore()
    }
    // beyond today: the forecast lies as mist at the bottom of the well
    if (fog || (still && at >= n)) mistBank(g, P, Wc, wy - wr * 0.1, wr * 1.5, wr * 1.1, P.dark ? 3.5 : 0.9)
  }

  ctx.onCleanup(onPrefs(() => {
    const p = palette()
    if (p.key === pal.key) return
    pal = p
    if (!ready) return
    job?.cancel()
    job = sliced(bake(), { sync: true })
    drawFx()
  }))
  ctx.onCleanup(onSize(ctx.art, layout))
}

function ellipsePath(x: number, y: number, rx: number, ry: number, rot: number) {
  const p = new Path2D()
  p.ellipse(x, y, rx, ry, rot, 0, TAU)
  return p
}

/** The convex hull of a few points (monotone chain). */
function hull(pts: Pt[]): Pt[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lo: Pt[] = [], hi: Pt[] = []
  for (const q of p) {
    while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop()
    lo.push(q)
  }
  for (const q of p.reverse()) {
    while (hi.length > 1 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop()
    hi.push(q)
  }
  return lo.slice(0, -1).concat(hi.slice(0, -1))
}
