import { fill, h, nextId, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { C } from './data'
import { rakeLines } from './garden'
import { afterFonts, blob, clamp, closed, f1, lerp, ring, shapeK, stableHeight, stroke, type Pt } from './ink'
import { octaves, liteInk } from '../../ui/ink'

type TL = ReturnType<typeof gsap.timeline>
interface Moment {
  g: SVGGElement
  /** the ground this moment stands on (raked sand stops there): centre and half width, in field units */
  hole: [number, number, number]
  /** the lowest ink of the picture, in field units (its name is written just below) */
  foot: number
  /** the story of this rule, added to a timeline (fromTo, so a replay starts clean) */
  play(tl: TL): void
  /** the end state, at once (reduced motion) */
  end(): void
  /** the quiet state before the visitor taps */
  rest(): void
}

/** the framing of every moment (drawn in a 160 × 112 field, cropped tight to the ground so the stones read large) */
const VB = { x: 14, y: 36, w: 136, h: 70 }
const RAD = Math.PI / 180
const sp = (v: number, p: number) => Math.sign(v) * Math.abs(v) ** p
const range = (a: number, b: number, n: number) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n)

/** stone silhouettes on a unit circle: river stone, flat stepping stone (hiraishi), upright (tateishi), arched */
type Kind = 'round' | 'flat' | 'tall' | 'arch'
const UNIT: Record<Kind, (a: number) => Pt> = {
  round: (a) => [Math.cos(a), Math.sin(a)],
  flat: (a) => [sp(Math.cos(a), 0.7), sp(Math.sin(a), 0.85)],
  tall: (a) => {
    const up = Math.max(0, -Math.sin(a))
    return [Math.cos(a) * (1 - 0.3 * up) + 0.14 * up * up, Math.sin(a) < 0 ? Math.sin(a) : sp(Math.sin(a), 0.55)]
  },
  arch: (a) => [sp(Math.cos(a), 0.8), Math.sin(a) < 0 ? Math.sin(a) : Math.sin(a) * 0.42],
}

/**
 * A garden stone in sumi-e: a soft shadow on the sand, the body, a pale lit face, a wash over the shaded half,
 * a few dry-brush marks, and one brush contour that presses along the shadow side and lifts off at both ends.
 */
function stone(cx: number, cy: number, rx: number, ry: number, seed: number, kind: Kind = 'round', cls = '') {
  const k = shapeK(seed, 0.09)
  const U = UNIT[kind]
  const P = (deg: number, f = 1): Pt => {
    const a = deg * RAD
    const [ux, uy] = U(a)
    return [cx + ux * rx * k(a) * f, cy + uy * ry * k(a) * f]
  }
  const along = (a0: number, a1: number, f = 1, n = 16) => range(a0, a1, n).map((d) => P(d, f))
  const m = Math.min(ry, rx * 0.8)
  const w = clamp(m * 0.17, 1.2, 3.4)
  const lowY = Math.max(...along(0, 180, 1, 12).map((p) => p[1]))
  const dry = [[15, 60, 0.72], [40, 95, 0.5]].map(([a, b, f], i) => s('path', { d: stroke([P(a, f), P((a + b) / 2, f + 0.06), P(b, f)], m * (0.2 - i * 0.05), { head: 0.25, tail: 0.5, min: 0.2 }) }))
  return s('g', { class: `t12r-stone ${cls}` },
    s('path', { class: 't12-st-shadow', d: blob(cx + rx * 0.14, lowY - Math.min(rx, ry) * 0.06, rx * 1.1, Math.max(1.8, Math.min(rx, ry) * 0.3), seed + 5, 0.1, 14) }),
    s('path', { class: 't12-st-base', d: closed(along(0, 360 - 360 / 22, 1, 21)) }),
    s('path', { class: 't12-st-hi', d: blob(cx - rx * 0.2 + (kind === 'tall' ? rx * 0.06 : 0), cy - ry * 0.34, rx * 0.5, ry * (kind === 'tall' ? 0.42 : 0.32), seed + 2, 0.18, 12) }),
    s('path', { class: 't12r-shade', d: closed([...along(-40, 165, 0.97, 14), [cx - rx * 0.2, cy + ry * 0.2], [cx + rx * 0.2, cy - ry * 0.05]]) }),
    s('g', { class: 't12r-dry', filter: 'url(#ink-dry)' }, ...dry),
    s('g', { class: 't12-st-ink', filter: 'url(#t12r-rough)' },
      s('path', { class: 't12-st-rim', d: stroke(along(-58, 170, 1 - w / (2.6 * m), 16), w, { head: 0.34, tail: 0.9, min: 0.04 }) }),
      s('path', { class: 't12-st-lit', d: stroke(along(196, 292, 0.99, 8), w * 0.3, { head: 0.3, tail: 0.6, min: 0.1 }) })))
}
/** A few dabs of moss at the foot of a stone. */
const mossAt = (cx: number, cy: number, w: number, seed: number) =>
  s('g', { class: 't12r-moss' }, ...[[-0.5, 0.1, 0.34], [0.05, 0.3, 0.42], [0.55, 0.05, 0.26]].map(([dx, dy, k], i) => s('path', { d: blob(cx + dx * w, cy + dy * w * 0.3, w * k, w * k * 0.32, seed + i, 0.25, 12) })))
