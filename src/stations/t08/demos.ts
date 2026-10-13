import { s } from '../../core/dom'
import { arc, brush, clamp, ell, lerp, path, poly, rng, smooth, type Pt } from './kit'

/** Tiny animated ink demos, one per concept (320 × 180, a 16:9 screen). update(t) takes seconds. */
export interface Demo {
  root: SVGGElement
  update(t: number): void
  /** the moment shown when motion is reduced */
  still: number
}
export const SW = 320
export const SH = 180

const text = (str: string, x: number, y: number, size: number, cls = 'k2', anchor = 'middle') =>
  s('text', { x, y, 'font-size': size, class: `t08-svgt ${cls}`, 'text-anchor': anchor }, str)

// ───────── shared motifs ─────────

/** Distant ridges + water line, static. */
export function landscape(g: SVGGElement, seed: number, w = SW, horizon = 118) {
  const r = rng(seed)
  for (const [base, amp, op] of [[horizon - 10, 34, 0.1], [horizon - 2, 22, 0.16]] as const) {
    const pts: Pt[] = [[-10, horizon + 4]]
    for (let x = -10; x <= w + 10; x += 14) pts.push([x, base - amp * (0.35 + 0.65 * Math.abs(Math.sin(x * 0.012 + seed + r() * 0.3))) * (0.7 + r() * 0.3)])
    pts.push([w + 10, horizon + 4])
    g.append(path(poly(pts), 'k', { 'fill-opacity': op, filter: 'url(#ink-wash)' }))
  }
  g.append(path(brush([[-4, horizon + 2], [w * 0.5, horizon + 3], [w + 4, horizon + 1]], 1.6, { a: 0.1, b: 0.2, min: 0.4 }), 'k3'))
  for (let i = 0; i < 4; i++) {
    const y = horizon + 14 + i * 12
    const x0 = 20 + r() * (w * 0.6)
    g.append(path(brush([[x0, y], [x0 + 40 + r() * 70, y + 0.5]], 1.4 - i * 0.2, { a: 0.2, b: 0.4, min: 0.3 }), 'k3', { 'fill-opacity': 0.6 }))
  }
}

/** A crane in flight, heading right: long neck, trailing legs, two broad tapered wings that beat with `fl` (−1…1). */
export function craneD(x: number, y: number, sc: number, fl: number) {
  const P = (dx: number, dy: number): Pt => [x + dx * sc, y + dy * sc]
  const far = brush([P(0.5, -0.5), P(-2.2, -3.6 - 3.6 * fl), P(-6.5, -6.8 - 6.4 * fl)], 2.3 * sc, { a: 0.06, b: 0.75, min: 0.1, wob: 0.15 })
  const near = brush([P(1.4, 0), P(-1.6, -3.4 - 4.6 * fl), P(-8.6, -6.2 - 8.6 * fl)], 3.1 * sc, { a: 0.06, b: 0.75, min: 0.1, wob: 0.15 })
  const body = brush([P(-6, 0.9), P(-1, 0.3), P(4, -0.5)], 2.5 * sc, { a: 0.3, b: 0.35, min: 0.3 })
  const neck = brush([P(3.4, -0.5), P(7.6, -1.3), P(11.6, -1.8)], 0.95 * sc, { a: 0.04, b: 0.06, min: 0.65 })
  const head = ell(x + 12.1 * sc, y - 1.9 * sc, 0.95 * sc, 0.75 * sc)
  const beak = brush([P(12.6, -1.8), P(15.6, -1.2)], 0.55 * sc, { a: 0, b: 0.85, min: 0.15, straight: true })
  const tail = brush([P(-5, 0.7), P(-8.2, 1.5)], 1.7 * sc, { a: 0.1, b: 0.7, min: 0.2 })
  const legs = brush([P(-5, 1), P(-14.5, 2.3)], 0.5 * sc, { a: 0, b: 0.4, min: 0.6, straight: true }) + brush([P(-5, 1.2), P(-13.8, 3)], 0.45 * sc, { a: 0, b: 0.4, min: 0.6, straight: true })
  return far + body + near + neck + head + beak + tail + legs
}

export interface Pose {
  x: number
  /** hip height (y of the hip joint) */
  y: number
  s: number
  lean: number
  /** arm angles from straight down (rad, + = forward / outward to the figure's front), elbow bend */
  aL: [number, number]
  aR: [number, number]
  /** thigh angle from straight down, knee bend */
  lL: [number, number]
  lR: [number, number]
}

