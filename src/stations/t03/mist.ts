import { fill, h, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { arc, brush, drawIn, ell, Pen, peaks, pine, rng, type Extra, type Pt, type TL } from './brush'
import { CONCEPTS } from './concepts'
import { C } from './data'

const F = C.scenes.future
const A = C.scenes.scroll.art
// stepping stones as [x, y, size] fractions of the scene, near → far
const WIDE: [number, number, number][] = [[0.12, 0.84, 1], [0.25, 0.69, 0.76], [0.35, 0.57, 0.58], [0.42, 0.48, 0.45], [0.47, 0.41, 0.35]]
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const TALL: [number, number, number][] = [[0.24, 0.93, 1], [0.66, 0.855, 0.78], [0.34, 0.785, 0.6], [0.64, 0.725, 0.47], [0.45, 0.675, 0.37]]
// short landscape screens: the path stays left of the moon, each stone a full touch target apart
const SHORT: [number, number, number][] = [[0.08, 0.84, 1], [0.17, 0.7, 0.76], [0.25, 0.58, 0.58], [0.32, 0.49, 0.45], [0.39, 0.41, 0.35]]

/** Scene 2 — the path walks into layered mist; each stone, touched, clears a vision in the moon window. */
export function mistScene(ctx: SceneCtx) {
  const ridges = s('svg', { class: 't3f-bg t3f-ridges', 'aria-hidden': 'true' })
  const bg = s('svg', { class: 't3f-bg', 'aria-hidden': 'true' })
  const bands = [0, 1, 2].map((i) => h('div', { class: 't3f-band', style: `--i:${i}`, 'aria-hidden': 'true' }))
  const patches = F.steps.map((_, i) => h('div', { class: 't3f-patch', style: `--d:${i}`, 'aria-hidden': 'true' }))
  const pic = s('svg', { class: 't3f-pic', viewBox: '0 0 300 300', 'aria-hidden': 'true' })
  const veiled = s('svg', { viewBox: '0 0 300 300', preserveAspectRatio: 'xMidYMid slice' })
  const cover = h('div', { class: 't3f-cover', 'aria-hidden': 'true' }, veiled, h('i'), h('i'), h('i'))
  // behind the mist, before anything is touched: a far ridge and a pine bough reaching in from the rim
  {
    const r = rng(31)
    const g = s('g', { class: 'sh', filter: 'url(#ink-wash)' })
    // (their strength is set in CSS: pale by day, dark silhouettes against the moon at night)
    for (const [b, h0, h1, cls] of [[214, 26, 46, 'f1'], [246, 18, 34, 'f2']] as const) for (const { d } of peaks(r, -30, 330, b, h0, h1, 54)) g.append(s('path', { d, class: cls }))
    g.append(s('path', { d: 'M-10 240H310V310H-10Z', class: 'f2' }))
    const pn = pine(r, [[324, 66], [288, 84], [258, 80], [226, 100], [190, 96]], 10)
    const pads = s('g', { class: 'sh', filter: 'url(#ink-wash)' }, ...pn.pads.map((d) => s('path', { d, 'fill-opacity': 0.12 })))
    const ink = s('g', { class: 'sh', filter: 'url(#ink-rough)' }, s('path', { d: pn.bough, 'fill-opacity': 0.8 }), ...pn.twigs.map((d) => s('path', { d, 'fill-opacity': 0.7 })), ...pn.needles.map((d) => s('path', { d, 'fill-opacity': 0.55 })))
    veiled.append(g, pads, ink)
  }
  const moon = h('div', { class: 't3f-moon' }, pic, cover)
  const text = h('div', { class: 't3f-text', 'aria-live': 'polite' })
  const stones = F.steps.map((_, i) =>
    h('button', { class: 't3f-stone', type: 'button', 'aria-pressed': 'false', 'aria-label': fill(F.stone, { n: i + 1 }), onClick: () => select(i) }))
  const group = h('div', { class: 't3f-stones', role: 'group', 'aria-label': F.group }, ...stones)
  const root = h('div', { class: 't3 t3f' }, ridges, bg, moon, ...bands, ...patches, text, group)
  ctx.art.append(root)
  ctx.prompt(F.prompt)

  const cleared = new Set<number>()
  let sel = -1
  let shown: { root: SVGGElement; tl: TL; stop?: () => void } | null = null
  let stoneGs: SVGGElement[] = []
  let ring: SVGEllipseElement | null = null
  let frame: SVGPathElement | null = null
  let geo: { x: number; y: number; rx: number; ry: number }[] = []

  function layout() {
    const W = root.clientWidth
    const H = root.clientHeight
    if (!W || !H) return
    const wide = W / H > 1.15
    root.classList.toggle('wide', wide)
    // short landscape screens put the words beside the moon instead of under it
    const short = wide && H < 360
    root.classList.toggle('short', short)
    const base = wide ? Math.min(W * 0.065, H * 0.13, 84) : Math.min(W * 0.13, H * 0.085, 60)
    const mr = short ? H * 0.44 : wide ? Math.min(H * 0.33, W * 0.2) : H < 560 ? Math.min(W * 0.3, H * 0.15) : Math.min(W * 0.34, H * 0.18)
    const mc: Pt = short ? [W * 0.6, H * 0.48] : wide ? [W * 0.71, H * 0.4] : [W / 2, H * 0.05 + mr]
    Object.assign(moon.style, { left: `${mc[0] - mr}px`, top: `${mc[1] - mr}px`, width: `${mr * 2}px`, height: `${mr * 2}px` })
    if (short) {
      const tl = mc[0] + mr + 12
      Object.assign(text.style, { left: `${tl}px`, top: `${mc[1]}px`, width: `${W - tl}px` })
    } else {
      const tw = wide ? Math.min(440, W * 0.42) : Math.min(W - 16, 400)
      Object.assign(text.style, { left: `${mc[0] - tw / 2}px`, top: `${mc[1] + mr + (wide ? 14 : 6)}px`, width: `${tw}px` })
    }
    // portrait: the farthest stone must sit below the tallest caption, so measure every caption once
    let P = short ? SHORT : wide ? WIDE : TALL
    let below = 0 // portrait: where the tallest caption ends
    if (!wide) {
      const keep = [...text.childNodes]
      let tallest = 0
      for (const st of F.steps) {
        text.replaceChildren(h('p', { class: 't3f-name' }, st.title), ctx.fact(st.caption, 'p', 't3f-cap'))
        tallest = Math.max(tallest, text.offsetHeight)
      }
      text.replaceChildren(...keep)
      below = text.offsetTop + tallest
      // the farthest stone's 48px touch target starts below the words and their ⓘ
      const y0 = (text.offsetTop + tallest + 26) / H
      const [lo, hi] = [TALL[TALL.length - 1][1], TALL[0][1]]
      if (y0 > lo) P = TALL.map(([fx, fy, k]) => [fx, Math.min(hi, y0) + ((fy - lo) / (hi - lo)) * Math.max(0, hi - y0), k])
    }
    geo = P.map(([fx, fy, k]) => ({ x: fx * W, y: fy * H, rx: base * k, ry: base * k * 0.42 }))
    root.style.setProperty('--band', wide ? '46%' : '100%')

    bg.replaceChildren()
    bg.setAttribute('viewBox', `0 0 ${W} ${H}`)
    ridges.replaceChildren()
    ridges.setAttribute('viewBox', `0 0 ${W} ${H}`)
    // far ridges sinking into the fog
    const r = rng(23)
    // portrait: the ridges sink (and flatten) until their tallest peak clears the words
    const hor = wide ? H * 0.47 : Math.max(H * 0.72, below + H * 0.12 + 8)
    const hk = wide ? 1 : Math.max(0.3, Math.min(0.55, (hor - H * 0.07 - below - 8) / (H * 0.17)))
    const rg = s('g', ctx.quality === 'low' ? null : { filter: 'url(#ink-wash)' })
    for (const [b, h0, h1, op] of [[hor - H * 0.07, 0.08, 0.17, 0.07], [hor - H * 0.025, 0.05, 0.12, 0.1], [hor + H * 0.02, 0.03, 0.07, 0.13]]) {
      for (const { d } of peaks(r, -W * 0.05, W * 1.05, b, H * h0 * hk, H * h1 * hk, W * 0.11)) rg.append(s('path', { d, fill: 'url(#t3f-fade)', 'fill-opacity': op }))
    }
    ridges.append(s('defs', null, s('linearGradient', { id: 't3f-fade', x1: 0, y1: 0, x2: 0, y2: 1 },
      s('stop', { offset: 0, style: 'stop-color:var(--ink);stop-opacity:1' }),
      s('stop', { offset: 1, style: 'stop-color:var(--ink);stop-opacity:0' }))), rg)
    // by day the sky around the moon is washed darker so the bare paper reads as light; at night the same wash is its glow
    bg.append(s('defs', null,
      s('radialGradient', { id: 't3f-sky', cx: mc[0], cy: mc[1], r: mr * 1.34, gradientUnits: 'userSpaceOnUse' },
        s('stop', { offset: 0.66, class: 'sky1' }),
        s('stop', { offset: 1, class: 'sky0' })),
      s('linearGradient', { id: 't3f-stone', x1: 0, y1: 0, x2: 0.3, y2: 1 },
        s('stop', { offset: 0, class: 'gs0' }),
        s('stop', { offset: 1, class: 'gs1' }))))
    bg.append(s('circle', { cx: mc[0], cy: mc[1], r: mr * 1.34, fill: 'url(#t3f-sky)' }))
    // the moon window's frame: one brush ring, heavy at the start, lifting off before it closes.
    // At rest the moon is only a soft wash in the mist; the ring is brushed in when the first stone is touched.
    frame = s('path', { class: 'k', 'fill-opacity': 0.42, opacity: cleared.size ? 1 : 0, d: brush(arc(mc[0], mc[1], mr * 0.985, mr * 0.985, -84, 262, 96), mr * 0.03, { a: 0.06, b: 0.45, min: 0.2, wob: 0.14 }).d, filter: 'url(#ink-rough)' })
    bg.append(frame)
    // three pebbles lead in from the scroll, smallest first
    const g0 = geo[0]
    for (const [k, f] of [0.25, 0.5, 0.75].entries()) {
      const px = wide ? g0.x * f * 0.9 - g0.rx * 0.2 : g0.x - g0.rx * (2.2 - f * 1.4)
      const py = wide ? g0.y + g0.ry * (2.1 - f * 0.9) : g0.y + g0.ry * (2.6 - f * 1.2)
      const pr = base * (0.06 + k * 0.035)
      bg.append(
        s('path', { class: 'st', d: ell(px, py, pr * 1.3, pr * 0.6), filter: 'url(#ink-rough)' }),
        s('path', { class: 'sh', 'fill-opacity': 0.75, d: brush([[px - pr * 1.3, py], [px, py + pr * 0.62], [px + pr * 1.3, py - pr * 0.05]], Math.max(1, pr * 0.3), { a: 0.2, b: 0.3 }).d }))
    }
    // stepping stones, far first so the near ones overlap them: a flat top, a dark flank, a shadow on the ground
    stoneGs = geo.map(() => s('g'))
    for (let i = geo.length - 1; i >= 0; i--) {
      const { x, y, rx, ry } = geo[i]
      const g = stoneGs[i]
      const th = ry * 0.5
      const pts: Pt[] = []
      for (let a = 0; a <= 360; a += 15) {
        const t = (a * Math.PI) / 180
        const j = 1 + (r() - 0.5) * 0.1
        pts.push([x + rx * j * Math.cos(t), y + ry * j * Math.sin(t)])
      }
      pts[pts.length - 1] = pts[0]
      const lower = pts.slice(0, 13) // 0° → 180°: the near rim
      const top = `M${pts.map((p) => p.map((n) => n.toFixed(1)).join(' ')).join('L')}Z`
      const drop = (a: number) => th * (0.7 + 0.3 * Math.sin(Math.PI * clamp01((a - x + rx) / (2 * rx))))
      const under = lower.map(([a, b]) => [a, b + drop(a)] as Pt)
      const flank = `M${lower.map(([a, b]) => `${a.toFixed(1)} ${b.toFixed(1)}`).join('L')}L${under.slice().reverse().map(([a, b]) => `${a.toFixed(1)} ${b.toFixed(1)}`).join('L')}Z`
      g.append(
        s('path', { class: 'sh', 'fill-opacity': 0.16, d: ell(x + rx * 0.1, y + ry * 0.8, rx * 1.12, ry * 0.85), filter: 'url(#ink-wash)' }),
        s('path', { class: 'st-f', d: flank, filter: 'url(#ink-rough)' }),
        s('path', { d: top, fill: 'url(#t3f-stone)', filter: 'url(#ink-rough)' }),
        s('path', { class: 'sh', d: brush(under.slice(1), Math.max(1.8, rx * 0.075), { a: 0.12, b: 0.45 }).d, filter: 'url(#ink-rough)' }),
        s('path', { class: 'sh', 'fill-opacity': 0.55, d: brush(lower.slice(4, 13), Math.max(1, rx * 0.025), { a: 0.3, b: 0.3 }).d }),
        s('path', { class: 'rim', d: brush(pts.slice(14, 22), Math.max(1.2, rx * 0.05), { a: 0.25, b: 0.4 }).d }))
      if (i === 0) {
        const mg = s('g', { class: 'm', filter: 'url(#ink-rough)' })
        // moss creeping over the near-left edge: many small dabs, denser at the rim
        for (let k = 0; k < 14; k++) {
          const a = Math.PI * (0.62 + r() * 0.5)
          const f = 0.78 + r() * 0.24
          mg.append(s('path', { d: ell(x + rx * f * Math.cos(a), y + ry * f * Math.sin(a), rx * (0.018 + r() * 0.03) + 0.6, ry * (0.04 + r() * 0.05) + 0.5), 'fill-opacity': (0.5 + r() * 0.45).toFixed(2) }))
        }
        g.append(mg)
      }
      // water lines beside each stone
      for (const sd of [-1, 1]) {
        const wl: Pt[] = [[x + sd * rx * 1.08, y + ry * 0.95], [x + sd * rx * (1.5 + r() * 0.3), y + ry * 1.02]]
        g.append(s('path', { class: 'k3 wl', d: brush(wl, Math.max(1, rx * 0.03), { a: 0.3, b: 0.5 }).d }))
      }
      g.setAttribute('opacity', cleared.has(i) ? '1' : String(0.95 - i * 0.085))
      bg.append(g)
    }
    ring = s('ellipse', { class: 't3f-ring', rx: 0, ry: 0, cx: -99, cy: -99 })
    bg.append(ring)
    if (sel >= 0) placeRing(sel, false)
    markNext()

    geo.forEach(({ x, y, rx, ry }, i) => {
      const bw = Math.max(48, rx * 2.2)
      const bh = Math.max(48, ry * 2.6)
      Object.assign(stones[i].style, { left: `${x - bw / 2}px`, top: `${y - bh / 2}px`, width: `${bw}px`, height: `${bh}px` })
      Object.assign(patches[i].style, { left: `${x - rx * 1.9}px`, top: `${y - rx * 1.25}px`, width: `${rx * 3.8}px`, height: `${rx * 2.3}px` })
    })
  }

  function markNext() {
    const n = F.steps.findIndex((_, i) => !cleared.has(i))
    stones.forEach((b, i) => b.classList.toggle('next', i === n))
  }

  function placeRing(i: number, anim = true) {
    const { x, y, rx, ry } = geo[i]
    if (!ring) return
    gsap.killTweensOf(ring)
    gsap.set(ring, { attr: { cx: x, cy: y + ry * 0.1 } })
    if (anim && !ctx.reduced) gsap.fromTo(ring, { attr: { rx: rx * 0.9, ry: ry * 0.9 }, opacity: 0.9 }, { attr: { rx: rx * 1.35, ry: ry * 1.4 }, opacity: 0.55, duration: 1.4, ease: 'power3.out' })
    else gsap.set(ring, { attr: { rx: rx * 1.35, ry: ry * 1.4 }, opacity: 0.55 })
  }

  function select(i: number) {
    if (i === sel) return
    sel = i
    ctx.anim(() => {
      stones.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)))
      placeRing(i)
      if (!cleared.size && frame) {
        root.classList.add('open')
        if (ctx.reduced) gsap.set(frame, { opacity: 1 })
        else gsap.to(frame, { opacity: 1, duration: 1.6, ease: 'power2.out' })
      }
      if (!cleared.has(i)) {
        cleared.add(i)
        stones[i].classList.add('clear')
        markNext()
        if (ctx.reduced) {
          gsap.set(patches[i], { opacity: 0 })
          gsap.set(stoneGs[i], { opacity: 1 })
        } else {
          gsap.to(patches[i], { opacity: 0, scale: 1.6, duration: 1.6, ease: 'power2.out' })
          gsap.to(stoneGs[i], { opacity: 1, duration: 1.2, ease: 'power2.out' })
        }
      }
      // the moon: mist parts, the concept is brushed in
      if (shown) {
        const old = shown
        old.tl.kill()
        old.stop?.()
        if (ctx.reduced) old.root.remove()
        else gsap.to(old.root, { opacity: 0, duration: 0.5, onComplete: () => old.root.remove() })
      }
      if (ctx.reduced) gsap.set(cover, { opacity: 0 })
      else gsap.to(cover, { opacity: 0, duration: 1.4, ease: 'power2.out' })
      const pen = new Pen(true)
      const extra: Extra | void = CONCEPTS[i](pen, A)
      pic.append(pen.root)
      const tl = gsap.timeline()
      const t0 = drawIn(pen, tl, 1.6, ctx.reduced ? 0 : 0.35)
      extra?.play?.(tl, t0)
      const cur = { root: pen.root, tl, stop: undefined as (() => void) | undefined }
      shown = cur
      if (ctx.reduced) tl.progress(1)
      else tl.call(() => void (cur.stop = extra?.loop?.()))

      const st = F.steps[i]
      text.replaceChildren(h('p', { class: 't3f-name' }, st.title), ctx.fact(st.caption, 'p', 't3f-cap'))
      if (!ctx.reduced) gsap.fromTo(text.children, { opacity: 0, y: 10, filter: 'blur(5px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.1, stagger: 0.15, delay: 0.5, ease: 'power3.out' })
      ctx.chime('soft')
      if (cleared.size === F.steps.length) ctx.insight(F.insight)
    })
  }

  let rraf = 0
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(rraf)
    rraf = requestAnimationFrame(layout)
  })
  ro.observe(root)
  layout()

  return () => {
    ro.disconnect()
    cancelAnimationFrame(rraf)
    shown?.tl.kill()
    shown?.stop?.()
  }
}
