import { fill, h, s, viDate } from '../../core/dom'
import { L, type Fact } from '../../core/content'
import { sliced } from '../../core/chunk'
import { createLoop } from '../../core/loop'
import type { SceneCtx, SceneDef } from '../types'
import type { Tide } from '../../ui/part2/types'
import { blob, clamp, curve, onSize, rng, stableHeight, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist, moon, paperLantern } from '../../ui/part2/paint'
import { C } from './data'
import { t29Defs } from './figures'
import { f1, P } from './rig'
import { guide } from '../../ui/part2/guide'

const S = C.scenes.bill
const TIDE = S.tide as Tide
const MS = TIDE.milestones
const N = MS.length // stops 0…N-1 = milestones, N = today
const DRAM = MS.findIndex((m) => m.compare)
const UP = 72, REST = 16 // a fold's angle (deg from the sand) while the weight is on it, and once it has been passed

/**
 * The ground is a perspective plane seen from eye height 1 (garden units): a ground point (X, Z) lands at
 * x = vx + X·G/Z, y = hz + G·(1 − Y)/Z. The ledger is a straight band on it from the lake's near shore (far left) to the
 * stall (near right): its centre X(Z), half width hw.
 */
interface Geo {
  W: number
  H: number
  wide: boolean
  hz: number
  vx: number
  G: number
  Zf: number // the strip's far end (it melts into the lake's mist)
  Zn: number // its near end (the frame's foot)
  Xf: number
  Xn: number
  hw: number
  stops: number[] // where the weight rests, Z, far → near (N + 1)
  fold: number // a standing fold's length (garden units)
  leaves: [number, number][] // the DRAM comparison lying flat: [before, after] as [near Z, far Z]
  page: number // the near page begins here (Z); the reading is written on it
  moon: [number, number, number]
  lake: { cx: number; cy: number; rx: number; ry: number }
  /** the stall in screen fractions: left and right front posts, the ground at its front, the eave, the counter top */
  stall: { x0: number; x1: number; yg: number; ye: number; yc: number; k: number }
}

function geo(W: number, H: number): Geo {
  const wide = W / H > 1.15
  const make = (o: { hz: number; vx: number; G: number; far: number; near: number; nearW: number; stops: number[]; before: number; page: number; fold: number; stall: Geo['stall']; moon: [number, number, number]; lake: Geo['lake'] }): Geo => {
    const Zf = 9, Zn = 1.02
    const Xf = ((o.far - o.vx) * Zf) / o.G, Xn = ((o.near - o.vx) * Zn) / o.G
    const hw = (o.nearW / 2) * (Zn / o.G)
    const d = o.stops[DRAM]
    return {
      W, H, wide, hz: o.hz, vx: o.vx, G: o.G, Zf, Zn, Xf, Xn, hw, stops: o.stops, fold: o.fold, page: o.page,
      // the earlier price farther, the later one (five times as long) nearer, both flat on the sand at the DRAM stop
      leaves: [[d, d + o.before], [d - o.before * 5, d]],
      moon: o.moon, lake: o.lake, stall: o.stall,
    }
  }
  if (wide) {
    return make({
      hz: H * 0.27, vx: W * 0.4, G: H * 0.72, far: W * 0.29, near: W * 0.545, nearW: W * 0.31,
      stops: [6.2, 3.8, 2.6, 1.62], before: 0.17, page: 1.38, fold: 0.62,
      stall: { x0: W * 0.715, x1: W * 0.955, yg: H * 0.8, ye: H * 0.33, yc: H * 0.555, k: 0.91 },
      moon: [W * 0.3, H * 0.1, clamp(H * 0.05, 16, 30)],
      lake: { cx: W * 0.3, cy: H * 0.29, rx: W * 0.23, ry: H * 0.032 },
    })
  }
  return make({
    hz: H * 0.2, vx: W * 0.42, G: H * 0.78, far: W * 0.28, near: W * 0.36, nearW: W * 0.62,
    stops: [5.6, 3.5, 2.45, 1.72], before: 0.12, page: 1.5, fold: 0.6,
    stall: { x0: W * 0.565, x1: W * 0.975, yg: H * 0.665, ye: H * 0.29, yc: H * 0.5, k: 0.92 },
    moon: [W * 0.3, H * 0.075, W * 0.05],
    lake: { cx: W * 0.36, cy: H * 0.215, rx: W * 0.42, ry: H * 0.022 },
  })
}
const Xc = (g: Geo, Z: number) => g.Xf + ((Z - g.Zf) * (g.Xn - g.Xf)) / (g.Zn - g.Zf)
/** a garden point (X, Y up, Z away) → screen */
const pr = (g: Geo, X: number, Y: number, Z: number): Pt => [g.vx + (X * g.G) / Z, g.hz + (g.G * (1 - Y)) / Z]
/** a point across the strip at depth Z: u = −1 left edge … 1 right edge */
const onStrip = (g: Geo, u: number, Z: number, Y = 0): Pt => pr(g, Xc(g, Z) + u * g.hw, Y, Z)

/**
 * Hoá đơn đến tay ai (comp/2.5D; audit v3 29-3, Làm lại): an orihon (an accordion bill) of ivory paper runs on the
 * raked sand from the great lake under the moon (the data centres glow on its far shore), far left, down to the phone
 * stall at the garden gate, near right. Drag the stone paperweight along it toward the stall: it rests a moment in the
 * notch at each fold; the fold stands up with its date and a scrap of the bill flies onto the price tag hanging from the
 * phone on the counter, which grows. The DRAM price lies flat on the sand in two leaves, the later five times the earlier.
 * At today the RAM tag shrinks (the same price, less memory) and the stall's board says what to do. What the weight is on
 * is written on the near page, blank until the first drag.
 */
