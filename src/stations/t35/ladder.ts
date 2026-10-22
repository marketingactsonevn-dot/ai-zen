import './ladder.css'
import { fill, h, s } from '../../core/dom'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import { blob, clamp, curve, onSize, rng, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist, moon, pine, reeds, toro, wash } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import { guide } from '../../ui/part2/guide'
import { C } from './content'
import { F, P, f1, fern, gdefs, ink, roof, wood, woodG } from './kit'

const K = C.scenes.ladder
const N = K.rungs.length
const T = K.tasks
const P0 = -0.5 // the camera starts at the foot of the stairs, the task scrolls lying on the ground
const W8 = [3.4, 2.8, 2.2, 1.6, 1.15, 0.8] // the red thread from the viewer's hand, thinner at each step up
const side = (i: number) => (i % 2 ? 1 : -1) // terraces zig-zag: 0 left, 1 right, …

type Geo = {
  W: number; H: number; port: boolean
  wallH: number; treadH: number; rh: number; rw: number; off: number; bank: number
  fy: number; c: number; e: number; pan: number
  vw: number; vh: number; slabW: number; lh: number; fs: number
}

/**
 * Scene 1 (hero) — four dry-stone terraces zig-zag up a hillside to a lamp-lit workshop: Prompt, Skill, Workflow, Agent
 * (a workflow's laid-out route sits below an agent that picks its own). Three task scrolls lie at the foot; carry each up
 * to the lowest terrace that can do it (drag the scroll up — the camera cranes after it — or tap a terrace's stone).
 * Too low: the terrace says what it can't do and the scroll slides back; too high: the same, and on the Agent terrace the
 * red thread to the viewer's hand snaps. Just enough: the terrace's lantern lights and its little scene plays, the scroll
 * stays. Dragging anywhere else (wheel, arrows) only looks up and down the stairs. Each terrace is its own painted plane
 * placed by a small perspective camera (farther = smaller, higher, mistier) while six layers slide at their own rates.
 * The hook / schedule is not a rung: it starts any rung by itself (the board at the foot). Reduced motion / low: cuts.
 */
