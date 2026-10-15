import { h, nextId, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { onPrefs } from '../../core/prefs'
import { blob, blobPts, curve, measure, pebbleArt, rng, sheet, stroke, wrap, type Pt } from './brush'
import { paintStone, themeInk, type StoneInk, type StoneShape } from './stone'

interface Era {
  name: string
  insight: string
  milestone: Fact
  rules?: string[]
  stamp?: string[]
  ghost?: string
  baskets?: string[]
  layers?: string[]
  understood?: string[]
  reply?: string
  seal?: string
}
export interface LadderCopy {
  prompt: string
  walk: string
  pathLabel: string
  startLabel: string
  openLabel: string
  question: string[]
  eras: Era[]
  final: string
  finalDetail: string
}

type Kid = SVGElement | null | false
type Attrs = Record<string, unknown>
const g = (attrs: Attrs | null, ...kids: Kid[]) => s('g', attrs, ...kids)
const P = (d: string, cls: string, attrs: Attrs = {}) => s('path', { d, class: cls, ...attrs })
/** In-art text; data-fs lets fitView() keep it at ≥ 14 px on screen whatever the scale. */
const T = (x: number, y: number, str: string, size: number, cls = 't1-tx', attrs: Attrs = {}) =>
  s('text', { x: x.toFixed(1), y: y.toFixed(1), 'font-size': size, 'data-fs': size, class: cls, ...attrs }, str)
const mid = { 'text-anchor': 'middle' }
const MIN_FS = 14

/** wide = landscape, tall = portrait, compact = very short landscape strip (e.g. 800×420). */
type Mode = 'wide' | 'tall' | 'compact'
/** Each machine is drawn around (0, 0) inside its mode's core box; the stage scales the box to fit. */
const CORE: Record<Mode, [number, number]> = { wide: [460, 204], tall: [330, 364], compact: [520, 150] }

interface Art {
  mode: Mode
  wide: boolean
  rough: string | null
  wash: string | null
  dry: string | null
  c: LadderCopy
}
/** Pick a value per layout mode (compact falls back to wide). */
const by = <V>(a: Art, wide: V, tall: V, compact: V = wide) => (a.mode === 'tall' ? tall : a.mode === 'compact' ? compact : wide)

interface Machine {
  svg: SVGSVGElement
  tl: gsap.core.Timeline
}

// ── Shared ink pieces ───────────────────────────────────────────────────────

/** An envelope drawn with tapered brush edges and a vermilion wax seal at the flap's tip. */
function envelope(w: number, rough: string | null, seal = 't1-ver', seed = 3) {
  const hh = w * 0.64, x0 = -w / 2, y0 = -hh / 2
  const lw = Math.max(1.1, w * 0.016)
  return g(null,
    P(sheet(x0, y0, w, hh, seed + 5), 't1-paper'),
    g({ filter: rough },
      P(stroke([[x0, y0], [0, y0 + 0.6], [-x0, y0]], lw, { tail: 0.25, min: 0.35 }), 't1-ink2'),
      P(stroke([[-x0, y0], [-x0 + 0.6, 0], [-x0, -y0]], lw * 1.1, { tail: 0.3, min: 0.35 }), 't1-ink2'),
      P(stroke([[-x0, -y0], [0, -y0 + 0.6], [x0, -y0]], lw * 1.35, { tail: 0.3, min: 0.35 }), 't1-ink2'),
      P(stroke([[x0, -y0], [x0 - 0.5, 0], [x0, y0]], lw * 1.1, { tail: 0.3, min: 0.35 }), 't1-ink2'),
      P(stroke([[x0 + 1.5, y0 + 1.5], [x0 * 0.45, y0 + hh * 0.3], [0, y0 + hh * 0.52]], lw * 0.95, { head: 0.1, tail: 1.3 }), 't1-ink3'),
      P(stroke([[-x0 - 1.5, y0 + 1.5], [-x0 * 0.45, y0 + hh * 0.3], [0, y0 + hh * 0.52]], lw * 0.95, { head: 0.1, tail: 1.3 }), 't1-ink3')),
    P(blob(0, y0 + hh * 0.52, w * 0.085, w * 0.08, seed, 0.14, 14), seal, { filter: rough }))
}

/** A lipstick lying on its side: case with one highlight, a stone-coloured collar, a slanted vermilion bullet. */
function lipstick(L: number, rough: string | null) {
  const f = (n: number) => n * L
  return g(null,
    P(blob(f(0.5), f(0.13), f(0.52), f(0.07), 17, 0.1), 't1-wash', {}),
    g({ filter: rough },
      P(sheet(0, -f(0.1), f(0.55), f(0.2), 8), 't1-case'),
      P(stroke([[f(0.05), -f(0.055)], [f(0.3), -f(0.062)], [f(0.5), -f(0.058)]], f(0.028), { head: 0.2, tail: 0.9 }), 't1-hi'),
      P(sheet(f(0.55), -f(0.088), f(0.1), f(0.176), 4), 't1-collar'),
      P(stroke([[f(0.57), -f(0.08)], [f(0.575), f(0.08)]], f(0.012), { tail: 0.5 }), 't1-ink2'),
      P(`M${f(0.65)} ${-f(0.07)}L${f(0.79)} ${-f(0.07)}C${f(0.9)} ${-f(0.066)} ${f(0.975)} ${-f(0.012)} ${f(1)} ${f(0.046)}L${f(0.975)} ${f(0.07)}L${f(0.65)} ${f(0.07)}Z`, 't1-ver'),
      P(stroke([[f(0.8), -f(0.052)], [f(0.9), -f(0.036)], [f(0.965), f(0.018)]], f(0.022), { head: 0.25, tail: 0.8 }), 't1-hi', { opacity: 0.55 })))
}

/** A vermilion hanko seal with one or two short lines carved in; fitView() grows the whole seal (data-hk) so its text stays ≥ 14 px. */
function hanko(lines: string[], w: number, hh: number, rough: string | null, seed: number) {
  const fs = lines.length > 1 ? hh * 0.34 : hh * 0.42
  return g(null, g({ 'data-hk': fs.toFixed(2) },
    P(blob(0, 0, w / 2, hh / 2, seed, 0.05, 12), 't1-ver', { filter: rough }),
    ...lines.map((ln, i) => T(0, (lines.length > 1 ? (i - 0.5) * fs * 1.15 : 0) + fs * 0.36, ln, fs, 't1-tx t1-onver', { ...mid, 'data-fs': null }))))
}

/** Points along an ellipse (for brush strokes that follow a rim). */
const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 11): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const t = a0 + ((a1 - a0) * i) / (n - 1)
    return [cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]
  })

/** Every machine gets its own svg layer; it is attached at once so GSAP can measure SVG boxes. */
function layer(host: Element) {
  const svg = s('svg', { class: 't1-mach', 'aria-hidden': 'true' })
  host.append(svg)
  return svg
}

