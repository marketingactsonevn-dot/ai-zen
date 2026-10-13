import { nextId, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import { arc, brush, ell, poly, rect, rng, rrD, rrPts, type Picture, type Pt } from './brush'

/** Five concept pictures for "Phía trước" (300 × 300, centred). None of these has happened yet. */

const S = { straight: true }

/** 1 — an hourglass beside a screen of tasks: the sand runs, the sun crosses its arc of hours, tasks tick off. */
const agentHours: Picture = (p) => {
  p.wash(ell(160, 252, 146, 8), 0.08)
  // hourglass
  p.line([[26, 52], [114, 52]], 7, { a: 0.03, b: 0.06, min: 0.5 })
  p.line([[26, 250], [114, 250]], 7, { a: 0.03, b: 0.06, min: 0.5 })
  p.line([[34, 56], [34, 246]], 3, { a: 0.05, b: 0.1 })
  p.line([[106, 56], [106, 246]], 3, { a: 0.05, b: 0.1 })
  p.line([[48, 58], [50, 98], [64, 134], [70, 151], [64, 168], [50, 204], [48, 244]], 2.4, { a: 0.05, b: 0.05 })
  p.line([[92, 58], [90, 98], [76, 134], [70, 151], [76, 168], [90, 204], [92, 244]], 2.4, { a: 0.05, b: 0.05 })
  const sandTop = p.wash(poly([[53, 98], [87, 98], [74, 136], [66, 136]]), 0.55)
  const sandBot = p.wash(poly([[50, 246], [70, 214], [90, 246]]), 0.55)
  const stream = p.line([[70, 152], [70, 238]], 1.2, { a: 0, b: 0, min: 1, wob: 0, late: true }).el
  // the arc of hours above the screen
  const hc: Pt = [212, 118]
  p.line(arc(hc[0], hc[1], 70, 62, 196, 344, 30), 1.2, { a: 0.1, b: 0.1, min: 0.5, cls: 'k3' })
  for (let k = 0; k <= 6; k++) {
    const r = ((196 + (148 * k) / 6) * Math.PI) / 180
    p.line([[hc[0] + 64 * Math.cos(r), hc[1] + 56 * Math.sin(r)], [hc[0] + 76 * Math.cos(r), hc[1] + 68 * Math.sin(r)]], k % 3 ? 1.4 : 2.4, { ...S, a: 0.1, b: 0.4 })
  }
  const sun = p.live ? p.top(s('circle', { r: 5.5, class: 'k', cx: hc[0] - 70, cy: hc[1] })) : null
  // laptop with four tasks
  p.wash(rrD(142, 112, 140, 98, 6), 0.06)
  p.line(rrPts(142, 112, 140, 98, 6), 3, { a: 0.05, b: 0.1 })
  p.wash(poly([[132, 214], [292, 214], [302, 234], [122, 234]]), 0.16)
  p.line([[132, 214], [292, 214], [302, 234], [122, 234], [132, 214]], 2.6, { ...S, a: 0.03, b: 0.05 })
  const checks: SVGPathElement[] = []
  for (const [k, len] of [72, 88, 58, 80].entries()) {
    const y = 132 + k * 21
    p.line(rect(158, y - 6, 12, 12), 1.5, { ...S, a: 0.05, b: 0.05, min: 0.6 })
    p.line([[178, y], [178 + len, y]], 2.2, { a: 0.1, b: 0.3, min: 0.5, cls: 'k2' })
    const m = p.line([[159, y - 1], [163, y + 4], [172, y - 8]], 2.6, { ...S, cls: 'm', a: 0.1, b: 0.3, late: true }).m
    if (m) checks.push(m)
  }
  return {
    play(tl) {
      tl.set(checks, { strokeDashoffset: 1 }, 0)
      gsap.set(sandTop, { svgOrigin: '70 136' })
      gsap.set(sandBot, { svgOrigin: '70 246' })
    },
    loop() {
      const o = { a: 196 }
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.8 })
      tl.fromTo(sandTop, { scaleY: 1 }, { scaleY: 0.15, duration: 5.2, ease: 'none' }, 0)
      tl.fromTo(sandBot, { scaleY: 0.3 }, { scaleY: 1, duration: 5.2, ease: 'none' }, 0)
      tl.fromTo(o, { a: 196 }, {
        a: 344,
        duration: 5.2,
        ease: 'sine.inOut',
        onUpdate: () => {
          const r = (o.a * Math.PI) / 180
          sun?.setAttribute('cx', (hc[0] + 70 * Math.cos(r)).toFixed(1))
          sun?.setAttribute('cy', (hc[1] + 62 * Math.sin(r)).toFixed(1))
        },
      }, 0)
      tl.fromTo(checks, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.45, stagger: 1.2 }, 0.6)
      const flow = gsap.fromTo(stream, { opacity: 0.4 }, { opacity: 1, duration: 0.3, repeat: -1, yoyo: true })
      return () => (tl.kill(), flow.kill())
    },
  }
}

