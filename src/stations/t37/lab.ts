import { h, s } from '../../core/dom'
import { blob, curve, stroke } from '../../ui/part2/ink'
import { grass, hills, mist, moon, pine, toro, wash } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import { C, shell } from './shell'
import { along, lines, rakeD, stonesOn } from './sumi'

const K = C.scenes.lab

/** A shadow cast on paper or sand: soft wash edges. Kneeling upright (feet at 0, 0), ≈ 34 tall. */
const kneeling = 'M-1 -40a6 6.4 0 1 0 0.1 0zM-9 -30Q-1 -34 7 -30Q11 -18 12 -3Q13 0 10 1H-12Q-14 0 -13 -4Q-11 -18 -9 -30Z'
/** Walking, leaning into the step. */
const walking = 'M2 -31a4.4 4.6 0 1 0 0.1 0zM-3 -24Q2 -27 7 -23Q8 -14 6 -9L10 0L7 1L2 -7L-2 0L-6 0L-3 -9Q-6 -16 -3 -24Z'

/** A pruned shrub (karikomi): a rounded wash, dry clipped texture, its own shade below. */
function shrub(x: number, y: number, rx: number, ry: number, seed: number) {
  let tex = ''
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (1.1 + (i / 6) * 0.8)
    const px = x + Math.cos(a) * rx * 0.7, py = y + Math.sin(a) * ry * 0.6
    tex += stroke(curve([px - rx * 0.16, py], [px, py - ry * 0.18], [px + rx * 0.16, py], 4), 1.1, 0.2, 0.2, 0.2)
  }
  return s('g', { class: 't37l-shrub' },
    wash(blob(x, y, rx, ry, seed, 0.12), 0.42, 'p2p-wash g13-moss'),
    wash(blob(x - rx * 0.15, y - ry * 0.2, rx * 0.6, ry * 0.5, seed + 2, 0.15), 0.25, 'p2p-wash g13-moss'),
    wash(blob(x + rx * 0.1, y + ry * 0.5, rx * 0.85, ry * 0.4, seed + 1, 0.12), 0.38),
    s('path', { class: 'p2p-cun', d: tex, filter: 'url(#ink-dry)' }))
}

