import './kit.css'
import { fill, h, s } from '../../core/dom'
import { getSource } from '../../core/content'
import { blob, clamp, curve, onSize, rng, stableHeight, stroke, type Pt } from '../../ui/part2/ink'
import { pine } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import { loadAnswers } from './ask'
import { C } from './shell'
import { D2R, dawnSky, f1, fog, g39Defs, idle, parallax } from './g39'

const K = C.scenes.kit
/** the camera looks down at the table this much (MACRO 35°) */
const PITCH = 35
const SLATS = 22

/** Which tool types fit the four answers, the notes they bring and the stations to revisit (null: not answered yet). */
function pick() {
  const a = loadAnswers()
  if (!a.role) return null
  const R = K.rules
  const set = new Set(R.role[a.role] ?? ['chat'])
  const notes: string[] = []
  const stations = new Set<number>()
  for (const rule of [R.goal[a.goal ?? ''], R.device[a.device ?? ''], R.budget[a.budget ?? '']]) {
    if (!rule) continue
    rule.add?.forEach((x) => set.add(x))
    rule.drop?.forEach((x) => set.delete(x))
    rule.stations?.forEach((x) => stations.add(x))
    if (rule.note) notes.push(rule.note)
  }
  return { set, notes, stations }
}

type Geo = { W: number; H: number; Ha: number; T0: number; wide: boolean; r: number; rb: number; hB: number; cx: number; yb: number; P: number }

/**
 * Scene 2 — the kit (MACRO 35°, CSS 3D). A rattan basket on the veranda table under the first ray of sun, built in true
 * 3D: woven slats round a flared bowl, a coiled rim, a lid hinged at the back; the table recedes in real perspective with
 * the basket's long shadow thrown left. Lift the lid (drag or tap): the tools that fit the answers float up into the
 * basket, the others lie faded on the table. Touch a tool: it floats toward you and its paper card opens. The pointer /
 * phone tilts the whole still life a few degrees. Transforms only; no loop besides the shared parallax.
 */
