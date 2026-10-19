import './frame.css'
import { fill, h, nextId, s } from '../../core/dom'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import { onPrefs } from '../../core/prefs'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { clamp, curve, onSize, p2Defs, rng, stableHeight, stroke, type Pt } from '../../ui/part2/ink'
import { pine } from '../../ui/part2/paint'
import { C } from './data'
import { figure } from './brush'
import { guide } from '../../ui/part2/guide'

const G = C.scenes.moat
/** the disc leans back this far (deg): we look down on it from about 60° — harder on a tall frame so it never reads flat */
const VIEWS = [32, 50]
/** where each boat waits on the far lake (degrees, 0 = east, y down = toward the viewer): wide frame, tall frame (9, 3, 6 o'clock) */
const ANGS = [[200, 340, 124], [180, 0, 90]]
const N_BRIDGE = 18 // few enough to count (audit v3 28-3)
// rings as shares of the disc's radius: island · moat · village bank · lake
const ISLE = 0.2, MOAT = 0.36, BANK = 0.5
const CUTS = 5 // the bridges that tie the house to the castle
const WALL = 0.036 // the island's retaining wall: the inner wall of the moat, where the bridges land and the CUDA words run
const f1 = (n: number) => n.toFixed(1)
const P = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`
const rad = (d: number) => (d * Math.PI) / 180

/** A curved castle roof centred on xc with its eave line at y: upturned tips, a concave slope up to the ridge. */
function roof(xc: number, y: number, hw: number, rh: number) {
  return `M${P([xc - hw * 1.3, y - rh * 0.22])}Q${P([xc - hw * 1.08, y + rh * 0.14])} ${P([xc - hw * 0.86, y + rh * 0.08])}L${P([xc + hw * 0.86, y + rh * 0.08])}Q${P([xc + hw * 1.08, y + rh * 0.14])} ${P([xc + hw * 1.3, y - rh * 0.22])}Q${P([xc + hw * 0.78, y - rh * 0.22])} ${P([xc + hw * 0.5, y - rh])}L${P([xc - hw * 0.5, y - rh])}Q${P([xc - hw * 0.78, y - rh * 0.22])} ${P([xc - hw * 1.3, y - rh * 0.22])}Z`
}

/** The keep standing on (0, 0), bw wide: a battered stone base in courses, three plastered tiers under curved roofs, lit windows. */
function castle(bw: number, seed: number): SVGElement[] {
  const r = rng(seed)
  const hb = bw * 0.26, b0 = bw / 2, b1 = bw * 0.39
  const base = `M${P([-b0, 0])}Q${P([-b1 - bw * 0.01, -hb * 0.3])} ${P([-b1, -hb])}L${P([b1, -hb])}Q${P([b1 + bw * 0.01, -hb * 0.3])} ${P([b0, 0])}Z`
  let courses = ''
  for (let k = 1; k < 5; k++) {
    const y = -(hb * k) / 5
    const half = b0 - (b0 - b1) * Math.pow(k / 5, 0.6)
    for (let x = -half + 2; x < half - 6; ) {
      const len = bw * (0.05 + r() * 0.09)
      courses += stroke([[x, y + (r() - 0.5)], [Math.min(x + len, half - 2), y + (r() - 0.5)]], Math.max(0.8, bw * 0.008), 0.2, 0.2, 0.3)
      x += len + bw * 0.015
    }
  }
  let walls = '', roofs = '', lit = '', dark = '', rims = '', shade = ''
  let y = -hb, hw = bw * 0.35
  const tiers: [number, number, number][] = []
  for (let i = 0; i < 3; i++) (tiers.push([hw, bw * (0.17 - i * 0.02), bw * (0.11 - i * 0.012)]), (hw *= 0.7))
  tiers.forEach(([w2, wh, rh], i) => {
    walls += `M${P([-w2, y])}L${P([w2, y])}L${P([w2 * 0.97, y - wh])}L${P([-w2 * 0.97, y - wh])}Z`
    shade += `M${P([w2 * 0.35, y])}L${P([w2, y])}L${P([w2 * 0.97, y - wh])}L${P([w2 * 0.34, y - wh])}Z`
    const nWin = 4 - i
    for (let k = 0; k < nWin; k++) {
      const x = -w2 * 0.7 + (w2 * 1.4 * (k + 0.5)) / nWin
      const ww = Math.max(2, bw * 0.03), wy = y - wh * 0.62
      const d = `M${f1(x - ww / 2)} ${f1(wy)}h${f1(ww)}v${f1(wh * 0.3)}h${f1(-ww)}Z`
      if (r() < 0.6) lit += d
      else dark += d
    }
    y -= wh
    roofs += roof(0, y, w2, rh)
    rims += stroke(curve([w2 * 1.28, y - rh * 0.24], [w2 * 0.9, y - rh * 0.18], [w2 * 0.52, y - rh * 0.95], 8), Math.max(1, bw * 0.012), 0.2, 0.4, 0.2)
    y -= rh * 0.82
  })
  const top = y + tiers[2][2] * 0.82 - tiers[2][2]
  const fin = (sx: number) => stroke(curve([sx * tiers[2][0] * 0.48, top], [sx * tiers[2][0] * 0.62, top - bw * 0.05], [sx * tiers[2][0] * 0.4, top - bw * 0.06], 6), Math.max(1.4, bw * 0.016), 0.1, 0.5, 0.3)
  return [
    s('ellipse', { class: 't28m-keep-sh', cx: f1(bw * 0.3), cy: 2, rx: f1(bw * 0.75), ry: f1(bw * 0.12) }),
    s('circle', { cx: 0, cy: f1(-hb - bw * 0.25), r: f1(bw * 0.62), fill: 'url(#p2-lamp)', class: 't28m-keep-glow' }),
    s('path', { class: 'gb-stone', d: base, filter: 'url(#ink-rough)' }),
    s('path', { class: 'gb-stone-sh', d: base }),
    s('path', { class: 't28m-course', d: courses }),
    s('path', { class: 'gb-plaster', d: walls, filter: 'url(#ink-rough)' }),
    s('path', { class: 't28m-wallsh', d: shade }),
    s('path', { class: 't28m-win', d: dark }),
    s('path', { class: 't28m-lit', d: lit }),
    s('path', { class: 't28m-roof', d: roofs + fin(-1) + fin(1), filter: 'url(#ink-rough)' }),
    s('path', { class: 't28m-rim', d: rims }),
  ]
}

/** A sampan with a rower at the stern and its own paper lantern at the bow: round, tall or square (no brand colours). */
function boatArt(seed: number, kind: number): SVGSVGElement {
  const r = rng(seed)
  let wake = ''
  for (let i = 0; i < 4; i++) {
    const y = 9 + i * 3.2, x = -36 + r() * 10
    wake += stroke([[x, y], [x + 18 + r() * 16, y + 0.4]], 1.2 + i * 0.2, 0.3, 0.3, 0.1)
  }
  const hid = nextId('t28m-hl')
  const rower = figure(-17, 0, 25, seed, 1, { hat: 'cone', stoop: 0.3 })
  const hull = 'M-36 -3Q-6 7 30 -8Q33 -9 34 -7L29 2Q0 13 -31 5Z'
  const lamp = kind === 0 ? s('ellipse', { class: 't28m-lamp', cx: 28, cy: -24.5, rx: 5, ry: 5.4 })
    : kind === 1 ? s('rect', { class: 't28m-lamp', x: 24.6, y: -31, width: 6.8, height: 13, rx: 3.2 })
      : s('rect', { class: 't28m-lamp', x: 23.5, y: -29.5, width: 9, height: 9, rx: 1 })
  return s('svg', { viewBox: '-42 -46 84 62', 'aria-hidden': 'true' },
    s('defs', null, s('radialGradient', { id: hid, cx: 27, cy: -8, r: 30, gradientUnits: 'userSpaceOnUse' },
      s('stop', { offset: 0, style: 'stop-color:var(--lantern);stop-opacity:.9' }),
      s('stop', { offset: 0.5, style: 'stop-color:var(--lantern);stop-opacity:.35' }),
      s('stop', { offset: 1, style: 'stop-color:var(--lantern);stop-opacity:0' }))),
    s('circle', { class: 't28m-bglow', cx: 28, cy: -25, r: 20, fill: 'url(#p2-lamp)' }),
    s('path', { class: 't28m-wake', d: wake }),
    s('path', { class: 't28m-lampref', d: stroke([[27, 5], [28.5, 9], [27.5, 13]], 2.6, 0.2, 0.5, 0.3) }),
    s('path', { class: 't28m-figrim', d: rower, transform: 'translate(0.9 -0.5)' }),
    s('path', { class: 'gb-figure', d: rower }),
    s('path', { class: 'gb-figure', d: stroke([[-10, -14], [-22, -2], [-33, 10]], 1.8, 0.1, 0.1, 0.5) }),
    s('path', { class: 't28m-hull', d: hull }),
    s('path', { class: 't28m-hull-lit', d: hull, fill: `url(#${hid})` }),
    s('path', { class: 'gb-rim-hi', d: stroke([[-34, -3], [-6, 5], [30, -7]], 1.3, 0.2, 0.3, 0.1) }),
    s('path', { class: 'gb-figure', d: stroke(curve([22, -2], [21, -30], [28, -36], 8), 1.6, 0.05, 0.2, 0.4) }),
    s('path', { class: 'gb-rope', d: 'M28 -36V-31' }),
    lamp)
}

