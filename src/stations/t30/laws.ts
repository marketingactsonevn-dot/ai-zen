import { h, s } from '../../core/dom'
import { L, type Fact } from '../../core/content'
import { createLoop } from '../../core/loop'
import type { SceneCtx } from '../types'
import { progressTide, type TideGeo } from '../../ui/part2/tide'
import type { Tide } from '../../ui/part2/types'
import { blob, clamp, curve, rng, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist, pine, reeds } from '../../ui/part2/paint'
import { guide } from '../../ui/part2/guide'
import { C } from './data'
import { f1, P } from './kit'

const S = C.scenes.laws
const tide = S.tide as Tide
const MS = tide.milestones
const N = MS.length
type Kind = 'eu' | 'cn' | 'us' | 'vn'
/** the four places, left to right, and the pillar each law belongs to (from the scene's JSON) */
const PLACES = S.places as { id: Kind; name: string }[]
const COL = (S.where as Kind[]).map((k) => PLACES.findIndex((p) => p.id === k))
// the place's name is carved just above, so under the pillar the law reads without it ("EU · 2024 …" → "2024 …")
const NOTCH = (S.notches as string[]).map((t) => t.split(' · ').slice(1).join(' · ') || t)
/** a milestone's place among its pillar's notches, bottom up */
const RANK = MS.map((_, i) => COL.slice(0, i).filter((c) => c === COL[i]).length)

/**
 * II·12 "laws" (2.5D, progressTide; audit v3 30-3, reworked): four stone pillars, four places, side by side at the same
 * distance on a beach seen from the sea at night, each on its own footing: EU granite ashlar under a pyramidion, China a
 * cluster of basalt columns, the US layered slate, Việt Nam a pale stele under a small tiled roof; moss on their ledges,
 * their names carved under them. The moon is time: drag it along its dotted arc (it rests at each law); the pillars' lit
 * side and their shadows follow it. The tide draws back toward you, foam at its edge, and as each law's date passes its
 * notch is cut into its own pillar and carved in words under it: the EU's high-risk notch slides down to its new deadline,
 * a crack opens down the US pillar (federal against state), China and Việt Nam get their label seals, Việt Nam's pillar
 * stays wet. At today four different shapes stand side by side on the bared sand; then a wooden board, planted in the sand
 * on two stakes, says what a content maker in Việt Nam has to do.
 */
