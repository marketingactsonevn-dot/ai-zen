import { s } from '../../core/dom'
import { gsap } from '../../core/anim'
import { brush, ell, rng, type Pt } from './ink'
import { C } from './data'

/**
 * Ten tiny animated demos (viewBox 240 × 180), one per concept stone. Every demo shares one small landscape
 * (sun, mountain, water, boat) so the visitor sees the same picture being made, edited, extended, restyled…
 */
const A = C.scenes.concepts.art
type Attrs = Record<string, unknown>
type El = SVGElement
const g = (a: Attrs | null, ...k: (El | null)[]) => s('g', a, ...k)
const P = (d: string, cls: string, a: Attrs = {}) => s('path', { d, class: cls, ...a })
const B = (pts: Pt[], w: number, cls: string, o: Parameters<typeof brush>[2] = {}, a: Attrs = {}) => P(brush(pts, w, o).d, cls, a)
const T = (x: number, y: number, str: string, size: number, cls = 't7-tx', a: Attrs = {}) =>
  s('text', { x, y, 'font-size': size, class: cls, 'text-anchor': 'middle', ...a }, str)
const frame = (x: number, y: number, w: number, h: number, a: Attrs = {}) => s('rect', { x, y, width: w, height: h, rx: 2, class: 't7s-fr', ...a })

// ── the shared landscape, in a 160 × 120 box ──
const RIDGE = 'M3 72L18 62L34 67L58 52L84 66L108 57L132 67L157 60L157 98L3 98Z'
const MOUNT = 'M6 98C20 76 32 52 46 40C54 33 60 36 66 46C76 64 90 82 108 98Z'
const MOUNT_LINE: Pt[] = [[6, 98], [26, 66], [46, 40], [56, 35], [66, 46], [86, 74], [108, 98]]
const BOAT: Pt[] = [[100, 104], [110, 109], [126, 109], [134, 103]]

type Style = 'ink' | 'line' | 'band'
function scape(style: Style = 'ink', o: { sun?: [number, number, number]; boat?: boolean; flip?: boolean } = {}) {
  const [sx, sy, sr] = o.sun ?? [116, 32, 12]
  const root = g(o.flip ? { transform: 'translate(160 0) scale(-1 1)' } : null)
  const add = (...k: (El | null)[]) => root.append(...(k.filter(Boolean) as El[]))
  if (style === 'line') {
    add(
      P(ell(sx, sy, sr), 't7s-ln'),
      P(`M${MOUNT_LINE.map((p) => p.join(' ')).join('L')}`, 't7s-ln'),
      P('M0 72L18 62L34 67L58 52L84 66L108 57L132 67L160 59', 't7s-ln t7s-ln2'),
      P('M0 98L160 98M12 108L60 108M84 114L150 114', 't7s-ln t7s-ln2'),
      o.boat === false ? null : P(`M${BOAT.map((p) => p.join(' ')).join('L')}`, 't7s-ln'))
    return root
  }
  if (style === 'band') {
    add(
      s('rect', { width: 160, height: 60, class: 't7s-band1' }),
      P(ell(sx, sy, sr), 't7-v'),
      ...[0, 1, 2].map((k) => P(`M${sx - sr * 2.2} ${sy + 4 + k * 5}h${sr * 1.2}M${sx + sr + 2} ${sy + 6 + k * 5}h${sr * 1.4}`, 't7s-ln t7s-white')),
      P(RIDGE, 't7-m2'),
      P(MOUNT, 't7-m'),
      P('M30 52L46 40L56 35L66 46L60 52L52 46L42 54Z', 't7s-snow'),
      s('rect', { y: 98, width: 160, height: 22, class: 't7s-band2' }),
      ...[0, 1, 2, 3, 4, 5, 6].map((k) => P(`M${k * 24 - 4} 110q6 -7 12 0t12 0`, 't7s-ln t7s-white')),
      o.boat === false ? null : B(BOAT, 7, 't7-k', { a: 0.2, b: 0.2, min: 0.5 }))
    return root
  }
  add(
    P(ell(sx, sy, sr), 't7-v', { filter: 'url(#ink-wash)', 'fill-opacity': 0.9 }),
    P(RIDGE, 't7-k', { 'fill-opacity': 0.12, filter: 'url(#ink-wash)' }),
    P(MOUNT, 't7-k', { 'fill-opacity': 0.55, filter: 'url(#ink-wash)' }),
    B(MOUNT_LINE.slice(0, 5), 3, 't7-k', { a: 0.05, b: 0.4 }, { filter: 'url(#ink-rough)' }),
    B(MOUNT_LINE.slice(4), 1.8, 't7-k', { a: 0.2, b: 0.4 }, { filter: 'url(#ink-rough)', 'fill-opacity': 0.7 }),
    ...[[8, 104, 50], [70, 110, 60], [20, 116, 40]].map(([x, y, l]) => B([[x, y], [x + l, y]], 1.4, 't7-k3', { a: 0.3, b: 0.4 }, { 'fill-opacity': 0.6 })),
    o.boat === false ? null : g({ filter: 'url(#ink-rough)' }, B(BOAT, 5.5, 't7-k', { a: 0.2, b: 0.2, min: 0.4 }), B([[122, 106], [123, 96]], 2.4, 't7-k'), P('M117 97L129 97L123 92Z', 't7-k')))
  return root
}

