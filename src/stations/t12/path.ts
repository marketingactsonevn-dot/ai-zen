import { fill, h, nextId, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { C } from './data'
import { drawLantern, lanternLight } from './lantern'
import { afterFonts, clamp, f1, later, lerp, ring, stableHeight, stoneArt, type Pt } from './ink'
import { backWall, dryH, mossIsland, raking } from './garden'

type Mode = 'land' | 'port' | 'compact'
interface Slot {
  x: number
  y: number
  sc: number
}

/** the lantern's outline, top to bottom (local units, 100 = its height): [from, to, half width] */
const PROFILE: [number, number, number][] = [[5, 22, 7], [22, 34.5, 29.5], [34.5, 50.5, 13.2], [50.5, 58.5, 17], [58.5, 92, 7], [92, 101, 22]]
/** the lantern's half width in pixels over the band y0…y1 */
function lanternHW(ly: number, Lh: number, y0: number, y1: number) {
  let w = 0
  for (const [a, b, hw] of PROFILE) if (y1 > ly - ((100 - a) * Lh) / 100 && y0 < ly - ((100 - b) * Lh) / 100) w = Math.max(w, (hw * Lh) / 100)
  return w
}

/**
 * Scene 1 — "Lối đá tới đèn": six word-stones lie on raked sand beside a dark stone lantern.
 * Each stone laid on the stepping-stone path raises the light inside the lantern (the quality meter)
 * and shows what that part of a prompt says.
 */
export function pathScene(ctx: SceneCtx) {
  const T = C.scenes.path
  const B = T.blocks
  const N = B.length
  const lowQ = ctx.quality === 'low'
  const uid = nextId('t12p')

  const svg = s('svg', { class: 't12p-svg', 'aria-hidden': 'true' })
  const capLevel = h('span', { class: 'visually-hidden' })
  const capT = h('p', { class: 't12p-cap-t' })
  const capX = h('p', { class: 't12p-cap-x' })
  const cap = h('div', { class: 't12p-cap', 'aria-live': 'polite' }, capLevel, capT, capX)
  const pips = B.map(() => h('i'))
  const meter = h('div', { class: 't12p-meter', 'aria-hidden': 'true' }, h('span', { class: 't12p-pips' }, ...pips.slice().reverse()), h('span', { class: 't12p-meter-l' }, T.meter))
  const stonesEl = h('div', { class: 't12p-stones', role: 'group', 'aria-label': T.group })
  const root = h('div', { class: 't12 t12p' }, h('p', { class: 'visually-hidden' }, T.art), svg, cap, meter, stonesEl)
  ctx.art.append(root)
  ctx.prompt(T.prompt)
  const stable = stableHeight(ctx, [[T.insight, T.detail]])

  // ── the word-stones (their ink, which takes no room, is laid in a stone per frame while they are still hidden)
  const stones = B.map((b) => {
    const word = h('span', { class: 't12-word' }, b.name)
    const body = h('span', { class: 't12-stone-body' }, word)
    const el = h('button', { class: 't12-stone', type: 'button', 'aria-label': fill(T.place, { name: b.name }) }, body)
    stonesEl.append(el)
    return { el, body, home: [0, 0] as Pt, homeSc: 1, w: 100, hgt: 44, slot: -1 }
  })
  gsap.set(stones.map((st) => st.el), { xPercent: -50, yPercent: -50 })
  const inking = (function* () {
    for (const [i, st] of stones.entries()) yield st.body.prepend(stoneArt(i * 7 + 3))
  })()
  ctx.onCleanup(later(inking, ctx.reduced).cancel)

  // ── state
  let mode: Mode = 'land'
  let W = 1
  let H = 1
  let slots: Slot[] = []
  let placed = 0
  let done = false
  const lvl = { v: 0 }
  let ringsG: SVGGElement[] = []
  let holes: SVGEllipseElement[] = []
  let hollows: SVGPathElement[] = []
  let ambient: gsap.core.Tween[] = []
  let L = { lx: 0, ly: 0, Lh: 0, baseHW: 0 }

  let setLight: (v: number) => void = () => {}
  const applyLevel = () => setLight(lvl.v)

  // ───────── layout ─────────
  /** six slots along a quadratic path A → B (control Q), far stones smaller, spaced by the widest pair of stones */
  function pathSlots(A: Pt, Q: Pt, Bp: Pt, sc0: number, scF: number, wRef: number, zig: number, minSc: number) {
    const M = 60
    const P = Array.from({ length: M + 1 }, (_, i) => {
      const t = i / M
      const m = 1 - t
      return [m * m * A[0] + 2 * m * t * Q[0] + t * t * Bp[0], m * m * A[1] + 2 * m * t * Q[1] + t * t * Bp[1]] as Pt
    })
    const cum = [0]
    for (let i = 1; i <= M; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]))
    const at = (d: number): Pt => {
      let i = 1
      while (i < M && cum[i] < d) i++
      const u = clamp((d - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]), 0, 1)
      return [lerp(P[i - 1][0], P[i][0], u), lerp(P[i - 1][1], P[i][1], u)]
    }
    let sc = Array.from({ length: N }, (_, k) => Math.max(minSc, lerp(sc0, scF, k / (N - 1))))
    // centre to centre: half of each stone, a little overlap at the rims (they sit staggered), a breath of sand
    const gap = (k: number) => ((sc[k] + sc[k - 1]) / 2) * wRef * 0.86 + 8
    const need = () => sc.reduce((a, _, k) => (k ? a + gap(k) : a), 0)
    if (need() > cum[M]) {
      const f = cum[M] / need()
      sc = sc.map((v) => Math.max(minSc, v * f))
    }
    const D = need()
    const k = cum[M] / D
    let d = 0
    return {
      fits: D <= cum[M] + 1,
      slots: sc.map((v, i) => {
        if (i) d += gap(i) * k
        const p = at(d)
        return { x: p[0], y: p[1] + (i % 2 ? 1 : -1) * zig * v, sc: v }
      }),
    }
  }

  function layout(wrap = false) {
    const r = root.getBoundingClientRect()
    W = Math.max(1, r.width)
    H = Math.max(1, stable.H(r.height))
    mode = W / H < 1.3 ? 'port' : H < 330 ? 'compact' : 'land'
    root.dataset.mode = mode
    // a very short landscape screen: the caption folds into one line
    root.dataset.tight = String(mode === 'compact' && H < 175)
    // when the path is too short for six stones in a row, the longer words fold onto two lines
    root.dataset.wrap = String(wrap)
    // stones' real sizes in this mode
    stones.forEach((st) => {
      st.w = st.body.offsetWidth
      st.hgt = st.body.offsetHeight
    })
    const ws = stones.map((st) => st.w).sort((p, q) => q - p)
    const avgW = ws.reduce((p, q) => p + q, 0) / N
    const maxW = ws[0]
    // the widest two stones may end up side by side
    const wRef = (ws[0] + ws[1]) / 2
    const sh = stones[0].hgt
    // far stones shrink, but never so far that their word drops below 12.5px
    const minSc = Math.min(1, 12.5 / (parseFloat(getComputedStyle(stones[0].body.lastElementChild as HTMLElement).fontSize) || 16))

    // caption box: measure the tallest caption at this width
    let capW: number, capX0: number, capY0 = 0
    if (mode === 'port') (capW = W), (capX0 = 0)
    else if (mode === 'compact') (capW = W * 0.76), (capX0 = 0)
    else (capW = Math.min(W * 0.5, 560)), (capX0 = W * 0.02), (capY0 = H * 0.03)
    Object.assign(cap.style, { left: `${capX0}px`, top: `${capY0}px`, width: `${capW}px` })
    // the tallest caption at this width, measured on a hidden twin (the real one is a live region)
    const probe = cap.cloneNode(false) as HTMLElement
    probe.removeAttribute('aria-live')
    probe.setAttribute('aria-hidden', 'true')
    probe.style.visibility = 'hidden'
    root.append(probe)
    let capH = 0
    B.forEach((b) => {
      probe.replaceChildren(...capLines(b.title, b.hint, b.example))
      capH = Math.max(capH, probe.offsetHeight)
    })
    probe.remove()

    let lx: number, ly: number, Lh: number, yh: number
    let fits = true
    const homes: Pt[] = []
    const homeSc: number[] = stones.map(() => 1)
    slots = []
    if (mode === 'port') {
      const top = capH + 10
      Lh = Math.min((H - top) * 0.54, W * 0.66, 520)
      lx = W / 2
      ly = top + Lh * 0.95
      yh = top + Lh * 0.2
      const isle = Lh * 0.36
      // loose stones: a 3 · 2 · 1 scatter beside the lantern, each at its own height, clear of the lantern and its rings
      const k0 = Math.max(minSc, 0.85)
      const hh = (sh * k0) / 2
      const bandTop = top + hh + 2
      const bandBot = ly - 0.153 * Lh - hh - 6
      // [side, height in the band, 0 = close to the lantern … 1 = out at the edge]
      const SPOT: [number, number, number][] = [[-1, 0.2, 0.1], [-1, 0.5, 1], [-1, 0.76, 0.05], [1, 0, 0.45], [1, 0.6, 0.1], [1, 0.94, 0.85]]
      stones.forEach((st, i) => {
        const [side, fy, out] = SPOT[i]
        const hw = (st.w * k0) / 2
        const y = lerp(bandTop, Math.max(bandTop, bandBot), fy)
        const near = lx + side * (lanternHW(ly, Lh, y - hh, y + hh) + hw + 6)
        const far = side < 0 ? hw + 3 : W - hw - 3
        homes.push([side < 0 ? Math.min(near, lerp(near, far, out)) : Math.max(near, lerp(near, far, out)), y])
        homes[i][0] = clamp(homes[i][0], hw + 2, W - hw - 2)
        homeSc[i] = k0
      })
      // the path climbs from the viewer to the outer raked ring of the lantern, stones alternating left and right
      const y0 = H - sh * 0.5 - 6
      const y1 = ly + isle * 0.35 + sh * 0.4
      for (let k = 0; k < N; k++) {
        const t = k / (N - 1)
        const sc = Math.max(minSc, lerp(0.94, 0.72, t))
        slots.push({ x: W / 2 + (k % 2 ? 1 : -1) * Math.min(W * 0.17, avgW * sc * 0.62) * (1 - t * 0.35), y: lerp(y0, y1, t ** 0.92), sc })
      }
    } else if (mode === 'compact') {
      // three quiet bands: the caption on top, the loose stones in a row, the path along the near edge to the lantern
      const tight = H < 175
      const rowY = capH + 4 + sh / 2
      const looseBottom = rowY + sh / 2 + 6
      const sc0 = Math.max(minSc, tight ? 0.8 : 0.92)
      const scF = Math.max(minSc, 0.78)
      const nearY = H - (sh * sc0) / 2 - 7
      const farY = clamp(nearY - H * 0.2, looseBottom + (sh * scF) / 2 + 4, nearY)
      // the lantern's foot sits at the path's far end; it is as tall as fits, its raked rings inside the picture
      ly = farY
      Lh = Math.min(W * 0.2, ly - 2, (H - 4 - ly) / 0.153)
      lx = W - Math.max(W * 0.05 + 0.3 * Lh, 0.32 * Lh)
      yh = capH + 4
      const ringR = 0.55 * Lh
      // the loose stones: one row grouped 3 · 2 · 1, a stone's breadth between the groups
      const groups = [[0, 1, 2], [3, 4], [5]]
      const scale = [1, 0.95, 1, 1, 0.95, 1]
      const dy = [0.04, 0, 0.1, 0.02, 0.09, 0].map((v) => v * sh)
      const x0 = W * 0.02
      const x1 = lx - 0.32 * Lh - 6
      const inner = 3
      const sum = stones.reduce((a, st, i) => a + st.w * scale[i], 0) + inner * 3
      const shrink = clamp((x1 - x0) / (sum + avgW * 0.5), Math.max(minSc, 0.84), 1)
      scale.forEach((v, i) => (homeSc[i] = v * shrink))
      const gap = clamp((x1 - x0 - sum * shrink) / 2, 6, avgW * 1.2)
      let x = x0
      groups.forEach((g) => {
        g.forEach((i, j) => {
          const w = stones[i].w * homeSc[i]
          x += j > 0 ? inner : 0
          homes[i] = [x + w / 2, rowY + dy[i]]
          x += w
        })
        x += gap
      })
      // the path: from the near left, rising a little as it goes back to the lantern's island
      const A: Pt = [W * 0.02 + wRef * 0.5 * sc0, nearY]
      const Bp: Pt = [lx - ringR - maxW * 0.5 * scF - 2, farY]
      const p = pathSlots(A, [lerp(A[0], Bp[0], 0.6), lerp(A[1], Bp[1], 0.15)], Bp, sc0, scF, wRef, sh * 0.2, minSc)
      slots = p.slots
      fits = p.fits
    } else {
      // the lantern stands back in the garden: its foot well above the near edge, so the path can recede to it
      const nearY = H - Math.max(sh * 0.62, avgW * 0.26) - 6
      ly = H * 0.7
      Lh = Math.min(H * 0.66, W * 0.4, 640)
      lx = W - Math.max(W * 0.08 + 0.34 * Lh, 0.32 * Lh)
      yh = H * 0.36
      const ringR = 0.55 * Lh // the lantern's outer raked ring, and a little sand
      // loose stones: one deliberate cluster below the caption, grouped 3 · 2 · 1 like a garden's stone groups
      const groups = [[0, 1, 2], [3, 4], [5]]
      const dy = [0.4, -0.42, 0.44, -0.36, 0.36, -0.28].map((v) => v * sh)
      const scale = [1, 1.08, 0.95, 1.04, 0.94, 1]
      const x0 = W * 0.03
      const x1 = lx - ringR - avgW * 0.4
      const gW = groups.map((g) => {
        let w = (stones[g[0]].w * scale[g[0]]) / 2 + (stones[g[g.length - 1]].w * scale[g[g.length - 1]]) / 2
        for (let j = 1; j < g.length; j++) w += ((stones[g[j - 1]].w * scale[g[j - 1]] + stones[g[j]].w * scale[g[j]]) / 2) * 0.64
        return w
      })
      const sum = gW.reduce((a, b) => a + b, 0)
      const shrink = clamp((x1 - x0) / (sum + avgW * 0.7), 0.8, 1)
      scale.forEach((v, i) => (homeSc[i] = v * shrink))
      const gap = clamp((x1 - x0 - sum * shrink) / 2, avgW * 0.3 * shrink, avgW * 1.5)
      let x = x0 + Math.max(0, x1 - x0 - sum * shrink - gap * 2) * 0.3
      const yb = Math.max(capY0 + capH + sh * 0.95 + 8, yh + sh * 0.75, H * 0.5)
      groups.forEach((g) => {
        g.forEach((i, j) => {
          const w = stones[i].w * homeSc[i]
          if (j > 0) x += ((stones[g[j - 1]].w * homeSc[g[j - 1]] + w) / 2) * 0.64
          else x += w / 2
          homes[i] = [x, Math.max(yb + dy[i], capY0 + capH + sh * 0.5 * homeSc[i] + 6)]
        })
        x += (stones[g[g.length - 1]].w * homeSc[g[g.length - 1]]) / 2 + gap
      })
      // the path: from the near left it bends and recedes to the lantern's foot, stones growing smaller with distance
      const A: Pt = [W * 0.04 + wRef * 0.5, nearY]
      const Bp: Pt = [lx - ringR - maxW * 0.5 * 0.7 - 4, ly - 0.02 * Lh]
      const p = pathSlots(A, [lerp(A[0], Bp[0], 0.62), lerp(A[1], Bp[1], 0.12)], Bp, 1, 0.7, wRef, sh * 0.14, minSc)
      slots = p.slots
      fits = p.fits
    }
    // too many stones for the path: fold the long words and lay it out again
    if (!fits && !wrap) return layout(true)
    L = { lx, ly, Lh, baseHW: 0.21 * Lh }
    stones.forEach((st, i) => ((st.home = homes[i]), (st.homeSc = homeSc[i])))
    // nearer stones (lower on the screen) lie over farther ones
    stones.forEach((st) => {
      if (st.slot < 0) st.el.style.zIndex = String(10 + Math.round(st.home[1] / 4))
    })
    // meter: a column of six pips beside the lantern, above its raked rings (not in portrait, where stones flank it)
    meter.hidden = mode === 'port'
    if (mode !== 'port') {
      const mh = meter.offsetHeight
      Object.assign(meter.style, { left: `${lx + 0.33 * Lh}px`, top: `${Math.max(0, Math.min(ly - Lh * (mode === 'compact' ? 0.66 : 0.36), ly - 0.13 * Lh - 8 - mh))}px` })
    }
    // the picture: drawn again only when something it shows moved (a re-layout for fonts or an unchanged size draws nothing)
    const key = JSON.stringify([W, H, mode, L, yh, slots, stones.map((st) => st.w)])
    if (key !== drawn) {
      drawn = key
      drawing?.cancel()
      drawing = later(draw(yh), ctx.reduced || shown)
    }
    // place the stones (a dragged one stays under the finger)
    stones.forEach((st) => {
      if (st.el.classList.contains('dragging') || st.el.classList.contains('flying')) return
      gsap.killTweensOf(st.el)
      if (st.slot >= 0) {
        const sl = slots[st.slot]
        gsap.set(st.el, { x: sl.x, y: sl.y - st.hgt * 0.12 * sl.sc, scale: sl.sc })
      } else gsap.set(st.el, { x: st.home[0], y: st.home[1], scale: st.homeSc })
    })
  }

  // ───────── the picture ─────────
  let drawn = ''
  let drawing: { cancel(): void } | null = null
  let shown = false // the first picture is laid in a part per frame while the scene fades in; a later one (a resize) at once
  ctx.onCleanup(() => drawing?.cancel())
  function* draw(yh: number) {
    ambient.forEach((t) => t.kill())
    ambient = []
    const { lx, ly, Lh } = L
    svg.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    svg.setAttribute('width', f1(W))
    svg.setAttribute('height', f1(H))
    svg.replaceChildren()
    const persp = 0.3 // ellipses on the ground: ry / rx

    // defs: light gradients, the window clip, the sand mask
    const maskId = `${uid}-m`
    const mask = s('mask', { id: maskId, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, s('rect', { x: 0, y: 0, width: W, height: H, fill: '#fff' }))
    const isle = Lh * 0.36
    const baseRing = isle * 1.5
    mask.append(s('ellipse', { cx: lx, cy: ly, rx: baseRing, ry: baseRing * persp, fill: '#000' }))
    holes = slots.map((sl) => {
      const e = s('ellipse', { cx: f1(sl.x), cy: f1(sl.y), rx: 0, ry: 0, fill: '#000' })
      mask.append(e)
      return e
    })
    svg.append(s('defs', null,
      dryH(),
      mask))

    // the back wall with trees beyond it, then raked sand stopped by the rings around stones
    const wallH = clamp(H * (mode === 'compact' ? 0.07 : 0.055), 14, 44)
    // the garden fades out at the left and right edges instead of stopping at a line
    const fadeId = `${uid}-f`
    svg.append(s('defs', null,
      s('linearGradient', { id: `${fadeId}g`, x1: 0, y1: 0, x2: 1, y2: 0 }, s('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 0 }), s('stop', { offset: 0.05, 'stop-color': '#fff' }), s('stop', { offset: 0.95, 'stop-color': '#fff' }), s('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 })),
      s('mask', { id: fadeId, maskUnits: 'userSpaceOnUse', x: 0, y: -H, width: W, height: H * 3 }, s('rect', { x: 0, y: -H, width: W, height: H * 3, fill: `url(#${fadeId}g)` }))))
    const rake = s('g', { class: 't12-sand' })
    const sand = s('g', { mask: `url(#${maskId})` }, rake)
    yield
    // (a short landscape screen has no room for the wall above the stones: just sand)
    svg.append(s('g', { mask: `url(#${fadeId})` }, mode === 'compact' ? null : backWall(-W * 0.04, W * 1.04, yh, wallH, lowQ, 3), sand))
    yield
    yield* raking(rake, -W * 0.04, W * 1.04, yh, H, mode === 'compact' ? 0.75 : 1, 5)
    const rings = s('g', { filter: lowQ ? null : 'url(#ink-rough)' })
    for (let k = 1; k <= 3; k++) rings.append(s('path', { class: 't12-ring', d: ring(lx, ly, isle * (1 + k * 0.14), isle * (1 + k * 0.14) * persp, lerp(1.1, 1.8, ly / H), 70 + k) }))
    svg.append(rings)
    yield
    svg.append(mossIsland(lx + Lh * 0.02, ly + Lh * 0.006, isle * 0.92, isle * 0.92 * persp, lowQ))
    yield

    // where the stones can go: shallow hollows in the sand; rings appear once a stone is laid
    const avgW = stones.reduce((a, st) => a + st.w, 0) / N
    hollows = []
    ringsG = []
    const ringsBox = s('g', { filter: lowQ ? null : 'url(#ink-rough)' })
    const hollowsBox = s('g', { filter: lowQ ? null : 'url(#ink-dry)' })
    svg.append(ringsBox, hollowsBox)
    for (const [k, sl] of slots.entries()) {
      const rx = avgW * sl.sc * 0.5
      const hol = s('path', { class: 't12p-hollow', d: ring(sl.x, sl.y, rx * 0.9, rx * 0.9 * persp * 1.15, 1.4, 90 + k) })
      hollows.push(hol)
      const g = s('g', { class: 't12p-slotrings' })
      for (let j = 1; j <= (mode === 'port' ? 1 : 2); j++) g.append(s('path', { class: 't12-ring', d: ring(sl.x, sl.y + 1, rx * (1.08 + j * 0.2), rx * (1.08 + j * 0.2) * persp * 1.1, lerp(1, 1.7, sl.y / H), 110 + k * 3 + j) }))
      const filled = stones.some((st) => st.slot === k)
      g.style.opacity = filled ? '1' : '0'
      hol.style.opacity = filled ? '0' : ''
      if (filled) holes[k].setAttribute('rx', f1(rx * 1.56)), holes[k].setAttribute('ry', f1(rx * 1.56 * persp * 1.1))
      ringsG.push(g)
      ringsBox.append(g)
      hollowsBox.append(hol)
      yield
    }

    // light: a pool on the sand, a halo behind the lantern; in the window the rising light and the flame
    const lant = drawLantern(lx, ly, Lh, lowQ)
    const light = lanternLight(uid, lant, lx, ly, Lh, root)
    svg.append(...light.under, lant.g, ...light.over)
    setLight = light.set
    applyLevel()
    if (!ctx.reduced && !lowQ) {
      ctx.anim(() => {
        ambient.push(gsap.to(light.flick, { rotation: 'random(-4, 4)', y: 'random(-0.6, 0.6)', duration: 0.24, repeat: -1, yoyo: true, repeatRefresh: true, ease: 'sine.inOut', svgOrigin: light.origin }))
      })
    }
    shown = true
  }

  // ───────── caption ─────────
  function capLines(title: string, hint: string, example: string) {
    return [h('p', { class: 't12p-cap-t' }, h('span', { class: 't12p-cap-name' }, title), h('span', { class: 't12p-cap-hint' }, hint)), h('p', { class: 't12p-cap-x' }, example)]
  }
  function setCap(title: string, hint: string, example: string) {
    const [a, b] = capLines(title, hint, example)
    capT.replaceChildren(...a.childNodes)
    capX.textContent = b.textContent
  }
  function showCap(i: number) {
    const b = B[i]
    capLevel.textContent = fill(T.level, { n: placed, total: N })
    setCap(b.title, b.hint, b.example)
    cap.classList.add('on')
    if (!ctx.reduced)
      ctx.anim(() => {
        gsap.fromTo(capT, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' })
        gsap.fromTo(capX, { clipPath: 'inset(0 100% 0 0)', opacity: 0.2 }, { clipPath: 'inset(0 -4% 0 0)', opacity: 1, duration: 1.5, ease: 'power2.out', delay: 0.15, clearProps: 'clipPath' })
      })
  }

  // ───────── placing a stone ─────────
  function place(i: number) {
    const st = stones[i]
    if (st.slot >= 0) return showCap(i)
    const k = placed
    st.slot = k
    placed++
    st.el.classList.add('placed')
    st.el.style.zIndex = String(N - k)
    st.el.setAttribute('aria-label', fill(T.again, { name: B[i].name }))
    pips[k].classList.add('on')
    const sl = slots[k]
    const avgW = stones.reduce((a, s2) => a + s2.w, 0) / N
    const rx = avgW * sl.sc * 0.5
    const settle = () => {
      st.el.classList.remove('flying')
      const now = slots[k]
      gsap.set(st.el, { x: now.x, y: now.y - st.hgt * 0.12 * now.sc, scale: now.sc })
      ctx.chime(placed === N ? 'ok' : 'soft')
      showCap(i)
      if (ctx.reduced) {
        ringsG[k].style.opacity = '1'
        hollows[k].style.opacity = '0'
        holes[k].setAttribute('rx', f1(rx * 1.56))
        holes[k].setAttribute('ry', f1(rx * 1.56 * 0.33))
        lvl.v = placed / N
        applyLevel()
      } else
        ctx.anim(() => {
          gsap.to(holes[k], { attr: { rx: rx * 1.56, ry: rx * 1.56 * 0.33 }, duration: 1.2, ease: 'power2.out' })
          gsap.fromTo(ringsG[k], { opacity: 0, scale: 0.7, svgOrigin: `${f1(sl.x)} ${f1(sl.y)}` }, { opacity: 1, scale: 1, duration: 1.6, ease: 'expo.out' })
          gsap.to(hollows[k], { opacity: 0, duration: 0.5 })
          gsap.to(lvl, { v: placed / N, duration: 1.8, ease: 'power2.out', onUpdate: applyLevel })
          gsap.fromTo(st.body, { y: -4 }, { y: 0, duration: 0.6, ease: 'bounce.out' })
        })
      if (placed === N && !done) {
        done = true
        root.classList.add('lit')
        ctx.insight(T.insight, T.detail)
      }
    }
    if (ctx.reduced) {
      gsap.set(st.el, { x: sl.x, y: sl.y - st.hgt * 0.12 * sl.sc, scale: sl.sc })
      return settle()
    }
    st.el.classList.add('flying')
    ctx.anim(() => {
      const x0 = gsap.getProperty(st.el, 'x') as number
      const y0 = gsap.getProperty(st.el, 'y') as number
      const lift = Math.min(60, Math.hypot(sl.x - x0, sl.y - y0) * 0.25)
      gsap.timeline({ onComplete: settle })
        .to(st.el, { x: sl.x, duration: 0.95, ease: 'power2.inOut' }, 0)
        .to(st.el, { y: Math.min(y0, sl.y) - lift, duration: 0.45, ease: 'power2.out' }, 0)
        .to(st.el, { y: sl.y - st.hgt * 0.12 * sl.sc, duration: 0.5, ease: 'power2.in' }, 0.45)
        .to(st.el, { scale: sl.sc, duration: 0.95, ease: 'power2.inOut' }, 0)
    })
  }

  // ───────── input: drag a stone (or tap / Enter / Space it) ─────────
  const inZone = (x: number, y: number) => {
    const pad = Math.max(48, stones[0].hgt)
    const xs = slots.map((sl) => sl.x)
    const ys = slots.map((sl) => sl.y)
    const inBox = x > Math.min(...xs) - pad * 1.6 && x < Math.max(...xs) + pad * 1.6 && y > Math.min(...ys) - pad && y < Math.max(...ys) + pad
    return inBox || Math.hypot(x - L.lx, (y - L.ly) * 2) < L.Lh * 0.42
  }
  stones.forEach((st, i) => {
    let id: number | null = null
    let ox = 0, oy = 0, sx = 0, sy = 0
    let moved = false
    st.el.addEventListener('pointerdown', (e) => {
      if (st.slot >= 0 || e.button !== 0) return
      id = e.pointerId
      moved = false
      const rr = root.getBoundingClientRect()
      sx = e.clientX
      sy = e.clientY
      ox = e.clientX - rr.left - (gsap.getProperty(st.el, 'x') as number)
      oy = e.clientY - rr.top - (gsap.getProperty(st.el, 'y') as number)
      try {
        st.el.setPointerCapture(e.pointerId)
      } catch {
        /* the pointer is already gone */
      }
    })
    st.el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return
      if (!moved && Math.hypot(e.clientX - sx, e.clientY - sy) < 6) return
      if (!moved) {
        moved = true
        gsap.killTweensOf(st.el)
        st.el.classList.add('dragging')
        hollows[placed]?.classList.add('next')
      }
      const rr = root.getBoundingClientRect()
      const x = clamp(e.clientX - rr.left - ox, 0, W)
      const y = clamp(e.clientY - rr.top - oy, 0, H)
      gsap.set(st.el, { x, y })
      hollows[placed]?.classList.toggle('hot', inZone(x, y))
    })
    const end = (e: PointerEvent) => {
      if (e.pointerId !== id) return
      id = null
      if (!moved) return
      st.el.classList.remove('dragging')
      hollows.forEach((hl) => hl.classList.remove('next', 'hot'))
      const x = gsap.getProperty(st.el, 'x') as number
      const y = gsap.getProperty(st.el, 'y') as number
      if (inZone(x, y)) place(i)
      else ctx.anim(() => gsap.to(st.el, { x: st.home[0], y: st.home[1], scale: st.homeSc, duration: 0.9, ease: 'power3.out' }))
    }
    st.el.addEventListener('pointerup', end)
    st.el.addEventListener('pointercancel', end)
    st.el.addEventListener('click', () => {
      if (moved) return void (moved = false)
      place(i)
    })
  })

  // ───────── go ─────────
  let raf = 0
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => layout())
  })
  // (before the layout: these read styles, and after its writes that would cost one more style pass)
  if (!ctx.reduced) {
    gsap.from(stones.map((st) => st.body), { opacity: 0, y: 18, scale: 0.92, duration: 1.3, stagger: 0.1, delay: 0.5, ease: 'power3.out', clearProps: 'opacity,transform' })
    gsap.from(svg, { opacity: 0, duration: 1.6, ease: 'power1.out' })
  }
  ro.observe(root)
  layout()
  afterFonts(ctx, () => (stable.reset(), layout()))

  return () => {
    ro.disconnect()
    cancelAnimationFrame(raf)
    ambient.forEach((t) => t.kill())
  }
}
