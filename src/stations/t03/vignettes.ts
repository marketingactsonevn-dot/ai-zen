import { s } from '../../core/dom'
import { gsap } from '../../core/anim'
import { createLoop } from '../../core/loop'
import { arc, brush, cursive, ell, lerp, poly, rect, rng, rrD, rrPts, type Picture, type Pt } from './brush'

/** Eleven milestone pictures, each drawn in a 300 × 300 box with the ground at y ≈ 262. */

const S = { straight: true }
const ground = (p: Parameters<Picture>[0], rx = 138) => p.wash(ell(150, 262, rx, 7), 0.08)

/** A closed shape smoothed through its control points (for washes and silhouettes). */
const blob = (pts: Pt[]) => `${brush([...pts, pts[0]], 0.01).c}Z`

/**
 * 1950 — the imitation game, as shadows on paper screens: behind one a person, behind the other a machine with
 * two tape reels; between them the judge, seen from behind, wondering which is which.
 */
const turing: Picture = (p, A) => {
  ground(p)
  const screen = (x0: number) => {
    const xs = [0, 28, 56, 84].map((d) => x0 + d)
    return { xs, top: xs.map((x, i) => [x, i % 2 ? 116 : 124] as Pt), bot: xs.map((x, i) => [x, i % 2 ? 254 : 248] as Pt) }
  }
  const scr = [screen(14), screen(202)]
  const panel = (sc: ReturnType<typeof screen>, i: number) => poly([sc.top[i], sc.top[i + 1], sc.bot[i + 1], sc.bot[i]])
  // the paper of the panels
  for (const sc of scr) for (let i = 0; i < 3; i++) p.solid(panel(sc, i), 'p')
  // shadows cast on the paper from behind: soft, no outline
  p.sub()
  // a person in profile, facing the judge
  p.wash(blob([[22, 250], [24, 216], [34, 202], [48, 196], [50, 186], [45, 176], [45, 164], [50, 152], [60, 146], [70, 148], [76, 157], [77, 165], [81, 171], [77, 174], [77, 181], [71, 186], [68, 194], [82, 200], [92, 214], [94, 250]]), 0.34)
  // a machine of the 1950s: a tall cabinet, its two tape reels one above the other
  p.wash(blob([[216, 250], [217, 146], [222, 138], [264, 138], [270, 146], [271, 250]]), 0.34)
  const reels = ([[243, 166], [243, 204]] as Pt[]).map(([x, y]) => {
    const g = p.sub()
    p.solid(ell(x, y, 12.5), 'p').setAttribute('fill-opacity', '0.55')
    p.wash(ell(x, y, 3.4), 0.5)
    for (const a of [20, 140, 260]) {
      const r = (a * Math.PI) / 180
      p.wash(ell(x + 7.5 * Math.cos(r), y + 7.5 * Math.sin(r), 2.6), 0.45)
    }
    p.back()
    return { g, o: `${x} ${y}` }
  })
  p.sub()
  for (const x of [229, 238, 247, 256]) p.wash(ell(x, 234, 1.8), 0.5)
  // the panels: tone where they fold away, a hill painted across, hairline folds, a dry top edge
  p.sub()
  for (const sc of scr) {
    for (let i = 0; i < 3; i++) p.wash(panel(sc, i), [0.04, 0.17, 0.08][i])
    const hill = sc.xs.map((x, i) => [x, (i % 2 ? 214 : 222) - [6, 16, 4, 12][i]] as Pt)
    p.wash(poly([...hill, ...sc.xs.slice().reverse().map((x, i) => [x, i % 2 ? 238 : 244] as Pt)]), 0.07)
    p.line(hill, 1.1, { a: 0.2, b: 0.4, min: 0.3, cls: 'k3' })
    sc.xs.forEach((_, i) => p.line([sc.top[i], sc.bot[i]], i % 3 ? 1.2 : 1.8, { a: 0.1, b: 0.5, min: 0.25, cls: i % 3 ? 'k3' : 'k2' }))
    p.line(sc.top, 2.6, { ...S, a: 0.04, b: 0.3, min: 0.4 })
  }
  p.back()
  // the judge, seated, seen from behind: one wash for the robe, one heavy stroke down the back, a dab for the head
  p.wash(blob([[150, 196], [139, 197], [130, 203], [125, 214], [124, 228], [119, 242], [110, 254], [104, 259], [196, 259], [190, 254], [181, 242], [176, 228], [175, 214], [170, 203], [161, 197]]), 0.5)
  p.line([[147, 197], [136, 201], [128, 211], [124, 228], [118, 246], [107, 258]], 4.2, { a: 0.05, b: 0.45, min: 0.15, wob: 0.2 })
  p.line([[156, 198], [167, 204], [173, 218]], 1.8, { a: 0.1, b: 0.7, cls: 'k2' })
  p.line([[140, 222], [146, 238], [144, 252]], 1.4, { a: 0.3, b: 0.5, cls: 'k3' })
  p.solid(ell(150, 186, 8.4, 9.6))
  // the question, floating above
  p.wash(ell(150, 150, 18, 16), 0.06)
  p.text(A.mark, 150, 161, 32)
  return {
    loop() {
      // the machine "thinks": its reels turn slowly, the other way round from each other
      const tw = reels.map(({ g, o }, i) => gsap.fromTo(g, { rotation: 0, svgOrigin: o }, { rotation: i ? 360 : -360, svgOrigin: o, duration: 8, ease: 'none', repeat: -1 }))
      return () => tw.forEach((t) => t.kill())
    },
  }
}

