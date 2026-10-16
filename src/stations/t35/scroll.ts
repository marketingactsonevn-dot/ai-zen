import { h, s } from '../../core/dom'
import { blob, curve, rng, stroke, type Pt } from '../../ui/part2/ink'
import { mist, pine } from '../../ui/part2/paint'
import { codeScroll } from '../../ui/part2/code'
import type { CodeScroll } from '../../ui/part2/types'
import type { SceneCtx } from '../types'
import { C } from './content'
import { F, gdefs, ink, lantern, wood, woodG } from '../t34/night'

const K = C.scenes.scroll

/** A wooden roller (jiku) across x0…x1 at y, with turned knobs at both ends. */
function roller(x0: number, x1: number, y: number, t: number, seed: number): SVGElement[] {
  const knob = (x: number, dir: number) => blob(x + dir * t * 0.7, y, t * 0.95, t * 0.8, seed + dir + 2, 0.1, 10)
  return [
    woodG([wood([x0, y], [x1, y], t, seed)], 't35s-roller'),
    ink(knob(x0, -1) + knob(x1, 1), 't35s-knob', 'rough'),
    ink(stroke([[x0 - t * 1.2, y - t * 0.45], [x0 - t * 0.4, y - t * 0.6]], t * 0.22, 0.2, 0.2, 0.2) + stroke([[x1 + t * 0.4, y - t * 0.6], [x1 + t * 1.2, y - t * 0.45]], t * 0.22, 0.2, 0.2, 0.2), 'g12-rim'),
  ]
}

