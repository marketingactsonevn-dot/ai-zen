import { fill, h, nextId, s, viDate } from '../../core/dom'
import { L, type Fact } from '../../core/content'
import { sliced } from '../../core/chunk'
import type { SceneCtx, SceneDef } from '../types'
import type { Tide } from '../../ui/part2/types'
import { blob, clamp, onSize, rng, stableHeight, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist, moon, paperLantern } from '../../ui/part2/paint'
import { C } from './data'
import { t29Defs } from './figures'
import { f1 } from './rig'
import { guide } from '../../ui/part2/guide'

const S = C.scenes.bill
const TIDE = S.tide as Tide
const MS = TIDE.milestones
const N = MS.length // stops 0…N-1 = milestones, N = today → the mist ahead
const DRAM = MS.findIndex((m) => m.compare)

/** One-point perspective on the sand: depth D ≥ 1 (1 = the frame's foot), a ground x in px-at-D=1. */
interface Geo {
  W: number
  H: number
  wide: boolean
  vp: number // the vanishing point's height (the lake's far shore)
  G: number // ground drop below the vanishing point at D = 1
  Ws: number // the strip's width at D = 1
  P: number // CSS perspective for the folds
  hs: number // a risen fold's height on screen
  stops: number[] // where the paperweight rests, D, far → near (N + 1)
  folds: number[] // each milestone fold's hinge, D
  leaves: [number, number][] // the DRAM comparison: [before, after] as [near D, far D]
  page: number // the depth where the near page begins (it rolls over the frame's foot)
}

function geo(W: number, H: number): Geo {
  const wide = W / H > 1.15
  const vp = H * (wide ? 0.2 : 0.17)
  const stops = wide ? [3.6, 2.4, 1.75, 1.42] : [3.0, 2.1, 1.62, 1.36]
  const u = wide ? 0.08 : 0.07
  // the two DRAM leaves lie on the sand just behind the stop: the later price five times the length of the earlier one
  const after: [number, number] = [stops[DRAM] + 0.05, stops[DRAM] + 0.05 + 5 * u]
  const before: [number, number] = [after[1], after[1] + u]
  const G = H * 1.02 - vp
  const folds = stops.slice(0, N).map((d, i) => (i === DRAM ? before[1] + 0.04 : d * 1.06))
  // a farther fold stands behind a nearer one: keep enough of it above the nearer one's top for its date to show
  const gap = wide ? 34 : 27
  for (let i = DRAM - 1; i >= 0; i--) {
    folds[i] = Math.max(folds[i], 1 / (1 / folds[i + 1] - gap / G))
    stops[i] = Math.max(stops[i], folds[i] / 1.06)
  }
  return {
    W, H, wide, vp, G, Ws: wide ? Math.min(W * 0.5, H * 1.05) : W * 0.9, P: H * 1.4, hs: H * (wide ? 0.1 : 0.085),
    stops, folds, leaves: [before, after], page: wide ? 1.4 : 1.32,
  }
}
const yOf = (g: Geo, D: number) => g.vp + g.G / D
const xOf = (g: Geo, x: number, D: number) => g.W / 2 + x / D

/**
 * Hoá đơn đến tay ai (comp/2.5D, one-point perspective on the axis; audit v3 29-3, reworked): an orihon (an accordion
 * bill) runs from the great lake at the vanishing point, where the data centres glow under the moon, straight down the
 * raked sand to the viewer. Drag the stone paperweight along it toward the phone stall in the right foreground: it stops
 * a moment at each fold (a notch), the fold rises and a scrap of the bill flies onto the price tag hanging from the
 * phone, which grows; the two DRAM leaves stay on the sand, the later one five times the earlier. At today the RAM tag
 * shrinks (the same price, less memory) and the stall's board says what to do. What the weight is on is written on the
 * near page, which stays blank until the first drag.
 */