export function billScene(): SceneDef {
  return {
    label: S.label,
    text: 'bl',
    mount(ctx: SceneCtx) {
      t29Defs()
      const today = viDate(TIDE.horizon.asOf)
      const back = s('svg', { class: 't29b-svg', 'aria-hidden': 'true' })
      const sand = s('svg', { class: 't29b-svg', 'aria-hidden': 'true' })
      const foldSvg = s('svg', { class: 't29b-svg', 'aria-hidden': 'true' })
      const front = s('svg', { class: 't29b-svg', 'aria-hidden': 'true' })
      const read = h('div', { class: 't29b-read' })
      const page = h('div', { class: 't29b-page' }, read)
      const disc = s('svg', { viewBox: '-40 -34 80 60', 'aria-hidden': 'true' }, paperweight())
      const valueText = (i: number) => (i < N ? fill(L.tideValue, { date: viDate(MS[i].date), label: MS[i].label }) : `${L.today} · ${today}`)
      const weight = h('div', {
        class: 't29b-weight', role: 'slider', tabindex: '0', 'aria-label': S.sliderAria,
        'aria-valuemin': '0', 'aria-valuemax': String(N), 'aria-valuenow': '0', 'aria-valuetext': valueText(0),
      }, disc)
      // the phone's tags: a paper price tag that grows with every scrap of the bill, a wooden RAM tag; the stall's board
      const slips = MS.map(() => h('i', { class: 't29b-slip' }))
      const price = h('div', { class: 't29b-ptag' }, h('span', { class: 't29b-tag-word' }, S.priceTag), h('span', { class: 't29b-slips' }, ...slips))
      const ram = h('div', { class: 't29b-rtag' }, h('span', { class: 't29b-tag-word' }, S.ramTag))
      const tags = h('div', { class: 't29b-tags', 'aria-hidden': 'true' }, price, ram)
      const board = h('div', { class: 't29b-board' }, ctx.fact(S.board as Fact, 'p', 't29b-board-text'))
      const stopLabels = [...MS.map((m) => viDate(m.date)), L.today].map((d) => h('span', { class: 't29b-stop', 'aria-hidden': 'true' }, d))
      const root = h('div', { class: 't29b', role: 'group', 'aria-label': S.art }, back, sand, foldSvg, front, ...stopLabels, tags, board, page, weight)
      ctx.art.append(root)
      const stableH = stableHeight(ctx, [S.insight as Fact])
      const gd = guide(ctx)
      const step = gd.steps(S.prompts)
      step(0)
      const dot = gd.dot(weight, { dir: [1, 1] })
      // the stops are marked before anything moves: a groove down the strip with a tick at each (H2), dates on the sand
      const way = gd.track(() => (g ? centreLine(g, g.stops[0], g.stops[N], 16) : [[0, 0], [0, 0]]), { ticks: N + 1 })
      const target = gd.drop(price) // the price tag is where it all ends up (H3)
      let tagPt: Pt = [0, 0]
      let seen = 0 // the farthest stop reached
      let hold = 0 // until when the weight rests in the notch of the stop it just reached
      // H7: the weight slides a little toward the stall and back
      const invite = () => !reached && !ctx.reduced && weight.animate([{ translate: '0 0' }, { translate: '9px 8px' }, { translate: '0 0' }], { duration: 900, easing: 'ease-in-out', composite: 'add' })
      ctx.el.addEventListener('p2:idle', invite)
      ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', invite))

      /** a scrap of the bill flies from the weight to the price tag, which grows */
      function fly(i: number) {
        if (!g) return
        const from = onStrip(g, 0, g.stops[i])
        const done = () => {
          slips[i].classList.add('on')
          price.style.setProperty('--k', (1 + 0.17 * (i + 1)).toFixed(2))
        }
        if (ctx.reduced) return done()
        const scrap = h('i', { class: 't29b-fly', 'aria-hidden': 'true' })
        root.append(scrap)
        const a = scrap.animate([
          { transform: `translate(${f1(from[0])}px, ${f1(from[1])}px) rotate(0deg)`, opacity: 0 },
          { transform: `translate(${f1((from[0] + tagPt[0]) / 2)}px, ${f1(Math.min(from[1], tagPt[1]) - 70)}px) rotate(200deg)`, opacity: 1, offset: 0.45 },
          { transform: `translate(${f1(tagPt[0])}px, ${f1(tagPt[1])}px) rotate(380deg)`, opacity: 1 },
        ], { duration: 900, easing: 'cubic-bezier(.4,0,.3,1)' })
        a.onfinish = () => (scrap.remove(), done())
        ctx.onCleanup(() => scrap.remove())
      }

      let g: Geo | null = null
      let tt = 0 // 0 = the first milestone … 1 = today
      let at = -1 // the stop the page shows
      let touched = false
      let reached = false
      let line: Pt[] = [] // the centre line on screen, stop 0 → today, for the pointer
      let leaves: SVGElement[] = []

      // ── the standing folds: each a paper panel hinged on the sand at its stop; its angle eases toward its target
      type Fold = { i: number; a: number; to: number; face: SVGPathElement; edge: SVGPathElement; sh: SVGPathElement; text: SVGGElement }
      let folds: Fold[] = []
      function drawFold(f: Fold) {
        if (!g) return
        const Z = g.stops[f.i], Lf = g.fold, r = (f.a * Math.PI) / 180
        const Zt = Z + Lf * Math.cos(r), Yt = Lf * Math.sin(r)
        const dx = Xc(g, Zt) - Xc(g, Z)
        const p00 = onStrip(g, -0.96, Z), p10 = onStrip(g, 0.96, Z)
        const p01 = pr(g, Xc(g, Z) + dx - 0.96 * g.hw, Yt, Zt), p11 = pr(g, Xc(g, Z) + dx + 0.96 * g.hw, Yt, Zt)
        f.face.setAttribute('d', `M${P(p00)}L${P(p10)}L${P(p11)}L${P(p01)}Z`)
        f.edge.setAttribute('d', `M${P(p01)}L${P(p11)}`)
        // its shadow toward us: the moon stands beyond the lake
        const sl = Lf * Math.sin(r) * 0.7
        const q0 = onStrip(g, -0.96, Math.max(g.Zn, Z - sl)), q1 = onStrip(g, 0.96, Math.max(g.Zn, Z - sl))
        f.sh.setAttribute('d', `M${P(p00)}L${P(p10)}L${P(q1)}L${P(q0)}Z`)
        // the date and label on its face: a 200 × 100 box mapped onto the panel (top-left = p01)
        f.text.setAttribute('transform', `matrix(${[(p11[0] - p01[0]) / 200, (p11[1] - p01[1]) / 200, (p00[0] - p01[0]) / 100, (p00[1] - p01[1]) / 100, p01[0], p01[1]].map((v) => v.toFixed(4)).join(' ')})`)
        f.text.style.opacity = String(clamp((f.a - 30) / 30, 0, 1))
        f.face.classList.toggle('up', f.a > 40)
      }
      const loop = createLoop(root, (_t, dt) => {
        const k = dt > 0 ? 1 - Math.exp(-dt * 7) : 1
        let moving = false
        for (const f of folds) {
          if (Math.abs(f.to - f.a) < 0.3) continue
          f.a += (f.to - f.a) * k
          if (Math.abs(f.to - f.a) < 0.3) f.a = f.to
          else moving = true
          drawFold(f)
        }
        return moving
      })
      ctx.onCleanup(() => loop.dispose())
      function aimFolds(near: number) {
        for (const f of folds) {
          f.to = !touched || f.i / N > tt + 0.02 ? 0 : f.i === near ? UP : REST
          f.face.classList.toggle('cur', f.i === near)
          if (ctx.reduced) (f.a = f.to), drawFold(f)
        }
        if (!ctx.reduced) loop.start()
      }

      // the page: what the weight is on, written in ink (blank until the viewer moves the weight)
      function show(i: number) {
        weight.setAttribute('aria-valuenow', String(i))
        weight.setAttribute('aria-valuetext', valueText(i))
        if (i === at || !touched) return
        at = i
        if (i > seen) {
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
            // today: the RAM tag shrinks, the board is carved; look at the tag, then the insight
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

      // the weight at t: the fold under it stands, the passed ones lie back a little; the nearest stop fills the page
      function moveTo(t: number, snap: boolean) {
        if (!g) return
        tt = clamp(t, 0, 1)
        const near = Math.round(tt * N)
        if (snap) tt = near / N
        const u = tt * N, i = Math.min(N - 1, Math.floor(u))
        const Z = 1 / (1 / g.stops[i] + (1 / g.stops[i + 1] - 1 / g.stops[i]) * (u - i)) // even on screen
        const [x, y] = onStrip(g, 0, Z)
        const sc = clamp(1.7 / Z, 0.62, 1.05)
        weight.style.transform = `translate3d(${f1(x)}px,${f1(y)}px,0) scale(${sc.toFixed(3)})`
        weight.classList.toggle('snap', snap)
        aimFolds(touched ? near : -1)
        leaves.forEach((l) => l.classList.toggle('lit', touched && DRAM / N <= tt + 0.02))
        root.classList.toggle('is-today', tt >= 1 - 0.02)
        way.set(tt)
        show(near)
      }
      // the pointer → the nearest point of the centre line → t along the stops (even steps on screen between stops)
      function tAt(px: number, py: number) {
        let best = 0, bd = Infinity
        line.forEach(([x, y], k) => {
          const d = (x - px) ** 2 + (y - py) ** 2
          if (d < bd) (bd = d), (best = k)
        })
        return best / (line.length - 1)
      }

      /** while dragging, the weight rests a moment in the notch of each new stop: no sliding past them all at once */
      const notch = (t: number) => (performance.now() < hold ? Math.min(t, seen / N) : Math.min(t, (seen + 1) / N))
      let drag: { id: number; left: number; top: number } | null = null
      root.addEventListener('pointerdown', (e) => {
        if (e.button || !g || (e.target as Element).closest('button, a')) return
        const r = root.getBoundingClientRect()
        drag = { id: e.pointerId, left: r.left, top: r.top }
        root.setPointerCapture(e.pointerId)
        weight.focus({ preventScroll: true })
        touched = true
        root.classList.add('is-touched')
        target.lift(true)
        moveTo(notch(tAt(e.clientX - drag.left, e.clientY - drag.top)), false)
        ctx.chime('soft')
      })
      root.addEventListener('pointermove', (e) => drag && e.pointerId === drag.id && moveTo(notch(tAt(e.clientX - drag.left, e.clientY - drag.top)), false))
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
        for (const svg of [back, sand, foldSvg, front]) svg.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
        // the page: the near end of the strip; its words stay inside the paper's edges
        const pl = Math.max(onStrip(g, -1, g.page)[0], onStrip(g, -1, g.Zn)[0]) + 14, pr0 = Math.min(onStrip(g, 1, g.page)[0], onStrip(g, 1, g.Zn)[0]) - 14
        Object.assign(page.style, { left: `${f1(pl)}px`, width: `${f1(pr0 - pl)}px`, top: `${f1(onStrip(g, 0, g.page)[1] + 8)}px` })
        // the line the pointer follows: even steps on screen between stops
        line = []
        for (let i = 0; i < N; i++)
          for (let k = 0; k < 24; k++) line.push(onStrip(g, 0, 1 / (1 / g.stops[i] + ((1 / g.stops[i + 1] - 1 / g.stops[i]) * k) / 24)))
        line.push(onStrip(g, 0, g.stops[N]))
        const had = document.activeElement === weight
        job?.cancel()
        job = sliced(paint(g), { sync: ctx.reduced || built })
        if (had) weight.focus({ preventScroll: true })
        built = true
      }

      function* paint(gg: Geo) {
        back.replaceChildren(...skyArt(gg))
        yield
        const st = stripArt(gg)
        sand.replaceChildren(...st.els)
        leaves = st.leaves
        yield
        folds = MS.map((_, i) => i).filter((i) => i !== DRAM).map((i) => {
          const face = s('path', { class: 't29b-fold' }) as SVGPathElement
          const old = folds.find((f) => f.i === i)
          const fs = 28
          const text = s('g', { class: 't29b-fold-text' },
            s('text', { class: 't29b-fold-date', x: 100, y: 40, 'text-anchor': 'middle', 'font-size': fs }, viDate(MS[i].date)),
            s('text', { class: 't29b-fold-label', x: 100, y: 72, 'text-anchor': 'middle', 'font-size': fs * 0.56 }, MS[i].label)) as SVGGElement
          return { i, a: old?.a ?? 0, to: old?.to ?? 0, face, edge: s('path', { class: 't29b-fold-edge' }) as SVGPathElement, sh: s('path', { class: 't29b-fold-sh' }) as SVGPathElement, text }
        })
        // farther folds first (the nearer stands in front)
        foldSvg.replaceChildren(...folds.map((f) => f.sh), ...folds.flatMap((f) => [f.face, f.text, f.edge]))
        folds.forEach(drawFold)
        const stall = stallArt(gg)
        front.replaceChildren(...stall.els)
        // the tags hang from the phone over the counter's front edge; the board under the eave
        tagPt = [stall.tag[0] + 20, stall.tag[1] + 26]
        Object.assign(tags.style, { left: `${f1(stall.tag[0])}px`, top: `${f1(stall.tag[1])}px` })
        Object.assign(board.style, { left: `${f1(stall.board[0])}px`, top: `${f1(stall.board[1])}px`, width: `${f1(stall.board[2])}px` })
        stopLabels.forEach((el, i) => {
          const [x, y] = onStrip(gg, -1, gg.stops[i])
          const tw = (el.textContent ?? '').length * (gg.wide ? 7 : 6)
          Object.assign(el.style, { right: `${f1(Math.min(gg.W - x + 12, gg.W - tw - 6))}px`, top: `${f1(y)}px` })
        })
        moveTo(tt, true)
        gd.refresh()
      }

      ctx.onCleanup(onSize(ctx.art, layout))
    },
  }
}

/** n + 1 points on the strip's centre line from Z0 to Z1, even on screen. */
function centreLine(g: Geo, Z0: number, Z1: number, n: number): Pt[] {
  return Array.from({ length: n + 1 }, (_, k) => onStrip(g, 0, 1 / (1 / Z0 + ((1 / Z1 - 1 / Z0) * k) / n)))
}

/** The sky and the far shore: the moon over the lake behind a thin cloud, ink hills on both hands, the data-centre halls
 *  along the far shore with their lit windows, every light doubled straight down in the water, the moon's broken road. */
function skyArt(g: Geo): SVGElement[] {
  const { W, H, hz, lake, wide } = g
  const [mx, my, mr] = g.moon
  const q = rng(2975)
  let halls = '', roofs = '', lights = '', refl = ''
  const n = wide ? 11 : 8
  // two terraces of halls along the far shore, the back row higher on the slope; heights and gaps vary
  for (let i = 0; i < n * 2; i++) {
    const back = i >= n, j = back ? i - n + 0.5 : i
    if (back && q() < 0.25) continue
    const hw = lake.rx * (0.06 + q() * 0.08) * (back ? 0.8 : 1), hh = H * (0.008 + q() * 0.012) * (back ? 0.85 : 1)
    const x = lake.cx - lake.rx * (back ? 0.7 : 0.82) + (lake.rx * (back ? 1.4 : 1.64) * j) / n + (q() - 0.5) * 10, y = hz - H * (back ? 0.012 : 0.002)
    halls += `M${f1(x)} ${f1(y)}h${f1(hw)}v${f1(-hh)}h${f1(-hw)}Z`
    roofs += `M${f1(x - 1)} ${f1(y - hh)}h${f1(hw + 2)}l${f1(-hw * 0.08)} ${f1(-hh * 0.3)}h${f1(-hw * 0.84 - 2)}Z`
    for (let k = 0; k < 4; k++) {
      const lx = x + hw * (0.12 + k * 0.22)
      lights += `M${f1(lx)} ${f1(y - hh * 0.6)}h${f1(Math.max(1.2, hw * 0.1))}v${f1(Math.max(1, hh * 0.25))}h${f1(-Math.max(1.2, hw * 0.1))}Z`
      if (!back && q() > 0.4) refl += stroke([[lx + 0.6, y + H * 0.004], [lx + 0.6 + (q() - 0.5) * 2, y + lake.ry * (0.8 + q() * 1.1)]], 1 + q() * 1.2, 0.05, 0.7, 0.1)
    }
  }
  let road = ''
  for (let y = lake.cy - lake.ry * 0.6; y < lake.cy + lake.ry; y += lake.ry * (0.16 + q() * 0.12)) {
    const near = (y - lake.cy + lake.ry) / (2 * lake.ry), len = lake.rx * (0.05 + near * 0.12) * (0.6 + q())
    road += stroke([[mx - len / 2 + (q() - 0.5) * 8, y], [mx + len / 2, y + (q() - 0.5)]], lake.ry * (0.08 + near * 0.08), 0.25, 0.25, 0.1)
  }
  return [
    moon(mx, my, mr, 2976, true),
    mist(W * 0.5, hz - H * 0.04, W * 0.7, H * 0.12),
    hills(-W * 0.06, W * 0.62, hz + 2, H * (wide ? 0.14 : 0.1), 2977, 0.82, 4),
    hills(W * 0.5, W * 1.06, hz + 2, H * (wide ? 0.19 : 0.12), 2978, 0.7, 3),
    mist(W * 0.3, hz - H * 0.01, W * 0.5, H * 0.03),
    // the sand begins at the far shore, so the lake lies in it rather than floating on the sky
    s('linearGradient', { id: 't29b-sandfade', x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, style: 'stop-color:var(--t29-sand);stop-opacity:0' }), s('stop', { offset: 0.05, style: 'stop-color:var(--t29-sand);stop-opacity:1' })),
    s('rect', { x: 0, y: f1(hz - H * 0.006), width: f1(W), height: f1(H - hz + H * 0.006), fill: 'url(#t29b-sandfade)' }),
    s('ellipse', { class: 't29b-dc-glow', cx: f1(lake.cx), cy: f1(hz - H * 0.01), rx: f1(lake.rx * 1.05), ry: f1(H * 0.045), fill: 'url(#t29-lamp)' }),
    s('path', { class: 't29b-lake', d: blob(lake.cx, lake.cy, lake.rx, lake.ry, 2979, 0.03, 28), filter: 'url(#ink-wash)' }),
    s('path', { class: 'p2p-road', d: road }),
    s('path', { class: 't29b-refl', d: refl }),
    s('path', { class: 't29b-halls', d: halls }),
    s('path', { class: 't29b-hall-roof', d: roofs }),
    s('path', { class: 't29b-lights', d: lights }),
    mist(lake.cx, lake.cy + lake.ry * 1.4, lake.rx * 1.1, H * 0.022),
  ]
}

