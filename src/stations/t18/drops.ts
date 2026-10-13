import { h, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { C, type Copy } from './data'
import { brush, clamp, ell, fit, later, place, stable, stoneDefs, watch, type Pt } from './ink'
import { VESSELS, type Vessel } from './vessels'

const S = C.scenes.drops
const VW = 400
const VH = 300
type TL = ReturnType<typeof gsap.timeline>

/** Tiny brushed glyphs for the three measures: power, water, emissions. */
function glyph(i: number) {
  const d = [
    brush([[9, 1], [4, 9], [11, 8], [6, 17]], 2.6, { straight: true, a: 0.1, b: 0.3, min: 0.4 }).d,
    'M9 1.5C6.5 6 4 8.5 4 11.5a5 5 0 0 0 10 0C14 8.5 11.5 6 9 1.5Z',
    'M4.5 14.5h9.5a3.4 3.4 0 0 0 .3-6.8 4.6 4.6 0 0 0-8.8-.9A3.9 3.9 0 0 0 4.5 14.5Z',
  ][i]
  return s('svg', { class: 't18d-glyph', viewBox: '0 0 18 18', 'aria-hidden': 'true' }, s('path', { d, filter: 'url(#ink-rough)' }))
}

/** The three measures at stop i (value + a plain-language note). */
function metricRow(i: number) {
  const vals: HTMLElement[] = []
  const notes: HTMLElement[] = []
  const el = h('div', { class: 't18d-metrics' }, ...S.metrics.map((m, j) => {
    vals.push(h('span', { class: 't18d-val' }, m.values[i]))
    notes.push(h('span', { class: 't18d-note' }, m.notes[i]))
    return h('div', { class: 't18d-metric' }, h('span', { class: 't18d-mname' }, glyph(j), m.name), vals[j], notes[j])
  }))
  const set = (k: number) => S.metrics.forEach((m, j) => {
    vals[j].textContent = m.values[k]
    notes[j].textContent = m.notes[k]
  })
  return { el, vals, set }
}

/**
 * Shared frame for both water scenes: the ink picture on the left (or top) and a panel on the right (or bottom).
 * Until `shown`, the picture sits alone in the middle; showing the panel glides it aside.
 */
function frame(ctx: SceneCtx, desc: string, copies: Copy[], panel: HTMLElement, shown: boolean) {
  const low = ctx.quality === 'low'
  const pics: Vessel[] = VESSELS.map((f) => f(low))
  const svg = s('svg', { class: 't18d-svg', viewBox: `0 0 ${VW} ${VH}`, 'aria-hidden': 'true' },
    s('defs', null, stoneDefs('t18d-pstone')))
  const falling = s('g')
  pics.forEach((p, i) => {
    p.g.setAttribute('opacity', i ? '0' : '1')
    if (i) p.g.setAttribute('visibility', 'hidden')
    svg.append(p.g)
  })
  svg.append(falling)
  const stage = h('div', { class: 't18d-stage' }, svg)
  const vlab = h('p', { class: 't18-lab t18d-vlab', 'aria-hidden': 'true' }, S.vessels[0])
  const status = h('p', { class: 'visually-hidden', 'aria-live': 'polite' })
  panel.hidden = !shown
  const root = h('div', { class: 't18 t18d' }, h('p', { class: 'visually-hidden' }, desc), stage, vlab, panel, status)
  ctx.art.append(root)
  const st = stable(ctx, copies, root)

  const v = {
    root, stage, svg, pics, vlab, falling, status, cur: 0, shown,
    box: { x: 0, y: 0, w: 0, h: 0 },
    target() {
      const W = root.clientWidth
      const H = root.clientHeight
      const wide = W / H > 1.05
      const compact = H < 400 || W < 520
      root.classList.toggle('wide', wide)
      root.classList.toggle('compact', compact)
      root.classList.toggle('tiny', wide && H < 280)
      // the picture never grows past a comfortable size on very large screens
      const cap = (f: ReturnType<typeof fit>, bw: number, bh: number) => {
        const k = Math.min(1, 820 / f.w)
        return { k: f.k * k, w: f.w * k, h: f.h * k, x: f.x + (bw - f.w * k - 2 * f.x) / 2, y: f.y + (bh - f.h * k - 2 * f.y) / 2 }
      }
      if (!v.shown) return cap(fit(W, H, VW, VH), W, H)
      if (wide) {
        const pw = compact ? Math.min(W * 0.56, 470) : clamp(W * 0.44, 300, 470)
        panel.style.width = `${pw}px`
        const f = cap(fit(W - pw - 24, H, VW, VH), W - pw - 24, H)
        // picture and panel travel together, centred as one composition
        const gap = clamp(W * 0.04, 24, 72)
        const x0 = Math.max(0, (W - (f.w + gap + pw)) / 2)
        place(panel, Math.min(W - pw, x0 + f.w + gap), Math.max(0, (H - panel.offsetHeight) / 2))
        return { ...f, x: x0 }
      }
      // portrait: the panel sits under the picture with a breath of space above the insight
      panel.style.width = `${W}px`
      place(panel, 0, H - panel.offsetHeight - 12)
      return fit(W, H - panel.offsetHeight - 20, VW, VH, 0.5, 0.65)
    },
    placeLabel() {
      const W = root.clientWidth
      const k = v.box.w / VW
      const [lx, ly] = pics[v.cur].label
      const w = vlab.offsetWidth
      place(vlab, clamp(v.box.x + lx * k - w / 2, 2, W - w - 2), Math.max(0, v.box.y + ly * k - vlab.offsetHeight / 2))
    },
    apply(b: { x: number; y: number; w: number; h: number }) {
      v.box = b
      place(stage, b.x, b.y, b.w, b.h)
      v.placeLabel()
    },
    layout(anim = false) {
      st.apply()
      const t = v.target()
      if (anim && !ctx.reduced && !low) {
        const from = { ...v.box }
        ctx.anim(() => gsap.to(from, { ...t, duration: 1.2, ease: 'power3.inOut', onUpdate: () => v.apply(from) }))
      } else v.apply(t)
    },
  }
  watch(ctx, () => {
    st.reset()
    v.layout(false)
  })
  if (!ctx.reduced) gsap.fromTo(svg, { opacity: 0, scale: 0.97 }, { opacity: 1, scale: 1, duration: 1.6, ease: 'power2.out', delay: 0.2 })
  return v
}

/** Five drops fall from the spout and bead up on the leaf. Returns the end time. */
function dropTimeline(pic: Vessel, falling: SVGGElement, tl: TL, at = 0) {
  const d = pic.drops!
  falling.replaceChildren()
  d.at.forEach((p, i) => {
    const drop = s('path', { class: 'bead', d: 'M0 -7C2 -3 3.4 -0.6 3.4 1.4a3.4 3.4 0 0 1-6.8 0C-3.4-0.6-2-3 0-7Z', opacity: 0 })
    const ring = s('path', { d: ell(p[0], p[1] + 1, 6, 2), fill: 'none', class: 'ring', opacity: 0 })
    falling.append(drop, ring)
    const t0 = at + i * 0.62
    tl.set(d.beads[i], { opacity: 0 }, at)
    tl.fromTo(drop, { x: d.mouth[0], y: d.mouth[1], opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.18 }, t0)
    tl.to(drop, { x: p[0], y: p[1] - 2, duration: 0.5, ease: 'power2.in' }, t0 + 0.12)
    tl.set(drop, { opacity: 0 }, t0 + 0.62)
    tl.fromTo(d.beads[i], { opacity: 0, scale: 0.3, svgOrigin: `${p[0]} ${p[1]}` }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(3)' }, t0 + 0.6)
    tl.fromTo(ring, { opacity: 0.8, scale: 0.6, svgOrigin: `${p[0]} ${p[1]}` }, { opacity: 0, scale: 3.4, duration: 0.9, ease: 'power2.out' }, t0 + 0.6)
  })
  return at + d.at.length * 0.62 + 0.6
}

const showBeads = (pic: Vessel) => pic.drops!.beads.forEach((b) => gsap.set(b, { opacity: 1, scale: 1 }))

// ───────── one question: five drops, its cost, and the caveats right beside it ─────────
export function oneScene(ctx: SceneCtx) {
  const m = metricRow(0)
  const caveats = h('div', { class: 't18d-cav' },
    h('p', { class: 't18d-cavt' }, S.caveatsTitle),
    h('ul', null, ...S.caveats.map((c) => ctx.fact(c, 'li'))))
  const panel = h('div', { class: 't18d-panel' }, ctx.fact(S.head, 'p', 't18d-head'), m.el, caveats)
  const v = frame(ctx, S.art, [S.insightOne], panel, false)
  const hit = h('button', { class: 't18d-hit', type: 'button', 'aria-label': S.ask })
  v.root.append(hit)
  const apply = v.apply
  v.apply = (b) => {
    apply(b)
    place(hit, b.x, b.y, b.w, b.h)
  }
  v.layout(false)
  gsap.set(v.vlab, { opacity: 0 })

  let asked = false
  let tl: TL | null = null
  function ask() {
    ctx.chime('soft')
    const first = !asked
    asked = true
    const show = () => {
      v.shown = true
      panel.hidden = false
      v.layout(true)
      v.status.textContent = S.metrics.map((x) => `${x.name} ${x.values[0]}`).join(', ')
    }
    if (ctx.reduced) {
      showBeads(v.pics[0])
      gsap.set(v.vlab, { opacity: 1 })
      if (first) {
        show()
        ctx.insight(S.insightOne, S.detailOne)
      }
      return
    }
    tl?.progress(1)
    ctx.anim(() => {
      const t = gsap.timeline()
      tl = t
      const end = dropTimeline(v.pics[0], v.falling, t)
      if (!first) return
      t.add(() => later(show), end - 0.3)
      t.fromTo(panel, { opacity: 0 }, { opacity: 1, duration: 1.2, ease: 'power2.out', immediateRender: false }, end + 0.2)
      t.fromTo(panel.children, { opacity: 0, y: 10 }, { opacity: 1, y: 0, stagger: 0.14, duration: 0.9, ease: 'power3.out', immediateRender: false }, end + 0.3)
      t.fromTo(v.vlab, { opacity: 0 }, { opacity: 1, duration: 1, immediateRender: false }, end + 0.4)
      t.add(() => ctx.insight(S.insightOne, S.detailOne), end + 1.3)
    })
  }
  hit.addEventListener('click', ask)
  ctx.prompt(S.prompt)
  return () => tl?.kill()
}

// ───────── multiplied: the zoom flies out of one vessel into the next ─────────
export function manyScene(ctx: SceneCtx) {
  const headOne = ctx.fact(S.head, 'p', 't18d-head')
  const times = h('span', { class: 't18d-times' })
  const headMany = h('div', { class: 't18d-head many' }, times, ctx.fact(S.times, 'span', 't18d-tfact'))
  const m = metricRow(0)
  const range = h('input', { class: 'range t18d-range', type: 'range', min: 0, max: 3, step: 1, value: 0, 'aria-label': S.slider, 'aria-valuetext': S.stopsAria[0] }) as HTMLInputElement
  const ticks = S.stops.map((t, i) => h('button', { type: 'button', class: 't18d-tick', tabindex: '-1', 'aria-hidden': 'true', onClick: () => go(i) }, t))
  const slider = h('div', { class: 't18d-slider' }, range, h('div', { class: 't18d-ticks' }, ...ticks))
  const habits = S.habits.map((t) => h('li', { class: 't18d-habit' }, h('span', { class: 't18d-sprout', 'aria-hidden': 'true' }), t))
  const habitBox = h('div', { class: 't18d-habits' }, h('p', { class: 't18d-cavt' }, S.habitsTitle), h('ul', null, ...habits))
  const panel = h('div', { class: 't18d-panel many' }, headOne, headMany, m.el, slider, habitBox)
  const v = frame(ctx, S.artMany, [S.insight], panel, true)
  showBeads(v.pics[0])
  // at a billion: where the data centre stands matters too — a caption by the pond
  const where = ctx.fact(S.where, 'p', 't18-lab t18d-where')
  where.hidden = true
  v.root.append(where)
  const placeWhere = () => {
    const at = v.pics[3].note
    if (!at || where.hidden) return
    const k = v.box.w / VW
    const W = v.root.clientWidth
    const w = where.offsetWidth
    place(where, clamp(v.box.x + at[0] * k - w / 2, 2, W - w - 2), Math.min(v.box.y + at[1] * k, v.box.y + v.box.h - where.offsetHeight))
  }
  const apply = v.apply
  v.apply = (b) => {
    apply(b)
    placeWhere()
  }

  const shownH = new Set<number>()
  let busy: TL | null = null

  function setTexts(i: number) {
    headOne.hidden = i > 0
    headMany.hidden = i === 0
    times.textContent = `× ${S.stops[i]}`
    m.set(i)
    v.vlab.textContent = S.vessels[i]
    ticks.forEach((t, j) => t.classList.toggle('on', j === i))
    range.value = String(i)
    range.style.setProperty('--fill', `${(i / 3) * 100}%`)
    range.setAttribute('aria-valuetext', S.stopsAria[i])
    v.status.textContent = `${S.stopsAria[i]}: ${S.metrics.map((x) => `${x.name} ${x.values[i]}`).join(', ')}`
  }

  function revealHabits(upTo: number) {
    habits.forEach((el, j) => {
      if (j >= upTo || shownH.has(j)) return
      shownH.add(j)
      el.classList.add('on')
      if (!ctx.reduced) ctx.anim(() => gsap.fromTo(el, { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: 0.9, delay: 0.5 + j * 0.1, ease: 'power3.out' }))
    })
  }

  function go(i: number) {
    i = Math.max(0, Math.min(3, i))
    if (i === v.cur) return
    const from = v.cur
    v.cur = i
    setTexts(i)
    revealHabits(i)
    // the keyboard moves the slider without a pointer: let the hint go all the same
    ctx.art.dispatchEvent(new Event('pointerdown'))
    if (i === 3) {
      ctx.insight(S.insight)
      ctx.chime('ok')
    }
    const showWhere = i === 3
    if (showWhere !== !where.hidden) {
      where.hidden = !showWhere
      placeWhere()
      if (showWhere && !ctx.reduced) ctx.anim(() => gsap.fromTo(where, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 1.2, delay: 1.6, ease: 'power3.out' }))
    }
    const a = v.pics[from]
    const b = v.pics[i]
    busy?.progress(1)
    busy = null
    if (ctx.reduced) {
      v.pics.forEach((p, j) => {
        p.g.setAttribute('opacity', j === i ? '1' : '0')
        p.g.setAttribute('visibility', j === i ? 'visible' : 'hidden')
      })
      b.fill(1)
      v.placeLabel()
      return
    }
    // zoom origin: the point where the smaller picture's vessel sits inside the bigger one
    const out = i > from
    const big = out ? b : a
    const small = out ? a : b
    let O: Pt = [VW / 2, VH * 0.7]
    let k = 0.12
    if (Math.abs(i - from) === 1 && big.proxy) {
      k = big.proxy.k
      const q = big.proxy.at
      const p = small.self
      O = [(q[0] - k * p[0]) / (1 - k), (q[1] - k * p[1]) / (1 - k)]
    }
    const org = `${O[0]} ${O[1]}`
    b.fill(0)
    ctx.anim(() => {
      const tl = gsap.timeline()
      busy = tl
      b.g.setAttribute('visibility', 'visible')
      gsap.set(v.vlab, { opacity: 0 })
      gsap.set(a.g, { svgOrigin: org, smoothOrigin: false, x: 0, y: 0, scale: 1, opacity: 1 })
      gsap.set(b.g, { svgOrigin: org, smoothOrigin: false, x: 0, y: 0, scale: out ? 1 / k : k, opacity: 0 })
      tl.to(a.g, { scale: out ? k : 1 / k, opacity: 0, duration: 1.5, ease: 'power2.inOut' }, 0)
      tl.to(b.g, { scale: 1, opacity: 1, duration: 1.5, ease: 'power2.inOut' }, 0)
      tl.set(a.g, { attr: { visibility: 'hidden' } })
      const w = { k: 0 }
      tl.to(w, { k: 1, duration: 1.6, ease: 'power2.inOut', onUpdate: () => b.fill(w.k) }, 1.1)
      tl.add(() => v.placeLabel(), 1.3)
      tl.to(v.vlab, { opacity: 1, duration: 0.9 }, 1.4)
      if (i === 0) dropTimeline(b, v.falling, tl, 1.2)
      tl.fromTo(m.vals, { opacity: 0, filter: 'blur(4px)' }, { opacity: 1, filter: 'blur(0px)', duration: 0.8, stagger: 0.1 }, 0.3)
    })
  }

  range.addEventListener('input', () => go(Number(range.value)))
  v.pics.forEach((p, i) => i && p.fill(0))
  setTexts(0)
  ctx.prompt(S.multiply)
  return () => busy?.kill()
}
