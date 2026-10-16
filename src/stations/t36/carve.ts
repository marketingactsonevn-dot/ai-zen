import { h, s } from '../../core/dom'
import { L } from '../../core/content'
import { blob, clamp, curve, rng, stroke, type Pt } from '../../ui/part2/ink'
import { stepPath, type PathGeo } from '../../ui/part2/steps'
import { codeScroll } from '../../ui/part2/code'
import { hills, mist, moon } from '../../ui/part2/paint'
import type { CodeScroll, StepPath } from '../../ui/part2/types'
import type { SceneCtx } from '../types'
import { C } from './content'
import { doorway, F, f1, ink, lake, P, pebble, wood, woodG } from '../t34/night'

const K = C.scenes.carve

/**
 * The log on its stand, centred at (x, y), `len` long: seven stages `.t36c-s1…7`, each shown by CSS once that many stones
 * lie on the path — layout lines, first cuts, the rough fish, the split tail, fins, scales, the eye — while the log fades.
 */
function log(x: number, y: number, len: number, seed: number): SVGElement[] {
  const r = rng(seed)
  const R = len * 0.16
  const L0 = x - len / 2, L1 = x + len / 2
  const k = (u: number, v: number): Pt => [x + u * len, y + v * R]
  const body = `M${P(k(-0.5, -1))}L${P(k(0.5, -1))}Q${P(k(0.54, 0))} ${P(k(0.5, 1))}L${P(k(-0.5, 1))}Q${P(k(-0.54, 0))} ${P(k(-0.5, -1))}Z`
  let bark = ''
  for (let i = 0; i < 9; i++) {
    const v = -0.8 + r() * 1.6, u0 = -0.48 + r() * 0.5
    bark += stroke([k(u0, v), k(u0 + 0.12 + r() * 0.3, v + (r() - 0.5) * 0.1)], 1 + r(), 0.3, 0.3, 0.2)
  }
  let rings = ''
  for (let i = 1; i < 4; i++) rings += stroke(Array.from({ length: 17 }, (_, j) => { const a = (j / 16) * Math.PI * 2; return [L1 + Math.cos(a) * R * 0.14 * i, y + Math.sin(a) * R * 0.28 * i] as Pt }), 0.9, 0.1, 0.1, 0.4)
  // the fish's profile on the log: head left, tail right
  const fish = `M${P(k(-0.46, 0.05))}Q${P(k(-0.3, -1.05))} ${P(k(0.02, -0.82))}Q${P(k(0.24, -0.62))} ${P(k(0.33, -0.16))}L${P(k(0.48, -0.86))}Q${P(k(0.43, 0))} ${P(k(0.48, 0.86))}L${P(k(0.33, 0.16))}Q${P(k(0.22, 0.66))} ${P(k(0, 0.8))}Q${P(k(-0.3, 0.98))} ${P(k(-0.46, 0.05))}Z`
  let scales = ''
  for (let i = 0; i < 4; i++) for (let j = -1; j <= 1; j++) {
    const [cx, cy] = k(-0.12 + i * 0.09, j * 0.38)
    scales += stroke(curve([cx - R * 0.18, cy - R * 0.2], [cx + R * 0.14, cy], [cx - R * 0.18, cy + R * 0.2], 6), 1, 0.2, 0.2, 0.3)
  }
  let chips = ''
  for (let i = 0; i < 14; i++) {
    const cx = L0 + r() * len * 1.1, cy = y + R * 2.2 + r() * R * 0.9
    chips += blob(cx, cy, 2 + r() * 3.5, 1 + r() * 1.5, seed + 30 + i, 0.4, 7)
  }
  const stand = woodG([
    wood([L0 + len * 0.12, y + R * 0.7], [L0 + len * 0.02, y + R * 2.6], R * 0.22, seed + 1),
    wood([L0 + len * 0.12, y + R * 0.7], [L0 + len * 0.26, y + R * 2.6], R * 0.22, seed + 2),
    wood([L1 - len * 0.14, y + R * 0.7], [L1 - len * 0.26, y + R * 2.6], R * 0.22, seed + 3),
    wood([L1 - len * 0.14, y + R * 0.7], [L1 - len * 0.02, y + R * 2.6], R * 0.22, seed + 4),
    wood([L0 + len * 0.05, y + R * 0.9], [L1 - len * 0.05, y + R * 0.9], R * 0.28, seed + 5),
  ])
  return [
    ink(blob(x, y + R * 2.7, len * 0.62, R * 0.35, seed + 6, 0.2), 'p2p-wash t36c-floor', 'wash'),
    s('g', { class: 't36c-chips t36c-s2' }, ink(chips, 't36c-chip', 'rough')),
    stand,
    s('g', { class: 't36c-log' },
      s('path', { class: 't36c-wood', d: body, filter: 'url(#ink-rough)' }),
      ink(`M${P(k(-0.52, 0.15))}L${P(k(0.52, 0.15))}Q${P(k(0.54, 0.6))} ${P(k(0.5, 1))}L${P(k(-0.5, 1))}Q${P(k(-0.54, 0.6))} ${P(k(-0.52, 0.15))}Z`, 't36c-shade', 'wash'),
      ink(bark, 't36c-bark', 'dry'),
      ink(stroke([k(-0.5, -1), k(0, -1.02), k(0.5, -1)], R * 0.12, 0.05, 0.1, 0.4) + stroke([k(-0.5, 1), k(0, 1.02), k(0.5, 1)], R * 0.18, 0.05, 0.05, 0.4) + stroke(curve(k(-0.5, -1), k(-0.56, 0), k(-0.5, 1), 8), R * 0.1, 0.1, 0.1, 0.4), 'g12-edge', 'rough'),
      ink(stroke([k(-0.44, -0.86), k(0.1, -0.9), k(0.44, -0.84)], R * 0.08, 0.2, 0.3, 0.1), 'g12-rim'),
      s('ellipse', { class: 't36c-end', cx: f1(L1), cy: f1(y), rx: f1(R * 0.5), ry: f1(R * 0.98) }),
      ink(rings, 't36c-bark')),
    s('g', { class: 't36c-s1' }, s('path', { class: 't36c-chalk', d: fish })),
    s('g', { class: 't36c-s2' }, ink(stroke([k(-0.5, -0.9), k(-0.42, -0.2)], R * 0.18, 0.1, 0.1, 0.5) + stroke([k(0.5, -0.95), k(0.4, -0.3)], R * 0.18, 0.1, 0.1, 0.5) + stroke([k(0.5, 0.95), k(0.4, 0.3)], R * 0.18, 0.1, 0.1, 0.5), 't36c-cut', 'rough')),
    s('g', { class: 't36c-s3' }, s('path', { class: 't36c-fish', d: fish, filter: 'url(#ink-rough)' })),
    s('g', { class: 't36c-s4' }, ink(stroke([k(0.34, 0), k(0.44, 0)], R * 0.12, 0.1, 0.6, 0.3) + stroke(curve(k(0.33, -0.16), k(0.4, -0.4), k(0.48, -0.86), 6), R * 0.07, 0.1, 0.1, 0.3) + stroke(curve(k(0.33, 0.16), k(0.4, 0.4), k(0.48, 0.86), 6), R * 0.07, 0.1, 0.1, 0.3), 't36c-line', 'rough')),
    s('g', { class: 't36c-s5' }, ink(stroke(curve(k(-0.28, -0.6), k(-0.24, 0), k(-0.28, 0.6), 8), R * 0.07, 0.1, 0.1, 0.3) + stroke(curve(k(-0.06, 0.5), k(0.02, 1.0), k(0.1, 0.62), 6), R * 0.08, 0.1, 0.3, 0.3) + stroke(curve(k(-0.04, -0.78), k(0.06, -1.1), k(0.14, -0.66), 6), R * 0.08, 0.1, 0.3, 0.3), 't36c-line', 'rough')),
    s('g', { class: 't36c-s6' }, ink(scales, 't36c-line', 'dry')),
    s('g', { class: 't36c-s7' },
      ink(blob(x - len * 0.36, y - R * 0.22, R * 0.12, R * 0.12, seed + 7, 0.1, 8), 't36c-eye'),
      ink(stroke(curve(k(-0.34, -0.62), k(-0.1, -0.86), k(0.16, -0.58), 10), R * 0.1, 0.3, 0.3, 0.1), 'g12-rim')),
  ]
}