/** 2 — a flask with a spark of discovery. */
const inventor: Picture = (p) => {
  p.wash(ell(150, 250, 96, 7), 0.08)
  const body: Pt[] = [[132, 58], [132, 122], [86, 226], ...arc(100, 230, 14, 12, 160, 90, 6), [200, 242], ...arc(200, 230, 14, 12, 90, 20, 6), [168, 122], [168, 58]]
  p.wash(poly([[108, 180], [192, 180], [212, 228], [200, 242], [100, 242], [88, 228]]), 0.45, 'm')
  p.line(body, 3.4, { a: 0.03, b: 0.03 })
  p.line([[122, 56], [178, 56]], 3.6, { a: 0.04, b: 0.1 })
  p.line([[106, 180], [194, 180]], 1.6, { a: 0.1, b: 0.1, min: 0.5 })
  p.line([[140, 96], [158, 96]], 1.2, { ...S, cls: 'k3' })
  p.line([[140, 110], [152, 110]], 1.2, { ...S, cls: 'k3' })
  const bubbles = [[130, 226, 4], [152, 214, 3], [170, 228, 5], [146, 236, 2.6], [182, 212, 3]].map(([x, y, r]) => p.solid(ell(x, y, r), 'p'))
  const spark = p.sub()
  p.solid('M150 4L157 25L178 32L157 39L150 60L143 39L122 32L143 25Z', 'v')
  for (const a of [-150, -110, -70, -30]) {
    const r = (a * Math.PI) / 180
    p.line([[150 + 34 * Math.cos(r), 32 + 34 * Math.sin(r)], [150 + 46 * Math.cos(r), 32 + 46 * Math.sin(r)]], 2.2, { ...S, a: 0.1, b: 0.5 })
  }
  p.back()
  return {
    play(tl, at) {
      // set the origin once, at scale 1, so later scale tweens never shift the spark
      gsap.set(spark, { svgOrigin: '150 32' })
      tl.fromTo(spark, { scale: 0.2, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.8, ease: 'back.out(2.5)' }, at - 0.3)
    },
    loop() {
      const rise = gsap.fromTo(bubbles, { y: 0, opacity: 1 }, { y: -44, opacity: 0, duration: 2.4, ease: 'sine.in', stagger: { each: 0.5, repeat: -1 } })
      const glow = gsap.fromTo(spark, { scale: 1 }, { scale: 1.12, duration: 1.2, ease: 'sine.inOut', repeat: -1, yoyo: true })
      return () => (rise.kill(), glow.kill())
    },
  }
}

