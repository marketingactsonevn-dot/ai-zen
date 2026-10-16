import './ask.css'
import { fill, h, nextId, s } from '../../core/dom'
import { load, save } from '../../core/store'
import { sliced } from '../../core/chunk'
import { blob, clamp, onDigit, onSize, rng, stableHeight, stroke, type Pt } from '../../ui/part2/ink'
import type { SceneCtx } from '../types'
import { C } from './shell'
import type { Answers } from './types'
import { f1, g39Defs, idle, leafD, mossBed, parallax, rim, smoothD } from './g39'

const K = C.scenes.ask
export const KEY = 't39-answers'
/** answers live only in this browser (localStorage), never sent anywhere */
export const loadAnswers = () => load<Answers>(KEY, {})

type Geo = { W: number; H: number; T0: number; Ha: number; wide: boolean; d: number; dir: Pt; perp: Pt; S: Pt[]; sw: number; sh: number; wall: number; pd: number; P: number; Dz: number; yc: number; box: [number, number, number, number] }

/**
 * Scene 1 — four questions on four stepping stones across a pond at first light, seen almost straight down (TOP 82°).
 * Layers at real depths in one CSS 3D view (the bottom with pebbles and two koi shadows, the water film with the dawn and
 * the setting moon reflected, the stones and leaves on the surface): the camera slides along the diagonal path, and the
 * layers part with depth as it moves or as the pointer / phone tilts. Answers are lotus leaves round the stone; a chosen
 * leaf drifts to the stone, rings spread, the next stone rises out of the water. All four: the camera pulls back over the
 * whole path and the far lantern lights. Transforms only; the paintings are SVG built once per layout in slices.
 */
