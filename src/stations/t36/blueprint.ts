import './blueprint.css'
import { fill, h, s } from '../../core/dom'
import { createLoop } from '../../core/loop'
import { blob, clamp, curve, onDigit, onSize, rng, stableHeight, stroke, type Pt } from '../../ui/part2/ink'
import type { SceneCtx } from '../types'
import { C } from './content'
import { cardButton, F, f1, gdefs, ink } from './kit'
import { koi } from './koi'

const K = C.scenes.blueprint
const N = 6
const STEP = 360 / N

function bpDefs() {
  gdefs()
  if (document.getElementById('t36b-defs')) return
  const st = (o: number, c: string, a = 1) => s('stop', { offset: o, style: `stop-color:var(${c});stop-opacity:${a}` })
  document.getElementById('p2-defs')!.append(s('defs', { id: 't36b-defs' },
    s('radialGradient', { id: 't36b-throw' }, st(0, '--lantern', 0.5), st(0.35, '--lantern', 0.22), st(0.7, '--lantern', 0.06), st(1, '--lantern', 0)),
    s('radialGradient', { id: 't36b-pool' }, st(0, '--lantern', 0.55), st(0.5, '--lantern', 0.16), st(1, '--lantern', 0)),
    s('radialGradient', { id: 't36b-cool' }, st(0, '--moon', 0.22), st(1, '--moon', 0)),
    s('filter', { id: 't36b-soft', x: '-30%', y: '-30%', width: '160%', height: '160%' }, s('feGaussianBlur', { stdDeviation: 7 })),
    s('filter', { id: 't36b-far', x: '-30%', y: '-30%', width: '160%', height: '160%' }, s('feGaussianBlur', { stdDeviation: 5 })),
    s('filter', { id: 't36b-mist', x: '-10%', y: '-10%', width: '120%', height: '120%' }, s('feGaussianBlur', { stdDeviation: 2.5 }))))
}

/**
 * What the lamp throws on the wall: one picture of the game in six parts (each with its two versions, option 0 / 1),
 * composed above the lamp — sky and moon (style), the pond and its koi (idea), what falls (rules), the hand that leads
 * (controls), the ensō that keeps the score (end), the screen round it all (device). w × hh = the wall.
 */
