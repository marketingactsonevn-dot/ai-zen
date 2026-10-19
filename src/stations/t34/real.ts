import './real.css'
import { fill, h, s } from '../../core/dom'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import { blob, clamp, rng, stroke, type Pt } from '../../ui/part2/ink'
import { perspectiveCircle, type CircleApi } from '../../ui/part2/perspectives'
import { guide } from '../../ui/part2/guide'
import { findTakeaway, foldedTakeaway } from '../../ui/part2/takeaway'
import type { Perspectives } from '../../ui/part2/types'
import type { SceneDef } from '../types'
import { C } from './content'
import { bleedBelow, brush, dprFor, grain, inkLine, layer, mirrorOf, mist, mix, moonDisc, mountains, noise, poly, rgba, soft, vgrad, watchTok, type C4, type Tok } from './cv'

const K = C.scenes.real

/*
 * Scene 4 — real and fake. Eye level on the bank of a night lake, looking across: a drum bridge (taiko-bashi) spans
 * the water on a slant — a thick curved girder, planked deck, a railing with giboshi knobs — and the arch and its broken
 * reflection close into one ring, an ensō, its gap left in a dry brush stroke. On the crown stands a model drawn in brush
 * strokes, vermilion scarf, the moon behind her in a soft band of mist. Her reflection hangs under her inside the ring,
 * painted like her — until a ripple passes: wherever the water stirs, the skin of the reflection slides off and shows the
 * polygon avatar beneath, drawn in another ink (thin straight lines, flat facets). The person on the bridge never
 * changes. Four shore stones each carry a small stone lantern; heard, it lights, throws a warm pool and a streak on the
 * water, and what it says is written in ink on the water beside it, with its faint reflection. When all four are heard
 * the water stills and a vermilion seal floats down onto the reflection. Reeds and lotus leaves frame the near water.
 * Step 1 is the swipe (an ink arrow over the reflection says so); the first ripple writes what the reflection is under
 * it. Step 2 is the four stones; then the checklist card lies folded on the near water.
 * perspectiveCircle keeps the stones, keys, aria and reading text; this file paints the lake and moves the words.
 */

