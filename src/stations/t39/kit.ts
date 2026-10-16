import { fill, h, nextId, s } from '../../core/dom'
import { getSource } from '../../core/content'
import { blob, curve, rng, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist, pine } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import { loadAnswers } from './ask'
import { C, shell } from './shell'
import { bamboo, crescent, dawnGlow, f1, fog, lines } from '../t37/sumi'

const K = C.scenes.kit

/**
 * The tools each type is painted as, standing in the basket with their foot at (x, y): a brush, a brush tube, a small oil
 * lamp, a wood plane, a hanging scroll. Each a few strokes over a wash.
 */
const TOOL: Record<string, (x: number, y: number) => SVGElement[]> = {
  chat: (x, y) => {
    const c = bamboo([[x, y], [x + 1, y - 34], [x + 2, y - 62]], 3.2, 3911, 14)
    return [s('path', { class: 'g13-bamboo', d: c.cane, filter: 'url(#ink-rough)' }), s('path', { class: 'g13-node', d: c.nodes }),
      s('path', { class: 'g13-ink', d: blob(x + 2.4, y - 68, 3, 8, 3912, 0.1, 12) + stroke([[x + 2.4, y - 74], [x + 3, y - 80]], 2, 0.1, 0.9, 0.1) })]
  },
  media: (x, y) => {
    const c = bamboo([[x, y], [x, y - 22], [x, y - 40]], 13, 3913, 18)
    return [
      s('path', { class: 'g13-ink', d: stroke([[x - 3, y - 38], [x - 7, y - 64]], 1.6, 0.05, 0.1, 0.5) + stroke([[x + 1, y - 38], [x + 1.5, y - 70]], 1.7, 0.05, 0.1, 0.5) + stroke([[x + 4, y - 38], [x + 9, y - 60]], 1.5, 0.05, 0.1, 0.5) + blob(x - 7.4, y - 67, 1.8, 4, 3914, 0.1, 10) + blob(x + 1.6, y - 73, 2, 4.4, 3915, 0.1, 10) + blob(x + 9.5, y - 63, 1.7, 3.8, 3916, 0.1, 10) }),
      s('path', { class: 'g13-bamboo', d: c.cane, filter: 'url(#ink-rough)' }), s('path', { class: 'g13-node', d: c.nodes }), s('path', { class: 'g13-hi', d: c.hi }),
      s('ellipse', { class: 't39k-mouth', cx: x, cy: y - 40, rx: 6.4, ry: 1.8 })]
  },
  local: (x, y) => [
    s('circle', { cx: x, cy: y - 42, r: 22, fill: 'url(#p2-lamp)', class: 't39k-flameglow' }),
    s('path', { class: 't39k-clay', d: `M${x - 9} ${y - 32}Q${x} ${y - 26} ${x + 9} ${y - 32}L${x + 7} ${y - 35}L${x - 7} ${y - 35}Z M${x - 1.6} ${y - 26}L${x + 1.6} ${y - 26}L${x + 2.4} ${y}L${x - 2.4} ${y}Z M${x - 6} ${y}L${x + 6} ${y}L${x + 4} ${y - 3}L${x - 4} ${y - 3}Z`, filter: 'url(#ink-rough)' }),
    s('path', { class: 't39k-flame', d: `M${x + 4} ${y - 35}Q${x + 1} ${y - 41} ${x + 5} ${y - 48}Q${x + 9} ${y - 40} ${x + 6} ${y - 35}Z` }),
    s('path', { class: 'g13-ink', d: stroke(curve([x - 9, y - 32], [x, y - 27], [x + 9, y - 32], 8), 1.1, 0.1, 0.1, 0.4) })],
  code: (x, y) => [
    s('path', { class: 't39k-wood', d: `M${x - 18} ${y - 22}L${x + 12} ${y - 38}L${x + 18} ${y - 30}L${x - 12} ${y - 14}Z`, filter: 'url(#ink-rough)' }),
    s('path', { class: 't39k-wood-sh', d: `M${x - 12} ${y - 14}L${x + 18} ${y - 30}L${x + 18} ${y - 25}L${x - 12} ${y - 9}Z` }),
    s('path', { class: 'g13-ink', d: stroke([[x - 4, y - 22], [x + 6, y - 31]], 2.2, 0.1, 0.1, 0.5) + stroke([[x - 18, y - 22], [x + 12, y - 38], [x + 18, y - 30]], 1, 0.05, 0.05, 0.5) + lines([[x - 8, y - 17, x + 12, y - 28]], 0.6) }),
    s('path', { class: 't39k-blade', d: stroke([[x - 2, y - 24], [x + 5, y - 30]], 1, 0.2, 0.2, 0.4) })],
  skill: (x, y) => [
    s('path', { class: 't39k-scroll', d: `M${x - 8} ${y - 66}L${x + 8} ${y - 66}L${x + 8} ${y - 18}L${x - 8} ${y - 18}Z`, filter: 'url(#ink-rough)' }),
    s('path', { class: 'g13-ink', d: stroke(curve([x - 3, y - 56], [x + 4, y - 48], [x - 2, y - 32], 8), 2.2, 0.1, 0.7, 0.2) + blob(x + 3, y - 26, 1.6, 1.6, 3917, 0.1, 8) }),
    s('path', { class: 't39k-seal', d: `M${x + 3} ${y - 25}h3v3h-3z` }),
    s('path', { class: 'g13-ink', d: stroke([[x - 10, y - 67], [x + 10, y - 67]], 3.2, 0.05, 0.05, 0.6) + stroke([[x - 10, y - 17], [x + 10, y - 17]], 3.6, 0.05, 0.05, 0.6) + stroke(curve([x - 6, y - 68], [x, y - 76], [x + 6, y - 68], 6), 0.8, 0.1, 0.1, 0.5) })],
}

