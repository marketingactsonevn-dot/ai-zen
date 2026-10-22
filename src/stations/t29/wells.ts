import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { sliced } from '../../core/chunk'
import type { SceneCtx } from '../types'
import { blob, clamp, curve, onSize, rng, stableHeight, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist, moon, reeds } from '../../ui/part2/paint'
import { C } from './data'
import { t29Defs } from './figures'
import { f1, P } from './rig'
import { guide } from '../../ui/part2/guide'

const G = C.scenes.wells
const LEVELS = [10, 5, 1] // the wells' water in tenths: two long-term contracts (audit v3 29-2), each with its news
/** how thick the silver runs: to the wells, to the lake, per level */
const RUN_W = [1, 0.5, 0.15], RUN_L = [1, 2.2, 3.6]

type Well = { cx: number; cy: number; rx: number; ry: number; hc: number; i: number; via: Pt[] }
interface Geo {
  W: number
  H: number
  wide: boolean
  moon: [number, number, number]
  hz: number
  lake: { cx: number; cy: number; rx: number; ry: number }
  brow: Pt[]
  /** the sluice: x, the slab's foot y, the slab w × h */
  gate: { x: number; y: number; w: number; h: number }
  wells: Well[]
  /** the memory-chip factory on the far right hill: foot centre, width */
  factory: { x: number; y: number; w: number }
  /** the flume from the factory down to the gate: its waypoints (trestles under each) */
  flume: Pt[]
  /** the run to the lake: from the gate over the brow and down into the water */
  run: Pt[]
  /** the stone on the brow that names the lake: foot centre, width */
  sign: { x: number; y: number; w: number }
  /** where the news is written in the sky: left, top, width */
  say: { x: number; y: number; w: number }
}

/** Where everything stands (px in the art): a landscape and a portrait composition of the same hill. The lake fills the
 *  band under the far hills; the factory stands on the right hill and feeds the sluice at the right third by a flume; the
 *  wells lie on a curve, the phone's near left and biggest, the laptop's in the middle, the graphics card's far right. */
function geo(W: number, H: number): Geo {
  const wide = W / H > 1.15
  const X = (k: number) => k * W, Y = (k: number) => k * H
  const well = (x: number, y: number, r: number, i: number, via: Pt[]): Well => {
    const ry = r * 0.6, hc = r * 0.3
    return { cx: X(x), cy: Math.min(Y(y), H * 0.965 - ry * 0.87 - 6), rx: r, ry, hc, i, via: via.map(([a, b]) => [X(a), Y(b)] as Pt) }
  }
  const pts = (a: Pt[]) => a.map(([x, y]) => [X(x), Y(y)] as Pt)
  if (wide) {
    const sw = clamp(X(0.062), 80, 110)
    return {
      W, H, wide,
      moon: [X(0.5), Y(0.085), Math.min(W, H) * 0.034],
      hz: Y(0.215),
      lake: { cx: X(0.36), cy: Y(0.3), rx: X(0.3), ry: Y(0.052) },
      brow: pts([[-0.02, 0.43], [0.14, 0.44], [0.3, 0.452], [0.46, 0.47], [0.56, 0.49], [0.64, 0.5], [0.72, 0.49], [0.82, 0.46], [0.92, 0.44], [1.02, 0.43]]),
      gate: { x: X(0.655), y: Y(0.6), w: sw, h: sw * 0.56 },
      wells: [
        well(0.19, 0.8, Math.min(X(0.11), Y(0.21)), 0, [[0.3, 0.7], [0.45, 0.66], [0.58, 0.635]]),
        well(0.43, 0.67, Math.min(X(0.072), Y(0.14)), 1, [[0.52, 0.645], [0.6, 0.625]]),
        well(0.86, 0.62, Math.min(X(0.055), Y(0.11)), 2, [[0.78, 0.63], [0.71, 0.62]]),
      ],
      factory: { x: X(0.865), y: Y(0.3), w: X(0.17) },
      flume: pts([[0.8, 0.31], [0.765, 0.36], [0.735, 0.42], [0.705, 0.49], [0.68, 0.56]]),
      run: pts([[0.63, 0.56], [0.605, 0.525], [0.585, 0.496], [0.57, 0.345]]),
      sign: { x: X(0.13), y: Y(0.452), w: clamp(X(0.16), 180, 240) },
      say: { x: X(0.68), y: Y(0.035), w: clamp(X(0.29), 300, 400) },
    }
  }
  const sw = X(0.21)
  return {
    W, H, wide,
    moon: [X(0.14), Y(0.215), W * 0.045],
    hz: Y(0.24),
    lake: { cx: X(0.4), cy: Y(0.3), rx: X(0.42), ry: Y(0.03) },
    brow: pts([[-0.02, 0.385], [0.2, 0.39], [0.4, 0.4], [0.55, 0.415], [0.7, 0.41], [0.85, 0.395], [1.02, 0.385]]),
    gate: { x: X(0.6), y: Y(0.52), w: sw, h: sw * 0.6 },
    wells: [
      well(0.3, 0.83, X(0.24), 0, [[0.36, 0.68], [0.5, 0.58], [0.56, 0.55]]),
      well(0.2, 0.58, X(0.13), 1, [[0.36, 0.55], [0.5, 0.535]]),
      well(0.84, 0.62, X(0.1), 2, [[0.76, 0.58], [0.68, 0.55]]),
    ],
    factory: { x: X(0.8), y: Y(0.315), w: X(0.36) },
    flume: pts([[0.7, 0.33], [0.67, 0.39], [0.645, 0.45], [0.63, 0.49]]),
    run: pts([[0.56, 0.48], [0.535, 0.44], [0.515, 0.404], [0.5, 0.318]]),
    sign: { x: X(0.26), y: Y(0.392), w: X(0.46) },
    say: { x: X(0.05), y: Y(0.02), w: X(0.9) },
  }
}

/**
 * Hồ lớn hút giếng nhỏ (2.5D, painted in four depth layers, HIGH): the camera stands on the hilltop right behind three
 * stone wells and looks down into their mouths, where the moon sits on the water. The memory-chip factory's sluice stands
 * in the dip of the brow: one source feeding both jointed bamboo kakehi out to the wells and, beyond the brow, the great
 * lake (AI data centres, named on its shore) at the bottom of the misty valley. Drag the sluice's slab up (or press it):
 * each lift is a long-term contract, twice: the run to the lake thickens and lights another row of halls, the runs to the
 * wells thin and their water sinks into the shaft until the bottoms are moss. The news is written in the sky, no card.
 */
