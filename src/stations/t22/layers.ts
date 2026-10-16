import { h, s } from '../../core/dom'
import type { SceneCtx } from '../types'
import { C } from './data'
import { blob, curve, f1, hills, mist, moon, put, reeds, rng, slider, stage, stoneArt, stroke, wash, type Pt } from './kit'

const K = C.scenes.layers

/** Scene 3 — a cut through a deep pond under the moon: silk bands of water darkening toward the bed; a pebble carved “nó” sinks and its word gains ink at every layer. */
export function layersScene(ctx: SceneCtx) {
  const N = K.stages.length
  let depth = 0
  let done = false
  const reads = K.stages.map((st) => h('div', { class: 'g8y-read', 'data-off': '' }, h('span', { class: 'g8y-at' }, st.at), h('p', null, st.reads)))
  const sl = slider(K.slider, K.sliderAria, N, K.valueText, sink)
  const note = h('div', { class: 'g8y-note g8-fade', 'data-off': '' }, ctx.fact(K.stagesNote, 'p', 'g8-note'))
  const ctrl = h('div', { class: 'g8y-ctrl' }, sl.el, note)
  const back = s('g')
  const essay = s('g', { class: 'g8y-essay' })
  const rings = s('g', { class: 'g8y-rings' })
  const pebble = s('g', { class: 'g8y-pebble' })
  const { root, svg } = stage(ctx, 'g8y', K.art, [K.insight], draw)
  svg.append(back, rings, essay, pebble)
  root.append(...reads, ctrl)
  ctx.prompt(K.prompt)

  let ys: number[] = []

  function draw(W: number, H: number) {
    const wide = W > 700
    const ctrlH = wide ? 100 : 132
    const top = H * (wide ? 0.22 : 0.18)
    const bh = (H - ctrlH - 18 - top) / (N + 0.34)
    const bot = top + N * bh
    const px0 = wide ? W * 0.32 : W * 0.24
    const r = rng(5)
    // the basin: banks curve in from the surface, the bed dips in the middle
    const dip = bh * 0.32
    const xl = (y: number) => W * (0.045 + 0.13 * Math.pow(Math.max(0, (y - top) / (bot - top)), 1.7)) + Math.sin(y * 0.05) * W * 0.006
    const xr = (y: number) => W - W * (0.04 + 0.12 * Math.pow(Math.max(0, (y - top) / (bot - top)), 1.9)) + Math.sin(y * 0.043 + 2) * W * 0.006
    const side = (f: (y: number) => number) => Array.from({ length: 15 }, (_, i) => { const y = top + ((bot - top) * i) / 14; return [f(y), y] as Pt })
    const L = side(xl), R = side(xr)
    const bedY = (x: number) => bot + dip * Math.sin(Math.PI * Math.min(1, Math.max(0, (x - xl(bot)) / (xr(bot) - xl(bot)))))
    const bedPts = Array.from({ length: 17 }, (_, i) => { const x = xl(bot) + ((xr(bot) - xl(bot)) * i) / 16; return [x, bedY(x)] as Pt })
    const basin = `M${[...L, ...bedPts, ...[...R].reverse()].map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}Z`
    const clip = `g8y-clip-${Math.round(W)}`
    // silk bands: each a wash a shade deeper, a pale sheen along its top, long faint folds inside
    const wave = (y: number, k: number): Pt[] => Array.from({ length: 17 }, (_, i) => [(W * i) / 16, y + Math.sin(i * 0.9 + k * 1.7) * bh * 0.035 + Math.sin(i * 0.37 + k) * bh * 0.05] as Pt)
    const bands = K.stages.map((_, i) => {
      const y = top + i * bh
      const edge = wave(y, i)
      let folds = ''
      for (let k = 0; k < 4; k++) {
        const fy = y + bh * (0.25 + k * 0.18) + (r() - 0.5) * 6
        const x0 = W * (0.08 + r() * 0.3), x1 = x0 + W * (0.25 + r() * 0.3)
        folds += stroke(curve([x0, fy], [(x0 + x1) / 2, fy - bh * (0.06 + r() * 0.08)], [x1, fy + 2], 16), 1.2 + r() * 2.4, 0.3, 0.3, 0.05)
      }
      return s('g', null,
        s('path', { class: 'g8y-band', style: `opacity:${(0.42 + i * 0.22).toFixed(2)}`, d: `M${edge.map(([x, yy]) => `${f1(x)} ${f1(yy)}`).join('L')}L${f1(W)} ${f1(bot + bh)}L0 ${f1(bot + bh)}Z` }),
        s('path', { class: 'g8y-ink', style: `opacity:${(i * 0.16).toFixed(2)}`, d: `M${edge.map(([x, yy]) => `${f1(x)} ${f1(yy + bh * 0.3)}`).join('L')}L${f1(W)} ${f1(bot + bh)}L0 ${f1(bot + bh)}Z`, filter: 'url(#ink-wash)' }),
        s('path', { class: 'g8y-silk', d: stroke(edge, 2.6 - i * 0.4, 0.15, 0.15, 0.2) }),
        s('path', { class: 'g8y-fold', d: folds }))
    })
    // moonlight falling in, weaker with depth
    // (each shaft three overlapping veils, so its sides are soft without a filter)
    const shafts = [0.58, 0.68, 0.8].flatMap((t, i) => [0, 1, 2].map((k) => {
      const a = W * t - k * 7, b = W * t + 26 + i * 8 + k * 7, c = W * t - 70 + i * 26 + k * 16, d = W * t - 130 + i * 26 - k * 16
      return s('path', { class: 'g8y-shaft', fill: 'url(#g8y-shaft)', d: `M${f1(a)} ${f1(top)}L${f1(b)} ${f1(top)}L${f1(c)} ${f1(bot + dip)}L${f1(d)} ${f1(bot + dip)}Z` })
    }))
    // the bed: stones half sunk in silt, weed
    const bed: SVGElement[] = []
    for (let i = 0; i < 9; i++) {
      const x = W * (0.16 + (i / 8) * 0.68) + (r() - 0.5) * 30
      if (Math.abs(x - px0) < 60) continue
      const w = 22 + r() * 30
      bed.push(s('g', { transform: `translate(${f1(x)} ${f1(bedY(x) + 3 + r() * 4)})` }, stoneArt(w, w * (0.4 + r() * 0.25), 220 + i)))
    }
    // the earth the pond is cut into: a light wash, a strong brushed bank, dry strokes in the soil
    let soil = ''
    for (let i = 0; i < 26; i++) {
      const left = i % 2 === 0
      const y = top + 10 + r() * (bot - top)
      const x = left ? xl(y) - 8 - r() * W * 0.05 : xr(y) + 8 + r() * W * 0.05
      soil += stroke([[x, y], [x + (left ? -1 : 1) * (8 + r() * 18), y + 2 + r() * 5]], 1.4 + r() * 1.6, 0.2, 0.4, 0.1)
    }
    const sky = top - 4
    back.replaceChildren(
      s('defs', null,
        s('linearGradient', { id: 'g8y-shaft', x1: 0, y1: 0, x2: 0, y2: 1 },
          s('stop', { offset: 0, style: 'stop-color:var(--moon);stop-opacity:.28' }),
          s('stop', { offset: 1, style: 'stop-color:var(--moon);stop-opacity:0' })),
        s('clipPath', { id: clip }, s('path', { d: basin }))),
      mist(W * 0.5, sky - top * 0.3, W * 0.7, top * 0.8),
      moon(W * 0.84, top * 0.42, Math.min(W, H) * (wide ? 0.034 : 0.05), 7, true),
      hills(-W * 0.04, W * 1.04, sky, top * 0.42, 223, 0.88, 6),
      hills(W * 0.02, W * 0.36, sky + 1, top * 0.55, 224, 0.45, 2),
      mist(W * 0.5, sky, W * 0.6, top * 0.12),
      wash(`M0 ${f1(top)}${[...L, ...bedPts, ...[...R].reverse()].map(([x, y]) => `L${f1(x)} ${f1(y)}`).join('')}L${f1(W)} ${f1(top)}L${f1(W)} ${f1(bot + bh)}L0 ${f1(bot + bh)}Z`, 0.2),
      s('path', { class: 'g8y-soil', d: soil, filter: 'url(#ink-dry)' }),
      s('g', { 'clip-path': `url(#${clip})` }, ...bands, ...shafts),
      s('path', { class: 'g8y-bank', d: stroke(L, 4.2, 0.02, 0.3, 0.3) + stroke(R, 4.2, 0.02, 0.3, 0.3) + stroke(bedPts, 3, 0.15, 0.15, 0.3), filter: 'url(#ink-rough)' }),
      s('path', { class: 'g8y-surface', d: stroke([[xl(top) - 30, top + 1], [W * 0.3, top - 2], [W * 0.6, top + 2], [xr(top) + 30, top]], 2.2, 0.1, 0.1, 0.3), filter: 'url(#ink-rough)' }),
      reeds(xl(top) - 4, top + 2, top * 0.5, 225, 7),
      reeds(xr(top) + 6, top + 2, top * 0.38, 226, 5),
      ...bed,
      reeds(W * 0.7, bedY(W * 0.7) + 4, bh * 0.7, 227, 5),
      reeds(W * 0.22, bedY(W * 0.22) + 3, bh * 0.55, 228, 4))
    const pr = Math.min(46, W * 0.09)
    ys = [top - pr * 0.3, ...K.stages.map((_, i) => top + (i + 0.55) * bh)]
    // rings on the surface where the pebble went in
    rings.replaceChildren(...[1, 2, 3].map((k) => s('path', { class: `g8y-ring r${k}`, d: stroke(curve([px0 - pr * (0.9 + k * 0.5), top + 1], [px0, top + 3 + k * 3], [px0 + pr * (0.9 + k * 0.5), top + 1], 12), 1.6, 0.3, 0.3, 0.1) })))
    // the essay the word belongs to, a ghost page around the pebble's resting place
    const ey = ys[N], ew = Math.min(W * 0.36, 300)
    let lines = ''
    for (let k = 0; k < 6; k++) {
      const y = ey - pr * 1.1 + k * pr * 0.42
      for (let x = px0 - ew / 2; x < px0 + ew / 2 - 10; ) {
        const len = 8 + r() * 26
        if (!(Math.abs(y - ey) < pr * 0.7 && Math.abs(x + len / 2 - px0) < pr * 1.3)) lines += stroke([[x, y], [x + len, y + (r() - 0.5)]], 2, 0.2, 0.3, 0.3)
        x += len + 5 + r() * 6
      }
    }
    essay.replaceChildren(
      s('path', { class: 'g8y-page', d: blob(px0, ey + pr * 0.1, ew * 0.62, pr * 1.75, 228, 0.06), filter: 'url(#ink-wash)' }),
      s('path', { class: 'g8y-lines', d: lines, filter: 'url(#ink-rough)' }))
    pebble.replaceChildren(
      s('ellipse', { class: 'g8y-shadow', cx: f1(pr * 0.1), cy: f1(pr * 0.55), rx: f1(pr * 0.9), ry: f1(pr * 0.16) }),
      s('path', { class: 'g8y-stone', d: blob(0, 0, pr, pr * 0.6, 9, 0.07), filter: 'url(#ink-rough)' }),
      s('path', { class: 'g8y-flank', d: `M${f1(pr * 0.2)} ${f1(-pr * 0.58)}A${f1(pr)} ${f1(pr * 0.6)} 0 0 1 ${f1(pr * 0.2)} ${f1(pr * 0.58)}A${f1(pr * 0.7)} ${f1(pr * 0.6)} 0 0 0 ${f1(pr * 0.2)} ${f1(-pr * 0.58)}Z` }),
      s('path', { class: 'g8y-edge', d: stroke(curve([pr * 0.5, -pr * 0.45], [pr * 1.08, pr * 0.1], [0, pr * 0.6], 10), Math.max(2, pr * 0.06), 0.2, 0.3, 0.2), filter: 'url(#ink-rough)' }),
      s('path', { class: 'g8y-rim', d: stroke([[-pr * 0.8, -pr * 0.3], [-pr * 0.2, -pr * 0.56], [pr * 0.5, -pr * 0.42]], 2.2, 0.3, 0.4, 0.2) }),
      s('text', { class: 'g8y-word', x: 0, y: f1(pr * 0.16), 'font-size': f1(pr * 0.6), 'text-anchor': 'middle' }, K.word))
    pebble.style.setProperty('--x', `${f1(px0)}px`)
    place()
    const rx = px0 + pr * 1.7
    reads.forEach((el, i) => put(el, Math.min(rx, W - 200), ys[i + 1] - 26, Math.max(150, Math.min(W - rx - 16, 520))))
    put(ctrl, 16, H - ctrlH, W - 32)
  }

  function place() {
    pebble.style.transform = `translate(var(--x), ${f1(ys[depth] ?? 0)}px)`
    root.dataset.depth = String(depth)
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
