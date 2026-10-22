import './window.css'
import { h, s } from '../../core/dom'
import { sliced } from '../../core/chunk'
import type { SceneDef } from '../types'
import { progressTide, type TideGeo } from '../../ui/part2/tide'
import { clamp, onSize, rng, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import { guide, type Mark, type Track } from '../../ui/part2/guide'
import { hills, mist, pine, steppingStones } from '../../ui/part2/paint'
import { C } from './data'
import { f1 } from './kit'

const S = C.scenes.window

/** One book seen from the front, standing on (x, y), w × hh: cover, a page block of dó paper on the open edge, the
 *  spine's two bands; lying flat (flat) it shows its long edge: two boards and the pages between. */
function book(x: number, y: number, w: number, hh: number, tone: number, flat: boolean, r: () => number) {
  const out: SVGElement[] = []
  const P = (pts: Pt[]) => `M${pts.map(([a, b]) => `${f1(a)} ${f1(b)}`).join('L')}Z`
  if (flat) {
    const b = Math.max(1.2, hh * 0.2)
    out.push(
      s('path', { class: `g8w3-cover b${tone % 5}`, d: P([[x, y], [x + w, y], [x + w, y - hh], [x, y - hh]]) }),
      s('path', { class: 'g8w3-pages', d: P([[x + w * 0.04, y - b], [x + w - 1.2, y - b], [x + w - 1.2, y - hh + b], [x + w * 0.04, y - hh + b]]) }),
      s('path', { class: 'g8w3-leaf', d: stroke([[x + w * 0.06, y - hh / 2], [x + w - 3, y - hh / 2 + (r() - 0.5) * 0.4]], 0.6, 0.1, 0.1, 0.3) }),
      s('path', { class: 'g8w3-bshade', d: P([[x + w * 0.62, y], [x + w, y], [x + w, y - hh], [x + w * 0.62, y - hh]]) }),
      s('path', { class: 'g8w3-bline', d: stroke([[x, y], [x, y - hh], [x + w, y - hh], [x + w, y], [x, y]], 0.8, 0.05, 0.05, 0.4) }))
  } else {
    out.push(
      s('path', { class: `g8w3-cover b${tone % 5}`, d: P([[x, y], [x + w, y], [x + w, y - hh], [x, y - hh]]) }),
      s('path', { class: 'g8w3-pages', d: P([[x + w * 0.82, y - 1], [x + w + w * 0.08, y - 2], [x + w + w * 0.08, y - hh + 2], [x + w * 0.82, y - hh + 1]]) }),
      s('path', { class: 'g8w3-bline', d: stroke([[x, y - hh * 0.12], [x + w * 0.8, y - hh * 0.12]], 0.9, 0.1, 0.1, 0.3) + stroke([[x, y - hh * 0.88], [x + w * 0.8, y - hh * 0.88]], 0.9, 0.1, 0.1, 0.3) + stroke([[x, y], [x, y - hh], [x + w, y - hh], [x + w, y], [x, y]], 0.9, 0.05, 0.05, 0.4) }),
      s('path', { class: 'g8w3-bshade', d: P([[x + w * 0.55, y], [x + w * 0.82, y], [x + w * 0.82, y - hh], [x + w * 0.55, y - hh]]) }))
  }
  return out
}

/** What a milestone's stele carries on its top, standing on (0, 0), about u wide: a slip with one sentence (2017), a few
 *  pages (2020), a novel (2023), a stack of ten novels (today, about a million tokens), a whole shelf (the 10M claim). */
function carried(i: number, u: number, seed: number): SVGElement[] {
  const r = rng(seed)
  const out: SVGElement[] = []
  const sheet = (x: number, y: number, w: number, hh: number, a: number, lines: number) => {
    const rot = ([px, py]: Pt): Pt => [x + px * Math.cos(a) - py * Math.sin(a), y + px * Math.sin(a) + py * Math.cos(a)]
    const c = ([[-w / 2, 0], [w / 2, 0], [w / 2, -hh], [-w / 2 + w * 0.1, -hh], [-w / 2, -hh + w * 0.1]] as Pt[]).map(rot)
    let ink = ''
    for (let k = 1; k <= lines; k++) {
      const yy = -hh + (hh * k) / (lines + 1.2)
      ink += stroke([rot([-w * 0.34, yy]), rot([w * (0.1 + r() * 0.24), yy])], Math.max(0.7, w * 0.035), 0.2, 0.3, 0.3)
    }
    out.push(
      s('path', { class: 'g8w3-sheet', d: `M${c.map(([px, py]) => `${f1(px)} ${f1(py)}`).join('L')}Z` }),
      s('path', { class: 'g8w3-sheetink', d: ink }),
      s('path', { class: 'g8w3-bline', d: stroke([...c, c[0]], 0.8, 0.05, 0.05, 0.4) }))
  }
  if (i === 0) sheet(0, 0, u * 0.42, u * 0.62, -0.03, 1)
  else if (i === 1) for (const [dx, a] of [[-u * 0.2, -0.16], [u * 0.02, -0.02], [u * 0.2, 0.14]] as const) sheet(dx, 0, u * 0.44, u * 0.6, a, 5)
  else if (i === 2) {
    out.push(...book(-u * 0.24, 0, u * 0.34, u * 0.82, 0, false, r))
    sheet(u * 0.3, 0, u * 0.26, u * 0.34, 0.14, 3)
  } else if (i === 3) {
    let y = 0
    for (let k = 0; k < 10; k++) {
      const bw = u * (0.86 - k * 0.025 + r() * 0.06), bh = u * (0.075 + r() * 0.025)
      out.push(...book(-bw / 2 + (r() - 0.5) * u * 0.07, y, bw, bh, k + 1, true, r))
      y -= bh
    }
  } else {
    const sw = u * 1.05, sh = u * 1.2, x0 = -sw / 2
    let wood = stroke([[x0, 2], [x0, -sh]], 2.2, 0.02, 0.05, 0.6) + stroke([[x0 + sw, 2], [x0 + sw, -sh]], 2.2, 0.02, 0.05, 0.6) + stroke([[x0 - 2, -sh], [x0 + sw + 2, -sh]], 2.4, 0.05, 0.05, 0.6)
    for (let k = 0; k < 3; k++) {
      const base = -k * (sh / 3)
      wood += stroke([[x0 - 1, base], [x0 + sw + 1, base]], 1.8, 0.05, 0.05, 0.6)
      for (let x = x0 + 3; x < x0 + sw - 5;) {
        const bw = u * (0.06 + r() * 0.06), bh = (sh / 3) * (0.62 + r() * 0.3)
        if (x + bw > x0 + sw - 3) break
        out.push(s('path', { class: `g8w3-cover b${Math.floor(r() * 5)}`, d: `M${f1(x)} ${f1(base - 1.5)}h${f1(bw)}v${f1(-bh)}h${f1(-bw)}Z` }))
        x += bw + 0.6
      }
    }
    out.push(s('path', { class: 'g8w3-shelf', d: wood }))
  }
  return out
}

/** A dressed garden stele w × hh on a low plinth, standing on (0, 0): its face in three tones (moonlit top and left rim,
 *  a shaded right flank), a contact shadow on the sand, and what the window could read carved into its face. */
function stele(w: number, hh: number, carve: string, fs: number): SVGElement[] {
  const ph = Math.max(4, hh * 0.1)
  const face = `M${f1(-w / 2)} ${f1(-ph)}L${f1(-w / 2)} ${f1(-hh * 0.9)}Q${f1(-w / 2)} ${f1(-hh)} ${f1(-w * 0.32)} ${f1(-hh)}L${f1(w * 0.32)} ${f1(-hh)}Q${f1(w / 2)} ${f1(-hh)} ${f1(w / 2)} ${f1(-hh * 0.9)}L${f1(w / 2)} ${f1(-ph)}Z`
  const lines = carve.split('\n')
  const y0 = -hh * 0.56 - ((lines.length - 1) * fs * 1.15) / 2
  return [
    s('ellipse', { class: 'g8w3-contact', cx: f1(w * 0.06), cy: 1, rx: f1(w * 0.86), ry: f1(Math.max(2.5, w * 0.11)) }),
    s('path', { class: 'g8w3-plinth', d: `M${f1(-w * 0.66)} 1L${f1(-w * 0.6)} ${f1(-ph)}L${f1(w * 0.6)} ${f1(-ph)}L${f1(w * 0.66)} 1Z` }),
    s('path', { class: 'g8w3-plinthlit', d: stroke([[-w * 0.6, -ph + 0.6], [w * 0.6, -ph + 0.6]], 1.2, 0.05, 0.05, 0.4) }),
    s('path', { class: 'g8w3-face', d: face, fill: 'url(#p2-rock)' }),
    s('path', { class: 'g8w3-flank', d: `M${f1(w * 0.22)} ${f1(-ph)}L${f1(w * 0.22)} ${f1(-hh)}L${f1(w * 0.32)} ${f1(-hh)}Q${f1(w / 2)} ${f1(-hh)} ${f1(w / 2)} ${f1(-hh * 0.9)}L${f1(w / 2)} ${f1(-ph)}Z` }),
    s('path', { class: 'g8w3-rim', d: stroke([[-w / 2 + 1, -hh * 0.3], [-w / 2 + 1, -hh * 0.9], [-w * 0.32, -hh + 1], [w * 0.24, -hh + 1]], Math.max(1.2, w * 0.035), 0.2, 0.3, 0.2) }),
    s('path', { class: 'g8w3-outline', d: face, filter: 'url(#ink-rough)' }),
    s('text', { class: 'g8w3-carve', y: f1(y0), 'font-size': f1(fs), 'text-anchor': 'middle' }, ...lines.map((l, k) => s('tspan', { x: 0, dy: k ? f1(fs * 1.15) : 0 }, l))),
  ]
}

/**
 * Scene 4 (comp + 2.5D, audit v3 22-4 "Làm lại") — inside a dark tea room, the shōji wall is most of the picture: a
 * transom (ranma) of slender kumiko across the top, the moon a glow behind its paper riding a rail with four notches
 * (the years under them), and four sliding panels below. Dragging the moon past a notch slides a panel away onto one deep
 * garden in one-point perspective — night ranges, mist on the horizon, raked sand running to the vanishing point, and a
 * stele rising in each opening with what that year's window could read on its top and the figure carved in its face: a
 * sentence (2017), a few pages (2020), a novel (2023), a stack of ten novels today, the 10-million claim only a pale
 * shelf far back in the mist. Moonlight falls in through every opening as a long trapezoid on the tatami.
 * Beat 2: at today a long scroll unrolls on the mats; drag the vermilion seal ("what matters") along it — the reading
 * lamp burns bright at both ends and dims in the middle (lost in the middle) → insight, written in the moonlight on the
 * mats (text zone bottom-left), and mist settles over the middle steles.
 */
export const windowScene: SceneDef = {
  label: S.label,
  text: 'bl',
  mount(ctx) {
    let panels: Element[] = [], rises: Element[] = [], beams: Element[] = [], openEdges: number[] = []
    let scene: SVGGElement | null = null
    let glow: SVGGElement | null = null, paperGlow: SVGRadialGradientElement | null = null
    let track: ((t: number) => Pt) | null = null
    const room = s('svg', { class: 'g8w3-room', 'aria-hidden': 'true' })
    ctx.art.append(h('p', { class: 'visually-hidden' }, S.art), room)
    let shown = 0, lastT = 0
    const n = S.tide.milestones.length // stops 0…n-1 milestones, n = today (the tide's own last stop)
    const wide = () => ctx.art.clientWidth > 720

    /** The shōji's lines in band px (transom rail, sill, horizon, vanishing point), and where the band sits in the art. */
    function plan(g: TideGeo) {
      const band = ctx.art.querySelector<HTMLElement>('.p2t-band')
      const ox = parseFloat(band?.style.left ?? '') || 0, oy = parseFloat(band?.style.top ?? '') || 0
      const W = 2 * ox + g.w, H = Math.max(ctx.art.clientHeight, oy + g.h + 40)
      const top = 6, sill = g.h - 5
      const rb = clamp(g.h * 0.19, 50, 96) // the transom's lower rail
      const rail = top + (rb - top) * 0.46 // the moon's rail
      const hz = rb + (sill - rb) * 0.4 // eye level: the garden's horizon
      const vx = g.w * 0.58
      const fy = oy + g.h - 4 // the floor meets the wall
      band?.style.setProperty('--g8w3-dy', `${f1(rail + 14)}px`)
      return { ox, oy, W, H, top, sill, rb, rail, hz, vx, fy }
    }

    // the painting is built over a few frames the first time (README A.10); a re-layout builds it in one go
    let job: { cancel(): void } | null = null
    let first = true
    ctx.onCleanup(() => job?.cancel())
    function back(g: TideGeo): SVGElement[] {
      job?.cancel()
      const sc = s('g', { class: 'g8w3-scene' })
      scene = sc
      panels = []
      rises = []
      job = sliced(build(g, sc), { sync: ctx.reduced || !first })
      first = false
      return [sc]
    }

    function* build(g: TideGeo, sc: SVGGElement) {
      const { w, xs, roll, seed } = g
      const r = rng(seed + 22)
      const p = plan(g)
      const { top, sill, rb, rail, hz, vx } = p
      // the openings, one per stop; at the right end of the wall a pocket (tobukuro) the opened panels slide into, the
      // edge of each left showing at its mouth, stacked a few px apart
      const stackGap = w > 600 ? 9 : 5
      const pocketX = Math.min(w - roll - 2 - stackGap * (n + 1) - 10, xs[n] + (xs[1] - xs[0]) * 0.62)
      const caseX = pocketX + stackGap * (n + 1) + 4
      const edges = [roll + 2, ...xs.slice(1).map((x, k) => (xs[k] + x) / 2), pocketX]
      openEdges = edges
      const P = (x: number, y: number) => `${f1(x)} ${f1(y)}`
      // where a ground line through (x, y0) toward the vanishing point is at height y
      const toward = (x: number, y0: number, y: number) => vx + ((x - vx) * (y - hz)) / (y0 - hz)
      const panelW = xs[1] - xs[0], ph = sill - rb
      const base = sill - (sill - hz) * 0.42 // the steles' feet, all at one depth, well back from the sill
      const sw = clamp(panelW * 0.4, 52, 86), sh = Math.max(ph * 0.34, sw * 1.3)
      const u = sw * 1.02
      const fs = clamp(sw * 0.21, 12.5, 17)
      // ── the garden beyond: night sky, far ranges, mist on the horizon, raked sand curving in to the vanishing point
      let rake = '', rakeHi = ''
      for (let x = -w * 0.6, k = 0; x < w * 1.6; x += 5, k++) {
        if (k % 5 > 2) continue
        const swing = Math.sin(x * 0.006 + seed) * (sill - hz) * 0.9
        const x0 = toward(x, sill, hz + 3), mx = (x0 + x) / 2 + swing, my = hz + (sill - hz) * 0.62
        const d = `M${P(x0, hz + 3)}Q${P(mx, my)} ${P(x, sill + 2)}`
        if (k % 5 === 1) rakeHi += d
        else rake += d
      }
      const noiseId = `g8w3-noise-${seed}`
      const grain: SVGElement[] = []
      for (let k = 0; k < 18; k++) grain.push(s('circle', { cx: f1(r() * 40), cy: f1(r() * 30), r: f1(0.5 + r() * 0.9), opacity: f1(0.25 + r() * 0.6) }))
      const shadowId = `g8w3-pine-${seed}`
      sc.append(
        s('defs', null,
          s('linearGradient', { id: `g8w3-sky-${seed}`, x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, class: 'g8w3-s0' }), s('stop', { offset: 1, class: 'g8w3-s1' })),
          s('linearGradient', { id: `g8w3-sand-${seed}`, x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, class: 'g8w3-sd0' }), s('stop', { offset: 1, class: 'g8w3-sd1' })),
          s('linearGradient', { id: `g8w3-pp-${seed}`, x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, class: 'g8w3-p0' }), s('stop', { offset: 0.55, class: 'g8w3-p1' }), s('stop', { offset: 1, class: 'g8w3-p2' })),
          // the paper glows where the moon is behind it and darkens away from it (its centre follows the moon)
          (paperGlow = s('radialGradient', { id: `g8w3-pg-${seed}`, gradientUnits: 'userSpaceOnUse', cx: 0, cy: 0, r: f1(w * 0.42) }, s('stop', { offset: 0, class: 'g8w3-g0' }), s('stop', { offset: 0.35, class: 'g8w3-g1' }), s('stop', { offset: 1, class: 'g8w3-g2' }))),
          s('pattern', { id: noiseId, width: 40, height: 30, patternUnits: 'userSpaceOnUse' }, ...grain),
          s('clipPath', { id: `g8w3-f${seed}` }, s('rect', { x: f1(edges[0]), y: f1(rb), width: f1(w - roll - 2 - edges[0]), height: f1(sill - rb) })),
          s('clipPath', { id: `g8w3-rm-${seed}` }, s('rect', { x: f1(edges[0]), y: top, width: f1(w - roll - 2 - edges[0]), height: f1(rb - top) })),
          s('linearGradient', { id: `g8w3-psh-${seed}`, x1: 0, y1: 0, x2: 1, y2: 0 }, s('stop', { offset: 0, class: 'g8w3-sh0' }), s('stop', { offset: 1, class: 'g8w3-sh1' })),
          // a pine outside, its moon shadow on the paper (one drawing, used by every panel so it slides with it)
          s('g', { id: shadowId, class: 'g8w3-pineshadow' }, pine(w * 0.3, sill + ph * 0.2, ph * 1.15, seed + 31, 1), pine(w * 0.82, sill + ph * 0.35, ph * 0.9, seed + 32, -1))),
        s('rect', { class: 'g8w3-sky', x: 0, y: top, width: f1(w), height: f1(hz - top + 2), fill: `url(#g8w3-sky-${seed})` }),
        mist(vx, hz - (hz - rb) * 0.3, w * 0.55, (hz - rb) * 0.6),
        hills(roll, w - roll, hz + 2, (hz - rb) * 0.62, seed + 4, 0.9, 6),
        hills(w * 0.02, w * 0.44, hz + 2, (hz - rb) * 0.42, seed + 5, 0.5, 2),
        hills(w * 0.7, w * 1.02, hz + 2, (hz - rb) * 0.34, seed + 6, 0.55, 2),
        mist(vx, hz, w * 0.7, (sill - hz) * 0.12),
        s('rect', { class: 'g8w3-sand', x: 0, y: f1(hz), width: f1(w), height: f1(sill - hz), fill: `url(#g8w3-sand-${seed})` }),
        s('rect', { class: 'g8w3-noise', x: 0, y: f1(hz), width: f1(w), height: f1(sill - hz), fill: `url(#${noiseId})` }),
        s('path', { class: 'g8w3-rake', d: rake }),
        s('path', { class: 'g8w3-rake hi', d: rakeHi }),
        mist(vx, hz + 3, w * 0.62, (sill - hz) * 0.16))
      yield
      // ── mid-ground: a pine on a mossy bank at each end of the garden (cut by the frame, it gives the depth a scale),
      // stepping stones from the sill to today's stele, mossy rocks by the steles
      const tx = xs[n]
      const stones = steppingStones([vx + (tx - vx) * 0.2, sill + 8], [tx - sw * 0.2, base + 4], 6, clamp(sw * 0.5, 22, 44), seed + 41)
      const rocks: SVGElement[] = []
      for (let k = 0; k <= n; k++) {
        if (k === 1 || k === n) continue
        const side = k % 2 ? -1 : 1
        rocks.push(s('g', { transform: `translate(${f1(xs[k] + side * sw * 0.85)} ${f1(base + 3)})` }, stoneArt(sw * 0.5, sw * 0.28, seed + 50 + k)))
      }
      sc.append(
        s('g', { class: 'g8w3-bank' }, pine((xs[0] + xs[1]) / 2 + panelW * 0.12, hz + (base - hz) * 0.22, ph * 0.44, seed + 61, 1), pocketX - xs[n] < 190 ? null : pine(pocketX - panelW * 0.12, hz + (base - hz) * 0.4, ph * 0.42, seed + 62, -1)),
        ...rocks, stones)
      yield
      // ── steles rising from the sand, each carrying what that year's window could read, its figure carved in the face
      let rings = ''
      for (let k = 0; k <= n; k++) for (let q = 1; q <= 3; q++) rings += `M${P(xs[k] - sw * (0.7 + q * 0.3), base + 1)}a${f1(sw * (0.7 + q * 0.3))} ${f1(sw * (0.14 + q * 0.06))} 0 1 0 ${f1(sw * (1.4 + q * 0.6))} 0`
      sc.append(s('path', { class: 'g8w3-rake ring', d: rings }))
      const rise = (k: number, kids: SVGElement[]) => s('g', { class: `g8w3-rise r${k}` }, ...kids)
      const on = (x: number, k: number, it: number, sd: number) => s('g', { transform: `translate(${f1(x)} ${f1(base)})` }, ...stele(sw, sh, S.carve[k], fs), s('g', { transform: `translate(0 ${f1(-sh)})` }, ...carried(it, u, sd)))
      for (let k = 0; k < n; k++) rises.push(rise(k, [on(xs[k], k, k, seed + k * 13)]))
      // today: about a million tokens, a stack of ten novels (not a library: that would teach the 10-million claim); the
      // maker's own 10-million claim stands far back in the mist, pale, its caveat written under it
      const right = pocketX - tx, fx0 = tx + Math.min(panelW * 0.5, right * 0.56), fy0 = hz + (base - hz) * 0.22, fk = 0.38
      const claim = S.claim.split(' · ')
      rises.push(rise(n, [
        s('g', { class: 'g8w3-claim', transform: `translate(${f1(fx0)} ${f1(fy0)}) scale(${fk})` }, ...stele(sw, sh, '', fs).slice(0, -1), s('g', { transform: `translate(0 ${f1(-sh)})` }, ...carried(4, u, seed + 77))),
        mist(fx0, fy0 - sh * 0.15, panelW * 0.5, sh * 0.25),
        // (no room beside it on a phone: its caveat in the sky over it, flush with the panel's edge, clear of the stack)
        right < 190
          ? s('text', { class: 'g8w3-claimtxt', y: f1(fy0 - (sh + u * 1.2) * fk - 22), 'text-anchor': 'end' }, ...claim.map((l, k) => s('tspan', { x: f1(pocketX - 6), dy: k ? 13 : 0 }, l)))
          : s('text', { class: 'g8w3-claimtxt', x: f1(fx0), y: f1(fy0 + 15), 'text-anchor': 'middle' }, S.claim),
        on(tx, n, 3, seed + 3 * 13),
      ]))
      // lost in the middle: once the seal has been along the scroll, mist settles over the middle steles
      const mid = (xs[1] + xs[n - 1]) / 2, span = xs[n - 1] - xs[1]
      sc.append(...rises,
        s('g', { class: 'g8w3-lost' },
          s('defs', null, s('radialGradient', { id: `g8w3-fog-${seed}` }, s('stop', { offset: 0, class: 'g8w3-fg0' }), s('stop', { offset: 0.6, class: 'g8w3-fg1' }), s('stop', { offset: 1, class: 'g8w3-fg2' }))),
          s('ellipse', { cx: f1(mid), cy: f1(base - sh * 0.75), rx: f1(span * 0.5 + panelW * 0.5), ry: f1(sh * 1.05), fill: `url(#g8w3-fog-${seed})` })))
      yield
      // ── the shōji: one sliding panel per stop on the sill's grooves; opened, a panel slides right across the others into
      // the pocket and stops with its edge (stile, a strip of paper) showing at the mouth, its shadow on the one under it.
      // Thin kumiko (many light rails, few stiles), the paper lit where the moon is behind it
      panels = edges.slice(0, -1).map((a, k) => {
        const b = edges[k + 1]
        let lat = ''
        const cols = Math.max(2, Math.round((b - a) / 36))
        for (let c = 1; c < cols; c++) {
          const x = a + ((b - a) * c) / cols + (r() - 0.5) * 0.6
          lat += `M${P(x, rb)}L${P(x + (r() - 0.5) * 0.5, sill)}`
        }
        for (let y = rb + 20; y < sill - 8; y += 22 + r() * 1.5) lat += `M${P(a, y)}L${P(b, y + (r() - 0.5) * 0.6)}`
        // the panel's own frame (kamachi) and its finger pull
        const fr = stroke([[a + 2, rb + 1], [a + 2, sill - 1]], 3.2, 0.01, 0.01, 0.8) + stroke([[b - 2, rb + 1], [b - 2, sill - 1]], 3.2, 0.01, 0.01, 0.8) + stroke([[a, sill - 8], [b, sill - 8]], 5, 0.01, 0.01, 0.8)
        return s('g', null,
          s('g', { class: `g8w3-panel p${k}`, style: `--to:${f1(pocketX + stackGap * (n - k) - a)}px` },
            s('rect', { class: 'g8w3-pshade', x: f1(a - 10), y: f1(rb), width: 10, height: f1(sill - rb), fill: `url(#g8w3-psh-${seed})` }),
            // (the paper, the pine's shadow on it and the lattice clipped to the panel itself, moving with it)
            s('clipPath', { id: `g8w3-pc${seed}-${k}` }, s('rect', { x: f1(a), y: f1(rb), width: f1(b - a), height: f1(sill - rb) })),
            s('g', { 'clip-path': `url(#g8w3-pc${seed}-${k})` },
              s('rect', { class: 'g8w3-paper', x: f1(a), y: f1(rb), width: f1(b - a), height: f1(sill - rb), fill: `url(#g8w3-pp-${seed})` }),
              s('rect', { class: 'g8w3-paperglow', x: f1(a), y: f1(rb), width: f1(b - a), height: f1(sill - rb), fill: `url(#g8w3-pg-${seed})` }),
              s('use', { href: `#${shadowId}`, class: 'g8w3-pineuse' }),
              s('path', { class: 'g8w3-kumiko', d: lat })),
            s('path', { class: 'g8w3-wood', d: fr }),
            s('ellipse', { class: 'g8w3-pull', cx: f1(a + 12), cy: f1(rb + ph * 0.55), rx: 3, ry: 7 })))
      })
      // the transom: fixed washi under slender slats; the moon glows behind it, the lattice dark across the glow; a rail
      // groove along it with a notch at each year (the dates sit under the notches)
      let ranma = ''
      const rx0 = edges[0], rx1 = w - roll - 2, rh = rb - top
      for (let x = rx0 + 5; x < rx1; x += 9) ranma += `M${P(x, top)}L${P(x, rb)}`
      ranma += `M${P(rx0, top + rh * 0.2)}L${P(rx1, top + rh * 0.2)}`
      for (const a of edges) ranma += `M${P(a, top)}L${P(a, rb)}`
      glow = s('g', { class: 'g8w3-moon' },
        s('circle', { class: 'g8w3-halo', r: f1(Math.min(110, rh * 1.6)), fill: 'url(#g8w3-mglow)' }),
        s('circle', { class: 'g8w3-disc', r: f1(Math.min(17, rh * 0.3)), fill: 'url(#g8w3-mdisc)' }))
      let notches = ''
      for (const x of xs) notches += `M${P(x, rail - 7)}L${P(x, rail + 7)}`
      let posts = ''
      // (no posts between the openings: the panels run on one track; a post at each end of the wall)
      for (const x of [edges[0], w - roll - 2]) posts += stroke([[x, top], [x + (r() - 0.5) * 0.6, (rb + sill) / 2], [x, sill]], 5, 0.01, 0.02, 0.8)
      sc.append(
        // the pocket's dark mouth, the panels (the first to open on top: it slides across the others), the casing's face
        s('rect', { class: 'g8w3-mouth', x: f1(pocketX), y: f1(rb), width: f1(caseX - pocketX), height: f1(sill - rb) }),
        s('g', { 'clip-path': `url(#g8w3-f${seed})` }, ...[...panels].reverse()),
        s('path', { class: 'g8w3-wood', d: `M${P(caseX, rb)}L${P(w - roll - 2, rb)}L${P(w - roll - 2, sill)}L${P(caseX, sill)}Z` }),
        s('path', { class: 'g8w3-woodlit', d: stroke([[caseX + 1, rb + 2], [caseX + 1, sill - 2]], 1.2, 0.02, 0.02, 0.6) }),
        s('defs', null,
          s('radialGradient', { id: 'g8w3-mglow' }, s('stop', { offset: 0, class: 'g8w3-m0' }), s('stop', { offset: 0.3, class: 'g8w3-m1' }), s('stop', { offset: 1, class: 'g8w3-m2' })),
          s('radialGradient', { id: 'g8w3-mdisc' }, s('stop', { offset: 0, class: 'g8w3-d0' }), s('stop', { offset: 0.7, class: 'g8w3-d1' }), s('stop', { offset: 1, class: 'g8w3-d2' }))),
        s('g', { 'clip-path': `url(#g8w3-rm-${seed})` },
          s('rect', { class: 'g8w3-ranma', x: f1(rx0), y: top, width: f1(rx1 - rx0), height: f1(rh) }),
          glow,
          s('path', { class: 'g8w3-kumiko ranma', d: ranma })),
        s('path', { class: 'g8w3-groove', d: stroke([[xs[0] - 14, rail], [xs[n] + 14, rail]], 2.6, 0.05, 0.05, 0.5) }),
        s('path', { class: 'g8w3-notch', d: notches }),
        s('path', { class: 'g8w3-post', d: posts }),
        // the transom's rails and the sill (shikii): dark wood, their moonlit upper edges; the sill's two grooves
        s('path', { class: 'g8w3-wood', d: stroke([[roll, top + 2], [w / 2, top + 2.5], [w - roll, top + 2]], 6, 0.01, 0.01, 0.7) + stroke([[roll, rb], [w / 2, rb + 0.5], [w - roll, rb]], 6.5, 0.01, 0.01, 0.7) + `M${P(roll, sill)}L${P(w - roll, sill)}L${P(w - roll, sill + 8)}L${P(roll, sill + 8)}Z` }),
        s('path', { class: 'g8w3-woodlit', d: stroke([[roll, rb - 2.6], [w - roll, rb - 2.6]], 1, 0.02, 0.02, 0.6) + stroke([[roll, sill + 0.6], [w - roll, sill + 0.6]], 1.2, 0.02, 0.02, 0.6) }),
        s('path', { class: 'g8w3-sillgroove', d: `M${P(roll, sill + 3)}L${P(w - roll, sill + 3)}M${P(roll, sill + 5.6)}L${P(w - roll, sill + 5.6)}` }))
      track = (t: number) => [xs[0] + (xs[n] - xs[0]) * t, rail]
      moonAt(lastT, false)
      yield
      drawRoom(g, p)
    }

    /** the moon behind the transom, and the paper's glow round it, follow the thumb (a glide when it snaps to a stop) */
    function moonAt(t: number, snap: boolean) {
      lastT = t
      if (!glow || !track) return
      const [x, y] = track(t)
      glow.style.transition = snap && !ctx.reduced ? 'transform 0.55s var(--ease)' : 'none'
      glow.style.transform = `translate(${f1(x)}px,${f1(y)}px)`
      paperGlow?.setAttribute('cx', f1(x))
      paperGlow?.setAttribute('cy', f1(y))
    }

    /**
     * The tea room round the shōji (an SVG behind it, the whole art area): the lintel (kamoi) over it with the decoding
     * line carved in it on a wide screen, posts either side, an alcove (tokonoma) with a hanging scroll on its hook on the
     * left, an andon standing on the mats on the right with its warm pool; tatami with dark borders and the rush's grain
     * running to the garden's vanishing point; moonlight thrown in through each open panel as a long trapezoid.
     */
    function drawRoom(g: TideGeo, p: ReturnType<typeof plan>) {
      const { ox, oy, W, H, fy } = p
      const hz = oy + p.hz, vx = ox + p.vx
      const P = (x: number, y: number) => `${f1(x)} ${f1(y)}`
      room.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
      room.style.height = `${f1(H)}px`
      const r = rng(g.seed + 7)
      const at = (x: number, y: number) => vx + ((x - vx) * (y - hz)) / (fy - hz) // a line from (x, fy) to the vanishing point, at y
      const unit = Math.max(120, (fy - hz) / 1.3) // a mat's width where the floor meets the wall
      const Z0 = 7
      const rowY = (k: number) => hz + ((fy - hz) * Z0) / (Z0 - k)
      let heri = '', seams = '', weave = ''
      for (let j = -14; j <= 14; j++) {
        const xa = vx + j * unit, xb = at(xa, H + 40)
        if (Math.max(xa, xb) < -60 || Math.min(xa, xb) > W + 60) continue
        const w0 = unit * 0.02, w1 = w0 * ((H + 40 - hz) / (fy - hz))
        heri += `M${P(xa - w0, fy)}L${P(xa + w0, fy)}L${P(xb + w1, H + 40)}L${P(xb - w1, H + 40)}Z`
        // the rush's grain: fine lines along the mat, toward the vanishing point
        for (let q = 1; q < 10; q++) {
          const x0 = xa + (unit * q) / 10
          weave += `M${P(x0, fy)}L${P(at(x0, H + 40), H + 40)}`
        }
        for (let k = (j & 1) + 1; k < Z0; k += 2) {
          const y = rowY(k)
          if (y > H + 10) break
          seams += `M${P(at(xa, y), y)}L${P(at(xa + unit, y), y)}`
        }
      }
      // moonlight through each open panel: from the sill, nearer and wider, a little skewed away from the moon
      const edges = openEdges
      const y1 = Math.min(H + 20, rowY(3.6)), skew = -0.28
      beams = edges.slice(0, -1).map((e, k) => {
        const a = ox + e + 6, b = ox + edges[k + 1] - 6
        const xa1 = at(a, y1) + skew * (y1 - fy), xb1 = at(b, y1) + skew * (y1 - fy)
        return s('g', { class: `g8w3-beam k${k}` }, s('path', { class: 'g8w3-light', d: `M${P(a, fy)}L${P(b, fy)}L${P(xb1, y1)}L${P(xa1, y1)}Z`, fill: 'url(#g8w3-beam)' }))
      })
      const sideW = Math.max(0, ox - 14)
      const big = sideW > 70
      // the andon: a paper box on four legs, standing on the mats by the right wall (its legs on the floor, a contact shadow)
      const ax = W - sideW * 0.5, aw = clamp(sideW * 0.44, 28, 46), ah = aw * 1.8, ay = fy + clamp((H - fy) * 0.22, 16, 40)
      const andon = big ? s('g', { class: 'g8w3-andon' },
        s('ellipse', { cx: f1(ax), cy: f1(ay - ah * 0.6), rx: f1(sideW * 1.6), ry: f1(ah * 1.4), fill: 'url(#g8w3-andon)' }),
        s('ellipse', { class: 'g8w3-ashadow', cx: f1(ax + 4), cy: f1(ay + 2), rx: f1(aw * 0.8), ry: 4 }),
        s('rect', { class: 'g8w3-andon-box', x: f1(ax - aw / 2), y: f1(ay - ah), width: f1(aw), height: f1(ah * 0.78) }),
        s('path', { class: 'g8w3-andon-frame', d: `M${P(ax - aw / 2 - 2, ay - ah)}h${f1(aw + 4)}M${P(ax - aw / 2 - 2, ay - ah * 0.22)}h${f1(aw + 4)}M${P(ax - aw / 2, ay - ah)}V${f1(ay)}M${P(ax + aw / 2, ay - ah)}V${f1(ay)}M${P(ax, ay - ah)}v${f1(ah * 0.78)}` })) : null
      // the tokonoma: a recess, its post, a hanging scroll on a cord from a hook under the lintel, a stone on the floor board
      const kam = Math.max(0, oy - 4)
      const scrollW = sideW * 0.46, sx = sideW * 0.5, sTop = kam + 26, sBot = fy - (fy - kam) * 0.2
      const toko = big ? s('g', { class: 'g8w3-toko' },
        s('rect', { class: 'g8w3-toko-in', x: 8, y: f1(kam + 6), width: f1(sideW - 16), height: f1(fy - kam + 2) }),
        s('path', { class: 'g8w3-cord', d: `M${P(sx, kam + 10)}L${P(sx - scrollW * 0.4, sTop)}M${P(sx, kam + 10)}L${P(sx + scrollW * 0.4, sTop)}` }),
        s('circle', { class: 'g8w3-hook', cx: f1(sx), cy: f1(kam + 10), r: 2.2 }),
        s('rect', { class: 'g8w3-kake-silk', x: f1(sx - scrollW / 2), y: f1(sTop), width: f1(scrollW), height: f1(sBot - sTop) }),
        s('rect', { class: 'g8w3-kake-paper', x: f1(sx - scrollW * 0.38), y: f1(sTop + 12), width: f1(scrollW * 0.76), height: f1((sBot - sTop) * 0.74) }),
        hills(sx - scrollW * 0.36, sx + scrollW * 0.36, sTop + 12 + (sBot - sTop) * 0.6, (sBot - sTop) * 0.3, g.seed + 9, 0.3, 2),
        s('path', { class: 'g8w3-kake-rod', d: stroke([[sx - scrollW * 0.62, sBot], [sx + scrollW * 0.62, sBot]], 4, 0.05, 0.05, 0.6) + stroke([[sx - scrollW * 0.55, sTop], [sx + scrollW * 0.55, sTop]], 3, 0.05, 0.05, 0.6) }),
        s('rect', { class: 'g8w3-tokoboard', x: 8, y: f1(fy - 8), width: f1(sideW - 16), height: 10 }),
        s('g', { transform: `translate(${f1(sideW * 0.62)} ${f1(fy - 8)})` }, stoneArt(sideW * 0.3, sideW * 0.16, g.seed + 19))) : null
      // the lintel (kamoi) wall to wall over the shōji, posts either side down to the floor
      const decodeOnLintel = wide() && oy >= 26
      const lintel = `M0 0L${f1(W)} 0L${f1(W)} ${f1(oy + 7)}L0 ${f1(oy + 7)}Z`
      const postL = sideW > 10 ? `M${P(ox - 14, oy)}L${P(ox + 4, oy)}L${P(ox + 4, fy + 2)}L${P(ox - 14, fy + 2)}Z` : ''
      const postR = sideW > 10 ? `M${P(ox + g.w - 4, oy)}L${P(ox + g.w + 14, oy)}L${P(ox + g.w + 14, fy + 2)}L${P(ox + g.w - 4, fy + 2)}Z` : ''
      let grainW = ''
      for (let k = 0; k < 5; k++) {
        const y = (oy + 4) * (0.2 + k * 0.16) + (r() - 0.5) * 2
        grainW += stroke([[r() * W * 0.2, y], [W * (0.5 + r() * 0.5), y + (r() - 0.5) * 1.2]], 0.8, 0.2, 0.3, 0.2)
      }
      room.replaceChildren(...[
        s('defs', null,
          s('linearGradient', { id: 'g8w3-beam', x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, class: 'g8w3-b0' }), s('stop', { offset: 1, class: 'g8w3-b1' })),
          s('linearGradient', { id: 'g8w3-floor', x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, class: 'g8w3-fl0' }), s('stop', { offset: 1, class: 'g8w3-fl1' })),
          s('linearGradient', { id: 'g8w3-wallg', x1: 0, y1: 0, x2: 1, y2: 0 }, s('stop', { offset: 0, class: 'g8w3-wl0' }), s('stop', { offset: 0.5, class: 'g8w3-wl1' }), s('stop', { offset: 1, class: 'g8w3-wl0' })),
          s('radialGradient', { id: 'g8w3-andon' }, s('stop', { offset: 0, class: 'g8w3-a0' }), s('stop', { offset: 1, class: 'g8w3-a1' }))),
        s('rect', { class: 'g8w3-wall', width: f1(W), height: f1(fy + 2), fill: 'url(#g8w3-wallg)' }),
        s('rect', { class: 'g8w3-floor', y: f1(fy), width: f1(W), height: f1(H - fy + 2), fill: 'url(#g8w3-floor)' }),
        s('path', { class: 'g8w3-weave', d: weave }),
        s('path', { class: 'g8w3-mats', d: seams }),
        s('path', { class: 'g8w3-heri', d: heri }),
        ...beams,
        s('rect', { class: 'g8w3-floorshade', y: f1(fy), width: f1(W), height: 18 }),
        toko,
        andon,
        s('path', { class: 'g8w3-woodrm', d: lintel + postL + postR }),
        s('path', { class: 'g8w3-woodgrain', d: grainW }),
        s('path', { class: 'g8w3-woodhi', d: stroke([[0, oy + 6], [W, oy + 6]], 1.2, 0.02, 0.02, 0.5) + (sideW > 10 ? stroke([[ox - 13, oy + 8], [ox - 13, fy]], 1.2, 0.02, 0.02, 0.5) : '') }),
        decodeOnLintel ? s('text', { class: 'g8w3-lintel', x: f1(W / 2), y: f1(oy * 0.5 + 6), 'text-anchor': 'middle' }, S.decode) : null,
      ].filter((x): x is SVGElement => !!x))
      decode.hidden = decodeOnLintel
      lay()
      onStep(shown, lastT)
    }

    function onStep(i: number, t: number) {
      moonAt(t, !!ctx.art.querySelector('.p2t-moon.snap'))
      panels.forEach((p, k) => p.firstElementChild?.classList.toggle('open', k <= i))
      rises.forEach((p, k) => p.classList.toggle('up', k <= i))
      beams.forEach((p, k) => p.classList.toggle('open', k <= i))
      if (i > shown) ctx.chime(i >= n ? 'ok' : 'soft')
      shown = i
      if (i >= n) unroll()
    }

    // ── beat 2: the long scroll on the mats, and the seal dragged along it
    const g = guide(ctx)
    let moonDot: Mark | null = null, sealDot: Mark | null = null, way: Track | null = null
    const lamp = h('i', { class: 'g8w3-lamp', 'aria-hidden': 'true' })
    const seal = h('div', { class: 'g8w3-seal', role: 'slider', tabindex: '0', 'aria-label': S.sealAria, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, h('span', null, S.sealLabel))
    const scroll = h('div', { class: 'g8w3-scroll', 'aria-hidden': 'true' }, h('i', { class: 'g8w3-scrollshadow' }), h('i', { class: 'g8w3-paperstrip' }), h('i', { class: 'g8w3-fog' }), h('i', { class: 'g8w3-rod a' }), h('i', { class: 'g8w3-rod b' }))
    const beat = h('div', { class: 'g8w3-beat' }, scroll, lamp, seal)
    const decode = h('p', { class: 'g8w3-decode' }, S.decode)
    const sc2 = { x0: 0, x1: 0, y: 0, on: false, t: 0, mid: false, end: false, done: false }
    /** where the card, the decoding line and the scroll lie on the mats (from the band's inline box: no layout read) */
    function lay() {
      const band = ctx.art.querySelector<HTMLElement>('.p2t-band')
      if (!band) return
      const W = ctx.art.clientWidth, H = ctx.art.clientHeight
      const oy = parseFloat(band.style.top) || 0, bh = parseFloat(band.style.height) || 0, fy = oy + bh
      const wd = W > 720
      const root = ctx.art.querySelector<HTMLElement>('.p2t')
      // the reading: ink on the mats, bottom-left (where the insight comes later); on a phone under the decoding line
      root?.style.setProperty('--g8w3-card', `${f1(fy + (wd ? 14 : 58))}px`)
      decode.style.top = `${f1(fy + 8)}px`
      const span = wd ? [W * 0.5, W - Math.max(40, (W - parseFloat(band.style.width)) / 2 + 30)] : [70, W - 44]
      sc2.x0 = span[0]
      sc2.x1 = span[1]
      sc2.y = wd ? fy + Math.max(44, (H - fy) * 0.42) : Math.max(fy + 150, H - 54)
      Object.assign(scroll.style, { left: `${f1(sc2.x0 - 30)}px`, top: `${f1(sc2.y - 24)}px`, width: `${f1(sc2.x1 - sc2.x0 + 60)}px` })
      seat(sc2.t)
      g.refresh()
    }
    /** how well the reading lamp keeps what the seal marks at t (0 start … 1 end): bright at both ends, dim in the middle */
    const keep = (t: number) => 0.18 + 0.82 * Math.abs(2 * t - 1) ** 1.6
    function seat(t: number) {
      sc2.t = clamp(t, 0, 1)
      const x = sc2.x0 + (sc2.x1 - sc2.x0) * sc2.t
      seal.style.transform = `translate(${f1(x)}px, ${f1(sc2.y)}px)`
      lamp.style.transform = `translate(${f1(x)}px, ${f1(sc2.y)}px)`
      lamp.style.opacity = keep(sc2.t).toFixed(2)
      seal.style.setProperty('--k', keep(sc2.t).toFixed(2))
      seal.setAttribute('aria-valuenow', String(Math.round(sc2.t * 100)))
      way?.set(sc2.t)
      if (!sc2.on) return
      if (sc2.t > 0.38 && sc2.t < 0.62) sc2.mid = true
      if (sc2.t < 0.12 || sc2.t > 0.88) sc2.end = true
      if (sc2.mid && sc2.end && !sc2.done) {
        sc2.done = true
        sealDot?.done()
        way?.done()
        ctx.chime('ok')
        ctx.art.querySelector('.p2t')?.classList.add('g8w3-done')
        scene?.classList.add('lost')
        ctx.insight(S.insight, [S.detail, S.growth])
      }
    }
    function unroll() {
      if (sc2.on) return
      sc2.on = true
      moonDot?.done()
      ctx.art.querySelector('.p2t')?.classList.add('g8w3-beat2')
      ctx.art.append(beat)
      lay()
      ctx.prompt(S.prompt2)
      way = g.track(() => [[sc2.x0, sc2.y + 34], [sc2.x1, sc2.y + 34]], { ticks: 3, labels: S.ticks })
      sealDot = g.dot(seal, { dir: [1, 0] })
      if (!ctx.reduced) scroll.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 900, easing: 'cubic-bezier(.3,.1,.2,1)' })
    }
    let sid = -1, sx0 = 0
    seal.addEventListener('pointerdown', (e) => {
      sid = e.pointerId
      sx0 = beat.getBoundingClientRect().left // once per drag
      seal.setPointerCapture(sid)
      seal.classList.add('held')
    })
    seal.addEventListener('pointermove', (e) => {
      if (e.pointerId !== sid) return
      seat((e.clientX - sx0 - sc2.x0) / Math.max(1, sc2.x1 - sc2.x0))
    })
    const sup = (e: PointerEvent) => void (e.pointerId === sid && ((sid = -1), seal.classList.remove('held')))
    seal.addEventListener('pointerup', sup)
    seal.addEventListener('pointercancel', sup)
    seal.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 0.1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -0.1 : e.key === 'Home' ? -1 : e.key === 'End' ? 1 : 0
      if (!d) return
      e.preventDefault()
      seat(sc2.t + d)
    })

    // the tide would show the insight at today; here today only starts beat 2 (the insight comes after the scroll). The
    // tide still gets the insight, so it keeps room for it in the art's stable height
    const off = progressTide(S.tide, {
      label: S.label, prompt: S.prompt, insight: S.insight, detail: S.detail,
      art: { back },
      // the shōji wall is most of the picture: wide, room for the alcove and the andon either side; a phone, edge to edge
      band: (W, H) => (W > 720 ? { w: Math.min(W - 2 * Math.max(100, W * 0.085), 1180), h: H * 0.74, top: Math.max(28, H * 0.05) } : { w: W, h: H * 0.62, top: 6 }),
      // the moon rides a rail behind the transom's paper (the scene draws it there: the thumb is only its handle)
      track: ({ xs, h: bh }) => {
        const rail = 6 + (clamp(bh * 0.19, 50, 96) - 6) * 0.46
        return (t) => [xs[0] + (xs[xs.length - 1] - xs[0]) * t, rail]
      },
      thumb: () => s('circle', { class: 'g8w3-thumb', r: 22 }),
      onStep,
    }).mount({ ...ctx, insight: () => h('div'), complete: () => {} })
    ctx.art.querySelector('.p2t')?.classList.add('g8w3')
    ctx.art.append(decode)
    ctx.onCleanup(onSize(ctx.art, lay))
    // H1 on the moon (the slider), leaning the way to drag; H7: still for 6 s, the moon (or the seal) edges 12 px on
    const moonEl = ctx.art.querySelector<HTMLElement>('.p2t-moon')
    if (moonEl) moonDot = g.dot(moonEl, { dir: [1, 0] })
    const nudge = (el: Element | null | undefined) => void (!ctx.reduced && el?.animate([{ translate: '0 0' }, { translate: '12px 0' }, { translate: '0 0' }], { duration: 1400, easing: 'cubic-bezier(.45,.05,.3,1)', composite: 'add' }))
    const idle = () => (sc2.done ? null : sc2.on ? nudge(seal) : shown < n ? (nudge(moonEl?.querySelector('.p2t-moon-disc')), nudge(glow)) : null)
    ctx.el.addEventListener('p2:idle', idle)
    ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', idle))
    return off
  },
}
