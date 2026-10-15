import { h, s } from '../../core/dom'
import { L } from '../../core/content'
import { stroke } from '../../ui/part2/ink'
import { findTakeaway, takeaway } from '../../ui/part2/takeaway'
import type { SceneCtx } from '../types'
import C from '../../content/tram-27.json'
import { F, f1, grad, place, stage } from '../t25/kit'

/** Scene 3 — two hand mirrors on a lacquer tray: tilt each to see its answer to the same question. */
export function flatterScene(ctx: SceneCtx) {
  const K = C.scenes.flatter
  const M = [K.gilded, K.bronze]
  const seen = [false, false]
  let done = false
  const mirrors = M.map(() => s('g', { class: 't27g-m' }))
  const btns = M.map((m, i) => h('button', { class: 'zk-hit t27g-mirror', type: 'button', 'aria-label': m.aria, 'aria-pressed': 'false', onClick: () => tilt(i) }))
  const q = h('div', { class: 't27g-q' }, h('p', null, K.question))
  const ansWho = h('p', { class: 'p2-eyebrow' })
  const ansText = h('p', { class: 't27g-ans-text' })
  const see = h('p', { class: 'zk-small t27g-see', hidden: true }, K.seeAlso)
  const ans = h('div', { class: 'zk-note t27g-ans', hidden: true }, ansWho, ansText, ctx.fact(F(K.note), 'div', 'zk-small'), see)
  const card = findTakeaway(K.takeaway)
  const takeBtn = h('button', { class: 'zk-btn t27g-take', type: 'button', hidden: true, onClick: open }, K.takeawayLabel)
  const col = h('div', { class: 't27g-col' }, ans, takeBtn)
  const close = h('button', { class: 'zk-btn t27g-close', type: 'button', onClick: shut }, L.close)
  const sheet = h('div', { class: 't27g-sheet', hidden: true, role: 'dialog', 'aria-label': K.takeawayLabel }, close, card ? takeaway(card) : null)

  const { root, svg } = stage(ctx, 't27g', K.art, [K.insight], (W, H) => {
    const land = W / H > 1.05
    const tw = land ? Math.min(W * 0.62, 760) : W - 20
    const th = land ? Math.min(tw * 0.42, H * 0.5) : Math.min(tw * 0.78, H * 0.46)
    const tx = (W - tw) / 2, ty = 8
    const qw = land ? tw * 0.3 : tw * 0.84
    const face = grad(svg, [[0, '--moon', 0.9], [0.7, '--water', 0.35], [1, '--water', 0.6]], 'r')
    const mr = land ? Math.min(th * 0.34, tw * 0.15) : Math.min(tw * 0.2, th * 0.26)
    const my = land ? ty + th * 0.46 : ty + th * 0.62
    const mx = land ? [tx + tw * 0.2, tx + tw * 0.8] : [tx + tw * 0.27, tx + tw * 0.73]
    mirrors.forEach((g, i) => {
      const x = mx[i], y = my, dir = i ? 1 : -1
      const petals = i ? [] : Array.from({ length: 12 }, (_, k) => {
        const a = (k / 12) * Math.PI * 2
        return s('ellipse', { class: 't27g-petal', cx: x + Math.cos(a) * mr * 1.1, cy: y + Math.sin(a) * mr * 1.1, rx: mr * 0.07, ry: mr * 0.04, transform: `rotate(${f1((a * 180) / Math.PI)} ${f1(x + Math.cos(a) * mr * 1.1)} ${f1(y + Math.sin(a) * mr * 1.1)})` })
      })
      g.style.transformOrigin = `${f1(x)}px ${f1(y + mr)}px`
      g.replaceChildren(
        s('path', { class: i ? 't27g-bronze' : 't27g-gold', d: stroke([[x, y + mr], [x + dir * mr * 0.25, y + mr * 1.9]], mr * 0.2, 0.05, 0.1, 0.8) }),
        s('circle', { class: i ? 't27g-bronze' : 't27g-gold', cx: x, cy: y, r: mr * 1.18 }),
        ...petals,
        s('circle', { cx: x, cy: y, r: mr, fill: face, class: 't27g-face' }),
        s('path', { class: 't27g-glint', d: stroke([[x - mr * 0.55, y - mr * 0.2], [x - mr * 0.2, y - mr * 0.6]], mr * 0.08, 0.3, 0.3) + stroke([[x - mr * 0.4, y + mr * 0.1], [x + mr * 0.05, y - mr * 0.45]], mr * 0.05, 0.3, 0.3) }))
      place(btns[i], x - mr * 1.25, y - mr * 1.25, mr * 2.5)
      btns[i].style.height = `${f1(mr * 3.2)}px`
    })
    svg.replaceChildren(
      s('rect', { class: 'zk-sh', x: tx + 10, y: ty + th - 4, width: tw - 20, height: 14, rx: 7 }),
      s('rect', { class: 't27g-tray', x: tx, y: ty, width: tw, height: th, rx: 14 }),
      s('rect', { class: 't27g-rim', x: tx + 8, y: ty + 8, width: tw - 16, height: th - 16, rx: 9 }),
      ...mirrors)
    place(q, land ? W / 2 - qw / 2 : W / 2 - qw / 2, land ? ty + th * 0.32 : ty + 20, qw)
    const aw = Math.min(W - 24, 620)
    place(col, (W - aw) / 2, ty + th + 12, aw)
  })
  root.append(q, ...btns, col, sheet)
  ctx.prompt(K.prompt)
  const esc = (e: KeyboardEvent) => e.key === 'Escape' && !sheet.hidden && shut()
  addEventListener('keydown', esc)
  ctx.onCleanup(() => removeEventListener('keydown', esc))

  function tilt(i: number) {
    seen[i] = true
    mirrors.forEach((g, k) => g.classList.toggle('tilt', k === i))
    btns.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)))
    root.dataset.m = String(i)
    ansWho.textContent = M[i].label
    ansText.textContent = M[i].answer
    ans.hidden = false
    ans.classList.remove('flip')
    void ans.offsetWidth
    ans.classList.add('flip')
    if (!ansText.hasAttribute('aria-live')) ansText.setAttribute('aria-live', 'polite')
    ctx.chime('soft')
    if (!done && seen.every(Boolean)) {
      done = true
      takeBtn.hidden = !card
      see.hidden = false
      ctx.insight(F(K.insight), F(K.detail))
    }
  }
  function open() {
    sheet.hidden = false
    close.focus()
  }
  function shut() {
    sheet.hidden = true
    takeBtn.focus()
  }
}
