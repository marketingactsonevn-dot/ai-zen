import { fill, h, nextId, s } from '../../core/dom'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import { blob, clamp, curve, onSize, p2Defs, rng, stableHeight, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist, pine } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import C from '../../content/tram-27.json'
import { boulder, crack, F, f1, lantern, lanternWindows, lin, rad } from './ink27'

const K = C.scenes.faces
const KEPT = 0.34 // a found face's vermilion, held after the flash (must match .t27f-fx.kept)
type V = { x: number; y: number }

/**
 * Where you must stand to see each face (eye offset, -1…1 across and down the frame), in K.things order:
 * the moss rock (lean left and low), the moon behind its cloud (look up), the stone lantern (lean right).
 */
const SWEET: Pt[] = [[-0.8, -0.8], [0.2, -0.9], [0.75, 0.45]]

/** A layer slides by -E × amp: near layers far, the sky a little the other way — an orbit round mid-garden. */
const shift = (a: number, e: Pt | V): Pt => {
  const [x, y] = Array.isArray(e) ? e : [e.x, e.y]
  return [-x * a, -y * a]
}

interface Geo {
  W: number; H: number; Hr: number; land: boolean; u: number; yh: number
  /** parallax: horizon, floor at the art's foot, the near grass, the sky, the cloud */
  aH: number; aB: number; aN: number; aS: number; aC: number
  moon: Pt; R: number
  stele: Pt; sw: number; sh: number
  lamp: Pt; lh: number
  rock: Pt; rw: number; rh: number
}

function geo(W: number, H: number, Hr: number): Geo {
  const land = W / H > 1.05
  const u = clamp(H / 640, 0.78, 1.15)
  const yh = H * (land ? 0.58 : 0.5)
  const g = land
    ? { moon: [W * 0.6, H * 0.19] as Pt, R: clamp(H * 0.075, 26, 58), stele: [W * 0.455, yh + H * 0.075] as Pt, sw: clamp(W * 0.13, 150, 190),
        lamp: [W * 0.795, H * 0.79] as Pt, lh: H * 0.55, rock: [W * 0.235, H * 0.885] as Pt, rw: Math.min(W * 0.3, 470), rh: H * 0.34 }
    : { moon: [W * 0.68, H * 0.115] as Pt, R: clamp(W * 0.085, 24, 40), stele: [W * 0.26, yh + H * 0.005] as Pt, sw: clamp(W * 0.4, 120, 172),
        lamp: [W * 0.8, H * 0.665] as Pt, lh: H * 0.36, rock: [W * 0.3, H * 0.885] as Pt, rw: W * 0.6, rh: H * 0.22 }
  return { W, H, Hr, land, u, yh, aH: -22 * u, aB: 95 * u, aN: 150 * u, aS: -30 * u, aC: 40 * u, ...g, sh: g.sw * 0.8 }
}
const ampAt = (g: Geo, y: number) => g.aH + ((g.aB - g.aH) * (y - g.yh)) / (g.H - g.yh)

/** The three faces in screen space when the eye is at each one's sweet spot: two eyes and a mouth line. */
function faces(g: Geo) {
  const rf = g.rw * 0.11
  const rF: Pt = [g.rock[0] + g.rw * 0.04, g.rock[1] - g.rh * 0.6]
  const mf = g.R * 0.42
  const mF: Pt = [g.moon[0], g.moon[1] + g.R * 0.04]
  const [wl, wr, wr0] = lanternWindows(g.lamp[0], g.lamp[1], g.lh)
  const lu = g.lh / 10
  const lF: Pt = [g.lamp[0], wl[1]]
  return [
    { eyes: [[rF[0] - rf * 0.62, rF[1] - rf * 0.3], [rF[0] + rf * 0.6, rF[1] - rf * 0.36]] as Pt[], er: [rf * 0.2, rf * 0.3] as Pt,
      mouth: [[rF[0] - rf * 0.72, rF[1] + rf * 0.5], [rF[0] + rf * 0.02, rF[1] + rf * 0.86], [rF[0] + rf * 0.76, rF[1] + rf * 0.44]] as Pt[], mw: rf * 0.12, c: rF, f: rf },
    { eyes: [[mF[0] - mf * 0.62, mF[1] - mf * 0.34], [mF[0] + mf * 0.6, mF[1] - mf * 0.42]] as Pt[], er: [mf * 0.34, mf * 0.26] as Pt,
      mouth: [[mF[0] - mf * 1.05, mF[1] + mf * 0.42], [mF[0], mF[1] + mf * 1.05], [mF[0] + mf * 1.0, mF[1] + mf * 0.36]] as Pt[], mw: mf * 0.2, c: mF, f: mf },
    { eyes: [wl, wr], er: [wr0, wr0 * 1.05] as Pt,
      mouth: [[lF[0] - lu * 0.62, lF[1] + lu * 0.62], [lF[0], lF[1] + lu * 1.0], [lF[0] + lu * 0.62, lF[1] + lu * 0.6]] as Pt[], mw: lu * 0.13, c: lF, f: lu * 0.5 },
  ]
}

