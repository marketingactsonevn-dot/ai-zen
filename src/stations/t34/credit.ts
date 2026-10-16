import './credit.css'
import { fill, h } from '../../core/dom'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import { clamp, onSize, rng, stableHeight, type Pt } from '../../ui/part2/ink'
import type { SceneCtx } from '../types'
import { C } from './content'
import { cardButton, F } from './night'
import { bleedBelow, dprFor, grain, inkLine, layer, mix, moonDisc, mountains, noise, poly, rgba, smooth, soft, vgrad, watchTok, type C4, type Tok } from './cv'

const K = C.scenes.credit

/*
 * ★ Scene 3 — credit is water in a moon jar. A canvas still life at 3/4 (camera 20° up, low, so the jar looms) lit by
 * the workshop lamp from the upper left (the key, warm) and the moon through a paper window on the right (a cool fill,
 * a rim down the jar's right edge, a soft dusty beam into its mouth). A crackle-glazed moon jar sits on a thick plank
 * bench; a quarter wedge of it is cut away down its whole height like a museum piece, so the clay shows its thickness in
 * section and, inside, the water stands as a column that darkens with depth under an elliptical surface holding the
 * moon. The controls are the things themselves: a small dipper and a big ladle on a bamboo rack (models), a narrow and
 * a wide neck hoop (resolutions), one or two hourglasses (lengths); drag a ladle into the jar's mouth (or tap the chosen
 * one again) to take a scoop, which is poured into the tea cup with the cost written on it. A thin cord of wooden tags
 * under the bench is the keyboard proxy. Four tips hang on bamboo slats beside the window; the take-away card is a paper
 * tag tied to the rack. Tap the mouth: the camera cranes up to look down the neck.
 *
 * Three canvases (wall · jar + bench · water + tools), all drawn from one projection, so the crane re-projects the real
 * shapes. Static layers redraw only on layout / theme / crane; the water layer redraws on change or while something moves.
 */

// shortcut: illustrative weights only (K.scale says so on screen); not any platform's price list
const W_MODEL = [1, 2.2], W_RES = [1, 1.73], W_LEN = [1, 1.73]
const E0 = (20 * Math.PI) / 180, E1 = (70 * Math.PI) / 180
const FLOOR = -0.42, AP = 0.09, PD = 8

// ── the moon jar: outer profile [y, r] (height 1), wall thickness, the base slab
const PROF: Pt[] = [[0, 0.215], [0.018, 0.232], [0.034, 0.226], [0.06, 0.29], [0.12, 0.372], [0.22, 0.448], [0.35, 0.494], [0.48, 0.505], [0.6, 0.49], [0.72, 0.446], [0.82, 0.372], [0.89, 0.285], [0.925, 0.218], [0.955, 0.205], [0.985, 0.222], [1, 0.226]]
const TH = 0.052, YIN = 0.065, BRIM = 0.9
// the quarter wedge cut away down the whole height, turned ~30° to the left of the camera (φ: 0 = facing us, + = right)
const PA = (-75 * Math.PI) / 180, PB = (15 * Math.PI) / 180
const NT = 200
const RO = new Float32Array(NT + 1), RI = new Float32Array(NT + 1), SL = new Float32Array(NT + 1), VOL = new Float32Array(NT + 1)
;(() => {
  const dense: Pt[] = []
  for (let i = 0; i < PROF.length - 1; i++) {
    const p0 = PROF[Math.max(0, i - 1)], p1 = PROF[i], p2 = PROF[i + 1], p3 = PROF[Math.min(PROF.length - 1, i + 2)]
    for (let j = 0; j < 12; j++) {
      const t = j / 12, t2 = t * t, t3 = t2 * t
      const c = (a: number, b: number, cc: number, d: number) => 0.5 * (2 * b + (cc - a) * t + (2 * a - 5 * b + 4 * cc - d) * t2 + (3 * b - a - 3 * cc + d) * t3)
      dense.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])])
    }
  }
  dense.push(PROF[PROF.length - 1])
  let k = 0
  for (let i = 0; i <= NT; i++) {
    const y = i / NT
    while (k < dense.length - 2 && dense[k + 1][0] < y) k++
    const [y0, r0] = dense[k], [y1, r1] = dense[k + 1]
    RO[i] = r0 + (r1 - r0) * clamp((y - y0) / (y1 - y0 || 1), 0, 1)
    RI[i] = y < YIN ? 0 : Math.max(0, RO[i] - TH)
  }
  for (let i = 0; i <= NT; i++) {
    const a = Math.max(0, i - 2), b = Math.min(NT, i + 2)
    SL[i] = ((RO[b] - RO[a]) * NT) / (b - a)
  }
  for (let i = 1; i <= NT; i++) VOL[i] = VOL[i - 1] + (Math.PI * RI[i] * RI[i]) / NT
})()
const tab = (A: Float32Array, y: number) => {
  const f = clamp(y, 0, 1) * NT, i = Math.min(NT - 1, Math.floor(f))
  return A[i] + (A[i + 1] - A[i]) * (f - i)
}
const ro = (y: number) => tab(RO, y), ri = (y: number) => tab(RI, y), sl = (y: number) => tab(SL, y)
const FULL = tab(VOL, BRIM)
/** water height for a level 0…100 (by volume: the marks crowd where the jar is wide) */
function levelY(level: number) {
  const v = (FULL * clamp(level, 0, 104)) / 100
  let a = 0, b = NT
  while (b - a > 1) {
    const m = (a + b) >> 1
    if (VOL[m] < v) a = m
    else b = m
  }
  const f = (v - VOL[a]) / (VOL[b] - VOL[a] || 1)
  return Math.max(YIN, (a + f) / NT)
}
const MARKS = Array.from({ length: 10 }, (_, i) => levelY((i + 1) * 10))
/** φ inside the cut-away wedge */
const inCut = (ph: number) => {
  const p = ((ph + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI
  return p > PA && p < PB
}

// crackle net on the glaze, in (φ, y), built once: lines that run round the belly with the curve
const CRACKS: number[][] = (() => {
  const r = rng(3401)
  const out: number[][] = []
  for (let i = 0; i < 110; i++) {
    let ph = (r() * 2 - 1) * 2.2, y = 0.05 + r() * 0.88
    const line = [ph, y]
    let a = (r() - 0.5) * 1.2 // mostly round the jar, not up it
    for (let k = 0, n = 3 + Math.floor(r() * 5); k < n; k++) {
      a += (r() - 0.5) * 1.4
      ph += Math.cos(a) * 0.11
      y += Math.sin(a) * 0.03
      line.push(ph, y)
    }
    out.push(line)
  }
  return out
})()
// dust in the moonbeam
const DUST = (() => {
  const r = rng(3402)
  return Array.from({ length: 46 }, () => [r(), (r() - 0.5) * 0.9, 0.5 + r() * 1.3, r()])
})()

const n3 = (x: number, y: number, z: number): [number, number, number] => {
  const l = Math.hypot(x, y, z)
  return [x / l, y / l, z / l]
}
const LK = n3(-0.66, 0.5, 0.56) // the workshop lamp: warm key, upper left front
const LM = n3(0.7, 0.42, -0.58) // the moon through the window: cool fill and rim, upper right back
const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a), 0, 1)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
/** run a painting generator to the end (re-layout, theme, crane frames) */
const run = (it: Iterator<unknown>) => {
  while (!it.next().done);
}

type V3 = [number, number, number]
interface Comp {
  wide: boolean
  S: number; jx: number; jy: number; S1: number; jy1: number
  bench: [number, number, number, number]
  ZW: number
  win: [number, number, number, number]
  rack: V3
  rings: [V3, V3]
  glass: V3
  bowl: V3; bowlR: number
  tips: V3
}
function compose(W: number, H: number): Comp {
  const wide = W / H > 1.05
  if (wide) {
    const S = Math.min(H * 0.5, W * 0.235)
    return {
      wide, S, jx: W * 0.42, jy: H * 0.72, S1: S * 2.5, jy1: H * 0.42 + S * 2.5 * Math.cos(E1),
      bench: [-1.9, 2.25, -0.5, 0.66], ZW: 0.9, win: [0.92, 1.46, 0.74, 1.26],
      rack: [-1.32, 0, 0.06], rings: [[-0.66, 0, 0.5], [0.66, 0, 0.5]], glass: [1.08, 0, -0.06], bowl: [1.62, 0, 0.32], bowlR: 0.15,
      tips: [1.66, 1.3, -0.9],
    }
  }
  const S = Math.min(H * 0.34, W * 0.5)
  return {
    wide, S, jx: W * 0.52, jy: H * 0.6, S1: S * 2.2, jy1: H * 0.34 + S * 2.2 * Math.cos(E1),
    bench: [-1.05, 1.05, -0.45, 0.62], ZW: 0.8, win: [0.42, 0.88, 1.16, 1.52],
    rack: [-0.76, 0, 0.12], rings: [[-0.4, 0, 0.5], [0.12, 0, 0.52]], glass: [0.72, 0, -0.08], bowl: [0.62, 0, 0.42], bowlR: 0.17,
    tips: [-0.95, 1.5, -0.8],
  }
}

