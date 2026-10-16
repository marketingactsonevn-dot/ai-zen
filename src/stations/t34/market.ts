import './market.css'
import { fill, h } from '../../core/dom'
import { sliced } from '../../core/chunk'
import { clamp, onSize, rng, stableHeight, type Pt } from '../../ui/part2/ink'
import type { SceneCtx } from '../types'
import { C } from './content'
import { F } from './night'
import { bleedBelow, dprFor, grain, inkLine, layer, mirrorOf, mist, mix, moonDisc, mountains, noise, poly, rgba, soft, vgrad, watchTok, type C4, type Layer, type Tok } from './cv'

const K = C.scenes.market

/*
 * Scene 1 — the night market seen from a small boat in the middle of a black lake (GRAZE, 2.5D). Three stalls on stilts
 * stand on the water at three depths, near-left to far-right: the all-in-one stall under seven paper lanterns in many ink
 * tones, the video stall at mid distance, the image stall small and half lost in the mist. Every lantern throws a long
 * broken reflection down the water: the hub's is a band of seven colours, a specialist's one amber streak. Names and
 * trades are dyed on cloth noren hanging from a rod under each eave; opening a stall unrolls a long band of cloth down to
 * the water. The boat's dark bow is the nearest layer, cut by the bottom edge, with its lamp post and a wooden board.
 * Four tōrō nagashi float in an arc round the bow, each carrying a task: drag one to a stall (or pick it, then a stall).
 * Canvas painting in four layers (far · mid stalls · near stall · the bow) that drift apart with the pointer; cloth,
 * lanterns, words and the streaks are DOM over the painting. The water runs on under the scene foot into the paper.
 */

const TONES = (T: Tok): C4[] => [T.lantern, mix(T.lantern, T.vermilion, 0.45), T.mossC, mix(T.firefly, T.lantern, 0.3), T.rockHi, mix(T.lantern, T.moon, 0.6), mix(T.mossA, T.firefly, 0.4)]

interface Geo {
  k: number
  cx: number; yw: number; s: number; w: number; nw: number; nh: number
  tier: boolean; side: number; far: boolean
  deck: number; nTop: number; eave: number; roofTop: number
  lamps: [number, number, number, number][] // x, y, r, tone
}