export function askScene(ctx: SceneCtx) {
  g39Defs()
  const still = ctx.reduced || ctx.quality === 'low'
  const Q = K.questions
  const ans: Answers = loadAnswers()
  const stable = stableHeight(ctx, [K.insight])

  const bed = s('svg', { class: 't39a-bed', 'aria-hidden': 'true' })
  const shades = h('div', { class: 't39a-shades', 'aria-hidden': 'true' })
  // each stone's shadow on the bottom: a hand's depth below it, so it parts from the stone as the view moves
  const stSh = Q.map(() => h('i', { class: 't39a-stsh' }))
  const stShades = h('div', { class: 't39a-shades', 'aria-hidden': 'true' }, ...stSh)
  // the surface itself: glints and a slow sheen, nearest of the water's layers
  const spec = s('svg', { class: 't39a-spec', 'aria-hidden': 'true' })
  const koi = h('div', { class: 't39a-koi', 'aria-hidden': 'true' })
  const film = s('svg', { class: 't39a-film', 'aria-hidden': 'true' })
  const lamp = h('div', { class: 't39a-lamp', 'aria-hidden': 'true' }, lampArt())
  const streak = h('i', { class: 't39a-streak', 'aria-hidden': 'true' })
  const sign = h('div', { class: 't39a-sign' }, h('p', null, K.privacy))
  const rings = h('div', { class: 't39a-rings', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'))
  const stones = Q.map((q, i) => h('button', { class: 't39a-stone', type: 'button', tabindex: '-1', 'aria-hidden': 'true', onClick: () => open(i, true) },
    s('svg', { class: 't39a-stone-art', 'aria-hidden': 'true' }),
    h('span', { class: 't39a-q' }, q.q),
    // "Câu n/4" cut into the stone's side wall, at the waterline
    h('span', { class: 't39a-n' }, fill(K.progress, { n: i + 1 }))))
  const docks = Q.map(() => h('div', { class: 't39a-dock', 'aria-hidden': 'true' }, s('svg', { class: 't39a-pad-art', viewBox: '-50 -50 100 100' }), h('span', { class: 't39a-dock-label' })))
  const group = h('div', { class: 't39a-pads', role: 'group' })
  const top = h('div', { class: 't39a-top' }, streak, lamp, ...docks, ...stones, rings, group)
  const cam = h('div', { class: 't39a-cam' }, bed, stShades, shades, koi, film, spec, top)
  const view = h('div', { class: 't39a-view' }, cam)
  // the sky this water mirrors stays put while the view slides: dawn in the upper right, the setting moon lower left
  const sky = h('div', { class: 't39a-sky', 'aria-hidden': 'true' })
  // nearest of all: a maple branch reaching in over the water from the lower right, out of focus
  const near = s('svg', { class: 't39a-near', 'aria-hidden': 'true' })
  // the near bank at the foot of the frame: out-of-focus moss and stones, the wooden board standing in it
  const root = h('div', { class: `t39a${still ? ' is-still' : ''}` }, h('p', { class: 'visually-hidden' }, K.art), view, sky, near, sign)
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

  // ── camera: the view's centre sits on a world point; pulling back is a move away along z ─────────────────────────

  function look(x: number, y: number, z = 0) {
    if (!G) return
    cam.style.transform = `translate3d(${f1(G.W / 2 - x)}px,${f1(G.yc - y)}px,${f1(z)}px)`
  }
  const par = parallax(ctx, root, (x, y) => {
    if (!G) return
    view.style.perspectiveOrigin = `${f1(G.W / 2 + x * G.W * 0.09)}px ${f1(G.yc + y * G.Ha * 0.09)}px`
    near.style.transform = `translate(${f1(-x * 34)}px,${f1(-y * 22)}px)`
    sign.style.translate = `${f1(-x * 14)}px ${f1(-y * 9)}px`
  })

  // ── the leaves of one question round its stone ─────────────────────────────────────────────────────────────────────
  function offsets(n: number): Pt[] {
    const { wide, sw, sh, pd } = G!
    const deg = (a: number, rx: number, ry: number): Pt => [Math.cos((a * Math.PI) / 180) * rx, Math.sin((a * Math.PI) / 180) * ry]
    let o: Pt[]
    if (n > 3) {
      const rx = sw / 2 + pd / 2 + (wide ? 36 : 4), ry = sh / 2 + pd / 2 + (wide ? 26 : 54)
      o = wide ? [30, 90, 150, 210, 270, 330].map((a) => deg(a, rx, ry)) : [[-rx * 0.5, -ry], [rx * 0.5, -ry], [-rx, 0], [rx, 0], [-rx * 0.5, ry], [rx * 0.5, ry]]
    } else {
      const rx = sw / 2 + pd / 2 + (wide ? 40 : 6), ry = sh / 2 + pd / 2 + (wide ? 20 : 30)
      o = [wide ? 150 : 145, 90, wide ? 30 : 35].map((a) => deg(a, rx, ry))
    }
    // reading order (top to bottom, left to right) = the options' order = their digit keys
    return o.slice(0, n).sort((a, b) => Math.round(a[1] - b[1]) || a[0] - b[0])
  }

  function open(i: number, change = false) {
    if (!G || i < 0 || !raised(i)) return
    cur = i
    root.classList.remove('is-done')
    lamp.classList.toggle('lit', false)
    const it = Q[i]
    const [sx, sy] = G.S[i]
    docks[i].classList.remove('on')
    const r = rng(3900 + i * 17)
    const offs = offsets(it.options.length)
    drop()
    const pd = G.pd
    pads = it.options.map((o, k) => {
      const [ox, oy] = offs[k]
      const rot = Math.round((r() - 0.5) * 70)
      const b = h('button', {
        class: 't39a-pad', type: 'button', 'aria-label': fill(K.optionAria, { q: it.q, label: o.label }),
        'aria-pressed': ans[it.id] === o.id ? 'true' : 'false',
        style: `left:${f1(sx + ox)}px;top:${f1(sy + oy)}px;width:${pd}px;height:${pd}px;margin:${f1(-pd / 2)}px 0 0 ${f1(-pd / 2)}px;--r:${rot}deg;--i:${k}`,
        onClick: () => choose(i, o.id, b),
      }, padArt(3910 + i * 7 + k), h('span', { class: `t39a-pad-label${o.label.length > 20 ? ' long' : ''}` }, o.label))
      return b
    })
    // each leaf's soft shadow on the bottom, a hand's depth below (it parts from the leaf as the view moves)
    shadows = offs.slice(0, pads.length).map(([ox, oy], k) => h('i', { class: 't39a-padsh', style: `left:${f1(sx + ox - pd * 0.3)}px;top:${f1(sy + oy + pd * 0.38)}px;width:${pd}px;height:${pd}px;margin:${f1(-pd / 2)}px 0 0 ${f1(-pd / 2)}px;--i:${k}` }))
    shades.replaceChildren(...shadows)
    group.setAttribute('aria-label', it.q)
    group.replaceChildren(...pads)
    look(sx, sy)
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
      // pull back over the whole path, its far lantern included
      const xs = [G.S[0][0], G.S[4][0]], ys = [G.S[0][1], G.S[4][1]]
      const spanX = Math.abs(xs[1] - xs[0]) + G.sw * 1.6, spanY = Math.abs(ys[1] - ys[0]) + G.sh * 2.4
      const sc = clamp(Math.min((G.W - 60) / spanX, (G.Ha - 40) / spanY), G.wide ? 0.6 : 0.55, 1)
      look(xs[0] * 0.46 + xs[1] * 0.54, ys[0] * 0.44 + ys[1] * 0.56 + G.sh * 0.1, G.P * (1 - 1 / sc))
    }
    paint()
    if (!told) {
      told = true
      ctx.insight(K.insight)
      ctx.chime('ok')
    }
  }

  const dockAt = (i: number): Pt => [G!.S[i][0] - G!.sw * 0.56, G!.S[i][1] + G!.sh * 0.34]
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
      const dk = docks[i]
      dk.classList.toggle('on', !!a && cur !== i)
      ;(dk.lastChild as HTMLElement).textContent = label ?? ''
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
    const sw = wide ? clamp(W * 0.15, 190, 236) : 142, sh = Math.round(sw * 0.74)
    const wall = Math.round(sh * 0.2)
    const pd = wide ? clamp(W * 0.085, 112, 128) : 108
    const d = wide ? clamp(Ha * 0.62, 340, 440) : clamp(Ha * 0.5, 250, 310)
    const a = ((wide ? -30 : -64) * Math.PI) / 180
    const dir: Pt = [Math.cos(a), Math.sin(a)], perp: Pt = [-Math.sin(a), Math.cos(a)]
    const jit = [0, 0.06, -0.05, 0.04, 0]
    const S: Pt[] = [0, 1, 2, 3, 4.05].map((t, i) => [dir[0] * t * d + perp[0] * jit[i] * d, dir[1] * t * d + perp[1] * jit[i] * d])
    const pts = [S[0], S[4]]
    const m = Math.max(W, H) * 1.3
    const box: [number, number, number, number] = [Math.min(...pts.map((p) => p[0])) - m, Math.min(...pts.map((p) => p[1])) - m, Math.abs(S[4][0] - S[0][0]) + m * 2, Math.abs(S[4][1] - S[0][1]) + m * 2]
    const P = clamp(Math.max(W, H) * 0.9, 800, 1300)
    G = { W, H, T0, Ha, wide, d, dir, perp, S, sw, sh, wall, pd, P, Dz: wide ? 260 : 190, yc: T0 + Ha * (wide ? 0.47 : 0.45), box }
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
      // its shadow on the bottom: away from the low sun (upper right), a little larger than the stone, soft
      Object.assign(stSh[i].style, { left: `${f1(S[i][0] - sw * 0.7 - sw * 0.42)}px`, top: `${f1(S[i][1] - sh * 0.5 + sh * 0.62)}px`, width: `${f1(sw * 1.4)}px`, height: `${f1(sh * 1.05)}px` })
      const [dx, dy] = dockAt(i)
      Object.assign(docks[i].style, { left: `${f1(dx)}px`, top: `${f1(dy)}px`, width: `${f1(pd * 0.62)}px`, height: `${f1(pd * 0.62)}px` })
      ;(docks[i].firstChild as SVGSVGElement).replaceChildren(...padArt(3960 + i).childNodes)
    })
    Object.assign(lamp.style, { left: `${f1(S[4][0])}px`, top: `${f1(S[4][1])}px` })
    Object.assign(streak.style, { left: `${f1(S[4][0])}px`, top: `${f1(S[4][1])}px`, width: `${f1(d * 2.6)}px`, transform: `translateZ(1px) rotate(${f1((a * 180) / Math.PI + 180)}deg)` })
    // the privacy board stands on the near bank at the foot of the frame: right of the insight on wide screens, left
    // above the prompt on tall ones
    // (the path runs up from the lower left, so the lower right is free bank)
    const sx = wide ? W - 330 : W - 200, sy = wide ? Math.min(T0 + Ha - 18, H - 210) : T0 + artH - 96
    Object.assign(sign.style, { left: `${f1(sx)}px`, top: `${f1(sy)}px` })
    near.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    near.replaceChildren(...branch(W, T0, Ha, wide), ...bank(W, H, sx, sy + (wide ? 70 : 64), wide))
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
      d * (1.16 + 0.26 * Math.sin(t * 1.7 + (side > 0 ? 0.6 : 2.5)) + 0.08 * Math.sin(t * 4.3 + side)) * k * (t > 2.4 ? 1 - Math.min(1, (t - 2.4) / 0.9) * 0.5 : 1)
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
      ...[0.82, 0.64, 0.48, 0.32].map((k) => s('path', { class: 't39a-deep', d: smoothD(ring(k)) })))
    yield
    // two koi gliding slowly round under the first stones, red and white through the water
    koi.replaceChildren(...[[0.55, 0.42, 0.62, 52], [1.9, -0.36, 0.78, 64]].map(([t, side, k, dur], i) => {
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
    // the water film: tint and depth, the dawn sky mirrored (warm toward the far end, cool toward the near), the setting
    // moon's broken road on the near water, ripples; then the banks round it with their wet edge, moss and shoreline
    const sky = nextId('t39a-sky')
    const [mx, my] = at(-0.62, wide ? 0.16 : -0.16)
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
          stop(0, '--t39a-cool', 0.75), stop(0.22, '--t39a-cool', 0.4), stop(0.45, '--t39a-cool', 0), stop(0.62, '--t39a-warm', 0.18), stop(0.85, '--t39a-warm', 0.5), stop(1, '--t39a-warm', 0.7))),
      s('path', { class: 't39a-water', d: pond }),
      ...[0.86, 0.7, 0.54, 0.38].map((k) => s('path', { class: 't39a-water-mid', d: smoothD(ring(k)) })),
      ...[0.4, 0.31, 0.23, 0.16, 0.1, 0.05].map((w) => shallow(d * w, 0.06)),
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
      s('path', { class: 't39a-boulder-sh', d: boulder, transform: `translate(${f1(-d * 0.03)} ${f1(d * 0.04)})` }),
      s('path', { class: 't39a-boulder', d: boulder }),
      s('path', { class: 't39a-boulder-hi', d: bHi }),
      mossBed(at(T0 - 0.9, 0.4)[0], at(T0 - 0.9, 0.4)[1], d * 0.34, d * 0.16, 3902),
      mossBed(at(T1 + 1.2, -0.3)[0], at(T1 + 1.2, -0.3)[1], d * 0.36, d * 0.16, 3903),
      mossBed(at(1.6, 1.3)[0], at(1.6, 1.3)[1], d * 0.26, d * 0.1, 3904),
      mossBed(at(2.5, -1.35)[0], at(2.5, -1.35)[1], d * 0.3, d * 0.12, 3905))
    yield
    // the surface: glints where the dawn catches the ripples (more toward the far, sunlit end) and a broad sheen; two
    // sets that trade places slowly at quality=high (CSS, paused when idle)
    const glints = (seed: number) => {
      const q = rng(seed)
      let gd = ''
      for (let i = 0; i < 70; i++) {
        const tt = T0 + Math.pow(q(), 0.6) * (T1 - T0)
        const [x, y] = at(tt, (q() - 0.5) * 1.6)
        const L = 3 + q() * (6 + tt * 3)
        gd += stroke([[x - L / 2, y], [x + L / 2, y + (q() - 0.5)]], 1 + q() * 1.4, 0.3, 0.3, 0.2)
      }
      return gd
    }
    const gA = glints(3907)
    yield
    const gB = glints(3908)
    yield
    const [sx, sy] = at(2.4, -0.25)
    spec.replaceChildren(
      s('ellipse', { class: 't39a-sheen', cx: f1(sx), cy: f1(sy), rx: f1(d * 1.3), ry: f1(d * 0.32), transform: `rotate(${f1((Math.atan2(dir[1], dir[0]) * 180) / Math.PI)} ${f1(sx)} ${f1(sy)})`, fill: 'url(#p2-halo)' }),
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
  if (first() >= 0) ctx.prompt(K.prompt)
}

