import { s } from '../../core/dom'
import { gsap } from '../../core/anim'
import { arc, brush, cursive, ell, poly, type Picture, type Pt, type TL } from './brush'
import type { Kind } from './data'

/**
 * Six ink paintings, one per kind of agent, in a 300 × 300 box seen through a round moon window:
 * everything stays inside a circle of radius ≈ 140 around (150, 150); the ground sits at y ≈ 250.
 */

type Pen = Parameters<Picture>[0]
const S = { straight: true }
const D2R = Math.PI / 180

/** A closed shape smoothed through its control points (washes and silhouettes). */
const blob = (pts: Pt[]) => `${brush([...pts, pts[0]], 0.01).c}Z`

/** A hand-drawn loop: an ellipse whose radius breathes a little, overlapping where it began. */
function loop(cx: number, cy: number, rx: number, ry: number, a0 = -100, sweep = 372, wob = 0.035, seed = 1, n = 40): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = (a0 + (sweep * i) / n) * D2R
    const k = 1 + wob * Math.sin(a * 3 + seed) + wob * 0.6 * Math.sin(a * 5 + seed * 2)
    return [cx + rx * k * Math.cos(a), cy + ry * k * Math.sin(a)] as Pt
  })
}

/** A squarish loop (a screen, a sheet) traced with one brush: a superellipse, slightly uneven. */
function squircle(cx: number, cy: number, rx: number, ry: number, p = 6, a0 = -96, sweep = 370, seed = 2): Pt[] {
  const n = 64
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = (a0 + (sweep * i) / n) * D2R
    const c = Math.cos(a)
    const s2 = Math.sin(a)
    const k = 1 + 0.012 * Math.sin(a * 4 + seed)
    return [cx + rx * k * Math.sign(c) * Math.abs(c) ** (2 / p), cy + ry * k * Math.sign(s2) * Math.abs(s2) ** (2 / p)] as Pt
  })
}

/** Ground: a pale wash, one dry horizon stroke and a few tufts of moss grass. */
function ground(p: Pen, y = 250, rx = 112, tufts: [number, number][] = [[64, 4], [236, 3]]) {
  p.wash(ell(150, y + 3, rx, 8), 0.12)
  p.wash(brush([[150 - rx * 0.9, y + 1], [150, y + 2.5], [150 + rx * 0.88, y]], 3, { a: 0.2, b: 0.4, min: 0.2 }).d, 0.5, 'k3')
  for (const [x, n] of tufts) grass(p, x, y + 1, n, 14)
}
function grass(p: Pen, x: number, y: number, n: number, hh: number) {
  for (let i = 0; i < n; i++) {
    const a = -90 + (i - (n - 1) / 2) * 17 + (i % 2 ? 6 : -4)
    const l = hh * (0.65 + ((i * 37) % 10) / 22)
    const e: Pt = [x + Math.cos(a * D2R) * l, y + Math.sin(a * D2R) * l]
    p.solid(brush([[x + (i - n / 2) * 1.5, y], [x + (e[0] - x) * 0.5 + (i - n / 2) * 1.5, y + (e[1] - y) * 0.55], e], 2, { a: 0.05, b: 0.85, min: 0.08 }).d, 'm')
  }
}
const ring = (p: Pen, cls = 'vr') => p.top(s('circle', { class: cls, r: 0, cx: -50, cy: -50, opacity: 0 }))
const ember = (p: Pen, x: number, y: number, r: number) => {
  const halo = p.top(s('circle', { class: 'v', cx: x, cy: y, r: r * 2.6, 'fill-opacity': 0.16 }))
  const core = p.top(s('circle', { class: 'v', cx: x, cy: y, r }))
  return { halo, core }
}
const offs = (els: (SVGPathElement | undefined)[]) => els.filter((e): e is SVGPathElement => !!e)
/** A small vermilion seal (hanko), ragged-edged, with a pale mark cut into it. */
const seal = (p: Pen, x: number, y: number, w: number) =>
  p.top(s('g', { class: 't15v-seal', opacity: 0, filter: 'url(#ink-rough)' },
    s('path', { class: 'v', d: poly([[x - w / 2, y - w / 2], [x + w / 2, y - w / 2 + 0.6], [x + w / 2 - 0.4, y + w / 2], [x - w / 2 + 0.3, y + w / 2 - 0.5]]) }),
    s('path', { class: 'card', d: brush([[x - w * 0.22, y - w * 0.2], [x + w * 0.22, y - w * 0.2]], w * 0.12, S).d }),
    s('path', { class: 'card', d: brush([[x, y - w * 0.3], [x, y + w * 0.3]], w * 0.12, S).d }),
    s('path', { class: 'card', d: brush([[x - w * 0.24, y + w * 0.16], [x + w * 0.24, y + w * 0.16]], w * 0.12, S).d })))