export function ladderScene(ctx: SceneCtx) {
  gdefs()
  ldefs()
  const still = ctx.reduced || ctx.quality === 'low'
  const seen = new Set<number>()

  const sky = s('svg', { class: 't35l-flat t35l-sky', 'aria-hidden': 'true' })
  const far = s('svg', { class: 't35l-flat t35l-far', 'aria-hidden': 'true' })
  const woods = s('svg', { class: 't35l-flat t35l-woods', 'aria-hidden': 'true' })
  const haze = s('svg', { class: 't35l-flat t35l-haze', 'aria-hidden': 'true' })
  const front = s('svg', { class: 't35l-flat t35l-front', 'aria-hidden': 'true' })
  const thread = s('svg', { class: 't35l-thread', 'aria-hidden': 'true' })
  const world = h('div', { class: 't35l-world' })

  // one group per terrace: its painting, a veil (mist / night), the carved inscription stone, its lamp's slip, its little scene
  const steps = K.rungs.map((r, i) => {
    const wordsId = `t35l-w${i}`
    const fact = r.id === 'workflow' ? K.facts[0] : null
    // the verdict when a scroll is carried here (too low / too high), carved under what the rung is
    const ex = h('p', { class: 't35l-ex' })
    const words = h('div', { class: 't35l-words', id: wordsId }, h('p', { class: 't35l-what' }, r.what), ex)
    const btn = h('button', { class: 't35l-rung', type: 'button', 'aria-label': fill(K.rungAria, { n: i + 1, name: r.name }), 'aria-describedby': wordsId, 'aria-pressed': 'false', onClick: () => !dragged && place(i) },
      h('span', { class: 't35l-n', 'aria-hidden': 'true' }, String(i + 1)), h('span', { class: 't35l-name' }, r.name))
    const face = h('div', { class: 't35l-face' }, btn, words)
    const art = s('svg', { class: 't35l-art', 'aria-hidden': 'true' })
    const veil = s('svg', { class: 't35l-veil', 'aria-hidden': 'true' })
    const slip = fact ? h('div', { class: 't35l-slip t35k-paper' }, ctx.fact(F(fact), 'p')) : null
    const cord = fact ? s('svg', { class: 't35l-cordsvg', 'aria-hidden': 'true' }) : null
    const vigArt = s('svg', { class: 't35l-vig-art', 'aria-hidden': 'true' })
    const seal = r.id === 'workflow' ? h('button', { class: 't35l-seal', type: 'button', 'aria-label': K.sealAria, onClick: approve }) : null
    const vig = h('div', { class: `t35l-vig t35l-vig-${r.id}` }, vigArt, seal)
    const el = h('div', { class: 't35l-step', 'data-i': String(i) }, art, veil, vig, face, cord, slip)
    return { el, art, veil, vig, vigArt, face, words, ex, btn, slip, cord, seal }
  })
  const houseArt = s('svg', { class: 't35l-art', 'aria-hidden': 'true' })
  const house = h('div', { class: 't35l-step t35l-house', 'aria-hidden': 'true' }, houseArt)
  // the task scrolls: little rolled scrolls with a red cord and a tag; each rides in the group of the terrace it rests on
  const rolls = T.map((t) => h('div', { class: 't35l-roll', 'aria-hidden': 'true' },
    s('svg', { viewBox: '0 0 60 26' },
      s('ellipse', { class: 't35k-contact', cx: 31, cy: 24, rx: 28, ry: 2.4 }),
      s('rect', { class: 't35l-paper', x: 7, y: 6, width: 46, height: 15, rx: 7 }),
      ink(stroke([[9, 7], [30, 6.2], [51, 7]], 1.6, 0.1, 0.1, 0.3) + stroke([[9, 20], [30, 21], [51, 20]], 2.4, 0.1, 0.1, 0.3), 't35k-edge'),
      s('path', { class: 't35l-knob', d: 'M2 8Q1 13.5 2 19L8 20L8 7Z M58 8Q59 13.5 58 19L52 20L52 7Z' }),
      ink(stroke([[28, 5], [30, 13.5], [28, 22]], 2.6, 0.1, 0.1, 0.5) + stroke([[30, 13.5], [36, 24]], 1.5, 0.1, 0.5, 0.2), 't35l-tie')),
    h('span', { class: 't35l-tag t35k-paper' }, t.text)))
  const rollSay = h('p', { class: 'visually-hidden', 'aria-live': 'polite' })
  // the hook is not a rung: a small carved board on two stakes at the foot of the stairs says it starts any rung by itself
  const plank = h('div', { class: 't35l-plank' }, h('p', null, h('strong', null, K.hook.name), ' — ', K.hook.what))
  steps[0].el.append(plank)
  // far terraces sit behind near ones: back to front in the DOM
  world.append(house, ...[...steps].reverse().map((x) => x.el))
  // on a phone the terrace's example and its lamp's slip sit in a strip along the bottom of the frame
  const footbar = h('div', { class: 't35l-footbar' })
  const root = h('div', { class: `t35 t35l${still ? ' still' : ''}`, role: 'group', 'aria-label': K.label },
    h('p', { class: 'visually-hidden' }, K.art), h('p', { class: 'visually-hidden' }, K.task), rollSay, sky, far, woods, haze, world, front, thread, footbar)
  ctx.art.append(root)
  ctx.prompt(K.prompt)

  // ── guide: a dot on the scroll in hand, an ink arrow up the stairs, the count; while a scroll is carried the terraces'
  // stones show a dashed edge where it can go (CSS .carrying: they ride the camera, nothing to measure)
  const GD = guide(ctx)
  const next = GD.dot(rolls[0], { dir: [0, -1] })
  const count = GD.count(K.count, T.length, () => (g ? [g.W * (g.port ? 0.5 : 0.13), g.H * 0.07] : [0, 0]))
  const arrow = GD.gesture('drag-v', () => (g ? [g.W * (g.port ? 0.88 : 0.8), g.H * 0.62] : [0, 0]), { r: 34 })
  const lift = (on: boolean) => root.classList.toggle('carrying', on)

  let g: Geo | null = null
  let cx: number[] = [] // each terrace's centre, px off the frame's middle
  let at = -1 // the terrace under the camera (-1 = the foot)
  let cur = 0 // the scroll in hand (T.length = all placed)
  const where = T.map(() => -1) // the terrace each scroll rests on (-1 = the foot)
  let busy = false // a scroll is on its way up, or sliding back
  let carry: { x: number; y: number; w: number } | null = null // the scroll being dragged up, in px of the frame
  let p = P0, from = P0, to = P0, u = 1 // camera: p = terrace under the camera (fractional while it moves)
  const par = { x: 0, y: 0, tx: 0, ty: 0 }
  let dragged = false

  const cxAt = (pp: number) => {
    const q = clamp(pp, 0, N - 1)
    const i0 = Math.floor(q), i1 = Math.min(N - 1, i0 + 1)
    return cx[i0] + (cx[i1] - cx[i0]) * (q - i0)
  }
  /** Where terrace i (5 = the workshop) sits for the camera at pp: its wall-top centre on screen and its scale. */
  const view = (i: number, pp: number) => {
    const G = g!
    const d = i - pp
    const k = 1 / (1 + G.c * d)
    const fy = G.fy + Math.max(0, -pp) * G.rh * 0.42 // at the foot the camera stands lower, looking up
    return { k, x: G.W / 2 + (cx[Math.min(i, N)] - G.pan * cxAt(pp)) * k + par.x * 12 * k, y: fy - d * G.rh * Math.pow(k, G.e) + par.y * 6 * k, d }
  }

  let shown = ''
  function write() {
    if (!g) return
    let vis = ''
    for (let i = 0; i <= N; i++) {
      const el = i < N ? steps[i].el : house
      const v = view(i, p)
      const on = v.d > -1.7
      vis += on ? '1' : '0'
      if (on) el.style.transform = `translate(${f1(v.x)}px, ${f1(v.y)}px) scale(${v.k.toFixed(4)})`
    }
    if (vis !== shown) {
      shown = vis
      ;[...steps.map((x) => x.el), house].forEach((el, i) => el.classList.toggle('gone', vis[i] === '0'))
    }
    const dy = (p - P0) * g.rh * 0.9
    sky.style.transform = `translate(${f1(par.x * 2)}px, ${f1(dy * 0.08)}px)`
    far.style.transform = `translate(${f1(par.x * 4)}px, ${f1(dy * 0.18)}px)`
    woods.style.transform = `translate(${f1(par.x * 7 - cxAt(p) * 0.12)}px, ${f1(dy * 0.32)}px)`
    haze.style.transform = `translate(${f1(par.x * 9 - cxAt(p) * 0.25)}px, ${f1(dy * 0.6)}px)`
    front.style.transform = `translate(${f1(par.x * 30)}px, ${f1(dy * 1.4 + par.y * 10)}px)`
  }

  const loop = createLoop(root, (_t, dt) => {
    let busy = false
    if (u < 1) {
      u = Math.min(1, u + dt / 1.25)
      const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2
      p = from + (to - from) * e
      busy = u < 1
      if (!busy) settle()
    }
    const f = dt > 0 ? 1 - Math.exp(-dt * 4) : 1
    par.x += (par.tx - par.x) * f
    par.y += (par.ty - par.y) * f
    write()
    const mv = busy || drag !== null
    if (mv !== moving) root.classList.toggle('moving', (moving = mv))
    return mv || Math.abs(par.tx - par.x) + Math.abs(par.ty - par.y) > 0.002
  }, { essential: true })
  let moving = false

  /** Veils: terraces farther than the camera sink into mist; unlit ones stay dark (night) or pale (dawn). */
  function veils() {
    steps.forEach((x, i) => {
      x.el.style.setProperty('--d', (clamp((i - Math.max(at, 0)) * 0.13, 0, 0.5)).toFixed(2))
      x.el.style.setProperty('--u', seen.has(i) ? '0' : '1')
    })
  }

  /** Camera arrived: the terrace under it shows its words; a scroll just carried here gets its verdict. */
  function settle() {
    drawThread()
    GD.refresh()
    if (at < 0) return
    const i = at
    if (g?.port) {
      footbar.replaceChildren(steps[i].ex, ...(steps[i].slip ? [steps[i].slip!] : []))
      footbar.classList.add('in')
    }
    steps.forEach((x, k) => {
      x.el.classList.toggle('now', k === i)
      x.el.classList.toggle('next', k === i + 1)
      x.el.classList.toggle('past', k < i)
      x.btn.setAttribute('aria-pressed', String(cur < T.length && where[cur] === k))
    })
    if (busy && cur < T.length && where[cur] === i) judge(i)
    veils()
  }

  /** Look up or down the stairs (−1 = the foot): only the camera moves. */
  function go(i: number) {
    if (!g) return
    i = clamp(i, -1, N - 1)
    at = i
    root.dataset.at = String(i)
    root.classList.toggle('up', i >= 0)
    thread.classList.remove('in')
    footbar.classList.remove('in')
    steps.forEach((x) => x.el.classList.remove('now', 'next'))
    veils()
    const tgt = i < 0 ? P0 : i
    if (still) {
      p = to = tgt
      u = 1
      write()
      settle()
      return
    }
    from = p
    to = tgt
    u = Math.abs(to - from) < 0.01 ? 1 : 0
    if (u === 1) settle()
    loop.start()
  }

  /** Carry the scroll in hand to terrace i: it hops into that terrace's group, the camera cranes after it, then the verdict. */
  function place(i: number) {
    if (!g || busy || cur >= T.length) return
    busy = true
    carry = null
    root.classList.remove('carrying')
    where[cur] = i
    steps.forEach((x) => (x.ex.textContent = ''))
    seat()
    const r = rolls[cur]
    if (!still) r.animate([{ transform: `${r.style.transform} translateY(-34px)`, opacity: 0 }, { transform: r.style.transform, opacity: 1 }], { duration: 700, delay: 350, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'backwards' })
    if (at === i) settle()
    else go(i)
  }

  /** Just enough: the lamp lights and the scroll stays. Too low or too high: say why on the stone, slide the scroll back. */
  function judge(i: number) {
    const t = T[cur], r = K.rungs[i] as { low?: string; high?: string }
    if (i === t.need) {
      seen.add(i)
      steps[i].el.classList.add('on')
      root.classList.add(`on-${i}`)
      ctx.chime('ok')
      GD.ok(steps[i].btn)
      cur++
      busy = false
      count.set(cur)
      seat()
      if (cur === 1) arrow.done()
      if (cur < T.length) {
        next.at(rolls[cur])
        ctx.prompt(fill(K.left, { n: T.length - cur }))
        rollSay.textContent = fill(K.rollAria, { task: T[cur].text })
      } else {
        next.done()
        // the lamp post's slip and the thread fall quiet: the insight lies on the moss below (one block of words)
        root.classList.add('all')
        ctx.insight(F(K.insight), [K.detail, F(K.facts[0]), F(K.facts[1])])
      }
      return
    }
    const why = (i < t.need ? r.low : r.high) ?? ''
    steps[i].ex.textContent = why
    rollSay.textContent = why
    // on the Agent terrace the thread to the viewer's hand snaps: the job runs and nobody checks it
    if (i === N - 1) thread.classList.add('snap')
    GD.wrong(K.again, steps[i].btn)
    ctx.chime('low')
    later(() => {
      thread.classList.remove('snap')
      where[cur] = -1
      busy = false
      seat()
      drawThread()
    }, 1900)
  }
  const later = (fn: () => void, ms: number) => {
    const tm = setTimeout(fn, still ? 300 : ms)
    ctx.onCleanup(() => clearTimeout(tm))
  }

  /** A scroll on the front of terrace i (or on the ground at the foot, the waiting ones side by side), in that terrace's own coordinates. */
  function rollAt(i: number, slot = 0): Pt {
    const G = g!
    if (i < 0) return [G.rw * (G.port ? 0.24 : 0.12) - slot * G.rw * (G.port ? 0.2 : 0.09), G.wallH + G.treadH * (G.port ? 0.3 : 0.42) + slot * 10]
    return [side(i) * G.rw * (G.port ? 0.3 : 0.32), -G.treadH * 0.16]
  }
  /** Every scroll where it rests; the one in hand (not being dragged) shows its tag. */
  function seat() {
    const G = g!
    const w = clamp(G.rw * 0.09, 54, 80)
    let slot = 0
    rolls.forEach((r, k) => {
      if (carry && k === cur) return
      const i = where[k]
      const [x, y] = rollAt(i, i < 0 ? slot++ : 0)
      steps[Math.max(0, i)].el.append(r)
      r.style.width = `${f1(w)}px`
      r.style.transform = `translate3d(${f1(x - w / 2)}px, ${f1(y - w * 0.43)}px, 0)`
      r.classList.toggle('flip', i >= 0 && side(i) < 0)
      r.classList.toggle('cur', k === cur)
    })
  }

  function approve(e?: Event) {
    e?.stopPropagation()
    root.classList.add('approved')
    ctx.chime('soft')
  }

  // the red thread: from the report along the terrace's front edge, down past the end of its wall, out of the bottom edge
  function drawThread() {
    if (!g) return
    const G = g
    if (carry) return
    // the thread runs from the scroll in hand (all placed: the last one) back to the viewer's hand
    const ci = where[Math.min(cur, T.length - 1)]
    const i = Math.max(0, ci)
    const v = view(i, p)
    const S = (q: Pt): Pt => [v.x + q[0] * v.k, v.y + q[1] * v.k]
    const [rx, ry] = rollAt(ci)
    let pts: Pt[]
    if (ci < 0) {
      const a = S([rx + 20, ry + 4])
      const dx = G.port ? G.W * 0.06 : -G.W * 0.06
      pts = curve(a, [a[0] + dx * 0.2 + G.W * 0.03, (a[1] + G.H) / 2 + 20], [a[0] + dx, G.H + 8], 16)
    } else {
      const sd = side(ci)
      const end = sd * (G.rw / 2 + 4)
      const a = S([rx + sd * 24, ry + 6]), b = S([end - sd * 14, 3]), c = S([end + sd * 6, G.wallH * 0.55]), d = S([end + sd * 10, G.wallH + 6])
      const e: Pt = [clamp(d[0] + sd * G.W * 0.03, G.W * 0.03, G.W * 0.97), G.H + 8]
      pts = [...curve(a, [(a[0] + b[0]) / 2, Math.max(a[1], b[1]) + 3], b, 8), ...curve(b, [b[0] + sd * 8, b[1] + 4], c, 6).slice(1), ...curve(c, [c[0] + sd * 2, (c[1] + d[1]) / 2], d, 6).slice(1), ...curve(d, [d[0] + sd * 18, (d[1] + e[1]) / 2], e, 10).slice(1)]
    }
    thread.setAttribute('viewBox', `0 0 ${f1(G.W)} ${f1(G.H)}`)
    thread.replaceChildren(ink(stroke(pts, W8[ci + 1], 0.02, 0.02, 0.7), 't35l-red'))
    thread.classList.add('in')
  }

  // ── drag (finger or mouse) cranes the camera directly; release settles on a terrace. Dragging the scroll in hand carries
  // it up with the camera: let go and it is placed on the terrace under the camera (or back on the ground near the foot)
  let drag: { id: number; y: number; p0: number; box: DOMRect | null } | null = null
  root.addEventListener('pointerdown', (e) => {
    if (e.button || !g) return
    const onRoll = cur < T.length && !busy && where[cur] < 0 && rolls[cur].contains(e.target as Node)
    drag = { id: e.pointerId, y: e.clientY, p0: p, box: onRoll ? root.getBoundingClientRect() : null }
    dragged = false
  })
  root.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' && g && !still) {
      const r = root.getBoundingClientRect() // shortcut: one read per mouse move, cheaper than a ResizeObserver here
      par.tx = ((e.clientX - r.left) / r.width) * 2 - 1
      par.ty = ((e.clientY - r.top) / r.height) * 2 - 1
      loop.start()
    }
    if (!drag || e.pointerId !== drag.id || !g) return
    const dy = e.clientY - drag.y
    if (!dragged && Math.abs(dy) < 10) return
    if (!dragged) {
      root.setPointerCapture(e.pointerId)
      if (drag.box) lift(true)
    }
    dragged = true
    if (drag.box) {
      // the scroll rides in the hand, over the stairs, while the camera climbs under it
      const w = rolls[cur].offsetWidth || 60
      carry = { x: e.clientX - drag.box.left, y: e.clientY - drag.box.top, w }
      if (rolls[cur].parentElement !== root) root.append(rolls[cur])
      rolls[cur].style.transform = `translate3d(${f1(carry.x - w / 2)}px, ${f1(carry.y - w * 0.3)}px, 0)`
      thread.classList.remove('in')
    }
    if (still) return
    u = 1
    p = clamp(drag.p0 - dy / (g.rh * (drag.box ? 1.2 : 1.6)), P0 - 0.2, N - 1 + 0.2)
    loop.start()
  })
  const release = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return
    const dy = e.clientY - drag.y
    const held = !!drag.box
    drag = null
    if (!dragged) {
      // a tap on the scroll picks it up: the stones show where it can go (then tap one)
      if (held) lift(!root.classList.contains('carrying'))
      return
    }
    setTimeout(() => (dragged = false))
    if (held) {
      lift(false)
      const i = still ? clamp(at + Math.round(-dy / (g!.rh * 0.6)), -1, N - 1) : p < -0.2 ? -1 : clamp(Math.round(p), 0, N - 1)
      if (i >= 0) place(i)
      else {
        carry = null
        seat()
        go(-1)
      }
      return
    }
    go(dy < -24 ? at + 1 : dy > 24 ? at - 1 : at)
  }
  root.addEventListener('pointerup', release)
  root.addEventListener('pointercancel', release)
  root.addEventListener('pointerleave', () => ((par.tx = 0), (par.ty = 0), loop.start()))
  let wheelT = 0
  root.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) < 4 || performance.now() - wheelT < 700) return
    e.preventDefault()
    wheelT = performance.now()
    go(at + (e.deltaY > 0 ? 1 : -1))
  }, { passive: false })
  root.addEventListener('keydown', (e) => {
    const k = ({ ArrowUp: 1, PageDown: 1, ArrowDown: -1, PageUp: -1 } as Record<string, number>)[e.key]
    if (!k) return
    e.preventDefault()
    go(at + k)
    steps[clamp(at, 0, N - 1)].btn.focus({ preventScroll: true })
  })

  // ── layout: geometry, then paint every plane (first time soaked in with sliced, re-layouts in one go)
  let job: { cancel(): void } | null = null
  let first = true
  function layout() {
    const W = root.clientWidth, H = root.clientHeight
    if (W < 60 || H < 60) return
    const port = W < H * 0.8
    const wallH = port ? clamp(H * 0.2, 104, 150) : clamp(H * 0.2, 112, 180)
    const treadH = port ? clamp(H * 0.2, 100, 150) : clamp(H * 0.17, 96, 160)
    const rw = port ? W * 1.04 : Math.min(W * 0.64, 940)
    g = {
      W, H, port, wallH, treadH, rh: wallH + treadH, rw,
      off: W * (port ? 0.15 : 0.17),
      bank: port ? W * 0.5 : clamp(W * 0.36, 200, 560),
      fy: H * (port ? 0.5 : 0.6),
      c: port ? 0.26 : 0.22,
      e: port ? 0.5 : 0.62,
      pan: port ? 0.82 : 0.55,
      vw: port ? W * 0.92 : Math.min(W * 0.46, 640),
      vh: port ? H * 0.36 : H * 0.5,
      slabW: port ? Math.min(W * 0.84, 320) : Math.min(rw * 0.48, 460),
      lh: port ? clamp(wallH * 0.9, 84, 120) : clamp(wallH * 1.0, 100, 170),
      fs: port ? 14 : clamp(H * 0.022, 14, 16),
    }
    cx = [...K.rungs.map((_, i) => side(i) * g!.off), side(N - 1) * g.off * 0.4]
    root.classList.toggle('port', port)
    job?.cancel()
    job = sliced(paint(g), { sync: ctx.reduced || !first })
    first = false
  }

  function* paint(G: Geo) {
    const { W, H, port, rh } = G
    const climb = (N - 1 - P0) * rh * 0.9
    // 1 · sky: the moon over the workshop roof, a breath of mist
    sky.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    sky.replaceChildren(
      mist(W * 0.5, H * 0.34, W * 0.7, H * 0.3),
      moon(W * (port ? 0.74 : 0.7), H * (port ? 0.1 : 0.13) - climb * 0.08, clamp(Math.min(W, H) * 0.05, 16, 32), 351, false))
    yield
    // 2 · far ridges in mist, high up the climb
    const fh = H + climb * 0.18
    flat(far, fh)
    far.replaceChildren(
      hills(-W * 0.1, W * 1.1, H * 0.46 - climb * 0.1, H * 0.26, 352, 0.95, 5),
      mist(W * 0.5, H * 0.46 - climb * 0.1, W * 0.8, H * 0.07),
      hills(-W * 0.2, W * 0.42, H * 0.6 - climb * 0.05, H * 0.24, 353, 0.72, 2),
      hills(W * 0.6, W * 1.2, H * 0.58 - climb * 0.05, H * 0.2, 354, 0.75, 2),
      mist(W * 0.5, H * 0.66, W * 0.9, H * 0.12))
    yield
    // 3 · the pine wood up both flanks of the hill, at many heights and sizes
    const wh = H + climb * 0.32
    flat(woods, wh)
    const r3 = rng(355)
    const pines: SVGElement[] = []
    for (let k = 0; k < (port ? 7 : 10); k++) {
      const left = k % 2 === 0
      const t = k / ((port ? 7 : 10) - 1)
      const y = H * 0.95 - t * (H * 0.6 + climb * 0.32)
      const ph = H * (0.28 + r3() * 0.22) * (port ? 0.9 : 1)
      const x = left ? W * (0.02 + r3() * (port ? 0.1 : 0.14)) : W * (1 - 0.02 - r3() * (port ? 0.1 : 0.14))
      pines.push(s('g', { class: `t35l-pine d${k % 3}` }, pine(x, y, ph, 356 + k, left ? 1 : -1)), mist(x, y - ph * 0.05, W * 0.22, ph * 0.12))
      if (k % 2) yield // a pine is many brush strokes: a couple per slice
    }
    woods.replaceChildren(...pines)
    yield
    // 4 · banks of mist drifting between the terraces
    const hh = H + climb * 0.6
    flat(haze, hh)
    const r4 = rng(358)
    haze.replaceChildren(...Array.from({ length: 7 }, (_, k) => mist(W * (0.15 + r4() * 0.7), H * 0.82 - k * rh * 0.62 + r4() * 30, W * (0.35 + r4() * 0.3), H * 0.045 + r4() * 16)))
    yield
    // 6 · ferns and a mossy rock edge in front, dark and large, cut by the frame
    const ffh = H + climb * 1.4
    flat(front, ffh)
    const fs = Math.min(W, H) * (port ? 0.46 : 0.5)
    front.replaceChildren(
      s('path', { class: 't35l-nearrock', d: blob(W * (port ? 1.02 : 0.98), H * 1.04, fs * 0.55, fs * 0.22, 360, 0.18, 18), filter: 'url(#ink-wash)' }),
      ink(fern(-fs * 0.08, H + 10, fs * 1.05, -1.05, 361, 0.6) + fern(-fs * 0.12, H * 0.92, fs * 0.8, -0.45, 362, 0.7) + fern(W + fs * 0.05, H + 6, fs * 0.9, -2.2, 363, 0.55), 't35l-fern', 'wash'),
      ink(grass(W * 0.08, H + 4, fs * 0.5, 366).getAttribute('d')! + grass(W * 0.9, H + 4, fs * 0.4, 367).getAttribute('d')!, 't35l-fern'))
    yield
    // 5 · the terraces, near to far
    for (let i = 0; i < N; i++) yield* paintStep(i, G)
    // the workshop on the top terrace: plastered wall, a lit shoji door, eaves, the ink clock of the hook
    const hw = port ? W * 1.0 : Math.min(W * 0.56, 760), hh2 = rh * (port ? 1.5 : 1.7)
    Object.assign(houseArt.style, { left: `${f1(-hw / 2)}px`, top: `${f1(-hh2)}px`, width: `${f1(hw)}px`, height: `${f1(hh2 + G.treadH)}px` })
    houseArt.setAttribute('viewBox', `0 0 ${f1(hw)} ${f1(hh2 + G.treadH)}`)
    houseArt.replaceChildren(...workshop(hw, hh2, G.treadH, 400))
    seat()
    if (!still) (p = to, u = 1)
    write()
    drawThread()
    veils()
    GD.refresh()
  }

  /** A flat taller than the frame (it slides down as the camera climbs): its art spans y = H − fh … H. */
  function flat(svg: SVGSVGElement, fh: number) {
    const H = g!.H
    svg.setAttribute('viewBox', `0 ${f1(H - fh)} ${f1(g!.W)} ${f1(fh)}`)
    Object.assign(svg.style, { top: `${f1(H - fh)}px`, height: `${f1(fh)}px` })
  }

  function* paintStep(i: number, G: Geo) {
    const st = steps[i]
    const { W, H, port, wallH, treadH, rw, bank, vw, vh, slabW, lh, fs } = G
    const sd = side(i)
    const SW = rw + bank * 2
    const top = treadH * 1.7, bot = wallH + (i ? treadH * 0.6 : H * 0.9)
    const slabX = -sd * rw * (port ? 0.03 : 0.1)
    for (const el of [st.art, st.veil]) {
      Object.assign(el.style, { left: `${f1(-SW / 2)}px`, top: `${f1(-top)}px`, width: `${f1(SW)}px`, height: `${f1(top + bot)}px` })
      el.setAttribute('viewBox', `${f1(-SW / 2)} ${f1(-top)} ${f1(SW)} ${f1(top + bot)}`)
    }
    const lx = sd * rw * (port ? 0.4 : 0.45), ly = -treadH * 0.3
    const parts = terrace(G, i, sd, slabX, lx, ly, 370 + i * 23)
    yield
    st.art.replaceChildren(...parts.art, s('g', { class: 't35l-lamp', transform: `translate(${f1(lx)} ${f1(ly)})` }, toro(0, 0, lh, true)), ...parts.near)
    st.veil.replaceChildren(s('path', { d: parts.silhouette }))
    // the inscription stone carries the terrace's name (and on a wide frame what it is and the weekly-report example)
    const slabH = wallH * (port ? 0.78 : 0.74)
    Object.assign(st.face.style, { left: `${f1(slabX - slabW / 2)}px`, top: `${f1((wallH - slabH) / 2)}px`, width: `${f1(slabW)}px`, height: `${f1(slabH)}px`, fontSize: `${f1(fs)}px` })
    // the little scene stands on the back of the moss, beside the lamp
    const vx = sd * rw * (port ? 0 : 0.07)
    Object.assign(st.vig.style, { left: `${f1(vx - vw / 2)}px`, top: `${f1(-treadH * 0.32 - vh)}px`, width: `${f1(vw)}px`, height: `${f1(vh)}px` })
    yield
    st.vigArt.setAttribute('viewBox', `0 0 ${f1(vw)} ${f1(vh)}`)
    st.vigArt.replaceChildren(...vignette(K.rungs[i].id, vw, vh, 390 + i))
    for (const [k, v] of vigVars(K.rungs[i].id, vw, vh)) st.vig.style.setProperty(k, v)
    if (st.seal) Object.assign(st.seal.style, { left: `${f1(vw * 0.5)}px`, top: `${f1(vh * 0.595 - 2)}px` })
    // on a phone the example and the lamp's slip go down to the strip at the bottom (settle); on a wide frame the slip hangs from the lamp post
    if (port) {
      if (st.cord) st.cord.replaceChildren()
      if (at === i) footbar.replaceChildren(st.ex, ...(st.slip ? [st.slip] : []))
    } else {
      footbar.replaceChildren()
      st.words.append(st.ex)
      if (st.slip && st.cord) {
        const sw = clamp(W * 0.17, 200, 250)
        const sx = sd * rw * 0.33 - sw / 2
        st.el.append(st.slip)
        Object.assign(st.slip.style, { left: `${f1(sx)}px`, top: `${f1(wallH * 0.14)}px`, width: `${f1(sw)}px` })
        // a cord from the lamp's post to the slip's corner
        const a: Pt = [lx - sd * lh * 0.06, ly - lh * 0.42], b: Pt = [sx + sw / 2 + sd * sw * 0.3, wallH * 0.14 + 2]
        st.cord.setAttribute('viewBox', '0 0 1 1')
        st.cord.replaceChildren(s('path', { class: 't35l-cord', d: `M${P(a)}Q${P([(a[0] + b[0]) / 2, Math.max(a[1], b[1]) + 10])} ${P(b)}` }))
      }
    }
    if (i === 0) {
      const pw = port ? Math.min(W * 0.6, 230) : clamp(W * 0.18, 220, 270)
      Object.assign(st.el.querySelector<HTMLElement>('.t35l-plank')!.style, { left: `${f1(port ? -W * 0.46 : rw * 0.3)}px`, top: `${f1(wallH + treadH * (port ? 0.98 : 0.7))}px`, width: `${f1(pw)}px` })
    }
  }

  ctx.onCleanup(onSize(root, layout))
  ctx.onCleanup(() => {
    job?.cancel()
    loop.dispose()
  })
}

