import { h, nextId, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { drawIn, lerp } from '../t03/brush'
import { appIcon, boulder, brush, clamp, f1, fitRings, horizon, lantern, litDefs, Pen, placed, plugShape, portStone, rng, sand, type Pt, type Ring } from './art'
import { C } from './data'
import type { AppId } from './data'

const T = C.scenes.tangle
const APPS: AppId[] = ['drive', 'gmail', 'slack', 'figma', 'db']
// three different lanterns = three different AI assistants: [x, base y, scale, tall, roof]
// three different lanterns = three different AI assistants: [x, base y, scale, tall, roof].
// Wide: the nearest stands lowest and farthest left, so every cord runs under the lanterns to its right.
const L_WIDE: [number, number, number, number, number][] = [[0.075, 0.95, 1, 0.82, 1.08], [0.205, 0.8, 0.76, 1, 1], [0.33, 0.5, 0.58, 0.62, 1.2]]
const L_TALL: [number, number, number, number, number][] = [[0.15, 0.41, 0.88, 1, 1], [0.5, 0.29, 0.64, 0.62, 1.2], [0.84, 0.47, 0.98, 0.82, 1.08]]
// wide: the apps fan out from the MCP stone, each on its own ray, so no cable passes another stone: [angle°, reach, size]
const P_FAN: [number, number, number][] = [[-48, 1, 0.82], [-20, 0.64, 0.9], [6, 1.06, 0.92], [30, 0.7, 1], [54, 0.98, 0.94]]
const P_TALL: [number, number, number][] = [[0.12, 0.76, 0.86], [0.33, 0.9, 0.96], [0.53, 0.75, 0.8], [0.74, 0.89, 0.9], [0.9, 0.72, 0.78]]

/** Scene 2 — before: every assistant needs its own custom cable to every app; after: one shared standard. */
export function tangleScene(ctx: SceneCtx) {
  const sandSvg = s('svg', { class: 't16-svg t16-sandsvg', 'aria-hidden': 'true' })
  const svg = s('svg', { class: 't16-svg', role: 'img', 'aria-label': T.art })
  const bBefore = h('button', { class: 't16t-opt', type: 'button', 'aria-pressed': 'true', onClick: () => set(false) }, T.before)
  const bAfter = h('button', { class: 't16t-opt', type: 'button', 'aria-pressed': 'false', onClick: () => set(true) }, T.after)
  const count = h('p', { class: 't16t-count', 'aria-live': 'polite' }, T.countBefore)
  const ctl = h('div', { class: 't16t-ctl' }, h('div', { class: 't16t-seg', role: 'group', 'aria-label': T.group }, bBefore, bAfter), count)
  const labAi = h('span', { class: 't16t-lab', 'aria-hidden': 'true' }, T.ais)
  const labApps = h('span', { class: 't16t-lab', 'aria-hidden': 'true' }, T.apps)
  const mcpLab = h('span', { class: 't16t-mcp', 'aria-hidden': 'true' }, T.mcp)
  const root = h('div', { class: 't16 t16t' }, sandSvg, svg, labAi, labApps, mcpLab, ctl)
  ctx.art.append(root)
  ctx.prompt(T.prompt)

  const gid = nextId('t16t')
  let after = false
  let told = false
  let tangleG: SVGGElement | null = null
  let neat: { pen: Pen; plugs: SVGGElement; mcp: SVGGElement } | null = null
  let tl: ReturnType<typeof gsap.timeline> | null = null
  let lits: SVGGElement[] = []

  function layout() {
    const W = root.clientWidth
    const H = root.clientHeight
    if (!W || !H) return
    tl?.kill()
    const wide = W / H > 1.1
    const short = wide && H < 330
    root.classList.toggle('wide', wide)
    root.classList.toggle('short', short)
    const ctlH = ctl.offsetHeight + 8
    // y inside the band below the control (tall and short screens) or the whole scene
    const Y = (fy: number) => (wide && !short ? fy * H : ctlH + fy * (H - ctlH))
    svg.replaceChildren()
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
    svg.append(s('defs', null, litDefs()))

    // where things stand
    const L0 = short ? (H - ctlH) * 0.62 : wide ? Math.min(H * 0.6, W * 0.2) : Math.min((H - ctlH) * 0.3, W * 0.3)
    const lamps = (wide ? L_WIDE : L_TALL).map(([fx, fy, sc, tall, roof]) => ({ x: fx * W, y: Y(fy), k: (L0 * sc) / 232, tall, roof }))
    const r0 = wide ? Math.min(W * 0.042, H * 0.085) : Math.min(W * 0.075, H * 0.052)
    const mw = clamp(Math.min(W, H) * 0.2, 54, 120)
    const mc: Pt = wide ? [W * 0.5, short ? Y(0.6) : H * 0.6] : [W * 0.5, H * 0.585]
    const hy = wide ? (short ? Y(0.08) : H * 0.24) : ctlH + (H - ctlH) * 0.1
    const peb = wide
      ? P_FAN.map(([a, f, sz]) => {
          const t = (a * Math.PI) / 180
          const y = mc[1] + Math.sin(t) * (short ? (H - ctlH) * 0.5 : H * 0.42) * f
          // nearer (lower) stones are a little bigger
          return { x: mc[0] + mw * 0.5 + Math.cos(t) * (W * 0.42 - mw * 0.5) * f, y, r: r0 * (short ? 0.8 : 1) * sz * (0.8 + 0.34 * clamp((y - hy) / (H - hy), 0, 1)) }
        })
      : P_TALL.map(([fx, fy, sz]) => ({ x: fx * W, y: fy * H, r: r0 * sz }))
    // cable ends: the right foot of each lantern, the near rim of each pebble, the two faces of the MCP stone
    const lampEnd = (q: (typeof lamps)[number]): Pt => (wide ? [q.x + 40 * q.k, q.y - 10 * q.k] : [q.x + 12 * q.k, q.y + 4])
    const pebEnd = (q: (typeof peb)[number]): Pt => {
      if (!wide) return [q.x, q.y - q.r * 0.82]
      const a = Math.atan2(q.y - mc[1], q.x - mc[0])
      return [q.x - Math.cos(a) * q.r * 1.02, q.y - Math.sin(a) * q.r * 0.62]
    }
    const mcpIn: Pt = wide ? [mc[0] - mw * 0.5, mc[1]] : [mc[0], mc[1] - mw * 0.3]
    const mcpOut: Pt = wide ? [mc[0] + mw * 0.52, mc[1]] : [mc[0], mc[1] + mw * 0.22]

    const rings: Ring[] = fitRings([
      ...lamps.map((q) => ({ x: q.x, y: q.y + 2, r: 56 * q.k, n: 3 })),
      ...peb.map((q) => ({ x: q.x + q.r * 0.1, y: q.y + q.r * 0.42, r: q.r * 1.25, n: 2 })),
      { x: mc[0], y: mc[1] + mw * 0.2, r: mw * 0.62, n: 3 },
    ], 7)
    sandSvg.setAttribute('viewBox', `0 0 ${W} ${H}`)
    sandSvg.replaceChildren(horizon(`${gid}-h`, W, H, hy), sand(`${gid}-s`, W, H, hy + 6, rings, 7))

    // ── before: fifteen hand-made cables, each with its own connector, knotted in the middle ──
    const rr = rng(31)
    tangleG = s('g', { class: 't16t-tangle', filter: 'url(#ink-rough)' })
    const knot: Pt = wide ? [W * 0.5, H * 0.5] : [W * 0.5, H * 0.6]
    const spread: Pt = wide ? [W * 0.12, H * 0.2] : [W * 0.25, H * 0.09]
    const tones = ['k', 'k2', 'k3']
    lamps.forEach((lq, i) => {
      const A = lampEnd(lq)
      peb.forEach((pq, j) => {
        const B = pebEnd(pq)
        const m1: Pt = [knot[0] + (rr() - 0.5) * spread[0] * 2, knot[1] + (rr() - 0.5) * spread[1] * 2]
        const m2: Pt = [knot[0] + (rr() - 0.5) * spread[0] * 2, knot[1] + (rr() - 0.5) * spread[1] * 2]
        const pts: Pt[] = [A, [A[0] + (wide ? 24 : 0) + (rr() - 0.5) * 20, A[1] + (wide ? 0 : 20) + (rr() - 0.5) * 16], m1]
        if (rr() < 0.42) {
          // a loop: the cable doubles back on itself
          const lr = 6 + rr() * 10
          const a0 = rr() * Math.PI * 2
          for (let k = 1; k <= 7; k++) pts.push([m1[0] + Math.cos(a0 + k * 0.9) * lr, m1[1] + Math.sin(a0 + k * 0.9) * lr * 0.8])
        }
        pts.push(m2, [B[0] - (wide ? 26 : 0) + (rr() - 0.5) * 18, B[1] - (wide ? 0 : 22) + (rr() - 0.5) * 12], B)
        const cable = s('g', { class: tones[i] }, s('path', { d: brush(pts, 1.6 + rr() * 1.1, { a: 0.04, b: 0.06, min: 0.6, wob: 0.2 }).d }))
        tangleG!.append(cable)
        // each pairing needs its own adapter shape at the app end
        const ang = Math.atan2(B[1] - pts[pts.length - 2][1], B[0] - pts[pts.length - 2][0])
        const g = s('g', { transform: `translate(${f1(B[0] - Math.cos(ang) * 7)} ${f1(B[1] - Math.sin(ang) * 7)}) rotate(${f1((ang * 180) / Math.PI)})` })
        cable.append(g)
        const sz = 4.5
        g.append(s('path', { d: [`M${-sz} ${-sz}h${sz * 2}v${sz * 2}h${-sz * 2}Z`, `M${-sz} ${-sz}L${sz * 1.3} 0L${-sz} ${sz}Z`, `M0 ${-sz}a${sz} ${sz} 0 1 0 0.01 0Z`][i] }))
        if ((i + j) % 2) g.append(s('path', { d: `M${-sz - 7} -2h6v4h-6Z` }))
      })
    })

    // ── after: one MCP stone; every assistant and every app needs just one cable to it ──
    const mcpG = s('g', { class: 't16t-mcpstone' })
    const mp = placed(mc[0], mc[1], 1)
    portStone(mp, mw)
    mcpG.append(mp.root)
    // tall screens: cables leave from top and bottom, so the stone carries its own name
    if (!wide) mcpG.append(s('text', { class: 't16k-carve', x: f1(mc[0]), y: f1(mc[1] - mw * 0.13), 'font-size': f1(mw * 0.17), 'text-anchor': 'middle' }, T.mcp))
    const np = new Pen(true, ctx.quality === 'low' ? 'root' : 'full')
    const plugs = s('g', { class: 't16t-plugs', filter: 'url(#ink-rough)' })
    const curve = (a: Pt, b: Pt): Pt[] => {
      const d: Pt = [b[0] - a[0], b[1] - a[1]]
      return wide
        ? [a, [a[0] + d[0] * 0.35, a[1] + d[1] * 0.1], [a[0] + d[0] * 0.7, a[1] + d[1] * 0.85], b]
        : [a, [a[0] + d[0] * 0.1, a[1] + d[1] * 0.35], [a[0] + d[0] * 0.85, a[1] + d[1] * 0.7], b]
    }
    // an app cable leaves the stone's face, then turns onto the app's own ray
    const ray = (a: Pt, b: Pt): Pt[] => {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1])
      const t = Math.atan2(b[1] - mc[1], b[0] - mc[0])
      return [a, [a[0] + L * 0.22, a[1] + (b[1] - a[1]) * 0.08], [b[0] - Math.cos(t) * L * 0.36, b[1] - Math.sin(t) * L * 0.36], b]
    }
    const spreadIn = (k: number, n: number): Pt => (wide ? [mcpIn[0], mcpIn[1] + (k - (n - 1) / 2) * mw * 0.06] : [mcpIn[0] + (k - (n - 1) / 2) * mw * 0.08, mcpIn[1]])
    const spreadOut = (k: number, n: number): Pt => (wide ? [mcpOut[0], mcpOut[1] + (k - (n - 1) / 2) * mw * 0.06] : [mcpOut[0] + (k - (n - 1) / 2) * mw * 0.08, mcpOut[1]])
    const pill = (at: Pt, toward: Pt) => {
      const g = plugShape(clamp(mw / 90, 0.7, 1.2))
      const ang = Math.atan2(toward[1] - at[1], toward[0] - at[0])
      g.setAttribute('transform', `translate(${f1(at[0])} ${f1(at[1])}) rotate(${f1((ang * 180) / Math.PI)})`)
      plugs.append(g)
    }
    lamps.forEach((lq, i) => {
      const a = lampEnd(lq)
      const b = spreadIn(i, lamps.length)
      const pts = curve(a, b)
      np.line(pts, 2.1, { a: 0.05, b: 0.05, min: 0.7, wob: 0.06, cls: 'k2' })
      pill(lerp(a, pts[1], 0.12), a)
    })
    peb.forEach((pq, j) => {
      const a = spreadOut(j, peb.length)
      const b = pebEnd(pq)
      const pts = wide ? ray(a, b) : curve(a, b)
      np.line(pts, 2.1, { a: 0.05, b: 0.05, min: 0.7, wob: 0.06, cls: 'k2' })
      pill(lerp(b, pts[2], 0.12), b)
    })
    // lanterns and pebbles over the cables
    const things = s('g')
    lits = []
    for (const [i, q] of lamps.entries()) {
      const lp = placed(q.x, q.y, q.k, ctx.quality === 'low' ? 'root' : 'full')
      const lm = lantern(lp, { tall: q.tall, roof: q.roof, moss: i + 2 })
      lits.push(lm.lit)
      things.append(lp.root)
    }
    for (const [j, q] of peb.entries()) {
      const pp = placed(q.x, q.y, 1, ctx.quality === 'low' ? 'root' : 'full')
      boulder(pp, q.r, 40 + j * 7)
      pp.sub(`translate(${f1(q.r * 0.04)} ${f1(-q.r * 0.08)}) scale(${(q.r / 34).toFixed(3)})`)
      appIcon(pp, APPS[j], 2.4)
      pp.back()
      things.append(pp.root)
    }
    // the pen's reveal masks were sized for small vignettes: open them to the whole scene
    np.root.querySelectorAll('mask').forEach((m) => {
      m.setAttribute('x', '-40')
      m.setAttribute('y', '-40')
      m.setAttribute('width', String(W + 80))
      m.setAttribute('height', String(H + 80))
    })
    svg.append(mcpG, tangleG, np.root, plugs, things)
    neat = { pen: np, plugs, mcp: mcpG }
    paint(false)

    // words
    const lb = lamps.reduce((m, q) => Math.max(m, q.y), 0)
    const pb = peb.reduce((m, q) => Math.max(m, q.y + q.r * 0.5), 0)
    if (wide) {
      Object.assign(labAi.style, { left: `${W * 0.2}px`, top: `${Math.min(H - 22, lb + 10)}px`, display: '' })
      Object.assign(labApps.style, { left: `${W * 0.93}px`, top: `${Math.min(H - 22, pb + 10)}px`, display: '' })
    } else {
      Object.assign(labAi.style, { display: 'none' })
      Object.assign(labApps.style, { display: 'none' })
    }
    // the stone's name sits where no cable runs: under it on wide screens (carved on it on tall ones)
    Object.assign(mcpLab.style, { left: `${mc[0]}px`, top: `${mc[1] + mw * 0.3 + 4}px`, display: wide ? '' : 'none' })
  }

  /** Show the current state; animate the change when `anim`. */
  function paint(anim: boolean) {
    if (!tangleG || !neat) return
    const { pen, plugs, mcp } = neat
    const twist = [...tangleG.querySelectorAll<SVGElement>(':scope > g')]
    if (!anim || ctx.reduced) {
      tl?.progress(1)
      gsap.set(tangleG, { opacity: after ? 0 : 1 })
      gsap.set(lits, { opacity: after ? 0.9 : 0 })
      gsap.set([mcp, plugs, ...pen.fades], { opacity: after ? 1 : 0 })
      gsap.set(pen.draws.map((d) => d.m), { strokeDashoffset: after ? 0 : 1 })
      mcpLab.classList.toggle('on', after)
      return
    }
    ctx.anim(() => {
      tl?.kill()
      tl = gsap.timeline()
      if (after) {
        // the knot loosens and sinks into the sand; the stone rises; clean cords brush in
        tl.to(tangleG, { opacity: 0, duration: 0.9, ease: 'power2.in' }, 0)
        tl.fromTo(twist, { opacity: 1 }, { opacity: 0, duration: 0.5, stagger: { each: 0.02, from: 'random' } }, 0)
        tl.fromTo(mcp, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 1, ease: 'power3.out' }, 0.5)
        tl.set(pen.fades, { opacity: 1 }, 0.9)
        drawIn(pen, tl, 1.4, 0.9)
        tl.fromTo(plugs, { opacity: 0 }, { opacity: 1, duration: 0.6 }, 1.6)
        tl.call(() => mcpLab.classList.add('on'), [], 1.2)
        tl.fromTo(lits, { opacity: 0 }, { opacity: 0.9, duration: 0.8, stagger: 0.25 }, 2)
      } else {
        mcpLab.classList.remove('on')
        tl.to(lits, { opacity: 0, duration: 0.5 }, 0)
        tl.to([plugs, ...pen.fades], { opacity: 0, duration: 0.5 }, 0)
        tl.to(pen.draws.map((d) => d.m), { strokeDashoffset: 1, duration: 0.6, ease: 'power2.in' }, 0)
        tl.to(mcp, { opacity: 0, y: 8, duration: 0.6 }, 0.2)
        tl.set(tangleG, { opacity: 1 }, 0.5)
        tl.fromTo(twist, { opacity: 0 }, { opacity: 1, duration: 0.5, stagger: { each: 0.03, from: 'random' } }, 0.5)
      }
    })
  }

  function set(v: boolean) {
    if (v === after) return
    after = v
    bBefore.setAttribute('aria-pressed', String(!v))
    bAfter.setAttribute('aria-pressed', String(v))
    count.textContent = v ? T.countAfter : T.countBefore
    paint(true)
    ctx.chime(v ? 'ok' : 'soft')
    if (v && !told) {
      told = true
      ctx.insight(T.insight, T.detail)
    }
  }

  let rraf = 0
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(rraf)
    rraf = requestAnimationFrame(layout)
  })
  ro.observe(root)
  layout()
  return () => {
    ro.disconnect()
    cancelAnimationFrame(rraf)
    tl?.kill()
  }
}