function art(svg: SVGGElement) {
  // the tea room: plinth, veranda, posts, the lit shōji with its lattice, a hipped roof with lifted eaves
  let lattice = ''
  for (let i = 1; i < 10; i++) lattice += stroke([[140 + i * 12, 125], [140 + i * 12, 193]], 0.9, 0.1, 0.1, 0.6)
  for (let j = 1; j < 5; j++) lattice += stroke([[141, 124 + j * 14], [259, 124 + j * 14]], 0.9, 0.1, 0.1, 0.6)
  let tiles = ''
  for (let x = 150; x <= 250; x += 8) tiles += stroke([[x + (x - 200) * 0.02, 89], [x + (x - 200) * 0.42, 119]], 0.9, 0.1, 0.3, 0.3)
  const roof = 'M108 127Q130 123 147 104L166 86L234 86L253 104Q270 123 292 127Q256 119 200 120Q144 119 108 127Z'
  const main = along(curve([200, 214], [196, 248], [186, 284], 12), 5)
  const side = along(curve([214, 226], [276, 240], [376, 226], 14), 6, 0.1, 1)
  svg.append(
    mist(200, 84, 300, 92),
    moon(64, 52, 14, 3710, true),
    hills(-30, 430, 152, 58, 3711, 0.9, 5),
    hills(250, 440, 160, 40, 3712, 0.62, 2),
    mist(200, 158, 260, 20),
    s('path', { class: 'g13-rake', d: rakeD(-10, 410, 214, 284, 8, 3713, -2) }),
    pine(362, 216, 150, 3714, -1),
    shrub(58, 212, 36, 13, 3715), shrub(100, 222, 22, 9, 3716), shrub(318, 216, 26, 10, 3717),
    // light spilling from the room onto the sand, the two ways out
    s('g', { class: 't37l-glow' }, s('ellipse', { cx: 200, cy: 222, rx: 120, ry: 34, fill: 'url(#p2-lamp)' })),
    s('g', { class: 't37l-main' }, stonesOn(main, (i) => 10 + i * 2.4, 3718)),
    s('g', { class: 't37l-side' }, stonesOn(side, (i) => 9 - i * 0.6, 3719)),
    s('g', { class: 't37l-room' },
      wash(blob(200, 206, 92, 9, 3720, 0.1), 0.3),
      s('path', { class: 't37l-plinth', d: 'M126 199L274 199L271 208L129 208Z', filter: 'url(#ink-rough)' }),
      s('g', { class: 't37l-shoji' },
        s('rect', { class: 't37l-paper', x: 140, y: 124, width: 120, height: 70 }),
        s('rect', { x: 140, y: 124, width: 120, height: 70, fill: 'url(#p2-lamp-body)', class: 't37l-lamp' })),
      s('g', { class: 't37l-in' }, s('path', { class: 't37l-shadow', d: kneeling, transform: 'translate(184 192)', filter: 'url(#ink-wash)' }),
        s('path', { class: 't37l-shadow', d: 'M200 181h28v3h-28zM203 184v8M225 184v8M209 176h10v5h-10z', filter: 'url(#ink-wash)' })),
      s('path', { class: 't37l-lattice', d: lattice }),
      s('path', { class: 'g13-ink', d: lines([[136, 120, 136, 199], [264, 120, 264, 199], [138, 124, 262, 124], [138, 194, 262, 194]], 3, 0.05, 0.05) + lines([[200, 124, 200, 194]], 1.8, 0.05, 0.05), filter: 'url(#ink-rough)' }),
      s('path', { class: 't37l-plank', d: lines([[122, 197, 278, 197], [124, 201, 276, 201]], 1.6, 0.1, 0.1), filter: 'url(#ink-rough)' }),
      s('path', { class: 't37l-eave-sh', d: 'M134 120L266 120L266 128Q200 125 134 128Z' }),
      s('path', { class: 't37l-roof', d: roof, filter: 'url(#ink-wash)' }),
      s('path', { class: 't37l-tiles', d: tiles }),
      s('path', { class: 'g13-ink', d: stroke([[163, 87], [200, 85.5], [237, 87]], 4, 0.15, 0.15, 0.5) + stroke(curve([106, 125], [200, 113], [294, 125], 20), 2.4, 0.08, 0.08, 0.4) + lines([[160, 84, 165, 89], [240, 84, 235, 89]], 2), filter: 'url(#ink-rough)' })),
    toro(92, 262, 40, false),
    grass(126, 264, 16, 3721),
    grass(300, 262, 18, 3722),
    // its second shadow out in the garden: by the door while watched, away down the side path when not
    s('g', { class: 't37l-out' },
      s('ellipse', { class: 't37l-cast', cx: 6, cy: 0, rx: 14, ry: 2.6 }),
      s('path', { class: 't37l-shadow', d: walking, filter: 'url(#ink-wash)' }),
      s('path', { class: 't37l-rimlight', d: stroke([[-0.5, -34], [-3.5, -32], [-4, -27]], 1.1, 0.2, 0.3, 0.2) + stroke([[-3.5, -23], [-5, -15], [-3, -9]], 1, 0.2, 0.3, 0.2) + stroke([[-3, -9], [-6, 0]], 0.9, 0.2, 0.3, 0.2) })))
}

/** Scene 2 — the sealed test room: the paper gardener behaves while it believes it is watched. */
export function labScene(ctx: SceneCtx) {
  const { root, svg, panel } = shell(ctx, 't37l', K.art, [K.insight], '0 24 400 264')
  art(svg)
  let watched = true
  let told = false
  const state = h('span', { class: 't37-sw-state' }, K.on)
  const sw = h('button', { class: 't37-switch', type: 'button', role: 'switch', 'aria-checked': 'true', onClick: flip },
    h('span', { class: 't37-sw-track', 'aria-hidden': 'true' }, h('span', { class: 't37-sw-knob' })), h('span', { class: 't37-sw-label' }, K.toggle, state))
  const status = h('p', { class: 't37-status' }, K.watched)
  const what = h('p', { class: 't37-what' })
  const tools = K.tools.map((t, i) => h('button', { class: 't37-chip', type: 'button', 'aria-pressed': String(i === 0), onClick: () => tool(i) }, t.name))
  const example = h('div', { class: 't37-example', hidden: true }, h('p', { class: 'p2-eyebrow' }, K.exampleLabel), ctx.fact(K.example, 'p', 't37-ex-text'))
  panel.append(sw, status,
    h('div', { class: 't37-tools' }, h('p', { class: 'p2-eyebrow' }, K.toolsLabel), h('div', { class: 't37-chips', role: 'group', 'aria-label': K.toolsLabel }, ...tools), what),
    example)
  tool(0)

  function tool(i: number) {
    tools.forEach((b, j) => b.setAttribute('aria-pressed', String(i === j)))
    what.textContent = K.tools[i].what
  }
  function flip() {
    watched = !watched
    root.dataset.unwatched = String(!watched)
    sw.setAttribute('aria-checked', String(watched))
    state.textContent = watched ? K.on : K.off
    status.textContent = watched ? K.watched : K.unwatched
    if (!told) {
      told = true
      status.setAttribute('aria-live', 'polite')
      example.hidden = false
      ctx.insight(K.insight, K.detail)
    }
  }
  ctx.prompt(K.prompt)
}
