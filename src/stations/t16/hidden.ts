import { h, nextId, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { arc, boulder, clamp, ell, f1, fitRings, hit, lantern, litDefs, Pen, placed, poly, rng, rrD, rrPts, sand, S, textW, type Box, type Lantern, type Pt, type Ring } from './art'
import { C } from './data'

const T = C.scenes.hidden
/** how far above the centre of its light the hand lantern's top hangs */
const LIFT = 93

const grow = (b: Box, p: number): Box => ({ x: b.x - p, y: b.y - p, w: b.w + 2 * p, h: b.h + 2 * p })
const dots = (pts: Pt[], r = 5): Box[] => pts.map(([x, y]) => ({ x: x - r, y: y - r, w: 2 * r, h: 2 * r }))


/** A sheet of washi: deckled edges (small nicks and soft bulges), as one path — no live filter. */
function washi(x: number, y: number, w: number, hh: number, seed: number) {
  const r = rng(seed)
  const pts: Pt[] = []
  const edge = (x0: number, y0: number, x1: number, y1: number, nx: number, ny: number) => {
    const n = Math.max(4, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 5))
    for (let i = 0; i < n; i++) {
      const t = i / n
      const j = (r() - 0.5) * 1.5 - (r() < 0.1 ? r() * 2.6 : 0)
      pts.push([x0 + (x1 - x0) * t + nx * j, y0 + (y1 - y0) * t + ny * j])
    }
  }
  edge(x, y, x + w, y, 0, -1)
  edge(x + w, y, x + w, y + hh, 1, 0)
  edge(x + w, y + hh, x, y + hh, 0, 1)
  edge(x, y + hh, x, y, -1, 0)
  return poly(pts)
}

/** Short paper fibres scattered over the sheet, as one path. */
function fibres(x: number, y: number, w: number, hh: number, seed: number) {
  const r = rng(seed)
  let d = ''
  const n = Math.round((w * hh) / 900)
  for (let i = 0; i < n; i++) {
    const px = x + 6 + r() * (w - 12)
    const py = y + 6 + r() * (hh - 12)
    const a = r() * Math.PI
    const L = 5 + r() * 14
    const qx = px + Math.cos(a) * L * 0.5 + (r() - 0.5) * 5
    const qy = py + Math.sin(a) * L * 0.5 + (r() - 0.5) * 5
    d += `M${f1(px)} ${f1(py)}Q${f1(qx)} ${f1(qy)} ${f1(px + Math.cos(a) * L)} ${f1(py + Math.sin(a) * L)}`
  }
  return d
}

/** A paper lantern (chōchin) for the visitor's hand. 60 × 90 view box, light centre at 30,50. */
function handLantern() {
  const ribs = [-14, -7, 0, 7, 14].map((dy) => s('path', { class: 't16h-rib', d: `M${30 - Math.sqrt(1 - (dy / 26) ** 2) * 21} ${50 + dy}Q30 ${50 + dy + 3} ${30 + Math.sqrt(1 - (dy / 26) ** 2) * 21} ${50 + dy}` }))
  return s('svg', { class: 't16h-chochin', viewBox: '0 0 60 90', 'aria-hidden': 'true' },
    s('path', { class: 't16h-handle', d: 'M30 4V18' }),
    s('path', { class: 't16h-handle', d: 'M18 4H42' }),
    s('ellipse', { class: 't16h-cpaper', cx: 30, cy: 50, rx: 22, ry: 27 }),
    s('ellipse', { class: 't16h-core', cx: 30, cy: 52, rx: 9, ry: 12 }),
    ...ribs,
    s('path', { class: 't16h-ccap', d: rrD(19, 19, 22, 7, 2) }),
    s('path', { class: 't16h-ccap', d: rrD(19, 74, 22, 7, 2) }))
}

