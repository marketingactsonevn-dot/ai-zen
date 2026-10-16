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

/** A scribe kneeling at (x, y) (his knees on the floor line), `hh` tall: a broad robe, a winged scholar's cap, the head bowed to the desk. */
function scribe(x: number, y: number, hh: number, seed: number): string {
  const u = hh / 10
  const neck: Pt = [x + u * 0.6, y - u * 6.9]
  const head: Pt = [x + u * 1.2, y - u * 7.9]
  return `M${P([x - u * 3.6, y])}Q${P([x - u * 3.9, y - u * 3.2])} ${P([x - u * 1.8, y - u * 5.6])}Q${P([x - u * 0.6, y - u * 6.9])} ${P(neck)}Q${P([x + u * 1.8, y - u * 6.3])} ${P([x + u * 2.2, y - u * 4.4])}Q${P([x + u * 2.6, y - u * 1.8])} ${P([x + u * 3.8, y - u * 0.6])}L${P([x + u * 3.6, y])}Z` +
    blob(head[0], head[1], u * 0.85, u * 0.95, seed, 0.08, 12) +
    blob(head[0] - u * 0.1, head[1] - u * 0.85, u * 0.95, u * 0.55, seed + 1, 0.05, 10) +
    stroke([[head[0] - u * 2.1, head[1] - u * 0.75], [head[0] - u * 1.0, head[1] - u * 0.95]], u * 0.45, 0.3, 0.1, 0.4) +
    stroke([[head[0] + u * 0.8, head[1] - u * 0.95], [head[0] + u * 1.9, head[1] - u * 0.8]], u * 0.45, 0.1, 0.3, 0.4)
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
      wash(blob(w * 0.5, floor + hh * 0.17, w * 0.5, hh * 0.13, 2902, 0.18, 14), 0.05),
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
    const sx = cx - Math.min(dw * 0.08, sh * 0.3), sy = back + dd * 0.3
    const chip = sh * 0.15
    const chx = sx + sh * 0.02, chy = sy - sh * 0.47
    let pins = ''
    for (let k = 1; k < 4; k++) {
      const o = (chip * k) / 4
      pins += `M${f1(chx - chip / 2 + o)} ${f1(chy - chip / 2 - chip * 0.2)}v${f1(chip * 0.2)}M${f1(chx - chip / 2 + o)} ${f1(chy + chip / 2)}v${f1(chip * 0.2)}M${f1(chx - chip / 2 - chip * 0.2)} ${f1(chy - chip / 2 + o)}h${f1(chip * 0.2)}M${f1(chx + chip / 2)} ${f1(chy - chip / 2 + o)}h${f1(chip * 0.2)}`
    }
    const hand: Pt = [sx + sh * 0.42, back + dd * 0.42]
    // the desk: a top in perspective with grain, a dark front apron, short legs
    const topD = `M${P([x0 + inset, back])}L${P([x1 - inset, back])}L${P([x1, front])}L${P([x0, front])}Z`
    let grain = ''
    for (let i = 0; i < 9; i++) {
      const k = (i + 0.5) / 9, y = back + dd * k
      const a = x0 + inset * (1 - k) + dw * r() * 0.3, b = a + dw * (0.2 + r() * 0.4)
      grain += stroke([[a, y], [Math.min(b, x1 - inset * (1 - k)), y + (r() - 0.5)]], 0.8 + r() * 0.8, 0.2, 0.3, 0.1)
    }
    const legs = [x0 + dw * 0.05, x1 - dw * 0.05].map((x) => stroke([[x, front + apron], [x + (x < cx ? -2 : 2), front + apron + legH]], Math.max(4, dd * 0.12), 0.02, 0.1, 0.6)).join('')
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
        s('path', { class: 't29d-roll', d: stroke([[x + skew, y - shd / 2 - 1], [x - 1, y + shd / 2 + 1]], Math.max(2.4, shd * 0.16), 0.05, 0.05, 0.7) + stroke([[x + swd + skew, y - shd / 2 - 1], [x + swd - 1, y + shd / 2 + 1]], Math.max(2.4, shd * 0.16), 0.05, 0.05, 0.7) }))
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
      s('ellipse', { class: 'gb-shadow', cx: f1(cx + dw * 0.04), cy: f1(front + apron + legH + 2), rx: f1(dw * 0.58), ry: f1(Math.max(4, dd * 0.18)) }),
      // the scribe behind the desk
      s('path', { class: 'gb-figure', d: scribe(sx, sy, sh, 2911) }),
      s('path', { class: 't29d-fold', d: stroke(curve([sx - sh * 0.22, sy - sh * 0.5], [sx - sh * 0.1, sy - sh * 0.3], [sx - sh * 0.14, sy - sh * 0.05], 6), Math.max(1, sh * 0.02), 0.2, 0.4, 0.1) + stroke(curve([sx + sh * 0.02, sy - sh * 0.35], [sx + sh * 0.1, sy - sh * 0.18], [sx + sh * 0.2, sy - sh * 0.06], 6), Math.max(1, sh * 0.016), 0.2, 0.4, 0.1) }),
      s('path', { class: 'gb-figure-rim', d: stroke(curve([sx - sh * 0.2, sy - sh * 0.56], [sx - sh * 0.38, sy - sh * 0.38], [sx - sh * 0.37, sy - sh * 0.08], 8), Math.max(1.2, sh * 0.02), 0.2, 0.4, 0.1) }),
      s('rect', { class: 't29d-chip', x: f1(chx - chip / 2), y: f1(chy - chip / 2), width: f1(chip), height: f1(chip), rx: f1(chip * 0.12) }),
      s('path', { class: 't29d-pins', d: pins }),
      s('rect', { class: 't29d-chip-core', x: f1(chx - chip * 0.26), y: f1(chy - chip * 0.26), width: f1(chip * 0.52), height: f1(chip * 0.52), rx: 1 }),
      s('path', { class: 't29d-apron', d: `M${P([x0, front])}L${P([x1, front])}L${P([x1, front + apron])}L${P([x0, front + apron])}Z`, filter: 'url(#ink-rough)' }),
      s('path', { class: 't29d-leg', d: legs, filter: 'url(#ink-rough)' }),
      s('path', { class: 't29d-top', d: topD, filter: 'url(#ink-rough)' }),
      s('path', { class: 't29d-grain', d: grain, filter: 'url(#ink-dry)' }),
      s('path', { class: 'gb-rim-hi', d: stroke([[x0 + inset, back + 0.8], [x1 - inset, back + 0.8]], Math.max(1, dd * 0.03), 0.2, 0.2, 0.2) }),
      ...sheets,
      // the brush hand, writing (it runs faster on a wide desk)
      s('g', { class: 't29d-arm', style: `transform-origin:${f1(sx + sh * 0.12)}px ${f1(sy - sh * 0.6)}px;--pace:${f1(1.4 - t * 1.0)}s` },
        s('path', { class: 'gb-figure', d: stroke(curve([sx + sh * 0.12, sy - sh * 0.6], [sx + sh * 0.36, sy - sh * 0.5], hand, 8), Math.max(2, sh * 0.075), 0.1, 0.3, 0.45) + stroke([[hand[0] - sh * 0.01, hand[1] - sh * 0.13], [hand[0] + sh * 0.02, hand[1] + sh * 0.01]], Math.max(1, sh * 0.018), 0.05, 0.4, 0.3) })),
      ...plates,
      s('text', { class: 'gf-caption t29d-hbm', x: f1(clamp(hx, tw / 2 + 6, w - tw / 2 - 6)), y: f1(hy - 13 * sh * 0.06 - pry - 10), 'text-anchor': 'middle' }, G.stackLabel),
      ...rolled,
      s('g', { class: `t29d-run${busy ? ' on' : ''}`, style: `--run:${f1(x0 + inset - kx)}px` },
        s('circle', { class: 't29d-rolled', cx: f1(kx), cy: f1(ky - hh * 0.118), r: f1(hh * 0.016) }),
        s('path', { class: 't29d-core', d: `M${f1(kx + hh * 0.004)} ${f1(ky - hh * 0.118)}a${f1(hh * 0.004)} ${f1(hh * 0.004)} 0 1 0 ${f1(-hh * 0.002)} ${f1(hh * 0.006)}a${f1(hh * 0.009)} ${f1(hh * 0.009)} 0 1 0 ${f1(hh * 0.01)} ${f1(-hh * 0.008)}` })))
  }
}
