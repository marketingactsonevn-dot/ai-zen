import { fill, h, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import { sliced } from '../../core/chunk'
import type { SceneCtx } from '../types'
import { C } from './data'
import { arc, clamp, ell, enso, hull, place, resample, rng, stable, stroke, watch, type Pt } from './ink'

const S = C.scenes.stones
type Kind = 'tall' | 'round' | 'flat'
/** [dx, dy, size, kind, lean], in units of the base stone size, from the island's main stone. */
type Spot = [number, number, number, Kind, number]
/** Three islands (san-zon: a tall main stone, a companion leaning toward it, a low one at its foot): self · information · society. */
const GROUPS = [[0, 1, 7], [2, 3, 6], [4, 5, 8]]
/** Each island is turned its own way, so the garden never repeats itself. */
const ISLE: Spot[][] = [
  [[0, 0, 1.16, 'tall', 0.07], [2.6, 0.46, 0.8, 'round', -0.14], [-1.95, 1.1, 0.56, 'flat', 0]],
  [[0, 0, 1.06, 'tall', -0.07], [-2.65, 0.3, 0.78, 'round', 0.14], [1.85, 1.0, 0.58, 'flat', 0]],
  [[0, 0, 1.1, 'tall', 0.05], [2.4, -0.55, 0.72, 'round', -0.12], [-1.75, 0.9, 0.54, 'flat', 0]],
]
/** Where each island's main stone stands, as a share of the garden: an asymmetric diagonal on wide screens, a zig-zag on tall ones. */
const AT_WIDE: Pt[] = [[0.21, 0.4], [0.48, 0.74], [0.79, 0.33]]
const AT_TALL: Pt[] = [[0.33, 0.24], [0.67, 0.53], [0.35, 0.83]]

/** How high a garden stone stands above its foot. */
const rise = (w: number, kind: Kind) => (kind === 'tall' ? w * 1.5 : kind === 'round' ? w * 0.82 : w * 0.42)

/** A garden stone in ink: lit from the upper left, a pressed dark contour on the shadow side, dry-brush grain. */
function gardenStone(r: () => number, x: number, y: number, w: number, kind: Kind, lean: number, shade: string) {
  const g = s('g')
  const hg = rise(w, kind)
  const pts: Pt[] = []
  for (let i = 0; i <= 20; i++) {
    const t = Math.PI * (1 + i / 20)
    const j = 1 + (r() - 0.5) * 0.1
    const up = -Math.sin(t)
    let px = x + w * Math.cos(t) * j + lean * w * up * up
    if (kind === 'tall') px -= Math.cos(t) * w * 0.18 * up
    if (kind === 'flat') px += Math.cos(t) * w * 0.08 * up
    pts.push([px, y + hg * Math.sin(t) * j * (kind === 'flat' ? 1 + 0.25 * up : 1)])
  }
  const front = arc(x, y, w, w * 0.24, 0, 180, 14)
  const sil = `M${[...pts, ...front].map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L')}Z`
  const bb = { x: x - w * 1.25, y: y - hg * 1.15, w: w * 2.5, h: hg * 1.15 + w * 0.3 }
  const cid = `${shade}-${Math.round(x)}-${Math.round(y)}`
  g.append(
    s('path', { class: 'sh', 'fill-opacity': 0.14, d: ell(x + w * 0.38, y + w * 0.08, w * 1.4, w * 0.26), filter: 'url(#ink-wash)' }),
    s('clipPath', { id: cid }, s('path', { d: sil })),
    s('path', { d: sil, fill: `url(#${shade}-b)` }),
    s('g', { 'clip-path': `url(#${cid})` },
      s('rect', { x: bb.x, y: bb.y, width: bb.w, height: bb.h, fill: `url(#${shade}-r)` }),
      s('rect', { x: bb.x, y: bb.y, width: bb.w, height: bb.h, fill: `url(#${shade}-d)` }),
      stroke([[x - w * 0.3, y - hg * 0.7], [x - w * 0.05, y - hg * 0.45], [x + w * 0.05, y - hg * 0.18]], Math.max(1, w * 0.06), 'k', { a: 0.2, b: 0.4, min: 0.2 }, 0.22),
      stroke([[x + w * 0.25, y - hg * 0.85], [x + w * 0.45, y - hg * 0.5]], Math.max(1, w * 0.05), 'k', { a: 0.3, b: 0.4, min: 0.2 }, 0.18)),
    // pressed contour on the shadow side and along the foot; the lit side breaks off
    stroke([...pts.slice(9), ...front.slice(0, 9)], Math.max(1.4, w * 0.075), 'k', { a: 0.08, b: 0.25, min: 0.3 }, 0.85),
    stroke(pts.slice(1, 8), Math.max(0.8, w * 0.03), 'k', { a: 0.3, b: 0.4, min: 0.2 }, 0.5),
    stroke(pts.slice(3, 9).map(([a, b]) => [a + w * 0.06, b + w * 0.07] as Pt), Math.max(0.8, w * 0.04), 'rim', { a: 0.3, b: 0.4, min: 0.2 }, 0.8),
  )
  return g
}

type Box = { x: number; y: number; w: number; h: number }
const overlap = (a: Box, b: Box, pad = 3) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) + pad - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) + pad - Math.max(a.y, b.y))

