import { h, s } from '../../core/dom'
import { blob, clamp, curve, rng, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import { grass, mist, moon, toro } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import C from '../../content/tram-25.json'
import { F, bamboo, f1, grad, leaf, place, rings, stage } from './kit'

/** Scene 3 — a stone basin (tsukubai) under the moon mirrors a face and a kind answer; stir it and the answer breaks into human writing. */
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
    const k = land ? 0.5 : 0.58 // the water seen from above at an angle: ry = rx × k
    const R = Math.min(land ? W * 0.16 : W * 0.27, 210, (H - qh - 96) / 4.9 / k)
    const ry = R * k
    const cx = W / 2, cy = qh + 8 + Math.max(0, (H - qh - 12 - (ry * 4.6 + 80)) / 2) + ry * 2.75
    const ground = cy + ry * 1.85
    const r = rng(25)
    // the stone: a drum with a dished top and a round hollow of water
    const body = blob(cx, cy + ry * 0.75, R * 1.4, ry * 1.75, 2531, 0.06, 18)
    const topD = blob(cx, cy + ry * 0.02, R * 1.4, ry * 1.42, 2532, 0.05, 18)
    // the face of whoever bends over it, reflected: hair, a pale face, a few features, all faint
    const fx = cx + R * 0.08, fy = cy - ry * 0.4, fr = R * 0.2
    // fragments: a thousand small hands of writing, here a few dozen
    const words: SVGTextElement[] = []
    const nW = land ? 26 : 18
    for (let i = 0; i < nW; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.82
      const x = cx + Math.cos(a) * R * d, y = cy + Math.sin(a) * ry * d + 4
      words.push(s('text', { x: f1(x), y: f1(y), 'text-anchor': 'middle', 'font-size': f1(10 + r() * 6), transform: `rotate(${((r() - 0.5) * 40).toFixed(0)} ${f1(x)} ${f1(y)})`, style: `--d:${(i * 0.04).toFixed(2)}s;--o:${(0.35 + r() * 0.5).toFixed(2)}` }, K.fragments[i % K.fragments.length]))
    }
    // the bamboo spout (kakei): a post at the back left, a pipe out over the water, a drop falling
    const postX = cx - R * 1.62
    const tip: Pt = [cx - R * 0.45, cy - ry * 1.3]
    const post = bamboo([postX, ground - ry * 0.4], [postX + 2, cy - ry * 2.75], Math.max(6, R * 0.075), 2533, 2)
    const pipe = bamboo([postX - R * 0.08, cy - ry * 2.2], tip, Math.max(5, R * 0.06), 2534, 2)
    const fall: Pt = [tip[0] + 2, cy - ry * 0.32]
    // the ladle laid across the rim on the right
    const ladle: Pt[] = [[cx + R * 0.62, cy - ry * 1.22], [cx + R * 1.62, cy + ry * 0.28]]
    // a clump of bamboo grass at the post's foot
    const leaves = [[-1.1, 0.9], [-0.7, 1.2], [-0.25, 1], [0.35, 1.1], [0.8, 0.85], [1.15, 0.7]].map(([a, l], i) => leaf(postX + 2 + a * 4, ground - ry * 0.35, R * 0.3 * l, -Math.PI / 2 + a, 2535 + i))
    // the "sea" round the basin: gravel in a soft wash
    let gravel = ''
    for (let i = 0; i < 70; i++) {
      const a = r() * Math.PI * 2, d = 1.08 + r() * 0.62
      const x = cx + Math.cos(a) * R * 1.55 * d, y = ground - ry * 0.45 + Math.sin(a) * ry * 0.95 * d
      if (Math.abs(x - cx) < R * 1.3 && y < ground) continue
      gravel += blob(x, y, 2 + r() * 2.2, 1.4 + r() * 1.4, i, 0.2, 6)
    }
    const mx = land ? W * 0.8 : W * 0.82, my = qh + (land ? 36 : 26)
    const lit = land ? toro(cx + R * 2.45, ground - ry * 0.55, R * 1.45, true) : null
    svg.replaceChildren(
      mist(mx, my, W * 0.3, H * 0.16),
      moon(mx, my, clamp(R * 0.11, 10, 22), 2536, true),
      mist(cx, ground - ry * 0.6, R * 3.4, ry * 1.6),
      s('path', { class: 't25m-sea', d: blob(cx, ground - ry * 0.4, R * 2.6, ry * 1.45, 2537, 0.12, 16), filter: 'url(#ink-wash)' }),
      s('path', { class: 't25m-gravel', d: gravel }),
      lit ?? '',
      s('path', { class: 'zk-cane', d: post.cane, filter: 'url(#ink-rough)' }),
      s('path', { class: 'zk-knot', d: post.knots }),
      s('g', { transform: `translate(${f1(cx - R * (land ? 1.95 : 1.7))} ${f1(ground - ry * 0.05)})` }, stoneArt(R * 0.62, R * 0.36, 2538)),
      s('g', { transform: `translate(${f1(cx + R * (land ? 1.85 : 1.62))} ${f1(ground + ry * 0.15)})` }, stoneArt(R * 0.52, R * 0.3, 2539)),
      s('ellipse', { class: 't25m-shadow', cx: f1(cx + R * 0.12), cy: f1(ground - ry * 0.1), rx: f1(R * 1.5), ry: f1(ry * 0.42) }),
      s('path', { class: 't25m-stone', d: body, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
      s('path', { d: body, fill: 'url(#p2-shade)' }),
      s('path', { class: 't25m-top', d: topD, fill: grad(svg, [[0, '--rock-hi', 0.95], [1, '--rock-mid', 0.9]]), filter: 'url(#ink-rough)' }),
      s('path', { class: 'zk-ink t25m-ink', d: stroke(curve([cx - R * 1.38, cy + ry * 0.3], [cx - R * 0.2, cy + ry * 1.9], [cx + R * 1.36, cy + ry * 0.4], 18), Math.max(2, R * 0.025), 0.2, 0.25, 0.2) + stroke(curve([cx + R * 1.2, cy + ry * 1.1], [cx + R * 1.1, cy + ry * 1.9], [cx + R * 0.7, cy + ry * 2.3], 8), 1.6, 0.2, 0.4, 0.1), filter: 'url(#ink-rough)' }),
      s('path', { class: 't25m-moss', d: blob(cx - R * 0.9, cy + ry * 1.05, R * 0.35, ry * 0.18, 2540, 0.3) + blob(cx + R * 0.5, cy + ry * 1.38, R * 0.3, ry * 0.12, 2541, 0.3), filter: 'url(#ink-wash)' }),
      s('ellipse', { class: 't25m-lip', cx: f1(cx), cy: f1(cy + ry * 0.04), rx: f1(R * 1.06), ry: f1(ry * 1.08) }),
      s('ellipse', { cx: f1(cx), cy: f1(cy), rx: f1(R), ry: f1(ry), fill: grad(svg, [[0, '--water', 0.55], [0.7, '--water', 0.82], [1, '--water', 1]], 'r') }),
      s('g', { class: 't25m-face' },
        s('path', { class: 't25m-skin', d: blob(fx, fy, fr * 0.7, fr * 0.6, 2543, 0.05, 14), filter: 'url(#ink-wash)' }),
        s('path', { class: 'zk-ink t25m-feat', d:
          stroke(curve([fx - fr * 0.78, fy + fr * 0.05], [fx - fr * 0.72, fy - fr * 0.78], [fx + fr * 0.1, fy - fr * 0.68], 10), fr * 0.16, 0.1, 0.5, 0.2) +
          stroke(curve([fx - fr * 0.1, fy - fr * 0.72], [fx + fr * 0.7, fy - fr * 0.72], [fx + fr * 0.74, fy + fr * 0.02], 10), fr * 0.12, 0.3, 0.3, 0.2) +
          stroke(curve([fx - fr * 0.66, fy + fr * 0.18], [fx - fr * 0.4, fy + fr * 0.72], [fx + fr * 0.05, fy + fr * 0.68], 8), 1.4, 0.2, 0.5, 0.2) +
          stroke(curve([fx - fr * 0.4, fy - fr * 0.05], [fx - fr * 0.27, fy + fr * 0.04], [fx - fr * 0.12, fy - fr * 0.05], 5), 1.5, 0.3, 0.3, 0.3) +
          stroke(curve([fx + fr * 0.12, fy - fr * 0.05], [fx + fr * 0.27, fy + fr * 0.04], [fx + fr * 0.42, fy - fr * 0.05], 5), 1.5, 0.3, 0.3, 0.3) +
          stroke([[fx - fr * 0.1, fy + fr * 0.36], [fx + fr * 0.12, fy + fr * 0.35]], 1.3, 0.3, 0.3, 0.2), filter: 'url(#ink-rough)' })),
      s('ellipse', { class: 'zk-moonink t25m-moon', cx: f1(cx - R * 0.52), cy: f1(cy - ry * 0.42), rx: f1(R * 0.09), ry: f1(ry * 0.09) }),
      s('path', { class: 'zk-moonink t25m-glint', d: stroke([[cx - R * 0.68, cy - ry * 0.18], [cx - R * 0.38, cy - ry * 0.2]], 1.4, 0.3, 0.3, 0.2) + stroke([[cx - R * 0.62, cy - ry * 0.02], [cx - R * 0.44, cy - ry * 0.03]], 1.2, 0.3, 0.3, 0.2) }),
      s('path', { class: 'zk-cane', d: pipe.cane, filter: 'url(#ink-rough)' }),
      s('path', { class: 'zk-knot', d: pipe.knots }),
      s('path', { class: 't25m-stream', d: stroke([[tip[0] + 1, tip[1] + 2], [fall[0], (tip[1] + fall[1]) / 2], fall], 1.6, 0.05, 0.3, 0.3) }),
      s('g', { class: 't25m-drip', style: `--fall:${f1(fall[1] - tip[1] - 10)}px` }, s('ellipse', { class: 'zk-moonink', cx: f1(fall[0]), cy: f1(tip[1] + 10), rx: 2, ry: 3 })),
      s('path', { class: 'zk-cane', d: stroke(ladle, Math.max(3, R * 0.025), 0.05, 0.05, 0.8), filter: 'url(#ink-rough)' }),
      s('path', { class: 't25m-cup', d: blob(ladle[0][0] - R * 0.02, ladle[0][1] + ry * 0.02, R * 0.09, ry * 0.12, 2544, 0.05, 10), filter: 'url(#ink-rough)' }),
      s('path', { class: 't25m-bleaf', d: leaves.map((l) => l.blade).join(''), filter: 'url(#ink-rough)' }),
      s('path', { class: 'zk-rib', d: leaves.map((l) => l.rib).join('') }),
      grass(cx - R * 2.25, ground + ry * 0.1, R * 0.32, 2545),
      grass(cx + R * 1.45, ground + ry * 0.35, R * 0.24, 2546),
      ringG = rings(cx, cy, R * 0.18, ry * 0.18, 4, 'zk-ring t25m-rings'),
      s('g', { class: 't25m-drop-rings' }, rings(fall[0], fall[1], R * 0.05, ry * 0.05, 2, 'zk-ring')),
      fragG = s('g', { class: 't25m-frags' }, ...words))
    place(ai, cx - R * 0.66, cy + ry * 0.02, R * 1.32)
    place(label, cx - R, ground + 8, R * 2)
    btn.style.left = `${f1(cx)}px`
    btn.style.top = `${f1(ground + 34)}px`
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