/** Scene 2 — a scroll hung on a wooden peg under a lantern; tap its tie and it unrolls into a real SKILL.md. */
export function scrollScene(ctx: SceneCtx) {
  gdefs()
  const r = rng(352)
  // the beam across the room, the peg, the hanging cord, the mounting band and the top roller; a lantern beside it
  const rod = s('svg', { class: 't35s-rod', viewBox: '0 0 400 64', preserveAspectRatio: 'xMidYMax meet', 'aria-hidden': 'true' },
    woodG([wood([-900, 7], [1300, 5], 9, 3521)], 't35s-beam'),
    s('path', { class: 't35s-cord', d: 'M60 50L200 10L340 50' }),
    ink(blob(200, 10, 4.5, 4, 3522, 0.1, 8), 't35s-knob', 'rough'),
    ink(`M50 49L350 49L350 60Q200 62 50 60Z`, 't35s-band', 'wash'),
    ...roller(44, 356, 50, 7, 3523),
    lantern(418, 11, 13, 3524, 30))
  // closed: the bold head of the scroll like a signboard, the rest rolled up below and tied with a red cord
  let lines = ''
  for (let i = 0; i < 4; i++) {
    const y = 128 + i * 18
    let x = 70
    while (x < 330) {
      const len = 14 + r() * 46
      lines += stroke([[x, y + (r() - 0.5)], [x + Math.min(len, 330 - x), y + (r() - 0.5)]], 2.6, 0.2, 0.2, 0.3)
      x += len + 8 + r() * 10
    }
  }
  const tieArt = s('svg', { class: 't35s-tie-art', viewBox: '0 0 400 240', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    ink(lines, 't35s-lines', 'dry'),
    ink(stroke([[18, 228], [200, 226], [382, 228]], 20, 0.02, 0.02, 0.9), 't35s-rolled', 'rough'),
    ink(stroke([[20, 220], [200, 218], [380, 220]], 3, 0.1, 0.1, 0.3), 'g12-rim'),
    ink(stroke([[192, 214], [196, 228], [191, 242]], 6, 0.1, 0.1, 0.5) + stroke([[203, 214], [200, 228], [205, 242]], 6, 0.1, 0.1, 0.5) +
      stroke(curve([197, 228], [184, 240], [176, 262], 8), 3.4, 0.1, 0.5, 0.3) + stroke(curve([199, 228], [214, 242], [220, 266], 8), 3.4, 0.1, 0.5, 0.3), 't35s-tie-cord', 'rough'))
  const paper = h('div', { class: 't35s-paper', id: 't35s-paper', hidden: true },
    codeScroll(K.code as CodeScroll, { title: K.fileName }),
    // the bottom roller, and the little cloth pouch tied to it for the attached files
    s('svg', { class: 't35s-foot', viewBox: '0 0 400 80', preserveAspectRatio: 'xMidYMin meet', 'aria-hidden': 'true' },
      ...roller(30, 370, 8, 8, 3525),
      ink(stroke(curve([316, 10], [322, 24], [318, 34], 6), 1.6, 0.1, 0.1, 0.4), 't35s-cord-ink'),
      ink('M304 40Q300 36 306 33Q318 30 330 33Q336 36 332 40Q342 52 338 64Q318 74 298 64Q294 52 304 40Z', 't35s-pouch', 'wash'),
      ink(stroke([[304, 39], [318, 42], [332, 39]], 2.4, 0.1, 0.1, 0.4) + stroke([[310, 50], [314, 66]], 1.2, 0.2, 0.3, 0.1), 'g12-edge', 'rough'),
      ink(stroke(curve([318, 42], [326, 50], [324, 58], 6), 1.8, 0.1, 0.4, 0.3), 't35s-tie-cord', 'rough')))
  // the alcove (tokonoma) the scroll hangs in: its raised floor, a vase with a plum branch
  let bloom = ''
  for (const [x, y] of [[566, 40], [598, 22], [624, 34], [548, 62], [640, 58]] as Pt[]) bloom += blob(x, y, 4.2, 4, x + y, 0.3, 8)
  const alcove = s('svg', { class: 't35s-alcove', viewBox: '0 0 720 170', preserveAspectRatio: 'xMidYMax meet', 'aria-hidden': 'true' },
    ink(blob(360, 156, 380, 14, 3527, 0.2), 'p2p-wash t35s-shadow', 'wash'),
    woodG([wood([-20, 138], [740, 136], 16, 3528), wood([-10, 152], [730, 151], 10, 3529)]),
    s('path', { d: blob(600, 112, 24, 26, 3530, 0.06, 14), fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
    ink(stroke([[586, 92], [600, 88], [614, 92]], 3, 0.1, 0.1, 0.4) + stroke(curve([578, 104], [600, 142], [624, 102], 8), 3.4, 0.2, 0.2, 0.2), 'g12-edge', 'rough'),
    ink(stroke(curve([600, 90], [584, 56], [552, 46], 10), 3.6, 0.05, 0.5, 0.3) + stroke(curve([594, 70], [612, 40], [640, 26], 10), 2.6, 0.1, 0.5, 0.3) + stroke(curve([586, 60], [570, 72], [544, 66], 8), 2, 0.1, 0.5, 0.3), 't35s-branch', 'rough'),
    ink(bloom, 't35s-bloom', 'wash'))
  const tie = h('button', { class: 't35s-tie g12-paper', type: 'button', 'aria-expanded': 'false', 'aria-controls': 't35s-paper', 'aria-label': K.codeAria, onClick: open },
    tieArt, h('span', { class: 't35s-file' }, K.fileName))
  // a round window in the wall: moonlight, a pine bough
  const win = s('svg', { class: 't35s-window', viewBox: '0 0 200 200', 'aria-hidden': 'true' },
    s('clipPath', { id: 't35s-win' }, s('circle', { cx: 100, cy: 100, r: 78 })),
    s('circle', { class: 't35s-sky', cx: 100, cy: 100, r: 78 }),
    s('g', { 'clip-path': 'url(#t35s-win)' },
      s('circle', { cx: 128, cy: 74, r: 60, fill: 'url(#p2-halo)' }),
      s('circle', { class: 't35s-moon', cx: 128, cy: 74, r: 20 }),
      mist(100, 160, 110, 26),
      pine(36, 214, 150, 3526, 1)),
    ink(stroke(Array.from({ length: 41 }, (_, i) => { const a = -1.9 + (i / 40) * Math.PI * 2.02; return [100 + Math.cos(a) * 82, 100 + Math.sin(a) * 82] as Pt }), 9, 0.04, 0.06, 0.6), 't35s-ring', 'rough'),
    ink(stroke(Array.from({ length: 21 }, (_, i) => { const a = 3.6 + (i / 20) * 1.6; return [100 + Math.cos(a) * 80, 100 + Math.sin(a) * 80] as Pt }), 2, 0.2, 0.3, 0.1), 'g12-rim'))
  const facts = h('div', { class: 't35s-facts' })
  const root = h('div', { class: 't35 t35s' }, h('p', { class: 'visually-hidden' }, K.art),
    h('div', { class: 't35s-hang' }, alcove, rod, tie, paper),
    h('div', { class: 't35s-side' }, win, facts))
  ctx.art.append(root)
  ctx.prompt(K.prompt)

  function open() {
    tie.hidden = true
    tie.setAttribute('aria-expanded', 'true')
    paper.hidden = false
    root.classList.add('is-open')
    ctx.chime('soft')
    facts.replaceChildren(...K.facts.map((f) => ctx.fact(F(f), 'p')))
    paper.querySelector<HTMLElement>('button, [tabindex]')?.focus()
    ctx.insight(F(K.insight), K.detail)
  }
}