/** Chat assistant with tools: your question; it reaches for a tool (the web, a calendar, a file); then it answers. */
const chat: Picture = (p) => {
  // the question, top left
  p.wash(blob(loop(118, 82, 50, 18, -100, 360, 0.08, 1, 16)), 0.07)
  p.line(loop(108, 74, 66, 30, -96, 344, 0.05, 1), 2.8, { a: 0.04, b: 0.3, min: 0.2 })
  p.line([[72, 98], [58, 120], [90, 102]], 2.4, { a: 0.1, b: 0.4 })
  p.line(cursive(64, 68, 150, 3.6, 1), 1.7, { a: 0.05, b: 0.25, min: 0.4, cls: 'k2' })
  p.line(cursive(64, 85, 118, 3.6, 3), 1.7, { a: 0.05, b: 0.25, min: 0.4, cls: 'k2' })
  // a low shelf with three tools on it
  p.wash(ell(150, 178, 98, 6), 0.16)
  p.line([[52, 176], [150, 178], [250, 175]], 3, { a: 0.05, b: 0.3, min: 0.25 })
  // the web: an ink sphere with its meridians
  p.wash(ell(84, 148, 22, 22), 0.2)
  p.wash(blob(arc(88, 152, 18, 18, -30, 150, 10)), 0.18)
  p.line(loop(84, 148, 22, 22, -80, 365, 0.02, 3), 2.4, { a: 0.05, b: 0.2 })
  p.line(arc(84, 148, 9, 22, -90, 270, 26), 1.3, { a: 0.1, b: 0.1, min: 0.5, cls: 'k2' })
  p.line([[63, 148], [105, 149]], 1.3, { ...S, min: 0.5, cls: 'k2' })
  // the calendar: a wooden plaque hung from a peg, today marked in vermilion
  p.line([[150, 116], [136, 128]], 1.2, { ...S, cls: 'k2' })
  p.line([[150, 116], [164, 128]], 1.2, { ...S, cls: 'k2' })
  p.solid(ell(150, 115, 2.4))
  const plq: Pt[] = [[130, 130], [150, 125], [170, 130], [170, 168], [130, 168]]
  p.wash(poly(plq), 0.28)
  p.line([...plq, plq[0]], 2.2, { ...S, a: 0.04, b: 0.06, min: 0.5 })
  p.wash(brush([[133, 140], [167, 140]], 4, { a: 0.2, b: 0.4 }).d, 0.3)
  for (const [x, y] of [[139, 150], [150, 150], [161, 150], [139, 160], [150, 160]]) p.solid(ell(x, y, 2.1, 1.8), 'k2')
  p.solid(ell(161, 160, 3), 'v')
  // the file: a folded sheet
  const sh: Pt[] = [[200, 132], [226, 132], [236, 142], [236, 172], [200, 172]]
  p.wash(poly(sh), 1, 'card')
  p.wash(poly(sh), 0.1)
  p.line([...sh, sh[0]], 2.2, { ...S, a: 0.04, b: 0.06, min: 0.5 })
  p.line([[226, 132], [226, 142], [236, 142]], 1.3, { ...S, min: 0.5 })
  p.line([[206, 152], [228, 152]], 1.6, { ...S, a: 0.1, b: 0.3, cls: 'k2' })
  p.line([[206, 161], [222, 161]], 1.6, { ...S, a: 0.1, b: 0.3, cls: 'k2' })
  // its answer, bottom right
  p.wash(blob(loop(202, 230, 52, 17, -100, 360, 0.08, 4, 16)), 0.09)
  p.line(loop(192, 222, 68, 27, -84, 346, 0.05, 4), 2.8, { a: 0.04, b: 0.3, min: 0.2 })
  p.line([[232, 244], [248, 262], [214, 247]], 2.4, { a: 0.1, b: 0.4 })
  const a1 = p.line(cursive(150, 216, 238, 3.6, 2), 1.7, { a: 0.05, b: 0.25, min: 0.4, cls: 'k2', late: true }).m
  const a2 = p.line(cursive(150, 232, 204, 3.6, 5), 1.7, { a: 0.05, b: 0.25, min: 0.4, cls: 'k2', late: true }).m
  const ans = offs([a1, a2])
  const T: Pt[] = [[84, 148], [150, 147], [218, 152]]
  const dot = p.top(s('circle', { class: 'v', r: 5, cx: 110, cy: 104, opacity: 0 }))
  const rg = ring(p)
  const round = (tl: TL, t0: number, k: number) => {
    const c = T[k]
    tl.set(ans, { strokeDashoffset: 1 }, t0)
    tl.set(dot, { attr: { cx: 112, cy: 106 } }, t0)
    tl.to(dot, { opacity: 1, duration: 0.25 }, t0)
    tl.to(dot, { attr: { cx: c[0], cy: c[1] - 34 }, duration: 0.75, ease: 'power2.inOut' }, t0 + 0.2)
    tl.fromTo(rg, { attr: { cx: c[0], cy: c[1], r: 18 }, opacity: 0.9 }, { attr: { r: 36 }, opacity: 0, duration: 0.9, ease: 'power2.out' }, t0 + 0.95)
    tl.to(dot, { attr: { cx: 190, cy: 192 }, duration: 0.75, ease: 'power2.inOut' }, t0 + 1.3)
    tl.to(dot, { opacity: 0, duration: 0.25 }, t0 + 2)
    tl.to(ans, { strokeDashoffset: 0, duration: 0.55, stagger: 0.35, ease: 'power1.inOut' }, t0 + 2)
  }
  return {
    play: (tl, t) => round(tl, t, 0),
    loop() {
      const tl = gsap.timeline({ repeat: -1, delay: 1.6 })
      ;[1, 2, 0].forEach((k, i) => round(tl, i * 3.8, k))
      return () => tl.kill()
    },
  }
}

