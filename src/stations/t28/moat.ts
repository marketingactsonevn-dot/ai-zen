import './frame.css'
import { fill, h, nextId, s } from '../../core/dom'
import { sliced } from '../../core/chunk'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { blob, clamp, curve, onSize, p2Defs, rng, stableHeight, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist, moon, pine, reeds } from '../../ui/part2/paint'
import { C } from './data'
import { figure } from './brush'
import { guide } from '../../ui/part2/guide'

const G = C.scenes.moat
const CUTS = 5 // the bridges that tie the house to the castle
// rings, as shares of the plan radius Rx: island · moat · village bank
const RI = 0.2, RM = 0.5, RB = 0.66
const f1 = (n: number) => n.toFixed(1)
const P = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`
const rad = (d: number) => (d * Math.PI) / 180
const line = (pts: Pt[]) => `M${pts.map(P).join('L')}`

/** A curved castle roof centred on xc with its eave line at y: upturned tips, a concave slope up to the ridge. */
function roof(xc: number, y: number, hw: number, rh: number) {
  return `M${P([xc - hw * 1.3, y - rh * 0.22])}Q${P([xc - hw * 1.08, y + rh * 0.14])} ${P([xc - hw * 0.86, y + rh * 0.08])}L${P([xc + hw * 0.86, y + rh * 0.08])}Q${P([xc + hw * 1.08, y + rh * 0.14])} ${P([xc + hw * 1.3, y - rh * 0.22])}Q${P([xc + hw * 0.78, y - rh * 0.22])} ${P([xc + hw * 0.5, y - rh])}L${P([xc - hw * 0.5, y - rh])}Q${P([xc - hw * 0.78, y - rh * 0.22])} ${P([xc - hw * 1.3, y - rh * 0.22])}Z`
}

/** The keep standing on (x, y), bw wide: a battered stone base in courses, three plastered tiers under curved roofs, lit windows. */
function castle(x0: number, y0: number, bw: number, seed: number): SVGElement {
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
  return s('g', { class: 't28m-castle', transform: `translate(${f1(x0)} ${f1(y0)})` },
    s('ellipse', { class: 't28m-sh', cx: f1(bw * 0.3), cy: 2, rx: f1(bw * 0.75), ry: f1(bw * 0.1) }),
    s('circle', { cx: 0, cy: f1(-hb - bw * 0.25), r: f1(bw * 0.62), fill: 'url(#p2-lamp)', class: 't28m-keep-glow' }),
    s('path', { class: 'gb-stone', d: base, filter: 'url(#ink-rough)' }),
    s('path', { class: 'gb-stone-sh', d: base }),
    s('path', { class: 't28m-course', d: courses }),
    s('path', { class: 'gb-plaster', d: walls, filter: 'url(#ink-rough)' }),
    s('path', { class: 't28m-wallsh', d: shade }),
    s('path', { class: 't28m-win', d: dark }),
    s('path', { class: 't28m-lit', d: lit }),
    s('path', { class: 't28m-roof', d: roofs + fin(-1) + fin(1), filter: 'url(#ink-rough)' }),
    s('path', { class: 't28m-rim', d: rims }))
}

/**
 * A sampan with a rower at the stern and its own paper lantern at the bow (round, tall or square; no brand colours),
 * floating: the waterline at y = 0, the boat's reflection broken in the water under it.
 */
function boatArt(seed: number, kind: number): SVGSVGElement {
  const r = rng(seed)
  let wake = ''
  for (let i = 0; i < 4; i++) {
    const y = 4 + i * 3.2, x = -38 + r() * 10
    wake += stroke([[x, y], [x + 18 + r() * 16, y + 0.4]], 1.2 + i * 0.2, 0.3, 0.3, 0.1)
  }
  const hid = nextId('t28m-hl')
  const rower = figure(-17, -5, 25, seed, 1, { hat: 'cone', stoop: 0.3 })
  const hull = 'M-36 -8Q-6 2 30 -13Q33 -14 34 -12L29 -3Q0 8 -31 0Z'
  const lamp = kind === 0 ? s('ellipse', { class: 't28m-lamp', cx: 28, cy: -29.5, rx: 5, ry: 5.4 })
    : kind === 1 ? s('rect', { class: 't28m-lamp', x: 24.6, y: -36, width: 6.8, height: 13, rx: 3.2 })
      : s('rect', { class: 't28m-lamp', x: 23.5, y: -34.5, width: 9, height: 9, rx: 1 })
  // the reflection: the hull, the rower and the lantern mirrored about the waterline, squashed and faint
  const mirror = s('g', { class: 't28m-refl', transform: 'translate(0 1) scale(1 -0.62)' },
    s('path', { d: hull }), s('path', { d: rower }), s('path', { d: stroke(curve([22, -7], [21, -35], [28, -41], 8), 1.6, 0.05, 0.2, 0.4) }))
  return s('svg', { viewBox: '-42 -50 84 70', 'aria-hidden': 'true' },
    s('defs', null, s('radialGradient', { id: hid, cx: 27, cy: -13, r: 30, gradientUnits: 'userSpaceOnUse' },
      s('stop', { offset: 0, style: 'stop-color:var(--lantern);stop-opacity:.9' }),
      s('stop', { offset: 0.5, style: 'stop-color:var(--lantern);stop-opacity:.35' }),
      s('stop', { offset: 1, style: 'stop-color:var(--lantern);stop-opacity:0' }))),
    s('circle', { class: 't28m-bglow', cx: 28, cy: -30, r: 20, fill: 'url(#p2-lamp)' }),
    mirror,
    s('path', { class: 't28m-lampref', d: stroke([[27, 2], [28.5, 8], [27.5, 15]], 2.6, 0.2, 0.5, 0.3) }),
    s('path', { class: 't28m-wake', d: wake }),
    s('path', { class: 't28m-figrim', d: rower, transform: 'translate(0.9 -0.5)' }),
    s('path', { class: 'gb-figure', d: rower }),
    s('path', { class: 'gb-figure', d: stroke([[-10, -19], [-22, -7], [-33, 5]], 1.8, 0.1, 0.1, 0.5) }),
    s('path', { class: 't28m-hull', d: hull }),
    s('path', { class: 't28m-hull-lit', d: hull, fill: `url(#${hid})` }),
    s('path', { class: 'gb-rim-hi', d: stroke([[-34, -8], [-6, 0], [30, -12]], 1.3, 0.2, 0.3, 0.1) }),
    s('path', { class: 'gb-figure', d: stroke(curve([22, -7], [21, -35], [28, -41], 8), 1.6, 0.05, 0.2, 0.4) }),
    s('path', { class: 'gb-rope', d: 'M28 -41V-36' }),
    lamp)
}

