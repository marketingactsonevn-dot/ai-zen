import { fill, h, nextId, s, viDate } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { company, loadLogos, logoStone, type Company, type Model } from '../../ui/logo'
import { brush, ell, peaks, rng, type Pt } from '../t03/brush'
import { deskGlyph } from './desks'
import { C, type LaneItem } from './data'

const P = C.scenes.compare
type Open = 'open' | 'closed' | 'unknown'

interface Resolved {
  it: LaneItem
  co: Company
  /** every model on this stone (merged siblings share one) */
  ms: Model[]
  m?: Model
  name: string
  /** the name as set on the stone: never broken at a hyphen; long names in two balanced lines */
  lines: string[]
  open: Open
}

function twoLines(name: string): string[] {
  const t = name.replace(/-/g, '‑').replace(/ \/ /g, ' / ')
  if (t.length <= 18) return [t]
  const w = t.split(' ')
  let best = 1
  for (let i = 1; i < w.length; i++) if (Math.abs(w.slice(0, i).join(' ').length - w.slice(i).join(' ').length) < Math.abs(w.slice(0, best).join(' ').length - w.slice(best).join(' ').length)) best = i
  return [w.slice(0, best).join(' '), w.slice(best).join(' ')]
}

function resolve(it: LaneItem): Resolved {
  const co = company(it.company)!
  const ms = it.models.map((n) => co.models.find((x) => x.name === n)).filter((m): m is Model => !!m)
  const m = ms[0]
  const open: Open = it.open || m?.openWeights ? 'open' : m?.openWeights === false || co.weights === 'closed' ? 'closed' : 'unknown'
  const name = it.name ?? m?.name ?? co.name
  return { it, co, ms, m, name, lines: twoLines(name), open }
}

