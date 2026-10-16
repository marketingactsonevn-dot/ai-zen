import { h, s } from '../../core/dom'
import { L } from '../../core/content'
import { blob, clamp, curve, onSize, p2Defs, rng, stableHeight, stroke, type Pt } from '../../ui/part2/ink'
import { findTakeaway, takeaway } from '../../ui/part2/takeaway'
import type { SceneCtx } from '../types'
import C from '../../content/tram-27.json'
import { F, f1, lin, rad } from './ink27'

const K = C.scenes.flatter
const TILT = 55 // the camera looks down at the tray at 55°

/** The tray's lacquer top (tray px): black rim, red-black floor, gold maki-e grasses and a crescent, a breath of gloss. */
function trayTop(w: number, d: number): SVGElement[] {
  const r = rng(2720)
  const b = Math.min(w, d) * 0.07
  let grass = ''
  for (let i = 0; i < 9; i++) {
    const x = b * 2.2 + i * w * 0.018 + r() * 6, y = d - b * 1.6
    const hh = d * (0.18 + r() * 0.16), lean = (r() - 0.3) * hh * 0.5
    grass += stroke(curve([x, y], [x + lean * 0.3, y - hh * 0.6], [x + lean, y - hh], 10), 1.6 + r() * 1.2, 0.05, 0.75, 0.1)
  }
  let dew = ''
  for (let i = 0; i < 26; i++) dew += blob(b * 2 + r() * w * 0.2, d - b * 1.6 - r() * d * 0.32, 0.8 + r() * 1.6, 0.8 + r() * 1.4, i, 0.2, 6)
  const cx = w - b * 3.4, cy = b * 3.2, cr = Math.min(w, d) * 0.07
  const crescent = `M${f1(cx)} ${f1(cy - cr)}A${f1(cr)} ${f1(cr)} 0 1 1 ${f1(cx)} ${f1(cy + cr)}A${f1(cr * 0.78)} ${f1(cr * 0.88)} 0 1 0 ${f1(cx)} ${f1(cy - cr)}Z`
  return [
    s('defs', null,
      rad('t27g-floor', [[0, '--t27-lac-hi', 1], [0.7, '--t27-lac', 1], [1, '--t27-lac-lo', 1]], { cx: w * 0.45, cy: d * 0.35, r: w * 0.7 }),
      lin('t27g-gloss', 0, 0, 1, 1, [[0, '--moon', 0], [0.42, '--moon', 0], [0.5, '--moon', 0.16], [0.58, '--moon', 0], [1, '--moon', 0]])),
    s('rect', { class: 't27g-rim', x: 0, y: 0, width: f1(w), height: f1(d), rx: f1(b * 0.9) }),
    s('rect', { x: f1(b), y: f1(b), width: f1(w - b * 2), height: f1(d - b * 2), rx: f1(b * 0.5), fill: 'url(#t27g-floor)' }),
    s('rect', { class: 't27g-inner', x: f1(b), y: f1(b), width: f1(w - b * 2), height: f1(d - b * 2), rx: f1(b * 0.5) }),
    s('path', { class: 't27g-makie', d: grass + dew }),
    s('path', { class: 't27g-makie t27g-moon', d: crescent }),
    s('rect', { x: f1(b), y: f1(b), width: f1(w - b * 2), height: f1(d - b * 2), rx: f1(b * 0.5), fill: 'url(#t27g-gloss)' }),
    s('path', { class: 't27g-rimhi', d: stroke([[b * 1.2, 1.4], [w - b * 1.2, 1.4]], 1.6, 0.1, 0.1, 0.3) + stroke([[w - 1.4, b * 1.2], [w - 1.4, d - b * 1.2]], 1.4, 0.1, 0.1, 0.3) }),
  ]
}

/**
 * Tatami round the tray (floor px): mats laid long side across, each a woven field of igusa rows (a pattern, so one fill)
 * with a dark cloth border (heri) on both long edges, a little warmer or cooler mat to mat.
 */