/** The team's house: plastered walls, a hipped roof catching the moon, a lit window; its foot at the bottom centre. */
function houseArt(): SVGSVGElement {
  return s('svg', { viewBox: '-32 -36 64 50', 'aria-hidden': 'true' },
    s('circle', { class: 't28m-hglow', cx: 0, cy: -6, r: 26, fill: 'url(#p2-lamp)' }),
    s('ellipse', { class: 't28m-sh', cx: 6, cy: 10, rx: 25, ry: 4 }),
    s('path', { class: 'gb-plaster', d: 'M-19 9L-19 -8L19 -8L19 9Z' }),
    s('path', { class: 't28m-wallsh', d: 'M6 9L6 -8L19 -8L19 9Z' }),
    s('path', { class: 't28m-lit', d: 'M-12 -3h7v7h-7Z' }),
    s('path', { class: 't28m-win', d: 'M3 -3h6v7h-6Z' }),
    s('path', { class: 't28m-roof', d: 'M-27 -6Q-24 -4 -20 -5L20 -5Q24 -4 27 -6L15 -22L-15 -22Z' }),
    s('path', { class: 't28m-rim', d: stroke([[-15, -22], [0, -23], [15, -22]], 1.6, 0.2, 0.2, 0.2) }))
}

/**
 * Hào nước quanh lâu đài (art direction §4 t28 `moat`; audit v3 28-3, Làm lại). A lake at night seen from a low hill: the
 * far shore in the mist, the moon behind cloud at the right, its road broken on the water. In the lake a ring of land —
 * the village, its roofs and trees, three canals cut through it — round a moat, and in the moat NVIDIA's island: a stone
 * wall in courses, the keep on its plinth. Bamboo bridges on piers span the moat from the bank to the island wall: the
 * code the whole village has written for CUDA. One house (an AI team) on the bank is tied by five: drag it toward a
 * rival's boat and they pull taut and spring it back; tap each bridge's pier to cut it (rewrite the code), then carry
 * the house onto the boat. Everything is drawn in one projection (plan radius × depth, heights straight up), so every
 * deck rests on its piers and every boat sits in the water over its own reflection.
 */
