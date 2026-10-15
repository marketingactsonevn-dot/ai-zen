import { fill, h, s } from '../../core/dom'
import { stoneArt, stroke } from '../../ui/part2/ink'
import type { SceneCtx } from '../types'
import { C } from './content'
import { F, nightSky, toro } from '../t34/night'

const K = C.scenes.ladder
const X = (i: number) => 58 + i * 66
const Y = (i: number) => 284 - i * 50

/** Scene 1 — five mossy steps up to the workshop door; the same "weekly report" scroll is carried up, and at the top a bamboo shishi-odoshi tips on its own. */
export function ladderScene(ctx: SceneCtx) {
  const seen = new Set<number>()
  const lamps = K.rungs.map((_, i) => s('g', null, toro(X(i) + 40, Y(i) - 8, 0.75)))
  const tube = s('g', { class: 't35l-tube' },
    s('path', { d: stroke([[338, 74], [384, 52]], 7, 0.05, 0.05, 0.8), style: 'fill:var(--moss);opacity:.95' }),
    s('path', { d: 'M381 50 l6 -3 l2 7 l-6 3Z', style: 'fill:var(--moss-2)' }))
  const art = s('svg', { class: 't35l-svg', viewBox: '0 0 400 300', 'aria-hidden': 'true' },
    // bamboo spout and the post the tube rocks on
    s('path', { d: stroke([[400, 40], [370, 44]], 5, 0.05, 0.05, 0.9), style: 'fill:var(--moss-2)' }),
    s('path', { d: stroke([[360, 96], [360, 64]], 4, 0.05, 0.05, 0.9), style: 'fill:var(--ink);opacity:.6' }),
    tube,
    s('ellipse', { cx: 360, cy: 100, rx: 26, ry: 5, style: 'fill:var(--water);opacity:.6' }),
    ...K.rungs.flatMap((_, i) => {
      const g = stoneArt(96, 26, 35 + i * 5)
      g.setAttribute('transform', `translate(${X(i)} ${Y(i)})`)
      // moss along each step's top edge
      const moss = s('path', { d: stroke([[X(i) - 40, Y(i) - 22], [X(i) - 6, Y(i) - 26], [X(i) + 34, Y(i) - 21]], 4, 0.3, 0.3, 0.2), style: 'fill:var(--moss);opacity:.55' })
      return [lamps[i], g, moss]
    }))
  const btns = K.rungs.map((r, i) => {
    const b = h('button', { class: 't35l-rung', type: 'button', 'aria-label': fill(K.rungAria, { n: i + 1, name: r.name }), 'aria-pressed': 'false', style: `left:${(X(i) / 4).toFixed(2)}%;top:${((Y(i) - 13) / 3).toFixed(2)}%`, onClick: () => climb(i) }, r.name)
    return b
  })
  const roll = h('span', { class: 't35l-roll', 'aria-hidden': 'true' })
  const card = h('div', { class: 't35l-card', 'aria-live': 'polite' })
  const root = h('div', { class: 't35 t35l' },
    nightSky(800, 600, [120, 90, 30]),
    h('p', { class: 'visually-hidden' }, K.art),
    h('div', { class: 't35l-stairs' }, art, ...btns, roll),
    h('div', { class: 't35l-side' }, h('p', { class: 'p2-eyebrow' }, K.task), card, ctx.fact(F(K.scale), 'p', 't35l-scale')))
  ctx.art.append(root)
  ctx.prompt(K.prompt)
  place(-1)

  function place(i: number) {
    const x = i < 0 ? X(0) - 70 : X(i) - 26
    const y = i < 0 ? Y(0) - 30 : Y(i) - 40
    roll.style.left = `${(x / 4).toFixed(2)}%`
    roll.style.top = `${(y / 3).toFixed(2)}%`
  }
  function climb(i: number) {
    seen.add(i)
    btns.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)))
    lamps[i].classList.add('on')
    place(i)
    ctx.chime(i === 4 ? 'ok' : 'tap')
    const r = K.rungs[i]
    const fact = r.id === 'workflow' ? K.facts[0] : r.id === 'hook' ? K.facts[1] : null
    card.replaceChildren(
      h('h3', { class: 't35l-name' }, h('span', { class: 't35l-n' }, String(i + 1)), r.name),
      h('p', { class: 't35l-what' }, r.what),
      h('p', { class: 't35l-ex' }, r.example),
      fact ? ctx.fact(F(fact), 'p', 't35l-fact') : '')
    if (r.id === 'hook') {
      tube.classList.remove('tip')
      void art.getBoundingClientRect()
      tube.classList.add('tip')
    }
    if (seen.size === K.rungs.length) ctx.insight(F(K.insight), K.detail)
  }
}
