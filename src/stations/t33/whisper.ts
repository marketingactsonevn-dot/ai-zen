import raw from '../../content/tram-33.json'
import { h } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { cardSheet, lantern, live } from '../t31/kit'

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
  const root = h('div', { class: 'g11 t33w', role: 'group', 'aria-label': K.aria },
    h('p', { class: 'visually-hidden' }, K.art),
    letter, say)
  ctx.art.append(root)
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
