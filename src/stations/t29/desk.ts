import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { blob, curve, rng, stroke, type Pt } from '../../ui/part2/ink'
import { grass, paperLantern, steppingStones, wash } from '../../ui/part2/paint'
import { findTakeaway, takeaway } from '../../ui/part2/takeaway'
import { C } from './data'
import { clamp, f1, frame } from '../t28/frame'
import { bamboo, nightSky, P } from '../t28/brush'

const G = C.scenes.desk
const GB = [8, 16, 32, 64, 96, 141]
const SCROLLS = 8

/** A scribe kneeling at (x, y) (knees on the floor line), `hh` tall, painted in a few strokes: the robe a pale wash under a
 *  strong ink contour (heavy down the back, lighter down the chest), a wide sleeve, a sash, folds, the face in paper with a
 *  thin beard, the winged scholar's cap in solid ink. The writing forearm is drawn by the caller (it moves). */
function scribe(x: number, y: number, hh: number, seed: number): { parts: SVGElement[]; elbow: Pt } {
  const u = hh / 10
  const X = (k: number) => x + u * k
  const Y = (k: number) => y - u * k
  const neck: Pt = [X(0.6), Y(6.9)]
  const head: Pt = [X(1.25), Y(7.85)]
  const robe = `M${P([X(-3.6), y])}Q${P([X(-3.9), Y(3.2)])} ${P([X(-1.8), Y(5.6)])}Q${P([X(-0.6), Y(6.9)])} ${P(neck)}Q${P([X(1.8), Y(6.3)])} ${P([X(2.2), Y(4.4)])}Q${P([X(2.6), Y(1.8)])} ${P([X(3.8), Y(0.6)])}L${P([X(3.6), y])}Z`
  const back = curve([X(-3.5), Y(0.1)], [X(-4.0), Y(3.4)], [X(-1.6), Y(5.75)], 12).concat(curve([X(-1.6), Y(5.75)], [X(-0.6), Y(6.85)], [X(0.4), Y(6.95)], 6).slice(1))
  const chest = curve([X(0.9), Y(6.8)], [X(1.9), Y(6.1)], [X(2.1), Y(4.5)], 8)
  // the wide near sleeve, falling from the shoulder to an open cuff near the desk
  const sleeve = `M${P([X(0.0), Y(6.1)])}Q${P([X(2.2), Y(5.6)])} ${P([X(3.3), Y(3.9)])}Q${P([X(3.9), Y(3.0)])} ${P([X(3.5), Y(2.4)])}Q${P([X(2.7), Y(2.3)])} ${P([X(2.1), Y(2.9)])}Q${P([X(1.2), Y(4.0)])} ${P([X(-0.4), Y(4.6)])}Z`
  const ink =
    stroke(back, u * 0.62, 0.05, 0.2, 0.15) +
    stroke(chest, u * 0.34, 0.15, 0.4, 0.2) +
    stroke(curve([X(0.0), Y(6.15)], [X(2.2), Y(5.65)], [X(3.4), Y(3.8)], 8), u * 0.42, 0.1, 0.25, 0.25) +
    stroke(curve([X(3.5), Y(2.45)], [X(2.6), Y(2.3)], [X(2.0), Y(3.0)], 6), u * 0.3, 0.2, 0.3, 0.3) +
    stroke([[X(-3.6), y], [X(0), Y(-0.08)], [X(3.7), Y(0.05)]], u * 0.4, 0.1, 0.1, 0.3)
  const folds =
    stroke(curve([X(-2.2), Y(4.6)], [X(-1.5), Y(2.8)], [X(-1.9), Y(0.6)], 8), u * 0.16, 0.2, 0.4, 0.1) +
    stroke(curve([X(-0.6), Y(3.8)], [X(0.0), Y(2.2)], [X(0.6), Y(0.5)], 8), u * 0.13, 0.2, 0.4, 0.1) +
    stroke(curve([X(1.6), Y(4.6)], [X(2.0), Y(4.2)], [X(2.6), Y(3.4)], 6), u * 0.1, 0.2, 0.4, 0.1)
  const sash = stroke(curve([X(-3.0), Y(3.1)], [X(-0.4), Y(2.6)], [X(2.2), Y(3.0)], 10), u * 0.3, 0.15, 0.15, 0.3) +
    stroke(curve([X(-0.6), Y(2.75)], [X(-0.9), Y(1.8)], [X(-0.5), Y(1.0)], 6), u * 0.18, 0.1, 0.5, 0.2)
  const face = blob(head[0], head[1], u * 0.82, u * 0.92, seed, 0.06, 12)
  const faceInk = stroke(curve([head[0] - u * 0.7, head[1] - u * 0.5], [head[0] - u * 0.95, head[1] + u * 0.4], [head[0] - u * 0.1, head[1] + u * 0.9], 8), u * 0.22, 0.2, 0.4, 0.2) +
    stroke([[head[0] + u * 0.25, head[1] - u * 0.05], [head[0] + u * 0.6, head[1] + u * 0.02]], u * 0.12, 0.2, 0.2, 0.3) +
    stroke([[head[0] + u * 0.2, head[1] + u * 0.75], [head[0] + u * 0.35, head[1] + u * 1.7]], u * 0.1, 0.1, 0.8, 0.1) +
    stroke([[head[0] + u * 0.45, head[1] + u * 0.7], [head[0] + u * 0.75, head[1] + u * 1.5]], u * 0.08, 0.1, 0.8, 0.1)
  const cap = blob(head[0] - u * 0.05, head[1] - u * 0.78, u * 0.98, u * 0.55, seed + 1, 0.05, 10) +
    stroke([[head[0] - u * 2.2, head[1] - u * 0.55], [head[0] - u * 1.4, head[1] - u * 0.75], [head[0] - u * 0.8, head[1] - u * 0.85]], u * 0.42, 0.35, 0.05, 0.4) +
    stroke([[head[0] + u * 0.7, head[1] - u * 0.85], [head[0] + u * 1.3, head[1] - u * 0.78], [head[0] + u * 2.1, head[1] - u * 0.6]], u * 0.42, 0.05, 0.35, 0.4)
  return {
    parts: [
      s('path', { class: 't29d-robe', d: robe, filter: 'url(#ink-wash)' }),
      s('path', { class: 't29d-robe t29d-sleeve', d: sleeve }),
      s('path', { class: 't29d-sash', d: sash }),
      s('path', { class: 't29d-fold', d: folds }),
      s('path', { class: 't29d-ink', d: ink, filter: 'url(#ink-rough)' }),
      s('path', { class: 'gb-figure-rim', d: stroke(back.slice(3, 15).map(([a, b]) => [a + u * 0.35, b + u * 0.1] as Pt), u * 0.14, 0.2, 0.4, 0.1) }),
      s('path', { class: 't29d-face', d: face }),
      s('path', { class: 't29d-ink', d: faceInk }),
      s('path', { class: 't29d-cap', d: cap, filter: 'url(#ink-rough)' }),
    ],
    elbow: [X(3.0), Y(2.8)],
  }
}