/** 3 — RSI: a spiral that tightens as it turns; the point running inward keeps speeding up, its trail stretching. */
const spiral: Picture = (p) => {
  const pts: Pt[] = []
  for (let t = 0; t <= Math.PI * 7; t += 0.12) {
    const r = 122 * Math.exp(-0.15 * t)
    pts.push([150 + r * Math.cos(t - Math.PI / 2), 150 + r * Math.sin(t - Math.PI / 2)])
  }
  const [ex, ey] = pts[pts.length - 1]
  // the whole spiral turns, so everything that rides it lives in the same turning group
  const g = p.sub()
  p.line(pts, 7, { a: 0.02, b: 0.85, min: 0.12, wob: 0.15 })
  p.line(pts.slice(2).map(([x, y]) => [x + 3, y + 3] as Pt), 1.4, { a: 0.1, b: 0.9, min: 0.2, cls: 'k3' })
  p.back()
  if (!p.live) return
  const c = brush(pts, 1).c // the same centreline the stroke is built on
  const bloom = s('circle', { r: 16, cx: ex, cy: ey, class: 'v', 'fill-opacity': 0.3, opacity: 0 })
  const trail = s('path', { d: c, class: 't3-trail' })
  const halo = s('circle', { r: 12, class: 'v', 'fill-opacity': 0.18 })
  const dot = s('circle', { r: 6, class: 'v' })
  const fx = s('g', null, bloom, trail, halo, dot)
  g.append(fx)
  p.fades.push(fx)
  let L = 0
  /** u = 0…1 in time; the point covers u³ of the way, so it is three times faster at the end than on average */
  const place = (u: number) => {
    L ||= trail.getTotalLength()
    const pos = u ** 3 * L
    const pt = trail.getPointAtLength(pos)
    for (const el of [dot, halo]) el.setAttribute('cx', pt.x.toFixed(1)), el.setAttribute('cy', pt.y.toFixed(1))
    dot.setAttribute('r', (6 - 3.2 * u).toFixed(2))
    const seg = Math.min(pos, L * (0.01 + 0.2 * u * u))
    trail.setAttribute('stroke-dasharray', `${seg.toFixed(1)} ${(L * 2).toFixed(0)}`)
    trail.setAttribute('stroke-dashoffset', (seg - pos).toFixed(1))
  }
  return {
    // the still picture (and the reduced-motion one): the point well inside, its trail long
    play: () => place(0.82),
    loop() {
      const o = { u: 0 }
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.5 })
      tl.fromTo([dot, halo, trail], { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0)
      tl.fromTo(o, { u: 0 }, { u: 1, duration: 4.2, ease: 'none', onUpdate: () => place(o.u) }, 0)
      // at the centre: a soft flash, then the loop begins again from the rim
      tl.fromTo(bloom, { opacity: 0.9, scale: 0.2, svgOrigin: `${ex} ${ey}` }, { opacity: 0, scale: 2, svgOrigin: `${ex} ${ey}`, duration: 1, ease: 'power2.out' }, 4.15)
      tl.to([dot, halo, trail], { opacity: 0, duration: 0.25 }, 4.15)
      // turning against its winding, the spiral seems to pour inward, tightening
      const turn = gsap.to(g, { rotation: -360, svgOrigin: '150 150', duration: 30, ease: 'none', repeat: -1 })
      return () => (tl.kill(), turn.kill())
    },
  }
}

