import { fill, h, s, viDate } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { Fact } from '../../core/content'
import { company, logoStone } from '../../ui/logo'
import type { SceneCtx } from '../types'
import { arc, brush, C, clamp, ell, path, pebble, rng, stableHeight, watchSize, type Pt } from './kit'

const M = C.scenes.models

/** A stone of the garden: [model index, dx, dy (in units of the base stone height), size]. */
type Seat = [number, number, number, number]
/** A group: its anchor (share of the garden box) and its stones. */
interface Group { at: [number, number]; seats: Seat[] }

// Three asymmetric groups (3 · 3 · 2), odd offsets, big stones anchoring small ones; large empty sand between.
// Model order (JSON): 0 Veo · 1 Gemini Omni Flash · 2 Kling · 3 Seedance · 4 Wan · 5 Hailuo · 6 Runway · 7 Luma
const WIDE: Group[] = [
  { at: [0.2, 0.44], seats: [[0, 0, 0, 1], [1, 1.62, 0.46, 0.62], [2, -1.5, 0.62, 0.76]] },
  { at: [0.56, 0.25], seats: [[3, 0, 0, 0.9], [6, 1.6, 0.42, 0.7], [7, 3.0, 0.08, 0.56]] },
  { at: [0.79, 0.68], seats: [[4, 0, 0, 0.84], [5, -1.62, 0.36, 0.6]] },
]
const TALL: Group[] = [
  { at: [0.42, 0.13], seats: [[2, -1.95, 0.42, 0.74], [0, 0, 0, 1], [1, 1.9, 0.4, 0.62]] },
  { at: [0.56, 0.5], seats: [[6, -2.0, 0.34, 0.68], [3, 0, 0, 0.9], [7, 1.8, 0.42, 0.58]] },
  { at: [0.4, 0.85], seats: [[4, 0, 0, 0.84], [5, 1.95, 0.32, 0.62]] },
]

// very short screens: one band of rocks, still in three groups; names alternate above and below
const FLAT: Group[] = [
  { at: [0.15, 0.54], seats: [[2, -1.6, 0.12, 0.74], [0, 0, 0, 1], [1, 1.55, 0.16, 0.62]] },
  { at: [0.52, 0.5], seats: [[6, -1.6, 0.14, 0.68], [3, 0, 0, 0.9], [7, 1.5, 0.18, 0.58]] },
  { at: [0.84, 0.54], seats: [[4, 0, 0, 0.84], [5, 1.6, 0.14, 0.62]] },
]

interface Ob { cx: number; cy: number; rx: number; ry: number }

/**
 * Where a raked line that runs at height y0 far away passes x, as it parts around one stone group
 * (potential flow round a cylinder, worked in the group's own ellipse). Returns the vertical displacement.
 */
function around(x: number, y0: number, o: Ob) {
  const ex = (x - o.cx) / o.rx
  const b = (y0 - o.cy) / o.ry
  const sg = b < 0 ? -1 : 1
  const B = Math.max(0.004, Math.abs(b))
  let lo = Math.abs(ex) < 1 ? Math.sqrt(1 - ex * ex) : 0
  let hi = B + 1.3
  for (let k = 0; k < 26; k++) {
    const m = (lo + hi) / 2
    // a doublet of power 1.5: lines bend close to the group, settle back to straight sooner than a pure cylinder flow
    if (m - m / Math.pow(ex * ex + m * m || 1e-6, 1.5) - B > 0) hi = m
    else lo = m
  }
  return o.cy + sg * ((lo + hi) / 2) * o.ry - y0
}

