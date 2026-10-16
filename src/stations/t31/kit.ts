import './kit.css'
import '../../ui/part2/part2.css'
import { h, s } from '../../core/dom'
import { L } from '../../core/content'
import { p2Defs, stroke, type Pt } from '../../ui/part2/ink'
import { findTakeaway, takeaway } from '../../ui/part2/takeaway'

/** Garden 11 (stations 31–33): small shared pieces. Layout is CSS (flex/grid), art is fixed-viewBox SVG, so no JS sizing. */

export { stroke, type Pt }

/**
 * A static night backdrop: far hills in wash, a mist band, the moon with its halo (top right, kept on narrow screens by
 * xMaxYMid slice), and optionally a band of still water with a moon path.
 */
export function night(o: { water?: number; hills?: boolean } = {}): SVGSVGElement {
  p2Defs()
  const g = s('svg', { class: 'g11-night', viewBox: '0 0 1000 600', preserveAspectRatio: 'xMaxYMid slice', 'aria-hidden': 'true' })
  g.append(
    s('circle', { cx: 860, cy: 96, r: 170, fill: 'url(#p2-halo)' }),
    s('circle', { class: 'g11-moon', cx: 860, cy: 96, r: 30 }),
  )
  if (o.hills !== false) {
    g.append(
      s('path', { class: 'g11-hill', 'fill-opacity': 0.06, filter: 'url(#ink-wash)', d: 'M-20 300C120 230 220 250 330 205S540 240 640 190S860 230 1020 180V620H-20Z' }),
      s('path', { class: 'g11-hill', 'fill-opacity': 0.05, filter: 'url(#ink-wash)', d: 'M-20 360C160 320 300 340 460 300S760 330 1020 290V620H-20Z' }),
    )
  }
  if (o.water != null) {
    const y = o.water
    g.append(s('rect', { class: 'g11-water', x: -20, y, width: 1040, height: 620 - y }))
    for (let i = 0; i < 6; i++) {
      const yy = y + 14 + i * 16
      const w = 90 - i * 10
      g.append(s('path', { class: 'g11-glint', d: stroke([[860 - w, yy], [860, yy - 1.5], [860 + w, yy]], 3 - i * 0.3, 0.3, 0.3, 0.1) }))
    }
  }
  return g
}

/** A paper lantern (viewBox 0 0 40 64): string, caps, ribbed body. `.on` on an ancestor lights it (CSS). */
export function lantern(cls = ''): SVGSVGElement {
  return s('svg', { class: `g11-lan ${cls}`.trim(), viewBox: '0 0 40 64', 'aria-hidden': 'true' },
    s('circle', { class: 'g11-lan-glow', cx: 20, cy: 34, r: 20 }),
    s('path', { class: 'g11-ink', d: stroke([[20, 0], [20, 12]], 1.4, 0, 0) }),
    s('rect', { class: 'g11-ink', x: 13, y: 11, width: 14, height: 4, rx: 1 }),
    s('ellipse', { class: 'g11-lan-body', cx: 20, cy: 34, rx: 15, ry: 19 }),
    s('path', { class: 'g11-lan-rib', d: 'M7 26Q20 22 33 26M5.5 34Q20 31 34.5 34M7 42Q20 46 33 42M20 15V53' }),
    s('rect', { class: 'g11-ink', x: 13, y: 52, width: 14, height: 4, rx: 1 }),
    s('path', { class: 'g11-ink', d: stroke([[20, 56], [20, 63]], 1.2, 0, 0.6) }))
}

/** Text for a Fact-or-string, for aria labels. */
export const plain = (f: string | { text: string }) => (typeof f === 'string' ? f : f.text)

/** The take-away card behind a pill: the pill appears when `show()` is called, the card opens over the art as a sheet. */
export function cardSheet(root: HTMLElement, id: string, onCleanup?: (fn: () => void) => void) {
  const card = findTakeaway(id)
  const sheet = h('div', { class: 'g11-sheet', hidden: true })
  const pill = h('button', { class: 'g11-pill g11-take', type: 'button', hidden: true, 'aria-expanded': 'false' }, L.takeaway)
  const close = () => {
    sheet.hidden = true
    pill.setAttribute('aria-expanded', 'false')
    pill.focus({ preventScroll: true })
  }
  pill.addEventListener('click', () => {
    if (!card) return
    if (!sheet.childElementCount) sheet.append(h('button', { class: 'g11-close', type: 'button', 'aria-label': L.close, onClick: close }, '×'), takeaway(card, null, onCleanup))
    root.scrollTop = 0
    sheet.hidden = false
    pill.setAttribute('aria-expanded', 'true')
    ;(sheet.querySelector('.p2k-copy') as HTMLElement | null)?.focus({ preventScroll: true })
  })
  sheet.addEventListener('keydown', (e) => e.key === 'Escape' && (e.stopPropagation(), close()))
  root.append(pill, sheet)
  return { show: () => card && (pill.hidden = false), pill }
}

/** A polite live region that is only made live after its first fill (so entering the scene is not read twice). */
export function live(cls: string): HTMLElement & { say(...kids: (Node | string)[]): void } {
  const el = h('div', { class: cls }) as unknown as HTMLElement & { say(...kids: (Node | string)[]): void }
  el.say = (...kids) => {
    el.replaceChildren(...kids)
    if (!el.hasAttribute('aria-live')) el.setAttribute('aria-live', 'polite')
  }
  return el
}