/** Scene 3's painting (stepPath art): the night wood shop — the timber pile, the log becoming a fish, the door open on the moon lake. */
function carveArt(g: PathGeo): SVGElement[] {
  const { w, h, row, first, last, top, pathY, seed } = g
  if (!row) {
    const cw = first[0] * 2
    const dy = last[1] + clamp(h * 0.12, 60, 96)
    const dh = clamp(h * 0.12, 60, 96), dw = dh * 0.62
    return [
      lake(last[0] - cw * 0.2, dy - dh * 0.3, last[0] + cw * 1.4, dy + dh * 0.14, seed + 1, last[0] + cw * 0.6),
      doorway(last[0] - dw / 2, dy, dw, dh, seed + 2, true),
      ...log(last[0] + cw * 0.95, dy - dh * 0.55, cw * 0.95, seed + 3),
    ]
  }
  const skyH = pathY - top
  const dh = clamp(skyH * 0.66, 70, 200), dw = dh * 0.62
  const dx = Math.min(w - dw - 8, last[0] - dw * 0.5)
  const len = clamp(Math.min(w * 0.2, skyH * 1.1), 110, 270)
  const lx = w * 0.5, ly = pathY - 10 - len * 0.16 * 2.6
  // the timber pile at the path's start: log ends stacked in a pyramid
  const ends: SVGElement[] = []
  const er = clamp(skyH * 0.09, 10, 26)
  const px = Math.max(er * 3, first[0] + er * 0.5)
  for (const [c, rw] of [[0, 0], [1, 0], [2, 0], [0.5, 1], [1.5, 1], [1, 2]] as const) {
    const ex = px - er * 2 + c * er * 2, ey = pathY - 4 - er - rw * er * 1.75
    ends.push(s('ellipse', { class: 't36c-end', cx: f1(ex), cy: f1(ey), rx: f1(er), ry: f1(er * 0.92) }),
      ink(stroke(Array.from({ length: 17 }, (_, j) => { const a = (j / 16) * Math.PI * 2; return [ex + Math.cos(a) * er, ey + Math.sin(a) * er * 0.92] as Pt }), 1.6, 0.05, 0.05, 0.5) + blob(ex, ey, er * 0.4, er * 0.35, seed + c * 7 + rw, 0.2, 8), 't36c-bark', 'rough'))
  }
  return [
    // the shop's beam, its back wall fading, the door on the moonlit lake
    woodG([wood([-10, top + skyH * 0.1], [w + 10, top + skyH * 0.08], 10, seed + 4)], 't36c-beam'),
    s('g', { 'clip-path': `url(#t36c-door-${seed})` },
      s('rect', { class: 't36c-night', x: f1(dx), y: f1(pathY - 2 - dh), width: f1(dw), height: f1(dh) }),
      moon(dx + dw * 0.3, pathY - dh * 0.74, Math.min(dw * 0.16, 18), seed, true),
      hills(dx - 10, dx + dw + 10, pathY - dh * 0.28, dh * 0.22, seed + 5, 0.8, 2),
      lake(dx - 20, pathY - dh * 0.3, dx + dw + 20, pathY - 2, seed + 6, dx + dw * 0.3),
      mist(dx + dw / 2, pathY - dh * 0.3, dw, dh * 0.08)),
    s('clipPath', { id: `t36c-door-${seed}` }, s('rect', { x: f1(dx), y: f1(pathY - 2 - dh), width: f1(dw * 0.52), height: f1(dh) })),
    doorway(dx, pathY - 2, dw, dh, seed + 7, true),
    ink(blob(px, pathY - 2, er * 3.6, er * 0.4, seed + 8, 0.2), 'p2p-wash t36c-floor', 'wash'),
    ...ends,
    ...log(lx, ly, len, seed + 9),
    // mallet and chisel on the floor by the stand
    ink(stroke([[lx + len * 0.42, pathY - 6], [lx + len * 0.62, pathY - 12]], 3, 0.05, 0.05, 0.6) + blob(lx + len * 0.66, pathY - 13, 9, 6, seed + 10, 0.1, 10), 't36c-tool', 'rough'),
    pebble(lx - len * 0.6, pathY - 2, 10, seed + 11),
  ]
}

