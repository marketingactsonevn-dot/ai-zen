import './kit.css'
import { fill, h, s } from '../../core/dom'
import { getSource } from '../../core/content'
import { blob, clamp, curve, onSize, rng, stableHeight, stroke, type Pt } from '../../ui/part2/ink'
import { pine } from '../../ui/part2/paint'
import { guide, type Mark } from '../../ui/part2/guide'
import type { SceneCtx } from '../types'
import { loadAnswers } from './ask'
import { C } from './shell'
import { D2R, dawnSky, f1, fog, g39Defs, idle, parallax } from './g39'

const K = C.scenes.kit
/** the camera looks down at the table this much (MACRO 35°) */
const PITCH = 35
const CP = Math.cos(PITCH * D2R), SP = Math.sin(PITCH * D2R)
const SLATS = 22

/** Which tool types fit the four answers, the device's line for the tag and the budget's note for the tools left out. */
function pick() {
  const a = loadAnswers()
  if (!a.role) return null
  const R = K.rules
  const set = new Set(R.role[a.role] ?? ['chat'])
  // the budget before the device: "not paying yet" keeps only the chat assistant (+ skill) in the basket, and a strong
  // machine still adds the free AI that runs on it (audit 39-2: the basket, the tag and the quiz say the same thing)
  for (const rule of [R.goal[a.goal ?? ''], R.budget[a.budget ?? ''], R.device[a.device ?? '']]) {
    if (!rule) continue
    if (rule.keep) for (const x of [...set]) if (!rule.keep.includes(x)) set.delete(x)
    rule.add?.forEach((x) => set.add(x))
    rule.drop?.forEach((x) => set.delete(x))
  }
  return { set, dev: R.device[a.device ?? '']?.note ?? '', why: R.budget[a.budget ?? '']?.note ?? '' }
}

type Geo = { W: number; H: number; Ha: number; T0: number; wide: boolean; r: number; rb: number; hB: number; cx: number; yb: number; P: number; oy: number; Sx: number; Sz: number; bw: number; bh: number; legH: number }

/**
 * Scene 2 — the kit (MACRO 35°, CSS 3D). A rattan basket on a dark veranda table under the first, raking ray of sun:
 * long light streaks across the boards from the right, every shadow thrown long to the left. Woven slats round a flared
 * bowl, a coiled rim, a lid hinged at the back, a dó-paper tag on a hemp string at the left handle. Lift the lid (drag or
 * tap): the tools that fit the answers stand up on the basket floor, each with a wooden name tag hung from the rim; the
 * others are carried out and stood, unlit, at the foot of the reading stand on the right. Touch a tool: it lifts toward
 * you and its paper slides onto the stand's board. Transforms only; no loop besides the shared parallax.
 */