export function moatScene(ctx: SceneCtx) {
  p2Defs()
  const stableH = stableHeight(ctx, [G.insight as Fact])
  const g = guide(ctx)
  const step = g.steps(G.prompts)
  step(0)

  const stage = s('svg', { class: 't28m-stage', 'aria-hidden': 'true' })
  const boats = G.boats.map((_, i) => h('div', { class: `t28m-boat${i === 1 ? ' is-target' : ''}`, 'aria-hidden': 'true' }, h('i', { class: 't28m-berth' }), boatArt(2830 + i, i)))
  // each boat's name lies on the water in front of it, with its faint reflection (§3.6 "trên nước")
  const tags = G.boats.map((b) => h('span', { class: 't28m-tag', 'aria-hidden': 'true', 'data-t': b.name }, b.name))
  const [cudaName, cudaWhat] = G.moatLabel.split(' · ')
  const cudaSub = h('p', { class: 't28m-cudasub', 'data-t': cudaWhat ?? '' }, cudaWhat ?? '')
  const rig = s('svg', { class: 't28m-rig', 'aria-hidden': 'true' })
  const wake = s('path', { class: 't28m-arrow' })
  const bridges = Array.from({ length: CUTS }, () => s('g', { class: 't28m-br' }, s('path', { class: 't28m-br-refl' }), s('path', { class: 't28m-br-post' }), s('path', { class: 't28m-br-deck' }), s('path', { class: 't28m-br-rail' })))
  rig.append(wake, ...bridges)
  const cuts = bridges.map((_, k) => h('button', { class: 't28m-cut', type: 'button', 'aria-label': fill(G.cutAria, { n: k + 1 }) }))
  const house = h('div', { class: 't28m-house', role: 'button', tabindex: '0', 'aria-label': G.houseAria }, houseArt())
  const root = h('div', { class: 't28m', role: 'group', 'aria-label': G.art }, stage, ...boats, ...tags, cudaSub, rig, house, ...cuts)
  ctx.art.append(root)

  const TARGET = 1 // the arrow points at Amazon's boat on the right (any boat takes the house)
  // the layout of this pass
  let V = { W: 1, H: 1, wide: true, cx: 0, cy: 0, Rx: 1, Ry: 1, wallH: 1, bankH: 1, deck: 1, hw: 60, fan: 12, bw: [100, 100, 100] as number[], th: 0, ang: [0, 0, 0] as number[], rr: [0, 0, 0] as number[] }
  /** a point of the plan (r in Rx, θ degrees: 0 = east, 90 = toward the viewer) at height z px */
  const at = (r: number, th: number, z = 0): Pt => [V.cx + Math.cos(rad(th)) * r * V.Rx, V.cy + Math.sin(rad(th)) * r * V.Ry - z]

  // ── the house, its five bridges, the cuts
  let left = CUTS
  const cut = new Set<number>()
  let home: Pt = [0, 0] // the house's foot (where its bridges land)
  let anchors: Pt[] = [] // each bridge on the island wall's top
  let piers: Pt[] = [] // each bridge's pier: its foot in the moat
  let off: Pt = [0, 0]
  let docked = -1
  let boatPts: Pt[] = [] // where a boat takes the house (its deck)
  const dotHouse = g.dot(house, { dir: [1, 0.3] })
  let dotCut: ReturnType<typeof g.dot> | null = null
  let count: ReturnType<typeof g.count> | null = null

  /** a bridge from the wall over its pier to the house (cut: two stubs hanging into the moat from each end) */
  function drawBridges() {
    const hx = home[0] + off[0], hy = home[1] + off[1]
    const dz = V.deck
    bridges.forEach((b, k) => {
      const [ax, ay] = anchors[k], [px, py] = piers[k]
      const top: Pt = [px, py - dz]
      let spans: Pt[][]
      // cut: the stubs stay where they were built (the wall, the bank landing), whatever the house does next
      if (cut.has(k)) spans = [[[ax, ay], [ax + (top[0] - ax) * 0.55, ay + (top[1] - ay) * 0.55 + dz * 0.9]], [home, [home[0] + (top[0] - home[0]) * 0.45, home[1] + (top[1] - home[1]) * 0.45 + dz * 0.9]]]
      else {
        const sag = Math.hypot(off[0], off[1]) > 4 ? 0 : 2.5 // slack hangs a little; taut it runs straight
        spans = [[...curve([ax, ay], [(ax + top[0]) / 2, (ay + top[1]) / 2 + sag], top, 6), ...curve(top, [(top[0] + hx) / 2, (top[1] + hy) / 2 + sag], [hx, hy], 6).slice(1)]]
      }
      const [refl, post, deck, rail] = b.children
      const w = V.wide ? 5 : 4
      // the reflection: each point mirrored about the water under it (its height above the water, doubled)
      const zOf = (p: Pt) => clamp((py - p[1]) * 0.9, 0, dz * 3)
      refl.setAttribute('d', spans.map((sp) => stroke(sp.map((p) => [p[0], p[1] + zOf(p) * 2] as Pt), w * 0.8, 0.1, 0.1, 0.4)).join(''))
      post.setAttribute('d', stroke([[px - 0.4, py + 1], [px, top[1]]], Math.max(2.4, w * 0.6), 0.05, 0.05, 0.7) + blob(px, py + 1, w * 0.9, w * 0.3, 7 + k, 0.1, 8))
      deck.setAttribute('d', spans.map((sp) => stroke(sp, w, 0.08, 0.08, 0.5)).join(''))
      rail.setAttribute('d', spans.map((sp) => stroke(sp.map(([x, y]) => [x, y - w * 0.9] as Pt), 1.1, 0.2, 0.2, 0.3)).join(''))
    })
    house.style.transform = `translate(${f1(hx - V.hw / 2)}px, ${f1(hy - V.hw * 0.72)}px)`
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
    const [x, y] = piers[k]
    const word = h('span', { class: 't28m-rewrite', 'aria-hidden': 'true', style: `left:${f1(x)}px;top:${f1(y - V.deck - 8)}px` }, G.rewrite)
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
    dotHouse.done()
    g.dot(house, { dir: [1, 0.3] })
    if (document.activeElement === cuts[k]) house.focus({ preventScroll: true })
  }
  cuts.forEach((b, k) => b.addEventListener('click', () => snip(k)))

  function dock(i: number) {
    docked = i
    const [bx, by] = boatPts[i]
    off = [bx - home[0], by - home[1]]
    root.classList.add('docked')
    boats[i].classList.add('took')
    house.setAttribute('aria-disabled', 'true')
    house.querySelector('.p2g-dot')?.remove()
    drawBridges()
    g.ok(house)
    ctx.chime('ok')
    ctx.insight(G.insight as Fact, G.detail as Fact[])
  }
  /** the house was pulled and the bridges held it: the first bridge to cut */
  function taut() {
    if (root.classList.contains('held')) return
    root.classList.add('held')
    step(1)
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
    if (left === 0) root.classList.add('lift')
  })
  house.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y
    if (left) {
      const d = Math.hypot(dx, dy) || 1, k = 30 / (30 + d) // the bridges give a little and no more
      off = [dx * k, dy * k]
      if (d > 16) root.classList.add('taut')
    } else off = [dx, dy]
    drawBridges()
  })
  const release = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return
    const pulled = Math.hypot(off[0], off[1]) > 8
    drag = null
    root.classList.remove('is-drag', 'taut', 'lift')
    if (left === 0) {
      const hx = home[0] + off[0], hy = home[1] + off[1]
      const near = boatPts.map(([x, y]) => Math.hypot(x - hx, y - hy))
      const i = near.indexOf(Math.min(...near))
      if (near[i] < Math.max(64, V.bw[i] * 0.7)) return dock(i)
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

  // ── the picture (static per size): built in slices the first time, in one go on a resize / theme change
  function* paint() {
    const { W, H, wide, cx, cy, Rx, Ry, wallH, bankH } = V
    const r = rng(2820)
    const horizon = cy - Ry * (wide ? 0.98 : 0.92)
    const sky: SVGElement[] = [
      s('defs', null, s('linearGradient', { id: 't28m-lk', x1: 0, x2: 0, y1: f1(horizon), y2: f1(H), gradientUnits: 'userSpaceOnUse' },
        s('stop', { offset: 0, class: 't28m-lk0' }), s('stop', { offset: 0.35, class: 't28m-lk1' }), s('stop', { offset: 1, class: 't28m-lk2' }))),
      s('rect', { class: 't28m-lake', x: -10, y: f1(horizon), width: f1(W + 20), height: f1(H - horizon + 10), fill: 'url(#t28m-lk)' }),
      mist(W * 0.5, horizon - H * 0.03, W * 0.7, H * 0.12),
      hills(-W * 0.05, W * 1.05, horizon + 2, H * (wide ? 0.16 : 0.1), 2821, 0.9, Math.max(3, Math.round(W / 260))),
      hills(-W * 0.05, W * 0.45, horizon + 3, H * (wide ? 0.08 : 0.07), 2822, 0.62, 2),
      mist(W * 0.5, horizon + 2, W * 0.66, H * 0.03),
      moon(W * (wide ? 0.86 : 0.83), horizon - Math.max(14, Math.min(W, H) * 0.032) * 0.7, Math.max(14, Math.min(W, H) * 0.032), 2829, true),
    ]
    // the lake: dry ripples, longer toward the viewer; the moon's broken road under it
    const mx = W * (wide ? 0.86 : 0.83)
    let rip = '', road = ''
    for (let i = 0; i < (wide ? 160 : 80); i++) {
      const y = horizon + 4 + Math.pow(r(), 0.8) * (H - horizon)
      const x = r() * W, near = (y - horizon) / (H - horizon)
      const len = W * (0.006 + near * 0.03) * (0.5 + r())
      rip += stroke([[x - len, y], [x + len, y + (r() - 0.5)]], 0.6 + near * 1.6, 0.4, 0.4, 0.1)
    }
    for (let i = 0; i < (wide ? 70 : 40); i++) {
      const y = horizon + 3 + r() * (H - horizon), near = (y - horizon) / (H - horizon)
      const x = mx + (r() - 0.5) * W * (0.02 + near * 0.08)
      const len = W * (0.004 + near * 0.02) * (0.5 + r())
      road += stroke([[x - len, y], [x + len, y]], 0.8 + near * 2, 0.4, 0.4, 0.1)
    }
    sky.push(s('path', { class: 't28m-ripple', d: rip }), s('path', { class: 't28m-road', d: road }))
    // the near shore: reeds cut by the frame's bottom corners (the right one only on a wide frame: the words go left)
    const reedH = H * (wide ? 0.2 : 0.16)
    const near = s('g', { class: 't28m-near' }, reeds(W * 0.97, H + 6, reedH, 2831, 9), reeds(W * 0.9, H + 10, reedH * 0.7, 2832, 6),
      ...(wide ? [] : [reeds(W * 0.04, H + 6, reedH * 0.9, 2833, 8)]))
    stage.replaceChildren(...sky)
    yield

    // ── the village bank: its outer face toward us, its top (earth and moss), canals cut through it at each boat
    const ring = (rr: number, z: number, a0 = 0, a1 = 360, n = 72): Pt[] => Array.from({ length: n + 1 }, (_, i) => at(rr, a0 + ((a1 - a0) * i) / n, z))
    const face = (rr: number, z0: number, z1: number, a0: number, a1: number) => `${line(ring(rr, z1, a0, a1, 36))}L${ring(rr, z0, a0, a1, 36).reverse().map(P).join('L')}Z`
    const bank: SVGElement[] = [
      s('path', { class: 't28m-bank-face', d: face(RB, -1, bankH, 0, 180) }),
      s('path', { class: 't28m-bank', d: `${line(ring(RB, bankH))}Z`, filter: 'url(#ink-rough)' }),
      s('path', { class: 't28m-bank-rim', d: stroke(ring(RB, bankH, 190, 350, 30), Math.max(1.2, Rx * 0.003), 0.2, 0.2, 0.2) }),
    ]
    // moss and grass patches on the bank
    let moss = ''
    for (let i = 0; i < (wide ? 60 : 36); i++) {
      const [x, y] = at(RM + 0.02 + r() * (RB - RM - 0.04), r() * 360, bankH)
      moss += blob(x, y, Rx * (0.012 + r() * 0.02), Ry * (0.008 + r() * 0.012), 3000 + i, 0.2, 8)
    }
    bank.push(s('path', { class: 't28m-moss', d: moss }))
    // canals: water channels through the bank where each boat waits, stone edges, a lamp post each side of the mouth
    for (const a of V.ang) {
      const hwA = wide ? 3.2 : 4.2
      const q = [at(RM - 0.01, a - hwA, 0), at(RB + 0.02, a - hwA * 0.85, 0), at(RB + 0.02, a + hwA * 0.85, 0), at(RM - 0.01, a + hwA, 0)]
      bank.push(s('path', { class: 't28m-canal', d: `${line(q)}Z` }),
        s('path', { class: 't28m-canal-edge', d: stroke([at(RM, a - hwA, bankH), at(RB, a - hwA * 0.85, bankH)], 1.2, 0.1, 0.1, 0.5) + stroke([at(RM, a + hwA, bankH), at(RB, a + hwA * 0.85, bankH)], 1.2, 0.1, 0.1, 0.5) }))
    }
    stage.append(...bank)
    yield

    // ── village houses and trees on the bank (far half now, near half after the moat), none in the tied house's sector
    const huts: { y: number; el: SVGElement }[] = []
    const hs = Rx * (wide ? 0.04 : 0.05)
    const clear = (a: number, w: number) => V.ang.every((b) => Math.abs(((a - b + 540) % 360) - 180) > w) && Math.abs(((a - V.th + 540) % 360) - 180) > (wide ? 46 : 70)
    for (let i = 0; i < (wide ? 30 : 20); i++) {
      const a = (i / (wide ? 30 : 20)) * 360 + r() * 6
      if (!clear(a, 9)) continue
      const rr = RM + 0.05 + (i % 2) * 0.05 + r() * 0.02
      const [x, y] = at(rr, a, bankH)
      const sz = hs * (0.75 + r() * 0.35) * (0.8 + 0.2 * Math.sin(rad(a))) // nearer ones a little larger
      const lit = r() < 0.45
      const w2 = sz * 0.6, wh = sz * 0.45, rh = sz * 0.42
      const el = s('g', { class: 't28m-hut' },
        s('ellipse', { class: 't28m-sh', cx: f1(x + w2 * 0.3), cy: f1(y + 1), rx: f1(w2 * 1.3), ry: f1(wh * 0.3) }),
        s('path', { class: 'gb-plaster', d: `M${P([x - w2, y])}L${P([x + w2, y])}L${P([x + w2, y - wh])}L${P([x - w2, y - wh])}Z` }),
        s('path', { class: 't28m-wallsh', d: `M${P([x + w2 * 0.25, y])}L${P([x + w2, y])}L${P([x + w2, y - wh])}L${P([x + w2 * 0.25, y - wh])}Z` }),
        lit ? s('path', { class: 't28m-lit', d: `M${P([x - w2 * 0.6, y - wh * 0.75])}h${f1(w2 * 0.45)}v${f1(wh * 0.4)}h${f1(-w2 * 0.45)}Z` }) : null,
        s('path', { class: 't28m-roof', d: `M${P([x - w2 * 1.35, y - wh + 1])}L${P([x + w2 * 1.35, y - wh + 1])}L${P([x + w2 * 0.7, y - wh - rh])}L${P([x - w2 * 0.7, y - wh - rh])}Z` }),
        s('path', { class: 't28m-rim', d: stroke([[x - w2 * 0.7, y - wh - rh], [x + w2 * 0.7, y - wh - rh]], 1.1, 0.2, 0.2, 0.2) }))
      huts.push({ y, el })
    }
    for (let i = 0; i < (wide ? 26 : 16); i++) {
      const a = r() * 360
      if (!clear(a, 8)) continue
      const [x, y] = at(RM + 0.04 + r() * (RB - RM - 0.07), a, bankH)
      const tr = hs * (0.35 + r() * 0.3)
      huts.push({ y, el: s('g', { class: 't28m-tree' },
        s('ellipse', { class: 't28m-sh', cx: f1(x + tr * 0.5), cy: f1(y + 1), rx: f1(tr * 1.1), ry: f1(tr * 0.35) }),
        s('path', { class: 't28m-trunk', d: stroke([[x, y], [x, y - tr * 1.1]], Math.max(1, tr * 0.18), 0.05, 0.1, 0.6) }),
        s('path', { class: 't28m-crown', d: blob(x, y - tr * 1.5, tr, tr * 0.85, 3100 + i, 0.15, 12) }),
        s('path', { class: 't28m-crown-hi', d: blob(x + tr * 0.25, y - tr * 1.75, tr * 0.5, tr * 0.35, 3200 + i, 0.2, 8) })) })
    }
    huts.sort((a, b) => a.y - b.y)
    stage.append(...huts.filter((u) => u.y < cy).map((u) => u.el))
    yield

    // ── the moat: dark water inside the bank, the bank's inner wall showing on the far side, its own ripples
    let mrip = ''
    for (let i = 0; i < (wide ? 50 : 30); i++) {
      const rr = RI + 0.03 + r() * (RM - RI - 0.05), a = r() * 360
      const [x, y] = at(rr, a, 0)
      const len = Rx * (0.008 + r() * 0.016)
      mrip += stroke([[x - len, y], [x + len, y + (r() - 0.5)]], 0.8 + r() * 0.8, 0.4, 0.4, 0.1)
    }
    stage.append(
      s('path', { class: 't28m-moat', d: `${line(ring(RM, 0))}Z` }),
      s('path', { class: 't28m-bank-in', d: face(RM, 0, bankH, 180, 360) }),
      s('path', { class: 't28m-ripple', d: mrip }))

    // ── bamboo bridges on piers across the moat (bank → island wall), each with its reflection; far ones before the island
    const span = (a: number) => {
      const p0 = at(RM - 0.005, a, bankH), p1 = at(RI + 0.005, a, wallH)
      const mid = at((RM + RI) / 2, a, 0)
      const top: Pt = [mid[0], (p0[1] + p1[1]) / 2 - V.deck * 0.15]
      const pts = [...curve(p0, [(p0[0] + top[0]) / 2, (p0[1] + top[1]) / 2], top, 5), ...curve(top, [(top[0] + p1[0]) / 2, (top[1] + p1[1]) / 2], p1, 5).slice(1)]
      const zOf = (p: Pt) => clamp((mid[1] - p[1]), 0, wallH * 2)
      const w = (wide ? 4.2 : 3.2) * (0.85 + 0.25 * Math.sin(rad(a)))
      return s('g', { class: 't28m-span' },
        s('path', { class: 't28m-br-refl', d: stroke(pts.map((p) => [p[0], p[1] + zOf(p) * 2] as Pt), w * 0.8, 0.1, 0.1, 0.4) }),
        s('path', { class: 't28m-br-post', d: stroke([[mid[0], mid[1] + 1], [top[0], top[1]]], Math.max(1.6, w * 0.5), 0.05, 0.05, 0.7) }),
        s('path', { class: 't28m-br-deck', d: stroke(pts, w, 0.06, 0.06, 0.5) }),
        s('path', { class: 't28m-br-rail', d: stroke(pts.map(([x, y]) => [x, y - w * 0.9] as Pt), 0.9, 0.2, 0.2, 0.3) }))
    }
    const N = 16
    // none across a canal, none in the tied house's fan, none over the words in front of the island
    const spanAngles = Array.from({ length: N }, (_, i) => ((i + 0.5) / N) * 360).filter((a) => V.ang.every((b) => Math.abs(((a - b + 540) % 360) - 180) > 10) && Math.abs(((a - V.th + 540) % 360) - 180) > V.fan * 2 + 14 && Math.abs(a - 90) > 26)
    stage.append(...spanAngles.filter((a) => Math.sin(rad(a)) < 0).map(span))
    yield

    // ── the island: a stone wall in courses (moonlit on its far lip), moss, a gravel court, the keep's plinth
    let courses = ''
    for (let k = 1; k < 4; k++) courses += stroke(ring(RI, (wallH * k) / 4, 5, 175, 30), Math.max(0.7, Rx * 0.0016), 0.3, 0.3, 0.3)
    for (let i = 0; i < 26; i++) {
      const a = 8 + i * 6.4, z = (wallH * ((i % 3) + 0.5)) / 4
      const [x, y] = at(RI, a, z)
      courses += stroke([[x, y - wallH / 8], [x, y + wallH / 8]], 0.8, 0.2, 0.2, 0.3)
    }
    let gravel = ''
    for (let i = 0; i < 22; i++) {
      const [x, y] = at(Math.sqrt(r()) * (RI - 0.03), r() * 360, wallH)
      gravel += blob(x, y, Rx * (0.008 + r() * 0.014), Ry * (0.006 + r() * 0.01), 3300 + i, 0.2, 8)
    }
    const bwK = Rx * RI * (wide ? 1.25 : 1.3)
    const cuX = cx - (wide ? 0 : Rx * RI * 0.22) // a phone's tied bridges land on the wall's right front: CUDA moves left of them
    stage.append(
      s('path', { class: 't28m-wall', d: face(RI, 0, wallH, 0, 180), filter: 'url(#ink-rough)' }),
      s('path', { class: 't28m-wall-sh', d: face(RI, 0, wallH, 0, 60) }),
      s('path', { class: 't28m-course', d: courses }),
      s('path', { class: 't28m-isle', d: `${line(ring(RI, wallH))}Z` }),
      s('path', { class: 't28m-moss', d: gravel }),
      s('path', { class: 't28m-isle-rim', d: stroke(ring(RI, wallH, 190, 350, 24), Math.max(1.2, Rx * 0.003), 0.2, 0.2, 0.2) }),
      pine(...at(RI * 0.78, 200, wallH), bwK * 0.4, 2826, -1),
      castle(...at(0.02, 270, wallH), bwK, 2827),
      pine(...at(RI * 0.8, 340, wallH), bwK * 0.34, 2828, 1),
      // CUDA, cut into the island wall's front: the moat the keep stands in
      s('text', { class: 't28m-carve-lo', x: f1(cuX), y: f1(cy + RI * Ry - wallH * 0.28 + 1), 'text-anchor': 'middle', 'font-size': f1(clamp(wallH * 0.62, 12, 20)) }, cudaName),
      s('text', { class: 't28m-carve', x: f1(cuX), y: f1(cy + RI * Ry - wallH * 0.28), 'text-anchor': 'middle', 'font-size': f1(clamp(wallH * 0.62, 12, 20)) }, cudaName))
    stage.append(...spanAngles.filter((a) => Math.sin(rad(a)) >= 0).map(span))
    stage.append(...huts.filter((u) => u.y >= cy).map((u) => u.el), near)
  }

  let job: { cancel(): void } | null = null
  let painted = ''
  function layout() {
    const W = ctx.art.clientWidth
    const H = stableH(ctx.art.clientHeight)
    if (W < 60 || H < 60) return
    root.style.height = `${f1(H)}px`
    const wide = W / H > 1.15
    const Rx = wide ? Math.min(W * 0.46, H * 0.92) : W * 0.8
    const Ry = Rx * (wide ? 0.46 : 0.6)
    // wide: boats at 9–10 o'clock and on the right (the one to reach, at the right third); tall: three in front of the bank
    const ang = wide ? [205, 28, 163] : [112, 70, 90]
    const rr = wide ? [0.86, 0.9, 0.92] : [1.25, 1.25, 1.62]
    V = {
      W, H, wide, cx: W * 0.5, cy: H * (wide ? 0.53 : 0.33), Rx, Ry,
      wallH: Rx * (wide ? 0.055 : 0.06), bankH: Rx * 0.018, deck: Rx * (wide ? 0.035 : 0.04),
      hw: wide ? clamp(Rx * 0.13, 56, 72) : 54, fan: 12, bw: wide ? [104, 136, 104] : [74, 88, 74], th: wide ? -12 : 0, ang, rr,
    }
    root.classList.toggle('wide', wide)
    stage.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    rig.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    // the boats float at their berths (waterline at 50/70 of the art box)
    boatPts = boats.map((b, i) => {
      const [x, y] = at(rr[i], ang[i], 0)
      const bw = V.bw[i]
      Object.assign(b.style, { left: `${f1(x - bw / 2)}px`, top: `${f1(y - (bw * 50) / 84)}px`, width: `${f1(bw)}px` })
      return [x - bw * 0.05, y - bw * 0.06] as Pt
    })
    // a name too close to a side runs from that side inward (the two front boats on a phone)
    tags.forEach((t, i) => {
      const [x, y] = at(rr[i], ang[i], 0)
      const ty = y + V.bw[i] * 0.2
      t.style.transform = x + 80 > W ? `translate(${f1(W - 8)}px, ${f1(ty)}px) translate(-100%, 0)`
        : x - 80 < 0 ? `translate(8px, ${f1(ty)}px)` : `translate(${f1(x)}px, ${f1(ty)}px) translate(-50%, 0)`
    })
    // the house on the bank, its bridges' wall ends fanned on the island; the piers mid-moat spread so their 44 px
    // targets never overlap (audit v3: vùng chạm ≥ 44 px), checked in screen px
    home = at(RM + 0.035, V.th, V.bankH)
    let fan = 12 // degrees between the tied bridges
    const tryFan = (d: number) => [-2, -1, 0, 1, 2].map((k) => at((RM + RI) / 2, V.th + k * d, 0))
    for (; fan < 40; fan += 2) {
      const p = tryFan(fan)
      if (p.every((a, i) => p.every((b, j) => i === j || Math.hypot(a[0] - b[0], a[1] - b[1]) >= 48))) break
    }
    piers = tryFan(fan)
    V.fan = fan
    anchors = [-2, -1, 0, 1, 2].map((k) => at(RI + 0.005, V.th + k * fan * 0.92, V.wallH))
    house.style.width = `${f1(V.hw)}px`
    cuts.forEach((b, k) => (b.style.transform = `translate(${f1(piers[k][0])}px, ${f1(piers[k][1] - V.deck * 0.5)}px)`))
    if (docked >= 0) off = [boatPts[docked][0] - home[0], boatPts[docked][1] - home[1]]
    drawBridges()
    // the way to the boat: a dotted wake on the water from the house's landing to the boat's side
    const [bx, by] = at(rr[TARGET], ang[TARGET], 0)
    const mid: Pt = [(home[0] + bx) / 2, (home[1] + by) / 2 + (wide ? 26 : 10)]
    wake.setAttribute('d', `M${P([home[0] + V.hw * 0.4, home[1] + 6])}Q${P(mid)} ${P([bx - V.bw[TARGET] * 0.38, by + 2])}`)
    // CUDA explained, on the water: wide, the moat in front of the island (no bridge crosses there); tall, one line on
    // the lake just in front of the bank (the moat is too narrow there)
    const [qx, qy] = wide ? at((RI + RM) / 2 + 0.03, 90, 0) : at(RB + 0.15, 90, 0)
    Object.assign(cudaSub.style, { left: `${f1(qx)}px`, top: `${f1(qy)}px`, width: wide ? `${f1(Rx * 0.64)}px` : 'auto' })
    cudaSub.classList.toggle('one', !wide)
    // the count lies on the lake just past the bank, beside the house it holds
    count ??= g.count(G.countTpl, CUTS, () => (V.wide ? at(RB + 0.12, 0, 0) : [Math.min(V.W - 66, at(RB + 0.2, -60, 0)[0]), at(RB + 0.2, -60, 0)[1]] as Pt), { n: left })
    g.refresh()
    const key = `${W}|${H}|${document.documentElement.dataset.theme}`
    if (key === painted) return
    const first = !painted
    painted = key
    job?.cancel()
    job = sliced(paint(), { sync: ctx.reduced || !first })
  }
  ctx.onCleanup(onSize(ctx.art, layout))
  ctx.onCleanup(() => job?.cancel())
}