/** 1956 — a college hall with a cupola, and a blackboard on an easel. */
const dartmouth: Picture = (p) => {
  ground(p)
  // the hall stands on the right, so its cupola never meets the big year at the top left
  p.sub('translate(106 0)')
  p.wash(poly([[20, 124], [96, 90], [172, 124]]), 0.3)
  p.dry(brush([[30, 120], [96, 92], [162, 120]], 8, { a: 0.1, b: 0.3 }).d, 0.3)
  p.wash(poly(rect(18, 132, 156, 104)), 0.09)
  p.line([[6, 126], [96, 84], [186, 126]], 4.6, { ...S, a: 0.04, b: 0.2 })
  p.line([[14, 132], [178, 132]], 3, { a: 0.05, b: 0.2 })
  p.line([[86, 88], [86, 66]], 2.6)
  p.line([[106, 88], [106, 66]], 2.6)
  p.line([[82, 66], [110, 66]], 3, S)
  p.line(arc(96, 66, 12, 15, 180, 360, 14), 2.8)
  p.line([[96, 51], [96, 33]], 1.8)
  p.solid(ell(96, 31, 2.4))
  for (const x of [26, 52, 140, 166]) p.line([[x, 136], [x, 232]], 4.2, { a: 0.04, b: 0.3 })
  for (const x of [39, 153]) {
    p.wash(poly(rect(x - 6, 148, 12, 22)), 0.42)
    p.wash(poly(rect(x - 6, 190, 12, 22)), 0.42)
  }
  p.wash('M82 232V190A14 14 0 0 1 110 190V232Z', 0.32)
  p.line([[82, 232], [82, 190], ...arc(96, 190, 14, 14, 180, 360, 10), [110, 190], [110, 232]], 3, { a: 0.05, b: 0.05 })
  p.line([[8, 236], [184, 236]], 3.6, { a: 0.03, b: 0.2 })
  p.line([[56, 244], [136, 244]], 2.6)
  p.line([[44, 252], [148, 252]], 2.4)
  p.back()
  // easel + blackboard, on the left
  p.sub('translate(-186 0)')
  p.solid(rrD(200, 126, 86, 68, 3), 'board')
  p.line(rect(200, 126, 86, 68), 2.8, { ...S, a: 0.03, b: 0.06 })
  p.line([[243, 108], [243, 126]], 2.6)
  p.line([[210, 196], [198, 262]], 3.4, { a: 0.05 })
  p.line([[276, 196], [288, 262]], 3.4, { a: 0.05 })
  p.line([[196, 200], [290, 200]], 3, { a: 0.05 })
  const ch = { cls: 'chalk', a: 0.05, b: 0.15 }
  p.line([[216, 182], [228, 140], [240, 182]], 3, { ...ch, ...S })
  p.line([[221, 167], [235, 167]], 2.4, ch)
  p.line([[258, 140], [258, 182]], 3, ch)
  p.line([[251, 141], [265, 141]], 2.2, ch)
  p.line([[251, 182], [265, 182]], 2.2, ch)
  p.back()
}

/** 1974 · 1987 — a bare branch in the snow, a small bird puffed against the cold. */
const winter: Picture = (p) => {
  p.wash(ell(198, 104, 62), 0.04)
  p.wash(ell(150, 258, 140, 12), 0.1)
  p.line([[14, 262], [80, 255], [150, 257], [222, 252], [288, 259]], 2, { a: 0.1, b: 0.2 })
  p.line([[64, 262], [60, 226], [72, 190], [66, 152], [82, 116], [110, 88]], 10, { a: 0.03, b: 0.65, min: 0.25 })
  p.line([[70, 184], [104, 166], [140, 160], [178, 146], [216, 134]], 5.4, { a: 0.04, b: 0.75 })
  p.line([[86, 114], [122, 100], [150, 80], [178, 70]], 4.4, { a: 0.04, b: 0.75 })
  p.line([[140, 160], [147, 141], [143, 124]], 2.4)
  p.line([[178, 146], [196, 154], [214, 156]], 2.1)
  p.line([[122, 100], [131, 82], [129, 66]], 2.2)
  p.line([[216, 134], [232, 126], [248, 128]], 1.8)
  p.line([[150, 80], [164, 62], [162, 48]], 1.8)
  p.line([[66, 204], [46, 192], [32, 194]], 3)
  p.line([[46, 192], [40, 178]], 1.6)
  p.solid(ell(150, 150, 8.5, 7))
  p.solid(ell(158, 143.5, 4.8, 4.6))
  p.line([[143, 152], [133, 158]], 3.2, { a: 0.05, b: 0.4 })
  p.line([[162, 143], [167, 144]], 1.4, S)
  if (!p.live) return
  const r = rng(7)
  const flakes = Array.from({ length: 26 }, () => ({ x: 14 + r() * 272, y: 40 + r() * 214, v: 10 + r() * 18, ph: r() * 6, el: s('circle', { r: (0.8 + r() * 1.2).toFixed(1), class: 'snow' }) }))
  const g = p.top(s('g'))
  flakes.forEach((f) => (g.append(f.el), f.el.setAttribute('cx', f.x.toFixed(1)), f.el.setAttribute('cy', f.y.toFixed(1))))
  p.fades.push(g)
  return {
    loop() {
      // dt: the loop's own (≤ 0.05 s, as before); host: the picture's <svg>, so the snow stops offscreen
      const lp = createLoop(g.ownerSVGElement ?? g, (_t, dt) => {
        const now = performance.now()
        for (const f of flakes) {
          f.y += f.v * dt
          if (f.y > 256) f.y = 40
          f.el.setAttribute('cx', (f.x + 5 * Math.sin(now / 1300 + f.ph)).toFixed(1))
          f.el.setAttribute('cy', f.y.toFixed(1))
          f.el.setAttribute('fill-opacity', Math.min(1, (f.y - 40) / 24).toFixed(2)) // flakes appear softly, below the year
        }
      })
      lp.start()
      return () => lp.dispose()
    },
  }
}