function joints(p: Pose) {
  const U = (a: number, len: number, o: Pt): Pt => [o[0] + Math.sin(a) * len * p.s, o[1] + Math.cos(a) * len * p.s]
  const hip: Pt = [p.x, p.y]
  const neck: Pt = [p.x + p.lean * p.s, p.y - 0.42 * p.s]
  const head: Pt = [neck[0] + p.lean * 0.3 * p.s, neck[1] - 0.12 * p.s]
  const eL = U(p.aL[0], 0.19, neck)
  const hL = U(p.aL[0] + p.aL[1], 0.18, eL)
  const eR = U(p.aR[0], 0.19, neck)
  const hR = U(p.aR[0] + p.aR[1], 0.18, eR)
  const kL = U(p.lL[0], 0.23, hip)
  const fL = U(p.lL[0] - p.lL[1], 0.23, kL)
  const kR = U(p.lR[0], 0.23, hip)
  const fR = U(p.lR[0] - p.lR[1], 0.23, kR)
  return { hip, neck, head, eL, hL, eR, hR, kL, fL, kR, fR }
}

/** The recurring character: a walker in a nón lá (conical hat) and a long robe, a vermilion scarf. */
export function character() {
  const g = s('g')
  const shadow = path('', 'k', { 'fill-opacity': 0.1 })
  const back = path('', 'k2')
  const robe = path('', 'k2', { 'fill-opacity': 0.5 })
  const front = path('', 'k')
  const scarf = path('', 'v')
  const face = path('', 'face')
  const hat = path('', 'hat')
  const hatLine = path('', 'k')
  g.append(shadow, back, robe, front, face, scarf, hat, hatLine)
  return {
    g,
    draw(p: Pose) {
      const J = joints(p)
      const w = p.s
      const ground = Math.max(J.fL[1], J.fR[1]) + 0.01 * w
      shadow.setAttribute('d', ell(p.x, ground, 0.22 * w, 0.03 * w))
      // far limbs first (lighter), then the robe, then the near limbs
      back.setAttribute('d', brush([J.hip, J.kR, J.fR], 0.07 * w, { a: 0.05, b: 0.1, min: 0.6 }) + brush([J.neck, J.eR, J.hR], 0.06 * w, { a: 0.05, b: 0.2, min: 0.5 }))
      const sh = 0.085 * w
      const hem = 0.13 * w
      const hy = J.hip[1] + 0.2 * w
      const sway = (J.kL[0] - J.kR[0]) * 0.25
      robe.setAttribute('d', poly([[J.neck[0] - sh, J.neck[1] + 0.03 * w], [J.neck[0] + sh, J.neck[1] + 0.03 * w], [J.hip[0] + 0.07 * w, J.hip[1]], [J.hip[0] + hem + sway, hy], [J.hip[0] - hem + sway, hy + 0.01 * w], [J.hip[0] - 0.07 * w, J.hip[1]]]))
      front.setAttribute('d', brush([J.hip, J.kL, J.fL], 0.075 * w, { a: 0.05, b: 0.1, min: 0.6 }) + brush([J.neck, J.eL, J.hL], 0.065 * w, { a: 0.05, b: 0.2, min: 0.5 }) + brush([[J.neck[0] - sh, J.neck[1] + 0.03 * w], [J.hip[0] - 0.07 * w, J.hip[1]], [J.hip[0] - hem + sway, hy + 0.01 * w]], 0.025 * w, { a: 0.1, b: 0.3, min: 0.4 }))
      face.setAttribute('d', ell(J.head[0], J.head[1] + 0.02 * w, 0.045 * w, 0.05 * w))
      scarf.setAttribute('d', brush([[J.neck[0] + 0.05 * w, J.neck[1] + 0.01 * w], [J.neck[0] - 0.06 * w, J.neck[1] + 0.02 * w], [J.neck[0] - 0.16 * w - p.lean * 0.4 * w, J.neck[1] + 0.07 * w]], 0.045 * w, { a: 0.1, b: 0.5, min: 0.25 }))
      const hc: Pt = [J.head[0], J.head[1] - 0.02 * w]
      const hw = 0.17 * w
      hat.setAttribute('d', poly([[hc[0] - hw, hc[1] + 0.005 * w], [hc[0], hc[1] - 0.13 * w], [hc[0] + hw, hc[1] + 0.005 * w], [hc[0], hc[1] + 0.03 * w]]))
      hatLine.setAttribute('d', brush([[hc[0] - hw, hc[1] + 0.005 * w], [hc[0], hc[1] + 0.028 * w], [hc[0] + hw, hc[1] + 0.005 * w]], 0.022 * w, { a: 0.1, b: 0.1, min: 0.5 }) + brush([[hc[0] - hw * 0.94, hc[1]], [hc[0], hc[1] - 0.128 * w], [hc[0] + hw * 0.4, hc[1] - 0.075 * w]], 0.016 * w, { a: 0.05, b: 0.4, min: 0.3, straight: true }))
    },
  }
}