/** A maple branch reaching in over the water from the left edge, below the header: out of focus, close to the lens,
 *  a dark twig and leaves turning red at dawn (clear of the far lantern in the last, wide view). */
function branch(W: number, T0: number, Ha: number, wide: boolean): SVGElement[] {
  // a phone has no free corner for it (the header above, the leaves and the far lantern below)
  if (!wide) return []
  const r = rng(3995)
  const L = wide ? Math.min(W * 0.26, 380) : W * 0.46
  const x0 = -10, y0 = wide ? T0 + Ha * 0.16 : T0 - 18
  const pts: Pt[] = [[x0, y0], [x0 + L * 0.4, y0 + L * 0.12], [x0 + L * 0.75, y0 + L * 0.1], [x0 + L, y0 + L * 0.24]]
  let twig = stroke(pts, Math.max(4, L * 0.022), 0.02, 0.7, 0.2)
  let leaves = '', dark = ''
  for (let i = 0; i < 9; i++) {
    const t0 = 0.25 + (i / 8) * 0.75
    const k = Math.min(pts.length - 2, Math.floor(t0 * (pts.length - 1)))
    const u = t0 * (pts.length - 1) - k
    const x = pts[k][0] + (pts[k + 1][0] - pts[k][0]) * u, y = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * u
    const side = i % 2 ? 1 : -1
    const lx = x + (r() - 0.5) * L * 0.08, ly = y + side * L * (0.06 + r() * 0.06)
    twig += stroke([[x, y], [lx, ly]], Math.max(1.4, L * 0.006), 0.05, 0.6, 0.3)
    const d = leafD(lx, ly, L * (0.07 + r() * 0.04), side * 60 + (r() - 0.5) * 60)
    if (i % 3 === 1) dark += d
    else leaves += d
  }
  return [
    s('path', { class: 't39a-near-shadow', d: twig + leaves + dark, transform: `translate(${f1(-L * 0.04)} ${f1(L * 0.1)})` }),
    s('path', { class: 't39a-near-twig', d: twig }),
    s('path', { class: 't39a-near-leaf', d: leaves }),
    s('path', { class: 't39a-near-leaf2', d: dark }),
  ]
}