/** 1997 — a chess king topples beside a server tower. */
const deepblue: Picture = (p) => {
  ground(p)
  // the machine: a dark monolith in wash, its edge one stroke that lifts off toward the ground
  p.wash(poly([[250, 58], [266, 70], [266, 256], [250, 252]]), 0.5)
  p.wash(poly(rect(188, 58, 62, 194)), 0.2)
  p.dry(brush([[200, 64], [203, 150], [199, 246]], 12, { a: 0.05, b: 0.4 }).d, 0.22)
  p.dry(brush([[236, 66], [233, 160], [237, 244]], 9, { a: 0.05, b: 0.5 }).d, 0.18)
  p.line([[188, 56], [187, 150], [189, 250]], 4.2, { a: 0.02, b: 0.8, min: 0.12, wob: 0.15 })
  p.line([[186, 58], [252, 58], [266, 70]], 2.6, { ...S, a: 0.05, b: 0.4, min: 0.3 })
  p.line([[250, 60], [250, 248]], 1.4, { a: 0.05, b: 0.7, min: 0.2, cls: 'k2' })
  const lights: SVGElement[] = []
  for (const y of [78, 102, 126, 150, 174, 198, 222]) {
    p.line([[195, y], [224, y]], 1.3, { a: 0.3, b: 0.5, min: 0.2, cls: 'k2' })
    lights.push(p.solid(rrD(231, y - 2, 8, 4, 2), 'm'))
  }
  const FL: Pt = [26, 220]
  const FR: Pt = [154, 220]
  const NR: Pt = [172, 250]
  const NL: Pt = [8, 250]
  const at = (u: number, v: number) => lerp(lerp(FL, FR, u), lerp(NL, NR, u), v)
  for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) if ((i + j) % 2) p.wash(poly([at(i / 6, j / 3), at((i + 1) / 6, j / 3), at((i + 1) / 6, (j + 1) / 3), at(i / 6, (j + 1) / 3)]), 0.36)
  p.wash(poly([NL, NR, [172, 258], [8, 258]]), 0.3)
  p.line([FL, FR, NR, NL, FL], 2.4, { ...S, a: 0.03, b: 0.05 })
  p.line([[8, 258], [172, 258]], 2, S)
  // a pawn
  p.solid('M123 244L127 232Q124 229 125 225A5.5 5.5 0 1 1 135 225Q136 229 133 232L137 244Z', 'p')
  p.line([[121, 244], [127, 232], ...arc(130, 224, 5.5, 5.5, 120, 420, 12), [133, 232], [139, 244], [121, 244]], 1.8, { a: 0.05, b: 0.05, min: 0.5 })
  // the king
  const king = p.sub()
  const K = ([[-18, 0], [-16, -6], [-10, -8], [-8, -12], [-6, -30], [-5, -42], [-11, -45], [-11, -50], [-6, -52], [-9, -58], [-8, -65], [0, -69], [8, -65], [9, -58], [6, -52], [11, -50], [11, -45], [5, -42], [6, -30], [8, -12], [10, -8], [16, -6], [18, 0]] as Pt[]).map(([x, y]) => [x + 70, y + 236] as Pt)
  p.solid(poly(K))
  p.line([...K, K[0]], 1.6, { a: 0.03, b: 0.03, min: 0.6, straight: true })
  p.line([[70, 168], [70, 150]], 3.2, S)
  p.line([[63, 158], [77, 158]], 3, S)
  p.line([[65, 224], [66, 206], [67, 196]], 1.6, { cls: 'p' })
  p.back()
  return {
    play(tl, at) {
      tl.fromTo(king, { rotation: 0, svgOrigin: '88 236' }, { rotation: 97, svgOrigin: '88 236', duration: 1.2, ease: 'power2.in' }, at)
      tl.to(king, { rotation: 92, svgOrigin: '88 236', duration: 0.35, ease: 'sine.out' })
    },
    loop() {
      const tw = gsap.to(lights, { opacity: 0.12, duration: 0.5, ease: 'steps(1)', stagger: { each: 0.35, repeat: -1, yoyo: true, from: 'random' } })
      return () => (tw.kill(), gsap.set(lights, { opacity: 1 }))
    },
  }
}

