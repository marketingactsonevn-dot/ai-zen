import { h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { blob, rng, stroke, type Pt } from '../../ui/part2/ink'
import { grass, mist, moon, toro, wash } from '../../ui/part2/paint'
import { C } from './data'
import { f1, frame } from '../t28/frame'
import { arc, figure, P } from '../t28/brush'

const G = C.scenes.fence

/** A city guard: conical hat, a spear, and a lantern held out with a vermilion stamp on its paper. */
function guardArt(seed: number): SVGSVGElement {
  return s('svg', { viewBox: '-24 -50 48 54', 'aria-hidden': 'true' },
    s('circle', { class: 't30f-glow', cx: 11, cy: -24, r: 16, fill: 'url(#p2-lamp)' }),
    s('ellipse', { class: 'gb-shadow', cx: 2, cy: 1, rx: 12, ry: 2.4 }),
    s('path', { class: 'gb-figure', d: figure(-2, 0, 40, seed, 1, { hat: 'cone', stoop: 0.05 }) }),
    s('path', { class: 'gb-figure', d: stroke([[-9, 2], [-8, -46]], 1.4, 0.05, 0.05, 0.6) + 'M-9.6 -46L-8 -51L-6.4 -46Z' }),
    s('path', { class: 'gb-rope', d: 'M9 -31V-28' }),
    s('ellipse', { class: 't30f-lamp-body', cx: 9.2, cy: -23.5, rx: 4.6, ry: 5.6 }),
    s('circle', { class: 'gb-seal', cx: 9.2, cy: -23.5, r: 1.9 }),
    s('path', { class: 'gb-figure', d: 'M6.5 -29.6h5.4v1.2h-5.4zM6.5 -18.6h5.4v1.2h-5.4z' }))
}

/** A bamboo fence tied with thorn rope round one very bright lamp that lights every crack in the city wall; only stamped lanterns pass. */
export function fenceScene(ctx: SceneCtx) {
  const read = h('div', { class: 't30f-read', 'aria-live': 'polite' })
  const more = h('div', { class: 't30f-more' })
  const panel = h('div', { class: 'gf-panel t30f-panel' }, read, more)
  const { root, over, svg } = frame(ctx, 't30f', [G.insight as Fact], panel, draw)
  ctx.prompt(G.prompt)
  const gate = h('button', { class: 'gf-hit t30f-gate', type: 'button', 'aria-label': G.gateAria, onClick: knock }, h('span', { class: 'gf-tagline' }, G.gate))
  const guards = G.cases.map((c, i) => h('button', { class: 'gf-hit t30f-guard', type: 'button', 'aria-pressed': 'false', onClick: () => pick(i) },
    guardArt(3040 + i), h('span', { class: 'gf-tagline' }, c.name)))
  over.append(gate, ...guards)
  const seen = new Set<number>()
  read.append(h('p', { class: 'p2-question' }, G.group))

  function knock() {
    root.classList.remove('shake')
    void root.offsetWidth
    root.classList.add('shake', 'knocked')
    read.replaceChildren(h('p', { class: 't30f-denied gf-new' }, G.denied))
    if (!more.childElementCount) more.append(h('p', { class: 'gf-eyebrow' }, G.whyLabel), ctx.fact(G.why as Fact, 'p', 'gf-new'))
    ctx.chime('soft')
  }

  function pick(i: number) {
    guards.forEach((g, k) => g.setAttribute('aria-pressed', String(k === i)))
    seen.add(i)
    read.replaceChildren(h('p', { class: 'gf-who' }, G.cases[i].name), ctx.fact(G.cases[i].fact as Fact, 'p', 'gf-new'))
    if (seen.size === G.cases.length && !root.classList.contains('all')) {
      root.classList.add('all')
      more.append(h('p', { class: 'gf-eyebrow t30f-gap' }, G.debateLabel), ctx.fact(G.debate as Fact, 'p', 'gf-new'))
      ctx.insight(G.insight as Fact, G.detail)
      ctx.chime('ok')
    } else ctx.chime('soft')
  }

  function draw(w: number, hh: number) {
    const r = rng(3050)
    const cx = w / 2, cy = hh * 0.68
    const rx = Math.min(w * 0.33, hh * 0.58), ry = rx * 0.34
    const fh = Math.max(26, ry * 0.95) // fence height
    // the city wall far behind: courses of stone, crenels, a gate tower, cracks the lamp picks out
    const wy = hh * 0.34, wallH = Math.min(hh * 0.15, 70)
    const wx0 = w * 0.02, wx1 = w * 0.98
    const wallD = `M${P([wx0, wy])}L${P([wx0, wy - wallH])}L${P([wx1, wy - wallH - 2])}L${P([wx1, wy])}Z`
    let crenels = '', courses = ''
    const cw = Math.max(12, wallH * 0.32)
    for (let x = wx0; x < wx1 - cw * 0.6; x += cw * 1.6) crenels += `M${f1(x)} ${f1(wy - wallH + 1)}v${f1(-cw * 0.55)}h${f1(cw)}v${f1(cw * 0.55)}Z`
    for (let k = 1; k < 4; k++) {
      const y = wy - (wallH * k) / 4
      for (let x = wx0 + r() * 30; x < wx1; ) {
        const len = 20 + r() * 50
        courses += stroke([[x, y + (r() - 0.5)], [Math.min(wx1, x + len), y + (r() - 0.5)]], 1, 0.2, 0.2, 0.3)
        x += len + 6 + r() * 20
      }
    }
    const towerX = w * 0.22, tw = wallH * 1.1
    const tower = `M${P([towerX - tw / 2, wy])}L${P([towerX - tw / 2, wy - wallH * 1.5])}L${P([towerX + tw / 2, wy - wallH * 1.5])}L${P([towerX + tw / 2, wy])}Z`
    const troof = `M${P([towerX - tw * 0.85, wy - wallH * 1.48])}Q${P([towerX - tw * 0.5, wy - wallH * 1.55])} ${P([towerX - tw * 0.3, wy - wallH * 1.9])}L${P([towerX + tw * 0.3, wy - wallH * 1.9])}Q${P([towerX + tw * 0.5, wy - wallH * 1.55])} ${P([towerX + tw * 0.85, wy - wallH * 1.48])}Z`
    const cracks = [0.12, 0.36, 0.6, 0.84].map((k) => [w * k + (r() - 0.5) * 20, wy - wallH * (0.35 + r() * 0.3)] as Pt)
    const crackD = cracks.map(([x, y]) => stroke([[x - 3, y - wallH * 0.35], [x + 2, y - wallH * 0.12], [x - 2, y + 2], [x + 3, y + wallH * 0.25]], 1.6, 0.1, 0.3, 0.3)).join('')
    const lampY = cy - fh * 0.9
    const beams = cracks.map(([x, y]) => `M${f1(cx - 3)} ${f1(lampY)}L${f1(x - 12)} ${f1(y)}L${f1(x + 12)} ${f1(y + 4)}Z`).join('')
    // the fence: bamboo posts round an ellipse (far half before the lamp, near half after), two rails tied with thorn rope
    const fence = (a0: number, a1: number) => {
      let posts = '', nodes = ''
      const n = Math.round(Math.abs(a1 - a0) / 7)
      for (let i = 0; i <= n; i++) {
        const a = a0 + ((a1 - a0) * i) / n
        if (Math.abs(a - 90) < 9) continue // the gate, front centre
        const t = (a * Math.PI) / 180
        const x = cx + Math.cos(t) * rx, y = cy + Math.sin(t) * ry
        const ph = fh * (0.9 + r() * 0.2) * (0.75 + 0.25 * (y - (cy - ry)) / (2 * ry))
        posts += stroke([[x, y + 1], [x + (r() - 0.5) * 1.5, y - ph]], Math.max(2.4, rx * 0.016), 0.03, 0.05, 0.6)
        nodes += stroke([[x - 2, y - ph * 0.5], [x + 2, y - ph * 0.48]], 1, 0.2, 0.2, 0.3)
      }
      const rail = (k: number) => {
        const pts = arc(cx, cy - fh * k, rx, ry, a0, a1, 30)
        let rope = '', thorns = ''
        pts.forEach(([x, y], i) => {
          if (i % 2) return
          thorns += `M${f1(x - 2.5)} ${f1(y - 3)}l2.5 3l2.5 -3M${f1(x - 2.5)} ${f1(y + 3)}l2.5 -3l2.5 3`
        })
        rope = stroke(pts, 1.6, 0.05, 0.05, 0.5)
        return { rope, thorns }
      }
      const a = rail(0.35), b = rail(0.72)
      return s('g', null,
        s('path', { class: 't30f-post', d: posts, filter: 'url(#ink-rough)' }),
        s('path', { class: 't30f-node', d: nodes }),
        s('path', { class: 't30f-rope', d: a.rope + b.rope }),
        s('path', { class: 't30f-thorn', d: a.thorns + b.thorns }))
    }
    // the gate in the near side: two taller posts, a lintel, a shut bamboo door
    const gx = cx, gyb = cy + ry
    const gh = fh * 1.35, gw = Math.max(36, rx * 0.26)
    let bars = ''
    for (let i = 0; i < 5; i++) bars += stroke([[gx - gw / 2 + (gw * (i + 0.5)) / 5, gyb - 1], [gx - gw / 2 + (gw * (i + 0.5)) / 5, gyb - gh * 0.75]], Math.max(2, gw * 0.06), 0.03, 0.05, 0.6)
    bars += stroke([[gx - gw / 2, gyb - gh * 0.3], [gx + gw / 2, gyb - gh * 0.3]], 1.6, 0.1, 0.1, 0.4) + stroke([[gx - gw / 2, gyb - gh * 0.6], [gx + gw / 2, gyb - gh * 0.6]], 1.6, 0.1, 0.1, 0.4)
    const gatePosts = stroke([[gx - gw / 2 - 3, gyb + 1], [gx - gw / 2 - 3, gyb - gh]], Math.max(3.4, rx * 0.022), 0.03, 0.05, 0.6) + stroke([[gx + gw / 2 + 3, gyb + 1], [gx + gw / 2 + 3, gyb - gh]], Math.max(3.4, rx * 0.022), 0.03, 0.05, 0.6) +
      stroke([[gx - gw * 0.75, gyb - gh + 2], [gx, gyb - gh - 2], [gx + gw * 0.75, gyb - gh + 2]], Math.max(3, rx * 0.02), 0.05, 0.05, 0.6)
    const mr = Math.max(11, Math.min(rx * 0.07, 22))
    svg.replaceChildren(
      mist(w * 0.5, wy - wallH, w * 0.7, wallH * 1.4),
      moon(w * 0.82, Math.max(mr * 1.8, wy - wallH * 2.2), mr, 3051, true),
      s('path', { class: 'gb-stone t30f-wall', d: wallD, filter: 'url(#ink-rough)' }),
      s('path', { class: 'gb-stone-sh', d: wallD }),
      s('path', { class: 't30f-crenel', d: crenels, filter: 'url(#ink-rough)' }),
      s('path', { class: 't30f-course', d: courses }),
      s('path', { class: 'gb-stone', d: tower, filter: 'url(#ink-rough)' }),
      s('path', { class: 't30f-roof', d: troof, filter: 'url(#ink-rough)' }),
      s('path', { class: 't30f-beam', d: beams }),
      s('path', { class: 't30f-crack', d: crackD, filter: 'url(#ink-rough)' }),
      mist(w * 0.5, wy + 4, w * 0.6, wallH * 0.35),
      // the garden floor; inside the fence, the ground and the lamp
      wash(blob(cx, cy + ry * 0.2, rx * 1.4, ry * 1.6, 3052, 0.08), 0.06),
      s('path', { class: 't30f-ground', d: blob(cx, cy, rx * 1.02, ry * 1.04, 3053, 0.04, 22), filter: 'url(#ink-wash)' }),
      fence(180, 360),
      s('circle', { class: 't30f-halo', cx: f1(cx), cy: f1(lampY), r: f1(rx * 0.95), fill: 'url(#p2-lamp)' }),
      s('circle', { class: 't30f-halo', cx: f1(cx), cy: f1(lampY), r: f1(rx * 0.4), fill: 'url(#p2-lamp)' }),
      toro(cx, cy + ry * 0.1, fh * 1.25, true),
      fence(0, 180),
      s('path', { class: 't30f-post', d: gatePosts, filter: 'url(#ink-rough)' }),
      s('path', { class: 't30f-door', d: bars, filter: 'url(#ink-rough)' }),
      grass(cx - rx * 1.15, cy + ry * 0.6, Math.max(12, rx * 0.12), 3054),
      grass(cx + rx * 1.1, cy + ry * 0.4, Math.max(12, rx * 0.1), 3055))
    Object.assign(gate.style, { left: `${f1(gx - gw)}px`, top: `${f1(gyb - gh)}px`, width: `${f1(gw * 2)}px`, height: `${f1(gh + 26)}px` })
    const gW = Math.max(56, Math.min(86, rx * 0.34))
    const gxs = [cx - rx * 1.22, cx + rx * 1.22]
    guards.forEach((g, i) => Object.assign(g.style, { left: `${f1(Math.max(4, Math.min(w - gW * 1.6 - 4, gxs[i] - gW * 0.8)))}px`, top: `${f1(cy - gW * 0.95)}px`, width: `${f1(gW * 1.6)}px` }))
  }
}
