import raw from '../../content/tram-33.json'
import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { p2Defs } from '../../ui/part2/ink'
import { toro } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import { cardSheet, curve, live, night, stroke } from '../t31/kit'

const K = raw.scenes.keys

/** A bronze key (viewBox 0 0 60 24): a ring bow with a cut-out, a shaft, a toothed bit, moonlight along its back. */
const keyArt = () => s('svg', { class: 't33y-key', viewBox: '0 0 60 24', 'aria-hidden': 'true' },
  s('path', { class: 't33y-metal', d: 'M11 2.6A9.4 9.4 0 1 1 10.99 2.6ZM11 8.4A3.6 3.6 0 1 0 11.01 8.4Z', 'fill-rule': 'evenodd', filter: 'url(#ink-rough)' }),
  s('path', { class: 't33y-metal', d: 'M19.5 10.2Q36 9.4 56 10.4L56.6 13.8Q36 14.6 19.5 13.8ZM42 13.6h4.2v5.6H42ZM49.4 13.6h4.4l-.4 7.4h-4Z', filter: 'url(#ink-rough)' }),
  s('path', { class: 't33y-glint', d: stroke([[4, 9], [8, 4], [14, 3.4]], 1.4, 0.2, 0.3, 0.2) + stroke([[22, 10.6], [54, 10.8]], 0.9, 0.1, 0.3, 0.2) }))

/** The stone lantern with the bunch of keys hanging under its roof (viewBox 0 0 120 130). */
function toroArt(): SVGSVGElement {
  p2Defs()
  // an iron ring on a cord from the roof's corner, five small keys hanging from it
  let keys = ''
  for (let i = 0; i < 5; i++) {
    const a = 0.5 + i * 0.5
    const x = 95 + Math.cos(a) * 7, y = 70 + Math.sin(a) * 7
    keys += stroke([[x, y], [x + Math.cos(a) * 14, y + Math.sin(a) * 14 + 4]], 1.8, 0.1, 0.2, 0.4)
  }
  return s('svg', { class: 't33y-toro', viewBox: '0 0 120 130', 'aria-hidden': 'true' },
    toro(56, 126, 112, true),
    s('path', { class: 'g11-thread', d: 'M94 55Q95 60 95 63' }),
    s('circle', { class: 't33y-ring', cx: 95, cy: 70, r: 7 }),
    s('path', { class: 't33y-keys', d: keys }),
    s('path', { class: 't33y-glint', d: stroke(curve([90, 66], [95, 62], [100, 66], 6), 1.2, 0.2, 0.3, 0.2) }))
}

/** Scene 2 — a ring of keys under a stone lantern: hand the agent only the keys this one job needs. */
export function keysScene(ctx: SceneCtx) {
  const given = new Set<string>()
  const say = live('g11-say t33y-say')
  const ring = h('div', { class: 't33y-zone kept' })
  const hand = h('div', { class: 't33y-zone given' })
  const keys = K.keys.map((k) => {
    const st = h('span', { class: 't33y-st' }, K.keep)
    const b = h('button', { class: 't33y-k g11-dopaper', type: 'button', 'aria-pressed': 'false', onClick: () => toggle(k.id) }, keyArt(), h('span', { class: 't33y-l' }, k.label), st)
    ring.append(b)
    return { k, b, st }
  })
  const check = h('button', { class: 'g11-pill t33y-check', type: 'button', onClick: judge }, K.check)
  const root = h('div', { class: 'g11 g11-nomoon t33y', role: 'group', 'aria-label': K.aria },
    night({ low: true }),
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