/** 2012 — a grid of photos; the cat is found and outlined, then passed through stacked layers. */
const alexnet: Picture = (p) => {
  ground(p, 132)
  const motif = [
    (x: number, y: number) => poly([[x + 5, y + 31], [x + 17, y + 12], [x + 24, y + 22], [x + 28, y + 17], [x + 34, y + 31]]),
    (x: number, y: number) => ell(x + 19, y + 15, 7) + poly([[x + 4, y + 30], [x + 34, y + 30], [x + 34, y + 33], [x + 4, y + 33]]),
    (x: number, y: number) => ell(x + 19, y + 14, 9, 8) + poly([[x + 18, y + 20], [x + 21, y + 20], [x + 21, y + 33], [x + 18, y + 33]]),
    (x: number, y: number) => `M${x + 6} ${y + 24}Q${x + 19} ${y + 34} ${x + 32} ${y + 24}Z` + poly([[x + 18, y + 6], [x + 19, y + 6], [x + 19, y + 24], [x + 18, y + 24]]) + poly([[x + 20, y + 8], [x + 30, y + 21], [x + 20, y + 21]]),
    (x: number, y: number) => ell(x + 17, y + 19, 10, 6) + poly([[x + 26, y + 19], [x + 34, y + 13], [x + 34, y + 25]]),
    (x: number, y: number) => poly([[x + 8, y + 33], [x + 8, y + 18], [x + 19, y + 8], [x + 30, y + 18], [x + 30, y + 33]]),
    (x: number, y: number) => ell(x + 19, y + 12, 6) + poly([[x + 18, y + 17], [x + 20, y + 17], [x + 20, y + 33], [x + 18, y + 33]]),
    (x: number, y: number) => `M${x + 4} ${y + 22}Q${x + 12} ${y + 14} ${x + 19} ${y + 22}T${x + 34} ${y + 22}V${y + 34}H${x + 4}Z`,
  ]
  let k = 0
  for (let j = 0; j < 3; j++)
    for (let i = 0; i < 3; i++) {
      if (i === 1 && j === 1) continue
      const x = 22 + i * 44
      const y = 80 + j * 44
      p.wash(rrD(x, y, 38, 38, 4), 0.07)
      p.wash(motif[k++](x, y), 0.28)
    }
  // stacked layers → answer
  const L: [number, number][] = [[180, 124], [210, 100], [236, 76], [258, 52]]
  let prev: Pt[] | null = null
  for (const [x, hgt] of L) {
    const q: Pt[] = [[x - 7, 146 - hgt / 2 + 8], [x + 7, 146 - hgt / 2], [x + 7, 146 + hgt / 2 - 8], [x - 7, 146 + hgt / 2]]
    p.wash(poly(q), 0.16)
    if (prev) {
      p.line([prev[1], q[0]], 1, { ...S, a: 0.05, b: 0.05, min: 0.6, cls: 'k3' })
      p.line([prev[2], q[3]], 1, { ...S, a: 0.05, b: 0.05, min: 0.6, cls: 'k3' })
    }
    p.line([...q, q[0]], 2.4, { ...S, a: 0.04, b: 0.06 })
    prev = q
  }
  p.line([[106, 140], [173, 92]], 1, { ...S, min: 0.6, cls: 'k3' })
  p.line([[106, 150], [173, 208]], 1, { ...S, min: 0.6, cls: 'k3' })
  p.line(arc(283, 146, 7, 7, 0, 370, 16), 2.4)
  const out = p.solid(ell(283, 146, 4.5), 'm')
  // the cat photo pops forward
  const cat = p.sub()
  p.solid(rrD(66, 124, 38, 38, 5), 'p')
  p.line(rrPts(66, 124, 38, 38, 5), 2.6, { a: 0.05, b: 0.1 })
  p.solid('M78 157Q75 147 81 142L79 133L85 138Q86 137.5 87 138L92 133L91 142Q96 147 93 157Q86 160 78 157Z')
  p.line([[93, 155], [99, 151], [98, 144]], 2, { a: 0.1, b: 0.4 })
  p.line(rect(73, 129.5, 27, 30.5), 1.5, { ...S, cls: 'm', a: 0.02, b: 0.02, min: 0.8 })
  p.back()
  const dot = p.live ? p.top(s('circle', { r: 3.4, cx: 106, cy: 146, class: 'm', opacity: 0 })) : null
  return {
    play(tl, at) {
      tl.fromTo(cat, { scale: 1, svgOrigin: '85 143' }, { scale: 1.28, svgOrigin: '85 143', duration: 0.8, ease: 'back.out(2)' }, at)
    },
    loop() {
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.8 })
      tl.fromTo(dot, { attr: { cx: 108 }, opacity: 0 }, { opacity: 1, duration: 0.2 })
        .to(dot, { attr: { cx: 276 }, duration: 1.6, ease: 'power1.inOut' }, 0)
        .to(dot, { opacity: 0, duration: 0.2 }, 1.45)
        .fromTo(out, { opacity: 0.3 }, { opacity: 1, duration: 0.4, yoyo: true, repeat: 1 }, 1.5)
      return () => tl.kill()
    },
  }
}