/** Scene 3 — seven stones from the timber pile to the door (stepPath), with the code scroll and the seven sample prompts one tap away. */
export function carveScene(ctx: SceneCtx) {
  const off = stepPath(K.steps as StepPath, { label: K.label, prompt: K.prompt, insight: F(K.insight), detail: K.detail, art: carveArt }).mount(ctx)
  if (off) ctx.onCleanup(off)
  const close = h('button', { class: 'g12-close', type: 'button' }, L.close)
  const sheet = h('div', { class: 'g12-sheet t36k-sheet', role: 'region', 'aria-label': K.codeAria, hidden: true }, close,
    h('div', { class: 't36k-body' },
      h('div', { class: 't36k-code' }, codeScroll(K.code as CodeScroll, { title: K.fileName })),
      h('div', { class: 't36k-prompts' }, h('p', { class: 'p2-eyebrow' }, K.promptLabel),
        h('ol', null, ...K.prompts.map((p, i) => h('li', null, h('span', { class: 't36k-step' }, K.steps.steps[i].label), p))))))
  const open = h('button', { class: 'g12-pill t36k-open', type: 'button', 'aria-expanded': 'false' }, K.fileName, ' · ', K.promptLabel)
  const set = (on: boolean) => {
    sheet.hidden = !on
    open.setAttribute('aria-expanded', String(on))
    ;(on ? close : open).focus()
  }
  open.addEventListener('click', () => set(true))
  close.addEventListener('click', () => set(false))
  const esc = (e: KeyboardEvent) => e.key === 'Escape' && !sheet.hidden && set(false)
  addEventListener('keydown', esc)
  ctx.onCleanup(() => removeEventListener('keydown', esc))
  ctx.art.append(h('div', { class: 't36 t36k' }, open, sheet))
}
