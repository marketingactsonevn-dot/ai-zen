import './ask.css'
import { fill, h, nextId, s } from '../../core/dom'
import { load, save } from '../../core/store'
import { sliced } from '../../core/chunk'
import { blob, clamp, onDigit, onSize, rng, stableHeight, stroke, type Pt } from '../../ui/part2/ink'
import { guide } from '../../ui/part2/guide'
import type { SceneCtx } from '../types'
import { C } from './shell'
import type { Answers } from './types'
import { clip, f1, g39Defs, idle, mossBed, parallax, rim, smoothD } from './g39'

const K = C.scenes.ask
export const KEY = 't39-answers'
/** answers live only in this browser (localStorage), never sent anywhere */
export const loadAnswers = () => load<Answers>(KEY, {})

type Geo = { W: number; H: number; T0: number; Ha: number; wide: boolean; d: number; dir: Pt; perp: Pt; S: Pt[]; sw: number; sh: number; wall: number; pd: number; P: number; Dz: number; yc: number; ox: number; oy: number; box: [number, number, number, number] }

/**
 * Where the leaves of one question float, round their stone, in leaf widths (x right, y down). Wide: a crescent on the
 * stone's right, clear of the path that runs on to the upper right. Tall: an arc above and an arc below the stone.
 */
const ARC: Record<'w6' | 'w3' | 't6' | 't3', Pt[]> = {
  w6: [[1.95, -1.1], [3.2, -0.5], [1.95, 0.22], [3.25, 0.82], [1.45, 1.5], [2.65, 1.86]],
  w3: [[2.0, -0.62], [3.05, 0.42], [1.78, 1.2]],
  t6: [[-1.18, -1.2], [0, -1.5], [1.18, -1.2], [-1.18, 1.2], [0, 1.5], [1.18, 1.2]],
  // round the stone, clear of the next stone (up right) and the answered one (down left)
  t3: [[-1.01, -1.08], [1.01, 0.95], [-0.27, 1.35]],
}

/**
 * Scene 1 — four questions on four stepping stones across a pond at first light, seen almost straight down (TOP 82°).
 * Layers at real depths in one CSS 3D view (the bottom with pebbles and two koi, the dark water with the dawn mirrored in
 * its far corner and the setting moon in its near one, the stones and leaves on the surface): the camera slides along the
 * diagonal path, and the layers part with depth as it moves or as the pointer / phone tilts. The current stone sits in the
 * lower-left third, its answers float as lotus leaves in a crescent on its right; a chosen leaf drifts to the stone, its
 * answer is cut into the stone's face, rings spread, the next stone rises out of the water. All four: the camera pulls
 * back over the whole path and the far lantern lights. Transforms only; the paintings are SVG built once per layout.
 */
