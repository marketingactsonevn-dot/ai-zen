import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { sliced } from '../../core/chunk'
import type { SceneCtx } from '../types'
import { blob, clamp, curve, onSize, rng, stableHeight, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist, moon, reeds } from '../../ui/part2/paint'
import { C } from './data'
import { t29Defs } from './figures'
import { f1, P } from './rig'

const G = C.scenes.wells
const LEVELS = [10, 6, 3, 1]

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
  /** the notice board: left, the foot of its posts, width */
  board: { x: number; y: number; w: number }
}

/** Where everything stands (px in the art): a landscape and a portrait composition of the same hill. Nothing symmetric:
 *  the sluice sits in the brow's dip left of centre, each pipe takes its own way round the ground to it. */
function geo(W: number, H: number): Geo {
  const wide = W / H > 1.15
  const X = (k: number) => k * W, Y = (k: number) => k * H
  // a well of radius r at (x, y), pulled up so its carved name stays inside the frame; via = the pipe's waypoints
  const well = (x: number, y: number, r: number, i: number, via: Pt[]): Well => {
    const ry = r * 0.6, hc = r * 0.3
    // the near wells may be cut by the frame's foot, but the name carved on the front of the rim stays in
    return { cx: X(x), cy: Math.min(Y(y), H * 0.965 - ry * 0.87 - 6), rx: r, ry, hc, i, via: via.map(([a, b]) => [X(a), Y(b)] as Pt) }
  }
  if (wide) {
    const r = Math.min(X(0.096), Y(0.19))
    const sw = clamp(X(0.068), 84, 116)
    return {
      W, H, wide,
      moon: [X(0.62), Y(0.1), Math.min(W, H) * 0.036],
      hz: Y(0.31),
      lake: { cx: X(0.47), cy: Y(0.405), rx: X(0.2), ry: Y(0.034) },
      // the brow dips hard where the sluice stands: the notch the water goes down through
      brow: ([[-0.02, 0.47], [0.12, 0.488], [0.25, 0.525], [0.35, 0.567], [0.41, 0.598], [0.44, 0.608], [0.48, 0.597], [0.56, 0.566], [0.68, 0.53], [0.84, 0.498], [1.02, 0.47]] as Pt[]).map(([x, y]) => [X(x), Y(y)]),
      gate: { x: X(0.44), y: Y(0.655), w: sw, h: sw * 0.56 },
      wells: [
        well(0.15, 0.79, r, 0, [[0.19, 0.67], [0.27, 0.7], [0.35, 0.675]]),
        well(0.83, 0.8, r * 1.04, 2, [[0.77, 0.68], [0.68, 0.715], [0.58, 0.7], [0.5, 0.675]]),
        well(0.54, 0.92, r * 1.18, 1, [[0.53, 0.775], [0.48, 0.74], [0.455, 0.705]]),
      ],
      board: { x: X(0.6), y: Y(0.565), w: clamp(X(0.19), 236, 290) },
    }
  }
  const r = Math.min(X(0.18), Y(0.125))
  return {
    W, H, wide,
    moon: [X(0.8), Y(0.07), W * 0.05],
    hz: Y(0.22),
    lake: { cx: X(0.6), cy: Y(0.3), rx: X(0.36), ry: Y(0.022) },
    brow: ([[-0.02, 0.355], [0.2, 0.375], [0.38, 0.415], [0.5, 0.448], [0.6, 0.428], [0.8, 0.39], [1.02, 0.365]] as Pt[]).map(([x, y]) => [X(x), Y(y)]),
    gate: { x: X(0.56), y: Y(0.49), w: X(0.16), h: X(0.1) },
    wells: [
      well(0.2, 0.63, r, 0, [[0.3, 0.56], [0.4, 0.52]]),
      well(0.8, 0.655, r * 1.04, 2, [[0.72, 0.57], [0.6, 0.53]]),
      well(0.47, 0.87, r * 1.35, 1, [[0.52, 0.72], [0.47, 0.6], [0.5, 0.53]]),
    ],
    board: { x: X(0.035), y: Y(0.395), w: X(0.36) },
  }
}