/** A thin reference skeleton (the motion sample). */
function skeleton() {
  const g = s('g')
  const bones = path('', 'k3')
  const dots = path('', 'k3')
  g.append(bones, dots)
  return {
    g,
    J: null as ReturnType<typeof joints> | null,
    draw(p: Pose) {
      const J = joints(p)
      this.J = J
      const w = 0.022 * p.s
      const o = { a: 0, b: 0, min: 1, straight: true }
      bones.setAttribute('d', [[J.hip, J.neck], [J.neck, J.eL, J.hL], [J.neck, J.eR, J.hR], [J.hip, J.kL, J.fL], [J.hip, J.kR, J.fR]].map((pts) => brush(pts as Pt[], w, o)).join(''))
      dots.setAttribute('d', ell(J.head[0], J.head[1], 0.055 * p.s) + [J.eL, J.hL, J.eR, J.hR, J.kL, J.kR, J.hip].map(([x, y]) => ell(x, y, 0.025 * p.s)).join(''))
    },
  }
}

export function walkPose(x: number, y: number, sc: number, ph: number): Pose {
  const sw = Math.sin(ph)
  return { x, y: y - Math.abs(Math.cos(ph)) * 0.015 * sc, s: sc, lean: 0.03, aL: [-0.35 * sw, -0.25], aR: [0.35 * sw, -0.25], lL: [0.42 * sw, Math.max(0, -Math.cos(ph)) * 0.5 + 0.05], lR: [-0.42 * sw, Math.max(0, Math.cos(ph)) * 0.5 + 0.05] }
}

/** "Cloud hands": a slow tai-chi phrase. */
function taiChi(x: number, y: number, sc: number, ph: number): Pose {
  const a = 0.5 + 0.5 * Math.sin(ph)
  const b = 0.5 + 0.5 * Math.sin(ph + Math.PI)
  const dip = 0.5 + 0.5 * Math.sin(ph * 2)
  return { x: x + Math.sin(ph) * 0.05 * sc, y: y + dip * 0.04 * sc, s: sc, lean: -0.04 * Math.sin(ph), aL: [-0.5 - 1.6 * a, 0.9 * a + 0.2], aR: [0.5 + 1.6 * b, -0.9 * b - 0.2], lL: [-0.3, 0.2 + dip * 0.3], lR: [0.3, 0.2 + dip * 0.3] }
}

// ───────── 1 · text → video ─────────
function textToVideo(words: string[]): Demo {
  const root = s('g')
  const scene = s('g')
  landscape(scene, 3)
  const sun = path(ell(236, 64, 15), 'v', { 'fill-opacity': 0.88 })
  const reed = path(brush([[30, 180], [34, 140], [40, 116]], 2.2, { a: 0.1, b: 0.5 }) + brush([[42, 180], [44, 150], [52, 128]], 1.8, { a: 0.1, b: 0.6 }), 'k2')
  const bird = path('', 'k')
  scene.prepend(sun)
  scene.append(reed, bird)
  const r = rng(11)
  const noise = s('g')
  const dots = Array.from({ length: 150 }, () => {
    const d = s('circle', { cx: (r() * SW).toFixed(1), cy: (r() * SH).toFixed(1), r: (0.8 + r() * 1.8).toFixed(1), class: r() < 0.05 ? 'v' : r() < 0.5 ? 'k' : 'k3' })
    noise.append(d)
    return { d, end: 2.8 + r() * 1.8 }
  })
  const prompt = text('', 160, 96, 13, 'k')
  const caret = path('', 'v')
  root.append(scene, noise, prompt, caret)
  const full = words[0] ?? ''
  return {
    root,
    still: 6,
    update(t) {
      t %= 8
      const typed = Math.floor(clamp((t - 0.2) / 1.6) * full.length)
      prompt.textContent = full.slice(0, typed)
      prompt.setAttribute('opacity', String(1 - smooth(2.1, 2.7, t)))
      prompt.setAttribute('transform', `translate(0 ${(-8 * smooth(2.1, 2.7, t)).toFixed(1)})`)
      const w = (prompt.getComputedTextLength?.() || typed * 6.2) / 2
      caret.setAttribute('d', t < 2.1 && Math.floor(t * 3) % 2 === 0 ? `M${160 + w + 2} 85h1.6v14h-1.6Z` : '')
      // the grain arrives, then thins out as the picture appears
      const inA = smooth(1.9, 2.6, t)
      for (const { d, end } of dots) d.setAttribute('opacity', (inA * (1 - smooth(end - 0.4, end, t)) * (1 - smooth(7.4, 8, t))).toFixed(2))
      scene.setAttribute('opacity', (smooth(2.9, 4.4, t) * (1 - smooth(7.4, 8, t))).toFixed(2))
      const u = clamp((t - 3.6) / 4)
      bird.setAttribute('d', craneD(lerp(-20, 340, u), 70 + Math.sin(u * Math.PI) * -14, 1.8, Math.sin(t * 7)))
    },
  }
}