/** Gradients for the terraces' stone (tones per theme in ladder.css), added once to the page's p2 defs. */
function ldefs() {
  if (document.getElementById('t35l-defs')) return
  const stop = (o: number, c: string, a: number | string = 1) => s('stop', { offset: o, style: `stop-color:var(${c});stop-opacity:${a}` })
  document.getElementById('p2-defs')!.append(s('defs', { id: 't35l-defs' },
    s('linearGradient', { id: 't35l-ins', x1: 0, y1: 0, x2: 0.15, y2: 1 }, stop(0, '--t35l-i1'), stop(0.6, '--t35l-i2'), stop(1, '--t35l-i3')),
    s('linearGradient', { id: 't35l-moss', x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, '--t35l-m1'), stop(1, '--t35l-m2')),
    s('linearGradient', { id: 't35l-earth', x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, '--t35l-e1'), stop(1, '--t35l-e2', 0)),
    s('radialGradient', { id: 't35l-warm' }, stop(0, '--lantern', 0.62), stop(0.35, '--lantern', 0.22), stop(1, '--lantern', 0)),
    s('linearGradient', { id: 't35l-feather', x1: 0, y1: 0, x2: 1, y2: 0 },
      s('stop', { offset: 0, 'stop-color': '#000' }), s('stop', { offset: 0.2, 'stop-color': '#fff' }), s('stop', { offset: 0.8, 'stop-color': '#fff' }), s('stop', { offset: 1, 'stop-color': '#000' })),
    s('mask', { id: 't35l-fade', maskContentUnits: 'objectBoundingBox' }, s('rect', { width: 1, height: 1, fill: 'url(#t35l-feather)' }))))
}