/** 2016 — a go board; black and white stones are placed one by one. */
const alphago: Picture = (p) => {
  ground(p, 136)
  const FL: Pt = [66, 150]
  const FR: Pt = [234, 150]
  const NR: Pt = [280, 230]
  const NL: Pt = [20, 230]
  const at = (u: number, v: number) => lerp(lerp(FL, FR, u), lerp(NL, NR, u), v)
  p.wash(poly([FL, FR, NR, NL]), 0.1)
  p.wash(poly([NL, NR, [280, 246], [20, 246]]), 0.28)
  p.wash(poly(rect(34, 246, 18, 12)), 0.4)
  p.wash(poly(rect(248, 246, 18, 12)), 0.4)
  p.line([FL, FR, NR, NL, FL], 3, { ...S, a: 0.03, b: 0.05 })
  p.line([NL, [20, 246], [280, 246], NR], 2.6, { ...S, a: 0.03, b: 0.05 })
  const g = (i: number) => 0.07 + (0.86 * i) / 8
  for (let i = 0; i < 9; i++) {
    p.line([at(0.07, g(i)), at(0.93, g(i))], 1.1, { a: 0.02, b: 0.04, min: 0.7, wob: 0 })
    p.line([at(g(i), 0.07), at(g(i), 0.93)], 1.1, { a: 0.02, b: 0.04, min: 0.7, wob: 0 })
  }
  p.sub()
  const stones: SVGGElement[] = []
  const list: [number, number, boolean][] = [[2, 2, true], [6, 6, false], [6, 2, true], [2, 6, false], [4, 4, true], [3, 3, false], [5, 5, true], [5, 3, false], [3, 5, true], [4, 6, false], [6, 4, true]]
  for (const [i, j, black] of list) {
    const [x, y] = at(g(i), g(j))
    const rx = 7.5 * (0.78 + 0.32 * g(j))
    const ry = rx * 0.6
    const st = p.group()
    p.solid(ell(x, y - ry * 0.35, rx, ry), black ? 'k' : 'p', st)
    if (black) p.solid(ell(x - rx * 0.32, y - ry * 0.85, rx * 0.26, ry * 0.2), 'p', st)
    else p.solid(`${ell(x, y - ry * 0.35, rx, ry)}${ell(x, y - ry * 0.35, rx - 1.1, ry - 1.1)}`, 'k ev', st)
    stones.push(st)
  }
  p.back()
  return {
    play(tl, at) {
      tl.fromTo(stones, { opacity: 0, scale: 0.3, transformOrigin: '50% 60%' }, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2.4)', stagger: 0.24 }, at - 0.4)
    },
  }
}

/** 2017 — a row of word-stones joined by vermilion attention arcs. */
const transformer: Picture = (p, A) => {
  ground(p, 140)
  const xs = [48, 116, 184, 252]
  const y = 222
  for (const [i, x] of xs.entries()) {
    p.solid(`M${x - 30} ${y + 2}Q${x - 29} ${y - 16} ${x - 2} ${y - 17}Q${x + 28} ${y - 16} ${x + 30} ${y + 1}Q${x + 28} ${y + 16} ${x} ${y + 16}Q${x - 29} ${y + 16} ${x - 30} ${y + 2}Z`, 'st')
    p.line(arc(x, y, 30, 16.5, 8, 176, 18), 3.2, { a: 0.1, b: 0.3 })
    p.line(arc(x, y, 30, 16.5, 190, 345, 16), 1.4, { a: 0.2, b: 0.3 })
    p.text(A.words[i] ?? '', x, y + 5, 15)
  }
  const arcs: SVGPathElement[] = []
  const pairs: [number, number, number][] = [[0, 1, 1.6], [1, 2, 2], [2, 3, 1.4], [0, 2, 1.3], [0, 3, 2.4], [1, 3, 5]]
  for (const [i, j, w] of pairs) {
    const a = xs[i] + 6
    const b = xs[j] - 6
    const top = 196 - (j - i) * 52
    const pts: Pt[] = Array.from({ length: 17 }, (_, k) => {
      const t = k / 16
      return [a + (b - a) * t, (1 - t) * (1 - t) * 204 + 2 * (1 - t) * t * top + t * t * 204]
    })
    arcs.push(p.line(pts, w, { cls: 'v', a: 0.3, b: 0.3, min: 0.25 }).el)
  }
  return {
    loop() {
      const tw = gsap.to(arcs, { opacity: 0.35, duration: 1.3, ease: 'sine.inOut', stagger: { each: 0.4, repeat: -1, yoyo: true } })
      return () => (tw.kill(), gsap.set(arcs, { opacity: 1 }))
    },
  }
}