export function kitScene(ctx: SceneCtx) {
  g39Defs()
  const low = ctx.quality === 'low'
  const still = ctx.reduced || low
  const chosen = pick()
  const set = chosen?.set ?? new Set(K.types.map((t) => t.id))
  const stable = stableHeight(ctx, [K.insight])

  const bg = s('svg', { class: 't39k-bg', 'aria-hidden': 'true' })
  // the table: dark boards, the low sun raking across them, the basket's and the stand's long shadows thrown left
  const bshadow = h('i', { class: 't39k-bshadow' })
  const lidGround = h('i', { class: 't39k-lidground' })
  const contact = h('i', { class: 't39k-contact' })
  const standSh = h('i', { class: 't39k-standsh' })
  const standLong = h('i', { class: 't39k-standlong' })
  const table = h('div', { class: 't39k-table', 'aria-hidden': 'true' }, h('i', { class: 't39k-boards' }), h('i', { class: 't39k-streaks' }), bshadow, standLong, standSh, lidGround, contact)
  const floor = h('i', { class: 't39k-floor', 'aria-hidden': 'true' })
  const slats = Array.from({ length: SLATS }, () => h('i', { class: 't39k-slat', 'aria-hidden': 'true' }))
  const rimSide = h('i', { class: 't39k-rim t39k-rim-side', 'aria-hidden': 'true' })
  const rim = h('i', { class: 't39k-rim', 'aria-hidden': 'true' })
  const handles = [-1, 1].map((sd) => h('i', { class: 't39k-handle', 'aria-hidden': 'true', 'data-side': String(sd) }))
  const binds = [-1, 1].map(() => h('i', { class: 't39k-bind', 'aria-hidden': 'true' }))
  const lidSh = h('i', { class: 't39k-lidsh', 'aria-hidden': 'true' })
  const lid = h('button', { class: 't39k-lid', type: 'button', 'aria-label': K.open, 'aria-expanded': 'false' }, s('svg', { class: 't39k-lid-art', viewBox: '-100 -100 200 200', 'aria-hidden': 'true' }))
  const tools = K.types.map((t, i) => h('button', { class: 't39k-tool', type: 'button', 'aria-label': t.name, 'aria-pressed': 'false', 'data-id': t.id, style: `--i:${i}`, onClick: () => lift(i) },
    s('svg', { class: 't39k-tool-art', 'aria-hidden': 'true' })))
  // each tool's contact shadow (on the basket floor or on the table), long to the left
  const tsh = K.types.map(() => h('i', { class: 't39k-tsh', 'aria-hidden': 'true' }))
  // the names: small wooden tags hung on strings from the rim in front of each tool in the basket
  const names = K.types.map((t) => h('span', { class: 't39k-name', 'aria-hidden': 'true' }, t.name))
  // the tools left out stand at the foot of the reading stand behind a small carved block: "when you need it"
  const later = h('span', { class: 't39k-later', 'aria-hidden': 'true' }, K.later)
  const liftSh = h('i', { class: 't39k-liftsh', 'aria-hidden': 'true' })
  // the dó-paper tag on a hemp string at the left handle: one line, what the device means for this basket
  // (a phone has no free side for it: there the same line is written on the stand's paper until a tool is lifted)
  const tagLine = chosen ? chosen.dev : ''
  const note = () => h('p', { class: 't39k-note' }, chosen ? tagLine : h('a', { href: '#/tram/39/1' }, K.empty))
  const tag = h('div', { class: `t39k-tag${chosen && !tagLine ? ' none' : ''}` }, h('i', { class: 't39k-string', 'aria-hidden': 'true' }), note())
  // the reading stand on the right: a dark board leaning back on its legs; a lifted tool's paper slides onto it
  const card = h('aside', { class: 't39k-card', hidden: true })
  const board = h('div', { class: 't39k-board' }, card)
  const legs = [0, 1, 2, 3].map((k) => h('i', { class: `t39k-leg${k > 1 ? ' back' : ''}`, 'aria-hidden': 'true' }))
  const bar = h('i', { class: 't39k-bar', 'aria-hidden': 'true' })
  const ledge = h('i', { class: 't39k-ledge', 'aria-hidden': 'true' })
  const world = h('div', { class: 't39k-world' }, table, ...tsh, floor, ...slats, rimSide, rim, ...handles, ...tools, lidSh, ...binds, lid, ...names, tag, ...legs, bar, board, ledge, later, liftSh)
  const stage = h('div', { class: 't39k-stage' }, world)
  const ray = h('i', { class: 't39k-ray', 'aria-hidden': 'true' })
  const root = h('div', { class: `t39k${still ? ' is-still' : ''}${chosen ? '' : ' is-empty'}` }, h('p', { class: 'visually-hidden' }, K.art), bg, ray, stage)
  ctx.art.append(root)
  idle(ctx, root)
  root.style.setProperty('--weave', WEAVE)
  root.style.setProperty('--grain', GRAIN)
  root.style.setProperty('--deckle', DECKLE)
  root.style.setProperty('--enso', ENSO)

  let G: Geo | null = null
  let open = false
  let told = false
  let sel = -1
  let tx = 0, ty = 0
  // H1 on the lid until it opens (on the tag's link while nothing is answered), then on every tool in the basket not yet
  // looked at; H4/H5 the count in the prompt
  const g = guide(ctx)
  let lidDot: Mark | null = chosen ? g.dot(lid, { dir: [0, -1] }) : null
  const inBasket = K.types.flatMap((t, i) => (set.has(t.id) ? [i] : []))
  const seen = new Set<number>()
  // one vermilion dot at a time: on the next tool in the basket not yet looked at
  let toolDot: Mark | null = null
  const pointNext = () => {
    toolDot?.done()
    toolDot = null
    const i = inBasket.find((k) => !seen.has(k))
    if (i != null && !told) toolDot = g.dot(tools[i], { dir: [0, -1] })
  }
  const zs: number[] = K.types.map(() => 0)
  const say = () => ctx.prompt(fill(K.next, { n: seen.size, total: inBasket.length }))

  const par = parallax(ctx, root, (x, y) => {
    tx = x
    ty = y
    pose()
  })
  function pose() {
    // (a phone turns less: its stand stands far back, and a big turn would swing it out of the frame)
    world.style.transform = `rotateX(${f1(-PITCH + ty * 3)}deg) rotateY(${f1(tx * (G?.wide === false ? 2 : 8))}deg)`
  }

  // ── the lid: tap, or drag it up past halfway ─────────────────────────────────────────────────────────────────────
  // closed it lies on the rim (hinged at the back); opened it is lifted straight up, carried back over the rim and laid
  // flat on the boards behind the basket, where it rests with its own contact shadow
  const timers = new Set<number>()
  const after = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => (timers.delete(id), fn()), ms)
    timers.add(id)
  }
  ctx.onCleanup(() => timers.forEach((id) => clearTimeout(id)))
  let lifted = 0
  /** 'up' p: held p (0…1) of the way up over the rim; 'back': up and over the boards behind; 'down': lying on them */
  const setLid = (at: 'up' | 'back' | 'down', p = 1) => {
    lifted = at === 'up' ? p : 1
    if (!G) return
    const { r, hB } = G
    const up = -hB * 1.5 * (at === 'down' ? 0 : lifted)
    const y = at === 'down' ? hB + Math.max(5, r * 0.045) * 1.2 - 1.5 : up
    const z = at === 'up' ? -r : -r * 3.25
    lid.style.transform = `translate3d(0px,${f1(y)}px,${f1(z)}px) rotateX(90deg)`
    // its shadow on the basket floor while it hangs over the basket, gone once it is carried off
    lidSh.style.opacity = f1(at === 'up' ? Math.min(1, p * 3) * 0.8 : 0)
  }
  const lidOpen = () => {
    if (still) return setLid('down')
    setLid('up', 1)
    after(() => setLid('back'), 420)
    after(() => setLid('down'), 900)
  }
  let drag: { y: number; moved: boolean } | null = null
  lid.addEventListener('pointerdown', (e) => {
    if (open || e.button || !chosen) return
    drag = { y: e.clientY, moved: false }
    lid.setPointerCapture(e.pointerId)
    root.classList.add('is-dragging')
  })
  lid.addEventListener('pointermove', (e) => {
    if (!drag || !G) return
    const dy = drag.y - e.clientY
    if (Math.abs(dy) > 5) drag.moved = true
    if (drag.moved) setLid('up', clamp(dy / (G.r * 1.2), 0, 1))
  })
  const release = () => {
    if (!drag) return
    const moved = drag.moved
    drag = null
    root.classList.remove('is-dragging')
    if (!moved) return
    lid.dataset.dragged = '1'
    setTimeout(() => delete lid.dataset.dragged)
    if (lifted > 0.35) show()
    else setLid('up', 0)
  }
  lid.addEventListener('pointerup', release)
  lid.addEventListener('pointercancel', release)
  lid.addEventListener('click', () => !lid.dataset.dragged && !open && show())

  function show() {
    // nothing answered by the pond yet: the lid stays tied shut and says why (the tag links back to the questions)
    if (!chosen) return g.wrong(K.empty, lid)
    open = true
    root.classList.add('is-open')
    lid.setAttribute('aria-expanded', 'true')
    lid.tabIndex = -1
    lidOpen()
    place()
    ctx.chime('soft')
    lidDot?.done()
    lidDot = null
    if (!toolDot && !told) pointNext()
    if (!told) say()
    if (document.activeElement === lid) tools.find((t) => set.has(t.dataset.id!))?.focus({ preventScroll: true })
  }

  // ── tools: standing on the basket floor when they fit, carried out to the stand's foot when not ───────────────────
  function place() {
    if (!G) return
    const { r, rb, hB, wide, Sx, Sz, bw } = G
    const ins = inBasket
    const outs = K.types.map((t, i) => (set.has(t.id) ? -1 : i)).filter((i) => i >= 0)
    const rr = r * 1.06
    tools.forEach((b, i) => {
      const k = ins.indexOf(i)
      // (on a phone the stand is far back: the tools left out there are drawn a size up so they still read)
      const [w, hh] = toolSize(K.types[i].id, r, hB).map((v) => v * (wide || k >= 0 ? 1 : 1.35))
      // (at least a finger wide: the art stays centred in it)
      const hit = Math.max(w, 46)
      b.style.width = `${f1(hit)}px`
      b.style.height = `${f1(hh)}px`
      b.classList.toggle('in', k >= 0)
      b.classList.toggle('out', k < 0)
      const sh = tsh[i]
      let x: number, z: number, y0: number
      if (k >= 0) {
        // on the basket floor: one row toward the back wall, or two rows when there are more than three
        const n = ins.length
        x = n === 1 ? 0 : (k / (n - 1) - 0.5) * rb * (n > 3 ? 1.35 : 1.1)
        z = n > 3 ? (k % 2 ? rb * 0.12 : -rb * 0.42) : -rb * 0.28
        y0 = -4
        b.style.setProperty('--up', `translate3d(0px,${f1(-hB * 0.75 - hh * 0.2)}px,${f1(z + r * 0.95)}px)`)
        b.style.setProperty('--hide', `translate3d(0px,${f1(hh * 0.95)}px,${f1(z)}px)`)
        b.style.setProperty('--d', `${(0.35 + k * 0.16).toFixed(2)}s`)
        // its name on a wooden tag hung from the rim straight in front of it; neighbours hang at two lengths
        // (spread along the front of the rim in the tools' left-to-right order; two or three string lengths so
        // neighbours never cover each other; as far forward as the rim at the tag's inner edge, clear of the wall)
        const nm = names[i]
        const tx0 = n === 1 ? 0 : (k / (n - 1) - 0.5) * rr * (n > 3 ? 1.6 : 1.1)
        const ax = Math.max(0, Math.abs(tx0) - r * 0.32)
        const zf = Math.sqrt(Math.max(0, rr * rr - ax * ax))
        Object.assign(nm.style, { left: `${f1(tx0)}px`, top: `${f1(-hB)}px`, transform: `translate3d(-50%,0px,${f1(zf + 3)}px)` })
        nm.style.setProperty('--drop', `${Math.round(8 + (k % 2) * hB * 0.34)}px`)
        nm.classList.toggle('small', n > 3)
        nm.classList.add('on')
      } else {
        // stood on the table at the reading stand's foot, in front of its legs, below its board
        const m = outs.indexOf(i), n = outs.length
        if (wide) {
          x = Sx + (n === 1 ? 0 : (m / (n - 1) - 0.5) * bw * 0.78)
          z = Sz + r * (0.36 + (m % 2) * 0.22)
        } else {
          x = Sx + (n === 1 ? 0 : (m / (n - 1) - 0.5) * bw * 0.72)
          z = Sz + r * (0.4 + (m % 2) * 0.3)
        }
        y0 = 0
        b.style.setProperty('--up', `translate3d(0px,${f1(-hh * 0.25)}px,${f1(z + r * 0.35)}px)`)
        // before the lid opens it lies in the basket like the rest
        b.style.setProperty('--hide', `translate3d(${f1(-x)}px,${f1(-4 - hh * 0.2)}px,${f1(-r * 0.2)}px)`)
        b.style.setProperty('--d', `${(0.9 + m * 0.18).toFixed(2)}s`)
        names[i].classList.remove('on')
      }
      b.style.left = `${f1(x - hit / 2)}px`
      b.style.top = `${f1(y0 - hh)}px`
      b.style.setProperty('--at', `translate3d(0px,0px,${f1(z)}px)`)
      zs[i] = z
      // contact and long shadow, lying flat under its foot, thrown left by the sun
      const L = w + hh * (k >= 0 ? 0.9 : 1.6)
      Object.assign(sh.style, { left: `${f1(x + w * 0.55 - L)}px`, top: `${f1(y0 - 0.6 - w * 0.22)}px`, width: `${f1(L)}px`, height: `${f1(w * 0.44)}px`, transform: `translateZ(${f1(z)}px) rotateX(90deg)` })
      sh.classList.toggle('in', k >= 0)
    })
    // the carved block before the tools left out
    if (outs.length) {
      const bx = Sx - bw * (wide ? 0.58 : 0.33), bz = Sz + r * (wide ? 0.62 : 0.95)
      Object.assign(later.style, { left: `${f1(bx)}px`, top: '0px', transform: `translate3d(-50%,-100%,${f1(bz)}px)` })
      later.classList.add('on')
    }
  }

  function lift(i: number) {
    if (!open) return show()
    const again = sel === i
    if (sel >= 0) {
      tools[sel].classList.remove('up')
      tools[sel].setAttribute('aria-pressed', 'false')
    }
    sel = again ? -1 : i
    root.classList.toggle('is-lifted', sel >= 0)
    if (sel < 0) {
      rest()
      return
    }
    const b = tools[i]
    b.classList.add('up')
    b.setAttribute('aria-pressed', 'true')
    const t = K.types[i]
    if (inBasket.includes(i) && !seen.has(i)) {
      seen.add(i)
      b.classList.add('seen')
      pointNext()
      if (!told && seen.size < inBasket.length) say()
      else if (!told) {
        // every tool in the basket looked at: what the basket was sorted by
        told = true
        root.classList.add('is-told')
        ctx.insight(K.insight)
        // one text block at a time: the insight stays veiled while a paper is on the stand; this last paper goes back
        // after a while on its own (the tool settles into the basket) and the insight shows
        after(() => sel === i && lift(i), 6500)
      }
    }
    // its shadow drops onto the table in front, far and soft
    Object.assign(liftSh.style, { left: b.style.left, width: b.style.width, transform: `translate3d(${f1(-G!.r * 0.18)}px,-1px,${f1(zs[i] + G!.r * 0.6)}px) rotateX(90deg)` })
    const outNote = !set.has(t.id) && chosen?.why ? h('p', { class: 't39k-why' }, h('b', null, K.later), ' · ', chosen.why) : null
    card.replaceChildren(
      h('h3', null, t.name),
      h('p', { class: 't39k-what' }, t.what),
      ...(outNote ? [outNote] : []),
      h('p', { class: 't39k-eyebrow' }, `${K.examplesLabel} · ${K.docsLabel}`),
      // the examples: wooden tags hung on a cord
      h('ul', { class: 't39k-ex' }, ...t.examples.map((e, k) => h('li', { style: `--k:${k}` },
        h('a', { href: getSource(e.source)?.url ?? '#', target: '_blank', rel: 'noopener', title: K.docsLabel, 'aria-label': `${e.name} — ${K.docsLabel}` }, h('b', null, e.name))))),
      h('p', { class: 't39k-stations' }, ...t.stations.map((n) => h('a', { class: 't39k-st', href: `#/tram/${n}` }, fill(K.stationLink, { n })))),
      ctx.fact(K.priceNote, 'p', 't39k-price'))
    card.dataset.tool = t.id
    card.hidden = false
    card.classList.remove('rise')
    void card.offsetWidth // restart the slide onto the board
    card.classList.add('rise')
    if (!card.hasAttribute('aria-live')) card.setAttribute('aria-live', 'polite')
    ctx.chime('soft')
  }

  /** nothing lifted: the blank sheet (wide, or once the insight is out) or the tag's line (phone, before it) */
  function rest() {
    if ((G?.wide ?? true) || told) {
      card.hidden = true
      return
    }
    card.replaceChildren(note())
    card.dataset.tool = ''
    card.hidden = false
    if (!chosen && !lidDot) lidDot = g.dot(card.querySelector('a')!, { dir: [0, -1] })
  }

  // ── layout ─────────────────────────────────────────────────────────────────────────────────────────────────────────
  function layout() {
    const Ha = stable(ctx.art.clientHeight)
    if (ctx.art.clientWidth < 60 || Ha < 60) return
    // the root runs full-bleed: out to the screen's sides, up under the header, a little down behind the foot
    const W = root.clientWidth, H = root.clientHeight, T0 = H - ctx.art.clientHeight - 24
    const wide = W > Ha * 1.1
    // the basket: the left-middle third of a wide frame; high in a phone's frame, the reading stand below it
    const r = Math.round(wide ? Math.min(Ha * 0.32, W * 0.185) : Math.min(W * 0.25, Ha * 0.16))
    const hB = r * 0.62, rb = r * 0.78
    const cx = wide ? W * 0.32 : W * 0.5
    // a phone: the basket near the foot of the frame, the stand behind it on the far boards
    const yb = T0 + (wide ? Ha * 0.67 : Ha - r * 0.62)
    const P = Math.round(clamp(Math.max(W, H) * 1.05, 900, 1600))
    const oy = yb - hB * 1.2
    // world → screen (the world's own pitch, its perspective): to stand the reading stand where the frame wants it
    const proj = (x: number, y: number, z: number): Pt => {
      const y1 = y * CP + z * SP, z1 = -y * SP + z * CP, k = P / (P - z1)
      return [cx + x * k, oy + (yb + y1 - oy) * k]
    }
    // the floor point under a screen point (x, y)
    const onFloor = (X: number, Y: number): Pt => {
      const z = (P * (Y - yb)) / (P * SP + (Y - oy) * CP)
      const k = P / (P - z * CP)
      return [(X - cx) / k, z]
    }
    // the stand: wide, its foot on the right third; a phone, centred at the foot of the frame
    const legH = Math.round(r * (wide ? 0.56 : 0.8))
    // (behind the open lid on a phone, so the tools left out can stand between the two)
    const [Sx, Sz0] = wide ? onFloor(W * 0.76, T0 + Ha * 0.64) : onFloor(W / 2, T0 + Ha * 0.54)
    // a phone: never on the laid-down lid (it reaches back to 3.3 r)
    const Sz = wide ? Sz0 : Math.min(Sz0, -r * 4.3)
    const kS = proj(Sx, 0, Sz)
    const sc = P / (P - Sz * CP)
    const bw = Math.round((wide ? Math.min(440, W * 0.3) : W - 44) / sc)
    // the board's height: what fits under the header
    const topY = T0 + (wide ? Ha * 0.03 : 8)
    const bh = Math.round(clamp((kS[1] - legH * CP * sc - topY) / sc, 160, 420))
    // the paper's type is set in world px: divide by the stand's scale so it reads at 14px on screen
    board.style.fontSize = `${f1((wide ? 13 : 12.5) / sc)}px`
    G = { W, H, Ha, T0, wide, r, rb, hB, cx, yb, P, oy, Sx, Sz, bw, bh, legH }
    root.classList.toggle('is-wide', wide)
    Object.assign(stage.style, { perspective: `${P}px`, perspectiveOrigin: `${f1(cx)}px ${f1(oy)}px` })
    Object.assign(world.style, { left: `${f1(cx)}px`, top: `${f1(yb)}px` })
    pose()
    // the table: boards running away from the eye, fading into the garden at the far edge (table coords: x right, y = z)
    // its far edge is the veranda's end: the garden and the sun rise beyond it (and the open lid lies on it)
    const yFar = T0 + Ha * (wide ? 0.3 : 0.34)
    const Tw = Math.max(W, 900) * 1.3, Td = Math.max(-onFloor(cx, yFar)[1], -Sz + bh * SP + r * 0.4, r * 3.6), Tn = r * 3.5
    Object.assign(table.style, { width: `${f1(Tw * 2)}px`, height: `${f1(Td + Tn)}px`, left: `${f1(-Tw)}px`, top: `${f1(-Td)}px`, transformOrigin: `${f1(Tw)}px ${f1(Td)}px` })
    const onT = (el: HTMLElement, x0: number, z0: number, w: number, d: number) => Object.assign(el.style, { left: `${f1(Tw + x0)}px`, top: `${f1(Td + z0)}px`, width: `${f1(w)}px`, height: `${f1(d)}px` })
    // the long shadows: the low sun on the right lays the basket (and its lid) far across the boards to the left
    onT(bshadow, -r * 4.2, -r * 1.6, r * 4.55, r * 2.5)
    // the laid-down lid's contact, a little to the left (the sun is on the right)
    onT(lidGround, -r * 1.22, -r * 3.3, r * 2.3, r * 2.26)
    onT(contact, -rb * 1.25, -rb * 1.15, rb * 2.4, rb * 2.3)
    const sd = bh * 0.7 * SP + 10
    onT(standSh, Sx - bw * 0.56, Sz - sd, bw * 1.08, sd + 14)
    const sl = (legH + bh * CP) * 1.9
    onT(standLong, Sx - bw * 0.5 - sl, Sz - sd, sl + bw * 0.6, sd + 14)
    // the bowl: slats round from the floor (radius rb) out to the rim (radius r), each shaded by the low sun on the right
    const L = Math.hypot(hB, r - rb), tilt = Math.atan2(r - rb, hB) / D2R
    const sw = 2 * r * Math.sin(Math.PI / SLATS) * 1.06, bwid = (sw * rb) / r
    const sun = [0.86, -0.3, 0.4]
    const dr = rng(3939)
    slats.forEach((el, k) => {
      const phi = (k / SLATS) * Math.PI * 2
      const n = [Math.sin(phi), 0, Math.cos(phi)]
      const facing = n[2] > -0.05
      const dot = n[0] * sun[0] + n[2] * sun[2]
      const lit = facing ? 0.36 + 0.64 * Math.max(0, dot) : 0.42 + 0.45 * Math.max(0, -dot)
      Object.assign(el.style, {
        left: `${f1(-sw / 2)}px`, top: `${f1(-L)}px`, width: `${f1(sw)}px`, height: `${f1(L)}px`,
        transform: `rotateY(${f1(phi / D2R)}deg) translateZ(${f1(rb)}px) rotateX(${f1(-tilt)}deg)`,
        clipPath: `polygon(0 0,100% 0,${f1(50 + (bwid / sw) * 50)}% 100%,${f1(50 - (bwid / sw) * 50)}% 100%)`,
      })
      el.style.setProperty('--sh', (1 - lit).toFixed(2))
      el.style.setProperty('--dew', facing && dot > 0.2 ? '1' : '0')
      el.style.setProperty('--d1', `${f1(15 + dr() * 70)}% ${f1(10 + dr() * 35)}%`)
      el.style.setProperty('--d2', `${f1(15 + dr() * 70)}% ${f1(45 + dr() * 45)}%`)
      el.style.setProperty('--d3', `${f1(15 + dr() * 70)}% ${f1(20 + dr() * 60)}%`)
      el.style.backgroundPositionX = `${f1(-k * sw * 0.37)}px`
      el.classList.toggle('back', !facing)
    })
    Object.assign(floor.style, { left: `${f1(-rb)}px`, top: `${f1(-rb)}px`, width: `${f1(rb * 2)}px`, height: `${f1(rb * 2)}px` })
    const rr = r * 1.06, rt = Math.max(5, r * 0.045)
    Object.assign(rim.style, { left: `${f1(-rr)}px`, top: `${f1(-rr)}px`, width: `${f1(rr * 2)}px`, height: `${f1(rr * 2)}px`, transform: `translateY(${f1(-hB - rt * 0.4)}px) rotateX(90deg)` })
    Object.assign(rimSide.style, { left: `${f1(-rr * 1.01)}px`, top: `${f1(-rr * 1.01)}px`, width: `${f1(rr * 2.02)}px`, height: `${f1(rr * 2.02)}px`, transform: `translateY(${f1(-hB + rt)}px) rotateX(90deg)` })
    root.style.setProperty('--rimw', `${f1(rt * 2.2)}px`)
    const hw = r * 0.3, hl = r * 0.52
    handles.forEach((el, k) => {
      const sd2 = k ? 1 : -1
      Object.assign(el.style, { left: `${f1(sd2 > 0 ? rr * 0.9 : -rr * 0.9 - hw)}px`, top: `${f1(-hl / 2)}px`, width: `${f1(hw)}px`, height: `${f1(hl)}px`, transform: `translateY(${f1(-hB - rt * 0.2)}px) rotateX(90deg)` })
    })
    binds.forEach((el, k) => {
      const bwi = r * 0.13, bhi = r * 0.12
      Object.assign(el.style, { left: `${f1((k ? 1 : -1) * r * 0.36 - bwi / 2)}px`, top: `${f1(-hB - bhi * 0.62)}px`, width: `${f1(bwi)}px`, height: `${f1(bhi)}px`, transform: `translateZ(${f1(-rr * 0.97)}px)` })
    })
    Object.assign(lidSh.style, { left: `${f1(-rb)}px`, top: `${f1(-rb)}px`, width: `${f1(rb * 2)}px`, height: `${f1(rb * 2)}px` })
    Object.assign(lid.style, { left: `${f1(-r * 1.04)}px`, top: `${f1(-hB - rt * 1.2)}px`, width: `${f1(r * 2.08)}px`, height: `${f1(r * 2.08)}px` })
    ;(lid.firstChild as SVGSVGElement).replaceChildren(...lidArt())
    if (open) setLid('down')
    else setLid('up', 0)
    Object.assign(liftSh.style, { top: `${f1(-r * 0.3)}px`, height: `${f1(r * 0.6)}px` })
    tools.forEach((b, i) => {
      const [w, hh] = toolSize(K.types[i].id, r, hB)
      const art = b.firstChild as SVGSVGElement
      art.setAttribute('viewBox', `${f1(-w / 2)} ${f1(-hh)} ${f1(w)} ${f1(hh)}`)
      art.replaceChildren(...toolArt(K.types[i].id, w, hh))
    })
    // the tag hangs on its string from the outer end of the left handle, in front of it, and turns a little toward us
    const hx = -rr * 0.9 - hw * 0.72
    // (out to the left of the handle, clear of the bowl, and short enough to hang clear of the boards)
    const tw = Math.round(Math.min(215, r * 1.05))
    Object.assign(tag.style, { left: `${f1(hx)}px`, top: `${f1(-hB - rt * 0.2)}px`, transform: `translate3d(${f1(-Math.min(tw * 0.92, cx + hx - 26))}px,0px,${f1(hl * 0.1)}px)` })
    tag.style.setProperty('--tw', `${tw}px`)
    // the reading stand: two front legs, two back legs under the board's upper part, a stretcher, the board leaning back
    // so it faces the eye, a ledge at its foot that holds the paper
    const lw = Math.max(7, r * 0.045), inset = bw * 0.08
    const zb = Sz - bh * 0.7 * SP, hb = legH + bh * 0.7 * CP
    legs.forEach((el, k) => {
      const back = k > 1, side = k % 2 ? 1 : -1
      const lx = Sx + side * (bw / 2 - inset)
      Object.assign(el.style, { left: `${f1(lx - lw / 2)}px`, top: `${f1(back ? -hb : -legH)}px`, width: `${f1(lw)}px`, height: `${f1(back ? hb : legH)}px`, transform: `translateZ(${f1(back ? zb : Sz + 3)}px)` })
    })
    Object.assign(bar.style, { left: `${f1(Sx - bw / 2 + inset)}px`, top: `${f1(-legH * 0.42)}px`, width: `${f1(bw - inset * 2)}px`, height: `${f1(lw * 0.9)}px`, transform: `translateZ(${f1(Sz + 3)}px)` })
    Object.assign(board.style, { left: `${f1(Sx - bw / 2)}px`, top: `${f1(-legH - bh)}px`, width: `${f1(bw)}px`, height: `${f1(bh)}px`, transform: `translateZ(${f1(Sz)}px) rotateX(${PITCH}deg)` })
    Object.assign(ledge.style, { left: `${f1(Sx - bw / 2 - 6)}px`, top: `${f1(-legH - lw * 1.6)}px`, width: `${f1(bw + 12)}px`, height: `${f1(lw * 2.2)}px`, transform: `translateZ(${f1(Sz + 7)}px)` })
    place()
    if (sel < 0) rest()
    if (!chosen && !lidDot && wide) lidDot = g.dot(tag.querySelector('a')!, { dir: [0, -1] })
    g.refresh()
    // the garden beyond the veranda, out of focus: the sun just up on the right, pines, mist, the moon nearly gone
    const hz = proj(0, 0, -Td)[1] - 2
    const sunX = W * (wide ? 0.95 : 0.9)
    bg.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    bg.replaceChildren(...dawnSky(W, H, hz, sunX, 3931, { moon: [W * (wide ? 0.08 : 0.12), T0 + Ha * 0.06], hillH: Ha * 0.08, sunY: hz - Ha * 0.03 }),
      fog(W * 0.5, hz + Ha * 0.04, W * 0.6, Ha * 0.05),
      pine(W * (wide ? 0.05 : 0.03), hz + Ha * 0.14, Ha * (wide ? 0.46 : 0.3), 3933, 1),
      pine(W * (wide ? 0.17 : 0.3), hz + Ha * 0.1, Ha * (wide ? 0.26 : 0.18), 3935, 1),
      pine(W * (wide ? 0.62 : 0.7), hz + Ha * 0.08, Ha * (wide ? 0.22 : 0.16), 3934, -1))
    // the first ray: from the sun, low across the table
    Object.assign(ray.style, { left: `${f1(sunX)}px`, top: `${f1(hz - Ha * 0.03)}px`, width: `${f1(Math.hypot(W, Ha) * 0.95)}px` })
  }

  const esc = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || sel < 0) return
    const b = tools[sel]
    lift(sel)
    b.focus({ preventScroll: true })
  }
  root.addEventListener('keydown', esc)
  ctx.onCleanup(onSize(ctx.art, layout))
  if (still && chosen) {
    // low / reduced: the basket stands open from the start
    lidDot?.done()
    lidDot = null
    pointNext()
    open = true
    root.classList.add('is-open')
    lid.setAttribute('aria-expanded', 'true')
    lid.tabIndex = -1
    if (G) (setLid('down'), place())
  }
  par.kick()
  if (open) say()
  else ctx.prompt(chosen ? K.prompt : K.empty)
}