/** A village house (one AI team) seen a little from above: plastered walls, a hipped roof catching the moon, a lit window. */
function houseArt(): SVGSVGElement {
  return s('svg', { viewBox: '-32 -36 64 50', 'aria-hidden': 'true' },
    s('circle', { class: 't28m-hglow', cx: 0, cy: -6, r: 26, fill: 'url(#p2-lamp)' }),
    s('ellipse', { class: 't28m-keep-sh', cx: 4, cy: 9, rx: 26, ry: 5 }),
    s('path', { class: 'gb-plaster', d: 'M-19 9L-19 -8L19 -8L19 9Z' }),
    s('path', { class: 't28m-wallsh', d: 'M6 9L6 -8L19 -8L19 9Z' }),
    s('path', { class: 't28m-lit', d: 'M-12 -3h7v7h-7Z' }),
    s('path', { class: 't28m-win', d: 'M3 -3h6v7h-6Z' }),
    s('path', { class: 't28m-roof', d: 'M-27 -6Q-24 -4 -20 -5L20 -5Q24 -4 27 -6L15 -22L-15 -22Z' }),
    s('path', { class: 't28m-rim', d: stroke([[-15, -22], [0, -23], [15, -22]], 1.6, 0.2, 0.2, 0.2) }))
}

/**
 * Hào nước quanh lâu đài (art direction §4 t28 `moat`, canvas; audit v3 28-3, reworked): a castle island in a black lake
 * as a mandala seen from high above, baked once into a round disc. NVIDIA's keep sits on the island; countable bamboo
 * bridges cross the moat to the village. One village house (an AI team) is tied to the castle by five bridges: drag it
 * toward a rival's boat and they pull taut and snap it back; tap each bridge to cut it (rewriting the code), then the
 * house can be carried onto the boat. CUDA is the moat: the bridges are the code already written for it.
 */