/** the model standing on (x, y), H tall, in brush strokes: [coat wash, ink strokes, vermilion scarf] (path data) */
function model(x: number, y: number, H: number): [string, string, string] {
  const k = (a: number, b: number): Pt => [x + a * H, y - b * H]
  const P = (p: Pt) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`
  const coat = `M${P(k(-0.085, 0.8))}Q${P(k(-0.11, 0.55))} ${P(k(-0.15, 0.31))}L${P(k(0.13, 0.3))}Q${P(k(0.1, 0.55))} ${P(k(0.085, 0.8))}Q${P(k(0, 0.835))} ${P(k(-0.085, 0.8))}Z`
  const strokes =
    blob(x, y - H * 0.915, H * 0.052, H * 0.064, 7, 0.08, 10) +
    stroke([k(-0.04, 0.3), k(-0.045, 0.15), k(-0.05, 0)], H * 0.032, 0.05, 0.2, 0.5) +
    stroke([k(0.03, 0.3), k(0.045, 0.15), k(0.065, 0.005)], H * 0.032, 0.05, 0.2, 0.5) +
    stroke([k(0.085, 0.78), k(0.16, 0.62), k(0.1, 0.5)], H * 0.026, 0.1, 0.3, 0.5) +
    stroke([k(-0.08, 0.78), k(-0.11, 0.6), k(-0.12, 0.44)], H * 0.026, 0.1, 0.3, 0.5) +
    stroke([k(-0.085, 0.8), k(-0.12, 0.56), k(-0.15, 0.31)], H * 0.02, 0.1, 0.1, 0.3) +
    stroke([k(-0.15, 0.31), k(0, 0.29), k(0.13, 0.3)], H * 0.018, 0.1, 0.1, 0.3)
  const scarf = stroke([k(-0.06, 0.83), k(0.02, 0.8), k(0.07, 0.83)], H * 0.04, 0.2, 0.2, 0.4) + stroke([k(0.05, 0.82), k(0.07, 0.7), k(0.05, 0.6)], H * 0.026, 0.1, 0.4, 0.3)
  return [coat, strokes, scarf]
}
/** the same pose upside down from (x, y0) (feet at y0, head down): a faceted avatar — head as a hexagon, flat facets */
function avatar(x: number, y0: number, H: number): { lines: string; facets: string } {
  const k = (a: number, b: number) => `${(x + a * H).toFixed(1)} ${(y0 + b * H).toFixed(1)}`
  const head = Array.from({ length: 6 }, (_, i) => k(Math.cos((i * Math.PI) / 3) * 0.058, 0.915 + Math.sin((i * Math.PI) / 3) * 0.066))
  const facets = `M${k(-0.085, 0.8)}L${k(-0.11, 0.55)}L${k(0.1, 0.55)}L${k(0.085, 0.8)}Z` + `M${k(-0.11, 0.55)}L${k(-0.15, 0.31)}L${k(0.13, 0.3)}L${k(0.1, 0.55)}Z` + `M${head.join('L')}Z`
  const lines = `M${head.join('L')}Z` + `M${k(0, 0.85)}L${k(0, 0.98)}M${k(-0.05, 0.9)}L${k(0.05, 0.94)}` +
    `M${k(-0.085, 0.8)}L${k(-0.11, 0.55)}L${k(-0.15, 0.31)}L${k(0.13, 0.3)}L${k(0.1, 0.55)}L${k(0.085, 0.8)}Z` +
    `M${k(-0.11, 0.55)}L${k(0.1, 0.55)}L${k(-0.15, 0.31)}M${k(0, 0.8)}L${k(0.1, 0.55)}M${k(-0.085, 0.8)}L${k(0, 0.66)}L${k(0.085, 0.8)}M${k(0, 0.66)}L${k(-0.11, 0.55)}` +
    `M${k(-0.04, 0.3)}L${k(-0.05, 0)}M${k(0.03, 0.3)}L${k(0.065, 0)}M${k(0.085, 0.78)}L${k(0.16, 0.62)}L${k(0.1, 0.5)}M${k(-0.08, 0.78)}L${k(-0.12, 0.44)}`
  return { lines, facets }
}

interface Geo {
  w: number; h: number; wide: boolean; water: number
  A: Pt; B: Pt; rise: number; apex: Pt; refl: Pt; figH: number
  moon: Pt; moonR: number
  stones: { x: number; y: number; s: number; z: number }[]
  /** where each stone's words are written on the water: left, top, width (art px) */
  says: [number, number, number][]
}
/** where everything stands in the art (px): the bridge on a slant, its crown, the reflection, the moon, the four stones */
function compose(w: number, h: number): Geo {
  const wide = w / h > 1.15
  const water = h * (wide ? 0.4 : 0.27)
  const A: Pt = wide ? [w * 0.3, h * 0.66] : [w * 0.14, h * 0.47]
  const B: Pt = wide ? [w * 0.7, h * 0.56] : [w * 0.86, h * 0.41]
  const span = Math.hypot(B[0] - A[0], B[1] - A[1])
  const rise = span * (wide ? 0.32 : 0.33)
  const mid: Pt = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2]
  const apex: Pt = [mid[0], mid[1] - rise]
  // her reflection hangs under her inside the ring: feet at the water line, head toward the ring's bottom
  const refl: Pt = [mid[0], mid[1] + rise * 0.06]
  const figH = clamp(rise * (wide ? 0.66 : 0.9), 54, 180)
  const moonR = clamp(figH * 0.22, 12, 38)
  const s0 = clamp(w / 900, 0.62, 1.25)
  const sw = Math.min(330, w * 0.24)
  return {
    w, h, wide, water, A, B, rise, apex, refl, figH,
    moon: [apex[0] + figH * 0.16, Math.max(moonR * 1.5, apex[1] - figH * 0.78)], moonR,
    // k clockwise: the far foot (top right), the near right bank, the near left bank (cut by the frame), the near foot
    stones: wide
      ? [
          { x: B[0] + w * 0.06, y: B[1] + 8, s: 0.7 * s0, z: 1 },
          { x: w * 0.92, y: h * 1.03, s: 1.3 * s0, z: 9 },
          { x: w * 0.06, y: h * 1.04, s: 1.4 * s0, z: 9 },
          { x: A[0] - w * 0.045, y: A[1] + 14, s: 0.86 * s0, z: 2 },
        ]
      : [
          { x: w * 0.9, y: B[1] + 26, s: 0.8, z: 1 },
          { x: w * 0.84, y: h * 0.69, s: 1.15, z: 9 },
          { x: w * 0.15, y: h * 0.71, s: 1.15, z: 9 },
          { x: w * 0.09, y: A[1] + 30, s: 0.85, z: 2 },
        ],
    // wide: on the open water left and right of the ring, beside the stone; phone: the foot band under the lake
    says: wide
      ? [
          [w * 0.745, h * 0.585, Math.min(sw, w * 0.235)],
          [w * 0.745, h * 0.585, Math.min(sw, w * 0.235)],
          [w * 0.02, h * 0.6, Math.min(sw, w * 0.235)],
          [w * 0.02, h * 0.42, Math.min(sw, w * 0.215)],
        ]
      : Array.from({ length: 4 }, () => [w * 0.02, h * 0.79, w * 0.96] as [number, number, number]),
  }
}

/** a shore stone with a small stone lantern beside it (viewBox -60 -70 120 90, foot at y = 0); its window lights when heard */
function shoreStone(k: number): SVGElement {
  const r = rng(3500 + k)
  const gid = `t34r-halo-${k}`
  const top: Pt[] = []
  for (let i = 0; i <= 14; i++) {
    const a = Math.PI * (1 + i / 14)
    top.push([-10 + Math.cos(a) * 42 * (1 + (r() - 0.5) * 0.14), -3 + Math.sin(a) * 30 * (1 + (r() - 0.5) * 0.16)])
  }
  const P = (p: Pt) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`
  const rock = `M${top.map(P).join('L')}Q-10 6 ${P(top[0])}Z`
  // a small Kasuga lantern on the rock's lake side: base, shaft, firebox with its window, cap and finial
  const L = (x: number, y: number, w: number, hh: number) => `M${x} ${y}h${w}v${hh}h${-w}Z`
  const cap = 'M18 -52Q34 -60 50 -52L45 -57Q34 -63 23 -57Z'
  return s('g', { class: 't34r-stone', transform: k < 2 ? 'scale(-1 1)' : null },
    s('defs', null, s('radialGradient', { id: gid }, s('stop', { offset: 0, style: 'stop-color:var(--lantern);stop-opacity:.75' }), s('stop', { offset: 1, style: 'stop-color:var(--lantern);stop-opacity:0' }))),
    s('ellipse', { class: 't34r-sh', cx: 0, cy: 2, rx: 58, ry: 7 }),
    s('ellipse', { class: 't34r-halo', cx: 34, cy: -40, rx: 36, ry: 34, fill: `url(#${gid})` }),
    s('path', { class: 't34r-rock', d: rock }),
    s('path', { class: 't34r-shade', d: rock }),
    s('path', { class: 't34r-moss', d: blob(-18, -27, 17, 5.5, 3510 + k, 0.3, 12) }),
    s('path', { class: 't34r-rim', d: stroke(top.slice(1, 8).map(([x, y]) => [x + 1, y + 1.5] as Pt), 2.4, 0.3, 0.3, 0.1) }),
    s('path', { class: 't34r-toro-lo', d: L(24, -8, 20, 8) + L(30, -32, 8, 24) + L(25, -36, 18, 4) }),
    s('path', { class: 't34r-toro-hi', d: L(34, -8, 10, 8) + L(34, -32, 4, 24) + L(34, -36, 9, 4) }),
    s('path', { class: 't34r-toro-box', d: L(26, -50, 16, 14) }),
    s('path', { class: 't34r-fire', d: L(29.5, -47, 9, 8) }),
    s('path', { class: 't34r-toro-lo', d: cap }),
    s('path', { class: 't34r-toro-hi', d: 'M34 -60Q42 -58 50 -52L45 -57Q40 -60 34 -61Z' }),
    s('path', { class: 't34r-toro-lo', d: 'M32.5 -65h3v5h-3Z' }))
}

