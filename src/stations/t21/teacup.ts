import raw from '../../content/tram-21.json'
import { h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { blob, curve, onSize, p2Defs, rng, stableHeight, stroke } from '../../ui/part2/ink'
import { hills, mist, moon, toro, wash } from '../../ui/part2/paint'

const T = raw.scenes.teacup

/** A mountain of books: rows of spines, narrower towards the top (two paths, not one node per book). */
function library(x0: number, x1: number, y0: number, rows: number, seed: number) {
  const r = rng(seed)
  let a = '', b = ''
  for (let k = 0; k < rows; k++) {
    const inset = (k / rows) ** 1.3 * (x1 - x0) * 0.48
    let x = x0 + inset + r() * 6
    const y = y0 - k * 11
    while (x < x1 - inset - 4) {
      // spines as thin upright strokes; now and then a lying book (a short horizontal stroke)
      const hh = 7 + r() * 3
      if (r() < 0.12) b += stroke([[x, y - 2], [x + 7, y - 2.4]], 2.2, 0.1, 0.1, 0.4), (x += 9)
      else a += stroke([[x, y], [x + (r() - 0.5) * 0.6, y - hh]], 1.4 + r() * 1.4, 0.1, 0.1, 0.5), (x += 2.6 + r() * 2.2)
    }
  }
  return [s('path', { class: 't21t-book', d: a }), s('path', { class: 't21t-book2', d: b })]
}

/** Scene 3 · a brain for hands and feet: give the trembling ink hand a command; then weigh text data against hand data. */
export function teacupScene(ctx: SceneCtx) {
  p2Defs()
  const stableH = stableHeight(ctx, [T.insight as Fact, T.insight2 as Fact])
  // the trembling robot hand: three jointed segments in ink, a washed casing, three fingers
  const hand = s('g', { class: 't21t-hand' },
    s('path', { class: 't21t-casing', d: stroke([[420, 92], [356, 110]], 15, 0.02, 0.1, 0.8) + stroke([[356, 110], [304, 132]], 11, 0.1, 0.1, 0.8), filter: 'url(#ink-wash)' }),
    s('path', { class: 't21-ink', d: stroke([[420, 92], [356, 110], [304, 132]], 5, 0.02, 0.15, 0.6) + stroke([[304, 132], [290, 140], [282, 152]], 3, 0.05, 0.4) + stroke([[304, 132], [296, 148], [292, 160]], 3, 0.05, 0.4) + stroke([[304, 132], [310, 150], [304, 162]], 3, 0.05, 0.4), filter: 'url(#ink-rough)' }),
    s('circle', { class: 't21t-joint', cx: 356, cy: 110, r: 5 }),
    s('circle', { class: 't21t-joint', cx: 304, cy: 132, r: 4 }))
  // a small bamboo basket of "hand data": woven strokes over a wash
  let weave = ''
  for (let i = 0; i < 4; i++) weave += stroke([[331 + i * 0.6, 218 + i * 3.4], [359 - i * 0.6, 218 + i * 3.4]], 1.2, 0.1, 0.1, 0.4)
  for (let i = 0; i < 6; i++) weave += stroke([[333 + i * 5, 214], [334 + i * 4.4, 230]], 1, 0.1, 0.1, 0.4)
  const basket = s('g', { class: 't21t-basket' },
    s('path', { class: 't21t-weave', d: 'M330 214h30l-4 16h-22z', filter: 'url(#ink-wash)' }),
    s('path', { class: 't21t-weave-ink', d: weave + stroke(curve([330, 214], [345, 200], [360, 214], 8), 1.6, 0.1, 0.1, 0.5), filter: 'url(#ink-rough)' }))
  // the library of text, tall as a mountain: an ink peak whose face is shelves of spines
  const slab = 'M116 204Q240 194 384 204L380 216Q240 208 120 216Z'
  const art = s('svg', { class: 't21t-svg', viewBox: '0 0 400 260', preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true' },
    mist(150, 120, 200, 110),
    moon(74, 40, 15, 2120, true),
    hills(-30, 430, 214, 70, 2122, 0.88, 5),
    hills(0, 232, 216, 156, 2123, 0.15, 1),
    ...library(18, 214, 212, 12, 2121),
    mist(115, 214, 140, 18),
    toro(386, 252, 62, true),
    wash(blob(250, 236, 150, 12, 2124, 0.1), 0.16),
    s('path', { class: 't21-ink', d: stroke([[140, 214], [142, 252]], 6, 0.05, 0.1) + stroke([[356, 214], [354, 252]], 6, 0.05, 0.1), filter: 'url(#ink-rough)' }),
    s('path', { class: 't21t-table', d: slab, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
    s('path', { class: 't21t-table-ink', d: stroke(curve([118, 210], [240, 202], [382, 210], 16), 2.2, 0.05, 0.05, 0.3), filter: 'url(#ink-rough)' }),
    s('g', { class: 't21t-cup' },
      s('path', { class: 't21t-porcelain', d: 'M222 180h32q-2 20 -16 22q-14 -2 -16 -22z' }),
      s('path', { class: 't21t-cup-band', d: stroke([[224, 188], [238, 190], [252, 188]], 2.4, 0.2, 0.2, 0.3) + stroke(curve([229, 194], [233, 191], [237, 195], 4), 1.2, 0.2, 0.2, 0.3) + stroke(curve([240, 195], [244, 191], [248, 194], 4), 1.2, 0.2, 0.2, 0.3) }),
      s('ellipse', { class: 't21t-tea', cx: 238, cy: 181, rx: 15, ry: 2.6 }),
      s('path', { class: 't21t-cup-ink', d: stroke([[223, 184], [228, 196], [238, 202], [249, 196], [253, 184]], 1.6, 0.1, 0.1), filter: 'url(#ink-rough)' })),
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
