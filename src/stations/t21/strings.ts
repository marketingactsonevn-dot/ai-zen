import raw from '../../content/tram-21.json'
import { h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { blob, onSize, p2Defs, stableHeight, stroke, type Pt } from '../../ui/part2/ink'

const R = raw.scenes.strings

/** A running ink robot standing on y = 0 at x; returns the group and where its head and hands are (for the strings). */
export function runner(x: number, cls: string) {
  const at = (p: Pt): Pt => [x + p[0], p[1]]
  const limb = (pts: Pt[], w: number) => stroke(pts.map(at), w, 0.05, 0.25, 0.45)
  const d =
    limb([[0, -70], [1, -54], [3, -38]], 7) +
    limb([[0, -64], [-11, -53], [-5, -41]], 4) +
    limb([[0, -64], [12, -57], [21, -64]], 4) +
    limb([[3, -38], [-9, -21], [-19, -4]], 5) +
    limb([[3, -38], [13, -22], [9, 0]], 5)
  const g = s('g', { class: `t21-runner ${cls}` },
    s('ellipse', { class: 't21-shadow', cx: x, cy: 2, rx: 22, ry: 3 }),
    s('path', { class: 't21-body', d }),
    s('rect', { class: 't21-body', x: x - 7, y: -86, width: 14, height: 14, rx: 4 }),
    s('rect', { class: 't21-visor', x: x - 4, y: -82, width: 9, height: 3.4, rx: 1.4 }))
  return { g, head: at([0, -86]), hands: [at([-5, -41]), at([21, -64])] as Pt[], knee: at([13, -22]) }
}

/** Scene 2 · pulled by strings or running alone: flip the switch and silver threads appear between a pine branch and one runner. */
export function stringsScene(ctx: SceneCtx) {
  p2Defs()
  const stableH = stableHeight(ctx, [R.insight as Fact])
  const base = 226
  const a = runner(130, 't21-a')
  const b = runner(290, 't21-b')
  const hand: Pt = [128, 72]
  const strings = s('path', { class: 't21s-strings', d: [a.head, ...a.hands, a.knee].map(([x, y]) => `M${hand[0]} ${hand[1]}L${x} ${y + base}`).join('') })
  const art = s('svg', { class: 't21s-svg', viewBox: '0 0 400 260', preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true' },
    s('circle', { cx: 334, cy: 52, r: 60, fill: 'url(#p2-halo)' }),
    s('circle', { class: 't21-moon', cx: 334, cy: 52, r: 20 }),
    s('path', { class: 't21-mist', d: blob(200, 236, 186, 16, 21, 0.1) }),
    s('path', { class: 't21-ink', d: stroke([[-10, 34], [50, 46], [100, 54], [150, 50], [176, 58]], 7, 0.02, 0.4) }),
    ...[[40, 36], [92, 44], [150, 42], [176, 52]].map(([x, y], i) => s('path', { class: 't21-pine', d: blob(x, y, 26 - i * 3, 9, 30 + i, 0.25) })),
    // the person on the branch, holding the control bar
    s('circle', { class: 't21-ink', cx: 120, cy: 36, r: 5 }),
    s('path', { class: 't21-ink', d: stroke([[120, 41], [121, 52]], 6, 0.1, 0.1) + stroke([[121, 46], [126, 58], [128, 70]], 2.6, 0.1, 0.2) + stroke([[121, 52], [112, 60], [116, 70]], 3, 0.1, 0.3) }),
    s('path', { class: 't21-ink', d: stroke([[118, 72], [138, 72]], 2.2, 0.1, 0.1) }),
    s('path', { class: 't21-track', d: stroke([[0, base + 2], [200, base], [400, base + 3]], 1.6, 0.05, 0.05) + stroke([[20, base + 16], [380, base + 18]], 1, 0.1, 0.1) }),
    strings,
    s('g', { transform: `translate(0 ${base})` }, a.g, b.g))

  const toggle = h('button', { class: 't21s-toggle', type: 'button', 'aria-pressed': 'false', 'aria-label': R.toggleAria, onClick: flip },
    h('span', { class: 't21s-switch', 'aria-hidden': 'true' }), R.toggle)
  const tag = (label: string, time: string, note: string, cls: string) =>
    h('div', { class: `t21s-tag ${cls}` }, h('p', { class: 'p2-eyebrow' }, label), h('p', { class: 't21s-time' }, time), h('p', { class: 't21s-note' }, note))
  const tags = h('div', { class: 't21s-tags' }, tag(R.remoteLabel, R.remoteTime, R.remoteNote, 'remote'), tag(R.autoLabel, R.autoTime, R.autoNote, 'auto'))
  const facts = h('ul', { class: 't21s-facts' }, ...R.facts.map((f) => ctx.fact(f as Fact, 'li')))
  const reveal = h('div', { class: 't21s-reveal' }, tags, facts)
  reveal.setAttribute('aria-hidden', 'true')
  const root = h('div', { class: 't21 t21s' }, h('div', { class: 't21s-stage' }, art), toggle, reveal)
  if (ctx.reduced || ctx.quality === 'low') root.classList.add('still')
  ctx.art.append(root)
  ctx.prompt(R.prompt)
  ctx.onCleanup(onSize(ctx.art, () => {
    root.style.height = `${stableH(ctx.art.clientHeight)}px`
  }))

  let first = true
  function flip() {
    const on = toggle.getAttribute('aria-pressed') !== 'true'
    toggle.setAttribute('aria-pressed', String(on))
    root.classList.toggle('wired', on)
    ctx.chime(on ? 'tap' : 'soft')
    if (!first) return
    first = false
    root.classList.add('shown')
    reveal.removeAttribute('aria-hidden')
    ctx.insight(R.insight as Fact)
  }
}
