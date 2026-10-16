import { fill, h, nextId, s } from '../../core/dom'
import { onDigit, rng, seedOf, shuffledIdx, stroke } from '../../ui/part2/ink'
import { hills, mist, moon, pine, toro } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import { C, shell } from './shell'
import { dawnGlow, fog, lines } from '../t37/sumi'

const K = C.scenes.trays

/** The wooden veranda at moonset, seen from inside: the eave and posts frame the misty garden, boards run toward us. */
function veranda(svg: SVGGElement) {
  const r = rng(388)
  let boards = '', grain = ''
  const ys = [106, 113, 121, 131, 143, 158, 176, 198, 224]
  ys.forEach((y, i) => {
    boards += stroke([[-10, y], [200, y + 0.6], [410, y]], 0.8 + i * 0.22, 0.02, 0.02, 0.5)
    if (i === ys.length - 1) return
    const gap = ys[i + 1] - y
    for (let x = -10 + r() * 60; x < 410; x += 50 + r() * 90) {
      const len = 30 + r() * 70 + i * 6
      grain += stroke([[x, y + gap * (0.35 + r() * 0.3)], [x + len * 0.5, y + gap * (0.4 + r() * 0.2)], [x + len, y + gap * (0.35 + r() * 0.3)]], 0.5 + i * 0.12, 0.3, 0.3, 0.1)
    }
  })
  svg.append(
    dawnGlow(250, 90, 190, 70, 3),
    fog(200, 64, 240, 46),
    moon(236, 56, 11, 389, false),
    fog(236, 62, 44, 6), fog(244, 50, 28, 3),
    hills(-10, 410, 94, 34, 390, 0.92, 7),
    hills(250, 420, 98, 24, 391, 0.65, 2),
    mist(200, 96, 240, 10),
    pine(64, 104, 70, 392, 1),
    toro(330, 103, 22, true),
    s('path', { class: 't38t-floor', d: 'M-10 104L410 104L410 230L-10 230Z' }),
    s('path', { class: 't38t-grain', d: grain, filter: 'url(#ink-dry)' }),
    s('path', { class: 'g13-ink t38t-board', d: boards }),
    s('path', { class: 'g13-ink', d: stroke([[-10, 104], [200, 103], [410, 104]], 3.4, 0.02, 0.02, 0.5), filter: 'url(#ink-rough)' }),
    s('path', { class: 't38t-eave', d: 'M-10 -10L410 -10L410 16Q200 23 -10 16Z', filter: 'url(#ink-wash)' }),
    s('path', { class: 'g13-ink', d: stroke([[-10, 15], [200, 19.5], [410, 15]], 2.6, 0.02, 0.02, 0.5) + lines(Array.from({ length: 12 }, (_, i) => { const x = 10 + i * 35; return [x, 15 + Math.sin((x / 400) * Math.PI) * 4.5, x, 22 + Math.sin((x / 400) * Math.PI) * 4.5] }), 3.6, 0.05, 0.05), filter: 'url(#ink-rough)' }))
}

/** Scene 4 — sort the engraved pebbles into three stone trays (dry, half-flooded, misted), then compare. */
export function traysScene(ctx: SceneCtx) {
  const { root, svg, sheet, panel } = shell(ctx, 't38t', K.art, [K.insight], '0 0 400 220')
  sheet.setAttribute('preserveAspectRatio', 'xMidYMid slice')
  veranda(svg)

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
