import { fill, h, nextId, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { arc, brush, ell, rng, type Pt } from './brush'
import { C } from './data'
import { clamp, flatStone, gardenDefs, lantern, orb, softRakes, stableHeight, watchSize } from './garden'

const M = C.scenes.sim
// busy hours (index into M.hours) for Lan, Minh, Hà and you; 14h (index 5) is the only hour everyone is free
const BUSY = [[0, 1, 3, 6, 7], [1, 2, 4, 6], [0, 2, 3, 7], [1, 3, 4, 6]]
const FREE = 5
const CHECK = 3
const MINH = 1
const f1 = (n: number) => n.toFixed(1)
type Phase = 'idle' | 'plan' | 'cal' | 'draft' | 'check' | 'sent'
type TL = ReturnType<typeof gsap.timeline>
type Tw = { kill(): unknown }
const SEQ: Phase[] = ['plan', 'cal', 'draft', 'check']
/** the paper plane: a letter's four corners, and where each lands once folded */
const LETTER: Pt[] = [[-1, -0.66], [1, -0.66], [1, 0.66], [-1, 0.66]]
const PLANE: Pt[] = [[-1, -0.4], [1.05, 0], [-0.15, 0.32], [-0.8, -0.06]]

/** Scene 3 — hand the agent a real errand; it walks its plan stone by stone and stops at the rope-tied stone to ask you. */
export function simScene(ctx: SceneCtx) {
  const stable = stableHeight(ctx, [M.insight])
  const svg = s('svg', { class: 't15s-svg', 'aria-hidden': 'true' })
  const steps = M.steps.map((t, i) => h('li', { class: 't15s-step' }, h('b', null, String(i + 1)), h('span', null, t)))
  const list = h('ol', { class: 't15s-steps', 'aria-label': M.stepsLabel }, ...steps)
  const inner = h('div', { class: 't15s-inner' })
  const panel = h('div', { class: 't15s-panel', role: 'region', 'aria-label': M.region, tabindex: '-1' }, inner)
  // screen readers hear each phase once (the letter-by-letter typing would be noise)
  const status = h('p', { class: 'visually-hidden', role: 'status' })
  const root = h('div', { class: 't15 t15s' }, svg, list, panel, status)
  ctx.art.append(root)
  ctx.prompt(M.prompt)

  let phase: Phase = 'idle'
  let fixed = false
  let said = false
  /** what happened to the letter: none yet, all to the team, or one to the partner */
  let outcome: 'none' | 'right' | 'wrong' = 'none'
  let run: TL | null = null
  let move: TL | null = null
  let timer: Tw | null = null

  // ───────── the garden: lantern, five stones (the fourth tied with rope), the team's lanterns, the stream, the partner ─────────
  type Stone = { x: number; y: number; rx: number }
  let G = { wide: true, stones: [] as Stone[], lantern: [0, 0] as Pt, hv: 10, team: [] as Pt[], partner: [0, 0] as Pt, pw: 10 }
  type Lit = { glow: SVGElement[]; off: SVGPathElement }
  let A = null as null | {
    orb: ReturnType<typeof orb>; thread: SVGPathElement; win: Pt; glow: SVGCircleElement; asks: SVGCircleElement[]
    planes: { g: SVGGElement; body: SVGPathElement; fold: SVGPathElement }[]; lights: Lit[]; mark: SVGGElement
    /** the vermilion ring that spreads on the water when the letter crosses to the partner */
    splash: SVGEllipseElement; splashAt: Pt
  }
  const O = { x: 0, by: 0, gy: 0, lift: 0 }
  type Q = [number, number, number]
  const spot = (ph: Phase): Q => {
    const st = G.stones
    const over = (i: number, t = 0): Q => {
      const a = st[i]
      const b = st[Math.min(i + 1, st.length - 1)]
      const x = a.x + (b.x - a.x) * t
      const y = a.y + (b.y - a.y) * t
      return [x, y - G.hv, y]
    }
    if (ph === 'idle') return [G.lantern[0] + G.hv * 2.6, G.lantern[1] - G.hv * 3.2, G.lantern[1]]
    if (ph === 'plan') return over(0)
    if (ph === 'cal') return over(1)
    if (ph === 'draft') return over(2)
    if (ph === 'check') return over(2, 0.62)
    return over(4)
  }
  function place() {
    if (!A) return
    const y = O.by - O.lift
    A.orb.g.setAttribute('transform', `translate(${f1(O.x)} ${f1(y)})`)
    A.orb.shadow.setAttribute('transform', `translate(${f1(O.x)} ${f1(O.gy)}) scale(${(1 - Math.min(0.6, O.lift / (G.hv * 3))).toFixed(2)})`)
    const [wx, wy] = A.win
    const d = Math.hypot(O.x - wx, y - wy)
    A.thread.setAttribute('d', `M${f1(wx)} ${f1(wy)}Q${f1((wx + O.x) / 2)} ${f1(Math.max(wy, y) + d * 0.12)} ${f1(O.x)} ${f1(y)}`)
  }
  const setO = ([x, y, gy]: Q) => {
    Object.assign(O, { x, by: y, gy, lift: 0 })
    place()
  }
  function hop(tl: TL, to: Q, t0: number, dur = 0.7) {
    const from: Q = [O.x, O.by, O.gy]
    const p = { t: 0 }
    tl.to(p, {
      t: 1, duration: dur, ease: 'power1.inOut',
      onStart: () => void from.splice(0, 3, O.x, O.by, O.gy),
      onUpdate: () => {
        O.x = from[0] + (to[0] - from[0]) * p.t
        O.by = from[1] + (to[1] - from[1]) * p.t
        O.gy = from[2] + (to[2] - from[2]) * p.t
        O.lift = Math.sin(Math.PI * p.t) * G.hv * 1.4
        place()
      },
    }, t0)
  }
  /** Walk the ember to where a phase happens. */
  function walk(ph: Phase, dur = 0.7) {
    move?.kill()
    if (ctx.reduced) return setO(spot(ph))
    ctx.anim(() => {
      move = gsap.timeline()
      hop(move, spot(ph), 0, dur)
    })
  }

  function layout() {
    const W = ctx.art.clientWidth
    const H = stable.H(ctx.art.clientHeight)
    if (W < 10 || H < 10) return
    root.style.height = `${H}px`
    const wide = W / H > 1.15
    const short = wide && H < 300
    root.classList.toggle('wide', wide)
    root.classList.toggle('short', short)
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
    svg.replaceChildren()
    const { defs, id } = gardenDefs()
    svg.append(defs)
    const r = rng(42)
    // the garden's box [gx0, gy0, gw, gh], and where each piece sits in it (shares)
    let box: [number, number, number, number]
    let LH: number
    let rx0: number
    let SX: number[]
    let SY: number[]
    let TX: number[]
    let TY: number[]
    let streamA: Pt
    let streamB: Pt
    if (wide) {
      const cw = clamp(W * 0.45, 230, 720)
      box = [0, 0, cw, H]
      LH = Math.min(H * 0.4, cw * 0.34, 220)
      rx0 = Math.min(cw * 0.115, H * 0.085)
      SX = [0.46, 0.64, 0.43, 0.6, 0.45]
      SY = [0.87, 0.72, 0.58, 0.45, 0.32]
      TX = [0.7, 0.82, 0.94]
      TY = [0.22, 0.26, 0.22]
      streamA = [0.38, -0.02]
      streamB = [-0.02, 0.42]
      Object.assign(panel.style, { left: `${cw + 16}px`, top: '0px', width: `${W - cw - 16}px`, height: `${H}px` })
    } else {
      // the garden takes a third of the height; the words above get the rest (the checkpoint needs it)
      const pathH = clamp(H * 0.31, 140, 220)
      box = [0, H - pathH, W, pathH]
      LH = Math.min(pathH * 0.56, 112)
      rx0 = clamp(W * 0.09, 26, 40)
      SX = [0.36, 0.53, 0.41, 0.59, 0.48]
      SY = [0.9, 0.75, 0.6, 0.45, 0.31]
      TX = [0.76, 0.865, 0.965]
      TY = [0.3, 0.36, 0.31]
      streamA = [0.32, -0.04]
      streamB = [-0.03, 0.46]
      Object.assign(panel.style, { left: '0px', top: '0px', width: `${W}px`, height: `${H - pathH - 4}px` })
    }
    const [bx, by, bw, bh] = box
    const P = ([fx, fy]: Pt): Pt => [bx + fx * bw, by + fy * bh]
    const lx = Math.max(LH * 0.32, bw * 0.1)
    const ly = by + bh - (wide ? 8 : 6)
    const stones = SX.map((fx, k) => {
      const [x, y] = P([fx, SY[k]])
      return { x, y, rx: rx0 * [1, 0.93, 0.86, 0.8, 0.74][k] }
    })
    const team = TX.map((fx, k) => P([fx, TY[k]]))
    // the stream: a band of water between your garden and the partner's stone
    const sa = P(streamA)
    const sb = P(streamB)
    const c1: Pt = [sa[0] - bw * 0.03, sa[1] + bh * 0.2]
    const c2: Pt = [sb[0] + bw * 0.24, sb[1] - bh * 0.12]
    const bez = (t: number): Pt => {
      const u = 1 - t
      return [u ** 3 * sa[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t ** 3 * sb[0], u ** 3 * sa[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t ** 3 * sb[1]]
    }
    const sw = clamp(bw * 0.04, 8, 20)
    const nrm = (t: number): Pt => {
      const a = bez(Math.max(0, t - 0.01))
      const b = bez(Math.min(1, t + 0.01))
      const dl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
      return [-(b[1] - a[1]) / dl, (b[0] - a[0]) / dl]
    }
    const side = (off: number, t0 = 0, t1 = 1, n = 24) => Array.from({ length: n + 1 }, (_, i) => {
      const t = t0 + ((t1 - t0) * i) / n
      const [x, y] = bez(t)
      const [nx, ny] = nrm(t)
      const w = off * (1 + 0.22 * Math.sin(t * 9 + 1))
      return [x + nx * w, y + ny * w] as Pt
    })
    // the partner's stone sits across the water, on the far bank
    const pr = rx0 * 0.62
    const tp = 0.34
    const cp = bez(tp)
    let [nx, ny] = nrm(tp)
    if (nx + ny > 0) [nx, ny] = [-nx, -ny]
    const pp: Pt = [Math.max(bx + pr + 6, cp[0] + nx * (sw * 1.3 + pr * 1.5)), Math.max(by + pr * 0.5 + 26, cp[1] + ny * (sw * 1.3 + pr * 0.9))]
    const sLH = LH * 0.44
    G = { wide, stones, lantern: [lx, ly], hv: clamp(LH * 0.09, 7, 14), team, partner: pp, pw: pr }

    // sand: along the stream the rake follows the banks (combed bands of four tines, the bank's wobble fading out line by line);
    // further out it runs straight, inside a soft oval
    const tg = clamp(bw * 0.011, 4, 6)
    const offs: number[] = []
    for (let j = 0, o = sw * 1.55; j < 8; j++) {
      offs.push(o)
      o += tg * (j % 4 === 3 ? 2.4 : 1)
    }
    const along = (o: number, t0 = -0.12, t1 = 1.12, n = 44) => Array.from({ length: n + 1 }, (_, i) => {
      const t = t0 + ((t1 - t0) * i) / n
      const [x, y] = bez(t)
      const [mx, my] = nrm(t)
      const w = o + Math.sign(o) * sw * 0.22 * Math.sin(t * 9 + 1) * Math.exp(-(Math.abs(o) - sw) / (tg * 5))
      return [x + mx * w, y + my * w] as Pt
    })
    const pd = (pts: Pt[]) => `M${pts.map((p) => p.map(f1).join(' ')).join('L')}`
    const bank = s('g')
    for (const sg of [1, -1]) {
      for (const o of offs) {
        const d = pd(along(sg * o))
        bank.append(s('path', { d, class: 'rk' }), s('path', { d, class: 'rk-hi', transform: 'translate(0 1.2)' }))
      }
    }
    svg.append(s('g', { class: 't15s-sand' }, softRakes(defs, bx - bw * 0.1, by + bh * 0.04, bw * 1.2, bh * 1.04, 5, 15, { d: pd(along(0, -0.2, 1.2)), w: 2 * (offs[offs.length - 1] + tg * 1.8) }, [bank])))
    const e1 = side(sw)
    const e2 = side(-sw)
    // the water: a cool wash, deeper down the middle, a few glints of sky on it
    const water = s('g', { class: 't15s-stream' },
      s('path', { class: 't15s-water', d: `M${[...e1, ...e2.reverse()].map((p) => p.map(f1).join(' ')).join('L')}Z`, filter: 'url(#ink-wash)' }),
      s('path', { class: 't15s-deep', d: brush(side(sw * 0.08, 0.02, 0.98), sw * 0.9, { a: 0.2, b: 0.25, min: 0.3, wob: 0.3 }).d, filter: 'url(#ink-wash)' }))
    const glints = ([[0.32, 0.1, 0.3], [-0.28, 0.42, 0.6], [0.18, 0.7, 0.86]] as const).map(([o, t0, t1]) => {
      const g = s('path', { class: 'rim t15s-glint', d: brush(side(sw * o, t0, t1, 12), Math.max(1.2, sw * 0.16), { a: 0.35, b: 0.45, min: 0.1 }).d })
      water.append(g)
      return g
    })
    void glints
    const ring = s('ellipse', { class: 't15s-ring', cx: f1(bez(0.62)[0]), cy: f1(bez(0.62)[1]), rx: 1, ry: 1, opacity: 0 })
    const splashAt = bez(0.3)
    const splash = s('ellipse', { class: 't15s-splash', cx: f1(splashAt[0]), cy: f1(splashAt[1]), rx: 1, ry: 1, opacity: 0 })
    water.append(ring, splash)
    // the banks, broken where the water has worn them; long thin strokes for the current
    for (const [off, t0, t1, w, op] of [[1.08, 0, 0.42, 1.8, 0.6], [1.12, 0.52, 1, 1.6, 0.5], [-1.08, 0.04, 0.58, 1.6, 0.55], [-1.1, 0.68, 1, 1.4, 0.45]]) {
      water.append(s('path', { class: 'k2', 'fill-opacity': op, d: brush(side(sw * off, t0, t1), w, { a: 0.15, b: 0.25, min: 0.2 }).d, filter: 'url(#ink-rough)' }))
    }
    for (const [off, t0, t1, op] of [[0.45, 0.06, 0.4, 0.4], [-0.3, 0.22, 0.7, 0.35], [0.2, 0.55, 0.92, 0.3], [-0.55, 0.78, 1, 0.3]]) {
      water.append(s('path', { class: 'k3', 'fill-opacity': op, d: brush(side(sw * off, t0, t1, 16), 1.1, { a: 0.35, b: 0.45, min: 0.1 }).d }))
    }
    // pebbles along the banks
    for (let k = 0; k < 9; k++) {
      const t = 0.05 + k * 0.105 + r() * 0.04
      const [x, y] = bez(t)
      const [mx, my] = nrm(t)
      const o = (k % 2 ? 1 : -1) * sw * (1.25 + r() * 0.35)
      water.append(s('path', { class: k % 3 ? 'k3' : 'm', 'fill-opacity': 0.45, d: ell(x + mx * o, y + my * o, 1.6 + r() * 2.2, 1 + r() * 1.2), filter: 'url(#ink-rough)' }))
    }
    svg.append(water)
    // pool of lantern light, moss along the way
    svg.append(s('path', { d: ell(lx + LH * 0.2, ly + 1, LH * 0.75, LH * 0.12), fill: `url(#${id.pool})` }))
    const moss = s('g', { class: 'm', filter: 'url(#ink-rough)' })
    stones.forEach(({ x, y, rx }) => {
      for (let n = 0; n < 7; n++) {
        const a = Math.PI * (0.1 + r() * 0.8) * (r() < 0.5 ? 1 : -1)
        moss.append(s('path', { d: ell(x + Math.cos(a) * rx * (1.05 + r() * 0.3), y + Math.sin(a) * rx * 0.4, rx * (0.05 + r() * 0.07), rx * (0.03 + r() * 0.03)), 'fill-opacity': (0.3 + r() * 0.5).toFixed(2) }))
      }
    })
    svg.append(moss)
    // the partner's stone, across the water
    // the letter that landed on it by mistake: an envelope as wide as the stone, sealed in vermilion
    const lw = Math.max(13, pr * 0.72)
    const lh = lw * 0.62
    const [mx0, my0] = [pp[0] + pr * 0.05, pp[1] - pr * 0.28 - lh]
    const env: Pt[] = [[mx0 - lw, my0 - lh + 1], [mx0 + lw, my0 - lh - 1], [mx0 + lw + 0.5, my0 + lh - 1.5], [mx0 - lw + 1, my0 + lh]]
    const mark = s('g', { class: 't15s-mark', opacity: 0 },
      s('path', { class: 'sh', 'fill-opacity': 0.18, d: ell(mx0 + lw * 0.15, pp[1] - pr * 0.2, lw * 1.05, lh * 0.35), filter: 'url(#ink-wash)' }),
      s('path', { class: 'card t15s-env', d: `M${env.map((p) => p.map(f1).join(' ')).join('L')}Z`, filter: 'url(#ink-rough)' }),
      s('path', { class: 'k2', d: brush([env[0], [mx0, my0 + lh * 0.12], env[1]], Math.max(1.1, lw * 0.07), { straight: true, a: 0.1, b: 0.1, min: 0.5 }).d }),
      s('path', { class: 'v', d: ell(mx0, my0 + lh * 0.12, Math.max(2.6, lw * 0.2), Math.max(2.4, lw * 0.18)), filter: 'url(#ink-rough)' }))
    svg.append(flatStone(pp[0], pp[1], pr, pr * 0.4, id, r), mark,
      s('text', { class: 'lab lab-sm', x: f1(pp[0]), y: f1(pp[1] - pr * 0.8 - 8), 'text-anchor': 'middle' }, M.partner))
    // stones, far first
    stones.map((st, k) => ({ ...st, k })).sort((a, b) => a.y - b.y).forEach(({ x, y, rx, k }) => {
      svg.append(flatStone(x, y, rx, rx * 0.36, id, r))
      if (k === CHECK) svg.append(sekimori(x, y - rx * 0.12, rx * 0.5, id.stone))
    })
    // the team: three small lanterns waiting for the invitation, dark until it reaches them
    const lights: Lit[] = team.map(([x, y], k) => {
      svg.append(s('path', { class: 'm', 'fill-opacity': 0.35, d: ell(x + sLH * 0.04, y + 1, sLH * 0.34, sLH * 0.07), filter: 'url(#ink-rough)' }))
      const L = lantern(x, y, sLH, id, r)
      const u = sLH / 100
      const win = `M${f1(x - 6.4 * u)} ${f1(y - 56.2 * u)}L${f1(x + 6.4 * u)} ${f1(y - 56.2 * u)}L${f1(x + 6.4 * u)} ${f1(y - 67.4 * u)}L${f1(x - 6.4 * u)} ${f1(y - 67.4 * u)}Z`
      const off = s('path', { class: 't15s-off', d: win })
      const lit = s('path', { class: 't15s-litwin', d: win, opacity: 0 })
      const halo = s('circle', { cx: f1(L.win[0]), cy: f1(L.win[1]), r: f1(sLH * 0.46), fill: `url(#${id.you})`, opacity: 0 })
      L.g.append(off, lit)
      L.g.prepend(halo)
      gsap.set(L.glow, { opacity: 0 })
      svg.append(L.g, s('text', { class: 'lab lab-sm', x: f1(x), y: f1(y + sLH * 0.07 + 12), 'text-anchor': 'middle' }, M.people[k]))
      return { glow: [halo, lit], off }
    })
    // your lantern
    const L = lantern(lx, ly, LH, id, r)
    svg.append(L.g)
    const thread = s('path', { class: 't15a-thread' })
    const o = orb(clamp(LH * 0.04, 4, 7), id)
    const asks = [0, 1].map(() => s('circle', { class: 'v', r: 2.4, opacity: 0 }))
    // the email: a letter that folds itself into a paper plane (two, if it goes to the wrong Minh as well)
    const pw = clamp(LH * 0.13, 11, 20)
    const planes = [0, 1].map(() => {
      const body = s('path', { class: 'card' })
      const fold = s('path', { class: 't15s-fold' })
      const g = s('g', { class: 't15s-plane', opacity: 0 }, body, fold)
      return { g, body, fold }
    })
    svg.append(thread, ...asks, o.shadow, o.g, ...planes.map((p) => p.g))
    A = { orb: o, thread, win: L.win, glow: L.glow, asks, planes, lights, mark, splash, splashAt }
    shapePlanes(0, pw)

    // step names beside their stones (portrait: only the step in progress says its name)
    // (portrait: the last two names go left of their stones, clear of the team's lanterns)
    steps.forEach((li, k) => {
      const { x, y, rx } = stones[k]
      const left = !wide && k >= 3
      li.classList.toggle('left', left)
      Object.assign(li.style, left
        ? { left: '', right: `${W - (x - rx - 6)}px`, top: `${y - 8}px` }
        : { right: '', left: `${x + rx + (wide ? 10 : 6)}px`, top: `${y - (wide ? 10 : 8)}px` })
    })
    setO(spot(phase))
    gsap.set(thread, { opacity: phase === 'idle' ? 0.3 : 0.6 })
    showOutcome()
    markSteps()
  }

  /** Fold progress 0 (a flat letter) → 1 (a paper plane). */
  let planeW = 14
  function shapePlanes(k: number, w = planeW) {
    planeW = w
    if (!A) return
    const pts = LETTER.map((a, i) => [(a[0] + (PLANE[i][0] - a[0]) * k) * w, (a[1] + (PLANE[i][1] - a[1]) * k) * w] as Pt)
    const d = `M${pts.map((p) => p.map(f1).join(' ')).join('L')}Z`
    const fold = `M${f1(pts[1][0] * k + 0 * (1 - k))} ${f1(pts[1][1] * k)}L${f1((-0.2 + 0.1 * k) * w)} ${f1((0.05 + 0.25 * k) * w)}`
    for (const p of A.planes) {
      p.body.setAttribute('d', d)
      p.fold.setAttribute('d', k < 0.05 ? `M${f1(-0.7 * w)} ${f1(-0.3 * w)}L${f1(0.6 * w)} ${f1(-0.3 * w)}M${f1(-0.7 * w)} ${f1(0.1 * w)}L${f1(0.3 * w)} ${f1(0.1 * w)}` : fold)
    }
  }

  /** The lanterns and the partner's stone as the last send left them. */
  function showOutcome() {
    if (!A) return
    A.lights.forEach((l, k) => {
      const on = outcome === 'right' || (outcome === 'wrong' && k !== MINH)
      gsap.set(l.glow, { opacity: on ? 1 : 0 })
      gsap.set(l.off, { opacity: on ? 0 : 1 })
    })
    gsap.set(A.mark, { opacity: outcome === 'wrong' ? 1 : 0 })
    gsap.set(A.planes.map((p) => p.g), { opacity: 0 })
  }

  /** The sekimori-ishi: a round stone tied with black rope, set on the path to say "please stop here". */
  function sekimori(x: number, y: number, R: number, grad: string) {
    const cy = y - R * 0.8
    const g = s('g', { class: 't15s-seki' })
    g.append(
      s('path', { class: 'sh', 'fill-opacity': 0.25, d: ell(x + R * 0.15, y - R * 0.05, R * 1.05, R * 0.3), filter: 'url(#ink-wash)' }),
      s('path', { d: ell(x, cy, R, R * 0.86), fill: `url(#${grad})`, filter: 'url(#ink-rough)' }),
      s('path', { class: 'sh', 'fill-opacity': 0.5, d: brush(arc(x, cy, R * 0.98, R * 0.84, -20, 120, 16), Math.max(1.2, R * 0.12), { a: 0.1, b: 0.4 }).d, filter: 'url(#ink-rough)' }),
      s('path', { class: 'rim', d: brush(arc(x - R * 0.1, cy - R * 0.08, R * 0.7, R * 0.6, 200, 260, 8), Math.max(1, R * 0.1), { a: 0.3, b: 0.4 }).d }))
    const rope = s('g', { class: 'rope', filter: 'url(#ink-rough)' })
    const w = Math.max(1.4, R * 0.13)
    rope.append(
      s('path', { d: brush(arc(x, cy + R * 0.1, R * 1.0, R * 0.3, 0, 180, 18), w, { a: 0.05, b: 0.05, min: 0.6 }).d }),
      s('path', { d: brush(arc(x + R * 0.04, cy, R * 0.3, R * 0.88, 270, 450, 18), w, { a: 0.05, b: 0.05, min: 0.6 }).d }),
      // the knot on top, with two loops and two loose ends
      s('path', { d: ell(x + R * 0.04, cy - R * 0.84, R * 0.17, R * 0.13) }),
      s('path', { d: brush(arc(x - R * 0.28, cy - R * 1.02, R * 0.24, R * 0.16, 30, 330, 16), w * 0.8, { a: 0.1, b: 0.1, min: 0.5 }).d }),
      s('path', { d: brush(arc(x + R * 0.36, cy - R * 1.02, R * 0.24, R * 0.16, 210, 510, 16), w * 0.8, { a: 0.1, b: 0.1, min: 0.5 }).d }),
      s('path', { d: brush([[x, cy - R * 0.78], [x - R * 0.2, cy - R * 0.5], [x - R * 0.32, cy - R * 0.3]], w * 0.7, { a: 0.1, b: 0.6 }).d }),
      s('path', { d: brush([[x + R * 0.08, cy - R * 0.78], [x + R * 0.28, cy - R * 0.52], [x + R * 0.36, cy - R * 0.36]], w * 0.7, { a: 0.1, b: 0.6 }).d }))
    g.append(rope)
    return g
  }

  function markSteps() {
    const cur = { idle: -1, plan: 0, cal: 1, draft: 2, check: 3, sent: 4 }[phase]
    steps.forEach((li, k) => {
      li.classList.toggle('on', k === cur)
      li.classList.toggle('done', k < cur)
      if (k === cur) li.setAttribute('aria-current', 'step')
      else li.removeAttribute('aria-current')
    })
  }

  // ───────── the panel: what the agent is doing right now ─────────
  const eyebrow = (t: string) => ((status.textContent = t), h('p', { class: 't15s-eyebrow' }, t))
  const fadeIn = (els: Element | Element[], delay = 0) => {
    if (!ctx.reduced) ctx.anim(() => gsap.fromTo(els, { opacity: 0, y: 8, filter: 'blur(4px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.8, stagger: 0.12, delay, ease: 'power3.out', clearProps: 'filter' }))
  }
  const btn = (cls: string, label: string, onClick: () => void) => h('button', { class: `btn t15s-btn ${cls}`, type: 'button', onClick }, label)

  function idle() {
    const go = btn('go t15s-go', M.start, start)
    inner.replaceChildren(eyebrow(M.taskLabel), h('p', { class: 't15s-task' }, M.task), h('div', { class: 't15s-actions' }, go))
    fadeIn([...inner.children])
  }

  let mail: ReturnType<typeof mailCard> | null = null
  function mailCard() {
    const chip = (t: string) => h('span', { class: 't15s-chip' }, t)
    const wrong = h('button', { class: 't15s-chip wrong', type: 'button', disabled: true, onClick: swap }, fixed ? M.right : M.wrong)
    if (fixed) wrong.classList.add('fixed')
    const chips = h('div', { class: 't15s-chips' }, chip(M.recipients[0]), wrong, chip(M.recipients[1]))
    const body = M.body.map((t) => h('p', { class: 't15s-line' }, t))
    const note = h('p', { class: 't15s-note' }, h('i', { 'aria-hidden': 'true' }), M.note)
    // the hint keeps its row from the start, so showing it never shifts the letter
    const hint = h('p', { class: 't15s-hint', 'aria-hidden': 'true' }, M.editHint)
    const el = h('div', { class: 't15s-mail' },
      h('div', { class: 't15s-row' }, h('span', { class: 't15s-k' }, M.to), chips),
      hint,
      h('div', { class: 't15s-row' }, h('span', { class: 't15s-k' }, M.subjectLabel), h('span', { class: 't15s-subj' }, M.subject)),
      h('div', { class: 't15s-body' }, ...body),
      note)
    return { el, wrong, body, note, hint }
  }
  const showHint = (on: boolean) => {
    if (!mail) return
    mail.hint.classList.toggle('on', on)
    mail.hint.setAttribute('aria-hidden', String(!on))
  }

  function swap() {
    if (!mail || fixed) return
    fixed = true
    const w = mail.wrong
    w.textContent = M.right
    w.classList.add('fixed')
    w.disabled = true
    w.removeAttribute('aria-label')
    showHint(false)
    ctx.anim(() => gsap.to(mail!.note, { opacity: 0.45, duration: ctx.reduced ? 0 : 0.6 }))
    ctx.chime('ok')
    if (!ctx.reduced) ctx.anim(() => gsap.fromTo(w, { opacity: 0.2, filter: 'blur(3px)' }, { opacity: 1, filter: 'blur(0px)', duration: 0.7, ease: 'power2.out', clearProps: 'filter' }))
    panel.querySelector<HTMLButtonElement>('.t15s-ok')?.focus({ preventScroll: true })
  }

  /** The agent's look at four calendars: busy hours as ink dabs, a wash sweeping down to the hour everyone is free. */
  function calendar() {
    const Wc = 320
    const Hc = 200
    const lm = 34
    const tm = 26
    const cw = (Wc - lm) / 4
    const rh = (Hc - tm) / M.hours.length
    const svgC = s('svg', { class: 't15s-cal', viewBox: `0 0 ${Wc} ${Hc}`, 'aria-hidden': 'true' })
    const ticks: SVGPathElement[] = []
    M.people.forEach((n, c) => {
      const cx = lm + c * cw + cw / 2
      svgC.append(s('text', { class: 'cal-name', x: cx - 4, y: 15, 'text-anchor': 'middle' }, n))
      const tk = s('path', { class: 'cal-tick', d: `M${cx + n.length * 3.4} 9l3 3l6 -6`, pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': ctx.reduced ? 0 : 1 })
      ticks.push(tk)
      svgC.append(tk)
    })
    M.hours.forEach((t, i) => {
      const y = tm + i * rh
      svgC.append(s('text', { class: 'cal-hour', x: lm - 6, y: y + rh * 0.66, 'text-anchor': 'end' }, t))
      if (i) svgC.append(s('line', { class: 'cal-line', x1: lm + 4, x2: Wc - 4, y1: y, y2: y }))
    })
    const rnd = rng(9)
    const cols = BUSY.map((rows, c) => rows.map((i) => {
      const x0 = lm + c * cw + 6
      const y = tm + i * rh + rh / 2
      const b = s('path', { class: 'cal-busy', d: brush([[x0, y + (rnd() - 0.5) * 1.5], [x0 + (cw - 12) * 0.5, y + (rnd() - 0.5) * 2], [x0 + cw - 12, y + (rnd() - 0.5) * 1.5]], rh * (0.56 + rnd() * 0.14), { a: 0.12, b: 0.3, min: 0.35, wob: 0.2 }).d, filter: 'url(#ink-rough)', opacity: ctx.reduced ? 1 : 0 })
      svgC.append(b)
      return b
    }))
    const yc = (i: number) => tm + i * rh + rh / 2
    const band = s('path', { class: 'cal-band', d: brush([[lm + 2, yc(0)], [Wc - 2, yc(0)]], rh * 0.95, { straight: true, a: 0.04, b: 0.06, min: 0.7 }).d, filter: 'url(#ink-wash)', opacity: 0 })
    svgC.append(band)
    // the found hour, ringed with one vermilion brush loop
    const mid = nextId('t15e')
    const loopPts = Array.from({ length: 41 }, (_, i) => {
      const a = ((-150 + (345 * i) / 40) * Math.PI) / 180
      return [(lm + Wc) / 2 + ((Wc - lm) / 2 + 3) * Math.cos(a) * (1 + 0.02 * Math.sin(a * 3)), yc(FREE) + rh * 0.95 * Math.sin(a)] as Pt
    })
    const enso = brush(loopPts, 4.6, { a: 0.05, b: 0.5, min: 0.1, wob: 0.25 })
    const ensoM = s('path', { class: 't15s-em', d: enso.c, pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': ctx.reduced ? 0 : 1 })
    svgC.append(
      s('mask', { id: mid, maskUnits: 'userSpaceOnUse', x: -20, y: -20, width: Wc + 40, height: Hc + 40 }, ensoM),
      s('path', { class: 'cal-enso', d: enso.d, mask: `url(#${mid})`, filter: 'url(#ink-rough)' }))
    return { svgC, cols, ticks, band, ensoM, dy: (i: number) => i * rh }
  }

  function start() {
    root.classList.add('running')
    ctx.art.dispatchEvent(new PointerEvent('pointerdown'))
    ctx.chime('soft')
    panel.focus({ preventScroll: true })
    fixed = false
    outcome = 'none'
    showOutcome()
    go('plan')
  }

  /** Enter a phase; with motion it moves on by itself, without motion the visitor steps on with a button. */
  function go(ph: Phase) {
    timer?.kill()
    timer = null
    run?.kill()
    run = null
    phase = ph
    markSteps()
    walk(ph)
    if (A) gsap.set(A.thread, { opacity: 0.6 })
    if (ph === 'check') return checkpoint()
    const dur = render(ph)
    const next = SEQ[SEQ.indexOf(ph) + 1]
    if (ctx.reduced) {
      const b = btn('t15s-next', M.next, () => go(next))
      inner.append(h('div', { class: 't15s-actions' }, b))
      b.focus({ preventScroll: true })
    } else ctx.anim(() => void (timer = gsap.delayedCall(dur, () => go(next))))
  }

  /** Draw one phase into the panel; returns how long it plays. */
  function render(ph: Phase): number {
    const R = ctx.reduced
    if (ph === 'plan') {
      const items = M.plan.map((p, i) => h('li', null, h('span', { class: 't15s-n' }, String(i + 1)), h('span', null, p), i === 3 ? knot() : null))
      inner.replaceChildren(eyebrow(M.planTitle), h('ol', { class: 't15s-plan' }, ...items))
      if (!R) ctx.anim(() => gsap.fromTo(items, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.6, stagger: 0.45, ease: 'power3.out' }))
      return 3
    }
    if (ph === 'cal') {
      const cal = calendar()
      const found = h('p', { class: 't15s-found' }, h('i', { 'aria-hidden': 'true' }), M.found)
      inner.replaceChildren(eyebrow(M.calTitle), cal.svgC, found)
      if (R) {
        gsap.set(cal.band, { opacity: 1, y: cal.dy(FREE) })
        cal.band.classList.add('found')
        status.textContent = M.found
        return 0
      }
      found.style.visibility = 'hidden'
      const tl = gsap.timeline()
      ctx.anim(() => {
        cal.cols.forEach((col, c) => {
          tl.to(col, { opacity: 1, duration: 0.3, stagger: 0.06 }, 0.3 + c * 0.45)
          tl.to(cal.ticks[c], { strokeDashoffset: 0, duration: 0.3 }, 0.6 + c * 0.45)
        })
        let t = 0.3 + 4 * 0.45 + 0.3
        tl.set(cal.band, { opacity: 1, y: 0 }, t)
        for (let i = 1; i <= FREE; i++) tl.to(cal.band, { y: cal.dy(i), duration: 0.28, ease: 'power2.inOut' }, t + i * 0.36)
        t += FREE * 0.36 + 0.3
        tl.call(() => {
          cal.band.classList.add('found')
          found.style.visibility = ''
          status.textContent = M.found
          fadeIn(found)
        }, [], t)
        tl.to(cal.ensoM, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut' }, t)
      })
      run = tl
      return tl.duration() + 1.6
    }
    // the draft
    mail = mailCard()
    inner.replaceChildren(eyebrow(M.draftTitle), mail.el)
    if (R) return 0
    const m = mail
    const per = 0.028
    const total = M.body.join('').length * per
    ctx.anim(() => {
      gsap.fromTo(m.el.children, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.12, ease: 'power3.out' })
      // the body is written out, letter by letter
      m.body.forEach((p, i) => {
        const full = M.body[i]
        const o = { n: 0 }
        p.textContent = ''
        gsap.to(o, { n: full.length, duration: full.length * per, delay: 0.5 + M.body.slice(0, i).join('').length * per, ease: 'none', onUpdate: () => void (p.textContent = full.slice(0, Math.round(o.n))) })
      })
      gsap.fromTo(m.note, { opacity: 0 }, { opacity: 1, duration: 0.6, delay: 0.6 + total })
    })
    return 0.8 + total + 1.2
  }

  function knot() {
    return s('svg', { class: 't15s-knot', viewBox: '0 0 24 18', 'aria-hidden': 'true' },
      s('ellipse', { cx: 12, cy: 11, rx: 8, ry: 6.5, class: 'knot-stone' }),
      s('path', { d: 'M4 11.5Q12 15 20 11.5M12 4.5V17.5', class: 'knot-rope' }),
      s('path', { d: 'M12 4.5Q8 1 6.5 3.5Q8 6 12 4.5Q16 1 17.5 3.5Q16 6 12 4.5', class: 'knot-rope' }))
  }

  function checkpoint() {
    phase = 'check'
    markSteps()
    mail ??= mailCard()
    showHint(false)
    const edit = btn('ghost t15s-edit', M.edit, startEdit)
    const ok = btn('go t15s-ok', M.approve, send)
    const head = h('div', { class: 't15s-head' }, eyebrow(M.checkTitle), ctx.fact(M.stone, 'p', 't15s-stonecap'))
    inner.replaceChildren(head, mail.el, h('div', { class: 't15s-actions' }, edit, ok))
    mail.wrong.disabled = fixed
    if (!fixed) mail.wrong.setAttribute('aria-label', fill(M.swap, { from: M.wrong, to: M.right }))
    root.classList.add('asking')
    fadeIn([head, inner.lastElementChild as Element])
    // the ember asks: two small sparks run up the thread to your lantern, which answers with a pulse
    if (A && !ctx.reduced) {
      const a = A
      ctx.anim(() => {
        const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.4, delay: 0.8 })
        // the thread only changes while the ember walks: measure it again only when its path did
        let dKey: string | null = null
        let L = 0
        const len = () => {
          const d = a.thread.getAttribute('d')
          if (d !== dKey) {
            dKey = d
            L = a.thread.getTotalLength()
          }
          return L
        }
        a.asks.forEach((dot, k) => {
          const p = { t: 0 }
          tl.fromTo(p, { t: 0 }, {
            t: 1, duration: 1.1, ease: 'power1.inOut',
            onUpdate: () => {
              const pt = a.thread.getPointAtLength(len() * (1 - p.t))
              dot.setAttribute('cx', f1(pt.x))
              dot.setAttribute('cy', f1(pt.y))
            },
          }, k * 0.35)
          tl.fromTo(dot, { opacity: 0 }, { opacity: 1, duration: 0.2, yoyo: true, repeat: 1, repeatDelay: 0.7 }, k * 0.35)
        })
        tl.fromTo(a.glow, { scale: 1 }, { scale: 1.35, duration: 0.35, yoyo: true, repeat: 1, svgOrigin: `${a.win[0]} ${a.win[1]}` }, 1.2)
        asking = tl
      })
    }
    edit.focus({ preventScroll: true })
  }
  let asking: TL | null = null

  function startEdit() {
    if (!mail) return
    if (fixed) return void panel.querySelector<HTMLButtonElement>('.t15s-ok')?.focus()
    panel.classList.add('editing')
    showHint(true)
    mail.wrong.disabled = false
    mail.wrong.focus({ preventScroll: true })
  }

  /** The letter folds into a plane at the last stone and glides to the team's lanterns — and, if Minh was wrong, across the water too. */
  function flight(tl: TL, t0: number, ok: boolean) {
    if (!A) return t0
    const a = A
    const st = G.stones[4]
    const from: Pt = [st.x, st.y - G.hv * 2.6]
    const team = G.team
    const target: Pt = [(team[0][0] + team[2][0]) / 2, Math.min(...team.map((p) => p[1])) - planeW * 3]
    const pp = G.partner
    const paths: { p: (typeof a.planes)[number]; to: Pt; lights: number[] }[] = [{ p: a.planes[0], to: target, lights: ok ? [0, 1, 2] : [0, 2] }]
    if (!ok) paths.push({ p: a.planes[1], to: [pp[0], pp[1] - G.pw * 0.9], lights: [] })
    const k = { k: 0 }
    tl.set(paths.map((q) => q.p.g), { x: from[0], y: from[1], rotation: 0, scale: 1, opacity: 0 }, t0)
    tl.call(() => shapePlanes(0), [], t0)
    tl.to(paths[0].p.g, { opacity: 1, duration: 0.3 }, t0)
    tl.to(k, { k: 1, duration: 0.7, ease: 'power2.inOut', onUpdate: () => shapePlanes(k.k) }, t0 + 0.35)
    let t = t0 + 1.1
    paths.forEach(({ p, to, lights }, n) => {
      const c: Pt = [(from[0] + to[0]) / 2, Math.min(from[1], to[1]) - Math.abs(to[0] - from[0]) * 0.25 - 10]
      const q = { t: 0 }
      const t1 = t + n * 0.25
      if (n) tl.to(p.g, { opacity: 1, duration: 0.2 }, t1)
      tl.to(q, {
        t: 1, duration: 1.5, ease: 'power1.inOut',
        onUpdate: () => {
          const u = q.t
          const x = (1 - u) ** 2 * from[0] + 2 * (1 - u) * u * c[0] + u * u * to[0]
          const y = (1 - u) ** 2 * from[1] + 2 * (1 - u) * u * c[1] + u * u * to[1]
          const dx = 2 * (1 - u) * (c[0] - from[0]) + 2 * u * (to[0] - c[0])
          const dy = 2 * (1 - u) * (c[1] - from[1]) + 2 * u * (to[1] - c[1])
          gsap.set(p.g, { x, y, rotation: (Math.atan2(dy, dx) * 180) / Math.PI, scale: 1 - 0.3 * u })
        },
      }, t1)
      tl.to(p.g, { opacity: 0, duration: 0.3 }, t1 + 1.45)
      lights.forEach((i, j) => {
        tl.to(a.lights[i].off, { opacity: 0, duration: 0.5 }, t1 + 1.5 + j * 0.25)
        tl.fromTo(a.lights[i].glow, { opacity: 0 }, { opacity: 1, duration: 0.9, ease: 'power2.out' }, t1 + 1.5 + j * 0.25)
      })
      if (!lights.length) tl.fromTo(a.mark, { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, t1 + 1.45)
    })
    return t + 2.4
  }

  function send() {
    if (phase !== 'check') return
    asking?.kill()
    asking = null
    if (A) gsap.set(A.asks, { opacity: 0 })
    root.classList.remove('asking')
    panel.classList.remove('editing')
    const ok = fixed
    phase = 'sent'
    outcome = ok ? 'right' : 'wrong'
    markSteps()
    ctx.chime(ok ? 'ok' : 'low')
    const result = h('p', { class: `t15s-result ${ok ? 'ok' : 'bad'}` }, h('i', { 'aria-hidden': 'true' }), ok ? M.sentRight : M.sentWrong)
    status.textContent = ok ? M.sentRight : M.sentWrong
    const again = btn('ghost', M.again, restart)
    const retry = ok ? null : btn('go', M.retry, retryCheck)
    const finish = () => {
      inner.replaceChildren(result, h('div', { class: 't15s-actions' }, retry, again))
      fadeIn([...inner.children])
      ;(retry ?? again).focus({ preventScroll: true })
      if (!said) {
        said = true
        ctx.insight(M.insight, M.detail)
      }
    }
    run?.kill()
    if (ctx.reduced) {
      walk('sent')
      showOutcome()
      return finish()
    }
    walk('sent', 0.6)
    ctx.anim(() => {
      const tl = gsap.timeline()
      run = tl
      if (mail) tl.to(mail.el, { opacity: 0, y: -12, scale: 0.94, duration: 0.5, ease: 'power2.in' }, 0)
      const end = flight(tl, 0.6, ok)
      tl.call(finish, [], Math.min(end, 2.2))
    })
  }

  function retryCheck() {
    // back to the moment before sending: the draft as it was; the lanterns go dark again
    mail = mailCard()
    run?.kill()
    outcome = 'none'
    if (ctx.reduced) showOutcome()
    else if (A) {
      const a = A
      ctx.anim(() => {
        gsap.to(a.lights.flatMap((l) => l.glow), { opacity: 0, duration: 0.6 })
        gsap.to(a.lights.map((l) => l.off), { opacity: 1, duration: 0.6 })
        gsap.to(a.mark, { opacity: 0, duration: 0.6 })
      })
    }
    phase = 'check'
    walk('check', 0.6)
    checkpoint()
  }

  function restart() {
    run?.kill()
    asking?.kill()
    timer?.kill()
    phase = 'idle'
    fixed = false
    mail = null
    outcome = 'none'
    root.classList.remove('running', 'asking')
    markSteps()
    showOutcome()
    walk('idle', 0.8)
    idle()
    panel.querySelector<HTMLButtonElement>('.t15s-go')?.focus({ preventScroll: true })
  }

  watchSize(ctx, layout, stable.reset)
  layout()
  idle()
  return () => {
    run?.kill()
    move?.kill()
    timer?.kill()
    asking?.kill()
  }
}