export function wellsScene(ctx: SceneCtx) {
  t29Defs()
  let lv = 0
  const layer = (name: string, ...kids: Node[]) => h('div', { class: `t29w-layer t29w-${name}` }, ...kids)
  const sky = s('svg', { 'aria-hidden': 'true' })
  const valley = s('svg', { 'aria-hidden': 'true' })
  const ground = s('svg', { 'aria-hidden': 'true' })
  const nearBack = s('svg', { 'aria-hidden': 'true' })
  const nearFront = s('svg', { 'aria-hidden': 'true' })
  const slab = h('button', { class: 't29w-slab', type: 'button', 'aria-label': G.gateAria }, h('span', { class: 't29w-slab-text' }, G.gate))
  const noteBody = h('div', { class: 't29w-say-body' })
  const notice = h('div', { class: 't29w-say' }, noteBody)
  const near = layer('near', nearBack, slab, nearFront)
  const layers = [layer('sky', sky), layer('valley', valley), layer('ground', ground), near]
  const sr = h('ul', { class: 'visually-hidden' })
  const root = h('div', { class: 't29w', role: 'group', 'aria-label': G.art }, ...layers, notice, sr)
  ctx.art.append(root)
  const stableH = stableHeight(ctx, [G.insight as Fact])
  ctx.prompt(G.prompt)
  const gd = guide(ctx)
  const pull1 = gd.dot(slab, { dir: [0, -1] })
  const arrowUp = gd.gesture('drag-v', slab, { r: 30 })
  const contracts = gd.count(G.countTpl, LEVELS.length - 1, () => (g ? [g.gate.x, g.gate.y + g.gate.h * 0.56] : [0, 0]))
  contracts.el.classList.add('t29w-count')
  // H7: the slab twitches up a few px and drops back
  const invite = () => lv < LEVELS.length - 1 && !ctx.reduced && slab.animate([{ translate: '0 0' }, { translate: '0 -5px', offset: 0.35 }, { translate: '0 0' }], { duration: 650, easing: 'ease-in' })
  ctx.el.addEventListener('p2:idle', invite)
  ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', invite))
  const say = () => sr.replaceChildren(...G.wells.map((w) => h('li', null, fill(G.wellAria, { name: w.name, n: LEVELS[lv] }))))
  say()

  let g: Geo | null = null
  let waters: SVGGElement[] = []
  let rows: SVGElement[][] = []
  let lakeG: SVGGElement | null = null

  // the water in each well sinks: the disc shrinks toward the far wall of the shaft, the moon on it with it
  function set() {
    if (!g) return
    const t = 1 - LEVELS[lv] / 10
    waters.forEach((el) => (el.style.transform = `translateY(${f1(-Number(el.dataset.ry) * 0.62 * t)}px) scale(${(1 - 0.62 * t).toFixed(3)})`))
    root.classList.toggle('is-dry', lv === LEVELS.length - 1)
    rows.forEach((r, i) => r.forEach((el) => el.classList.toggle('on', i <= lv)))
    if (lakeG) lakeG.style.transform = `scale(${(1 + lv * 0.035).toFixed(3)}, ${(1 + lv * 0.06).toFixed(3)})`
    slab.style.setProperty('--y', `${f1(-lv * 0.4 * g.gate.h)}px`)
    root.style.setProperty('--kw', String(RUN_W[lv]))
    root.style.setProperty('--kl', String(RUN_L[lv]))
    root.dataset.level = String(lv)
  }

  function open() {
    if (lv >= LEVELS.length - 1) return
    lv++
    set()
    say()
    root.classList.remove('flow')
    void root.offsetWidth // restart the run of water
    root.classList.add('flow')
    if (lv <= G.facts.length) {
      noteBody.replaceChildren(ctx.fact(G.facts[lv - 1] as Fact, 'p', 't29w-fact'))
      if (!notice.hasAttribute('aria-live')) notice.setAttribute('aria-live', 'polite')
      root.classList.add('has-note')
    }
    contracts.set(lv)
    arrowUp.done()
    if (lv === LEVELS.length - 1) {
      pull1.done()
      contracts.done()
      slab.disabled = true
      ctx.insight(G.insight as Fact)
      ctx.chime('ok')
    } else ctx.chime('soft')
  }

  // the slab is heavy: it follows the pull with resistance; let go past a notch and it opens, else it drops back
  let pull: { id: number; y: number; d: number } | null = null
  slab.addEventListener('pointerdown', (e) => {
    if (e.button || slab.disabled) return
    slab.setPointerCapture(e.pointerId)
    pull = { id: e.pointerId, y: e.clientY, d: 0 }
    root.classList.add('is-pulling')
  })
  slab.addEventListener('pointermove', (e) => {
    if (!pull || e.pointerId !== pull.id || !g) return
    pull.d = clamp(pull.y - e.clientY, 0, g.gate.h * 0.9)
    slab.style.setProperty('--pull', `${f1(-pull.d * 0.55)}px`)
  })
  const drop = (e: PointerEvent) => {
    if (!pull || e.pointerId !== pull.id) return
    const d = pull.d
    pull = null
    root.classList.remove('is-pulling')
    slab.style.setProperty('--pull', '0px')
    if (d > 14) {
      slab.dataset.pulled = '1'
      open()
    }
  }
  slab.addEventListener('pointerup', drop)
  slab.addEventListener('pointercancel', drop)
  slab.addEventListener('click', () => {
    if (slab.dataset.pulled) return void delete slab.dataset.pulled
    open()
  })
  slab.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'PageUp') return
    e.preventDefault()
    open()
  })

  // hover parallax: four depths slide apart a little (transform only; not on touch, low or reduced)
  const shift = [0, 3, 6, 11]
  if (!ctx.reduced && ctx.quality !== 'low') {
    let rect: DOMRect | null = null
    root.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || pull) return
      rect ??= root.getBoundingClientRect()
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1, ny = ((e.clientY - rect.top) / rect.height) * 2 - 1
      layers.forEach((l, i) => (l.style.transform = `translate3d(${f1(-nx * shift[i])}px,${f1(-ny * shift[i] * 0.4)}px,0)`))
    })
    root.addEventListener('pointerleave', () => {
      rect = null
      layers.forEach((l) => (l.style.transform = ''))
    })
  }

  let job: { cancel(): void } | null = null
  let built = false
  ctx.onCleanup(() => job?.cancel())
  function layout() {
    const W = ctx.art.clientWidth
    const H = stableH(ctx.art.clientHeight)
    if (W < 60 || H < 60) return
    root.style.height = `${f1(H)}px`
    g = geo(W, H)
    for (const svg of [sky, valley, ground, nearBack, nearFront]) svg.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    const { gate, say } = g
    Object.assign(slab.style, { left: `${f1(gate.x - gate.w / 2)}px`, top: `${f1(gate.y - gate.h)}px`, width: `${f1(gate.w)}px`, height: `${f1(gate.h)}px` })
    Object.assign(notice.style, { left: `${f1(say.x)}px`, top: `${f1(say.y)}px`, width: `${f1(say.w)}px` })
    root.classList.toggle('tall', !g.wide)
    const had = document.activeElement === slab
    job?.cancel()
    job = sliced(paint(g), { sync: ctx.reduced || built })
    if (had) slab.focus({ preventScroll: true })
    built = true
    gd.refresh()
  }

  function* paint(g: Geo) {
    sky.replaceChildren(...skyArt(g))
    yield
    const v = valleyArt(g)
    valley.replaceChildren(...v.els)
    rows = v.rows
    lakeG = v.lake
    yield
    ground.replaceChildren(...groundArt(g))
    yield
    nearBack.replaceChildren(...gateBack(g))
    const n = nearArt(g)
    nearFront.replaceChildren(...n.els)
    waters = n.waters
    set()
    gd.refresh()
  }

  ctx.onCleanup(onSize(ctx.art, layout))
}