// ───────── 2 · image → video ─────────
function imageToVideo(words: string[]): Demo {
  const root = s('g')
  const photo = s('g', { transform: 'rotate(-4 58 86)' })
  photo.append(
    path('M16 26H100V130H16Z', 'card'),
    path(brush([[16, 26], [100, 26], [100, 130], [16, 130], [16, 26]], 1.6, { a: 0.02, b: 0.04, min: 0.6, straight: true }), 'k2'),
    path('M22 32H94V112H22Z', 'k', { 'fill-opacity': 0.06 }),
  )
  const still = character()
  still.draw({ x: 58, y: 80, s: 62, lean: 0, aL: [-0.15, -0.1], aR: [0.15, 0.1], lL: [-0.08, 0.02], lR: [0.08, 0.02] })
  photo.append(still.g, text(words[0] ?? '', 58, 124, 9.5, 'k2'))
  const arrow = path(brush([[110, 84], [130, 81], [148, 84]], 2.2, { a: 0.1, b: 0.1, min: 0.4 }) + brush([[141, 78], [148, 84], [141, 90]], 1.8, { a: 0.1, b: 0.1, min: 0.4, straight: true }), 'k3')
  const ground = path(brush([[156, 150], [236, 151], [316, 149]], 1.4, { a: 0.1, b: 0.3, min: 0.4 }), 'k3')
  const hill = path(poly([[150, 152], [190, 120], [222, 108], [262, 120], [320, 104], [320, 152]]), 'k', { 'fill-opacity': 0.06, filter: 'url(#ink-wash)' })
  const sun = path(ell(282, 52, 12), 'v', { 'fill-opacity': 0.8 })
  const walker = character()
  root.append(hill, sun, ground, photo, arrow, walker.g)
  return {
    root,
    still: 1.2,
    update(t) {
      const u = (t % 6) / 6
      const x = lerp(176, 300, u)
      walker.draw(walkPose(x, 116, 72, t * 5.2))
      walker.g.setAttribute('opacity', (smooth(0, 0.08, u) * (1 - smooth(0.9, 1, u))).toFixed(2))
    },
  }
}

// ───────── 3 · first & last frame ─────────
function lotus(o: number, cx: number, cy: number, sc: number) {
  // o: 0 = closed bud, 1 = open flower
  let d = ''
  const petals: [number, number, number][] = [[-1, 0.95, 0.9], [1, 0.95, 0.9], [-0.55, 1, 1], [0.55, 1, 1], [0, 1.05, 1]]
  for (const [side, len, wk] of petals) {
    const a = side * (0.12 + 1.0 * o)
    const L = 30 * len * sc * (0.85 + 0.15 * o)
    const W = 8.5 * wk * sc * (0.75 + 0.5 * o)
    const tip: Pt = [cx + Math.sin(a) * L, cy - Math.cos(a) * L]
    const nx = Math.cos(a)
    const ny = Math.sin(a)
    const m1: Pt = [cx + Math.sin(a) * L * 0.5 + nx * W, cy - Math.cos(a) * L * 0.5 + ny * W]
    const m2: Pt = [cx + Math.sin(a) * L * 0.5 - nx * W, cy - Math.cos(a) * L * 0.5 - ny * W]
    d += `M${cx} ${cy}Q${m1[0].toFixed(1)} ${m1[1].toFixed(1)} ${tip[0].toFixed(1)} ${tip[1].toFixed(1)}Q${m2[0].toFixed(1)} ${m2[1].toFixed(1)} ${cx} ${cy}Z`
  }
  return d
}
function firstLast(words: string[]): Demo {
  const root = s('g')
  const water = path(brush([[40, 104], [160, 106], [280, 104]], 1.4, { a: 0.1, b: 0.2 }), 'k3')
  const pad = path(ell(132, 104, 30, 6), 'm', { 'fill-opacity': 0.45, filter: 'url(#ink-wash)' })
  const stem = path(brush([[160, 106], [161, 86], [160, 68]], 2.4, { a: 0.1, b: 0.1, min: 0.5 }), 'm')
  const flowerFill = path('', 'v', { 'fill-opacity': 0.22 })
  const flowerLine = path('', 't08-line')
  root.append(water, pad, stem, flowerFill, flowerLine)
  // the strip: six frames; the first and last are given, the four between are painted in
  const cells: { g: SVGGElement }[] = []
  for (let i = 0; i < 6; i++) {
    const x = 54 + i * 37
    const g = s('g')
    const f = path(lotus(i / 5, x + 15, 152, 0.36), 'v', { 'fill-opacity': 0.22 })
    g.append(path(`M${x} 128H${x + 30}V160H${x}Z`, 'card'), f, path(brush([[x, 128], [x + 30, 128], [x + 30, 160], [x, 160], [x, 128]], i === 0 || i === 5 ? 1.8 : 1, { a: 0, b: 0, min: 1, straight: true }), i === 0 || i === 5 ? 'k' : 'k3'))
    root.append(g)
    cells.push({ g })
  }
  const head = path('', 'v')
  const lab = [text(words[0] ?? '', 69, 174, 9.5, 'k'), text(words[1] ?? '', 254, 174, 9.5, 'k'), text(words[2] ?? '', 161, 116, 9.5, 'k3')]
  const brace = path(brush([[94, 126], [96, 121.5], [226, 121.5], [228, 126]], 1, { a: 0.1, b: 0.1, min: 0.5 }), 'k3')
  root.append(brace, ...lab, head)
  return {
    root,
    still: 5.2,
    update(t) {
      t %= 7
      // the in-betweens appear one by one (painted by the AI)
      for (let i = 1; i < 5; i++) cells[i].g.setAttribute('opacity', (smooth(0.4 + i * 0.4, 0.8 + i * 0.4, t) * (1 - smooth(6.5, 7, t)) * 0.9 + 0.1 * (1 - smooth(6.5, 7, t))).toFixed(2))
      brace.setAttribute('opacity', smooth(0.3, 0.8, t).toFixed(2))
      lab[2].setAttribute('opacity', smooth(0.3, 0.8, t).toFixed(2))
      // then the clip plays: bud → bloom
      const u = clamp((t - 2.6) / 3.4)
      const o = smooth(0, 1, u)
      const d = lotus(o, 160, 70, 1.25)
      flowerFill.setAttribute('d', d)
      flowerLine.setAttribute('d', d)
      const hx = 54 + 15 + u * 185
      head.setAttribute('d', t > 2.5 && t < 6.2 ? brush([[hx, 126], [hx, 162]], 1.6, { a: 0, b: 0, min: 1, straight: true }) : '')
    },
  }
}