function shadows(w: number, hh: number, seed: number): [SVGElement, SVGElement][] {
  const r = rng(seed)
  // sizes in u; the picture spreads wider than tall. Its lower part (the pond's near bank, the screen's foot) runs on past
  // the wall's foot and lands on the table, so the composition sits low: the wall's foot is at 0.77 hh.
  const cx = w / 2, cy = hh * 0.6, u = hh / 84
  const X = (v: number) => cx + v * u * 1.5, Y = (v: number) => cy + v * u
  const shard = (x: number, y: number, k: number) => `M${f1(X(x))} ${f1(Y(y))}q${f1(3.5 * k * u)} ${f1(-1.2 * k * u)} ${f1(4.5 * k * u)} ${f1(2 * k * u)}q${f1(-2.5 * k * u)} ${f1(-1.4 * k * u)} ${f1(-4.5 * k * u)} ${f1(-2 * k * u)}Z`
  const arc = (x: number, y: number, rr: number, a0: number, a1: number, n = 30): Pt[] => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [X(x) + Math.cos(a) * rr * u, Y(y) + Math.sin(a) * rr * u] })
  const g = (...kids: (SVGElement | string)[]) => s('g', null, ...kids)
  const heart = (x: number, y: number, k: number) => `M${f1(X(x))} ${f1(Y(y + k * 0.9))}c${f1(-k * 1.6 * u)} ${f1(-k * 1.1 * u)} ${f1(-k * 1.1 * u)} ${f1(-k * 2.3 * u)} 0 ${f1(-k * 1.5 * u)}c${f1(k * 1.1 * u)} ${f1(-k * 0.8 * u)} ${f1(k * 1.6 * u)} ${f1(k * 0.4 * u)} 0 ${f1(k * 1.5 * u)}Z`
  const pond = ink(blob(X(0), Y(8), 62 * u, 13 * u, seed + 1, 0.06), 't36b-sh', 'wash')
  let flies = ''
  for (let i = 0; i < 16; i++) flies += blob(X((r() - 0.5) * 80), Y(-4 - r() * 30), 0.7 * u + r() * 0.6 * u, 0.7 * u + r() * 0.6 * u, seed + 40 + i, 0.2, 7)
  // a hand coming in from the right, its finger on the water
  const hand = blob(X(46), Y(-4), 6.5 * u, 4.2 * u, seed + 5, 0.12, 12) + stroke([[X(41), Y(-2)], [X(34), Y(3)], [X(29), Y(6)]], 2.6 * u, 0.02, 0.5, 0.45) + stroke([[X(42), Y(-6)], [X(37), Y(-5.5)]], 2 * u, 0.05, 0.5, 0.4)
  return [
    // 0 idea: the pond and its koi crossing it — or two koi round a rock
    [g(pond, koi(X(10), Y(5), 30 * u, 0.05, seed + 2, 0.22)),
      g(pond, koi(X(-14), Y(7), 22 * u, Math.PI + 0.25, seed + 3, 0.3), koi(X(18), Y(4), 18 * u, -0.15, seed + 6, 0.25), ink(blob(X(2), Y(5), 6 * u, 3.6 * u, seed + 4, 0.15), 't36b-sh', 'rough'))],
    // 1 rules: shards of moon falling to the water, a dry leaf — or a swarm of fireflies
    [g(ink(shard(26, -27, 1.4) + shard(20, -18, 1.1) + shard(13, -10, 0.9) + shard(31, -14, 0.8), 't36b-sh', 'rough'),
      ink(stroke([[X(27), Y(-33)], [X(27.5), Y(-29)]], 0.4 * u, 0.3, 0.3, 0.1) + stroke([[X(21), Y(-23)], [X(21.3), Y(-20)]], 0.4 * u, 0.3, 0.3, 0.1), 't36b-sh'),
      ink(stroke([[X(-24), Y(-16)], [X(-20), Y(-19)], [X(-16), Y(-16)]], 2.4 * u, 0.3, 0.3, 0.2), 't36b-sh', 'rough')),
      g(ink(flies, 't36b-lit'))],
    // 2 controls: a hand leads, rings spread from its fingertip — or the two halves of a screen to tap
    [g(ink(hand, 't36b-sh', 'wash'), ink(stroke(arc(28, 6.5, 3, 0, 6.3), 0.5 * u, 0.1, 0.1, 0.4) + stroke(arc(28, 6.5, 6, 3.3, 6), 0.4 * u, 0.2, 0.2, 0.2), 't36b-sh', 'rough')),
      g(ink(stroke([[X(-30), Y(20)], [X(-36), Y(23)], [X(-30), Y(26)]], 1.2 * u, 0.1, 0.1, 0.4) + stroke([[X(30), Y(20)], [X(36), Y(23)], [X(30), Y(26)]], 1.2 * u, 0.1, 0.1, 0.4) + stroke([[X(0), Y(16)], [X(0), Y(30)]], 0.4 * u, 0.1, 0.1, 0.4), 't36b-sh', 'rough'))],
    // 3 end: an ensō keeps the score, three hearts beside it — or an ensō and a loop to play again
    [g(ink(stroke(arc(-34, -22, 8, -1.4, 4.5), 1.8 * u, 0.1, 0.55, 0.15), 't36b-sh', 'rough'), ink(heart(-22, -27, 1) + heart(-18.5, -27, 1) + heart(-15, -27, 1), 't36b-sh')),
      g(ink(stroke(arc(-34, -22, 8, -1.4, 4.5), 1.8 * u, 0.1, 0.55, 0.15) + stroke(arc(-34, -22, 11.5, -2.6, 1.2, 20), 0.6 * u, 0.2, 0.2, 0.2) + stroke([[X(-30), Y(-11.4)], [X(-27.6), Y(-11)], [X(-28.4), Y(-13.6)]], 0.6 * u, 0.1, 0.1, 0.3), 't36b-sh', 'rough'))],
    // 4 style: a night of ink with the moon cut out of it — or soft washes of colour on dó paper
    [g(ink(stroke([[X(-48), Y(-36)], [X(0), Y(-40)], [X(48), Y(-35)]], 12 * u, 0.25, 0.4, 0.2), 't36b-sh', 'wash'), s('circle', { class: 't36b-hole', cx: f1(X(30)), cy: f1(Y(-36)), r: f1(5 * u) })),
      g(...[['--water', -28, -34, 15], ['--moss', 0, -38, 12], ['--vermilion', 24, -33, 8], ['--lantern', 36, -40, 8]].map(([c, x, y, k], i) => s('path', { class: 't36b-tint', d: blob(X(x as number), Y(y as number), (k as number) * u, (k as number) * u * 0.5, seed + 30 + i, 0.25), style: `fill:var(${c})`, filter: 'url(#ink-wash)' })))],
    // 5 device: a phone held upright round the game — or a wide screen and its keyboard
    [g(ink(stroke([[X(-24), Y(-46)], [X(24), Y(-46)], [X(25), Y(34)], [X(-25), Y(34)], [X(-24), Y(-46)]], 1.3 * u, 0.02, 0.02, 0.6), 't36b-sh', 'rough')),
      g(ink(stroke([[X(-50), Y(-46)], [X(50), Y(-46)], [X(50), Y(26)], [X(-50), Y(26)], [X(-50), Y(-46)]], 1.2 * u, 0.02, 0.02, 0.6) + stroke([[X(-32), Y(33)], [X(32), Y(33)]], 2.6 * u, 0.1, 0.1, 0.5), 't36b-sh', 'rough'))],
  ]
}

