import { fill, h, s } from '../../core/dom'
import { L, type Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { perspectiveCircle, type PondGeo } from '../../ui/part2/perspectives'
import type { Perspectives } from '../../ui/part2/types'
import { blob, clamp, curve, rng, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist, moon, reeds, wash } from '../../ui/part2/paint'
import { C } from './data'
import { guide } from '../../ui/part2/guide'
import { bucket, f1, P, sheet } from './kit'

const cp = C.scenes.copyright
const VIEWS = ['creator', 'company', 'court', 'lawmaker', 'user'] // content order of the five stones (art keyed to it)
const WHO = (cp.perspectives as Perspectives).stones.map((x) => x.who)

/**
 * II·12 "copyright" (2.5D, perspectiveCircle): EYE level at the edge of a moon pond; the painting fills the frame. A heavy
 * wooden well-sweep (shadoof) crosses it on a diagonal: a forked post on the near left bank, a lashed counterweight stone
 * at the low end, a thick beam reaching up over the water to a big bucket on a rope. The pond mirrors a library instead of
 * the sky — shelves of books upside down in the water, the moon among them — and pages, scrolls and scores drift under the
 * surface like koi, blurred by depth. Five big stones with their names stand on the near bank. Pull the beam down (drag
 * or Enter): the bucket dips and comes up full of pages dripping silver — training data. Touch a stone: a lantern beam from
 * it lands on the bucket, glowing there, and shows how that voice sees it (seals, an opt-out slot in the rope, a split
 * bucket, a tag of contents, a prompt's unsealed ripple). What it says is written in the sky, not on a card. All five: the
 * common ground, then the court files hang on two wooden boards from the beam (a phone: from a rail at the bank).
 * Low: the bucket has two still positions, the pages do not drift, each stone's view is a still overlay.
 */
export function copyrightScene(ctx: SceneCtx) {
  const still = ctx.quality === 'low' || ctx.reduced
  let full = false
  let dipping = false
  let host: HTMLElement | null = null
  let svg: SVGSVGElement | null = null, front: SVGSVGElement | null = null // behind the drowned pages / in front of them
  let pole: SVGGElement | null = null, lift: SVGGElement | null = null
  let beam: SVGPathElement | null = null, spot: SVGCircleElement | null = null, source: SVGCircleElement | null = null, beamG: SVGLinearGradientElement | null = null
  let geo: { pivot: Pt; tip: Pt; amax: number; feet: { x: number; y: number; s: number }[]; bw: number; by: number } | null = null
  let FW = 0, FH = 0, tall = false
  const deep = h('div', { class: 't30c-deep', 'aria-hidden': 'true' }) // the library under the water: three depth layers, clipped to the pond
  const boards = h('div', { class: 't30c-boards' })
  const sweepBtn = h('button', { class: 't30c-sweep', type: 'button', 'aria-label': cp.sweepAria })
  const names: string[] = [] // who stands at stone k
  let heardK = -1
  let bucketDot: { done(): void } | null = null, bucketArrow: { done(): void } | null = null
  let said = false // the insight is up: no more prompts
  let idle = 0

  // the pole turns about its pivot; the bucket hangs plumb from the tip whatever the angle
  function pose(a: number, settle: boolean) {
    if (!geo || !pole || !lift) return
    const { pivot, tip } = geo
    const Lp = Math.hypot(tip[0] - pivot[0], tip[1] - pivot[1])
    const a0 = Math.atan2(tip[1] - pivot[1], tip[0] - pivot[0])
    const nx = pivot[0] + Math.cos(a0 + a) * Lp, ny = pivot[1] + Math.sin(a0 + a) * Lp
    host!.classList.toggle('settle', settle)
    pole.style.transform = `rotate(${f1((a * 180) / Math.PI)}deg)`
    lift.style.transform = `translate(${f1(nx - tip[0])}px, ${f1(ny - tip[1])}px)`
  }
  function dip() {
    if (dipping || !geo) return
    dipping = true
    host!.classList.add('busy')
    pose(geo.amax, true)
    const t1 = setTimeout(() => {
      fillUp()
      pose(0, true)
      const t2 = setTimeout(() => {
        dipping = false
        host?.classList.remove('busy')
      }, still ? 0 : 900)
      ctx.onCleanup(() => clearTimeout(t2))
    }, still ? 0 : 750)
    ctx.onCleanup(() => clearTimeout(t1))
  }
  function fillUp() {
    if (full) return
    full = true
    host?.classList.add('full')
    ctx.chime('soft')
    // step 2: the stones (unless the voices are already being heard)
    bucketDot?.done()
    bucketArrow?.done()
    if (!said) ctx.prompt(cp.prompts[1])
  }
  // life (drifting pages, drips) runs for 10 s after the last touch, then the pond rests
  function stir() {
    if (still || !host) return
    host.classList.add('astir')
    clearTimeout(idle)
    idle = window.setTimeout(() => host?.classList.remove('astir'), 10000)
  }
  ctx.onCleanup(() => clearTimeout(idle))

  // the component has just written its boxes: read the frame back from them (no layout read)
  function frame(g: PondGeo) {
    const root = ctx.art.querySelector<HTMLElement>('.p2c'), card = ctx.art.querySelector<HTMLElement>('.p2c-card'), st = ctx.art.querySelector<HTMLElement>('.p2c-stage')
    FH = parseFloat(root?.style.height ?? '') || g.h
    FW = (parseFloat(card?.style.left ?? '') || 0) + (parseFloat(card?.style.width ?? '') || g.w) + (parseFloat(st?.style.left ?? '') || 0)
    tall = FW / FH <= 1.15
  }
  // the component's stone box width for this stage (its own formula), so the names come out at a set size in px
  const stoneBox = (g: PondGeo) => {
    const bw = clamp(Math.min(g.w, g.h * 1.7) * 0.19, 64, 140)
    return Math.min(g.w / 2 - bw * 1.15, (g.h / 2 - bw * 0.75 * 1.2) / 0.46, bw * 2.3) < 50 ? 60 : bw
  }
  const N = WHO.length // four voices on the data that went in (audit v3 30-4: the user's stone was about output, off topic)
  const spots = (k: number): { x: number; y: number; s: number } => {
    const u = k / Math.max(1, N - 1) // 0 … 1 left to right
    if (tall) {
      // a phone: alternately in front and a little behind
      const front = k % 2 === 0
      return { x: FW * (0.17 + 0.66 * u), y: FH * (front ? 0.625 : 0.53), s: front ? 1.35 : 1.2 }
    }
    const d = Math.abs(u - 0.5) * 2
    return { x: FW * (0.3 + 0.56 * u), y: FH * (0.955 - (1 - d) * 0.035), s: 0.92 + d * 0.12 }
  }

  const circle = perspectiveCircle(cp.perspectives as Perspectives, {
    label: cp.label,
    prompt: cp.prompts[0], // step 1: fetch the data up out of the pond
    detail: cp.insight as Fact,
    stage(el, api) {
      host = el
      api.onLayout(draw)
      el.classList.add('t30c-stage')
      svg = s('svg', { class: 't30c-svg', 'aria-hidden': 'true' })
      front = s('svg', { class: 't30c-svg', 'aria-hidden': 'true' })
      el.append(svg, deep, front, sweepBtn, boards)
      // pull the pole's tip down: drag from the bucket (or anywhere on the pole) toward the water
      let drag: { id: number; y: number; a: number } | null = null
      el.addEventListener('pointerdown', (e) => {
        const t = e.target as Element
        if (e.button || !geo || dipping || !t.closest('.t30c-sweep, .t30c-grab')) return
        drag = { id: e.pointerId, y: e.clientY, a: 0 }
        el.setPointerCapture(e.pointerId)
        stir()
      })
      el.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.id || !geo) return
        drag.a = clamp((e.clientY - drag.y) / 140, 0, 1) * geo.amax
        if (!still) pose(drag.a, false)
      })
      const end = (e: PointerEvent) => {
        if (!drag || e.pointerId !== drag.id || !geo) return
        const a = drag.a
        drag = null
        if (a > geo.amax * 0.45 || a < geo.amax * 0.04 || still) dip() // a firm pull, or a plain tap on the bucket
        else pose(0, true)
      }
      el.addEventListener('pointerup', end)
      el.addEventListener('pointercancel', end)
      sweepBtn.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        dip()
        stir()
      })
      return () => el.replaceChildren()
    },
    place(k, _n, g) {
      if (k === 0) frame(g)
      return { ...spots(k), z: 10 + k }
    },
    // the stone with its speaker's name cut into its face (two lines when long)
    stone: (k, g, i) => {
      names[k] = WHO[i] ?? ''
      const sc = spots(k).s
      const fs = ((tall ? 12.5 : 14.5) * 120) / (stoneBox(g) * sc)
      const words = names[k].split(' ')
      const two = names[k].length > 10 && words.length > 1
      let cut = 1, best = Infinity
      for (let j = 1; j < words.length; j++) {
        const dd = Math.abs(words.slice(0, j).join(' ').length - words.slice(j).join(' ').length)
        if (dd < best) (best = dd), (cut = j)
      }
      const lines = two ? [words.slice(0, cut).join(' '), words.slice(cut).join(' ')] : [names[k]]
      return s('g', null, stoneArt(104, 72, 3300 + i * 17 + k),
        s('text', { class: 't30c-name', x: 0, y: f1(-38 - (lines.length - 1) * fs * 0.55), 'font-size': f1(fs), 'text-anchor': 'middle', 'dominant-baseline': 'central' },
          ...lines.map((l, j) => s('tspan', { x: 0, dy: j ? f1(fs * 1.12) : '0' }, l))))
    },
    onHear(k, i) {
      heardK = k
      host?.classList.remove(...VIEWS.map((v) => `v-${v}`))
      ctx.art.querySelector('.p2c')?.classList.remove('files') // a phone: the reading comes back in place of the files
      host?.classList.add(`v-${VIEWS[i] ?? 'creator'}`, 'lit')
      if (!full) dip()
      aimBeam()
      stir()
    },
  })

  // the lantern beam from the speaking stone onto the bucket, brightest at its source, a glow where it lands
  function aimBeam() {
    if (!geo || !beam || !spot || !source || !beamG || heardK < 0) return
    const f = geo.feet[heardK]
    const sx = f.x, sy = f.y - (tall ? 46 : 62) * f.s
    const { tip, bw, by } = geo
    const cx = tip[0], cy = by + bw * 0.95
    const dx = cx - sx, dy = cy - sy, len = Math.hypot(dx, dy) || 1
    const nx = -dy / len, ny = dx / len
    const w0 = bw * 0.12, w1 = bw * 0.95
    beam.setAttribute('d', `M${f1(sx + nx * w0)} ${f1(sy + ny * w0)}L${f1(cx + nx * w1)} ${f1(cy + ny * w1)}Q${f1(cx + dx / len * w1 * 0.6)} ${f1(cy + dy / len * w1 * 0.6)} ${f1(cx - nx * w1)} ${f1(cy - ny * w1)}L${f1(sx - nx * w0)} ${f1(sy - ny * w0)}Z`)
    for (const [k, v] of [['x1', sx], ['y1', sy], ['x2', cx], ['y2', cy]] as const) beamG.setAttribute(k, f1(v))
    spot.setAttribute('cx', f1(cx))
    spot.setAttribute('cy', f1(cy))
    source.setAttribute('cx', f1(sx))
    source.setAttribute('cy', f1(sy))
  }

  function draw(g: PondGeo, feet: { x: number; y: number; s: number }[]) {
    if (!svg || !front || !host) return
    frame(g)
    const W = FW, H = FH
    const r = rng(g.seed + 40)
    // the painting takes the whole frame; the reading floats in the sky (a phone: under the bank)
    const stageEl = host.parentElement as HTMLElement
    Object.assign(stageEl.style, { left: '0px', top: '0px', width: `${f1(W)}px`, height: `${f1(H)}px` })
    const card = ctx.art.querySelector<HTMLElement>('.p2c-card')
    if (card) Object.assign(card.style, tall
      ? { left: `${f1(W * 0.06)}px`, top: `${f1(H * 0.675)}px`, width: `${f1(W * 0.88)}px`, maxHeight: 'none', transform: 'none' }
      : { left: `${f1(W * 0.03)}px`, top: `${f1(H * 0.04)}px`, width: `${f1(Math.min(W * 0.31, 460))}px`, maxHeight: 'none', transform: 'none' })
    ctx.art.querySelector('.p2c')?.classList.toggle('tall', tall)
    ctx.art.querySelectorAll<HTMLElement>('.p2c-stone').forEach((b, k) => {
      if (!b.hasAttribute('data-heard') && names[k]) b.setAttribute('aria-label', fill(L.stoneHeard, { n: k + 1, who: names[k] }))
    })
    svg.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    front.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    const far = H * (tall ? 0.27 : 0.47) // the far bank
    const near = H * (tall ? 0.44 : 0.75) // the near bank's lip
    // the sweep: a heavy beam on a forked post on the near left, its low end weighted, its tip high over the water
    const pivot: Pt = tall ? [W * 0.15, H * 0.255] : [W * 0.2, H * 0.395]
    const tip: Pt = tall ? [W * 0.78, H * 0.035] : [W * 0.84, H * 0.05]
    const tail: Pt = [pivot[0] - (tip[0] - pivot[0]) * 0.2, pivot[1] + (pivot[1] - tip[1]) * 0.2]
    const post: Pt = tall ? [W * 0.14, H * 0.5] : [W * 0.195, H * 0.97]
    const bw = clamp(W * (tall ? 0.14 : 0.066), 34, 92)
    const by = tip[1] + H * (tall ? 0.07 : 0.11) // where the bucket's bail hangs at rest
    const Lp = Math.hypot(tip[0] - pivot[0], tip[1] - pivot[1])
    const a0 = Math.atan2(tip[1] - pivot[1], tip[0] - pivot[0])
    const want = far + (near - far) * 0.45 - (by + bw * 0.6) // drop needed to put the bucket in the water
    const amax = clamp(Math.asin(clamp((Math.sin(a0) * Lp + want) / Lp, -1, 1)) - a0, 0.05, 0.8)
    geo = { pivot, tip, amax, feet, bw, by }
    const pond = `M${f1(-W * 0.05)} ${f1(far)}Q${f1(W * 0.5)} ${f1(far - H * 0.006)} ${f1(W * 1.05)} ${f1(far)}L${f1(W * 1.05)} ${f1(near - H * 0.012)}Q${f1(W * 0.55)} ${f1(near + H * 0.03)} ${f1(-W * 0.05)} ${f1(near - H * 0.004)}Z`
    const mr = clamp(W * (tall ? 0.05 : 0.02), 13, 28)
    const [mx, my] = tall ? [W * 0.42, H * 0.065] : [W * 0.47, H * 0.1]
    const deepY = far + (near - far) * 0.3 // where the moon lies in the water

    // ── the library in the water: shelves of books hanging upside down from the far edge, a lit lattice window, the moon
    const shelfH = (near - far) * 0.2
    // (each shelf row fainter than the one above: the reflection fades with depth, no mask needed)
    const spines = [0, 1, 2].map(() => ['', '', '', ''])
    let shelves = ''
    for (let j = 0; j < 3; j++) {
      const y0 = far + 2 + j * shelfH
      shelves += `M${f1(-W * 0.05)} ${f1(y0)}H${f1(W * 1.05)}`
      for (let x = -W * 0.04; x < W * 1.04;) {
        if (r() < 0.07) {
          x += W * (0.02 + r() * 0.04) // a gap: a bay, a ladder
          continue
        }
        const sw = clamp(W * (0.003 + r() * 0.004), 2.5, 9), sh = shelfH * (0.55 + r() * 0.38)
        const lean = r() < 0.08 ? sw * 0.8 : 0
        spines[j][Math.floor(r() * 4)] += `M${f1(x)} ${f1(y0 + 1)}h${f1(sw)}l${f1(lean)} ${f1(sh)}h${f1(-sw)}Z`
        x += sw + 0.6
      }
    }
    const winX = W * (tall ? 0.62 : 0.66), winW = W * (tall ? 0.16 : 0.07), winH = shelfH * 2.2
    let lattice = ''
    for (let j = 1; j < 4; j++) lattice += `M${f1(winX - winW / 2 + (winW * j) / 4)} ${f1(far + 2)}v${f1(winH)}`
    for (let j = 1; j < 5; j++) lattice += `M${f1(winX - winW / 2)} ${f1(far + 2 + (winH * j) / 5)}h${f1(winW)}`
    // ripple breaks across the reflection, longer near
    let breaks = ''
    for (let y = far + 4; y < near; y += 3 + (y - far) * 0.06 + r() * 3) {
      const t = (y - far) / (near - far)
      const len = W * (0.04 + t * 0.12) * (0.5 + r())
      const x = r() * W * 1.1 - W * 0.05
      breaks += stroke([[x, y], [x + len, y + 0.5]], 0.8 + t * 1.6, 0.3, 0.3, 0.2)
    }
    let rip = ''
    for (let i = 0; i < 40; i++) {
      const y = far + 4 + r() * (near - far - 6), t = (y - far) / (near - far)
      const len = W * (0.02 + t * 0.05) * (0.5 + r())
      const x = r() * W
      rip += stroke([[x, y], [x + len, y + (r() - 0.5)]], 0.7 + t * 1.3, 0.3, 0.3, 0.1)
    }
    // ── the bucket at the tip: big, banded; full of pages dripping silver; five ways of seeing it
    const b = bucket(tip[0], by, bw)
    const top = b.top
    let spill = '', spillText = ''
    ;[-26, -9, 7, 22, 36].forEach((tilt, j) => {
      const sh = sheet([tip[0] - bw * 0.32 + j * bw * 0.16, top - bw * (0.14 + (j % 2) * 0.08)], bw * 0.3, bw * 0.4, tilt, g.seed + j)
      spill += sh.page
      spillText += sh.text
    })
    let drops = '', streams = ''
    for (let j = 0; j < 7; j++) {
      const x = tip[0] - bw * 0.36 + r() * bw * 0.72, y = top + b.bh + bw * 0.18 + j * bw * 0.22
      const q = bw * (0.05 + r() * 0.03)
      drops += `M${f1(x)} ${f1(y)}q${f1(q)} ${f1(q * 1.8)} 0 ${f1(q * 2.4)}q${f1(-q)} ${f1(-q * 0.6)} 0 ${f1(-q * 2.4)}Z`
    }
    for (const k of [-0.28, 0.06, 0.3]) streams += stroke([[tip[0] + bw * k, top + b.bh - 2], [tip[0] + bw * k * 1.1, top + b.bh + bw * 0.9]], Math.max(1, bw * 0.03), 0.05, 0.6, 0.1)
    const seals = [0, 1, 2].map((j) => `M${f1(tip[0] - bw * 0.36 + j * bw * 0.24)} ${f1(top - bw * 0.26 - (j % 2) * bw * 0.06)}h${f1(bw * 0.1)}v${f1(bw * 0.1)}h${f1(-bw * 0.1)}Z`).join('')
    const rope = `M${P(tip)}L${f1(tip[0])} ${f1(by - bw * 0.15)}`
    const views = s('g', { class: 't30c-views' },
      // creator: their red seal on the pages
      s('path', { class: 't30c-v t30c-v-creator t30c-seal', d: seals }),
      // AI company: water poured freely from the bucket; a notch in the rope for owners who opt out
      s('g', { class: 't30c-v t30c-v-company' },
        s('path', { class: 't30c-pour', d: stroke(curve([tip[0] + bw * 0.45, top + bw * 0.1], [tip[0] + bw * 0.95, top + bw * 0.3], [tip[0] + bw * 1.05, far + (near - far) * 0.3], 10), Math.max(2, bw * 0.12), 0.1, 0.3, 0.4) }),
        s('path', { class: 't30c-slot', d: `M${f1(tip[0] - bw * 0.2)} ${f1((tip[1] + by) / 2 - bw * 0.2)}h${f1(bw * 0.4)}v${f1(bw * 0.3)}h${f1(-bw * 0.4)}Z` })),
      // court: the bucket split in two — bought books fine, pirated ones struck through
      s('g', { class: 't30c-v t30c-v-court' },
        s('path', { class: 't30c-split', d: `M${f1(tip[0])} ${f1(top - bw * 0.35)}V${f1(top + b.bh + bw * 0.1)}` }),
        s('path', { class: 't30c-strike', d: `M${f1(tip[0] + bw * 0.08)} ${f1(top - bw * 0.3)}l${f1(bw * 0.36)} ${f1(bw * 0.28)}M${f1(tip[0] + bw * 0.44)} ${f1(top - bw * 0.3)}l${f1(-bw * 0.36)} ${f1(bw * 0.28)}` })),
      // lawmaker: a paper tag tied to the bail, listing what is inside
      s('g', { class: 't30c-v t30c-v-lawmaker' },
        s('path', { class: 't30c-string', d: `M${f1(tip[0] + bw * 0.5)} ${f1(top)}q${f1(bw * 0.3)} ${f1(bw * 0.2)} ${f1(bw * 0.5)} ${f1(bw * 0.5)}` }),
        s('path', { class: 't30c-tag', d: `M${f1(tip[0] + bw * 0.85)} ${f1(top + bw * 0.45)}h${f1(bw * 0.5)}v${f1(bw * 0.7)}h${f1(-bw * 0.5)}Z` }),
        s('path', { class: 't30c-tag-lines', d: [0, 1, 2, 3].map((j) => `M${f1(tip[0] + bw * 0.92)} ${f1(top + bw * (0.6 + j * 0.14))}h${f1(bw * (0.3 - (j % 2) * 0.08))}`).join('') })),
      // user: a prompt's ripple on the water below, a slip with no seal
      s('g', { class: 't30c-v t30c-v-user' },
        ...[1, 1.7, 2.4].map((k) => s('ellipse', { class: 't30c-ring', cx: f1(tip[0]), cy: f1(far + (near - far) * 0.5), rx: f1(bw * 0.6 * k), ry: f1(bw * 0.14 * k) })),
        s('path', { class: 't30c-blank', d: `M${f1(tip[0] - bw * 1.7)} ${f1(far + (near - far) * 0.42)}l${f1(bw * 0.7)} -2l1 ${f1(bw * 0.45)}l${f1(-bw * 0.7)} 2Z` })))
    lift = s('g', { class: 't30c-lift' },
      s('path', { class: 't30c-rope', d: rope }),
      s('g', { class: 't30c-full' }, s('path', { class: 't30c-page', d: spill }), s('path', { class: 't30c-line', d: spillText })),
      s('path', { class: 't30c-wood', d: b.body, filter: 'url(#ink-rough)' }),
      s('path', { class: 't30c-wood-hi', d: stroke([[tip[0] + bw * 0.34, top + bw * 0.08], [tip[0] + bw * 0.28, top + b.bh - bw * 0.06]], Math.max(1.2, bw * 0.07), 0.2, 0.2, 0.2) }),
      s('path', { class: 't30c-stave', d: b.staves }),
      s('path', { class: 't30c-hoop', d: b.hoops }),
      s('path', { class: 't30c-rope', d: b.bail }),
      s('path', { class: 't30c-stream t30c-full', d: streams }),
      s('path', { class: 't30c-drop t30c-full', d: drops }),
      views)
    // the beam: thick at the post, tapering to the tip, with grain and a moonlit top edge; the lashed counterweight
    const beamPts = [tail, pivot, tip]
    let grain = ''
    for (let j = 0; j < 4; j++) {
      const k0 = 0.08 + r() * 0.3, k1 = k0 + 0.25 + r() * 0.3
      const at = (k: number, o: number): Pt => [tail[0] + (tip[0] - tail[0]) * k, tail[1] + (tip[1] - tail[1]) * k + o]
      const o = (r() - 0.5) * W * 0.008
      grain += stroke([at(k0, o), at(Math.min(0.97, k1), o)], 0.9, 0.3, 0.3, 0.2)
    }
    const wr = clamp(W * (tall ? 0.085 : 0.042), 20, 62)
    const wc: Pt = [tail[0] + wr * 0.25, tail[1] + wr * 1.05]
    let lash = ''
    for (const k of [-0.35, 0.1, 0.5]) lash += stroke(curve([wc[0] - wr * 0.95, wc[1] + wr * k], [wc[0], wc[1] + wr * (k + 0.28)], [wc[0] + wr * 0.95, wc[1] + wr * k], 10), Math.max(1.2, wr * 0.07), 0.1, 0.1, 0.5)
    pole = s('g', { class: 't30c-pole', style: `transform-origin:${f1(pivot[0])}px ${f1(pivot[1])}px` },
      s('path', { class: 't30c-cord', d: `M${P(tail)}L${f1(wc[0])} ${f1(wc[1] - wr * 0.7)}` }),
      s('path', { class: 't30c-weight', d: blob(wc[0], wc[1], wr, wr * 0.82, g.seed + 2, 0.15, 14), filter: 'url(#ink-rough)' }),
      s('path', { class: 't30c-weight-shade', d: blob(wc[0] + wr * 0.18, wc[1] + wr * 0.2, wr * 0.8, wr * 0.62, g.seed + 3, 0.15, 12) }),
      s('path', { class: 't30c-lash', d: lash }),
      s('path', { class: 't30c-arm', d: stroke(beamPts, Math.max(9, W * (tall ? 0.045 : 0.021)), 0.02, 0.5, 0.45), filter: 'url(#ink-rough)' }),
      s('path', { class: 't30c-grain', d: grain }),
      s('path', { class: 't30c-arm-hi', d: stroke([[pivot[0] + 2, pivot[1] - Math.max(4, W * 0.008)], [tip[0] - 2, tip[1] - 2]], Math.max(1.4, W * 0.003), 0.2, 0.3, 0.2) }),
      s('path', { class: 't30c-grab', d: stroke([pivot, tip], Math.max(28, W * 0.03), 0, 0, 1) }))
    beamG = s('linearGradient', { id: 't30c-beam-g', gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 1, y2: 1 },
      s('stop', { offset: 0, style: 'stop-color:var(--lantern);stop-opacity:.75' }),
      s('stop', { offset: 0.55, style: 'stop-color:var(--lantern);stop-opacity:.28' }),
      s('stop', { offset: 1, style: 'stop-color:var(--lantern);stop-opacity:.12' })) as SVGLinearGradientElement
    beam = s('path', { class: 't30c-beam', fill: 'url(#t30c-beam-g)' })
    spot = s('circle', { class: 't30c-spot', r: f1(bw * 1.25), fill: 'url(#p2-lamp)' })
    source = s('circle', { class: 't30c-spot t30c-source', r: f1(bw * 0.5), fill: 'url(#p2-lamp)' })
    // the post: a forked trunk, bark strokes, its lit edge
    const postW = Math.max(10, W * (tall ? 0.05 : 0.024))
    let bark = ''
    for (let j = 0; j < 6; j++) {
      const y = pivot[1] + (post[1] - pivot[1]) * (0.12 + j * 0.15)
      bark += stroke([[post[0] - postW * 0.3, y], [post[0] - postW * 0.05, y + postW * 0.5]], 1, 0.3, 0.3, 0.2)
    }
    // the near bank: a moonlit lip, raked sand, moss, reeds
    const bank = `M${f1(-W * 0.05)} ${f1(near - H * 0.004)}Q${f1(W * 0.55)} ${f1(near + H * 0.03)} ${f1(W * 1.05)} ${f1(near - H * 0.012)}L${f1(W * 1.05)} ${f1(H * 1.05)}L${f1(-W * 0.05)} ${f1(H * 1.05)}Z`
    const deepAt = (j: number) => far + (near - far) * (0.15 + j * 0.28)
    svg.replaceChildren(
      s('defs', null,
        s('clipPath', { id: 't30c-water' }, s('path', { d: pond })),
        s('linearGradient', { id: 't30c-pond-g', x1: 0, y1: 0, x2: 0, y2: 1 },
          s('stop', { offset: 0, class: 't30c-pst', style: 'stop-opacity:0.7' }),
          s('stop', { offset: 1, class: 't30c-pst', style: 'stop-opacity:1' })),
        beamG),
      mist(W * 0.5, far - H * 0.14, W * 0.75, H * 0.24),
      moon(mx, my, mr, g.seed + 3, true),
      hills(-W * 0.05, W * 1.05, far, H * (tall ? 0.12 : 0.15), g.seed + 4, 0.9, 5),
      hills(W * 0.45, W * 1.08, far + 2, H * 0.09, g.seed + 5, 0.6, 2),
      mist(W * 0.5, far, W * 0.7, H * 0.035),
      s('path', { class: 't30c-pond', d: pond, fill: 'url(#t30c-pond-g)' }),
      s('g', { 'clip-path': 'url(#t30c-water)' },
        s('g', { class: 't30c-library' },
          s('rect', { class: 't30c-lib-win', x: f1(winX - winW / 2), y: f1(far + 2), width: f1(winW), height: f1(winH) }),
          s('path', { class: 't30c-lib-lattice', d: lattice }),
          ...spines.map((row, j) => s('g', { style: `opacity:${[1, 0.62, 0.32][j]}` }, ...row.map((d, q) => s('path', { class: `t30c-spine t30c-spine-${q}`, d })))),
          s('path', { class: 't30c-shelf', d: shelves }))))
    front.replaceChildren(
      // the surface over the drowned pages: the moon's road and its broken disc, ripple breaks
      s('g', { 'clip-path': 'url(#t30c-water)' },
        s('ellipse', { cx: f1(mx), cy: f1((far + near) / 2), rx: f1(W * 0.05), ry: f1((near - far) * 0.6), fill: 'url(#p2-road)' }),
        s('ellipse', { class: 't30c-moon-in', cx: f1(mx), cy: f1(deepY), rx: f1(mr * 1.1), ry: f1(mr * 0.42) }),
        s('path', { class: 't30c-break', d: breaks }),
        s('path', { class: 'p2p-ripple', d: rip })),
      s('path', { class: 't30c-bank', d: bank }),
      s('path', { class: 't30c-shore', d: stroke(curve([-W * 0.02, near - H * 0.003], [W * 0.55, near + H * 0.032], [W * 1.02, near - H * 0.01], 24), Math.max(2, H * 0.006), 0.1, 0.1, 0.5), filter: 'url(#ink-rough)' }),
      s('path', { class: 't30c-rake', d: [0.05, 0.1, 0.16].map((k, i) => `M${f1(W * (0.22 + i * 0.03))} ${f1(near + H * k)}Q${f1(W * 0.58)} ${f1(near + H * (k + 0.03))} ${f1(W * (0.98 - i * 0.03))} ${f1(near + H * k)}`).join('') }),
      wash(blob(W * 0.24, near + H * 0.05, W * 0.1, H * 0.02, g.seed + 9, 0.3), 0.3, 'p2p-wash t30c-moss'),
      reeds(W * 0.97, near + 2, H * 0.14, g.seed + 6, 6),
      grass(W * 0.45, near + H * 0.04, W * 0.04, g.seed + 7),
      s('path', { class: 't30c-rail', d: tall ? stroke([[W * 0.02, H * 0.665], [W * 0.98, H * 0.67]], Math.max(4, W * 0.014), 0.05, 0.05, 0.6) : '' }),
      beam, spot, source,
      // the post and its shadow; the beam and the bucket over the water
      s('ellipse', { class: 't30-contact', cx: f1(post[0] + 4), cy: f1(post[1]), rx: f1(postW * 1.6), ry: f1(postW * 0.3) }),
      s('path', { class: 't30c-post', d: stroke([post, [pivot[0], pivot[1] + postW * 0.4]], postW, 0.02, 0.05, 0.8), filter: 'url(#ink-rough)' }),
      s('path', { class: 't30c-bark', d: bark }),
      s('path', { class: 't30c-fork', d: stroke([[pivot[0] - postW * 0.9, pivot[1] - postW * 1.3], [pivot[0], pivot[1] + postW * 0.6], [pivot[0] + postW * 0.9, pivot[1] - postW * 1.3]], postW * 0.55, 0.1, 0.1, 0.6), filter: 'url(#ink-rough)' }),
      s('path', { class: 't30c-post-hi', d: stroke([[post[0] + postW * 0.32, post[1] - 4], [pivot[0] + postW * 0.32, pivot[1] + postW]], Math.max(1, postW * 0.14), 0.2, 0.2, 0.2) }),
      lift,
      pole,
      s('circle', { class: 't30c-pin', cx: f1(pivot[0]), cy: f1(pivot[1]), r: f1(postW * 0.22) }),
      reeds(W * 0.02, H * 1.0, H * 0.22, g.seed + 8, 8))
    // the pages and scrolls swimming under the water, three depths (the deeper, the smaller, fainter and more blurred)
    deep.style.clipPath = `path('${pond}')`
    deep.replaceChildren(...[0, 1, 2].map((j) => school(j, W, H, deepAt(j), far, near, g.seed + 60 + j * 9)))
    // the keyboard / drag handle sits on the bucket; the court boards hang from the beam (a phone: from the rail)
    Object.assign(sweepBtn.style, { left: `${f1(tip[0] - bw * 0.9)}px`, top: `${f1(by - bw * 0.3)}px`, width: `${f1(bw * 1.8)}px`, height: `${f1(bw * 1.9)}px` })
    const armY = (x: number) => pivot[1] + ((tip[1] - pivot[1]) * (x - pivot[0])) / (tip[0] - pivot[0])
    const bx = tall ? [W * 0.265, W * 0.735] : [W * 0.545, W * 0.72]
    const bwid = tall ? [W * 0.45, W * 0.45] : [Math.min(W * 0.17, 250), Math.min(W * 0.15, 220)]
    bx.forEach((x, j) => {
      boards.style.setProperty(`--x${j}`, `${f1(x)}px`)
      boards.style.setProperty(`--y${j}`, `${f1(tall ? H * 0.668 : armY(x) + 4)}px`)
      boards.style.setProperty(`--w${j}`, `${f1(bwid[j])}px`)
    })
    boards.classList.toggle('low', tall)
    pose(0, false)
    aimBeam()
  }

  /** One depth of the drowned library: pages with a paper tail, scrolls trailing their sheet, scores — swimming like koi. */
  function school(j: number, W: number, H: number, y0: number, far: number, near: number, seed: number) {
    const r = rng(seed)
    const n = [10, 8, 6][j]
    const k = [0.55, 0.8, 1.15][j] // size by depth
    let pages = '', lines = '', rods = '', tails = ''
    for (let i = 0; i < n; i++) {
      const x = W * (0.03 + (i + r() * 0.8) / n * 0.94), y = clamp(y0 + (r() - 0.5) * (near - far) * 0.32, far + 6, near - 6)
      const len = clamp(W * 0.045, 18, 56) * k * (0.8 + r() * 0.4)
      const ang = (180 + (r() - 0.5) * 50) * (Math.PI / 180) // most swim leftward
      const dx = Math.cos(ang), dy = Math.sin(ang) * 0.35
      const head: Pt = [x + dx * len * 0.3, y + dy * len * 0.3]
      const sway = (r() < 0.5 ? -1 : 1) * len * (0.12 + r() * 0.12)
      const tail: Pt = [x - dx * len * 0.62, y - dy * len * 0.62 + sway * 0.5]
      const mid: Pt = [(head[0] + tail[0]) / 2, (head[1] + tail[1]) / 2 - sway]
      tails += stroke(curve(head, mid, tail, 12), len * 0.34, 0.02, 0.7, 0.35)
      // the tail fans out like a koi's: two short lobes
      tails += stroke([tail, [tail[0] - dx * len * 0.22, tail[1] - len * 0.1]], len * 0.1, 0.1, 0.6, 0.2) + stroke([tail, [tail[0] - dx * len * 0.22, tail[1] + len * 0.1]], len * 0.1, 0.1, 0.6, 0.2)
      const kind = (i + j) % 3
      if (kind === 1) rods += stroke([[head[0] - dy * len * 0.25, head[1] - len * 0.18], [head[0] + dy * len * 0.25, head[1] + len * 0.18]], Math.max(1.5, len * 0.1), 0.1, 0.1, 0.6)
      else {
        const sh = sheet(head, len * 0.42, len * 0.34, (ang * 180) / Math.PI - 180 + (r() - 0.5) * 20, seed + i)
        pages += sh.page
        lines += kind === 2 ? [0, 1, 2, 3].map((q) => `M${f1(head[0] - len * 0.16)} ${f1(head[1] - len * 0.08 + q * len * 0.05)}h${f1(len * 0.32)}`).join('') : sh.text
      }
    }
    return s('svg', { class: `t30c-layer t30c-layer-${j}`, viewBox: `0 0 ${f1(W)} ${f1(H)}` },
      s('path', { class: 't30c-koi-tail', d: tails }),
      s('path', { class: 't30c-page', d: pages }),
      s('path', { class: 't30c-rod', d: rods }),
      s('path', { class: 't30c-line', d: lines }))
  }

  ctx.art.append(h('p', { class: 'visually-hidden' }, cp.art))
  const off = circle.mount({
    ...ctx,
    insight(f, d) {
      said = true
      const el = ctx.insight(f, d)
      // the court file: a wooden board hung from the beam (a phone: from the rail at the bank, in place of the reading)
      if (!boards.childElementCount) boards.append(...cp.cases.map((c, j) => h('div', { class: `t30c-board b${j} t30-new` }, j ? null : h('p', { class: 't30-eyebrow' }, cp.casesLabel), ctx.fact(c as Fact, 'p'))))
      ctx.art.querySelector('.p2c')?.classList.add('files')
      return el
    },
  })
  ctx.art.querySelector('.p2c')?.classList.add('t30c')
  // guide: a dot on the bucket and an arrow down to the water (the dip is a hidden gesture)
  const gd = guide(ctx)
  bucketDot = gd.dot(sweepBtn, { dir: [0, 1] })
  bucketArrow = gd.gesture('drag-v', sweepBtn, { r: 34 })
  return off
}