/** A rolled end of a handscroll from a to b (the near end at b): the roll in paper, its ink edge, a knob past the near end. */
function rollEnd(a: Pt, b: Pt, rw: number): string {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
  const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L
  return stroke([[a[0] - ux * rw * 0.5, a[1] - uy * rw * 0.5], [b[0] + ux * rw * 1.2, b[1] + uy * rw * 1.2]], rw * 0.45, 0.02, 0.02, 0.9)
}

/** The chip is a scribe at a low desk under a lantern: the wider the desk (memory), the more scrolls lie open at once. */
export function deskScene(ctx: SceneCtx) {
  let idx = 1
  const out = h('p', { class: 't29d-val' }, fill(G.valueText, { n: GB[idx] }))
  const msg = h('p', { class: 't29d-msg', 'aria-live': 'polite' })
  const inp = h('input', { type: 'range', min: 0, max: GB.length - 1, step: 1, value: idx, 'aria-label': G.slider, 'aria-valuetext': fill(G.valueText, { n: GB[idx] }) })
  const panel = h('div', { class: 'gf-panel t29d-panel' }, h('label', { class: 't29d-lab' }, h('span', { class: 'gf-eyebrow' }, G.slider), inp), out, msg)
  const desk = s('g', { class: 't29d-desk' })
  const { svg } = frame(ctx, 't29d', [...(G.insights as Fact[])], panel, (w, hh) => { size = [w, hh]; base(); draw() })
  ctx.prompt(G.prompt)
  let size = [0, 0]
  let stage = 0

  inp.addEventListener('input', () => {
    idx = Number(inp.value)
    const t = fill(G.valueText, { n: GB[idx] })
    out.textContent = t
    inp.setAttribute('aria-valuetext', t)
    msg.textContent = idx <= 2 ? G.small : G.large
    draw()
    if (stage === 0) {
      stage = 1
      ctx.insight(G.insights[0] as Fact)
    }
    if (idx === GB.length - 1 && stage < 2) {
      stage = 2
      ctx.insight(G.insights[1] as Fact, G.detail as Fact)
      ctx.chime('ok')
      const card = findTakeaway(C.takeaways[0])
      if (card) panel.append(h('div', { class: 't29d-card gf-new' }, takeaway(card, null, ctx.onCleanup)))
    }
  })

  // the night around the desk: moon, far hills, the lantern on its bamboo post, the scroll store at the left
  function base() {
    const [w, hh] = size
    const floor = hh * 0.66
    const maxW = Math.min(w * 0.82, hh * 1.7)
    const lr = Math.max(9, Math.min(w, hh) * 0.034)
    const px = Math.min(w - 10, w * 0.5 + maxW * 0.56)
    const pw = Math.max(4, lr * 0.4)
    const ly = hh * 0.12, lx = px - Math.max(lr * 6, hh * 0.24)
    const kx = Math.max(hh * 0.06, w * 0.06), ky = floor + hh * 0.02
    const kw = hh * 0.14, kh = hh * 0.2
    svg.replaceChildren(
      ...nightSky(w, floor - hh * 0.04, 2901, [w * 0.12, hh * 0.1, Math.max(10, lr * 1.1)], hh * 0.22),
      wash(blob(w * 0.5, floor + hh * 0.17, w * 0.5, hh * 0.13, 2902, 0.18, 14), 0.03),
      s('circle', { cx: f1(w * 0.5), cy: f1(floor + hh * 0.04), r: f1(Math.min(w, hh) * 0.5), fill: 'url(#p2-lamp)', class: 't29d-pool' }),
      // a bamboo rod planted by the desk, bowed over it, the paper lantern hung from its tip
      bamboo([px, floor + hh * 0.02], [lx, ly], pw, 2903, true, '', Math.hypot(px - lx, floor - ly) * 0.22),
      paperLantern(lx, ly + pw * 0.3, lr, 2905, lr * 1.4),
      // the store: a small wooden cabinet of rolled scrolls waiting to be fetched
      s('path', { class: 't29d-cab', d: `M${f1(kx - kw / 2)} ${f1(ky)}h${f1(kw)}v${f1(-kh)}h${f1(-kw)}Z`, filter: 'url(#ink-rough)' }),
      s('path', { class: 't29d-rack', d: [0, 0.5, 1].map((k) => stroke([[kx - kw * 0.56, ky - kh * k], [kx + kw * 0.56, ky - kh * k]], Math.max(2, kh * 0.03), 0.05, 0.05, 0.5)).join('') + stroke([[kx - kw / 2, ky + 2], [kx - kw / 2, ky - kh]], 2.2, 0.05, 0.05, 0.6) + stroke([[kx + kw / 2, ky + 2], [kx + kw / 2, ky - kh]], 2.2, 0.05, 0.05, 0.6), filter: 'url(#ink-rough)' }),
      steppingStones([w * 0.26, floor + hh * 0.3], [w * 0.36, floor + hh * 0.36], 3, Math.max(12, hh * 0.04), 2906),
      grass(w * 0.16, floor + hh * 0.1, Math.max(12, hh * 0.05), 2907),
      grass(w * 0.93, floor + hh * 0.08, Math.max(12, hh * 0.05), 2908),
      desk)
  }

  function draw() {
    const [w, hh] = size
    if (!w) return
    const r = rng(2910)
    const t = idx / (GB.length - 1)
    const cx = w * 0.5
    const back = hh * 0.6
    const maxW = Math.min(w * 0.82, hh * 1.7), minW = maxW * 0.4
    const dw = minW + (maxW - minW) * t, dd = Math.min(hh * 0.17, maxW * 0.15)
    const front = back + dd, apron = dd * 0.2, legH = hh * 0.07
    const x0 = cx - dw / 2, x1 = cx + dw / 2, inset = dd * 0.45
    const open = clamp(Math.round(2 + t * (SCROLLS - 2)), 2, SCROLLS)
    // the scribe kneels behind the desk; his chest carries the chip
    const sh = Math.min(hh * 0.3, dd * 2.4)
    const sx = cx - Math.min(dw * 0.12, sh * 0.34), sy = back + dd * 0.3
    const sc = scribe(sx, sy, sh, 2911)
    const chip = sh * 0.13
    const chx = sx + sh * 0.12, chy = sy - sh * 0.5
    let pins = ''
    for (let k = 1; k < 4; k++) {
      const o = (chip * k) / 4
      pins += `M${f1(chx - chip / 2 + o)} ${f1(chy - chip / 2 - chip * 0.2)}v${f1(chip * 0.2)}M${f1(chx - chip / 2 + o)} ${f1(chy + chip / 2)}v${f1(chip * 0.2)}M${f1(chx - chip / 2 - chip * 0.2)} ${f1(chy - chip / 2 + o)}h${f1(chip * 0.2)}M${f1(chx + chip / 2)} ${f1(chy - chip / 2 + o)}h${f1(chip * 0.2)}`
    }
    const hand: Pt = [sx + sh * 0.5, back + dd * 0.45]
    // the desk: a wooden top in perspective (brushed edges, long grain, a knot), a darker apron, four legs with their shadows
    const topD = `M${P([x0 + inset, back])}L${P([x1 - inset, back])}L${P([x1, front])}L${P([x0, front])}Z`
    const at = (u: number, k: number): Pt => [x0 + inset * (1 - k) + (dw - 2 * inset * (1 - k)) * u, back + dd * k]
    let grain = ''
    for (let i = 0; i < 11; i++) {
      const k = (i + 0.5) / 11
      let u0 = r() * 0.15
      while (u0 < 0.95) {
        const u1 = Math.min(0.99, u0 + 0.2 + r() * 0.45)
        const m = (u0 + u1) / 2
        const [ax2, ay] = at(u0, k), [mx, my] = at(m, k + (r() - 0.5) * 0.04), [bx2, by] = at(u1, k)
        grain += stroke([[ax2, ay], [mx, my], [bx2, by]], 0.7 + r() * 0.9, 0.2, 0.3, 0.1)
        u0 = u1 + 0.03 + r() * 0.1
      }
    }
    const [kx0, ky0] = at(0.3 + r() * 0.3, 0.55)
    grain += stroke(Array.from({ length: 13 }, (_, i) => [kx0 + Math.cos((i / 12) * 6.3) * dd * 0.12, ky0 + Math.sin((i / 12) * 6.3) * dd * 0.05] as Pt), 0.9, 0.1, 0.1, 0.4) +
      stroke(Array.from({ length: 13 }, (_, i) => [kx0 + Math.cos((i / 12) * 6.3) * dd * 0.06, ky0 + Math.sin((i / 12) * 6.3) * dd * 0.025] as Pt), 0.8, 0.1, 0.1, 0.4)
    const edges = stroke([[x0 - 2, front + 0.5], [cx, front + 1.5], [x1 + 2, front]], Math.max(2.4, dd * 0.06), 0.03, 0.03, 0.5) +
      stroke([[x0 + inset, back], [x0 - 1, front]], Math.max(1.6, dd * 0.035), 0.1, 0.1, 0.4) +
      stroke([[x1 - inset, back], [x1 + 1, front]], Math.max(1.8, dd * 0.04), 0.1, 0.1, 0.4) +
      stroke([[x0 + inset, back], [x1 - inset, back - 0.5]], Math.max(1, dd * 0.02), 0.2, 0.2, 0.3) +
      stroke([[x0, front + apron], [cx, front + apron + 1], [x1, front + apron]], Math.max(2.2, dd * 0.05), 0.05, 0.05, 0.4)
    const leg = (x: number, top: number, len: number, side: number) => stroke([[x, top], [x + side * len * 0.02, top + len * 0.6], [x + side * len * 0.1, top + len]], Math.max(4, dd * 0.13), 0.02, 0.25, 0.55)
    const legs = leg(x0 + dw * 0.05, front + apron, legH, -1) + leg(x1 - dw * 0.05, front + apron, legH, 1)
    const backLegs = leg(x0 + inset + dw * 0.04, front + apron - 2, legH * 0.62, -1) + leg(x1 - inset - dw * 0.04, front + apron - 2, legH * 0.62, 1)
    const legShade = [x0 + dw * 0.05, x1 - dw * 0.05].map((x) => stroke([[x + dd * 0.035, front + apron + 2], [x + dd * 0.04, front + apron + legH * 0.8]], Math.max(1, dd * 0.03), 0.2, 0.3, 0.2)).join('')
    // the plates of HBM: a tall stack of thin porcelain right at the desk's edge
    const hx = x1 - inset * 0.6 - dd * 0.35, hy = back + dd * 0.5
    const prx = Math.min(dd * 0.42, dw * 0.08), pry = prx * 0.28
    const plates: SVGElement[] = []
    for (let k = 0; k < 14; k++) {
      const y = hy - k * sh * 0.06
      plates.push(s('ellipse', { class: 't29d-plate', cx: f1(hx + (r() - 0.5) * 1.2), cy: f1(y), rx: f1(prx), ry: f1(pry) }))
      plates.push(s('path', { class: 't29d-plate-ink', d: stroke(curve([hx - prx * 0.9, y + pry * 0.3], [hx, y + pry * 1.2], [hx + prx * 0.9, y + pry * 0.3], 8), Math.max(0.8, prx * 0.05), 0.2, 0.2, 0.3) }))
    }
    // open scrolls on the desk top: one or two rows of handscrolls with columns of writing, rollers at both ends
    const rows = open > 4 ? 2 : 1
    const per = Math.ceil(open / rows)
    const ax = x0 + inset + dw * 0.04, bx = hx - prx * 1.4
    const sheets: SVGElement[] = []
    for (let i = 0; i < open; i++) {
      const row = Math.floor(i / per), col = i % per
      const k = rows === 1 ? 0.55 : 0.32 + row * 0.44
      const y = back + dd * k
      const left = ax - inset * k * 0.4, right = bx + inset * k * 0.1
      const slot = (right - left) / per
      const swd = slot * 0.84, shd = dd * (rows === 1 ? 0.5 : 0.34)
      const x = left + slot * col + (slot - swd) / 2
      const skew = inset * 0.25
      const page = `M${P([x + skew, y - shd / 2])}L${P([x + swd + skew, y - shd / 2])}L${P([x + swd, y + shd / 2])}L${P([x, y + shd / 2])}Z`
      let text = ''
      const cols = Math.max(2, Math.round(swd / 6))
      for (let c = 1; c < cols; c++) {
        const cxx = x + (swd * c) / cols
        const len = shd * (0.35 + r() * 0.4)
        text += stroke([[cxx + skew * 0.8, y - shd * 0.38], [cxx + skew * 0.3, y - shd * 0.38 + len]], Math.max(0.7, swd * 0.03), 0.2, 0.3, 0.2)
      }
      sheets.push(s('path', { class: 't29d-sheet', d: page }), s('path', { class: 't29d-lines', d: text }),
        s('path', { class: 't29d-rollend', d: rollEnd([x + skew, y - shd / 2], [x, y + shd / 2], Math.max(5, shd * 0.4)) + rollEnd([x + swd + skew, y - shd / 2], [x + swd, y + shd / 2], Math.max(5, shd * 0.4)) }),
        s('path', { class: 't29d-roll', d: stroke([[x + skew - 2, y - shd / 2 - 2], [x - 2, y + shd / 2 + 2]], Math.max(1, shd * 0.05), 0.1, 0.1, 0.5) + stroke([[x + swd + skew + 2, y - shd / 2 - 2], [x + swd + 2, y + shd / 2 + 2]], Math.max(1, shd * 0.05), 0.1, 0.1, 0.5) + stroke([[x + 1, y + shd / 2 + 2], [x + 1.4, y + shd / 2 + shd * 0.22]], Math.max(2, shd * 0.12), 0.1, 0.1, 0.6) + stroke([[x + swd + 1, y + shd / 2 + 2], [x + swd + 1.4, y + shd / 2 + shd * 0.22]], Math.max(2, shd * 0.12), 0.1, 0.1, 0.6) }))
    }
    // the rest wait rolled up in the store at the far left
    const kx = Math.max(hh * 0.06, w * 0.06), ky = hh * 0.66 + hh * 0.02
    const rolled = Array.from({ length: SCROLLS - open }, (_, i) => {
      const x = kx - hh * 0.04 + (i % 3) * hh * 0.04, y = ky - hh * (0.018 + Math.floor(i / 3) * 0.1)
      return s('g', null, s('circle', { class: 't29d-rolled', cx: f1(x), cy: f1(y), r: f1(hh * 0.015) }), s('path', { class: 't29d-core', d: `M${f1(x + hh * 0.004)} ${f1(y)}a${f1(hh * 0.004)} ${f1(hh * 0.004)} 0 1 0 ${f1(-hh * 0.002)} ${f1(hh * 0.006)}a${f1(hh * 0.009)} ${f1(hh * 0.009)} 0 1 0 ${f1(hh * 0.01)} ${f1(-hh * 0.008)}` }))
    })
    const busy = open < 5
    const tw = G.stackLabel.length * 6.4 // the caption's width at 13 px, roughly
    desk.replaceChildren(
      wash(blob(cx + dw * 0.05, front + apron + legH + 2, dw * 0.6, Math.max(5, dd * 0.22), 2912, 0.15), 0.22),
      // the scribe behind the desk
      ...sc.parts,
      s('rect', { class: 't29d-chip', x: f1(chx - chip / 2), y: f1(chy - chip / 2), width: f1(chip), height: f1(chip), rx: f1(chip * 0.12) }),
      s('path', { class: 't29d-pins', d: pins }),
      s('rect', { class: 't29d-chip-core', x: f1(chx - chip * 0.26), y: f1(chy - chip * 0.26), width: f1(chip * 0.52), height: f1(chip * 0.52), rx: 1 }),
      s('path', { class: 't29d-leg t29d-leg-back', d: backLegs, filter: 'url(#ink-rough)' }),
      s('path', { class: 't29d-apron', d: `M${P([x0, front])}L${P([x1, front])}L${P([x1, front + apron])}L${P([x0, front + apron])}Z`, filter: 'url(#ink-rough)' }),
      s('path', { class: 't29d-leg', d: legs, filter: 'url(#ink-rough)' }),
      s('path', { class: 'gb-rim-hi', d: legShade }),
      s('path', { class: 't29d-top', d: topD, filter: 'url(#ink-rough)' }),
      s('path', { class: 't29d-grain', d: grain }),
      s('path', { class: 't29d-edge', d: edges, filter: 'url(#ink-rough)' }),
      s('path', { class: 'gb-rim-hi', d: stroke([[x0 + inset + 3, back + 1.2], [x1 - inset - 3, back + 0.8]], Math.max(1, dd * 0.03), 0.2, 0.2, 0.2) }),
      ...sheets,
      // the brush hand, writing (it runs faster on a wide desk)
      s('g', { class: 't29d-arm', style: `transform-origin:${f1(sc.elbow[0])}px ${f1(sc.elbow[1])}px;--pace:${f1(1.4 - t * 1.0)}s` },
        s('path', { class: 't29d-robe t29d-cuff', d: stroke(curve(sc.elbow, [sc.elbow[0] + sh * 0.1, sc.elbow[1] + sh * 0.02], [hand[0] - sh * 0.06, hand[1] - sh * 0.05], 8), Math.max(3, sh * 0.075), 0.05, 0.4, 0.5) }),
        s('path', { class: 't29d-face', d: blob(hand[0] - sh * 0.02, hand[1] - sh * 0.035, sh * 0.04, sh * 0.03, 2913, 0.15, 8) }),
        s('path', { class: 't29d-ink', d: stroke(curve(sc.elbow, [sc.elbow[0] + sh * 0.1, sc.elbow[1] + sh * 0.02], [hand[0] - sh * 0.06, hand[1] - sh * 0.05], 8), Math.max(1, sh * 0.02), 0.1, 0.3, 0.3) +
          stroke([[hand[0] - sh * 0.04, hand[1] - sh * 0.16], [hand[0], hand[1] - sh * 0.04], [hand[0] + sh * 0.012, hand[1] + sh * 0.02]], Math.max(1.2, sh * 0.02), 0.05, 0.5, 0.15) })),
      ...plates,
      s('text', { class: 'gf-caption t29d-hbm', x: f1(clamp(hx, tw / 2 + 6, w - tw / 2 - 6)), y: f1(hy - 13 * sh * 0.06 - pry - 10), 'text-anchor': 'middle' }, G.stackLabel),
      ...rolled,
      s('g', { class: `t29d-run${busy ? ' on' : ''}`, style: `--run:${f1(x0 + inset - kx)}px` },
        s('circle', { class: 't29d-rolled', cx: f1(kx), cy: f1(ky - hh * 0.118), r: f1(hh * 0.016) }),
        s('path', { class: 't29d-core', d: `M${f1(kx + hh * 0.004)} ${f1(ky - hh * 0.118)}a${f1(hh * 0.004)} ${f1(hh * 0.004)} 0 1 0 ${f1(-hh * 0.002)} ${f1(hh * 0.006)}a${f1(hh * 0.009)} ${f1(hh * 0.009)} 0 1 0 ${f1(hh * 0.01)} ${f1(-hh * 0.008)}` })))
  }
}