/** The sand and the strip on it: tine lines raked along the strip (they meet with it at the lake), rings round a rock
 *  group on the left, a fine grain; the orihon in low accordion pleats (moonlit far, lantern-warm near, deckled edges,
 *  ledger figures in ink), the DRAM leaves lying flat with their figures carved, the near page. */
function stripArt(g: Geo): { els: SVGElement[]; leaves: SVGElement[] } {
  const { W, H, wide, hw } = g
  const q = rng(2985)
  const quad = (u0: number, u1: number, Z0: number, Z1: number) => {
    const a = onStrip(g, u0, Z0), b = onStrip(g, u1, Z0), c = onStrip(g, u1, Z1), d = onStrip(g, u0, Z1)
    return `M${P(a)}L${P(b)}L${P(c)}L${P(d)}Z`
  }
  // rakes: lines parallel to the strip, both sides, groups of three tines
  let rakes = ''
  for (const side of [-1, 1]) {
    let off = hw * 1.25
    while (off < 30) {
      for (let k = 0; k < 3; k++) {
        const o = side * (off + k * 0.05)
        const pts: Pt[] = [0.95, 1.4, 2.2, 3.5, 6, 11].map((Z) => pr(g, Xc(g, Z) + o, 0, Z))
        rakes += `M${pts.map(P).join('L')}`
      }
      off += 0.22 + q() * 0.3 + off * 0.12
    }
  }
  // a rock group on the far left of the sand, with its raked rings (the strip's other side is the stall)
  const rockAt = wide ? { X: Xc(g, 3.2) - 2.6, Z: 3.2 } : { X: Xc(g, 3.6) - 1.0, Z: 3.6 }
  let rings = ''
  for (let k = 1; k <= 4; k++) {
    const pts: Pt[] = []
    for (let a = 0; a <= 360; a += 10) pts.push(pr(g, rockAt.X + Math.cos((a * Math.PI) / 180) * (0.32 + k * 0.16), 0, rockAt.Z + Math.sin((a * Math.PI) / 180) * (0.32 + k * 0.16)))
    rings += `M${pts.map(P).join('L')}`
  }
  const [rx, ry] = pr(g, rockAt.X, 0, rockAt.Z)
  const rs = g.G / rockAt.Z
  let grain = ''
  for (let i = 0; i < 900; i++) {
    const Z = 0.95 + Math.pow(q(), 1.7) * 10, X = (q() - 0.5) * 16
    if (Math.abs(X - Xc(g, Z)) < hw * 1.05) continue
    const [x, y] = pr(g, X, 0, Z)
    if (x < -10 || x > W + 10) continue
    grain += `M${f1(x)} ${f1(y)}h${f1(Math.max(0.6, 2.4 / Z))}`
  }
  // the pleats: equal lengths along the strip, faces to the moon a touch lighter than faces from it; creases as fine lines
  // the pleats: an accordion lying a little open, valleys on the sand and ridges raised (hp), so the faces turned to the
  // moon and those turned to us shade apart by themselves and each edge is a zigzag; ridges catch a thin light
  const lit: string[] = ['', '']
  let creases = '', ridges = '', writing = '', fibre = '', deckle = ''
  const hp = 0.022
  const zs: number[] = []
  for (let Z = g.page; Z < g.Zf; Z = Math.min(g.Zf, Z + 0.075 * Z)) zs.push(Z)
  zs.push(g.Zf)
  const Yk = (k: number) => (k % 2 ? hp : 0)
  for (let k = 0; k < zs.length - 1; k++) {
    const Z = zs[k], Z1 = zs[k + 1], y0 = Yk(k), y1 = Yk(k + 1)
    const a = onStrip(g, -1, Z, y0), b = onStrip(g, 1, Z, y0), c = onStrip(g, 1, Z1, y1), d = onStrip(g, -1, Z1, y1)
    lit[k % 2] += `M${P(a)}L${P(b)}L${P(c)}L${P(d)}Z`
    if (k % 2) ridges += stroke([onStrip(g, -0.99, Z, hp), onStrip(g, 0.99, Z, hp)], Math.max(0.4, 1.3 / Z), 0.1, 0.1, 0.4)
    else creases += stroke([onStrip(g, -0.99, Z), onStrip(g, 0.99, Z)], Math.max(0.4, 1.2 / Z), 0.1, 0.1, 0.4)
    if (Z < 4 && Z > g.page + 0.05) {
      // a ledger's figures: short ink dashes in rows across the pleat
      for (let r = 0; r < 2; r++) {
        const zz = Z + (Z1 - Z) * (0.3 + r * 0.4), yy = y0 + (y1 - y0) * (0.3 + r * 0.4)
        let u = -0.8
        while (u < 0.78) {
          const len = 0.06 + q() * 0.16
          if (q() > 0.3) writing += stroke([onStrip(g, u, zz, yy), onStrip(g, u + len, zz, yy)], Math.max(0.4, 1.8 / zz), 0.2, 0.3, 0.3)
          u += len + 0.06 + q() * 0.1
        }
      }
    }
  }
  for (let i = 0; i < 320; i++) {
    const Z = g.Zn + Math.pow(q(), 1.3) * 4, u = (q() - 0.5) * 1.9, a = q() * Math.PI, l = 7 / Z
    const [x, y] = onStrip(g, u, Z)
    fibre += `M${f1(x)} ${f1(y)}l${f1(Math.cos(a) * l)} ${f1(Math.sin(a) * l * 0.4)}`
  }
  // deckled edges: the paper's edge torn soft, a little shadow under it on the sand
  for (const side of [-1, 1]) {
    const pts: Pt[] = [onStrip(g, side, g.Zn)]
    zs.forEach((Z, k) => pts.push(onStrip(g, side * (1 + (q() - 0.5) * 0.02), Z, Yk(k))))
    deckle += stroke(pts, 1.3, 0.05, 0.4, 0.3)
  }
  const [before, after] = g.leaves
  const leafB = s('path', { class: 't29b-leaf t29b-leaf-before', d: quad(-0.92, 0.92, before[0], before[1]) })
  const leafA = s('path', { class: 't29b-leaf t29b-leaf-after', d: quad(-0.92, 0.92, after[0], after[1]) })
  // the leaves' figures, carved flat on the paper (a 200 × 100 box mapped onto each leaf)
  const flat = (Z0: number, Z1: number, text: string, cls: string) => {
    const a = onStrip(g, -0.85, Z1), b = onStrip(g, 0.85, Z1), c = onStrip(g, -0.85, Z0)
    return s('text', { class: `t29b-leaf-text ${cls}`, x: 100, y: 72, 'text-anchor': 'middle', 'font-size': 34, transform: `matrix(${[(b[0] - a[0]) / 200, (b[1] - a[1]) / 200, (c[0] - a[0]) / 100, (c[1] - a[1]) / 100, a[0], a[1]].map((v) => v.toFixed(4)).join(' ')})` }, text)
  }
  const cmp = MS[DRAM].compare!
  const leafTexts = s('g', { class: 't29b-leaf-texts' }, flat(after[0] + (after[1] - after[0]) * 0.25, after[0] + (after[1] - after[0]) * 0.75, cmp.after, 'after'))
  const lp = onStrip(g, 0, g.page)
  const els: SVGElement[] = [
    s('path', { class: 't29b-rake', d: rakes }),
    s('path', { class: 't29b-grain', d: grain }),
    s('path', { class: 't29b-ring', d: rings }),
    s('ellipse', { class: 't29b-rock-sh', cx: f1(rx + rs * 0.06), cy: f1(ry + rs * 0.02), rx: f1(rs * 0.5), ry: f1(rs * 0.1) }),
    s('g', { transform: `translate(${f1(rx)} ${f1(ry)})` }, stoneArt(rs * 0.62, rs * 0.42, 2987)),
    s('g', { transform: `translate(${f1(rx + rs * 0.36)} ${f1(ry + rs * 0.05)})` }, stoneArt(rs * 0.3, rs * 0.17, 2988)),
    s('path', { class: 't29b-strip-sh', d: quad(-1.06, 1.1, g.Zn, g.Zf) }),
    s('path', { class: 't29b-pleat t29b-pleat-lit', d: lit[0] }),
    s('path', { class: 't29b-pleat t29b-pleat-shade', d: lit[1] }),
    // moonlight on the far paper, the lantern's warmth on the near
    s('path', { class: 't29b-strip-moon', d: quad(-1, 1, 3.2, g.Zf), fill: 'url(#t29b-moonfade)' }),
    s('linearGradient', { id: 't29b-moonfade', x1: 0, y1: 1, x2: 0, y2: 0 }, s('stop', { offset: 0, style: 'stop-color:var(--moon);stop-opacity:0' }), s('stop', { offset: 1, style: 'stop-color:var(--moon);stop-opacity:0.5' })),
    s('path', { class: 't29b-fibre', d: fibre }),
    s('path', { class: 't29b-writing', d: writing }),
    leafB,
    leafA,
    leafTexts,
    s('path', { class: 't29b-crease', d: creases }),
    s('path', { class: 't29b-ridge', d: ridges }),
    s('path', { class: 't29b-edge', d: deckle }),
    // the near page: a fresh sheet folded out at the end, a crease where it starts
    s('path', { class: 't29b-pagesheet', d: quad(-1, 1, g.Zn, g.page) }),
    s('path', { class: 't29b-crease t29b-pagecrease', d: stroke([onStrip(g, -0.98, g.page), [lp[0], lp[1] + 0.5], onStrip(g, 0.98, g.page)], 1.6, 0.1, 0.1, 0.4) }),
    // the far end of the strip melts into the lake's mist
    mist(onStrip(g, 0, g.Zf)[0], onStrip(g, 0, g.Zf)[1], W * 0.1, H * 0.03),
    grass(W * 0.02, H * 1.01, H * 0.08, 2971),
  ]
  return { leaves: [leafB, leafA, leafTexts], els }
}

