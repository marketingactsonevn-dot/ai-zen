import { fill, h, nextId, s } from '../../core/dom'
import { onDigit, rng, seedOf, shuffledIdx } from '../../ui/part2/ink'
import type { SceneCtx } from '../types'
import { C, moon, shell } from './shell'

const K = C.scenes.trays

/** Scene 4 — sort the engraved pebbles into three stone trays (dry, half-flooded, misted), then compare. */
export function traysScene(ctx: SceneCtx) {
  const { root, svg, panel } = shell(ctx, 't38t', K.art, [K.insight], '0 0 400 200')
  // the veranda at moonset: planks, the moon low in the corner
  const planks = s('g', { class: 't38t-planks' })
  for (let i = 0; i < 7; i++) planks.append(s('path', { d: `M-20 ${120 + i * 14}L420 ${110 + i * 15}` }))
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice')
  svg.append(moon(360, 34, 12), planks)

  const keysId = nextId('t38k')
  const r = rng(seedOf(K.tasks.map((t) => t.id).join()))
  const order = shuffledIdx(K.tasks.length, 381)
  const placed: Record<string, string> = {}
  let sel = ''
  let compared = false
  const rr = () => 38 + Math.round(r() * 24)
  const pebs = new Map(K.tasks.map((t) => [t.id, h('button', {
    class: 't38t-peb', type: 'button', 'aria-pressed': 'false', 'aria-describedby': keysId,
    style: `border-radius:${rr()}% ${rr()}% ${rr()}% ${rr()}% / ${rr()}% ${rr()}% ${rr()}% ${rr()}%`,
    onClick: () => choose(t.id),
  }, h('span', { class: 't38t-peb-label' }, t.label), h('span', { class: 't38t-peb-exp' }))]))
  const basket = h('div', { class: 't38t-basket' }, ...order.map((i) => pebs.get(K.tasks[i].id)!))
  const lists = K.trays.map(() => h('div', { class: 't38t-list' }))
  const trayBtns = K.trays.map((t, i) => h('button', { class: 't38t-drop', type: 'button', onClick: () => put(i) }, h('span', { class: 't38t-key', 'aria-hidden': 'true' }, String(i + 1)), t.name))
  const trays = K.trays.map((t, i) => h('div', { class: 't38t-tray', 'data-id': t.id }, trayBtns[i], lists[i]))
  const match = h('p', { class: 't38t-match' })
  const why = h('p', { class: 't38t-why' })
  const after = h('div', { class: 't38t-after', hidden: true }, match, why, ctx.fact(K.expertNote, 'p', 't38t-note'), ctx.fact(K.jobs, 'p', 't38t-note'))
  const compareBtn = h('button', { class: 'btn primary t38t-compare', type: 'button', hidden: true, onClick: compare }, K.compare)
  panel.append(h('p', { class: 'visually-hidden', id: keysId }, K.keys), basket, h('div', { class: 't38t-trays' }, ...trays), compareBtn, after)
  ctx.onCleanup(onDigit((n) => n <= K.trays.length && sel && put(n - 1)))
  label()

  function label() {
    const task = K.tasks.find((t) => t.id === sel)
    trayBtns.forEach((b, i) => b.setAttribute('aria-label', task ? fill(K.pickAria, { task: task.label, tray: K.trays[i].name }) : K.trays[i].name))
    root.dataset.picking = String(!!task)
  }
  function choose(id: string) {
    sel = sel === id ? '' : id
    pebs.forEach((b, k) => b.setAttribute('aria-pressed', String(k === sel)))
    if (compared && sel) why.textContent = K.tasks.find((t) => t.id === id)!.why
    label()
  }
  function put(i: number) {
    if (!sel) return
    const b = pebs.get(sel)!
    placed[sel] = K.trays[i].id
    lists[i].append(b)
    b.setAttribute('aria-pressed', 'false')
    b.focus()
    sel = ''
    label()
    if (Object.keys(placed).length === K.tasks.length) compareBtn.hidden = false
    if (compared) compare()
  }
  function compare() {
    let n = 0
    for (const t of K.tasks) {
      const b = pebs.get(t.id)!
      const ok = placed[t.id] === t.expert
      if (ok) n++
      b.dataset.match = String(ok)
      b.querySelector('.t38t-peb-exp')!.textContent = ok ? '' : `→ ${K.trays.find((x) => x.id === t.expert)!.name}`
    }
    match.textContent = fill(K.match, { n, total: K.tasks.length })
    if (!compared) {
      compared = true
      after.hidden = false
      after.setAttribute('aria-live', 'polite')
      ctx.insight(K.insight, K.detail)
    }
  }
  ctx.prompt(K.prompt)
}