/** Automatic workflow: a bamboo deer-scarer (shishi-odoshi). Water fills it, it tips, it clacks — the same, every time. */
const flow: Picture = (p) => {
  ground(p, 250, 116, [[52, 4], [118, 3], [262, 3]])
  // the basin under the open end, the stone under the closed end
  p.wash(ell(86, 244, 42, 9), 0.3)
  p.line(arc(86, 244, 44, 9.5, 190, 350, 20), 1.4, { a: 0.1, b: 0.1, min: 0.4, cls: 'k2' })
  p.line(arc(86, 245, 46, 11, 8, 172, 22), 2.8, { a: 0.05, b: 0.15 })
  p.wash(blob([[212, 246], [214, 226], [230, 214], [250, 218], [258, 236], [254, 248]]), 0.42)
  p.line([[214, 230], [228, 215], [248, 216], [258, 234]], 2.6, { a: 0.05, b: 0.4 })
  p.dry(ell(234, 226, 14, 6), 0.45)
  grass(p, 214, 248, 3, 12)
  // the spout: a bamboo post and a short pipe bringing water
  p.wash(poly([[42, 82], [54, 82], [55, 250], [41, 250]]), 0.28, 'm')
  p.line([[42, 84], [41, 250]], 2.6, { ...S, a: 0.02, b: 0.1, cls: 'm' })
  p.line([[54, 84], [55, 250]], 2, { ...S, a: 0.02, b: 0.1, cls: 'm' })
  for (const y of [132, 196]) p.line([[40, y], [56, y + 1]], 2.6, { ...S, a: 0.1, b: 0.1 })
  p.wash(poly([[48, 92], [100, 104], [99, 114], [48, 103]]), 0.3, 'm')
  p.line([[48, 92], [100, 104]], 2.4, { ...S, a: 0.02, b: 0.1, cls: 'm' })
  p.line([[48, 103], [99, 114]], 2.2, { ...S, a: 0.02, b: 0.1, cls: 'm' })
  p.line(arc(100, 109, 2.6, 5.5, -80, 280, 12), 1.5, { a: 0.1, b: 0.1 })
  // the two legs and the peg
  p.line([[146, 250], [157, 168]], 3.6, { a: 0.05, b: 0.05 })
  p.line([[174, 250], [163, 168]], 3.2, { a: 0.05, b: 0.05 })
  p.dry(brush([[150, 240], [158, 178]], 3, S).d, 0.35)
  // the tube, in its own layer so it can rock on the peg
  const tube = p.sub()
  p.wash(poly([[78, 162], [242, 162], [242, 179], [78, 179]]), 0.42, 'm')
  p.wash(brush([[86, 166], [236, 166]], 3, { ...S, a: 0.1, b: 0.3 }).d, 0.6, 'p')
  p.line([[78, 162], [242, 162]], 3, { ...S, a: 0.02, b: 0.08, cls: 'm' })
  p.line([[78, 179], [242, 179]], 3.4, { ...S, a: 0.02, b: 0.08 })
  p.line(arc(78, 170.5, 4, 8.5, -80, 280, 14), 2, { a: 0.1, b: 0.1 })
  p.line([[242, 162], [247, 170], [242, 179]], 3, { a: 0.1, b: 0.1, cls: 'm' })
  for (const x of [128, 200]) p.line([[x, 161], [x + 1, 180]], 3, { ...S, a: 0.1, b: 0.1 })
  p.back()
  p.solid(ell(160, 170.5, 3.8))
  const drop = p.top(s('ellipse', { class: 'k3', cx: 94, cy: 118, rx: 2, ry: 3.4, opacity: 0 }))
  const stream = p.top(s('path', { class: 'water', d: 'M84 202Q86 222 88 240', opacity: 0 }))
  const rips = [0, 1].map(() => p.top(s('ellipse', { class: 'vr k3r', cx: 88, cy: 244, rx: 4, ry: 1.2, opacity: 0 })))
  const clack = ring(p)
  const once = (tl: TL, t0: number) => {
    tl.fromTo(drop, { attr: { cy: 118 }, opacity: 0.9 }, { attr: { cy: 146 }, duration: 0.38, ease: 'power1.in', repeat: 3, repeatDelay: 0.24 }, t0)
    tl.set(drop, { opacity: 0 }, t0 + 2.5)
    tl.to(tube, { rotation: -22, duration: 0.8, ease: 'power2.in' }, t0 + 2.4)
    tl.fromTo(stream, { opacity: 0 }, { opacity: 0.8, duration: 0.2, yoyo: true, repeat: 1, repeatDelay: 0.4 }, t0 + 3)
    tl.fromTo(rips, { attr: { rx: 4, ry: 1.2 }, opacity: 0.8 }, { attr: { rx: 36, ry: 7 }, opacity: 0, duration: 1.5, stagger: 0.3, ease: 'power2.out' }, t0 + 3.1)
    tl.to(tube, { rotation: 16, duration: 0.32, ease: 'power3.in' }, t0 + 3.7)
    tl.fromTo(clack, { attr: { cx: 238, cy: 204, r: 4 }, opacity: 0.9 }, { attr: { r: 26 }, opacity: 0, duration: 0.7, ease: 'power2.out' }, t0 + 4.02)
  }
  return {
    play(tl, t) {
      gsap.set(tube, { rotation: 16, svgOrigin: '160 170.5' })
      once(tl, t)
    },
    loop() {
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.6, delay: 0.6 })
      once(tl, 0)
      return () => tl.kill()
    },
  }
}