export function askScene(ctx: SceneCtx) {
  g39Defs()
  const still = ctx.reduced || ctx.quality === 'low'
  const Q = K.questions
  const ans: Answers = loadAnswers()
  const stable = stableHeight(ctx, [K.insight])
  const gd = guide(ctx)

  const bed = s('svg', { class: 't39a-bed', 'aria-hidden': 'true' })
  const shades = h('div', { class: 't39a-shades', 'aria-hidden': 'true' })
  // each stone's shadow on the bottom: a hand's depth below it, long toward the lower left (the sun is low, upper right)
  const stSh = Q.map(() => h('i', { class: 't39a-stsh' }))
  const stShades = h('div', { class: 't39a-shades', 'aria-hidden': 'true' }, ...stSh)
  // the surface itself: glints and the low sun's sheen, nearest of the water's layers
  const spec = s('svg', { class: 't39a-spec', 'aria-hidden': 'true' })
  const koi = h('div', { class: 't39a-koi', 'aria-hidden': 'true' })
  const film = s('svg', { class: 't39a-film', 'aria-hidden': 'true' })
  const lamp = h('div', { class: 't39a-lamp', 'aria-hidden': 'true' }, lampArt())
  // the lit lantern's warmth on the water: broken ripples, never a flat band
  const streak = s('svg', { class: 't39a-streak', 'aria-hidden': 'true' })
  // the privacy note is cut into a cedar post on the near bank
  const postArt = s('svg', { class: 't39a-post-art', 'aria-hidden': 'true' })
  const post = h('div', { class: 't39a-post' }, postArt, h('p', null, K.privacy))
  const rings = h('div', { class: 't39a-rings', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'))
  const answers = Q.map(() => h('span', { class: 't39a-ans' }))
  const stones = Q.map((q, i) => h('button', { class: 't39a-stone', type: 'button', tabindex: '-1', 'aria-hidden': 'true', onClick: () => open(i, true) },
    s('svg', { class: 't39a-stone-art', 'aria-hidden': 'true' }),
    h('span', { class: 't39a-face' }, h('span', { class: 't39a-q' }, q.q), answers[i]),
    // "Câu n/4" cut into the stone's side wall, at the waterline
    h('span', { class: 't39a-n' }, fill(K.progress, { n: i + 1 }))))
  const docks = Q.map(() => h('div', { class: 't39a-dock', 'aria-hidden': 'true' }, s('svg', { class: 't39a-pad-art', viewBox: '-50 -50 100 100' })))
  const group = h('div', { class: 't39a-pads', role: 'group' })
  const top = h('div', { class: 't39a-top' }, streak, lamp, ...docks, ...stones, rings, group)
  const cam = h('div', { class: 't39a-cam' }, bed, stShades, shades, koi, film, spec, top)
  const view = h('div', { class: 't39a-view' }, cam)
  // the sky this water mirrors stays put while the view slides: dawn in the upper right, the setting moon lower left
  const sky = h('div', { class: 't39a-sky', 'aria-hidden': 'true' })
  // nearest of all: the near bank at the foot of the frame, out of focus, the post standing in it
  const near = s('svg', { class: 't39a-near', 'aria-hidden': 'true' })
  const root = h('div', { class: `t39a${still ? ' is-still' : ''}` }, h('p', { class: 'visually-hidden' }, K.art), view, sky, near, post)
  ctx.art.append(root)
  idle(ctx, root)

  let G: Geo | null = null
  let cur = -1
  // timers that outlive a gesture die with the scene
  const timers = new Set<number>()
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => (timers.delete(id), fn()), ms)
    timers.add(id)
  }
  ctx.onCleanup(() => timers.forEach((id) => clearTimeout(id)))
  let pads: HTMLButtonElement[] = []
  let shadows: HTMLElement[] = []
  /** the open leaves sink away (and leave the DOM once gone) */
  function drop(keep?: HTMLElement) {
    const old = [...pads, ...shadows].filter((p) => p !== keep)
    for (const p of old) p.classList.add('gone')
    later(() => old.forEach((p) => p.remove()), still ? 0 : 900)
  }
  let told = false
  const first = () => Q.findIndex((x) => !ans[x.id])
  const raised = (i: number) => i === 0 || !!ans[Q[i - 1].id]

  // ── camera: world (x, y) to the view's centre; pulling back is a move away along z ──────────────────────────────────

  function look(x: number, y: number, z = 0) {
    if (!G) return
    cam.style.transform = `translate3d(${f1(G.W / 2 - x)}px,${f1(G.yc - y)}px,${f1(z)}px)`
  }
  /** frame stone i: it sits in the lower-left third on wide screens, in the middle on tall ones */
  const focus = (i: number) => look(G!.S[i][0] + G!.ox, G!.S[i][1] + G!.oy)
  const par = parallax(ctx, root, (x, y) => {
    if (!G) return
    view.style.perspectiveOrigin = `${f1(G.W / 2 + x * G.W * 0.09)}px ${f1(G.yc + y * G.Ha * 0.09)}px`
    near.style.transform = `translate(${f1(-x * 30)}px,${f1(-y * 20)}px)`
    post.style.translate = `${f1(-x * 16)}px ${f1(-y * 11)}px`
  })

  // ── the leaves of one question round its stone ─────────────────────────────────────────────────────────────────────
  function offsets(n: number): Pt[] {
    const { wide, pd } = G!
    const k = !wide && n < 4 ? pd * 1.1 : pd
    const o = ARC[`${wide ? 'w' : 't'}${n > 3 ? 6 : 3}`].slice(0, n).map(([x, y]): Pt => [x * k, y * k])
    // reading order (top to bottom, left to right) = the options' order = their digit keys
    return o.sort((a, b) => Math.round((a[1] - b[1]) / 8) || a[0] - b[0])
  }

  function open(i: number, change = false) {
    if (!G || i < 0 || !raised(i)) return
    cur = i
    root.classList.remove('is-done')
    root.style.removeProperty('--k')
    lamp.classList.toggle('lit', false)
    const it = Q[i]
    const [sx, sy] = G.S[i]
    docks[i].classList.remove('on')
    const r = rng(3900 + i * 17)
    const offs = offsets(it.options.length)
    drop()
    // a phone's three leaves in one arc get a little more room for the long answers
    const pd = !G.wide && it.options.length < 4 ? Math.round(G.pd * 1.1) : G.pd
    // one vermilion dot at a time: on the first leaf in reading order, which also turns and rings the water when the
    // viewer waits (H7); the other leaves only breathe a faint ink ring
    const near0 = 0
    pads = it.options.map((o, k) => {
      const [ox, oy] = offs[k]
      // jitter: leaves never sit on a ruler
      const jx = (r() - 0.5) * pd * 0.12, jy = (r() - 0.5) * pd * 0.1
      const rot = Math.round((r() - 0.5) * 140)
      const b = h('button', {
        class: `t39a-pad${k === near0 ? ' t39a-hint' : ''}`, type: 'button', 'aria-label': fill(K.optionAria, { q: it.q, label: o.label }),
        'aria-pressed': ans[it.id] === o.id ? 'true' : 'false',
        style: `left:${f1(sx + ox + jx)}px;top:${f1(sy + oy + jy)}px;width:${pd}px;height:${pd}px;margin:${f1(-pd / 2)}px 0 0 ${f1(-pd / 2)}px;--r:${rot}deg;--i:${k}`,
        onClick: () => choose(i, o.id, b),
      }, padArt(3910 + i * 7 + k), h('span', { class: `t39a-pad-label${o.label.length > 20 ? ' long' : ''}` }, o.label))
      return b
    })
    // each leaf's soft shadow on the bottom, a hand's depth below, long toward the lower left
    shadows = pads.map((p, k) => h('i', { class: 't39a-padsh', style: `left:${f1(parseFloat(p.style.left) - pd * 0.42)}px;top:${f1(parseFloat(p.style.top) + pd * 0.3)}px;width:${f1(pd * 1.25)}px;height:${f1(pd * 0.92)}px;margin:${f1(-pd / 2)}px 0 0 ${f1(-pd * 0.62)}px;--i:${k}` }))
    shades.replaceChildren(...shadows)
    group.setAttribute('aria-label', it.q)
    group.replaceChildren(...pads)
    // H5 per question, H1 one dot (beside the words cut into the first leaf)
    ctx.prompt(fill(K.prompt, { n: i + 1 }))
    if (pads[0]) gd.dot(pads[0], { dir: [0, -1] })
    focus(i)
    if (change) (pads.find((p) => p.getAttribute('aria-pressed') === 'true') ?? pads[0])?.focus({ preventScroll: true })
    paint()
  }

  function choose(i: number, id: string, pad: HTMLButtonElement) {
    if (!G || cur !== i) return
    ans[Q[i].id] = id
    save(KEY, ans)
    cur = -2 // nothing open while the leaf drifts
    const [sx, sy] = G.S[i]
    const [dx, dy] = dockAt(i)
    // the chosen leaf drifts to its stone; the others sink away
    pad.style.transform = `translate3d(${f1(dx - parseFloat(pad.style.left))}px,${f1(dy - parseFloat(pad.style.top))}px,3px) scale(0.62)`
    pad.classList.add('chosen')
    drop(pad)
    later(() => pad.remove(), still ? 0 : 900)
    Object.assign(rings.style, { left: `${f1(sx)}px`, top: `${f1(sy)}px` })
    rings.classList.remove('go')
    void rings.offsetWidth // restart the rings
    rings.classList.add('go')
    ctx.chime('soft')
    const next = first()
    later(() => {
      paint()
      if (next >= 0) open(next)
      else finish()
      if (document.activeElement === pad || document.activeElement === document.body) (pads[0] ?? stones[i]).focus({ preventScroll: true })
    }, still ? 0 : 750)
  }

  function finish() {
    cur = -1
    drop()
    root.classList.add('is-done')
    lamp.classList.add('lit')
    if (G) {
      // pull back over the whole path, its far lantern included: the box from the first stone to the lamp fits the free
      // part of the frame (tall screens keep the foot clear for the insight)
      const { S, sw, sh, W, Ha, T0, wide } = G
      const x0 = Math.min(S[0][0], S[4][0]) - sw * 0.7, x1 = Math.max(S[0][0], S[4][0]) + sw * 0.6
      const y0 = S[4][1] - sh * 0.9, y1 = S[0][1] + sh * 0.75
      const [ax0, ax1, ay0, ay1] = wide ? [W * 0.05, W * 0.95, T0 + Ha * 0.14, T0 + Ha * 0.98] : [W * 0.08, W * 0.92, T0 + Ha * 0.06, T0 + Ha * 0.84]
      const sc = clamp(Math.min((ax1 - ax0) / (x1 - x0), (ay1 - ay0) / (y1 - y0)), 0.42, 1)
      // the answers cut into the stones keep a readable size however far the camera pulls back
      root.style.setProperty('--k', String(Math.round(100 / sc) / 100))
      const cx = (x0 + x1) / 2 - ((ax0 + ax1) / 2 - W / 2) / sc, cy = (y0 + y1) / 2 - ((ay0 + ay1) / 2 - G.yc) / sc
      look(cx, cy, G.P * (1 - 1 / sc))
    }
    paint()
    if (!told) {
      told = true
      // the insight says back what was answered: the basket on the next slide is sorted by exactly these four
      const say = (k: keyof Answers) => Q.find((q) => q.id === k)?.options.find((o) => o.id === ans[k])?.say ?? ''
      ctx.insight({ ...K.insight, text: fill(K.insight.text, { role: say('role'), goal: say('goal'), device: say('device'), budget: say('budget') }) })
      ctx.chime('ok')
    }
  }

  // the chosen leaf comes to rest against the stone's shaded flank (lower left)
  const dockAt = (i: number): Pt => [G!.S[i][0] - G!.sw * 0.5, G!.S[i][1] + G!.sh * 0.3]
  function paint() {
    if (!G) return
    Q.forEach((q, i) => {
      const st = stones[i]
      const up = raised(i)
      st.classList.toggle('up', up)
      stSh[i].classList.toggle('up', up)
      st.classList.toggle('now', cur === i)
      const a = ans[q.id]
      const label = q.options.find((o) => o.id === a)?.label
      // the answer, cut into the stone under its question
      st.classList.toggle('has', !!a && cur !== i)
      answers[i].textContent = label ?? ''
      // a raised stone with an answer is a button: touch it again to change the answer
      const live = up && !!a && cur !== i
      st.tabIndex = live ? 0 : -1
      if (live) {
        st.removeAttribute('aria-hidden')
        st.setAttribute('aria-label', fill(K.optionAria, { q: q.q, label: label ?? '' }))
      } else {
        st.setAttribute('aria-hidden', 'true')
        st.removeAttribute('aria-label')
      }
      docks[i].classList.toggle('on', !!a && cur !== i)
    })
    root.dataset.n = String(Q.filter((x) => ans[x.id]).length)
  }

  // ── layout and the paintings ───────────────────────────────────────────────────────────────────────────────────────
  let job: { cancel(): void } | null = null
  let firstLay = true
  function layout() {
    const Ha = stable(ctx.art.clientHeight)
    if (ctx.art.clientWidth < 60 || Ha < 60) return
    // the root runs full-bleed: out to the screen's sides, up under the header and down to the screen's foot (the water
    // goes on under the prompt and the rail). All reads first, then the writes.
    const W = root.clientWidth, H = ctx.el.clientHeight, T0 = -root.offsetTop, artH = ctx.art.clientHeight
    root.style.height = `${H}px`
    const wide = W > Ha * 1.1
    const sw = wide ? clamp(W * 0.15, 190, 232) : 142, sh = Math.round(sw * 0.74)
    const wall = Math.round(sh * 0.2)
    const pd = wide ? clamp(W * 0.09, 112, 132) : clamp(W * 0.27, 92, 104)
    const d = wide ? clamp(Ha * 0.66, 400, 470) : clamp(Ha * 0.52, 270, 320)
    const a = ((wide ? -42 : -64) * Math.PI) / 180
    const dir: Pt = [Math.cos(a), Math.sin(a)], perp: Pt = [-Math.sin(a), Math.cos(a)]
    const jit = [0, 0.06, -0.05, 0.04, 0]
    const S: Pt[] = [0, 1, 2, 3, 4.05].map((t, i) => [dir[0] * t * d + perp[0] * jit[i] * d, dir[1] * t * d + perp[1] * jit[i] * d])
    const pts = [S[0], S[4]]
    const m = Math.max(W, H) * 1.3
    const box: [number, number, number, number] = [Math.min(...pts.map((p) => p[0])) - m, Math.min(...pts.map((p) => p[1])) - m, Math.abs(S[4][0] - S[0][0]) + m * 2, Math.abs(S[4][1] - S[0][1]) + m * 2]
    const P = clamp(Math.max(W, H) * 0.9, 800, 1300)
    const yc = T0 + Ha * (wide ? 0.47 : 0.45)
    // where the current stone sits on screen: lower-left third (wide), the middle (tall)
    const [fx, fy] = wide ? [W * 0.29, T0 + Ha * 0.53] : [W / 2, T0 + Ha * 0.44]
    G = { W, H, T0, Ha, wide, d, dir, perp, S, sw, sh, wall, pd, P, Dz: wide ? 260 : 190, yc, ox: W / 2 - fx, oy: yc - fy, box }
    Object.assign(view.style, { perspective: `${f1(P)}px`, perspectiveOrigin: `${f1(W / 2)}px ${f1(G.yc)}px` })
    const [bx, by, bw, bh] = box
    for (const el of [bed, film, spec]) {
      el.setAttribute('viewBox', `${f1(bx)} ${f1(by)} ${f1(bw)} ${f1(bh)}`)
      Object.assign((el as SVGSVGElement).style, { left: `${f1(bx)}px`, top: `${f1(by)}px`, width: `${f1(bw)}px`, height: `${f1(bh)}px` })
    }
    // the bottom lies deep (it scales down and parts from the surface as the view moves), the koi half way up
    bed.style.transform = `translateZ(${-G.Dz}px)`
    stShades.style.transform = shades.style.transform = `translateZ(${-G.Dz + 1}px)`
    koi.style.transform = `translateZ(${f1(-G.Dz * 0.5)}px)`
    stones.forEach((st, i) => {
      Object.assign(st.style, { left: `${f1(S[i][0] - sw / 2)}px`, top: `${f1(S[i][1] - sh / 2)}px`, width: `${sw}px`, height: `${sh}px` })
      st.style.setProperty('--z', `${f1(-G!.Dz * 0.4)}px`)
      st.style.setProperty('--wall', `${wall}px`)
      const art = st.firstChild as SVGSVGElement
      art.setAttribute('viewBox', `${f1(-sw * 0.6)} ${f1(-sh * 0.62)} ${f1(sw * 1.2)} ${f1(sh * 1.24)}`)
      art.replaceChildren(...stoneTop(sw, sh, wall, 3920 + i * 11))
      // its shadow on the bottom: away from the low sun (upper right), longer than the stone, soft
      Object.assign(stSh[i].style, { left: `${f1(S[i][0] - sw * 1.25)}px`, top: `${f1(S[i][1] - sh * 0.2)}px`, width: `${f1(sw * 1.7)}px`, height: `${f1(sh * 1.1)}px` })
      const [dx, dy] = dockAt(i)
      Object.assign(docks[i].style, { left: `${f1(dx)}px`, top: `${f1(dy)}px`, width: `${f1(pd * 0.62)}px`, height: `${f1(pd * 0.62)}px` })
      ;(docks[i].firstChild as SVGSVGElement).replaceChildren(...padArt(3960 + i).childNodes)
    })
    Object.assign(lamp.style, { left: `${f1(S[4][0])}px`, top: `${f1(S[4][1])}px` })
    // the lit lamp's warmth on the water toward the viewer (down the path): short ripples, wider and fainter as they come
    {
      const rr = rng(3994)
      let dd = ''
      for (let k = 0; k < 46; k++) {
        const t = 0.12 + Math.pow(rr(), 0.8) * 1.5, side = (rr() - 0.5) * (0.12 + t * 0.32)
        const x = -dir[0] * t * d + perp[0] * side * d, y = -dir[1] * t * d + perp[1] * side * d
        const L = 8 + rr() * 26 * (1.2 - t * 0.4)
        dd += stroke([[x - L / 2, y], [x, y + (rr() - 0.5) * 2], [x + L / 2, y]], (1.2 + rr() * 3) * (1.3 - t * 0.5), 0.3, 0.3, 0.1)
      }
      const R = d * 1.8
      streak.setAttribute('viewBox', `${f1(-R)} ${f1(-R)} ${f1(R * 2)} ${f1(R * 2)}`)
      Object.assign(streak.style, { left: `${f1(S[4][0] - R)}px`, top: `${f1(S[4][1] - R)}px`, width: `${f1(R * 2)}px`, height: `${f1(R * 2)}px` })
      streak.replaceChildren(s('path', { d: dd }))
    }
    // the post stands on the near bank at the foot of the frame, lower right (the path runs from the lower left, where the
    // answered stones lie, up to the right; the leaves float between)
    const [pw, ph] = wide ? [138, 150] : [128, 112]
    const px = W - pw - (wide ? Math.max(48, W * 0.06) : 24), py = wide ? T0 + artH - ph - 30 : T0 + artH - ph - 16
    Object.assign(post.style, { left: `${f1(px)}px`, top: `${f1(py)}px`, width: `${pw}px`, height: `${ph}px` })
    postArt.setAttribute('viewBox', `-${pw} -50 ${pw * 2.3} ${ph + 90}`)
    Object.assign(postArt.style, { left: `${-pw}px`, top: '-50px', width: `${pw * 2.3}px`, height: `${ph + 90}px` })
    postArt.replaceChildren(...postPaint(pw, ph))
    near.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    near.replaceChildren(...bank(W, H, px, pw, wide))
    job?.cancel()
    job = sliced(paintWorld(), { sync: ctx.reduced || !firstLay })
    firstLay = false
    const f = first()
    if (cur === -1 || f < 0) (f >= 0 ? open(f) : finish())
    else open(cur >= 0 ? cur : f)
  }

  function* paintWorld(): Generator {
    const g = G!
    const { d, dir, perp, box, wide } = g
    const [bx, by, bw, bh] = box
    const r = rng(3901)
    // the pond: wide round the path (the view looks into water on every side), tapering at the far end so the lantern
    // stands on the far bank; t runs along the path in steps of d, side across it in half-widths
    const T0 = -1, T1 = 3.3
    // each shore has its own bays and points, so the water never reads as a band along the path
    const hwAt = (t: number, k = 1, side = 1) =>
      d * ((side > 0 ? 1.28 : 0.86) + 0.24 * Math.sin(t * 1.7 + (side > 0 ? 0.6 : 2.5)) + 0.08 * Math.sin(t * 4.3 + side)) * k * (t > 2.4 ? 1 - Math.min(1, (t - 2.4) / 0.9) * 0.5 : 1)
    const at = (t: number, side: number, k = 1): Pt => {
      const hw = hwAt(t, k, side)
      return [dir[0] * t * d + perp[0] * side * hw, dir[1] * t * d + perp[1] * side * hw]
    }
    // the shore: one side out, a round cap, the other side back, a round cap (k narrows it toward the deep)
    const ring = (k: number): Pt[] => {
      const L: Pt[] = []
      const cap = (t: number, from: number) => {
        const [cx, cy] = [dir[0] * t * d, dir[1] * t * d]
        const hw = (hwAt(t, k, 1) + hwAt(t, k, -1)) / 2
        const base = Math.atan2(perp[1], perp[0])
        for (let j = 1; j < 8; j++) {
          const q = base + from + (j / 8) * Math.PI * -1
          L.push([cx + Math.cos(q) * hw, cy + Math.sin(q) * hw])
        }
      }
      for (let t = T0; t <= T1 + 1e-6; t += 0.2) L.push(at(t, 1, k))
      cap(T1, 0)
      for (let t = T1; t >= T0 - 1e-6; t -= 0.2) L.push(at(t, -1, k))
      cap(T0, Math.PI)
      return L
    }
    const pond = smoothD(ring(1))
    const frame = `M${f1(bx)} ${f1(by)}h${f1(bw)}v${f1(bh)}h${f1(-bw)}Z`
    const P0 = at(T0 - 0.6, 0), P1 = at(T1 + 0.4, 0)
    // the bottom: sand, darker toward the deep, pebbles thick near the banks, weed (blurred and dimmed by the water above)
    let peb = '', pebHi = '', weed = ''
    const n = Math.round((d * d * 2.2) / 900)
    for (let i = 0; i < n; i++) {
      const t = T0 - 0.4 + r() * (T1 - T0 + 0.8), side = (r() < 0.5 ? -1 : 1) * Math.pow(r(), 0.3)
      const [x, y] = at(t, side, 0.98)
      const rr = 3 + r() * (6 + Math.abs(side) * 11)
      peb += blob(x, y, rr, rr * (0.6 + r() * 0.3), i + 7, 0.15, 9)
      if (r() < 0.6) pebHi += blob(x + rr * 0.2, y - rr * 0.25, rr * 0.45, rr * 0.25, i + 9, 0.2, 7)
      if (i % 80 === 79) yield
    }
    for (let i = 0; i < 34; i++) {
      const t = T0 + r() * (T1 - T0), side = (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.4)
      const [x, y] = at(t, side)
      for (let k = 0; k < 6; k++) {
        const q = r() * Math.PI * 2, L = 12 + r() * 26
        weed += stroke([[x, y], [x + Math.cos(q) * L * 0.5 + 3, y + Math.sin(q) * L * 0.5], [x + Math.cos(q) * L, y + Math.sin(q) * L]], 1.8, 0.1, 0.7, 0.2)
      }
      if (i % 12 === 11) yield
    }
    bed.replaceChildren(
      s('rect', { class: 't39a-sandbed', x: f1(bx), y: f1(by), width: f1(bw), height: f1(bh) }),
      s('path', { class: 't39a-peb', d: peb }),
      s('path', { class: 't39a-peb-hi', d: pebHi }),
      s('path', { class: 't39a-weed', d: weed }),
      // the deep: each wash darker toward the middle of the pond
      ...[0.86, 0.7, 0.54, 0.38].map((k) => s('path', { class: 't39a-deep', d: smoothD(ring(k)) })))
    yield
    // two koi gliding slowly round under the first stones, red and white through the water
    koi.replaceChildren(...[[0.4, 0.5, 0.62, 52], [1.75, -0.4, 0.78, 64]].map(([t, side, k, dur], i) => {
      const [x, y] = at(t, side)
      const R0 = d * 0.36 * k
      const id = nextId('t39a-koi')
      return h('div', { class: 't39a-fish', style: `left:${f1(x)}px;top:${f1(y)}px;--dur:${dur}s` },
        s('svg', { viewBox: '-42 -15 84 30', style: `left:${f1(R0 - d * 0.17)}px;top:${f1(-d * 0.06)}px;width:${f1(d * 0.34)}px`, class: i ? 'rev' : '' },
          s('defs', null, s('clipPath', { id }, s('path', { d: KOI_BODY }))),
          s('path', { class: 't39a-koi-fin', d: KOI_FINS }),
          s('path', { class: 't39a-koi-body', d: KOI_BODY }),
          s('path', { class: 't39a-koi-red', d: i ? blob(14, -1, 10, 6, 41, 0.3, 10) + blob(-12, 2, 9, 5, 42, 0.3, 10) : blob(4, -2, 14, 5.5, 43, 0.3, 10) + blob(24, 0, 5, 3.5, 44, 0.3, 8), 'clip-path': `url(#${id})` })))
    }))
    yield
    // the water film: dark and deep (darker than any sky), the dawn mirrored only toward the far end, the setting moon's
    // broken road on the near water, ripples; then the banks round it with their wet edge, moss and shoreline
    const sky = nextId('t39a-sky')
    const [mx, my] = at(-0.62, wide ? 0.42 : -0.16)
    let rip = '', road = ''
    for (let i = 0; i < 180; i++) {
      const [x, y] = at(T0 + r() * (T1 - T0), (r() - 0.5) * 1.8)
      const L = 14 + r() * 60
      rip += stroke([[x - L / 2, y], [x, y + (r() - 0.5) * 1.5], [x + L / 2, y]], 0.8 + r() * 1.4, 0.3, 0.3, 0.1)
      if (i % 60 === 59) yield
    }
    for (let k = 0; k < 26; k++) {
      const v = (k / 25 - 0.5) * 2
      const L = (1 - Math.abs(v) * 0.7) * d * (0.08 + r() * 0.1)
      const x = mx + (r() - 0.5) * d * 0.05, y = my + v * d * 0.3
      road += stroke([[x - L / 2, y], [x, y + (r() - 0.5) * 2], [x + L / 2, y]], 1.2 + r() * 2.4 * (1 - Math.abs(v)), 0.25, 0.25, 0.1)
    }
    // the banks: a moss lawn, its dabs, irises at the water, a few garden stones
    let dots = '', iris = '', boulder = '', bHi = ''
    for (let i = 0; i < 620; i++) {
      const tt = T0 - 1.6 + r() * (T1 - T0 + 3.2), side = (r() < 0.5 ? -1 : 1) * (1.06 + Math.pow(r(), 1.5) * 1.5)
      const [x, y] = at(tt, side)
      dots += blob(x, y, 1.5 + r() * 4.5, 1 + r() * 3, i + 51, 0.3, 7)
      if (i % 150 === 149) yield
    }
    for (let i = 0; i < 16; i++) {
      const tt = T0 + r() * (T1 - T0 + 0.4), side = (r() < 0.5 ? -1 : 1) * (0.98 + r() * 0.1)
      const [x, y] = at(tt, side)
      for (let k = 0; k < 9; k++) {
        const q = r() * Math.PI * 2, L = 12 + r() * 26
        iris += stroke([[x, y], [x + Math.cos(q) * L * 0.55, y + Math.sin(q) * L * 0.55], [x + Math.cos(q + 0.15) * L, y + Math.sin(q + 0.15) * L]], 2.6, 0.05, 0.8, 0.2)
      }
      if (i % 4 === 3) yield
    }
    for (let i = 0; i < 10; i++) {
      const tt = T0 - 0.6 + r() * (T1 - T0 + 1.4), side = (r() < 0.5 ? -1 : 1) * (1.1 + r() * 0.25)
      const [x, y] = at(tt, side)
      const rr = d * (0.05 + r() * 0.05)
      boulder += blob(x, y, rr, rr * 0.8, i + 71, 0.12, 14)
      bHi += blob(x + rr * 0.12, y - rr * 0.18, rr * 0.7, rr * 0.5, i + 72, 0.12, 12)
    }
    const shallow = (w: number, k: number) => s('path', { class: 't39a-shallow', d: pond, style: `stroke-width:${f1(w)}px;opacity:${k}` })
    const stop = (o: number, c: string, a: number) => s('stop', { offset: o, style: `stop-color:var(${c});stop-opacity:${a}` })
    film.replaceChildren(
      s('defs', null,
        s('linearGradient', { id: sky, gradientUnits: 'userSpaceOnUse', x1: f1(P0[0]), y1: f1(P0[1]), x2: f1(P1[0]), y2: f1(P1[1]) },
          stop(0, '--t39a-cool', 0.32), stop(0.2, '--t39a-cool', 0.12), stop(0.38, '--t39a-cool', 0), stop(0.48, '--t39a-warm', 0), stop(0.72, '--t39a-warm', 0.14), stop(1, '--t39a-warm', 0.3))),
      s('path', { class: 't39a-water', d: pond }),
      ...[0.86, 0.7, 0.54, 0.38].map((k) => s('path', { class: 't39a-water-mid', d: smoothD(ring(k)) })),
      ...[0.4, 0.31, 0.23, 0.16, 0.1, 0.05].map((w) => shallow(d * w, 0.05)),
      s('path', { class: 't39a-skyref', d: pond, fill: `url(#${sky})` }),
      s('ellipse', { cx: f1(mx), cy: f1(my), rx: f1(d * 0.2), ry: f1(d * 0.42), fill: 'url(#p2-halo)', class: 't39a-moonref' }),
      s('path', { class: 't39a-moonroad', d: road }),
      s('path', { class: 't39a-mooncres', d: crescentD(mx - d * 0.02, my - d * 0.2, d * 0.035) }),
      s('path', { class: 't39a-rip', d: rip }),
      s('path', { class: 't39a-bank', d: frame + pond, 'fill-rule': 'evenodd' }),
      s('path', { class: 't39a-wet', d: pond }),
      s('path', { class: 't39a-bankdots', d: dots }),
      s('path', { class: 't39a-shore', d: pond }),
      s('path', { class: 't39a-iris', d: iris }),
      s('path', { class: 't39a-boulder-sh', d: boulder, transform: `translate(${f1(-d * 0.07)} ${f1(d * 0.05)})` }),
      s('path', { class: 't39a-boulder', d: boulder }),
      s('path', { class: 't39a-boulder-hi', d: bHi }),
      mossBed(at(T0 - 0.9, 0.4)[0], at(T0 - 0.9, 0.4)[1], d * 0.34, d * 0.16, 3902),
      mossBed(at(T1 + 1.2, -0.3)[0], at(T1 + 1.2, -0.3)[1], d * 0.36, d * 0.16, 3903),
      mossBed(at(1.6, 1.3)[0], at(1.6, 1.3)[1], d * 0.26, d * 0.1, 3904),
      mossBed(at(2.5, -1.35)[0], at(2.5, -1.35)[1], d * 0.3, d * 0.12, 3905))
    yield
    // the surface: glints where the low sun catches the ripples (more toward the far, sunlit end, drawn out long across
    // the water: raking light) and the sun's sheen; two glint sets trade places slowly at quality=high (CSS, paused idle)
    const ang = Math.atan2(dir[1], dir[0])
    const glints = (seed: number, n0: number) => {
      const q = rng(seed)
      let gd = ''
      for (let i = 0; i < n0; i++) {
        const tt = T0 + Math.pow(q(), 0.45) * (T1 - T0)
        const [x, y] = at(tt, (q() - 0.5) * 1.6)
        const L = 4 + q() * (8 + tt * 7)
        gd += stroke([[x - L / 2, y], [x + L / 2, y + (q() - 0.5)]], 0.9 + q() * 1.2, 0.3, 0.3, 0.2)
      }
      return gd
    }
    const gA = glints(3907, 80)
    yield
    const gB = glints(3908, 70)
    yield
    // long low streaks of sun lying across the water from the far (sunlit) end
    let beams = ''
    for (let k = 0; k < 7; k++) {
      const [x, y] = at(1.5 + r() * 1.7, (r() - 0.5) * 1.3)
      const L = d * (0.5 + r() * 0.7)
      const a2 = ang + 0.5 + (r() - 0.5) * 0.12
      beams += stroke([[x - Math.cos(a2) * L / 2, y - Math.sin(a2) * L / 2], [x, y], [x + Math.cos(a2) * L / 2, y + Math.sin(a2) * L / 2]], 2 + r() * 5, 0.5, 0.5, 0.1)
    }
    const [sx, sy] = at(2.6, -0.2)
    spec.replaceChildren(
      s('ellipse', { class: 't39a-sheen', cx: f1(sx), cy: f1(sy), rx: f1(d * 1.3), ry: f1(d * 0.42), transform: `rotate(${f1((ang * 180) / Math.PI)} ${f1(sx)} ${f1(sy)})`, fill: 'url(#p2-halo)' }),
      s('path', { class: 't39a-beam', d: beams }),
      s('path', { class: 't39a-glint t39a-glint-a', d: gA }),
      s('path', { class: 't39a-glint t39a-glint-b', d: gB }))
    yield
  }

  ctx.onCleanup(onSize(ctx.art, layout))
  ctx.onCleanup(onDigit((n) => {
    if (cur >= 0 && pads[n - 1]) pads[n - 1].click()
  }))
  ctx.onCleanup(() => job?.cancel())
  par.kick()
  if (first() >= 0) ctx.prompt(fill(K.prompt, { n: first() + 1 }))
}

