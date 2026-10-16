import raw from '../../content/tram-31.json'
import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { grass, paperLantern, steppingStones } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import { blob, cardSheet, curve, ground, live, night, plank, rng, stroke, type Pt } from './kit'

const K = raw.scenes.repo
type Repo = (typeof K.repos)[number]
const f1 = (n: number) => (Math.round(n * 10) / 10).toString()

/** Several short brushed lines [x0, y0, x1, y1] as one path. */
const lines = (ls: number[][], w: number) => ls.map(([a, b, c, d]) => stroke([[a, b], [c, d]], w, 0.15, 0.15, 0.4)).join('')

/** A shōji panel (x, y, w, h): paper (lit or dark) behind a brushed lattice. */
function shoji(x: number, y: number, w: number, hh: number, lit: boolean, cls = '') {
  const ls: number[][] = []
  for (let k = 1; k < 3; k++) ls.push([x + (w * k) / 3, y + 1, x + (w * k) / 3, y + hh - 1])
  for (let k = 1; k < 4; k++) ls.push([x + 1, y + (hh * k) / 4, x + w - 1, y + (hh * k) / 4])
  return s('g', { class: cls },
    s('rect', { class: lit ? 't31r-paper lit' : 't31r-paper', x: f1(x), y: f1(y), width: f1(w), height: f1(hh) }),
    s('path', { class: 'g11-wash t31r-lattice', d: lines(ls, 0.9) }),
    s('path', { class: 'g11-wash t31r-jamb', d: lines([[x, y, x + w, y], [x, y + hh, x + w, y + hh], [x, y, x, y + hh], [x + w, y, x + w, y + hh]], 1.8), filter: 'url(#ink-rough)' }))
}

/** A cobweb anchored in a corner (x, y) opening toward (dx, dy). */
function web(x: number, y: number, dx: number, dy: number, R: number) {
  let d = ''
  const spokes = 5
  for (let i = 0; i < spokes; i++) {
    const a = (i / (spokes - 1)) * (Math.PI / 2)
    d += `M${f1(x)} ${f1(y)}L${f1(x + dx * Math.cos(a) * R)} ${f1(y + dy * Math.sin(a) * R)}`
  }
  for (const k of [0.35, 0.6, 0.85]) {
    const pts = Array.from({ length: spokes }, (_, i) => { const a = (i / (spokes - 1)) * (Math.PI / 2); return [x + dx * Math.cos(a) * R * k, y + dy * Math.sin(a) * R * k] as Pt })
    d += `M${pts.map(([px, py]) => `${f1(px)} ${f1(py)}`).join('L')}`
  }
  return s('path', { class: 't31r-web', d })
}

/**
 * A wooden house on the stone path under the moon (viewBox 0 0 220 170). The cared-for one: lamps lit, porch swept, a
 * board of repairs, a straight name board. The copy, same shape: door shut, cobwebs, leaves, its name board carved askew.
 */
