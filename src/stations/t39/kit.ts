import { fill, h, s } from '../../core/dom'
import { getSource } from '../../core/content'
import type { SceneCtx } from '../types'
import { loadAnswers } from './ask'
import { C, shell } from './shell'

const K = C.scenes.kit
/** the tool each type is drawn as in the basket: brush, brush tube, oil lamp, plane, hanging scroll */
const GLYPH: Record<string, string> = {
  chat: 'M-2 -30h4l1 24h-6zM-3 -6q3 14 0 18q-3 -4 0 -18z',
  media: 'M-9 -28h18v40h-18zM-9 -22h18M-4 -34v6M1 -36v8M5 -33v5',
  local: 'M-10 10h20l-3 -8h-14zM-6 2q-4 -14 6 -18q10 4 6 18zM0 -16v-8',
  code: 'M-20 6h40l-4 -10h-32zM-6 -4l4 -10h6l-4 10z',
  skill: 'M-14 -30h28M-11 -30v40h22v-40M-11 10q11 5 22 0M-6 -20h12M-6 -12h12M-6 -4h8',
}

/** Which tool types fit the four answers, and which stations to revisit. */
function pick() {
  const a = loadAnswers()
  if (!a.role) return null
  const R = K.rules
  const set = new Set(R.role[a.role] ?? ['chat'])
  const notes: string[] = []
  const stations = new Set<number>()
  for (const rule of [R.goal[a.goal ?? ''], R.device[a.device ?? ''], R.budget[a.budget ?? '']]) {
    if (!rule) continue
    rule.add?.forEach((x) => set.add(x))
    rule.drop?.forEach((x) => set.delete(x))
    rule.stations?.forEach((x) => stations.add(x))
    if (rule.note) notes.push(rule.note)
  }
  return { set, notes, stations }
}

/** Scene 2 — the rattan basket fills with the tool types that fit; the rest fade like moon shadows. */
export function kitScene(ctx: SceneCtx) {
  const { root, svg, panel } = shell(ctx, 't39k', K.art, [K.insight], '0 0 400 230')
  const basket = s('g', { class: 't39k-basket' },
    s('path', { class: 'body', d: 'M70 140q130 20 260 0l-22 70q-108 16 -216 0z' }),
    s('path', { class: 'weave', d: 'M76 160q124 18 248 0M82 180q118 16 236 0M88 198q112 14 224 0M120 146l-6 66M160 150l-2 66M200 150v66M240 150l2 66M280 146l6 66' }),
    s('path', { class: 'rim', d: 'M70 140q130 20 260 0' }))
  const tools = K.types.map((t, i) => s('g', { class: 't39k-tool', 'data-id': t.id, transform: `translate(${110 + i * 45} 130)` },
    s('path', { d: GLYPH[t.id] ?? GLYPH.chat })))
  svg.append(s('ellipse', { class: 't39k-sh', cx: 200, cy: 214, rx: 150, ry: 10 }), ...tools, basket)

  const chosen = pick()
  const open = h('button', { class: 'btn primary t39k-open', type: 'button', onClick: show }, K.open)
  const out = h('div', { class: 't39k-out' })
  panel.append(...(chosen ? [] : [h('p', { class: 't39k-empty' }, h('a', { href: '#/tram/39/1' }, K.empty))]), open, out)
  let told = false

  function show() {
    open.hidden = true
    root.dataset.open = 'true'
    const set = chosen?.set ?? new Set(K.types.map((t) => t.id))
    tools.forEach((g, i) => g.classList.toggle('dim', !set.has(K.types[i].id)))
    const stations = new Set(chosen?.stations ?? [])
    const types = K.types.filter((t) => set.has(t.id))
    types.forEach((t) => t.stations.forEach((n) => stations.add(n)))
    out.replaceChildren(
      ...types.map((t) => h('article', { class: 't39k-type' },
        h('h3', null, t.name), h('p', null, t.what),
        h('p', { class: 't39k-ex' }, h('span', { class: 'p2-eyebrow' }, `${K.examplesLabel} · ${K.docsLabel}: `),
          ...t.examples.flatMap((e, i) => [i ? ', ' : '', h('a', { href: getSource(e.source)?.url ?? '#', target: '_blank', rel: 'noopener' }, e.name)])))),
      ...(chosen?.notes ?? []).map((n) => h('p', { class: 't39k-note' }, n)),
      h('p', { class: 't39k-rev' }, h('span', { class: 'p2-eyebrow' }, K.revisit), ' ',
        ...[...stations].sort((a, b) => a - b).map((n) => h('a', { class: 't39k-st', href: `#/tram/${n}` }, fill(K.stationLink, { n })))),
      ctx.fact(K.priceNote, 'p', 't39k-price'))
    out.setAttribute('aria-live', 'polite')
    if (!told) (ctx.insight(K.insight), (told = true))
  }
  ctx.prompt(K.prompt)
}
