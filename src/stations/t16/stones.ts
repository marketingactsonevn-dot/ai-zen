import { h, nextId, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import type { TL } from '../t03/brush'
import { arc, boulder, brush, ell, f1, fitRings, litDefs, placed, sand, S, type Pt, type Ring } from './art'
import { C } from './data'
import { VIGS } from './vignettes'

const T = C.scenes.stones
// a garden group: the big main stone (Plugins), a tall one behind (Hooks), a low slab in front (Skills),
// and a pair talking to each other (A2A). [x, y, size] inside the garden's box.
// A scalene grouping: the upright (Hooks) is the apex, the big round one (Plugins) the body, the slab (Skills) low in front.
const WIDE: [number, number, number][] = [[0.12, 0.82, 0.94], [0.4, 0.52, 1.16], [0.86, 0.78, 0.64], [0.66, 0.24, 0.9]]
const TALL: [number, number, number][] = [[0.14, 0.72, 0.9], [0.4, 0.42, 1.04], [0.66, 0.76, 0.62], [0.86, 0.34, 0.84]]
// stone proportions [sx, sy]: slab, round, (pair), upright
const SHAPE: [number, number][] = [[1.55, 0.44], [1.15, 0.86], [1.05, 0.8], [0.6, 1.5]]

/** Scene 3 — four stones in the garden; touch one and its picture is brushed into the round window. */
export function stonesScene(ctx: SceneCtx) {
  const sandSvg = s('svg', { class: 't16-svg t16-sandsvg', 'aria-hidden': 'true' })
  const svg = s('svg', { class: 't16-svg', 'aria-hidden': 'true' })
  const pic = s('svg', { class: 't16s-pic', viewBox: '0 0 300 300', 'aria-hidden': 'true' })
  const frame = s('svg', { class: 't16s-frame', viewBox: '0 0 200 200', 'aria-hidden': 'true' },
    s('path', { class: 'k', 'fill-opacity': 0.34, filter: 'url(#ink-rough)', d: brush(arc(100, 100, 97, 97, -78, 268, 96), 2.6, { a: 0.06, b: 0.5, min: 0.15, wob: 0.18 }).d }))
  const win = h('div', { class: 't16s-win', 'aria-hidden': 'true' }, frame, pic)
  const text = h('div', { class: 't16s-text', 'aria-live': 'polite' })
  const names = T.items.map((it) => h('span', { class: 't16s-name', 'aria-hidden': 'true' }, it.name))
  const btns = T.items.map((it, i) =>
    h('button', { class: 't16s-stone', type: 'button', 'aria-pressed': 'false', 'aria-label': `${it.name} — ${it.sub}`, onClick: () => pick(i) }))
  const group = h('div', { class: 't16s-stones', role: 'group', 'aria-label': T.group }, ...btns)
  const root = h('div', { class: 't16 t16s' }, sandSvg, svg, win, text, ...names, group)
  ctx.art.append(root)
  ctx.prompt(T.prompt)

  const gid = nextId('t16s')
  const seen = new Set<number>()
  let told = false
  let sel = -1
  let shown: { root: SVGGElement; tl: TL; stop?: () => void } | null = null
  let bodies: SVGGElement[] = []
  let ring: SVGPathElement | null = null
  let geo: { x: number; y: number; r: number; w: number; h: number }[] = []

  function layout() {
    const W = root.clientWidth
    const H = root.clientHeight
    if (!W || !H) return
    const wide = W / H > 1.1
    const short = wide && H < 380
    root.classList.toggle('wide', wide)
    root.classList.toggle('short', short)

    // the round window and the words
    let P: number
    let pc: Pt
    let box: { x: number; y: number; w: number; h: number }
    if (short) {
      P = Math.min(H * 0.94, W * 0.26)
      pc = [W * 0.56, H / 2]
      box = { x: 0, y: H * 0.08, w: W * 0.42, h: H * 0.92 }
      const tl = pc[0] + P / 2 + 14
      Object.assign(text.style, { left: `${tl}px`, top: `${H / 2}px`, width: `${W - tl}px`, transform: 'translateY(-50%)' })
    } else if (wide) {
      P = Math.min(W * 0.34, H * 0.64)
      pc = [W * 0.73, H * 0.03 + P / 2]
      box = { x: W * 0.04, y: H * 0.1, w: W * 0.5, h: H * 0.86 }
      const tw = Math.min(460, W * 0.44)
      Object.assign(text.style, { left: `${pc[0] - tw / 2}px`, top: `${pc[1] + P / 2 + 10}px`, width: `${tw}px`, transform: '' })
    } else {
      P = Math.min(W * 0.86, H * 0.46)
      pc = [W / 2, P / 2]
      const tw = Math.min(W, 420)
      Object.assign(text.style, { left: `${(W - tw) / 2}px`, top: `${P + 2}px`, width: `${tw}px`, transform: '' })
      const gy = P + Math.min(92, H * 0.2)
      box = { x: 0, y: gy, w: W, h: H - gy }
    }
    Object.assign(win.style, { left: `${pc[0] - P / 2}px`, top: `${pc[1] - P / 2}px`, width: `${P}px`, height: `${P}px` })

    // the stones
    const r0 = wide ? Math.min(box.w * 0.115, box.h * 0.13) : Math.min(W * 0.1, box.h * 0.2)
    geo = (wide ? WIDE : TALL).map(([fx, fy, sz], i) => {
      const r = r0 * sz
      return { x: box.x + fx * box.w, y: box.y + fy * box.h, r, w: r * SHAPE[i][0] * (i === 2 ? 2.1 : 1), h: r * SHAPE[i][1] }
    })
    const rings: Ring[] = fitRings(geo.map((q) => ({ x: q.x, y: q.y + q.h * 0.42, r: q.w * 1.12, n: wide && !short ? 3 : 2 })), 7)
    sandSvg.setAttribute('viewBox', `0 0 ${W} ${H}`)
    sandSvg.replaceChildren(sand(`${gid}-s`, W, H, wide ? box.y : box.y - 10, rings, 7))
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
    svg.replaceChildren()
    svg.append(s('defs', null, litDefs()))
    ring = s('path', { class: 't16s-ring', d: '' })
    svg.append(ring)
    const fx = ctx.quality === 'low' ? 'root' : 'full'
    bodies = geo.map((q, i) => {
      const g = s('g', { class: 't16s-body' })
      const glyph = (p: ReturnType<typeof placed>, x: number, y: number, k: number, fn: (p: ReturnType<typeof placed>) => void) => {
        p.sub(`translate(${f1(x)} ${f1(y)}) scale(${k.toFixed(3)})`)
        fn(p)
        p.back()
      }
      if (i === 2) {
        // the pair: two small stones leaning toward each other, a thread of words between them
        for (const [dx, k, seed] of [[-0.62, 1, 3], [0.66, 0.82, 9]] as const) {
          const p = placed(q.x + dx * q.r, q.y + (k < 1 ? -q.r * 0.08 : 0), 1, fx)
          boulder(p, q.r * k, seed, SHAPE[2][0], SHAPE[2][1])
          // little waves leaving each stone toward the other: they are talking
          glyph(p, 0, -q.r * 0.14 * k, (q.r * k) / 34, (pp) => {
            const dir = dx < 0 ? 0 : 180
            for (const [j, rr] of [5, 9, 13].entries()) pp.line(arc(dx < 0 ? -6 : 6, 0, rr, rr * 1.1, dir - 40, dir + 40, 8), 1.7 - j * 0.3, { a: 0.2, b: 0.2, cls: 'k2' })
          })
          g.append(p.root)
        }
        const th = s('path', { class: 'k3', d: brush([[q.x - q.r * 0.5, q.y - q.r * 0.9], [q.x, q.y - q.r * 1.25], [q.x + q.r * 0.56, q.y - q.r * 0.82]], 1.6, { a: 0.3, b: 0.3 }).d })
        g.append(th)
      } else {
        const p = placed(q.x, q.y, 1, fx)
        boulder(p, q.r, 11 + i * 17, SHAPE[i][0], SHAPE[i][1])
        const k = (Math.min(q.r * SHAPE[i][0], q.r * SHAPE[i][1] * 1.6) / 34) * (i === 1 ? 0.62 : 0.8)
        glyph(p, 0, -q.h * 0.12, k, (pp) => {
          if (i === 0) {
            // an open book
            pp.line([[-14, -5], [-6, -8], [0, -5], [6, -8], [14, -5], [14, 7], [6, 4], [0, 8], [-6, 4], [-14, 7], [-14, -5]], 2.2, { ...S, a: 0.05, b: 0.05 })
            pp.line([[0, -5], [0, 8]], 1.6, { ...S })
          } else if (i === 1) {
            // a wrapped bundle with its knot
            pp.line([[-13, 10], [-15, 0], [-8, -8], [0, -9], [8, -8], [15, 0], [13, 10], [-13, 10]], 2, { a: 0.05, b: 0.05, cls: 'k2' })
            pp.line([[-1, -9], [-7, -16], [-11, -14], [-6, -9]], 1.8, { a: 0.1, b: 0.1, cls: 'k2' })
            pp.line([[1, -9], [7, -16], [11, -14], [6, -9]], 1.8, { a: 0.1, b: 0.1, cls: 'k2' })
          } else {
            // a gate: two posts and a lintel
            pp.line([[-16, -12], [16, -13]], 3, { ...S, a: 0.05, b: 0.1 })
            pp.line([[-10, -12], [-10, 14]], 2.4, { ...S, a: 0.05, b: 0.1 })
            pp.line([[10, -12], [10, 14]], 2.4, { ...S, a: 0.05, b: 0.1 })
            pp.line([[-12, -5], [12, -5]], 1.6, { ...S, cls: 'k2' })
          }
        })
        g.append(p.root)
      }
      return g
    })
    // far stones first
    geo.map((q, i) => [q.y, i]).sort((a, b) => a[0] - b[0]).forEach(([, i]) => svg.append(bodies[i]))
    bodies.forEach((b, i) => {
      b.classList.toggle('seen', seen.has(i))
      if (i === sel) gsap.set(b, { y: -6 })
    })
    if (sel >= 0) placeRing(sel, false)

    geo.forEach((q, i) => {
      const bw = Math.max(52, q.w * 2.3)
      const bh = Math.max(52, q.h * 1.9 + 10)
      Object.assign(btns[i].style, { left: `${q.x - bw / 2}px`, top: `${q.y - q.h * 1.15}px`, width: `${bw}px`, height: `${bh}px` })
      Object.assign(names[i].style, { left: `${q.x}px`, top: `${q.y + q.r * 0.42 * (SHAPE[i][1] / 0.8) + 10}px` })
    })
  }

  /** The chosen stone gets two freshly raked rings in moss, as if the gardener had just tended it. */
  function placeRing(i: number, anim = true) {
    const q = geo[i]
    if (!ring || !q) return
    gsap.killTweensOf(ring)
    const cy = q.y + q.h * 0.42
    const rx = q.w * 1.32
    ring.setAttribute('d', ell(q.x, cy, rx, rx * 0.32) + ell(q.x, cy, rx + 8, (rx + 8) * 0.32))
    if (anim && !ctx.reduced) gsap.fromTo(ring, { opacity: 0, scale: 0.9, svgOrigin: `${f1(q.x)} ${f1(cy)}` }, { opacity: 1, scale: 1, duration: 1.2, ease: 'power3.out' })
    else gsap.set(ring, { opacity: 1, scale: 1 })
  }

  function pick(i: number) {
    if (i === sel) return
    const prev = sel
    sel = i
    seen.add(i)
    ctx.anim(() => {
      btns.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)))
      names.forEach((n, j) => n.classList.toggle('on', j === i))
      bodies[i]?.classList.add('seen')
      if (ctx.reduced) {
        if (prev >= 0) gsap.set(bodies[prev], { y: 0 })
        gsap.set(bodies[i], { y: -6 })
      } else {
        if (prev >= 0) gsap.to(bodies[prev], { y: 0, duration: 0.6, ease: 'power2.in' })
        gsap.to(bodies[i], { y: -6, duration: 0.8, ease: 'power3.out' })
      }
      placeRing(i)
      // the window: the old picture fades, the new one is brushed in
      if (shown) {
        const old = shown
        old.tl.kill()
        old.stop?.()
        if (ctx.reduced) old.root.remove()
        else gsap.to(old.root, { opacity: 0, duration: 0.45, onComplete: () => old.root.remove() })
      }
      win.classList.add('open')
      const it = T.items[i]
      const v = VIGS[i](it.words)
      pic.append(v.root)
      // centre each picture in the window and let it fill it
      const bb = v.root.getBBox()
      if (bb.width && bb.height) {
        const k = Math.min(272 / bb.width, 262 / bb.height, 1.45)
        v.root.setAttribute('transform', `translate(${f1(150 - (bb.x + bb.width / 2) * k)} ${f1(156 - (bb.y + bb.height / 2) * k)}) scale(${k.toFixed(3)})`)
      }
      const tl = gsap.timeline()
      v.play(tl, ctx.reduced ? 0 : 0.3)
      const cur = { root: v.root, tl, stop: undefined as (() => void) | undefined }
      shown = cur
      if (ctx.reduced) tl.progress(1)
      else tl.call(() => void (cur.stop = v.loop?.()))
      text.replaceChildren(
        h('p', { class: 't16s-title' }, h('span', { class: 't16s-tname' }, it.name), h('span', { class: 't16s-tsub' }, it.sub)),
        ctx.fact(it.caption, 'p', 't16s-cap'))
      if (!ctx.reduced) gsap.fromTo(text.children, { opacity: 0, y: 8, filter: 'blur(4px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1, stagger: 0.14, delay: 0.3, ease: 'power3.out' })
      ctx.chime('soft')
      if (seen.size === T.items.length && !told) {
        told = true
        ctx.insight(T.insight)
      }
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

