import { fill, h, s } from '../../core/dom'
import { curve, rng, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist, moon, pine } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import { C, shell } from './shell'
import { along, bamboo, dawnGlow, fog, lines, rakeD, stonesOn } from '../t37/sumi'

const K = C.scenes.fork
type Id = 'speed' | 'share' | 'control'
const lv = (v: number) => (v < 34 ? 'low' : v > 66 ? 'high' : 'mid')
const GX = 200, GB = 150 // the garden at the end of the path stands on the far ground at GB

/** The five gardens that can wait at the end of the path (one shows at a time). */
function gardens() {
  const r = rng(38)
  const g = (id: string, ...kids: (SVGElement | string)[]) => s('g', { class: 't38f-garden', 'data-id': id }, ...kids)
  // wild forest: crooked pines crowding, tall grass everywhere
  let weeds = ''
  const wildTrees = ([[128, 40, 1], [154, 54, -1], [184, 36, 1], [222, 58, -1], [252, 44, 1], [280, 34, -1]] as const).map(([x, hh, dir], i) => pine(x, GB + 1, hh, 3800 + i * 7, dir))
  for (let i = 0; i < 46; i++) {
    const x = GX - 92 + r() * 184, hh = 8 + r() * 14
    weeds += stroke(curve([x, GB + 2], [x + (r() - 0.5) * 6, GB - hh * 0.6], [x + (r() - 0.5) * 10, GB - hh], 5), 1 + r() * 0.8, 0.05, 0.7, 0.1)
  }
  // terraces: even steps of field, each holding a sliver of sky
  let banks = '', glints = ''
  for (let i = 0; i < 5; i++) {
    const y = GB - i * 8.5, half = 92 - i * 12
    banks += stroke(curve([GX - half, y], [GX, y - 4], [GX + half, y], 16), 2.2, 0.1, 0.1, 0.4)
    glints += stroke([[GX - half * 0.5 + r() * 20, y - 3.5], [GX - half * 0.1 + r() * 20, y - 4]], 1, 0.3, 0.3, 0.2) + stroke([[GX + half * 0.2 + r() * 10, y - 3.2], [GX + half * 0.55, y - 3.4]], 0.9, 0.3, 0.3, 0.2)
  }
  // drift: only veils
  const veils = [0, 1, 2, 3].map((i) => fog(GX - 50 + i * 34, GB - 10 - (i % 2) * 10, 60, 9))
  return [
    g('wild', ...wildTrees, s('path', { class: 't38f-weed', d: weeds })),
    g('commons',
      ...[132, 268].map((x, i) => pine(x, GB, 30, 3810 + i, i ? -1 : 1)),
      s('path', { class: 'g13-ink', d: lines([[130, GB, 130, GB - 14], [164, GB, 164, GB - 12], [236, GB, 236, GB - 12], [270, GB, 270, GB - 14]], 2) + lines([[112, GB - 4, 186, GB - 4], [214, GB - 4, 288, GB - 4], [112, GB - 9, 186, GB - 9], [214, GB - 9, 288, GB - 9]], 1.3) + lines([[188, GB + 1, 188, GB - 22], [212, GB + 1, 212, GB - 22], [184, GB - 21, 216, GB - 21]], 2.6) + lines([[188, GB - 2, 178, GB - 6], [212, GB - 2, 222, GB - 6]], 2), filter: 'url(#ink-rough)' }),
      s('path', { class: 't38f-open', d: `M195 ${GB}L205 ${GB}L208 ${GB + 10}L192 ${GB + 10}Z` })),
    g('walled',
      pine(170, GB - 20, 34, 3820, 1), pine(230, GB - 20, 40, 3821, -1),
      s('path', { class: 't38f-wall', d: `M112 ${GB}L112 ${GB - 24}L288 ${GB - 24}L288 ${GB}Z`, filter: 'url(#ink-rough)' }),
      s('path', { class: 't38f-wall-base', d: `M112 ${GB}L112 ${GB - 6}L288 ${GB - 6}L288 ${GB}Z` }),
      s('path', { class: 't38f-wall-tex', d: lines(Array.from({ length: 16 }, (_, i) => [118 + i * 11, GB - 5.5, 118 + i * 11, GB - 0.5]), 0.8) + lines(Array.from({ length: 22 }, (_, i) => [110 + i * 8.4, GB - 27, 113 + i * 8.4, GB - 24.5]), 1.2) }),
      s('path', { class: 'g13-ink', d: stroke([[106, GB - 25], [200, GB - 27], [294, GB - 25]], 4, 0.05, 0.05, 0.5) + stroke([[110, GB - 28], [200, GB - 30], [290, GB - 28]], 1.4, 0.1, 0.1, 0.4) + lines([[193, GB, 193, GB - 18], [207, GB, 207, GB - 18], [193, GB - 18, 207, GB - 18]], 1.6), filter: 'url(#ink-rough)' }),
      s('path', { class: 't38f-door', d: `M194 ${GB}V${GB - 17}H206V${GB}Z` })),
    g('terraces', s('path', { class: 't38f-terrace', d: banks, filter: 'url(#ink-rough)' }), s('path', { class: 't38f-glint', d: glints })),
    g('drift', ...veils, s('path', { class: 't38f-wisp', d: lines([[140, GB - 14, 190, GB - 16], [176, GB - 26, 236, GB - 27], [214, GB - 8, 268, GB - 9]], 1.2, 0.4, 0.4) })),
  ]
}

