import { fill, h, nextId, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { blob, curve, rng, stroke, type Pt } from '../../ui/part2/ink'
import { grass, mist, pine, reeds, steppingStones, wash, water } from '../../ui/part2/paint'
import { C } from './data'
import { f1, frame } from './frame'
import { bamboo, figure, nightSky } from './brush'

const G = C.scenes.gardeners
const N = 1000
const sep = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, G.sep)

/** The old gardener: conical hat, bent back, a watering can held out; his long moon shadow is painted with him. */
function gardener(k: number): SVGGElement {
  const can: Pt = [k * 0.36, -k * 0.5]
  return s('g', { class: 't28g-man' },
    s('path', { class: 't28g-cast', d: blob(-k * 0.62, k * 0.07, k * 0.78, k * 0.075, 2810, 0.12, 14), transform: `rotate(9 0 0)` }),
    s('path', { class: 'gb-figure', d: figure(0, 0, k, 2811, 1, { hat: 'cone', stoop: 0.35 }) }),
    s('path', { class: 'gb-figure', d:
      blob(can[0], can[1], k * 0.13, k * 0.1, 2812, 0.05, 10) +
      stroke([[can[0] + k * 0.1, can[1] - k * 0.02], [can[0] + k * 0.24, can[1] - k * 0.1], [can[0] + k * 0.34, can[1] - k * 0.16]], k * 0.035, 0.1, 0.1, 0.5) +
      stroke(curve([can[0] - k * 0.1, can[1] - k * 0.06], [can[0] - k * 0.02, can[1] - k * 0.2], [can[0] + k * 0.08, can[1] - k * 0.07], 6), k * 0.025, 0.1, 0.1, 0.5) }),
    s('path', { class: 't28g-spray', d: [0, 1, 2].map((i) => stroke([[can[0] + k * 0.35, can[1] - k * 0.14], [can[0] + k * (0.4 + i * 0.03), can[1] + k * (0.05 + i * 0.05)]], k * 0.018, 0.1, 0.6, 0.2)).join('') }),
    s('path', { class: 'gb-figure-rim', d: stroke(curve([k * 0.12, -k * 0.74], [k * 0.2, -k * 0.5], [k * 0.08, -k * 0.12], 6), k * 0.03, 0.2, 0.4, 0.1) }))
}