/** Size (w, h) of a tool's standing cut-out. */
function toolSize(id: string, r: number, hB: number): Pt {
  switch (id) {
    case 'chat': return [r * 0.24, hB * 1.9]
    case 'media': return [r * 0.62, hB * 1.32]
    case 'local': return [r * 0.42, hB * 1.55]
    case 'code': return [r * 0.7, hB * 0.98]
    default: return [r * 0.64, hB * 0.62]
  }
}

/** The five tools, painted standing on y = 0 (centred on x = 0), the low sun warm on their right side, shade on the left. */
function toolArt(id: string, w: number, hh: number): SVGElement[] {
  const u = w / 10
  const lw = (k: number) => Math.max(1, Math.min(w, hh) * k)
  if (id === 'chat') {
    // a brush stood tip up: bamboo handle with nodes, a brass ferrule, a wet black tip
    const hw = w * 0.22
    return [
      s('path', { class: 't39k-bamboo', d: `M${f1(-hw)} 0L${f1(-hw)} ${f1(-hh * 0.66)}L${f1(hw)} ${f1(-hh * 0.66)}L${f1(hw)} 0Z` }),
      s('path', { class: 't39k-shade', d: `M${f1(-hw)} 0L${f1(-hw)} ${f1(-hh * 0.66)}L${f1(-hw * 0.2)} ${f1(-hh * 0.66)}L${f1(-hw * 0.2)} 0Z` }),
      s('path', { class: 't39k-node', d: [0.18, 0.4, 0.6].map((k) => stroke([[-hw, -hh * k], [hw, -hh * k - 0.6]], Math.max(1, w * 0.06), 0.05, 0.05, 0.6)).join('') }),
      s('path', { class: 't39k-hi', d: stroke([[hw * 0.6, -hh * 0.02], [hw * 0.6, -hh * 0.64]], Math.max(1, w * 0.09), 0.1, 0.1, 0.3) }),
      s('path', { class: 't39k-brass', d: `M${f1(-hw * 1.1)} ${f1(-hh * 0.66)}L${f1(hw * 1.1)} ${f1(-hh * 0.66)}L${f1(hw)} ${f1(-hh * 0.72)}L${f1(-hw)} ${f1(-hh * 0.72)}Z` }),
      s('path', { class: 't39k-tip', d: `M${f1(-hw)} ${f1(-hh * 0.72)}Q${f1(-hw * 1.5)} ${f1(-hh * 0.86)} ${f1(-hw * 0.1)} ${f1(-hh)}Q${f1(hw * 1.4)} ${f1(-hh * 0.86)} ${f1(hw)} ${f1(-hh * 0.72)}Z` }),
      s('path', { class: 't39k-tip-hi', d: stroke([[hw * 0.55, -hh * 0.74], [hw * 0.45, -hh * 0.86], [0, -hh * 0.97]], Math.max(0.8, w * 0.07), 0.1, 0.4, 0.2) }),
    ]
  }
  if (id === 'media') {
    // an open lacquer box of colours: the lid up behind (lined in gold), the ink stick and the inkstone, a vermilion cake
    const x0 = -w * 0.47, x1 = w * 0.47, rimY = -hh * 0.46
    return [
      s('path', { class: 't39k-lacquer-dk', d: `M${f1(x0 + u * 0.3)} ${f1(rimY)}L${f1(x0 + u * 0.7)} ${f1(-hh)}L${f1(x1 - u * 0.2)} ${f1(-hh * 0.97)}L${f1(x1)} ${f1(rimY)}Z` }),
      s('path', { class: 't39k-gold', d: `M${f1(x0 + u * 0.8)} ${f1(rimY - hh * 0.02)}L${f1(x0 + u * 1.1)} ${f1(-hh * 0.92)}L${f1(x1 - u * 0.6)} ${f1(-hh * 0.9)}L${f1(x1 - u * 0.45)} ${f1(rimY - hh * 0.02)}Z` }),
      s('path', { class: 't39k-inkstone', d: `M${f1(x0 + w * 0.08)} ${f1(rimY + hh * 0.02)}L${f1(x0 + w * 0.1)} ${f1(-hh * 0.6)}Q${f1(x0 + w * 0.3)} ${f1(-hh * 0.66)} ${f1(x0 + w * 0.5)} ${f1(-hh * 0.6)}L${f1(x0 + w * 0.52)} ${f1(rimY + hh * 0.02)}Z` }),
      s('ellipse', { class: 't39k-well', cx: f1(x0 + w * 0.3), cy: f1(-hh * 0.6), rx: f1(w * 0.13), ry: f1(hh * 0.03) }),
      s('path', { class: 't39k-inkstick', d: `M${f1(x0 + w * 0.56)} ${f1(rimY)}L${f1(x0 + w * 0.62)} ${f1(-hh * 0.86)}L${f1(x0 + w * 0.72)} ${f1(-hh * 0.85)}L${f1(x0 + w * 0.68)} ${f1(rimY)}Z` }),
      s('path', { class: 't39k-hi', d: stroke([[x0 + w * 0.7, -hh * 0.82], [x0 + w * 0.67, rimY - 2]], lw(0.025), 0.1, 0.1, 0.4) }),
      s('ellipse', { class: 't39k-cake', cx: f1(x1 - w * 0.13), cy: f1(rimY - hh * 0.06), rx: f1(w * 0.12), ry: f1(hh * 0.09) }),
      s('ellipse', { class: 't39k-cake-hi', cx: f1(x1 - w * 0.1), cy: f1(rimY - hh * 0.1), rx: f1(w * 0.05), ry: f1(hh * 0.03) }),
      s('path', { class: 't39k-lacquer', d: `M${f1(x0 - u * 0.2)} 0L${f1(x0 - u * 0.2)} ${f1(rimY)}L${f1(x1 + u * 0.2)} ${f1(rimY)}L${f1(x1 + u * 0.2)} 0Z` }),
      s('path', { class: 't39k-shade', d: `M${f1(x0 - u * 0.2)} 0L${f1(x0 - u * 0.2)} ${f1(rimY)}L${f1(x0 + w * 0.25)} ${f1(rimY)}L${f1(x0 + w * 0.15)} 0Z` }),
      s('path', { class: 't39k-hi', d: stroke([[x0, rimY + 1], [x1, rimY + 1]], lw(0.03), 0.05, 0.05, 0.5) + stroke([[x1 + u * 0.08, rimY + 2], [x1 + u * 0.08, -2]], lw(0.04), 0.1, 0.1, 0.4) }),
      s('path', { class: 't39k-brass', d: `M${f1(x0 - u * 0.2)} ${f1(-hh * 0.06)}h${f1(u * 0.9)}v${f1(-hh * 0.07)}h${f1(-u * 0.9)}ZM${f1(x1 + u * 0.2)} ${f1(-hh * 0.06)}h${f1(-u * 0.9)}v${f1(-hh * 0.07)}h${f1(u * 0.9)}Z` }),
    ]
  }
  if (id === 'local') {
    // a small clay oil lamp on its stand, alight: the wick's flame (it flickers at quality=high), its warm glow
    const fy = -hh * 0.71
    return [
      s('circle', { class: 't39k-glow', cx: f1(w * 0.12), cy: f1(-hh * 0.82), r: f1(w * 1.3), fill: 'url(#g39-lamp)' }),
      s('path', { class: 't39k-clay', d: `M${f1(-w * 0.34)} 0Q${f1(-w * 0.3)} ${f1(-hh * 0.08)} ${f1(-w * 0.1)} ${f1(-hh * 0.1)}L${f1(-w * 0.06)} ${f1(-hh * 0.6)}Q${f1(-w * 0.46)} ${f1(-hh * 0.6)} ${f1(-w * 0.46)} ${f1(-hh * 0.68)}L${f1(w * 0.46)} ${f1(-hh * 0.7)}Q${f1(w * 0.46)} ${f1(-hh * 0.6)} ${f1(w * 0.06)} ${f1(-hh * 0.6)}L${f1(w * 0.1)} ${f1(-hh * 0.1)}Q${f1(w * 0.3)} ${f1(-hh * 0.08)} ${f1(w * 0.34)} 0Z` }),
      s('path', { class: 't39k-shade', d: `M${f1(-w * 0.34)} 0Q${f1(-w * 0.3)} ${f1(-hh * 0.08)} ${f1(-w * 0.1)} ${f1(-hh * 0.1)}L${f1(-w * 0.06)} ${f1(-hh * 0.6)}Q${f1(-w * 0.46)} ${f1(-hh * 0.6)} ${f1(-w * 0.46)} ${f1(-hh * 0.68)}L${f1(-w * 0.1)} ${f1(-hh * 0.69)}L${f1(-w * 0.02)} 0Z` }),
      s('path', { class: 't39k-oil', d: `M${f1(-w * 0.42)} ${f1(-hh * 0.69)}Q0 ${f1(-hh * 0.74)} ${f1(w * 0.42)} ${f1(-hh * 0.7)}Z` }),
      s('path', { class: 't39k-rimlight', d: stroke(curve([w * 0.44, -hh * 0.69], [w * 0.3, -hh * 0.6], [w * 0.08, -hh * 0.58], 8), lw(0.035), 0.2, 0.2, 0.2) + stroke(curve([w * 0.1, -hh * 0.12], [w * 0.08, -hh * 0.35], [w * 0.06, -hh * 0.58], 8), lw(0.03), 0.2, 0.2, 0.2) }),
      s('path', { class: 't39k-wick', d: stroke([[w * 0.14, -hh * 0.7], [w * 0.15, fy - hh * 0.02]], lw(0.03), 0.1, 0.1, 0.5) }),
      s('g', { class: 't39k-flame-g', style: `transform-origin:${f1(w * 0.15)}px ${f1(fy)}px` },
        s('path', { class: 't39k-flame', d: `M${f1(w * 0.1)} ${f1(fy)}Q${f1(w * 0.0)} ${f1(fy - hh * 0.12)} ${f1(w * 0.15)} ${f1(fy - hh * 0.3)}Q${f1(w * 0.3)} ${f1(fy - hh * 0.12)} ${f1(w * 0.2)} ${f1(fy)}Z` }),
        s('path', { class: 't39k-flame-core', d: `M${f1(w * 0.125)} ${f1(fy - hh * 0.01)}Q${f1(w * 0.08)} ${f1(fy - hh * 0.08)} ${f1(w * 0.15)} ${f1(fy - hh * 0.17)}Q${f1(w * 0.21)} ${f1(fy - hh * 0.08)} ${f1(w * 0.175)} ${f1(fy - hh * 0.01)}Z` })),
    ]
  }
  if (id === 'code') {
    // a wooden block plane on its side: the body and its grain, the steel iron through it, the knob, a long shaving
    // curling out of the mouth and one fallen beside it
    const by = -hh * 0.46
    return [
      s('path', { class: 't39k-woodblk', d: `M${f1(-w * 0.48)} 0L${f1(-w * 0.46)} ${f1(by)}Q${f1(-w * 0.44)} ${f1(by - hh * 0.12)} ${f1(-w * 0.36)} ${f1(by - hh * 0.12)}L${f1(w * 0.4)} ${f1(by - hh * 0.12)}Q${f1(w * 0.47)} ${f1(by - hh * 0.1)} ${f1(w * 0.48)} ${f1(by)}L${f1(w * 0.48)} 0Z` }),
      s('path', { class: 't39k-woodtop', d: `M${f1(-w * 0.44)} ${f1(by - hh * 0.04)}Q${f1(-w * 0.4)} ${f1(by - hh * 0.11)} ${f1(-w * 0.34)} ${f1(by - hh * 0.11)}L${f1(w * 0.4)} ${f1(by - hh * 0.11)}Q${f1(w * 0.45)} ${f1(by - hh * 0.09)} ${f1(w * 0.46)} ${f1(by - hh * 0.04)}Z` }),
      s('path', { class: 't39k-grain', d: [0.1, 0.2, 0.3, 0.38].map((k, i) => stroke([[-w * 0.44, -hh * k], [-w * 0.1, -hh * k - (i % 2 ? 1.2 : -1)], [w * 0.44, -hh * k + 0.6]], lw(0.012), 0.3, 0.3, 0.2)).join('') }),
      s('path', { class: 't39k-shade', d: `M${f1(-w * 0.48)} 0L${f1(-w * 0.46)} ${f1(by)}L${f1(-w * 0.3)} ${f1(by)}L${f1(-w * 0.32)} 0Z` }),
      s('path', { class: 't39k-knob', d: blob(-w * 0.3, by - hh * 0.2, w * 0.07, hh * 0.13, 3947, 0.1, 12) }),
      s('path', { class: 't39k-iron', d: `M${f1(w * 0.0)} ${f1(by - hh * 0.1)}L${f1(w * 0.08)} ${f1(-hh * 0.98)}L${f1(w * 0.2)} ${f1(-hh * 0.95)}L${f1(w * 0.12)} ${f1(by - hh * 0.1)}Z` }),
      s('path', { class: 't39k-hi', d: stroke([[w * 0.18, -hh * 0.94], [w * 0.11, by - hh * 0.12]], lw(0.03), 0.1, 0.1, 0.4) + stroke([[-w * 0.34, by - hh * 0.12], [w * 0.4, by - hh * 0.12]], lw(0.025), 0.1, 0.1, 0.4) + stroke([[w * 0.47, by], [w * 0.47, -2]], lw(0.035), 0.1, 0.1, 0.4) }),
      s('path', { class: 't39k-shaving', d: stroke(curve([w * 0.14, by - hh * 0.12], [w * 0.5, -hh * 1.12], [w * 0.62, -hh * 0.62], 16), lw(0.11), 0.1, 0.5, 0.3) + stroke(curve([w * 0.6, -hh * 0.66], [w * 0.44, -hh * 0.5], [w * 0.5, -hh * 0.8], 10), lw(0.07), 0.2, 0.4, 0.3) }),
      s('path', { class: 't39k-shaving-hi', d: stroke(curve([w * 0.2, by - hh * 0.2], [w * 0.5, -hh * 1.02], [w * 0.58, -hh * 0.66], 14), lw(0.025), 0.2, 0.5, 0.3) }),
      s('path', { class: 't39k-shaving', d: stroke(curve([-w * 0.62, -hh * 0.04], [-w * 0.5, -hh * 0.3], [-w * 0.4, -hh * 0.06], 10), lw(0.06), 0.2, 0.4, 0.3) }),
    ]
  }
  // skill: a scroll rolled on its wooden rod and tied round the middle with a red cord, the bow's ends hanging
  // lying on the floor it stands on (y = 0), turned a little
  const ry = hh * 0.36, cy = -ry - 1, x0 = -w * 0.4, x1 = w * 0.4
  return [
    s('g', { transform: `rotate(-4 0 ${f1(cy)})` },
      s('rect', { class: 't39k-paperroll', x: f1(x0), y: f1(cy - ry), width: f1(x1 - x0), height: f1(ry * 2), rx: f1(ry * 0.25) }),
      s('path', { class: 't39k-shade', d: `M${f1(x0)} ${f1(cy + ry * 0.35)}h${f1(x1 - x0)}v${f1(ry * 0.65)}h${f1(x0 - x1)}Z` }),
      s('path', { class: 't39k-hi', d: stroke([[x0 + 4, cy - ry * 0.55], [x1 - 4, cy - ry * 0.55]], lw(0.04), 0.1, 0.1, 0.4) }),
      s('path', { class: 't39k-rod', d: `M${f1(x0 - w * 0.07)} ${f1(cy - ry * 0.55)}h${f1(w * 0.08)}v${f1(ry * 1.1)}h${f1(-w * 0.08)}ZM${f1(x1 - w * 0.01)} ${f1(cy - ry * 0.55)}h${f1(w * 0.08)}v${f1(ry * 1.1)}h${f1(-w * 0.08)}Z` }),
      s('path', { class: 't39k-knobend', d: blob(x0 - w * 0.08, cy, w * 0.035, ry * 0.62, 3948, 0.1, 10) + blob(x1 + w * 0.08, cy, w * 0.035, ry * 0.62, 3949, 0.1, 10) }),
      s('path', { class: 't39k-cord', d: stroke([[-w * 0.02, cy - ry * 1.02], [-w * 0.01, cy + ry * 1.02]], lw(0.05), 0.05, 0.05, 0.6) + stroke([[w * 0.03, cy - ry * 1.02], [w * 0.04, cy + ry * 1.02]], lw(0.05), 0.05, 0.05, 0.6) + blob(w * 0.01, cy + ry * 0.2, w * 0.035, ry * 0.2, 3950, 0.2, 10) + stroke(curve([w * 0.01, cy + ry * 0.2], [-w * 0.1, cy + ry * 0.9], [-w * 0.13, cy + ry * 1.6], 8), lw(0.035), 0.05, 0.5, 0.3) + stroke(curve([w * 0.01, cy + ry * 0.2], [w * 0.12, cy + ry * 0.8], [w * 0.1, cy + ry * 1.7], 8), lw(0.035), 0.05, 0.5, 0.3) })),
  ]
}

