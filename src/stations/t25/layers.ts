import './layers.css'
import { h, s } from '../../core/dom'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import { blob, clamp, curve, onDigit, rng, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist, moon, pine, reeds } from '../../ui/part2/paint'
import { guide, type Mark } from '../../ui/part2/guide'
import type { SceneCtx } from '../types'
import C from '../../content/tram-25.json'
import { broken, cursive, glyph, leaf } from './kit'
import { F, ambient, f1, frame, lerp } from './art'

const K = C.scenes.layers
// how fast each layer slides when the camera sinks (sky far → silt near): the parallax of the descent
const RATE = { sky: 0.32, surf: 0.8, rays: 0.9, weed: 1.22, mid: 1, silt: 1.5 }
type Layer = keyof typeof RATE
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

/** A pebble (flat / egg / round and heavy) with real volume: contact shadow, body, a moonlit crown, a dark belly. */
function pebbleArt(kind: number, r: number, seed: number): SVGElement[] {
  const [rx, ry] = kind === 0 ? [r * 1.25, r * 0.42] : kind === 1 ? [r * 0.82, r * 0.62] : [r, r * 0.86]
  return [
    s('ellipse', { class: 't25l-pb-sh', cx: f1(-rx * 0.15), cy: f1(ry * 0.92), rx: f1(rx * 1.1), ry: f1(Math.max(2, ry * 0.22)) }),
    s('path', { class: 't25l-pb', d: blob(0, 0, rx, ry, seed, 0.05, 14), fill: 'url(#t25l-stone)' }),
    s('path', { class: 't25l-pb-lo', d: blob(-rx * 0.08, ry * 0.18, rx * 0.92, ry * 0.8, seed + 1, 0.05, 14), fill: 'url(#t25l-belly)' }),
    s('path', { class: 't25l-pb-hi', d: stroke([[rx * 0.05, -ry * 0.72], [rx * 0.42, -ry * 0.62], [rx * 0.7, -ry * 0.3]], Math.max(1.4, ry * 0.18), 0.3, 0.4, 0.1) }),
    s('path', { class: 't25l-pb-ink', d: stroke(Array.from({ length: 9 }, (_, i) => [Math.cos(Math.PI * (0.15 + i * 0.09)) * rx * 0.98, Math.sin(Math.PI * (0.15 + i * 0.09)) * ry * 0.95] as Pt), Math.max(1.2, r * 0.1), 0.3, 0.3, 0.1) }),
  ]
}

type Slab = ReturnType<typeof slabGeo>
/** The slab on the near bank, x0 … x1 (it runs off the left edge): F = front edge of its top plane, B = back edge, mid = where pebbles sit. */
function slabGeo(x0: number, x1: number, top: number, wl: number, th: number) {
  const ax = x0 + (x1 - x0) * 0.02, bx = x1 - (x1 - x0) * 0.07
  const c = (ax + bx) / 2, half = (bx - ax) / 2
  // a slow swell, and the right end tipping toward the water
  const F = (x: number) => top + th * 0.5 + Math.sin(x * 0.019 + 1.3) * th * 0.16 + Math.max(0, (x - lerp(ax, bx, 0.7)) / (bx - ax)) * th * 1.6
  const depth = (x: number) => th * Math.sqrt(Math.max(0, 1 - ((x - c) / half) ** 2)) * 0.85 + th * 0.15
  return { x0, x1, ax, bx, wl, th, F, B: (x: number) => F(x) - depth(x), mid: (x: number) => F(x) - depth(x) * 0.48 }
}

/**
 * The slab in three tones (lit top plane, mid front face, dark left flank and belly), moss on the top and creeping over
 * its lip, an ink edge, the moon on its back edge and right shoulder, a wet line and contact shadow at the water, its
 * wavering reflection under the skin, and the damp ghosts the pebbles leave once they are used.
 */
