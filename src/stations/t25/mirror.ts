import { h, s } from '../../core/dom'
import { blob, rng, stroke } from '../../ui/part2/ink'
import type { SceneCtx } from '../types'
import C from '../../content/tram-25.json'
import { F, grad, place, rings, stage } from './kit'

/** Scene 3 — a stone basin under the moon mirrors a kind answer; stir it and the answer breaks into human writing. */
export function mirrorScene(ctx: SceneCtx) {
  const K = C.scenes.mirror
  let stirred = false
  let shown = false
  const user = h('p', { class: 'p2-question zk-q t25m-user' }, K.userLine)
  const ai = h('p', { class: 't25m-ai' }, K.aiLine)
  const label = h('p', { class: 'zk-lab t25m-label' }, K.fragmentsLabel)
  const btn = h('button', { class: 'zk-btn t25m-btn', type: 'button', 'aria-label': K.stirAria, onClick: toggle }, K.stir)
  let fragG: SVGGElement, ringG: SVGGElement

  const { root, svg } = stage(ctx, 't25m', K.art, [K.insight], (W, H) => {
    const land = W / H > 1.05
    const qw = Math.min(W - 24, 560)
    place(user, (W - qw) / 2, 4, qw)
    const qh = user.offsetHeight + 10
    const avail = H - qh - 44 - 30 - 20
    const ratio = land ? 0.48 : 0.6
    const rx = Math.min(land ? W * 0.26 : W * 0.38, 330, avail / 2.9 / ratio)
    const ry = rx * ratio
    const cx = W / 2, cy = qh + Math.max(6, (avail + 50 - ry * 2.9) / 2) + ry * 1.4
    const r = rng(25)
    const water = grad(svg, [[0, '--water', 0.25], [0.7, '--water', 0.55], [1, '--water', 0.8]], 'r')
    // fragments: a thousand small hands of writing, here a few dozen
    const words: SVGTextElement[] = []
    const nW = land ? 26 : 18
    for (let i = 0; i < nW; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.82
      const x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d + 4
      words.push(s('text', { x: x.toFixed(1), y: y.toFixed(1), 'text-anchor': 'middle', 'font-size': (10 + r() * 6).toFixed(1), transform: `rotate(${((r() - 0.5) * 40).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})`, style: `--d:${(i * 0.04).toFixed(2)}s;--o:${(0.35 + r() * 0.5).toFixed(2)}` }, K.fragments[i % K.fragments.length]))
    }
    const spoutY = cy - ry * 1.3
    const sx0 = cx - rx * (land ? 1.15 : 1.0), sx1 = cx - rx * 0.55
    svg.replaceChildren(
      s('ellipse', { class: 'zk-sh', cx: cx + rx * 0.08, cy: cy + ry * 1.32, rx: rx * 1.4, ry: ry * 0.35 }),
      s('path', { class: 'zk-stone', d: blob(cx, cy + ry * 0.16, rx * 1.2, ry * 1.32, 7, 0.07), fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
      s('path', { class: 'p2-stone-flank', d: blob(cx, cy + ry * 0.16, rx * 1.2, ry * 1.32, 7, 0.07), fill: 'url(#p2-shade)' }),
      s('ellipse', { class: 't25m-lip', cx, cy, rx: rx * 1.04, ry: ry * 1.05 }),
      s('ellipse', { cx, cy, rx, ry, fill: water }),
      s('ellipse', { class: 't25m-moon', cx: cx - rx * 0.45, cy: cy - ry * 0.45, rx: rx * 0.1, ry: ry * 0.1 }),
      // a bamboo spout and its drop
      s('path', { class: 't25m-bamboo', d: stroke([[sx0, spoutY - ry * 0.7], [sx1, spoutY]], Math.max(6, rx * 0.05), 0.02, 0.02, 0.9) }),
      s('path', { class: 'k', 'fill-opacity': 0.45, d: [0.35, 0.7].map((t) => { const x = sx0 + (sx1 - sx0) * t, y = spoutY - ry * 0.7 * (1 - t); return stroke([[x - 2, y - 5], [x + 2, y + 5]], 2, 0.2, 0.2) }).join('') }),
      s('ellipse', { class: 't25m-drop', cx: sx1 + 2, cy: spoutY + (cy - spoutY) * 0.45, rx: 2.2, ry: 3.4 }),
      ringG = rings(cx, cy, rx * 0.18, ry * 0.18, 4, 'zk-ring t25m-rings'),
      fragG = s('g', { class: 't25m-frags' }, ...words))
    place(ai, cx - rx * 0.72, cy - ry * 0.32, rx * 1.44)
    place(label, cx - rx, cy + ry * 1.62 + 4, rx * 2)
    btn.style.left = `${cx.toFixed(1)}px`
    btn.style.top = `${(cy + ry * 1.62 + 32).toFixed(1)}px`
    ringG.classList.toggle('on', stirred)
    fragG.classList.toggle('on', stirred)
  })
  root.append(user, ai, label, btn)
  ctx.prompt(K.prompt)

  function toggle() {
    stirred = !stirred
    root.classList.toggle('stirred', stirred)
    fragG.classList.toggle('on', stirred)
    ringG.classList.toggle('on', stirred)
    btn.textContent = stirred ? K.again : K.stir
    btn.setAttribute('aria-label', stirred ? K.again : K.stirAria)
    if (stirred) ctx.chime('soft')
    if (stirred && !shown) {
      shown = true
      ctx.insight(F(K.insight), K.detail)
    }
  }
}