// ───────── 4 · camera control ─────────
function cameraMove(words: string[]): Demo {
  const root = s('g')
  const world = s('g')
  const r = rng(7)
  // a panorama twice as wide as the screen
  for (const [base, amp, op] of [[112, 46, 0.09], [124, 30, 0.15]] as const) {
    const pts: Pt[] = [[-20, 190]]
    for (let x = -20; x <= 660; x += 16) pts.push([x, base - amp * Math.abs(Math.sin(x * 0.01 + base)) * (0.6 + r() * 0.4)])
    pts.push([660, 190])
    world.append(path(poly(pts), 'k', { 'fill-opacity': op, filter: 'url(#ink-wash)' }))
  }
  world.append(path(ell(120, 48, 14), 'v', { 'fill-opacity': 0.85 }))
  // a pine on a rock — the push-in target
  const px = 470
  world.append(
    path(`M${px - 40} 150C${px - 34} 128 ${px - 10} 122 ${px + 6} 126C${px + 26} 130 ${px + 40} 140 ${px + 44} 150Z`, 'k2', { 'fill-opacity': 0.75 }),
    path(brush([[px - 2, 128], [px + 4, 104], [px - 6, 84], [px + 2, 60]], 4.2, { a: 0.05, b: 0.2, min: 0.4 }), 'k'),
    path(brush([[px, 92], [px + 22, 86], [px + 40, 88]], 2.2, { a: 0.1, b: 0.5 }), 'k'),
    path(brush([[px - 3, 76], [px - 22, 70], [px - 38, 74]], 2, { a: 0.1, b: 0.5 }), 'k'),
  )
  for (const [cx, cy, rx] of [[px + 2, 58, 18], [px + 34, 84, 14], [px - 34, 70, 13], [px - 8, 44, 11]]) world.append(path(ell(cx, cy, rx, rx * 0.42), 'm', { 'fill-opacity': 0.62, filter: 'url(#ink-wash)' }))
  world.append(path(brush([[-20, 152], [320, 153], [660, 151]], 1.6, { a: 0.1, b: 0.1, min: 0.4 }), 'k3'))
  // a small pavilion on the left
  world.append(
    path(brush([[208, 128], [222, 118], [252, 118], [266, 128]], 2.4, { a: 0.1, b: 0.1, min: 0.4 }), 'k'),
    path(brush([[222, 122], [222, 150]], 1.6, { a: 0, b: 0, min: 1, straight: true }) + brush([[252, 122], [252, 150]], 1.6, { a: 0, b: 0, min: 1, straight: true }), 'k2'),
  )
  root.append(world)
  // viewfinder corners and the name of the move
  const c = 10
  const corners = [[12, 12, 1, 1], [308, 12, -1, 1], [12, 168, 1, -1], [308, 168, -1, -1]].map(([x, y, sx, sy]) => brush([[x, y + sy * c], [x, y], [x + sx * c, y]], 1.4, { a: 0, b: 0, min: 1, straight: true })).join('')
  root.append(path(corners, 'k2'), path(ell(24, 160 - 136, 2.6), 'v'))
  const label = text('', 34, 28, 10.5, 'k', 'start')
  root.append(label)
  const K = [
    { t: 0, x: 0, sc: 1 },
    { t: 2.6, x: -300, sc: 1 },
    { t: 3.2, x: -300, sc: 1 },
    { t: 5.2, x: -300, sc: 2.1 },
    { t: 5.8, x: -300, sc: 2.1 },
    { t: 7.6, x: 0, sc: 1 },
    { t: 8.2, x: 0, sc: 1 },
  ]
  return {
    root,
    still: 4.6,
    update(t) {
      t %= 8.2
      let i = 0
      while (i < K.length - 2 && t > K[i + 1].t) i++
      const a = K[i]
      const b = K[i + 1]
      const u = smooth(0, 1, clamp((t - a.t) / (b.t - a.t || 1)))
      const x = lerp(a.x, b.x, u)
      const sc = lerp(a.sc, b.sc, u)
      // pan, then push in about the pine (it sits at screen x 170 once panned)
      world.setAttribute('transform', `translate(170 100) scale(${sc.toFixed(3)}) translate(-170 -100) translate(${x.toFixed(1)} 0)`)
      const word = t < 2.9 ? words[0] : t < 5.5 ? words[1] : words[2]
      label.textContent = word ?? ''
    },
  }
}

