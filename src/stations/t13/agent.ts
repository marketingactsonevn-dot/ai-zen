import { h, nextId, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { C } from './data'
import { blob, rng, scribble, spline, stroke, type Pt } from './ink'
import { formula, type ArtApi, type Kit } from './kit'

const S = C.scenes.agent
const W = S.words
// slot order: 0 mục tiêu · 1 khi nào xong · 2 được làm gì · 3 phải hỏi trước · 4 để kết quả ở đâu
const CLS = ['s-goal', 's-done', 's-allow', 's-ask', 's-store']
const VW = 480
const VH = 300
const HOME: Pt = [46, 154]
const NOTES: Pt[] = [[152, 98], [198, 196], [246, 94], [290, 196], [330, 108]]
const BOX: Pt = [336, 206]
const GATE: Pt = [402, 124]
const TEAM: Pt = [446, 128]
const SEG = 14
const ROUTE: Pt[] = [HOME, [98, 152], ...NOTES, [BOX[0] - 8, BOX[1] - 24], [GATE[0] - 12, GATE[1] + 2]]
const FENCE = { x: 94, y: 42, w: 292, h: 218, r: 36 }
/** sand features the rake goes around: [cx, cy, rings] */
const ISLANDS: [number, number, number][] = [[HOME[0], HOME[1] + 6, 26], [448, 254, 24], [58, 46, 20], [TEAM[0], TEAM[1] + 6, 28]]

const cls = (c: string) => ({ class: c })

/** Points around the fence's rounded rectangle, clockwise from the left-middle, with gaps (entrance left, gate right). */
function fencePts() {
  const { x, y, w, h: hh, r } = FENCE
  const arc = (out: Pt[], cx: number, cy: number, a0: number) => {
    for (let i = 0; i <= 6; i++) {
      const a = a0 + (i / 6) * (Math.PI / 2)
      out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
    }
  }
  const top: Pt[] = [[x, y + hh / 2 - 20]]
  arc(top, x + r, y + r, Math.PI)
  arc(top, x + w - r, y + r, -Math.PI / 2)
  top.push([x + w, GATE[1] - 22])
  const bot: Pt[] = [[x + w, GATE[1] + 22]]
  arc(bot, x + w - r, y + hh - r, 0)
  arc(bot, x + r, y + hh - r, Math.PI / 2)
  bot.push([x, y + hh / 2 + 20])
  return [top, bot]
}

/** A sparse bamboo fence (yotsume-gaki): few thick tapered posts, two long rails with nodes. */
function fence(pts: Pt[], r: () => number) {
  const g = s('g', null)
  const dense = spline(pts, (pts.length - 1) * 6)
  g.append(s('path', { class: 'fshadow', d: stroke(dense.map(([x, y]) => [x + 2, y + 5] as Pt), 7, { head: 0.04, tail: 0.1, min: 0.6, seg: 2 }), filter: 'url(#ink-wash)' }))
  for (const dy of [-5, 0]) {
    g.append(s('path', { class: 'f-rail', d: stroke(dense.map(([x, y]) => [x, y + dy] as Pt), 1.5, { head: 0.03, tail: 0.08, min: 0.55, seg: 2 }) }))
  }
  // posts at even spacing along the line
  let acc = 40
  for (let i = 1; i < dense.length; i++) {
    const [ax, ay] = dense[i - 1]
    const [bx, by] = dense[i]
    acc += Math.hypot(bx - ax, by - ay)
    if (acc < 44 && i < dense.length - 1) continue
    acc = 0
    const lean = (r() - 0.5) * 1.6
    g.append(
      s('path', { class: 'post', d: stroke([[bx, by + 5], [bx + lean * 0.5, by - 4], [bx + lean, by - 11]], 4.6, { head: 0.1, tail: 0.3, min: 0.6 }) }),
      s('path', { class: 'post-node', d: stroke([[bx - 2.2, by - 3], [bx + 2.4, by - 3.4]], 1.1, { head: 0.3, tail: 0.5 }) }),
      s('path', { class: 'post-cap', d: blob(bx + lean, by - 11, 2.3, 1.2, i, 0.1, 8) }))
  }
  return g
}

/** A ring raked around a feature: a brushed loop, not quite closed. */
function rakeRing(cx: number, cy: number, rx: number, seed: number) {
  const r = rng(seed)
  const a0 = r() * 6.28
  const pts: Pt[] = Array.from({ length: 25 }, (_, i) => {
    const a = a0 + (i / 24) * Math.PI * 1.94
    const k = 1 + Math.sin(a * 3 + seed) * 0.02
    return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * rx * 0.52 * k]
  })
  return stroke(pts, 1.5, { head: 0.06, tail: 0.3, min: 0.35, seg: 4 })
}