function tatami(w: number, d: number, mat: number): SVGElement[] {
  const r = rng(2725)
  const mw = mat, md = mat * 0.5
  const tone = ['', '', '']
  let heri = '', heriLine = ''
  const rows = Math.ceil(d / md) + 1
  for (let j = 0; j < rows; j++) {
    const y0 = j * md - md * 0.4, off = (j % 2) * mw * 0.5
    for (let x0 = -off; x0 < w; x0 += mw) {
      tone[Math.floor(r() * 3)] += `M${f1(x0)} ${f1(y0)}h${f1(mw)}v${f1(md)}h${f1(-mw)}Z`
      const hb = md * 0.042
      heri += `M${f1(x0)} ${f1(y0)}h${f1(mw)}v${f1(hb)}h${f1(-mw)}Z` + `M${f1(x0)} ${f1(y0 + md - hb)}h${f1(mw)}v${f1(hb)}h${f1(-mw)}Z`
      heriLine += `M${f1(x0)} ${f1(y0 + hb * 0.5)}h${f1(mw)}M${f1(x0)} ${f1(y0 + md - hb * 0.5)}h${f1(mw)}`
    }
  }
  return [
    s('defs', null, s('pattern', { id: 't27g-igusa', width: 6, height: 6, patternUnits: 'userSpaceOnUse' },
      s('rect', { class: 't27g-igusa-a', width: 2.2, height: 6 }), s('rect', { class: 't27g-igusa-b', x: 3, width: 1.6, height: 6 }))),
    s('rect', { class: 't27g-mat', width: f1(w), height: f1(d) }),
    s('path', { class: 't27g-mat-warm', d: tone[0] }),
    s('path', { class: 't27g-mat-cool', d: tone[1] }),
    s('rect', { class: 't27g-weave', width: f1(w), height: f1(d), fill: 'url(#t27g-igusa)' }),
    s('path', { class: 't27g-heri', d: heri }),
    s('path', { class: 't27g-heri-line', d: heriLine }),
  ]
}

/** A beveled metal rim (disc px): a broad ring lit on its upper right, dark on its lower left, a fine inner lip. */
function bevel(i: number, c: number, R: number): SVGElement[] {
  return [
    s('circle', { class: 't27g-bevel', cx: c, cy: c, r: R * 0.955, fill: 'none', stroke: `url(#t27g-bev${i})`, 'stroke-width': f1(R * 0.09) }),
    s('circle', { class: 't27g-bevel-in', cx: c, cy: c, r: R * 0.905, fill: 'none' }),
    s('circle', { class: 't27g-bevel-out', cx: c, cy: c, r: R * 0.995, fill: 'none' }),
  ]
}
const bevelDefs = (i: number) => lin(`t27g-bev${i}`, 0.85, 0.1, 0.15, 0.9, i
  ? [[0, '--t27-bronze-hi', 1], [0.45, '--t27-bronze', 1], [1, '--t27-bronze-lo', 1]]
  : [[0, '--t27-gold-hi', 1], [0.45, '--t27-gold', 1], [1, '--t27-gold-lo', 1]])

