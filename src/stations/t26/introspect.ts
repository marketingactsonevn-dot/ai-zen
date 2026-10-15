import { h, s } from '../../core/dom'
import { blob, curve, stroke, type Pt } from '../../ui/part2/ink'
import type { SceneCtx } from '../types'
import C from '../../content/tram-26.json'
import { F, P, dashes, f1, grad, moon, place, reeds, rings, stage } from '../t25/kit'

/** A standing heron in absolute coordinates: foot at (x, y), `t` tall. Returns its body and its head (which can lift). */
function heron(x: number, y: number, t: number, cls: string) {
  const A = (dx: number, dy: number): Pt => [x + dx * t, y - dy * t]
  const neck0 = A(0.1, 0.47)
  const head = s('g', { class: 't26i-head', style: `transform-origin:${f1(neck0[0])}px ${f1(neck0[1])}px` },
    s('path', { class: 't26i-bird', d: stroke(curve(neck0, A(0.26, 0.6), A(0.15, 0.76)), t * 0.045, 0.1, 0.1, 0.6) }),
    s('ellipse', { class: 't26i-bird', cx: A(0.165, 0.78)[0], cy: A(0.165, 0.78)[1], rx: t * 0.042, ry: t * 0.032 }),
    s('path', { class: 't26i-beak', d: `M${P(A(0.19, 0.795))}L${P(A(0.33, 0.7))}L${P(A(0.19, 0.765))}Z` }),
    s('path', { class: 'k', d: stroke([A(0.15, 0.8), A(0.06, 0.82), A(0.0, 0.79)], t * 0.012, 0.1, 0.7) }),
    s('circle', { class: 'k', cx: A(0.18, 0.785)[0], cy: A(0.18, 0.785)[1], r: Math.max(1, t * 0.006) }))
  const g = s('g', { class: cls },
    s('path', { class: 'k', 'fill-opacity': 0.8, d: stroke([A(0, 0), A(0.01, 0.34)], Math.max(1.6, t * 0.012), 0.1, 0.1) + stroke([A(0.01, 0.32), A(0.07, 0.25), A(0.03, 0.34)], Math.max(1.4, t * 0.01), 0.1, 0.1) }),
    s('path', { class: 'k', 'fill-opacity': 0.55, d: stroke([A(-0.14, 0.44), A(-0.24, 0.38)], t * 0.03, 0.1, 0.8) + stroke([A(-0.12, 0.42), A(-0.22, 0.34)], t * 0.02, 0.1, 0.8) }),
    s('path', { class: 't26i-bird', d: blob(x, y - 0.44 * t, 0.17 * t, 0.075 * t, 4, 0.06), transform: `rotate(-14 ${f1(x)} ${f1(y - 0.44 * t)})` }),
    s('path', { class: 'k', 'fill-opacity': 0.45, d: stroke([A(-0.15, 0.45), A(-0.02, 0.5), A(0.1, 0.5)], t * 0.035, 0.2, 0.4), filter: 'url(#ink-rough)' }),
    head)
  return { g, head }
}

