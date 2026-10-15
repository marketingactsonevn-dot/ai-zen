import { fill, h, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import { icon } from '../../ui/icons'
import type { SceneCtx } from '../types'
import { brush, drawIn, ell, Pen, peaks, rng, type Extra, type Pt, type TL } from './brush'
import { VIGNETTES } from './vignettes'
import { C } from './data'
import { octaves } from '../../ui/ink'
import { createLoop } from '../../core/loop'

const T = C.scenes.scroll
const N = T.events.length
const GHOST = 0.3
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

interface Item {
  x: number
  /** the picture's own small SVG (so drawing one picture never repaints the whole scroll): the ghost and, in focus, the live pen */
  hold: SVGSVGElement
  /** the quiet line art, built only when the scroll comes near (see ghosts()) */
  ghost?: SVGGElement
  live?: SVGGElement
  lab: HTMLElement
  tl?: TL
  stop?: () => void
}

/** The big faint year: the "·" between two years is set quiet. */
const yearNodes = (y: string) => y.split(/(·)/).filter(Boolean).map((p) => (p === '·' ? h('span', { class: 't3s-dot' }, p) : p))

/** Scene 1 — a horizontal ink handscroll: one landscape, eleven milestones; the one in the centre comes alive. */
export function scrollScene(ctx: SceneCtx) {
  const far = s('svg', { class: 't3s-layer', 'aria-hidden': 'true' })
  const mid = s('svg', { class: 't3s-layer', 'aria-hidden': 'true' })
  const near = s('svg', { class: 't3s-near', 'aria-hidden': 'true' })
  const labs = h('div', { class: 't3s-labs' })
  const strip = h('div', { class: 't3s-strip' }, near, labs)
  const view = h('div', { class: 't3s-view', tabindex: '0', role: 'region', 'aria-label': T.region }, far, mid, strip)
  const prev = h('button', { class: 't3s-nav prev', type: 'button', 'aria-label': T.prev, onClick: () => goTo(ti - 1) }, icon('arrowL'))
  const next = h('button', { class: 't3s-nav next', type: 'button', 'aria-label': T.next, onClick: () => goTo(ti + 1) }, icon('arrowR'))
  const bead = h('span', { class: 't3s-bead' })
  const ticks = T.events.map((_, i) => h('i', { style: `left:${(i / (N - 1)) * 100}%` }))
  const prog = h('div', { class: 't3s-prog', 'aria-hidden': 'true' }, h('span', { class: 't3s-track' }), ...ticks, bead)
  const status = h('p', { class: 'visually-hidden', 'aria-live': 'polite' })
  const root = h('div', { class: 't3 t3s' }, view, prev, next, prog, status)
  ctx.art.append(root)
  ctx.prompt(T.prompt)
  const hidePrompt = () => ctx.el.querySelector('.scene-prompt:not(.out)')?.classList.add('out')

  let W = 0
  let H = 0
  let D = 1
  let need = 0
  let items: Item[] = []
  let x = 0
  let tx = 0
  let ti = 0
  let cur = -1
  let pending = -1
  let actT = 0
  let snapT = 0
  let ready = false
  let told = false
  let reach = 0
  let labH0 = 0
  let lowQ = false
  /** where the scroll walks into mist (scroll coordinates) and how long the fade is */
  let mist0 = 0
  let ramp = 1
  const end = () => (N - 1) * D

  // ───────── build (re-run when the size changes) ─────────
  function build(force = false) {
    const w = view.clientWidth
    const hh = view.clientHeight
    if (!w || !hh) return
    // a small height-only change (a phone's address bar) keeps the layout as long as everything still fits
    if (!force && Math.abs(w - W) < 2 && (Math.abs(hh - H) < 2 || (Math.abs(hh - H) < 80 && hh >= need))) return
    W = w
    H = hh
    const keep = Math.max(ti, 0)
    items.forEach((it) => (it.tl?.kill(), it.stop?.()))
    cur = -1
    pending = -1
    lowQ = ctx.quality === 'low'

    const side = H < 340 && W / H > 1.5
    root.classList.toggle('side', side)
    const labW = side ? Math.min(300, W * 0.4) : Math.min(W - 24, 420)

    // the words first: their real height decides how large the picture may be
    labs.replaceChildren()
    const labels = T.events.map((ev) => {
      const year = h('p', { class: 't3s-year' }, ...yearNodes(ev.year))
      const lab = h('div', { class: 't3s-lab', style: `width:${labW.toFixed(0)}px` }, year, h('p', { class: 't3s-title' }, ev.title), ctx.fact(ev.caption, 'p', 't3s-cap'))
      lab.inert = true
      lab.setAttribute('aria-hidden', 'true')
      labs.append(lab)
      return { lab, year }
    })
    const labH = side ? 0 : Math.max(...labels.map((l) => l.lab.offsetHeight))
    labH0 = labH

    let V: number, top: number, vigOff: number, labX: number, labY: number, yearSize: number, progY: number
    if (side) {
      const hs = H - 22
      V = clamp(hs * 1.08, 100, 300)
      const pair = V + 18 + labW
      D = pair + Math.max(60, W * 0.08)
      vigOff = -pair / 2 + V / 2
      labX = -pair / 2 + V + 18
      top = (hs - V) / 2 - V * 0.02
      labY = Math.max(0, top + V * 0.06)
      yearSize = clamp(H * 0.2, 28, 54)
      progY = H - 16
    } else {
      // picture + words + the progress line sit as one group, centred in the scene
      const avail = H - labH - 12 - 14 - 6
      V = clamp(Math.min(W * (W < 500 ? 1.05 : 0.8), avail / 1.02, 620), 110, 620)
      top = Math.max(2, (avail - V * 1.02) * 0.5)
      D = W < 640 ? Math.max(V, W * 0.8) : Math.max(V * 1.35, Math.min(W * 0.4, V * 1.8))
      vigOff = 0
      labX = -labW / 2
      labY = top + V * 1.02
      yearSize = clamp(V * 0.2, 40, 96)
      progY = labY + labH + 12
    }
    need = progY + 16
    Object.assign(prog.style, { top: `${progY.toFixed(0)}px` })
    for (const b of [prev, next]) b.style.top = side ? '' : `${(top + V * 0.47 - 22).toFixed(0)}px`

    const X = (i: number) => W / 2 + i * D
    labels.forEach(({ lab, year }, i) => {
      const ys = yearSize * Math.min(1, 6 / Math.max(4, T.events[i].year.replace(/ /g, '').length))
      year.style.fontSize = `${ys.toFixed(0)}px`
      if (!side) {
        const yl = Math.max(W * 0.08, W / 2 - V * 0.52) - (W / 2 - labW / 2)
        Object.assign(year.style, { left: `${yl.toFixed(0)}px`, top: `${(Math.max(4, top - ys * 0.3) - labY).toFixed(0)}px` })
      }
      Object.assign(lab.style, { left: `${(X(i) + labX).toFixed(0)}px`, top: `${labY.toFixed(0)}px` })
      if (side) lab.style.height = `${Math.min(H - labY - 20, V * 0.88).toFixed(0)}px`
      gsap.set(lab.children, { opacity: 0 })
    })

    const groundY = top + V * 0.9
    const nearW = W + end() + W * 0.7
    const span = end() + W * 0.35

    // far + mid mountains (parallax)
    const r = rng(11)
    const mountains = (svg: SVGSVGElement, width: number, base: number, hMin: number, hMax: number, op: number, ridges: boolean) => {
      svg.replaceChildren()
      svg.setAttribute('width', String(width))
      svg.setAttribute('height', String(H))
      svg.setAttribute('viewBox', `0 0 ${width} ${H}`)
      const gid = `t3g-${hMax}`.replace('.', '')
      svg.append(s('defs', null,
        s('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 },
          s('stop', { offset: 0, style: 'stop-color:var(--ink);stop-opacity:1' }),
          s('stop', { offset: 0.55, style: 'stop-color:var(--ink);stop-opacity:.45' }),
          s('stop', { offset: 1, style: 'stop-color:var(--ink);stop-opacity:0' }))))
      const g = s('g', lowQ ? null : { filter: 'url(#ink-wash)' })
      const rg = s('g', { class: 'k' })
      for (const { d, mx, hgt, hw } of peaks(r, -V * 0.3, width + V * 0.3, base, V * hMin, V * hMax, V * 0.75)) {
        g.append(s('path', { d, fill: `url(#${gid})`, 'fill-opacity': (op * (0.7 + r() * 0.6)).toFixed(3) }))
        if (ridges && !lowQ && r() > 0.35) {
          const sd = r() > 0.5 ? 1 : -1
          // a dry brush down the ridge: a few bristle marks of different length, not one solid line
          for (const [o, w, len, op] of [[0, 0.006, 0.55, 0.26], [0.012, 0.004, 0.4, 0.18], [-0.01, 0.003, 0.3, 0.14]]) {
            const rp: Pt[] = [0, 0.14, 0.3, len].map((t) => [mx + sd * t * hw * 0.9 + o * V, base - hgt * (1 - t) ** 1.35 + Math.abs(o) * V * 0.6])
            rg.append(s('path', { d: brush(rp, V * w, { a: 0.05, b: 0.75, min: 0.1 }).d, 'fill-opacity': op }))
          }
        }
      }
      svg.append(g, rg)
      // mist where the mountains meet the land
      const mg = `${gid}m`
      svg.append(s('defs', null, s('linearGradient', { id: mg, x1: 0, y1: 0, x2: 0, y2: 1 },
        s('stop', { offset: 0, style: 'stop-color:var(--paper);stop-opacity:0' }),
        s('stop', { offset: 1, style: 'stop-color:var(--paper);stop-opacity:.9' }))))
      svg.append(s('rect', { x: 0, y: base - V * 0.22, width, height: V * 0.24, fill: `url(#${mg})` }))
    }
    mountains(far, W + span * 0.35 + 40, groundY - V * 0.12, 0.3, 0.62, 0.075, false)
    mountains(mid, W + span * 0.62 + 40, groundY - V * 0.02, 0.14, 0.34, 0.13, true)
    // near: the river, its banks, the pictures
    near.replaceChildren()
    items.forEach((it) => it.hold.remove())
    near.setAttribute('width', String(nearW))
    near.setAttribute('height', String(H))
    near.setAttribute('viewBox', `0 0 ${nearW} ${H}`)
    strip.style.width = `${nearW}px`
    // dry brush along a horizontal stroke: streaks run with the stroke
    near.append(s('defs', null, s('filter', { id: 't3-dryh', x: '-2%', y: '-60%', width: '104%', height: '220%' },
      s('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.012 0.55', numOctaves: octaves(2), seed: '4', result: 'n' }),
      s('feColorMatrix', { in: 'n', type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 1.75', result: 'm' }),
      s('feComposite', { in: 'SourceGraphic', in2: 'm', operator: 'in' }))))
    const dryH = lowQ ? null : 'url(#t3-dryh)'
    const wint = X(2) + vigOff
    const riverPts: Pt[] = []
    const rx0 = W * 0.08
    const rx1 = X(N - 1) + vigOff + D * 0.75
    const wave = (px: number) => groundY + V * 0.04 + V * 0.012 * Math.sin(px / 170) + V * 0.008 * Math.sin(px / 61 + 1)
    for (let px = rx0; px <= rx1; px += 16) riverPts.push([px, wave(px)])
    // the winter stretch runs thin; between some pictures the brush lifts off the paper for a moment
    const winterF = (p: Pt) => 1 - 0.6 * Math.exp(-(((p[0] - wint) / (D * 0.32)) ** 2))
    const gaps = [0.42, 3.55, 5.4, 8.6].map((g) => X(0) + vigOff + g * D)
    const lift = (px: number) => gaps.reduce((m, g) => Math.min(m, Math.sqrt(clamp((Math.abs(px - g) - V * 0.018) / (V * 0.08), 0, 1))), 1)
    near.append(s('path', { class: 'river', filter: dryH, d: brush(riverPts, V * 0.014, { a: 0.012, b: 0.12, wob: 0, min: 0, wf: (t, p) => winterF(p) * lift(p[0]) * (0.8 + 0.2 * Math.sin(t * 40) + 0.1 * Math.sin(t * 137)) }).d }))
    // the far bank: one faint hairline, broken more often
    const farPts = riverPts.map(([a, b]) => [a, b - V * 0.032 + V * 0.004 * Math.sin(a / 97)] as Pt)
    near.append(s('path', { class: 'k3', 'fill-opacity': 0.55, filter: dryH, d: brush(farPts, V * 0.0055, { a: 0.02, b: 0.1, wob: 0, min: 0, wf: (_, p) => lift(p[0] + D * 0.5) * lift(p[0] - D * 0.21) * (0.6 + 0.4 * Math.sin(p[0] / 53)) }).d }))
    const bank = s('g', { class: 'k', 'fill-opacity': 0.32, filter: lowQ ? null : 'url(#ink-rough)' })
    const tr = rng(5)
    for (let i = 0; i < N - 1; i++) {
      const gx = X(i) + vigOff + D * 0.5
      const bp: Pt[] = [[gx - D * 0.22, groundY + V * 0.08], [gx, groundY + V * 0.088], [gx + D * 0.2, groundY + V * 0.076]]
      bank.append(s('path', { d: brush(bp, V * 0.007, { a: 0.3, b: 0.3 }).d }))
      // grass tufts and a pebble between pictures
      for (let k2 = 0; k2 < 2; k2++) {
        const tx0 = gx + (tr() - 0.5) * D * 0.3
        const ty = groundY + V * (0.035 + tr() * 0.02)
        for (const a of [-0.5, -0.15, 0.25]) bank.append(s('path', { d: brush([[tx0, ty], [tx0 + Math.sin(a) * V * 0.035, ty - V * (0.05 + tr() * 0.03)]], V * 0.007, { a: 0.05, b: 0.8 }).d }))
      }
      bank.append(s('path', { d: ell(gx + D * 0.12, groundY + V * 0.06, V * 0.018, V * 0.008) }))
    }
    near.append(bank)
    // three birds in the sky of the first picture, top right: never where a year or a picture sits
    for (const [bx, by, bs] of [[0.41, 0.03, 1], [0.5, 0.065, 0.75], [0.44, 0.1, 0.6]]) {
      const cx = X(0) + vigOff + V * bx
      const cy = top + V * by
      const q = V * 0.026 * bs
      near.append(s('path', { class: 'k', 'fill-opacity': 0.45, d: brush([[cx - q, cy - q * 0.4], [cx, cy + q * 0.15], [cx + q, cy - q * 0.5]], V * 0.0055, { a: 0.2, b: 0.3 }).d }))
    }

    // the quiet pictures (the live one is drawn only while it is in focus)
    items = labels.map(({ lab }, i) => {
      const hold = s('svg', { class: 't3s-pic', viewBox: '0 0 300 300', 'aria-hidden': 'true' })
      Object.assign(hold.style, { left: `${(X(i) + vigOff - V / 2).toFixed(1)}px`, top: `${top.toFixed(1)}px`, width: `${V.toFixed(1)}px`, height: `${V.toFixed(1)}px` })
      strip.insertBefore(hold, labs)
      return { x: X(i), hold, lab }
    })

    // the first stepping stones of "Phía trước", already disappearing into the mist
    const st = s('g', { filter: lowQ ? null : 'url(#ink-rough)' })
    for (let k2 = 0; k2 < 4; k2++) {
      const sx = X(N - 1) + vigOff + V * (0.62 + k2 * 0.3)
      const sy = groundY + V * (0.05 - k2 * 0.03)
      const srx = V * 0.065 * (1 - k2 * 0.17)
      st.append(s('path', { class: 'st', d: ell(sx, sy, srx, srx * 0.4) }), s('path', { class: 'sh', d: brush([[sx - srx, sy + srx * 0.05], [sx, sy + srx * 0.4], [sx + srx, sy]], V * 0.007, { a: 0.2, b: 0.3 }).d }))
    }
    near.append(st)
    // the end of the scroll walks into mist: the view's own mask fades everything out to the paper behind it
    mist0 = Math.max(X(N - 1) + vigOff + V * 0.55, side ? X(N - 1) + labX + labW + 12 : 0)
    ramp = V * 0.6

    ti = keep
    x = tx = ti * D
    render()
    if (ready) activate(ti, true)
  }

  // ───────── the quiet pictures: only those within three of the centre are in the DOM ─────────
  function ghost(i: number) {
    const it = items[i]
    if (!it.ghost) {
      const pen = new Pen(false, lowQ ? 'none' : 'root')
      VIGNETTES[i](pen, T.art)
      pen.root.setAttribute('opacity', String(GHOST))
      it.ghost = pen.root
    }
    return it.ghost
  }
  function ghosts(n: number) {
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      const near = Math.abs(i - n) <= 3
      if (near && !it.ghost?.isConnected) it.hold.prepend(ghost(i))
      else if (!near && it.ghost?.isConnected) it.ghost.remove()
    }
  }

  // ───────── motion ─────────
  function render() {
    strip.style.transform = `translate3d(${(-x).toFixed(1)}px,0,0)`
    view.style.setProperty('--mist', `${clamp(mist0 - x, -ramp, W + 1).toFixed(0)}px`)
    view.style.setProperty('--ramp', `${ramp.toFixed(0)}px`)
    mid.style.transform = `translate3d(${(-x * 0.62).toFixed(1)}px,0,0)`
    far.style.transform = `translate3d(${(-x * 0.35).toFixed(1)}px,0,0)`
    bead.style.left = `${(clamp(x / end(), 0, 1) * 100).toFixed(2)}%`
    prev.classList.toggle('off', ti <= 0)
    next.classList.toggle('off', ti >= N - 1)
    const n = clamp(Math.round(x / D), 0, N - 1)
    ghosts(n)
    // count how far the scroll has been unrolled, even in one fast fling
    if (n > reach) {
      reach = n
      for (let i = 1; i <= n; i++) ticks[i].classList.add('on')
      if (reach >= 3 && !told) {
        told = true
        ctx.insight(T.insight)
      }
    }
    if (n !== pending && ready) {
      pending = n
      clearTimeout(actT)
      actT = window.setTimeout(() => activate(n), drag ? 280 : 120)
    }
  }
  let lastT = 0
  // eases x → tx, then stops; essential: it is the scroll itself (under reduced motion it lands in one frame)
  const loop = createLoop(view, () => {
    const now = performance.now()
    const dt = lastT ? Math.min(1, (now - lastT) / 1000) : 1 / 60 // own clock: keeps the 1 s cap of the original easing
    lastT = now
    const kk = drag || ctx.reduced ? 1 : 1 - Math.exp(-dt / 0.19)
    x += (tx - x) * kk
    if (Math.abs(tx - x) < 0.4) x = tx
    render()
    if (x !== tx) return
    lastT = 0
    return false
  }, { essential: true })
  function setX(v: number) {
    tx = clamp(v, -W * 0.06, end() + W * 0.3)
    loop.start()
  }
  function goTo(i: number) {
    ti = clamp(i, 0, N - 1)
    hidePrompt()
    setX(ti * D)
  }

  function activate(i: number, instant = false) {
    if (i === cur) return
    const old = items[cur]
    cur = i
    const it = items[i]
    if (!it) return
    ctx.anim(() => {
      if (old) deactivate(old)
      ticks[i].classList.add('on')
      status.textContent = fill(T.status, { year: T.events[i].year, title: T.events[i].title })
      it.lab.inert = false
      it.lab.removeAttribute('aria-hidden')
      const gh = ghost(i)
      gsap.killTweensOf([gh, ...it.lab.children])
      it.live?.remove()
      const pen = new Pen(true)
      const extra: Extra | void = VIGNETTES[i](pen, T.art)
      const live = pen.root
      it.live = live
      it.hold.append(live)
      const tl = gsap.timeline()
      it.tl = tl
      if (instant || ctx.reduced) {
        const t0 = drawIn(pen, tl)
        extra?.play?.(tl, t0)
        tl.progress(1)
        gsap.set(gh, { opacity: 0 })
        gsap.set(it.lab.children, { opacity: 1, y: 0, filter: 'none' })
        if (!ctx.reduced) it.stop = extra?.loop?.()
      } else {
        gsap.set(live, { opacity: 0 })
        tl.to(live, { opacity: 1, duration: 0.25 }, 0)
        const t0 = drawIn(pen, tl, 1.7, 0.05)
        extra?.play?.(tl, t0)
        tl.to(gh, { opacity: 0, duration: 0.8 }, Math.min(t0, 1.5))
        tl.call(() => (it.stop = extra?.loop?.()))
        // the words belong to the same timeline, so leaving the picture early stops them too
        tl.fromTo(it.lab.children, { opacity: 0, y: 12, filter: 'blur(5px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.1, ease: 'power3.out', stagger: 0.16 }, 0.35)
      }
    })
  }
  function deactivate(it: Item) {
    it.tl?.kill()
    it.tl = undefined
    it.stop?.()
    it.stop = undefined
    it.lab.inert = true
    it.lab.setAttribute('aria-hidden', 'true')
    const live = it.live
    it.live = undefined
    const gh = it.ghost ? [it.ghost] : []
    gsap.killTweensOf([...gh, ...it.lab.children])
    if (ctx.reduced) {
      live?.remove()
      gsap.set(gh, { opacity: GHOST })
      gsap.set(it.lab.children, { opacity: 0 })
      return
    }
    if (live) gsap.to(live, { opacity: 0, duration: 0.6, onComplete: () => live.remove() })
    gsap.to(gh, { opacity: GHOST, duration: 0.9 })
    gsap.to(it.lab.children, { opacity: 0, duration: 0.35 })
  }

  // ───────── input: drag with inertia, wheel, keys ─────────
  let drag: { id: number; sx: number; stx: number; lx: number; lt: number; v: number; moved: boolean } | null = null
  view.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || (e.target as Element).closest('button, a, .src')) return
    drag = { id: e.pointerId, sx: e.clientX, stx: tx, lx: e.clientX, lt: e.timeStamp, v: 0, moved: false }
    view.setPointerCapture(e.pointerId)
  })
  view.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return
    const dx = e.clientX - drag.sx
    if (!drag.moved && Math.abs(dx) < 5) return
    drag.moved = true
    view.classList.add('dragging')
    const dt = e.timeStamp - drag.lt
    if (dt > 8) {
      drag.v = drag.v * 0.6 + clamp((e.clientX - drag.lx) / dt, -4, 4) * 0.4
      drag.lx = e.clientX
      drag.lt = e.timeStamp
    }
    setX(drag.stx - dx)
  })
  const release = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return
    const d = drag
    drag = null
    view.classList.remove('dragging')
    const v = e.timeStamp - d.lt > 90 ? 0 : d.v // held still before letting go → no fling
    if (d.moved) goTo(Math.round((tx + clamp(-v * 300, -D * 1.2, D * 1.2)) / D)) // a flick carries on, at most about one picture
    else goTo(Math.round((x + e.clientX - view.getBoundingClientRect().left - W / 2) / D))
  }
  view.addEventListener('pointerup', release)
  view.addEventListener('pointercancel', release)
  view.addEventListener('wheel', (e) => {
    e.preventDefault()
    hidePrompt()
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    setX(tx + d * (e.deltaMode === 1 ? 32 : 1))
    clearTimeout(snapT)
    snapT = window.setTimeout(() => goTo(Math.round(tx / D)), 180)
  }, { passive: false })
  view.addEventListener('keydown', (e) => {
    const to = ({ ArrowRight: ti + 1, ArrowLeft: ti - 1, Home: 0, End: N - 1 } as Record<string, number>)[e.key]
    if (to === undefined || to < 0 || to > N - 1) return // at either end, the arrows flip scenes
    e.preventDefault()
    goTo(to)
  })

  let rraf = 0
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(rraf)
    rraf = requestAnimationFrame(() => build())
  })
  ro.observe(view)
  build()
  // the serif may arrive after the first layout: if the words grew, lay out again
  let alive = true
  document.fonts?.ready.then(() => {
    if (alive && labH0 && Math.abs(Math.max(...items.map((it) => it.lab.offsetHeight)) - labH0) > 2) build(true)
  })

  // wait for the chapter card to dissolve, then bring the first picture to life
  let waited = 0
  const start = () => {
    if (!ctx.reduced && document.querySelector('.chapter') && waited++ < 20) return void (actT = window.setTimeout(start, 200))
    ready = true
    pending = ti
    activate(ti, ctx.reduced)
  }
  actT = window.setTimeout(start, ctx.reduced ? 0 : 450)

  return () => {
    alive = false
    ro.disconnect()
    loop.dispose()
    cancelAnimationFrame(rraf)
    clearTimeout(actT)
    clearTimeout(snapT)
    items.forEach((it) => (it.tl?.kill(), it.stop?.()))
  }
}