/** The phone stall at the garden gate, near right and whole in the frame: four posts on the sand (front pair, back pair
 *  toward the vanishing point), a beam on them, a tiled shed roof resting on the beam, a counter box, a stone on the
 *  counter with the phone standing on it, a few laid flat, a paper lantern on the beam's corner, the board on two cords. */
function stallArt(g: Geo): { els: SVGElement[]; tag: Pt; board: [number, number, number] } {
  const { W, H, wide, vx, hz } = g
  const { x0, x1, yg, ye, yc, k } = g.stall
  const q = rng(2972)
  const bk = ([x, y]: Pt, kk = k): Pt => [vx + (x - vx) * kk, hz + (y - hz) * kk]
  const pw = Math.max(5, (x1 - x0) * 0.04) // post width
  const posts: Pt[][] = [[[x0, yg], [x0, ye]], [[x1, yg], [x1, ye]]]
  const backL = posts[0].map((p) => bk(p)), backR = posts[1].map((p) => bk(p))
  const post = (a: Pt, b: Pt, wd: number, cls: string) => s('path', { class: cls, d: `M${f1(a[0] - wd / 2)} ${f1(a[1])}L${f1(b[0] - wd / 2)} ${f1(b[1])}L${f1(b[0] + wd / 2)} ${f1(b[1])}L${f1(a[0] + wd / 2)} ${f1(a[1])}Z` })
  // the beam on the front posts and along the left side to the back
  const bh = Math.max(5, H * 0.016)
  const beamF = `M${f1(x0 - pw * 1.6)} ${f1(ye - bh)}L${f1(x1 + pw * 1.6)} ${f1(ye - bh)}L${f1(x1 + pw * 1.6)} ${f1(ye)}L${f1(x0 - pw * 1.6)} ${f1(ye)}Z`
  const bl0 = bk([x0, ye - bh]), bl1 = bk([x0, ye])
  const beamS = `M${f1(x0)} ${f1(ye - bh)}L${P(bl0)}L${P(bl1)}L${f1(x0)} ${f1(ye)}Z`
  // the roof: a shed rising toward the back, resting on the beams: we see its underside (rafters) and the front edge
  const ov = (x1 - x0) * 0.08, rise = H * (wide ? 0.06 : 0.05)
  const fL: Pt = [x0 - ov, ye - bh], fR: Pt = [x1 + ov, ye - bh]
  const bL = bk([x0 - ov, ye - bh - rise], k * 0.96), bR = bk([x1 + ov, ye - bh - rise], k * 0.96)
  const under = `M${P(fL)}L${P(fR)}L${P(bR)}L${P(bL)}Z`
  const th = Math.max(5, H * 0.018) // the tiles' thickness at the eave
  const edge = `M${f1(fL[0])} ${f1(fL[1])}L${f1(fR[0])} ${f1(fR[1])}L${f1(fR[0] + 2)} ${f1(fR[1] - th)}L${f1(fL[0] - 2)} ${f1(fL[1] - th)}Z`
  let rafters = '', tiles = ''
  for (let i = 0; i <= 9; i++) {
    const t = i / 9
    const a: Pt = [fL[0] + (fR[0] - fL[0]) * t, fL[1]], b: Pt = [bL[0] + (bR[0] - bL[0]) * t, bL[1]]
    rafters += stroke([a, b], Math.max(1.2, H * 0.003), 0.05, 0.05, 0.6)
  }
  for (let i = 0; i <= 18; i++) {
    const t = i / 18
    tiles += stroke([[fL[0] - 2 + (fR[0] - fL[0] + 4) * t, fL[1] - th * 0.95], [fL[0] - 2 + (fR[0] - fL[0] + 4) * t + 0.4, fL[1] - th * 0.1]], 1, 0.1, 0.1, 0.5)
  }
  // the counter: front face, top, the left side going back
  const cx0 = x0 + pw, cx1 = x1 - pw
  const cf = `M${f1(cx0)} ${f1(yc)}L${f1(cx1)} ${f1(yc)}L${f1(cx1)} ${f1(yg)}L${f1(cx0)} ${f1(yg)}Z`
  const ctb0 = bk([cx0, yc], 0.95), ctb1 = bk([cx1, yc], 0.95)
  const ctop = `M${f1(cx0 - 2)} ${f1(yc)}L${f1(cx1 + 2)} ${f1(yc)}L${P(ctb1)}L${P(ctb0)}Z`
  const cgb = bk([cx0, yg], 0.95)
  const cside = `M${f1(cx0)} ${f1(yc)}L${P(ctb0)}L${P(cgb)}L${f1(cx0)} ${f1(yg)}Z`
  let boards = ''
  for (let x = cx0 + (cx1 - cx0) * 0.08; x < cx1; x += (cx1 - cx0) * (0.08 + q() * 0.04)) boards += stroke([[x, yc + H * 0.008], [x + 0.6, yg]], 1.1, 0.1, 0.1, 0.5)
  // the phone: on a flat stone on the counter, standing; a few laid flat beside it
  const ph = (yg - yc) * (wide ? 0.4 : 0.34), pwd = ph * 0.5
  const px = cx0 + (cx1 - cx0) * (wide ? 0.6 : 0.42), py = yc - (yc - ctb0[1]) * 0.45
  const stone = blob(px, py + ph * 0.02, pwd * 1.1, ph * 0.1, 2974, 0.15, 14)
  let laid = ''
  for (let i = 0; i < 3; i++) {
    const lx = cx0 + (cx1 - cx0) * (0.1 + i * 0.13), ly = py - ph * 0.02 + i * 0.6
    laid += `M${f1(lx)} ${f1(ly)}l${f1(pwd * 0.9)} ${f1(-1.6)}l${f1(pwd * 0.16)} ${f1(-ph * 0.08)}l${f1(-pwd * 0.9)} ${f1(1.6)}Z`
  }
  // the lantern hangs from the beam's left end; its pool on the sand and the near page
  const lr = clamp((x1 - x0) * 0.055, 8, 17), lx = x0 - pw * 0.6, ly = ye + lr * 1.6
  const [pgx, pgy] = onStrip(g, 0.5, g.page + 0.25)
  // the board: a plank hung by two cords from the beam, between the posts, above the counter
  const bw = (x1 - x0) * (wide ? 0.72 : 0.86), bx = x0 + (x1 - x0) * (wide ? 0.16 : 0.07), by = ye + (yc - ye) * (wide ? 0.12 : 0.05)
  const cords = stroke([[bx + bw * 0.12, ye], [bx + bw * 0.12, by]], 1, 0.1, 0.1, 0.6) + stroke([[bx + bw * 0.88, ye], [bx + bw * 0.88, by]], 1, 0.1, 0.1, 0.6)
  // the tags hang from a peg on the phone's stone over the counter's front edge (their strings drawn here)
  const tag: Pt = [px - pwd * 0.4, yc + 4]
  const strings = stroke(curve([px - pwd * 0.2, py], [px - pwd * 0.5, yc - 2], [tag[0] + 10, tag[1] + 6], 8), 0.9, 0.1, 0.1, 0.8) +
    stroke(curve([px - pwd * 0.1, py], [px + pwd * 0.1, yc - 2], [tag[0] + (wide ? 74 : 60), tag[1] + 6], 8), 0.9, 0.1, 0.1, 0.8)
  return {
    tag,
    board: [bx, by, bw],
    els: [
      s('ellipse', { class: 't29b-pool', cx: f1((lx + pgx) / 2), cy: f1((ly + pgy) / 2 + H * 0.12), rx: f1(Math.abs(pgx - lx) * 0.9 + W * 0.05), ry: f1(H * 0.2), fill: 'url(#t29-lamp)' }),
      // contact shadows of the posts and the counter on the sand (the moon is far: they fall a little toward us)
      s('path', { class: 't29b-contact', d: blob((x0 + x1) / 2 + pw * 2, yg + H * 0.008, (x1 - x0) * 0.58, H * 0.022, 2968, 0.08, 20) }),
      post(backL[0], backL[1], pw * k, 't29b-post t29b-post-back'),
      post(backR[0], backR[1], pw * k, 't29b-post t29b-post-back'),
      s('path', { class: 't29b-under', d: under }),
      s('path', { class: 't29b-rafter', d: rafters }),
      s('path', { class: 't29b-beam t29b-beam-side', d: beamS }),
      s('path', { class: 't29b-counter-side', d: cside }),
      s('path', { class: 't29b-counter-top', d: ctop }),
      s('path', { class: 't29b-counter', d: cf }),
      s('path', { class: 't29b-boards', d: boards }),
      s('ellipse', { class: 't29b-warm', cx: f1(lx + (x1 - x0) * 0.1), cy: f1(yc + (yg - yc) * 0.25), rx: f1((x1 - x0) * 0.55), ry: f1((yg - yc) * 0.8), fill: 'url(#t29-lamp)' }),
      post(posts[0][0], posts[0][1], pw, 't29b-post'),
      post(posts[1][0], posts[1][1], pw, 't29b-post'),
      s('path', { class: 't29b-beam', d: beamF }),
      s('path', { class: 't29b-roof', d: edge }),
      s('path', { class: 't29b-tiles', d: tiles }),
      s('path', { class: 't29b-roof-rim', d: stroke([[fL[0] - 2, fL[1] - th], [fR[0] + 2, fR[1] - th]], Math.max(1.2, H * 0.003), 0.1, 0.1, 0.3) }),
      s('path', { class: 't29b-cords', d: cords }),
      s('path', { class: 't29b-phones', d: laid }),
      s('path', { class: 't29b-pstone', d: stone }),
      s('rect', { class: 't29b-tablet', x: f1(px - pwd / 2), y: f1(py - ph), width: f1(pwd), height: f1(ph), rx: f1(pwd * 0.14) }),
      s('rect', { class: 't29b-screen', x: f1(px - pwd * 0.38), y: f1(py - ph * 0.92), width: f1(pwd * 0.76), height: f1(ph * 0.8), rx: f1(pwd * 0.06) }),
      s('path', { class: 't29b-string', d: strings }),
      paperLantern(lx, ly, lr, 2970, lr * 0.8),
      s('path', { class: 't29b-cords', d: stroke([[lx, ye], [lx, ly - lr * 0.9]], 1, 0.1, 0.1, 0.6) }),
      grass(x1 + pw * 2, yg + 2, (x1 - x0) * 0.2, 2973),
      grass(x0 - pw * 3, yg + 2, (x1 - x0) * 0.14, 2969),
    ],
  }
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
    s('ellipse', { class: 't29b-pw-sh', cx: 5, cy: 13, rx: 32, ry: 10 }),
    s('ellipse', { class: 't29b-pw-side', cx: 0, cy: 6, rx: 30, ry: 14 }),
    s('ellipse', { class: 't29b-pw-top', cx: 0, cy: 0, rx: 30, ry: 14 }),
    s('ellipse', { class: 't29b-pw-moon', cx: -6, cy: -3, rx: 10, ry: 4.6 }),
    s('path', { class: 't29b-pw-rim', d: stroke([[-27, -2], [-11, -12], [11, -13]] as Pt[], 2.2, 0.3, 0.3, 0.1) }),
    s('path', { class: 't29b-pw-ink', d: stroke([[-30, 1], [-22, 14], [0, 20], [22, 14], [30, 3]] as Pt[], 2.6, 0.2, 0.2, 0.3) }))
}
