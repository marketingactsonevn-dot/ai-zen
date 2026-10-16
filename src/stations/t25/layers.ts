import { h, nextId, s } from '../../core/dom'
import { blob, clamp, curve, rng, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist, moon, pine, reeds, water } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import C from '../../content/tram-25.json'
import { F, cursive, f1, grad, leaf, pebble, place, rings, stage } from './kit'

const rect = (x: number, y: number, w: number, hh: number) => `M${f1(x)} ${f1(y)}h${f1(w)}v${f1(hh)}h${f1(-w)}Z`

/** The alcove the scroll hangs in (wide screens): a shaded recess, a natural-wood post, the floor board, a viewing stone, moonlight through a lattice. */
function alcove(W: number, px: number, py: number, pw: number, ph: number): SVGElement[] {
  const x0 = Math.max(8, px - pw * 0.62), x1 = Math.min(W - 8, px + pw * 1.62)
  const fy = py + ph + 22
  const r = rng(2550)
  let bark = ''
  for (let i = 0; i < 6; i++) {
    const y = r() * fy
    bark += stroke([[x0 - 3, y], [x0 + 1, y + 6 + r() * 10]], 1.4 + r(), 0.2, 0.4, 0.2)
  }
  // moonlight through a window lattice, falling on the wall right of the scroll
  const lx = px + pw * 1.16, lw = pw * 0.3, ly = py + ph * 0.12, lh = ph * 0.42, sk = lw * 0.35
  let lat = ''
  for (let i = 1; i < 3; i++) lat += `M${f1(lx + (lw * i) / 3)} ${f1(ly)}l${f1(sk)} ${f1(lh)}`
  for (let i = 1; i < 4; i++) lat += `M${f1(lx + (sk * i) / 4)} ${f1(ly + (lh * i) / 4)}h${f1(lw)}`
  const stand = px + pw + pw * 0.3
  const sw = Math.min(pw * 0.26, 90)
  return [
    s('path', { class: 't25l-recess', d: rect(x0, -20, x1 - x0, fy + 20), filter: 'url(#ink-wash)' }),
    s('g', { class: 't25l-window' },
      s('path', { class: 't25l-light', d: `M${f1(lx)} ${f1(ly)}h${f1(lw)}l${f1(sk)} ${f1(lh)}h${f1(-lw)}Z`, filter: 'url(#ink-wash)' }),
      s('path', { class: 't25l-lattice', d: lat })),
    s('path', { class: 't25l-post', d: stroke([[x0, -20], [x0 + 1.5, fy * 0.5], [x0 - 1, fy + 6]], 13, 0.01, 0.01, 0.9), filter: 'url(#ink-rough)' }),
    s('path', { class: 'zk-ink t25l-bark', d: bark, filter: 'url(#ink-dry)' }),
    s('path', { class: 't25l-floor', d: stroke([[x0 - 4, fy + 4], [W / 2, fy + 3.5], [x1 + 6, fy + 4]], 9, 0.01, 0.01, 0.9), filter: 'url(#ink-rough)' }),
    s('path', { class: 't25l-rod-hi', d: stroke([[x0 + 8, fy], [x1, fy - 0.3]], 1.2, 0.1, 0.1, 0.2) }),
    s('ellipse', { class: 't25l-stand', cx: f1(stand), cy: f1(fy - 3), rx: f1(sw * 0.55), ry: f1(sw * 0.09) }),
    s('g', { transform: `translate(${f1(stand)} ${f1(fy - 5)})` }, stoneArt(sw, sw * 0.62, 2551)),
  ]
}

/**
 * Scene 1 — a hanging scroll (kakemono): a moonlit pond cut through. The surface writes the moon's reflection in brush
 * strokes, the middle current is a silk band of ink carrying leaves, the bottom has no edge, only mist. Three white
 * pebbles wait on the bank: drop one into each layer.
 */
