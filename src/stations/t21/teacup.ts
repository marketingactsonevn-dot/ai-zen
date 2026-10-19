import raw from '../../content/tram-21.json'
import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import type { SceneCtx } from '../types'
import { blob, clamp, curve, onSize, p2Defs, rng, stableHeight, stroke, type Pt } from '../../ui/part2/ink'
import { mist, moon as moonArt, paperLantern, wash } from '../../ui/part2/paint'
import { guide, type Mark } from '../../ui/part2/guide'

const T = raw.scenes.teacup
const f1 = (n: number) => n.toFixed(1)

// MACRO at the stone tea table: the set is drawn in a 640 × 300 design box, the camera low at the table's edge so the
// stone top fills the lower third and runs out of the frame on both sides; the key light is the paper lantern hanging up
// left, so every shadow falls right and a little toward us. Wide screens see the whole box; phones see a 380-wide window
// round the cup, and more of the sky above the table.
const DW = 640, DH = 300
const TOP = 196, EDGE = 278 // the table top's far and near edge (design y)
type Lay = { tube: Pt; pot: Pt; cup: Pt; basket: Pt; head: Pt; sh: Pt; lamp: Pt }
const WIDE: Lay = { tube: [92, 270], pot: [250, 246], cup: [380, 266], basket: [540, 272], head: [586, 92], sh: [700, -30], lamp: [150, 64] }
const TALL: Lay = { tube: [270, 272], pot: [322, 244], cup: [394, 268], basket: [502, 276], head: [500, -40], sh: [604, -150], lamp: [262, -64] }
const L1 = 262, L2 = 252 // the arm: upper arm, forearm (design units)
const FAN = (open: number) => stroke([[0, 0], [24, -7 - 9 * open], [36, -3 - 11 * open]], 7, 0.05, 0.25, 0.45) + stroke([[0, 0], [26, 2], [38, 5]], 7, 0.05, 0.25, 0.45) + stroke([[0, 0], [24, 9 + 9 * open], [35, 7 + 11 * open]], 7, 0.05, 0.25, 0.45)
const FINGERS_OPEN = FAN(1), FINGERS_SHUT = FAN(0)

/** Tiers of books piled into a mountain from x0…x1 on `base`, `hgt` tall: each book a slab with a pale top face, each
 *  tier a ledge of shadow under it (three paths: spines, tops, ledges). */
function books(x0: number, x1: number, base: number, hgt: number, seed: number, rowH: number) {
  const r = rng(seed)
  let sp = '', sp2 = '', top = '', ledge = ''
  const rows = Math.max(3, Math.floor(hgt / rowH))
  const mid = (x0 + x1) / 2, half = (x1 - x0) / 2
  for (let k = 0; k < rows; k++) {
    const t = k / rows
    const w = half * (1 - t ** 1.1) * (0.9 + r() * 0.1)
    const y = base - k * rowH
    const xa = mid - w + (r() - 0.5) * rowH * 1.4, xb = mid + w + (r() - 0.5) * rowH * 1.4
    ledge += `M${f1(xa - rowH * 0.3)} ${f1(y)}L${f1(xb + rowH * 0.3)} ${f1(y)}L${f1(xb)} ${f1(y + rowH * 0.2)}L${f1(xa)} ${f1(y + rowH * 0.2)}Z`
    let x = xa
    while (x < xb) {
      if (r() < 0.08) {
        // a book lying flat on the tier
        const lw = rowH * (1.1 + r()), lh = rowH * 0.24
        sp2 += `M${f1(x)} ${f1(y)}h${f1(lw)}v${f1(-lh)}h${f1(-lw)}Z`
        top += `M${f1(x)} ${f1(y - lh)}h${f1(lw)}l${f1(-rowH * 0.12)} ${f1(-rowH * 0.08)}h${f1(-lw)}Z`
        x += lw + 1
        continue
      }
      const sw = rowH * (0.16 + r() * 0.24), sh = rowH * (0.55 + r() * 0.4), lean = (r() - 0.5) * rowH * 0.14
      const d = `M${f1(x)} ${f1(y)}l${f1(lean)} ${f1(-sh)}h${f1(sw)}l${f1(-lean)} ${f1(sh)}Z`
      if (r() < 0.45) sp2 += d
      else sp += d
      top += `M${f1(x + lean)} ${f1(y - sh)}h${f1(sw)}l${f1(-sw * 0.35)} ${f1(-rowH * 0.07)}h${f1(-sw)}Z`
      x += sw + rowH * (0.02 + r() * 0.06)
    }
  }
  return [s('path', { class: 't21t-ledge', d: ledge }), s('path', { class: 't21t-spine', d: sp }), s('path', { class: 't21t-spine b', d: sp2 }), s('path', { class: 't21t-btop', d: top })]
}

/** One arm segment along +x from 0 to len, w thick, in ink wash: the body as a brushed stroke, its underside in shadow,
 *  a paler band on the side the lantern lights (no outline). */
function inkSeg(len: number, w: number, seed: number) {
  const r = rng(seed)
  const body: Pt[] = [[-w * 0.35, 0], [len * 0.5, 0.6], [len + w * 0.35, 0]]
  // dry-brush hairs along the stroke: where the ink ran thin, the paper shows through in streaks
  let hair = ''
  for (let i = 0; i < 5; i++) {
    const y = (r() - 0.5) * w * 0.6, x0 = r() * len * 0.4, x1 = len * (0.55 + r() * 0.45)
    hair += stroke([[x0, y], [(x0 + x1) / 2, y + (r() - 0.5) * 2], [x1, y + (r() - 0.5) * 2]], 0.8 + r() * 1.4, 0.3, 0.3, 0.1)
  }
  return [
    s('path', { class: 't21t-arm', d: stroke(body, w, 0.04, 0.04, 0.8), fill: 'url(#t21t-armg)' }),
    s('path', { class: 't21t-arm-hair', d: hair }),
    s('path', { class: 't21t-arm-hi', d: stroke([[w * 0.1, -w * 0.34], [len * 0.55, -w * 0.36], [len - w * 0.1, -w * 0.32]], w * 0.1, 0.3, 0.3, 0.2) }),
  ]
}
/** A joint: a dark ring round a pale hub, its small shadow on the arm below. */
const joint = (r: number) => [
  s('ellipse', { class: 't21t-joint-sh', cx: r * 0.35, cy: r * 0.5, rx: r * 1.05, ry: r * 0.9 }),
  s('circle', { class: 't21t-joint', cx: 0, cy: 0, r }),
  s('circle', { class: 't21t-hub', cx: -r * 0.12, cy: -r * 0.12, r: r * 0.36 }),
]