/** a small ink motif on a lamp face once its piece is chosen (viewBox 0 0 100 60) */
function faceMotif(i: number, k: number): SVGSVGElement {
  const g = s('svg', { class: 't36b-motif', viewBox: '0 0 100 60', 'aria-hidden': 'true' })
  const arc = (x: number, y: number, rr: number, a0: number, a1: number): Pt[] => Array.from({ length: 21 }, (_, j) => { const a = a0 + ((a1 - a0) * j) / 20; return [x + Math.cos(a) * rr, y + Math.sin(a) * rr] })
  const m: string[][] = [
    [stroke(curve([20, 34], [50, 18], [80, 32], 10), 7, 0.2, 0.7, 0.2), stroke(curve([22, 36], [50, 26], [78, 36], 10), 6, 0.2, 0.7, 0.2)],
    [stroke([[30, 14], [36, 22]], 3, 0.2, 0.2, 0.3) + stroke([[56, 10], [60, 20]], 3, 0.2, 0.2, 0.3) + stroke([[70, 26], [76, 34]], 3, 0.2, 0.2, 0.3), blob(30, 20, 2.4, 2.4, 1) + blob(56, 14, 2, 2, 2) + blob(72, 30, 2.6, 2.6, 3) + blob(44, 36, 1.8, 1.8, 4)],
    [stroke([[60, 50], [52, 34], [48, 26]], 6, 0.05, 0.4, 0.4) + stroke(arc(46, 24, 6, 0, 6.3), 1.2, 0.1, 0.1, 0.3), stroke([[20, 30], [42, 30]], 2, 0.1, 0.4, 0.4) + stroke([[58, 30], [80, 30]], 2, 0.1, 0.4, 0.4)],
    [stroke(arc(50, 30, 16, -1.4, 4.5), 3.4, 0.1, 0.55, 0.15), stroke(arc(50, 30, 16, -1.4, 4.5), 3.4, 0.1, 0.55, 0.15) + stroke(arc(50, 30, 22, -2.6, 1.2), 1.2, 0.2, 0.2, 0.2)],
    [stroke([[14, 18], [50, 15], [86, 19]], 12, 0.25, 0.4, 0.2), blob(36, 30, 14, 8, 5, 0.25) + blob(62, 26, 12, 7, 6, 0.25)],
    [stroke([[38, 8], [62, 8], [62, 52], [38, 52], [38, 8]], 2, 0.02, 0.02, 0.6), stroke([[22, 10], [78, 10], [78, 44], [22, 44], [22, 10]], 2, 0.02, 0.02, 0.6) + stroke([[30, 52], [70, 52]], 3, 0.1, 0.1, 0.5)],
  ]
  g.append(ink(m[i][k], 't36b-mink', 'rough'))
  return g
}

/** where things are in the room (px of the art box), from its size */
interface Room { W: number; H: number; A: number; wide: boolean; back: number; near: number; edge: number; corner: number; lx: number; baseY: number; FW: number; tw: number }
function room(W: number, H: number, A: number): Room {
  const wide = W / H > 1.1
  if (wide) {
    const back = H * 0.5, FW = clamp(H * 0.15, 76, 120)
    return { W, H, A, wide, back, near: H * 0.92, edge: Math.min(A, H * 0.975), corner: W * 0.1, lx: W * 0.42, baseY: H * 0.76, FW, tw: Math.min(W * 0.7, back * 2.7) }
  }
  const FW = clamp(W * 0.17, 52, 70)
  const back = H * 0.35
  return { W, H, A, wide, back, near: H * 0.88, edge: Math.min(A, H * 0.92), corner: W * 0.08, lx: W * 0.5, baseY: back + FW * 2.2, FW, tw: W * 1.08 }
}

/**
 * Scene 1 — the drawing room at night (art direction §4 t36 `blueprint`), seen from a little above the table: a six-sided
 * paper andon stands on the table, lit from inside. Each face is one piece of the spec; two paper strips hang under the
 * front face, the two ways that piece could go. Choose one: it sticks to the face, the face takes its ink motif, and the
 * lamp throws that part of the game sharp — big, keystoned, fading round the lamp's axis — onto the wall behind and down
 * onto the table, the thin shadows of the lamp's kumiko across it. A line is written into spec.md, a sheet lying on the
 * table. Moonlight comes in cold through the shoji on the side wall. Six faces: the whole game stands on the wall before a
 * line of code, and the take-away is a folded card on the table. Drag (or ← →) turns the lamp; it settles on a face.
 * Low: no free turn; six small wooden tags at the lamp's foot turn it.
 */