/** A bamboo well-sweep (hanetsurube) by the path: post, a long arm on a pivot, a stone weight, a rope and bucket. */
function lever(x: number, y: number, seed: number) {
  const px = x, py = y - 44
  const post = bamboo([[x, y], [x + 0.6, y - 22], [x, py + 2]], 3.4, seed)
  const beam = bamboo([[px - 34, py + 1], [px, py], [px + 38, py - 1]], 2.6, seed + 1, 16)
  const arm = s('g', { class: 't38f-arm', style: `transform-origin:${px}px ${py}px` },
    s('path', { class: 'g13-bamboo', d: beam.cane, filter: 'url(#ink-rough)' }),
    s('path', { class: 'g13-node', d: beam.nodes }),
    s('path', { class: 't38f-rope', d: stroke([[px + 36, py], [px + 36.5, py + 22]], 0.8, 0.05, 0.05, 0.8) + stroke([[px - 31, py], [px - 31, py + 5]], 0.8, 0.05, 0.05, 0.8) }),
    s('path', { class: 't38f-bucket', d: `M${px + 31} ${py + 22}L${px + 42} ${py + 22}L${px + 40.5} ${py + 31}L${px + 32.5} ${py + 31}Z`, filter: 'url(#ink-rough)' }),
    s('path', { class: 'g13-ink', d: lines([[px + 31, py + 25, px + 42, py + 25], [px + 32, py + 29, px + 41, py + 29]], 0.7) }),
    s('g', { transform: `translate(${px - 31} ${py + 13})` }, stoneArt(13, 9, seed + 2)))
  return {
    arm,
    el: s('g', { class: 't38f-lever' },
      s('ellipse', { class: 'p2p-contact', cx: x + 3, cy: y + 1, rx: 12, ry: 2.2 }),
      s('path', { class: 'g13-bamboo', d: post.cane, filter: 'url(#ink-rough)' }),
      s('path', { class: 'g13-node', d: post.nodes }),
      s('path', { class: 'g13-hi', d: post.hi }),
      s('path', { class: 'g13-ink', d: lines([[px - 3, py + 3, px - 2, py - 4], [px + 3, py + 3, px + 2, py - 4]], 1.4) }),
      arm,
      grass(x - 6, y + 1, 12, seed + 3)),
  }
}