/**
 * Scene 3 · Bộ não cho tay chân — MACRO at a stone tea table, 2.5D. The camera sits at the table's edge: the chipped,
 * veined stone top fills the lower third; a celadon cup stands large in front, a clay teapot behind it, a little bamboo
 * basket of paper rolls ("hand data"), slips of bamboo in a tube. A paper lantern hanging up left is the warm key light:
 * it pools on the stone, lights the left of every object and throws their shadows right. A jointed robot arm in ink wash
 * reaches in from the robot at the right edge, whose head is a paper lantern; behind, out of focus, a mountain of book
 * tiers climbs into cloud. Pull a slip from the tube: the head lights at once and the command is written in one neat line;
 * then the hand trembles toward the cup, overshoots, tips it (a ghost cup shows the spill it predicts), slides, tries
 * again. Pull the lantern's cord down (or drag down, or ↓) to pull the camera back: the book mountain rises through four
 * layers of mist while the basket stays tiny.
 */
export function teacupScene(ctx: SceneCtx) {
  p2Defs()
  const stableH = stableHeight(ctx, [T.insight as Fact, T.insight2 as Fact])
  const still = ctx.reduced || ctx.quality === 'low'

  // ── the far book mountain: four layers that come down into view as the camera pulls back
  const layers = [0, 1, 2, 3].map((i) => s('svg', { class: `t21t-far l${i}`, 'aria-hidden': 'true' }))
  // ── the set: table, cup, teapot, basket, tube, lanterns, arm
  const cup = s('g', { class: 't21t-cup' })
  const tea = s('g', { class: 't21t-teaface' })
  const pot = s('g', { class: 't21t-pot' })
  const ghost = s('g', { class: 't21t-ghost' })
  const streamP = s('path', { class: 't21t-stream' })
  const drops = s('path', { class: 't21t-drops' })
  const armShadow = s('ellipse', { class: 't21t-arm-sh', rx: 70, ry: 9, fill: 'url(#t21t-soft)' })
  const gUpper = s('g'), gFore = s('g'), gHand = s('g')
  const fingers = s('path', { class: 't21t-finger' })
  const arm = s('g', { class: 't21t-armg' }, gUpper)
  const echo = s('g', { class: 't21t-echo', 'aria-hidden': 'true' }) // the tremor: a faint second arm, a beat behind
  const head = s('g', { class: 't21t-head' })
  const set = s('svg', { class: 't21t-set', viewBox: `0 0 ${DW} ${DH}`, 'aria-hidden': 'true' })
  const setBox = h('div', { class: 't21t-setbox' }, set)

  // ── DOM: slips in the tube (the command written down each), the lines the robot "says", the data, the lantern's cord
  const slips = T.commands.map((c, i) =>
    h('button', { class: 't21t-slip', type: 'button', style: `--i:${i}`, 'aria-label': c.aria, onClick: () => command(i) },
      h('span', { class: 't21t-stick', 'aria-hidden': 'true' }, h('span', { class: 't21t-word' }, c.label))))
  const tube = h('div', { class: 't21t-tube', role: 'group', 'aria-label': T.prompt }, ...slips)
  const said = h('p', { class: 't21t-said' })
  const headLine = h('p', { class: 't21t-headline' }, T.head)
  const handLine = h('p', { class: 't21t-handline' }, T.hand)
  const status = h('div', { class: 't21t-status' }, said, headLine, handLine)
  // the mountain's line (words) and the basket's (moves), each where its thing is; the line under the basket says the two
  // are counted in different units, so the picture is not read as a ratio (audit v3 21-3)
  const dataL = h('div', { class: 't21t-data left' }, h('p', { class: 'p2-eyebrow' }, T.textLabel), ctx.fact(T.data[1] as Fact, 'p', 't21t-datum'))
  const dataR = h('div', { class: 't21t-data right' }, h('p', { class: 'p2-eyebrow' }, T.robotLabel), ctx.fact(T.data[0] as Fact, 'p', 't21t-datum'), h('p', { class: 't21t-common' }, T.common))
  dataL.setAttribute('aria-hidden', 'true')
  dataR.setAttribute('aria-hidden', 'true')
  // the pull: the lantern's cord with a wooden bead; drawing it down steps the camera back (a slider for keys and AT)
  const pull = h('div', {
    class: 't21t-pull', role: 'slider', tabindex: '0', 'aria-label': T.scaleAria, 'aria-orientation': 'vertical',
    'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0', 'aria-valuetext': fill(T.pullValue, { n: 0 }),
  }, h('i', { class: 't21t-cord', 'aria-hidden': 'true' }), h('i', { class: 't21t-bead', 'aria-hidden': 'true' }))
  const root = h('div', { class: 't21t' }, h('p', { class: 'visually-hidden' }, T.art), ...layers, setBox, tube, pull, status, dataL, dataR)
  if (still) root.classList.add('still')
  ctx.art.append(root)
  ctx.prompt(T.prompt)
  const gd = guide(ctx)
  let weightDot: Mark | null = null

  let lay = WIDE
  let SH: Pt = lay.sh, REST: Pt = [0, 0]
  // ── the set's static painting (one pass per orientation) and its moving groups
  function paintSet() {
    const r = rng(2130)
    const { tube: tb, pot: pp, cup: cp, basket: bk, head: hd, lamp } = lay
    const [cx, cy] = cp, [px, py] = pp
    // the stone top: far edge soft, near edge chipped; veins and grit; it runs out of the box on both sides
    // the slab's ends lie outside the macro frame; they show when the camera pulls back (rounded, worn corners)
    const XL = -70, XR = DW + 70
    const top = `M${XL + 30} ${TOP}L${XR - 24} ${TOP}Q${XR - 4} ${TOP + 2} ${XR} ${TOP + 30}L${XR + 6} ${EDGE - 6}Q${XR + 6} ${EDGE} ${XR - 10} ${EDGE}L${XL + 6} ${EDGE}Q${XL - 6} ${EDGE} ${XL - 4} ${EDGE - 8}L${XL + 12} ${TOP + 22}Q${XL + 16} ${TOP} ${XL + 30} ${TOP}Z`
    // the front face; its chips are darker bites painted on it (below), not holes through it
    const front = `M${XL + 4} ${EDGE}L${XR - 8} ${EDGE}Q${XR + 6} ${EDGE} ${XR + 4} ${EDGE + 8}L${XR} ${DH + 26}L${XL + 2} ${DH + 26}L${XL - 2} ${EDGE + 8}Q${XL - 4} ${EDGE} ${XL + 4} ${EDGE}Z`
    let veins = '', grit = '', chips = ''
    for (let i = 0; i < 9; i++) {
      const y = TOP + 8 + r() * (EDGE - TOP - 14), x = -40 + r() * DW
      const pts: Pt[] = []
      for (let k = 0; k <= 8; k++) pts.push([x + k * (30 + r() * 26), y + Math.sin(k * 1.3 + i) * 3 + (r() - 0.5) * 3 + k * (r() - 0.5) * 1.5])
      veins += stroke(pts, 0.8 + r() * 1.1, 0.2, 0.3, 0.15)
    }
    for (let i = 0; i < 160; i++) {
      const y = TOP + r() * (EDGE - TOP), x = -60 + r() * (DW + 120), w = 0.6 + r() * 1.4
      grit += `M${f1(x)} ${f1(y)}h${f1(w)}v${f1(w * 0.5)}h${f1(-w)}Z`
    }
    for (let x = -50; x < DW + 50; x += 50 + r() * 80) chips += blob(x, EDGE + 3 + r() * 3, 4 + r() * 6, 1.6 + r() * 1.4, 2140 + Math.round(x), 0.3, 8)
    // the cup: celadon, lit warm on its left, a long highlight, tea that mirrors the lantern and the moon
    const body = `M${cx - 46} ${cy - 48}C${cx - 45} ${cy - 22} ${cx - 30} ${cy - 5} ${cx - 17} ${cy - 3}L${cx + 17} ${cy - 3}C${cx + 30} ${cy - 5} ${cx + 45} ${cy - 22} ${cx + 46} ${cy - 48}Z`
    cup.replaceChildren(
      s('ellipse', { class: 't21t-sh', cx: cx + 62, cy: cy + 2, rx: 72, ry: 10, fill: 'url(#t21t-soft)' }),
      s('ellipse', { class: 't21t-contact', cx, cy: cy + 0.5, rx: 22, ry: 3.4 }),
      s('path', { class: 't21t-porcelain', d: body, fill: 'url(#t21t-cel)' }),
      s('path', { class: 't21t-cel-shade', d: body, fill: 'url(#t21t-celsh)' }),
      s('path', { class: 't21t-spec', d: stroke(curve([cx - 36, cy - 42], [cx - 34, cy - 22], [cx - 22, cy - 10], 10), 4.2, 0.25, 0.4, 0.15) }),
      s('path', { class: 't21t-spec dim', d: stroke(curve([cx - 26, cy - 44], [cx - 25, cy - 30], [cx - 19, cy - 20], 8), 1.6, 0.3, 0.4, 0.15) }),
      s('path', { class: 't21t-foot', d: `M${cx - 18} ${cy - 4}h36l-3 6h-30z` }),
      s('ellipse', { class: 't21t-rim', cx, cy: cy - 48, rx: 46, ry: 11 }),
      s('ellipse', { class: 't21t-inside', cx, cy: cy - 47.2, rx: 42.5, ry: 9.3 }),
      tea,
      s('path', { class: 't21t-rimlit', d: stroke(curve([cx - 44, cy - 46], [cx - 30, cy - 38], [cx - 6, cy - 37.4], 10), 1.8, 0.2, 0.5, 0.15) }),
      s('path', { class: 't21t-ink', d: stroke([[cx - 46, cy - 48], [cx - 42, cy - 26], [cx - 26, cy - 6], [cx, cy - 3], [cx + 26, cy - 6], [cx + 42, cy - 26], [cx + 46, cy - 48]], 1.6, 0.1, 0.1, 0.4) }))
    tea.replaceChildren(
      s('ellipse', { class: 't21t-tea', cx, cy: cy - 46, rx: 39, ry: 8 }),
      s('ellipse', { class: 't21t-tea-lamp', cx: cx - 15, cy: cy - 47, rx: 8, ry: 2.2 }),
      s('ellipse', { class: 't21t-tea-lamp core', cx: cx - 15, cy: cy - 47, rx: 3.2, ry: 1 }),
      s('ellipse', { class: 't21t-tea-moon', cx: cx + 16, cy: cy - 45.4, rx: 3.6, ry: 1.2 }))
    // the teapot: clay, warm-lit left, its shadow long to the right
    const potBody = `M${px - 41} ${py - 26}C${px - 41} ${py - 50} ${px - 20} ${py - 58} ${px} ${py - 58}C${px + 20} ${py - 58} ${px + 41} ${py - 50} ${px + 41} ${py - 26}C${px + 41} ${py - 8} ${px + 24} ${py} ${px} ${py}C${px - 24} ${py} ${px - 41} ${py - 8} ${px - 41} ${py - 26}Z`
    pot.replaceChildren(
      s('ellipse', { class: 't21t-sh', cx: px + 74, cy: py + 1, rx: 84, ry: 9, fill: 'url(#t21t-soft)' }),
      s('ellipse', { class: 't21t-contact', cx: px, cy: py, rx: 30, ry: 3 }),
      s('path', { class: 't21t-clay', d: potBody, fill: 'url(#t21t-clay)' }),
      s('path', { class: 't21t-clay', d: `M${px + 38} ${py - 34}C${px + 52} ${py - 36} ${px + 58} ${py - 50} ${px + 66} ${py - 64}L${px + 71} ${py - 61}C${px + 64} ${py - 44} ${px + 56} ${py - 28} ${px + 38} ${py - 20}Z`, fill: 'url(#t21t-clay)' }),
      s('path', { class: 't21t-handle', d: `M${px - 39} ${py - 40}C${px - 64} ${py - 46} ${px - 66} ${py - 10} ${px - 39} ${py - 14}`, fill: 'none' }),
      s('ellipse', { class: 't21t-lid', cx: px, cy: py - 56, rx: 21, ry: 5.4 }),
      s('circle', { class: 't21t-knob', cx: px, cy: py - 63, r: 5 }),
      s('path', { class: 't21t-spec warm', d: stroke(curve([px - 32, py - 40], [px - 27, py - 50], [px - 14, py - 54], 8), 3.4, 0.2, 0.4, 0.2) }),
      s('path', { class: 't21t-ink', d: stroke([[px - 41, py - 26], [px - 36, py - 9], [px - 14, py - 0.5], [px + 14, py - 0.5], [px + 36, py - 9], [px + 41, py - 26]], 1.6, 0.1, 0.1, 0.4) }))
    ghost.replaceChildren(
      s('path', { class: 't21t-ghost-cup', d: body }),
      s('ellipse', { class: 't21t-ghost-cup', cx, cy: cy - 48, rx: 46, ry: 11 }),
      s('path', { class: 't21t-ghost-spill', d: blob(cx - 64, cy - 6, 40, 6, 7, 0.3) + blob(cx - 82, cy - 16, 4, 3, 2, 0.2) + blob(cx - 92, cy - 24, 2.6, 2, 3, 0.2) }))
    ghost.setAttribute('transform', `rotate(-48 ${cx - 46} ${cy})`)
    // the arm: upper arm, forearm, a three-finger hand; joints are dark rings with a pale hub
    fingers.setAttribute('d', FINGERS_OPEN)
    wasClosed = false
    gHand.replaceChildren(fingers, ...joint(9))
    gFore.replaceChildren(...inkSeg(L2, 22, 2134), gHand, ...joint(12))
    gUpper.replaceChildren(...inkSeg(L1, 28, 2135), gFore, ...joint(17))
    // the robot at the right edge (its shoulder and a slice of its body) and its head: a ribbed paper lantern, a lens
    const [hx, hy] = hd
    const ribs = [-16, -6, 4, 14].map((dy) => {
      const hw = 23 * Math.sqrt(1 - (dy / 29) ** 2)
      return `M${f1(hx - hw)} ${f1(hy + dy)}Q${f1(hx)} ${f1(hy + dy + 3)} ${f1(hx + hw)} ${f1(hy + dy)}`
    }).join('')
    head.replaceChildren(
      // the robot hangs from a gantry above the frame: a pole down to its shoulder, a bracket out to the head
      s('path', { class: 't21t-body', d: stroke([[SH[0] + 40, SH[1] - 520], [SH[0] + 18, SH[1] - 200], [SH[0] + 6, SH[1] + 10]], 30, 0, 0.1, 0.8) }),
      s('path', { class: 't21t-bracket', d: stroke([[SH[0] + 8, SH[1] + 36], [hx + 46, hy - 26], [hx + 22, hy - 8]], 11, 0.05, 0.1, 0.7) }),
      s('circle', { class: 't21t-head-halo', cx: hx, cy: hy, r: 80, fill: 'url(#t21t-halo)' }),
      s('ellipse', { class: 't21t-head-body', cx: hx, cy: hy, rx: 25, ry: 30 }),
      s('ellipse', { class: 't21t-head-glow', cx: hx - 4, cy: hy - 2, rx: 17, ry: 22, fill: 'url(#t21t-inner)' }),
      s('path', { class: 't21t-head-rib', d: ribs }),
      s('path', { class: 't21t-head-cap', d: `M${hx - 13} ${hy - 33}h26l-2 5h-22zM${hx - 12} ${hy + 28}h24l2 5h-28z` }),
      s('circle', { class: 't21t-lens', cx: hx + 10, cy: hy + 1, r: 3.6 }))
    // the key light: its pool on the stone (centred under the lantern, falling off toward the far edge)
    const poolX = lamp[0] + 70
    let weave = ''
    const [bx, by] = bk
    for (let i = 0; i < 4; i++) weave += stroke([[bx - 22 + i * 0.6, by - 16 + i * 4.4], [bx + 18 - i * 0.6, by - 16 + i * 4.4]], 1.2, 0.1, 0.1, 0.4)
    for (let i = 0; i < 8; i++) weave += stroke([[bx - 20 + i * 5.4, by - 18], [bx - 19 + i * 4.8, by + 1]], 1, 0.1, 0.1, 0.4)
    const [tx0, ty0] = tb
    set.replaceChildren(
      s('defs', null,
        grad('t21t-top', [0, 0, 0, 1], [[0, '--rock-mid', 1], [0.5, '--rock-hi', 1], [1, '--rock-mid', 1]]),
        grad('t21t-front', [0, 0, 0, 1], [[0, '--rock-lo', 1], [0.6, '--umbra', 0.9]]),
        grad('t21t-cel', [0, 0, 1, 0.25], [[0, '--t21-cel-hi', 1], [0.42, '--t21-cel', 1], [1, '--t21-cel-lo', 1]]),
        grad('t21t-celsh', [0, 0, 1, 0], [[0, '--lantern', 0.28], [0.35, '--lantern', 0], [0.7, '--umbra', 0], [1, '--umbra', 0.38]]),
        grad('t21t-clay', [0, 0, 1, 0.5], [[0, '--t21-clay-hi', 1], [0.5, '--t21-clay', 1], [1, '--umbra', 1]]),
        grad('t21t-bamboo', [0, 0, 1, 0], [[0, '--t21-bam-hi', 1], [0.45, '--t21-bam', 1], [1, '--umbra', 0.9]]),
        grad('t21t-armg', [0, 0, 0, 1], [[0, '--t21-ink-hi', 1], [0.35, '--t21-ink', 1], [0.8, '--t21-ink', 1], [1, '--umbra', 1]]),
        s('radialGradient', { id: 't21t-halo' }, stop(0, '--lantern', 0.5), stop(0.5, '--lantern', 0.14), stop(1, '--lantern', 0)),
        s('radialGradient', { id: 't21t-inner', cx: 0.45, cy: 0.45 }, stop(0, '--moon', 1), stop(0.5, '--lantern', 0.9), stop(1, '--lantern', 0)),
        s('radialGradient', { id: 't21t-soft' }, stop(0, '--umbra', 0.55), stop(0.55, '--umbra', 0.22), stop(1, '--umbra', 0)),
        s('radialGradient', { id: 't21t-pool', cx: 0.5, cy: 0.5, r: 0.5 }, stop(0, '--lantern', 0.5), stop(0.45, '--lantern', 0.16), stop(1, '--lantern', 0)),
        s('radialGradient', { id: 't21t-key', cx: 0.5, cy: 0.5, r: 0.5 }, stop(0, '--lantern', 0.4), stop(0.35, '--lantern', 0.12), stop(1, '--lantern', 0))),
      // the stone top and its front edge
      s('path', { class: 't21t-stone', d: top, fill: 'url(#t21t-top)' }),
      s('ellipse', { cx: poolX, cy: (TOP + EDGE) / 2 + 6, rx: 330, ry: 64, fill: 'url(#t21t-pool)' }),
      s('path', { class: 't21t-vein', d: veins }),
      s('path', { class: 't21t-grit', d: grit }),
      s('path', { class: 't21t-farline', d: stroke([[XL + 30, TOP], [DW / 2, TOP - 0.5], [XR - 24, TOP]], 1.4, 0.05, 0.05, 0.5) }),
      s('path', { class: 't21t-stone', d: front, fill: 'url(#t21t-front)' }),
      s('path', { class: 't21t-rimlight', d: stroke([[XL + 6, EDGE - 0.6], [poolX, EDGE - 1], [XR - 10, EDGE - 0.6]], 1.4, 0.05, 0.5, 0.15) }),
      s('path', { class: 't21t-chip', d: chips }),
      // the basket of hand data: three paper rolls in a little bamboo basket, its shadow right
      s('ellipse', { class: 't21t-sh', cx: bx + 40, cy: by + 1, rx: 44, ry: 6, fill: 'url(#t21t-soft)' }),
      s('path', { class: 't21t-roll', d: `M${bx - 14} ${by - 16}l4 -18h7l-3 18zM${bx - 4} ${by - 16}l2 -22h7l-1 22zM${bx + 6} ${by - 16}l5 -16h7l-5 16z` }),
      s('path', { class: 't21t-basket', d: `M${bx - 24} ${by - 17}h46l-6 18h-34z` }),
      s('path', { class: 't21t-weave', d: weave }),
      // the tube the slips stand in
      s('ellipse', { class: 't21t-sh', cx: tx0 + 58, cy: ty0 + 1, rx: 64, ry: 8, fill: 'url(#t21t-soft)' }),
      s('path', { class: 't21t-tubebody', d: `M${tx0 - 22} ${ty0 - 74}h44v72q-22 7 -44 0z`, fill: 'url(#t21t-bamboo)' }),
      s('ellipse', { class: 't21t-bamboo-top', cx: tx0, cy: ty0 - 74, rx: 22, ry: 6 }),
      s('path', { class: 't21t-ink', d: stroke([[tx0 - 22, ty0 - 40], [tx0, ty0 - 38], [tx0 + 22, ty0 - 40]], 1.8, 0.1, 0.1, 0.4) + stroke([[tx0 - 22, ty0 - 72], [tx0 - 22, ty0 - 2]], 1.4, 0.1, 0.1, 0.4) }),
      pot,
      ghost,
      cup,
      streamP,
      drops,
      armShadow,
      head,
      echo,
      arm,
      // the key: a paper lantern on a long cord from above the frame, its glow lighting the air round it
      s('circle', { cx: lamp[0], cy: lamp[1] + 40, r: 150, fill: 'url(#t21t-key)' }),
      paperLantern(lamp[0], lamp[1] - 420, 24, 2131, 420))
    echo.replaceChildren(s('use', { href: '#t21t-armref' }))
    arm.setAttribute('id', 't21t-armref')
    REST = [cx + 70, cy - 120]
  }
  function stop(o: number, v: string, a = 1) {
    return s('stop', { offset: o, style: `stop-color:var(${v});stop-opacity:${a}` })
  }
  function grad(id: string, [x1, y1, x2, y2]: number[], stops: [number, string, number][]) {
    return s('linearGradient', { id, x1, y1, x2, y2 }, ...stops.map(([o, v, a]) => stop(o, v, a)))
  }

  // ── motion: one state, eased toward each command's keyframes (positions relative to the cup and the pot)
  const st = { tx: 0, ty: 0, hand: 0.6, grip: 0, cx: 0, cy: 0, cs: 1, cr: 0, px: 0, py: 0, pr: 0, slosh: 0, pour: 0, ghost: 0, fill: 0, jx: 0, jy: 0 }
  const from = { ...st }
  let cmd = -1, tau = 0, dur = 0, pullT = 0, pullV = 0, ready = false, time = 0, wasClosed = true
  const DUR = [4.6, 4.4, 3.8]
  const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))
  const seg = (t: number, a: number, b: number) => ease((t - a) / (b - a))
  const L = (a: number, b: number, k: number) => a + (b - a) * k

  const KEYS = Object.keys(st) as (keyof typeof st)[]
  function target(i: number, t: number, o: typeof st) {
    const [cx, cy] = lay.cup, [px, py] = lay.pot
    o.tx = REST[0]; o.ty = REST[1]; o.hand = 0.6; o.grip = 0; o.cx = 0; o.cy = 0; o.cs = 1; o.cr = 0; o.px = 0; o.py = 0; o.pr = 0
    o.slosh = 0; o.pour = 0; o.ghost = 0; o.fill = 0; o.jx = 0; o.jy = 0
    if (i < 0) return
    if (i === 0) {
      // reach, overshoot into the cup (it tips, slides, the ghost shows the spill), back off, grip, lift
      const a = seg(t, 0, 1.0), b = seg(t, 1.0, 1.35), c = seg(t, 1.35, 2.0), d = seg(t, 2.0, 3.0), e = seg(t, 3.0, 3.8)
      o.tx = L(L(L(REST[0], cx + 20, a), cx + 6, b), cx + 70, c)
      o.ty = L(L(L(REST[1], cy - 40, a), cy - 36, b), cy - 58, c)
      o.tx = L(o.tx, cx + 50, d)
      o.ty = L(o.ty, cy - 26, d) - 32 * e
      o.jx = tremor(t, 7 * (1 - d * 0.6)); o.jy = tremor(t, 5 * (1 - d * 0.6), 1.3)
      o.cr = -16 * b * (1 - c) + (c > 0 && c < 1 ? 5 * Math.sin(c * 9) * (1 - c) : 0)
      o.cx = -12 * b
      o.cy = -32 * e + tremor(t, 2 * e, 0.8)
      o.slosh = b * (1 - c) + 0.4 * Math.sin(t * 9) * Math.exp(-Math.max(0, t - 1.35) * 2) * (t > 1 ? 1 : 0)
      o.ghost = seg(t, 1.05, 1.3) * (1 - seg(t, 2.2, 2.9))
      o.grip = seg(t, 2.8, 3.0)
      o.hand = L(0.6, 1.3, a)
    } else if (i === 1) {
      // to the teapot's knob, lift it over the cup, tip it: a trembling stream, a few drops missing the cup
      const a = seg(t, 0, 1.0), b = seg(t, 1.0, 1.8), c = seg(t, 1.8, 2.4)
      o.px = (cx - px - 92) * b; o.py = -70 * b; o.pr = 32 * c
      o.tx = L(REST[0], px + o.px + 8, a); o.ty = L(REST[1], py - 66 + o.py - 10, a)
      if (b > 0) (o.tx = px + o.px + 8), (o.ty = py - 76 + o.py)
      o.jx = tremor(t, 6); o.jy = tremor(t, 4, 1.2)
      o.grip = seg(t, 0.85, 1.0)
      o.hand = L(0.6, 1.6, a)
      o.pour = seg(t, 2.1, 2.5)
      o.fill = seg(t, 2.3, 4.2)
    } else {
      // grip the cup and bring it to us: it grows, trembling, until it is held out at the foot of the frame
      const a = seg(t, 0, 1.0), b = seg(t, 1.0, 3.2)
      o.tx = L(REST[0], cx + 50, a); o.ty = L(REST[1], cy - 26, a)
      o.cx = -30 * b; o.cy = 34 * b; o.cs = 1 + 0.42 * b
      o.tx += o.cx + 50 * (o.cs - 1); o.ty += o.cy - 20 * (o.cs - 1)
      o.jx = tremor(t, 5); o.jy = tremor(t, 3.6, 1.3)
      o.cy += tremor(t, 2.6 * b, 0.9)
      o.grip = seg(t, 0.8, 1.0)
      o.hand = L(0.6, 1.3, a)
    }
  }
  // the hand's tremor: two incommensurate sines (none when the scene is still)
  const tremor = (t: number, a: number, f = 1) => (still ? 0 : a * (Math.sin(t * 31 * f) * 0.6 + Math.sin(t * 17.3 * f + 1) * 0.4))
  const tgt = { ...st }
  function step() {
    target(cmd, tau, tgt)
    const k = still || cmd < 0 || tau >= 0.7 ? 1 : ease(tau / 0.7)
    for (let n = 0; n < KEYS.length; n++) st[KEYS[n]] = L(from[KEYS[n]], tgt[KEYS[n]], k)
    apply()
  }

  // write the pose: three rotations, the cup / pot / tea transforms, the stream
  function apply() {
    const [cx0, cy0] = lay.cup, [px0, py0] = lay.pot
    const hx = st.tx + st.jx, hy = st.ty + st.jy
    // two-bone IK, elbow down and out (the arm comes down from the robot's shoulder above the frame's right edge)
    const dx = hx - SH[0], dy = hy - SH[1]
    const d = clamp(Math.hypot(dx, dy), Math.abs(L1 - L2) + 1, L1 + L2 - 1)
    const th = Math.atan2(dy, dx)
    const al = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1))
    const a1 = th - al
    const ex = SH[0] + L1 * Math.cos(a1), ey = SH[1] + L1 * Math.sin(a1)
    const b = Math.atan2(hy - ey, hx - ex)
    const deg = 180 / Math.PI
    gUpper.setAttribute('transform', `translate(${SH[0]} ${SH[1]}) rotate(${f1(a1 * deg)})`)
    gFore.setAttribute('transform', `translate(${L1} 0) rotate(${f1((b - a1) * deg)})`)
    gHand.setAttribute('transform', `translate(${L2} 0) rotate(${f1(st.hand * deg * 0.5)})`)
    const closed = st.grip > 0.5
    if (closed !== wasClosed) (wasClosed = closed), fingers.setAttribute('d', closed ? FINGERS_SHUT : FINGERS_OPEN)
    // the hand's shadow on the stone: right of it (the lantern is up left), softer and wider the higher the hand
    const lift = clamp((cy0 - hy) / 160, 0, 1)
    armShadow.setAttribute('cx', f1(hx + 50 + 40 * lift))
    armShadow.setAttribute('cy', f1(cy0 - 4))
    armShadow.setAttribute('rx', f1(46 + 50 * lift))
    armShadow.setAttribute('opacity', f1(0.85 - 0.55 * lift))
    // the tremor seen: a faint second arm where the hand just was
    if (!still) {
      echo.setAttribute('transform', `translate(${f1(-st.jx * 1.4)} ${f1(-st.jy * 1.4)})`)
      echo.style.opacity = f1(clamp(Math.hypot(st.jx, st.jy) / 9, 0, 0.32))
    }
    cup.setAttribute('transform', `translate(${f1(st.cx)} ${f1(st.cy)}) rotate(${f1(st.cr)} ${cx0 - 46} ${cy0}) translate(${cx0} ${cy0 - 24}) scale(${st.cs.toFixed(3)}) translate(${-cx0} ${-(cy0 - 24)})`)
    tea.setAttribute('transform', `translate(${f1(-st.slosh * 3)} ${f1(-st.fill * 1.6)}) rotate(${f1(st.slosh * 8)} ${cx0} ${cy0 - 46}) translate(${cx0} ${cy0 - 46}) scale(${(1 + st.slosh * 0.08 + st.fill * 0.04).toFixed(3)} ${(1 + st.slosh * 0.5).toFixed(3)}) translate(${-cx0} ${-(cy0 - 46)})`)
    pot.setAttribute('transform', `translate(${f1(st.px)} ${f1(st.py)}) rotate(${f1(st.pr)} ${px0} ${py0 - 30})`)
    ghost.style.opacity = f1(st.ghost * 0.9)
    // the stream: from the spout tip (rotated with the pot) down into the cup, wavering
    if (st.pour > 0.02) {
      const a = (st.pr * Math.PI) / 180
      const sx0 = 68, sy0 = -32 // the spout tip from the pivot
      const spx = px0 + st.px + sx0 * Math.cos(a) - sy0 * Math.sin(a), spy = py0 - 30 + st.py + sx0 * Math.sin(a) + sy0 * Math.cos(a)
      const w = still ? 0 : Math.sin(time * 23) * 2.4 + Math.sin(time * 37) * 1.2
      const ex2 = cx0 + st.cx + w * 1.4, ey2 = cy0 - 46 + st.cy
      streamP.setAttribute('d', `M${f1(spx)} ${f1(spy)}Q${f1(spx + 10 + w)} ${f1((spy + ey2) / 2)} ${f1(ex2)} ${f1(ey2)}`)
      streamP.style.strokeWidth = f1(3.6 * st.pour)
      drops.setAttribute('d', st.fill > 0.2 ? blob(cx0 + 40, cy0 - 2, 7, 1.8, 4, 0.3) + blob(cx0 + 54, cy0 + 2, 3.4, 1.1, 5, 0.3) + blob(cx0 + 28, cy0 - 1, 2.2, 0.9, 6, 0.3) : '')
    } else {
      streamP.setAttribute('d', '')
      drops.setAttribute('d', '')
    }
  }

  const loop = createLoop(root, (_t, dt) => {
    if (!ready) return false
    time += dt
    if (cmd >= 0 && tau < dur) {
      tau = still ? dur : tau + dt
      step()
    }
    pullV += (pullT - pullV) * (dt > 0 ? 1 - Math.exp(-dt * 6) : 1)
    if (still) pullV = pullT
    placePull()
    return (cmd >= 0 && tau < dur) || Math.abs(pullT - pullV) > 0.002
  })
  ctx.onCleanup(() => loop.dispose())

  let given = 0
  let lineTimer = 0, promptTimer = 0
  ctx.onCleanup(() => (clearTimeout(lineTimer), clearTimeout(promptTimer)))
  function command(i: number) {
    Object.assign(from, st)
    cmd = i
    tau = 0
    dur = DUR[i]
    slips.forEach((b, k) => b.classList.toggle('out', k === i))
    root.classList.add('lit')
    said.textContent = T.commands[i].label
    status.classList.remove('hand')
    status.classList.add('head')
    void status.offsetWidth
    status.classList.add('on')
    if (!status.hasAttribute('aria-live')) status.setAttribute('aria-live', 'polite') // after the first fill
    clearTimeout(lineTimer)
    lineTimer = window.setTimeout(() => status.classList.add('hand'), still ? 0 : 1150)
    ctx.chime('tap')
    given |= 1 << i
    if (given === 1 << i && !root.classList.contains('told')) {
      root.classList.add('told')
      ctx.insight(T.insight as Fact)
      promptTimer = window.setTimeout(() => {
        ctx.prompt(T.pullPrompt)
        weightDot ??= gd.dot(pull, { dir: [0, 1] }) // H1 on the weight at the end of the lantern's cord
      }, still ? 0 : 1400)
    }
    if (still) {
      tau = dur
      step()
      loop.wake()
    } else loop.start()
  }

  // ── pulling back: the set shrinks to the lower right, the mountain layers come down out of the sky
  let W = 0, H = 0, port = false, k0 = 1, x0 = 0, y0 = 0, said2 = false, gut = 0
  const LAYER_UP = [0.14, 0.32, 0.62, 1.1] // how far above its final place each layer starts (× H)
  function placePull() {
    const p = pullV
    const sc = 1 - (port ? 0.5 : 0.58) * p
    // the cup drifts to a fixed place in the frame (low right on wide screens, low centre on phones) as the set shrinks
    const [ccx, ccy] = lay.cup
    const tx = x0 + (W * (port ? 0.52 : 0.5) - ccx * k0 * sc - x0) * p, ty = y0 + (H * (port ? 0.66 : 0.8) - ccy * k0 * sc - y0) * p
    setBox.style.transform = `translate(${f1(tx)}px, ${f1(ty)}px) scale(${(k0 * sc).toFixed(4)})`
    layers.forEach((l, i) => {
      l.style.transform = `translate3d(0, ${f1(-LAYER_UP[i] * H * (1 - p))}px, 0)`
      // at rest two farther tiers already show faintly above the first, through the mist
      l.style.opacity = String(i === 0 ? 0.8 + 0.2 * p : clamp((i < 3 ? 0.5 - i * 0.2 : 0) + p * 1.6 - i * 0.18, 0, 1))
    })
    // the cord hangs from the lantern, wherever the set has gone; drawing it down lengthens it
    const ks = k0 * sc, lx = tx + lay.lamp[0] * ks, ly = ty + (lay.lamp[1] + 24 * 1.25 * 2 + 4) * ks
    pull.style.transform = `translate(${f1(lx)}px, ${f1(Math.max(ly, 8))}px)`
    root.style.setProperty('--pull', p.toFixed(3))
    root.classList.toggle('back', p > 0.55)
    if (p > 0.82 && !said2) {
      said2 = true
      weightDot?.done()
      dataL.removeAttribute('aria-hidden')
      dataR.removeAttribute('aria-hidden')
      ctx.insight(T.insight2 as Fact, T.detail)
    }
  }
  const setPull = (v: number) => {
    pullT = clamp(v, 0, 1)
    const n = Math.round(pullT * 100)
    pull.setAttribute('aria-valuenow', String(n))
    pull.setAttribute('aria-valuetext', fill(T.pullValue, { n }))
    if (still) loop.wake()
    else loop.start()
  }
  let drag: { id: number; y: number; v: number } | null = null
  root.addEventListener('pointerdown', (e) => {
    if (e.button || (e.target as Element).closest('button, .t21t-data, .t21t-status')) return
    drag = { id: e.pointerId, y: e.clientY, v: pullT }
    root.setPointerCapture(e.pointerId)
    root.classList.add('grab')
  })
  root.addEventListener('pointermove', (e) => drag && e.pointerId === drag.id && setPull(drag.v + (e.clientY - drag.y) / Math.max(160, H * 0.5)))
  const end = () => {
    drag = null
    root.classList.remove('grab')
  }
  root.addEventListener('pointerup', end)
  root.addEventListener('pointercancel', end)
  pull.addEventListener('keydown', (e) => {
    const k = ({ ArrowDown: 0.25, ArrowRight: 0.25, ArrowUp: -0.25, ArrowLeft: -0.25 } as Record<string, number>)[e.key]
    const to = k != null ? pullT + k : e.key === 'Home' ? 0 : e.key === 'End' ? 1 : NaN
    if (Number.isNaN(to)) return
    e.preventDefault()
    setPull(to)
  })

  // ── layout: fit the set, paint the four mountain layers, place the slips and the lines
  function* paintFar() {
    for (let i = 0; i < 4; i++) {
      const l = layers[i]
      l.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
      const cxm = W * (port ? 0.4 : 0.34), base = H * [0.7, 0.5, 0.34, 0.2][i]
      const hw = W * (port ? [0.72, 0.46, 0.32, 0.2] : [0.46, 0.3, 0.2, 0.12])[i], hh = H * [0.48, 0.32, 0.25, 0.2][i]
      const row = Math.max(10, H * (port ? 0.05 : 0.07) * (1 - i * 0.18))
      l.replaceChildren(
        ...(i === 3 ? [moonArt(W * (port ? 0.8 : 0.72), H * 0.1, Math.min(W, H) * 0.035, 2132, true)] : []),
        wash(blob(cxm, base - hh * 0.42, hw * 1.08, hh * 0.64, 2140 + i, 0.14), 0.08 + i * 0.02),
        ...books(cxm - hw, cxm + hw, base, hh, 2141 + i * 7, row),
        // mist rising round the tiers: the foot of each layer and a band across its upper slopes
        mist(cxm, base, hw * 1.6, hh * 0.3),
        mist(cxm + hw * 0.5, base - hh * 0.6, hw * 1.3, hh * 0.16),
        mist(cxm - hw * 0.7, base - hh * 0.3, hw * 0.9, hh * 0.14))
      yield
    }
  }
  let job: { cancel(): void } | null = null
  let first = true, painted = ''
  function layout() {
    const aw = ctx.art.clientWidth, w = root.clientWidth || aw, hh = stableH(ctx.art.clientHeight)
    if (aw < 60 || hh < 60) return
    root.style.height = `${f1(hh)}px`
    W = w
    H = hh
    gut = (w - aw) / 2
    port = H > aw * 1.05
    root.classList.toggle('port', port)
    lay = port ? TALL : WIDE
    SH = lay.sh
    // the set: wide screens see the whole box across the full width; phones a 380-wide window round the cup; the
    // table's front edge sits on the foot of the frame
    k0 = port ? W / 320 : Math.max(W / DW, H / 290)
    x0 = port ? W / 2 - 372 * k0 : (W - DW * k0) / 2
    y0 = H - (port ? DH - 6 : DH) * k0
    setBox.style.width = `${DW}px`
    setBox.style.height = `${DH}px`
    if (painted !== (port ? 'p' : 'w')) {
      painted = port ? 'p' : 'w'
      paintSet()
      if (cmd < 0) target(-1, 0, st)
      else target(cmd, tau, st)
      Object.assign(from, st)
      apply()
    }
    // DOM pieces on the set, in stage px (the set is scaled, text is not)
    const at = (x: number, y: number) => [x0 + x * k0, y0 + y * k0]
    const [tx, ty] = at(lay.tube[0], lay.tube[1] - 74)
    tube.style.transform = `translate(${f1(tx)}px, ${f1(ty)}px)`
    tube.style.setProperty('--k', clamp(k0 / 2.2, 0.62, 1).toFixed(3))
    Object.assign(status.style, port
      ? { left: `${f1(gut)}px`, right: `${f1(gut)}px`, top: '0px' }
      : { left: 'auto', right: `${f1(W - at(lay.head[0] - 46, 0)[0])}px`, top: `${f1(Math.max(8, at(0, lay.head[1] - 30)[1]))}px` })
    root.style.setProperty('--gut', `${f1(gut)}px`)
    job?.cancel()
    job = sliced(paintFar(), { sync: ctx.reduced || !first })
    first = false
    placePull()
  }

  ctx.onCleanup(onSize(ctx.art, layout))
  ctx.onCleanup(() => job?.cancel())
  // the set is painted once per orientation (its colours are tokens), then the arm comes to rest
  const setJob = sliced((function* () {
    yield
    ready = true
    root.classList.add('ready')
  })(), { sync: ctx.reduced })
  ctx.onCleanup(setJob.cancel)
}