/** A dressed stone with soft, irregular corners: x0…x1 × y0…y1 (path data). */
function quad(x0: number, y0: number, x1: number, y1: number, r: () => number): string {
  const ch = Math.min(x1 - x0, y1 - y0)
  const j = () => (r() - 0.5) * ch * 0.16
  const c = ch * (0.24 + r() * 0.16)
  const A: Pt = [x0 + j(), y0 + j()], B: Pt = [x1 + j(), y0 + j()], Cc: Pt = [x1 + j(), y1 + j()], D: Pt = [x0 + j(), y1 + j()]
  const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
  const seg = (a: Pt, b: Pt) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    return [lerp(a, b, c / L), lerp(a, b, 1 - c / L)] as [Pt, Pt]
  }
  const [ab0, ab1] = seg(A, B), [bc0, bc1] = seg(B, Cc), [cd0, cd1] = seg(Cc, D), [da0, da1] = seg(D, A)
  return `M${P(ab0)}L${P(ab1)}Q${P(B)} ${P(bc0)}L${P(bc1)}Q${P(Cc)} ${P(cd0)}L${P(cd1)}Q${P(D)} ${P(da0)}L${P(da1)}Q${P(A)} ${P(ab0)}Z`
}

/**
 * One terrace in its own coordinates (0, 0 = the middle of its wall's top edge): the hillside banks to both sides, the
 * moss tread with flagstones and the lamp's pool, the dry-stone wall in irregular courses round one inscription stone,
 * moss on the lip, the moonlit rim. Returns the art (back to front), what stands in front of the lamp, and a silhouette.
 */