/**
 * Hồ lớn hút giếng nhỏ (2.5D, painted in four depth layers, HIGH): the camera stands on the hilltop right behind three
 * stone wells and looks down into their mouths, where the moon sits on the water. Jointed bamboo kakehi on forked stakes
 * run from each well, stepping down at every joint, to a stone sluice in the dip of the brow; beyond it the hill falls
 * away into a misty valley and the great lake (AI data centres) lies at its bottom, lamp rows on its shore doubled in the
 * water. Drag the sluice's stone slab up (or press it), three times: silver water runs down the pipes, the lake rises
 * and lights another row, the water in the wells sinks into the shaft until the bottoms are moss. The news arrives on a
 * notice board by the gate.
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
  const noteBody = h('div', { class: 't29w-notice-body' })
  const notice = h('div', { class: 't29w-notice' }, noteBody)
  const near = layer('near', nearBack, slab, nearFront, notice)
  const layers = [layer('sky', sky), layer('valley', valley), layer('ground', ground), near]
  const sr = h('ul', { class: 'visually-hidden' })
  const root = h('div', { class: 't29w', role: 'group', 'aria-label': G.art }, ...layers, sr)
  ctx.art.append(root)
  const stableH = stableHeight(ctx, [G.insight as Fact])
  ctx.prompt(G.prompt)
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
    slab.style.setProperty('--y', `${f1(-lv * 0.3 * g.gate.h)}px`)
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
    if (lv === LEVELS.length - 1) {
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
    const { gate, board } = g
    Object.assign(slab.style, { left: `${f1(gate.x - gate.w / 2)}px`, top: `${f1(gate.y - gate.h)}px`, width: `${f1(gate.w)}px`, height: `${f1(gate.h)}px` })
    Object.assign(notice.style, { left: `${f1(board.x)}px`, bottom: `${f1(H - board.y)}px`, width: `${f1(board.w)}px` })
    root.classList.toggle('tall', !g.wide)
    const had = document.activeElement === slab
    job?.cancel()
    job = sliced(paint(g), { sync: ctx.reduced || built })
    if (had) slab.focus({ preventScroll: true })
    built = true
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

/** The valley: two flanks falling into it, the lake at its bottom with the data-centre halls on the far shore (a row of
 *  lamps per level, doubled in the water), the far end of the kakehi pouring in, mist hiding the drop below the brow. */