/** A squared cedar marker post on the near bank (front face pw × ph from 0,0, seen a little from above), its top cut to
 *  a low peak: its long shadow lying away from the low sun (lower left), the sunlit right side and right roof facet, the
 *  front face in half shade with wavy grain, a knot, a weather crack, and its foot sunk in clumps of moss and grass. */
function postPaint(pw: number, ph: number): SVGElement[] {
  const r = rng(3997)
  const dx = Math.round(pw * 0.1), dy = Math.round(pw * 0.07), pk = Math.round(pw * 0.2)
  let grain = ''
  for (let i = 0; i < 9; i++) {
    const x = 6 + (i / 8) * (pw - 12) + (r() - 0.5) * 6
    const pts: Pt[] = Array.from({ length: 7 }, (_, k) => [x + Math.sin(k * 0.9 + i * 1.7) * (0.8 + r() * 1.4), (k / 6) * ph])
    grain += stroke(pts, 0.6 + r() * 0.9, 0.3, 0.3, 0.3)
  }
  // a knot low on the face, its rings pushing the grain aside
  const kx = pw * 0.2, ky = ph * 0.84
  let knot = ''
  for (let k = 0; k < 3; k++) knot += stroke(Array.from({ length: 13 }, (_, i): Pt => [kx + Math.cos((i / 12) * Math.PI * 2) * (3 + k * 3.2), ky + Math.sin((i / 12) * Math.PI * 2) * (2 + k * 2.2)]), 0.9, 0.1, 0.1, 0.2)
  // the foot: a few big uneven clumps of moss, small ones between, blades of grass of all heights
  let moss = '', blades = '', hi = ''
  const clumps = 7
  for (let i = 0; i < clumps; i++) {
    const x = -16 + (i / (clumps - 1)) * (pw + dx + 32) + (r() - 0.5) * 16, y = ph + 4 + r() * 5
    const R = 9 + r() * 14
    moss += blob(x, y, R, R * (0.45 + r() * 0.2), i + 3990, 0.4, 12)
    if (r() < 0.7) moss += blob(x + R * 0.8, y + 3, R * 0.45, R * 0.3, i + 3980, 0.4, 9)
    hi += blob(x + R * 0.25, y - R * 0.3, R * 0.4, R * 0.18, i + 3970, 0.4, 8)
  }
  for (let k = 0; k < 26; k++) {
    const bx = -12 + r() * (pw + dx + 24), y = ph + 6 + r() * 4, L = 5 + Math.pow(r(), 1.6) * 24, lean = (r() - 0.55) * 10
    blades += stroke([[bx, y], [bx + lean * 0.5, y - L * 0.55], [bx + lean, y - L]], 1.3 + r() * 0.8, 0.05, 0.9, 0.2)
  }
  return [
    s('ellipse', { class: 't39a-post-cast', cx: f1(-pw * 0.3), cy: f1(ph + 5), rx: f1(pw * 0.95), ry: f1(Math.max(10, ph * 0.12)), transform: `rotate(-9 ${f1(pw * 0.2)} ${f1(ph)})`, fill: 'url(#g39-cast)' }),
    s('path', { class: 't39a-post-side', d: `M${pw} 0L${pw + dx} ${-dy}L${pw + dx} ${f1(ph - dy * 0.6)}L${pw} ${ph}Z` }),
    s('path', { class: 't39a-post-roof', d: `M${f1(pw / 2)} ${-pk}L${f1(pw / 2 + dx)} ${-pk - dy}L${pw + dx} ${-dy}L${pw} 0Z` }),
    s('path', { class: 't39a-post-face', d: `M0 0L${f1(pw / 2)} ${-pk}L${pw} 0L${pw} ${ph}L0 ${ph}Z` }),
    s('path', { class: 't39a-post-gable', d: `M0 0L${f1(pw / 2)} ${-pk}L${pw} 0Z` }),
    s('rect', { class: 't39a-post-shade', x: 0, y: 0, width: pw, height: ph, fill: 'url(#g39-shadowv)' }),
    s('path', { class: 't39a-post-grain', d: grain }),
    s('path', { class: 't39a-post-knot', d: knot }),
    s('path', { class: 't39a-post-crack', d: stroke([[pw * 0.72, 0], [pw * 0.7, ph * 0.1], [pw * 0.73, ph * 0.2]], 1.6, 0.1, 0.9, 0.3) }),
    s('path', { class: 't39a-post-arris', d: stroke([[pw, 0], [pw, ph * 0.5], [pw, ph]], 1.6, 0.1, 0.4, 0.2) + stroke([[pw / 2, -pk], [pw * 0.75, -pk / 2], [pw, 0]], 1.4, 0.1, 0.3, 0.2) }),
    s('path', { class: 't39a-post-edge', d: stroke([[0, 0], [0, ph * 0.5], [0, ph]], 1.4, 0.1, 0.4, 0.2) + stroke([[0, 0], [pw * 0.25, -pk / 2], [pw / 2, -pk]], 1.2, 0.1, 0.3, 0.2) }),
    s('ellipse', { class: 't39a-post-contact', cx: f1(pw * 0.5), cy: f1(ph + 2), rx: f1(pw * 0.62), ry: 6 }),
    s('path', { class: 't39a-post-moss', d: moss }),
    s('path', { class: 't39a-post-mosshi', d: hi }),
    s('path', { class: 't39a-post-blades', d: blades }),
  ]
}