export function billScene(): SceneDef {
  return {
    label: S.label,
    text: 'bl',
    mount(ctx: SceneCtx) {
      t29Defs()
      const id = nextId('t29b')
      const today = viDate(TIDE.horizon.asOf)
      const back = s('svg', { class: 't29b-svg', 'aria-hidden': 'true' })
      const sand = s('svg', { class: 't29b-svg', 'aria-hidden': 'true' })
      const world = h('div', { class: 't29b-world' })
      const stage = h('div', { class: 't29b-stage', 'aria-hidden': 'true' }, world)
      const front = s('svg', { class: 't29b-svg t29b-front', 'aria-hidden': 'true' })
      const read = h('div', { class: 't29b-read' })
      const page = h('div', { class: 't29b-page' }, read)
      const glint = s('g', { class: 't29b-glint' },
        s('circle', { cx: 0, cy: -2, r: 30, fill: 'url(#t29-glint)' }),
        s('path', { d: 'M-4 -6L-3 -3L0 -2L-3 -1L-4 2L-5 -1L-8 -2L-5 -3Z', class: 't29b-star' }))
      const disc = s('svg', { viewBox: '-36 -30 72 52', 'aria-hidden': 'true' }, glint, paperweight())
      const valueText = (i: number) => (i < N ? fill(L.tideValue, { date: viDate(MS[i].date), label: MS[i].label }) : `${L.today} · ${today}`)
      const weight = h('div', {
        class: 't29b-weight', role: 'slider', tabindex: '0', 'aria-label': S.sliderAria, 'aria-orientation': 'vertical',
        'aria-valuemin': '0', 'aria-valuemax': String(N), 'aria-valuenow': '0', 'aria-valuetext': valueText(0),
      }, disc)
      // the phone on the stall's counter: a price tag that grows with every scrap of the bill, a RAM tag; the board
      const slips = MS.map(() => h('i', { class: 't29b-slip' }))
      const price = h('div', { class: 't29b-ptag' }, h('span', null, S.priceTag), h('span', { class: 't29b-slips' }, ...slips))
      const ram = h('div', { class: 't29b-rtag' }, S.ramTag)
      const phone = h('div', { class: 't29b-phone', 'aria-hidden': 'true' }, price, ram)
      const board = h('div', { class: 't29b-board' }, ctx.fact(S.board as Fact, 'p', 't29b-board-text'))
      const root = h('div', { class: 't29b', role: 'group', 'aria-label': S.art }, back, sand, stage, front, phone, board, page, weight)
      ctx.art.append(root)
      const stableH = stableHeight(ctx, [S.insight as Fact])
      const gd = guide(ctx)
      const step = gd.steps(S.prompts)
      step(0)
      const dot = gd.dot(weight, { dir: [0, 1] })
      // the folds are marked before anything moves: a groove down the strip, a tick and a date at each stop (H2)
      const way = gd.track(() => (g ? [[g.W / 2, yOf(g, g.stops[0])], [g.W / 2, yOf(g, g.stops[N])]] : [[0, 0], [0, 0]]))
      const stopLabels = [...MS.map((m) => viDate(m.date)), L.today].map((d) => h('span', { class: 't29b-stop', 'aria-hidden': 'true' }, d))
      root.append(...stopLabels) // the stops, marked on the sand beside the strip before anything moves
      const target = gd.drop(price) // the price tag is where it all ends up (H3)
      let phonePt: Pt = [0, 0]
      let seen = 0 // the farthest stop reached
      let hold = 0 // until when the weight rests in the notch of the stop it just reached
      // H7: the weight slides a little toward the stall and back
      const invite = () => !reached && !ctx.reduced && weight.animate([{ translate: '0 0' }, { translate: '0 12px' }, { translate: '0 0' }], { duration: 900, easing: 'ease-in-out', composite: 'add' })
      ctx.el.addEventListener('p2:idle', invite)
      ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', invite))

      /** a scrap of the bill flies from the weight to the price tag, which grows */
      function fly(i: number) {
        if (!g) return
        const D = g.stops[i]
        const from: Pt = [g.W / 2, yOf(g, D)]
        const done = () => {
          slips[i].classList.add('on')
          price.style.setProperty('--k', (1 + 0.16 * (i + 1)).toFixed(2))
        }
        if (ctx.reduced) return done()
        const scrap = h('i', { class: 't29b-fly', 'aria-hidden': 'true' })
        root.append(scrap)
        const a = scrap.animate([
          { transform: `translate(${f1(from[0])}px, ${f1(from[1])}px) rotate(0deg)`, opacity: 0 },
          { transform: `translate(${f1((from[0] + phonePt[0]) / 2)}px, ${f1(Math.min(from[1], phonePt[1]) - 60)}px) rotate(200deg)`, opacity: 1, offset: 0.45 },
          { transform: `translate(${f1(phonePt[0])}px, ${f1(phonePt[1])}px) rotate(380deg)`, opacity: 1 },
        ], { duration: 900, easing: 'cubic-bezier(.4,0,.3,1)' })
        a.onfinish = () => (scrap.remove(), done())
        ctx.onCleanup(() => scrap.remove())
      }

      let g: Geo | null = null
      let folds: HTMLElement[] = []
      let leaves: SVGElement[] = []
      let tt = 0 // 0 = the first milestone … 1 = today
      let at = -1 // the stop the page shows
      let touched = false
      let reached = false

      // the page: what the weight is on, written in ink (blank until the viewer moves the weight)
      function show(i: number) {
        weight.setAttribute('aria-valuenow', String(i))
        weight.setAttribute('aria-valuetext', valueText(i))
        if (i === at || !touched) return
        at = i
        if (i > seen) {
          // each new fold: a notch, and a scrap of the bill to the tag
          for (let k = seen; k < Math.min(i, N); k++) fly(k)
          seen = i
          hold = performance.now() + 650
        }
        page.classList.toggle('is-mist', i === N)
        if (i < N) {
          const m = MS[i]
          read.replaceChildren(h('p', { class: 't29b-eyebrow' }, `${viDate(m.date)} · ${m.label}`), ctx.fact(m.fact, 'p', 't29b-fact'))
          if (m.compare) read.append(compare(m.compare))
        } else {
          read.replaceChildren(h('p', { class: 't29b-eyebrow' }, `${L.today} · ${today} → ${L.horizon}`), ctx.fact(TIDE.horizon, 'p', 't29b-fact'))
          if (!reached) {
            reached = true
            // today: the RAM tag shrinks, the board lights; look at the tag, then the insight
            root.classList.add('is-done')
            dot.done()
            target.hit()
            step(1)
            ctx.chime('ok')
            const tm = window.setTimeout(() => ctx.insight(S.insight as Fact, S.detail as Fact[]), ctx.reduced ? 0 : 1600)
            ctx.onCleanup(() => clearTimeout(tm))
          }
        }
        if (!read.hasAttribute('aria-live')) read.setAttribute('aria-live', 'polite')
      }

      // the weight at t: every fold it has passed stands up behind it; the nearest stop fills the page
      function moveTo(t: number, snap: boolean) {
        if (!g) return
        tt = clamp(t, 0, 1)
        const near = Math.round(tt * N)
        if (snap) tt = near / N
        const u = tt * N, i = Math.min(N - 1, Math.floor(u))
        const D = g.stops[i] + (g.stops[i + 1] - g.stops[i]) * (u - i)
        const sc = clamp(1.25 / D, 0.62, 1) // never too small to find (audit: a 64 px target)
        weight.style.transform = `translate3d(${f1(g.W / 2)}px,${f1(yOf(g, D))}px,0) scale(${sc.toFixed(3)})`
        weight.classList.toggle('snap', snap)
        if (touched) folds.forEach((f, k) => {
          f.classList.toggle('up', k / N <= tt + 0.02)
          f.classList.toggle('cur', k === Math.min(near, N - 1))
        })
        leaves.forEach((l) => l.classList.toggle('lit', touched && DRAM / N <= tt + 0.02))
        root.classList.toggle('is-today', tt >= 1 - 0.02)
        way.set(tt)
        show(near)
      }
      // the pointer's height → depth → t along the stops
      function tAt(y: number) {
        const gg = g!
        const D = gg.G / Math.max(1, y - gg.vp)
        const st = gg.stops
        if (D >= st[0]) return 0
        for (let i = 0; i < N; i++) if (D >= st[i + 1]) return (i + (st[i] - D) / (st[i] - st[i + 1])) / N
        return 1
      }

      /** while dragging, the weight rests a moment in the notch of each new stop: no sliding past them all at once */
      const notch = (t: number) => (performance.now() < hold ? Math.min(t, seen / N) : Math.min(t, (seen + 1) / N))
      let drag: { id: number; top: number } | null = null
      root.addEventListener('pointerdown', (e) => {
        if (e.button || !g || (e.target as Element).closest('button, a')) return
        drag = { id: e.pointerId, top: root.getBoundingClientRect().top }
        root.setPointerCapture(e.pointerId)
        weight.focus({ preventScroll: true })
        touched = true
        root.classList.add('is-touched')
        target.lift(true)
        moveTo(notch(tAt(e.clientY - drag.top)), false)
        ctx.chime('soft')
      })
      root.addEventListener('pointermove', (e) => drag && e.pointerId === drag.id && moveTo(notch(tAt(e.clientY - drag.top)), false))
      const end = (e: PointerEvent) => {
        if (!drag || e.pointerId !== drag.id) return
        drag = null
        target.lift(false)
        moveTo(tt, true)
      }
      root.addEventListener('pointerup', end)
      root.addEventListener('pointercancel', end)
      weight.addEventListener('keydown', (e) => {
        const k = { ArrowDown: 1, ArrowRight: 1, PageDown: 1, ArrowUp: -1, ArrowLeft: -1, PageUp: -1 }[e.key]
        const cur = Math.round(tt * N)
        const to = k ? clamp(cur + k, 0, N) : e.key === 'Home' ? 0 : e.key === 'End' ? N : -1
        if (to < 0) return
        e.preventDefault()
        touched = true
        root.classList.add('is-touched')
        moveTo(to / N, true)
        ctx.chime('soft')
      })

      let job: { cancel(): void } | null = null
      let built = false
      ctx.onCleanup(() => job?.cancel())
      function layout() {
        const W = ctx.art.clientWidth
        const H = stableH(ctx.art.clientHeight)
        if (W < 60 || H < 60) return
        root.style.height = `${f1(H)}px`
        g = geo(W, H)
        root.classList.toggle('tall', !g.wide)
        for (const svg of [back, sand, front]) svg.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
        Object.assign(stage.style, { perspective: `${f1(g.P)}px`, perspectiveOrigin: `${f1(W / 2)}px ${f1(g.vp)}px` })
        Object.assign(world.style, { left: `${f1(W / 2)}px`, top: `${f1(g.vp)}px` })
        // the page lies across the strip's near end; its text sits inside the strip's edges
        const pw = (g.Ws * 0.92) / g.page
        Object.assign(page.style, { left: `${f1(W / 2 - pw / 2)}px`, width: `${f1(pw)}px`, minHeight: `${f1(H - yOf(g, g.page))}px` })
        const had = document.activeElement === weight
        job?.cancel()
        job = sliced(paint(g), { sync: ctx.reduced || built })
        if (had) weight.focus({ preventScroll: true })
        built = true
      }

      function* paint(gg: Geo) {
        back.replaceChildren(...skyArt(gg))
        yield
        const st = stripArt(gg, id)
        sand.replaceChildren(...st.els)
        leaves = st.leaves
        yield
        folds = MS.map((m, i) => foldEl(gg, i, m.date, m.label))
        world.replaceChildren(...folds)
        const stall = stallArt(gg)
        front.replaceChildren(...stall.els)
        // the phone's tags hang beside it; the board under the eave
        phonePt = stall.phone
        Object.assign(phone.style, { left: `${f1(stall.phone[0])}px`, top: `${f1(stall.phone[1])}px` })
        Object.assign(board.style, { left: `${f1(stall.board[0])}px`, top: `${f1(stall.board[1])}px`, width: `${f1(stall.board[2])}px` })
        stopLabels.forEach((el, i) => Object.assign(el.style, { right: `${f1(gg.W / 2 + gg.Ws / 2 / gg.stops[i] + 12)}px`, top: `${f1(yOf(gg, gg.stops[i]))}px` }))
        moveTo(tt, true)
        gd.refresh()
      }

      ctx.onCleanup(onSize(ctx.art, layout))
    },
  }
}

