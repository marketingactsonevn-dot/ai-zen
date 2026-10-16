import { h, s } from '../../core/dom'
import type { SceneCtx } from '../types'
import { C } from './data'
import { blob, curve, f1, grass, nightShore, put, reeds, rng, slider, stage, stoneArt, stroke, type Pt } from '../t22/kit'

const K = C.scenes.incense
const N = 4

/** Scene 4 — a monk in a few strokes sits by the lake; the longer the incense burns, the clearer the answer carved on the stone before him; drafts float on the water, and deep down ripples never become words. */
export function incenseScene(ctx: SceneCtx) {
  let done = false
  const sl = slider(K.slider, K.sliderAria, N, K.valueText, think, [K.short, K.long])
  const far = h('div', { class: 'g8i-far g8-fade', 'data-off': '' }, ctx.fact(K.far, 'p', 'g8-note'))
  const ctrl = h('div', { class: 'g8i-ctrl g8-abs' }, sl.el, far)
  const back = s('g')
  const { root, svg } = stage(ctx, 'g8i', K.art, [K.insight], draw)
  svg.append(back)
  root.append(ctrl)
  root.dataset.t = '0'
  ctx.prompt(K.prompt)

  function draw(W: number, H: number) {
    const wide = W > 760
    const ctrlH = wide ? 120 : 150
    const wy = H * (wide ? 0.36 : 0.34)
    const gy = H - ctrlH - 16
    const u = Math.min(wide ? 190 : 116, H * 0.28)
    const mx = W * (wide ? 0.3 : 0.24), my = gy
    const r = rng(9)
    // drafts floating on the surface: short lines of brush "writing", some crossed out
    const drafts = Array.from({ length: 7 }, (_, i) => {
      const x = W * (0.5 + r() * 0.4), y = wy + 18 + r() * (gy - wy) * 0.42
      let d = ''
      for (let k = 0, xx = x; k < 3 + Math.floor(r() * 3); k++) {
        const len = 8 + r() * 16
        d += stroke([[xx, y + (r() - 0.5)], [xx + len, y + (r() - 0.5) * 2]], 1.8, 0.2, 0.3, 0.3)
        xx += len + 5
      }
      if (i % 3 === 1) d += stroke([[x - 3, y + 2], [x + 70, y - 3]], 1.2, 0.1, 0.1, 0.4)
      return s('path', { class: `g8i-draft d${i % 3}`, d })
    })
    // deep in the lake: ripples that never become words
    const ripples = [0.58, 0.74, 0.88].map((t, i) => {
      const cx = W * t, cy = wy + (gy - wy) * (0.66 + i * 0.07)
      let d = ''
      for (let k = 1; k <= 3; k++) d += stroke(Array.from({ length: 13 }, (_, j) => { const a = Math.PI * (1.08 + (j / 12) * 0.84); return [cx + Math.cos(a) * (14 + k * 11), cy + Math.sin(a) * (3 + k * 2.4)] as Pt }), 1.3, 0.3, 0.3, 0.1)
      return s('path', { class: 'g8i-rip', d })
    })
    // the monk, side on, facing the stone, head a little bowed: a pale wash for the robe, a strong brushed back, folds,
    // the hands in his lap, the vermilion sash; the head a light wash with its outline on the far side only
    const hx = mx + u * 0.1, hy = my - u * 0.86
    const robe = `M${f1(mx - u * 0.44)} ${f1(my)}C${f1(mx - u * 0.5)} ${f1(my - u * 0.42)} ${f1(mx - u * 0.3)} ${f1(my - u * 0.7)} ${f1(mx - u * 0.04)} ${f1(my - u * 0.74)}C${f1(mx + u * 0.16)} ${f1(my - u * 0.74)} ${f1(mx + u * 0.2)} ${f1(my - u * 0.5)} ${f1(mx + u * 0.26)} ${f1(my - u * 0.34)}C${f1(mx + u * 0.4)} ${f1(my - u * 0.26)} ${f1(mx + u * 0.58)} ${f1(my - u * 0.16)} ${f1(mx + u * 0.56)} ${f1(my)}Z`
    const monk = s('g', { class: 'g8i-monk' },
      s('path', { class: 'g8i-robe', d: robe, filter: 'url(#ink-wash)' }),
      s('path', { class: 'g8i-contour', d: stroke(curve([mx - u * 0.44, my + 1], [mx - u * 0.52, my - u * 0.5], [mx - u * 0.06, my - u * 0.75], 16), u * 0.05, 0.04, 0.3, 0.2) + stroke(curve([mx + u * 0.27, my - u * 0.32], [mx + u * 0.5, my - u * 0.22], [mx + u * 0.57, my - u * 0.02], 10), u * 0.03, 0.1, 0.3, 0.2) + stroke([[mx - u * 0.48, my + 2], [mx + u * 0.04, my + 3], [mx + u * 0.6, my + 1]], u * 0.026, 0.05, 0.3, 0.3), filter: 'url(#ink-rough)' }),
      s('path', { class: 'g8i-fold', d: stroke(curve([mx - u * 0.2, my - u * 0.6], [mx - u * 0.26, my - u * 0.3], [mx - u * 0.16, my - u * 0.04], 10), u * 0.016, 0.2, 0.3, 0.2) + stroke(curve([mx + u * 0.06, my - u * 0.24], [mx + u * 0.2, my - u * 0.12], [mx + u * 0.32, my - u * 0.08], 8), u * 0.014, 0.2, 0.3, 0.2) }),
      s('path', { class: 'g8i-sash', d: stroke(curve([mx - u * 0.1, my - u * 0.72], [mx + u * 0.06, my - u * 0.5], [mx + u * 0.1, my - u * 0.26], 10), u * 0.032, 0.2, 0.3, 0.2) }),
      s('path', { class: 'g8i-sleeve', d: stroke(curve([mx + u * 0.12, my - u * 0.56], [mx + u * 0.2, my - u * 0.36], [mx + u * 0.36, my - u * 0.27], 8), u * 0.07, 0.15, 0.5, 0.3), filter: 'url(#ink-rough)' }),
      s('path', { class: 'g8i-hands', d: blob(mx + u * 0.36, my - u * 0.27, u * 0.06, u * 0.04, 2444, 0.15, 10) }),
      s('circle', { class: 'g8i-head', cx: f1(hx), cy: f1(hy), r: f1(u * 0.1) }),
      s('path', { class: 'g8i-head-ink', d: stroke(Array.from({ length: 14 }, (_, j) => { const a = Math.PI * (0.62 + (j / 13) * 1.05); return [hx + Math.cos(a) * u * 0.1, hy + Math.sin(a) * u * 0.1] as Pt }), u * 0.024, 0.2, 0.3, 0.2) + stroke([[hx - u * 0.015, hy + u * 0.005], [hx - u * 0.005, hy + u * 0.03]], u * 0.016, 0.2, 0.2, 0.3) }))
    // the incense: a three-legged censer, the stick (the burnt part is drawn by CSS from --t), ember and smoke
    const ix = mx + u * 0.82, iy = my - u * 0.1
    const stick = u * 0.7
    const censer = `M${f1(ix - u * 0.11)} ${f1(iy - u * 0.04)}Q${f1(ix - u * 0.12)} ${f1(iy + u * 0.07)} ${f1(ix)} ${f1(iy + u * 0.08)}Q${f1(ix + u * 0.12)} ${f1(iy + u * 0.07)} ${f1(ix + u * 0.11)} ${f1(iy - u * 0.04)}Z`
    let smoke = ''
    for (let k = 0; k < 3; k++) smoke += stroke(curve([ix + k * 2, iy - stick - 3], [ix - 14 + k * 9, iy - stick - 34 - k * 12], [ix + 6 - k * 4, iy - stick - 70 - k * 18], 14), 2.2 - k * 0.5, 0.1, 0.7, 0.1)
    // the standing stone and the answer carved on it, in short columns of brush marks (no crosses)
    const sx = mx + u * 1.5, sy = my
    const tw = u * 0.66, thh = u * 0.95
    const gr = rng(2445)
    let glyphs = ''
    for (let col = 0; col < 3; col++) {
      const x = sx + tw * (0.16 - col * 0.17)
      for (let k = 0; k < 4 - (col === 2 ? 1 : 0); k++) {
        const y = sy - thh * 0.74 + k * thh * 0.15, g = tw * 0.055
        const kind = Math.floor(gr() * 4)
        if (kind === 0) glyphs += stroke([[x - g, y], [x + g, y + 0.6]], 2.2, 0.2, 0.3, 0.3) + stroke([[x + g * 0.4, y + g * 0.9], [x + g * 0.7, y + g * 1.4]], 2.4, 0.1, 0.5, 0.3)
        else if (kind === 1) glyphs += stroke([[x - g * 0.3, y - g * 0.4], [x - g, y + g * 1.1]], 2, 0.2, 0.4, 0.3) + stroke([[x + g * 0.3, y - g * 0.3], [x + g, y + g * 1.1]], 2, 0.2, 0.5, 0.3)
        else if (kind === 2) glyphs += stroke([[x - g * 0.5, y - g * 0.5], [x - g * 0.5, y + g * 1.2]], 2.2, 0.2, 0.4, 0.3) + stroke([[x + g * 0.4, y], [x + g * 0.7, y + g * 0.4]], 2.4, 0.1, 0.5, 0.3)
        else glyphs += [0, 1, 2].map((j) => stroke([[x - g * (0.8 - j * 0.1), y - g * 0.4 + j * g * 0.7], [x + g * (0.8 - j * 0.2), y - g * 0.4 + j * g * 0.7 + 0.5]], 1.8, 0.2, 0.3, 0.3)).join('')
      }
    }
    back.replaceChildren(
      ...nightShore(W, wy, gy - 6, { seed: 24, mx: W * 0.76, my: H * 0.13, mr: Math.min(W, H) * 0.045, hh: H * (wide ? 0.13 : 0.1), side: 1 }),
      ...drafts, ...ripples,
      reeds(W * 0.95, gy + 4, u * 0.5, 2441, 7),
      grass(mx - u * 0.75, gy + 6, u * 0.3, 2442),
      grass(sx + tw * 0.8, gy + 6, u * 0.26, 2443),
      s('ellipse', { class: 'g8i-mat', cx: f1(mx + 4), cy: f1(my + 3), rx: f1(u * 0.62), ry: f1(u * 0.06) }),
      s('circle', { class: 'g8i-glow g8i-ember', cx: f1(ix), cy: f1(iy - stick), r: f1(u * 0.5), fill: 'url(#p2-lamp)' }),
      monk,
      s('path', { class: 'g8i-stick', d: `M${f1(ix - 1.3)} ${f1(iy - stick)}h2.6V${f1(iy)}h-2.6Z`, style: `transform-origin:${f1(ix)}px ${f1(iy)}px` }),
      s('path', { class: 'g8i-censer', d: censer, filter: 'url(#ink-rough)' }),
      s('path', { class: 'g8i-legs', d: stroke([[ix - u * 0.07, iy + u * 0.06], [ix - u * 0.09, iy + u * 0.1]], 2, 0.1, 0.2, 0.5) + stroke([[ix + u * 0.07, iy + u * 0.06], [ix + u * 0.09, iy + u * 0.1]], 2, 0.1, 0.2, 0.5) + stroke([[ix - u * 0.13, iy - u * 0.045], [ix + u * 0.13, iy - u * 0.045]], 2.2, 0.1, 0.1, 0.4) }),
      s('g', { class: 'g8i-ember' }, s('circle', { class: 'g8i-coal', cx: f1(ix), cy: f1(iy - stick), r: 2.6 }), s('path', { class: 'g8i-smoke', d: smoke })),
      s('g', { transform: `translate(${f1(sx)} ${f1(sy)})` }, stoneArt(tw, thh, 2446)),
      s('path', { class: 'g8i-answer', d: glyphs }),
      s('path', { class: 'g8i-seal', d: blob(sx - tw * 0.22, sy - thh * 0.22, 5, 6, 3, 0.05) }))
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
