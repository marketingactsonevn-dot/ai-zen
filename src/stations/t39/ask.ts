import { fill, h, nextId, s } from '../../core/dom'
import { load, save } from '../../core/store'
import { blob, curve, stroke } from '../../ui/part2/ink'
import { grass, hills, mist, reeds, toro, water } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import { C, shell } from './shell'
import type { Answers } from './types'
import { crescent, dawnGlow, fog, mossBed, stonesOn } from '../t37/sumi'

const K = C.scenes.ask
export const KEY = 't39-answers'
/** answers live only in this browser (localStorage), never sent anywhere */
export const loadAnswers = () => load<Answers>(KEY, {})

/** The pond just after moonset: blue-grey first light, a thin moon left in the corner, a lantern on the far bank. */
function art(svg: SVGGElement, n: number) {
  const pid = nextId('t39p')
  const pond = blob(206, 214, 214, 50, 39, 0.05)
  const spots: [number, number, number][] = [[86, 246, 25], [158, 224, 21], [226, 203, 17.5], [288, 186, 14.5]]
  const stones = spots.slice(0, n).map(([x, y, sz], i) => s('g', { class: 't39a-stone' },
    s('g', { class: 't39a-rings' }, ...[1.5, 2.2].map((k) => s('ellipse', { cx: x, cy: y + 1, rx: (sz * k).toFixed(1), ry: (sz * k * 0.34).toFixed(1) }))),
    stonesOn([[x, y]], () => sz, 3900 + i),
    s('ellipse', { class: 't39a-glow', cx: x, cy: y - sz * 0.12, rx: (sz * 0.6).toFixed(1), ry: (sz * 0.16).toFixed(1) })))
  const lamp = s('g', { class: 't39a-lamp' }, toro(350, 164, 30, true))
  svg.append(
    dawnGlow(312, 150, 240, 96, 3),
    fog(200, 118, 260, 60),
    crescent(54, 86, 10, 0.6, 160),
    hills(-30, 430, 150, 48, 3901, 0.92, 7),
    hills(-20, 170, 154, 30, 3902, 0.66, 2),
    mist(200, 152, 270, 14),
    mossBed(340, 166, 66, 8, 3903),
    s('clipPath', { id: pid }, s('path', { d: pond })),
    s('path', { class: 'g13-water', d: pond, filter: 'url(#ink-wash)' }),
    s('g', { 'clip-path': `url(#${pid})` },
      fog(206, 170, 220, 12),
      s('ellipse', { cx: 318, cy: 176, rx: 90, ry: 16, fill: 'url(#g13-dawn)' }),
      water(-10, 166, 420, 266, 3904, 70, false)),
    s('path', { class: 'g13-rim', d: stroke(curve([-6, 230], [200, 284], [414, 226], 24), 2, 0.1, 0.1, 0.2), filter: 'url(#ink-rough)' }),
    reeds(22, 238, 34, 3905, 8),
    reeds(384, 196, 24, 3906, 5),
    lamp,
    ...stones,
    mossBed(40, 270, 60, 9, 3907),
    grass(118, 272, 16, 3908),
    grass(316, 268, 14, 3909))
  return { stones, lamp }
}

/** Scene 1 — four stepping stones across the pond, one question each; every answer lights the far lantern a little more. */
export function askScene(ctx: SceneCtx) {
  const { root, svg, panel } = shell(ctx, 't39a', K.art, [K.insight], '0 56 400 222')
  const Q = K.questions
  const { stones, lamp } = art(svg, Q.length)

  const ans: Answers = loadAnswers()
  const prog = h('p', { class: 'p2-eyebrow' })
  const q = h('h3', { class: 't39a-q' })
  const opts = h('div', { class: 't39a-opts', role: 'group' })
  const sum = h('ul', { class: 't39a-sum' })
  const change = h('button', { class: 'btn ghost', type: 'button', onClick: () => go(0, true) }, K.change)
  const done = h('div', { class: 't39a-done', hidden: true }, sum, change)
  panel.append(prog, q, opts, done, h('p', { class: 't39a-privacy' }, K.privacy))
  let told = false

  const first = () => Q.findIndex((x) => !ans[x.id])
  function paint() {
    const n = Q.filter((x) => ans[x.id]).length
    stones.forEach((g, i) => g.classList.toggle('on', !!ans[Q[i].id]))
    lamp.style.setProperty('--lit', String(n / Q.length))
    root.dataset.n = String(n)
  }
  function go(i: number, reset = false) {
    if (reset) Q.forEach((x) => delete ans[x.id])
    paint()
    if (i < 0) return finish()
    done.hidden = true
    q.hidden = opts.hidden = prog.hidden = false
    const it = Q[i]
    prog.textContent = fill(K.progress, { n: i + 1 })
    q.textContent = it.q
    opts.setAttribute('aria-label', it.q)
    opts.replaceChildren(...it.options.map((o) => h('button', {
      class: 't39a-opt', type: 'button', 'aria-label': fill(K.optionAria, { q: it.q, label: o.label }),
      onClick: () => {
        ans[it.id] = o.id
        save(KEY, ans)
        go(first())
      },
    }, o.label)))
    if (reset) (opts.firstElementChild as HTMLElement | null)?.focus()
  }
  function finish() {
    q.hidden = opts.hidden = prog.hidden = true
    done.hidden = false
    sum.replaceChildren(...Q.map((x) => h('li', null, h('span', null, x.q), ' ', h('b', null, x.options.find((o) => o.id === ans[x.id])?.label ?? ''))))
    if (!told) (ctx.insight(K.insight), (told = true))
  }
  go(first())
  if (first() >= 0) ctx.prompt(K.prompt)
}