/** A milestone's fold: a paper panel hinged at its near edge, lying on the strip; up, it stands leaning back a little and
 *  shows its date (and, when there is room, its label). Sizes are set so it reads at its depth. */
function foldEl(g: Geo, i: number, date: string, label: string): HTMLElement {
  const D = g.folds[i]
  const Lp = g.hs * D
  const wS = g.Ws / D // its width on screen
  const fs = clamp(wS * 0.11, 11, g.wide ? 20 : 15) // the date's size on screen
  const ls = fs * 0.62
  const el = h('div', {
    class: 't29b-fold',
    style: `width:${f1(g.Ws)}px;height:${f1(Lp)}px;left:${f1(-g.Ws / 2)}px;top:${f1(g.G - Lp)}px;transform:translateZ(${f1(g.P * (1 - D))}px) rotateX(var(--a));--warm:${clamp((2.2 - D) / 0.8, 0, 1).toFixed(2)}`,
  },
  h('span', { class: 't29b-fold-date', style: `font-size:${f1(fs * D)}px` }, viDate(date)),
  ls >= 9 ? h('span', { class: 't29b-fold-label', style: `font-size:${f1(ls * D)}px` }, label) : null)
  return el
}

/** The sky at the vanishing point: the moon above the lake, far hills, the data-centre shore glowing, its road on the water. */
function skyArt(g: Geo): SVGElement[] {
  const { W, H, vp } = g
  const q = rng(2975)
  const lake = { cx: W / 2, cy: vp + H * 0.045, rx: W * (g.wide ? 0.24 : 0.46), ry: H * 0.03 }
  let lights = '', halls = ''
  for (let i = 0; i < 9; i++) {
    const hw = lake.rx * (0.1 + q() * 0.08), hh = H * (0.008 + q() * 0.006)
    const x = lake.cx - lake.rx * 0.75 + (lake.rx * 1.5 * i) / 9 + (q() - 0.5) * 6
    halls += `M${f1(x)} ${f1(vp + H * 0.016)}h${f1(hw)}v${f1(-hh)}h${f1(-hw)}Z`
    for (let k = 0; k < 4; k++) lights += `M${f1(x + hw * (0.12 + k * 0.22))} ${f1(vp + H * 0.016 - hh * 0.55)}h${f1(Math.max(1.2, hw * 0.1))}`
  }
  let road = '', refl = ''
  for (let y = lake.cy - lake.ry * 0.7; y < lake.cy + lake.ry; y += lake.ry * (0.18 + q() * 0.12)) {
    const near = (y - lake.cy + lake.ry) / (2 * lake.ry), len = lake.rx * (0.05 + near * 0.1) * (0.6 + q())
    road += stroke([[W / 2 - len / 2 + (q() - 0.5) * 8, y], [W / 2 + len / 2, y + (q() - 0.5)]], lake.ry * (0.08 + near * 0.08), 0.25, 0.25, 0.1)
  }
  for (let i = 0; i < 14; i++) {
    const x = lake.cx - lake.rx * 0.7 + q() * lake.rx * 1.4
    refl += stroke([[x, lake.cy - lake.ry * 0.6], [x + (q() - 0.5) * 2, lake.cy + lake.ry * (0.1 + q() * 0.6)]], 1.4 + q() * 1.4, 0.05, 0.7, 0.1)
  }
  const mr = clamp(H * 0.05, 14, 30)
  return [
    moon(W / 2, Math.max(mr * 1.8, vp - H * 0.1), mr, 2976, true),
    mist(W / 2, vp - H * 0.03, W * 0.6, H * 0.12),
    hills(-W * 0.06, W * 0.46, vp + H * 0.02, H * 0.13, 2977, 0.8, 3),
    hills(W * 0.54, W * 1.06, vp + H * 0.02, H * 0.11, 2978, 0.8, 3),
    // the sand begins at the far shore, so the lake lies in it rather than floating on the sky
    s('linearGradient', { id: 't29b-sandfade', x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, style: 'stop-color:var(--t29-sand);stop-opacity:0' }), s('stop', { offset: 0.06, style: 'stop-color:var(--t29-sand);stop-opacity:1' })),
    s('rect', { x: 0, y: f1(vp + H * 0.004), width: f1(W), height: f1(H), fill: 'url(#t29b-sandfade)' }),
    s('path', { class: 't29b-lake', d: blob(lake.cx, lake.cy, lake.rx, lake.ry, 2979, 0.03, 28), filter: 'url(#ink-wash)' }),
    s('path', { class: 'p2p-road', d: road }),
    s('path', { class: 't29b-refl', d: refl }),
    s('path', { class: 't29b-halls', d: halls }),
    s('path', { class: 't29b-lights', d: lights }),
    s('ellipse', { class: 't29b-dc-glow', cx: f1(lake.cx), cy: f1(vp + H * 0.01), rx: f1(lake.rx * 0.95), ry: f1(H * 0.03), fill: 'url(#t29-lamp)' }),
    mist(W / 2, vp + H * 0.02, W * 0.7, H * 0.035),
  ]
}

