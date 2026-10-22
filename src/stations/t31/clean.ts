import raw from '../../content/tram-31.json'
import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx, SceneDef } from '../types'
import { clamp, onSize, p2Defs, stoneArt } from '../../ui/part2/ink'
import { grass, hills, mist, moon, wash } from '../../ui/part2/paint'
import { guide, type Mark } from '../../ui/part2/guide'
import { findTakeaway, foldedTakeaway } from '../../ui/part2/takeaway'
import { bamboo, blob, ground, live, rng, stroke, type Pt } from './kit'
import './clean.css'

const K = raw.scenes.clean
const f1 = (n: number) => (Math.round(n * 10) / 10).toString()

/** A celadon bowl standing on (cx, cy = rim centre), bw half-wide, its water holding the whole moon once it runs clear. */
function moonBowl(cx: number, cy: number, bw: number, seed: number, moonDx: number): SVGGElement {
  const ry = bw * 0.24
  const body = `M${f1(cx - bw)} ${f1(cy)}C${f1(cx - bw * 0.96)} ${f1(cy + bw * 0.5)} ${f1(cx - bw * 0.55)} ${f1(cy + bw * 0.74)} ${f1(cx - bw * 0.3)} ${f1(cy + bw * 0.78)}L${f1(cx - bw * 0.32)} ${f1(cy + bw * 0.9)}L${f1(cx + bw * 0.32)} ${f1(cy + bw * 0.9)}L${f1(cx + bw * 0.3)} ${f1(cy + bw * 0.78)}C${f1(cx + bw * 0.55)} ${f1(cy + bw * 0.74)} ${f1(cx + bw * 0.96)} ${f1(cy + bw * 0.5)} ${f1(cx + bw)} ${f1(cy)}Z`
  const rim: Pt[] = Array.from({ length: 17 }, (_, i) => { const a = (Math.PI * i) / 16; return [cx + Math.cos(a) * bw, cy + Math.sin(a) * ry] as Pt })
  return s('g', { class: 'g11-bowl' },
    // the bowl's shadow falls away from the moon, onto the ground in front
    ground(cx + moonDx * bw * 0.4, cy + bw * 0.95, bw * 1.2, bw * 0.17, seed, 0.3),
    s('path', { class: 'g11-bowl-glaze', d: body, filter: 'url(#ink-rough)' }),
    s('path', { d: body, fill: 'url(#p2-shade)' }),
    s('path', { class: 'g11-moonlit', d: stroke([[cx - bw * 0.86, cy + bw * 0.12], [cx - bw * 0.7, cy + bw * 0.46], [cx - bw * 0.42, cy + bw * 0.64]], bw * 0.07, 0.2, 0.3, 0.2) }),
    s('path', { class: 'g11-wash g11-bowl-ink', d: stroke(rim.slice(2).reverse(), bw * 0.06, 0.1, 0.2, 0.3) + stroke([[cx + bw * 0.98, cy + bw * 0.1], [cx + bw * 0.7, cy + bw * 0.6], [cx + bw * 0.3, cy + bw * 0.8]], bw * 0.05, 0.1, 0.3, 0.3), filter: 'url(#ink-rough)' }),
    s('ellipse', { class: 'g11-bowl-in', cx: f1(cx), cy: f1(cy), rx: f1(bw), ry: f1(ry) }),
    s('ellipse', { class: 'g11-bowl-water', cx: f1(cx), cy: f1(cy + ry * 0.14), rx: f1(bw * 0.88), ry: f1(ry * 0.78) }),
    s('ellipse', { class: 'g11-bowl-glow', cx: f1(cx + bw * 0.08), cy: f1(cy + ry * 0.12), rx: f1(bw * 0.5), ry: f1(ry * 0.6), fill: 'url(#p2-halo)' }),
    s('ellipse', { class: 'g11-bowl-moon', cx: f1(cx + bw * 0.08), cy: f1(cy + ry * 0.12), rx: f1(bw * 0.22), ry: f1(ry * 0.42) }),
    s('path', { class: 'g11-moonlit', d: stroke([[cx - bw * 0.92, cy - ry * 0.2], [cx - bw * 0.4, cy - ry * 0.95], [cx + bw * 0.3, cy - ry * 0.95]], bw * 0.05, 0.2, 0.4, 0.2) }))
}

/** Falling water from a (a lip) to b (the next surface): a ribbon that leaves the lip outward, drops, and lands in foam. */
function fall(a: Pt, b: Pt, w: number, out: number, seed: number): { g: SVGGElement; clear: SVGElement } {
  const c: Pt = [a[0] + out, a[1] + (b[1] - a[1]) * 0.08]
  const pts = Array.from({ length: 14 }, (_, i) => {
    const t = i / 13, u = 1 - t
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]] as Pt
  })
  const ribbon = stroke(pts, w, 0.2, 0.08, 0.5)
  // the lit edge and a second strand: water, not a pipe
  const hi = stroke(pts.map(([x, y]) => [x - w * 0.22, y] as Pt), Math.max(0.7, w * 0.22), 0.15, 0.4, 0.2) +
    stroke(pts.slice(3).map(([x, y], k) => [x + w * 0.25 + Math.sin(k * 1.3) * w * 0.12, y] as Pt), Math.max(0.5, w * 0.12), 0.3, 0.3, 0.2)
  // white water where it lands: a cushion of foam, a few drops thrown up, two spreading rings
  const r = rng(seed)
  let foam = '', spray = ''
  for (let k = 0; k < 5; k++) foam += blob(b[0] + (r() - 0.5) * w * 2.6, b[1] + (r() - 0.3) * w * 0.5, w * (0.5 + r() * 0.5), w * (0.24 + r() * 0.16), seed + k, 0.3, 8)
  for (let k = 0; k < 6; k++) {
    const x = b[0] + (r() - 0.5) * w * 4, y = b[1] - w * (0.6 + r() * 1.6)
    spray += blob(x, y, w * 0.12 + 0.5, w * 0.12 + 0.5, seed + 9 + k, 0.1, 6)
  }
  const splash = s('g', { class: 't31f4-splash' },
    s('ellipse', { cx: f1(b[0]), cy: f1(b[1] + 1), rx: f1(w * 2.4), ry: f1(w * 0.7) }),
    s('ellipse', { cx: f1(b[0]), cy: f1(b[1] + 1), rx: f1(w * 4.2), ry: f1(w * 1.2) }))
  const clear = s('g', { class: 't31f4-flow-clear' }, s('path', { d: ribbon }), s('path', { class: 't31f4-flow-hi', d: hi }), s('path', { class: 't31f4-foam', d: foam + spray }))
  return { g: s('g', null, s('path', { class: 't31f4-flow', d: ribbon }), s('path', { class: 't31f4-flow-hi', d: hi }), s('path', { class: 't31f4-foam t31f4-foam-murk', d: foam }), splash, clear), clear }
}

