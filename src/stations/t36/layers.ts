import { fill, h, s } from '../../core/dom'
import { createLoop } from '../../core/loop'
import { cssVar, onPrefs } from '../../core/prefs'
import { blob, clamp, curve, onSize, rng, stroke, type Pt } from '../../ui/part2/ink'
import { water } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import { C } from './content'
import { cardButton, F, f1, gdefs, hangingLamp, ink, pebble, wood, woodG } from '../t34/night'
import { koi } from './koi'

const K = C.scenes.layers
const P = K.play
const TAU = Math.PI * 2
interface Item { on: boolean; x: number; y: number; v: number; leaf: boolean }
interface Ring { on: boolean; x: number; y: number; t: number }

const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 24) =>
  Array.from({ length: n + 1 }, (_, i) => { const t = a0 + ((a1 - a0) * i) / n; return [cx + Math.cos(t) * rx, cy + Math.sin(t) * ry] as Pt })

/**
 * The build view, painted (SVG, rebuilt per size): a drafting table under the lamp, a sheet of tracing paper with the
 * koi pond pre-sketched in pale ink, and one painted layer per prompt (`.t36g-L0…6`, shown as each is laid down).
 * `toSide` = where the layer tabs are (an ink arrow points there until the first layer is placed).
 */
function paintStage(svg: SVGSVGElement, w: number, hh: number, toSide: boolean) {
  const r = rng(366)
  const m = Math.min(w, hh)
  const sx = w * 0.07, sy = hh * 0.07, sw = w * 0.86, sh = hh * 0.86
  const cx = w / 2, cy = sy + sh * 0.56, rx = sw * 0.38, ry = sh * 0.3
  const pond = blob(cx, cy, rx, ry, 367, 0.07, 22)
  const n = Math.max(3, Math.round(hh / 90))
  const planks = Array.from({ length: n }, (_, i) => wood([-20, ((i + 0.5) * hh) / n], [w + 20, ((i + 0.5) * hh) / n + (r() - 0.5) * 3], hh / n - 3, 368 + i))
  // the pre-sketch: pond, koi, a moon shard, the ensō — thin pale lines on the tracing paper
  const kx = cx - rx * 0.12, ky = cy + ry * 0.12, kl = rx * 0.55
  const lw = 1.2 + m / 500
  const under =
    stroke(arc(cx, cy, rx, ry, 0.2, TAU + 0.1, 40), lw, 0.05, 0.05, 0.4) +
    stroke(arc(cx + 3, cy - 2, rx * 0.98, ry * 1.02, 3.6, 5.6, 16), lw * 0.7, 0.2, 0.2, 0.3) +
    stroke([[kx, ky], [kx + kl * 0.4, ky - kl * 0.12], [kx + kl * 0.8, ky - kl * 0.05]], lw, 0.1, 0.4, 0.3) +
    stroke([[kx, ky], [kx + kl * 0.4, ky + kl * 0.1], [kx + kl * 0.8, ky - kl * 0.03]], lw, 0.1, 0.4, 0.3) +
    stroke([[kx + kl * 0.8, ky - kl * 0.04], [kx + kl, ky - kl * 0.16]], lw, 0.1, 0.4, 0.3) + stroke([[kx + kl * 0.8, ky - kl * 0.04], [kx + kl, ky + kl * 0.08]], lw, 0.1, 0.4, 0.3) +
    stroke(arc(sx + sw * 0.86, sy + sh * 0.15, m * 0.06, m * 0.06, -1.3, 4.5), lw, 0.1, 0.4, 0.3) +
    stroke([[cx + rx * 0.3, cy - ry * 1.2], [cx + rx * 0.36, cy - ry * 1.32], [cx + rx * 0.4, cy - ry * 1.18]], lw, 0.1, 0.1, 0.3) +
    stroke([[cx - rx * 0.5, cy - ry * 0.85], [cx - rx * 0.45, cy - ry * 0.95], [cx - rx * 0.4, cy - ry * 0.84]], lw, 0.1, 0.1, 0.3)
  const shard = (x: number, y: number, k: number) => `M${f1(x)} ${f1(y)}Q${f1(x + 8 * k)} ${f1(y - 3 * k)} ${f1(x + 11 * k)} ${f1(y + 5 * k)}Q${f1(x + 5 * k)} ${f1(y + 1.5 * k)} ${f1(x)} ${f1(y)}Z`
  const u = m / 300
  let flies = '', glow: SVGElement[] = []
  for (let i = 0; i < 7; i++) {
    const fx = sx + sw * (0.15 + r() * 0.7), fy = sy + sh * (0.12 + r() * 0.45)
    flies += blob(fx, fy, 1.8 * u + 1, 1.8 * u + 1, 370 + i, 0.2, 6)
    glow.push(s('circle', { cx: f1(fx), cy: f1(fy), r: f1(9 * u + 4), fill: 'url(#p2-lamp)' }))
  }
  const tx = cx + rx * 0.42, ty = cy + ry * 0.22
  const arrow = toSide
    ? stroke(curve([sx + sw * 0.78, cy - ry * 0.1], [sx + sw * 0.93, cy - ry * 0.3], [w - 4, cy - ry * 0.2], 10), 3.2 * u + 1, 0.15, 0.1, 0.3) + stroke([[w - 16 * u - 6, cy - ry * 0.4], [w - 4, cy - ry * 0.2], [w - 18 * u - 6, cy - ry * 0.02]], 2.6 * u + 1, 0.2, 0.2, 0.3)
    : stroke(curve([cx + rx * 0.2, sy + sh * 0.9], [cx + rx * 0.05, hh - 10], [cx, hh - 2], 10), 3.2 * u + 1, 0.15, 0.1, 0.3) + stroke([[cx - 14 * u - 5, hh - 16 * u - 6], [cx, hh - 2], [cx + 14 * u + 5, hh - 16 * u - 6]], 2.6 * u + 1, 0.2, 0.2, 0.3)
  svg.setAttribute('viewBox', `0 0 ${f1(w)} ${f1(hh)}`)
  svg.replaceChildren(
    s('mask', { id: 't36g-fade', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: f1(w), height: f1(hh) },
      s('rect', { x: -w * 0.2, y: -hh * 0.2, width: f1(w * 1.4), height: f1(hh * 1.4), fill: 'url(#g12-feather)' })),
    s('clipPath', { id: 't36g-pond' }, s('path', { d: pond })),
    s('g', { mask: 'url(#t36g-fade)' }, woodG(planks, 't36g-planks')),
    s('ellipse', { class: 'g12-pool', cx: f1(w * 0.55), cy: f1(hh * 0.38), rx: f1(w * 0.62), ry: f1(hh * 0.52), fill: 'url(#g12-pool)' }),
    // the tracing paper, a breath askew, two pebbles holding it
    s('g', { transform: `rotate(-1.1 ${f1(cx)} ${f1(hh / 2)})` },
      s('rect', { class: 't36g-sheet', x: f1(sx), y: f1(sy), width: f1(sw), height: f1(sh) }),
      ink(stroke([[sx, sy], [sx + sw / 2, sy - 0.6], [sx + sw, sy]], 1.4, 0.05, 0.05, 0.5) + stroke([[sx + sw, sy], [sx + sw + 0.6, sy + sh / 2], [sx + sw, sy + sh]], 1.2, 0.05, 0.05, 0.5) + stroke([[sx + sw, sy + sh], [sx + sw / 2, sy + sh + 0.6], [sx, sy + sh]], 1.6, 0.05, 0.05, 0.5) + stroke([[sx, sy + sh], [sx - 0.5, sy + sh / 2], [sx, sy]], 1.2, 0.05, 0.05, 0.5), 't36g-sheet-edge', 'rough')),
    ink(under, 't36g-under', 'dry'),
    // 0 water: a wash in the pond's shape, ripples, a rim of ink
    s('g', { class: 't36g-L t36g-L0' },
      ink(pond, 't36g-water', 'wash'),
      s('g', { 'clip-path': 'url(#t36g-pond)' }, water(cx - rx, cy - ry, cx + rx, cy + ry, 369, cx + rx * 0.35, false)),
      ink(stroke(arc(cx, cy, rx * 1.01, ry * 1.03, 3.4, 6.1), 2.6 * u + 1, 0.15, 0.2, 0.2) + stroke(arc(cx, cy, rx * 1.02, ry * 1.04, 0.3, 2.9), 1.6 * u + 0.8, 0.2, 0.2, 0.2), 't36g-ink', 'rough')),
    // 1 the koi
    s('g', { class: 't36g-L t36g-L1' }, koi(kx, ky, kl, Math.PI + 0.12, 371)),
    // 2 control: a fingertip leads, a dotted wake shows where the koi will turn
    s('g', { class: 't36g-L t36g-L2' },
      ink(stroke(arc(tx, ty, 11 * u + 4, 8 * u + 3, 0, TAU, 20), 1.4, 0.1, 0.1, 0.4) + stroke(arc(tx, ty, 18 * u + 6, 13 * u + 5, 3.8, 5.9, 12), 1, 0.2, 0.2, 0.2), 't36g-ink', 'rough'),
      ink(stroke([[tx + rx * 0.3, ty + ry * 0.62], [tx + rx * 0.14, ty + ry * 0.3], [tx + 3, ty + 4]], 6 * u + 2.5, 0.04, 0.35, 0.45), 't36g-finger', 'wash'),
      ink(Array.from({ length: 6 }, (_, i) => { const p = curve([kx + kl * 0.1, ky - 6], [cx + rx * 0.1, cy - ry * 0.3], [tx - 8, ty - 4], 6)[i]; return blob(p[0], p[1], 1.4 * u + 0.6, 1.4 * u + 0.6, 380 + i, 0.2, 6) }).join(''), 't36g-ink')),
    // 3 falling moon shards and a dry leaf
    s('g', { class: 't36g-L t36g-L3' },
      ink(shard(cx + rx * 0.28, cy - ry * 1.28, u * 1.6) + shard(cx - rx * 0.5, cy - ry * 0.9, u * 1.2) + shard(cx + rx * 0.7, cy - ry * 0.6, u), 't36g-shard', 'rough'),
      ink(stroke([[cx + rx * 0.33, cy - ry * 1.65], [cx + rx * 0.33, cy - ry * 1.42]], 0.8, 0.3, 0.3, 0.1) + stroke([[cx - rx * 0.46, cy - ry * 1.2], [cx - rx * 0.46, cy - ry * 1.02]], 0.8, 0.3, 0.3, 0.1), 't36g-ink'),
      ink(stroke(curve([cx - rx * 0.05, cy - ry * 1.5], [cx + rx * 0.02, cy - ry * 1.62], [cx + rx * 0.1, cy - ry * 1.5], 6), 6 * u + 2, 0.3, 0.3, 0.2), 't36g-leaf', 'rough')),
    // 4 score: the ensō and a vermilion seal in the corner
    s('g', { class: 't36g-L t36g-L4' },
      ink(stroke(arc(sx + sw * 0.86, sy + sh * 0.15, m * 0.06, m * 0.06, -1.3, 4.5, 30), 4 * u + 1.5, 0.08, 0.6, 0.12), 't36g-ink', 'rough'),
      ink(`M${f1(sx + sw * 0.86 - m * 0.13)} ${f1(sy + sh * 0.1)}h${f1(m * 0.05)}v${f1(m * 0.06)}h${f1(-m * 0.05)}Z`, 't36g-seal', 'rough')),
    // 5 sound: a drop and the rings of its "tõm" spreading
    s('g', { class: 't36g-L t36g-L5' },
      ink(blob(sx + sw * 0.14, sy + sh * 0.8, 2.4 * u + 1, 3.4 * u + 1.2, 372, 0.1, 8) + [1, 2, 3].map((k) => stroke(arc(sx + sw * 0.14, sy + sh * 0.86, k * 10 * u + 4, k * 3.4 * u + 1.5, 0.4 * k, TAU - 0.5 + 0.4 * k, 24), 1.3 - k * 0.15, 0.1, 0.1, 0.2)).join(''), 't36g-ink', 'rough')),
    // 6 effects: fireflies and rings where shards met the water
    s('g', { class: 't36g-L t36g-L6' },
      ...glow,
      ink(flies, 't36g-fly'),
      ink([0.5, 1].map((k) => stroke(arc(cx + rx * 0.3, cy - ry * 0.35, rx * 0.12 * k, ry * 0.08 * k, 0, TAU, 20), 1, 0.1, 0.1, 0.4)).join(''), 't36g-ring')),
    s('g', { class: 't36g-cue' }, ink(arrow, 't36g-arrow', 'rough')),
    pebble(sx + 6, sy + 8, 9 * u + 4, 373),
    pebble(sx + sw - 8, sy + sh - 4, 10 * u + 4, 374),
    hangingLamp(w * 0.84, -40, 40, 10 * u + 4, 375))
}