export function creditScene(ctx: SceneCtx) {
  const still = ctx.reduced || ctx.quality === 'low'
  const lowQ = ctx.quality === 'low'
  let T: Tok = watchTok(ctx, (t) => {
    T = t
    pal = palette(t)
    drawAll()
  })
  let pal = palette(T)

  // ── state
  let level = 100
  let made = 0
  const pick = [0, 0, 0]
  let lookU = 0, lookTo = 0 // crane: 0 eye level … 1 looking down the neck
  const an = { t: -1, kind: 0, l0: 100, l1: 100, dry: false, n: 0 }
  const fillA = { t: -1, l0: 0, over: 0 }
  let slosh = 0, sloshT = 0
  let bowl = 0
  let wet = 0, puddle = 0, streak = 0
  const ringU = [1, 0] // 1 = on the jar's lip
  const ringTo = [1, 0]
  const glassP = [1, 0] // sand on top
  const glassRun = [-1, -1]
  let drag: { k: number; x: number; y: number; over: boolean } | null = null

  // ── DOM
  const back = layer('t34c-cv t34c-back'), mid = layer('t34c-cv t34c-mid'), fx = layer('t34c-cv t34c-fx')
  const jarLabel = h('div', { class: 't34c-jar', role: 'img', 'aria-label': fill(K.jarAria, { n: level }) })
  const look = h('button', { class: 't34c-hit t34c-mouth', type: 'button', 'aria-pressed': 'false', 'aria-label': K.look, onClick: () => setLook(lookTo ? 0 : 1) })
  // the tools themselves (pointer only; the cord under the bench is their keyboard twin)
  const hit = (cb: () => void) => h('button', { class: 't34c-hit', type: 'button', tabindex: '-1', 'aria-hidden': 'true', onClick: () => { setLook(0); cb() } })
  const hits = [hit(() => tapLadle(0)), hit(() => tapLadle(1)), hit(() => choose(1, 0)), hit(() => choose(1, 1)), hit(() => choose(2, 0)), hit(() => choose(2, 1))]
  const tags: HTMLButtonElement[][] = []
  const groupEl = ([[K.modelLabel, K.models], [K.resLabel, K.resolutions], [K.lengthLabel, K.lengths]] as [string, string[]][]).map(([label, opts], k) => {
    const row = opts.map((o, i) => h('button', { class: 't34c-tag', type: 'button', 'aria-pressed': String(i === 0), onClick: () => { setLook(0); choose(k, i) } }, o))
    tags.push(row)
    return h('span', { class: 't34c-grp', role: 'group', 'aria-label': label }, ...row)
  })
  const go = h('button', { class: 't34c-tag t34c-go', type: 'button', onClick: generate }, K.generate)
  const cord = h('div', { class: 't34c-cord' }, ...groupEl, go)
  const refill = h('button', { class: 't34c-refill', type: 'button', hidden: true, onClick: fillUp }, K.refill)
  // the cost is written in ink on the tea cup; the whole sentence is read out
  const cost = h('p', { class: 't34c-cost', 'aria-hidden': 'true' })
  const costSay = h('p', { class: 'visually-hidden' })
  const empty = h('p', { class: 't34c-empty' })
  const facts = h('div', { class: 't34c-facts' })
  const tipsBody = h('div', { class: 't34c-tips-body', id: `t34c-tips-${Math.round(performance.now())}` }, h('ul', null, ...K.tips.map((t) => h('li', null, t))), facts)
  const tipsBtn = h('button', { class: 't34c-tips-bar', type: 'button', 'aria-expanded': 'false', 'aria-controls': tipsBody.id, onClick: () => setTips(tips.classList.contains('open') ? 0 : 1) }, K.tipsLabel)
  const tips = h('div', { class: 't34c-tips', hidden: true }, tipsBtn, tipsBody)
  const scale = ctx.fact(F(K.scale), 'p', 't34c-scale')
  const stageEl = h('div', { class: 't34c-mid-wrap' }, mid.cv, fx.cv, jarLabel, ...hits, look, cord, refill, cost, empty)
  const view = h('div', { class: 't34c-view' }, h('div', { class: 't34c-back-wrap' }, back.cv, tips), stageEl)
  const root = h('div', { class: 't34 t34c' }, h('p', { class: 'visually-hidden' }, K.art), view, scale, costSay)
  ctx.art.append(root)
  ctx.prompt(K.prompt)
  // the take-away: a paper tag tied to the ladle rack
  const pill = cardButton(ctx, root, K.takeaway)
  if (pill) {
    pill.hidden = true
    pill.classList.add('t34c-card')
    stageEl.append(pill)
  }

  // ── projection (one camera for every layer)
  let cp: Comp | null = null
  let W = 0, H = 0, HB = 0
  let S = 1, jx = 0, jy = 0, ce = Math.cos(E0), se = Math.sin(E0), te = Math.tan(E0)
  let PX = 0, PY = 0
  const pj = (x: number, y: number, z: number) => {
    const v = y * ce - z * se, d = z * ce + y * se, f = PD / (PD - d)
    PX = jx + S * x * f
    PY = jy - S * v * f
  }
  const pt = (x: number, y: number, z: number): Pt => (pj(x, y, z), [PX, PY])
  /** a point of the jar at radius r, height y, angle φ */
  const pr = (r: number, y: number, ph: number) => pj(r * Math.sin(ph), y, r * Math.cos(ph))
  function setCam(u: number) {
    const c = cp!
    const k = ease(u)
    const e = lerp(E0, E1, k)
    ce = Math.cos(e)
    se = Math.sin(e)
    te = Math.tan(e)
    S = lerp(c.S, c.S1, k)
    jx = c.jx
    jy = lerp(c.jy, c.jy1, k)
  }

  // ── palette (tokens → material colours); by day the warm lamp and the cool moon pull further apart
  function palette(t: Tok) {
    const glaze = t.dark ? [mix(t.rockLo, t.umbra, 0.55), t.rockLo, t.rockMid, t.rockHi, t.stepHi] : [mix(t.rockLo, t.wash, 0.3), t.rockLo, t.rockMid, t.rockHi, t.card]
    const wood = t.dark ? [mix(t.stepLo, t.umbra, 0.55), mix(t.stepLo, t.lantern, 0.14), mix(t.stepMid, t.lantern, 0.24)] : [mix(t.stepLo, t.umbra, 0.4), mix(t.stepMid, t.lantern, 0.22), mix(t.stepHi, t.lantern, 0.32)]
    return {
      glaze, wood,
      wallWarm: t.dark ? mix(mix(t.paper, t.rockLo, 0.45), t.lantern, 0.1) : mix(mix(t.paper2, t.stepMid, 0.35), t.lantern, 0.2),
      wallCool: t.dark ? mix(t.paper, t.wash, 0.35) : mix(mix(t.paper2, t.water, 0.45), t.wash, 0.12),
      floor: t.dark ? mix(t.paper, t.umbra, 0.55) : mix(t.paper2, t.stepMid, 0.45),
      inner: (t.dark ? [mix(t.rockLo, t.umbra, 0.45), mix(t.rockMid, t.lantern, 0.12)] : [mix(t.rockLo, t.wash, 0.45), mix(t.rockMid, t.lantern, 0.18)]) as C4[],
      clay: mix(mix(t.stepMid, t.lantern, 0.42), t.vermilion, 0.12),
      clayLit: mix(mix(t.stepHi, t.lantern, 0.5), t.vermilion, 0.08),
      water: t.dark ? mix(t.water, t.mist, 0.36) : mix(t.water, t.ink2, 0.2),
      deep: t.dark ? mix(t.water, t.umbra, 0.4) : mix(t.water, t.wash, 0.62),
      cup: t.dark ? mix(t.moon, t.mossC, 0.22) : mix(t.card, t.mossC, 0.25),
      bamboo: [mix(t.mossB, t.umbra, 0.3), t.mossA, mix(t.mossC, t.lantern, 0.25)] as C4[],
      hoop: [mix(t.stepLo, t.lantern, 0.2), mix(t.stepMid, t.lantern, 0.45), mix(t.stepHi, t.lantern, 0.5)] as C4[],
    }
  }
  const ramp = (cols: C4[], t: number): C4 => {
    const f = clamp(t, 0, 1) * (cols.length - 1), i = Math.min(cols.length - 2, Math.floor(f))
    return mix(cols[i], cols[i + 1], f - i)
  }
  /** the glaze lit at (φ, y): warm lamp key with a terminator that wavers like a brush, cool moon fill and rim */
  function glazeAt(phi: number, y: number): string {
    const s = sl(y), ca = 1 / Math.sqrt(1 + s * s), sa = -s * ca
    const nx = Math.sin(phi) * ca, ny = sa, nz = Math.cos(phi) * ca
    const lam = nx * LK[0] + ny * LK[1] + nz * LK[2]
    const mo = Math.max(0, nx * LM[0] + ny * LM[1] + nz * LM[2])
    const vd = clamp(ny * se + nz * ce, 0, 1)
    const fres = (1 - vd) ** 3
    // the terminator: a fairly sharp step whose edge is pushed about by noise
    const edge = lam + (noise(phi * 2.2 + 3, y * 7) - 0.5) * 0.34
    const lit = smooth(-0.05, 0.22, edge)
    const t = 0.05 + 0.25 * lit + 0.68 * lit * Math.max(0, lam) ** 0.8 - (y < 0.1 ? (0.1 - y) * 3 : 0)
    let c = ramp(pal.glaze, t)
    c = mix(c, T.lantern, 0.34 * lit * Math.max(0, lam) * (T.dark ? 1.2 : 1))
    c = mix(c, mix(T.moon, T.mist, 0.3), Math.min(0.65, mo * (0.18 + fres * 1.1) * (T.dark ? 0.95 : 0.8)))
    return rgba(c)
  }

  // ── layout
  let first = true
  let job: { cancel(): void } | null = null
  ctx.onCleanup(() => job?.cancel())
  // lay out in the height the art keeps once the insight shows, so nothing jumps
  const stableH = stableHeight(ctx, [F(K.insight)])
  ctx.onCleanup(onSize(ctx.art, () => {
    const w = view.clientWidth, hh = stableH(ctx.art.clientHeight)
    if (w < 60 || hh < 60) return
    const bl = bleedBelow(ctx, hh)
    root.style.height = `${hh}px`
    view.style.bottom = `${-bl}px`
    W = w
    H = hh
    HB = hh + bl
    cp = compose(W, H)
    root.classList.toggle('wide', cp.wide)
    const d = dprFor(ctx)
    back.size(W, HB, Math.min(d, 1.5))
    mid.size(W, HB, d)
    fx.size(W, HB, Math.min(d, 1.5))
    setCam(lookU)
    job?.cancel()
    // the first paint soaks in (sliced); a re-layout paints in one go
    job = sliced((function* () {
      yield* backG()
      yield
      yield* midG(0)
      yield
      yield* midG(1)
      yield
      yield* midG(2)
      yield
      drawFx()
      placeDom()
    })(), { sync: ctx.reduced || !first })
    first = false
  }))

  // ── the wall: planks, the lamp's warm pool on the left, the paper window with the moon on the right, the beam
  function drawBack() {
    run(backG())
  }
  function* backG() {
    const c = cp!
    const g = back.g
    back.clear()
    const wb = pt(0, FLOOR, -c.ZW)[1]
    // the wall: warm where the lamp falls (left), cool toward the window (right); darker overhead
    const wg = g.createLinearGradient(0, 0, W, 0)
    wg.addColorStop(0, rgba(pal.wallWarm))
    wg.addColorStop(0.45, rgba(mix(pal.wallWarm, pal.wallCool, 0.5)))
    wg.addColorStop(1, rgba(pal.wallCool))
    g.fillStyle = wg
    g.fillRect(0, 0, W, wb + 2)
    g.fillStyle = vgrad(g, 0, wb, [[0, T.umbra, T.dark ? 0.35 : 0.18], [0.5, T.umbra, 0], [1, T.umbra, T.dark ? 0.15 : 0.08]])
    g.fillRect(0, 0, W, wb + 2)
    const r = rng(3410)
    for (let x = -3.4, i = 0; x < 3.6; x += 0.3 + r() * 0.08, i++) {
      const [x0, y0] = pt(x, FLOOR, -c.ZW), [x1, y1] = pt(x, 2.6, -c.ZW)
      if (i % 2) {
        const [x2] = pt(x + 0.3, FLOOR, -c.ZW)
        g.fillStyle = rgba(T.dark ? T.ink3 : T.card, T.dark ? 0.03 : 0.07)
        g.fillRect(x0, y1, x2 - x0, y0 - y1)
      }
      inkLine(g, [[x0, y0], [x0 + (r() - 0.5) * 2, (y0 + y1) / 2], [x1, y1]], 1.4, T.wash, T.dark ? 0.5 : 0.25, 0.02, 0.02, 0.6)
      for (let k = 0; k < 2; k++) {
        const gy = y1 + (y0 - y1) * r(), gx = x0 + 4 + r() * 18
        inkLine(g, [[gx, gy], [gx + (r() - 0.5) * 3, gy + 30 + r() * 60]], 0.9, T.wash, T.dark ? 0.25 : 0.12, 0.3, 0.3, 0.1)
      }
    }
    yield
    // the workshop lamp, off the top left: a warm pool on the wall
    const [lx, ly] = pt(-1.9, 1.5, -c.ZW)
    soft(g, lx, ly, S * 2.4, S * 1.9, T.lantern, T.dark ? 0.34 : 0.3)
    const [w0x, w0y] = pt(c.win[0], c.win[2], -c.ZW), [w1x, w1y] = pt(c.win[1], c.win[3], -c.ZW)
    const wcx = (w0x + w1x) / 2, wcy = (w0y + w1y) / 2, ww = w1x - w0x, wh = w0y - w1y
    soft(g, wcx, wcy + wh * 0.1, ww * 1.6, wh * 1.5, T.moon, T.dark ? 0.18 : 0.32)
    // the jar's shadow thrown right onto the wall by the lamp
    const [sx, sy] = pt(0.62, 0.48, -c.ZW)
    soft(g, sx, sy, S * 0.58, S * 0.6, T.umbra, T.dark ? 0.35 : 0.2)
    // window: night sky, far hills, the moon, a pine twig, then frame and lattice
    g.save()
    g.beginPath()
    g.rect(w0x, w1y, ww, wh)
    g.clip()
    g.fillStyle = vgrad(g, w1y, w0y, T.dark ? [[0, T.wash, 1], [1, mix(T.paper, T.mist, 0.12), 1]] : [[0, mix(T.water, T.ink2, 0.3), 1], [0.7, mix(T.water, T.card, 0.4), 1], [1, mix(T.card, T.moon, 0.3), 1]])
    g.fillRect(w0x, w1y, ww, wh)
    const mr = Math.max(7, ww * 0.13)
    moonDisc(g, T, w0x + ww * 0.4, w1y + wh * 0.32, mr, 34, 0.9, false)
    mountains(g, T, w0x - 10, w1x + 10, w0y + 2, wh * 0.32, 3411, 2, 0.8)
    soft(g, wcx, w0y - wh * 0.08, ww * 0.8, wh * 0.14, T.mist, T.dark ? 0.25 : 0.7)
    const tw: Pt[] = [[w0x - 4, w1y + wh * 0.12], [w0x + ww * 0.3, w1y + wh * 0.2], [w0x + ww * 0.55, w1y + wh * 0.16]]
    inkLine(g, tw, Math.max(1.5, ww * 0.022), T.wash, 0.9, 0.05, 0.4)
    for (let i = 0; i < 3; i++) {
      const [px, py] = tw[i === 2 ? 2 : 1]
      for (let k = 0; k < 7; k++) {
        const a = -1.2 + k * 0.42 - i
        inkLine(g, [[px, py], [px + Math.cos(a) * ww * 0.09, py + Math.sin(a) * ww * 0.07]], 1.1, T.wash, 0.75, 0.05, 0.6)
      }
    }
    g.restore()
    const fw = Math.max(5, ww * 0.06)
    g.strokeStyle = rgba(pal.wood[0])
    g.lineWidth = fw
    g.strokeRect(w0x - fw / 2, w1y - fw / 2, ww + fw, wh + fw)
    g.strokeStyle = rgba(mix(pal.wood[2], T.moon, 0.2), T.dark ? 0.35 : 0.6)
    g.lineWidth = 1
    g.strokeRect(w0x - fw, w1y - fw, ww + fw * 2, wh + fw * 2)
    g.fillStyle = rgba(pal.wood[0], 0.9)
    g.fillRect(wcx - 1.2, w1y, 2.4, wh)
    g.fillRect(w0x, w1y + wh * 0.42 - 1.2, ww, 2.4)
    g.fillStyle = rgba(pal.wood[1])
    g.fillRect(w0x - fw * 1.6, w0y + fw * 0.4, ww + fw * 3.2, fw * 0.9) // sill
    yield
    // floor, deeper toward us, warm under the lamp
    g.fillStyle = vgrad(g, wb, HB, [[0, pal.floor, 1], [1, mix(pal.floor, T.umbra, 0.4), 1]])
    g.fillRect(0, wb, W, HB - wb)
    soft(g, ...pt(-1.0, FLOOR, 0.6), S * 1.8, S * 0.5, T.lantern, T.dark ? 0.12 : 0.12)
    // the moonbeam from the window into the jar's mouth: a soft column with dust standing in it
    beam(g, 1)
    grain(g, 0, 0, W, HB, T.dark ? 0.06 : 0.08)
  }
  function beamEnds(): [Pt, Pt, number, number] {
    const c = cp!
    const a = pt(c.win[0] + (c.win[1] - c.win[0]) * 0.45, c.win[2] + (c.win[3] - c.win[2]) * 0.45, -c.ZW)
    const b = pt(0.02, 1.02, 0)
    const [w0x] = pt(c.win[0], 0, -c.ZW), [w1x] = pt(c.win[1], 0, -c.ZW)
    return [a, b, (w1x - w0x) * 0.55, S * ri(1) * 1.3]
  }
  /** the beam as many thin strips across its width, each fading along its length, the whole fading at its edges */
  function beam(g: CanvasRenderingContext2D, k: number) {
    const [a, b, wa, wb] = beamEnds()
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1
    const nx = -dy / l, ny = dx / l
    g.save()
    g.globalCompositeOperation = T.dark ? 'screen' : 'source-over'
    const strips = lowQ ? 10 : 22
    for (let i = 0; i < strips; i++) {
      const u0 = i / strips - 0.5, u1 = (i + 1) / strips - 0.5
      const bell = Math.exp(-(((u0 + u1) / 2) ** 2) * 9)
      const p0: Pt = [a[0] + nx * wa * u0, a[1] + ny * wa * u0], p1: Pt = [a[0] + nx * wa * u1, a[1] + ny * wa * u1]
      const q1: Pt = [b[0] + nx * wb * u1, b[1] + ny * wb * u1], q0: Pt = [b[0] + nx * wb * u0, b[1] + ny * wb * u0]
      const gr = g.createLinearGradient(a[0], a[1], b[0], b[1])
      gr.addColorStop(0, rgba(T.moon, (T.dark ? 0.2 : 0.42) * k * bell))
      gr.addColorStop(0.75, rgba(T.moon, (T.dark ? 0.1 : 0.2) * k * bell))
      gr.addColorStop(1, rgba(T.moon, (T.dark ? 0.04 : 0.08) * k * bell))
      g.fillStyle = gr
      poly(g, [p0, p1, q1, q0])
      g.fill()
    }
    for (const [u, v, rr, al] of DUST) {
      const x = lerp(a[0], b[0], u) + nx * lerp(wa, wb, u) * v, y = lerp(a[1], b[1], u) + ny * lerp(wa, wb, u) * v
      soft(g, x, y, rr * 2.4, rr * 2.4, T.moon, (0.15 + al * 0.35) * k * Math.exp(-v * v * 4))
      g.fillStyle = rgba(mix(T.moon, [255, 255, 255, 1], 0.4), (0.25 + al * 0.5) * k * Math.exp(-v * v * 4))
      g.beginPath()
      g.arc(x, y, rr * 0.55, 0, 6.3)
      g.fill()
    }
    g.restore()
  }

  // ── the bench, the jar, the rack (static) — in three parts so the first paint can soak in
  function drawMid(part: number) {
    run(midG(part))
  }
  function* midG(part: number) {
    const c = cp!
    const g = mid.g
    if (part === 0) {
      mid.clear()
      bench(g, c)
      return
    }
    if (part === 1) {
      jarShadows(g)
      jarInside(g)
      yield
      faces(g)
      yield* jarBody(g)
      return
    }
    yield* jarDetails(g)
    rack(g, c)
  }

  function bench(g: CanvasRenderingContext2D, c: Comp) {
    const [x0, x1, z0, z1] = c.bench
    const top = [pt(x0, 0, z0), pt(x1, 0, z0), pt(x1, 0, z1), pt(x0, 0, z1)]
    const ap = [pt(x0, 0, z1), pt(x1, 0, z1), pt(x1, -AP, z1), pt(x0, -AP, z1)]
    const [fx0, fy0] = pt((x0 + x1) / 2, FLOOR, (z0 + z1) / 2)
    soft(g, fx0, fy0, (top[1][0] - top[0][0]) * 0.55, S * 0.22, T.umbra, T.dark ? 0.5 : 0.3)
    for (const [lx, lz] of [[x0 + 0.12, z1 - 0.06], [x1 - 0.12, z1 - 0.06], [x0 + 0.16, z0 + 0.08], [x1 - 0.16, z0 + 0.08]]) {
      const a = pt(lx - 0.045, -AP, lz), b = pt(lx + 0.045, -AP, lz), cc = pt(lx + 0.045, FLOOR, lz), d = pt(lx - 0.045, FLOOR, lz)
      g.fillStyle = vgrad(g, a[1], d[1], [[0, lz < 0 ? mix(pal.wood[0], T.umbra, 0.4) : pal.wood[0], 1], [1, T.umbra, T.dark ? 0.9 : 0.6]])
      poly(g, [a, b, cc, d])
      g.fill()
    }
    // the top: lamp-warm on the left, cooler toward the window; planks and grain
    g.fillStyle = (() => {
      const gr = g.createLinearGradient(top[0][0], 0, top[1][0], 0)
      gr.addColorStop(0, rgba(pal.wood[2]))
      gr.addColorStop(0.5, rgba(pal.wood[1]))
      gr.addColorStop(1, rgba(mix(pal.wood[1], T.wash, T.dark ? 0.25 : 0.2)))
      return gr
    })()
    poly(g, top)
    g.fill()
    g.fillStyle = vgrad(g, top[0][1], top[3][1], [[0, T.umbra, T.dark ? 0.35 : 0.15], [1, T.umbra, 0]])
    poly(g, top)
    g.fill()
    const r = rng(3420)
    for (let k = 1; k < 3; k++) {
      const z = z0 + ((z1 - z0) * k) / 3
      inkLine(g, [pt(x0, 0, z), pt(x1, 0, z + 0.004)], 1.2, T.wash, T.dark ? 0.55 : 0.3, 0.01, 0.01, 0.7)
    }
    for (let k = 0; k < 30; k++) {
      const z = z0 + (z1 - z0) * r(), x = x0 + (x1 - x0) * r(), l = 0.15 + r() * 0.4
      inkLine(g, [pt(x, 0, z), pt(x + l, 0, z + (r() - 0.5) * 0.01)], 0.8, T.wash, T.dark ? 0.3 : 0.15, 0.3, 0.3, 0.1)
    }
    // the plank's front face: its thickness, darker, with a bright lamp-lit edge along the top
    g.fillStyle = vgrad(g, ap[0][1], ap[3][1], [[0, mix(pal.wood[1], T.umbra, 0.15), 1], [0.25, pal.wood[0], 1], [1, mix(pal.wood[0], T.umbra, 0.4), 1]])
    poly(g, ap)
    g.fill()
    for (let k = 0; k < 6; k++) {
      const x = x0 + (x1 - x0) * r(), l = 0.2 + r() * 0.5, y = -AP * (0.3 + r() * 0.5)
      inkLine(g, [pt(x, y, z1), pt(x + l, y, z1)], 0.8, T.umbra, 0.3, 0.3, 0.3, 0.1)
    }
    const eg = g.createLinearGradient(ap[0][0], 0, ap[1][0], 0)
    eg.addColorStop(0, rgba(mix(T.lantern, T.moon, 0.3), T.dark ? 0.75 : 0.95))
    eg.addColorStop(0.6, rgba(mix(T.lantern, T.moon, 0.5), T.dark ? 0.35 : 0.55))
    eg.addColorStop(1, rgba(T.moon, T.dark ? 0.2 : 0.4))
    g.fillStyle = eg
    poly(g, [ap[0], ap[1], [ap[1][0], ap[1][1] + 2.2], [ap[0][0], ap[0][1] + 2.2]])
    g.fill()
    inkLine(g, [ap[3], ap[2]], 1.8, T.wash, 0.6, 0.02, 0.02, 0.7)
    soft(g, ...pt(-0.7, 0, 0.1), S * 1.5, S * 0.32, T.lantern, T.dark ? 0.22 : 0.18)
    grain(g, top[0][0], top[0][1], top[1][0] - top[0][0], ap[3][1] - top[0][1], T.dark ? 0.1 : 0.12)
  }

  function jarShadows(g: CanvasRenderingContext2D) {
    // the moon (back right, high) lays a long shadow forward and left over the bench; the lamp's falls back right
    const [ax, ay] = pt(-0.6, 0, 0.32)
    soft(g, ax, ay, S * 0.95, S * 0.16, T.umbra, T.dark ? 0.45 : 0.3, 0.22)
    const [bx, by] = pt(0.45, 0, -0.28)
    soft(g, bx, by, S * 0.6, S * 0.14, T.umbra, T.dark ? 0.4 : 0.22, -0.1)
    // the foot sits in the bench: a tight dark ring of contact under it
    const [fx0, fy0] = pt(0, 0, 0)
    soft(g, fx0, fy0 + 1, S * 0.3, S * 0.3 * se + 4, T.umbra, T.dark ? 0.9 : 0.65, 0, 0.62)
  }

  /** points of a horizontal circle (radius r at y) from φ a to b */
  function ring(g: CanvasRenderingContext2D, r: number, y: number, a: number, b: number, move: boolean, n = 0) {
    const m = n || Math.max(4, Math.ceil(Math.abs(b - a) / 0.08))
    for (let k = 0; k <= m; k++) {
      pr(r, y, a + ((b - a) * k) / m)
      if (k === 0 && move) g.moveTo(PX, PY)
      else g.lineTo(PX, PY)
    }
  }
  /** a profile line in the cut plane φ: radius R(y) from y0 to y1 */
  function profile(g: CanvasRenderingContext2D, R: (y: number) => number, ph: number, y0: number, y1: number, move: boolean, n = 30) {
    for (let k = 0; k <= n; k++) {
      const y = y0 + ((y1 - y0) * k) / n
      pr(R(y), y, ph)
      if (k === 0 && move) g.moveTo(PX, PY)
      else g.lineTo(PX, PY)
    }
  }
  /** the open notch seen through the cut (between the two faces' inner edges) and the mouth, as one clip path */
  function opening(g: CanvasRenderingContext2D, begin = true) {
    if (begin) g.beginPath()
    profile(g, ri, PA, YIN, 1, true)
    ring(g, ri(1), 1, PA, PB - 2 * Math.PI, false)
    profile(g, ri, PB, 1, YIN, false)
    pj(0, YIN, 0)
    g.lineTo(PX, PY)
    g.closePath()
  }

  /** what the cut shows behind the water: the jar's inside back wall, lit warm through the notch, the carved rings */
  function jarInside(g: CanvasRenderingContext2D) {
    g.save()
    opening(g)
    g.clip()
    const [lx] = pt(-ro(0.5), 0.5, 0), [rx] = pt(ro(0.5), 0.5, 0)
    const gr = g.createLinearGradient(lx, 0, rx, 0)
    gr.addColorStop(0, rgba(pal.inner[0]))
    gr.addColorStop(0.55, rgba(pal.inner[1]))
    gr.addColorStop(1, rgba(mix(pal.inner[1], T.lantern, 0.25)))
    g.fillStyle = gr
    g.fillRect(0, 0, W, HB)
    const [, ty] = pt(0, 1, 0), [, by] = pt(0, YIN, 0)
    g.fillStyle = vgrad(g, ty - S * 0.2, by, [[0, T.umbra, T.dark ? 0.7 : 0.5], [0.4, T.umbra, 0.08], [1, T.umbra, T.dark ? 0.6 : 0.35]])
    g.fillRect(0, 0, W, HB)
    // the moonbeam through the mouth lands on the back of the inside
    const [mx, my] = pt(-0.08, 0.6, -0.3)
    soft(g, mx, my, S * 0.22, S * 0.32, T.moon, T.dark ? 0.3 : 0.35)
    // carved rings on the inner back wall, every tenth of the volume
    for (let i = 0; i < MARKS.length; i++) {
      const y = MARKS[i], r = ri(y) * 0.999
      g.beginPath()
      ring(g, r, y, Math.PI * 0.55, Math.PI * 1.45, true)
      g.strokeStyle = rgba(T.umbra, T.dark ? 0.7 : 0.5)
      g.lineWidth = i === 4 ? 1.7 : 1.1
      g.stroke()
      g.beginPath()
      ring(g, r, y - 0.006, Math.PI * 0.55, Math.PI * 1.45, true)
      g.strokeStyle = rgba(T.dark ? T.moon : T.card, T.dark ? 0.14 : 0.4)
      g.lineWidth = 0.8
      g.stroke()
    }
    // the dry floor (shows when the jar is empty): crazed clay
    const fr = rng(3430)
    g.beginPath()
    for (let i = 0; i < 18; i++) {
      let a = Math.PI * (0.55 + fr() * 1.2), rr = fr() * 0.17
      pr(rr, YIN, a)
      g.moveTo(PX, PY)
      for (let k = 0; k < 3; k++) {
        a += (fr() - 0.5) * 0.8
        rr = Math.min(ri(YIN + 0.01), rr + 0.05)
        pr(rr, YIN, a)
        g.lineTo(PX, PY)
      }
    }
    g.strokeStyle = rgba(T.umbra, 0.55)
    g.lineWidth = 0.8
    g.stroke()
    g.restore()
  }

  /** the two faces of the cut: the clay wall in section, its thickness lighter than the glaze, with the grain of the clay */
  function faces(g: CanvasRenderingContext2D) {
    for (const ph of [PB, PA]) {
      g.beginPath()
      profile(g, ro, ph, 0, 1, true, 48)
      profile(g, ri, ph, 1, YIN, false, 48)
      pj(0, YIN, 0)
      g.lineTo(PX, PY)
      pj(0, 0, 0)
      g.lineTo(PX, PY)
      g.closePath()
      const [ax] = pt(0, 0.5, 0)
      pr(ro(0.5), 0.5, ph)
      const gr = g.createLinearGradient(ax, 0, PX, 0)
      gr.addColorStop(0, rgba(mix(pal.clay, T.umbra, 0.25)))
      // the broad face turns to the lamp; the narrow one is seen edge-on, in shade
      gr.addColorStop(1, rgba(ph === PA ? pal.clayLit : mix(pal.clay, T.umbra, 0.28)))
      g.fillStyle = gr
      g.fill()
      // the grain: strokes running along the wall inside the band, the base slab's own
      const r = rng(ph === PA ? 3431 : 3432)
      for (let k = 0; k < 9; k++) {
        const f = 0.2 + r() * 0.6, y0 = 0.08 + r() * 0.6, y1 = Math.min(0.99, y0 + 0.12 + r() * 0.3)
        const pts: Pt[] = []
        for (let j = 0; j <= 10; j++) {
          const y = y0 + ((y1 - y0) * j) / 10
          pr(lerp(ri(y), ro(y), f), y, ph)
          pts.push([PX, PY])
        }
        inkLine(g, pts, 0.8, T.umbra, 0.3, 0.3, 0.3, 0.1)
      }
      for (let k = 0; k < 5; k++) {
        const y = YIN * (0.2 + r() * 0.6), a = r() * 0.6, b = a + 0.2 + r() * 0.3
        inkLine(g, [pt(Math.sin(ph) * ro(y) * a, y, Math.cos(ph) * ro(y) * a), pt(Math.sin(ph) * ro(y) * b, y, Math.cos(ph) * ro(y) * b)], 0.8, T.umbra, 0.28, 0.3, 0.3, 0.1)
      }
      // the scale: a notch at each tenth on the inner edge, the half mark longer
      for (let i = 0; i < MARKS.length; i++) {
        const y = MARKS[i]
        const a = pt(Math.sin(ph) * ri(y), y, Math.cos(ph) * ri(y)), b = pt(Math.sin(ph) * (ri(y) + TH * (i === 4 ? 0.9 : 0.55)), y, Math.cos(ph) * (ri(y) + TH * (i === 4 ? 0.9 : 0.55)))
        inkLine(g, [a, b], i === 4 ? 1.8 : 1.2, T.wash, 0.85, 0.1, 0.1, 0.5)
      }
      // a clean cut: an ink line along its outer edge, a lit line on the inner one
      g.beginPath()
      profile(g, ro, ph, 0.01, 0.995, true, 40)
      g.strokeStyle = rgba(T.wash, 0.55)
      g.lineWidth = 1
      g.stroke()
      g.beginPath()
      profile(g, ri, ph, YIN + 0.01, 0.995, true, 40)
      g.strokeStyle = rgba(mix(T.lantern, T.moon, 0.4), T.dark ? 0.3 : 0.55)
      g.lineWidth = 0.8
      g.stroke()
    }
  }

  /** the glazed outer body: painted ring by ring, bottom to top, each band lit by its own gradient; the wedge left open */
  function* jarBody(g: CanvasRenderingContext2D) {
    const NB = lowQ ? 64 : 116
    for (let i = 0; i < NB; i++) {
      if (i % 30 === 29) yield
      const y0 = i / NB, y1 = Math.min(1, (i + 1.35) / NB), ym = (i + 0.5) / NB
      const r0 = ro(y0), r1 = ro(y1), rm = ro(ym)
      const phv = Math.acos(clamp(sl(ym) * te, -1, 1))
      pr(rm, ym, -Math.PI / 2)
      const xa = PX
      pr(rm, ym, Math.PI / 2)
      const gr = g.createLinearGradient(xa, 0, PX, 0)
      for (let j = 0; j <= 14; j++) gr.addColorStop(j / 14, glazeAt(Math.asin(clamp(-1 + j / 7, -1, 1)), ym))
      g.fillStyle = gr
      g.beginPath()
      if (-phv < PA) band(g, -phv, PA, r0, y0, r1, y1)
      if (PB < phv) band(g, PB, phv, r0, y0, r1, y1)
      g.fill()
    }
    // the lip: the top of the rim round the three quarters still standing
    g.beginPath()
    ring(g, ro(1), 1, PB, PA + 2 * Math.PI, true, 40)
    ring(g, ri(1), 1, PA + 2 * Math.PI, PB, false, 40)
    g.closePath()
    g.fillStyle = rgba(mix(pal.glaze[4], T.moon, 0.2))
    g.fill()
  }
  function band(g: CanvasRenderingContext2D, a: number, b: number, r0: number, y0: number, r1: number, y1: number) {
    const n = Math.max(3, Math.ceil(Math.abs(b - a) / 0.09))
    for (let k = 0; k <= n; k++) {
      pr(r0, y0, a + ((b - a) * k) / n)
      if (k) g.lineTo(PX, PY)
      else g.moveTo(PX, PY)
    }
    for (let k = n; k >= 0; k--) {
      pr(r1, y1, a + ((b - a) * k) / n)
      g.lineTo(PX, PY)
    }
    g.closePath()
  }

  /** crackle round the belly, wash blooms, the contour (heavy on the shade side), the moon's rim, the lamp's shine */
  function* jarDetails(g: CanvasRenderingContext2D) {
    g.beginPath()
    for (const line of CRACKS) {
      let pen = false
      for (let k = 0; k < line.length; k += 2) {
        const ph = line[k], y = line[k + 1]
        const vis = Math.cos(ph) > sl(y) * te + 0.1 && y > 0.03 && y < 0.97 && !inCut(ph) && !inCut(ph - 0.03) && !inCut(ph + 0.03)
        if (!vis) {
          pen = false
          continue
        }
        pr(ro(y) * 1.002, y, ph)
        if (pen) g.lineTo(PX, PY)
        else g.moveTo(PX, PY)
        pen = true
      }
    }
    g.strokeStyle = rgba(T.dark ? T.umbra : T.wash, T.dark ? 0.55 : 0.3)
    g.lineWidth = 0.75
    g.stroke()
    yield
    {
      g.save()
      g.beginPath()
      silhouette(g)
      g.closePath()
      g.clip()
      const r = rng(3440)
      for (let i = 0; i < 14; i++) {
        const ph = PB + 0.1 + r() * 1.4, y = 0.12 + r() * 0.78
        pr(ro(y), y, ph)
        soft(g, PX, PY, S * (0.06 + r() * 0.1), S * (0.04 + r() * 0.07), T.umbra, (T.dark ? 0.14 : 0.08) * (ph > 0.8 ? 1.3 : 0.7), r() * 3)
      }
      // dry strokes down the shaded flank
      for (let i = 0; i < 7; i++) {
        const ph = 1.05 + r() * 0.4, y0 = 0.15 + r() * 0.3, y1 = y0 + 0.25 + r() * 0.3
        const pts: Pt[] = []
        for (let k = 0; k <= 8; k++) {
          const y = y0 + ((y1 - y0) * k) / 8
          pr(ro(y) * 1.001, y, ph - k * 0.01)
          pts.push([PX, PY])
        }
        inkLine(g, pts, S * (0.008 + r() * 0.01), T.umbra, T.dark ? 0.24 : 0.14, 0.3, 0.4, 0.1)
      }
      g.restore()
    }
    yield
    // the contour where each band turns away: heavy on the shaded right, lighter on the lamp side
    const L: Pt[] = [], R: Pt[] = []
    for (let k = 0; k <= 48; k++) {
      const y = 0.01 + (0.985 * k) / 48, r = ro(y)
      const phv = Math.acos(clamp(sl(y) * te, -1, 1))
      L.push(pt(-r * Math.sin(phv), y, r * Math.cos(phv)))
      R.push(pt(r * Math.sin(phv), y, r * Math.cos(phv)))
    }
    const w = Math.max(1.4, S * 0.0075)
    inkLine(g, R.slice(1, 46), w * 1.7, T.wash, T.dark ? 0.95 : 0.85, 0.08, 0.2, 0.25)
    inkLine(g, L.slice(4, 22), w * 0.8, T.wash, 0.55, 0.2, 0.3, 0.2)
    inkLine(g, L.slice(26, 44), w * 0.7, T.wash, 0.5, 0.3, 0.3, 0.2)
    // the moon's cool rim just inside the right edge (an ink line by day), the lamp's warm one on the left sliver
    inkLine(g, R.slice(8, 44).map(([x, y]) => [x - w * 1.5, y] as Pt), w * 1.1, T.dark ? mix(T.moon, T.mist, 0.3) : T.card, T.dark ? 0.6 : 0.85, 0.25, 0.3, 0.1)
    inkLine(g, L.slice(10, 40).map(([x, y]) => [x + w * 1.2, y] as Pt), w * 0.8, T.lantern, T.dark ? 0.55 : 0.6, 0.25, 0.3, 0.1)
    // the lamp's shine on the front shoulder, just right of the cut
    pr(ro(0.64), 0.64, PB + 0.22)
    soft(g, PX, PY, S * 0.04, S * 0.1, T.dark ? T.lantern : T.card, T.dark ? 0.5 : 0.85, -0.15)
    soft(g, PX - S * 0.005, PY - S * 0.02, S * 0.015, S * 0.04, [255, 255, 255, 1], T.dark ? 0.4 : 0.75, -0.15)
    // foot ring, the lip's outer edge and its moonlit front, the cut lip's ends
    g.beginPath()
    ring(g, ro(0.004), 0.004, PB, 1.3, true)
    g.strokeStyle = rgba(T.wash, 0.7)
    g.lineWidth = w
    g.stroke()
    g.beginPath()
    ring(g, ro(1), 1, PB, PA + 2 * Math.PI, true, 40)
    g.strokeStyle = rgba(T.wash, 0.75)
    g.lineWidth = w * 0.8
    g.stroke()
    g.beginPath()
    ring(g, ro(1), 0.997, PB, 1.3, true)
    g.strokeStyle = rgba(T.dark ? T.moon : T.card, T.dark ? 0.4 : 0.85)
    g.lineWidth = 1
    g.stroke()
    g.save()
    g.beginPath()
    silhouette(g)
    g.closePath()
    g.clip()
    grain(g, ...pt(-0.55, 1.02, 0), S * 1.1, S * 1.1, T.dark ? 0.07 : 0.09)
    g.restore()
  }

  /** the bamboo rack the ladles hang from */
  function rack(g: CanvasRenderingContext2D, c: Comp) {
    const [x, y0, z] = c.rack
    const top = y0 + 0.82
    soft(g, ...pt(x, y0, z + 0.02), S * 0.38, S * 0.06, T.umbra, T.dark ? 0.55 : 0.3)
    for (const dx of [-0.25, 0.25]) bambooPole(g, pt(x + dx, y0, z), pt(x + dx, top + 0.03, z), Math.max(3, S * 0.024))
    bambooPole(g, pt(x - 0.32, top, z), pt(x + 0.32, top - 0.005, z), Math.max(3, S * 0.022))
  }
  function bambooPole(g: CanvasRenderingContext2D, a: Pt, b: Pt, w: number) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1
    const nx = -dy / l, ny = dx / l
    const gr = g.createLinearGradient(a[0] - nx * w, a[1] - ny * w, a[0] + nx * w, a[1] + ny * w)
    gr.addColorStop(0, rgba(pal.bamboo[2]))
    gr.addColorStop(0.45, rgba(pal.bamboo[1]))
    gr.addColorStop(1, rgba(pal.bamboo[0]))
    g.strokeStyle = gr
    g.lineWidth = w
    g.lineCap = 'round'
    g.beginPath()
    g.moveTo(a[0], a[1])
    g.lineTo(b[0], b[1])
    g.stroke()
    for (let t = 0.22; t < 1; t += 0.26) {
      const x = a[0] + dx * t, y = a[1] + dy * t
      inkLine(g, [[x - nx * w * 0.6, y - ny * w * 0.6], [x + nx * w * 0.6, y + ny * w * 0.6]], 1.2, T.wash, 0.6, 0.1, 0.1, 0.5)
    }
  }

  // ── the moving layer: water, collars, hourglasses, cup, the ladle and its stream
  function drawFx() {
    if (!cp) return
    const c = cp
    const g = fx.g
    fx.clear()
    const lv = fillA.t >= 0 ? lerp(fillA.l0, 100, ease(seg(fillA.t, 0.25, 1.35))) : an.t >= 0 ? lerp(an.l0, an.l1, ease(seg(an.t, 0.95, 1.3))) : level
    const hh = levelY(lv)
    const tilt = slosh * Math.sin(sloshT * 9)
    if (fillA.t >= 0) beam(g, 1 + 2.2 * Math.sin(Math.PI * seg(fillA.t, 0, 1.8)))
    water(g, hh, tilt)
    g.save()
    g.globalAlpha = 1 - 0.85 * ease(lookU)
    const glow = (p: V3, k: number) => soft(g, ...pt(p[0], p[1], p[2]), S * 0.2 * k, S * 0.06 * k, T.lantern, T.dark ? 0.4 : 0.3)
    const ladleHome = ladleRest(pick[0])
    glow([ladleHome[0], c.rack[1], c.rack[2]], 1.3)
    glow([c.glass[0] + (pick[2] ? 0.09 : -0.09), c.glass[1], c.glass[2]], 0.9)
    for (let k = 0; k < 2; k++) if (ringU[k] < 0.999) collar(g, k)
    glasses(g)
    teaCup(g)
    // before the first scoop: a faint dotted arc from the chosen ladle to the mouth (drag it there)
    if (!made && an.t < 0 && !drag) hintArc(g)
    g.restore()
    for (let k = 0; k < 2; k++) if (ringU[k] >= 0.999) collar(g, k)
    if (streak > 0 || wet > 0) spill(g)
    for (let k = 0; k < 2; k++) if ((k !== an.kind || an.t < 0) && drag?.k !== k) ladleAt(g, k, ladleRest(k), 0, 0, pick[0] === k)
    if (an.t >= 0) ladleFly(g, hh)
    if (drag) dragLadle(g)
  }

  function water(g: CanvasRenderingContext2D, hh: number, tilt: number) {
    if (hh <= YIN + 0.004) return
    const rh = ri(hh)
    const sy = (r: number, ph: number) => hh + tilt * r * (Math.sin(ph) * 0.6 + Math.cos(ph) * 0.8)
    g.save()
    opening(g)
    g.clip()
    // the surface: three quarters of an ellipse (the front quarter is cut away), lighter toward the back
    g.beginPath()
    pj(0, hh, 0)
    g.moveTo(PX, PY)
    for (let k = 0; k <= 36; k++) {
      const p = PB + ((2 * Math.PI - (PB - PA)) * k) / 36
      pr(rh, sy(rh, p), p)
      g.lineTo(PX, PY)
    }
    g.closePath()
    const [, sty] = pt(0, hh, -rh), [, sby] = pt(0, hh, rh)
    g.fillStyle = vgrad(g, sty, sby, [[0, mix(pal.water, T.dark ? T.moon : T.card, 0.22), 1], [1, mix(pal.water, T.umbra, 0.2), 1]])
    g.fill()
    const mk = smooth(0.12, 0.85, hh)
    // the moon in it: a bright ellipse toward the back, broken by a few dry strokes
    const [rx, ry] = pt(0.1 * rh, hh, -0.45 * rh)
    soft(g, rx, ry, S * rh * 0.45, S * rh * 0.45 * se + 2, T.moon, (T.dark ? 0.7 : 0.85) * mk)
    g.beginPath()
    g.ellipse(rx, ry, S * rh * 0.16, Math.max(1.5, S * rh * 0.16 * se), 0, 0, Math.PI * 2)
    g.fillStyle = rgba(mix(T.moon, [255, 255, 255, 1], 0.35), 0.9 * mk)
    g.fill()
    for (let i = 0; i < 4; i++) {
      const yy = ry - S * rh * se * 0.22 + i * S * rh * se * 0.15, ww = S * rh * (0.36 - Math.abs(i - 1.5) * 0.08)
      inkLine(g, [[rx - ww / 2, yy], [rx + ww / 2, yy + 0.4]], 1.4, T.moon, 0.75 * mk, 0.3, 0.3, 0.1)
    }
    // the two faces of the water column, darkening with depth
    for (const ph of [PB, PA]) {
      g.beginPath()
      pj(0, YIN, 0)
      g.moveTo(PX, PY)
      for (let k = 0; k <= 24; k++) {
        const y = YIN + ((hh - YIN) * k) / 24
        pr(ri(y), k === 24 ? sy(rh, ph) : y, ph)
        g.lineTo(PX, PY)
      }
      pj(0, hh, 0)
      g.lineTo(PX, PY)
      g.closePath()
      const [, ty] = pt(0, hh, 0), [, by] = pt(0, YIN, 0)
      g.fillStyle = vgrad(g, ty, by, [[0, mix(pal.water, T.moon, T.dark ? 0.14 : 0.12), 1], [0.35, pal.water, 1], [1, pal.deep, 1]])
      g.fill()
      if (ph === PB) {
        g.fillStyle = rgba(T.umbra, T.dark ? 0.25 : 0.15)
        g.fill()
      }
    }
    // the meniscus: a bright edge round the surface and along the section's top, read against the notches
    g.beginPath()
    for (let k = 0; k <= 36; k++) {
      const p = PB + ((2 * Math.PI - (PB - PA)) * k) / 36
      pr(rh * 0.995, sy(rh, p), p)
      if (k) g.lineTo(PX, PY)
      else g.moveTo(PX, PY)
    }
    g.strokeStyle = rgba(T.dark ? T.moon : T.card, T.dark ? 0.55 : 0.85)
    g.lineWidth = 1.2
    g.stroke()
    for (const ph of [PA, PB]) {
      const a = pt(0, hh, 0), b = (pr(rh, sy(rh, ph), ph), [PX, PY] as Pt)
      inkLine(g, [a, b], 1.6, T.dark ? T.moon : T.card, T.dark ? 0.7 : 0.95, 0.04, 0.04, 0.6)
      inkLine(g, [[a[0], a[1] + 2], [b[0], b[1] + 2]], 1, T.wash, T.dark ? 0.5 : 0.3, 0.04, 0.04, 0.6)
    }
    // the section of the column: faint bands of light caught in it, thinning with depth
    for (let i = 1; i < 6; i++) {
      const y = hh - (hh - YIN) * (i / 6) * (0.9 + 0.1 * noise(i, 2))
      const a = pt(0, y, 0), b = (pr(ri(y) * 0.96, y, PA), [PX, PY] as Pt)
      inkLine(g, [a, b], 1 + (6 - i) * 0.25, T.moon, (T.dark ? 0.1 : 0.16) * (1 - i / 7), 0.3, 0.3, 0.1)
    }
    // light falling through the water from the mouth
    if (!lowQ) {
      g.save()
      g.globalCompositeOperation = T.dark ? 'screen' : 'soft-light'
      for (let i = 0; i < 3; i++) {
        const [ax, ay] = pt(-0.05 - i * 0.07, hh, 0.12), [bx, by2] = pt(-0.02 - i * 0.12, Math.max(YIN, hh - 0.45), 0.2)
        soft(g, (ax + bx) / 2, (ay + by2) / 2, S * 0.03, Math.max(4, (by2 - ay) * 0.6), T.moon, (0.22 - i * 0.05) * mk, 0.2)
      }
      g.restore()
    }
    g.restore()
  }

  /** neck hoops: two thin bent-wood rings lying on the bench, one narrow, one wide; the chosen one flies up round the lip */
  function collar(g: CanvasRenderingContext2D, k: number) {
    const c = cp!
    const u = ease(ringU[k])
    const home = c.rings[k]
    const R = k ? 0.33 : 0.25, tube = 0.011
    const x = lerp(home[0], 0, u), z = lerp(home[2], 0, u)
    const y = lerp(home[1] + tube, 0.965, u) + Math.sin(Math.PI * u) * 0.36
    const [X, Y] = pt(x, y, z)
    const rx = S * R, ry = S * R * se
    if (u < 0.5) {
      const [sx, sy] = pt(home[0] - 0.04, home[1], home[2] - 0.02)
      g.save()
      g.globalAlpha = 1 - u * 2
      g.beginPath()
      g.ellipse(sx, sy + 1, rx, ry, 0, 0, Math.PI * 2)
      g.strokeStyle = rgba(T.umbra, T.dark ? 0.5 : 0.3)
      g.lineWidth = S * tube * 3
      g.stroke()
      g.restore()
    }
    const w = Math.max(2.4, S * tube * 2)
    // the hoop: a band of light wood, darker underneath, a fine grain of dashes, lamp light on its left
    g.beginPath()
    g.ellipse(X, Y, rx, ry, 0, 0, Math.PI * 2)
    g.strokeStyle = rgba(pal.hoop[1])
    g.lineWidth = w
    g.stroke()
    g.beginPath()
    g.ellipse(X, Y + w * 0.25, rx, ry, 0, 0.05 * Math.PI, 0.95 * Math.PI)
    g.strokeStyle = rgba(pal.hoop[0], 0.9)
    g.lineWidth = w * 0.55
    g.stroke()
    g.setLineDash([S * 0.03, S * 0.02, S * 0.012, S * 0.025])
    g.beginPath()
    g.ellipse(X, Y, rx, ry, 0, 0, Math.PI * 2)
    g.strokeStyle = rgba(T.umbra, 0.35)
    g.lineWidth = 0.7
    g.stroke()
    g.setLineDash([])
    g.beginPath()
    g.ellipse(X, Y - w * 0.25, rx, ry, 0, 0.9 * Math.PI, 1.6 * Math.PI)
    g.strokeStyle = rgba(pal.hoop[2], 0.9)
    g.lineWidth = w * 0.4
    g.stroke()
    if (pick[1] === k) {
      g.beginPath()
      g.ellipse(X, Y, rx + w, ry + w, 0, 0, Math.PI * 2)
      g.strokeStyle = rgba(T.lantern, T.dark ? 0.35 : 0.45)
      g.lineWidth = 1
      g.stroke()
    }
  }

  function glasses(g: CanvasRenderingContext2D) {
    const c = cp!
    const [gx, gy, gz] = c.glass
    const p0 = pt(gx - 0.17, gy + 0.02, gz), p1 = pt(gx + 0.17, gy + 0.02, gz)
    inkLine(g, [p0, p1], Math.max(4, S * 0.03), pal.wood[1], 1, 0.02, 0.02, 0.8)
    soft(g, ...pt(gx - 0.05, gy, gz + 0.06), S * 0.26, S * 0.05, T.umbra, T.dark ? 0.5 : 0.3, 0.15)
    for (let i = 0; i < 2; i++) {
      const [bx, by] = pt(gx + (i ? 0.09 : -0.09), gy + 0.03, gz)
      const u = S * 0.07, hgt = S * 0.3
      const armed = i === 0 || pick[2] === 1
      g.save()
      g.globalAlpha = armed ? 1 : 0.55
      g.fillStyle = rgba(pal.wood[armed ? 2 : 1])
      g.fillRect(bx - u, by - S * 0.018, u * 2, S * 0.018)
      g.fillRect(bx - u, by - hgt, u * 2, S * 0.018)
      g.fillStyle = rgba(pal.wood[0])
      g.fillRect(bx - u * 0.85, by - hgt, S * 0.008, hgt)
      g.fillRect(bx + u * 0.85 - S * 0.008, by - hgt, S * 0.008, hgt)
      const top = by - hgt + S * 0.018, bot = by - S * 0.018, midY = (top + bot) / 2, bw = u * 0.62
      const bulb = (y0: number, y1: number) => {
        g.beginPath()
        g.moveTo(bx - S * 0.006, y0)
        g.bezierCurveTo(bx - bw * 1.4, y0 + (y1 - y0) * 0.1, bx - bw * 1.2, y1 - (y1 - y0) * 0.05, bx, y1)
        g.bezierCurveTo(bx + bw * 1.2, y1 - (y1 - y0) * 0.05, bx + bw * 1.4, y0 + (y1 - y0) * 0.1, bx + S * 0.006, y0)
        g.closePath()
      }
      const sand = mix(mix(T.stepMid, T.lantern, 0.55), T.vermilion, 0.08)
      const p = glassP[i]
      g.save()
      bulb(midY, top)
      g.clip()
      g.fillStyle = rgba(sand)
      g.fillRect(bx - bw * 2, midY - (midY - top) * p * 0.85, bw * 4, (midY - top) * p * 0.85)
      g.restore()
      g.save()
      bulb(midY, bot)
      g.clip()
      g.fillStyle = vgrad(g, midY, bot, [[0, mix(sand, T.moon, 0.25), 1], [1, mix(sand, T.umbra, 0.2), 1]])
      const sh = (bot - midY) * (1 - p) * 0.8
      g.beginPath()
      g.moveTo(bx - bw * 2, bot)
      g.lineTo(bx - bw * 2, bot - sh * 0.6)
      g.quadraticCurveTo(bx, bot - sh * 1.5, bx + bw * 2, bot - sh * 0.6)
      g.lineTo(bx + bw * 2, bot)
      g.fill()
      g.restore()
      if (glassRun[i] >= 0 && p > 0.02) {
        g.fillStyle = rgba(sand)
        g.fillRect(bx - 0.6, midY, 1.2, (bot - midY) * 0.8)
      }
      // the glass: a breath of tint, a thin edge, and the lamp's and the moon's long highlights on its curves
      for (const [y0, y1] of [[midY, top], [midY, bot]]) {
        bulb(y0, y1)
        g.fillStyle = rgba(T.dark ? T.moon : T.card, T.dark ? 0.08 : 0.22)
        g.fill()
        g.strokeStyle = rgba(T.dark ? T.moon : T.ink2, T.dark ? 0.5 : 0.5)
        g.lineWidth = 0.9
        g.stroke()
        inkLine(g, [[bx - bw * 0.95, y0 + (y1 - y0) * 0.25], [bx - bw * 0.85, y0 + (y1 - y0) * 0.7]], 1.6, [255, 255, 255, 1], T.dark ? 0.45 : 0.8, 0.3, 0.3, 0.2)
        inkLine(g, [[bx + bw * 0.9, y0 + (y1 - y0) * 0.35], [bx + bw * 0.75, y0 + (y1 - y0) * 0.65]], 1.1, T.moon, T.dark ? 0.5 : 0.7, 0.3, 0.3, 0.2)
      }
      g.restore()
    }
  }

  /** a pale glazed tea cup with steam: what each scoop pours into; the cost is written on it (DOM) */
  function teaCup(g: CanvasRenderingContext2D) {
    const c = cp!
    const [x, y, z] = c.bowl
    const r = c.bowlR, ht = r * 0.75
    soft(g, ...pt(x - 0.08, y, z + 0.05), S * r * 1.5, S * r * 0.4, T.umbra, T.dark ? 0.55 : 0.32, 0.2)
    const [cx, cy] = pt(x, y + ht, z)
    const rx = S * r, ry = Math.max(2, S * r * se)
    const [, fy] = pt(x, y, z)
    g.beginPath()
    g.moveTo(cx - rx, cy)
    g.bezierCurveTo(cx - rx, cy + (fy - cy) * 0.85, cx - rx * 0.55, fy, cx - rx * 0.42, fy)
    g.lineTo(cx + rx * 0.42, fy)
    g.bezierCurveTo(cx + rx * 0.55, fy, cx + rx, cy + (fy - cy) * 0.85, cx + rx, cy)
    g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI, false)
    const gr = g.createLinearGradient(cx - rx, 0, cx + rx, 0)
    gr.addColorStop(0, rgba(mix(pal.cup, T.lantern, 0.3)))
    gr.addColorStop(0.35, rgba(mix(pal.cup, [255, 255, 255, 1], 0.25)))
    gr.addColorStop(0.75, rgba(pal.cup))
    gr.addColorStop(1, rgba(mix(pal.cup, T.wash, T.dark ? 0.4 : 0.3)))
    g.fillStyle = gr
    g.fill()
    // a glaze drip line and the foot ring
    inkLine(g, [[cx - rx * 0.96, cy + (fy - cy) * 0.55], [cx, cy + (fy - cy) * 0.62], [cx + rx * 0.96, cy + (fy - cy) * 0.55]], 1, mix(pal.cup, T.mossB, 0.5), 0.6, 0.1, 0.1, 0.3)
    g.fillStyle = rgba(mix(pal.clay, T.umbra, 0.2))
    g.fillRect(cx - rx * 0.42, fy - 2, rx * 0.84, 2.5)
    // inside, and what has been poured into it
    g.beginPath()
    g.ellipse(cx, cy, rx * 0.92, ry * 0.86, 0, 0, Math.PI * 2)
    g.fillStyle = rgba(mix(pal.cup, T.umbra, 0.3))
    g.fill()
    if (bowl > 0.01) {
      const d = (1 - bowl) * ry * 0.9
      g.beginPath()
      g.ellipse(cx, cy + d, rx * (0.9 - (1 - bowl) * 0.3), ry * (0.8 - (1 - bowl) * 0.3), 0, 0, Math.PI * 2)
      g.fillStyle = rgba(mix(pal.water, T.lantern, 0.3))
      g.fill()
      soft(g, cx - rx * 0.2, cy + d - ry * 0.1, rx * 0.25, ry * 0.25, T.moon, 0.6 * bowl)
    }
    g.beginPath()
    g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    g.strokeStyle = rgba(T.dark ? T.moon : T.card, T.dark ? 0.6 : 0.95)
    g.lineWidth = 1.3
    g.stroke()
    soft(g, cx - rx * 0.55, cy + (fy - cy) * 0.4, rx * 0.12, (fy - cy) * 0.3, [255, 255, 255, 1], T.dark ? 0.3 : 0.6)
    // steam: three soft wisps rising and leaning toward the window's cool air
    for (let i = 0; i < 3; i++) {
      const pts: Pt[] = []
      for (let k = 0; k <= 12; k++) {
        const t = k / 12
        pts.push([cx + (i - 1) * rx * 0.35 + Math.sin(t * 5 + i * 2) * rx * 0.18 + t * rx * 0.4, cy - ry - t * S * 0.32])
      }
      inkLine(g, pts, Math.max(2, rx * 0.12), T.dark ? T.moon : T.card, T.dark ? 0.16 : 0.5, 0.3, 0.6, 0.2)
    }
  }

  function spill(g: CanvasRenderingContext2D) {
    const k = Math.max(streak, wet)
    for (const ph of [PB + 0.2, 0.9, -1.45]) {
      const pts: Pt[] = []
      const end = 1 - streak * (1 - 0.02)
      for (let y = 1; y >= end; y -= 0.025) {
        pr(ro(y) + 0.006, y, ph + (1 - y) * 0.08)
        pts.push([PX, PY])
      }
      if (pts.length > 1) {
        inkLine(g, pts, S * 0.024, pal.water, 0.5 * k, 0.05, 0.4, 0.3)
        inkLine(g, pts.map(([x, y]) => [x - 1.2, y] as Pt), 1.2, T.moon, 0.55 * k, 0.1, 0.4, 0.2)
      }
    }
    if (puddle > 0) {
      const [px, py] = pt(0.18, 0, 0.3)
      soft(g, px, py, S * 0.62 * puddle, S * 0.62 * puddle * se + 3, pal.water, 0.85 * Math.max(0.5, wet), 0, 0.6)
      soft(g, px - S * 0.12 * puddle, py - 2, S * 0.3 * puddle, S * 0.05 * puddle, T.moon, 0.5 * Math.max(0.4, wet))
    }
  }

  /** before the first scoop: dots from the chosen ladle's cup up into the jar's mouth */
  function hintArc(g: CanvasRenderingContext2D) {
    const a = pt(...ladleRest(pick[0])), b = pt(0, 1.05, 0)
    const m: Pt = [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - S * 0.35]
    for (let i = 1; i < 14; i++) {
      const t = i / 14, u = 1 - t
      const x = u * u * a[0] + 2 * u * t * m[0] + t * t * b[0], y = u * u * a[1] + 2 * u * t * m[1] + t * t * b[1]
      g.fillStyle = rgba(T.lantern, (T.dark ? 0.55 : 0.7) * Math.sin(Math.PI * t))
      g.beginPath()
      g.arc(x, y, 1.6, 0, 6.3)
      g.fill()
    }
  }

  // ── ladles: a bamboo dipper (light model) and a deep wooden ladle (heavy model)
  const LAD = [{ rc: 0.075, hc: 0.1, lh: 0.64, hw: 0.013 }, { rc: 0.13, hc: 0.115, lh: 0.68, hw: 0.022 }]
  function ladleRest(k: number): V3 {
    const c = cp!
    const [x, y0, z] = c.rack
    const L = LAD[k]
    return [x + (k ? 0.13 : -0.13), y0 + 0.82 - L.lh * 0.9, z + 0.03]
  }
  function ladleAt(g: CanvasRenderingContext2D, k: number, p: V3 | Pt, ang: number, full: number, lit: boolean) {
    const L = LAD[k]
    const [X, Y] = p.length === 3 ? pt(p[0], p[1], p[2]) : p
    const rc = S * L.rc, hc = S * L.hc, lh = S * L.lh, hw = Math.max(2, S * L.hw)
    g.save()
    g.translate(X, Y)
    g.rotate(ang)
    if (lit) soft(g, 0, 0, rc * 2.6, hc * 2.2, T.lantern, T.dark ? 0.35 : 0.3)
    const hp: Pt[] = [[rc * 0.55, -hc * 0.35], [rc * 0.5 + lh * 0.04, -lh * 0.5], [rc * 0.35 + lh * 0.02, -lh]]
    inkLine(g, hp, hw, k ? pal.wood[1] : pal.bamboo[1], 1, 0.05, 0.05, 0.8)
    inkLine(g, hp.map(([x, y]) => [x - hw * 0.3, y] as Pt), hw * 0.35, k ? pal.wood[2] : pal.bamboo[2], 0.9, 0.1, 0.1, 0.5)
    const top = -hc / 2, bot = hc / 2, ry = rc * 0.34
    const gr = g.createLinearGradient(-rc, 0, rc, 0)
    const base = k ? pal.wood : pal.bamboo
    gr.addColorStop(0, rgba(mix(base[2], T.lantern, lit ? 0.35 : 0.15)))
    gr.addColorStop(0.45, rgba(base[1]))
    gr.addColorStop(1, rgba(mix(base[0], T.umbra, 0.3)))
    g.beginPath()
    g.moveTo(-rc, top)
    if (k) g.bezierCurveTo(-rc, bot * 1.6, rc, bot * 1.6, rc, top)
    else {
      g.lineTo(-rc, bot)
      g.ellipse(0, bot, rc, ry, 0, Math.PI, 0, true)
      g.lineTo(rc, top)
    }
    g.ellipse(0, top, rc, ry, 0, 0, Math.PI, false)
    g.fillStyle = gr
    g.fill()
    g.beginPath()
    g.ellipse(0, top, rc, ry, 0, 0, Math.PI * 2)
    g.fillStyle = rgba(mix(base[0], T.umbra, 0.5))
    g.fill()
    if (full > 0.02) {
      g.beginPath()
      g.ellipse(0, top + ry * 0.2, rc * 0.86, ry * 0.7, 0, 0, Math.PI * 2)
      g.fillStyle = rgba(pal.water, full)
      g.fill()
      soft(g, -rc * 0.25, top + ry * 0.1, rc * 0.3, ry * 0.3, T.moon, 0.7 * full)
    }
    g.strokeStyle = rgba(T.dark ? T.moon : T.card, lit ? 0.75 : T.dark ? 0.3 : 0.6)
    g.lineWidth = 1
    g.beginPath()
    g.ellipse(0, top, rc, ry, 0, 0, Math.PI * 2)
    g.stroke()
    g.restore()
  }
  /** a ladle being dragged by the hand: tilted toward the jar, glowing when it is over the mouth */
  function dragLadle(g: CanvasRenderingContext2D) {
    const d = drag!
    ladleAt(g, d.k, [d.x, d.y], -0.25, 0, true)
    if (d.over) {
      const [mx, my] = pt(0, 1, 0)
      soft(g, mx, my, S * 0.3, S * 0.3 * se + 6, T.lantern, T.dark ? 0.5 : 0.45)
    }
  }
  /** the chosen ladle's trip: off the peg → down the mouth → scoop → over the cup → pour → home */
  function ladleFly(g: CanvasRenderingContext2D, hh: number) {
    const c = cp!
    const k = an.kind
    const t = an.t
    const rest = ladleRest(k)
    const above: V3 = [0.03, 1.32, 0]
    const dip: V3 = [0.02, Math.max(YIN + 0.05, an.dry ? YIN + 0.04 : levelY(an.l1)) + LAD[k].hc * 0.35, 0]
    const over: V3 = [c.bowl[0] - 0.22, c.bowl[1] + 0.5, c.bowl[2]]
    const keys: [number, V3, number][] = [[0, rest, 0], [0.6, above, 0.1], [1.0, dip, 0.08], [1.3, dip, 0.08], [1.75, above, 0.12], [2.35, over, 0.2], [2.95, over, an.dry ? 0.2 : 1.25], [3.6, rest, 0]]
    let i = 0
    while (i < keys.length - 2 && t > keys[i + 1][0]) i++
    const [t0, p0, a0] = keys[i], [t1, p1, a1] = keys[i + 1]
    const u = ease(seg(t, t0, t1))
    const lift = i === 0 || i === 4 || i === 6 ? Math.sin(Math.PI * u) * 0.22 : 0
    const p: V3 = [lerp(p0[0], p1[0], u), lerp(p0[1], p1[1], u) + lift, lerp(p0[2], p1[2], u)]
    const ang = lerp(a0, a1, u)
    const full = an.dry ? 0 : t < 1.1 ? 0 : t < 2.55 ? 1 : 1 - seg(t, 2.55, 2.95)
    const inside = t > 0.75 && t < 1.55
    g.save()
    if (inside) {
      // inside the jar it shows only through the cut and the mouth, cut at the waterline
      opening(g)
      g.clip()
      const [, wy] = pt(0, hh, -0.1)
      g.beginPath()
      g.rect(0, 0, W, wy)
      g.clip()
    }
    ladleAt(g, k, p, ang, full, true)
    g.restore()
    if (!an.dry && t > 2.5 && t < 3.0) {
      const [X, Y] = pt(p[0], p[1], p[2])
      const L = LAD[k]
      const lip: Pt = [X + Math.cos(ang) * S * L.rc - Math.sin(ang) * -S * L.hc * 0.5, Y + Math.sin(ang) * S * L.rc + Math.cos(ang) * -S * L.hc * 0.5]
      const [bx, by] = pt(c.bowl[0], c.bowl[1] + 0.06, c.bowl[2])
      const f = Math.sin(Math.PI * seg(t, 2.5, 3.0))
      const pts: Pt[] = []
      for (let s = 0; s <= 12; s++) {
        const q = s / 12
        pts.push([lerp(lip[0], bx, q) + Math.sin(q * Math.PI) * S * 0.04, lerp(lip[1], by, q * q)])
      }
      inkLine(g, pts, Math.max(2, S * 0.02 * f + S * 0.004 * an.n), pal.water, 0.85, 0.05, 0.05, 0.6)
      inkLine(g, pts.map(([x, y]) => [x - 1, y] as Pt), 1, T.moon, 0.6 * f, 0.1, 0.1, 0.3)
    }
    if (!an.dry && !lowQ && t > 1.3 && t < 1.9) {
      const [X, Y] = pt(p[0], p[1], p[2])
      for (let d = 0; d < 3; d++) {
        const q = seg(t, 1.32 + d * 0.12, 1.75 + d * 0.12)
        if (q <= 0 || q >= 1) continue
        g.fillStyle = rgba(T.dark ? T.moon : pal.water, 0.7)
        g.beginPath()
        g.ellipse(X - S * 0.02 + d * S * 0.02, Y + S * LAD[k].hc * 0.5 + q * q * S * 0.5, 1.4, 2.4, 0, 0, 6.3)
        g.fill()
      }
    }
  }
  /** the jar's outline as one closed path (left contour up, lip back, right contour down, foot front) */
  function silhouette(g: CanvasRenderingContext2D) {
    for (let k = 0; k <= 40; k++) {
      const y = (k / 40) * 0.999, r = ro(y), phv = Math.acos(clamp(sl(y) * te, -1, 1))
      pj(-r * Math.sin(phv), y, r * Math.cos(phv))
      if (k) g.lineTo(PX, PY)
      else g.moveTo(PX, PY)
    }
    ring(g, ro(1), 1, -Math.PI / 2, -Math.PI * 1.5, false)
    for (let k = 40; k >= 0; k--) {
      const y = (k / 40) * 0.999, r = ro(y), phv = Math.acos(clamp(sl(y) * te, -1, 1))
      pj(r * Math.sin(phv), y, r * Math.cos(phv))
      g.lineTo(PX, PY)
    }
    ring(g, ro(0), 0, 1.2, -1.2, false)
  }

  // ── DOM follows the projection (transforms only)
  function placeDom() {
    const c = cp!
    const at = (el: HTMLElement, p: Pt) => (el.style.transform = `translate3d(${p[0].toFixed(1)}px,${p[1].toFixed(1)}px,0)`)
    // the cord of tags: just under the bench's front edge, across its middle
    at(cord, pt(0.12, -AP - 0.02, c.bench[3]))
    // refill hangs from the window sill; the tips beside the window; the take-away tag on the rack's crossbar
    at(refill, pt((c.win[0] + c.win[1]) / 2, c.win[2] - 0.04, -c.ZW))
    at(tips, pt(c.tips[0], c.tips[1], c.tips[2]))
    if (pill) at(pill, pt(c.rack[0] + 0.18, c.rack[1] + 0.8, c.rack[2]))
    // the cost on the cup's front, the empty jar's line on the bench's front face
    const r = c.bowlR
    at(cost, pt(c.bowl[0], c.bowl[1] + r * 0.36, c.bowl[2]))
    cost.style.setProperty('--cw', `${(S * r * 1.7).toFixed(1)}px`)
    at(empty, pt(0, -AP * 0.5, c.bench[3]))
    // hit boxes over the tools and the jar's mouth
    const box = (el: HTMLElement, a: Pt, b: Pt, min = 44) => {
      const w = Math.max(min, Math.abs(b[0] - a[0])), hh = Math.max(min, Math.abs(b[1] - a[1]))
      el.style.width = `${w.toFixed(1)}px`
      el.style.height = `${hh.toFixed(1)}px`
      at(el, [(a[0] + b[0]) / 2 - w / 2, (a[1] + b[1]) / 2 - hh / 2])
    }
    for (let k = 0; k < 2; k++) {
      const p = ladleRest(k), L = LAD[k]
      box(hits[k], pt(p[0] - L.rc * 1.3, p[1] - L.hc, p[2]), pt(p[0] + L.rc * 1.3, p[1] + L.lh * 0.95, p[2]))
      const rr = c.rings[k], R = k ? 0.33 : 0.25
      box(hits[2 + k], pt(rr[0] - R, rr[1] - 0.05, rr[2] + R), pt(rr[0] + R, rr[1] + 0.05, rr[2] - R))
      box(hits[4 + k], pt(c.glass[0] + (k ? 0.01 : -0.16), c.glass[1], c.glass[2]), pt(c.glass[0] + (k ? 0.16 : -0.01), c.glass[1] + 0.3, c.glass[2]))
    }
    box(look, pt(-ro(1) * 1.25, 1.08, 0), pt(ro(1) * 1.25, 0.9, 0), 48)
    box(jarLabel, pt(-0.5, 0.95, 0), pt(0.5, 0.05, 0), 10)
  }

  function drawAll() {
    if (!cp) return
    drawBack()
    drawMid(0)
    drawMid(1)
    drawMid(2)
    drawFx()
    placeDom()
  }

  // ── motion: one loop, running only while something moves
  const loop = createLoop(view, (_t, dt) => {
    let more = false
    if (lookU !== lookTo) {
      lookU = lookTo > lookU ? Math.min(lookTo, lookU + dt / 1.1) : Math.max(lookTo, lookU - dt / 1.1)
      setCam(lookU)
      drawBack()
      drawMid(0)
      drawMid(1)
      drawMid(2)
      placeDom()
      more = true
    }
    if (an.t >= 0) {
      an.t += dt
      if (an.t > 0.95 && an.t - dt <= 0.95 && !an.dry) (slosh = 0.035), (sloshT = 0)
      for (let i = 0; i < 2; i++) {
        if (glassRun[i] < 0) continue
        const [a, b] = pick[2] ? (i ? [2.1, 3.2] : [0.95, 2.1]) : [0.95, 3.2]
        glassP[i] = 1 - seg(an.t, a, b)
      }
      bowl = an.dry ? bowl : an.t < 2.5 ? (an.t < 0.1 ? 0 : bowl) : Math.max(bowl, seg(an.t, 2.5, 2.95))
      if (an.t >= 3.6) finishScoop()
      else more = true
    }
    if (fillA.t >= 0) {
      fillA.t += dt
      if (fillA.over > 0) {
        streak = seg(fillA.t, 1.25, 2.1)
        puddle = ease(seg(fillA.t, 1.6, 2.8)) * clamp(fillA.over / 60, 0.35, 1)
        wet = streak > 0 ? 1 : wet
      }
      if (fillA.t >= 2.9) {
        fillA.t = -1
        level = 100
        updateAria()
      } else more = true
    } else if (wet > 0.35) {
      wet = Math.max(0.35, wet - dt * 0.15)
      streak = Math.max(0, streak - dt * 0.2)
      more = true
    }
    for (let k = 0; k < 2; k++) {
      if (ringU[k] === ringTo[k]) continue
      ringU[k] = ringTo[k] > ringU[k] ? Math.min(1, ringU[k] + dt / 0.75) : Math.max(0, ringU[k] - dt / 0.75)
      more = true
    }
    if (slosh > 0.001) {
      sloshT += dt
      slosh *= Math.exp(-dt * 2.2)
      more = true
    } else slosh = 0
    drawFx()
    return more
  })
  ctx.onCleanup(() => loop.dispose())
  const kick = () => (still ? drawFx() : loop.start())

  // ── interaction
  function choose(k: number, i: number) {
    if (an.t >= 0 || fillA.t >= 0) return
    pick[k] = i
    tags[k].forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)))
    tags[k][i].classList.remove('swing')
    void tags[k][i].offsetWidth
    tags[k][i].classList.add('swing')
    if (k === 1) {
      ringTo[i] = 1
      ringTo[1 - i] = 0
      if (still) (ringU[i] = 1), (ringU[1 - i] = 0)
    }
    if (k === 2) glassP[1] = i ? 1 : 0
    ctx.chime('tap')
    kick()
  }
  /** a tap on a ladle chooses it; a tap on the one already chosen takes a scoop with it */
  function tapLadle(k: number) {
    if (dragMoved) return
    if (pick[0] === k) generate()
    else choose(0, k)
  }
  function setLook(v: number) {
    if (lookTo === v) return
    lookTo = v
    look.setAttribute('aria-pressed', String(!!v))
    root.classList.toggle('looking', !!v)
    if (still) {
      lookU = v
      setCam(v)
      drawAll()
    } else loop.start()
  }
  function setTips(open: number) {
    tips.classList.toggle('open', !!open)
    tipsBtn.setAttribute('aria-expanded', String(!!open))
  }
  const updateAria = () => jarLabel.setAttribute('aria-label', fill(K.jarAria, { n: level }))

  function generate() {
    if (an.t >= 0 || fillA.t >= 0) return
    setLook(0)
    const n = Math.round(5 * W_MODEL[pick[0]] * W_RES[pick[1]] * W_LEN[pick[2]])
    const dry = n > level
    an.kind = pick[0]
    an.l0 = level
    an.l1 = dry ? level : level - n
    an.dry = dry
    an.n = n
    if (!dry) level -= n
    glassP[0] = 1
    glassP[1] = pick[2] ? 1 : 0
    glassRun[0] = 0
    glassRun[1] = pick[2] ? 0 : -1
    bowl = 0
    go.setAttribute('aria-disabled', 'true')
    cost.classList.remove('on')
    ctx.chime('tap')
    if (still) {
      an.t = 3.6
      bowl = dry ? 0 : 1
      glassP[0] = 0
      glassP[1] = 0
      finishScoop()
      drawFx()
    } else {
      an.t = 0
      loop.start()
    }
  }
  function finishScoop() {
    an.t = -1
    glassRun[0] = glassRun[1] = -1
    glassP[0] = 1
    glassP[1] = pick[2] ? 1 : 0
    go.removeAttribute('aria-disabled')
    updateAria()
    cost.textContent = an.dry ? '' : fill(K.costShort, { n: an.n })
    cost.classList.toggle('on', !an.dry)
    const dryNow = an.dry || level === 0
    empty.textContent = dryNow ? K.empty : ''
    empty.classList.toggle('on', dryNow)
    costSay.textContent = an.dry ? K.empty : fill(K.cost, { n: an.n }) + (level === 0 ? ' ' + K.empty : '')
    if (!costSay.hasAttribute('aria-live')) costSay.setAttribute('aria-live', 'polite')
    refill.hidden = level === 100
    made++
    if (made === 1) {
      facts.replaceChildren(ctx.fact(F(K.facts[0]), 'p'))
      tips.hidden = false
      if (pill) pill.hidden = false
      if (cp?.wide) setTips(1)
      ctx.insight(F(K.insight), K.detail)
    }
    ctx.chime(dryNow ? 'low' : 'soft')
  }
  function fillUp() {
    if (an.t >= 0 || fillA.t >= 0) return
    setLook(0)
    fillA.l0 = level
    fillA.over = level
    bowl = 0
    streak = 0
    puddle = fillA.over > 0 ? puddle : 0
    cost.classList.remove('on')
    empty.classList.remove('on')
    refill.hidden = true
    facts.replaceChildren(ctx.fact(F(K.facts[1]), 'p'))
    ctx.chime('ok')
    if (still) {
      level = 100
      if (fillA.over > 0) (streak = 1), (wet = 1), (puddle = clamp(fillA.over / 60, 0.35, 1))
      updateAria()
      drawFx()
    } else {
      fillA.t = 0
      loop.start()
    }
    go.focus({ preventScroll: true })
  }

  // drag a ladle off the rack into the jar's mouth: the scoop; let go anywhere else and it goes home
  let dragMoved = false
  for (const k of [0, 1]) {
    hits[k].addEventListener('pointerdown', (e) => {
      if (e.button || an.t >= 0 || fillA.t >= 0) return
      const box = view.getBoundingClientRect()
      const sx = e.clientX, sy = e.clientY
      dragMoved = false
      hits[k].setPointerCapture(e.pointerId)
      const move = (ev: PointerEvent) => {
        if (!dragMoved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 8) return
        dragMoved = true
        const x = ev.clientX - box.left, y = ev.clientY - box.top
        const [mx, my] = pt(0, 1, 0)
        drag = { k, x, y, over: Math.hypot(x - mx, (y - my) / Math.max(0.3, se)) < S * ro(1) * 1.6 }
        drawFx()
      }
      const up = () => {
        hits[k].removeEventListener('pointermove', move)
        hits[k].removeEventListener('pointerup', up)
        hits[k].removeEventListener('pointercancel', up)
        const d = drag
        drag = null
        if (d?.over) {
          if (pick[0] !== k) choose(0, k)
          generate()
        } else drawFx()
        setTimeout(() => (dragMoved = false))
      }
      hits[k].addEventListener('pointermove', move)
      hits[k].addEventListener('pointerup', up)
      hits[k].addEventListener('pointercancel', up)
    })
  }

  // parallax: the wall drifts against the bench with the pointer (desktop pointer only; none when still)
  if (!still) {
    const backWrap = view.firstElementChild as HTMLElement
    let raf = 0, mx = 0, my = 0
    let box: DOMRect | null = null
    view.addEventListener('pointerenter', () => void (box = view.getBoundingClientRect()))
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || !W || drag) return
      box ??= view.getBoundingClientRect()
      mx = e.clientX - box.left
      my = e.clientY - box.top
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const x = (mx / W - 0.5) * 2, y = (my / H - 0.5) * 2
        backWrap.style.transform = `translate3d(${(-x * 9).toFixed(1)}px,${(-y * 5).toFixed(1)}px,0)`
        stageEl.style.transform = `translate3d(${(x * 4).toFixed(1)}px,${(y * 2).toFixed(1)}px,0)`
      })
    }
    view.addEventListener('pointermove', onMove)
    ctx.onCleanup(() => cancelAnimationFrame(raf))
  }
}
