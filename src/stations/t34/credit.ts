import { fill, h, s } from '../../core/dom'
import { stroke } from '../../ui/part2/ink'
import type { SceneCtx } from '../types'
import { C } from './content'
import { cardButton, F } from './night'

const K = C.scenes.credit
// shortcut: illustrative weights only (K.scale says so on screen); not any platform's real price list
const W_MODEL = [1, 3], W_RES = [1, 2], W_LEN = [1, 2], BASE = 3
const BODY = 'M70 40 Q60 52 64 62 Q30 84 28 140 Q28 200 70 222 L130 222 Q172 200 172 140 Q170 84 136 62 Q140 52 130 40Z'
const TOP = 62, BOT = 222

/** Scene 3 — credit is water in a crackle-glazed jar: every "Tạo" ladles some out; heavier choices take a bigger ladle. */
export function creditScene(ctx: SceneCtx) {
  let level = 100
  let made = 0
  const pick = [0, 0, 0]
  const water = s('g', { class: 't34c-water' },
    s('rect', { x: 20, y: TOP, width: 160, height: BOT - TOP + 4, style: 'fill:var(--water);opacity:.75' }),
    s('ellipse', { cx: 100, cy: TOP, rx: 70, ry: 5, style: 'fill:var(--moon);opacity:.55' }))
  const clip = s('clipPath', { id: 't34c-clip' }, s('path', { d: BODY }))
  const crackle = [[[52, 100], [70, 120], [66, 150]], [[140, 90], [126, 118], [138, 140], [130, 170]], [[90, 180], [104, 200], [96, 214]], [[60, 170], [78, 186]]] as [number, number][][]
  const ticks = [0.25, 0.5, 0.75].map((f) => {
    const y = BOT - (BOT - TOP) * f
    return s('path', { d: stroke([[150, y], [164, y + 1]], 2.4, 0.2, 0.4), style: 'fill:var(--ink);opacity:.55' })
  })
  const ladle = s('g', { class: 't34c-ladle' },
    s('path', { d: stroke([[150, 6], [118, 30], [102, 48]], 4, 0.1, 0.2, 0.5), style: 'fill:var(--ink);opacity:.8' }),
    s('path', { d: 'M88 46 Q100 64 114 46Z', style: 'fill:var(--ink);opacity:.85' }))
  const jar = s('svg', { class: 't34c-jar', viewBox: '0 0 200 240', role: 'img', 'aria-label': fill(K.jarAria, { n: level }) },
    s('defs', null, clip),
    // moonlight poured through the window into the mouth
    s('path', { d: 'M200 0 L120 0 L84 44 L118 44Z', style: 'fill:var(--moon);opacity:.16' }),
    s('ellipse', { cx: 104, cy: 228, rx: 84, ry: 9, style: 'fill:var(--umbra);opacity:.28' }),
    s('path', { d: BODY, fill: 'url(#p2-rock)' }),
    s('g', { 'clip-path': 'url(#t34c-clip)' }, water),
    s('path', { d: BODY, fill: 'url(#p2-shade)' }),
    ...crackle.map((p) => s('path', { d: stroke(p, 1.1, 0.2, 0.3, 0.3), style: 'fill:var(--ink);opacity:.28' })),
    ...ticks,
    s('path', { d: BODY, style: 'fill:none;stroke:var(--ink);stroke-opacity:.7;stroke-width:2.2', filter: 'url(#ink-rough)' }),
    s('path', { d: stroke([[46, 96], [40, 130], [46, 168]], 3, 0.3, 0.4), style: 'fill:var(--moon);opacity:.5' }),
    ladle)

  const seg = (label: string, opts: string[], k: number) => {
    const btns = opts.map((o, i) => h('button', { class: 't34c-opt', type: 'button', 'aria-pressed': String(i === 0), onClick: () => {
      pick[k] = i
      btns.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)))
    } }, o))
    return h('div', { class: 't34c-seg', role: 'group', 'aria-label': label }, h('span', { class: 't34c-lab' }, label), ...btns)
  }
  const cost = h('p', { class: 't34c-cost', 'aria-live': 'polite' })
  const facts = h('div', { class: 't34c-facts' })
  const tips = h('div', { class: 't34c-tips', hidden: true }, h('p', { class: 't34c-lab' }, K.tipsLabel), h('ul', null, ...K.tips.map((t) => h('li', null, t))))
  const go = h('button', { class: 't34c-go', type: 'button', onClick: generate }, K.generate)
  const refill = h('button', { class: 't34c-refill', type: 'button', hidden: true, onClick: fillUp }, K.refill)
  const panel = h('div', { class: 't34c-panel' },
    seg(K.modelLabel, K.models, 0), seg(K.resLabel, K.resolutions, 1), seg(K.lengthLabel, K.lengths, 2),
    h('div', { class: 't34c-acts' }, go, refill), cost, facts, tips)
  const root = h('div', { class: 't34 t34c' }, h('p', { class: 'visually-hidden' }, K.art),
    h('div', { class: 't34c-stage' }, jar, ctx.fact(F(K.scale), 'p', 't34c-scale')), panel)
  ctx.art.append(root)
  ctx.prompt(K.prompt)
  const pill = cardButton(ctx, root, K.takeaway)
  if (pill) { pill.hidden = true; panel.append(pill) }
  draw()

  function draw() {
    water.style.transform = `translateY(${((100 - level) / 100) * (BOT - TOP)}px)`
    jar.setAttribute('aria-label', fill(K.jarAria, { n: level }))
  }
  function generate() {
    const n = BASE * W_MODEL[pick[0]] * W_RES[pick[1]] * W_LEN[pick[2]]
    if (n > level) {
      cost.textContent = K.empty
      refill.hidden = false
      return
    }
    level -= n
    made++
    ladle.classList.remove('dip')
    void (ladle as unknown as HTMLElement).getBoundingClientRect()
    ladle.classList.add('dip')
    ctx.chime('tap')
    draw()
    cost.textContent = fill(K.cost, { n }) + (level === 0 ? ' ' + K.empty : '')
    refill.hidden = level === 100
    if (made === 1) {
      facts.replaceChildren(ctx.fact(F(K.facts[0]), 'p'))
      tips.hidden = false
      if (pill) pill.hidden = false
      ctx.insight(F(K.insight), K.detail)
    }
  }
  function fillUp() {
    level = 100
    draw()
    cost.textContent = ''
    refill.hidden = true
    facts.replaceChildren(ctx.fact(F(K.facts[1]), 'p'))
    go.focus()
  }
}
