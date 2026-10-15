import { fill, h, s } from '../../core/dom'
import { rng, stroke } from '../../ui/part2/ink'
import type { SceneCtx } from '../types'
import { C } from './content'
import { F } from '../t34/night'

const K = C.scenes.pens
type Draw = () => SVGElement[]
const st = (css: string) => ({ style: css })

/** The same koi pond, painted with five pens (viewBox 240 × 160). */
const PAINT: Record<string, Draw> = {
  // charcoal: thin outlines only
  canvas: () => [
    s('ellipse', { cx: 120, cy: 86, rx: 96, ry: 54, ...st('fill:none;stroke:var(--ink);stroke-width:1') }),
    s('circle', { cx: 190, cy: 30, r: 12, ...st('fill:none;stroke:var(--ink);stroke-width:1') }),
    s('path', { d: 'M92 88 Q118 70 146 84 Q120 100 92 88Z M92 88 l-14 -9 l2 18Z', ...st('fill:none;stroke:var(--vermilion);stroke-width:1.2') }),
  ],
  // p5: loose, generative colour blobs
  p5: () => {
    const r = rng(5)
    const dots = Array.from({ length: 36 }, (_, i) => s('circle', { cx: 30 + r() * 180, cy: 40 + r() * 96, r: 3 + r() * 10, ...st(`fill:var(${i % 3 ? '--water' : '--moss'});opacity:${(0.25 + r() * 0.3).toFixed(2)}`) }))
    return [...dots,
      s('circle', { cx: 188, cy: 32, r: 16, ...st('fill:var(--moon);opacity:.85') }),
      s('path', { d: stroke([[86, 92], [110, 80], [140, 86], [156, 82]], 16, 0.3, 0.5, 0.2), ...st('fill:var(--vermilion);opacity:.8') })]
  },
  // phaser: tiles and sprites on a grid
  phaser: () => {
    const out: SVGElement[] = []
    for (let y = 40; y < 150; y += 12) for (let x = 20; x < 220; x += 12) out.push(s('rect', { x, y, width: 11, height: 11, ...st(`fill:var(--water);opacity:${(x + y) % 24 ? 0.32 : 0.48}`) }))
    for (const [x, y] of [[100, 88], [112, 88], [124, 88], [136, 88], [112, 76], [124, 100], [88, 88]]) out.push(s('rect', { x, y, width: 11, height: 11, ...st('fill:var(--vermilion)') }))
    for (const [x, y] of [[184, 16], [196, 16], [184, 28], [196, 28]]) out.push(s('rect', { x, y, width: 11, height: 11, ...st('fill:var(--moon)') }))
    return out
  },
  // three: depth, light and a cast shadow
  three: () => [
    ...[0, 1, 2, 3, 4].map((i) => s('path', { d: `M${120 + (i - 2) * 22} 46 L${120 + (i - 2) * 70} 156`, ...st('stroke:var(--ink);stroke-opacity:.15;stroke-width:1') })),
    ...[60, 86, 118].map((y, i) => s('path', { d: `M${70 - i * 26} ${y} H${170 + i * 26}`, ...st('stroke:var(--ink);stroke-opacity:.12;stroke-width:1') })),
    s('ellipse', { cx: 128, cy: 120, rx: 36, ry: 7, ...st('fill:var(--umbra);opacity:.35') }),
    s('ellipse', { cx: 120, cy: 92, rx: 34, ry: 14, fill: 'url(#t36p-ball)' }),
    s('circle', { cx: 190, cy: 30, r: 13, fill: 'url(#p2-halo)' }),
    s('circle', { cx: 190, cy: 30, r: 8, ...st('fill:var(--moon)') }),
  ],
  // engine: the big framed piece, with a title bar like an app window
  engine: () => [
    s('rect', { x: 8, y: 8, width: 224, height: 144, rx: 4, ...st('fill:var(--water);opacity:.3') }),
    s('rect', { x: 8, y: 8, width: 224, height: 144, rx: 4, ...st('fill:none;stroke:var(--ink);stroke-opacity:.8;stroke-width:6') }),
    s('rect', { x: 8, y: 8, width: 224, height: 16, ...st('fill:var(--ink);opacity:.8') }),
    s('circle', { cx: 190, cy: 46, r: 12, ...st('fill:var(--moon)') }),
    s('path', { d: 'M86 98 Q118 74 152 92 Q120 116 86 98Z M86 98 l-18 -12 l3 24Z', ...st('fill:var(--vermilion)') }),
    s('path', { d: stroke([[30, 130], [120, 124], [210, 132]], 3, 0.2, 0.3), ...st('fill:var(--ink);opacity:.35') }),
  ],
}

/** Scene 2 — a bamboo pen pot: the same koi pond drawn five times, once per pen (canvas, p5, Phaser, Three.js, engine). */
export function pensScene(ctx: SceneCtx) {
  const seen = new Set<number>()
  const sources = C.sources as Record<string, { url?: string }>
  const canvas = s('svg', { class: 't36p-art', viewBox: '0 0 240 160', 'aria-hidden': 'true' },
    s('defs', null, s('radialGradient', { id: 't36p-ball', cx: 0.35, cy: 0.3 },
      s('stop', { offset: 0, style: 'stop-color:var(--moon)' }), s('stop', { offset: 0.5, style: 'stop-color:var(--vermilion)' }), s('stop', { offset: 1, style: 'stop-color:var(--umbra)' }))))
  const layer = s('g')
  canvas.append(layer)
  const card = h('div', { class: 't36p-card', 'aria-live': 'polite' })
  const pens = K.pens.map((p, i) =>
    h('button', { class: `t36p-pen t36p-${p.id}`, type: 'button', 'aria-pressed': 'false', 'aria-label': fill(K.penAria, { name: p.name }), onClick: () => pick(i) },
      h('span', { class: 't36p-shaft', 'aria-hidden': 'true' }), h('span', { class: 't36p-name' }, p.name)))
  const root = h('div', { class: 't36 t36p' }, h('p', { class: 'visually-hidden' }, K.art),
    h('div', { class: 't36p-pot', role: 'group', 'aria-label': K.group }, ...pens),
    h('div', { class: 't36p-frame' }, canvas),
    card)
  ctx.art.append(root)
  ctx.prompt(K.prompt)
  layer.append(...PAINT.canvas().map((el) => (el.setAttribute('opacity', '0.35'), el)))

  function pick(i: number) {
    const p = K.pens[i]
    seen.add(i)
    pens.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)))
    layer.replaceChildren(...PAINT[p.id]())
    layer.classList.remove('in')
    void canvas.getBoundingClientRect()
    layer.classList.add('in')
    ctx.chime('tap')
    const url = sources[p.source]?.url
    card.replaceChildren(
      h('h3', { class: 't36p-title' }, p.name),
      h('p', null, h('span', { class: 'p2-eyebrow' }, K.fitsLabel), h('br'), p.fits),
      h('p', null, h('span', { class: 'p2-eyebrow' }, K.askLabel), h('br'), h('q', { class: 't36p-ask' }, p.ask.replace(/^[“"]|[”"]$/g, ''))),
      p.id === 'phaser' ? ctx.fact(F(K.facts[0]), 'p', 't36p-fact') : '',
      url ? h('a', { class: 't36p-docs', href: url, target: '_blank', rel: 'noopener' }, K.docsLabel) : '')
    if (seen.size === K.pens.length) ctx.insight(F(K.insight), K.detail)
  }
}