/** 4 — AGI: one tree whose branches bear every kind of leaf — pine, bamboo, plum blossom, broad leaves: one mind, many skills. */
const agi: Picture = (p) => {
  const r = rng(12)
  p.wash(ell(150, 262, 104, 7), 0.1)
  p.line([[64, 262], [120, 258], [190, 260], [236, 257]], 1.8, { a: 0.2, b: 0.3, cls: 'k2' })
  // the trunk: one knotted stroke, bark in dry brush
  p.line([[146, 264], [153, 236], [144, 206], [151, 176], [146, 148], [153, 118], [150, 92]], 15, { a: 0.03, b: 0.75, min: 0.16, wob: 0.28 })
  p.dry(brush([[150, 254], [146, 214], [151, 176], [148, 146]], 6, { a: 0.1, b: 0.4 }).d, 0.5, 'p')
  const fan = (c: Pt, sz: number, a0: number, a1: number, n = 9) => {
    for (let k = 0; k < n; k++) {
      const a = ((a0 + ((a1 - a0) * k) / (n - 1) + (r() - 0.5) * 8) * Math.PI) / 180
      const len = sz * (0.75 + r() * 0.35)
      p.line([[c[0] + Math.cos(a) * 2, c[1] + Math.sin(a) * 2], [c[0] + Math.cos(a) * len, c[1] + Math.sin(a) * len]], 1.5, { ...S, a: 0.04, b: 0.8, min: 0.1, wob: 0 })
    }
  }
  // pine, low on the left
  p.line([[146, 206], [120, 196], [96, 201], [70, 189], [42, 193]], 6, { a: 0.03, b: 0.7, wob: 0.2 })
  for (const [c, sz] of [[[98, 196], 20], [[70, 184], 18], [[44, 188], 15]] as [Pt, number][]) {
    p.wash(ell(c[0], c[1] - sz * 0.3, sz * 1.15, sz * 0.55), 0.1)
    fan(c, sz, -172, -8)
  }
  // bamboo, low on the right: leaves pressed in and drawn out long
  p.line([[150, 178], [178, 171], [204, 175], [232, 164]], 5, { a: 0.03, b: 0.7, wob: 0.15 })
  for (const [x, y, angles] of [[204, 175, [58, 84, 112]], [232, 164, [16, 42, 70]], [178, 172, [96]]] as [number, number, number[]][]) {
    for (const [k, deg] of angles.entries()) {
      const a = (deg * Math.PI) / 180
      const len = 30 + ((k * 7) % 11)
      const bend = (k - 1) * 3
      p.line([[x, y], [x + Math.cos(a) * len * 0.5 - Math.sin(a) * bend, y + Math.sin(a) * len * 0.5 + Math.cos(a) * bend], [x + Math.cos(a) * len, y + Math.sin(a) * len]], 5.6, { a: 0.12, b: 0.85, min: 0.03, wob: 0.04 })
    }
  }
  // plum, high on the left: an angular branch and a few blossoms
  p.line([[147, 150], [126, 134], [110, 112], [86, 103], [72, 80]], 4.4, { ...S, a: 0.03, b: 0.6, wob: 0.2 })
  p.line([[110, 112], [104, 90], [108, 74]], 2.2, { ...S, a: 0.05, b: 0.6 })
  const blossoms: SVGElement[] = []
  for (const [x, y, k] of [[110, 110, 1], [86, 100, 0.9], [72, 80, 0.8], [104, 88, 0.75], [126, 132, 0.7]]) {
    for (let j = 0; j < 5; j++) {
      const a = (j / 5) * Math.PI * 2 + k
      blossoms.push(p.solid(ell(x + Math.cos(a) * 3.4 * k, y + Math.sin(a) * 3.4 * k, 2.8 * k), 'v'))
    }
    p.solid(ell(x, y, 1.2))
  }
  // broad leaves, high on the right, in moss
  p.line([[153, 124], [176, 106], [202, 98], [224, 76]], 4, { a: 0.03, b: 0.6, wob: 0.15 })
  for (const [x, y, dx, dy] of [[202, 98, 24, -8], [224, 76, 20, -16], [224, 77, 24, 6], [178, 106, 12, -22]]) {
    p.line([[x, y], [x + dx * 0.5, y + dy * 0.5 - 2], [x + dx, y + dy]], 13, { a: 0.4, b: 0.55, min: 0.02, wob: 0.05, cls: 'm' })
  }
  // one petal, always falling
  const petal = p.live ? p.top(s('path', { d: ell(0, 0, 2.6, 1.8), class: 'v', opacity: 0 })) : null
  return {
    play(tl, at) {
      tl.fromTo(blossoms, { scale: 0.2, opacity: 0, transformOrigin: '50% 50%' }, { scale: 1, opacity: 1, duration: 0.4, stagger: 0.03, ease: 'back.out(2)' }, at - 0.6)
    },
    loop() {
      if (!petal) return () => {}
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.2 })
      tl.fromTo(petal, { x: 108, y: 114, rotation: 0, opacity: 0 }, { opacity: 1, duration: 0.4 })
        .to(petal, { y: 256, duration: 5, ease: 'sine.in' }, 0)
        .to(petal, { x: 132, rotation: 260, duration: 5, ease: 'sine.inOut' }, 0)
        .to(petal, { opacity: 0, duration: 0.6 }, 4.4)
      return () => tl.kill()
    },
  }
}

