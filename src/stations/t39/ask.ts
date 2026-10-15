import { fill, h, s } from '../../core/dom'
import { load, save } from '../../core/store'
import { blob } from '../../ui/part2/ink'
import type { SceneCtx } from '../types'
import { C, lantern, moon, shell } from './shell'
import type { Answers } from './types'

const K = C.scenes.ask
export const KEY = 't39-answers'
/** answers live only in this browser (localStorage), never sent anywhere */
export const loadAnswers = () => load<Answers>(KEY, {})

/** Scene 1 — four stepping stones across the pond, one question each; every answer lights the far lantern a little more. */
export function askScene(ctx: SceneCtx) {
  const { root, svg, panel } = shell(ctx, 't39a', K.art, [K.insight], '0 60 400 220')
  const Q = K.questions
  const pond = s('path', { class: 't39a-pond', d: blob(200, 206, 196, 56, 39, 0.05) })
  const stones = Q.map((_, i) => {
    const x = 70 + i * 82, y = 214 - (i % 2) * 14
    return s('g', { class: 't39a-stone' },
      s('ellipse', { class: 'ring', cx: x, cy: y + 2, rx: 34, ry: 9 }),
      s('path', { class: 'rock', d: blob(x, y, 22, 7, i + 5, 0.1) }))
  })
  const light = lantern(372, 160, 0.9)
  svg.append(moon(60, 92, 11), s('path', { class: 't39a-bank', d: blob(362, 166, 58, 9, 3, 0.1) }), pond,
    s('ellipse', { class: 't39a-refl', cx: 96, cy: 196, rx: 14, ry: 3 }), ...stones, light)

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
    light.style.setProperty('--lit', String(n / Q.length))
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