/** 2020 — a huge brush writing line after line on a long scroll. */
const gpt3: Picture = (p) => {
  ground(p, 140)
  p.wash(poly(rect(34, 166, 232, 76)), 0.05)
  p.line([[34, 166], [266, 166]], 2.2, { a: 0.03, b: 0.03, min: 0.5 })
  p.line([[34, 242], [266, 242]], 2.2, { a: 0.03, b: 0.03, min: 0.5 })
  for (const x of [18, 264]) {
    p.wash(rrD(x, 156, 18, 96, 8), 0.22)
    p.line(rrPts(x, 156, 18, 96, 8), 3, { a: 0.05, b: 0.1 })
    p.line([[x + 9, 147], [x + 9, 156]], 3.2, S)
    p.line([[x + 9, 252], [x + 9, 261]], 3.2, S)
  }
  p.line(cursive(46, 188, 250, 6, 0), 2.1, { a: 0.03, b: 0.08, min: 0.45, wob: 0.35 })
  const row = p.line(cursive(46, 218, 206, 6, 2), 2.1, { a: 0.03, b: 0.08, min: 0.45, wob: 0.35, late: true })
  // the brush (tip at its own origin)
  const br = p.sub('translate(206 218)')
  p.solid('M0 0C-9 -10 -9 -28 -3 -38L11 -34C13 -22 8 -9 0 0Z')
  p.line([[-3, -38], [11, -34]], 4, S)
  p.line([[5, -40], [44, -176]], 9, { a: 0.02, b: 0.04, min: 0.7, wob: 0.02 })
  p.line([[16, -82], [26, -79]], 1.6, { ...S, cls: 'p' })
  p.line([[28, -124], [38, -121]], 1.6, { ...S, cls: 'p' })
  p.back()
  return {
    play(tl, at) {
      if (!row.m) return
      const path = row.m
      const L = path.getTotalLength()
      const o = { k: 0 }
      tl.fromTo(path, { strokeDashoffset: 1 }, { strokeDashoffset: 1, duration: 0.01 }, 0)
      tl.to(br, { x: 46, y: 216, duration: 0.7, ease: 'power2.inOut' }, at)
      tl.fromTo(o, { k: 0 }, {
        k: 1,
        duration: 2.6,
        ease: 'none',
        onUpdate: () => {
          path.style.strokeDashoffset = String(1 - o.k)
          const pt = path.getPointAtLength(o.k * L)
          gsap.set(br, { x: pt.x, y: pt.y })
        },
      }, at + 0.7)
    },
  }
}

/** 11/2022 — a conversation in ink: the person's words in pale wash, the AI's answers denser; the last one still typing. */
const chatgpt: Picture = (p) => {
  ground(p, 124)
  const bubble = (x: number, y: number, w: number, hgt: number, ai: boolean, rows: number[], seed: number) => {
    const r = Math.min(15, hgt / 2)
    const tail: Pt[] = ai ? [[x + w - 30, y + hgt - 1], [x + w - 6, y + hgt + 11], [x + w - 16, y + hgt - 2]] : [[x + 16, y + hgt - 2], [x + 6, y + hgt + 11], [x + 30, y + hgt - 1]]
    p.wash(rrD(x, y, w, hgt, r) + poly(tail), ai ? 0.2 : 0.07)
    p.line(rrPts(x, y, w, hgt, r), ai ? 2 : 1.6, { a: 0.06, b: 0.25, min: 0.3, cls: ai ? 'k' : 'k2' })
    p.line(tail, ai ? 1.8 : 1.5, { ...S, a: 0.1, b: 0.4, min: 0.3, cls: ai ? 'k' : 'k2' })
    rows.forEach((l, i) => p.line(cursive(x + 15, y + 17 + i * 12.5, x + 15 + l, 3, seed + i * 1.9), 1.4, { a: 0.03, b: 0.12, min: 0.4, wob: 0.3, cls: ai ? 'k' : 'k3' }))
  }
  bubble(26, 64, 128, 38, false, [92, 58], 0)
  bubble(100, 116, 174, 56, true, [138, 146, 84], 3)
  bubble(26, 188, 112, 30, false, [74], 7)
  bubble(184, 228, 90, 30, true, [], 0)
  const dots = [210, 229, 248].map((x) => p.solid(ell(x, 243, 3.4)))
  return {
    loop() {
      const tw = gsap.to(dots, { y: -5, duration: 0.35, ease: 'sine.inOut', stagger: { each: 0.15, repeat: -1, yoyo: true, repeatDelay: 0.3 } })
      return () => (tw.kill(), gsap.set(dots, { y: 0 }))
    },
  }
}

