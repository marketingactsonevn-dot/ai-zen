import { s, viDate } from '../../core/dom'
import { L, type Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { blob, clamp, curve, rng, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist, moon } from '../../ui/part2/paint'
import { progressTide, type TideGeo } from '../../ui/part2/tide'
import type { Tide } from '../../ui/part2/types'
import { C } from './data'
import { guide } from '../../ui/part2/guide'
import { figure } from './brush'

const G = C.scenes.goldrush
const T = G.tide as Tide
const f1 = (n: number) => n.toFixed(1)
const P = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`
// how many lantern-carrying diggers are on the ridge at each stop (the last one = today)
const CROWD = [8, 16, 30, 44, 58] // a few already climbing at the first stop (audit v3 28-4)
const CMP = T.milestones.find((m) => m.compare)!
/** the stop whose fact is the small mound (the year before the rush) */
const FY23 = Math.max(0, T.milestones.findIndex((m) => m.date.startsWith('2023')))

/** One shovel along p → q: a wooden handle with a D-grip at p, the blade at q. */
function shovel(p: Pt, q: Pt, k: number): string {
  const L0 = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1
  const ux = (q[0] - p[0]) / L0, uy = (q[1] - p[1]) / L0
  const nx = -uy, ny = ux
  const bw = k * 0.32, bl = k * 0.42
  const b0: Pt = [q[0] - ux * bl * 0.1, q[1] - uy * bl * 0.1]
  const tip: Pt = [q[0] + ux * bl, q[1] + uy * bl]
  const blade = `M${P([b0[0] + nx * bw * 0.5, b0[1] + ny * bw * 0.5])}L${P([b0[0] + nx * bw * 0.5 + ux * bl * 0.7, b0[1] + ny * bw * 0.5 + uy * bl * 0.7])}Q${P([tip[0] + nx * bw * 0.2, tip[1] + ny * bw * 0.2])} ${P(tip)}Q${P([tip[0] - nx * bw * 0.2, tip[1] - ny * bw * 0.2])} ${P([b0[0] - nx * bw * 0.5 + ux * bl * 0.7, b0[1] - ny * bw * 0.5 + uy * bl * 0.7])}L${P([b0[0] - nx * bw * 0.5, b0[1] - ny * bw * 0.5])}Z`
  const grip = stroke(curve([p[0] + nx * k * 0.1, p[1] + ny * k * 0.1], [p[0] - ux * k * 0.16, p[1] - uy * k * 0.16], [p[0] - nx * k * 0.1, p[1] - ny * k * 0.1], 6), Math.max(0.9, k * 0.05), 0.1, 0.1, 0.5)
  return stroke([p, q], Math.max(1, k * 0.06), 0.05, 0.05, 0.7) + grip + blade
}

/**
 * A mound of gold, base w on (x, y), hh tall: a lumpy dome, its left side lit warm by the seller's lantern, its right in
 * shadow, small nuggets catching the light along the lit flank (not sparkles: lumps).
 */
function heap(x: number, y: number, w: number, hh: number, seed: number): SVGElement[] {
  const r = rng(seed)
  const top: Pt[] = []
  for (let j = 0; j <= 20; j++) {
    const u = j / 20
    const k = Math.pow(Math.sin(u * Math.PI), 0.7)
    top.push([x - w / 2 + w * u, y - hh * k * (0.94 + (j % 3 ? 0 : r() * 0.08))])
  }
  const body = `M${P([x - w / 2, y])}L${top.map(P).join('L')}L${P([x + w / 2, y])}Z`
  // the shadow side: from the crown down the right flank
  const crown = top[10]
  const shade = `M${P([crown[0] + w * 0.04, crown[1]])}L${top.slice(11).map(P).join('L')}L${P([x + w / 2, y])}L${P([x + w * 0.08, y])}Q${P([x + w * 0.02, y - hh * 0.5])} ${P([crown[0] + w * 0.04, crown[1]])}Z`
  let lumps = '', lit = ''
  const n = Math.max(4, Math.round(w / 9))
  for (let i = 0; i < n; i++) {
    const u = 0.12 + r() * 0.76, k = Math.pow(Math.sin(u * Math.PI), 0.7) * (0.1 + r() * 0.8)
    const gx = x - w / 2 + w * u, gy = y - hh * k, gr = Math.max(1.2, Math.min(w, hh) * (0.025 + r() * 0.03))
    lumps += blob(gx, gy, gr * 1.2, gr, seed + i, 0.2, 7)
    if (u < 0.55) lit += blob(gx - gr * 0.3, gy - gr * 0.35, gr * 0.45, gr * 0.3, seed + 50 + i, 0.2, 6)
  }
  return [
    s('ellipse', { class: 't28r-heap-sh', cx: f1(x + w * 0.12), cy: f1(y + 1), rx: f1(w * 0.62), ry: f1(Math.max(2, hh * 0.06)) }),
    s('path', { class: 't28r-heap', d: body, filter: 'url(#ink-rough)' }),
    s('path', { class: 't28r-heap-dark', d: shade }),
    s('path', { class: 't28r-heap-lump', d: lumps }),
    s('path', { class: 't28r-heap-lit', d: lit }),
    s('path', { class: 't28r-heap-rim', d: stroke(top.slice(2, 12), Math.max(1, w * 0.012), 0.2, 0.3, 0.2) }),
  ]
}

/**
 * Mùa đào vàng (art direction §4 t28 `goldrush`, comp/2.5D): a long black ridge cut from paper across the lower half,
 * running out past both sides of the frame, a giant moon behind it — the slider itself — sliding along a low arc through
 * the seasons. A lamp post rises on the ridge at each milestone with its date on a board; the milestone's words hang on a
 * wooden sign staked below it; diggers with lanterns crowd up toward the shovel seller's shed on the summit; beside the
 * shed two mounds of gold stand on one ledge in true proportion, 15.0 : 193.7, each with its number on it.
 */
export function goldrushScene(ctx: SceneCtx) {
  ctx.art.classList.add('t28r')
  ctx.onCleanup(() => ctx.art.classList.remove('t28r'))
  const n = T.milestones.length
  const far = s('svg', { class: 't28r-far', 'aria-hidden': 'true' })
  const front = s('svg', { class: 't28r-front', 'aria-hidden': 'true' })
  let crowd: SVGGElement[] = [], posts: SVGGElement[] = []
  let at = -1
  // where the band sits in the frame (band px → frame px), and the frame (read once per layout, in `track`)
  const fr = { bx: 0, by: 0, W: 1, H: 1, xs: [] as number[], ry: [] as number[] }

  function onStep(i: number) {
    if (i === at) return
    at = i
    crowd.forEach((g, k) => g.classList.toggle('on', k < CROWD[Math.min(i, CROWD.length - 1)]))
    posts.forEach((g, k) => (g.classList.toggle('up', k <= i), g.classList.toggle('here', k === i)))
    front.classList.toggle('gold-1', i >= FY23)
    front.classList.toggle('gold-2', i >= T.milestones.indexOf(CMP))
    front.classList.toggle('today', i >= n)
    // the milestone's words hang on a sign staked into the ridge below its post (the reading card, restyled)
    if (fr.xs.length) {
      const bw = Math.min(330, fr.W * 0.84)
      const x = clamp(fr.bx + fr.xs[i], bw / 2 + 8, fr.W - bw / 2 - 8)
      ctx.art.style.setProperty('--t28r-cx', `${f1(x)}px`)
      ctx.art.style.setProperty('--t28r-cy', `${f1(fr.by + fr.ry[i] + 18)}px`)
      ctx.art.style.setProperty('--t28r-cw', `${f1(bw)}px`)
      ctx.art.style.setProperty('--t28r-stake', `${f1(fr.bx + fr.xs[i] - (x - bw / 2))}px`)
    }
  }

  /** the ridge's top: low on the left, climbing to the seller's summit (a flat ledge for the shed and the gold), then
   *  falling into the mist; it runs on past both sides of the frame */
  // the shed stands at today's stop: it is today's post (no lamp post of its own there)
  const summit = (g: TideGeo) => g.xs[n] - Math.min(g.h, g.w * 0.5) * 0.05
  const ridgeY = (g: TideGeo, x: number) => {
    const sx = summit(g), u0 = Math.min(g.h, g.w * 0.5)
    const lo = g.ground + g.h * 0.36, hi = g.ground + g.h * 0.12 // low in the frame: the moon stands tall behind it
    const ledge = sx + u0 * 0.62 // the ledge ends past the big mound
    if (x <= sx) {
      const u = clamp((x - g.xs[0] * 0.3) / (sx - g.xs[0] * 0.3), 0, 1)
      return lo + (hi - lo) * (u * u * (3 - 2 * u)) + Math.sin(x * 0.045) * g.h * 0.012
    }
    if (x <= ledge) return hi
    const u = Math.min(1, (x - ledge) / Math.max(40, g.w - ledge + 80))
    return hi + (lo - hi) * 0.7 * u * u
  }

  function back(g: TideGeo): SVGElement[] {
    const { w, h, ground, xs, seed } = g
    const r = rng(seed + 5)
    const band = ctx.art.querySelector('.p2t-band')
    if (band && front.parentNode !== band) band.prepend(far), band.append(front)
    // the frame in band px: everything below runs out to the frame's edges (the band is just where the slider lives)
    const X0 = -fr.bx - 4, X1 = fr.W - fr.bx + 4, Y1 = fr.H - fr.by + 4
    for (const v of [far, front]) v.setAttribute('viewBox', `0 0 ${f1(w)} ${f1(h)}`)
    fr.xs = xs
    fr.ry = xs.map((x) => ridgeY(g, x))
    const sx = summit(g), sy = ridgeY(g, sx)
    const u = Math.min(h, w * 0.5) // narrow scrolls get a smaller summit
    const top: Pt[] = []
    for (let x = X0; x <= X1; x += 6) top.push([x, ridgeY(g, x)])
    top.push([X1, ridgeY(g, X1)])
    const ridge = `M${f1(X0)} ${f1(Y1)}L${top.map(P).join('L')}L${f1(X1)} ${f1(Y1)}Z`
    const gid = `t28r-rg-${seed}`
    // ── behind the moon (far): mist, two ink ranges, full width
    far.replaceChildren(
      mist(w * 0.5, ground - h * 0.4, (X1 - X0) * 0.6, h * 0.5),
      hills(X0, X1, ground + h * 0.2, h * 0.46, seed + 1, 0.92, Math.max(4, Math.round((X1 - X0) / 220))),
      hills(X0 + (X1 - X0) * 0.15, X1 - (X1 - X0) * 0.1, ground + h * 0.26, h * 0.32, seed + 2, 0.7, 3),
      mist(w * 0.5, ground + h * 0.24, (X1 - X0) * 0.6, h * 0.12))
    // ── the shed on the summit: two poles, a sagging canvas, shovels for sale, the seller, his lantern
    const tw = u * 0.24, th = tw * 0.82, tx = sx, tg = sy + 1
    const roof = `M${P([tx - tw * 0.62, tg - th * 0.6])}Q${P([tx, tg - th * 0.5])} ${P([tx + tw * 0.62, tg - th * 0.64])}L${P([tx + tw * 0.32, tg - th])}Q${P([tx, tg - th * 1.04])} ${P([tx - tw * 0.34, tg - th * 0.97])}Z`
    let wares = ''
    for (let i = 0; i < 4; i++) {
      const x = tx + tw * (0.36 + i * 0.07)
      wares += shovel([x - th * 0.1, tg - th * (0.62 - i * 0.02)], [x + th * 0.06, tg - th * 0.12], th * 0.36)
    }
    const poles = stroke([[tx - tw * 0.55, tg], [tx - tw * 0.55, tg - th * 0.6]], Math.max(1.4, tw * 0.025), 0.05, 0.1, 0.6) + stroke([[tx + tw * 0.55, tg], [tx + tw * 0.55, tg - th * 0.64]], Math.max(1.4, tw * 0.025), 0.05, 0.1, 0.6)
    // ── the gold, in true proportion (FY2023 · FY2026 data-centre revenue) on one ledge right of the shed
    const hb = u * 0.42, hs = (hb * 15.0) / 193.7
    const wb = u * 0.42, ws = Math.max(14, u * 0.07)
    // room right of the shed: both mounds there; else (a phone) the big one rises behind the shed, the small at its door
    const narrow = X1 - 8 - (tx + tw * 0.62) < ws + wb + u * 0.05 + 12
    const smx = narrow ? tx - tw * 0.72 - ws / 2 : tx + tw * 0.75 + ws / 2 + 4
    const bx = narrow ? Math.min(tx + tw * 0.4, X1 - wb / 2 - 8) : Math.min(smx + ws / 2 + u * 0.05 + wb / 2, X1 - wb / 2 - 8)
    const amt = (x: number, y: number, v: string, lab: string | undefined, anchor: string) =>
      s('text', { class: 't28r-amt', x: f1(x), y: f1(y), 'text-anchor': anchor },
        s('tspan', { x: f1(x), dy: 0 }, v), lab ? s('tspan', { class: 't28r-amt-l', x: f1(x), dy: '1.25em' }, lab) : null)
    // ── the comparison, carved on a wooden sign staked by the shed (left of it, clear of both mounds)
    const sgW = Math.max(96, (CMP.label.length + 2) * 7.2), sgH = 24
    const right = X1 - (bx + wb / 2) > sgW + 24
    const sgx = right ? bx + wb / 2 + 12 + sgW / 2 : tx, sgy = right ? tg - th * 0.95 : tg - th * 1.05 - sgH - 20
    const sign = s('g', { class: 't28r-sign' },
      s('path', { class: 't28r-pole', d: stroke([[sgx + sgW * 0.3, right ? tg + 2 : sgy + sgH + 14], [sgx + sgW * 0.3, sgy + sgH]], Math.max(1.4, h * 0.006), 0.05, 0.1, 0.6) + stroke([[sgx - sgW * 0.3, right ? tg + 2 : sgy + sgH + 14], [sgx - sgW * 0.3, sgy + sgH]], Math.max(1.4, h * 0.006), 0.05, 0.1, 0.6) }),
      s('rect', { class: 't28r-plank', x: f1(sgx - sgW / 2), y: f1(sgy), width: f1(sgW), height: sgH, rx: 2 }),
      s('text', { class: 't28r-carved', x: f1(sgx), y: f1(sgy + 16.5), 'text-anchor': 'middle' }, CMP.label))
    // ── a lamp post at each stop, its date on a board hung from the arm (alternate heights when the stops are close)
    const ph = h * 0.19
    const tight = xs[1] - xs[0] < 84
    front.classList.toggle('tight', tight) // close stops: only the board of the post the moon is at
    posts = xs.slice(0, n).map((x, i) => {
      const y = ridgeY(g, x) + 1
      const date = i < n ? viDate(T.milestones[i].date) : L.today
      const lift = 0
      const bwid = date.length * 6.6 + 12, by0 = -ph * 0.86 - lift
      return s('g', { class: `t28r-post${i === n ? ' t28r-now' : ''}`, transform: `translate(${f1(x)} ${f1(y)})` },
        s('circle', { class: 't28r-glow', cx: 0, cy: f1(-ph - lift), r: f1(ph * 0.55), fill: 'url(#p2-lamp)' }),
        s('path', { class: 't28r-pole', d: stroke([[0, 0], [0.5, -(ph + lift) * 0.5], [0, -ph - lift]], Math.max(1.6, h * 0.007), 0.05, 0.1, 0.6) + stroke([[0, -(ph + lift) * 0.92], [ph * 0.22, -(ph + lift) * 0.93]], Math.max(1.2, h * 0.005), 0.1, 0.1, 0.6) }),
        s('rect', { class: 't28r-lamp', x: f1(-ph * 0.07), y: f1(-ph * 1.1 - lift), width: f1(ph * 0.14), height: f1(ph * 0.18), rx: f1(ph * 0.05) }),
        s('g', { class: 't28r-board' },
          s('path', { class: 't28r-cord', d: `M${f1(-bwid * 0.3)} ${f1(by0 - 4)}L0 ${f1(by0 - 12)}L${f1(bwid * 0.3)} ${f1(by0 - 4)}` }),
          s('rect', { class: 't28r-plank', x: f1(-bwid / 2), y: f1(by0 - 4), width: f1(bwid), height: 17, rx: 2 }),
          s('text', { class: 't28r-date', x: 0, y: f1(by0 + 8.5), 'text-anchor': 'middle' }, date)))
    })
    // ── diggers with lanterns up the slope toward the summit: near ones lower on the ridge's face and larger, far ones on
    // its crest and small; each lantern glows (a few more come at each stop)
    const nMax = CROWD[CROWD.length - 1]
    const spots = Array.from({ length: nMax }, () => ({ x: xs[0] * 0.5 + r() * (sx - tw * 0.8 - xs[0] * 0.5), d: r() })).sort((a, b) => b.x - a.x)
    crowd = spots.map(({ x, d }, k) => {
      const y = ridgeY(g, x) + 1.5 + d * d * h * 0.07
      const fh = u * (0.042 + d * 0.035)
      const lx = x + fh * 0.32, ly = y - fh * 0.5
      return s('g', { class: `t28r-digger${d < 0.35 ? ' far' : ''}`, style: `transition-delay:${(k % 7) * 60}ms` },
        s('circle', { class: 't28r-lglow', cx: f1(lx), cy: f1(ly), r: f1(fh * 0.55), fill: 'url(#p2-lamp)' }),
        s('path', { class: 't28r-fig', d: figure(x, y, fh, seed + 20 + k, 1, { hat: k % 3 ? 'cone' : 'cap', stoop: 0.3 }) + stroke([[x - fh * 0.1, y - fh * 0.55], [lx, ly - fh * 0.3]], Math.max(0.8, fh * 0.05), 0.1, 0.1, 0.5) }),
        s('circle', { class: 't28r-dot', cx: f1(lx), cy: f1(ly), r: f1(Math.max(1.4, fh * 0.075)) }))
    })
    const mid = `t28r-sides-${seed}`
    const sides = (id: string) => s('mask', { id, maskUnits: 'userSpaceOnUse', x: f1(X0), y: f1(-fr.by - 4), width: f1(X1 - X0), height: f1(Y1 + fr.by + 8) },
      s('linearGradient', { id: `${id}-g`, x1: f1(X0), x2: f1(X1), y1: 0, y2: 0, gradientUnits: 'userSpaceOnUse' },
        s('stop', { offset: 0, 'stop-color': '#000' }), s('stop', { offset: 0.07, 'stop-color': '#fff' }), s('stop', { offset: 0.93, 'stop-color': '#fff' }), s('stop', { offset: 1, 'stop-color': '#000' })),
      s('rect', { x: f1(X0), y: f1(-fr.by - 4), width: f1(X1 - X0), height: f1(Y1 + fr.by + 8), fill: `url(#${id}-g)` }))
    far.replaceChildren(s('defs', null, sides(`${mid}-f`)), s('g', { mask: `url(#${mid}-f)` }, ...Array.from(far.childNodes) as SVGElement[]))
    const bodyEnd = sy + (Y1 - sy) * 0.62
    front.replaceChildren(
      s('defs', null, sides(mid), s('linearGradient', { id: gid, x1: 0, x2: 0, y1: f1(sy - h * 0.1), y2: f1(bodyEnd), gradientUnits: 'userSpaceOnUse' },
        s('stop', { offset: 0, class: 't28r-rg0' }), s('stop', { offset: 0.42, class: 't28r-rg1' }), s('stop', { offset: 1, class: 't28r-rg2' }))),
      s('g', { mask: `url(#${mid})` },
        s('path', { class: 't28r-ridge', d: ridge, fill: `url(#${gid})`, filter: 'url(#ink-rough)' }),
        s('path', { class: 't28r-rim', d: stroke(top.map((p) => [p[0], p[1] + 0.8] as Pt), Math.max(1.4, h * 0.006), 0.02, 0.02, 0.4) })),
      s('g', { class: 't28r-gold t28r-gold-big' }, ...heap(bx, sy + 1, wb, hb, seed + 3)),
      s('g', { class: 't28r-tent' },
        s('path', { class: 't28r-sil', d: poles + wares, filter: 'url(#ink-rough)' }),
        s('path', { class: 't28r-sil', d: figure(tx - tw * 0.1, tg, th * 0.5, seed + 3, 1, { hat: 'cap', stoop: 0.1 }) }),
        s('path', { class: 't28r-canvas', d: roof, filter: 'url(#ink-rough)' }),
        s('circle', { class: 't28r-glow', cx: f1(tx - tw * 0.5), cy: f1(tg - th * 0.55), r: f1(tw * 0.4), fill: 'url(#p2-lamp)' }),
        s('rect', { class: 't28r-lamp', x: f1(tx - tw * 0.53), y: f1(tg - th * 0.6), width: f1(tw * 0.07), height: f1(tw * 0.09), rx: 2 })),
      s('g', { class: 't28r-gold t28r-gold-small' }, ...heap(smx, sy + 1, ws, hs, seed + 4)),
      ...posts, ...crowd,
      // who is who, said once where they stand: the diggers are the AI companies, the shed sells the shovels (chips)
      s('text', { class: 't28r-amt t28r-who', x: f1(xs[0] * 0.5 + (sx - tw * 0.8 - xs[0] * 0.5) * 0.42), y: f1(ridgeY(g, xs[0] * 0.5 + (sx - tw * 0.8 - xs[0] * 0.5) * 0.42) + h * 0.14), 'text-anchor': 'middle' }, G.crowd),
      s('text', { class: 't28r-amt t28r-who', x: f1(tx), y: f1(tg - th * 1.04 - 5), 'text-anchor': 'middle' }, G.seller), // over the roof, under the sign
      // the numbers on their mounds (a narrow frame: the big one above its mound, the small one beside its own, to the left)
      s('g', { class: 't28r-amts' },
        narrow ? amt(smx - ws / 2 - 6, sy - hs - 4, CMP.compare!.before, CMP.compare!.beforeLabel, 'end') : amt(smx, sy - hs - 24, CMP.compare!.before, CMP.compare!.beforeLabel, 'middle'),
        amt(bx, narrow ? sy - hb - 26 : sy - hb * 0.52, CMP.compare!.after, CMP.compare!.afterLabel, 'middle')),
      // (on a tight frame no room for the sign: the hanging board under the post already carries the comparison's words)
      ...(tight ? [] : [sign]))
    if (at >= 0) {
      const i = at
      at = -1
      onStep(i)
    }
    return [] // everything is in `far` and `front`: the band's own paper clip would cut the frame-wide ridge
  }

  const done = progressTide(T, {
    label: G.label, prompt: G.prompt, insight: G.insight as Fact, detail: G.detail as Fact, aria: G.sliderAria,
    art: { back, mark: () => s('g') },
    // the moon slides on a low arc behind the ridge (about 40 % of the frame tall), a little higher mid-seasons
    track: (g) => {
      // one read per layout, after the tide's writes: where the band sits in the frame
      const band = ctx.art.querySelector<HTMLElement>('.p2t-band')
      fr.bx = band?.offsetLeft ?? 0
      fr.by = band?.offsetTop ?? 0
      fr.W = ctx.art.clientWidth
      fr.H = ctx.art.clientHeight
      ctx.art.style.setProperty('--t28-moon', `${f1(Math.min(fr.H * 0.5, fr.W * 0.8))}px`) // the disc is 0.8 of it: ~40 % of the frame
      return (t) => [g.xs[0] + (g.xs[n] - g.xs[0]) * t, g.ground + g.h * 0.06 - Math.sin(t * Math.PI) * g.h * 0.07]
    },
    thumb: () => moon(0, 0, 20, 2851, true),
    onStep: (i) => onStep(i),
  }).mount(ctx)
  // guide: a dot on the moon (it leans toward the next post when idle)
  const m = ctx.art.querySelector<HTMLElement>('.p2t-moon')
  if (m) guide(ctx).dot(m, { dir: [1, 0] })
  return done
}