// ── the paintings (static SVG per layout; colours are tokens; nothing that moves carries a filter)

function skyArt({ W, H, moon: [mx, my, mr], hz }: Geo): SVGElement[] {
  return [
    moon(mx, my, mr, 2921, true),
    mist(W * 0.5, hz - H * 0.06, W * 0.7, H * 0.13),
    hills(-W * 0.05, W * 1.05, hz, H * 0.15, 2923, 0.92, 7),
    hills(W * 0.08, W * 0.46, hz + H * 0.01, H * 0.09, 2924, 0.78, 3),
    mist(W * 0.5, hz + H * 0.01, W * 0.8, H * 0.05),
  ]
}

/** The valley: the great lake filling the band under the far hills, the data-centre halls along its far shore in three
 *  terraces (one more lit per contract, every light doubled straight down in the water), the moon's broken road; the right
 *  hill rising to the memory-chip factory (its name on its wall, a spout feeding the flume); the run to the lake going down
 *  the far slope and pouring in; mist hiding the drop below the brow. */
function valleyArt(g: Geo): { els: SVGElement[]; rows: SVGElement[][]; lake: SVGGElement } {
  const { W, H, lake: L, moon: [mx], wide } = g
  const q = rng(2930)
  const rows: SVGElement[][] = []
  const halls: SVGElement[] = []
  const refl: SVGElement[] = []
  for (let row = 0; row < 3; row++) {
    const y = L.cy - L.ry * 0.78 - row * H * (wide ? 0.017 : 0.013)
    const span = L.rx * (0.7 - row * 0.1), x0 = L.cx - L.rx * 0.08 - span
    const n = (wide ? 7 : 5) + row
    let walls = '', roofs = '', wins = '', lamps = '', rf = ''
    for (let j = 0; j < n; j++) {
      const hw = (span * 2 * (0.62 + q() * 0.3)) / n, hh = H * (0.014 + q() * 0.008) * (1 - row * 0.1)
      const x = x0 + ((span * 2) * (j + 0.5)) / n - hw / 2 + (q() - 0.5) * 6
      walls += `M${f1(x)} ${f1(y)}h${f1(hw)}v${f1(-hh)}h${f1(-hw)}Z`
      roofs += `M${f1(x - 1.5)} ${f1(y - hh)}h${f1(hw + 3)}l${f1(-hw * 0.06)} ${f1(-hh * 0.3)}h${f1(-hw * 0.88 - 3)}Z`
      const nw = Math.max(3, Math.round(hw / 8))
      for (let k = 0; k < nw; k++) if (q() > 0.15) wins += `M${f1(x + hw * 0.08 + ((hw * 0.84) * k) / nw)} ${f1(y - hh * 0.62)}h${f1(((hw * 0.84) / nw) * 0.5)}v${f1(hh * 0.28)}h${f1(-((hw * 0.84) / nw) * 0.5)}Z`
      if (row === 0) for (let k = 0; k < 3; k++) {
        const xx = x + hw * (0.2 + k * 0.3)
        rf += stroke([[xx, L.cy - L.ry * 0.62 + k], [xx + (q() - 0.5) * 2, L.cy - L.ry * 0.62 + L.ry * (0.8 + q() * 0.7)]], Math.max(1.2, hw * 0.07), 0.05, 0.7, 0.1)
      }
    }
    for (let x = x0; x < x0 + span * 2; x += W * 0.011 + q() * W * 0.006) lamps += `M${f1(x)} ${f1(y + 1.6)}h${f1(1.8)}`
    const glow = s('ellipse', { class: 't29w-row-glow', cx: f1(x0 + span), cy: f1(y - H * 0.006), rx: f1(span * 1.05), ry: f1(H * 0.022), fill: 'url(#t29-lamp)' })
    const win = s('path', { class: 't29w-win', d: wins })
    const lamp = s('path', { class: 't29w-lamps', d: lamps })
    const rfl = s('path', { class: 't29w-refl', d: rf })
    halls.unshift(s('g', { class: `t29w-row t29w-row-${row}` }, s('path', { class: 't29w-hall', d: walls }), s('path', { class: 't29w-hall-roof', d: roofs }), glow, win, lamp))
    refl.push(rfl)
    rows.push([glow, win, lamp, rfl])
  }
  let road = ''
  for (let y = L.cy - L.ry * 0.5; y < L.cy + L.ry * 0.95; y += L.ry * (0.12 + q() * 0.1)) {
    const near = (y - L.cy + L.ry) / (2 * L.ry), len = L.rx * (0.03 + near * 0.07) * (0.6 + q())
    const x = mx + (q() - 0.5) * L.rx * 0.1 - len / 2
    road += stroke([[x, y], [x + len, y + (q() - 0.5)]], L.ry * (0.05 + near * 0.06), 0.25, 0.25, 0.1)
  }
  let rip = ''
  for (let i = 0; i < 40; i++) {
    const y = L.cy + (q() - 0.35) * L.ry * 1.5, len = L.rx * (0.02 + q() * 0.06)
    const x = L.cx + (q() - 0.5) * L.rx * 1.6
    rip += stroke([[x, y], [x + len, y + (q() - 0.5)]], 0.8 + q(), 0.3, 0.3, 0.1)
  }
  const water = blob(L.cx, L.cy, L.rx, L.ry, 2931, 0.03, 36)
  const lake = s('g', { class: 't29w-lake', style: `transform-origin:${f1(L.cx)}px ${f1(L.cy - L.ry)}px` },
    s('path', { class: 't29w-water', d: water, filter: 'url(#ink-wash)' }),
    s('path', { class: 'p2p-road', d: road }),
    s('path', { class: 'p2p-ripple', d: rip }),
    ...refl)
  const shore = blob(L.cx - L.rx * 0.08, L.cy - L.ry * 0.82, L.rx * 0.8, L.ry * 0.28, 2937, 0.08, 24)
  // the right hill and the factory on its shoulder
  const F = g.factory
  const hillR = `M${f1(F.x - F.w * (wide ? 1.6 : 1.2))} ${f1(H * 0.56)}C${f1(F.x - F.w * 1.0)} ${f1(F.y + H * 0.02)} ${f1(F.x - F.w * 0.7)} ${f1(F.y + H * 0.004)} ${f1(F.x - F.w * 0.3)} ${f1(F.y + H * 0.004)}L${f1(W * 1.04)} ${f1(F.y - H * 0.012)}L${f1(W * 1.04)} ${f1(H * 0.56)}Z`
  const fh = F.w * 0.34, fx0 = F.x - F.w / 2
  let saw = ''
  for (let i = 0; i < 5; i++) saw += `l${f1(F.w / 10)} ${f1(-fh * 0.32)}l${f1(F.w / 10)} ${f1(fh * 0.32)}`
  const hall = `M${f1(fx0)} ${f1(F.y)}V${f1(F.y - fh * 0.7)}${saw}V${f1(F.y)}Z`
  const stack = `M${f1(fx0 + F.w * 0.84)} ${f1(F.y - fh * 0.9)}v${f1(-fh * 0.75)}h${f1(F.w * 0.045)}v${f1(fh * 0.75)}Z`
  let fwins = ''
  for (let i = 0; i < 10; i++) if (q() > 0.25) fwins += `M${f1(fx0 + F.w * (0.05 + i * 0.095))} ${f1(F.y - fh * 0.6)}h${f1(F.w * 0.035)}v${f1(fh * (0.08 + q() * 0.06))}h${f1(-F.w * 0.035)}Z`
  const fs = clamp(F.w * (wide ? 0.068 : 0.075), 10, 15)
  // the run comes over the brow (the far slope hides it) and out of the bank as a spout pouring into the lake
  const sp = g.run[g.run.length - 1], spw = Math.max(3, H * 0.007)
  const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number): Pt[] => Array.from({ length: 13 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / 12) * Math.PI) / 180
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as Pt
  })
  const els: SVGElement[] = [
    mist(L.cx, L.cy - L.ry * 2.6, L.rx * 1.4, H * 0.04),
    s('path', { class: 't29w-shore', d: shore, filter: 'url(#ink-wash)' }),
    ...halls,
    lake,
    s('path', { class: 't29w-pebble', d: Array.from({ length: 30 }, (_, i) => { const a = Math.PI * (0.08 + q() * 0.84); return blob(L.cx + Math.cos(a) * L.rx * (1 + q() * 0.03), L.cy + Math.sin(a) * L.ry * (1.05 + q() * 0.2), 2 + q() * 4, 1 + q() * 1.6, 2933 + i, 0.2, 7) }).join('') }),
    reeds(L.cx - L.rx * 0.9, L.cy + L.ry * 0.7, H * 0.03, 2936, 6),
    mist(L.cx, L.cy + L.ry * 1.2, L.rx * 1.2, L.ry * 1.4),
    // where the run pours in beyond the brow: rings spreading on the water by the near shore
    s('path', { class: 't29w-spill', d: stroke(arc(sp[0], sp[1] - L.ry * 0.15, spw * 3, spw * 0.8, 200, 340), 1.2, 0.2, 0.2, 0.2) + stroke(arc(sp[0], sp[1] - L.ry * 0.15, spw * 6, spw * 1.5, 205, 335), 1, 0.3, 0.3, 0.2) }),
    s('path', { class: 't29w-hillR', d: hillR, filter: 'url(#ink-wash)' }),
    s('path', { class: 't29w-hillR-shade', d: hillR, fill: 'url(#t29-dusk)' }),
    s('ellipse', { class: 't29w-contact', cx: f1(F.x + F.w * 0.06), cy: f1(F.y + 1), rx: f1(F.w * 0.6), ry: f1(H * 0.008) }),
    s('path', { class: 't29w-fab', d: hall + stack }),
    s('path', { class: 't29w-fab-rim', d: stroke([[fx0, F.y - fh * 0.7], [fx0 + F.w * 0.1, F.y - fh * 1.02]], 1.4, 0.1, 0.1, 0.3) }),
    s('path', { class: 't29w-fab-win', d: fwins }),
    // its name painted on a board along the wall
    s('rect', { class: 't29w-fab-board', x: f1(fx0 + F.w * 0.08), y: f1(F.y - fh * 0.38), width: f1(F.w * 0.84), height: f1(fs * 1.35), rx: 1 }),
    s('text', { class: 't29w-source', x: f1(F.x), y: f1(F.y - fh * 0.38 + fs * 1.02), 'text-anchor': 'middle', 'font-size': f1(fs) }, G.source),
    mist(W * 0.5, g.brow[Math.floor(g.brow.length / 2)][1] - H * 0.03, W * 0.6, H * 0.04),
  ]
  return { els, rows, lake }
}

