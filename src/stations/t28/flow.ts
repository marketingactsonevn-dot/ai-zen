import { fill, h, nextId, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { blob, rng, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist, moon, pine, reeds, wash, water } from '../../ui/part2/paint'
import { C } from './data'
import { f1, frame } from './frame'

const G = C.scenes.loop
// step k carries the money to island TO[k]; the facts that belong to each step
const TO = [1, 2, 0, 0]
const FACT: (number | null)[] = [0, 2, null, 1]

/** A rock island seen low over the water: a lopsided crown, a shaded flank, moss on top, its dark double in the water. */
function island(x: number, y: number, w: number, hgt: number, seed: number, tree: boolean): SVGGElement {
  const r = rng(seed)
  const top: Pt[] = []
  for (let i = 0; i <= 14; i++) {
    const t = i / 14
    const bump = Math.sin(t * Math.PI) ** 0.7 * (1 + (r() - 0.5) * 0.25) * (t < 0.45 ? 1 : 0.92)
    top.push([x - w / 2 + w * t, y - hgt * bump])
  }
  const body = `M${f1(x - w / 2)} ${f1(y)}L${top.map(([a, b]) => `${f1(a)} ${f1(b)}`).join('L')}L${f1(x + w / 2)} ${f1(y)}Q${f1(x)} ${f1(y + hgt * 0.16)} ${f1(x - w / 2)} ${f1(y)}Z`
  let cun = ''
  for (let i = 0; i < 6; i++) {
    const [tx, ty] = top[2 + Math.floor(r() * 10)]
    cun += stroke([[tx, ty + 2], [tx + (r() - 0.3) * w * 0.06, ty + hgt * (0.3 + r() * 0.3)]], 1 + r() * 1.4, 0.1, 0.5, 0.1)
  }
  return s('g', { class: 't28f-island' },
    wash(blob(x + w * 0.04, y + hgt * 0.32, w * 0.5, hgt * 0.26, seed, 0.15), 0.32, 'p2p-wash t28f-double'),
    s('ellipse', { class: 't28f-ring', cx: f1(x), cy: f1(y + hgt * 0.06), rx: f1(w * 0.62), ry: f1(hgt * 0.2) }),
    s('path', { class: 'gb-stone', d: body, filter: 'url(#ink-rough)' }),
    s('path', { class: 'gb-stone-sh', d: body }),
    s('path', { class: 't28f-cun', d: cun, filter: 'url(#ink-dry)' }),
    wash(blob(x - w * 0.08, top[6][1] + hgt * 0.12, w * 0.26, hgt * 0.14, seed + 1, 0.3), 0.55, 'p2p-wash t28f-moss'),
    s('path', { class: 'gb-rim-hi', d: stroke(top.slice(2, 8).map(([a, b]) => [a, b + 1.2] as Pt), Math.max(1.2, w * 0.016), 0.2, 0.4, 0.1) }),
    tree ? pine(x + w * 0.14, top[9][1] + hgt * 0.1, hgt * 1.5, seed + 2, 1) : null,
    grass(x - w * 0.3, y - hgt * 0.05, Math.max(10, w * 0.12), seed + 3))
}

/** Rock islands on the moon pond; a silver stream runs NVIDIA → AI company → data centre → back to NVIDIA. */
export function flowScene(ctx: SceneCtx) {
  const cid = nextId('t28f')
  const list = h('ol', { class: 't28f-list' })
  const panel = h('div', { class: 'gf-panel t28f-panel', 'aria-live': 'polite' }, h('p', { class: 'gf-eyebrow' }, G.flowLabel), list)
  const { root, over, svg } = frame(ctx, 't28f', [G.insight as Fact], panel, draw)
  ctx.prompt(G.prompt)
  let step = 0
  let arcs: SVGGElement[] = []
  const isles = G.islands.map((name, i) =>
    h('button', { class: 'gf-hit t28f-isle', type: 'button', onClick: () => go(i) }, h('span', { class: 'gf-tagline' }, name)))
  over.append(...isles)
  mark()

  function mark() {
    isles.forEach((b, i) => {
      const next = step < TO.length && TO[step] === i
      b.classList.toggle('next', next)
      b.setAttribute('aria-label', next ? fill(G.flowAria, { n: step + 1, text: G.flow[step] }) : G.islands[i])
    })
  }

  function go(i: number) {
    if (step >= TO.length || TO[step] !== i) return
    const k = step++
    arcs[Math.min(k, 2)]?.classList.add('lit')
    const f = FACT[k]
    list.append(h('li', { class: 'gf-new' }, h('p', { class: 't28f-step' }, G.flow[k]), f == null ? null : ctx.fact(G.facts[f] as Fact, 'p', 't28f-fact')))
    list.lastElementChild?.scrollIntoView({ block: 'nearest' })
    mark()
    if (step === TO.length) {
      root.classList.add('round')
      ctx.insight(G.insight as Fact)
      ctx.chime('ok')
    } else ctx.chime('soft')
  }

  function draw(w: number, hh: number) {
    const shore = hh * 0.2
    const cx = w / 2, cy = shore + (hh - shore) * 0.52
    const rx = Math.min(w * 0.38, (hh - shore) * 0.8), ry = Math.min(rx * 0.56, (hh - shore) * 0.34)
    const pts: Pt[] = [[cx + rx * 0.02, cy - ry * 0.74], [cx + rx * 0.76, cy + ry * 0.5], [cx - rx * 0.74, cy + ry * 0.52]]
    const sw = Math.max(64, Math.min(140, rx * 0.4))
    // the stream bends outward between islands, drawn tail → head so the dash runs with the money
    arcs = [0, 1, 2].map((k) => {
      const a = pts[k], b = pts[(k + 1) % 3]
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2
      const c: Pt = [mx + (mx - cx) * 0.6, my + (my - cy) * 0.6]
      const dir = (p: Pt, q: Pt) => { const l = Math.hypot(q[0] - p[0], q[1] - p[1]); return [(q[0] - p[0]) / l, (q[1] - p[1]) / l] }
      const ra = sw * 0.5
      const [ax, ay] = dir(a, c), [bx, by] = dir(b, c)
      const d = `M${f1(a[0] + ax * ra)} ${f1(a[1] + ay * ra * 0.6)}Q${f1(c[0])} ${f1(c[1])} ${f1(b[0] + bx * ra)} ${f1(b[1] + by * ra * 0.6)}`
      return s('g', { class: 't28f-arc' },
        s('path', { class: 't28f-flow', d, pathLength: 1 }),
        s('path', { class: 't28f-core', d, pathLength: 1 }))
    })
    if (step) arcs.slice(0, Math.min(step, 3)).forEach((a) => a.classList.add('lit'))
    const lakeTop = shore + (hh - shore) * 0.08
    const mr = Math.max(11, Math.min(rx * 0.07, 22))
    const moonX = w * 0.82
    const bed = arcs.map((g) => (g.firstChild as SVGPathElement).getAttribute('d')).join('')
    svg.replaceChildren(
      s('defs', null,
        s('radialGradient', { id: `${cid}-f`, cx: 0.5, cy: 0.42, r: 0.62 },
          s('stop', { offset: 0, 'stop-color': '#fff' }), s('stop', { offset: 0.5, 'stop-color': '#fff' }), s('stop', { offset: 1, 'stop-color': '#000' })),
        s('mask', { id: `${cid}-m` }, s('rect', { x: 0, y: f1(lakeTop), width: f1(w), height: f1(hh - lakeTop), fill: `url(#${cid}-f)` }))),
      mist(w * 0.5, shore * 0.6, w * 0.6, shore * 0.9),
      moon(moonX, Math.max(mr * 1.8, shore * 0.42), mr, 2851, true),
      hills(-w * 0.04, w * 1.04, shore + (hh - shore) * 0.1, shore * 0.8, 2852, 0.88, 5),
      hills(-w * 0.02, w * 0.4, shore + (hh - shore) * 0.12, shore * 0.55, 2853, 0.6, 2),
      mist(w * 0.5, shore + (hh - shore) * 0.1, w * 0.6, shore * 0.25),
      s('g', { mask: `url(#${cid}-m)` },
        s('rect', { class: 't28f-pond', x: 0, y: f1(lakeTop), width: f1(w), height: f1(hh - lakeTop) }),
        water(0, lakeTop, w, hh, 2854, moonX - w * 0.08, false)),
      s('path', { class: 't28f-bed', d: bed }),
      // a small fourth islet far back on the pond
      island(cx - rx * 0.62, cy - ry * 0.62, sw * 0.42, sw * 0.16, 2855, false),
      ...arcs,
      ...pts.map((p, k) => island(p[0], p[1] + sw * 0.12, sw * (k ? 0.92 : 1.05), sw * (k ? 0.3 : 0.38), 2860 + k * 7, k === 0)),
      reeds(cx - rx * 1.25, cy + ry * 0.7, Math.max(16, ry * 0.4), 2856, 7),
      reeds(cx + rx * 1.22, cy - ry * 0.3, Math.max(14, ry * 0.3), 2857, 5),
      mist(cx, cy + ry * 1.3, rx * 1.2, ry * 0.2))
    isles.forEach((b, k) => {
      const [x, y] = pts[k]
      Object.assign(b.style, { left: `${f1(x - sw / 2)}px`, top: `${f1(y - sw * 0.34)}px`, width: `${f1(sw)}px`, height: `${f1(sw * 0.62)}px` })
    })
  }
}