/** The dirt each basin holds, drawn about (0, 0) = where it floats on the water, k ≈ basin half-width / 40. */
function debrisArt(id: string, k: number, seed: number): SVGGElement {
  const r = rng(seed)
  if (id === 'fake') {
    // a rolled code scroll, half sunk, a red seal on its wrapper (the look-alike's name)
    const L = 21 * k, R = 4.6 * k
    let code = ''
    for (let i = 0; i < 4; i++) {
      const x = -L * 0.85 + i * L * 0.32
      code += stroke([[x, -R * 1.25], [x + L * (0.14 + r() * 0.1), -R * 1.3]], 0.9 * k, 0.2, 0.2, 0.3)
    }
    return s('g', { class: 't31f4-deb-art', transform: 'rotate(-10)' },
      s('ellipse', { class: 't31f4-deb-sh', cx: 0, cy: f1(1.4 * k), rx: f1(L * 1.12), ry: f1(2.8 * k) }),
      s('rect', { class: 't31f4-paper', x: f1(-L), y: f1(-2 * R), width: f1(2 * L), height: f1(2 * R), rx: f1(R) }),
      s('ellipse', { class: 't31f4-paper-end', cx: f1(L - R * 0.4), cy: f1(-R), rx: f1(R * 0.45), ry: f1(R * 0.95) }),
      s('path', { class: 'g11-wash t31f4-code', d: code }),
      s('rect', { class: 'g11-seal', x: f1(L * 0.18), y: f1(-2 * R + 0.6 * k), width: f1(9 * k), height: f1(2 * R - 1.2 * k), rx: f1(0.6 * k) }),
      s('path', { class: 't31f4-sunk', d: `M${f1(-L * 1.05)} ${f1(-R * 0.55)}H${f1(L * 1.05)}V${f1(R * 0.2)}H${f1(-L * 1.05)}Z` }),
      s('path', { class: 't31f4-ripple', d: stroke([[-L * 1.2, -R * 0.5], [0, -R * 0.35], [L * 1.2, -R * 0.55]], 1.1 * k, 0.2, 0.2, 0.3) }))
  }
  if (id === 'pkl') {
    // a clay jar bobbing, its paper label says .pkl, bubbles rise from its neck (it is already "running")
    const w = 7.2 * k
    const body = `M${f1(-w)} 0C${f1(-w - 3.4 * k)} ${f1(-8 * k)} ${f1(-w)} ${f1(-14 * k)} ${f1(-3 * k)} ${f1(-14.8 * k)}L${f1(-3 * k)} ${f1(-17.4 * k)}L${f1(3 * k)} ${f1(-17.4 * k)}L${f1(3 * k)} ${f1(-14.8 * k)}C${f1(w)} ${f1(-14 * k)} ${f1(w + 3.4 * k)} ${f1(-8 * k)} ${f1(w)} 0Z`
    return s('g', { class: 't31f4-deb-art', transform: 'rotate(8)' },
      s('ellipse', { class: 't31f4-deb-sh', cx: 0, cy: f1(0.8 * k), rx: f1(w * 1.5), ry: f1(2.4 * k) }),
      s('path', { class: 'g11-clay', d: body, filter: 'url(#ink-rough)' }),
      s('path', { d: body, fill: 'url(#p2-shade)' }),
      s('path', { class: 'g11-moonlit', d: stroke([[-w - 0.8 * k, -6 * k], [-w + 0.6 * k, -11 * k], [-3.4 * k, -13.6 * k]], 1.2 * k, 0.2, 0.3, 0.2) }),
      s('path', { class: 't31f4-label', d: `M${f1(-6.6 * k)} ${f1(-11.8 * k)}l${f1(13.2 * k)} ${f1(-0.4 * k)}l${f1(0.2 * k)} ${f1(7 * k)}l${f1(-13.2 * k)} ${f1(0.4 * k)}Z` }),
      s('text', { class: 't31f4-pkl', x: 0, y: f1(-6.6 * k), 'font-size': f1(5.6 * k), 'text-anchor': 'middle' }, '.pkl'),
      s('path', { class: 't31f4-sunk', d: `M${f1(-w * 1.6)} ${f1(-3 * k)}H${f1(w * 1.6)}V${f1(1 * k)}H${f1(-w * 1.6)}Z` }),
      s('path', { class: 't31f4-ripple', d: stroke([[-w * 1.7, -2.6 * k], [0, -2 * k], [w * 1.7, -2.8 * k]], 1.1 * k, 0.2, 0.2, 0.3) }),
      s('g', { class: 't31f4-bub' }, ...[[-1.4, -21, 1.3], [1.6, -25, 1], [-0.4, -29, 0.8]].map(([x, y, rr], i) =>
        s('circle', { cx: f1(x * k), cy: f1(y * k), r: f1(rr * k), style: `animation-delay:${i * 0.5}s` }))))
  }
  // a sheet of license terms floating flat, crossed out in red: "no commercial use"
  const W = 17 * k, H = 9 * k
  let lines = ''
  for (let i = 0; i < 4; i++) lines += stroke([[-W * 0.75, -H * 1.5 + i * H * 0.42], [W * (0.2 + r() * 0.5), -H * 1.52 + i * H * 0.42]], 0.9 * k, 0.2, 0.3, 0.3)
  return s('g', { class: 't31f4-deb-art', transform: 'rotate(-6)' },
    s('ellipse', { class: 't31f4-deb-sh', cx: 0, cy: f1(0.4 * k), rx: f1(W * 1.15), ry: f1(2.4 * k) }),
    s('path', { class: 't31f4-paper', d: `M${f1(-W)} ${f1(-H * 1.9)}L${f1(W * 0.92)} ${f1(-H * 2.05)}L${f1(W)} ${f1(-H * 0.05)}L${f1(-W * 0.94)} ${f1(H * 0.1)}Z` }),
    s('path', { class: 'g11-wash t31f4-code', d: lines }),
    s('path', { class: 'g11-seal t31f4-x', d: stroke([[-W * 0.7, -H * 1.75], [W * 0.7, -H * 0.15]], 2 * k, 0.1, 0.1, 0.4) + stroke([[W * 0.66, -H * 1.85], [-W * 0.62, -H * 0.1]], 2 * k, 0.1, 0.1, 0.4) }),
    s('path', { class: 't31f4-ripple', d: stroke([[-W * 1.15, H * 0.05], [0, H * 0.2], [W * 1.15, 0]], 1.1 * k, 0.2, 0.2, 0.3) }))
}