/** The near bank under the frame's foot, very close to the lens: dark moss mounds and two stones round the post (left x,
 *  width pw), out of focus. */
function bank(W: number, H: number, x: number, pw: number, wide: boolean): SVGElement[] {
  const r = rng(3996)
  let moss = '', hi = '', rock = '', rockHi = ''
  const spots: [number, number, number][] = wide
    ? [[x + pw * 0.5, H + 40, 230], [x - 120, H + 10, 150], [x + pw + 60, H - 20, 130]]
    : [[x + pw * 0.4, H + 30, 140], [x + pw + 20, H - 40, 90], [W * 0.04, H + 50, 110]]
  for (const [cx, cy, R] of spots) {
    moss += blob(cx, cy, R, R * 0.42, Math.round(cx), 0.25, 18)
    for (let i = 0; i < 14; i++) hi += blob(cx + (r() - 0.5) * R * 1.6, cy - R * 0.32 + r() * R * 0.18, 3 + r() * 6, 2 + r() * 3, i + Math.round(cx), 0.3, 7)
  }
  const st = (cx: number, cy: number, R: number) => {
    rock += blob(cx, cy, R, R * 0.62, Math.round(cx * 3), 0.12, 14)
    rockHi += blob(cx + R * 0.18, cy - R * 0.22, R * 0.64, R * 0.36, Math.round(cx * 3) + 1, 0.12, 12)
  }
  st(x - (wide ? 90 : 170), H - (wide ? 40 : 70), wide ? 34 : 24)
  st(x + (wide ? pw * 0.95 : pw * 0.2), H - 8, wide ? 26 : 20)
  return [
    s('path', { class: 't39a-nearbank', d: moss }),
    s('path', { class: 't39a-nearbank-hi', d: hi }),
    s('path', { class: 't39a-nearrock-sh', d: rock, transform: 'translate(-14 6)' }),
    s('path', { class: 't39a-nearrock', d: rock }),
    s('path', { class: 't39a-nearrock-hi', d: rockHi }),
  ]
}