export function moatScene(ctx: SceneCtx) {
  p2Defs()
  const low = ctx.quality === 'low'
  const stableH = stableHeight(ctx, [G.insight as Fact])
  const g = guide(ctx)
  const step = g.steps(G.prompts)
  step(0)

  const cv = h('canvas', { class: 't28m-cv', 'aria-hidden': 'true' })
  const dots = low ? null : h('canvas', { class: 't28m-dots', 'aria-hidden': 'true' })
  const ring = s('svg', { class: 't28m-ring', 'aria-hidden': 'true' }) // in the disc's plane: the keep's name
  const keep = h('div', { class: 't28m-keep', 'aria-hidden': 'true' })
  const boats = G.boats.map((_, i) => h('div', { class: 't28m-boat', 'aria-hidden': 'true' }, boatArt(2830 + i, i)))
  const disc = h('div', { class: 't28m-disc' }, cv, ring, ...(dots ? [dots] : []), keep, ...boats)
  const fleet = h('div', { class: 't28m-wrap', 'aria-hidden': 'true' }, disc)
  // the boats' names ride above them on paper halos, flat on the frame (inside the disc's 3D they were cut by its plane)
  const tags = G.boats.map((b) => h('span', { class: 't28m-tag', 'aria-hidden': 'true' }, b.name))
  // CUDA, carved straight under the castle (it was a ring of words round the moat: unreadable on a phone)
  const [cudaName, cudaWhat] = G.moatLabel.split(' · ')
  const cuda = h('p', { class: 't28m-cudalab' }, h('b', null, cudaName), cudaWhat ? h('span', null, cudaWhat) : null)
  // the rig, flat on the frame: five bridges from the castle wall to the house, the way to the boat, the cut words
  const rig = s('svg', { class: 't28m-rig', 'aria-hidden': 'true' })
  const arrow = s('path', { class: 't28m-arrow' })
  const bridges = Array.from({ length: CUTS }, () => s('g', { class: 't28m-br' }, s('path', { class: 't28m-br-sh' }), s('path', { class: 't28m-br-deck' }), s('path', { class: 't28m-br-rail' })))
  rig.append(arrow, ...bridges)
  const cuts = bridges.map((_, k) => h('button', { class: 't28m-cut', type: 'button', 'aria-label': fill(G.cutAria, { n: k + 1 }) }))
  const house = h('div', { class: 't28m-house', role: 'button', tabindex: '0', 'aria-label': G.houseAria }, houseArt())
  const root = h('div', { class: 't28m', role: 'group', 'aria-label': G.art }, h('div', { class: 't28m-lake', 'aria-hidden': 'true' }), h('div', { class: 't28m-sky', 'aria-hidden': 'true' }), fleet, ...tags, cuda, rig, house, ...cuts)
  ctx.art.append(root)

  let ANG = ANGS[0]
  let VIEW = VIEWS[0]
  let D = 0 // disc size (css px)
  let geo = { W: 1, H: 1, cx: 0, cy: 0, wide: true, persp: 1, bwp: 1, bh: 1 }
  const boatAt = (i: number, k: number): Pt => [D / 2 + Math.cos(rad(ANG[i])) * (D / 2) * k, D / 2 + Math.sin(rad(ANG[i])) * (D / 2) * k]
  const TARGET = 1 // the boat on the right is the one the arrow points at (any boat takes the house)

  // ── the house, its five bridges, the cuts
  let left = CUTS // bridges still tied
  const cut = new Set<number>()
  let home: Pt = [0, 0] // the house's foot on the frame (where its bridges tie on)
  let anchors: Pt[] = [] // where each bridge meets the castle wall
  let off: Pt = [0, 0] // the drag offset
  let docked = -1
  let hw = 56 // the house's width on screen
  let boatPts: Pt[] = []
  const dotHouse = g.dot(house, { dir: [1, -0.2] })
  let dotCut: ReturnType<typeof g.dot> | null = null
  let count: ReturnType<typeof g.count> | null = null
  let drop: ReturnType<typeof g.drop> | null = null

  /** a bridge from the castle wall over its pier post to the house (or, cut at the post, two stubs hanging off each end) */
  function drawBridges() {
    const hx = home[0] + off[0], hy = home[1] + off[1]
    bridges.forEach((b, k) => {
      const [ax, ay] = anchors[k], [px, py] = cutAt(k)
      let pts: Pt[][]
      if (cut.has(k)) pts = [[[ax, ay], [ax + (px - ax) * 0.6, ay + (py - ay) * 0.6 + 6]], [[hx, hy], [hx + (px - hx) * 0.45, hy + (py - hy) * 0.45 + 6]]]
      else {
        // slack hangs a little; taut it runs straight
        const sag = Math.hypot(off[0], off[1]) > 4 ? 0 : 4
        pts = [[...curve([ax, ay], [(ax + px) / 2, (ay + py) / 2 + sag], [px, py], 6), ...curve([px, py], [(px + hx) / 2, (py + hy) / 2 + sag], [hx, hy], 6).slice(1)]]
      }
      const [sh, deck, rail] = b.children
      sh.setAttribute('d', pts.map((p) => stroke(p.map(([x, y]) => [x + 3, y + 5] as Pt), 6, 0.1, 0.1, 0.4)).join(''))
      deck.setAttribute('d', pts.map((p) => stroke(p, 7, 0.1, 0.1, 0.4)).join(''))
      // the pier post the bridge rests on (it stays when the bridge is cut)
      rail.setAttribute('d', pts.map((p) => stroke(p.map(([x, y]) => [x, y - 3] as Pt), 1.4, 0.2, 0.2, 0.3)).join('') + stroke([[px, py - 9], [px + 0.5, py + 7]], 4, 0.1, 0.1, 0.5))
    })
    house.style.transform = `translate(${f1(hx - hw / 2)}px, ${f1(hy - hw * 0.72)}px)`
  }
  /**
   * each bridge rests on a pier post in the moat, the posts fanned round the house so their 44 px cut targets never
   * overlap (audit v3 28-3: vùng chạm ≥ 44 px), even on a phone where the moat is narrow
   */
  let cutPts: Pt[] = []
  const cutAt = (k: number): Pt => cutPts[k] ?? anchors[k]
  function placeCuts(centre: Pt) {
    const dx = centre[0] - home[0], dy = centre[1] - home[1]
    const rho = clamp(Math.hypot(dx, dy) * 0.55, 64, 150), base = Math.atan2(dy, dx), step = 52 / rho
    const posts = anchors.map((_, k): Pt => [home[0] + Math.cos(base + (k - 2) * step) * rho, home[1] + Math.sin(base + (k - 2) * step) * rho])
    // each bridge takes the post on its own side, so none cross (both fans sorted by their angle round the house)
    const turn = (p: Pt) => (Math.atan2(p[1] - home[1], p[0] - home[0]) - base + Math.PI * 3) % (Math.PI * 2)
    const order = anchors.map((_, k) => k).sort((a, b) => turn(anchors[a]) - turn(anchors[b]))
    cutPts = []
    order.forEach((k, j) => (cutPts[k] = posts[j]))
  }
  const nextCut = () => cuts.find((_, k) => !cut.has(k)) ?? null

  function snip(k: number) {
    if (cut.has(k) || docked >= 0) return
    cut.add(k)
    left--
    cuts[k].disabled = true
    bridges[k].classList.add('cut')
    count?.set(left)
    drawBridges()
    // the words float up off the cut
    const [x, y] = cutAt(k)
    const word = h('span', { class: 't28m-rewrite', 'aria-hidden': 'true', style: `left:${f1(x)}px;top:${f1(y)}px` }, G.rewrite)
    root.append(word)
    const t = window.setTimeout(() => word.remove(), ctx.reduced ? 1200 : 1600)
    ctx.onCleanup(() => clearTimeout(t))
    ctx.chime('soft')
    const nx = nextCut()
    if (nx) {
      if (!dotCut) dotCut = g.dot(nx)
      else dotCut.at(nx)
      if (document.activeElement === cuts[k]) nx.focus({ preventScroll: true })
      return
    }
    // all cut: now the house can go
    dotCut?.done()
    count?.done()
    root.classList.add('free')
    step(2)
    drop ??= g.drop(boats[TARGET])
    dotHouse.done()
    if (document.activeElement === cuts[k]) house.focus({ preventScroll: true })
  }
  cuts.forEach((b, k) => b.addEventListener('click', () => snip(k)))

  function dock(i: number) {
    docked = i
    const [bx, by] = boatPts[i]
    off = [bx - home[0], by - home[1]]
    root.classList.add('docked')
    house.setAttribute('aria-disabled', 'true')
    drawBridges()
    drop?.hit()
    g.ok(house)
    arrow.classList.add('out')
    ctx.chime('ok')
    ctx.insight(G.insight as Fact, G.detail as Fact[])
  }
  /** step 1 begins: the house was pulled and the bridges held it; show the counter and the first bridge to cut */
  function taut() {
    if (count) return
    step(1)
    count = g.count(G.countTpl, CUTS, () => {
      const [x, y] = project(D / 2, D / 2 + (D / 2) * (ISLE + WALL), 0)
      return [x, y + 16]
    }, { n: left })
    const nx = nextCut()
    if (nx) dotCut = g.dot(nx)
  }

  // drag the house: tied, it only stretches the bridges and springs back; free, it goes where it is carried
  let drag: { id: number; x: number; y: number } | null = null
  house.addEventListener('pointerdown', (e) => {
    if (e.button || docked >= 0) return
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY }
    house.setPointerCapture(e.pointerId)
    root.classList.add('is-drag')
    if (left === 0) drop?.lift(true)
  })
  house.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y
    if (left) {
      // the bridges give a little and no more
      const d = Math.hypot(dx, dy) || 1, k = 30 / (30 + d)
      off = [dx * k, dy * k]
      if (d > 16) root.classList.add('taut')
    } else off = [dx, dy]
    drawBridges()
  })
  const release = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return
    const pulled = Math.hypot(off[0], off[1]) > 8
    drag = null
    root.classList.remove('is-drag', 'taut')
    drop?.lift(false)
    if (left === 0) {
      const hx = home[0] + off[0], hy = home[1] + off[1]
      const near = boatPts.map(([x, y]) => Math.hypot(x - hx, y - hy))
      const i = near.indexOf(Math.min(...near))
      if (near[i] < Math.max(60, geo.bwp * 0.9)) return dock(i)
      g.wrong(G.prompts[2], house)
    } else if (pulled) taut()
    off = [0, 0]
    drawBridges()
  }
  house.addEventListener('pointerup', release)
  house.addEventListener('pointercancel', release)
  house.addEventListener('keydown', (e) => {
    if ((e.key !== 'Enter' && e.key !== ' ') || docked >= 0) return
    e.preventDefault()
    if (left) {
      taut()
      g.wrong(G.prompts[1], house)
      nextCut()?.focus({ preventScroll: true })
    } else dock(TARGET)
  })

  // H7: after 6 s still, the next bridge to cut shivers and flashes vermilion
  const invite = () => {
    const k = cuts.findIndex((_, j) => !cut.has(j))
    if (k < 0 || docked >= 0 || ctx.reduced) return
    bridges[k].classList.add('flash')
    const t = window.setTimeout(() => bridges[k].classList.remove('flash'), 1100)
    ctx.onCleanup(() => clearTimeout(t))
    bridges[k].animate([{ translate: '0 0' }, { translate: '0 -2px' }, { translate: '0 2px' }, { translate: '0 0' }], { duration: 500, iterations: 2 })
  }
  ctx.el.addEventListener('p2:idle', invite)
  ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', invite))

  /**
   * where a point of the disc lands on the frame (the same 3D the CSS draws): (x, y) in the disc's box, z up out of it.
   * The disc lies rotateX(VIEW) about its centre, seen through the wrap's perspective.
   */
  function project(x: number, y: number, z: number): Pt {
    const a = rad(VIEW)
    const X = x - D / 2
    let Y = y - D / 2, Z = z
    ;[Y, Z] = [Y * Math.cos(a) - Z * Math.sin(a), Y * Math.sin(a) + Z * Math.cos(a)]
    const vx = X + D / 2, vy = Y + D / 2
    const ox = D / 2, oy = D * 0.3, k = geo.persp / (geo.persp - Z)
    return [geo.cx - D / 2 + ox + (vx - ox) * k, geo.cy - D / 2 + oy + (vy - oy) * k]
  }
  /** a boat's foot on the disc and a point `up` px above it on its upright card */
  function boatPt(i: number, up: number): Pt {
    const [x, y] = boatAt(i, BOAT_K())
    return project(x, y - up * Math.cos(rad(VIEW)), up * Math.sin(rad(VIEW)))
  }
  const BOAT_K = () => (geo.wide ? 0.64 : 0.56)
  let tagW = [0, 0, 0]
  function placeTags() {
    tags.forEach((t, i) => {
      // above the boat; the boat in front of the island (6 o'clock) carries its name below the hull, clear of the keep
      const front = Math.sin(rad(ANG[i])) > 0.95
      const [x, y] = boatPt(i, front ? -geo.bh * 0.12 : geo.bh * 0.98)
      const hw2 = tagW[i] / 2 + 6
      t.style.transform = `translate(${f1(clamp(x, hw2, geo.W - hw2))}px, ${f1(y)}px) translate(-50%, ${front ? '0%' : '-100%'})`
    })
  }
  if (!ctx.reduced) root.addEventListener('pointermove', (e) => e.pointerType === 'mouse' && wake())

  // ── high only: lanterns walking the bridges into the keep, ≤ 120 dots, asleep after 10 s without input
  const r0 = rng(2840)
  const walk = Array.from({ length: 110 }, () => ({ a: r0() * Math.PI * 2, t: r0(), v: 0.08 + r0() * 0.08 }))
  let awake = 0
  const dctx = dots?.getContext('2d') ?? null
  let lampC = '#f4c67a', dz = 1
  const loop = dots && dctx ? createLoop(root, (_t, dt) => {
    const S = dots.width
    dctx.clearRect(0, 0, S, S)
    dctx.fillStyle = lampC
    const c = S / 2, R0 = (S / 2) * ((ISLE + WALL) / BANK), R1 = (S / 2) * (MOAT / BANK)
    for (const w of walk) {
      w.t += w.v * dt
      // only on the bridges: each light walks one of them
      if (w.t > 1) (w.t -= 1), (w.a = ((Math.floor(r0() * N_BRIDGE) + 0.5) / N_BRIDGE) * Math.PI * 2)
      const rr = R1 + (R0 - R1) * w.t
      dctx.globalAlpha = Math.sin(w.t * Math.PI) * 0.9
      dctx.fillRect(c + Math.cos(w.a) * rr - dz, c + Math.sin(w.a) * rr - dz, dz * 2, dz * 2)
    }
    dctx.globalAlpha = 1
    return performance.now() < awake
  }) : null
  ctx.onCleanup(() => loop?.dispose())
  function wake() {
    if (!loop || ctx.reduced) return
    awake = performance.now() + 10000
    loop.start()
  }
  walk.forEach((w) => (w.a = ((Math.floor(r0() * N_BRIDGE) + 0.5) / N_BRIDGE) * Math.PI * 2))

  // ── bake the mandala (once per size, in slices) and the in-plane SVG
  let job: { cancel(): void } | null = null
  let baked = ''
  function* bake(Dp: number, pr: number, wide: boolean) {
    const c2 = cv.getContext('2d')
    if (!c2) return
    cv.width = cv.height = Math.round(Dp * pr)
    c2.setTransform(pr, 0, 0, pr, 0, 0)
    const cs = getComputedStyle(document.documentElement)
    const v = (n: string) => cs.getPropertyValue(n).trim()
    const dark = document.documentElement.dataset.theme === 'dark'
    const R = Dp / 2, c = R
    const r = rng(2820)
    const T = { paper: v('--paper'), wash: v('--wash'), water: v('--water'), moon: v('--moon'), lantern: v('--lantern'), mist: v('--mist'), rockLo: v('--rock-lo'), rockMid: v('--rock-mid'), rockHi: v('--rock-hi'), stepMid: v('--step-mid'), stepLo: v('--step-lo'), mossA: v('--moss-a'), mossB: v('--moss-b'), umbra: v('--umbra') }
    lampC = T.lantern
    const disk0 = (x: number, y: number, rr: number, fill: string | CanvasGradient, a = 1) => {
      c2.globalAlpha = a
      c2.fillStyle = fill
      c2.beginPath()
      c2.arc(x, y, rr, 0, Math.PI * 2)
      c2.fill()
      c2.globalAlpha = 1
    }
    const disk = (rr: number, fill: string | CanvasGradient, a = 1) => disk0(c, c, rr, fill, a)
    // the lake: black water fading into the paper at the rim
    // the lake: the same black water as the frame's own lake behind the disc, a little deeper toward the island
    c2.clearRect(0, 0, Dp, Dp)
    disk(R, T.water)
    const deep = c2.createRadialGradient(c, c, R * BANK, c, c, R * 0.95)
    deep.addColorStop(0, T.wash)
    deep.addColorStop(1, 'rgba(0,0,0,0)')
    disk(R * 0.95, deep, dark ? 0.35 : 0.18)
    yield
    // ripples on the lake and the moat: dry dashes, longer toward the viewer
    c2.lineCap = 'round'
    const ripple = (r1: number, r2: number, n: number, col: string, a: number) => {
      c2.strokeStyle = col
      for (let i = 0; i < n; i++) {
        const ang = r() * Math.PI * 2, rr = r1 + r() * (r2 - r1)
        const x = c + Math.cos(ang) * rr, y = c + Math.sin(ang) * rr
        const len = R * (0.01 + r() * 0.03) * (0.6 + (y / Dp) * 0.8)
        c2.globalAlpha = a * (0.4 + r() * 0.6)
        c2.lineWidth = 0.8 + r() * 1.2
        c2.beginPath()
        c2.moveTo(x - len, y)
        c2.lineTo(x + len, y + (r() - 0.5))
        c2.stroke()
      }
      c2.globalAlpha = 1
    }
    ripple(R * BANK, R * 0.95, 260, dark ? T.mist : T.paper, dark ? 0.18 : 0.35)
    // the moon's broken road on the far lake and across the moat, toward the viewer
    c2.strokeStyle = T.moon
    for (let i = 0; i < 90; i++) {
      const y = c - R * 0.95 + r() * R * 1.9
      const dist = Math.abs(y - c) / R
      if (Math.hypot(r() * 0.1, dist) < BANK && Math.abs(y - c) < R * BANK) continue
      const x = c + R * 0.12 + (r() - 0.5) * R * (0.05 + dist * 0.04)
      const len = R * (0.012 + r() * 0.03)
      c2.globalAlpha = (dark ? 0.75 : 0.9) * (1 - dist * 0.7)
      c2.lineWidth = 1 + r() * 1.6
      c2.beginPath()
      c2.moveTo(x - len, y)
      c2.lineTo(x + len, y)
      c2.stroke()
    }
    c2.globalAlpha = 1
    yield
    // the village bank: a ring of earth with moss, cut by three canals where the boats come in
    disk(R * BANK, dark ? T.rockLo : T.stepMid)
    disk(R * (BANK - 0.012), dark ? T.rockLo : T.rockMid, 1)
    c2.globalAlpha = 0.5
    for (let i = 0; i < 70; i++) {
      const ang = r() * Math.PI * 2, rr = R * (MOAT + 0.02 + r() * (BANK - MOAT - 0.04))
      c2.fillStyle = r() < 0.5 ? T.mossB : T.mossA
      c2.beginPath()
      c2.ellipse(c + Math.cos(ang) * rr, c + Math.sin(ang) * rr, R * (0.01 + r() * 0.02), R * (0.006 + r() * 0.012), ang, 0, Math.PI * 2)
      c2.fill()
    }
    c2.globalAlpha = 1
    // low roofs, laid radially, each with a ridge line and (now and then) a lit window
    const roofs = 80
    for (let i = 0; i < roofs; i++) {
      const ang = (i / roofs) * Math.PI * 2 + (r() - 0.5) * 0.03
      if (ANG.some((a) => Math.abs(((ang * 180) / Math.PI - a + 540) % 360 - 180) < 6)) continue
      const rr = R * (MOAT + 0.05 + (i % 2) * 0.05 + r() * 0.015)
      const w = R * (0.035 + r() * 0.012), d = R * (0.022 + r() * 0.008)
      c2.save()
      c2.translate(c + Math.cos(ang) * rr, c + Math.sin(ang) * rr)
      c2.rotate(ang + Math.PI / 2)
      c2.fillStyle = T.umbra
      c2.globalAlpha = 0.25
      c2.fillRect(-w / 2 + d * 0.3, -d / 2 + d * 0.4, w, d)
      c2.globalAlpha = 1
      // a hipped roof from above: the far slope in shadow, the near one catching the moon, a pale ridge
      const roofP = (y0: number, y1: number) => {
        c2.beginPath()
        c2.moveTo(-w / 2, y0)
        c2.lineTo(w / 2, y0)
        c2.lineTo(w / 2 - d * 0.5, y1)
        c2.lineTo(-w / 2 + d * 0.5, y1)
        c2.closePath()
        c2.fill()
      }
      c2.fillStyle = T.wash
      roofP(-d / 2, 0)
      c2.fillStyle = dark ? T.rockLo : T.stepLo
      roofP(d / 2, 0)
      c2.strokeStyle = dark ? T.stepMid : T.rockHi
      c2.lineWidth = 1.2
      c2.beginPath()
      c2.moveTo(-w / 2 + d * 0.5, 0)
      c2.lineTo(w / 2 - d * 0.5, 0)
      c2.stroke()
      if (r() < 0.45) {
        c2.fillStyle = T.lantern
        c2.globalAlpha = 0.9
        c2.fillRect(-w * 0.1, d / 2 - 1, w * 0.2, 2)
        c2.globalAlpha = 1
      }
      c2.restore()
      if (i % 20 === 19) yield
    }
    // round crowns of trees between the houses
    for (let i = 0; i < 46; i++) {
      const ang = r() * Math.PI * 2, rr = R * (MOAT + 0.03 + r() * (BANK - MOAT - 0.05))
      if (ANG.some((a) => Math.abs(((ang * 180) / Math.PI - a + 540) % 360 - 180) < 7)) continue
      const x = c + Math.cos(ang) * rr, y = c + Math.sin(ang) * rr, tr = R * (0.012 + r() * 0.012)
      c2.fillStyle = T.umbra
      c2.globalAlpha = 0.22
      c2.beginPath()
      c2.arc(x + tr * 0.5, y + tr * 0.4, tr, 0, Math.PI * 2)
      c2.fill()
      c2.globalAlpha = 0.9
      c2.fillStyle = r() < 0.5 ? T.mossB : T.mossA
      c2.beginPath()
      c2.arc(x, y, tr, 0, Math.PI * 2)
      c2.fill()
    }
    c2.globalAlpha = 1
    // canals through the bank: stone-lined channels, a lamp at each mouth
    for (const a of ANG) {
      const ux = Math.cos(rad(a)), uy = Math.sin(rad(a)), nx = -uy, ny = ux
      const at = (k: number, o: number): [number, number] => [c + ux * R * k + nx * R * o, c + uy * R * k + ny * R * o]
      const hw = 0.02
      c2.fillStyle = T.water
      c2.beginPath()
      c2.moveTo(...at(MOAT - 0.01, -hw))
      c2.lineTo(...at(BANK + 0.012, -hw * 1.3))
      c2.lineTo(...at(BANK + 0.012, hw * 1.3))
      c2.lineTo(...at(MOAT - 0.01, hw))
      c2.closePath()
      c2.fill()
      c2.strokeStyle = dark ? T.stepMid : T.rockHi
      c2.lineWidth = Math.max(1.2, R * 0.006)
      for (const sd of [-1, 1]) {
        c2.beginPath()
        c2.moveTo(...at(MOAT + 0.004, sd * hw))
        c2.lineTo(...at(BANK + 0.004, sd * hw * 1.3))
        c2.stroke()
      }
      c2.fillStyle = T.lantern
      for (const sd of [-1, 1]) {
        const [x, y] = at(BANK - 0.004, sd * hw * 1.9)
        c2.fillRect(x - 1.5, y - 1.5, 3, 3)
      }
    }
    // the bank's outer edge catches the moon (the disc floats in the night: its rim is lit)
    c2.strokeStyle = dark ? T.moon : T.rockHi
    c2.globalAlpha = dark ? 0.55 : 0.8
    c2.lineWidth = Math.max(1.5, R * 0.006)
    c2.beginPath()
    c2.arc(c, c, R * (BANK - 0.002), Math.PI * 1.02, Math.PI * 1.98)
    c2.stroke()
    c2.globalAlpha = 1
    yield
    // the moat: black water between the bank and the island, its own ripples
    disk(R * MOAT, dark ? T.water : T.water)
    disk(R * MOAT, T.wash, dark ? 0.45 : 0.5)
    ripple(R * ISLE, R * MOAT, 90, dark ? T.mist : T.paper, dark ? 0.2 : 0.3)
    // the bamboo bridges from the bank to the island's shore, few enough to count: a deck and two rails, each one's shadow
    for (let i = 0; i < N_BRIDGE; i++) {
      const ang = ((i + 0.5) / N_BRIDGE) * Math.PI * 2
      if (ANG.some((a) => Math.abs(((ang * 180) / Math.PI - a + 540) % 360 - 180) < 9)) continue // not across a canal
      const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux
      const at = (k: number, o: number): [number, number] => [c + ux * R * k + nx * o, c + uy * R * k + ny * o]
      const k0 = MOAT + 0.006, k1 = ISLE + WALL - 0.004, hw = R * 0.01
      c2.lineCap = 'round'
      c2.strokeStyle = T.umbra
      c2.globalAlpha = 0.3
      c2.lineWidth = hw * 2.2
      c2.beginPath()
      c2.moveTo(...at(k0, hw * 1.2))
      c2.lineTo(...at(k1, hw * 1.2))
      c2.stroke()
      c2.globalAlpha = 1
      c2.strokeStyle = dark ? T.stepMid : T.rockHi
      c2.lineWidth = hw * 1.8
      c2.beginPath()
      c2.moveTo(...at(k0, 0))
      c2.lineTo(...at(k1, 0))
      c2.stroke()
      c2.strokeStyle = T.wash
      c2.globalAlpha = 0.7
      c2.lineWidth = Math.max(0.8, hw * 0.3)
      for (const sd of [-1, 1]) {
        c2.beginPath()
        c2.moveTo(...at(k0, sd * hw))
        c2.lineTo(...at(k1, sd * hw))
        c2.stroke()
      }
    }
    c2.globalAlpha = 1
    // the island: its retaining wall (the moat's inner wall, in courses, moonlit on its far top), moss, gravel courtyard
    disk(R * (ISLE + WALL), dark ? T.rockLo : T.rockMid)
    c2.strokeStyle = T.wash
    c2.globalAlpha = 0.35
    c2.lineWidth = 0.8
    for (let k = 1; k < 3; k++) {
      c2.beginPath()
      c2.arc(c, c, R * (ISLE + (WALL * k) / 3), 0, Math.PI * 2)
      c2.stroke()
    }
    c2.globalAlpha = 1
    c2.strokeStyle = dark ? T.moon : T.rockHi
    c2.globalAlpha = dark ? 0.5 : 0.85
    c2.lineWidth = Math.max(1.2, R * 0.005)
    c2.beginPath()
    c2.arc(c, c, R * (ISLE + WALL - 0.002), Math.PI * 1.05, Math.PI * 1.95)
    c2.stroke()
    c2.globalAlpha = 1
    disk(R * ISLE, dark ? T.rockLo : T.rockMid)
    c2.strokeStyle = T.wash
    c2.globalAlpha = 0.6
    c2.lineWidth = R * 0.01
    c2.beginPath()
    c2.arc(c, c, R * (ISLE - 0.005), 0, Math.PI * 2)
    c2.stroke()
    c2.globalAlpha = 1
    disk(R * (ISLE - 0.02), dark ? T.stepLo : T.stepMid)
    for (let i = 0; i < 26; i++) {
      const ang = r() * Math.PI * 2, rr = R * (ISLE - 0.03) * Math.sqrt(r())
      c2.fillStyle = r() < 0.6 ? T.mossB : T.mossA
      c2.globalAlpha = 0.55
      c2.beginPath()
      c2.ellipse(c + Math.cos(ang) * rr, c + Math.sin(ang) * rr, R * (0.012 + r() * 0.02), R * (0.008 + r() * 0.012), r() * 3, 0, Math.PI * 2)
      c2.fill()
    }
    c2.globalAlpha = 1
    // the keep's plinth: a round stone dais, its near face a darker band (the disc leans back, so near is down)
    const plr = R * ISLE * 0.7
    disk0(c, c + R * 0.016, plr, dark ? T.wash : T.rockLo)
    disk0(c, c + R * 0.008, plr, T.rockLo, 0.8)
    disk0(c, c, plr, dark ? T.rockMid : T.rockHi)
    disk0(c, c, plr * 0.82, dark ? T.rockLo : T.rockMid, 0.55)
    c2.strokeStyle = dark ? T.moon : T.paper
    c2.globalAlpha = 0.7
    c2.lineWidth = Math.max(1, R * 0.004)
    c2.beginPath()
    c2.arc(c, c, plr, Math.PI * 1.1, Math.PI * 1.9)
    c2.stroke()
    c2.globalAlpha = 1
    // the far edge dissolving into the paper (it is far away)
    const mistG = c2.createLinearGradient(0, 0, 0, Dp)
    mistG.addColorStop(0, T.paper)
    mistG.addColorStop(0.28, 'rgba(0,0,0,0)')
    c2.globalAlpha = dark ? 0.6 : 0.45
    c2.fillStyle = mistG
    c2.fillRect(0, 0, Dp, Dp)
    c2.globalAlpha = 1
    // the disc's own edge fades out (it floats in the night)
    c2.globalCompositeOperation = 'destination-in'
    // the frame's own lake (.t28m-lake) takes over; a tall frame is narrower than the disc, so its water ends sooner
    const edge = c2.createRadialGradient(c, c, R * (wide ? 0.6 : 0.42), c, c, R * (wide ? 0.97 : 0.62))
    edge.addColorStop(0, '#000')
    edge.addColorStop(1, 'rgba(0,0,0,0)')
    c2.fillStyle = edge
    c2.fillRect(0, 0, Dp, Dp)
    c2.globalCompositeOperation = 'source-over'
  }

  /** the in-plane SVG: the keep's name cut into its plinth */
  function drawRing(Dp: number) {
    const R = Dp / 2, c = R
    ring.setAttribute('viewBox', `0 0 ${f1(Dp)} ${f1(Dp)}`)
    ring.replaceChildren(
      s('text', { class: 't28m-carve', x: f1(c), y: f1(c + R * ISLE * 0.56), 'text-anchor': 'middle', 'font-size': f1(clamp(R * 0.034, 11, 18)) }, G.castle))
  }

  function layout() {
    const W = ctx.art.clientWidth
    const H = stableH(ctx.art.clientHeight)
    if (W < 60 || H < 60) return
    root.style.height = `${f1(H)}px`
    const wide = W / H > 1.15
    const Dp = Math.round(Math.min(1100, wide ? Math.max(W, H) : W * 1.45))
    D = Dp
    const cx = W * 0.5, cy = wide ? H * 0.44 : H * 0.5
    const bwp = wide ? clamp(Dp * 0.13, 84, 128) : 72
    geo = { W, H, cx, cy, wide, persp: Math.max(W, H) * 1.6, bwp, bh: (bwp * 62) / 84 }
    Object.assign(fleet.style, { left: `${f1(cx - Dp / 2)}px`, top: `${f1(cy - Dp / 2)}px`, width: `${Dp}px`, height: `${Dp}px`, perspective: `${f1(geo.persp)}px` })
    root.classList.toggle('wide', wide)
    ANG = ANGS[wide ? 0 : 1]
    VIEW = VIEWS[wide ? 0 : 1]
    root.style.setProperty('--t28m-view', `${VIEW}deg`)
    disc.style.transform = `rotateX(${f1(VIEW)}deg)`
    // the keep stands up out of the disc's plane on its stone plinth (baked into the disc), well inside the island; the boats too
    const bw = Dp * ISLE * 0.7
    keep.replaceChildren(s('svg', { viewBox: `${f1(-bw * 0.9)} ${f1(-bw * 1.05)} ${f1(bw * 1.8)} ${f1(bw * 1.12)}`, style: `width:${f1(bw * 1.8)}px;height:${f1(bw * 1.12)}px` },
      pine(-bw * 0.66, -bw * 0.02, bw * 0.46, 2826, -1), ...castle(bw, 2827), pine(bw * 0.64, 0, bw * 0.4, 2828, 1)))
    Object.assign(keep.style, { left: `${f1(Dp / 2 - bw * 0.9)}px`, top: `${f1(Dp / 2 - bw * 1.05)}px`, width: `${f1(bw * 1.8)}px`, height: `${f1(bw * 1.12)}px` })
    boats.forEach((b, i) => {
      const [x, y] = boatAt(i, BOAT_K())
      Object.assign(b.style, { left: `${f1(x - bwp / 2)}px`, top: `${f1(y - bwp * 0.7)}px`, width: `${f1(bwp)}px` })
    })
    if (dots) {
      const S = Math.round(Dp * BANK) // the dots canvas covers the moat and the bank only
      dots.width = dots.height = S
      dz = Math.max(1, S / 300)
      Object.assign(dots.style, { left: `${f1(Dp / 2 - S / 2)}px`, top: `${f1(Dp / 2 - S / 2)}px`, width: `${S}px`, height: `${S}px` })
    }
    // the house on the village bank beside the canal of the boat it should reach; its bridges fan out to the castle wall
    const R = Dp / 2, ha = ANG[TARGET] + (wide ? 17 : 38)
    const onDisc = (a: number, k: number): Pt => project(R + Math.cos(rad(a)) * R * k, R + Math.sin(rad(a)) * R * k, 0)
    // (a phone: the house farther out on the bank and the bridges fanned wider, so each one can be touched)
    home = onDisc(ha, wide ? MOAT + 0.06 : BANK - 0.02)
    anchors = [-2, -1, 0, 1, 2].map((d) => onDisc(ha + d * (wide ? 24 : 36), ISLE + WALL))
    placeCuts(project(R, R, 0))
    hw = clamp(Dp * 0.06, 50, 66)
    house.style.width = `${f1(hw)}px`
    boatPts = boats.map((_, i) => boatPt(i, geo.bh * 0.3))
    cuts.forEach((b, k) => {
      const [x, y] = cutAt(k)
      b.style.transform = `translate(${f1(x)}px, ${f1(y)}px)`
    })
    if (docked >= 0) off = [boatPts[docked][0] - home[0], boatPts[docked][1] - home[1]]
    drawBridges()
    const [bx, by] = boatPts[TARGET]
    const mid: Pt = [(home[0] + bx) / 2, Math.min(home[1], by) - 30]
    arrow.setAttribute('d', `M${P([home[0] + hw * 0.4, home[1] - hw * 0.3])}Q${P(mid)} ${P([bx - bwp * 0.25, by - 10])}`)
    const [kx, ky] = project(R, R + R * (MOAT + 0.02), 0)
    Object.assign(cuda.style, { left: `${f1(kx)}px`, top: `${f1(ky)}px` })
    rig.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    tagW = tags.map((t) => t.offsetWidth) // one read, after this layout's writes
    placeTags()
    drawRing(Dp)
    g.refresh()
    const key = `${Dp}|${document.documentElement.dataset.theme}|${wide}`
    if (key === baked) return
    const first = !baked
    baked = key
    job?.cancel()
    cv.style.width = cv.style.height = `${Dp}px`
    job = sliced(bake(Dp, low ? 1 : Math.min(devicePixelRatio, 1.25), wide), { sync: ctx.reduced || !first })
    wake()
  }
  ctx.onCleanup(onSize(ctx.art, layout))
  // a theme change re-bakes the canvas in one go (README A.10); onPrefs also fires for sound / quality: compare first
  ctx.onCleanup(onPrefs(() => {
    if (!baked.startsWith(`${D}|${document.documentElement.dataset.theme}|`) && geo.W > 1) layout()
  }))
  ctx.onCleanup(() => job?.cancel())
}