/** Ink speckles across a box: the noise a picture starts from. Same seed → the same speckles. */
function noise(x: number, y: number, w: number, h: number, n: number, seed: number) {
  const r = rng(seed)
  const out = g({ class: 't7s-noise' })
  for (let i = 0; i < n; i++) {
    const v = r()
    out.append(s('circle', { cx: (x + r() * w).toFixed(1), cy: (y + r() * h).toFixed(1), r: (0.7 + r() * 1.9).toFixed(1), class: v < 0.08 ? 't7-v' : v < 0.55 ? 't7-k' : 't7-k3', 'fill-opacity': (0.25 + r() * 0.6).toFixed(2) }))
  }
  return out
}
const at = (x: number, y: number, k = 1) => ({ transform: `translate(${x} ${y})${k !== 1 ? ` scale(${k})` : ''}` })
const loop = () => gsap.timeline({ repeat: -1, repeatDelay: 0.6 })

export interface Demo {
  root: SVGGElement
  tl: gsap.core.Timeline
  /** where the reduced-motion still frame sits on the timeline (0…1) */
  still?: number
}

function t2i(): Demo {
  const strip = g(null, s('rect', { x: 44, y: 6, width: 152, height: 26, rx: 3, class: 't7s-strip' }), T(120, 23.5, A.words, 12.5))
  const pic = g(at(40, 40), scape())
  const dots = noise(40, 40, 160, 120, 150, 3)
  const root = g(null, frame(40, 40, 160, 120), pic, dots, strip)
  const tl = loop()
    .fromTo(strip, { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: 0.6 })
    .fromTo(dots.children, { opacity: 1 }, { opacity: 0, duration: 1.4, stagger: { each: 0.008, from: 'random' } }, 0.7)
    .fromTo(pic, { opacity: 0, filter: 'blur(6px)' }, { opacity: 1, filter: 'blur(0px)', duration: 2 }, 0.8)
    .to({}, { duration: 1.6 })
    .to([pic, strip], { opacity: 0, duration: 0.5 })
  return { root, tl, still: 0.8 }
}

function i2i(): Demo {
  const sk = g(at(16, 46, 0.62), scape('line'))
  const out = g(at(130, 46, 0.62), scape())
  const arrow = B([[116, 83], [126, 83]], 2, 't7-v', { a: 0, b: 0.6 })
  const root = g(null, frame(16, 46, 99, 74), frame(130, 46, 99, 74), sk, out, arrow, T(66, 142, A.sketch, 12, 't7-tx t7s-cap'), T(180, 142, A.result, 12, 't7-tx t7s-cap'))
  const lines = sk.querySelectorAll('path')
  lines.forEach((p) => p.setAttribute('pathLength', '1'))
  const tl = loop()
    .fromTo(lines, { strokeDasharray: '1 1', strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.2, stagger: 0.1, ease: 'power1.inOut' })
    .fromTo(arrow, { opacity: 0, x: -6 }, { opacity: 1, x: 0, duration: 0.5 })
    .fromTo(out, { opacity: 0, filter: 'blur(5px)' }, { opacity: 1, filter: 'blur(0px)', duration: 1.4 })
    .to({}, { duration: 1.4 })
    .to([out, arrow], { opacity: 0, duration: 0.5 })
  return { root, tl, still: 0.85 }
}