/** A stepping stone seen from above and a little forward (w × h box, centred): its submerged foot through the water,
 *  the side wall facing the viewer (shade left, the low sun warm on the right), the darker wet band at the waterline
 *  and the water's bright meniscus, an uneven crown lit from the dawn (upper right) — the shade side brushed in, cracks,
 *  lichen, moss creeping up from the shaded foot — and a sunlit rim. */
function stoneTop(w: number, hh: number, wall: number, seed: number): SVGElement[] {
  const r = rng(seed)
  const rx = w * 0.48, ry = (hh - wall) * 0.5
  const cy = -wall / 2
  const crown = (dy: number, k = 1) => blob(0, cy + dy, rx * k, ry * k, seed, 0.15, 24)
  // the wall: the crown's outline swept down by the wall's height, a little wider toward the foot (a rock, not a puck)
  const body = [0, 0.25, 0.5, 0.75, 1].map((k) => crown(wall * k, 1 + k * 0.05)).join('')
  let grain = ''
  for (let i = 0; i < 7; i++) {
    const x = (r() - 0.6) * rx * 1.2, y = cy + (r() - 0.5) * ry
    grain += stroke([[x, y], [x + rx * 0.2, y + ry * 0.04], [x + rx * 0.36, y + ry * 0.12]], 1.3, 0.3, 0.5, 0.2)
  }
  // two cracks, running in from the rim
  let crack = ''
  for (let i = 0; i < 2; i++) {
    const a = (i ? 2.4 : -0.3) + (r() - 0.5) * 0.5
    const x0 = Math.cos(a) * rx * 0.98, y0 = cy + Math.sin(a) * ry * 0.98
    crack += stroke([[x0, y0], [x0 * 0.78 + (r() - 0.5) * 8, y0 * 0.7 + cy * 0.3], [x0 * 0.6 + (r() - 0.5) * 10, y0 * 0.45 + cy * 0.55]], 1.5, 0.1, 0.8, 0.3)
  }
  let lichen = ''
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2, k = 0.55 + r() * 0.38
    lichen += blob(Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k, 1.5 + r() * 3.5, 1.2 + r() * 2.5, seed + 40 + i, 0.35, 8)
  }
  let striae = ''
  for (let i = 0; i < 9; i++) {
    const a = 0.35 + (i / 8) * (Math.PI - 0.7)
    const x = Math.cos(a) * rx * 0.96, y = cy + Math.sin(a) * ry * 0.96
    striae += stroke([[x, y + wall * 0.15], [x + (r() - 0.5) * 2, y + wall * 0.85]], 1.2, 0.2, 0.2, 0.3)
  }
  // moss: on the shaded (lower-left) side of the crown and down the wall to the water
  let moss = ''
  for (let i = 0; i < 26; i++) {
    const a = 1.8 + r() * 1.7, k = 0.8 + r() * 0.24
    moss += blob(Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k + r() * wall * 0.8, 1.5 + r() * 4.5, 1 + r() * 2.5, seed + i, 0.4, 8)
  }
  const arcAt = (dy: number, k: number, a0: number, a1: number): Pt[] =>
    Array.from({ length: 15 }, (_, i) => {
      const a = ((a0 + ((a1 - a0) * i) / 14) * Math.PI) / 180
      return [Math.cos(a) * rx * k, cy + dy + Math.sin(a) * ry * k]
    })
  let ripples = ''
  for (let i = 0; i < 4; i++) {
    const a0 = r() * 300, len = 25 + r() * 40
    ripples += stroke(arcAt(wall * 1.08, 1.14 + i * 0.07, a0, a0 + len), 1.3, 0.3, 0.3, 0.1)
  }
  const [cid, cp] = clip(crown(0))
  return [
    s('defs', null, cp),
    s('path', { class: 't39a-sunk', d: blob(-rx * 0.03, cy + wall + ry * 0.18, rx * 1.1, ry * 1.14, seed + 2, 0.08, 22) }),
    s('path', { class: 't39a-flank', d: body, fill: 'url(#g39-wall)' }),
    s('path', { class: 't39a-striae', d: striae }),
    s('path', { class: 't39a-wetband', d: stroke(arcAt(wall * 0.72, 1.0, 8, 172), wall * 0.66, 0.15, 0.15, 0.4) }),
    s('path', { class: 't39a-waterline', d: stroke(arcAt(wall * 1.02, 1.045, 4, 176), Math.max(1.6, wall * 0.16), 0.1, 0.1, 0.3) }),
    s('path', { class: 't39a-meniscus', d: stroke(arcAt(wall * 1.06, 1.08, 20, 160), 1.4, 0.2, 0.2, 0.2) }),
    s('path', { class: 't39a-ripple', d: ripples }),
    s('path', { class: 't39a-crown', d: crown(0), fill: 'url(#g39-topface)' }),
    s('path', { class: 't39a-crown-moon', d: crown(0) }),
    s('g', { 'clip-path': `url(#${cid})` },
      // the shade side of the crown, its edge a wavering brush line (the terminator), and the sun's warmth on the far side
      s('path', { class: 't39a-crown-shade', d: blob(-rx * 0.62, cy + ry * 0.58, rx * 0.9, ry * 0.85, seed + 5, 0.22, 16) }),
      s('path', { class: 't39a-crown-sun', d: blob(rx * 0.55, cy - ry * 0.55, rx * 0.6, ry * 0.5, seed + 6, 0.2, 14) }),
      s('path', { class: 't39a-grain', d: grain }),
      s('path', { class: 't39a-crack', d: crack }),
      s('path', { class: 't39a-lichen', d: lichen })),
    // the crown's near edge where it breaks over into the wall: a thin lit bevel
    s('path', { class: 't39a-bevel', d: stroke(arcAt(0, 0.99, 20, 95), Math.max(1.4, wall * 0.1), 0.25, 0.25, 0.2) }),
    s('path', { class: 't39a-mossy', d: moss }),
    s('path', { class: 't39a-sunrim', d: rim([-rx * 0.1, cy - ry * 0.97], [rx * 0.8, cy - ry * 0.86], [rx * 1.0, cy + ry * 0.1], Math.max(1.8, rx * 0.03)) }),
    s('path', { class: 't39a-inkedge', d: stroke([[-rx * 0.98, cy - ry * 0.2], [-rx * 0.72, cy + ry * 0.76], [rx * 0.1, cy + ry * 1.0]], Math.max(1.6, rx * 0.03), 0.25, 0.3, 0.2) }),
  ]
}