/** The hilltop: moss and grass under the moon, lighter toward its brow (the moon is beyond), stones, a crisp edge with
 *  tufts where it drops away. */
function groundArt(g: Geo): SVGElement[] {
  const { W, H, brow } = g
  const q = rng(2940)
  const top = `M${brow.map(P).join('L')}L${f1(W * 1.02)} ${f1(H * 1.02)}L${f1(-W * 0.02)} ${f1(H * 1.02)}Z`
  const yAt = (x: number) => {
    for (let i = 1; i < brow.length; i++) if (x <= brow[i][0]) {
      const [a, b] = [brow[i - 1], brow[i]]
      return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0])
    }
    return brow[brow.length - 1][1]
  }
  let tufts = '', patches = '', grain = ''
  for (let i = 0; i < 260; i++) {
    const x = q() * W, y0 = yAt(x), y = y0 + Math.pow(q(), 0.7) * (H - y0)
    const near = (y - y0) / (H - y0), l = 2 + near * 7
    tufts += stroke([[x, y], [x + (q() - 0.5) * l * 0.6, y - l]], 0.8 + near * 1.6, 0.1, 0.6, 0.2)
  }
  for (let i = 0; i < 18; i++) {
    const x = q() * W, y0 = yAt(x), y = y0 + (0.1 + q() * 0.9) * (H - y0)
    patches += blob(x, y, W * (0.03 + q() * 0.05), H * (0.008 + q() * 0.012), 2941 + i, 0.25, 14)
  }
  for (let i = 0; i < 500; i++) {
    const x = q() * W, y0 = yAt(x), y = y0 + q() * (H - y0)
    grain += `M${f1(x)} ${f1(y)}h${f1(1 + q() * 1.5)}`
  }
  // the hilltop is a shallow bowl draining into the notch: broken contour strokes that sag toward the sluice
  let contours = ''
  const dip = brow.reduce((a, b) => (b[1] > a[1] ? b : a))
  for (let k = 1; k <= 6; k++) {
    const e = brow[0][1] + k * H * (g.wide ? 0.05 : 0.045), m = dip[1] + k * H * (g.wide ? 0.034 : 0.03)
    const pts = curve([-W * 0.02, e], [dip[0], m + (m - e) * 0.9], [W * 1.02, e - H * 0.01], 40)
    for (let i = 0; i < pts.length - 3; i += 3 + Math.floor(q() * 4)) {
      const seg = pts.slice(i, i + 2 + Math.floor(q() * 3))
      if (seg.length > 1 && q() > 0.25) contours += stroke(seg, 0.8 + k * 0.25, 0.3, 0.3, 0.1)
    }
  }
  // tufts on the very edge, silhouetted against the mist
  const edge: SVGElement[] = []
  for (let x = W * 0.03; x < W; x += W * (0.06 + q() * 0.07)) if (Math.abs(x - g.gate.x) > g.gate.w * 1.4) edge.push(grass(x, yAt(x) + 2, H * (0.022 + q() * 0.02), 2950 + Math.round(x)))
  const rocks: SVGElement[] = []
  for (const [x, dy, w] of (g.wide ? [[0.33, 0.03, 0.03], [0.985, 0.2, 0.05], [0.7, 0.4, 0.045], [0.745, 0.42, 0.02], [0.04, 0.34, 0.04]] : [[0.62, 0.04, 0.05], [0.95, 0.4, 0.07], [0.8, 0.5, 0.06]]) as [number, number, number][]) {
    const cx = W * x, cy = yAt(cx) + H * dy, rw = W * w * (g.wide ? 1 : 1.6)
    rocks.push(s('g', { transform: `translate(${f1(cx)} ${f1(cy)})` }, stoneArt(rw * 1.6, rw * 0.62, 2960 + Math.round(x * 100))))
  }
  // reeds in clumps where the ground is damp (by the wells, the basin), and darker sward in swathes
  const reedy: SVGElement[] = []
  for (const w of g.wells) reedy.push(reeds(w.cx - w.rx * 1.05, w.cy + w.ry * 0.3 + w.hc, w.rx * 0.5, 2955 + w.i, 5))
  reedy.push(reeds(g.gate.x + g.gate.w * 1.4, g.gate.y + g.gate.h * 0.8, g.gate.h * 1.2, 2958, 4))
  let swathes = ''
  for (let i = 0; i < 7; i++) {
    const x = q() * W, y0 = yAt(x), y = y0 + (0.2 + q() * 0.7) * (H - y0)
    swathes += blob(x, y, W * (0.08 + q() * 0.1), H * (0.02 + q() * 0.03), 2945 + i, 0.3, 16)
  }
  // the stone that names the lake, on the brow above it, its name carved on its face
  const sg = g.sign, sh0 = sg.w * 0.3
  const fs = clamp(sg.w * (g.wide ? 0.075 : 0.07), 11, 16)
  const sign = s('g', { class: 't29w-sign' },
    s('ellipse', { class: 't29w-contact', cx: f1(sg.x + sg.w * 0.06), cy: f1(sg.y + 1), rx: f1(sg.w * 0.56), ry: f1(sh0 * 0.16) }),
    s('g', { transform: `translate(${f1(sg.x)} ${f1(sg.y)})` }, stoneArt(sg.w, sh0, 2964)),
    s('text', { class: 't29w-carve-lip', x: f1(sg.x - sg.w * 0.03), y: f1(sg.y - sh0 * 0.3 + 1), 'text-anchor': 'middle', 'font-size': f1(fs) }, G.lake),
    s('text', { class: 't29w-carve t29w-lake-name', x: f1(sg.x - sg.w * 0.03), y: f1(sg.y - sh0 * 0.3), 'text-anchor': 'middle', 'font-size': f1(fs) }, G.lake))
  // the flume from the factory: a plank trough on trestles stepping down to the gate, water in it
  const fl = smooth(g.flume)
  const fw = (y: number) => clamp(H * 0.006 + ((y - g.flume[0][1]) / (g.gate.y - g.flume[0][1])) * H * 0.012, 3, 14)
  let trough = '', legs = '', inner = ''
  for (let i = 0; i < fl.length - 1; i++) {
    const [x, y] = fl[i], [x1, y1] = fl[i + 1], w = fw(y)
    trough += stroke([[x, y], [x1, y1]], w * 1.4, 0.02, 0.02, 0.9)
    inner += stroke([[x, y - w * 0.25], [x1, y1 - w * 0.25]], w * 0.5, 0.02, 0.02, 0.9)
  }
  const legAt = resample(fl, Math.max(4, Math.round(len(fl) / (W * (g.wide ? 0.035 : 0.07))))).slice(0, -1)
  for (const [x, y] of legAt) {
    const w = fw(y), lh = w * 3.2
    legs += stroke([[x - w * 1.2, y + lh], [x, y]], Math.max(1, w * 0.25), 0.05, 0.05, 0.6) + stroke([[x + w * 1.2, y + lh], [x, y]], Math.max(1, w * 0.25), 0.05, 0.05, 0.6) + stroke([[x - w * 0.8, y + lh * 0.6], [x + w * 0.8, y + lh * 0.6]], Math.max(0.8, w * 0.18), 0.05, 0.05, 0.6)
  }
  const legFeet = legAt.map(([x, y]) => blob(x, y + fw(y) * 3.2, fw(y) * 1.8, fw(y) * 0.4, 2966 + Math.round(x), 0.1, 10)).join('')
  // the run to the lake, near part: from the gate up over the brow, a thick cane on stakes (it swells with each contract)
  const near = smooth(g.run.slice(0, 3))
  let stakes = ''
  for (const [x, y] of g.run.slice(1, 3)) stakes += stroke([[x - 6, y + 14], [x + 2, y - 2]], 2, 0.05, 0.05, 0.6) + stroke([[x + 6, y + 14], [x - 2, y - 2]], 2, 0.05, 0.05, 0.6)
  return [
    s('path', { class: 't29w-hill', d: top }),
    s('path', { class: 't29w-hill-shade', d: top, fill: 'url(#t29-dusk)' }),
    s('path', { class: 't29w-patch', d: patches }),
    s('path', { class: 't29w-grain', d: grain }),
    s('path', { class: 't29w-contour', d: contours }),
    s('path', { class: 't29w-tuft', d: tufts }),
    s('path', { class: 't29w-brow', d: stroke(brow, H * 0.006, 0.05, 0.05, 0.4), filter: 'url(#ink-rough)' }),
    s('path', { class: 't29w-brow-rim', d: stroke(brow.map(([x, y]) => [x, y - 1.6] as Pt), H * 0.003, 0.1, 0.1, 0.3) }),
    s('path', { class: 't29w-swathe', d: swathes }),
    s('path', { class: 't29w-contact', d: legFeet }),
    s('path', { class: 't29w-stake', d: legs }),
    s('path', { class: 't29w-trough', d: trough }),
    s('path', { class: 't29w-trough-water', d: inner }),
    s('path', { class: 't29w-flow t29w-flow-flume', d: `M${fl.map(P).join('L')}`, style: `--len:${f1(len(fl))}` }),
    s('path', { class: 't29w-stake', d: stakes }),
    s('path', { class: 't29w-run', d: `M${near.map(P).join('L')}` }),
    s('path', { class: 't29w-run-rim', d: `M${near.map(([x, y]) => P([x, y - 2])).join('L')}` }),
    sign,
    ...rocks,
    ...reedy,
    ...edge,
  ]
}