/** The back of a mirror (disc px): a gilded rim with a chrysanthemum in relief, or plain bronze with green patina and a knob. */
function mirrorBack(i: number, D: number): SVGElement[] {
  const c = D / 2, R = D / 2
  if (i === 0) {
    let petals = ''
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2
      const tip: Pt = [c + Math.cos(a) * R * 0.62, c + Math.sin(a) * R * 0.62]
      petals += `M${f1(c)} ${f1(c)}Q${f1(c + Math.cos(a - 0.2) * R * 0.4)} ${f1(c + Math.sin(a - 0.2) * R * 0.4)} ${f1(tip[0])} ${f1(tip[1])}Q${f1(c + Math.cos(a + 0.2) * R * 0.4)} ${f1(c + Math.sin(a + 0.2) * R * 0.4)} ${f1(c)} ${f1(c)}Z`
    }
    let bead = ''
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * Math.PI * 2
      bead += blob(c + Math.cos(a) * R * 0.8, c + Math.sin(a) * R * 0.8, R * 0.03, R * 0.03, k, 0.1, 8)
    }
    return [
      s('defs', null, bevelDefs(0)),
      s('circle', { class: 't27g-gold', cx: c, cy: c, r: R }),
      s('circle', { class: 't27g-gold-in', cx: c, cy: c, r: R * 0.86 }),
      s('path', { class: 't27g-gold-hi', d: petals }),
      s('path', { class: 't27g-gold-hi', d: bead }),
      s('circle', { class: 't27g-gold', cx: c, cy: c, r: R * 0.12 }),
      ...bevel(0, c, R),
      s('path', { class: 't27g-shine', d: stroke(Array.from({ length: 12 }, (_, k) => [c + Math.cos(-2.6 + k * 0.1) * R * 0.95, c + Math.sin(-2.6 + k * 0.1) * R * 0.95] as Pt), R * 0.04, 0.3, 0.3, 0.1) }),
    ]
  }
  let pat = ''
  const r = rng(2726)
  for (let k = 0; k < 7; k++) pat += blob(c + (r() - 0.5) * R * 1.3, c + (r() - 0.5) * R * 1.3, R * (0.06 + r() * 0.1), R * (0.04 + r() * 0.08), 2727 + k, 0.35, 10)
  return [
    s('defs', null, bevelDefs(1), s('clipPath', { id: 't27g-bclip' }, s('circle', { cx: c, cy: c, r: R * 0.9 }))),
    s('circle', { class: 't27g-bronze', cx: c, cy: c, r: R }),
    s('circle', { class: 't27g-bronze-in', cx: c, cy: c, r: R * 0.9 }),
    s('path', { class: 't27g-patina', d: pat, filter: 'url(#ink-wash)', 'clip-path': 'url(#t27g-bclip)' }),
    s('circle', { class: 't27g-bronze', cx: c, cy: c, r: R * 0.14 }),
    s('circle', { class: 't27g-knob', cx: c - R * 0.03, cy: c - R * 0.03, r: R * 0.06 }),
    ...bevel(1, c, R),
    s('path', { class: 't27g-shine', d: stroke(Array.from({ length: 12 }, (_, k) => [c + Math.cos(-2.6 + k * 0.1) * R * 0.955, c + Math.sin(-2.6 + k * 0.1) * R * 0.955] as Pt), R * 0.03, 0.3, 0.3, 0.1) }),
  ]
}

/** The glass (disc px): a polished face, the night in it, a moon streak across, a dark vignette to its rim, the beveled rim. */
function mirrorFace(i: number, D: number): SVGElement[] {
  const c = D / 2, R = D / 2
  const id = `t27g-f${i}`
  return [
    s('defs', null,
      rad(`${id}-g`, i ? [[0, '--t27-glass-hi', 1], [0.55, '--t27-glass', 1], [1, '--t27-glass-lo', 1]] : [[0, '--t27-gglass-hi', 1], [0.55, '--t27-gglass', 1], [1, '--t27-gglass-lo', 1]], { cx: D * 0.4, cy: D * 0.34, r: D * 0.66 }),
      lin(`${id}-st`, 0, 0, 1, 0, [[0, '--moon', 0], [0.42, '--moon', 0.16], [0.5, '--moon', 0.42], [0.58, '--moon', 0.16], [1, '--moon', 0]]),
      rad(`${id}-v`, [[0, '--umbra', 0], [0.72, '--umbra', 0], [1, '--umbra', 0.7]], { cx: c, cy: c, r: R * 0.92 }),
      s('clipPath', { id: `${id}-c` }, s('circle', { cx: c, cy: c, r: R * 0.91 })),
      bevelDefs(i)),
    s('circle', { cx: c, cy: c, r: R * 0.92, fill: `url(#${id}-g)` }),
    s('g', { 'clip-path': `url(#${id}-c)` },
      s('rect', { class: 't27g-streak', x: f1(c - R * 0.34), y: f1(-R * 0.4), width: f1(R * 0.68), height: f1(D * 1.4), fill: `url(#${id}-st)`, transform: `rotate(38 ${f1(c)} ${f1(c)})` }),
      s('rect', { class: 't27g-streak t27g-streak2', x: f1(c + R * 0.42), y: f1(-R * 0.4), width: f1(R * 0.16), height: f1(D * 1.4), fill: `url(#${id}-st)`, transform: `rotate(38 ${f1(c)} ${f1(c)})` }),
      s('circle', { cx: c, cy: c, r: R * 0.92, fill: `url(#${id}-v)` })),
    ...bevel(i, c, R),
  ]
}

