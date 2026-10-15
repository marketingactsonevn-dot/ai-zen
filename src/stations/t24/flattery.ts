import { h, s } from '../../core/dom'
import type { SceneCtx } from '../types'
import { C } from './data'
import { blob, f1, moon, put, stage, stroke, type Pt } from '../t22/kit'

const K = C.scenes.flattery

/** Scene 2 — a bonsai grows one long honeyed branch toward the viewer; vermilion shears prune it and the plain branch stands. */
export function flatteryScene(ctx: SceneCtx) {
  let cut = false
  const q = h('p', { class: 'g8-q g8-abs' }, K.userSays)
  const card = h('div', { class: 'g8t-card g8-abs' }, h('span', { class: 'g8t-tag' }, K.flatterLabel), h('p', null, K.flatter))
  const shears = h('button', { class: 'g8t-shears g8-abs', type: 'button', 'aria-label': K.pruneAria, onClick: prune },
    s('svg', { viewBox: '-20 -20 40 40', 'aria-hidden': 'true' },
      s('circle', { cx: -9, cy: 9, r: 5.5 }), s('circle', { cx: 9, cy: 9, r: 5.5 }),
      s('path', { d: 'M-6 5L8 -15M6 5L-8 -15' })))
  const cause = h('div', { class: 'g8t-cause g8-abs g8-fade', 'data-off': '' }, ctx.fact(K.cause, 'p', 'g8-note'))
  const back = s('g')
  const tree = s('g', { class: 'g8t-tree' })
  const branch = s('g', { class: 'g8t-flat' })
  const { root, svg } = stage(ctx, 'g8t', K.art, [K.insight], draw)
  svg.append(back, tree, branch)
  root.append(q, card, shears, cause)
  ctx.prompt(K.prompt)

  function draw(W: number, H: number) {
    const wide = W > 760
    put(q, 12, 6, W - 24)
    const cx = wide ? W * 0.36 : W * 0.42
    const base = wide ? H * 0.82 : H * 0.56
    const th = wide ? Math.min(H * 0.55, 330) : Math.min(H * 0.36, 210)
    const P: Pt[] = [[cx, base - th * 0.12], [cx - th * 0.12, base - th * 0.45], [cx + th * 0.06, base - th * 0.72], [cx - th * 0.05, base - th * 0.95]]
    const pad = (x: number, y: number, r: number, seed: number) => s('g', null,
      s('path', { class: 'g8t-pad', d: blob(x, y, r, r * 0.42, seed, 0.18) }),
      s('path', { class: 'k', 'fill-opacity': 0.35, d: stroke([[x - r * 0.8, y + r * 0.22], [x, y + r * 0.36], [x + r * 0.8, y + r * 0.18]], 2.4, 0.2, 0.3, 0.2) }))
    back.replaceChildren(
      moon(W * (wide ? 0.62 : 0.82), H * 0.2, Math.min(W, H) * 0.05),
      s('path', { class: 'k', 'fill-opacity': 0.22, d: blob(cx, base + 4, th * 0.55, 8, 4, 0.1), filter: 'url(#ink-wash)' }),
      s('path', { class: 'g8t-pot', d: `M${f1(cx - th * 0.36)} ${f1(base - th * 0.12)}L${f1(cx + th * 0.36)} ${f1(base - th * 0.12)}L${f1(cx + th * 0.3)} ${f1(base)}L${f1(cx - th * 0.3)} ${f1(base)}Z` }))
    // the trunk and its honest pads; the plain left branch is the one that stays
    const left: Pt[] = [P[1], [cx - th * 0.3, base - th * 0.58], [cx - th * 0.5, base - th * 0.6]]
    tree.replaceChildren(
      s('path', { class: 'wd', d: stroke(P, Math.max(10, th * 0.07), 0.05, 0.5, 0.25), filter: 'url(#ink-rough)' }),
      s('path', { class: 'wd g8t-honest', d: stroke(left, 6, 0.05, 0.6, 0.3) }),
      pad(cx - th * 0.5, base - th * 0.64, th * 0.16, 3),
      pad(cx + th * 0.02, base - th * 0.98, th * 0.2, 5),
      pad(cx + th * 0.14, base - th * 0.76, th * 0.13, 7))
    tree.style.transformOrigin = `${f1(cx)}px ${f1(base - th * 0.12)}px`
    // the flattery branch: long, curving out toward the viewer, glossy leaves
    const tip: Pt = [cx + th * (wide ? 0.95 : 0.7), base - th * 0.3]
    const fl: Pt[] = [P[2], [cx + th * 0.4, base - th * 0.66], [cx + th * 0.7, base - th * 0.5], tip]
    const leaves = [0.35, 0.55, 0.72, 0.88, 1].map((t, i) => {
      const k = Math.min(fl.length - 2, Math.floor(t * (fl.length - 1)))
      const u = t * (fl.length - 1) - k
      const x = fl[k][0] + (fl[k + 1][0] - fl[k][0]) * u, y = fl[k][1] + (fl[k + 1][1] - fl[k][1]) * u + (i % 2 ? 8 : -8)
      return s('g', null, s('ellipse', { class: 'g8t-leaf', cx: f1(x), cy: f1(y), rx: 11, ry: 5.5, transform: `rotate(${i % 2 ? 25 : -25} ${f1(x)} ${f1(y)})` }),
        s('ellipse', { class: 'g8t-gloss', cx: f1(x - 2), cy: f1(y - 2), rx: 4, ry: 1.6, transform: `rotate(${i % 2 ? 25 : -25} ${f1(x)} ${f1(y)})` }))
    })
    branch.replaceChildren(s('path', { class: 'wd', d: stroke(fl, 6, 0.05, 0.8, 0.2) }), ...leaves)
    branch.style.transformOrigin = `${f1(P[2][0])}px ${f1(P[2][1])}px`
    const sx = (P[2][0] + fl[1][0]) / 2, sy = (P[2][1] + fl[1][1]) / 2
    put(shears, sx - 22, sy + 6)
    if (wide) {
      const cw = Math.min(340, W - tip[0] - 40)
      put(card, Math.min(W - cw - 16, tip[0] + 24), tip[1] - 40, cw)
      put(cause, Math.min(W - cw - 16, tip[0] + 24), tip[1] + 110, cw)
    } else {
      put(card, 12, base + 14, W - 24)
      put(cause, 12, H - 64, W - 24)
    }
  }

  function prune() {
    if (cut) return
    cut = true
    root.classList.add('cut')
    shears.setAttribute('aria-disabled', 'true')
    card.setAttribute('aria-live', 'polite')
    card.replaceChildren(h('span', { class: 'g8t-tag honest' }, K.honestLabel), h('p', null, K.honest))
    delete cause.dataset.off
    ctx.chime('ok')
    ctx.insight(K.insight, K.detail)
  }
}
