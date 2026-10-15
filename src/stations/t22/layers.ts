import { h, s } from '../../core/dom'
import type { SceneCtx } from '../types'
import { C } from './data'
import { blob, f1, moon, put, rng, slider, stage, stroke } from './kit'

const K = C.scenes.layers

/** Scene 3 — a cut through a deep pond: a pebble carved “nó” sinks layer by layer and its meaning darkens with every one. */
export function layersScene(ctx: SceneCtx) {
  const N = K.stages.length
  let depth = 0
  let done = false
  const reads = K.stages.map((st) => h('div', { class: 'g8y-read', 'data-off': '' }, h('span', { class: 'g8y-at' }, st.at), h('p', null, st.reads)))
  const sl = slider(K.slider, K.sliderAria, N, K.valueText, sink)
  const note = h('div', { class: 'g8y-note g8-fade', 'data-off': '' }, ctx.fact(K.stagesNote, 'p', 'g8-note'))
  const ctrl = h('div', { class: 'g8y-ctrl' }, sl.el, note)
  const back = s('g')
  const pebble = s('g', { class: 'g8y-pebble' })
  const { root, svg } = stage(ctx, 'g8y', K.art, [K.insight], draw)
  svg.append(back, pebble)
  root.append(...reads, ctrl)
  ctx.prompt(K.prompt)

  let ys: number[] = []

  function draw(W: number, H: number) {
    const wide = W > 700
    const ctrlH = wide ? 100 : 132
    const top = H * (wide ? 0.2 : 0.17)
    const bot = H - ctrlH - 8
    const bh = (bot - top) / N
    const px0 = wide ? W * 0.3 : W * 0.2
    const r = rng(5)
    const bands = K.stages.map((_, i) => {
      const y = top + i * bh
      const wave = (yy: number, k: number) => `M0 ${f1(yy)}Q${f1(W * 0.25)} ${f1(yy - 5 + k)} ${f1(W * 0.5)} ${f1(yy)}T${f1(W)} ${f1(yy)}`
      return s('g', null,
        s('path', { class: 'g8y-band', style: `fill-opacity:${(0.32 + i * 0.24).toFixed(2)}`, d: `${wave(y, i)}L${f1(W)} ${f1(bot)}L0 ${f1(bot)}Z` }),
        s('path', { class: 'g8y-silk', d: stroke([[0, y], [W * 0.25, y - 3], [W * 0.5, y + 1], [W * 0.75, y - 2], [W, y]], 2, 0.2, 0.2, 0.2) }))
    })
    // light shafts from the moon, weaker with depth; a bed of stones at the bottom
    const shafts = [0.55, 0.7, 0.84].map((t, i) => s('path', { class: 'g8y-shaft', d: `M${f1(W * t)} ${f1(top)}L${f1(W * t + 30 + i * 6)} ${f1(top)}L${f1(W * t - 60 + i * 30)} ${f1(bot)}L${f1(W * t - 110 + i * 30)} ${f1(bot)}Z` }))
    const bed = Array.from({ length: 14 }, (_, i) => {
      const x = (i + r() * 0.6) * (W / 14)
      const rr = 8 + r() * 14
      return s('path', { class: 'k', 'fill-opacity': f1(0.25 + r() * 0.25), d: blob(x, bot - rr * 0.2, rr, rr * 0.45, i + 3, 0.12) })
    })
    back.replaceChildren(
      moon(W * 0.82, top * 0.45, Math.min(W, H) * 0.035),
      ...bands, ...shafts, ...bed,
      s('path', { class: 'g8-shore', d: stroke([[-4, top + 1], [W * 0.3, top - 3], [W * 0.6, top + 2], [W + 4, top]], 2.4, 0.1, 0.1, 0.3), filter: 'url(#ink-rough)' }))
    ys = [top - 26, ...K.stages.map((_, i) => top + (i + 0.5) * bh)]
    const pr = Math.min(46, W * 0.09)
    pebble.replaceChildren(
      s('g', { class: 'g8y-rings' }, ...[1, 2, 3].map((k) => s('ellipse', { class: `g8y-ring r${k}`, cx: 0, cy: 0, rx: f1(pr * (1 + k * 0.28)), ry: f1(pr * 0.55 * (1 + k * 0.28)) }))),
      s('path', { class: 'g8y-stone', d: blob(0, 0, pr, pr * 0.6, 9, 0.07), filter: 'url(#ink-rough)' }),
      s('path', { class: 'g8y-rim', d: stroke([[-pr * 0.8, -pr * 0.3], [-pr * 0.2, -pr * 0.58], [pr * 0.6, -pr * 0.38]], 2.2, 0.3, 0.4, 0.2) }),
      s('text', { class: 'g8y-word', x: 0, y: f1(pr * 0.16), 'font-size': f1(pr * 0.6), 'text-anchor': 'middle' }, K.word))
    pebble.style.setProperty('--x', `${f1(px0)}px`)
    place()
    const rx = px0 + pr * 1.9
    reads.forEach((el, i) => put(el, Math.min(rx, W - 200), ys[i + 1] - 22, Math.max(150, W - rx - 16)))
    put(ctrl, 16, H - ctrlH, W - 32)
  }

  function place() {
    pebble.style.transform = `translate(var(--x), ${f1(ys[depth] ?? 0)}px)`
    pebble.dataset.depth = String(depth)
    reads.forEach((el, i) => {
      if (i < depth) delete el.dataset.off
      else el.dataset.off = ''
      el.classList.toggle('now', i === depth - 1)
    })
  }

  function sink(v: number) {
    depth = v
    place()
    ctx.chime(v ? 'tap' : 'soft')
    if (v === N && !done) {
      done = true
      delete note.dataset.off
      ctx.insight(K.insight, K.detail)
    }
  }
}