/** Scene 1 ★ — seven layers of a night garden; a face hides in the moss rock, the moon, the lantern, whole only from one spot. */
export function facesScene(ctx: SceneCtx) {
  p2Defs()
  const low = ctx.quality === 'low'
  const id = nextId('t27f')
  const found = K.things.map(() => false)
  const inside = K.things.map(() => false)
  let read = false
  const names = ['sky', 'hills', 'cloud', 'floor', 'stele', 'lamp', 'rock', 'near'] as const
  type Name = (typeof names)[number]
  const L = Object.fromEntries(names.map((n) => [n, h('div', { class: `t27f-L t27f-${n}` }, s('svg', { class: 't27f-svg', 'aria-hidden': 'true' }))])) as Record<Name, HTMLDivElement>
  const svgOf = (n: Name) => L[n].firstChild as SVGSVGElement
  // the face as seen at its sweet spot, in vermilion (a flash), with an ink twin kept at quality=low
  const fx = K.things.map(() => s('svg', { class: 't27f-fx', 'aria-hidden': 'true' }))
  const host: Name[] = ['rock', 'sky', 'lamp']
  const btns = K.things.map((t, i) => h('button', { class: 't27f-hit', type: 'button', 'aria-label': t.aria, 'aria-pressed': 'false', onClick: (e: MouseEvent) => go(i, e) }))
  // a small seal is pressed beside each thing once its face is found (the words go to the live region, not the art)
  const labs = K.things.map(() => h('i', { class: 't27f-seal', 'aria-hidden': 'true' }, s('svg', { viewBox: '0 0 20 20' },
    s('path', { class: 't27f-seal-ink', d: 'M2.4 2.8Q10 1.5 17.5 2.4Q18.6 10 17.7 17.6Q10 18.6 2.5 17.5Q1.5 10 2.4 2.8Z' }),
    s('path', { class: 't27f-seal-cut', d: 'M7 6.6a1.5 1.5 0 1 0 .01 0ZM13 6.4a1.5 1.5 0 1 0 .01 0ZM5.6 11.6Q10 16.2 14.4 11.4Q10 14.2 5.6 11.6Z' }))))
  const user = h('p', { class: 't27f-user' })
  const bot = h('p', { class: 't27f-bot' })
  const screen = h('button', { class: 't27f-screen', type: 'button', 'aria-label': K.eliza.aria, disabled: true, onClick: () => type(true) }, user, bot)
  const carve = h('p', { class: 't27f-carve', 'aria-hidden': 'true' }, K.eliza.label)
  const note = ctx.fact(F(K.eliza.note), 'p', 't27f-note')
  const live = h('p', { class: 'visually-hidden', 'aria-live': 'polite' })
  // the hit areas live in one overlay in reading order (Tab: rock, moon, lantern) and ride with their layers
  labs.forEach((l, i) => L[host[i]].append(l))
  const hits = h('div', { class: 't27f-hits' }, ...btns, screen)
  const drift = h('div', { class: 't27f-drift', 'aria-hidden': 'true' })
  L.stele.append(drift, carve, note)
  const world = h('div', { class: 't27f-world' }, ...names.map((n) => L[n]), ...fx, hits)
  const root = h('div', { class: `t27f${low ? ' is-low' : ''}` },
    h('p', { class: 'visually-hidden' }, K.art, ' ', K.view), world, live)
  ctx.art.append(root)
  ctx.prompt(K.prompt)
  const stable = stableHeight(ctx, K.insights.map(F))

  // ── layout: paint each layer once per size (the first time soaking in, slice by slice) ──
  let G: Geo | null = null
  let amps: Record<Name, number> | null = null
  let FS: ReturnType<typeof faces> = []
  let job: { cancel(): void } | null = null
  let first = true
  function layout() {
    const W = root.clientWidth, Hr = root.clientHeight
    if (W < 60 || Hr < 60) return
    const H = stable(Hr)
    const g = (G = geo(W, H, Hr))
    FS = faces(g)
    const A = (amps = { sky: g.aS, hills: g.aH, cloud: g.aC, floor: 0, stele: ampAt(g, g.stele[1]), lamp: ampAt(g, g.lamp[1]), rock: ampAt(g, g.rock[1]), near: g.aN })
    for (const n of names) {
      const v = svgOf(n)
      v.setAttribute('viewBox', `0 0 ${W} ${Hr}`)
      v.setAttribute('width', String(W))
      v.setAttribute('height', String(Hr))
    }
    L.floor.style.transformOrigin = `0 ${f1(g.yh)}px`
    // where each face's partner piece must lie in its own layer so that it lands on the face at the sweet spot
    const into = (p: Pt, from: number, to: number, e: Pt): Pt => {
      const a = shift(from, e), b = shift(to, e)
      return [p[0] + a[0] - b[0], p[1] + a[1] - b[1]]
    }
    const rockEyes = FS[0].eyes.map((p) => into(p, A.rock, g.aN, SWEET[0]))
    const wisp = FS[1].mouth.map((p) => into(p, g.aS, g.aC, SWEET[1]))
    const twig = FS[2].mouth.map((p) => into(p, A.lamp, g.aN, SWEET[2]))
    function* paint() {
      svgOf('sky').replaceChildren(...sky(g, id, FS[1]))
      yield
      svgOf('hills').replaceChildren(...far(g))
      svgOf('cloud').replaceChildren(...cloud(g, wisp, FS[1].mw))
      yield
      svgOf('floor').replaceChildren(...floor(g, id))
      yield
      svgOf('stele').replaceChildren(...steleArt(g, id))
      yield
      svgOf('lamp').replaceChildren(...lantern(`${id}-l`, g.lamp[0], g.lamp[1], g.lh))
      yield
      const [[x, y]] = [g.rock]
      svgOf('rock').replaceChildren(
        ...boulder(`${id}-k`, x + g.rw * 0.62, y + g.H * 0.012, g.rw * 0.34, g.rh * 0.36, 2753, { moss: 0.5, warm: 0.6, rings: 2 }),
        ...boulder(`${id}-r`, x, y, g.rw, g.rh, 2741, { moss: 0.62, warm: 1, extra: rockMouth(FS[0]) }),
      )
      yield
      svgOf('near').replaceChildren(...near(g, id, rockEyes, FS[0].er, twig, FS[2].mw, FS[2].f * 2, low))
      yield
      FS.forEach((f, i) => {
        fx[i].setAttribute('viewBox', `0 0 ${W} ${Hr}`)
        fx[i].replaceChildren(...faceArt(f))
      })
    }
    // DOM over the art: hit areas, labels, the stele's screen
    const box = (el: HTMLElement, x: number, y: number, w: number, hh: number) => Object.assign(el.style, { left: `${f1(x)}px`, top: `${f1(y)}px`, width: `${f1(w)}px`, height: `${f1(hh)}px` })
    box(btns[0], g.rock[0] - g.rw * 0.5, g.rock[1] - g.rh * 1.02, g.rw, g.rh)
    box(btns[1], g.moon[0] - g.R * 1.6, g.moon[1] - g.R * 1.4, g.R * 3.2, g.R * 2.9)
    box(btns[2], g.lamp[0] - g.lh * 0.22, g.lamp[1] - g.lh, g.lh * 0.44, g.lh)
    const sz = g.land ? 20 : 16
    box(labs[0], g.rock[0] + g.rw * 0.3, g.rock[1] - g.rh * 0.06, sz, sz)
    box(labs[1], g.moon[0] + g.R * 0.95, g.moon[1] + g.R * 0.75, sz, sz)
    box(labs[2], g.lamp[0] + g.lh * 0.1, g.lamp[1] - g.lh * 0.16, sz, sz)
    const [sx, sy] = g.stele
    box(screen, sx - g.sw * 0.42, sy - g.sh * 0.8, g.sw * 0.84, g.sh * 0.62)
    box(carve, sx - g.sw * 0.5, sy - g.sh * 0.97, g.sw, 0)
    if (g.land) box(note, sx - 92, sy + 10, 260, 0) // right of centre: the big rock's shoulder stands in front of the left
    else box(note, 6, sy + 6, Math.min(g.W * 0.62, g.lamp[0] - g.lh * 0.22 - 10), 0)
    box(drift, sx - g.sw * 1.6, sy - g.sh * 0.32, g.sw * 3.2, g.sh * 0.42)
    job?.cancel()
    job = sliced(paint(), { sync: ctx.reduced || !first })
    first = false
    write()
  }
  ctx.onCleanup(onSize(root, layout))
  ctx.onCleanup(() => job?.cancel())

  // ── the eye: target → current with damping; every layer is one translate (floor: a shear) ──
  const tgt: V = { x: 0, y: 0 }, cur: V = { x: 0, y: 0 }
  function write() {
    if (!G || !amps) return
    for (const n of names) {
      if (n === 'floor') continue
      const a = amps[n]
      L[n].style.transform = `translate3d(${f1(-cur.x * a)}px,${f1(-cur.y * a)}px,0)`
    }
    // the sand: a shear about the horizon, so every foot stays on it
    const g = G
    const k = (g.aB - g.aH) / (g.H - g.yh)
    const sy = 1 - cur.y * k
    L.floor.style.transform = `translate3d(${f1(-cur.x * g.aH)}px,${f1(-cur.y * g.aH)}px,0) skewX(${((Math.atan(-cur.x * k / sy) * 180) / Math.PI).toFixed(3)}deg) scaleY(${sy.toFixed(4)})`
    fx.forEach((el, i) => {
      const a = amps![host[i]]
      el.style.transform = btns[i].style.transform = `translate3d(${f1(-cur.x * a)}px,${f1(-cur.y * a)}px,0)`
    })
    screen.style.transform = L.stele.style.transform
  }
  const loop = createLoop(root, (_t, dt) => {
    const f = dt > 0 ? 1 - Math.exp(-dt * 5.5) : 1
    cur.x += (tgt.x - cur.x) * f
    cur.y += (tgt.y - cur.y) * f
    write()
    check()
    return Math.abs(tgt.x - cur.x) + Math.abs(tgt.y - cur.y) > 0.0015
  })
  ctx.onCleanup(() => loop.dispose())
  const set = (x: number, y: number) => {
    tgt.x = clamp(x, -1, 1)
    tgt.y = clamp(y, -1, 1)
    if (ctx.reduced) {
      cur.x = tgt.x
      cur.y = tgt.y
      write()
      check()
    } else loop.start()
  }
  /** the eye, gently drawn into a sweet spot once it is close */
  const aim = (x: number, y: number) => {
    let bx = x, by = y
    for (const [sx, sy] of SWEET) {
      const d = Math.hypot(x - sx, y - sy)
      if (d < 0.32) {
        const q = clamp((0.32 - d) / 0.2, 0, 1)
        const k = q * q * (3 - 2 * q) // 1 inside 0.12, easing out to 0 at 0.32
        bx += (sx - x) * k
        by += (sy - y) * k
      }
    }
    set(bx, by)
  }
  function check() {
    SWEET.forEach(([sx, sy], i) => {
      const d = Math.hypot(cur.x - sx, cur.y - sy)
      if (d < 0.045 && !inside[i]) {
        inside[i] = true
        see(i)
      } else if (d > 0.14) inside[i] = false
    })
  }

  // ── a face is seen: a vermilion flash (~0.25 s, the brain's own correction time), then the thing is a thing again ──
  function see(i: number) {
    // then it lingers faintly on the thing (the .kept opacity), so a found face stays legible
    if (!ctx.reduced || low) fx[i].animate(ctx.reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.32 }, { opacity: low ? 0.7 : KEPT }], { duration: ctx.reduced ? 200 : 820, easing: 'ease-out' })
    if (found[i]) return
    found[i] = true
    btns[i].setAttribute('aria-pressed', 'true')
    labs[i].classList.add('on')
    fx[i].classList.add('kept')
    ctx.chime('soft')
    live.textContent = `${K.things[i].label} — ${K.found}`
    const nf = found.filter(Boolean).length
    if (nf === 1) ctx.insight(F(K.insights[0]), F(K.insights[0].detail))
    if (nf < found.length) ctx.prompt(fill(K.left, { n: found.length - nf })) // H5: how many faces are still hidden
    if (found.every(Boolean)) {
      root.classList.add('all')
      screen.disabled = false
      later(type, ctx.reduced ? 0 : 900)
    }
  }
  /** Tab + Enter (or a tap): the eye glides to that thing's sweet spot */
  let hold: { x: number; y: number } | null = null
  let holdT = 0
  function go(i: number, e?: MouseEvent) {
    if (low) return see(i)
    hold = e && e.detail ? { x: e.clientX, y: e.clientY } : { x: -1e4, y: -1e4 }
    holdT = performance.now()
    inside[i] = false
    set(SWEET[i][0], SWEET[i][1])
  }

  // ── ELIZA, 1966: the stele's screen lights phosphor green and types, then the second insight ──
  const timers: number[] = []
  const later = (fn: () => void, ms: number) => void timers.push(window.setTimeout(fn, ms))
  ctx.onCleanup(() => timers.forEach(clearTimeout))
  function type(again = false) {
    root.classList.add('eliza')
    timers.forEach(clearTimeout)
    const lines: [HTMLElement, string][] = [[user, K.eliza.user], [bot, K.eliza.bot]]
    const done = () => {
      if (read) return
      read = true
      ctx.chime('ok')
      ctx.insight(F(K.insights[1]), F(K.insights[1].detail))
    }
    if (ctx.reduced) {
      lines.forEach(([el, t]) => (el.textContent = t))
      return done()
    }
    lines.forEach(([el]) => (el.textContent = ''))
    let at = again ? 200 : 500
    for (const [el, t] of lines) {
      for (let k = 1; k <= t.length; k++) later(() => (el.textContent = t.slice(0, k)), (at += k === 1 ? 0 : 42))
      at += 650
    }
    later(done, at)
  }

  // ── input: the mouse is the eye; a finger drags it; the phone's tilt moves it ──
  if (!low) {
    let rect: DOMRect | null = null
    let drag: { id: number; x: number; y: number; bx: number; by: number } | null = null
    const g0 = { x: NaN, y: NaN }
    const onEnter = () => void (rect = root.getBoundingClientRect())
    const onMove = (e: PointerEvent) => {
      if (drag && e.pointerId === drag.id) {
        rect ??= root.getBoundingClientRect()
        return aim(drag.bx + (e.clientX - drag.x) / (rect.width * 0.42), drag.by + (e.clientY - drag.y) / (rect.height * 0.42))
      }
      if (e.pointerType !== 'mouse') return
      if (hold) {
        if (Math.hypot(e.clientX - hold.x, e.clientY - hold.y) < 70) return
        hold = null
      }
      rect ??= root.getBoundingClientRect()
      aim(((e.clientX - rect.left) / rect.width) * 2.3 - 1.15, ((e.clientY - rect.top) / rect.height) * 2.3 - 1.15)
    }
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return
      rect = root.getBoundingClientRect()
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, bx: tgt.x, by: tgt.y }
    }
    const onUp = (e: PointerEvent) => {
      if (drag && e.pointerId === drag.id) drag = null
    }
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null || drag || (hold && performance.now() - holdT < 3000)) return
      if (Number.isNaN(g0.x)) (g0.x = e.gamma), (g0.y = e.beta)
      aim((e.gamma - g0.x) / 18, (e.beta - g0.y) / 18)
    }
    root.addEventListener('pointerenter', onEnter)
    root.addEventListener('pointermove', onMove)
    root.addEventListener('pointerdown', onDown)
    root.addEventListener('pointerup', onUp)
    root.addEventListener('pointercancel', onUp)
    addEventListener('deviceorientation', onTilt)
    ctx.onCleanup(() => removeEventListener('deviceorientation', onTilt))
    ctx.onCleanup(onSize(root, () => void (rect = null)))
  }
  // living mist drifts at quality=high, and rests after 10 s without input
  if (!low && !ctx.reduced) {
    let idle = 0
    const wake = () => {
      root.classList.add('live')
      clearTimeout(idle)
      idle = window.setTimeout(() => root.classList.remove('live'), 10000)
    }
    wake()
    root.addEventListener('pointermove', wake)
    root.addEventListener('keydown', wake)
    ctx.onCleanup(() => clearTimeout(idle))
  }
}

