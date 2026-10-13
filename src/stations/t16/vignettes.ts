import { s } from '../../core/dom'
import { gsap } from '../../core/anim'
import { cursive, drawIn, rect, type TL } from '../t03/brush'
import { arc, brush, ell, lantern, Pen, plugShape, poly, rrD, rrPts, S, type Pt } from './art'

/** Four small ink pictures (300 × 300) for Skills, Plugins, A2A and Hooks. */
export interface Vig {
  root: SVGGElement
  /** add the picture's own story to the timeline; returns its end time */
  play(tl: TL, at: number): number
  /** ambient loop while in focus; returns stop */
  loop?(): () => void
}
export type VigFn = (words: string[]) => Vig

const FS = 15

/** A small lantern (the agent) drawn into its own layer. */
function agent(p: Pen, x: number, y: number, k: number) {
  p.sub(`translate(${x} ${y}) scale(${k})`)
  const l = lantern(p)
  p.back()
  return l
}

// ───────── 1 · Skills: a stack of closed notebooks; only the one needed flies open ─────────
const skills: VigFn = (w) => {
  const root = s('g')
  const p = new Pen(true)
  root.append(p.root)
  p.wash(ell(160, 266, 140, 8), 0.08)
  const lamp = agent(p, 56, 262, 0.44)
  // the stack, lying on the sand
  const books: [number, number, number, string][] = [[200, 250, 84, 'k2'], [206, 239, 74, 'm'], [196, 229, 80, 'k3'], [210, 220, 66, 'k2']]
  for (const [x, y, len, c] of books) {
    p.wash(rrD(x, y, len, 10, 2), 0.42, c)
    p.line(rrPts(x, y, len, 10, 2), 1.5, { a: 0.05, b: 0.1 })
    p.line([[x + len - 8, y + 1], [x + len - 8, y + 9]], 1.1, { ...S, cls: 'k3' })
  }
  // where the open one was: a faint outline
  p.line([[204, 210], [236, 210]], 1, { ...S, a: 0.3, b: 0.3, cls: 'k3' })
  p.line([[246, 210], [268, 210]], 1, { ...S, a: 0.3, b: 0.3, cls: 'k3' })
  // a dotted path from the stack up to the open book
  const trail = [0, 1, 2, 3].map((k) => p.solid(ell(222 - k * 9, 198 - k * 12, 1.6 - k * 0.2), 'k3'))
  // the open book, hovering: two pages from a spine
  const left = p.sub()
  p.wash(poly([[176, 86], [98, 76], [92, 162], [176, 170]]), 1, 'cd')
  p.line([[176, 86], [138, 76], [98, 76], [92, 162], [138, 160], [176, 170]], 2, { a: 0.03, b: 0.05 })
  p.text(w[0], 135, 104, FS - 3, 'k')
  p.line(cursive(108, 122, 164, 2.4, 1), 1.1, { a: 0.1, b: 0.2, cls: 'k3' })
  p.line(cursive(108, 136, 156, 2.4, 3), 1.1, { a: 0.1, b: 0.2, cls: 'k3' })
  p.text(w[1], 133, 155, FS - 4, 'k3')
  const right = p.sub()
  p.wash(poly([[176, 86], [254, 76], [260, 162], [176, 170]]), 1, 'cd')
  p.line([[176, 86], [214, 76], [254, 76], [260, 162], [214, 160], [176, 170]], 2.6, { a: 0.03, b: 0.05 })
  const checks: SVGPathElement[] = []
  for (const [k, len] of [40, 30, 36].entries()) {
    const y = 100 + k * 20
    p.line(rect(190, y - 5, 10, 10), 1.3, { ...S, a: 0.05, b: 0.05, min: 0.6 })
    p.line([[206, y], [206 + len, y]], 1.8, { a: 0.1, b: 0.3, min: 0.5, cls: 'k2' })
    const m = p.line([[191, y - 1], [194.5, y + 3.5], [202, y - 7]], 2.4, { ...S, cls: 'm', a: 0.1, b: 0.3, late: true }).m
    if (m) checks.push(m)
  }
  p.back()
  // the ribbon marks the page in use
  p.solid('M176 170L171 194L176 189L181 194Z', 'v')
  p.line([[176, 87], [176, 170]], 2.2, { ...S, a: 0.05, b: 0.05 })
  return {
    root,
    play(tl, at) {
      tl.set(checks, { strokeDashoffset: 1 }, 0)
      tl.set(lamp.lit, { opacity: 0 }, 0)
      gsap.set([left, right], { svgOrigin: '176 127' })
      tl.fromTo([left, right], { scaleX: 0.08 }, { scaleX: 1, duration: 1.2, ease: 'power3.out' }, at * 0.35)
      tl.fromTo(trail, { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.12 }, at * 0.3)
      const end = drawIn(p, tl, 1.6, 0)
      tl.to(lamp.lit, { opacity: 0.9, duration: 0.8 }, end - 0.4)
      return end
    },
    loop() {
      const t = gsap.timeline({ repeat: -1, repeatDelay: 1.2 })
      t.fromTo(checks, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.45, stagger: 0.9, ease: 'power1.inOut' }, 0.4)
      t.to(checks, { opacity: 0, duration: 0.5 }, '+=1.4').set(checks, { strokeDashoffset: 1, opacity: 1 })
      return () => t.kill()
    },
  }
}