// ───────── 5 · native audio ─────────
function nativeAudio(words: string[]): Demo {
  const root = s('g')
  const PERIOD = 2.4
  // a temple bell under a beam, struck by a swinging log
  root.append(
    path(brush([[96, 14], [160, 12], [224, 14]], 4, { a: 0.05, b: 0.05, min: 0.6 }), 'k'),
    path(brush([[160, 14], [160, 26]], 2, { a: 0, b: 0, min: 1, straight: true }), 'k2'),
  )
  const bell = s('g')
  bell.append(
    path('M143 36C143 28 150 25 160 25C170 25 177 28 177 36V72C181 74 184 77 184 80H136C136 77 139 74 143 72Z', 'k2', { 'fill-opacity': 0.85 }),
    path(brush([[146, 46], [174, 46]], 1, { a: 0.1, b: 0.1 }) + brush([[146, 62], [174, 62]], 1, { a: 0.1, b: 0.1 }), 'card', { 'fill-opacity': 0.5 }),
    path(ell(160, 70, 3), 'v'),
  )
  const log = s('g')
  log.append(path(brush([[100, 18], [98, 52]], 1, { a: 0, b: 0, min: 1, straight: true }) + brush([[112, 18], [110, 52]], 1, { a: 0, b: 0, min: 1, straight: true }), 'k3'), path('M92 52H130V60H92Z', 'k'))
  const rings = s('g')
  root.append(rings, bell, log)
  const ringEls = Array.from({ length: 3 }, () => {
    const p = path('', 'k3')
    rings.append(p)
    return p
  })
  // two tracks under one playhead: the picture and the sound
  const y1 = 108
  const y2 = 146
  root.append(text(words[0] ?? '', 24, y1 + 4, 10, 'k2', 'start'), text(words[1] ?? '', 24, y2 + 4, 10, 'k2', 'start'))
  const cells = s('g')
  const bars = s('g')
  root.append(cells, bars)
  const X0 = 60
  const X1 = 304
  const PX = 182
  const SPEED = 46
  const cellEls = Array.from({ length: 9 }, () => {
    const g = s('g')
    g.append(path(`M0 ${y1 - 10}H24V${y1 + 10}H0Z`, 'card'), path(brush([[0, y1 - 10], [24, y1 - 10], [24, y1 + 10], [0, y1 + 10], [0, y1 - 10]], 0.9, { a: 0, b: 0, min: 1, straight: true }), 'k3'), path(ell(12, y1 - 1, 3.4, 4.4), 'k2', { 'fill-opacity': 0.6 }))
    cells.append(g)
    return g
  })
  const N = 56
  const barEls = Array.from({ length: N }, () => {
    const b = s('rect', { width: 2.6, rx: 1.3, class: 'k2' })
    bars.append(b)
    return b
  })
  const hr = rng(5)
  const jit = Array.from({ length: N * 4 }, () => hr())
  const env = (tau: number) => {
    const k = tau - Math.floor(tau / PERIOD) * PERIOD
    return Math.exp(-k / 0.55)
  }
  const head = path(brush([[PX, y1 - 18], [PX, y2 + 16]], 1.6, { a: 0, b: 0, min: 1, straight: true }), 'v')
  root.append(path(`M${X0 - 4} ${y1 - 14}H${X0}V${y2 + 14}H${X0 - 4}Z`, 'card'), head)
  return {
    root,
    still: PERIOD * 0.06,
    update(t) {
      const k = t % PERIOD
      // the log swings back, then strikes at k = 0
      const sw = k < 0.12 ? 0 : -Math.sin(clamp((k - 0.12) / (PERIOD - 0.12)) * Math.PI) * 24
      log.setAttribute('transform', `translate(${sw.toFixed(1)} 0)`)
      bell.setAttribute('transform', `rotate(${(Math.exp(-k / 0.3) * Math.sin(k * 30) * 2).toFixed(2)} 160 25)`)
      ringEls.forEach((p, i) => {
        const u = clamp((k - i * 0.14) / 1.4)
        const R = 14 + u * 70
        p.setAttribute('d', u > 0 && u < 1 ? brush(arc(160, 52, R, R * 0.8, -150 + i * 20, -30 - i * 20, 20), 1.6 * (1 - u) + 0.3, { a: 0.2, b: 0.3, min: 0.3 }) + brush(arc(160, 52, R, R * 0.8, 30 + i * 20, 150 - i * 20, 20), 1.6 * (1 - u) + 0.3, { a: 0.2, b: 0.3, min: 0.3 }) : '')
        p.setAttribute('opacity', String(0.8 * (1 - u)))
      })
      const span = 28
      cellEls.forEach((g, i) => {
        let x = ((i * span - t * SPEED) % (span * 9) + span * 9) % (span * 9) + X0 - 8
        if (x > X1) x -= span * 9
        g.setAttribute('transform', `translate(${x.toFixed(1)} 0)`)
        g.setAttribute('opacity', x < X0 - 2 || x > X1 - 20 ? '0' : '1')
      })
      barEls.forEach((b, i) => {
        const x = X0 + (i / (N - 1)) * (X1 - X0)
        const tau = t + (x - PX) / SPEED
        const e = env(tau)
        // tau is negative left of the playhead early in the loop: wrap the index into range
        const L = jit.length
        const q = jit[(((i + Math.floor(tau * 12) * 7) % L) + L) % L]
        const hgt = 1.5 + e * 22 * (0.55 + 0.45 * q) + q * 2
        b.setAttribute('x', (x - 1.3).toFixed(1))
        b.setAttribute('y', (y2 - hgt / 2).toFixed(1))
        b.setAttribute('height', hgt.toFixed(1))
      })
    },
  }
}

