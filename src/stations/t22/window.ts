import { h, s } from '../../core/dom'
import { sliced } from '../../core/chunk'
import type { SceneDef } from '../types'
import { progressTide, type TideGeo } from '../../ui/part2/tide'
import { clamp, onSize, rng, stroke, type Pt } from '../../ui/part2/ink'
import { guide, type Mark, type Track } from '../../ui/part2/guide'
import { hills, mist, pine } from '../../ui/part2/paint'
import { C } from './data'
import { f1 } from './kit'

const S = C.scenes.window

/** What each milestone's stele carries, drawn in u (about its width), standing on (0, 0): a letter → pages → a novel → a stack → a whole shelf. */
function carried(i: number, u: number, seed: number): SVGElement[] {
  const r = rng(seed)
  let fillP = '', inkP = '', lines = ''
  const books: SVGElement[] = []
  const sheet = (x: number, y: number, w: number, hh: number, a: number) => {
    const rot = ([px, py]: Pt): Pt => [x + px * Math.cos(a) - py * Math.sin(a), y + px * Math.sin(a) + py * Math.cos(a)]
    const c = [[-w / 2, 0], [w / 2, 0], [w / 2, -hh], [-w / 2 + w * 0.08, -hh], [-w / 2, -hh + w * 0.1]].map((p) => rot(p as Pt))
    fillP += `M${c.map(([px, py]) => `${f1(px)} ${f1(py)}`).join('L')}Z`
    inkP += stroke([...c, c[0]], 1, 0.05, 0.05, 0.4)
    for (let k = 1; k < 6; k++) lines += stroke([rot([-w * 0.32, -hh + (hh * k) / 6.5]), rot([w * (0.05 + r() * 0.28), -hh + (hh * k) / 6.5])], 1, 0.2, 0.3, 0.3)
  }
  const book = (x: number, y: number, w: number, hh: number, tone: number) => {
    books.push(s('path', { class: `g8w2-book b${tone % 5}`, d: `M${f1(x)} ${f1(y)}h${f1(w)}v${f1(-hh)}h${f1(-w)}Z` }))
    inkP += stroke([[x, y], [x, y - hh], [x + w, y - hh], [x + w, y], [x, y]], 0.9, 0.05, 0.05, 0.4)
    lines += hh > w ? stroke([[x + w * 0.2, y - hh * 0.2], [x + w * 0.8, y - hh * 0.2]], 1, 0.1, 0.1, 0.4) : stroke([[x + w * 0.1, y - hh * 0.5], [x + w * 0.9, y - hh * 0.5]], 0.8, 0.1, 0.1, 0.4)
  }
  if (i === 0) {
    // 2017: one written character on a slip
    sheet(0, 0, u * 0.32, u * 0.5, -0.04)
    inkP += stroke([[-u * 0.07, -u * 0.38], [u * 0.06, -u * 0.36]], 2.2, 0.2, 0.3, 0.2) + stroke([[0, -u * 0.42], [-u * 0.02, -u * 0.12]], 2.4, 0.2, 0.4, 0.2) + stroke([[-u * 0.08, -u * 0.22], [u * 0.07, -u * 0.18]], 2, 0.2, 0.3, 0.2)
  } else if (i === 1) for (const [dx, a] of [[-u * 0.16, -0.18], [0, -0.02], [u * 0.15, 0.15]]) sheet(dx, 0, u * 0.4, u * 0.54, a)
  else if (i === 2) {
    book(-u * 0.18, 0, u * 0.36, u * 0.74, 0)
    sheet(u * 0.3, 0, u * 0.24, u * 0.3, 0.12)
  } else if (i === 3) {
    let y = 0
    // today: about ten novels' worth, a stack of ten
    for (let k = 0; k < 10; k++) {
      const bw = u * (0.8 - k * 0.035 + r() * 0.06), bh = u * (0.085 + r() * 0.03)
      book(-bw / 2 + (r() - 0.5) * u * 0.08, y, bw, bh, k + 1)
      y -= bh
    }
  } else {
    // 2025: a whole bookshelf (10M is the maker's own claim: drawn paler)
    const sw = u * 1.05, sh = u * 1.25, x0 = -sw / 2
    inkP += stroke([[x0, 2], [x0, -sh]], 2.2, 0.02, 0.05, 0.6) + stroke([[x0 + sw, 2], [x0 + sw, -sh]], 2.2, 0.02, 0.05, 0.6) + stroke([[x0 - 2, -sh], [x0 + sw + 2, -sh]], 2.4, 0.05, 0.05, 0.6)
    for (let k = 0; k < 3; k++) {
      const base = -k * (sh / 3)
      inkP += stroke([[x0 - 1, base], [x0 + sw + 1, base]], 1.8, 0.05, 0.05, 0.6)
      for (let x = x0 + 3; x < x0 + sw - 5;) {
        const bw = u * (0.06 + r() * 0.06), bh = (sh / 3) * (0.62 + r() * 0.3)
        if (x + bw > x0 + sw - 3) break
        book(x, base - 1.5, bw, bh, Math.floor(r() * 5))
        x += bw + 0.6
      }
    }
  }
  return [
    fillP ? s('path', { class: 'g8w2-sheet', d: fillP }) : null,
    ...books,
    s('path', { class: 'g8w2-lines', d: lines }),
    s('path', { class: 'g8w2-ink', d: inkP, filter: 'url(#ink-rough)' }),
  ].filter((x): x is SVGPathElement => !!x)
}

