import raw from '../../content/tram-19.json'
import { h, nextId, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { onSize, p2Defs, stableHeight, stoneArt, stroke, type Pt } from '../../ui/part2/ink'

const G = raw.scenes.gate

/** Scene 2 · the fenced summit: a bamboo fence round the highest peak; open the gate to see why it is fenced. */
export function gateScene(ctx: SceneCtx) {
  p2Defs()
  const stableH = stableHeight(ctx, [G.insight as Fact])

  // fence posts on a shallow arc round the peak's foot, a gap in the middle for the gate
  const posts: SVGElement[] = []
  for (let x = 96; x <= 304; x += 11) {
    if (x > 183 && x < 217) continue
    const y = 206 - Math.cos(((x - 200) / 110) * 1.2) * 8
    posts.push(s('rect', { class: 't19g-post', x: x - 2.6, y: y - 46, width: 5.2, height: 46, rx: 1.6 }))
    posts.push(s('path', { class: 't19g-node', d: `M${x - 2.6} ${y - 30}h5.2` }))
  }
  const rail = (y: number) => s('path', { class: 't19g-rail', d: stroke([[92, y + 4], [150, y - 2], [184, y - 4]], 2.6, 0.1, 0.1) + stroke([[216, y - 4], [250, y - 2], [308, y + 4]], 2.6, 0.1, 0.1) })
  const door = (side: 'l' | 'r') => {
    const x = side === 'l' ? 184 : 200
    return s('g', { class: `t19g-door t19g-door-${side}` },
      s('rect', { class: 't19g-plank', x, y: 152, width: 16, height: 50, rx: 1 }),
      s('path', { class: 't19g-lattice', d: `M${x + 2} 164h12M${x + 2} 177h12M${x + 2} 190h12M${x + 8} 154v46` }))
  }
  // the code wall the workers are patching, behind the fence
  const code: SVGElement[] = []
  const rows = [[176, 50], [166, 42], [156, 35], [146, 28], [136, 20]]
  rows.forEach(([y, w], i) => {
    for (let x = 200 - w; x < 200 + w; x += 9 + ((i * 7 + x) % 5)) code.push(s('rect', { class: 't19g-code', x, y: y - 2, width: 4 + ((x * 3 + i) % 6), height: 2.4, rx: 1.2 }))
  })
  const crack: Pt[] = [[196, 132], [203, 141], [197, 150], [205, 160], [199, 171]]
  const lantern = (x: number, y: number) => s('g', { class: 't19g-lantern' },
    s('circle', { class: 't19g-glow', cx: x, cy: y - 10, r: 16 }),
    s('path', { class: 't19g-toro', d: `M${x - 6} ${y - 18}h12l-3-4h-6zM${x - 4} ${y - 14}h8v8h-8zM${x - 1.5} ${y - 6}h3v8h-3zM${x - 5} ${y + 2}h10v2h-10z` }),
    s('rect', { class: 't19g-flame', x: x - 2.5, y: y - 12.5, width: 5, height: 5 }))

  const ridge = (d: string, cls: string, mask?: string) => s('path', { class: cls, d, mask: mask && `url(#${mask})` })
  const fade = nextId('t19f')
  const art = s('svg', { class: 't19g-svg', viewBox: '0 0 400 290', preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true' },
    // a soft vignette so the hills and ground melt into the paper instead of ending in a box
    s('defs', null,
      s('radialGradient', { id: `${fade}-g`, cx: 0.5, cy: 0.42, r: 0.62 }, s('stop', { offset: 0.62, 'stop-color': '#fff' }), s('stop', { offset: 1, 'stop-color': '#000' })),
      s('mask', { id: fade, maskContentUnits: 'objectBoundingBox' }, s('rect', { width: 1, height: 1, fill: `url(#${fade}-g)` }))),
    s('circle', { cx: 292, cy: 66, r: 70, fill: 'url(#p2-halo)' }),
    s('circle', { class: 't19g-moon', cx: 292, cy: 66, r: 26 }),
    ridge('M-20 210Q30 150 70 168Q110 120 150 150Q190 100 236 140Q280 112 320 150Q360 128 420 170V300H-20Z', 't19g-far', fade),
    ridge('M60 222Q130 160 170 104Q190 66 200 60Q212 66 232 104Q270 160 340 222Z', 't19g-peak'),
    s('path', { class: 't19g-peak-ink', d: stroke([[200, 60], [214, 78], [232, 104], [262, 146], [300, 190]], 3, 0.1, 0.5) + stroke([[200, 60], [186, 82], [168, 108]], 2.2, 0.1, 0.6) }),
    s('g', { class: 't19g-inside' },
      ...code,
      s('path', { class: 't19g-crack', d: stroke(crack, 2.4, 0.2, 0.3) }),
      s('path', { class: 't19g-patch', d: 'M193 140h14M194 156h14M193 168h12' }),
      lantern(166, 200),
      lantern(234, 200)),
    ...posts,
    rail(170),
    rail(190),
    door('l'),
    door('r'),
    ridge('M-20 228Q120 208 200 214Q300 220 420 206V300H-20Z', 't19g-ground', fade),
    s('ellipse', { class: 't19g-pool', cx: 200, cy: 254, rx: 70, ry: 15 }),
    s('path', { class: 't19g-reflect', d: stroke([[180, 254], [200, 252], [222, 255]], 3, 0.3, 0.3) }),
    ...([[122, 262, 28, 18], [158, 278, 22, 14], [244, 278, 24, 15], [280, 262, 30, 19]] as const).map(([x, y, w, hh], i) =>
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