// ───────── 2 · Plugins: a wrapped bundle; untied, it holds a skill, a plug and a command seal ─────────
const plugins: VigFn = (w) => {
  const root = s('g')
  const a = new Pen(true)
  const b = new Pen(true)
  root.append(b.root, a.root)
  // the bundle
  a.wash(ell(150, 258, 78, 8), 0.14)
  const body = 'M88 254C78 214 102 176 150 172C198 176 222 214 212 254C176 262 124 262 88 254Z'
  a.wash(body, 0.62, 'm')
  for (const [x, y] of [[112, 222], [134, 236], [158, 222], [182, 236], [196, 214], [124, 202], [168, 200], [146, 248], [190, 252], [108, 246]] as Pt[])
    a.line(arc(x, y, 6, 6, 190, 350, 8), 1.2, { a: 0.2, b: 0.2, cls: 'cd' })
  a.line([[90, 252], [80, 214], [104, 180], [150, 172]], 2.4, { a: 0.05, b: 0.1 })
  a.line([[150, 172], [196, 180], [220, 214], [210, 254], [150, 262], [90, 254]], 3.2, { a: 0.05, b: 0.1 })
  a.line([[146, 176], [126, 150], [112, 146], [118, 164], [140, 178]], 5, { a: 0.1, b: 0.2, cls: 'm' })
  a.line([[154, 176], [176, 148], [190, 146], [184, 164], [160, 178]], 5, { a: 0.1, b: 0.2, cls: 'm' })
  a.solid(ell(150, 177, 10, 7), 'm')
  a.line(arc(150, 177, 10, 7, 20, 200, 10), 1.6, { a: 0.1, b: 0.1 })
  // untied: the cloth lies flat, three things on it
  b.wash(ell(150, 248, 128, 30), 0.1)
  b.wash(poly([[150, 196], [270, 236], [150, 276], [30, 236]]), 0.5, 'm')
  b.line([[150, 196], [270, 236], [150, 276], [30, 236], [150, 196]], 2, { ...S, a: 0.02, b: 0.02 })
  for (const [x, y, dx, dy] of [[270, 236, 16, -4], [30, 236, -16, -4], [150, 276, 4, 14], [150, 196, -4, -12]])
    b.line([[x, y], [x + dx, y + dy]], 3.2, { a: 0.1, b: 0.6, cls: 'm' })
  // a skill notebook
  b.wash(poly([[62, 222], [118, 212], [124, 248], [68, 258]]), 1, 'cd')
  b.line([[62, 222], [118, 212], [124, 248], [68, 258], [62, 222]], 2, { ...S, a: 0.05, b: 0.05 })
  b.line([[74, 220], [80, 256]], 1.6, { ...S, cls: 'k2' })
  b.line([[90, 228], [114, 224]], 1.2, { ...S, cls: 'k3' })
  b.line([[91, 236], [112, 232]], 1.2, { ...S, cls: 'k3' })
  b.line([[92, 244], [108, 241]], 1.2, { ...S, cls: 'k3' })
  // a connection: the one plug shape, with its coiled cord
  const plug = b.top(plugShape(1.7))
  plug.setAttribute('transform', 'translate(160 232) rotate(-18)')
  b.line([[142, 240], [134, 256], [122, 252], [126, 240], [140, 238]], 2.2, { a: 0.1, b: 0.1, cls: 'k2' })
  // a command: a seal, and its "/" imprint on the cloth
  const seal = b.sub()
  b.wash(rrD(206, 192, 20, 32, 4), 1, 'stn')
  b.line(rrPts(206, 192, 20, 32, 4), 1.8, { a: 0.05, b: 0.05 })
  b.wash(rrD(202, 222, 28, 8, 2), 1, 'k2')
  b.back()
  b.solid(rrD(224, 238, 26, 20, 3), 'v')
  b.line([[231, 253], [243, 242]], 2.6, { ...S, a: 0.1, b: 0.1, cls: 'cd' })
  const stamp = b.top(s('g', { class: 'v', opacity: 0 }, s('path', { d: rrD(222, 236, 30, 24, 4), 'fill-opacity': 0.35 })))
  b.text(w[0], 92, 298, FS, 'k2')
  b.text(w[1], 154, 298, FS, 'k2')
  b.text(w[2], 228, 298, FS, 'k2')
  return {
    root,
    play(tl, at) {
      const t1 = drawIn(a, tl, 1.1, at)
      tl.set(b.root, { opacity: 1 }, 0)
      tl.set(b.fades, { opacity: 0 }, 0)
      tl.set(b.draws.map((d) => d.m), { strokeDashoffset: 1 }, 0)
      tl.set(plug, { opacity: 0 }, 0)
      gsap.set(a.root, { svgOrigin: '150 256' })
      tl.to(a.root, { scale: 0.86, opacity: 0, duration: 0.8, ease: 'power2.in' }, t1 + 0.5)
      const t2 = drawIn(b, tl, 1.3, t1 + 0.9)
      tl.to(plug, { opacity: 1, duration: 0.6 }, t1 + 1.4)
      return t2
    },
    loop() {
      const t = gsap.timeline({ repeat: -1, repeatDelay: 1.6 })
      t.to(seal, { y: -10, duration: 0.5, ease: 'power2.out' })
        .to(seal, { y: 0, duration: 0.25, ease: 'power3.in' })
        .fromTo(stamp, { opacity: 0 }, { opacity: 1, duration: 0.3 })
        .to(stamp, { opacity: 0, duration: 0.8 }, '+=1.6')
      return () => t.kill()
    },
  }
}