export function layersScene(ctx: SceneCtx) {
  const K = C.scenes.layers
  const n = K.layers.length
  const sunk: number[] = [] // sunk[k] = layer the k-th pebble went to
  const bandMid: Pt[] = []
  let drops: SVGGElement
  let wl = 0
  const clip = nextId('t25l')
  const pebbles = K.layers.map(() => s('g', { class: 't25l-pb' }))
  const labs = K.layers.map((l) => h('p', { class: 'zk-lab t25l-lab' }, l.label, h('small', null, l.sub)))
  const marks = K.layers.map(() => h('span', { class: 't25l-sunk zk-small', hidden: true }, K.sunk))
  const hits = K.layers.map((l, i) => h('button', { class: 'zk-hit t25l-hit', type: 'button', 'aria-label': l.aria, onClick: () => drop(i) }))
  const sum = h('div', { class: 'zk-note t25l-sum', hidden: true }, ctx.fact(F(K.insight)))

  const { root, svg } = stage(ctx, 't25l', K.art, K.layers.map((l) => l.insight), (W, H) => {
    const land = W / H > 1.1
    // the mounting: heaven band, painting, earth band, between a hanging rod and a roller
    const py = 16, ph = H - py - (land ? 40 : 8)
    const pw = land ? Math.min(ph * 0.62, W * 0.46, 540) : W - 24
    const px = (W - pw) / 2
    const ten = ph * (land ? 0.1 : 0.075), chi = ph * (land ? 0.075 : 0.05), side = pw * (land ? 0.07 : 0.04)
    const ix = px + side, iw = pw - side * 2, iy = py + ten, ih = ph - ten - chi
    const deep = iy + ih
    wl = iy + ih * (land ? 0.25 : 0.21)
    const b1 = wl + (deep - wl) * 0.3, b2 = wl + (deep - wl) * 0.62
    const r = rng(2501)
    const sky = wl - iy

    // the moon, and its reflection written into the surface as strokes of script that break apart as they sink
    const mr = clamp(iw * 0.055, 9, 20)
    const mx = ix + iw * 0.6, my = iy + sky * 0.4
    const gs = clamp(iw * 0.075, 12, 26)
    const script = [
      s('ellipse', { class: 'zk-moonink t25l-refl', cx: f1(mx), cy: f1(wl + gs * 0.4), rx: f1(mr * 1.15), ry: f1(gs * 0.2) }),
      s('path', { class: 't25l-script', d: cursive(mx, wl + gs * 0.85, b1 - wl - gs * 1.3, gs * 1.1, 2511, gs * 0.2, 1), fill: grad(svg, [[0, '--moon', 1], [0.55, '--moon', 0.6], [1, '--moon', 0.12]]), filter: 'url(#ink-rough)' }),
    ]

    // the current: a silk band of faint ink running across, threads in it, leaves riding it
    const cy = (b1 + b2) / 2, cb = b2 - b1
    const flow = (dy: number, ph0: number, amp = cb * 0.16): Pt[] => Array.from({ length: 33 }, (_, i) => {
      const x = ix - 12 + ((iw + 24) * i) / 32
      return [x, cy + dy + Math.sin((i / 32) * Math.PI * 2.2 + ph0) * amp + Math.sin(i * 0.9 + ph0) * cb * 0.015]
    })
    const mid = flow(0, 0.4)
    let threads = ''
    for (const [o, p] of [[-0.2, 0.2], [-0.08, 0.5], [0.06, 0.3], [0.19, 0.65]]) threads += stroke(flow(o * cb, 0.4 + p * 0.3), 0.8 + r() * 0.8, 0.15, 0.2, 0.1)
    const leaves = [0.22, 0.53, 0.82].map((t, i) => {
      const k = Math.round(t * 32), [x, y] = mid[k], [x2, y2] = mid[k + 1]
      const lf = leaf(x, y - cb * 0.04, clamp(iw * 0.075, 12, 26) * (i === 1 ? 1.15 : 1), Math.atan2(y2 - y, x2 - x) + (r() - 0.5) * 0.7, 2520 + i)
      return [s('path', { class: `zk-leaf${i === 2 ? ' red' : ''}`, d: lf.blade, filter: 'url(#ink-rough)' }), s('path', { class: 'zk-rib', d: lf.rib })]
    }).flat()

    // the depth: weed shadows rising out of nothing, then mist; no line anywhere
    let weeds = ''
    for (let i = 0; i < 6; i++) {
      const x = ix + iw * (0.08 + i * 0.16 + (r() - 0.5) * 0.06), hh = (deep - b2) * (0.7 + r() * 0.5)
      weeds += stroke(curve([x, deep + 4], [x + (r() - 0.5) * 30, deep - hh * 0.55], [x + (r() - 0.5) * 24, deep - hh], 10), 2 + r() * 2.4, 0.05, 0.6, 0.1)
    }

    // the bank on the right: earth above the surface, its slope going down under the water
    const bx0 = ix + iw * 0.64
    const bankTop: Pt[] = [[bx0, wl + 1], [ix + iw * 0.7, wl - 6], [ix + iw * 0.84, wl - 13], [ix + iw + 4, wl - 16]]
    const topAt = (x: number) => {
      for (let i = 1; i < bankTop.length; i++) if (x <= bankTop[i][0]) {
        const [x0, y0] = bankTop[i - 1], [x1, y1] = bankTop[i]
        return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
      }
      return bankTop[bankTop.length - 1][1]
    }
    const earth = `M${bankTop.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}L${f1(ix + iw + 4)} ${f1(wl + 6)}Q${f1(ix + iw * 0.8)} ${f1(wl + 7)} ${f1(bx0)} ${f1(wl + 1)}Z`
    let slope = '' // the bank going down under the water: a few dry strokes, fading
    for (let i = 0; i < 5; i++) {
      const x = ix + iw * (0.74 + i * 0.065), y = wl + 4 + r() * 3
      slope += stroke([[x, y], [x + iw * 0.04, y + (b1 - wl) * (0.22 + r() * 0.2)]], 1.6 + r() * 1.6, 0.05, 0.7, 0.1)
    }
    const pr = clamp(iw * 0.032, 7, 12)
    const home: Pt[] = K.layers.map((_, k) => {
      const x = ix + iw * (0.76 + k * 0.075)
      return [x, topAt(x) + pr * 0.35]
    })

    // the mounting's own pieces
    const fw = pw * 0.045
    const futai = [0.3, 0.7].map((t) => rect(px + pw * t - fw / 2, py, fw, ten * 0.9)).join('')
    const ig = clamp(iw * 0.045, 9, 15)
    const inscr = cursive(ix + iw * 0.9, iy + 10, Math.min(ig * 4, sky * 0.48), ig, 2540, ig * 0.17)
    const sealW = clamp(iw * 0.026, 6, 10), sealX = ix + iw * 0.9 - sealW / 2, sealY = iy + 14 + Math.min(ig * 4, sky * 0.48)

    svg.replaceChildren(
      s('defs', null, s('clipPath', { id: clip }, s('rect', { x: ix, y: iy, width: iw, height: ih }))),
      ...(land ? alcove(W, px, py, pw, ph) : []),
      s('path', { class: 't25l-shadow', d: rect(px + 6, py + 10, pw, ph), filter: 'url(#ink-wash)' }),
      s('path', { class: 'zk-cord', d: `M${f1(px + pw * 0.26)} ${f1(py)}L${f1(px + pw / 2)} ${f1(py - 13)}L${f1(px + pw * 0.74)} ${f1(py)}` }),
      s('path', { class: 't25l-mount', d: rect(px, py, pw, ph), filter: 'url(#ink-rough)' }),
      s('path', { d: rect(px, py, pw, ph), fill: grad(svg, [[0, '--moon', 0.16], [0.5, '--moon', 0.03], [1, '--moon', 0]], 'h') }),
      s('path', { class: 't25l-futai', d: futai }),
      s('path', { class: 't25l-ichi', d: rect(ix, iy - ih * 0.022, iw, ih * 0.022) + rect(ix, deep, iw, ih * 0.016) }),
      s('g', { 'clip-path': `url(#${clip})` },
        s('rect', { class: 't25l-silk', x: ix, y: iy, width: iw, height: ih }),
        s('rect', { x: ix, y: iy, width: iw, height: sky, fill: grad(svg, [[0, '--wash', 0.16], [1, '--wash', 0]]) }),
        mist(mx, my, iw * 0.5, sky * 0.45),
        moon(mx, my, mr, 2502, true),
        hills(ix - 20, ix + iw * 0.7, wl, sky * 0.42, 2503, 0.88, 4),
        hills(ix - 10, ix + iw * 0.36, wl, sky * 0.3, 2504, 0.55, 2),
        pine(ix + iw * 0.1, wl + 2, sky * 0.78, 2505, 1),
        mist(ix + iw * 0.45, wl - 2, iw * 0.55, sky * 0.12),
        s('rect', { x: ix, y: wl, width: iw, height: deep - wl, fill: grad(svg, [[0, '--water', 0.62], [0.3, '--water', 0.72], [0.62, '--water', 0.42], [0.88, '--water', 0.08], [1, '--water', 0]]) }),
        water(ix, wl, ix + iw, b1 - 4, 2506, mx, false),
        ...script,
        s('path', { class: 't25l-band', d: stroke(mid, cb * 0.62, 0.1, 0.1, 0.3), filter: 'url(#ink-wash)' }),
        s('path', { class: 't25l-thread', d: threads }),
        ...leaves,
        s('path', { class: 't25l-weed', d: weeds, filter: 'url(#ink-wash)' }),
        mist(ix + iw * 0.3, b2 + (deep - b2) * 0.45, iw * 0.55, (deep - b2) * 0.32),
        mist(ix + iw * 0.78, b2 + (deep - b2) * 0.7, iw * 0.45, (deep - b2) * 0.3),
        mist(ix + iw * 0.5, deep, iw * 0.8, (deep - b2) * 0.45),
        s('path', { class: 't25l-earth', d: earth, filter: 'url(#ink-wash)' }),
        s('path', { class: 't25l-slope', d: slope, filter: 'url(#ink-dry)' }),
        s('path', { class: 'zk-ink t25l-surface', d: stroke([[ix - 4, wl], [ix + iw * 0.3, wl + 0.6], [bx0 - 6, wl]], 1.6, 0.05, 0.3, 0.2) + stroke(bankTop, 2.6, 0.2, 0.05, 0.4), filter: 'url(#ink-rough)' }),
        reeds(bx0 + 6, wl + 2, sky * 0.42, 2507, 6),
        grass(ix + iw * 0.95, wl - 11, 18, 2508),
        s('path', { class: 'zk-ink t25l-inscr', d: inscr, filter: 'url(#ink-rough)' }),
        s('path', { class: 't25l-seal', d: blob(sealX + sealW / 2, sealY + sealW / 2, sealW / 2, sealW / 2, 2509, 0.08, 8), filter: 'url(#ink-rough)' })),
      s('path', { class: 't25l-hair', d: rect(ix, iy, iw, ih) }),
      s('path', { class: 't25l-rod', d: stroke([[px - 5, py], [px + pw + 5, py]], 6, 0.02, 0.02, 0.8), filter: 'url(#ink-rough)' }),
      s('path', { class: 't25l-rod', d: stroke([[px - 10, py + ph], [px + pw + 10, py + ph]], 10, 0.02, 0.02, 0.85), filter: 'url(#ink-rough)' }),
      s('path', { class: 't25l-knob', d: blob(px - 12, py + ph, 5.5, 6.5, 1, 0.05, 10) + blob(px + pw + 12, py + ph, 5.5, 6.5, 2, 0.05, 10) }),
      s('path', { class: 't25l-rod-hi', d: stroke([[px - 2, py + ph - 2.6], [px + pw + 2, py + ph - 2.6]], 1.2, 0.2, 0.2, 0.2) + stroke([[px, py - 1.6], [px + pw, py - 1.6]], 1, 0.2, 0.2, 0.2) }),
      drops = s('g'),
      ...pebbles)
    pebbles.forEach((g, k) => {
      g.replaceChildren(...pebble(pr, 2530 + k))
      g.style.transform = `translate(${f1(home[k][0])}px, ${f1(home[k][1])}px)`
    })
    const tops = [wl, b1, b2, deep]
    const labW = Math.min(iw * 0.5, 230)
    K.layers.forEach((_, i) => {
      const y0 = tops[i], y1 = tops[i + 1]
      bandMid[i] = [ix + iw * (0.5 + i * 0.1), (y0 + y1) / 2 + (i === 2 ? -(y1 - y0) * 0.18 : 0)]
      place(hits[i], ix, y0, iw)
      hits[i].style.height = `${f1(y1 - y0)}px`
      place(labs[i], ix + 10, y0 + (i ? 10 : 12), labW)
    })
    sunk.forEach((li, k) => {
      pebbles[k].style.transform = `translate(${f1(bandMid[li][0] + k * 4)}px, ${f1(bandMid[li][1])}px)`
    })
    place(sum, ix + 10, b2 + (deep - b2) * (land ? 0.38 : 0.46), iw - 20)
  })
  root.append(...hits, ...labs, sum)
  labs.forEach((l, i) => l.append(marks[i]))
  ctx.prompt(K.prompt)

  function drop(i: number) {
    const layer = K.layers[i]
    if (!sunk.includes(i)) {
      const k = sunk.length
      sunk.push(i)
      const [x, y] = bandMid[i]
      pebbles[k].classList.add('in')
      pebbles[k].style.transform = `translate(${f1(x + k * 4)}px, ${f1(y)}px)`
      drops.append(rings(x, wl, 10, 3, 3, 'zk-ring t25l-splash'))
      marks[i].hidden = false
      ctx.chime('tap')
    }
    ctx.insight(F(layer.insight), F(layer.detail))
    if (sunk.length === n) sum.hidden = false
  }
}