/** Scene 4 — a polite letter hides a line of white ink; the lantern shows what the agent reads. Then three good habits. */
export function hiddenScene(ctx: SceneCtx) {
  const lines = T.letter
  // the hidden line stays in the text (screen readers and the agent both read it); only the lit ink shows it
  const secretBase = h('p', { class: 'sec-base' }, T.secret)
  const secretInk = h('p', { class: 'sec-ink', 'aria-hidden': 'true' }, T.secret)
  const secret = h('div', { class: 't16h-secret' }, secretBase, secretInk)
  const letter = h('div', { class: 't16h-letter' },
    h('p', { class: 'l-hi' }, lines[0]),
    h('p', null, lines[1]),
    h('p', null, lines[2]),
    secret,
    h('p', { class: 'l-sign' }, lines[3]))
  const sandSvg = s('svg', { class: 't16-svg t16h-sand', 'aria-hidden': 'true' })
  const paper = s('svg', { class: 't16-svg t16h-paper', 'aria-hidden': 'true' })
  const stage = s('svg', { class: 't16-svg t16h-stage', 'aria-hidden': 'true' })
  const light = h('div', { class: 't16h-light', 'aria-hidden': 'true' })
  const agentLab = h('span', { class: 't16h-agentlab', 'aria-hidden': 'true' }, T.agent)
  const cap = h('p', { class: 't16h-cap', 'aria-live': 'polite' })
  const habits = T.habits.map((hb, i) =>
    h('button', { class: 't16h-habit', type: 'button', 'aria-pressed': 'false', hidden: true, onClick: () => habit(i) }, h('span', { class: 't16h-hname' }, hb.name)))
  const habitRow = h('div', { class: 't16h-habits', role: 'group', 'aria-label': T.habitsLabel }, ...habits)
  const lamp = h('button', { class: 't16h-lamp', type: 'button', 'aria-label': T.lantern }, handLantern())
  const root = h('div', { class: 't16 t16h' }, sandSvg, paper, light, letter, stage, agentLab, cap, habitRow, lamp)
  ctx.art.append(root)
  ctx.prompt(T.prompt)

  const gid = nextId('t16h')
  let W = 0
  let H = 0
  let R = 80
  let LR = 130
  const pos = { x: 0, y: 0 }
  // until the visitor moves the lantern, it is placed afresh on every layout (fonts and the foot change the box)
  let touched = false
  let found = false
  let parkPending = false
  let agent: Lantern | null = null
  const done = new Set<number>()
  const visited = new Set<number>()
  let samples: Pt[] = []
  let sec: Pt = [0, 0]
  let rest: Pt = [0, 0]
  let rr = { left: 0, top: 0 }
  let flick: ReturnType<typeof gsap.to> | null = null
  let sweepTl: ReturnType<typeof gsap.timeline> | null = null
  // the plane: where it is on its flight path (0 = at the lantern) and how solid it is
  const pl = { u: 0, o: 0 }
  let plTw: ReturnType<typeof gsap.to> | null = null
  let fly = { a: [0, 0] as Pt, c: [0, 0] as Pt, b: [0, 0] as Pt }
  let el: {
    plane: SVGGElement; flyPath: SVGPathElement; evil: SVGPathElement; seal: SVGGElement; held: SVGTextElement | null
    enso: SVGPathElement | null; ensoPen: Pen; ign: SVGTextElement | null; tags: SVGGElement[]; tagRest: string[]
    stones: SVGGElement[]; icons: SVGGElement[]; marks: SVGPathElement[]
  } | null = null

  // ── the light: only writes here (rects are cached in layout), so moving it never forces a layout ──
  function setLight() {
    // the lantern hangs just above its pool of light, so it never hides the words it reveals
    lamp.style.transform = `translate(${f1(pos.x - 27)}px, ${f1(pos.y - LIFT)}px)`
    light.style.transform = `translate(${f1(pos.x - LR)}px, ${f1(pos.y - LR)}px)`
    secretInk.style.setProperty('--mx', `${f1(pos.x - sec[0])}px`)
    secretInk.style.setProperty('--my', `${f1(pos.y - sec[1])}px`)
    if (found || !samples.length) return
    samples.forEach(([x, y], i) => {
      if (Math.hypot(x - pos.x, y - pos.y) < R * 0.72) visited.add(i)
    })
    if (visited.size / samples.length >= 0.5) reveal()
  }

  const bez = (u: number): Pt => {
    const { a, c, b } = fly
    const v = 1 - u
    return [v * v * a[0] + 2 * v * u * c[0] + u * u * b[0], v * v * a[1] + 2 * v * u * c[1] + u * u * b[1]]
  }
  function placePlane() {
    if (!el) return
    const p = bez(pl.u)
    const q = bez(Math.min(1, pl.u + 0.02))
    const ang = (Math.atan2(q[1] - p[1], q[0] - p[0]) * 180) / Math.PI
    el.plane.setAttribute('transform', `translate(${f1(p[0])} ${f1(p[1])}) rotate(${f1(ang)}) scale(${(clamp(W / 900, 0.7, 1.15)).toFixed(3)})`)
    el.plane.setAttribute('opacity', pl.o.toFixed(3))
    el.flyPath.setAttribute('opacity', (pl.o * 0.55).toFixed(3))
  }
  /** Where the plane should be for what has happened so far. */
  const planeTarget = () => (!found || done.size === 3 ? { u: 0, o: 0 } : { u: done.has(1) ? 0.42 : 0.66, o: done.has(0) ? 0.32 : 1 })

  function layout() {
    W = root.clientWidth
    H = root.clientHeight
    if (!W || !H) return
    const wide = W / H > 1.1
    const short = wide && H < 330
    root.classList.toggle('wide', wide && !short)
    root.classList.toggle('short', short)
    root.classList.toggle('tall', !wide)
    R = clamp(Math.min(W, H) * 0.2, 54, 112)
    LR = R * 1.8
    root.style.setProperty('--R', `${f1(R)}px`)
    Object.assign(light.style, { width: `${f1(LR * 2)}px`, height: `${f1(LR * 2)}px` })

    // ── band 1: the letter ──
    const lw = short ? W * 0.4 : wide ? Math.min(W * 0.46, 540) : Math.min(W, 520)
    const fs = short ? clamp(Math.min(lw / 25, H / 15.5), 11, 15) : wide ? clamp(Math.min(lw / 27, H / 26), 12.5, 19) : clamp(Math.min(lw / 25, H / 36), 12, 17)
    const lx = short ? 2 : wide ? W * 0.04 : (W - lw) / 2
    const ly = short ? 4 : wide ? H * 0.05 : 4
    Object.assign(letter.style, { left: `${f1(lx)}px`, top: `${f1(ly)}px`, width: `${f1(lw)}px`, fontSize: `${f1(fs)}px` })
    const lr: Box = { x: lx, y: ly, w: letter.offsetWidth, h: letter.offsetHeight }
    const lb = lr.y + lr.h
    sec = [lr.x + secret.offsetLeft, lr.y + secret.offsetTop]
    const sr: Box = { x: sec[0], y: sec[1], w: secret.offsetWidth, h: secret.offsetHeight }

    // the sheet itself, its shadow and the dusk around it; the envelope it came in (wide screens only)
    paper.setAttribute('viewBox', `0 0 ${W} ${H}`)
    const sheet = washi(lr.x, lr.y, lr.w, lr.h, 23)
    const rot = `rotate(-0.7 ${f1(lr.x + lr.w / 2)} ${f1(lr.y + lr.h / 2)})`
    paper.replaceChildren(
      s('defs', null, s('radialGradient', { id: `${gid}-dusk` }, s('stop', { offset: 0, class: 'dusk0' }), s('stop', { offset: 1, class: 'dusk1' }))),
      s('ellipse', { cx: f1(lr.x + lr.w / 2), cy: f1(lr.y + lr.h * 0.55), rx: f1(lr.w * 0.78), ry: f1(lr.h * 0.95), fill: `url(#${gid}-dusk)` }))
    if (wide && !short) {
      // tucked under the sheet's top-left corner
      const ew = clamp(lr.w * 0.26, 80, 130)
      const eh = ew * 0.62
      const ex = Math.max(16, lr.x - ew * 0.3)
      const ey = Math.max(16, lr.y - eh * 0.28)
      const env = new Pen(false, ctx.quality === 'low' ? 'none' : 'root')
      env.root.setAttribute('transform', `rotate(-9 ${f1(ex + ew / 2)} ${f1(ey + eh / 2)})`)
      env.wash(rrD(ex, ey, ew, eh, 3), 1, 'env')
      env.line(rrPts(ex, ey, ew, eh, 3), 1.6, { a: 0.05, b: 0.1, cls: 'k3' })
      env.line([[ex + 3, ey + 4], [ex + ew / 2, ey + eh * 0.56], [ex + ew - 3, ey + 4]], 1.4, { ...S, a: 0.1, b: 0.1, cls: 'k3' })
      paper.append(env.root)
    }
    paper.append(
      s('path', { class: 't16h-shadow', d: sheet, transform: `translate(4 6) ${rot}`, filter: ctx.quality === 'low' ? null : 'url(#ink-wash)' }),
      s('path', { class: 't16h-washi', d: sheet, transform: rot }),
      s('path', { class: 't16h-fib', d: fibres(lr.x, lr.y, lr.w, lr.h, 5), transform: rot }))

    // ── band 2: the agent on raked sand, its permission tags, the plane's way out ──
    const capFs = short ? 12.5 : wide ? clamp(H / 34, 14, 17) : 13.5
    const habR = short ? clamp(H * 0.075, 14, 20) : wide ? clamp(Math.min(lr.w * 0.06, H * 0.06), 20, 36) : clamp(W * 0.065, 19, 30)
    const labH = (short ? 11.5 : 13.5) * 1.3 + 6
    const capW = short ? W * 0.3 : wide ? lr.w : Math.min(W, 460)
    const capLines = Math.max(...[T.found, ...T.habits.map((x) => x.caption)].map((c) => Math.ceil(textW(c, capFs) / (capW * 0.9))))
    const capH = capLines * capFs * 1.45
    let ax: number
    let ay: number
    let LH: number
    let capBox: Box
    let habY: number
    let habX: number[]
    if (short) {
      LH = H * 0.74
      ax = Math.max(W * 0.47, lr.x + lr.w + (LH / 232) * 72 + 12)
      ay = H - 21
      capBox = { x: W * 0.69, y: 2, w: capW, h: capH }
      habY = H - labH - habR * 0.55
      habX = [0.74, 0.855, 0.965].map((f) => f * W - habR)
    } else if (wide) {
      ax = W * 0.64
      ay = H * 0.86
      LH = Math.min(H * 0.6, W * 0.26)
      capBox = { x: lr.x, y: lb + 16, w: capW, h: capH }
      habY = H - labH - habR * 0.6
      habX = [0.14, 0.46, 0.84].map((f) => lr.x + lr.w * f)
    } else {
      habY = H - labH - habR * 0.55
      habX = [0.17, 0.48, 0.83].map((f) => (W - Math.min(W, 460)) / 2 + Math.min(W, 460) * f)
      capBox = { x: (W - capW) / 2, y: habY - habR * 1.1 - 12 - capH, w: capW, h: capH }
      const top = lb + 10
      const bot = capBox.y - 8
      // room under the lantern for its name
      LH = clamp((bot - top - 20) * 0.94, 70, 210)
      ax = Math.max(W * 0.17, 72 * (LH / 232) + 4)
      ay = bot - 20
    }
    const k = LH / 232
    Object.assign(cap.style, { left: `${f1(capBox.x)}px`, top: `${f1(capBox.y)}px`, width: `${f1(capBox.w)}px`, fontSize: `${capFs}px` })

    // raked sand under the agent and the habit stones
    const habSz = [1, 0.8, 0.92]
    const habStagger = [0.1, -0.55, 0.25]
    const habs = habX.map((x, i) => ({ x, y: habY + habStagger[i] * habR, r: habR * habSz[i] }))
    const rings: Ring[] = fitRings([
      { x: ax, y: ay + 2, r: 56 * k, n: short ? 2 : 3 },
      ...habs.map((q) => ({ x: q.x + q.r * 0.1, y: q.y + q.r * 0.42, r: q.r * 1.25, n: 2 })),
    ], 7)
    const sandTop = short ? H * 0.4 : wide ? Math.max(lb + 10, H * 0.48) : lb + 18
    sandSvg.setAttribute('viewBox', `0 0 ${W} ${H}`)
    sandSvg.replaceChildren(sand(`${gid}-s`, W, H, sandTop, rings, 7))

    stage.setAttribute('viewBox', `0 0 ${W} ${H}`)
    stage.replaceChildren(s('defs', null, litDefs()))
    const fx = ctx.quality === 'low' ? 'root' : 'full'

    // the agent, a stone lantern that reads the letter for you
    const lp = placed(ax, ay, k, fx)
    agent = lantern(lp)
    const win: Pt = [ax, ay + agent.wy * k]
    const agentBox: Box = { x: ax - 72 * k, y: ay + agent.top * k, w: 144 * k, h: -agent.top * k + 22 }
    const agLabW = textW(T.agent, short ? 11.5 : 13.5) + 4
    const agLabX = clamp(ax, agLabW / 2 + 2, W - agLabW / 2 - 2)
    Object.assign(agentLab.style, { left: `${f1(agLabX)}px`, top: `${f1(ay + 4)}px` })
    const agentLabBox: Box = { x: agLabX - agLabW / 2, y: ay + 4, w: agLabW, h: 18 }

    // threads: the agent reads the whole letter (dotted); the hidden line reaches it too (vermilion, once seen)
    const winIn: Pt = wide ? [win[0] - 13 * k, win[1]] : [win[0] - 3 * k, win[1] - 12 * k]
    const readFrom: Pt = wide ? [lr.x + lr.w + 6, lr.y + lr.h * 0.3] : [Math.min(ax + 24 * k, lr.x + lr.w * 0.3), lb + 4]
    const evilFrom: Pt = wide ? [lr.x + lr.w + 6, sr.y + sr.h * 0.5] : [Math.min(ax + 6, sr.x + sr.w * 0.25), lb + 4]
    const cRead: Pt = wide ? [(readFrom[0] + winIn[0]) / 2, Math.min(readFrom[1], winIn[1]) - 24] : [readFrom[0] + 18, (readFrom[1] + winIn[1]) / 2]
    const cEvil: Pt = wide ? [(evilFrom[0] + winIn[0]) / 2, Math.max(evilFrom[1], winIn[1]) + 26] : [evilFrom[0] - 14, (evilFrom[1] + winIn[1]) / 2 + 6]
    const qd = (a: Pt, c: Pt, b: Pt) => `M${f1(a[0])} ${f1(a[1])}Q${f1(c[0])} ${f1(c[1])} ${f1(b[0])} ${f1(b[1])}`
    const qpts = (a: Pt, c: Pt, b: Pt, n = 16) => Array.from({ length: n + 1 }, (_, i) => {
      const u = i / n
      const v = 1 - u
      return [v * v * a[0] + 2 * v * u * c[0] + u * u * b[0], v * v * a[1] + 2 * v * u * c[1] + u * u * b[1]] as Pt
    })
    const read = s('path', { class: 't16h-read', d: qd(readFrom, cRead, winIn) })
    const evil = s('path', { class: 't16h-evil', pathLength: 1, d: qd(evilFrom, cEvil, winIn) })
    // the threads run into the window, over the stone
    stage.append(s('path', { class: 'sh', 'fill-opacity': 0.1, d: ell(ax + 4, ay + 2, 74 * k, 9 * k), filter: 'url(#ink-wash)' }), lp.root, read, evil)

    // permission tags: three wooden garden tags staked in the sand beside the agent
    const tfs = short ? 11 : wide ? clamp(H / 42, 12, 14.5) : 12
    const tw = T.tags.map((t) => textW(t, tfs) + tfs * 1.3)
    const tagX0 = ax + 66 * k + 8
    const room = (short ? W * 0.655 : wide ? W - 12 : W - 4) - tagX0
    const oneRow = tw.reduce((a, b) => a + b, 0) + 16 <= room
    const tagPos: Pt[] = []
    let cx = tagX0
    tw.forEach((w, i) => {
      if (oneRow) {
        tagPos.push([cx + w / 2, ay - [4, 10, 1][i]])
        cx += w + 8
      } else {
        const back = i < 2
        tagPos.push(back ? [tagX0 + (i === 0 ? tw[0] / 2 : tw[0] + 6 + tw[1] / 2), ay - tfs * 2.5 - (i ? 3 : 0)] : [tagX0 + tw[2] / 2 + Math.min(18, room - tw[2]), ay - 2])
      }
    })
    const th = tfs * 1.75
    const stake = th * 0.9
    const tags = T.tags.map((t, i) => {
      const [x, y] = tagPos[i]
      const w = tw[i]
      const g = s('g', { class: 't16h-tagg' })
      const pen = new Pen(false, ctx.quality === 'low' ? 'none' : 'root')
      const top = y - stake - th
      pen.line([[x, y + 1], [x + 0.6, y - stake - 2]], Math.max(2.2, tfs * 0.22), { ...S, a: 0.05, b: 0.05, cls: 'k2' })
      pen.wash(poly([[x - w / 2, top + th * 0.28], [x, top], [x + w / 2, top + th * 0.28], [x + w / 2, top + th], [x - w / 2, top + th]]), 1, 'plq')
      pen.line([[x - w / 2, top + th * 0.28], [x, top], [x + w / 2, top + th * 0.28], [x + w / 2, top + th], [x - w / 2, top + th], [x - w / 2, top + th * 0.28]], 1.3, { ...S, a: 0.02, b: 0.02, cls: 'k2' })
      pen.solid(ell(x, top + th * 0.2, 1.4), 'k2')
      g.append(pen.root, s('text', { class: 't16h-tagt', x: f1(x), y: f1(top + th * 0.78), 'text-anchor': 'middle', 'font-size': tfs }, t))
      const tilt = [-3, 2.5, -1.5][i]
      g.setAttribute('transform', `rotate(${tilt} ${f1(x)} ${f1(y)})`)
      g.dataset.x = f1(x).toString()
      g.dataset.y = f1(y).toString()
      return g
    })
    stage.append(...tags)
    const tagBox: Box = { x: tagX0 - 4, y: Math.min(...tagPos.map((p) => p[1])) - stake - th - 4, w: Math.max(...tagPos.map((p, i) => p[0] + tw[i] / 2)) - tagX0 + 8, h: 0 }
    tagBox.h = ay + 4 - tagBox.y

    // the habit stones: shared boulders, each with a sign carved in it (a key, a seal, an eye)
    const stones: SVGGElement[] = []
    const icons: SVGGElement[] = []
    const marks: SVGPathElement[] = []
    habs.forEach((q, i) => {
      const g = s('g', { class: 't16h-hab' })
      const mark = s('path', { class: 't16h-mark', d: ell(q.x + q.r * 0.1, q.y + q.r * 0.45, q.r * 1.55, q.r * 0.5) })
      const p = placed(q.x, q.y, 1, fx)
      boulder(p, q.r, 61 + i * 19, 1.12, 0.78)
      const ico = p.sub(`translate(${f1(q.r * 0.02)} ${f1(-q.r * 0.1)}) scale(${(q.r / 30).toFixed(3)})`)
      ico.classList.add('t16h-ico')
      const o = { a: 0.08, b: 0.2, cls: 'k2' }
      if (i === 0) {
        p.line(arc(-6, 0, 5.5, 5.5, 0, 360, 18), 2.2, o)
        p.line([[-0.5, 0], [13, 0]], 2.2, { ...S, ...o })
        p.line([[8, 0], [8, 5]], 2, { ...S, ...o })
        p.line([[12, 0], [12, 4]], 2, { ...S, ...o })
      } else if (i === 1) {
        p.line(rrPts(-8, -9, 16, 18, 2.5), 2.2, o)
        p.line([[-3, -4], [-3, 4]], 2.4, { ...S, ...o })
        p.line([[3, -4], [3, 4]], 2.4, { ...S, ...o })
      } else {
        p.line(arc(0, 0, 13, 7.5, 180, 360, 14), 2.2, o)
        p.line(arc(0, 0, 13, 7.5, 0, 180, 14), 2.2, o)
        p.solid(ell(0, 0, 3.6), 'k2')
      }
      p.back()
      g.append(mark, p.root)
      stones.push(g)
      icons.push(ico)
      marks.push(mark)
      stage.append(g)
      const bw = Math.max(64, q.r * 2.6, textW(T.habits[i].name, short ? 11.5 : 14) + 12)
      const top = q.y - q.r * 0.95
      Object.assign(habits[i].style, { left: `${f1(q.x - bw / 2)}px`, top: `${f1(top)}px`, width: `${f1(bw)}px`, height: `${f1(Math.min(H - top, q.r * 1.55 + labH))}px` })
    })
    const habBox: Box = { x: Math.min(...habs.map((q) => q.x - q.r * 1.4)), y: Math.min(...habs.map((q) => q.y - q.r)), w: 0, h: 0 }
    habBox.w = Math.max(...habs.map((q) => q.x + q.r * 1.4)) - habBox.x
    habBox.h = H - habBox.y

    // the plane's way out: up and to the right, into the empty sky (never across the letter)
    const flyA: Pt = [win[0] + 26 * k, win[1] - 6 * k]
    const flyB: Pt = short ? [W * 0.645, Math.max(16, H * 0.1)] : wide ? [Math.min(W - 34, ax + W * 0.3), Math.max(22, H * 0.09)] : [W - 26, lb + 22]
    const flyC: Pt = [flyA[0] + (flyB[0] - flyA[0]) * 0.62, flyA[1] - (flyA[1] - flyB[1]) * 0.08]
    fly = { a: flyA, c: flyC, b: flyB }
    const flyPath = s('path', { class: 't16h-fly', d: qd(flyA, flyC, flyB), opacity: 0 })
    const plane = s('g', { class: 't16h-plane', opacity: 0 },
      s('path', { class: 'cd', d: 'M-16 -6L16 0L-12 7Z' }),
      s('path', { class: 'st3', d: 'M-12 7L16 0L-5 1.5Z' }),
      s('path', { class: 't16h-pl', d: 'M-16 -6L16 0L-12 7ZM-5 1.5L16 0' }))
    // the seal that holds it until you approve: a square vermilion hanko
    const sp = bez(0.55)
    const ss = clamp(W / 40, 18, 28)
    const sealPen = new Pen(false, ctx.quality === 'low' ? 'none' : 'full')
    const sr2 = rng(3)
    const sq: Pt[] = []
    for (const [x0, y0, x1, y1] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) for (let t = 0; t < 1; t += 0.125) sq.push([(x0 + (x1 - x0) * t) * ss * 0.5 + (sr2() - 0.5) * 1.2, (y0 + (y1 - y0) * t) * ss * 0.5 + (sr2() - 0.5) * 1.2])
    sealPen.solid(poly(sq), 'v')
    sealPen.solid(rrD(-ss * 0.2, -ss * 0.26, ss * 0.12, ss * 0.52, 1), 'cd')
    sealPen.solid(rrD(ss * 0.08, -ss * 0.26, ss * 0.12, ss * 0.52, 1), 'cd')
    // gsap animates the inner group only; the outer one holds the place on the path
    const seal = s('g', { class: 't16h-seal', opacity: 0 }, sealPen.root)
    stage.append(flyPath, plane, s('g', { transform: `translate(${f1(sp[0])} ${f1(sp[1])}) rotate(-6)` }, seal))

    // ── notes, placed only where they collide with nothing ──
    const flyBoxes = dots(qpts(flyA, flyC, flyB, 20), 6)
    const occupied: Box[] = [grow(lr, 6), capBox, agentBox, agentLabBox, tagBox, habBox, ...flyBoxes, ...dots(qpts(evilFrom, cEvil, winIn), 4), ...dots(qpts(readFrom, cRead, winIn), 4)]
    const inside = (b: Box) => b.x >= 2 && b.y >= 2 && b.x + b.w <= W - 2 && b.y + b.h <= H - 2
    const place = (w: number, hh: number, cands: Pt[], avoid: Box[]): Box | null => {
      for (const [x, y] of cands) {
        const b = { x, y, w, h: hh }
        if (inside(b) && !avoid.some((o) => hit(b, o))) return b
      }
      return null
    }
    const nfs = short ? 11.5 : 13
    const note = (t: string, b: Box | null, cls: string) => {
      if (!b) return null
      const tx = s('text', { class: `t16h-note ${cls}`, x: f1(b.x), y: f1(b.y + nfs), 'font-size': nfs, opacity: 0 }, t)
      stage.append(tx)
      return tx
    }
    const hw = textW(T.held, nfs) + 4
    const sealBox: Box = { x: sp[0] - ss * 0.6, y: sp[1] - ss * 0.6, w: ss * 1.2, h: ss * 1.2 }
    const heldBox = place(hw, nfs * 1.4, [[sp[0] - hw / 2, sp[1] - ss * 0.72 - nfs * 1.4], [sp[0] - hw / 2, sp[1] + ss * 0.72], [sp[0] + ss * 0.8, sp[1] - nfs * 0.7], [sp[0] - ss * 0.8 - hw, sp[1] - nfs * 0.7]], occupied.filter((b) => !flyBoxes.includes(b)))
    const held = note(T.held, heldBox, 't16h-heldt')
    // the ensō drawn around the hidden line when it is caught, and its note
    const ensoPen = new Pen(true, ctx.quality === 'low' ? 'none' : 'full')
    const ec: Pt = [sr.x + sr.w / 2, sr.y + sr.h / 2]
    const erx = Math.min(sr.w / 2 + 12, W / 2 - 4)
    const ery = sr.h / 2 + 5
    const ensoLine = ensoPen.line(arc(ec[0], ec[1], erx, ery, 128, 452, 56), clamp(fs * 0.24, 2.6, 4.2), { a: 0.06, b: 0.5, min: 0.12, wob: 0.28, cls: 'm' })
    ensoPen.root.querySelectorAll('mask').forEach((m) => {
      m.setAttribute('x', '-20')
      m.setAttribute('y', '-20')
      m.setAttribute('width', String(W + 40))
      m.setAttribute('height', String(H + 40))
    })
    ensoPen.root.classList.add('t16h-enso')
    stage.append(ensoPen.root)
    const iw = textW(T.ignored, nfs) + 4
    const ignBox = place(iw, nfs * 1.4, wide && !short
      ? [[lr.x + lr.w + 14, sr.y - nfs * 1.7], [lr.x + lr.w + 14, sr.y + sr.h + 4], [lr.x + lr.w - iw, lb + 8]]
      : [[lr.x + lr.w - iw - 6, lb + 8], [lr.x + lr.w + 12, sr.y], [sr.x + sr.w * 0.5, lb + 8]], [...occupied, sealBox, ...(heldBox ? [heldBox] : [])])
    const ign = note(T.ignored, ignBox, 't16h-ignt')

    el = { plane, flyPath, evil, seal, held, enso: ensoLine.m ?? null, ensoPen, ign, tags, tagRest: tags.map((t) => t.getAttribute('transform') ?? ''), stones, icons, marks }

    // ── where the hand lantern starts, and where it rests once the line is found ──
    sample()
    const lampBox = (x: number, y: number): Box => ({ x: x - 27, y: y - LIFT, w: 54, h: 92 })
    const far = (x: number, y: number) => Math.min(1e4, ...samples.map(([sx, sy]) => Math.hypot(sx - x, sy - y)))
    /** The free spot nearest to `to`: inside the scene, clear of `avoid`, at least `minFar` from the hidden line. */
    const freeNear = (to: Pt, avoid: Box[], minFar: number): Pt | null => {
      let best: Pt | null = null
      let bd = Infinity
      for (let x = 30; x < W - 27; x += 12)
        for (let y = LIFT + 2; y < H - 8; y += 12) {
          const d = Math.hypot(x - to[0], y - to[1])
          if (d >= bd) continue
          const b = lampBox(x, y)
          if (!inside(b) || avoid.some((o) => hit(b, o)) || far(x, y) < minFar) continue
          best = [x, y]
          bd = d
        }
      return best
    }
    const keep = [grow(lr, 4), agentBox, agentLabBox, tagBox, habBox]
    const threadBoxes = occupied.slice(-34)
    rest = freeNear([lr.x + lr.w + 30, lb + 20], [...keep, capBox, ...flyBoxes, ...threadBoxes, sealBox], 0) ?? [W - 30, H / 2]
    if (!touched && !found) {
      const st = freeNear(wide && !short ? [W * 0.9, H * 0.42] : short ? [W * 0.62, H * 0.5] : [W - 34, (lb + capBox.y) / 2], keep, R * 1.35) ?? [W - 30, H - 50]
      pos.x = st[0]
      pos.y = st[1]
    } else if (found && !gsap.isTweening(pos) && dragId < 0) {
      pos.x = rest[0]
      pos.y = rest[1]
    }
    pos.x = clamp(pos.x, 27, W - 27)
    pos.y = clamp(pos.y, LIFT, H - 8)

    // the lantern's flame breathes
    flick?.kill()
    if (!ctx.reduced) flick = gsap.to(agent.flame, { scaleY: 0.84, scaleX: 1.08, svgOrigin: `0 ${f1(agent.wy + 9)}`, duration: 0.8, ease: 'sine.inOut', repeat: -1, yoyo: true })
    paintState()
    setLight()
  }

  /** The hidden line's own boxes (scene coordinates), measured fresh. */
  function samples0(): Pt[] {
    const out: Pt[] = []
    const r0 = root.getBoundingClientRect()
    const range = document.createRange()
    range.selectNodeContents(secretBase)
    for (const r of range.getClientRects()) {
      // one point every ~24 px along each wrapped line, so a short last line counts for little
      const n = Math.max(1, Math.round(r.width / 24))
      for (let k = 0; k <= n; k++) out.push([r.left - r0.left + (r.width * k) / n, r.top - r0.top + r.height / 2])
    }
    return out
  }
  function sample() {
    const r0 = root.getBoundingClientRect()
    rr = { left: r0.left, top: r0.top }
    samples = samples0()
    visited.clear()
  }

  /** Apply what has happened so far, without animation. */
  function paintState() {
    if (!el) return
    const tricked = found && done.size < 3
    root.classList.toggle('found', found)
    root.classList.toggle('tricked', tricked)
    agent?.lit.setAttribute('opacity', found ? '1' : '0.8')
    gsap.set(el.evil, { attr: { 'stroke-dashoffset': found ? 0 : 1 }, opacity: !found ? 0 : done.has(2) ? 0.22 : 1 })
    el.tags.forEach((t, i) => {
      const off = i > 0 && done.has(0)
      t.setAttribute('transform', off ? `${el!.tagRest[i]} translate(${i === 1 ? -5 : 6} 9) rotate(${i === 1 ? -24 : 28} ${t.dataset.x} ${t.dataset.y})` : el!.tagRest[i])
      t.setAttribute('opacity', off ? '0.14' : '1')
    })
    gsap.set(el.seal, { opacity: done.has(1) ? 1 : 0, scale: 1 })
    if (el.held) el.held.setAttribute('opacity', done.has(1) ? '1' : '0')
    if (el.enso) el.enso.style.strokeDashoffset = done.has(2) ? '0' : '1'
    el.ensoPen.root.style.opacity = done.has(2) ? '1' : '0'
    if (el.ign) el.ign.setAttribute('opacity', done.has(2) ? '1' : '0')
    el.icons.forEach((ic) => ic.setAttribute('opacity', found ? '1' : '0'))
    el.stones.forEach((g, i) => g.classList.toggle('on', done.has(i)))
    el.marks.forEach((m, i) => m.setAttribute('opacity', done.has(i) ? '1' : '0'))
    plTw?.kill()
    Object.assign(pl, planeTarget())
    placePlane()
  }

  function movePlane(dur: number, ease = 'power2.inOut', delay = 0) {
    const t = planeTarget()
    plTw?.kill()
    if (ctx.reduced) {
      Object.assign(pl, t)
      placePlane()
      return
    }
    ctx.anim(() => {
      plTw = gsap.to(pl, { ...t, duration: dur, delay, ease, onUpdate: placePlane })
    })
  }

  function park() {
    parkPending = false
    if (!root.isConnected) return
    sweepTl?.kill()
    gsap.killTweensOf(pos)
    glide(rest[0], rest[1], 1.2)
  }

  function reveal() {
    if (found) return
    found = true
    ctx.chime('low')
    cap.textContent = T.found
    habits.forEach((b) => (b.hidden = false))
    ctx.prompt(T.habitsLabel)
    paintState()
    Object.assign(pl, { u: 0, o: 0 })
    placePlane()
    if (dragId >= 0) parkPending = true
    // defer: we may be inside the sweep's own onUpdate here
    else setTimeout(park, ctx.reduced ? 0 : 500)
    if (ctx.reduced || !el) {
      movePlane(0)
      return
    }
    const e = el
    ctx.anim(() => {
      gsap.fromTo(e.evil, { attr: { 'stroke-dashoffset': 1 } }, { attr: { 'stroke-dashoffset': 0 }, duration: 1.4, ease: 'power2.inOut' })
      gsap.fromTo(secretInk, { opacity: 0.35 }, { opacity: 1, duration: 0.9 })
      gsap.fromTo(cap, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 1, delay: 0.3, ease: 'power3.out' })
      if (agent) gsap.fromTo(agent.lit, { opacity: 0.5 }, { opacity: 1, duration: 0.25, repeat: 4, yoyo: true, delay: 1.2 })
      gsap.fromTo(e.icons, { opacity: 0 }, { opacity: 1, duration: 1, stagger: 0.2, delay: 1.6 })
      gsap.from(habits, { opacity: 0, y: 10, duration: 1, stagger: 0.15, delay: 1.8, ease: 'power3.out', clearProps: 'opacity,transform' })
    })
    movePlane(2, 'power2.out', 1.4)
  }

  function habit(i: number) {
    if (!found) return
    cap.textContent = T.habits[i].caption
    if (done.has(i)) return
    done.add(i)
    habits[i].setAttribute('aria-pressed', 'true')
    ctx.chime('soft')
    if (!el) return
    const e = el
    if (ctx.reduced) {
      paintState()
    } else {
      ctx.anim(() => {
        gsap.fromTo(cap, { opacity: 0 }, { opacity: 1, duration: 0.8 })
        e.stones[i].classList.add('on')
        gsap.fromTo(e.marks[i], { opacity: 0 }, { opacity: 1, duration: 0.9 })
        gsap.fromTo(e.stones[i], { y: 0 }, { y: -4, duration: 0.35, yoyo: true, repeat: 1, ease: 'power2.out' })
        if (i === 0) {
          // the tags it does not need are pulled up and laid down in the sand
          e.tags.slice(1).forEach((t, j) => {
            const o = { a: 0, op: 1 }
            const rot = j === 0 ? -24 : 28
            gsap.to(o, {
              a: 1, op: 0.14, duration: 1.2, delay: j * 0.18, ease: 'power2.inOut',
              onUpdate: () => {
                t.setAttribute('transform', `${e.tagRest[j + 1]} translate(${f1((j === 0 ? -5 : 6) * o.a)} ${f1(9 * o.a)}) rotate(${f1(rot * o.a)} ${t.dataset.x} ${t.dataset.y})`)
                t.setAttribute('opacity', o.op.toFixed(2))
              },
            })
          })
        }
        if (i === 1) {
          // the seal stamps on: the plane must wait for you
          gsap.fromTo(e.seal, { opacity: 0, scale: 1.9, rotation: -16, svgOrigin: '0 0' }, { opacity: 1, scale: 1, rotation: 0, duration: 0.55, ease: 'expo.out', delay: 0.15 })
          if (e.held) gsap.fromTo(e.held, { opacity: 0 }, { opacity: 1, duration: 0.8, delay: 0.5 })
        }
        if (i === 2) {
          e.ensoPen.root.style.opacity = '1'
          if (e.enso) gsap.fromTo(e.enso, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.3, ease: 'power2.inOut' })
          gsap.to(e.evil, { opacity: 0.22, duration: 1 })
          if (e.ign) gsap.fromTo(e.ign, { opacity: 0 }, { opacity: 1, duration: 0.8, delay: 1 })
        }
      })
      movePlane(done.size === 3 ? 1.4 : 0.9, done.size === 3 ? 'power2.in' : 'power3.out', i === 1 ? 0.25 : 0)
    }
    if (done.size === 3) {
      root.classList.remove('tricked')
      ctx.insight(T.insight, T.detail)
    }
  }

  // ── moving the light: drag the lantern, tap the letter, or use the keys ──
  const local = (e: PointerEvent): Pt => [e.clientX - rr.left, e.clientY - rr.top]
  let dragId = -1
  let downAt = 0
  let down: Pt = [0, 0]
  let moved = false
  lamp.addEventListener('pointerdown', (e) => {
    touched = true
    dragId = e.pointerId
    downAt = performance.now()
    down = [e.clientX, e.clientY]
    moved = false
    const r0 = root.getBoundingClientRect()
    rr = { left: r0.left, top: r0.top }
    lamp.setPointerCapture(e.pointerId)
    sweepTl?.kill()
    gsap.killTweensOf(pos)
    root.classList.add('dragging')
  })
  lamp.addEventListener('pointermove', (e) => {
    if (e.pointerId !== dragId) return
    if (Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) moved = true
    const [x, y] = local(e)
    pos.x = clamp(x, 10, W - 10)
    pos.y = clamp(y + LIFT - 40, LIFT - 30, H - 8)
    setLight()
  })
  const end = (e: PointerEvent) => {
    if (e.pointerId !== dragId) return
    dragId = -1
    root.classList.remove('dragging')
    if (parkPending) setTimeout(park, ctx.reduced ? 0 : 300)
  }
  lamp.addEventListener('pointerup', end)
  lamp.addEventListener('pointercancel', end)
  // a tap on the letter carries the lantern there
  letter.addEventListener('pointerdown', (e) => {
    if (dragId >= 0 || e.button > 0) return
    touched = true
    const r0 = root.getBoundingClientRect()
    rr = { left: r0.left, top: r0.top }
    const [x, y] = local(e)
    glide(x, y)
  })
  function glide(x: number, y: number, dur = 0.8) {
    if (ctx.reduced) {
      pos.x = x
      pos.y = y
      setLight()
      return
    }
    ctx.anim(() => void gsap.to(pos, { x, y, duration: dur, ease: 'power3.inOut', overwrite: true, onUpdate: setLight }))
  }
  /** Sweep the light along the hidden line (Enter / Space / a quick tap). */
  function sweep() {
    if (!samples.length) return
    if (found) {
      glide(rest[0], rest[1])
      return
    }
    const pts = samples
    if (ctx.reduced) {
      pts.forEach((p) => {
        pos.x = p[0]
        pos.y = p[1]
        setLight()
      })
      return
    }
    ctx.anim(() => {
      sweepTl?.kill()
      sweepTl = gsap.timeline()
      sweepTl.to(pos, { x: pts[0][0], y: pts[0][1], duration: 0.7, ease: 'power2.inOut', onUpdate: setLight })
      for (let i = 1; i < pts.length; i++) sweepTl.to(pos, { x: pts[i][0], y: pts[i][1], duration: 0.09, ease: 'none', onUpdate: setLight })
    })
  }
  lamp.addEventListener('click', (e) => {
    // a keyboard click, or a quick tap without moving: sweep the line for the visitor
    touched = true
    if (e.detail === 0 || (!moved && performance.now() - downAt < 300)) sweep()
  })
  lamp.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 48 : 20
    const d: Record<string, Pt> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    const v = d[e.key]
    if (!v) return
    e.preventDefault()
    touched = true
    sweepTl?.kill()
    gsap.killTweensOf(pos)
    pos.x = clamp(pos.x + v[0], 10, W - 10)
    pos.y = clamp(pos.y + v[1], LIFT - 30, H - 8)
    setLight()
  })

  let rraf = 0
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(rraf)
    rraf = requestAnimationFrame(layout)
  })
  ro.observe(root)
  layout()
  document.fonts?.ready.then(() => root.isConnected && layout())
  return () => {
    ro.disconnect()
    cancelAnimationFrame(rraf)
    flick?.kill()
    plTw?.kill()
    sweepTl?.kill()
    gsap.killTweensOf(pos)
  }
}