// ───────── 3 · A2A: two lanterns on either bank; a paper boat carries the request over and the answer back ─────────
const a2a: VigFn = (w) => {
  const root = s('g')
  const p = new Pen(true)
  root.append(p.root)
  // the river: a broad wash with a few current lines
  p.wash('M16 192C70 184 120 192 180 186C230 181 262 184 288 183L290 248C250 252 200 246 150 250C90 255 50 248 14 250Z', 0.07)
  p.wash('M36 204C90 198 160 206 230 199C256 197 272 198 284 197L284 236C250 238 200 234 150 238C100 241 64 236 36 238Z', 0.06)
  for (const [x0, x1, y] of [[96, 140, 196], [168, 206, 192], [118, 182, 244], [74, 110, 236], [196, 236, 240], [140, 172, 214]])
    p.line([[x0, y], [x1, y - 1.5]], 1.1, { a: 0.3, b: 0.4, min: 0.3, cls: 'k3' })
  // two banks, the far one a little higher and smaller
  p.wash(ell(50, 216, 46, 11), 1, 'stn')
  p.line(arc(50, 216, 46, 11, 0, 180, 16), 2.2, { a: 0.1, b: 0.2, cls: 'e' })
  p.wash(ell(252, 198, 38, 9), 1, 'stn')
  p.line(arc(252, 198, 38, 9, 0, 180, 16), 2, { a: 0.1, b: 0.2, cls: 'e' })
  const me = agent(p, 50, 214, 0.66)
  const them = agent(p, 252, 196, 0.52)
  p.text(w[0], 50, 248, FS, 'k2')
  p.text(w[1], 252, 228, FS, 'k2')
  // two lanes on the water: over (upper) and back (lower), each with its arrow and its word
  const over: Pt[] = [[92, 206], [150, 196], [210, 200]]
  const back: Pt[] = [[212, 232], [150, 240], [94, 232]]
  for (const [x, y] of [[100, 205], [116, 202], [132, 199], [148, 197], [164, 197], [180, 198], [196, 199]]) p.solid(ell(x, y, 1.3), 'k3')
  for (const [x, y] of [[204, 233], [188, 236], [172, 238], [156, 239], [140, 239], [124, 238], [108, 236]]) p.solid(ell(x, y, 1.3), 'k3')
  p.line([[204, 195], [212, 200], [204, 204]], 1.6, { ...S, a: 0.1, b: 0.1, cls: 'k3' })
  p.line([[102, 228], [94, 232], [102, 237]], 1.6, { ...S, a: 0.1, b: 0.1, cls: 'k3' })
  p.text(w[2], 150, 184, FS, 'k2')
  p.text(w[3], 150, 262, FS, 'k2')
  // the boat: folded paper, big enough to carry a note
  // parked at the start of its lane, so the picture's bounds (used to fit it in the window) stay true
  const boat = p.top(s('g', { class: 't16v-boat', opacity: 0, transform: 'translate(92 196) scale(0.85)' }))
  const hull = s('g', null,
    s('path', { class: 'cd', d: 'M-30 0L30 0L19 13L-19 13Z' }),
    s('path', { class: 'st3', d: 'M-30 0L-19 13L-8 0Z' }),
    s('path', { class: 'cd', d: 'M-5 -1L-5 -34L22 -1Z' }),
    s('path', { class: 'st3', d: 'M-5 -1L-5 -34L-18 -1Z' }),
    s('path', { class: 'k', d: 'M-31 -0.8L31 -0.8L30 1L-30 1ZM-19 12L19 12L19 14L-19 14Z', 'fill-opacity': 0.85 }),
    s('path', { class: 'k', d: 'M-5.9 -34L-4.1 -34L-4.1 -1L-5.9 -1Z' }),
    s('path', { class: 'k', d: 'M-4.6 -33L22.6 -1.4L21 -0.6L-4.6 -29.4Z', 'fill-opacity': 0.7 }),
    s('path', { class: 'k', d: 'M-30 0L-19 13L-17.6 12.6L-28.2 0Z', 'fill-opacity': 0.7 }))
  // the request (sealed in vermilion) and the answer (a moss tick)
  const ask = s('g', { transform: 'translate(8 -9) rotate(-8)' },
    s('path', { class: 'cd', d: rrD(-8, -5.5, 16, 11, 1) }),
    s('path', { class: 'k', d: 'M-8 -5.5L0 1L8 -5.5L8 -4L0 2.6L-8 -4Z', 'fill-opacity': 0.7 }),
    s('path', { class: 'k', d: `${rrD(-8.6, -6.1, 17.2, 12.2, 1.4)}${rrD(-7.4, -4.9, 14.8, 9.8, 0.8)}`, 'fill-rule': 'evenodd', 'fill-opacity': 0.8 }),
    s('circle', { class: 'v', cx: 0, cy: 2, r: 2.2 }))
  const ans = s('g', { transform: 'translate(8 -9) rotate(6)', opacity: 0 },
    s('path', { class: 'cd', d: rrD(-8, -5.5, 16, 11, 1) }),
    s('path', { class: 'k', d: `${rrD(-8.6, -6.1, 17.2, 12.2, 1.4)}${rrD(-7.4, -4.9, 14.8, 9.8, 0.8)}`, 'fill-rule': 'evenodd', 'fill-opacity': 0.8 }),
    s('path', { class: 'm', d: brush([[-4, 0], [-1, 3], [5, -3.5]], 2.2, { straight: true, a: 0.1, b: 0.3 }).d }))
  hull.append(ask, ans)
  boat.append(hull)
  const rip = p.top(s('g', { class: 't16v-rip' }))
  const lane = (pts: Pt[], u: number): Pt => {
    const v = 1 - u
    return [v * v * pts[0][0] + 2 * v * u * pts[1][0] + u * u * pts[2][0], v * v * pts[0][1] + 2 * v * u * pts[1][1] + u * u * pts[2][1]]
  }
  return {
    root,
    play(tl, at) {
      tl.set([me.lit, them.lit], { opacity: 0 }, 0)
      return drawIn(p, tl, 1.6, at)
    },
    loop() {
      const o = { u: 0 }
      let path = over
      let dir = 1
      const place = () => {
        const [x, y] = lane(path, o.u)
        boat.setAttribute('transform', `translate(${x.toFixed(1)} ${(y - 10 + Math.sin(o.u * 18) * 1.2).toFixed(1)}) rotate(${(Math.sin(o.u * 14) * 3).toFixed(1)}) scale(${dir * 0.85} 0.85)`)
      }
      const ring = (x: number, y: number) => {
        const e = s('ellipse', { cx: x, cy: y + 2, rx: 14, ry: 3 })
        rip.append(e)
        gsap.fromTo(e, { opacity: 0.8 }, { opacity: 0, attr: { rx: 44, ry: 8 }, duration: 1.6, ease: 'power2.out', onComplete: () => e.remove() })
      }
      const t = gsap.timeline({ repeat: -1, repeatDelay: 0.6 })
      t.call(() => {
        path = over
        dir = 1
        gsap.set(ask, { opacity: 1 })
        gsap.set(ans, { opacity: 0 })
      })
        .to(me.lit, { opacity: 0.9, duration: 0.4 })
        .set(o, { u: 0, onComplete: place })
        .to(boat, { opacity: 1, duration: 0.4 })
        .call(() => ring(...lane(over, 0)))
        .to(o, { u: 1, duration: 2.8, ease: 'sine.inOut', onUpdate: place })
        .to(me.lit, { opacity: 0, duration: 0.6 }, '<')
        .call(() => ring(...lane(over, 1)))
        .to(them.lit, { opacity: 0.9, duration: 0.4 })
        .to(ask, { opacity: 0, duration: 0.4 }, '+=0.3')
        .to(ans, { opacity: 1, duration: 0.4 })
        .call(() => {
          path = back
          dir = -1
          o.u = 0
          place()
        }, [], '+=0.3')
        .to(o, { u: 1, duration: 2.8, ease: 'sine.inOut', onUpdate: place })
        .to(them.lit, { opacity: 0, duration: 0.6 }, '<')
        .call(() => ring(...lane(back, 1)))
        .to(me.lit, { opacity: 0.9, duration: 0.4 })
        .to(boat, { opacity: 0, duration: 0.5 }, '+=0.8')
        .to(me.lit, { opacity: 0, duration: 0.5 }, '<')
      return () => (t.kill(), rip.replaceChildren())
    },
  }
}