/** The sluice behind its slab: two grooved stone posts, a lintel, the dark race the slab uncovers (water runs in it). */
function gateBack(g: Geo): SVGElement[] {
  const { gate: { x, y, w, h: sh }, H } = g
  const pw = w * 0.3, ph = sh * 2.3, lh = sh * 0.36
  const post = (cx: number, seed: number) => {
    const d = `M${f1(cx - pw / 2)} ${f1(y + sh * 0.2)}L${f1(cx - pw * 0.46)} ${f1(y - ph)}L${f1(cx + pw * 0.48)} ${f1(y - ph - 1)}L${f1(cx + pw / 2)} ${f1(y + sh * 0.2)}Z`
    const r = rng(seed)
    return [
      s('path', { class: 't29w-stone', d }),
      s('path', { class: 't29w-stone-shade', d, fill: 'url(#t29-cyl)' }),
      s('path', { class: 't29w-stone-grain', d: stroke([[cx - pw * 0.2, y - ph * (0.3 + r() * 0.2)], [cx + pw * 0.1, y - ph * (0.36 + r() * 0.2)]], 1.2, 0.3, 0.3, 0.2) + stroke([[cx - pw * 0.3, y - ph * 0.75], [cx, y - ph * 0.8]], 1, 0.3, 0.3, 0.2) }),
      s('path', { class: 't29w-ink', d: stroke([[cx - pw / 2, y + sh * 0.2], [cx - pw * 0.46, y - ph]], Math.max(1.6, pw * 0.07), 0.05, 0.05, 0.5), filter: 'url(#ink-rough)' }),
      s('path', { class: 't29w-rim', d: stroke([[cx + pw * 0.44, y - ph + 2], [cx + pw * 0.46, y]], Math.max(1.2, pw * 0.05), 0.1, 0.4, 0.2) }),
    ]
  }
  const L = x - w / 2 - pw / 2, R = x + w / 2 + pw / 2
  const lintel = `M${f1(L - pw * 0.7)} ${f1(y - ph + lh * 0.2)}Q${f1(x)} ${f1(y - ph - lh * 0.15)} ${f1(R + pw * 0.7)} ${f1(y - ph + lh * 0.2)}L${f1(R + pw * 0.62)} ${f1(y - ph - lh)}Q${f1(x)} ${f1(y - ph - lh * 1.35)} ${f1(L - pw * 0.62)} ${f1(y - ph - lh)}Z`
  let race = ''
  for (let i = 0; i < 5; i++) race += stroke([[x - w * 0.4 + i * w * 0.2, y - sh * 0.95], [x - w * 0.42 + i * w * 0.2, y]], Math.max(1, w * 0.02), 0.2, 0.2, 0.3)
  return [
    s('ellipse', { class: 't29w-contact', cx: f1(x), cy: f1(y + sh * 0.25), rx: f1(w * 1.3), ry: f1(H * 0.012) }),
    // the race: the dark slot the slab rides in (lift it and water shows under it); above it the gate is open to the mist
    s('rect', { class: 't29w-race', x: f1(x - w / 2), y: f1(y - sh * 1.05), width: f1(w), height: f1(sh * 1.15) }),
    s('path', { class: 't29w-groove', d: `M${f1(x - w / 2 + 1.5)} ${f1(y - ph + lh * 0.4)}V${f1(y)}M${f1(x + w / 2 - 1.5)} ${f1(y - ph + lh * 0.4)}V${f1(y)}` }),
    s('path', { class: 't29w-race-water', d: race }),
    ...post(L, 2970),
    ...post(R, 2971),
    s('path', { class: 't29w-stone', d: lintel }),
    s('path', { class: 't29w-stone-shade', d: lintel, fill: 'url(#t29-dusk)' }),
    s('path', { class: 't29w-ink', d: stroke(curve([L - pw * 0.7, y - ph + lh * 0.2], [x, y - ph - lh * 0.15], [R + pw * 0.7, y - ph + lh * 0.2], 12), Math.max(1.6, lh * 0.14), 0.1, 0.1, 0.4), filter: 'url(#ink-rough)' }),
    s('path', { class: 't29w-rim', d: stroke(curve([L - pw * 0.5, y - ph - lh * 1.02], [x, y - ph - lh * 1.4], [R + pw * 0.5, y - ph - lh * 1.02], 12), Math.max(1.2, lh * 0.1), 0.2, 0.2, 0.2) }),
  ]
}