function houseArt(trust: boolean, seed: number): SVGSVGElement {
  const r = rng(seed)
  const roof = `M8 92Q20 96 34 92Q74 70 110 40Q146 70 186 92Q200 96 212 92Q212 100 200 104Q160 98 110 66Q60 98 20 104Q8 100 8 92Z`
  let tiles = ''
  for (let x = 30; x <= 190; x += 8) {
    const t = Math.abs(x - 110) / 80
    const y = 42 + t * 48
    tiles += stroke([[x, y + 2], [x + (x - 110) * 0.08, y + 14 - t * 4]], 1.2, 0.2, 0.3, 0.3)
  }
  let planks = ''
  for (let x = 48; x < 176; x += 7 + r() * 2) if (x < 88 || x > 132) planks += stroke([[x, 92], [x + 0.4, 138]], 0.8, 0.1, 0.1, 0.3)
  const posts = lines([[44, 88, 44, 142], [90, 88, 90, 140], [130, 88, 130, 140], [176, 88, 176, 142]], 3.6)
  const beam = stroke([[38, 90], [110, 89], [182, 90]], 3.4, 0.05, 0.05, 0.5)
  const name = s('g', { transform: trust ? '' : 'rotate(-6 110 80)' },
    s('rect', { class: 't31r-board', x: 98, y: 75, width: 24, height: 9, rx: 1 }),
    s('path', { class: 'g11-wash t31r-carve', d: lines(trust ? [[101, 79.5, 107, 79.5], [109, 79.5, 119, 79.5]] : [[101, 79.5, 107, 79.5], [109, 79.5, 113, 80.5], [113.5, 78.4, 119, 79.4]], 1.2) }))
  const g = s('svg', { class: `t31r-art${trust ? ' on' : ''}`, viewBox: '0 0 220 170', 'aria-hidden': 'true' },
    ground(112, 152, 104, 12, seed + 1, 0.22),
    // the wall: plaster between dark posts, plank cladding below the window line
    s('rect', { class: 't31r-wall', x: 44, y: 88, width: 132, height: 52 }),
    s('path', { class: 'g11-wash t31r-plank', d: planks }),
    shoji(52, 98, 30, 24, trust, 't31r-win'),
    // the door: lit and drawn half open, or shut dark
    trust
      ? s('g', null, s('rect', { class: 't31r-inside', x: 92, y: 94, width: 36, height: 46 }), shoji(92, 94, 18, 46, true), s('ellipse', { class: 't31r-spill', cx: 112, cy: 146, rx: 20, ry: 4 }))
      : s('g', null, s('rect', { class: 't31r-shut', x: 92, y: 94, width: 36, height: 46 }), s('path', { class: 'g11-wash t31r-lattice', d: lines([[110, 95, 110, 139], [93, 106, 127, 106], [93, 118, 127, 118], [93, 130, 127, 130]], 1) })),
    trust
      ? s('g', null, // the board of repairs, pinned papers
        s('rect', { class: 't31r-board', x: 138, y: 96, width: 30, height: 26, rx: 1 }),
        s('path', { class: 't31r-note', d: `M141 99h11v9h-11ZM154 99h11v13h-11ZM141 110h11v9h-11Z` }),
        s('path', { class: 'g11-wash t31r-carve', d: lines([[142.5, 102, 150, 102], [142.5, 105, 149, 105], [155.5, 102, 163, 102], [155.5, 105, 162, 105], [155.5, 108, 163, 108], [142.5, 113, 150, 113], [142.5, 116, 148, 116]], 0.8) }))
      : shoji(140, 98, 28, 24, false, 't31r-win'),
    s('path', { class: 'g11-wash t31r-post', d: posts + beam, filter: 'url(#ink-rough)' }),
    name,
    // the roof
    s('path', { class: 't31r-roof', d: roof, filter: 'url(#ink-wash)' }),
    s('path', { class: 't31r-tiles', d: tiles }),
    s('path', { class: 'g11-wash t31r-ridge', d: stroke(curve([8, 92], [74, 72], [110, 39], 12).concat(curve([110, 39], [146, 72], [212, 92], 12).slice(1)), 3, 0.05, 0.05, 0.4) + stroke([[20, 104], [60, 97], [110, 66], [160, 97], [200, 104]], 2, 0.08, 0.08, 0.4), filter: 'url(#ink-rough)' }),
    s('path', { class: 'g11-moonlit', d: stroke(curve([12, 91], [70, 71], [108, 41], 10), 1.6, 0.2, 0.3, 0.2) }),
    // the porch on stone footings, the step stones up to it
    plank(34, 140, 152, 6, seed + 2),
    s('path', { class: 't31r-foot', d: blob(48, 150, 7, 3.6, seed + 3, 0.2, 10) + blob(110, 150.5, 8, 3.6, seed + 4, 0.2, 10) + blob(172, 150, 7, 3.6, seed + 5, 0.2, 10), fill: 'url(#p2-rock)' }),
    steppingStones([112, 156], [104, 168], 2, 14, seed + 6))
  if (trust) {
    // lit lantern under the eave, a broom by the door
    g.append(
      paperLantern(190, 104, 6.5, seed + 7, 5),
      s('path', { class: 'g11-wash t31r-broom', d: stroke([[86, 104], [80, 139]], 1.4, 0.1, 0.1, 0.4) + lines([[80, 132, 76, 141], [80, 132, 79, 141.5], [81, 132, 82, 141], [81, 132, 85, 140.5]], 1) }))
  } else {
    // cobwebs, a cold lantern, leaves on the porch, weeds round the footings
    let leaves = ''
    for (let i = 0; i < 9; i++) {
      const x = 40 + r() * 140, y = 141 + r() * 3
      leaves += blob(x, y, 2 + r() * 1.5, 0.9 + r() * 0.6, seed + 20 + i, 0.3, 8)
    }
    g.append(
      web(45, 92, 1, 1, 16),
      web(175, 92, -1, 1, 12),
      web(129, 95, -1, 1, 9),
      s('g', { class: 't31r-cold' }, paperLantern(190, 104, 6.5, seed + 7, 5)),
      s('path', { class: 't31r-leaf', d: leaves }),
      grass(46, 152, 18, seed + 8), grass(116, 153, 16, seed + 9), grass(170, 152, 20, seed + 10))
  }
  return g
}