export function realScene(): SceneDef {
  const circle = perspectiveCircle(K.perspectives as Perspectives, {
    label: K.label,
    prompt: K.prompt,
    detail: K.detail,
    stage: (host, api) => stage?.(host, api),
    place: (k) => place?.(k) ?? { x: 0, y: 0 },
    stone: (k) => shoreStone(k),
    onHear: (k) => hear?.(k),
  })
  // the hooks need the scene's ctx; mount wires them per visit
  let stage: ((host: HTMLElement, api: CircleApi) => (() => void) | void) | null = null
  let hear: ((k: number) => void) | null = null
  let place: ((k: number) => Geo['stones'][number]) | null = null
  return {
    label: K.label,
    text: 'tr', // the sky over the far hills: the near lanterns cover the foot
    mount(ctx) {
      const still = ctx.reduced || ctx.quality === 'low'
      let T: Tok = watchTok(ctx, (t) => {
        T = t
        if (G) paint()
      })
      const back = layer('t34r-cv')
      const backWrap = h('div', { class: 't34r-back', 'aria-hidden': 'true' }, back.cv)
      const fx = layer('t34r-cv')
      const water = h('div', { class: 't34r-water', tabindex: '0', role: 'button', 'aria-label': K.waterAria })
      const seal = h('div', { class: 't34r-seal', 'aria-hidden': 'true' })
      const mirror = h('div', { class: 't34r-mirror' })
      const decode = h('p', { class: 't34r-decode' }, K.decode)
      let GD: ReturnType<typeof guide> | null = null
      const heard = new Set<number>()
      let all = false
      let G: Geo | null = null
      let stageEl: HTMLElement | null = null

      /** the art's size, read once per layout (the component has set the root's height just before) */
      const artSize = (): [number, number] => {
        const root = ctx.art.querySelector<HTMLElement>('.p2c')
        return [ctx.art.clientWidth, parseFloat(root?.style.height || '') || ctx.art.clientHeight]
      }
      place = (k) => {
        if (k === 0) G = compose(...artSize())
        return G!.stones[k]
      }
      stage = (host, api) => {
        stageEl = host.parentElement as HTMLElement
        host.append(fx.cv, water, seal)
        api.onLayout(() => {
          if (!G) return
          // the stage takes the whole art: the bridge, the ring and the stones are laid out over it, words on the water
          Object.assign(stageEl!.style, { left: '0px', top: '0px', width: `${G.w}px`, height: `${G.h}px` })
          placeCard(-1)
          // the line that decodes the reflection, written on the water just under it
          Object.assign(decode.style, { left: `${G.refl[0].toFixed(1)}px`, top: `${(G.refl[1] + G.figH * 1.02).toFixed(1)}px`, width: `${Math.min(G.w * 0.8, 360).toFixed(0)}px` })
          paint()
          GD?.refresh()
        })
        host.append(decode)
        return () => loop.dispose()
      }
      hear = (k) => {
        heard.add(k)
        if (heard.size < 4) ctx.prompt(fill(K.left, { n: 4 - heard.size }))
        else slip.hidden = false
        placeCard(k)
        const body = ctx.art.querySelector<HTMLElement>('.p2c-body-text')
        if (body) mirrorOf(body, mirror)
        if (heard.size === 4 && !all) {
          all = true
          seal.classList.add('on')
          if (!still) loop.start()
        }
        drawFx()
      }
      circle.mount(ctx)
      ctx.art.prepend(backWrap)
      // guide: the swipe is the gesture nobody guesses — a faint ink arrow over the reflection until the first ripple
      GD = guide(ctx)
      const swipe = GD.gesture('swipe', () => (G ? [G.refl[0], G.refl[1] + G.figH * 0.4] : [0, 0]), { r: 46 })
      let swiped = false
      const kit = findTakeaway(K.takeaway)
      const slip = h('div', { class: 't34r-slip', hidden: true }, kit ? foldedTakeaway([kit], ctx.onCleanup) : null)
      ctx.art.append(slip)
      const p2c = ctx.art.querySelector<HTMLElement>('.p2c')!
      p2c.classList.add('t34r')
      const card = p2c.querySelector<HTMLElement>('.p2c-card')!
      card.append(mirror)
      let sayK = -1
      /** the words go on the water beside the stone just heard (phone: the foot band) */
      function placeCard(k: number) {
        if (!G) return
        if (k >= 0) sayK = k
        const [x, y, w] = G.says[Math.max(0, sayK)]
        Object.assign(card.style, { left: `${x.toFixed(1)}px`, top: `${y.toFixed(1)}px`, width: `${w.toFixed(1)}px`, maxHeight: 'none', transform: 'none' })
        card.classList.toggle('t34r-right', G.wide && (sayK === 0 || sayK === 1))
      }

      // ── ripples and the reveal mask (low-res, accumulating; it heals slowly unless the seal has landed)
      const ripples: { x: number; y: number; t: number }[] = []
      const mask = document.createElement('canvas')
      const mg = mask.getContext('2d')!
      const comp = document.createElement('canvas')
      const cg = comp.getContext('2d')!
      const MS = 0.34
      let reveal = 0
      const loop = createLoop(water, (_t, dt) => {
        let more = false
        for (const r of ripples) r.t += dt
        while (ripples.length && ripples[0].t > 2.4) ripples.shift()
        if (ripples.length) more = true
        if (!all && reveal > 0) {
          mg.globalCompositeOperation = 'destination-out'
          mg.fillStyle = `rgba(0,0,0,${Math.min(1, dt * 0.45).toFixed(3)})`
          mg.fillRect(0, 0, mask.width, mask.height)
          mg.globalCompositeOperation = 'source-over'
          reveal = Math.max(0, reveal - dt * 0.45)
          more = true
        }
        for (const r of ripples) {
          if (r.t > 1.4) continue
          const rr = 20 + r.t * 140
          mg.fillStyle = 'rgba(255,255,255,0.25)'
          mg.beginPath()
          mg.ellipse(r.x * MS, r.y * MS, rr * MS, rr * 0.4 * MS, 0, 0, Math.PI * 2)
          mg.fill()
          reveal = 1
        }
        drawFx()
        return more
      })
      ctx.onCleanup(() => loop.dispose())
      const ripple = (x: number, y: number) => {
        if (!G) return
        if (!swiped) {
          // the first ripple: say what the reflection is, then on to the stones
          swiped = true
          swipe.done()
          decode.classList.add('on')
          if (heard.size < 4) ctx.prompt(heard.size ? fill(K.left, { n: 4 - heard.size }) : K.listen)
        }
        if (still) {
          ripples.length = 0
          ripples.push({ x, y, t: 0.5 })
          mg.fillStyle = '#fff'
          mg.beginPath()
          mg.ellipse(x * MS, y * MS, 90 * MS, 36 * MS, 0, 0, Math.PI * 2)
          mg.fill()
          drawFx()
          return
        }
        if (ripples.length > 10) ripples.shift()
        ripples.push({ x, y, t: 0 })
        loop.start()
      }
      let lastP = 0
      water.addEventListener('pointerdown', (e) => {
        const r = water.getBoundingClientRect()
        ripple(e.clientX - r.left + water.offsetLeft, e.clientY - r.top + water.offsetTop)
      })
      water.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'mouse' ? !e.buttons && performance.now() - lastP < 140 : !e.buttons) return
        lastP = performance.now()
        const r = water.getBoundingClientRect()
        ripple(e.clientX - r.left + water.offsetLeft, e.clientY - r.top + water.offsetTop)
      })
      water.addEventListener('keydown', (e) => {
        if (e.key !== ' ' && e.key !== 'Enter') return
        e.preventDefault()
        if (G) ripple(G.refl[0], G.refl[1] + G.figH * 0.4)
      })

      // ── the painting
      let first = true
      let job: { cancel(): void } | null = null
      ctx.onCleanup(() => job?.cancel())
      let HB = 0, gut = 0
      function paint() {
        const Q = G!
        const W = backWrap.clientWidth
        gut = Math.max(0, (W - Q.w) / 2)
        HB = Q.h + bleedBelow(ctx, Q.h)
        backWrap.style.height = `${HB}px`
        const d = dprFor(ctx, 1.75)
        back.size(W, HB, d)
        fx.size(Q.w, Q.h, Math.min(d, 1.5))
        mask.width = Math.ceil(Q.w * MS)
        mask.height = Math.ceil(Q.h * MS)
        comp.width = fx.cv.width
        comp.height = fx.cv.height
        if (still && !all) {
          // a still reflection: the avatar half shown
          mg.fillStyle = '#fff'
          mg.fillRect(Q.refl[0] * MS, 0, mask.width, mask.height)
        }
        Object.assign(water.style, { left: '0px', top: `${(Q.water + 4).toFixed(1)}px`, width: `${Q.w.toFixed(1)}px`, height: `${((Q.wide ? Q.h : Q.h * 0.75) - Q.water - 4).toFixed(1)}px` })
        seal.style.transform = `translate3d(${(Q.refl[0] + Q.figH * 0.02).toFixed(1)}px,${(Q.refl[1] + Q.figH * 0.42).toFixed(1)}px,0)`
        job?.cancel()
        job = sliced((function* () {
          yield* paintBack(W, HB, gut)
          yield
          drawFx()
        })(), { sync: ctx.reduced || !first })
        first = false
      }

      function* paintBack(W: number, H: number, ox: number) {
        const g = back.g, Q = G!
        back.clear()
        // sky melting into the paper at the top; the moon behind the model, with a soft band of mist behind her
        g.fillStyle = vgrad(g, 0, Q.water, T.dark ? [[0, T.wash, 0], [0.5, T.wash, 0.35], [1, mix(T.paper, T.mist, 0.25), 0.85]] : [[0, T.paper2, 0], [0.5, mix(T.paper2, T.water, 0.18), 0.5], [1, mix(T.paper, T.water, 0.3), 0.85]])
        g.fillRect(0, 0, W, Q.water)
        g.save()
        g.translate(ox, 0)
        moonDisc(g, T, Q.moon[0], Q.moon[1], Q.moonR, 3490, 1.3, false)
        mist(g, T, Q.apex[0], Q.apex[1] - Q.figH * 0.35, Q.figH * 1.6, Q.figH * 0.22, T.dark ? 1.4 : 0.9)
        g.restore()
        mountains(g, T, -W * 0.05, W * 1.05, Q.water + 1, Q.water * 0.42, 3491, 6, 0.88)
        mountains(g, T, ox + Q.w * 0.5, W * 1.05, Q.water + 1, Q.water * 0.22, 3492, 3, 0.55)
        mist(g, T, W * 0.5, Q.water - 4, W * 0.75, Q.h * 0.04, T.dark ? 1.3 : 0.7)
        yield
        // the lake: pale toward the far bank, deep toward us, running on under the foot
        g.fillStyle = vgrad(g, Q.water, H, T.dark ? [[0, mix(T.water, T.mist, 0.2), 1], [0.3, mix(T.water, T.mist, 0.06), 1], [1, T.water, 1]] : [[0, mix(T.water, T.paper, 0.5), 1], [0.3, mix(T.water, T.paper, 0.2), 1], [1, T.water, 1]])
        g.fillRect(0, Q.water, W, H - Q.water)
        const r = rng(3493)
        const mx = ox + Q.moon[0]
        for (let y = Q.water + 3, i = 0; y < H; y += 2.4 + (y - Q.water) * 0.03, i++) {
          const t = (y - Q.water) / (H - Q.water)
          if (noise(i * 0.23, 3.3) < 0.32) continue
          const ww = (8 + t * 80) * (0.4 + noise(i * 0.17, 8))
          inkLine(g, [[mx - ww / 2 + (noise(i * 0.1, 5) - 0.5) * 24, y], [mx + ww / 2 + (noise(i * 0.1, 5) - 0.5) * 24, y]], 1 + t * 2, T.moon, (T.dark ? 0.55 : 0.55) * (1 - t * 0.6), 0.3, 0.3, 0.1)
        }
        for (let i = 0; i < 90; i++) {
          const t = Math.pow(r(), 0.8), y = Q.water + 6 + (H - Q.water) * t, x = r() * W, l = 10 + t * 120
          inkLine(g, [[x, y], [x + l, y]], 0.7 + t * 1.2, r() < 0.5 ? T.wash : T.moon, T.dark ? 0.12 + t * 0.1 : 0.1 + t * 0.08, 0.3, 0.3, 0.1)
        }
        yield
        g.save()
        g.translate(ox, 0)
        bank(g, Q)
        yield* bridge(g, Q)
        yield
        near(g, Q, ox, H)
        g.restore()
        grain(g, 0, 0, W, H, T.dark ? 0.06 : 0.08)
      }

      function bank(g: CanvasRenderingContext2D, Q: Geo) {
        // the bank under each foot of the bridge, wet at the water's edge, reeds
        for (const [p, k] of [[Q.A, 1], [Q.B, 0.6]] as [Pt, number][]) {
          const d = blob(p[0], p[1] + 4 * k, Q.w * (Q.wide ? 0.13 : 0.09) * k, (Q.wide ? 14 : 9) * k, Math.round(p[0]), 0.2, 16)
          brush(g, d, T.dark ? mix(T.rockLo, T.umbra, 0.5) : mix(T.rockLo, T.water, 0.4), 0.9)
          inkLine(g, [[p[0] - Q.w * 0.11 * k, p[1] + 2], [p[0] + Q.w * 0.11 * k, p[1] + 1]], 1.6 * k + 0.6, T.dark ? T.moon : T.card, T.dark ? 0.25 : 0.6, 0.2, 0.2, 0.3)
          for (let i = 0; i < 9; i++) {
            const x = p[0] - Q.w * 0.1 * k + i * Q.w * 0.025 * k, hh = (16 + (i % 3) * 9) * k
            inkLine(g, [[x, p[1] + 2], [x + (i % 2 ? 3 : -2), p[1] - hh]], 1.3 * k, T.wash, 0.75, 0.05, 0.6, 0.2)
          }
        }
      }

      /** the drum bridge and, under it, its reflection broken by the ripples — together one ring */
      function* bridge(g: CanvasRenderingContext2D, Q: Geo) {
        const { A, B, rise } = Q
        const N = 40
        const nearK = (u: number) => 1.18 - 0.36 * u // the near end is bigger
        const at = (u: number, up: number, side = 0): Pt => [A[0] + (B[0] - A[0]) * u + side * nearK(u), A[1] + (B[1] - A[1]) * u - up * nearK(u)]
        const deck = (u: number) => rise * Math.sin(Math.PI * u)
        const wood = T.dark ? mix(T.stepLo, T.umbra, 0.3) : mix(T.stepLo, T.wash, 0.42)
        const woodLit = mix(wood, T.lantern, T.dark ? 0.3 : 0.25)
        const girder = Math.max(7, Q.w * 0.016) // the thickness of the arch's side
        const railH = rise * 0.2
        // draw the bridge into a sprite, then lay it twice: upright, and mirrored about the water line as broken rows
        const W = Q.w
        const sc = document.createElement('canvas')
        const dpr = Math.min(1.5, devicePixelRatio || 1)
        sc.width = Math.ceil(W * dpr)
        sc.height = Math.ceil((Math.max(A[1], B[1]) + 4) * dpr)
        const sg = sc.getContext('2d')!
        sg.setTransform(dpr, 0, 0, dpr, 0, 0)
        const top: Pt[] = [], bot: Pt[] = []
        for (let i = 0; i <= N; i++) {
          const u = i / N
          top.push(at(u, deck(u)))
          bot.push(at(u, deck(u) - girder))
        }
        // piers: posts down to the water, the far ones thinner
        for (const u of [0.16, 0.32, 0.5, 0.68, 0.84]) {
          const a = at(u, deck(u) - girder), b = at(u, 0)
          inkLine(sg, [a, [b[0], b[1] + 2]], Math.max(3, Q.w * 0.008) * nearK(u), mix(wood, T.umbra, 0.35), 1, 0.02, 0.02, 0.8)
          inkLine(sg, [[a[0] + 2, a[1]], [b[0] + 2, b[1]]], 1, T.dark ? T.moon : T.card, T.dark ? 0.2 : 0.4, 0.1, 0.1, 0.4)
        }
        // the railing: posts with giboshi knobs, a top rail and a mid rail
        const railTop: Pt[] = [], railMid: Pt[] = []
        for (let i = 0; i <= N; i++) {
          const u = i / N
          railTop.push(at(u, deck(u) + railH))
          railMid.push(at(u, deck(u) + railH * 0.5))
        }
        for (let i = 0; i <= 8; i++) {
          const u = i / 8, a = at(u, deck(u)), b = at(u, deck(u) + railH * 1.12)
          const k = nearK(u)
          inkLine(sg, [a, b], Math.max(2.4, Q.w * 0.005) * k, wood, 1, 0.02, 0.02, 0.8)
          // the onion knob: a bulb, a little neck, a point
          const r0 = Math.max(2.4, Q.w * 0.0045) * k
          sg.fillStyle = rgba(T.dark ? mix(T.rockHi, T.moon, 0.2) : mix(T.rockMid, T.wash, 0.3))
          sg.beginPath()
          sg.ellipse(b[0], b[1] - r0, r0 * 1.15, r0, 0, 0, Math.PI * 2)
          sg.fill()
          sg.beginPath()
          sg.moveTo(b[0] - r0 * 0.5, b[1] - r0 * 1.7)
          sg.quadraticCurveTo(b[0], b[1] - r0 * 2.6, b[0] + r0 * 0.5, b[1] - r0 * 1.7)
          sg.fill()
          inkLine(sg, [[b[0] - r0 * 0.7, b[1] - r0 * 1.6], [b[0] + r0 * 0.5, b[1] - r0 * 1.9]], 1, T.dark ? T.moon : T.card, T.dark ? 0.5 : 0.7, 0.2, 0.2, 0.3)
        }
        inkLine(sg, railTop, Math.max(2, Q.w * 0.0042), wood, 1, 0.03, 0.03, 0.7)
        inkLine(sg, railTop.map(([x, y]) => [x, y - 1.2] as Pt), 1, T.dark ? T.moon : T.card, T.dark ? 0.35 : 0.6, 0.1, 0.1, 0.4)
        inkLine(sg, railMid, Math.max(1.4, Q.w * 0.0028), mix(wood, T.umbra, 0.2), 0.95, 0.03, 0.03, 0.7)
        // the girder: the arch's thick side, lit on top by the moon, warmer below, deck planks' ends along its top
        poly(sg, [...top, ...bot.slice().reverse()])
        sg.fillStyle = vgrad(sg, Q.apex[1], A[1], [[0, woodLit, 1], [0.5, wood, 1], [1, mix(wood, T.umbra, 0.25), 1]])
        sg.fill()
        for (let i = 1; i < N; i += 1) {
          const u = i / N, a = at(u, deck(u)), b = at(u, deck(u) - girder * 0.32)
          inkLine(sg, [a, b], 0.8, T.umbra, 0.35, 0.1, 0.1, 0.3)
        }
        inkLine(sg, top.map(([x, y]) => [x, y - 0.6] as Pt), 1.8, T.dark ? T.moon : T.card, T.dark ? 0.6 : 0.95, 0.04, 0.04, 0.4)
        inkLine(sg, bot, 1.6, T.dark ? T.wash : T.ink, T.dark ? 0.85 : 0.75, 0.04, 0.04, 0.5)
        // the reflection: the sprite flipped about the water line, row by row, nudged and broken by the ripples;
        // by night the brightest thing on the water (a moonlit ghost), by day darker than the sky it lies in
        yield
        // the flip: every point mirrored straight down about the water line under it (the line slants into depth)
        const m = (B[1] - A[1]) / (B[0] - A[0])
        const rc = document.createElement('canvas')
        const top0 = Math.min(A[1], B[1]) - 2, bot0 = Math.max(A[1], B[1]) + rise * 1.25 + railH * 1.6
        rc.width = sc.width
        rc.height = Math.ceil((bot0 - top0) * dpr)
        const rg = rc.getContext('2d')!
        rg.setTransform(dpr, 2 * m * dpr, 0, -dpr, 0, (2 * (A[1] - m * A[0]) - top0) * dpr)
        rg.drawImage(sc, 0, 0, sc.width, sc.height, 0, 0, W, sc.height / dpr)
        // laid down row by row, nudged and broken by the ripples, fading with distance from the water line
        g.save()
        g.globalCompositeOperation = T.dark ? 'screen' : 'multiply'
        for (let y = 0, i = 0; y < bot0 - top0; y += 2, i++) {
          if (i % 90 === 89) yield
          const n = noise(i * 0.09, 4.4)
          if (n < 0.26) continue
          const off = (noise(i * 0.17, 9.1) - 0.5) * (2 + y * 0.04)
          g.globalAlpha = (T.dark ? 0.8 : 0.7) * (1 - (y / (bot0 - top0)) * 0.5) * (0.55 + 0.45 * n)
          g.drawImage(rc, 0, y * dpr, rc.width, 2 * dpr, off, top0 + y, W, 2.2)
        }
        g.restore()
        // the ensō's gap at the far foot, closed in a dry brush stroke so the ring reads at once
        const ring: Pt[] = []
        for (let i = 0; i <= 30; i++) {
          const t = i / 30
          const u = t < 0.5 ? 0.72 + 0.56 * t : 1 - 0.56 * (t - 0.5)
          ring.push(t < 0.5 ? at(u, deck(u) + 1) : at(u, -deck(u)))
        }
        for (let j = 0; j < 3; j++) inkLine(g, ring.map(([x, y]) => [x, y + (j - 1) * 2.2] as Pt), 1.6, T.dark ? T.moon : T.wash, (T.dark ? 0.22 : 0.3) * (1 - j * 0.25), 0.4, 0.5, 0.05)
        g.drawImage(sc, 0, 0, sc.width, sc.height, 0, 0, W, sc.height / dpr)
        // the model on the crown, the moon behind her
        const [coat, body, scarf] = model(Q.apex[0], Q.apex[1] - railH * 0.05, Q.figH)
        brush(g, coat, T.dark ? mix(T.rockMid, T.umbra, 0.3) : mix(T.rockLo, T.wash, 0.25), 0.9)
        brush(g, body, T.dark ? T.wash : T.ink, 0.95)
        brush(g, scarf, T.vermilion, 1)
        // her reflection, painted like her (the "skin") under her inside the ring — the avatar is the fx layer's business
        g.save()
        g.translate(0, Q.refl[1] + Q.apex[1] - railH * 0.05)
        g.scale(1, -1)
        g.globalAlpha = T.dark ? 0.55 : 0.42
        g.globalCompositeOperation = T.dark ? 'screen' : 'multiply'
        brush(g, coat, T.dark ? mix(T.rockMid, T.moon, 0.2) : mix(T.rockLo, T.wash, 0.35), 0.9)
        brush(g, body, T.dark ? T.moon : T.wash, 0.7)
        brush(g, scarf, T.vermilion, 0.7)
        g.restore()
        for (let i = 0; i < 8; i++) {
          const y = Q.refl[1] + (Q.figH * (i + 0.6)) / 8
          inkLine(g, [[Q.refl[0] - Q.figH * 0.22, y], [Q.refl[0] + Q.figH * 0.24, y + 0.6]], 1 + (i % 3) * 0.5, T.dark ? T.water : mix(T.water, T.paper, 0.4), T.dark ? 0.55 : 0.45, 0.2, 0.2, 0.2)
        }
      }

      /** the near layer: reeds and lotus leaves, dark and sharp, cut by the frame's lower corners */
      function near(g: CanvasRenderingContext2D, Q: Geo, ox: number, H: number) {
        const ink: C4 = T.dark ? mix(T.umbra, T.wash, 0.4) : mix(T.wash, T.umbra, 0.3)
        const r = rng(3496)
        // (on a phone the words sit in the foot band: the reeds keep to the very bottom corners, under them)
        const base = Q.wide ? Math.min(H, Q.h + 50) : H
        for (const [x0, sd] of [[-ox - 6, 1], [Q.w + ox + 6, -1]] as [number, number][]) {
          for (let i = 0; i < 9; i++) {
            const x = x0 + sd * (8 + r() * Q.w * 0.07), hh = Q.h * (Q.wide ? 0.22 + r() * 0.2 : 0.1 + r() * 0.1), lean = sd * (10 + r() * 30)
            inkLine(g, [[x, base + 4], [x + lean * 0.4, base - hh * 0.55], [x + lean, base - hh]], 2.4 + r() * 2.4, ink, 0.95, 0.02, 0.6, 0.2)
          }
          // lotus leaves lying on the water, seen low: dark ellipses with a notch, a moonlit edge
          for (let i = 0; i < 2; i++) {
            const lx = x0 + sd * (Q.w * (0.07 + i * 0.08) + r() * 20), ly = Q.wide ? Q.h * (1.0 - i * 0.04) : H - 30 - i * 16, lr = Q.w * (0.045 - i * 0.012) + 14
            g.fillStyle = rgba(ink, 0.95)
            g.beginPath()
            g.ellipse(lx, ly, lr, lr * 0.26, 0, 0.12, Math.PI * 2 - 0.12)
            g.lineTo(lx, ly)
            g.fill()
            inkLine(g, [[lx - lr * 0.9, ly - lr * 0.1], [lx, ly - lr * 0.27], [lx + lr * 0.85, ly - lr * 0.12]], 1.2, T.dark ? T.moon : T.card, T.dark ? 0.35 : 0.6, 0.2, 0.2, 0.2)
          }
        }
      }

      // ── the moving layer: lamp pools, the avatar wherever the water has stirred, the ripples
      function drawFx() {
        if (!G) return
        const g = fx.g, Q = G
        fx.clear()
        // warm pools and a long streak under each lit lamp (the lamp stands on the lake side of its rock)
        for (const k of heard) {
          const p = Q.stones[k]
          const side = k < 2 ? -1 : 1
          const lx = p.x + side * 34 * p.s * (Q.wide ? 0.62 : 0.5)
          soft(g, lx, p.y + 8 * p.s, 80 * p.s, 20 * p.s, T.lantern, T.dark ? 0.5 : 0.35)
          for (let y = p.y + 4, i = 0; y < Math.min(Q.h - 2, p.y + 110 * p.s); y += 3, i++) {
            if (noise(i * 0.3, k * 2) < 0.3) continue
            const t = (y - p.y) / (110 * p.s)
            g.fillStyle = rgba(T.lantern, (T.dark ? 0.7 : 0.5) * (1 - t))
            g.fillRect(lx - 2.5 * p.s * (1 + t) + (noise(i * 0.2, k) - 0.5) * 4, y, 5 * p.s * (1 + t), 1.6)
          }
        }
        const av = avatar(Q.refl[0], Q.refl[1], Q.figH)
        const dpr = fx.cv.width / Q.w
        cg.setTransform(1, 0, 0, 1, 0, 0)
        cg.clearRect(0, 0, comp.width, comp.height)
        cg.setTransform(dpr, 0, 0, dpr, 0, 0)
        // the water closes over the painted reflection (a feathered patch), then the avatar is drawn on it
        soft(cg, Q.refl[0], Q.refl[1] + Q.figH * 0.5, Q.figH * 0.32, Q.figH * 0.62, T.dark ? mix(T.water, T.mist, 0.1) : mix(T.water, T.paper, 0.3), 1, 0, 0.62)
        cg.fillStyle = rgba(T.dark ? T.moon : T.wash, T.dark ? 0.14 : 0.12)
        cg.fill(new Path2D(av.facets))
        cg.strokeStyle = rgba(T.dark ? mix(T.moon, T.mossC, 0.4) : T.wash, T.dark ? 0.95 : 0.8)
        cg.lineWidth = 1.2
        cg.lineJoin = 'miter'
        cg.stroke(new Path2D(av.lines))
        if (!all) {
          cg.setTransform(1, 0, 0, 1, 0, 0)
          cg.globalCompositeOperation = 'destination-in'
          cg.drawImage(mask, 0, 0, comp.width, comp.height)
          cg.globalCompositeOperation = 'source-over'
        }
        g.drawImage(comp, 0, 0, Q.w, Q.h)
        for (const r of ripples) {
          const t = r.t, rr = 20 + t * 140
          const a = Math.max(0, 1 - t / 2.4)
          for (let k = 0; k < 3; k++) {
            const R = rr - k * 16
            if (R < 4) continue
            g.beginPath()
            g.ellipse(r.x, r.y, R, R * 0.36, 0, 0, Math.PI * 2)
            g.strokeStyle = rgba(T.dark ? T.moon : T.card, a * (T.dark ? 0.45 : 0.8) * (1 - k * 0.3))
            g.lineWidth = 1.3
            g.stroke()
          }
        }
      }
    },
  }
}