/** Coding agent: a hanging scroll of brush "lines"; it runs them, a vermilion seal marks the bug, it rewrites the line, the run comes back clean. */
const code: Picture = (p) => {
  // the cord and the nail
  p.line([[150, 22], [102, 44]], 1.2, { ...S, cls: 'k2' })
  p.line([[150, 22], [198, 44]], 1.2, { ...S, cls: 'k2' })
  p.solid(ell(150, 21, 2.6))
  // the paper, a little uneven, with a pale wash where the ink has sunk in
  const pap: Pt[] = [[90, 48], [210, 47], [211, 218], [89, 219]]
  p.wash(poly(pap), 1, 'card')
  p.wash(blob([[190, 52], [208, 56], [209, 140], [206, 214], [150, 216], [100, 212], [176, 200], [194, 140]]), 0.08)
  p.line([pap[0], pap[3]], 1.2, { ...S, a: 0.1, b: 0.1, min: 0.5, cls: 'k3' })
  p.line([pap[1], pap[2]], 1.2, { ...S, a: 0.1, b: 0.1, min: 0.5, cls: 'k3' })
  // the rollers
  p.line([[82, 45], [218, 45]], 5.6, { ...S, a: 0.02, b: 0.02, min: 0.8 })
  p.line([[80, 222], [220, 222]], 6.4, { ...S, a: 0.02, b: 0.02, min: 0.8 })
  p.solid(ell(78, 222, 4.2, 5.2))
  p.solid(ell(222, 222, 4.2, 5.2))
  // the lines of code, as brush strokes; indentation tells the shape of the program
  const rows: [number, number[]][] = [[0, [24, 30, 12]], [1, [18, 36]], [2, [26, 12, 30]], [2, [30, 22, 16]], [1, [14]], [0, [10]], [0, [20, 26, 14]]]
  const bug: SVGPathElement[] = []
  rows.forEach(([ind, toks], i) => {
    let x = 108 + ind * 14
    const y = 70 + i * 21
    toks.forEach((w, j) => {
      const el = p.line([[x, y], [x + w * 0.5, y + (j % 2 ? 0.6 : -0.6)], [x + w, y]], 3.2, { a: 0.12, b: 0.3, min: 0.35, cls: j === 0 && i % 3 === 0 ? 'm' : 'k2' }).el
      if (i === 3) bug.push(el)
      x += w + 6
    })
  })
  // the ink stone and the brush below
  p.wash(blob([[96, 246], [100, 236], [136, 234], [142, 244], [136, 252], [100, 252]]), 0.55)
  p.solid(ell(119, 242, 12, 4), 'k2')
  p.line([[156, 250], [226, 238]], 3.4, { ...S, a: 0.02, b: 0.05, min: 0.8, cls: 'm' })
  p.line([[226, 238], [240, 236], [248, 236]], 4.4, { a: 0.05, b: 0.9, min: 0.05 })
  ground(p, 252, 92, [])
  // the rewritten line, the run, the result
  const fix = offs([p.line([[136, 133], [150, 132.4], [164, 133]], 3.2, { a: 0.12, b: 0.3, min: 0.35, cls: 'k2', late: true }).m, p.line([[170, 133], [178, 133.6], [190, 133]], 3.2, { a: 0.12, b: 0.3, min: 0.35, cls: 'k2', late: true }).m])
  const tick = offs([p.line([[176, 238], [183, 246], [198, 228]], 3.2, { ...S, cls: 'm', late: true }).m])
  const stamp = seal(p, 196, 128, 13)
  const run = p.top(s('circle', { class: 'v', r: 3.8, cx: 99, cy: 70, opacity: 0 }))
  const once = (tl: TL, t0: number) => {
    tl.set(fix.concat(tick), { strokeDashoffset: 1 }, t0)
    tl.set(bug, { opacity: 1 }, t0)
    tl.set(stamp, { opacity: 0 }, t0)
    tl.set(run, { attr: { cy: 70 }, opacity: 1 }, t0)
    tl.to(run, { attr: { cy: 133 }, duration: 0.9, ease: 'none' }, t0 + 0.2)
    tl.fromTo(stamp, { opacity: 0, scale: 1.7, svgOrigin: '196 128' }, { opacity: 1, scale: 1, duration: 0.3, ease: 'power3.in' }, t0 + 1.1)
    tl.to(bug, { opacity: 0.12, duration: 0.5 }, t0 + 1.9)
    tl.to(fix, { strokeDashoffset: 0, duration: 0.4, stagger: 0.25 }, t0 + 2.3)
    tl.to(stamp, { opacity: 0, duration: 0.4 }, t0 + 3)
    tl.set(run, { attr: { cy: 70 } }, t0 + 3.2)
    tl.to(run, { attr: { cy: 196 }, duration: 1.3, ease: 'none' }, t0 + 3.2)
    tl.to(run, { opacity: 0, duration: 0.3 }, t0 + 4.5)
    tl.to(tick, { strokeDashoffset: 0, duration: 0.45 }, t0 + 4.5)
  }
  return {
    play: (tl, t) => once(tl, t),
    loop() {
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.6, delay: 2 })
      once(tl, 0)
      return () => tl.kill()
    },
  }
}