/** The weave of the bowl, one tile: weavers passing over and under the stakes in alternate rows (light from above). */
const WEAVE = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='16'><defs>` +
  `<linearGradient id='w' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#fff' stop-opacity='.42'/><stop offset='.45' stop-color='#fff' stop-opacity='.05'/><stop offset='1' stop-color='#000' stop-opacity='.42'/></linearGradient>` +
  `<linearGradient id='s' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#000' stop-opacity='.5'/><stop offset='.45' stop-color='#fff' stop-opacity='.22'/><stop offset='1' stop-color='#000' stop-opacity='.55'/></linearGradient>` +
  `<radialGradient id='u'><stop offset='0' stop-color='#000' stop-opacity='.45'/><stop offset='1' stop-color='#000' stop-opacity='0'/></radialGradient></defs>` +
  `<rect y='0' width='24' height='1.2' fill='#000' fill-opacity='.55'/><rect y='7' width='24' height='2' fill='#000' fill-opacity='.55'/><rect y='15' width='24' height='1' fill='#000' fill-opacity='.55'/>` +
  `<rect x='0' y='1.2' width='24' height='5.8' fill='url(#w)'/><rect x='0' y='9' width='24' height='6' fill='url(#w)'/>` +
  `<ellipse cx='5' cy='4' rx='4' ry='3' fill='url(#u)'/><ellipse cx='-5' cy='4' rx='4' ry='3' fill='url(#u)'/><ellipse cx='19' cy='4' rx='4' ry='3' fill='url(#u)'/><ellipse cx='29' cy='4' rx='4' ry='3' fill='url(#u)'/>` +
  `<ellipse cx='7' cy='12' rx='4' ry='3' fill='url(#u)'/><ellipse cx='17' cy='12' rx='4' ry='3' fill='url(#u)'/>` +
  `<rect x='-2.6' y='0' width='5.2' height='8' fill='#000' fill-opacity='.18'/><rect x='-2.6' y='0' width='5.2' height='8' fill='url(#s)'/>` +
  `<rect x='21.4' y='0' width='5.2' height='8' fill='#000' fill-opacity='.18'/><rect x='21.4' y='0' width='5.2' height='8' fill='url(#s)'/>` +
  `<rect x='9.4' y='8' width='5.2' height='8' fill='#000' fill-opacity='.18'/><rect x='9.4' y='8' width='5.2' height='8' fill='url(#s)'/>` +
  `<ellipse cx='12' cy='3' rx='4.5' ry='1.4' fill='#fff' fill-opacity='.28'/><ellipse cx='0' cy='11' rx='4.5' ry='1.4' fill='#fff' fill-opacity='.28'/><ellipse cx='24' cy='11' rx='4.5' ry='1.4' fill='#fff' fill-opacity='.28'/>` +
  `</svg>`,
)}")`

