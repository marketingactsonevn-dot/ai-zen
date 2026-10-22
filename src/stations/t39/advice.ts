import './advice.css'
import { fill, h, s } from '../../core/dom'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import { onPrefs } from '../../core/prefs'
import { blob, clamp, curve, rng, stroke, type Pt } from '../../ui/part2/ink'
import { perspectiveCircle, type CircleApi, type PondGeo } from '../../ui/part2/perspectives'
import { guide, type Drop, type Mark } from '../../ui/part2/guide'
import type { SceneCtx, SceneDef } from '../types'
import { C } from './shell'
import { dawnSky, f1, g39Defs, leafD, readTok, rgba, type Tok } from './g39'

const A = C.scenes.advice as typeof C.scenes.advice & { lampAria: string }

/**
 * The scene's geometry. Designed in the full-bleed painting's box (BW × BH, ≈ the screen); `ox, oy` move it into the
 * component's stage, where the leaf, the light canvas and the lamps live (cx … ry and lamps are stage px).
 * Wide: the near lamp whole in the left third, the right lamp on the near-right bank, the far lamp on the far bank — a
 * triangle round a deep puddle (~40% of the frame's height). Tall: the far lamp the apex, the two near lamps its feet.
 * Each lamp's anchor `a` is the water in front of it (unit puddle coords): where the leaf goes to hear it.
 */
type Lamp = { x: number; y: number; s: number; H: number; a: Pt }
type Geo = { w: number; h: number; cx: number; cy: number; rx: number; ry: number; hz: number; tall: boolean; lamps: Lamp[]; BW: number; BH: number; ox: number; oy: number; gx: number; gy: number; sunX: number }
let M: { ctx: SceneCtx; host: HTMLElement; wrap: HTMLElement | null; geo: Geo | null; hear: (k: number) => void; all: () => void } | null = null

/** lamp height (px) per unit of the component's stone scale: its box is bw × 0.75 bw and the lantern is 68 of its 90 */
const lampPx = (g: PondGeo) => clamp(Math.min(g.w, g.h * 1.7) * 0.19, 64, 140) * 0.75 * (68 / 90)

function geoOf(g: PondGeo): Geo {
  const m = M!
  const art = m.ctx.art, st = m.host.parentElement as HTMLElement
  const aw = art.clientWidth, ah = art.clientHeight
  const BW = m.wrap?.clientWidth || aw, BH = m.wrap?.clientHeight || ah + 24
  // the bleed runs from the screen's top to 24 px under the art; the stage sits inside the art
  const gx = (BW - aw) / 2, gy = BH - ah - 24
  const ox = gx + st.offsetLeft, oy = gy + st.offsetTop
  const tall = aw / Math.max(1, ah) <= 1.15
  const k = lampPx(g)
  // [x, foot y, height] as fractions of the bleed, then the anchor on the water
  const spec: [number, number, number, Pt][] = tall
    ? [[0.21, 0.69, 0.37, [-0.62, 0.5]], [0.84, 0.64, 0.27, [0.74, 0.24]], [0.38, 0.355, 0.125, [-0.28, -0.64]]]
    : [[0.16, 0.9, 0.62, [-0.64, 0.48]], [0.876, 0.73, 0.325, [0.78, 0.16]], [0.39, 0.482, 0.155, [-0.44, -0.6]]]
  const lamps = spec.map(([fx, fy, fh, a]) => ({ x: fx * BW - ox, y: fy * BH - oy, H: fh * BH, s: (fh * BH) / k, a }))
  const P = tall ? [0.5, 0.48, 0.44, 0.135] : [0.549, 0.625, 0.278, 0.17]
  return {
    w: g.w, h: g.h, tall, lamps, BW, BH, ox, oy, gx, gy,
    cx: P[0] * BW - ox, cy: P[1] * BH - oy, rx: P[2] * BW, ry: P[3] * BH,
    hz: (tall ? 0.31 : 0.39) * BH - oy,
    sunX: (tall ? 0.86 : 0.92) * BW,
  }
}

/**
 * Scene 3 — three views on learning with AI (perspectiveCircle, GRAZE). The camera lies in the moss at sunrise: a deep
 * rain puddle mirrors the dawn (darker than the sky, the far bank and the far lamp upside down in it, broken by ripples),
 * three granite lamps stand round it, each still burning. A red maple leaf — you — floats on it with three soft shadows,
 * one from each lamp (a canvas, redrawn only while the leaf or the light moves). The visitor steers the leaf to each lamp
 * (it lights, its shadow shortens, its view is read); touching a lamp (or 1–3) only lights it and reads it, the leaf
 * stays yours (audit 39-4). All three heard: a thin ink ring in the middle of the water; let the leaf go in it and its
 * three shadows come out equal — only then the insight.
 */
const def = perspectiveCircle(A.perspectives, {
  label: A.label, prompt: fill(A.prompt, { n: 0, total: A.perspectives.stones.length }), question: A.legend, detail: A.detail,
  place: (k, _n, g) => {
    const L = geoOf(g).lamps[k]
    return { x: L.x, y: L.y, s: L.s, z: Math.round(L.y) }
  },
  stone: (k) => lantern(3977 + k * 7),
  name: (k, i, heard) => (heard ? fill(A.stoneAria, { who: A.perspectives.stones[i].who }) : fill(A.lampAria, { n: k + 1 })),
  onHear: (k) => M?.hear(k),
  stage: (host, api) => {
    M = { ...M!, host }
    return build(M.ctx, host, api)
  },
})

export const adviceScene: SceneDef = {
  label: def.label,
  text: 'br',
  mount(ctx) {
    g39Defs()
    M = { ctx, host: ctx.art, wrap: null, geo: null, hear: () => {}, all: () => {} }
    // the circle would give its insight as soon as the third lamp is heard: here that only opens the last step (drop the
    // leaf in the middle), and the insight waits for the drop
    const out = def.mount({ ...ctx, insight: () => (M?.all(), h('div')) })
    ctx.art.querySelector('.p2c')?.classList.add('t39v')
    ctx.art.append(h('p', { class: 'visually-hidden' }, A.art))
    ctx.onCleanup(() => (M = null))
    return out
  },
}

const LEAF_BOX = 96
const FLAT = 0.48