export function blueprintScene(ctx: SceneCtx) {
  bpDefs()
  const stableH = stableHeight(ctx, [F(K.insight)])
  const low = ctx.quality === 'low'
  const chosen: number[] = K.pieces.map(() => -1)
  let front = 0

  // ── the lamp: six faces in CSS 3D round a hidden axis, a glowing lid, a dark base
  const faces = K.pieces.map((p, i) => h('div', { class: 't36b-face', style: `--a:${i * STEP}deg` },
    h('div', { class: 't36b-paper' }), h('p', { class: 't36b-flabel' }, h('span', { class: 't36b-fnum' }, String(i + 1)), p.label), h('div', { class: 't36b-fmotif' }), h('i', { class: 't36b-fshade' })))
  const rig = h('div', { class: 't36b-rig', 'aria-hidden': 'true' }, ...faces, h('div', { class: 't36b-lid' }, h('i')), h('div', { class: 't36b-base' }))
  const lamp = h('div', { class: 't36b-andon', tabindex: '0', role: 'group', 'aria-roledescription': K.lampRole, 'aria-label': K.lampAria }, h('div', { class: 't36b-halo', 'aria-hidden': 'true' }), rig)
  // the strips under the front face: two buttons of paper
  const strips = [0, 1].map((k) => h('button', { class: `t36b-strip t36b-s${k}`, type: 'button', 'aria-pressed': 'false', onClick: () => choose(front, k) }, h('span', { class: 't36b-stext' })))
  const stripBox = h('div', { class: 't36b-strips', role: 'group', 'aria-label': K.group }, ...strips)
  // (low) six wooden tags hung at the lamp's foot: each turns the lamp to its face
  const feet = low ? h('div', { class: 't36b-feet', role: 'group', 'aria-label': K.group }, ...K.pieces.map((p, i) => h('button', { class: 't36b-foot', type: 'button', 'aria-label': p.label, onClick: () => turnTo(i) }, h('span', null, String(i + 1))))) : null
  // spec.md: a sheet on the table, its lines written in by hand; on tall screens a slip that opens when touched
  const lines = K.pieces.map((p) => h('li', null, h('span', { class: 't36b-key' }, p.label), h('span', { class: 't36b-val' })))
  const tail = h('div', { class: 't36b-tail' })
  const count = h('span', { class: 't36b-count' })
  const slip = h('button', { class: 't36b-slip', type: 'button', 'aria-expanded': 'false' }, h('span', { class: 't36b-sliptitle' }, K.specTitle), count)
  const sheet = h('div', { class: 't36b-sheet' }, h('p', { class: 't36b-title' }, K.specTitle), h('ol', { class: 't36b-lines', 'aria-live': 'off' }, ...lines), tail)
  const spec = h('div', { class: 't36b-spec' }, slip, sheet)
  const tent = h('div', { class: 't36b-tent', hidden: true })
  // the room behind it all; the lamp's throw on the wall and its spill onto the table (two views of one picture)
  const back = s('svg', { class: 't36b-back', 'aria-hidden': 'true' })
  const wallPic = s('svg', { class: 't36b-pic', 'aria-hidden': 'true' })
  const spillPic = s('svg', { class: 't36b-pic', 'aria-hidden': 'true' })
  const throwBox = h('div', { class: 't36b-throwbox', 'aria-hidden': 'true' }, wallPic)
  const spillBox = h('div', { class: 't36b-spillbox', 'aria-hidden': 'true' }, spillPic)
  const near = s('svg', { class: 't36b-nearsvg', 'aria-hidden': 'true' })
  const root = h('div', { class: 't36 t36b' }, back, throwBox, spillBox, h('p', { class: 'visually-hidden' }, K.art), lamp, near, stripBox, feet, spec, tent)
  ctx.art.append(root)
  ctx.prompt(K.prompt)
  const pill = cardButton(ctx, root, K.takeaway)
  if (pill) tent.append(pill)
  const setCount = () => {
    const n = chosen.filter((c) => c >= 0).length
    count.textContent = fill(K.specCount, { n, total: N })
    slip.setAttribute('aria-label', fill(K.specSlipAria, { n, total: N }))
  }
  setCount()
  slip.addEventListener('click', () => {
    const open = !spec.classList.contains('open')
    spec.classList.toggle('open', open)
    slip.setAttribute('aria-expanded', String(open))
  })

  // ── turning: a drag (or arrows) spins the lamp with weight; it settles on the nearest face
  let rot = 0, vel = 0, target: number | null = 0
  const write = () => {
    rig.style.transform = `rotateX(-13deg) rotateY(${f1(rot)}deg)`
    for (let i = 0; i < N; i++) {
      // how far each face is turned from us: the far ones darken, the side ones catch less light
      const a = (((i * STEP + rot) % 360) + 540) % 360 - 180
      faces[i].style.setProperty('--d', (Math.abs(a) / 180).toFixed(3))
    }
  }
  const frontOf = (deg: number) => ((Math.round(-deg / STEP) % N) + N) % N
  const loop = createLoop(lamp, (_t, dt) => {
    if (dt <= 0) return write(), drag != null || target == null || rot !== target
    if (drag) return write(), true
    if (target == null) {
      rot += vel * dt
      vel *= Math.exp(-dt * 3.2)
      if (Math.abs(vel) < 40) target = Math.round(rot / STEP) * STEP
    } else {
      // a damped spring onto the face
      const f = 1 - Math.exp(-dt * 9)
      rot += (target - rot) * f
      if (Math.abs(target - rot) < 0.05) rot = target
    }
    write()
    const settled = target != null && rot === target
    if (settled) face(frontOf(rot))
    return !settled
  }, { essential: true })
  ctx.onCleanup(() => loop.dispose())
  function turnTo(i: number) {
    // the shortest way round to face i
    const want = -i * STEP
    const k = Math.round((rot - want) / 360)
    target = want + k * 360
    vel = 0
    if (ctx.reduced) {
      rot = target
      write()
      face(i)
    } else loop.start()
  }
  let drag: { id: number; x: number; t: number } | null = null
  if (!low) {
    lamp.addEventListener('pointerdown', (e) => {
      if (e.button) return
      drag = { id: e.pointerId, x: e.clientX, t: performance.now() }
      vel = 0
      lamp.setPointerCapture(e.pointerId)
      lamp.classList.add('grab')
      loop.start()
    })
    lamp.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return
      const now = performance.now(), dx = e.clientX - drag.x
      rot += dx * 0.42
      vel = vel * 0.5 + ((dx * 0.42) / Math.max(0.008, (now - drag.t) / 1000)) * 0.5
      drag.x = e.clientX
      drag.t = now
      target = null
    })
    const up = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return
      if (performance.now() - drag.t > 90) vel = 0
      drag = null
      lamp.classList.remove('grab')
      if (ctx.reduced) turnTo(frontOf(rot))
      else if (target == null && Math.abs(vel) < 40) target = Math.round(rot / STEP) * STEP
      loop.start()
    }
    lamp.addEventListener('pointerup', up)
    lamp.addEventListener('pointercancel', up)
  }
  lamp.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    turnTo((front + (e.key === 'ArrowLeft' ? N - 1 : 1)) % N)
  })
  ctx.onCleanup(onDigit((d) => d <= N && turnTo(d - 1)))

  /** the front face is now i: its strips hang down */
  function face(i: number) {
    if (i === front && stripBox.dataset.f === String(i)) return
    front = i
    stripBox.dataset.f = String(i)
    lamp.setAttribute('aria-label', fill(K.lampAria, { n: i + 1, piece: K.pieces[i].label }))
    const p = K.pieces[i]
    strips.forEach((b, k) => {
      b.querySelector('.t36b-stext')!.textContent = p.options[k]
      b.setAttribute('aria-pressed', String(chosen[i] === k))
      b.setAttribute('aria-label', fill(K.pieceAria, { piece: p.label, option: p.options[k] }))
    })
    feet?.querySelectorAll('button').forEach((b, k) => b.classList.toggle('front', k === i))
    stripBox.classList.remove('in')
    void stripBox.offsetWidth
    stripBox.classList.add('in')
    faces.forEach((f, k) => f.classList.toggle('front', k === i))
  }

  let advance = 0
  ctx.onCleanup(() => clearTimeout(advance))
  function choose(i: number, k: number) {
    const first = chosen[i] < 0
    chosen[i] = k
    const p = K.pieces[i]
    strips.forEach((b, j) => b.setAttribute('aria-pressed', String(j === k)))
    strips[k].classList.remove('stick')
    void strips[k].offsetWidth
    strips[k].classList.add('stick')
    faces[i].classList.add('on')
    faces[i].querySelector('.t36b-fmotif')!.replaceChildren(faceMotif(i, k))
    lines[i].lastElementChild!.textContent = p.options[k]
    lines[i].classList.remove('on')
    void lines[i].offsetWidth
    lines[i].classList.add('on')
    feet?.querySelectorAll('button')[i]?.classList.add('done')
    paintShadow(i)
    setCount()
    if (lines[0].parentElement!.getAttribute('aria-live') === 'off') lines[0].parentElement!.setAttribute('aria-live', 'polite')
    ctx.chime('tap')
    root.classList.toggle('all', chosen.every((c) => c >= 0))
    const next = chosen.findIndex((c) => c < 0)
    if (next >= 0) {
      // the lamp turns on to the next empty face by itself
      if (first) advance = window.setTimeout(() => turnTo(next), ctx.reduced ? 0 : 480)
      return
    }
    if (!tail.childElementCount) {
      tail.append(ctx.fact(F(K.facts[0]), 'p', 't36b-fact'))
      tent.hidden = false
      ctx.insight(F(K.insight), K.detail)
      ctx.chime('ok')
    }
  }
  function paintShadow(i: number) {
    for (const pic of [wallPic, spillPic]) {
      const g = pic.querySelector(`.t36b-t${i}`)
      g?.classList.toggle('on', chosen[i] >= 0)
      g?.setAttribute('data-k', String(chosen[i]))
    }
  }

  // ── layout: the room, the lamp on the table, its throw, spec.md lying in front
  ctx.onCleanup(onSize(ctx.art, () => {
    const W = ctx.art.clientWidth, A = ctx.art.clientHeight
    const H = stableH(A)
    if (W < 60 || H < 60) return
    root.style.height = `${f1(A)}px`
    const o = room(W, H, A)
    root.classList.toggle('wide', o.wide)
    const { FW, lx, baseY } = o
    const FH = FW * 1.55
    const ly = baseY - FH / 2 - FW * 0.25
    Object.assign(lamp.style, { left: `${f1(lx)}px`, top: `${f1(ly)}px` })
    root.style.setProperty('--fw', `${f1(FW)}px`)
    root.style.setProperty('--fh', `${f1(FH)}px`)
    root.style.setProperty('--ap', `${f1(FW * 0.866 - 0.5)}px`)
    // (low) the tags at the foot; the strips hang below
    const feetH = feet ? (o.wide ? 46 : 38) : 0
    if (feet) Object.assign(feet.style, { left: `${f1(lx)}px`, top: `${f1(baseY + FW * 0.12)}px` })
    const sw = o.wide ? clamp(W * 0.12, 130, 176) : clamp(W * 0.42, 128, 160)
    const stripY = baseY + FW * 0.3 + feetH
    Object.assign(stripBox.style, { left: `${f1(lx)}px`, top: `${f1(stripY)}px`, width: `${f1(sw * 2 + 14)}px` })
    root.style.setProperty('--sth', `${f1(Math.max(40, (o.wide ? o.edge : o.H - 44) - stripY - 26))}px`)
    // spec.md on the table at the front right (wide), a slip on the strip under the table (tall); the folded card
    if (o.wide) {
      Object.assign(spec.style, { left: `${f1(Math.max(lx + sw + 50, W * 0.6))}px`, bottom: `${f1(A - o.near - H * 0.02)}px`, width: `${f1(Math.min(W * 0.35, 450))}px`, top: '' })
      Object.assign(tent.style, { left: `${f1(Math.max(lx + FW * 1.5, W * 0.6 - 64))}px`, top: `${f1(H * 0.57)}px` })
    } else {
      Object.assign(spec.style, { left: `${f1(W * 0.03)}px`, bottom: `${f1(A - H + 2)}px`, width: `${f1(W * 0.58)}px`, top: '' })
      Object.assign(tent.style, { left: `${f1(W * 0.66)}px`, top: `${f1(H - 50)}px` })
    }
    paintRoom(o)
  }))
  write()
  face(0)

  function paintRoom(o: Room) {
    const { W, A, back: bk, near: nr, edge, corner: cx0, lx, baseY, FW, wide } = o
    back.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(A)}`)
    near.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(A)}`)
    const r = rng(3650)
    // ── the throw: one picture, its top part on the wall (keystoned, fading round the lamp's axis), its foot on the table
    const tw = o.tw, wallH = bk, hh = wallH * 1.3
    const sets = shadows(tw, hh, 3651)
    const slatG = () => {
      // the kumiko's thin shadows: the lamp's posts thrown up the wall, its rails as low bars
      let d = ''
      for (const k of [-3, -2, -1, 1, 2, 3]) d += stroke([[tw / 2 + k * tw * 0.11, hh * 0.99], [tw / 2 + k * tw * 0.14, 0]], Math.max(1, tw * 0.0025), 0.1, 0.4, 0.3)
      for (const y of [0.3, 0.56]) d += stroke([[tw * 0.18, hh * y], [tw * 0.82, hh * (y + 0.01)]], Math.max(1, tw * 0.002), 0.2, 0.2, 0.3)
      return ink(d, 't36b-slat')
    }
    for (const [pic, which] of [[wallPic, 0], [spillPic, 1]] as const) {
      pic.setAttribute('viewBox', `0 0 ${f1(tw)} ${f1(hh)}`)
      Object.assign(pic.style, { width: `${f1(tw)}px`, height: `${f1(hh)}px` })
      pic.replaceChildren(slatG(), ...sets.map(([a, b], i) => s('g', { class: `t36b-throw t36b-t${i}${chosen[i] >= 0 ? ' on' : ''}`, 'data-k': String(chosen[i]) },
        // blurred first (the faint, unfocused throw), sharp once chosen; option 0 / 1 versions
        s('g', { class: 't36b-blur' }, s('g', { filter: low ? null : 'url(#t36b-soft)' }, (which ? a.cloneNode(true) : a).cloneNode(true))),
        s('g', { class: 't36b-v0' }, which ? a.cloneNode(true) : a), s('g', { class: 't36b-v1' }, which ? b.cloneNode(true) : b))))
    }
    Object.assign(throwBox.style, { left: `${f1(lx - tw / 2)}px`, top: '0px', width: `${f1(tw)}px`, height: `${f1(wallH)}px` })
    const spillH = (hh - wallH) * 0.45
    Object.assign(spillBox.style, { left: `${f1(lx - tw / 2)}px`, top: `${f1(wallH)}px`, width: `${f1(tw)}px`, height: `${f1(spillH)}px` })
    spillPic.style.transform = `scaleY(0.45) translateY(${f1(-wallH)}px)`
    root.style.setProperty('--tw', `${f1(tw)}px`)
    root.style.setProperty('--wh', `${f1(wallH)}px`)

    // ── the room: back wall, the side wall with its shoji, the table top in perspective, its front edge
    const sideFoot = bk + (wide ? o.H * 0.2 : o.H * 0.12)
    const vp: Pt = [lx, -o.H * 1.4] // where the table's boards run to
    const toBack = (x: number) => vp[0] + (x - vp[0]) * ((bk - vp[1]) / (nr - vp[1]))
    let planks = ''
    for (let i = -6; i <= 14; i++) {
      const x = i * W * 0.09 + (r() - 0.5) * 6
      planks += `M${f1(x)} ${f1(nr)}L${f1(toBack(x))} ${f1(bk)}`
    }
    let grain = ''
    for (let i = 0; i < 26; i++) {
      const x = r() * W, y0 = bk + r() * (nr - bk) * 0.8, len = (nr - bk) * (0.1 + r() * 0.25)
      const x1 = vp[0] + (x - vp[0]) * ((y0 + len - vp[1]) / (y0 - vp[1]))
      grain += `M${f1(x)} ${f1(y0)}Q${f1((x + x1) / 2 + (r() - 0.5) * 6)} ${f1(y0 + len / 2)} ${f1(x1)} ${f1(y0 + len)}`
    }
    // the shoji on the side wall: nearer edge taller, its lattice in perspective
    const sh = wide ? { x0: W * 0.012, x1: W * 0.082, t0: o.H * 0.05, b0: bk + o.H * 0.11, t1: o.H * 0.09, b1: bk - o.H * 0.02 } : { x0: W * 0.01, x1: W * 0.065, t0: o.H * 0.04, b0: bk + o.H * 0.06, t1: o.H * 0.07, b1: bk - o.H * 0.03 }
    const at = (u: number, v: number): Pt => [sh.x0 + (sh.x1 - sh.x0) * u, (sh.t0 + (sh.t1 - sh.t0) * u) * (1 - v) + (sh.b0 + (sh.b1 - sh.b0) * u) * v]
    let lat = ''
    for (let k = 1; k < 3; k++) lat += `M${at(k / 3, 0).map(f1).join(' ')}L${at(k / 3, 1).map(f1).join(' ')}`
    for (let k = 1; k < 6; k++) lat += `M${at(0, k / 6).map(f1).join(' ')}L${at(1, k / 6).map(f1).join(' ')}`
    const quad = (pts: Pt[]) => `M${pts.map((p) => p.map(f1).join(' ')).join('L')}Z`
    // the moonlight that comes through it: a cold patch on the table and on the back wall, crossed by the lattice
    const mt: Pt[] = wide ? [[cx0 * 0.9, bk + o.H * 0.03], [W * 0.27, bk + o.H * 0.05], [W * 0.33, nr - o.H * 0.02], [W * 0.05, nr]] : [[cx0, bk + o.H * 0.03], [W * 0.3, bk + o.H * 0.06], [W * 0.36, nr - o.H * 0.06], [W * 0.04, nr - o.H * 0.03]]
    const mw: Pt[] = wide ? [[cx0 + W * 0.012, o.H * 0.12], [cx0 + W * 0.1, o.H * 0.15], [cx0 + W * 0.1, bk - o.H * 0.02], [cx0 + W * 0.012, bk - o.H * 0.01]] : [[cx0 + W * 0.02, o.H * 0.1], [cx0 + W * 0.16, o.H * 0.13], [cx0 + W * 0.16, bk - o.H * 0.02], [cx0 + W * 0.02, bk - o.H * 0.01]]
    const patchLat = (q: Pt[], cols: number, rows: number) => {
      const P = (u: number, v: number): Pt => [q[0][0] + (q[1][0] - q[0][0]) * u + ((q[3][0] + (q[2][0] - q[3][0]) * u) - (q[0][0] + (q[1][0] - q[0][0]) * u)) * v, q[0][1] + (q[1][1] - q[0][1]) * u + ((q[3][1] + (q[2][1] - q[3][1]) * u) - (q[0][1] + (q[1][1] - q[0][1]) * u)) * v]
      let d = ''
      for (let k = 1; k < cols; k++) d += `M${P(k / cols, 0).map(f1).join(' ')}L${P(k / cols, 1).map(f1).join(' ')}`
      for (let k = 1; k < rows; k++) d += `M${P(0, k / rows).map(f1).join(' ')}L${P(1, k / rows).map(f1).join(' ')}`
      return d
    }
    back.replaceChildren(
      s('rect', { class: 't36b-wall', x: 0, y: 0, width: f1(W), height: f1(bk + 2) }),
      s('ellipse', { cx: f1(lx), cy: f1(bk * 0.82), rx: f1(wide ? W * 0.36 : W * 0.75), ry: f1(bk * 0.9), fill: 'url(#t36b-throw)' }),
      s('path', { class: 't36b-side', d: `M0 0H${f1(cx0)}V${f1(bk)}L0 ${f1(sideFoot)}Z` }),
      s('path', { class: 't36b-cornerline', d: `M${f1(cx0)} 0V${f1(bk)}` }),
      s('path', { class: 't36b-shoji', d: quad([at(0, 0), at(1, 0), at(1, 1), at(0, 1)]) }),
      s('path', { class: 't36b-lattice', d: lat }),
      s('path', { class: 't36b-sframe', d: quad([at(0, 0), at(1, 0), at(1, 1), at(0, 1)]) }),
      s('g', { filter: low ? null : 'url(#t36b-far)' }, s('path', { class: 't36b-moonpatch t36b-mpwall', d: quad(mw) })),
      // the table top: boards running away from us, the lamp's warm pool round its foot, the moon's cold patch
      s('path', { class: 't36b-table', d: `M${f1(cx0)} ${f1(bk)}H${f1(W + 4)}V${f1(nr)}H-4V${f1(sideFoot)}Z` }),
      s('path', { class: 't36b-seam', d: planks }),
      s('path', { class: 't36b-grain', d: grain }),
      s('path', { class: 't36b-wallfoot', d: `M${f1(cx0)} ${f1(bk)}H${f1(W)}` }),
      s('ellipse', { cx: f1(lx), cy: f1(baseY), rx: f1(FW * 4.2), ry: f1(FW * 1.3), fill: 'url(#t36b-pool)' }),
      s('g', { filter: low ? null : 'url(#t36b-mist)' }, s('path', { class: 't36b-moonpatch', d: quad(mt) }), s('path', { class: 't36b-moonlat', d: patchLat(mt, 3, 6) })),
      s('ellipse', { class: 't36b-contact', cx: f1(lx + FW * 0.12), cy: f1(baseY + 2), rx: f1(FW * 1.05), ry: f1(FW * 0.2) }))
    // ── the near layer: the table's front edge, cut by the frame, and under it the dark
    near.replaceChildren(
      s('rect', { class: 't36b-front', x: -4, y: f1(nr), width: f1(W + 8), height: f1(edge - nr) }),
      s('path', { class: 't36b-edge', d: `M-4 ${f1(nr)}H${f1(W + 4)}` }),
      s('rect', { class: 't36b-under', x: -4, y: f1(edge), width: f1(W + 8), height: f1(Math.max(0, A - edge)) }),
      // out of focus on the near corner: a brush lying on the table's edge, its tip dark with ink
      low || !wide ? '' : s('g', { class: 't36b-near', filter: 'url(#t36b-far)' },
        ink(stroke([[-W * 0.01, nr + 4], [W * 0.15, nr - 26]], Math.max(7, W * 0.0075), 0.02, 0.1, 0.6), 't36b-brush'),
        ink(stroke([[W * 0.15, nr - 26], [W * 0.2, nr - 34]], Math.max(8, W * 0.008), 0.05, 0.9, 0.3), 't36b-stone')))
    void r
  }
}