/** Scene 3 — three levers by a three-way fork in the mist; the garden at the end of the path changes with them. */
export function forkScene(ctx: SceneCtx) {
  const { root, svg, panel } = shell(ctx, 't38f', K.art, [K.insight], '20 40 360 262')
  // stepping stones: one way up from the viewer, splitting into three that shrink into the mist
  const trunk = along(curve([200, 304], [192, 258], [200, 214], 14), 6)
  const forks = ([[126, 160], [200, 158], [274, 160]] as Pt[]).map(([x, y]) => along(curve([200, 206], [(x + 200) / 2 + (x - 200) * 0.2, 190], [x, y], 12), 5, 0.12, 1))
  const levers = [lever(92, 292, 3830), lever(292, 268, 3840), lever(340, 298, 3850)]
  levers.forEach((l) => (l.arm.style.transform = 'rotate(-10deg)'))
  svg.append(
    dawnGlow(200, 156, 210, 90, 3),
    fog(200, 120, 230, 60),
    moon(74, 142, 13, 3860, false),
    fog(74, 148, 52, 7), fog(84, 134, 34, 4),
    hills(0, 400, 154, 46, 3861, 0.92, 7),
    hills(-10, 140, 158, 30, 3862, 0.62, 2),
    hills(270, 410, 158, 34, 3863, 0.62, 2),
    s('g', { transform: `translate(${GX} ${GB}) scale(1.22) translate(${-GX} ${-GB})` }, ...gardens()),
    fog(200, 154, 230, 13),
    mist(200, 160, 220, 10),
    s('path', { class: 'g13-rake', d: rakeD(10, 390, 172, 302, 9, 3864, 0) }),
    ...forks.map((w, i) => stonesOn(w, (k) => 7 - k * 0.8, 3870 + i, 't38f-way')),
    stonesOn(trunk, (k) => 15 - k * 1.4, 3875),
    fog(200, 186, 190, 14),
    ...levers.map((l) => l.el),
    s('g', { transform: 'translate(50 300)' }, stoneArt(30, 16, 3880)),
    grass(240, 300, 16, 3881))

  const vals: Record<Id, number> = { speed: 50, share: 50, control: 50 }
  const name = h('h3', { class: 't38f-name' })
  const text = h('p', { class: 't38f-text' })
  const card = h('div', { class: 't38f-card' }, name, text, ctx.fact(K.note, 'p', 't38f-note'))
  let live = false
  let told = false
  const inputs = K.sliders.map((sl, i) => {
    const input = h('input', { type: 'range', min: 0, max: 100, step: 1, value: 50, class: 't38f-range' })
    input.addEventListener('input', () => {
      vals[sl.id] = Number(input.value)
      levers[i].arm.style.transform = `rotate(${(-10 + (vals[sl.id] - 50) * 0.36).toFixed(1)}deg)`
      draw()
    })
    input.addEventListener('change', () => {
      if (!live) (card.setAttribute('aria-live', 'polite'), (live = true))
      if (!told) (ctx.insight(K.insight), (told = true))
    })
    return h('label', { class: 't38f-sl' }, h('span', { class: 't38f-lab' }, sl.label), input,
      h('span', { class: 't38f-ends', 'aria-hidden': 'true' }, h('span', null, sl.low), h('span', null, sl.high)))
  })
  panel.append(...inputs, card,
    h('details', { class: 't38f-mists' }, h('summary', null, K.mistsLabel),
      ...K.mists.map((m) => h('div', { class: 't38f-mist-item' }, h('p', { class: 'p2-eyebrow' }, m.who), ctx.fact(m.view, 'p', 't38f-view')))))

  function draw() {
    const sc = K.scenarios.find((x) => Object.entries(x.when).every(([k, want]) => lv(vals[k as Id]) === want)) ?? K.scenarios[K.scenarios.length - 1]
    root.dataset.garden = sc.id
    name.textContent = sc.name
    text.textContent = sc.text
    K.sliders.forEach((sl, i) => {
      const l = lv(vals[sl.id])
      inputs[i].querySelector('input')!.setAttribute('aria-valuetext', fill(K.sliderAria, { label: sl.label, value: l === 'low' ? sl.low : l === 'high' ? sl.high : vals[sl.id] }))
    })
  }
  draw()
  ctx.prompt(K.prompt)
}