export function stonesScene(ctx: SceneCtx) {
  const svg = s('svg', { class: 't18s-svg', 'aria-hidden': 'true' })
  const btns = S.items.map((it, i) =>
    h('button', { class: 't18s-stone', type: 'button', 'aria-pressed': 'false', 'aria-controls': 't18s-card', onClick: () => select(i) }, h('span', { class: 't18s-name' }, it.name)))
  // islands are real groups for assistive tech; their sand captions are only drawn for the eye
  const isles = S.islands.map((name) => h('p', { class: 't18s-isle', 'aria-hidden': 'true' }, name))
  const group = h('div', { class: 't18s-stones', role: 'group', 'aria-label': S.group },
    ...GROUPS.map((ids, gi) => h('div', { role: 'group', 'aria-label': S.islands[gi] }, ...ids.map((i) => btns[i]))))

  // the card: a stone tablet that turns over from the impact to the good habit
  const eyeF = h('p', { class: 't18s-eye' }, S.riskTitle)
  const nameF = h('h3', { class: 't18s-cname' })
  const riskBox = h('div', { class: 't18s-text' })
  const flipBtn = h('button', { class: 'btn ghost t18s-flipbtn', type: 'button', onClick: () => flip(true) }, h('span', { class: 't18s-sprout', 'aria-hidden': 'true' }), S.flip)
  const front = h('div', { class: 't18s-face front' }, eyeF, nameF, riskBox, flipBtn)
  const nameB = h('h3', { class: 't18s-cname' })
  const habitBox = h('p', { class: 't18s-text habit' })
  const backBtn = h('button', { class: 'btn ghost t18s-flipbtn', type: 'button', onClick: () => flip(false) }, S.back)
  const back = h('div', { class: 't18s-face back' }, h('p', { class: 't18s-eye moss' }, h('span', { class: 't18s-sprout on', 'aria-hidden': 'true' }), S.habitTitle), nameB, habitBox, backBtn)
  const turn = h('div', { class: 't18s-turn' }, front, back)
  const mark = enso('t18s-enso', 7)
  const intro = h('div', { class: 't18s-intro' }, mark.svg, h('p', null, S.group))
  const count = h('p', { class: 't18s-count' })
  const say = h('p', { class: 'visually-hidden', 'aria-live': 'polite' })
  // phones: the card is a sheet that slides up over the sand and can be put away again
  const closeBtn = h('button', { class: 't18s-close', type: 'button', 'aria-label': S.close, onClick: () => openSheet(false, true) },
    s('svg', { viewBox: '0 0 20 20', 'aria-hidden': 'true' }, s('path', { d: 'M5 5L15 15M15 5L5 15' })))
  const card = h('div', { class: 't18s-card', id: 't18s-card' }, intro, turn, count, closeBtn)
  turn.hidden = true
  const garden = h('div', { class: 't18s-garden' }, svg, ...isles, group)
  const root = h('div', { class: `t18 t18s${ctx.reduced ? ' rm' : ''}` }, h('p', { class: 'visually-hidden' }, S.art), h('div', { class: 't18s-clip' }, garden), card, say)
  ctx.art.append(root)
  const st = stable(ctx, [S.insight], root)

  let sel = -1
  let showingBack = false
  let touched = false
  const flipped = new Set<number>()
  let geo: { x: number; y: number; w: number; top: number }[] = []
  let ringG: SVGGElement | null = null
  let mossG: SVGGElement[] = []
  let wide = true
  let short = false
  let sheet = false
  let gbox: Box = { x: 0, y: 0, w: 0, h: 0 }
  let ink: ReturnType<typeof sliced> | null = null
  ctx.onCleanup(() => ink?.cancel())

  // ───────── the garden, drawn in pixels for the current size ─────────
  function draw(W: number, H: number) {
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
    svg.replaceChildren()
    const r = rng(9)
    const anchors = wide ? AT_WIDE : AT_TALL
    const b = wide ? Math.min(W * 0.048, H * (short ? 0.11 : 0.085), 54) : Math.min(W * 0.062, H * 0.078, 26)
    // on a phone the stones stay small but stand further apart, so their names have room
    const u = wide ? b : Math.max(b, W * 0.082)
    geo = []
    GROUPS.forEach((ids, gi) => {
      const [ax, ay] = anchors[gi]
      ids.forEach((id, k) => {
        const [dx, dy, size, kind] = ISLE[gi][k]
        const x = ax * W + dx * u
        const y = ay * H + dy * u * (wide ? 1 : 0.7)
        geo[id] = { x, y, w: b * size, top: y - rise(b * size, kind) }
      })
    })
    // one raked contour per island: the hull of the stones' footprints, offset outward ring by ring
    const gap = clamp(b * 0.34, 5, 12)
    const ringsOf = (gi: number, extra: number) =>
      hull(GROUPS[gi].flatMap((i) => {
        const p = geo[i]
        return arc(p.x + p.w * 0.12, p.y + p.w * 0.04, p.w * 1.3 + extra, p.w * 0.42 + extra * 0.5, 0, 350, 35)
      }))
    const outer = GROUPS.map((_, gi) => ringsOf(gi, gap * 3.6))
    const lin = (id: string, x2: number, y2: number, a: [number, number], c: [number, number]) =>
      s('linearGradient', { id, x1: 0, y1: 0, x2, y2 }, s('stop', { offset: a[0], class: 'sd0', 'stop-opacity': a[1] }), s('stop', { offset: c[0], class: 'sd0', 'stop-opacity': c[1] }))
    const low = ctx.quality === 'low'
    svg.append(s('defs', null,
      s('linearGradient', { id: 't18s-b', x1: 0, y1: 0, x2: 1, y2: 0.4 }, s('stop', { offset: 0, class: 'gs0' }), s('stop', { offset: 1, class: 'gs1' })),
      lin('t18s-r', 1, 0, [0.5, 0], [1, 0.3]),
      lin('t18s-d', 0, 1, [0.62, 0], [1, 0.32]),
      s('radialGradient', { id: 't18s-fade', cx: 0.5, cy: 0.5, r: 0.62 }, s('stop', { offset: 0.74, 'stop-color': '#fff' }), s('stop', { offset: 1, 'stop-color': '#000' })),
      s('mask', { id: 't18s-edge', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, s('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#t18s-fade)' })),
      s('mask', { id: 't18s-rk', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H },
        s('rect', { x: 0, y: 0, width: W, height: H, fill: '#fff' }),
        ...outer.map((o) => s('path', { d: `M${o.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L')}Z`, fill: '#000' })))))
    // the garden's layers, empty for now: the ink soaks into them over a few frames while the scene fades in
    // (spec A.10: no long task on a scene change); the names and the buttons only need the geometry above
    const bed = s('g', { mask: 'url(#t18s-edge)' }, s('rect', { x: 0, y: 0, width: W, height: H, class: 'sand' }))
    const rake = s('g', { mask: 'url(#t18s-rk)' })
    const dryG = s('g', low ? null : { filter: 'url(#ink-dry)' })
    bed.append(rake, dryG)
    const order = geo.map((_, i) => i).sort((a, c) => geo[a].y - geo[c].y)
    const stonesG = s('g', low ? null : { filter: 'url(#ink-rough)' })
    mossG = []
    for (const i of order) mossG[i] = s('g', { class: 'm', opacity: flipped.has(i) ? 1 : 0 })
    ringG = s('g', { class: 't18s-ring', opacity: 0 })
    svg.append(bed, stonesG, ...order.map((i) => mossG[i]), ringG)
    ink?.cancel()
    ink = sliced(
      (function* () {
        // the bed of raked sand: long lines that breathe a little, parted around each island
        const lineGap = clamp(H / 32, 7, 12)
        for (let y = lineGap * 0.6, n = 0; y < H; y += lineGap, n++) {
          const amp = 1.4 + 1.4 * Math.sin((y / H) * Math.PI * 1.4 + 0.6)
          const op = 0.24 + 0.16 * (0.5 + 0.5 * Math.sin(n * 0.7 + 1)) + r() * 0.06
          const pts: Pt[] = []
          for (let x = -12; x <= W + 12; x += 18) pts.push([x, y + amp * Math.sin(x / 150 + y / 90) + 0.6 * Math.sin(x / 37 + n)])
          // the rake lifts now and then: a line breaks into two or three runs
          const cuts = [0, ...Array.from({ length: 1 + Math.floor(r() * 2) }, () => 2 + Math.floor(r() * (pts.length - 4))).sort((a, c) => a - c), pts.length]
          for (let c = 0; c < cuts.length - 1; c++) {
            const seg = pts.slice(cuts[c] + (c ? 1 : 0), cuts[c + 1])
            if (seg.length > 1) rake.append(stroke(seg, 1, 'k3', { a: 0.04, b: 0.06, min: 0.5, wob: 0.08 }, op))
          }
          yield
        }
        // the contour rings, brushed: pressure varies, the rake lifts at two places on each ring
        for (let gi = 0; gi < GROUPS.length; gi++)
          for (let j = 0; j < 4; j++) {
            const ring = ringsOf(gi, gap * (0.9 + j))
            let per = 0
            for (let i = 0; i < ring.length; i++) per += Math.hypot(ring[(i + 1) % ring.length][0] - ring[i][0], ring[(i + 1) % ring.length][1] - ring[i][1])
            const n = Math.max(40, Math.round(per / 5))
            const pts = resample(ring, n)
            const start = Math.floor(r() * n)
            const breaks = [start, (start + Math.floor(n * (0.38 + r() * 0.22))) % n]
            for (let k = 0; k < 2; k++) {
              const a = breaks[k] + 2 + Math.floor(r() * 2)
              const len = ((breaks[(k + 1) % 2] - a + n) % n) || n
              const seg = Array.from({ length: len }, (_, q) => pts[(a + q) % n])
              if (seg.length < 3) continue
              bed.append(stroke(seg, 1.15 - j * 0.08, 'k3', { a: 0.12, b: 0.18, min: 0.35, wob: 0.12 }, 0.6 - j * 0.07))
              if (j === 0 && k === 0) dryG.append(stroke(seg.slice(0, Math.ceil(seg.length * 0.6)), gap * 0.7, 'k3', { a: 0.2, b: 0.3, min: 0.4 }, 0.16))
            }
            yield
          }
        // stones, back first so the near ones overlap
        for (const i of order) {
          const p = geo[i]
          const gi = GROUPS.findIndex((ids) => ids.includes(i))
          const [, , , kind, lean] = ISLE[gi][GROUPS[gi].indexOf(i)]
          stonesG.append(gardenStone(r, p.x, p.y, p.w, kind, lean, 't18s'))
          // moss creeps up the foot once its good habit is known
          const mg = mossG[i]
          for (let n = 0; n < 14; n++) {
            const a = Math.PI * (0.15 + r() * 0.7)
            const f = 0.75 + r() * 0.3
            mg.append(s('path', { d: ell(p.x + p.w * f * Math.cos(a), p.y + p.w * 0.24 * f * Math.sin(a) - p.w * 0.06, p.w * (0.05 + r() * 0.06), p.w * (0.03 + r() * 0.04)), 'fill-opacity': (0.5 + r() * 0.45).toFixed(2) }))
          }
          mg.append(stroke([[p.x - p.w * 0.95, p.y + 1], [p.x - p.w * 1.02, p.y - p.w * 0.22], [p.x - p.w * 0.9, p.y - p.w * 0.42]], Math.max(1, p.w * 0.06), 'm', { a: 0.1, b: 0.5 }))
          yield
        }
      })(),
      { sync: ctx.reduced },
    )
    if (sel >= 0) placeRing(sel, false)
    return outer
  }

  /** the chosen stone: a vermilion brush ring drawn around its foot */
  function placeRing(i: number, anim = true) {
    if (!ringG) return
    const g = geo[i]
    gsap.killTweensOf(ringG)
    // open at the front, so the stone's name below stays clear
    ringG.replaceChildren(stroke(arc(g.x + g.w * 0.1, g.y - g.w * 0.02, g.w * 1.42, g.w * 0.44, 158, 392, 44), Math.max(1.6, g.w * 0.06), 'v', { a: 0.12, b: 0.5, min: 0.15, wob: 0.15 }))
    const o = `${g.x} ${g.y}`
    if (anim && !ctx.reduced) gsap.fromTo(ringG, { opacity: 0, scale: 0.8, svgOrigin: o }, { opacity: 0.85, scale: 1, svgOrigin: o, duration: 1.1, ease: 'power3.out' })
    else gsap.set(ringG, { opacity: 0.85, scale: 1, svgOrigin: o })
  }

  // ───────── names: every label finds a free patch of sand beside its stone ─────────
  function placeNames(gb: Box, outer: Pt[][]) {
    const W = gb.w
    const H = gb.h
    const taken: Box[] = geo.map((g) => ({ x: g.x - g.w * 1.05, y: g.top, w: g.w * 2.1, h: g.y - g.top + g.w * 0.28 }))
    const free = (b: Box) => b.x >= 12 && b.y >= 6 && b.x + b.w <= W - 12 && b.y + b.h <= H - 6
    const cost = (b: Box) => taken.reduce((a, t) => a + overlap(b, t), 0) + (free(b) ? 0 : 1e6)
    const choose = (cands: { b: Box; side: string }[]) => {
      let best = cands[0]
      let bc = Infinity
      for (const c of cands) {
        const k = cost(c.b)
        // a label may graze a neighbour's shadow, never cover it
        if (k <= c.b.w * c.b.h * 0.03) return c
        if (k < bc) {
          bc = k
          best = c
        }
      }
      return best
    }
    // every label measured before any of them moves: one layout, not one per label
    const isleBox = isles.map((el) => [el.offsetWidth, el.offsetHeight])
    const nameBox = btns.map((b) => [(b.firstElementChild as HTMLElement).offsetWidth, (b.firstElementChild as HTMLElement).offsetHeight])
    // island captions first, lying in the sand just outside each island's contour
    isles.forEach((el, gi) => {
      const o = outer[gi]
      const x0 = Math.min(...o.map((p) => p[0]))
      const x1 = Math.max(...o.map((p) => p[0]))
      const y0 = Math.min(...o.map((p) => p[1]))
      const y1 = Math.max(...o.map((p) => p[1]))
      const [w, hh] = isleBox[gi]
      const cy = (y0 + y1) / 2
      const c = choose([
        { b: { x: x0 - w - 4, y: cy - hh / 2, w, h: hh }, side: 'l' },
        { b: { x: x1 + 4, y: cy - hh / 2, w, h: hh }, side: 'r' },
        { b: { x: (x0 + x1) / 2 - w / 2, y: y1 + 2, w, h: hh }, side: 'b' },
        { b: { x: x0 + (x1 - x0) * 0.1, y: y1 - hh * 0.2, w, h: hh }, side: 'b' },
      ])
      taken.push(c.b)
      place(el, gb.x + c.b.x, gb.y + c.b.y)
    })
    // then each stone's name: below, beside, or above it
    const order = geo.map((_, i) => i).sort((a, c) => geo[c].w - geo[a].w)
    for (const i of order) {
      const g = geo[i]
      const span = btns[i].firstElementChild as HTMLElement
      const [w, hh] = nameBox[i]
      const foot = g.y + g.w * 0.3 + 2
      const mid = (g.top + g.y) / 2
      const c = choose([
        { b: { x: g.x - w / 2, y: foot, w, h: hh }, side: 'c' },
        { b: { x: g.x + g.w * 1.12 + 4, y: mid - hh / 2, w, h: hh }, side: 'l' },
        { b: { x: g.x - g.w * 1.12 - 4 - w, y: mid - hh / 2, w, h: hh }, side: 'r' },
        { b: { x: g.x - w * 0.15, y: foot, w, h: hh }, side: 'l' },
        { b: { x: g.x - w * 0.85, y: foot, w, h: hh }, side: 'r' },
        { b: { x: g.x - w / 2, y: g.top - hh - 3, w, h: hh }, side: 'c' },
      ])
      taken.push(c.b)
      const bl = parseFloat(btns[i].style.left) - gb.x
      const bt = parseFloat(btns[i].style.top) - gb.y
      span.style.left = `${c.b.x - bl}px`
      span.style.top = `${c.b.y - bt}px`
      span.style.textAlign = c.side === 'c' ? 'center' : c.side === 'l' ? 'left' : 'right'
    }
  }

  // ───────── layout ─────────
  /** the card keeps the height of its longest item, so nothing shifts as stones are chosen */
  let measuredW = -1
  function sizeCard() {
    if (card.clientWidth === measuredW) return
    measuredW = card.clientWidth
    card.style.minHeight = ''
    const was = turn.hidden
    turn.hidden = false
    turn.style.visibility = 'hidden'
    let max = card.offsetHeight
    S.items.forEach((_, i) => {
      show(i)
      max = Math.max(max, card.offsetHeight)
    })
    if (sel >= 0) show(sel)
    turn.hidden = was
    turn.style.visibility = ''
    card.style.minHeight = `${max}px`
  }

  function layout() {
    st.apply()
    const W = root.clientWidth
    const H = root.clientHeight
    if (!W || !H) return
    wide = W / H > 1.05
    root.classList.toggle('wide', wide)
    short = wide && H < 330
    root.classList.toggle('short', short)
    const cw = clamp(W * 0.3, 270, 380)
    card.style.width = `${wide ? cw : W}px`
    sizeCard()
    let gb: Box
    if (wide) {
      place(card, W - cw, Math.max(0, (H - card.offsetHeight) / 2))
      gb = { x: 0, y: 0, w: W - cw - clamp(W * 0.03, 16, 40), h: H }
    } else {
      place(card, 0, H - card.offsetHeight)
      gb = { x: 0, y: 6, w: W, h: H - 12 }
    }
    gbox = gb
    root.classList.toggle('sheet', !wide && sheet)
    place(svg, gb.x, gb.y, gb.w, gb.h)
    const outer = draw(gb.w, gb.h)
    geo.forEach((g, i) => {
      const bw = Math.max(46, g.w * 2.3)
      const bh = Math.max(46, g.y - g.top + g.w * 0.3)
      Object.assign(btns[i].style, { left: `${gb.x + g.x - bw / 2}px`, top: `${gb.y + g.y + g.w * 0.3 - bh}px`, width: `${bw}px`, height: `${bh}px` })
    })
    placeNames(gb, outer)
    glide()
  }

  /** phones: keep the chosen stone (and its name) above the sheet */
  function glide() {
    let dy = 0
    if (!wide && sheet && sel >= 0) {
      const g = geo[sel]
      const span = btns[sel].firstElementChild as HTMLElement
      const bottom = gbox.y + Math.max(g.y + g.w * 0.3, parseFloat(btns[sel].style.top) - gbox.y + span.offsetTop + span.offsetHeight) + 10
      const limit = root.clientHeight - card.offsetHeight - 8
      dy = Math.min(0, limit - bottom)
    }
    garden.style.translate = `0 ${dy}px`
  }

  function openSheet(on: boolean, refocus = false) {
    if (sheet === on) return
    sheet = on
    root.classList.toggle('sheet', !wide && on)
    glide()
    if (!on && refocus && sel >= 0) btns[sel].focus({ preventScroll: true })
  }

  // ───────── interaction ─────────
  function show(i: number) {
    const it = S.items[i]
    nameF.textContent = it.name
    nameB.textContent = it.name
    riskBox.replaceChildren(ctx.fact(it.risk, 'p', 't18s-risk'))
    habitBox.textContent = it.habit
  }

  function select(i: number) {
    ctx.chime('tap')
    btns.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)))
    if (!touched) {
      touched = true
      // the garden names its three islands once you step in
      if (ctx.reduced) isles.forEach((el) => (el.style.opacity = '1'))
      else ctx.anim(() => gsap.to(isles, { opacity: 1, duration: 1.6, stagger: 0.25, ease: 'power2.out', delay: 0.3 }))
    }
    const same = i === sel
    sel = i
    placeRing(i)
    const wasOpen = sheet
    openSheet(true)
    glide()
    if (same && !wasOpen && !wide) return
    if (same) {
      flip(!showingBack)
      return
    }
    const first = turn.hidden
    intro.hidden = true
    turn.hidden = false
    const swap = () => {
      show(i)
      setSide(false, false)
    }
    const it = S.items[i]
    say.textContent = `${it.name}. ${typeof it.risk === 'string' ? it.risk : it.risk.text}`
    if (ctx.reduced || first) {
      swap()
      if (!ctx.reduced) ctx.anim(() => gsap.fromTo(turn, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' }))
      return
    }
    ctx.anim(() => {
      gsap.to(turn, { opacity: 0, y: -6, duration: 0.25, ease: 'power2.in', onComplete: () => {
        swap()
        gsap.fromTo(turn, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' })
      } })
    })
  }

  function setSide(toBack: boolean, anim: boolean) {
    showingBack = toBack
    front.inert = toBack
    back.inert = !toBack
    turn.classList.toggle('flipped', toBack)
    if (anim && !ctx.reduced) ctx.anim(() => gsap.to(turn, { rotationY: toBack ? 180 : 0, duration: 1.1, ease: 'power3.inOut' }))
    else gsap.set(turn, { rotationY: toBack ? 180 : 0 })
  }

  function flip(toBack: boolean) {
    if (sel < 0 || toBack === showingBack) return
    setSide(toBack, true)
    ;(toBack ? backBtn : flipBtn).focus({ preventScroll: true })
    if (toBack) say.textContent = `${S.habitTitle}: ${S.items[sel].habit}`
    if (!toBack) return
    if (!flipped.has(sel)) {
      flipped.add(sel)
      btns[sel].classList.add('done')
      const mg = mossG[sel]
      if (mg) {
        if (ctx.reduced) mg.setAttribute('opacity', '1')
        else ctx.anim(() => gsap.fromTo(mg, { opacity: 0 }, { opacity: 1, duration: 1.4, delay: 0.5, ease: 'power2.out' }))
      }
      count.textContent = fill(S.count, { n: flipped.size })
      say.textContent += `. ${count.textContent}`
      if (flipped.size === 3) ctx.insight(S.insight)
      ctx.chime('soft')
    }
  }

  svg.addEventListener('click', () => !wide && openSheet(false))
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !wide && sheet) {
      e.stopPropagation()
      openSheet(false, true)
    }
  })
  watch(
    ctx,
    () => {
      st.reset()
      measuredW = -1
      layout()
    },
    true,
  )
  ctx.prompt(S.prompt)
  if (!ctx.reduced) {
    gsap.from(svg, { opacity: 0, duration: 1.6, ease: 'power2.out', delay: 0.2 })
    gsap.from(btns.map((b) => b.firstElementChild), { opacity: 0, y: 6, stagger: 0.08, duration: 1, ease: 'power3.out', delay: 0.8 })
    gsap.fromTo(mark.reveal, { attr: { 'stroke-dashoffset': 1.02 } }, { attr: { 'stroke-dashoffset': 0 }, duration: 1.8, ease: 'power2.inOut', delay: 0.6 })
  }
}