/** A garden rock: a flat-ish base sitting in the sand, an irregular crown that leans a little. */
function rock(cx: number, base: number, w: number, hh: number, r: () => number, lean: number): Pt[] {
  const n = 11
  const cy = base - hh / 2
  const pts: Pt[] = []
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2
    const c = Math.cos(t)
    const sn = Math.sin(t)
    const j = 1 + (r() - 0.5) * 0.2
    if (sn > 0) {
      // lower half: nearly flat where it meets the sand
      pts.push([cx + (w / 2) * c * 1.03 * j, cy + (hh / 2) * Math.pow(sn, 0.32)])
    } else {
      const y = cy + (hh / 2) * sn * j
      pts.push([cx + (w / 2) * Math.sign(c) * Math.pow(Math.abs(c), 0.85) * j + lean * (cy - y), y])
    }
  }
  return pts
}
const smoothClosed = (pts: Pt[]) => {
  const mid = (p: Pt, q: Pt): Pt => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
  const f = (n: number) => Math.round(n * 10) / 10
  const n = pts.length
  const m0 = mid(pts[n - 1], pts[0])
  let d = `M${f(m0[0])} ${f(m0[1])}`
  for (let i = 0; i < n; i++) {
    const m = mid(pts[i], pts[(i + 1) % n])
    d += `Q${f(pts[i][0])} ${f(pts[i][1])} ${f(m[0])} ${f(m[1])}`
  }
  return d + 'Z'
}

/**
 * Scene 4 — the notable video models are rocks in a dry garden, set in three asymmetric groups, the sand raked
 * around them. Choosing a need sends a ripple across the sand; as it reaches the rocks that fit, a vermilion ring
 * closes round them. A rock opens its card (maker, date, strengths).
 */