/** 2024 — scratch paper with numbered steps, a thinking cloud above. */
const reasoning: Picture = (p, A) => {
  ground(p, 130)
  p.wash(poly([[44, 94], [204, 86], [212, 256], [52, 264]]), 0.12)
  p.sub('rotate(-4 120 170)')
  p.solid(poly(rect(34, 86, 164, 170)), 'card')
  p.line(rect(34, 86, 164, 170), 2.2, { ...S, a: 0.03, b: 0.05 })
  ;[96, 74, 104].forEach((len, k) => {
    const y = 120 + k * 36
    p.text(A.steps[k] ?? '', 54, y + 6, 17)
    p.line(cursive(72, y, 72 + len, 4.5, k * 2), 1.8, { a: 0.04, b: 0.1, min: 0.45, wob: 0.3 })
  })
  p.line([[66, 226], [182, 224]], 2.2, { a: 0.05, b: 0.2 })
  p.line([[150, 238], [160, 248], [184, 224]], 3.8, { ...S, cls: 'm', a: 0.1, b: 0.4 })
  p.back()
  // the thinking cloud: overlapping washes, no outline; a flat underside, soft billows above
  for (const [cx, cy, rx, ry, op] of [[214, 72, 21, 16, 0.12], [237, 58, 26, 22, 0.1], [262, 68, 21, 17, 0.11], [238, 80, 42, 11, 0.1]]) p.wash(ell(cx, cy, rx, ry), op)
  p.wash(ell(198, 106, 7.5, 5.6), 0.3)
  p.wash(ell(186, 121, 4.8, 3.8), 0.36)
  p.solid(ell(177, 133, 2.3))
  const dots = [226, 240, 254].map((x) => p.solid(ell(x, 66, 3.1)))
  return {
    loop() {
      const tw = gsap.fromTo(dots, { opacity: 0.15 }, { opacity: 1, duration: 0.45, ease: 'sine.inOut', stagger: { each: 0.25, repeat: -1, yoyo: true, repeatDelay: 0.2 } })
      return () => (tw.kill(), gsap.set(dots, { opacity: 1 }))
    },
  }
}

