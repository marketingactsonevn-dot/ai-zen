import { h, s } from '../../core/dom'
import type { SceneCtx } from '../types'
import { C } from './data'
import { blob, curve, f1, hills, mist, moon, pine, put, rng, stage, stroke, wash, type Pt } from '../t22/kit'

const K = C.scenes.flattery

/** Brushed vermilion pruning shears for the button (viewBox -20 -20 40 40): two blades crossing at a pivot, two loop handles. */
function shearsArt() {
  const ring = (cx: number, cy: number, r: number): Pt[] => Array.from({ length: 19 }, (_, i) => [cx + Math.cos((i / 18) * Math.PI * 2.1) * r, cy + Math.sin((i / 18) * Math.PI * 2.1) * r * 0.85])
  return s('svg', { viewBox: '-20 -20 40 40', 'aria-hidden': 'true' },
    s('path', { class: 'g8t-shears-ink', d: stroke([[-7, 6], [0, -2], [9, -17]], 4.2, 0.05, 0.75, 0.15) + stroke([[7, 6], [0, -2], [-9, -17]], 4.2, 0.05, 0.75, 0.15) + stroke(ring(-9, 11, 5), 2.6, 0.1, 0.1, 0.5) + stroke(ring(9, 11, 5), 2.6, 0.1, 0.1, 0.5), filter: 'url(#ink-rough)' }),
    s('circle', { class: 'g8t-shears-pin', cx: 0, cy: -2, r: 1.6 }))
}

