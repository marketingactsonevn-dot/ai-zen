import './mirror.css'
import { h, nextId, s } from '../../core/dom'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import { blob, clamp, curve, rng, stroke, type Pt } from '../../ui/part2/ink'
import { guide, type Mark } from '../../ui/part2/guide'
import type { SceneCtx } from '../types'
import C from '../../content/tram-25.json'
import { bamboo, broken, leaf } from './kit'
import { F, ambient, f1, frame, lerp, tokens } from './art'

const K = C.scenes.mirror
const TILT = 0.93 // the basin seen from kneeling, about 68° down: a circle squashed to 93%
const STIR = 3.4 // seconds the ladle turns the water
const SLOW = 1.6 // … then it slows, and the words settle back into the answer for HEAL seconds
const HEAL = 2.6

type Frag = { k: number; a: number; r: number; s: number; w: number; o: number; ha: number; hr: number; fr: number }
/** where fragment i of n rests in the frozen funnel: evenly spread in radius, so per area they crowd toward the eye */
const funnelR = (i: number, n: number) => 0.06 + 0.9 * Math.pow((i + 0.5) / n, 0.9)

/**
 * A length of bamboo from a to b, w thick, shaded as a cylinder lit from the upper right: a cast shadow (offset `sh`,
 * null = none), the cane, a dark band on its far side, a moonlit band on the near side, knuckles at `nodes` (shares of
 * the length), and a cut end at 'a' / 'b' showing its dark hollow.
 */
function cylinder(a: Pt, b: Pt, w: number, seed: number, nodes: number[], cut: 'a' | 'b' | null, sh: Pt | null): SVGElement[] {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
  const u: Pt = [(b[0] - a[0]) / L, (b[1] - a[1]) / L]
  let n: Pt = [-u[1], u[0]]
  if (n[0] - n[1] < 0) n = [-n[0], -n[1]] // n points at the light (up-right)
  const at = (t: number, o: number): Pt => [a[0] + (b[0] - a[0]) * t + n[0] * o * w, a[1] + (b[1] - a[1]) * t + n[1] * o * w]
  const quad = (o0: number, o1: number, t0 = 0, t1 = 1) => `M${[at(t0, o0), at(t1, o0), at(t1, o1), at(t0, o1)].map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')}Z`
  const r = rng(seed)
  let knots = '', knotsLt = ''
  for (const t of nodes) {
    const tt = t + (r() - 0.5) * 0.04
    knots += stroke([at(tt, -0.56), at(tt + 0.004, 0), at(tt, 0.56)], Math.max(1.2, w * 0.2), 0.15, 0.15, 0.5)
    knotsLt += stroke([at(tt + w * 0.16 / L, -0.3), at(tt + w * 0.16 / L, 0.46)], Math.max(0.8, w * 0.08), 0.2, 0.2, 0.3)
  }
  const out: SVGElement[] = []
  if (sh) out.push(s('path', { class: 't25m-cyl-sh', d: stroke([[a[0] + sh[0], a[1] + sh[1]], [b[0] + sh[0], b[1] + sh[1]]], w * 1.05, 0.04, 0.04, 0.6), filter: 'url(#ink-wash)' }))
  out.push(
    s('path', { class: 't25m-cane', d: quad(-0.5, 0.5), filter: 'url(#ink-rough)' }),
    s('path', { class: 't25m-cane-dk', d: quad(-0.5, -0.12) }),
    s('path', { class: 't25m-cane-lt', d: quad(0.16, 0.34) }),
    s('path', { class: 't25m-knot', d: knots }),
    s('path', { class: 't25m-cane-lt', d: knotsLt }))
  if (cut) {
    const c = cut === 'a' ? a : b, ang = (Math.atan2(n[1], n[0]) * 180) / Math.PI
    out.push(
      s('ellipse', { class: 't25m-cut', cx: f1(c[0]), cy: f1(c[1]), rx: f1(w * 0.52), ry: f1(w * 0.3), transform: `rotate(${f1(ang)} ${f1(c[0])} ${f1(c[1])})` }),
      s('ellipse', { class: 't25m-hollow', cx: f1(c[0]), cy: f1(c[1]), rx: f1(w * 0.36), ry: f1(w * 0.19), transform: `rotate(${f1(ang)} ${f1(c[0])} ${f1(c[1])})` }))
  }
  return out
}

/**
 * Scene 3 — a stone basin (tsukubai) seen from kneeling over it. Three depths in the water: leaves and petals on the
 * skin, pebbles and old coins on the bottom, and deeper than the bottom the reflection — moon, a bamboo sprig, the
 * shadow of the one bending over it — with the AI's kind answer floating in it. The layers slide apart as you move
 * (pointer / tilt). Stir with the ladle (or circle a finger on the water): the answer dissolves into hundreds of other
 * words of comfort, hand-written by people, spiralling into the funnel; as the water stills they settle and come back
 * together as the answer (audit v3 25-3: the AI does not cut and paste one diary, it learned from countless such
 * words). Where human writing comes from is carved small on the rim.
 */