function inpaint(): Demo {
  const base = g(at(40, 30), scape())
  const sun = base.querySelector('.t7-v') as SVGElement
  const moon = g(at(40, 30), P(`M${116 - 12} 32a12 12 0 1 0 22 -6a10 10 0 1 1 -22 6Z`, 't7-k2', { filter: 'url(#ink-rough)' }), P(ell(100, 20, 1.2), 't7-k3'), P(ell(134, 44, 1), 't7-k3'))
  const lasso = s('ellipse', { cx: 156, cy: 62, rx: 24, ry: 20, class: 't7s-lasso', pathLength: 1 })
  const dots = noise(134, 44, 44, 36, 40, 9)
  const root = g(null, frame(40, 30, 160, 120), base, moon, dots, lasso)
  const tl = loop()
    .set(moon, { opacity: 0 })
    .fromTo(lasso, { opacity: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut' })
    .fromTo(dots.children, { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: { each: 0.005, from: 'random' } })
    .to(sun, { opacity: 0, duration: 0.3 }, '<0.2')
    .to(dots.children, { opacity: 0, duration: 0.8, stagger: { each: 0.008, from: 'random' } })
    .to(moon, { opacity: 1, duration: 0.8 }, '<0.2')
    .to(lasso, { opacity: 0, duration: 0.6 }, '+=0.6')
    .to({}, { duration: 1 })
    .to(moon, { opacity: 0, duration: 0.4 })
    .to(sun, { opacity: 1, duration: 0.4 }, '<')
  return { root, tl, still: 0.7 }
}

function outpaint(): Demo {
  const clipId = `t7s-clip-${Math.random().toString(36).slice(2, 7)}`
  const clip = s('rect', { x: 92, y: 62, width: 64, height: 48 })
  const pic = g({ 'clip-path': `url(#${clipId})` }, g(at(40, 30), scape()),
    // extra things that only exist beyond the old edges: a pine, birds
    B([[52, 150], [58, 112], [50, 84]], 4, 't7-k', { a: 0.05, b: 0.6 }, { filter: 'url(#ink-rough)' }),
    P(ell(52, 86, 13, 5), 't7-k', { 'fill-opacity': 0.8, filter: 'url(#ink-rough)' }),
    P(ell(62, 100, 10, 4), 't7-k', { 'fill-opacity': 0.75, filter: 'url(#ink-rough)' }),
    B([[176, 48], [180, 51], [185, 47]], 1.6, 't7-k'), B([[186, 56], [189, 58], [193, 55]], 1.4, 't7-k'))
  const border = s('rect', { x: 92, y: 62, width: 64, height: 48, class: 't7s-edge' })
  const dots = noise(40, 30, 160, 120, 130, 21)
  const root = g(null, s('defs', null, s('clipPath', { id: clipId }, clip)), frame(40, 30, 160, 120, { class: 't7s-fr t7s-ghost' }), dots, pic, border)
  const big = { x: 40, y: 30, width: 160, height: 120 }
  const small = { x: 92, y: 62, width: 64, height: 48 }
  const tl = loop()
    .set(dots.children, { opacity: 0 })
    .set([clip, border], { attr: small })
    .to({}, { duration: 0.6 })
    .to([clip, border], { attr: big, duration: 1.6, ease: 'power2.inOut' })
    .fromTo(dots.children, { opacity: 0.9 }, { opacity: 0, duration: 1, stagger: { each: 0.006, from: 'center' } }, '<0.1')
    .to({}, { duration: 1.6 })
    .to([clip, border], { attr: small, duration: 0.8, ease: 'power2.inOut' })
  return { root, tl, still: 0.62 }
}

function upscale(): Demo {
  // the same picture as 16 × 12 blocks, sampled from its own shapes
  const px = g(null)
  const cw = 10
  const inMount = (x: number, y: number) => y > 98 ? false : y > 40 + Math.abs(x - 50) * (x < 50 ? 1.25 : 1.05)
  for (let j = 0; j < 12; j++)
    for (let i = 0; i < 16; i++) {
      const x = i * cw + 5
      const y = j * cw + 5
      const cls = Math.hypot(x - 116, y - 32) < 13 ? 't7-v' : inMount(x, y) ? 't7-k2' : y > 98 ? 't7-s2' : y > 64 ? 't7-s3' : 't7-c'
      px.append(s('rect', { x: i * cw, y: j * cw, width: cw + 0.3, height: cw + 0.3, class: cls }))
    }
  const small = g(at(26, 70, 0.4), px)
  const crisp = g(at(40, 30), scape())
  const big = g(at(40, 30), px.cloneNode(true) as SVGGElement)
  const label = T(120, 172, A.x4, 13, 't7-sx')
  const root = g(null, frame(40, 30, 160, 120), big, crisp, small, label)
  const tl = loop()
    .set([crisp, big], { opacity: 0 })
    .fromTo(small, { opacity: 1 }, { opacity: 1, duration: 0.8 })
    .to(small, { opacity: 0, duration: 0.4 })
    .to(big, { opacity: 1, duration: 0.4 }, '<')
    .fromTo(label, { opacity: 0 }, { opacity: 1, duration: 0.4 }, '<')
    .to(crisp, { opacity: 1, duration: 1.4, ease: 'power2.inOut' }, '+=0.3')
    .to(big, { opacity: 0, duration: 1.4 }, '<')
    .to({}, { duration: 1.6 })
    .to([crisp, label], { opacity: 0, duration: 0.5 })
  return { root, tl, still: 0.78 }
}

function ref(): Demo {
  const card = g(null, frame(12, 50, 70, 54), g(at(12, 50, 0.4375), scape('band', { boat: false, sun: [40, 30, 14] })))
  const ink = g(at(112, 34, 0.75), scape())
  const band = g(at(112, 34, 0.75), scape('band'))
  const dot = P(ell(84, 77, 3), 't7-v')
  const root = g(null, card, T(47, 122, A.ref, 12, 't7-tx t7s-cap'), frame(112, 34, 120, 90), ink, band, dot)
  const tl = loop()
    .set(band, { opacity: 0 })
    .fromTo(card, { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: 0.6 })
    .fromTo(dot, { opacity: 1, x: 0 }, { x: 26, opacity: 0, duration: 0.9, ease: 'power2.in' }, '+=0.3')
    .to(band, { opacity: 1, duration: 1.3 }, '-=0.2')
    .to(ink, { opacity: 0, duration: 1.3 }, '<')
    .to({}, { duration: 1.6 })
    .to(band, { opacity: 0, duration: 0.5 })
    .to(ink, { opacity: 1, duration: 0.5 }, '<')
  return { root, tl, still: 0.75 }
}

/** A small white cat with a vermilion scarf — the character that must stay the same. */
const CAT_HEAD = 'M-8 -12C-8.4 -17 -8 -21 -7.4 -26L-2.6 -20.6C-1 -21.2 1 -21.2 2.6 -20.6L7.4 -26C8 -21 8.4 -17 8 -12C7.8 -6.6 4.4 -4.6 0 -4.6C-4.4 -4.6 -7.8 -6.6 -8 -12Z'
const CAT_BODY = 'M-8.5 13C-10.5 4 -7 -5.5 0 -6C7 -5.5 10.5 4 8.5 13Z'
function cat(x: number, y: number, k = 1, flip = false) {
  return g({ transform: `translate(${x} ${y}) scale(${flip ? -k : k} ${k})` },
    P(ell(0, 13.5, 15, 2.6), 't7-k', { 'fill-opacity': 0.12 }),
    B([[7, 11], [15, 9], [18, 1], [14, -4]], 3, 't7-k2', { a: 0.1, b: 0.5 }),
    P(CAT_BODY, 't7s-cat t7s-ol'),
    P(CAT_HEAD, 't7s-cat t7s-ol'),
    P('M-7.2 -25L-6.8 -22L-4.6 -22.8Z', 't7-k2'), P('M7.2 -25L6.8 -22L4.6 -22.8Z', 't7-k2'),
    B([[-7, -6], [0, -3.6], [7, -6]], 3.4, 't7-v', { a: 0.2, b: 0.2, min: 0.6 }),
    B([[4, -4.6], [6, 1]], 2.6, 't7-v', { a: 0.1, b: 0.5 }),
    P(ell(-3, -12.5, 1), 't7-k'), P(ell(3, -12.5, 1), 't7-k'), P('M-0.9 -10.2L0.9 -10.2L0 -9.2Z', 't7-v'))
}

function char(): Demo {
  const f = (x: number, kid: SVGElement[]) => g(null, frame(x, 52, 64, 64), ...kid)
  const a = f(12, [B([[14, 104], [74, 104]], 1.4, 't7-k3'), B([[30, 108], [58, 108]], 4, 't7-k', { a: 0.2, b: 0.2 }), cat(44, 90, 0.7)])
  const b = f(88, [P(ell(132, 66, 7), 't7-v', { 'fill-opacity': 0.85 }), P('M88 116C100 96 116 92 152 104L152 116Z', 't7-k', { 'fill-opacity': 0.25 }), cat(114, 92, 0.7, true)])
  const c = f(164, [...[172, 182, 216, 222].map((x, i) => B([[x, 114], [x + 1, 56]], 2.4 - (i % 2) * 0.6, 't7-m', { a: 0.05, b: 0.1 })), P(ell(186, 70, 5, 2), 't7-m'), P(ell(212, 62, 6, 2), 't7-m'), cat(197, 98, 0.7)])
  const thread = P('M44 128C70 138 92 138 114 128S170 118 197 128', 't7s-thread', { pathLength: 1 })
  const root = g(null, a, b, c, thread)
  const tl = loop()
    .fromTo([a, b, c], { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.45, ease: 'power3.out' })
    .fromTo(thread, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.2, ease: 'power2.inOut' })
    .to({}, { duration: 1.6 })
    .to([a, b, c, thread], { opacity: 0, duration: 0.5 })
    .set(thread, { opacity: 1 })
  return { root, tl, still: 0.72 }
}

function seed(): Demo {
  const pa = g(at(40, 24), scape())
  const pb = g(at(40, 24), scape('ink', { sun: [38, 28, 14], flip: true }))
  const na = noise(40, 24, 160, 120, 140, 42)
  const nb = noise(40, 24, 160, 120, 140, 7)
  const tag = g(null, P('M86 152C86 146 92 144 120 144C148 144 154 146 154 152C154 160 148 162 120 162C92 162 86 160 86 152Z', 't7s-tag'))
  const la = T(120, 157.5, A.seedA, 11.5, 't7-sx t7s-tagt')
  const lb = T(120, 157.5, A.seedB, 11.5, 't7-sx t7s-tagt')
  const root = g(null, frame(40, 24, 160, 120), pa, pb, na, nb, tag, la, lb)
  const reveal = (n: SVGGElement, p: SVGGElement, l: SVGElement, other: SVGElement, at: number | string) =>
    tl.set([pa, pb, na, nb], { opacity: 0 }, at)
      .set(l, { opacity: 1 }, at).set(other, { opacity: 0 }, at)
      .fromTo(n, { opacity: 1 }, { opacity: 1, duration: 0.7 }, at)
      .to(n, { opacity: 0, duration: 1.1 })
      .fromTo(p, { opacity: 0 }, { opacity: 1, duration: 1.1 }, '<')
      .to({}, { duration: 0.9 })
  const tl = loop()
  reveal(na, pa, la, lb, 0)
  reveal(nb, pb, lb, la, '>')
  reveal(na, pa, la, lb, '>')
  return { root, tl, still: 0.3 }
}

function aspect(): Demo {
  const clipId = `t7s-clip-${Math.random().toString(36).slice(2, 7)}`
  const R = [{ x: 60, y: 22, width: 120, height: 120 }, { x: 20, y: 38, width: 200, height: 112 }, { x: 75, y: 8, width: 90, height: 160 }]
  const SUN = [[150, 46], [190, 58], [140, 34]]
  const SHIFT = [24, 40, 10]
  const clip = s('rect', R[0])
  const sun = s('circle', { r: 10, cx: SUN[0][0], cy: SUN[0][1], class: 't7-v', filter: 'url(#ink-wash)' })
  const wide = g(null, P('M-60 98L-30 70L-10 84L20 60L50 86L80 66L120 92L150 64L200 90L240 70L300 98Z', 't7-k', { 'fill-opacity': 0.14, filter: 'url(#ink-wash)' }),
    P('M30 98C50 72 64 50 76 44C84 40 90 46 96 56C108 76 120 90 140 98Z', 't7-k', { 'fill-opacity': 0.55, filter: 'url(#ink-wash)' }),
    ...[[-40, 104, 60], [60, 110, 80], [150, 106, 70]].map(([x, y, l]) => B([[x, y], [x + l, y]], 1.4, 't7-k3', { a: 0.3, b: 0.4 })))
  const box = s('rect', { ...R[0], class: 't7s-edge' })
  const label = T(120, 174, A.ratios[0], 12, 't7-sx')
  const pic = g({ 'clip-path': `url(#${clipId})` }, sun, wide)
  const root = g(null, s('defs', null, s('clipPath', { id: clipId }, clip)), s('rect', { x: 0, y: 0, width: 240, height: 180, fill: 'none' }), pic, box, label)
  wide.setAttribute('transform', `translate(${SHIFT[0]} ${R[0].y + R[0].height - 116})`)
  const tl = gsap.timeline({ repeat: -1 })
  R.forEach((r, i) => {
    tl.to([clip, box], { attr: r, duration: 0.9, ease: 'power3.inOut' }, i ? '>' : 0)
      .to(sun, { attr: { cx: SUN[i][0], cy: SUN[i][1] }, duration: 0.9, ease: 'power3.inOut' }, '<')
      .to(wide, { attr: { transform: `translate(${SHIFT[i]} ${r.y + r.height - 116})` }, duration: 0.9, ease: 'power3.inOut' }, '<')
      .call(() => void (label.textContent = A.ratios[i]), [], '<0.45')
      .to({}, { duration: 1.3 })
  })
  return { root, tl, still: 0.2 }
}

function neg(): Demo {
  const pic = g(at(40, 22), scape())
  const junk = g(null,
    s('rect', { x: 52, y: 32, width: 44, height: 20, rx: 2, class: 't7s-sign' }),
    ...[0, 1].map((k) => B(Array.from({ length: 9 }, (_, i) => [56 + i * 4.4, 40 + k * 7 + Math.sin(i * 1.9 + k) * 2.4] as Pt), 1.4, 't7-k2', { a: 0.1, b: 0.1, min: 0.6 })),
    P(ell(150, 112, 18, 9), 't7-k2', { 'fill-opacity': 0.35, filter: 'url(#t7s-blur)' }))
  const strip = g(null, s('rect', { x: 36, y: 149, width: 168, height: 25, rx: 3, class: 't7s-strip' }), T(120, 166, A.neg, 12))
  const dots = noise(46, 26, 140, 100, 60, 31)
  const root = g(null, s('defs', null, s('filter', { id: 't7s-blur', x: '-50%', y: '-50%', width: '200%', height: '200%' }, s('feGaussianBlur', { stdDeviation: 3 }))),
    frame(40, 22, 160, 120), pic, junk, dots, strip)
  const tl = loop()
    .set(dots.children, { opacity: 0 })
    .set(junk, { opacity: 1 })
    .fromTo(strip, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.6 }, 0.6)
    .to(dots.children, { opacity: 0.8, duration: 0.3, stagger: { each: 0.006, from: 'random' } }, '+=0.3')
    .to(junk, { opacity: 0, duration: 0.6 }, '<0.2')
    .to(dots.children, { opacity: 0, duration: 0.7, stagger: { each: 0.006, from: 'random' } })
    .to({}, { duration: 1.6 })
    .to(strip, { opacity: 0, duration: 0.4 })
  return { root, tl, still: 0.82 }
}

export const DEMOS: Record<string, () => Demo> = { t2i, i2i, inpaint, outpaint, upscale, ref, char, seed, aspect, neg }