/** A garden stele (a dressed stone slab with a low plinth), w wide, standing on (0, 0): face, shaded flank, moonlit rim. */
function stele(w: number, hh: number): SVGElement[] {
  const face = `M${f1(-w / 2)} 0L${f1(-w / 2)} ${f1(-hh * 0.86)}Q${f1(-w / 2)} ${f1(-hh)} ${f1(-w * 0.3)} ${f1(-hh)}L${f1(w * 0.3)} ${f1(-hh)}Q${f1(w / 2)} ${f1(-hh)} ${f1(w / 2)} ${f1(-hh * 0.86)}L${f1(w / 2)} 0Z`
  return [
    s('ellipse', { class: 'g8w2-contact', cx: f1(w * 0.08), cy: 1.5, rx: f1(w * 0.8), ry: f1(Math.max(2, w * 0.12)) }),
    s('path', { class: 'g8w2-plinth', d: `M${f1(-w * 0.68)} 2L${f1(-w * 0.62)} ${f1(-hh * 0.1)}L${f1(w * 0.62)} ${f1(-hh * 0.1)}L${f1(w * 0.68)} 2Z` }),
    s('path', { class: 'g8w2-face', d: face, fill: 'url(#p2-rock)' }),
    s('path', { class: 'g8w2-flank', d: `M${f1(w * 0.18)} 0L${f1(w * 0.18)} ${f1(-hh)}L${f1(w * 0.3)} ${f1(-hh)}Q${f1(w / 2)} ${f1(-hh)} ${f1(w / 2)} ${f1(-hh * 0.86)}L${f1(w / 2)} 0Z` }),
    s('path', { class: 'g8w2-rim', d: stroke([[-w / 2 + 1, -hh * 0.2], [-w / 2 + 1, -hh * 0.86], [-w * 0.3, -hh + 1], [w * 0.2, -hh + 1]], Math.max(1.2, w * 0.05), 0.2, 0.3, 0.2) }),
  ]
}

/**
 * Scene 4 (comp + 2.5D) — inside a tea room, facing a long shōji wall under a transom of kumiko; the moon is a glow behind
 * the transom's paper, the lattice dark across it, and it is the slider's thumb. Every milestone it passes slides one
 * panel open onto a deep garden in one-point perspective (raked sand curving to the same vanishing point as the mats),
 * where a stele rises carrying what that year's window could read: a letter, a few pages, a novel, a stack, a bookshelf,
 * and today a stack of about ten novels (1 million tokens), with the 10-million claim only a pale shelf in the mist.
 * Moonlight falls through each open panel as a long trapezoid on the tatami.
 * Beat 2 (audit v3 22-4, the main act): at today a long scroll unrolls on the mats; drag the vermilion seal ("what
 * matters") along it — the reading lamp burns bright at both ends and dims in the middle (lost in the middle) → insight.
 */
