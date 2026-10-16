import raw from '../../content/tram-32.json'
import { h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { codeScroll } from '../../ui/part2/code'
import { onSize } from '../../ui/part2/ink'
import type { CodeScroll } from '../../ui/part2/types'
import type { SceneCtx } from '../types'
import { cardSheet, curve, flame, ground, needles, plank, room, stroke } from '../t31/kit'

const K = raw.scenes.scroll
const f1 = (n: number) => (Math.round(n * 10) / 10).toString()

/** The rolled scroll on its rod (px W × 60): a cord from a nail to both ends, the wooden rod, the paper rolled thick under it. */
function paintRod(svg: SVGSVGElement, W: number) {
  const y = 30
  svg.setAttribute('viewBox', `0 0 ${f1(W)} 60`)
  svg.replaceChildren(
    s('path', { class: 'g11-thread t32x-hang', d: `M${f1(W * 0.1)} ${y - 2}L${f1(W / 2)} 4L${f1(W * 0.9)} ${y - 2}` }),
    s('circle', { class: 't32x-nail', cx: f1(W / 2), cy: 4, r: 2.6 }),
    plank(W * 0.03, y - 4, W * 0.94, 7, 3290, 'g11-wood t32x-bar'),
    // the paper rolled up under the rod: a fat roll, its spiral ends, a silk band
    s('rect', { class: 't32x-roll', x: f1(W * 0.05), y: y + 4, width: f1(W * 0.9), height: 18, rx: 9 }),
    s('rect', { class: 't32x-band', x: f1(W * 0.05), y: y + 4, width: f1(W * 0.9), height: 5, rx: 2.5 }),
    s('path', { class: 'g11-wash t32x-rollink', d: stroke([[W * 0.05, y + 22], [W / 2, y + 22.6], [W * 0.95, y + 22]], 1.6, 0.05, 0.05, 0.4) + stroke(curve([W * 0.05 + 9, y + 6], [W * 0.05 + 3, y + 13], [W * 0.05 + 9, y + 20], 6), 1.2, 0.1, 0.1, 0.4), filter: 'url(#ink-rough)' }),
    s('path', { class: 'g11-moonlit', d: stroke([[W * 0.07, y + 8], [W * 0.93, y + 8]], 1.4, 0.1, 0.1, 0.3) }),
    s('path', { class: 't32x-knob', d: stroke([[2, y - 0.5], [W * 0.035, y - 0.5]], 11, 0.2, 0.2, 0.7) + stroke([[W * 0.965, y - 0.5], [W - 2, y - 0.5]], 11, 0.2, 0.2, 0.7), filter: 'url(#ink-rough)' }))
}

/**
 * The low writing desk under the scroll (viewBox 0 0 640 150): an inkstone and a brush on its rest, a vase with a pine
 * twig, and the oil lamp whose glow climbs the wall to the scroll.
 */
function desk(): SVGSVGElement {
  const dish = `M452 96Q456 108 478 109Q498 108 504 98L512 94Q508 92 502 94Q480 99 454 93Q451 93 452 96Z`
  return s('svg', { class: 't32x-desk g11-free', viewBox: '0 0 640 150', 'aria-hidden': 'true' },
    s('circle', { cx: 508, cy: 80, r: 200, fill: 'url(#p2-lamp)', class: 't32x-glow' }),
    ground(320, 140, 300, 8, 3294, 0.24),
    // legs, apron and top
    s('path', { class: 't32t-leg', d: stroke([[90, 118], [88, 140]], 9, 0.02, 0.02, 0.8) + stroke([[550, 118], [552, 140]], 9, 0.02, 0.02, 0.8), filter: 'url(#ink-rough)' }),
    s('path', { class: 'g11-wash t32t-apron', d: stroke([[70, 120], [320, 121], [570, 120]], 4, 0.02, 0.02, 0.7), filter: 'url(#ink-rough)' }),
    plank(50, 108, 540, 11, 3295),
    // inkstone with its well of ink, a brush on a rest
    s('path', { class: 't32x-inkstone', d: 'M150 108Q148 96 172 95L236 95Q258 96 256 108Z', filter: 'url(#ink-rough)' }),
    s('ellipse', { class: 't32x-ink', cx: 182, cy: 99, rx: 18, ry: 3 }),
    s('path', { class: 'g11-moonlit', d: stroke([[160, 97], [200, 95.6]], 1.2, 0.2, 0.3, 0.2) }),
    s('path', { class: 'g11-wood-face', d: 'M282 108l2 -8h6l2 8ZM330 108l2 -8h6l2 8Z' }),
    s('path', { class: 't32x-brush', d: stroke([[268, 100], [350, 98]], 3.2, 0.05, 0.05, 0.6) + stroke([[350, 98], [366, 97.4]], 5, 0.1, 0.9, 0.2), filter: 'url(#ink-rough)' }),
    // a narrow vase, a pine twig leaning out of it
    s('path', { class: 't32x-vase', d: 'M392 108Q384 92 392 80Q396 70 394 62L404 62Q402 70 406 80Q414 92 406 108Z', filter: 'url(#ink-rough)' }),
    s('path', { class: 'p2p-trunk', d: stroke(curve([399, 64], [404, 34], [432, 18], 8), 2.4, 0.05, 0.6, 0.3), filter: 'url(#ink-rough)' }),
    needles(430, 20, 46, 3296),
    // the oil lamp at the desk's end
    s('path', { class: 't32l-glaze', d: `M468 108L465 109H492L488 108Z` + dish, filter: 'url(#ink-rough)' }),
    s('path', { d: dish, fill: 'url(#p2-shade)' }),
    s('path', { class: 'g11-wash t32l-wick', d: stroke(curve([482, 97], [498, 92], [508, 90], 8), 2.4, 0.1, 0.2, 0.4) }),
    flame(509, 90, 0.7))
}

/** A silk tassel on a cord (viewBox 0 0 30 60): the pull. */
const tassel = () => s('svg', { class: 't32x-tassel', viewBox: '0 0 30 60', 'aria-hidden': 'true' },
  s('path', { class: 'g11-thread', d: 'M15 0V20' }),
  s('circle', { class: 't32x-knot', cx: 15, cy: 23, r: 4 }),
  s('path', { class: 't32x-silk', d: stroke([[15, 26], [10, 54]], 2, 0.1, 0.5, 0.3) + stroke([[15, 26], [13, 56]], 2, 0.1, 0.5, 0.3) + stroke([[15, 26], [16, 57]], 2, 0.1, 0.5, 0.3) + stroke([[15, 26], [20, 54]], 2, 0.1, 0.5, 0.3) + stroke([[12, 30], [18, 30]], 3, 0.1, 0.1, 0.5) }))

/** Scene 4 — a calligraphy scroll on the bamboo wall under an oil lamp; pull the cord and it unrolls into four Ollama commands. */
export function scrollScene(ctx: SceneCtx) {
  const fold = h('div', { class: 't32x-fold' }, h('div', { class: 't32x-inner' }, codeScroll(K.code as CodeScroll)))
  const cord = h('button', { class: 't32x-cord', type: 'button', 'aria-expanded': 'false', 'aria-label': K.prompt }, tassel(), h('span', null, K.prompt))
  const note = h('p', { class: 't32x-note', hidden: true }, K.modelNote)
  const rod = s('svg', { class: 't32x-rod', 'aria-hidden': 'true' })
  const root = h('div', { class: 'g11 t32x', role: 'group', 'aria-label': K.aria },
    room(3293),
    desk(),
    h('p', { class: 'visually-hidden' }, K.art),
    rod,
    fold, cord, note)
  ctx.art.append(root)
  ctx.onCleanup(onSize(rod, () => paintRod(rod, rod.clientWidth)))
  const sheet = cardSheet(root, K.takeaway, ctx.onCleanup)
  cord.addEventListener('click', () => {
    root.classList.add('open')
    cord.hidden = true
    note.hidden = false
    ctx.chime('soft')
    ctx.insight(K.insight as Fact, K.detail as Fact)
    sheet.show()
    ;(fold.querySelector('pre, [tabindex]') as HTMLElement | null)?.focus({ preventScroll: true })
  })
  ctx.prompt(K.prompt)
}