// ── 0 · The customer's letter: closed envelope + lipstick; tap opens it and the question slides out.
function introArt(a: Art, host: Element): Machine & { open: gsap.core.Timeline } {
  const { rough, c } = a
  const svg = layer(host)
  // compact strip: no room above the envelope, so the letter slides out sideways instead of upwards
  const side = a.mode === 'compact'
  const ex = by(a, -40, 0, -150), ey = by(a, 22, 34, 6), w = by(a, 172, 206, 124)
  const hh = w * 0.64, x0 = ex - w / 2, y0 = ey - hh / 2
  const lw = w * 0.011
  const slipW = side ? 200 : w * 0.9, slipTop = by(a, -96, -122, ey - 32)
  const fs = Math.min(by(a, 15, 17, 15.5), (slipW - 22) / Math.max(...c.question.map((q) => measure(q, 1))))
  const slipH = side ? 64 : y0 - slipTop + 30
  const slipX = side ? ex + w / 2 - slipW + 4 : ex - slipW / 2
  const clipId = nextId('t1-slip')
  const slipBody = g(null,
    P(sheet(slipX, slipTop, slipW, slipH, 12), 't1-card t1-edge'),
    ...c.question.map((q, i) => T(slipX + slipW / 2, slipTop + fs * 1.75 + i * fs * 1.5, q, fs, 't1-tx t1-tx1', { ...mid, 'data-fs': null })))
  const slip = g({ 'clip-path': `url(#${clipId})` }, slipBody)
  const openFlap = P(`M${x0 + 1} ${y0}L${ex} ${y0 - hh * 0.46}L${x0 + w - 1} ${y0}Z`, 't1-paper2 t1-edge')
  const closedFlap = g(null,
    P(`M${x0} ${y0}L${ex} ${y0 + hh * 0.54}L${x0 + w} ${y0}Z`, 't1-paper2'),
    g({ filter: rough },
      P(stroke([[x0 + 1, y0 + 1], [ex - w * 0.22, y0 + hh * 0.3], [ex, y0 + hh * 0.54]], lw, { head: 0.1, tail: 1.2 }), 't1-ink2'),
      P(stroke([[x0 + w - 1, y0 + 1], [ex + w * 0.22, y0 + hh * 0.3], [ex, y0 + hh * 0.54]], lw, { head: 0.1, tail: 1.2 }), 't1-ink2')),
    P(blob(ex, y0 + hh * 0.54, w * 0.075, w * 0.07, 3, 0.16, 16), 't1-ver', { filter: rough }),
    P(blob(ex - w * 0.012, y0 + hh * 0.54 - w * 0.01, w * 0.03, w * 0.022, 5, 0.2, 10), 't1-hi', { opacity: 0.35 }))
  const front = g(null,
    P(sheet(x0, y0, w, hh, 9), 't1-paper'),
    g({ filter: rough },
      P(stroke([[x0, y0 + hh], [ex, y0 + hh + 0.8], [x0 + w, y0 + hh]], lw * 1.7, { tail: 0.3, min: 0.35 }), 't1-ink2'),
      P(stroke([[x0 + w, y0], [x0 + w + 0.6, ey], [x0 + w, y0 + hh]], lw * 1.1, { tail: 0.3, min: 0.35 }), 't1-ink2'),
      P(stroke([[x0, y0 + hh], [x0 - 0.5, ey], [x0, y0]], lw * 1.1, { tail: 0.3, min: 0.35 }), 't1-ink2'),
      P(stroke([[x0, y0], [ex, y0 + 0.5], [x0 + w, y0]], lw * 0.8, { tail: 0.3, min: 0.35 }), 't1-ink3'),
      P(stroke([[x0 + 2, y0 + hh - 2], [ex - w * 0.16, ey + hh * 0.08]], lw * 0.7, { tail: 1 }), 't1-ink3', { opacity: 0.55 }),
      P(stroke([[x0 + w - 2, y0 + hh - 2], [ex + w * 0.16, ey + hh * 0.08]], lw * 0.7, { tail: 1 }), 't1-ink3', { opacity: 0.55 })))
  const [lx, ly] = by<Pt>(a, [ex + w * 0.56, ey + hh * 0.5], [ex + 34, ey + hh * 0.5 + 58], [ex + w / 2 + slipW + 34, ey + 34])
  const stick = g({ transform: `translate(${lx} ${ly}) rotate(-24)` }, lipstick(by(a, 104, 116, 96), rough))
  svg.append(
    s('defs', null, s('clipPath', { id: clipId }, side
      ? s('rect', { x: x0 + 3, y: -600, width: 1200, height: 1200 })
      : s('rect', { x: x0 - 20, y: -600, width: w + 40, height: 600 + y0 + hh - 3 }))),
    P(blob(ex + 8, ey + hh * 0.56, w * 0.6, hh * 0.13, 21, 0.12), 't1-wash', { filter: a.wash }),
    openFlap, slip, front, closedFlap, stick)
  gsap.set(openFlap, { scaleY: 0, svgOrigin: `${ex} ${y0}` })
  gsap.set(slipBody, side ? { x: 0 } : { y: y0 - slipTop + 34 })
  const open = gsap.timeline({ paused: true })
    .to(closedFlap, { scaleY: 0, svgOrigin: `${ex} ${y0}`, duration: 0.55, ease: 'power2.in' })
    .to(openFlap, { scaleY: 1, svgOrigin: `${ex} ${y0}`, duration: 0.6, ease: 'power3.out' })
    .to(slipBody, side ? { x: slipW + 14, rotation: 2, svgOrigin: `${slipX} ${ey}`, duration: 1.3, ease: 'expo.out' } : { y: 0, duration: 1.3, ease: 'expo.out' }, '-=0.15')
  return { svg, tl: gsap.timeline({ paused: true }), open }
}

/** The small envelope that carries the question into each machine. */
const token = (rough: string | null) => g({ class: 't1-token' }, envelope(54, rough))

/** Fly the envelope in from beyond the left edge (wide) or the top (tall), along a soft arc. */
function fly(tl: gsap.core.Timeline, tok: SVGElement, a: Art, to: Pt, at?: string | number) {
  const from: Pt = a.wide ? [-320, to[1] - 40] : [to[0] - 40, -270]
  tl.fromTo(tok, { x: from[0], y: from[1], rotation: -12, opacity: 1 }, { x: to[0], duration: 1.2, ease: 'power2.inOut' }, at)
    .fromTo(tok, { y: from[1] }, { y: to[1], rotation: 0, duration: 1.2, ease: 'power2.inOut' }, '<')
}

