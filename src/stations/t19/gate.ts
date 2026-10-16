import raw from '../../content/tram-19.json'
import { h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { blob, curve, onSize, p2Defs, rng, stableHeight, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist, moon, reeds, toro, wash, water } from '../../ui/part2/paint'

/** Several short brushed lines [x0, y0, x1, y1] as one path. */
const brushLines = (ls: number[][], w: number) => ls.map(([a, b, c, d]) => stroke([[a, b], [c, d]], w, 0.15, 0.15, 0.4)).join('')

const G = raw.scenes.gate

/** Scene 2 · the fenced summit: a bamboo fence round the highest peak; open the gate to see why it is fenced. */
export function gateScene(ctx: SceneCtx) {
  p2Defs()
  const stableH = stableHeight(ctx, [G.insight as Fact])

  const r = rng(1919)
  // bamboo fence on a shallow arc round the summit's foot, a gap in the middle for the gate
  let posts = '', nodes = ''
  for (let x = 92; x <= 308; x += 9 + r() * 4) {
    if (x > 181 && x < 219) continue
    const y = 210 - Math.cos(((x - 200) / 110) * 1.2) * 8
    const hh = 40 + r() * 10
    posts += stroke([[x, y + 2], [x + (r() - 0.5) * 1.5, y - hh / 2], [x + (r() - 0.5) * 2, y - hh]], 4.2, 0.04, 0.06, 0.6)
    nodes += stroke([[x - 2.6, y - hh * 0.62], [x + 2.6, y - hh * 0.6]], 1.4, 0.2, 0.2, 0.3)
  }
  const rail = (y: number) => stroke([[88, y + 4], [150, y - 2], [182, y - 3]], 2.4, 0.05, 0.12, 0.3) + stroke([[218, y - 3], [250, y - 2], [312, y + 4]], 2.4, 0.12, 0.05, 0.3)
  const door = (side: 'l' | 'r') => {
    const x = side === 'l' ? 182 : 200
    return s('g', { class: `t19g-door t19g-door-${side}` },
      s('rect', { class: 't19g-plank', x, y: 156, width: 18, height: 50 }),
      s('path', { class: 't19g-lattice', d: brushLines([[x + 2, 168, x + 16, 168], [x + 2, 181, x + 16, 181], [x + 2, 194, x + 16, 194], [x + 9, 158, x + 9, 204]], 1.2), filter: 'url(#ink-rough)' }),
      s('path', { class: 't19g-door-ink', d: brushLines([[x, 156, x + 18, 156], [x + (side === 'l' ? 0 : 18), 156, x + (side === 'l' ? 0 : 18), 206]], 2), filter: 'url(#ink-rough)' }))
  }
  // the wall of code the workers patch: courses of short strokes, a red crack, fresh mortar
  let code = ''
  const rows = [[184, 52], [174, 46], [164, 39], [154, 31], [144, 23]]
  rows.forEach(([y, w], i) => {
    for (let x = 200 - w; x < 200 + w - 3; ) {
      const len = 3 + r() * 7
      code += stroke([[x, y + (r() - 0.5)], [x + len, y + (r() - 0.5)]], 1.6 + (i % 2) * 0.4, 0.2, 0.2, 0.4)
      x += len + 2 + r() * 3
    }
  })
  const crack: Pt[] = [[197, 136], [203, 144], [198, 153], [205, 163], [199, 176]]
  // a worker: a few strokes — hat, bent back, an arm with the trowel to the wall
  const worker = (x: number, y: number, dir: number) => s('path', { class: 't19g-worker', d:
    stroke([[x - 4 * dir, y - 15], [x, y - 17.5], [x + 4 * dir, y - 15]], 2.2, 0.2, 0.2, 0.3) +
    stroke([[x, y - 14], [x + dir * 2, y - 8], [x + dir * 1, y]], 3.4, 0.05, 0.3, 0.4) +
    stroke([[x + dir * 1, y - 11], [x + dir * 6, y - 9], [x + dir * 9, y - 12]], 1.4, 0.1, 0.3, 0.3),
    filter: 'url(#ink-rough)' })

  const art = s('svg', { class: 't19g-svg', viewBox: '0 0 400 290', preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true' },
    mist(200, 150, 260, 120),
    moon(300, 58, 21, 19, true),
    hills(-30, 430, 214, 92, 191, 0.88, 6),
    hills(-10, 160, 222, 70, 192, 0.6, 2),
    hills(250, 420, 222, 64, 193, 0.62, 2),
    hills(78, 322, 224, 168, 194, 0.12, 1),
    mist(200, 214, 230, 26),
    s('g', { class: 't19g-inside' },
      s('path', { class: 't19g-code', d: code }),
      s('path', { class: 't19g-crack', d: stroke(crack, 2.4, 0.2, 0.3), filter: 'url(#ink-rough)' }),
      s('path', { class: 't19g-patch', d: stroke([[192, 141], [206, 141]], 2.4, 0.3, 0.3) + stroke([[193, 158], [208, 157]], 2.4, 0.3, 0.3) + stroke([[192, 170], [205, 170]], 2.2, 0.3, 0.3) }),
      worker(184, 194, 1),
      worker(217, 190, -1),
      toro(160, 206, 30, true),
      toro(240, 206, 30, true)),
    wash(blob(200, 214, 150, 12, 1901, 0.1), 0.18),
    s('path', { class: 't19g-post', d: posts, filter: 'url(#ink-rough)' }),
    s('path', { class: 't19g-node', d: nodes }),
    s('path', { class: 't19g-rail', d: rail(172) + rail(192), filter: 'url(#ink-rough)' }),
    door('l'),
    door('r'),
    s('path', { class: 't19g-latch', d: stroke([[178, 182], [200, 181], [222, 182]], 3, 0.1, 0.1, 0.5), filter: 'url(#ink-rough)' }),
    wash(blob(200, 262, 120, 16, 1902, 0.12), 0.08),
    s('ellipse', { class: 't19g-pool', cx: 200, cy: 256, rx: 66, ry: 14 }),
    water(136, 246, 264, 268, 1903, 210, false),
    s('path', { class: 't19g-pool-rim', d: stroke(curve([136, 254], [200, 274], [266, 255], 16), 2.2, 0.15, 0.2, 0.2), filter: 'url(#ink-rough)' }),
    reeds(128, 258, 24, 1904, 6),
    grass(276, 262, 18, 1905),
    ...([[118, 264, 30, 19], [156, 281, 23, 15], [246, 281, 25, 16], [284, 264, 31, 20]] as const).map(([x, y, w, hh], i) =>
      s('g', { transform: `translate(${x} ${y})` }, stoneArt(w, hh, 1900 + i * 17))))

  const stage = h('button', { class: 't19g-stage', type: 'button', 'aria-label': G.gateAria, 'aria-expanded': 'false', onClick: open }, art)
  const card = h('div', { class: 't19g-card' },
    h('p', { class: 'p2-eyebrow' }, G.reasonTitle),
    ctx.fact(G.reason as Fact, 'p', 't19g-reason'))
  card.setAttribute('aria-hidden', 'true')
  const root = h('div', { class: 't19 t19g' }, stage, card)
  ctx.art.append(root)
  ctx.prompt(G.prompt)
  ctx.onCleanup(onSize(ctx.art, () => {
    root.style.height = `${stableH(ctx.art.clientHeight)}px`
  }))

  function open() {
    if (root.classList.contains('open')) return
    root.classList.add('open')
    stage.setAttribute('aria-expanded', 'true')
    card.removeAttribute('aria-hidden')
    ctx.chime('soft')
    ctx.insight(G.insight as Fact, G.detail as Fact)
  }
}
