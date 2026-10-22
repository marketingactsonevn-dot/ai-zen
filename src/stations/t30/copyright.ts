import { fill, h, s } from '../../core/dom'
import { L, type Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { perspectiveCircle, type PondGeo } from '../../ui/part2/perspectives'
import type { Perspectives } from '../../ui/part2/types'
import { blob, clamp, curve, rng, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist, moon, reeds, wash } from '../../ui/part2/paint'
import { C } from './data'
import { guide } from '../../ui/part2/guide'
import { bamboo, bucket, f1, P, sheet } from './kit'

const cp = C.scenes.copyright
const VIEWS = ['creator', 'company', 'court', 'lawmaker', 'user'] // content order of the five stones (art keyed to it)
const WHO = (cp.perspectives as Perspectives).stones.map((x) => x.who)

/**
 * II·12 "copyright" (2.5D, perspectiveCircle): EYE level at the edge of a moon pond; the painting fills the frame. A heavy
 * wooden well-sweep (shadoof) crosses it on a diagonal: a forked post on the near left bank, a lashed counterweight stone
 * at the low end, a bamboo beam reaching up over the water to a big bucket on a rope. A library hall stands on the far bank
 * (shelves of books in its open bays) and its reflection hangs in the water, broken by ripples; pages, scrolls and scores
 * drift under the surface like koi, blurred by depth. Four stones of different builds lie along the near bank. Pull the beam down (drag
 * or Enter): the bucket dips and comes up full of pages dripping silver — training data. Touch a stone: a lantern beam from
 * it lands on the bucket, glowing there, and shows how that voice sees it (seals, an opt-out slot in the rope, a split
 * bucket, a tag of contents, a prompt's unsealed ripple). What it says is written in the sky, not on a card. All five: the
 * common ground, then the court file hangs as one wooden board from the beam (a phone: on two stakes in the bank).
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
    if (dipping || !geo || said) return
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
  // four voices on the data that went in (audit v3 30-4: the user's stone was about output, off topic)
  // the stones lie along the curve of the near bank, from near (bottom left, big) to far (right, smaller) — not a row
  const ARC = [[0.31, 0.955, 1.16], [0.5, 0.9, 1.0], [0.67, 0.855, 0.88], [0.83, 0.815, 0.78]]
  const ARC_TALL = [[0.2, 0.94, 1.55], [0.46, 0.9, 1.38], [0.68, 0.87, 1.22], [0.87, 0.84, 1.06]]
  const spots = (k: number): { x: number; y: number; s: number } => {
    const [x, y, sc] = (tall ? ARC_TALL : ARC)[Math.min(k, 3)]
    return { x: FW * x, y: FH * y, s: sc }
  }
  // four different stones (size, build), each with moss on its crown
  const DIMS = [[112, 80], [98, 64], [108, 74], [92, 62]]

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
        if (e.button || !geo || dipping || said || !t.closest('.t30c-sweep, .t30c-grab')) return
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
      return { ...spots(k), z: 20 - k } // the nearer, the more in front
    },
    // the stone with its speaker's name cut into its face (two lines when long)
    stone: (k, g, i) => {
      names[k] = WHO[i] ?? ''
      const sc = spots(k).s
      const fs = ((tall ? 14 : 14.5) * 120) / (stoneBox(g) * sc)
      const words = names[k].split(' ')
      const two = names[k].length > 10 && words.length > 1
      let cut = 1, best = Infinity
      for (let j = 1; j < words.length; j++) {
        const dd = Math.abs(words.slice(0, j).join(' ').length - words.slice(j).join(' ').length)
        if (dd < best) (best = dd), (cut = j)
      }
      const lines = two ? [words.slice(0, cut).join(' '), words.slice(cut).join(' ')] : [names[k]]
      const [sw, sh] = DIMS[k % 4]
      return s('g', null, stoneArt(sw, sh, 3300 + i * 17 + k),
        s('path', { class: 't30c-stone-moss', d: blob(-sw * 0.12, -sh * 0.9, sw * 0.24, sh * 0.07, 3350 + k, 0.4, 10) + blob(sw * 0.22, -sh * 0.62, sw * 0.1, sh * 0.05, 3360 + k, 0.4, 8), filter: 'url(#ink-wash)' }),
        s('text', { class: 't30c-name', x: 0, y: f1(-sh * 0.5 - (lines.length - 1) * fs * 0.55), 'font-size': f1(fs), 'text-anchor': 'middle', 'dominant-baseline': 'central' },
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
      ? { left: `${f1(W * 0.06)}px`, top: `${f1(H * 0.02)}px`, width: `${f1(W * 0.74)}px`, maxHeight: 'none', transform: 'none' }
      : { left: `${f1(W * 0.035)}px`, top: `${f1(H * 0.04)}px`, width: `${f1(Math.min(W * 0.29, 430))}px`, maxHeight: 'none', transform: 'none' })
    ctx.art.querySelector('.p2c')?.classList.toggle('tall', tall)
    ctx.art.querySelectorAll<HTMLElement>('.p2c-stone').forEach((b, k) => {
      if (!b.hasAttribute('data-heard') && names[k]) b.setAttribute('aria-label', fill(L.stoneHeard, { n: k + 1, who: names[k] }))
    })
    svg.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    front.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    const far = H * (tall ? 0.53 : 0.47) // the far bank (a phone: the reading takes the sky, the pond sits lower)
    const near = H * (tall ? 0.71 : 0.75) // the near bank's lip
    // the sweep: a heavy beam on a forked post on the near left, its low end weighted, its tip high over the water
    const pivot: Pt = tall ? [W * 0.12, H * 0.56] : [W * 0.155, H * 0.46]
    const tip: Pt = tall ? [W * 0.84, H * 0.33] : [W * 0.7, H * 0.075]
    const tail: Pt = [pivot[0] - (tip[0] - pivot[0]) * 0.2, pivot[1] + (pivot[1] - tip[1]) * 0.2]
    const post: Pt = tall ? [W * 0.11, H * 0.8] : [W * 0.15, H * 0.965]
    const bw = clamp(W * (tall ? 0.17 : 0.085), 34, 124) // the bucket: big, in the right third
    const by = tip[1] + H * (tall ? 0.045 : 0.1) // where the bucket's bail hangs at rest
    const Lp = Math.hypot(tip[0] - pivot[0], tip[1] - pivot[1])
    const a0 = Math.atan2(tip[1] - pivot[1], tip[0] - pivot[0])
    const want = far + (near - far) * 0.45 - (by + bw * 0.6) // drop needed to put the bucket in the water
    const amax = clamp(Math.asin(clamp((Math.sin(a0) * Lp + want) / Lp, -1, 1)) - a0, 0.05, 0.8)
    geo = { pivot, tip, amax, feet, bw, by }
    const pond = `M${f1(-W * 0.05)} ${f1(far)}Q${f1(W * 0.5)} ${f1(far - H * 0.006)} ${f1(W * 1.05)} ${f1(far)}L${f1(W * 1.05)} ${f1(near - H * 0.012)}Q${f1(W * 0.55)} ${f1(near + H * 0.03)} ${f1(-W * 0.05)} ${f1(near - H * 0.004)}Z`
    const mr = clamp(W * (tall ? 0.05 : 0.02), 13, 28)
    const [mx, my] = tall ? [W * 0.87, H * 0.07] : [W * 0.885, H * 0.14]
    const deepY = far + (near - far) * 0.3 // where the moon lies in the water

    // ── the library: a long hall on the far bank — a stone plinth, posts, open bays with shelves of books inside (one bay
    // lit by a lantern), an eave beam on the posts and a tiled roof resting on it; its reflection hangs under it in the
    // water, broken by ripples and fading downward
    const lx0 = W * (tall ? 0.04 : 0.27), lx1 = W * (tall ? 0.56 : 0.6)
    const nb = tall ? 4 : 6, bayW = (lx1 - lx0) / nb
    const plH = Math.max(3, H * 0.012), lh = H * (tall ? 0.07 : 0.095)
    const baseY = far + 1, floorY = baseY - plH, postTop = floorY - lh
    const beamH = Math.max(3, lh * 0.1), rb = postTop - beamH, rh = lh * 0.5, ov = bayW * 0.45
    const pw = Math.max(2.5, W * 0.004)
    const spines = ['', '', '', '']
    let shelfD = '', posts = ''
    for (let k = 0; k < nb; k++) {
      const bx0 = lx0 + k * bayW + pw, bx1 = lx0 + (k + 1) * bayW - pw
      for (let j = 0; j < 3; j++) {
        const sy = floorY - (lh * (j + 1)) / 3.4 // a shelf board, the books standing on it
        shelfD += `M${f1(bx0)} ${f1(sy)}H${f1(bx1)}`
        for (let x = bx0 + 1; x < bx1 - 2;) {
          const sw = clamp(W * (0.0025 + r() * 0.003), 2, 6), sh = (lh / 3.4) * (0.55 + r() * 0.35)
          if (r() < 0.06) { x += sw * 2; continue }
          spines[Math.floor(r() * 4)] += `M${f1(x)} ${f1(sy)}v${f1(-sh)}h${f1(sw)}v${f1(sh)}Z`
          x += sw + 0.5
        }
      }
    }
    for (let k = 0; k <= nb; k++) posts += `M${f1(lx0 + k * bayW - pw / 2)} ${f1(floorY)}V${f1(postTop)}h${f1(pw)}V${f1(floorY)}Z`
    const roof = `M${f1(lx0 - ov)} ${f1(rb - rh * 0.18)}Q${f1(lx0 - ov * 0.3)} ${f1(rb + 1)} ${f1(lx0)} ${f1(rb + 1)}H${f1(lx1)}Q${f1(lx1 + ov * 0.3)} ${f1(rb + 1)} ${f1(lx1 + ov)} ${f1(rb - rh * 0.18)}L${f1(lx1 - ov * 0.5)} ${f1(rb - rh)}H${f1(lx0 + ov * 0.5)}Z`
    let tiles = ''
    for (let x = lx0 - ov * 0.6; x < lx1 + ov * 0.6; x += Math.max(5, bayW * 0.12)) {
      const k = (x - lx0) / (lx1 - lx0)
      tiles += `M${f1(x + (0.5 - k) * ov * 0.7)} ${f1(rb - rh + 2)}L${f1(x)} ${f1(rb)}`
    }
    const litBay = nb - 2
    const lib = s('g', { id: 't30c-lib' },
      s('rect', { class: 't30c-lib-in', x: f1(lx0), y: f1(postTop), width: f1(lx1 - lx0), height: f1(lh) }),
      s('rect', { class: 't30c-lib-win', x: f1(lx0 + litBay * bayW), y: f1(postTop), width: f1(bayW), height: f1(lh) }),
      ...spines.map((d, q) => s('path', { class: `t30c-spine t30c-spine-${q}`, d })),
      s('path', { class: 't30c-shelf', d: shelfD }),
      s('rect', { class: 't30c-lib-eave', x: f1(lx0), y: f1(postTop), width: f1(lx1 - lx0), height: f1(lh * 0.35), fill: 'url(#t30c-eave-g)' }),
      s('path', { class: 't30c-lib-post', d: posts }),
      s('rect', { class: 't30c-lib-plinth', x: f1(lx0 - pw * 2), y: f1(floorY), width: f1(lx1 - lx0 + pw * 4), height: f1(plH) }),
      s('rect', { class: 't30c-lib-post', x: f1(lx0 - pw), y: f1(postTop - beamH), width: f1(lx1 - lx0 + pw * 2), height: f1(beamH) }),
      s('path', { class: 't30c-lib-roof', d: roof, filter: 'url(#ink-rough)' }),
      s('path', { class: 't30c-lib-tile', d: tiles }),
      s('path', { class: 't30c-lib-ridge', d: stroke([[lx0 + ov * 0.45, rb - rh], [lx1 - ov * 0.45, rb - rh]], Math.max(2, rh * 0.14), 0.05, 0.05, 0.6) }),
      s('path', { class: 't30c-lib-rim', d: stroke([[lx1 - ov * 0.5, rb - rh], [lx1 + ov, rb - rh * 0.18]], Math.max(1, rh * 0.07), 0.2, 0.2, 0.3) }))
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
        // a paper tag (a cut corner, a tie hole), hanging a little askew from its string
        s('g', { transform: `rotate(-8 ${f1(tip[0] + bw)} ${f1(top + bw * 0.5)})` },
          s('path', { class: 't30c-tag', d: `M${f1(tip[0] + bw * 0.88)} ${f1(top + bw * 0.5)}l${f1(bw * 0.12)} ${f1(-bw * 0.06)}l${f1(bw * 0.12)} ${f1(bw * 0.06)}v${f1(bw * 0.52)}h${f1(-bw * 0.24)}Z` }),
          s('circle', { class: 't30c-tag-hole', cx: f1(tip[0] + bw), cy: f1(top + bw * 0.5), r: f1(Math.max(1, bw * 0.018)) }),
          s('path', { class: 't30c-tag-lines', d: [0, 1, 2].map((j) => `M${f1(tip[0] + bw * 0.92)} ${f1(top + bw * (0.66 + j * 0.11))}h${f1(bw * (0.16 - (j % 2) * 0.05))}`).join('') }))),
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
    // the beam is a bamboo culm with nodes, thick at the post; the counterweight a stone in a rope net on a cord
    const armW = Math.max(9, W * (tall ? 0.04 : 0.019))
    const wr = clamp(W * (tall ? 0.085 : 0.042), 20, 62)
    const wc: Pt = [tail[0] + wr * 0.25, tail[1] + wr * 1.15]
    let net = ''
    for (const k of [-0.4, 0.05, 0.48]) net += stroke(curve([wc[0] - wr * 0.95, wc[1] + wr * k], [wc[0], wc[1] + wr * (k + 0.3)], [wc[0] + wr * 0.95, wc[1] + wr * k], 10), Math.max(1.1, wr * 0.06), 0.1, 0.1, 0.5)
    for (const k of [-0.55, 0, 0.55]) net += stroke(curve([wc[0] + wr * k * 0.6, wc[1] - wr * 0.78], [wc[0] + wr * k * 1.25, wc[1]], [wc[0] + wr * k * 0.7, wc[1] + wr * 0.8], 10), Math.max(1.1, wr * 0.06), 0.1, 0.1, 0.5)
    pole = s('g', { class: 't30c-pole', style: `transform-origin:${f1(pivot[0])}px ${f1(pivot[1])}px` },
      s('path', { class: 't30c-cord', d: `M${P(tail)}L${f1(wc[0])} ${f1(wc[1] - wr * 0.78)}` }),
      s('path', { class: 't30c-weight', d: blob(wc[0], wc[1], wr, wr * 0.82, g.seed + 2, 0.15, 14), filter: 'url(#ink-rough)' }),
      s('path', { class: 't30c-weight-shade', d: blob(wc[0] + wr * 0.18, wc[1] + wr * 0.2, wr * 0.8, wr * 0.62, g.seed + 3, 0.15, 12) }),
      s('path', { class: 't30c-lash', d: net }),
      bamboo(tail, tip, armW, g.seed + 11, true, 0),
      s('path', { class: 't30c-arm-hi', d: stroke([[pivot[0] + 2, pivot[1] - armW * 0.42], [tip[0] - 2, tip[1] - armW * 0.3]], Math.max(1.2, armW * 0.1), 0.2, 0.3, 0.2) }),
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
        // the reflection broken by the surface: a still displacement in long horizontal bands (never animated)
        s('filter', { id: 't30c-ripple', x: '-5%', y: '-5%', width: '110%', height: '110%' },
          s('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.006 0.09', numOctaves: ctx.quality === 'low' ? 1 : 2, seed: 7, result: 'n' }),
          s('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: tall ? 7 : 11, xChannelSelector: 'R', yChannelSelector: 'G' }),
          s('feGaussianBlur', { stdDeviation: ctx.quality === 'low' ? 0 : 0.6 })),
        s('linearGradient', { id: 't30c-pond-g', x1: 0, y1: 0, x2: 0, y2: 1 },
          s('stop', { offset: 0, class: 't30c-pst', style: 'stop-opacity:0.7' }),
          s('stop', { offset: 1, class: 't30c-pst', style: 'stop-opacity:1' })),
        s('linearGradient', { id: 't30c-eave-g', x1: 0, y1: 0, x2: 0, y2: 1 },
          s('stop', { offset: 0, style: 'stop-color:var(--umbra);stop-opacity:.6' }),
          s('stop', { offset: 1, style: 'stop-color:var(--umbra);stop-opacity:0' })),
        s('linearGradient', { id: 't30c-fade-g', x1: 0, y1: 0, x2: 0, y2: 1 },
          s('stop', { offset: 0, style: 'stop-color:#fff;stop-opacity:.85' }),
          s('stop', { offset: 1, style: 'stop-color:#fff;stop-opacity:0' })),
        s('mask', { id: 't30c-fade', maskUnits: 'userSpaceOnUse', x: f1(-W * 0.05), y: f1(baseY), width: f1(W * 1.1), height: f1(lh * 1.7 + rh) },
          s('rect', { x: f1(-W * 0.05), y: f1(baseY), width: f1(W * 1.1), height: f1(lh * 1.7 + rh), fill: 'url(#t30c-fade-g)' })),
        beamG),
      mist(W * 0.5, far - H * 0.14, W * 0.75, H * 0.24),
      moon(mx, my, mr, g.seed + 3, true),
      ...(tall ? [hills(-W * 0.05, W * 1.05, far - H * 0.03, H * 0.36, g.seed + 15, 1, 4), mist(W * 0.5, far - H * 0.2, W * 0.7, H * 0.08)] : []), // a phone: a far range into the sky
      hills(-W * 0.05, W * 1.05, far, H * (tall ? 0.12 : 0.15), g.seed + 4, 0.9, 5),
      hills(W * 0.45, W * 1.08, far + 2, H * 0.09, g.seed + 5, 0.6, 2),
      mist(W * 0.5, far, W * 0.7, H * 0.035),
      s('path', { class: 't30c-pond', d: pond, fill: 'url(#t30c-pond-g)' }),
      // the hall's reflection: flipped about its foot, broken by the ripple, fading downward
      s('g', { 'clip-path': 'url(#t30c-water)' },
        s('g', { class: 't30c-library', filter: 'url(#t30c-ripple)', mask: 'url(#t30c-fade)' },
          s('use', { href: '#t30c-lib', transform: `translate(0 ${f1(2 * baseY + 2)}) scale(1 -1)` }))),
      lib,
      mist(W * 0.42, far + 2, W * 0.4, H * 0.012))
    front.replaceChildren(
      // the surface over the drowned pages: the moon's road and its broken disc, ripple breaks
      s('g', { 'clip-path': 'url(#t30c-water)' },
        s('ellipse', { cx: f1(mx), cy: f1((far + near) / 2), rx: f1(W * 0.05), ry: f1((near - far) * 0.6), fill: 'url(#p2-road)' }),
        s('ellipse', { class: 't30c-moon-in', cx: f1(mx), cy: f1(deepY), rx: f1(mr * 1.1), ry: f1(mr * 0.42) }),
        s('path', { class: 't30c-break', d: breaks }),
        s('path', { class: 'p2p-ripple', d: rip })),
      s('path', { class: 't30c-bank', d: bank }),
      s('path', { class: 't30c-shore', d: stroke(curve([-W * 0.02, near - H * 0.003], [W * 0.55, near + H * 0.032], [W * 1.02, near - H * 0.01], 24), Math.max(2, H * 0.006), 0.1, 0.1, 0.5), filter: 'url(#ink-rough)' }),
      // raked sand on the near bank (a phone's deep bank is raked all the way down)
      s('path', { class: 't30c-rake', d: (tall ? [0.04, 0.09, 0.14, 0.2] : [0.05, 0.1, 0.16]).map((k, i) => `M${f1(W * (tall ? 0.04 : 0.22 + i * 0.03))} ${f1(near + H * k)}Q${f1(W * 0.58)} ${f1(near + H * (k + 0.03))} ${f1(W * (tall ? 0.97 : 0.98 - i * 0.03))} ${f1(near + H * k)}`).join('') }),
      wash(blob(W * 0.24, near + H * 0.05, W * 0.1, H * 0.02, g.seed + 9, 0.3), 0.3, 'p2p-wash t30c-moss'),
      reeds(W * 0.97, near + 2, H * 0.14, g.seed + 6, 6),
      grass(W * 0.45, near + H * 0.04, W * 0.04, g.seed + 7),
      beam, spot, source,
      // the post and its shadow; the beam and the bucket over the water
      s('ellipse', { class: 't30-contact', cx: f1(post[0] + 4), cy: f1(post[1]), rx: f1(postW * 1.6), ry: f1(postW * 0.3) }),
      s('path', { class: 't30c-post', d: stroke([post, [pivot[0], pivot[1] + postW * 0.4]], postW, 0.02, 0.05, 0.8), filter: 'url(#ink-rough)' }),
      s('path', { class: 't30c-bark', d: bark }),
      s('path', { class: 't30c-fork', d: stroke([[pivot[0] - postW * 0.9, pivot[1] - postW * 1.3], [pivot[0], pivot[1] + postW * 0.6], [pivot[0] + postW * 0.9, pivot[1] - postW * 1.3]], postW * 0.55, 0.1, 0.1, 0.6), filter: 'url(#ink-rough)' }),
      s('path', { class: 't30c-post-hi', d: stroke([[post[0] + postW * 0.32, post[1] - 4], [pivot[0] + postW * 0.32, pivot[1] + postW]], Math.max(1, postW * 0.14), 0.2, 0.2, 0.2) }),
      s('path', { class: 't30c-lash', d: [0, 1, 2, 3].map((j) => stroke([[pivot[0] - postW * 0.62, pivot[1] + postW * (0.15 + j * 0.32)], [pivot[0] + postW * 0.62, pivot[1] + postW * (0.35 + j * 0.32)]], Math.max(1.2, postW * 0.16), 0.1, 0.1, 0.5)).join('') }),
      lift,
      pole,
      s('circle', { class: 't30c-pin', cx: f1(pivot[0]), cy: f1(pivot[1]), r: f1(postW * 0.22) }),
      reeds(W * 0.02, H * 1.0, H * 0.22, g.seed + 8, 8),
      // a phone: the near bank's dark edge at the frame's foot (the board will stand on it), reeds at both corners
      ...(tall ? [
        wash(`M${f1(-W * 0.05)} ${f1(H * 0.955)}Q${f1(W * 0.4)} ${f1(H * 0.935)} ${f1(W * 1.05)} ${f1(H * 0.95)}L${f1(W * 1.05)} ${f1(H * 1.05)}L${f1(-W * 0.05)} ${f1(H * 1.05)}Z`, 0.55, 'p2p-wash t30c-near'),
        grass(W * 0.3, H * 0.952, W * 0.1, g.seed + 12), grass(W * 0.66, H * 0.948, W * 0.08, g.seed + 13),
        reeds(W * 0.96, H * 1.0, H * 0.16, g.seed + 14, 6)] : []))
    // the pages and scrolls swimming under the water, three depths (the deeper, the smaller, fainter and more blurred)
    deep.style.clipPath = `path('${pond}')`
    deep.replaceChildren(...[0, 1, 2].map((j) => school(j, W, H, deepAt(j), far, near, g.seed + 60 + j * 9)))
    // the keyboard / drag handle sits on the bucket; the court board hangs from the beam (a phone: stands in the bank)
    Object.assign(sweepBtn.style, { left: `${f1(tip[0] - bw * 0.9)}px`, top: `${f1(by - bw * 0.3)}px`, width: `${f1(bw * 1.8)}px`, height: `${f1(bw * 1.9)}px` })
    // the court file: one wooden board hung level on two cords from the sloping beam
    const armY = (x: number) => pivot[1] + ((tip[1] - pivot[1]) * (x - pivot[0])) / (tip[0] - pivot[0])
    {
      const bwid = tall ? W * 0.6 : clamp(W * 0.21, 240, 320), x0 = W * (tall ? 0.15 : 0.255), xl = x0 + bwid * 0.14, xr = x0 + bwid * 0.86
      const top = armY(xl) + 26
      Object.assign(boards.style, { left: `${f1(x0)}px`, top: `${f1(top)}px`, width: `${f1(bwid)}px` })
      boards.style.setProperty('--cl', `${f1(top - armY(xl) - armW * 0.35)}px`)
      boards.style.setProperty('--cr', `${f1(top - armY(xr) - armW * 0.35)}px`)
      boards.className = `t30c-boards hang${tall ? ' small' : ''}`
    }
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
      // the court file: one wooden board hung from the beam (a phone: on stakes in the bank, in place of the reading)
      if (!boards.childElementCount) boards.append(h('i', { class: 't30c-cord-l', 'aria-hidden': 'true' }), h('i', { class: 't30c-cord-r', 'aria-hidden': 'true' }), h('i', { class: 't30c-board-sh', 'aria-hidden': 'true' }),
        h('div', { class: 't30c-board' }, h('p', { class: 't30-eyebrow' }, cp.casesLabel), ...cp.cases.map((c) => ctx.fact(c as Fact, 'p'))))
      ctx.art.querySelector('.p2c')?.classList.add('files')
      return el
    },
  })
  ctx.art.querySelector('.p2c')?.classList.add('t30c')
  // guide: a dot on the bucket and an arrow down to the water (the dip is a hidden gesture)
  const gd = guide(ctx)
  bucketDot = gd.dot(sweepBtn, { dir: [0, 1] })
  bucketArrow = gd.gesture('drag-v', sweepBtn, { r: 34 })
  // H7: idle, the bucket dips a little toward the water and comes back
  const invite = () => {
    if (full || dipping || still || !geo) return
    pose(geo.amax * 0.08, true)
    const t = setTimeout(() => !dipping && pose(0, true), 700)
    ctx.onCleanup(() => clearTimeout(t))
  }
  ctx.el.addEventListener('p2:idle', invite)
  ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', invite))
  return off
}