function build(ctx: SceneCtx, host: HTMLElement, api: CircleApi) {
  const still = ctx.reduced || ctx.quality === 'low'
  // the painting runs full-bleed behind the whole scene (sky, far bank, moss, the puddle's mirror); the near moss in front
  const back = s('svg', { class: 't39v-back', 'aria-hidden': 'true' })
  const fore = s('svg', { class: 't39v-fore', 'aria-hidden': 'true' })
  const foreWrap = h('div', { class: 't39v-forewrap', 'aria-hidden': 'true' }, fore)
  const wrap = h('div', { class: 't39v-bleed', 'aria-hidden': 'true' }, back, foreWrap)
  ctx.art.prepend(wrap)
  M!.wrap = wrap
  const cv = h('canvas', { class: 't39v-light', 'aria-hidden': 'true' })
  const LEAF = leafD(0, 4, 22, 0)
  // the leaf is you: a button for the keyboard too (Enter: on to the next lamp, then into the middle). The outer box only
  // moves (the guide dot rides it); the drawing inside is flattened by the low eye
  const leafArt = s('svg', { viewBox: '-30 -30 60 60', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    s('path', { class: 't39v-leaf-body', d: LEAF }),
    s('path', { class: 't39v-leaf-lit', d: leafD(0.8, 3.2, 20, 0), transform: 'translate(1.6 -1.2)' }),
    s('path', { class: 't39v-leaf-vein', d: [-90, -38, -142, 8, 172].map((a, i) => stroke([[0, 4], [Math.cos((a * Math.PI) / 180) * (i > 2 ? 9 : 17), 4 + Math.sin((a * Math.PI) / 180) * (i > 2 ? 9 : 17)]], 1.1, 0.05, 0.6, 0.3)).join('') }),
    s('path', { class: 't39v-leaf-stalk', d: stroke([[0, 4], [1.5, 14], [3.5, 17]], 1.6, 0.1, 0.4, 0.3) }))
  const leaf = h('div', { class: 't39v-leaf', role: 'button', tabindex: '0', 'aria-label': A.leafAria }, leafArt)
  host.append(cv, leaf)
  const leafPath = new Path2D(LEAF)
  const card = host.closest('.p2c')?.querySelector<HTMLElement>('.p2c-card') ?? null
  let pools: SVGElement[] = []
  const lamps = [...(host.parentElement?.querySelectorAll<HTMLElement>('.p2c-stone') ?? [])]
  const g2 = cv.getContext('2d')!
  let T: Tok = readTok()
  let G: Geo | null = null
  // the leaf in puddle coordinates (unit ellipse), where it is heading, which lamps it has visited
  let lu = 0.04, lv = 0.08, tu = lu, tv = lv
  const lit = [0.5, 0.5, 0.5]
  let near = -1
  let fromLamp = false
  let dpr = 1
  let leafW = LEAF_BOX, leafH = LEAF_BOX * FLAT
  // the canvas covers the puddle and a margin round it (stage px)
  let CX = 0, CY = 0
  // a touched lamp lights up (and stays lit) without pulling the leaf
  const boost = [0, 0, 0]
  const heard = new Set<number>()
  let allHeard = false, landed = false
  // the wake: up to 6 rings spreading behind the dragged leaf (x, y in stage px, age in s), no allocation per frame
  const WAKE = new Float32Array(18).fill(9)
  let wakeI = 0, wx = 0, wy = 0

  const toStage = (u: number, v: number): Pt => [G!.cx + u * G!.rx, G!.cy + v * G!.ry]
  // guide marks live in ctx.art: a point on the water (unit puddle coords) seen from there (offsets read on layout)
  let sx = 0, sy = 0
  const onArt = (u: number, v: number): Pt => {
    if (!G) return [0, 0]
    const [x, y] = toStage(u, v)
    return [sx + x, sy + y]
  }
  const gd = guide(ctx)
  let leafDot: Mark | null = null
  const rings: (Drop | null)[] = [null, null, null]
  let mid: Drop | null = null

  /** "Ai nói" floats in the clear sky between the far lamp and the right lamp (tall: on the moss under the lamps) */
  function placeCard() {
    if (!card || !G) return
    const { BW, BH, gx, gy, lamps: L, tall } = G
    if (tall) {
      const top = 0.705 * BH - gy
      Object.assign(card.style, { left: '0px', top: `${f1(top)}px`, width: `${f1(BW - gx * 2)}px`, maxHeight: `${f1(BH - 24 - gy - top - 4)}px`, transform: 'none' })
      return
    }
    const far = L[2], right = L[1]
    const x0 = far.x + G.ox + far.H * 0.24 + 56, x1 = right.x + G.ox - right.H * 0.24 - 36
    const w = Math.min(470, x1 - x0)
    const top = 8
    Object.assign(card.style, { left: `${f1((x0 + x1) / 2 - w / 2 - gx)}px`, top: `${top}px`, width: `${f1(w)}px`, maxHeight: `${f1(right.y + G.oy - right.H - 14 - gy - top)}px`, transform: 'none' })
  }

  M!.hear = (k: number) => {
    heard.add(k)
    rings[k]?.hit()
    rings[k] = null
    if (!fromLamp) {
      // touched (or its digit): the lamp lights and speaks, the leaf stays where you left it
      boost.fill(0)
      boost[k] = 1
      loop.start()
    }
    if (heard.size < boost.length) ctx.prompt(fill(A.prompt, { n: heard.size, total: boost.length }))
  }
  M!.all = () => {
    if (allHeard || !G) return
    allHeard = true
    ctx.prompt(A.drop)
    mid = gd.drop(() => onArt(0, 0.04), { w: G.rx * 0.5, h: G.ry * 0.62 })
    mid.el.classList.add('t39v-mid')
  }
  /** the leaf let go in the middle once every lamp has spoken: three equal shadows, a star; and what they share */
  function land() {
    if (landed) return
    landed = true
    tu = 0
    tv = 0.04
    boost.fill(0)
    host.closest('.p2c')?.classList.add('t39v-star')
    mid?.hit()
    leafDot?.done()
    leafDot = null
    loop.start()
    if (still) settle()
    ctx.insight(A.perspectives.common, A.detail)
    ctx.chime('ok')
  }
  const leafK = () => 1 + lv * 0.18
  function placeLeaf() {
    if (!G) return
    const [x, y] = toStage(lu, lv)
    const sc = leafK()
    leaf.style.transform = `translate(${f1(x - leafW / 2)}px,${f1(y - leafH / 2)}px) scale(${sc.toFixed(3)}) rotate(${f1(lu * 6 - 14)}deg)`
  }
  function settle() {
    lu = tu
    lv = tv
    paint(0)
  }

  // the dynamic water: each lamp's warm light on the mirror, the wake rings; then the leaf's three soft shadows, each
  // thrown away from its lamp (short and dark near it, long and faint far from it), drawn with the canvas blur off to one
  // side so only the soft shadow lands
  function paint(dt: number) {
    if (!G) return
    const { cx, cy, rx, ry } = G
    const k = dpr
    g2.setTransform(1, 0, 0, 1, 0, 0)
    g2.clearRect(0, 0, cv.width, cv.height)
    g2.setTransform(k * rx, 0, 0, k * ry, k * (cx - CX), k * (cy - CY))
    g2.save()
    g2.beginPath()
    g2.ellipse(0, 0, 1, 1, 0, 0, Math.PI * 2)
    g2.clip()
    G.lamps.forEach((L, i) => {
      const [au, av] = L.a
      const gr = g2.createRadialGradient(au * 1.2, av * 1.2, 0, au * 1.2, av * 1.2, 0.9)
      gr.addColorStop(0, rgba(T.lantern, 0.5 * lit[i]))
      gr.addColorStop(0.5, rgba(T.lantern, 0.14 * lit[i]))
      gr.addColorStop(1, rgba(T.lantern, 0))
      g2.fillStyle = gr
      g2.fillRect(-1.2, -1.2, 2.4, 2.4)
    })
    g2.restore()
    // the wake: thin rings on the water, wider and fainter as they age
    g2.setTransform(k, 0, 0, k, -k * CX, -k * CY)
    g2.lineWidth = 1.3
    for (let i = 0; i < 6; i++) {
      const age = (WAKE[i * 3 + 2] += dt)
      if (age > 1.4) continue
      const R = 10 + age * 46
      g2.strokeStyle = rgba(T.moon, 0.5 * (1 - age / 1.4))
      g2.beginPath()
      g2.ellipse(WAKE[i * 3], WAKE[i * 3 + 1], R * 1.4, R * 0.5, 0, 0, Math.PI * 2)
      g2.stroke()
    }
    // the shadows, in stage px
    const [x, y] = toStage(lu, lv)
    const sc = leafK() * (leafW / 60)
    const OFF = 4000
    G.lamps.forEach((L, i) => {
      const [lx, ly] = toStage(L.a[0] * 1.5, L.a[1] * 1.5)
      let dx = x - lx, dy = (y - ly) * 2.2
      const dist = Math.hypot(dx, dy) || 1
      dx /= dist
      dy /= dist
      const nearK = clamp(1 - dist / (G!.rx * 2.4), 0, 1)
      const len = (G!.rx * 0.04 + (1 - nearK) * G!.rx * 0.07) * k
      g2.setTransform(k * sc * (0.9 + (1 - nearK) * 0.3), 0, 0, k * sc * FLAT * 0.92, k * (x - OFF - CX), k * (y - CY))
      g2.shadowColor = rgba(T.umbra, clamp(0.22 + nearK * 0.34, 0.2, 0.55) * (0.6 + lit[i] * 0.4))
      g2.shadowBlur = (3 + (1 - nearK) * 6) * k
      g2.shadowOffsetX = OFF * k + dx * len
      g2.shadowOffsetY = dy * len * 0.4
      g2.fillStyle = '#000'
      g2.fill(leafPath)
    })
    g2.shadowColor = 'transparent'
    g2.shadowBlur = 0
    g2.shadowOffsetX = g2.shadowOffsetY = 0
    placeLeaf()
    for (let i = 0; i < lamps.length; i++) {
      lamps[i].style.setProperty('--lit', lit[i].toFixed(2))
      if (pools[i]) pools[i].style.opacity = (0.35 + lit[i] * 0.65).toFixed(2)
    }
  }

  // the loop runs only while the leaf drifts, the light changes or a wake ring spreads
  const loop = createLoop(host, (_t, dt0) => {
    if (!G) return false
    const dt = dt0 || 0.016
    const e = 1 - Math.exp(-dt * 3.2)
    lu += (tu - lu) * e
    lv += (tv - lv) * e
    let busy = Math.abs(tu - lu) + Math.abs(tv - lv) > 0.002
    G.lamps.forEach((L, i) => {
      const d = Math.hypot(lu - L.a[0], lv - L.a[1])
      const want = Math.max(boost[i], clamp(1.05 - d * 0.75, 0.42, 1))
      lit[i] += (want - lit[i]) * e
      if (Math.abs(want - lit[i]) > 0.004) busy = true
    })
    paint(dt)
    for (let i = 0; i < 6; i++) if (WAKE[i * 3 + 2] < 1.4) busy = true
    return busy
  }, { essential: true })

  // drag the leaf over the water; coming close to a lamp reads its view (never the other way round)
  let drag = false
  let L0 = 0, T0 = 0
  leaf.addEventListener('pointerdown', (e) => {
    if (e.button || landed) return
    drag = true
    leaf.setPointerCapture(e.pointerId)
    leaf.classList.add('drag')
    const r = host.getBoundingClientRect()
    L0 = r.left
    T0 = r.top
    mid?.lift(true)
    if (leafDot) leafDot.el.style.visibility = 'hidden'
  })
  leaf.addEventListener('pointermove', (e) => {
    if (!drag || !G) return
    let u = (e.clientX - L0 - G.cx) / G.rx, v = (e.clientY - T0 - G.cy) / G.ry
    const m = Math.hypot(u, v)
    if (m > 0.86) (u = (u / m) * 0.86), (v = (v / m) * 0.86)
    tu = lu = u
    tv = lv = v
    // a ring left behind every ~22 px of travel
    const [x, y] = toStage(u, v)
    if (!ctx.reduced && Math.hypot(x - wx, y - wy) > 22) {
      WAKE[wakeI * 3] = wx = x
      WAKE[wakeI * 3 + 1] = wy = y
      WAKE[wakeI * 3 + 2] = 0
      wakeI = (wakeI + 1) % 6
    }
    const k = G.lamps.findIndex((L) => Math.hypot(u - L.a[0], v - L.a[1]) < 0.3)
    if (k >= 0 && k !== near) visit(k)
    else if (k < 0 && Math.hypot(u, v) < 0.25) near = -1
    loop.start()
  })
  /** the leaf has come to lamp k: it lights and speaks */
  function visit(k: number) {
    near = k
    boost.fill(0)
    fromLamp = true
    api.pick(k)
    fromLamp = false
  }
  const up = () => {
    if (!drag) return
    drag = false
    leaf.classList.remove('drag')
    mid?.lift(false)
    if (leafDot) leafDot.el.style.visibility = ''
    // let go near the middle once every lamp has spoken
    if (allHeard && Math.hypot(lu, lv - 0.04) < 0.32) land()
  }
  leaf.addEventListener('pointerup', up)
  leaf.addEventListener('pointercancel', up)
  leaf.addEventListener('keydown', (e) => {
    if ((e.key !== 'Enter' && e.key !== ' ') || !G || landed) return
    e.preventDefault()
    if (allHeard) return land()
    // on to the next lamp not visited yet
    const k = G.lamps.findIndex((_, i) => !heard.has(i))
    ;[tu, tv] = G.lamps[k].a
    visit(k)
    loop.start()
    if (still) settle()
  })
  // H7: standing still, the leaf drifts a few px toward where it should go next, then back
  let idleT = 0
  const invite = () => {
    if (!G || drag || landed || ctx.reduced) return
    const k = G.lamps.findIndex((_, i) => !heard.has(i))
    const [au, av] = allHeard || k < 0 ? [0, 0.04] : G.lamps[k].a
    const d = Math.hypot(au - lu, av - lv) || 1, step = 8 / G.rx
    const u0 = tu, v0 = tv
    tu = lu + ((au - lu) / d) * step
    tv = lv + ((av - lv) / d) * step * (G.rx / G.ry)
    loop.start()
    clearTimeout(idleT)
    idleT = window.setTimeout(() => !drag && ((tu = u0), (tv = v0), loop.start()), 900)
  }
  ctx.el.addEventListener('p2:idle', invite)
  ctx.onCleanup(() => {
    ctx.el.removeEventListener('p2:idle', invite)
    clearTimeout(idleT)
  })

  api.onLayout((g) => {
    G = geoOf(g)
    M!.geo = G
    // where the stage sits in the art (for the guide marks): read once here
    const st = host.parentElement as HTMLElement
    sx = st.offsetLeft
    sy = st.offsetTop
    dpr = Math.min(devicePixelRatio || 1, ctx.quality === 'low' ? 1 : 1.5)
    CX = G.cx - G.rx * 1.12
    CY = G.cy - G.ry * 1.6
    const cw = G.rx * 2.24, ch = G.ry * 3.1
    cv.width = Math.round(cw * dpr)
    cv.height = Math.round(ch * dpr)
    Object.assign(cv.style, { left: `${f1(CX)}px`, top: `${f1(CY)}px`, width: `${f1(cw)}px`, height: `${f1(ch)}px` })
    // the leaf about 120 px across on a desk (≥ 44 px to touch everywhere)
    leafW = clamp(G.rx * 0.46, 100, 190)
    leafH = leafW * FLAT
    Object.assign(leaf.style, { width: `${f1(leafW)}px`, height: `${f1(leafH)}px` })
    placeCard()
    paintBack()
    paint(0)
    if (!leafDot && !landed) {
      leafDot = gd.dot(leaf, { dir: [-1, 0.3] })
      G.lamps.forEach((L, i) => !heard.has(i) && (rings[i] = gd.drop(() => onArt(L.a[0], L.a[1]), { w: G!.rx * 0.26, h: G!.ry * 0.3 })))
    }
    gd.refresh()
  })

  let mossJob: { cancel(): void } | null = null
  let firstBack = true
  ctx.onCleanup(() => mossJob?.cancel())
  function paintBack() {
    if (!G) return
    const { tall, lamps: Ls, BW, BH, ox, oy, sunX } = G
    const cx = G.cx + ox, cy = G.cy + oy, rx = G.rx, ry = G.ry, hz = G.hz + oy
    const r = rng(3970)
    for (const el of [back, fore]) el.setAttribute('viewBox', `0 0 ${f1(BW)} ${f1(BH)}`)
    const inPuddle = (x: number, y: number, k = 1) => ((x - cx) / (rx * k)) ** 2 + ((y - cy) / (ry * k * 1.12)) ** 2 < 1
    // ── the far bank: the dawn sky and hills, a clipped hedge along the horizon, one maple whose leaf is on the water
    const sky = dawnSky(BW, BH, hz, sunX, 3971, { moon: tall ? [BW * 0.13, BH * 0.15] : [BW * 0.31, BH * 0.15], sunR: tall ? 13 : 22, hillH: tall ? BH * 0.07 : BH * 0.1, sunY: hz - (tall ? BH * 0.05 : BH * 0.075) })
    let hedge = '', hedgeLit = ''
    // a clipped hedge, uneven: low runs, a few tall bushes, gaps; only the bushes catch the sun on their right shoulder
    for (let x = -BW * 0.03; x < BW * 1.03;) {
      const tallB = r() < 0.25, w = BW * (tall ? 0.06 : 0.035) * (0.7 + r() * 1.3) * (tallB ? 1.3 : 1), hh = w * (tallB ? 0.55 + r() * 0.3 : 0.18 + r() * 0.16)
      hedge += blob(x, hz + hh * 0.3, w, hh, 3960 + Math.round(x), 0.22, 16)
      if (tallB) hedgeLit += stroke(curve([x + w * 0.2, hz - hh * 0.62], [x + w * 0.62, hz - hh * 0.45], [x + w * 0.85, hz - hh * 0.05], 8), Math.max(1, hh * 0.08), 0.3, 0.3, 0.1)
      x += w * (0.8 + r() * 0.9) + (r() < 0.2 ? w * 1.2 : 0)
    }
    const tx = tall ? BW * 0.68 : BW * 0.3, ty = hz + (tall ? 5 : 12), tH = tall ? BH * 0.13 : BH * 0.24
    const tree = maple(tx, ty, tH, 3966)
    // ── the ground: moss rising out of the haze, long warm streaks where the low sun grazes it from the right
    const groundTop = hz - 6
    let streak = ''
    for (let i = 0; i < (tall ? 7 : 11); i++) {
      const t = Math.pow((i + r() * 0.8) / (tall ? 7 : 11), 1.3)
      const y = hz + 8 + t * (BH - hz) * 0.85, L = BW * (0.25 + r() * 0.35), x1 = BW * (0.72 + r() * 0.4)
      if (inPuddle(x1 - L * 0.5, y, 1.1)) continue
      streak += blob(x1 - L / 2, y, L / 2, 2 + t * 9, 3950 + i, 0.15, 14)
    }
    // ── long shadows of the lamps: away from the sun, toward the viewer's left, fading as they go (not on the water)
    const shadows = Ls.map((L, i) => {
      const fx = L.x + ox, fy = L.y + oy, w = L.H * 0.17, len = L.H * (tall ? 0.75 : 1.35)
      // each points away from the sun's foot on the horizon (the near lamp's falls left, the right lamp's toward you)
      const ddx = fx - sunX, ddy = (fy - hz) * 1.6, dl = Math.hypot(ddx, ddy) || 1
      const ex = fx + (ddx / dl) * len, ey = fy + (ddy / dl) * len * 0.55
      const id = `t39v-sh${i}`
      const grad = s('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1: f1(fx), y1: f1(fy), x2: f1(ex), y2: f1(ey) },
        s('stop', { offset: 0, style: 'stop-color:var(--umbra);stop-opacity:.85' }),
        s('stop', { offset: 0.45, style: 'stop-color:var(--umbra);stop-opacity:.42' }),
        s('stop', { offset: 1, style: 'stop-color:var(--umbra);stop-opacity:0' }))
      // a band from the foot to a wider, rounded tip (across it: n, flattened by the low eye)
      const sl = Math.hypot(ex - fx, ey - fy) || 1, nx = -(ey - fy) / sl, ny = ((ex - fx) / sl) * 0.45
      const P2 = (x: number, y: number) => `${f1(x)} ${f1(y)}`
      const d = `M${P2(fx + nx * w, fy + ny * w)}L${P2(ex + nx * w * 2, ey + ny * w * 2)}Q${P2(ex + (ex - fx) / sl * w * 1.6, ey + (ey - fy) / sl * w * 0.7)} ${P2(ex - nx * w * 2, ey - ny * w * 2)}L${P2(fx - nx * w, fy - ny * w)}Z`
      return [grad, s('path', { class: 't39v-cast', fill: `url(#${id})`, d })] as const
    })
    // the warm pool each lamp lays on the moss at its foot
    pools = Ls.map((L) => s('ellipse', { class: 't39v-pool', cx: f1(L.x + ox + L.H * 0.04), cy: f1(L.y + oy), rx: f1(L.H * 0.55), ry: f1(L.H * 0.12), fill: 'url(#g39-lamp)' }))
    // ── the puddle: a dark wet rim of mud, the mirror (dawn at its far edge, the deep near you), the far bank and the far
    // lamp upside down in it — darker than they are, cut by ripples, fading down — glints, a sunlit far lip
    const P = blob(cx, cy, rx, ry, 3972, 0.05, 26)
    const far = Ls[2]
    const ffx = far.x + ox, ffy = far.y + oy
    const fsc = far.H / 68
    const rip = (n: number, cls: string, v0: number, v1: number, seed: number) => {
      const q = rng(seed)
      let d = ''
      for (let i = 0; i < n; i++) {
        const v = v0 + q() * (v1 - v0), u = (q() - 0.5) * 2 * Math.sqrt(Math.max(0, 1 - v * v)) * 0.95
        const L = rx * (0.03 + q() * 0.09) * (1 + v * 0.6)
        const x = cx + u * rx, y = cy + v * ry
        d += stroke([[x - L / 2, y], [x, y + (q() - 0.5) * 1.2], [x + L / 2, y]], 0.8 + q() * (1.2 + v), 0.3, 0.3, 0.1)
      }
      return s('path', { class: cls, d })
    }
    // the ripples that break the reflections: gaps of water, wider and closer together toward you
    let cuts = ''
    for (let y = cy - ry, i = 0; y < cy + ry; i++) {
      const v = (y - cy) / ry
      const gap = 3 + (v + 1) * 4
      cuts += `M${f1(cx - rx)} ${f1(y)}h${f1(rx * 2)}`
      y += gap + 6 - (v + 1) * 1.6
    }
    let pebbles = '', pebHi = ''
    for (let i = 0; i < 26; i++) {
      const a = (0.1 + r() * 0.8) * Math.PI, k = 1.0 + r() * 0.08
      const x = cx + Math.cos(a) * rx * k, y = cy + Math.sin(a) * ry * k * 1.08, R = 2 + r() * (3 + Math.sin(a) * 5)
      pebbles += blob(x, y, R * 1.3, R * 0.7, 3920 + i, 0.2, 9)
      pebHi += blob(x + R * 0.35, y - R * 0.3, R * 0.6, R * 0.25, 3940 + i, 0.2, 7)
    }
    // moss creeping over the near rim: small humps whose foot sits a little in the water
    let rimMoss = '', rimLit = ''
    for (let a = 8; a < 172;) {
      const da = 4 + r() * 7, a0 = (a * Math.PI) / 180, a1 = ((a + da) * Math.PI) / 180
      const k = 0.97 + r() * 0.05
      const x0 = cx + Math.cos(a0) * rx * k, y0 = cy + Math.sin(a0) * ry * k * 1.04, x1 = cx + Math.cos(a1) * rx * k, y1 = cy + Math.sin(a1) * ry * k * 1.04
      const hh = (3 + r() * 5) * (0.5 + Math.sin(a0) * 0.8) * (tall ? 0.7 : 1)
      if (r() < 0.75) {
        rimMoss += `M${f1(x1)} ${f1(y1)}Q${f1((x0 + x1) / 2)} ${f1((y0 + y1) / 2 - hh * 2)} ${f1(x0)} ${f1(y0)}L${f1(x0)} ${f1(y0 + hh)}L${f1(x1)} ${f1(y1 + hh)}Z`
        rimLit += stroke([[(x0 + x1) / 2, (y0 + y1) / 2 - hh], [x0 + (x1 - x0) * 0.2, y0 - hh * 0.5]], Math.max(0.8, hh * 0.3), 0.3, 0.5, 0.2)
      }
      a += da
    }
    // the far bank's reflection: the horizon's things flipped so their foot meets the far shore of the water
    const yE = cy - ry * 0.98
    const flip = `translate(0 ${f1(hz + yE)}) scale(1 -1)`
    back.replaceChildren(
      s('defs', null,
        s('clipPath', { id: 't39v-pc' }, s('path', { d: P })),
        s('clipPath', { id: 't39v-dry' }, s('path', { d: `M-10 -10H${f1(BW + 10)}V${f1(BH + 10)}H-10Z${P}`, 'clip-rule': 'evenodd' })),
        s('mask', { id: 't39v-cuts', maskUnits: 'userSpaceOnUse', x: f1(cx - rx), y: f1(cy - ry), width: f1(rx * 2), height: f1(ry * 2) },
          s('rect', { x: f1(cx - rx), y: f1(cy - ry), width: f1(rx * 2), height: f1(ry * 2), fill: 'url(#t39v-fade)' }),
          s('path', { d: cuts, stroke: '#000', 'stroke-width': 2.2, fill: 'none' })),
        s('linearGradient', { id: 't39v-fade', x1: 0, y1: 0, x2: 0, y2: 1 },
          s('stop', { offset: 0, 'stop-color': '#fff' }), s('stop', { offset: 0.55, 'stop-color': '#888' }), s('stop', { offset: 1, 'stop-color': '#000' })),
        s('linearGradient', { id: 't39v-mirror', gradientUnits: 'userSpaceOnUse', x1: 0, y1: f1(cy - ry), x2: 0, y2: f1(cy + ry) },
          s('stop', { offset: 0, style: 'stop-color:var(--t39v-m0)' }),
          s('stop', { offset: 0.42, style: 'stop-color:var(--t39v-m1)' }),
          s('stop', { offset: 1, style: 'stop-color:var(--t39v-m2)' })),
        s('linearGradient', { id: 't39v-groundg', x1: 0, y1: f1(groundTop), x2: 0, y2: f1(BH), gradientUnits: 'userSpaceOnUse' },
          s('stop', { offset: 0, style: 'stop-color:var(--t39v-far);stop-opacity:0' }),
          s('stop', { offset: 0.05, style: 'stop-color:var(--t39v-far)' }),
          s('stop', { offset: 0.3, style: 'stop-color:var(--t39v-mid)' }),
          s('stop', { offset: 1, style: 'stop-color:var(--t39v-near)' })),
        s('linearGradient', { id: 't39v-streakg', x1: 0, y1: 0, x2: 1, y2: 0 },
          s('stop', { offset: 0, style: 'stop-color:var(--lantern);stop-opacity:0' }),
          s('stop', { offset: 0.7, style: 'stop-color:var(--lantern);stop-opacity:.5' }),
          s('stop', { offset: 1, style: 'stop-color:var(--lantern);stop-opacity:.9' })),
        // one moss row: lit at the humps' tops, dark down in the crevice
        ...[0, 1, 2].map((i) => s('linearGradient', { id: `t39v-row${i}`, x1: 0, y1: 0, x2: 0, y2: 1 },
          s('stop', { offset: 0, style: `stop-color:var(--t39v-r${i}a)` }),
          s('stop', { offset: 0.45, style: `stop-color:var(--t39v-r${i}b)` }),
          s('stop', { offset: 1, style: `stop-color:var(--t39v-r${i}c)` }))),
        // the lamps' granite: shade on the left, mid grey, the dawn warm on the right edge (tokens on .t39v-bleed)
        s('linearGradient', { id: 't39v-granite', x1: 0, y1: 0, x2: 1, y2: 0 },
          s('stop', { offset: 0, style: 'stop-color:var(--t39v-g0)' }),
          s('stop', { offset: 0.5, style: 'stop-color:var(--t39v-g1)' }),
          s('stop', { offset: 1, style: 'stop-color:var(--t39v-g2)' })),
        ...shadows.map(([gr]) => gr)),
      ...sky,
      tree,
      s('path', { class: 't39v-hedge', d: hedge }),
      s('path', { class: 't39v-hedge-lit', d: hedgeLit }),
      s('rect', { class: 't39v-ground', x: -2, y: f1(groundTop), width: f1(BW + 4), height: f1(BH - groundTop + 4), fill: 'url(#t39v-groundg)' }),
      s('path', { class: 't39v-streak', d: streak, fill: 'url(#t39v-streakg)' }),
      mossG,
      ...pools,
      // the shadows over the lamps' warm pools: the stone blocks its own fire's light on the side away from the sun
      s('g', { 'clip-path': 'url(#t39v-dry)', class: 't39v-casts' }, ...shadows.map(([, p]) => p)),
      s('path', { class: 't39v-mud', d: blob(cx - rx * 0.01, cy + ry * 0.05, rx * 1.03, ry * 1.1, 3974, 0.06, 26) }),
      s('path', { class: 't39v-mirror', d: P, fill: 'url(#t39v-mirror)' }),
      s('g', { 'clip-path': 'url(#t39v-pc)' },
        // the dawn glow mirrored toward the sun's side, the sky's band along the far edge
        s('ellipse', { class: 't39v-dawnref', cx: f1(cx + rx * 0.62), cy: f1(cy - ry * 0.72), rx: f1(rx * 0.6), ry: f1(ry * 0.42), fill: 'url(#g39-sun)' }),
        s('ellipse', { class: 't39v-dawnref', cx: f1(cx + rx * 0.3), cy: f1(cy - ry * 0.97), rx: f1(rx * 1.1), ry: f1(ry * 0.14), fill: 'url(#g39-dawn)' }),
        s('g', { class: 't39v-reflect', mask: 'url(#t39v-cuts)' },
          s('g', { transform: flip },
            s('path', { class: 't39v-hedge', d: hedge }),
            maple(tx, ty, tH, 3966)),
          s('g', { transform: `translate(${f1(ffx)} ${f1(ffy + 2)}) scale(${f2(fsc)} ${f2(-fsc)})` }, lantern(3990, true))),
        rip(tall ? 30 : 60, 't39v-rip-lt', -0.95, 0.1, 3955),
        rip(tall ? 24 : 46, 't39v-rip-dk', -0.2, 0.95, 3956)),
      s('path', { class: 't39v-lip', d: stroke(Array.from({ length: 17 }, (_, i) => {
        const a = (196 + i * 9.5) * (Math.PI / 180)
        return [cx + Math.cos(a) * rx * 1.005, cy + Math.sin(a) * ry * 1.02] as Pt
      }), Math.max(1.4, ry * 0.022), 0.2, 0.2, 0.1) }),
      s('path', { class: 't39v-nearlip', d: stroke(Array.from({ length: 17 }, (_, i) => {
        const a = (12 + i * 9.7) * (Math.PI / 180)
        return [cx + Math.cos(a) * rx * 1.01, cy + Math.sin(a) * ry * 1.04] as Pt
      }), Math.max(2, ry * 0.04), 0.3, 0.3, 0.1) }),
      s('path', { class: 't39v-peb', d: pebbles }),
      s('path', { class: 't39v-peb-hi', d: pebHi }),
      s('path', { class: 't39v-rimmoss', d: rimMoss }),
      s('path', { class: 't39v-rimmoss-lit', d: rimLit }))
    // ── the moss: rows of cushions flattened by the low eye — fine and hazy at the horizon, big humps near the lens —
    // each row a continuous strip (lit on top, dark in the crevice before the next row), the low sun catching every
    // hump's right slope; fronds and dew on the near rows (built in slices, one row per slice)
    function* moss(): Generator {
      const q = rng(3981)
      const body: SVGElement[] = [], lit = ['', '', '']
      let fronds = '', dew = ''
      const rows = tall ? 30 : 46
      const yAt = (i: number) => hz + 2 + Math.pow(i / (rows - 1), 1.75) * (BH - hz + 30)
      for (let i = 0; i < rows; i++) {
        const t = i / (rows - 1)
        const y = yAt(i), gap = yAt(i + 1) - y
        const w = (tall ? 4 : 5) + t * t * (tall ? 40 : 96)
        const amp = Math.max(1.2, w * (0.24 - t * 0.08))
        const b = t < 0.22 ? 0 : t < 0.55 ? 1 : 2
        let x = -w * (0.5 + q())
        let d = `M${f1(x)} ${f1(y)}`
        while (x < BW + w) {
          // uneven cushions: mostly small humps, now and then a big one, their feet not on one line
          const big = q() < 0.14
          const ww = w * (0.4 + q() * 1.1) * (big ? 1.8 : 1), hh = amp * (0.35 + q() * 0.9) * (big ? 1.7 : 1)
          const y1 = y + (q() - 0.5) * gap * 0.6
          d += `Q${f1(x + ww / 2)} ${f1(y1 - hh * 2)} ${f1(x + ww)} ${f1(y1)}`
          if (t > 0.06 && !inPuddle(x + ww / 2, y - hh, 1.02)) {
            lit[b] += stroke([[x + ww * 0.48, y1 - hh * 0.98], [x + ww * 0.72, y1 - hh * 0.74], [x + ww * 0.92, y1 - hh * 0.2]], Math.max(0.7, hh * 0.42), 0.25, 0.6, 0.2)
            if (t > 0.5) {
              for (let f = 0; f < 3; f++) {
                const fx = x + ww * (0.2 + q() * 0.7), fy = y1 - hh * (0.7 + q() * 0.3)
                fronds += stroke([[fx, fy], [fx + (q() - 0.5) * hh * 0.2, fy - hh * (0.1 + q() * 0.16)]], Math.max(0.6, hh * 0.05), 0.1, 0.6, 0.3)
              }
              if (q() < 0.18) {
                const R = Math.max(0.9, hh * 0.08), dx = x + ww * 0.72, dy = y1 - hh * 0.75
                dew += `M${f1(dx - R)} ${f1(dy)}a${f1(R)} ${f1(R)} 0 1 0 ${f1(R * 2)} 0a${f1(R)} ${f1(R)} 0 1 0 ${f1(-R * 2)} 0`
              }
            }
          }
          x += ww
        }
        // its own element, so its gradient spans this row only: lit hump tops, the crevice dark
        body.push(s('path', { class: `t39v-mrow t39v-b${b}`, d: `${d}L${f1(x)} ${f1(y + gap + amp * 1.5)}L${f1(-w * 2)} ${f1(y + gap + amp * 1.5)}Z`, fill: `url(#t39v-row${b})` }))
        if (i % 3 === 2) yield
      }
      mossG.replaceChildren(
        ...body,
        ...lit.map((d, i) => s('path', { class: `t39v-mlit t39v-b${i}`, d })),
        s('path', { class: 't39v-frond', d: fronds }), s('path', { class: 't39v-dew', d: dew }))
    }
    mossJob?.cancel()
    mossJob = sliced(moss(), { sync: ctx.reduced || !firstBack })
    firstBack = false
    // ── nearest of all, a finger from the lens: huge out-of-focus moss mounds along the foot of the frame, lit from the
    // right, the dawn caught as bokeh in their dew (clear of the near lamp's foot and the text under it on a phone)
    let nearD = '', nearSh = '', nearHi = '', bokeh = ''
    const base = BH + 4
    const mounds: [number, number, number][] = tall
      ? [[-0.06, 0.16, 0.05], [1.05, 0.18, 0.06]]
      : [[-0.02, 0.07, 0.08], [0.36, 0.1, 0.05], [0.58, 0.14, 0.07], [0.8, 0.11, 0.06], [1.0, 0.12, 0.09]]
    for (const [fx, fw, fh] of mounds) {
      const x = fx * BW, w = fw * BW, hh = fh * BH
      nearSh += blob(x - w * 0.15, base, w * 1.1, hh * 0.7, Math.round(x) + 1, 0.25, 16)
      nearD += blob(x, base, w, hh, Math.round(x) + 2, 0.25, 18)
      nearHi += blob(x + w * 0.3, base - hh * 0.72, w * 0.55, hh * 0.2, Math.round(x) + 3, 0.3, 12)
      for (let i = 0; i < 3; i++) {
        const bx = x + (r() - 0.2) * w, by = base - hh * (0.5 + r() * 0.4), R = 4 + r() * 9
        bokeh += `M${f1(bx + R)} ${f1(by)}A${f1(R)} ${f1(R)} 0 1 0 ${f1(bx - R)} ${f1(by)}A${f1(R)} ${f1(R)} 0 1 0 ${f1(bx + R)} ${f1(by)}Z`
      }
    }
    fore.replaceChildren(
      s('path', { class: 't39v-near-sh', d: nearSh }),
      s('path', { class: 't39v-near', d: nearD }),
      s('path', { class: 't39v-near-hi', d: nearHi }),
      s('path', { class: 't39v-bokeh', d: bokeh }))
  }
  const mossG = s('g', { class: 't39v-mossg' })

  ctx.onCleanup(onPrefs(() => {
    const t = readTok()
    if (t.lantern === T.lantern && t.umbra === T.umbra && t.moon === T.moon) return
    T = t
    paint(0)
  }))
  ctx.onCleanup(() => {
    loop.dispose()
    wrap.remove()
  })
  return () => {}
}

const f2 = (n: number) => n.toFixed(3)

/** A small maple on the far bank (foot at x, y; h tall): a dark trunk and boughs, its red crown in clumps on the boughs'
 *  ends, lit on the sun's side. The leaf on the water fell from it. */
function maple(x: number, y: number, hh: number, seed: number): SVGGElement {
  const r = rng(seed)
  const top: Pt = [x - hh * 0.08, y - hh * 0.62]
  let wood = stroke([[x, y], [x - hh * 0.03, y - hh * 0.3], top], Math.max(2, hh * 0.05), 0.02, 0.5, 0.2)
  const ends: Pt[] = []
  for (let i = 0; i < 6; i++) {
    const t = 0.35 + (i / 5) * 0.6
    const bx = x - hh * 0.06 * t, by = y - hh * 0.62 * t
    const side = i % 2 ? 1 : -1
    const ex = bx + side * hh * (0.22 + r() * 0.16), ey = by - hh * (0.1 + r() * 0.14)
    wood += stroke([[bx, by], [(bx + ex) / 2, by - hh * 0.06], [ex, ey]], Math.max(1, hh * 0.018), 0.05, 0.6, 0.3)
    ends.push([ex, ey])
  }
  ends.push(top)
  let crown = '', crownLit = '', crownDk = ''
  for (const [ex, ey] of ends) {
    for (let k = 0; k < 7; k++) {
      const lx = ex + (r() - 0.5) * hh * 0.2, ly = ey + (r() - 0.6) * hh * 0.12
      const d = leafD(lx, ly, hh * (0.045 + r() * 0.03), r() * 360)
      if (lx > ex + hh * 0.03 && ly < ey) crownLit += d
      else if (ly > ey + hh * 0.02) crownDk += d
      else crown += d
    }
  }
  return s('g', { class: 't39v-maple' },
    s('path', { class: 't39v-maple-wood', d: wood }),
    s('path', { class: 't39v-maple-dk', d: crownDk }),
    s('path', { class: 't39v-maple-leaf', d: crown }),
    s('path', { class: 't39v-maple-lit', d: crownLit }))
}

/** A granite kasuga lantern, front view, foot on y = 0, 70 tall (the component's stone box), standing on a flat stone
 *  slab bedded in the moss: the six-sided base and post, the platform, the firebox with its fire behind a lattice, the
 *  wide roof with curled corners, the jewel. Weathered: grain, cracks, lichen; the dawn warm on its right edge. Only the
 *  post and firebox take a touch (`t39v-hit`, ~2.4 units wide). `ghost` (the puddle's reflection) skips fire and slab. */
function lantern(seed: number, ghost = false): SVGGElement {
  const r = rng(seed)
  const u = 7
  const X = (v: number) => f1(v * u), Y = (v: number) => f1(-v * u)
  const quad = (l0: number, r0: number, b: number, l1: number, r1: number, t: number) => `M${X(l0)} ${Y(b)}L${X(r0)} ${Y(b)}L${X(r1)} ${Y(t)}L${X(l1)} ${Y(t)}Z`
  const base = quad(-1.35, 1.35, 0, -1.1, 1.1, 0.7) + quad(-1.0, 1.0, 0.7, -0.62, 0.62, 1.15)
  const post = quad(-0.42, 0.42, 1.15, -0.36, 0.36, 4.5) + quad(-0.5, 0.5, 2.75, -0.5, 0.5, 2.98)
  const deck = quad(-0.62, 0.62, 4.5, -1.32, 1.32, 5.3)
  const frame = `M${X(-1.02)} ${Y(5.3)}h${f1(u * 0.36)}v${f1(-u * 2)}h${f1(-u * 0.36)}ZM${X(0.66)} ${Y(5.3)}h${f1(u * 0.36)}v${f1(-u * 2)}h${f1(-u * 0.36)}Z`
  const roof = `M${X(-1.1)} ${Y(7.3)}L${X(-1.95)} ${Y(7.3)}Q${X(-2.18)} ${Y(7.3)} ${X(-2.26)} ${Y(7.6)}Q${X(-1.62)} ${Y(7.62)} ${X(-1.25)} ${Y(7.95)}L${X(-0.42)} ${Y(8.55)}Q${X(0)} ${Y(8.68)} ${X(0.42)} ${Y(8.55)}L${X(1.25)} ${Y(7.95)}Q${X(1.62)} ${Y(7.62)} ${X(2.26)} ${Y(7.6)}Q${X(2.18)} ${Y(7.3)} ${X(1.95)} ${Y(7.3)}L${X(1.1)} ${Y(7.3)}Z`
  const jewel = blob(0, -9.25 * u, u * 0.36, u * 0.46, seed, 0.1, 10) + quad(-0.28, 0.28, 8.62, -0.2, 0.2, 8.85)
  const stone = base + post + deck + frame + roof + jewel
  let speckDk = '', speckLt = ''
  for (let i = 0; i < 40; i++) {
    const y = r() * 8.6
    const w = y < 0.7 ? 1.2 : y < 1.15 ? 0.8 : y < 4.5 ? 0.36 : y < 5.3 ? 0.62 + (y - 4.5) : y < 7.3 ? 0.95 : 1.8 - (y - 7.3) * 1.1
    const x = (r() - 0.5) * 2 * Math.max(0.2, w) * u
    const d = blob(x, -y * u, 0.18 + r() * 0.28, 0.14 + r() * 0.18, seed + i, 0.3, 6)
    if (r() < 0.55) speckDk += d
    else speckLt += d
  }
  const cracks = stroke([[-0.22 * u, -1.5 * u], [-0.08 * u, -2.3 * u], [-0.18 * u, -3.5 * u]], 0.45, 0.2, 0.3, 0.3) + stroke([[0.7 * u, -4.85 * u], [0.2 * u, -5.08 * u]], 0.45, 0.2, 0.3, 0.3)
  let lichen = ''
  for (let i = 0; i < 6; i++) lichen += blob((r() - 0.5) * 2.6 * u, -(7.55 + r() * 0.5) * u, 1.2 + r() * 2, 0.5 + r() * 0.8, seed + 40 + i, 0.35, 8)
  lichen += blob(-0.9 * u, -5.15 * u, 2.4, 0.8, seed + 50, 0.3, 8) + blob(0.8 * u, -0.6 * u, 2.6, 0.8, seed + 51, 0.3, 8)
  // the dawn on its right edges
  const rimR = stroke([[1.35 * u, 0], [1.1 * u, -0.7 * u]], 0.8, 0.1, 0.1, 0.3) + stroke([[0.42 * u, -1.2 * u], [0.36 * u, -4.45 * u]], 0.6, 0.1, 0.1, 0.3) + stroke([[1.32 * u, -5.3 * u], [0.62 * u, -4.5 * u]], 0.7, 0.1, 0.1, 0.3) + stroke([[1.02 * u, -5.3 * u], [1.02 * u, -7.3 * u]], 0.7, 0.1, 0.1, 0.3) + stroke([[0.42 * u, -8.55 * u], [1.25 * u, -7.95 * u], [2.26 * u, -7.6 * u]], 0.8, 0.2, 0.2, 0.2)
  // the slab it stands on: a flat fieldstone sunk in the moss, its lit top and dark front lip, a tuft of moss at its edge
  const slab = blob(0.4, 1.2, u * 2.1, u * 0.42, seed + 60, 0.12, 16)
  const slabTop = blob(0.2, 0.2, u * 1.95, u * 0.3, seed + 61, 0.12, 16)
  return s('g', { class: 't39v-lamp' },
    ghost ? null : s('ellipse', { class: 't39v-contact', cx: -2, cy: 2.4, rx: f1(u * 2.5), ry: f1(u * 0.55) }),
    ghost ? null : s('path', { class: 't39v-slab', d: slab }),
    ghost ? null : s('path', { class: 't39v-slab-top', d: slabTop }),
    ghost ? null : s('path', { class: 't39v-slab-moss', d: blob(-u * 1.6, 1.4, u * 0.5, u * 0.16, seed + 62, 0.3, 9) + blob(u * 1.7, 1.1, u * 0.35, u * 0.12, seed + 63, 0.3, 9) }),
    ghost ? null : s('ellipse', { class: 't39v-foot', cx: 0.6, cy: 0.4, rx: f1(u * 1.45), ry: f1(u * 0.16) }),
    ghost ? null : s('circle', { class: 't39v-halo', cx: 0, cy: Y(6.3), r: f1(u * 4.6), fill: 'url(#g39-lamp)' }),
    s('path', { class: 't39v-fire', d: `M${X(-1)} ${Y(5.3)}H${X(1)}V${Y(7.3)}H${X(-1)}Z` }),
    ghost ? null : s('ellipse', { class: 't39v-flame', cx: 0, cy: Y(6.1), rx: f1(u * 0.3), ry: f1(u * 0.48) }),
    s('path', { class: 't39v-lamp-stone', d: stone, fill: 'url(#g39-lampstone)', filter: ghost ? null : 'url(#ink-rough)' }),
    s('path', { class: 't39v-eave', d: `M${X(-1.95)} ${Y(7.3)}H${X(1.95)}V${Y(7.42)}H${X(-1.95)}Z` }),
    s('path', { class: 't39v-lattice', d: `M${X(-0.28)} ${Y(5.3)}h${f1(u * 0.12)}v${f1(-u * 2)}h${f1(-u * 0.12)}ZM${X(0.16)} ${Y(5.3)}h${f1(u * 0.12)}v${f1(-u * 2)}h${f1(-u * 0.12)}Z` }),
    ghost ? null : s('path', { class: 't39v-speck-dk', d: speckDk }),
    ghost ? null : s('path', { class: 't39v-speck-lt', d: speckLt }),
    ghost ? null : s('path', { class: 't39v-crack', d: cracks }),
    s('path', { class: 't39v-lichen', d: lichen }),
    ghost ? null : s('path', { class: 't39v-lamp-rim', d: rimR }),
    ghost ? null : s('path', { class: 't39v-firelit', d: stroke([[-1.05 * u, -7.3 * u], [1.05 * u, -7.3 * u]], 0.8, 0.1, 0.1, 0.4) + stroke([[-1.32 * u, -5.3 * u], [1.32 * u, -5.3 * u]], 0.8, 0.1, 0.1, 0.4) }),
    ghost ? null : s('rect', { class: 't39v-hit', x: X(-1.2), y: Y(8.75), width: f1(u * 2.4), height: f1(u * 8.75) }))
}
