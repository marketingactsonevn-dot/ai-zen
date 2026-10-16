import { h, s, viDate } from '../../core/dom'
import type { Fact } from '../../core/content'
import { createLoop } from '../../core/loop'
import type { SceneCtx } from '../types'
import { progressTide, type TideGeo } from '../../ui/part2/tide'
import type { Tide } from '../../ui/part2/types'
import { blob, clamp, curve, rng, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist } from '../../ui/part2/paint'
import { C } from './data'
import { f1, P } from './kit'

const S = C.scenes.laws
const tide = S.tide as Tide
const MS = tide.milestones
const N = MS.length
type Kind = 'eu' | 'cn' | 'us' | 'vn'

/** Which stone a law is cut from, read off its label's place name (VI or EN): EU granite, China basalt, US slate, Việt Nam pale stone with a red seal. */
const kind = (label: string, i: number): Kind =>
  /^EU\b/i.test(label) ? 'eu' : /Trung Quốc|China/i.test(label) ? 'cn' : /^(Mỹ|US|U\.S\.)/i.test(label) ? 'us' : /Việt Nam|Vietnam/i.test(label) || i === N - 1 ? 'vn' : 'eu'
const place = (label: string) => (label.includes(':') ? label.split(':')[0].trim() : label)
const RANK: Record<Kind, number> = { eu: 0, us: 1, cn: 2, vn: 3 }
const ASPECT: Record<Kind, number> = { eu: 3, cn: 2.6, us: 3.6, vn: 3.1 }

/**
 * II·12 "laws" (2.5D, progressTide): GRAZE from the sea at night. The painting fills the whole frame: the camera floats
 * just offshore; the beach curves from far left (thin, at the horizon, lost in mist) to near right. Eight carved pillars
 * stand along it with a strong fall-off in size: the EU pillar of the Omnibus towers in the right foreground, the other
 * EU laws, the US, China and Việt Nam recede along the curve. Drag the moon over the sea (← → Home End): the tide draws
 * back toward you — wet sand widens behind a foam line, each pillar rises as its date passes with water streaming off
 * its face and its reflection opening on the wet sand. The two deadlines are carved at two notches on the EU pillar and
 * the water mark jumps from the old one to the new. Việt Nam's last pillar stays wet; past today a ninth waits under
 * the shallows. The reading sits low on the water at the left, never in a band of its own.
 */
