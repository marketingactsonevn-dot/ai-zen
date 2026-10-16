import raw from '../../content/tram-21.json'
import { h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { curve, onSize, p2Defs, stableHeight, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist, moon } from '../../ui/part2/paint'
import { bough, track } from './art'
import { figure } from './robot'

const R = raw.scenes.strings

/** Scene 2 · pulled by strings or running alone: flip the switch and silver threads appear between a pine branch and one runner. */
export function stringsScene(ctx: SceneCtx) {
  p2Defs()
  const stableH = stableHeight(ctx, [R.insight as Fact])
  const base = 226
  // two ink robots in stride; the left one's head, hands and knee are tied to the bar of the person on the pine bough
  const k = 1.15
  const A: Pt = [130, base], B: Pt = [290, base]
  const tie = (p: Pt): Pt => [A[0] + p[0] * k, A[1] + p[1] * k]
  const ends = ([[3, -96], [26, -58], [-12, -50], [12, -24]] as Pt[]).map(tie)
  const bar: Pt[] = [[112, 82], [146, 80]]
  const strings = s('path', { class: 't21s-strings', d: ends.map(([x, y], i) => `M${(bar[0][0] + (i * (bar[1][0] - bar[0][0])) / 3).toFixed(1)} ${(bar[0][1] + i * -0.6).toFixed(1)}L${x.toFixed(1)} ${y.toFixed(1)}`).join('') })
  const sitter =
    stroke(curve([108, 31], [120, 22], [132, 31], 8), 3.2, 0.15, 0.15, 0.4) + // conical hat
    stroke(curve([119, 40], [116, 56], [124, 66], 8), 13, 0.2, 0.15, 0.6) + // robe, sitting on the bough
    stroke(curve([124, 64], [136, 68], [138, 80], 6), 4.4, 0.1, 0.3, 0.4) + // legs over the edge
    stroke(curve([118, 46], [111, 62], [113, 80], 6), 3, 0.1, 0.3, 0.3) + stroke(curve([123, 46], [136, 60], [144, 79], 6), 3, 0.1, 0.3, 0.3) + // arms down to the bar
    stroke(bar, 3, 0.1, 0.1, 0.6)
  const art = s('svg', { class: 't21s-svg', viewBox: '0 0 400 260', preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true' },
    mist(240, 150, 240, 80),
    moon(334, 52, 18, 2101, true),
    hills(-20, 420, base - 14, 70, 2102, 0.85, 6),
    mist(200, base - 10, 230, 22),
    ...track(400, base, 2103),
    bough(176, 56, 2104),
    s('circle', { class: 't21-ink', cx: 120, cy: 35, r: 5 }),
    s('path', { class: 't21-ink', d: sitter, filter: 'url(#ink-rough)' }),
    strings,
    s('g', { transform: `translate(${A[0]} ${A[1]}) scale(${k})` }, s('g', { class: 't21-runner' }, figure('run'))),
    s('g', { transform: `translate(${B[0]} ${B[1]}) scale(${k})` }, s('g', { class: 't21-runner t21-b' }, figure('run'))))

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