/**
 * Scene 4 — the koi pond is laid down like sheets of tracing paper, one prompt per layer (water → koi → control →
 * falling moon → score → sound → effects); with all seven in place it becomes the real 30-second game (Canvas 2D).
 */
export function layersScene(ctx: SceneCtx) {
  gdefs()
  const on = new Set<number>()
  const calm = ctx.reduced || ctx.quality === 'low'
  const r = rng(36)
  const paint = s('svg', { class: 't36g-paint', 'aria-hidden': 'true' })
  const cv = h('canvas', { class: 't36g-cv', 'aria-hidden': 'true' })
  const g = cv.getContext('2d')!
  const chips = K.layers.map((l, i) => h('button', { class: 't36g-chip g12-paper', type: 'button', 'aria-pressed': 'false', 'aria-label': fill(K.layerAria, { n: i + 1, name: l.name }), onClick: () => add(i) },
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
  const stage = h('div', { class: 't36g-stage' }, paint, cv, hud, endBox, live)
  const side = h('div', { class: 't36g-side' }, h('div', { class: 't36g-chips' }, ...chips), said, start, ctx.reduced ? h('p', { class: 't36g-still' }, P.still) : null)
  const root = h('div', { class: 't36 t36g' },
    h('p', { class: 'visually-hidden' }, K.art),
    stage,
    side)
  ctx.art.append(root)
  ctx.prompt(K.prompt)
  const pill = cardButton(ctx, root, K.takeaway)
  if (pill) endBox.append(pill)

  // ── game state (pre-allocated: nothing is created per frame) ──
  let W = 300, H = 300, dpr = 1
  let mode: 'build' | 'play' | 'end' = 'build'
  let score = 0, lives = 3, left = 30, spawn = 0, paused = false, shown = ''
  const koiP = { x: 150, y: 170, tx: 150, ty: 170, a: 0 }
  const keys = { l: false, r: false, u: false, d: false }
  const items: Item[] = Array.from({ length: 12 }, () => ({ on: false, x: 0, y: 0, v: 0, leaf: false }))
  const rings: Ring[] = Array.from({ length: 6 }, () => ({ on: false, x: 0, y: 0, t: 0 }))
  const flies = Array.from({ length: 7 }, () => ({ x: r(), y: r(), p: r() * TAU }))
  let col = { ink: '', moon: '', red: '', leaf: '', fly: '' }
  const readCol = () => {
    col = { ink: cssVar('--ink'), moon: cssVar('--moon'), red: cssVar('--vermilion'), leaf: cssVar('--lantern'), fly: cssVar('--firefly') }
    loop.wake()
  }
  const loop = createLoop(cv, frame, { essential: true })
  ctx.onCleanup(() => loop.dispose())
  ctx.onCleanup(onPrefs(readCol))
  ctx.onCleanup(onSize(stage, () => {
    const w = stage.clientWidth, hh = stage.clientHeight
    if (!w || !hh) return
    const toSide = side.getBoundingClientRect().left >= stage.getBoundingClientRect().right - 4
    dpr = Math.min(2, devicePixelRatio || 1)
    W = w
    H = hh
    cv.width = Math.round(W * dpr)
    cv.height = Math.round(H * dpr)
    paintStage(paint, w, hh, toSide)
    loop.wake()
  }))
  readCol()

  // ── input ──
  const aim = (e: PointerEvent) => {
    if (mode !== 'play') return
    koiP.tx = e.offsetX
    koiP.ty = e.offsetY
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

  // ── build: each tab lays its painted layer on the tracing paper ──
  function add(i: number) {
    on.add(i)
    chips[i].setAttribute('aria-pressed', 'true')
    root.classList.add('has-layer', `on-${i}`)
    ctx.chime('tap')
    said.replaceChildren(h('p', { class: 'p2-eyebrow' }, K.promptLabel), h('p', { class: 't36g-prompt' }, K.layers[i].prompt), ctx.fact(F(K.facts[0]), 'p', 't36g-fact'))
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
    koiP.x = koiP.tx = W / 2
    koiP.y = koiP.ty = H * 0.7
    root.classList.add('is-play')
    hud.hidden = false
    endBox.hidden = true
    cv.removeAttribute('aria-hidden')
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
    if (keys.l) koiP.tx -= sp
    if (keys.r) koiP.tx += sp
    if (keys.u) koiP.ty -= sp
    if (keys.d) koiP.ty += sp
    koiP.tx = clamp(koiP.tx, 16, W - 16)
    koiP.ty = clamp(koiP.ty, 16, H - 16)
    const dx = koiP.tx - koiP.x, dy = koiP.ty - koiP.y
    const k = Math.min(1, dt * 5)
    koiP.x += dx * k
    koiP.y += dy * k
    if (dx * dx + dy * dy > 4) koiP.a = Math.atan2(dy, dx)
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
      const ex = it.x - koiP.x, ey = it.y - koiP.y
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

  /** The game on its canvas, over the painted water (the build view is all SVG: nothing to draw then). */
  function frame(t: number, dt: number): boolean {
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, W, H)
    if (mode === 'build') return false
    if (mode === 'play' && !paused) step(dt)
    // falling moon shards and dry leaves
    for (const it of items) if (it.on) {
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
    // rings and fireflies
    if (!calm) {
      g.strokeStyle = col.moon
      g.lineWidth = 1.2
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
    // the koi
    g.save()
    g.translate(koiP.x, koiP.y)
    g.rotate(koiP.a)
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
    // where the finger leads
    g.strokeStyle = col.ink
    g.globalAlpha = 0.45
    g.lineWidth = 1.2
    g.beginPath()
    g.arc(koiP.tx, koiP.ty, 10, 0, TAU)
    g.stroke()
    g.globalAlpha = 1
    // the score: an ensō in the corner, the big one at the end
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
    return mode === 'play' && !paused
  }
}