// ───────────── the seven layers ─────────────

/** 7 · sky: a wide moonlit glow, the moon with its seas (two of them are the moon-face's eyes). */
function sky(g: Geo, id: string, face: ReturnType<typeof faces>[number]): SVGElement[] {
  const [mx, my] = g.moon, R = g.R
  const maria = blob(mx - R * 0.08, my + R * 0.42, R * 0.22, R * 0.12, 2731, 0.3) + blob(mx + R * 0.46, my + R * 0.18, R * 0.14, R * 0.2, 2732, 0.3) + blob(mx - R * 0.5, my + R * 0.2, R * 0.12, R * 0.1, 2733, 0.3)
  const eyes = face.eyes.map(([x, y], i) => blob(x, y, face.er[0], face.er[1], 2734 + i, 0.22, 12)).join('')
  return [
    s('defs', null,
      rad(`${id}-glow`, [[0, '--moon', 0.32], [0.3, '--moon', 0.1], [1, '--moon', 0]]),
      rad(`${id}-disc`, [[0, '--moon', 1], [0.75, '--moon', 1], [1, '--moon', 0.82]], { cx: mx - R * 0.3, cy: my - R * 0.3, r: R * 1.4 })),
    s('ellipse', { class: 't27f-skyglow', cx: f1(mx), cy: f1(my), rx: f1(Math.max(g.W * 0.45, R * 8)), ry: f1(Math.max(g.H * 0.42, R * 6)), fill: `url(#${id}-glow)` }),
    s('circle', { class: 't27f-halo', cx: f1(mx), cy: f1(my), r: f1(R * 2.4), fill: 'url(#p2-halo)' }),
    s('circle', { class: 't27f-disc', cx: f1(mx), cy: f1(my), r: f1(R), fill: `url(#${id}-disc)` }),
    s('path', { class: 't27f-maria', d: maria, filter: 'url(#ink-wash)' }),
    s('path', { class: 't27f-maria t27f-eyes', d: eyes, filter: 'url(#ink-wash)' }),
    s('circle', { class: 't27f-moonrim', cx: f1(mx), cy: f1(my), r: f1(R) }),
  ]
}

