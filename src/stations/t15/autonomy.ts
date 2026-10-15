import { fill, h, nextId, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { arc, brush, cursive, ell, peaks, rng, type Pt } from './brush'
import { C } from './data'
import { clamp, flatStone, gardenDefs, lantern, orb, stableHeight, watchSize } from './garden'

const A = C.scenes.autonomy
const LAST = A.levels.length - 1
// stepping stones you laid, in steps along the path (0 = beside your lantern, 4 = deep in the mist)
const STONES = [1, 1.5, 2, 2.5, 3]
// stones the agent lays for itself at level 5: [step, drift towards the horizon (−) or the viewer (+)]; it walks 0 → 1 → 2
const BRANCH: [number, number][] = [[3.4, -0.16], [3.72, -0.34], [4, -0.5], [3.45, 0.24], [3.82, 0.36]]
const THREAD = [0.55, 0.55, 0.85, 0.3, 0.12]
// stepping stones zigzag a little (chidori), and are not all the same size
const ZIG: Record<number, number> = { 1: -0.05, 1.5: 0.12, 2: -0.04, 2.5: 0.1, 3: 0 }
const SIZE = [1, 0.8, 1.06, 0.84, 1.22]
const f1 = (n: number) => n.toFixed(1)

type TL = ReturnType<typeof gsap.timeline>

/** Scene 1 — your stone lantern, a path of stones, and the agent's ember: the more you hand over, the further it walks. */
export function autonomyScene(ctx: SceneCtx) {
  const stable = stableHeight(ctx, [A.insight])
  const svg = s('svg', { class: 't15a-svg', 'aria-hidden': 'true' })
  const bands = [0, 1, 2].map((i) => h('div', { class: 't15-band', style: `--i:${i}`, 'aria-hidden': 'true' }))
  const cap = h('div', { class: 't15a-cap', 'aria-live': 'polite' })
  const thumb = h('span', { class: 't15a-thumb', 'aria-hidden': 'true' })
  const notches = A.levels.map((_, i) => h('span', { class: 't15a-notch', 'aria-hidden': 'true' }, h('i'), h('b', null, String(i + 1))))
  const groove = s('svg', { class: 't15a-groove', 'aria-hidden': 'true' })
  const slider = h('div', {
    class: 't15a-slider', role: 'slider', tabindex: '0', 'aria-label': A.slider,
    'aria-valuemin': '1', 'aria-valuemax': String(LAST + 1),
  }, groove, ...notches, thumb)
  const root = h('div', { class: 't15 t15a' }, h('p', { class: 'visually-hidden' }, A.art), svg, ...bands, cap, slider)
  ctx.art.append(root)
  ctx.prompt(A.prompt)

  let level = 0
  let told = false
  let said = false
  const visited = new Set<number>([0])
  let story: TL | null = null

  // geometry (filled by layout)
  // landscape: the path runs left → right and a little back; portrait: it runs up the screen, away into the distance
  let G = { W: 0, H: 0, P0: 0, Y0: 0, dx: 0, dy: 0, side: [0, 0] as Pt, zig: [0, 0] as Pt, persp: 0.4, ns: 0, ground: 0, hv: 0, LH: 0, lx: 0, wide: true, short: false, rx: 0 }
  const path = (k: number, z = true): Pt => {
    const t = k / 4
    const zz = z ? (ZIG[k] ?? 0) : 0
    return [G.P0 + t * G.dx + zz * G.zig[0], G.Y0 - t * G.dy + zz * G.zig[1]]
  }
  const at = (k: number) => path(k)
  const scAt = (k: number) => 1 - G.persp * (k / 4)
  const bAt = (j: number): Pt => {
    const [k, d] = BRANCH[j]
    const p = path(k, false)
    return [p[0] + d * G.side[0], p[1] + d * G.side[1]]
  }
  /** where the ember hovers: [x, y, the ground under it] */
  type Q = [number, number, number]
  const over = ([x, y]: Pt): Q => [x, y - G.hv * (G.wide ? 1 : 0.6 + 0.4 * (1 - (G.Y0 - y) / Math.max(1, G.dy))), y]
  const stop = (L: number): Q => (L === 0 ? [G.lx + G.LH * 0.4, G.ground - G.LH * 0.42, G.ground] : L === 4 ? over(bAt(2)) : over(at(L)))

  // the live parts of the picture (rebuilt by layout)
  let P = null as null | {
    orb: ReturnType<typeof orb>; thread: SVGPathElement; glow: SVGCircleElement; win: Pt
    foot: SVGGElement[]; trace: SVGElement[]; check: SVGPathElement[]; branch: SVGGElement[]; bTrace: SVGElement[]
    sugg: SVGGElement[]; speech: SVGGElement; ripples: SVGEllipseElement[]; goal: SVGGElement; ask: SVGGElement; askIn: SVGGElement
    scroll: SVGGElement; scrollHome: Pt; unroll: (u: number) => void; scrollLab: SVGTextElement
    you: SVGGElement; youHome: Pt; youOn: Pt[]
  }
  const O = { x: 0, by: 0, gy: 0, lift: 0 }
  // your own light: it walks the stones itself at levels 1–2
  const Y = { x: 0, y: 0, lift: 0 }
  const placeYou = () => P?.you.setAttribute('transform', `translate(${f1(Y.x)} ${f1(Y.y - Y.lift)})`)
  const setYou = ([x, y]: Pt) => {
    Object.assign(Y, { x, y, lift: 0 })
    placeYou()
  }

  function place() {
    if (!P) return
    const y = O.by - O.lift
    P.orb.g.setAttribute('transform', `translate(${f1(O.x)} ${f1(y)})`)
    const sh = 1 - Math.min(0.7, (O.lift + O.gy - O.by - G.hv) / (G.hv * 3))
    P.orb.shadow.setAttribute('transform', `translate(${f1(O.x)} ${f1(O.gy)}) scale(${sh.toFixed(2)})`)
    P.ask.setAttribute('transform', `translate(${f1(O.x + G.hv * 0.7)} ${f1(y - G.hv * 1.3)})`)
    // the thread from your lantern sags a little, like a kite string
    const [wx, wy] = P.win
    const d = Math.hypot(O.x - wx, y - wy)
    P.thread.setAttribute('d', `M${f1(wx)} ${f1(wy)}Q${f1((wx + O.x) / 2)} ${f1(Math.max(wy, y) + d * 0.16)} ${f1(O.x)} ${f1(y)}`)
  }
  const setO = ([x, y, gy]: Q) => {
    O.x = x
    O.by = y
    O.gy = gy
    O.lift = 0
    place()
  }

  // ───────── layout & drawing ─────────
  let capW = -1
  let capH = 0
  function measureCap(w: number) {
    if (w === capW) return capH
    capW = w
    cap.style.width = `${w}px`
    const keep = [...cap.childNodes]
    const wasHidden = cap.hidden
    cap.hidden = false
    capH = 0
    for (let i = 0; i <= LAST; i++) {
      fillCap(i)
      capH = Math.max(capH, cap.offsetHeight)
    }
    cap.replaceChildren(...keep)
    cap.hidden = wasHidden
    if (capAt >= 0 && !keep.length) fillCap(capAt)
    return capH
  }

  function fillCap(i: number) {
    const lv = A.levels[i]
    cap.replaceChildren(
      h('p', { class: 't15a-lv' }, fill(A.level, { n: i + 1 })),
      h('p', { class: 't15a-name' }, lv.name),
      h('p', { class: 't15a-does' }, lv.does),
      h('p', { class: 't15a-ex' }, lv.example),
      ctx.fact(A.scale, 'p', 't15a-scale'))
  }

  function layout() {
    const W = ctx.art.clientWidth
    const H = stable.H(ctx.art.clientHeight)
    if (W < 10 || H < 10) return
    root.style.height = `${H}px`
    const wide = W / H > 1.15
    const short = wide && H < 270
    root.classList.toggle('wide', wide)
    root.classList.toggle('short', short)
    const slH = short ? 50 : 62
    const bot = H - slH - (short ? 2 : 8)
    // portrait: the words sit over the sky, above the garden; landscape: beside the lantern
    let top = 0
    let LH: number
    let lx: number
    if (wide) {
      LH = Math.min(bot * 0.84, 340, W * 0.24)
      lx = Math.max(LH * 0.34, W * 0.07)
      const cl = lx + LH * 0.36 + 18
      const cw = short ? clamp(W * 0.6, 240, 520) : clamp(W * 0.42, 240, 460)
      measureCap(cw)
      Object.assign(cap.style, { left: `${cl}px`, top: '0px' })
    } else {
      const ch = measureCap(W)
      Object.assign(cap.style, { left: '0px', top: '0px' })
      top = ch + 10
      LH = Math.min((bot - top) * 0.82, 210, W * 0.36)
      lx = Math.max(LH * 0.3, W * 0.1)
    }
    const sceneH = bot - top
    const ground = bot - Math.max(14, sceneH * 0.08)
    const horizon = ground - sceneH * (wide ? 0.5 : 0.62)
    const hv = clamp(LH * 0.1, 10, 24)
    let P0: number
    let dx: number
    let dy: number
    let rx: number
    if (wide) {
      P0 = lx + LH * 0.4
      dx = W - Math.max(LH * 0.28, W * 0.06) - P0
      dy = (ground - horizon) * (short ? 0.2 : 0.56)
      rx = Math.min((dx / 4) * 0.4, LH * 0.21)
      G = { W, H, P0, Y0: ground - LH * 0.01, dx, dy, side: [0, dy], zig: [0, dy * 1.2], persp: 0.55, ns: dx / 4, ground, hv, LH, lx, wide, short, rx }
    } else {
      P0 = lx + LH * 0.62
      dx = W * 0.62 - P0
      dy = (ground - horizon) * 0.86
      rx = Math.min(W * 0.09, LH * 0.28)
      G = { W, H, P0, Y0: ground - LH * 0.02, dx, dy, side: [W * 0.42, 0], zig: [W * 0.75, 0], persp: 0.58, ns: (W * 0.84 - 52) / 4, ground, hv, LH, lx, wide, short, rx }
    }
    const step = G.ns

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
    svg.replaceChildren()
    const { defs, id } = gardenDefs()
    const fade = nextId('t15f')
    const sandMask = nextId('t15m')
    const sandBot = bot + 4
    defs.append(
      s('linearGradient', { id: fade, x1: 0, y1: 0, x2: 0, y2: 1 },
        s('stop', { offset: 0, class: 'fade0' }),
        s('stop', { offset: 1, class: 'fade1' })),
      // the raked sand: faint far away, firm near you, ending just above the slider on a band of plain paper
      s('linearGradient', { id: `${sandMask}-v`, gradientUnits: 'userSpaceOnUse', x1: 0, y1: horizon, x2: 0, y2: sandBot },
        s('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 0 }),
        s('stop', { offset: Math.min(0.4, 36 / Math.max(1, sandBot - horizon)), 'stop-color': '#fff', 'stop-opacity': 0.3 }),
        s('stop', { offset: 0.62, 'stop-color': '#fff', 'stop-opacity': 0.8 }),
        s('stop', { offset: Math.max(0.7, 1 - 14 / Math.max(1, sandBot - horizon)), 'stop-color': '#fff', 'stop-opacity': 1 }),
        s('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 })),
      s('linearGradient', { id: `${sandMask}-h`, x1: 0, y1: 0, x2: 1, y2: 0 },
        s('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 0 }),
        s('stop', { offset: 0.06, 'stop-color': '#fff', 'stop-opacity': 1 }),
        s('stop', { offset: 0.94, 'stop-color': '#fff', 'stop-opacity': 1 }),
        s('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 })),
      s('mask', { id: `${sandMask}-x`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H },
        s('rect', { x: 0, y: 0, width: W, height: H, fill: `url(#${sandMask}-h)` })))
    svg.append(defs)
    const r = rng(15)
    const r2 = rng(7)

    // ── the sky: a pale dawn disc (a moon at night), far peaks climbing out of the mist, a few birds ──
    const gx = wide ? Math.min(W - LH * 0.18, P0 + dx * 1.09) : bAt(2)[0] + W * 0.12
    const gh = sceneH * (wide ? 0.34 : 0.2)
    const sky = s('g', { class: 't15a-sky' })
    const sunR = wide ? clamp(gh * 0.3, 16, 48) : clamp(W * 0.115, 26, 52)
    const sun: Pt = wide ? [gx - gh * 0.72, Math.max(sunR + 6, horizon - gh * 0.98)] : [W * 0.7, clamp(horizon * 0.34, sunR + 10, Math.max(sunR + 10, horizon - sunR * 2.4))]
    sky.append(
      s('circle', { class: 't15a-sunhalo', cx: f1(sun[0]), cy: f1(sun[1]), r: f1(sunR * 2.6), fill: `url(#${id.pool})` }),
      s('path', { class: 't15a-sun', d: ell(sun[0], sun[1], sunR), filter: ctx.quality === 'low' ? null : 'url(#ink-wash)' }),
      s('path', { class: 'k3', 'fill-opacity': 0.22, d: brush(arc(sun[0], sun[1], sunR * 1.02, sunR * 1.02, 120, 330, 30), Math.max(1, sunR * 0.05), { a: 0.3, b: 0.4, min: 0.1 }).d, filter: 'url(#ink-rough)' }))
    if (!wide) {
      // portrait has a tall sky: two far ranges rise out of the mist behind the garden
      for (const [h0, h1, op] of [[0.4, 0.6, 0.07], [0.2, 0.34, 0.1]]) {
        for (const { d } of peaks(r2, -W * 0.2, W * 1.15, horizon + 2, horizon * h0, horizon * h1, W * 0.4)) sky.append(s('path', { d, fill: `url(#${fade})`, 'fill-opacity': op, filter: ctx.quality === 'low' ? null : 'url(#ink-wash)' }))
      }
    }
    const mistY = wide ? horizon - gh * 0.35 : horizon * 0.72
    const mist = s('path', { class: 't15a-mist', d: ell(W * 0.55, mistY, W * (wide ? 0.32 : 0.7), Math.max(6, (wide ? gh : horizon) * 0.06)), filter: 'url(#ink-wash)' })
    const birdW = clamp(sunR * 0.17, 4, 8)
    const birds = s('g', { class: 'k2' })
    for (const [bx, by, k] of [[-2.1, -0.5, 1], [-1.55, 0.05, 0.8], [-2.6, 0.25, 0.65]]) {
      const x = sun[0] + bx * sunR
      const y = sun[1] + by * sunR
      const w = birdW * k
      birds.append(s('path', { 'fill-opacity': 0.75, d: brush([[x - w, y - w * 0.35], [x - w * 0.4, y - w * 0.1], [x, y + w * 0.12]], Math.max(0.9, w * 0.2), { a: 0.1, b: 0.6 }).d }),
        s('path', { 'fill-opacity': 0.75, d: brush([[x, y + w * 0.12], [x + w * 0.45, y - w * 0.2], [x + w * 1.05, y - w * 0.5]], Math.max(0.9, w * 0.2), { a: 0.1, b: 0.6 }).d }))
    }
    sky.append(mist, birds)
    svg.append(sky)

    // far ridges sinking into the fog, and the far peak that becomes the big goal
    const ridge = s('g', ctx.quality === 'low' ? null : { filter: 'url(#ink-wash)' })
    for (const [b, h0, h1, op] of [[horizon - sceneH * 0.01, 0.07, 0.15, 0.06], [horizon + sceneH * 0.025, 0.04, 0.09, 0.08]]) {
      for (const { d } of peaks(r, wide ? W * 0.3 : -W * 0.05, W * 1.04, b, sceneH * h0, sceneH * h1, Math.max(70, W * 0.15))) ridge.append(s('path', { d, fill: `url(#${fade})`, 'fill-opacity': op }))
    }
    const peak: Pt[] = []
    for (let i = 0; i <= 18; i++) {
      const u = 1 - Math.abs((i / 18) * 2 - 1)
      peak.push([gx - gh * 1.2 + (i / 9) * gh * 1.2, horizon + 2 - gh * u ** 1.5 + (i % 18 ? (r() - 0.5) * gh * 0.04 : 0)])
    }
    ridge.append(s('path', { d: `M${peak.map((p) => p.map(f1).join(' ')).join('L')}Z`, fill: `url(#${fade})`, 'fill-opacity': 0.16 }))
    svg.append(ridge)
    svg.append(s('path', { class: 'k', 'fill-opacity': 0.35, d: brush(peak.slice(5, 14), Math.max(1, gh * 0.012), { a: 0.25, b: 0.35 }).d, filter: 'url(#ink-rough)' }))
    const goal = s('g', { class: 't15a-goal', opacity: 0 },
      s('circle', { class: 'v', cx: f1(gx), cy: f1(horizon - gh - 9), r: 3 }),
      s('text', { class: 'lab', x: f1(gx), y: f1(horizon - gh - 18), 'text-anchor': gx > W - 50 ? 'end' : 'middle' }, A.goal))

    // ── the stepping stones (geometry first: the sand is raked around them) ──
    const geo = STONES.map((k, i) => {
      const [x, y] = at(k)
      const sc = scAt(k)
      const srx = rx * sc * SIZE[i]
      return { k, x, y, sc, srx, sry: srx * 0.34 }
    })
    // concentric rakes around each stone and the lantern's foot; fewer rings where two stones sit close
    const gap0 = clamp(LH * 0.032, 3.5, 7.5)
    const rings = [
      ...geo.map((g) => ({ x: g.x, y: g.y + g.sry * 0.2, rx: g.srx * 1.14 + 2, k: 0.36, n: 3, g: gap0 * (0.45 + 0.55 * g.sc), op: 0.5 + 0.5 * g.sc })),
      { x: lx + LH * 0.03, y: ground + LH * 0.012, rx: LH * 0.25, k: 0.26, n: 2, g: gap0, op: 1 },
    ]
    const outR = (q: (typeof rings)[number]) => q.rx + q.n * q.g
    for (let guard = 0; guard < 12; guard++) {
      let ok = true
      for (const [i, a] of rings.entries())
        for (const b of rings.slice(i + 1))
          if (Math.hypot(a.x - b.x, (a.y - b.y) / 0.34) < outR(a) + outR(b) + a.g) {
            ok = false
            const big = a.n >= b.n ? a : b
            if (big.n > 1) big.n--
          }
      if (ok) break
    }
    // straight rakes from the horizon down, drifting a little like a long pull of the rake
    const lines = s('g')
    for (let y = horizon + 6, k = 0; y < sandBot; k++) {
      const dpt = (y - horizon) / Math.max(1, sandBot - horizon)
      const amp = 0.4 + 2.4 * dpt
      const lam = 70 + 120 * dpt
      const pts: string[] = []
      for (let x = -10; x <= W + 26; x += 16) pts.push(`${x} ${f1(y + amp * Math.sin(x / lam + k * 0.21))}`)
      const d = `M${pts.join('L')}`
      lines.append(s('path', { d, class: 'rk' }), s('path', { d, class: 'rk-hi', transform: `translate(0 ${f1(0.6 + dpt)})` }))
      y += 5 + 15 * dpt
    }
    svg.append(
      s('mask', { id: sandMask, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H },
        s('rect', { x: 0, y: horizon, width: W, height: sandBot - horizon, fill: `url(#${sandMask}-v)` }),
        ...rings.map((q) => s('path', { d: ell(q.x, q.y, outR(q) + q.g * 0.6, (outR(q) + q.g * 0.6) * q.k), fill: '#000' }))),
      s('g', { mask: `url(#${sandMask}-x)` }, s('g', { mask: `url(#${sandMask})` }, lines)))
    const ringG = s('g')
    for (const q of rings) {
      const g = s('g', { opacity: q.op.toFixed(2) })
      for (let j = 0; j <= q.n; j++) {
        const R = q.rx + j * q.g
        const d = ell(q.x, q.y, R, R * q.k)
        g.append(s('path', { d, class: 'rk', fill: 'none' }), s('path', { d, class: 'rk-hi', fill: 'none', transform: 'translate(0 1.2)' }))
      }
      ringG.append(g)
    }
    svg.append(ringG)
    // the edge of the gravel bed: one dry stroke
    svg.append(s('path', { class: 'k3', 'fill-opacity': 0.4, d: brush([[W * 0.04, sandBot - 1], [W * 0.5, sandBot], [W * 0.96, sandBot - 1.5]], 3, { a: 0.1, b: 0.2, min: 0.3 }).d, filter: `url(#${id.dryH})` }))
    svg.append(s('path', { d: ell(lx + LH * 0.25, ground + 2, LH * 0.8, LH * 0.13), fill: `url(#${id.pool})` }))
    // moss creeping between the stepping stones, thinning out into the distance
    const dabs = s('g', { class: 'm', filter: 'url(#ink-rough)' })
    for (let n = 0; n < 70; n++) {
      const k = 0.7 + r() * 2.6
      const [x, y0] = path(k, false)
      const sc = scAt(k)
      const off = (r() - 0.5) * rx * sc * 1.1
      const ox = wide ? (r() - 0.5) * step * 0.12 : off * 2.2
      const oy = wide ? off : (r() - 0.5) * rx * sc * 0.3
      dabs.append(s('path', { d: ell(x + ox, y0 + oy, rx * sc * (0.03 + r() * 0.07), rx * sc * (0.016 + r() * 0.03)), 'fill-opacity': (0.2 + r() * 0.45 * (1 - k / 4)).toFixed(2) }))
    }
    svg.append(dabs)
    // grass tufts at the lantern's foot
    const tufts = s('g', { class: 'm', filter: 'url(#ink-rough)' })
    for (const [dx, n0] of [[-0.24, 5], [0.2, 4], [0.32, 3]]) {
      const bx = lx + dx * LH
      for (let n = 0; n < n0; n++) {
        const a = -Math.PI / 2 + (n - (n0 - 1) / 2) * 0.32 + (r() - 0.5) * 0.2
        const len = LH * (0.05 + r() * 0.05)
        tufts.append(s('path', { d: brush([[bx, ground + 1], [bx + Math.cos(a) * len * 0.5, ground + Math.sin(a) * len * 0.55], [bx + Math.cos(a) * len, ground + Math.sin(a) * len]], Math.max(1, LH * 0.012), { a: 0.05, b: 0.8, min: 0.1 }).d, 'fill-opacity': 0.75 }))
      }
    }

    // stones: farthest first so the near ones overlap them
    const all: { k: number; y: number; draw: () => void }[] = []
    const foot: SVGGElement[] = []
    const trace: SVGElement[] = []
    const check: SVGPathElement[] = []
    const branch: SVGGElement[] = []
    const bTrace: SVGElement[] = []
    const marks = s('g')
    geo.forEach(({ k, x, y, srx, sry }) => {
      all.push({ k, y, draw: () => svg.append(flatStone(x, y, srx, sry, id, r)) })
      // your own light on the stone: you walk this step yourself
      const fg = s('g', { class: 't15a-lit', opacity: 0 },
        s('path', { d: ell(x, y - sry * 0.05, srx * 0.95, sry * 0.9), fill: `url(#${id.you})` }))
      foot.push(fg)
      // the agent's mark: a small ember left on the stone
      const tr = s('ellipse', { class: 'v t15a-trace', cx: f1(x), cy: f1(y - sry * 0.08), rx: f1(srx * 0.16), ry: f1(sry * 0.36), opacity: 0 })
      trace.push(tr)
      // your nod: a moss tick above the stone
      const cw = Math.max(6, srx * 0.28)
      const ck = s('path', { class: 't15a-check', d: `M${f1(x + srx * 0.3)} ${f1(y - cw * 0.45)}l${f1(cw * 0.36)} ${f1(cw * 0.36)}l${f1(cw * 0.8)} ${f1(-cw * 0.8)}`, pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 })
      check.push(ck)
      marks.append(fg, tr, ck)
    })
    BRANCH.forEach(([k], j) => {
      const [x, y] = bAt(j)
      const sc = scAt(k)
      const srx = rx * sc * 0.72
      const sry = srx * 0.34
      const g = s('g', { opacity: 0 })
      branch.push(g)
      all.push({ k: k + 0.001, y, draw: () => (g.append(flatStone(x, y, srx, sry, id, r)), svg.append(g)) })
      const tr = s('ellipse', { class: 'v t15a-trace', cx: f1(x), cy: f1(y - sry * 0.08), rx: f1(srx * 0.18), ry: f1(sry * 0.4), opacity: 0 })
      bTrace.push(tr)
      marks.append(tr)
    })
    all.sort((a, b) => a.y - b.y).forEach((o) => o.draw())

    // your lantern
    const L = lantern(lx, ground, LH, id, r)
    svg.append(L.g)
    svg.append(tufts)
    svg.append(s('text', { class: 'lab', x: f1(lx), y: f1(Math.min(H - slH - 2, ground + LH * 0.06 + 14)), 'text-anchor': 'middle' }, A.you))

    // the agent's suggestions (level 2): dotted routes fanning out over the path
    const sugg = ([[3, 0, 0], [2.7, -0.75, -0.5], [2.5, 0.55, 0.45]] as const).map(([k, sd, bend]) => {
      const a = at(1)
      const b = path(k, false)
      const e: Pt = [b[0] + sd * G.side[0], b[1] + sd * G.side[1]]
      const c: Pt = [(a[0] + e[0]) / 2 + bend * G.side[0], (a[1] + e[1]) / 2 - G.hv * 1.3 + bend * G.side[1]]
      const d = `M${f1(a[0] + G.hv)} ${f1(a[1] - G.hv)}Q${f1(c[0])} ${f1(c[1])} ${f1(e[0])} ${f1(e[1] - G.hv * 0.4)}`
      const mid = nextId('t15r')
      const m = s('path', { d, class: 't15a-rm', pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 })
      return s('g', { class: 't15a-sugg', opacity: 0 },
        s('mask', { id: mid, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, m),
        s('path', { d, class: 't15a-route', mask: `url(#${mid})` }),
        s('circle', { class: 'k2', cx: f1(e[0]), cy: f1(e[1] - G.hv * 0.4), r: f1(Math.max(1.6, G.hv * 0.16)) }))
    })
    // its answer (level 1): a small speech bubble turned towards you
    const sp = stop(0)
    const bw = LH * 0.2
    const bx = sp[0] + G.hv * 1.4
    const by = sp[1] - G.hv * 2.2
    const speech = s('g', { class: 't15a-speech', opacity: 0 },
      s('path', { class: 'card', d: ell(bx + bw / 2, by, bw / 2, bw * 0.3) }),
      s('path', { class: 'k', 'fill-opacity': 0.7, d: brush([[bx + bw * 0.12, by + bw * 0.22], [bx + bw * 0.04, by + bw * 0.4], [bx + bw * 0.3, by + bw * 0.27]], Math.max(1, bw * 0.04), { a: 0.2, b: 0.3 }).d }),
      s('path', { class: 'k', 'fill-opacity': 0.75, d: brush(Array.from({ length: 25 }, (_, i) => { const a = (i / 24) * Math.PI * 2 - 2.2; return [bx + bw / 2 + Math.cos(a) * bw / 2, by + Math.sin(a) * bw * 0.3] as Pt }), Math.max(1, bw * 0.05), { a: 0.1, b: 0.3 }).d }),
      ...[0.62, 0.4].map((w, i) => s('path', { class: 'k2', 'fill-opacity': 0.7, d: brush([[bx + bw * 0.2, by - bw * 0.06 + i * bw * 0.14], [bx + bw * (0.2 + w), by - bw * 0.06 + i * bw * 0.14]], Math.max(1, bw * 0.035), { straight: true, a: 0.2, b: 0.4 }).d })))

    // the report (level 4): a scroll that rolls back to you and opens at your lantern
    const sw = clamp(LH * 0.3, 40, 112)
    const shh = sw * 0.44
    const clipId = nextId('t15c')
    const clipR = s('rect', { x: 0, y: f1(-shh / 2 - 2), width: 1, height: f1(shh + 4) })
    const paper = s('g', { 'clip-path': `url(#${clipId})` },
      s('path', { class: 'card', d: `M0 ${f1(-shh / 2)}L${f1(sw)} ${f1(-shh / 2 + 1)}L${f1(sw)} ${f1(shh / 2)}L0 ${f1(shh / 2 - 0.5)}Z`, filter: 'url(#ink-rough)' }),
      s('path', { class: 'k3', 'fill-opacity': 0.5, d: brush([[sw * 0.06, -shh / 2 + 1], [sw * 0.94, -shh / 2 + 1.6]], Math.max(1, sw * 0.012), { straight: true, a: 0.2, b: 0.2 }).d }),
      ...[0, 1, 2].map((i) => s('path', { class: 'k2', 'fill-opacity': 0.75, d: brush(cursive(sw * 0.16, -shh * 0.2 + i * shh * 0.22, sw * (0.16 + [0.58, 0.46, 0.34][i]), Math.max(1, shh * 0.06), i * 2), Math.max(0.9, sw * 0.016), { a: 0.05, b: 0.2, min: 0.4 }).d })),
      s('path', { class: 'v', d: `M${f1(sw * 0.74)} ${f1(shh * 0.12)}h${f1(sw * 0.1)}v${f1(sw * 0.1)}h${f1(-sw * 0.1)}Z`, filter: 'url(#ink-rough)' }))
    const roller = (len: number) => s('path', { class: 'k', 'fill-opacity': 0.85, d: brush([[0, -len / 2], [0, len / 2]], Math.max(2, sw * 0.07), { straight: true, a: 0.06, b: 0.06, min: 0.8 }).d })
    const rollR = s('g', null, roller(shh * 1.22))
    const scrollLab = s('text', { class: 'lab', x: f1(sw / 2), y: f1(-shh / 2 - 8), 'text-anchor': 'middle', opacity: 0 }, A.report)
    const scroll = s('g', { class: 't15a-scroll', opacity: 0 },
      s('clipPath', { id: clipId }, clipR), paper, roller(shh * 1.22), rollR, scrollLab)
    const unroll = (u: number) => {
      clipR.setAttribute('width', f1(Math.max(1, sw * u)))
      rollR.setAttribute('transform', `translate(${f1(Math.max(sw * 0.06, sw * u))} 0)`)
    }
    const scrollHome: Pt = [lx + LH * 0.27, ground + Math.min(shh * 0.15, Math.max(0, bot - ground - shh * 0.62))]

    // ripples of its answer (level 1)
    const ripples = [0, 1, 2].map(() => s('ellipse', { class: 't15a-rip', cx: 0, cy: 0, rx: 1, ry: 1, opacity: 0 }))
    const thread = s('path', { class: 't15a-thread' })
    const o = orb(clamp(LH * 0.034, 4, 11), id, A.agent)
    // level 3: at every stone the agent holds up a small paper card — "go on?"
    const askT = s('text', { class: 'lab t15a-askt', x: 0, y: 0 }, A.ask)
    const askIn = s('g', null, askT)
    const ask = s('g', { class: 't15a-ask', opacity: 0 }, askIn)
    // your light: a warm glow from the lantern that steps from stone to stone
    const youR = clamp(LH * 0.03, 3.5, 9)
    const you = s('g', { class: 't15a-you', opacity: 0 },
      s('circle', { r: f1(youR * 3.2), fill: `url(#${id.you})` }),
      s('circle', { r: f1(youR), class: 'you-core' }),
      s('text', { class: 'lab lab-sm', y: f1(-youR * 2.2), 'text-anchor': 'middle' }, A.you))
    const youHome: Pt = [lx + LH * 0.16, ground - youR * 1.6]
    const youOn = geo.map(({ x, y, sry }) => [x, y - sry * 0.55 - youR * 1.2] as Pt)
    svg.append(marks, thread, ...sugg, speech, ...ripples, you, o.shadow, o.g, scroll, ask, goal)
    // size the paper card around its words
    const fs = clamp(LH * 0.05, 11, 14)
    askT.style.fontSize = `${fs}px`
    const tw = askT.getComputedTextLength() || A.ask.length * fs * 0.52
    const pad = fs * 0.7
    const cw2 = tw + pad * 2
    const ch2 = fs * 1.9
    askT.setAttribute('x', f1(pad))
    askT.setAttribute('y', f1(-ch2 / 2 + fs * 0.35))
    const cy0 = -ch2
    const loop: Pt[] = [[4, cy0 + 1], [cw2 * 0.5, cy0 - 1], [cw2 - 2, cy0 + 1.5], [cw2 + 1, cy0 + ch2 * 0.5], [cw2 - 3, -1], [cw2 * 0.4, 0.5], [12, 0], [2, 7], [5, -1], [-1, cy0 + ch2 * 0.5], [5, cy0 + 0.5]]
    askIn.prepend(
      s('path', { class: 'card', d: `M${loop.map((p) => p.map(f1).join(' ')).join('L')}Z`, filter: 'url(#ink-rough)' }),
      s('path', { class: 'k2', 'fill-opacity': 0.8, d: brush(loop, Math.max(1, fs * 0.09), { a: 0.04, b: 0.08, min: 0.4 }).d, filter: 'url(#ink-rough)' }))
    P = { orb: o, thread, glow: L.glow, win: L.win, foot, trace, check, branch, bTrace, sugg, speech, ripples, goal, ask, askIn, scroll, scrollHome, unroll, scrollLab, you, youHome, youOn }

    // mist over the far end of the path: the agent at level 5 walks into it
    const mistL = at(3)[0] + step * 0.25
    if (wide) bands.forEach((b, i) => Object.assign(b.style, { left: `${mistL - step * (0.2 + i * 0.25)}px`, width: `${W - mistL + step * (0.6 + i * 0.3)}px`, top: `${horizon - sceneH * (0.2 - i * 0.12)}px`, height: `${sceneH * (0.42 + i * 0.05)}px` }))
    else bands.forEach((b, i) => Object.assign(b.style, { left: `${-W * (0.2 + i * 0.1)}px`, width: `${W * (1.4 + i * 0.2)}px`, top: `${horizon - sceneH * (0.2 - i * 0.05)}px`, height: `${sceneH * (0.26 + i * 0.02)}px` }))

    // the slider runs right under the path it controls, on the plain paper below the gravel:
    // each notch sits below the agent's stop for that level
    const pad2 = 26
    const sx = wide ? G.P0 - pad2 : W * 0.08
    const sw2 = step * 4 + pad2 * 2
    Object.assign(slider.style, { left: `${sx}px`, top: `${H - slH}px`, width: `${sw2}px`, height: `${slH}px` })
    groove.setAttribute('viewBox', `0 0 ${sw2} ${slH}`)
    const gy = slH * 0.42
    groove.replaceChildren(
      s('path', { class: 'k2', 'fill-opacity': 0.3, d: brush([[8, gy + 0.6], [sw2 * 0.35, gy - 0.4], [sw2 * 0.7, gy + 0.7], [sw2 - 8, gy]], 2, { a: 0.08, b: 0.2, min: 0.4 }).d }),
      s('path', { class: 'k2', 'fill-opacity': 0.75, d: brush([[4, gy + 0.4], [sw2 * 0.3, gy - 0.8], [sw2 * 0.66, gy + 0.9], [sw2 - 4, gy - 0.2]], 7, { a: 0.05, b: 0.3, min: 0.2, wob: 0.18 }).d, filter: `url(#${id.dryH})` }))
    notches.forEach((n, i) => (n.style.left = `${pad2 + i * step}px`))
    thumb.style.translate = `${pad2 + level * step}px 0`

    showFinal(level)
    // ambient life: the lantern flame breathes, the ember glows, the birds drift
    breath.forEach((a) => a.kill())
    breath = []
    if (!ctx.reduced) {
      breath.push(gsap.to(o.halo, { scale: 1.2, transformOrigin: '50% 50%', duration: 1.9, ease: 'sine.inOut', repeat: -1, yoyo: true }))
      breath.push(gsap.fromTo(L.glow, { opacity: 0.86 }, { opacity: 1, duration: 2.3, ease: 'sine.inOut', repeat: -1, yoyo: true }))
      if (ctx.quality !== 'low') {
        breath.push(gsap.fromTo(birds, { x: 0, y: 0 }, { x: sunR * 1.2, y: -sunR * 0.25, duration: 26, ease: 'sine.inOut', repeat: -1, yoyo: true }))
        breath.push(gsap.fromTo(mist, { x: -W * 0.04 }, { x: W * 0.04, duration: 30, ease: 'sine.inOut', repeat: -1, yoyo: true }))
      }
    }
  }
  let breath: { kill(): void }[] = []

  // ───────── states ─────────
  function vis(L: number) {
    return {
      foot: (_i: number) => L <= 1,
      trace: (i: number) => L >= 3 || (L === 2 && i <= 2),
      check: (i: number) => L === 2 && i <= 2,
      branch: L === 4,
    }
  }

  function showFinal(L: number) {
    if (!P) return
    story?.kill()
    story = null
    stopRipples()
    const v = vis(L)
    P.foot.forEach((e, i) => gsap.set(e, { opacity: v.foot(i) ? 1 : 0 }))
    P.trace.forEach((e, i) => gsap.set(e, { opacity: v.trace(i) ? 1 : 0, scale: 1 }))
    P.check.forEach((e, i) => gsap.set(e, { strokeDashoffset: v.check(i) ? 0 : 1 }))
    gsap.set([...P.branch, ...P.bTrace], { opacity: v.branch ? 1 : 0, scale: 1 })
    gsap.set(P.sugg, { opacity: L === 1 ? 1 : 0 })
    P.sugg.forEach((g) => gsap.set(g.querySelector('.t15a-rm'), { strokeDashoffset: L === 1 ? 0 : 1 }))
    gsap.set(P.speech, { opacity: L === 0 ? 1 : 0 })
    gsap.set(P.goal, { opacity: L === 4 ? 1 : 0 })
    gsap.set(P.ask, { opacity: 0 })
    gsap.set(P.scroll, { opacity: L === 3 ? 1 : 0, x: P.scrollHome[0], y: P.scrollHome[1], rotation: 0 })
    P.unroll(L === 3 ? 1 : 0.06)
    gsap.set(P.scrollLab, { opacity: L === 3 ? 1 : 0 })
    gsap.set(P.you, { opacity: L <= 1 ? 1 : 0 })
    setYou(L <= 1 ? P.youOn[P.youOn.length - 1] : P.youHome)
    gsap.set(P.thread, { opacity: THREAD[L] })
    P.thread.classList.toggle('loose', L >= 3)
    setO(stop(L))
    if (L === 0) startRipples()
  }

  function startRipples() {
    if (!P || ctx.reduced) return
    const rs = P.ripples
    const R = G.hv * 1.1
    const tw = gsap.fromTo(rs, { attr: { rx: R * 0.6, ry: R * 0.6, cx: O.x, cy: O.by }, opacity: 0.55 }, { attr: { rx: R * 3.2, ry: R * 3.2 }, opacity: 0, duration: 2.6, ease: 'power1.out', stagger: { each: 0.85, repeat: -1 } })
    rippleTw = tw
  }
  let rippleTw: { kill(): void } | null = null
  function stopRipples() {
    rippleTw?.kill()
    rippleTw = null
    if (P) gsap.set(P.ripples, { opacity: 0 })
  }

  /** A hop from a to b with an arc of `lift`; the shadow shrinks while it is in the air. */
  function hop(tl: TL, a: Q, b: Q, t0: number, dur: number, lift = G.hv * 1.2, ease = 'power1.inOut') {
    const p = { t: 0 }
    tl.to(p, {
      t: 1, duration: dur, ease,
      onUpdate: () => {
        O.x = a[0] + (b[0] - a[0]) * p.t
        O.by = a[1] + (b[1] - a[1]) * p.t
        O.gy = a[2] + (b[2] - a[2]) * p.t
        O.lift = Math.sin(Math.PI * p.t) * lift
        place()
      },
    }, t0)
    return t0 + dur
  }
  const hover = (k: number) => over(at(k))
  const bHover = (j: number) => over(bAt(j))
  const flare = (tl: TL, t: number) => {
    if (!P) return
    tl.fromTo(P.glow, { scale: 1 }, { scale: 1.4, duration: 0.35, ease: 'power2.out', svgOrigin: `${P.win[0]} ${P.win[1]}`, yoyo: true, repeat: 1 }, t)
  }
  const pop = (tl: TL, el: SVGElement, t: number) => tl.fromTo(el, { opacity: 0, scale: 0.2, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2.4)' }, t)

  function play(L: number) {
    if (!P) return
    if (ctx.reduced) return showFinal(L)
    story?.kill()
    stopRipples()
    const p = P
    const tl = gsap.timeline()
    story = tl
    // everything from the last run fades; the agent glides back to your lantern to set off again
    tl.to([...p.foot, ...p.trace, ...p.branch, ...p.bTrace, ...p.sugg, p.speech, p.goal, p.ask, p.you, p.scroll, p.scrollLab], { opacity: 0, duration: 0.35, ease: 'power1.out' }, 0)
    tl.to(p.check, { strokeDashoffset: 1, duration: 0.3 }, 0)
    tl.to(p.thread, { opacity: Math.max(THREAD[L], 0.5), duration: 0.5 }, 0)
    tl.call(() => p.thread.classList.toggle('loose', L >= 3), [], 0.1)
    const home = stop(0)
    const back = Math.hypot(O.x - home[0], O.by - home[1])
    const dBack = back < 2 ? 0 : clamp(back / 700, 0.45, 0.95)
    if (dBack) hop(tl, [O.x, O.by, O.gy], home, 0.1, dBack, G.hv * 1.5, 'power2.inOut')
    let t = 0.2 + dBack

    // levels 1–2: the answer or the routes are the agent's; the walking is yours — your light steps out of the lantern
    const youWalk = (t0: number) => {
      tl.call(() => setYou(p.youHome), [], t0)
      tl.to(p.you, { opacity: 1, duration: 0.35 }, t0)
      let a = p.youHome
      let tt = t0 + 0.3
      p.youOn.forEach((b, i) => {
        const from = a
        const q = { t: 0 }
        tl.to(q, {
          t: 1, duration: 0.46, ease: 'power1.inOut',
          onUpdate: () => {
            Y.x = from[0] + (b[0] - from[0]) * q.t
            Y.y = from[1] + (b[1] - from[1]) * q.t
            Y.lift = Math.sin(Math.PI * q.t) * G.hv * 1.1
            placeYou()
          },
        }, tt)
        tt += 0.46
        tl.to(p.foot[i], { opacity: 1, duration: 0.5, ease: 'power1.out' }, tt - 0.1)
        tt += 0.1
        a = b
      })
      return tt
    }

    if (L === 0) {
      tl.fromTo(p.speech, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, t)
      tl.call(startRipples, [], t)
      t = youWalk(t + 0.9)
    } else if (L === 1) {
      t = hop(tl, home, hover(1), t, 0.7, G.hv * 1.6)
      p.sugg.forEach((g, i) => tl.set(g, { opacity: 1 }, t + i * 0.3).fromTo(g.querySelector('.t15a-rm'), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut' }, t + i * 0.3))
      t = youWalk(t + 1.3)
    } else if (L === 2) {
      let a = home
      ;[0, 1, 2].forEach((i) => {
        const b = hover(STONES[i])
        t = hop(tl, a, b, t, 0.55)
        a = b
        // it asks, your lantern answers, the step is ticked off
        tl.to(p.ask, { opacity: 1, duration: 0.3 }, t).fromTo(p.askIn, { y: 5 }, { y: 0, duration: 0.4, ease: 'power2.out' }, t)
        flare(tl, t + 0.45)
        tl.to(p.check[i], { strokeDashoffset: 0, duration: 0.4, ease: 'power2.out' }, t + 0.9)
        tl.to(p.ask, { opacity: 0, duration: 0.25 }, t + 1)
        pop(tl, p.trace[i], t + 1)
        t += 1.35
      })
    } else if (L === 3) {
      let a = home
      STONES.forEach((k, i) => {
        const b = hover(k)
        t = hop(tl, a, b, t, 0.32, G.hv * 0.8)
        a = b
        pop(tl, p.trace[i], t - 0.05)
      })
      // the report, rolled up, flies back to you and opens at your lantern
      const s0 = at(3)
      const s1 = p.scrollHome
      const q = { t: 0 }
      tl.call(() => p.unroll(0.06), [], t)
      tl.set(p.scroll, { opacity: 1, x: s0[0], y: s0[1] - G.hv * 2, rotation: -24 }, t + 0.3)
      tl.to(q, { t: 1, duration: 1.4, ease: 'power2.inOut', onUpdate: () => {
        gsap.set(p.scroll, { x: s0[0] + (s1[0] - s0[0]) * q.t, y: s0[1] - G.hv * 2 + (s1[1] - s0[1] + G.hv * 2) * q.t - Math.sin(Math.PI * q.t) * G.LH * 0.3, rotation: -24 * (1 - q.t) })
      } }, t + 0.3)
      flare(tl, t + 1.6)
      const u = { u: 0.06 }
      tl.to(u, { u: 1, duration: 1.1, ease: 'power2.out', onUpdate: () => p.unroll(u.u) }, t + 1.75)
      tl.to(p.scrollLab, { opacity: 1, duration: 0.6 }, t + 2.5)
      t += 2.9
    } else {
      let a = home
      STONES.forEach((k, i) => {
        const b = hover(k)
        t = hop(tl, a, b, t, 0.3, G.hv * 0.8)
        a = b
        pop(tl, p.trace[i], t - 0.05)
      })
      // it lays its own stones: two little paths towards the big goal
      ;[0, 3, 1, 4, 2].forEach((j, n) => {
        tl.fromTo(p.branch[j], { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' }, t + 0.2 + n * 0.22)
        pop(tl, p.bTrace[j], t + 0.45 + n * 0.22)
      })
      tl.to(p.goal, { opacity: 1, duration: 0.8 }, t + 0.4)
      t += 1.4
      ;[0, 1, 2].forEach((j) => {
        const b = bHover(j)
        t = hop(tl, a, b, t, 0.42, G.hv * 0.9)
        a = b
      })
      tl.to(p.thread, { opacity: THREAD[4], duration: 0.8 }, t - 0.6)
    }
    if (L !== 4) tl.to(p.thread, { opacity: THREAD[L], duration: 0.6 }, t)
  }

  // ───────── the slider ─────────
  function sync(i: number) {
    slider.setAttribute('aria-valuenow', String(i + 1))
    slider.setAttribute('aria-valuetext', fill(A.valueText, { n: i + 1, name: A.levels[i].name }))
    notches.forEach((n, j) => n.classList.toggle('on', j === i))
  }

  let capAt = -1
  function caption(i: number) {
    if (i === capAt) return
    capAt = i
    fillCap(i)
    cap.hidden = false
    if (!ctx.reduced) ctx.anim(() => gsap.fromTo(cap.children, { opacity: 0, y: 6, filter: 'blur(4px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.8, stagger: 0.07, ease: 'power3.out', clearProps: 'filter' }))
  }

  function choose(i: number, anim = true) {
    i = clamp(i, 0, LAST)
    thumb.style.translate = `${26 + i * G.ns}px 0`
    if (i === level && told) return
    const changed = i !== level
    level = i
    sync(i)
    caption(i)
    told = true
    root.classList.add('touched')
    if (changed) {
      visited.add(i)
      ctx.chime('soft')
      if (anim) ctx.anim(() => play(i))
      else showFinal(i)
    }
    if (!said && (visited.size >= 4 || (visited.has(LAST) && visited.size >= 3))) {
      said = true
      ctx.insight(A.insight, A.detail)
    }
  }

  let drag = false
  let dragPend = -1
  let dragTimer = 0
  // measured once per drag: reading it on every move would force a layout after each thumb/caption write
  let sliderLeft = 0
  const nearest = (clientX: number) => {
    const x = clamp(clientX - sliderLeft, 26, 26 + G.ns * 4)
    return { x, i: Math.round((x - 26) / G.ns) }
  }
  slider.addEventListener('pointerdown', (e) => {
    sliderLeft = slider.getBoundingClientRect().left
    drag = true
    slider.setPointerCapture(e.pointerId)
    slider.classList.add('drag')
    slider.focus({ preventScroll: true })
    move(e)
  })
  const move = (e: PointerEvent) => {
    if (!drag) return
    const { x, i } = nearest(e.clientX)
    thumb.style.translate = `${x}px 0`
    if (i !== dragPend) {
      dragPend = i
      clearTimeout(dragTimer)
      // while the hand is still moving only the words follow; the garden plays once it rests
      dragTimer = window.setTimeout(() => drag && choose(dragPend), 380)
      if (i !== level) {
        sync(i)
        caption(i)
      }
    }
  }
  slider.addEventListener('pointermove', move)
  const up = () => {
    if (!drag) return
    drag = false
    clearTimeout(dragTimer)
    slider.classList.remove('drag')
    choose(dragPend)
    dragPend = -1
  }
  slider.addEventListener('pointerup', up)
  slider.addEventListener('pointercancel', up)
  slider.addEventListener('keydown', (e) => {
    const k = e.key
    let i = level
    if (k === 'ArrowRight' || k === 'ArrowUp') i++
    else if (k === 'ArrowLeft' || k === 'ArrowDown') i--
    else if (k === 'Home') i = 0
    else if (k === 'End') i = LAST
    else return
    e.preventDefault()
    ctx.art.dispatchEvent(new PointerEvent('pointerdown'))
    choose(i)
  })

  cap.hidden = true
  sync(0)
  watchSize(ctx, layout, () => ((capW = -1), stable.reset()))
  layout()

  return () => {
    clearTimeout(dragTimer)
    story?.kill()
    rippleTw?.kill()
    breath.forEach((a) => a.kill())
  }
}
