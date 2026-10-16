import './kit.css'
import '../../ui/part2/part2.css'
import { h, s } from '../../core/dom'
import { L } from '../../core/content'
import { blob, curve, p2Defs, rng, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist, moon, paperLantern, wash, water } from '../../ui/part2/paint'
import { findTakeaway, takeaway } from '../../ui/part2/takeaway'

/**
 * Garden 11 (stations 31–33): shared painted pieces (sumi-e under the moon, built from the Part 2 paint kit) and small
 * UI helpers. Art is fixed-viewBox SVG built once per mount, or per layout where it has to follow HTML boxes.
 */

export { stroke, curve, blob, rng, type Pt }

const f1 = (n: number) => (Math.round(n * 10) / 10).toString()

/**
 * The night behind a scene: moonlit sky, a far ink range, two nearer ridges whose feet melt into mist, optionally still
 * water with the moon's road. Fixed viewBox 1000 × 600, xMaxYMid slice, so a phone keeps the moon (top right).
 */
export function night(o: { water?: number; hills?: boolean; moon?: boolean; low?: boolean } = {}): SVGSVGElement {
  p2Defs()
  const g = s('svg', { class: 'g11-night', viewBox: '0 0 1000 600', preserveAspectRatio: 'xMaxYMid slice', 'aria-hidden': 'true' })
  const base = o.low ? 410 : 340
  g.append(mist(640, base - 120, 720, 230))
  if (o.moon !== false) g.append(moon(936, 88, 28, 1131, true))
  if (o.hills !== false) {
    g.append(
      hills(-40, 1040, base, 120, 1101, 0.9, 6),
      hills(-30, 470, base + 26, 96, 1102, 0.62, 2),
      hills(600, 1040, base + 34, 84, 1103, 0.66, 2),
      mist(500, base + 30, 640, 64))
  }
  if (o.water != null) g.append(water(-20, o.water, 1020, 640, 1104, 936), mist(520, o.water + 4, 620, 22))
  return g
}

/**
 * A dim room at night (interiors): a wall of bamboo slats in a faint wash, each slat tapering away at both ends so the
 * wall dissolves into the paper (no hard floor line: the things in the room bring their own floor). Fixed viewBox
 * 1000 × 600, xMidYMid slice.
 */
export function room(seed = 1150): SVGSVGElement {
  p2Defs()
  const r = rng(seed)
  let slats = '', nodes = ''
  for (let x = 14; x < 1000; x += 30 + r() * 12) {
    const w = 8 + r() * 6
    const y0 = 20 + r() * 60, y1 = 520 + r() * 60
    slats += stroke([[x, y0], [x + (r() - 0.5) * 3, (y0 + y1) / 2], [x + (r() - 0.5) * 4, y1]], w, 0.3, 0.35, 0.05)
    for (let k = 0; k < 2; k++) {
      const y = y0 + (y1 - y0) * (0.25 + r() * 0.5)
      nodes += stroke([[x - w * 0.6, y], [x + w * 0.6, y - 0.5]], 1.6, 0.2, 0.2, 0.3)
    }
  }
  return s('svg', { class: 'g11-night g11-room', viewBox: '0 0 1000 600', preserveAspectRatio: 'xMidYMid slice', 'aria-hidden': 'true' },
    s('path', { class: 'g11-slat', d: slats, filter: 'url(#ink-wash)' }),
    s('path', { class: 'g11-node', d: nodes }))
}

/**
 * A paper lantern (viewBox 0 0 40 64): cord, lacquered caps, ribbed paper, a tassel. Unlit it is pale paper in the
 * moonlight; `.on` on the svg or an ancestor lights it (body glows, halo opens) — CSS only.
 */
export function lantern(cls = '', seed = 7): SVGSVGElement {
  p2Defs()
  const lamp = paperLantern(20, 0, 13.5, seed, 9)
  lamp.children[2].after(s('ellipse', { class: 'g11-lan-shade', cx: 20, cy: 25.9, rx: 13.6, ry: 17 }))
  return s('svg', { class: `g11-lan ${cls}`.trim(), viewBox: '0 0 40 64', 'aria-hidden': 'true' },
    lamp,
    s('path', { class: 'g11-tassel', d: stroke([[20, 44], [20.5, 52], [19.6, 61]], 2.2, 0.05, 0.6, 0.3) }))
}

/** A bamboo pole from a to b, w thick: a brushed culm, a node every `seg` px, a moonlit edge. */
export function bamboo(a: Pt, b: Pt, w: number, seed: number, seg = 40, cls = 'g11-bamboo'): SVGGElement {
  const r = rng(seed)
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  const ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len
  const nx = -uy, ny = ux
  const mid: Pt = [(a[0] + b[0]) / 2 + nx * (r() - 0.5) * w * 0.4, (a[1] + b[1]) / 2 + ny * (r() - 0.5) * w * 0.4]
  const body = curve(a, mid, b, 12)
  let nodes = ''
  for (let t = seg * (0.5 + r() * 0.4); t < len - seg * 0.3; t += seg * (0.85 + r() * 0.3)) {
    const c: Pt = [a[0] + ux * t, a[1] + uy * t]
    nodes += stroke([[c[0] - nx * w * 0.62, c[1] - ny * w * 0.62], [c[0] + nx * w * 0.62, c[1] + ny * w * 0.62]], Math.max(1.2, w * 0.24), 0.2, 0.2, 0.4)
  }
  const edge = body.map(([x, y]) => [x - nx * w * 0.26, y - ny * w * 0.26] as Pt)
  return s('g', { class: cls },
    s('path', { class: 'g11-bamboo-culm', d: stroke(body, w, 0.02, 0.03, 0.85), filter: 'url(#ink-rough)' }),
    s('path', { class: 'g11-bamboo-node', d: nodes }),
    s('path', { class: 'g11-bamboo-hi', d: stroke(edge, Math.max(0.8, w * 0.16), 0.1, 0.1, 0.2) }))
}

