import { h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import { cssVar, onPrefs } from '../../core/prefs'
import type { SceneCtx } from '../types'
import { blob, clamp, onDigit, onSize, p2Defs, rng, stableHeight, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist, moon, reeds, toro } from '../../ui/part2/paint'
import { C } from './data'
import { f1, figure, P, paperSlip } from './kit'

const G = C.scenes.fence
const PITCH = 15 * (Math.PI / 180) // LOW 15°
const HL = 0.5 // the lamp's flame height (fence radius = 1)
const HALF = 0.95 // the beam's half-width (rad)
const CRACKS = [0.16, 0.38, 0.6, 0.8] // along the wall

/**
 * II·12 "fence" (canvas): night, LOW 15°. A near-white lamp inside a ring of bamboo stakes tied with thorn rope is the key
 * light of the whole picture: every stake throws a long shadow fanning out from it (quads projected from the flame onto
 * the ground, drawn on a canvas between painted SVG layers). Behind, a city wall runs off into the mist; where the light
 * pool touches it, thin cracks with vermilion lips show — only there. Two guards with stamped warm lanterns wait at the
 * gate. Push the gate (denied), tap each guard's lantern (they walk in, their seal glows, the fact hangs on paper), then
 * turn the lamp like a lighthouse: the stake shadows sweep the ground and the beam slides along the wall, crack by crack.
 * The canvas draws only while the lamp turns. Low: the shadow fan is drawn once; dragging moves a round reveal on the wall.
 */
export function fenceScene(ctx: SceneCtx) {
  p2Defs()
  const low = ctx.quality === 'low'
  const root = h('div', { class: 't30f' })
  const bg = s('svg', { class: 't30f-svg', 'aria-hidden': 'true' })
  const cw = h('canvas', { class: 't30f-cv', 'aria-hidden': 'true' }) // light on the wall
  const mid = s('svg', { class: 't30f-svg', 'aria-hidden': 'true' }) // the compound floor
  const ca = h('canvas', { class: 't30f-cv', 'aria-hidden': 'true' }) // ground light, shadows, far stakes
  const lampSvg = s('svg', { class: 't30f-svg', 'aria-hidden': 'true' })
  const cb = h('canvas', { class: 't30f-cv', 'aria-hidden': 'true' }) // near stakes, gate, the beam in the air
  // the facts hang in the open ground beside the fence: each guard's paper from its spear (Mythos with "why" tied under
  // it, Fairwind with the open question carved on a wooden board under it); a phone shows the latest one only
  const slips = G.cases.map(() => paperSlip('t30f-slip t30f-piece'))
  const whySlip = paperSlip('t30f-slip t30f-piece')
  const plaque = h('div', { class: 't30f-plaque t30f-piece' })
  const hangs = [h('div', { class: 't30f-hang l', role: 'group', 'aria-label': G.group }, slips[0], whySlip), h('div', { class: 't30f-hang r', role: 'group', 'aria-label': G.group }, slips[1], plaque)]
  const denied = h('p', { class: 't30f-denied' }, G.denied)
  const gate = h('button', { class: 't30f-gate', type: 'button', 'aria-label': G.gateAria }, h('span', { class: 't30f-gate-name' }, G.gate))
  const guards = G.cases.map((c, i) => h('button', { class: 't30f-guard', type: 'button', 'aria-pressed': 'false', onClick: () => pick(i) },
    guardArt(3040 + i, i ? -1 : 1), h('span', { class: 't30f-guard-name' }, c.name)))
  const lamp = h('div', { class: 't30f-lamp', role: 'slider', tabindex: '0', 'aria-label': G.lampAria, 'aria-valuemin': '0', 'aria-valuemax': '359', 'aria-valuenow': '90' })
  root.append(h('p', { class: 'visually-hidden' }, G.art), bg, cw, mid, ca, lampSvg, cb, lamp, gate, denied, ...guards, ...hangs)
  ctx.art.append(root)
  ctx.prompt(G.prompt)
  const stableH = stableHeight(ctx, [G.insight as Fact])
  const xa = ca.getContext('2d')!, xb = cb.getContext('2d')!, xw = cw.getContext('2d')!

  // ── colours (read on mount and when the theme changes; never in a frame)
  let col = { umbra: '', ink: '', moon: '', lantern: '', verm: '', paper: '', culm: '', culmHi: '', dark: false }
  const readCol = () => {
    const dark = document.documentElement.dataset.theme === 'dark'
    return { umbra: cssVar('--umbra'), ink: cssVar('--ink'), moon: cssVar('--moon'), lantern: cssVar('--lantern'), verm: cssVar('--vermilion'), paper: cssVar('--paper'), culm: cssVar(dark ? '--rock-mid' : '--ink-3'), culmHi: cssVar(dark ? '--step-hi' : '--step-mid'), dark }
  }
  col = readCol()

  // ── state
  let beta = Math.PI / 2 // the beam: toward the viewer
  const revealed = new Set<number>()
  const seen = new Set<number>()
  let knocked = false

  // ── geometry (set per layout): camera, stakes, rope, wall
  let W = 0, H = 0, F = 1, cx = 0, cy = 0, dpr = 1, tall = false
  let camD = 4.6
  const proj = (x: number, y: number, z: number): Pt => {
    // camera on the +z side, pitched down 15°, looking at the compound centre
    const vy = y - camD * Math.sin(PITCH), vz = z - camD * Math.cos(PITCH)
    const yc = vy * Math.cos(PITCH) - vz * Math.sin(PITCH)
    const d = -vy * Math.sin(PITCH) - vz * Math.cos(PITCH)
    return [cx + (F * x) / d, cy - (F * yc) / d]
  }
  interface Stake { a: number; front: boolean; body: Path2D; side: Path2D; nodes: Path2D; shadow: Path2D[]; base: Pt; top: Pt }
  let stakes: Stake[] = []
  let ropeBack: Path2D | null = null, ropeFront: Path2D | null = null, thorns: Path2D | null = null, door: Path2D | null = null
  let barbs: { a: number; x: number; y: number; r: number }[] = [] // the knots of the barbed wire, to catch the beam
  let wallA: Pt = [0, 0], wallB: Pt = [0, 0], wallH = 0.9
  let pool: HTMLCanvasElement | null = null, poolAt: Pt = [0, 0], poolSize: Pt = [1, 1]
  let crackCv: HTMLCanvasElement | null = null, spot: HTMLCanvasElement | null = null
  let crackAt: Pt[] = []
  let spotK = 1

  function layout() {
    W = ctx.art.clientWidth
    H = stableH(ctx.art.clientHeight)
    if (W < 60 || H < 60) return
    root.style.height = `${f1(H)}px`
    tall = W / H < 0.9
    root.classList.toggle('tall', tall)
    dpr = Math.min(devicePixelRatio || 1, low ? 1 : 1.5)
    for (const c of [ca, cb, cw]) {
      c.width = Math.round(W * dpr)
      c.height = Math.round(H * dpr)
    }
    // the fence (radius 1) fills ~40 % of the width; the compound sits a little below the middle
    F = tall ? W * 1.75 : Math.min(W * 0.86, H * 1.8)
    cx = W * 0.5
    cy = tall ? H * 0.4 : H * 0.56
    camD = 4.6
    wallH = 0.95
    ;[wallA, wallB] = tall ? [[-3.6, -3.0], [3.6, -3.0]] : [[-5.8, -3.4], [8.5, -9.5]]
  }
  function* build() {
    layout()
    if (W < 60 || H < 60) return
    yield
    buildGeo()
    yield
    drawStatic()
    yield
    placeHtml()
    draw()
  }

  // stakes round the ring (gate gap at the front), each a tapered body and a shadow in three fading pieces
  function buildGeo() {
    const r = rng(3050)
    stakes = []
    const n = 46
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.03
      const da = Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))
      if (Math.abs(da) < 0.17) continue // the gate
      const x = Math.cos(a), z = Math.sin(a)
      const hs = 0.26 + r() * 0.08, w = 0.022
      const lean = (r() - 0.5) * 0.03
      const b0 = proj(x - w, 0, z), b1 = proj(x + w, 0, z), t0 = proj(x - w * 0.8 + lean, hs, z), t1 = proj(x + w * 0.8 + lean, hs, z)
      const body = new Path2D(`M${P(b0)}L${P(t0)}L${P(t1)}L${P(b1)}Z`)
      // a bamboo culm, not a bar: three node rings, and its side toward the flame lit (the lamp is left of it when x > 0)
      const ring = (y: number) => {
        const l = proj(x - w * 1.1 + lean * (y / hs), y, z), q = proj(x + w * 1.1 + lean * (y / hs), y, z)
        return `M${P(l)}L${P(q)}L${f1(q[0])} ${f1(q[1] + 1.3)}L${f1(l[0])} ${f1(l[1] + 1.3)}Z`
      }
      const sd = x > 0 ? -1 : 1
      const e0 = proj(x + sd * w, 0, z), e1 = proj(x + sd * w * 0.8 + lean, hs, z)
      const i0 = proj(x + sd * w * 0.3, 0, z), i1 = proj(x + sd * w * 0.25 + lean, hs, z)
      const side = new Path2D(`M${P(e0)}L${P(e1)}L${P(i1)}L${P(i0)}Z`)
      const nodes = new Path2D(ring(hs * 0.3) + ring(hs * 0.62) + ring(hs * 0.9))
      // the shadow: from the foot away from the flame, length hs / (HL − hs) × distance
      const k = hs / (HL - hs)
      const px = -z, pz = x // perpendicular on the ground
      const piece = (u0: number, u1: number) => {
        const w0 = w * (1 + u0 * 2.4), w1 = w * (1 + u1 * 2.4)
        const p = (u: number, s1: number, ww: number) => proj(x * (1 + k * u) + px * ww * s1, 0, z * (1 + k * u) + pz * ww * s1)
        return new Path2D(`M${P(p(u0, -1, w0))}L${P(p(u1, -1, w1))}L${P(p(u1, 1, w1))}L${P(p(u0, 1, w0))}Z`)
      }
      stakes.push({ a, front: z > 0.02, body, side, nodes, shadow: [piece(0, 0.4), piece(0.4, 0.75), piece(0.75, 1)], base: proj(x, 0, z), top: proj(x, hs, z) })
    }
    // barbed wire, back half and front half: two strands twisted round each other, a knot of four short barbs every
    // few twists (sized by distance); the knots are kept to glint when the beam crosses them
    barbs = []
    const rail = (k: number, a0: number, a1: number) => {
      let d1 = '', d2 = '', th = ''
      const n = Math.max(12, Math.round(Math.abs(a1 - a0) * 16))
      for (let i = 0; i <= n; i++) {
        const a = a0 + ((a1 - a0) * i) / n
        const tw = Math.sin(i * 2.3) * 0.008
        const p = proj(Math.cos(a), 0.3 * k + tw, Math.sin(a)), q = proj(Math.cos(a), 0.3 * k - tw, Math.sin(a))
        d1 += `${i ? 'L' : 'M'}${P(p)}`
        d2 += `${i ? 'L' : 'M'}${P(q)}`
        if (i % 3 !== 1 || i === n) continue
        const c = proj(Math.cos(a), 0.3 * k, Math.sin(a))
        const L = Math.max(1.8, Math.abs(proj(Math.cos(a), 0.3 * k + 0.018, Math.sin(a))[1] - c[1]))
        const tilt = (i % 2 ? 0.35 : -0.35)
        for (const ang of [0.9 + tilt, 2.3 + tilt, 4.0 + tilt, 5.4 + tilt]) th += `M${P(c)}L${f1(c[0] + Math.cos(ang) * L * 1.5)} ${f1(c[1] + Math.sin(ang) * L)}`
        barbs.push({ a, x: c[0], y: c[1], r: L })
      }
      return { d: d1 + d2, th }
    }
    const g0 = Math.PI / 2 - 0.17, g1 = Math.PI / 2 + 0.17
    const bk = [rail(0.38, Math.PI, 2 * Math.PI), rail(0.78, Math.PI, 2 * Math.PI)]
    const fr = [rail(0.38, 0, g0), rail(0.78, 0, g0), rail(0.38, g1, Math.PI), rail(0.78, g1, Math.PI)]
    ropeBack = new Path2D(bk.map((x) => x.d).join(''))
    ropeFront = new Path2D(fr.map((x) => x.d).join(''))
    thorns = new Path2D([...bk, ...fr].map((x) => x.th).join(''))
    // the shut gate: two taller posts, a lintel, five bars
    const gx = (a: number, y: number) => proj(Math.cos(a), y, Math.sin(a))
    let dd = ''
    const post = (a: number) => {
      const b0 = gx(a, 0), t0 = gx(a, 0.46)
      return `M${f1(b0[0] - 3)} ${f1(b0[1])}L${f1(t0[0] - 2.5)} ${f1(t0[1])}L${f1(t0[0] + 2.5)} ${f1(t0[1])}L${f1(b0[0] + 3)} ${f1(b0[1])}Z`
    }
    dd += post(g0) + post(g1)
    for (let i = 0; i < 5; i++) {
      const a = g0 + ((g1 - g0) * (i + 0.5)) / 5
      const b0 = gx(a, 0.01), t0 = gx(a, 0.32)
      dd += `M${f1(b0[0] - 1.6)} ${f1(b0[1])}L${f1(t0[0] - 1.4)} ${f1(t0[1])}L${f1(t0[0] + 1.4)} ${f1(t0[1])}L${f1(b0[0] + 1.6)} ${f1(b0[1])}Z`
    }
    const l0 = gx(g0 - 0.06, 0.47), l1 = gx(g1 + 0.06, 0.47)
    dd += `M${f1(l0[0])} ${f1(l0[1] - 2)}L${f1(l1[0])} ${f1(l1[1] - 2)}L${f1(l1[0])} ${f1(l1[1] + 2.5)}L${f1(l0[0])} ${f1(l0[1] + 2.5)}Z`
    for (const y of [0.1, 0.22]) {
      const a0 = gx(g0, y), a1 = gx(g1, y)
      dd += `M${f1(a0[0])} ${f1(a0[1] - 1)}L${f1(a1[0])} ${f1(a1[1] - 1)}L${f1(a1[0])} ${f1(a1[1] + 1)}L${f1(a0[0])} ${f1(a0[1] + 1)}Z`
    }
    door = new Path2D(dd)
    // the light pool: a soft ellipse on the ground round the flame, drawn once and clipped to the beam each frame
    const c0 = proj(0, 0, 0), cl = proj(-3, 0, 0), cn = proj(0, 0, 2.6), cf = proj(0, 0, -3)
    const rx = c0[0] - cl[0], ry = (cn[1] - cf[1]) / 2
    pool = document.createElement('canvas')
    pool.width = Math.max(1, Math.round(rx * 2 * dpr))
    pool.height = Math.max(1, Math.round(ry * 2 * dpr))
    const px = pool.getContext('2d')!
    px.setTransform(dpr, 0, 0, (dpr * ry) / rx, 0, 0)
    const light = col.dark ? col.moon : '#ffffff'
    const g = px.createRadialGradient(rx, rx, 0, rx, rx, rx)
    g.addColorStop(0, rgba(light, 1))
    g.addColorStop(0.3, rgba(light, 0.55))
    g.addColorStop(1, rgba(light, 0))
    px.fillStyle = g
    px.fillRect(0, 0, rx * 2, rx * 2)
    poolSize = [rx * 2, ry * 2]
    poolAt = [c0[0] - rx, (cn[1] + cf[1]) / 2 - ry]
    // the beam's spot on the wall: a soft disc drawn once, scaled into place each frame
    spot = document.createElement('canvas')
    spot.width = spot.height = 128
    const sx = spot.getContext('2d')!
    const sg = sx.createRadialGradient(64, 64, 0, 64, 64, 64)
    sg.addColorStop(0, rgba(light, 1))
    sg.addColorStop(1, rgba(light, 0))
    sx.fillStyle = sg
    sx.fillRect(0, 0, 128, 128)
    // cracks on the wall: dark split lines with a vermilion lip, drawn once off-screen
    crackCv = document.createElement('canvas')
    crackCv.width = ca.width
    crackCv.height = ca.height
    const xc = crackCv.getContext('2d')!
    xc.scale(dpr, dpr)
    crackAt = []
    CRACKS.forEach((t, i) => {
      const x = wallA[0] + (wallB[0] - wallA[0]) * t, z = wallA[1] + (wallB[1] - wallA[1]) * t
      const y0 = wallH * (0.75 - (i % 2) * 0.12)
      const pts: Pt[] = []
      const rr = rng(3060 + i)
      for (let k = 0; k <= 6; k++) pts.push(proj(x + (rr() - 0.5) * 0.12, y0 - (k / 6) * wallH * 0.6, z))
      crackAt.push(proj(x, wallH * 0.45, z))
      const d = new Path2D(stroke(pts, Math.max(2.4, F * 0.008), 0.15, 0.3, 0.3))
      xc.save()
      xc.translate(1.8, 0.8)
      xc.fillStyle = col.verm
      xc.fill(d)
      xc.restore()
      xc.fillStyle = col.dark ? '#000' : col.ink
      xc.fill(d)
    })
    const w0 = proj(wallA[0], wallH * 0.5, wallA[1]), w1 = proj(wallA[0] + 1, wallH * 0.5, wallA[1])
    spotK = Math.hypot(w1[0] - w0[0], w1[1] - w0[1])
  }

  // ── the painted layers (static per layout): sky, moon, wall, mist; the compound floor; the lamp
  function drawStatic() {
    for (const v of [bg, mid, lampSvg]) v.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    const r = rng(3070)
    const horizon = proj(0, 0, -9)[1]
    // the wall: a long band in perspective, courses, crenels, one tower, its foot in mist
    const N = 24
    const top: Pt[] = [], bot: Pt[] = []
    for (let i = 0; i <= N; i++) {
      const t = i / N
      const x = wallA[0] + (wallB[0] - wallA[0]) * t, z = wallA[1] + (wallB[1] - wallA[1]) * t
      top.push(proj(x, wallH, z))
      bot.push(proj(x, 0, z))
    }
    const wall = `M${top.map(P).join('L')}L${[...bot].reverse().map(P).join('L')}Z`
    let courses = '', crenels = ''
    for (const k of [0.25, 0.5, 0.75]) {
      for (let i = 0; i < N; i++) {
        if (r() < 0.35) continue
        const a = top[i], b = bot[i], c = top[i + 1], d = bot[i + 1]
        const p0: Pt = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], p1: Pt = [c[0] + (d[0] - c[0]) * k, c[1] + (d[1] - c[1]) * k]
        courses += `M${P(p0)}L${P([p0[0] + (p1[0] - p0[0]) * (0.6 + r() * 0.3), p0[1] + (p1[1] - p0[1]) * (0.6 + r() * 0.3)])}`
      }
    }
    for (let i = 0; i < N * 2; i += 2) {
      const t0 = (i + (r() - 0.5) * 0.3) / (N * 2), t1 = (i + 0.8 + r() * 0.3) / (N * 2)
      const q = (t: number, y: number) => proj(wallA[0] + (wallB[0] - wallA[0]) * t, y, wallA[1] + (wallB[1] - wallA[1]) * t)
      crenels += `M${P(q(t0, wallH))}L${P(q(t0, wallH * 1.14))}L${P(q(t1, wallH * 1.14))}L${P(q(t1, wallH))}Z`
    }
    const tt = tall ? 0.18 : 0.1
    const tq = (dt: number, y: number) => proj(wallA[0] + (wallB[0] - wallA[0]) * (tt + dt), y, wallA[1] + (wallB[1] - wallA[1]) * (tt + dt) + 0.05)
    const tower = `M${P(tq(-0.035, 0))}L${P(tq(-0.035, wallH * 1.7))}L${P(tq(0.035, wallH * 1.7))}L${P(tq(0.035, 0))}Z`
    const roofL = tq(-0.06, wallH * 1.66), roofR = tq(0.06, wallH * 1.66), roofT = tq(0, wallH * 2.2)
    const roof = `M${P(roofL)}Q${P([roofL[0] + (roofT[0] - roofL[0]) * 0.6, roofL[1] - 4])} ${P(roofT)}Q${P([roofR[0] - (roofR[0] - roofT[0]) * 0.6, roofR[1] - 4])} ${P(roofR)}Z`
    const mr = clamp(F * 0.05, 14, 30)
    const mx = tall ? W * 0.78 : W * 0.86, my = Math.max(mr * 2, Math.min(top[0][1], top[N][1]) - F * 0.22)
    bg.replaceChildren(
      mist(W * 0.5, horizon - F * 0.1, W * 0.7, F * 0.25),
      moon(mx, my, mr, 3071, true),
      hills(-W * 0.05, W * 1.05, horizon, F * 0.16, 3072, 0.92, 6),
      mist(W * 0.5, horizon, W * 0.7, F * 0.06),
      s('path', { class: 't30f-wall', d: wall, filter: 'url(#ink-rough)' }),
      s('path', { class: 't30f-wall-shade', d: wall }),
      s('path', { class: 't30f-crenel', d: crenels }),
      s('path', { class: 't30f-course', d: courses }),
      s('path', { class: 't30f-wall', d: tower, filter: 'url(#ink-rough)' }),
      s('path', { class: 't30f-roof', d: roof, filter: 'url(#ink-rough)' }),
      s('path', { class: 't30f-wall-top', d: stroke(top, Math.max(1.2, F * 0.004), 0.05, 0.05, 0.4) }),
      mist(proj(wallA[0] * 0.5 + wallB[0] * 0.5, 0, wallA[1] * 0.5 + wallB[1] * 0.5)[0], bot[Math.round(N / 2)][1], W * 0.6, F * 0.05),
      // light theme: ink dusk gathering toward the frame, so the lamp stays the light of the picture (none at night)
      s('defs', null, s('radialGradient', { id: 't30f-dusk-g', gradientUnits: 'userSpaceOnUse', cx: f1(cx), cy: f1(proj(0, 0, 0)[1]), r: f1(Math.max(W, H) * 0.75) },
        s('stop', { offset: 0.2, style: 'stop-color:var(--wash);stop-opacity:0' }),
        s('stop', { offset: 1, style: 'stop-color:var(--wash);stop-opacity:.42' }))),
      s('rect', { class: 't30f-dusk', x: 0, y: 0, width: f1(W), height: f1(H), fill: 'url(#t30f-dusk-g)' }))
    // the compound floor: raked sand rings round the lamp, a wash of ground beyond
    const ring = (k: number) => {
      let d = ''
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * Math.PI * 2
        d += `${i ? 'L' : 'M'}${P(proj(Math.cos(a) * k, 0, Math.sin(a) * k))}`
      }
      return d + 'Z'
    }
    const groundD = ring(3.2)
    mid.replaceChildren(
      s('path', { class: 't30f-ground', d: groundD, filter: 'url(#ink-wash)' }),
      s('path', { class: 't30f-sand', d: ring(1.02) }),
      s('path', { class: 't30f-rake', d: ring(0.3) + ring(0.45) + ring(0.6) + ring(0.75) + ring(0.9) }),
      grass(proj(-1.6, 0, 1.0)[0], proj(-1.6, 0, 1.0)[1], F * 0.08, 3073),
      grass(proj(1.7, 0, 0.6)[0], proj(1.7, 0, 0.6)[1], F * 0.07, 3074),
      grass(proj(-0.9, 0, 2.2)[0], proj(-0.9, 0, 2.2)[1], F * 0.1, 3075),
      // near dark: tufts and a stone cut by the frame
      s('path', { class: 't30f-near', d: blob(W * 0.97, H * 1.02, F * 0.16, F * 0.07, 3076, 0.14, 14), filter: 'url(#ink-rough)' }),
      reeds(W * 0.03, H * 1.01, F * 0.2, 3077, 8),
      reeds(W * 0.93, H * 0.99, F * 0.12, 3078, 5))
    // the lamp: a stone post, a near-white flame (moon core, cold halo) — the key light
    const [lx, ly] = proj(0, 0, 0)
    const lh = proj(0, HL / 0.63, 0)[1] // the flame sits in the firebox of a Kasuga lantern
    const [, fy] = proj(0, HL, 0)
    lampSvg.replaceChildren(
      s('circle', { class: 't30f-halo', cx: f1(lx), cy: f1(fy), r: f1(F * 0.5), fill: 'url(#t30f-cold)' }),
      s('circle', { class: 't30f-halo', cx: f1(lx), cy: f1(fy), r: f1(F * 0.16), fill: 'url(#t30f-cold)' }),
      s('defs', null, s('radialGradient', { id: 't30f-cold' },
        s('stop', { offset: 0, style: 'stop-color:var(--moon);stop-opacity:.75' }),
        s('stop', { offset: 0.3, style: 'stop-color:var(--moon);stop-opacity:.2' }),
        s('stop', { offset: 1, style: 'stop-color:var(--moon);stop-opacity:0' }))),
      s('g', { class: 't30f-post' }, toro(lx, ly, ly - lh, true)),
      s('circle', { class: 't30f-flame', cx: f1(lx), cy: f1(fy), r: f1(Math.max(2.5, F * 0.012)) }))
    void r
  }

  // ── buttons and paper placed on the painting
  function placeHtml() {
    const g = proj(0, 0, 1.0), gt = proj(0, 0.5, 1.0)
    const gw = Math.max(54, (proj(0.3, 0, 1)[0] - g[0]) * 2)
    Object.assign(gate.style, { left: `${f1(g[0] - gw / 2)}px`, top: `${f1(gt[1] - 8)}px`, width: `${f1(gw)}px`, height: `${f1(g[1] - gt[1] + 34)}px` })
    Object.assign(denied.style, { left: `${f1(g[0])}px`, top: `${f1(g[1] + 30)}px` })
    guards.forEach((b, i) => {
      const sd = i ? 1 : -1, dir = i ? -1 : 1
      const at = proj(sd * (tall ? 0.62 : 0.46), 0, 1.32) // waiting at the gate
      // once called, a guard steps aside into the open ground (a phone has no room: it stays), its paper on its spear
      const out = tall ? at : proj(sd * 1.32, 0, 0.25)
      const k = Math.abs(proj(0, 0.5, 1.32)[1] - at[1]), ko = tall ? k : Math.abs(proj(0, 0.5, 0.25)[1] - out[1])
      Object.assign(b.style, { left: `${f1(at[0] - k * 0.45)}px`, top: `${f1(at[1] - k)}px`, width: `${f1(k * 0.9)}px`, height: `${f1(k)}px` })
      b.style.setProperty('--in-x', `${f1(out[0] - at[0])}px`)
      b.style.setProperty('--in-y', `${f1(out[1] - ko / 2 - (at[1] - k / 2))}px`)
      b.style.setProperty('--in-s', (ko / k).toFixed(3))
      // the spear tip once stepped aside (guard art: spear at x = -8·dir of a 52-wide box, tip 1/54 from the top)
      const tip: Pt = [out[0] - dir * (8 / 52) * ko * 0.9, out[1] - ko * 0.98]
      const hang = hangs[i]
      if (tall) Object.assign(hang.style, { left: '6%', width: '88%', top: `${f1(proj(0, 0, 1.6)[1] + 26)}px`, right: '' })
      else {
        const cw = clamp(i ? W * 0.935 - tip[0] : tip[0] - W * 0.065, 170, 270)
        Object.assign(hang.style, { left: `${f1(i ? tip[0] - 3 : tip[0] + 3 - cw)}px`, width: `${f1(cw)}px`, top: `${f1(tip[1])}px` })
      }
    })
    const [lx, fb] = proj(0, 0, 0), [, ft] = proj(0, HL / 0.63, 0)
    Object.assign(lamp.style, { left: `${f1(lx - 26)}px`, top: `${f1(ft - 6)}px`, width: '52px', height: `${f1(fb - ft + 6)}px` })
  }

  // ── the light: pool clipped to the beam, stake shadows, the beam on the wall, the beam in the air
  // low quality: the ground light stays put (one fan, drawn once); only the reveal on the wall follows the drag
  const groundBeta = () => (low ? Math.PI / 2 : beta)
  const lit = (a: number) => {
    let d = Math.abs(a - groundBeta()) % (Math.PI * 2)
    if (d > Math.PI) d = Math.PI * 2 - d
    const t = clamp((HALF - d) / (HALF * 0.45), 0, 1)
    return t * t * (3 - 2 * t)
  }
  // frame-time scratch (draw() allocates nothing): one projected point, the wall hit, the three canvases
  const Q: Pt = [0, 0]
  const projQ = (x: number, y: number, z: number): Pt => {
    const vy = y - camD * Math.sin(PITCH), vz = z - camD * Math.cos(PITCH)
    const d = -vy * Math.sin(PITCH) - vz * Math.cos(PITCH)
    Q[0] = cx + (F * x) / d
    Q[1] = cy - (F * (vy * Math.cos(PITCH) - vz * Math.sin(PITCH))) / d
    return Q
  }
  const HIT = [0, 0, 0]
  const CTXS = [xa, xb, xw]
  const SH_DARK = [0.72, 0.46, 0.22], SH_LIGHT = [0.62, 0.4, 0.17]
  function paintStakes(x: CanvasRenderingContext2D, front: boolean, dark: boolean) {
    const light = dark ? col.moon : '#ffffff'
    for (const st of stakes) {
      if (st.front !== front) continue
      x.globalAlpha = 1
      x.fillStyle = col.culm
      x.fill(st.body)
      const L = lit(st.a)
      const k = L * (front ? 0.18 : 0.8) * Math.max(0.2, -Math.sin(st.a) + 0.5)
      if (k > 0.02) {
        x.globalAlpha = Math.min(1, k)
        x.fillStyle = light
        x.fill(st.body)
      }
      // the side toward the flame: a rim on the near stakes (backlit), a lit face on the far ones
      x.globalAlpha = (front ? 0.22 : 0.3) + L * (front ? 0.5 : 0.65)
      x.fillStyle = light
      x.fill(st.side)
      x.globalAlpha = dark ? 0.6 : 0.42
      x.fillStyle = dark ? '#000' : col.ink
      x.fill(st.nodes)
    }
    x.globalAlpha = dark ? 0.7 : 0.8
    x.strokeStyle = dark ? col.culmHi : col.ink
    x.lineWidth = 0.9
    x.stroke(front ? ropeFront! : ropeBack!)
  }
  function draw() {
    if (!pool || !spot || !crackCv || !door || !ropeBack || !ropeFront || !thorns) return
    const dark = col.dark
    const gb = groundBeta()
    for (const x of CTXS) {
      x.setTransform(dpr, 0, 0, dpr, 0, 0)
      x.clearRect(0, 0, W, H)
    }
    // ground: a faint all-round glow, then the beam's pool
    xa.globalAlpha = dark ? 0.16 : 0.34
    xa.drawImage(pool, poolAt[0], poolAt[1], poolSize[0], poolSize[1])
    xa.save()
    xa.beginPath()
    projQ(0, 0, 0)
    xa.moveTo(Q[0], Q[1])
    for (let i = 0; i <= 10; i++) {
      const a = gb - HALF + (HALF * 2 * i) / 10
      projQ(Math.cos(a) * 4, 0, Math.sin(a) * 4)
      xa.lineTo(Q[0], Q[1])
    }
    xa.closePath()
    xa.clip()
    xa.globalAlpha = dark ? 0.55 : 0.95
    xa.drawImage(pool, poolAt[0], poolAt[1], poolSize[0], poolSize[1])
    xa.restore()
    // shadows: every lit stake throws one away from the flame (fading toward its tip); unlit stakes throw none
    xa.fillStyle = col.umbra
    const sh = dark ? SH_DARK : SH_LIGHT
    for (const st of stakes) {
      const k = lit(st.a)
      if (k < 0.02) continue
      for (let i = 0; i < 3; i++) {
        xa.globalAlpha = k * sh[i]
        xa.fill(st.shadow[i])
      }
    }
    // far stakes and the back rope (their lamp-facing side is the one we see), then the near ones, the thorns, the gate
    paintStakes(xa, false, dark)
    paintStakes(xb, true, dark)
    xb.globalAlpha = dark ? 0.7 : 0.75
    xb.strokeStyle = dark ? col.culmHi : col.ink
    xb.lineWidth = 0.8
    xb.stroke(thorns)
    // barbs in the beam catch the light
    xb.fillStyle = dark ? col.moon : '#ffffff'
    for (const b of barbs) {
      const k = lit(b.a)
      if (k < 0.15) continue
      xb.globalAlpha = k * (dark ? 0.95 : 1)
      xb.fillRect(b.x - b.r * 0.5, b.y - b.r * 0.9, b.r * 0.9, b.r * 0.9)
    }
    xb.globalAlpha = 1
    xb.fillStyle = dark ? col.culm : col.ink
    xb.fill(door)
    // the beam in the air: a faint cone from the flame
    xb.globalAlpha = dark ? 0.07 : 0.14
    xb.fillStyle = dark ? col.moon : '#ffffff'
    xb.beginPath()
    projQ(0, HL, 0)
    xb.moveTo(Q[0], Q[1])
    projQ(Math.cos(gb - HALF * 0.6) * 2.4, HL * 0.3, Math.sin(gb - HALF * 0.6) * 2.4)
    xb.lineTo(Q[0], Q[1])
    projQ(Math.cos(gb + HALF * 0.6) * 2.4, HL * 0.3, Math.sin(gb + HALF * 0.6) * 2.4)
    xb.lineTo(Q[0], Q[1])
    xb.closePath()
    xb.fill()
    // the wall: where the beam's axis meets it, a pool of light; cracks only show inside it
    if (wallHit()) {
      const sx = HIT[0], sy = HIT[1]
      const rx = spotK * (low ? 1.0 : 1.3) * HIT[2], ry = rx * 0.75
      xw.globalAlpha = dark ? 0.5 : 0.9
      xw.drawImage(spot, sx - rx, sy - ry, rx * 2, ry * 2)
      xw.globalAlpha = 1
      xw.globalCompositeOperation = 'source-atop'
      xw.drawImage(crackCv, 0, 0, W, H)
      xw.globalCompositeOperation = 'source-over'
      for (let i = 0; i < crackAt.length; i++) {
        const [x, y] = crackAt[i]
        if (!revealed.has(i) && Math.abs(x - sx) < rx * 0.6 && Math.abs(y - sy) < ry * 1.4) reveal(i)
      }
    }
  }
  // the beam's axis on the wall line (ground plane) → HIT: screen point and perspective scale; false when it misses
  function wallHit(): boolean {
    const dx = Math.cos(beta), dz = Math.sin(beta)
    const ex = wallB[0] - wallA[0], ez = wallB[1] - wallA[1]
    const det = ex * dz - dx * ez // O + u·d = A + t·e
    if (Math.abs(det) < 1e-6) return false
    const t = (dx * wallA[1] - dz * wallA[0]) / det // along the wall
    const u = (ex * wallA[1] - ez * wallA[0]) / det // along the beam
    if (u <= 0 || t < -0.05 || t > 1.05) return false
    const x = wallA[0] + ex * t, z = wallA[1] + ez * t
    projQ(x + 1, wallH * 0.45, z)
    const qx = Q[0], qy = Q[1]
    projQ(x, wallH * 0.45, z)
    HIT[0] = Q[0]
    HIT[1] = Q[1]
    HIT[2] = Math.hypot(qx - Q[0], qy - Q[1]) / spotK
    return true
  }

  // ── the story: gate → guards → lamp → cracks
  let latest: HTMLElement | null = null
  function put(el: HTMLElement, ...kids: HTMLElement[]) {
    el.replaceChildren(...kids)
    el.classList.add('on')
    latest?.classList.remove('latest')
    latest = el
    el.classList.add('latest') // a phone shows this one only
    if (!el.hasAttribute('aria-live')) el.setAttribute('aria-live', 'polite')
  }
  function knock() {
    knocked = true
    root.classList.remove('knock')
    void root.offsetWidth // restart the shake
    root.classList.add('knock', 'knocked')
    denied.classList.add('on')
    ctx.chime('soft')
    if (!seen.size) ctx.prompt(G.prompt)
  }
  function pick(i: number) {
    guards.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)))
    guards[i].classList.add('in')
    seen.add(i)
    put(slips[i], h('p', { class: 't30f-who' }, G.cases[i].name), ctx.fact(G.cases[i].fact as Fact, 'p'))
    if (seen.size === G.cases.length && !root.classList.contains('guarded')) {
      root.classList.add('guarded')
      ctx.prompt(G.lampHint)
    }
    ctx.chime('soft')
    void knocked
  }
  function reveal(i: number) {
    revealed.add(i)
    root.classList.add('found')
    if (revealed.size === 1) put(whySlip, h('p', { class: 't30-eyebrow' }, G.whyLabel), ctx.fact(G.why as Fact, 'p'))
    ctx.chime(revealed.size === CRACKS.length ? 'ok' : 'soft')
    if (revealed.size === CRACKS.length) {
      put(plaque, h('p', { class: 't30f-carved-label' }, G.debateLabel), ctx.fact(G.debate as Fact, 'p'))
      ctx.insight(G.insight as Fact, G.detail)
    }
  }

  // ── turning the lamp: drag round it (or ← →); one frame per move, nothing while still
  const loop = createLoop(root, () => {
    draw()
    return false
  }, { essential: true })
  ctx.onCleanup(() => loop.dispose())
  const turnTo = (b: number) => {
    beta = ((b % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
    lamp.setAttribute('aria-valuenow', String(Math.round((beta * 180) / Math.PI)))
    lamp.setAttribute('aria-valuetext', `${Math.round((beta * 180) / Math.PI)}°`)
    root.classList.add('turned')
    loop.wake()
  }
  let drag: { id: number; ox: number; oy: number } | null = null
  root.addEventListener('pointerdown', (e) => {
    if (e.button || (e.target as Element).closest('button, .t30f-hang')) return
    const rc = root.getBoundingClientRect()
    const [lx, ly] = proj(0, 0, 0)
    drag = { id: e.pointerId, ox: rc.left + lx, oy: rc.top + ly }
    root.setPointerCapture(e.pointerId)
    aim(e)
  })
  // the pointer's direction from the lamp on screen → a direction on the ground (the ellipse unsquashed)
  const aim = (e: PointerEvent) => {
    if (!drag) return
    const sq = (proj(0, 0, 1)[1] - proj(0, 0, 0)[1]) / Math.max(1, proj(1, 0, 0)[0] - proj(0, 0, 0)[0])
    turnTo(Math.atan2((e.clientY - drag.oy) / Math.max(0.05, sq), e.clientX - drag.ox))
  }
  root.addEventListener('pointermove', (e) => drag && e.pointerId === drag.id && aim(e))
  const end = (e: PointerEvent) => {
    if (drag && e.pointerId === drag.id) drag = null
  }
  root.addEventListener('pointerup', end)
  root.addEventListener('pointercancel', end)
  lamp.addEventListener('keydown', (e) => {
    const k = { ArrowRight: -1, ArrowUp: -1, ArrowLeft: 1, ArrowDown: 1 }[e.key]
    if (!k) return
    e.preventDefault()
    turnTo(beta + (k * Math.PI) / 18)
  })
  gate.addEventListener('click', knock)
  ctx.onCleanup(onDigit((d) => d <= G.cases.length && pick(d - 1)))

  // ── first paint soaks in; resizes and theme changes redraw in one go
  let first = true
  let job: { cancel(): void } | null = null
  ctx.onCleanup(onPrefs(() => {
    const c = readCol()
    if (c.umbra === col.umbra && c.moon === col.moon && c.dark === col.dark) return
    col = c
    if (W) (buildGeo(), draw())
  }))
  ctx.onCleanup(onSize(ctx.art, () => {
    job?.cancel()
    job = sliced(build(), { sync: ctx.reduced || !first })
    first = false
  }))
  ctx.onCleanup(() => job?.cancel())
}

/** '#rrggbb' / '#rgb' → rgba() with alpha (other colour strings pass through). */
function rgba(c: string, a: number): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c.trim())
  if (!m) return c
  const x = m[1].length === 3 ? m[1].split('').map((d) => d + d).join('') : m[1]
  return `rgba(${parseInt(x.slice(0, 2), 16)},${parseInt(x.slice(2, 4), 16)},${parseInt(x.slice(4, 6), 16)},${a})`
}