/** A garden rock in ink: wash shadow, body, lit top, dark belly, ragged rim. */
function rock(x: number, y: number, rx: number, ry: number, seed: number) {
  const body = blob(x, y, rx, ry, seed, 0.14, 16)
  return s('g', cls('a-rock'),
    s('path', { class: 'under', d: blob(x + 3, y + ry * 0.7, rx * 1.15, ry * 0.45, seed + 1, 0.12), filter: 'url(#ink-wash)' }),
    s('path', { class: 'rock-b', d: body }),
    s('path', { class: 'rock-hi', d: blob(x - rx * 0.25, y - ry * 0.35, rx * 0.5, ry * 0.3, seed + 2, 0.2, 12) }),
    s('path', { class: 'rock-lo', d: stroke([[x - rx * 0.8, y + ry * 0.25], [x, y + ry * 0.85], [x + rx * 0.85, y + ry * 0.1]], ry * 0.5, { head: 0.2, tail: 0.6, min: 0.2 }) }),
    s('path', { class: 'rock-rim', d: body, filter: 'url(#ink-rough)' }))
}

/** A standing stone (one member of the team): upright, tapered, in ink. */
function standing(x: number, base: number, hgt: number, w: number, seed: number) {
  const r = rng(seed)
  const lean = (r() - 0.5) * 4
  const d = `M${x - w / 2} ${base} C${x - w / 2 - 1} ${base - hgt * 0.5} ${x - w * 0.35 + lean} ${base - hgt} ${x + lean} ${base - hgt}` +
    ` C${x + w * 0.4 + lean} ${base - hgt} ${x + w / 2 + 1} ${base - hgt * 0.45} ${x + w / 2} ${base} Q${x} ${base + 2} ${x - w / 2} ${base}Z`
  return s('g', cls('mate'),
    s('path', { class: 'under', d: blob(x + 3, base + 1, w * 0.9, 2.6, seed, 0.1), filter: 'url(#ink-wash)' }),
    s('path', { class: 'mate-b', d }),
    s('path', { class: 'mate-hi', d: stroke([[x - w * 0.22 + lean * 0.6, base - hgt * 0.82], [x - w * 0.28, base - hgt * 0.4]], w * 0.32, { head: 0.3, tail: 0.6, min: 0.2 }) }),
    s('path', { class: 'mate-rim', d, filter: 'url(#ink-rough)' }))
}