/** One watering can walks the beds in turn (CPU) vs a thousand bamboo spouts drip on every bed at once (GPU). */
export function gardenersScene(ctx: SceneCtx) {
  const cid = nextId('t28g')
  const count = h('p', { class: 't28g-count' }, fill(G.rows, { n: 0 }))
  const btn = (many: boolean) => h('button', { class: 'btn', type: 'button', 'aria-pressed': 'false', 'aria-label': many ? G.manyAria : G.oneAria, onClick: () => run(many) }, many ? G.many : G.one)
  const bOne = btn(false), bMany = btn(true)
  const panel = h('div', { class: 'gf-panel t28g-panel' }, h('div', { class: 'gf-seg', role: 'group', 'aria-label': G.group }, bOne, bMany), count)
  const { root, svg } = frame(ctx, 't28g', [G.insight as Fact], panel, draw)
  ctx.prompt(G.prompt)

  let geo = { x0: 0, y0: 0, cw: 1, ch: 1, cols: 40, rows: 25, home: [0, 0] as Pt }
  let rowsDone: SVGRectElement | null = null, rowPart: SVGRectElement | null = null
  let wet: SVGGElement | null = null, man: SVGGElement | null = null
  let n = 0
  let mode: 'one' | 'many' | null = null
  let tween: ReturnType<typeof gsap.to> | null = null
  let shown = false

  function setN(k: number) {
    n = k
    const { x0, y0, cw, ch, cols, rows, home } = geo
    const r = Math.floor(k / cols), c = k % cols
    rowsDone?.setAttribute('height', f1(r * ch))
    rowPart?.setAttribute('y', f1(y0 + r * ch))
    rowPart?.setAttribute('width', f1(c * cw))
    // the gardener walks the bed he is watering; otherwise he waits on his stone path
    const at: Pt = mode === 'one' && k < N ? [x0 + (Math.min(c, cols - 1) + 0.2) * cw, y0 + (Math.min(r, rows - 1) + 0.9) * ch] : home
    man?.setAttribute('transform', `translate(${f1(at[0])} ${f1(at[1])})`)
    count.textContent = k >= N ? G.done : fill(G.rows, { n: sep(k) })
  }

  function run(many: boolean) {
    tween?.kill()
    mode = many ? 'many' : 'one'
    bOne.setAttribute('aria-pressed', String(!many))
    bMany.setAttribute('aria-pressed', String(many))
    if (!count.hasAttribute('aria-live')) count.setAttribute('aria-live', 'polite')
    root.classList.toggle('one', !many)
    root.classList.toggle('pour', false)
    const done = () => {
      setN(N)
      root.classList.remove('pour')
      ctx.chime(many ? 'ok' : 'soft')
      if (many && !shown) {
        shown = true
        ctx.insight(G.insight as Fact, G.detail)
      }
    }
    if (many) {
      setN(N)
      count.textContent = fill(G.rows, { n: 0 })
      void root.offsetWidth // restart the drip animation
      root.classList.add('pour')
      if (wet) wet.style.opacity = '0'
      const o = { v: 0 }
      ctx.anim(() => {
        tween = gsap.to(o, {
          v: 1, duration: ctx.reduced ? 0.01 : 1.1, ease: 'power1.in',
          onUpdate: () => { if (wet) wet.style.opacity = f1(o.v); count.textContent = fill(G.rows, { n: sep(Math.round(o.v * N)) }) },
          onComplete: done,
        })
      })
    } else {
      if (wet) wet.style.opacity = '1'
      setN(0)
      const o = { v: 0 }
      ctx.anim(() => {
        // the one can is slow on purpose: about 9 s for the whole garden
        tween = gsap.to(o, { v: N, duration: 9, ease: 'none', onUpdate: () => setN(Math.floor(o.v)), onComplete: done })
      })
    }
  }

  function draw(w: number, hh: number, wide: boolean) {
    const r = rng(2810)
    const m = Math.min(w, hh) * 0.05
    const x0 = w * (wide ? 0.22 : 0.17), x1 = w - m
    const top = hh * (wide ? 0.3 : 0.27), bot = hh * 0.82
    const bw = x1 - x0, bh = bot - top
    // a grid of 1000 beds whose cells are as square as the stage allows
    let best = [40, 25]
    for (const cols of [50, 40, 25, 20]) {
      const rows = N / cols
      if (Math.abs(Math.log(bw / cols / (bh / rows))) < Math.abs(Math.log(bw / best[0] / (bh / best[1])))) best = [cols, rows]
    }
    const [cols, rows] = best
    const cw = bw / cols, ch = bh / rows
    const k = Math.min(cw, ch)
    const fk = Math.max(34, Math.min(hh * 0.15, ch * 3.8)) // the gardener's height
    const home: Pt = [x0 - fk * 0.55, top + bh * 0.42]
    geo = { x0, y0: top, cw, ch, cols, rows, home }
    // the beds: a furrow per row, a dry stalk per bed; the wet layer (clipped row by row) holds dark soil, leaves, glints
    let furrow = '', dry = '', wetSoil = '', leaves = '', glint = ''
    for (let i = 0; i < rows; i++) {
      const y = top + (i + 0.72) * ch
      const fy = (t: number) => y + Math.sin(t * 7 + i * 0.7) * ch * 0.06 + (r() - 0.5) * ch * 0.05
      furrow += stroke([0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => [x0 - cw * 0.4 + r() * cw * 0.5 + (bw + cw * 0.3) * t, fy(t)] as Pt), ch * (0.42 + r() * 0.12), 0.03, 0.05, 0.35)
      wetSoil += stroke([[x0, y], [x0 + bw / 2, y + (r() - 0.5)], [x1, y]], ch * 0.5, 0.02, 0.02, 0.7)
      for (let c = 0; c < cols; c++) {
        const x = x0 + (c + 0.5 + (i % 2 ? 0.25 : -0.15) + (r() - 0.5) * 0.25) * cw
        const lean = (r() - 0.5) * k * 0.2
        dry += `M${f1(x)} ${f1(y - ch * 0.08)}l${f1(lean)} ${f1(-k * (0.24 + r() * 0.18))}`
        leaves += `M${f1(x)} ${f1(y - ch * 0.08)}l${f1(lean * 0.6)} ${f1(-k * 0.5)}M${f1(x + lean * 0.3)} ${f1(y - ch * 0.08 - k * 0.22)}l${f1(-k * 0.2)} ${f1(-k * 0.12)}M${f1(x + lean * 0.4)} ${f1(y - ch * 0.08 - k * 0.3)}l${f1(k * 0.2)} ${f1(-k * 0.14)}`
        if (r() < 0.12) glint += `M${f1(x - k * 0.25)} ${f1(y + ch * 0.06)}h${f1(k * 0.5)}`
      }
    }
    // a thousand little bamboo spouts hang from the aqueduct, one per column, each with its own drip
    const pw = Math.max(4, Math.min(m * 0.42, 10))
    const pipeY = top - Math.max(14, ch * 1.1)
    let spouts = '', drips = ''
    for (let c = 0; c < cols; c++) {
      const x = x0 + (c + 0.5) * cw
      spouts += `M${f1(x)} ${f1(pipeY + pw * 0.3)}v${f1(Math.max(4, ch * 0.5))}`
      drips += `M${f1(x)} ${f1(pipeY + pw * 0.4 + Math.max(4, ch * 0.5) + 3)}v${f1(Math.max(3, k * 0.32))}`
    }
    const trestle = (x: number) => s('g', null,
      bamboo([x - pw * 2.4, pipeY + pw * 6], [x + pw * 1.2, pipeY - pw * 1.6], pw * 0.6, 2813 + Math.round(x), false),
      bamboo([x + pw * 2.4, pipeY + pw * 6], [x - pw * 1.2, pipeY - pw * 1.6], pw * 0.6, 2814 + Math.round(x), false))
    rowsDone = s('rect', { x: f1(x0 - cw), y: f1(top), width: f1(bw + cw * 2), height: 0 })
    rowPart = s('rect', { x: f1(x0), y: f1(top), width: 0, height: f1(ch) })
    wet = s('g', { class: 't28g-wet', 'clip-path': `url(#${cid})` },
      s('path', { class: 't28g-wetsoil', d: wetSoil }),
      s('path', { class: 't28g-leaf', d: leaves, 'stroke-width': f1(Math.max(1, k * 0.13)) }),
      s('path', { class: 't28g-glint', d: glint, 'stroke-width': f1(Math.max(0.8, k * 0.08)) }))
    man = gardener(fk)
    const pondY = bot + (hh - bot) * 0.3
    const moonX = w * 0.84
    // the pond below the beds: an organic body, ripples and the moon road clipped to it
    const pond = `M${f1(w * 0.03)} ${f1(pondY + (hh - pondY) * 0.5)}Q${f1(w * 0.2)} ${f1(pondY - 2)} ${f1(w * 0.55)} ${f1(pondY + 1)}Q${f1(w * 0.85)} ${f1(pondY + 3)} ${f1(w * 0.98)} ${f1(pondY + (hh - pondY) * 0.35)}Q${f1(w * 0.9)} ${f1(hh * 0.995)} ${f1(w * 0.5)} ${f1(hh * 0.99)}Q${f1(w * 0.12)} ${f1(hh * 0.995)} ${f1(w * 0.03)} ${f1(pondY + (hh - pondY) * 0.5)}Z`
    svg.replaceChildren(
      s('defs', null, s('clipPath', { id: cid }, rowsDone, rowPart), s('clipPath', { id: `${cid}-p` }, s('path', { d: pond }))),
      ...nightSky(w, pipeY - pw * 2, 2815, [moonX, hh * 0.1, Math.max(11, Math.min(w, hh) * 0.045)], hh * 0.17, false),
      pine(Math.max(fk * 0.3, x0 * 0.26), top + bh * 0.3, Math.min(hh * 0.3, x0 * 1.3), 2821, 1),
      mist(x0 * 0.4, top + bh * 0.32, x0 * 0.9, bh * 0.08),
      // the garden floor and the beds
      wash(`M${f1(x0 - cw)} ${f1(top - ch * 0.2)}H${f1(x1 + cw * 0.6)}V${f1(bot + ch * 0.3)}H${f1(x0 - cw)}Z`, 0.07),
      s('path', { class: 't28g-furrow', d: furrow, filter: 'url(#ink-dry)' }),
      s('path', { class: 't28g-dry', d: dry, 'stroke-width': f1(Math.max(0.8, k * 0.1)) }),
      // cloud shadows drifting over the beds, so the field reads as ground, not a grid
      wash(blob(x0 + bw * 0.3, top + bh * 0.35, bw * 0.28, bh * 0.22, 2824, 0.25), 0.045),
      wash(blob(x0 + bw * 0.78, top + bh * 0.7, bw * 0.24, bh * 0.2, 2825, 0.25), 0.04),
      wet,
      // the aqueduct: a spring-fed bamboo main across the top, crossed trestles, the comb of spouts
      trestle(x0 + bw * 0.12), trestle(x0 + bw * 0.5), trestle(x0 + bw * 0.88),
      s('path', { class: 't28g-spout', d: spouts, 'stroke-width': f1(Math.max(1.4, Math.min(cw * 0.22, 3))) }),
      bamboo([x0 - pw, pipeY + 1], [w + pw * 2, pipeY - 2], pw, 2817, false),
      s('g', { class: 't28g-drips' }, s('path', { d: drips, 'stroke-width': f1(Math.max(1.2, k * 0.12)) })),
      // the water below the beds, holding the moon, and its rings when every spout drips at once
      s('path', { class: 't28g-pond', d: pond, filter: 'url(#ink-wash)' }),
      s('g', { 'clip-path': `url(#${cid}-p)` }, water(w * 0.02, pondY, w * 0.98, hh * 0.99, 2818, moonX, false)),
      reeds(w * 0.05, pondY + (hh - pondY) * 0.55, Math.max(16, (hh - pondY) * 0.9), 2822, 6),
      reeds(w * 0.96, pondY + (hh - pondY) * 0.4, Math.max(14, (hh - pondY) * 0.7), 2823, 5),
      s('g', { class: 't28g-rings' }, ...[0.3, 0.55, 0.8].map((t, i) => s('ellipse', { cx: f1(w * t), cy: f1((pondY + hh) / 2), rx: f1(w * 0.05), ry: f1((hh - pondY) * 0.18), style: `animation-delay:${i * 0.18}s` }))),
      // the old gardener's stone path along the left
      steppingStones([x0 - fk * 0.6, top + bh * 0.1], [x0 - fk * 0.4, bot + (hh - bot) * 0.15], 6, Math.max(14, fk * 0.42), 2819),
      grass(x0 - fk * 0.95, bot - bh * 0.05, Math.max(12, fk * 0.4), 2820),
      man)
    setN(n)
    if (mode === 'many' && wet) wet.style.opacity = '1'
  }
}