/** A pad of pine needles at (x, y), w wide: a pale wash and fans of fine strokes (for branches drawn by hand). */
export function needles(x: number, y: number, w: number, seed: number): SVGGElement {
  const r = rng(seed)
  let d = ''
  const fans = 2 + Math.round(r())
  for (let f = 0; f < fans; f++) {
    const ox = x + (f - (fans - 1) / 2) * w * 0.34
    const len = w * (0.3 + r() * 0.08)
    for (let j = 0; j < 15; j++) {
      const a = Math.PI * (1.08 + (j / 13) * 0.84) + (r() - 0.5) * 0.08
      const l = len * (0.75 + r() * 0.35)
      d += stroke([[ox, y], [ox + Math.cos(a) * l, y + Math.sin(a) * l * 0.62]], 1 + r() * 0.7, 0.05, 0.6, 0.15)
    }
  }
  return s('g', null,
    s('path', { class: 'p2p-pad', d: blob(x, y - w * 0.1, w * 0.55, w * 0.2, seed, 0.22, 16), filter: 'url(#ink-wash)' }),
    s('path', { class: 'p2p-needle', d }))
}

/** A flame standing on (x, y), k ≈ its height / 22: halo, warm body, bright core. Class `g11-flame` (CSS shows it). */
export function flame(x: number, y: number, k = 1, cls = ''): SVGGElement {
  p2Defs()
  const body = `M${f1(x)} ${f1(y - 22 * k)}C${f1(x + 3 * k)} ${f1(y - 14 * k)} ${f1(x + 7.5 * k)} ${f1(y - 7 * k)} ${f1(x + 5 * k)} ${f1(y - 2 * k)}C${f1(x + 3 * k)} ${f1(y + 1 * k)} ${f1(x - 3 * k)} ${f1(y + 1 * k)} ${f1(x - 5 * k)} ${f1(y - 2 * k)}C${f1(x - 7 * k)} ${f1(y - 8 * k)} ${f1(x - 2 * k)} ${f1(y - 13 * k)} ${f1(x)} ${f1(y - 22 * k)}Z`
  return s('g', { class: `g11-flame ${cls}`.trim() },
    s('circle', { class: 'g11-flame-halo', cx: f1(x), cy: f1(y - 8 * k), r: f1(30 * k), fill: 'url(#p2-lamp)' }),
    s('path', { class: 'g11-flame-body', d: body }),
    s('ellipse', { class: 'g11-flame-core', cx: f1(x), cy: f1(y - 5 * k), rx: f1(2.2 * k), ry: f1(4.4 * k) }))
}

/** A wooden plank (x, y, w, h): a brushed slab with grain, a darker underside and a moonlit top edge. */
export function plank(x: number, y: number, w: number, hh: number, seed: number, cls = 'g11-wood'): SVGGElement {
  const r = rng(seed)
  let grain = ''
  for (let i = 0; i < Math.max(2, Math.round(hh / 4)); i++) {
    const yy = y + hh * (0.25 + r() * 0.6)
    const x0 = x + r() * w * 0.4
    grain += stroke([[x0, yy], [x0 + w * (0.2 + r() * 0.4) * 0.5, yy + (r() - 0.5) * 1.2], [x0 + w * (0.2 + r() * 0.4), yy + (r() - 0.5)]], 0.8 + r() * 0.6, 0.2, 0.3, 0.2)
  }
  return s('g', { class: cls },
    s('path', { class: 'g11-wood-face', d: `M${f1(x)} ${f1(y)}L${f1(x + w)} ${f1(y + 0.6)}L${f1(x + w - 1)} ${f1(y + hh)}L${f1(x + 1)} ${f1(y + hh - 0.4)}Z`, filter: 'url(#ink-rough)' }),
    s('path', { class: 'g11-wood-grain', d: grain }),
    s('path', { class: 'g11-wood-ink', d: stroke([[x - 2, y + hh], [x + w / 2, y + hh + 0.6], [x + w + 2, y + hh]], Math.max(1.4, hh * 0.22), 0.05, 0.05, 0.4), filter: 'url(#ink-rough)' }),
    s('path', { class: 'g11-wood-hi', d: stroke([[x + 2, y + 0.6], [x + w * 0.6, y + 0.4]], 1.2, 0.2, 0.4, 0.2) }))
}

/** A soft ground shadow (bleeding wash ellipse) under something standing at (x, y). */
export const ground = (x: number, y: number, rx: number, ry: number, seed: number, o = 0.2) => wash(blob(x, y, rx, ry, seed, 0.14), o)

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