const len = (pts: Pt[]) => pts.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0)
/** A smooth run through waypoints: quadratic arcs between their midpoints, each waypoint its control. */
function smooth(pts: Pt[]): Pt[] {
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const out: Pt[] = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) out.push(...curve(i === 1 ? pts[0] : mid(pts[i - 1], pts[i]), pts[i], i === pts.length - 2 ? pts[i + 1] : mid(pts[i], pts[i + 1]), 12).slice(1))
  if (pts.length === 2) out.push(pts[1])
  return out
}
/** n + 1 points evenly spaced along a polyline. */
function resample(pts: Pt[], n: number): Pt[] {
  const L = len(pts)
  const out: Pt[] = [pts[0]]
  let i = 1, acc = 0
  for (let j = 1; j < n; j++) {
    const want = (L * j) / n
    while (i < pts.length - 1 && acc + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) < want) acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]), i++
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) || 1, t = clamp((want - acc) / seg, 0, 1)
    out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t])
  }
  out.push(pts[pts.length - 1])
  return out
}

/** In front of the slab: the stone basin, the kakehi from each well (jointed, stepping down at each joint onto the next,
 *  on crossed stakes that grow taller as the ground falls toward the gate), the wells themselves, the near grass. */
function nearArt(g: Geo): { els: SVGElement[]; waters: SVGGElement[] } {
  const { W, H, gate } = g
  const q = rng(2980)
  const bw = gate.w * 2.1, bh = gate.h * 0.42, bd = gate.h * 0.34
  const bx = gate.x, by = gate.y
  const basinTop = `M${f1(bx - bw / 2)} ${f1(by)}L${f1(bx + bw / 2)} ${f1(by)}L${f1(bx + bw / 2 + bd * 0.3)} ${f1(by + bd)}L${f1(bx - bw / 2 - bd * 0.3)} ${f1(by + bd)}Z`
  const basinFront = `M${f1(bx - bw / 2 - bd * 0.3)} ${f1(by + bd)}L${f1(bx + bw / 2 + bd * 0.3)} ${f1(by + bd)}L${f1(bx + bw / 2 + bd * 0.28)} ${f1(by + bd + bh)}L${f1(bx - bw / 2 - bd * 0.28)} ${f1(by + bd + bh)}Z`
  const els: SVGElement[] = [
    s('ellipse', { class: 't29w-contact', cx: f1(bx + bw * 0.06), cy: f1(by + bd + bh), rx: f1(bw * 0.64), ry: f1(bh * 0.4) }),
    s('path', { class: 't29w-stone', d: basinTop }),
    s('path', { class: 't29w-basin-water', d: blob(bx, by + bd * 0.52, bw * 0.44, bd * 0.32, 2981, 0.05, 14) }),
    s('path', { class: 't29w-stone t29w-stone-front', d: basinFront }),
    s('path', { class: 't29w-stone-shade', d: basinFront, fill: 'url(#t29-cyl)' }),
    s('path', { class: 't29w-ink', d: stroke([[bx - bw / 2 - bd * 0.3, by + bd], [bx + bw / 2 + bd * 0.3, by + bd]], Math.max(1.4, bh * 0.08), 0.05, 0.05, 0.5), filter: 'url(#ink-rough)' }),
  ]
  const waters: SVGGElement[] = []
  // the wells from the back to the front; each one's pipe first (it lies on the ground behind the well)
  const order = [...g.wells].sort((a, b) => a.cy - b.cy)
  const pipes: SVGElement[] = []
  const flows: SVGElement[] = []
  for (const w of order) {
    // which inlet of the basin: by where the pipe arrives from
    const k = clamp(Math.round((w.via[w.via.length - 1][0] - bx) / (bw * 0.3)), -1, 1)
    const th = Math.atan2((w.via[0][1] - w.cy) / w.ry, (w.via[0][0] - w.cx) / w.rx)
    const a: Pt = [w.cx + Math.cos(th) * w.rx * 0.9, w.cy + Math.sin(th) * w.ry * 0.9]
    const b: Pt = [bx + k * bw * 0.3, by + bd * 0.45]
    const path = smooth([a, ...w.via, b])
    const L = len(path)
    const n = Math.max(2, Math.round(L / (g.wide ? W * 0.075 : W * 0.15)))
    const joints = resample(path, n)
    const wid = (y: number) => clamp(H * (g.wide ? 0.014 : 0.011) + ((y - by) / (w.cy - by)) * H * (g.wide ? 0.016 : 0.013), 5, 24)
    // downstream segments first (they are farther), each one a step lower than the one pouring into it
    const flowPts: Pt[] = []
    for (let j = n - 1; j >= 0; j--) {
      const step = j ? wid(joints[j][1]) * 0.55 : 0
      const p0: Pt = [joints[j][0], joints[j][1] + step], p1: Pt = joints[j + 1]
      const dx = p1[0] - p0[0], dy = p1[1] - p0[1], dl = Math.hypot(dx, dy) || 1
      const over: Pt = [p1[0] + (dx / dl) * wid(p1[1]) * 0.5, p1[1] + (dy / dl) * wid(p1[1]) * 0.5]
      const ww = wid((p0[1] + p1[1]) / 2)
      const nx = -dy / dl, ny = dx / dl
      const up = ny > 0 ? -1 : 1 // the side of the tube facing up-screen (toward the moon)
      const seg = [p0, over]
      // the stake under the far end of this segment: two crossed sticks, taller toward the gate
      const t = 1 - (p1[1] - by) / (w.cy - by)
      const sh = ww * (1.2 + t * 2.6)
      pipes.push(
        s('ellipse', { class: 't29w-contact', cx: f1(p1[0]), cy: f1(p1[1] + sh), rx: f1(ww * 1.6), ry: f1(ww * 0.45) }),
        s('path', { class: 't29w-stake', d: stroke([[p1[0] - ww * 1.0, p1[1] + sh], [p1[0] + ww * 0.5, p1[1] - ww * 0.6]], Math.max(1.2, ww * 0.22), 0.05, 0.05, 0.6) + stroke([[p1[0] + ww * 1.0, p1[1] + sh], [p1[0] - ww * 0.5, p1[1] - ww * 0.6]], Math.max(1.2, ww * 0.22), 0.05, 0.05, 0.6) }),
        s('path', { class: 't29w-cane', d: stroke(seg, ww, 0.02, 0.02, 0.9) }),
        s('path', { class: 't29w-cane-lo', d: stroke(seg.map(([x, y]) => [x - nx * up * ww * 0.26, y - ny * up * ww * 0.26] as Pt), ww * 0.42, 0.02, 0.02, 0.9) }),
        s('path', { class: 't29w-cane-rim', d: stroke(seg.map(([x, y]) => [x + nx * up * ww * 0.3, y + ny * up * ww * 0.3] as Pt), ww * 0.2, 0.1, 0.1, 0.4) }),
        s('path', { class: 't29w-node', d: stroke([[p0[0] + dx * 0.5 - nx * ww * 0.55, p0[1] + dy * 0.5 - ny * ww * 0.55], [p0[0] + dx * 0.5 + nx * ww * 0.55, p0[1] + dy * 0.5 + ny * ww * 0.55]], ww * 0.22, 0.1, 0.1, 0.5) }),
        // the cut mouth that pours into the next segment
        s('ellipse', { class: 't29w-mouth', cx: f1(over[0]), cy: f1(over[1]), rx: f1(ww * 0.42), ry: f1(ww * 0.3), transform: `rotate(${f1((Math.atan2(dy, dx) * 180) / Math.PI + 90)} ${f1(over[0])} ${f1(over[1])})` }))
      flowPts.unshift(p0, p1)
    }
    flowPts.reverse() // the water runs from the sluice out to the well
    flows.push(s('path', { class: 't29w-flow', d: `M${flowPts.map(P).join('L')}`, style: `--len:${f1(len(flowPts))};--w:${f1(wid(w.cy) * 0.32)}px` }))
  }
  els.push(...pipes, ...flows)
  for (const w of order) {
    const r = drawWell(w, q)
    els.push(...r.els)
    waters.push(r.water)
  }
  els.push(
    grass(W * 0.03, H * 1.01, H * 0.09, 2990),
    grass(W * 0.97, H * 1.01, H * 0.08, 2991),
    grass(W * (g.wide ? 0.34 : 0.04), H * (g.wide ? 0.97 : 0.8), H * 0.05, 2992))
  return { els, waters }
}

