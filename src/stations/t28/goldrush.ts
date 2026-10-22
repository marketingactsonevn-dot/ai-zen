import { s, viDate } from '../../core/dom'
import { type Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { blob, clamp, curve, rng, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist } from '../../ui/part2/paint'
import { moon } from '../../ui/part2/paint'
import { progressTide, type TideGeo } from '../../ui/part2/tide'
import type { Tide } from '../../ui/part2/types'
import { C } from './data'
import { guide } from '../../ui/part2/guide'
import { figure } from './brush'

const G = C.scenes.goldrush
const T = G.tide as Tide
const f1 = (n: number) => n.toFixed(1)
const P = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`
// how many lantern-carrying diggers are on the ridge at each stop (the last one = today); a few climb from the start
const CROWD = [8, 16, 30, 44, 58]
const CMP = T.milestones.find((m) => m.compare)!
/** the stop whose fact is the small mound (the year before the rush) */
const FY23 = Math.max(0, T.milestones.findIndex((m) => m.date.startsWith('2023')))
const smooth = (u: number) => u * u * (3 - 2 * u)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

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
 * shadow, small nuggets catching the light along the lit flank (lumps, not sparkles).
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
    s('ellipse', { class: 't28r-heap-sh', cx: f1(x + w * 0.16), cy: f1(y + 1.5), rx: f1(w * 0.64), ry: f1(Math.max(2.5, hh * 0.05)) }),
    s('path', { class: 't28r-heap', d: body, filter: 'url(#ink-rough)' }),
    s('path', { class: 't28r-heap-dark', d: shade }),
    s('path', { class: 't28r-heap-lump', d: lumps }),
    s('path', { class: 't28r-heap-lit', d: lit }),
    s('path', { class: 't28r-heap-rim', d: stroke(top.slice(2, 12), Math.max(1, w * 0.012), 0.2, 0.3, 0.2) }),
  ]
}

/** A plank hung from two cords, `w` × `hh`, top centre at (0, 0): wood with grain, the date burnt in (carved: dark
 *  stroke, a lit lip below). No frame: the board is a piece of wood, not a tag. */
function board(text: string, w: number, hh: number, seed: number, cls: string): SVGGElement {
  const r = rng(seed)
  const y0 = 7, y1 = y0 + hh
  const d = `M${f1(-w / 2)} ${f1(y0 + 1)}Q${f1(-w * 0.1)} ${f1(y0 - 0.6 + r())} ${f1(w / 2)} ${f1(y0 + 0.4)}L${f1(w / 2 - 0.6)} ${f1(y1 - 0.5)}Q${f1(w * 0.1)} ${f1(y1 + 0.8)} ${f1(-w / 2 + 0.4)} ${f1(y1)}Z`
  let grain = ''
  for (let k = 0; k < 3; k++) {
    const y = y0 + hh * (0.24 + k * 0.27) + (r() - 0.5)
    grain += stroke([[-w * 0.44, y], [-w * 0.1, y + (r() - 0.5) * 1.2], [w * 0.42, y + (r() - 0.5)]], 0.7, 0.3, 0.3, 0.2)
  }
  return s('g', { class: `t28r-board ${cls}` },
    s('path', { class: 't28r-cord', d: `M${f1(-w * 0.32)} ${f1(y0 + 1)}L0 0L${f1(w * 0.32)} ${f1(y0 + 1)}` }),
    s('path', { class: 't28r-wood', d }),
    s('path', { class: 't28r-grain', d: grain }),
    s('text', { class: 't28r-burnt-lo', x: 0, y: f1(y0 + hh * 0.7 + 0.8), 'text-anchor': 'middle' }, text),
    s('text', { class: 't28r-burnt', x: 0, y: f1(y0 + hh * 0.7), 'text-anchor': 'middle' }, text))
}

/**
 * Mùa đào vàng (art direction §4 t28 `goldrush`, comp/2.5D; audit v3 28-4). The band is the whole picture: a far range
 * in the mist, a giant moon — the slider — rising from behind the ridge at the left third toward the seller's summit at
 * the right third, a black ridge cut from paper climbing across the frame with grass on its crest and old adits glowing
 * in its face. A lamp post stands on the crest at each stop, a rope of small lanterns strung from post to post (the
 * moon's road: it lights as the moon passes), the date burnt into a plank hung from each post's arm. Diggers with
 * lanterns (the AI companies) crowd up the crest; on the summit ledge the two mounds of gold stand left of the shovel
 * seller's shed in true proportion (15.0 : 193.7), the big one in front of the moon's last stop. Names and amounts are
 * cut into the ridge's face; the milestone's words lie in the mist under the ridge (no card).
 */
export function goldrushScene(ctx: SceneCtx) {
  ctx.art.classList.add('t28r')
  ctx.onCleanup(() => ctx.art.classList.remove('t28r'))
  const n = T.milestones.length
  const far = s('svg', { class: 't28r-far', 'aria-hidden': 'true' })
  const mid = s('svg', { class: 't28r-mid', 'aria-hidden': 'true' })
  const front = s('svg', { class: 't28r-front', 'aria-hidden': 'true' })
  let crowd: SVGGElement[] = [], posts: SVGGElement[] = [], ropes: SVGGElement[] = []
  let at = -1
  let dot: { done(): void } | null = null
  // the layout of this pass (band px = art px: the band is the whole picture)
  const L = { wide: true, W: 1, H: 1, mx: [0, 0], my: [0, 0], px: [] as number[] }

  function onStep(i: number) {
    if (i === at) return
    at = i
    crowd.forEach((g, k) => g.classList.toggle('on', k < CROWD[Math.min(i, CROWD.length - 1)]))
    posts.forEach((g, k) => (g.classList.toggle('up', k <= i), g.classList.toggle('here', k === i)))
    ropes.forEach((g, k) => g.classList.toggle('lit', k < i))
    front.classList.toggle('gold-1', i >= FY23)
    front.classList.toggle('gold-2', i >= T.milestones.indexOf(CMP))
    front.classList.toggle('today', i >= n)
    if (i >= n) dot?.done()
  }

  /** the crest: low at the left, climbing to the seller's ledge at the right third, then falling into the mist */
  const crest = (x: number) => {
    const { W, H, wide } = L
    const lo = H * (wide ? 0.63 : 0.6), hi = H * (wide ? 0.4 : 0.42)
    const s0 = W * (wide ? 0.52 : 0.47), s1 = W * (wide ? 0.87 : 1.04)
    const wob = Math.sin(x * 0.031 + 1.3) * H * 0.008 + Math.sin(x * 0.11) * H * 0.003
    if (x <= s0) return lo + (hi - lo) * smooth(clamp(x / s0, 0, 1)) + wob * (1 - x / s0)
    if (x <= s1) return hi + Math.sin(x * 0.07) * 0.6
    return hi + (H * 0.6 - hi) * smooth(clamp((x - s1) / (W - s1 + 40), 0, 1)) + wob
  }

  /** this layout's frame and the moon's road (track runs before back in every layout): from behind the ridge at the
   *  first post to behind the big mound; the posts stand on the crest at the moon's stops */
  function geo(W: number, H: number) {
    const wide = W / H > 1.1
    Object.assign(L, { wide, W, H })
    const mx0 = W * (wide ? 0.17 : 0.24), mx1 = W * 0.6
    L.mx = [mx0, mx1]
    // wide: the moon starts half behind the ridge; tall: it starts just over it (the sky is the top half of a phone)
    L.my = [wide ? H * 0.565 : H * 0.36, H * (wide ? 0.25 : 0.18)] // wide: about half behind the ridge, its foot clear of the mist
    L.px = Array.from({ length: n }, (_, i) => lerp(mx0, mx1 - W * (wide ? 0.09 : 0.1), i / (n - 1)))
  }

  function back(g: TideGeo): SVGElement[] {
    const { w: W, h: H, seed } = g
    const band = ctx.art.querySelector('.p2t-band')
    if (band && front.parentNode !== band) band.prepend(far), band.append(mid, front)
    for (const v of [far, mid, front]) v.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    const wide = L.wide
    const r = rng(seed + 5)
    const u = Math.min(H, W * 0.5)
    const X0 = -4, X1 = W + 4
    // ── the ridge's outline, and where its solid face melts into the mist (the words lie below that)
    const top: Pt[] = []
    for (let x = X0; x <= X1; x += 5) top.push([x, crest(x)])
    top.push([X1, crest(X1)])
    const foot = H * (wide ? 0.8 : 0.78) // the face is solid down to here, then mist
    // the ridge's foot: a ragged wash edge where the valley mist takes it (no fade to a flat colour, no hard band)
    const base: Pt[] = []
    for (let x = X1; x >= X0; x -= 14) base.push([x, foot + Math.sin(x * 0.013 + 2) * H * 0.012 + Math.sin(x * 0.051) * H * 0.006 + (r() - 0.5) * H * 0.006])
    base.push([X0, foot])
    const ridge = `M${P(base[base.length - 1])}L${top.map(P).join('L')}L${base.map(P).join('L')}Z`
    // ── the summit ledge: the big mound (in front of the moon's last stop), the small one, the shed at the right end
    const bx = W * (wide ? 0.6 : 0.6), smx = W * (wide ? 0.715 : 0.79), tx = W * (wide ? 0.82 : 0.9)
    const sy = crest(bx)
    const hb = u * (wide ? 0.3 : 0.46), wb = hb * 1.3
    const hs = (hb * 15.0) / 193.7, ws = u * (wide ? 0.07 : 0.11)
    const ph = H * (wide ? 0.15 : 0.09)

    // ── far: the moon's sky (behind the moon): mist, a pale range in the haze, a nearer one, a band of cloud
    far.replaceChildren(
      mist(W * 0.5, H * 0.34, W * 0.7, H * 0.32),
      hills(X0, X1, H * 0.6, H * (wide ? 0.5 : 0.4), seed + 1, 0.86, Math.max(4, Math.round(W / 230))),
      hills(W * (wide ? 0.4 : 0.3), X1, H * 0.62, H * (wide ? 0.3 : 0.24), seed + 2, 0.62, 3),
      mist(W * 0.55, H * 0.56, W * 0.6, H * 0.1))
    // ── mid (over the moon): a breath of cloud across its road, and the mist that rises from behind the ridge
    // a nearer, paler shoulder of the range rises behind the ridge's far end (in front of the moon's last stops)
    mid.replaceChildren(
      hills(W * (wide ? 0.66 : 0.55), X1 + W * 0.1, crest(W * 0.95) + H * 0.04, H * (wide ? 0.22 : 0.2), seed + 7, 0.45, 2),
      mist(W * 0.42, crest(W * 0.42) - H * 0.015, W * 0.46, H * 0.05),
      mist(W * 0.9, crest(W * 0.9) - H * 0.02, W * 0.3, H * 0.06))

    // ── the face: strata in dry brush, the crest's grass, old adits glowing where the diggers went in
    let strata = '', grassD = ''
    // dry-brush strata following the slope (short, tapering: rock, not ruled lines)
    for (let k = 0; k < (wide ? 11 : 6); k++) {
      const x0 = W * (0.02 + r() * 0.86), len = W * (wide ? 0.04 + r() * 0.07 : 0.08 + r() * 0.1)
      const dy = (foot - crest(x0)) * (0.3 + r() * 0.55)
      strata += stroke([[x0, crest(x0) + dy], [x0 + len * 0.5, crest(x0 + len * 0.5) + dy + H * 0.004], [x0 + len, crest(x0 + len) + dy]], Math.max(0.8, H * 0.0026), 0.5, 0.5, 0.1)
    }
    for (let x = 6; x < W; x += 9 + r() * 14) {
      if (x > bx - wb * 0.6 && x < tx + u * 0.15) continue // the summit ledge is trodden bare
      const y = crest(x) + 1, gh = H * (0.008 + r() * 0.014)
      grassD += stroke([[x, y], [x + (r() - 0.4) * gh * 0.7, y - gh]], Math.max(0.7, H * 0.002), 0.1, 0.6, 0.1)
      grassD += stroke([[x + 2, y], [x + 2 + (r() - 0.5) * gh, y - gh * 0.7]], Math.max(0.6, H * 0.0018), 0.1, 0.6, 0.1)
    }
    const adits = ([] as number[]).map((k, i) => {
      const x = W * k, y = crest(x) + (foot - crest(x)) * (0.38 + (i % 2) * 0.18)
      const aw = u * (wide ? 0.034 : 0.06), ah = aw * 1.15
      const mouth = `M${f1(x - aw / 2)} ${f1(y)}L${f1(x - aw / 2)} ${f1(y - ah * 0.7)}Q${f1(x)} ${f1(y - ah * 1.05)} ${f1(x + aw / 2)} ${f1(y - ah * 0.7)}L${f1(x + aw / 2)} ${f1(y)}Z`
      const timber = stroke([[x - aw * 0.56, y + 0.5], [x - aw * 0.56, y - ah * 0.78]], Math.max(1, aw * 0.12), 0.05, 0.05, 0.7) +
        stroke([[x + aw * 0.56, y + 0.5], [x + aw * 0.56, y - ah * 0.78]], Math.max(1, aw * 0.12), 0.05, 0.05, 0.7) +
        stroke([[x - aw * 0.72, y - ah * 0.8], [x + aw * 0.72, y - ah * 0.8]], Math.max(1, aw * 0.14), 0.05, 0.05, 0.7)
      // the spoil heap tipped out below the mouth, the path worn down to it
      const spoil = blob(x + aw * 0.5, y + ah * 0.18, aw * 0.9, ah * 0.2, seed + 70 + i, 0.15, 10)
      return s('g', { class: 't28r-adit' },
        s('circle', { class: 't28r-glow', cx: f1(x), cy: f1(y - ah * 0.4), r: f1(aw * 1.6), fill: 'url(#p2-lamp)' }),
        s('path', { class: 't28r-mouth', d: mouth }),
        s('path', { class: 't28r-spoil', d: spoil }),
        s('path', { class: 't28r-timber', d: timber }))
    })

    // ── the shed: two poles carry a sagging canvas, a lantern hangs at its eave, shovels for sale lean on a rack
    const tw = u * (wide ? 0.24 : 0.3), th = tw * 0.82, tg = crest(tx) + 1
    const roof = `M${P([tx - tw * 0.62, tg - th * 0.6])}Q${P([tx, tg - th * 0.5])} ${P([tx + tw * 0.62, tg - th * 0.64])}L${P([tx + tw * 0.32, tg - th])}Q${P([tx, tg - th * 1.04])} ${P([tx - tw * 0.34, tg - th * 0.97])}Z`
    let wares = ''
    for (let i = 0; i < 4; i++) {
      const x = tx + tw * (0.3 + i * 0.07)
      wares += shovel([x - th * 0.1, tg - th * (0.6 - i * 0.02)], [x + th * 0.06, tg - th * 0.1], th * 0.36)
    }
    const poleW = Math.max(1.4, tw * 0.025)
    const poles = stroke([[tx - tw * 0.55, tg], [tx - tw * 0.55, tg - th * 0.62]], poleW, 0.05, 0.1, 0.6) +
      stroke([[tx + tw * 0.55, tg], [tx + tw * 0.55, tg - th * 0.66]], poleW, 0.05, 0.1, 0.6) +
      stroke([[tx + tw * 0.2, tg], [tx + tw * 0.2, tg - th * 0.68]], poleW * 0.8, 0.05, 0.1, 0.6) + // the rack's post
      stroke([[tx + tw * 0.2, tg - th * 0.5], [tx + tw * 0.55, tg - th * 0.5]], poleW * 0.8, 0.05, 0.05, 0.6) // and its rail
    const lampX = tx - tw * 0.48, lampY = tg - th * 0.48
    const shed = s('g', { class: 't28r-tent' },
      s('ellipse', { class: 't28r-heap-sh', cx: f1(tx + tw * 0.15), cy: f1(tg + 1), rx: f1(tw * 0.75), ry: f1(Math.max(2, th * 0.05)) }),
      s('path', { class: 't28r-sil', d: poles + wares, filter: 'url(#ink-rough)' }),
      s('path', { class: 't28r-sil', d: figure(tx - tw * 0.12, tg, th * 0.52, seed + 3, 1, { hat: 'cap', stoop: 0.1 }) }),
      s('path', { class: 't28r-canvas', d: roof, filter: 'url(#ink-rough)' }),
      s('path', { class: 't28r-cord', d: `M${P([lampX, tg - th * 0.585])}L${P([lampX, lampY])}` }),
      s('circle', { class: 't28r-glow', cx: f1(lampX), cy: f1(lampY + tw * 0.05), r: f1(tw * 0.42), fill: 'url(#p2-lamp)' }),
      s('rect', { class: 't28r-lamp', x: f1(lampX - tw * 0.035), y: f1(lampY), width: f1(tw * 0.07), height: f1(tw * 0.09), rx: 2 }))

    // ── a lamp post at each stop on the crest, a plank with its date hung from the arm; lantern rope from post to post
    front.classList.toggle('tight', L.px[1] - L.px[0] < 84) // close stops: only the board of the post the moon is at
    posts = L.px.map((x, i) => {
      const y = crest(x) + 1
      const date = viDate(T.milestones[i].date)
      const bw = date.length * (wide ? 7.4 : 7) + 14, bh = wide ? 19 : 18
      return s('g', { class: 't28r-post', transform: `translate(${f1(x)} ${f1(y)})` },
        s('circle', { class: 't28r-glow', cx: 0, cy: f1(-ph * 1.02), r: f1(ph * 0.5), fill: 'url(#p2-lamp)' }),
        s('path', { class: 't28r-pole', d: stroke([[0, 1], [0.6, -ph * 0.5], [0, -ph]], Math.max(1.8, H * 0.0045), 0.05, 0.1, 0.6) + stroke([[0, -ph * 0.86], [ph * 0.3, -ph * 0.87]], Math.max(1.3, H * 0.0035), 0.1, 0.1, 0.6) }),
        s('path', { class: 't28r-pole', d: blob(0, 1, ph * 0.09, ph * 0.03, seed + i, 0.1, 8) }), // a stone the post is wedged in
        s('rect', { class: 't28r-lamp', x: f1(-ph * 0.06), y: f1(-ph * 1.1), width: f1(ph * 0.12), height: f1(ph * 0.14), rx: f1(ph * 0.04) }),
        s('g', { transform: `translate(${f1(ph * 0.26)} ${f1(-ph * 0.87)})` }, board(date, bw, bh, seed + 11 * i, '')))
    })
    // rope k runs from post k's lamp to post k+1's (the last one to the shed's eave): the moon's road, lit as it passes
    const lampAt = (k: number): Pt => (k < n ? [L.px[k], crest(L.px[k]) - ph * 1.02] : [tx - tw * 0.6, tg - th * 0.6])
    ropes = Array.from({ length: n }, (_, k) => {
      const a = lampAt(k), b = lampAt(k + 1)
      const sag: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + Math.abs(b[0] - a[0]) * 0.1]
      const pts = curve(a, sag, b, 14)
      let beads = ''
      for (let j = 2; j < pts.length - 1; j += 3) beads += blob(pts[j][0], pts[j][1] + 1.6, Math.max(1.3, H * 0.003), Math.max(1.6, H * 0.0038), seed + j, 0.1, 6)
      return s('g', { class: 't28r-rope' }, s('path', { class: 't28r-rope-line', d: `M${pts.map(P).join('L')}` }), s('path', { class: 't28r-bead', d: beads }))
    })

    // ── diggers with lanterns up the crest toward the summit: near ones on the face and larger, far ones on the crest
    const nMax = CROWD[CROWD.length - 1]
    const xEnd = bx - wb * 0.62
    const spots = Array.from({ length: nMax }, () => ({ x: W * 0.01 + r() * (xEnd - W * 0.01), d: r() })).sort((a, b) => b.x - a.x)
    crowd = spots.map(({ x, d }, k) => {
      const y = crest(x) + 1.2 + d * d * H * 0.045
      const fh = u * (wide ? 0.04 + d * 0.03 : 0.06 + d * 0.04)
      const lx = x + fh * 0.32, ly = y - fh * 0.5
      return s('g', { class: `t28r-digger${d < 0.35 ? ' far' : ''}`, style: `transition-delay:${(k % 7) * 60}ms` },
        s('circle', { class: 't28r-lglow', cx: f1(lx), cy: f1(ly), r: f1(fh * 0.55), fill: 'url(#p2-lamp)' }),
        s('path', { class: 't28r-fig', d: figure(x, y, fh, seed + 20 + k, 1, { hat: k % 3 ? 'cone' : 'cap', stoop: 0.3 }) + stroke([[x - fh * 0.1, y - fh * 0.55], [lx, ly - fh * 0.3]], Math.max(0.8, fh * 0.05), 0.1, 0.1, 0.5) + shovel([x - fh * 0.2, y - fh * 0.7], [x - fh * 0.5, y - fh * 0.05], fh * 0.5) }),
        s('circle', { class: 't28r-dot', cx: f1(lx), cy: f1(ly), r: f1(Math.max(1.4, fh * 0.075)) }))
    })

    // ── words cut into the face: who the diggers are, what the shed sells, how much gold (light lip below, shadow above)
    const fs = wide ? 15 : 14
    const cut = (x: number, y: number, t: string, anchor: string, cls = '') => [
      s('text', { class: `t28r-cut-lo ${cls}`, x: f1(x), y: f1(y + 1), 'text-anchor': anchor }, t),
      s('text', { class: `t28r-cut ${cls}`, x: f1(x), y: f1(y), 'text-anchor': anchor }, t)]
    const amt = (x: number, y: number, v: string, lab: string | undefined, anchor: string) =>
      [...cut(x, y, v, anchor, 't28r-cut-v'), ...(lab ? cut(x, y + fs * 1.15, lab, anchor, 't28r-cut-l') : [])]
    const row = (k: number) => sy + fs * (1.9 + k * 2.4)
    const cx0 = wide ? W * 0.2 : W * 0.3, cy0 = crest(cx0) + (foot - crest(cx0)) * (wide ? 0.45 : 0.8)
    const words = s('g', { class: 't28r-words' },
      ...cut(cx0, cy0, G.crowd, 'middle', 't28r-who'),
      ...(wide ? cut(tx, row(1.15), G.seller, 'middle', 't28r-who') : cut(W - 10, row(2.5), G.seller, 'end', 't28r-who')),
      s('g', { class: 't28r-amt-big' }, ...amt(wide ? bx : bx - wb * 0.1, row(0), CMP.compare!.after, CMP.compare!.afterLabel, 'middle')),
      s('g', { class: 't28r-amt-small' }, ...amt(wide ? smx : W - 10, row(wide ? 0 : 1), CMP.compare!.before, CMP.compare!.beforeLabel, wide ? 'middle' : 'end')))

    front.replaceChildren(
      // the ridge is solid (the moon's lower half stays behind it) down to its ragged foot in the valley mist
      s('path', { class: 't28r-ridge', d: ridge }),
      s('path', { class: 't28r-strata', d: strata }),
      s('path', { class: 't28r-rim', d: stroke(top.filter((p) => p[0] < bx - wb * 0.5 || p[0] > tx + tw * 0.7).map((p) => [p[0], p[1] + 0.8] as Pt), Math.max(1.3, H * 0.003), 0.02, 0.02, 0.4) }),
      s('path', { class: 't28r-rim t28r-rim-ledge', d: stroke(top.filter((p) => p[0] >= bx - wb * 0.5 && p[0] <= tx + tw * 0.7).map((p) => [p[0], p[1] + 0.8] as Pt), Math.max(1.3, H * 0.003), 0.02, 0.02, 0.4) }),
      s('path', { class: 't28r-grass', d: grassD }),
      ...adits,
      ...ropes,
      s('g', { class: 't28r-gold t28r-gold-big' }, ...heap(bx, sy + 1, wb, hb, seed + 3)),
      s('g', { class: 't28r-gold t28r-gold-small' }, ...heap(smx, crest(smx) + 1, ws, hs, seed + 4)),
      shed,
      ...posts, ...crowd,
      mist(W * 0.22, foot, W * 0.34, H * 0.05), mist(W * 0.62, foot + H * 0.01, W * 0.4, H * 0.05),
      words)

    // the milestone's words lie in the mist under the ridge: right of the insight's corner on a wide frame, full width on a tall one
    const card = ctx.art.querySelector<HTMLElement>('.p2t-card')
    if (card) {
      const cw = wide ? Math.min(560, W * 0.42) : W - 20
      Object.assign(card.style, { left: `${f1(wide ? W * 0.955 - cw : 10)}px`, top: `${f1(foot + (wide ? H * 0.005 : H * 0.02))}px`, width: `${f1(cw)}px`, maxHeight: 'none' })
    }
    ctx.art.style.setProperty('--t28-moon', `${f1(wide ? H * 0.5 : W * 0.5)}px`) // the disc is 0.8 of it
    if (at >= 0) {
      const i = at
      at = -1
      onStep(i)
    }
    return [] // everything is in far / mid / front, frame-wide
  }

  const done = progressTide(T, {
    label: G.label, prompt: G.prompt, insight: G.insight as Fact, detail: G.detail as Fact, aria: G.sliderAria,
    art: { back, mark: () => s('g') },
    band: (W, H) => ({ w: W, h: H, top: 0 }), // the scroll is the whole picture
    // the moon rises on a low arc from behind the ridge at the first post to behind the big mound at today
    track: (g) => {
      geo(g.w, g.h)
      return (t) => {
      const [x0, x1] = L.mx, [y0, y1] = L.my
      return [lerp(x0, x1, t), lerp(y0, y1, Math.sin((t * Math.PI) / 2))] as Pt
      }
    },
    thumb: () => moon(0, 0, 20, 2851, false),
    onStep: (i) => onStep(i),
  }).mount(ctx)
  // guide: a dot at the moon's heart (it leans toward the next post when idle); when idle the moon itself nudges that way
  const m = ctx.art.querySelector<HTMLElement>('.p2t-moon')
  dot = m ? guide(ctx).dot(m, { dir: [1, -0.3] }) : null
  const nudge = () => {
    if (!m || ctx.reduced || ctx.quality === 'low' || at >= n) return
    m.animate([{ translate: '0 0' }, { translate: '20px -4px' }, { translate: '0 0' }], { duration: 1400, easing: 'ease-in-out' })
  }
  ctx.el.addEventListener('p2:idle', nudge)
  ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', nudge))
  return done
}
