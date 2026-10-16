import { fill, h, s } from '../../core/dom'
import { blob, curve, rng, stroke, type Pt } from '../../ui/part2/ink'
import { mist, wash } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import { C } from './content'
import { bench, cardButton, F, gdefs, ink, wood, woodG } from './night'

const K = C.scenes.credit
// shortcut: illustrative weights only (K.scale says so on screen); not any platform's real price list
const W_MODEL = [1, 3], W_RES = [1, 2], W_LEN = [1, 2], BASE = 3
// the jar (viewBox 320 × 300): lip at y 96, shoulder ~150, foot on the bench at 236
const L1 = [...curve([163, 112], [120, 122], [118, 160], 10), ...curve([118, 160], [117, 208], [148, 236], 10).slice(1)]
const R1 = L1.map(([x, y]) => [360 - x, y] as Pt)
const BODY = `M162 96Q159 104 163 112${L1.slice(1).map(([x, y]) => `L${x.toFixed(1)} ${y.toFixed(1)}`).join('')}L${R1.slice().reverse().map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Q201 104 198 96Z`
const TOP = 118, BOT = 232

/** Scene 3 — credit is water in a crackle-glazed jar: every "Tạo" ladles some out; heavier choices take a bigger ladle. */
export function creditScene(ctx: SceneCtx) {
  gdefs()
  let level = 100
  let made = 0
  const pick = [0, 0, 0]
  const r = rng(343)
  // water inside the jar, seen through the glaze: a wash with a moonlit surface (the group moves, its parts stay still)
  const water = s('g', { class: 't34c-water' },
    s('rect', { class: 't34c-water-body', x: 100, y: TOP, width: 160, height: BOT - TOP + 6 }),
    s('ellipse', { class: 't34c-surface', cx: 180, cy: TOP, rx: 64, ry: 4 }),
    ink(stroke([[140, TOP + 1], [180, TOP + 2.5], [222, TOP + 1]], 1.6, 0.3, 0.3, 0.1), 't34c-glint'))
  // crackle: a fine net of broken lines over the glaze
  let crackle = ''
  for (let i = 0; i < 16; i++) {
    let p: Pt = [124 + r() * 112, 118 + r() * 112]
    const pts: Pt[] = [p]
    for (let k = 0; k < 3 + Math.floor(r() * 3); k++) {
      p = [p[0] + (r() - 0.5) * 22, p[1] + (r() - 0.3) * 18]
      pts.push(p)
    }
    crackle += stroke(pts, 0.7 + r() * 0.5, 0.2, 0.2, 0.4)
  }
  // carved marks on the right flank, clearer once the water has fallen below them
  const ticks = [0.25, 0.5, 0.75].map((f) => {
    const y = BOT - (BOT - TOP) * f
    const x = 222 + (f - 0.5) * 6
    return ink(stroke([[x, y], [x + 12, y + 0.6]], 2.4, 0.15, 0.4, 0.3) + stroke([[x + 4, y + (BOT - TOP) * 0.125], [x + 10, y + (BOT - TOP) * 0.125 + 0.4]], 1.4, 0.2, 0.3, 0.3), 't34c-tick', 'rough')
  })
  // the bamboo ladle (hishaku): a long handle from its peg, the cup over the jar's mouth
  const ladle = s('g', { class: 't34c-ladle' },
    ink(stroke([[296, 30], [256, 56], [226, 78]], 3.2, 0.06, 0.04, 0.7), 't34c-handle', 'rough'),
    ink(stroke([[262, 52], [264, 55]], 4.6, 0.2, 0.2, 0.6) + stroke([[238, 69], [240, 72]], 4.2, 0.2, 0.2, 0.6), 'g12-edge'),
    ink('M204 72Q214 69 224 72L223 87Q214 91 205 87Z', 't34c-cup', 'rough'),
    s('ellipse', { class: 't34c-cup-in', cx: 214, cy: 72, rx: 10, ry: 2.6 }),
    ink(stroke([[205, 79], [205.5, 86]], 1.2, 0.2, 0.2, 0.3) + stroke([[204, 72], [214, 69.6], [224, 72]], 1.2, 0.1, 0.1, 0.4), 'g12-rim'),
    ink(stroke([[223, 73], [222.5, 86], [214, 90]], 1.8, 0.1, 0.2, 0.3), 'g12-edge', 'rough'))
  const clip = s('clipPath', { id: 't34c-clip' }, s('path', { d: BODY }))
  const win = { x: 22, y: 22, w: 92, h: 92 }
  const winClip = s('clipPath', { id: 't34c-win' }, s('rect', { x: win.x, y: win.y, width: win.w, height: win.h }))
  const jar = s('svg', { class: 't34c-jar', viewBox: '0 0 320 300', role: 'img', 'aria-label': fill(K.jarAria, { n: level }) },
    s('defs', null, clip, winClip),
    // the workshop wall, the window with the moon in it and its beam falling into the jar's mouth
    mist(170, 150, 190, 130),
    s('rect', { class: 't34c-sky', x: win.x, y: win.y, width: win.w, height: win.h }),
    s('g', { 'clip-path': 'url(#t34c-win)' },
      s('circle', { cx: 74, cy: 56, r: 50, fill: 'url(#p2-halo)' }),
      s('circle', { class: 't34c-moon', cx: 74, cy: 56, r: 15 }),
      mist(68, 104, 70, 14),
      ink(stroke([[18, 96], [40, 90], [62, 92]], 2, 0.1, 0.4, 0.2) + stroke([[28, 93], [30, 84], [36, 80]], 1.2, 0.1, 0.4, 0.2), 'g12-edge', 'rough')),
    s('path', { class: 't34c-beam', d: 'M60 114L114 64L199 97L163 99Z', fill: 'url(#g12-beam)' }),
    woodG([
      wood([win.x - 4, win.y], [win.x + win.w + 4, win.y], 6, 3432),
      wood([win.x - 4, win.y + win.h], [win.x + win.w + 4, win.y + win.h], 7, 3433),
      wood([win.x, win.y - 3], [win.x, win.y + win.h + 3], 5, 3434),
      wood([win.x + win.w, win.y - 3], [win.x + win.w, win.y + win.h + 3], 5, 3435),
    ]),
    ink(stroke([[win.x + win.w / 2, win.y + 2], [win.x + win.w / 2, win.y + win.h - 2]], 1.4, 0.1, 0.1, 0.5) + stroke([[win.x + 2, win.y + win.h / 2], [win.x + win.w - 2, win.y + win.h / 2]], 1.4, 0.1, 0.1, 0.5), 'g12-lattice', 'rough'),
    // the peg for the ladle, the bench, the jar's shadow
    ink(stroke([[292, 26], [302, 32]], 5, 0.1, 0.1, 0.6), 'g12-edge', 'rough'),
    wash(blob(186, 244, 150, 9, 3436, 0.2), 0.2),
    bench(24, 314, 238, 56, 3437),
    s('ellipse', { class: 'g12-contact', cx: 186, cy: 237, rx: 46, ry: 4 }),
    // the jar: glaze, the water seen through it, shade, crackle, the ink of its sides, moonlight on the shoulder
    s('path', { class: 't34c-glaze', d: BODY, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
    s('path', { class: 't34c-celadon', d: BODY }),
    s('g', { 'clip-path': 'url(#t34c-clip)' }, water),
    s('path', { d: BODY, fill: 'url(#p2-shade)' }),
    s('g', { 'clip-path': 'url(#t34c-clip)' }, ink(crackle, 't34c-crack', 'dry')),
    ...ticks,
    ink(stroke(R1, 4.2, 0.05, 0.12, 0.35) + stroke(L1, 2, 0.1, 0.2, 0.3), 't34c-side', 'rough'),
    s('ellipse', { class: 't34c-lip', cx: 180, cy: 97, rx: 19, ry: 4.8 }),
    s('ellipse', { class: 't34c-mouth', cx: 180, cy: 97, rx: 14.5, ry: 3 }),
    ink(stroke([[161, 97], [180, 101.5], [199, 97]], 1.8, 0.1, 0.1, 0.3), 'g12-edge', 'rough'),
    ink(stroke(curve([150, 120], [128, 132], [125, 162], 8), 3.2, 0.3, 0.5, 0.1) + stroke([[164, 101], [168, 98]], 1.6, 0.2, 0.2, 0.2), 't34c-shine'),
    ladle)

  const seg = (label: string, opts: string[], k: number) => {
    const btns = opts.map((o, i) => h('button', { class: 't34c-opt g12-paper', type: 'button', 'aria-pressed': String(i === 0), onClick: () => {
      pick[k] = i
      btns.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)))
    } }, o))
    return h('div', { class: 't34c-seg', role: 'group', 'aria-label': label }, h('span', { class: 't34c-lab' }, label), ...btns)
  }
  const cost = h('p', { class: 't34c-cost', 'aria-live': 'polite' })
  const facts = h('div', { class: 't34c-facts' })
  const tips = h('div', { class: 't34c-tips', hidden: true }, h('p', { class: 't34c-lab' }, K.tipsLabel), h('ul', null, ...K.tips.map((t) => h('li', null, t))))
  const go = h('button', { class: 't34c-go', type: 'button', onClick: generate }, K.generate)
  const refill = h('button', { class: 't34c-refill', type: 'button', hidden: true, onClick: fillUp }, K.refill)
  const panel = h('div', { class: 't34c-panel' },
    seg(K.modelLabel, K.models, 0), seg(K.resLabel, K.resolutions, 1), seg(K.lengthLabel, K.lengths, 2),
    h('div', { class: 't34c-acts' }, go, refill), cost, facts, tips)
  const root = h('div', { class: 't34 t34c' }, h('p', { class: 'visually-hidden' }, K.art),
    h('div', { class: 't34c-stage' }, jar, ctx.fact(F(K.scale), 'p', 't34c-scale')), panel)
  ctx.art.append(root)
  ctx.prompt(K.prompt)
  const pill = cardButton(ctx, root, K.takeaway)
  if (pill) { pill.hidden = true; panel.append(pill) }
  draw()

  function draw() {
    const y = ((100 - level) / 100) * (BOT - TOP)
    water.style.transform = `translateY(${y}px)`
    ticks.forEach((t, i) => t.classList.toggle('dry', TOP + y < BOT - (BOT - TOP) * [0.25, 0.5, 0.75][i]))
    jar.setAttribute('aria-label', fill(K.jarAria, { n: level }))
  }
  function generate() {
    const n = BASE * W_MODEL[pick[0]] * W_RES[pick[1]] * W_LEN[pick[2]]
    if (n > level) {
      cost.textContent = K.empty
      refill.hidden = false
      return
    }
    level -= n
    made++
    ladle.classList.remove('dip')
    void (ladle as unknown as HTMLElement).getBoundingClientRect()
    ladle.classList.add('dip')
    ctx.chime('tap')
    draw()
    cost.textContent = fill(K.cost, { n }) + (level === 0 ? ' ' + K.empty : '')
    refill.hidden = level === 100
    if (made === 1) {
      facts.replaceChildren(ctx.fact(F(K.facts[0]), 'p'))
      tips.hidden = false
      if (pill) pill.hidden = false
      ctx.insight(F(K.insight), K.detail)
    }
  }
  function fillUp() {
    level = 100
    draw()
    cost.textContent = ''
    refill.hidden = true
    facts.replaceChildren(ctx.fact(F(K.facts[1]), 'p'))
    go.focus()
  }
}