/** Computer-use agent: a painted screen; the agent's own cursor clicks a field, types, the next one, then presses the button. */
const computer: Picture = (p) => {
  ground(p, 238, 104, [[58, 3], [246, 3]])
  // the screen: one brush loop, a pale wash, a stand
  p.wash(blob(squircle(150, 120, 92, 66, 7, -96, 360)), 0.03)
  p.wash(blob([[66, 60], [150, 57], [234, 62], [234, 72], [150, 70], [66, 74]]), 0.16)
  p.line(squircle(150, 120, 92, 66, 7, -94, 372), 3, { a: 0.03, b: 0.2, min: 0.25 })
  p.wash(poly([[143, 186], [157, 186], [160, 228], [140, 228]]), 0.35)
  p.line([[146, 187], [143, 228]], 2.4, { a: 0.05, b: 0.1 })
  p.line([[156, 187], [158, 228]], 2, { a: 0.05, b: 0.1, cls: 'k2' })
  p.wash(ell(150, 232, 36, 6), 0.4)
  p.line([[114, 233], [150, 236], [186, 232]], 2.8, { a: 0.05, b: 0.3 })
  // the page: a title, two fields as brush lines, a button as a moss wash
  p.line(cursive(84, 82, 170, 3.6, 2), 1.8, { a: 0.05, b: 0.25, min: 0.4 })
  p.line([[84, 102], [112, 102]], 1.3, { ...S, cls: 'k3' })
  p.line([[84, 120], [146, 121], [214, 119]], 1.8, { a: 0.05, b: 0.15, min: 0.4, cls: 'k2' })
  p.line([[84, 136], [106, 136]], 1.3, { ...S, cls: 'k3' })
  p.line([[84, 154], [150, 155], [214, 153]], 1.8, { a: 0.05, b: 0.15, min: 0.4, cls: 'k2' })
  const btn = p.wash(blob(loop(190, 172, 25, 9.5, -90, 360, 0.04, 2, 16)), 0.35, 'm')
  p.line(loop(190, 172, 25, 9.5, -80, 365, 0.04, 2), 1.8, { a: 0.05, b: 0.2, cls: 'm' })
  p.line([[178, 172], [202, 172]], 1.8, { ...S, cls: 'p' })
  const typed = offs([p.line(cursive(90, 113, 176, 3, 1), 1.5, { a: 0.05, b: 0.1, min: 0.4, cls: 'k2', late: true }).m, p.line(cursive(90, 147, 150, 3, 4), 1.5, { a: 0.05, b: 0.1, min: 0.4, cls: 'k2', late: true }).m])
  const tick = offs([p.line([[132, 170], [139, 177], [153, 162]], 3, { ...S, cls: 'm', late: true }).m])
  const rg = ring(p)
  const cursor = p.top(s('g', { class: 't15v-cursor' }, s('path', { d: 'M0 0L0 20L5.5 15L9.5 23.5L13 22L9 14L16.5 14Z' })))
  const click = (tl: TL, x: number, y: number, t: number) => tl.fromTo(rg, { attr: { cx: x, cy: y, r: 3 }, opacity: 0.9 }, { attr: { r: 18 }, opacity: 0, duration: 0.6, ease: 'power2.out' }, t)
  const once = (tl: TL, t0: number) => {
    tl.set(typed.concat(tick), { strokeDashoffset: 1 }, t0)
    tl.set(btn, { fillOpacity: 0.35 }, t0)
    tl.set(cursor, { x: 220, y: 92 }, t0)
    tl.to(cursor, { x: 150, y: 114, duration: 0.8, ease: 'power2.inOut' }, t0 + 0.2)
    click(tl, 150, 114, t0 + 1)
    tl.to(typed[0], { strokeDashoffset: 0, duration: 0.8, ease: 'none' }, t0 + 1.1)
    tl.to(cursor, { x: 150, y: 148, duration: 0.55, ease: 'power2.inOut' }, t0 + 2)
    click(tl, 150, 148, t0 + 2.55)
    tl.to(typed[1], { strokeDashoffset: 0, duration: 0.7, ease: 'none' }, t0 + 2.65)
    tl.to(cursor, { x: 190, y: 172, duration: 0.6, ease: 'power2.inOut' }, t0 + 3.5)
    click(tl, 190, 172, t0 + 4.1)
    tl.to(btn, { fillOpacity: 0.85, duration: 0.25, yoyo: true, repeat: 1 }, t0 + 4.1)
    tl.to(tick, { strokeDashoffset: 0, duration: 0.4 }, t0 + 4.4)
  }
  return {
    play: (tl, t) => once(tl, t),
    loop() {
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.4, delay: 1.6 })
      once(tl, 0)
      return () => tl.kill()
    },
  }
}