/** The sand and the strip on it: tine lines raked toward the vanishing point (faint, fading into the distance), a fine
 *  grain; the orihon in accordion pleats (lit and shaded faces, fibre, columns of figures in ink), the DRAM leaves. */
function stripArt(g: Geo, id: string): { els: SVGElement[]; leaves: SVGElement[] } {
  const { W, H, Ws } = g
  const q = rng(2985)
  const X = (x: number, D: number) => xOf(g, x, D), Y = (D: number) => yOf(g, D)
  const quad = (x0: number, x1: number, d0: number, d1: number) => `M${f1(X(x0, d0))} ${f1(Y(d0))}L${f1(X(x1, d0))} ${f1(Y(d0))}L${f1(X(x1, d1))} ${f1(Y(d1))}L${f1(X(x0, d1))} ${f1(Y(d1))}Z`
  const hw = Ws / 2
  // raked sand: groups of three tines, wider apart toward the sides
  let rakes = ''
  for (const side of [-1, 1]) {
    let x = hw * 1.18
    while (x < W * 3) {
      for (let k = 0; k < 3; k++) {
        const xx = side * (x + k * 7)
        rakes += `M${f1(X(xx, 14))} ${f1(Y(14))}L${f1(X(xx, 0.92))} ${f1(Y(0.92))}`
      }
      x += 34 + q() * 46 + x * 0.06
    }
  }
  let grain = ''
  for (let i = 0; i < 900; i++) {
    const D = 0.95 + Math.pow(q(), 1.8) * 9, x = (q() - 0.5) * W * 2.6
    if (Math.abs(x) < hw * 1.02) continue
    grain += `M${f1(X(x, D))} ${f1(Y(D))}h${f1(Math.max(0.6, 2.2 / D))}`
  }
  // the pleats: equal lengths on the sand, alternately facing the moon (far) and turned from it
  const lit: string[] = ['', '']
  let creases = '', writing = '', fibre = ''
  const step = 0.12
  for (let k = 0, D = 0.9; D < 7.4; k++, D += step) {
    lit[k % 2] += quad(-hw, hw, D, D + step)
    creases += stroke([[X(-hw, D), Y(D)], [X(hw, D), Y(D)]], Math.max(0.5, 1.6 / D), 0.05, 0.05, 0.4)
    if (D < 3.3) {
      // a ledger's figures: short ink dashes in rows across the pleat, a total underlined now and then
      for (let r = 0; r < 3; r++) {
        const d = D + step * (0.25 + r * 0.25)
        let x = -hw * 0.82
        while (x < hw * 0.8) {
          const len = hw * (0.04 + q() * 0.1)
          if (q() > 0.25) writing += stroke([[X(x, d), Y(d)], [X(x + len, d), Y(d) + 0.3]], Math.max(0.5, 2.4 / d), 0.2, 0.3, 0.3)
          x += len + hw * (0.04 + q() * 0.08)
        }
      }
    }
  }
  for (let i = 0; i < 360; i++) {
    const D = 0.95 + Math.pow(q(), 1.4) * 4, x = (q() - 0.5) * Ws * 0.96, a = q() * Math.PI
    const l = 7 / D
    fibre += `M${f1(X(x, D))} ${f1(Y(D))}l${f1(Math.cos(a) * l)} ${f1(Math.sin(a) * l * 0.4)}`
  }
  const [before, after] = g.leaves
  const leafB = s('path', { class: 't29b-leaf t29b-leaf-before', d: quad(-hw * 0.96, hw * 0.96, before[0], before[1]) })
  const leafA = s('path', { class: 't29b-leaf t29b-leaf-after', d: quad(-hw * 0.96, hw * 0.96, after[0], after[1]) })
  const edge = (side: number) => stroke([[X(side * hw, 7.4), Y(7.4)], [X(side * hw, 0.9), Y(0.9)]], 1.6, 0.4, 0.02, 0.3)
  const fade = `${id}-fade`
  return {
    leaves: [leafB, leafA],
    els: [
      s('defs', null,
        s('linearGradient', { id: `${fade}-g`, x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 0 }), s('stop', { offset: 0.45, 'stop-color': '#fff', 'stop-opacity': 0.6 }), s('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 1 })),
        s('mask', { id: fade, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, s('rect', { x: 0, y: f1(g.vp), width: f1(W), height: f1(H - g.vp), fill: `url(#${fade}-g)` }))),
      s('g', { mask: `url(#${fade})` },
        s('path', { class: 't29b-rake', d: rakes }),
        s('path', { class: 't29b-grain', d: grain })),
      s('path', { class: 't29b-strip-sh', d: quad(-hw * 1.04, hw * 1.08, 0.9, 7.4) }),
      s('path', { class: 't29b-pleat t29b-pleat-lit', d: lit[0] }),
      s('path', { class: 't29b-pleat t29b-pleat-shade', d: lit[1] }),
      s('path', { class: 't29b-fibre', d: fibre }),
      s('path', { class: 't29b-writing', d: writing }),
      leafB,
      leafA,
      s('path', { class: 't29b-crease', d: creases }),
      s('path', { class: 't29b-edge', d: edge(-1) + edge(1) }),
      // the far end of the strip melts into the lake's mist
      mist(W / 2, Y(7.4), Ws * 0.5, H * 0.03),
    ],
  }
}

/** The phone stall at the garden gate, in the right foreground and cut by the frame: a deep eave, two posts, a counter
 *  with a stone shaped like a phone and a few laid out, its paper lamp; the lamp's warm pool spreading over the near folds. */
function stallArt(g: Geo): { els: SVGElement[]; phone: Pt; board: [number, number, number] } {
  const { W, H, wide } = g
  const q = rng(2972)
  // the whole stall inside the frame (audit v3 29-3: it was cut by the right edge)
  const sw = wide ? W * 0.235 : W * 0.3
  const x0 = wide ? W * 0.7 : W * 0.645, eave = H * (wide ? 0.5 : 0.6), counter = H * (wide ? 0.8 : 0.86)
  const x1 = x0 + sw * 1.15
  const roof = `M${f1(x0 - sw * 0.16)} ${f1(eave)}Q${f1(x0 + sw * 0.4)} ${f1(eave - H * 0.035)} ${f1(x1)} ${f1(eave - H * 0.02)}L${f1(x1)} ${f1(eave - H * 0.12)}Q${f1(x0 + sw * 0.4)} ${f1(eave - H * 0.11)} ${f1(x0 + sw * 0.02)} ${f1(eave - H * 0.07)}Z`
  // the eave's underside in shadow, the tiles' ribs, the moon along the ridge
  const under = `M${f1(x0 - sw * 0.16)} ${f1(eave)}Q${f1(x0 + sw * 0.4)} ${f1(eave - H * 0.035)} ${f1(x1)} ${f1(eave - H * 0.02)}L${f1(x1)} ${f1(eave + H * 0.012)}Q${f1(x0 + sw * 0.4)} ${f1(eave - H * 0.006)} ${f1(x0 - sw * 0.1)} ${f1(eave + H * 0.016)}Z`
  let ribs = ''
  for (let i = 0; i < 14; i++) {
    const x = x0 - sw * 0.1 + (sw * 1.25 * i) / 14
    ribs += stroke([[x + sw * 0.05, eave - H * 0.1 + i * 0.4], [x, eave - H * 0.012 - Math.sin((i / 14) * Math.PI) * H * 0.02]], 1.2, 0.1, 0.1, 0.4)
  }
  const posts = stroke([[x0 + sw * 0.04, H * 1.02], [x0 + sw * 0.05, eave - H * 0.01]], Math.max(4, sw * 0.03), 0.02, 0.02, 0.6) +
    stroke([[x0 + sw * 0.82, H * 1.02], [x0 + sw * 0.81, eave - H * 0.02]], Math.max(4, sw * 0.03), 0.02, 0.02, 0.6)
  // noren: short cloth panels hanging under the eave, split, swaying a little apart
  let noren = ''
  for (let i = 0; i < 4; i++) {
    const nx = x0 + sw * (0.24 + i * 0.15), top = eave + H * 0.008 - i * H * 0.002
    noren += `M${f1(nx)} ${f1(top)}h${f1(sw * 0.13)}l${f1(sw * 0.006)} ${f1(H * 0.07)}h${f1(-sw * 0.13)}Z`
  }
  const front = `M${f1(x0 - sw * 0.04)} ${f1(counter)}L${f1(x1)} ${f1(counter - H * 0.01)}L${f1(x1)} ${f1(H * 1.02)}L${f1(x0 - sw * 0.04)} ${f1(H * 1.02)}Z`
  const top = `M${f1(x0 - sw * 0.08)} ${f1(counter)}L${f1(x1)} ${f1(counter - H * 0.01)}L${f1(x1)} ${f1(counter - H * 0.035)}L${f1(x0 + sw * 0.02)} ${f1(counter - H * 0.028)}Z`
  let boards = ''
  for (let x = x0 + sw * 0.06; x < x1; x += sw * (0.09 + q() * 0.05)) boards += stroke([[x, counter + H * 0.01], [x + 1, H * 1.02]], 1.2, 0.1, 0.1, 0.5)
  // the stone phone standing on the counter, and a few laid flat
  const tw = sw * 0.09, th = tw * 1.9, tx = x0 + sw * 0.5, ty = counter - H * 0.025
  let laid = ''
  for (let i = 0; i < 3; i++) laid += `M${f1(x0 + sw * (0.14 + i * 0.1))} ${f1(ty + 1)}l${f1(sw * 0.07)} ${f1(-1.5)}l${f1(sw * 0.012)} ${f1(-H * 0.009)}l${f1(-sw * 0.07)} ${f1(1.5)}Z`
  const lx = x0 + sw * 0.1, ly = eave + H * 0.05, lr = clamp(sw * 0.05, 8, 16)
  // a phone: the reading page covers the counter, so the tags hang from the eave and the board goes up top
  return { phone: wide ? [tx, ty - th] : [x0 + sw * 0.62, eave + H * 0.07], board: wide ? [x0 + sw * 0.06, counter + H * 0.035, sw * 1.0] : [W * 0.04, H * 0.015, W * 0.92], els: [
    s('ellipse', { class: 't29b-pool', cx: f1(lx - sw * 0.25), cy: f1(H * 0.9), rx: f1(sw * 1.4), ry: f1(H * 0.22), fill: 'url(#t29-lamp)' }),
    s('path', { class: 't29b-post', d: posts, filter: 'url(#ink-rough)' }),
    s('path', { class: 't29b-noren', d: noren }),
    s('path', { class: 't29b-roof', d: roof, filter: 'url(#ink-rough)' }),
    s('path', { class: 't29b-under', d: under }),
    s('path', { class: 't29b-ribs', d: ribs }),
    s('path', { class: 't29b-roof-rim', d: stroke([[x0 + sw * 0.02, eave - H * 0.072], [x0 + sw * 0.4, eave - H * 0.112], [x1, eave - H * 0.121]], Math.max(1.4, H * 0.003), 0.1, 0.1, 0.3) }),
    s('path', { class: 't29b-counter', d: front }),
    s('path', { class: 't29b-boards', d: boards }),
    s('path', { class: 't29b-counter-top', d: top }),
    s('path', { class: 't29b-phones', d: laid }),
    s('rect', { class: 't29b-tablet', x: f1(tx - tw / 2), y: f1(ty - th), width: f1(tw), height: f1(th), rx: f1(tw * 0.22) }),
    s('rect', { class: 't29b-screen', x: f1(tx - tw * 0.34), y: f1(ty - th * 0.9), width: f1(tw * 0.68), height: f1(th * 0.72), rx: f1(tw * 0.1) }),
    paperLantern(lx, ly, lr, 2970, H * 0.03),
    grass(W * 0.03, H * 1.01, H * 0.1, 2971),
    grass(W * 0.12, H * 1.01, H * 0.06, 2973),
  ] }
}

/** The DRAM price, then and as forecast: two ink bars, one five times the other, written on the page. */
function compare(c: NonNullable<Tide['milestones'][number]['compare']>): HTMLElement {
  const bar = (k: number, cls: string) =>
    s('svg', { class: `t29b-bar ${cls}`, viewBox: '0 0 200 12', preserveAspectRatio: 'none', style: `width:${f1(k * 100)}%`, 'aria-hidden': 'true' },
      s('path', { d: stroke([[2, 6.5], [100, 5.6], [198, 6.2]], 9, 0.04, 0.12, 0.5) }))
  const row = (label: string | undefined, value: string, k: number, cls: string) =>
    h('div', { class: 't29b-row' }, h('span', { class: 't29b-row-l' }, label ?? ''), h('span', { class: 't29b-row-b' }, bar(k, cls)), h('span', { class: 't29b-row-v' }, value))
  return h('div', { class: 't29b-compare' }, row(c.beforeLabel, c.before, 0.18, 'before'), row(c.afterLabel, c.after, 0.92, 'after'))
}

/** The dragged thing: a round stone paperweight seen from above the sand, the moon's reflection on its polished top. */
function paperweight(): SVGElement {
  return s('g', { class: 't29b-pw' },
    s('ellipse', { class: 't29b-pw-sh', cx: 4, cy: 10, rx: 30, ry: 10 }),
    s('ellipse', { class: 't29b-pw-side', cx: 0, cy: 5, rx: 27, ry: 13 }),
    s('ellipse', { class: 't29b-pw-top', cx: 0, cy: 0, rx: 27, ry: 13 }),
    s('ellipse', { class: 't29b-pw-moon', cx: -5, cy: -3, rx: 9, ry: 4.2 }),
    s('path', { class: 't29b-pw-rim', d: stroke([[-24, -2], [-10, -11], [10, -12]] as Pt[], 2, 0.3, 0.3, 0.1) }),
    s('path', { class: 't29b-pw-ink', d: stroke([[-27, 1], [-20, 12], [0, 18], [20, 12], [27, 3]] as Pt[], 2.4, 0.2, 0.2, 0.3) }))
}