/** 6 · far ranges standing in the mist at the horizon. */
function far(g: Geo): SVGElement[] {
  const { W, H, yh } = g
  return [
    hills(-W * 0.2, W * 1.2, yh + 2, H * (g.land ? 0.24 : 0.2), 2735, 0.92, g.land ? 6 : 4),
    mist(W * 0.5, yh - H * 0.04, W * 0.8, H * 0.07),
    hills(-W * 0.22, W * (g.land ? 0.42 : 0.5), yh + 4, H * 0.13, 2736, 0.55, 2),
    hills(W * (g.land ? 0.66 : 0.6), W * 1.22, yh + 4, H * 0.1, 2737, 0.6, 2),
    mist(W * 0.2, yh, W * 0.5, H * 0.05),
    mist(W * 0.85, yh + H * 0.005, W * 0.5, H * 0.05),
  ]
}

/** 5 · a long cloud bank drifting left of the moon; one dark tendril (the moon-face's mouth) reaches across. */
function cloud(g: Geo, wisp: Pt[], mw: number): SVGElement[] {
  const [mx, my] = g.moon, R = g.R
  const lens = (x0: number, y0: number, len: number, w: number) =>
    `M${f1(x0)} ${f1(y0)}Q${f1(x0 + len * 0.42)} ${f1(y0 - w * 1.8)} ${f1(x0 + len)} ${f1(y0 - w * 0.3)}Q${f1(x0 + len * 0.55)} ${f1(y0 + w * 0.7)} ${f1(x0)} ${f1(y0)}Z`
  const L = g.land ? g.W * 0.34 : g.W * 0.7
  const x1 = wisp[0][0] - R * 0.15, y1 = wisp[0][1] + R * 0.12
  const x0 = x1 - L
  // the bank: soft puffs along a line, their bellies in shade, their tops caught by the moon; thin stratus streaks beside
  const puffs: [number, number, number, number][] = [[0.08, 0.3, 0.14, 0.34], [0.26, 0.08, 0.2, 0.46], [0.47, 0.2, 0.2, 0.4], [0.66, 0.06, 0.17, 0.42], [0.84, 0.18, 0.13, 0.3], [0.97, 0.1, 0.07, 0.2]]
  let body = '', belly = '', top = ''
  puffs.forEach(([u, v, k, q], i) => {
    const cx = x0 + L * u, cy = y1 + R * v, rx = L * k, ry = R * q
    body += blob(cx, cy, rx, ry, 2780 + i, 0.18, 20)
    belly += blob(cx + rx * 0.06, cy + ry * 0.5, rx * 0.9, ry * 0.42, 2786 + i, 0.2, 16)
    top += stroke(Array.from({ length: 10 }, (_, k2) => {
      const a = Math.PI * (1.12 + k2 * 0.07)
      return [cx + Math.cos(a) * rx * 0.96, cy + Math.sin(a) * ry * 0.96] as Pt
    }), R * 0.05, 0.25, 0.3, 0.1)
  })
  body += lens(x0 - L * 0.2, y1 + R * 0.62, L * 0.7, R * 0.08) + lens(x0 + L * 0.3, y1 + R * 0.78, L * 0.6, R * 0.06)
  const under = stroke(curve([x0 + L * 0.05, y1 + R * 0.5], [x0 + L * 0.5, y1 + R * 0.7], [x1, y1 + R * 0.4], 14), R * 0.05, 0.2, 0.4, 0.2)
  // the tendril: from the bank's end, thin, then the stroke that crosses the disc at the sweet spot
  const tail = curve([x1 - L * 0.12, y1 + R * 0.05], [(x1 + wisp[0][0]) / 2, y1 - R * 0.05], wisp[0], 8)
  const strand = [...curve(wisp[0], [wisp[1][0] - (wisp[2][0] - wisp[0][0]) * 0.25, wisp[1][1] + mw * 0.6], wisp[1], 8), ...curve(wisp[1], [wisp[1][0] + (wisp[2][0] - wisp[0][0]) * 0.25, wisp[1][1] + mw * 0.4], wisp[2], 8).slice(1)]
  // a second, thinner streak right of the moon for balance
  const sx = mx + R * 1.6, sy = my + R * 0.9
  return [
    s('path', { class: 't27f-cloud', d: body + lens(sx, sy, R * 4.2, R * 0.1) + lens(sx + R * 1.2, sy + R * 0.3, R * 2.4, R * 0.06), filter: 'url(#ink-wash)' }),
    s('path', { class: 't27f-cloud-belly', d: belly, filter: 'url(#ink-wash)' }),
    s('path', { class: 't27f-cloud-top', d: top + stroke([[sx + R * 0.3, sy - R * 0.12], [sx + R * 2.2, sy - R * 0.28], [sx + R * 3.8, sy - R * 0.1]], R * 0.04, 0.2, 0.3, 0.1) }),
    s('path', { class: 't27f-cloud-ink', d: under, filter: 'url(#ink-rough)' }),
    s('path', { class: 't27f-wisp', d: stroke(tail, mw * 0.55, 0.4, 0.05, 0.3), filter: 'url(#ink-wash)' }),
    s('path', { class: 't27f-wisp t27f-mouth', d: stroke(strand, mw, 0.15, 0.2, 0.25), filter: 'url(#ink-wash)' }),
  ]
}

