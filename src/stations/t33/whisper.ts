import raw from '../../content/tram-33.json'
import { h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { onSize } from '../../ui/part2/ink'
import { grass } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import { blob, cardSheet, ground, lantern, live, night, rng, stroke, type Pt } from '../t31/kit'

const f1 = (n: number) => (Math.round(n * 10) / 10).toString()

/** The wet stone step under the letter (stage px W × H): a broad slab and the step below, dew beads, moss, moonlight sheen. */
function paintStep(svg: SVGSVGElement, W: number, H: number) {
  const r = rng(3330)
  const pad = Math.min(46, W * 0.08)
  const x0 = -pad, x1 = W + pad, y0 = H * 0.18, y1 = H + 26
  const slab = `M${f1(x0 + 6)} ${f1(y0)}Q${f1(W / 2)} ${f1(y0 - 10)} ${f1(x1 - 4)} ${f1(y0 + 2)}L${f1(x1 + 6)} ${f1(y1)}Q${f1(W / 2)} ${f1(y1 + 6)} ${f1(x0 - 6)} ${f1(y1 - 2)}Z`
  const riser = `M${f1(x0 - 6)} ${f1(y1 - 2)}Q${f1(W / 2)} ${f1(y1 + 6)} ${f1(x1 + 6)} ${f1(y1)}L${f1(x1 + 4)} ${f1(y1 + 16)}Q${f1(W / 2)} ${f1(y1 + 22)} ${f1(x0 - 4)} ${f1(y1 + 14)}Z`
  let dew = '', sheen = ''
  for (let i = 0; i < 26; i++) {
    const x = x0 + r() * (x1 - x0), y = y0 + 8 + r() * (y1 - y0 - 12)
    if (x > 8 && x < W - 8 && y < H - 4) continue // under the paper: no dew drawn
    dew += blob(x, y, 1.2 + r() * 1.4, 1 + r(), 3331 + i, 0.1, 8)
  }
  for (let i = 0; i < 5; i++) {
    const y = y0 + 14 + i * ((y1 - y0) / 5)
    const xs = r() < 0.5 ? x0 + 4 : W - 2
    sheen += stroke([[xs, y], [xs + pad * (0.6 + r()), y + 1]], 1.4, 0.3, 0.3, 0.1)
  }
  const crack: Pt[] = [[x1 - 10, y0 + 30], [x1 - 22, y0 + 60], [x1 - 14, y0 + 92]]
  svg.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
  svg.replaceChildren(
    ground(W / 2, y1 + 22, W * 0.7, 14, 3332, 0.26),
    s('path', { class: 't33w-riser', d: riser, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
    s('path', { class: 't33w-riser-sh', d: riser }),
    s('path', { class: 't33w-slab', d: slab, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
    s('path', { class: 't33w-wet', d: slab }),
    s('path', { class: 'g11-wash t33w-ink', d: stroke([[x0 - 6, y1 - 2], [W / 2, y1 + 5], [x1 + 6, y1]], 2.4, 0.05, 0.05, 0.4) + stroke(crack, 1.4, 0.2, 0.4, 0.3), filter: 'url(#ink-rough)' }),
    s('path', { class: 'g11-moonlit', d: stroke([[x0 + 10, y0 + 1], [W * 0.4, y0 - 5], [W * 0.8, y0 - 3]], 2, 0.1, 0.5, 0.2) + sheen }),
    s('path', { class: 't33w-under', d: `M6 8L${f1(W + 6)} 10L${f1(W + 8)} ${f1(H + 8)}L4 ${f1(H + 6)}Z`, filter: 'url(#ink-wash)' }),
    s('path', { class: 't33w-dew', d: dew }),
    s('path', { class: 'g11-mossy', d: blob(x0 + 8, y1 - 6, 30, 7, 3333, 0.35, 12) + blob(x1 - 4, y0 + 20, 12, 18, 3334, 0.35, 12), filter: 'url(#ink-wash)' }),
    grass(x0 + 4, y1 + 12, 26, 3335), grass(x1 - 6, y1 + 13, 22, 3336))
}

const K = raw.scenes.whisper

/** Scene 3 — a polite letter on a wet step; hold the lantern behind it and the hidden instruction shows like a watermark. */
export function whisperScene(ctx: SceneCtx) {
  const L = K.letter
  const hidden = h('p', { class: 't33w-hidden', 'aria-hidden': 'true' }, L.hidden)
  const shown = h('p', { class: 't33w-hidden t33w-lit', 'aria-hidden': 'true' }, L.hidden)
  const lamp = h('button', { class: 't33w-lamp', type: 'button', 'aria-label': K.lanternAria }, lantern('on'))
  const letter = h('div', { class: 't33w-letter' },
    h('p', { class: 'g11-mock' }, K.mock),
    h('p', { class: 't33w-from' }, L.from),
    ...L.visible.map((t) => h('p', { class: 't33w-line' }, t)),
    h('div', { class: 't33w-wm' }, hidden, shown),
    lamp)
  const say = live('g11-say t33w-say')
  const step = s('svg', { class: 't33w-step', 'aria-hidden': 'true' })
  const stage = h('div', { class: 't33w-stage' }, step, letter)
  const root = h('div', { class: 'g11 t33w', role: 'group', 'aria-label': K.aria },
    night({ low: true }),
    h('p', { class: 'visually-hidden' }, K.art),
    stage, say)
  ctx.art.append(root)
  ctx.onCleanup(onSize(stage, () => paintStep(step, stage.clientWidth, stage.clientHeight)))
  const sheet = cardSheet(root, K.takeaway, ctx.onCleanup)
  let done = false

  function reveal() {
    if (done) return
    done = true
    letter.classList.add('shown')
    ctx.chime('low')
    say.say(h('p', { class: 'visually-hidden' }, L.hidden), h('p', null, K.revealed))
    ctx.insight(K.insight as Fact, K.detail as Fact)
    sheet.show()
  }

  // drag: one size read on pointerdown, then only style writes
  let box: DOMRect | null = null
  let wm: DOMRect | null = null
  let x = 0, y = 0
  let x0 = 0, y0 = 0, moved = false
  const move = (cx: number, cy: number) => {
    if (!box) return
    moved ||= Math.hypot(cx - x0, cy - y0) > 8
    x = Math.max(0, Math.min(box.width, cx - box.left))
    y = Math.max(0, Math.min(box.height, cy - box.top))
    letter.style.setProperty('--lx', `${x}px`)
    letter.style.setProperty('--ly', `${y}px`)
    if (wm && cx > wm.left + wm.width * 0.2 && cx < wm.right - wm.width * 0.2 && cy > wm.top - 30 && cy < wm.bottom + 30) reveal()
  }
  lamp.addEventListener('pointerdown', (e) => {
    box = letter.getBoundingClientRect()
    wm = hidden.getBoundingClientRect()
    letter.style.setProperty('--wm-left', `${wm.left - box.left}px`)
    letter.style.setProperty('--wm-top', `${wm.top - box.top}px`)
    lamp.setPointerCapture(e.pointerId)
    letter.classList.add('drag')
    ;[x0, y0, moved] = [e.clientX, e.clientY, false]
  })
  lamp.addEventListener('pointermove', (e) => box && move(e.clientX, e.clientY))
  const up = () => {
    box = null
    letter.classList.remove('drag')
  }
  lamp.addEventListener('pointerup', up)
  lamp.addEventListener('pointercancel', up)
  // keyboard (Space/Enter) or a tap without dragging: the lantern sweeps across the hidden line by itself
  lamp.addEventListener('click', () => {
    if (moved) return
    letter.classList.add('swept')
    reveal()
  })
  ctx.prompt(K.prompt)
}
