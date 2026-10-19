import raw from '../../content/tram-20.json'
import { h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import { onPrefs } from '../../core/prefs'
import { guide, type Mark, type Track } from '../../ui/part2/guide'
import type { SceneCtx } from '../types'
import { clamp, curve, onSize, p2Defs, rng, stableHeight, stroke } from '../../ui/part2/ink'
import { mist, moon } from '../../ui/part2/paint'
import { canvas, carved, col, dprOf, fit, mix, paintRock, palette, range, reeds, sprite, type Pal } from './ink2d'

const V = raw.scenes.vortex
const TAU = Math.PI * 2
const FULL = TAU * 3 // three turns would wind the funnel all the way down …
const CAP = 0.55 // … but a hand only gets it so far: stirring never blows it up (audit v3 20-2)
const TURN = TAU * 0.8 // about one turn round, then let go: the water calms by itself
const RINGS = 24
const ROAD = 52
const ROWS = 9 // the stair of light the agents build after the blowup …
const SLOTS = 9 // … each tread a short row of lights, two deep
const STAIR = ROWS * SLOTS * 2
const DEG = Math.PI / 180
const TOUCH = 24 // the last few places the finger stirred (x, y, when)
// the bank's big stones (angle round the pond, size × R, height, seed), clear of where the carved stones stand
const BIG: [number, number, number, number][] = [[1.25 * Math.PI, 0.36, 0.7, 2061], [1.62 * Math.PI, 0.3, 0.62, 2062], [0.2 * Math.PI, 0.46, 0.66, 2063]]

/**
 * ★ Scene 2 · Navier–Stokes (canvas, 3Q, the camera sinking as you stir): a round moonlit pond seen three-quarter on the
 * thirds of the frame, its bank four big mossy stones among loose pebbles, sand raked in rings round the pond and round
 * each big stone, reeds in the near corner cut by the frame, soft ink ranges far off. Stir in circles: light rings run out
 * from the finger, 24 perspective rings sink into a funnel (y = −D·k²/(r²+ε)) whose near lip hides its throat, the moon
 * road winds into a spiral, the swarm of agents spins inward (ω ∝ 1/r) and the camera drops from 50° to 22°, so the far
 * ranges rise into frame. At the top the core flares to one point, a shockwave runs out and the agents line up into a
 * stair — short rows of haloed lights — climbing out of the pond onto a block of stone cut "Lean"; three stones round the
 * shore each carry one short line of the story (the full lines are in the detail). The loop runs only while stirring,
 * decaying, blowing up or (quality high) drifting before 10 s idle.
 * Audit v3 20-2 (P1: stirring harder made it blow up — the wrong mechanism): a hand swirls it about one turn and lets
 * go, and the water calms by itself. Then the swarm of AI copies is released: they spread out trying swirls, one finds a
 * swirl that tightens by itself, and only that one runs down to the blowup. Guide: a curved arrow round the pond and a
 * groove filling along its rim (step 1), a dot on the big firefly at the shore (step 2).
 */
export function vortexScene(ctx: SceneCtx) {
  p2Defs()
  const low = ctx.quality === 'low'
  const N = low ? 400 : 1200
  let nDraw = N // drops to 800 if the swarm costs more than its budget per frame (art direction: ≤ 4 ms at CPU 4×)
  let swarmMs = 0, swarmFrames = 0
  const stableH = stableHeight(ctx, [V.insight as Fact])

  const sky = s('svg', { class: 't20v-sky', 'aria-hidden': 'true' })
  const moonSvg = s('svg', { class: 't20v-moon', 'aria-hidden': 'true' })
  const near = s('svg', { class: 't20v-near', 'aria-hidden': 'true' })
  const skyWrap = h('div', { class: 't20v-skywrap', 'aria-hidden': 'true' }, sky)
  const cv = canvas('t20v-cv')
  const shake = h('div', { class: 't20v-shake' }, cv)
  const nameA = h('span', null, V.stages[0])
  const nameB = h('span', { class: 't20v-name-r', 'aria-hidden': 'true' }, V.stages[0])
  const name = h('p', { class: 't20v-name', 'aria-hidden': 'true' }, nameA, nameB)
  const fly = carved('t20v-fly', h('p', null, V.fireflies))
  // the block the stair of light climbs onto (one stone of words only: the fireflies'); no shore steles any more
  const lean = carved('t20v-lean', h('p', { 'aria-hidden': 'true' }))
  const steles: ReturnType<typeof carved>[] = []
  // step 2: the big firefly at the shore that sends the swarm out
  const release = h('button', { class: 't20v-release', type: 'button', 'aria-label': V.releaseAria, hidden: true }, h('i', { 'aria-hidden': 'true' }), h('span', null, V.release))
  const pond = h('div', {
    class: 't20v-hit', role: 'slider', tabindex: '0', 'aria-label': V.stirAria,
    'aria-valuemin': '0', 'aria-valuemax': String(V.stages.length - 1), 'aria-valuenow': '0', 'aria-valuetext': V.stages[0],
  })
  const root = h('div', { class: 't20 t20v' }, h('p', { class: 'visually-hidden' }, V.art), h('div', { class: 't20v-skyclip' }, moonSvg, skyWrap), shake, near, name, pond, fly.el, lean.el, release)
  root.dataset.phase = '0'
  ctx.art.append(root)
  ctx.prompt(V.prompt)
  const gd = guide(ctx)
  let arrow: Mark | null = null
  let way: Track | null = null
  let relDot: Mark | null = null

  // ── state ──
  let k = 0 // how stirred (0…1); decays slowly once the stirring stops
  let spin = 0 // accumulated swirl (radians)
  let dir = 1 // the way round it was last stirred
  let stage = 0
  let boom = -1 // seconds since the blowup (−1: not yet)
  let phase = 0 // 0 swirl and let go · 1 the water calms · 2 the swarm searches
  let turned = 0 // how far round the hand has swirled (radians)
  let srch = 0 // seconds the swarm has been searching
  let scat = 0 // how far the swarm has spread out this frame
  let now = 0
  let lastStir = -9
  let lastInput = 0
  let lastSkyY = NaN
  let focused = false // keyboard focus on the pond: its rim glows (in place of an outline)
  const touch = new Float32Array(TOUCH * 3).fill(-9) // a ring buffer: x, y, time
  let tq = 0

  // ── layout ──
  let W = 0, H = 0, Hf = 0, CX = 0, CY = 0, R = 0, RL = 0, wide = true, dpr = 1
  // the pond's centre before the blowup (in the whole art: the foot is still empty), when it blew (it glides from there)
  // and after (in the height the insight leaves); R is RL × the camera's pull-back after the blowup
  let CYa = 0, CY0 = 0, CYb = 0
  let pal: Pal = palette()
  let g: CanvasRenderingContext2D | null = null
  let stones: { c: HTMLCanvasElement; a: number; rr: number; w: number; h: number }[] = []
  let reedSpr: { c: HTMLCanvasElement; x: number; z: number; w: number; h: number }[] = []
  let rake = new Float32Array(0) // per segment: ring radius, a0, a1, width (world, × R)
  let flyW = 0, flyH = 0, leanW = 0, leanH = 0, nameW = 0
  let stW: number[] = [], stH: number[] = []
  let job: ReturnType<typeof sliced> | null = null
  let ready = false
  // unit-space gradients reused every frame under a transform; token colours as strings (nothing built per frame)
  let gWater: CanvasGradient | null = null, gGlow: CanvasGradient | null = null, gFlash: CanvasGradient | null = null, gMist: CanvasGradient | null = null, gHalo: CanvasGradient | null = null
  const ST = { rake: '', rakeHi: '', wet: '', wash: '', moon: '', fly: '' }
  // the funnel this frame: each ring's centre y and vertical radius once the near lip has hidden its throat
  const RCY = new Float32Array(RINGS), RRY = new Float32Array(RINGS)
  // the stair this frame: each tread's left end, y and length
  const TRX = new Float32Array(ROWS), TRY = new Float32Array(ROWS), TRL = new Float32Array(ROWS)

  // agents: polar seeds in five loose streams round the bank, so the differential spin winds them into visible spirals
  const r = rng(2020)
  const A0 = new Float32Array(N), R0 = new Float32Array(N), H0 = new Float32Array(N), PH = new Float32Array(N), WK = new Float32Array(N), BR = new Float32Array(N), DL = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    const rr = r() < 0.75 ? 0.72 + r() * 0.5 : 0.15 + r() * 0.6
    R0[i] = rr
    A0[i] = ((i % 5) / 5) * TAU + rr * 2.2 + (r() - 0.5) * 0.42
    H0[i] = 0.01 + r() * r() * 0.16
    PH[i] = r() * TAU
    WK[i] = 0.55 + r() * 0.45
    BR[i] = r()
    DL[i] = (i % ROWS) * 0.09 + r() * 0.25 // the lower treads fill first
  }
  const roadX = new Float32Array(ROAD), roadZ = new Float32Array(ROAD), roadL = new Float32Array(ROAD), roadW = new Float32Array(ROAD), roadA = new Float32Array(ROAD)
  for (let i = 0; i < ROAD; i++) {
    const t = i / (ROAD - 1)
    roadZ[i] = -0.94 + t * 1.86 // far edge → near edge
    roadX[i] = 0.5 + (r() - 0.5) * (0.04 + t * 0.26)
    roadL[i] = (0.03 + t * 0.12) * (0.4 + r() * 1.1)
    roadW[i] = (0.7 + t * 2.2) * (0.6 + r() * 0.6)
    roadA[i] = 0.35 + r() * 0.65
  }

  // ── projection: orthographic 3/4 (x right, z toward the viewer, y up; px) ──
  let elev = 50 * DEG, sinE = Math.sin(elev), cosE = Math.cos(elev)
  let PX = 0, PY = 0
  const proj = (x: number, y: number, z: number) => {
    PX = CX + x
    PY = CY + z * sinE - y * cosE
  }
  /** the funnel's height at radius rr (px) for stir kd */
  const depth = (rr: number, kd: number) => {
    const y = (0.55 * R * kd * 0.05) / ((rr / R) ** 2 + 0.05)
    const cap = (R * sinE * 0.72) / cosE // so the throat's far wall stays in view above the near lip
    return -cap * Math.tanh(y / cap)
  }
  /** a point on the visible funnel at radius rr, angle a, hovering hv px above it */
  const onFunnel = (rr: number, a: number, hv: number) => {
    PX = CX + Math.cos(a) * rr
    if (rr >= R) {
      PY = CY + Math.sin(a) * rr * sinE - hv * cosE
      return
    }
    const f = Math.max(0, Math.min(RINGS - 1.001, (rr / R) * RINGS - 0.5))
    const j = Math.floor(f), u = f - j
    PY = RCY[j] + (RCY[j + 1] - RCY[j]) * u + Math.sin(a) * (RRY[j] + (RRY[j + 1] - RRY[j]) * u) - hv * cosE
  }
  const ease = (t: number) => t * t * (3 - 2 * t)
  // where the carved stones stand (world, × R): the agents' stone on the left bank, Lean on the far right, the story round
  // the shore at three depths — far left, right bank, near left (tall screens: under the pond, staggered)
  const at = {
    fly: () => (wide ? [-1.42, 0.12] : [-0.6, 1.3]),
    lean: () => (wide ? [1.0, -0.9] : [0.62, -1.05]),
    st: (i: number) => [[-0.3, -1.45], [1.6, 0.1], [-0.2, 1.5]][i],
  }

  function layout() {
    W = ctx.art.clientWidth
    Hf = ctx.art.clientHeight
    H = stableH(Hf)
    if (W < 60 || H < 60) return
    root.style.height = `${Hf}px`
    wide = W / H > 1.15
    root.classList.toggle('wide', wide)
    dpr = dprOf(low)
    RL = R = wide ? Math.min(W * 0.26, Hf * 0.43) : Math.min(W * 0.44, Hf * 0.3)
    CX = wide ? W * 0.44 : W * 0.5
    CYa = Hf * (wide ? 0.6 : 0.5)
    CYb = H * (wide ? 0.6 : 0.31)
    CY = boom < 0 ? CYa : CYb
    g = fit(cv, W, Hf, dpr)
    colours()
    Object.assign(pond.style, { left: `${CX - R * 1.12}px`, top: `${CY - R * 0.9}px`, width: `${R * 2.24}px`, height: `${R * 1.8}px` })
    // the big firefly on the near right bank (the pond still at rest: 50°)
    Object.assign(release.style, { left: `${(CX + Math.cos(0.3 * Math.PI) * R * 1.02).toFixed(1)}px`, top: `${(CYa + Math.sin(0.3 * Math.PI) * R * 1.02 * Math.sin(50 * DEG)).toFixed(1)}px` })
    if (!arrow && phase === 0) {
      // H2 for the hidden gesture: a curved ink arrow round the middle, a groove three quarters round the rim filling as it turns
      arrow = gd.gesture('circle', () => [CX, CYa], { r: Math.round(R * 0.42) })
      way = gd.track(() => Array.from({ length: 25 }, (_, i) => {
        const a = (-0.6 + (i / 24) * 1.5) * Math.PI
        return [CX + Math.cos(a) * R * 1.06, CYa + Math.sin(a) * R * 1.06 * Math.sin(50 * DEG)] as [number, number]
      }))
    }
    // measure every carved stone in one read, then paint them
    const sizes = [fly, lean, ...steles].map((st) => [st.el.offsetWidth, st.el.offsetHeight])
    ;[flyW, flyH] = sizes[0]
    ;[leanW, leanH] = sizes[1]
    stW = sizes.slice(2).map((q) => q[0])
    stH = sizes.slice(2).map((q) => q[1])
    nameW = name.offsetWidth
    paintCarved(sizes)
    paintSky()
    paintMoon()
    rakeSegs()
    lastSkyY = NaN
    job?.cancel()
    job = sliced(paintSprites(), { sync: ctx.reduced || ready })
    job.done.then(() => {
      ready = true
      loop.wake()
    })
  }

  function paintCarved(sizes: number[][]) {
    ;[fly, lean, ...steles].forEach((st, i) => st.paint(pal, sizes[i][0], sizes[i][1], dpr, i === 1 ? 0.6 : 0.3, wide ? 1 : 0.55))
  }

  function colours() {
    ST.rake = col(pal.rake)
    ST.rakeHi = col(pal['rake-hi'])
    ST.wet = col(pal.umbra, pal.dark ? 0.75 : 0.28)
    ST.wash = col(pal.wash)
    ST.moon = col(pal.moon)
    ST.fly = col(pal.firefly)
    if (!g) return
    gWater = g.createLinearGradient(0, -1, 0, 1)
    gWater.addColorStop(0, col(mix(pal.water, pal.mist, pal.dark ? 0.28 : 0.5)))
    gWater.addColorStop(0.4, col(pal.water))
    gWater.addColorStop(1, col(mix(pal.water, pal.wash, pal.dark ? 0.3 : 0.22)))
    gGlow = g.createRadialGradient(0, 0, 0, 0, 0, 1)
    gGlow.addColorStop(0, col(pal.moon, pal.dark ? 0.3 : 0.45))
    gGlow.addColorStop(0.5, col(pal.moon, pal.dark ? 0.09 : 0.14))
    gGlow.addColorStop(1, col(pal.moon, 0))
    gFlash = g.createRadialGradient(0, 0, 0, 0, 0, 1)
    gFlash.addColorStop(0, pal.dark ? col(pal.moon) : 'rgba(255,255,255,1)')
    gFlash.addColorStop(0.18, pal.dark ? col(pal.moon, 0.85) : 'rgba(255,253,244,0.9)')
    gFlash.addColorStop(0.55, col(pal.moon, 0.25))
    gFlash.addColorStop(1, col(pal.moon, 0))
    gMist = g.createRadialGradient(0, 0, 0, 0, 0, 1)
    gMist.addColorStop(0, col(pal.mist, pal.mistA * (pal.dark ? 1.4 : 0.55)))
    gMist.addColorStop(0.6, col(pal.mist, pal.mistA * (pal.dark ? 0.6 : 0.25)))
    gMist.addColorStop(1, col(pal.mist, 0))
    gHalo = g.createRadialGradient(0, 0, 0, 0, 0, 1)
    gHalo.addColorStop(0, col(pal.firefly, pal.dark ? 0.42 : 0.3))
    gHalo.addColorStop(0.5, col(pal.firefly, pal.dark ? 0.14 : 0.1))
    gHalo.addColorStop(1, col(pal.firefly, 0))
  }

  // the far world: moon, soft ink ranges, the sea of cloud (SVG, painted once; it slides down as the camera sinks)
  function paintSky() {
    const sh = H * 0.62
    sky.setAttribute('viewBox', `0 0 ${W} ${sh}`)
    Object.assign(sky.style, { width: `${W}px`, height: `${sh}px` })
    const base = sh * 0.82
    sky.replaceChildren(
      mist(W * 0.55, base - sh * 0.36, W * 0.45, sh * 0.32),
      range(-W * 0.05, W * 1.05, base - sh * 0.04, sh * 0.5, 2022, 0.85, wide ? 7 : 4),
      mist(W * 0.5, base - sh * 0.08, W * 0.5, sh * 0.12),
      range(wide ? W * 0.52 : W * 0.3, W * 1.06, base, sh * 0.62, 2023, 0.4, wide ? 3 : 2),
      range(-W * 0.06, wide ? W * 0.36 : W * 0.42, base + 2, sh * 0.36, 2024, 0.55, 2),
      mist(W * 0.5, base + sh * 0.02, W * 0.52, sh * 0.13))
  }

  // the moon stays put in the sky on the right third (tall: the left, clear of the Lean stone) while the world tilts under
  // it; its road lies on the water below
  function paintMoon() {
    const mr = clamp(R * 0.11, 15, 32)
    moonSvg.setAttribute('viewBox', `0 0 ${W} ${H}`)
    Object.assign(moonSvg.style, { width: `${W}px`, height: `${H}px` })
    // the near layer: reed clumps in the corners, cut by the frame (wide: the right foot and the left edge; tall: the right)
    near.setAttribute('viewBox', `0 0 ${W} ${Hf}`)
    Object.assign(near.style, { width: `${W}px`, height: `${Hf}px` })
    near.replaceChildren(...(wide
      ? [reedSvg(W * 0.99, Hf * 1.03, Hf * 0.46, 2026, 15), reedSvg(W * 0.94, Hf * 1.05, Hf * 0.28, 2027, 8), reedSvg(-W * 0.005, Hf * 0.66, Hf * 0.3, 2028, 9)]
      : [reedSvg(W * 1.01, Hf * 0.9, Hf * 0.3, 2026, 11), reedSvg(-W * 0.01, Hf * 0.8, Hf * 0.17, 2028, 7)]))
    moonSvg.replaceChildren(moon(wide ? CX + R * 0.95 : W * 0.2, Math.max(mr * 1.8, Math.min(H * 0.13, CY - R * Math.sin(50 * DEG) - mr * 2.4)), mr, 2021, true))
  }

  // the raked sand: rings round the pond, broken where a big stone sits, and tight rings round each big stone
  function rakeSegs() {
    const rr = rng(2030)
    const segs: number[] = []
    const blocked = (rad: number, a: number) => BIG.some(([ab, sz]) => Math.hypot(Math.cos(a) * rad - Math.cos(ab) * 1.15, Math.sin(a) * rad - Math.sin(ab) * 1.15) < sz * 0.95)
    for (let ring = 0; ring < 10; ring++) {
      const rad = 1.18 + ring * 0.1
      for (let a = rr() * 0.6; a < TAU; ) {
        const len = 0.5 + rr() * 1.3
        const w = 0.9 + rr() * 1
        let a0 = -1
        for (let b = a; b < Math.min(a + len, TAU + 0.2); b += 0.03) {
          const free = !blocked(rad, b)
          if (free && a0 < 0) a0 = b
          if ((!free || b + 0.03 >= Math.min(a + len, TAU + 0.2)) && a0 >= 0) {
            if (b - a0 > 0.06) segs.push(rad, a0, b, w)
            a0 = -1
          }
        }
        a += len + 0.06 + rr() * 0.28
      }
    }
    rake = new Float32Array(segs)
  }

  function* paintSprites() {
    const rr = rng(2040)
    const next: typeof stones = []
    // the four big stones
    for (const [a, sz, tall, seed] of BIG) {
      const nearK = (Math.sin(a) + 1) / 2
      const w = R * sz * (0.82 + nearK * 0.3), hh = w * tall
      const pad = w * 0.5
      next.push({ c: sprite(w + pad * 2, hh + pad, dpr, (sg) => paintRock(sg, pal, pad + w / 2, hh + pad * 0.6, w, hh, seed, { light: 1, moss: 0.7, cast: 0.9, dark: (1 - nearK) * 0.15 })), a, rr: 1.15, w: w + pad * 2, h: hh + pad })
      yield
    }
    // loose pebbles between them: uneven sizes, gaps and little clusters, none where a big stone sits
    let a = rr() * 0.4
    while (a < TAU) {
      const clear = BIG.every(([ab, sz]) => Math.abs(Math.atan2(Math.sin(a - ab), Math.cos(a - ab))) > sz * 0.55)
      if (clear) {
        const nearK = (Math.sin(a) + 1) / 2
        const w = R * (0.045 + rr() * rr() * 0.11) * (0.75 + nearK * 0.5) * (wide ? 1 : 1.15)
        const hh = w * (0.42 + rr() * 0.34)
        const pad = w * 0.5
        const seed = 2041 + Math.round(a * 100)
        next.push({ c: sprite(w + pad * 2, hh + pad, dpr, (sg) => paintRock(sg, pal, pad + w / 2, hh + pad * 0.6, w, hh, seed, { light: 1, moss: rr() < 0.3 ? 0.5 : 0, cast: 0.6, dark: (1 - nearK) * 0.2 })), a, rr: 1.03 + rr() * 0.08, w: w + pad * 2, h: hh + pad })
      }
      a += rr() < 0.3 ? 0.05 + rr() * 0.06 : 0.14 + rr() * 0.32
      if (next.length % 6 === 0) yield
    }
    next.sort((p, q) => Math.sin(p.a) * p.rr - Math.sin(q.a) * q.rr) // far first
    stones = next
    const rs: typeof reedSpr = []
    for (const [x, z, hh, seed] of [[-1.25, -0.2, 0.5, 2051], [1.32, -0.42, 0.36, 2052], [-0.55, -1.08, 0.24, 2053], [0.62, 1.12, 0.3, 2054]] as const) {
      const sz = R * hh
      rs.push({ c: sprite(sz * 1.2, sz, dpr, (sg) => reeds(sg, sz * 0.6, sz, sz * 0.95, 9, seed, col(pal.dark ? mix(pal['moss-c'], pal.moon, 0.2) : pal.wash, pal.dark ? 0.75 : 0.5), -0.15)), x, z, w: sz * 1.2, h: sz })
    }
    reedSpr = rs
    yield
  }

  // ── one frame ──
  function draw(t: number) {
    if (!g || !ready) return
    const P = pal
    const post = boom < 0 ? 0 : clamp(boom / 2.6, 0, 1)
    const kd = boom < 0 ? k * k : 1 - ease(post) * 0.55 // the funnel's depth
    const kk = boom < 0 ? k : 1 - ease(post) * 0.4 // the swirl's strength
    elev = (50 - 28 * ease(boom < 0 ? k : 1) + 3 * ease(post)) * DEG
    CY = boom < 0 ? CYa : CY0 + (CYb - CY0) * ease(post)
    const Z = 1 - (wide ? 0.08 : 0.32) * ease(post) // the camera pulls back to show the shore
    R = RL * Z
    sinE = Math.sin(elev)
    cosE = Math.cos(elev)
    const live = !low && !ctx.reduced && now - lastInput < 10
    g.clearRect(0, 0, W, Hf)

    // the far world slides down into frame as the camera sinks
    const f = (50 - elev / DEG) / 28
    const h0 = -H * 0.03, h1 = CY - R * Math.sin(22 * DEG) * 1.12 // looking down: the ranges are out of frame until the camera sinks
    const skyY = h0 + (h1 - h0) * f - H * 0.62 * 0.82
    if (!(Math.abs(skyY - lastSkyY) <= 0.4)) {
      skyWrap.style.transform = `translate3d(0,${skyY.toFixed(1)}px,0)`
      pond.style.transform = `translateY(${(CY - CYa).toFixed(1)}px) scaleY(${(sinE / Math.sin(50 * DEG)).toFixed(3)})` // the stirring ring flattens with the pond
      lastSkyY = skyY
    }

    // raked sand: rings round the pond (broken by the big stones) and round each big stone, embossed
    g.lineCap = 'round'
    for (let i = 0; i < rake.length; i += 4) {
      const rad = rake[i] * R
      g.globalAlpha = 1 - (rake[i] - 1.18) / 1.05
      g.strokeStyle = ST.rake
      g.lineWidth = rake[i + 3]
      g.beginPath()
      g.ellipse(CX, CY, rad, rad * sinE, 0, rake[i + 1], rake[i + 2])
      g.stroke()
      g.strokeStyle = ST.rakeHi
      g.lineWidth = rake[i + 3] * 0.7
      g.beginPath()
      g.ellipse(CX, CY + 1.6, rad, rad * sinE, 0, rake[i + 1], rake[i + 2])
      g.stroke()
    }
    for (const [ab, sz] of BIG) {
      proj(Math.cos(ab) * 1.15 * R, 0, Math.sin(ab) * 1.15 * R)
      for (let q = 0; q < 3; q++) {
        const rad = R * sz * (0.6 + q * 0.13)
        g.globalAlpha = 0.9 - q * 0.22
        g.strokeStyle = ST.rake
        g.lineWidth = 1.3
        g.beginPath()
        g.ellipse(PX, PY, rad, rad * sinE, 0, 0, TAU)
        g.stroke()
        g.strokeStyle = ST.rakeHi
        g.lineWidth = 0.9
        g.beginPath()
        g.ellipse(PX, PY + 1.6, rad, rad * sinE, 0, 0, TAU)
        g.stroke()
      }
    }
    g.globalAlpha = 1

    // the wet dark band where water meets stone, then the water: sky-pale far half, deep near half
    g.save()
    g.translate(CX, CY)
    g.scale(R, R * sinE)
    g.fillStyle = ST.wet
    g.beginPath()
    g.arc(0, 0, 1.07, 0, TAU)
    g.fill()
    g.fillStyle = gWater!
    g.beginPath()
    g.arc(0, (0.05 * cosE) / sinE, 1, 0, TAU)
    g.fill()
    g.restore()

    // the funnel: rings outer → inner, each deeper; the near lip hides whatever of the throat falls below it
    let lip = CY + R * sinE
    for (let j = RINGS - 1; j >= 0; j--) {
      const rr = ((j + 0.5) / RINGS) * R
      const y = depth(rr, kd)
      const top = CY - rr * sinE - y * cosE
      let bot = CY + rr * sinE - y * cosE
      if (bot > lip - 0.5) bot = lip - 0.5
      else lip = bot
      if (bot < top + 0.5) bot = top + 0.5
      RCY[j] = (top + bot) / 2
      RRY[j] = (bot - top) / 2
    }
    g.save()
    g.beginPath()
    g.ellipse(CX, CY, R, R * sinE, 0, 0, TAU)
    g.clip()
    if (kd > 0.002) {
      g.fillStyle = ST.wash
      g.globalAlpha = (P.dark ? 0.08 : 0.06) * Math.min(1, kd * 1.6)
      for (let j = RINGS - 1; j >= 0; j--) {
        g.beginPath()
        g.ellipse(CX, RCY[j], ((j + 0.5) / RINGS) * R, RRY[j], 0, 0, TAU)
        g.fill()
      }
      g.globalAlpha = 1
    }
    // reflections of the far rim stones (by day the water is mid-tone, so they read darker)
    if (!P.dark) {
      g.globalAlpha = 0.14 * (1 - kk)
      for (const st of stones) {
        if (Math.sin(st.a) > -0.2) continue
        proj(Math.cos(st.a) * st.rr * R, 0, Math.sin(st.a) * st.rr * R)
        g.save()
        g.translate(PX, PY)
        g.scale(Z, -sinE * 0.9 * Z)
        g.drawImage(st.c, -st.w / 2, -st.h, st.w, st.h)
        g.restore()
      }
      g.globalAlpha = 1
    }
    // dry-brush arcs on the rings, turning ∝ 1/r
    g.lineCap = 'round'
    g.strokeStyle = ST.moon
    for (let j = 2; j < RINGS; j++) {
      const rr = ((j + 0.5) / RINGS) * R
      const th = (spin * 0.35) / (rr / R + 0.12)
      g.globalAlpha = (P.dark ? 0.06 : 0.14) + kk * (P.dark ? 0.16 : 0.2) * (1 - (j / RINGS) * 0.7)
      g.lineWidth = 0.6 + kk * 1.5 * (1 - (j / RINGS) * 0.6)
      for (let q = 0; q < 3; q++) {
        const a0 = th * dir + q * 2.09 + j * 0.7
        g.beginPath()
        g.ellipse(CX, RCY[j], rr, RRY[j], 0, a0, a0 + 0.35 + kk * 1.1)
        g.stroke()
      }
    }
    // the lip of the funnel catches the moon
    if (kd > 0.01) {
      const jl = Math.round((0.42 - 0.22 * kd) * RINGS)
      const rl = ((jl + 0.5) / RINGS) * R
      g.globalAlpha = 0.12 * kd
      g.lineWidth = 6 + 7 * kd
      g.beginPath()
      g.ellipse(CX, RCY[jl], rl, RRY[jl], 0, Math.PI * 1.02, Math.PI * 1.98)
      g.stroke()
      g.globalAlpha = 0.25 + 0.55 * kd
      g.lineWidth = 1 + 1.6 * kd
      g.stroke()
    }
    // the moon on the water: a soft glow, then dry strokes — straight while calm, wound along the rings as it swirls
    const kr = ease(clamp(kk / 0.35, 0, 1))
    g.globalAlpha = 1
    g.save()
    const side = wide ? 1 : -0.85 // which side of the pond the moon's road lies
    g.translate(CX + 0.5 * R * side * (1 - kr), CY - 0.1 * R * sinE * (1 - kr))
    g.scale(R * (0.2 + 0.15 * kr), R * (0.55 - 0.2 * kr) * sinE)
    g.fillStyle = gGlow!
    g.beginPath()
    g.arc(0, 0, 1, 0, TAU)
    g.fill()
    g.restore()
    for (let i = 0; i < ROAD; i++) {
      const x0 = roadX[i] * R * side, z0 = roadZ[i] * R
      const rr = Math.hypot(x0, z0)
      if (rr > R * 0.97) continue
      const a = Math.atan2(z0, x0) + ((spin * 0.35) / (rr / R + 0.12) - (spin * 0.35) / 1.12) * dir
      const base = (P.dark ? 0.7 : 0.85) * roadA[i]
      g.lineWidth = roadW[i] * (wide ? 1 : 0.8)
      if (kr < 1) {
        proj(x0, 0, z0)
        const L = roadL[i] * R * 0.5
        g.globalAlpha = base * (1 - kr)
        g.beginPath()
        g.moveTo(PX - L, PY)
        g.lineTo(PX + L, PY + (BR[i] - 0.5))
        g.stroke()
      }
      if (kr > 0) {
        const f2 = Math.max(0, Math.min(RINGS - 1, Math.round((rr / R) * RINGS - 0.5)))
        const span = (roadL[i] * (1 + kk * 2.5)) / Math.max(0.12, rr / R)
        g.globalAlpha = base * kr
        g.beginPath()
        g.ellipse(CX, RCY[f2], rr, RRY[f2], 0, a, a + span * 0.5 * dir, dir < 0)
        g.stroke()
      }
    }
    // where the finger stirs: a glint under it, and light rings running out and fading (round the rim as the keys stir)
    g.strokeStyle = ST.moon
    for (let q = 0; q < TOUCH; q++) {
      const age = now - touch[q * 3 + 2]
      if (age < 0 || age > 0.9) continue
      const fade = (1 - age / 0.9) ** 1.5 * (P.dark ? 0.5 : 0.75)
      for (let ring = 0; ring < 2; ring++) {
        const rad = R * (0.015 + age * 0.13) * (ring ? 0.55 : 1)
        if (ring && age < 0.12) continue
        g.globalAlpha = fade * (ring ? 0.6 : 1)
        g.lineWidth = 1.3 - age
        g.beginPath()
        g.ellipse(touch[q * 3], touch[q * 3 + 1], rad, rad * sinE, 0, 0, TAU)
        g.stroke()
      }
    }
    if (c) {
      g.save()
      g.globalAlpha = 1
      g.translate(fingerX - c.ox, fingerY - c.oy)
      g.scale(R * 0.12, R * 0.12 * sinE)
      g.fillStyle = gGlow!
      g.beginPath()
      g.arc(0, 0, 1, 0, TAU)
      g.fill()
      g.restore()
    }
    g.globalAlpha = 1
    g.restore() // water clip
    // keyboard focus: the water's rim catches the moon all the way round
    if (focused) {
      g.strokeStyle = ST.moon
      g.globalAlpha = P.dark ? 0.55 : 0.9
      g.lineWidth = 2
      g.beginPath()
      g.ellipse(CX, CY, R * 1.005, R * sinE * 1.005, 0, 0, TAU)
      g.stroke()
      g.globalAlpha = 0.18
      g.lineWidth = 7
      g.stroke()
      g.globalAlpha = 1
    }

    // the bright core at the bottom of the funnel
    if (kd > 0.04 || boom >= 0) {
      const cr = R * (0.025 + 0.07 * kd * kd) * (boom < 0 ? 1 : 1 - ease(post) * 0.5)
      g.save()
      g.translate(CX, RCY[0])
      g.scale(cr * 3, cr * 3 * Math.max(0.45, sinE))
      g.fillStyle = gFlash!
      g.beginPath()
      g.arc(0, 0, 1, 0, TAU)
      g.fill()
      g.restore()
    }

    // the bank: stones far → near (nearer ones larger), reeds; haze over the far bank
    for (const st of stones) {
      proj(Math.cos(st.a) * st.rr * R, 0, Math.sin(st.a) * st.rr * R)
      g.drawImage(st.c, PX - (st.w * Z) / 2, PY - st.h * 0.86 * Z, st.w * Z, st.h * Z)
    }
    for (const rd of reedSpr) {
      proj(rd.x * R, 0, rd.z * R)
      g.drawImage(rd.c, PX - (rd.w * Z) / 2, PY - rd.h * Z, rd.w * Z, rd.h * Z)
    }
    g.save()
    g.translate(CX, CY - R * sinE * 1.02)
    g.scale(R * 1.45, R * 0.2)
    g.fillStyle = gMist!
    g.beginPath()
    g.arc(0, 0, 1, 0, TAU)
    g.fill()
    g.restore()

    // DOM that rides the projection: the stage name on the far water, the carved stones round the shore
    proj(-R * 0.22, 0, -R * 0.64) // a little left of the stair's line
    name.style.transform = `translate3d(${(PX - nameW / 2).toFixed(1)}px,${(PY - 16).toFixed(1)}px,0)`
    const [fx, fz] = at.fly()
    proj(fx * R, 0, fz * R)
    fly.el.style.transform = `translate3d(${clamp(PX - flyW / 2, 6, W - flyW - 6).toFixed(1)}px,${clamp(PY - flyH, 0, (boom < 0 ? Hf : H) - flyH).toFixed(1)}px,0)`
    const [lx, lz] = at.lean()
    proj(lx * R, 0, lz * R)
    const leanX = clamp(PX - leanW * 0.35, 6, W - leanW - 6), leanY = clamp(PY - leanH, leanH * 0.4, H - leanH)
    lean.el.style.transform = `translate3d(${leanX.toFixed(1)}px,${leanY.toFixed(1)}px,0)`
    // the story's stones: round the shore at three depths (tall: under the pond, left, right, left)
    const yb = CY + R * sinE + 14
    if (boom >= 0) steles.forEach((st, i) => {
      let x = 0, y = 0
      if (wide) {
        const [sx, sz] = at.st(i)
        proj(sx * R, 0, sz * R)
        x = PX - stW[i] / 2
        y = PY - stH[i]
      } else {
        x = i === 1 ? W - stW[i] - 6 : 6
        y = i === 0 ? yb : i === 1 ? yb + stH[0] * 0.5 : yb + stH[0] + 20
      }
      st.el.style.transform = `translate3d(${clamp(x, 6, W - stW[i] - 6).toFixed(1)}px,${clamp(y, 0, H - stH[i]).toFixed(1)}px,0)`
    })

    // the stair: from the core up and out of the pond onto the top of the Lean stone, tread by tread
    const sx0 = CX + R * 0.03, sy0 = RCY[0] - R * 0.02
    const ex = leanX + R * 0.02, ey = leanY + 2 // up to the block's top corner
    for (let j = 0; j < ROWS; j++) {
      const tj = (j + 1) / ROWS
      TRL[j] = R * (0.2 - 0.09 * tj)
      TRX[j] = sx0 + (ex - sx0) * tj - TRL[j] * 0.9
      TRY[j] = sy0 + (ey - sy0) * tj
    }

    // the agents: fireflies circling the bank, spun inward; after the blowup they climb into the stair
    if (boom >= 0) {
      // each tread's halo, under its lights
      if (P.dark) g.globalCompositeOperation = 'lighter'
      for (let j = 0; j < ROWS; j++) {
        const u = ease(clamp((boom - 1.1 - j * 0.09) / 1, 0, 1))
        if (u <= 0) continue
        g.save()
        g.globalAlpha = u
        g.translate(TRX[j] + TRL[j] / 2, TRY[j] - 1)
        g.scale(TRL[j] * 0.75, R * 0.045)
        g.fillStyle = gHalo!
        g.beginPath()
        g.arc(0, 0, 1, 0, TAU)
        g.fill()
        g.restore()
      }
    }
    g.fillStyle = ST.fly
    if (P.dark) g.globalCompositeOperation = 'lighter'
    const sk = Math.pow(k, 1.3)
    const t0 = performance.now()
    for (let i = 0; i < nDraw; i++) {
      let rr = Math.max(R * 0.03, R0[i] * R * (1 - 0.9 * sk * WK[i]))
      if (scat > 0) rr *= 1 + scat * (WK[i] - 0.3) // the swarm fanning out to try
      let a = A0[i] + ((spin * 0.35) / (rr / R + 0.12)) * dir
      if (live) {
        a += 0.14 * Math.sin(t * 0.19 + PH[i]) * (1 - k)
        rr += R * 0.03 * Math.sin(t * 0.23 + PH[i] * 1.7)
      }
      onFunnel(rr, a, H0[i] * R * (1 - kk * 0.6))
      let x = PX, y = PY
      let sz = BR[i] < 0.1 ? 2 : 1.3
      let al = Math.min(1, (P.dark ? 0.22 : 0.4) + BR[i] * 0.4 + (1 - Math.min(1, rr / R)) * kk * 0.35)
      if (boom >= 0) {
        const u = ease(clamp((boom - 0.5 - DL[i]) / 1.5, 0, 1))
        if (i < STAIR) {
          // its seat: tread j, place s along it, front or back edge
          const j = i % ROWS, sl = Math.floor(i / ROWS) % SLOTS, back = Math.floor(i / (ROWS * SLOTS))
          const tx = TRX[j] + (TRL[j] * sl) / (SLOTS - 1) + back * 2.5, ty = TRY[j] - back * 2.2
          x += (tx - x) * u
          y += (ty - y) * u
          sz = 1.4 + u * (back ? 0.4 : 0.9)
          al = al + (1 - al) * u * (back ? 0.7 : 1)
        } else al *= 1 - 0.6 * u // the rest of the swarm dims back into the night
      }
      g.globalAlpha = al
      g.fillRect(x - sz / 2, y - sz / 2, sz, sz)
    }
    g.globalAlpha = 1
    g.globalCompositeOperation = 'source-over'
    if (nDraw > 800 && swarmFrames < 40) {
      swarmMs += performance.now() - t0
      if (++swarmFrames === 40 && swarmMs / 40 > 4) nDraw = 800
    }

    // the blowup: a white flash and a shockwave ring running out across the pond
    if (boom >= 0 && boom < 1.6) {
      const b = boom / 1.6
      g.save()
      g.translate(CX, RCY[0] + (CY - RCY[0]) * b)
      g.scale(R * (0.15 + b * 0.7), R * (0.15 + b * 0.7) * Math.max(0.6, sinE))
      g.globalAlpha = 1 - b
      g.fillStyle = gFlash!
      g.beginPath()
      g.arc(0, 0, 1, 0, TAU)
      g.fill()
      g.restore()
      const e = ease(Math.min(1, b * 1.3))
      g.globalAlpha = (1 - b) * 0.85
      g.strokeStyle = ST.moon
      g.lineWidth = 3.5 * (1 - b) + 0.6
      g.beginPath()
      g.ellipse(CX, CY, R * 1.3 * e, R * 1.3 * e * sinE, 0, 0, TAU)
      g.stroke()
      g.globalAlpha = 1
    }
  }

  const loop = createLoop(root, (t, dt) => {
    now += dt
    if (phase === 2 && stage < 2) {
      // the swarm spreads out trying swirls, then one tightens by itself and runs all the way down
      srch += dt
      scat = srch < 1.6 ? Math.sin((Math.PI * srch) / 1.6) * 0.3 : 0
      k = clamp((srch - 1.2) / 2.8, 0, 1)
      setStage(k >= 1 ? 2 : k >= 0.3 ? 1 : 0)
    } else if (stage < 2 && now - lastStir > 0.6 && k > 0) k = Math.max(0, k - dt * (phase === 1 ? 0.3 : 0.045))
    if (boom >= 0) boom += dt
    spin += dt * k * 1.6
    draw(t)
    const animating = (stage < 2 && k > 0.001) || (phase === 2 && stage < 2) || (boom >= 0 && boom < 3.6) || now - lastStir < 1.4
    return animating || (!low && !ctx.reduced && now - lastInput < 10)
  })
  ctx.onCleanup(() => {
    loop.dispose()
    job?.cancel()
  })

  function setStage(next: number) {
    if (next <= stage) return
    stage = next
    pond.setAttribute('aria-valuenow', String(stage))
    pond.setAttribute('aria-valuetext', V.stages[stage])
    nameA.textContent = nameB.textContent = V.stages[stage]
    nameW = name.offsetWidth
    root.dataset.stage = String(stage)
    if (stage < 2) return void ctx.chime('tap')
    boom = ctx.reduced ? 3.6 : 0
    CY0 = CY
    ctx.chime('ok')
    if (!ctx.reduced && !low) {
      shake.classList.remove('boom')
      void shake.offsetWidth
      shake.classList.add('boom')
    }
    ctx.insight(V.insight as Fact, V.detail as Fact)
  }

  function stir(delta: number) {
    if (phase !== 0) return
    lastStir = lastInput = now
    if (Math.abs(delta) > 0.001) dir = delta > 0 ? 1 : -1
    spin += Math.abs(delta) * 0.9
    turned += Math.abs(delta)
    k = clamp(k + Math.abs(delta) / FULL, 0, CAP)
    way?.set(turned / TURN)
    loop.start()
    loop.wake()
  }
  /** the hand lets go: after about a turn the water calms by itself, and the swarm's firefly lights up at the shore */
  function letGo() {
    if (phase !== 0 || turned < TURN) return
    phase = 1
    root.dataset.phase = '1'
    arrow?.done()
    way?.done()
    ctx.chime('soft')
    loop.wake()
    const t = setTimeout(() => {
      release.hidden = false
      relDot = gd.dot(release.firstChild as HTMLElement, { dir: [-1, -0.5] })
      ctx.prompt(V.steps[0])
    }, ctx.reduced ? 0 : 1600)
    ctx.onCleanup(() => clearTimeout(t))
  }
  release.addEventListener('click', () => {
    if (phase !== 1) return
    phase = 2
    root.dataset.phase = '2'
    release.disabled = true
    relDot?.done()
    ctx.chime('tap')
    if (ctx.reduced) {
      k = 1
      setStage(2)
    }
    loop.start()
    loop.wake()
  })
  /** a ring of light on the water at (x, y) art px */
  function ripple(x: number, y: number) {
    if (ctx.reduced) return // the rings need time to run out; reduced motion keeps the water still under the finger
    const q = tq++ % TOUCH
    touch[q * 3] = x
    touch[q * 3 + 1] = y
    touch[q * 3 + 2] = now
  }

  // stir by dragging round the pond's centre (either way round counts)
  let c: { x: number; y: number; ox: number; oy: number } | null = null
  let last = 0, fingerX = 0, fingerY = 0, rx = 0, ry = 0 // the finger now, and where it last left a ring
  pond.addEventListener('pointerdown', (e) => {
    const b = pond.getBoundingClientRect(), o = root.getBoundingClientRect()
    c = { x: b.left + b.width / 2, y: b.top + b.height * 0.5, ox: o.left, oy: o.top }
    last = Math.atan2(e.clientY - c.y, e.clientX - c.x)
    fingerX = rx = e.clientX
    fingerY = ry = e.clientY
    ripple(fingerX - c.ox, fingerY - c.oy)
    pond.setPointerCapture(e.pointerId)
    lastInput = now
  })
  pond.addEventListener('pointermove', (e) => {
    if (!c) {
      if (e.pointerType === 'mouse' && !low && !ctx.reduced && now - lastInput > 1) {
        lastInput = now
        loop.start()
      }
      return
    }
    const a = Math.atan2(e.clientY - c.y, e.clientX - c.x)
    let d = a - last
    if (d > Math.PI) d -= TAU
    if (d < -Math.PI) d += TAU
    last = a
    fingerX = e.clientX
    fingerY = e.clientY
    if (Math.hypot(fingerX - rx, fingerY - ry) > R * 0.13) {
      rx = fingerX
      ry = fingerY
      ripple(fingerX - c.ox, fingerY - c.oy)
    }
    stir(d)
  })
  const end = () => {
    c = null
    letGo()
  }
  pond.addEventListener('pointerup', end)
  pond.addEventListener('pointercancel', end)
  pond.addEventListener('keydown', (e) => {
    const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key]
    if (!d) return
    e.preventDefault()
    const a = spin * 0.35 * dir
    ripple(CX + Math.cos(a) * R * 0.62, CY + Math.sin(a) * R * 0.62 * sinE)
    stir((d * Math.PI) / 8)
  })
  pond.addEventListener('keyup', (e) => e.key.startsWith('Arrow') && letGo())
  pond.addEventListener('focus', () => {
    focused = pond.matches(':focus-visible')
    loop.wake()
  })
  pond.addEventListener('blur', () => {
    focused = false
    loop.wake()
  })

  ctx.onCleanup(onPrefs(() => {
    const p = palette()
    if (p.key === pal.key) return
    pal = p
    colours()
    if (!W) return
    paintCarved([fly, lean, ...steles].map((st) => [st.el.offsetWidth, st.el.offsetHeight]))
    job?.cancel()
    job = sliced(paintSprites(), { sync: true })
    loop.wake()
  }))
  ctx.onCleanup(onSize(ctx.art, layout))
  if (!low && !ctx.reduced) loop.start() // the fireflies drift until the garden has been idle 10 s
}

/** A clump of tall reeds in the near corner (SVG): thin tapered blades, a few bent, a few seed spikes; dark and sharp. */
function reedSvg(x: number, y: number, hh: number, seed: number, n: number): SVGPathElement {
  const r = rng(seed)
  let d = ''
  for (let i = 0; i < n; i++) {
    const bx = x + (r() - 0.5) * hh * 0.28, H = hh * (0.45 + r() * 0.55), lean = (r() - 0.6) * H * 0.45
    const w = 1.4 + r() * 2.4
    d += stroke(curve([bx, y], [bx + lean * 0.15, y - H * 0.55], [bx + lean, y - H], 12), w, 0.02, 0.7, 0.05)
    if (r() < 0.3) d += stroke(curve([bx + lean * 0.9, y - H * 0.86], [bx + lean * 0.98, y - H * 0.95], [bx + lean * 1.04, y - H * 1.04], 6), w * 1.7, 0.4, 0.4, 0.3)
  }
  return s('path', { class: 't20v-reed', d, filter: 'url(#ink-rough)' })
}