/** A woven bamboo filter basket (zaru) in a 100 × 78 box: shadow, woven body, rim band, its bed (charcoal, gravel or a mat). */
function basket(kind: number, seed: number): SVGGElement {
  const r = rng(seed)
  const body = 'M6 30C8 52 26 68 50 68C74 68 92 52 94 30Z'
  let weave = ''
  for (let x = -40; x < 120; x += 7) weave += stroke([[x, 28], [x + 26, 70]], 1.6, 0.1, 0.1, 0.6) + stroke([[x + 26, 28], [x, 70]], 1.1, 0.1, 0.1, 0.6)
  let bed = '', grit = ''
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2, q = Math.sqrt(r())
    const x = 50 + Math.cos(a) * 36 * q, y = 30 + Math.sin(a) * 8 * q
    if (kind === 0) bed += blob(x, y, 4 + r() * 3, 2 + r() * 1.4, seed + i, 0.35, 7)
    else if (kind === 1) grit += blob(x, y, 2.4 + r() * 2, 1.4 + r(), seed + i, 0.25, 7)
    else bed += stroke([[x - 6, y + 1], [x + 6, y - 1]], 1.2, 0.2, 0.2, 0.4)
  }
  const clip = `t31f4-wv${seed}`
  return s('g', { class: `t31f4-basket t31f4-k${kind}` },
    s('defs', null, s('clipPath', { id: clip }, s('path', { d: body }))),
    s('ellipse', { class: 't31f4-b-sh', cx: 46, cy: 70, rx: 44, ry: 6 }),
    s('path', { class: 't31f4-b-body', d: body, filter: 'url(#ink-rough)' }),
    s('g', { 'clip-path': `url(#${clip})` }, s('path', { class: 't31f4-b-weave', d: weave }), s('path', { d: body, fill: 'url(#p2-shade)' })),
    s('ellipse', { class: 't31f4-b-rim', cx: 50, cy: 30, rx: 44, ry: 12 }),
    s('ellipse', { class: 't31f4-b-bed', cx: 50, cy: 30.5, rx: 39, ry: 9 }),
    s('path', { class: 't31f4-b-fill', d: bed }),
    s('path', { class: 't31f4-b-grit', d: grit }),
    s('path', { class: 'g11-wash t31f4-b-ink', d: stroke(Array.from({ length: 13 }, (_, i) => { const a = Math.PI * (i / 12); return [50 + Math.cos(a) * 44, 30 + Math.sin(a) * 12] as Pt }), 2.2, 0.1, 0.1, 0.4) + stroke([[93, 32], [84, 54], [60, 67]], 1.8, 0.1, 0.3, 0.3), filter: 'url(#ink-rough)' }),
    s('path', { class: 'g11-moonlit', d: stroke(Array.from({ length: 11 }, (_, i) => { const a = Math.PI * (1.1 + i * 0.08); return [50 + Math.cos(a) * 43, 30 + Math.sin(a) * 11.4] as Pt }), 1.8, 0.2, 0.3, 0.2) }))
}

type Basin = { x: number; y: number; bw: number; out: number }
type Spot = { x: number; y: number; w: number }
type Cap = { x: number; y: number; w: number; end: boolean }
type Geo = { W: number; H: number; tall: boolean; hz: number; moon: [number, number, number]; spout: Pt; pw: number; basins: Basin[]; bowl: Basin; filters: Spot[]; caps: Cap[]; slip: Pt }