/** A lotus leaf from above (in -50…50), lying on dark water: an uneven, wavy rim (never a circle), the cleft running in
 *  to the stem, veins fanning out from the stem and forking near the rim, a darker cup round the stem, the rim on the
 *  sun's side (upper right) curled up — its pale underside and a bright lip — and the shaded rim (lower left) dark. */
function padArt(seed: number) {
  const r = rng(seed)
  const ph1 = r() * 6.3, ph2 = r() * 6.3, ph3 = r() * 6.3
  const gap = 0.2 // the cleft, a narrow V
  const a0 = Math.PI * (0.55 + r() * 0.9) // the cleft points down / left / up — never toward the sun
  const st: Pt = [Math.cos(a0) * 2, Math.sin(a0) * 2]
  const R = (a: number) => 44.5 + 2.4 * Math.sin(3 * a + ph1) + 1.3 * Math.sin(7 * a + ph2) + 0.7 * Math.sin(13 * a + ph3)
  const at = (a: number, k = 1): Pt => [Math.cos(a) * R(a) * k, Math.sin(a) * R(a) * 0.94 * k]
  const N = 60
  const rimPts: Pt[] = Array.from({ length: N + 1 }, (_, i) => at(a0 + gap / 2 + (i / N) * (Math.PI * 2 - gap)))
  const P = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`
  const leaf = `M${P(st)}L${rimPts.map(P).join('L')}Z`
  let veins = ''
  for (let k = 0; k < 17; k++) {
    const a = a0 + gap / 2 + 0.12 + (k / 16) * (Math.PI * 2 - gap - 0.24)
    const bend = (r() - 0.5) * 0.1
    const [ex, ey] = at(a, 0.86)
    veins += stroke([st, [Math.cos(a + bend) * 22 + st[0] * 0.4, Math.sin(a + bend) * 21 + st[1] * 0.4], [ex, ey]], 1.05, 0.05, 0.8, 0.2)
    // a fork near the rim
    const [fx, fy] = at(a + 0.09, 0.95), [gx, gy] = at(a - 0.09, 0.95)
    veins += stroke([[ex, ey], [fx, fy]], 0.6, 0.1, 0.8, 0.2) + stroke([[ex, ey], [gx, gy]], 0.6, 0.1, 0.8, 0.2)
  }
  // the curled rim on the sun's side, and the shaded rim opposite
  const sun = -Math.PI / 4
  const arc = (c: number, half: number, k: number): Pt[] => Array.from({ length: 13 }, (_, i) => at(c - half + (i / 12) * half * 2, k))
  return s('svg', { class: 't39a-pad-art', viewBox: '-50 -50 100 100', 'aria-hidden': 'true' },
    s('path', { class: 't39a-leaf', d: leaf, fill: 'url(#g39-lotus)' }),
    s('ellipse', { class: 't39a-leaf-sheen', cx: 13, cy: -13, rx: 30, ry: 24, fill: 'url(#p2-halo)' }),
    s('path', { class: 't39a-vein', d: veins }),
    s('path', { class: 't39a-leaf-under', d: stroke(arc(sun, 0.85, 0.93), 5.5, 0.4, 0.4, 0.1) }),
    s('path', { class: 't39a-leaf-lip', d: stroke(arc(sun, 0.8, 1.0), 1.6, 0.4, 0.4, 0.1) }),
    s('path', { class: 't39a-leaf-shade', d: stroke(arc(sun + Math.PI, 1.1, 0.985), 2.4, 0.3, 0.3, 0.1) }),
    s('circle', { class: 't39a-stem', cx: f1(st[0]), cy: f1(st[1]), r: 2.6 }))
}

/** A thin crescent (the setting moon mirrored), centred at (x, y), radius R. */
const crescentD = (x: number, y: number, R: number) =>
  `M${f1(x)} ${f1(y - R)}A${f1(R)} ${f1(R)} 0 0 0 ${f1(x)} ${f1(y + R)}A${f1(R * 0.62)} ${f1(R)} 0 0 1 ${f1(x)} ${f1(y - R)}Z`

const arcPts = (cx: number, cy: number, R: number, a0: number, a1: number): Pt[] =>
  Array.from({ length: 13 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / 12) * Math.PI) / 180
    return [cx + Math.cos(a) * R, cy + Math.sin(a) * R]
  })

/** A koi from above, swimming right: the body, the tail fan and the pectoral fins apart (fins are veiled). */
const KOI_BODY = 'M-30 0Q-22 -6 -6 -7Q14 -8 30 -2Q34 0 30 2Q14 8 -6 7Q-22 6 -30 0Z'
const KOI_FINS = 'M-28 0L-41 -10Q-37 0 -41 10Z' + 'M14 -6Q6 -15 -1 -14Q4 -9 6 -6Z' + 'M14 6Q6 15 -1 14Q4 9 6 6Z'

/** The stone lantern on the far bank, from above: its foot, the six-sided roof, the jewel; the glow when lit. */
function lampArt() {
  const hex = (R: number, rot = 0) => Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 + rot
    return `${i ? 'L' : 'M'}${f1(Math.cos(a) * R)} ${f1(Math.sin(a) * R * 0.92)}`
  }).join('') + 'Z'
  return s('svg', { class: 't39a-lamp-art', viewBox: '-80 -80 160 160', 'aria-hidden': 'true' },
    s('circle', { r: 78, fill: 'url(#g39-lamp)', class: 't39a-lamp-glow' }),
    // its long shadow on the bank, away from the low sun
    s('ellipse', { cx: -26, cy: 20, rx: 46, ry: 20, fill: 'url(#g39-ao)', transform: 'rotate(-28 -26 20)' }),
    s('ellipse', { cx: 4, cy: 6, rx: 34, ry: 30, fill: 'url(#g39-ao)' }),
    s('path', { class: 't39a-lamp-light', d: hex(40, 0.1) }),
    s('path', { class: 't39a-lamp-roof', d: hex(34, 0.52), filter: 'url(#ink-rough)' }),
    s('path', { class: 't39a-lamp-ridge', d: [0, 1, 2, 3, 4, 5].map((i) => {
      const a = (i / 6) * Math.PI * 2 + 0.52
      return stroke([[0, 0], [Math.cos(a) * 33, Math.sin(a) * 30]], 1.8, 0.1, 0.1, 0.5)
    }).join('') }),
    s('path', { class: 't39a-lamp-rim', d: stroke(arcPts(0, 0, 34, 250, 360), 2.4, 0.2, 0.2, 0.1) }),
    s('circle', { class: 't39a-lamp-jewel', r: 7 }))
}