export const windowScene: SceneDef = {
  label: S.label,
  mount(ctx) {
    let panels: Element[] = [], rises: Element[] = [], beams: Element[] = []
    let scene: SVGGElement | null = null
    let glow: SVGGElement | null = null, paperGlow: SVGRadialGradientElement | null = null
    let track: ((t: number) => Pt) | null = null
    const room = s('svg', { class: 'g8w2-room', 'aria-hidden': 'true' })
    ctx.art.append(h('p', { class: 'visually-hidden' }, S.art), room)
    let shown = 0, lastT = 0
    const n = S.tide.milestones.length // stops 0…n-1 milestones, n = today (the tide's own last stop)

    /** The room's one-point perspective and today's two lines along the mat borders, shared by the garden (band px) and the room (art px). */
    function plan(g: TideGeo) {
      const band = ctx.art.querySelector<HTMLElement>('.p2t-band'), wrap = ctx.art.querySelector<HTMLElement>('.p2t'), card = ctx.art.querySelector<HTMLElement>('.p2t-card')
      const ox = parseFloat(band?.style.left ?? '') || 0, oy = parseFloat(band?.style.top ?? '') || 0
      const W = 2 * ox + g.w, H = parseFloat(wrap?.style.height ?? '') || g.h + oy + 200
      const top = 9, sill = g.ground - 4, floorY = g.ground + 6
      const rb = top + (sill - top) * 0.28 // the transom's lower rail
      const hz = top + (sill - top) * 0.5 // eye level: the garden's horizon
      const vx = g.w * 0.6
      const unit = (floorY - hz) / 1.25 // a mat's width where the floor meets the wall
      const cardTop = parseFloat(card?.style.top ?? '') || oy + g.h + 14
      const cw = Math.min(640, W), cx0 = (W - cw) / 2, cx1 = cx0 + cw
      // a mat border j (…, -1, 0, 1, …) at art height y, running to the vanishing point
      const at = (j: number, y: number) => ox + vx + (j * unit * (y - oy - hz)) / (floorY - hz)
      const fy = oy + floorY
      // where a line along border j can be inked on the floor: from the wall down until it meets the card, the frame's
      // edge or the floor's foot; clear of the dates on the sill
      // (on a tight scroll only the first date, today's and the one beside it show)
      const tight = (g.xs[1] - g.xs[0]) < 62
      const dates = tight ? [g.xs[0], g.xs[g.xs.length - 2], g.xs[g.xs.length - 1]] : g.xs
      const reach = (j: number, sill = true) => {
        let y1 = fy
        for (let y = fy; y < H * 0.95; y += 4) {
          const x = at(j, y)
          if (x < 10 || x > W - 10 || (y > cardTop - 10 && x > cx0 - 14 && x < cx1 + 14)) break
          y1 = y
        }
        return !sill || dates.every((x) => Math.abs(at(j, fy + 4) - (ox + x)) > 38 && Math.abs(at(j, fy + 28) - (ox + x)) > 38) ? y1 - fy : 0
      }
      // the pair of borders with the longest clear run for both lines, their labels inside the frame
      let jl = 2, js = 3, best = 0
      for (const j of [-2, 2, -3, 3, -1, 1, -4, 4]) {
        const rl = reach(j)
        for (const k of [j + Math.sign(j), j - Math.sign(j)]) {
          const rs = reach(k, false), ys = fy + Math.min(rl, rs / 0.9) * 0.62, xk = at(k, ys), side = Math.sign(k - j)
          // (both labels inside the frame and clear of the andon standing by the right wall)
          const lamp = ox > 80 ? W - (ox - 10) * 0.5 : Infinity, xm = at(j, fy + rl * 0.5) - side * 80
          const ok = (x: number) => x > 12 && x < W - 12 && Math.abs(x - lamp) > 40
          const fits = ok(xk + side * 80) && ok(xk) && ok(xm) && ok(at(j, fy + rl * 0.5))
          const score = fits ? Math.min(rl, rs * 1.3) : 0
          if (score > best) (best = score), (jl = j), (js = k)
        }
      }
      return { ox, oy, W, H, top, sill, floorY, rb, hz, vx, unit, at, fy, cardTop, jl, js, reach, ok: best > 0 }
    }

    // the painting is built over a few frames the first time (README A.10); a re-layout builds it in one go
    let job: { cancel(): void } | null = null
    let first = true
    ctx.onCleanup(() => job?.cancel())
    function back(g: TideGeo): SVGElement[] {
      job?.cancel()
      const sc = s('g', { class: 'g8w2-scene' })
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
      const { top, sill, rb, hz, vx } = p
      const edges = [roll + 2, ...xs.slice(1).map((x, k) => (xs[k] + x) / 2), w - roll - 2]
      const P = (x: number, y: number) => `${f1(x)} ${f1(y)}`
      // where a ground line toward the vanishing point is at height y
      const toward = (x: number, y0: number, y: number) => vx + ((x - vx) * (y - hz)) / (y0 - hz)
      const panelW = xs[1] - xs[0]
      const base = sill - (sill - hz) * 0.24
      const u = Math.min(panelW * 0.62, (sill - hz) * 0.62)
      // ── the garden beyond: night sky, far ranges, mist on the horizon, raked sand curving in to the vanishing point
      // the rake drawn toward the house in combed sweeps (three teeth, then a gap), swinging gently side to side
      let rake = '', rakeHi = ''
      for (let x = -w * 0.6, k = 0; x < w * 1.6; x += 5, k++) {
        if (k % 5 > 2) continue
        const swing = Math.sin(x * 0.006 + seed) * (sill - hz) * 0.9
        const x0 = toward(x, sill, hz + 3), mx = (x0 + x) / 2 + swing, my = hz + (sill - hz) * 0.62
        const d = `M${P(x0, hz + 3)}Q${P(mx, my)} ${P(x, sill + 2)}`
        if (k % 5 === 1) rakeHi += d
        else rake += d
      }
      const noiseId = `g8w2-noise-${seed}`
      const grain: SVGElement[] = []
      for (let k = 0; k < 18; k++) grain.push(s('circle', { cx: f1(r() * 40), cy: f1(r() * 30), r: f1(0.5 + r() * 0.9), opacity: f1(0.25 + r() * 0.6) }))
      const shadowId = `g8w2-pine-${seed}`
      sc.append(
        s('defs', null,
          s('linearGradient', { id: `g8w2-sky-${seed}`, x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, class: 'g8w2-s0' }), s('stop', { offset: 1, class: 'g8w2-s1' })),
          s('linearGradient', { id: `g8w2-sand-${seed}`, x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, class: 'g8w2-sd0' }), s('stop', { offset: 1, class: 'g8w2-sd1' })),
          s('linearGradient', { id: `g8w2-pp-${seed}`, x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, class: 'g8w2-p0' }), s('stop', { offset: 0.55, class: 'g8w2-p1' }), s('stop', { offset: 1, class: 'g8w2-p2' })),
          // the paper glows where the moon is behind it and darkens away from it (its centre follows the moon)
          (paperGlow = s('radialGradient', { id: `g8w2-pg-${seed}`, gradientUnits: 'userSpaceOnUse', cx: 0, cy: 0, r: f1(w * 0.42) }, s('stop', { offset: 0, class: 'g8w2-g0' }), s('stop', { offset: 0.35, class: 'g8w2-g1' }), s('stop', { offset: 1, class: 'g8w2-g2' }))),
          s('pattern', { id: noiseId, width: 40, height: 30, patternUnits: 'userSpaceOnUse' }, ...grain),
          ...edges.slice(0, -1).map((a, k) => s('clipPath', { id: `g8w2-f${seed}-${k}` }, s('rect', { x: f1(a), y: f1(rb), width: f1(edges[k + 1] - a), height: f1(sill - rb) }))),
          s('clipPath', { id: `g8w2-rm-${seed}` }, s('rect', { x: f1(edges[0]), y: top, width: f1(edges[edges.length - 1] - edges[0]), height: f1(rb - top) })),
          // a pine outside, its moon shadow on the paper (one drawing, used by every panel so it slides with it)
          s('g', { id: shadowId, class: 'g8w2-pineshadow' }, pine(w * 0.3, sill + (sill - top) * 0.25, (sill - top) * 1.15, seed + 31, 1), pine(w * 0.82, sill + (sill - top) * 0.4, (sill - top) * 0.9, seed + 32, -1))),
        s('rect', { class: 'g8w2-sky', x: 0, y: top, width: f1(w), height: f1(hz - top + 2), fill: `url(#g8w2-sky-${seed})` }),
        mist(vx, hz - (hz - top) * 0.2, w * 0.5, (hz - top) * 0.5),
        hills(roll, w - roll, hz + 2, (hz - rb) * 0.7, seed + 4, 0.9, 6),
        hills(w * 0.05, w * 0.42, hz + 2, (hz - rb) * 0.5, seed + 5, 0.55, 2),
        s('rect', { class: 'g8w2-sand', x: 0, y: f1(hz), width: f1(w), height: f1(sill - hz), fill: `url(#g8w2-sand-${seed})` }),
        s('rect', { class: 'g8w2-noise', x: 0, y: f1(hz), width: f1(w), height: f1(sill - hz), fill: `url(#${noiseId})` }),
        s('path', { class: 'g8w2-rake', d: rake }),
        s('path', { class: 'g8w2-rake hi', d: rakeHi }),
        mist(vx, hz + 3, w * 0.6, (sill - hz) * 0.2),
        mist(vx, hz - 2, w * 0.4, (sill - hz) * 0.08))
      yield
      // ── steles rising from the sand, each carrying what that year's window could read
      const rise = (k: number, kids: SVGElement[]) => s('g', { class: `g8w2-rise r${k}` }, ...kids)
      for (let k = 0; k < n; k++) {
        rises.push(rise(k, [s('g', { transform: `translate(${f1(xs[k])} ${f1(base)})` }, ...stele(u * 0.62, u * 0.22), s('g', { transform: `translate(0 ${f1(-u * 0.2)})` }, ...carried(k, u * 0.72, seed + k * 13)))]))
        if (k % 2) yield
      }
      // today: about a million tokens, a stack of ten novels on its stele (not a library: that would teach the 10-million
      // claim); the maker's own 10-million claim stands far behind in the mist, pale, with its caveat carved under it
      const tx = xs[n], fx0 = tx - panelW * 0.28, fy0 = hz + (base - hz) * 0.3, fk = 0.42
      rises.push(rise(n, [
        s('g', { class: 'g8w2-claim', transform: `translate(${f1(fx0)} ${f1(fy0)}) scale(${fk})` }, ...stele(u * 0.62, u * 0.22), s('g', { transform: `translate(0 ${f1(-u * 0.2)})` }, ...carried(4, u * 0.72, seed + 77))),
        s('text', { class: 'g8w2-claimtxt', x: f1(fx0), y: f1(fy0 + 12), 'text-anchor': 'middle' }, S.claim),
        s('g', { transform: `translate(${f1(tx)} ${f1(base)})` }, ...stele(u * 0.62, u * 0.22), s('g', { transform: `translate(0 ${f1(-u * 0.2)})` }, ...carried(3, u * 0.72, seed + 3 * 13))),
      ]))
      yield
      // the sand raked in rings round each stone, flattened by the distance
      let rings = ''
      for (let k = 0; k <= n; k++) for (let q = 1; q <= 3; q++) rings += `M${P(xs[k] - u * (0.35 + q * 0.16), base + 1)}a${f1(u * (0.35 + q * 0.16))} ${f1(u * (0.08 + q * 0.035))} 0 1 0 ${f1(u * (0.7 + q * 0.32))} 0`
      sc.append(s('path', { class: 'g8w2-rake ring', d: rings }))
      // lost in the middle: mist settles over the middle steles once the moon is past today
      const mid = (xs[1] + xs[n - 2]) / 2, span = xs[n - 2] - xs[1]
      // today's long line runs on past the sill, along its mat border's line, deep into the garden
      const jl = p.jl, xl = vx + (jl * p.unit * (sill - hz)) / (p.floorY - hz)
      sc.append(...rises,
        s('g', { class: 'g8w2-lost' }, mist(mid, base - u * 0.5, span * 0.62 + panelW * 0.5, u * 0.62), mist(mid, base - u * 0.35, span * 0.5 + panelW * 0.4, u * 0.42)),
        mist(w - roll - panelW * 0.6, (hz + sill) / 2, panelW * 1.3, (sill - top) * 0.5),
        p.ok ? s('g', { class: 'g8w2-cmp' }, s('path', { class: 'g8w2-cline long', d: stroke([[xl, sill + 2], [toward(xl, sill, hz + 4), hz + 4]], 4, 0.02, 0.5, 0.1) })) : '')
      yield
      // ── the shōji: under the transom, one sliding panel per stop, each clipped to its own frame so it slides away
      // behind the post; thin warm kumiko (many light rails, few stiles), the paper lit where the moon is behind it
      panels = edges.slice(0, -1).map((a, k) => {
        const b = edges[k + 1]
        let lat = ''
        const cols = Math.max(2, Math.round((b - a) / 34))
        for (let c = 1; c < cols; c++) {
          const x = a + ((b - a) * c) / cols + (r() - 0.5) * 0.6
          lat += `M${P(x, rb)}L${P(x + (r() - 0.5) * 0.5, sill)}`
        }
        for (let y = rb + 16; y < sill - 6; y += 19 + r() * 1.5) lat += `M${P(a, y)}L${P(b, y + (r() - 0.5) * 0.6)}`
        return s('g', { 'clip-path': `url(#g8w2-f${seed}-${k})` },
          s('g', { class: `g8w2-panel p${k}` },
            s('rect', { class: 'g8w2-paper', x: f1(a), y: f1(rb), width: f1(b - a), height: f1(sill - rb), fill: `url(#g8w2-pp-${seed})` }),
            s('rect', { class: 'g8w2-paperglow', x: f1(a), y: f1(rb), width: f1(b - a), height: f1(sill - rb), fill: `url(#g8w2-pg-${seed})` }),
            s('use', { href: `#${shadowId}`, class: 'g8w2-pineuse' }),
            s('path', { class: 'g8w2-kumiko', d: lat })))
      })
      // the transom: fixed washi under a diagonal kumiko; the moon glows behind it, the lattice dark across the glow
      let ranma = ''
      const rx0 = edges[0], rx1 = edges[edges.length - 1], rh = rb - top
      // slender slats with a rail through them: the moon's glow comes through barred by their shadows
      for (let x = rx0 + 5; x < rx1; x += 9) ranma += `M${P(x, top)}L${P(x, rb)}`
      ranma += `M${P(rx0, top + rh * 0.36)}L${P(rx1, top + rh * 0.36)}M${P(rx0, top + rh * 0.42)}L${P(rx1, top + rh * 0.42)}`
      for (const a of edges) ranma += `M${P(a, top)}L${P(a, rb)}`
      glow = s('g', { class: 'g8w2-moon' },
        s('circle', { class: 'g8w2-halo', r: f1(Math.min(90, rh * 1.5)), fill: 'url(#g8w2-mglow)' }),
        s('circle', { class: 'g8w2-disc', r: f1(Math.min(15, rh * 0.32)), fill: 'url(#g8w2-mdisc)' }))
      let posts = ''
      edges.forEach((x, k) => void (posts += stroke([[x, rb], [x + (r() - 0.5) * 0.6, (rb + sill) / 2], [x, sill + 3]], k === 0 || k === edges.length - 1 ? 3.4 : 2.2, 0.01, 0.02, 0.8)))
      sc.append(...panels,
        s('defs', null,
          s('radialGradient', { id: 'g8w2-mglow' }, s('stop', { offset: 0, class: 'g8w2-m0' }), s('stop', { offset: 0.3, class: 'g8w2-m1' }), s('stop', { offset: 1, class: 'g8w2-m2' })),
          s('radialGradient', { id: 'g8w2-mdisc' }, s('stop', { offset: 0, class: 'g8w2-d0' }), s('stop', { offset: 0.7, class: 'g8w2-d1' }), s('stop', { offset: 1, class: 'g8w2-d2' }))),
        s('g', { 'clip-path': `url(#g8w2-rm-${seed})` },
          s('rect', { class: 'g8w2-ranma', x: f1(rx0), y: top, width: f1(rx1 - rx0), height: f1(rh) }),
          glow,
          s('path', { class: 'g8w2-kumiko ranma', d: ranma })),
        s('path', { class: 'g8w2-post', d: posts }),
        s('path', { class: 'g8w2-wood', d: stroke([[roll, top + 2], [w / 2, top + 2.5], [w - roll, top + 2]], 5, 0.01, 0.01, 0.7) + stroke([[roll, rb], [w / 2, rb + 0.5], [w - roll, rb]], 5.5, 0.01, 0.01, 0.7) + stroke([[roll, sill + 2], [w / 2, sill + 2.5], [w - roll, sill + 2]], 6, 0.01, 0.01, 0.7) }),
        s('path', { class: 'g8w2-woodlit', d: stroke([[roll, rb - 2], [w - roll, rb - 2]], 1, 0.02, 0.02, 0.6) + stroke([[roll, sill], [w - roll, sill]], 1, 0.02, 0.02, 0.6) }))
      track = (t: number) => [xs[0] + (xs[xs.length - 1] - xs[0]) * t, top + rh * 0.52 - Math.sin(Math.PI * t) * rh * 0.12]
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
     * The tea room round the scroll (an SVG behind it, the whole art area): a ceiling beam and boards, plaster walls, an
     * alcove (tokonoma) with a hanging scroll on the left, an andon's warm pool on the right; tatami with dark borders
     * running to the garden's vanishing point; moonlight thrown in through each open panel as a long trapezoid on the mats;
     * a low table with a teacup in the near corner; and today's two ink lines along the mat borders.
     */
    function drawRoom(g: TideGeo, p: ReturnType<typeof plan>) {
      const { ox, oy, W, H, fy, at } = p
      const hz = oy + p.hz, vx = ox + p.vx
      const P = (x: number, y: number) => `${f1(x)} ${f1(y)}`
      room.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
      room.style.height = `${f1(H)}px`
      const r = rng(g.seed + 7)
      // depth on the floor: a row of mats k widths nearer than the wall meets the floor at this height
      const Z0 = 7
      const rowY = (k: number) => hz + ((fy - hz) * Z0) / (Z0 - k)
      // tatami: the long borders (heri) as dark bands that widen toward us, the short seams staggered like a real floor
      let heri = '', seams = ''
      for (let j = -12; j <= 12; j++) {
        const xa = at(j, fy), xb = at(j, H + 40)
        if (Math.max(xa, xb) < -40 || Math.min(xa, xb) > W + 40) continue
        const w0 = p.unit * 0.022, w1 = w0 * ((H + 40 - hz) / (fy - hz))
        heri += `M${P(xa - w0, fy)}L${P(xa + w0, fy)}L${P(xb + w1, H + 40)}L${P(xb - w1, H + 40)}Z`
        for (let k = (j & 1) + 1; k < Z0; k += 2) {
          const y = rowY(k)
          if (y > H + 10) break
          seams += `M${P(at(j, y), y)}L${P(at(j + 1, y), y)}`
        }
      }
      // moonlight through each panel: from the sill, nearer and wider, a little skewed away from the moon
      const skew = -0.32
      beams = g.xs.length ? [...Array(g.xs.length).keys()].map((k) => {
        const edges = [g.roll + 2, ...g.xs.slice(1).map((x, q) => (g.xs[q] + x) / 2), g.w - g.roll - 2]
        // (inset by the posts' shadow, so each opening throws its own patch)
        const a = ox + edges[k] + 5, b = ox + edges[k + 1] - 5, y1 = rowY(3.4)
        const xa1 = vx + ((a - vx) * (y1 - hz)) / (fy - hz) + skew * (y1 - fy), xb1 = vx + ((b - vx) * (y1 - hz)) / (fy - hz) + skew * (y1 - fy)
        return s('g', { class: `g8w2-beam k${k}` }, s('path', { class: 'g8w2-light', d: `M${P(a, fy)}L${P(b, fy)}L${P(xb1, y1)}L${P(xa1, y1)}Z`, fill: 'url(#g8w2-beam)' }))
      }) : []
      const sideW = Math.max(0, ox - 10)
      const kam = oy + p.top - 14 // the beam over the shōji (kamoi)
      // the low table and its teacup, in the near left corner (only where the floor is not under the card)
      const tableOk = W > 900
      const tx0 = W * 0.05, tx1 = W * 0.21, ty = H * 0.82, tth = H * 0.028
      const tFar = (x: number) => vx + (x - vx) * ((ty - hz) / (ty + 40 - hz))
      const tableTop = `M${P(tFar(tx0), ty)}L${P(tFar(tx1), ty)}L${P(tx1, ty + 40)}L${P(tx0, ty + 40)}Z`
      const cupX = W * 0.15, cupY = ty + 24, cw = W * 0.015
      // today's two lines along the mat borders: one stops short, the other runs to the wall (and on, in the garden)
      const ll = Math.min(p.reach(p.jl), H - fy), ls = Math.min(p.reach(p.js, false), ll * 0.9)
      const near = fy + Math.min(ll, ls / 0.9) // both start at the same near row
      const lineL: Pt[] = [[at(p.jl, near), near], [at(p.jl, fy + 1), fy + 1]]
      const shortEnd = near - (near - fy) * 0.38
      const lineS: Pt[] = [[at(p.js, near), near], [at(p.js, shortEnd), shortEnd]]
      const cmp = S.tide.milestones[n - 1].compare
      const out = Math.sign(p.js - p.jl) || 1
      room.replaceChildren(...[
        s('defs', null,
          s('linearGradient', { id: 'g8w2-beam', x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, class: 'g8w2-b0' }), s('stop', { offset: 1, class: 'g8w2-b1' })),
          s('linearGradient', { id: 'g8w2-floor', x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, class: 'g8w2-fl0' }), s('stop', { offset: 1, class: 'g8w2-fl1' })),
          s('linearGradient', { id: 'g8w2-wallg', x1: 0, y1: 0, x2: 1, y2: 0 }, s('stop', { offset: 0, class: 'g8w2-wl0' }), s('stop', { offset: 0.5, class: 'g8w2-wl1' }), s('stop', { offset: 1, class: 'g8w2-wl0' })),
          s('radialGradient', { id: 'g8w2-andon' }, s('stop', { offset: 0, class: 'g8w2-a0' }), s('stop', { offset: 1, class: 'g8w2-a1' }))),
        s('rect', { class: 'g8w2-wall', width: f1(W), height: f1(fy + 2), fill: 'url(#g8w2-wallg)' }),
        s('rect', { class: 'g8w2-floor', y: f1(fy), width: f1(W), height: f1(H - fy + 2), fill: 'url(#g8w2-floor)' }),
        s('path', { class: 'g8w2-mats', d: seams }),
        s('path', { class: 'g8w2-heri', d: heri }),
        ...beams,
        // the andon on the right: its warm pool on the mats and the wall, a rim of its light on the nearest border
        s('g', { class: 'g8w2-andon' },
          s('ellipse', { cx: f1(W - Math.max(sideW, 60) * 0.5), cy: f1(fy + (H - fy) * 0.25), rx: f1(Math.max(sideW, 120) * 1.8), ry: f1((H - fy) * 0.55), fill: 'url(#g8w2-andon)' }),
          sideW > 70 ? s('ellipse', { cx: f1(W - sideW * 0.5), cy: f1(fy - (fy - oy) * 0.2), rx: f1(sideW * 0.9), ry: f1((fy - oy) * 0.55), fill: 'url(#g8w2-andon)' }) : null,
          sideW > 70 ? s('rect', { class: 'g8w2-andon-box', x: f1(W - sideW * 0.5 - 16), y: f1(fy + (H - fy) * 0.12 - 58), width: 32, height: 52, rx: 2 }) : null,
          sideW > 70 ? s('path', { class: 'g8w2-andon-frame', d: `M${P(W - sideW * 0.5 - 18, fy + (H - fy) * 0.12 - 60)}h36M${P(W - sideW * 0.5 - 18, fy + (H - fy) * 0.12 - 6)}h36M${P(W - sideW * 0.5 - 15, fy + (H - fy) * 0.12 - 6)}v10M${P(W - sideW * 0.5 + 15, fy + (H - fy) * 0.12 - 6)}v10M${P(W - sideW * 0.5, fy + (H - fy) * 0.12 - 60)}v54` }) : null),
        // the alcove on the left: a recess, its post, the hanging scroll of a mountain, a stone on its floor
        sideW > 80 ? s('g', { class: 'g8w2-toko' },
          s('rect', { class: 'g8w2-toko-in', x: 6, y: f1(kam + 18), width: f1(sideW - 14), height: f1(fy - kam - 14) }),
          s('rect', { class: 'g8w2-kake-silk', x: f1(sideW * 0.26), y: f1(kam + 30), width: f1(sideW * 0.42), height: f1((fy - kam) * 0.66) }),
          s('rect', { class: 'g8w2-kake-paper', x: f1(sideW * 0.3), y: f1(kam + 42), width: f1(sideW * 0.34), height: f1((fy - kam) * 0.5) }),
          hills(sideW * 0.31, sideW * 0.63, kam + 42 + (fy - kam) * 0.42, (fy - kam) * 0.2, g.seed + 9, 0.3, 2),
          s('path', { class: 'g8w2-kake-rod', d: stroke([[sideW * 0.22, kam + 30 + (fy - kam) * 0.66], [sideW * 0.72, kam + 30 + (fy - kam) * 0.66]], 4, 0.05, 0.05, 0.6) }),
          s('path', { class: 'g8w2-toko-post', d: stroke([[sideW - 8, kam], [sideW - 9 + (r() - 0.5) * 2, (kam + fy) / 2], [sideW - 8, fy + 4]], 9, 0.01, 0.01, 0.8) })) : null,
        // ceiling boards and the beam over the shōji, wall to wall; posts either side
        s('rect', { class: 'g8w2-ceil', width: f1(W), height: f1(Math.max(0, kam)) }),
        s('path', { class: 'g8w2-woodrm', d: `M0 ${f1(kam)}L${f1(W)} ${f1(kam)}L${f1(W)} ${f1(oy + p.top + 3)}L0 ${f1(oy + p.top + 3)}Z` + (sideW > 10 ? `M${P(ox - 12, kam)}L${P(ox + 2, kam)}L${P(ox + 2, fy)}L${P(ox - 12, fy)}Z` + `M${P(ox + g.w - 2, kam)}L${P(ox + g.w + 12, kam)}L${P(ox + g.w + 12, fy)}L${P(ox + g.w - 2, fy)}Z` : '') }),
        s('path', { class: 'g8w2-woodhi', d: stroke([[0, kam + 1.5], [W, kam + 1.5]], 1.4, 0.02, 0.02, 0.5) + (sideW > 10 ? stroke([[ox - 11, kam + 2], [ox - 11, fy]], 1.2, 0.02, 0.02, 0.5) : '') }),
        // the low table in the near corner, black lacquer with a moonlit edge, a teacup steaming on it
        tableOk ? s('g', { class: 'g8w2-table' },
          s('ellipse', { class: 'g8w2-tshadow', cx: f1((tx0 + tx1) / 2), cy: f1(ty + 46 + tth), rx: f1((tx1 - tx0) * 0.6), ry: f1(tth * 1.2) }),
          s('path', { class: 'g8w2-tside', d: `M${P(tx0, ty + 40)}L${P(tx1, ty + 40)}L${P(tx1, ty + 40 + tth)}L${P(tx0, ty + 40 + tth)}Z` + `M${P(tx0 + 6, ty + 40 + tth)}h8v${f1(tth * 0.9)}h-8Z` + `M${P(tx1 - 14, ty + 40 + tth)}h8v${f1(tth * 0.9)}h-8Z` }),
          s('path', { class: 'g8w2-ttop', d: tableTop }),
          s('path', { class: 'g8w2-tedge', d: stroke([[tFar(tx0), ty], [tFar(tx1), ty]], 1.6, 0.05, 0.05, 0.5) + stroke([[tx0, ty + 40], [tx1, ty + 40]], 2, 0.05, 0.05, 0.5) }),
          s('ellipse', { class: 'g8w2-cupsh', cx: f1(cupX + cw * 0.3), cy: f1(cupY + cw * 0.95), rx: f1(cw * 1.3), ry: f1(cw * 0.3) }),
          s('path', { class: 'g8w2-cup', d: `M${P(cupX - cw, cupY)}Q${P(cupX - cw * 0.95, cupY + cw * 1.1)} ${P(cupX, cupY + cw * 1.05)}Q${P(cupX + cw * 0.95, cupY + cw * 1.1)} ${P(cupX + cw, cupY)}Z` }),
          s('ellipse', { class: 'g8w2-tea', cx: f1(cupX), cy: f1(cupY), rx: f1(cw), ry: f1(cw * 0.28) }),
          s('path', { class: 'g8w2-steam', d: stroke([[cupX - cw * 0.2, cupY - 4], [cupX + cw * 0.3, cupY - cw * 1.4], [cupX - cw * 0.2, cupY - cw * 2.6], [cupX + cw * 0.2, cupY - cw * 3.6]], 2, 0.3, 0.5, 0.2) })) : null,
        // today's two ink lines along the mat borders, and what they measure (where the floor has room for them)
        !p.ok ? null : s('g', { class: 'g8w2-cmp' },
          s('path', { class: 'g8w2-cline', d: stroke(lineS, 4.5, 0.05, 0.15, 0.35) }),
          s('path', { class: 'g8w2-cline long', d: stroke(lineL, 4.5, 0.05, 0.02, 0.35) }),
          cmp ? s('text', { class: 'g8w2-cnum', x: f1(lineS[1][0] + out * 8), y: f1(shortEnd + 4), 'text-anchor': out > 0 ? 'start' : 'end' }, cmp.before) : null,
          cmp ? s('text', { class: 'g8w2-cnum long', x: f1(at(p.jl, (fy + near) / 2) - out * 8), y: f1((fy + near) / 2 + 4), 'text-anchor': out > 0 ? 'end' : 'start' }, cmp.after) : null),
      ].filter((x): x is SVGElement => !!x))
      onStep(shown, lastT)
    }

    function onStep(i: number, t: number) {
      moonAt(t, !!ctx.art.querySelector('.p2t-moon.snap'))
      panels.forEach((p, k) => p.firstElementChild?.classList.toggle('open', k <= i))
      rises.forEach((p, k) => p.classList.toggle('up', k <= i))
      beams.forEach((p, k) => p.classList.toggle('open', k <= i))
      for (const el of [scene, room]) el?.classList.toggle('cmp', i >= n)
      if (i > shown) ctx.chime(i >= n ? 'ok' : 'soft')
      shown = i
      if (i >= n) unroll()
    }

    // ── beat 2: the long scroll on the mats, and the seal dragged along it (the card steps aside for it)
    const g = guide(ctx)
    let moonDot: Mark | null = null, sealDot: Mark | null = null, way: Track | null = null
    const lamp = h('i', { class: 'g8w2-lamp', 'aria-hidden': 'true' })
    const seal = h('div', { class: 'g8w2-seal', role: 'slider', tabindex: '0', 'aria-label': S.sealAria, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, h('span', null, S.sealLabel))
    const scroll = h('div', { class: 'g8w2-scroll', 'aria-hidden': 'true' }, h('i', { class: 'g8w2-paperstrip' }), h('i', { class: 'g8w2-rod a' }), h('i', { class: 'g8w2-rod b' }))
    const beat = h('div', { class: 'g8w2-beat' }, scroll, lamp, seal)
    const decode = h('p', { class: 'g8w2-decode' }, S.decode)
    const sc2 = { x0: 0, x1: 0, y: 0, on: false, t: 0, mid: false, end: false, done: false }
    /** where the scroll lies: across the near mats under the card (measured on unrolling and on resize, never in a frame) */
    function lay() {
      const card = ctx.art.querySelector<HTMLElement>('.p2t-card')
      if (!card || !sc2.on) return
      const a = ctx.art.getBoundingClientRect(), b = card.getBoundingClientRect()
      const w = Math.min(a.width - 40, Math.max(b.width, a.width * 0.6))
      sc2.x0 = a.width / 2 - w / 2 + 28
      sc2.x1 = a.width / 2 + w / 2 - 28
      // under today's card (it carries today's figure), on the near mats
      sc2.y = clamp(b.bottom - a.top + 46, 60, a.height - 44)
      Object.assign(scroll.style, { left: `${f1(sc2.x0 - 28)}px`, top: `${f1(sc2.y - 24)}px`, width: `${f1(sc2.x1 - sc2.x0 + 56)}px` })
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
      if (sc2.t > 0.38 && sc2.t < 0.62) sc2.mid = true
      if (sc2.t < 0.12 || sc2.t > 0.88) sc2.end = true
      if (sc2.mid && sc2.end && !sc2.done) {
        sc2.done = true
        sealDot?.done()
        ctx.chime('ok')
        ctx.insight(S.insight, [S.detail, S.growth])
      }
    }
    function unroll() {
      if (sc2.on) return
      sc2.on = true
      moonDot?.done()
      ctx.art.querySelector('.p2t')?.classList.add('g8w2-beat2')
      ctx.art.append(beat)
      lay()
      ctx.prompt(S.prompt2)
      way = g.track(() => [[sc2.x0, sc2.y + 30], [sc2.x1, sc2.y + 30]], { ticks: 3, labels: S.ticks })
      sealDot = g.dot(seal, { dir: [1, 0] })
      if (!ctx.reduced) scroll.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 900, easing: 'cubic-bezier(.3,.1,.2,1)' })
    }
    ctx.onCleanup(onSize(ctx.art, lay))
    let sid = -1
    seal.addEventListener('pointerdown', (e) => {
      sid = e.pointerId
      seal.setPointerCapture(sid)
      seal.classList.add('held')
    })
    seal.addEventListener('pointermove', (e) => {
      if (e.pointerId !== sid) return
      const a = beat.getBoundingClientRect() // the pointer, not the frame: one read per move event
      seat((e.clientX - a.left - sc2.x0) / Math.max(1, sc2.x1 - sc2.x0))
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
      // the moon rides behind the transom's paper (the scene draws it there: the thumb itself is only its handle)
      track: ({ xs, ground }) => (t) => {
        const top = 9, rh = (ground - 4 - top) * 0.28
        return [xs[0] + (xs[xs.length - 1] - xs[0]) * t, top + rh * 0.52 - Math.sin(Math.PI * t) * rh * 0.12]
      },
      thumb: () => s('circle', { class: 'g8w2-thumb', r: 20 }),
      onStep,
    }).mount({ ...ctx, insight: () => h('div'), complete: () => {} })
    ctx.art.querySelector('.p2t')?.classList.add('g8w2')
    ctx.art.append(decode)
    // the decoding line sits on the mats just under the sill, left of the card (read on resize, never in a frame)
    ctx.onCleanup(onSize(ctx.art, () => {
      const band = ctx.art.querySelector<HTMLElement>('.p2t-band'), card = ctx.art.querySelector<HTMLElement>('.p2t-card')
      if (!band || !card) return
      const a = ctx.art.getBoundingClientRect(), b = band.getBoundingClientRect(), c = card.getBoundingClientRect()
      const room = c.left - a.left - 40
      decode.style.top = `${f1(b.bottom - a.top + 18)}px`
      decode.style.maxWidth = room > 200 ? `${f1(room)}px` : ''
      decode.classList.toggle('flat', room <= 200)
    }))
    // H1 on the moon (the slider), leaning the way to drag
    const moonEl = ctx.art.querySelector<HTMLElement>('.p2t-moon')
    if (moonEl && !sc2.on) moonDot = g.dot(moonEl, { dir: [1, 0] })
    return off
  },
}