// ── 1 · Traditional program: hanging ema tags, each carved with one condition; one matches, a hanko stamps template 3.
//       The second question ("da ngăm?") finds no tag at all.
function rulesMachine(a: Art, host: Element): Machine {
  const { rough, c } = a
  const E = c.eras[0]
  const svg = layer(host)
  const tw = by(a, 112, 120, 92), th = by(a, 70, 70, 60), fs = by(a, 15.5, 16, 15)
  const spots = by(a,
    [{ x: -140, rod: -84, top: -64 }, { x: 0, rod: -84, top: -64 }, { x: 140, rod: -84, top: -64 }],
    [{ x: -74, rod: -166, top: -146 }, { x: 74, rod: -166, top: -146 }, { x: 0, rod: -58, top: -38 }],
    [{ x: -2, rod: -60, top: -42 }, { x: 106, rod: -60, top: -42 }, { x: 214, rod: -60, top: -42 }])
  const rods = by(a, [[-210, 210, -84]], [[-150, 150, -166], [-80, 80, -58]], [[-60, 272, -60]])
  const env = by<Pt>(a, [-30, 62], [-30, 96], [-206, 14])

  const bamboo = (x1: number, x2: number, y: number, k: number) => g({ filter: rough },
    P(stroke([[x1, y + 1], [(x1 + x2) / 2, y - 1.5], [x2, y + 0.5]], 6.5, { head: 0.04, tail: 0.15, min: 0.55 }), 't1-bamboo'),
    P(stroke([[x1 + 8, y - 1.2], [(x1 + x2) / 2, y - 3.2], [x2 - 8, y - 1.4]], 1.3, { tail: 0.6 }), 't1-hi', { opacity: 0.5 }),
    ...[0.14, 0.38, 0.62, 0.86].map((f) => P(stroke([[x1 + (x2 - x1) * f, y - 4.5], [x1 + (x2 - x1) * f + 0.6, y + 3.5]], 2.4, { tail: 0.4 }), 't1-ink2', { 'data-k': k })))
  const glows: SVGElement[] = []
  const tags = (E.rules ?? []).map((rule, k) => {
    const { x, rod, top } = spots[k]
    const sh = top + tw * 0.18, bot = top + th
    const glow = P(blob(x, top + th * 0.55, tw * 0.62, th * 0.7, 40 + k, 0.1), k === 2 ? 't1-mossglow' : 't1-inkglow', { filter: a.wash, opacity: 0 })
    glows.push(glow)
    const body = g(null,
      s('line', { x1: x, y1: rod, x2: x, y2: top + 10, class: 't1-string' }),
      P(`M${x} ${top}L${x + tw / 2} ${sh}L${x + tw / 2} ${bot}L${x - tw / 2} ${bot}L${x - tw / 2} ${sh}Z`, 't1-wood'),
      P(stroke([[x - tw * 0.38, top + th * 0.36], [x, top + th * 0.33], [x + tw * 0.38, top + th * 0.38]], 1.4, { tail: 0.6 }), 't1-grain'),
      P(stroke([[x - tw * 0.4, top + th * 0.88], [x + tw * 0.1, top + th * 0.86], [x + tw * 0.4, top + th * 0.89]], 1.2, { tail: 0.6 }), 't1-grain'),
      g({ filter: rough },
        P(stroke([[x - tw / 2, sh], [x - tw / 4, top + tw * 0.09], [x, top]], 2.2, { tail: 0.4, min: 0.4 }), 't1-ink2'),
        P(stroke([[x, top], [x + tw / 4, top + tw * 0.09], [x + tw / 2, sh]], 2.2, { tail: 0.4, min: 0.4 }), 't1-ink2'),
        P(stroke([[x + tw / 2, sh], [x + tw / 2 + 0.6, (sh + bot) / 2], [x + tw / 2, bot]], 2.6, { tail: 0.4, min: 0.4 }), 't1-ink2'),
        P(stroke([[x + tw / 2, bot], [x, bot + 0.8], [x - tw / 2, bot]], 3.2, { tail: 0.4, min: 0.4 }), 't1-ink2'),
        P(stroke([[x - tw / 2, bot], [x - tw / 2 - 0.5, (sh + bot) / 2], [x - tw / 2, sh]], 2.2, { tail: 0.4, min: 0.4 }), 't1-ink2')),
      s('circle', { cx: x, cy: top + 10, r: 2.6, class: 't1-hole' }),
      T(x, top + th * 0.62 + fs * 0.32, rule, fs, 't1-tx t1-tx1', mid))
    return { g: body, x, rod }
  })
  const tok = token(rough)
  const stamp = g(null, hanko(E.stamp ?? [], 38, 38, rough, 31))
  // the unanswered half of the letter: a faint ghost of the words and a vermilion question mark
  const ghostAt = by<Pt>(a, [env[0] + 80, env[1] + 8], [env[0] + 44, env[1] + 52], [env[0] + 74, env[1] + 8])
  const miss = g({ opacity: 0 },
    T(env[0] + 50, env[1] + 13, '?', 40, 't1-tx t1-verq', { 'data-fs': null }),
    T(ghostAt[0], ghostAt[1], E.ghost ?? '', 15, 't1-tx t1-ghost', a.wide ? {} : mid))
  svg.append(...rods.map(([x1, x2, y], k) => bamboo(x1, x2, y, k)), ...glows, ...tags.map((t) => t.g),
    P(blob(env[0] + 4, env[1] + 24, 46, 6, 7, 0.1), 't1-wash', { filter: a.wash }), tok, stamp, miss)
  gsap.set(stamp, { x: spots[2].x, y: spots[2].top + th * 0.5, opacity: 0 })

  const tl = gsap.timeline({ paused: true })
  fly(tl, tok, a, env)
  tags.forEach((t, k) => {
    const at = k ? '>-0.15' : '>'
    tl.to(glows[k], { opacity: 1, duration: 0.45, ease: 'power2.out' }, at)
      .fromTo(t.g, { rotation: 0 }, { rotation: k === 2 ? 4 : 6, svgOrigin: `${t.x} ${t.rod}`, duration: 0.35, ease: 'power2.out', yoyo: true, repeat: 1 }, '<')
    if (k < 2) tl.to(glows[k], { opacity: 0, duration: 0.5 }, '+=0.15').to(t.g, { opacity: 0.42, duration: 0.5 }, '<')
  })
  tl.to(stamp, { opacity: 1, duration: 0.3 }, '+=0.1')
    .to(stamp, { x: env[0] + 4, y: env[1] - 4, rotation: -8, duration: 0.9, ease: 'power3.inOut' }, '<')
    .fromTo(stamp, { scale: 1.5 }, { scale: 1, duration: 0.9, ease: 'power3.in', transformOrigin: '50% 50%' }, '<')
    .fromTo(tok, { scale: 1 }, { scale: 0.94, duration: 0.12, yoyo: true, repeat: 1, transformOrigin: '50% 50%' })
    .fromTo(miss, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out' }, '+=0.4')
  return { svg, tl }
}

// ── 2 · Machine learning: a pile of example letters, each sealed with its answer, sorts itself into woven baskets;
//       then ours, with no seal, finds the right basket on its own.
/** A round woven basket (kago) seen a little from above, drawn with brush strokes around its rim centre (x, y). */
function basket(a: Art, x: number, y: number, rx: number, seed: number, seal: string) {
  const r = rng(seed)
  const ry = rx * 0.3, depth = rx * 0.95, bot = y + depth
  const L = x - rx, R = x + rx
  const belly = `M${L} ${y}C${L - rx * 0.14} ${y + depth * 0.58} ${x - rx * 0.66} ${bot} ${x} ${bot}C${x + rx * 0.66} ${bot} ${R + rx * 0.14} ${y + depth * 0.58} ${R} ${y}A${rx} ${ry} 0 0 1 ${L} ${y}Z`
  // woven bands: tapered strokes that follow the belly's curve, broken by the dry brush
  const bands = [0.3, 0.55, 0.8].map((f0) => {
    const f = f0 + (r() - 0.5) * 0.06
    const yy = y + depth * f
    const ww = rx * (1.06 - 0.5 * f * f)
    return P(stroke([[x - ww, yy - ry * 0.25], [x - ww * 0.4, yy + ry * 0.55], [x + ww * 0.4, yy + ry * 0.55], [x + ww, yy - ry * 0.25]], 2.6 + r() * 1.6, { head: 0.12, tail: 0.5, min: 0.25 }), 't1-weave')
  })
  const back = g(null,
    P(blob(x + rx * 0.25, bot + 3, rx * 1.15, rx * 0.2, seed + 3, 0.12), 't1-wash', { filter: a.wash }),
    s('ellipse', { cx: x, cy: y, rx: rx - 1.5, ry: ry - 1, class: 't1-mouth', filter: a.wash ?? undefined }),
    P(stroke(arc(x, y, rx, ry, Math.PI * 1.04, Math.PI * 1.96, 11), 1.6, { head: 0.1, tail: 0.5, min: 0.3 }), 't1-ink3', { filter: a.rough }))
  const front = g(null,
    P(belly, 't1-basket'),
    // the shaded side, away from the light
    P(stroke([[R - rx * 0.08, y + ry * 0.6], [R + rx * 0.06, y + depth * 0.5], [x + rx * 0.45, bot - 2]], rx * 0.4, { head: 0.3, tail: 0.6, min: 0.2 }), 't1-wash', { filter: a.wash }),
    g({ filter: a.rough }, ...bands),
    g({ filter: a.rough },
      P(stroke([[L, y + 1], [L - rx * 0.1, y + depth * 0.52], [x - rx * 0.5, bot - 1.5], [x, bot]], 1.6, { head: 0.1, tail: 0.8, min: 0.3 }), 't1-ink3'),
      P(stroke([[x - rx * 0.1, bot], [x + rx * 0.55, bot - 1.5], [R + rx * 0.1, y + depth * 0.52], [R, y + 1]], 2.8, { head: 0.2, tail: 0.5, min: 0.3 }), 't1-ink2'),
      P(stroke(arc(x, y, rx + 0.5, ry + 0.5, -0.04, Math.PI + 0.04, 15), 4, { head: 0.06, tail: 0.45, min: 0.3 }), 't1-ink2')),
    P(blob(x + rx * 0.42, y + depth * 0.46, 4.4, 3.8, seed + 9, 0.2, 10), seal))
  return { back, front }
}

function sortMachine(a: Art, host: Element): Machine {
  const { c } = a
  const E = c.eras[1]
  const svg = layer(host)
  const r = rng(42)
  const BX = by(a, [-140, 0, 140], [-104, 0, 104], [-150, 0, 150])
  const BY = by(a, 8, 40, -2), brx = by(a, 46, 42, 34)
  const depth = brx * 0.95
  const labelY = BY + depth + 24
  const pileY = by(a, -66, -112, -48)
  const SEAL = ['t1-moss', 't1-ink3', 't1-stone']
  const glow = P(blob(BX[0], BY + depth * 0.45, brx * 1.5, depth * 1.1, 8, 0.1), 't1-mossglow', { filter: a.wash, opacity: 0 })
  const baskets = BX.map((x, k) => basket(a, x, BY, brx, 60 + k * 7, SEAL[k]))
  // compact strip: only the basket our letter lands in is named
  const names = a.mode === 'compact' ? (E.baskets ?? []).slice(0, 1) : E.baskets ?? []
  const labels = names.map((t, k) => T(BX[k], labelY, t, 14.5, k === 0 ? 't1-tx t1-tx1' : 't1-tx t1-tx3', { ...mid, opacity: 0 }))

  // labelled examples: same seal colour = same answer; they start as a loose pile and fly to their basket
  const KIND = [0, 1, 0, 2, 0, 1, 0, 2, 1, 0, 2, 0, 1, 0]
  const used = [0, 0, 0]
  const ex = KIND.map((k, i) => {
    const n = used[k]++
    const el = g(null, envelope(22, null, SEAL[k], 50 + i))
    const from: Pt = [(r() - 0.5) * by(a, 150, 130, 170), pileY + (r() - 0.5) * 26]
    const to: Pt = [BX[k] + ((n % 3) - 1) * brx * 0.36 + (r() - 0.5) * 4, BY - 2 + (n > 2 ? -4 : 0)]
    return { el, k, from, to, rot: (r() - 0.5) * 50 }
  })
  const tok = token(a.rough)
  // letters drop into the mouths (behind the basket fronts)
  svg.append(glow, ...baskets.map((b) => b.back), ...ex.map((e) => e.el), tok, ...baskets.map((b) => b.front), ...labels)
  ex.forEach((e) => gsap.set(e.el, { x: e.from[0], y: e.from[1], rotation: e.rot, opacity: 0 }))
  gsap.set(tok, { opacity: 0 })

  const tl = gsap.timeline({ paused: true })
  tl.to(ex.map((e) => e.el), { opacity: 1, duration: 0.3, stagger: 0.04 }, 0)
  ex.forEach((e, i) => {
    const at = 0.7 + i * 0.13
    tl.to(e.el, { x: e.to[0], duration: 1.1, ease: 'power1.inOut' }, at)
      .to(e.el, { y: e.to[1], rotation: (r() - 0.5) * 16, duration: 1.1, ease: 'power2.in' }, at)
  })
  tl.to(labels, { opacity: 1, duration: 0.8, stagger: 0.12 }, '-=0.4')
  const drop: Pt = [BX[0] + 2, BY - 7]
  tl.fromTo(tok, { x: 10, y: pileY - 30, rotation: -10, opacity: 0, scale: 1 }, { opacity: 1, duration: 0.3 }, '+=0.3')
    .to(tok, { x: drop[0], duration: 1.5, ease: 'power1.inOut' })
    .to(tok, { y: drop[1], rotation: -4, scale: 0.8, duration: 1.5, ease: 'power2.in' }, '<')
    .to(glow, { opacity: 1, duration: 0.9 }, '-=0.2')
    .fromTo(labels[0] ?? [], { scale: 1 }, { scale: 1.08, transformOrigin: '50% 50%', duration: 0.3, yoyo: true, repeat: 1 }, '<')
  return { svg, tl }
}

// ── 3 · Deep learning: layers are rows of stones in raked sand; ripples of attention pass from row to row.
function layersMachine(a: Art, host: Element): Machine {
  const { wide, rough, c } = a
  const E = c.eras[2]
  const svg = layer(host)
  const COUNT = [4, 5, 4, 2]
  const FIRE = [[0, 1, 2, 3], [0, 2, 3], [1, 2], [0, 1]]
  const gap = by(a, 34, 58, 26)
  const lines = by(a, [-192, -96, 0, 96], [-138, -54, 30, 114], [-210, -110, -10, 90])
  const pos = (l: number, i: number): Pt => {
    const o = (i - (COUNT[l] - 1) / 2) * gap * (l === 3 ? 1.9 : 1)
    return wide ? [lines[l], o] : [o, lines[l]]
  }
  const srx = by(a, 17, 18, 15), sry = by(a, 11, 11, 9)
  const rakes: SVGElement[] = []
  const stones: SVGElement[] = []
  const lit: SVGElement[][] = []
  const halos: SVGElement[][] = []
  const rings: SVGElement[][] = []
  COUNT.forEach((n, l) => {
    lit.push([])
    halos.push([])
    rings.push([])
    for (let i = 0; i < n; i++) {
      const [x, y] = pos(l, i)
      const seed = l * 10 + i
      for (const k of [8, 15]) rakes.push(s('ellipse', { cx: x, cy: y + 1, rx: srx + k, ry: sry + k * 0.62, class: 't1-rk' }))
      stones.push(g(null,
        P(blob(x + 3, y + 5, srx * 1.05, sry * 0.75, seed + 300, 0.1), 't1-wash', {}),
        P(blob(x, y, srx, sry, seed, 0.12, 16), 't1-stone2', { filter: rough }),
        P(blob(x - srx * 0.22, y - sry * 0.32, srx * 0.55, sry * 0.38, seed + 100, 0.15, 12), 't1-stonehi'),
        P(stroke([[x - srx * 0.9, y + sry * 0.25], [x, y + sry * 0.98], [x + srx * 0.92, y + sry * 0.2]], 2.4, { head: 0.15, tail: 0.6, min: 0.25 }), 't1-ink2', { filter: rough })))
      if (FIRE[l].includes(i)) {
        const out = l === 3
        halos[l].push(P(blob(x, y + 2, srx * 1.9, sry * 1.9, seed + 400, 0.14), out ? 't1-verglow' : 't1-mossglow', { opacity: 0, filter: a.wash }))
        lit[l].push(P(blob(x, y, srx * 1.02, sry * 1.02, seed + 200, 0.12, 16), out ? 't1-ver' : 't1-moss', { opacity: 0, filter: rough }))
        rings[l].push(s('ellipse', { cx: x, cy: y + 1, rx: srx + 4, ry: sry + 3, class: out ? 't1-ring t1-ring-ver' : 't1-ring', opacity: 0 }))
      }
    }
  })
  const labels = (E.layers ?? []).map((t, l) => {
    const [x, y] = wide ? [lines[l], by(a, -92, 0, -66)] : [-162, lines[l] - 26]
    return T(x, y, t, 13.5, 't1-tx t1-tx3', { ...(wide ? mid : {}), opacity: 0 })
  })
  const outs = (E.understood ?? []).map((t, i) => {
    const [x, y] = pos(3, i)
    return wide ? T(x + srx + 14, y + 5, t, 14.5, 't1-tx t1-tx1', { opacity: 0 }) : T(x, y + sry + 26, t, 14.5, 't1-tx t1-tx1', { ...mid, opacity: 0 })
  })
  const tok = token(rough)
  const entry: Pt = wide ? [lines[0] - 46, 0] : [0, lines[0] - 46]
  svg.append(g(null, ...rakes), ...halos.flat(), ...stones, ...rings.flat(), ...lit.flat(), ...labels, ...outs, tok)

  const tl = gsap.timeline({ paused: true })
  fly(tl, tok, a, entry)
  tl.to(tok, { opacity: 0, scale: 0.5, transformOrigin: '50% 50%', duration: 0.45 })
  COUNT.forEach((_, l) => {
    const at = l ? '>-0.55' : '<0.15'
    tl.fromTo(rings[l], { opacity: 0.95, scale: 0.7 }, { opacity: 0, scale: 2.6, transformOrigin: '50% 50%', duration: 1.6, ease: 'power2.out', stagger: 0.05 }, at)
      .to(lit[l], { opacity: l === 3 ? 0.88 : 0.5, duration: 0.6, stagger: 0.06, ease: 'power2.out' }, '<')
      .to(halos[l], { opacity: 1, duration: 0.9, stagger: 0.06, ease: 'power2.out' }, '<')
      .to(labels[l] ?? [], { opacity: 1, duration: 0.7 }, '<0.1')
  })
  tl.to(outs, { opacity: 1, duration: 1, stagger: 0.3, ease: 'power3.out' }, '-=0.6')
  return { svg, tl }
}

/** Suzuri: a natural-edged inkstone slab seen from above-front — a dark front face, a worn grinding plane, and the
 *  "sea" where the ink pools, wet and glinting, at the far end. */
function inkstone(a: Art, cx: number, cy: number, w: number, d: number) {
  const th = Math.max(6, d * 0.26)
  const r = rng(77)
  // a rounded oblong with a natural, slightly uneven edge
  const slab = (x0: number, y0: number): Pt[] => blobPts(0, 0, 1, 1, 18, 0.05, 28).map(([u, v], i) => {
    const a = (i / 28) * Math.PI * 2
    const k = Math.hypot(u, v)
    const c = Math.cos(a), s2 = Math.sin(a)
    return [x0 + (w / 2) * k * Math.sign(c) * Math.pow(Math.abs(c), 0.55), y0 + (d / 2) * k * Math.sign(s2) * Math.pow(Math.abs(s2), 0.55)]
  })
  const top = slab(cx, cy)
  const sea: Pt = [cx - w * 0.04, cy - d * 0.17]
  // dry streaks across the grinding plane, where the ink stick has polished the stone
  const streaks = Array.from({ length: 2 }, (_, i) => {
    const y = cy + d * (0.06 + i * 0.14) + (r() - 0.5) * 2
    const xa = cx - w * (0.26 - r() * 0.08), xb = cx + w * (0.14 + r() * 0.14)
    return P(stroke([[xa, y], [(xa + xb) / 2, y - 0.6], [xb, y + 0.3]], 1 + r() * 1.3, { head: 0.08, tail: 1.1 }), 't1-slatehi')
  })
  // the front face: the same outline dropped by the slab's thickness, seen only below the top
  const face = slab(cx + 1.5, cy + th)
  // points run right → bottom → left → top: the front (lower) edge is the first half, the back edge the second
  const frontEdge = face.slice(0, 15)
  const backEdge = top.slice(14).concat(top.slice(0, 1))
  return {
    sea,
    el: g(null,
      P(blob(cx + w * 0.12, cy + th + d * 0.38, w * 0.58, d * 0.2, 19, 0.12), 't1-wash', { filter: a.wash }),
      P(curve(face), 't1-slate', { filter: a.rough }),
      P(curve(top), 't1-slatetop', { filter: a.rough }),
      P(blob(cx + w * 0.05, cy + d * 0.12, w * 0.36, d * 0.24, 31, 0.14), 't1-slategrind', { filter: a.wash }),
      g({ opacity: 0.45 }, ...streaks),
      P(blob(sea[0], sea[1], w * 0.3, d * 0.15, 23, 0.16, 16), 't1-well', { filter: a.rough }),
      P(stroke([[sea[0] - w * 0.2, sea[1] - d * 0.04], [sea[0] - w * 0.04, sea[1] - d * 0.11], [sea[0] + w * 0.14, sea[1] - d * 0.07]], 1.6, { tail: 0.9 }), 't1-hi', { opacity: 0.5 }),
      // brush contour: pressed along the shaded front edge, a hairline along the lit back edge
      P(stroke(frontEdge, 3.2, { head: 0.12, tail: 0.5, min: 0.35 }), 't1-ink', { filter: a.rough }),
      P(stroke(backEdge, 1.1, { head: 0.2, tail: 0.8, min: 0.2 }), 't1-ink3', { opacity: 0.7 })),
  }
}

// ── 4 · Generative AI: a fude brush dips into the inkstone and writes a brand-new reply; the stroke reveals the words.
function brushMachine(a: Art, host: Element): Machine {
  const { rough, c } = a
  const E = c.eras[3]
  const svg = layer(host)
  const sh = by(a, { x: -66, y: -74, w: 302, h: 150 }, { x: -152, y: 18, w: 304, h: 124 }, { x: -96, y: -64, w: 330, h: 120 })
  const fs = by(a, 16, 16.5, 15.5), lh = by(a, 28, 29, 25)
  const lines = (E.reply ?? '').split(/(?<=\.)\s+/).flatMap((sentence) => wrap(sentence, sh.w - 44, fs))
  const tx = sh.x + 22, ty0 = sh.y + by(a, 44, 44, 36)
  const slab = by(a, { x: -160, y: 54, w: 94, d: 40 }, { x: -62, y: -34, w: 96, d: 40 }, { x: -196, y: 42, w: 84, d: 32 })
  const stone = inkstone(a, slab.x, slab.y, slab.w, slab.d)
  const well = stone.sea

  const paper = g(null,
    P(sheet(sh.x + 6, sh.y + 8, sh.w, sh.h, 14), 't1-wash', { filter: a.wash }),
    P(sheet(sh.x, sh.y, sh.w, sh.h, 15), 't1-card'),
    P(stroke([[sh.x, sh.y + sh.h], [sh.x + sh.w / 2, sh.y + sh.h + 0.8], [sh.x + sh.w, sh.y + sh.h]], 1.6, { tail: 0.3, min: 0.3 }), 't1-ink3', { filter: rough }))
  const pool = s('ellipse', { cx: well[0], cy: well[1], rx: 9, ry: 3.2, class: 't1-ring t1-ring-ver', opacity: 0 })

  // reply lines, each revealed by a clip rect that follows the brush tip
  const clips: SVGRectElement[] = []
  const defs = s('defs')
  const words = lines.map((ln, i) => {
    const id = nextId('t1-wr')
    const rect = s('rect', { x: tx - 4, y: ty0 + i * lh - fs * 1.1, width: 0, height: fs * 1.6 })
    clips.push(rect)
    defs.append(s('clipPath', { id }, rect))
    return { el: T(tx, ty0 + i * lh, ln, fs, 't1-tx t1-tx1', { 'clip-path': `url(#${id})`, 'data-fs': null }), w: measure(ln, fs) + 6, y: ty0 + i * lh }
  })
  const seal = g({ opacity: 0 }, hanko([E.seal ?? ''], 70, 26, rough, 61))
  const sealAt: Pt = [sh.x + sh.w - 54, sh.y + sh.h - 26]

  // the brush: tip at the origin; a fat bristle head (wider than the handle), a ferrule, a bamboo handle with nodes
  const HEAD = by(a, 44, 44, 34), HANDLE = by(a, 92, 78, 52)
  const top = -HEAD - 7 - HANDLE
  const brushArt = g(null,
    P(sheet(-4.2, top, 8.4, HANDLE, 6), 't1-bamboo'),
    P(stroke([[1.6, top + 4], [2, top + HANDLE * 0.5], [1.6, -HEAD - 10]], 1.5, { tail: 0.5 }), 't1-hi', { opacity: 0.45 }),
    ...[0.3, 0.66].map((f) => g(null,
      P(blob(0, top + HANDLE * f, 5.4, 1.7, 7 + f * 10, 0.08, 10), 't1-bamboo'),
      P(stroke([[-4.6, top + HANDLE * f], [0, top + HANDLE * f + 0.8], [4.6, top + HANDLE * f]], 1.2, { tail: 0.4 }), 't1-ink2'))),
    P(sheet(-4.8, top - 4, 9.6, 5, 9), 't1-ink2'),
    P(sheet(-6, -HEAD - 7, 12, 8, 5), 't1-ink2'),
    P(stroke([[-5.4, -HEAD - 3.6], [5.4, -HEAD - 3.2]], 1, { tail: 0.4 }), 't1-hi', { opacity: 0.35 }),
    P(`M-6.4 ${-HEAD}C-10 ${-HEAD * 0.62} -7.4 ${-HEAD * 0.22} 0 0C7.4 ${-HEAD * 0.22} 10 ${-HEAD * 0.62} 6.4 ${-HEAD}Z`, 't1-ink', { filter: rough }),
    P(stroke([[-3.4, -HEAD + 3], [-3.6, -HEAD * 0.5], [-0.6, -5]], 1.4, { tail: 1 }), 't1-hi', { opacity: 0.25 }))
  const tilt = g(null, brushArt)
  const brush = g({ class: 't1-brush' }, tilt)
  const tok = token(rough)
  svg.append(defs, paper, stone.el, pool, ...words.map((w) => w.el), seal, tok, brush)
  const rest: Pt = [well[0] + 4, well[1] - 3]
  gsap.set(brush, { x: rest[0], y: rest[1] })
  gsap.set(seal, { x: sealAt[0], y: sealAt[1], rotation: -6 })
  const tiltP = { r: -12 }
  const setTilt = () => tilt.setAttribute('transform', `rotate(${tiltP.r.toFixed(2)})`)
  setTilt()

  const tl = gsap.timeline({ paused: true })
  fly(tl, tok, a, [well[0], well[1] - 4])
  tl.to(tok, { opacity: 0, scale: 0.3, transformOrigin: '50% 50%', duration: 0.35 })
    .fromTo(pool, { opacity: 0.95, scale: 1 }, { opacity: 0, scale: 3.4, transformOrigin: '50% 50%', duration: 1.3, ease: 'power2.out' }, '<')
    .to(brush, { y: rest[1] + 6, duration: 0.3, ease: 'power1.in', yoyo: true, repeat: 1 }, '<0.2')
    .to(tiltP, { r: 58, duration: 0.9, ease: 'power3.inOut', onUpdate: setTilt }) // held at a slant so the handle stays in frame
  words.forEach((w, i) => {
    const p = { v: 0 }
    const y = w.y - 4
    tl.to(brush, { x: tx, y, duration: i ? 0.55 : 1, ease: 'power3.inOut' }, i ? '>' : '<')
      .to(p, {
        v: 1, duration: 0.5 + w.w / 150, ease: 'sine.inOut',
        onUpdate: () => {
          clips[i].setAttribute('width', (w.w * p.v + 4).toFixed(1))
          gsap.set(brush, { x: tx + w.w * p.v, y: y + Math.sin(p.v * 18) * 1.6 })
        },
      })
  })
  tl.to(brush, { x: rest[0], y: rest[1], duration: 1.1, ease: 'power3.inOut' }, '+=0.15')
    .to(tiltP, { r: -12, duration: 1.1, ease: 'power3.inOut', onUpdate: setTilt }, '<')
    .fromTo(seal, { opacity: 0, scale: 1.7 }, { opacity: 1, scale: 1, transformOrigin: '50% 50%', duration: 0.55, ease: 'power3.in' }, '<0.5')
  return { svg, tl }
}

const BUILDERS = [rulesMachine, sortMachine, layersMachine, brushMachine]

/** Scene 2: one customer email, four machines. Walk the raked path; the picture morphs between eras. */
export function mountLadder(ctx: SceneCtx, c: LadderCopy) {
  const lowQ = ctx.quality === 'low'
  const rough = lowQ ? null : 'url(#ink-rough)'
  const wash = lowQ ? null : 'url(#ink-wash)'
  const dry = lowQ ? null : 'url(#ink-dry)'
  const stageEl = h('div', { class: 't1-lad-stage sand' })
  const openBtn = h('button', { class: 't1-open', type: 'button', 'aria-label': c.openLabel })
  const eraEl = h('p', { class: 't1-era', 'aria-live': 'polite' })
  const rake = s('svg', { class: 't1-rake', 'aria-hidden': 'true' })
  const marker = h('span', { class: 't1-marker', 'aria-hidden': 'true' }, pebbleArt(rough))
  // stepping stones painted in ink like the garden's (scene 1); a visited stone has grown a little moss
  const stopArt = [0, 1, 2, 3, 4].map((i) => {
    const shape: StoneShape = { seed: 71 + i * 7, profile: i ? [0, 0.2, 0.27, 0.25, 0.19, 0] : [0, 0.26, 0.32, 0.27, 0] }
    const bare = h('canvas', { class: 't1-stop-bare' })
    const moss = h('canvas', { class: 't1-stop-moss' })
    return { bare, moss, paint: (ink: StoneInk) => (paintStone(bare, shape, ink, 0.4), i && paintStone(moss, { ...shape, moss: [-0.12, 0.5] }, ink, 0.4)) }
  })
  const paintStops = () => stopArt.forEach((a) => a.paint(themeInk()))
  paintStops()
  const offPrefs = onPrefs(paintStops)
  const stopBtns = [0, 1, 2, 3, 4].map((i) =>
    h('button', {
      class: i ? 't1-stop' : 't1-stop t1-pebble',
      type: 'button',
      'aria-label': i ? `${i}. ${c.eras[i - 1].name}` : c.startLabel,
      onClick: () => go(i),
    }, h('span', { class: 't1-stop-art', 'aria-hidden': 'true' }, stopArt[i].bare, i ? stopArt[i].moss : null)))
  const pathEl = h('div', { class: 't1-path', role: 'group', 'aria-label': c.pathLabel }, rake, ...stopBtns, marker)
  const root = h('div', { class: 't1-lad' }, stageEl, h('div', { class: 't1-lad-foot' }, eraEl, pathEl))
  stageEl.append(openBtn)
  ctx.art.append(root)
  ctx.prompt(c.prompt)

  let machines: Machine[] = []
  let intro: ReturnType<typeof introArt> | null = null
  let mode: Mode | null = null
  let compact = false
  let stops = [0.07, 0.28, 0.49, 0.7, 0.91]
  let cur = 0
  let f = 0 // continuous position along the path while dragging/gliding
  let opened = false
  const visited = new Set<number>()
  let finalShown = false
  let finalCall: gsap.core.Tween | null = null
  let insightCall: gsap.core.Tween | null = null
  let glide: gsap.core.Tween | null = null
  let eraTl: gsap.core.Animation | null = null
  let eraName = ''
  let disposed = false

  let pathW = 0 // pathEl.clientWidth, cached in drawRake (the ResizeObserver): weights() runs every frame of a glide
  const weights = (pos: number) => {
    for (let i = 0; i < machines.length; i++) {
      const m = machines[i]
      const w = Math.max(0, 1 - Math.abs(pos - i))
      m.svg.style.opacity = String(w)
      m.svg.style.filter = w > 0.999 || ctx.reduced ? '' : `blur(${((1 - w) * 8).toFixed(1)}px)`
      m.svg.style.visibility = w <= 0.001 ? 'hidden' : 'visible'
    }
    const x = (stops[0] + (stops[4] - stops[0]) * (pos / 4)) * pathW
    marker.style.transform = `translate(${x.toFixed(1)}px, 0)`
  }

  /** Every layer shares one viewBox: the stage in px divided by the scale that fits the core box. */
  const fitView = () => {
    const r = stageEl.getBoundingClientRect()
    if (r.width < 2 || r.height < 2 || mode == null) return
    const [cw, ch] = CORE[mode]
    const B = compact ? 30 : 0 // the path overlays the picture's quiet bottom margin
    const k = Math.min((r.width - 12) / cw, (r.height - B - 6) / ch, 1.9)
    const vb = `${(-r.width / 2 / k).toFixed(1)} ${(-(r.height - B) / 2 / k).toFixed(1)} ${(r.width / k).toFixed(1)} ${(r.height / k).toFixed(1)}`
    const minFs = MIN_FS / k
    machines.forEach((m) => {
      m.svg.setAttribute('viewBox', vb)
      m.svg.querySelectorAll<SVGTextElement>('text[data-fs]').forEach((t) => t.setAttribute('font-size', Math.max(Number(t.dataset.fs), minFs).toFixed(1)))
      m.svg.querySelectorAll<SVGGElement>('g[data-hk]').forEach((el) => el.setAttribute('transform', `scale(${Math.max(1, minFs / Number(el.dataset.hk)).toFixed(3)})`))
    })
  }

  const build = (md: Mode) => {
    machines.forEach((m) => (m.tl.kill(), m.svg.remove()))
    intro?.open.kill()
    const art: Art = { mode: md, wide: md !== 'tall', rough, wash, dry, c }
    intro = introArt(art, stageEl)
    machines = [intro, ...BUILDERS.map((b) => b(art, stageEl))]
    if (opened) intro.open.progress(1)
    if (cur > 0) machines[cur].tl.progress(1)
    stageEl.append(openBtn)
    fitView()
    weights(f)
  }

  const measureStage = () => {
    const ar = ctx.art.getBoundingClientRect()
    compact = ar.height < 260
    root.classList.toggle('is-compact', compact)
    const r = stageEl.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) return
    const md: Mode = compact ? 'compact' : r.width / r.height > 1.15 ? 'wide' : 'tall'
    if (md !== mode) {
      mode = md
      ctx.anim(() => build(md))
    } else fitView()
  }

  const drawRake = () => {
    const W = pathEl.clientWidth, H = pathEl.clientHeight
    pathW = W
    if (W < 2 || H < 2) return
    stops = W < 420 ? [0.1, 0.3, 0.5, 0.7, 0.9] : [0.07, 0.28, 0.49, 0.7, 0.91]
    const cy = H * 0.56
    const big = W > 520 ? 1 : 0.8
    const zones = stops.map((p, i) => ({ x: p * W, r: (i ? 34 : 19) * big }))
    rake.setAttribute('viewBox', `0 0 ${W} ${H}`)
    const out: SVGElement[] = []
    const inZone = (x: number, y: number, pad: number) => zones.some((z) => Math.hypot(x - z.x, (y - cy) / 0.6) < z.r + pad)
    for (let y0 = 5; y0 < H - 2; y0 += 7) {
      let d = ''
      let on = false
      for (let x = 0; x <= W; x += 5) {
        const y = y0 + Math.sin(x * 0.018 + y0 * 0.3) * 0.8
        if (inZone(x, y, 16)) {
          on = false
          continue
        }
        d += `${on ? 'L' : 'M'}${x} ${y.toFixed(1)}`
        on = true
      }
      if (d) out.push(s('path', { d }))
    }
    for (const z of zones) for (const k of [0, 8, 16]) out.push(s('ellipse', { cx: z.x, cy, rx: z.r + k, ry: (z.r + k) * 0.6 }))
    rake.replaceChildren(g({ class: 't1-rake-lo' }, ...out.map((e) => e.cloneNode() as SVGElement)), g({ class: 't1-rake-hi' }, ...out))
    stopBtns.forEach((btn, i) => (btn.style.left = `${stops[i] * 100}%`))
    weights(f)
  }

  const ro = new ResizeObserver(() => {
    measureStage()
    drawRake()
  })
  ro.observe(ctx.art)
  ro.observe(stageEl)
  ro.observe(pathEl)

  /** The era's name floats above the path while the picture plays; it gives way once the insight is written. */
  const setEra = (name: string) => {
    if (eraName === name) return
    eraName = name
    if (ctx.reduced) return void (eraEl.textContent = name)
    ctx.anim(() => {
      eraTl?.kill()
      eraTl = gsap.timeline()
        .to(eraEl, { opacity: 0, y: -4, duration: 0.25 })
        .call(() => void (eraEl.textContent = name))
        .fromTo(eraEl, { opacity: 0, y: 6 }, { opacity: name ? 1 : 0, y: 0, duration: 0.8, ease: 'power3.out' })
    })
  }

  const sync = () => {
    stopBtns.forEach((btn, i) => {
      btn.classList.toggle('on', i === cur)
      btn.classList.toggle('seen', visited.has(i))
      if (i === cur) btn.setAttribute('aria-current', 'step')
      else btn.removeAttribute('aria-current')
    })
    openBtn.hidden = opened || cur !== 0
    setEra(cur ? c.eras[cur - 1].name : opened ? c.startLabel : '')
  }

  const open = () => {
    if (opened) return
    opened = true
    if (ctx.reduced) intro?.open.progress(1)
    else intro?.open.play()
    ctx.chime('soft')
    ctx.prompt(c.walk)
    sync()
  }
  openBtn.addEventListener('click', () => {
    open()
    stopBtns[0].focus({ preventScroll: true })
  })

  function go(i: number, fromDrag = false) {
    i = Math.max(0, Math.min(4, i))
    const changed = i !== cur
    if (!changed && !fromDrag) return
    if (i > 0 && !opened) {
      opened = true
      intro?.open.progress(1)
    }
    const prev = cur
    cur = i
    finalCall?.kill()
    insightCall?.kill()
    glide?.kill()
    if (changed) {
      machines[prev]?.tl.pause()
      if (i > 0) machines[i]?.tl.pause(0)
    }
    const arrive = () => {
      if (!changed || i === 0) return
      const m = machines[i]
      if (ctx.reduced) m.tl.progress(1)
      else m.tl.restart()
      const era = c.eras[i - 1]
      visited.add(i)
      sync()
      ctx.chime('tap')
      // picture first, then the sentence; the era name gives way to it (the sentence starts with the same name)
      const reveal = () => {
        ctx.insight(era.insight, era.milestone)
        setEra('')
        if (visited.size === 4 && !finalShown) {
          finalShown = true
          ctx.anim(() => {
            finalCall = gsap.delayedCall(ctx.reduced ? 4 : Math.max(4, m.tl.duration() + 2), () => ctx.insight(c.final, c.finalDetail))
          })
        }
      }
      if (ctx.reduced) reveal()
      else ctx.anim(() => void (insightCall = gsap.delayedCall(1.3, reveal)))
    }
    sync()
    if (ctx.reduced) {
      f = i
      weights(f)
      arrive()
      return
    }
    ctx.anim(() => {
      const o = { v: f }
      glide = gsap.to(o, {
        v: i, duration: 0.5 + Math.min(1, Math.abs(i - f) * 0.35), ease: 'power3.inOut',
        onUpdate: () => ((f = o.v), weights(f)),
        onComplete: arrive,
      })
    })
  }

  // ── Drag the marker (or anywhere on the path); release snaps to the nearest stone.
  let dragId: number | null = null
  let downX = 0
  const posFromX = (clientX: number) => {
    const r = pathEl.getBoundingClientRect()
    const p = (clientX - r.left) / r.width
    return Math.max(0, Math.min(4, ((p - stops[0]) / (stops[4] - stops[0])) * 4))
  }
  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return
    dragId = e.pointerId
    downX = e.clientX
    try {
      pathEl.setPointerCapture(e.pointerId)
    } catch {
      /* pointer already gone */
    }
    pathEl.classList.add('is-dragging')
    glide?.kill()
  }
  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== dragId) return
    if (Math.abs(e.clientX - downX) < 4) return
    f = posFromX(e.clientX)
    weights(f)
  }
  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== dragId) return
    dragId = null
    pathEl.classList.remove('is-dragging')
    const moved = Math.abs(e.clientX - downX) >= 4
    go(Math.round(moved ? f : posFromX(e.clientX)), true)
  }
  pathEl.addEventListener('pointerdown', onDown)
  pathEl.addEventListener('pointermove', onMove)
  pathEl.addEventListener('pointerup', onUp)
  pathEl.addEventListener('pointercancel', onUp)
  const onKey = (e: KeyboardEvent) => {
    const k = e.key
    const next = k === 'ArrowRight' || k === 'ArrowDown' ? cur + 1 : k === 'ArrowLeft' || k === 'ArrowUp' ? cur - 1 : k === 'Home' ? 0 : k === 'End' ? 4 : null
    if (next == null) return
    e.preventDefault()
    go(next)
    stopBtns[cur].focus()
  }
  pathEl.addEventListener('keydown', onKey)

  // Build once the serif is ready, so in-art text wraps with the real metrics.
  const start = () => {
    if (disposed) return
    measureStage()
    drawRake()
    sync()
  }
  if (document.fonts?.check?.('400 13px "Noto Serif"', 'Đỏ Gạch')) start()
  else document.fonts.load('400 13px "Noto Serif"', 'Đỏ Gạch').then(start, start)

  return () => {
    disposed = true
    offPrefs()
    ro.disconnect()
    finalCall?.kill()
    insightCall?.kill()
    glide?.kill()
    eraTl?.kill()
    intro?.open.kill()
    machines.forEach((m) => m.tl.kill())
    pathEl.removeEventListener('pointerdown', onDown)
    pathEl.removeEventListener('pointermove', onMove)
    pathEl.removeEventListener('pointerup', onUp)
    pathEl.removeEventListener('pointercancel', onUp)
    pathEl.removeEventListener('keydown', onKey)
  }
}