export function kitScene(ctx: SceneCtx) {
  g39Defs()
  const low = ctx.quality === 'low'
  const still = ctx.reduced || low
  const chosen = pick()
  const set = chosen?.set ?? new Set(K.types.map((t) => t.id))
  const stable = stableHeight(ctx, [K.insight])

  const bg = s('svg', { class: 't39k-bg', 'aria-hidden': 'true' })
  // the table: boards, the low sun's warm rake across them, the basket's long shadow thrown left
  const bshadow = h('i', { class: 't39k-bshadow' })
  // where the open lid rests on the boards behind the basket: its contact and its own shadow, left
  const lidGround = h('i', { class: 't39k-lidground' })
  const table = h('div', { class: 't39k-table', 'aria-hidden': 'true' }, h('i', { class: 't39k-boards' }), bshadow, lidGround, h('i', { class: 't39k-contact' }))
  const floor = h('i', { class: 't39k-floor', 'aria-hidden': 'true' })
  const slats = Array.from({ length: SLATS }, () => h('i', { class: 't39k-slat', 'aria-hidden': 'true' }))
  // the rim: a thick coil of cane (its lit top over its shaded outer side)
  const rimSide = h('i', { class: 't39k-rim t39k-rim-side', 'aria-hidden': 'true' })
  const rim = h('i', { class: 't39k-rim', 'aria-hidden': 'true' })
  // two cane handles standing on the rim, left and right; the paper tag is tied to the right one
  const handles = [-1, 1].map((sd) => h('i', { class: 't39k-handle', 'aria-hidden': 'true', 'data-side': String(sd) }))
  // the lid hangs on two cane bindings at the back of the rim
  const binds = [-1, 1].map(() => h('i', { class: 't39k-bind', 'aria-hidden': 'true' }))
  const lidSh = h('i', { class: 't39k-lidsh', 'aria-hidden': 'true' })
  const lid = h('button', { class: 't39k-lid', type: 'button', 'aria-label': K.open, 'aria-expanded': 'false' }, s('svg', { class: 't39k-lid-art', viewBox: '-100 -100 200 200', 'aria-hidden': 'true' }))
  const lidTag = h('span', { class: 't39k-lidtag g39-say', 'aria-hidden': 'true' }, K.open)
  const tools = K.types.map((t, i) => h('button', { class: 't39k-tool', type: 'button', 'aria-label': t.name, 'aria-pressed': 'false', 'data-id': t.id, style: `--i:${i}`, onClick: () => lift(i) },
    s('svg', { class: 't39k-tool-art', 'aria-hidden': 'true' })))
  const liftSh = h('i', { class: 't39k-liftsh', 'aria-hidden': 'true' })
  // the paper tag tied to the right handle: a manila tag on a string, its hole reinforced
  const notes = h('div', { class: 't39k-tag' },
    h('i', { class: 't39k-string', 'aria-hidden': 'true' }),
    ...(chosen ? [...chosen.notes.map((n) => h('p', null, n)), ctx.fact(K.priceNote, 'p', 't39k-price')] : [h('p', null, h('a', { href: '#/tram/39/1' }, K.empty))]),
    chosen?.stations.size ? h('p', { class: 't39k-rev' }, h('span', null, K.revisit), ' ', ...[...chosen.stations].sort((a, b) => a - b).map((n) => h('a', { class: 't39k-st', href: `#/tram/${n}` }, fill(K.stationLink, { n })))) : null)
  const world = h('div', { class: 't39k-world' }, table, floor, ...slats, rimSide, rim, ...handles, ...tools, lidSh, ...binds, lid, lidTag)
  const stage = h('div', { class: 't39k-stage' }, world)
  // a lifted tool's paper slip: it rises out of the basket beside the tool (no box, no close button: touch the tool again)
  const card = h('aside', { class: 't39k-card', hidden: true })
  const ray = h('i', { class: 't39k-ray', 'aria-hidden': 'true' })
  const root = h('div', { class: `t39k${still ? ' is-still' : ''}${chosen ? '' : ' is-empty'}` }, h('p', { class: 'visually-hidden' }, K.art), bg, stage, ray, notes, card)
  ctx.art.append(root)
  world.append(liftSh)
  idle(ctx, root)
  root.style.setProperty('--weave', WEAVE)

  let G: Geo | null = null
  let open = false
  let told = false
  let sel = -1
  let tx = 0, ty = 0

  const par = parallax(ctx, root, (x, y) => {
    tx = x
    ty = y
    pose()
  })
  function pose() {
    world.style.transform = `rotateX(${f1(-PITCH + ty * 3)}deg) rotateY(${f1(tx * 10)}deg)`
  }

  // ── the lid: tap, or drag it up past halfway ─────────────────────────────────────────────────────────────────────
  // closed it lies on the rim; open it swings back over its hinge and comes to rest on the table behind the basket
  const CLOSED = 90, OPEN = 287
  let ang = CLOSED
  const setLid = (a: number) => {
    ang = a
    if (!G) return
    lid.style.transform = `translate3d(0px,0px,${f1(-G.r)}px) rotateX(${f1(a)}deg)`
    // the lid's shadow inside the basket while it stands over it, gone once it lies back
    lidSh.style.opacity = f1(Math.max(0, Math.sin(((a - CLOSED) * Math.PI) / 180)) * 0.9 * (a < OPEN - 4 ? 1 : 0.35))
  }
  let drag: { y: number; a: number; moved: boolean } | null = null
  lid.addEventListener('pointerdown', (e) => {
    if (open || e.button) return
    drag = { y: e.clientY, a: ang, moved: false }
    lid.setPointerCapture(e.pointerId)
    root.classList.add('is-dragging')
  })
  lid.addEventListener('pointermove', (e) => {
    if (!drag || !G) return
    const dy = drag.y - e.clientY
    if (Math.abs(dy) > 5) drag.moved = true
    if (drag.moved) setLid(clamp(CLOSED + (dy / (G.r * 1.2)) * (OPEN - CLOSED), CLOSED, OPEN))
  })
  const release = () => {
    if (!drag) return
    const moved = drag.moved
    drag = null
    root.classList.remove('is-dragging')
    if (!moved) return
    lid.dataset.dragged = '1'
    setTimeout(() => delete lid.dataset.dragged)
    if (ang > CLOSED + (OPEN - CLOSED) * 0.35) show()
    else setLid(CLOSED)
  }
  lid.addEventListener('pointerup', release)
  lid.addEventListener('pointercancel', release)
  lid.addEventListener('click', () => !lid.dataset.dragged && !open && show())

  function show() {
    open = true
    root.classList.add('is-open')
    lid.setAttribute('aria-expanded', 'true')
    lid.tabIndex = -1
    setLid(OPEN)
    place()
    ctx.chime('soft')
    if (!told) {
      told = true
      ctx.insight(K.insight)
    }
    if (document.activeElement === lid) tools.find((t) => set.has(t.dataset.id!))?.focus({ preventScroll: true })
  }

  // ── tools: in the basket when they fit, lying on the table when not; a touched one floats toward the viewer ────────
  function place() {
    if (!G) return
    const { r, hB } = G
    const ins = K.types.map((t, i) => (set.has(t.id) ? i : -1)).filter((i) => i >= 0)
    const outs = K.types.map((t, i) => (set.has(t.id) ? -1 : i)).filter((i) => i >= 0)
    tools.forEach((b, i) => {
      const [w, hh] = toolSize(K.types[i].id, r, hB)
      const k = ins.indexOf(i)
      b.style.width = `${f1(w)}px`
      b.style.height = `${f1(hh)}px`
      b.classList.toggle('in', k >= 0)
      b.classList.toggle('out', k < 0)
      if (k >= 0) {
        // two rows inside the bowl, floating so their upper half shows above the rim
        const n = ins.length
        const x = n === 1 ? 0 : (k / (n - 1) - 0.5) * r * (n > 3 ? 1.25 : 1)
        const z = n > 3 ? (k % 2 ? r * 0.18 : -r * 0.22) : -r * 0.05
        const lift = hB - hh * 0.36
        b.style.left = `${f1(x - w / 2)}px`
        b.style.top = `${f1(-lift - hh)}px`
        b.style.setProperty('--at', `translate3d(0px,0px,${f1(z)}px)`)
        b.style.setProperty('--up', `translate3d(0px,${f1(-hh * 0.55 - hB * 0.4)}px,${f1(z + r * 0.95)}px)`)
        b.style.setProperty('--hide', `translate3d(0px,${f1(hh * 0.9)}px,${f1(z)}px)`)
        b.style.setProperty('--d', `${(0.35 + k * 0.16).toFixed(2)}s`)
      } else {
        // laid flat on the table in front, faded like a moon shadow
        const m = outs.indexOf(i)
        const side = m % 2 ? 1 : -1
        const x = side * (r * 1.45 + Math.floor(m / 2) * r * 0.5)
        const z = r * (0.55 + (m % 3) * 0.12)
        b.style.left = `${f1(x - w / 2)}px`
        b.style.top = `${f1(-hh)}px`
        b.style.setProperty('--at', `translate3d(0px,0px,${f1(z)}px) rotateX(90deg) rotateZ(${side * 18}deg)`)
        b.style.setProperty('--up', `translate3d(0px,${f1(-hh * 0.4)}px,${f1(z + r * 0.4)}px) rotateX(20deg)`)
        b.style.setProperty('--hide', `translate3d(0px,0px,${f1(z)}px) rotateX(90deg) rotateZ(${side * 18}deg)`)
        b.style.setProperty('--d', `${(0.9 + m * 0.15).toFixed(2)}s`)
      }
    })
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
      card.hidden = true
      return
    }
    const b = tools[i]
    b.classList.add('up')
    b.setAttribute('aria-pressed', 'true')
    const t = K.types[i]
    // its shadow drops onto the table in front, far and soft
    Object.assign(liftSh.style, { left: b.style.left, width: b.style.width, transform: `translate3d(${f1(-G!.r * 0.18)}px,-1px,${f1(G!.r * 1.25)}px) rotateX(90deg)` })
    card.replaceChildren(
      h('h3', null, t.name),
      h('p', { class: 't39k-what' }, t.what),
      h('p', { class: 't39k-eyebrow' }, K.examplesLabel),
      // the examples: wooden tags hung on a cord
      h('ul', { class: 't39k-ex' }, ...t.examples.map((e, k) => h('li', { style: `--k:${k}` },
        h('a', { href: getSource(e.source)?.url ?? '#', target: '_blank', rel: 'noopener', 'aria-label': `${e.name} — ${K.docsLabel}` }, h('b', null, e.name), h('span', null, K.docsLabel))))),
      h('p', { class: 't39k-stations' }, ...t.stations.map((n) => h('a', { class: 't39k-st', href: `#/tram/${n}` }, fill(K.stationLink, { n })))))
    card.dataset.tool = t.id
    card.hidden = false
    card.classList.remove('rise')
    void card.offsetWidth // restart the rise out of the basket
    card.classList.add('rise')
    if (!card.hasAttribute('aria-live')) card.setAttribute('aria-live', 'polite')
    ctx.chime('soft')
  }

  // ── layout ─────────────────────────────────────────────────────────────────────────────────────────────────────────
  function layout() {
    const Ha = stable(ctx.art.clientHeight)
    if (ctx.art.clientWidth < 60 || Ha < 60) return
    // the root runs full-bleed: out to the screen's sides, up under the header, a little down behind the foot
    const W = root.clientWidth, H = root.clientHeight, T0 = H - ctx.art.clientHeight - 24
    const wide = W > Ha * 1.1
    // the basket: about a third of a wide frame; 60% of a phone's width, high enough for the paper slip below it
    const r = Math.round(wide ? Math.min(Ha * 0.28, W * 0.17) : Math.min(W * 0.3, Ha * 0.21))
    const hB = r * 0.62, rb = r * 0.78
    const cx = wide ? W * 0.36 : W / 2
    const yb = T0 + (wide ? Ha * 0.67 : Math.max(r * 1.85 + 12, Ha * 0.44))
    const P = Math.round(clamp(Math.max(W, H) * 1.05, 900, 1600))
    G = { W, H, Ha, T0, wide, r, rb, hB, cx, yb, P }
    Object.assign(stage.style, { perspective: `${P}px`, perspectiveOrigin: `${f1(cx)}px ${f1(yb - hB * 1.2)}px` })
    Object.assign(world.style, { left: `${f1(cx)}px`, top: `${f1(yb)}px` })
    pose()
    // the table: boards running away from the eye, fading into the garden at the far edge (table coords: x right, y = z)
    const Tw = Math.max(W, 900) * 1.3, Td = r * 5
    Object.assign(table.style, { width: `${f1(Tw * 2)}px`, height: `${f1(Td * 2)}px`, left: `${f1(-Tw)}px`, top: `${f1(-Td)}px` })
    // the long shadow: the low sun on the right lays the basket (and its lid) far across the boards to the left
    Object.assign(bshadow.style, { left: `${f1(Tw - r * 4.2)}px`, top: `${f1(Td - r * 1.6)}px`, width: `${f1(r * 4.55)}px`, height: `${f1(r * 2.5)}px` })
    Object.assign(lidGround.style, { left: `${f1(Tw - r * 1.5)}px`, top: `${f1(Td - r * 3.25)}px`, width: `${f1(r * 2.6)}px`, height: `${f1(r * 2.4)}px` })
    Object.assign((table.lastChild as HTMLElement).style, { left: `${f1(Tw - rb * 1.25)}px`, top: `${f1(Td - rb * 1.15)}px`, width: `${f1(rb * 2.4)}px`, height: `${f1(rb * 2.3)}px` })
    // the bowl: slats round from the floor (radius rb) out to the rim (radius r), each shaded by the low sun on the right
    const L = Math.hypot(hB, r - rb), tilt = Math.atan2(r - rb, hB) / D2R
    const sw = 2 * r * Math.sin(Math.PI / SLATS) * 1.06, bw = (sw * rb) / r
    const sun = [0.86, -0.3, 0.4]
    const dr = rng(3939)
    slats.forEach((el, k) => {
      const phi = (k / SLATS) * Math.PI * 2
      const n = [Math.sin(phi), 0, Math.cos(phi)]
      const facing = n[2] > -0.05
      const dot = n[0] * sun[0] + n[2] * sun[2]
      const lit = facing ? 0.4 + 0.6 * Math.max(0, dot) : 0.42 + 0.45 * Math.max(0, -dot)
      Object.assign(el.style, {
        left: `${f1(-sw / 2)}px`, top: `${f1(-L)}px`, width: `${f1(sw)}px`, height: `${f1(L)}px`,
        transform: `rotateY(${f1(phi / D2R)}deg) translateZ(${f1(rb)}px) rotateX(${f1(-tilt)}deg)`,
        clipPath: `polygon(0 0,100% 0,${f1(50 + (bw / sw) * 50)}% 100%,${f1(50 - (bw / sw) * 50)}% 100%)`,
      })
      el.style.setProperty('--sh', (1 - lit).toFixed(2))
      // dew on the sunlit slats: a few beads at their own places on each
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
    // the ear handles: a D of cane laid flat at the rim, sticking out on each side
    handles.forEach((el, k) => {
      const sd = k ? 1 : -1, hw = r * 0.3, hl = r * 0.52
      Object.assign(el.style, { left: `${f1(sd > 0 ? rr * 0.9 : -rr * 0.9 - hw)}px`, top: `${f1(-hl / 2)}px`, width: `${f1(hw)}px`, height: `${f1(hl)}px`, transform: `translateY(${f1(-hB - rt * 0.2)}px) rotateX(90deg)` })
    })
    // the hinge: two bindings of cane at the back of the rim, the lid's edge lashed to the coil
    binds.forEach((el, k) => {
      const bwid = r * 0.13, bh = r * 0.12
      Object.assign(el.style, { left: `${f1((k ? 1 : -1) * r * 0.36 - bwid / 2)}px`, top: `${f1(-hB - bh * 0.62)}px`, width: `${f1(bwid)}px`, height: `${f1(bh)}px`, transform: `translateZ(${f1(-rr * 0.97)}px)` })
    })
    Object.assign(lidSh.style, { left: `${f1(-rb)}px`, top: `${f1(-rb)}px`, width: `${f1(rb * 2)}px`, height: `${f1(rb * 2)}px` })
    Object.assign(lid.style, { left: `${f1(-r * 1.04)}px`, top: `${f1(-hB - rt * 1.2)}px`, width: `${f1(r * 2.08)}px`, height: `${f1(r * 2.08)}px` })
    ;(lid.firstChild as SVGSVGElement).replaceChildren(...lidArt())
    setLid(open ? OPEN : CLOSED)
    Object.assign(lidTag.style, { transform: `translate3d(${f1(r * 0.08)}px,${f1(-hB - r * 0.18)}px,${f1(r * 0.35)}px) rotateX(${PITCH}deg)` })
    Object.assign(liftSh.style, { top: `${f1(-r * 0.3)}px`, height: `${f1(r * 0.6)}px` })
    tools.forEach((b, i) => {
      const [w, hh] = toolSize(K.types[i].id, r, hB)
      const art = b.firstChild as SVGSVGElement
      art.setAttribute('viewBox', `${f1(-w / 2)} ${f1(-hh)} ${f1(w)} ${f1(hh)}`)
      art.replaceChildren(...toolArt(K.types[i].id, w, hh))
    })
    place()
    // the garden beyond the veranda, out of focus: the sun just up on the right, a pine, mist, the moon nearly gone
    const hz = T0 + Ha * (wide ? 0.36 : 0.3)
    bg.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    bg.replaceChildren(...dawnSky(W, H, hz, W * (wide ? 0.84 : 0.78), 3931, { moon: [W * 0.1, T0 + Ha * 0.08], hillH: Ha * 0.1, sunY: hz - Ha * 0.06 }),
      fog(W * 0.5, hz + Ha * 0.06, W * 0.7, Ha * 0.08),
      pine(W * (wide ? 0.06 : 0.04), hz + Ha * 0.16, Ha * (wide ? 0.5 : 0.36), 3933, 1),
      pine(W * (wide ? 0.97 : 1.02), hz + Ha * 0.12, Ha * 0.3, 3934, -1))
    // the tag hangs from the right handle on its string; a lifted tool's slip rises out of the basket on its free side
    // (wide: where the tag hung, the tag stepping aside; tall: under the basket)
    const hx = cx + rr * 0.9 + r * 0.3, hy = yb - (hB + rt * 0.2) * Math.cos(PITCH * D2R)
    if (wide) {
      Object.assign(notes.style, { left: `${f1(hx - 22)}px`, top: `${f1(hy + 30)}px`, right: '', width: '' })
      Object.assign(card.style, { left: `${f1(Math.min(cx + r * 1.2, W - 400))}px`, top: '', bottom: `${f1(H - (yb - hB * 0.2))}px`, width: '', right: '', maxHeight: `${f1(yb - hB * 0.2 - T0 - 8)}px` })
    } else {
      Object.assign(notes.style, { left: '20px', top: `${f1(yb + r * 0.62)}px`, right: '20px', width: 'auto' })
      Object.assign(card.style, { left: '16px', right: '16px', width: 'auto', top: `${f1(yb + r * 0.52)}px`, bottom: '', maxHeight: `${f1(T0 + Ha - yb - r * 0.52)}px` })
    }
    // the first ray: from the sun, low across the table
    Object.assign(ray.style, { left: `${f1(W * (wide ? 0.84 : 0.78))}px`, top: `${f1(hz - Ha * 0.06)}px`, width: `${f1(Math.hypot(W, Ha) * 0.9)}px` })
  }

  const esc = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || sel < 0) return
    const b = tools[sel]
    lift(sel)
    b.focus({ preventScroll: true })
  }
  root.addEventListener('keydown', esc)
  ctx.onCleanup(onSize(ctx.art, layout))
  if (still) {
    // low / reduced: the basket stands open from the start
    open = true
    root.classList.add('is-open')
    lid.setAttribute('aria-expanded', 'true')
    lid.tabIndex = -1
    ang = OPEN
    if (G) (setLid(OPEN), place())
  }
  par.kick()
  ctx.prompt(K.prompt)
}

/** Size (w, h) of a tool's standing cut-out. */
function toolSize(id: string, r: number, hB: number): Pt {
  switch (id) {
    case 'chat': return [r * 0.24, hB * 1.9]
    case 'media': return [r * 0.62, hB * 1.32]
    case 'local': return [r * 0.42, hB * 1.55]
    case 'code': return [r * 0.7, hB * 0.98]
    default: return [r * 0.64, hB * 1.08]
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
  const ry = hh * 0.22, cy = -hh * 0.5, x0 = -w * 0.4, x1 = w * 0.4
  return [
    s('g', { transform: `rotate(-10 0 ${f1(cy)})` },
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
  ]
}
