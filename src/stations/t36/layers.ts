import { fill, h } from '../../core/dom'
import { createLoop } from '../../core/loop'
import { cssVar, onPrefs } from '../../core/prefs'
import { onSize, rng } from '../../ui/part2/ink'
import type { SceneCtx } from '../types'
import { C } from './content'
import { cardButton, F } from '../t34/night'

const K = C.scenes.layers
const P = K.play
const TAU = Math.PI * 2
interface Item { on: boolean; x: number; y: number; v: number; leaf: boolean }
interface Ring { on: boolean; x: number; y: number; t: number }

/**
 * Scene 4 — the koi pond is laid down like sheets of tracing paper, one prompt per layer (water → koi → control →
 * falling moon → score → sound → effects); with all seven in place it becomes the real 30-second game (Canvas 2D).
 */
export function layersScene(ctx: SceneCtx) {
  const on = new Set<number>()
  const calm = ctx.reduced || ctx.quality === 'low'
  const r = rng(36)
  const cv = h('canvas', { class: 't36g-cv', role: 'img', 'aria-label': K.art })
  const g = cv.getContext('2d')!
  const chips = K.layers.map((l, i) => h('button', { class: 't36g-chip', type: 'button', 'aria-pressed': 'false', 'aria-label': fill(K.layerAria, { n: i + 1, name: l.name }), onClick: () => add(i) },
    h('span', { class: 't36g-n', 'aria-hidden': 'true' }, String(i + 1)), l.name))
  const said = h('div', { class: 't36g-said', 'aria-live': 'polite' })
  const start = h('button', { class: 't36g-start', type: 'button', hidden: true, onClick: play }, P.start)
  const scoreEl = h('span'), livesEl = h('span'), timeEl = h('span')
  const pause = h('button', { class: 't36g-mini', type: 'button', onClick: togglePause }, P.pause)
  const sound = h('button', { class: 't36g-mini', type: 'button', 'aria-pressed': 'false', onClick: toggleSound }, P.sound)
  const hud = h('div', { class: 't36g-hud', hidden: true }, scoreEl, livesEl, timeEl, pause, sound)
  const endMsg = h('p', { class: 't36g-endmsg' })
  const live = h('p', { class: 'visually-hidden', 'aria-live': 'assertive' })
  const again = h('button', { class: 't36g-start', type: 'button', onClick: play }, P.again)
  const endBox = h('div', { class: 't36g-end', hidden: true }, endMsg, again)
  const stage = h('div', { class: 't36g-stage' }, cv, hud, endBox, live)
  const root = h('div', { class: 't36 t36g' },
    h('p', { class: 'visually-hidden' }, K.art),
    stage,
    h('div', { class: 't36g-side' }, h('div', { class: 't36g-chips' }, ...chips), said, start, ctx.reduced ? h('p', { class: 't36g-still' }, P.still) : null))
  ctx.art.append(root)
  ctx.prompt(K.prompt)
  const pill = cardButton(ctx, root, K.takeaway)
  if (pill) endBox.append(pill)

  // ── game state (pre-allocated: nothing is created per frame) ──
  let W = 300, H = 300, dpr = 1
  let mode: 'build' | 'play' | 'end' = 'build'
  let score = 0, lives = 3, left = 30, spawn = 0, paused = false, shown = ''
  const koi = { x: 150, y: 170, tx: 150, ty: 170, a: 0 }
  const keys = { l: false, r: false, u: false, d: false }
  const items: Item[] = Array.from({ length: 12 }, () => ({ on: false, x: 0, y: 0, v: 0, leaf: false }))
  const rings: Ring[] = Array.from({ length: 6 }, () => ({ on: false, x: 0, y: 0, t: 0 }))
  const flies = Array.from({ length: 7 }, () => ({ x: r(), y: r(), p: r() * TAU }))
  let col = { water: '', paper: '', ink: '', moon: '', red: '', leaf: '', fly: '' }
  const readCol = () => {
    col = { water: cssVar('--water'), paper: cssVar('--paper'), ink: cssVar('--ink'), moon: cssVar('--moon'), red: cssVar('--vermilion'), leaf: cssVar('--lantern'), fly: cssVar('--firefly') }
    loop.wake()
  }
  const loop = createLoop(cv, frame, { essential: true })
  ctx.onCleanup(() => loop.dispose())
  ctx.onCleanup(onPrefs(readCol))
  ctx.onCleanup(onSize(stage, () => {
    const w = stage.clientWidth, hh = stage.clientHeight
    if (!w || !hh) return
    dpr = Math.min(2, devicePixelRatio || 1)
    W = w
    H = hh
    cv.width = Math.round(W * dpr)
    cv.height = Math.round(H * dpr)
    if (mode === 'build') demo()
    loop.wake()
  }))
  readCol()

  /** Static items for the build view. */
  function demo() {
    koi.x = koi.tx = W * 0.45
    koi.y = koi.ty = H * 0.6
    koi.a = -0.3
    items.forEach((it, i) => Object.assign(it, { on: i < 4, x: W * (0.2 + i * 0.2), y: H * (0.18 + (i % 2) * 0.16), leaf: i === 2 }))
  }

  // ── input ──
  const aim = (e: PointerEvent) => {
    if (mode !== 'play') return
    koi.tx = e.offsetX
    koi.ty = e.offsetY
  }
  cv.addEventListener('pointerdown', aim)
  cv.addEventListener('pointermove', aim)
  const key = (down: boolean) => (e: KeyboardEvent) => {
    const k = ({ ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd' } as const)[e.key as 'ArrowLeft']
    if (!k || mode !== 'play') return
    e.preventDefault()
    keys[k] = down
  }
  const kd = key(true), ku = key(false)
  cv.addEventListener('keydown', kd)
  cv.addEventListener('keyup', ku)

  // ── sound: a soft "tõm", off by default ──
  let ac: AudioContext | null = null
  let soundOn = false
  ctx.onCleanup(() => void ac?.close())
  function plop() {
    if (!soundOn) return
    try {
      ac ??= new AudioContext()
      const o = ac.createOscillator(), gn = ac.createGain(), t = ac.currentTime
      o.frequency.setValueAtTime(420, t)
      o.frequency.exponentialRampToValueAtTime(140, t + 0.18)
      gn.gain.setValueAtTime(0.06, t)
      gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.3)
      o.connect(gn).connect(ac.destination)
      o.start(t)
      o.stop(t + 0.32)
    } catch {
      /* no audio: silent */
    }
  }
  function toggleSound() {
    soundOn = !soundOn
    sound.textContent = soundOn ? P.mute : P.sound
    sound.setAttribute('aria-pressed', String(soundOn))
  }

  // ── build ──
  function add(i: number) {
    on.add(i)
    chips[i].setAttribute('aria-pressed', 'true')
    ctx.chime('tap')
    said.replaceChildren(h('p', { class: 'p2-eyebrow' }, K.promptLabel), h('p', { class: 't36g-prompt' }, K.layers[i].prompt), ctx.fact(F(K.facts[0]), 'p', 't36g-fact'))
    loop.wake()
    if (on.size === K.layers.length && start.hidden) {
      start.hidden = false
      ctx.insight(F(K.insight), K.detail)
    }
  }

  // ── play ──
  function play() {
    mode = 'play'
    score = 0
    lives = 3
    left = 30
    spawn = 0
    paused = false
    shown = ''
    items.forEach((it) => (it.on = false))
    rings.forEach((it) => (it.on = false))
    koi.x = koi.tx = W / 2
    koi.y = koi.ty = H * 0.7
    root.classList.add('is-play')
    hud.hidden = false
    endBox.hidden = true
    cv.setAttribute('role', 'application')
    cv.setAttribute('aria-label', P.region)
    cv.tabIndex = 0
    cv.focus()
    pause.textContent = P.pause
    loop.start()
  }
  function togglePause() {
    if (mode !== 'play') return
    paused = !paused
    pause.textContent = paused ? P.resume : P.pause
    if (paused) loop.stop()
    else {
      loop.start()
      cv.focus()
    }
  }
  function end() {
    mode = 'end'
    loop.stop()
    endMsg.textContent = fill(P.end, { n: score })
    live.textContent = fill(P.endAria, { n: score })
    endBox.hidden = false
    again.focus()
    ctx.chime('ok')
  }
  function hudText() {
    const t = `${score}|${lives}|${Math.ceil(left)}`
    if (t === shown) return
    shown = t
    scoreEl.textContent = fill(P.score, { n: score })
    livesEl.textContent = fill(P.lives, { n: lives })
    timeEl.textContent = fill(P.time, { n: Math.ceil(left) })
  }

  function step(dt: number) {
    left -= dt
    const sp = 260 * dt
    if (keys.l) koi.tx -= sp
    if (keys.r) koi.tx += sp
    if (keys.u) koi.ty -= sp
    if (keys.d) koi.ty += sp
    koi.tx = Math.max(16, Math.min(W - 16, koi.tx))
    koi.ty = Math.max(16, Math.min(H - 16, koi.ty))
    const dx = koi.tx - koi.x, dy = koi.ty - koi.y
    const k = Math.min(1, dt * 5)
    koi.x += dx * k
    koi.y += dy * k
    if (dx * dx + dy * dy > 4) koi.a = Math.atan2(dy, dx)
    spawn -= dt
    if (spawn <= 0) {
      spawn = ctx.reduced ? 1.2 : Math.max(0.42, 0.95 - (30 - left) * 0.018)
      const it = items.find((x) => !x.on)
      if (it) {
        it.on = true
        it.x = 20 + r() * (W - 40)
        it.y = -12
        it.leaf = r() < 0.3
        it.v = ctx.reduced ? 38 : 70 + (30 - left) * 3.2
      }
    }
    for (const it of items) {
      if (!it.on) continue
      it.y += it.v * dt
      const ex = it.x - koi.x, ey = it.y - koi.y
      if (ex * ex + ey * ey < 26 * 26) {
        it.on = false
        if (it.leaf) lives--
        else {
          score++
          plop()
          const rg = calm ? null : rings.find((x) => !x.on)
          if (rg) Object.assign(rg, { on: true, x: it.x, y: it.y, t: 0 })
        }
      } else if (it.y > H + 14) it.on = false
    }
    for (const rg of rings) if (rg.on && (rg.t += dt) > 1) rg.on = false
    hudText()
    if (left <= 0 || lives <= 0) {
      left = Math.max(0, left)
      hudText()
      end()
    }
  }

  function frame(t: number, dt: number): boolean {
    const all = mode !== 'build'
    const has = (i: number) => all || on.has(i)
    if (mode === 'play' && !paused) step(dt)
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    // 0 water (else bare tracing paper)
    g.fillStyle = has(0) ? col.water : col.paper
    g.fillRect(0, 0, W, H)
    g.strokeStyle = col.moon
    g.lineWidth = 1.2
    if (has(0)) {
      g.globalAlpha = 0.22
      for (let i = 0; i < 7; i++) {
        const y = H * (0.12 + i * 0.13) + (calm ? 0 : Math.sin(t * 0.6 + i) * 3)
        g.beginPath()
        g.moveTo(W * 0.08 + (i % 3) * 30, y)
        g.quadraticCurveTo(W * 0.45, y - 5, W * 0.8 - (i % 2) * 40, y)
        g.stroke()
      }
      g.globalAlpha = 1
    } else {
      g.setLineDash([4, 5])
      g.strokeStyle = col.ink
      g.globalAlpha = 0.3
      g.strokeRect(10, 10, W - 20, H - 20)
      g.setLineDash([])
      g.globalAlpha = 1
    }
    // 3 falling moon shards and dry leaves
    if (has(3)) for (const it of items) if (it.on) {
      g.fillStyle = it.leaf ? col.leaf : col.moon
      g.beginPath()
      if (it.leaf) g.ellipse(it.x, it.y, 9, 4.5, 0.6, 0, TAU)
      else {
        g.moveTo(it.x - 7, it.y + 4)
        g.lineTo(it.x + 2, it.y - 8)
        g.lineTo(it.x + 8, it.y + 5)
      }
      g.fill()
    }
    // 6 rings and fireflies
    if (has(6) && !calm) {
      g.strokeStyle = col.moon
      for (const rg of rings) if (rg.on) {
        g.globalAlpha = 1 - rg.t
        g.beginPath()
        g.arc(rg.x, rg.y, 6 + rg.t * 30, 0, TAU)
        g.stroke()
      }
      g.fillStyle = col.fly
      for (const f of flies) {
        g.globalAlpha = 0.35 + 0.35 * Math.sin(t * 1.7 + f.p)
        g.beginPath()
        g.arc(W * f.x + Math.sin(t * 0.4 + f.p) * 12, H * f.y * 0.8 + Math.cos(t * 0.5 + f.p) * 8, 2.2, 0, TAU)
        g.fill()
      }
      g.globalAlpha = 1
    }
    // 1 the koi
    if (has(1)) {
      g.save()
      g.translate(koi.x, koi.y)
      g.rotate(koi.a)
      const sw = calm ? 0 : Math.sin(t * 6) * 0.25
      g.fillStyle = col.moon
      g.beginPath()
      g.ellipse(0, 0, 22, 9, 0, 0, TAU)
      g.fill()
      g.fillStyle = col.red
      g.beginPath()
      g.ellipse(4, -1, 9, 5, 0.2, 0, TAU)
      g.ellipse(-9, 2, 5, 4, 0, 0, TAU)
      g.fill()
      g.beginPath()
      g.moveTo(-19, 0)
      g.lineTo(-33, -9 + sw * 10)
      g.lineTo(-31, 9 + sw * 10)
      g.closePath()
      g.fill()
      g.restore()
    }
    // 2 control: where the finger leads
    if (has(2)) {
      g.strokeStyle = col.ink
      g.globalAlpha = 0.45
      g.beginPath()
      g.arc(mode === 'build' ? koi.x + 70 : koi.tx, mode === 'build' ? koi.y - 30 : koi.ty, 10, 0, TAU)
      g.stroke()
      g.globalAlpha = 1
    }
    // 4 score: an ensō in the corner (and the big one at the end)
    if (has(4)) {
      const big = mode === 'end'
      const cx = big ? W / 2 : W - 30, cy = big ? H / 2 : 30, rr = big ? Math.min(W, H) * 0.22 : 14
      g.strokeStyle = col.ink
      g.lineWidth = big ? 7 : 2.5
      g.lineCap = 'round'
      g.beginPath()
      g.arc(cx, cy, rr, -1.2, 4.6)
      g.stroke()
      if (big) {
        g.fillStyle = col.ink
        g.font = `600 ${Math.round(rr * 0.7)}px Georgia, serif`
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText(String(score), cx, cy)
      }
      g.lineWidth = 1.2
    }
    // 5 sound: two ripples of a speaker in the corner
    if (has(5) && mode === 'build') {
      g.strokeStyle = col.ink
      g.globalAlpha = 0.5
      for (let i = 1; i < 3; i++) {
        g.beginPath()
        g.arc(22, H - 22, i * 6, -0.8, 0.8)
        g.stroke()
      }
      g.globalAlpha = 1
    }
    return mode === 'play' && !paused
  }
}