/** Scene 2 — a heron looks at its reflection; drop a glowing ink drop of a concept into the lake and ask if it noticed. */
export function introspectScene(ctx: SceneCtx) {
  const K = C.scenes.introspect
  const keys = ['weak', 'mid', 'strong'] as const
  let lv = 1
  const tried = new Set<number>()
  let second = false
  const concept = h('p', { class: 'zk-q t26i-concept' }, h('strong', null, K.concept), h('span', { class: 'zk-small' }, K.conceptNote))
  const lvBtns = K.levels.map((t, i) => h('button', { class: 'zk-btn t26i-lv', type: 'button', 'aria-pressed': String(i === lv), onClick: () => setLv(i) }, t))
  const ask = h('button', { class: 'zk-btn t26i-ask', type: 'button', 'aria-label': K.askAria, onClick: drop }, K.ask)
  const ctl = h('div', { class: 't26i-ctl' },
    h('p', { class: 'zk-small', 'aria-hidden': 'true' }, K.strength),
    h('div', { class: 't26i-row' }, h('div', { class: 't26i-seg', role: 'group', 'aria-label': K.strengthAria }, ...lvBtns), ask))
  const out = h('p', { class: 't26i-out' })
  const ans = h('div', { class: 'zk-note t26i-ans', hidden: true }, h('p', { class: 't26i-qline' }, K.question), out, ctx.fact(F(K.illustration), 'div', 'zk-small'))
  let ink: SVGGElement
  let bird: ReturnType<typeof heron>, ghost: ReturnType<typeof heron>

  const { root, svg } = stage(ctx, 't26i', K.art, K.insights, (W, H) => {
    const land = W / H > 1.05
    const cw = Math.min(W - 24, 560)
    place(concept, (W - cw) / 2, 4, cw)
    const top = concept.offsetHeight + 10
    const ch = 84
    place(ctl, (W - cw) / 2, H - ch, cw)
    const hz = top + (H - ch - top) * (land ? 0.38 : 0.42)
    const wb = H - ch - 6
    const t = Math.min((wb - top) * 0.9, land ? 300 : 230)
    const bx = land ? W * 0.6 : W * 0.72, by = hz + (wb - hz) * 0.42
    const dx = land ? W * 0.36 : W * 0.24
    const water = grad(svg, [[0, '--water', 0.22], [1, '--water', 0.55]])
    bird = heron(bx, by, t, 't26i-heron')
    ghost = heron(bx, by, t, 't26i-heron')
    const mx = land ? W * 0.2 : W * 0.18, my = top + (hz - top) * 0.4
    svg.replaceChildren(
      s('path', { class: 'k', 'fill-opacity': 0.08, d: blob(W * 0.3, hz, W * 0.4, (hz - top) * 0.3, 3, 0.2) + blob(W * 0.82, hz, W * 0.3, (hz - top) * 0.22, 8, 0.2), filter: 'url(#ink-wash)' }),
      moon(mx, my, Math.min(W, H) * 0.03),
      s('g', null,
        s('rect', { x: 0, y: hz, width: W, height: wb - hz, fill: water }),
        s('path', { class: 'zk-dash', d: [0, 1, 2, 3, 4].map((i) => stroke([[mx - 14 + i * 2, hz + 8 + i * 9], [mx + 14 - i * 2, hz + 9 + i * 9]], 2.2, 0.3, 0.3)).join('') }),
        dashes(0, hz + 6, W, wb - hz - 12, 14, 26, 'zk-dash t26i-glint')),
      s('rect', { class: 't26i-murk', x: 0, y: hz, width: W, height: wb - hz, filter: 'url(#ink-wash)' }),
      s('g', { transform: `translate(0 ${f1(by * 2)}) scale(1 -1)`, class: 't26i-refl' }, ghost.g),
      bird.g,
      reeds(W * 0.06, hz + 10, 7, (wb - hz) * 0.5, 3), reeds(W * 0.95, hz + 14, 6, (wb - hz) * 0.42, 9),
      s('g', { class: 't26i-splash' }, rings(dx, by + (wb - by) * 0.3, 10, 3, 4)),
      ink = s('g', { class: 't26i-ink', style: `--fall:${f1(by + (wb - by) * 0.3 - top - 20)}px` }, s('ellipse', { cx: dx, cy: top + 20, rx: 6, ry: 8 }), s('ellipse', { class: 't26i-inkglow', cx: dx, cy: top + 20, rx: 18, ry: 18 })))
    if (land) place(ans, W * 0.05, hz + 8, Math.min(W * 0.3, 330))
    else place(ans, 12, top + 4, W * 0.52)
    paint()
  })
  root.append(concept, ans, ctl)
  ctx.prompt(K.prompt)

  function setLv(i: number) {
    lv = i
    lvBtns.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)))
  }
  function paint() {
    root.dataset.lv = root.dataset.asked ? String(lv) : ''
    ink.style.setProperty('--size', String([0.6, 1, 1.6][lv]))
  }
  function drop() {
    root.dataset.asked = '1'
    root.dataset.lv = String(lv)
    // replay the fall and the rings
    root.classList.remove('go')
    void root.offsetWidth
    root.classList.add('go')
    paint()
    out.textContent = K.outcomes[keys[lv]]
    ans.hidden = false
    if (!out.hasAttribute('aria-live')) out.setAttribute('aria-live', 'polite')
    const first = !tried.size
    tried.add(lv)
    ctx.chime(lv === 1 ? 'ok' : 'soft')
    if (first) ctx.insight(F(K.insights[0]), F(K.insights[0].detail))
    else if (!second && tried.size >= 2 && tried.has(1)) {
      second = true
      ctx.insight(F(K.insights[1]))
    }
  }
}