/** A city guard: conical hat, a spear (it swings across when the gate is pushed), a warm lantern with a vermilion seal. */
function guardArt(seed: number, dir: 1 | -1): SVGSVGElement {
  return s('svg', { class: 't30f-guard-art', viewBox: '-26 -52 52 54', 'aria-hidden': 'true' },
    s('circle', { class: 't30f-glow', cx: f1(10 * dir), cy: -22, r: 15, fill: 'url(#p2-lamp)' }),
    s('ellipse', { class: 't30-contact', cx: 2, cy: 1, rx: 12, ry: 2.4 }),
    s('path', { class: 't30-figure', d: figure(-2 * dir, 0, 40, seed, dir, { hat: 'cone', stoop: 0.05 }) }),
    s('g', { class: 't30f-spear', style: `transform-origin:${-8 * dir}px 0px;--dir:${dir}` },
      s('path', { class: 't30-figure', d: stroke([[-9 * dir, 2], [-8 * dir, -46]], 1.4, 0.05, 0.05, 0.6) + `M${-9.6 * dir} -46L${-8 * dir} -51L${-6.4 * dir} -46Z` })),
    s('path', { class: 't30f-cord', d: `M${9 * dir} -31V-28` }),
    s('ellipse', { class: 't30f-lamp-body', cx: f1(9.2 * dir), cy: -23.5, rx: 4.6, ry: 5.6 }),
    s('circle', { class: 't30f-seal', cx: f1(9.2 * dir), cy: -23.5, r: 1.9 }),
    s('path', { class: 't30f-cap', d: `M${f1(6.5 * dir - (dir < 0 ? 5.4 : 0))} -29.6h5.4v1.2h-5.4zM${f1(6.5 * dir - (dir < 0 ? 5.4 : 0))} -18.6h5.4v1.2h-5.4z` }),
    s('path', { class: 't30f-grass', d: blob(0, 0, 1, 1, seed, 0, 4) }))
}
