import { fill, h, nextId, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { blob, curve, rng, stroke, type Pt } from '../../ui/part2/ink'
import { grass, mist, reeds, wash, water } from '../../ui/part2/paint'
import { C } from './data'
import { f1, frame } from '../t28/frame'
import { bucket, nightSky, P } from '../t28/brush'

const G = C.scenes.wells
const LEVELS = [10, 6, 3, 1]

/** The great moon lake (AI data centres) drinks through underground streams; the three small wells at the garden's edge sink. */
export function wellsScene(ctx: SceneCtx) {
  const cid = nextId('t29w')
  let k = 0
  const gate = h('button', { class: 'btn t29w-gate', type: 'button', 'aria-label': G.gateAria, onClick: open }, G.gate)
  const read = h('div', { class: 't29w-read', 'aria-live': 'polite' })
  const sr = h('ul', { class: 'visually-hidden' })
  const panel = h('div', { class: 'gf-panel t29w-panel' }, gate, read, sr)
  const { root, svg } = frame(ctx, 't29w', [G.insight as Fact], panel, draw)
  ctx.prompt(G.prompt)
  let waters: SVGGElement[] = [], buckets: SVGGElement[] = [], ropes: SVGGElement[] = []
  let sink = 1, ropeLen = 1
  say()

  function say() {
    sr.replaceChildren(...G.wells.map((w) => h('li', null, fill(G.wellAria, { name: w.name, n: LEVELS[k] }))))
  }
  // water sinks in every shaft; the bucket follows it down until it rests on the moss
  function set() {
    const drop = (sink * (1 - LEVELS[k] / 10)) / 0.9
    waters.forEach((g) => { g.style.transform = `translateY(${f1(drop)}px)` })
    buckets.forEach((g) => { g.style.transform = `translateY(${f1(drop)}px)` })
    ropes.forEach((g) => { g.style.transform = `scaleY(${(1 + drop / ropeLen).toFixed(3)})` })
    root.style.setProperty('--lake', String(1 + k * 0.05))
    root.dataset.level = String(k)
  }

  function open() {
    if (k >= LEVELS.length - 1) return
    k++
    set()
    say()
    root.classList.remove('flow')
    void root.offsetWidth // restart the stream animation
    root.classList.add('flow')
    if (k <= G.facts.length) read.replaceChildren(ctx.fact(G.facts[k - 1] as Fact, 'p', 'gf-new'))
    if (k === LEVELS.length - 1) {
      gate.disabled = true
      ctx.insight(G.insight as Fact)
      ctx.chime('ok')
    } else ctx.chime('soft')
  }

  function draw(w: number, hh: number) {
    const r = rng(2920)
    const gy = hh * 0.6 // the near ground line; below it the earth is cut open
    const lx = w / 2, ly = hh * 0.31
    const lrx = Math.min(w * 0.34, hh * 0.62), lry = Math.min(lrx * 0.26, hh * 0.1)
    const xs = [w * 0.17, w * 0.5, w * 0.83]
    const R = Math.max(14, Math.min(w * 0.055, hh * 0.06, 34))
    const bottom = hh * 0.93
    const depth = bottom - gy - R * 0.6
    sink = depth - R * 0.5
    // the earth section: a ragged top edge, strata, pebbles
    const edge: Pt[] = []
    for (let i = 0; i <= 24; i++) edge.push([(w * i) / 24, gy + (r() - 0.5) * 3])
    const earth = `M${P(edge[0])}L${edge.slice(1).map(P).join('L')}Q${f1(w * 0.99)} ${f1(hh * 0.9)} ${f1(w * 0.9)} ${f1(hh)}L${f1(w * 0.1)} ${f1(hh)}Q${f1(w * 0.01)} ${f1(hh * 0.9)} ${P(edge[0])}Z`
    let strata = '', pebbles = ''
    for (let i = 0; i < 5; i++) {
      const y = gy + (hh - gy) * (0.18 + i * 0.17)
      for (let x = r() * 40; x < w; ) {
        const len = w * (0.06 + r() * 0.14)
        strata += stroke([[x, y + (r() - 0.5) * 3], [x + len * 0.5, y + (r() - 0.5) * 4], [x + len, y + (r() - 0.5) * 3]], 1 + r() * 1.4, 0.2, 0.3, 0.1)
        x += len + 10 + r() * 40
      }
    }
    for (let i = 0; i < 26; i++) pebbles += blob(r() * w, gy + (hh - gy) * (0.1 + r() * 0.85), 2 + r() * 4, 1.5 + r() * 2.5, 2921 + i, 0.2, 8)
    // underground streams: from the foot of every shaft up to the lake — solid in the cut earth, dashed under the garden
    const veinPts = xs.map((x, i): Pt[] => {
      const a: Pt = [x + (i - 1) * -R * 0.7, bottom - R * 0.4]
      const c: Pt = [x + (lx - x) * 0.15, gy + (bottom - gy) * 0.35]
      const b: Pt = [lx + (x - lx) * 0.35, ly + lry * 0.9]
      return curve(a, c, b, 30)
    })
    const below = (pts: Pt[]) => pts.filter((p) => p[1] >= gy - 2)
    const above = (pts: Pt[]) => pts.filter((p) => p[1] <= gy + 2)
    const line = (pts: Pt[]) => (pts.length > 1 ? `M${pts.map(P).join('L')}` : '')
    // the wells
    waters = []; buckets = []; ropes = []
    const top = gy - R * 2.5
    const wells = xs.map((x, i) => {
      const shaft = `M${f1(x - R)} ${f1(gy)}L${f1(x - R)} ${f1(bottom - R * 0.5)}Q${f1(x)} ${f1(bottom + R * 0.2)} ${f1(x + R)} ${f1(bottom - R * 0.5)}L${f1(x + R)} ${f1(gy)}Z`
      let courses = ''
      for (let y = gy + R * 0.5; y < bottom - R * 0.6; y += R * 0.55) courses += stroke([[x - R * 0.95, y], [x - R * 0.2 + (r() - 0.5) * R * 0.4, y + 0.6]], 1, 0.2, 0.3, 0.2) + stroke([[x + R * 0.1, y + R * 0.27], [x + R * 0.95, y + R * 0.27]], 1, 0.2, 0.3, 0.2)
      const wtr = s('g', { class: 't29w-water' },
        s('rect', { class: 'gb-water', x: f1(x - R * 1.2), y: f1(gy + R * 0.3), width: f1(R * 2.4), height: f1(depth + R) }),
        s('ellipse', { class: 'gb-glint', cx: f1(x), cy: f1(gy + R * 0.3), rx: f1(R * 0.9), ry: f1(R * 0.12) }))
      waters.push(wtr)
      // frame over the well: two posts, a crossbar with a pulley, the rope and its bucket
      const posts = stroke([[x - R * 1.35, gy + 1], [x - R * 1.3, top - R * 0.3]], Math.max(2, R * 0.13), 0.03, 0.05, 0.6) + stroke([[x + R * 1.35, gy + 1], [x + R * 1.3, top - R * 0.3]], Math.max(2, R * 0.13), 0.03, 0.05, 0.6) +
        stroke([[x - R * 1.6, top - R * 0.2], [x, top - R * 0.32], [x + R * 1.6, top - R * 0.2]], Math.max(2.2, R * 0.15), 0.05, 0.05, 0.6)
      const bw = R * 0.8
      const b = bucket(x, 0, bw)
      const bTop = gy + R * 0.3 - bw * 1.4 // the bucket's foot just in the water
      ropeLen = bTop + bw * 0.15 - top
      const bk = s('g', { class: 't29w-bucket' }, s('g', { transform: `translate(0 ${f1(bTop)})` },
        s('path', { class: 'gb-wood', d: b.body, filter: 'url(#ink-rough)' }),
        s('path', { class: 'gb-hoop', d: b.hoops }),
        s('path', { class: 'gb-rope', d: b.bail })))
      buckets.push(bk)
      const rope = s('g', { class: 't29w-rope', style: `transform-origin:${f1(x)}px ${f1(top)}px` }, s('path', { class: 'gb-rope', d: `M${f1(x)} ${f1(top)}V${f1(top + ropeLen)}`, 'vector-effect': 'non-scaling-stroke' }))
      ropes.push(rope)
      return s('g', null,
        s('path', { class: 't29w-shaft', d: shaft }),
        s('clipPath', { id: `${cid}-${i}` }, s('path', { d: shaft })),
        s('path', { class: 't29w-course', d: courses }),
        s('g', { 'clip-path': `url(#${cid}-${i})` },
          wtr,
          wash(blob(x, bottom - R * 0.2, R * 1.1, R * 0.45, 2930 + i, 0.25), 0.9, 'p2p-wash t29w-moss')),
        rope,
        bk,
        // the well head: a ring of stones round the mouth, front half over the rope
        s('path', { class: 'gb-stone', d: `M${f1(x - R * 1.25)} ${f1(gy)}Q${f1(x)} ${f1(gy + R * 0.55)} ${f1(x + R * 1.25)} ${f1(gy)}L${f1(x + R * 1.25)} ${f1(gy - R * 0.5)}Q${f1(x)} ${f1(gy + R * 0.02)} ${f1(x - R * 1.25)} ${f1(gy - R * 0.5)}Z`, filter: 'url(#ink-rough)' }),
        s('path', { class: 'gb-rim-hi', d: stroke(curve([x - R * 1.2, gy - R * 0.5], [x, gy - R * 0.02], [x + R * 1.2, gy - R * 0.5], 10), Math.max(1, R * 0.06), 0.2, 0.2, 0.2) }),
        s('path', { class: 't29w-frame', d: posts, filter: 'url(#ink-rough)' }),
        s('circle', { class: 't29w-pulley', cx: f1(x), cy: f1(top), r: f1(R * 0.22) }),
        grass(x - R * 1.7, gy, Math.max(10, R * 0.7), 2940 + i),
        s('text', { class: 'gf-caption', x: f1(x), y: f1(Math.min(hh - 4, bottom + R * 0.2 + 16)), 'text-anchor': 'middle' }, G.wells[i].name))
    })
    const lake = s('g', { class: 't29w-lake', style: `transform-origin:${f1(lx)}px ${f1(ly)}px` },
      s('path', { class: 't29w-pond', d: blob(lx, ly, lrx, lry, 2922, 0.06, 24), filter: 'url(#ink-wash)' }),
      s('clipPath', { id: `${cid}-l` }, s('path', { d: blob(lx, ly, lrx * 0.98, lry * 0.95, 2922, 0.06, 24) })),
      s('g', { 'clip-path': `url(#${cid}-l)` }, water(lx - lrx, ly - lry, lx + lrx, ly + lry, 2923, lx + lrx * 0.42, false)),
      s('path', { class: 'gb-stone', d: stroke(curve([lx - lrx * 1.02, ly + lry * 0.1], [lx, ly + lry * 1.45], [lx + lrx * 1.02, ly + lry * 0.1], 20), Math.max(2.4, lry * 0.14), 0.15, 0.15, 0.3), filter: 'url(#ink-rough)' }))
    svg.replaceChildren(
      ...nightSky(w, ly - lry * 0.6, 2924, [w * 0.86, Math.max(16, hh * 0.08), Math.max(11, Math.min(w, hh) * 0.04)], Math.min(hh * 0.2, ly - lry - 20)),
      wash(blob(lx, ly + lry * 0.2, lrx * 1.25, lry * 1.6, 2925, 0.08), 0.12),
      ...veinPts.map((pts) => s('path', { class: 't29w-vein-under', d: line(above(pts)) })),
      lake,
      s('text', { class: 'gf-caption', x: f1(lx), y: f1(ly + lry * 1.6 + 14), 'text-anchor': 'middle' }, G.lake),
      reeds(lx - lrx * 1.02, ly + lry * 0.4, Math.max(16, lry * 0.9), 2926, 7),
      reeds(lx + lrx * 1.0, ly, Math.max(14, lry * 0.7), 2927, 5),
      mist(lx, gy - hh * 0.02, w * 0.6, hh * 0.04),
      s('path', { class: 't29w-earth', d: earth, filter: 'url(#ink-wash)' }),
      s('path', { class: 't29w-strata', d: strata, filter: 'url(#ink-dry)' }),
      s('path', { class: 't29w-pebble', d: pebbles }),
      s('path', { class: 't29w-ground', d: stroke(edge, 2.2, 0.02, 0.02, 0.5), filter: 'url(#ink-rough)' }),
      ...veinPts.map((pts) => s('path', { class: 't29w-vein', d: line(below(pts)) })),
      ...veinPts.map((pts) => s('path', { class: 't29w-stream', d: line(pts) })),
      ...wells)
    set()
  }
}