function buildArt(k: Kit): ArtApi {
  const ctx = k.ctx
  const id = nextId('t13a')
  const r = rng(23)

  // ── the sand bed and its raking: wavy brushed furrows that part around each feature in rings
  const mask = s('mask', { id: `${id}-rake`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: VW, height: VH },
    s('rect', { x: 0, y: 0, width: VW, height: VH, fill: '#fff' }),
    ...ISLANDS.map(([x, y, rr]) => s('ellipse', { cx: x, cy: y, rx: rr + 4, ry: (rr + 4) * 0.52, fill: '#000' })))
  const defs = s('defs', null, mask,
    s('clipPath', { id: `${id}-bed` }, s('rect', { x: 16, y: 16, width: VW - 32, height: VH - 32, rx: 22 })),
    s('radialGradient', { id: `${id}-halo` },
      s('stop', { offset: 0, class: 'halo0' }),
      s('stop', { offset: 1, class: 'halo1' })))
  // a rake has three tines: furrows come in bands of three that sway together, each groove with a lit ridge under it
  const grooves = s('g', null)
  for (let y = 26, b = 0; y < VH - 20; y += 17, b++) {
    const ph = b * 0.9
    for (let j = 0; j < 3; j++) {
      const pts: Pt[] = []
      for (let x = 18; x <= VW - 18; x += 20) pts.push([x, y + j * 4.4 + Math.sin(x * 0.018 + ph) * 2.2 + Math.sin(x * 0.051 + ph * 2) * 0.6])
      grooves.append(s('path', { d: stroke(pts, 1.1, { head: 0.02, tail: 0.05, min: 0.45, seg: 3 }) }))
    }
  }
  const ridges = grooves.cloneNode(true) as SVGGElement
  ridges.setAttribute('class', 'ridges')
  ridges.setAttribute('transform', 'translate(0 1.3)')
  const furrows = s('g', { class: 'furrows', mask: `url(#${id}-rake)`, 'clip-path': `url(#${id}-bed)` }, ridges, grooves)
  const rings = s('g', { class: 'rings' })
  ISLANDS.forEach(([x, y, rr], j) => {
    for (let i = 0; i < 3; i++) rings.append(s('path', { d: rakeRing(x, y, rr - i * 7, j * 10 + i) }))
  })
  const bed = s('g', { class: 'bed' },
    s('rect', { class: 'bed-sh', x: 20, y: 24, width: VW - 32, height: VH - 32, rx: 24, filter: 'url(#ink-wash)' }),
    s('rect', { class: 'bed-f', x: 16, y: 16, width: VW - 32, height: VH - 32, rx: 22 }),
    furrows, rings,
    // the bed's brushed edge: four strokes that do not quite meet, moss where they would
    s('path', { class: 'edge', d: stroke([[44, 16.5], [240, 15.5], [438, 17]], 2.2, { head: 0.06, tail: 0.5, min: 0.3 }), filter: 'url(#ink-rough)' }),
    s('path', { class: 'edge', d: stroke([[40, 283.5], [250, 284.6], [444, 283]], 2.8, { head: 0.04, tail: 0.6, min: 0.3 }), filter: 'url(#ink-rough)' }),
    s('path', { class: 'edge', d: stroke([[16.5, 44], [15.5, 150], [17, 258]], 2, { head: 0.06, tail: 0.5, min: 0.3 }), filter: 'url(#ink-rough)' }),
    s('path', { class: 'edge', d: stroke([[463.5, 40], [464.5, 160], [463, 262]], 2, { head: 0.06, tail: 0.5, min: 0.3 }), filter: 'url(#ink-rough)' }),
    s('path', { class: 'mosspatch', d: blob(30, 30, 28, 18, 4, 0.3), filter: 'url(#ink-wash)' }),
    s('path', { class: 'mosspatch', d: blob(36, 272, 40, 17, 9, 0.3), filter: 'url(#ink-wash)' }),
    s('path', { class: 'mosspatch', d: blob(458, 22, 22, 12, 6, 0.3), filter: 'url(#ink-wash)' }),
    s('path', { class: 'mosspatch is-deep', d: blob(66, 266, 14, 7, 2, 0.25), filter: 'url(#ink-wash)' }),
    rock(58, 44, 13, 9, 3), rock(448, 252, 15, 10, 8), rock(462, 268, 7, 5, 12))

  // ── the agent's home: a small stone lantern (tōrō), its window warm
  const [lx, ly] = HOME
  const lantern = s('g', { class: 'lantern' },
    s('path', { class: 'under', d: blob(lx + 4, ly + 10, 17, 4, 2, 0.1), filter: 'url(#ink-wash)' }),
    s('path', { class: 'lt-stone', d: `M${lx - 9} ${ly + 9} L${lx + 9} ${ly + 9} L${lx + 7} ${ly + 5} L${lx - 7} ${ly + 5}Z` }),
    s('path', { class: 'lt-stone', d: `M${lx - 3} ${ly + 5} L${lx + 3} ${ly + 5} L${lx + 2.4} ${ly - 8} L${lx - 2.4} ${ly - 8}Z` }),
    s('path', { class: 'lt-stone', d: `M${lx - 8} ${ly - 8} L${lx + 8} ${ly - 8} L${lx + 6} ${ly - 11} L${lx - 6} ${ly - 11}Z` }),
    s('rect', { class: 'lt-box', x: lx - 6, y: ly - 22, width: 12, height: 11, rx: 0.8 }),
    s('rect', { class: 'lt-win', x: lx - 3, y: ly - 20, width: 6, height: 7 }),
    s('path', { class: 'lt-roof', d: `M${lx - 15} ${ly - 21} Q${lx - 8} ${ly - 24} ${lx - 4} ${ly - 30} L${lx + 4} ${ly - 30} Q${lx + 8} ${ly - 24} ${lx + 15} ${ly - 21} Q${lx} ${ly - 24} ${lx - 15} ${ly - 21}Z` }),
    s('path', { class: 'lt-stone', d: blob(lx, ly - 32.5, 2.6, 2.6, 5, 0.1, 8) }),
    s('path', { class: 'ink-s', d: stroke([[lx - 15, ly - 21], [lx - 6, ly - 25], [lx - 3.5, ly - 30.5]], 1.6, { head: 0.1, tail: 0.5 }) }),
    s('path', { class: 'ink-s', d: stroke([[lx + 15, ly - 21], [lx + 6, ly - 25], [lx + 3.5, ly - 30.5]], 1.6, { head: 0.1, tail: 0.5 }) }),
    s('path', { class: 'ink-s', d: stroke([[lx - 9, ly + 9.4], [lx + 9, ly + 9.4]], 2.2, { head: 0.2, tail: 0.4 }) }),
    s('path', { class: 'ink-s', d: stroke([[lx - 2.6, ly - 8], [lx - 3, ly + 5]], 1.3, { head: 0.2, tail: 0.4 }) }))

  // ── what the agent works on: five feedback slips scattered on the sand
  const notes = NOTES.map(([x, y], i) => {
    const rot = (r() - 0.5) * 34
    return s('g', { class: 'note', transform: `translate(${x} ${y}) rotate(${rot.toFixed(1)})` },
      s('path', { class: 'under', d: blob(2, 4, 13, 7, i, 0.1), filter: 'url(#ink-wash)' }),
      s('path', { class: 'note-p', d: `M-11 -8 L11 -8.6 L11.6 7.6 L-10.6 8.2Z` }),
      s('path', { class: 'scr', d: scribble(-7, -2, 8, i * 3, 1.5) }),
      s('path', { class: 'scr', d: scribble(-7, 3.6, 3, i * 3 + 1, 1.5) }))
  })

  // ── Mục tiêu: a path of stepping stones through the slips, a vermilion pennant at the end
  const dense = spline(ROUTE, (ROUTE.length - 1) * SEG)
  const steps = s('g', { class: 'steps' })
  let acc = 0
  for (let i = 1; i < dense.length; i++) {
    acc += Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1])
    if (acc > 19) {
      acc = 0
      const [x, y] = dense[i]
      const rx = 5.2 + r() * 1.8
      steps.append(
        s('path', { class: 'under', d: blob(x + 1.2, y + 2, rx, 2.2, i + 3, 0.1, 10) }),
        s('path', { class: 'step', d: blob(x, y, rx, 3.4 + r() * 1.2, i, 0.16, 10) }))
    }
  }
  const [bx, by] = BOX
  const flag = s('g', { class: 'goal-flag' },
    s('path', { class: 'ink-s', d: stroke([[bx - 30, by + 4], [bx - 30.5, by - 12], [bx - 30, by - 24]], 1.8, { head: 0.1, tail: 0.3, min: 0.6 }) }),
    s('path', { class: 'flag', d: stroke([[bx - 29, by - 23], [bx - 22, by - 21.5], [bx - 16, by - 21]], 5, { head: 0.05, tail: 1.6, min: 0.05 }) }))

  // ── Khi nào xong: five pebbles that light as the five main points are found
  const pebbles = Array.from({ length: 5 }, (_, i) => s('path', { class: 'peb', d: blob(bx - 26 + i * 13, by - 42 + (i % 2) * 2, 4.4, 3.2, i + 40, 0.15, 10) }))
  const done = s('g', { class: 'done' }, ...pebbles)

  // ── Được làm gì: a bamboo fence around what it may touch, and the two things it may read
  const [ftop, fbot] = fencePts()
  const letters = s('g', { transform: 'translate(122 112) rotate(-6)' },
    s('path', { class: 'under', d: blob(2, 5, 13, 5, 3, 0.1), filter: 'url(#ink-wash)' }),
    s('path', { class: 'paper', d: 'M-9 -4.6 L11 -6.4 L12 6.4 L-8 8Z' }),
    s('path', { class: 'paper', d: 'M-11 -6.6 L9 -8 L10 5 L-10 6.4Z' }),
    s('path', { class: 'ink-s', d: stroke([[-10.6, -6.4], [-0.6, 0.6], [9.2, -7.6]], 1.3, { head: 0.15, tail: 0.5, min: 0.3 }) }),
    s('path', { class: 'seal-s', d: blob(-0.4, 0.8, 1.8, 1.6, 2, 0.1, 8) }))
  const ledger = s('g', { transform: 'translate(124 190) rotate(5)' },
    s('path', { class: 'under', d: blob(2, 8, 13, 5, 7, 0.1), filter: 'url(#ink-wash)' }),
    s('path', { class: 'paper', d: 'M-9 -10 L10 -10.6 L10.6 10 L-8.6 10.6Z' }),
    s('path', { class: 'ink-s', d: stroke([[-6, -10.2], [-5.6, 10.4]], 1.2, { head: 0.1, tail: 0.3, min: 0.5 }) }),
    ...[-6, -1, 4].map((y) => s('circle', { class: 'stitch', cx: -7.6, cy: y, r: 0.7 })),
    ...[-5, 0, 5].map((y) => s('path', { class: 'scr', d: `M-3 ${y}H8` })),
    s('path', { class: 'scr', d: 'M2.5 -8V8' }))
  const allow = s('g', { class: 'allow' }, fence(ftop, r), fence(fbot, r), s('g', { class: 'toolset' }, letters, ledger))

  // ── Phải hỏi trước: a gate with a vermilion bell before anything leaves the garden
  const [gx, gy] = GATE
  const bell = s('g', { class: 'bell' },
    s('path', { class: 'bell-cord', d: `M${gx} ${gy - 22}V${gy - 15}` }),
    s('path', { class: 'bell-b', d: `M${gx - 4.6} ${gy - 7} Q${gx - 5} ${gy - 15.5} ${gx} ${gy - 15.5} Q${gx + 5} ${gy - 15.5} ${gx + 4.6} ${gy - 7} Q${gx} ${gy - 5.6} ${gx - 4.6} ${gy - 7}Z` }))
  const bellRip = s('ellipse', { class: 'bell-rip', cx: gx, cy: gy - 9, rx: 8, ry: 8 })
  const gate = s('g', { class: 'gate' },
    s('path', { class: 'under', d: blob(gx + 3, gy + 23, 18, 3.4, 4, 0.1), filter: 'url(#ink-wash)' }),
    s('path', { class: 'ink-s', d: stroke([[gx - 10, gy + 22], [gx - 9.6, gy], [gx - 9, gy - 23]], 3.6, { head: 0.04, tail: 0.15, min: 0.65 }), filter: 'url(#ink-rough)' }),
    s('path', { class: 'ink-s', d: stroke([[gx + 10, gy + 22], [gx + 9.6, gy], [gx + 9, gy - 23]], 3.6, { head: 0.04, tail: 0.15, min: 0.65 }), filter: 'url(#ink-rough)' }),
    s('path', { class: 'ink-s', d: stroke([[gx - 19, gy - 29], [gx - 8, gy - 26], [gx + 8, gy - 26], [gx + 19, gy - 30]], 4.4, { head: 0.1, tail: 0.4, min: 0.35 }) }),
    s('path', { class: 'ink-s', d: stroke([[gx - 13, gy - 19], [gx + 13, gy - 19.5]], 1.8, { head: 0.2, tail: 0.4 }) }),
    bell, bellRip)

  // ── Để kết quả ở đâu: a small wooden box; outside the gate, the team as three standing stones
  const box = s('g', { class: 'box' },
    s('path', { class: 'under', d: blob(bx + 4, by + 13, 22, 4, 6, 0.1), filter: 'url(#ink-wash)' }),
    s('path', { class: 'box-f', d: `M${bx - 16} ${by - 3} L${bx + 14} ${by - 3} L${bx + 14} ${by + 12} L${bx - 16} ${by + 12}Z` }),
    s('path', { class: 'box-s', d: `M${bx + 14} ${by - 3} L${bx + 19} ${by - 8} L${bx + 19} ${by + 7} L${bx + 14} ${by + 12}Z` }),
    s('path', { class: 'box-top', d: `M${bx - 16} ${by - 3} L${bx - 11} ${by - 8} L${bx + 19} ${by - 8} L${bx + 14} ${by - 3}Z` }),
    s('path', { class: 'grain', d: `M${bx - 13} ${by + 2.5}Q${bx} ${by + 1} ${bx + 11} ${by + 3}M${bx - 13} ${by + 7.5}Q${bx - 2} ${by + 6} ${bx + 11} ${by + 8}` }),
    s('path', { class: 'ink-s', d: stroke([[bx - 16, by - 3], [bx - 16, by + 12], [bx + 14, by + 12.4], [bx + 14, by - 3]], 1.5, { head: 0.08, tail: 0.3, min: 0.5 }) }),
    s('path', { class: 'ink-s', d: stroke([[bx - 16, by - 3], [bx - 11, by - 8], [bx + 19, by - 8], [bx + 19, by + 7], [bx + 14, by + 12]], 1.1, { head: 0.1, tail: 0.4, min: 0.4 }) }),
    s('text', { class: 'lbl lab', x: bx + 1, y: by + 28, 'text-anchor': 'middle' }, W.folder))
  const report = s('g', { class: 'report', opacity: 0 }, s('rect', { class: 'note-p', x: -6, y: -8, width: 12, height: 16, rx: 0.8 }), s('path', { class: 'scr', d: 'M-3.5 -3.5H3.5M-3.5 0H3.5M-3.5 3.5H1.5' }))
  const [tx, ty] = TEAM
  const team = s('g', { class: 'team' },
    s('ellipse', { class: 'team-glow', cx: tx, cy: ty + 6, rx: 26, ry: 10, filter: 'url(#ink-wash)' }),
    standing(tx - 11, ty + 8, 18, 9, 3), standing(tx + 1, ty + 4, 25, 10, 7), standing(tx + 12, ty + 9, 14, 8.5, 11),
    s('text', { class: 'lbl lab', x: tx, y: ty + 27, 'text-anchor': 'middle' }, W.team))
  const letter = s('g', { class: 'letter', opacity: 0 }, s('path', { class: 'paper', d: 'M-6 -4 L6 -4.4 L6.4 4 L-5.6 4.4Z' }), s('path', { class: 'ink-s', d: stroke([[-5.8, -4], [0, 0.6], [6, -4.3]], 1, { head: 0.2, tail: 0.5, min: 0.3 }) }))

  // ── the agent: a small vermilion light
  const qs = s('g', { class: 'qs' }, s('text', { x: 9, y: -8 }, '?'), s('text', { x: -14, y: -4 }, '?'))
  const agent = s('g', { class: 'agent', transform: `translate(${HOME[0]} ${HOME[1] - 16})` },
    s('circle', { r: 16, fill: `url(#${id}-halo)` }),
    s('circle', { class: 'core', r: 3.6 }),
    qs)

  const svg = s('svg', { class: 't13-art t13a', viewBox: `0 0 ${VW} ${VH}`, role: 'img', 'aria-label': S.artLabel },
    defs, bed, s('g', { class: 'goal' }, steps, flag), allow, gate, done, box, team, lantern, ...notes, report, letter, agent)

  // the ask bubble and run button live over the picture
  const live = h('p', { class: 'visually-hidden', 'aria-live': 'polite' })
  const ask = h('div', { class: 't13a-ask', hidden: true, role: 'group', 'aria-label': W.ask },
    h('p', null, W.ask),
    h('div', { class: 't13a-ask-btns' },
      h('button', { class: 't13-btn is-warm', type: 'button', onClick: () => ctx.anim(() => answer(true)) }, W.yes),
      h('button', { class: 't13-btn', type: 'button', onClick: () => ctx.anim(() => answer(false)) }, W.no)))
  const runBtn = h('button', { class: 't13-btn is-warm t13a-run', type: 'button', hidden: true, onClick: () => ctx.anim(run) }, h('span', { class: 'dot', 'aria-hidden': 'true' }), W.run)
  k.stage.append(svg, ask, live)
  k.extra.append(runBtn)

  // map viewBox points to stage pixels (meet scaling)
  const toStage = ([x, y]: Pt) => {
    const sw = k.stage.clientWidth
    const sh = k.stage.clientHeight
    const sc = Math.min(sw / VW, sh / VH)
    return [(sw - VW * sc) / 2 + x * sc, (sh - VH * sc) / 2 + y * sc]
  }
  // the question sits above the gate when there is room; on small screens it docks to the bottom of the picture
  function placeAsk() {
    if (ask.hidden) return
    const small = k.root.classList.contains('is-port') || k.root.classList.contains('is-short')
    ask.classList.toggle('is-dock', small)
    ask.classList.remove('is-below')
    if (small) {
      ask.style.left = ask.style.top = ''
      return
    }
    const sw = k.stage.clientWidth
    const bw = ask.offsetWidth
    const bh = ask.offsetHeight
    let [x, y] = toStage([gx, gy - 34])
    if (y < bh + 8) {
      ask.classList.add('is-below')
      y = toStage([gx, gy + 28])[1]
    }
    x = Math.min(Math.max(x, bw / 2 + 8), sw - bw / 2 - 8)
    ask.style.left = `${x}px`
    ask.style.top = `${y}px`
  }
  const ro = new ResizeObserver(() => requestAnimationFrame(placeAsk))
  ro.observe(k.stage)

  // ── idle: no goal → it wanders (inside the fence once it has one); with a goal it rests by the lantern
  let wander: gsap.core.Tween | null = null
  let qTween: gsap.core.Tween | null = null
  let state: 'idle' | 'wander' | 'run' | 'ask' | 'end' = 'idle'
  const pos = { x: HOME[0], y: HOME[1] - 16 }
  const place = () => agent.setAttribute('transform', `translate(${pos.x.toFixed(1)} ${pos.y.toFixed(1)})`)
  function stopWander() {
    wander?.kill()
    qTween?.kill()
    wander = qTween = null
    gsap.set(qs, { opacity: 0 })
  }
  function startWander(fenced: boolean) {
    stopWander()
    state = 'wander'
    if (ctx.reduced) {
      Object.assign(pos, fenced ? { x: 240, y: 150 } : { x: 430, y: 200 })
      place()
      gsap.set(qs, { opacity: 1 })
      return
    }
    const bx0 = fenced ? [FENCE.x + 18, FENCE.y + 18, FENCE.x + FENCE.w - 18, FENCE.y + FENCE.h - 18] : [26, 26, VW - 26, VH - 26]
    const hop = () => {
      wander = gsap.to(pos, {
        x: bx0[0] + Math.random() * (bx0[2] - bx0[0]),
        y: bx0[1] + Math.random() * (bx0[3] - bx0[1]),
        duration: 1.6 + Math.random() * 1.4,
        ease: 'sine.inOut',
        onUpdate: place,
        onComplete: hop,
      })
    }
    hop()
    qTween = gsap.fromTo(qs, { opacity: 0 }, { opacity: 0.9, duration: 1.1, yoyo: true, repeat: -1, ease: 'sine.inOut' })
  }
  function goHome(instant: boolean) {
    stopWander()
    state = 'idle'
    const to = { x: HOME[0], y: HOME[1] - 16 }
    if (instant) {
      Object.assign(pos, to)
      place()
    } else gsap.to(pos, { ...to, duration: 1.6, ease: 'power2.inOut', onUpdate: place })
  }

  // ── the run: along the stones, gather the slips (each lights a pebble), file the report, stop at the gate and ask
  let runTl: gsap.core.Timeline | null = null
  function resetRun() {
    runTl?.kill()
    runTl = null
    gsap.set(notes, { opacity: 1, scale: 1 })
    pebbles.forEach((p) => p.classList.remove('lit'))
    svg.classList.remove('is-filed', 'is-sent')
    gsap.set([report, letter], { opacity: 0 })
    ask.hidden = true
  }
  function run() {
    resetRun()
    stopWander()
    state = 'run'
    runBtn.hidden = true
    k.refit()
    const idx = (n: number) => n * SEG
    const tl = (runTl = gsap.timeline())
    const walk = (from: number, to: number, at?: number) => {
      const o = { i: from }
      tl.to(o, { i: to, duration: ctx.reduced ? 0 : Math.max(0.5, (to - from) / 24), ease: 'sine.inOut', onUpdate: () => {
        const p = dense[Math.round(o.i)]
        pos.x = p[0]
        pos.y = p[1] - 6
        place()
      } }, at)
    }
    walk(0, idx(1))
    NOTES.forEach((_, n) => {
      walk(idx(n + 1), idx(n + 2))
      tl.to(notes[n], { scale: 0, opacity: 0, duration: ctx.reduced ? 0 : 0.45, ease: 'power2.in', transformOrigin: '50% 50%' })
      tl.call(() => pebbles[n].classList.add('lit'))
    })
    walk(idx(NOTES.length + 1), idx(NOTES.length + 2))
    tl.fromTo(report, { opacity: 0, x: bx + 1, y: by - 34 }, { opacity: 1, y: by - 6, duration: ctx.reduced ? 0 : 0.7, ease: 'power2.in' })
    tl.to(report, { opacity: 0, duration: ctx.reduced ? 0 : 0.3 })
    tl.call(() => svg.classList.add('is-filed'))
    walk(idx(NOTES.length + 2), dense.length - 1)
    tl.call(() => {
      state = 'ask'
      if (!ctx.reduced) {
        gsap.fromTo(bell, { rotation: -14, svgOrigin: `${gx} ${gy - 22}` }, { rotation: 0, duration: 1.4, ease: 'elastic.out(1.2, 0.3)' })
        gsap.fromTo(bellRip, { attr: { rx: 6, ry: 6 }, opacity: 0.9 }, { attr: { rx: 30, ry: 30 }, opacity: 0, duration: 1.6, ease: 'power2.out' })
      }
      ctx.chime('tap')
      ask.hidden = false
      placeAsk()
      if (!ctx.reduced) gsap.from(ask, { opacity: 0, y: 8, duration: 0.6, ease: 'power3.out' })
      live.textContent = W.ask
      ;(ask.querySelector('button') as HTMLButtonElement).focus({ preventScroll: true })
    })
  }
  function answer(yes: boolean) {
    if (state !== 'ask') return
    state = 'end'
    ask.hidden = true
    const tl = gsap.timeline()
    if (yes) {
      tl.fromTo(letter, { opacity: 1, x: pos.x, y: pos.y }, { x: tx, y: ty - 26, duration: ctx.reduced ? 0 : 1.1, ease: 'power2.inOut' })
        .to(letter, { opacity: 0, duration: ctx.reduced ? 0 : 0.3 })
        .call(() => svg.classList.add('is-sent'))
    }
    tl.call(() => {
      live.textContent = yes ? W.sent : W.held
      runBtn.lastChild!.textContent = W.again
      runBtn.hidden = false
      k.refit()
      ctx.chime('ok')
      ctx.insight(S.insight, S.detail)
    })
    if (!yes) goHome(ctx.reduced)
  }

  return {
    update(on, vague, instant) {
      const v = (i: number) => !vague && on[i]
      CLS.forEach((c, i) => svg.classList.toggle(c, v(i)))
      svg.classList.toggle('is-vague', vague)
      if (state === 'run' || state === 'ask') {
        resetRun()
        goHome(true)
      }
      const all = on.every(Boolean) && !vague
      if (!v(0)) startWander(v(2))
      else if (state === 'wander' || state === 'idle') goHome(instant)
      runBtn.hidden = !(all && k.root.classList.contains('is-done')) || state === 'run'
      if (!all) resetRun()
      k.refit()
    },
    done() {
      // the run button itself is the call to action; no second 'run' prompt under the stones
      runBtn.hidden = false
      k.refit()
      if (!ctx.reduced) gsap.from(runBtn, { opacity: 0, y: 10, duration: 0.9, delay: 0.3, ease: 'power3.out' })
    },
    dispose() {
      ro.disconnect()
      stopWander()
      runTl?.kill()
    },
  }
}

export function agentScene(ctx: SceneCtx) {
  return formula(ctx, S, buildArt, { deferInsight: true })
}