/** The sand at eye level: rake rows crowding toward the horizon, scattered grit; it shears with the eye (drawn deep below the art). */
function floor(g: Geo, id: string): SVGElement[] {
  const { W, H, Hr, yh } = g
  const r = rng(2738)
  const x0 = -W * 0.4, x1 = W * 1.4, y1 = Hr + 420
  let rows = '', hi = ''
  const N = g.land ? 30 : 24
  for (let i = 1; i <= N; i++) {
    const t = Math.pow(i / N, 1.9)
    const y = yh + (y1 - yh) * t
    const w = 0.45 + t * 2
    for (let x = x0 + r() * 30; x < x1; ) {
      const len = 80 + r() * 260
      const pts: Pt[] = [[x, y + (r() - 0.5) * t * 3], [x + len * 0.5, y + (r() - 0.5) * t * 4], [x + len, y + (r() - 0.5) * t * 3]]
      if (r() < 0.86) {
        rows += stroke(pts, w, 0.25, 0.25, 0.15)
        hi += stroke(pts.map(([a, b]) => [a, b + 0.8 + t * 2] as Pt), w * 0.75, 0.25, 0.25, 0.15)
      }
      x += len + 4 + r() * 50
    }
  }
  let peb = ''
  for (let i = 0; i < 90; i++) {
    const t = Math.pow(r(), 0.7), y = yh + (Hr - yh) * t, x = x0 + r() * (x1 - x0)
    peb += blob(x, y, 0.6 + t * 2.2, 0.4 + t * 1.1, i, 0.3, 6)
  }
  // where things stand the sand gives way to moss, and the rake runs round them in broken rings
  let moss = '', mossHi = '', tufts = '', rings = '', ringsHi = ''
  const patch = (cx: number, cy: number, rx: number, ry: number, seed: number) => {
    for (let i = 0; i < 8; i++) {
      const a = r() * Math.PI * 2, q = Math.sqrt(r())
      moss += blob(cx + Math.cos(a) * rx * q * 0.62, cy + Math.sin(a) * ry * q * 0.5, rx * (0.22 + r() * 0.32), ry * (0.3 + r() * 0.36), seed + i, 0.32, 14)
    }
    for (let i = 0; i < 5; i++) mossHi += blob(cx + (r() - 0.35) * rx * 0.9, cy - ry * 0.25 + (r() - 0.5) * ry * 0.4, rx * (0.06 + r() * 0.08), ry * (0.1 + r() * 0.1), seed + 20 + i, 0.3, 10)
    for (let i = 0; i < 30; i++) {
      const a = r() * Math.PI * 2, tx = cx + Math.cos(a) * rx * (0.55 + r() * 0.3), ty = cy + Math.sin(a) * ry * (0.5 + r() * 0.3), l = 2 + ry * 0.25 * r()
      tufts += stroke([[tx, ty], [tx + (r() - 0.5) * l * 0.6, ty - l]], 1 + r(), 0.1, 0.6, 0.2)
    }
  }
  const ring = (cx: number, cy: number, rx: number, ry: number, k: number) => {
    for (let j = 0; j < k; j++) {
      const ax = rx * (1 + j * 0.24), ay = ry * (1 + j * 0.3)
      for (let a = r() * 30; a < 350; ) {
        const len = 40 + r() * 80, pts: Pt[] = []
        for (let q = 0; q <= 10; q++) {
          const th = ((a + (len * q) / 10) * Math.PI) / 180
          pts.push([cx + Math.cos(th) * ax, cy + Math.sin(th) * ay])
        }
        rings += stroke(pts, 1.1 + j * 0.15, 0.2, 0.2, 0.2)
        ringsHi += stroke(pts.map(([px, py]) => [px, py + 1.4] as Pt), 0.9, 0.2, 0.2, 0.2)
        a += len + 6 + r() * 16
      }
    }
  }
  const [sx, sy] = g.stele, [lx, ly] = g.lamp, [kx, ky] = g.rock
  patch(sx + g.sw * 0.1, sy + g.sh * 0.04, g.sw * 1.05, g.sh * 0.12, 2700)
  ring(sx, sy + g.sh * 0.03, g.sw * 1.0, g.sh * 0.12, 3)
  patch(lx - g.lh * 0.04, ly + g.lh * 0.012, g.lh * 0.32, g.lh * 0.035, 2710)
  ring(lx, ly + g.lh * 0.01, g.lh * 0.36, g.lh * 0.042, 3)
  patch(kx + g.rw * 0.36, ky + g.rh * 0.06, g.rw * 0.5, g.rh * 0.08, 2720)
  // a moss island out on the sand between the rock and the lantern, the rake bending round it
  const ix = g.land ? W * 0.55 : W * 0.6, iy = g.land ? yh + (Hr - yh) * 0.62 : yh + (Hr - yh) * 0.4
  patch(ix, iy, g.land ? W * 0.07 : W * 0.12, g.land ? H * 0.025 : H * 0.018, 2730)
  ring(ix, iy, g.land ? W * 0.075 : W * 0.13, g.land ? H * 0.028 : H * 0.02, 3)
  return [
    s('defs', null, lin(`${id}-sand`, 0, yh - 6, 0, Hr, [[0, '--t27-sand', 0], [0.12, '--t27-sand', 1], [0.7, '--t27-sand', 1], [1, '--t27-sand-near', 1]], true)),
    s('rect', { x: f1(x0), y: f1(yh - 6), width: f1(x1 - x0), height: f1(y1 - yh + 6), fill: `url(#${id}-sand)` }),
    s('path', { class: 't27f-rake', d: rows }),
    s('path', { class: 't27f-rake-hi', d: hi }),
    s('path', { class: 't27f-peb', d: peb }),
    s('path', { class: 't27f-ring', d: rings }),
    s('path', { class: 't27f-ring-hi', d: ringsHi }),
    s('path', { class: 't27f-fmoss', d: moss, filter: 'url(#ink-wash)' }),
    s('path', { class: 't27f-fmoss-hi', d: mossHi, filter: 'url(#ink-wash)' }),
    s('path', { class: 't27f-tuft', d: tufts }),
    mist(W * 0.5, yh + 2, W * 0.9, (Hr - yh) * 0.06),
  ]
}