function terrace(G: Geo, i: number, sd: number, slabX: number, lx: number, ly: number, seed: number) {
  const { W, H, wallH, treadH, rw, bank, slabW, port } = G
  const r = rng(seed)
  const half = rw / 2
  const art: SVGElement[] = []
  const near: SVGElement[] = []
  // mist at the back of the moss: it veils the foot of the next wall up
  art.push(mist(sd * rw * 0.1, -treadH * 0.95, rw * 0.8, treadH * 0.42))
  // the slopes: past both ends of the wall the hill falls away to the terrace below, earth under a skin of moss
  let slope = '', tufts = ''
  const plants: SVGElement[] = []
  for (const dir of [-1, 1]) {
    const e0 = dir * (half - 6), e1 = dir * (half + bank)
    slope += `M${P([e0, 0])}Q${P([dir * (half + bank * 0.35), -treadH * 0.05])} ${P([e1, treadH * 0.15])}L${P([e1, wallH + treadH * 0.45])}Q${P([dir * (half + bank * 0.3), wallH + treadH * 0.4])} ${P([dir * (half + 18), wallH + 6])}L${P([e0, wallH])}Z`
    for (let k = 0; k < 8; k++) {
      const t = r()
      tufts += grassD(dir * (half + bank * (0.04 + t * 0.8)), wallH * (0.15 + t * 0.55) + r() * 12, 12 + r() * 26, seed + 50 + k + (dir > 0 ? 20 : 0))
    }
    // a rock half sunk in the slope, a clump of reeds on the bank top, a fern: each side its own planting
    const t0 = 0.22 + r() * 0.3
    const bw = wallH * (0.5 + r() * 0.5), bh = bw * (0.32 + r() * 0.3)
    plants.push(s('g', { transform: `translate(${f1(dir * (half + bank * t0))} ${f1(wallH * (0.45 + t0 * 0.35))})`, style: `opacity:${(0.95 - t0 * 0.4).toFixed(2)}` }, stoneArt(bw, bh, seed + (dir > 0 ? 40 : 7), 'p2-stone t35l-rock')))
    plants.push(s('g', { class: 't35l-reedg' }, reeds(dir * (half + bank * (0.1 + r() * 0.12)), -treadH * (0.3 + r() * 0.3), wallH * (0.7 + r() * 0.5), seed + 60 + (dir > 0 ? 1 : 0), 5 + Math.floor(r() * 4))))
    tufts += fern(dir * (half + bank * (0.4 + r() * 0.2)), -treadH * 0.15, wallH * (0.5 + r() * 0.3), dir > 0 ? -0.6 - r() * 0.6 : -2.5 + r() * 0.6, seed + 70 + (dir > 0 ? 1 : 0), 0.5)
  }
  // the tread: one carpet of moss across the terrace and out over both banks, its back edge ragged with tufts
  const ex = half + bank
  const back: Pt[] = Array.from({ length: 25 }, (_, k) => {
    const u = k / 24
    const x = (-1 + u * 2) * ex
    const out = Math.max(0, Math.abs(x) - half) / bank // out on the banks the hill already falls away
    return [x, -treadH * (0.92 + Math.sin(u * 11 + seed) * 0.05 + r() * 0.07 - out * 0.3)] as Pt
  })
  const tread = `M${P([-ex, treadH * 0.15])}Q${P([-half - bank * 0.35, -treadH * 0.05])} ${P([-half - 6, 2])}L${P([half + 6, 2])}Q${P([half + bank * 0.35, -treadH * 0.05])} ${P([ex, treadH * 0.15])}L${back.reverse().map(P).join('L')}Z`
  back.reverse()
  let mossTex = '', flags = '', flagSh = ''
  for (let k = 0; k < 60; k++) {
    const y = -treadH * Math.pow(r(), 0.8)
    const x = (r() - 0.5) * 2 * (half + bank * 0.6)
    const L = (6 + r() * 12) * (1 + y / treadH * 0.4)
    mossTex += stroke([[x, y], [x + (r() - 0.5) * L * 0.6, y - L]], 1.1 + r() * 0.8, 0.1, 0.7, 0.1)
  }
  for (const [x, y] of back) mossTex += stroke([[x, y + 2], [x + (r() - 0.5) * 8, y - 6 - r() * 10]], 1.6, 0.1, 0.7, 0.1)
  for (let k = 0; k < 4; k++) {
    const t = k / 3
    const x = slabX * 0.3 + (r() - 0.5) * rw * 0.08 - sd * rw * 0.05 * t
    const y = -treadH * (0.16 + t * 0.62)
    const rx = rw * (0.06 - t * 0.022) * (0.85 + r() * 0.3), ry = treadH * (0.1 - t * 0.035)
    flags += blob(x, y, rx, ry, seed + 80 + k, 0.12, 14)
    flagSh += blob(x + rx * 0.08, y + ry * 0.5, rx * 1.04, ry * 0.9, seed + 90 + k, 0.1, 12)
  }
  art.push(s('g', { mask: 'url(#t35l-fade)' },
    s('path', { class: 't35l-bank', d: slope, fill: 'url(#t35l-earth)', filter: 'url(#ink-wash)' }),
    s('path', { class: 't35l-tread', d: tread, fill: 'url(#t35l-moss)', filter: 'url(#ink-wash)' }),
    s('path', { class: 't35l-mosstex', d: mossTex }),
    ...plants,
    s('path', { class: 't35l-tuft', d: tufts })))
  art.push(
    s('path', { class: 't35l-flagsh', d: flagSh }),
    s('path', { class: 't35l-flag', d: flags, fill: 'url(#t35k-tread)', filter: 'url(#ink-rough)' }),
    mist(sd * rw * 0.05, -treadH * 0.96, rw * 0.62, treadH * 0.16),
    s('ellipse', { class: 't35l-glow', cx: f1(lx), cy: f1(ly + treadH * 0.05), rx: f1(rw * (port ? 0.42 : 0.34)), ry: f1(treadH * 0.75), fill: 'url(#t35l-warm)' }))
  // the wall: rubble of field stone, rounded and uneven, each its own size and tone, chinked with small stones;
  // one big dressed stone carries the inscription
  const slabH = wallH * (port ? 0.78 : 0.74)
  // the name is carved straight into the coursed wall (no tablet): the courses run unbroken behind it
  const sx0 = Infinity, sx1 = -Infinity
  const tone = ['', '', '']
  let shade = '', rim = '', hi = '', joints = '', chink = ''
  let y = 0
  let course = 0
  while (y < wallH - 8) {
    const ch = Math.min(wallH - y, wallH * (0.17 + r() * 0.16))
    let x = -half - r() * 10
    while (x < half - 6) {
      const sw = Math.min(half + r() * 6 - x, ch * (0.75 + r() * 1.7))
      if (sw < 8) break
      const x1 = x + sw
      if (x1 > sx0 && x < sx1) {
        // the inscription stone sits here: stop short of it, resume after it
        if (sx0 - x > 12) tone[Math.floor(r() * 3)] += quad(x, y, sx0 - 3, y + ch, r)
        x = sx1 + 3
        continue
      }
      const y0 = y + (r() - 0.5) * ch * 0.22, y1 = y + ch + (r() - 0.5) * ch * 0.2
      tone[Math.floor(r() * 3)] += r() < 0.35 ? blob((x + x1) / 2, (y0 + y1) / 2, sw / 2, (y1 - y0) / 2, seed + 700 + Math.round(x * 3 + y), 0.1, 12) : quad(x, y0, x1, y1, r)
      shade += stroke([[x + sw * 0.12, y1 - 1.5], [x + sw * 0.6, y1 - 0.5], [x1 - 1.5, y0 + (y1 - y0) * 0.5]], Math.max(1.4, ch * 0.11), 0.2, 0.25, 0.2)
      hi += stroke([[x + 3, y0 + 2.4], [x + sw * 0.45, y0 + 1.6], [x + sw * 0.75, y0 + 2.4]], Math.max(0.9, ch * 0.06), 0.3, 0.4, 0.1)
      if (course === 0) rim += stroke([[x + 3, y0 + 1.8], [x + sw * 0.5, y0 + 1.2], [x1 - 4, y0 + 2]], Math.max(1, ch * 0.08), 0.25, 0.3, 0.1)
      if (r() < 0.3) chink += blob(x1 + 1, y + ch * (0.25 + r() * 0.5), 2 + r() * 3.5, 1.6 + r() * 2.4, seed + 300 + Math.round(x), 0.25, 8)
      if (r() < 0.1) joints += blob(x1 + 1, y + ch * (0.3 + r() * 0.5), 3 + r() * 5, 2 + r() * 3, seed + 400 + Math.round(x), 0.3, 8)
      x = x1 + 2.5 + r() * 3
    }
    y += ch + 2.5
    course++
  }
  // moss cushions spilling over the lip, a few strands hanging down the face
  let lip = ''
  for (let k = 0; k < 18; k++) lip += blob(-half + r() * rw, 1 + r() * 3, 8 + r() * 26, 3 + r() * 5, seed + 120 + k, 0.35, 10)
  for (let k = 0; k < 5; k++) {
    const x = -half + r() * rw
    if (x > sx0 && x < sx1) continue
    lip += stroke(curve([x, 2], [x + 3, wallH * 0.2], [x - 2, wallH * (0.25 + r() * 0.3)], 6), 3 + r() * 3, 0.05, 0.7, 0.2)
  }
  // where the name is cut, the wall's faces were dressed a little flatter: a soft darker wash keeps the letters legible
  const carve = blob(slabX, wallH * 0.5, slabW * 0.56, slabH * 0.56, seed + 7, 0.25, 18)
  art.push(
    s('rect', { class: 't35l-joint', x: f1(-half - 2), y: 0, width: f1(rw + 4), height: f1(wallH) }),
    s('path', { class: 't35l-st0', d: tone[0], filter: 'url(#ink-rough)' }),
    s('path', { class: 't35l-st1', d: tone[1], filter: 'url(#ink-rough)' }),
    s('path', { class: 't35l-st2', d: tone[2], filter: 'url(#ink-rough)' }),
    s('path', { class: 't35l-hi', d: hi }),
    s('path', { class: 't35l-shade', d: shade }),
    s('path', { class: 't35l-chink', d: chink, filter: 'url(#ink-rough)' }),
    s('path', { class: 't35l-carveshade', d: carve, filter: 'url(#ink-wash)' }),
    s('path', { class: 't35l-joint-moss', d: joints }),
    s('path', { class: 't35l-rim', d: rim }),
    // H3: the wall's top edge warms when a scroll is carried — the place it can be set down
    s('path', { class: 't35l-target', d: stroke([[-half * 0.92, -1], [0, -2], [half * 0.92, -1]], Math.max(4, wallH * 0.05), 0.1, 0.1, 0.3) }),
    s('ellipse', { class: 't35l-glow t35l-glow-wall', cx: f1(lx * 0.92), cy: f1(wallH * 0.12), rx: f1(rw * 0.3), ry: f1(wallH * 0.75), fill: 'url(#t35l-warm)' }),
    s('path', { class: 't35l-lip', d: lip, filter: 'url(#ink-wash)' }),
    s('ellipse', { class: 't35k-contact', cx: 0, cy: f1(wallH + 2), rx: f1(half * 1.04), ry: f1(Math.max(4, wallH * 0.05)) }))
  // the ground at the very foot of the stairs: moss, a stepping stone, reeds
  if (i === 0) {
    const gy = wallH + 4
    const gd = `M${P([-half - bank, gy + treadH * 0.2])}L${P([-half - bank * 0.2, gy])}L${P([half + bank * 0.2, gy])}L${P([half + bank, gy + treadH * 0.2])}L${P([half + bank, gy + H])}L${P([-half - bank, gy + H])}Z`
    let gt = ''
    for (let k = 0; k < 60; k++) {
      const yy = gy + Math.pow(r(), 1.3) * H * 0.7
      const xx = (r() - 0.5) * (rw + bank * 1.6)
      const L = 8 + (yy - gy) * 0.05 + r() * 10
      gt += stroke([[xx, yy], [xx + (r() - 0.5) * L * 0.6, yy - L]], 1.2 + (yy - gy) * 0.004, 0.1, 0.7, 0.1)
    }
    art.unshift(s('g', { mask: 'url(#t35l-fade)' }, s('path', { class: 't35l-ground', d: gd, fill: 'url(#t35l-moss)', filter: 'url(#ink-wash)' }), s('path', { class: 't35l-mosstex', d: gt })))
    // stepping stones come up out of the bottom of the frame to the first wall, big and near to small and far
    let st = '', stSh = '', pebbles = ''
    for (let k = 0; k < 4; k++) {
      const t2 = k / 3
      const x = -sd * rw * (0.02 + 0.08 * Math.sin(t2 * 2.4)) + (port ? rw * 0.06 : 0)
      const yy = gy + H * 0.62 - t2 * (H * 0.62 - treadH * 0.3)
      const rx = rw * (port ? 0.16 : 0.09) * (1.5 - t2 * 0.7), ry = rx * (0.22 + t2 * 0.04)
      st += blob(x, yy, rx, ry, seed + 510 + k, 0.12, 14)
      stSh += blob(x + rx * 0.06, yy + ry * 0.55, rx * 1.05, ry * 0.85, seed + 520 + k, 0.1, 12)
    }
    for (let k = 0; k < 14; k++) pebbles += blob((r() - 0.5) * rw * 1.2, gy + 10 + r() * H * 0.55, 2 + r() * 5, 1.5 + r() * 2.5, seed + 540 + k, 0.2, 8)
    art.push(
      s('path', { class: 't35l-flagsh', d: stSh }),
      s('path', { class: 't35l-flag', d: st, fill: 'url(#t35k-tread)', filter: 'url(#ink-rough)' }),
      s('path', { class: 't35l-chink', d: pebbles }),
      s('g', { class: 't35l-reedg' }, reeds(-half - bank * 0.1, gy + treadH * 0.4, wallH * 0.9, seed + 502, 6)))
  }
  // ferns at the wall's ends, drooping over its corners: the near layer of every terrace
  const fl = wallH * (port ? 0.9 : 1.1)
  near.push(ink(fern(-half - 8, wallH * 0.6, fl, -0.55, seed + 600, 0.55) + fern(-half + 6, wallH * 0.95, fl * 0.75, -2.5, seed + 601, 0.6) + fern(half + 8, wallH * 0.7, fl * 0.9, -2.6, seed + 602, 0.55) + fern(half - 4, wallH, fl * 0.6, -0.4, seed + 603, 0.6), 't35l-endfern', 'wash'))
  const silhouette = `${tread}M${P([-half - 2, -2])}L${P([half + 2, -2])}L${P([half + 2, wallH])}L${P([-half - 2, wallH])}Z${slope}`
  void W
  return { art, near, silhouette }
}