/** The near bank under the frame's foot, very close to the lens: dark moss mounds and two stones, the board's posts in
 *  them at (x, y) (its left foot). Out of focus with the branch. */
function bank(W: number, H: number, x: number, y: number, wide: boolean): SVGElement[] {
  const r = rng(3996)
  let moss = '', hi = '', rock = '', rockHi = ''
  const spots: [number, number, number][] = wide
    ? [[x - 60, H + 10, 190], [x + 150, H + 30, 230], [x + 330, H - 10, 150], [W * 0.04, H + 40, 160]]
    : [[x - 10, H + 24, 130], [x + 170, H + 10, 120], [W * 0.02, H + 30, 110]]
  for (const [cx, cy, R] of spots) {
    moss += blob(cx, cy, R, R * 0.42, Math.round(cx), 0.25, 18)
    for (let i = 0; i < 14; i++) hi += blob(cx + (r() - 0.5) * R * 1.6, cy - R * 0.32 + r() * R * 0.18, 3 + r() * 6, 2 + r() * 3, i + Math.round(cx), 0.3, 7)
  }
  const st = (cx: number, cy: number, R: number) => {
    rock += blob(cx, cy, R, R * 0.62, Math.round(cx * 3), 0.12, 14)
    rockHi += blob(cx + R * 0.15, cy - R * 0.2, R * 0.68, R * 0.38, Math.round(cx * 3) + 1, 0.12, 12)
  }
  st(x + (wide ? 250 : 150), Math.min(H - 6, y + 70), wide ? 38 : 26)
  st(x - (wide ? 30 : 34), H - 4, wide ? 30 : 22)
  return [
    s('path', { class: 't39a-nearbank', d: moss }),
    s('path', { class: 't39a-nearbank-hi', d: hi }),
    s('path', { class: 't39a-nearrock', d: rock }),
    s('path', { class: 't39a-nearrock-hi', d: rockHi }),
  ]
}