const rings = (cx: number, cy: number, r0: number, n: number, seed: number, step = 0.24) =>
  Array.from({ length: n }, (_, k) => s('path', { class: 't12-ring', d: ring(cx, cy, r0 * (1 + k * step), r0 * (1 + k * step) * 0.34, 1.1, seed + k) }))
const so = (cx: number, cy: number) => `${f1(cx)} ${f1(cy)}`

// ── 1 · Nói rõ như giao việc cho người mới: a clear path of flat stepping stones appears, one by one, up to the tall stone.
function clear(): Moment {
  const steps = [[30, 97, 10], [52, 91.5, 8.8], [73, 86.5, 7.8]].map(([x, y, r], i) => stone(x, y, r, r * 0.38, 20 + i, 'flat', 't12r-flat'))
  const g = s('g', null, ...rings(110, 82, 25, 2, 11), mossAt(112, 82, 26, 12), stone(110, 61, 14, 21, 4, 'tall'), ...steps)
  return {
    g,
    hole: [84, 82, 62],
    foot: 102,
    play: (tl) => void tl.fromTo(steps, { opacity: 0, scale: 0.4, transformOrigin: '50% 60%' }, { opacity: 1, scale: 1, duration: 0.7, ease: 'back.out(2)', stagger: 0.32 }, 0.1),
    end: () => void gsap.set(steps, { opacity: 1, scale: 1 }),
    rest: () => void gsap.set(steps, { opacity: 0 }),
  }
}

