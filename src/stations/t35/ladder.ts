import { fill, h, s } from '../../core/dom'
import { blob, curve, rng, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist, moon, toro, wash } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import { C } from './content'
import { doorway, F, ink, P, roof, wood, woodG } from '../t34/night'

const K = C.scenes.ladder
const X = (i: number) => 58 + i * 66
const Y = (i: number) => 284 - i * 50

/** One mossy stone step centred on x, its front edge at y: tread, riser, ink edges, moss along the lip, a moonlit rim. */
function step(x: number, y: number, seed: number): SVGGElement {
  const r = rng(seed)
  const j = () => (r() - 0.5) * 2.4
  const L = x - 48, R = x + 48
  const tread = `M${P([L + 4, y - 26 + j()])}L${P([R - 6, y - 27 + j()])}Q${P([R + 1, y - 24])} ${P([R, y - 16 + j()])}L${P([L, y - 15 + j()])}Q${P([L - 2, y - 20])} ${P([L + 4, y - 26])}Z`
  const riser = `M${P([L, y - 15])}L${P([R, y - 16])}L${P([R - 2, y + 3 + j()])}Q${P([x, y + 6])} ${P([L + 3, y + 2 + j()])}Z`
  let moss = ''
  for (let k = 0; k < 9; k++) {
    const mx = L + 4 + r() * 88
    const my = y - 16 + (r() - 0.5) * 3
    moss += blob(mx, my, 3 + r() * 5, 1.6 + r() * 1.6, seed + k, 0.25, 8)
  }
  for (let k = 0; k < 3; k++) {
    const mx = L + 2 + r() * 10
    moss += blob(mx, y - 8 + r() * 8, 1.6 + r() * 2, 3 + r() * 3, seed + 20 + k, 0.3, 8)
  }
  return s('g', { class: 't35l-step' },
    s('ellipse', { class: 'g12-contact', cx: x + 4, cy: y + 4, rx: 54, ry: 4 }),
    s('path', { d: riser, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
    s('path', { class: 't35l-riser', d: riser }),
    s('path', { d: tread, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
    ink(stroke([[L, y - 15], [x, y - 16.5], [R, y - 16]], 1.8, 0.1, 0.1, 0.3) + stroke([[R, y - 16], [R - 1, y - 5], [R - 2, y + 3]], 2.4, 0.1, 0.2, 0.3) + stroke([[L + 3, y + 2], [x, y + 5], [R - 2, y + 3]], 2.2, 0.1, 0.1, 0.3), 'g12-edge', 'rough'),
    ink(stroke([[L + 6, y - 25.5], [x - 10, y - 27.5], [R - 14, y - 26.5]], 1.4, 0.2, 0.3, 0.1), 'g12-rim'),
    ink(moss, 't35l-moss', 'wash'))
}

/** Scene 1 — five mossy steps up to the workshop door; the same "weekly report" scroll is carried up, and at the top a bamboo shishi-odoshi tips on its own. */
export function ladderScene(ctx: SceneCtx) {
  const seen = new Set<number>()
  const lamps = K.rungs.map((_, i) => s('g', { class: 't35l-lamp' }, toro(X(i) + 36, Y(i) - 19, 30, true)))
  // the shishi-odoshi on the top landing: a bamboo spout drips into the tube, which tips and knocks the stone
  const tube = s('g', { class: 't35l-tube' },
    ink(stroke([[254, 42], [302, 64]], 7.5, 0.04, 0.04, 0.85), 't35l-bamboo', 'rough'),
    ink(stroke([[270, 49], [271.5, 51.5]], 8.6, 0.2, 0.2, 0.6) + stroke([[300, 63], [303, 64.5]], 6, 0.2, 0.2, 0.6), 'g12-edge'),
    s('ellipse', { class: 't35l-mouth', cx: 254.5, cy: 42, rx: 1.8, ry: 3.6, transform: 'rotate(25 254.5 42)' }),
    ink(stroke([[258, 40], [300, 59.5]], 1.5, 0.2, 0.2, 0.2), 'g12-rim'))
  const art = s('svg', { class: 't35l-svg', viewBox: '0 0 400 300', 'aria-hidden': 'true' },
    mist(150, 150, 260, 170),
    moon(66, 52, 19, 35, true),
    hills(-20, 230, 250, 110, 351, 0.92, 3),
    mist(100, 245, 200, 40),
    // the hillside the steps are set into, fading out before the edge
    wash(`M-10 304Q40 300 100 262Q170 210 226 166Q290 116 338 92Q372 78 392 96Q402 140 360 200Q300 270 200 300Z`, 0.12),
    // the workshop at the top: a small hall with a lamp-lit doorway under its eaves
    s('rect', { class: 't35l-wall', x: 330, y: 26, width: 60, height: 60 }),
    woodG([wood([330, 88], [331, 24], 5, 354), wood([390, 88], [389, 24], 5, 355)]),
    doorway(341, 87, 38, 54, 356, false),
    ink(roof(330, 390, 24, 1.3, 12), 'g12-eave', 'rough'),
    ink(stroke([[338, 10.5], [360, 9.6], [382, 10.5]], 1.6, 0.2, 0.2, 0.2), 'g12-rim'),
    // spout, posts, the stone it knocks, the basin
    ink(stroke([[218, 84], [217, 30]], 4.4, 0.04, 0.04, 0.8) + stroke([[216, 30], [238, 31], [250, 34]], 4.4, 0.05, 0.1, 0.8), 't35l-bamboo', 'rough'),
    ink(stroke([[217.5, 50], [218.5, 52]], 5.6, 0.2, 0.2, 0.6) + stroke([[274, 84], [275, 52]], 3.2, 0.05, 0.05, 0.6) + stroke([[282, 84], [282, 52]], 3.2, 0.05, 0.05, 0.6), 'g12-edge', 'rough'),
    ink(stroke([[251, 35], [252, 39]], 1, 0.3, 0.3, 0.3), 't35l-drop'),
    s('path', { d: blob(306, 80, 9, 5, 357, 0.12, 10), fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
    s('path', { d: blob(246, 84, 18, 8, 361, 0.12, 12), fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
    s('ellipse', { class: 't35l-basin', cx: 246, cy: 81, rx: 12, ry: 3 }),
    ink(stroke(curve([231, 82], [246, 89], [261, 82], 8), 2.4, 0.1, 0.1, 0.3), 'g12-edge', 'rough'),
    tube,
    ...K.rungs.flatMap((_, i) => [step(X(i), Y(i), 350 + i * 7), lamps[i]]),
    grass(20, 292, 22, 358), grass(150, 230, 16, 359), grass(222, 178, 14, 360))
  const btns = K.rungs.map((r, i) =>
    h('button', { class: 't35l-rung', type: 'button', 'aria-label': fill(K.rungAria, { n: i + 1, name: r.name }), 'aria-pressed': 'false', style: `left:${(X(i) / 4).toFixed(2)}%;top:${((Y(i) - 9) / 3).toFixed(2)}%`, onClick: () => climb(i) }, r.name))
  // the weekly report, a little rolled scroll carried from step to step
  const roll = h('span', { class: 't35l-roll', 'aria-hidden': 'true' },
    s('svg', { viewBox: '0 0 52 22' },
      s('rect', { class: 't35l-paper', x: 6, y: 4, width: 40, height: 14, rx: 6 }),
      ink(stroke([[8, 5], [26, 4.4], [44, 5]], 1.6, 0.1, 0.1, 0.3) + stroke([[8, 17], [26, 17.8], [44, 17]], 2.2, 0.1, 0.1, 0.3), 'g12-edge'),
      s('path', { class: 't35l-knob', d: 'M2 6Q1 11 2 16L7 17L7 5Z M50 6Q51 11 50 16L45 17L45 5Z' }),
      ink(stroke([[24, 3], [26, 11], [24, 19]], 2.4, 0.1, 0.1, 0.5) + stroke([[26, 11], [31, 20]], 1.4, 0.1, 0.5, 0.2), 't35l-tie')))
  const card = h('div', { class: 't35l-card', 'aria-live': 'polite' })
  const root = h('div', { class: 't35 t35l' },
    h('p', { class: 'visually-hidden' }, K.art),
    h('div', { class: 't35l-stairs' }, art, ...btns, roll),
    h('div', { class: 't35l-side' }, h('p', { class: 'p2-eyebrow' }, K.task), card, ctx.fact(F(K.scale), 'p', 't35l-scale')))
  ctx.art.append(root)
  ctx.prompt(K.prompt)
  place(-1)

  function place(i: number) {
    const p: Pt = i < 0 ? [X(0) - 62, Y(0) - 14] : [X(i) - 22, Y(i) - 33]
    roll.style.left = `${(p[0] / 4).toFixed(2)}%`
    roll.style.top = `${(p[1] / 3).toFixed(2)}%`
  }
  function climb(i: number) {
    seen.add(i)
    btns.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)))
    lamps[i].classList.add('on')
    place(i)
    ctx.chime(i === 4 ? 'ok' : 'tap')
    const r = K.rungs[i]
    const fact = r.id === 'workflow' ? K.facts[0] : r.id === 'hook' ? K.facts[1] : null
    card.replaceChildren(
      h('h3', { class: 't35l-name' }, h('span', { class: 't35l-n' }, String(i + 1)), r.name),
      h('p', { class: 't35l-what' }, r.what),
      h('p', { class: 't35l-ex' }, r.example),
      fact ? ctx.fact(F(fact), 'p', 't35l-fact') : '')
    if (r.id === 'hook') {
      tube.classList.remove('tip')
      void art.getBoundingClientRect()
      tube.classList.add('tip')
    }
    if (seen.size === K.rungs.length) ctx.insight(F(K.insight), K.detail)
  }
}