export function marketScene(ctx: SceneCtx) {
  const still = ctx.reduced || ctx.quality === 'low'
  let T: Tok = watchTok(ctx, (t) => {
    T = t
    paint()
  })

  // ── state
  let picked = -1
  let aim = 0
  const placed = new Map<number, number>() // task → stall
  const factShown = new Set<number>()
  let busy = false
  let sayAt = -1
  let sayBelow = 0 // the bottom of the band of cloth the words must clear (view px)

  // ── DOM: four painted layers, far to near
  const L = [layer('t34m-cv t34m-cv-far'), layer('t34m-cv'), layer('t34m-cv'), layer('t34m-cv t34m-cv-bow')]
  const wraps = L.map((l, i) => h('div', { class: `t34m-layer t34m-l${i}` }, l.cv))
  const srcOf = (id: string) => (C.sources as Record<string, { url?: string }>)[id]?.url
  const uid = Math.round(performance.now())
  const stalls = K.stalls.map((st, i) => {
    const url = srcOf(st.source)
    const link = (cls: string) => (url ? h('a', { class: `t34m-link ${cls}`, href: url, target: '_blank', rel: 'noopener' }, K.officialLabel) : null)
    // the long band of cloth that unrolls to the water: the trade (and later the stall's own claim)
    const what = h('span', { class: 't34m-what', id: `t34m-what-${i}-${uid}` },
      h('span', { class: 't34m-band-name', 'aria-hidden': 'true' }, st.name),
      h('span', { class: 't34m-band-what' }, st.what),
      h('span', { class: 't34m-ex t34m-narrow' }, st.example), link('t34m-narrow'))
    const pans = h('span', { class: 't34m-pans', 'aria-hidden': 'true' }, ...Array.from({ length: i ? 3 : 4 }, (_, j) => h('i', { style: `--j:${j}` })))
    const noren = h('div', { class: `t34m-noren t34m-noren-${st.id}` }, h('i', { class: 't34m-rod', 'aria-hidden': 'true' }), pans,
      h('span', { class: 't34m-name' }, st.name), h('span', { class: 't34m-ex t34m-wide' }, st.example), link('t34m-wide'), what)
    const btn = h('button', { class: 't34m-target', type: 'button', 'aria-label': st.name, 'aria-describedby': what.id, onClick: () => (picked >= 0 ? drop(picked, i) : openStall(i)), onKeydown: (e: KeyboardEvent) => keyStall(e, i) })
    const streaks = h('canvas', { class: 't34m-streaks', 'aria-hidden': 'true' }) as HTMLCanvasElement
    const glow = h('div', { class: 't34m-glow', 'aria-hidden': 'true' })
    const el = h('div', { class: `t34m-stall t34m-${st.id}` }, glow, streaks, btn, noren)
    return { el, btn, noren, streaks, glow, what }
  })
  const group = h('div', { class: 't34m-stalls', role: 'group', 'aria-label': K.group })
  // what the water says after each lantern: on the water under the stall it went to, with its reflection
  const sayEl = h('div', { class: 't34m-say-text' })
  const sayMir = h('div', { class: 't34m-say-mirror' })
  const say = h('div', { class: 't34m-say' }, sayEl, sayMir)
  const keysId = `t34m-keys-${uid}`
  const lans = K.tasks.map((t, i) => {
    const b = h('button', { class: 't34m-lan', type: 'button', 'aria-pressed': 'false', 'aria-label': fill(K.lanternAria, { task: t.text }), 'aria-describedby': keysId, style: `--bob:${(i * 1.7).toFixed(1)}s` },
      h('span', { class: 't34m-lan-refl', 'aria-hidden': 'true' }),
      h('span', { class: 't34m-wake', 'aria-hidden': 'true' }),
      h('span', { class: 't34m-lan-base', 'aria-hidden': 'true' }),
      h('span', { class: 't34m-lan-box', 'aria-hidden': 'true' }, h('span', { class: 't34m-paper' }, h('span', { class: 't34m-wide' }, t.text), h('span', { class: 't34m-narrow' }, t.short))))
    b.addEventListener('pointerdown', (e) => grab(i, e))
    b.addEventListener('click', () => {
      if (b.dataset.dragged) return
      pick(picked === i ? -1 : i)
    })
    b.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') pick(-1)
    })
    return b
  })
  const lanGroup = h('div', { class: 't34m-lans', role: 'group', 'aria-label': K.taskGroup }, ...lans)
  // the warning on a board nailed to the bow's lamp post
  const vol = h('div', { class: 't34m-vol' }, h('p', null, K.volatile))
  group.append(...stalls.map((s) => s.el), say)
  wraps[3].append(vol, lanGroup)
  const veil = h('div', { class: 't34m-veil', 'aria-hidden': 'true' })
  const view = h('div', { class: 't34m-view' }, wraps[0], wraps[1], wraps[2], group, wraps[3], veil)
  const root = h('div', { class: 't34 t34m' }, h('p', { class: 'visually-hidden' }, K.art), h('p', { class: 'visually-hidden', id: keysId }, K.keys), view)
  ctx.art.append(root)
  ctx.prompt(K.prompt)

  // ── layout: noren widths first, then one read of their heights, then the painting
  let W = 0, H = 0, HB = 0, hz = 0, wide = true
  let geo: Geo[] = []
  let home: Pt[] = []
  let bow: Pt = [0, 0]
  let post = 0
  const stableH = stableHeight(ctx, [F(K.insight)])
  let first = true
  let job: { cancel(): void } | null = null
  ctx.onCleanup(() => job?.cancel())
  ctx.onCleanup(onSize(ctx.art, () => {
    const w = view.clientWidth, hh = stableH(ctx.art.clientHeight)
    if (w < 60 || hh < 60) return
    const bl = bleedBelow(ctx, hh)
    W = w
    H = hh
    HB = hh + bl
    root.style.height = `${hh}px`
    view.style.bottom = `${-bl}px`
    wide = W / H > 1.05
    root.classList.toggle('wide', wide)
    // per stall: centre, scale (px per metre), noren width; near-left to far-right, the far one small and misty
    const P = wide
      ? (() => {
          const s = clamp(H * 0.165, 66, 108)
          return [
            { cx: W * 0.2, s, nw: Math.min(s * 2.5, W * 0.2), tier: true, side: 1, far: false },
            { cx: W * 0.56, s: s * 0.6, nw: Math.max(s * 0.6 * 2.9, 178), tier: false, side: -1, far: false },
            { cx: W * 0.81, s: s * 0.36, nw: Math.max(s * 0.36 * 3.4, 128), tier: false, side: -1, far: true },
          ]
        })()
      : [
          { cx: W * 0.3, s: clamp(W * 0.13, 40, 54), nw: Math.min(W * 0.44, 165), tier: false, side: 1, far: false },
          { cx: W * 0.57, s: clamp(W * 0.095, 30, 40), nw: Math.min(W * 0.36, 136), tier: false, side: -1, far: false },
          { cx: W * 0.78, s: clamp(W * 0.065, 20, 28), nw: Math.min(W * 0.29, 108), tier: false, side: -1, far: true },
        ]
    stalls.forEach((st, i) => {
      st.noren.style.width = `${P[i].nw.toFixed(1)}px`
      st.el.classList.toggle('compact', P[i].far || !wide)
      st.el.classList.toggle('far', P[i].far)
    })
    const nh = stalls.map((st) => st.noren.offsetHeight) // one layout read for all three
    hz = H * (wide ? 0.35 : 0.15)
    // phone: a clear gap between each stall's roof and the waterline of the one behind it
    const yws = wide ? P.map((p) => hz + 1.6 * p.s) : [H * 0.68, H * 0.425, H * 0.235]
    geo = P.map((p, k) => {
      const s = p.s
      const w = p.nw + 0.42 * s
      const deck = yws[k] - 0.5 * s
      const nTop = deck - 0.36 * s - nh[k]
      // the hub without an upper storey hangs its seven lanterns in a row under the eave, over the cloth
      const row = k === 0 && !p.tier
      const r = s * (row ? 0.12 : 0.13)
      const eave = nTop - 0.06 * s - (row ? r * 2.9 : 0)
      const roofTop = eave - 0.62 * s
      const g: Geo = { k, cx: p.cx, yw: yws[k], s, w, nw: p.nw, nh: nh[k], tier: p.tier, side: p.side, far: p.far, deck, nTop, eave, roofTop, lamps: [] }
      if (k === 0) {
        for (let i = 0; i < 7; i++) {
          if (row) g.lamps.push([p.cx + (i - 3) * r * 2.3, eave + r * 1.45 + ((i * 5) % 3) * r * 0.12, r * (1 + ((i * 5) % 3) * 0.06), i])
          else {
            // a cluster in front of the upper storey's lit window, hung close so their reflections make one band
            const y0 = roofTop - 0.34 * s
            const rw = i < 4 ? 0 : 1, j = rw ? i - 4 : i
            g.lamps.push([p.cx + (rw ? (j - 1) * r * 2.25 : (j - 1.5) * r * 2.25), y0 + rw * r * 1.5 + ((i * 7) % 3) * r * 0.2, r * (1 + ((i * 5) % 3) * 0.08), i])
          }
        }
      } else g.lamps.push([p.cx + p.side * (w / 2 + 0.05 * s), eave + 0.55 * s, s * 0.3, 0])
      return g
    })
    // the boat: bow tip low in the middle, its lamp post; the floating lanterns in an arc round it, smaller as they go out
    bow = [W * 0.5, H * (wide ? 0.93 : 0.985)]
    post = H * (wide ? 0.2 : 0.14)
    if (wide) {
      const R = W * 0.19
      home = [182, 236, 304, 358].map((a) => [bow[0] + R * Math.cos((a * Math.PI) / 180), bow[1] + 4 + R * 0.24 * Math.sin((a * Math.PI) / 180)] as Pt)
    } else home = [[W * 0.1, H * 1.035], [W * 0.27, H * 0.965], [W * 0.73, H * 0.965], [W * 0.9, H * 1.035]]
    placeDom()
    const d = dprFor(ctx, 1.75)
    L.forEach((l) => l.size(W, HB, d))
    job?.cancel()
    job = sliced(paintSteps(), { sync: ctx.reduced || !first })
    first = false
  }))

  function* paintSteps() {
    yield* paintFar()
    yield
    yield* paintStalls(L[1], [2, 1])
    yield
    yield* paintStalls(L[2], [0])
    yield
    paintBow()
  }
  function paint() {
    if (!W) return
    const it = paintSteps()
    while (!it.next().done);
  }

  /** a dry-brush dab: a few thin strokes side by side with gaps, like a half-dry brush dragged once */
  function dab(g: CanvasRenderingContext2D, x: number, y: number, w: number, th: number, c: C4, a: number, seed: number) {
    const n = th > 2.2 ? 3 : 2
    for (let i = 0; i < n; i++) {
      const u = noise(seed * 0.37 + i * 1.7, y * 0.05)
      if (u < 0.22) continue
      const x0 = x - w / 2 + w * 0.18 * noise(seed + i, 3.1), x1 = x + w / 2 - w * 0.2 * noise(seed + i * 2, 7.3)
      inkLine(g, [[x0, y + (i - (n - 1) / 2) * th * 0.42], [x1, y + (i - (n - 1) / 2) * th * 0.42 + 0.3]], th / n + 0.4, c, a * (0.55 + 0.45 * u), 0.25, 0.35, 0.1)
    }
  }

  // ── far layer: sky (melting into the paper at the top), moon, mountains, the far shore's market lights, the lake
  function* paintFar() {
    const l = L[0], g = l.g
    l.clear()
    g.fillStyle = vgrad(g, 0, hz, T.dark
      ? [[0, T.wash, 0], [0.5, T.wash, 0.32], [1, mix(T.paper, T.mist, 0.22), 0.85]]
      : [[0, T.paper2, 0], [0.55, mix(T.paper2, T.water, 0.18), 0.5], [1, mix(T.paper, T.water, 0.32), 0.85]])
    g.fillRect(0, 0, W, hz)
    const mx = W * (wide ? 0.69 : 0.2), my = H * (wide ? 0.1 : 0.065), mr = clamp(Math.min(W, H) * 0.034, 9, 23)
    moonDisc(g, T, mx, my, mr, 341, 1.1, false)
    mountains(g, T, -W * 0.05, W * 1.05, hz + 2, H * (wide ? 0.22 : 0.1), 342, 6, 0.9)
    mist(g, T, W * 0.5, hz - H * 0.04, W * 0.7, H * 0.06, T.dark ? 1.1 : 0.55)
    mountains(g, T, W * 0.3, W * 1.08, hz + 2, H * (wide ? 0.12 : 0.06), 343, 3, 0.62)
    yield
    // the rest of the market along the far shore: a line of small warm lights in the mist
    const r = rng(344)
    for (let i = 0; i < (wide ? 34 : 16); i++) {
      const x = W * (0.02 + r() * 0.96), y = hz - 2 - r() * 4
      soft(g, x, y, 7, 5, T.lantern, T.dark ? 0.5 : 0.3)
      g.fillStyle = rgba(mix(T.lantern, T.moon, 0.3), T.dark ? 0.9 : 0.75)
      g.fillRect(x - 0.8, y - 1, 1.6, 2)
      inkLine(g, [[x, hz + 2], [x + 0.5, hz + 8 + r() * 12]], 1.2, T.lantern, T.dark ? 0.45 : 0.35, 0.2, 0.6, 0.2)
    }
    // the lake: it mirrors the sky at the horizon, deep toward the boat (by day a mid grey-blue, darker than the sky)
    g.fillStyle = vgrad(g, hz, HB, T.dark
      ? [[0, mix(T.water, T.mist, 0.18), 1], [0.2, mix(T.water, T.mist, 0.06), 1], [1, T.water, 1]]
      : [[0, mix(T.water, T.paper, 0.5), 1], [0.22, mix(T.water, T.paper, 0.2), 1], [0.7, T.water, 1], [1, mix(T.water, T.wash, 0.12), 1]])
    g.fillRect(0, hz, W, HB - hz)
    mist(g, T, W * 0.5, hz + 3, W * 0.75, H * 0.025, T.dark ? 1.3 : 0.6)
    yield
    // ripples: dry strokes that lengthen as they come near
    for (let i = 0; i < (wide ? 150 : 70); i++) {
      const t = Math.pow(r(), 0.75), y = hz + 6 + (HB - hz) * t
      const len = 8 + t * t * W * 0.13 * (0.4 + r())
      const x = r() * W
      inkLine(g, [[x, y], [x + len, y + (r() - 0.5)]], 0.6 + t * 1.8, r() < 0.55 ? T.wash : T.moon, T.dark ? 0.12 + t * 0.12 : 0.1 + t * 0.1, 0.3, 0.3, 0.1)
    }
    yield
    // the moon's road: broken dry-brush dabs under the moon, longer and wider as they come toward the boat
    for (let y = hz + 3, k = 0; y < HB; y += 2.2 + (y - hz) * 0.03, k++) {
      const t = (y - hz) / (HB - hz)
      const gate = noise(k * 0.21, 5.5)
      if (gate < 0.32) continue
      const ww = (7 + t * W * (wide ? 0.06 : 0.12)) * (0.45 + gate)
      const x = mx + (noise(k * 0.13, 9) - 0.5) * (10 + t * W * 0.05)
      dab(g, x, y, ww, 1.2 + t * 3.4, mix(T.moon, [255, 255, 255, 1], 0.2), (T.dark ? 0.75 : 0.7) * (1 - t * 0.5), k)
    }
    grain(g, 0, 0, W, HB, T.dark ? 0.06 : 0.08)
  }

  // ── a stall: drawn into a sprite, its broken reflection laid on the water, then the stall itself
  let sprite: HTMLCanvasElement | null = null
  function* paintStalls(l: Layer, which: number[]) {
    const g = l.g
    l.clear()
    const dpr = l.cv.width / W
    for (const k of which) {
      const st = geo[k]
      const bx0 = Math.max(0, st.cx - st.w * 0.85 - st.s), bx1 = Math.min(W, st.cx + st.w * 0.85 + st.s)
      const by0 = Math.max(0, st.roofTop - st.s * (st.tier ? 1.6 : 0.6)), by1 = st.yw + 2
      const sw = Math.ceil((bx1 - bx0) * dpr), sh = Math.ceil((by1 - by0) * dpr)
      if (sw < 2 || sh < 2) continue
      sprite ??= document.createElement('canvas')
      sprite.width = sw
      sprite.height = sh
      const sg = sprite.getContext('2d')!
      sg.setTransform(dpr, 0, 0, dpr, -bx0 * dpr, -by0 * dpr)
      stall(sg, st)
      if (st.far) {
        // the far stall sinks into the mist: contrast × 0.4, no ink edges
        sg.globalCompositeOperation = 'source-atop'
        sg.fillStyle = rgba(T.dark ? mix(T.paper, T.mist, 0.35) : mix(T.paper, T.mist, 0.4), T.dark ? 0.55 : 0.6)
        sg.fillRect(bx0, by0, bx1 - bx0, by1 - by0)
        sg.globalCompositeOperation = 'source-over'
      }
      yield
      // the reflection: rows of the sprite flipped about the waterline, broken by the ripples, fading down
      // (by night the brightest thing on the water; by day darker than the sky it lies in)
      const len = Math.min(HB - st.yw - 4, (st.yw - by0) * 1.3)
      const a0 = T.dark ? 0.62 : 0.55
      g.globalCompositeOperation = T.dark ? 'source-over' : 'multiply'
      for (let d = 0; d < len; d += 2) {
        if (d % 120 === 118) yield
        const sy = st.yw - d - 2
        if (sy < by0) break
        const n = noise(d * 0.07 + k * 9, k + 0.5)
        if (n < 0.28) continue
        const amp = 0.8 + d * 0.06
        const off = (noise(d * 0.15, 3 + k) - 0.5) * 2 * amp
        g.globalAlpha = a0 * Math.pow(1 - d / len, 1.2) * (0.5 + 0.5 * n)
        g.drawImage(sprite, 0, (sy - by0) * dpr, sw, 2 * dpr, bx0 + off, st.yw + d, bx1 - bx0, 2.2)
      }
      g.globalAlpha = 1
      g.globalCompositeOperation = 'source-over'
      if (T.dark) {
        g.fillStyle = vgrad(g, st.yw, st.yw + len, [[0, T.water, 0.12], [1, T.water, 0.5]])
        g.fillRect(bx0, st.yw, bx1 - bx0, len)
      }
      // the lamps' warm pools on the water under the stall
      for (const [lx, , lr] of st.lamps) soft(g, lx, st.yw + st.s * 0.3, lr * 3.4, st.s * 0.18, T.lantern, T.dark ? 0.35 : 0.22)
      g.drawImage(sprite, 0, 0, sw, sh, bx0, by0, bx1 - bx0, by1 - by0)
      streak(k)
    }
  }

  /** the stall's lamp reflections: long broken streaks down the water (the hub's seven make one band of colours) */
  function streak(k: number) {
    const st = geo[k], cv = stalls[k].streaks
    const xs = st.lamps.map((l) => l[0]), pad = st.s * 0.5
    const x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad
    const len = Math.max(20, Math.min(HB - st.yw - 6, (HB - st.yw) * (st.far ? 0.8 : 0.95)))
    const d = Math.min(dprFor(ctx, 1.25), 1.25)
    cv.width = Math.ceil((x1 - x0) * d)
    cv.height = Math.ceil(len * d)
    cv.style.width = `${(x1 - x0).toFixed(1)}px`
    cv.style.height = `${len.toFixed(1)}px`
    cv.style.left = `${x0.toFixed(1)}px` // left/top: the CSS scales it (lit, flare) from its top
    cv.style.top = `${(st.yw + 1).toFixed(1)}px`
    const g = cv.getContext('2d')!
    g.setTransform(d, 0, 0, d, 0, 0)
    g.clearRect(0, 0, x1 - x0, len)
    const tones = TONES(T)
    for (const [lx, , lr, tone] of st.lamps) {
      const c = k ? T.lantern : tones[tone]
      const bw = k ? lr * 0.95 : lr * 0.8
      for (let y = 0, i = 0; y < len; y += 2 + y * 0.012, i++) {
        const t = y / len
        const n = noise(i * 0.19 + lx * 0.01, tone * 3.3 + k)
        if (n < 0.3 + t * 0.15) continue
        const w = bw * (0.5 + n) * (1 + t * 1.4)
        const off = (noise(i * 0.11, 7 + tone) - 0.5) * (2 + t * 10)
        g.fillStyle = rgba(mix(c, [255, 255, 255, 1], T.dark ? 0.15 : 0), (T.dark ? 0.9 : 0.75) * Math.pow(1 - t, 0.9) * (0.4 + 0.6 * n))
        g.fillRect(lx - x0 - w / 2 + off, y, w, 1.6 + t * 2.2)
      }
    }
  }

  /** the stall in screen px: stilts, deck, side face toward the vanishing point, lit interior, counter, posts, roof(s), lanterns */
  function stall(g: CanvasRenderingContext2D, st: Geo) {
    const { cx, yw, s, w, deck, nTop, eave, roofTop, side } = st
    const ol = !st.far // ink edges only where the stall is out of the mist
    const x0 = cx - w / 2, x1 = cx + w / 2
    const VP: Pt = [W / 2, hz]
    const kb = 1 / (1 + (1.7 * s) / (wide ? W * 0.45 : H * 0.9)) // depth of the stall toward the vanishing point
    const back = (p: Pt): Pt => [VP[0] + (p[0] - VP[0]) * kb, VP[1] + (p[1] - VP[1]) * kb]
    const edge = side > 0 ? x1 : x0
    const wood = T.dark ? [mix(T.stepLo, T.umbra, 0.55), mix(T.stepLo, T.lantern, 0.12), mix(T.stepMid, T.lantern, 0.3)] : [mix(T.stepLo, T.wash, 0.55), mix(T.stepLo, T.wash, 0.2), mix(T.stepMid, T.lantern, 0.3)]
    const inner = mix(T.lantern, T.umbra, T.dark ? 0.55 : 0.45)
    const edgeC = T.dark ? T.wash : T.ink
    // warm breath of light round the stall
    soft(g, cx, (eave + deck) / 2, w * 0.95, (deck - roofTop) * 0.9, T.lantern, T.dark ? 0.22 : 0.14)
    const stilt = (x: number, top: number, bot: number, ww: number, c: C4) => {
      g.fillStyle = rgba(c)
      g.fillRect(x - ww / 2, top, ww, bot - top)
    }
    for (const x of [x0 + 0.1 * s, x1 - 0.1 * s]) {
      const a = back([x, deck]), b = back([x, yw])
      stilt(a[0], a[1], b[1] + 2, 0.08 * s * kb, mix(wood[0], T.umbra, 0.3))
    }
    const sideFace = (y0: number, y1: number, c: string | CanvasGradient) => {
      const a: Pt = [edge, y0], b: Pt = [edge, y1]
      poly(g, [a, back(a), back(b), b])
      g.fillStyle = c
      g.fill()
    }
    sideFace(eave, deck, rgba(mix(wood[0], inner, 0.25)))
    sideFace(deck, deck + 0.1 * s, rgba(wood[1]))
    // the lit inside, the back wall glowing under the lanterns
    g.fillStyle = vgrad(g, eave, deck, [[0, mix(inner, T.lantern, 0.35), 1], [1, mix(inner, T.umbra, 0.35), 1]])
    g.fillRect(x0, eave, w, deck - eave)
    soft(g, cx, nTop + st.nh * 0.4, w * 0.5, st.nh * 0.7, T.lantern, 0.45)
    for (let i = 0; i < 3; i++) {
      const y = nTop + st.nh * (0.3 + i * 0.25)
      g.fillStyle = rgba(T.umbra, 0.35)
      g.fillRect(x0 + 0.1 * s, y, w - 0.2 * s, 0.03 * s)
    }
    // counter
    const ct = deck - 0.36 * s
    g.fillStyle = vgrad(g, ct, deck, [[0, wood[2], 1], [0.15, wood[1], 1], [1, mix(wood[1], T.umbra, 0.3), 1]])
    g.fillRect(x0, ct, w, deck - ct)
    if (ol) for (let x = x0 + 0.22 * s; x < x1 - 0.1 * s; x += 0.24 * s) inkLine(g, [[x, ct + 0.06 * s], [x, deck - 0.02 * s]], Math.max(0.8, 0.02 * s), edgeC, 0.35, 0.05, 0.05, 0.6)
    // deck edge and the front stilts standing in the water
    g.fillStyle = rgba(wood[1])
    g.fillRect(x0 - 0.12 * s, deck, w + 0.24 * s, 0.1 * s)
    if (ol) inkLine(g, [[x0 - 0.12 * s, deck], [x1 + 0.12 * s, deck]], Math.max(1, 0.025 * s), T.lantern, 0.5, 0.05, 0.05, 0.6)
    const n = Math.max(3, Math.round(w / (1.1 * s)) + 1)
    for (let i = 0; i < n; i++) {
      const x = x0 + (w * i) / (n - 1)
      stilt(x, deck + 0.1 * s, yw + 1, 0.1 * s, wood[0])
      inkLine(g, [[x + 0.035 * s, deck + 0.12 * s], [x + 0.035 * s, yw - 2]], Math.max(0.8, 0.02 * s), T.lantern, 0.35, 0.1, 0.1, 0.5)
      if (ol) inkLine(g, [[x - 0.05 * s, deck + 0.12 * s], [x - 0.05 * s, yw]], Math.max(0.8, 0.022 * s), edgeC, T.dark ? 0.5 : 0.6, 0.05, 0.05, 0.6)
    }
    // front posts
    for (const x of [x0, x1]) {
      g.fillStyle = rgba(wood[0])
      g.fillRect(x - 0.07 * s, eave, 0.14 * s, deck - eave)
      inkLine(g, [[x + (x === x0 ? 0.05 : -0.05) * s, eave + 0.05 * s], [x + (x === x0 ? 0.05 : -0.05) * s, deck]], Math.max(1, 0.025 * s), T.lantern, 0.55, 0.1, 0.1, 0.5)
      if (ol) inkLine(g, [[x + (x === x0 ? -0.07 : 0.07) * s, eave], [x + (x === x0 ? -0.07 : 0.07) * s, deck]], Math.max(1, 0.03 * s), edgeC, T.dark ? 0.55 : 0.7, 0.05, 0.05, 0.6)
    }
    roof(g, st, x0, x1, eave, roofTop, wood, back, ol)
    if (st.tier) {
      // the hub's upper storey: a lit paper window under a second roof
      const ux0 = cx - w * 0.33, ux1 = cx + w * 0.33, ut = roofTop - 0.62 * s
      g.fillStyle = rgba(mix(wood[0], inner, 0.2))
      g.fillRect(ux0, ut, ux1 - ux0, roofTop - ut + 0.1 * s)
      const wx0 = ux0 + 0.12 * s, wx1 = ux1 - 0.12 * s, wy0 = ut + 0.1 * s, wy1 = roofTop - 0.02 * s
      g.fillStyle = vgrad(g, wy0, wy1, [[0, mix(T.lantern, T.moon, 0.5), T.dark ? 0.85 : 0.9], [1, T.lantern, T.dark ? 0.7 : 0.75]])
      g.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0)
      g.strokeStyle = rgba(wood[0], 0.85)
      g.lineWidth = Math.max(1, 0.025 * s)
      g.beginPath()
      for (let x = wx0 + 0.22 * s; x < wx1; x += 0.22 * s) (g.moveTo(x, wy0), g.lineTo(x, wy1))
      g.moveTo(wx0, (wy0 + wy1) / 2)
      g.lineTo(wx1, (wy0 + wy1) / 2)
      g.stroke()
      roof(g, st, ux0, ux1, ut, ut - 0.5 * s, wood, back, ol)
    }
    if (st.k === 0) {
      // the bar the lanterns hang from, and their cords
      const lx0 = Math.min(...st.lamps.map((l) => l[0])) - s * 0.2, lx1 = Math.max(...st.lamps.map((l) => l[0])) + s * 0.2
      const by = st.tier ? Math.min(...st.lamps.map((l) => l[1] - l[2])) - s * 0.22 : eave + 0.04 * s
      g.fillStyle = rgba(wood[0])
      g.fillRect(lx0, by - 0.04 * s, lx1 - lx0, 0.06 * s)
      g.strokeStyle = rgba(T.wash, 0.75)
      g.lineWidth = 1
      g.beginPath()
      for (const [x, y, r] of st.lamps) (g.moveTo(x, by), g.lineTo(x, y - r * 1.2))
      g.stroke()
    }
    const tones = TONES(T)
    for (const [x, y, r, tone] of st.lamps) paperLantern(g, x, y, r, st.k === 0 ? tones[tone] : T.lantern, st.k !== 0)
  }
  function roof(g: CanvasRenderingContext2D, st: Geo, x0: number, x1: number, eave: number, top: number, wood: C4[], back: (p: Pt) => Pt, ol: boolean) {
    const s = st.s, o = 0.4 * s
    const L: Pt = [x0 - o, eave - 0.1 * s], R: Pt = [x1 + o, eave - 0.1 * s]
    g.fillStyle = rgba(mix(wood[0], T.lantern, T.dark ? 0.3 : 0.2))
    g.fillRect(x0 - o * 0.6, eave - 0.04 * s, x1 - x0 + o * 1.2, 0.1 * s)
    const e = st.side > 0 ? R : L
    const tp: Pt = [st.side > 0 ? x1 - 0.1 * s : x0 + 0.1 * s, top]
    poly(g, [e, back(e), back(tp), tp])
    g.fillStyle = rgba(mix(wood[0], T.wash, 0.35))
    g.fill()
    g.beginPath()
    g.moveTo(L[0] - 0.12 * s, L[1] - 0.16 * s)
    g.quadraticCurveTo(L[0] + 0.1 * s, L[1] + 0.08 * s, L[0] + 0.5 * s, L[1] + 0.04 * s)
    g.lineTo(R[0] - 0.5 * s, R[1] + 0.04 * s)
    g.quadraticCurveTo(R[0] - 0.1 * s, R[1] + 0.08 * s, R[0] + 0.12 * s, R[1] - 0.16 * s)
    g.quadraticCurveTo(x1 + 0.1 * s, (eave + top) / 2, x1 - 0.1 * s, top)
    g.lineTo(x0 + 0.1 * s, top)
    g.quadraticCurveTo(x0 - 0.1 * s, (eave + top) / 2, L[0] - 0.12 * s, L[1] - 0.16 * s)
    g.closePath()
    g.fillStyle = vgrad(g, top, eave, [[0, mix(wood[0], T.wash, 0.5), 1], [1, mix(wood[0], T.wash, 0.2), 1]])
    g.fill()
    if (!ol) return
    for (let i = 1; i < 4; i++) {
      const y = top + ((eave - top) * i) / 4
      inkLine(g, [[x0 - o * (i / 4), y], [x1 + o * (i / 4), y]], Math.max(0.8, 0.02 * s), T.umbra, T.dark ? 0.5 : 0.35, 0.05, 0.05, 0.5)
    }
    // the eave line in ink, the ridge with a moonlit edge (an ink edge by day)
    inkLine(g, [[L[0] - 0.12 * s, L[1] - 0.16 * s], [L[0] + 0.5 * s, L[1] + 0.06 * s], [R[0] - 0.5 * s, R[1] + 0.06 * s], [R[0] + 0.12 * s, R[1] - 0.16 * s]], Math.max(1.4, 0.035 * s), T.dark ? T.wash : T.ink, T.dark ? 0.8 : 0.75, 0.1, 0.1, 0.5)
    inkLine(g, [[x0, top], [x1, top]], Math.max(2, 0.07 * s), T.dark ? T.wash : T.ink, 0.9, 0.05, 0.05, 0.7)
    inkLine(g, [[x0 + 0.1 * s, top - 0.03 * s], [x1 - 0.1 * s, top - 0.03 * s]], Math.max(1, 0.02 * s), T.dark ? T.moon : T.card, T.dark ? 0.45 : 0.6, 0.1, 0.1, 0.3)
  }
  /** a glowing paper lantern (chōchin) in tone c */
  function paperLantern(g: CanvasRenderingContext2D, x: number, y: number, r: number, c: C4, big: boolean) {
    soft(g, x, y, r * (big ? 5 : 3.6), r * (big ? 5 : 3.6), c, T.dark ? 0.32 : 0.2)
    const gr = g.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.1, x, y, r * 1.1)
    gr.addColorStop(0, rgba(mix(c, [255, 255, 255, 1], 0.55)))
    gr.addColorStop(0.6, rgba(c))
    gr.addColorStop(1, rgba(mix(c, T.umbra, 0.35)))
    g.fillStyle = gr
    g.beginPath()
    g.ellipse(x, y, r * 0.86, r * 1.12, 0, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = rgba(mix(c, T.umbra, 0.5), 0.5)
    g.lineWidth = Math.max(0.6, r * 0.05)
    for (let i = -2; i <= 2; i++) {
      g.beginPath()
      g.ellipse(x, y + i * r * 0.36, r * 0.86 * Math.sqrt(1 - (i * 0.32) ** 2), r * 0.1, 0, 0, Math.PI)
      g.stroke()
    }
    g.fillStyle = rgba(T.wash, 0.9)
    g.fillRect(x - r * 0.42, y - r * 1.22, r * 0.84, r * 0.2)
    g.fillRect(x - r * 0.42, y + r * 1.04, r * 0.84, r * 0.2)
  }

  // ── near layer: the boat's bow (the darkest, sharpest thing, cut by the bottom edge), its lamp post
  function paintBow() {
    const l = L[3], g = l.g
    l.clear()
    const [bx, by] = bow
    const bot = HB + 10
    const spread = wide ? W * 0.21 : W * 0.48 // half-width where the gunwales leave the frame
    const wood = T.dark ? mix(T.stepLo, T.umbra, 0.6) : mix(T.umbra, T.stepLo, 0.42)
    const deep = T.dark ? mix(T.umbra, T.wash, 0.3) : mix(T.umbra, T.wash, 0.2)
    const rimC = T.dark ? T.moon : T.ink
    const gun = (sd: number, o = 0): Pt[] => Array.from({ length: 15 }, (_, i) => {
      const t = i / 14
      return [bx + sd * (spread * Math.pow(t, 0.72) + Math.sin(Math.PI * t) * spread * 0.08 + o * t), by + (bot - by) * t]
    })
    /** a strip along pts, w0 wide at the stem growing to w1 at the frame (nearer = thicker) */
    const strip = (pts: Pt[], w0: number, w1: number, dy = 0): Pt[] => {
      const n = pts.length - 1
      const a = pts.map(([x, y], i) => [x, y + dy - (w0 + (w1 - w0) * (i / n)) / 2] as Pt)
      const b = pts.map(([x, y], i) => [x, y + dy + (w0 + (w1 - w0) * (i / n)) / 2] as Pt)
      return [...a, ...b.reverse()]
    }
    const Lg = gun(-1), Rg = gun(1)
    // the lamp's warm pool on the water and the deck; the hull's dark contact with the water, a moonlit ripple outside it
    soft(g, bx, by + (bot - by) * 0.1, spread * 1.1, (bot - by) * 0.3, T.lantern, T.dark ? 0.26 : 0.16)
    for (const sd of [-1, 1]) {
      const out = gun(sd, 10).slice(0, 10)
      inkLine(g, out, 4, T.dark ? T.umbra : T.wash, T.dark ? 0.55 : 0.3, 0.1, 0.2, 0.4)
      inkLine(g, gun(sd, 22).slice(1, 9).map(([x, y]) => [x, y + 3] as Pt), 1.2, T.dark ? T.moon : T.card, T.dark ? 0.35 : 0.75, 0.3, 0.3, 0.1)
    }
    // the foredeck between the gunwales, planks running to the stem, the inside of the hull in shade along each side
    poly(g, [...Lg, ...Rg.slice().reverse()])
    g.fillStyle = vgrad(g, by, bot, [[0, mix(wood, T.lantern, T.dark ? 0.3 : 0.18), 1], [0.3, wood, 1], [1, deep, 1]])
    g.fill()
    g.save()
    g.clip()
    for (let i = 1; i < 7; i++) {
      const k = i / 7
      inkLine(g, [[bx, by + 4], [bx - spread * 1.1 + spread * 2.2 * k, bot]], 1.2, T.umbra, T.dark ? 0.55 : 0.4, 0.4, 0.02, 0.2)
      inkLine(g, [[bx + 1, by + 6], [bx - spread * 1.1 + spread * 2.2 * k + 2, bot]], 0.8, mix(wood, T.lantern, 0.5), T.dark ? 0.25 : 0.2, 0.5, 0.05, 0.1)
    }
    for (const sd of [-1, 1]) {
      const wall = gun(sd, -spread * 0.14)
      poly(g, [...gun(sd), ...wall.reverse()])
      g.fillStyle = rgba(deep, T.dark ? 0.7 : 0.55)
      g.fill()
    }
    // a curved thwart low in the frame, lit on its top edge
    const ty = by + (bot - by) * 0.72
    const tw = spread * Math.pow(0.72, 0.72) * 1.02
    poly(g, [[bx - tw, ty + 4], [bx, ty - 6], [bx + tw, ty + 4], [bx + tw, ty + 18], [bx, ty + 8], [bx - tw, ty + 18]])
    g.fillStyle = vgrad(g, ty - 6, ty + 18, [[0, mix(wood, T.lantern, 0.25), 1], [1, deep, 1]])
    g.fill()
    inkLine(g, [[bx - tw, ty + 4], [bx, ty - 6], [bx + tw, ty + 4]], 1.5, rimC, T.dark ? 0.4 : 0.55, 0.05, 0.05, 0.4)
    g.restore()
    // the gunwale caps: dark, thicker toward us, a moon rim along the top (an ink edge by day)
    const cap = Math.max(4, spread * 0.03)
    for (const [gp, sd] of [[Lg, -1], [Rg, 1]] as [Pt[], number][]) {
      poly(g, strip(gp, cap * 0.8, cap * 3.4))
      g.fillStyle = rgba(deep)
      g.fill()
      inkLine(g, gp.map(([x, y], i) => [x - sd * 0.5, y - (cap * 0.8 + cap * 2.6 * (i / 14)) / 2] as Pt).slice(0, 13), Math.max(1.2, cap * 0.32), rimC, T.dark ? 0.6 : 0.85, 0.15, 0.1, 0.2)
    }
    // the stem: a little raised prow at the tip, moonlit on its edge
    poly(g, [[bx - cap * 1.1, by + 8], [bx - cap * 0.2, by - cap * 2.2], [bx + cap * 0.5, by - cap * 2.4], [bx + cap * 1.1, by + 8]])
    g.fillStyle = rgba(deep)
    g.fill()
    inkLine(g, [[bx - cap * 0.6, by + 2], [bx - cap * 0.1, by - cap * 2.1], [bx + cap * 0.5, by - cap * 2.35]], 1.3, rimC, T.dark ? 0.6 : 0.8, 0.1, 0.1, 0.3)
    // the lamp post a step back from the stem, a short arm, the boat's own lantern
    const px0 = bx, py0 = by + (bot - by) * 0.06, top = py0 - post
    g.fillStyle = vgrad(g, top, py0, [[0, mix(wood, T.lantern, 0.25), 1], [1, deep, 1]])
    g.fillRect(px0 - 3.5, top, 7, post)
    inkLine(g, [[px0 + 2.6, top + 6], [px0 + 2.6, py0 - 4]], 1.1, rimC, T.dark ? 0.45 : 0.6, 0.1, 0.1, 0.3)
    g.fillRect(px0 - 3.5, top, 30, 4.5)
    g.strokeStyle = rgba(T.wash, 0.85)
    g.lineWidth = 1
    g.beginPath()
    g.moveTo(px0 + 22, top + 4)
    g.lineTo(px0 + 22, top + 11)
    g.stroke()
    soft(g, px0 + 10, py0, spread * 0.36, (bot - by) * 0.12, T.lantern, T.dark ? 0.32 : 0.2)
    const lr = clamp(H * 0.022, 8, 14)
    paperLantern(g, px0 + 22, top + 11 + lr * 1.15, lr, T.lantern, true)
  }

  // ── DOM follows the painting
  function placeDom() {
    const px = (n: number) => `${n.toFixed(1)}px`
    geo.forEach((st, k) => {
      const S = stalls[k]
      S.noren.style.transform = `translate3d(${px(st.cx - st.nw / 2)},${px(st.nTop)},0)`
      // the band of cloth reaches from the rod down to the water, a little into it
      S.noren.style.setProperty('--drop', px(st.yw - st.nTop + st.s * 0.12))
      Object.assign(S.btn.style, { left: px(st.cx - st.w / 2 - 6), top: px(st.eave - st.s * 0.2), width: px(st.w + 12), height: px(st.yw - st.eave + st.s * 0.5) })
      S.el.style.zIndex = String(3 - k)
      S.glow.style.transform = `translate3d(${px(st.cx)},${px((st.eave + st.deck) / 2)},0)`
      S.glow.style.setProperty('--gw', px(st.w * 1.4))
    })
    placeSay()
    lans.forEach((b, i) => {
      b.dataset.side = home[i][0] < bow[0] ? 'l' : 'r'
      if (!placed.has(i)) setLan(i, home[i], homeScale(i))
    })
    placed.forEach((si, ti) => setLan(ti, dockAt(si, ti), dockScale(si)))
    // the board: nailed to the bow's lamp post under the lantern (phone: hung on the near stall's corner post, over the water)
    const hub = geo[0]
    vol.style.transform = wide ? `translate3d(${px(bow[0])},${px(bow[1] - post * 0.56)},0)` : `translate3d(${px(Math.min(W * 0.78, hub.cx + hub.w / 2 + W * 0.2))},${px(hub.eave + hub.s * 0.15)},0)`
  }
  /** words on the water just under the stall they speak about (phone: the open water band between the near stall and the boat) */
  function placeSay() {
    const px = (n: number) => `${n.toFixed(1)}px`
    if (!wide) {
      say.style.transform = `translate3d(${px(W * 0.05)},${px(H * 0.7)},0)`
      say.style.width = px(W * 0.9)
      return
    }
    const st = geo[Math.max(0, sayAt)]
    if (!st) return
    const sw = Math.min(290, W * 0.22)
    // the near stall speaks on its left, clear of the lanterns round the bow; below its band of cloth when that is down
    const x = st.k === 0 ? Math.max(W * 0.03, st.cx - st.w * 0.62) : clamp(st.cx - sw / 2, W * 0.03, W * 0.97 - sw)
    say.style.transform = `translate3d(${px(x)},${px(Math.max(st.yw + st.s * 0.42 + 6, sayBelow + 10))},0)`
    say.style.width = px(sw)
  }
  const homeScale = (i: number) => clamp(1 - (bow[1] - home[i][1]) / (bow[1] - hz) * 0.5, 0.88, 1)
  const setLan = (i: number, p: Pt, sc: number) => (lans[i].style.transform = `translate3d(${p[0].toFixed(1)}px,${p[1].toFixed(1)}px,0) translate(-50%,-100%) scale(${sc.toFixed(3)})`)
  const dockScale = (si: number) => clamp(geo[si].s / (wide ? 150 : 90), 0.36, 0.85)
  function dockAt(si: number, ti: number): Pt {
    const st = geo[si]
    const n = [...placed.entries()].filter(([t, s]) => s === si && t !== ti).length
    const slot = [...placed.keys()].filter((t) => placed.get(t) === si).indexOf(ti)
    const j = slot >= 0 ? slot : n
    return [st.cx - st.w * 0.3 + j * st.w * 0.2, st.yw + st.s * 0.42]
  }

  // ── interaction
  function pick(i: number) {
    if (busy) return
    picked = i
    if (i >= 0) stalls.forEach((x) => x.el.classList.remove('open'))
    lans.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)))
    root.classList.toggle('is-picking', i >= 0)
    stalls.forEach((st, k) => st.btn.setAttribute('aria-label', i >= 0 ? fill(K.dropAria, { task: K.tasks[i].text, stall: K.stalls[k].name }) : K.stalls[k].name))
    if (i >= 0) {
      aim = 0
      stalls[0].btn.focus({ preventScroll: true })
    }
  }
  function keyStall(e: KeyboardEvent, i: number) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      e.stopPropagation()
      aim = (i + (e.key === 'ArrowRight' ? 1 : 2)) % 3
      stalls[aim].btn.focus({ preventScroll: true })
    } else if (e.key === 'Escape' && picked >= 0) {
      const p = picked
      pick(-1)
      lans[p].focus({ preventScroll: true })
    }
  }
  function openStall(i: number) {
    stalls.forEach((st, k) => st.el.classList.toggle('open', k === i && !st.el.classList.contains('open')))
  }
  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(fn, still ? 0 : ms)
    ctx.onCleanup(() => clearTimeout(t))
  }
  function drop(ti: number, si: number) {
    if (busy || placed.has(ti)) return
    const t = K.tasks[ti], st = K.stalls[si]
    const b = lans[ti]
    pick(-1)
    busy = true
    b.classList.add('moving')
    const fits = t.fits.includes(st.id)
    const target = dockAt(si, ti)
    setLan(ti, fits ? target : [target[0], target[1] + geo[si].s * 0.5], dockScale(si))
    later(() => {
      b.classList.remove('moving')
      busy = false
      if (!fits) {
        // the current carries it back to the boat; the reason is written on the water under that stall
        speak(si, h('p', { class: 't34m-wrong' }, h('strong', null, st.name), ' — ', K.wrong))
        b.classList.add('moving')
        setLan(ti, home[ti], homeScale(ti))
        later(() => b.classList.remove('moving'), 1200)
        ctx.chime('low')
        b.focus({ preventScroll: true })
        return
      }
      placed.set(ti, si)
      b.classList.add('docked')
      b.disabled = true
      ctx.chime('ok')
      const S = stalls[si]
      S.el.classList.remove('flare')
      void S.el.offsetWidth
      S.el.classList.add('flare', 'lit')
      const others = t.fits.filter((f) => f !== st.id)
      const kids: HTMLElement[] = [h('p', null, h('strong', null, `${st.name}. ${K.right}`), ' ', t.why)]
      if (others.length) kids.push(h('p', { class: 't34m-also' }, fill(K.also, { stalls: others.map((f) => K.stalls.find((x) => x.id === f)!.name).join(', ') })))
      const fx = K.facts.filter((f) => f.source.startsWith(st.source))
      if (!factShown.has(si) && fx[0]) {
        factShown.add(si)
        // the stall's own claim (◇): on the water with its words (the band keeps ≤ 3 lines); on a phone, dyed on the band
        if (wide) kids.push(ctx.fact(F(fx[0]), 'p', 't34m-fact'))
        else S.what.append(ctx.fact(F(fx[0]), 'p', 't34m-fact'))
      }
      if (wide && placed.size < lans.length) {
        stalls.forEach((x, k) => x.el.classList.toggle('open', k === si))
        later(() => S.el.classList.remove('open'), 7000)
      } else stalls.forEach((x) => x.el.classList.remove('open'))
      speak(si, ...kids)
      // ghost lanterns drift toward the other stalls that also fit, and fade
      for (const f of others) ghost(ti, si, K.stalls.findIndex((x) => x.id === f))
      const next = lans.findIndex((_, k) => !placed.has(k))
      if (next >= 0) lans[next].focus({ preventScroll: true })
      else {
        S.btn.focus({ preventScroll: true })
        ctx.insight(F(K.insight), K.detail)
      }
    }, 1150)
  }
  function speak(si: number, ...kids: HTMLElement[]) {
    sayAt = si
    const S = stalls[si]
    sayBelow = wide && S.el.classList.contains('open') ? geo[si].nTop + S.what.offsetTop + S.what.offsetHeight : 0
    placeSay()
    sayEl.replaceChildren(...kids)
    mirrorOf(sayEl, sayMir)
    if (!sayEl.hasAttribute('aria-live')) sayEl.setAttribute('aria-live', 'polite')
    say.classList.remove('on')
    void say.offsetWidth
    say.classList.add('on')
  }
  function ghost(ti: number, from: number, to: number) {
    if (still || to < 0) {
      stalls[to]?.el.classList.add('lit')
      return
    }
    const g = h('span', { class: 't34m-ghost', 'aria-hidden': 'true' })
    const a = dockAt(from, ti)
    const b = geo[to]
    g.style.transform = `translate3d(${a[0].toFixed(1)}px,${a[1].toFixed(1)}px,0) translate(-50%,-50%) scale(${dockScale(from).toFixed(3)})`
    wraps[3].append(g)
    requestAnimationFrame(() => {
      g.style.transform = `translate3d(${b.cx.toFixed(1)}px,${(b.yw + b.s * 0.2).toFixed(1)}px,0) translate(-50%,-50%) scale(${dockScale(to).toFixed(3)})`
      g.classList.add('go')
    })
    later(() => {
      stalls[to].el.classList.add('lit')
      g.remove()
    }, 1900)
  }

  // drag a lantern across the water: it shrinks as it goes out; let go over a stall to float it there
  function grab(i: number, e: PointerEvent) {
    if (busy || placed.has(i) || e.button) return
    const b = lans[i]
    const r0 = view.getBoundingClientRect()
    const sx = e.clientX, sy = e.clientY
    const [hx, hy] = home[i]
    let moved = false
    delete b.dataset.dragged
    b.setPointerCapture(e.pointerId)
    // the lantern keeps the offset at which it was taken (its anchor is the base on the water)
    const ox = sx - r0.left - hx, oy = sy - r0.top - hy
    const at = (ev: PointerEvent): Pt => [ev.clientX - r0.left - ox, ev.clientY - r0.top - oy]
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 7) return
      moved = true
      b.classList.add('drag')
      const p = at(ev)
      const k = clamp((p[1] - hz) / (bow[1] - hz), 0.36, 1.05) * homeScale(i)
      setLan(i, p, k)
    }
    const up = (ev: PointerEvent) => {
      b.removeEventListener('pointermove', move)
      b.removeEventListener('pointerup', up)
      b.removeEventListener('pointercancel', up)
      b.classList.remove('drag')
      if (!moved) return
      b.dataset.dragged = '1'
      setTimeout(() => delete b.dataset.dragged)
      const [x, y] = [ev.clientX - r0.left, ev.clientY - r0.top]
      const si = geo.findIndex((st) => x > st.cx - st.w / 2 - 20 && x < st.cx + st.w / 2 + 20 && y > st.roofTop && y < st.yw + st.s * 0.9)
      if (si >= 0) drop(i, si)
      else setLan(i, home[i], homeScale(i))
    }
    b.addEventListener('pointermove', move)
    b.addEventListener('pointerup', up)
    b.addEventListener('pointercancel', up)
  }

  // parallax: four depths drift apart with the pointer (mouse only; none when still)
  if (!still) {
    let raf = 0, mx = 0
    let box: DOMRect | null = null
    view.addEventListener('pointerenter', () => void (box = view.getBoundingClientRect()))
    view.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || !W) return
      box ??= view.getBoundingClientRect()
      mx = ((e.clientX - box.left) / W - 0.5) * 2
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        wraps.forEach((wr, i) => (wr.style.transform = `translate3d(${(-mx * [2, 4.5, 7, 10][i]).toFixed(1)}px,0,0)`))
        group.style.transform = `translate3d(${(-mx * 5.5).toFixed(1)}px,0,0)`
      })
    })
    ctx.onCleanup(() => cancelAnimationFrame(raf))
  }
}