/** Wood grain for the table boards, one tile (boards run away from the eye): long fibres, two knots with their rings. */
const knot = (cx: number, cy: number, k: number) =>
  `<g fill='none' stroke='#000'>${[[7, 20, 0.4], [13, 38, 0.25], [20, 60, 0.14], [28, 90, 0.08]].map(([a, b, o]) => `<ellipse cx='${cx}' cy='${cy}' rx='${f1(a * k)}' ry='${f1(b * k)}' stroke-opacity='${o}'/>`).join('')}</g>` +
  `<ellipse cx='${cx}' cy='${cy}' rx='${f1(5 * k)}' ry='${f1(12 * k)}' fill='#000' fill-opacity='.55'/>`
const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='900'><filter id='g' x='0' y='0' width='100%' height='100%'>` +
  `<feTurbulence type='fractalNoise' baseFrequency='.16 .0035' numOctaves='3' seed='7' stitchTiles='stitch'/>` +
  `<feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1.5 0 0 0 -0.66'/></filter>` +
  `<rect width='240' height='900' filter='url(#g)'/>${knot(64, 240, 1)}${knot(178, 690, 0.8)}</svg>`,
)}")`

/** A torn dó-paper edge all round (clip-path polygon), built once. */
const DECKLE = (() => {
  const r = rng(3961)
  const side = (n: number, f: (t: number, j: number) => string) => Array.from({ length: n }, (_, i) => f(i / n, (r() - 0.5) * 2)).join(',')
  return `polygon(${[
    side(28, (t, j) => `${f1(t * 100)}% ${f1(1.6 + j * 1.6)}%`),
    side(10, (t, j) => `${f1(98.6 + j * 1.4)}% ${f1(t * 100)}%`),
    side(28, (t, j) => `${f1(100 - t * 100)}% ${f1(98.4 + j * 1.6)}%`),
    side(10, (t, j) => `${f1(1.4 + j * 1.4)}% ${f1(100 - t * 100)}%`),
  ].join(',')})`
})()