/** Lay the scene out (px): wide = one diagonal toward you, filters on the bank to its left; tall = a zig-zag, filters in a row at the foot. */
function geo(W: number, H: number): Geo {
  const tall = W < H * 0.8
  if (!tall) {
    const m = Math.min(W, H * 1.6)
    const basins = [0, 1, 2].map((i) => ({ x: W * (0.4 + 0.15 * i), y: H * (0.4 + 0.165 * i), bw: m * (0.052 + 0.024 * i), out: 1 }))
    const b0 = basins[0]
    return {
      W, H, tall, hz: H * 0.34, moon: [W * 0.5, H * 0.11, clamp(H * 0.036, 16, 30)],
      spout: [b0.x - b0.bw * 1.15, b0.y - H * 0.13], pw: clamp(W * 0.009, 9, 15),
      basins, bowl: { x: W * 0.875, y: H * 0.8, bw: m * 0.1, out: 1 },
      filters: [0, 1, 2].map((k) => ({ x: W * (0.115 + 0.1 * k), y: H * (0.58 + 0.135 * k), w: m * (0.1 + 0.014 * k) })),
      // each basin's caption on the ground to its left, ending short of its lip
      caps: basins.map((b) => ({ x: b.x - b.bw * 1.1, y: b.y + b.bw * 0.22, w: W * 0.19, end: true })),
      slip: [W * 0.21, H * 0.74],
    }
  }
  // tall: the cascade steps down the right half in a tight zig-zag (right, further right, back), each caption on the
  // ground to the left of its own basin at its height; the bowl under them; the filters in a row at the foot
  const xs = [0.6, 0.76, 0.62], ys = [0.275, 0.415, 0.56], bws = [0.12, 0.15, 0.185]
  const basins = [0, 1, 2].map((i) => ({ x: W * xs[i], y: H * ys[i], bw: W * bws[i], out: i ? -1 : 1 }))
  return {
    W, H, tall, hz: H * 0.19, moon: [W * 0.84, H * 0.075, 13],
    spout: [W * 0.42, H * 0.175], pw: 7,
    basins, bowl: { x: W * 0.4, y: H * 0.71, bw: W * 0.22, out: 1 },
    filters: [[0.19, 0.905], [0.5, 0.88], [0.81, 0.905]].map(([x, y], k) => ({ x: W * x, y: H * y, w: W * (k === 1 ? 0.25 : 0.235) })),
    caps: basins.map((b) => ({ x: b.x - b.bw * 1.12, y: b.y - b.bw * 0.2, w: b.x - b.bw * 1.12 - W * 0.03, end: true })),
    slip: [W * 0.5, H * 0.9],
  }
}

/**
 * Scene 5 — three filters. Seen low beside a big dark bowl: a bamboo kakehi on a crossed stand pours murky water into
 * three carved basins that step down toward you; each basin holds one kind of dirt (a look-alike code scroll, a fizzing
 * .pkl jar, a "no commercial use" license). Woven filter baskets lie on the bank: drag one onto the basin holding what
 * it stops (or pick it, then the basin; or keys 1–3 on it). Right: the basket settles on the lip, catches the dirt, that
 * basin and its fall run clear; wrong: it slides back and the caption by that basin says why. All three: the bowl fills
 * clear and holds the whole moon; the take-away waits folded on the bank.
 */
export function cleanScene(): SceneDef {
  return { label: K.label, text: 'tr', mount }
}

