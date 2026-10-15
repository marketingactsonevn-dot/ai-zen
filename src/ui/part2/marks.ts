import './marks.css'
import { fill, h, nextId, s } from '../../core/dom'
import { L, type Fact } from '../../core/content'

/**
 * B.7.3 Confidence marks. In Part 2 (html[data-part="2"]) `fact()` puts one small ink mark after the sentence instead of
 * the Part 1 text tag: ● verified fact · ◐ opinion · ○ prediction · ◇ the company's own claim, not independently confirmed.
 * Illustrations and `verify: true` keep their Part 1 tags (no mark).
 */
export type Mark = 'fact' | 'opinion' | 'prediction' | 'claim'
const ORDER: Mark[] = ['fact', 'opinion', 'prediction', 'claim']

export function markOf(f: Fact): Mark | null {
  if (f.kind === 'opinion' || f.kind === 'prediction') return f.kind
  if (f.kind === 'illustration') return null
  if (f.claimBy && !f.verifiedBy) return 'claim'
  return f.verify ? null : 'fact'
}

/** The ink glyph of a mark (12 × 12, currentColor). */
export function markGlyph(m: Mark, cls = 'cmark-glyph'): SVGSVGElement {
  const ring = { cx: 6, cy: 6, r: 4.1, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.4 }
  return s('svg', { class: cls, viewBox: '0 0 12 12', 'aria-hidden': 'true', 'data-mark': m },
    m === 'fact' ? s('circle', { cx: 6, cy: 6, r: 4.4, fill: 'currentColor' }) : null,
    m === 'opinion' ? s('circle', ring) : null,
    m === 'opinion' ? s('path', { d: 'M6 1.9A4.1 4.1 0 0 0 6 10.1Z', fill: 'currentColor' }) : null,
    m === 'prediction' ? s('circle', ring) : null,
    m === 'claim' ? s('path', { d: 'M6 1.3L10.7 6L6 10.7L1.3 6Z', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.4, 'stroke-linejoin': 'round' }) : null)
}

/** [button, popover] for a Part 2 fact, or null when it carries no mark; fact.ts wires them like its source ⓘ. */
export function confidenceMark(f: Fact): [HTMLButtonElement, HTMLElement] | null {
  const m = markOf(f)
  if (!m) return null
  const id = nextId('cm')
  const btn = h('button', { class: 'cmark-btn', type: 'button', 'data-mark': m, 'aria-expanded': 'false', 'aria-controls': id, 'aria-label': `${L.marks.title}: ${L.marks[m]}` }, markGlyph(m))
  const pop = h('span', { class: 'src-pop cmark-pop', id },
    h('span', { class: 'src-label' }, L.marks.title),
    h('span', { class: 'cmark-legend' },
      ...ORDER.map((k) => h('span', { class: 'cmark-row', 'data-on': k === m ? '' : null, 'data-mark': k }, markGlyph(k), L.marks[k]))),
    f.claimBy ? h('span', { class: 'src-meta' }, fill(L.vendorClaim, { who: f.claimBy })) : null,
    f.verifiedBy ? h('span', { class: 'src-meta' }, fill(L.independent, { who: f.verifiedBy })) : null)
  return [btn, pop]
}