/** Grass blades as path data (paint.grass returns an element; terraces need many in one path). */
function grassD(x: number, y: number, w: number, seed: number): string {
  return grass(x, y, w, seed).getAttribute('d') ?? ''
}

/** CSS variables a little scene animates with (hop points of the walker, the trough of the workflow). */
function vigVars(id: string, w: number, hh: number): [string, string][] {
  const px = (n: number) => `${f1(n)}px`
  // the walker starts at x = 0.1 w; it lands on each stone's top
  if (id === 'agent') return [['--h1x', px(w * 0.2)], ['--h1y', px(-hh * 0.1)], ['--h2x', px(w * 0.44)], ['--h2y', px(-hh * 0.2)], ['--h3x', px(w * 0.66)], ['--h3y', px(-hh * 0.08)], ['--up', px(-hh * 0.24)]]
  // the rider starts at 0.06 w: it stops before the middle gate, then runs on past the last one
  if (id === 'workflow') return [['--r1', px(w * 0.34)], ['--r2', px(w * 0.82)]]
  return []
}

/** A folded paper figure (origami robe, diamond head, a conical paper hat) standing on (x, y), ht tall, facing dir. */
function folk(x: number, y: number, ht: number, dir: number, kneel = false, carry = false): SVGGElement {
  const u = ht / 10
  const X = (v: number) => f1(x + v * u * dir), Y = (v: number) => f1(y - v * u)
  const body = kneel ? 4.6 : 6.4
  const tri = (a: [number, number], b: [number, number], c: [number, number]) => `M${X(a[0])} ${Y(a[1])}L${X(b[0])} ${Y(b[1])}L${X(c[0])} ${Y(c[1])}Z`
  // the robe's folds: one face to the moon, one turned away, a sleeve in shade — paper read by its creases
  const front = tri([-2.3, 0], [0.4, body + 0.2], [0.1, 0])
  const turned = tri([0.4, body + 0.2], [-0.8, body], [-2.3, 0])
  const back = tri([0.1, 0], [0.4, body + 0.2], [2.2, 0])
  const head = `M${X(0)} ${Y(body + 0.3)}L${X(-1)} ${Y(body + 1.7)}L${X(0.1)} ${Y(body + 3)}L${X(1.1)} ${Y(body + 1.6)}Z`
  const hat = tri([-2.2, body + 2.4], [2.2, body + 2.2], [0.2, body + 3.9])
  const arm = carry ? tri([0.2, body - 1.2], [2.8, body - 2.6], [2.6, body - 3.3]) + tri([0.2, body - 1.2], [2.6, body - 3.3], [0.4, body - 2.2]) : tri([0.3, body - 1], [2.4, body - 2.2], [2.1, body - 2.9])
  return s('g', { class: 't35l-folk' },
    s('ellipse', { class: 't35k-contact', cx: X(0), cy: Y(0), rx: f1(u * 2.8), ry: f1(Math.max(1.5, u * 0.45)) }),
    s('path', { class: 't35l-origami-2', d: back }),
    s('path', { class: 't35l-origami', d: front }),
    s('path', { class: 't35l-origami-m', d: turned }),
    s('path', { class: 't35l-origami', d: head }),
    s('path', { class: 't35l-origami-2', d: arm }),
    s('path', { class: 't35l-hat', d: hat }),
    ink(stroke([[x + 0.4 * u * dir, y - (body + 0.2) * u], [x + 0.1 * u * dir, y - 0.3 * u]], Math.max(0.8, u * 0.12), 0.1, 0.2, 0.3) + stroke([[x - 2.2 * u * dir, y - (body + 2.4) * u], [x + 2.2 * u * dir, y - (body + 2.2) * u]], Math.max(1, u * 0.2), 0.1, 0.1, 0.4), 't35l-crease'))
}

