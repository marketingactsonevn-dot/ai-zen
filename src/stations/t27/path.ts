import { s } from '../../core/dom'
import { blob, clamp, rng, stroke } from '../../ui/part2/ink'
import type { PathGeo } from '../../ui/part2/steps'
import { grass, hills, mist, moon, pine } from '../../ui/part2/paint'
import { f1 } from '../t25/kit'

const rect = (x: number, y: number, w: number, hh: number) => `M${f1(x)} ${f1(y)}h${f1(w)}v${f1(hh)}h${f1(-w)}Z`

/** A small thatched hut standing on (x, y), `hh` tall, its window lit cold blue by a screen, someone hunched before it. */
function hut(x: number, y: number, hh: number, seed: number): SVGElement[] {
  const r = rng(seed)
  const w = hh * 1.15, wall = hh * 0.48
  let thatch = ''
  for (let i = 0; i < 16; i++) {
    const t = i / 15, xx = x - w * 0.62 + w * 1.24 * t
    thatch += stroke([[x + (xx - x) * 0.2, y - hh + r() * 3], [xx + (r() - 0.5) * 4, y - wall - hh * 0.04 + r() * 4]], 1.4 + r() * 1.4, 0.1, 0.4, 0.2)
  }
  const roof = `M${f1(x - w * 0.66)} ${f1(y - wall)}L${f1(x - w * 0.12)} ${f1(y - hh)}L${f1(x + w * 0.12)} ${f1(y - hh)}L${f1(x + w * 0.66)} ${f1(y - wall)}Z`
  const win: [number, number, number, number] = [x + w * 0.04, y - wall * 0.82, w * 0.32, wall * 0.5]
  return [
    s('ellipse', { class: 't27p-blue', cx: f1(x + w * 0.4), cy: f1(y + 2), rx: f1(w * 0.75), ry: f1(hh * 0.16), fill: 'url(#t27p-screen-glow)' }),
    s('path', { class: 't27p-wall', d: rect(x - w * 0.46, y - wall, w * 0.92, wall), filter: 'url(#ink-rough)' }),
    s('path', { class: 't27p-screen', d: rect(...win) }),
    s('path', { class: 't27p-figure', d: blob(win[0] + win[2] * 0.42, win[1] + win[3] * 0.42, win[2] * 0.12, win[3] * 0.18, seed, 0.1, 8) + `M${f1(win[0] + win[2] * 0.18)} ${f1(win[1] + win[3])}Q${f1(win[0] + win[2] * 0.42)} ${f1(win[1] + win[3] * 0.38)} ${f1(win[0] + win[2] * 0.66)} ${f1(win[1] + win[3])}Z` }),
    s('path', { class: 'zk-ink t27p-ink', d: stroke([[win[0], win[1]], [win[0] + win[2], win[1]]], 1.4, 0.1, 0.1, 0.3) + stroke([[win[0] + win[2] * 0.5, win[1]], [win[0] + win[2] * 0.5, win[1] + win[3]]], 1, 0.1, 0.1, 0.3) + stroke([[x - w * 0.46, y], [x + w * 0.46, y + 1]], 2, 0.1, 0.1, 0.4) + stroke([[x - w * 0.36, y - wall * 0.7], [x - w * 0.36, y]], 1.6, 0.1, 0.1, 0.3) + stroke([[x - w * 0.16, y - wall * 0.7], [x - w * 0.16, y]], 1.6, 0.1, 0.1, 0.3), filter: 'url(#ink-rough)' }),
    s('path', { class: 't27p-roof', d: roof, filter: 'url(#ink-wash)' }),
    s('path', { class: 'zk-ink t27p-thatch', d: thatch }),
    s('path', { class: 'zk-ink t27p-ink', d: stroke([[x - w * 0.7, y - wall + 1], [x, y - wall - 2], [x + w * 0.7, y - wall + 1]], 2.6, 0.05, 0.05, 0.4), filter: 'url(#ink-rough)' }),
  ]
}