/**
 * 4 · under an old pine, deep in its shade: a small dark stele. Lines are cut into its face (ELIZA's words, once the
 * three faces are found the cuts fill with phosphor light: the glow lives in the letters, it spills on the stone and the sand).
 */
function steleArt(g: Geo, id: string): SVGElement[] {
  const [x, y] = g.stele, w = g.sw, hh = g.sh
  const r = rng(2742)
  const slab = `M${f1(x - w * 0.47)} ${f1(y - hh * 0.06)}L${f1(x - w * 0.43)} ${f1(y - hh * 0.86)}Q${f1(x - w * 0.36)} ${f1(y - hh * 1.04)} ${f1(x + w * 0.02)} ${f1(y - hh * 1.02)}Q${f1(x + w * 0.4)} ${f1(y - hh * 1.01)} ${f1(x + w * 0.44)} ${f1(y - hh * 0.84)}L${f1(x + w * 0.47)} ${f1(y - hh * 0.06)}Z`
  const side = `M${f1(x - w * 0.47)} ${f1(y - hh * 0.06)}L${f1(x - w * 0.55)} ${f1(y - hh * 0.1)}L${f1(x - w * 0.5)} ${f1(y - hh * 0.88)}L${f1(x - w * 0.43)} ${f1(y - hh * 0.86)}Z`
  const base = `M${f1(x - w * 0.62)} ${f1(y + 2)}L${f1(x - w * 0.6)} ${f1(y - hh * 0.08)}L${f1(x + w * 0.6)} ${f1(y - hh * 0.08)}L${f1(x + w * 0.63)} ${f1(y + 2)}Z`
  const px = x - w * 0.42, py = y - hh * 0.8, pw = w * 0.84, ph = hh * 0.62
  // the cut lines: words worn by weather — a dark groove and a pale lower lip, broken into letters
  let groove = '', lip = ''
  for (let k = 0; k < 4; k++) {
    const ly = py + ph * (0.14 + k * 0.22), end = px + pw * (k === 3 ? 0.55 : 0.9 - r() * 0.1)
    for (let lx = px + pw * 0.06; lx < end; ) {
      const len = 3 + r() * 9
      groove += stroke([[lx, ly], [lx + len, ly + (r() - 0.5)]], 2.2, 0.2, 0.2, 0.3)
      lip += stroke([[lx + 0.6, ly + 1.6], [lx + len + 0.6, ly + 1.6]], 1, 0.2, 0.2, 0.3)
      lx += len + 2 + (r() < 0.2 ? 6 : 1.5 * r())
    }
  }
  let lichen = ''
  for (let i = 0; i < 18; i++) {
    const lx = x + (r() - 0.5) * w * 0.9, ly = y - hh * (0.08 + r() * 0.92)
    if (lx > px - 3 && lx < px + pw + 3 && ly > py - 3 && ly < py + ph + 3) continue
    lichen += blob(lx, ly, 1.5 + r() * 3, 1 + r() * 2, 2743 + i, 0.3, 7)
  }
  const pineH = g.land ? g.H * 0.44 : g.H * 0.36
  return [
    s('defs', null,
      lin(`${id}-st`, 0, 0, 1, 0.2, [[0, '--rock-lo', 1], [0.65, '--rock-lo', 1], [1, '--rock-mid', 1]]),
      rad(`${id}-phos`, [[0, '--t27-phos', 0.55], [0.5, '--t27-phos', 0.16], [1, '--t27-phos', 0]]),
      rad(`${id}-phosface`, [[0, '--t27-phos', 0.5], [1, '--t27-phos', 0]])),
    s('g', { class: 't27f-pine' }, pine(x + (g.land ? -w * 0.75 : w * 0.42), y - 2, pineH, 2744, -1)),
    mist(x, y - hh * 0.3, w * 2.6, hh * 0.5),
    s('ellipse', { class: 't27-contact', cx: f1(x + 3), cy: f1(y + 2), rx: f1(w * 0.72), ry: f1(Math.max(4, hh * 0.05)) }),
    s('ellipse', { class: 't27f-phos-pool', cx: f1(x), cy: f1(y + hh * 0.07), rx: f1(w * 1.7), ry: f1(hh * 0.26), fill: `url(#${id}-phos)` }),
    s('path', { class: 't27-l-side', d: base, filter: 'url(#ink-rough)' }),
    s('path', { class: 't27-l-side', d: side, filter: 'url(#ink-rough)' }),
    s('path', { class: 't27f-slab', d: slab, fill: `url(#${id}-st)`, filter: 'url(#ink-rough)' }),
    s('path', { class: 't27f-slab-shade', d: slab, filter: 'url(#ink-wash)' }),
    s('ellipse', { class: 't27f-phos-face', cx: f1(x), cy: f1(py + ph * 0.48), rx: f1(pw * 0.62), ry: f1(ph * 0.7), fill: `url(#${id}-phosface)` }),
    s('path', { class: 't27f-groove', d: groove }),
    s('path', { class: 't27f-groove-lip', d: lip }),
    s('path', { class: 't27f-lichen', d: lichen }),
    s('path', { class: 't27f-phos-lip', d: stroke([[x - w * 0.6, y - hh * 0.07], [x + w * 0.6, y - hh * 0.07]], 1.4, 0.2, 0.2, 0.2) }),
    s('path', { class: 't27-rim', d: stroke([[x + w * 0.02, y - hh * 1.02], [x + w * 0.4, y - hh * 1.0], [x + w * 0.45, y - hh * 0.8], [x + w * 0.47, y - hh * 0.1]], 1.6, 0.2, 0.3, 0.2) }),
    s('path', { class: 't27-edge', d: stroke([[x - w * 0.55, y - hh * 0.1], [x - w * 0.5, y - hh * 0.88], [x - w * 0.36, y - hh * 1.03], [x + w * 0.02, y - hh * 1.03]], 2, 0.1, 0.3, 0.3) + stroke([[x - w * 0.62, y + 2], [x + w * 0.63, y + 2]], 2.2, 0.1, 0.1, 0.4), filter: 'url(#ink-rough)' }),
  ]
}

