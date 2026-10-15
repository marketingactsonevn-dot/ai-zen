import { fill, h, nextId, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { blob, stroke } from '../../ui/part2/ink'
import { C } from './data'
import { f1, frame } from './frame'

const G = C.scenes.gardeners
const N = 1000
const sep = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, G.sep)

/** One watering can walks the beds in turn (CPU) vs a thousand bamboo spouts drip on every bed at once (GPU). */
export function gardenersScene(ctx: SceneCtx) {
  const cid = nextId('t28g')
  const count = h('p', { class: 't28g-count' }, fill(G.rows, { n: 0 }))
  const btn = (many: boolean) => h('button', { class: 'btn', type: 'button', 'aria-pressed': 'false', 'aria-label': many ? G.manyAria : G.oneAria, onClick: () => run(many) }, many ? G.many : G.one)
  const bOne = btn(false), bMany = btn(true)
  const panel = h('div', { class: 'gf-panel t28g-panel' }, h('div', { class: 'gf-seg', role: 'group', 'aria-label': G.group }, bOne, bMany), count)
  const { root } = frame(ctx, 't28g', [G.insight as Fact], panel, draw)
  ctx.prompt(G.prompt)

  let geo = { x0: 0, y0: 0, cw: 1, ch: 1, cols: 40, rows: 25 }
  let rowsDone: SVGRectElement | null = null, rowPart: SVGRectElement | null = null
  let wet: SVGGElement | null = null, can: SVGGElement | null = null
  let n = 0
  let mode: 'one' | 'many' | null = null
  let tween: ReturnType<typeof gsap.to> | null = null
  let shown = false

  function setN(k: number) {
    n = k
    const { x0, y0, cw, ch, cols } = geo
    const r = Math.floor(k / cols), c = k % cols
    rowsDone?.setAttribute('height', f1(r * ch))
    rowPart?.setAttribute('y', f1(y0 + r * ch))
    rowPart?.setAttribute('width', f1(c * cw))
    if (can) can.setAttribute('transform', `translate(${f1(x0 + (Math.min(c, cols - 1) + 0.5) * cw)} ${f1(y0 + (Math.min(r, geo.rows - 1) + 0.5) * ch)})`)
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
    const svg = root.querySelector('svg')!
    const m = Math.min(w, hh) * 0.06
    const x0 = m, x1 = w - m
    const top = hh * (wide ? 0.3 : 0.26), bot = hh - m * 1.2
    const bw = x1 - x0, bh = bot - top
    // a grid of 1000 beds whose cells are as square as the stage allows
    let best = [40, 25]
    for (const cols of [50, 40, 25, 20]) {
      const rows = N / cols
      if (Math.abs(Math.log(bw / cols / (bh / rows))) < Math.abs(Math.log(bw / best[0] / (bh / best[1])))) best = [cols, rows]
    }
    const [cols, rows] = best
    const cw = bw / cols, ch = bh / rows
    geo = { x0, y0: top, cw, ch, cols, rows }
    let dry = '', soil = '', drips = ''
    const k = Math.min(cw, ch)
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = x0 + (c + 0.5) * cw, y = top + (r + 0.62) * ch
      dry += `M${f1(x)} ${f1(y)}v${f1(-k * 0.42)}`
      soil += `M${f1(x - k * 0.36)} ${f1(y)}a${f1(k * 0.36)} ${f1(k * 0.14)} 0 1 0 ${f1(k * 0.72)} 0a${f1(k * 0.36)} ${f1(k * 0.14)} 0 1 0 ${f1(-k * 0.72)} 0`
    }
    for (let c = 0; c < cols; c++) drips += `M${f1(x0 + (c + 0.5) * cw)} ${f1(top - m * 0.9)}v${f1(Math.max(3, k * 0.3))}`
    const pipeY = top - m * 1.1
    const mr = Math.min(w, hh) * 0.065
    const mx = w - m - mr * 1.6, my = Math.max(mr * 1.4, top * 0.38)
    rowsDone = s('rect', { x: f1(x0), y: f1(top), width: f1(bw), height: 0 })
    rowPart = s('rect', { x: f1(x0), y: f1(top), width: 0, height: f1(ch) })
    wet = s('g', { class: 't28g-wet', 'clip-path': `url(#${cid})` },
      s('path', { class: 't28g-soil', d: soil }),
      s('path', { class: 't28g-sprout', d: dry, 'stroke-width': f1(Math.max(1.2, k * 0.16)) }))
    const cr = Math.max(5, k * 0.5)
    can = s('g', { class: 't28g-can' },
      s('circle', { r: f1(cr * 2.4), fill: 'url(#p2-halo)' }),
      s('path', { class: 'gf-ink', d: blob(0, -cr * 0.9, cr, cr * 0.75, 7, 0.08) }),
      s('path', { class: 'gf-ink', d: stroke([[cr * 0.6, -cr], [cr * 1.9, -cr * 1.9]], cr * 0.35) }),
      s('circle', { class: 'gf-lantern', cx: 0, cy: f1(-cr * 2.2), r: f1(cr * 0.4) }))
    svg.replaceChildren(
      s('defs', null, s('clipPath', { id: cid }, rowsDone, rowPart)),
      s('ellipse', { cx: f1(mx), cy: f1(my), rx: f1(mr * 3), ry: f1(mr * 3), fill: 'url(#p2-halo)' }),
      s('circle', { class: 'gf-moon', cx: f1(mx), cy: f1(my), r: f1(mr) }),
      s('rect', { class: 't28g-bed', x: f1(x0 - m * 0.4), y: f1(top - m * 0.3), width: f1(bw + m * 0.8), height: f1(bh + m * 0.5), rx: f1(m * 0.6) }),
      s('path', { class: 't28g-dry', d: dry, 'stroke-width': f1(Math.max(1, k * 0.13)) }),
      wet,
      s('path', { class: 't28g-pipe', d: stroke([[x0 - m * 0.4, pipeY], [x1 + m * 0.4, pipeY + 1]], Math.max(4, m * 0.32), 0.03, 0.03, 0.6) }),
      s('path', { class: 't28g-node', d: Array.from({ length: 7 }, (_, i) => `M${f1(x0 + (bw * (i + 0.5)) / 7)} ${f1(pipeY - m * 0.2)}v${f1(m * 0.4)}`).join('') }),
      s('g', { class: 't28g-drips' }, s('path', { d: drips })),
      can)
    setN(n)
    if (mode === 'many' && wet) wet.style.opacity = '1'
  }
}