/** A stone well seen from above and behind: a curb of fitted blocks (top ring, a front face in courses), the dark shaft with
 *  its far wall in courses, the water disc with the moon on it (the group that sinks), moss at the bottom; the name carved
 *  small on the front of the curb. */
function drawWell(w: Well, q: () => number): { els: SVGElement[]; water: SVGGElement } {
  const { cx, cy, rx, ry, hc } = w
  const ri = rx * 0.78, riy = ry * 0.74
  const id = `t29w-m${w.i}`
  const arc = (rxx: number, ryy: number, a0: number, a1: number, dy = 0, n = 24): Pt[] =>
    Array.from({ length: n + 1 }, (_, i) => {
      const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180
      return [cx + Math.cos(a) * rxx, cy + dy + Math.sin(a) * ryy] as Pt
    })
  const ring = `M${arc(rx, ry, 0, 360, 0, 48).map(P).join('L')}ZM${arc(ri, riy, 360, 0, 0, 48).map(P).join('L')}Z`
  const front = `M${arc(rx, ry, 0, 180).map(P).join('L')}L${arc(rx, ry, 180, 0, hc).map(P).join('L')}Z`
  // block joints: radial on the ring, staggered courses on the face
  let joints = ''
  for (let a = 12; a < 360; a += 26 + q() * 8) {
    const c = Math.cos((a * Math.PI) / 180), sn = Math.sin((a * Math.PI) / 180)
    joints += `M${f1(cx + c * ri)} ${f1(cy + sn * riy)}L${f1(cx + c * rx)} ${f1(cy + sn * ry)}`
  }
  let courses = `M${arc(rx, ry, 4, 176, hc * 0.5).map(P).join('L')}`
  for (let row = 0; row < 2; row++)
    for (let a = 14 + row * 12; a < 176; a += 24 + q() * 6) {
      const c = Math.cos((a * Math.PI) / 180), sn = Math.sin((a * Math.PI) / 180)
      const y0 = cy + sn * ry + hc * row * 0.5
      joints += `M${f1(cx + c * rx)} ${f1(y0 + 1)}v${f1(hc * 0.5 - 2)}`
    }
  // the far inner wall in courses, falling into the dark
  let wall = ''
  for (let k = 1; k < 6; k++) wall += `M${arc(ri * (1 - k * 0.04), riy * (1 - k * 0.05), 190, 350, riy * k * 0.2).map(P).join('L')}`
  // the water: its disc, a sheen, the moon's reflection (with a soft halo), a ripple ring
  const wy = cy + riy * 0.1
  const water = s('g', { class: 't29w-wwater', 'data-ry': f1(riy), style: `transform-origin:${f1(cx)}px ${f1(cy - riy * 0.85)}px` },
    s('ellipse', { class: 't29w-wdisc', cx: f1(cx), cy: f1(wy), rx: f1(ri * 0.94), ry: f1(riy * 0.86) }),
    s('ellipse', { class: 't29w-wsky', cx: f1(cx - ri * 0.1), cy: f1(wy - riy * 0.2), rx: f1(ri * 0.7), ry: f1(riy * 0.5) }),
    s('circle', { cx: f1(cx + ri * 0.22), cy: f1(wy - riy * 0.12), r: f1(ri * 0.42), fill: 'url(#t29-glint)', class: 't29w-whalo' }),
    s('ellipse', { class: 't29w-wmoon', cx: f1(cx + ri * 0.22), cy: f1(wy - riy * 0.12), rx: f1(ri * 0.15), ry: f1(riy * 0.17) }),
    s('path', { class: 't29w-wripple', d: stroke(arc(ri * 0.62, riy * 0.5, 200, 330, riy * 0.12, 12), Math.max(0.8, ri * 0.02), 0.3, 0.3, 0.2) }))
  const name = G.wells[w.i].name
  // carved small into the front of the rim, following its curve
  const fs = clamp((ry - riy) * 0.62, 9.5, 14)
  const rr = (ry + riy) / 2 + fs * 0.34, rrx = (rx + ri) / 2
  const rimPath = `M${arc(rrx, rr, 150, 30, 0, 24).map(P).join('L')}`
  return {
    water,
    els: [
      s('ellipse', { class: 't29w-contact', cx: f1(cx + rx * 0.12), cy: f1(cy + ry * 0.55 + hc), rx: f1(rx * 1.18), ry: f1(ry * 0.62) }),
      s('defs', null, s('clipPath', { id }, s('ellipse', { cx: f1(cx), cy: f1(cy), rx: f1(ri), ry: f1(riy) }))),
      s('path', { class: 't29w-curb-face', d: front }),
      s('path', { class: 't29w-stone-shade', d: front, fill: 'url(#t29-cyl)' }),
      s('path', { class: 't29w-curb-top', d: ring, 'fill-rule': 'evenodd' }),
      s('g', { 'clip-path': `url(#${id})` },
        s('rect', { class: 't29w-shaft', x: f1(cx - ri), y: f1(cy - riy), width: f1(ri * 2), height: f1(riy * 2), fill: 'url(#t29-shaft)' }),
        s('path', { class: 't29w-shaft-course', d: wall }),
        s('path', { class: 't29w-wmoss', d: blob(cx, cy + riy * 0.15, ri * 0.4, riy * 0.3, 2995 + w.i, 0.3, 14) }),
        water),
      s('path', { class: 't29w-joint', d: joints + courses }),
      s('path', { class: 't29w-ink', d: stroke(arc(rx, ry, 8, 172, hc), Math.max(1.6, rx * 0.018), 0.15, 0.15, 0.3) + stroke(arc(ri, riy, 185, 355), Math.max(1.2, rx * 0.012), 0.2, 0.2, 0.3), filter: 'url(#ink-rough)' }),
      s('path', { class: 't29w-rim', d: stroke(arc(rx * 0.99, ry * 0.98, 200, 340), Math.max(1.2, rx * 0.014), 0.25, 0.25, 0.2) + stroke(arc(ri * 1.02, riy * 1.03, 20, 160), Math.max(1, rx * 0.01), 0.3, 0.3, 0.2) }),
      // carved: a light lip below each stroke, the cut itself dark
      s('path', { id: `${id}-rim`, d: rimPath, fill: 'none' }),
      s('text', { class: 't29w-carve-lip', 'font-size': f1(fs), transform: 'translate(0 1)' }, s('textPath', { href: `#${id}-rim`, startOffset: '50%', 'text-anchor': 'middle' }, name)),
      s('text', { class: 't29w-carve', 'font-size': f1(fs) }, s('textPath', { href: `#${id}-rim`, startOffset: '50%', 'text-anchor': 'middle' }, name)),
      grass(cx - rx * 1.02, cy + ry * 0.4 + hc, rx * 0.3, 2996 + w.i * 3),
      grass(cx + rx * 0.98, cy + ry * 0.5 + hc, rx * 0.22, 2997 + w.i * 3),
    ],
  }
}