/** 2 · the moss rock's mouth: a crack across its face (only a crack, until the eyes above it line up). */
function rockMouth(f: ReturnType<typeof faces>[number]): SVGElement[] {
  const c = crack(f.mouth, f.mw, 2745)
  return [s('path', { class: 't27f-crack-lip', d: c.lip }), s('path', { class: 't27f-crack t27f-mouth', d: c.split, filter: 'url(#ink-rough)' })]
}

/** 1 · nearest: dark grass at the foot, two seed heads on tall stems (the rock's eyes), a pine bough with a bare drooping twig (the lantern's mouth). */
function near(g: Geo, id: string, eyes: Pt[], er: Pt, twig: Pt[], tw: number, lu: number, low: boolean): SVGElement[] {
  const { W, Hr, H } = g
  const r = rng(2746)
  const foot = Hr + 170 // the layer rises up to ~150 px: keep the roots out of sight
  const blade = (x: number, hh: number, lean: number, w: number) =>
    stroke(curve([x, foot], [x + lean * 0.15, Hr - hh * 0.45], [x + lean, Hr - hh], 10), w, 0.04, 0.7, 0.08)
  // clumps: thick in the corners, a thin tuft mid-left, the middle open to the sand
  let blades = ''
  const clumps: [number, number, number][] = g.land ? [[-0.02, 34, 1], [0.13, 18, 0.7], [0.44, 7, 0.45], [0.9, 26, 0.9], [1.03, 20, 1]] : [[0, 18, 1], [0.95, 16, 0.9], [0.5, 5, 0.4]]
  for (const [cx, n, k] of clumps) {
    for (let i = 0; i < n; i++) {
      const x = W * cx + (r() - 0.5) * W * (g.land ? 0.09 : 0.2)
      const hh = H * (0.05 + r() * r() * 0.22) * k * (g.land ? 1 : 0.85)
      blades += blade(x, hh, (r() - 0.5) * hh * 0.9 + (cx < 0.5 ? -1 : 1) * hh * 0.15, 2.4 + r() * 4.2)
    }
  }
  // the two tall stems and their dark heads, rising out of the left clump among a few tall blades
  for (let i = 0; i < 7; i++) {
    const x = eyes[0][0] - W * 0.05 + r() * W * 0.08
    const hh = (Hr - eyes[0][1]) * (0.45 + r() * 0.4)
    blades += blade(x, hh, (r() - 0.6) * hh * 0.35, 2 + r() * 2.2)
  }
  let stems = '', heads = ''
  const decoys: Pt[] = [[eyes[0][0] - W * (g.land ? 0.1 : 0.16), eyes[0][1] + H * 0.12], [eyes[1][0] + W * (g.land ? 0.14 : 0.2), eyes[1][1] + H * 0.2], [W * 0.03, Hr - H * 0.2], [W * (g.land ? 0.93 : 0.9), Hr - H * 0.17]]
  decoys.forEach(([x, y], i) => {
    const bx = x + (i % 2 ? 10 : -12)
    stems += stroke(curve([bx, foot], [bx + (x - bx) * 0.3, y + (Hr - y) * 0.5], [x, y + er[1] * 0.6], 12), 1.8, 0.02, 0.35, 0.5)
    heads += blob(x, y, er[0] * (0.75 + i * 0.08), er[1] * (0.8 + i * 0.06), 2770 + i, 0.14, 12)
  })
  eyes.forEach(([x, y], i) => {
    const bx = x - W * (0.035 - i * 0.02)
    stems += stroke(curve([bx, foot], [bx + (x - bx) * 0.2 + (i ? 10 : -10), y + (Hr - y) * 0.45], [x, y + er[1] * 0.7], 16), 2, 0.02, 0.35, 0.5)
    heads += blob(x, y, er[0], er[1], 2747 + i, 0.12, 12)
    heads += stroke([[x, y - er[1] * 0.9], [x + (i ? 2 : -2), y - er[1] * 1.9]], 1.6, 0.05, 0.6, 0.2)
  })
  // the bough: down from the top-right corner, thick with needle pads, ending in a bare twig that sags through the mouth.
  // Its elbow stays clear of the lantern's eaves (2.25 lu) even at the sweet spot: only the thin twig crosses the firebox.
  const [m0, m1, m2] = twig
  const start: Pt = [W + H * 0.06, -H * 0.1]
  const elbow: Pt = [m2[0] + lu * 2.7, m2[1] - lu * 0.8]
  const branch = curve(start, [elbow[0] + H * 0.08, elbow[1] - H * 0.26], elbow, 18)
  const fall = curve(elbow, [m2[0] + lu * 1.3, m2[1] - lu * 0.9], m2, 10)
  const sag = [...curve(m2, [m1[0] + (m2[0] - m1[0]) * 0.45, m1[1] + tw * 0.7], m1, 8), ...curve(m1, [m1[0] - (m1[0] - m0[0]) * 0.45, m1[1] + tw * 0.5], m0, 8).slice(1)]
  const tip: Pt = [m0[0] - H * (g.land ? 0.045 : 0.04), m0[1] - H * 0.03]
  const lift = curve(m0, [m0[0] - (m0[0] - tip[0]) * 0.5, m0[1] + tw * 0.6], tip, 6)
  let pads = '', needles = '', lit = ''
  const pad = (px: number, py: number, k: number, seed: number) => {
    const pw = H * 0.13 * k
    pads += blob(px, py - pw * 0.04, pw * 0.66, pw * 0.24, seed, 0.3, 18)
    for (let f = 0; f < 4; f++) {
      const ox = px + (f - 1.5) * pw * 0.28 + (r() - 0.5) * pw * 0.06, oy = py + pw * 0.04
      for (let j = 0; j < 18; j++) {
        const a = Math.PI * (1.04 + (j / 17) * 0.92) + (r() - 0.5) * 0.12
        const l = pw * (0.3 + r() * 0.14)
        const end: Pt = [ox + Math.cos(a) * l, oy + Math.sin(a) * l * 0.72]
        needles += stroke([[ox, oy], end], 1.4 + r() * 1.4, 0.05, 0.6, 0.15)
        if (a < Math.PI * 1.45 && r() < 0.5) lit += stroke([[ox + (end[0] - ox) * 0.6, oy + (end[1] - oy) * 0.6], end], 1.1, 0.2, 0.5, 0.1)
      }
      for (let j = 0; j < 6; j++) {
        const a = Math.PI * (0.25 + r() * 0.5), l = pw * (0.12 + r() * 0.1)
        needles += stroke([[ox, oy], [ox + Math.cos(a) * l, oy + Math.sin(a) * l]], 1.2, 0.05, 0.6, 0.15)
      }
    }
  }
  pad(branch[3][0], branch[3][1], 1.6, 2748)
  pad(branch[8][0] - H * 0.04, branch[8][1] + H * 0.01, 1.35, 2749)
  pad(branch[12][0] + H * 0.05, branch[12][1] - H * 0.02, 1.15, 2752)
  pad(branch[15][0] - H * 0.03, branch[15][1] - H * 0.035, 0.85, 2750)
  pad(tip[0] - 4, tip[1], 0.45, 2751)
  // nearest of all, the bough is the most out of focus (the grass and the seed heads a little less, they make the rock's eyes)
  const blur = (k: string, sd: number) => s('filter', { id: `${id}-${k}`, x: '-8%', y: '-8%', width: '116%', height: '116%' }, s('feGaussianBlur', { stdDeviation: sd }))
  return [
    s('defs', null, low ? null : blur('blur', g.land ? 1.8 : 1.3), low ? null : blur('blur2', g.land ? 3.6 : 2.4)),
    s('g', low ? { class: 't27f-near t27f-bough-g' } : { class: 't27f-near t27f-bough-g', filter: `url(#${id}-blur2)` },
      s('path', { class: 't27f-pad', d: pads }),
      s('path', { class: 't27f-bough', d: stroke(branch, H * 0.022, 0.0, 0.2, 0.4) + stroke(fall, tw * 1.4, 0.05, 0.1, 0.7) }),
      s('path', { class: 't27f-needle', d: needles }),
      s('path', { class: 't27f-needlelit', d: lit })),
    s('g', low ? { class: 't27f-near' } : { class: 't27f-near', filter: `url(#${id}-blur)` },
      s('path', { class: 't27f-blade', d: blades }),
      s('path', { class: 't27f-blade t27f-stem', d: stems }),
      s('path', { class: 't27f-head', d: heads }),
      s('path', { class: 't27f-bough', d: stroke(lift, tw * 0.75, 0.1, 0.6, 0.3) }),
      s('path', { class: 't27f-bough t27f-mouth', d: stroke(sag, tw, 0.1, 0.1, 0.6) }),
      s('path', { class: 't27f-nearrim', d: eyes.map(([x, y], i) => stroke(Array.from({ length: 9 }, (_, k) => {
        const a = -Math.PI * 0.5 + (k / 8) * Math.PI * 0.75
        return [x + Math.cos(a) * er[0] * 1.02, y + Math.sin(a) * er[1] * 1.02] as Pt
      }), 1.6, 0.3, 0.3, 0.1) + (i ? '' : '')).join('') + stroke(sag.map(([a, b]) => [a, b - tw * 0.5] as Pt), tw * 0.3, 0.2, 0.2, 0.1) })),
  ]
}

