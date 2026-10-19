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
/** 22:00 → 07:00 */
const clock = (t: number) => {
  const m = Math.round((22 * 60 + t * 9 * 60) / 10) * 10
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
const HOURS = 10 // 22:00 … 07:00, one paper lantern per hour along the moon's road

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

/** Scene 1 — one night with the resident gardener: stamp the message, drag the moon to the morning, read the two kinds in the sky. */
export function keeperScene(ctx: SceneCtx) {
  t33Defs()
  const low = ctx.quality === 'low'
  const quick = low || ctx.reduced
  let t = 0
  let sent = false, dawn = false

  // ── layers: sky (fixed), far hills, the study, the porch and pond, near reeds
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
  const reflect = s('ellipse', { class: 't33k-mreflect' })
  const steps = s('path', { class: 't33k-steps', pathLength: 1 })
  const stepMask = s('path', { class: 't33k-stepmask', pathLength: 1 })
  const dawnSky = s('g', { class: 't33k-dawn' }, s('rect', { class: 't33k-dawnband', x: 0, y: 0, width: '100%', height: '100%' }), s('rect', { class: 't33k-dawnglow', x: 0, y: 0, width: '100%', height: '100%' }))
  const moonG = s('g', { class: 't33k-moon' })
  const ticks = Array.from({ length: HOURS }, () => s('g', { class: 't33k-tick' }))
  const study = s('g', { class: 't33k-study' })
  const chimeG = s('g', { class: 't33k-chime' })
  const bookG = s('g', { class: 't33k-bookg' })

  // ── HTML: the moon slider and its hour, the chime, the gardener, the study, the words in the sky, the reply
  const moonBtn = h('div', { class: 't33k-moonbtn', role: 'slider', tabindex: '0', 'aria-label': K.moonAria, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0', 'aria-valuetext': clock(0) })
  const hour = h('span', { class: 't33k-hour', 'aria-hidden': 'true' }, clock(0))
  const chimeBtn = h('button', { class: 't33k-hit t33k-chimebtn', type: 'button', 'aria-label': K.sendAria })
  const manBtn = h('button', { class: 't33k-hit t33k-manbtn', type: 'button', 'aria-label': fill(K.kindAria, { name: K.kinds[0].name }) })
  const studyBtn = h('button', { class: 't33k-hit t33k-studybtn', type: 'button', 'aria-label': fill(K.kindAria, { name: K.kinds[1].name }) })
  // the message is written in the sky; a vermilion seal under it sends it (so does the wind chime)
  const seal = h('button', { class: 't33k-seal', type: 'button', 'aria-label': K.sendAria }, h('span', null, K.send))
  const msg = h('div', { class: 't33k-msgbox' }, h('p', { class: 't33k-msg t33-ink' }, K.message), seal)
  const words = live('t33k-words')
  const skyText = h('div', { class: 't33k-skytext' }, msg, words)
  const reply = h('p', { class: 't33k-reply t33-ink', hidden: true }, K.reply)
  const flyer = h('div', { class: 't33k-flyer', 'aria-hidden': 'true' }, crane())
  main.append(chimeBtn, manBtn, reply)
  mid.append(studyBtn)
  const root = h('div', { class: `t33 t33k${low ? ' low' : ''}`, role: 'group', 'aria-label': K.aria },
    sky, far, mid, main, near, hour, moonBtn, skyText, flyer,
    h('p', { class: 'visually-hidden' }, K.art))
  ctx.art.append(root)
  ctx.prompt(K.prompt)
  const px = parallax(ctx, root, [[far, 0.15], [mid, 0.35], [main, 0.62], [near, 1.15]], 12)

  // ── geometry, recomputed per layout
  const G = { W: 0, H: 0, arc: { cx: 0, cy: 0, rx: 0, ry: 0 }, pond: { cx: 0, cy: 0, rx: 0, ry: 0 }, path: { rx: 0, ry: 0 }, man: 1, mobile: false, a0: 0, a1: 0 }
  /** the moon's road: from upper left (22:00, clear of the roof) over the top to the right (07:00, above the study) */
  const moonAt = (u: number): Pt => {
    const a = G.a0 + (G.a1 - G.a0) * u
    return [G.arc.cx + G.arc.rx * Math.cos(a), G.arc.cy - G.arc.ry * Math.sin(a)]
  }
  /** the gardener's place on his round: 2½ laps over the night, starting at the near left */
  const manAt = (u: number): [number, number, number] => {
    const a = Math.PI * 0.72 + u * Math.PI * 5
    const x = G.pond.cx + G.path.rx * Math.cos(a), y = G.pond.cy + G.path.ry * Math.sin(a)
    return [x, y, Math.sin(a)]
  }

  let job: { cancel(): void } | null = null
  let first = true
  function layout() {
    const W = root.clientWidth, H = root.clientHeight
    if (!W || !H) return
    // a phone stacks the picture (house, pond, study) over the words: the picture keeps the top ~62%
    const mobile = W < 640
    const A = mobile ? H * 0.62 : H
    Object.assign(G, { W, H, mobile })
    root.style.setProperty('--art', `${f1(A)}px`)
    G.arc = mobile ? { cx: W * 0.52, cy: A * 0.62, rx: W * 0.42, ry: A * 0.54 } : { cx: W * 0.54, cy: H * 0.66, rx: W * 0.4, ry: H * 0.58 }
    G.a0 = ((mobile ? 120 : 128) * Math.PI) / 180
    G.a1 = ((mobile ? 44 : 38) * Math.PI) / 180
    const hz = mobile ? A * 0.52 : H * 0.5
    // the camera is low and close: the pond and its keeper fill the lower frame
    G.pond = mobile ? { cx: W * 0.6, cy: A * 0.8, rx: W * 0.35, ry: A * 0.085 } : { cx: W * 0.58, cy: H * 0.74, rx: W * 0.27, ry: H * 0.085 }
    G.path = { rx: G.pond.rx + (mobile ? W * 0.05 : W * 0.045), ry: G.pond.ry + (mobile ? A * 0.05 : H * 0.05) }
    G.man = mobile ? A / 250 : H / 250
    const all = [sky, ...[far, mid, main, near].map(svgOf)]
    for (const g of all) g.setAttribute('viewBox', `0 0 ${W} ${H}`)

    function* draw() {
      // the sky: dawn rising from the right, the moon's road (a faint wash) strung with a paper lantern for each hour, the moon
      const pts: Pt[] = Array.from({ length: 49 }, (_, i) => moonAt(i / 48))
      ticks.forEach((g, i) => {
        const [x, y] = moonAt(i / (HOURS - 1))
        const r = Math.max(2.2, Math.min(W, H) * 0.0042)
        g.replaceChildren(
          s('circle', { class: 't33k-tickhalo', cx: f1(x), cy: f1(y + r * 2.2), r: f1(r * 4.4) }),
          s('path', { class: 't33k-tickcord', d: `M${f1(x)} ${f1(y - 1)}V${f1(y + r * 1.1)}` }),
          s('ellipse', { class: 't33k-ticklamp', cx: f1(x), cy: f1(y + r * 2.3), rx: f1(r), ry: f1(r * 1.3) }))
      })
      sky.replaceChildren(
        dawnSky,
        s('path', { class: 't33k-arc', d: stroke(pts, Math.max(1.4, Math.min(W, H) * 0.0026), 0.2, 0.25, 0.15) }),
        ...ticks,
        moonG)
      moonG.replaceChildren(moon(0, 0, Math.max(13, Math.min(W, A) * 0.036), 3302, true))
      yield
      // far: ranges and mist
      svgOf(far).replaceChildren(
        mist(W * 0.5, hz - A * 0.1, W * 0.6, A * 0.2),
        hills(-W * 0.05, W * 1.05, hz, A * 0.2, 3303, 0.92, 7),
        hills(W * 0.35, W * 1.05, hz + A * 0.02, A * 0.12, 3304, 0.7, 3),
        mist(W * 0.5, hz + A * 0.01, W * 0.62, A * 0.05))
      yield
      // the study: a small hut on a rise at the far right, a pine beside it, its desk lamp dark until it works
      const sx = mobile ? W * 0.84 : W * 0.82, sy = mobile ? hz + A * 0.08 : hz + H * 0.07, sw = mobile ? W * 0.2 : W * 0.1, sh = sw * 0.62
      study.replaceChildren(
        s('path', { class: 't33k-rise', d: `M${f1(sx - sw * 2.4)} ${f1(sy + sh * 0.3)}Q${f1(sx - sw * 0.4)} ${f1(sy - sh * 0.32)} ${f1(sx + sw * 0.4)} ${f1(sy - sh * 0.05)}Q${f1(sx + sw * 1.6)} ${f1(sy + sh * 0.1)} ${f1(sx + sw * 2.6)} ${f1(sy + sh * 0.38)}Z`, filter: 'url(#ink-wash)' }),
        pine(sx + sw * 0.95, sy + sh * 0.05, sh * 2.4, 3319, -1),
        s('circle', { class: 't33k-studyglow', cx: f1(sx), cy: f1(sy - sh * 0.4), r: f1(sw * 1.5) }),
        s('path', { class: 't33k-swall', d: rect(sx - sw / 2, sy - sh, sw, sh) }),
        s('path', { class: 't33k-swin', d: rect(sx - sw * 0.3, sy - sh * 0.8, sw * 0.46, sh * 0.5) }),
        s('path', { class: 't33k-swinlit', d: rect(sx - sw * 0.3, sy - sh * 0.8, sw * 0.46, sh * 0.5) }),
        // the coder at the desk, a silhouette in the lit window
        s('path', { class: 't33k-sman', d: blob(sx - sw * 0.1, sy - sh * 0.48, sw * 0.06, sh * 0.13, 3320, 0.1, 10) + blob(sx - sw * 0.1, sy - sh * 0.65, sw * 0.035, sw * 0.035, 3321, 0.05, 8) + rect(sx - sw * 0.3, sy - sh * 0.36, sw * 0.46, sh * 0.06) }),
        s('path', { class: 't33k-ink', d: stroke([[sx - sw * 0.07, sy - sh * 0.8], [sx - sw * 0.07, sy - sh * 0.3]], 1, 0.05, 0.05, 0.6) + stroke([[sx - sw * 0.3, sy - sh * 0.55], [sx + sw * 0.16, sy - sh * 0.55]], 1, 0.05, 0.05, 0.6) }),
        s('path', { class: 't33k-sveranda', d: `M${f1(sx - sw * 0.62)} ${f1(sy)}L${f1(sx + sw * 0.58)} ${f1(sy)}L${f1(sx + sw * 0.66)} ${f1(sy + sh * 0.12)}L${f1(sx - sw * 0.7)} ${f1(sy + sh * 0.12)}Z` }),
        s('path', { class: 't33k-sroof', d: `M${f1(sx - sw * 0.76)} ${f1(sy - sh * 0.92)}Q${f1(sx)} ${f1(sy - sh * 1.06)} ${f1(sx + sw * 0.76)} ${f1(sy - sh * 0.92)}L${f1(sx + sw * 0.35)} ${f1(sy - sh * 1.6)}L${f1(sx - sw * 0.35)} ${f1(sy - sh * 1.6)}Z`, filter: 'url(#ink-rough)' }),
        s('path', { class: 't33k-rim', d: stroke([[sx - sw * 0.74, sy - sh * 0.93], [sx - sw * 0.34, sy - sh * 1.58]], 1.2, 0.1, 0.2, 0.2) + stroke([[sx - sw * 0.5, sy - sh * 0.98], [sx - sw * 0.5, sy - 1]], 1, 0.1, 0.1, 0.3) }))
      svgOf(mid).replaceChildren(mist(W * 0.72, sy + sh * 0.3, W * 0.42, A * 0.04), study)
      studyBtn.style.cssText = `left:${f1(sx - sw * 0.95)}px;top:${f1(sy - sh * 1.75)}px;width:${f1(sw * 1.9)}px;height:${f1(sh * 2.05)}px`
      yield
      // main: sand, the raked rings round the pond, the pond, the house and its porch, the gardener
      const { cx, cy, rx, ry } = G.pond
      let rows = ''
      for (let y = hz + A * 0.02; y < H; y += 3 + (y - hz) * 0.045) {
        const p: Pt[] = []
        for (let i = 0; i <= 16; i++) p.push([(W * i) / 16, y + Math.sin(i * 0.9 + y * 0.1) * 0.6])
        rows += `M${p.map(P).join('L')}`
      }
      let rings = ''
      for (let k = 1; k <= 7; k++) rings += blob(cx, cy, rx + k * W * 0.011, ry + k * A * 0.0095, 3305, 0.03, 30)
      const pond = blob(cx, cy, rx, ry, 3306, 0.05, 26)
      // the path his steps make: three loops, each a little wider
      let loops = ''
      for (let k = 0; k < 3; k++) {
        const p: Pt[] = []
        for (let i = 0; i <= 64; i++) {
          const a = Math.PI * 0.72 + (i / 64) * Math.PI * 2
          p.push([cx + (G.path.rx + k * 4) * Math.cos(a), cy + (G.path.ry + k * 2) * Math.sin(a)])
        }
        loops += (k ? 'L' : 'M') + p.map(P).join('L')
      }
      steps.setAttribute('d', loops)
      stepMask.setAttribute('d', loops)
      // the main house, lights out, cut by the left edge and seen a little from the side: its wall shrinks toward the corner post
      const hx = mobile ? W * 0.25 : W * 0.22, ey = mobile ? A * 0.46 : H * 0.33, fy = mobile ? A * 0.8 : H * 0.66
      const x0 = -W * 0.02, gT = A * 0.07, gB = A * 0.06
      const top = (x: number) => ey - gT * (1 - (x - x0) / (hx - x0)), bot = (x: number) => fy + gB * (1 - (x - x0) / (hx - x0))
      const at = (x: number, f: number): Pt => [x, top(x) + (bot(x) - top(x)) * f]
      const ex0: Pt = [x0, top(x0) - A * 0.06], ex1: Pt = [hx + W * 0.06, ey - A * 0.045]
      const Rh = mobile ? A * 0.2 : H * 0.21
      const roof = `M${P(ex0)}L${P(ex1)}L${f1(hx * 0.55)} ${f1(ey - Rh)}L${f1(x0)} ${f1(ey - Rh - A * 0.04)}Z`
      let thatch = '', rafters = '', lat = '', planks = ''
      const r = rng(3316)
      for (let i = 0; i < 80; i++) {
        const u = r(), x = x0 + (ex1[0] - x0) * u, y0 = ex0[1] + (ex1[1] - ex0[1]) * u
        thatch += stroke([[x, y0 - 2], [x - (ex1[0] - x) * 0.18 * r(), y0 - A * (0.04 + r() * 0.12)]], 0.8 + r() * 0.9, 0.1, 0.4, 0.1)
      }
      for (let x = x0 + 8; x < ex1[0] - 6; x += (hx - x0) / 16) {
        const y = ex0[1] + ((ex1[1] - ex0[1]) * (x - x0)) / (ex1[0] - x0)
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
      const edge = `M${P(vF0)}L${P(vF1)}L${f1(vF1[0])} ${f1(vF1[1] + A * 0.026)}L${f1(vF0[0])} ${f1(vF0[1] + A * 0.034)}Z`
      // the wind chime under the eave: the channel the messages come in by (it is also a button)
      const cu = mobile ? A / 420 : H / 560
      const chx = hx + W * (mobile ? 0.025 : 0.03), chy = ey - A * 0.042
      chimeG.setAttribute('style', `transform-origin:${f1(chx)}px ${f1(chy)}px`)
      chimeG.replaceChildren(
        s('path', { class: 't33k-thread', d: `M${f1(chx)} ${f1(chy)}V${f1(chy + 22 * cu)}` }),
        s('path', { class: 't33k-glass', d: `M${f1(chx - 12 * cu)} ${f1(chy + 38 * cu)}Q${f1(chx - 12 * cu)} ${f1(chy + 20 * cu)} ${f1(chx)} ${f1(chy + 20 * cu)}Q${f1(chx + 12 * cu)} ${f1(chy + 20 * cu)} ${f1(chx + 12 * cu)} ${f1(chy + 38 * cu)}Z` }),
        s('path', { class: 't33k-glasspaint', d: blob(chx + 3 * cu, chy + 31 * cu, 3 * cu, 2.4 * cu, 3322, 0.2, 8) + blob(chx - 5 * cu, chy + 34 * cu, 2 * cu, 1.6 * cu, 3323, 0.2, 8) }),
        s('path', { class: 't33k-rim', d: stroke(curve([chx - 9 * cu, chy + 36 * cu], [chx - 9 * cu, chy + 24 * cu], [chx - 1, chy + 22 * cu], 6), 1.4 * cu, 0.2, 0.2, 0.2) }),
        s('path', { class: 't33k-thread', d: `M${f1(chx)} ${f1(chy + 30 * cu)}V${f1(chy + 66 * cu)}` }),
        s('path', { class: 't33k-tanzaku', d: rect(chx - 6 * cu, chy + 66 * cu, 12 * cu, 50 * cu) }),
        s('path', { class: 't33k-ink', d: stroke([[chx - 1.5 * cu, chy + 74 * cu], [chx - 1.5 * cu, chy + 106 * cu]], 1.4 * cu, 0.1, 0.1, 0.3) + stroke([[chx + 2.2 * cu, chy + 78 * cu], [chx + 2.2 * cu, chy + 98 * cu]], 1.2 * cu, 0.1, 0.1, 0.3) }))
      chimeBtn.style.cssText = `left:${f1(chx - 24)}px;top:${f1(chy)}px;width:48px;height:${f1(Math.max(60, 120 * cu))}px`
      // the gardener's notebook on the veranda: its pages grow with each message
      const bx = hx - W * (mobile ? 0.1 : 0.05), by = fy + A * 0.02
      bookG.replaceChildren(
        s('path', { class: 't33k-bookshadow', d: blob(bx + 6, by + 1, 20, 3, 3307, 0.2, 10) }),
        s('g', { class: 't33k-pagesg', style: `transform-origin:${f1(bx)}px ${f1(by)}px` }, s('path', { class: 't33k-pages', d: rect(bx - 16, by - 9, 32, 9) }), s('path', { class: 't33k-ink', d: [2.5, 5, 7.5].map((d) => stroke([[bx - 15, by - d], [bx + 15, by - d]], 0.6, 0.05, 0.05, 0.4)).join('') })),
        s('path', { class: 't33k-cover', d: rect(bx - 17, by - 2, 34, 2.5) + `M${f1(bx - 17)} ${f1(by - 9)}h34v2.2h-34Z` }))
      const house = [
        s('path', { class: 't33k-vshadow', d: blob(hx * 0.45, vF1[1] + A * 0.06, hx * 0.8, A * 0.04, 3311, 0.2, 14), filter: 'url(#ink-wash)' }),
        s('path', { class: 't33k-wall', d: `M${P([x0, top(x0)])}L${P([hx, ey])}L${P([hx, fy])}L${P([x0, bot(x0)])}Z` }),
        s('path', { class: 't33k-room', d: open }),
        s('path', { class: 't33k-lattice', d: lat, filter: 'url(#ink-rough)' }),
        s('path', { class: 't33k-veranda', d: veranda }),
        s('path', { class: 't33k-ink', d: planks }),
        s('path', { class: 't33k-vedge', d: edge, filter: 'url(#ink-rough)' }),
        s('path', { class: 't33k-rim', d: stroke([vF0, vF1], 1.4, 0.05, 0.2, 0.2) }),
        s('path', { class: 't33k-stepstone', d: blob(hx - W * 0.03, vF1[1] + A * 0.05, W * 0.035, A * 0.014, 3317, 0.15, 12), filter: 'url(#ink-rough)' }),
        s('path', { class: 't33k-eaveu', d: `M${P(ex0)}L${P(ex1)}L${P([hx, ey])}L${P([x0, top(x0)])}Z` }),
        s('path', { class: 't33k-ink', d: rafters }),
        s('path', { class: 't33k-roof', d: roof, filter: 'url(#ink-wash)' }),
        s('path', { class: 't33k-thatch', d: thatch }),
        s('path', { class: 't33k-fascia', d: stroke([ex0, ex1], Math.max(4, A * 0.012), 0.02, 0.1, 0.6), filter: 'url(#ink-rough)' }),
        s('path', { class: 't33k-rim', d: stroke([[ex0[0], ex0[1] + 3], [ex1[0], ex1[1] + 3]], 1.4, 0.05, 0.3, 0.2) }),
        s('path', { class: 't33k-post', d: stroke([[hx + 1, vF1[1] + A * 0.01], [hx, ex1[1] + 2]], Math.max(6, W * 0.007), 0.02, 0.02, 0.85), filter: 'url(#ink-rough)' }),
        s('path', { class: 't33k-rim', d: stroke([[hx - 2.5, fy], [hx - 3, ey]], 1.2, 0.1, 0.1, 0.2) }),
      ]
      main.style.setProperty('--hz', `${f1(hz)}px`)
      svgOf(main).replaceChildren(
        s('rect', { class: 't33k-sand', x: 0, y: f1(hz - A * 0.02), width: f1(W), height: f1(H - hz + A * 0.02), fill: 'url(#t33k-sandg)' }),
        s('path', { class: 't33k-rake', d: rows }),
        s('ellipse', { class: 't33k-sand', cx: f1(cx), cy: f1(cy), rx: f1(rx + W * 0.085), ry: f1(ry + A * 0.075) }),
        s('path', { class: 't33k-rake', d: rings }),
        s('defs', null, s('mask', { id: 't33k-trail' }, stepMask)),
        s('g', { mask: 'url(#t33k-trail)' }, steps),
        s('path', { class: 't33k-bank', d: blob(cx, cy + 3, rx + 6, ry + 4, 3306, 0.05, 26), filter: 'url(#ink-wash)' }),
        s('path', { class: 't33k-pond', d: pond }),
        s('defs', null, s('clipPath', { id: 't33k-pondclip' }, s('path', { d: pond }))),
        s('g', { 'clip-path': 'url(#t33k-pondclip)' }, water(cx - rx, cy - ry, cx + rx, cy + ry, 3308, undefined, false), reflect, glint,
          s('path', { class: 't33k-pondlip', d: blob(cx, cy - ry * 0.12, rx * 1.02, ry * 0.95, 3306, 0.05, 26) })),
        ...[[-0.8, 0.55, 1], [0.62, 0.78, 0.85], [0.92, -0.2, 0.65], [-0.35, -0.96, 0.55]].map(([u, v, k], i) => s('g', { class: 't33k-bankrock' },
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
      // near: reeds and grass cut by the frame, painted blade by blade and leaning in
      svgOf(near).replaceChildren(
        reedClump(W * 0.025, A * 1.01, A * (mobile ? 0.3 : 0.36), 3312, 12, 0.55),
        reedClump(W * 0.975, A * 1.0, A * (mobile ? 0.24 : 0.28), 3313, 10, -0.6),
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
    hour.style.transform = `translate(${f1(mx)}px, ${f1(my - Math.max(13, Math.min(G.W, G.H) * 0.036) - 22)}px)`
    const hh = clock(t)
    if (hour.textContent !== hh) hour.textContent = hh
    const n = Math.floor(t * (HOURS - 1) + 0.001)
    if (n !== litTicks) {
      litTicks = n
      ticks.forEach((g, i) => g.classList.toggle('on', i <= n && t > 0))
    }
    // the moon in the pond, where its column meets the water
    const { cx, cy, rx, ry } = G.pond
    const inPond = Math.abs(mx - cx) < rx * 0.85
    reflect.setAttribute('cx', f1(clamp(mx, cx - rx, cx + rx)))
    reflect.setAttribute('cy', f1(cy - ry * 0.1))
    reflect.setAttribute('rx', f1(rx * 0.08))
    reflect.setAttribute('ry', f1(ry * 0.32))
    reflect.style.opacity = inPond ? String((1 - t * 0.7).toFixed(2)) : '0'
    // the gardener and his lantern
    const [x, y, depth] = manAt(t)
    const k = G.man * (0.82 + (depth + 1) * 0.14)
    man.setAttribute('transform', `translate(${f1(x)} ${f1(y)}) scale(${(k * (Math.cos(Math.PI * 0.72 + t * Math.PI * 5) > 0 ? -1 : 1)).toFixed(3)} ${k.toFixed(3)})`)
    pool.setAttribute('cx', f1(x + 10 * k))
    pool.setAttribute('cy', f1(y))
    pool.setAttribute('rx', f1(50 * k))
    pool.setAttribute('ry', f1(12 * k))
    // seen across the water: his lantern's streak on the pond
    glint.setAttribute('cx', f1(clamp(x, cx - rx * 0.8, cx + rx * 0.8)))
    glint.setAttribute('cy', f1(cy + ry * 0.2))
    glint.setAttribute('rx', f1(3 * k))
    glint.setAttribute('ry', f1(ry * 0.55))
    glint.style.opacity = depth < -0.2 ? String(Math.min(1, -depth).toFixed(2)) : '0'
    manBtn.style.cssText = `left:${f1(x - 24 * k)}px;top:${f1(y - 48 * k)}px;width:${f1(Math.max(44, 48 * k))}px;height:${f1(Math.max(44, 54 * k))}px`
    reply.style.transform = `translate(${f1(clamp(x, G.W * 0.3, G.W * 0.7))}px, ${f1(y - 50 * k)}px)`
    // footprints: the round gets longer through the night
    stepMask.style.strokeDashoffset = String((1 - t).toFixed(4))
    dawnSky.style.opacity = smooth(0.62, 1, t).toFixed(3)
    root.style.setProperty('--night', (1 - smooth(0.7, 1, t)).toFixed(3))
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

  // ── sending: the words fold into a crane that flies to the chime; the chime rings; the gardener writes it down
  const later = (ms: number, fn: () => void) => {
    const id = setTimeout(fn, quick ? 0 : ms)
    ctx.onCleanup(() => clearTimeout(id))
  }
  function ring() {
    chimeG.classList.remove('rung')
    void chimeG.getBoundingClientRect()
    chimeG.classList.add('rung')
    ctx.chime('soft')
  }
  function send() {
    if (sent) return
    sent = true
    const a = skyText.getBoundingClientRect(), b = chimeBtn.getBoundingClientRect(), r = root.getBoundingClientRect()
    msg.classList.add('gone')
    if (!quick) {
      flyer.style.left = `${f1(a.left - r.left + a.width * 0.5 - 24)}px`
      flyer.style.top = `${f1(a.top - r.top + a.height * 0.4)}px`
      const dx = b.left - a.left - a.width * 0.5 + 30, dy = b.top - a.top - a.height * 0.4 + b.height * 0.4
      flyer.animate([
        { transform: 'translate(0,0) scale(0.6) rotate(-8deg)', opacity: 0 },
        { transform: `translate(${f1(dx * 0.35)}px, ${f1(dy * 0.2 - 60)}px) scale(1.15) rotate(-14deg)`, opacity: 1, offset: 0.35 },
        { transform: `translate(${f1(dx)}px, ${f1(dy)}px) scale(0.5) rotate(4deg)`, opacity: 0 },
      ], { duration: 1500, easing: 'cubic-bezier(.45,.05,.25,1)' })
    }
    later(1400, () => {
      msg.hidden = true
      ring()
      root.classList.add('wrote')
      reply.hidden = false
      ctx.prompt(K.promptMoon)
      // H1: the dot leaves the chime for the moon, leaning along its road toward the morning
      dot?.done()
      dot = g.dot(moonBtn, { dir: [1, -0.3] })
      moonBtn.focus({ preventScroll: true })
    })
  }
  seal.addEventListener('click', send)
  chimeBtn.addEventListener('click', () => (sent ? ring() : send()))

  // ── 07:00: dawn, the chime rings by itself (the agent messages you), the crane comes back toward you, the sky names it
  function morning() {
    dawn = true
    root.classList.add('dawn')
    dot?.done()
    dot = null
    later(400, () => {
      ring()
      // what the agent sends back at 07:00: a sample summary
      reply.textContent = K.morning
      reply.hidden = false
      if (!quick) {
        const b = chimeBtn.getBoundingClientRect(), r = root.getBoundingClientRect()
        flyer.style.left = `${f1(b.left - r.left)}px`
        flyer.style.top = `${f1(b.top - r.top + b.height * 0.3)}px`
        flyer.animate([
          { transform: 'translate(0,0) scale(0.5)', opacity: 0 },
          { transform: 'translate(60px,-40px) scale(1.2) rotate(-10deg)', opacity: 1, offset: 0.4 },
          { transform: `translate(${f1(r.width * 0.3)}px, ${f1(r.height * 0.25)}px) scale(3) rotate(6deg)`, opacity: 0 },
        ], { duration: 1600, easing: 'cubic-bezier(.45,.05,.25,1)' })
      }
      if (!root.classList.contains('reading')) read(0, false)
      ctx.insight(K.insight as Fact, K.detail)
    })
  }

  // ── the two kinds, written in the sky (at most three lines); the examples wait behind ⓘ — tap the gardener, or the study
  function read(i: number, sound = true) {
    const kd = K.kinds[i]
    root.classList.toggle('studying', i === 1)
    msg.hidden = true
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
  }
  const g = guide(ctx)
  let dot: Mark | null = g.dot(chimeBtn, { dir: [0, 1] })
  manBtn.addEventListener('click', () => read(0))
  studyBtn.addEventListener('click', () => read(1))
}
