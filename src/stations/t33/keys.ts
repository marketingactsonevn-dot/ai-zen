import raw from '../../content/tram-33.json'
import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { cardSheet, live, stroke } from '../t31/kit'

const K = raw.scenes.keys

/** A bronze key (viewBox 0 0 60 24): bow ring, shaft, bit. */
const keyArt = () => s('svg', { class: 't33y-key', viewBox: '0 0 60 24', 'aria-hidden': 'true' },
  s('circle', { class: 't33y-metal', cx: 11, cy: 12, r: 9 }),
  s('circle', { class: 't33y-hole', cx: 11, cy: 12, r: 3.6 }),
  s('path', { class: 't33y-metal', d: 'M19 10h36v4H19zM44 14h4v6h-4zM51 14h4v8h-4z' }))

/** A stone lantern (tōrō) with the ring hanging under its roof (viewBox 0 0 120 120). */
const toroArt = () => s('svg', { class: 't33y-toro', viewBox: '0 0 120 120', 'aria-hidden': 'true' },
  s('path', { class: 'g11-ink', d: 'M20 34Q60 10 100 34Q60 28 20 34Z' }),
  s('path', { class: 't33y-stone', d: 'M38 36h44v30H38z' }),
  s('rect', { class: 't33y-light', x: 50, y: 42, width: 20, height: 18 }),
  s('path', { class: 't33y-stone', d: 'M30 66h60l-6 8H36zM52 74h16v36H52zM36 110h48v8H36z' }),
  s('path', { class: 'g11-ink', 'fill-opacity': 0.5, d: stroke([[38, 66], [82, 66]], 1.4, 0.1, 0.1) }))

/** Scene 2 — a ring of keys under a stone lantern: hand the agent only the keys this one job needs. */
export function keysScene(ctx: SceneCtx) {
  const given = new Set<string>()
  const say = live('g11-say t33y-say')
  const ring = h('div', { class: 't33y-zone kept' })
  const hand = h('div', { class: 't33y-zone given' })
  const keys = K.keys.map((k) => {
    const st = h('span', { class: 't33y-st' }, K.keep)
    const b = h('button', { class: 't33y-k', type: 'button', 'aria-pressed': 'false', onClick: () => toggle(k.id) }, keyArt(), h('span', { class: 't33y-l' }, k.label), st)
    ring.append(b)
    return { k, b, st }
  })
  const check = h('button', { class: 'g11-pill t33y-check', type: 'button', onClick: judge }, K.check)
  const root = h('div', { class: 'g11 t33y', role: 'group', 'aria-label': K.aria },
    h('p', { class: 'visually-hidden' }, K.art),
    h('p', { class: 'g11-q t33y-task' }, K.task),
    h('div', { class: 't33y-board' },
      h('section', { class: 't33y-side' }, toroArt(), h('p', { class: 'p2-eyebrow' }, K.keep), ring),
      h('section', { class: 't33y-side' }, h('p', { class: 'p2-eyebrow' }, K.give), hand)),
    say, check)
  ctx.art.append(root)
  const sheet = cardSheet(root, K.takeaway, ctx.onCleanup)
  let solved = false

  const label = () => keys.forEach(({ k, b, st }) => {
    const on = given.has(k.id)
    b.setAttribute('aria-pressed', String(on))
    b.setAttribute('aria-label', fill(K.keyAria, { label: k.label, state: on ? K.given : K.kept }))
    st.textContent = on ? K.give : K.keep
  })

  function toggle(id: string) {
    const x = keys.find((v) => v.k.id === id)!
    const on = !given.has(id)
    on ? given.add(id) : given.delete(id)
    const focused = document.activeElement === x.b
    ;(on ? hand : ring).append(x.b)
    if (focused) x.b.focus({ preventScroll: true })
    label()
    ctx.chime('tap')
    say.say(on ? h('span', null, h('strong', null, `${x.k.label}: `), x.k.risk) : '')
  }

  function judge() {
    const extra = K.keys.filter((k) => given.has(k.id) && !k.need).length
    const missing = K.keys.some((k) => k.need && !given.has(k.id))
    if (extra) return void (ctx.chime('low'), say.say(h('span', { class: 'bad' }, fill(K.tooMany, { n: extra }))))
    if (missing) return void (ctx.chime('low'), say.say(h('span', { class: 'bad' }, K.tooFew)))
    ctx.chime('ok')
    say.say(K.right)
    root.classList.add('solved')
    if (solved) return
    solved = true
    ctx.insight(K.insight as Fact, K.detail as Fact)
    sheet.show()
  }
  label()
  ctx.prompt(K.prompt)
}
