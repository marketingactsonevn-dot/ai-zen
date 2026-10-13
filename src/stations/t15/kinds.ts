import { h, nextId, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { arc, brush, drawIn, ell, rng, Pen, type Extra, type Pt, type TL } from './brush'
import { C, type Kind } from './data'
import { clamp, stableHeight, watchSize } from './garden'
import { PICTURES } from './vignettes'

const K = C.scenes.kinds
// stone silhouettes, base centre at 0,0, one per kind of agent (JSON order); each its own character
const SHAPES: Pt[][] = [
  // chat: a soft standing stone, leaning back a little
  [[-34, 0], [-38, -16], [-36, -36], [-25, -53], [-7, -62], [12, -60], [28, -48], [36, -28], [38, -10], [36, 0]],
  // workflow: low and wide, lying down (fuseishi)
  [[-58, 0], [-57, -9], [-47, -19], [-27, -24], [0, -26], [25, -26], [44, -21], [55, -12], [58, 0]],
  // coding: tall and upright (tateishi)
  [[-24, 0], [-28, -24], [-27, -52], [-19, -78], [-7, -94], [6, -96], [16, -84], [22, -60], [26, -30], [27, 0]],
  // computer use: leaning forward, its head over its foot
  [[-36, 0], [-39, -18], [-33, -36], [-16, -50], [8, -62], [26, -70], [35, -60], [35, -32], [37, 0]],
  // research: flat-topped, like a reading table (hiraishi)
  [[-40, 0], [-43, -18], [-39, -38], [-30, -47], [-8, -50], [18, -49], [33, -45], [40, -31], [42, 0]],
  // team: the big one, broad-shouldered, with a split down its face
  [[-56, 0], [-60, -24], [-51, -52], [-29, -72], [-4, -80], [21, -76], [42, -60], [56, -34], [58, 0]],
]
// where the carved sign sits: [x offset in stone units, height share from the base, size]
const GLYPH: [number, number, number][] = [[0, 0.5, 15], [2, 0.5, 11], [0, 0.66, 14], [-4, 0.48, 15], [0, 0.52, 15], [-14, 0.5, 18]]
const GLYPHS: Record<Kind['id'], string> = {
  chat: 'M-0.9 -0.5Q-0.9 -0.8 -0.6 -0.8H0.6Q0.9 -0.8 0.9 -0.5V0.2Q0.9 0.5 0.6 0.5H-0.15L-0.6 0.88L-0.48 0.5H-0.6Q-0.9 0.5 -0.9 0.2ZM-0.42 -0.15h0.01M0 -0.15h0.01M0.42 -0.15h0.01',
  flow: 'M-1 0.15Q-0.6 -0.45 -0.2 0.15T0.6 0.15M0.42 -0.08L0.62 0.15L0.38 0.32M-1.05 0.55H1.05',
  code: 'M-0.42 -0.55L-0.9 0L-0.42 0.55M0.42 -0.55L0.9 0L0.42 0.55M0.18 -0.72L-0.18 0.72',
  computer: 'M-0.45 -0.85L-0.45 0.55L-0.1 0.22L0.18 0.82L0.38 0.72L0.1 0.12L0.55 0.12Z',
  research: 'M0.35 -0.15a0.5 0.5 0 1 0 -1 0a0.5 0.5 0 1 0 1 0M0.2 0.22L0.75 0.8',
  team: 'M0.25 -0.55a0.25 0.25 0 1 0 -0.5 0a0.25 0.25 0 1 0 0.5 0M-0.53 0.6a0.17 0.17 0 1 0 -0.34 0a0.17 0.17 0 1 0 0.34 0M0.17 0.62a0.17 0.17 0 1 0 -0.34 0a0.17 0.17 0 1 0 0.34 0M0.87 0.6a0.17 0.17 0 1 0 -0.34 0a0.17 0.17 0 1 0 0.34 0M-0.12 -0.33L-0.6 0.44M0 -0.3V0.45M0.12 -0.33L0.6 0.44',
}
// a karesansui arrangement: a pair sharing one raked ring, a trio leaning on each other, the big one alone with its pebbles
// members: [stone index, x, y (towards the viewer), scale] in stone units around the group's centre
const GROUPS: { m: [number, number, number, number][]; pebbles?: [number, number, number][] }[] = [
  { m: [[0, -24, 0, 0.95], [1, 38, 12, 0.85]] },
  { m: [[2, 2, -4, 1], [3, -50, 9, 0.86], [4, 48, 14, 0.8]] },
  { m: [[5, 0, 0, 1.12]], pebbles: [[-84, 10, 9], [76, 14, 8], [98, 2, 6]] },
]
// group centres as shares of the free sand (x across, y down): wide, short landscape, portrait
const AT: Record<'wide' | 'short' | 'tall', Pt[]> = {
  wide: [[0.13, 0.78], [0.47, 0.96], [0.83, 0.84]],
  short: [[0.1, 0.72], [0.46, 0.97], [0.83, 0.82]],
  tall: [[0.19, 0.3], [0.52, 0.68], [0.82, 1]],
}
const f1 = (n: number) => n.toFixed(1)

/** Scene 2 — six stones in raked sand, one for each kind of agent; touch one and its ink picture is brushed in the moon. */
export function kindsScene(ctx: SceneCtx) {
  const stable = stableHeight(ctx, [K.insight])
  const sand = s('svg', { class: 't15k-sand', 'aria-hidden': 'true' })
  const picMask = nextId('t15km')
  // the picture lives inside the moon: a soft round mask so nothing floats past its edge
  const picG = s('g', { mask: `url(#${picMask})` })
  const pic = s('svg', { class: 't15k-pic', viewBox: '0 0 300 300', 'aria-hidden': 'true' },
    s('defs', null,
      s('radialGradient', { id: `${picMask}-g`, cx: 150, cy: 150, r: 168, gradientUnits: 'userSpaceOnUse' },
        s('stop', { offset: 0.8, 'stop-color': '#fff', 'stop-opacity': 1 }),
        s('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 })),
      s('mask', { id: picMask, maskUnits: 'userSpaceOnUse', x: -40, y: -40, width: 380, height: 380 },
        s('rect', { x: -40, y: -40, width: 380, height: 380, fill: `url(#${picMask}-g)` }))),
    // the empty moon waits: a faint ensō and a breath of ink haze
    s('g', { class: 't15k-enso' },
      s('path', { class: 'k', 'fill-opacity': 0.025, d: ell(156, 160, 100, 92), filter: 'url(#ink-wash)' }),
      s('path', { class: 'k3', 'fill-opacity': 0.3, d: brush(arc(150, 152, 128, 124, 112, 428, 72), 6, { a: 0.04, b: 0.5, min: 0.06, wob: 0.25 }).d, filter: 'url(#ink-rough)' })),
    picG)
  const moon = h('div', { class: 't15k-moon', 'aria-hidden': 'true' }, pic)
  const text = h('div', { class: 't15k-text', 'aria-live': 'polite' })
  const btns = K.items.map((it, i) => h('button', { class: 't15k-stone', type: 'button', 'aria-pressed': 'false', 'aria-label': it.name, onClick: () => pick(i) }))
  const group = h('div', { class: 't15k-stones', role: 'group', 'aria-label': K.group }, ...btns)
  const root = h('div', { class: 't15 t15k' }, sand, moon, text, group)
  ctx.art.append(root)
  ctx.prompt(K.prompt)

  const heard = new Set<number>()
  let sel = -1
  let said = false
  let shown: { root: SVGGElement; tl: TL; stop?: () => void } | null = null
  let parts: { g: SVGGElement; glyph: SVGGElement; rip: SVGGElement; sc: number; r0: number; x: number; y: number }[] = []

  // the tallest the words under the moon can get at this width (measured once per width)
  let probeW = -1
  let probeH = 0
  function textMax(w: number) {
    if (w === probeW) return probeH
    probeW = w
    const keep = [...text.childNodes]
    text.style.width = `${w}px`
    probeH = 0
    for (const it of K.items) {
      text.replaceChildren(...words(it))
      probeH = Math.max(probeH, text.offsetHeight)
    }
    text.replaceChildren(...keep)
    return probeH
  }
  const words = (it: Kind) => [
    h('p', { class: 't15k-title' }, it.name),
    h('p', { class: 't15k-what' }, it.what),
    h('p', { class: 't15k-ex' }, h('span', { class: 't15k-ex-l' }, K.exampleLabel), ' ', it.example),
  ]

  function layout() {
    const W = ctx.art.clientWidth
    const H = stable.H(ctx.art.clientHeight)
    if (W < 10 || H < 10) return
    root.style.height = `${H}px`
    const wide = W / H > 1.15
    const short = wide && H < 300
    root.classList.toggle('wide', wide)
    root.classList.toggle('short', short)
    // the moon window with its picture, and the words beside or under it
    let mr: number
    let mc: Pt
    let top: number
    if (short) {
      mr = H * 0.34
      mc = [mr + 6, mr + 4]
      const tl = mc[0] + mr + 22
      Object.assign(text.style, { left: `${tl}px`, top: '0px', width: `${Math.min(440, W - tl)}px`, textAlign: 'left' })
      top = H * 0.5
    } else if (wide) {
      mr = Math.min(H * 0.3, W * 0.17)
      mc = [W * 0.34, mr + 2]
      const tl = mc[0] + mr + 28
      Object.assign(text.style, { left: `${tl}px`, top: `${Math.max(0, mc[1] - mr * 0.7)}px`, width: `${Math.min(400, W - tl)}px`, textAlign: 'left' })
      top = mc[1] + mr * 0.78
    } else {
      mr = Math.min(W * 0.36, H * 0.19)
      mc = [W / 2, mr + 2]
      Object.assign(text.style, { left: '0px', top: `${mc[1] + mr + 6}px`, width: `${W}px`, textAlign: 'center' })
      top = Math.max(H * 0.45, mc[1] + mr + 10 + textMax(W))
    }
    Object.assign(moon.style, { left: `${mc[0] - mr}px`, top: `${mc[1] - mr}px`, width: `${mr * 2}px`, height: `${mr * 2}px` })

    // ── the stones: groups placed in the free sand ──
    const x0 = short ? mc[0] + mr + 24 : 0
    const sc0 = short ? clamp(H / 470, 0.42, 0.56) : wide ? clamp(Math.min(W / 1050, H / 480), 0.5, 1.25) : clamp(Math.min(W / 560, H / 760), 0.55, 0.78)
    const lift = 12 * sc0
    const yTop = top + 96 * sc0 * 0.9
    const yBot = H - 10 - 14 * sc0
    const at = AT[short ? 'short' : wide ? 'wide' : 'tall']
    type Stone = { i: number; x: number; y: number; sc: number }
    const stones: Stone[] = []
    const pebbles: { x: number; y: number; r: number }[] = []
    const rings = GROUPS.map((gp, gi) => {
      const [fx, fy] = at[gi]
      const cx = x0 + fx * (W - x0)
      const cy = yTop + fy * Math.max(0, yBot - yTop)
      let lo = Infinity
      let hi = -Infinity
      for (const [i, dx, dy, k] of gp.m) {
        const sc = sc0 * k
        const x = cx + dx * sc0
        const y = cy + dy * sc0 * 0.6
        stones.push({ i, x, y, sc })
        lo = Math.min(lo, x + Math.min(...SHAPES[i].map((p) => p[0])) * sc)
        hi = Math.max(hi, x + Math.max(...SHAPES[i].map((p) => p[0])) * sc)
      }
      for (const [dx, dy, r] of gp.pebbles ?? []) {
        pebbles.push({ x: cx + dx * sc0, y: cy + dy * sc0 * 0.6, r: r * sc0 })
        lo = Math.min(lo, cx + (dx - r) * sc0)
        hi = Math.max(hi, cx + (dx + r) * sc0)
      }
      return { x: (lo + hi) / 2, y: cy + 6 * sc0, r0: (hi - lo) / 2 + 8 + 6 * sc0, n: wide && !short ? 4 : 3 }
    })
    sand.replaceChildren()
    sand.setAttribute('viewBox', `0 0 ${W} ${H}`)
    const gap = wide && !short ? 7 + 5 * sc0 : 6
    const R = (r: (typeof rings)[number]) => r.r0 + r.n * gap
    for (let guard = 0; guard < 12; guard++) {
      let ok = true
      for (const [i, a] of rings.entries())
        for (const b of rings.slice(i + 1))
          if (Math.hypot(a.x - b.x, (a.y - b.y) / 0.34) < R(a) + R(b) + gap) {
            ok = false
            const big = a.n >= b.n ? a : b
            if (big.n > 0) big.n--
          }
      if (ok) break
    }
    const mid = nextId('t15k')
    const ids = { mask: `${mid}-m`, fade: `${mid}-f`, stone: `${mid}-s`, pool: `${mid}-p`, dry: `${mid}-d` }
    const defs = s('defs', null,
      // dry brush whose streaks run along a horizontal stroke (the strata across each stone)
      s('filter', { id: ids.dry, x: '-5%', y: '-60%', width: '110%', height: '220%' },
        s('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.03 0.7', numOctaves: '2', seed: '4', result: 'n' }),
        s('feColorMatrix', { in: 'n', type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2 1.4', result: 'm' }),
        s('feComposite', { in: 'SourceGraphic', in2: 'm', operator: 'in' })),
      s('linearGradient', { id: ids.fade, x1: 0, y1: 0, x2: 0, y2: 1 },
        s('stop', { offset: clamp(top / H, 0, 0.98), 'stop-color': '#fff', 'stop-opacity': 0 }),
        s('stop', { offset: clamp((top + H * 0.12) / H, 0.01, 0.99), 'stop-color': '#fff', 'stop-opacity': 1 })),
      s('linearGradient', { id: ids.stone, x1: 0, y1: 0, x2: 0.4, y2: 1 },
        s('stop', { offset: 0, class: 'gs0' }),
        s('stop', { offset: 1, class: 'gs1' })),
      s('radialGradient', { id: ids.pool, cx: W / 2, cy: H * 0.8, r: Math.max(W * 0.55, H * 0.5), gradientUnits: 'userSpaceOnUse', gradientTransform: `translate(0 ${H * 0.8}) scale(1 0.5) translate(0 ${-H * 0.8})` },
        s('stop', { offset: 0, class: 'kpool0' }),
        s('stop', { offset: 1, class: 'kpool1' })),
      s('mask', { id: ids.mask, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H },
        s('rect', { x: 0, y: 0, width: W, height: H, fill: `url(#${ids.fade})` }),
        ...rings.map((r) => s('path', { d: ell(r.x, r.y, R(r) + gap * 0.5, (R(r) + gap * 0.5) * 0.34), fill: '#000' }))))
    sand.append(defs)
    sand.append(s('rect', { x: 0, y: top, width: W, height: H - top, fill: `url(#${ids.pool})` }))
    const rk = s('g', { mask: `url(#${ids.mask})` })
    for (let y = top, k = 0; y < H + 10; k++) {
      const dpt = (y - top) / Math.max(1, H - top)
      const pts: string[] = []
      for (let x = -10; x <= W + 24; x += 18) pts.push(`${x} ${f1(y + (0.6 + 1.6 * dpt) * Math.sin(x / (60 + 90 * dpt) + k * 0.24))}`)
      const d = `M${pts.join('L')}`
      rk.append(s('path', { d, class: 'rk' }), s('path', { d, class: 'rk-hi', transform: 'translate(0 1.5)' }))
      y += 6 + 10 * dpt
    }
    sand.append(rk)
    for (const r of rings) {
      for (let j = 0; j <= r.n; j++) {
        const rx = r.r0 + j * gap
        const d = ell(r.x, r.y, rx, rx * 0.34)
        sand.append(s('path', { d, class: 'rk', fill: 'none' }), s('path', { d, class: 'rk-hi', fill: 'none', transform: 'translate(0 1.5)' }))
      }
    }

    const rnd = rng(31)
    const layers: { y: number; els: SVGElement[] }[] = []
    // the team's helpers: three pebbles kept close to the big stone
    for (const { x, y, r } of pebbles) {
      layers.push({ y, els: [
        s('path', { class: 'sh', 'fill-opacity': 0.2, d: ell(x + r * 0.25, y + r * 0.1, r * 1.3, r * 0.42), filter: 'url(#ink-wash)' }),
        s('path', { d: `M${f1(x - r)} ${f1(y)}Q${f1(x - r * 1.05)} ${f1(y - r * 0.95)} ${f1(x - r * 0.1)} ${f1(y - r * 1.02)}Q${f1(x + r)} ${f1(y - r * 0.9)} ${f1(x + r)} ${f1(y)}Z`, fill: `url(#${ids.stone})`, filter: 'url(#ink-rough)' }),
        s('path', { class: 'sh', 'fill-opacity': 0.55, d: brush([[x - r * 0.2, y - r * 0.95], [x + r * 0.8, y - r * 0.55], [x + r, y]], Math.max(1, r * 0.22), { a: 0.2, b: 0.3 }).d, filter: 'url(#ink-rough)' }),
      ] })
    }
    const built: (typeof parts)[number][] = []
    for (const { i, x, y, sc } of stones) {
      const pts = SHAPES[i].map(([px, py]) => [x + px * sc, y + py * sc] as Pt)
      const hgt = -Math.min(...SHAPES[i].map((p) => p[1])) * sc
      const half = Math.max(...SHAPES[i].map((p) => Math.abs(p[0]))) * sc
      const shadow = s('path', { class: 'sh', 'fill-opacity': 0.22, d: ell(x + 7 * sc, y + 1.5, half * 1.12, Math.max(4, half * 0.2)), filter: 'url(#ink-wash)' })
      const rip = s('g', { class: 't15k-rip' })
      const g = s('g', { class: 't15k-body' })
      const body = brush(pts, 0.01).c + 'Z'
      const top2 = pts.reduce((a, b) => (b[1] < a[1] ? b : a))
      const ti = pts.indexOf(top2)
      const clip = nextId('t15kc')
      defs.append(s('clipPath', { id: clip }, s('path', { d: body })))
      const tex = s('g', { 'clip-path': `url(#${clip})` },
        // the shadow side in wash, then dry-brush strata across the face
        s('path', { d: `M${f1(top2[0] - 4 * sc)} ${f1(top2[1] - 4)}Q${f1(x + half * 0.2)} ${f1(y - hgt * 0.45)} ${f1(x - half * 0.1)} ${f1(y + 2)}L${f1(x + half * 1.3)} ${f1(y + 2)}L${f1(x + half * 1.3)} ${f1(top2[1] - 4)}Z`, class: 'sh', 'fill-opacity': 0.2, filter: 'url(#ink-wash)' }),
        ...[0.28, 0.52, 0.74].map((f, k) => {
          const yy = y - hgt * f
          const w0 = half * (0.5 + rnd() * 0.5)
          return s('path', { class: 'sh', 'fill-opacity': (0.22 + rnd() * 0.18).toFixed(2), d: brush([[x - w0 + (rnd() - 0.3) * half * 0.4, yy + 2 * sc], [x + (rnd() - 0.5) * half * 0.2, yy - (2 + k) * sc], [x + half * 1.05, yy + 1.5 * sc]], (5 + rnd() * 4) * sc + 1.5, { a: 0.15, b: 0.5, min: 0.2 }).d, filter: `url(#${ids.dry})` })
        }),
        s('path', { class: 'sh', 'fill-opacity': 0.3, d: `M${f1(x - half * 1.2)} ${f1(y - hgt * 0.12)}Q${f1(x)} ${f1(y - hgt * 0.2)} ${f1(x + half * 1.2)} ${f1(y - hgt * 0.1)}L${f1(x + half * 1.2)} ${f1(y + 4)}L${f1(x - half * 1.2)} ${f1(y + 4)}Z`, filter: 'url(#ink-wash)' }))
      g.append(
        s('path', { d: body, fill: `url(#${ids.stone})`, filter: 'url(#ink-rough)' }),
        tex,
        // one heavy stroke down the shadow side, pressing hardest near the ground; a broken hairline on the lit side
        s('path', { d: brush(pts.slice(ti), 4.2 * sc + 1.2, { a: 0.15, b: 0.06, min: 0.18, wob: 0.25 }).d, class: 'sh', 'fill-opacity': 0.82, filter: 'url(#ink-rough)' }),
        s('path', { d: brush(pts.slice(1, ti + 1), 1.4 * sc + 0.6, { a: 0.5, b: 0.25, min: 0.05, wob: 0.3 }).d, class: 'edge', 'fill-opacity': 0.55, filter: 'url(#ink-rough)' }),
        s('path', { d: brush(pts.slice(Math.max(1, ti - 3), ti + 1).map(([a, b]) => [a + 3.5 * sc, b + 3 * sc] as Pt), 2.4 * sc + 0.6, { a: 0.3, b: 0.4 }).d, class: 'rim' }))
      if (i === 5) {
        // the big stone's split
        g.append(s('path', { class: 'sh', 'fill-opacity': 0.7, d: brush([[x - 4 * sc, y - hgt * 0.98], [x - 1 * sc, y - hgt * 0.78], [x - 6 * sc, y - hgt * 0.56], [x - 2 * sc, y - hgt * 0.36]], 2.4 * sc + 0.6, { a: 0.1, b: 0.7, min: 0.1 }).d, filter: 'url(#ink-rough)' }))
      }
      // moss on the shoulder
      const mg = s('g', { class: 'm', filter: 'url(#ink-rough)' })
      for (let k = 0; k < 6; k++) mg.append(s('path', { d: ell(top2[0] + (rnd() - 0.6) * 16 * sc, top2[1] + (1 + rnd() * 5) * sc, (1.4 + rnd() * 2.2) * sc + 0.5, (1 + rnd()) * sc + 0.4), 'fill-opacity': (0.5 + rnd() * 0.4).toFixed(2) }))
      g.append(mg)
      // its sign, carved into the face (never smaller than 14px across)
      const [gxo, gf, gs] = GLYPH[i]
      const gsz = Math.max(7, gs * sc)
      const glyph = s('g', { class: 't15k-glyph', transform: `translate(${f1(x + gxo * sc)} ${f1(y - hgt * gf)}) scale(${gsz.toFixed(2)})` },
        s('path', { d: GLYPHS[K.items[i].id], class: 'cv-d', transform: `translate(${(0.9 / gsz).toFixed(3)} ${(1.1 / gsz).toFixed(3)})` }),
        s('path', { d: GLYPHS[K.items[i].id], class: 'cv-l' }))
      g.append(glyph)
      layers.push({ y, els: [shadow, rip, g] })
      const r0 = half * 1.15
      built[i] = { g, glyph, rip, sc, r0, x, y }
      // the button covers the stone (stones nearer the viewer sit on top), never below the sand
      const bw = Math.max(44, half * 1.7)
      const bh = Math.max(44, hgt + 12)
      const bt = clamp(y - hgt - lift - 4, 0, H - bh)
      Object.assign(btns[i].style, { left: `${x - bw / 2}px`, top: `${bt}px`, width: `${bw}px`, height: `${Math.min(bh, H - bt)}px`, zIndex: String(Math.round(y)) })
    }
    // far stones first, so the near ones overlap them
    layers.sort((a, b) => a.y - b.y).forEach((l) => sand.append(...l.els))
    parts = built
    parts.forEach((p, i) => {
      if (i === sel) gsap.set(p.g, { y: -12 * p.sc })
      p.glyph.classList.toggle('on', i === sel)
    })
    btns.forEach((b, i) => b.classList.toggle('on', i === sel))
  }

  function pick(i: number) {
    if (i === sel) return
    const prev = sel
    sel = i
    ctx.anim(() => {
      btns.forEach((b, j) => {
        b.setAttribute('aria-pressed', String(j === i))
        b.classList.toggle('on', j === i)
        parts[j].glyph.classList.toggle('on', j === i)
      })
      const p = parts[i]
      if (prev >= 0) {
        const q = parts[prev]
        if (ctx.reduced) gsap.set(q.g, { y: 0 })
        else gsap.to(q.g, { y: 0, duration: 0.7, ease: 'power2.in' })
      }
      if (ctx.reduced) gsap.set(p.g, { y: -12 * p.sc })
      else {
        gsap.to(p.g, { y: -12 * p.sc, duration: 0.9, ease: 'power3.out' })
        p.rip.replaceChildren()
        const rs = [0, 1, 2].map(() => s('ellipse', { cx: p.x, cy: p.y, rx: p.r0, ry: p.r0 * 0.34 }))
        p.rip.append(...rs)
        gsap.fromTo(rs, { attr: { rx: p.r0, ry: p.r0 * 0.34 }, opacity: 0.7 }, { attr: { rx: p.r0 * 2.4, ry: p.r0 * 0.34 * 2.4 }, opacity: 0, duration: 2.2, ease: 'power2.out', stagger: 0.35 })
      }
      if (!heard.has(i)) {
        heard.add(i)
        btns[i].classList.add('heard')
      }
      root.classList.add('picked')
      // the moon: the old picture fades, the new one is brushed in
      if (shown) {
        const old = shown
        old.tl.kill()
        old.stop?.()
        if (ctx.reduced) old.root.remove()
        else gsap.to(old.root, { opacity: 0, duration: 0.45, onComplete: () => old.root.remove() })
      }
      const pen = new Pen(true)
      const extra: Extra | void = PICTURES[K.items[i].id](pen)
      picG.append(pen.root)
      const tl = gsap.timeline()
      const t0 = drawIn(pen, tl, 1.5, ctx.reduced ? 0 : 0.3)
      extra?.play?.(tl, t0)
      const cur: { root: SVGGElement; tl: TL; stop?: () => void } = { root: pen.root, tl }
      shown = cur
      if (ctx.reduced) tl.progress(1)
      else tl.call(() => void (cur.stop = extra?.loop?.()))

      const it = K.items[i]
      text.replaceChildren(...words(it))
      if (!ctx.reduced) gsap.fromTo(text.children, { opacity: 0, y: 8, filter: 'blur(5px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1, stagger: 0.12, delay: 0.3, ease: 'power3.out', clearProps: 'filter' })
      ctx.chime('soft')
      if (!said && heard.size >= 3) {
        said = true
        ctx.insight(K.insight, K.detail)
      }
    })
  }

  watchSize(ctx, layout, () => ((probeW = -1), stable.reset()))
  layout()
  return () => {
    shown?.tl.kill()
    shown?.stop?.()
  }
}