/** Research agent: a lens passes over a scatter of pages; each finding is threaded into one report, its source sealed in vermilion. */
const research: Picture = (p) => {
  ground(p, 248, 108, [[60, 3]])
  const pages: [number, number, number][] = [[86, 104, -12], [112, 140, 6], [74, 172, -6], [114, 206, 10]]
  pages.forEach(([cx, cy, a], i) => {
    const c = Math.cos(a * D2R)
    const sn = Math.sin(a * D2R)
    const R = (x: number, y: number): Pt => [cx + x * c - y * sn, cy + x * sn + y * c]
    const corners = [R(-30, -22), R(30, -21), R(31, 22), R(-29, 23)]
    // each sheet in its own layer, so the one on top hides the lines of the one below
    p.sub()
    p.wash(poly(corners), 1, 'card')
    p.wash(poly(corners), 0.08 + i * 0.03)
    p.line([...corners, corners[0]], 1.7, { ...S, a: 0.04, b: 0.06, min: 0.4 })
    for (let k = 0; k < 3; k++) p.line([R(-22, -10 + k * 9), R(-22 + [36, 28, 18][k], -10 + k * 9)], 1.4, { ...S, a: 0.1, b: 0.3, min: 0.4, cls: 'k2' })
  })
  p.back()
  // the report: a bound booklet
  p.wash(poly([[180, 74], [244, 72], [246, 214], [178, 216]]), 1, 'card')
  p.wash(blob([[180, 76], [196, 75], [194, 214], [180, 214]]), 0.14)
  p.line([[180, 74], [244, 72], [246, 214], [178, 216], [180, 74]], 2.4, { ...S, a: 0.03, b: 0.05, min: 0.5 })
  p.line([[186, 74], [184, 216]], 3.4, { ...S, a: 0.05, b: 0.05, cls: 'k2' })
  p.line([[196, 94], [232, 93]], 3.4, { ...S, a: 0.05, b: 0.3 })
  const L = [0, 1, 2].map((k) => [[196, 122 + k * 30], [196 + [34, 26, 30][k], 122 + k * 30]] as Pt[])
  const lines = offs(L.map((l) => p.line(l, 2, { ...S, cls: 'k2', late: true }).m))
  const cites = L.map((l) => p.top(s('circle', { class: 'v', cx: l[1][0] + 8, cy: l[1][1] - 3, r: 3.2, opacity: 0 })))
  const pick = [0, 1, 3]
  const threads = offs(pick.map((pi, k) => {
    const [cx, cy] = pages[pi]
    const y1 = 122 + k * 30
    return p.line([[cx + 28, cy], [154, (cy + y1) / 2 - 8], [192, y1]], 1, { a: 0.1, b: 0.1, min: 0.6, cls: 'k3', late: true }).m
  }))
  const lens = p.top(s('g', { class: 't15v-lens' },
    s('circle', { r: 20, class: 'lens-glass' }),
    s('path', { class: 'lens-ink', d: brush(loop(0, 0, 20, 20, -60, 372, 0.03, 2), 3.4, { a: 0.05, b: 0.2, min: 0.3 }).d }),
    s('path', { class: 'lens-ink', d: brush([[14, 14], [24, 25], [32, 34]], 6, { a: 0.1, b: 0.05, min: 0.6 }).d })))
  const once = (tl: TL, t0: number) => {
    tl.set([...lines, ...threads], { strokeDashoffset: 1 }, t0)
    tl.set(cites, { opacity: 0 }, t0)
    tl.set(lens, { x: 70, y: 80 }, t0)
    pick.forEach((pi, k) => {
      const [cx, cy] = pages[pi]
      const t = t0 + 0.3 + k * 1.6
      tl.to(lens, { x: cx, y: cy - 4, duration: 0.7, ease: 'power2.inOut' }, t)
      tl.to(threads[k], { strokeDashoffset: 0, duration: 0.5, ease: 'power1.in' }, t + 0.75)
      tl.to(lines[k], { strokeDashoffset: 0, duration: 0.4 }, t + 1.15)
      tl.fromTo(cites[k], { opacity: 0, scale: 0.2, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(3)' }, t + 1.45)
    })
    tl.to(lens, { x: 140, y: 236, duration: 0.8, ease: 'power2.inOut' }, t0 + 5.2)
  }
  return {
    play: (tl, t) => once(tl, t),
    loop() {
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.2, delay: 2 })
      once(tl, 0)
      return () => tl.kill()
    },
  }
}