/** 2025–2026 — a hand pushes one plug into a socket; threads run out to the tools, which wake one by one. */
const agents: Picture = (p) => {
  ground(p, 136)
  const C: Pt = [208, 143]
  // the tools, as small ink paintings: a brush, a book, a key, a lantern
  const at: Pt[] = [[222, 60], [270, 90], [276, 170], [232, 222]]
  const tools: SVGGElement[] = []
  const tool = (draw: (x: number, y: number) => void, [x, y]: Pt) => {
    tools.push(p.sub())
    draw(x, y)
    p.back()
  }
  tool((x, y) => {
    p.line([[x - 14, y - 14], [x + 4, y + 4]], 4.2, { ...S, a: 0.05, b: 0.12, min: 0.6 })
    p.line([[x + 2, y + 2], [x + 6.5, y + 6.5]], 6.4, { ...S, a: 0, b: 0, min: 1, wob: 0 })
    p.solid(`M${x + 5} ${y + 8}Q${x + 13} ${y + 7} ${x + 18} ${y + 19}Q${x + 7} ${y + 15} ${x + 4} ${y + 9}Z`)
  }, at[0])
  tool((x, y) => {
    p.wash(poly([[x - 13, y - 9], [x + 12, y - 12], [x + 14, y + 8], [x - 11, y + 11]]), 0.5)
    p.line([[x - 13, y - 9], [x - 11, y + 11]], 3.6, { ...S, a: 0.05, b: 0.1 })
    p.line([[x - 12, y - 9.5], [x + 12, y - 12]], 1.4, { ...S, a: 0.1, b: 0.3, cls: 'k2' })
    p.line([[x - 9, y + 13.5], [x + 15, y + 10.5]], 1.1, { ...S, a: 0.1, b: 0.2, cls: 'k3' })
    p.line([[x - 5, y - 3], [x + 6, y - 4.5]], 1.6, { ...S, a: 0.2, b: 0.2, min: 0.5, cls: 'p' })
  }, at[1])
  tool((x, y) => {
    p.wash(ell(x - 9, y, 7, 7), 0.25)
    p.line(arc(x - 9, y, 7, 7, 10, 370, 16), 2.8, { a: 0.1, b: 0.3 })
    p.line([[x - 2, y], [x + 15, y]], 3.2, { ...S, a: 0.05, b: 0.1, min: 0.7 })
    p.line([[x + 9, y], [x + 9, y + 6]], 2.6, { ...S, a: 0, b: 0.2, min: 0.7 })
    p.line([[x + 14, y], [x + 14, y + 7]], 2.6, { ...S, a: 0, b: 0.2, min: 0.7 })
  }, at[2])
  tool((x, y) => {
    p.line([[x, y - 20], [x, y - 13]], 1.2, { ...S, a: 0.1, b: 0.1, cls: 'k2' })
    p.wash(ell(x, y, 10.5, 13), 0.16)
    p.line(arc(x, y, 10.5, 13, 270, 450, 14), 2.2, { a: 0.2, b: 0.3 })
    p.line(arc(x, y, 10.5, 13, 90, 270, 14), 1.4, { a: 0.2, b: 0.3, cls: 'k2' })
    p.line(arc(x, y - 4, 10, 3, 10, 170, 10), 0.9, { a: 0.1, b: 0.1, cls: 'k3' })
    p.line(arc(x, y + 4, 10, 3, 10, 170, 10), 0.9, { a: 0.1, b: 0.1, cls: 'k3' })
    p.line([[x - 6, y - 13], [x + 6, y - 13]], 3.6, { ...S, a: 0, b: 0, min: 1 })
    p.line([[x - 6, y + 13], [x + 6, y + 13]], 3.6, { ...S, a: 0, b: 0, min: 1 })
  }, at[3])
  // threads from the socket: dry and faint until the plug goes in, then a live line runs out to each tool
  const threads = at.map(([x, y], i) => {
    const a = Math.atan2(y - C[1], x - C[0])
    const p0: Pt = [C[0] + 35 * Math.cos(a), C[1] + 35 * Math.sin(a)]
    const p1: Pt = [x - 19 * Math.cos(a), y - 19 * Math.sin(a)]
    const mid = lerp(p0, p1, 0.5)
    const bend: Pt = [mid[0] - Math.sin(a) * (i % 2 ? 5 : -5), mid[1] + Math.cos(a) * (i % 2 ? 5 : -5)]
    p.dry(brush([p0, bend, p1], 2.6, { a: 0.1, b: 0.3 }).d, 0.32)
    return p.line([p0, bend, p1], 1.7, { a: 0.1, b: 0.45, min: 0.3, cls: 'k2', late: true }).m
  }).filter((m): m is SVGPathElement => !!m)
  // the socket: an ensō with two slots on the side the plug comes from
  p.wash(ell(C[0], C[1], 27), 0.12)
  p.line(arc(C[0], C[1], 28, 28, -40, 296, 40), 5.2, { a: 0.06, b: 0.4, wob: 0.15 })
  p.solid(rrD(C[0] - 30, C[1] - 8.3, 11, 4.6, 2))
  p.solid(rrD(C[0] - 30, C[1] + 3.7, 11, 4.6, 2))
  const glow = p.live ? p.solid(ell(C[0] + 5, C[1], 6.5), 'v') : null
  // cable, plug and hand move as one; each has its own layer so the nearer one covers the farther
  const cable = p.sub()
  p.line([[114, 160], [118, 188], [110, 214], [92, 238], [62, 254], [26, 262]], 3.2, { a: 0.04, b: 0.5 })
  p.back()
  const plug = p.sub()
  p.wash(rrD(108, 127, 44, 32, 7), 0.28)
  p.line(rrPts(108, 127, 44, 32, 7), 2.2, { a: 0.05, b: 0.15 })
  p.line([[152, C[1] - 6], [184, C[1] - 6]], 3.4, { ...S, a: 0, b: 0, min: 1, wob: 0 })
  p.line([[152, C[1] + 6], [184, C[1] + 6]], 3.4, { ...S, a: 0, b: 0, min: 1, wob: 0 })
  p.back()
  // the hand, in a few strokes: thumb along the top, three fingers curled over the plug, a forearm fading out
  const palm = p.sub()
  p.solid(blob([[96, 128], [118, 121], [138, 121], [143, 125], [129, 131], [128, 140], [128, 158], [121, 168], [104, 171], [94, 160]]), 'p')
  p.back()
  const hand = p.sub()
  p.wash(blob([[34, 162], [52, 147], [72, 133], [94, 124], [118, 120], [138, 121], [143, 125], [129, 131], [128, 140], [128, 158], [121, 168], [108, 171], [92, 173], [76, 182], [58, 196]]), 0.09)
  p.line([[32, 163], [52, 146.5], [72, 133], [94, 124], [118, 120.5], [136, 121], [142.5, 125]], 3, { a: 0.02, b: 0.3, min: 0.12, wob: 0.12 })
  p.line([[142, 126.5], [134, 129.5], [122, 130]], 1.5, { a: 0.1, b: 0.6, cls: 'k2' })
  p.line([[112, 131], [123, 133], [128, 138.5], [124.5, 145]], 2.4, { a: 0.15, b: 0.35 })
  p.line([[111, 146], [123, 147], [128, 152.5], [123.5, 158.5]], 2.2, { a: 0.15, b: 0.35 })
  p.line([[107, 160], [118, 161.5], [121, 166], [113, 171]], 2, { a: 0.15, b: 0.35 })
  p.line([[113, 171.5], [96, 173], [77, 182], [58, 197]], 2.6, { a: 0.05, b: 0.7, min: 0.08 })
  p.back()
  return {
    play(tl, t) {
      tl.set(threads, { strokeDashoffset: 1 }, 0)
      tl.fromTo([cable, plug, palm, hand], { x: -26 }, { x: 0, duration: 1, ease: 'power3.inOut' }, t - 0.2)
      if (glow) tl.fromTo(glow, { opacity: 0, scale: 0.4, svgOrigin: `${C[0] + 5} ${C[1]}` }, { opacity: 1, scale: 1, svgOrigin: `${C[0] + 5} ${C[1]}`, duration: 0.6, ease: 'back.out(2)' }, t + 0.75)
      tl.fromTo(threads, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.7, ease: 'power2.out', stagger: 0.18 }, t + 0.95)
      tl.fromTo(tools, { opacity: 0.35 }, { opacity: 1, duration: 0.6, stagger: 0.18 }, t + 1.2)
    },
  }
}

export const VIGNETTES: Picture[] = [turing, dartmouth, winter, deepblue, alexnet, alphago, transformer, gpt3, chatgpt, reasoning, agents]