export function lawsScene(ctx: SceneCtx) {
  const kinds = MS.map((m, i) => kind(m.label, i))
  const hero = Math.max(0, MS.findIndex((m) => m.compare))
  // how far back each law stands: the compared EU pillar nearest, then EU, US, China, Việt Nam, "today" farthest left
  const order = MS.map((_, i) => i).sort((a, b) =>
    +(b === hero) - +(a === hero) || +(a === N - 1) - +(b === N - 1) || RANK[kinds[a]] - RANK[kinds[b]] || (kinds[a] === 'eu' ? b - a : a - b))
  const slot: number[] = []
  order.forEach((i, k) => (slot[i] = k))

  let pillars: SVGGElement[] = [], refls: SVGGElement[] = []
  let marks: Pt[] = [] // the top of each pillar, band px (for its label)
  let sea: SVGPathElement | null = null, foam: SVGPathElement | null = null, road: SVGGElement | null = null
  let edge: ((tau: number) => string) | null = null
  let foamAt: ((tau: number) => string) | null = null
  let tau = 0, tauTo = 0, cur = -1
  // the frame round the component's band (the painting bleeds to the frame edges): band offset and frame size, px
  let L0 = 0, T0 = 0, W = 0, H = 0, tall = false
  const tag = h('p', { class: 't30l-tag', 'aria-hidden': 'true' })
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
  // the beach in frame px: back edge B(u) from far left (u 0, at the horizon) to near right (u 1), depth D(u) toward us
  // (a phone: the beach climbs more steeply toward the horizon so the pillars stagger up the frame instead of crowding)
  const beach = () => {
    const hz = H * (tall ? 0.3 : 0.4)
    const yN = H * (tall ? 0.62 : 0.64)
    const X = (u: number) => W * (tall ? -0.02 + 0.73 * u : 0.94 * u)
    const B = (u: number): Pt => [X(u), hz + 3 + (yN - hz) * Math.pow(Math.max(0, u), tall ? 1.4 : 1.85)]
    const D = (u: number) => H * (0.006 + (tall ? 0.24 : 0.3) * Math.pow(Math.max(0, u), 2.2))
    return { hz, B, D, heroH: H * (tall ? 0.33 : 0.46), uMax: tall ? 1.48 : 1.14 }
  }
  const slotU = (k: number) => 0.82 - 0.685 * Math.pow(k / Math.max(1, N - 1), 0.72)
  const slotS = (k: number) => 1 / (1 + 0.9 * k)
  // the moon's arc over the sea, frame px
  const arc = (t: number): Pt => {
    const c = clamp(t, 0, 1)
    return tall ? [W * (0.12 + 0.76 * c), H * 0.15 - Math.sin(Math.PI * c) * H * 0.08] : [W * (0.28 + 0.4 * c), H * 0.22 - Math.sin(Math.PI * c) * H * 0.12]
  }

  const art = {
    back(g: TideGeo): SVGElement[] {
      frame(g)
      const r = rng(g.seed + 5)
      const { hz, B, D, heroH, uMax } = beach()
      const us = Array.from({ length: 57 }, (_, k) => (k / 56) * uMax)
      const back = us.map(B)
      const at = (u: number, k: number): Pt => [B(u)[0], B(u)[1] + D(u) * k]
      const lineAt = (k: number) => us.map((u) => at(u, k))
      // the water edge across the beach (k 0 = the high-water line … 1 = the near edge), a slow swell along it
      const waterline = (t: number) => {
        const k = 0.04 + 0.96 * t
        return us.map((u) => [B(u)[0], B(u)[1] + D(u) * k + Math.sin(u * 23 + t * 3) * D(u) * 0.025] as Pt)
      }
      edge = (t: number) => `M${f1(-W * 0.05)} ${f1(hz)}L${waterline(t).map(P).join('L')}L${f1(W * 1.05)} ${f1(H * 1.05)}L${f1(-W * 0.05)} ${f1(H * 1.05)}Z`
      foamAt = (t: number) => {
        const pts = waterline(t)
        let d = stroke(pts.slice(2), Math.max(1, H * 0.0024), 0.5, 0.02, 0.12)
        // lace: broken bubbles just behind the edge, longer and thicker near
        for (let i = 3; i < pts.length; i++) {
          if ((i * 7) % 3 === 0) continue
          const u = us[i], [x, y] = pts[i]
          const len = W * (0.004 + u * 0.02), dy = D(u) * (0.04 + ((i * 5) % 4) * 0.025) + 1.5
          d += stroke([[x - len / 2, y + dy], [x + len / 2, y + dy + 0.4]], 0.5 + u * 1.6, 0.3, 0.3, 0.1)
        }
        return d
      }
      // ── the pillars, nearest to farthest
      pillars = []
      refls = []
      marks = []
      for (let i = 0; i < N; i++) {
        const k = slot[i], u = slotU(k), kd = kinds[i]
        const base = at(u, 0.42)
        const ph = heroH * slotS(k), pw = ph / (ASPECT[kd] * (k === 0 && tall ? 0.82 : 1)) // a phone's hero is stouter: its dates must fit
        marks[i] = [base[0] - L0, base[1] - ph - (kd === 'eu' ? pw * 0.5 : kd === 'vn' ? pw * 0.36 : pw * 0.12) - T0]
        const { g: pg, refl } = pillar(i, kd, base, pw, ph, g.seed + i * 13)
        pillars[i] = pg
        refls[i] = refl
      }
      // the ninth, past today: a dark shape under the shallows beyond the farthest pillar, its top just breaking water
      const n9 = at(0.07, 1.6)
      const pw9 = heroH * slotS(N) / 2.8, ph9 = pw9 * 2.8
      const ninth = s('g', { class: 't30l-ninth', transform: `translate(${f1(n9[0])} ${f1(n9[1])})` },
        s('path', { class: 't30l-ghost', d: `M${f1(-pw9 * 0.5)} ${f1(ph9 * 0.5)}L${f1(-pw9 * 0.46)} ${f1(-ph9 * 0.3)}Q0 ${f1(-ph9 * 0.52)} ${f1(pw9 * 0.46)} ${f1(-ph9 * 0.3)}L${f1(pw9 * 0.5)} ${f1(ph9 * 0.5)}Z` }),
        s('path', { class: 't30l-ghost-top', d: blob(0, -ph9 * 0.36, pw9 * 0.34, pw9 * 0.1, g.seed + 90, 0.2, 9) }),
        s('path', { class: 't30l-ghost-ring', d: stroke(curve([-pw9 * 1.2, -ph9 * 0.3], [0, -ph9 * 0.22], [pw9 * 1.2, -ph9 * 0.3], 8), 1, 0.3, 0.3, 0.2) }))
      // ── land, sand, sea
      const land = `M${back.map(P).join('L')}L${f1(W * 1.08)} ${f1(hz - H * 0.09)}L${f1(W * 0.4)} ${f1(hz - H * 0.03)}L${f1(-W * 0.06)} ${f1(hz - H * 0.005)}Z`
      const dry = `M${back.map(P).join('L')}L${[...lineAt(0.05)].reverse().map(P).join('L')}Z`
      const wet = `M${lineAt(0.05).map(P).join('L')}L${[...lineAt(1.02)].reverse().map(P).join('L')}Z`
      let wrack = '', pools = '', pebbles = ''
      for (let i = 0; i < 70; i++) {
        const u = Math.pow(r(), 0.7) * uMax, [x, y] = at(u, 0.04 + r() * 0.04)
        wrack += blob(x, y, H * (0.001 + u * 0.004), H * (0.0006 + u * 0.0018), g.seed + 200 + i, 0.3, 6)
      }
      for (let i = 0; i < 14; i++) {
        const u = 0.35 + r() * (uMax - 0.35), [x, y] = at(u, 0.3 + r() * 0.6)
        pools += blob(x, y, W * (0.008 + u * 0.03) * (0.5 + r()), D(u) * (0.03 + r() * 0.04), g.seed + 300 + i, 0.25, 12)
      }
      for (let i = 0; i < 22; i++) {
        const u = 0.25 + r() * (uMax - 0.25), [x, y] = at(u, 0.15 + r() * 0.8)
        const rr = H * (0.002 + u * 0.007) * (0.5 + r())
        pebbles += blob(x, y, rr, rr * 0.55, g.seed + 400 + i, 0.2, 8)
      }
      let tufts = ''
      for (let i = 0; i < 26; i++) {
        const u = 0.3 + r() * 0.84, [x, y] = B(u)
        const hh = H * (0.006 + u * 0.02) * (0.6 + r() * 0.6)
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
      const stop = (o: number, a: number, c = 't30l-sea-st') => s('stop', { offset: o, class: c, style: `stop-opacity:${a}` })
      return [s('g', { class: 't30l-art', transform: `translate(${f1(-L0)} ${f1(-T0)})` },
        s('defs', null,
          s('linearGradient', { id: 't30l-sea-g', gradientUnits: 'userSpaceOnUse', x1: 0, y1: f1(hz), x2: 0, y2: f1(H) },
            stop(0, 0.55), stop(0.08, 0.92), stop(0.45, 0.8), stop(1, 0.98)),
          s('linearGradient', { id: 't30l-wet-g', gradientUnits: 'userSpaceOnUse', x1: 0, y1: f1(hz), x2: 0, y2: f1(H * 0.9) },
            stop(0, 1, 't30l-wet-st'), stop(1, 0.7, 't30l-wet-st')),
          s('pattern', { id: 't30l-stripe', width: 9, height: 5, patternUnits: 'userSpaceOnUse' }, s('rect', { class: 't30l-stripe', width: 9, height: 3 }))),
        mist(W * 0.62, hz - H * 0.16, W * 0.6, H * 0.22),
        hills(W * 0.32, W * 1.1, hz - H * 0.03, H * 0.15, g.seed + 1, 0.9, 4),
        hills(W * 0.6, W * 1.12, hz - H * 0.01, H * 0.11, g.seed + 2, 0.6, 2),
        s('path', { class: 't30l-land', d: land, filter: 'url(#ink-wash)' }),
        mist(W * 0.42, hz - H * 0.01, W * 0.62, H * 0.025), // a band of sea mist on the far water, behind the pillars
        s('path', { class: 't30l-tuft', d: tufts }),
        s('path', { class: 't30l-sand', d: dry }),
        s('path', { class: 't30l-wet', d: wet, fill: 'url(#t30l-wet-g)' }),
        s('path', { class: 't30l-crest', d: stroke(back.slice(6), Math.max(1, H * 0.003), 0.5, 0.05, 0.2) }),
        s('path', { class: 't30l-pool', d: pools }),
        s('path', { class: 't30l-pebble', d: pebbles }),
        s('path', { class: 't30l-wrack', d: wrack }),
        ...[...order].reverse().map((i) => refls[i]),
        ...[...order].reverse().map((i) => pillars[i]),
        sea, foam,
        s('path', { class: 'p2p-ripple t30l-rip', d: rip }),
        road,
        ninth,
        // the far left dissolves into mist where the beach curves away
        mist(-W * 0.02, hz + H * 0.02, W * 0.3, H * 0.13))]
    },
    mark: () => s('g'),
  }

  /** One pillar on the beach at `base`: stone, shade, a wet band low down, carving, moonlit rim, rivulets; the EU hero
   *  carries the two notches with their dates. Its reflection is a striped, flipped silhouette on the wet sand. */
  function pillar(i: number, kd: Kind, base: Pt, pw: number, ph: number, seed: number) {
    const rr = rng(seed)
    const w2 = pw / 2, tw = w2 * 0.93 // a slight taper
    const sw = pw * 0.24 // the side face toward the moon (right), seen in a sliver
    const lift = sw * 0.45
    // the cap: EU a pyramidion, China a basalt slab, the US a slanted cut, Việt Nam a small stele roof
    const capH = kd === 'eu' ? pw * 0.5 : kd === 'vn' ? pw * 0.36 : kd === 'cn' ? pw * 0.14 : 0
    const topL = kd === 'us' ? -ph * 0.93 : -ph
    const front = `M${f1(-w2)} 0L${f1(-tw)} ${f1(topL)}L${f1(tw)} ${f1(-ph)}L${f1(w2)} 0Z`
    const side = `M${f1(w2)} 0L${f1(w2 + sw)} ${f1(-lift)}L${f1(tw + sw)} ${f1(-ph - lift)}L${f1(tw)} ${f1(-ph)}Z`
    const cap = kd === 'eu'
      ? `M${f1(-tw)} ${f1(-ph)}L${f1(sw * 0.4)} ${f1(-ph - capH)}L${f1(tw + sw)} ${f1(-ph - lift)}L${f1(tw)} ${f1(-ph)}Z`
      : kd === 'vn'
        ? `M${f1(-tw * 1.3)} ${f1(-ph + pw * 0.02)}Q${f1(-tw * 0.9)} ${f1(-ph - capH * 0.35)} ${f1(sw * 0.3)} ${f1(-ph - capH)}Q${f1(tw + sw)} ${f1(-ph - capH * 0.4)} ${f1(tw * 1.3 + sw)} ${f1(-ph - lift + pw * 0.02)}L${f1(tw)} ${f1(-ph + pw * 0.06)}L${f1(-tw)} ${f1(-ph + pw * 0.06)}Z`
        : kd === 'cn'
          ? `M${f1(-tw * 1.1)} ${f1(-ph + 1)}L${f1(-tw * 1.1)} ${f1(-ph - capH * 0.6)}L${f1(-tw * 0.7 + sw)} ${f1(-ph - capH * 0.6 - lift)}L${f1(tw * 1.1 + sw)} ${f1(-ph - capH * 0.6 - lift)}L${f1(tw * 1.1 + sw)} ${f1(-ph - lift + 1)}L${f1(tw * 1.1)} ${f1(-ph + 1)}Z`
          : `M${f1(-tw)} ${f1(topL)}L${f1(tw)} ${f1(-ph)}L${f1(tw + sw)} ${f1(-ph - lift)}L${f1(-tw + sw * 0.6)} ${f1(topL - lift * 0.8)}Z`
    const body = front + side + cap
    let carve = ''
    const rows = Math.max(3, Math.round(ph / Math.max(5, pw * 0.2)))
    for (const cx of [-pw * 0.16, pw * 0.14]) for (let j = 0; j < rows; j++) {
      const y = -ph * 0.86 + (j * ph * 0.62) / rows
      carve += stroke([[cx - pw * 0.09, y], [cx + pw * 0.08, y + pw * 0.03]], Math.max(0.7, pw * 0.06), 0.2, 0.3, 0.3)
    }
    let grain = ''
    if (kd === 'us') for (let y = -ph * 0.85; y < 0; y += ph * 0.11) grain += `M${f1(-w2)} ${f1(y + rr() * 2)}L${f1(w2)} ${f1(y - pw * 0.06 + rr() * 2)}`
    if (kd === 'eu') for (let q = 0; q < 18; q++) grain += blob(-w2 * 0.8 + rr() * pw * 0.8, -ph * rr() * 0.95, pw * 0.025, pw * 0.025, seed + q, 0.2, 5)
    // rivulets running off the face as it rises, a few drips at its foot
    let runs = ''
    for (let j = 0; j < 4; j++) {
      const x = -w2 * 0.75 + (j + rr() * 0.6) * pw * 0.2
      const y0 = -ph * (0.55 + rr() * 0.35)
      runs += stroke(curve([x, y0], [x + pw * 0.04 * (rr() - 0.5), y0 * 0.5], [x + pw * 0.02, -1], 8), Math.max(0.6, pw * 0.025), 0.3, 0.05, 0.2)
    }
    let drips = ''
    for (let j = 0; j < 5; j++) drips += blob(-w2 * 0.8 + rr() * pw * 0.8, 1 + rr() * pw * 0.06, Math.max(0.8, pw * 0.03), Math.max(0.6, pw * 0.018), seed + 50 + j, 0.2, 6)
    const isHero = i === hero, cmp = MS[i].compare
    const kids: (SVGElement | null)[] = [
      s('path', { class: 't30l-stone', d: front, filter: 'url(#ink-rough)' }),
      s('path', { class: 't30l-shade', d: front }),
      s('path', { class: 't30l-side', d: side }),
      cap ? s('path', { class: 't30l-cap', d: cap, filter: 'url(#ink-rough)' }) : null,
      s('path', { class: 't30l-wetband', d: `M${f1(-w2)} 0L${f1(-w2 * 0.99)} ${f1(-ph * 0.3)}Q0 ${f1(-ph * 0.33)} ${f1(w2 * 0.99)} ${f1(-ph * 0.29)}L${f1(w2 + sw)} ${f1(-lift)}L${f1(w2)} 0Z` }),
      grain ? s('path', { class: 't30l-grain', d: grain }) : null,
      s('path', { class: 't30l-carve', d: carve }),
      s('path', { class: 't30l-rim', d: stroke([[w2 + sw, -lift - ph * 0.05], [tw + sw, -ph - lift]], Math.max(1, pw * 0.05), 0.2, 0.1, 0.2) }),
      kd === 'vn' ? s('rect', { class: 't30l-seal', x: f1(-pw * 0.13), y: f1(-ph * 0.9), width: f1(pw * 0.26), height: f1(pw * 0.3), rx: 1 }) : null,
      s('path', { class: 't30l-run', d: runs }),
      s('path', { class: 't30l-drip', d: drips }),
      i === N - 1 ? s('path', { class: 't30l-gloss', d: stroke([[w2 * 0.55, -ph * 0.9], [w2 * 0.6, -ph * 0.35]], Math.max(1, pw * 0.08), 0.3, 0.4, 0.1) }) : null,
    ]
    if (isHero && cmp) {
      // two notches carved across the face, each date carved just above it, its label beside the stone
      const ys = [0.34, 0.56].map((k) => -ph * k)
      const dfs = clamp(pw * 0.135, 10.5, 15), lfs = clamp(pw * 0.11, 10, 12.5)
      const label = (txt: string | undefined, y: number) => {
        if (!txt) return null
        const max = tall ? 10 : 15 // characters a line
        const lines: string[] = []
        for (const w of txt.split(' ')) {
          const last = lines.length - 1
          if (last >= 0 && (lines[last] + ' ' + w).length <= max) lines[last] += ' ' + w
          else lines.push(w)
        }
        return s('text', { class: 't30l-notch-label', x: f1(w2 + sw + 7), y: f1(y - lift - (lines.length - 1) * lfs * 0.6), 'font-size': f1(lfs), 'dominant-baseline': 'central' },
          ...lines.map((l, j) => s('tspan', { x: f1(w2 + sw + 7), dy: j ? f1(lfs * 1.2) : '0' }, l)))
      }
      kids.push(
        s('path', { class: 't30l-notch', d: ys.map((y) => stroke([[-w2, y], [w2, y + 1], [w2 + sw, y + 1 - lift]], Math.max(1.6, pw * 0.05), 0.02, 0.02, 0.8)).join('') }),
        s('path', { class: 't30l-notch-lip', d: ys.map((y) => `M${f1(-w2 + 1)} ${f1(y + Math.max(1.6, pw * 0.05) * 0.7)}L${f1(w2 - 1)} ${f1(y + 1 + Math.max(1.6, pw * 0.05) * 0.7)}`).join('') }),
        s('text', { class: 't30l-date', x: 0, y: f1(ys[0] - dfs * 0.75), 'font-size': f1(dfs), 'text-anchor': 'middle' }, cmp.before),
        s('text', { class: 't30l-date new', x: 0, y: f1(ys[1] - dfs * 0.75), 'font-size': f1(dfs), 'text-anchor': 'middle' }, cmp.after),
        label(cmp.beforeLabel, ys[0]), label(cmp.afterLabel, ys[1]),
        s('path', { class: 't30l-mark', style: `--jump:${f1(ys[1] - ys[0])}px`, d: `M${f1(-w2 * 1.15)} ${f1(ys[0])}h${f1(pw * 1.3)}` }))
    }
    const cid = `t30l-c${i}`
    const g = s('g', { class: `t30l-pillar t30l-${kd}${i === N - 1 ? ' wet' : ''}${isHero ? ' hero' : ''}`, transform: `translate(${f1(base[0])} ${f1(base[1])})` },
      s('clipPath', { id: cid }, s('rect', { x: f1(-pw * 3), y: f1(-ph * 2), width: f1(pw * 6), height: f1(ph * 2 + 0.5) })),
      s('ellipse', { class: 't30l-foot', cx: f1(pw * 0.1), cy: f1(pw * 0.04), rx: f1(pw * 0.75), ry: f1(Math.max(1.5, pw * 0.12)) }),
      s('g', { 'clip-path': `url(#${cid})` }, s('g', { class: 't30l-rise', style: `--sink:${f1(ph + capH + lift + 3)}px` }, ...kids.filter(Boolean) as SVGElement[])))
    const refl = s('g', { class: 't30l-refl', transform: `translate(${f1(base[0])} ${f1(base[1] + pw * 0.05)}) scale(1 ${tall ? -0.55 : -0.75})` },
      s('path', { d: body, fill: 'url(#t30l-stripe)' }))
    return { g, refl }
  }

  const scene = progressTide(tide, {
    label: S.label, prompt: S.prompt, insight: S.insight as Fact, aria: S.sliderAria, art,
    track: (g) => {
      frame(g)
      return (t) => {
        const [x, y] = arc(t)
        return [x - L0, y - T0]
      }
    },
    onStep(i, t) {
      tauTo = t
      if (ctx.reduced) (tau = t), water()
      else loop.start()
      pillars.forEach((p, k) => {
        const up = k / N <= t + 0.02
        p.classList.toggle('up', up)
        p.classList.toggle('on', k === i)
        refls[k]?.classList.toggle('up', up)
      })
      if (road) road.style.transform = `translateX(${f1(arc(t)[0])}px)`
      if (i !== cur) {
        cur = i
        const band = ctx.art.querySelector('.p2t-band')
        if (i < N && marks[i] && band) {
          tag.textContent = `${place(MS[i].label)} · ${viDate(MS[i].date).slice(-4)}`
          Object.assign(tag.style, { left: `${f1(marks[i][0])}px`, top: `${f1(marks[i][1])}px` })
          tag.classList.add('on')
          if (!tag.isConnected) band.append(tag)
        } else tag.classList.remove('on')
      }
    },
  })
  ctx.art.append(h('p', { class: 'visually-hidden' }, S.art))
  scene.mount(ctx)
  ctx.art.querySelector('.p2t')?.classList.add('t30l')
}