/** A team of agents: the lead stone hands paper slips to three pebbles; each works, the results come back up. */
const team: Picture = (p) => {
  ground(p, 246, 116, [[46, 3], [254, 3]])
  // raked rings around the lead stone and the pebbles
  for (const r of [72, 84]) p.line(loop(150, 140, r, r * 0.3, -90, 368, 0.01, r), 1, { a: 0.1, b: 0.1, min: 0.5, cls: 'k3' })
  const lead: Pt = [150, 140]
  const leadS: Pt[] = [[112, 140], [114, 118], [124, 96], [142, 82], [160, 80], [178, 92], [188, 116], [190, 140]]
  p.wash(blob(leadS), 0.34)
  p.wash(blob([[156, 82], [176, 92], [188, 118], [190, 140], [150, 140], [166, 112]]), 0.32)
  p.dry(brush([[128, 132], [134, 104], [148, 88]], 6, { a: 0.2, b: 0.5 }).d, 0.35)
  p.line(leadS.slice(4), 3.6, { a: 0.05, b: 0.05, min: 0.3 })
  p.line(leadS.slice(0, 5), 1.6, { a: 0.4, b: 0.2, min: 0.1, cls: 'k2' })
  p.wash(ell(152, 142, 46, 6), 0.3)
  const subs: Pt[] = [[78, 222], [150, 236], [222, 222]]
  for (const [x, y] of subs) {
    for (const r of [26, 34]) p.line(loop(x, y + 2, r, r * 0.3, -90, 368, 0.01, x), 0.9, { a: 0.1, b: 0.1, min: 0.5, cls: 'k3' })
    const sh: Pt[] = [[x - 16, y], [x - 14, y - 11], [x - 3, y - 17], [x + 10, y - 15], [x + 16, y - 6], [x + 17, y]]
    p.wash(blob(sh), 0.4)
    p.line(sh.slice(2), 2.6, { a: 0.05, b: 0.05, min: 0.3 })
    p.wash(ell(x + 1, y + 1, 18, 3.2), 0.3)
  }
  const L = ember(p, lead[0], 70, 6)
  const E = subs.map(([x, y]) => ember(p, x, y - 24, 3.8))
  // the paper slips: little sheets folded once, a line of brush on each
  const slip = () => p.top(s('g', { class: 't15v-slip', opacity: 0 },
    s('path', { class: 'card', d: 'M-7 -5L7 -5.5L7.5 5L-6.5 5.5Z' }),
    s('path', { class: 'slip-edge', d: 'M-7 -5L7 -5.5L7.5 5L-6.5 5.5Z' }),
    s('path', { class: 'k2', d: brush([[-4, -0.5], [4, -0.5]], 1.4, S).d })))
  const slips = subs.map(slip)
  const dots = subs.map(() => p.top(s('circle', { class: 'm', r: 3.4, opacity: 0 })))
  const tick = offs([p.line([[200, 72], [207, 79], [221, 63]], 3, { ...S, cls: 'm', late: true }).m])
  const once = (tl: TL, t0: number) => {
    tl.set(tick, { strokeDashoffset: 1 }, t0)
    tl.fromTo(L.halo, { scale: 1 }, { scale: 1.5, duration: 0.4, yoyo: true, repeat: 1, svgOrigin: `${lead[0]} 70` }, t0)
    subs.forEach(([x, y], i) => {
      const t = t0 + 0.6 + i * 0.3
      tl.set(slips[i], { x: lead[0], y: 92, rotation: 0 }, t0)
      tl.to(slips[i], { opacity: 1, duration: 0.2 }, t)
      tl.to(slips[i], { x, y: y - 30, rotation: (i - 1) * 24, duration: 1, ease: 'power2.inOut' }, t)
      tl.to(slips[i], { opacity: 0, duration: 0.25 }, t + 1)
      tl.fromTo(E[i].halo, { scale: 1 }, { scale: 1.8, duration: 0.45, yoyo: true, repeat: 3, svgOrigin: `${x} ${y - 24}` }, t + 1.1)
      tl.set(dots[i], { x, y: y - 26, opacity: 0 }, t0)
      tl.to(dots[i], { opacity: 1, duration: 0.2 }, t + 2.9)
      tl.to(dots[i], { x: lead[0] + (i - 1) * 9, y: 100, duration: 0.9, ease: 'power2.inOut' }, t + 2.9)
      tl.to(dots[i], { opacity: 0, duration: 0.3 }, t + 3.8)
    })
    tl.to(tick, { strokeDashoffset: 0, duration: 0.45 }, t0 + 4.8)
  }
  return {
    play: (tl, t) => once(tl, t),
    loop() {
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.2, delay: 2 })
      once(tl, 0)
      const breathe = gsap.to([L.halo, ...E.map((e) => e.halo)], { opacity: 0.6, duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut' })
      return () => (tl.kill(), breathe.kill())
    },
  }
}

export const PICTURES: Record<Kind['id'], Picture> = { chat, flow, code, computer, research, team }