/** A stepping stone seen from above and a little forward (w × h box, centred): its submerged foot through the water,
 *  the side wall facing the viewer (shade left, the low sun warm on the right), the darker wet band at the waterline
 *  and the water's bright meniscus, a flat crown lit from the dawn (upper right) with grain, moss and a sunlit rim. */
function stoneTop(w: number, hh: number, wall: number, seed: number): SVGElement[] {
  const r = rng(seed)
  const rx = w * 0.48, ry = (hh - wall) * 0.5
  const cy = -wall / 2
  const crown = (dy: number, k = 1) => blob(0, cy + dy, rx * k, ry * k, seed, 0.1, 22)
  // the wall: the crown's outline swept down by the wall's height, a little wider toward the foot (a rock, not a puck)
  const body = [0, 0.25, 0.5, 0.75, 1].map((k) => crown(wall * k, 1 + k * 0.035)).join('')
  let grain = ''
  for (let i = 0; i < 6; i++) {
    const x = (r() - 0.6) * rx * 1.2, y = cy + (r() - 0.5) * ry
    grain += stroke([[x, y], [x + rx * 0.2, y + ry * 0.04], [x + rx * 0.36, y + ry * 0.12]], 1.4, 0.3, 0.5, 0.2)
  }
  let striae = ''
  for (let i = 0; i < 9; i++) {
    const a = 0.35 + (i / 8) * (Math.PI - 0.7)
    const x = Math.cos(a) * rx * 0.96, y = cy + Math.sin(a) * ry * 0.96
    striae += stroke([[x, y + wall * 0.15], [x + (r() - 0.5) * 2, y + wall * 0.85]], 1.2, 0.2, 0.2, 0.3)
  }
  let moss = ''
  for (let i = 0; i < 9; i++) {
    const a = 1.9 + r() * 2.2, k = 0.62 + r() * 0.3
    moss += blob(Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k, 3 + r() * 7, 2 + r() * 4, seed + i, 0.3, 9)
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
  return [
    s('path', { class: 't39a-sunk', d: blob(-rx * 0.03, cy + wall + ry * 0.18, rx * 1.08, ry * 1.12, seed + 2, 0.07, 22) }),
    s('path', { class: 't39a-flank', d: body, fill: 'url(#g39-wall)' }),
    s('path', { class: 't39a-striae', d: striae }),
    s('path', { class: 't39a-wetband', d: stroke(arcAt(wall * 0.72, 0.99, 8, 172), wall * 0.62, 0.15, 0.15, 0.4) }),
    s('path', { class: 't39a-waterline', d: stroke(arcAt(wall * 1.02, 1.035, 4, 176), Math.max(1.6, wall * 0.16), 0.1, 0.1, 0.3) }),
    s('path', { class: 't39a-meniscus', d: stroke(arcAt(wall * 1.06, 1.07, 20, 160), 1.4, 0.2, 0.2, 0.2) }),
    s('path', { class: 't39a-ripple', d: ripples }),
    s('path', { class: 't39a-crown', d: crown(0), fill: 'url(#g39-topface)' }),
    s('path', { class: 't39a-crown-moon', d: crown(0) }),
    // the crown's near edge where it breaks over into the wall: a thin lit bevel
    s('path', { class: 't39a-bevel', d: stroke(arcAt(0, 0.99, 30, 150), Math.max(1.4, wall * 0.1), 0.25, 0.25, 0.2) }),
    s('path', { class: 't39a-grain', d: grain }),
    s('path', { class: 't39a-mossy', d: moss }),
    s('path', { class: 't39a-sunrim', d: rim([-rx * 0.15, cy - ry * 0.95], [rx * 0.78, cy - ry * 0.86], [rx * 0.99, cy + ry * 0.05], Math.max(1.8, rx * 0.028)) }),
    s('path', { class: 't39a-inkedge', d: stroke([[-rx * 0.97, cy - ry * 0.2], [-rx * 0.72, cy + ry * 0.74], [rx * 0.1, cy + ry * 0.99]], Math.max(1.6, rx * 0.03), 0.25, 0.3, 0.2) }),
  ]
}

/** A lotus leaf from above (in -50…50): cupped (deep green at the stem, paler to the rim), a clear notch, veins running
 *  out from the stem, the far edge curled up and catching the sun with the fold's shade inside it, a bead of dew. */
function padArt(seed: number) {
  const r = rng(seed)
  const pts: Pt[] = []
  // the notch: a V from the rim to the stem, about 22°, at the leaf's top-left
  const n2 = 44
  for (let i = 0; i <= n2; i++) {
    const a = -1.32 + (i / n2) * (Math.PI * 2 - 0.4)
    // a ruffled rim, and the curled far edge (upper right) standing a little proud
    const curlK = Math.max(0, Math.cos(a + 0.75))
    const rr = 46 + Math.sin(i * 1.9 + seed) * 1.4 + Math.sin(i * 0.7 + seed * 0.3) * 1.6 + curlK * 2.2
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.96])
  }
  const leaf = `M1 2L${pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}Z`
  let veins = ''
  for (let k = 0; k < 14; k++) {
    const a = -1.2 + (k / 13) * (Math.PI * 2 - 0.65)
    const bend = (r() - 0.5) * 0.12
    veins += stroke([[1, 2], [Math.cos(a + bend) * 22, Math.sin(a + bend) * 22 + 1], [Math.cos(a) * 43, Math.sin(a) * 43]], 1.1, 0.05, 0.75, 0.2)
  }
  const curl = arcPts(0, 0, 44.5, 195, 345)
  return s('svg', { class: 't39a-pad-art', viewBox: '-50 -50 100 100', 'aria-hidden': 'true' },
    s('path', { class: 't39a-leaf', d: leaf, fill: 'url(#g39-lotus)', filter: 'url(#ink-rough)' }),
    s('path', { class: 't39a-vein', d: veins }),
    s('path', { class: 't39a-leaf-fold', d: stroke(arcPts(0, 0, 39.5, 200, 340), 3, 0.25, 0.25, 0.1) }),
    s('path', { class: 't39a-leaf-rim', d: stroke(curl, 7.5, 0.3, 0.3, 0.1) }),
    s('path', { class: 't39a-leaf-lip', d: stroke(arcPts(0, 0, 47.5, 215, 325), 1.6, 0.3, 0.3, 0.1) }),
    s('path', { class: 't39a-leaf-edge', d: stroke(arcPts(0, 0, 46, 20, 160), 2, 0.2, 0.2, 0.2) }),
    s('circle', { class: 't39a-stem', cx: 1, cy: 2, r: 3.2 }),
    s('circle', { class: 't39a-dew', cx: f1(-14 + r() * 28), cy: f1(10 + r() * 14), r: 2.6 }),
    s('circle', { class: 't39a-dew-hi', cx: f1(-14 + r() * 28), cy: f1(-22 + r() * 10), r: 1.6 }))
}

