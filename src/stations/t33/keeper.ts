import raw from '../../content/tram-33.json'
import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { sliced } from '../../core/chunk'
import { blob, clamp, curve, onSize, rng, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist, moon, pine, reeds, water } from '../../ui/part2/paint'
import { guide, type Mark } from '../../ui/part2/guide'
import type { SceneCtx } from '../types'
import './keeper.css'
import { f1, live, P, parallax, reedClump, t33Defs } from './kit'

const K = raw.scenes.keeper
const rect = (x: number, y: number, w: number, hh: number) => `M${f1(x)} ${f1(y)}h${f1(w)}v${f1(hh)}h${f1(-w)}Z`
const poly = (...p: Pt[]) => `M${p.map(P).join('L')}Z`
/** 22:00 → 07:00 */
const clock = (t: number) => {
  const m = Math.round((22 * 60 + t * 9 * 60) / 10) * 10
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
const HOURS = 10 // 22:00 … 07:00, one star per hour along the moon's road
/** the coding agent in the study finishes its job a little before 23:00, then rests */
const DONE = 0.1

/** The gardener, walking (viewBox -20 -46 40 50, feet on y = 0): straw hat, robe, the lantern held out on a pole, the notebook under his arm. */
function gardener() {
  return s('g', { class: 't33k-man' },
    s('ellipse', { class: 't33k-foot', cx: 0, cy: 0, rx: 9, ry: 2 }),
    s('path', { class: 't33k-robe', d: 'M-6 0Q-7 -14 -4 -26Q0 -29 4 -26Q7 -14 6 0Z', filter: 'url(#ink-wash)' }),
    s('path', { class: 't33k-ink', d: stroke(curve([-4, -26], [-7.5, -14], [-6, 0], 8), 2, 0.1, 0.2, 0.3) + stroke([[-6.5, 0], [6, 0]], 1.4, 0.1, 0.1, 0.4) + stroke(curve([3, -24], [8, -21], [12, -24], 6), 2, 0.1, 0.4, 0.4), filter: 'url(#ink-rough)' }),
    s('path', { class: 't33k-book', d: 'M-6 -21l6 -1.2 1.2 7 -6 1.2Z' }),
    s('circle', { class: 't33k-head', cx: 0, cy: -30, r: 3 }),
    s('path', { class: 't33k-hat', d: 'M-9 -30Q0 -40 9 -30Q0 -32.5 -9 -30Z', filter: 'url(#ink-rough)' }),
    s('path', { class: 't33k-ink', d: stroke([[11, -24], [17, -30]], 1, 0.1, 0.1, 0.5) }),
    s('path', { class: 't33k-rim', d: stroke(curve([-5.5, -3], [-6.6, -14], [-3.6, -24], 6), 1, 0.2, 0.3, 0.1) }),
    s('ellipse', { class: 't33k-lamp', cx: 17.5, cy: -26, rx: 2.6, ry: 3.4 }))
}

/** A folded paper crane (viewBox -24 -16 48 32). */
const crane = () => s('svg', { class: 't33k-crane', viewBox: '-24 -16 48 32', 'aria-hidden': 'true' },
  s('path', { class: 't33k-cranep', d: 'M-22 -2L-4 2L0 -14L4 2L22 -6L8 6L2 4L-2 6L-14 4Z' }),
  s('path', { class: 't33k-craneink', d: 'M-22 -2L-4 2L0 -14L4 2L22 -6M-4 2L-2 6M4 2L2 4' }))

/**
 * The study (the coding agent's room), standing on the sand at (x, y) w wide: a stone footing, three shōji between four
 * posts on a wall plate, a thick thatched hip roof whose eave rests on that plate (no gap), a side wall going back to the
 * right, the coder's shadow on the middle paper while it works, the warm light it throws on the sand.
 */
function studyArt(x: number, y: number, w: number, seed: number): SVGElement[] {
  const r = rng(seed)
  const fh = w * 0.075, wh = w * 0.42, bh = w * 0.045
  const x0 = x - w / 2, x1 = x + w / 2
  const yF = y - fh, yW = yF - wh, yB = yW - bh // footing top, wall top, beam top
  const sx = w * 0.2, sy = -w * 0.07 // the side wall runs back to the right
  const ov = w * 0.15, eh = w * 0.1, rh = w * 0.4
  const post = w * 0.036
  // footing, front and side
  const foot = rect(x0 - w * 0.02, yF, w * 1.04, fh) + poly([x1 + w * 0.02, yF], [x1 + w * 0.02 + sx, yF + sy], [x1 + w * 0.02 + sx, y + sy], [x1 + w * 0.02, y])
  let seams = ''
  for (let i = 1; i < 7; i++) seams += stroke([[x0 + (w * i) / 7 + (r() - 0.5) * 4, yF + 1], [x0 + (w * i) / 7 + (r() - 0.5) * 4, y]], 1.1, 0.1, 0.1, 0.5)
  seams += stroke([[x0 - w * 0.02, yF + fh * 0.5], [x1 + w * 0.02, yF + fh * 0.48]], 1, 0.1, 0.1, 0.4)
  // walls: the front's three paper panels, the side's plaster
  const side = poly([x1, yW], [x1 + sx, yW + sy], [x1 + sx, yF + sy], [x1, yF])
  const panels: string[] = []
  for (let i = 0; i < 3; i++) panels.push(rect(x0 + post + (i * (w - post)) / 3, yW, (w - post) / 3 - post, wh * 0.82))
  let lat = ''
  for (let i = 0; i < 3; i++) {
    const px = x0 + post + (i * (w - post)) / 3, pw = (w - post) / 3 - post
    for (let k = 1; k < 3; k++) lat += stroke([[px + (pw * k) / 3, yW], [px + (pw * k) / 3, yW + wh * 0.82]], 0.9, 0.02, 0.02, 0.6)
    for (let k = 1; k < 5; k++) lat += stroke([[px, yW + (wh * 0.82 * k) / 5], [px + pw, yW + (wh * 0.82 * k) / 5]], 0.9, 0.02, 0.02, 0.6)
  }
  let posts = ''
  for (let i = 0; i <= 3; i++) posts += rect(x0 + (i * (w - post)) / 3, yW, post, wh)
  posts += poly([x1 + sx - post * 0.6, yW + sy], [x1 + sx, yW + sy], [x1 + sx, yF + sy], [x1 + sx - post * 0.6, yF + sy])
  const wains = rect(x0, yW + wh * 0.82, w, wh * 0.18)
  // the coder at the desk: a seated shadow on the middle paper, the desk lamp's bright spot beside it
  const mx = x0 + post + (w - post) / 3 + ((w - post) / 3 - post) * 0.42
  const coder = blob(mx, yW + wh * 0.58, w * 0.05, wh * 0.2, seed + 1, 0.12, 12) + blob(mx + w * 0.006, yW + wh * 0.33, w * 0.028, w * 0.03, seed + 2, 0.08, 10) + rect(mx - w * 0.07, yW + wh * 0.66, w * 0.17, wh * 0.035)
  // wall plate across the post tops, running round the corner
  const beam = rect(x0 - w * 0.03, yB, w * 1.06, bh) + poly([x1 + w * 0.03, yB], [x1 + sx + w * 0.02, yB + sy], [x1 + sx + w * 0.02, yW + sy], [x1 + w * 0.03, yW])
  // the hip roof: its eave's underside sits on the plate; a thick thatch edge; slopes up to a short ridge
  const e0: Pt = [x0 - ov, yB], e1: Pt = [x1 + ov + sx, yB + sy]
  const eave = poly([e0[0], e0[1] - eh], [x1 + ov, yB - eh], [e1[0], e1[1] - eh], e1, [x1 + ov, yB], e0)
  const rT0: Pt = [x - w * 0.18, yB - eh - rh], rT1: Pt = [x + w * 0.24 + sx * 0.6, yB - eh - rh + sy * 0.6]
  const roof = poly([e0[0] + w * 0.02, e0[1] - eh], rT0, rT1, [e1[0] - w * 0.02, e1[1] - eh], [x1 + ov, yB - eh])
  const hip = poly([x1 + ov, yB - eh], rT1, [e1[0] - w * 0.02, e1[1] - eh])
  let straw = ''
  for (let i = 0; i < 70; i++) {
    const u = r(), bx = e0[0] + (x1 + ov - e0[0]) * u
    straw += stroke([[bx, yB - eh * (0.1 + r() * 0.2)], [bx + (r() - 0.5) * 2, yB - eh * (0.75 + r() * 0.2)]], 0.7 + r() * 0.6, 0.1, 0.3, 0.1)
  }
  for (let i = 0; i < 40; i++) {
    const u = r(), v = r()
    const ax = e0[0] + w * 0.04 + (x1 + ov - e0[0] - w * 0.08) * u, bx = rT0[0] + (rT1[0] - rT0[0]) * u
    const px = ax + (bx - ax) * v, py = yB - eh + (rT0[1] - (yB - eh)) * v
    straw += stroke([[px, py], [px + (bx - ax) * 0.08, py - rh * 0.1]], 0.6 + r() * 0.5, 0.2, 0.3, 0.1)
  }
  const ridge = rect(rT0[0] - w * 0.03, rT0[1] - w * 0.045, rT1[0] - rT0[0] + w * 0.06, w * 0.05)
  // the step stone at the door, the window light lying on the sand
  const stepStone = blob(x - w * 0.12, y + w * 0.06, w * 0.13, w * 0.03, seed + 3, 0.15, 12)
  const spill = poly([x0 + post, y + 2], [x1 - post, y + 2], [x1 + w * 0.25, y + w * 0.3], [x0 - w * 0.25, y + w * 0.3])
  return [
    s('path', { class: 't33k-scast', d: blob(x - w * 0.25, y + w * 0.06, w * 0.75, w * 0.07, seed + 4, 0.15, 16), filter: 'url(#ink-wash)' }),
    s('path', { class: 't33k-sspill', d: spill, filter: 'url(#ink-wash)' }),
    s('circle', { class: 't33k-studyglow', cx: f1(x), cy: f1(yW + wh * 0.5), r: f1(w * 0.95) }),
    s('path', { class: 't33k-sfoot', d: foot, filter: 'url(#ink-rough)' }),
    s('path', { class: 't33k-ink', d: seams }),
    s('path', { class: 't33k-sside', d: side }),
    s('path', { class: 't33k-swin', d: panels.join('') }),
    s('path', { class: 't33k-swinlit', d: panels.join('') }),
    s('path', { class: 't33k-sman', d: coder }),
    s('path', { class: 't33k-slat', d: lat }),
    s('path', { class: 't33k-swains', d: wains }),
    s('path', { class: 't33k-spost', d: posts, filter: 'url(#ink-rough)' }),
    s('path', { class: 't33k-sbeam', d: beam, filter: 'url(#ink-rough)' }),
    s('path', { class: 't33k-seaveu', d: poly([e0[0], e0[1]], [x1 + ov, yB], [e1[0], e1[1]], [x1 + sx, yW + sy], [x1, yW], [x0, yW]) }),
    s('path', { class: 't33k-sroof', d: roof, filter: 'url(#ink-wash)' }),
    s('path', { class: 't33k-ship', d: hip }),
    s('path', { class: 't33k-seave', d: eave, filter: 'url(#ink-rough)' }),
    s('path', { class: 't33k-thatch', d: straw }),
    s('path', { class: 't33k-sridge', d: ridge, filter: 'url(#ink-rough)' }),
    s('path', { class: 't33k-rim', d: stroke([[e0[0] + 2, e0[1] - eh + 1], rT0], Math.max(1.2, w * 0.008), 0.1, 0.3, 0.2) + stroke([[rT0[0], rT0[1] - w * 0.044], [rT1[0], rT1[1] - w * 0.044]], Math.max(1, w * 0.006), 0.1, 0.3, 0.2) }),
    s('path', { class: 't33k-brock', d: stepStone, filter: 'url(#ink-rough)' }),
  ]
}

/** Scene 1 — one night with the resident gardener: ring the chime to send the message, drag the moon to the morning, read the two kinds. */
export function keeperScene(ctx: SceneCtx) {
  t33Defs()
  const low = ctx.quality === 'low'
  const quick = low || ctx.reduced
  let t = 0
  let sent = false, dawn = false

  // ── layers: sky (fixed), far hills, a far pine and mist, the porch, pond and study, near reeds
  const sky = s('svg', { class: 't33-night t33k-sky', 'aria-hidden': 'true' })
  const far = h('div', { class: 't33k-layer t33-fade' }, s('svg', { class: 't33k-svg', 'aria-hidden': 'true' }))
  const mid = h('div', { class: 't33k-layer t33-fade' }, s('svg', { class: 't33k-svg', 'aria-hidden': 'true' }))
  const main = h('div', { class: 't33k-layer t33-fade' }, s('svg', { class: 't33k-svg', 'aria-hidden': 'true' }))
  const near = h('div', { class: 't33k-layer t33k-near t33-fade' }, s('svg', { class: 't33k-svg', 'aria-hidden': 'true' }))
  const svgOf = (l: HTMLElement) => l.firstElementChild as SVGSVGElement

  // live pieces (moved by the clock, kept across layouts)
  const man = gardener()
  const pool = s('ellipse', { class: 't33k-pool' })
  const glint = s('ellipse', { class: 't33k-glint' })
  const mroad = s('path', { class: 't33k-mroad' })
  const mroadG = s('g', { class: 't33k-mroadg' }, mroad)
  const steps = s('path', { class: 't33k-steps', pathLength: 1 })
  const stepMask = s('path', { class: 't33k-stepmask', pathLength: 1 })
  const dawnSky = s('g', { class: 't33k-dawn' }, s('rect', { class: 't33k-dawnband', x: 0, y: 0, width: '100%', height: '100%' }), s('rect', { class: 't33k-dawnglow', x: 0, y: 0, width: '100%', height: '100%' }))
  const moonArt = s('g', { class: 't33k-moonart' })
  const moonG = s('g', { class: 't33k-moon' }, moonArt)
  const ticks = Array.from({ length: HOURS }, () => s('g', { class: 't33k-tick' }))
  const study = s('g', { class: 't33k-study' })
  const chimeG = s('g', { class: 't33k-chime' })
  const bookG = s('g', { class: 't33k-bookg' })

  // ── HTML: the moon slider and its hour, the chime and the message slip under it, the gardener, the study, the words, the reply
  const moonBtn = h('div', { class: 't33k-moonbtn', role: 'slider', tabindex: '0', 'aria-label': K.moonAria, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0', 'aria-valuetext': clock(0) })
  const hour = h('span', { class: 't33k-hour', 'aria-hidden': 'true' }, clock(0))
  const endHour = h('span', { class: 't33k-hour t33k-endhour', 'aria-hidden': 'true' }, clock(1))
  const chimeBtn = h('button', { class: 't33k-hit t33k-chimebtn', type: 'button', 'aria-label': K.sendAria })
  const manBtn = h('button', { class: 't33k-hit t33k-manbtn', type: 'button', 'aria-label': fill(K.kindAria, { name: K.kinds[0].name }) })
  const studyBtn = h('button', { class: 't33k-hit t33k-studybtn', type: 'button', 'aria-label': fill(K.kindAria, { name: K.kinds[1].name }) })
  // the message is written on the chime's paper strip; ringing the chime sends it (the strip folds into a crane)
  const slip = h('div', { class: 't33k-slip t33-paper' }, h('p', { class: 't33k-msg' }, K.message))
  const words = live('t33k-words')
  const skyText = h('div', { class: 't33k-skytext' }, words)
  const reply = h('p', { class: 't33k-reply t33-ink', hidden: true }, K.reply)
  const flyer = h('div', { class: 't33k-flyer', 'aria-hidden': 'true' }, crane())
  main.append(slip, chimeBtn, manBtn, studyBtn, reply)
  const root = h('div', { class: `t33 t33k coding${low ? ' low' : ''}`, role: 'group', 'aria-label': K.aria },
    sky, far, mid, main, near, endHour, hour, moonBtn, skyText, flyer,
    h('p', { class: 'visually-hidden' }, K.art))
  ctx.art.append(root)
  ctx.prompt(K.prompt)
  const px = parallax(ctx, root, [[far, 0.15], [mid, 0.35], [main, 0.62], [near, 1.15]], 12)

  // ── geometry, recomputed per layout
  const G = { W: 0, H: 0, A: 0, arc: { cx: 0, cy: 0, rx: 0, ry: 0 }, pond: { cx: 0, cy: 0, rx: 0, ry: 0 }, path: { rx: 0, ry: 0 }, man: 1, mobile: false, a0: 0, a1: 0, m0: Math.PI * 0.72, chime: [0, 0] as Pt, mr: 14 }
  /** the moon's road: from upper left (22:00, clear of the roof) over the top to the right (07:00, above the study) */
  const moonAt = (u: number): Pt => {
    const a = G.a0 + (G.a1 - G.a0) * u
    return [G.arc.cx + G.arc.rx * Math.cos(a), G.arc.cy - G.arc.ry * Math.sin(a)]
  }
  /** the gardener's place on his round: 2½ laps over the night, starting at the near left */
  const manAt = (u: number): [number, number, number] => {
    const a = G.m0 + u * Math.PI * 5
    const x = G.pond.cx + G.path.rx * Math.cos(a), y = G.pond.cy + G.path.ry * Math.sin(a)
    return [x, y, Math.sin(a)]
  }

  let job: { cancel(): void } | null = null
  let first = true
  function layout() {
    const W = root.clientWidth, H = root.clientHeight
    if (!W || !H) return
    // a phone stacks the picture (house, pond, study) over the words: the picture keeps the top ~80%
    const mobile = W < 640
    const A = mobile ? H * 0.8 : H
    // a phone starts him at the front of the pond (the message strip hangs over its near left)
    Object.assign(G, { W, H, A, mobile, m0: Math.PI * (mobile ? 0.48 : 0.72) })
    root.style.setProperty('--art', `${f1(A)}px`)
    G.arc = mobile ? { cx: W * 0.52, cy: A * 0.6, rx: W * 0.42, ry: A * 0.52 } : { cx: W * 0.54, cy: H * 0.64, rx: W * 0.4, ry: H * 0.56 }
    G.a0 = ((mobile ? 122 : 128) * Math.PI) / 180
    // it sets low by the dawn on a desk (right of the study), high over the study on a phone
    G.a1 = ((mobile ? 55 : 20) * Math.PI) / 180
    const hz = mobile ? A * 0.52 : H * 0.5
    // the camera is low and close: the pond and its keeper fill the lower frame
    G.pond = mobile ? { cx: W * 0.56, cy: A * 0.8, rx: W * 0.34, ry: A * 0.075 } : { cx: W * 0.53, cy: H * 0.79, rx: W * 0.27, ry: H * 0.09 }
    G.path = { rx: G.pond.rx + (mobile ? W * 0.05 : W * 0.04), ry: G.pond.ry + (mobile ? A * 0.05 : H * 0.048) }
    G.man = mobile ? A / 240 : H / 240
    G.mr = Math.max(13, Math.min(W, A) * 0.036)
    const all = [sky, ...[far, mid, main, near].map(svgOf)]
    for (const g of all) g.setAttribute('viewBox', `0 0 ${W} ${H}`)

    function* draw() {
      // the sky: dawn rising from the right, the moon's road (a faint wash) with a star for each hour, the moon
      const pts: Pt[] = Array.from({ length: 49 }, (_, i) => moonAt(i / 48))
      const r0 = Math.max(1.6, Math.min(W, H) * 0.0032)
      ticks.forEach((g, i) => {
        const [x, y] = moonAt(i / (HOURS - 1))
        const r = r0 * (i % 3 ? 1 : 1.35)
        g.replaceChildren(
          s('circle', { class: 't33k-tickhalo', cx: f1(x), cy: f1(y), r: f1(r * 5) }),
          s('path', { class: 't33k-star', d: `M${f1(x)} ${f1(y - r * 2.4)}Q${f1(x + r * 0.3)} ${f1(y - r * 0.3)} ${f1(x + r * 2.4)} ${f1(y)}Q${f1(x + r * 0.3)} ${f1(y + r * 0.3)} ${f1(x)} ${f1(y + r * 2.4)}Q${f1(x - r * 0.3)} ${f1(y + r * 0.3)} ${f1(x - r * 2.4)} ${f1(y)}Q${f1(x - r * 0.3)} ${f1(y - r * 0.3)} ${f1(x)} ${f1(y - r * 2.4)}Z` }))
      })
      sky.replaceChildren(
        dawnSky,
        s('path', { class: 't33k-arc', d: stroke(pts, Math.max(1.4, Math.min(W, H) * 0.0024), 0.2, 0.25, 0.15) }),
        ...ticks,
        moonG)
      moonArt.replaceChildren(moon(0, 0, G.mr, 3302, true))
      const [ex, ey0] = moonAt(1)
      endHour.style.transform = `translate(${f1(ex)}px, ${f1(ey0 - G.mr - 22)}px)`
      yield
      // far: ranges and mist
      svgOf(far).replaceChildren(
        mist(W * 0.5, hz - A * 0.1, W * 0.6, A * 0.2),
        hills(-W * 0.05, W * 1.05, hz, A * 0.2, 3303, 0.92, 7),
        hills(W * 0.35, W * 1.05, hz + A * 0.02, A * 0.12, 3304, 0.7, 3),
        mist(W * 0.5, hz + A * 0.01, W * 0.62, A * 0.05))
      yield
      // mid: a pine on the far bank behind the study, and the low mist the study stands in front of
      const sx = mobile ? W * 0.78 : W * 0.74, sy = mobile ? hz + A * 0.1 : hz + H * 0.1, sw = mobile ? W * 0.3 : W * 0.15
      svgOf(mid).replaceChildren(
        mist(W * 0.7, sy - sw * 0.05, W * 0.4, A * 0.035),
        mobile ? pine(sx + sw * 0.55, sy - sw * 0.05, sw * 1.3, 3319, -1) : pine(sx - sw * 0.62, sy - sw * 0.04, sw * 1.12, 3319, 1))
      study.replaceChildren(...studyArt(sx, sy, sw, 3320))
      studyBtn.style.cssText = `left:${f1(sx - sw * 0.72)}px;top:${f1(sy - sw * 1.05)}px;width:${f1(sw * 1.5)}px;height:${f1(sw * 1.1)}px`
      yield
      // main: sand, the raked rings round the pond, the pond, the house and its porch, the gardener
      const { cx, cy, rx, ry } = G.pond
      let rows = ''
      const rr = rng(3325)
      for (let y = hz + A * 0.02; y < H; y += 3 + (y - hz) * 0.05) {
        const p: Pt[] = []
        const amp = 0.4 + (y - hz) * 0.006
        for (let i = 0; i <= 20; i++) p.push([(W * i) / 20, y + Math.sin(i * 0.7 + y * 0.09) * amp])
        rows += `M${p.map(P).join('L')}`
      }
      // rings: the rake's tines wander, the spacing breathes, two rings break where the gardener's path crosses
      let rings = ''
      let gap = 0
      for (let k = 1; k <= 7; k++) {
        gap += W * (0.008 + rr() * 0.006)
        rings += blob(cx + (rr() - 0.5) * 4, cy, rx + gap, ry + gap * (A / W) * 0.95, 3305 + k, 0.035 + rr() * 0.03, 30)
      }
      const pond = blob(cx, cy, rx, ry, 3306, 0.05, 26)
      // the path his steps make: three loops, each a little wider
      let loops = ''
      for (let k = 0; k < 3; k++) {
        const p: Pt[] = []
        for (let i = 0; i <= 64; i++) {
          const a = G.m0 + (i / 64) * Math.PI * 2
          p.push([cx + (G.path.rx + k * 4) * Math.cos(a), cy + (G.path.ry + k * 2) * Math.sin(a)])
        }
        loops += (k ? 'L' : 'M') + p.map(P).join('L')
      }
      steps.setAttribute('d', loops)
      stepMask.setAttribute('d', loops)
      // the moon broken on the water: short dry strokes, longer toward us (moved with the moon in update())
      let road = ''
      for (let i = 0; i < 6; i++) {
        const v = i / 5, len = rx * (0.05 + v * 0.1)
        road += stroke([[-len / 2 + (rr() - 0.5) * 4, -ry * 0.5 + v * ry * 1.25], [len / 2 + (rr() - 0.5) * 4, -ry * 0.5 + v * ry * 1.25]], 1.2 + v * 1.6, 0.3, 0.3, 0.1)
      }
      mroad.setAttribute('d', road)
      // ripples where a leaf fell, near the far bank
      let rip = ''
      for (let k = 0; k < 3; k++) rip += blob(cx + rx * 0.42, cy - ry * 0.25, rx * (0.04 + k * 0.035), ry * (0.1 + k * 0.09), 3330 + k, 0.04, 20)
      // the main house, lights out, cut by the left edge and seen a little from the side: its wall shrinks toward the corner post
      const hx = mobile ? W * 0.25 : W * 0.22, ey = mobile ? A * 0.46 : H * 0.33, fy = mobile ? A * 0.8 : H * 0.66
      const x0 = -W * 0.02, gT = A * 0.07, gB = A * 0.06
      const top = (x: number) => ey - gT * (1 - (x - x0) / (hx - x0)), bot = (x: number) => fy + gB * (1 - (x - x0) / (hx - x0))
      const at = (x: number, f: number): Pt => [x, top(x) + (bot(x) - top(x)) * f]
      const ex0: Pt = [x0, top(x0) - A * 0.06], ex1: Pt = [hx + W * 0.06, ey - A * 0.045]
      const eaveY = (x: number) => ex0[1] + ((ex1[1] - ex0[1]) * (x - x0)) / (ex1[0] - x0)
      const Rh = mobile ? A * 0.2 : H * 0.21
      const roof = `M${P(ex0)}L${P(ex1)}L${f1(hx * 0.55)} ${f1(ey - Rh)}L${f1(x0)} ${f1(ey - Rh - A * 0.04)}Z`
      let thatch = '', rafters = '', lat = '', planks = ''
      const r = rng(3316)
      for (let i = 0; i < 80; i++) {
        const u = r(), x = x0 + (ex1[0] - x0) * u, y0 = ex0[1] + (ex1[1] - ex0[1]) * u
        thatch += stroke([[x, y0 - 2], [x - (ex1[0] - x) * 0.18 * r(), y0 - A * (0.04 + r() * 0.12)]], 0.8 + r() * 0.9, 0.1, 0.4, 0.1)
      }
      for (let x = x0 + 8; x < ex1[0] - 6; x += (hx - x0) / 16) {
        const y = eaveY(x)
        rafters += stroke([[x, y + 2], [x - 1, y + A * 0.018]], 2, 0.05, 0.05, 0.6)
      }
      const cols = 4
      for (let i = 0; i <= cols * 3; i++) {
        const x = x0 + ((hx - x0) * i) / (cols * 3)
        lat += stroke([at(x, 0), at(x, 0.72)], i % 3 ? 0.9 : 2.2, 0.02, 0.02, 0.6)
      }
      for (const f of [0.18, 0.36, 0.54, 0.72]) lat += stroke([at(x0, f), at(hx, f)], f === 0.72 ? 2 : 0.9, 0.02, 0.02, 0.6)
      // one panel slid aside: the dark room where everyone sleeps
      const ox0 = x0 + ((hx - x0) * 2) / cols + 6, ox1 = x0 + ((hx - x0) * 2.55) / cols
      const open = `M${P(at(ox0, 0.02))}L${P(at(ox1, 0.02))}L${P(at(ox1, 0.98))}L${P(at(ox0, 0.98))}Z`
      const vF0: Pt = [x0, bot(x0) + A * 0.08], vF1: Pt = [hx + W * 0.035, fy + A * 0.04]
      const veranda = `M${P([x0, bot(x0)])}L${P([hx + W * 0.01, fy])}L${P(vF1)}L${P(vF0)}Z`
      for (let i = 1; i < 9; i++) {
        const x = x0 + ((hx - x0) * i) / 9
        planks += stroke([[x, bot(x)], [x + (x - x0) * 0.04, vF0[1] + ((vF1[1] - vF0[1]) * (x - x0)) / (vF1[0] - x0)]], 0.8, 0.05, 0.05, 0.5)
      }
      const eH0 = A * 0.034, eH1 = A * 0.026
      const edge = `M${P(vF0)}L${P(vF1)}L${f1(vF1[0])} ${f1(vF1[1] + eH1)}L${f1(vF0[0])} ${f1(vF0[1] + eH0)}Z`
      // the veranda stands on short posts, each on its foot stone
      let stilts = '', feet = ''
      const gy = vF1[1] + A * 0.055
      for (const f of [0.18, 0.55, 0.96]) {
        const x = vF0[0] + (vF1[0] - vF0[0]) * f, yE = vF0[1] + (vF1[1] - vF0[1]) * f + eH0 + (eH1 - eH0) * f
        const yG = gy + (1 - f) * A * 0.04
        stilts += rect(x - W * 0.004, yE - 1, W * 0.008, yG - yE)
        feet += blob(x, yG, W * 0.011, A * 0.007, 3326 + Math.round(f * 10), 0.15, 10)
      }
      // the wind chime under the eave: the channel the messages come in by (it is also a button); its paper strip carries the message
      const cu = (mobile ? A / 420 : H / 560) * 1.45
      const chx = hx + W * (mobile ? 0.02 : 0.026), chy = eaveY(hx + W * (mobile ? 0.02 : 0.026)) + Math.max(3, A * 0.008)
      G.chime = [chx, chy]
      chimeG.setAttribute('style', `transform-origin:${f1(chx)}px ${f1(chy)}px`)
      chimeG.replaceChildren(
        s('path', { class: 't33k-hook', d: stroke(curve([chx - 3 * cu, chy - 2 * cu], [chx + 2 * cu, chy - 3 * cu], [chx, chy + 2 * cu], 6), 1.2 * cu, 0.1, 0.1, 0.5) }),
        s('path', { class: 't33k-thread', d: `M${f1(chx)} ${f1(chy + cu)}V${f1(chy + 16 * cu)}` }),
        s('path', { class: 't33k-glass', d: `M${f1(chx - 11 * cu)} ${f1(chy + 32 * cu)}Q${f1(chx - 11 * cu)} ${f1(chy + 15 * cu)} ${f1(chx)} ${f1(chy + 15 * cu)}Q${f1(chx + 11 * cu)} ${f1(chy + 15 * cu)} ${f1(chx + 11 * cu)} ${f1(chy + 32 * cu)}Z` }),
        s('path', { class: 't33k-glasspaint', d: blob(chx + 3 * cu, chy + 26 * cu, 3 * cu, 2.4 * cu, 3322, 0.2, 8) + blob(chx - 5 * cu, chy + 29 * cu, 2 * cu, 1.6 * cu, 3323, 0.2, 8) }),
        s('path', { class: 't33k-rim', d: stroke(curve([chx - 8.5 * cu, chy + 30 * cu], [chx - 8.5 * cu, chy + 19 * cu], [chx - 1, chy + 17 * cu], 6), 1.3 * cu, 0.2, 0.2, 0.2) }),
        s('path', { class: 't33k-glasslip', d: stroke([[chx - 11 * cu, chy + 32 * cu], [chx + 11 * cu, chy + 32 * cu]], 1.1 * cu, 0.05, 0.05, 0.5) }),
        // the clapper's cord and its vermilion tassel, then the strip's cord
        s('path', { class: 't33k-thread', d: `M${f1(chx)} ${f1(chy + 24 * cu)}V${f1(chy + 42 * cu)}` }),
        s('path', { class: 't33k-tassel', d: stroke([[chx, chy + 40 * cu], [chx - 1.6 * cu, chy + 51 * cu]], 3.4 * cu, 0.3, 0.6, 0.3) + stroke([[chx, chy + 40 * cu], [chx + 1.8 * cu, chy + 50 * cu]], 3 * cu, 0.3, 0.6, 0.3) + stroke([[chx, chy + 40 * cu], [chx, chy + 53 * cu]], 3.6 * cu, 0.3, 0.6, 0.3) }),
        s('path', { class: 't33k-tassel', d: rect(chx - 2.2 * cu, chy + 38 * cu, 4.4 * cu, 3 * cu) }),
        s('path', { class: 't33k-thread', d: `M${f1(chx)} ${f1(chy + 41 * cu)}V${f1(chy + 58 * cu)}` }),
        // once the message has flown, a plain strip is left to catch the wind
        s('path', { class: 't33k-tanzaku', d: rect(chx - 5 * cu, chy + 58 * cu, 10 * cu, 40 * cu) }))
      slip.style.cssText = `left:${f1(chx)}px;top:${f1(chy + 57 * cu)}px;width:${f1(mobile ? 146 : Math.min(186, W * 0.13))}px`
      chimeBtn.style.cssText = `left:${f1(chx - 26)}px;top:${f1(chy)}px;width:52px;height:${f1(Math.max(64, 56 * cu))}px;--dot:${f1(44 * cu)}px`
      // the gardener's notebook on the veranda: its pages grow with each message
      const bx = hx - W * (mobile ? 0.1 : 0.05), by = fy + A * 0.02
      bookG.replaceChildren(
        s('path', { class: 't33k-bookshadow', d: blob(bx + 6, by + 1, 20, 3, 3307, 0.2, 10) }),
        s('g', { class: 't33k-pagesg', style: `transform-origin:${f1(bx)}px ${f1(by)}px` }, s('path', { class: 't33k-pages', d: rect(bx - 16, by - 9, 32, 9) }), s('path', { class: 't33k-ink', d: [2.5, 5, 7.5].map((d) => stroke([[bx - 15, by - d], [bx + 15, by - d]], 0.6, 0.05, 0.05, 0.4)).join('') })),
        s('path', { class: 't33k-cover', d: rect(bx - 17, by - 2, 34, 2.5) + `M${f1(bx - 17)} ${f1(by - 9)}h34v2.2h-34Z` }))
      // stepping stones from the porch step to the gardener's path
      let stones = ''
      const s0: Pt = [hx - W * 0.03, vF1[1] + A * 0.05], s1: Pt = [cx - G.path.rx * 0.78, cy + G.path.ry * 0.55]
      for (let i = 1; i < 4; i++) {
        const u = i / 4, k = 0.8 + u * 0.4
        stones += blob(s0[0] + (s1[0] - s0[0]) * u + (rr() - 0.5) * 10, s0[1] + (s1[1] - s0[1]) * u, W * 0.022 * k, A * 0.011 * k, 3340 + i, 0.18, 12)
      }
      const house = [
        s('path', { class: 't33k-vshadow', d: blob(hx * 0.45, vF1[1] + A * 0.06, hx * 0.8, A * 0.04, 3311, 0.2, 14), filter: 'url(#ink-wash)' }),
        s('path', { class: 't33k-post', d: stilts }),
        s('path', { class: 't33k-brock', d: feet }),
        s('path', { class: 't33k-wall', d: `M${P([x0, top(x0)])}L${P([hx, ey])}L${P([hx, fy])}L${P([x0, bot(x0)])}Z` }),
        s('path', { class: 't33k-room', d: open }),
        s('path', { class: 't33k-lattice', d: lat, filter: 'url(#ink-rough)' }),
        s('path', { class: 't33k-veranda', d: veranda }),
        s('path', { class: 't33k-ink', d: planks }),
        s('path', { class: 't33k-vedge', d: edge, filter: 'url(#ink-rough)' }),
        s('path', { class: 't33k-rim', d: stroke([vF0, vF1], 1.4, 0.05, 0.2, 0.2) }),
        s('path', { class: 't33k-stepstone', d: blob(hx - W * 0.03, vF1[1] + A * 0.05, W * 0.035, A * 0.014, 3317, 0.15, 12), filter: 'url(#ink-rough)' }),
        s('path', { class: 't33k-brock', d: stones, filter: 'url(#ink-rough)' }),
        s('path', { class: 't33k-eaveu', d: `M${P(ex0)}L${P(ex1)}L${P([hx, ey])}L${P([x0, top(x0)])}Z` }),
        s('path', { class: 't33k-ink', d: rafters }),
        s('path', { class: 't33k-roof', d: roof, filter: 'url(#ink-wash)' }),
        s('path', { class: 't33k-thatch', d: thatch }),
        s('path', { class: 't33k-fascia', d: stroke([ex0, ex1], Math.max(4, A * 0.012), 0.02, 0.1, 0.6), filter: 'url(#ink-rough)' }),
        s('path', { class: 't33k-rim', d: stroke([[ex0[0], ex0[1] + 3], [ex1[0], ex1[1] + 3]], 1.4, 0.05, 0.3, 0.2) }),
        s('path', { class: 't33k-post', d: stroke([[hx + 1, vF1[1] + A * 0.01], [hx, eaveY(hx) + 2]], Math.max(6, W * 0.007), 0.02, 0.02, 0.85), filter: 'url(#ink-rough)' }),
        s('path', { class: 't33k-rim', d: stroke([[hx - 2.5, fy], [hx - 3, ey]], 1.2, 0.1, 0.1, 0.2) }),
      ]
      main.style.setProperty('--hz', `${f1(hz)}px`)
      svgOf(main).replaceChildren(
        s('rect', { class: 't33k-sand', x: 0, y: f1(hz - A * 0.02), width: f1(W), height: f1(H - hz + A * 0.02), fill: 'url(#t33k-sandg)' }),
        s('path', { class: 't33k-rake', d: rows }),
        study,
        s('ellipse', { class: 't33k-sand', cx: f1(cx), cy: f1(cy), rx: f1(rx + gap + W * 0.012), ry: f1(ry + gap * (A / W) + A * 0.012) }),
        s('path', { class: 't33k-rake', d: rings }),
        s('defs', null, s('mask', { id: 't33k-trail' }, stepMask)),
        s('g', { mask: 'url(#t33k-trail)' }, steps),
        s('path', { class: 't33k-bank', d: blob(cx, cy + 3, rx + 6, ry + 4, 3306, 0.05, 26), filter: 'url(#ink-wash)' }),
        s('path', { class: 't33k-pond', d: pond }),
        s('defs', null, s('clipPath', { id: 't33k-pondclip' }, s('path', { d: pond }))),
        s('g', { 'clip-path': 'url(#t33k-pondclip)' }, water(cx - rx, cy - ry, cx + rx, cy + ry, 3308, undefined, false),
          s('path', { class: 't33k-ripple', d: rip }),
          mroadG, glint,
          s('path', { class: 't33k-pondlip', d: blob(cx, cy - ry * 0.12, rx * 1.02, ry * 0.95, 3306, 0.05, 26) })),
        ...[[-0.8, 0.55, 1], [0.62, 0.78, 0.85], [0.92, -0.2, 0.65], [-0.35, -0.96, 0.55]].map(([u, v, k], i) => s('g', { class: 't33k-bankrock' },
          s('path', { class: 't33k-bankao', d: blob(cx + rx * u + W * 0.006 * k, cy + ry * v + A * 0.008 * k, W * 0.02 * k, A * 0.008 * k, 3350 + i, 0.2, 10), filter: 'url(#ink-wash)' }),
          s('path', { class: 't33k-brock', d: blob(cx + rx * u, cy + ry * v, W * 0.018 * k, A * 0.014 * k, 3318 + i, 0.25, 12), filter: 'url(#ink-rough)' }),
          s('path', { class: 't33k-rim', d: stroke([[cx + rx * u - W * 0.013 * k, cy + ry * v - A * 0.006 * k], [cx + rx * u + W * 0.004 * k, cy + ry * v - A * 0.012 * k]], 1.3, 0.2, 0.3, 0.2) }))),
        reeds(cx + rx * 0.93, cy + ry * 0.1, A * 0.08, 3309, 6),
        reeds(cx - rx * 0.95, cy - ry * 0.25, A * 0.055, 3310, 4),
        ...house,
        bookG,
        chimeG,
        pool,
        man)
      yield
      // near: a dark bank of moss across the foot of the frame (lower at the middle), reeds and grass cut by the frame
      const bk = (u: number) => A * (mobile ? 0.965 - Math.sin(u * Math.PI) * 0.015 : 0.86 + Math.sin(u * Math.PI) * 0.09) + Math.sin(u * 23) * A * 0.006
      const bankPts: Pt[] = Array.from({ length: 33 }, (_, i) => [(W * (i - 1)) / 30, bk((i - 1) / 30)] as Pt)
      const bank = `M${bankPts.map(P).join('L')}L${f1(W * 1.05)} ${f1(H + 40)}L${f1(-W * 0.05)} ${f1(H + 40)}Z`
      let tufts = ''
      const tr = rng(3327)
      for (let i = 0; i < 26; i++) {
        const u = tr(), x = W * u, y = bk(u) + 2, hh = A * (0.012 + tr() * 0.02)
        for (let k = 0; k < 3; k++) tufts += stroke([[x + k * 2, y], [x + k * 2 + (tr() - 0.5) * hh * 0.8, y - hh * (0.6 + tr() * 0.5)]], 1.2, 0.1, 0.6, 0.1)
      }
      svgOf(near).replaceChildren(
        s('path', { class: 't33k-nbank', d: bank, filter: 'url(#ink-wash)' }),
        s('path', { class: 't33k-nrim', d: stroke(bankPts.slice(2, -2), 1.4, 0.2, 0.3, 0.1) }),
        s('path', { class: 't33k-ntuft', d: tufts }),
        reedClump(W * 0.025, A * 1.01, A * (mobile ? 0.3 : 0.34), 3312, 12, 0.55),
        reedClump(W * 0.975, A * 1.0, A * (mobile ? 0.24 : 0.26), 3313, 10, -0.6),
        grass(W * 0.14, A * 0.995, A * 0.07, 3314),
        grass(W * 0.84, A * 0.995, A * 0.06, 3315))
      update()
    }
    job?.cancel()
    job = sliced(draw(), { sync: ctx.reduced || !first })
    first = false
    px.resize()
  }
  ctx.onCleanup(onSize(root, layout))
  ctx.onCleanup(() => job?.cancel())

  // ── the clock: everything that changes with the night is written here (attributes / transforms only)
  let litTicks = -1
  function update() {
    if (!G.W) return
    const [mx, my] = moonAt(t)
    moonG.setAttribute('transform', `translate(${f1(mx)} ${f1(my)})`)
    moonBtn.style.transform = `translate(${f1(mx - 26)}px, ${f1(my - 26)}px)`
    hour.style.transform = `translate(${f1(mx)}px, ${f1(my - G.mr - 22)}px)`
    const hh = clock(t)
    if (hour.textContent !== hh) hour.textContent = hh
    const n = Math.floor(t * (HOURS - 1) + 0.001)
    if (n !== litTicks) {
      litTicks = n
      ticks.forEach((g, i) => g.classList.toggle('on', i <= n && t > 0))
    }
    root.classList.toggle('near-end', t > 0.86)
    // the moon in the pond, under the moon: broken strokes, fading as the sky pales
    const { cx, cy, rx } = G.pond
    const inPond = Math.abs(mx - cx) < rx * 0.8
    mroadG.setAttribute('transform', `translate(${f1(clamp(mx, cx - rx * 0.8, cx + rx * 0.8))} ${f1(cy)})`)
    mroadG.style.opacity = inPond ? (1 - t * 0.6).toFixed(2) : '0.15'
    // the gardener and his lantern
    const [x, y, depth] = manAt(t)
    const k = G.man * (0.82 + (depth + 1) * 0.14)
    man.setAttribute('transform', `translate(${f1(x)} ${f1(y)}) scale(${(k * (Math.cos(G.m0 + t * Math.PI * 5) > 0 ? -1 : 1)).toFixed(3)} ${k.toFixed(3)})`)
    pool.setAttribute('cx', f1(x + 10 * k))
    pool.setAttribute('cy', f1(y))
    pool.setAttribute('rx', f1(50 * k))
    pool.setAttribute('ry', f1(12 * k))
    // seen across the water: his lantern's streak on the pond
    glint.setAttribute('cx', f1(clamp(x, cx - rx * 0.8, cx + rx * 0.8)))
    glint.setAttribute('cy', f1(cy + G.pond.ry * 0.2))
    glint.setAttribute('rx', f1(3 * k))
    glint.setAttribute('ry', f1(G.pond.ry * 0.55))
    glint.style.opacity = depth < -0.2 ? String(Math.min(1, -depth).toFixed(2)) : '0'
    manBtn.style.cssText = `left:${f1(x - 24 * k)}px;top:${f1(y - 48 * k)}px;width:${f1(Math.max(44, 48 * k))}px;height:${f1(Math.max(44, 54 * k))}px`
    reply.style.transform = `translate(${f1(clamp(x, G.W * 0.3, G.W * 0.7))}px, ${f1(y - 50 * k)}px)`
    // footprints: the round gets longer through the night
    stepMask.style.strokeDashoffset = String((1 - t).toFixed(4))
    dawnSky.style.opacity = smooth(0.62, 1, t).toFixed(3)
    root.style.setProperty('--night', (1 - smooth(0.7, 1, t)).toFixed(3))
    // the coding agent works in its study until its job is done, then rests (its paper goes dark)
    root.classList.toggle('coding', t < DONE)
    moonBtn.setAttribute('aria-valuenow', String(Math.round(t * 100)))
    moonBtn.setAttribute('aria-valuetext', clock(t))
  }

  function setT(v: number) {
    const was = t
    t = clamp(v, 0, 1)
    if (t === was) return
    update()
    root.classList.toggle('walking', t > 0)
    if (t >= 0.999 && !dawn) morning()
  }

  // ── the moon: drag it along its arc (nearest point), or arrows / Home / End
  let dragging = false
  const toT = (e: PointerEvent) => {
    const r = root.getBoundingClientRect()
    const x = e.clientX - r.left, y = e.clientY - r.top
    // the arc is an ellipse about (cx, cy): read the angle of the pointer
    let a = Math.atan2((G.arc.cy - y) / G.arc.ry, (x - G.arc.cx) / G.arc.rx)
    if (a < -Math.PI / 2) a = Math.PI
    return clamp((a - G.a0) / (G.a1 - G.a0), 0, 1)
  }
  moonBtn.addEventListener('pointerdown', (e) => {
    dragging = true
    moonBtn.setPointerCapture(e.pointerId)
    root.classList.add('dragmoon')
  })
  moonBtn.addEventListener('pointermove', (e) => dragging && setT(toT(e)))
  const up = () => {
    dragging = false
    root.classList.remove('dragmoon')
  }
  moonBtn.addEventListener('pointerup', up)
  moonBtn.addEventListener('pointercancel', up)
  moonBtn.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1 / 18, ArrowUp: 1 / 18, ArrowLeft: -1 / 18, ArrowDown: -1 / 18 } as Record<string, number>
    if (e.key in step) setT(t + step[e.key])
    else if (e.key === 'Home') setT(0)
    else if (e.key === 'End') setT(1)
    else return
    e.preventDefault()
  })

  // ── sending: the chime rings, its paper strip folds into a crane that flies to the gardener; he writes it down
  const later = (ms: number, fn: () => void) => {
    const id = setTimeout(fn, quick ? 0 : ms)
    ctx.onCleanup(() => clearTimeout(id))
  }
  function ring() {
    chimeG.classList.remove('rung', 'sway')
    void chimeG.getBoundingClientRect()
    chimeG.classList.add('rung')
    ctx.chime('soft')
  }
  const fly = (a: DOMRect, bx: number, by: number, r: DOMRect, frames: (dx: number, dy: number) => Keyframe[], ms: number) => {
    flyer.style.left = `${f1(a.left - r.left + a.width * 0.5 - 24)}px`
    flyer.style.top = `${f1(a.top - r.top + a.height * 0.3)}px`
    const anim = flyer.animate(frames(bx - (a.left - r.left + a.width * 0.5), by - (a.top - r.top + a.height * 0.3)), { duration: ms, easing: 'cubic-bezier(.45,.05,.25,1)' })
    ctx.onCleanup(() => anim.cancel())
  }
  function send() {
    if (sent) return
    sent = true
    ring()
    const a = slip.getBoundingClientRect(), b = manBtn.getBoundingClientRect(), r = root.getBoundingClientRect()
    root.classList.add('sent')
    if (!quick) fly(a, b.left - r.left + b.width / 2, b.top - r.top + b.height * 0.2, r, (dx, dy) => [
      { transform: 'translate(0,0) scale(0.7) rotate(-6deg)', opacity: 0 },
      { transform: `translate(${f1(dx * 0.3)}px, ${f1(dy * 0.2 - 70)}px) scale(1.15) rotate(-14deg)`, opacity: 1, offset: 0.35 },
      { transform: `translate(${f1(dx)}px, ${f1(dy)}px) scale(0.5) rotate(4deg)`, opacity: 0 },
    ], 1600)
    later(1500, () => {
      root.classList.add('wrote')
      reply.hidden = false
      ctx.chime('tap')
      ctx.prompt(K.promptMoon)
      // H1: the dot leaves the chime for the moon, leaning along its road toward the morning
      dot?.done()
      dot = g.dot(moonBtn, { dir: [1, -0.3] })
      moonBtn.focus({ preventScroll: true })
    })
  }
  chimeBtn.addEventListener('click', () => (sent ? ring() : send()))

  // ── 07:00: dawn, the chime rings by itself (the agent messages you): the crane comes from the gardener toward you and
  // opens into the summary; then the optional third step (the study); the insight follows (or at once on that touch)
  let insightShown = false
  const showInsight = () => {
    if (insightShown) return
    insightShown = true
    ctx.insight(K.insight as Fact, K.detail)
  }
  function morning() {
    dawn = true
    root.classList.add('dawn')
    dot?.done()
    dot = null
    later(400, () => {
      ring()
      reply.hidden = true
      if (!quick) {
        const a = manBtn.getBoundingClientRect(), r = root.getBoundingClientRect(), b = skyText.getBoundingClientRect()
        fly(a, b.left - r.left + b.width / 2, b.top - r.top + 10, r, (dx, dy) => [
          { transform: 'translate(0,0) scale(0.5)', opacity: 0 },
          { transform: `translate(${f1(dx * 0.4)}px, ${f1(dy * 0.5 - 40)}px) scale(1.3) rotate(-10deg)`, opacity: 1, offset: 0.45 },
          { transform: `translate(${f1(dx)}px, ${f1(dy)}px) scale(2.2) rotate(4deg)`, opacity: 0 },
        ], 1400)
      }
      later(1200, () => {
        if (!root.classList.contains('reading')) words.say(h('p', { class: 't33k-summary t33-ink' }, K.morning))
        ctx.prompt(K.promptStudy)
        dot = g.dot(studyBtn, { dir: [0, 1] })
        later(5200, showInsight)
      })
    })
  }

  // ── the two kinds, written in the sky (at most three lines); the examples wait behind ⓘ — tap the gardener, or the study
  function read(i: number, sound = true) {
    const kd = K.kinds[i]
    root.classList.toggle('studying', i === 1)
    const more = h('div', { class: 't33k-more', id: `t33k-more-${i}`, hidden: true },
      ...kd.examples.map((ex) => h('div', { class: 't33k-ex' },
        h('p', { class: 't33k-exn' }, ex.name),
        ctx.fact(ex.fact as Fact, 'p', 't33k-fact'),
        'claim' in ex && ex.claim ? ctx.fact(ex.claim as Fact, 'p', 't33k-fact') : null)))
    const info = h('button', { class: 't33-info', type: 'button', 'aria-expanded': 'false', 'aria-controls': more.id, 'aria-label': fill(K.moreAria, { name: kd.name }) }, 'i')
    info.addEventListener('click', () => {
      more.hidden = !more.hidden
      info.setAttribute('aria-expanded', String(!more.hidden))
      root.classList.toggle('more', !more.hidden)
    })
    root.classList.remove('more')
    words.say(
      h('p', { class: 't33k-kname t33-ink' }, kd.name),
      h('p', { class: 't33k-what t33-ink' }, kd.what, info),
      more)
    root.classList.add('reading')
    if (sound) ctx.chime('tap')
    if (i === 1 && dawn) {
      dot?.done()
      dot = null
      showInsight()
    }
  }
  const g = guide(ctx)
  let dot: Mark | null = g.dot(chimeBtn, { dir: [0, 1] })
  manBtn.addEventListener('click', () => read(0))
  studyBtn.addEventListener('click', () => read(1))

  // H7 · standing still: the chime sways (step 1); the moon edges a few degrees along its road and back (step 2)
  const onIdle = () => {
    if (quick) return
    if (!sent) {
      chimeG.classList.remove('sway')
      void chimeG.getBoundingClientRect()
      chimeG.classList.add('sway')
    } else if (!dawn) {
      const [x0, y0] = moonAt(t), [x1, y1] = moonAt(Math.min(1, t + 0.06))
      const kf = [{ translate: '0 0' }, { translate: `${f1(x1 - x0)}px ${f1(y1 - y0)}px`, offset: 0.4 }, { translate: '0 0' }]
      moonArt.animate(kf, { duration: 1600, easing: 'ease-in-out' })
      moonBtn.animate(kf, { duration: 1600, easing: 'ease-in-out' })
    }
  }
  ctx.el.addEventListener('p2:idle', onIdle)
  ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', onIdle))
}
