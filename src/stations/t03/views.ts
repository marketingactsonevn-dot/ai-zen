import { h, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { brush, ell, pine, rng, type Pt } from './brush'
import { C } from './data'

const V = C.scenes.views
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
// stone silhouettes, base centre at 0,0: tall & reaching (lạc quan), broad & low (thận trọng), small & round (hoài nghi)
const SHAPES: Pt[][] = [
  [[-30, 0], [-35, -34], [-27, -82], [-12, -120], [3, -128], [16, -112], [27, -66], [34, -26], [31, 0]],
  [[-76, 0], [-72, -24], [-48, -48], [-10, -60], [32, -55], [62, -36], [76, -12], [75, 0]],
  [[-44, 0], [-48, -22], [-33, -48], [-6, -57], [24, -50], [43, -29], [46, 0]],
]
const MOSS: Pt[][] = [[[-8, -118], [2, -124], [10, -116], [-2, -112], [6, -109]], [[-18, -57], [-6, -59], [6, -58], [-12, -54], [0, -55]], []]
// an asymmetric garden triangle: [x, base y, scale] as fractions of the scene; the back stone is smaller
const WIDE: [number, number, number][] = [[0.2, 0.7, 0.95], [0.47, 0.8, 1], [0.79, 0.67, 0.9]]
const TALL: [number, number, number][] = [[0.27, 0.45, 0.8], [0.5, 0.73, 1], [0.76, 0.585, 0.88]]

/** Scene 3 — three stones on raked sand; lift one and its view of the future ripples out. */
export function viewsScene(ctx: SceneCtx) {
  const sand = s('svg', { class: 't3v-sand', 'aria-hidden': 'true' })
  const text = h('div', { class: 't3v-text', 'aria-live': 'polite' })
  const names = V.items.map((it) => h('span', { class: 't3v-name' }, it.name))
  const btns = V.items.map((_, i) => h('button', { class: 't3v-stone', type: 'button', 'aria-pressed': 'false', onClick: () => pick(i) }, names[i]))
  const group = h('div', { class: 't3v-stones', role: 'group', 'aria-label': V.group }, ...btns)
  const root = h('div', { class: 't3 t3v' }, sand, text, group)
  ctx.art.append(root)
  ctx.prompt(V.prompt)

  const heard = new Set<number>()
  let sel = -1
  let parts: { g: SVGGElement; shadow: SVGPathElement; rip: SVGGElement; glow: SVGPathElement; sc: number; r0: number }[] = []

  function layout() {
    const W = root.clientWidth
    const H = root.clientHeight
    if (!W || !H) return
    const wide = W / H > 1.15
    const top = H * (wide ? 0.36 : 0.27)
    const sc0 = wide ? clamp(Math.min(W / 980, H / 560) * 1.25, 0.42, 1.4) : clamp(Math.min(W / 560, H / 720), 0.42, 0.9)
    const P = (wide ? WIDE : TALL).map(([fx, fy, k]) => ({ x: fx * W, y: fy * H, sc: sc0 * k }))
    const tw = Math.min(560, W - 24)
    Object.assign(text.style, { left: `${(W - tw) / 2}px`, width: `${tw}px`, top: `${H * 0.03}px`, maxHeight: `${top}px` })

    sand.replaceChildren()
    sand.setAttribute('viewBox', `0 0 ${W} ${H}`)
    // ring sets: as many rings as fit before they would touch a neighbour's
    const gap = wide ? 9 + 6 * sc0 : 7
    const rings = P.map((q, i) => ({ x: q.x, y: q.y, r0: Math.max(...SHAPES[i].map((p) => Math.abs(p[0]))) * q.sc * 1.2 + 6, n: wide ? 5 : 3 }))
    const R = (r: (typeof rings)[number]) => r.r0 + r.n * gap
    for (let guard = 0; guard < 12; guard++) {
      let ok = true
      for (const [i, a] of rings.entries())
        for (const b of rings.slice(i + 1))
          if (Math.hypot(a.x - b.x, (a.y - b.y) / 0.34) < R(a) + R(b) + gap) {
            ok = false
            const big = a.n >= b.n ? a : b
            if (big.n > 1) big.n--
          }
      if (ok) break
    }
    // mask: sand fades in at the top and the straight rakes stop where the rings begin
    const mask = s('mask', { id: 't3v-mask', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H },
      s('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#t3v-fade)' }),
      ...rings.map((r) => s('path', { d: ell(r.x, r.y, R(r), R(r) * 0.34), fill: '#000' })))
    const fadeOnly = s('mask', { id: 't3v-fm', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, s('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#t3v-fade)' }))
    const midY = (Math.min(...P.map((q) => q.y)) + Math.max(...P.map((q) => q.y))) / 2
    sand.append(s('defs', null,
      s('linearGradient', { id: 't3v-fade', x1: 0, y1: 0, x2: 0, y2: 1 },
        s('stop', { offset: top / H, 'stop-color': '#fff', 'stop-opacity': 0 }),
        s('stop', { offset: Math.min(0.99, (top + H * 0.12) / H), 'stop-color': '#fff', 'stop-opacity': 1 })),
      s('linearGradient', { id: 't3v-stone', x1: 0, y1: 0, x2: 0.3, y2: 1 },
        s('stop', { offset: 0, class: 'gs0' }),
        s('stop', { offset: 1, class: 'gs1' })),
      // light pooled on the sand (dawn in the day, moonlight at night)
      s('radialGradient', { id: 't3v-pool', cx: W / 2, cy: midY, r: Math.max(W * 0.55, H * 0.5), gradientUnits: 'userSpaceOnUse', gradientTransform: `translate(0 ${midY}) scale(1 0.55) translate(0 ${-midY})` },
        s('stop', { offset: 0, class: 'pool0' }),
        s('stop', { offset: 1, class: 'pool1' })),
      s('radialGradient', { id: 't3v-glow' },
        s('stop', { offset: 0, style: 'stop-color:var(--t3glow)' }),
        s('stop', { offset: 1, style: 'stop-color:var(--t3glow);stop-opacity:0' })),
      mask, fadeOnly))
    sand.append(s('rect', { x: 0, y: top, width: W, height: H - top, fill: 'url(#t3v-pool)', mask: 'url(#t3v-fm)' }))
    if (wide) {
      // a low earthen wall closes the garden; a pine reaches over it from the corner, clear of the words
      const wy = top + H * 0.035
      const wh = H * 0.075
      const wr = rng(17)
      const wall = s('g', { class: 'k t3v-wall' })
      wall.append(
        s('defs', null,
          s('linearGradient', { id: 't3v-wall', x1: 0, y1: 0, x2: 0, y2: 1 },
            s('stop', { offset: 0, style: 'stop-color:var(--ink);stop-opacity:.07' }),
            s('stop', { offset: 1, style: 'stop-color:var(--ink);stop-opacity:.015' })),
          // dry brush along a horizontal stroke: the streaks run with it
          s('filter', { id: 't3v-dryh', x: '-2%', y: '-80%', width: '104%', height: '260%' },
            s('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.01 0.6', numOctaves: '2', seed: '8', result: 'n' }),
            s('feColorMatrix', { in: 'n', type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.7', result: 'm' }),
            s('feComposite', { in: 'SourceGraphic', in2: 'm', operator: 'in' }))),
        s('path', { d: `M-20 ${wy - wh}H${W + 20}V${wy}H-20Z`, fill: 'url(#t3v-wall)', filter: 'url(#ink-wash)' }),
        s('path', { d: brush([[-20, wy - wh], [W * 0.5, wy - wh - 1.5], [W + 20, wy - wh]], 4.5 * sc0 + 2, { a: 0.02, b: 0.05, min: 0.4, wob: 0.06 }).d, 'fill-opacity': 0.42, filter: 'url(#t3v-dryh)' }),
        s('path', { d: brush([[-20, wy - wh + 5 * sc0 + 2], [W + 20, wy - wh + 4 * sc0 + 2]], 1.2, { a: 0.02, b: 0.05, min: 0.4, wob: 0 }).d, 'fill-opacity': 0.18 }),
        s('path', { d: brush([[-20, wy], [W * 0.4, wy + 1], [W + 20, wy]], 1.2, { a: 0.02, b: 0.05, min: 0.3, wob: 0 }).d, 'fill-opacity': 0.2 }))
      const u = 100 * sc0
      const pn = pine(wr, [[W + 24, top - H * 0.3], [W - 0.7 * u, top - H * 0.24], [W - 1.4 * u, top - H * 0.27], [W - 2 * u, top - H * 0.17], [W - 2.5 * u, top - H * 0.19]], 7 * sc0, 4)
      sand.append(wall,
        s('g', { class: 'k2', filter: 'url(#ink-wash)' }, ...pn.pads.map((d) => s('path', { d, 'fill-opacity': 0.1 }))),
        s('g', { class: 'k2', filter: 'url(#ink-rough)' }, s('path', { d: pn.bough, 'fill-opacity': 0.85 }), ...pn.twigs.map((d) => s('path', { d, 'fill-opacity': 0.75 })), ...pn.needles.map((d) => s('path', { d, 'fill-opacity': 0.6 }))))
    }
    // straight rakes, wider apart as they come closer
    const rk = s('g', { mask: 'url(#t3v-mask)' })
    for (let y = top, k = 0; y < H + 10; k++) {
      const pts: string[] = []
      for (let x = -10; x <= W + 24; x += 24) pts.push(`${x} ${(y + 1.1 * Math.sin(x / 41 + k * 0.7)).toFixed(1)}`)
      const d = `M${pts.join('L')}`
      rk.append(s('path', { d, class: 'rk' }), s('path', { d, class: 'rk-hi', transform: 'translate(0 1.6)' }))
      y += 6 + 11 * ((y - top) / (H - top))
    }
    sand.append(rk)
    for (const r of rings) {
      for (let j = 0; j <= r.n; j++) {
        const rx = r.r0 + j * gap
        const d = ell(r.x, r.y, rx, rx * 0.34)
        sand.append(s('path', { d, class: 'rk', fill: 'none' }), s('path', { d, class: 'rk-hi', fill: 'none', transform: 'translate(0 1.6)' }))
      }
    }
    // moss gathering at the foot of each stone
    const mr = rng(9)
    const moss = s('g', { class: 'm', filter: 'url(#ink-rough)' })
    for (const [i, q] of P.entries()) {
      const hw = Math.max(...SHAPES[i].map((v) => Math.abs(v[0]))) * q.sc
      for (let k = 0; k < 9; k++) {
        const a = Math.PI * (0.55 + mr() * 0.75)
        moss.append(s('path', { d: ell(q.x + Math.cos(a) * hw * (0.9 + mr() * 0.35), q.y + 3 + Math.abs(Math.sin(a)) * hw * 0.12 + mr() * 3, (1.2 + mr() * 2.2) * q.sc + 0.6, (0.9 + mr() * 1.4) * q.sc + 0.5), 'fill-opacity': (0.45 + mr() * 0.4).toFixed(2) }))
      }
    }
    const built = P.map((q, i) => {
      const { x, y: baseY, sc } = q
      const r = rings[i]
      const pts = SHAPES[i].map(([px, py]) => [x + px * sc, baseY + py * sc] as Pt)
      const glow = s('path', { d: ell(x, baseY, r.r0 * 1.5, r.r0 * 0.5), fill: 'url(#t3v-glow)', opacity: i === sel ? 1 : 0 })
      const shadow = s('path', { class: 'sh', 'fill-opacity': 0.22, d: ell(x + 6 * sc, baseY + 2, r.r0 * 0.86, r.r0 * 0.2), filter: 'url(#ink-wash)' })
      const rip = s('g', { class: 't3v-rip' })
      const g = s('g', { class: 't3v-body' })
      const body = brush(pts, 0.01, { straight: false }).c + 'Z'
      const mid = Math.ceil(pts.length / 2)
      g.append(
        s('path', { d: body, fill: 'url(#t3v-stone)', filter: 'url(#ink-rough)' }),
        s('path', { d: `${brush(pts.slice(mid - 1), 0.01).c}L${x} ${baseY}Z`, class: 'sh', 'fill-opacity': 0.16, filter: 'url(#ink-wash)' }),
        s('path', { d: brush(pts.slice(mid - 1), 5.5 * sc + 1.2, { a: 0.08, b: 0.25 }).d, class: 'sh', filter: 'url(#ink-rough)' }),
        s('path', { d: brush(pts.slice(0, mid), 2 * sc + 0.8, { a: 0.3, b: 0.2 }).d, class: 'edge', 'fill-opacity': 0.75, filter: 'url(#ink-rough)' }),
        s('path', { d: brush(pts.slice(1, mid - 1).map(([a, b]) => [a + 3.5 * sc, b + 2.5 * sc] as Pt), 2.2 * sc + 0.6, { a: 0.3, b: 0.4 }).d, class: 'rim' }),
        s('path', { d: brush([pts[0], pts[pts.length - 1]], 2.4 * sc + 1, { a: 0.1, b: 0.1 }).d, class: 'sh', 'fill-opacity': 0.5 }),
        s('g', { filter: 'url(#ink-dry)', class: 'sh', 'fill-opacity': 0.4 },
          ...[0.3, 0.55, 0.75].map((f, k) => {
            const p = pts[Math.floor(f * (pts.length - 1))]
            return s('path', { d: brush([[p[0] * 0.75 + x * 0.25, p[1] * 0.7 + baseY * 0.3], [p[0] * 0.6 + x * 0.4 + 6 * sc, p[1] * 0.45 + baseY * 0.55 + 4 * sc]], (3 + k) * sc, { a: 0.2, b: 0.5 }).d })
          })),
        s('g', { class: 'm', filter: 'url(#ink-rough)' }, ...MOSS[i].map(([mx, my], k) => s('path', { d: ell(x + mx * sc, baseY + my * sc, (2.6 - k * 0.2) * sc + 0.6) }))))
      const hgt = -Math.min(...SHAPES[i].map((p) => p[1])) * sc
      const bw = Math.max(60, r.r0 * 1.7)
      const bh = hgt + 12 + r.r0 * 0.34 + 36
      Object.assign(btns[i].style, { left: `${x - bw / 2}px`, top: `${baseY - hgt - 12}px`, width: `${bw}px`, height: `${bh}px` })
      if (i === sel) gsap.set(g, { y: -14 * sc })
      return { layers: [glow, shadow, rip, g], part: { g, shadow, rip, glow, sc, r0: r.r0 } }
    })
    // far stones first, so the near ones overlap them
    P.map((q, i) => [q.y, i]).sort((a, b) => a[0] - b[0]).forEach(([, i], k) => {
      sand.append(...built[i].layers)
      if (k === 0) sand.append(moss)
    })
    parts = built.map((b) => b.part)
  }

  function pick(i: number) {
    if (i === sel) return
    const prev = sel
    sel = i
    ctx.anim(() => {
      btns.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)))
      const p = parts[i]
      if (prev >= 0) {
        const q = parts[prev]
        if (ctx.reduced) gsap.set([q.g, q.shadow, q.glow], { y: 0, opacity: (k: number) => [1, 1, 0][k] })
        else {
          gsap.to(q.g, { y: 0, duration: 0.7, ease: 'power2.in' })
          gsap.to(q.shadow, { opacity: 1, duration: 0.7 })
          gsap.to(q.glow, { opacity: 0, duration: 0.9 })
        }
      }
      if (ctx.reduced) gsap.set([p.g, p.shadow, p.glow], { y: (k: number) => (k ? 0 : -14 * p.sc), opacity: (k: number) => [1, 0.55, 1][k] })
      else {
        gsap.to(p.g, { y: -14 * p.sc, duration: 0.9, ease: 'power3.out' })
        gsap.to(p.shadow, { opacity: 0.55, duration: 0.9 })
        gsap.to(p.glow, { opacity: 1, duration: 1.4, ease: 'power2.out' })
        // ripples spread from the stone
        const bb = p.shadow.getBBox()
        const cx = bb.x + bb.width / 2
        const cy = bb.y + bb.height / 2 - 2
        p.rip.replaceChildren()
        const rs = [0, 1, 2].map(() => s('ellipse', { cx, cy, rx: p.r0, ry: p.r0 * 0.34 }))
        p.rip.append(...rs)
        gsap.fromTo(rs, { attr: { rx: p.r0, ry: p.r0 * 0.34 }, opacity: 0.7 }, { attr: { rx: p.r0 * 2.6, ry: p.r0 * 0.34 * 2.6 }, opacity: 0, duration: 2.4, ease: 'power2.out', stagger: 0.38 })
      }
      if (!heard.has(i)) {
        heard.add(i)
        btns[i].classList.add('heard')
      }
      const it = V.items[i]
      // the stone's own name stays under it; up here, only what that side believes
      text.replaceChildren(ctx.fact(it.view, 'p', 't3v-view'))
      if (!ctx.reduced) gsap.fromTo(text.children, { opacity: 0, y: 10, filter: 'blur(5px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.1, stagger: 0.15, ease: 'power3.out' })
      ctx.chime('soft')
      if (heard.size === V.items.length) ctx.insight(V.insight)
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
  }
}
