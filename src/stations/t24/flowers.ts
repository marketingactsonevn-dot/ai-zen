import { h, s } from '../../core/dom'
import type { SceneCtx } from '../types'
import { C } from './data'
import { alive, f1, put, rig, stage, tween } from './kit'
import { blob, clamp, curve, rng, stroke, type Pt } from '../../ui/part2/ink'
import { paperLantern, wash } from '../../ui/part2/paint'
import { grad, spline, taper } from './brush'

const K = C.scenes.flowers

// the sapling in tree units: origin = soil, x right, y up; two limbs end in the two flowers, a leader goes on up
const TRUNK: Pt[] = [[0, 0], [-0.03, 0.12], [0.014, 0.26], [-0.004, 0.4]]
const LIMB: Pt[][] = [
  [[0, 0.4], [-0.12, 0.5], [-0.27, 0.6], [-0.41, 0.68]],
  [[0, 0.4], [0.13, 0.49], [0.28, 0.585], [0.4, 0.66]],
]
const TOP = (top: number): Pt[] => [[0, 0.4], [0.03, 0.55], [0.005, (0.4 + top) / 2 + 0.08], [-0.03, top]]
// twigs: [chain (0, 1 limbs · 2 leader · 3 trunk), share along it, angle (deg, 0 = right, 90 = up), length]
const TWIGS: [number, number, number, number][] = [
  [0, 0.42, 128, 0.12], [0, 0.72, 72, 0.08], [0, 0.28, 205, 0.07],
  [1, 0.48, 52, 0.13], [1, 0.76, 108, 0.075], [1, 0.3, -18, 0.07],
  [2, 0.45, 150, 0.1], [2, 0.66, 32, 0.1], [2, 0.9, 112, 0.06],
  [3, 0.6, 165, 0.06],
]

/**
 * Scene 1 — eye level with a sapling in a celadon pot before a great shōji that glows cool with the moon behind it. An
 * ink hand reaches in with a paper lantern on a bamboo hook (the human grader): its warm light rims the tree and throws the
 * same branches onto the paper. Each flower holds a paper tanzaku with one answer. Bring the lantern to the flower you
 * prefer (or touch its slip): the tree leans to the light, the moon crosses the shōji again and again and the trunk grows
 * bent toward the reward. Then the hand withdraws and a scroll of principles lights the tree instead.
 */