export function lawsScene(ctx: SceneCtx) {
  const hero = MS.findIndex((m) => m.compare)
  let pillars: SVGGElement[] = [], refls: SVGGElement[] = []
  let notches: SVGGElement[] = [] // one per milestone, on its pillar
  let sea: SVGPathElement | null = null, foam: SVGPathElement | null = null, road: SVGGElement | null = null
  let edge: ((tau: number) => string) | null = null
  let foamAt: ((tau: number) => string) | null = null
  let tau = 0, tauTo = 0, cur = -1, past = -1
  // the frame round the component's band (the painting bleeds to the frame edges): band offset and frame size, px
  let L0 = 0, T0 = 0, W = 0, H = 0, tall = false
  let feet: Pt[] = [] // each pillar's foot, frame px
  let boardAt: { x: number; y: number; w: number } = { x: 0, y: 0, w: 0 }
  const names = PLACES.map((p) => h('p', { class: 't30l-name', 'aria-hidden': 'true' }, p.name))
  const carved = PLACES.map(() => h('p', { class: 't30l-said', 'aria-hidden': 'true' }))
  // the board: planks on two stakes driven into the sand (the stakes run up behind the planks), its shadow on the sand
  const board = h('div', { class: 't30l-board' },
    h('i', { class: 't30l-stake l', 'aria-hidden': 'true' }), h('i', { class: 't30l-stake r', 'aria-hidden': 'true' }), h('i', { class: 't30l-board-sh', 'aria-hidden': 'true' }),
    h('div', { class: 't30l-planks' }, ctx.fact(S.board as Fact, 'p', 't30l-board-text')))
  let dot: { done(): void } | null = null // the guide's dot on the moon (set once the moon exists)
  let way: { done(): void; el: HTMLElement } | null = null // the dotted arc
  const loop = createLoop(ctx.art, (_t, dt) => {
    // the tide follows the moon a little behind it (heavy water), then stops
    tau += (tauTo - tau) * (dt > 0 ? 1 - Math.exp(-dt * 7) : 1)
    if (Math.abs(tauTo - tau) < 0.002) tau = tauTo
    water()
    return tau !== tauTo
  })
  ctx.onCleanup(() => loop.dispose())
  const water = () => {
    if (!sea || !edge || !foamAt || !foam) return
    sea.setAttribute('d', edge(tau))
    foam.setAttribute('d', foamAt(tau))
  }

  // the component has just written the band's box and the scene height: read them back from the styles (no layout read)
  function frame(g: TideGeo) {
    const band = ctx.art.querySelector<HTMLElement>('.p2t-band'), root = ctx.art.querySelector<HTMLElement>('.p2t')
    L0 = parseFloat(band?.style.left ?? '') || 0
    T0 = parseFloat(band?.style.top ?? '') || 0
    W = g.w + 2 * L0
    H = parseFloat(root?.style.height ?? '') || g.h / 0.6
    tall = W / H < 1.05
    root?.classList.toggle('tall', tall)
  }
  // the beach runs straight across the frame (the pillars stand at one distance) and deep toward us: at today the tide has
  // bared it almost to the frame's foot, where the board stands; depth D toward us
  const beach = () => {
    const hz = H * (tall ? 0.3 : 0.42)
    const B = (u: number): Pt => [W * (-0.05 + 1.1 * u), hz + 3 + Math.sin(u * Math.PI) * H * 0.012]
    const D = H * (tall ? 0.63 : 0.52)
    return { hz, B, D }
  }
  const FOOT = () => (tall ? 0.12 : 0.19) // where the pillars stand on the beach, share of D
  const COLX = () => (tall ? [0.15, 0.383, 0.617, 0.85] : [0.19, 0.4, 0.61, 0.82])
  // the moon's arc over the sea, frame px: high, clear of the pillars' tops
  const arc = (t: number): Pt => {
    const c = clamp(t, 0, 1)
    return tall ? [W * (0.1 + 0.8 * c), H * 0.115 - Math.sin(Math.PI * c) * H * 0.035] : [W * (0.08 + 0.84 * c), H * 0.13 - Math.sin(Math.PI * c) * H * 0.06]
  }
  /** a notch at each stop: the moon rests a moment there (the track holds still around each stop) */
  const warp = (t: number) => {
    const u = clamp(t, 0, 1) * N, i = Math.min(N - 1, Math.floor(u)), f = u - i
    const k = clamp((f - 0.22) / 0.56, 0, 1)
    return (i + k * k * (3 - 2 * k)) / N
  }

  const art = {
    back(g: TideGeo): SVGElement[] {
      frame(g)
      const r = rng(g.seed + 5)
      const { hz, B, D } = beach()
      const us = Array.from({ length: 41 }, (_, k) => k / 40)
      const back = us.map(B)
      const at = (u: number, k: number): Pt => [B(u)[0], B(u)[1] + D * k]
      const lineAt = (k: number) => us.map((u) => at(u, k))
      // the water edge across the beach (k 0 = the high-water line … 1 = the near edge), a slow swell along it
      const waterline = (t: number) => {
        const k = 0.04 + 0.96 * t
        return us.map((u) => [B(u)[0], B(u)[1] + D * k + Math.sin(u * 23 + t * 3) * D * 0.012] as Pt)
      }
      edge = (t: number) => `M${f1(-W * 0.05)} ${f1(hz)}L${waterline(t).map(P).join('L')}L${f1(W * 1.05)} ${f1(H * 1.05)}L${f1(-W * 0.05)} ${f1(H * 1.05)}Z`
      foamAt = (t: number) => {
        const pts = waterline(t)
        let d = stroke(pts, Math.max(1.4, H * 0.004), 0.3, 0.3, 0.12)
        // lace: broken bubbles just behind the edge, a second, thinner wave line further out
        for (let i = 1; i < pts.length; i++) {
          const [x, y] = pts[i]
          const len = W * (0.01 + ((i * 7) % 5) * 0.004), dy = D * (0.012 + ((i * 5) % 4) * 0.008) + 2
          if ((i * 7) % 3) d += stroke([[x - len / 2, y + dy], [x + len / 2, y + dy + 0.4]], 1.5, 0.3, 0.3, 0.1)
          if (i % 2) d += stroke([[x - W * 0.012, y + D * 0.05 + 3], [x + W * 0.012, y + D * 0.05 + 4]], 1.1, 0.4, 0.4, 0.1)
        }
        return d
      }
      // ── the four pillars, equal, at one distance
      const ph = tall ? clamp(H * 0.17, 104, 150) : clamp(H * 0.3, 170, 250)
      const pw = tall ? Math.min(W * 0.14, ph / 2.5) : ph / 2.9
      pillars = []
      refls = []
      notches = []
      feet = COLX().map((x) => [W * x, hz + D * FOOT()] as Pt)
      PLACES.forEach((p, c) => {
        const { g: pg, refl } = pillar(c, p.id, feet[c], pw, ph, g.seed + c * 13)
        pillars[c] = pg
        refls[c] = refl
      })
      // the board's place: on the sand bared at today, right of the reading (a phone: across, under the pillars' words)
      boardAt = tall ? { x: W * 0.5, y: hz + D * 0.86, w: W * 0.84 } : { x: W * 0.77, y: hz + D * 0.84, w: clamp(W * 0.3, 280, 400) }
      // ── land, sand, sea
      const land = `M${back.map(P).join('L')}L${f1(W * 1.08)} ${f1(hz - H * 0.09)}L${f1(W * 0.4)} ${f1(hz - H * 0.03)}L${f1(-W * 0.06)} ${f1(hz - H * 0.005)}Z`
      const dry = `M${back.map(P).join('L')}L${[...lineAt(0.05)].reverse().map(P).join('L')}Z`
      const wet = `M${lineAt(0.05).map(P).join('L')}L${[...lineAt(1.04)].reverse().map(P).join('L')}Z`
      let wrack = '', pools = '', pebbles = '', ribs = ''
      for (let i = 0; i < 70; i++) {
        const [x, y] = at(r(), 0.04 + r() * 0.04)
        wrack += blob(x, y, H * 0.003, H * 0.0014, g.seed + 200 + i, 0.3, 6)
      }
      for (let i = 0; i < 16; i++) {
        const [x, y] = at(r(), 0.32 + r() * 0.6)
        pools += blob(x, y, W * 0.03 * (0.5 + r()), D * (0.012 + r() * 0.02), g.seed + 300 + i, 0.25, 12)
      }
      for (let i = 0; i < 30; i++) {
        const [x, y] = at(r(), 0.15 + r() * 0.8)
        const rr = H * 0.006 * (0.5 + r()) * (0.6 + (y - hz) / D)
        pebbles += blob(x, y, rr, rr * 0.55, g.seed + 400 + i, 0.2, 8)
      }
      // ripple marks the tide left in the sand, longer near
      for (let i = 0; i < 46; i++) {
        const k = 0.25 + r() * 0.72, [x, y] = at(r(), k)
        const len = W * (0.02 + k * 0.05)
        ribs += stroke(curve([x - len / 2, y], [x, y - D * 0.006], [x + len / 2, y + 0.5], 6), 0.7 + k * 1.2, 0.3, 0.3, 0.1)
      }
      let tufts = ''
      for (let i = 0; i < 26; i++) {
        const [x, y] = B(r())
        const hh = H * 0.016 * (0.6 + r() * 0.6)
        for (let j = 0; j < 3; j++) tufts += stroke([[x + j * hh * 0.3, y + 1], [x + j * hh * 0.3 + (j - 1) * hh * 0.4, y - hh]], Math.max(0.6, hh * 0.12), 0.05, 0.6, 0.2)
      }
      let rip = ''
      for (let i = 0; i < 90; i++) {
        const t = Math.pow(r(), 0.75), y = hz + 6 + (H - hz) * t
        const len = W * (0.008 + t * 0.05) * (0.5 + r())
        const x = -W * 0.05 + r() * W * 1.1
        rip += stroke([[x, y], [x + len * 0.5, y + (r() - 0.5)], [x + len, y]], 0.6 + t * 1.8, 0.3, 0.3, 0.1)
      }
      // the moon's road on the water (moved under the moon in onStep), broken into dry-brush glints
      let rd = ''
      for (let y = hz + 6; y < H; y += 3 + (y - hz) * 0.05 + r() * 3) {
        const near = (y - hz) / (H - hz)
        if (r() > 0.86 - near * 0.3) continue
        const len = W * (0.01 + near * 0.045) * (0.5 + r())
        const x = (r() - 0.5) * W * (0.015 + near * 0.06) - len / 2
        rd += stroke([[x, y], [x + len, y + (r() - 0.5)]], 0.9 + near * 2.2, 0.25, 0.25, 0.1)
      }
      road = s('g', { class: 't30l-road' },
        s('ellipse', { cx: 0, cy: f1(hz + (H - hz) * 0.42), rx: f1(W * 0.05), ry: f1((H - hz) * 0.5), fill: 'url(#p2-road)' }),
        s('path', { class: 'p2p-road', d: rd }))
      sea = s('path', { class: 't30l-sea', fill: 'url(#t30l-sea-g)' })
      foam = s('path', { class: 't30l-foam' })
      water()
      // the years on the moon's arc: a tick at every law, the year where it changes (above the arc), "today" at the end (H2)
      let ticks = ''
      const years: SVGElement[] = []
      for (let i = 0; i <= N; i++) {
        const [x, y] = arc(i / N)
        ticks += stroke([[x, y - 9], [x, y - 3]], 1.6, 0.1, 0.1, 0.4)
        const yr = i < N ? MS[i].date.slice(0, 4) : L.today
        if (i === N || i === 0 || yr !== MS[i - 1].date.slice(0, 4)) years.push(s('text', { class: 't30l-year', x: f1(x), y: f1(y - (tall ? 30 : 34)), 'text-anchor': 'middle' }, yr)) // above the moon's disc
      }
      // a far headland with two wind-bent pines on the left, layered sea mist (three depths)
      const head = `M${f1(-W * 0.06)} ${f1(hz + 2)}Q${f1(W * 0.02)} ${f1(hz - H * 0.07)} ${f1(W * 0.09)} ${f1(hz - H * 0.075)}Q${f1(W * 0.13)} ${f1(hz - H * 0.07)} ${f1(W * 0.16)} ${f1(hz - H * 0.015)}L${f1(W * 0.2)} ${f1(hz + 2)}Z`
      const stop = (o: number, a: number, c = 't30l-sea-st') => s('stop', { offset: o, class: c, style: `stop-opacity:${a}` })
      return [s('g', { class: 't30l-art', transform: `translate(${f1(-L0)} ${f1(-T0)})` },
        s('defs', null,
          s('linearGradient', { id: 't30l-sea-g', gradientUnits: 'userSpaceOnUse', x1: 0, y1: f1(hz), x2: 0, y2: f1(H) },
            stop(0, 0.6), stop(0.08, 0.94), stop(0.45, 0.86), stop(1, 0.98)),
          s('linearGradient', { id: 't30l-wet-g', gradientUnits: 'userSpaceOnUse', x1: 0, y1: f1(hz), x2: 0, y2: f1(H * 0.95) },
            stop(0, 1, 't30l-wet-st'), stop(1, 0.75, 't30l-wet-st')),
          s('linearGradient', { id: 't30l-face-g', x1: 0, y1: 0, x2: 1, y2: 0 },
            s('stop', { offset: 0, class: 't30l-face-st', style: 'stop-opacity:.34' }),
            s('stop', { offset: 0.55, class: 't30l-face-st', style: 'stop-opacity:.1' }),
            s('stop', { offset: 1, class: 't30l-face-st', style: 'stop-opacity:0' })),
          s('pattern', { id: 't30l-stripe', width: 9, height: 5, patternUnits: 'userSpaceOnUse' }, s('rect', { class: 't30l-stripe', width: 9, height: 3 }))),
        mist(W * 0.5, hz - H * 0.16, W * 0.75, H * 0.22),
        hills(W * 0.25, W * 1.1, hz - H * 0.05, H * 0.12, g.seed + 6, 1, 3),
        mist(W * 0.62, hz - H * 0.07, W * 0.5, H * 0.04),
        hills(-W * 0.05, W * 0.5, hz - H * 0.02, H * 0.11, g.seed + 3, 0.92, 3),
        hills(W * 0.32, W * 1.1, hz - H * 0.025, H * 0.13, g.seed + 1, 0.85, 4),
        hills(W * 0.6, W * 1.12, hz - H * 0.01, H * 0.09, g.seed + 2, 0.55, 2),
        s('path', { class: 't30l-land', d: land, filter: 'url(#ink-wash)' }),
        tall ? null : s('path', { class: 't30l-head', d: head, filter: 'url(#ink-rough)' }),
        tall ? null : pine(W * 0.075, hz - H * 0.07, H * 0.13, g.seed + 7, 1),
        tall ? null : pine(W * 0.125, hz - H * 0.055, H * 0.085, g.seed + 8, 1),
        mist(W * 0.5, hz - H * 0.006, W * 0.8, H * 0.022), // sea mist on the far water, behind the pillars
        s('path', { class: 't30l-tuft', d: tufts }),
        s('path', { class: 't30l-sand', d: dry }),
        s('path', { class: 't30l-wet', d: wet, fill: 'url(#t30l-wet-g)' }),
        s('path', { class: 't30l-crest', d: stroke(back, Math.max(1, H * 0.003), 0.5, 0.05, 0.2) }),
        s('path', { class: 't30l-rib', d: ribs }),
        s('path', { class: 't30l-pool', d: pools }),
        s('path', { class: 't30l-pebble', d: pebbles }),
        s('path', { class: 't30l-wrack', d: wrack }),
        ...refls,
        ...pillars,
        sea, foam,
        s('path', { class: 'p2p-ripple t30l-rip', d: rip }),
        road,
        s('path', { class: 't30l-ticks', d: ticks }),
        ...years,
        // the board's two stakes, already driven into the sand where it will stand (in the shallows until the tide goes out)
        ...stakes(),
        // the near dark: a cluster of rocks in the shallows cut by the frame (bottom right) with foam round them, reeds
        ...nearRocks(g.seed),
        tall ? null : reeds(W * 0.93, H * 0.93, H * 0.16, g.seed + 11, 6),
        reeds(W * 0.012, H * 1.0, H * (tall ? 0.14 : 0.2), g.seed + 10, 7))]
    },
    mark: () => s('g'),
  }

  function stakes(): SVGElement[] {
    const { x, y, w } = boardAt, top = y - 26 - 56, sw = 9
    return [-1, 1].flatMap((sd) => {
      const cx = x + sd * w * 0.37
      return [
        s('ellipse', { class: 't30l-stake-ring', cx: f1(cx), cy: f1(y + 1), rx: f1(sw * 1.8), ry: f1(sw * 0.45) }),
        s('path', { class: 't30l-stake-wood', d: `M${f1(cx - sw / 2)} ${f1(y)}V${f1(top + 2)}L${f1(cx)} ${f1(top)}L${f1(cx + sw / 2)} ${f1(top + 2)}V${f1(y)}Z` }),
        s('path', { class: 't30l-stake-hi', d: `M${f1(cx + sw * 0.2)} ${f1(y - 2)}V${f1(top + 4)}` }),
      ]
    })
  }
  function nearRocks(seed: number): SVGElement[] {
    const rocks: [number, number, number, number][] = tall
      ? [[0.98, 0.95, 0.17, 0.07], [0.76, 0.975, 0.07, 0.035]]
      : [[0.965, 0.9, 0.1, 0.11], [0.855, 0.94, 0.06, 0.055], [0.745, 0.96, 0.035, 0.026]]
    return rocks.flatMap(([cx, cy, rx, ry], i) => [
      s('ellipse', { class: 't30l-near-foam', cx: f1(W * cx), cy: f1(H * cy - H * ry * 0.15), rx: f1(W * rx * 1.12), ry: f1(H * ry * 0.35) }),
      s('path', { class: 't30l-near', d: blob(W * cx, H * cy, W * rx, H * ry, seed + 9 + i, 0.14, 16), filter: 'url(#ink-rough)' }),
      s('path', { class: 't30l-near-rim', d: stroke(curve([W * (cx - rx * 0.75), H * (cy - ry * 0.55)], [W * (cx - rx * 0.2), H * (cy - ry * 0.98)], [W * (cx + rx * 0.5), H * (cy - ry * 0.85)], 10), Math.max(1.4, H * 0.004), 0.2, 0.3, 0.1) }),
    ])
  }

  /** One pillar standing on its footing at `base`: stone of its kind, a moonlit side and a lit edge (which side follows
   *  the moon), moss on the ledges, a wet band, water running off; its laws' notches, each hidden until its date passes
   *  (EU: three, the high-risk one sliding to its new deadline; US: a crack; China and Việt Nam: a seal). Its contact
   *  shadow falls away from the moon; its reflection is a striped, flipped silhouette on the wet sand. */
  function pillar(c: number, kd: Kind, base: Pt, pw: number, ph: number, seed: number) {
    const rr = rng(seed)
    const w2 = pw / 2, tw = w2 * 0.93 // a slight taper
    const sw = pw * 0.24 // the side face, seen in a sliver
    const lift = sw * 0.45
    const fh = ph * 0.075, fw = w2 * 1.3 // the footing: a wider, low block the pillar stands on
    const y0 = -fh // the pillar's own foot, on the footing
    const bh = ph - fh
    // the cap: EU a pyramidion, China a basalt slab, the US a slanted cut, Việt Nam a small tiled roof
    const capH = kd === 'eu' ? pw * 0.55 : kd === 'vn' ? pw * 0.4 : kd === 'cn' ? pw * 0.16 : 0
    const topL = kd === 'us' ? -ph * 0.93 : -ph
    const front = kd === 'us'
      // slate: its edges ragged where layers split off
      ? `M${f1(-w2)} ${f1(y0)}` + Array.from({ length: 9 }, (_, k) => `L${f1(-w2 - (k % 2 ? pw * 0.04 : 0) + (k / 8) * (w2 - tw))} ${f1(y0 + ((topL - y0) * (k + 1)) / 9)}`).join('') +
        `L${f1(tw)} ${f1(-ph)}` + Array.from({ length: 9 }, (_, k) => `L${f1(tw + (k % 2 ? pw * 0.035 : 0) + (k / 8) * (w2 - tw))} ${f1(-ph + ((y0 + ph) * (k + 1)) / 9)}`).join('') + 'Z'
      : `M${f1(-w2)} ${f1(y0)}L${f1(-tw)} ${f1(topL)}L${f1(tw)} ${f1(-ph)}L${f1(w2)} ${f1(y0)}Z`
    const side = `M${f1(w2)} ${f1(y0)}L${f1(w2 + sw)} ${f1(y0 - lift)}L${f1(tw + sw)} ${f1(-ph - lift)}L${f1(tw)} ${f1(-ph)}Z`
    const footF = `M${f1(-fw)} 0L${f1(-fw)} ${f1(-fh)}L${f1(fw)} ${f1(-fh)}L${f1(fw)} 0Z`
    const footS = `M${f1(fw)} 0L${f1(fw + sw)} ${f1(-lift)}L${f1(fw + sw)} ${f1(-fh - lift)}L${f1(fw)} ${f1(-fh)}Z`
    const footT = `M${f1(-fw)} ${f1(-fh)}L${f1(-fw + sw)} ${f1(-fh - lift)}L${f1(fw + sw)} ${f1(-fh - lift)}L${f1(fw)} ${f1(-fh)}Z`
    const cap = kd === 'eu'
      ? `M${f1(-tw)} ${f1(-ph)}L${f1(sw * 0.4)} ${f1(-ph - capH)}L${f1(tw + sw)} ${f1(-ph - lift)}L${f1(tw)} ${f1(-ph)}Z`
      : kd === 'vn'
        ? `M${f1(-tw * 1.45)} ${f1(-ph + pw * 0.04)}Q${f1(-tw * 0.9)} ${f1(-ph - capH * 0.3)} ${f1(sw * 0.3)} ${f1(-ph - capH)}Q${f1(tw + sw)} ${f1(-ph - capH * 0.35)} ${f1(tw * 1.45 + sw)} ${f1(-ph - lift + pw * 0.04)}L${f1(tw * 1.1 + sw)} ${f1(-ph - lift + pw * 0.09)}L${f1(-tw * 1.1)} ${f1(-ph + pw * 0.09)}Z`
        : kd === 'cn'
          ? `M${f1(-tw * 1.12)} ${f1(-ph + 1)}L${f1(-tw * 1.12)} ${f1(-ph - capH * 0.6)}L${f1(-tw * 0.7 + sw)} ${f1(-ph - capH * 0.6 - lift)}L${f1(tw * 1.12 + sw)} ${f1(-ph - capH * 0.6 - lift)}L${f1(tw * 1.12 + sw)} ${f1(-ph - lift + 1)}L${f1(tw * 1.12)} ${f1(-ph + 1)}Z`
          : `M${f1(-tw)} ${f1(topL)}L${f1(tw)} ${f1(-ph)}L${f1(tw + sw)} ${f1(-ph - lift)}L${f1(-tw + sw * 0.6)} ${f1(topL - lift * 0.8)}Z`
    const body = footF + footS + front + side + cap
    // the stone's own build: ashlar courses (EU), columns (China), strata (US), tile courses on the stele roof (VN)
    let joints = '', grain = ''
    if (kd === 'eu') {
      const n = Math.max(5, Math.round(bh / 30))
      for (let k = 1; k < n; k++) {
        const y = y0 - (bh * k) / n
        joints += `M${f1(-w2 + (w2 - tw) * (k / n))} ${f1(y)}L${f1(w2 - (w2 - tw) * (k / n))} ${f1(y + 0.6)}`
        joints += `M${f1(w2 - (w2 - tw) * (k / n))} ${f1(y + 0.6)}L${f1(w2 + sw)} ${f1(y - lift + 0.6)}`
      }
      for (let k = 0; k < n; k++) {
        const ya = y0 - (bh * k) / n, yb = y0 - (bh * (k + 1)) / n, x = (k % 2 ? -0.18 : 0.22) * pw + (rr() - 0.5) * pw * 0.08
        joints += `M${f1(x)} ${f1(ya)}L${f1(x)} ${f1(yb)}`
      }
      for (let q = 0; q < 26; q++) grain += blob(-w2 * 0.85 + rr() * pw * 0.85, y0 - bh * rr() * 0.97, pw * 0.022, pw * 0.022, seed + q, 0.2, 5)
    } else if (kd === 'cn') {
      // three columns: a seam between each, the left one a shade darker, each topped by its own facet under the slab
      for (const k of [-0.18, 0.16]) joints += stroke([[k * pw, y0], [k * pw * 0.96, -ph]], Math.max(1, pw * 0.035), 0.05, 0.05, 0.6)
      grain += `M${f1(-w2)} ${f1(y0)}L${f1(-tw)} ${f1(-ph)}L${f1(-0.18 * pw * 0.96)} ${f1(-ph)}L${f1(-0.18 * pw)} ${f1(y0)}Z`
    } else if (kd === 'us') {
      for (let y = y0 - bh * 0.07; y > topL + 4; y -= bh * (0.06 + rr() * 0.04)) joints += stroke([[-w2 - pw * 0.02, y], [0, y - pw * 0.02 + rr() * 2], [w2 + pw * 0.02, y - pw * 0.05]], 0.9 + rr() * 0.8, 0.1, 0.1, 0.4)
    } else {
      for (let k = 1; k < 5; k++) joints += stroke(curve([-tw * (1.4 - k * 0.07), -ph + pw * 0.05 - capH * k * 0.13], [sw * 0.2, -ph - capH * (0.2 + k * 0.14)], [tw * (1.4 - k * 0.07) + sw, -ph - lift + pw * 0.05 - capH * k * 0.13], 8), 1, 0.2, 0.2, 0.4)
    }
    // moss on the footing ledge and the damp lower front; the cap top on the EU / China pillars
    let moss = ''
    for (let j = 0; j < 7; j++) moss += blob(-fw + rr() * (fw * 2 + sw), -fh - lift * (0.3 + rr() * 0.5), pw * (0.06 + rr() * 0.06), pw * 0.035, seed + 70 + j, 0.4, 8)
    for (let j = 0; j < 4; j++) moss += blob(-w2 * (0.9 - j * 0.2), y0 - bh * (0.04 + rr() * 0.1), pw * (0.05 + rr() * 0.05), pw * 0.04, seed + 80 + j, 0.4, 8)
    if (kd === 'cn') moss += blob(sw * 0.3, -ph - capH * 0.6 - lift * 0.6, pw * 0.3, pw * 0.05, seed + 90, 0.3, 10)
    // rivulets running off the face, a few drips at its foot
    let runs = ''
    for (let j = 0; j < 4; j++) {
      const x = -w2 * 0.75 + (j + rr() * 0.6) * pw * 0.2
      const ya = -ph * (0.55 + rr() * 0.35)
      runs += stroke(curve([x, ya], [x + pw * 0.04 * (rr() - 0.5), ya * 0.5], [x + pw * 0.02, y0 - 1], 8), Math.max(0.6, pw * 0.025), 0.3, 0.05, 0.2)
    }
    let drips = ''
    for (let j = 0; j < 5; j++) drips += blob(-fw * 0.8 + rr() * fw * 1.6, 1 + rr() * pw * 0.06, Math.max(0.8, pw * 0.03), Math.max(0.6, pw * 0.018), seed + 50 + j, 0.2, 6)
    // this pillar's laws: a notch each, cut bottom up, the year carved above it
    const fs = clamp(pw * 0.2, 10.5, 14)
    const mine = MS.map((_, i) => i).filter((i) => COL[i] === c)
    const cuts = mine.map((i) => {
      const y = y0 - bh * (0.2 + RANK[i] * 0.23)
      const line = (yy: number) => stroke([[-w2, yy], [w2, yy + 1], [w2 + sw, yy + 1 - lift]], Math.max(1.6, pw * 0.05), 0.02, 0.02, 0.8)
      const kids: SVGElement[] = []
      const cmp = MS[i].compare
      if (i === hero && cmp) {
        // the old deadline struck through above; the notch drops to the new one (vermilion)
        const yo = y - bh * 0.13
        kids.push(
          s('path', { class: 't30l-notch t30l-old', d: line(yo) }),
          s('text', { class: 't30l-date', x: 0, y: f1(yo - fs * 0.4), 'font-size': f1(fs), 'text-anchor': 'middle' }, cmp.before.slice(-4)),
          s('g', { class: 't30l-slide', style: `--from:${f1(yo - y)}px` },
            s('path', { class: 't30l-notch', d: line(y) }),
            s('text', { class: 't30l-date new', x: 0, y: f1(y - fs * 0.4), 'font-size': f1(fs), 'text-anchor': 'middle' }, cmp.after.slice(-4))))
      } else {
        kids.push(
          s('path', { class: 't30l-notch', d: line(y) }),
          s('path', { class: 't30l-notch-lip', d: `M${f1(-w2 + 1)} ${f1(y + Math.max(1.6, pw * 0.05) * 0.7)}L${f1(w2 - 1)} ${f1(y + 1 + Math.max(1.6, pw * 0.05) * 0.7)}` }),
          s('text', { class: 't30l-date', x: 0, y: f1(y - fs * 0.4), 'font-size': f1(fs), 'text-anchor': 'middle' }, MS[i].date.slice(0, 4)))
      }
      // the US: federal against state, a crack down the face (in the stone, from the cut to the footing); China and
      // Việt Nam: the label seal
      if (kd === 'us') {
        const pts: Pt[] = []
        for (let k = 0; k <= 8; k++) pts.push([(k % 2 ? 1 : -1) * pw * 0.07 + pw * 0.05, topL * 0.97 + ((y0 - topL * 0.97) * k) / 8])
        kids.push(s('path', { class: 't30l-crack', d: stroke(pts, Math.max(1.6, pw * 0.06), 0.2, 0.05, 0.3) }),
          s('path', { class: 't30l-crack-lip', d: stroke(pts.map(([x, yy]) => [x + Math.max(1.2, pw * 0.035), yy] as Pt), Math.max(0.8, pw * 0.018), 0.2, 0.1, 0.3) }))
      }
      if ((kd === 'cn' && RANK[i] === 0) || (kd === 'vn' && RANK[i] === 1)) kids.push(s('rect', { class: 't30l-seal', x: f1(-pw * 0.14), y: f1(-ph * 0.9), width: f1(pw * 0.28), height: f1(pw * 0.32), rx: 1 }))
      const gN = s('g', { class: 't30l-cut' }, ...kids)
      notches[i] = gN
      return gN
    })
    const kids: (SVGElement | null)[] = [
      s('path', { class: 't30l-stone t30l-footing', d: footF, filter: 'url(#ink-rough)' }),
      s('path', { class: 't30l-side', d: footS }),
      s('path', { class: 't30l-ledge', d: footT }),
      s('path', { class: 't30l-stone', d: front, filter: 'url(#ink-rough)' }),
      kd === 'cn' ? s('path', { class: 't30l-col-dark', d: grain }) : null,
      s('path', { class: 't30l-shade', d: front, fill: 'url(#t30l-face-g)' }),
      s('path', { class: 't30l-side', d: side }),
      s('path', { class: 't30l-side-dim', d: side }),
      cap ? s('path', { class: 't30l-cap', d: cap, filter: 'url(#ink-rough)' }) : null,
      joints ? s('path', { class: 't30l-joint', d: joints }) : null,
      s('path', { class: 't30l-wetband', d: `M${f1(-w2)} ${f1(y0)}L${f1(-w2 * 0.99)} ${f1(y0 - bh * 0.3)}Q0 ${f1(y0 - bh * 0.33)} ${f1(w2 * 0.99)} ${f1(y0 - bh * 0.29)}L${f1(w2 + sw)} ${f1(y0 - lift)}L${f1(w2)} ${f1(y0)}Z` }),
      kd === 'eu' ? s('path', { class: 't30l-grain', d: grain }) : null,
      s('path', { class: 't30l-moss', d: moss, filter: 'url(#ink-wash)' }),
      // the lit edge: on the side face when the moon is to the right, on the front's left edge when it is to the left
      s('path', { class: 't30l-rim', d: stroke([[w2 + sw, y0 - lift - bh * 0.04], [tw + sw, -ph - lift]], Math.max(1, pw * 0.05), 0.2, 0.1, 0.2) + stroke([[fw + sw, -lift], [fw + sw, -fh - lift]], Math.max(1, pw * 0.04), 0.1, 0.1, 0.3) }),
      s('path', { class: 't30l-rim-l', d: stroke([[-w2, y0 - bh * 0.04], [-tw, topL]], Math.max(1, pw * 0.05), 0.2, 0.1, 0.2) + stroke([[-fw, -1], [-fw, -fh]], Math.max(1, pw * 0.04), 0.1, 0.1, 0.3) }),
      ...cuts,
      s('path', { class: 't30l-run', d: runs }),
      s('path', { class: 't30l-drip', d: drips }),
      kd === 'vn' ? s('path', { class: 't30l-gloss', d: stroke([[w2 * 0.55, -ph * 0.9], [w2 * 0.6, -ph * 0.35]], Math.max(1, pw * 0.08), 0.3, 0.4, 0.1) }) : null,
    ]
    // the contact shadow lies under the footing; the cast shadow falls away from the moon (moved in onStep)
    const g = s('g', { class: `t30l-pillar t30l-${kd} up${kd === 'vn' ? ' wet' : ''}`, transform: `translate(${f1(base[0])} ${f1(base[1])})` },
      s('path', { class: 't30l-cast', d: `M${f1(-fw)} 1L${f1(fw + sw)} 1L${f1(fw * 0.7)} ${f1(pw * 0.5)}L${f1(-fw * 1.5)} ${f1(pw * 0.5)}Z` }),
      s('ellipse', { class: 't30l-foot', cx: f1(sw * 0.4), cy: f1(pw * 0.03), rx: f1(fw * 1.25), ry: f1(Math.max(2, pw * 0.1)) }),
      s('g', { class: 't30l-rise' }, ...kids.filter(Boolean) as SVGElement[]))
    const refl = s('g', { class: 't30l-refl up', transform: `translate(${f1(base[0])} ${f1(base[1] + pw * 0.05)}) scale(1 ${tall ? -0.6 : -0.85})` },
      s('path', { d: body, fill: 'url(#t30l-stripe)' }))
    return { g, refl }
  }

  /** under each pillar's foot: the place's name, then the words of its latest law; the board on the sand (band px) */
  function placeWords(band: Element) {
    PLACES.forEach((_, c) => {
      const [x, y] = feet[c] ?? [0, 0]
      names[c].style.left = carved[c].style.left = `${f1(x - L0)}px`
      names[c].style.top = `${f1(y - T0)}px`
      carved[c].style.top = `${f1(y - T0)}px`
      if (!names[c].isConnected) band.append(names[c], carved[c])
    })
    Object.assign(board.style, { left: `${f1(boardAt.x - boardAt.w / 2 - L0)}px`, top: `${f1(boardAt.y - T0)}px`, width: `${f1(boardAt.w)}px` })
  }

  let root: HTMLElement | null = null
  const scene = progressTide(tide, {
    label: S.label, prompt: S.prompt, insight: S.insight as Fact, detail: S.detail as Fact, aria: S.sliderAria, art,
    track: (g) => {
      frame(g)
      return (t) => {
        const [x, y] = arc(warp(t))
        return [x - L0, y - T0]
      }
    },
    onStep(i, t) {
      tauTo = t
      if (ctx.reduced) (tau = t), water()
      else loop.start()
      // every law whose date has passed is cut into its pillar; the one being read is lit
      const band = ctx.art.querySelector('.p2t-band')
      if (band && feet.length) placeWords(band)
      const passed = (k: number) => k / N <= t + 0.02
      notches.forEach((n, k) => {
        n.classList.toggle('up', passed(k))
        n.classList.toggle('on', k === i)
      })
      pillars.forEach((p, c) => p.classList.toggle('on', i < N && COL[i] === c))
      if (road) road.style.transform = `translateX(${f1(arc(t)[0])}px)`
      // the moon's side: lit edges and shadows follow it (one variable, read by CSS)
      root?.style.setProperty('--moon-x', clamp(warp(t) * 2 - 1, -1, 1).toFixed(2))
      if (i !== cur) {
        cur = i
        // under each pillar, the words of its latest law so far
        PLACES.forEach((_, c) => {
          const last = MS.map((_, k) => k).filter((k) => COL[k] === c && passed(k)).pop()
          const txt = last === undefined ? '' : NOTCH[last]
          if (carved[c].textContent !== txt) carved[c].textContent = txt
          carved[c].classList.toggle('on', i < N && COL[i] === c)
        })
        if (i === N && past < 0) {
          past = N
          dot?.done()
          way?.done()
          // then a board: what this means for someone making content in Việt Nam (after the reading had its moment)
          const tm = window.setTimeout(() => root?.classList.add('has-board'), ctx.reduced ? 0 : 2600)
          ctx.onCleanup(() => clearTimeout(tm))
        }
      }
    },
  })
  ctx.art.append(h('p', { class: 'visually-hidden' }, S.art))
  scene.mount(ctx)
  root = ctx.art.querySelector('.p2t')
  root?.classList.add('t30l')
  ctx.art.querySelector('.p2t-band')?.append(board)
  // guide: a dot on the moon (it leans along the arc when idle), the dotted arc itself (H1, H2)
  const gd = guide(ctx)
  const moonEl = ctx.art.querySelector<HTMLElement>('.p2t-moon')
  dot = moonEl ? gd.dot(moonEl, { dir: [1, 0] }) : null
  way = gd.track(() => Array.from({ length: 33 }, (_, k) => arc(k / 32)))
  way.el.classList.add('t30l-way')
  // H7: the moon nudges toward the next year
  const invite = () => {
    if (past >= 0 || ctx.reduced || !moonEl) return
    moonEl.animate([{ translate: '0 0' }, { translate: '12px 0' }, { translate: '0 0' }], { duration: 900, easing: 'ease-in-out' })
  }
  ctx.el.addEventListener('p2:idle', invite)
  ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', invite))
}
