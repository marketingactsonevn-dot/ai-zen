import { h, nextId, s } from '../../core/dom'
import { L } from '../../core/content'
import { blob, rng, stroke } from '../../ui/part2/ink'
import { mist, moon } from '../../ui/part2/paint'
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
  const mirrors = M.map((_, i) => s('g', { class: `t27g-m t27g-m${i}` }))
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
  const sheet = h('div', { class: 't27g-sheet', hidden: true, role: 'dialog', 'aria-label': K.takeawayLabel }, close, card ? takeaway(card, null, ctx.onCleanup) : null)

  const { root, svg } = stage(ctx, 't27g', K.art, [K.insight], (W, H) => {
    const land = W / H > 1.05
    const tw = land ? Math.min(W * 0.62, 760) : W - 20
    const th = land ? Math.min(tw * 0.42, H * 0.5) : Math.min(tw * 0.78, H * 0.46)
    const tx = (W - tw) / 2, ty = 10
    const qw = land ? tw * 0.3 : tw * 0.84
    const r = rng(2720)
    const fade = nextId('t27g')
    // the tray, seen a little from above: the far edge shorter than the near one
    const inset = tw * 0.035
    const T = (x0: number, y0: number, x1: number, y1: number, k: number) => {
      const c = Math.min(14, (y1 - y0) * 0.12)
      return `M${f1(x0 + k + c)} ${f1(y0)}L${f1(x1 - k - c)} ${f1(y0)}Q${f1(x1 - k)} ${f1(y0)} ${f1(x1 - k * 0.8)} ${f1(y0 + c)}L${f1(x1 - c * 0.2)} ${f1(y1 - c)}Q${f1(x1)} ${f1(y1)} ${f1(x1 - c)} ${f1(y1)}L${f1(x0 + c)} ${f1(y1)}Q${f1(x0)} ${f1(y1)} ${f1(x0 + c * 0.2)} ${f1(y1 - c)}L${f1(x0 + k * 0.8)} ${f1(y0 + c)}Q${f1(x0 + k)} ${f1(y0)} ${f1(x0 + k + c)} ${f1(y0)}Z`
    }
    const outer = T(tx, ty, tx + tw, ty + th, inset)
    const inner = T(tx + tw * 0.03, ty + th * 0.07, tx + tw * 0.97, ty + th * 0.92, inset * 0.9)
    // gold maki-e in the far left corner: autumn grasses and a crescent
    let makie = ''
    for (let i = 0; i < 6; i++) {
      const x = tx + tw * (0.08 + i * 0.022), y = ty + th * 0.86
      makie += stroke([[x, y], [x + 4 + r() * 6, y - th * (0.14 + r() * 0.12)], [x + 10 + r() * 10, y - th * (0.24 + r() * 0.1)]], 1.4, 0.05, 0.7, 0.15)
    }
    const fx = tx + tw * 0.9, fy = ty + th * 0.2
    makie += stroke([[fx - 9, fy - 6], [fx - 3, fy + 2], [fx + 7, fy + 4]], 2.4, 0.4, 0.4, 0.15)
    // floor boards under the moon, and moonlight through a lattice falling across them and the tray
    let boards = ''
    for (let y = ty + th * 0.15; y < H; y += 26 + r() * 8) boards += stroke([[-10, y], [W * 0.5, y + (r() - 0.5) * 2], [W + 10, y]], 1.2, 0.02, 0.02, 0.5)
    const lx = tx + tw * 0.55, lw = tw * 0.32, sk = tw * 0.2
    let lat = ''
    for (let i = 1; i < 3; i++) lat += `M${f1(lx + (lw * i) / 3)} ${f1(-10)}l${f1(sk)} ${f1(H + 20)}`
    for (let j = 1; j < 5; j++) lat += `M${f1(lx + (sk * j) / 5)} ${f1(-10 + ((H + 20) * j) / 5)}h${f1(lw)}`
    const face = [grad(svg, [[0, '--moon', 1], [0.5, '--moon', 0.7], [0.85, '--lantern', 0.3], [1, '--water', 0.5]], 'r'), grad(svg, [[0, '--moon', 0.42], [0.65, '--water', 0.5], [1, '--water', 0.75]], 'r')]
    const mr = land ? Math.min(th * 0.34, tw * 0.15) : Math.min(tw * 0.2, th * 0.26)
    const my = land ? ty + th * 0.46 : ty + th * 0.62
    const mx = land ? [tx + tw * 0.2, tx + tw * 0.8] : [tx + tw * 0.27, tx + tw * 0.73]
    mirrors.forEach((g, i) => {
      const x = mx[i], y = my, dir = i ? 1 : -1
      const hEnd: [number, number] = [x + dir * mr * 0.28, y + mr * 1.95]
      let wraps = ''
      for (let k = 0; k < 6; k++) {
        const t = 0.15 + k * 0.13, cx = x + (hEnd[0] - x) * t, cy = y + mr + (hEnd[1] - y - mr) * t
        wraps += stroke([[cx - mr * 0.11, cy - mr * 0.03], [cx + mr * 0.11, cy + mr * 0.05]], mr * 0.05, 0.2, 0.2, 0.4)
      }
      // the gilded one: a ring of carved petals; the bronze one: plain, a little patina
      const petals = i ? '' : Array.from({ length: 16 }, (_, k) => {
        const a = (k / 16) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a)
        return stroke([[x + c * mr * 1.02, y + sn * mr * 1.02], [x + c * mr * 1.16, y + sn * mr * 1.16]], mr * 0.08, 0.3, 0.3, 0.3)
      }).join('')
      const patina = i ? blob(x + mr * 0.85, y - mr * 0.5, mr * 0.12, mr * 0.08, 7, 0.3, 8) + blob(x - mr * 0.9, y + mr * 0.45, mr * 0.09, mr * 0.07, 8, 0.3, 8) : ''
      g.style.transformOrigin = `${f1(x)}px ${f1(y + mr)}px`
      g.replaceChildren(
        s('ellipse', { class: 't27g-msh', cx: f1(x + mr * 0.12), cy: f1(y + mr * 0.25), rx: f1(mr * 1.25), ry: f1(mr * 1.15) }),
        s('path', { class: i ? 't27g-bronze' : 't27g-gold', d: stroke([[x, y + mr], hEnd], mr * 0.22, 0.05, 0.1, 0.8), filter: 'url(#ink-rough)' }),
        s('path', { class: i ? 't27g-cord2' : 't27g-cord', d: wraps }),
        s('path', { class: i ? 't27g-bronze' : 't27g-gold', d: blob(x, y, mr * 1.2, mr * 1.2, 2721 + i, 0.015, 24), filter: 'url(#ink-rough)' }),
        s('path', { class: 't27g-petal', d: petals + patina }),
        s('circle', { cx: f1(x), cy: f1(y), r: f1(mr), fill: face[i], class: 't27g-face' }),
        s('path', { class: 'zk-ink t27g-edge', d: stroke(Array.from({ length: 13 }, (_, k) => {
          const a = (0.1 + k * 0.07) * Math.PI
          return [x + Math.cos(a) * mr * 1.2, y + Math.sin(a) * mr * 1.2] as [number, number]
        }), Math.max(1.6, mr * 0.04), 0.2, 0.2, 0.3), filter: 'url(#ink-rough)' }),
        s('path', { class: 't27g-glint', d: stroke([[x - mr * 0.55, y - mr * 0.2], [x - mr * 0.2, y - mr * 0.6]], mr * 0.08, 0.3, 0.3) + stroke([[x - mr * 0.4, y + mr * 0.1], [x + mr * 0.05, y - mr * 0.45]], mr * 0.05, 0.3, 0.3) }))
      place(btns[i], x - mr * 1.25, y - mr * 1.25, mr * 2.5)
      btns[i].style.height = `${f1(mr * 3.2)}px`
    })
    svg.replaceChildren(
      s('path', { class: 'zk-ink t27g-boards', d: boards }),
      mist(W * 0.92, ty + 14, W * 0.24, H * 0.14),
      moon(W * 0.92, ty + 16, Math.min(W, H) * 0.022, 2722, true),
      s('path', { class: 't27g-shadow', d: T(tx + 6, ty + 12, tx + tw + 8, ty + th + 14, inset), filter: 'url(#ink-wash)' }),
      s('path', { class: 't27g-tray', d: outer, filter: 'url(#ink-rough)' }),
      s('path', { class: 't27g-floor', d: inner }),
      s('path', { class: 't27g-makie', d: makie }),
      s('path', { class: 't27g-sheen', d: stroke([[tx + tw * 0.3, ty + th * 0.1], [tx + tw * 0.62, ty + th * 0.9]], tw * 0.07, 0.3, 0.3, 0.1), filter: 'url(#ink-wash)' }),
      s('path', { class: 't27g-rimhi', d: stroke([[tx + inset + 16, ty + 1.5], [tx + tw - inset - 16, ty + 1.5]], 1.6, 0.2, 0.2, 0.2) }),
      ...mirrors,
      s('g', { class: 't27g-window', mask: `url(#${fade})` },
        s('path', { class: 't27g-light', d: `M${f1(lx)} -10h${f1(lw)}l${f1(sk)} ${f1(H + 20)}h${f1(-lw)}Z` }),
        s('path', { class: 't27g-lattice', d: lat })),
      s('mask', { id: fade, maskUnits: 'userSpaceOnUse', x: 0, y: -10, width: f1(W), height: f1(H + 20) },
        s('rect', { x: 0, y: -10, width: f1(W), height: f1(H + 20), fill: grad(svg, [[0, '--moon', 1], [0.55, '--moon', 0.8], [1, '--moon', 0]], 'v', [0, ty, 0, ty + th * 1.9]) })))
    place(q, W / 2 - qw / 2, land ? ty + th * 0.32 : ty + 20, qw)
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
