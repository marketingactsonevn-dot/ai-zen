import raw from '../../content/tram-31.json'
import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { onSize } from '../../ui/part2/ink'
import { grass, paperLantern, steppingStones } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import { bamboo, ground, live, night, rng, stroke, blob, type Pt } from './kit'

const K = raw.scenes.wells
const f1 = (n: number) => (Math.round(n * 10) / 10).toString()

// a well in viewBox 0 0 220 210: rim centre (CX, RY), radii RX × ER, the body down to BOT
const CX = 110, RY = 116, RX = 64, ER = 15, BOT = 174

/** Points along the front half of an ellipse round CX at height y (left → right when reversed, right → left as given). */
const front = (y: number, rx = RX, ry = ER, n = 18): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = (Math.PI * i) / n
    return [CX + Math.cos(a) * rx, y + Math.sin(a) * ry] as Pt
  })

/** A small clay jar standing on (x, y), k ≈ its height / 13: glazed body, neck, lip, a paper label with a red seal. */
export function jar(x: number, y: number, k: number, seed: number): SVGGElement {
  const r = rng(seed)
  const w = 5 + r() * 1.2
  const body = `M${f1(x - w * k)} ${f1(y)}C${f1(x - (w + 2.6) * k)} ${f1(y - 6 * k)} ${f1(x - w * k)} ${f1(y - 10 * k)} ${f1(x - 2.3 * k)} ${f1(y - 10.6 * k)}L${f1(x - 2.3 * k)} ${f1(y - 12.4 * k)}L${f1(x + 2.3 * k)} ${f1(y - 12.4 * k)}L${f1(x + 2.3 * k)} ${f1(y - 10.6 * k)}C${f1(x + w * k)} ${f1(y - 10 * k)} ${f1(x + (w + 2.6) * k)} ${f1(y - 6 * k)} ${f1(x + w * k)} ${f1(y)}Z`
  return s('g', { class: 't31w-jar' },
    s('path', { class: 'g11-clay', d: body, filter: 'url(#ink-rough)' }),
    s('path', { class: 't31w-jar-sh', d: body }),
    s('path', { class: 'g11-wash t31w-jar-ink', d: stroke([[x - 3 * k, y - 12.6 * k], [x + 3.2 * k, y - 12.5 * k]], 1.6 * k, 0.1, 0.1, 0.4) + stroke([[x + (w + 1.6) * k, y - 6 * k], [x + w * k, y - 1 * k], [x - w * k, y]], 1.1 * k, 0.1, 0.3, 0.3) }),
    s('path', { class: 'g11-label', d: `M${f1(x - 2.8 * k)} ${f1(y - 8.2 * k)}l${f1(5.4 * k)} -0.3l0.2 ${f1(4.4 * k)}l${f1(-5.4 * k)} 0.3Z` }),
    s('path', { class: 'g11-seal', d: stroke([[x - 1.2 * k, y - 6.6 * k], [x + 1.1 * k, y - 6.7 * k]], 1.3 * k, 0.1, 0.1, 0.5) }),
    s('path', { class: 'g11-moonlit', d: stroke([[x - (w + 0.8) * k, y - 4 * k], [x - (w - 0.4) * k, y - 8 * k], [x - 2.6 * k, y - 9.8 * k]], 1.1 * k, 0.2, 0.3, 0.2) }))
}