const arcPts = (cx: number, cy: number, R: number, a0: number, a1: number): Pt[] =>
  Array.from({ length: 13 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / 12) * Math.PI) / 180
    return [cx + Math.cos(a) * R, cy + Math.sin(a) * R]
  })

/** A thin crescent (the setting moon mirrored), centred at (x, y), radius R. */
const crescentD = (x: number, y: number, R: number) =>
  `M${f1(x)} ${f1(y - R)}A${f1(R)} ${f1(R)} 0 0 0 ${f1(x)} ${f1(y + R)}A${f1(R * 0.62)} ${f1(R)} 0 0 1 ${f1(x)} ${f1(y - R)}Z`

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
    s('ellipse', { cx: 6, cy: 8, rx: 34, ry: 30, fill: 'url(#g39-ao)' }),
    s('path', { class: 't39a-lamp-light', d: hex(30, 0.1) }),
    s('path', { class: 't39a-lamp-roof', d: hex(26, 0.52), filter: 'url(#ink-rough)' }),
    s('path', { class: 't39a-lamp-ridge', d: [0, 1, 2, 3, 4, 5].map((i) => {
      const a = (i / 6) * Math.PI * 2 + 0.52
      return stroke([[0, 0], [Math.cos(a) * 25, Math.sin(a) * 23]], 1.6, 0.1, 0.1, 0.5)
    }).join('') }),
    s('path', { class: 't39a-lamp-rim', d: stroke(arcPts(0, 0, 26, 250, 360), 2, 0.2, 0.2, 0.1) }),
    s('circle', { class: 't39a-lamp-jewel', r: 5.5 }))
}
