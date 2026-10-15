import { fill, h, s } from '../../core/dom'
import type { SceneCtx } from '../types'
import { C } from './content'
import { F, nightSky, paperLantern } from './night'

const K = C.scenes.market
const TONES = ['--lantern', '--vermilion', '--moon']

/** Scene 1 — a night market by the lake: one big stall under a cluster of lanterns, two small ones under a single lantern. Tap a task slip, then a stall. */
export function marketScene(ctx: SceneCtx) {
  let picked = -1
  const placed = new Set<number>()
  const factShown = new Set<string>()
  const note = h('div', { class: 't34m-note', 'aria-live': 'polite' })

  const slips = K.tasks.map((t, i) =>
    h('button', { class: 't34m-slip', type: 'button', 'aria-pressed': 'false', onClick: () => pick(i) }, t.text))
  const stalls = K.stalls.map((st, i) => {
    const roof = s('svg', { class: 't34m-roof', viewBox: '0 0 120 64', 'aria-hidden': 'true' },
      s('path', { d: 'M6 22 Q60 4 114 22 L108 28 Q60 14 12 28Z', style: 'fill:var(--ink);opacity:.82' }),
      s('path', { d: 'M18 28V64M102 28V64', style: 'stroke:var(--ink);stroke-opacity:.55;stroke-width:2.4' }))
    const n = st.id === 'hub' ? 3 : 1
    for (let k = 0; k < n; k++) roof.append(paperLantern(n === 1 ? 60 : 36 + k * 24, 24, 6 + (k % 2) * 7, 0.72, TONES[k]))
    const basket = h('ul', { class: 't34m-basket' })
    const src = (C.sources as Record<string, { url?: string }>)[st.source]
    const btn = h('button', { class: 't34m-drop', type: 'button', onClick: () => drop(i) },
      roof, h('span', { class: 't34m-name' }, st.name), h('span', { class: 't34m-what' }, st.what), h('span', { class: 't34m-ex' }, st.example))
    const el = h('div', { class: `t34m-stall t34m-${st.id}` }, btn,
      src?.url ? h('a', { class: 't34m-link', href: src.url, target: '_blank', rel: 'noopener' }, K.officialLabel) : null, basket)
    return { el, btn, basket }
  })

  const root = h('div', { class: 't34 t34m' },
    nightSky(800, 500, [690, 70, 26], 430, 34),
    h('p', { class: 'visually-hidden' }, K.art),
    h('div', { class: 't34m-row', role: 'group', 'aria-label': K.group }, ...stalls.map((x) => x.el)),
    h('div', { class: 't34m-tasks', role: 'group', 'aria-label': K.taskGroup }, ...slips),
    note,
    h('p', { class: 't34m-vol' }, K.volatile))
  ctx.art.append(root)
  ctx.prompt(K.prompt)

  function pick(i: number) {
    picked = picked === i ? -1 : i
    slips.forEach((b, k) => b.setAttribute('aria-pressed', String(k === picked)))
    root.classList.toggle('is-picking', picked >= 0)
    stalls.forEach((st, k) => st.btn.setAttribute('aria-label', picked >= 0 ? fill(K.dropAria, { task: K.tasks[picked].text, stall: K.stalls[k].name }) : K.stalls[k].name))
  }

  function drop(si: number) {
    if (picked < 0) {
      slips.find((_, k) => !placed.has(k))?.focus()
      return
    }
    const t = K.tasks[picked]
    const st = K.stalls[si]
    if (!t.fits.includes(st.id)) {
      note.replaceChildren(h('p', { class: 't34m-wrong' }, K.wrong))
      slips[picked].classList.remove('shake')
      void slips[picked].offsetWidth
      slips[picked].classList.add('shake')
      ctx.chime('low')
      return
    }
    ctx.chime('ok')
    placed.add(picked)
    slips[picked].hidden = true
    stalls[si].basket.append(h('li', null, t.text))
    const others = t.fits.filter((f) => f !== st.id).map((f) => K.stalls.find((x) => x.id === f)!.name)
    note.replaceChildren(h('p', null, h('strong', null, K.right), ' ', t.why, others.length ? h('span', { class: 't34m-also' }, ' ' + fill(K.also, { stalls: others.join(', ') })) : null))
    // the stall's own claim (◇) the first time something lands there
    const fx = K.facts.filter((f) => f.source.startsWith(st.source))
    if (!factShown.has(st.id) && fx[0]) {
      factShown.add(st.id)
      note.append(ctx.fact(F(fx[0]), 'p', 't34m-fact'))
    }
    pick(-1)
    const next = slips.find((_, k) => !placed.has(k))
    if (next) next.focus()
    else {
      stalls[si].btn.focus()
      ctx.insight(F(K.insight), K.detail)
    }
  }
}