/** Scene 3 — two hand mirrors face down on a lacquer tray: lift one and turn it over to hear its answer. */
export function flatterScene(ctx: SceneCtx) {
  p2Defs()
  const calm = ctx.quality === 'low'
  const M = [K.gilded, K.bronze]
  const seen = [false, false]
  const up = [0, 0]
  let done = false
  const card = findTakeaway(K.takeaway)
  const live = h('p', { class: 'visually-hidden', 'aria-live': 'polite' })

  const floor = s('svg', { class: 't27g-tatami', 'aria-hidden': 'true' })
  const top = s('svg', { class: 't27g-top', 'aria-hidden': 'true' })
  const walls = ['front', 'left', 'right'].map((w) => h('i', { class: `t27g-wall t27g-wall-${w}` }))
  const shadows = M.map((_, i) => h('i', { class: `t27g-msh t27g-msh${i}` }))
  const slip = h('div', { class: 't27g-slip' }, h('p', null, K.question))
  const takeBtn = h('button', { class: 't27g-take', type: 'button', onClick: open }, K.takeawayLabel)
  const fold = h('div', { class: 't27g-fold' }, takeBtn, h('p', { class: 't27g-see' }, K.seeAlso))
  const mirrors = M.map((m, i) => {
    const back = s('svg', { class: 't27g-back', 'aria-hidden': 'true' })
    const faceSvg = s('svg', { class: 't27g-facesvg', 'aria-hidden': 'true' })
    const front = h('div', { class: 't27g-front' }, faceSvg,
      h('div', { class: 't27g-refl', 'aria-hidden': 'true' }, h('p', null, K.question)),
      h('p', { class: 't27g-ans' }, m.answer),
      h('i', { class: 't27g-sweep', 'aria-hidden': 'true' }))
    const rims = [0, 1, 2, 3, 4].map((k) => h('i', { class: 't27g-ring', style: `--k:${k}` }))
    const handle = h('i', { class: 't27g-handle' }, h('i', { class: 't27g-cord' }))
    const el = h('button', { class: `t27g-m t27g-m${i}`, type: 'button', 'aria-label': m.aria, 'aria-pressed': 'false' },
      handle, ...rims, h('div', { class: 't27g-disc' }, back), front)
    return { el, back, faceSvg, front }
  })
  const beam = s('svg', { class: 't27g-beam', 'aria-hidden': 'true' })
  const tray = h('div', { class: 't27g-tray' }, ...walls, h('div', { class: 't27g-topwrap' }, top), ...shadows, fold, slip, ...mirrors.map((m) => m.el))
  const plane = h('div', { class: 't27g-plane' }, floor, beam, tray)
  const view = h('div', { class: 't27g-view' }, plane)
  const note = h('div', { class: 't27g-note' }, ctx.fact(F(K.note), 'p', 't27g-notep'))
  const close = h('button', { class: 't27g-close', type: 'button', onClick: shut }, L.close)
  const sheet = h('div', { class: 't27g-sheet', hidden: true, role: 'dialog', 'aria-label': K.takeawayLabel }, close, card ? takeaway(card, null, ctx.onCleanup) : null)
  const root = h('div', { class: `t27g${calm ? ' is-calm' : ''}` }, h('p', { class: 'visually-hidden' }, K.art), view, live, sheet)
  // the honesty note sits outside the faded edge of the scene, on the mat below the tray
  ctx.art.append(root, note)
  ctx.prompt(K.prompt)
  const stable = stableHeight(ctx, [F(K.insight)])

  // ── layout: sizes as CSS variables; the plane is laid at 55° under a near camera ──
  // The tray lies on the far half of the plane, so the plane's pivot line (screen depth z = 0) runs along its front edge:
  // a lifted mirror is brought to stand upright at exactly that depth, so it shows at its own CSS size (crisp text,
  // never a magnified raster), and it stands in front of the whole tray.
  const C55 = Math.cos((TILT * Math.PI) / 180), S55 = Math.sin((TILT * Math.PI) / 180)
  const RX = ((TILT - 3) * Math.PI) / 180 // the mirror turns up by 52°: 3° short of facing you square
  let G = { W: 0, H: 0, Dt: 0, D: 0, td: 0, lift: [[0, 0, 0], [0, 0, 0]] as [number, number, number][] }
  function layout() {
    const W = root.clientWidth, Hr = root.clientHeight
    if (W < 60 || Hr < 60) return
    const H = stable(Hr)
    const land = W / H > 1.05
    const tw = land ? Math.min(W * 0.7, H * 1.6, 1000) : W * 0.96
    const td = tw * (land ? 0.5 : 0.62)
    const th = Math.max(10, tw * 0.025)
    const Dt = tw * (land ? 0.27 : 0.4) // a mirror lying on the tray
    const D = land ? Math.min(H * 0.6, tw * 0.42, 400) : Math.min(W * 0.7, H * 0.5) // the same mirror held up to you
    const ty = -td * 0.55
    const pw = Math.max(W, tw) * 2.4, pd = td * 4.4
    const persp = land ? Math.max(1100, H * 1.9) : Math.max(900, H * 1.7)
    const k = H * (land ? 0.3 : 0.26) // the eye stands this far above the pivot line
    // where a point of the plane (Y down the plane from the pivot, Z up from it) lands on screen, relative to the pivot
    const proj = (Y: number, Z: number) => {
      const ys = Y * C55 - Z * S55, zs = Y * S55 + Z * C55
      return -k + (ys + k) * (persp / (persp - zs))
    }
    // frame the tray in the middle of the art; once both mirrors are seen the camera pans up to make room for the insight
    const mid = (proj(ty - td / 2, th) + proj(ty + td / 2, th)) / 2
    const cy = Hr / 2 - mid
    const pan = Math.min(0, (H - Hr) / 2)
    root.style.setProperty('--pan', `${f1(pan)}px`)
    Object.assign(view.style, { perspective: `${f1(persp)}px`, perspectiveOrigin: `50% ${f1(cy - k)}px` })
    Object.assign(plane.style, { width: `${f1(pw)}px`, height: `${f1(pd)}px`, left: `${f1(W / 2 - pw / 2)}px`, top: `${f1(cy - pd / 2)}px` })
    const vars: [string, number][] = [['tw', tw], ['td', td], ['th', th], ['D', D], ['Dt', Dt], ['ty', ty], ['pw', pw], ['pd', pd]]
    for (const [n, v] of vars) root.style.setProperty(`--${n}`, `${f1(v)}px`)
    floor.setAttribute('viewBox', `0 0 ${f1(pw)} ${f1(pd)}`)
    floor.replaceChildren(...tatami(pw, pd, tw * 0.62))
    top.setAttribute('viewBox', `0 0 ${f1(tw)} ${f1(td)}`)
    top.replaceChildren(...trayTop(tw, td))
    // the moonbeam: in through a lattice at the upper right, laid across the tray (plane px, with the floor)
    const bx = pw / 2 + tw * 0.14, by = pd / 2 + ty - td * 0.8, bw = tw * 0.28, len = td * 1.32, sk = tw * 0.3
    let bars = ''
    for (let j = 1; j < 4; j++) bars += `M${f1(bx + (bw * j) / 4)} ${f1(by)}l${f1(-sk)} ${f1(len)}`
    for (let j = 1; j < 6; j++) bars += `M${f1(bx - (sk * j) / 6)} ${f1(by + (len * j) / 6)}h${f1(bw)}`
    const beamD = `M${f1(bx)} ${f1(by)}h${f1(bw)}l${f1(-sk)} ${f1(len)}h${f1(-bw)}Z`
    beam.setAttribute('viewBox', `0 0 ${f1(pw)} ${f1(pd)}`)
    beam.replaceChildren(
      s('defs', null, lin('t27g-beamG', 0, by, 0, by + len, [[0, '--moon', 0.0], [0.22, '--moon', 1], [0.7, '--moon', 0.85], [1, '--moon', 0]], true),
        s('clipPath', { id: 't27g-beamC' }, s('path', { d: beamD }))),
      s('path', { class: 't27g-beamlight', d: beamD, fill: 'url(#t27g-beamG)' }),
      s('path', { class: 't27g-beamcore', d: `M${f1(bx + bw * 0.2)} ${f1(by)}h${f1(bw * 0.6)}l${f1(-sk)} ${f1(len)}h${f1(-bw * 0.6)}Z`, fill: 'url(#t27g-beamG)' }),
      s('path', { class: 't27g-lattice', d: bars, 'clip-path': 'url(#t27g-beamC)', style: `stroke-width:${f1(bw * 0.045)}px` }))
    mirrors.forEach((m, i) => {
      m.back.setAttribute('viewBox', `0 0 ${f1(D)} ${f1(D)}`)
      m.back.replaceChildren(...mirrorBack(i, D))
      m.faceSvg.setAttribute('viewBox', `0 0 ${f1(D)} ${f1(D)}`)
      m.faceSvg.replaceChildren(...mirrorFace(i, D))
    })
    // the held pose (tray px, before the mirror's own turn): its disc centre comes to (xS, yS) from the pivot on screen at z = 0
    const mx = land ? [0.27, 0.73] : [0.26, 0.74]
    const Oy = td * 0.1 + 1.42 * Dt // the handle's end, which stays put as the mirror turns up
    const vy = -0.92 * D * Math.cos(RX), vz = 0.92 * D * Math.sin(RX)
    const yS = Math.max(D / 2 + 6 - pan, Hr / 2 - D * (land ? 0.45 : 0.55)) - cy
    G = {
      W, H, Dt, D, td,
      lift: mx.map((x, i) => {
        const xS = land ? (i ? -0.1 : 0.1) * tw : 0 // the bronze one held a little left, clear of the card where it lay
        return [xS - tw * x + tw / 2, yS * C55 - Oy - vy + td / 2 - ty, -yS * S55 - th - 2 - vz] as [number, number, number]
      }),
    }
    mirrors.forEach((_, i) => pose(i, up[i]))
  }
  ctx.onCleanup(onSize(root, layout))

  // ── a mirror's pose for lift t (0 face down on the tray … 1 turned over and held up, facing you, at its full size) ──
  function pose(i: number, t: number) {
    const [dx, dy, dz] = G.lift[i]
    const e = t * t * (3 - 2 * t)
    const sc = G.Dt / (G.D || 1) + (1 - G.Dt / (G.D || 1)) * e
    mirrors[i].el.style.transform = `translateZ(calc(var(--th) + 2px)) translate3d(${f1(dx * e)}px,${f1(dy * e)}px,${f1(dz * e)}px) rotateX(${f1((-RX * 180 * e) / Math.PI)}deg) rotateY(${f1(180 * e)}deg) scale3d(${sc.toFixed(4)},${sc.toFixed(4)},${sc.toFixed(4)})`
    shadows[i].style.transform = `translateZ(calc(var(--th) + 0.8px)) translate3d(${f1(dx * e * 0.25)}px,${f1(-G.td * 0.05 * e)}px,0) scale(${(1 - e * 0.4).toFixed(3)})`
    shadows[i].style.opacity = (0.6 - e * 0.45).toFixed(3)
  }
  function setUp(i: number, v: number) {
    up[i] = v
    mirrors[i].el.setAttribute('aria-pressed', String(v === 1))
    root.dataset.up = up[1] === 1 ? 'bronze' : up[0] === 1 ? 'gilded' : ''
    if (calm) {
      // quality=low: the mirror fades out, changes pose, fades back (no 3D swing)
      mirrors[i].el.animate([{ opacity: 1 }, { opacity: 0, offset: 0.45 }, { opacity: 0, offset: 0.55 }, { opacity: 1 }], { duration: 420 })
      window.setTimeout(() => pose(i, v), 190)
    } else pose(i, v)
    if (v === 1) {
      if (!calm && !ctx.reduced) mirrors[i].front.querySelector('.t27g-sweep')!.animate([{ transform: 'translateX(-130%) rotate(18deg)', opacity: 0 }, { opacity: 1, offset: 0.4 }, { transform: 'translateX(130%) rotate(18deg)', opacity: 0 }], { duration: 900, delay: 320, easing: 'ease-in-out' })
      saw(i)
    }
  }
  function toggle(i: number) {
    const v = up[i] === 1 ? 0 : 1
    if (v === 1 && up[1 - i] === 1) setUp(1 - i, 0)
    setUp(i, v)
  }
  function saw(i: number) {
    live.textContent = `${M[i].label}: ${M[i].answer}`
    ctx.chime('soft')
    if (seen[i]) return
    seen[i] = true
    if (!done && seen.every(Boolean)) {
      done = true
      root.classList.add('done')
      note.classList.add('on')
      window.setTimeout(() => {
        ctx.chime('ok')
        ctx.insight(F(K.insight), F(K.detail))
      }, ctx.reduced ? 0 : 900)
    }
  }

  // ── drag a handle upward to lift (the mirror follows the hand), or tap / Enter to turn it over ──
  mirrors.forEach((m, i) => {
    m.el.addEventListener('click', (e) => e.detail === 0 && toggle(i))
    m.el.addEventListener('pointerdown', (e) => {
      if (e.button) return
      const y0 = e.clientY, t0 = up[i]
      let t = t0, moved = false
      m.el.setPointerCapture(e.pointerId)
      const move = (ev: PointerEvent) => {
        if (!moved && Math.abs(ev.clientY - y0) < 6) return
        if (!moved && up[1 - i] === 1) setUp(1 - i, 0)
        moved = true
        root.classList.add('drag')
        t = clamp(t0 + (y0 - ev.clientY) / Math.max(120, G.H * 0.32), 0, 1)
        if (!calm) pose(i, t)
      }
      const end = () => {
        m.el.removeEventListener('pointermove', move)
        m.el.removeEventListener('pointerup', end)
        m.el.removeEventListener('pointercancel', end)
        root.classList.remove('drag')
        if (!moved) return toggle(i)
        setUp(i, t > (t0 ? 0.6 : 0.35) ? 1 : 0)
      }
      m.el.addEventListener('pointermove', move)
      m.el.addEventListener('pointerup', end)
      m.el.addEventListener('pointercancel', end)
    })
  })

  const esc = (e: KeyboardEvent) => e.key === 'Escape' && !sheet.hidden && shut()
  addEventListener('keydown', esc)
  ctx.onCleanup(() => removeEventListener('keydown', esc))
  function open() {
    sheet.hidden = false
    close.focus()
  }
  function shut() {
    sheet.hidden = true
    takeBtn.focus()
  }
}
