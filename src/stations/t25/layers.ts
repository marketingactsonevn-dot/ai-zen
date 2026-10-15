import { h, s } from '../../core/dom'
import { stroke, type Pt } from '../../ui/part2/ink'
import type { SceneCtx } from '../types'
import C from '../../content/tram-25.json'
import { F, dashes, grad, moon, place, rings, stage } from './kit'

/** Scene 1 — a hanging scroll cut through a moonlit pond: surface, current, misty depth. Drop a pebble into each. */
export function layersScene(ctx: SceneCtx) {
  const K = C.scenes.layers
  const n = K.layers.length
  const sunk: number[] = [] // sunk[k] = layer the k-th pebble went to
  const bandMid: Pt[] = []
  const home: Pt[] = []
  let drops: SVGGElement
  let wl = 0
  const pebbles = K.layers.map(() => s('g', { class: 't25l-pb' }))
  const labs = K.layers.map((l) => h('p', { class: 'zk-lab t25l-lab' }, l.label, h('small', null, l.sub)))
  const marks = K.layers.map(() => h('span', { class: 't25l-sunk zk-small', hidden: true }, K.sunk))
  const hits = K.layers.map((l, i) => h('button', { class: 'zk-hit t25l-hit', type: 'button', 'aria-label': l.aria, onClick: () => drop(i) }))
  const sum = h('div', { class: 'zk-note t25l-sum', hidden: true }, ctx.fact(F(K.insight)))

  const { root, svg } = stage(ctx, 't25l', K.art, K.layers.map((l) => l.insight), (W, H) => {
    const land = W / H > 1.1
    const pw = land ? Math.min(W * 0.5, 560) : W - 20
    const px = (W - pw) / 2, py = 10, ph = H - 20
    wl = py + ph * (land ? 0.17 : 0.13)
    const deep = py + ph - 6
    const b1 = wl + (deep - wl) * 0.3, b2 = wl + (deep - wl) * 0.64
    const water = grad(svg, [[0, '--water', 0.34], [0.5, '--water', 0.46], [0.78, '--water', 0.16], [1, '--paper', 0]])
    const mr = Math.min(pw * 0.05, 18)
    const mx = px + pw * 0.24, my = py + (wl - py) * 0.5
    const rib = (y: number, a: number, ph0: number) => Array.from({ length: 13 }, (_, i) => [px + (i / 12) * pw, y + Math.sin(i * 0.7 + ph0) * a] as Pt)
    const cy = (b1 + b2) / 2, cb = b2 - b1
    // the bank on the right, pebbles waiting on it
    const bank: Pt[] = [[px + pw * 0.62, wl + 1], [px + pw * 0.8, wl - 7], [px + pw + 4, wl - 10]]
    const pr = Math.max(7, Math.min(11, pw * 0.022))
    home.length = 0
    for (let k = 0; k < n; k++) home.push([px + pw * (0.74 + k * 0.075), wl - 9 - pr * 0.45 - k * 0.6])
    svg.replaceChildren(
      s('rect', { class: 't25l-paper', x: px, y: py, width: pw, height: ph, rx: 3 }),
      s('rect', { x: px, y: wl, width: pw, height: deep - wl, fill: water }),
      moon(mx, my, mr),
      // the moon broken on the surface, ripples written like strokes of script
      s('path', { class: 'zk-dash', d: Array.from({ length: 6 }, (_, i) => { const y = wl + 6 + i * 7, w = mr * (2.2 - i * 0.28); return stroke([[mx - w / 2, y], [mx + w / 2, y + 0.5]], 2.4 - i * 0.25, 0.3, 0.3) }).join('') }),
      dashes(px + 8, wl + 8, pw - 16, b1 - wl - 16, land ? 22 : 16, 25, 'zk-dash t25l-script'),
      // the current: a silk ribbon of faint ink carrying a leaf
      s('path', { class: 't25l-silk', d: stroke(rib(cy, cb * 0.16, 0), cb * 0.42, 0.2, 0.2, 0.3), filter: 'url(#ink-wash)' }),
      s('path', { class: 't25l-silk2', d: stroke(rib(cy - cb * 0.12, cb * 0.12, 1), 2, 0.2, 0.2) + stroke(rib(cy + cb * 0.16, cb * 0.14, 2.4), 1.6, 0.2, 0.2) }),
      s('path', { class: 't25l-leaf', d: `M${px + pw * 0.3} ${cy}q14 -10 30 -2q-14 10 -30 2Z` }),
      // the depth: mist with no edge
      s('path', { class: 't25l-mist', d: [0, 1, 2, 3].map((i) => stroke(rib(b2 + (deep - b2) * (0.2 + i * 0.2), 4, i * 1.7), (deep - b2) * 0.16, 0.3, 0.3, 0.1)).join(''), filter: 'url(#ink-wash)' }),
      // scroll rods
      s('path', { class: 'k t25l-rod', d: stroke([[px - 8, py], [px + pw + 8, py]], 7, 0.04, 0.04, 0.6) + stroke([[px - 8, py + ph], [px + pw + 8, py + ph]], 8, 0.04, 0.04, 0.6) }),
      s('path', { class: 'k t25l-bank', d: stroke(bank, 3.2, 0.3, 0.05), filter: 'url(#ink-rough)' }),
      drops = s('g'),
      ...pebbles)
    pebbles.forEach((g, k) => {
      g.replaceChildren(s('ellipse', { class: 'zk-sh', cx: 1, cy: pr * 0.5, rx: pr, ry: pr * 0.3 }), s('ellipse', { class: 't25l-stone', cx: 0, cy: 0, rx: pr, ry: pr * 0.62 }))
      g.style.transform = `translate(${home[k][0]}px, ${home[k][1]}px)`
    })
    const tops = [wl, b1, b2, deep]
    const labW = Math.min(pw * 0.62, 260)
    K.layers.forEach((_, i) => {
      const y0 = tops[i], y1 = tops[i + 1]
      bandMid[i] = [px + pw * (0.56 + i * 0.1), (y0 + y1) / 2 + (i === 2 ? -(y1 - y0) * 0.18 : 0)]
      place(hits[i], px, y0, pw)
      hits[i].style.height = `${y1 - y0}px`
      place(labs[i], px + 12, y0 + (i ? 10 : 12), labW)
    })
    sunk.forEach((li, k) => {
      pebbles[k].style.transform = `translate(${bandMid[li][0] + k * 3}px, ${bandMid[li][1]}px)`
    })
    place(sum, px + 12, b2 + (deep - b2) * (land ? 0.42 : 0.5), pw - 24)
  })
  root.append(...hits, ...labs, sum)
  labs.forEach((l, i) => l.append(marks[i]))
  ctx.prompt(K.prompt)

  function drop(i: number) {
    const layer = K.layers[i]
    if (!sunk.includes(i)) {
      const k = sunk.length
      sunk.push(i)
      const [x, y] = bandMid[i]
      pebbles[k].classList.add('in')
      pebbles[k].style.transform = `translate(${x + k * 3}px, ${y}px)`
      drops.append(rings(x, wl, 10, 3, 3, 'zk-ring t25l-splash'))
      marks[i].hidden = false
      ctx.chime('tap')
    }
    ctx.insight(F(layer.insight), F(layer.detail))
    if (sunk.length === n) sum.hidden = false
  }
}
