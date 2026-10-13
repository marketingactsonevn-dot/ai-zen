import { h, nextId, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { brush, C, clamp, defs, ell, layer, loop, measure, onSize, passFocus, place, rng, stableHeight, stone, type Pt } from './ink'

const K = C.scenes.hallu

interface Geo { x: number; y: number; rx: number; ry: number; fs: number }
interface StoneEl { wrap: SVGGElement; g: SVGGElement; btn: HTMLButtonElement; note: HTMLElement; state: 'idle' | 'ok' | 'broken' }

/** Scene 3 — the AI lays its answer across a stream as stepping stones; one is a confident fake that cracks when tested. */
export function halluScene(ctx: SceneCtx) {
  const stable = stableHeight(ctx, [K.insight])
  const svg = layer()
  const ids = defs(svg)
  const bg = s('g')
  const water = s('g', { class: 't6h-water' })
  const stonesG = s('g')
  const fx = s('g')
  svg.append(bg, water, stonesG, fx)
  const q = h('p', { class: 't6h-q' }, h('span', null, K.question), ' ', ctx.tag('illustration'))
  const gapLab = h('span', { class: 't6-lab t6h-gap', 'aria-hidden': 'true' }, K.gap)
  gapLab.style.opacity = '0'
  const root = h('div', { class: 't6 t6h' }, h('p', { class: 'visually-hidden' }, K.art), svg, q, gapLab)
  ctx.art.append(root)

  const stones: StoneEl[] = K.stones.map((st, i) => {
    const note = h('div', { class: 't6h-note', 'aria-live': 'polite' })
    const btn = h('button', { class: 't6-hit t6h-hit', type: 'button', 'aria-label': st.aria, onClick: () => tap(i) })
    root.append(btn, note)
    const wrap = s('g')
    stonesG.append(wrap)
    return { wrap, g: s('g'), btn, note, state: 'idle' }
  })
  const fixedNote = h('div', { class: 't6h-note', 'aria-live': 'polite' })
  root.append(fixedNote)

  let geo: Geo[] = []
  let W = 1, H = 1
  let portrait = false
  let flows: { el: SVGPathElement; x: number; v: number; span: number }[] = []
  let built = false

  function layout() {
    W = root.clientWidth
    const Hraw = root.clientHeight
    if (!W || !Hraw) return
    H = stable.H(Hraw)
    svg.setAttribute('viewBox', `0 0 ${W} ${Hraw}`)
    const land = W / H > 1.1
    portrait = !land
    const qw = Math.min(W - 8, 560)
    place(q, (W - qw) / 2, 4, qw)
    const qh = q.offsetHeight + 12
    // the stream: banks that meander, water that fades out at both ends
    const top = qh + (H - qh) * (land ? 0.2 : 0.07)
    const bot = H - (H - qh) * (land ? 0.12 : 0.08)
    const r = rng(12)
    bg.replaceChildren()
    water.replaceChildren()
    // portrait: a gentler near bank, so its crests never run under the insight below
    const amp = (bot - top) * (land ? 0.06 : 0.035)
    const bank = (y: number, seed: number, a: number): Pt[] => Array.from({ length: 11 }, (_, i) => [(-0.06 + i * 0.112) * W, y + Math.sin(i * 1.3 + seed) * a + Math.sin(i * 0.5 + seed * 2) * a * 0.6] as Pt)
    const far = bank(top, 1, amp * 0.6)
    const near = bank(bot, 4, amp)
    const fadeId = nextId('t6hf')
    bg.append(s('defs', null,
      s('linearGradient', { id: `${fadeId}-g`, x1: 0, x2: 1, y1: 0, y2: 0 },
        s('stop', { offset: 0, 'stop-color': '#000' }), s('stop', { offset: land ? 0.08 : 0.02, 'stop-color': '#fff' }),
        s('stop', { offset: land ? 0.92 : 0.98, 'stop-color': '#fff' }), s('stop', { offset: 1, 'stop-color': '#000' })),
      s('mask', { id: fadeId, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, s('rect', { width: W, height: H, fill: `url(#${fadeId}-g)` }))))
    bg.setAttribute('mask', `url(#${fadeId})`)
    water.setAttribute('mask', `url(#${fadeId})`)
    const P = (p: Pt) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`
    // far hills in the mist
    for (const [y0, hgt, op, seed] of [[top - 6, 0.3, 0.05, 3], [top - 2, 0.18, 0.07, 9]] as const) {
      const pts: Pt[] = []
      const rr = rng(seed)
      for (let i = 0; i <= 14; i++) pts.push([(i / 14) * W * 1.1 - W * 0.05, y0 - (top - qh) * hgt * (0.35 + 0.65 * Math.abs(Math.sin(i * 0.9 + rr() * 2))) ])
      bg.append(s('path', { class: 'k', 'fill-opacity': op, d: `M${P([-W * 0.05, y0])}L${pts.map(P).join('L')}L${P([W * 1.05, y0])}Z`, filter: 'url(#ink-wash)' }))
    }
    bg.append(
      s('path', { class: 't6h-river', d: `M${far.map(P).join('L')}L${near.slice().reverse().map(P).join('L')}Z`, filter: 'url(#ink-wash)' }),
      // a pale sheen down the middle of the water
      s('path', { class: 'p', 'fill-opacity': 0.5, d: brush(far.map(([x, y], i) => [x, y + (bot - top) * 0.42 + Math.sin(i) * 3] as Pt), (bot - top) * 0.1, { a: 0.3, b: 0.3, min: 0.1 }).d, filter: 'url(#ink-wash)' }),
    )
    // banks: broken brush strokes, heavier on the near side
    for (const [pts, w, op] of [[far, 2.4, 0.42], [near, 3.4, 0.55]] as const) {
      for (let k = 0; k < 3; k++) {
        const a = Math.floor((k / 3) * pts.length), b = Math.min(pts.length, Math.floor(((k + 1) / 3) * pts.length) + 1)
        bg.append(s('path', { class: 'k', 'fill-opacity': op, d: brush(pts.slice(a, b), w * (0.8 + r() * 0.5), { a: 0.15, b: 0.3, min: 0.15 }).d, filter: 'url(#ink-rough)' }))
      }
    }
    bg.append(s('path', { class: 'k', 'fill-opacity': 0.16, d: brush(near.map(([x, y]) => [x, y + 8] as Pt), 1.4, { a: 0.1, b: 0.1, min: 0.4 }).d }))
    // reeds on the far bank, pebbles on the near one
    for (const [rx0, n] of [[0.07, 7], [0.18, 4], [0.84, 6], [0.94, 4]] as const) {
      const g = s('g', { class: 'md', filter: 'url(#ink-rough)' })
      const by = far[Math.round(rx0 * 9)][1]
      for (let k = 0; k < n; k++) {
        const x = W * rx0 + (r() - 0.5) * 26
        const hh = (18 + r() * 30) * clamp((top - qh) / 80, 0.5, 1.2)
        const lean = (r() - 0.5) * 18
        g.append(s('path', { d: brush([[x, by + 2], [x + lean * 0.4, by - hh * 0.5], [x + lean, by - hh]], 2.1, { a: 0.05, b: 0.8 }).d }))
      }
      bg.append(g)
    }
    for (let k = 0; k < 6; k++) {
      const x = W * (0.08 + r() * 0.84)
      const y = near[Math.round((x / W) * 9)][1] + 6 + r() * 6
      const pr = 3 + r() * 4
      bg.append(s('path', { class: 't6t-pb1', d: ell(x, y, pr, pr * 0.55) }), s('path', { class: 't6-sh', 'fill-opacity': 0.3, d: brush([[x - pr, y + 0.5], [x, y + pr * 0.55], [x + pr, y]], 1, { a: 0.2, b: 0.3 }).d }))
    }
    // flowing lines on the water
    flows = []
    for (let i = 0; i < (ctx.quality === 'low' ? 8 : 14); i++) {
      const y = top + 10 + r() * (bot - top - 20)
      const len = 24 + r() * 90
      const x = r() * W
      const el = s('path', { class: i % 3 ? 'k3' : 'p', 'fill-opacity': (i % 3 ? 0.16 + r() * 0.16 : 0.7).toFixed(2), d: brush([[0, y], [len * 0.5, y - 1.2], [len, y]], i % 3 ? 1.5 : 2.2, { a: 0.3, b: 0.5, min: 0.2 }).d })
      water.append(el)
      flows.push({ el, x, v: 9 + r() * 14, span: W + len })
      el.setAttribute('transform', `translate(${x.toFixed(1)} 0)`)
    }
    // stones: near → far, smaller with distance
    const pos = land ? [[0.22, 0.72], [0.5, 0.5], [0.78, 0.28]] : [[0.32, 0.72], [0.66, 0.47], [0.36, 0.2]]
    const depth = [1, 0.9, 0.8]
    geo = K.stones.map((st, i) => {
      let fs = clamp(Math.min(W, H * 1.6) * 0.022, 13.5, 19) * depth[i]
      const pad = 1.6
      const maxRx = land ? W * 0.15 : W * 0.3
      const tw0 = Math.max(measure(st.text, 1, 500), measure(K.fixed, 1, 500))
      fs = Math.min(fs, (maxRx * 2) / (tw0 + pad * 2))
      const rx = (tw0 * fs) / 2 + fs * pad
      const ry = rx * 0.34
      return { x: W * pos[i][0], y: top + (bot - top) * pos[i][1], rx, ry, fs }
    })
    stones.forEach((st, i) => {
      const g = geo[i]
      const bw = g.rx * 2.1
      const bh = Math.max(48, g.ry * 2.8)
      place(st.btn, g.x - bw / 2, g.y - bh / 2, bw, bh)
    })
    drawStones()
    built = true
  }

  /** (Re)draw every stone for its current state. */
  function drawStones() {
    stones.forEach((st, i) => {
      const g = geo[i]
      st.g = s('g')
      if (st.state === 'broken') {
        st.g.append(stoneArt(g, K.fixed, 30))
        st.g.append(check(g))
      } else {
        st.g.append(stoneArt(g, K.stones[i].text, i * 7 + 3))
        if (st.state === 'ok') st.g.append(check(g))
      }
      st.wrap.replaceChildren(st.g)
      placeNote(i)
    })
  }

  function stoneArt(g: Geo, text: string, seed: number) {
    const el = s('g', null,
      s('path', { class: 'k', 'fill-opacity': 0.08, d: ell(g.x, g.y + g.ry * 1.25, g.rx * 1.05, g.ry * 0.55), filter: 'url(#ink-wash)' }),
      stone(g.x, g.y, g.rx, g.ry, ids.stone, seed, g.ry * 0.5),
      s('path', { class: 'p', 'fill-opacity': 0.75, d: brush([[g.x - g.rx * 1.02, g.y + g.ry * 0.62], [g.x - g.rx * 0.4, g.y + g.ry * 1.16], [g.x + g.rx * 0.5, g.y + g.ry * 1.12], [g.x + g.rx * 1.04, g.y + g.ry * 0.5]], Math.max(1.4, g.ry * 0.09), { a: 0.2, b: 0.3, min: 0.2 }).d }))
    el.append(s('text', { class: 'k t6h-word', x: g.x, y: g.y + g.fs * 0.34, 'font-size': g.fs.toFixed(1), 'text-anchor': 'middle' }, text))
    return el
  }
  function check(g: Geo) {
    const x = g.x + g.rx * 0.78, y = g.y - g.ry * 0.9
    return s('path', { class: 'm t6h-check', d: brush([[x - 7, y + 1], [x - 2, y + 6], [x + 9, y - 8]], 3, { a: 0.1, b: 0.5 }).d, filter: 'url(#ink-rough)' })
  }
  /** Notes go below their stone, else above, else beside — wherever they stay inside the art and clear of the other stones and notes. */
  type Box = [number, number, number, number]
  const noteBox: (Box | null)[] = [null, null, null]
  const hit = (a: Box, b: Box) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]
  function placeNote(i: number) {
    const g = geo[i]
    const el = stones[i].state === 'broken' ? fixedNote : stones[i].note
    noteBox[i] = null
    if (!el.childElementCount) return
    const w = el.offsetWidth || 120
    const hh = el.offsetHeight || 24
    const qb = q.offsetTop + q.offsetHeight + 2
    const blocks: Box[] = geo.flatMap((o, k) => (k === i ? [] : [[o.x - o.rx - 4, o.y - o.ry - 4, o.x + o.rx + 4, o.y + o.ry * 1.6 + 4] as Box]))
    noteBox.forEach((b, k) => k !== i && b && blocks.push(b))
    const cands: Pt[] = [
      [g.x - w / 2, g.y + g.ry * 1.55 + 4],
      [g.x - w / 2, g.y - g.ry - hh - 8],
      [g.x < W / 2 ? g.x + g.rx + 8 : g.x - g.rx - 8 - w, g.y - hh / 2],
      [g.x < W / 2 ? g.x - g.rx - 8 - w : g.x + g.rx + 8, g.y - hh / 2],
    ]
    let best: Box | null = null
    for (const [x0, y0] of cands) {
      const x = clamp(x0, 2, W - w - 2)
      const b: Box = [x, y0, x + w, y0 + hh]
      if (y0 < qb || y0 + hh > H - 2 || x0 < -w * 0.25 || x0 + w > W + w * 0.25) continue
      best ??= b
      if (!blocks.some((o) => hit(o, b))) {
        best = b
        break
      }
    }
    best ??= [clamp(g.x - w / 2, 2, W - w - 2), clamp(g.y + g.ry * 1.55 + 4, qb, H - hh - 2), 0, 0]
    place(el, best[0], best[1])
    noteBox[i] = [best[0], best[1], best[0] + w, best[1] + hh]
    if (i === 1) {
      const gw = gapLab.offsetWidth || 120
      const gh = gapLab.offsetHeight || 24
      if (portrait) place(gapLab, clamp(g.x < W / 2 ? g.x + g.rx + 4 : g.x - g.rx - 4 - gw, 2, W - gw - 2), g.y - gh / 2)
      else place(gapLab, clamp(g.x - gw / 2, 2, W - gw - 2), g.y - g.ry - gh - 10)
    }
  }

  function ripple(g: Geo, big = false) {
    if (ctx.reduced) return
    for (let k = 0; k < (big ? 3 : 2); k++) {
      const e = s('ellipse', { class: 't6h-ring', cx: g.x, cy: g.y + g.ry * 0.7, rx: g.rx, ry: g.ry * 0.9 })
      fx.append(e)
      gsap.fromTo(e, { attr: { rx: g.rx * 0.95, ry: g.ry * 0.85 }, opacity: 0.7 }, {
        attr: { rx: g.rx * (big ? 2.1 : 1.6), ry: g.ry * (big ? 2.2 : 1.7) }, opacity: 0, duration: big ? 2.2 : 1.6, delay: k * 0.28, ease: 'power2.out', onComplete: () => e.remove(),
      })
    }
  }

  function tap(i: number) {
    const st = stones[i]
    const data = K.stones[i]
    if (st.state !== 'idle') return
    const g = geo[i]
    if (data.ok) {
      st.state = 'ok'
      ctx.chime('tap')
      if (data.note) st.note.replaceChildren(ctx.fact(data.note, 'p', 't6h-notep'))
      ctx.anim(() => {
        ripple(g)
        const c = check(g)
        st.g.append(c)
        placeNote(i)
        if (!ctx.reduced) {
          gsap.fromTo(c, { opacity: 0, scale: 0.6, transformOrigin: '50% 80%' }, { opacity: 1, scale: 1, duration: 0.6, ease: 'back.out(2)' })
          gsap.fromTo(st.note, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' })
          gsap.fromTo(st.g, { y: 2 }, { y: 0, duration: 0.5, ease: 'elastic.out(1, 0.4)' })
        }
      })
      return
    }
    // the fake: it cracks, splits and sinks; the true stone rises in its place
    st.state = 'broken'
    st.btn.setAttribute('aria-disabled', 'true')
    passFocus(st.btn, stones.find((o) => o.state === 'idle')?.btn)
    ctx.chime('low')
    const finish = () => {
      drawStones()
      fixedNote.replaceChildren(ctx.fact(K.fixedNote, 'p', 't6h-notep'))
      placeNote(i)
      const fn = K.fixedNote
      st.btn.setAttribute('aria-label', `${K.fixed}: ${typeof fn === 'string' ? fn : fn.text}`)
      ctx.insight(K.insight, K.detail)
      if (!ctx.reduced) ctx.anim(() => {
        ripple(geo[i])
        gsap.fromTo(st.wrap, { y: geo[i].ry * 2.4, opacity: 0 }, { y: 0, opacity: 1, duration: 1.3, ease: 'power3.out' })
        gsap.fromTo(fixedNote, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.9, delay: 0.6, ease: 'power3.out' })
        // the gap is filled with the real date now: the word for the gap leaves with the fake
        gsap.to(gapLab, { opacity: 0, y: -6, duration: 0.8, ease: 'power2.out' })
      })
    }
    if (ctx.reduced) {
      finish()
      return
    }
    ctx.anim(() => {
      const r = rng(5)
      // crack lines in vermilion, from a point on the top face
      const o: Pt = [g.x - g.rx * 0.12, g.y - g.ry * 0.25]
      const cracks: SVGPathElement[] = []
      const ends: Pt[] = [[g.x - g.rx * 0.95, g.y - g.ry * 0.1], [g.x + g.rx * 0.92, g.y - g.ry * 0.45], [g.x + g.rx * 0.1, g.y + g.ry * 1.3], [g.x - g.rx * 0.4, g.y - g.ry * 0.95]]
      for (const e of ends) {
        const pts: Pt[] = [o]
        for (let k = 1; k <= 4; k++) {
          const t = k / 4
          pts.push([o[0] + (e[0] - o[0]) * t + (r() - 0.5) * g.ry * 0.5, o[1] + (e[1] - o[1]) * t + (r() - 0.5) * g.ry * 0.4])
        }
        const b = brush(pts, Math.max(1.6, g.rx * 0.022), { a: 0.05, b: 0.6, min: 0.3 })
        const p = s('path', { class: 'v', d: b.d })
        cracks.push(p)
      }
      const id = nextId('t6hc')
      const crackG = s('g', { mask: `url(#${id})` }, ...cracks)
      const mask = s('mask', { id, maskUnits: 'userSpaceOnUse', x: g.x - g.rx * 2, y: g.y - g.ry * 4, width: g.rx * 4, height: g.ry * 8 },
        s('circle', { cx: o[0], cy: o[1], r: 0, fill: '#fff' }))
      svg.append(s('defs', null, mask))
      st.g.append(crackG)
      const ring = mask.firstChild as SVGCircleElement
      // two halves of the stone, split along the main crack
      const halves = [-1, 1].map((sd) => {
        const cid = nextId('t6hh')
        const cut = sd < 0
          ? `M${g.x - g.rx * 2} ${g.y - g.ry * 4}L${o[0] + 4} ${g.y - g.ry * 4}L${o[0]} ${o[1]}L${g.x + g.rx * 0.1} ${g.y + g.ry * 4}L${g.x - g.rx * 2} ${g.y + g.ry * 4}Z`
          : `M${g.x + g.rx * 2} ${g.y - g.ry * 4}L${o[0] + 4} ${g.y - g.ry * 4}L${o[0]} ${o[1]}L${g.x + g.rx * 0.1} ${g.y + g.ry * 4}L${g.x + g.rx * 2} ${g.y + g.ry * 4}Z`
        svg.append(s('defs', null, s('clipPath', { id: cid }, s('path', { d: cut }))))
        const half = s('g', { 'clip-path': `url(#${cid})` }, stoneArt(g, K.stones[i].text, i * 7 + 3), crackG.cloneNode(true) as SVGGElement)
        return half
      })
      const tl = gsap.timeline({ onComplete: () => void setTimeout(finish) })
      tl.to(st.g, { x: 2, duration: 0.05, repeat: 5, yoyo: true, ease: 'none' }, 0)
      tl.to(ring, { attr: { r: g.rx * 1.6 }, duration: 0.7, ease: 'power2.out' }, 0.1)
      tl.add(() => {
        st.g.replaceChildren(...halves)
        ripple(g, true)
      }, 0.95)
      tl.to(halves[0], { rotation: -14, svgOrigin: `${g.x} ${g.y + g.ry}`, x: -g.rx * 0.18, y: g.ry * 3, opacity: 0, duration: 1.5, ease: 'power2.in' }, 1)
      tl.to(halves[1], { rotation: 12, svgOrigin: `${g.x} ${g.y + g.ry}`, x: g.rx * 0.18, y: g.ry * 3.2, opacity: 0, duration: 1.6, ease: 'power2.in' }, 1.05)
      tl.fromTo(gapLab, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' }, 1.1)
      // the true stone rises (drawn by finish → drawStones); fade it up from the water
      tl.set({}, {}, 2.4)
    })
  }

  // creation: the AI lays its stones; at the gap it hesitates, then a stone appears anyway
  function intro() {
    if (ctx.reduced) return
    const tl = gsap.timeline({ delay: 0.5 })
    stones.forEach((st, i) => {
      const at = i * 0.9
      if (i === 1) {
        const g = geo[1]
        const ghost = s('ellipse', { class: 't6h-ghost', cx: g.x, cy: g.y, rx: g.rx, ry: g.ry })
        const qm = s('text', { class: 'k3', x: g.x, y: g.y + g.fs * 0.4, 'font-size': (g.fs * 1.4).toFixed(1), 'text-anchor': 'middle' }, '?')
        fx.append(ghost, qm)
        tl.fromTo([ghost, qm], { opacity: 0 }, { opacity: 1, duration: 0.4 }, at)
        tl.to([ghost, qm], { opacity: 0, duration: 0.4, onComplete: () => (ghost.remove(), qm.remove()) }, at + 1.2)
        tl.fromTo(st.wrap, { opacity: 0, scale: 0.92, svgOrigin: `${g.x} ${g.y}` }, { opacity: 1, scale: 1, duration: 0.7, ease: 'power2.out' }, at + 1.2)
        tl.call(() => ripple(g), [], at + 1.3)
      } else {
        const off = i === 2 ? 1.2 : 0
        tl.fromTo(st.wrap, { opacity: 0, y: -14 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.in' }, at + off)
        tl.call(() => ripple(geo[i]), [], at + off + 0.55)
      }
    })
    tl.from(q, { opacity: 0, y: 8, duration: 1, ease: 'power3.out' }, 0)
  }

  if (!ctx.reduced) {
    loop(ctx, (dt) => {
      for (const f of flows) {
        f.x += f.v * dt
        if (f.x > W) f.x -= f.span
        f.el.setAttribute('transform', `translate(${f.x.toFixed(1)} 0)`)
      }
    })
  }

  onSize(ctx, root, layout, stable.reset)
  layout()
  if (built) intro()
  ctx.prompt(K.prompt)
}

