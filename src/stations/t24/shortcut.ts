import { h, s } from '../../core/dom'
import { L } from '../../core/content'
import type { SceneCtx } from '../types'
import { findTakeaway, takeaway } from '../../ui/part2/takeaway'
import { C } from './data'
import { btn, drawIn, f1, put, rng, stage, stroke, type Pt } from '../t22/kit'

const K = C.scenes.shortcut

/** Scene 3 — a raked-gravel maze with a bronze bell at the gate: the long path rakes every lane; the shortcut slips through the fence. */
export function shortcutScene(ctx: SceneCtx) {
  let done = false
  const task = h('p', { class: 'g8-q g8-abs' }, K.task)
  const pathBtns = K.paths.map((p, i) => btn(p.label, p.aria, () => walk(i), 'g8-abs'))
  const bellLab = h('span', { class: 'g8c-bell g8-abs g8-fade', 'data-off': '' }, K.bell)
  const reveal = h('p', { class: 'g8c-reveal g8-abs g8-fade', 'data-off': '' }, K.reveal)
  const sheet = h('div', { class: 'g8-sheet', hidden: true })
  const back = s('g')
  const trail = s('g')
  const { root, svg } = stage(ctx, 'g8c', K.art, [K.insight], draw)
  svg.append(back, trail)
  root.append(task, ...pathBtns, bellLab, reveal, sheet)
  ctx.prompt(K.prompt)

  let routes: string[] = []

  function draw(W: number, H: number) {
    const wide = W > 760
    put(task, 12, 6, W - 24)
    const x0 = wide ? W * 0.2 : 16, x1 = wide ? W * 0.8 : W - 16
    const y0 = wide ? 70 : 92, y1 = H - (wide ? 76 : 150)
    const lanes = 4
    const lh = (y1 - y0) / lanes
    const r = rng(24)
    // raked gravel: lines along each lane
    const rake: string[] = []
    for (let k = 0; k < lanes; k++) for (let j = 1; j < 4; j++) {
      const y = y0 + k * lh + (j * lh) / 4
      rake.push(stroke([[x0 + 6, y], [(x0 + x1) / 2, y + (r() - 0.5) * 2], [x1 - 6, y]], 1.2, 0.05, 0.05, 0.6))
    }
    // bamboo fences between lanes, each with one opening at alternating ends
    const fences: string[] = []
    for (let k = 1; k < lanes; k++) {
      const y = y0 + k * lh
      const open = k % 2 ? x1 - lh * 0.9 : x0 + lh * 0.9
      const segs: [number, number][] = k % 2 ? [[x0, open - lh * 0.5]] : [[open + lh * 0.5, x1]]
      for (const [a, b] of segs) {
        fences.push(stroke([[a, y], [b, y]], 3.4, 0.02, 0.02, 0.8))
        for (let x = a; x <= b; x += 16) fences.push(stroke([[x, y - 6], [x, y + 6]], 2.2, 0.1, 0.1, 0.6))
      }
    }
    const start: Pt = [x0 + lh * 0.5, y1 - lh / 2]
    const bell: Pt = [x1 - lh * 0.5, y0 - 4]
    // the long way: back and forth through every lane
    const long: Pt[] = [start]
    for (let k = lanes - 1; k >= 0; k--) {
      const y = y0 + k * lh + lh / 2
      const goRight = (lanes - 1 - k) % 2 === 0
      long.push([goRight ? x1 - lh * 0.5 : x0 + lh * 0.5, y])
      if (k > 0) long.push([goRight ? x1 - lh * 0.5 : x0 + lh * 0.5, y - lh])
    }
    long.push(bell)
    const short: Pt[] = [start, [(start[0] + bell[0]) / 2 - lh * 0.3, (start[1] + bell[1]) / 2], bell]
    const P = (pts: Pt[]) => `M${pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')}`
    routes = [P(long), `M${f1(short[0][0])} ${f1(short[0][1])}Q${f1(short[1][0])} ${f1(short[1][1])} ${f1(short[2][0])} ${f1(short[2][1])}`]
    const bx = bell[0], by = bell[1]
    back.replaceChildren(
      s('rect', { class: 'g8c-bed', x: f1(x0), y: f1(y0), width: f1(x1 - x0), height: f1(y1 - y0), rx: 6 }),
      s('path', { class: 'g8c-rake', d: rake.join('') }),
      s('path', { class: 'k', 'fill-opacity': 0.75, d: fences.join(''), filter: 'url(#ink-rough)' }),
      s('path', { class: 'k', 'fill-opacity': 0.6, d: stroke([[x0, y0], [x1, y0]], 3, 0.02, 0.02, 0.8) + stroke([[x0, y1], [x1, y1]], 3, 0.02, 0.02, 0.8) }),
      // the gate and its bell
      s('path', { class: 'k', d: stroke([[bx - 26, by + 6], [bx - 26, by - 34]], 5) + stroke([[bx + 26, by + 6], [bx + 26, by - 34]], 5) + stroke([[bx - 34, by - 32], [bx, by - 38], [bx + 34, by - 32]], 5, 0.1, 0.1, 0.6) }),
      s('g', { class: 'g8c-bellg' },
        s('path', { class: 'g8c-bronze', d: `M${f1(bx - 9)} ${f1(by - 4)}Q${f1(bx - 9)} ${f1(by - 26)} ${f1(bx)} ${f1(by - 26)}Q${f1(bx + 9)} ${f1(by - 26)} ${f1(bx + 9)} ${f1(by - 4)}Z` }),
        s('circle', { class: 'k', cx: f1(bx), cy: f1(by - 1), r: 2.4 })),
      s('circle', { class: 'v', cx: f1(start[0]), cy: f1(start[1]), r: 5 }))
    back.querySelector<SVGGElement>('.g8c-bellg')!.style.transformOrigin = `${f1(bx)}px ${f1(by - 32)}px`
    put(bellLab, bx - 120, by + 10, 140)
    if (wide) {
      put(pathBtns[0], W * 0.5 - 300, H - 60, 290)
      put(pathBtns[1], W * 0.5 + 10, H - 60, 290)
      put(reveal, x0, y1 + 6, x1 - x0)
    } else {
      put(pathBtns[0], 12, H - 110, W - 24)
      put(pathBtns[1], 12, H - 58, W - 24)
      put(reveal, 12, y1 + 4, W - 24)
    }
  }

  function walk(i: number) {
    const honest = K.paths[i].honest
    pathBtns.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)))
    const p = s('path', { class: `g8c-trail${honest ? '' : ' cheat'}`, d: routes[i] })
    trail.replaceChildren(p)
    drawIn(ctx, p, honest ? 3200 : 1100)
    root.classList.toggle('raked', honest)
    root.classList.toggle('cheat', !honest)
    root.classList.remove('ring')
    const ms = ctx.reduced ? 0 : honest ? 3200 : 1100
    const t = setTimeout(() => {
      root.classList.add('ring')
      delete bellLab.dataset.off
      ctx.chime('ok')
      if (honest) {
        reveal.dataset.off = ''
        return
      }
      delete reveal.dataset.off
      if (done) return
      done = true
      ctx.insight(K.insight, K.detail)
      const card = findTakeaway(K.takeaway)
      if (!card) return
      const t2 = setTimeout(() => {
        sheet.replaceChildren(h('button', { class: 'g8-close', type: 'button', 'aria-label': L.close, onClick: () => (sheet.hidden = true) }, '×'), takeaway(card, null, ctx.onCleanup))
        sheet.hidden = false
      }, ctx.reduced ? 0 : 1800)
      ctx.onCleanup(() => clearTimeout(t2))
    }, ms)
    ctx.onCleanup(() => clearTimeout(t))
  }
}