/** The face itself, as it reads from its sweet spot (eyes + mouth + a breath of a jaw), in vermilion and in ink. */
function faceArt(f: ReturnType<typeof faces>[number]): SVGElement[] {
  const eyes = f.eyes.map(([x, y], i) => blob(x, y, f.er[0] * 1.05, f.er[1] * 1.05, 2760 + i, 0.15, 12)).join('')
  const [a, b, c] = f.mouth
  const mouth = stroke([...curve(a, [(a[0] + b[0]) / 2, b[1] + f.mw * 0.3], b, 8), ...curve(b, [(b[0] + c[0]) / 2, b[1] + f.mw * 0.2], c, 8).slice(1)], f.mw * 1.1, 0.15, 0.2, 0.3)
  const jaw = stroke(Array.from({ length: 19 }, (_, i) => {
    const t = Math.PI * (0.08 + (i / 18) * 0.84)
    return [f.c[0] + Math.cos(t) * f.f * 1.55, f.c[1] - f.f * 0.1 + Math.sin(t) * f.f * 1.45] as Pt
  }), f.mw * 0.5, 0.3, 0.3, 0.1)
  return [s('path', { class: 't27f-fx-v', d: eyes + mouth }), s('path', { class: 't27f-fx-jaw', d: jaw })]
}