/** The report as a small rolled scroll lying (or hanging, vertical) at (x, y), len long, d thick. */
function report(x: number, y: number, len: number, d: number, vertical = false): SVGGElement {
  const w = vertical ? d : len, hh = vertical ? len : d
  const x0 = x - w / 2, y0 = y - hh / 2
  return s('g', { class: 't35l-report' },
    s('rect', { class: 't35l-paper', x: f1(x0), y: f1(y0), width: f1(w), height: f1(hh), rx: f1(d / 2) }),
    s('rect', { x: f1(x0), y: f1(y0), width: f1(w), height: f1(hh), rx: f1(d / 2), fill: vertical ? 'url(#t35k-cyl)' : 'none' }),
    vertical
      ? ink(stroke([[x0 - d * 0.15, y0 + d * 0.2], [x0 + w + d * 0.15, y0 + d * 0.2]], d * 0.4, 0.1, 0.1, 0.6) + stroke([[x0 - d * 0.15, y0 + hh - d * 0.2], [x0 + w + d * 0.15, y0 + hh - d * 0.2]], d * 0.4, 0.1, 0.1, 0.6), 't35l-knobs')
      : ink(stroke([[x0 + d * 0.2, y0 - d * 0.15], [x0 + d * 0.2, y0 + hh + d * 0.15]], d * 0.4, 0.1, 0.1, 0.6) + stroke([[x0 + w - d * 0.2, y0 - d * 0.15], [x0 + w - d * 0.2, y0 + hh + d * 0.15]], d * 0.4, 0.1, 0.1, 0.6), 't35l-knobs'),
    ink(vertical ? stroke([[x0 - 1, y], [x0 + w + 1, y + 1]], d * 0.22, 0.1, 0.1, 0.5) : stroke([[x, y0 - 1], [x + 1, y0 + hh + 1]], d * 0.22, 0.1, 0.1, 0.5), 't35l-tie'))
}

/** The little scene that plays on each terrace (box w × hh, the moss at y = hh). */
function vignette(id: string, w: number, hh: number, seed: number): SVGElement[] {
  const y = hh - 2
  const u = hh / 100
  const r = rng(seed)
  if (id === 'prompt') {
    // a paper figure kneels on a flat stone and says the weekly request out loud; the words leave as breath and thin into mist
    const fx = w * 0.3
    const fh = hh * 0.66
    let curls = ''
    for (let k = 0; k < 5; k++) {
      const x0 = fx + fh * 0.22 + k * 2 * u, y0 = y - hh * 0.16 - fh * 0.2 + k * 2 * u
      const a: Pt = [x0, y0], b: Pt = [x0 + (16 + k * 11) * u, y0 - (18 + k * 7) * u], c: Pt = [x0 + (34 + k * 17) * u, y0 - (30 + k * 11) * u]
      curls += stroke([...curve(a, [x0 + 12 * u, y0 + 7 * u], b, 10), ...curve(b, [b[0] - 12 * u, b[1] - 16 * u], c, 10).slice(1)], (3 - k * 0.45) * u, 0.15, 0.6, 0.05)
    }
    let motes = ''
    for (let k = 0; k < 16; k++) {
      const mx = w * (0.48 + r() * 0.44), my = hh * (0.06 + r() * 0.42)
      motes += stroke([[mx, my], [mx + (2 + r() * 5) * u, my + (r() - 0.5) * 3 * u]], (0.8 + r() * 1.2) * u, 0.3, 0.3, 0.1)
    }
    // (no figure here: the paper walker belongs to the Agent terrace) the request lies on a flat stone, its words rise as breath
    return [
      s('g', { transform: `translate(${f1(fx + 2 * u)} ${f1(y)})` }, stoneArt(w * 0.36, hh * 0.14, seed, 'p2-stone t35l-rock')),
      report(fx + fh * 0.1, y - hh * 0.12 - fh * 0.05, fh * 0.34, fh * 0.1),
      s('g', { class: 't35l-breath' },
        mist(w * 0.66, hh * 0.3, w * 0.3, hh * 0.18), mist(w * 0.84, hh * 0.14, w * 0.16, hh * 0.1),
        ink(curls, 't35l-curl', 'wash'),
        s('path', { class: 't35l-mote', d: motes })),
    ]
  }
  if (id === 'skill') {
    // a standing boulder with a niche; a bamboo peg across it; the report now hangs there, tied, with its paper tag
    const bx = w * 0.5, bw = w * 0.66, bh = hh * 0.9
    const nx0 = bx - bw * 0.14, nx1 = bx + bw * 0.12, ny0 = y - bh * 0.16, ny1 = y - bh * 0.72
    const niche = blob((nx0 + nx1) / 2, (ny0 + ny1) / 2, (nx1 - nx0) / 2, (ny0 - ny1) / 2, seed + 11, 0.1, 18)
    const py = ny1 + (nx1 - nx0) * 0.36
    const len = (ny0 - py) * 0.62, d = (nx1 - nx0) * 0.2
    const cxs = (nx0 + nx1) / 2
    return [
      s('g', { transform: `translate(${f1(bx)} ${f1(y)})` }, stoneArt(bw, bh, seed, 'p2-stone t35l-rock')),
      ink(blob(bx - bw * 0.08, y - bh * 0.93, bw * 0.2, bh * 0.05, seed + 4, 0.35, 12) + blob(bx + bw * 0.2, y - bh * 0.72, bw * 0.1, bh * 0.03, seed + 5, 0.3, 10), 't35l-lip', 'wash'),
      s('path', { class: 't35l-niche', d: niche, filter: 'url(#ink-rough)' }),
      s('path', { class: 't35l-niche-sill', d: stroke([[nx0 + 2, ny0 + 1], [cxs, ny0 + 2], [nx1 - 2, ny0]], 3 * u, 0.1, 0.1, 0.3) }),
      woodG([wood([nx0 - 6 * u, py], [nx1 + 6 * u, py + 1], Math.max(4, 3.2 * u), seed + 3)], 't35l-bamboo'),
      s('g', { class: 't35l-hang' },
        s('path', { class: 't35l-cord', d: `M${f1(cxs - d * 0.7)} ${f1(py)}L${f1(cxs)} ${f1(py + len * 0.18)}L${f1(cxs + d * 0.7)} ${f1(py)}` }),
        report(cxs, py + len * 0.18 + len * 0.5, len, d, true),
        s('path', { class: 't35l-cord', d: `M${f1(cxs + d * 0.3)} ${f1(py + len * 0.7)}Q${f1(cxs + d * 1.6)} ${f1(py + len * 0.82)} ${f1(cxs + d * 1.9)} ${f1(py + len * 0.9)}` }),
        s('rect', { class: 't35l-label', x: f1(cxs + d * 1.4), y: f1(py + len * 0.88), width: f1(d * 1.1), height: f1(d * 2.4), rx: 1, transform: `rotate(-8 ${f1(cxs + d * 1.9)} ${f1(py + len * 0.9)})` }),
        ink(stroke([[cxs + d * 1.8, py + len * 0.98], [cxs + d * 1.85, py + len * 1.1]], Math.max(1, d * 0.12), 0.2, 0.2, 0.3), 't35k-edge')),
      ink(fern(bx - bw * 0.45, y, hh * 0.38, -2.4, seed + 9, 0.5) + fern(bx + bw * 0.42, y, hh * 0.32, -0.6, seed + 10, 0.55), 't35l-endfern', 'wash'),
    ]
  }
  if (id === 'agent') {
    // three flat stones across a dark runnel; a folded paper figure carrying the report hops across them by itself,
    // leaving the path it did not take
    const stone = (x: number, yy: number, rx: number, k: number) => s('g', null,
      s('ellipse', { class: 't35k-contact', cx: f1(x + 2), cy: f1(yy + rx * 0.12), rx: f1(rx * 1.05), ry: f1(rx * 0.16) }),
      s('path', { d: blob(x, yy - rx * 0.08, rx, rx * 0.24, seed + k, 0.12, 14), fill: 'url(#t35k-tread)', filter: 'url(#ink-rough)' }),
      ink(stroke([[x - rx * 0.9, yy - rx * 0.02], [x, yy + rx * 0.1], [x + rx * 0.95, yy - rx * 0.04]], Math.max(1.2, rx * 0.05), 0.2, 0.2, 0.3), 't35k-edge'),
      ink(stroke([[x - rx * 0.6, yy - rx * 0.22], [x - rx * 0.1, yy - rx * 0.3], [x + rx * 0.4, yy - rx * 0.24]], Math.max(1, rx * 0.04), 0.3, 0.3, 0.1), 't35k-rim'))
    const runnel = blob(w * 0.5, y - hh * 0.1, w * 0.46, hh * 0.08, seed + 7, 0.25, 18)
    let dots = ''
    for (let k = 0; k < 9; k++) {
      const t = k / 8
      const [x, yy] = curve([w * 0.12, y - hh * 0.02], [w * 0.2, y - hh * 0.5], [w * 0.38, y - hh * 0.62], 8)[Math.round(t * 8)]
      dots += blob(x, yy, 1.4 * u, 0.8 * u, seed + 30 + k, 0.1, 6)
    }
    return [
      s('path', { class: 't35l-runnel', d: runnel, filter: 'url(#ink-wash)' }),
      s('path', { class: 't35l-dots', d: dots }),
      stone(w * 0.3, y - hh * 0.06, w * 0.11, 1), stone(w * 0.54, y - hh * 0.16, w * 0.095, 2), stone(w * 0.76, y - hh * 0.04, w * 0.11, 3),
      s('g', { class: 't35l-walker' }, s('g', { transform: `translate(${f1(w * 0.1)} 0)` }, folk(0, y, hh * 0.62, 1, false, true), report(2.7 * hh * 0.062, y - hh * 0.62 * 0.42, hh * 0.13, hh * 0.045))),
    ]
  }
  if (id === 'workflow') {
    // a bamboo trough on crossed legs runs through three gates; the report slides along it; the middle gate waits for your seal
    const ty = y - hh * 0.32
    const gh = hh * 0.34
    const gate = (x: number, k: number) => s('g', { class: `t35l-gate t35l-gate-${k}` },
      woodG([wood([x - 10 * u, ty + 6 * u], [x - 9 * u, ty - gh], 2.6 * u, seed + k * 3), wood([x + 10 * u, ty + 6 * u], [x + 9 * u, ty - gh], 2.6 * u, seed + k * 3 + 1), wood([x - 13 * u, ty - gh * 0.78], [x + 13 * u, ty - gh * 0.78], 1.8 * u, seed + k * 3 + 4)], 't35l-gatewood'),
      ink(`M${f1(x - 17 * u)} ${f1(ty - gh - 3 * u)}Q${f1(x)} ${f1(ty - gh + 0.5 * u)} ${f1(x + 17 * u)} ${f1(ty - gh - 3 * u)}L${f1(x + 15 * u)} ${f1(ty - gh + 1.2 * u)}Q${f1(x)} ${f1(ty - gh + 3.5 * u)} ${f1(x - 15 * u)} ${f1(ty - gh + 1.2 * u)}Z`, 't35l-kasagi', 'rough'),
      s('g', { class: 't35l-bar' }, woodG([wood([x - 12 * u, ty - 8 * u], [x + 12 * u, ty - 8.5 * u], 2.8 * u, seed + k * 3 + 2)], 't35l-gatewood')))
    return [
      s('ellipse', { class: 't35k-contact', cx: f1(w * 0.5), cy: f1(y), rx: f1(w * 0.48), ry: f1(3 * u) }),
      woodG([wood([w * 0.06, y], [w * 0.16, ty + 3 * u], 2.4 * u, seed + 20), wood([w * 0.16, y], [w * 0.06, ty + 3 * u], 2.4 * u, seed + 21), wood([w * 0.86, y], [w * 0.96, ty + 3 * u], 2.4 * u, seed + 22), wood([w * 0.96, y], [w * 0.86, ty + 3 * u], 2.4 * u, seed + 23)], 't35l-gatewood'),
      s('g', { class: 't35l-trough' }, woodG([wood([w * 0.01, ty], [w * 0.99, ty + 2 * u], Math.max(6, 6 * u), seed + 24)], 't35l-bamboo')),
      ink(stroke([[w * 0.02, ty - 2.4 * u], [w * 0.98, ty - 0.6 * u]], 1.4 * u, 0.1, 0.1, 0.3), 't35l-waterline'),
      gate(w * 0.24, 1), gate(w * 0.5, 2), gate(w * 0.78, 3),
      s('g', { class: 't35l-rider' }, report(w * 0.06, ty - 5 * u, 14 * u, 5 * u)),
      s('ellipse', { class: 't35l-basin', cx: f1(w * 0.97), cy: f1(y - 2 * u), rx: f1(w * 0.05), ry: f1(2.4 * u) }),
    ]
  }
  // hook: a shishi-odoshi — water drips from the spout into the tube until it tips by itself and knocks the stone
  const px = w * 0.52, py = y - hh * 0.32
  const tl = w * 0.24
  const tube = s('g', { class: 't35l-tube', style: `transform-origin:${f1(px)}px ${f1(py)}px` },
    woodG([wood([px - tl, py - hh * 0.14], [px + tl * 0.95, py + hh * 0.1], Math.max(8, 7 * u), seed + 1)], 't35l-bamboo'),
    s('ellipse', { class: 't35l-mouth', cx: f1(px - tl), cy: f1(py - hh * 0.14), rx: f1(1.8 * u), ry: f1(3.6 * u), transform: `rotate(25 ${f1(px - tl)} ${f1(py - hh * 0.14)})` }))
  const drops = [0, 1, 2].map((k) => s('circle', { class: `t35l-drop t35l-drop-${k}`, cx: f1(px - tl + 1), cy: f1(py - hh * 0.36), r: f1(1.6 * u) }))
  return [
    s('g', { transform: `translate(${f1(w * 0.14)} ${f1(y)})` }, stoneArt(w * 0.2, hh * 0.22, seed + 3, 'p2-stone t35l-rock')),
    s('ellipse', { class: 't35l-basin', cx: f1(w * 0.14), cy: f1(y - hh * 0.2), rx: f1(w * 0.06), ry: f1(2.6 * u) }),
    woodG([wood([w * 0.06, y], [w * 0.06, py - hh * 0.46], 4.4 * u, seed + 4), wood([w * 0.05, py - hh * 0.44], [px - tl * 0.95, py - hh * 0.4], 3.6 * u, seed + 5)], 't35l-bamboo'),
    woodG([wood([px - 5 * u, y], [px - 5 * u, py - 3 * u], 3 * u, seed + 6), wood([px + 5 * u, y], [px + 5 * u, py - 3 * u], 3 * u, seed + 7)], 't35l-gatewood'),
    ...drops,
    tube,
    s('g', { transform: `translate(${f1(px + tl * 1.05)} ${f1(y)})` }, stoneArt(w * 0.1, hh * 0.12, seed + 8, 'p2-stone t35l-rock')),
    s('ellipse', { class: 't35k-contact', cx: f1(w * 0.5), cy: f1(y), rx: f1(w * 0.46), ry: f1(3 * u) }),
  ]
}

