import { h, s } from '../../core/dom'
import type { SceneCtx } from '../types'
import { C } from './data'
import { blob, btn, curve, f1, hills, mist, moon, paperLantern, put, rng, stage, stoneArt, stroke, wash, type Pt } from '../t22/kit'

const K = C.scenes.flowers

/** Scene 1 — a sapling in a glazed pot under a paper lantern, two flowers, one answer each: the tree grows toward the one you pick; then a scroll of principles takes the human's place. */
export function flowersScene(ctx: SceneCtx) {
  let pick = -1
  let ruled = false
  const q = h('p', { class: 'g8-q g8-abs' }, K.question)
  const cards = K.options.map((o, i) => h('button', { class: 'g8f-card g8-paper g8-abs', type: 'button', 'aria-pressed': 'false', 'aria-label': o.aria, onClick: () => choose(i) }, o.text))
  const cap = h('p', { class: 'g8f-cap g8-abs g8-fade', 'data-off': '' }, K.lean, h('br'), h('i', null, K.repeat))
  const swapBtn = btn(K.swap, K.swapAria, swap, 'g8-abs g8-fade')
  swapBtn.dataset.off = ''
  const scroll = h('div', { class: 'g8f-scroll g8-abs g8-fade', 'data-off': '' }, h('p', { class: 'g8f-scroll-h' }, K.scroll), h('ul', null, ...K.rules.map((r) => h('li', null, r))))
  const back = s('g')
  const tree = s('g', { class: 'g8f-tree' })
  const hands = s('g')
  tree.append(hands)
  const { root, svg } = stage(ctx, 'g8f', K.art, [K.insight, K.constitution], draw)
  svg.append(back, tree)
  root.append(q, ...cards, cap, swapBtn, scroll)
  ctx.prompt(K.prompt)

  function draw(W: number, H: number) {
    const wide = W > 760
    put(q, 12, 6, W - 24)
    const cx = W / 2
    const base = wide ? H * 0.8 : H * 0.5
    const th = wide ? Math.min(H * 0.52, 310) : Math.min(H * 0.33, 196)
    const bw = wide ? Math.min(W * 0.15, 190) : W * 0.28
    const r = rng(2401)
    const potH = th * 0.22, potW = th * 0.3
    const soil = base - potH
    const fork: Pt = [cx + 3, soil - th * 0.42]
    const tips: Pt[] = [[cx - bw, soil - th * 0.8], [cx + bw, soil - th * 0.76]]
    const fr = Math.max(14, th * 0.085)
    // the lantern hangs from the top left, its light on the tree
    const lx = cx - th * 0.72, ly = Math.max(wide ? 52 : 70, soil - th * 1.12)
    const lr = Math.max(10, th * 0.055)
    back.replaceChildren(
      mist(W * 0.5, soil - th * 0.4, W * 0.55, th * 0.6),
      moon(W * (wide ? 0.86 : 0.9), H * (wide ? 0.15 : 0.06), Math.min(W, H) * (wide ? 0.034 : 0.04), 24, true),
      hills(-W * 0.04, W * 1.04, base - th * 0.08, th * 0.32, 2402, 0.9, 6),
      mist(W * 0.5, base - th * 0.05, W * 0.6, th * 0.12),
      s('circle', { class: 'g8f-glow', cx: f1(lx + th * 0.2), cy: f1(soil - th * 0.4), r: f1(th * 0.75), fill: 'url(#p2-lamp)' }),
      s('path', { class: 'p2p-cord', d: `M${f1(lx)} 0V${f1(ly)}` }),
      paperLantern(lx, ly, lr, 7, 2),
      // a flat stone the pot stands on, its shadow
      wash(blob(cx + 6, base + 4, potW * 2, 7, 3, 0.15), 0.2),
      s('g', { transform: `translate(${f1(cx)} ${f1(base + 6)})` }, stoneArt(potW * 3.2, potH * 0.5, 2403)),
      ...pot(cx, base, potW, potH))
    // the sapling: trunk, two branches, leaves, the two flowers
    const trunk = curve([cx, soil + 2], [cx - 8, (soil + fork[1]) / 2], fork, 12)
    const limb = (to: Pt, bend: number) => curve(fork, [(fork[0] + to[0]) / 2 + bend, (fork[1] + to[1]) / 2 + 14], to, 12)
    let leaves = '', twigs = ''
    const leaf = (x: number, y: number, a: number, L: number) => {
      leaves += stroke([[x, y], [x + Math.cos(a) * L * 0.5, y + Math.sin(a) * L * 0.5 - L * 0.08], [x + Math.cos(a) * L, y + Math.sin(a) * L]], L * 0.32, 0.2, 0.55, 0.1)
    }
    const L0 = limb(tips[0], -14), L1 = limb(tips[1], 16)
    for (const [pts, dir] of [[L0, -1], [L1, 1]] as const) {
      for (const k of [3, 6, 9]) {
        const [x, y] = pts[k]
        leaf(x, y, (dir < 0 ? Math.PI : 0) + (k % 2 ? -0.7 : 0.5) * dir, th * (0.1 + r() * 0.04))
        if (k === 6) twigs += stroke(curve([x, y], [x + dir * th * 0.04, y - th * 0.08], [x + dir * th * 0.02, y - th * 0.14], 6), 2, 0.1, 0.6, 0.2)
      }
    }
    leaf(trunk[7][0], trunk[7][1], Math.PI * 1.1, th * 0.09)
    leaf(trunk[5][0], trunk[5][1], -0.3, th * 0.08)
    tree.replaceChildren(hands,
      s('path', { class: 'g8f-wood', d: stroke(trunk, Math.max(6, th * 0.04), 0.02, 0.5, 0.45) + stroke(L0, Math.max(3.5, th * 0.022), 0.05, 0.6, 0.3) + stroke(L1, Math.max(3.5, th * 0.022), 0.05, 0.6, 0.3) + twigs, filter: 'url(#ink-rough)' }),
      s('path', { class: 'g8f-leaf', d: leaves }),
      ...tips.map((t, i) => flower(t, fr, i)))
    tree.style.transformOrigin = `${f1(cx)}px ${f1(soil)}px`
    // the human grader's mark: a vermilion tick by the flower picked, and the brush that made it (gone once the scroll rules)
    hands.replaceChildren(...tips.map(([x, y], i) => {
      const d = i ? 1 : -1
      const tx = x - d * fr * 0.5, ty = y - fr * 2
      const tick = stroke(curve([tx - fr * 0.55, ty - fr * 0.05], [tx - fr * 0.3, ty + fr * 0.2], [tx - fr * 0.15, ty + fr * 0.45], 6), fr * 0.22, 0.3, 0.2, 0.3) +
        stroke(curve([tx - fr * 0.15, ty + fr * 0.45], [tx + fr * 0.25, ty - fr * 0.3], [tx + fr * 0.9, ty - fr * 0.95], 10), fr * 0.2, 0.05, 0.7, 0.15)
      const hx = tx + fr * 0.9, hy = ty - fr * 0.95
      return s('g', { class: `g8f-hand h${i}` },
        s('path', { class: 'g8f-tick', d: tick, filter: 'url(#ink-rough)' }),
        s('path', { class: 'g8f-brush-tip', d: stroke([[hx, hy], [hx + fr * 0.3, hy - fr * 0.45]], fr * 0.24, 0.6, 0.05, 0.2) }),
        s('path', { class: 'g8f-brush-stem', d: stroke([[hx + fr * 0.3, hy - fr * 0.45], [hx + fr * 1.3, hy - fr * 2.1]], fr * 0.16, 0.02, 0.02, 0.8) + stroke([[hx + fr * 0.26, hy - fr * 0.4], [hx + fr * 0.4, hy - fr * 0.62]], fr * 0.26, 0.1, 0.1, 0.8), filter: 'url(#ink-rough)' }))
    }), s('path', { class: 'g8f-cord', d: `M${f1(fork[0])} ${f1(fork[1] - th * 0.02)}V${f1(fork[1] - th * 0.1)}` }))
    root.classList.toggle('narrow', !wide)
    if (wide) {
      const cw = Math.min(300, W * 0.26)
      put(cards[0], Math.max(12, tips[0][0] - cw - fr * 2.4), tips[0][1] - 24, cw)
      put(cards[1], Math.min(W - cw - 12, tips[1][0] + fr * 2.4), tips[1][1] - 24, cw)
      put(cap, cx - 170, base + 18, 340)
      put(swapBtn, cx + potW * 1.8, base - 46)
      put(scroll, cx - 82, Math.max(40, fork[1] - th * 0.62), 164)
    } else {
      put(cards[0], 12, base + 26, W - 24)
      put(cards[1], 12, base + 26 + Math.min(150, (H - base) * 0.42), W - 24)
      put(cap, 12, H - 92, W - 24)
      put(swapBtn, W / 2 - 140, H - 50, 280)
      put(scroll, W / 2 - 82, Math.max(64, fork[1] - th * 0.5), 164)
    }
  }

  /** A glazed pot: rounded body, dark rim of soil, a moonlit glaze highlight, an ink outline, a small foot. */
  function pot(cx: number, base: number, w: number, hh: number): SVGElement[] {
    const top = base - hh
    const body = `M${f1(cx - w)} ${f1(top)}C${f1(cx - w * 1.05)} ${f1(top + hh * 0.55)} ${f1(cx - w * 0.72)} ${f1(base - hh * 0.06)} ${f1(cx - w * 0.5)} ${f1(base - hh * 0.06)}L${f1(cx + w * 0.5)} ${f1(base - hh * 0.06)}C${f1(cx + w * 0.72)} ${f1(base - hh * 0.06)} ${f1(cx + w * 1.05)} ${f1(top + hh * 0.55)} ${f1(cx + w)} ${f1(top)}Z`
    return [
      s('path', { class: 'g8f-foot', d: `M${f1(cx - w * 0.42)} ${f1(base - hh * 0.08)}h${f1(w * 0.84)}l${f1(-w * 0.05)} ${f1(hh * 0.1)}h${f1(-w * 0.74)}Z` }),
      s('path', { class: 'g8f-pot', d: body, fill: 'url(#g8f-glaze)' }),
      s('path', { class: 'g8f-pot-shade', d: `M${f1(cx + w * 0.25)} ${f1(top + 2)}C${f1(cx + w * 0.9)} ${f1(top + hh * 0.3)} ${f1(cx + w * 0.75)} ${f1(base - hh * 0.2)} ${f1(cx + w * 0.4)} ${f1(base - hh * 0.08)}L${f1(cx + w * 0.5)} ${f1(base - hh * 0.06)}C${f1(cx + w * 0.72)} ${f1(base - hh * 0.06)} ${f1(cx + w * 1.05)} ${f1(top + hh * 0.55)} ${f1(cx + w)} ${f1(top)}Z` }),
      s('path', { class: 'g8f-pot-hi', d: stroke(curve([cx - w * 0.78, top + hh * 0.2], [cx - w * 0.84, top + hh * 0.5], [cx - w * 0.6, top + hh * 0.8], 8), Math.max(2, w * 0.06), 0.3, 0.3, 0.1) }),
      s('ellipse', { class: 'g8f-soil', cx: f1(cx), cy: f1(top + 1), rx: f1(w * 0.96), ry: f1(Math.max(3, hh * 0.13)) }),
      s('path', { class: 'g8f-pot-ink', d: stroke(curve([cx - w, top], [cx - w * 1.04, base - hh * 0.2], [cx - w * 0.45, base - hh * 0.05], 10), 2, 0.05, 0.2, 0.3) + stroke(curve([cx + w, top], [cx + w * 1.04, base - hh * 0.2], [cx + w * 0.45, base - hh * 0.05], 10), 2.4, 0.05, 0.2, 0.3) + stroke([[cx - w * 1.04, top], [cx, top + 1.5], [cx + w * 1.04, top]], 2.2, 0.05, 0.05, 0.4), filter: 'url(#ink-rough)' }),
      s('defs', null, s('linearGradient', { id: 'g8f-glaze', x1: 0, y1: 0, x2: 1, y2: 0.3 },
        s('stop', { offset: 0, class: 'g8f-gl0' }), s('stop', { offset: 0.6, class: 'g8f-gl1' }), s('stop', { offset: 1, class: 'g8f-gl2' }))),
    ]
  }

  /** A plum blossom: five rounded petals in a pale wash with ink edges, a vermilion heart and stamens. */
  function flower([x, y]: Pt, fr: number, i: number) {
    let petals = '', edge = '', stamens = ''
    for (let k = 0; k < 5; k++) {
      const a = (k * 72 - 90 + i * 20) * (Math.PI / 180)
      const px = x + Math.cos(a) * fr * 0.62, py = y + Math.sin(a) * fr * 0.62
      petals += blob(px, py, fr * 0.52, fr * 0.48, 2410 + k + i * 5, 0.12, 12)
      const e0 = a - 0.7, e1 = a + 0.7
      edge += stroke(curve([x + Math.cos(e0) * fr * 0.62, y + Math.sin(e0) * fr * 0.62], [x + Math.cos(a) * fr * 1.28, y + Math.sin(a) * fr * 1.28], [x + Math.cos(e1) * fr * 0.62, y + Math.sin(e1) * fr * 0.62], 8), 1.1, 0.2, 0.2, 0.2)
      stamens += stroke([[x, y], [x + Math.cos(a + 0.36) * fr * 0.5, y + Math.sin(a + 0.36) * fr * 0.5]], 0.9, 0.1, 0.4, 0.3)
    }
    return s('g', { class: `g8f-fl f${i}` },
      s('circle', { class: 'g8f-fl-halo', cx: f1(x), cy: f1(y), r: f1(fr * 2.2), fill: 'url(#p2-halo)' }),
      s('path', { class: 'g8f-pet', d: petals }),
      s('path', { class: 'g8f-pet-ink', d: edge, filter: 'url(#ink-rough)' }),
      s('path', { class: 'g8f-stamen', d: stamens }),
      s('circle', { class: 'g8f-heart', cx: f1(x), cy: f1(y), r: f1(fr * 0.18) }))
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