function valleyArt(g: Geo): { els: SVGElement[]; rows: SVGElement[][]; lake: SVGGElement } {
  const { W, H, lake: L, hz, moon: [mx] } = g
  const q = rng(2930)
  // the halls of the data centre: long low blocks on the far shore and on terraces above it, windows lit by CSS
  const rows: SVGElement[][] = []
  const halls: SVGElement[] = []
  const refl: SVGElement[] = []
  for (let row = 0; row < 4; row++) {
    const y = L.cy - L.ry * 0.82 - row * H * (g.wide ? 0.013 : 0.011)
    const span = L.rx * (0.66 - row * 0.08)
    const n = 5 + row
    let walls = '', roofs = '', wins = '', lamps = '', rf = ''
    for (let j = 0; j < n; j++) {
      const hw = (span * 2 * (0.6 + q() * 0.3)) / n, hh = H * (0.011 + q() * 0.005) * (1 - row * 0.12)
      const x = L.cx - span + ((span * 2) * (j + 0.5)) / n - hw / 2 + (q() - 0.5) * 6
      walls += `M${f1(x)} ${f1(y)}h${f1(hw)}v${f1(-hh)}h${f1(-hw)}Z`
      roofs += `M${f1(x - 1.5)} ${f1(y - hh)}h${f1(hw + 3)}l${f1(-hw * 0.06)} ${f1(-hh * 0.35)}h${f1(-hw * 0.88 - 3)}Z`
      const nw = Math.max(3, Math.round(hw / 7))
      for (let k = 0; k < nw; k++) wins += `M${f1(x + hw * 0.08 + ((hw * 0.84) * k) / nw)} ${f1(y - hh * 0.62)}h${f1((hw * 0.84) / nw * 0.55)}v${f1(hh * 0.26)}h${f1(-(hw * 0.84) / nw * 0.55)}Z`
      // the reflection: broken warm streaks straight down into the water (only the shore row sits on it; the terraces' fall
      // behind the shore row's own)
      const len = L.ry * (1.1 + q() * 0.6) * (1 - row * 0.15)
      for (let k = 0; k < 3; k++) {
        const xx = x + hw * (0.2 + k * 0.3)
        rf += stroke([[xx, L.cy - L.ry * 0.7 + k], [xx + (q() - 0.5) * 2, L.cy - L.ry * 0.7 + len]], Math.max(1.2, hw * 0.08), 0.05, 0.7, 0.1)
      }
    }
    // the lamp line along the shore under the halls
    for (let x = L.cx - span; x < L.cx + span; x += W * 0.009 + q() * W * 0.006) lamps += `M${f1(x)} ${f1(y + 1.6)}h${f1(1.8)}`
    const wall = s('path', { class: 't29w-hall', d: walls })
    const roof = s('path', { class: 't29w-hall-roof', d: roofs })
    const win = s('path', { class: 't29w-win', d: wins })
    const lamp = s('path', { class: 't29w-lamps', d: lamps })
    const glow = s('ellipse', { class: 't29w-row-glow', cx: f1(L.cx), cy: f1(y - H * 0.004), rx: f1(span * 1.05), ry: f1(H * 0.018), fill: 'url(#t29-lamp)' })
    const rfl = s('path', { class: 't29w-refl', d: rf })
    halls.unshift(s('g', { class: `t29w-row t29w-row-${row}` }, wall, roof, glow, win, lamp)) // farther rows behind
    refl.push(rfl)
    rows.push([glow, win, lamp, rfl])
  }
  // the moon's road on the lake (the moon stands above its right half), ripples, the far shore's dark edge
  let road = ''
  for (let y = L.cy - L.ry * 0.6; y < L.cy + L.ry * 0.95; y += L.ry * (0.16 + q() * 0.12)) {
    const near = (y - L.cy + L.ry) / (2 * L.ry), len = L.rx * (0.04 + near * 0.08) * (0.6 + q())
    const x = mx + (q() - 0.5) * L.rx * 0.12 - len / 2
    road += stroke([[x, y], [x + len, y + (q() - 0.5)]], L.ry * (0.06 + near * 0.08), 0.25, 0.25, 0.1)
  }
  let rip = ''
  for (let i = 0; i < 26; i++) {
    const y = L.cy + (q() - 0.4) * L.ry * 1.6, len = L.rx * (0.03 + q() * 0.08)
    const x = L.cx + (q() - 0.5) * L.rx * 1.6
    rip += stroke([[x, y], [x + len, y + (q() - 0.5)]], 0.8 + q(), 0.3, 0.3, 0.1)
  }
  const water = blob(L.cx, L.cy, L.rx, L.ry, 2931, 0.03, 32)
  const lake = s('g', { class: 't29w-lake', style: `transform-origin:${f1(L.cx)}px ${f1(L.cy - L.ry)}px` },
    s('path', { class: 't29w-water', d: water, filter: 'url(#ink-wash)' }),
    s('path', { class: 'p2p-road', d: road }),
    s('path', { class: 'p2p-ripple', d: rip }),
    ...refl)
  // the far end of the kakehi: down the right flank from behind the brow to the lake, pouring in
  const gx = g.gate.x, top: Pt = [gx + W * 0.07, g.brow[Math.floor(g.brow.length / 2)][1] - H * 0.035]
  const end: Pt = [L.cx + L.rx * 0.5, L.cy + L.ry * 0.7]
  const fp = curve(top, [top[0] + W * 0.05, (top[1] + end[1]) / 2], end, 6)
  let far = '', stakes = ''
  for (let i = 0; i < fp.length - 1; i++) {
    far += stroke([fp[i], [fp[i + 1][0], fp[i + 1][1] + 1.2]], Math.max(1.6, H * 0.004), 0.02, 0.02, 0.6)
    stakes += `M${f1(fp[i + 1][0] - 2)} ${f1(fp[i + 1][1] + H * 0.012)}L${f1(fp[i + 1][0] + 1)} ${f1(fp[i + 1][1])}L${f1(fp[i + 1][0] + 3)} ${f1(fp[i + 1][1] + H * 0.012)}`
  }
  const spill = stroke([[end[0] - 2, end[1]], [end[0] - 2.4, end[1] + L.ry * 0.5]], Math.max(1.4, H * 0.003), 0.1, 0.4, 0.3)
  let pebbles = ''
  for (let i = 0; i < 40; i++) {
    const a = Math.PI * (0.05 + q() * 0.9)
    pebbles += blob(L.cx + Math.cos(a) * L.rx * (1 + q() * 0.04), L.cy + Math.sin(a) * L.ry * (1.05 + q() * 0.2), 2 + q() * 4, 1 + q() * 1.6, 2933 + i, 0.2, 7)
  }
  // the far shore the halls stand on: a low dark bank along the back of the lake
  const shore = blob(L.cx, L.cy - L.ry * 0.86, L.rx * 0.74, L.ry * 0.3, 2937, 0.08, 24)
  // the valley's sides: one ink hill each, their crowns off the frame, their flanks running down into the water
  const base = L.cy + L.ry * 0.5, hh = base - (hz - H * (g.wide ? 0.16 : 0.1))
  const els: SVGElement[] = [
    mist(L.cx, L.cy - L.ry * 2.6, L.rx * 1.6, H * 0.04),
    s('path', { class: 't29w-shore', d: shore, filter: 'url(#ink-wash)' }),
    ...halls,
    lake,
    hills(-W * 0.5, L.cx - L.rx * 0.6, base, hh, 2934, 0.25, 1),
    hills(L.cx + L.rx * 0.62, W * 1.5, base, hh * 0.9, 2935, 0.32, 1),
    mist(L.cx, L.cy + L.ry * 0.9, L.rx * 1.3, L.ry * 1.6),
    s('path', { class: 't29w-pebble', d: pebbles }),
    reeds(L.cx - L.rx * 0.86, L.cy + L.ry * 0.9, H * 0.03, 2936, 6),
    s('path', { class: 't29w-farpipe', d: far }),
    s('path', { class: 't29w-farstake', d: stakes }),
    s('path', { class: 't29w-spill', d: spill }),
    s('path', { class: 't29w-flow t29w-flow-far', d: `M${fp.map(P).join('L')}`, style: `--len:${f1(len(fp))}` }),
    // the drop below the brow: the valley floor lost in mist
    mist(W * 0.5, L.cy + L.ry * 3.2, W * 0.75, H * (g.wide ? 0.08 : 0.06)),
    mist(gx, g.brow[Math.floor(g.brow.length / 2)][1] - H * 0.04, W * 0.5, H * 0.05),
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
  for (const [x, w] of [[0.36, 0.04], [0.64, 0.03], [0.05, 0.05]]) {
    const cx = W * x, cy = yAt(cx) + H * 0.012, rw = W * w * (g.wide ? 1 : 1.8)
    rocks.push(s('g', { transform: `translate(${f1(cx)} ${f1(cy)})` }, stoneArt(rw * 1.6, rw * 0.62, 2960 + Math.round(x * 100))))
  }
  return [
    s('path', { class: 't29w-hill', d: top }),
    s('path', { class: 't29w-hill-shade', d: top, fill: 'url(#t29-dusk)' }),
    s('path', { class: 't29w-patch', d: patches }),
    s('path', { class: 't29w-grain', d: grain }),
    s('path', { class: 't29w-contour', d: contours }),
    s('path', { class: 't29w-tuft', d: tufts }),
    s('path', { class: 't29w-brow', d: stroke(brow, H * 0.006, 0.05, 0.05, 0.4), filter: 'url(#ink-rough)' }),
    s('path', { class: 't29w-brow-rim', d: stroke(brow.map(([x, y]) => [x, y - 1.6] as Pt), H * 0.003, 0.1, 0.1, 0.3) }),
    ...rocks,
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