/** Scene 2 — a bonsai under the moon grows one long honey-glossed branch toward the viewer; the vermilion shears by its foot prune it and the tree stands straight. */
export function flatteryScene(ctx: SceneCtx) {
  let cut = false
  const q = h('p', { class: 'g8-q g8-abs' }, K.userSays)
  const card = h('div', { class: 'g8t-card g8-paper g8-abs' }, h('span', { class: 'g8t-tag' }, K.flatterLabel), h('p', null, K.flatter))
  const shears = h('button', { class: 'g8t-shears g8-abs', type: 'button', 'aria-label': K.pruneAria, onClick: prune }, shearsArt())
  const cause = h('div', { class: 'g8t-cause g8-abs g8-fade', 'data-off': '' }, ctx.fact(K.cause, 'p', 'g8-note'))
  const back = s('g')
  const tree = s('g', { class: 'g8t-tree' })
  const branch = s('g', { class: 'g8t-flat' })
  const { root, svg } = stage(ctx, 'g8t', K.art, [K.insight], draw)
  svg.append(back, tree)
  tree.append(branch)
  root.append(q, card, shears, cause)
  ctx.prompt(K.prompt)

  function draw(W: number, H: number) {
    const wide = W > 760
    put(q, 12, 6, W - 24)
    const cx = wide ? W * 0.34 : W * 0.4
    const base = wide ? H * 0.84 : H * 0.56
    const th = wide ? Math.min(H * 0.6, 340) : Math.min(H * 0.37, 215)
    const r = rng(2421)
    // a shallow glazed pot on little feet
    const pw = th * 0.62, ph = th * 0.13
    const potTop = base - ph
    const potD = `M${f1(cx - pw / 2)} ${f1(potTop)}L${f1(cx + pw / 2)} ${f1(potTop)}L${f1(cx + pw * 0.44)} ${f1(base - ph * 0.18)}L${f1(cx - pw * 0.44)} ${f1(base - ph * 0.18)}Z`
    back.replaceChildren(
      mist(cx + th * 0.3, base - th * 0.55, th * 1.4, th * 0.6),
      moon(cx + th * (wide ? 0.62 : 0.55), base - th * (wide ? 1.02 : 1.05), Math.min(W, H) * (wide ? 0.06 : 0.07), 242, true),
      hills(-W * 0.04, W * 1.04, base - th * 0.1, th * 0.3, 2422, 0.9, 6),
      mist(W * 0.5, base - th * 0.06, W * 0.6, th * 0.1),
      wash(blob(cx + 8, base + 4, pw * 0.75, 8, 4, 0.12), 0.25),
      s('path', { class: 'g8t-feet', d: stroke([[cx - pw * 0.36, base - ph * 0.2], [cx - pw * 0.33, base + 2]], 6, 0.05, 0.05, 0.6) + stroke([[cx + pw * 0.36, base - ph * 0.2], [cx + pw * 0.33, base + 2]], 6, 0.05, 0.05, 0.6) }),
      s('path', { class: 'g8t-pot', d: potD }),
      s('path', { class: 'g8t-pot-shade', d: `M${f1(cx + pw * 0.1)} ${f1(potTop)}L${f1(cx + pw / 2)} ${f1(potTop)}L${f1(cx + pw * 0.44)} ${f1(base - ph * 0.18)}L${f1(cx + pw * 0.06)} ${f1(base - ph * 0.18)}Z` }),
      s('path', { class: 'g8t-pot-ink', d: stroke([[cx - pw * 0.53, potTop], [cx, potTop + 1], [cx + pw * 0.53, potTop]], 3.4, 0.03, 0.03, 0.5) + stroke([[cx - pw / 2, potTop + 2], [cx - pw * 0.44, base - ph * 0.18], [cx + pw * 0.44, base - ph * 0.18], [cx + pw / 2, potTop + 2]], 1.8, 0.05, 0.05, 0.5), filter: 'url(#ink-rough)' }),
      s('path', { class: 'g8t-hi', d: stroke([[cx - pw * 0.4, potTop + ph * 0.35], [cx - pw * 0.1, potTop + ph * 0.3]], 2, 0.3, 0.3, 0.1) }),
      s('ellipse', { class: 'g8t-soil', cx: f1(cx), cy: f1(potTop + 1), rx: f1(pw * 0.48), ry: 3 }))
    // the tree itself: an honest pine, leaning a little under the weight of the flattering branch
    tree.replaceChildren(pine(cx, potTop + 2, th * 0.92, 2423, -1), branch)
    tree.style.transformOrigin = `${f1(cx)}px ${f1(potTop)}px`
    // the flattering branch: from mid-trunk, long, bowing out toward the viewer, leaves glossed as if with honey
    const b0: Pt = [cx - th * 0.03, potTop - th * 0.42]
    const tip: Pt = [cx + th * (wide ? 1.0 : 0.82), potTop - th * 0.3]
    const pts = [...curve(b0, [cx + th * 0.35, potTop - th * 0.78], [cx + th * 0.68, potTop - th * 0.5], 14), ...curve([cx + th * 0.68, potTop - th * 0.5], [cx + th * 0.85, potTop - th * 0.36], tip, 10).slice(1)]
    let leaves = '', gloss = '', drips = ''
    for (let i = 6; i < pts.length; i += 2) {
      const [x, y] = pts[i]
      const side = i % 4 ? 1 : -1
      const L = th * (0.07 + r() * 0.03)
      const a = Math.PI / 2 + side * 0.9 + (r() - 0.5) * 0.4
      const ex = x + Math.cos(a) * L, ey = y + Math.sin(a) * L * 0.8
      leaves += stroke(curve([x, y], [(x + ex) / 2 + side * L * 0.12, (y + ey) / 2 - L * 0.1], [ex, ey], 8), L * 0.46, 0.25, 0.6, 0.08)
      gloss += stroke([[x + (ex - x) * 0.25, y + (ey - y) * 0.25 - 1.5], [x + (ex - x) * 0.6, y + (ey - y) * 0.6 - 1.5]], 1.6, 0.3, 0.3, 0.1)
      if (i % 6 === 0) drips += blob(ex, ey + 4, 1.8, 3, 2440 + i, 0.05, 8)
    }
    branch.replaceChildren(
      s('path', { class: 'g8t-wood', d: stroke(pts, Math.max(4, th * 0.022), 0.05, 0.85, 0.2), filter: 'url(#ink-rough)' }),
      s('path', { class: 'g8t-leaf', d: leaves }),
      s('path', { class: 'g8t-gloss', d: gloss }),
      s('path', { class: 'g8t-drip', d: drips }))
    branch.style.transformOrigin = `${f1(b0[0])}px ${f1(b0[1])}px`
    // the shears lie by the foot of the tree
    put(shears, cx + pw * 0.55, base - 50)
    if (wide) {
      const cw = Math.min(340, W - tip[0] - 40)
      put(card, Math.min(W - cw - 16, tip[0] + 24), tip[1] - 40, cw)
      put(cause, Math.min(W - cw - 16, tip[0] + 24), tip[1] + 110, cw)
    } else {
      put(card, 12, base + 16, W - 24)
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