export function flowersScene(ctx: SceneCtx) {
  let pick = -1
  let ruled = false
  let lean = 0 // degrees, + = right
  let grown = 0 // 0 young … 1 bent toward the reward
  const quick = ctx.reduced || ctx.quality === 'low'

  const { root } = stage(ctx, 't24f', K.art, [K.insight, K.constitution], draw)
  const host = h('div', { class: 't24f-host' })
  root.append(host)
  const R = rig(ctx, host, { strength: 2 })
  const svg = (cls: string) => s('svg', { class: `t24-svg ${cls}`, 'aria-hidden': 'true' })
  // far → near: the shōji (backlit paper, the moon behind it, the lantern's warm pool and the tree's shadow on it, the
  // lattice in front), the floor, the tree with its slips, the hand with the lantern
  const moonGlow = h('div', { class: 't24f-moon' }, h('i'))
  const lampGlow = h('div', { class: 't24f-lampglow' })
  const shadowSvg = svg('t24f-shadowart')
  const shadow = h('div', { class: 't24f-shadow' }, shadowSvg)
  const paperBox = h('div', { class: 't24f-paperbox' }, moonGlow, lampGlow, shadow)
  const latticeSvg = svg('t24f-lattice')
  const latLit = svg('t24f-latlit')
  const question = h('p', { class: 't24f-q' }, K.question)
  const leanLabel = h('p', { class: 't24f-lean', 'aria-hidden': 'true' }, h('span', null, K.lean))
  const wallSvg = svg('t24f-wall')
  R.layer(0.75, 't24f-l-wall').append(wallSvg, paperBox, latticeSvg, latLit, question, leanLabel)
  const floorSvg = svg('t24f-floor')
  const pool = h('div', { class: 't24f-pool' })
  R.layer(0.3, 't24f-l-floor').append(floorSvg, pool)
  // the tree, its two flowers and their tanzaku (each a choice), the scroll of principles that replaces the hand
  const potSvg = svg('t24f-pot')
  // the wood young and grown (crossfaded as whole layers), the warm rims (masked round the lantern), the flowers on top
  const youngSvg = svg('t24f-woodart')
  const oldSvg = svg('t24f-woodart old')
  const rimSvg = svg('t24f-rimart')
  const flowerSvg = svg('t24f-flowerart')
  const defs = s('defs', null,
    s('radialGradient', { id: 't24f-petal', cx: 0.5, cy: 0.5, r: 0.55 }, s('stop', { offset: 0, class: 't24f-pt0' }), s('stop', { offset: 0.3, class: 't24f-pt1' }), s('stop', { offset: 1, class: 't24f-pt2' })),
    s('radialGradient', { id: 't24f-bloomg' }, s('stop', { offset: 0, class: 't24f-bg0' }), s('stop', { offset: 0.35, class: 't24f-bg1' }), s('stop', { offset: 1, class: 't24f-bg2' })))
  const tans = K.options.map((o, i) => {
    const same = o.short === o.text
    return h('button', { class: `t24f-tan t${i}`, type: 'button', 'aria-pressed': 'false', 'aria-label': `${o.aria}: ${o.text}`, onClick: () => choose(i, true) },
      h('span', { class: 't24f-sway' },
        h('span', { class: 't24f-thread', 'aria-hidden': 'true' }),
        h('span', { class: `t24f-strip t24-paper${same ? ' same' : ''}`, 'aria-hidden': 'true' }, h('span', { class: 't24f-short' }, o.short), same ? null : h('span', { class: 't24f-full' }, o.text))))
  })
  const scroll = h('button', { class: 't24f-scroll', type: 'button', 'aria-label': K.swapAria, disabled: true, onClick: swap },
    h('span', { class: 't24f-cord', 'aria-hidden': 'true' }),
    h('span', { class: 't24f-roll', 'aria-hidden': 'true' }),
    h('span', { class: 't24f-band t24-paper', 'aria-hidden': 'true' }, K.swap),
    h('span', { class: 't24f-sheet t24-paper', 'aria-hidden': 'true' }, h('span', { class: 't24f-sheet-h' }, K.scroll), ...K.rules.map((r) => h('span', { class: 't24f-rule' }, r))))
  const treeBox = h('div', { class: 't24f-treebox' }, youngSvg, oldSvg, rimSvg, flowerSvg, scroll)
  const clockArt = s('svg', { class: 't24f-clockart', viewBox: '-80 -74 160 84', 'aria-hidden': 'true' })
  const clockHand = s('g', { class: 't24f-hand' })
  const clock = h('div', { class: 't24f-clock' }, clockArt, h('span', { class: 't24f-clock-t' }, K.repeat))
  R.layer(0, 't24f-l-tree').append(potSvg, treeBox, ...tans, clock)
  // the grader: an ink sleeve and hand holding a bamboo hook, the lantern hanging from it (the lantern is what you drag)
  const handSvg = s('svg', { class: 't24f-handart', viewBox: '0 0 1 1', 'aria-hidden': 'true' }) // a point: the hand is drawn round the hook and moved whole
  const lampSvg = s('svg', { class: 't24f-lampart' })
  const lamp = h('div', { class: 't24f-lamp', 'aria-hidden': 'true' }, lampSvg)
  R.layer(-0.18, 't24f-l-near').append(handSvg, lamp)
  ctx.prompt(K.prompt)
  alive(ctx, root)

  const G = { W: 0, H: 0, u: 0, tx: 0, soil: 0, base: 0, xs: 1, top: 0.84, wide: true, lx: 0, ly: 0, lr: 14, paper: [0, 0, 0, 0] as number[], tips: [[0, 0], [0, 0]] as Pt[], k: 1.38, sw: [92, 210] as number[] }
  const X = (x: number) => G.tx + x * G.u * G.xs // wide screens spread the two limbs apart
  const Y = (y: number) => G.soil - y * G.u
  /** where the light is: the lantern's body under its hook */
  const LX = () => G.lx
  const LY = () => G.ly + G.lr * 2.2

  function* draw(W: number, H: number) {
    const wide = W / H >= 1.05
    const u = wide ? Math.min(H * 0.62, W * 0.42) : Math.min(H * 0.54, W * 0.86)
    const tx = W / 2
    const base = H * (wide ? 0.86 : 0.85) // the floor line under the stone
    const soil = base - u * 0.22
    Object.assign(G, { W, H, u, tx, soil, base, wide, xs: wide ? 1.3 : 0.8, top: wide ? 0.84 : 0.93, lr: clamp(u * 0.048, 12, 19), sw: wide ? [92, 214] : [76, 154] })
    G.tips = [LIMB[0][3], LIMB[1][3]].map(([x, y]) => [X(x), Y(y)] as Pt)
    for (const el of [wallSvg, latticeSvg, latLit, shadowSvg, floorSvg, potSvg, youngSvg, oldSvg, rimSvg, flowerSvg]) el.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    R.layout(W, H, soil - u * 0.1)
    drawWall(W, H, base)
    yield
    drawFloor(W, H)
    yield
    // the low stone, the celadon pot
    const pw = u * 0.19, ph = u * 0.15
    potSvg.replaceChildren(
      s('defs', null, grad('t24f-glaze', 'linear', { x1: 0, y1: 0, x2: 1, y2: 0.25 }, [[0, 't24f-gl0'], [0.42, 't24f-gl1'], [1, 't24f-gl2']])),
      wash(blob(tx + u * 0.06, base + 3, u * 0.42, u * 0.03, 3, 0.15), 0.4, 'p2p-wash t24f-contact'),
      ...plinth(tx, base + u * 0.012, u * 0.36, u * 0.07),
      ...pot(tx, base - u * 0.05, pw, ph))
    yield
    drawTree()
    yield
    drawHand()
    if (!G.lx) setLamp(tx - u * (wide ? 0.2 : 0.12), Y(wide ? 0.74 : 0.8), false)
    else setLamp(G.lx, G.ly, false)
    // the moon clock: a carved stone on the floor at the right
    const cw = wide ? clamp(u * 0.5, 160, 210) : clamp(W * 0.44, 140, 160)
    clock.style.width = `${f1(cw)}px`
    clock.style.height = `${f1(cw * 0.525)}px`
    put(clock, wide ? tx + u * 0.48 : W - cw - 6, wide ? base - cw * 0.47 : base - cw * 0.3)
    drawClock()
    // the tanzaku under each flower; the furled scroll waits on the top twig
    tans.forEach((b, i) => {
      b.style.setProperty('--sw', `${f1(G.sw[0])}px`)
      b.style.setProperty('--so', `${f1(G.sw[1])}px`)
      b.style.setProperty('--th', `${f1(u * (i ? 0.07 : 0.05))}px`)
    })
    const [sx, sy] = [X(TOP(G.top)[3][0]), Y(G.top)]
    const sw = wide ? 156 : 132
    put(scroll, sx - sw / 2, sy - 4, sw)
    const pw0 = G.paper[2] - G.paper[0]
    const [mxk, myk] = wide ? [0.78, 0.22] : [0.74, 0.16]
    moonGlow.style.transform = `translate(${f1(pw0 * mxk)}px, ${f1((G.paper[3] - G.paper[1]) * myk)}px)`
    paperBox.style.setProperty('--mx', `${mxk * 100}%`)
    paperBox.style.setProperty('--my', `${myk * 100}%`)
    applyLean()
  }

  /** The shōji: posts, a lintel, sliding panels whose backlit paper glows cool; kumiko bars in front, a kick board below. */
  function drawWall(W: number, H: number, base: number) {
    const { wide } = G
    const px0 = wide ? W * 0.09 : -W * 0.02, px1 = wide ? W * 0.91 : W * 1.02
    const py0 = wide ? H * 0.05 : H * 0.07, py1 = base - H * 0.05
    G.paper = [px0, py0, px1, py1]
    Object.assign(paperBox.style, { left: `${f1(px0)}px`, top: `${f1(py0)}px`, width: `${f1(px1 - px0)}px`, height: `${f1(py1 - py0)}px` })
    Object.assign(shadow.style, { width: `${f1(W)}px`, height: `${f1(H)}px` })
    const r = rng(2401)
    const panels = wide ? 4 : 2
    const pw = (px1 - px0) / panels
    const sw = Math.max(5, W * (wide ? 0.007 : 0.014)) // stile
    const kick = (py1 - py0) * 0.13 // the koshi-ita, a wooden kick board at the foot of each panel
    let stiles = '', bars = '', lit = '', panes = '', kickD = '', grain = ''
    const cols = 3, rows = wide ? 6 : 7
    for (let p = 0; p < panels; p++) {
      const x0 = px0 + p * pw, x1 = x0 + pw
      stiles += `M${f1(x0)} ${f1(py0)}h${f1(sw)}V${f1(py1)}h${f1(-sw)}ZM${f1(x1 - sw)} ${f1(py0)}h${f1(sw)}V${f1(py1)}h${f1(-sw)}Z`
      stiles += `M${f1(x0)} ${f1(py0)}H${f1(x1)}v${f1(sw)}H${f1(x0)}Z`
      kickD += `M${f1(x0 + sw)} ${f1(py1 - kick)}H${f1(x1 - sw)}V${f1(py1)}H${f1(x0 + sw)}Z`
      for (let k = 0; k < 3; k++) {
        const y = py1 - kick + kick * (0.25 + k * 0.25) + (r() - 0.5) * 3
        grain += stroke([[x0 + sw + 4, y], [x1 - sw - 4, y + (r() - 0.5) * 3]], 1.2, 0.2, 0.2, 0.2)
      }
      // kumiko: hand-cut, a hair off true; the paper panes between them each a little different
      const ix0 = x0 + sw, ix1 = x1 - sw, iy0 = py0 + sw, iy1 = py1 - kick
      for (let c = 1; c < cols + 1; c++) {
        const x = ix0 + ((ix1 - ix0) * c) / (cols + 1) + (r() - 0.5) * 1.4
        bars += stroke([[x, iy0], [x + (r() - 0.5) * 1.2, iy1]], 2, 0.01, 0.01, 0.8)
        lit += `M${f1(x - 1.6)} ${f1(iy0)}V${f1(iy1)}`
      }
      for (let j = 1; j < rows; j++) {
        const y = iy0 + ((iy1 - iy0) * j) / rows + (r() - 0.5) * 1.4
        bars += stroke([[ix0, y], [ix1, y + (r() - 0.5) * 1.2]], 1.8, 0.01, 0.01, 0.8)
        lit += `M${f1(ix0)} ${f1(y - 1.4)}H${f1(ix1)}`
      }
      for (let c = 0; c <= cols; c++) for (let j = 0; j < rows; j++) {
        if (r() > 0.22) continue
        const cx0 = ix0 + ((ix1 - ix0) * c) / (cols + 1), cy0 = iy0 + ((iy1 - iy0) * j) / rows
        panes += `M${f1(cx0 + 2)} ${f1(cy0 + 2)}h${f1((ix1 - ix0) / (cols + 1) - 4)}v${f1((iy1 - iy0) / rows - 4)}h${f1(-((ix1 - ix0) / (cols + 1) - 4))}Z`
      }
    }
    // a patched pane: a petal-shaped repair, the classic mend of a torn shōji
    const pc = [px0 + pw * (wide ? 2.62 : 1.5), py0 + (py1 - py0) * 0.58]
    const patch = blob(pc[0], pc[1], 9, 8, 2402, 0.25, 10)
    wallSvg.replaceChildren(
      s('rect', { class: 't24f-wallfoot', x: f1(-W * 0.2), y: f1(py1), width: f1(W * 1.4), height: f1(base - py1 + 4) }),
      s('rect', { class: 't24f-lintel', x: f1(-W * 0.2), y: f1(-H * 0.2), width: f1(W * 1.4), height: f1(py0 + H * 0.2) }))
    latticeSvg.replaceChildren(
      s('path', { class: 't24f-pane', d: panes }),
      s('path', { class: 't24f-patch', d: patch }),
      s('path', { class: 't24f-kumiko', d: bars }),
      s('path', { class: 't24f-kick', d: kickD }),
      s('path', { class: 't24f-kick-grain', d: grain }),
      s('path', { class: 't24f-stile', d: stiles }),
      ...(wide ? [s('rect', { class: 't24f-post', x: f1(px0 - W * 0.06), y: f1(-H * 0.1), width: f1(W * 0.06), height: f1(base + H * 0.1) }), s('rect', { class: 't24f-post', x: f1(px1), y: f1(-H * 0.1), width: f1(W * 0.06), height: f1(base + H * 0.1) })] : []),
      s('rect', { class: 't24f-sill', x: f1(-W * 0.2), y: f1(py1 - 2), width: f1(W * 1.4), height: f1(H * 0.016) }))
    latLit.replaceChildren(s('path', { class: 't24f-kumiko-lit', d: lit }), s('path', { class: 't24f-stile-lit', d: stiles }))
    latLit.style.setProperty('--lr', `${f1(Math.max(W, H) * 0.4)}px`)
    // the question brushed on the paper, top middle; the lean written low on the paper where the shadow goes
    put(question, W / 2, py0 + (wide ? H * 0.04 : H * 0.03))
  }

  /** The floor: engawa boards toward the wall in perspective, the shōji's cool glow on them, the lantern's warm pool. */
  function drawFloor(W: number, H: number) {
    const r = rng(2401)
    const py1 = G.paper[3]
    let boards = '', grain = ''
    for (let i = -12; i <= 12; i++) {
      const xb = W / 2 + i * W * 0.1
      const xt = W / 2 + (xb - W / 2) * 0.6
      boards += `M${f1(xt)} ${f1(py1 + H * 0.016)}L${f1(xb)} ${f1(H * 1.05)}`
    }
    for (let i = 0; i < 34; i++) {
      const t = Math.pow(r(), 0.7)
      const y = py1 + H * 0.025 + t * (H - py1)
      const x = r() * W, l = 18 + r() * 60 * (0.5 + t)
      grain += stroke([[x, y], [x + l, y + (r() - 0.5) * 2]], 0.8 + t, 0.3, 0.3, 0.2)
    }
    floorSvg.replaceChildren(
      s('defs', null, grad('t24f-floorg', 'linear', { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, 't24f-fl0'], [1, 't24f-fl1']])),
      s('rect', { class: 't24f-floorbody', x: f1(-W * 0.3), y: f1(py1 + H * 0.014), width: f1(W * 1.6), height: f1(H), fill: 'url(#t24f-floorg)' }),
      s('path', { class: 't24f-boards', d: boards }),
      s('path', { class: 't24f-grain', d: grain }),
      // the shōji's cool glow lying on the boards (the lantern's warm pool is a layer of its own that follows it)
      s('ellipse', { class: 't24f-floorglow', cx: f1(W / 2), cy: f1(py1 + H * 0.04), rx: f1((G.paper[2] - G.paper[0]) * 0.55), ry: f1(H * 0.05), fill: 'url(#p2-halo)' }))
    Object.assign(pool.style, { width: `${f1(G.u * 2)}px`, height: `${f1(G.u * 0.5)}px` })
  }

  /** The low stone plinth the pot stands on: a slab with a lit top, a shaded front, a contact shadow. */
  function plinth(cx: number, y: number, w: number, hh: number): SVGElement[] {
    const top = `M${f1(cx - w)} ${f1(y - hh * 0.55)}Q${f1(cx)} ${f1(y - hh * 1.05)} ${f1(cx + w)} ${f1(y - hh * 0.6)}Q${f1(cx + w * 1.04)} ${f1(y - hh * 0.3)} ${f1(cx + w * 0.97)} ${f1(y - hh * 0.2)}Q${f1(cx)} ${f1(y - hh * 0.05)} ${f1(cx - w * 0.98)} ${f1(y - hh * 0.2)}Q${f1(cx - w * 1.04)} ${f1(y - hh * 0.35)} ${f1(cx - w)} ${f1(y - hh * 0.55)}Z`
    const face = `M${f1(cx - w * 0.98)} ${f1(y - hh * 0.2)}Q${f1(cx)} ${f1(y - hh * 0.05)} ${f1(cx + w * 0.97)} ${f1(y - hh * 0.2)}Q${f1(cx + w * 0.95)} ${f1(y + hh * 0.25)} ${f1(cx + w * 0.86)} ${f1(y + hh * 0.42)}Q${f1(cx)} ${f1(y + hh * 0.58)} ${f1(cx - w * 0.88)} ${f1(y + hh * 0.42)}Q${f1(cx - w * 0.99)} ${f1(y + hh * 0.2)} ${f1(cx - w * 0.98)} ${f1(y - hh * 0.2)}Z`
    return [
      s('path', { class: 't24f-plinth-face', d: face, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
      s('path', { class: 't24f-plinth-shade', d: face, fill: 'url(#p2-shade)' }),
      s('path', { class: 't24f-plinth-top', d: top, filter: 'url(#ink-rough)' }),
      s('path', { class: 't24f-plinth-ink', d: stroke(curve([cx - w * 0.98, y - hh * 0.2], [cx, y - hh * 0.02], [cx + w * 0.97, y - hh * 0.2], 12), 1.6, 0.2, 0.2, 0.3) }),
    ]
  }

  /** A celadon pot: round body, glaze highlight from the lantern side, rim of dark soil, a little foot. */
  function pot(cx: number, base: number, w: number, hh: number): SVGElement[] {
    const top = base - hh
    const body = `M${f1(cx - w)} ${f1(top)}C${f1(cx - w * 1.08)} ${f1(top + hh * 0.6)} ${f1(cx - w * 0.7)} ${f1(base)} ${f1(cx - w * 0.45)} ${f1(base)}L${f1(cx + w * 0.45)} ${f1(base)}C${f1(cx + w * 0.7)} ${f1(base)} ${f1(cx + w * 1.08)} ${f1(top + hh * 0.6)} ${f1(cx + w)} ${f1(top)}Z`
    return [
      s('path', { class: 't24f-potbody', d: body, fill: 'url(#t24f-glaze)', filter: 'url(#ink-rough)' }),
      s('path', { class: 't24f-pot-shade', d: body, fill: 'url(#p2-shade)' }),
      s('path', { class: 't24f-pot-hi', d: stroke(curve([cx - w * 0.82, top + hh * 0.18], [cx - w * 0.9, top + hh * 0.5], [cx - w * 0.6, top + hh * 0.82], 8), Math.max(2, w * 0.07), 0.3, 0.3, 0.1) }),
      s('path', { class: 't24f-pot-hi b', d: stroke(curve([cx + w * 0.2, top + hh * 0.12], [cx + w * 0.55, top + hh * 0.16], [cx + w * 0.8, top + hh * 0.3], 6), Math.max(1.4, w * 0.04), 0.3, 0.3, 0.1) }),
      s('ellipse', { class: 't24f-soil', cx: f1(cx), cy: f1(top + 1), rx: f1(w * 0.98), ry: f1(Math.max(3, hh * 0.12)) }),
      s('path', { class: 't24f-moss', d: [0, 1, 2, 3, 4].map((k) => blob(cx - w * 0.7 + k * w * 0.36, top, w * 0.12, hh * 0.05, 2420 + k, 0.3, 10)).join('') }),
      s('path', { class: 't24f-pot-ink', d: stroke(curve([cx - w, top], [cx - w * 1.05, base - hh * 0.2], [cx - w * 0.45, base], 10), 2, 0.05, 0.2, 0.3) + stroke(curve([cx + w, top], [cx + w * 1.05, base - hh * 0.2], [cx + w * 0.45, base], 10), 2.6, 0.05, 0.2, 0.3) + stroke([[cx - w * 1.03, top], [cx, top + 1.5], [cx + w * 1.03, top]], 2.2, 0.05, 0.05, 0.4), filter: 'url(#ink-rough)' }),
    ]
  }

  /**
   * The sapling (young, or grown thick and bent toward the rewarded side): wood outlines, the edges the lantern rims,
   * bark marks, leaf clusters (shade and lit), and the flowers' places. The shadow on the paper is built from the same.
   */
  function treePaths(bend: number, side: number) {
    const { u } = G
    const pt = ([x, y]: Pt): Pt => [X(x + side * bend * 0.1 * y * y), Y(y)]
    let wood = '', rims = '', bark = '', leaves = '', lit = ''
    const r = rng(2406)
    const tc = spline(TRUNK.map(pt), 8)
    const tr = taper(tc, u * (0.052 + bend * 0.04), u * (0.026 + bend * 0.016), u * (0.035 + bend * 0.03), 2404)
    wood += tr.d
    const rim = (e: Pt[], w: number) => (rims += stroke(e, w, 0.1, 0.1, 0.3))
    rim(tr.L, u * 0.008)
    rim(tr.R, u * 0.008)
    // bark: dry lenticels across the young trunk, a crack or two up it
    for (let i = 2; i < tc.length - 3; i += 2) {
      const [x, y] = tc[i]
      const w = u * (0.022 + bend * 0.016)
      bark += stroke([[x - w * (0.3 + r() * 0.5), y], [x + w * (0.1 + r() * 0.5), y - u * 0.004]], Math.max(0.9, u * 0.004), 0.2, 0.3, 0.2)
    }
    bark += stroke(tc.slice(2, 16).map(([x, y], i) => [x + u * 0.008 + Math.sin(i) * 0.6, y] as Pt), Math.max(0.8, u * 0.003), 0.2, 0.3, 0.2)
    const chains = [...LIMB, TOP(G.top)].map((l, i) => {
      const c = spline(l.map(pt), 8)
      const t = taper(c, u * (0.026 + (i < 2 && i === (side > 0 ? 1 : 0) ? bend * 0.014 : 0)), u * 0.006, 0, 2405 + i)
      wood += t.d
      rim(t.L, u * 0.006)
      rim(t.R, u * 0.006)
      return c
    })
    chains.push(tc)
    // leaves: pointed ovals in clusters at the twig tips and along the limbs; the ones facing up catch light
    const leaf = (x: number, y: number, a: number, L: number) => {
      const ex = x + Math.cos(a) * L, ey = y + Math.sin(a) * L
      const nx = -Math.sin(a) * L * 0.3, ny = Math.cos(a) * L * 0.3
      const d = `M${f1(x)} ${f1(y)}Q${f1(x + (ex - x) * 0.45 + nx)} ${f1(y + (ey - y) * 0.45 + ny)} ${f1(ex)} ${f1(ey)}Q${f1(x + (ex - x) * 0.55 - nx)} ${f1(y + (ey - y) * 0.55 - ny)} ${f1(x)} ${f1(y)}Z`
      if (Math.sin(a) < -0.2) lit += d
      else leaves += d
    }
    const cluster = (x: number, y: number, a: number, k: number) => {
      const n = 4 + Math.floor(r() * 3)
      for (let j = 0; j < n; j++) leaf(x + (r() - 0.5) * u * 0.02, y + (r() - 0.5) * u * 0.02, a + (j / (n - 1) - 0.5) * 2.2 + (r() - 0.5) * 0.6, u * k * (0.8 + r() * 0.6))
    }
    for (const [li, t, ang, len] of TWIGS) {
      const c = chains[li]
      const p = c[Math.round(t * (c.length - 1))]
      const a = (-ang * Math.PI) / 180
      const L = u * len
      const end: Pt = [p[0] + Math.cos(a) * L, p[1] + Math.sin(a) * L]
      const mid: Pt = [(p[0] + end[0]) / 2 - Math.sin(a) * L * 0.12, (p[1] + end[1]) / 2 - L * 0.08]
      const tw = taper(curve(p, mid, end, 6), u * 0.011, u * 0.003, 0, 2430 + Math.round(t * 100))
      wood += tw.d
      rim(tw.L, u * 0.004)
      cluster(end[0], end[1], a, 0.062)
      const q = curve(p, mid, end, 6)[3]
      leaf(q[0], q[1], a - 1.1, u * 0.04)
    }
    // a few leaves on the limbs themselves, short of the flowers
    for (let i = 0; i < 3; i++) for (const k of [7, 13, 19]) {
      const c = chains[i]
      if (!c[k]) continue
      leaf(c[k][0], c[k][1], -Math.PI / 2 + (i === 0 ? -1 : 1) * (0.5 + r() * 0.5) * (k % 2 ? 1 : -1), u * (0.045 + r() * 0.02))
    }
    return { wood, rims, bark, leaves, lit, tips: [LIMB[0][3], LIMB[1][3]].map(pt) }
  }

  let flowerEls: SVGGElement[] = []
  let shSharp: SVGPathElement = s('path'), shSoft: SVGPathElement = s('path')
  let oldSide = -1
  let potShadow = ''
  const wood = (p: ReturnType<typeof treePaths>) => [
    s('path', { class: 't24f-wood', d: p.wood, filter: 'url(#ink-rough)' }),
    s('path', { class: 't24f-bark', d: p.bark, filter: 'url(#ink-dry)' }),
    s('path', { class: 't24f-leaf', d: p.leaves }),
    s('path', { class: 't24f-leaf lit', d: p.lit }),
  ]
  const rims = (p: ReturnType<typeof treePaths>) => [s('path', { class: 't24f-rim', d: p.rims }), s('path', { class: 't24f-leafrim', d: p.lit + p.leaves })]
  function drawTree() {
    const p = treePaths(0, 1)
    const fr = Math.max(13, G.u * 0.056)
    flowerEls = p.tips.map((t, i) => flower(t, fr, i))
    youngSvg.replaceChildren(...wood(p))
    oldSvg.replaceChildren()
    oldSide = -1
    rimSvg.replaceChildren(...rims(p))
    flowerSvg.replaceChildren(defs, ...flowerEls)
    // the shadow: the same branches, crisp near the trunk and blurring out toward the tips
    const { u, tx, base } = G
    potShadow = `M${f1(tx - u * 0.19)} ${f1(base - u * 0.2)}C${f1(tx - u * 0.2)} ${f1(base - u * 0.1)} ${f1(tx - u * 0.13)} ${f1(base - u * 0.05)} ${f1(tx - u * 0.08)} ${f1(base - u * 0.05)}H${f1(tx + u * 0.08)}C${f1(tx + u * 0.13)} ${f1(base - u * 0.05)} ${f1(tx + u * 0.2)} ${f1(base - u * 0.1)} ${f1(tx + u * 0.19)} ${f1(base - u * 0.2)}Z`
    const d = shadowD(p, fr, -1)
    shSharp = s('path', { class: 't24f-sh sharp', d })
    shSoft = s('path', { class: 't24f-sh soft', d, filter: quick ? null : 'url(#t24f-soft)' })
    shadowSvg.replaceChildren(
      s('defs', null,
        s('filter', { id: 't24f-soft', x: '-10%', y: '-10%', width: '120%', height: '120%' }, s('feGaussianBlur', { stdDeviation: 3.2 })),
        s('radialGradient', { id: 't24f-near', gradientUnits: 'userSpaceOnUse', cx: f1(tx), cy: f1(Y(0.22)), r: f1(u * 0.5) }, s('stop', { offset: 0, 'stop-color': '#fff' }), s('stop', { offset: 0.55, 'stop-color': '#fff', 'stop-opacity': 0.8 }), s('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 })),
        s('mask', { id: 't24f-crisp', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: f1(G.W), height: f1(G.H) }, s('rect', { x: 0, y: 0, width: f1(G.W), height: f1(G.H), fill: 'url(#t24f-near)' }))),
      shSoft, s('g', { mask: 'url(#t24f-crisp)' }, shSharp))
    if (grown > 0 && pick >= 0) grow(grown)
    treeBox.style.transformOrigin = `${f1(G.tx)}px ${f1(G.soil)}px`
  }
  const shadowD = (p: ReturnType<typeof treePaths>, fr: number, big: number) =>
    p.wood + p.leaves + p.lit + potShadow + p.tips.map(([x, y], i) => blob(x, y, fr * (i === big ? 1.6 : 1.15), fr * (i === big ? 1.6 : 1.15), 9 + i, 0.18, 10)).join('')

  /** A plum blossom: five soft petals that glow from within, fine stamens with warm anthers; a bloom of light when chosen. */
  function flower([x, y]: Pt, fr: number, i: number) {
    let petals = '', veins = '', stamens = '', anthers = ''
    for (let k = 0; k < 5; k++) {
      const a = ((k * 72 - 90 + i * 20) * Math.PI) / 180
      const cx = x + Math.cos(a) * fr * 0.58, cy = y + Math.sin(a) * fr * 0.58
      const pts: Pt[] = []
      for (let j = 0; j < 14; j++) {
        const th = (j / 14) * Math.PI * 2
        const notch = 1 - 0.12 * Math.pow(Math.max(0, Math.cos(th)), 8) // a small notch at the petal's tip
        const ex = Math.cos(th) * fr * 0.6 * notch, ey = Math.sin(th) * fr * 0.5
        pts.push([cx + ex * Math.cos(a) - ey * Math.sin(a), cy + ex * Math.sin(a) + ey * Math.cos(a)])
      }
      petals += `M${pts.map(([px, py]) => `${f1(px)} ${f1(py)}`).join('L')}Z`
      veins += stroke([[x + Math.cos(a) * fr * 0.2, y + Math.sin(a) * fr * 0.2], [x + Math.cos(a) * fr * 0.85, y + Math.sin(a) * fr * 0.85]], 0.7, 0.2, 0.5, 0.2)
    }
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + 0.3
      const l = fr * (0.42 + (k % 3) * 0.06)
      stamens += stroke([[x, y], [x + Math.cos(a) * l, y + Math.sin(a) * l]], 0.7, 0.1, 0.3, 0.3)
      anthers += blob(x + Math.cos(a) * l, y + Math.sin(a) * l, 1.4, 1.4, k, 0.1, 6)
    }
    const g = s('g', { class: `t24f-fl f${i}` },
      s('circle', { class: 't24f-fl-halo', cx: f1(x), cy: f1(y), r: f1(fr * 3.4), fill: 'url(#t24f-bloomg)' }),
      s('g', { class: 't24f-bloom' },
        s('path', { class: 't24f-pet', d: petals, fill: 'url(#t24f-petal)' }),
        s('path', { class: 't24f-vein', d: veins }),
        s('circle', { class: 't24f-heart', cx: f1(x), cy: f1(y), r: f1(fr * 0.2) }),
        s('path', { class: 't24f-stamen', d: stamens }),
        s('path', { class: 't24f-anther', d: anthers })))
    ;(g.lastChild as SVGGElement).style.transformOrigin = `${f1(x)}px ${f1(y)}px`
    return g
  }

  /** The moon clock: a squat carved stone; on its face a dial ring with twelve marks and a moon that runs round it. */
  function drawClock() {
    const body = 'M-74 2C-78 -20 -74 -46 -60 -58Q-20 -70 30 -66Q66 -64 74 -46C79 -28 78 -10 73 2Q0 8 -74 2Z'
    const top = 'M-60 -58Q-20 -70 30 -66Q66 -64 74 -46Q30 -54 -10 -54Q-40 -54 -60 -58Z'
    let ticks = ''
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2
      const r0 = k % 3 ? 15.5 : 13.5
      ticks += stroke([[-40 + Math.cos(a) * r0, -27 + Math.sin(a) * r0], [-40 + Math.cos(a) * 19, -27 + Math.sin(a) * 19]], k % 3 ? 1.1 : 1.8, 0.1, 0.1, 0.5)
    }
    clockHand.replaceChildren(
      s('circle', { cx: -40, cy: -27, r: 30, fill: 'none' }), // the turning box: centred on the dial
      s('circle', { class: 't24f-cm-halo', cx: -40, cy: -48, r: 9, fill: 'url(#p2-halo)' }),
      s('circle', { class: 't24f-cm', cx: -40, cy: -48, r: 4.6, fill: 'url(#p2-disc)' }),
      s('path', { class: 't24f-cm-sea', d: blob(-41.5, -49, 1.6, 1.2, 3, 0.2, 8) + blob(-38.6, -47, 1.1, 1.4, 4, 0.2, 8) }),
      s('circle', { class: 't24f-cm-rim', cx: -40, cy: -48, r: 4.6 }))
    clockArt.replaceChildren(
      s('ellipse', { class: 't24f-clock-sh', cx: 4, cy: 3, rx: 82, ry: 6 }),
      s('path', { class: 't24f-clock-face', d: body, filter: 'url(#ink-rough)' }),
      s('path', { class: 't24f-clock-shade', d: body, fill: 'url(#p2-shade)' }),
      s('path', { class: 't24f-clock-top', d: top }),
      s('path', { class: 't24f-clock-ink', d: stroke([[48, -62], [70, -52], [76, -28], [72, 0]], 2.2, 0.2, 0.2, 0.3) + stroke([[-74, -8], [-70, 0]], 1.6, 0.2, 0.2, 0.3), filter: 'url(#ink-rough)' }),
      // the carved dial: a sunk ring (dark above, light below), the hour marks, the moon on its track
      s('circle', { class: 't24f-dial-sunk', cx: -40, cy: -27, r: 21 }),
      s('circle', { class: 't24f-dial-lo', cx: -40, cy: -26, r: 21 }),
      s('circle', { class: 't24f-dial-hi', cx: -40, cy: -28, r: 21 }),
      s('path', { class: 't24f-ticks', d: ticks }),
      s('circle', { class: 't24f-dial-pin', cx: -40, cy: -27, r: 1.8 }),
      clockHand)
  }

  // ── the lantern: where it hangs decides the shadow, the warm light and which way the tree leans
  function setLamp(x: number, y: number, user: boolean) {
    const { W, H, u } = G
    G.lx = clamp(x, W * 0.08, W * 0.92)
    G.ly = clamp(y, H * 0.05, Y(0.6))
    const lx = LX(), ly = LY()
    const move = `translate(${f1(G.lx)}px, ${f1(G.ly)}px)`
    lamp.style.transform = move
    handSvg.style.transform = move
    lampGlow.style.transform = `translate(${f1(lx - G.paper[0])}px, ${f1(ly - G.paper[1])}px)`
    pool.style.transform = `translate(${f1(lx)}px, ${f1(G.paper[3] + (H - G.paper[3]) * 0.4)}px)`
    latLit.style.setProperty('--lx', `${f1(lx)}px`)
    latLit.style.setProperty('--ly', `${f1(ly)}px`)
    light()
    if (user && pick < 0 && !ruled) {
      lean = clamp(((lx - G.tx) / (u * 0.5)) * 3, -4, 4)
      applyLean()
    }
  }

  /**
   * The grader's hand, drawn once round the lantern's hook (it moves with the lantern): a broad ink sleeve from the upper
   * left, the wrist, a fist round a bamboo pole with its knuckles across it and the thumb along it, the pole's curled hook.
   */
  function drawHand() {
    const u = G.u * 1.45 // the hand is near: drawn larger than the tree's unit
    const E: Pt = [-u * 0.01, -u * 0.03] // the pole's end, where the hook curls down
    const dl = Math.hypot(0.94, 0.34)
    const d: Pt = [0.94 / dl, 0.34 / dl] // along the pole, grip → hook
    const n: Pt = [-d[1], d[0]]
    const gp: Pt = [E[0] - d[0] * u * 0.24, E[1] - d[1] * u * 0.24]
    const at = (a: number, b: number): Pt => [gp[0] + (d[0] * a + n[0] * b) * u, gp[1] + (d[1] * a + n[1] * b) * u]
    // the bamboo: butt above the hand to the end, nodes, a lit edge; the curl of the hook
    const pole = stroke([at(-0.1, 0), E], u * 0.02, 0.02, 0.04, 0.7)
    const hook = stroke([E, [E[0] + u * 0.02, E[1] + u * 0.002], [E[0] + u * 0.026, E[1] + u * 0.018], [E[0] + u * 0.014, E[1] + u * 0.03], [E[0] + u * 0.006, E[1] + u * 0.026]], u * 0.009, 0.05, 0.4, 0.4)
    let nodes = ''
    for (const a of [-0.07, 0.07, 0.17]) nodes += stroke([at(a, -0.012), at(a + 0.003, 0.012)], u * 0.006, 0.2, 0.2, 0.4)
    const poleLit = stroke([at(-0.09, -0.007), at(0.23, -0.007)], u * 0.004, 0.2, 0.3, 0.2)
    // the sleeve: from the cuff round the wrist out past the frame, up and to the left
    const A: Pt = [-0.85, -0.53], m: Pt = [-A[1], A[0]]
    const cuff: Pt = [gp[0] + A[0] * u * 0.075, gp[1] + A[1] * u * 0.075]
    const far: Pt = [cuff[0] + A[0] * u * 1.1, cuff[1] + A[1] * u * 1.1]
    const off = (p: Pt, v: Pt, k: number): Pt => [p[0] + v[0] * k * u, p[1] + v[1] * k * u]
    const cL = off(cuff, m, 0.06), cR = off(cuff, m, -0.055), fL = off(far, m, 0.22), fR = off(far, m, -0.2)
    const bulge = off(cuff, A, -0.03)
    const sleeve = `M${f1(cL[0])} ${f1(cL[1])}Q${f1(bulge[0])} ${f1(bulge[1])} ${f1(cR[0])} ${f1(cR[1])}Q${f1((cR[0] + fR[0]) / 2 - m[0] * u * 0.05)} ${f1((cR[1] + fR[1]) / 2 - m[1] * u * 0.05)} ${f1(fR[0])} ${f1(fR[1])}L${f1(fL[0])} ${f1(fL[1])}Q${f1((cL[0] + fL[0]) / 2 + m[0] * u * 0.02)} ${f1((cL[1] + fL[1]) / 2 + m[1] * u * 0.02)} ${f1(cL[0])} ${f1(cL[1])}Z`
    const hem = stroke([cL, bulge, cR], u * 0.013, 0.1, 0.1, 0.4) + stroke([off(cL, A, 0.04), off(off(cuff, A, 0.016), m, 0.008), off(cR, A, 0.05)], u * 0.006, 0.2, 0.3, 0.3)
    let folds = ''
    for (const [k0, k1, sd] of [[0.1, 0.55, 0.025], [0.16, 0.8, -0.04], [0.3, 0.95, 0.1]] as const)
      folds += stroke(curve(off(off(cuff, A, k0), m, sd), off(off(cuff, A, (k0 + k1) / 2), m, sd + 0.035), off(off(cuff, A, k1), m, sd - 0.02), 8), u * 0.01, 0.15, 0.4, 0.2)
    // wrist and fist (the back of the hand toward us); the thumb over the pole, creases where the fingers fold under
    const wrist = stroke([off(cuff, A, -0.008), at(-0.012, -0.004)], u * 0.042, 0.1, 0.1, 0.8)
    const ang = (Math.atan2(d[1], d[0]) * 180) / Math.PI
    const back = stroke(curve(at(-0.045, -0.02), at(-0.005, -0.05), at(0.04, -0.022), 10), u * 0.011, 0.1, 0.25, 0.3)
    const thumb = stroke(curve(at(-0.022, -0.012), at(0.02, -0.03), at(0.052, -0.012), 8), u * 0.016, 0.1, 0.5, 0.3)
    let creases = ''
    for (let k = 0; k < 3; k++) creases += stroke(curve(at(-0.02 + k * 0.022, 0.016), at(-0.012 + k * 0.022, 0.026), at(-0.004 + k * 0.022, 0.02), 4), u * 0.005, 0.2, 0.2, 0.3)
    handSvg.replaceChildren(
      s('path', { class: 't24f-pole', d: pole, filter: 'url(#ink-rough)' }),
      s('path', { class: 't24f-pole-lit', d: poleLit }),
      s('path', { class: 't24f-pole-node', d: nodes + hook }),
      s('path', { class: 't24f-sleeve', d: sleeve, filter: 'url(#ink-wash)' }),
      s('path', { class: 't24f-folds', d: folds + hem, filter: 'url(#ink-rough)' }),
      s('path', { class: 't24f-skin', d: wrist }),
      s('path', { class: 't24f-skin', d: blob(at(0.004, 0)[0], at(0.004, 0)[1], u * 0.05, u * 0.036, 2409, 0.1, 14), transform: `rotate(${f1(ang)} ${f1(at(0.004, 0)[0])} ${f1(at(0.004, 0)[1])})` }),
      s('path', { class: 't24f-skin-lit', d: stroke(curve(at(0.04, -0.018), at(0.054, 0.002), at(0.04, 0.026), 6), u * 0.008, 0.2, 0.2, 0.2) }),
      s('path', { class: 't24f-knuckles', d: back + creases + stroke(curve(at(-0.04, 0.026), at(0.0, 0.04), at(0.044, 0.024), 8), u * 0.008, 0.2, 0.2, 0.3), filter: 'url(#ink-rough)' }),
      s('path', { class: 't24f-thumb', d: thumb }))
    // the lantern under the hook
    const r = G.lr
    lampSvg.setAttribute('viewBox', `${f1(-r * 3)} 0 ${f1(r * 6)} ${f1(r * 4)}`)
    Object.assign(lamp.style, { width: `${f1(r * 6)}px`, height: `${f1(r * 4)}px`, marginLeft: `${f1(-r * 3)}px` })
    lampSvg.replaceChildren(paperLantern(0, 0, r, 7, r * 0.95))
  }

  /** The whole tree box turns about the soil (the tanzaku keep hanging plumb); the shadow turns with it. */
  function applyLean() {
    treeBox.style.transform = `rotate(${lean.toFixed(2)}deg)`
    light()
    const a = (lean * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a)
    const fr = Math.max(13, G.u * 0.056)
    for (let i = 0; i < tans.length; i++) {
      const x0 = G.tips[i][0] + (i === pick ? (pick ? 1 : -1) * grown * G.u * 0.05 : 0), y0 = G.tips[i][1] + fr * 0.6
      const dx = x0 - G.tx, dy = y0 - G.soil
      const x = clamp(G.tx + dx * ca - dy * sa, G.sw[0] / 2 + 6, G.W - G.sw[0] / 2 - 6), y = G.soil + dx * sa + dy * ca
      tans[i].style.transform = `translate(${f1(x)}px, ${f1(y)}px)`
      // opened, the slip is wider: slide it along so it stays in the frame
      tans[i].style.setProperty('--ox', `${f1(clamp(x, G.sw[1] / 2 + 6, G.W - G.sw[1] / 2 - 6) - x)}px`)
    }
    scroll.style.transform = `rotate(${(-lean).toFixed(2)}deg)`
    // the lean is written on the paper where the shadow leans (away from the lantern)
    const away = G.lx < G.tx ? 1 : -1
    const { paper, wide, W } = G
    leanLabel.style.left = `${f1(wide ? G.tx + away * G.u * 0.95 : W / 2 + away * W * 0.27)}px`
    leanLabel.style.top = `${f1(wide ? paper[1] + (paper[3] - paper[1]) * 0.6 : paper[1] + (paper[3] - paper[1]) * 0.17)}px`
    for (let i = 0; i < flowerEls.length; i++) flowerEls[i].classList.toggle('near', Math.hypot(LX() - G.tips[i][0], LY() - G.tips[i][1]) < G.u * 0.3 && !ruled)
  }

  /**
   * Where the lantern's light falls: the shadow (a central projection from the lantern onto the paper behind the tree,
   * after the tree's lean) and the warm rims (a mask round the lantern, in the tree's own turned frame). Only transforms
   * and one mask position: the painted layers never redraw while the lantern moves.
   */
  function light() {
    const lx = LX(), ly = LY(), k = G.k, { tx, soil } = G
    shadow.style.transform = `matrix(${k},0,0,${k},${f1(lx * (1 - k) - G.paper[0])},${f1(ly * (1 - k) - G.paper[1])}) translate(${f1(tx)}px, ${f1(soil)}px) rotate(${lean.toFixed(2)}deg) translate(${f1(-tx)}px, ${f1(-soil)}px)`
    const a = (-lean * Math.PI) / 180, dx = lx - tx, dy = ly - soil
    rimSvg.style.setProperty('--rx', `${f1(tx + dx * Math.cos(a) - dy * Math.sin(a))}px`)
    rimSvg.style.setProperty('--ry', `${f1(soil + dx * Math.sin(a) + dy * Math.cos(a))}px`)
    rimSvg.style.setProperty('--rr', `${f1(G.u * 0.85)}px`)
  }

  /** Thicken the trunk and bend it toward the chosen side (0 … 1): the old wood fades in over the young. */
  function grow(k: number) {
    grown = k
    if (oldSide !== pick) {
      oldSide = pick
      oldSvg.replaceChildren(...wood(treePaths(1, pick ? 1 : -1)))
    }
    oldSvg.style.opacity = String(k)
    youngSvg.style.opacity = String(1 - k)
    // the chosen flower rides out on its bent limb
    const f = flowerEls[pick]
    if (f) f.style.transform = `translateX(${f1((pick ? 1 : -1) * k * G.u * 0.05)}px)`
    if (k >= 1) {
      const p = treePaths(1, pick ? 1 : -1)
      const d = shadowD(p, Math.max(13, G.u * 0.056), pick)
      shSharp.setAttribute('d', d)
      shSoft.setAttribute('d', d)
      rimSvg.replaceChildren(...rims(p))
    }
  }

  let drag: { id: number; dx: number; dy: number } | null = null
  let rect: DOMRect | null = null
  lamp.addEventListener('pointerdown', (e) => {
    if (ruled) return
    rect = ctx.art.getBoundingClientRect()
    drag = { id: e.pointerId, dx: G.lx - (e.clientX - rect.left), dy: G.ly - (e.clientY - rect.top) }
    lamp.setPointerCapture(e.pointerId)
    lamp.classList.add('held')
  })
  lamp.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id || !rect) return
    setLamp(e.clientX - rect.left + drag.dx, e.clientY - rect.top + drag.dy, true)
  })
  const drop = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return
    drag = null
    lamp.classList.remove('held')
    // released nearer one flower: that is the choice
    const d = G.tips.map(([x, y]) => Math.hypot(LX() - x, LY() - y))
    const i = d[0] < d[1] ? 0 : 1
    if (d[i] < G.u * 0.42) choose(i, false)
  }
  lamp.addEventListener('pointerup', drop)
  lamp.addEventListener('pointercancel', drop)

  let ff = 0
  function choose(i: number, fly: boolean) {
    if (ruled) return
    const again = pick >= 0
    pick = i
    tans.forEach((b, k) => {
      b.setAttribute('aria-pressed', String(k === i))
      b.classList.toggle('dim', k !== i)
    })
    root.dataset.pick = String(i)
    ctx.chime('tap')
    const [fx, fy] = G.tips[i]
    const tx0 = G.lx, ty0 = G.ly
    // the lantern comes to hang just above and outside the flower
    const toX = fx + (i ? 1 : -1) * G.u * 0.1, toY = fy - G.u * 0.1 - G.lr * 2.2
    const L = G.wide ? 7 : 3 // half the final lean (degrees): less on a narrow screen, the flowers must stay in the frame
    const lean0 = lean, lean1 = (i ? 1 : -1) * L
    const g0 = again ? 0 : grown
    grown = 0
    const run = ++ff
    // the lantern goes to the flower, the tree turns to it; then the moon clock runs: many passes, the trunk sets
    tween(ctx, R, fly ? 700 : 300, (k) => {
      if (fly) setLamp(tx0 + (toX - tx0) * k, ty0 + (toY - ty0) * k, false)
      lean = lean0 + (lean1 - lean0) * k
      applyLean()
    }, () => {
      if (run !== ff) return
      root.classList.add('ffwd')
      const pw = G.paper[2] - G.paper[0]
      const my = (G.paper[3] - G.paper[1]) * 0.2
      const passes = moonGlow.animate([{ transform: `translate(${f1(-pw * 0.15)}px, ${f1(my)}px)`, opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 1, offset: 0.75 }, { transform: `translate(${f1(pw * 1.1)}px, ${f1(my)}px)`, opacity: 0 }], { duration: quick ? 0 : 900, iterations: quick ? 1 : 3, easing: 'ease-in-out' })
      clockHand.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(1080deg)' }], { duration: quick ? 0 : 2700, easing: 'ease-in-out' })
      tween(ctx, R, quick ? 0 : 2700, (k) => {
        lean = lean1 + (i ? 1 : -1) * L * k
        applyLean()
        grow(Math.max(g0, k))
      }, () => {
        if (run !== ff) return
        root.classList.remove('ffwd')
        root.classList.add('leaned')
        passes.cancel()
        scroll.disabled = false
        if (!again) ctx.insight(K.insight, K.detail)
      })
    })
  }

  function swap() {
    if (pick < 0 || ruled) return
    ruled = true
    root.classList.add('ruled')
    scroll.setAttribute('aria-expanded', 'true')
    tans.forEach((b) => b.classList.remove('dim'))
    ctx.chime('ok')
    // the hand and lantern withdraw; the scroll's own light hangs above the tree, so the shadow falls short and straight
    const tx0 = G.lx, ty0 = G.ly, l0 = lean
    tween(ctx, R, 1200, (k) => {
      setLamp(tx0 + (G.tx - tx0) * k, ty0 + (Y(1.08) - ty0) * k, false)
      lean = l0 * (1 - k * 0.75)
      applyLean()
    })
    ctx.insight(K.constitution)
  }
}