// ───────── 6 · duration limit ─────────
function durationLimit(words: string[]): Demo {
  const root = s('g')
  const y = 96
  const X0 = 24
  const LIM = 150
  const GAP = 10
  root.append(path(`M${X0} ${y - 18}H300V${y + 18}H${X0}Z`, 'k', { 'fill-opacity': 0.03 }), path(brush([[X0, y + 26], [300, y + 26]], 1, { a: 0.05, b: 0.05, min: 0.6 }), 'k3'))
  const seg = (x0: number) => {
    const g = s('g')
    const fill = path('', 'card')
    const frames = path('', 'k3')
    const birds = path('', 'k2')
    const edge = path('', 'k2')
    g.append(fill, birds, frames, edge)
    root.append(g)
    return {
      g,
      set(len: number) {
        const x1 = x0 + len
        fill.setAttribute('d', `M${x0} ${y - 16}H${x1}V${y + 16}H${x0}Z`)
        let fd = ''
        let bd = ''
        for (let x = x0 + 21; x < x1; x += 21) fd += brush([[x, y - 16], [x, y + 16]], 0.7, { a: 0, b: 0, min: 1, straight: true })
        for (let x = x0; x + 20 < x1; x += 21) bd += craneD(x + 6 + ((x - x0) / 21) * 1.2, y - 2, 0.55, Math.sin(x * 0.5))
        frames.setAttribute('d', fd)
        birds.setAttribute('d', bd)
        edge.setAttribute('d', len > 2 ? brush([[x0, y - 16], [x1, y - 16]], 1.3, { a: 0, b: 0, min: 1, straight: true }) + brush([[x0, y + 16], [x1, y + 16]], 1.3, { a: 0, b: 0, min: 1, straight: true }) : '')
      },
    }
  }
  const s1 = seg(X0)
  const s2 = seg(LIM + GAP)
  const limit = path(brush([[LIM + 2, y - 30], [LIM + 3, y], [LIM + 2, y + 30]], 3.2, { a: 0.1, b: 0.3, min: 0.3 }), 'v')
  // the seam: a small "+" knot below the strip
  const sx = LIM + GAP / 2 + 1
  const stitch = s('g', null,
    path(ell(sx, y + 40, 8), 'card'),
    path(brush(arc(sx, y + 40, 8, 8, -80, 270, 20), 1, { a: 0.1, b: 0.1, min: 0.5 }), 'k3'),
    path(brush([[sx, y + 35], [sx, y + 45]], 1.5, { a: 0, b: 0, min: 1, straight: true }) + brush([[sx - 5, y + 40], [sx + 5, y + 40]], 1.5, { a: 0, b: 0, min: 1, straight: true }), 'k'))
  const l1 = text(words[0] ?? '', (X0 + LIM) / 2, y - 28, 10.5, 'k')
  const l2 = text(words[1] ?? '', LIM + GAP + 66, y - 28, 10.5, 'k2')
  root.append(limit, stitch, l1, l2)
  return {
    root,
    still: 5.8,
    update(t) {
      t %= 7.6
      // grows, hits the limit with a small recoil, then a second piece is stitched on
      const g1 = smooth(0, 1, clamp((t - 0.3) / 2.2))
      const bounce = t > 2.5 && t < 3.1 ? Math.sin(((t - 2.5) / 0.6) * Math.PI) * -4 : 0
      s1.set((LIM - X0) * g1 + bounce)
      limit.setAttribute('opacity', (0.25 + 0.75 * smooth(2.2, 2.6, t)).toFixed(2))
      l1.setAttribute('opacity', smooth(0.4, 1, t).toFixed(2))
      const g2 = smooth(0, 1, clamp((t - 3.6) / 2))
      s2.set(132 * g2)
      stitch.setAttribute('opacity', smooth(3.3, 3.7, t).toFixed(2))
      l2.setAttribute('opacity', smooth(3.6, 4.2, t).toFixed(2))
      root.setAttribute('opacity', (smooth(0, 0.3, t) * (1 - smooth(7.1, 7.6, t))).toFixed(2))
    },
  }
}

