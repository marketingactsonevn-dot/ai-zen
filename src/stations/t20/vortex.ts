import raw from '../../content/tram-20.json'
import { h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { clamp, onSize, rng, stableHeight, stroke, type Pt } from '../../ui/part2/ink'

const V = raw.scenes.vortex
const TURN = Math.PI * 2
const FULL = TURN * 3 // three stirs round the pond = the flow "blows up"

/** Scene 2 · Navier–Stokes: stir a still moonlit pond; the eddies tighten into one blinding point. */
export function vortexScene(ctx: SceneCtx) {
  const stableH = stableHeight(ctx, [V.insight as Fact])
  const r = rng(2020)
  const flies = Array.from({ length: 34 }, (_, i) => {
    const a = (i / 34) * TURN + r() * 0.15
    const d = 160 + r() * 26
    return s('circle', { class: 't20v-fly', cx: 200 + Math.cos(a) * d, cy: 200 + Math.sin(a) * d * 0.92, r: 1.4 + r() * 1.2, style: `animation-delay:${(-r() * 4).toFixed(2)}s` })
  })
  const arms = s('path', { class: 't20v-arm' })
  const swirl = s('g', { class: 't20v-swirl' }, arms)
  const core = s('circle', { class: 't20v-core', cx: 200, cy: 200, r: 2 })
  const burst = s('path', { class: 't20v-burst', d: Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * TURN; return `M${200 + Math.cos(a) * 10} ${200 + Math.sin(a) * 10}L${200 + Math.cos(a) * (22 + (i % 2) * 10)} ${200 + Math.sin(a) * (22 + (i % 2) * 10)}` }).join('') })
  const art = s('svg', { class: 't20v-svg', viewBox: '0 0 400 400', 'aria-hidden': 'true' },
    s('ellipse', { class: 't20v-bank', cx: 200, cy: 204, rx: 168, ry: 156 }),
    s('ellipse', { class: 't20v-pond', cx: 200, cy: 200, rx: 150, ry: 140 }),
    s('ellipse', { class: 't20v-ring', cx: 200, cy: 200, rx: 118, ry: 110 }),
    s('ellipse', { class: 't20v-ring', cx: 200, cy: 200, rx: 78, ry: 72 }),
    s('circle', { cx: 252, cy: 148, r: 46, fill: 'url(#p2-halo)' }),
    s('circle', { class: 't20v-moon', cx: 252, cy: 148, r: 16 }),
    swirl, burst, core, ...flies)
  const pond = h('div', {
    class: 't20v-stage', role: 'slider', tabindex: '0', 'aria-label': V.stirAria,
    'aria-valuemin': '0', 'aria-valuemax': String(V.stages.length - 1), 'aria-valuenow': '0', 'aria-valuetext': V.stages[0],
  }, art)
  const dots = V.stages.map(() => h('i'))
  const stageName = h('p', { class: 't20v-stage-name' }, V.stages[0])
  const flyNote = h('p', { class: 't20v-cap t20v-flies' }, V.fireflies)
  const leanNote = h('p', { class: 't20v-cap t20v-lean' }, V.leanNote)
  const context = h('div', { class: 't20v-context' },
    h('p', { class: 'p2-eyebrow' }, V.contextTitle),
    h('ul', null, ...V.context.map((c) => ctx.fact(c as Fact, 'li'))))
  const side = h('div', { class: 't20v-side' },
    h('div', { class: 't20v-meter', 'aria-hidden': 'true' }, h('span', { class: 't20v-dots' }, ...dots), stageName),
    flyNote, leanNote, context)
  const root = h('div', { class: 't20 t20v' }, pond, side)
  if (ctx.reduced || ctx.quality === 'low') root.classList.add('still')
  ctx.art.append(root)
  ctx.prompt(V.prompt)
  ctx.onCleanup(onSize(ctx.art, () => {
    root.style.height = `${stableH(ctx.art.clientHeight)}px`
  }))

  let acc = 0 // how much the visitor has stirred (radians, any direction)
  let rot = 0
  let drawn = -1
  let stage = 0
  draw(0)

  function draw(k: number) {
    if (Math.abs(k - drawn) < 0.015 && k < 1) return
    drawn = k
    let d = ''
    for (let a = 0; a < 3; a++) {
      const pts: Pt[] = []
      const turns = 0.5 + 2.3 * k
      for (let i = 0; i <= 140; i++) {
        const t = i / 140
        const th = (a * TURN) / 3 + t * turns * TURN
        const rad = 132 * (1 - t * (0.3 + 0.68 * k))
        pts.push([200 + Math.cos(th) * rad, 200 + Math.sin(th) * rad * 0.93])
      }
      d += stroke(pts, 1.6 + 1.8 * k, 0.12, 0.5, 0.15)
    }
    arms.setAttribute('d', d)
    core.setAttribute('r', (2 + 9 * k ** 3).toFixed(1))
  }

  function stir(delta: number) {
    acc += Math.abs(delta)
    rot = (rot + (delta * 180) / Math.PI * 0.6) % 360
    swirl.setAttribute('transform', `rotate(${rot.toFixed(1)} 200 200)`)
    const k = clamp(acc / FULL, 0, 1)
    draw(k)
    const next = k >= 1 ? 2 : k >= 0.3 ? 1 : 0
    if (next === stage) return
    stage = next
    pond.setAttribute('aria-valuenow', String(stage))
    pond.setAttribute('aria-valuetext', V.stages[stage])
    stageName.textContent = V.stages[stage]
    dots.forEach((x, i) => x.classList.toggle('on', i <= stage))
    root.dataset.stage = String(stage)
    ctx.chime(stage === 2 ? 'ok' : 'tap')
    if (stage === 2) ctx.insight(V.insight as Fact, V.detail as Fact)
  }

  let c: { x: number; y: number } | null = null
  let last = 0
  pond.addEventListener('pointerdown', (e) => {
    const b = pond.getBoundingClientRect()
    c = { x: b.left + b.width / 2, y: b.top + b.height / 2 }
    last = Math.atan2(e.clientY - c.y, e.clientX - c.x)
    pond.setPointerCapture(e.pointerId)
  })
  pond.addEventListener('pointermove', (e) => {
    if (!c) return
    const a = Math.atan2(e.clientY - c.y, e.clientX - c.x)
    let d = a - last
    if (d > Math.PI) d -= TURN
    if (d < -Math.PI) d += TURN
    last = a
    stir(d)
  })
  const end = () => (c = null)
  pond.addEventListener('pointerup', end)
  pond.addEventListener('pointercancel', end)
  pond.addEventListener('keydown', (e) => {
    const k = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key]
    if (!k) return
    e.preventDefault()
    stir((k * Math.PI) / 4)
  })
  dots[0].classList.add('on')
}