/** 5 — ASI: a peak rising far above banks of soft mist, a single sun beside it. */
const asi: Picture = (p) => {
  p.wash(ell(242, 60, 30), 1, 'sun-glow')
  p.solid(ell(242, 60, 15), 'sun')
  // a massif with a shoulder: the summit, a saddle, a lower peak to the right
  const L: Pt[] = [[148, 34], [138, 52], [126, 78], [112, 100], [94, 116], [78, 138], [56, 160], [30, 184], [6, 204]]
  const R: Pt[] = [[148, 34], [158, 50], [170, 74], [186, 96], [198, 108], [212, 100], [224, 94], [238, 110], [258, 134], [280, 156], [300, 172]]
  p.wash(poly([...L, [6, 260], [300, 260], ...R.slice().reverse()]), 0.12)
  // the shadow faces (light comes from the left)
  p.wash(poly([[148, 34], [158, 50], [170, 74], [186, 96], [198, 108], [190, 150], [170, 210], [152, 260], [140, 140], [150, 80]]), 0.3)
  p.wash(poly([[224, 94], [238, 110], [258, 134], [280, 156], [300, 172], [300, 260], [236, 260], [230, 150]]), 0.22)
  // dry-brush texture down the shadow face
  p.dry(brush([[150, 42], [156, 80], [151, 114], [160, 152], [156, 196]], 13, { a: 0.06, b: 0.55 }).d, 0.34)
  p.dry(brush([[166, 70], [174, 104], [170, 140]], 8, { a: 0.1, b: 0.6 }).d, 0.26)
  p.dry(brush([[226, 100], [232, 128], [228, 160]], 7, { a: 0.1, b: 0.6 }).d, 0.22)
  // the crest, heavy at the summit and lifting off where the mist begins
  p.line(L, 6.8, { a: 0.02, b: 0.6, wob: 0.18 })
  p.line(R, 4.6, { a: 0.02, b: 0.5, wob: 0.18 })
  p.line([[148, 38], [151, 70], [146, 104], [154, 140]], 2, { a: 0.1, b: 0.6, cls: 'k2' })
  p.line([[120, 92], [114, 112], [104, 130]], 1.4, { a: 0.1, b: 0.6, cls: 'k3' })
  // banks of mist: paper drifting across, blurred soft, no outline
  const blur = nextId('t3c')
  const mist = p.top(s('g', { filter: `url(#${blur})`, class: 't3-mist' }))
  p.top(s('defs', null, s('filter', { id: blur, x: '-20%', y: '-60%', width: '140%', height: '220%' }, s('feGaussianBlur', { stdDeviation: 5 }))))
  const rr = rng(4)
  const bands = ([[-30, 210, 140, 16], [60, 330, 172, 20], [-30, 330, 212, 26], [-30, 330, 250, 40]] as const).map(([x0, x1, y, th]) => {
    const top: Pt[] = []
    const bot: Pt[] = []
    const ph = rr() * 6
    for (let x = x0; x <= x1; x += 6) {
      const u = (x - x0) / (x1 - x0)
      const e = Math.sin(Math.PI * u) ** 0.4
      top.push([x, y - th * e * (0.75 + 0.25 * Math.sin(x / 13 + ph) * Math.sin(x / 37 + ph))])
      bot.push([x, y + th * 0.6 * e])
    }
    const el = s('path', { d: poly([...top, ...bot.reverse()]), 'fill-opacity': 0.94 })
    mist.append(el)
    return el
  })
  if (p.live) p.fades.push(mist)
  return {
    loop() {
      const tw = gsap.to(bands, { x: (i) => [10, -12, 8, -6][i], duration: (i) => 7 + i * 2, ease: 'sine.inOut', repeat: -1, yoyo: true })
      return () => tw.kill()
    },
  }
}

export const CONCEPTS: Picture[] = [agentHours, inventor, spiral, agi, asi]
