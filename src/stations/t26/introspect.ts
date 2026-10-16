import { h, s } from '../../core/dom'
import { blob, curve, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist, moon, reeds, water } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import C from '../../content/tram-26.json'
import { F, f1, place, rings, stage } from '../t25/kit'

/**
 * An egret painted in a few strokes, foot at (x, y), `t` tall, standing on one leg and looking down. Its neck and head are
 * one group (`.t26i-head`) that can lift, pivoting where the neck leaves the body.
 */
function egret(x: number, y: number, t: number, cls: string) {
  const A = (dx: number, dy: number): Pt => [x + dx * t, y - dy * t]
  const Q = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`
  const n0 = A(0.1, 0.52)
  const neck = [...curve(n0, A(0.25, 0.66), A(0.19, 0.8), 12), ...curve(A(0.19, 0.8), A(0.16, 0.88), A(0.27, 0.8), 8).slice(1)]
  const hd = A(0.29, 0.785)
  const head = s('g', { class: 't26i-head', style: `transform-origin:${f1(n0[0])}px ${f1(n0[1])}px` },
    s('path', { class: 't26i-bird', d: stroke(neck, t * 0.05, 0.25, 0.05, 0.55) }),
    s('path', { class: 'zk-ink t26i-edge', d: stroke(neck.map(([a, b]) => [a - t * 0.014, b - t * 0.004] as Pt).slice(3), t * 0.012, 0.2, 0.4, 0.2), filter: 'url(#ink-rough)' }),
    s('path', { class: 't26i-bird', d: blob(hd[0], hd[1], t * 0.036, t * 0.027, 4, 0.08, 10) }),
    s('path', { class: 't26i-beak', d: `M${Q(A(0.305, 0.805))}L${Q(A(0.41, 0.665))}L${Q(A(0.315, 0.77))}Z` }),
    s('path', { class: 'zk-ink t26i-crest', d: stroke([A(0.27, 0.805), A(0.21, 0.83), A(0.15, 0.805)], t * 0.007, 0.1, 0.7, 0.1) + stroke([A(0.27, 0.8), A(0.2, 0.815), A(0.16, 0.785)], t * 0.005, 0.1, 0.7, 0.1) }),
    s('circle', { class: 'zk-ink', cx: f1(A(0.3, 0.79)[0]), cy: f1(A(0.3, 0.79)[1]), r: f1(Math.max(1, t * 0.006)) }))
  const body = `M${Q(A(-0.28, 0.37))}Q${Q(A(-0.18, 0.52))} ${Q(A(-0.04, 0.565))}Q${Q(A(0.1, 0.59))} ${Q(A(0.15, 0.5))}Q${Q(A(0.13, 0.385))} ${Q(A(-0.02, 0.38))}Q${Q(A(-0.15, 0.335))} ${Q(A(-0.28, 0.37))}Z`
  const g = s('g', { class: cls },
    s('path', { class: 'zk-ink t26i-leg', d: stroke([A(0, -0.02), A(0.005, 0.2), A(0.02, 0.4)], Math.max(1.6, t * 0.012), 0.05, 0.1, 0.6) + stroke([A(0.02, 0.4), A(0.1, 0.3), A(0.05, 0.27)], Math.max(1.4, t * 0.011), 0.1, 0.2, 0.5) }),
    s('path', { class: 't26i-bird', d: body, filter: 'url(#ink-rough)' }),
    s('path', { class: 't26i-shade', d: blob(x - 0.04 * t, y - 0.42 * t, 0.15 * t, 0.045 * t, 6, 0.1, 12), filter: 'url(#ink-wash)' }),
    s('path', { class: 'zk-ink t26i-wing', d: stroke(curve(A(0.1, 0.545), A(-0.1, 0.56), A(-0.33, 0.35), 14), t * 0.04, 0.3, 0.5, 0.1) + stroke([A(-0.18, 0.4), A(-0.27, 0.355), A(-0.35, 0.32)], t * 0.022, 0.2, 0.6, 0.1) + stroke([A(-0.16, 0.39), A(-0.26, 0.34), A(-0.32, 0.29)], t * 0.016, 0.2, 0.6, 0.1), filter: 'url(#ink-rough)' }),
    s('path', { class: 'zk-ink t26i-belly', d: stroke(curve(A(0.13, 0.42), A(0.02, 0.37), A(-0.16, 0.35), 10), t * 0.012, 0.2, 0.4, 0.1) }),
    head)
  return g
}

/** Scene 2 — an egret in the night pond looks at its reflection; a hand drops a glowing ink drop (a concept) and asks it. */
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

  const { root, svg } = stage(ctx, 't26i', K.art, K.insights, (W, H) => {
    const land = W / H > 1.05
    const cw = Math.min(W - 24, 560)
    place(concept, (W - cw) / 2, 4, cw)
    const top = concept.offsetHeight + 10
    const ch = 84
    place(ctl, (W - cw) / 2, H - ch, cw)
    const hz = top + (H - ch - top) * (land ? 0.36 : 0.4)
    const wb = H - ch - 6
    const t = Math.min((wb - top) * 0.92, land ? 320 : 240)
    const bx = land ? W * 0.62 : W * 0.66, by = hz + (wb - hz) * 0.4
    const dx = land ? W * 0.31 : W * 0.24
    const fallY = by + (wb - by) * 0.3
    const mx = land ? W * 0.84 : W * 0.5, my = top + (hz - top) * (land ? 0.34 : 0.5)
    // a hand from the left bank holding a brush over the water; the drop forms at its tip
    const tipY = top + Math.min(70, (hz - top) * 0.75)
    const hy = tipY - 46
    svg.replaceChildren(
      mist(mx, my, W * 0.3, (hz - top) * 0.5),
      moon(mx, my, Math.min(W, H) * 0.028, 2621, true),
      hills(-W * 0.05, W * 1.05, hz, (hz - top) * 0.42, 2622, 0.9, 6),
      hills(-W * 0.04, W * 0.3, hz, (hz - top) * 0.26, 2623, 0.75, 2),
      mist(W * 0.5, hz - 4, W * 0.6, (hz - top) * 0.12),
      water(0, hz, W, wb, 2624, mx),
      s('g', { class: 't26i-murk' }, s('rect', { x: 0, y: f1(hz), width: f1(W), height: f1(wb - hz), filter: 'url(#ink-wash)' })),
      s('g', { transform: `translate(0 ${f1(by * 2)}) scale(1 -1)`, class: 't26i-refl' }, egret(bx, by, t, 't26i-heron')),
      s('path', { class: 'p2p-ripple', d: [0, 1, 2, 3].map((k) => stroke([[bx - t * (0.3 - k * 0.04), by + t * (0.08 + k * 0.09)], [bx + t * (0.2 - k * 0.03), by + t * (0.085 + k * 0.09)]], 1.4, 0.3, 0.3, 0.2)).join('') }),
      egret(bx, by, t, 't26i-heron'),
      s('path', { class: 'zk-ink t26i-wade', d: stroke([[bx - t * 0.06, by + 1], [bx + t * 0.07, by + 1.5]], 1.6, 0.3, 0.3, 0.2) }),
      reeds(W * 0.05, hz + 12, (wb - hz) * 0.55, 2625, 8), reeds(W * 0.95, hz + 16, (wb - hz) * 0.45, 2626, 6),
      s('path', { class: 't26i-bank', d: blob(-W * 0.02, hz + 6, W * 0.16, (wb - hz) * 0.06, 2627, 0.15, 14), filter: 'url(#ink-wash)' }),
      s('path', { class: 't26i-sleeve', d: stroke(curve([dx - 100, hy - 60], [dx - 50, hy - 40], [dx - 13, hy - 5], 12), 24, 0.02, 0.4, 0.5), filter: 'url(#ink-wash)' }),
      s('path', { class: 'zk-cane', d: stroke([[dx + 1, hy - 26], [dx, tipY - 16]], 4.2, 0.05, 0.05, 0.8) }),
      s('path', { class: 'zk-ink t26i-brush', d: stroke([[dx, tipY - 17], [dx + 0.5, tipY - 8], [dx, tipY]], 6.5, 0.1, 0.85, 0.1) }),
      s('path', { class: 't26i-hand', d: blob(dx - 5, hy - 2, 10, 8.5, 2628, 0.12, 12), filter: 'url(#ink-rough)' }),
      s('path', { class: 'zk-ink t26i-finger', d: stroke(curve([dx - 10, hy - 6], [dx + 6, hy - 6], [dx + 4, hy + 3], 6), 1.4, 0.2, 0.4, 0.2) + stroke(curve([dx - 9, hy + 1], [dx + 5, hy + 1], [dx + 3, hy + 8], 6), 1.4, 0.2, 0.4, 0.2) }),
      s('g', { class: 't26i-splash' }, rings(dx, fallY, 10, 3, 4)),
      ink = s('g', { class: 't26i-ink', style: `--fall:${f1(fallY - tipY - 6)}px` },
        s('ellipse', { class: 't26i-inkglow', cx: f1(dx), cy: f1(tipY + 6), rx: 18, ry: 18 }),
        s('ellipse', { class: 't26i-drop', cx: f1(dx), cy: f1(tipY + 6), rx: 5, ry: 7 })))
    if (land) place(ans, W * 0.03, hz + 12, Math.min(W * 0.24, 320))
    else place(ans, 12, hz + (wb - hz) * 0.32, W * 0.56)
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