/** The workshop at the top: a plastered front, a sliding door of lit shoji, deep eaves, an ink clock beside the door. */
function workshop(w: number, hh: number, tread: number, seed: number): SVGElement[] {
  const u = w / 400
  const wallT = hh * 0.34, wallB = hh
  const dx = w * 0.3, dw = w * 0.4, dt = hh * 0.42
  let lat = ''
  for (let k = 1; k < 4; k++) lat += stroke([[dx + 2, dt + ((wallB - dt) * k) / 4], [dx + dw - 2, dt + ((wallB - dt) * k) / 4]], 1.6 * u + 0.6, 0.05, 0.05, 0.6)
  for (let k = 1; k < 4; k++) lat += stroke([[dx + (dw * k) / 4, dt + 2], [dx + (dw * k) / 4, wallB - 2]], 1.6 * u + 0.6, 0.05, 0.05, 0.6)
  const cxk = w * 0.82, cyk = hh * 0.6, ck = Math.min(w * 0.05, hh * 0.09)
  let ticks = ''
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2
    ticks += stroke([[cxk + Math.cos(a) * ck * 0.78, cyk + Math.sin(a) * ck * 0.78], [cxk + Math.cos(a) * ck * 0.92, cyk + Math.sin(a) * ck * 0.92]], 1.4, 0.2, 0.2, 0.3)
  }
  return [
    mist(w * 0.5, wallB + tread * 0.3, w * 0.7, tread * 0.5),
    s('ellipse', { class: 't35l-spill', cx: f1(w * 0.5), cy: f1(wallB + tread * 0.2), rx: f1(w * 0.5), ry: f1(tread * 0.6), fill: 'url(#t35l-warm)' }),
    s('rect', { class: 't35l-plaster', x: f1(w * 0.06), y: f1(wallT), width: f1(w * 0.88), height: f1(wallB - wallT) }),
    s('rect', { class: 't35l-shoji', x: f1(dx), y: f1(dt), width: f1(dw), height: f1(wallB - dt) }),
    s('ellipse', { cx: f1(dx + dw * 0.5), cy: f1((dt + wallB) / 2), rx: f1(dw * 0.8), ry: f1((wallB - dt) * 0.9), fill: 'url(#t35l-warm)', class: 't35l-shoji-glow' }),
    ink(lat, 't35l-lattice', 'rough'),
    woodG([
      wood([w * 0.06, wallB], [w * 0.06, wallT], 9 * u + 2, seed), wood([w * 0.94, wallB], [w * 0.94, wallT], 9 * u + 2, seed + 1),
      wood([dx, wallB], [dx, dt], 6 * u + 2, seed + 2), wood([dx + dw, wallB], [dx + dw, dt], 6 * u + 2, seed + 3),
      wood([dx - 6, dt], [dx + dw + 6, dt], 7 * u + 2, seed + 4), wood([w * 0.02, wallT + 6], [w * 0.98, wallT + 5], 10 * u + 2, seed + 5),
    ], 't35l-beams'),
    // the clock painted on a round board: the hand comes round to eight (the hook's Monday morning)
    s('circle', { class: 't35l-clock', cx: f1(cxk), cy: f1(cyk), r: f1(ck) }),
    ink(ticks, 't35k-edge'),
    s('g', { class: 't35l-hand', style: `transform-origin:${f1(cxk)}px ${f1(cyk)}px` }, ink(stroke([[cxk, cyk], [cxk, cyk - ck * 0.7]], 2.4, 0.05, 0.4, 0.3), 't35l-red')),
    ink(stroke([[cxk, cyk], [cxk + ck * 0.5, cyk - ck * 0.1]], 2, 0.05, 0.4, 0.3), 't35k-edge'),
    ink(roof(w * 0.04, w * 0.96, wallT - 2, u * 1.6, hh * 0.24), 't35l-eave', 'rough'),
    ink(stroke([[w * 0.24, wallT - hh * 0.24 - 1], [w * 0.5, wallT - hh * 0.25 - 2], [w * 0.76, wallT - hh * 0.24 - 1]], 2.2 * u + 1, 0.2, 0.2, 0.2), 't35k-rim'),
    wash(blob(w * 0.5, wallB + 2, w * 0.5, 6, seed + 9, 0.2), 0.3),
  ]
}