// ───────── 4 · Hooks: an action walks a stepping-stone path through two gates, before and after ─────────
const hooks: VigFn = (w) => {
  const root = s('g')
  const p = new Pen(true)
  root.append(p.root)
  const stones: Pt[] = [[30, 228], [78, 222], [150, 230], [222, 221], [270, 228]]
  p.wash(ell(150, 236, 148, 12), 0.06)
  for (const [x, y] of stones) {
    p.wash(ell(x, y, 21, 7), 1, 'stn')
    p.line(arc(x, y, 21, 7, 10, 175, 12), 2, { a: 0.1, b: 0.2, cls: 'e' })
  }
  const gates = [112, 188]
  const tags: SVGGElement[] = []
  const seals: SVGElement[] = []
  for (const [i, x] of gates.entries()) {
    for (const dx of [-18, 18]) {
      p.line([[x + dx, 232], [x + dx * 1.02, 128]], 4.2, { ...S, a: 0.03, b: 0.06, cls: 'm' })
      for (const y of [150, 182, 212]) p.line([[x + dx - 3, y], [x + dx + 3, y]], 1.4, { ...S, a: 0.2, b: 0.2 })
    }
    p.line([[x - 28, 132], [x + 28, 130]], 4.6, { ...S, a: 0.05, b: 0.1 })
    p.line([[x - 22, 146], [x + 22, 145]], 2.4, { ...S, a: 0.05, b: 0.1, cls: 'k2' })
    p.text(w[i === 0 ? 0 : 2], x, 124, FS, 'k')
    const tag = p.sub()
    p.line([[x, 147], [x, 158]], 1, { ...S, cls: 'k2' })
    p.wash(rrD(x - 7, 158, 14, 18, 2), 1, 'stn')
    p.line(rrPts(x - 7, 158, 14, 18, 2), 1.4, { a: 0.05, b: 0.05 })
    p.back()
    tags.push(tag)
    seals.push(p.top(s('circle', { class: 'v', cx: x, cy: 167, r: 4.2, opacity: 0 })))
  }
  // the action: a hand-seal on the middle stone
  p.wash(rrD(143, 196, 14, 22, 3), 1, 'stn')
  p.line(rrPts(143, 196, 14, 22, 3), 1.6, { a: 0.05, b: 0.05 })
  p.wash(rrD(140, 216, 20, 6, 2), 1, 'k2')
  p.text(w[1], 150, 266, FS, 'k2')
  // the log, a small scroll that gets a new line after each action
  p.wash(rrD(238, 92, 44, 34, 1), 1, 'cd')
  p.line([[238, 92], [282, 92]], 1, { ...S, a: 0.1, b: 0.1, cls: 'k3' })
  p.line([[238, 126], [282, 126]], 1, { ...S, a: 0.1, b: 0.1, cls: 'k3' })
  p.line([[236, 89], [236, 129]], 4.2, { ...S, a: 0.05, b: 0.05, cls: 'k2' })
  p.line([[284, 89], [284, 129]], 4.2, { ...S, a: 0.05, b: 0.05, cls: 'k2' })
  const logs = [101, 109, 117].map((y, k) => p.line([[244, y], [266 + k * 4, y]], 1.5, { a: 0.1, b: 0.3, cls: 'k2', late: true }).m!).filter(Boolean)
  const bead = p.top(s('circle', { class: 'v t16v-bead', r: 5, cx: 30, cy: 214, opacity: 0 }))
  const rip = p.top(s('g', { class: 't16v-rip' }))
  return {
    root,
    play(tl, at) {
      tl.set(logs, { strokeDashoffset: 1 }, 0)
      for (const [i, t] of tags.entries()) gsap.set(t, { svgOrigin: `${gates[i]} 147` })
      return drawIn(p, tl, 1.6, at)
    },
    loop() {
      const o = { x: 30 }
      const yAt = (x: number) => {
        // hop from stone to stone
        let i = 0
        while (i < stones.length - 2 && x > stones[i + 1][0]) i++
        const [x0, y0] = stones[i]
        const [x1, y1] = stones[i + 1]
        const u = (x - x0) / (x1 - x0)
        return y0 + (y1 - y0) * u - 10 - Math.sin(Math.PI * u) * 18
      }
      const move = () => {
        bead.setAttribute('cx', o.x.toFixed(1))
        bead.setAttribute('cy', yAt(o.x).toFixed(1))
      }
      const swing = (t: SVGGElement) => gsap.fromTo(t, { rotation: 0 }, { rotation: 14, duration: 0.35, ease: 'power2.out', yoyo: true, repeat: 3 })
      const ring = () => {
        const e = s('ellipse', { cx: 150, cy: 232, rx: 14, ry: 4 })
        rip.append(e)
        gsap.fromTo(e, { opacity: 0.9 }, { opacity: 0, attr: { rx: 46, ry: 12 }, duration: 1.4, ease: 'power2.out', onComplete: () => e.remove() })
      }
      let n = 0
      const t = gsap.timeline({ repeat: -1, repeatDelay: 0.8 })
      t.set(o, { x: 30, onComplete: move })
        .to(bead, { opacity: 1, duration: 0.3 })
        .to(o, { x: 112, duration: 1.3, ease: 'none', onUpdate: move })
        .call(() => void swing(tags[0]))
        .to(seals[0], { opacity: 1, duration: 0.3 }, '<')
        .to(o, { x: 150, duration: 0.7, ease: 'none', onUpdate: move })
        .call(ring)
        .to(o, { x: 188, duration: 0.7, ease: 'none', onUpdate: move }, '+=0.4')
        .call(() => {
          swing(tags[1])
          const m = logs[n++ % logs.length]
          gsap.fromTo(m, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.6 })
          if (n % logs.length === 0) gsap.to(logs, { strokeDashoffset: 1, duration: 0.4, delay: 2.4 })
        })
        .to(seals[1], { opacity: 1, duration: 0.3 }, '<')
        .to(o, { x: 270, duration: 1.2, ease: 'none', onUpdate: move })
        .to([bead, ...seals], { opacity: 0, duration: 0.5 }, '+=0.3')
      return () => (t.kill(), rip.replaceChildren(), gsap.killTweensOf([...tags, ...logs]))
    },
  }
}

export const VIGS: VigFn[] = [skills, plugins, a2a, hooks]
