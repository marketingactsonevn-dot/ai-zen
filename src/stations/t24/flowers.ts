import { h, s } from '../../core/dom'
import type { SceneCtx } from '../types'
import { C } from './data'
import { blob, btn, f1, glowDefs, moon, put, stage, stroke, type Pt } from '../t22/kit'

const K = C.scenes.flowers

/** Scene 1 — a sapling with two flowers, one answer each: the one you choose is the side the tree grows toward. */
export function flowersScene(ctx: SceneCtx) {
  let pick = -1
  let ruled = false
  const q = h('p', { class: 'g8-q g8-abs' }, K.question)
  const cards = K.options.map((o, i) => h('button', { class: 'g8f-card g8-abs', type: 'button', 'aria-pressed': 'false', 'aria-label': o.aria, onClick: () => choose(i) }, o.text))
  const cap = h('p', { class: 'g8f-cap g8-abs g8-fade', 'data-off': '' }, K.lean, h('br'), h('i', null, K.repeat))
  const swapBtn = btn(K.swap, K.swapAria, swap, 'g8-abs g8-fade')
  swapBtn.dataset.off = ''
  const scroll = h('div', { class: 'g8f-scroll g8-abs g8-fade', 'data-off': '' }, h('p', { class: 'g8f-scroll-h' }, K.scroll), h('ul', null, ...K.rules.map((r) => h('li', null, r))))
  const back = s('g')
  const tree = s('g', { class: 'g8f-tree' })
  const { root, svg } = stage(ctx, 'g8f', K.art, [K.insight, K.constitution], draw)
  const glow = glowDefs(svg)
  svg.append(back, tree)
  root.append(q, ...cards, cap, swapBtn, scroll)
  ctx.prompt(K.prompt)

  function draw(W: number, H: number) {
    const wide = W > 760
    put(q, 12, 6, W - 24)
    const cx = W / 2
    const base = wide ? H * 0.8 : H * 0.5
    const th = wide ? Math.min(H * 0.5, 300) : Math.min(H * 0.32, 190)
    const bw = wide ? Math.min(W * 0.16, 200) : W * 0.3
    const fork: Pt = [cx + 4, base - th * 0.5]
    const tips: Pt[] = [[cx - bw, base - th * 0.95], [cx + bw, base - th * 0.9]]
    const fr = Math.max(14, th * 0.09)
    back.replaceChildren(
      moon(W * 0.86, H * 0.16, Math.min(W, H) * 0.035),
      s('circle', { cx: f1(cx - th * 0.5), cy: f1(base - th * 0.2), r: f1(th * 0.5), fill: glow, opacity: 0.6 }),
      // lantern on the ground beside the pot
      s('path', { class: 'ln', 'fill-opacity': 0.9, d: blob(cx - th * 0.5, base - th * 0.16, 9, 12, 2, 0.03) }),
      s('path', { class: 'k', 'fill-opacity': 0.25, d: blob(cx, base + 6, th * 0.5, 7, 3, 0.1), filter: 'url(#ink-wash)' }),
      s('path', { class: 'g8f-pot', d: `M${f1(cx - th * 0.2)} ${f1(base - th * 0.14)}L${f1(cx + th * 0.2)} ${f1(base - th * 0.14)}L${f1(cx + th * 0.15)} ${f1(base)}L${f1(cx - th * 0.15)} ${f1(base)}Z` }),
      s('path', { class: 'k', d: stroke([[cx - th * 0.22, base - th * 0.14], [cx + th * 0.22, base - th * 0.14]], 4, 0.05, 0.05, 0.6) }))
    const trunk = (a: Pt, b: Pt, w: number, bend: number) => stroke([a, [(a[0] + b[0]) / 2 + bend, (a[1] + b[1]) / 2], b], w, 0.05, 0.6, 0.3)
    const flower = ([x, y]: Pt, i: number) => s('g', { class: `g8f-fl f${i}` },
      ...[0, 1, 2, 3, 4].map((k) => s('ellipse', { class: 'g8f-pet', cx: f1(x + Math.cos((k * 72 * Math.PI) / 180) * fr * 0.6), cy: f1(y + Math.sin((k * 72 * Math.PI) / 180) * fr * 0.6), rx: f1(fr * 0.55), ry: f1(fr * 0.38), transform: `rotate(${k * 72} ${f1(x + Math.cos((k * 72 * Math.PI) / 180) * fr * 0.6)} ${f1(y + Math.sin((k * 72 * Math.PI) / 180) * fr * 0.6)})` })),
      s('circle', { class: 'v', cx: f1(x), cy: f1(y), r: f1(fr * 0.25) }))
    tree.replaceChildren(
      s('path', { class: 'wd', d: trunk([cx, base - th * 0.14], fork, 9, -8), filter: 'url(#ink-rough)' }),
      s('path', { class: 'wd', d: trunk(fork, tips[0], 5, -10) }),
      s('path', { class: 'wd', d: trunk(fork, tips[1], 5, 12) }),
      s('path', { class: 'ms', 'fill-opacity': 0.7, d: blob(fork[0] - bw * 0.4, fork[1] - th * 0.2, 14, 7, 5, 0.2) + blob(fork[0] + bw * 0.5, fork[1] - th * 0.25, 12, 6, 6, 0.2) }),
      ...tips.map(flower))
    root.classList.toggle('narrow', !wide)
    tree.style.transformOrigin = `${f1(cx)}px ${f1(base - th * 0.14)}px`
    if (wide) {
      const cw = Math.min(300, W * 0.26)
      put(cards[0], Math.max(12, tips[0][0] - cw - fr * 2), tips[0][1] - 20, cw)
      put(cards[1], Math.min(W - cw - 12, tips[1][0] + fr * 2), tips[1][1] - 20, cw)
      put(cap, cx - 160, base + 12, 320)
      put(swapBtn, cx + th * 0.35, base - 46)
      put(scroll, cx - 80, base - th * 1.25, 160)
    } else {
      put(cards[0], 12, base + 12, W - 24)
      put(cards[1], 12, base + 12 + Math.min(150, (H - base) * 0.42), W - 24)
      put(cap, 12, H - 92, W - 24)
      put(swapBtn, W / 2 - 140, H - 50, 280)
      put(scroll, W / 2 - 80, base + 16, 160)
    }
  }

  function choose(i: number) {
    pick = i
    cards.forEach((c, k) => {
      c.setAttribute('aria-pressed', String(k === i))
      c.classList.toggle('dim', k !== i)
    })
    root.dataset.lean = i ? 'r' : 'l'
    ctx.chime('tap')
    if (!cap.dataset.off) return
    delete cap.dataset.off
    delete swapBtn.dataset.off
    ctx.insight(K.insight, K.detail)
  }

  function swap() {
    if (pick < 0 || ruled) return
    ruled = true
    root.classList.add('ruled')
    delete scroll.dataset.off
    swapBtn.dataset.off = ''
    cap.dataset.off = ''
    ctx.chime('ok')
    ctx.insight(K.constitution)
  }
}