function mount(ctx: SceneCtx) {
  p2Defs()
  const n = K.debris.length
  const done = K.debris.map(() => false)
  let sel = -1
  let G: Geo | null = null
  const timers: number[] = []
  ctx.onCleanup(() => timers.forEach(clearTimeout))
  const say = live('visually-hidden')
  const svg = s('svg', { class: 't31f4-svg', 'aria-hidden': 'true' })
  const basinG: SVGGElement[] = []
  const debG: SVGGElement[] = []
  const drops: SVGElement[] = []
  const caps = K.debris.map((d) => h('p', { class: 't31f4-cap', 'aria-hidden': 'true' }, d.label))
  const zones = K.debris.map((d, i) => h('button', {
    class: 't31f4-zone', type: 'button', 'aria-label': fill(K.basinAria, { n: i + 1, debris: d.label }),
    onClick: () => (sel >= 0 ? attempt(sel, i) : done[i] ? null : ctx.prompt(K.pickFirst)),
  }))
  const filters = K.filters.map((f, k) => {
    const art = s('svg', { class: 't31f4-f-art', viewBox: '0 0 100 78', 'aria-hidden': 'true' }, basket(k, 3150 + k * 7))
    return h('button', { class: 't31f4-filter', type: 'button', 'aria-pressed': 'false', 'aria-label': fill(K.filterAria, { label: f.label }) },
      art, h('span', { class: 't31f4-tag' }, f.label))
  })
  const slipBox = h('div', { class: 't31f4-slip', hidden: true })
  const root = h('div', { class: 't31f4', role: 'group', 'aria-label': K.aria },
    h('p', { class: 'visually-hidden' }, K.art), svg, ...caps, ...zones, ...filters, slipBox, say)
  ctx.art.append(root)

  // ── the painting (px, redrawn in one pass per size)
  function paint(g: Geo) {
    const { W, H, tall, hz, basins, bowl, spout, pw } = g
    const [mx, my, mr] = g.moon
    svg.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    const r = rng(3141)
    const parts: SVGElement[] = []
    const stop = (o: number, v: string) => s('stop', { offset: o, style: `stop-color:var(${v});stop-opacity:var(${v}-a)` })
    parts.push(s('defs', null,
      s('radialGradient', { id: 't31f4-murk', cx: 0.45, cy: 0.4, r: 0.65 }, s('stop', { offset: 0, class: 't31f4-m0' }), s('stop', { offset: 1, class: 't31f4-m1' })),
      // the ground is a wash laid where the garden is, thinning out toward the sides and the horizon (not a panel)
      s('radialGradient', { id: 't31f4-fadeX', cx: 0.52, cy: tall ? 0.72 : 0.78, r: tall ? 0.78 : 0.68 }, s('stop', { offset: 0, 'stop-color': '#fff' }), s('stop', { offset: 0.55, 'stop-color': '#fff' }), s('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 })),
      s('linearGradient', { id: 't31f4-fadeY', x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, 'stop-color': '#000', 'stop-opacity': 0 }), s('stop', { offset: 1, 'stop-color': '#000' })),
      s('mask', { id: 't31f4-edge', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: f1(W), height: f1(H) },
        s('rect', { x: 0, y: 0, width: f1(W), height: f1(H), fill: 'url(#t31f4-fadeX)' }),
        s('rect', { x: 0, y: f1(H * 0.93), width: f1(W), height: f1(H * 0.07 + 1), fill: 'url(#t31f4-fadeY)' })),
      s('linearGradient', { id: 't31f4-gnd', gradientUnits: 'userSpaceOnUse', x1: 0, y1: f1(hz - H * 0.02), x2: 0, y2: f1(H) }, stop(0, '--t31f4-g0'), stop(0.45, '--t31f4-g1'), stop(1, '--t31f4-g2'))))
    // sky and the far ranges, the valley mist at their feet
    parts.push(
      mist(W * 0.5, my + mr, W * 0.5, mr * 3),
      moon(mx, my, mr, 3167, true),
      hills(-W * 0.05, W * 1.05, hz + H * 0.01, H * (tall ? 0.1 : 0.17), 3168, 0.92, tall ? 3 : 6),
      mist(W * 0.5, hz - H * 0.02, W * 0.7, H * 0.05),
      hills(tall ? -W * 0.1 : W * 0.55, W * 1.1, hz + H * 0.02, H * (tall ? 0.06 : 0.1), 3169, 0.6, 2),
      mist(W * 0.55, hz + H * 0.01, W * 0.75, H * 0.035))
    // the ground: one slope from the mist at the horizon down to your feet, mossy tufts thickening toward you, pebbles
    const gnd = `M0 ${f1(H + 2)}L0 ${f1(hz + H * 0.015)}Q${f1(W * 0.3)} ${f1(hz - H * 0.006)} ${f1(W * 0.55)} ${f1(hz + H * 0.004)}Q${f1(W * 0.8)} ${f1(hz + H * 0.012)} ${f1(W)} ${f1(hz)}L${f1(W)} ${f1(H + 2)}Z`
    let tufts = '', peb = ''
    for (let i = 0; i < (tall ? 220 : 420); i++) {
      const x = r() * W, y = hz + H * 0.02 + Math.pow(r(), 0.75) * (H - hz)
      const k = (y - hz) / (H - hz)
      tufts += blob(x, y, 1 + k * (tall ? 3 : 5), 0.5 + k * (tall ? 1.4 : 2.2), i, 0.3, 6)
    }
    for (let i = 0; i < (tall ? 18 : 30); i++) {
      const y = hz + H * 0.05 + Math.pow(r(), 0.7) * (H - hz) * 0.95, k = (y - hz) / (H - hz)
      peb += blob(r() * W, y, 1.5 + k * 5, 1 + k * 2.6, 3170 + i, 0.2, 8)
    }
    parts.push(s('g', { mask: 'url(#t31f4-edge)' },
      s('path', { d: gnd, fill: 'url(#t31f4-gnd)' }),
      s('path', { class: 'g11-mossy t31f4-tuft', d: tufts }),
      s('path', { class: 't31f4-pebble', d: peb })))
    // the bank the filters lie on: a darker mossy rise, lit along its crown
    const fb = g.filters
    const bx0 = Math.min(...fb.map((f) => f.x - f.w)), bx1 = Math.max(...fb.map((f) => f.x + f.w))
    const by0 = Math.min(...fb.map((f) => f.y)) - fb[0].w * 0.3, by1 = H + 4
    parts.push(wash(blob((bx0 + bx1) / 2, (by0 + by1) / 2 + H * 0.02, (bx1 - bx0) * 0.62, (by1 - by0) * 0.62, 3171, 0.12), 0.16, 'p2p-wash t31f4-bank'))
    // the kakehi: a long bamboo pipe from out of the frame resting in the fork of a crossed stand whose feet stand on
    // the ground (a flat stone under each), its cut spout pouring murky water into the first basin
    const b0 = basins[0]
    const sp1: Pt = spout
    const sp0: Pt = [-pw * 4, sp1[1] - (sp1[0] + pw * 4) * 0.08]
    const cx = sp1[0] - pw * (tall ? 3.5 : 5)
    const cy = sp0[1] + ((sp1[1] - sp0[1]) * (cx - sp0[0])) / (sp1[0] - sp0[0]) + pw * 0.55
    const foot = Math.max(hz + H * 0.05, cy + H * (tall ? 0.07 : 0.1))
    const spread = (foot - cy) * 0.36
    const legs = [
      bamboo([cx - spread, foot], [cx + pw * 1.3, cy - pw * 1.4], pw * 0.6, 3172, pw * 4),
      bamboo([cx + spread, foot], [cx - pw * 1.3, cy - pw * 1.4], pw * 0.6, 3173, pw * 4),
    ]
    const sdx = (cx - mx) / W
    parts.push(
      ground(cx + sdx * pw * 6, foot + 1, spread * 1.6, pw * 0.7, 3174, 0.35),
      s('path', { class: 't31f4-flat', d: blob(cx - spread, foot - 1, pw * 1.2, pw * 0.45, 3175, 0.2, 10) + blob(cx + spread, foot - 1, pw * 1.1, pw * 0.42, 3176, 0.2, 10) }),
      ...legs,
      s('path', { class: 'g11-wash t31f4-lash', d: stroke([[cx - pw * 0.9, cy - pw * 0.5], [cx + pw * 0.9, cy + pw * 0.4]], pw * 0.35, 0.1, 0.1, 0.5) + stroke([[cx - pw * 0.9, cy + pw * 0.4], [cx + pw * 0.9, cy - pw * 0.5]], pw * 0.35, 0.1, 0.1, 0.5) }),
      bamboo(sp0, sp1, pw, 3177, pw * 6),
      s('ellipse', { class: 't31f4-mouth', cx: f1(sp1[0]), cy: f1(sp1[1] + pw * 0.05), rx: f1(pw * 0.3), ry: f1(pw * 0.5), transform: `rotate(-20 ${f1(sp1[0])} ${f1(sp1[1])})` }),
      mist(pw * 2, sp0[1] + pw, W * 0.12, pw * 3))
    // falls are drawn over the basins (water pours over the lip it leaves and lands on the water it enters)
    const falls: SVGElement[] = [fall([sp1[0] + pw * 0.2, sp1[1] + pw * 0.25], [b0.x - b0.bw * 0.25, b0.y + b0.bw * 0.08], tall ? 3 : 4.5, pw * 0.9, 3178).g]
    // the basins far to near: a boulder under each, its shadow away from the moon, the carved bowl, the water, the dirt;
    // its fall into the next one (or the bowl)
    basinG.length = debG.length = drops.length = 0
    basins.forEach((b, i) => {
      const { x, y, bw } = b
      const ry = bw * 0.3
      const pedH = bw * 0.62, pedY = y + bw * 0.56 + pedH
      const dx = ((x - mx) / W) * bw * 0.8
      const bodyD = `M${f1(x - bw)} ${f1(y)}C${f1(x - bw * 1.02)} ${f1(y + bw * 0.42)} ${f1(x - bw * 0.6)} ${f1(y + bw * 0.62)} ${f1(x - bw * 0.36)} ${f1(y + bw * 0.66)}L${f1(x + bw * 0.36)} ${f1(y + bw * 0.66)}C${f1(x + bw * 0.6)} ${f1(y + bw * 0.62)} ${f1(x + bw * 1.02)} ${f1(y + bw * 0.42)} ${f1(x + bw)} ${f1(y)}Z`
      let chisel = ''
      for (let k = 0; k < 7; k++) {
        const t = -0.8 + r() * 1.6, yy = y + bw * (0.12 + r() * 0.36)
        chisel += stroke([[x + t * bw * 0.86, yy], [x + t * bw * 0.86 + bw * 0.04, yy + bw * 0.08]], Math.max(0.8, bw * 0.02), 0.2, 0.4, 0.2)
      }
      const lip = (o: number) => s('path', { class: 't31f4-notch', d: stroke([[x + o * bw * 0.84, y - ry * 0.2], [x + o * bw * 0.98, y + ry * 0.05]], Math.max(1.6, bw * 0.06), 0.1, 0.1, 0.4) })
      const deb = s('g', { class: 't31f4-deb', style: `--lift:${f1(-bw * 0.13)}px` }, debrisArt(K.debris[i].id, bw / 40, 3180 + i))
      // it floats on the far side from where the water comes in
      deb.setAttribute('transform', `translate(${f1(x + bw * 0.14 * (i ? basins[i - 1].out : 1))} ${f1(y + ry * 0.12)})`)
      const placed = s('g', { class: 't31f4-placed' })
      if (done[i]) placed.append(s('g', { transform: `translate(${f1(x - bw * 0.62)} ${f1(y - bw * 0.42)}) scale(${(bw * 1.24 / 100).toFixed(4)})` }, basket(K.filters.findIndex((f) => f.blocks === K.debris[i].id), 3190 + i)))
      const bg = s('g', { class: `t31f4-basin${done[i] ? ' clear' : ''}` },
        ground(x + dx, pedY + 1, bw * 1.25, bw * 0.16, 3200 + i, 0.32),
        s('g', { transform: `translate(${f1(x + bw * 0.04)} ${f1(pedY)})` }, stoneArt(bw * 1.55, pedH * 1.05, 3210 + i)),
        s('path', { class: 'g11-mossy t31f4-pedmoss', d: blob(x - bw * 0.45, pedY - pedH * 0.12, bw * 0.3, bw * 0.06, 3220 + i, 0.3, 10), filter: 'url(#ink-wash)' }),
        s('path', { class: 't31f4-stone', d: bodyD, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
        s('path', { d: bodyD, fill: 'url(#p2-shade)' }),
        s('path', { class: 'g11-wash t31f4-chisel', d: chisel }),
        s('path', { class: 'g11-mossy', d: blob(x - bw * 0.52, y + bw * 0.48, bw * 0.3, bw * 0.08, 3230 + i, 0.3, 10) + blob(x + bw * 0.6, y + bw * 0.14, bw * 0.16, bw * 0.06, 3240 + i, 0.3, 10), filter: 'url(#ink-wash)' }),
        s('path', { class: 'g11-mossy', d: stroke([[x - bw * 0.7, y + bw * 0.3], [x - bw * 0.69, y + bw * 0.46]], bw * 0.05, 0.1, 0.6, 0.2) + stroke([[x + bw * 0.5, y + bw * 0.38], [x + bw * 0.52, y + bw * 0.5]], bw * 0.04, 0.1, 0.6, 0.2) }),
        s('ellipse', { class: 't31f4-lip', cx: f1(x), cy: f1(y), rx: f1(bw), ry: f1(ry), fill: 'url(#p2-rock)' }),
        s('path', { class: 'g11-mossy', d: blob(x - bw * 0.7, y + ry * 0.55, bw * 0.22, ry * 0.18, 3250 + i, 0.3, 10) + blob(x + bw * 0.35, y - ry * 0.8, bw * 0.2, ry * 0.14, 3260 + i, 0.3, 10), filter: 'url(#ink-wash)' }),
        s('ellipse', { class: 't31f4-wall', cx: f1(x), cy: f1(y + ry * 0.04), rx: f1(bw * 0.86), ry: f1(ry * 0.74) }),
        s('ellipse', { class: 't31f4-murk', cx: f1(x), cy: f1(y + ry * 0.14), rx: f1(bw * 0.84), ry: f1(ry * 0.66), fill: 'url(#t31f4-murk)' }),
        s('g', { class: 't31f4-clear' },
          s('ellipse', { class: 't31f4-clearw', cx: f1(x), cy: f1(y + ry * 0.14), rx: f1(bw * 0.84), ry: f1(ry * 0.66) }),
          s('ellipse', { class: 't31f4-moonr', cx: f1(x + bw * 0.24), cy: f1(y + ry * 0.05), rx: f1(bw * 0.15), ry: f1(ry * 0.2) }),
          s('path', { class: 't31f4-glint', d: stroke([[x + bw * 0.08, y + ry * 0.3], [x + bw * 0.4, y + ry * 0.28]], Math.max(0.8, bw * 0.02), 0.3, 0.3, 0.1) })),
        s('ellipse', { class: 't31f4-aim', cx: f1(x), cy: f1(y), rx: f1(bw * 1.08), ry: f1(ry * 1.3) }),
        lip(b.out),
        s('path', { class: 'g11-moonlit', d: stroke(Array.from({ length: 9 }, (_, k) => { const a = Math.PI * (1.08 + k * 0.06); return [x + Math.cos(a) * bw * 0.98, y + Math.sin(a) * ry * 0.98] as Pt }), Math.max(1.2, bw * 0.05), 0.2, 0.3, 0.2) }),
        placed, deb)
      if (done[i]) deb.classList.add('caught')
      basinG.push(bg)
      debG.push(deb)
      parts.push(bg)
      if (i === 0) parts.push(mist(x + bw * 0.4, pedY - pedH * 0.3, bw * 2.6, bw * 0.35))
      // its fall: from the spill notch out over the side, into the next basin (or the bowl)
      const nx = basins[i + 1] ?? bowl
      // it lands on the near side of the next water, but always a little beyond the lip it leaves (never bending back)
      const lipX = x + b.out * bw * 0.93
      let tx = nx.x - b.out * nx.bw * (nx === bowl ? 0.3 : 0.2)
      if ((tx - lipX) * b.out < bw * 0.15) tx = lipX + b.out * bw * 0.15
      const to: Pt = [clamp(tx, nx.x - nx.bw * 0.75, nx.x + nx.bw * 0.75), nx.y + nx.bw * 0.07]
      const f = fall([lipX, y + ry * 0.05], to, (tall ? 2.4 : 3.5) + bw * 0.08, b.out * bw * (tall ? 0.18 : 0.3), 3270 + i)
      f.g.classList.add('t31f4-fall')
      if (done[i]) f.g.classList.add('clear')
      falls.push(f.g)
    })
    // the bowl, and three drops on its lip: the count, murky until each basin runs clear
    parts.push(moonBowl(bowl.x, bowl.y, bowl.bw, 3280, (bowl.x - mx) / W))
    for (let i = 0; i < n; i++) {
      // a bead of water resting on the front of the rim
      const a = Math.PI * (0.64 - i * 0.14)
      const dx = bowl.x + Math.cos(a) * bowl.bw * 0.99, dy = bowl.y + Math.sin(a) * bowl.bw * 0.24
      const rr = Math.max(4, bowl.bw * 0.055)
      const d = s('g', { class: `t31f4-drop${done[i] ? ' on' : ''}` },
        s('ellipse', { class: 't31f4-drop-b', cx: f1(dx), cy: f1(dy - rr * 0.55), rx: f1(rr), ry: f1(rr * 0.82) }),
        s('ellipse', { class: 't31f4-drop-hi', cx: f1(dx - rr * 0.32), cy: f1(dy - rr * 0.85), rx: f1(rr * 0.3), ry: f1(rr * 0.22) }))
      drops.push(d)
      parts.push(d)
    }
    parts.push(...falls)
    // the near frame: dark grass in the bottom corners
    parts.push(grass(W * 0.03, H * 0.995, tall ? 40 : 90, 3290), grass(W * 0.98, H * 0.995, tall ? 34 : 70, 3291), grass(W * 0.5, H, tall ? 20 : 40, 3292))
    svg.replaceChildren(...parts)
  }

  // ── HTML on top: captions by the basins, invisible basin targets, the filter baskets, the folded take-away
  function layout() {
    const W = root.clientWidth, H = root.clientHeight
    if (W < 80 || H < 80) return
    const g = (G = geo(W, H))
    root.classList.toggle('tall', g.tall)
    paint(g)
    g.basins.forEach((b, i) => {
      const c = g.caps[i]
      Object.assign(caps[i].style, { width: `${f1(c.w)}px`, transform: `translate(${f1(c.end ? c.x - c.w : c.x)}px, ${f1(c.y)}px)`, textAlign: c.end ? 'right' : 'left' })
      Object.assign(zones[i].style, { width: `${f1(b.bw * 2.2)}px`, height: `${f1(Math.max(44, b.bw * 1.3))}px`, transform: `translate(${f1(b.x - b.bw * 1.1)}px, ${f1(b.y - b.bw * 0.5)}px)` })
    })
    filters.forEach((el, k) => {
      const f = g.filters[k]
      Object.assign(el.style, { width: `${f1(f.w)}px`, transform: `translate(${f1(f.x - f.w / 2)}px, ${f1(f.y - f.w * 0.42)}px)` })
    })
    slipBox.style.transform = `translate(${f1(g.slip[0])}px, ${f1(g.slip[1])}px) translate(-50%, -50%)`
    gd.refresh()
  }
  const gd = guide(ctx)
  ctx.onCleanup(onSize(root, layout))

  // ── the logic
  const dots: (Mark | null)[] = filters.map((el) => gd.dot(el, { dir: [0.8, -0.6] }))
  const remaining = () => done.filter((d) => !d).length
  function pick(k: number) {
    sel = sel === k ? -1 : k
    filters.forEach((el, j) => {
      el.classList.toggle('sel', j === sel)
      el.setAttribute('aria-pressed', String(j === sel))
    })
    root.classList.toggle('aiming', sel >= 0)
    if (sel >= 0) ctx.prompt(fill(K.picked, { label: K.filters[sel].label }))
  }
  function home(el: HTMLElement, from: string) {
    el.style.translate = ''
    if (!ctx.reduced && from) el.animate([{ translate: from }, { translate: '0px 0px' }], { duration: 520, easing: 'cubic-bezier(.2,.7,.2,1)' })
  }
  let capTimer = 0
  function attempt(k: number, i: number, from = '') {
    const el = filters[k]
    if (done[i] || el.hidden || !G) return home(el, from)
    const ok = K.filters[k].blocks === K.debris[i].id
    pick(-1)
    root.classList.remove('aiming')
    if (!ok) {
      ctx.chime('low')
      home(el, from)
      // say why right beside that basin, then give the caption back
      clearTimeout(capTimer)
      caps.forEach((c, j) => (c.textContent = K.debris[j].label, c.classList.remove('bad')))
      caps[i].textContent = K.wrong
      caps[i].classList.add('bad')
      capTimer = window.setTimeout(() => (caps[i].textContent = K.debris[i].label, caps[i].classList.remove('bad')), 2800)
      timers.push(capTimer)
      say.say(K.wrong)
      gd.wrong(K.wrong, basinG[i])
      return
    }
    done[i] = true
    dots[k]?.done()
    dots[k] = null
    ctx.chime('tap')
    const b = G.basins[i], f = G.filters[k]
    const settle = () => {
      el.hidden = true
      el.style.translate = ''
      if (G) paint(G) // the basket now sits on that lip, the dirt in it, the water and its fall clear
      requestAnimationFrame(() => debG[i]?.classList.add('caught'))
      caps[i].classList.add('stopped')
      zones[i].setAttribute('aria-disabled', 'true')
      const left = remaining()
      say.say(`${K.right} ${fill(K.count, { n: n - left, total: n })}`)
      if (left) return ctx.prompt(K.left[left])
      root.classList.add('done')
      say.say(K.done)
      ctx.insight(K.insight as Fact, [K.detail as Fact, K.note])
      const card = findTakeaway(K.takeaway)
      if (card && !slipBox.childElementCount) slipBox.append(foldedTakeaway([card], ctx.onCleanup))
      slipBox.hidden = false
    }
    if (ctx.reduced) return settle()
    // the basket flies from where it is onto the basin's lip, shrinking to that basin's distance
    const tx = b.x - f.x, ty = b.y - b.bw * 0.1 - (f.y - f.w * 0.0)
    const a = el.animate([{ translate: from || '0px 0px', scale: '1' }, { translate: `${f1(tx)}px ${f1(ty)}px`, scale: (b.bw * 1.24 / f.w).toFixed(3) }], { duration: 480, easing: 'cubic-bezier(.3,.6,.2,1)', fill: 'forwards' })
    a.onfinish = () => { a.cancel(); settle() }
  }

  // drag a basket (pointer), or tap it then a basin; keys 1–3 on a basket set it in that basin
  const basinAt = (x: number, y: number) => {
    let best = -1
    G?.basins.forEach((b, i) => {
      const q = ((x - b.x) / (b.bw * 1.25)) ** 2 + ((y - b.y) / (b.bw * 0.95)) ** 2
      if (q < 1 && !done[i]) best = i
    })
    return best
  }
  filters.forEach((el, k) => {
    let drag: { id: number; x0: number; y0: number; moved: boolean; hot: number } | null = null
    el.addEventListener('pointerdown', (e) => {
      if (e.button || !G) return
      el.setPointerCapture(e.pointerId)
      drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, hot: -1 }
    })
    el.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id || !G) return
      const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0
      if (!drag.moved && Math.hypot(dx, dy) < 6) return
      if (!drag.moved) (drag.moved = true), el.classList.add('drag'), root.classList.add('aiming')
      el.style.translate = `${f1(dx)}px ${f1(dy)}px`
      const f = G.filters[k]
      const hot = basinAt(f.x + dx, f.y + dy)
      if (hot !== drag.hot) {
        basinG[drag.hot]?.classList.remove('hot')
        basinG[hot]?.classList.add('hot')
        drag.hot = hot
      }
    })
    const end = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return
      const d = drag
      drag = null
      el.classList.remove('drag')
      basinG[d.hot]?.classList.remove('hot')
      if (!d.moved) return
      el.dataset.dragged = '1' // swallow the click that follows a drag
      const from = el.style.translate
      if (d.hot >= 0) return attempt(k, d.hot, from)
      root.classList.toggle('aiming', sel >= 0)
      home(el, from)
    }
    el.addEventListener('pointerup', end)
    el.addEventListener('pointercancel', end)
    el.addEventListener('click', () => {
      if (el.dataset.dragged) return void delete el.dataset.dragged
      pick(k)
    })
    el.addEventListener('keydown', (e) => {
      const i = { '1': 0, '2': 1, '3': 2 }[e.key]
      if (i == null) return
      e.preventDefault()
      attempt(k, i)
    })
  })
  const onKey = (e: KeyboardEvent) => e.key === 'Escape' && sel >= 0 && pick(sel)
  root.addEventListener('keydown', onKey)
  // H7: after 6 s still, the dirt in the murky basins stirs (the frame also brings the prompt back)
  const idle = () => {
    if (ctx.reduced || root.classList.contains('done')) return
    root.classList.add('stir')
    timers.push(window.setTimeout(() => root.classList.remove('stir'), 2600))
  }
  ctx.el.addEventListener('p2:idle', idle)
  ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', idle))
  ctx.prompt(K.prompt)
}
