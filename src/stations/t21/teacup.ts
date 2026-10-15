import raw from '../../content/tram-21.json'
import { h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { onSize, p2Defs, rng, stableHeight, stroke } from '../../ui/part2/ink'

const T = raw.scenes.teacup

/** A mountain of books: rows of spines, narrower towards the top. */
function library(x0: number, x1: number, y0: number, rows: number, seed: number) {
  const r = rng(seed)
  const out: SVGElement[] = []
  for (let k = 0; k < rows; k++) {
    const inset = (k / rows) ** 1.3 * (x1 - x0) * 0.48
    let x = x0 + inset + r() * 6
    const y = y0 - k * 11
    while (x < x1 - inset - 4) {
      const w = 3 + r() * 5
      out.push(s('rect', { class: r() < 0.3 ? 't21t-book2' : 't21t-book', x: x.toFixed(1), y: (y - 9 - r() * 2).toFixed(1), width: w.toFixed(1), height: 10, rx: 0.8 }))
      x += w + 0.8
    }
  }
  return out
}

/** Scene 3 · a brain for hands and feet: give the trembling ink hand a command; then weigh text data against hand data. */
export function teacupScene(ctx: SceneCtx) {
  p2Defs()
  const stableH = stableHeight(ctx, [T.insight as Fact, T.insight2 as Fact])
  const hand = s('g', { class: 't21t-hand' },
    s('path', { class: 't21-ink', d: stroke([[420, 92], [356, 110], [304, 132]], 9, 0.02, 0.15, 0.6) }),
    s('circle', { class: 't21t-joint', cx: 356, cy: 110, r: 5 }),
    s('circle', { class: 't21t-joint', cx: 304, cy: 132, r: 4 }),
    s('path', { class: 't21-ink', d: stroke([[304, 132], [290, 140], [282, 152]], 3, 0.05, 0.4) + stroke([[304, 132], [296, 148], [292, 160]], 3, 0.05, 0.4) + stroke([[304, 132], [310, 150], [304, 162]], 3, 0.05, 0.4) }))
  const basket = s('g', { class: 't21t-basket' },
    s('path', { class: 't21t-weave', d: 'M330 214h30l-4 16h-22z' }),
    s('path', { class: 't21t-weave-ink', d: 'M332 219h26M333 224h24M340 214v16M348 214v16' }))
  const art = s('svg', { class: 't21t-svg', viewBox: '0 0 400 260', preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true' },
    s('circle', { cx: 74, cy: 40, r: 50, fill: 'url(#p2-halo)' }),
    ...library(10, 220, 214, 12, 2121),
    s('circle', { class: 't21t-glow', cx: 372, cy: 46, r: 28 }),
    s('path', { class: 't21t-toro', d: 'M360 40h24l-5-7h-14zM364 42h16v12h-16zM369 54h6v22h-6zM361 76h22v4h-22z' }),
    s('rect', { class: 't21t-flame', x: 367, y: 44, width: 10, height: 7 }),
    s('path', { class: 't21t-table', d: 'M120 206Q240 196 380 206L376 216Q240 208 124 216Z' }),
    s('path', { class: 't21-ink', d: stroke([[140, 216], [142, 252]], 6, 0.05, 0.1) + stroke([[356, 216], [354, 252]], 6, 0.05, 0.1) }),
    s('g', { class: 't21t-cup' },
      s('path', { class: 't21t-porcelain', d: 'M222 180h32q-2 20 -16 22q-14 -2 -16 -22z' }),
      s('ellipse', { class: 't21t-tea', cx: 238, cy: 181, rx: 15, ry: 2.6 }),
      s('path', { class: 't21t-cup-ink', d: stroke([[223, 184], [228, 196], [238, 202], [249, 196], [253, 184]], 1.6, 0.1, 0.1) })),
    basket,
    hand)

  const head = h('p', { class: 't21t-head' }, T.head)
  const tries = h('p', { class: 't21t-try' }, T.hand)
  head.hidden = tries.hidden = true
  const status = h('div', { class: 't21t-status', 'aria-live': 'polite' }, head, tries)
  const given = new Set<number>()
  const cmds = T.commands.map((c, i) => h('button', { class: 't21t-cmd', type: 'button', 'aria-label': c.aria, onClick: () => command(i) }, c.label))
  const beam = s('g', { class: 't21t-beam' },
    s('path', { class: 't21-ink', d: stroke([[20, 40], [180, 40]], 3, 0.05, 0.05) }),
    s('path', { class: 't21t-cord', d: 'M30 40l-14 26M30 40l14 26M170 40l-14 26M170 40l14 26' }),
    s('path', { class: 't21t-pan', d: 'M10 66h40q-4 8 -20 8q-16 0 -20 -8z' }),
    s('path', { class: 't21t-pan', d: 'M150 66h40q-4 8 -20 8q-16 0 -20 -8z' }),
    ...library(12, 48, 64, 2, 77),
    s('path', { class: 't21t-weave', d: 'M164 58h12l-2 7h-8z' }))
  const scale = h('div', { class: 't21t-scale' },
    h('p', { class: 'p2-eyebrow' }, T.scaleTitle),
    h('div', { class: 't21t-scale-row' },
      s('svg', { class: 't21t-scale-svg', viewBox: '0 0 200 106', role: 'img', 'aria-label': T.scaleAria },
        s('path', { class: 't21-ink', d: stroke([[100, 96], [100, 44]], 4, 0.05, 0.05) + stroke([[80, 98], [120, 98]], 3, 0.1, 0.1) }),
        beam,
        s('text', { class: 't21t-lbl', x: 30, y: 104, 'text-anchor': 'middle' }, T.textLabel),
        s('text', { class: 't21t-lbl', x: 170, y: 104, 'text-anchor': 'middle' }, T.robotLabel)),
      h('ul', { class: 't21t-data' }, ...T.data.map((f) => ctx.fact(f as Fact, 'li')))))
  scale.setAttribute('aria-hidden', 'true')
  const root = h('div', { class: 't21 t21t' },
    h('div', { class: 't21t-stage' }, art),
    status,
    h('div', { class: 't21t-cmds', role: 'group', 'aria-label': T.prompt }, ...cmds),
    scale)
  if (ctx.reduced || ctx.quality === 'low') root.classList.add('still')
  ctx.art.append(root)
  ctx.prompt(T.prompt)
  ctx.onCleanup(onSize(ctx.art, () => {
    root.style.height = `${stableH(ctx.art.clientHeight)}px`
  }))

  let timer = 0
  ctx.onCleanup(() => clearTimeout(timer))
  function command(i: number) {
    head.hidden = false
    tries.hidden = true
    hand.classList.remove('try')
    void hand.getBoundingClientRect() // restart the reach on every command
    hand.classList.add('try')
    ctx.chime('tap')
    clearTimeout(timer)
    timer = window.setTimeout(() => (tries.hidden = false), ctx.reduced ? 0 : 1100)
    given.add(i)
    if (given.size === 1) ctx.insight(T.insight as Fact)
    else if (given.size === 2 && !root.classList.contains('weighed')) {
      root.classList.add('weighed')
      scale.removeAttribute('aria-hidden')
      ctx.insight(T.insight2 as Fact, T.detail)
    }
  }
}