/** Scene 4 — two look-alike houses (repos): read six signals side by side, then choose the one to trust. */
export function repoScene(ctx: SceneCtx) {
  const say = live('g11-say t31r-say')
  const panel = live('t31r-panel')
  let picked = false
  const houses = K.repos.map((r) => {
    const val = h('p', { class: 't31r-val' })
    const pick = h('button', { class: 'g11-pill t31r-pick', type: 'button', 'aria-label': fill(K.pickAria, { name: r.name }), onClick: () => choose(r, el) }, K.pick)
    // both houses are built from the same seed: only their care differs
    const el = h('div', { class: 't31r-house' }, houseArt(r.trust, 3170), h('p', { class: 't31r-name' }, r.name), val, pick)
    return { r, el, val, pick }
  })
  const chips = K.signals.map((sg) => h('button', { class: 'g11-pill t31r-chip', type: 'button', 'aria-pressed': 'false', onClick: () => show(sg.id) }, sg.label))
  const root = h('div', { class: 'g11 g11-nomoon t31r', role: 'group', 'aria-label': K.aria },
    night({ low: true }),
    h('p', { class: 'visually-hidden' }, K.art),
    h('p', { class: 'g11-mock t31r-mock' }, K.mock),
    h('div', { class: 't31r-row' }, ...houses.map((x) => x.el)),
    h('div', { class: 't31r-chips' }, ...chips),
    panel, say)
  ctx.art.append(root)
  const sheet = cardSheet(root, K.takeaway, ctx.onCleanup)

  function show(id: string) {
    const sg = K.signals.find((x) => x.id === id)!
    chips.forEach((c, k) => c.setAttribute('aria-pressed', String(K.signals[k].id === id)))
    for (const x of houses) x.val.textContent = (x.r.values as Record<string, string>)[id]
    panel.say(h('p', null, h('strong', null, sg.label), ' — ', sg.what), h('p', { class: 'visually-hidden' }, houses.map((x) => `${x.r.name}: ${(x.r.values as Record<string, string>)[id]}`).join('. ')))
    ctx.chime('tap')
  }

  function choose(r: Repo, el: HTMLElement) {
    for (const x of houses) x.el.classList.toggle('picked', x.el === el)
    say.say(r.trust ? K.right : h('span', { class: 'bad' }, K.wrong))
    ctx.chime(r.trust ? 'ok' : 'low')
    root.classList.add('judged')
    if (picked) return
    picked = true
    ctx.insight(K.insight as Fact, K.detail as Fact)
    sheet.show()
  }
  ctx.prompt(K.prompt)
}