/** The rattan basket on the veranda table: a woven bowl, a coiled rim, dew on the cane. Back and front halves. */
function basket(cx: number, top: number, w: number, d: number) {
  const r = rng(3920)
  const cid = nextId('t39b')
  const body = `M${cx - w} ${top}Q${cx - w * 0.98} ${top + d * 0.9} ${cx - w * 0.62} ${top + d}Q${cx} ${top + d * 1.16} ${cx + w * 0.62} ${top + d}Q${cx + w * 0.98} ${top + d * 0.9} ${cx + w} ${top}Q${cx} ${top + d * 0.26} ${cx - w} ${top}Z`
  // woven cane: rows of strands passing over the stakes (offset row to row), the stakes between, all following the bowl
  let weave = '', stakes = ''
  const bulge = (x: number) => (1 - ((x - cx) / w) ** 2) * d * 0.24
  for (let k = 0; k < 8; k++) {
    const y0 = top + d * 0.06 + k * d * 0.125
    for (let x = cx - w * 1.05 + (k % 2) * 5; x < cx + w * 1.05; x += 10) weave += blob(x, y0 + bulge(x), 4.6, 2.1 + k * 0.05, 3925 + k * 31 + Math.round(x), 0.12, 10)
  }
  for (let x = cx - w + 5; x < cx + w; x += 10) {
    const xb = cx + (x - cx) * 0.64
    stakes += stroke([[x, top + bulge(x) * 0.3], [(x + xb) / 2, top + d * 0.6 + bulge(x) * 0.5], [xb, top + d * 1.1]], 1.1, 0.1, 0.1, 0.5)
  }
  let wrap = ''
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, x = cx - w + 2 * w * t, y = top + Math.sin(t * Math.PI) * d * 0.26
    wrap += stroke([[x - 2, y - 2.6], [x + 2, y + 2.6]], 0.9, 0.2, 0.2, 0.3)
  }
  let dew = ''
  const drops: Pt[] = []
  for (let i = 0; i < 16; i++) {
    const t = r(), side = r() < 0.5 ? -1 : 1
    const x = cx + side * w * (0.2 + t * 0.7), y = top + d * (0.22 + r() * 0.6) + Math.abs(x - cx) * -0.04
    drops.push([x, y])
    dew += blob(x, y, 1.2 + r() * 0.8, 1.2 + r() * 0.9, 3921 + i, 0.1, 8)
  }
  const rimBack = stroke(curve([cx - w, top], [cx, top - d * 0.26], [cx + w, top], 24), 4.4, 0.02, 0.02, 0.7)
  const rimFront = stroke(curve([cx - w, top], [cx, top + d * 0.26], [cx + w, top], 24), 5, 0.02, 0.02, 0.7)
  return {
    back: s('g', { class: 't39k-basket' },
      s('path', { class: 't39k-inside', d: `M${cx - w} ${top}Q${cx} ${top - d * 0.26} ${cx + w} ${top}Q${cx} ${top + d * 0.26} ${cx - w} ${top}Z` }),
      s('path', { class: 't39k-rim', d: rimBack, filter: 'url(#ink-rough)' })),
    front: s('g', { class: 't39k-basket' },
      s('clipPath', { id: cid }, s('path', { d: body })),
      s('path', { class: 't39k-cane', d: body, filter: 'url(#ink-rough)' }),
      s('g', { 'clip-path': `url(#${cid})` }, s('path', { class: 't39k-stake', d: stakes }), s('path', { class: 't39k-weave', d: weave })),
      s('path', { class: 't39k-cane-sh', d: body }),
      s('path', { class: 't39k-rim', d: rimFront, filter: 'url(#ink-rough)' }),
      s('path', { class: 't39k-wrap', d: wrap }),
      s('path', { class: 'g13-hi', d: stroke(curve([cx - w * 0.8, top + 2], [cx - w * 0.2, top + d * 0.2], [cx + w * 0.3, top + d * 0.18], 12), 1.2, 0.3, 0.3, 0.1) }),
      s('path', { class: 't39k-dew', d: dew }),
      s('path', { class: 't39k-dew-hi', d: drops.map(([x, y]) => `M${f1(x - 0.6)} ${f1(y - 0.6)}h0.9v0.9h-0.9z`).join('') })),
  }
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
  const { root, svg, panel } = shell(ctx, 't39k', K.art, [K.insight], '0 20 400 222')
  const b = basket(200, 172, 104, 50)
  const r = rng(3930)
  let grain = ''
  for (let i = 0; i < 9; i++) {
    const y = 196 + i * 5.5 + i * i * 0.4
    for (let x = -10 + r() * 40; x < 410; x += 60 + r() * 80) grain += stroke([[x, y], [x + 40 + r() * 60, y + (r() - 0.5) * 1.5]], 0.6 + i * 0.1, 0.3, 0.3, 0.1)
  }
  const tools = K.types.map((t, i) => s('g', { class: 't39k-tool', 'data-id': t.id }, ...(TOOL[t.id] ?? TOOL.chat)(132 + i * 34, 178 + Math.abs(i - 2) * 1.5)))
  svg.append(
    dawnGlow(330, 118, 200, 80, 3),
    fog(200, 88, 240, 50),
    crescent(62, 60, 9, 0.6, 160),
    hills(-30, 430, 122, 40, 3931, 0.92, 7),
    hills(260, 430, 126, 30, 3932, 0.66, 2),
    mist(200, 124, 260, 12),
    pine(36, 160, 84, 3933, 1),
    // the table top in perspective, its near edge, wood grain
    s('path', { class: 't39k-table', d: 'M24 178L376 178L410 246L-10 246Z', filter: 'url(#ink-rough)' }),
    s('path', { class: 't39k-grain', d: grain, filter: 'url(#ink-dry)' }),
    s('path', { class: 'g13-ink', d: stroke([[24, 178], [200, 177], [376, 178]], 1.8, 0.05, 0.05, 0.5) + stroke([[-10, 238], [200, 240], [410, 238]], 2.6, 0.02, 0.02, 0.5), filter: 'url(#ink-rough)' }),
    s('ellipse', { class: 't39k-sh', cx: 206, cy: 224, rx: 118, ry: 10 }),
    b.back, ...tools, b.front)

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