// ───────── 7 · motion reference ─────────
function motionRef(words: string[]): Demo {
  const root = s('g')
  root.append(
    path('M16 30H112V136H16Z', 'card'),
    path(brush([[16, 30], [112, 30], [112, 136], [16, 136], [16, 30]], 1.2, { a: 0, b: 0, min: 1, straight: true }), 'k3'),
    text(words[0] ?? '', 64, 152, 10, 'k2'),
    text(words[1] ?? '', 226, 170, 10, 'k'),
    path(brush([[150, 158], [226, 159], [302, 157]], 1.4, { a: 0.1, b: 0.3, min: 0.4 }), 'k3'),
    path(ell(226, 158, 50, 5), 'k', { 'fill-opacity': 0.05 }),
  )
  const ref = skeleton()
  const you = character()
  const thread = s('path', { class: 't08-thread' })
  root.append(ref.g, you.g, thread)
  return {
    root,
    still: 1.1,
    update(t) {
      const ph = t * 1.25
      ref.draw(taiChi(64, 92, 84, ph))
      const p = taiChi(226, 104, 112, ph)
      you.draw(p)
      // a faint vermilion thread joins the two leading hands: the same motion, a new body
      const J = ref.J!
      const Y = joints(p)
      thread.setAttribute('d', `M${J.hR[0].toFixed(1)} ${J.hR[1].toFixed(1)}Q${((J.hR[0] + Y.hR[0]) / 2).toFixed(1)} ${(Math.min(J.hR[1], Y.hR[1]) - 24).toFixed(1)} ${Y.hR[0].toFixed(1)} ${Y.hR[1].toFixed(1)}`)
    },
  }
}

export const DEMOS: Record<string, (words: string[]) => Demo> = {
  t2v: textToVideo,
  i2v: imageToVideo,
  ff: firstLast,
  cam: cameraMove,
  audio: nativeAudio,
  len: durationLimit,
  motion: motionRef,
}

/** Idle screen: the crane landscape resting in mist, waiting for a stone to be chosen. */
export function idleDemo(): Demo {
  const root = s('g')
  root.append(path(ell(232, 58, 15), 'v', { 'fill-opacity': 0.78 }))
  landscape(root, 9)
  const bird = path('', 'k', { 'fill-opacity': 0.85 })
  root.append(bird)
  // long soft mist bands drift across the ridges and the water
  const bands = ([[66, 26, 0.7, 0], [98, 18, 0.8, 2.1], [128, 22, 0.62, 4.2], [156, 16, 0.5, 1.3]] as const).map(([y, w, op, ph]) => {
    const p = path(brush([[-60, y + 2], [60, y - 3], [180, y + 1], [380, y - 2]], w, { a: 0.35, b: 0.35, min: 0.08, wob: 0.2 }), 'card', { 'fill-opacity': op, filter: 'url(#ink-wash)' })
    root.append(p)
    return { p, ph }
  })
  return {
    root,
    still: 3.5,
    update(t) {
      bands.forEach(({ p, ph }, i) => p.setAttribute('transform', `translate(${(Math.sin(t * 0.16 + ph) * 34 - i * 6).toFixed(1)} 0)`))
      const u = (t / 14 + 0.32) % 1
      bird.setAttribute('d', craneD(lerp(-30, 350, u), 78 - Math.sin(u * Math.PI) * 18, 1.5, Math.sin(t * 2.4) * 0.7))
      bird.setAttribute('opacity', (smooth(0, 0.06, u) * (1 - smooth(0.94, 1, u))).toFixed(2))
    },
  }
}