export function mirrorScene(ctx: SceneCtx) {
  const live = !ctx.reduced && ctx.quality !== 'low'
  let G: { W: number; H: number; cx: number; cy: number; R: number; land: boolean; user: Pt } | null = null
  let stirred = false // the water is moving (stir → slow → heal)
  let shown = false
  let first = true
  let job: { cancel(): void } | null = null

  const art = s('svg', { class: 't25m-art', 'aria-hidden': 'true' })
  const refl = h('div', { class: 't25m-refl' }) // deepest: moves most
  const floor = h('div', { class: 't25m-floor' })
  const skin = h('div', { class: 't25m-skin' }) // the surface: moves least
  const water = h('div', { class: 't25m-water' }, refl, floor, skin)
  const canvas = h('canvas', { class: 't25m-frags', 'aria-hidden': 'true' })
  const rim = s('svg', { class: 't25m-rim', 'aria-hidden': 'true' })
  const ai = h('div', { class: 't25m-ai' }, h('p', null, K.aiLine))
  const user = h('p', { class: 't25m-user' }, K.userLine)
  // the guide's dot rides on the ladle's cup
  const cup = h('i', { class: 't25m-cupdot', 'aria-hidden': 'true' })
  const ladle = h('button', { class: 't25m-ladle', type: 'button', 'aria-label': K.stirAria },
    s('svg', { class: 't25m-ladle-art', viewBox: '-100 -30 200 60', 'aria-hidden': 'true' }), cup, h('span', { class: 't25m-ladle-word' }, K.stir))
  const arcWord = s('text', { class: 't25m-arcword' })
  const srcWord = s('text', { class: 't25m-arcsrc' })
  refl.append(ai)
  const root = frame(ctx, 't25m', K.art, [K.insight], layout)
  root.append(art, water, canvas, rim, user, ladle, h('p', { class: 'visually-hidden' }, `${K.fragmentsLabel}: ${K.fragments.join(', ')}`))
  ctx.prompt(K.prompt)
  // guidance (H1 on the cup, a dotted ink circle on the water for the hidden gesture; H7 by the frame + a ladle wiggle)
  const gd = guide(ctx)
  let dot: Mark | null = gd.dot(cup, { dir: [-1, 0] })
  let circ: Mark | null = null
  const wiggle = () => !stirred && !ctx.reduced && ladle.animate([{ rotate: '0deg' }, { rotate: '-4deg' }, { rotate: '3deg' }, { rotate: '0deg' }], { duration: 650, easing: 'ease-in-out' })
  ctx.el.addEventListener('p2:idle', wiggle)
  ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', wiggle))

  // ── fragments: a small atlas of hand-written words of comfort (many voices, not pieces of the answer), drawn once
  // fonts are in
  const words = K.voices
  let atlas: HTMLCanvasElement | null = null
  const cells: [number, number, number, number][] = []
  let col = { ink: '#000', moon: '#fff' }
  tokens(['ink', 'ink-3', 'moon', 'paper'] as const, ctx, (c) => {
    // light: a mid-grey ink, not solid black (a funnel of black words reads as a smear)
    col = { ink: c.ink, moon: document.documentElement.dataset.theme === 'dark' ? c.moon : c['ink-3'] }
    if (!atlas) return
    build()
    if (still) draw(0, 0) // a theme change while the still swirl shows (low / reduced)
  })
  // the first measureText of a font is slow: build the word atlas when the page is idle, not on the first stir
  const ric = window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 200))
  const cic = window.cancelIdleCallback ?? window.clearTimeout
  const warm = ric(() => document.fonts.ready.then(() => !atlas && build()))
  ctx.onCleanup(() => cic(warm))
  let still = false // low / reduced: the swirl drawn once, showing
  function build() {
    const D = Math.min(2, devicePixelRatio || 1)
    const a = document.createElement('canvas')
    const g = a.getContext('2d')!
    const fs = 15
    g.font = `400 ${fs}px "Noto Serif", serif`
    const ws = words.map((w) => Math.ceil(g.measureText(w).width) + 4)
    a.width = Math.ceil(Math.max(...ws) * D)
    a.height = Math.ceil(words.length * (fs + 6) * D)
    g.scale(D, D)
    g.font = `400 ${fs}px "Noto Serif", serif`
    g.fillStyle = col.moon
    g.textBaseline = 'middle'
    cells.length = 0
    words.forEach((w, i) => {
      const y = i * (fs + 6)
      g.fillText(w, 2, y + (fs + 6) / 2)
      cells.push([0, y * D, ws[i] * D, (fs + 6) * D])
    })
    atlas = a
  }
  const frags: Frag[] = []
  const N = live ? 260 : 140
  function seed() {
    const r = rng(2577)
    frags.length = 0
    for (let i = 0; i < N; i++) {
      // home: a spot inside the answer's lines; then out on the funnel
      frags.push({ k: Math.floor(r() * words.length), a: r() * Math.PI * 2, r: 0.25 + r() * 0.75, s: 0.6 + r() * 0.45, w: 0, o: 0, ha: (r() - 0.5) * 0.9, hr: (r() - 0.5) * 0.3, fr: 0 })
    }
  }
  seed()

  // ── the canvas: sized to the water, DPR ≤ 1.5; drawn by the loop while stirring / healing, once when frozen
  const g2 = canvas.getContext('2d')!
  let cw = 0, chh = 0, dpr = 1
  function draw(spin: number, heal: number) {
    if (!G || !atlas) return
    const { R } = G
    g2.setTransform(dpr, 0, 0, dpr, 0, 0)
    g2.clearRect(0, 0, cw, chh)
    const ox = cw / 2, oy = chh / 2
    for (const f of frags) {
      if (f.o <= 0.01) continue
      // spiral position (funnel) blended with the home spot in the answer's lines (heal = 1 → home)
      const sx = ox + Math.cos(f.a) * f.r * R * 0.92, sy = oy + Math.sin(f.a) * f.r * R * 0.92 * TILT
      const hx = ox + f.ha * R * 1.1, hy = oy - R * 0.02 + f.hr * R * 0.5
      const x = lerp(sx, hx, heal), y = lerp(sy, hy, heal)
      const [cx0, cy0, w, hh] = cells[f.k]
      const k = lerp(f.s * (0.3 + f.r * 0.75), 0.7, heal)
      // a funnel, not a coil: faint and large out at the rim, small, dark and packed toward the eye
      g2.globalAlpha = f.o * lerp(lerp(0.85, 0.1, Math.pow(f.r, 0.7)) * (0.5 + f.s * 0.5), 1, heal)
      g2.save()
      g2.translate(x, y)
      g2.rotate(lerp(f.a + Math.PI / 2, 0, heal) + spin * 0)
      g2.drawImage(atlas, cx0, cy0, w, hh, (-w / dpr) * k * 0.5, (-hh / dpr) * k * 0.5, (w / dpr) * k, (hh / dpr) * k)
      g2.restore()
    }
    g2.globalAlpha = 1
  }

  // ── one loop: parallax easing, and the stir (spin-up, funnel, slowing to a frozen swirl) or the healing
  const tgt = { x: 0, y: 0 }, cur = { x: 0, y: 0 }
  let phase: 'idle' | 'stir' | 'slow' | 'heal' = 'idle'
  let pt = 0
  let ladleA = 0
  const loop = createLoop(root, (_t, dt) => {
    let busy = false
    if (Math.abs(tgt.x - cur.x) + Math.abs(tgt.y - cur.y) > 0.002) {
      const f = dt > 0 ? 1 - Math.exp(-dt * 5) : 1
      cur.x += (tgt.x - cur.x) * f
      cur.y += (tgt.y - cur.y) * f
      parallax()
      busy = true
    }
    if (phase !== 'idle' && G) {
      pt += dt
      const R = G.R
      if (phase === 'stir' || phase === 'slow') {
        const u = phase === 'stir' ? Math.min(1, pt / STIR) : 1
        const speed = phase === 'stir' ? 0.4 + u * 2.6 : Math.max(0, 3 - pt * 1.4) // rad/s at the rim
        const ease = phase === 'slow' ? Math.min(1, dt * 2.2) : 0
        for (const f of frags) {
          if (phase === 'stir') f.o = Math.min(1, f.o + dt * 1.5)
          else f.r += (f.fr - f.r) * ease // the swirl slows into a funnel, words spread from the rim down to the eye
          f.a += dt * speed * (1.2 / Math.max(0.12, f.r)) * 0.35 // faster toward the eye
          if (phase === 'stir') {
            f.r -= dt * (0.05 + f.r * 0.12) * u
            if (f.r < 0.08) f.r = 0.9 + Math.random() * 0.1 // swallowed, then thrown out again at the rim
          }
        }
        if (phase === 'stir') {
          ladleA += dt * (1 + u * 3)
          ladle.style.transform = `translate(${f1(Math.cos(ladleA) * R * 0.35)}px, ${f1(Math.sin(ladleA) * R * 0.35 * TILT)}px) rotate(${f1((ladleA * 180) / Math.PI)}deg)`
          rings(u)
        }
        draw(0, 0)
        if (phase === 'stir' && pt >= STIR) {
          phase = 'slow'
          pt = 0
          ;[...frags].sort((p, q) => p.r - q.r).forEach((f, i) => (f.fr = funnelR(i, frags.length)))
          ladle.style.transform = ''
          root.classList.add('frozen') // the rim's words come up as the water slows
        } else if (phase === 'slow' && pt >= SLOW) {
          // the water stills: the words of comfort sink back together into the answer
          phase = 'heal'
          pt = 0
          rings(0)
        }
      } else if (phase === 'heal') {
        const u = Math.min(1, pt / HEAL), e = u * u * (3 - 2 * u)
        draw(0, e)
        for (const f of frags) f.o = u < 0.6 ? f.o : Math.max(0, 1 - (u - 0.6) / 0.4)
        if (u >= 0.55 && !back) (back = true), root.classList.remove('stirred') // the answer shows through as they gather
        if (u >= 1) {
          phase = 'idle'
          g2.clearRect(0, 0, cw, chh)
          settle()
        }
      }
      busy = busy || phase !== 'idle'
    }
    return busy
  })
  ctx.onCleanup(() => loop.dispose())

  function parallax() {
    const k = G ? G.R * 0.07 : 10
    refl.style.transform = `translate(${f1(cur.x * k)}px, ${f1(cur.y * k)}px)`
    floor.style.transform = `translate(${f1(cur.x * k * 0.45)}px, ${f1(cur.y * k * 0.45)}px)`
    skin.style.transform = `translate(${f1(cur.x * k * 0.15)}px, ${f1(cur.y * k * 0.15)}px)`
  }
  function rings(u: number) {
    root.style.setProperty('--swirl', u.toFixed(2))
  }
  /** the water is still again and the answer whole: the insight (the first time), the ladle ready for another stir */
  function settle() {
    stirred = false
    root.classList.remove('stirred')
    ladle.removeAttribute('aria-disabled')
    if (!shown) {
      shown = true
      ctx.insight(F(K.insight), K.detail)
    }
  }

  // ── stir (the ladle, or a circling finger): it dissolves, swirls, slows, and settles back by itself
  let wait = 0
  let back = false
  ctx.onCleanup(() => clearTimeout(wait))
  function stir() {
    if (!G || stirred) return
    stirred = true
    back = false
    root.classList.add('stirred')
    ladle.setAttribute('aria-disabled', 'true')
    ctx.chime('soft')
    dot?.done()
    circ?.done()
    dot = circ = null
    if (!atlas) build()
    seed()
    if (!live) {
      // low / reduced: the still swirl, drawn once (crossfade by CSS), then the water settles back
      frags.forEach((f, i) => {
        // a still funnel: words spread from the rim down to the eye, wound tighter as they go
        f.o = i % 2 ? 1 : 0
        f.r = funnelR(i, frags.length)
        f.a += (1 - f.r) * 9
      })
      still = true
      draw(0, 0)
      root.style.setProperty('--swirl', '1')
      root.classList.add('frozen')
      wait = window.setTimeout(() => {
        still = false
        g2.clearRect(0, 0, cw, chh)
        root.style.setProperty('--swirl', '0')
        settle()
      }, 2600)
      return
    }
    for (const f of frags) {
      // they rise out of the answer's lines
      f.o = 0
      f.r = 0.35 + Math.abs(f.ha) * 0.6
      f.a = f.ha > 0 ? -0.2 + f.hr : Math.PI + f.hr
    }
    phase = 'stir'
    pt = 0
    loop.start()
  }
  ladle.addEventListener('click', stir)
  // circle on the water: a full turn of the pointer around the basin's centre stirs it
  let turn: { a: number; sum: number; id: number } | null = null
  water.addEventListener('pointerdown', (e) => {
    if (!G) return
    const b = root.getBoundingClientRect()
    turn = { a: Math.atan2(e.clientY - b.top - G.cy, e.clientX - b.left - G.cx), sum: 0, id: e.pointerId }
    water.setPointerCapture(e.pointerId)
  })
  water.addEventListener('pointermove', (e) => {
    if (!G) return
    const b = root.getBoundingClientRect()
    const mx = e.clientX - b.left, my = e.clientY - b.top
    if (e.pointerType === 'mouse' && !turn) {
      tgt.x = clamp((mx - G.cx) / G.R, -1, 1)
      tgt.y = clamp((my - G.cy) / G.R, -1, 1)
      if (!ctx.reduced) loop.start()
    }
    if (!turn || e.pointerId !== turn.id) return
    const a = Math.atan2(my - G.cy, mx - G.cx)
    let d = a - turn.a
    if (d > Math.PI) d -= Math.PI * 2
    if (d < -Math.PI) d += Math.PI * 2
    turn.sum += d
    turn.a = a
    if (Math.abs(turn.sum) > Math.PI * 1.6) {
      turn = null
      stir()
    }
  })
  const endTurn = () => (turn = null)
  water.addEventListener('pointerup', endTurn)
  water.addEventListener('pointercancel', endTurn)
  root.addEventListener('pointerleave', () => {
    tgt.x = tgt.y = 0
    if (!ctx.reduced) loop.start()
  })
  if (!ctx.reduced) {
    let g0: [number, number] | null = null
    const tilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return
      g0 ??= [e.gamma, e.beta]
      tgt.x = clamp((e.gamma - g0[0]) / 18, -1, 1)
      tgt.y = clamp((e.beta - g0[1]) / 18, -1, 1)
      loop.start()
    }
    addEventListener('deviceorientation', tilt)
    ctx.onCleanup(() => removeEventListener('deviceorientation', tilt))
  }
  // the bamboo spout lets a drop fall now and then (high only; asleep after 10 s without input)
  ambient(ctx, root, (on) => root.classList.toggle('drip', on))

  // ── painting
  function layout(W: number, H: number) {
    const land = W / H > 1.05
    // the whole basin (rim, its outer side and cast shadow) fits the frame with a margin
    const R = land ? H * 0.315 : Math.min(W * 0.335, H * 0.3)
    const cx = W * 0.5, cy = H * (land ? 0.49 : 0.46)
    // the user's line rises from the near lip; its box (width, top) keeps the five words off it
    const userTop = cy + R * TILT * (land ? 0.7 : 0.66)
    G = { W, H, cx, cy, R, land, user: [R * 1.5, userTop] }
    root.classList.toggle('land', land)
    art.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    rim.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    const box = { left: `${f1(cx - R)}px`, top: `${f1(cy - R * TILT)}px`, width: `${f1(R * 2)}px`, height: `${f1(R * 2 * TILT)}px` }
    Object.assign(water.style, box)
    Object.assign(canvas.style, box)
    dpr = Math.min(1.5, devicePixelRatio || 1)
    cw = R * 2
    chh = R * 2 * TILT
    canvas.width = Math.round(cw * dpr)
    canvas.height = Math.round(chh * dpr)
    Object.assign(ai.style, { width: `${f1(R * 1.25)}px`, left: `${f1(R - R * 0.625)}px`, top: `${f1(R * TILT - R * 0.05)}px` })
    Object.assign(user.style, { left: `${f1(cx - R * 0.75)}px`, width: `${f1(R * 1.5)}px`, top: `${f1(userTop)}px` })
    // the ladle rests across the rim on the right (phone: across the near rim)
    Object.assign(ladle.style, land
      ? { left: `${f1(cx + R * 0.86)}px`, top: `${f1(cy + R * TILT * 0.18)}px`, width: `${f1(R * 1.0)}px`, height: `${f1(R * 0.3)}px` }
      : { left: `${f1(cx + R * 0.05)}px`, top: `${f1(cy + R * TILT * 1.06)}px`, width: `${f1(R * 1.05)}px`, height: `${f1(R * 0.32)}px` })
    job?.cancel()
    job = sliced(paint(cx, cy, R, land), { sync: ctx.reduced || !first })
    first = false
    if (still && atlas) draw(0, 0)
    if (!circ && !shown && !stirred) circ = gd.gesture('circle', () => (G ? [G.cx, G.cy] : [0, 0]), { r: Math.round(Math.min(110, R * 0.42)) })
  }

  function* paint(cx: number, cy: number, R: number, land: boolean) {
    const r = rng(2531)
    const Ry = R * TILT
    const RO = R * (land ? 1.45 : 1.38), ROy = RO * TILT // the basin's outer edge: the whole stone sits in the frame
    const side = R * 0.1 // the outer side of the stone, seen below its top on the near half
    const outer = blob(cx, cy, RO, ROy, 2537, 0.035, 28)
    const outerSide = blob(cx, cy + side, RO * 0.995, ROy, 2537, 0.035, 28)
    // ground round the basin: gravel in a soft wash; the basin's shadow falls away from the moon (down-left)
    let gravel = ''
    for (let i = 0; i < 220; i++) {
      const a = r() * Math.PI * 2, d = 1.0 + r() * 0.75
      gravel += blob(cx + Math.cos(a) * RO * d * 1.1, cy + side + Math.sin(a) * ROy * d, 2 + r() * 3, 1.5 + r() * 2.2, i, 0.25, 6)
    }
    const post: Pt = land ? [cx - RO * 1.04, cy - ROy * 0.42] : [cx - RO * 0.8, cy - ROy * 0.78]
    art.replaceChildren(
      s('defs', null,
        s('radialGradient', { id: 't25m-lit', cx: 0.65, cy: 0.3, r: 0.75 }, s('stop', { offset: 0, class: 't25m-g0' }), s('stop', { offset: 1, class: 't25m-g1' }))),
      s('ellipse', { class: 't25m-sea', cx: f1(cx), cy: f1(cy + ROy * 0.08), rx: f1(RO * 1.7), ry: f1(ROy * 1.6), fill: 'url(#t25m-lit)' }),
      s('path', { class: 't25m-gravel', d: gravel }),
      s('path', { class: 't25m-outer-sh', d: blob(cx - RO * 0.07, cy + side + ROy * 0.07, RO * 1.03, ROy * 1.03, 2538, 0.035, 28), filter: 'url(#ink-wash)' }),
      // moss cushions on the ground hugging the stone's foot (a darker underside, a lit crown)
      s('path', { class: 't25m-moss-dk', d: blob(cx - RO * 0.86, cy + ROy * 0.74, RO * 0.2, ROy * 0.09, 2540, 0.35) + blob(cx + RO * 0.9, cy + ROy * 0.5, RO * 0.12, ROy * 0.06, 2541, 0.35) + blob(cx + RO * 0.62, cy - ROy * 0.86, RO * 0.12, ROy * 0.05, 2546, 0.35), filter: 'url(#ink-wash)' }),
      s('path', { class: 't25m-moss', d: blob(cx - RO * 0.87, cy + ROy * 0.71, RO * 0.17, ROy * 0.065, 2540, 0.35) + blob(cx + RO * 0.9, cy + ROy * 0.48, RO * 0.1, ROy * 0.045, 2541, 0.35) + blob(cx + RO * 0.62, cy - ROy * 0.875, RO * 0.1, ROy * 0.035, 2546, 0.35), filter: 'url(#ink-rough)' }))
    yield

    // the water's three depths
    const wsvg = (cls: string, ...kids: (SVGElement | null)[]) => s('svg', { class: cls, viewBox: `${f1(-R)} ${f1(-Ry)} ${f1(R * 2)} ${f1(Ry * 2)}`, 'aria-hidden': 'true' }, ...kids)
    // deepest: the reflection — the night sky, the moon upper right, a bamboo sprig, the one who leans over (no face),
    // big and dark: it fills the lower half of the water
    const head: Pt = [R * 0.04, Ry * 0.4]
    const person = `M${f1(-R * 1.05)} ${f1(Ry * 1.2)}Q${f1(-R * 0.86)} ${f1(Ry * 0.72)} ${f1(-R * 0.4)} ${f1(Ry * 0.64)}Q${f1(-R * 0.16)} ${f1(Ry * 0.6)} ${f1(head[0] - R * 0.16)} ${f1(head[1] + Ry * 0.14)}` +
      `Q${f1(head[0] - R * 0.3)} ${f1(head[1] - Ry * 0.16)} ${f1(head[0])} ${f1(head[1] - Ry * 0.28)}Q${f1(head[0] + R * 0.28)} ${f1(head[1] - Ry * 0.22)} ${f1(head[0] + R * 0.18)} ${f1(head[1] + Ry * 0.12)}` +
      `Q${f1(R * 0.38)} ${f1(Ry * 0.6)} ${f1(R * 0.66)} ${f1(Ry * 0.68)}Q${f1(R * 1.0)} ${f1(Ry * 0.78)} ${f1(R * 1.1)} ${f1(Ry * 1.2)}Z`
    const sprig: SVGElement[] = []
    const stem = curve([-R * 1.08, -Ry * 0.58], [-R * 0.55, -Ry * 0.74], [-R * 0.12, -Ry * 0.46], 12)
    const sp = bamboo(stem[0], stem[stem.length - 1], Math.max(3, R * 0.024), 2547, 2)
    sprig.push(s('path', { class: 't25m-sprig', d: sp.cane }))
    for (let i = 0; i < 8; i++) {
      const p = stem[2 + i], lf = leaf(p[0], p[1], R * (0.17 + r() * 0.09), (i % 2 ? 0.7 : -0.6) + r() * 0.5, 2548 + i)
      sprig.push(s('path', { class: 't25m-sprig', d: lf.blade }))
    }
    const mx = R * 0.5, my = -Ry * 0.48, mr = R * 0.1
    refl.querySelector('svg')?.remove()
    refl.prepend(wsvg('t25m-reflsvg',
      s('defs', null, s('radialGradient', { id: 't25m-sky' }, s('stop', { offset: 0, class: 't25m-s0' }), s('stop', { offset: 1, class: 't25m-s1' })),
        s('radialGradient', { id: 't25m-halo' }, s('stop', { offset: 0, class: 't25m-h0' }), s('stop', { offset: 1, class: 't25m-h1' }))),
      s('rect', { x: f1(-R * 1.3), y: f1(-Ry * 1.3), width: f1(R * 2.6), height: f1(Ry * 2.6), class: 't25m-deep' }),
      s('ellipse', { cx: f1(mx * 0.6), cy: f1(my * 0.4), rx: f1(R * 1.0), ry: f1(Ry * 0.9), fill: 'url(#t25m-sky)' }),
      s('circle', { cx: f1(mx), cy: f1(my), r: f1(mr * 4), fill: 'url(#t25m-halo)' }),
      s('circle', { class: 't25m-moon', cx: f1(mx), cy: f1(my), r: f1(mr) }),
      ...sprig,
      s('path', { class: 't25m-person', d: person, filter: 'url(#ink-wash)' })))
    // the bottom: pebbles and three old coins, dim through the water; the floating things' soft shadows lie on it
    let pebbles = '', pebLit = ''
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.86, x = Math.cos(a) * R * d, y = Math.sin(a) * Ry * d, rx = R * (0.03 + r() * 0.04), ry = R * (0.022 + r() * 0.03)
      pebbles += blob(x, y, rx, ry, 2560 + i, 0.15, 10)
      pebLit += blob(x + rx * 0.2, y - ry * 0.3, rx * 0.55, ry * 0.4, 2590 + i, 0.2, 8)
    }
    const coins = [[-0.32, 0.36], [0.4, 0.22], [0.12, -0.42]].map(([u, v], i) => s('g', { class: 't25m-coin' },
      s('circle', { cx: f1(u * R), cy: f1(v * Ry), r: f1(R * 0.045) }),
      s('rect', { x: f1(u * R - R * 0.012), y: f1(v * Ry - R * 0.012), width: f1(R * 0.024), height: f1(R * 0.024), class: 't25m-hole', transform: `rotate(${i * 20} ${f1(u * R)} ${f1(v * Ry)})` })))
    // (off the answer's lines: x ±0.62, y −0.05 … 0.3)
    const FL: [number, number, number, number][] = [[-0.66, -0.42, 0.22, 0.4], [-0.5, 0.56, 0.16, -1.1], [0.66, 0.44, 0.2, 2.2], [0.22, -0.66, 0.14, 0.9]]
    const PT: [number, number, number][] = Array.from({ length: 6 }, () => [(r() - 0.5) * R * 1.3, (r() - 0.5) * Ry * 1.3, r() * 180])
    let fsh = ''
    for (const [u, v, k, rot] of FL) fsh += maple(u * R + R * 0.07, v * Ry + R * 0.11, R * k * 1.08, rot).outline
    for (const [x, y, a] of PT) fsh += petal(x + R * 0.06, y + R * 0.1, R * 0.034, a).body
    floor.replaceChildren(wsvg('t25m-floorsvg', s('path', { class: 't25m-pebbles', d: pebbles }), s('path', { class: 't25m-peblit', d: pebLit }), ...coins,
      s('path', { class: 't25m-float-sh', d: fsh, filter: 'url(#ink-wash)' })))
    // the skin: maple leaves (two tones, veins, a stem) and petals afloat, the drip's rings, faint ripples for the swirl
    const floats: SVGElement[] = []
    FL.forEach(([u, v, k, rot], i) => {
      const m = maple(u * R, v * Ry, R * k, rot)
      floats.push(s('path', { class: i === 2 ? 't25m-maple red' : 't25m-maple', d: m.outline, filter: 'url(#ink-rough)' }),
        s('path', { class: 't25m-maple-dk', d: m.half }), s('path', { class: 't25m-vein', d: m.veins }))
    })
    for (const [x, y, a] of PT) {
      const pt = petal(x, y, R * 0.032, a)
      floats.push(s('path', { class: 't25m-petal', d: pt.body }), s('path', { class: 't25m-petal-dk', d: pt.base }))
    }
    const drip: Pt = [-R * 0.62, -Ry * 0.38]
    const ripple = (k: number, seed: number) => broken(Array.from({ length: 49 }, (_, j) => {
      const a = (j / 48) * Math.PI * 2
      return [Math.cos(a) * R * k * (1 + Math.sin(a * 3 + seed) * 0.02), Math.sin(a) * Ry * k] as Pt
    }), Math.max(1, R * 0.007), seed, 0.6, 5)
    skin.replaceChildren(wsvg('t25m-skinsvg',
      s('defs', null, s('radialGradient', { id: 't25m-eye' }, s('stop', { offset: 0, class: 't25m-e0' }), s('stop', { offset: 1, class: 't25m-e1' }))),
      s('ellipse', { class: 't25m-eye', cx: 0, cy: 0, rx: f1(R * 0.62), ry: f1(Ry * 0.62), fill: 'url(#t25m-eye)' }),
      s('path', { class: 't25m-swirl', d: ripple(0.22, 1) + ripple(0.4, 2) + ripple(0.6, 3) + ripple(0.8, 4) }),
      // where the spout's drop meets the water: two faint rings always, a falling drop and fresh rings when awake
      s('path', { class: 't25m-drip-still', d: broken(curve([drip[0] - R * 0.07, drip[1]], [drip[0], drip[1] + Ry * 0.09], [drip[0] + R * 0.07, drip[1]], 10), Math.max(1, R * 0.006), 7, 0.9, 4) + broken(curve([drip[0] - R * 0.12, drip[1] + Ry * 0.01], [drip[0], drip[1] + Ry * 0.15], [drip[0] + R * 0.12, drip[1] + Ry * 0.01], 12), Math.max(1, R * 0.005), 8, 0.7, 4) }),
      s('g', { class: 't25m-drop-rings' }, ...[0, 1, 2].map((i) => s('ellipse', { cx: f1(drip[0]), cy: f1(drip[1]), rx: f1(R * 0.06), ry: f1(Ry * 0.06), style: `--i:${i}` }))),
      ...floats))
    yield

    // the rim, granite with form: a lit top plane (lit from the moon, upper right, falling off to the lower left), the
    // outer side showing below it on the near half, the far inner wall in shadow with a lit lip on the moon side,
    // soft mottling and a few flecks (no noise), cracks with moss in them; the near edge softened by a baked gradient
    const arcId = nextId('t25m-arc')
    // the word runs round the upper right of the rim's top, clear of the bamboo
    const RA = (R + RO) / 2 * 1.02
    const aP = (deg: number): Pt => [cx + Math.cos((deg * Math.PI) / 180) * RA, cy + Math.sin((deg * Math.PI) / 180) * RA * TILT]
    const [a0, a1] = land ? [aP(282), aP(338)] : [aP(254), aP(352)]
    const arc = `M${f1(a0[0])} ${f1(a0[1])}A${f1(RA)} ${f1(RA * TILT)} 0 0 1 ${f1(a1[0])} ${f1(a1[1])}`
    // the five sources, small, on the rim's inner band below it (a wider sweep, from the spout round to the ladle)
    const RS = lerp(R, RO, 0.24)
    const aS = (deg: number): Pt => [cx + Math.cos((deg * Math.PI) / 180) * RS, cy + Math.sin((deg * Math.PI) / 180) * RS * TILT]
    const [s0, s1] = land ? [aS(236), aS(356)] : [aS(222), aS(362)]
    const arcS = `M${f1(s0[0])} ${f1(s0[1])}A${f1(RS)} ${f1(RS * TILT)} 0 0 1 ${f1(s1[0])} ${f1(s1[1])}`
    const ocx = cx, ocy = cy - Ry * 0.07, oR = R * 1.035, oRy = Ry * 1.06
    const hole = `M${f1(ocx - oR)} ${f1(ocy)}a${f1(oR)} ${f1(oRy)} 0 1 1 ${f1(oR * 2)} 0a${f1(oR)} ${f1(oRy)} 0 1 1 ${f1(-oR * 2)} 0Z`
    const onRing = (a: number, d: number): Pt => [cx + Math.cos(a) * lerp(oR, RO, d), cy + Math.sin(a) * lerp(oRy, ROy, d) - Ry * 0.035 * (1 - d)]
    let cracks = '', crackMoss = ''
    for (let i = 0; i < 9; i++) {
      const a = r() * Math.PI * 2, d0 = 0.08 + r() * 0.2, d1 = Math.min(0.98, d0 + 0.3 + r() * 0.4)
      const pts = curve(onRing(a, d0), onRing(a + 0.05, (d0 + d1) / 2), onRing(a + 0.02, d1), 6)
      cracks += stroke(pts, 1.2 + r() * 1.6, 0.2, 0.4, 0.1)
      if (i % 2 === 0) for (const p of pts.slice(1, 6)) if (r() < 0.7) crackMoss += blob(p[0], p[1], R * (0.012 + r() * 0.018), R * (0.008 + r() * 0.01), 2600 + i * 9 + Math.round(p[0]), 0.35, 8)
    }
    let mottle = '', mottleLt = '', flecks = '', flecksLt = ''
    for (let i = 0; i < 18; i++) {
      const [x, y] = onRing(r() * Math.PI * 2, 0.15 + r() * 0.7)
      const d = blob(x, y, R * (0.06 + r() * 0.1), R * (0.03 + r() * 0.05), 2610 + i, 0.3, 10)
      if (i % 2) mottle += d
      else mottleLt += d
    }
    for (let i = 0; i < 150; i++) {
      const [x, y] = onRing(r() * Math.PI * 2, 0.04 + r() * 0.94)
      const d = blob(x, y, 0.6 + r() * 1.2, 0.5 + r() * 0.9, i, 0.2, 6)
      if (i % 3) flecks += d
      else flecksLt += d
    }
    let chisel = '' // dry chisel marks round the lip
    for (let i = 0; i < 30; i++) {
      const a = r() * Math.PI * 2, [x, y] = onRing(a, 0.05 + r() * 0.5)
      chisel += stroke([[x, y], [x + Math.cos(a + 1.6) * R * 0.05, y + Math.sin(a + 1.6) * Ry * 0.05]], 1.4 + r() * 2, 0.3, 0.4, 0.1)
    }
    // the kakei: an upright bamboo post and a spout reaching over the water, shaded as cylinders
    const spoutTip: Pt = [cx + drip[0] - R * 0.02, cy + drip[1] - Ry * 0.3]
    const cw = Math.max(9, R * 0.075)
    const upright = cylinder([post[0], post[1] + ROy * (land ? 0.95 : 0.55)], [post[0] + 2, post[1] - ROy * 0.12], cw * 1.25, 2533, [0.32, 0.7], 'b', [-cw * 0.5, cw * 0.4])
    const pipe = cylinder([post[0] + cw * 0.2, post[1] + ROy * 0.02], spoutTip, cw, 2534, [0.4], 'b', [-cw * 0.6, cw * 0.9])
    arcWord.replaceChildren(s('textPath', { href: `#${arcId}`, startOffset: '50%', 'text-anchor': 'middle' }, K.fragmentsLabel))
    srcWord.replaceChildren(s('textPath', { href: `#${arcId}s`, startOffset: '50%', 'text-anchor': 'middle' }, K.fragments.join(' · ')))
    const lipPts = (a0: number, a1: number) => Array.from({ length: 25 }, (_, i) => {
      const a = Math.PI * lerp(a0, a1, i / 24)
      return [ocx + Math.cos(a) * oR, ocy + Math.sin(a) * oRy] as Pt
    })
    rim.replaceChildren(
      s('defs', null,
        s('path', { id: arcId, d: arc }),
        s('path', { id: `${arcId}s`, d: arcS }),
        s('radialGradient', { id: 't25m-granite', cx: 0.7, cy: 0.12, r: 1.05 }, s('stop', { offset: 0, style: 'stop-color:var(--rock-hi)' }), s('stop', { offset: 0.5, style: 'stop-color:var(--rock-mid)' }), s('stop', { offset: 1, style: 'stop-color:var(--rock-lo)' })),
        s('linearGradient', { id: 't25m-sideg', x1: 0, y1: 0, x2: 1, y2: 0 }, s('stop', { offset: 0, style: 'stop-color:var(--umbra);stop-opacity:.85' }), s('stop', { offset: 0.5, style: 'stop-color:var(--rock-lo)' }), s('stop', { offset: 1, style: 'stop-color:var(--rock-mid)' })),
        s('linearGradient', { id: 't25m-wallg', gradientUnits: 'userSpaceOnUse', x1: 0, y1: f1(ocy - oRy), x2: 0, y2: f1(cy - Ry * 0.6) }, s('stop', { offset: 0, style: 'stop-color:var(--rock-lo)' }), s('stop', { offset: 0.5, style: 'stop-color:var(--umbra);stop-opacity:.75' }), s('stop', { offset: 1, style: 'stop-color:var(--umbra)' })),
        s('linearGradient', { id: 't25m-near', x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0.72, class: 't25m-n0' }), s('stop', { offset: 1, class: 't25m-n1' }))),
      // the outer side (near half), then the top plane over it, the hole cut out (even-odd)
      s('path', { class: 't25m-side', d: outerSide + hole, 'fill-rule': 'evenodd', fill: 'url(#t25m-sideg)' }),
      s('path', { class: 't25m-side-dk', d: outerSide + hole, 'fill-rule': 'evenodd' }),
      s('path', { class: 't25m-granite', d: outer + hole, 'fill-rule': 'evenodd', fill: 'url(#t25m-granite)' }),
      s('g', { class: 't25m-texture' },
        s('path', { class: 't25m-mottle', d: mottle, filter: 'url(#ink-wash)' }),
        s('path', { class: 't25m-mottle-lt', d: mottleLt, filter: 'url(#ink-wash)' }),
        s('path', { class: 't25m-fleck', d: flecks }),
        s('path', { class: 't25m-fleck-lt', d: flecksLt }),
        s('path', { class: 't25m-chisel', d: chisel, filter: 'url(#ink-dry)' }),
        s('path', { class: 't25m-crack', d: cracks, filter: 'url(#ink-rough)' }),
        s('path', { class: 't25m-crackmoss', d: crackMoss }),
        s('path', { class: 't25m-moss', d: blob(cx - RO * 0.74, cy + ROy * 0.6, RO * 0.14, ROy * 0.06, 2542, 0.4) + blob(cx + RO * 0.5, cy - ROy * 0.82, RO * 0.12, ROy * 0.045, 2543, 0.4) + blob(cx - RO * 0.86, cy - ROy * 0.22, RO * 0.05, ROy * 0.07, 2545, 0.4), filter: 'url(#ink-wash)' })),
      s('path', { class: 't25m-edge', d: stroke(Array.from({ length: 29 }, (_, i) => {
        const a = Math.PI * (0.02 + i * 0.034)
        return [cx + Math.cos(a) * RO * 0.998, cy + Math.sin(a) * ROy * 0.998] as Pt
      }), Math.max(1.4, R * 0.012), 0.2, 0.2, 0.2), filter: 'url(#ink-rough)' }),
      s('path', { d: outerSide + hole, 'fill-rule': 'evenodd', fill: 'url(#t25m-near)' }),
      // the far inner wall between the lip and the water: in shadow, darkest at the waterline; a wet sheen where they meet
      s('path', { class: 't25m-wall', d: `${hole}M${f1(cx - R)} ${f1(cy)}a${f1(R)} ${f1(Ry)} 0 1 0 ${f1(R * 2)} 0a${f1(R)} ${f1(Ry)} 0 1 0 ${f1(-R * 2)} 0Z`, 'fill-rule': 'evenodd', fill: 'url(#t25m-wallg)' }),
      s('path', { class: 't25m-sheen', d: stroke(Array.from({ length: 17 }, (_, i) => {
        const a = Math.PI * (1.15 + i * 0.044)
        return [cx + Math.cos(a) * R * 0.995, cy + Math.sin(a) * Ry * 0.995] as Pt
      }), Math.max(1, R * 0.008), 0.3, 0.3, 0.1) }),
      // the lip: lit on the moon's side, ink on the side away from it
      s('path', { class: 't25m-lip', d: stroke(lipPts(1.45, 2.06), R * 0.024, 0.3, 0.2, 0.12) }),
      s('path', { class: 't25m-lip-dk', d: stroke(lipPts(0.12, 1.1), R * 0.016, 0.25, 0.25, 0.15), filter: 'url(#ink-rough)' }),
      ...upright, ...pipe,
      s('g', { class: 't25m-drop', style: `--fall:${f1(Ry * 0.3)}px` }, s('ellipse', { cx: f1(spoutTip[0] + 2), cy: f1(spoutTip[1] + 6), rx: 2.2, ry: 3.2 })),
      s('ellipse', { class: 't25m-bead', cx: f1(spoutTip[0] + 1), cy: f1(spoutTip[1] + cw * 0.5), rx: f1(cw * 0.16), ry: f1(cw * 0.22) }),
      arcWord, srcWord)
    // the ladle: a bamboo handle and cup, shaded as cylinders, its shadow on the stone
    ladle.querySelector('svg')!.replaceChildren(
      s('path', { class: 't25m-ladle-sh', d: stroke([[-92, 14], [-10, 12], [60, 10]], 8, 0.05, 0.05, 0.8) + blob(70, 16, 22, 10, 2539, 0.1, 12), filter: 'url(#ink-wash)' }),
      ...cylinder([-88, 4], [55, -1], 7, 2535, [0.3, 0.68], 'a', null),
      // the cup: its side (a short cylinder standing up), the rim's top, the dark hollow, moonlight on the far lip
      s('path', { class: 't25m-cup', d: `M54 -4L54 8A20 9 0 0 0 94 8L94 -4Z` }),
      s('path', { class: 't25m-cup-dk', d: `M54 -4L54 8A20 9 0 0 0 64 15.5L64 3Z` }),
      s('path', { class: 't25m-cup-lt', d: `M85 3.5L85 15.5A20 9 0 0 0 90 13L90 1Z` }),
      s('ellipse', { class: 't25m-cup-top', cx: 74, cy: -4, rx: 20, ry: 9 }),
      s('ellipse', { class: 't25m-cup-in', cx: 74, cy: -3.4, rx: 16.5, ry: 6.8 }),
      s('path', { class: 't25m-cup-rim', d: stroke(Array.from({ length: 9 }, (_, i) => [74 + Math.cos(Math.PI * (1.15 + i * 0.09)) * 19, -4 + Math.sin(Math.PI * (1.15 + i * 0.09)) * 8.4] as Pt), 1.8, 0.3, 0.3, 0.15) }))
  }

  /** a maple leaf round (x, y), L across, turned by rot: five pointed lobes, the shaded half, five veins and a stem */
  function maple(x: number, y: number, L: number, rot: number) {
    const pts: Pt[] = []
    const P = (a: number, rr: number): Pt => [x + Math.cos(a + rot) * rr, y + Math.sin(a + rot) * rr * TILT]
    for (let i = 0; i <= 60; i++) {
      const t = (i / 60) * Math.PI * 2
      // pointed lobes with a little tooth on each flank; the gap at the stem
      const lobe = 0.5 + 0.5 * Math.pow(Math.abs(Math.cos(t * 2.5)), 1.3) + 0.05 * Math.abs(Math.sin(t * 12.5))
      pts.push(P(t, L * 0.5 * lobe * (t > Math.PI * 0.82 && t < Math.PI * 1.18 ? 0.45 : 1)))
    }
    const half = pts.slice(0, 31)
    let veins = ''
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + (k > 2 ? 0.25 : 0)
      if (Math.abs(a - Math.PI) < 0.4) continue
      veins += stroke([P(0, 0), P(a, L * 0.22), P(a, L * 0.44)], Math.max(0.6, L * 0.022), 0.05, 0.6, 0.2)
    }
    veins += stroke([P(0, 0), P(Math.PI, L * 0.3), P(Math.PI + 0.15, L * 0.5)], Math.max(0.8, L * 0.035), 0.05, 0.4, 0.4)
    return { outline: `M${pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')}Z`, half: `M${f1(x)} ${f1(y)}L${half.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')}Z`, veins }
  }

  /** a cherry petal round (x, y): a notched tip, a darker base */
  function petal(x: number, y: number, L: number, deg: number) {
    const a = (deg * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a)
    const T = (u: number, v: number) => `${f1(x + u * c - v * sn)} ${f1(y + (u * sn + v * c) * TILT)}`
    return {
      body: `M${T(-L, 0)}Q${T(-L * 0.2, -L * 0.75)} ${T(L * 0.85, -L * 0.3)}L${T(L * 0.6, 0)}L${T(L * 0.85, L * 0.3)}Q${T(-L * 0.2, L * 0.75)} ${T(-L, 0)}Z`,
      base: `M${T(-L, 0)}Q${T(-L * 0.5, -L * 0.35)} ${T(-L * 0.15, 0)}Q${T(-L * 0.5, L * 0.35)} ${T(-L, 0)}Z`,
    }
  }

}