// ── 2 · Cho ví dụ: a sample stone, and beside it its outline fills in with the very same shape.
function example(): Moment {
  const k = shapeK(7, 0.09)
  const ghostPts = range(0, 360 - 360 / 22, 21).map((d) => {
    const [ux, uy] = UNIT.arch(d * RAD)
    return [112 + ux * 21 * k(d * RAD), 68 + uy * 13 * k(d * RAD)] as Pt
  })
  const ghost = s('path', { class: 't12r-ghost', d: closed(ghostPts) })
  const copy = stone(112, 68, 21, 13, 7, 'arch')
  const arc = s('path', { class: 't12r-arc', d: `M${so(62, 52)}Q${so(86, 32)} ${so(106, 50)}`, pathLength: 1 })
  const head = s('path', { class: 't12r-arc-h', d: stroke([[101, 46], [106, 51], [99, 52.4]], 1.6, { head: 0.3, tail: 0.6, min: 0.3 }) })
  const g = s('g', null, ...rings(50, 72, 28, 2, 21), ...rings(112, 72, 27, 2, 23), stone(50, 68, 22, 13.5, 7, 'arch'), mossAt(46, 73, 22, 25), ghost, copy, arc, head)
  return {
    g,
    hole: [82, 72, 66],
    foot: 85,
    play: (tl) => {
      tl.fromTo(arc, { strokeDashoffset: 1, opacity: 1 }, { strokeDashoffset: 0, duration: 0.8, ease: 'power2.inOut' }, 0.1)
        .fromTo(head, { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.8)
        .fromTo(copy, { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' }, 0.85)
        .fromTo(ghost, { opacity: 1 }, { opacity: 0, duration: 0.6 }, 1.2)
    },
    end: () => void (gsap.set(arc, { strokeDashoffset: 0, opacity: 1 }), gsap.set([head, copy], { opacity: 1, y: 0 }), gsap.set(ghost, { opacity: 0 })),
    rest: () => void (gsap.set(arc, { strokeDashoffset: 1, opacity: 0 }), gsap.set([head, copy], { opacity: 0 }), gsap.set(ghost, { opacity: 1 })),
  }
}

// ── 3 · Chia việc lớn thành bước nhỏ: a crack runs through a boulder; it parts into three stones that climb.
function steps(): Moment {
  const big = stone(80, 64, 40, 20, 31, 'round')
  const crack = s('path', { class: 't12r-crack', d: stroke([[70, 46], [76, 56], [72, 64], [82, 74], [80, 83]], 2, { head: 0.1, tail: 0.5, min: 0.2 }) })
  const bigG = s('g', null, big, crack)
  const parts = [
    stone(44, 88, 15, 6.5, 41, 'flat'),
    stone(80, 74, 13, 8.5, 42, 'round'),
    stone(116, 58, 9, 14, 43, 'tall'),
  ]
  const g = s('g', null, ...rings(80, 70, 45, 2, 31, 0.2), bigG, ...parts)
  return {
    g,
    hole: [80, 72, 60],
    foot: 97,
    play: (tl) => {
      tl.fromTo(crack, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.in' }, 0.1)
        .fromTo(bigG, { opacity: 1, scale: 1, transformOrigin: '50% 60%' }, { opacity: 0, scale: 0.92, duration: 0.5, ease: 'power2.in' }, 0.75)
        .fromTo(parts, { opacity: 0, x: (i) => [36, 0, -36][i], y: (i) => [-22, -8, 7][i] }, { opacity: 1, x: 0, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.14 }, 0.8)
    },
    end: () => void (gsap.set(bigG, { opacity: 0 }), gsap.set(parts, { opacity: 1, x: 0, y: 0 })),
    rest: () => void (gsap.set(bigG, { opacity: 1, scale: 1 }), gsap.set(crack, { opacity: 0 }), gsap.set(parts, { opacity: 0 })),
  }
}

// ── 4 · Hỏi lại, lặp nhiều vòng: ring after ring is raked around the stone; a small light goes round each lap.
function loop(): Moment {
  const R = [26, 35, 44, 53]
  const rs = R.map((r, k) => s('path', { class: 't12-ring t12r-lap', d: ring(80, 66, r, r * 0.34, 1.25, 51 + k) }))
  const dot = s('circle', { class: 't12r-dot', cx: 80 + 53, cy: 66, r: 2.4 })
  const g = s('g', null, ...rs, mossAt(82, 72, 26, 53), stone(80, 63, 19, 12, 52, 'round'), dot)
  const lap = { a: 0 }
  const place = () => {
    const r = R[Math.min(3, Math.floor(lap.a / (Math.PI * 2)))]
    dot.setAttribute('cx', f1(80 + Math.cos(lap.a) * r))
    dot.setAttribute('cy', f1(66 + Math.sin(lap.a) * r * 0.34))
  }
  return {
    g,
    hole: [80, 66, 58],
    foot: 85,
    play: (tl) => {
      tl.fromTo(rs.slice(1), { opacity: 0, scale: 0.85, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.55, ease: 'power2.out', stagger: 0.55 }, 0.4)
        .fromTo(dot, { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0)
        .fromTo(lap, { a: 0 }, { a: Math.PI * 8 - 0.001, duration: 2.3, ease: 'power1.inOut', onUpdate: place }, 0)
        .to(dot, { opacity: 0, duration: 0.5 }, 2.2)
    },
    end: () => void (gsap.set(rs, { opacity: 1, scale: 1 }), gsap.set(dot, { opacity: 0 })),
    rest: () => void (gsap.set(rs.slice(1), { opacity: 0 }), gsap.set(dot, { opacity: 0 })),
  }
}

// ── 5 · Yêu cầu AI tự kiểm tra: a drop falls from the bamboo into the stone basin (tsukubai); the ripples
// break the moon's reflection, and as the water stills the pieces come together into one clear moon.
function check(): Moment {
  const bx = 70
  const ty = 70 // the basin's flat top face, seen from a little above
  const k = shapeK(61, 0.05)
  const T = (deg: number, f = 1): Pt => [bx + Math.cos(deg * RAD) * 31 * k(deg * RAD) * f, ty + Math.sin(deg * RAD) * 10.5 * k(deg * RAD) * f]
  const Bt = (deg: number, f = 1): Pt => [bx + Math.cos(deg * RAD) * 30 * k(deg * RAD) * f, ty + 10 + Math.sin(deg * RAD) * 9 * k(deg * RAD) * f]
  const outline = [...range(180, 360, 12).map((d) => T(d)), ...range(0, 180, 12).map((d) => Bt(d))]
  // the carved hollow and its water
  const hx = bx - 1
  const hy = ty - 0.3
  const H = (deg: number, f = 1): Pt => [hx + Math.cos(deg * RAD) * 15.5 * f, hy + Math.sin(deg * RAD) * 4.6 * f]
  const gid = nextId('t12r-w')
  const basin = s('g', null,
    s('path', { class: 't12-st-shadow', d: blob(bx + 4, ty + 19, 38, 5, 61, 0.1, 14) }),
    s('path', { class: 't12-st-base', d: closed(outline) }),
    s('path', { class: 't12r-shade', d: closed([...range(-5, 110, 8).map((d) => Bt(d)), ...range(110, -5, 8).map((d) => T(d, 0.98))]) }),
    s('path', { class: 't12-st-hi', d: closed(range(0, 345, 23).map((d) => T(d, 0.97))) }),
    s('g', { class: 't12r-dry', filter: 'url(#ink-dry)' },
      s('path', { d: stroke([Bt(20, 0.8), Bt(45, 0.86), Bt(75, 0.8)], 2.2, { head: 0.25, tail: 0.5, min: 0.2 }) }),
      s('path', { d: stroke([T(200, 0.62), T(235, 0.7), T(262, 0.62)], 1.6, { head: 0.25, tail: 0.5, min: 0.2 }) })),
    s('g', { class: 't12-st-ink', filter: 'url(#t12r-rough)' },
      s('path', { class: 't12r-edge', d: stroke(range(8, 172, 12).map((d) => T(d, 0.99)), 0.7, { head: 0.2, tail: 0.6, min: 0.2 }) }),
      s('path', { class: 't12-st-rim', d: stroke([...range(-38, 0, 3).map((d) => T(d, 0.99)), ...range(8, 166, 10).map((d) => Bt(d, 0.985))], 2.6, { head: 0.26, tail: 0.88, min: 0.04 }) }),
      s('path', { class: 't12-st-lit', d: stroke(range(188, 300, 8).map((d) => T(d, 0.99)), 0.75, { head: 0.3, tail: 0.6, min: 0.1 }) })),
    s('path', { class: 't12r-hollow', d: blob(hx, hy, 15.5, 4.6, 64, 0.04, 20) }),
    s('path', { class: 't12r-edge2', d: stroke(range(192, 348, 10).map((d) => H(d, 0.94)), 1.5, { head: 0.3, tail: 0.6, min: 0.15 }) }),
    s('defs', null, s('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, class: 't12r-w0' }), s('stop', { offset: 1, class: 't12r-w1' }))),
    s('path', { class: 't12r-water', fill: `url(#${gid})`, filter: 'url(#t12r-wash)', d: blob(hx, hy + 0.7, 13.6, 3.5, 63, 0.03, 20) }),
    s('path', { class: 't12r-lip', d: stroke(range(14, 166, 10).map((d) => H(d, 1.05)), 0.7, { head: 0.3, tail: 0.6, min: 0.15 }) }),
    mossAt(bx - 20, ty + 19, 16, 68),
    stone(bx - 44, 95, 8, 3.2, 66, 'flat', 't12r-flat'),
    stone(bx + 47, 93.5, 6.5, 2.8, 67, 'flat', 't12r-flat'))
  // the moon on the water: a thin crescent and two short glints under it (they part while the water moves)
  const mx = hx - 4.5
  const my = hy + 0.6
  const moonParts = [
    s('path', { d: stroke(range(105, 255, 10).map((d) => [mx + Math.cos(d * RAD) * 3.2, my + Math.sin(d * RAD) * 1.25] as Pt), 1.15, { head: 0.45, tail: 0.9, min: 0.05 }) }),
    s('path', { d: stroke([[mx - 3.6, my + 1.9], [mx - 1, my + 2], [mx + 1.6, my + 1.85]], 0.55, { head: 0.3, tail: 0.6, min: 0.2 }) }),
    s('path', { d: stroke([[mx - 2.4, my + 2.75], [mx - 0.8, my + 2.8]], 0.4, { head: 0.3, tail: 0.6, min: 0.2 }) }),
  ]
  const moon = s('g', { class: 't12r-moon' }, ...moonParts)
  // the bamboo spout (kakei): one tapered stroke that comes in from beyond the frame, two knuckles, a cut mouth
  const tip: Pt = [hx + 9, 61.4]
  const far: Pt = [158, 40.5]
  const cane: Pt[] = [far, [lerp(far[0], tip[0], 0.5), lerp(far[1], tip[1], 0.5) + 0.8], tip]
  const dx = tip[0] - far[0]
  const dy = tip[1] - far[1]
  const len = Math.hypot(dx, dy)
  const nx = -dy / len
  const ny = dx / len
  const on = (t: number): Pt => [far[0] + dx * t, far[1] + dy * t + Math.sin(t * Math.PI) * 0.8]
  const knuckle = (t: number, w: number, r: number) => {
    const [x, y] = on(t)
    return stroke([[x + nx * r, y + ny * r], [x + dx / len * 0.5, y + dy / len * 0.5], [x - nx * r, y - ny * r]], w, { head: 0.2, tail: 0.5, min: 0.3 })
  }
  const cid = nextId('t12r-c')
  const spout = s('g', { class: 't12r-bamboo' },
    s('defs', null, s('linearGradient', { id: cid, gradientUnits: 'userSpaceOnUse', x1: 151, y1: 42.2, x2: 134, y2: 46.6 }, s('stop', { offset: 0, class: 't12r-c0' }), s('stop', { offset: 1, class: 't12r-c1' }))),
    s('path', { class: 't12r-cane', fill: `url(#${cid})`, d: stroke(cane, 3.3, { head: 0.02, tail: 0.12, min: 0.78, wob: 0.03 }) }),
    s('path', { class: 't12r-cane-h', d: stroke([on(0.34), on(0.6), on(0.92)].map(([x, y]) => [x - nx * 0.7, y - ny * 0.7] as Pt), 0.6, { head: 0.3, tail: 0.6, min: 0.2 }) }),
    s('g', { filter: 'url(#t12r-rough)' },
      s('path', { class: 't12r-node', d: knuckle(0.4, 0.95, 2.3) }),
      s('path', { class: 't12r-node', d: knuckle(0.415, 0.45, 2) }),
      s('path', { class: 't12r-node', d: knuckle(0.74, 0.9, 2.2) }),
      s('path', { class: 't12r-node', d: knuckle(0.755, 0.42, 1.9) }),
      s('path', { class: 't12r-cut', d: blob(tip[0] - 0.2, tip[1] + 0.1, 0.75, 1.45, 70, 0.1, 10) })))
  const sx = tip[0] - 0.6
  const drop = s('path', { class: 't12r-drop', d: `M${so(sx, 62.4)}C${so(sx + 1.3, 64.6)} ${so(sx + 1.5, 65.9)} ${so(sx, 66.7)}C${so(sx - 1.5, 65.9)} ${so(sx - 1.3, 64.6)} ${so(sx, 62.4)}Z` })
  const clipId = nextId('t12r-clip')
  const wrings = [0, 1].map(() => s('ellipse', { class: 't12r-wring', cx: f1(sx), cy: f1(hy + 0.8), rx: 3, ry: 0.85 }))
  const water = s('g', { 'clip-path': `url(#${clipId})` }, s('defs', null, s('clipPath', { id: clipId }, s('path', { d: blob(hx, hy + 0.7, 13.6, 3.5, 63, 0.03, 20) }))), ...wrings, moon)
  const g = s('g', null, ...rings(bx, 86, 43, 2, 64, 0.2), basin, water, spout, drop)
  return {
    g,
    hole: [bx + 4, 86, 52],
    foot: 100,
    play: (tl) => {
      tl.fromTo(drop, { opacity: 0, scale: 0.4, transformOrigin: '50% 0%' }, { opacity: 1, scale: 1, duration: 0.45, ease: 'power1.out' }, 0)
        .to(drop, { y: 4.2, duration: 0.28, ease: 'power2.in' }, 0.55)
        .set(drop, { opacity: 0 }, 0.83)
        .fromTo(wrings, { opacity: 0.95, scale: 0.4, transformOrigin: '50% 50%' }, { opacity: 0, scale: 5.2, duration: 1.5, ease: 'power2.out', stagger: 0.32 }, 0.83)
        .fromTo(moonParts, { opacity: 0.55, x: (i) => [-2.2, 2.6, -1.4][i], y: (i) => [0.3, -0.4, 0.5][i] }, { opacity: 1, x: 0, y: 0, duration: 1.6, ease: 'power2.inOut', stagger: 0.08 }, 0.95)
        .fromTo(moon, { opacity: 0 }, { opacity: 1, duration: 0.9, ease: 'power1.out' }, 0.9)
    },
    end: () => void (gsap.set(drop, { opacity: 0 }), gsap.set(wrings, { opacity: 0 }), gsap.set(moon, { opacity: 1 }), gsap.set(moonParts, { opacity: 1, x: 0, y: 0 })),
    rest: () => void (gsap.set(drop, { opacity: 0 }), gsap.set(wrings, { opacity: 0 }), gsap.set(moon, { opacity: 0 })),
  }
}

// ── 6 · Không đưa dữ liệu nhạy cảm: the rope ties itself crosswise round the stone (sekimori-ishi):
// in a garden, a small stone tied in black rope quietly says “do not go further”.
function privacy(): Moment {
  const cx = 80
  const cy = 70
  const rx = 21
  const ry = 15.5
  const ky = cy - ry * 0.6 // where the two bands cross, on top of the stone
  const bands = [
    `M${so(cx - rx * 0.97, cy + 1.5)}C${so(cx - rx * 0.8, ky - 4.4)} ${so(cx + rx * 0.8, ky - 4.4)} ${so(cx + rx * 0.97, cy + 1.5)}`,
    `M${so(cx - 0.6, cy - ry * 0.96)}C${so(cx - 0.2, ky - 2)} ${so(cx + 0.2, ky)} ${so(cx + 0.4, ky + 0.5)}C${so(cx + 3.2, cy - 2)} ${so(cx + 3.4, cy + 8)} ${so(cx + 1.6, cy + ry * 0.97)}`,
  ]
  const rim = bands.map((d) => s('path', { class: 't12r-rope-rim', d }))
  const ropes = bands.map((d) => s('path', { class: 't12r-rope', d, pathLength: 1 }))
  // the knot: a tight wrap where the bands cross, a small upright loop to lift the stone by
  const handle = `M${so(cx - 2.3, ky - 1)}C${so(cx - 4.6, ky - 9.5)} ${so(cx + 4.4, ky - 10)} ${so(cx + 2.2, ky - 0.8)}`
  const knot = s('g', { class: 't12r-knot' },
    s('path', { class: 't12r-rope-rim', d: handle }),
    s('path', { class: 't12r-rope', d: handle }),
    s('ellipse', { class: 't12r-knot-w', cx, cy: ky - 0.4, rx: 3.4, ry: 2.4 }))
  const g = s('g', null, ...rings(cx, cy + 6, 33, 2, 71), mossAt(cx + 2, cy + 14, 34, 73), stone(cx, cy, rx, ry, 72, 'round'), ...rim, ...ropes, knot)
  return {
    g,
    hole: [cx, cy + 7, 46],
    foot: 92,
    play: (tl) => {
      tl.fromTo(ropes, { strokeDashoffset: 1, opacity: 1 }, { strokeDashoffset: 0, duration: 0.6, ease: 'power2.inOut', stagger: 0.45 }, 0.1)
        .fromTo(rim, { opacity: 0 }, { opacity: 1, duration: 0.5 }, 1.0)
        .fromTo(knot, { opacity: 0, scale: 0.5, transformOrigin: '50% 80%' }, { opacity: 1, scale: 1, duration: 0.7, ease: 'back.out(2)' }, 1.05)
    },
    end: () => void (gsap.set(ropes, { strokeDashoffset: 0, opacity: 1 }), gsap.set([...rim, knot], { opacity: 1, scale: 1 })),
    rest: () => void (gsap.set(ropes, { strokeDashoffset: 1, opacity: 0 }), gsap.set([...rim, knot], { opacity: 0 })),
  }
}

const MOMENTS = [clear, example, steps, loop, check, privacy]

type Mode = 'land' | 'port' | 'compact'
/**
 * Hand-placed garden groups: [x, y, size] — the centre of each moment's ground as fractions of the free field,
 * and its size against the others. Landscape: three on the left (one large and near, two smaller behind), a pair
 * at the back in the middle, one alone at the front right. Portrait: 3 · 2 · 1, stepping down on a diagonal.
 */
const SPOTS: Record<Mode, [number, number, number][]> = {
  land: [[0.2, 0.86, 1.15], [0.1, 0.3, 0.76], [0.33, 0.44, 0.84], [0.56, 0.12, 0.78], [0.7, 0.36, 0.9], [0.83, 0.86, 1.04]],
  port: [[0.28, 0.1, 0.96], [0.79, 0.03, 0.72], [0.66, 0.3, 0.82], [0.24, 0.52, 0.9], [0.62, 0.68, 0.8], [0.4, 0.95, 1.12]],
  compact: [[0.11, 0.78, 1.1], [0.2, 0.2, 0.78], [0.34, 0.58, 0.86], [0.54, 0.22, 0.8], [0.66, 0.74, 0.94], [0.88, 0.5, 1.02]],
}

/** Scene 3 — "Sáu quy tắc vàng": a dry garden of six stone moments; tap one and its rule unfolds. */
export function rulesScene(ctx: SceneCtx) {
  const T = C.scenes.rules
  const N = T.items.length
  const uid = nextId('t12r')
  const stable = stableHeight(ctx, [[T.insight, T.detail]])

  // small-scale ink filters for pictures drawn in field units (the global ones are tuned for pixels)
  const defs = s('svg', { width: 0, height: 0, 'aria-hidden': 'true', style: 'position:absolute' }, s('defs', null,
    s('filter', { id: 't12r-rough', x: '-10%', y: '-10%', width: '120%', height: '120%' },
      s('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.13', numOctaves: octaves(2), seed: '5', result: 'n' }),
      s('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: '1.3', xChannelSelector: 'R', yChannelSelector: 'G' })),
    s('filter', { id: 't12r-wash', x: '-20%', y: '-40%', width: '140%', height: '180%' },
      s('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.09', numOctaves: octaves(3), seed: '7', result: 'n' }),
      s('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: '2.4', xChannelSelector: 'R', yChannelSelector: 'G', result: 'd' }),
      liteInk() ? null : s('feGaussianBlur', { in: 'd', stdDeviation: '0.45' }))))
  const bg = s('svg', { class: 't12r-bg', 'aria-hidden': 'true' })
  const capT = h('p', { class: 't12p-cap-t' })
  const capX = h('p', { class: 't12p-cap-x' })
  const cap = h('div', { class: 't12p-cap', 'aria-live': 'polite' }, capT, capX)
  const grid = h('div', { class: 't12r-grid', role: 'group', 'aria-label': T.group })
  const root = h('div', { class: 't12 t12r' }, defs, bg, cap, grid)
  ctx.art.append(root)
  ctx.prompt(T.prompt)

  const cells = T.items.map((it, i) => {
    const m = MOMENTS[i]()
    const art = s('svg', { class: 't12r-art', viewBox: `${VB.x} ${VB.y} ${VB.w} ${VB.h}`, 'aria-hidden': 'true' }, m.g)
    const title = h('span', { class: 't12r-title' }, it.short)
    const el = h('button', { class: 't12r-cell', type: 'button', 'aria-label': fill(T.open, { n: i + 1 }) }, art, title)
    grid.append(el)
    m.rest()
    return { el, art, m, title, open: false, tl: null as TL | null }
  })
  let opened = 0
  const nextHint = () => cells.forEach((c, i) => c.el.classList.toggle('next', i === cells.findIndex((x) => !x.open)))
  nextHint()

  function reveal(i: number) {
    const c = cells[i]
    const it = T.items[i]
    ctx.chime('soft')
    if (!c.open) {
      c.open = true
      opened++
      c.el.classList.add('open')
      c.el.setAttribute('aria-label', it.title)
      nextHint()
    }
    capT.replaceChildren(h('span', { class: 't12p-cap-name' }, it.title), h('span', { class: 't12p-cap-hint' }, fill(T.count, { n: opened, total: N })))
    capX.textContent = it.example
    cap.classList.add('on')
    c.tl?.kill()
    if (ctx.reduced) c.m.end()
    else
      ctx.anim(() => {
        const tl = gsap.timeline()
        c.m.play(tl)
        c.tl = tl
        gsap.fromTo(c.title, { opacity: 0, clipPath: 'inset(0 100% 0 0)' }, { opacity: 1, clipPath: 'inset(0 -4% 0 0)', duration: 1.2, ease: 'power2.out', delay: 0.3, clearProps: 'clipPath' })
        gsap.fromTo(capX, { opacity: 0.2, clipPath: 'inset(0 100% 0 0)' }, { opacity: 1, clipPath: 'inset(0 -4% 0 0)', duration: 1.4, ease: 'power2.out', clearProps: 'clipPath' })
      })
    if (opened === N && !root.classList.contains('all')) {
      root.classList.add('all')
      ctx.insight(T.insight, T.detail)
    }
  }
  cells.forEach((c, i) => c.el.addEventListener('click', () => reveal(i)))

  // ── layout: each moment stands where the garden plan puts it; the whole plan is drawn as large as fits
  function layout() {
    const r = ctx.art.getBoundingClientRect()
    const W = r.width
    const H = stable.H(r.height)
    const mode: Mode = W / H < 1.15 ? 'port' : H < 330 ? 'compact' : 'land'
    root.dataset.mode = mode
    root.style.height = `${H}px`
    // caption height: the tallest example at this width
    const capW = mode === 'land' ? Math.min(W * 0.62, 640) : W
    cap.style.width = `${capW}px`
    cap.style.left = `${(W - capW) / 2}px`
    const probe = cap.cloneNode(false) as HTMLElement
    probe.removeAttribute('aria-live')
    probe.setAttribute('aria-hidden', 'true')
    probe.style.visibility = 'hidden'
    root.append(probe)
    let capH = 0
    for (const x of T.items) {
      probe.replaceChildren(h('p', { class: 't12p-cap-t' }, h('span', { class: 't12p-cap-name' }, x.title), h('span', { class: 't12p-cap-hint' }, '6/6')), h('p', { class: 't12p-cap-x' }, x.example))
      capH = Math.max(capH, probe.offsetHeight)
    }
    probe.remove()
    const top = capH + (mode === 'compact' ? 4 : 12)
    const fs = mode === 'land' ? clamp(W / 70, 14, 19) : mode === 'port' ? clamp(W / 27, 12.5, 15) : clamp(W / 52, 12.5, 14)
    root.style.setProperty('--fs', `${fs}px`)
    const th = Math.ceil(fs * 1.3)
    const tw = cells.map((c) => c.title.offsetWidth)
    const spots = SPOTS[mode]
    const gap = mode === 'port' ? 4 : 8
    // try the plan from large to small; take the largest at which no two moments (with their names) touch
    const place = (aH: number) => {
      const fh = H - top
      return cells.map((c, i) => {
        const [fx, fy, k] = spots[i]
        const u = (aH * k) / VB.h
        const [hx, hy, hr] = c.m.hole
        const w = VB.w * u
        const titleY = (c.m.foot - VB.y) * u + 4
        const bw = Math.max(w, tw[i])
        const bh = Math.max(VB.h * u, titleY + th)
        // where the ground's centre should be, kept inside the field
        const ax = (hx - VB.x) * u
        const ay = (hy - VB.y) * u
        const x = clamp(fx * W, ax + 2 + Math.max(0, (bw - w) / 2), W - (w - ax) - 2 - Math.max(0, (bw - w) / 2))
        const y = clamp(top + fy * fh, top + ay, H - (bh - ay) - 2)
        return { u, w, bw, bh, x, y, ax, ay, titleY, hr: hr * u }
      })
    }
    const touch = (P: ReturnType<typeof place>) =>
      P.some((a, i) => P.some((b, j) => {
        if (j <= i) return false
        const al = a.x - a.ax - (a.bw - a.w) / 2
        const bl = b.x - b.ax - (b.bw - b.w) / 2
        const at = a.y - a.ay
        const bt = b.y - b.ay
        return al < bl + b.bw + gap && bl < al + a.bw + gap && at < bt + b.bh + gap && bt < at + a.bh + gap
      }))
    let aH = Math.min((H - top) * 0.5, (W * 0.32 * VB.h) / VB.w)
    let P = place(aH)
    while (touch(P) && aH > 30) P = place((aH *= 0.96))
    const holes: [number, number, number][] = []
    cells.forEach((c, i) => {
      const p = P[i]
      const left = p.x - p.ax
      const ah = VB.h * p.u
      Object.assign(c.el.style, { left: `${f1(left - (p.bw - p.w) / 2)}px`, top: `${f1(p.y - p.ay)}px`, width: `${f1(p.bw)}px`, height: `${f1(p.bh)}px` })
      Object.assign(c.art.style, { width: `${f1(p.w)}px`, height: `${f1(ah)}px` })
      c.el.style.setProperty('--ty', `${f1(p.titleY)}px`)
      c.el.style.setProperty('--hx', `${f1(p.ax + (p.bw - p.w) / 2)}px`)
      c.el.style.setProperty('--hy', `${f1(p.ay)}px`)
      c.el.style.setProperty('--hw', `${f1(p.hr * 1.5)}px`)
      // the nearer (lower) moments lie over the farther ones
      c.el.style.zIndex = String(Math.round(p.y))
      holes.push([p.x, p.y, p.hr])
    })
    // the sand
    bg.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    bg.setAttribute('width', f1(W))
    bg.setAttribute('height', f1(H))
    const mid = `${uid}-m`
    const fid = `${uid}-f`
    bg.replaceChildren(s('defs', null,
      s('mask', { id: mid, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, s('rect', { x: 0, y: 0, width: W, height: H, fill: '#fff' }), ...holes.map(([x, y, rx]) => s('ellipse', { cx: f1(x), cy: f1(y), rx: f1(rx), ry: f1(rx * 0.36), fill: '#000' }))),
      s('linearGradient', { id: `${fid}g`, x1: 0, y1: 0, x2: 1, y2: 0 }, s('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 0 }), s('stop', { offset: 0.06, 'stop-color': '#fff' }), s('stop', { offset: 0.94, 'stop-color': '#fff' }), s('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 })),
      s('mask', { id: fid, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, s('rect', { x: 0, y: 0, width: W, height: H, fill: `url(#${fid}g)` }))))
    const y0 = Math.max(0, top - (mode === 'compact' ? 0 : 6))
    bg.append(s('g', { mask: `url(#${fid})` }, s('g', { mask: `url(#${mid})` }, rakeLines(-20, W + 20, y0, H, mode === 'compact' ? 0.7 : 1, 13))))
  }
  const ro = new ResizeObserver(() => layout())
  ro.observe(ctx.art)
  layout()
  afterFonts(ctx, () => (stable.reset(), layout()))
  if (!ctx.reduced) gsap.from(cells.map((c) => c.art), { opacity: 0, y: 14, duration: 1.2, stagger: 0.09, delay: 0.3, ease: 'power3.out', clearProps: 'opacity,transform' })

  return () => {
    ro.disconnect()
    cells.forEach((c) => c.tl?.kill())
  }
}
