import raw from '../../content/tram-20.json'
import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { sliced } from '../../core/chunk'
import { onPrefs } from '../../core/prefs'
import type { SceneCtx } from '../types'
import { curve, onSize, p2Defs, rng, stableHeight, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import { grass, mist, moon, paperLantern } from '../../ui/part2/paint'
import { brush, col, glow, mix, mossDots, palette, range, type Pal, type RGB } from './ink2d'
import { guide } from '../../ui/part2/guide'
import { findTakeaway, foldedTakeaway } from '../../ui/part2/takeaway'

const M = raw.scenes.mason
const LINES = M.lines // one stone step per step of the solution, in plain words (audit v3 20-3: no raw Lean)
const DEG = Math.PI / 180

/** The stair's geometry in design units: risers Wb × Hb, treads Db deep, a camera low on the left (perspective P at o).
 *  xs: each block's sideways shift (tall: two flights, a zig-zag), sign/scroll/lamp: where they stand on the landing. */
interface Design { DW: number; DH: number; P: number; o: Pt; Wb: number; Hb: number; Db: number; from: [number, number, number]; rot: number; rots?: number[]; xs?: number[]; sign: number; lamp: [number, number]; mason: number; hang: [number, number, number] }
// wide: a long flight seen from its left flank; tall: two short flights folded back on the hillside, the steps ~70% wide
const WIDE: Design = { DW: 1100, DH: 620, P: 1100, o: [300, 260], Wb: 260, Hb: 78, Db: 96, from: [100, 480, 20], rot: -30, xs: [0, 90, 180, 270, 360], sign: 0.68, lamp: [1.3, -1.2], mason: 0.84, hang: [330, 330, 0] }
// tall: two flights folded on the hillside — up to the right, a turn, then back up to the left to the landing
const TALL: Design = { DW: 330, DH: 600, P: 820, o: [165, 380], Wb: 200, Hb: 72, Db: 46, from: [93, 470, 20], rot: -20, rots: [-20, -20, 22, 22, 22], xs: [0, 28, 0, -28, -56], sign: 0.55, lamp: [0.89, -1.2], mason: 0.8, hang: [253, 204, 0] }

/**
 * Scene 3 · the stonemason (2.5D, LOW from beside the stair; the camera stays put). A stair of rough stone climbs an earth
 * slope under the moon from bottom left to the landing at the top: real CSS-3D blocks (riser, tread, flank) painted with a
 * stone texture — moonlit treads, darker risers, chipped edges, moss in the joints — their feet sunk in the slope among
 * grass. One line of the Lean proof is cut into each riser. Tap a step: the old mason climbs onto it, swings his hammer, a
 * band of light runs along it and a chisel mark is struck at its end; its margin note appears. When every step rings true,
 * "the machine: every step checks out" is cut into the landing. Then the original problem's scroll can be held up to the
 * sign: lit from behind, everything fades but the mismatch — odd vs Even — in vermilion. The second mason (Isabelle)
 * appears on a parallel stair across the misty valley. Portrait: the stair folds into two flights.
 * Audit v3 20-3 (P1: the scroll step had no prompt, the answer showed early): the steps are plain words and must be tapped
 * in order (a step out of turn is refused: H6), a dot on the next one and "tapped n/4" at the stair's foot; then the dot
 * goes to the scroll, a dashed place on the sign, its own prompt; touched early, the scroll shakes. The card is handed
 * at the end as a folded slip.
 */
export function masonScene(ctx: SceneCtx) {
  p2Defs()
  const low = ctx.quality === 'low'
  const still = low || ctx.reduced
  const stableH = stableHeight(ctx, M.insights.map((x) => x as Fact))

  const mark = (text: string, word: string) => {
    const parts = text.split(word)
    return parts.flatMap((p, i) => (i ? [h('span', { class: 't20m-odd' }, word), p] : [p]))
  }
  const back = s('svg', { class: 't20m-back', 'aria-hidden': 'true' })
  const hill = s('svg', { class: 't20m-hill', 'aria-hidden': 'true' })
  const front = s('svg', { class: 't20m-hill t20m-front', 'aria-hidden': 'true' })
  const stage = h('div', { class: 't20m-stage' })
  const world = h('div', { class: 't20m-world' }, hill, stage, front)
  const done = new Set<number>()

  /** a stone face's chipped outline (clip-path): the top edge nicked here and there, the corners knocked */
  const chipped = (seed: number) => {
    const r = rng(seed)
    const pts: string[] = [`0% ${(2 + r() * 4).toFixed(1)}%`]
    for (let x = 6 + r() * 8; x < 96; x += 9 + r() * 16) {
      const d = r() < 0.4 ? 4 + r() * 7 : r() * 2
      pts.push(`${x.toFixed(1)}% ${d.toFixed(1)}%`, `${(x + 2 + r() * 3).toFixed(1)}% ${(r() * 1.5).toFixed(1)}%`)
    }
    pts.push(`${(97 + r() * 2).toFixed(1)}% 0%`, `100% ${(5 + r() * 6).toFixed(1)}%`, `${(99 - r() * 1.5).toFixed(1)}% 100%`, `${(1 + r() * 2).toFixed(1)}% 100%`)
    return `polygon(${pts.join(',')})`
  }
  // the check: a gouge struck by the chisel — a rough dark pit, its lower lip catching the moon, two chips knocked off
  const chisel = () => s('svg', { class: 't20m-chisel', viewBox: '0 0 24 16', 'aria-hidden': 'true' },
    s('path', { class: 't20m-chisel-cut', d: 'M3 9Q6 4.5 12 5.2Q19 5 21.5 7.6Q19 10.4 12 10.6Q6 11.4 3 9Z' }),
    s('path', { class: 't20m-chisel-lip', d: 'M4 9.6Q8 11.4 13 11Q18.5 10.6 21.5 7.8Q20 11.6 13 12.2Q7 12.6 4 9.6Z' }),
    s('path', { class: 't20m-chisel-cut', d: 'M1 5.5l1.6 0.6l-0.9 1.2Z M22 12.5l1.4 -0.4l-0.2 1.5Z' }))
  const steps = LINES.map((line, i) => {
    return h('button', { class: 't20m-step', type: 'button', style: `--i:${i}`, 'aria-label': fill(M.stepAria, { n: i + 1 }), 'aria-pressed': 'false', onClick: () => tap(i) },
      h('span', { class: 't20m-tread', 'aria-hidden': 'true', style: `clip-path:${chipped(2090 + i * 3)}` }),
      h('span', { class: 't20m-flank r', 'aria-hidden': 'true' }),
      h('span', { class: 't20m-flank l', 'aria-hidden': 'true' }),
      h('span', { class: 't20m-face', 'aria-hidden': 'true', style: `clip-path:${chipped(2080 + i * 7)}` }),
      h('span', { class: 't20m-line' }, line),
      h('span', { class: 't20m-glint', 'aria-hidden': 'true' }),
      chisel())
  })
  const landing = h('div', { class: 't20m-step t20m-landing', 'aria-hidden': 'true', style: `--i:${LINES.length}` },
    h('span', { class: 't20m-tread', style: `clip-path:${chipped(2099)}` }), h('span', { class: 't20m-flank r' }), h('span', { class: 't20m-flank l' }),
    h('span', { class: 't20m-face', style: `clip-path:${chipped(2098)}` }),
    h('p', { class: 't20m-ok' }, M.machineOk))
  // the old mason, crouched on the step, chisel to the stone, the hammer swung up behind him (its own group, it strikes)
  const masonArt = s('svg', { viewBox: '-34 -100 68 104', 'aria-hidden': 'true' },
    s('ellipse', { class: 't20m-mason-sh', cx: 2, cy: 1, rx: 24, ry: 4 }),
    s('g', { class: 't20m-hammer' },
      s('path', { class: 't20m-mason-ink', d: stroke([[-2, -54], [8, -66], [16, -78]], 5, 0.1, 0.2, 0.5) + stroke([[15, -76], [23, -92]], 2.4, 0.05, 0.05, 0.7) + 'M16 -94L28 -88L31 -94L19 -100Z' }),
      s('path', { class: 't20m-mason-rim', d: 'M16.5 -95L19.5 -100L21 -99L18 -94Z' })),
    s('path', { class: 't20m-mason-ink', d:
      // the hat: a wide cone of palm leaf, tipped forward
      'M-25 -60Q-6 -69 15 -63Q3 -64 -2 -80Q-10 -66 -25 -60Z' +
      // the bent back and the robe, gathered over the crouched legs
      'M-10 -59C-18 -50 -16 -36 -8 -27C-4 -22 4 -20 11 -22C14 -30 12 -44 4 -55C0 -60 -6 -61 -10 -59Z' +
      stroke(curve([8, -24], [-6, -18], [-10, -1], 8), 9, 0.1, 0.3, 0.5) + // the near leg, knee forward
      stroke(curve([8, -22], [16, -12], [10, 0], 8), 8, 0.1, 0.3, 0.5) + // the far leg, folded
      stroke(curve([-8, -50], [-17, -44], [-22, -36], 8), 5, 0.1, 0.3, 0.4) + // the arm holding the chisel
      stroke([[-22, -37], [-31, -31]], 2.2, 0.05, 0.05, 0.6), filter: 'url(#ink-rough)' }),
    s('path', { class: 't20m-mason-rim', d: stroke(curve([-12, -57], [-18, -46], [-12, -31], 8), 1.6, 0.2, 0.3, 0.2) + stroke(curve([-24, -61], [-10, -66], [-3, -79], 8), 1.4, 0.2, 0.3, 0.2) }))
  const mason = h('div', { class: 't20m-mason', 'aria-hidden': 'true' }, masonArt)
  const signLines = LINES[0]
  const sign = h('div', { class: 't20m-sign', 'aria-hidden': 'true' },
    h('span', { class: 't20m-post l' }), h('span', { class: 't20m-post r' }),
    h('div', { class: 't20m-board' }, h('code', null, ...mark(signLines, M.signWord))))
  const lamp = s('svg', { class: 't20m-lamp', viewBox: '-150 -20 450 220', 'aria-hidden': 'true' })
  const lampWrap = h('div', { class: 't20m-lampwrap', 'aria-hidden': 'true' }, lamp)
  // the original: dó paper between two wooden rods, rolled up on the lower one until the stair is done (its words stay
  // hidden till then); .t20m-hang swings on the cord
  const hangEl = h('span', { class: 't20m-hang' },
    h('span', { class: 't20m-rod' }),
    h('span', { class: 't20m-paper' }, h('span', { class: 't20m-orig' }, ...mark(M.original, M.originalWord))),
    h('span', { class: 't20m-rod b' }),
    h('span', { class: 't20m-tag' }, M.compare))
  const scroll = h('button', { class: 't20m-scroll', type: 'button', 'aria-label': M.compareAria, 'aria-disabled': 'true' }, hangEl)
  const mismatch = h('p', { class: 't20m-mismatch' }, M.mismatch)
  const slot = h('div', { class: 't20m-card' }) // the folded card, handed at the end
  stage.append(...steps, landing, mason, sign, lampWrap, scroll)
  const root = h('div', { class: 't20 t20m' }, h('p', { class: 'visually-hidden' }, M.art), back, world, mismatch, slot)
  if (still) root.classList.add('still')
  ctx.art.append(root)
  ctx.prompt(M.prompt)
  // H1 one dot on the next step, H4 the count at the stair's foot, then H3 a dashed place on the sign for the scroll
  const g = guide(ctx)
  const dot = g.dot(steps[0], { dir: [0, -1] })
  const count = g.count(M.count, steps.length, () => {
    const a = ctx.art.getBoundingClientRect(), b = steps[0].getBoundingClientRect()
    return [b.left - a.left + b.width / 2, Math.min(b.bottom - a.top + 26, a.height - 14)]
  })
  let place: ReturnType<typeof g.drop> | null = null

  // ── 3D layout in design units ──
  let D = WIDE
  let origins: [number, number, number, number][] = [] // per block (steps + landing): x, y, z, rotY
  const rot = (b: number[], lx: number, ly: number, lz: number): [number, number, number] => {
    const c = Math.cos(b[3] * DEG), sn = Math.sin(b[3] * DEG)
    return [b[0] + lx * c + lz * sn, b[1] + ly, b[2] - lx * sn + lz * c]
  }
  const t3 = (p: number[], extra = '') => `translate3d(${p[0].toFixed(1)}px,${p[1].toFixed(1)}px,${p[2].toFixed(1)}px)${extra}`
  // tall draws the sign, the scroll and the mason a size down: the scale goes after the translate (about each one's own
  // anchor), so where they stand is not scaled with them — the sign's posts stay planted on the landing
  let SC = { sign: 1, scroll: 1, mason: 1 }
  const sz = (p: number[], s0: number) => t3(p, s0 === 1 ? '' : ` scale(${s0})`)
  let masonAt = -1
  let restScroll: [number, number, number] = [0, 0, 0]
  let signAt: [number, number, number] = [0, 0, 0]
  let held: [number, number, number] = [0, 0, 0] // where the scroll is held up against the sign
  let k = 1

  function layout() {
    const W = ctx.art.clientWidth
    const H = stableH(ctx.art.clientHeight)
    if (W < 60 || H < 60) return
    root.style.height = `${H}px`
    const wide = W / H > 1.05
    root.classList.toggle('wide', wide)
    D = wide ? WIDE : TALL
    SC = wide ? { sign: 1, scroll: 1, mason: 1 } : { sign: 0.72, scroll: 0.68, mason: 0.74 }
    // tall: room at the foot for the mismatch line, and a clear strip at the top for the folded card handed at the end
    const pad = wide ? 0 : 62
    k = Math.min(W / D.DW, (H - pad) / D.DH) * (wide ? 1 : 0.92)
    const left = (W - D.DW * k) / 2, top = pad + (H - pad - D.DH * k) * (wide ? 0.55 : 0.15)
    Object.assign(world.style, { width: `${D.DW}px`, height: `${D.DH}px`, transform: `translate(${left.toFixed(1)}px,${top.toFixed(1)}px) scale(${k.toFixed(4)})`, perspective: `${D.P}px`, perspectiveOrigin: `${D.o[0]}px ${D.o[1]}px` })
    root.style.setProperty('--wb', `${D.Wb}px`)
    root.style.setProperty('--hb', `${D.Hb}px`)
    root.style.setProperty('--db', `${D.Db}px`)
    // the blocks: each riser's top-left corner, run by run (a flight climbs along its own -normal by Db, up by Hb); xs:
    // each block also slides sideways along its own width (wide: the flight climbs the hill on a diagonal; tall: right,
    // then back left after the turn), every riser still resting on the tread below it. The landing is a lower curb (0.8
    // of a riser) sitting on the last tread
    origins = []
    let ox = D.from[0], oz = D.from[2]
    for (let q = 0; q <= steps.length; q++) {
      const a = (D.rots?.[q] ?? D.rot) * DEG
      if (q) {
        const dx = (D.xs?.[q] ?? 0) - (D.xs?.[q - 1] ?? 0)
        ox += -Math.sin(a) * D.Db + Math.cos(a) * dx
        oz += -Math.cos(a) * D.Db - Math.sin(a) * dx
      }
      origins.push([ox, D.from[1] - D.Hb * q + (q === steps.length ? D.Hb * 0.2 : 0), oz, a / DEG])
    }
    ;[...steps, landing].forEach((el, i) => {
      const o = origins[i]
      el.style.transform = t3(o, ` rotateY(${o[3]}deg)`)
    })
    const L = origins[steps.length]
    // on the landing: the sign under the lantern, the original scroll hanging beside it, the mismatch line below
    signAt = rot(L, D.Wb * D.sign, 0, -D.Db * 0.85)
    // the original hangs from a pine bough, level with the sign, on the other side (a counterweight)
    restScroll = D.hang
    // over the board's upper half, clear of the words cut below
    held = [signAt[0], signAt[1] - (wide ? 26 : 10), signAt[2] + 6]
    sign.style.transform = sz(signAt, SC.sign)
    lampWrap.style.transform = t3(rot(L, D.Wb * D.lamp[0], 0, D.Db * D.lamp[1]))
    // the mismatch is written in the open (2D): wide, beside the sign under the lantern, over the dark hill; tall, at the foot
    const [mx, my] = proj(signAt)
    const fs = (D.P / (D.P - signAt[2])) * k
    mismatch.style.transform = wide ? `translate(${(left + mx * k + 170 * fs).toFixed(1)}px,${(top + my * k - 60 * fs).toFixed(1)}px)` : 'none'
    scroll.style.transform = sz(root.classList.contains('compared') ? held : restScroll, SC.scroll)
    placeMason(masonAt, false)
    paintHill(wide)
    paintBack(W, H, wide, left, top)
    texture()
    g.refresh() // the dot and the count follow the blocks just moved
  }

  function standAt(i: number): number[] {
    if (i < 0) return rot(origins[0], D === TALL ? D.Wb * 0.02 : -D.Wb * 0.08, D.Hb * 1.05, D.Db * 0.5) // at the foot of the stair, inside the frame
    if (i >= steps.length) return rot(origins[i], D.Wb * (D === TALL ? 1.0 : 0.06), 0, -D.Db * 0.3) // on the landing, clear of the words and the sign
    return rot(origins[i], D.Wb * D.mason, 0, -D.Db * 0.5) // crouched on the tread, at its right end
  }
  function placeMason(i: number, climb: boolean) {
    const to = sz(standAt(i), SC.mason)
    if (!climb || still || !origins.length) {
      mason.getAnimations().forEach((a) => a.cancel())
      mason.style.transform = to
      return
    }
    // hop from step to step (up or down), a little lift on each
    const from = masonAt
    const path: number[] = []
    for (let s0 = from; s0 !== i; s0 += i > s0 ? 1 : -1) path.push(s0 + (i > s0 ? 1 : -1))
    const frames: Keyframe[] = [{ transform: mason.style.transform || sz(standAt(from), SC.mason) }]
    for (const j of path) {
      const p = standAt(j)
      frames.push({ transform: sz([p[0], p[1] - D.Hb * 0.55, p[2]], SC.mason) }, { transform: sz(p, SC.mason) })
    }
    mason.getAnimations().forEach((a) => a.cancel())
    mason.style.transform = to
    mason.animate(frames, { duration: 300 * path.length, easing: 'ease-in-out' })
  }

  /** where a design-space point lands on the 2D design plane (the hill is painted behind the stair, in perspective) */
  const proj = (p: number[]): Pt => {
    const f = D.P / (D.P - p[2])
    return [D.o[0] + (p[0] - D.o[0]) * f, D.o[1] + (p[1] - D.o[1]) * f]
  }
  const P2 = (q: Pt) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`
  function paintHill(wide: boolean) {
    hill.setAttribute('viewBox', `0 0 ${D.DW} ${D.DH}`)
    front.setAttribute('viewBox', `0 0 ${D.DW} ${D.DH}`)
    // the slope the stair is cut into: its crest runs under the risers' feet up past the landing, then eases away right
    const feet: Pt[] = origins.map((o) => proj(rot(o, -4, D.Hb * 1.02, 2)))
    const L = origins[origins.length - 1]
    const crest = proj(rot(L, D.Wb * 1.3, D.Hb * 0.6, -D.Db * 1.8))
    const r = rng(2050)
    // (a shoulder falls away left of the first step, so the flight sits on the ridge rather than hangs off it)
    const top: Pt[] = [[-30, feet[0][1] + D.DH * 0.2], [feet[0][0] - D.Wb * 0.45, feet[0][1] + D.DH * 0.06], ...feet.map(([x, y]) => [x - 14, y + 4] as Pt), crest, [D.DW + 30, crest[1] + D.DH * (wide ? 0.16 : 0.2)]]
    const d = `M${top.map(P2).join('L')}L${D.DW + 30} ${D.DH + 30}L-30 ${D.DH + 30}Z`
    // the slope's body: earth and rock, dry strokes down it, a few outcrops, grass along the crest
    let cun = '', tufts = ''
    for (let q = 0; q < 26; q++) {
      const a = top[1 + Math.floor(r() * (top.length - 2))]
      const x = a[0] + (r() - 0.5) * 140, y = a[1] + 20 + r() * 150
      const len = 14 + r() * 40
      cun += stroke(curve([x, y], [x - len * 0.2, y + len * 0.5], [x - len * 0.1, y + len], 6), 1.2 + r() * 2, 0.1, 0.5, 0.1)
    }
    for (let q = 0; q < 34; q++) {
      const a = top[1 + Math.floor(r() * (top.length - 2))]
      const x = a[0] + (r() - 0.5) * 70, y = a[1] + 4 + r() * 50
      tufts += stroke([[x, y], [x - 3 + r() * 6, y - 8 - r() * 12]], 1.4, 0.1, 0.5, 0.2)
    }
    const rocks = [0.15, 0.45, 0.8].map((t, i) => {
      const a = top[1 + Math.floor(t * (top.length - 3))]
      const w = (wide ? 70 : 46) * (0.7 + r() * 0.6)
      return s('g', { transform: `translate(${(a[0] + (r() - 0.6) * 60).toFixed(1)} ${(a[1] + 60 + r() * 60).toFixed(1)})` }, stoneArt(w, w * 0.5, 2052 + i))
    })
    hill.replaceChildren(
      // the slope's earth, then the valley mist rising over its lower part
      s('defs', null, s('linearGradient', { id: 't20m-hillg', x1: 0, x2: 0, y1: Math.min(...feet.map((q) => q[1])), y2: D.DH, gradientUnits: 'userSpaceOnUse' },
        s('stop', { offset: 0, class: 't20m-hs0' }), s('stop', { offset: 0.45, class: 't20m-hs1' }), s('stop', { offset: 1, class: 't20m-hs2' }))),
      s('path', { class: 't20m-slope', d, filter: 'url(#ink-wash)' }),
      s('path', { d, fill: 'url(#t20m-hillg)' }),
      s('path', { class: 't20m-cun', d: cun, filter: 'url(#ink-dry)' }),
      ...rocks,
      s('path', { class: 't20m-slope-ink', d: stroke(top.slice(0, -1), 2.4, 0.05, 0.3, 0.2), filter: 'url(#ink-rough)' }),
      s('path', { class: 't20m-tuft', d: tufts }),
      grass(crest[0] - 30, crest[1] + 8, 30, 2057),
      ...(wide ? [inkPine(crest[0] + 40, crest[1] + 10, 300, 2056, -1)] : []))
    // in front of the stair: each riser's foot sunk in earth and grass, a contact shadow along it
    let mound = '', blades = '', contact = ''
    const rr = rng(2058)
    origins.slice(0, 1).forEach((o) => {
      const a = proj(rot(o, -10, D.Hb + 2, 4)), b = proj(rot(o, D.Wb + 10, D.Hb + 2, 4))
      mound += `M${P2([a[0] - 30, a[1] + 14])}Q${P2([a[0], a[1] - 12])} ${P2([(a[0] + b[0]) / 2, a[1] - 6])}T${P2([b[0] + 30, b[1] + 16])}Z`
      for (let q = 0; q < 26; q++) {
        const t = rr(), x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t + 2
        blades += stroke([[x, y + 6], [x - 4 + rr() * 8, y - 6 - rr() * 14]], 1.6, 0.1, 0.5, 0.2)
      }
    })
    origins.forEach((o) => {
      const a = proj(rot(o, 0, D.Hb, 0)), b = proj(rot(o, D.Wb, D.Hb, 0))
      contact += stroke([[a[0], a[1]], [b[0], b[1]]], 5, 0.1, 0.1, 0.5)
      // the left foot of every step meets the slope: grass over the corner
      for (let q = 0; q < 7; q++) blades += stroke([[a[0] - 8 + q * 3, a[1] + 5], [a[0] - 16 + q * 4 + rr() * 8, a[1] - 8 - rr() * 14]], 1.6, 0.1, 0.5, 0.2)
    })
    front.replaceChildren(
      s('path', { class: 't20m-contact', d: contact, filter: 'url(#ink-wash)' }),
      s('path', { class: 't20m-mound', d: mound, filter: 'url(#ink-wash)' }),
      s('path', { class: 't20m-blade', d: blades }),
      grass(feet[0][0] - 40, feet[0][1] + 16, 46, 2055))
  }

  function paintBack(W: number, H: number, wide: boolean, left: number, top: number) {
    back.setAttribute('viewBox', `0 0 ${W} ${H}`)
    const hz = H * (wide ? 0.62 : 0.5)
    const r = rng(2060)
    // across the valley, in the mist: a second, parallel stair and its mason (Isabelle) — shown with the detail
    const sx = W * (wide ? 0.84 : 0.66), sy = hz + H * (wide ? -0.02 : 0.06) // (tall: under the pine's low pads)
    // (drawn big enough to read: six blocks with lit treads, the second mason on the top one, his own hammer raised)
    const f = wide ? 1.6 : 1.3
    let flight = '', lips = ''
    for (let q = 0; q < 6; q++) {
      const x = sx + q * 10 * f, y = sy - q * 8 * f
      flight += `M${x.toFixed(1)} ${y.toFixed(1)}h${(13 * f).toFixed(1)}v${(8 * f).toFixed(1)}h${(-13 * f).toFixed(1)}Z`
      lips += `M${x.toFixed(1)} ${y.toFixed(1)}h${(13 * f).toFixed(1)}`
    }
    const fx = sx + 56 * f, fy = sy - 40 * f
    const farMason = `M${fx - 7 * f} ${fy - 17 * f}L${fx} ${fy - 23 * f}L${fx + 7 * f} ${fy - 17 * f}Z` + // the hat
      `M${fx - 4 * f} ${fy - 16 * f}Q${fx - 6 * f} ${fy - 6 * f} ${fx - 3 * f} ${fy}L${fx + 3 * f} ${fy}Q${fx + 5 * f} ${fy - 8 * f} ${fx + 3 * f} ${fy - 16 * f}Z` + // the robe
      stroke([[fx + 3 * f, fy - 13 * f], [fx + 8 * f, fy - 20 * f]], 1.6 * f, 0.1, 0.1, 0.5) + `M${fx + 6 * f} ${fy - 23 * f}h${5 * f}v${3 * f}h${-5 * f}Z` // arm, hammer
    back.replaceChildren(
      moon(W * (wide ? 0.4 : 0.8), H * (wide ? 0.08 : 0.17), Math.min(30, W * 0.035 + 8), 2061, true),
      mist(W * 0.5, hz - H * 0.22, W * 0.7, H * 0.2),
      range(-W * 0.05, W * 1.05, hz, H * 0.3, 2062, 0.85, wide ? 6 : 3),
      mist(W * 0.5, hz - H * 0.02, W * 0.8, H * 0.08),
      range(W * 0.45, W * 1.08, hz + H * 0.04, H * 0.24, 2063, 0.5, 3),
      s('g', { class: 't20m-isabelle' },
        s('path', { class: 't20m-far-stair', d: flight }),
        s('path', { class: 't20m-far-lip', d: lips }),
        s('path', { class: 't20m-far-mason', d: farMason })),
      mist(W * 0.62, hz + H * 0.04, W * 0.6, H * 0.07),
      mist(W * (0.3 + r() * 0.1), hz + H * 0.1, W * 0.5, H * 0.06),
      mist(W * 0.5, hz - H * 0.1, W * 0.9, H * 0.05),
      mist(W * 0.55, hz + H * 0.16, W * 0.75, H * 0.05),
      ...bough(W, H, left, top, wide))
    // the lantern on its bough, beside the sign
    lamp.replaceChildren(
      s('path', { class: 't20m-bough', d: stroke(curve([300, -18], [110, 10], [-60, 2], 18), 8, 0.02, 0.55, 0.2) + stroke(curve([60, 6], [20, 22], [-30, 30], 8), 3, 0.05, 0.5, 0.2) + stroke(curve([180, 2], [150, 24], [110, 34], 8), 2.6, 0.05, 0.5, 0.2), filter: 'url(#ink-rough)' }),
      paperLantern(0, 8, 15, 2064, 22))
  }

  /** a pine leaning in from the edge (wide: left; tall: right), its long bough reaching over to hold the original's cord */
  function bough(W: number, H: number, left: number, top: number, wide: boolean) {
    const hx = left + D.hang[0] * k, hy = top + (D.hang[1] - (178 + (wide ? 52 : 26)) * SC.scroll) * k // the cord's top (.t20m-scroll::before; tall, measured)
    const dir = wide ? 1 : -1
    const tx = wide ? Math.max(W * 0.03, hx - 300 * k) : Math.min(W * 0.97, hx + 150 * k)
    const reach = (wide ? 70 : 40) * k * dir
    return [
      inkPine(tx - 40 * k * dir, H * (wide ? 0.86 : 0.62), H * (wide ? 0.95 : 0.5), 2066, dir),
      s('path', { class: 't20m-pine-wood', d: stroke(curve([tx - 10 * k * dir, hy + 34 * k], [hx - 120 * k * dir, hy - 18 * k], [hx + reach, hy + 6 * k], 14), 7 * k, 0.05, 0.55, 0.2), filter: 'url(#ink-rough)' }),
      inkPads(hx + reach * 0.6, hy - 2 * k, 46 * k, 15 * k, 2067),
    ]
  }

  /** flat layered pads of needles (the ink pine's canopy): a dark body with a flat underside, a moonlit top, needles */
  function inkPads(cx: number, cy: number, rx: number, ry: number, seed: number) {
    const r = rng(seed)
    let body = '', lit = '', needles = ''
    const pad = (x: number, y: number, a: number, b: number) => {
      body += `M${x - a} ${y}Q${x - a * 0.95} ${y - b * 0.9} ${x - a * 0.45} ${y - b * 0.85}Q${x - a * 0.15} ${y - b * 1.4} ${x + a * 0.2} ${y - b}Q${x + a * 0.6} ${y - b * 1.2} ${x + a * 0.85} ${y - b * 0.55}Q${x + a * 1.08} ${y - b * 0.2} ${x + a} ${y}Q${x} ${y + b * 0.4} ${x - a} ${y}Z`
      lit += `M${x - a * 0.78} ${y - b * 0.55}Q${x - a * 0.2} ${y - b * 1.3} ${x + a * 0.2} ${y - b * 0.88}Q${x + a * 0.6} ${y - b * 1.1} ${x + a * 0.8} ${y - b * 0.5}Q${x + a * 0.2} ${y - b * 0.72} ${x - a * 0.78} ${y - b * 0.55}Z`
      for (let i = 0; i < 11; i++) {
        const t = -0.9 + i * 0.18, px = x + a * t, py = y - b * (0.6 + 0.45 * (1 - t * t))
        needles += `M${px.toFixed(1)} ${(py + b * 0.3).toFixed(1)}l${(t * b * 0.5).toFixed(1)} ${(-b * (0.4 + r() * 0.25)).toFixed(1)}`
      }
    }
    pad(cx, cy, rx, ry)
    pad(cx + rx * (0.35 + r() * 0.2), cy - ry * 0.9, rx * 0.6, ry * 0.8)
    pad(cx - rx * (0.4 + r() * 0.2), cy - ry * 0.55, rx * 0.5, ry * 0.75)
    return s('g', { class: 't20m-pads' },
      s('path', { class: 't20m-pad', d: body, filter: 'url(#ink-wash)' }),
      s('path', { class: 't20m-pad-top', d: lit }),
      s('path', { class: 't20m-needle', d: needles }))
  }

  /** An ink pine drawn here (the toolkit's tufts read as puffs at this size): an S-bent trunk, boughs reaching out
   *  alternately, each holding flat pads of needles; dir: the lean (1 right, -1 left). */
  function inkPine(x: number, y: number, hgt: number, seed: number, dir: number) {
    const r = rng(seed)
    const lean = hgt * 0.22 * dir
    const mid: Pt = [x + lean * 0.3 - dir * hgt * 0.08, y - hgt * 0.5], tip: Pt = [x + lean, y - hgt]
    const trunk = [...curve([x, y], [x + dir * hgt * 0.06, y - hgt * 0.25], mid, 10), ...curve(mid, [x + lean * 0.6 - dir * hgt * 0.08, y - hgt * 0.8], tip, 10).slice(1)]
    const tw = hgt * 0.04
    let wood = stroke(trunk, tw, 0.05, 0.6, 0.25)
    const crowns: SVGGElement[] = []
    ;[[0.45, 1], [0.6, -1], [0.74, 1], [0.86, -1]].forEach(([t, side], i) => {
      const [bx, by] = trunk[Math.round(t * (trunk.length - 1))]
      const len = hgt * (0.2 + r() * 0.1) * (i % 2 ? 0.8 : 1)
      const end: Pt = [bx + side * dir * len, by - hgt * (0.03 + r() * 0.04)]
      wood += stroke(curve([bx, by], [bx + side * dir * len * 0.5, by - hgt * 0.06], end, 8), tw * 0.42, 0.05, 0.5, 0.2)
      crowns.push(inkPads(end[0], end[1], hgt * (0.12 + r() * 0.04), hgt * (0.04 + r() * 0.012), seed + i))
    })
    crowns.push(inkPads(tip[0], tip[1] + hgt * 0.02, hgt * 0.1, hgt * 0.04, seed + 9))
    return s('g', { class: 't20m-pine' }, s('path', { class: 't20m-pine-wood', d: wood, filter: 'url(#ink-rough)' }), ...crowns)
  }

  // ── the stone itself: three textures (riser, tread, flank) painted once per theme, worn by every block ──
  let pal: Pal = palette()
  let urls: string[] = []
  let texJob: ReturnType<typeof sliced> | null = null
  let texKey = ''
  let texGen = 0
  let texRaf = 0
  function texture() {
    const key = pal.key + D.Wb
    if (key === texKey) return
    texKey = key
    texJob?.cancel()
    cancelAnimationFrame(texRaf)
    // a frame after the layout, in small slices: the stair shows in plain stone first, then takes its grain
    texRaf = requestAnimationFrame(() => (texJob = sliced(paintTex(pal), { budget: 4 })))
  }
  function* paintTex(p: Pal) {
    const W2 = D.Wb * 2, HB = D.Hb + 10
    const faces: [string, number, number, RGB, 'bottom' | 'back' | null][] = [
      // (light theme: the riser a mid grey under a paler tread, so the step reads as stone, not a white slab)
      ['--tex-riser', W2, HB, p.dark ? mix(p['rock-lo'], p['rock-mid'], 0.35) : mix(p['rock-mid'], p['rock-lo'], 0.45), 'bottom'],
      ['--tex-tread', W2, D.Db + 10, p.dark ? mix(p['rock-mid'], p['rock-hi'], 0.75) : p['rock-hi'], 'back'],
      ['--tex-flank', D.Db * 2 + 20, HB * 1.3, p.dark ? mix(p['rock-lo'], p.umbra, 0.35) : mix(p['rock-lo'], p.umbra, 0.2), null],
    ]
    const out: { name: string; c: HTMLCanvasElement }[] = []
    for (const [name, w, hh, base, moss] of faces) {
      const c = document.createElement('canvas')
      c.width = w
      c.height = hh
      const g = c.getContext('2d')!
      const r = rng(2070 + w)
      g.fillStyle = col(base)
      g.fillRect(0, 0, w, hh)
      // mottled stone: washes of its darker and lighter tones, then grain, pits, a crack or two
      for (let i = 0; i < 30; i++) glow(g, r() * w, r() * hh, 10 + r() * w * 0.12, 6 + r() * hh * 0.3, r() < 0.55 ? p['rock-lo'] : p['rock-hi'], 0.16 + r() * 0.22, 0.5)
      yield
      for (let i = 0; i < (w * hh) / 30; i++) {
        g.fillStyle = col(r() < 0.6 ? p.umbra : p['rock-hi'], 0.1 + r() * 0.25)
        g.fillRect(r() * w, r() * hh, 1 + r(), 1)
      }
      yield
      for (let i = 0; i < 9; i++) {
        const y = r() * hh, x = r() * w
        brush(g, [[x, y], [x + 20 + r() * 60, y + (r() - 0.5) * 5]], 1 + r() * 2.2, col(p.umbra, 0.1 + r() * 0.12), 0.3, 0.3, 0.2)
      }
      for (let i = 0; i < 3; i++) {
        let x = r() * w, y = moss === 'bottom' ? 0 : r() * hh
        const pts: Pt[] = [[x, y]]
        for (let q = 0; q < 5; q++) pts.push([(x += (r() - 0.5) * 16), (y += 4 + r() * 8)])
        brush(g, pts, 1.1, col(p.umbra, p.dark ? 0.6 : 0.4), 0.1, 0.4, 0.2)
      }
      // moss in the joint: along the riser's foot, along the tread's back
      if (moss) for (let x = r() * 20; x < w; x += 22 + r() * 46) mossDots(g, p, x, moss === 'bottom' ? hh - 4 : 4, 7 + r() * 12, 2.5 + r() * 2.5, 2075 + Math.round(x), 0.95)
      yield
      out.push({ name, c })
    }
    // turn them into blob URLs off the main frame, then swap them in together (unless a newer paint has started)
    const gen = ++texGen
    Promise.all(out.map(({ c }) => new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/webp', 0.86)))).then((blobs) => {
      if (gen !== texGen) return
      urls.forEach((u) => URL.revokeObjectURL(u))
      urls = blobs.map((b) => (b ? URL.createObjectURL(b) : ''))
      urls.forEach((u, i) => u && root.style.setProperty(out[i].name, `url(${u})`))
    })
  }
  ctx.onCleanup(() => {
    texJob?.cancel()
    cancelAnimationFrame(texRaf)
    texGen++
    urls.forEach((u) => URL.revokeObjectURL(u))
  })
  ctx.onCleanup(onPrefs(() => {
    const p = palette()
    if (p.key === pal.key) return
    pal = p
    texture()
  }))

  // ── tapping the steps ──
  function tap(i: number) {
    const b = steps[i]
    if (!done.has(i) && i !== done.size) {
      // out of turn: the machine takes the steps one by one
      g.wrong(fill(M.steps[0], { n: done.size + 1, total: steps.length }), b)
      ctx.chime('low')
      return
    }
    b.classList.remove('ring')
    void b.offsetWidth // restart the light run on a second tap
    b.classList.add('ring', 'done')
    b.setAttribute('aria-pressed', 'true')
    placeMason(i, masonAt !== i)
    masonAt = i
    mason.classList.remove('knock')
    void mason.offsetWidth
    mason.classList.add('knock')
    ctx.chime('tap')
    if (done.has(i)) return
    done.add(i)
    count.set(done.size)
    if (done.size < steps.length) {
      dot.at(steps[done.size])
      ctx.prompt(fill(M.steps[0], { n: done.size + 1, total: steps.length }), 'ok')
      return
    }
    root.classList.add('ok')
    // after the last ring, up onto the landing, clear of the words cut into it
    const tm = setTimeout(() => {
      placeMason(steps.length, true)
      masonAt = steps.length
    }, still ? 0 : 900)
    ctx.onCleanup(() => clearTimeout(tm))
    scroll.setAttribute('aria-disabled', 'false')
    ctx.insight(M.insights[0] as Fact)
    // step 3: the dot goes to the scroll, a dashed place waits on the sign, and the prompt says so
    dot.at(scroll)
    place = g.drop(sign.querySelector('.t20m-board')!, { round: false })
    ctx.prompt(M.steps[1])
  }

  // ── the scroll onto the sign: drag (pointer) or Enter / Space ──
  function compare() {
    if (root.classList.contains('compared') || !root.classList.contains('ok')) return
    root.classList.add('compared')
    scroll.classList.remove('drag')
    scroll.style.transform = sz(held, SC.scroll)
    scroll.setAttribute('aria-disabled', 'true')
    ctx.chime('low')
    dot.done()
    count.done() // the stair is done with: its count gives the foot back to the words
    place?.hit()
    ctx.insight(M.insights[1] as Fact, [M.detail as Fact, M.codeNote as Fact])
    const card = findTakeaway(M.takeaway)
    if (card) slot.append(foldedTakeaway([card], ctx.onCleanup))
  }
  /** the scroll touched before every step has rung: it shakes, the prompt says what comes first */
  const early = () => {
    g.wrong(M.early, scroll)
    if (!still) hangEl.animate([{ rotate: '0deg' }, { rotate: '4deg' }, { rotate: '-3deg' }, { rotate: '1.5deg' }, { rotate: '0deg' }], { duration: 700, easing: 'ease-out' })
    ctx.chime('low')
  }
  // H7: standing still — while the stair is being tapped the mason lifts his hammer; once it is done the scroll sways
  // toward the sign (its own small motions; the frame already lifts the prompt and makes the dots invite)
  const hammer = masonArt.querySelector<SVGGElement>('.t20m-hammer')!
  const idle = () => {
    if (still || root.classList.contains('compared')) return
    if (root.classList.contains('ok')) hangEl.animate([{ rotate: '0deg' }, { rotate: `${D === TALL ? 6 : -6}deg` }, { rotate: '0deg' }], { duration: 1500, iterations: 2, easing: 'ease-in-out' })
    else hammer.animate([{ rotate: '0deg' }, { rotate: '-28deg', offset: 0.4 }, { rotate: '-28deg', offset: 0.6 }, { rotate: '0deg' }], { duration: 1300, iterations: 2, easing: 'ease-in-out' })
  }
  ctx.el.addEventListener('p2:idle', idle)
  ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', idle))
  let drag: { x: number; y: number; f: number; moved: boolean } | null = null
  scroll.addEventListener('click', (e) => {
    if ((e as PointerEvent).pointerType) return // pointer clicks: the drag (or tap) decides
    if (!root.classList.contains('ok')) return early()
    compare() // Enter / Space
  })
  scroll.addEventListener('pointerdown', (e) => {
    if (!root.classList.contains('ok')) return early()
    if (root.classList.contains('compared')) return
    place?.lift(true)
    drag = { x: e.clientX, y: e.clientY, f: k * (D.P / (D.P - restScroll[2])), moved: false }
    scroll.setPointerCapture(e.pointerId)
    scroll.classList.add('drag')
  })
  scroll.addEventListener('pointermove', (e) => {
    if (!drag) return
    const dx = (e.clientX - drag.x) / drag.f, dy = (e.clientY - drag.y) / drag.f
    if (Math.hypot(dx, dy) > 6) drag.moved = true
    scroll.style.transform = sz([restScroll[0] + dx, restScroll[1] + dy, restScroll[2]], SC.scroll)
  })
  const drop = () => {
    if (!drag) return
    const tapped = !drag.moved
    drag = null
    place?.lift(false)
    scroll.classList.remove('drag')
    const a = scroll.querySelector('.t20m-paper')!.getBoundingClientRect(), b = sign.querySelector('.t20m-board')!.getBoundingClientRect()
    const over = Math.abs(a.left + a.width / 2 - (b.left + b.width / 2)) < b.width * 0.6 && Math.abs(a.top + a.height / 2 - (b.top + b.height / 2)) < b.height
    if (over || tapped) compare() // a tap also holds the scroll up to the sign
    else scroll.style.transform = sz(restScroll, SC.scroll)
  }
  scroll.addEventListener('pointerup', drop)
  scroll.addEventListener('pointercancel', drop)

  // parallax: the stage turns a breath with the pointer (high quality, motion allowed)
  if (!still && matchMedia('(pointer: fine)').matches) {
    let raf = 0
    const move = (e: PointerEvent) => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const b = root.getBoundingClientRect()
        root.style.setProperty('--px', (((e.clientX - b.left) / b.width) * 2 - 1).toFixed(3))
        root.style.setProperty('--py', (((e.clientY - b.top) / b.height) * 2 - 1).toFixed(3))
      })
    }
    root.addEventListener('pointermove', move)
    ctx.onCleanup(() => cancelAnimationFrame(raf))
  }
  ctx.onCleanup(onSize(ctx.art, layout))
}
