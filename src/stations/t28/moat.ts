import { fill, h, nextId, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { blob, curve, rng, stroke, type Pt } from '../../ui/part2/ink'
import { grass, mist, pine, reeds, wash, water } from '../../ui/part2/paint'
import { C } from './data'
import { f1, frame } from './frame'
import { figure, nightSky, P } from './brush'

const G = C.scenes.moat
const ANG = [196, 338, 72] // where each boat waits on the moat (degrees, 0 = east, y down)

/** A curved castle roof centred on xc with its eave line at y: upturned tips, a concave slope up to the ridge. */
function roof(xc: number, y: number, hw: number, rh: number) {
  return `M${P([xc - hw * 1.3, y - rh * 0.22])}Q${P([xc - hw * 1.08, y + rh * 0.14])} ${P([xc - hw * 0.86, y + rh * 0.08])}L${P([xc + hw * 0.86, y + rh * 0.08])}Q${P([xc + hw * 1.08, y + rh * 0.14])} ${P([xc + hw * 1.3, y - rh * 0.22])}Q${P([xc + hw * 0.78, y - rh * 0.22])} ${P([xc + hw * 0.5, y - rh])}L${P([xc - hw * 0.5, y - rh])}Q${P([xc - hw * 0.78, y - rh * 0.22])} ${P([xc - hw * 1.3, y - rh * 0.22])}Z`
}

/** The keep: a battered stone base in courses, three plastered tiers under curved ink roofs, a few lit windows. */
function castle(cx: number, by: number, bw: number, seed: number): SVGElement[] {
  const r = rng(seed)
  const hb = bw * 0.26
  const b0 = bw / 2, b1 = bw * 0.39
  const base = `M${P([cx - b0, by])}Q${P([cx - b1 - bw * 0.01, by - hb * 0.3])} ${P([cx - b1, by - hb])}L${P([cx + b1, by - hb])}Q${P([cx + b1 + bw * 0.01, by - hb * 0.3])} ${P([cx + b0, by])}Z`
  let courses = ''
  for (let k = 1; k < 5; k++) {
    const y = by - (hb * k) / 5
    const half = b0 - (b0 - b1) * Math.pow(k / 5, 0.6)
    for (let x = cx - half + 2; x < cx + half - 6; ) {
      const len = bw * (0.05 + r() * 0.09)
      courses += stroke([[x, y + (r() - 0.5)], [Math.min(x + len, cx + half - 2), y + (r() - 0.5)]], Math.max(0.8, bw * 0.008), 0.2, 0.2, 0.3)
      x += len + bw * 0.015
    }
  }
  const tiers: [number, number, number][] = [] // [half width, wall height, roof height]
  let hw = bw * 0.35
  for (let i = 0; i < 3; i++) {
    tiers.push([hw, bw * (0.17 - i * 0.02), bw * (0.11 - i * 0.012)])
    hw *= 0.7
  }
  let walls = '', roofs = '', lit = '', dark = '', rims = ''
  let y = by - hb
  tiers.forEach(([w2, wh, rh], i) => {
    walls += `M${P([cx - w2, y])}L${P([cx + w2, y])}L${P([cx + w2 * 0.97, y - wh])}L${P([cx - w2 * 0.97, y - wh])}Z`
    const nWin = 4 - i
    for (let k = 0; k < nWin; k++) {
      const x = cx - w2 * 0.7 + (w2 * 1.4 * (k + 0.5)) / nWin
      const ww = Math.max(2, bw * 0.03), wy = y - wh * 0.62
      const d = `M${f1(x - ww / 2)} ${f1(wy)}h${f1(ww)}v${f1(wh * 0.3)}h${f1(-ww)}Z`
      if (r() < 0.55) lit += d
      else dark += d
    }
    y -= wh
    roofs += roof(cx, y, w2, rh)
    rims += stroke(curve([cx - w2 * 1.28, y - rh * 0.24], [cx - w2 * 0.9, y - rh * 0.18], [cx - w2 * 0.52, y - rh * 0.95], 8), Math.max(1, bw * 0.01), 0.2, 0.4, 0.2)
    y -= rh * 0.82
  })
  // the ridge ornaments on the top roof
  const top = y + tiers[2][2] * 0.82 - tiers[2][2]
  const fin = (sx: number) => stroke(curve([cx + sx * tiers[2][0] * 0.48, top], [cx + sx * tiers[2][0] * 0.62, top - bw * 0.05], [cx + sx * tiers[2][0] * 0.4, top - bw * 0.06], 6), Math.max(1.4, bw * 0.016), 0.1, 0.5, 0.3)
  return [
    s('circle', { cx: f1(cx), cy: f1(by - hb - bw * 0.2), r: f1(bw * 0.55), fill: 'url(#p2-lamp)', class: 't28m-glow-keep' }),
    s('path', { class: 'gb-stone', d: base, filter: 'url(#ink-rough)' }),
    s('path', { class: 'gb-stone-sh', d: base }),
    s('path', { class: 't28m-course', d: courses }),
    s('path', { class: 'gb-plaster', d: walls, filter: 'url(#ink-rough)' }),
    s('path', { class: 'gb-stone-sh', d: walls }),
    s('path', { class: 't28m-win', d: dark }),
    s('path', { class: 'gf-lantern', d: lit }),
    s('path', { class: 't28m-roof', d: roofs + fin(-1) + fin(1), filter: 'url(#ink-rough)' }),
    s('path', { class: 'gb-rim-hi', d: rims }),
  ]
}

/** A sampan with a rower at the stern and its own paper lantern on a pole at the bow; ripples behind it. */
function boatArt(seed: number): SVGSVGElement {
  const r = rng(seed)
  let wake = ''
  for (let i = 0; i < 4; i++) {
    const y = 9 + i * 3.2, x = -36 + r() * 10
    wake += stroke([[x, y], [x + 18 + r() * 16, y + 0.4]], 1.2 + i * 0.2, 0.3, 0.3, 0.1)
  }
  return s('svg', { viewBox: '-42 -46 84 62', 'aria-hidden': 'true' },
    s('circle', { class: 't28m-glow', cx: 26, cy: -26, r: 20, fill: 'url(#p2-lamp)' }),
    s('path', { class: 't28m-wake', d: wake }),
    s('path', { class: 'gb-figure', d: figure(-17, 0, 25, seed, 1, { hat: 'cone', stoop: 0.3 }) }),
    s('path', { class: 'gb-figure', d: stroke([[-10, -14], [-22, -2], [-33, 10]], 1.8, 0.1, 0.1, 0.5) }),
    s('path', { class: 't28m-hull', d: 'M-36 -3Q-6 7 30 -8Q33 -9 34 -7L29 2Q0 13 -31 5Z' }),
    s('path', { class: 'gb-rim-hi', d: stroke([[-34, -3], [-6, 5], [30, -7]], 1.3, 0.2, 0.3, 0.1) }),
    s('path', { class: 'gb-figure', d: stroke(curve([22, -2], [21, -30], [28, -34], 8), 1.6, 0.05, 0.2, 0.4) }),
    s('path', { class: 'gb-rope', d: 'M28 -34V-30' }),
    s('ellipse', { class: 't28m-lamp', cx: 28, cy: -24.5, rx: 4.6, ry: 5.8 }),
    s('path', { class: 'gb-figure', d: 'M25.2 -30.6h5.6v1.3h-5.6zM25.2 -19.6h5.6v1.3h-5.6z' }))
}

/** A stone castle on an island, a black moat of moonlight, countless bamboo bridges (CUDA) — and three lantern boats rowing in. */
export function moatScene(ctx: SceneCtx) {
  const cid = nextId('t28m')
  const card = h('div', { class: 't28m-read' }, h('p', { class: 'p2-question' }, G.group))
  const panel = h('div', { class: 'gf-panel t28m-panel', 'aria-live': 'polite' }, card)
  const { root, over, svg } = frame(ctx, 't28m', [G.insight as Fact], panel, draw)
  ctx.prompt(G.prompt)
  const seen = new Set<number>()
  const boats = G.boats.map((b, i) =>
    h('button', { class: 'gf-hit t28m-boat', type: 'button', 'aria-pressed': 'false', 'aria-label': fill(G.boatAria, { name: b.name }), onClick: () => pick(i) },
      boatArt(2830 + i), h('span', { class: 'gf-tagline' }, b.name)))
  over.append(...boats)

  function pick(i: number) {
    boats.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)))
    boats[i].classList.add('near')
    seen.add(i)
    const b = G.boats[i]
    card.replaceChildren(h('p', { class: 'gf-who' }, b.name), ctx.fact(b.fact as Fact, 'p', 'gf-new'))
    if (seen.size === G.boats.length && !root.classList.contains('all')) {
      root.classList.add('all')
      ctx.insight(G.insight as Fact, G.detail as Fact)
      ctx.chime('ok')
    } else ctx.chime('soft')
  }

  function draw(w: number, hh: number) {
    const r = rng(2820)
    const cx = w / 2, cy = hh * 0.56
    const RX = Math.min(w * 0.47, hh * 0.92), RY = Math.min(RX * 0.46, hh * 0.38)
    const ix = RX * 0.6, iy = RY * 0.58
    const at = (a: number, k: number): Pt => [cx + Math.cos(a) * RX * k, cy + Math.sin(a) * RY * k]
    const isle = (a: number): Pt => [cx + Math.cos(a) * ix, cy + Math.sin(a) * iy]
    const moat = blob(cx, cy, RX, RY, 2821, 0.03, 28)
    // bamboo bridges across the moat: the code everyone already walks on — the far ones before the island, the near after
    const bridge = (a: number) => {
      const p = at(a, 0.99), q = isle(a)
      const len = Math.hypot(q[0] - p[0], q[1] - p[1])
      const arch = 2 + len * 0.1
      const c: Pt = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2 - arch]
      const deck = curve(p, c, q, 10)
      const wgt = Math.max(1.8, RX * 0.008)
      let d = stroke(deck, wgt, 0.05, 0.05, 0.6)
      let slats = ''
      for (let i = 1; i < 10; i += 2) {
        const [x, y] = deck[i]
        slats += `M${f1(x)} ${f1(y - wgt * 0.9)}v${f1(wgt * 1.8)}`
      }
      d += stroke(deck.map(([x, y]) => [x, y - wgt * 2.4] as Pt).slice(1, -1), wgt * 0.45, 0.1, 0.1, 0.5)
      return { d, slats }
    }
    let farB = '', nearB = '', farS = '', nearS = ''
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + 0.07 + (r() - 0.5) * 0.05
      const b = bridge(a)
      if (Math.sin(a) < 0.05) { farB += b.d; farS += b.slats } else { nearB += b.d; nearS += b.slats }
    }
    // the island: a moss-topped rock with a cliff face down to the water
    const topY = cy - iy * 0.12
    const islandTop = blob(cx, topY, ix * 1.02, iy * 0.92, 2822, 0.09, 22)
    const cliff = `M${P([cx - ix * 1.02, topY])}Q${P([cx - ix * 0.98, topY + iy * 0.9])} ${P([cx - ix * 0.4, topY + iy * 1.12])}Q${P([cx, topY + iy * 1.22])} ${P([cx + ix * 0.5, topY + iy * 1.1])}Q${P([cx + ix * 1.0, topY + iy * 0.85])} ${P([cx + ix * 1.03, topY])}Z`
    let cun = ''
    for (let i = 0; i < 14; i++) {
      const x = cx - ix * 0.9 + (ix * 1.8 * i) / 13 + (r() - 0.5) * 6
      const y0 = topY + iy * (0.5 + r() * 0.25) * Math.sqrt(1 - Math.min(0.95, ((x - cx) / ix) ** 2))
      cun += stroke([[x, y0], [x + (r() - 0.5) * 4, y0 + iy * (0.2 + r() * 0.25)]], 1 + r() * 1.4, 0.1, 0.5, 0.1)
    }
    let topCun = ''
    for (let i = 0; i < 16; i++) {
      const a = r() * Math.PI * 2, d = 0.3 + r() * 0.6
      const x = cx + Math.cos(a) * ix * d, y = topY + Math.sin(a) * iy * 0.8 * d
      topCun += stroke([[x, y], [x + ix * (0.08 + r() * 0.12), y + (r() - 0.5) * 2]], 1.2 + r() * 1.6, 0.2, 0.4, 0.1)
    }
    const bw = ix * 1.02
    const mr = Math.max(12, Math.min(RX * 0.075, 28))
    const moonX = cx + RX * 0.66
    svg.replaceChildren(
      s('defs', null, s('clipPath', { id: `${cid}-w` }, s('path', { d: moat }))),
      ...nightSky(w, cy - RY * 0.86, 2823, [moonX, Math.max(mr * 1.8, cy - RY * 1.55), mr], Math.min(hh * 0.24, cy - RY * 0.86 - mr * 2), true),
      // the garden around the moat
      wash(blob(cx, cy + RY * 0.06, RX * 1.12, RY * 1.16, 2824, 0.04, 28), 0.12),
      s('path', { class: 't28m-water', d: moat, filter: 'url(#ink-wash)' }),
      s('g', { 'clip-path': `url(#${cid}-w)` },
        water(cx - RX, cy - RY, cx + RX, cy + RY, 2825, moonX - RX * 0.2, false)),
      s('path', { class: 't28m-bank', d: stroke(curve(at(3.35, 1.01), at(4.71, 1.12), at(6.07, 1.01), 24), Math.max(1.6, RX * 0.008), 0.2, 0.2, 0.2), filter: 'url(#ink-rough)' }),
      s('path', { class: 't28m-bank', d: stroke(curve(at(0.2, 1.02), at(1.57, 1.1), at(2.94, 1.02), 24), Math.max(2.2, RX * 0.012), 0.15, 0.15, 0.25), filter: 'url(#ink-rough)' }),
      s('path', { class: 't28m-bridge', d: farB, filter: 'url(#ink-rough)' }),
      s('path', { class: 't28m-slat', d: farS }),
      s('path', { class: 'gb-stone', d: cliff, filter: 'url(#ink-rough)' }),
      s('path', { class: 'gb-stone-sh', d: cliff }),
      s('path', { class: 't28m-cun', d: cun, filter: 'url(#ink-dry)' }),
      s('path', { class: 'gb-stone t28m-isle', d: islandTop, filter: 'url(#ink-rough)' }),
      wash(blob(cx - ix * 0.45, topY + iy * 0.2, ix * 0.38, iy * 0.3, 2832, 0.25), 0.5, 'p2p-wash t28m-moss'),
      wash(blob(cx + ix * 0.55, topY + iy * 0.35, ix * 0.3, iy * 0.22, 2833, 0.25), 0.5, 'p2p-wash t28m-moss'),
      s('path', { class: 't28m-cun', d: topCun, filter: 'url(#ink-dry)' }),
      s('path', { class: 't28m-edge', d: stroke(curve([cx - ix * 1.0, topY + iy * 0.1], [cx, topY + iy * 1.25], [cx + ix * 1.0, topY + iy * 0.12], 18), Math.max(1.6, ix * 0.016), 0.2, 0.2, 0.2), filter: 'url(#ink-rough)' }),
      s('path', { class: 't28m-bridge', d: nearB, filter: 'url(#ink-rough)' }),
      s('path', { class: 't28m-slat', d: nearS }),
      pine(cx - ix * 0.78, topY + iy * 0.2, Math.min(iy * 1.6, bw * 0.55), 2826, -1),
      ...castle(cx + ix * 0.05, topY + iy * 0.38, bw, 2827),
      pine(cx + ix * 0.82, topY + iy * 0.3, Math.min(iy * 1.3, bw * 0.45), 2828, 1),
      grass(cx - ix * 0.3, topY + iy * 0.75, Math.max(10, ix * 0.12), 2829),
      reeds(cx - RX * 1.0, cy + RY * 0.3, Math.max(16, RY * 0.3), 2830, 6),
      reeds(cx + RX * 0.98, cy - RY * 0.1, Math.max(14, RY * 0.24), 2831, 5),
      mist(cx, cy + RY * 0.9, RX * 0.8, RY * 0.12),
      s('text', { class: 'gf-caption', x: f1(cx), y: f1(topY + iy * 1.0), 'text-anchor': 'middle' }, G.castle),
      s('text', { class: 'gf-caption t28m-cuda', x: f1(Math.max(8, cx - RX)), y: f1(Math.max(18, cy - RY * 1.08)) }, G.moatLabel))
    const bwPx = Math.max(70, Math.min(112, RX * 0.3))
    boats.forEach((b, i) => {
      const a = (ANG[i] * Math.PI) / 180
      const [x, y] = at(a, 0.97)
      const [nx, ny] = at(a, 0.72)
      Object.assign(b.style, { left: `${f1(Math.max(4, Math.min(w - bwPx - 4, x - bwPx / 2)))}px`, top: `${f1(y - bwPx * 0.55)}px`, width: `${f1(bwPx)}px` })
      b.style.setProperty('--dx', `${f1(nx - x)}px`)
      b.style.setProperty('--dy', `${f1(ny - y)}px`)
    })
  }
}
