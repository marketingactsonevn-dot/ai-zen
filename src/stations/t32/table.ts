import raw from '../../content/tram-32.json'
import { fill, h } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { cardSheet, live } from '../t31/kit'

const K = raw.scenes.table
const num = (n: number) => n.toLocaleString(document.documentElement.lang || 'vi')

/** Scene 2 — a low tea table under a round moon window: the table top is your RAM, each model a bundle of scrolls. */
export function tableScene(ctx: SceneCtx) {
  let ram = 16
  let bit = 'q4'
  let model: (typeof K.models)[number] | null = null
  let first = true

  const seg = <T extends string | number>(items: { v: T; label: string }[], get: () => T, set: (v: T) => void, aria: string) => {
    const btns = items.map((it) => h('button', { class: 'g11-pill t32t-seg', type: 'button', 'aria-pressed': String(it.v === get()), onClick: () => (set(it.v), btns.forEach((b, k) => b.setAttribute('aria-pressed', String(items[k].v === get()))), draw()) }, it.label))
    return h('div', { class: 't32t-segs', role: 'group', 'aria-label': aria }, h('span', { class: 'p2-eyebrow' }, aria), ...btns)
  }
  const ramSeg = seg(K.ramOptions.map((n) => ({ v: n, label: fill(K.ramText, { n }) })), () => ram, (v) => (ram = v), K.ramLabel)
  const bitSeg = seg(K.bits.map((b) => ({ v: b.id, label: b.label })), () => bit, (v) => (bit = v), K.bitsLabel)
  const gbOf = (m: (typeof K.models)[number]) => (bit === 'q4' ? m.gbQ4 : m.gb16)
  const models = K.models.map((m) => {
    const size = h('span', { class: 't32t-size' })
    const b = h('button', { class: 't32t-model', type: 'button', 'aria-pressed': 'false', onClick: () => ((model = m), draw()) }, h('span', { class: 't32t-roll', 'aria-hidden': 'true' }), h('span', { class: 't32t-ml' }, m.label), size)
    return { m, b, size }
  })

  const bundle = h('div', { class: 't32t-bundle' })
  const spill = h('div', { class: 't32t-spill', 'aria-hidden': 'true' })
  const top = h('div', { class: 't32t-top' },
    h('span', { class: 't32t-tick', style: `left:${K.fitRule.roomy * 100}%` }),
    h('span', { class: 't32t-tick', style: `left:${K.fitRule.tight * 100}%` }),
    h('span', { class: 't32t-ram' }, fill(K.ramText, { n: ram })))
  const state = live('t32t-state')
  const note = h('p', { class: 't32t-note', hidden: true }, K.note)
  const root = h('div', { class: 'g11 t32t', role: 'group', 'aria-label': K.aria },
    h('p', { class: 'visually-hidden' }, K.art),
    h('div', { class: 't32t-window', 'aria-hidden': 'true' }, h('span', { class: 't32t-moon' })),
    h('div', { class: 't32t-stage' }, bundle, top, h('span', { class: 't32t-leg l' }), h('span', { class: 't32t-leg r' }), spill, h('span', { class: 't32t-mat' })),
    state,
    h('div', { class: 't32t-models' }, ...models.map((x) => x.b)),
    h('div', { class: 't32t-controls' }, ramSeg, bitSeg),
    ctx.fact(K.rule as Fact, 'p', 't32t-rule'),
    note)
  ctx.art.append(root)
  const sheet = cardSheet(root, K.takeaway, ctx.onCleanup)

  function draw() {
    ;(top.lastChild as HTMLElement).textContent = fill(K.ramText, { n: ram })
    for (const x of models) {
      const gb = gbOf(x.m)
      x.size.textContent = fill(K.sizeText, { gb: num(gb) })
      x.b.setAttribute('aria-pressed', String(x.m === model))
      x.b.setAttribute('aria-label', fill(K.modelAria, { label: x.m.label, gb: num(gb), ram }))
    }
    if (!model) return
    const r = gbOf(model) / ram
    const kind = r <= K.fitRule.roomy ? 'roomy' : r <= K.fitRule.tight ? 'tight' : 'spill'
    root.dataset.fit = kind
    bundle.style.width = `${Math.min(r, 1.25) * 100}%`
    spill.classList.toggle('on', kind === 'spill')
    state.say(h('strong', null, `${model.label} · ${fill(K.sizeText, { gb: num(gbOf(model)) })} — `), K.states[kind as keyof typeof K.states])
    ctx.chime(kind === 'spill' ? 'low' : 'tap')
    if (first) {
      first = false
      note.hidden = false
      ctx.insight(K.insight as Fact, K.detail as Fact)
      sheet.show()
    }
  }
  draw()
  ctx.prompt(K.prompt)
}