export function modelsScene(ctx: SceneCtx) {
  const root = h('div', { class: 't08 t08m' })
  const sand = s('svg', { class: 't08m-sand', 'aria-hidden': 'true' })
  const ripple = s('g')
  const pond = h('div', { class: 't08m-pond', role: 'group', 'aria-label': M.pond })
  const card = h('div', { class: 't08m-card', role: 'region', 'aria-live': 'polite', hidden: true })
  const needs = h('div', { class: 't08m-needs', role: 'group', 'aria-label': M.needsGroup })
  root.append(sand, pond, needs, card)
  ctx.art.append(root)
  ctx.prompt(M.prompt)
  const stable = stableHeight(ctx, [[M.insight, M.detail]])
  const lowQ = ctx.quality === 'low'

  const items = M.models.map((m, i) => {
    const co = company(m.company)
    const model = co?.models.find((x) => x.name === m.model)
    const also = m.also ? co?.models.find((x) => x.name === m.also) : undefined
    const logo = logoStone(m.company, { size: 56, decorative: true, float: false })
    const rockSvg = s('svg', { class: 't08m-rock', 'aria-hidden': 'true' })
    const name = h('span', { class: 't08m-name' }, m.name)
    const btn = h('button', { class: 't08m-model ls-host', type: 'button', 'aria-label': fill(M.modelAria, { name: m.name, maker: co?.name ?? m.company }), 'aria-expanded': 'false' },
      rockSvg, logo, name)
    const spot = h('div', { class: 't08m-spot' }, btn)
    pond.append(spot)
    btn.addEventListener('click', () => open(i))
    const halo = s('g', { class: 't08m-halo' })
    return { m, co, model, also, btn, spot, logo, rockSvg, name, halo, x: 0, y: 0, w: 0, hh: 0 }
  })

  const pills = M.needs.map((n, k) => {
    const r = rng(70 + k * 5)
    const icon = s('svg', { class: 't08m-peb', viewBox: '0 0 26 18', 'aria-hidden': 'true' },
      path(ell(14, 14.2, 10, 2.4), 'sh', { 'fill-opacity': 0.12 }),
      path(pebble(13, 9.5, 10.5, 6.2, r, 0.1), 'peb'),
      path(brush([[5, 12.5], [13, 15], [21, 12]], 1.3, { a: 0.3, b: 0.3, min: 0.3 }), 'sh', { 'fill-opacity': 0.22 }),
      path(pebble(13, 9.2, 5.2, 4, r, 0.06), 'seal', { transform: `rotate(${(r() - 0.5) * 16} 13 9)` }))
    const b = h('button', { class: 't08m-need', type: 'button', 'aria-pressed': 'false', style: `--dy:${((r() - 0.5) * 6).toFixed(1)}px` }, icon, h('span', { class: 't08m-nl' }, n.name))
    b.addEventListener('click', () => need(n.id, b))
    needs.append(b)
    return b
  })

  let touched = 0
  const bump = () => {
    if (++touched === 3) ctx.insight(M.insight, M.detail)
  }

  // ───────── a need: a ripple runs out across the sand; the rocks that fit it answer as it arrives ─────────
  let cur = ''
  function need(id: string, b: HTMLButtonElement) {
    cur = cur === id ? '' : id
    pills.forEach((p) => p.setAttribute('aria-pressed', String(p === b && cur === id)))
    closeCard()
    const rb = (b.querySelector('svg') ?? b).getBoundingClientRect()
    const r0 = root.getBoundingClientRect()
    const o: Pt = [rb.left + rb.width / 2 - r0.left, rb.top + rb.height / 2 - r0.top]
    const speed = Math.max(r0.width, r0.height) / 1.5
    items.forEach((it) => {
      const hit = !!cur && it.m.needs.includes(cur)
      const set = () => {
        it.btn.classList.toggle('match', hit)
        it.btn.classList.toggle('dim', !!cur && !hit)
        it.halo.classList.toggle('hit', hit)
        if (hit && !ctx.reduced) gsap.fromTo(it.halo.children, { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.4, stagger: 0.14, ease: 'power3.out', svgOrigin: `${it.x} ${it.y - it.hh * 0.3}` })
      }
      if (ctx.reduced || !cur) set()
      else ctx.anim(() => gsap.delayedCall(Math.hypot(it.x - o[0], it.y - o[1]) / speed, set))
    })
    ctx.chime('soft')
    if (cur) bump()
    if (ctx.reduced || !cur) return
    const far = Math.max(...items.map((it) => Math.hypot(it.x - o[0], it.y - o[1]))) + 80
    for (let k = 0; k < 3; k++) {
      const e = s('ellipse', { class: 't08m-wave', cx: o[0], cy: o[1], rx: 8, ry: 4 })
      ripple.append(e)
      ctx.anim(() => gsap.to(e, { attr: { rx: far, ry: far * 0.5 }, opacity: 0, duration: far / speed + 0.5, delay: k * 0.22, ease: 'power1.out', onComplete: () => e.remove() }))
    }
  }

  // ───────── a model: its card, anchored to the rock ─────────
  let openI = -1
  function open(i: number) {
    if (openI === i) return closeCard()
    const it = items[i]
    openI = i
    items.forEach((x, j) => x.btn.setAttribute('aria-expanded', String(j === i)))
    const md = it.model
    // a combined entry (e.g. Kling 3.0 / 3.0 Turbo) shows both release dates
    const dates = [md?.date ? viDate(md.date) : '', it.also?.date && it.m.alsoLabel ? `${it.m.alsoLabel} ${viDate(it.also.date)}` : ''].filter(Boolean)
    const meta: Fact | string = md
      ? { text: [it.co?.name, ...dates, md.note].filter(Boolean).join(' · '), asOf: md.asOf, source: md.source, verify: md.verify || it.also?.verify }
      : (it.co?.name ?? '')
    const x = h('button', { class: 't08m-x', type: 'button', 'aria-label': M.close }, '×')
    x.addEventListener('click', closeCard)
    card.replaceChildren(h('p', { class: 't08m-cname' }, it.m.name), ctx.fact(meta, 'p', 't08m-meta'), md?.strengths ? ctx.fact(md.strengths, 'p', 't08m-str') : '', x)
    card.hidden = false
    placeCard()
    ctx.chime('tap')
    bump()
    if (!ctx.reduced) ctx.anim(() => gsap.fromTo(card, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }))
  }
  function closeCard() {
    if (openI < 0) return
    const back = items[openI].btn
    back.setAttribute('aria-expanded', 'false')
    openI = -1
    const had = card.contains(document.activeElement)
    card.hidden = true
    if (had) back.focus()
  }
  function placeCard() {
    if (openI < 0) return
    const it = items[openI]
    const W = root.clientWidth
    const cw = Math.min(300, W - 16)
    card.style.width = `${cw}px`
    const ch = card.offsetHeight
    const topY = it.y - it.hh - 10
    const above = topY - ch >= 0
    const top = above ? topY - ch : Math.min(it.y + 44, root.clientHeight - ch - 4)
    Object.assign(card.style, { left: `${clamp(it.x - cw / 2, 8, W - cw - 8)}px`, top: `${Math.max(4, top)}px` })
  }
  root.addEventListener('keydown', (e) => e.key === 'Escape' && closeCard())
  const onDoc = (e: PointerEvent) => {
    if (openI >= 0 && !card.contains(e.target as Node) && !items[openI].btn.contains(e.target as Node)) closeCard()
  }
  document.addEventListener('pointerdown', onDoc)

  // ───────── layout: rocks in three groups, the sand raked around them ─────────
  function layout(W: number, Hh: number) {
    const H = stable.H(Hh)
    root.style.height = `${H}px`
    const wide = W / H > 1.15
    const flat = wide && H < 330
    root.classList.toggle('tall', !wide)
    root.classList.toggle('flat', flat)
    const nh = needs.offsetHeight + (flat ? 8 : 14) + (wide ? (flat ? 10 : 22) : 16)
    const PH = Math.max(90, H - nh)
    const comp = flat ? FLAT : wide ? WIDE : TALL
    // the base stone height: as large as the box allows, the groups' spread decides
    const u = flat ? clamp(Math.min(W / 22, PH / 2.6), 20, 44) : wide ? clamp(Math.min(W / 13, PH / 4.1), 30, 96) : clamp(Math.min(W / 7, PH / 6), 26, 56)
    const fs = clamp(u / 4.6, 11.5, 15)
    root.style.setProperty('--fs', `${fs.toFixed(1)}px`)
    const padX = wide ? Math.max(20, W * 0.04) : 10
    const nameW = flat ? Math.min(u * 3, 150) : wide ? Math.min(u * 2.2, 170) : Math.min(u * 2.3, W / 3)
    // names alternate above / below along a single band, so neighbours never collide
    const order = flat ? comp.flatMap((g) => g.seats.map((s) => s[0])) : []
    const lineH = fs * 1.2
    const obs: Ob[] = []
    const rings = s('g')
    const halos = s('g')
    comp.forEach((gr, gi) => {
      const ax = padX + gr.at[0] * (W - padX * 2)
      const ay = gr.at[1] * PH
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
      gr.seats.forEach(([mi, dx, dy, sz], k) => {
        const it = items[mi]
        const hh = u * sz
        const r = rng(200 + mi * 17)
        const w = hh * (1.32 + r() * 0.3)
        it.hh = hh
        it.w = w
        // the anchor is the middle of the big rock: rocks sit with their base a little below it
        const x = clamp(ax + dx * u, w / 2 + 4, W - w / 2 - 4)
        const base = ay + dy * u + hh / 2
        it.x = x
        it.y = base
        it.name.style.maxWidth = `${Math.floor(nameW)}px`
        it.btn.classList.toggle('up', flat && order.indexOf(mi) % 2 === 1)
        // a company typeset on the rock (no official mark) only when the rock is big enough to carry it
        it.btn.classList.toggle('small', hh < 50)
        const nameH = it.name.offsetHeight || lineH
        const span = wide && !flat ? Math.max(w, Math.min(nameW, it.name.offsetWidth || nameW)) : w
        x0 = Math.min(x0, x - span / 2)
        x1 = Math.max(x1, x + span / 2)
        y0 = Math.min(y0, base - hh)
        // tall screens: the rings hug the rocks and the names sit over the sand; wide ones leave room for the names
        y1 = Math.max(y1, base + (wide && !flat ? 6 + nameH : 4))
        drawRock(it, r, gi * 3 + k)
        Object.assign(it.spot.style, { left: `${x}px`, top: `${base}px` })
        // the vermilion ring that closes round a rock that fits the chosen need
        const hr = rng(400 + mi)
        const hx = w * 0.66 + 8
        const hy = hh * 0.42 + 6
        const cy = base - hh * 0.3
        it.halo.replaceChildren(...[0, 1].map((q) => path(brush(arc(x, cy, hx + q * 7, hy + q * 4, -100 + hr() * 30 + q * 50, 240 + hr() * 20 + q * 40, 36), 1.8 - q * 0.5, { a: 0.06, b: 0.3, min: 0.3, wob: 0.14 }), 'v')))
        halos.append(it.halo)
      })
      // concentric rings raked round the group, a little open here and there like real raking
      const cx = (x0 + x1) / 2
      const cy = (y0 + y1) / 2 - 2
      const rx0 = (x1 - x0) / 2 + Math.max(wide && !flat ? 14 : 10, u * (wide && !flat ? 0.28 : 0.2))
      const ry0 = (y1 - y0) / 2 + Math.max(wide && !flat ? 10 : 6, u * (wide && !flat ? 0.18 : 0.12))
      const gap = clamp(u * 0.17, 7, 12)
      const n = wide && !flat ? 3 : 2
      const rr = rng(90 + gi)
      for (let k = 0; k < n; k++) {
        const RX = rx0 + k * gap
        const RY = ry0 + k * gap * 0.62
        const a0 = rr() * 360
        const open = 14 + rr() * 26
        rings.append(path(brush(arc(cx, cy, RX, RY, a0, a0 + 360 - open, 64), 1.35 - k * 0.12, { a: 0.05, b: 0.08, min: 0.4, wob: 0.12 }), 'ring'))
      }
      obs.push({ cx, cy, rx: rx0 + n * gap, ry: ry0 + n * gap * 0.62 })
    })
    // raked lines: they flow round each group and gather into extra rings near it, gently uneven elsewhere
    sand.setAttribute('viewBox', `0 0 ${W} ${H}`)
    const r = rng(8)
    const lines = s('g')
    const step = clamp(PH / 17, 11, 19)
    const dx = Math.max(10, W / 90)
    for (let y0 = step * 0.7; y0 < PH - step * 0.4; y0 += step) {
      const a = W * (0.015 + r() * 0.04)
      const b = W * (0.945 + r() * 0.04)
      const ph = r() * 6
      const amp = 0.3 + r() * 0.5
      let seg: Pt[] = []
      const flush = () => {
        // short scraps between groups read as scratches: leave that sand smooth
        if (seg.length > 3 && seg[seg.length - 1][0] - seg[0][0] > 40) lines.append(path(brush(seg, 0.9 + r() * 0.35, { a: 0.05, b: 0.06, min: 0.45, wob: 0.18 }), 'rake'))
        seg = []
      }
      for (let x = a; x <= b + 0.1; x += dx) {
        let y = y0 + Math.sin(x * 0.0085 + ph) * amp
        for (const o of obs) y += around(x, y0, o)
        // never inside a ring or below the garden
        const inside = obs.some((o) => ((x - o.cx) / o.rx) ** 2 + ((y - o.cy) / o.ry) ** 2 < 0.97)
        if (inside || y > PH + 2 || y < 2) flush()
        else seg.push([x, y])
      }
      flush()
    }
    // the edge of the sand bed: one long, tapered stroke above the needs
    const edgeY = PH + 6
    const edge = path(brush([[W * 0.03, edgeY + 1], [W * 0.35, edgeY - 0.5], [W * 0.7, edgeY + 0.6], [W * 0.97, edgeY - 0.4]], 2, { a: 0.08, b: 0.2, min: 0.3, wob: 0.2 }), 'k3', { 'fill-opacity': 0.5 })
    sand.replaceChildren(lines, rings, edge, halos, ripple)
    placeCard()
  }

  // one rock, drawn in ink and wash at its real pixel size
  function drawRock(it: (typeof items)[number], r: () => number, k: number) {
    const { w, hh } = it
    const pad = 12
    const W2 = w + pad * 2
    const H2 = hh + pad + 8
    const cx = W2 / 2
    const base = hh + pad
    const lean = (r() - 0.5) * 0.5
    const outline = rock(cx, base, w, hh, r, lean)
    const face = rock(cx - w * 0.1, base - hh * 0.2, w * 0.66, hh * 0.62, r, lean)
    const n = outline.length
    // the shadow side: from the upper right, round the base, to the lower left
    const shade = [...outline.slice(Math.floor(n * 0.84)), ...outline.slice(0, Math.ceil(n * 0.5))]
    const lit = outline.slice(Math.floor(n * 0.5), Math.floor(n * 0.86))
    const wash = lowQ ? null : 'url(#ink-wash)'
    const kids: SVGElement[] = [
      path(ell(cx + w * 0.1, base + 1, w * 0.62, Math.max(3, hh * 0.12)), 'rk-sh', { filter: wash }),
      path(smoothClosed(outline), 'rk-body'),
      path(smoothClosed(face), 'rk-face', { filter: wash }),
      path(brush(shade, Math.max(1.6, hh * 0.05), { a: 0.1, b: 0.25, min: 0.3, wob: 0.2 }), 'rk-line'),
      path(brush(lit, Math.max(0.9, hh * 0.022), { a: 0.2, b: 0.4, min: 0.3, wob: 0.2 }), 'rk-line', { 'fill-opacity': 0.45 }),
      // the base sits in shade; a facet edge runs down from the crown
      path(smoothClosed(rock(cx + w * 0.04, base, w * 0.94, hh * 0.38, r, 0)), 'rk-lo', { 'fill-opacity': 0.28, filter: wash }),
      path(brush([[cx + w * (0.02 + lean * 0.2), base - hh * 0.95], [cx + w * 0.16, base - hh * 0.62], [cx + w * 0.12, base - hh * 0.3]], Math.max(1.1, hh * 0.035), { a: 0.15, b: 0.5, min: 0.2, wob: 0.2 }), 'rk-line', { 'fill-opacity': 0.5 }),
      // two dry-brush cracks
      path(brush([[cx + w * 0.18, base - hh * 0.62], [cx + w * 0.24, base - hh * 0.4], [cx + w * 0.2, base - hh * 0.2]], Math.max(1, hh * 0.03), { a: 0.2, b: 0.5, min: 0.2 }), 'rk-lo', { 'fill-opacity': 0.4 }),
      path(brush([[cx - w * 0.3, base - hh * 0.14], [cx - w * 0.05, base - hh * 0.08], [cx + w * 0.2, base - hh * 0.12]], Math.max(0.9, hh * 0.026), { a: 0.3, b: 0.4, min: 0.2 }), 'rk-lo', { 'fill-opacity': 0.3 }),
    ]
    // moss at the foot of some rocks
    if (k % 3 !== 1) {
      const mx = cx + (k % 2 ? 1 : -1) * w * (0.26 + r() * 0.12)
      for (let q = 0; q < 5; q++) kids.push(path(ell(mx + (q - 2) * hh * 0.07 + (r() - 0.5) * 3, base - 1 - r() * hh * 0.07, hh * (0.06 + r() * 0.05), hh * (0.03 + r() * 0.02)), q % 2 ? 'mo1' : 'mo2', { filter: wash }))
    }
    // the button covers the rock (at least 44 px each way); the name hangs below it; the logo sits on the lit face
    const bw = Math.max(w, 44)
    const bh = Math.max(hh, 44)
    const ox = (bw - w) / 2
    const oy = bh - hh
    it.rockSvg.setAttribute('viewBox', `0 0 ${W2} ${H2}`)
    Object.assign(it.rockSvg.style, { width: `${W2}px`, height: `${H2}px`, left: `${ox - pad}px`, top: `${oy - pad}px` })
    it.rockSvg.replaceChildren(...kids)
    it.logo.style.setProperty('--ls-size', `${Math.round(hh * 0.86)}px`)
    Object.assign(it.btn.style, { width: `${Math.round(bw)}px`, height: `${Math.round(bh)}px`, left: `${-bw / 2}px`, top: `${-bh}px` })
    Object.assign(it.logo.style, { left: `${ox + w * 0.42}px`, top: `${oy + hh * 0.44}px` })
  }

  const unwatch = watchSize(ctx.art, layout)
  layout(ctx.art.clientWidth, ctx.art.clientHeight)
  stable.afterFonts(() => layout(ctx.art.clientWidth, ctx.art.clientHeight))

  if (!ctx.reduced) {
    gsap.from(items.map((it) => it.spot), { opacity: 0, y: 10, duration: 1.4, stagger: 0.09, ease: 'power3.out', delay: 0.3 })
    gsap.from(sand, { opacity: 0, duration: 1.8, ease: 'power2.out' })
    gsap.from(pills, { opacity: 0, y: 8, duration: 1, stagger: 0.05, ease: 'power3.out', delay: 0.8 })
  }

  return () => {
    unwatch()
    document.removeEventListener('pointerdown', onDoc)
  }
}