/** The blank dó sheet waiting on the stand: an ensō brushed on it in one stroke, left open, and a small seal. */
const ENSO = (() => {
  const pts: Pt[] = Array.from({ length: 40 }, (_, i) => {
    const a = ((-70 + (i / 39) * 318) * Math.PI) / 180
    return [100 + Math.cos(a) * 62, 100 + Math.sin(a) * 60]
  })
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><path d='${stroke(pts, 13, 0.02, 0.85, 0.25)}' fill='#1a2240' fill-opacity='.72'/>` +
    `<rect x='150' y='160' width='13' height='16' rx='1.5' fill='#c2402a' fill-opacity='.8'/></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
})()

/** The woven lid from above (in -100…100): rings of cane, spokes, a knot at the centre, dew on the weave. */
function lidArt(): SVGElement[] {
  const r = rng(3940)
  let coil = '', spokes = '', dew = ''
  for (let R = 14; R < 96; R += 7) {
    let a = r() * 30
    while (a < 360) {
      const len = 26 + r() * 30
      const pts: Pt[] = Array.from({ length: 7 }, (_, i) => {
        const t = ((a + (len * i) / 6) * Math.PI) / 180
        return [Math.cos(t) * R, Math.sin(t) * R]
      })
      coil += stroke(pts, 4.2, 0.25, 0.25, 0.4)
      a += len + 5
    }
  }
  for (let k = 0; k < 24; k++) {
    const t = (k / 24) * Math.PI * 2
    spokes += stroke([[Math.cos(t) * 12, Math.sin(t) * 12], [Math.cos(t) * 97, Math.sin(t) * 97]], 1.4, 0.1, 0.1, 0.6)
  }
  for (let i = 0; i < 26; i++) {
    const t = r() * Math.PI * 2, R = 20 + r() * 72
    dew += `M${f1(Math.cos(t) * R)} ${f1(Math.sin(t) * R)}a1.6 1.6 0 1 0 0.01 0Z`
  }
  return [
    s('circle', { class: 't39k-lid-base', r: 99 }),
    s('path', { class: 't39k-lid-coil', d: coil }),
    s('path', { class: 't39k-lid-spoke', d: spokes }),
    s('circle', { class: 't39k-lid-shade', r: 99 }),
    s('path', { class: 't39k-lid-rim', d: blob(0, 0, 98, 98, 3941, 0.01, 40), fill: 'none' }),
    s('path', { class: 't39k-lid-knot', d: blob(0, 0, 12, 11, 3942, 0.2, 12) + stroke(curve([4, 4], [18, 10], [26, 26], 8), 4, 0.1, 0.5, 0.3) + stroke(curve([-2, 6], [-8, 18], [-20, 24], 8), 4, 0.1, 0.5, 0.3) }),
    s('path', { class: 't39k-dew', d: dew }),
    // nothing answered yet: a hemp cord tied round the lid, knotted at the front
    s('path', { class: 't39k-lid-tie', d: stroke([[-99, 8], [-40, 14], [40, 14], [99, 8]], 5, 0.05, 0.05, 0.4) + stroke([[6, -99], [10, -40], [12, 40], [8, 99]], 5, 0.05, 0.05, 0.4) + blob(10, 14, 11, 9, 3943, 0.2, 12) + stroke(curve([12, 18], [30, 40], [26, 70], 8), 4, 0.1, 0.5, 0.3) }),
  ]
}