/** A house standing on (x, y), `hh` tall: a sweeping roof, a veranda, paper doors lit warm with people seated round a tray. */
function house(x: number, y: number, hh: number, seed: number): SVGElement[] {
  const r = rng(seed)
  const w = hh * 1.7, wall = hh * 0.5, eave = y - wall - hh * 0.04
  const roof = `M${f1(x - w * 0.62)} ${f1(eave + hh * 0.05)}Q${f1(x - w * 0.4)} ${f1(eave)} ${f1(x - w * 0.3)} ${f1(y - hh * 0.92)}L${f1(x + w * 0.3)} ${f1(y - hh * 0.92)}Q${f1(x + w * 0.4)} ${f1(eave)} ${f1(x + w * 0.62)} ${f1(eave + hh * 0.05)}Z`
  const dx0 = x - w * 0.42, dw = w * 0.84, dy0 = y - wall * 0.92, dh = wall * 0.8
  let lattice = ''
  for (let i = 1; i < 4; i++) lattice += `M${f1(dx0 + (dw * i) / 4)} ${f1(dy0)}v${f1(dh)}`
  for (let i = 0; i < 12; i++) {
    if (i % 4 === 0) continue
    lattice += `M${f1(dx0 + (dw * i) / 12)} ${f1(dy0)}v${f1(dh)}`
  }
  for (let j = 1; j < 4; j++) lattice += `M${f1(dx0)} ${f1(dy0 + (dh * j) / 4)}h${f1(dw)}`
  // shadows on the paper: three people sitting round a low tray
  const fig = (fx: number, k: number) => blob(fx, dy0 + dh * 0.42, dh * 0.1 * k, dh * 0.12 * k, seed + Math.round(fx), 0.08, 8) +
    `M${f1(fx - dh * 0.2 * k)} ${f1(dy0 + dh * 0.84)}Q${f1(fx)} ${f1(dy0 + dh * 0.36)} ${f1(fx + dh * 0.2 * k)} ${f1(dy0 + dh * 0.84)}Z`
  const people = fig(dx0 + dw * 0.26, 1) + fig(dx0 + dw * 0.52, 0.92) + fig(dx0 + dw * 0.76, 1.04) +
    `M${f1(dx0 + dw * 0.32)} ${f1(dy0 + dh * 0.8)}h${f1(dw * 0.38)}v${f1(dh * 0.06)}h${f1(-dw * 0.38)}Z`
  let tiles = ''
  for (let i = 0; i < 14; i++) {
    const t = i / 13, xx = x - w * 0.28 + w * 0.56 * t
    tiles += stroke([[xx, y - hh * 0.9], [xx + (xx - x) * 0.4, eave + 2 + r() * 2]], 1.2, 0.2, 0.3, 0.3)
  }
  return [
    s('ellipse', { class: 't27p-warm', cx: f1(x), cy: f1(y + hh * 0.08), rx: f1(w * 0.7), ry: f1(hh * 0.2), fill: 'url(#p2-lamp)' }),
    s('path', { class: 't27p-wall', d: rect(x - w * 0.46, y - wall, w * 0.92, wall), filter: 'url(#ink-rough)' }),
    s('path', { class: 't27p-shoji', d: rect(dx0, dy0, dw, dh) }),
    s('path', { class: 't27p-people', d: people, filter: 'url(#ink-wash)' }),
    s('path', { class: 't27p-lattice', d: lattice }),
    s('path', { class: 't27p-roof t27p-roof-tile', d: roof, filter: 'url(#ink-rough)' }),
    s('path', { class: 'zk-ink t27p-tiles', d: tiles }),
    s('path', { class: 'zk-ink t27p-ink', d: stroke([[x - w * 0.62, eave + hh * 0.05], [x - w * 0.4, eave - 1], [x, eave - 2], [x + w * 0.4, eave - 1], [x + w * 0.62, eave + hh * 0.05]], 3, 0.05, 0.05, 0.4) + stroke([[x - w * 0.52, y + 1], [x + w * 0.52, y + 2]], 3.4, 0.05, 0.05, 0.5) + stroke([[x - w * 0.46, y - wall], [x - w * 0.46, y]], 2, 0.1, 0.1, 0.4) + stroke([[x + w * 0.46, y - wall], [x + w * 0.46, y]], 2, 0.1, 0.1, 0.4), filter: 'url(#ink-rough)' }),
  ]
}

/** Path art for "Đi ra khỏi màn hình": from a hut lit by a screen, across the moon garden, to a house where people sit together. */
export function pathArt(g: PathGeo): SVGElement[] {
  const { w, h, row, first, last, top, pathY, seed } = g
  const defs = s('defs', null, s('radialGradient', { id: 't27p-screen-glow' },
    s('stop', { offset: 0, style: 'stop-color:var(--t27-screen);stop-opacity:.55' }),
    s('stop', { offset: 1, style: 'stop-color:var(--t27-screen);stop-opacity:0' })))
  if (row) {
    const skyH = pathY - top
    const hh = clamp(skyH * 0.62, 50, 130)
    const mr = clamp(skyH * 0.1, 10, 22)
    return [
      defs,
      mist(w * 0.5, top + skyH * 0.55, w * 0.6, skyH * 0.5),
      moon(w * 0.5, top + Math.max(mr * 1.8, skyH * 0.22), mr, seed, true),
      hills(-w * 0.04, w * 1.04, pathY - 20, skyH * 0.45, seed + 1, 0.9, 6),
      mist(w * 0.5, pathY - 16, w * 0.6, skyH * 0.12),
      pine(last[0] - hh * 1.9, pathY + 4, hh * 1.25, seed + 2, -1),
      ...hut(Math.max(hh * 0.7, first[0] - hh * 0.62), first[1] + 4, hh * 0.85, seed + 3),
      ...house(Math.min(w - hh * 1.5, last[0] + hh * 1.0), last[1] + 6, hh, seed + 4),
      grass(first[0] + 8, first[1] + 8, 24, seed + 5),
      grass(last[0] - 10, last[1] + 8, 22, seed + 6),
    ]
  }
  // a column (phone): the screen's cold light at the head of the path, the lit house below its end
  const hh = clamp((h - last[1]) * 0.55, 44, 110)
  return [
    defs,
    s('ellipse', { class: 't27p-blue', cx: f1(first[0]), cy: f1(first[1] + 30), rx: f1(w * 0.3), ry: 42, fill: 'url(#t27p-screen-glow)' }),
    mist(w * 0.5, last[1] + hh * 0.4, w * 0.7, hh * 0.5),
    hills(-w * 0.05, w * 1.05, last[1] + hh * 1.05, hh * 0.5, seed + 1, 0.9, 4),
    ...house(w * 0.5, last[1] + hh * 1.15, hh, seed + 4),
  ]
}