/** A mossy stone well with a bamboo frame, a little roof and a bamboo bucket on a rope; code glints or jars in the water. */
export function wellArt(kind: string, seed: number, cls = 't31w-art'): SVGSVGElement {
  const r = rng(seed)
  // stone courses on the drum: curved joints following the front of the ellipse, staggered upright joints
  const levels = [RY + 15, RY + 30, RY + 45]
  let courses = ''
  for (const y of levels) {
    const arc = front(y)
    const cut = 5 + Math.floor(r() * 8)
    courses += stroke(arc.slice(0, cut), 1.3, 0.1, 0.2, 0.3) + stroke(arc.slice(cut + 1), 1.4, 0.1, 0.15, 0.3)
  }
  let joints = '', dark = ''
  const tops = [RY + 4, ...levels]
  for (let k = 0; k < tops.length; k++) {
    const y0 = tops[k], y1 = levels[k] ?? BOT
    for (let a = (k % 2 ? 0.22 : 0.48) + r() * 0.1; a < Math.PI - 0.12; a += 0.46 + r() * 0.1) {
      const x = CX + Math.cos(a) * RX, sy = Math.sin(a) * ER
      joints += stroke([[x, y0 + sy + 1], [x + (r() - 0.5) * 1.5, y1 + sy - 1]], 1.1, 0.2, 0.2, 0.4)
      if (r() < 0.35) {
        const xm = CX + Math.cos(a + 0.23) * RX * 0.98
        dark += blob(xm, (y0 + y1) / 2 + Math.sin(a + 0.23) * ER, 7 + Math.sin(a) * 4, (y1 - y0) * 0.36, seed + k * 13 + Math.round(a * 10), 0.2, 10)
      }
    }
  }
  // the rim: a ring of cut stones seen from above
  let rim = ''
  for (let a = r() * 0.4; a < Math.PI * 2; a += 0.5 + r() * 0.14) {
    rim += stroke([[CX + Math.cos(a) * 53, RY - 1 + Math.sin(a) * 11], [CX + Math.cos(a) * 67, RY + Math.sin(a) * 16.5]], 1, 0.2, 0.2, 0.4)
  }
  const body = `M${CX - RX} ${RY}L${CX - RX} ${BOT}A${RX} ${ER} 0 0 0 ${CX + RX} ${BOT}L${CX + RX} ${RY}Z`
  const water = s('g', { class: 't31w-water' })
  if (kind === 'github') {
    // lines of code glinting on the water like fish scales
    let code = ''
    ;[[-5, 0], [-1.6, 7], [1.8, 7], [5.2, 14], [8.4, 0]].forEach(([dy, ind]) => {
      const y = RY + 1 + dy
      const hw = 47 * Math.sqrt(Math.max(0, 1 - (dy / 9.5) ** 2)) - 3
      for (let x = CX - hw + ind; x < CX + hw - 4; ) {
        const len = 2.5 + r() * 7
        if (x + len > CX + hw) break
        code += stroke([[x, y], [x + len, y - 0.2]], 1.3, 0.25, 0.25, 0.3)
        x += len + 2 + r() * 4
      }
    })
    let scales = ''
    for (let i = 0; i < 6; i++) {
      const x = CX - 30 + r() * 60, y = RY - 2 + r() * 7
      scales += stroke(curveArc(x, y, 3 + r() * 2), 0.9, 0.3, 0.3, 0.2)
    }
    water.append(s('path', { class: 't31w-code', d: code }), s('path', { class: 't31w-scale', d: scales }))
  } else {
    for (const [x, y, k, sd] of [[CX - 26, RY + 4, 0.95, 1], [CX + 1, RY - 1, 0.8, 2], [CX + 27, RY + 5, 1.05, 3]]) {
      water.append(
        s('ellipse', { class: 't31w-ring', cx: x, cy: y + 0.4, rx: 8 * k, ry: 1.8 * k }),
        jar(x, y + 0.5, k, seed + sd))
    }
  }
  // a small hip roof: ridge with upturned ends, a thick thatch body, tile lines and a dark eave
  const roof = `M${CX - 104} 27Q${CX - 96} 33 ${CX - 84} 32Q${CX - 44} 22 ${CX} 5Q${CX + 44} 22 ${CX + 84} 32Q${CX + 96} 33 ${CX + 104} 27Q${CX + 104} 36 ${CX + 94} 41Q${CX + 50} 33 ${CX} 19Q${CX - 50} 33 ${CX - 94} 41Q${CX - 104} 36 ${CX - 104} 27Z`
  let tiles = ''
  for (let x = CX - 86; x <= CX + 86; x += 8.5) {
    const t = Math.abs(x - CX) / 94
    const y = 6 + t * 25
    tiles += stroke([[x, y + 1], [x + (x - CX) * 0.06, y + 13 - t * 3]], 1.2, 0.2, 0.3, 0.3)
  }
  return s('svg', { class: cls, viewBox: '0 0 220 210', 'aria-hidden': 'true' },
    ground(CX + 6, BOT + 10, 98, 13, seed + 1, 0.2),
    // the frame: two bamboo posts, a crossbar, a small roof with tiles
    bamboo([CX - 82, BOT + 10], [CX - 80, 34], 6.4, seed + 2, 32),
    bamboo([CX + 82, BOT + 10], [CX + 80, 34], 6.4, seed + 3, 32),
    bamboo([CX - 94, 44], [CX + 94, 42], 5.2, seed + 4, 46),
    s('path', { class: 't31w-roof', d: roof, filter: 'url(#ink-wash)' }),
    s('path', { class: 't31w-tiles', d: tiles }),
    s('path', { class: 'g11-wash t31w-ridge', d: stroke([[CX - 104, 27], [CX - 84, 31], [CX - 44, 21], [CX, 4.5], [CX + 44, 21], [CX + 84, 31], [CX + 104, 27]], 3, 0.06, 0.06, 0.4) + stroke([[CX - 94, 41], [CX - 50, 33], [CX, 19.5], [CX + 50, 33], [CX + 94, 41]], 2, 0.1, 0.1, 0.4), filter: 'url(#ink-rough)' }),
    // pulley and rope, and the bamboo bucket (dips on a right drop)
    s('circle', { class: 't31w-pulley', cx: CX, cy: 47, r: 5.5 }),
    s('g', { class: 't31w-bucket' },
      s('path', { class: 'g11-thread', d: `M${CX} 47V76` }),
      s('path', { class: 'g11-wash t31w-handle', d: stroke(curveArcUp(CX, 79, 11), 1.4, 0.1, 0.1, 0.4) }),
      bamboo([CX, 77], [CX, 99], 20, seed + 5, 19, 'g11-bamboo t31w-tub'),
      s('path', { class: 'g11-wash t31w-hoop', d: stroke([[CX - 10, 82], [CX + 10, 82.6]], 1.3, 0.1, 0.1, 0.4) + stroke([[CX - 10, 94], [CX + 10, 94.4]], 1.3, 0.1, 0.1, 0.4) })),
    // the drum: stone face, shaded flank, mortar courses and joints, a few darker stones, moss
    s('path', { class: 't31w-body', d: body, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
    s('path', { d: body, fill: 'url(#p2-shade)' }),
    s('path', { class: 'g11-wash t31w-dark', d: dark, filter: 'url(#ink-wash)' }),
    s('path', { class: 'g11-wash t31w-course', d: courses + joints }),
    s('path', { class: 'g11-wash t31w-edge', d: stroke(front(BOT).reverse(), 2.2, 0.1, 0.1, 0.3) + stroke([[CX + RX, RY + 2], [CX + RX + 0.5, BOT]], 2, 0.1, 0.1, 0.4) + stroke([[CX - RX, RY + 2], [CX - RX - 0.4, BOT]], 1.2, 0.1, 0.1, 0.3), filter: 'url(#ink-rough)' }),
    s('path', { class: 'g11-moonlit t31w-lit', d: stroke([[CX - RX + 2.5, RY + 6], [CX - RX + 2, BOT - 4]], 2.2, 0.2, 0.3, 0.2) }),
    // the rim, the dark mouth, the far inner wall and the water
    s('ellipse', { class: 't31w-rimstone', cx: CX, cy: RY, rx: 67, ry: 16.5, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
    s('path', { class: 'g11-wash t31w-rimjoint', d: rim }),
    s('ellipse', { class: 't31w-hole', cx: CX, cy: RY - 1, rx: 53, ry: 11 }),
    s('ellipse', { class: 't31w-pool', cx: CX, cy: RY + 1.4, rx: 50, ry: 9.2 }),
    s('ellipse', { class: 't31w-moonr', cx: CX + 18, cy: RY + 2, rx: 6, ry: 2.6 }),
    water,
    s('path', { class: 'g11-wash t31w-edge', d: stroke(front(RY, 67, 16.5).reverse(), 2.4, 0.06, 0.06, 0.3), filter: 'url(#ink-rough)' }),
    s('path', { class: 'g11-moonlit', d: stroke(Array.from({ length: 10 }, (_, i) => { const a = Math.PI * (1.12 + i * 0.05); return [CX + Math.cos(a) * 66, RY + Math.sin(a) * 16] as Pt }), 1.8, 0.2, 0.3, 0.2) }),
    s('path', { class: 'g11-mossy', d: blob(CX - 48, RY + 13, 17, 5, seed + 6, 0.3, 12) + blob(CX + 40, RY + 16, 13, 3.6, seed + 7, 0.3, 12) + blob(CX - 30, BOT + 13, 24, 5, seed + 8, 0.3, 12) + blob(CX + 56, BOT + 6, 10, 6, seed + 9, 0.3, 12), filter: 'url(#ink-wash)' }),
    s('path', { class: 'g11-mossy t31w-drip', d: stroke([[CX - 56, RY + 13], [CX - 55, RY + 24]], 3, 0.1, 0.6, 0.2) + stroke([[CX - 40, RY + 16], [CX - 40, RY + 22]], 2.4, 0.1, 0.6, 0.2) + stroke([[CX + 44, RY + 17], [CX + 45, RY + 26]], 2.6, 0.1, 0.6, 0.2) }),
    grass(CX - 72, BOT + 14, 22, seed + 10),
    grass(CX + 68, BOT + 13, 18, seed + 11),
    kind === 'github' ? '' : s('g', null, jar(CX + 88, BOT + 14, 1.5, seed + 12), jar(CX + 74, BOT + 17, 1.1, seed + 13)))
}

/** A small arc (a fish scale) opening downward at (x, y). */
function curveArc(x: number, y: number, w: number): Pt[] {
  return Array.from({ length: 7 }, (_, i) => { const a = Math.PI * (1 + i / 6); return [x + Math.cos(a) * w, y + Math.sin(a) * w * 0.45] as Pt })
}
/** A bucket handle: an arc w wide over (x, y). */
function curveArcUp(x: number, y: number, w: number): Pt[] {
  return Array.from({ length: 9 }, (_, i) => { const a = Math.PI * (1 + i / 8); return [x + Math.cos(a) * w, y + Math.sin(a) * w * 0.9] as Pt })
}

/** The village edge between the wells (row px): the ground both stand on, stepping stones, a wooden post with a lit lantern. */
function paintEdge(svg: SVGSVGElement, w: number, artTop: number, artH: number, a: DOMRect, b: DOMRect, row: DOMRect) {
  const k = artH / 210
  const gy = artTop + (BOT + 12) * k
  const mx = (a.right + b.left) / 2 - row.left
  const r = rng(3131)
  let fence = ''
  // a low bamboo fence fading out behind the left well: the edge of the village
  for (let x = -w * 0.25; x < a.left - row.left + 20 * k; x += 9 * k + r() * 4 * k) fence += stroke([[x, gy - 10 * k], [x + (r() - 0.5) * 2, gy - (38 + r() * 8) * k]], 3.4 * k, 0.04, 0.08, 0.6)
  const postH = artH * 0.62
  const top = gy - postH
  svg.setAttribute('viewBox', `0 0 ${f1(w)} ${f1(gy + 120 * k)}`)
  svg.style.height = `${f1(gy + 120 * k)}px`
  svg.replaceChildren(
    ground(w / 2, gy + 4 * k, w * 0.7, 18 * k, 3132, 0.14),
    s('path', { class: 'g11-bamboo-culm t31w-fence', d: fence + stroke([[-w * 0.25, gy - 30 * k], [a.left - row.left + 26 * k, gy - 28 * k]], 2 * k, 0.02, 0.4, 0.3), filter: 'url(#ink-rough)' }),
    steppingStones([mx, gy + 8 * k], [mx - 6 * k, gy + 100 * k], 4, 20 * k, 3133),
    ground(mx + 4 * k, gy + 2 * k, 26 * k, 5 * k, 3134, 0.3),
    s('path', { class: 'g11-wood-face t31w-post', d: stroke([[mx, gy + 3 * k], [mx - 1 * k, gy - postH * 0.5], [mx + 0.5 * k, top]], 7 * k, 0.02, 0.02, 0.85), filter: 'url(#ink-rough)' }),
    s('path', { class: 'g11-wood-ink', d: stroke([[mx + 3 * k, gy], [mx + 3.2 * k, top + 6 * k]], 1.6 * k, 0.1, 0.1, 0.3) + stroke([[mx - 5 * k, top + 8 * k], [mx + 20 * k, top + 6 * k]], 3.6 * k, 0.05, 0.1, 0.5) + stroke([[mx + 1 * k, top + 26 * k], [mx + 11 * k, top + 8 * k]], 1.8 * k, 0.1, 0.1, 0.4), filter: 'url(#ink-rough)' }),
    s('g', { class: 't31w-lamp' }, paperLantern(mx + 15 * k, top + 7 * k, 9.5 * k, 3135, 6 * k)),
    grass(mx - 6 * k, gy + 4 * k, 20 * k, 3136))
}

/** Scene 1 — two village wells: GitHub keeps code, Hugging Face keeps models, data and demos. One item at a time. */
export function wellsScene(ctx: SceneCtx) {
  const items = K.items
  let i = 0
  const slipBox = h('div', { class: 't31w-slipbox' })
  const say = live('g11-say')
  const note = h('p', { class: 't31w-note', hidden: true }, K.note)
  const wells = K.wells.map((w, k) => {
    const tags = h('ul', { class: 't31w-tags' })
    const descId = `t31w-d-${w.id}`
    const art = wellArt(w.id, 3100 + k * 40)
    const btn = h('button', { class: 't31w-well', type: 'button', 'aria-describedby': descId, onClick: () => drop(w.id) },
      art,
      h('span', { class: 't31w-name' }, w.name),
      h('span', { class: 't31w-holds' }, w.holds),
      h('span', { class: 'visually-hidden', id: descId }, w.aria))
    return { w, btn, tags, art, el: h('div', { class: 't31w-col' }, btn, tags) }
  })
  const edge = s('svg', { class: 't31w-edge-art', 'aria-hidden': 'true' })
  const row = h('div', { class: 't31w-row' }, edge, ...wells.map((x) => x.el))
  const root = h('div', { class: 'g11 t31w', role: 'group', 'aria-label': K.aria },
    night({ low: true }),
    h('p', { class: 'visually-hidden' }, K.art),
    slipBox,
    row,
    say, note)
  ctx.art.append(root)
  ctx.onCleanup(onSize(row, () => {
    // read every box first, then draw
    const rb = row.getBoundingClientRect()
    const [a, b] = wells.map((x) => x.art.getBoundingClientRect())
    if (rb.width < 40 || a.height < 20) return
    paintEdge(edge, rb.width, a.top - rb.top, a.height, a, b, rb)
  }))

  let slip: HTMLElement | null = null
  function showItem() {
    slip?.remove()
    slip = null
    const it = items[i]
    if (it) {
      slip = h('p', { class: 't31w-slip g11-dopaper' }, it.label)
      slipBox.append(slip)
    }
    for (const x of wells) x.btn.setAttribute('aria-label', it ? fill(K.itemAria, { item: it.aria, well: x.w.name }) : x.w.aria)
  }

  function drop(id: string) {
    const it = items[i]
    if (!it) return
    if (it.well !== id) {
      ctx.chime('low')
      say.say(h('span', { class: 'bad' }, K.wrong))
      if (slip && !ctx.reduced) {
        slip.classList.remove('g11-shake')
        void slip.offsetWidth // restart the shake
        slip.classList.add('g11-shake')
      }
      return
    }
    ctx.chime('tap')
    const x = wells.find((v) => v.w.id === id)!
    x.tags.append(h('li', { class: 'g11-dopaper' }, it.label))
    x.btn.classList.remove('dip')
    void x.btn.offsetWidth
    x.btn.classList.add('dip')
    i++
    showItem()
    if (i < items.length) return say.say(K.right)
    say.say(K.done)
    note.hidden = false
    for (const v of wells) v.btn.classList.add('full')
    ctx.insight(K.insight as Fact, K.detail as Fact)
  }

  showItem()
  ctx.prompt(K.prompt)
}