/** Scene 3 — a raked bed per kind of AI; each model is a stone carrying its maker's logo. Tap one to read it. */
export function compareScene(ctx: SceneCtx) {
  const lanes = P.lanes.map((ln) => ({ ...ln, items: ln.items.map(resolve) }))
  const panelId = nextId('t11p')
  const tabs = lanes.map((ln, i) =>
    h('button', { class: 't11-tab', type: 'button', role: 'tab', id: nextId('t11t'), 'aria-selected': 'false', 'aria-controls': panelId, tabindex: i ? '-1' : '0', onClick: () => showLane(i) },
      deskGlyph(ln.id), h('span', { class: 't11-tab-name' }, ln.name)))
  const tabList = h('div', { class: 't11-tabs', role: 'tablist', 'aria-label': P.tabs }, ...tabs)
  tabList.addEventListener('keydown', (e) => {
    const k = tabs.indexOf(document.activeElement as HTMLButtonElement)
    if (k < 0) return
    const n = tabs.length
    const to = { ArrowRight: k + 1, ArrowDown: k + 1, ArrowLeft: k - 1, ArrowUp: k - 1, Home: 0, End: n - 1 }[e.key]
    if (to === undefined) return
    e.preventDefault()
    const j = (to + n) % n
    tabs[j].focus()
    showLane(j)
  })

  const sand = s('svg', { class: 't11-sand', 'aria-hidden': 'true' })
  const stonesEl = h('div', { class: 't11-stones', role: 'group' })
  const legend = h('p', { class: 't11-legend' },
    ...(['closed', 'open', 'unknown'] as const).map((k) => h('span', null, h('i', { class: `t11-dot ${k}`, 'aria-hidden': 'true' }), P.legend[k])),
    h('span', { class: 't11-asof' }, P.asOf))
  const panel = h('div', { class: 't11-lane', role: 'tabpanel', id: panelId }, sand, stonesEl)
  const card = h('div', { class: 't11-mcard', 'aria-live': 'polite' })
  const root = h('div', { class: 't11 t11-cmp' }, tabList, panel, card, legend)
  ctx.art.append(root)
  ctx.prompt(P.prompt)

  let li = -1
  let sel = -1
  let btns: HTMLButtonElement[] = []
  let size = 48
  let disposed = false
  const timers: number[] = []
  const opened = new Set<string>()
  const rings: SVGEllipseElement[][] = []

  function showLane(i: number) {
    if (i === li) return
    const first = li < 0
    li = i
    sel = -1
    pan(0)
    root.classList.remove('has-pick')
    tabs.forEach((t, j) => {
      t.setAttribute('aria-selected', String(j === i))
      t.tabIndex = j === i ? 0 : -1
    })
    panel.setAttribute('aria-labelledby', tabs[i].id)
    stonesEl.setAttribute('aria-label', fill(P.stones, { lane: lanes[i].name }))
    const build = () => {
      if (disposed) return
      const ln = lanes[i]
      btns = ln.items.map((r, k) =>
        h('button', { class: `t11-stone ls-host${r.m?.status === 'discontinued' ? ' gone' : ''}`, type: 'button', 'aria-pressed': 'false', 'aria-label': fill(P.stoneAria, { model: r.name, maker: r.co.name, status: P.status[r.open] }), onClick: () => pick(k) },
          logoStone(r.co.id, { size, decorative: true }),
          h('span', { class: `t11-sname${r.lines.length > 1 ? ' two' : ''}` }, h('i', { class: `t11-dot ${r.open}`, 'aria-hidden': 'true' }), r.lines[0], ...(r.lines[1] ? [h('br'), r.lines[1]] : []))))
      stonesEl.replaceChildren(...btns)
      layout()
      // name badges widen once the logo manifest has answered: rake again around their real size
      loadLogos().then(() => !disposed && requestAnimationFrame(drawSand))
      if (!ctx.reduced)
        ctx.anim(() => {
          gsap.from(btns, { opacity: 0, y: -18, duration: 0.9, stagger: 0.05, ease: 'power3.out', clearProps: 'opacity,transform' })
          rings.flat().forEach((r, k) => gsap.from(r, { opacity: 0, duration: 1.4, delay: 0.2 + (k >> 1) * 0.05 }))
        })
    }
    intro(i)
    if (first || ctx.reduced) build()
    else ctx.anim(() => gsap.to(btns, { opacity: 0, y: 10, duration: 0.3, stagger: 0.015, ease: 'power2.in', onComplete: () => void timers.push(window.setTimeout(build)) }))
  }

  /** Before a stone is picked, the card shows which desk this lane is — the same worker as in scene 1. */
  function intro(i: number) {
    const d = C.scenes.team.desks[lanes[i].id]
    card.classList.add('is-intro')
    card.replaceChildren(h('div', { class: 't11-intro', 'aria-hidden': 'true' }, deskGlyph(lanes[i].id), h('p', { class: 't11-intro-name' }, d.name), h('p', { class: 't11-intro-role' }, d.role)))
    if (!ctx.reduced) ctx.anim(() => gsap.from(card.firstElementChild!.children, { opacity: 0, y: 8, filter: 'blur(4px)', duration: 0.9, stagger: 0.1, ease: 'power3.out', delay: 0.2 }))
  }

  const row = (label: string, value: HTMLElement | string) =>
    h('div', { class: 't11-row' }, h('dt', null, label), h('dd', null, value))
  const src = (r: Resolved, text: string): Fact => ({ text, asOf: r.m?.asOf ?? P.detail.asOf, source: 'brief-2026-10-12' })
  /** one value per model, "Kling 3.0: 05/02/2026 · Kling 3.0 Turbo: 17/06/2026", each with its own source */
  const perModel = (facts: Fact[]) =>
    facts.length === 1 ? ctx.fact(facts[0], 'span') : h('span', { class: 't11-multi' }, ...facts.map((f) => ctx.fact(f, 'span')))

  function pick(k: number) {
    const r = lanes[li].items[k]
    const prev = sel
    sel = k
    btns.forEach((b, j) => {
      b.setAttribute('aria-pressed', String(j === k))
      b.classList.toggle('sel', j === k)
    })
    const merged = r.ms.length > 1
    const tag = (m: Model, text: string, sep = ': ') => (merged ? `${m.name}${sep}${text}` : text)
    const accessText = r.it.access?.text
    // a model note that only repeats another row is left out (a shut-down date already in Truy cập, a licence in Đóng / mở)
    const notes: Fact[] = r.it.note
      ? [r.it.note]
      : r.ms
          .filter((m) => m.note && m.note !== accessText && m.note !== r.it.weights?.text && !(m.status === 'discontinued' && r.it.access))
          .map((m) => ({ text: tag(m, m.note!, ' — '), asOf: m.asOf, source: m.source }))
    // "Dùng online" is already said by the strengths: no second row for it
    const norm = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
    const accessSaid = !!(r.it.access && r.m?.strengths && norm(r.m.strengths.text).includes(norm(r.it.access.text)))
    const dates: Fact[] = r.ms.filter((m) => m.date).map((m) => ({ text: tag(m, viDate(m.date)), asOf: m.asOf, source: m.source, verify: m.verify }))
    const what = r.m?.strengths
      ? row(P.rows.strengths, ctx.fact(r.m.strengths, 'span'))
      : !notes.length && r.co.focus
        ? row(P.rows.focus, ctx.fact(r.co.focus, 'span'))
        : notes.length
          ? null
          : row(P.rows.strengths, P.none)
    const weights = r.it.weights
      ? ctx.fact(r.it.weights, 'span')
      : r.open === 'open'
        ? ctx.fact(src(r, P.weights.open), 'span')
        : r.open === 'closed'
          ? ctx.fact(src(r, P.weights.closed), 'span')
          : P.none
    const title = h('h3', { class: 't11-mname' }, r.name)
    const close = h('button', { class: 't11-mclose', type: 'button', 'aria-label': P.close, onClick: () => unpick(k) }, '×')
    if (r.m?.verify && !dates.length) title.append(' ', ctx.tag('verify'))
    card.replaceChildren(
      close,
      h('div', { class: 't11-mhead' },
        logoStone(r.co.id, { size: 40, decorative: true, float: false }),
        h('div', null, title, h('p', { class: 't11-mmaker' }, `${P.rows.maker}: ${r.co.name}`))),
      h('dl', { class: 't11-rows' },
        what,
        notes.length ? row(P.rows.note, perModel(notes)) : null,
        row(P.rows.weights, weights),
        accessSaid ? null : row(P.rows.access, r.it.access ? ctx.fact(r.it.access, 'span') : P.none),
        dates.length ? row(P.rows.date, perModel(dates)) : null))
    card.classList.remove('is-intro')
    root.classList.add('has-pick')
    dock(k)
    ctx.chime('tap')
    if (!ctx.reduced)
      ctx.anim(() => {
        gsap.fromTo([...card.children].slice(1), { opacity: 0, y: 10, filter: 'blur(4px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.8, stagger: 0.08, ease: 'power3.out' })
        if (prev !== k) gsap.fromTo(rings[k] ?? [], { attr: { rx: size * 0.7, ry: size * 0.25 }, opacity: 0.9 }, { attr: { rx: size * 1.9, ry: size * 0.68 }, opacity: 0, duration: 2.2, stagger: 0.35, ease: 'power2.out' })
      })
    opened.add(`${li}-${k}`)
    if (opened.size === 3) ctx.insight(P.insight, P.detail)
  }

  /** Phones and short screens: the card floats over the bed, on the side away from the picked stone. */
  function dock(k: number) {
    const tall = root.dataset.mode === 'tall'
    const short = root.classList.contains('short')
    const b = btns[k]
    const st = card.style
    st.top = st.bottom = st.left = st.right = ''
    if (!b || tall || !short) pan(0)
    if (!b || (!tall && !short)) return
    if (tall) {
      const low = b.offsetTop + stonesEl.offsetTop + b.offsetHeight / 2 < panel.clientHeight / 2
      if (low) st.bottom = `${root.clientHeight - panel.offsetTop - panel.clientHeight}px`
      else st.top = `${panel.offsetTop}px`
      return
    }
    // short screens: the card stands on the side with more room past the stone's edges (stone and name, measured);
    // if it would still cover the stone, the bed slides the stone clear, like a camera panning
    const cx = panel.offsetLeft + stonesEl.offsetLeft + b.offsetLeft + b.offsetWidth / 2
    const half = Math.max(...[...b.children].map((c) => (c as HTMLElement).offsetWidth)) / 2 + 10
    const L0 = panel.offsetLeft
    const R0 = root.clientWidth
    const cw = card.offsetWidth
    const right = R0 - (cx + half) >= cx - half - L0
    st.top = `${panel.offsetTop + 2}px`
    if (right) st.right = '0px'
    else st.left = `${L0}px`
    const over = right ? cx + half - (R0 - cw) : L0 + cw - (cx - half)
    pan(over > 0 ? (right ? -over : over) : 0)
  }

  let panX = 0
  function pan(x: number) {
    if (Math.abs(x - panX) < 1) return
    panX = x
    root.classList.toggle('panned', x !== 0)
    if (ctx.reduced) gsap.set([sand, stonesEl], { x })
    else ctx.anim(() => gsap.to([sand, stonesEl], { x, duration: 0.9, ease: 'power3.inOut', overwrite: 'auto' }))
  }

  function unpick(k: number) {
    sel = -1
    pan(0)
    root.classList.remove('has-pick')
    btns.forEach((b) => {
      b.setAttribute('aria-pressed', 'false')
      b.classList.remove('sel')
    })
    intro(li)
    btns[k]?.focus()
  }
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sel >= 0) {
      e.stopPropagation()
      unpick(sel)
    }
  })

  // ───────── layout: stone size, then the raked bed around where the stones landed ─────────
  function layout() {
    const W = root.clientWidth
    const H = root.clientHeight
    if (!W || !H) return
    const wide = W / H > 1.25
    root.dataset.mode = wide ? 'wide' : 'tall'
    const short = H < 330
    root.classList.toggle('short', short)
    if (li < 0) return
    const pw = panel.clientWidth
    const ph = panel.clientHeight - (short ? 6 : 12)
    const items = lanes[li].items
    const n = items.length
    const two = items.some((r) => r.lines.length > 1)
    const fs = short ? 11.5 : Math.min(14.7, Math.max(11.8, W * 0.0102))
    const lh = fs * 1.2
    const nameH = (two ? 2 : 1) * lh + (short ? 6 : 10)
    const longest = Math.max(...items.map((r) => Math.max(...r.lines.map((l) => l.length))))
    const nameW = longest * fs * 0.53 + 14
    // biggest stones that fit; a layout whose names would collide is marked down. Every other column steps down 0.3×.
    const cap = Math.min(140, ph * 0.24)
    const cands: { sz: number; cols: number; rows: number }[] = []
    for (let rows = 1; rows <= n; rows++) {
      const cols = Math.ceil(n / rows)
      if (rows > 1 && Math.ceil(n / (rows - 1)) === cols) continue
      const colW = pw / cols
      let sz = Math.min((colW - 10) / 1.75, (ph - rows * (nameH + (short ? 10 : 22))) / (rows * 1.4 + (cols > 1 ? 0.3 : 0)), cap)
      // every other column steps down, so a name may run a little past its own column
      if (nameW > colW * (cols > 1 ? 1.6 : 1) - 4) sz *= 0.72
      cands.push({ sz, cols, rows })
    }
    // near-ties go to the arrangement shaped most like the panel: six stones as 3 + 3, not one thin row
    const top = Math.max(...cands.map((c) => c.sz))
    const misfit = (c: (typeof cands)[number]) => Math.abs(Math.log((c.cols * c.sz * 1.9) / (c.rows * (c.sz * 1.45 + nameH + 22)) / (pw / ph)))
    const best = cands.filter((c) => c.sz >= top * 0.95).sort((a, b) => misfit(a) - misfit(b))[0]
    size = Math.max(26, Math.floor(best.sz))
    stonesEl.style.setProperty('--cols', String(best.cols))
    stonesEl.style.setProperty('--sz', `${size}px`)
    stonesEl.style.setProperty('--fs', `${fs}px`)
    btns.forEach((b, k) => {
      ;(b.firstElementChild as HTMLElement).style.setProperty('--ls-size', `${size}px`)
      b.classList.toggle('low', (k % best.cols) % 2 === 1)
    })
    drawSand()
    if (sel >= 0) dock(sel)
  }

  /** Rounded rectangle traced as points, a hair uneven, for raking lines that curve round the bed's ends. */
  function contour(x0: number, y0: number, x1: number, y1: number, rad: number, seed: number): string {
    const pts: Pt[] = []
    const r = Math.max(0, Math.min(rad, (x1 - x0) / 2, (y1 - y0) / 2))
    const seg = (ax: number, ay: number, bx: number, by: number) => {
      const len = Math.hypot(bx - ax, by - ay)
      const m = Math.max(1, Math.ceil(len / 28))
      for (let i = 0; i < m; i++) pts.push([ax + ((bx - ax) * i) / m, ay + ((by - ay) * i) / m])
    }
    const corner = (cx: number, cy: number, a0: number) => {
      for (let i = 0; i < 6; i++) {
        const a = ((a0 + i * 15) * Math.PI) / 180
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
      }
    }
    seg(x0 + r, y0, x1 - r, y0)
    corner(x1 - r, y0 + r, -90)
    seg(x1, y0 + r, x1, y1 - r)
    corner(x1 - r, y1 - r, 0)
    seg(x1 - r, y1, x0 + r, y1)
    corner(x0 + r, y1 - r, 90)
    seg(x0, y1 - r, x0, y0 + r)
    corner(x0 + r, y0 + r, 180)
    return `M${pts.map(([x, y], i) => `${(x + 0.9 * Math.sin(i * 0.7 + seed)).toFixed(1)} ${(y + 0.9 * Math.cos(i * 0.5 + seed)).toFixed(1)}`).join('L')}Z`
  }

  function drawSand() {
    const W = panel.clientWidth
    const H = panel.clientHeight
    if (!W || !H) return
    sand.setAttribute('viewBox', `0 0 ${W} ${H}`)
    // layout offsets, not rects: entering / floating stones are mid-transform
    const at = btns.map((b) => {
      const ls = b.firstElementChild as HTMLElement
      return { x: stonesEl.offsetLeft + b.offsetLeft + ls.offsetLeft + ls.offsetWidth / 2, y: stonesEl.offsetTop + b.offsetTop + ls.offsetTop + ls.offsetHeight * 0.84, w: ls.offsetWidth }
    })
    // the bed: a long pill of sand around the stones (not the whole lane), feathered, raked in rings along its edge
    const padY = Math.max(12, size * 0.32)
    const padX = Math.max(14, size * 0.4)
    const ox = stonesEl.offsetLeft
    const oy = stonesEl.offsetTop
    let bx0 = Math.max(4, Math.min(...btns.map((b) => ox + b.offsetLeft)) - padX)
    let bx1 = Math.min(W - 4, Math.max(...btns.map((b) => ox + b.offsetLeft + b.offsetWidth)) + padX)
    let by0 = Math.max(4, Math.min(...btns.map((b) => oy + b.offsetTop)) - padY)
    let by1 = Math.min(H - 4, Math.max(...btns.map((b) => oy + b.offsetTop + b.offsetHeight)) + padY)
    // the raked garden fills the frame even for two stones
    const grow = (a: number, b: number, min: number, lim: number): [number, number] => {
      const d = Math.max(0, min - (b - a)) / 2
      const lo = Math.max(4, a - d)
      const hi = Math.min(lim - 4, b + d)
      return [Math.max(4, Math.min(lo, hi - min)), Math.min(lim - 4, Math.max(hi, lo + min))]
    }
    ;[by0, by1] = grow(by0, by1, H * 0.55, H)
    ;[bx0, bx1] = grow(bx0, bx1, W * 0.6, W)
    const rad = Math.min((by1 - by0) * 0.5, (bx1 - bx0) * 0.25)
    const blur = s('filter', { id: `${panelId}-b`, x: '-5%', y: '-5%', width: '110%', height: '110%' }, s('feGaussianBlur', { stdDeviation: Math.min(7, H * 0.025) }))
    const mask = s('mask', { id: `${panelId}-m`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H },
      s('path', { d: contour(bx0 + 4, by0 + 4, bx1 - 4, by1 - 4, rad - 4, 1), fill: '#fff', filter: `url(#${panelId}-b)` }),
      ...at.map((q) => s('path', { d: ell(q.x, q.y, q.w * 0.58 + 16, (q.w * 0.58 + 16) * 0.36), fill: '#000' })))
    const bedMask = s('mask', { id: `${panelId}-bm`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H },
      s('path', { d: contour(bx0, by0, bx1, by1, rad, 1), fill: '#fff', filter: `url(#${panelId}-b)` }))
    const defs: SVGDefsElement = s('defs', null, blur, mask, bedMask)
    const bed = s('path', { class: 'bed', d: contour(bx0, by0, bx1, by1, rad, 1), mask: `url(#${panelId}-bm)` })
    // three rings follow the bed's edge; inside them the rake runs straight, end to end
    const rk = s('g', { mask: `url(#${panelId}-m)` })
    const gap = 11
    const RINGS = 3
    for (let k = 1; k <= RINGS && k * gap < (by1 - by0) / 2 - 2; k++) {
      const i = k * gap
      const d = contour(bx0 + i, by0 + i, bx1 - i, by1 - i, rad - i, k * 0.8)
      rk.append(s('path', { d, class: 'rk' }), s('path', { d, class: 'rk-hi', transform: 'translate(0 1.5)' }))
    }
    const ii = (RINGS + 0.6) * gap
    defs.append(s('clipPath', { id: `${panelId}-c` }, s('path', { d: contour(bx0 + ii, by0 + ii, bx1 - ii, by1 - ii, rad - ii, 0) })))
    const straight = s('g', { 'clip-path': `url(#${panelId}-c)` })
    for (let y = by0 + ii + gap * 0.5, k = 0; y < by1 - ii; y += gap, k++) {
      const pts: string[] = []
      for (let x = bx0; x <= bx1 + 24; x += 24) pts.push(`${x} ${(y + 1.1 * Math.sin(x / 53 + k * 0.7)).toFixed(1)}`)
      const d = `M${pts.join('L')}`
      straight.append(s('path', { d, class: 'rk' }), s('path', { d, class: 'rk-hi', transform: 'translate(0 1.5)' }))
    }
    rk.append(straight)
    const ringG = s('g')
    rings.length = 0
    at.forEach((q, k) => {
      const set: SVGEllipseElement[] = []
      for (let j = 0; j < 2; j++) {
        const rx = q.w * 0.58 + 4 + j * 7
        const a = { cx: q.x, cy: q.y, rx, ry: rx * 0.36 }
        ringG.append(s('ellipse', { ...a, class: 'rk', fill: 'none' }), s('ellipse', { ...a, class: 'rk-hi', fill: 'none', transform: 'translate(0 1.5)' }))
      }
      // the moving rings for a picked stone (hidden until then)
      for (let j = 0; j < 2; j++) set.push(s('ellipse', { cx: q.x, cy: q.y, rx: q.w, ry: q.w * 0.36, class: 'ripple', opacity: 0 }))
      ringG.append(...set)
      rings[k] = set
    })
    // a dry-brush edge where the sand meets the moss, and a few pebbles gathered at two corners
    const r = rng(5 + li)
    const ex0 = bx0 + rad * 0.9
    const ex1 = bx1 - rad * 0.9
    const edge = s('g', { filter: 'url(#ink-rough)' },
      s('path', { class: 'k3', 'fill-opacity': 0.3, d: brush([[ex0, by1 - 0.5], [ex0 + (ex1 - ex0) * 0.4, by1 + 0.6], [ex1, by1 - 0.3]], 1.8, { a: 0.15, b: 0.45, min: 0.15, wob: 0.2 }).d }),
      s('path', { class: 'k3', 'fill-opacity': 0.18, d: brush([[ex1, by0 + 0.5], [ex0 + (ex1 - ex0) * 0.6, by0 - 0.6], [ex0 + (ex1 - ex0) * 0.2, by0 + 0.3]], 1.2, { a: 0.2, b: 0.5, min: 0.15, wob: 0.2 }).d }))
    const peb = s('g', { filter: 'url(#ink-rough)' })
    const sizes = Math.max(3, Math.min(7, H * 0.022))
    for (const [cx, cy, dir] of [[bx0 + rad * 0.35, by1 - rad * 0.2, 1], [bx1 - rad * 0.3, by0 + rad * 0.25, -1]] as const)
      for (let i = 0; i < 4; i++) {
        const rr = sizes * (1 - i * 0.18) * (0.8 + r() * 0.4)
        const x = cx + dir * (i * sizes * 2.1 + r() * sizes)
        const y = cy + (r() - 0.5) * sizes * 1.6 + dir * i * sizes * 0.5
        peb.append(s('path', { class: 'st', d: ell(x, y, rr * 1.35, rr) }), s('path', { class: 'k3', 'fill-opacity': 0.5, d: brush([[x - rr * 1.3, y + rr * 0.2], [x, y + rr * 0.95], [x + rr * 1.3, y + rr * 0.1]], Math.max(0.8, rr * 0.28), { a: 0.2, b: 0.3 }).d }))
      }
    // behind the bed: far ridges in wash on a faint horizon, so the garden has depth; moss gathers round the pebbles
    const fade = s('linearGradient', { id: `${panelId}-f` }, ...[[0, 0], [0.18, 1], [0.82, 1], [1, 0]].map(([o, a]) => s('stop', { offset: o, 'stop-color': '#fff', 'stop-opacity': a })))
    defs.append(fade, s('mask', { id: `${panelId}-fm`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, s('rect', { width: W, height: H, fill: `url(#${panelId}-f)` })))
    const hz = by0 + Math.min(rad * 0.5, (by1 - by0) * 0.12)
    const room = Math.max(0, hz - 6)
    const far = s('g', { mask: `url(#${panelId}-fm)` })
    if (room > 24) {
      const rg = s('g', { filter: 'url(#ink-wash)' })
      for (const [b, h0, h1, op] of [[hz - room * 0.06, 0.32, 0.62, 0.05], [hz, 0.14, 0.34, 0.085]] as const)
        for (const { d } of peaks(r, -W * 0.08, W * 1.08, b, Math.min(room, 160) * h0, Math.min(room, 160) * h1, Math.min(W * 0.16, 240))) rg.append(s('path', { d, class: 'k', 'fill-opacity': op }))
      far.append(rg)
    }
    far.append(s('g', { filter: 'url(#ink-rough)' }, s('path', { class: 'k3', 'fill-opacity': 0.22, d: brush([[-6, hz + 1], [W * 0.35, hz - 0.6], [W * 0.7, hz + 0.8], [W + 6, hz]], 1.4, { a: 0.1, b: 0.1, min: 0.3, wob: 0.1 }).d })))
    const moss = s('g', { filter: 'url(#ink-wash)' })
    for (const [cx, cy, dir] of [[bx0 + rad * 0.5, by1 - rad * 0.25, 1], [bx1 - rad * 0.45, by0 + rad * 0.3, -1]] as const) {
      const mw = sizes * 9
      moss.append(s('path', { class: 'moss', d: ell(cx + dir * mw * 0.35, cy + dir * sizes * 0.6, mw, sizes * 3.2) }), s('path', { class: 'moss', 'fill-opacity': 0.5, d: ell(cx + dir * mw * 0.9, cy - dir * sizes * 0.4, mw * 0.6, sizes * 2.2) }))
    }
    sand.replaceChildren(defs, far, bed, moss, rk, ringG, edge, peb)
  }

  let raf = 0
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(layout)
  })
  ro.observe(root)
  showLane(0)
  return () => {
    disposed = true
    ro.disconnect()
    cancelAnimationFrame(raf)
    timers.forEach(clearTimeout)
  }
}
