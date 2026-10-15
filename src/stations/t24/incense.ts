import { h, s } from '../../core/dom'
import type { SceneCtx } from '../types'
import { C } from './data'
import { blob, f1, glowDefs, moon, put, rng, slider, stage, stroke, waterBand, type Pt } from '../t22/kit'

const K = C.scenes.incense
const N = 4

/** Scene 4 — a monk sits by the lake; the longer the incense burns, the clearer the answer carved on the stone before him. */
export function incenseScene(ctx: SceneCtx) {
  let done = false
  const sl = slider(K.slider, K.sliderAria, N, K.valueText, think, [K.short, K.long])
  const far = h('div', { class: 'g8i-far g8-fade', 'data-off': '' }, ctx.fact(K.far, 'p', 'g8-note'))
  const ctrl = h('div', { class: 'g8i-ctrl g8-abs' }, sl.el, far)
  const back = s('g')
  const { root, svg } = stage(ctx, 'g8i', K.art, [K.insight], draw)
  const glow = glowDefs(svg)
  svg.append(back)
  root.append(ctrl)
  root.dataset.t = '0'
  ctx.prompt(K.prompt)

  function draw(W: number, H: number) {
    const wide = W > 760
    const ctrlH = wide ? 120 : 150
    const wy = H * (wide ? 0.42 : 0.4)
    const gy = H - ctrlH - 10
    const u = Math.min(wide ? 150 : 110, H * 0.24)
    const mx = W * (wide ? 0.32 : 0.28), my = gy - 6
    const r = rng(9)
    // draft lines floating on the water, and ripples that never become words
    const drafts = Array.from({ length: 6 }, (_, i) => {
      const x = W * (0.45 + r() * 0.45), y = wy + 14 + r() * (gy - wy - 60)
      return s('path', { class: `g8i-draft d${i % 3}`, d: Array.from({ length: 3 + Math.floor(r() * 3) }, (_, k) => stroke([[x + k * 18, y], [x + k * 18 + 10 + r() * 6, y - 1]], 2, 0.2, 0.3, 0.3)).join('') })
    })
    const ripples = [0.55, 0.72, 0.86].map((t, i) => s('ellipse', { class: 'g8i-rip', cx: f1(W * t), cy: f1(gy - 30 - i * 10), rx: f1(26 + i * 8), ry: f1(5 + i) }))
    // the monk: a few strokes
    const head: Pt = [mx, my - u * 0.86]
    const monk = s('g', { class: 'g8i-monk' },
      s('path', { class: 'k', 'fill-opacity': 0.82, d: `M${f1(mx - u * 0.42)} ${f1(my)}Q${f1(mx - u * 0.36)} ${f1(my - u * 0.5)} ${f1(mx - u * 0.06)} ${f1(my - u * 0.72)}Q${f1(mx + u * 0.18)} ${f1(my - u * 0.6)} ${f1(mx + u * 0.3)} ${f1(my - u * 0.2)}Q${f1(mx + u * 0.42)} ${f1(my)} ${f1(mx + u * 0.46)} ${f1(my)}Z`, filter: 'url(#ink-rough)' }),
      s('circle', { class: 'k', 'fill-opacity': 0.85, cx: f1(head[0]), cy: f1(head[1]), r: f1(u * 0.13) }),
      s('path', { class: 'p', 'fill-opacity': 0.4, d: stroke([[mx - u * 0.3, my - u * 0.1], [mx, my - u * 0.18], [mx + u * 0.34, my - u * 0.08]], 2, 0.2, 0.2, 0.3) }))
    // the incense: a stick in a bowl; the burnt part is drawn by CSS from --t
    const ix = mx + u * 0.75, iy = my - u * 0.08
    const stick = u * 0.7
    const smoke = s('path', { class: 'g8i-smoke', d: stroke([[ix, iy - stick], [ix - 8, iy - stick - 30], [ix + 6, iy - stick - 60], [ix - 4, iy - stick - 95]], 3, 0.1, 0.6, 0.2) })
    // the stone tablet and its answer
    const sx = mx + u * 1.45, sy = my
    const tw = u * 0.7, thh = u * 0.9
    const glyphs = Array.from({ length: 4 }, (_, k) => stroke([[sx - tw * 0.28, sy - thh * 0.78 + k * thh * 0.17], [sx + tw * (0.1 + r() * 0.18), sy - thh * 0.77 + k * thh * 0.17]], 3, 0.15, 0.3, 0.3)).join('')
    back.replaceChildren(
      moon(W * 0.78, H * 0.14, Math.min(W, H) * 0.045),
      waterBand(W, wy, gy, W * 0.78, 24),
      ...drafts, ...ripples,
      s('path', { class: 'g8i-ground', d: `M0 ${f1(gy - 4)}Q${f1(W * 0.4)} ${f1(gy - 12)} ${f1(W)} ${f1(gy - 2)}L${f1(W)} ${f1(H)}L0 ${f1(H)}Z` }),
      s('circle', { class: 'g8i-glow g8i-ember', cx: f1(ix), cy: f1(iy - stick), r: f1(u * 0.5), fill: glow }),
      monk,
      s('path', { class: 'k', 'fill-opacity': 0.7, d: blob(ix, iy + 4, 12, 6, 2, 0.05) }),
      s('rect', { class: 'g8i-stick', x: f1(ix - 1.4), y: f1(iy - stick), width: 2.8, height: f1(stick), style: `transform-origin:${f1(ix)}px ${f1(iy)}px` }),
      s('g', { class: 'g8i-ember' }, s('circle', { class: 'v', cx: f1(ix), cy: f1(iy - stick), r: 2.6 }), smoke),
      s('path', { class: 'g8i-tablet', d: `M${f1(sx - tw / 2)} ${f1(sy)}L${f1(sx - tw * 0.46)} ${f1(sy - thh)}Q${f1(sx)} ${f1(sy - thh * 1.08)} ${f1(sx + tw * 0.46)} ${f1(sy - thh)}L${f1(sx + tw / 2)} ${f1(sy)}Z`, filter: 'url(#ink-rough)' }),
      s('path', { class: 'g8i-answer', d: glyphs }),
      s('path', { class: 'v g8i-seal', d: blob(sx + tw * 0.28, sy - thh * 0.18, 5, 6, 3, 0.05) }))
    put(ctrl, 16, H - ctrlH, W - 32)
    root.style.setProperty('--stk', `${f1(stick * 0.8)}px`)
  }

  function think(v: number) {
    root.dataset.t = String(v)
    root.style.setProperty('--t', String(v / N))
    ctx.chime(v === N ? 'ok' : 'tap')
    if (v === N && !done) {
      done = true
      delete far.dataset.off
      ctx.insight(K.insight, K.detail)
    }
  }
}
