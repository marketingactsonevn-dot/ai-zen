import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { blob, stroke } from '../../ui/part2/ink'
import { findTakeaway, takeaway } from '../../ui/part2/takeaway'
import { C } from './data'
import { clamp, f1, frame } from '../t28/frame'

const G = C.scenes.desk
const GB = [8, 16, 32, 64, 96, 141]
const SCROLLS = 8

/** The chip is a scribe at a low desk under a lantern: the wider the desk (memory), the more scrolls lie open at once. */
export function deskScene(ctx: SceneCtx) {
  let idx = 1
  const out = h('p', { class: 't29d-val' }, fill(G.valueText, { n: GB[idx] }))
  const msg = h('p', { class: 't29d-msg', 'aria-live': 'polite' })
  const inp = h('input', { type: 'range', min: 0, max: GB.length - 1, step: 1, value: idx, 'aria-label': G.slider, 'aria-valuetext': fill(G.valueText, { n: GB[idx] }) })
  const panel = h('div', { class: 'gf-panel t29d-panel' }, h('label', { class: 't29d-lab' }, h('span', { class: 'gf-eyebrow' }, G.slider), inp), out, msg)
  const { root } = frame(ctx, 't29d', [...(G.insights as Fact[])], panel, (w, hh) => { size = [w, hh]; draw() })
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
      if (card) panel.append(h('div', { class: 't29d-card gf-new' }, takeaway(card)))
    }
  })

  function draw() {
    const [w, hh] = size
    if (!w) return
    const svg = root.querySelector('svg')!
    const t = idx / (GB.length - 1)
    const cx = w * 0.54, top = hh * 0.5
    const maxW = Math.min(w * 0.8, hh * 1.6), minW = maxW * 0.32
    const dw = minW + (maxW - minW) * t, dd = Math.min(hh * 0.2, maxW * 0.16)
    const legH = hh * 0.12
    const x0 = cx - dw / 2, x1 = cx + dw / 2
    const open = clamp(Math.round(2 + t * (SCROLLS - 2)), 2, SCROLLS)
    // open scrolls on the desk top: a sheet with brushed lines and two rolled ends
    const sw = Math.min((dw * 0.86) / Math.max(open, 4), dd * 0.9), sh = dd * 0.5
    const sheets = Array.from({ length: open }, (_, i) => {
      const x = x0 + dw * 0.07 + i * ((dw * 0.86) / open) + ((dw * 0.86) / open - sw) / 2
      const y = top + dd * 0.38 + (i % 2) * dd * 0.06
      return s('g', null,
        s('rect', { class: 't29d-sheet', x: f1(x), y: f1(y), width: f1(sw), height: f1(sh), rx: 1.5 }),
        s('path', { class: 't29d-lines', d: [0.25, 0.45, 0.65].map((k) => `M${f1(x + sw * 0.18)} ${f1(y + sh * k)}h${f1(sw * (0.5 + ((i + k * 10) % 3) * 0.1))}`).join('') }),
        s('rect', { class: 't29d-roll', x: f1(x - 2), y: f1(y - 2), width: f1(sw + 4), height: 4, rx: 2 }),
        s('rect', { class: 't29d-roll', x: f1(x - 2), y: f1(y + sh - 2), width: f1(sw + 4), height: 4, rx: 2 }))
    })
    // the rest wait rolled up on the storehouse shelf at the far left
    const kx = w * 0.07, ky = top + dd * 0.2
    const rolls = Array.from({ length: SCROLLS - open }, (_, i) => s('circle', { class: 't29d-rolled', cx: f1(kx + (i % 2) * 11), cy: f1(ky + dd - Math.floor(i / 2) * 10 - 6), r: 5 }))
    // the scribe (chip) at the back of the desk, and the HBM stack right beside it
    const chip = Math.min(dd * 0.95, 70)
    const chx = cx - chip * 0.2, chy = top - chip * 0.55
    let pins = ''
    for (let k = 1; k < 6; k++) {
      const o = (chip * k) / 6
      pins += `M${f1(chx - chip / 2 + o)} ${f1(chy - chip / 2 - 5)}v5M${f1(chx - chip / 2 + o)} ${f1(chy + chip / 2)}v5M${f1(chx - chip / 2 - 5)} ${f1(chy - chip / 2 + o)}h5M${f1(chx + chip / 2)} ${f1(chy - chip / 2 + o)}h5`
    }
    const hx = chx + chip * 1.05, hw = chip * 0.55
    const plates = Array.from({ length: 8 }, (_, k) => s('rect', { class: 't29d-plate', x: f1(hx - hw / 2), y: f1(chy + chip * 0.5 - k * chip * 0.15), width: f1(hw), height: f1(chip * 0.11), rx: 2 }))
    const lx = w * 0.86, ly = hh * 0.1
    const legs = `M${f1(x0 + 10)} ${f1(top + dd)}v${f1(legH)}M${f1(x1 - 10)} ${f1(top + dd)}v${f1(legH)}`
    svg.replaceChildren(
      s('ellipse', { cx: f1(lx), cy: f1(ly + 26), rx: 80, ry: 80, fill: 'url(#p2-halo)' }),
      s('path', { class: 'gf-ink-s', 'stroke-width': 1.2, d: `M${f1(lx)} 0V${f1(ly + 10)}` }),
      s('path', { class: 'gf-lantern', d: blob(lx, ly + 26, 14, 18, 4, 0.04) }),
      s('path', { class: 'gf-ink', d: `M${f1(lx - 9)} ${f1(ly + 8)}h18v4h-18zM${f1(lx - 9)} ${f1(ly + 40)}h18v4h-18z` }),
      s('ellipse', { class: 't29d-shadow', cx: f1(cx), cy: f1(top + dd + legH + 2), rx: f1(dw * 0.55), ry: 7 }),
      s('path', { class: 'gf-ink-s', 'stroke-width': 3, d: legs }),
      s('path', { class: 't29d-top', fill: 'url(#p2-rock)', d: `M${f1(x0 + dd * 0.4)} ${f1(top)}H${f1(x1 - dd * 0.4)}L${f1(x1)} ${f1(top + dd)}H${f1(x0)}Z` }),
      s('path', { class: 'gf-ink', d: stroke([[x0 - 2, top + dd], [x1 + 2, top + dd + 1]], 5, 0.04, 0.04, 0.6) }),
      ...sheets,
      s('rect', { class: 't29d-chip', x: f1(chx - chip / 2), y: f1(chy - chip / 2), width: f1(chip), height: f1(chip), rx: 4 }),
      s('path', { class: 'gf-ink-s', 'stroke-width': 1.6, d: pins }),
      s('rect', { class: 't29d-core', x: f1(chx - chip * 0.28), y: f1(chy - chip * 0.28), width: f1(chip * 0.56), height: f1(chip * 0.56), rx: 2 }),
      ...plates,
      s('text', { class: 'gf-label', x: f1(Math.min(hx, w - 140)), y: f1(chy - chip * 0.75), 'text-anchor': 'middle' }, G.stackLabel),
      s('rect', { class: 't29d-shelf', x: f1(kx - 10), y: f1(ky + dd), width: 34, height: 4 }),
      ...rolls,
      s('g', { class: `t29d-run${open < 5 ? ' on' : ''}`, style: `--run:${f1(x0 + dw * 0.1 - kx)}px` }, s('circle', { class: 'gf-lantern', cx: f1(kx + 6), cy: f1(ky + dd - 20), r: 4 })))
  }
}