function slabArt(g: Slab, H: number, home: Pt[], pr: number): SVGElement[] {
  const { x0, x1, ax, bx, wl, th, F, B } = g
  const r = rng(2563)
  const sw = x1 - x0
  const xs = Array.from({ length: 41 }, (_, i) => lerp(ax, bx, i / 40))
  const front = xs.map((x) => [x, F(x)] as Pt), back = xs.map((x) => [x, B(x)] as Pt)
  const P = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`
  const fb = F(bx)
  const top = `M${front.map(P).join('L')}L${[...back].reverse().map(P).join('L')}Z`
  const face = `M${front.map(P).join('L')}Q${f1(x1 + sw * 0.01)} ${f1(fb + (wl - fb) * 0.2)} ${f1(x1 - sw * 0.01)} ${f1(wl)}L${f1(x0 - 4)} ${f1(wl)}L${f1(x0 - 4)} ${f1(F(ax))}Z`
  // moss: cushions along the top (left two thirds), a few tongues hanging over the lip
  let moss = '', mossLo = ''
  for (let i = 0; i < 9; i++) {
    const x = lerp(ax, bx, 0.03 + r() * 0.62), rx = sw * (0.03 + r() * 0.05), y = g.mid(x)
    moss += blob(x, y, rx, th * (0.32 + r() * 0.2), 2564 + i, 0.25, 10)
    mossLo += blob(x + rx * 0.1, y + th * 0.18, rx * 0.9, th * 0.3, 2574 + i, 0.25, 10)
  }
  for (let i = 0; i < 6; i++) {
    const x = lerp(ax, bx, 0.05 + r() * 0.55), y = F(x)
    moss += blob(x, y + th * 0.15, sw * (0.012 + r() * 0.02), th * (0.25 + r() * 0.25), 2580 + i, 0.3, 8) // a tongue over the lip
  }
  let grain = ''
  for (let i = 0; i < 5; i++) {
    const x = lerp(ax, bx, 0.1 + r() * 0.75), y = lerp(F(x), wl, 0.3 + r() * 0.45), len = sw * (0.05 + r() * 0.1)
    grain += stroke([[x, y], [x + len * 0.5, y + (r() - 0.3) * th * 0.4], [x + len, y + (r() - 0.5) * th * 0.6]], 1 + r() * 1.2, 0.3, 0.4, 0.15)
  }
  const rimPts = xs.slice(16).map((x) => [x, B(x)] as Pt)
  const shoulder = curve([bx, fb], [x1 + sw * 0.01, fb + (wl - fb) * 0.2], [x1 - sw * 0.01, wl - (wl - fb) * 0.35], 8)
  // the reflection under the skin: the face turned over, broken into ripples
  let refl = ''
  for (let y = wl + 2, k = 0; y < wl + (wl - F(ax)) * 0.9; y += 2.6 + k * 0.5, k++) {
    const sh = (y - wl) / ((wl - F(ax)) * 0.9)
    const xa = x0 + (r() - 0.3) * sw * 0.06, xb = x1 - sw * (0.05 + sh * 0.3) + (r() - 0.5) * sw * 0.08
    if (r() < 0.82) refl += stroke([[xa, y], [lerp(xa, xb, 0.5), y + (r() - 0.5) * 1.5], [xb, y]], 1.6 + r() * 2.2 * (1 - sh), 0.05, 0.25, 0.3)
  }
  const sc = (pr * 3.4) / 60 // the pebble button's viewBox scale
  const ghosts = home.map(([x, y], i) => {
    const [rx, ry] = [[16.25, 5.46], [10.66, 8.06], [13, 11.18]][i].map((v) => v * sc)
    return s('g', { class: `t25l-ghost t25l-ghost-${i}` },
      s('ellipse', { class: 't25l-ghost-wet', cx: f1(x), cy: f1(y + ry * 0.7), rx: f1(rx * 1.05), ry: f1(Math.max(2, ry * 0.42)) }),
      s('path', { class: 't25l-ghost-ink', d: stroke(Array.from({ length: 13 }, (_, j) => {
        const a = Math.PI * (0.95 + j * 0.095)
        return [x + Math.cos(a) * rx, y + Math.sin(a) * ry] as Pt
      }), Math.max(1, ry * 0.12), 0.3, 0.3, 0.1) }))
  })
  return [
    s('path', { class: 't25l-slab-under', d: refl }),
    s('ellipse', { class: 't25l-slab-contact', cx: f1((x0 + x1) / 2), cy: f1(wl + 1), rx: f1(sw * 0.56), ry: f1(Math.max(3, H * 0.008)) }),
    s('path', { class: 't25l-slab', d: face, fill: 'url(#t25l-face)', filter: 'url(#ink-rough)' }),
    s('path', { d: face, fill: 'url(#t25l-belly)' }),
    s('path', { class: 't25l-slab-grain', d: grain }),
    s('path', { class: 't25l-slab-wet', d: stroke([[x0 - 4, wl - H * 0.006], [lerp(x0, x1, 0.5), wl - H * 0.008], [x1 - sw * 0.015, wl - H * 0.005]], H * 0.011, 0.02, 0.1, 0.4) }),
    s('path', { class: 't25l-slab', d: top, fill: 'url(#t25l-top)' }),
    s('path', { class: 't25l-slab-moss2', d: mossLo, filter: 'url(#ink-rough)' }),
    s('path', { class: 't25l-slab-moss', d: moss, filter: 'url(#ink-rough)' }),
    s('path', { class: 't25l-slab-ink', d: broken(front, Math.max(1.4, th * 0.12), 2565, 0.9, 7) + stroke(shoulder, Math.max(1.4, th * 0.14), 0.1, 0.3, 0.2) }),
    s('path', { class: 't25l-slab-rim', d: stroke(rimPts, Math.max(1.2, th * 0.1), 0.3, 0.05, 0.2) + stroke(shoulder.slice(0, 6), Math.max(1.2, th * 0.12), 0.05, 0.5, 0.2) }),
    ...ghosts,
  ]
}

/**
 * Scene 1 — SPLIT: the camera sits in the water, the surface cuts the frame. Above, a low moon over the far bank; on the
 * near bank a slab with three pebbles. Below, looking up, the surface is a silver mirror with Snell's window under the
 * moon and shafts of light; three layers: the moon's reflection written as script, a silk ribbon of ink carrying
 * leaves, weeds rising out of nothing into thickening mist — no floor. Drop each pebble (drag, tap, or 1–3): the flat one
 * skips and writes rings of script, the egg is caught by the current, the heavy one sinks and the camera follows it down
 * into the mist, where it never meets a bottom.
 */
export function layersScene(ctx: SceneCtx) {
  const n = K.layers.length
  const sunk = new Set<number>()
  const live = !ctx.reduced && ctx.quality !== 'low'
  let G: { W: number; H: number; wl: number; tiers: number[]; r: number; home: Pt[]; land: boolean; win: [number, number, number] } | null = null
  let first = true
  let slab: Slab | null = null
  let job: { cancel(): void } | null = null
  let driftAn: Animation | null = null
  let awake = false

  const layers = {} as Record<Layer, SVGSVGElement>
  for (const k of Object.keys(RATE) as Layer[]) layers[k] = s('svg', { class: `t25l-${k}`, 'aria-hidden': 'true' })
  const world = h('div', { class: 't25l-world' }, ...Object.values(layers))
  const drift = s('g', { class: 't25l-drift' })
  const fx = s('g') // splashes, rings, script written by the skips (in the surface layer)
  // the layer names, etched into the glass; a sunk layer gets a small ink seal (its words stay for screen readers)
  const seal = (i: number) => s('svg', { class: 't25l-seal', viewBox: '0 0 16 16', 'aria-hidden': 'true' },
    s('path', { class: 't25l-seal-b', d: blob(8, 8, 7, 7, 2590 + i, 0.12, 8) }), s('path', { class: 't25l-seal-g', d: glyph(3.2, 3.2, 9.6, 2595 + i, 1.5) }))
  // under each name, the line that layer teaches, etched when its pebble reaches it (audit v3 25-1: one big insight only)
  const lines = K.layers.map((l) => {
    const el = ctx.fact(F(l.line), 'p', 't25l-line')
    el.hidden = true
    return el
  })
  const labs = K.layers.map((l, i) => h('div', { class: 't25l-lab' }, h('p', null, l.label, seal(i)), h('small', null, l.sub), lines[i], h('span', { class: 'visually-hidden t25l-sunk', hidden: true }, K.sunk)))
  // each pebble carries a small carved word, so it is clear which one goes to which layer
  const pebbles = K.layers.map((l, i) => h('button', { class: `t25l-pebble t25l-pebble-${i}`, type: 'button', 'aria-label': l.aria },
    s('svg', { viewBox: '-30 -26 60 50', 'aria-hidden': 'true' }), h('span', { class: 't25l-mark', 'aria-hidden': 'true' }, l.mark)))
  const root = frame(ctx, 't25l', K.art, [K.insight], layout)
  root.append(world, ...labs, ...pebbles)
  // guidance: the next pebble's dot, a count of the layers reached, a prompt per pebble (flat → egg → heavy)
  const gd = guide(ctx)
  const count = gd.count(K.count, n, () => (G ? (G.land ? [G.W * 0.12, G.H * 0.06] : [G.W * 0.5, G.H * 0.04]) : [0, 0]))
  let dot: Mark | null = null
  function next() {
    dot?.done()
    dot = null
    const k = [0, 1, 2].find((j) => !sunk.has(j))
    if (k === undefined) return
    dot = gd.dot(pebbles[k], { dir: [0.4, 1] })
    ctx.prompt(K.prompts[k])
  }
  next()

  // ── animation: one loop runs the tracks (skips, tumble, the dive); asleep when none is left
  type Track = { t: number; dur: number; step(u: number): void; end(): void }
  const tracks: Track[] = []
  const camSet = (c: number) => {
    for (const k of Object.keys(RATE) as Layer[]) layers[k].style.transform = c ? `translateY(${f1(-c * RATE[k])}px)` : ''
    labs.forEach((l, i) => (l.style.transform = c ? `translateY(${f1(-c * (i ? RATE.mid : RATE.surf))}px)` : ''))
    pebbles.forEach((el, i) => (el.style.translate = c && !sunk.has(i) ? `0 ${f1(-c * RATE.silt)}px` : ''))
  }
  const loop = createLoop(root, (_t, dt) => {
    for (let i = tracks.length - 1; i >= 0; i--) {
      const tr = tracks[i]
      tr.t += dt
      const u = Math.min(1, tr.t / tr.dur)
      tr.step(u)
      if (u >= 1) {
        tracks.splice(i, 1)
        tr.end()
      }
    }
    return tracks.length > 0
  })
  ctx.onCleanup(() => loop.dispose())
  const put = (el: HTMLElement, x: number, y: number, rot = 0, o = 1) => {
    el.style.transform = `translate(${f1(x)}px, ${f1(y)}px) rotate(${rot.toFixed(1)}deg)`
    el.style.opacity = o.toFixed(2)
  }

  // ── a pebble goes in (x = where it was let go, or its usual spot)
  function drop(i: number, x?: number) {
    if (!G) return
    const g = G
    const el = pebbles[i]
    if (sunk.has(i)) return
    sunk.add(i)
    next()
    el.classList.add('in')
    el.setAttribute('aria-disabled', 'true')
    ctx.chime('tap')
    const { W, H, wl, tiers } = g
    const from = parse(el)
    const x0 = clamp(x ?? [0.36, 0.4, 0.46][i] * W, W * 0.28, W * 0.72)
    const rest = finals(i, x0)
    if (!live) {
      // low: the pebble is simply there; reduced: a 200 ms crossfade
      put(el, rest[0], rest[1], rest[2], rest[3])
      if (ctx.reduced && el.animate) el.animate([{ opacity: 0 }, { opacity: rest[3] }], { duration: 200 })
      splash(x0, i === 0)
      return reveal(i)
    }
    const fall = (u: number) => [lerp(from[0], x0, u), lerp(from[1], wl, u) - Math.sin(u * Math.PI) * H * 0.06] as Pt
    const after = () => reveal(i)
    if (i === 0) {
      // flat: three skips, each touch written as a ring of script, then it settles just under the skin
      const mx = g.win[0]
      const hops = [x0, lerp(x0, mx, 0.45), lerp(x0, mx, 0.78), mx + g.win[1] * 0.15] // it skips toward the moon's window
      tracks.push(track(2.6, (u) => {
        const k = Math.min(3, Math.floor(u * 4)), f = u * 4 - k
        const [ax, ay] = k === 0 ? fall(f) : [lerp(hops[k - 1], hops[k], f), wl - Math.sin(f * Math.PI) * H * (0.05 / k)]
        put(el, ax, ay, -8 + f * 16)
        if (k >= 1) reveal(i) // its line as soon as it first touches the skin (no long wait on the first pebble)
        if (f > 0.97 || (k > 0 && f < 0.03)) splash(k === 0 ? x0 : hops[k], true, k)
      }, () => tracks.push(track(0.9, (u) => put(el, rest[0], lerp(wl, rest[1], ease(u)), rest[2], lerp(1, rest[3], u)), after))))
    } else if (i === 1) {
      // egg: it sinks, the ribbon catches it and carries it off, tumbling with the leaves
      tracks.push(track(0.7, (u) => put(el, ...fall(u)), () => {
        splash(x0, false)
        tracks.push(track(2.8, (u) => {
          const sinkU = Math.min(1, u / 0.4), carry = Math.max(0, (u - 0.25) / 0.75)
          put(el, x0 + ease(carry) * (rest[0] - x0), lerp(wl, rest[1], ease(sinkU)), u * 400, lerp(1, rest[3], u))
        }, after))
      }))
    } else {
      // heavy: straight down; the camera goes with it (sky slow, weeds fast), it fades into the mist and never lands;
      // then the camera comes back up
      const deep = tiers[2] + H * 1.05
      const camMax = deep - H * 0.55
      tracks.push(track(0.7, (u) => put(el, ...fall(u)), () => {
        splash(x0, false)
        tracks.push(track(3.6, (u) => {
          const y = lerp(wl, deep, ease(u))
          const c = clamp(y - H * 0.55, 0, camMax)
          camSet(c)
          put(el, x0 + Math.sin(u * 7) * 3, y - c * RATE.mid, u * 30, 1 - ease(u) * 0.85)
        }, () => tracks.push(track(2.4, (u) => {
          const c = camMax * (1 - ease(u))
          camSet(c)
          put(el, x0, deep - c, 30, 0.15 * (1 - u))
        }, () => {
          camSet(0)
          put(el, rest[0], rest[1], rest[2], rest[3])
          after()
        }))))
      }))
    }
    loop.start()
  }
  const track = (dur: number, step: (u: number) => void, end: () => void): Track => ({ t: 0, dur, step, end })
  const parse = (el: HTMLElement): Pt => {
    const m = /translate\(([-\d.]+)px, ([-\d.]+)px/.exec(el.style.transform)
    return m ? [Number(m[1]), Number(m[2])] : [0, 0]
  }
  /** where each pebble ends: x, y, rotation, opacity */
  function finals(i: number, x0: number): [number, number, number, number] {
    const { W, H, wl, tiers } = G!
    if (i === 0) return [G!.win[0] + G!.win[1] * 0.55, wl + H * 0.06, 6, 0.85]
    if (i === 1) return [clamp(x0 + W * 0.26, 0, W * 0.9), (tiers[1] + tiers[2]) / 2, 40, 0.8]
    return [x0, H * 0.97, 30, 0.18] // in the mist at the foot of the frame: lost, not landed
  }
  /** rings on the skin of the water; for the skipping stone they turn into strokes of script */
  function splash(x: number, script: boolean, k = 0) {
    if (!G || fx.querySelector(`[data-at="${Math.round(x)}"]`)) return
    const { wl, H, win } = G
    const g = s('g', { class: 't25l-splash', 'data-at': String(Math.round(x)) },
      ...[0, 1, 2].map((j) => s('ellipse', { cx: f1(x), cy: f1(wl), rx: f1(H * 0.05 * (1 + j * 0.6)), ry: f1(H * 0.007 * (1 + j * 0.6)), style: `--i:${j}` })))
    // the rings turn to script only inside the moon's window (outside it the underside is a dark mirror)
    if (script && Math.abs(x - win[0]) < win[1] * 1.1) g.append(s('path', { class: 't25l-written', d: cursive(x, wl + H * 0.012, H * (0.04 - k * 0.006), H * 0.016, 2570 + k, H * 0.0032, 0.6) }))
    fx.append(g)
  }
  const told = new Set<number>()
  function reveal(i: number) {
    if (told.has(i)) return
    told.add(i)
    labs[i].querySelector<HTMLElement>('.t25l-sunk')!.hidden = false
    labs[i].classList.add('is-sunk')
    lines[i].hidden = false
    root.classList.add(`is-sunk-${i}`) // its ghost stays on the slab
    count.set(told.size)
    if (told.size === n) {
      // all three reached: the one sentence of the slide
      ctx.chime('ok')
      ctx.insight(F(K.insight), F(K.detail))
    }
  }

  // drag a pebble off the slab into the water (a tap drops it on its usual line)
  pebbles.forEach((el, i) => {
    let d: { id: number; x: number; y: number; ox: number; oy: number; moved: boolean } | null = null
    let box: DOMRect | null = null
    el.addEventListener('pointerdown', (e) => {
      if (sunk.has(i)) return
      el.setPointerCapture(e.pointerId)
      box = root.getBoundingClientRect()
      const [ox, oy] = parse(el)
      d = { id: e.pointerId, x: e.clientX, y: e.clientY, ox, oy, moved: false }
    })
    el.addEventListener('pointermove', (e) => {
      if (!d || e.pointerId !== d.id) return
      const dx = e.clientX - d.x, dy = e.clientY - d.y
      if (!d.moved && Math.hypot(dx, dy) < 6) return
      d.moved = true
      el.classList.add('held')
      put(el, d.ox + dx, d.oy + dy)
    })
    const up = (e: PointerEvent) => {
      if (!d || e.pointerId !== d.id) return
      const moved = d.moved
      el.classList.remove('held')
      const x = e.clientX - box!.left, y = e.clientY - box!.top
      const home = G!.home[i]
      d = null
      if (!moved) return drop(i)
      if (y > G!.wl - 8) drop(i, x)
      else put(el, home[0], home[1]) // not in the water: back to the slab
    }
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('click', (e) => {
      if (e.detail === 0) drop(i) // keyboard: Enter / Space
    })
  })
  ctx.onCleanup(onDigit((k) => k <= n && drop(k - 1)))
  ambient(ctx, root, (on) => {
    awake = on
    if (on) driftAn?.play()
    else driftAn?.pause()
  })
  ctx.onCleanup(() => driftAn?.cancel())

  // ── painting
  function layout(W: number, H: number) {
    const land = W / H > 1.05
    const wl = H * (land ? 0.34 : 0.27)
    const tiers = [wl, wl + H * (land ? 0.2 : 0.17), wl + H * (land ? 0.43 : 0.38)]
    const r = Math.max(13, Math.min(W * 0.026, H * 0.04))
    // the slab on the near bank (left): a thin lit top plane over a front face; the pebbles sit on the top
    const sx0 = -W * 0.01, sx1 = W * (land ? 0.3 : 0.56), sy = wl - H * (land ? 0.07 : 0.055)
    slab = slabGeo(sx0, sx1, sy, wl, H * (land ? 0.026 : 0.022))
    const home: Pt[] = [0, 1, 2].map((i) => {
      const x = lerp(sx0, sx1, 0.3 + i * 0.22)
      return [x, slab!.mid(x) - r * [0.28, 0.42, 0.58][i]]
    })
    const mx = W * (land ? 0.66 : 0.7)
    G = { W, H, wl, tiers, r, home, land, win: [mx, W * (land ? 0.085 : 0.15), H * (land ? 0.032 : 0.026)] }
    const WH = H * 2.2
    for (const k of Object.keys(RATE) as Layer[]) {
      layers[k].setAttribute('viewBox', `0 0 ${f1(W)} ${f1(WH)}`)
      Object.assign(layers[k].style, { width: `${f1(W)}px`, height: `${f1(WH)}px` })
    }
    root.classList.toggle('land', land)
    pebbles.forEach((el, i) => {
      el.firstElementChild!.replaceChildren(...pebbleArt(i, 13, 2530 + i))
      Object.assign(el.style, { width: `${f1(r * 3.4)}px`, height: `${f1(r * 2.8)}px`, marginLeft: `${f1(-r * 1.7)}px`, marginTop: `${f1(-r * 1.4)}px` })
      if (!sunk.has(i)) put(el, home[i][0], home[i][1])
      else {
        const f = finals(i, [0.36, 0.4, 0.46][i] * W)
        put(el, f[0], f[1], f[2], f[3])
      }
    })
    // etched on the glass at the left edge, in clear water: under the slab's foot, above the ribbon, in the mist
    const labTop = [wl + H * (land ? 0.075 : 0.05), tiers[1] + H * (land ? 0.004 : 0.004), tiers[2] + H * (land ? 0.05 : 0.045)]
    labs.forEach((l, i) => Object.assign(l.style, { left: `${f1(Math.max(16, W * 0.035))}px`, top: `${f1(labTop[i])}px` }))
    job?.cancel()
    job = sliced(paint(W, H, WH, wl, tiers, land, sx0, sx1), { sync: ctx.reduced || !first })
    first = false
  }

  function* paint(W: number, H: number, WH: number, wl: number, tiers: number[], land: boolean, sx0: number, sx1: number) {
    const r = rng(2501)
    const [mx, wrx, wry] = G!.win
    const my = wl - H * (land ? 0.17 : 0.14), mr = Math.min(W, H) * (land ? 0.04 : 0.055)
    // the water's value ramp, in scene px: silver under the skin, darkest at the ribbon, mist from the third tier down
    const under = grad('t25l-under', [[0, 'u0', 1], [0.07, 'u1', 1], [0.42, 'u2', 1], [0.75, 'u3', 1], [1, 'f0', 1]], true)
    Object.entries({ gradientUnits: 'userSpaceOnUse', x1: 0, x2: 0, y1: f1(wl), y2: f1(tiers[2] + H * 0.4) }).forEach(([k, v]) => under.setAttribute(k, String(v)))
    const defs = s('defs', null,
      grad('t25l-skyg', [[0, '--paper', 1], [1, '--paper-2', 1]]),
      under,
      grad('t25l-fog', [[0, 'f0', 0], [0.5, 'f0', 0.6], [1, 'f0', 1]], true),
      grad('t25l-silver', [[0, 's0', 0.95], [0.35, 's0', 0.35], [1, 's0', 0]], true),
      grad('t25l-ray', [[0, 's0', 0.62], [0.25, 's0', 0.3], [1, 's0', 0]], true),
      s('radialGradient', { id: 't25l-window' }, s('stop', { offset: 0, class: 't25l-w0' }), s('stop', { offset: 0.62, class: 't25l-w0', style: 'stop-opacity:.82' }), s('stop', { offset: 0.86, class: 't25l-w0', style: 'stop-opacity:.5' }), s('stop', { offset: 1, class: 't25l-w1' })),
      s('radialGradient', { id: 't25l-dim' }, s('stop', { offset: 0.45, class: 't25l-st-dim', style: 'stop-opacity:.5' }), s('stop', { offset: 1, class: 't25l-st-dim', style: 'stop-opacity:0' })),
      s('linearGradient', { id: 't25l-face', x1: 0, y1: 0, x2: 1, y2: 0 }, s('stop', { offset: 0, style: 'stop-color:var(--rock-lo)' }), s('stop', { offset: 0.35, style: 'stop-color:var(--rock-mid)' }), s('stop', { offset: 0.9, style: 'stop-color:var(--rock-mid)' }), s('stop', { offset: 1, style: 'stop-color:var(--rock-hi)' })),
      s('linearGradient', { id: 't25l-top', x1: 0, y1: 0, x2: 1, y2: 0 }, s('stop', { offset: 0, style: 'stop-color:var(--rock-mid)' }), s('stop', { offset: 0.35, style: 'stop-color:var(--rock-hi)' })),
      s('radialGradient', { id: 't25l-stone', cx: 0.62, cy: 0.3, r: 0.8 }, s('stop', { offset: 0, style: 'stop-color:var(--rock-hi)' }), s('stop', { offset: 0.6, style: 'stop-color:var(--rock-mid)' }), s('stop', { offset: 1, style: 'stop-color:var(--rock-lo)' })),
      s('linearGradient', { id: 't25l-belly', x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0.35, style: 'stop-color:var(--umbra);stop-opacity:0' }), s('stop', { offset: 1, style: 'stop-color:var(--umbra);stop-opacity:.55' })))

    // the sky above the water: a low moon behind the far bank, one pine, mist lying on the water
    layers.sky.replaceChildren(defs,
      s('rect', { class: 't25l-skyrect', width: f1(W), height: f1(wl), fill: 'url(#t25l-skyg)' }),
      mist(mx, my, W * 0.45, wl * 0.6),
      moon(mx, my, mr, 2502, true),
      hills(-W * 0.05, W * 1.05, wl - H * 0.012, wl * 0.4, 2503, 0.88, 5),
      hills(W * 0.35, W * 1.1, wl - H * 0.008, wl * 0.24, 2504, 0.5, 3),
      pine(W * (land ? 0.84 : 0.88), wl - H * 0.01, wl * (land ? 0.62 : 0.55), 2505, -1),
      mist(W * 0.5, wl - H * 0.01, W * 0.7, H * 0.03))
    yield

    // under the skin: the body of water deepening, the silver underside, Snell's window under the moon, the waterline
    let skin = ''
    for (let i = 0; i < 26; i++) {
      const y = wl + H * (0.004 + Math.pow(r(), 1.6) * 0.07), x = r() * W, len = W * (0.03 + r() * 0.09)
      skin += stroke([[x, y], [x + len * 0.5, y + (r() - 0.5) * 2], [x + len, y]], 1 + r() * 2.2, 0.3, 0.3, 0.1)
    }
    let glint = ''
    for (let i = 0; i < 9; i++) {
      const x = mx + (r() - 0.5) * W * 0.14, len = W * (0.01 + r() * 0.03)
      glint += stroke([[x - len / 2, wl - 1], [x + len / 2, wl - 1.5]], 1.4 + r() * 1.2, 0.3, 0.3, 0.1)
    }
    // Snell's window: looking up, the whole sky is squeezed into one bright ellipse on the underside, right under the
    // moon; around it the skin is a dark mirror of the depths (total reflection), so the window gets a dim collar
    const wy = wl + wry * 0.75
    let rim = ''
    for (let i = 0; i < 4; i++) {
      const a0 = Math.PI * (0.08 + i * 0.24 + r() * 0.06), a1 = a0 + Math.PI * (0.12 + r() * 0.08)
      rim += stroke(Array.from({ length: 9 }, (_, j) => {
        const a = lerp(a0, a1, j / 8)
        return [mx + Math.cos(a) * wrx, wy + Math.sin(a) * wry] as Pt
      }), Math.max(1.2, wry * 0.09), 0.3, 0.3, 0.1)
    }
    layers.surf.replaceChildren(
      s('rect', { y: f1(wl), width: f1(W), height: f1(WH - wl), fill: 'url(#t25l-under)' }),
      s('rect', { y: f1(wl), width: f1(W), height: f1(H * 0.09), fill: 'url(#t25l-silver)' }),
      s('ellipse', { cx: f1(mx), cy: f1(wy + wry * 0.4), rx: f1(wrx * 2.1), ry: f1(wry * 3.2), fill: 'url(#t25l-dim)' }),
      s('ellipse', { cx: f1(mx), cy: f1(wy), rx: f1(wrx), ry: f1(wry), fill: 'url(#t25l-window)' }),
      s('path', { class: 't25l-wrim', d: rim }),
      s('ellipse', { class: 't25l-wmoon', cx: f1(mx + wrx * 0.12), cy: f1(wy - wry * 0.12), rx: f1(wrx * 0.16), ry: f1(wry * 0.42) }),
      s('path', { class: 't25l-skin', d: skin }),
      // the moon's reflection broken into script: a small knot of glowing strokes held inside the window
      s('path', { class: 't25l-script', d: cursive(mx - wrx * 0.3, wy - wry * 0.55, wry * 1.5, wry * 0.9, 2511, Math.max(1.3, wry * 0.13), 0.5) + cursive(mx + wrx * 0.32, wy - wry * 0.4, wry * 1.2, wry * 0.7, 2512, Math.max(1.1, wry * 0.1), 0.8) + cursive(mx + wrx * 0.02, wy + wry * 0.05, wry * 0.9, wry * 0.55, 2513, Math.max(1, wry * 0.09), 1) }),
      fx,
      s('path', { class: 't25l-line', d: stroke([[-4, wl], [W * 0.5, wl + 0.5], [W + 4, wl]], 1.6, 0.02, 0.02, 0.6) }),
      s('path', { class: 't25l-glint', d: glint }))
    yield

    // shafts of moonlight slanting down from the window (light comes from the moon, upper right)
    // their feet are on the window's rim and inside it; they fan out a little as they fall
    const rays = Array.from({ length: 6 }, (_, i) => {
      const u = (i - 2.5) / 2.5, x = mx + u * wrx * 0.78 + (r() - 0.5) * wrx * 0.12, y = wy + Math.sqrt(1 - u * u * 0.6) * wry * 0.6
      const w = wrx * (0.07 + r() * 0.1), len = H * (0.45 + r() * 0.4), dx = -len * (0.3 - u * 0.07)
      return s('path', { d: `M${f1(x - w)} ${f1(y)}L${f1(x + w)} ${f1(y)}L${f1(x + w * 3 + dx)} ${f1(y + len)}L${f1(x - w * 1.6 + dx)} ${f1(y + len)}Z`, fill: 'url(#t25l-ray)', style: `opacity:${(0.4 + r() * 0.45).toFixed(2)}` })
    })
    layers.rays.replaceChildren(s('g', { class: 't25l-rays' }, ...rays))
    yield

    // the current: a silk ribbon of ink drifting across (drawn over two widths so it can slide), threads, leaves, dust
    // it rides low in its tier (clear water above for the label); narrower on a phone
    const bs = land ? 0.9 : 0.74
    const cy = lerp(tiers[1], tiers[2], land ? 0.62 : 0.66), cb = (tiers[2] - tiers[1]) * bs
    const band = (dy: number, ph: number, amp = cb * 0.18): Pt[] => Array.from({ length: 65 }, (_, i) => {
      const x = -W + (3 * W * i) / 64
      return [x, cy + dy + Math.sin((x / W) * Math.PI * 2 + ph) * amp + Math.sin((x / W) * Math.PI * 6 + ph * 2) * cb * 0.03]
    })
    // silk: three folds of wash at different widths, a pale fold catching the light, broken dry threads along it
    let folds = ''
    for (const [o, w, ph] of [[-0.12, 0.42, 0.2], [0.06, 0.5, 0.55], [0.0, 0.28, 0.9]]) folds += stroke(band(o * cb, 0.4 + ph * 0.5, cb * (0.16 + ph * 0.04)), cb * w, 0.01, 0.01, 0.5)
    let threads = ''
    for (let j = 0; j < 9; j++) {
      const pts = band((r() - 0.5) * cb * 0.5, 0.4 + r() * 0.5)
      for (let k = 0; k < 64; ) {
        const len = 3 + Math.floor(r() * 9)
        if (r() < 0.6) threads += stroke(pts.slice(k, k + len + 1), 0.6 + r() * 1.6, 0.2, 0.3, 0.1)
        k += len + 1 + Math.floor(r() * 4)
      }
    }
    let dust = ''
    for (let i = 0; i < 90; i++) dust += blob(-W + r() * W * 3, cy + (r() - 0.5) * cb * 0.9, 0.8 + r() * 1.6, 0.8 + r() * 1.4, i, 0.2, 6)
    const leaves = [0.12, 0.45, 0.8, 1.12, 1.45, 1.8].map((t, i) => {
      const pts = band(-cb * 0.04, 0.4), k = Math.round(((t + 1) / 3) * 64), [x, y] = pts[k], [x2, y2] = pts[Math.min(64, k + 1)]
      const lf = leaf(x, y, Math.min(W, H) * 0.035 * (i % 3 === 1 ? 1.25 : 1), Math.atan2(y2 - y, x2 - x) + (r() - 0.5) * 0.9, 2520 + (i % 3))
      return [s('path', { class: `t25l-leaf${i === 2 ? ' red' : ''}`, d: lf.blade, filter: 'url(#ink-rough)' }), s('path', { class: 't25l-rib', d: lf.rib })]
    }).flat()
    drift.replaceChildren(
      s('path', { class: 't25l-band', d: folds, filter: 'url(#ink-wash)' }),
      s('path', { class: 't25l-fold', d: stroke(band(-cb * 0.08, 0.6, cb * 0.2), cb * 0.06, 0.05, 0.05, 0.2), filter: 'url(#ink-wash)' }),
      // the moon catches the ribbon's upper edge
      s('path', { class: 't25l-bandrim', d: broken(band(-cb * 0.315, 0.5, cb * 0.168), Math.max(1.1, cb * 0.011), 2519, 0.7, 5) }),
      s('path', { class: 't25l-thread', d: threads }),
      s('path', { class: 't25l-dust', d: dust }),
      ...leaves)
    layers.mid.replaceChildren(drift,
      // the mist that thickens with depth: there is no floor, only this
      s('rect', { y: f1(tiers[2] - H * 0.05), width: f1(W), height: f1(WH - tiers[2] + H * 0.05), fill: 'url(#t25l-fog)' }))
    yield

    // weeds and roots rising out of nothing (their feet fade), two depths
    // kelp: a sinuous blade from a lost foot, tapering as it climbs; a second blade beside it
    const weeds = (n: number, k: number, seed: number, avoid = -1) => {
      const q = rng(seed)
      let d = ''
      for (let i = 0; i < n; i++) {
        const x0 = W * (0.03 + i / n + (q() - 0.5) * 0.05), base = tiers[2] + H * (0.3 + q() * 0.5)
        if (x0 < avoid) continue // the labels' column stays clear water
        const hh = Math.min(H * (0.32 + q() * 0.3) * (0.7 + k * 0.3), base - tiers[2] + H * 0.08)
        for (let b2 = 0; b2 < 1 + Math.round(q()); b2++) {
          const ph = q() * 6, amp = W * (0.008 + q() * 0.012), lean = (q() - 0.5) * W * 0.05, x = x0 + b2 * W * 0.012
          const pts = Array.from({ length: 22 }, (_, j) => {
            const t = j / 21
            return [x + lean * t * t + Math.sin(t * 7 + ph) * amp * (0.3 + t), base - hh * t * (b2 ? 0.75 : 1)] as Pt
          })
          d += stroke(pts, (7 + q() * 7) * k, 0.02, 0.6, 0.12)
        }
      }
      return d
    }
    let roots = ''
    {
      const q = rng(2559)
      for (let i = 0; i < 7; i++) {
        // short, under the right half of the slab's foot only: the label column below stays clear
        const x = lerp(sx0, sx1, land ? 0.58 + q() * 0.36 : 0.74 + q() * 0.24), y = wl + H * 0.025, L = H * (0.04 + q() * 0.07)
        roots += stroke(curve([x, y], [x + (q() - 0.5) * W * 0.04, y + L * 0.5], [x + (q() - 0.3) * W * 0.05, y + L], 10), 1.2 + q() * 2.4, 0.05, 0.85, 0.1)
      }
    }
    layers.weed.replaceChildren(
      s('path', { class: 't25l-weedp far', d: weeds(land ? 9 : 6, 0.7, 2550), filter: 'url(#ink-wash)' }),
      s('path', { class: 't25l-weedp', d: weeds(land ? 7 : 5, 1, 2551, W * (land ? 0.2 : 0.45)), filter: 'url(#ink-wash)' }),
      s('path', { class: 't25l-roots', d: roots, filter: 'url(#ink-rough)' }))
    yield

    // the near bank above the water: a low, wide rock (lit crown, dark face, foot in the water), reeds behind it
    let silt = ''
    for (let i = 0; i < 90; i++) silt += blob(r() * W, wl + H * 0.04 + r() * (WH - wl), 0.6 + r() * 1.8, 0.6 + r() * 1.5, i + 300, 0.2, 6)
    const sw = sx1 - sx0
    layers.silt.replaceChildren(
      s('path', { class: 't25l-motes', d: silt }), // (not .t25l-silt: that is the layer's own svg)
      reeds(sx0 + sw * 0.12, wl - H * 0.01, wl * 0.55, 2562, 6),
      ...slabArt(slab!, H, G!.home, G!.r))

    // the living motion (high only, asleep after 10 s without input): the ribbon slides on, slower than mist
    driftAn?.cancel()
    driftAn = live ? drift.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${f1(W)}px)` }], { duration: (W / 7) * 1000, iterations: Infinity }) : null
    if (driftAn && !awake) driftAn.pause()
  }

  /** a vertical (or horizontal) gradient whose stops are CSS classes or tokens */
  function grad(id: string, stops: [number, string, number][], cls = false) {
    return s('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 },
      ...stops.map(([o, c, a]) => s('stop', cls ? { offset: o, class: `t25l-st-${c}`, style: `stop-opacity:${a}` } : { offset: o, style: `stop-color:var(${c});stop-opacity:${a}` })))
  }
}
