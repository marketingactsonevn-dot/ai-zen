import raw from '../../content/tram-19.json'
import { fill, h, nextId, s } from '../../core/dom'
import { L, type Fact } from '../../core/content'
import type { Detail, SceneCtx } from '../types'
import { blob, clamp, curve, onSize, p2Defs, rng, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist, moon, paperLantern, toro, wash } from '../../ui/part2/paint'
import { guide } from '../../ui/part2/guide'

const G = raw.scenes.gate
const f1 = (n: number) => n.toFixed(1)

/** A bamboo stalk from (x, y0) down to y1, w wide: the culm, darker node rings, the moonlit edge on one side. */
function culm(x: number, y0: number, y1: number, w: number, lean: number, r: () => number, rim: 'l' | 'r' = 'l') {
  const pts: Pt[] = [[x + lean, y0], [x + lean * 0.4, (y0 + y1) / 2], [x, y1]]
  let nodes = ''
  const step = Math.max(22, (y1 - y0) / (3.2 + r() * 2.2))
  for (let y = y0 + step * (0.3 + r() * 0.5); y < y1 - 6; y += step * (0.8 + r() * 0.4)) {
    const t = (y - y0) / (y1 - y0)
    const cx = x + lean * (1 - t)
    nodes += stroke([[cx - w * 0.62, y + 1], [cx, y - 1.4], [cx + w * 0.62, y + 1]], Math.max(1.3, w * 0.17), 0.1, 0.1, 0.4)
  }
  const ex = rim === 'l' ? -w * 0.34 : w * 0.34
  return {
    body: stroke(pts, w, 0.02, 0.02, 0.9),
    nodes,
    rim: stroke(pts.map(([px, py]) => [px + ex, py] as Pt), Math.max(1, w * 0.13), 0.12, 0.1, 0.3),
  }
}

/**
 * A mason in ink, standing on (x, y), hh tall, turned toward the wall's crack on side dir: a filled silhouette with weight
 * (conical hat, bent back, bent knees), the trowel in hand. reach: arm raised to the crack; bend: stooped over the mortar tub.
 */
function mason(x: number, y: number, hh: number, dir: number, pose: 'reach' | 'bend') {
  const u = hh / 20
  const P = (dx: number, dy: number): Pt => [x + dir * dx * u, y - dy * u]
  const reach = pose === 'reach'
  const hip = reach ? P(0, 9.2) : P(-0.6, 9.6)
  const sh = reach ? P(1.3, 16) : P(4.2, 13.2)
  const waist = reach ? P(0.4, 12.6) : P(1.6, 12)
  let body = stroke([hip, waist, sh], 5.4 * u, 0.12, 0.22, 0.62)
  body += reach
    ? stroke([hip, P(-0.7, 4.6), P(-1.3, 0)], 2.3 * u, 0.05, 0.1, 0.75) + stroke([hip, P(1.5, 4.3), P(2, 0)], 2.3 * u, 0.05, 0.1, 0.75)
    : stroke([hip, P(0.6, 5), P(1.2, 0)], 2.3 * u, 0.05, 0.1, 0.75) + stroke([hip, P(-2.1, 4.4), P(-2.7, 0)], 2.3 * u, 0.05, 0.1, 0.75)
  const hand = reach ? P(5.3, 20.6) : P(6.4, 5.6)
  body += reach
    ? stroke([sh, P(3.4, 18.2), hand], 1.8 * u, 0.1, 0.25, 0.5) + stroke([sh, P(2.4, 13), P(3.2, 11)], 1.6 * u, 0.1, 0.3, 0.5)
    : stroke([sh, P(5.6, 9), hand], 1.8 * u, 0.1, 0.25, 0.5) + stroke([sh, P(4.4, 9.2), P(4.8, 7.4)], 1.6 * u, 0.1, 0.3, 0.5)
  // the conical hat, tipped with the head
  const [ax, ay] = reach ? P(1.7, 22) : P(6.4, 16.6)
  const [bx, by] = reach ? P(-2.2, 17.6) : P(3.1, 12.6)
  const [cx, cy] = reach ? P(5.4, 18.5) : P(8.8, 14.6)
  body += `M${f1(bx)} ${f1(by)}L${f1(ax)} ${f1(ay)}L${f1(cx)} ${f1(cy)}Q${f1((bx + cx) / 2)} ${f1((by + cy) / 2 + u * 0.9)} ${f1(bx)} ${f1(by)}Z`
  // the trowel's blade (catches the lamp), the mortar tub of the stooped one
  const blade = reach
    ? [P(5, 20.4), P(7.4, 21.8), P(6.6, 22.9), P(4.7, 21.2)]
    : [P(6.2, 5.4), P(8.4, 4.4), P(8.8, 5.6), P(6.6, 6.4)]
  const bladeD = `M${blade.map(([a, b]) => `${f1(a)} ${f1(b)}`).join('L')}Z`
  const tub = reach ? '' : `M${f1(P(7, 0)[0])} ${f1(y)}L${f1(P(7.4, 3)[0])} ${f1(y - 3 * u)}L${f1(P(11.4, 3)[0])} ${f1(y - 3 * u)}L${f1(P(11, 0)[0])} ${f1(y)}Z`
  // a breath of moonlight down the side of the back that faces the moon (upper right)
  const rimSide = 1
  const rimD = stroke([[sh[0] + rimSide * 2.2 * u, sh[1] + u], [waist[0] + rimSide * 2.4 * u, waist[1]], [hip[0] + rimSide * 1.8 * u, hip[1]]], 0.7 * u, 0.2, 0.3, 0.3)
  return { body: body + tub, blade: bladeD, rim: rimD }
}

/**
 * The small wicket in the fence and the man waiting at it with a paper lantern on a pole, in a kw × kh box (sill at the
 * bottom): the wicket's posts, cap and plank door (it swings in on .let), the warm court behind it, the bearer's silhouette.
 */
function wicketArt(kw: number, kh: number): SVGElement[] {
  const u = kh / 100
  const wx0 = kw - 44 * u, wx1 = kw - 8 * u, wy0 = 22 * u, wy1 = kh - 2 * u
  const post = Math.max(3, 4 * u)
  const frame = `M${f1(wx0 - post)} ${f1(wy0 - 3 * u)}h${f1(post)}V${f1(wy1)}h${f1(-post)}Z M${f1(wx1)} ${f1(wy0 - 3 * u)}h${f1(post)}V${f1(wy1)}h${f1(-post)}Z`
  const cap = `M${f1(wx0 - post * 2.4)} ${f1(wy0 - 3 * u)}Q${f1((wx0 + wx1) / 2)} ${f1(wy0 - 11 * u)} ${f1(wx1 + post * 2.4)} ${f1(wy0 - 3 * u)}L${f1(wx1 + post)} ${f1(wy0)}H${f1(wx0 - post)}Z`
  let planks = ''
  for (let i = 1; i < 4; i++) planks += stroke([[wx0 + ((wx1 - wx0) * i) / 4, wy0 + 2 * u], [wx0 + ((wx1 - wx0) * i) / 4 + 0.6, wy1 - 2 * u]], 1.2, 0.05, 0.05, 0.6)
  // the bearer: conical hat, a robe that widens to the ground, one arm up to the pole; the lantern hangs at its tip
  const bx = 22 * u, by = kh
  const P = (dx: number, dy: number): Pt => [bx + dx * u, by - dy * u]
  const J = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`
  const body = `M${J(P(-9, 0))}L${J(P(-6, 30))}Q${J(P(0, 40))} ${J(P(6, 30))}L${J(P(10, 0))}Z` +
    `M${J(P(-11, 39))}L${J(P(0, 52))}L${J(P(11, 39))}Q${J(P(0, 41))} ${J(P(-11, 39))}Z` +
    stroke([P(4, 33), P(11, 36), P(15, 44)], 3.4 * u, 0.1, 0.2, 0.6)
  const pole = stroke([P(16, 30), P(19, 62), P(27, 70)], 1.6 * u, 0.05, 0.1, 0.6)
  const [lx, ly] = P(27, 70)
  return [
    s('path', { class: 't19g-wicket-in', d: `M${f1(wx0)} ${f1(wy0)}H${f1(wx1)}V${f1(wy1)}H${f1(wx0)}Z` }),
    s('g', { class: 't19g-wicket-door' },
      s('path', { class: 't19g-wicket-board', d: `M${f1(wx0)} ${f1(wy0)}H${f1(wx1)}V${f1(wy1)}H${f1(wx0)}Z` }),
      s('path', { class: 't19g-wicket-plank', d: planks })),
    s('path', { class: 't19g-wicket-frame', d: frame + cap, filter: 'url(#ink-rough)' }),
    s('g', { class: 't19g-bearer' },
      s('ellipse', { class: 't19g-contact', cx: f1(bx + 2 * u), cy: f1(by - 1), rx: f1(14 * u), ry: f1(2.4 * u) }),
      s('path', { class: 't19g-worker', d: body + pole }),
      s('path', { class: 't19g-worker-rim', d: stroke([P(6, 2), P(5.5, 28)], 1.2 * u, 0.2, 0.3, 0.3) }),
      paperLantern(lx, ly, 5 * u, 1931, 3 * u)),
  ]
}

/**
 * A wooden tag hung on the fence by a cord (viewBox -22 -8 44 64, cord knot at 0 0), its sign carved in (audit v3 19-2,
 * the voices of 19-3 folded in): 0 · a stone course with a pale fresh seam of mortar (Mozilla: 271 bugs fixed), 1 · a single
 * notch (VulnCheck: one published flaw), 2 · a smaller fenced ring (OpenAI: another lab fencing its own model).
 */
function tagArt(i: number): SVGElement[] {
  const board = 'M-15 13L0 5.5L15 13L15.6 50Q0 52.5 -15.6 50Z'
  let cut = '', seam = ''
  if (i === 0) {
    cut = stroke([[-9, 25], [9, 24.6]], 1.6, 0.1, 0.1, 0.6) + stroke([[-9, 38], [9, 38.4]], 1.6, 0.1, 0.1, 0.6) + stroke([[-1, 25], [-1.4, 38]], 1.4, 0.1, 0.1, 0.6)
    seam = stroke([[-10, 31.5], [-5, 29.6], [0, 32], [5, 30], [10, 31.8]], 2.4, 0.15, 0.15, 0.5)
  } else if (i === 1) {
    cut = 'M-2.6 20L2.6 20L0.5 42L-0.5 42Z'
  } else {
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2
      const x = Math.cos(a) * 8.5, y = 35 + Math.sin(a) * 3.4
      cut += stroke([[x, y], [x + 0.2, y - 7 - (k % 2) * 1.6]], 1.5, 0.05, 0.05, 0.6)
    }
    cut += stroke(Array.from({ length: 11 }, (_, k) => [Math.cos((k / 10) * Math.PI) * 8.8, 35 + Math.sin((k / 10) * Math.PI) * 3.4 - 5.6] as Pt), 1, 0.05, 0.05, 0.6)
  }
  return [
    s('path', { class: 't19g-tag-cord', d: 'M0 0L-6 9M0 0L6 9M0 0V-8' }),
    s('path', { class: 't19g-tag-wood', d: board, filter: 'url(#ink-rough)' }),
    s('path', { class: 't19g-tag-grain', d: stroke([[-10, 16], [-11, 48]], 0.7, 0.3, 0.3, 0.2) + stroke([[7, 14], [8, 47]], 0.7, 0.3, 0.3, 0.2) }),
    s('path', { class: 't19g-tag-lit', d: stroke([[-14.6, 13.4], [-0.2, 6.2]], 1.2, 0.1, 0.1, 0.4) }),
    s('path', { class: 't19g-tag-lip', d: cut, transform: 'translate(0.7 0.9)' }),
    s('path', { class: 't19g-tag-cut', d: cut }),
    s('path', { class: 't19g-tag-seam', d: seam }),
    s('circle', { class: 't19g-tag-peg', cx: 0, cy: 9.5, r: 1.6 }),
  ]
}

/**
 * Scene 2 · the fenced summit (EYE, macro, 2.5D). Eye-level against the bamboo fence: five painted flats at depth — blurred
 * bamboo in front, the fence (culms of every height, leaning, tied, fading into the mist at both ends) and its plank-and-
 * lattice gate, the compound glimpsed through it (a curved wall of dressed stone with lines of code cut into each block, a
 * red crack, two masons patching it, lanterns, twelve small lamps along the coping and a faint band of forty more), the
 * summit, the moon. The moon throws the lattice's shadow across the forecourt; warm light leaks through the seam.
 * Audit v3 19-2 (P1: opening the gate yourself said the opposite of "not released to everyone"): the bolt is stuck — it
 * gives a few px and the gate shudders, "this gate is not open to you". Then the man with the lantern at the small wicket
 * on the left (a software fixer) is let in: the wicket swings, his lantern goes in, the crack is lit and patched, and the
 * reason hangs on the fence as a plain sign with who got in first. Then (19-3 "who says what" folded in) three carved tags on the
 * right-hand fence speak, one at a time on the forecourt under them: Mozilla, VulnCheck, OpenAI; Anthropic's own claim and the
 * project's name wait in the insight's "more". All three heard: the shared line.
 */
export function gateScene(ctx: SceneCtx) {
  p2Defs()
  const low = ctx.quality === 'low'
  const deep = !low && !ctx.reduced // parallax
  const uid = nextId('t19g')

  const layer = (cls: string) => {
    const svg = s('svg', { class: 't19g-svg', 'aria-hidden': 'true' })
    return { svg, el: h('div', { class: `t19g-layer ${cls}` }, svg) }
  }
  const sky = layer('t19g-sky'), peak = layer('t19g-peak'), inner = layer('t19g-in'), fence = layer('t19g-fence'), fg = layer('t19g-fg')
  const doorSvg = (side: string) => s('svg', { class: `t19g-door-svg t19g-door-svg-${side}`, 'aria-hidden': 'true' })
  const doorL = h('div', { class: 't19g-door t19g-door-l' }, doorSvg('l'))
  const doorR = h('div', { class: 't19g-door t19g-door-r' }, doorSvg('r'))
  const boltArt = s('svg', { class: 't19g-bolt-svg', 'aria-hidden': 'true' })
  const boltGrip = h('span', { class: 't19g-bolt-grip', 'aria-hidden': 'true' }) // where the guide's dot rides: the bolt's right end
  const bolt = h('button', { class: 't19g-bolt', type: 'button', 'aria-label': G.gateAria }, boltArt, boltGrip)
  const gate = h('div', { class: 't19g-gate' }, doorL, doorR, bolt)
  fence.el.append(gate)
  // the man with the lantern at the small wicket (left third): the one who gets in
  const wicket = s('svg', { class: 't19g-wicket-svg', 'aria-hidden': 'true' })
  const keeperDotAt = h('span', { class: 't19g-keeper-dot', 'aria-hidden': 'true' })
  const keeper = h('button', { class: 't19g-keeper', type: 'button', 'aria-label': G.keeperAria }, wicket, keeperDotAt, h('span', { class: 't19g-keeper-tag', 'aria-hidden': 'true' }, G.keeper))
  keeper.disabled = true
  // the reason, on a plain board hung on the fence once he is in: planks and battens, the words cut into the wood
  const board = h('div', { class: 't19g-board' },
    h('div', { class: 't19g-board-wood', 'aria-hidden': 'true' }),
    h('div', { class: 't19g-board-text' },
      h('p', { class: 't19g-board-title' }, G.reasonTitle),
      ctx.fact(G.reason as Fact, 'p', 't19g-reason'),
      h('p', { class: 't19g-allowed' }, G.allowed)))
  board.inert = true
  // the three carved tags on the fence (they swing in once he is in) and the words of the last one heard, on the forecourt
  const V = G.voices
  const tagDotAt = V.map(() => h('span', { class: 't19g-tag-dot', 'aria-hidden': 'true' }))
  const tags = V.map((v, i) => {
    const b = h('button', { class: 't19g-tag', type: 'button', style: `--i:${i}`, 'aria-pressed': 'false', 'aria-label': fill(G.markAria, { who: v.who }) },
      s('svg', { class: 't19g-tag-svg', viewBox: '-22 -8 44 64', 'aria-hidden': 'true' }, ...tagArt(i)), tagDotAt[i])
    b.disabled = true
    b.addEventListener('click', () => hear(i))
    return b
  })
  const voice = h('div', { class: 't19g-voice', 'aria-live': 'polite' })
  // the picture is one role="img"; the fence layer (it holds the bolt, the only control) sits outside it, stacked by z-index
  const scene = h('div', { class: 't19g-scene', role: 'img', 'aria-label': G.art }, sky.el, peak.el, inner.el, fg.el)
  const root = h('div', { class: `t19g${deep ? ' deep' : ''}` }, scene, fence.el, keeper, board, ...tags)
  ctx.art.append(root, voice) // the words sit outside the painting's soft lower edge
  ctx.prompt(G.prompt)
  const g = guide(ctx)
  const boltDot = g.dot(boltGrip, { dir: [1, 0] })
  let keeperDot: { done(): void } | null = null
  let tagDots: ({ done(): void } | null)[] = []
  let count: { set(n: number): void } | null = null
  let countPt: Pt = [0, 0]

  let W = 0, H = 0
  let slide = 0, maxSlide = 1
  let jammed = false // the bolt has been tried
  let opened = false // the wicket has let him in
  const layers = [sky.el, peak.el, inner.el, fence.el, fg.el]
  const depth = [0.12, 0.28, 0.55, 1, 1.9] // parallax share of the 12 px swing
  const parallax = (nx: number, ny: number) => {
    if (!deep) return
    layers.forEach((el, i) => (el.style.transform = `translate(${f1(-nx * 12 * depth[i])}px, ${f1(-ny * 6 * depth[i])}px)`))
  }
  const grad = (id: string, stops: [number, string, number][], x2 = 1, y2 = 0) =>
    s('linearGradient', { id: `${uid}-${id}`, x1: 0, y1: 0, x2, y2 }, ...stops.map(([o, c, a]) => s('stop', { offset: o, style: `stop-color:${c};stop-opacity:${a}` })))
  const url = (id: string) => `url(#${uid}-${id})`

  function layout() {
    W = ctx.art.clientWidth
    H = ctx.art.clientHeight
    if (W < 60 || H < 60) return
    root.style.height = `${f1(H)}px`
    const tall = W / H < 1
    root.classList.toggle('tall', tall)
    const r = rng(1919)
    const gx = W / 2
    const gy = H * (tall ? 0.68 : 0.74) // the gate's sill
    const GW = clamp(Math.min(W * (tall ? 0.52 : 0.27), H * 0.4), 140, 380) // tall: room beside it for the wicket
    const DH = Math.min(H * (tall ? 0.3 : 0.4), GW * 1.25)
    const FH = DH * 0.9
    const pw = clamp(GW * 0.075, 8, 22) // a culm's width by the gate
    for (const L of [sky, peak, inner, fence, fg]) L.svg.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)

    // 5 · sky: the moon over the right shoulder, its glow, mist banks
    const mr = clamp(Math.min(W, H) * 0.05, 18, 44)
    const mx = W * (tall ? 0.8 : 0.79), my = H * (tall ? 0.1 : 0.13)
    sky.svg.replaceChildren(
      s('circle', { class: 't19g-moonglow', cx: f1(mx), cy: f1(my), r: f1(Math.max(W, H) * 0.42), fill: 'url(#p2-halo)' }),
      mist(W * 0.4, H * 0.34, W * 0.8, H * 0.16),
      moon(mx, my, mr, 1917, true),
      mist(W * 0.66, H * 0.08, W * 0.36, H * 0.05))

    // 4 · the summit rising behind the compound, far ranges, mist at its foot; on its far slope the faint band of forty-odd lamps
    const wTop = gy - DH * 1.08
    let band = ''
    for (let i = 0; i < 44; i++) {
      const t = i / 43
      const x = W * (0.1 + 0.8 * t) + (r() - 0.5) * 10
      band += `M${f1(x)} ${f1(wTop - H * 0.035 - Math.sin(t * Math.PI) * H * 0.04 + (r() - 0.5) * 6)}h${f1(1.2 + r() * 1.4)}`
    }
    peak.svg.replaceChildren(
      hills(-W * 0.06, W * 1.06, wTop + H * 0.02, H * 0.15, 191, 0.95, 7),
      mist(W * 0.5, wTop, W * 0.85, H * 0.07),
      hills(W * (tall ? -0.1 : 0.12), W * (tall ? 0.66 : 0.6), wTop + H * 0.01, wTop - H * (tall ? 0.16 : 0.1), 194, 0.2, 1),
      s('path', { class: 't19g-band', d: band }),
      mist(W * 0.5, wTop + H * 0.015, W * 0.42, H * 0.04))

    // 3 · inside: a curved wall of dressed stone (lit tops, dark faces, code cut into each block), lamplit; the red crack;
    //     two masons; lanterns; twelve small lamps along the coping
    paintInside(r, gx, gy, GW, DH, wTop, tall)

    // 2 · the fence rings the summit, so from the gate it curves away on both sides: culms of every height, leaning, at
    //     uneven spacing, tied to two rails; toward both ends they pale into the mist
    const defs = s('defs', null,
      grad('c0', [[0, 'var(--wash)', 0.95], [0.32, 'color-mix(in srgb, var(--moss-b) 38%, var(--wash))', 1], [0.74, 'color-mix(in srgb, var(--moss-b) 45%, var(--rock-mid))', 1], [0.88, 'var(--t19g-lit)', 1], [1, 'var(--wash)', 0.85]]),
      grad('c1', [[0, 'color-mix(in srgb, var(--wash) 60%, var(--t19g-far))', 0.9], [0.4, 'color-mix(in srgb, var(--moss-b) 30%, color-mix(in srgb, var(--wash) 50%, var(--t19g-far)))', 1], [0.85, 'color-mix(in srgb, var(--moss-a) 35%, var(--t19g-far))', 1], [1, 'color-mix(in srgb, var(--wash) 45%, var(--t19g-far))', 0.8]]),
      grad('c2', [[0, 'color-mix(in srgb, var(--wash) 26%, var(--t19g-far))', 0.75], [0.5, 'color-mix(in srgb, var(--moss-b) 14%, var(--t19g-far))', 0.8], [1, 'color-mix(in srgb, var(--wash) 20%, var(--t19g-far))', 0.65]]),
      grad('post', [[0, 'var(--wash)', 1], [0.35, 'color-mix(in srgb, var(--step-lo) 55%, var(--wash))', 1], [0.8, 'var(--step-lo)', 1], [0.92, 'var(--t19g-lit)', 1], [1, 'var(--wash)', 1]]),
      grad('ground', [[0, 'var(--wash)', 0], [0.3, 'var(--wash)', 0.2], [1, 'var(--wash)', 0.42]], 0, 1),
      s('radialGradient', { id: `${uid}-leak`, cx: 0.5, cy: 0, r: 1 },
        s('stop', { offset: 0, style: 'stop-color:var(--lantern);stop-opacity:.5' }),
        s('stop', { offset: 0.6, style: 'stop-color:var(--lantern);stop-opacity:.12' }),
        s('stop', { offset: 1, style: 'stop-color:var(--lantern);stop-opacity:0' })),
      s('filter', { id: `${uid}-soft`, x: '-10%', y: '-10%', width: '120%', height: '120%' }, s('feGaussianBlur', { stdDeviation: clamp(GW * 0.008, 1.2, 3) })))
    const Rx = W * (tall ? 0.5 : 0.42), Ry = H * (tall ? 0.1 : 0.15)
    type Post = { x: number; y: number; h: number; w: number; d: number; lean: number }
    const postsL: Post[] = []
    for (const side of [-1, 1]) {
      let th = 0.02
      while (th < 1.45) {
        const sc = 1 - 0.6 * (1 - Math.cos(th))
        const x = gx + side * (GW / 2 + pw * 2.4 + Rx * Math.sin(th))
        if (x < -pw * 2 || x > W + pw * 2) break
        const w = pw * sc * (0.75 + r() * 0.45)
        postsL.push({ x, y: gy - Ry * (1 - Math.cos(th)) + (r() - 0.5) * 3, h: FH * sc * (0.78 + r() * 0.34), w, d: 1 - Math.cos(th), lean: (r() - 0.5) * FH * sc * 0.09 })
        // uneven spacing: mostly tight, now and then a culm's width of air
        th += (w * (1.02 + (r() < 0.18 ? 0.9 : r() * 0.25))) / (Rx * Math.max(0.12, Math.cos(th)))
      }
    }
    postsL.sort((a, b) => b.d - a.d) // far first
    const culms: SVGElement[] = []
    let nodes = '', ties = '', rims = ''
    const railY = (p: Post, k: number) => p.y - FH * (1 - 0.6 * p.d) * k
    for (const p of postsL) {
      const c = culm(p.x, p.y - p.h, p.y + 3, p.w, p.lean, r, 'r')
      const far = p.d > 0.42 ? 'c2' : p.d > 0.14 ? 'c1' : 'c0'
      culms.push(s('path', { d: c.body, fill: url(far) }))
      if (far !== 'c2') nodes += c.nodes
      if (far === 'c0') rims += c.rim
      // the rope that ties each culm to the rails: a crossed wrap
      for (const k of [0.32, 0.72]) {
        const y = railY(p, k)
        if (far === 'c2') continue
        const q = p.w * 0.62
        ties += stroke([[p.x - q, y - q * 0.5], [p.x + q, y + q * 0.45]], Math.max(0.9, p.w * 0.14), 0.2, 0.2, 0.4) + stroke([[p.x - q, y + q * 0.4], [p.x + q, y - q * 0.5]], Math.max(0.8, p.w * 0.11), 0.2, 0.2, 0.4)
      }
    }
    // rails: a split bamboo bar riding the curve on each side, twice
    const railPts = (side: number, k: number): Pt[] => postsL.filter((p) => Math.sign(p.x - gx) === side).sort((a, b) => a.d - b.d).map((p) => [p.x, railY(p, k)] as Pt)
    let rails = ''
    for (const side of [-1, 1]) for (const k of [0.32, 0.72]) {
      const pts = railPts(side, k)
      if (pts.length > 2) rails += stroke(pts, pw * 0.34, 0.02, 0.5, 0.25)
    }
    const gpL = gx - GW / 2 - pw * 0.7, gpR = gx + GW / 2 + pw * 0.7
    const gTop = gy - DH - pw * 1.2
    const beam = stroke([[gx - GW * 0.74, gTop - pw * 0.7], [gx - GW * 0.45, gTop], [gx + GW * 0.45, gTop], [gx + GW * 0.74, gTop - pw * 0.7]], pw * 1.1, 0.05, 0.05, 0.6)
    const rw = GW * 0.86, rTop = gTop - pw * 3.4
    const roofD = `M${f1(gx - rw)} ${f1(gTop - pw * 0.7)}Q${f1(gx - rw * 0.55)} ${f1(gTop - pw * 1.5)} ${f1(gx - rw * 0.42)} ${f1(rTop)}L${f1(gx + rw * 0.42)} ${f1(rTop)}Q${f1(gx + rw * 0.55)} ${f1(gTop - pw * 1.5)} ${f1(gx + rw)} ${f1(gTop - pw * 0.7)}Q${f1(gx)} ${f1(gTop - pw * 1.9)} ${f1(gx - rw)} ${f1(gTop - pw * 0.7)}Z`
    let tiles = ''
    for (let k = 1; k < 16; k++) {
      const t = k / 16
      const x0 = gx - rw * 0.42 + rw * 0.84 * t, x1 = gx - rw + rw * 2 * t
      tiles += stroke([[x0, rTop + 2], [x1, gTop - pw * (0.9 + 0.8 * (1 - Math.abs(2 * t - 1)))]], 1.3, 0.1, 0.2, 0.3)
    }
    const ground = `M-10 ${f1(gy - 4)}Q${f1(W * 0.3)} ${f1(gy - 10)} ${f1(W * 0.55)} ${f1(gy - 5)}T${f1(W + 10)} ${f1(gy - 8)}V${f1(H + 20)}H-10Z`
    // the forecourt's raked lines, faint, running across under the gate
    let rake = ''
    for (let i = 1; i < 7; i++) {
      const y = gy + Math.pow(i / 6, 1.5) * (H - gy) * 0.95
      rake += stroke([[-10, y + 2], [gx * 0.6, y - 1], [gx, y + 1], [W * 0.8, y - 1], [W + 10, y + 2]], 0.8 + i * 0.25, 0.05, 0.05, 0.4)
    }

    // ★ the moon (upper right) throws the gate down the forecourt toward the eye and to the left: posts and the plank panel
    //   solid, the lattice as a diamond net of shadow with moonlight in its holes. Drawn in the door's own plane (u along the
    //   sill, v up the door), mapped onto the ground by one affine transform.
    const sx = GW * 0.62, sy = Math.min(H - gy - 6, DH * 0.42)
    const x0 = gx - GW / 2
    const shadow = s('g', { class: 't19g-moonsh', transform: `matrix(1 0 ${f1(-sx / DH)} ${f1(sy / DH)} ${f1(x0)} ${f1(gy)})`, filter: low ? null : url('soft') })
    {
      const kickV = DH * 0.4, fr = clamp(GW * 0.04, 6, 16)
      let d = `M0 0H${f1(GW)}V${f1(kickV)}H0Z` // the plank panel, solid
      d += `M${f1(-pw * 1.5)} 0h${f1(pw * 1.5)}V${f1(DH * 1.12)}h${f1(-pw * 1.5)}Z M${f1(GW)} 0h${f1(pw * 1.5)}V${f1(DH * 1.12)}h${f1(-pw * 1.5)}Z` // the posts
      d += `M0 ${f1(DH - fr)}H${f1(GW)}V${f1(DH)}H0Z M0 ${f1(kickV)}V${f1(DH)}h${f1(fr)}V${f1(kickV)}Z M${f1(GW - fr)} ${f1(kickV)}V${f1(DH)}h${f1(fr)}V${f1(kickV)}Z M${f1(GW / 2 - fr * 0.6)} ${f1(kickV)}V${f1(DH)}h${f1(fr * 1.2)}V${f1(kickV)}Z`
      d += `M${f1(-pw * 2.6)} ${f1(DH * 1.1)}H${f1(GW + pw * 2.6)}V${f1(DH * 1.32)}H${f1(-pw * 2.6)}Z` // the beam and roof
      const cell = clamp(GW / 7.2, 16, 46), lw = clamp(GW * 0.014, 2, 4.5)
      let lat = ''
      for (let k = -DH; k < GW + DH; k += cell) {
        lat += stroke([[k, kickV], [k + (DH - kickV), DH]], lw, 0.02, 0.02, 0.8) + stroke([[k, DH], [k + (DH - kickV), kickV]], lw, 0.02, 0.02, 0.8)
      }
      const clip = `${uid}-shclip`
      shadow.append(
        s('clipPath', { id: clip }, s('rect', { x: 0, y: f1(kickV), width: f1(GW), height: f1(DH - kickV) })),
        s('path', { class: 't19g-moonsh-solid', d }),
        s('path', { class: 't19g-moonsh-lat', d: lat, 'clip-path': `url(#${clip})` }))
    }
    // warm light from the court leaking through the seam between the doors, fanning out over the forecourt
    const leak = s('g', { class: 't19g-leak' },
      s('path', { d: `M${f1(gx - 2)} ${f1(gy)}L${f1(gx + 2)} ${f1(gy)}L${f1(gx + GW * 0.16)} ${f1(H + 4)}L${f1(gx - GW * 0.22)} ${f1(H + 4)}Z`, fill: url('leak') }))
    // the stepping stones up to the sill: dressed stones in three tones, moss on their tops
    const steps = s('g', { class: 't19g-steps' })
    const nSteps = tall ? 3 : 4
    for (let i = 0; i < nSteps; i++) {
      const t = i / (nSteps - 1)
      const y = gy + H * 0.03 + (H - gy) * 0.95 * Math.pow(t, 1.15)
      const x = gx + (r() - 0.5) * GW * 0.14 - t * GW * 0.04
      const w = GW * (0.34 + t * 0.32) * (0.9 + r() * 0.2)
      const hh = w * (0.2 + r() * 0.05)
      const st = stoneArt(w, hh, 1951 + i * 7, 'p2-stone t19g-step')
      st.setAttribute('transform', `translate(${f1(x)} ${f1(y)})`)
      steps.append(st, wash(blob(x - w * (0.12 - r() * 0.1), y - hh * 0.72, w * 0.22, hh * 0.16, 1960 + i, 0.3), 0.6, 'p2p-wash t19g-moss'))
    }
    fence.svg.replaceChildren(defs,
      mist(gx, gy - Ry * 0.9, W * 0.7, H * 0.06),
      s('path', { class: 't19g-ground', d: ground, fill: url('ground') }),
      s('path', { class: 't19g-rake', d: rake }),
      shadow,
      leak,
      s('g', { filter: low ? null : 'url(#ink-rough)' }, ...culms),
      s('path', { class: 't19g-node', d: nodes }),
      s('path', { class: 't19g-culm-rim', d: rims }),
      s('path', { class: 't19g-rail', d: rails, filter: 'url(#ink-rough)' }),
      s('path', { class: 't19g-knot', d: ties }),
      // both ends of the fence go into the mist
      mist(-W * 0.02, gy - FH * 0.45, W * 0.16, FH * 0.75),
      mist(W * 1.02, gy - FH * 0.45, W * 0.16, FH * 0.75),
      mist(gx, gy + H * 0.01, W * 0.55, H * 0.025),
      steps,
      wash(blob(gx - GW * 0.85, gy + H * 0.035, GW * 0.5, H * 0.02, 1903, 0.25), 0.3, 'p2p-wash t19g-moss'),
      wash(blob(gx + GW * 0.9, gy + H * 0.045, GW * 0.42, H * 0.018, 1904, 0.25), 0.3, 'p2p-wash t19g-moss'),
      grass(gx - GW * 0.72, gy + 6, clamp(W * 0.04, 18, 50), 1905),
      grass(gx + GW * 0.7, gy + 8, clamp(W * 0.03, 14, 40), 1906),
      s('rect', { x: f1(gpL - pw * 0.75), y: f1(gTop - pw), width: f1(pw * 1.5), height: f1(gy + 6 - gTop + pw), fill: url('post') }),
      s('rect', { x: f1(gpR - pw * 0.75), y: f1(gTop - pw), width: f1(pw * 1.5), height: f1(gy + 6 - gTop + pw), fill: url('post') }),
      s('path', { class: 't19g-post-grain', d: stroke([[gpL - pw * 0.2, gTop + pw], [gpL - pw * 0.25, gy]], 1, 0.2, 0.2, 0.3) + stroke([[gpR + pw * 0.2, gTop + pw * 2], [gpR + pw * 0.15, gy - pw]], 1, 0.2, 0.2, 0.3) }),
      s('path', { class: 't19g-roof', d: roofD, filter: 'url(#ink-wash)' }),
      s('path', { class: 't19g-tiles', d: tiles }),
      s('path', { class: 't19g-roof-ink', d: stroke([[gx - rw, gTop - pw * 0.7], [gx, gTop - pw * 1.75], [gx + rw, gTop - pw * 0.7]], 2.6, 0.05, 0.05, 0.4) + stroke([[gx - rw * 0.44, rTop], [gx + rw * 0.44, rTop]], pw * 0.5, 0.1, 0.1, 0.5), filter: 'url(#ink-rough)' }),
      s('path', { class: 't19g-beam', d: beam, fill: url('post') }))
    Object.assign(gate.style, { left: `${f1(gx - GW / 2)}px`, top: `${f1(gy - DH)}px`, width: `${f1(GW)}px`, height: `${f1(DH)}px` })
    const dw = GW / 2
    paintDoor(doorL.firstChild as SVGSVGElement, dw, DH, 'l')
    paintDoor(doorR.firstChild as SVGSVGElement, dw, DH, 'r')
    // the bolt: a rough-hewn beam through two brackets, across both doors at mid height, its shadow on the planks
    const bw = GW * 0.62, bh = clamp(DH * 0.068, 11, 26)
    maxSlide = clamp(GW * 0.025, 4, 9) // it gives a little, then sticks
    Object.assign(bolt.style, { left: `${f1(GW / 2 - bw / 2)}px`, top: `${f1(DH * 0.52 - bh / 2)}px`, width: `${f1(bw)}px`, height: `${f1(bh)}px` })
    boltArt.setAttribute('viewBox', `0 0 ${f1(bw)} ${f1(bh)}`)
    const rb = rng(1944)
    const edge = (y: number, n: number) => Array.from({ length: n + 1 }, (_, i) => [(bw * i) / n, y + (rb() - 0.5) * bh * 0.12] as Pt)
    const topE = edge(bh * 0.04, 10), botE = edge(bh * 0.96, 10)
    const beamD = `M${f1(bh * 0.18)} ${f1(topE[0][1])}${topE.slice(1, -1).map(([x, y]) => `L${f1(x)} ${f1(y)}`).join('')}L${f1(bw - bh * 0.12)} ${f1(topE[10][1])}L${f1(bw)} ${f1(bh * 0.4)}L${f1(bw - bh * 0.06)} ${f1(botE[10][1])}${botE.slice(1, -1).reverse().map(([x, y]) => `L${f1(x)} ${f1(y)}`).join('')}L${f1(0)} ${f1(botE[0][1])}L${f1(bh * 0.08)} ${f1(bh * 0.5)}Z`
    let grainB = ''
    for (let k = 0; k < 5; k++) {
      const y = bh * (0.22 + k * 0.15) + (rb() - 0.5) * 2
      const xa = rb() * bw * 0.3, xb = bw * (0.6 + rb() * 0.38)
      grainB += stroke([[xa, y], [(xa + xb) / 2, y + (rb() - 0.5) * bh * 0.2], [xb, y + (rb() - 0.5) * bh * 0.1]], 0.8 + rb() * 0.9, 0.3, 0.3, 0.2)
    }
    boltArt.replaceChildren(
      s('defs', null, grad('bolt', [[0, 'var(--step-hi)', 1], [0.35, 'var(--step-mid)', 1], [1, 'color-mix(in srgb, var(--step-lo) 80%, var(--wash))', 1]], 0, 1)),
      s('path', { class: 't19g-bolt-sh', d: beamD, transform: `translate(${f1(-bh * 0.35)} ${f1(bh * 0.55)})` }),
      s('path', { class: 't19g-bolt-body', d: beamD, fill: url('bolt') }),
      s('path', { class: 't19g-bolt-grain', d: grainB }),
      s('path', { class: 't19g-bolt-end', d: `M0 ${f1(botE[0][1])}L${f1(bh * 0.08)} ${f1(bh * 0.5)}L${f1(bh * 0.18)} ${f1(topE[0][1])}L${f1(bh * 0.42)} ${f1(topE[1][1])}L${f1(bh * 0.3)} ${f1(botE[1][1])}Z` }),
      s('path', { class: 't19g-bolt-ink', d: stroke(topE, 1.4, 0.05, 0.05, 0.6) + stroke(botE, 2.2, 0.05, 0.05, 0.6) }))
    setSlide(slide)
    // the wicket and its bearer in the left third, on the fence line (tall: by the left edge)
    const kh = tall ? DH * 0.5 : clamp(DH * 0.78, 80, 260), kw = kh * 0.95
    const kx = tall ? Math.max(2, gx - GW / 2 - pw * 1.6 - kw) : W * 0.17
    Object.assign(keeper.style, { left: `${f1(kx)}px`, top: `${f1(gy + 4 - kh)}px`, width: `${f1(kw)}px`, height: `${f1(kh)}px` })
    wicket.setAttribute('viewBox', `0 0 ${f1(kw)} ${f1(kh)}`)
    wicket.replaceChildren(...wicketArt(kw, kh))
    keeperDotAt.style.left = `${f1(kh * 0.49)}px`
    keeperDotAt.style.top = `${f1(kh * 0.24)}px`
    // the three tags hang from the upper rail of the right-hand fence, in step with the board on the left (tall: no room
    // there, and the board hangs over the beam, so they are tied to the stuck bolt); their words go on the forecourt below
    const tw = Math.max(44, tall ? 44 : clamp(GW * 0.22, 44, 78)), th = tw * (64 / 44) // never under 44 px to touch
    const right = postsL.filter((p) => p.x > gpR + pw)
    const railAt = (x: number) => railY(right.reduce((a, b) => (Math.abs(b.x - x) < Math.abs(a.x - x) ? b : a)), 0.72)
    const tagPts: Pt[] = tall || !right.length
      ? [-0.28, 0, 0.28].map((k) => [gx + GW * k, gy - DH * 0.48 + bh * 0.3] as Pt)
      : [0.2, 0.42, 0.64].map((k) => { const x = gpR + pw * 2 + (W - gpR) * k; return [x, railAt(x)] as Pt })
    tagPts.forEach(([x, y], i) => Object.assign(tags[i].style, { left: `${f1(x - tw / 2)}px`, top: `${f1(y - th / 8)}px`, width: `${f1(tw)}px`, height: `${f1(th)}px` }))
    // the count is carved on the clear gravel under the tags, as the first line over the words (never over the fence)
    const vx = tall ? 14 : tagPts[0][0] - tw, vy = gy + H * 0.03
    countPt = [vx + 64, vy + 10]
    Object.assign(voice.style, tall
      ? { left: `${f1(vx)}px`, width: `${f1(W - 28)}px`, top: `${f1(vy + 26)}px` }
      : { left: `${f1(vx)}px`, width: `${f1(Math.min(W * 0.97 - vx, 416))}px`, top: `${f1(vy + 26)}px` })

    // 1 · out of focus in front: two bamboo culms at the left edge, one at the right, a few leaves
    const fw = clamp(W * 0.045, 22, 64)
    const c1 = culm(W * 0.015, -30, H + 30, fw, 14, r), c2 = culm(W * 0.08, -30, H + 30, fw * 0.55, -8, r), c3 = culm(W * 0.98, -30, H + 30, fw * 1.1, -10, r)
    let leaves = ''
    for (const [x, y, d] of [[W * 0.05, H * 0.16, 1], [W * 0.085, H * 0.33, 1], [W * 0.96, H * 0.1, -1], [W * 0.94, H * 0.27, -1]] as const)
      for (let k = 0; k < 3; k++) leaves += stroke(curve([x, y], [x + d * fw * (1.2 + k * 0.4), y + fw * (0.1 + k * 0.4)], [x + d * fw * (2.2 + k * 0.5), y + fw * (0.6 + k * 0.5)], 8), fw * 0.3, 0.05, 0.6, 0.1)
    const blur = `${uid}-blur`
    fg.svg.replaceChildren(
      s('defs', null, s('filter', { id: blur, x: '-30%', y: '-5%', width: '160%', height: '110%' }, s('feGaussianBlur', { stdDeviation: clamp(W * 0.003, 2, 4.5) }))),
      s('g', { filter: low ? null : `url(#${blur})` },
        s('path', { class: 't19g-fg', d: c1.body + c2.body + c3.body + leaves }),
        s('path', { class: 't19g-fg-node', d: c1.nodes + c2.nodes + c3.nodes }),
        s('path', { class: 't19g-fg-rim', d: c1.rim + c2.rim + c3.rim })))
    g.refresh() // the count is placed from this layout's numbers
  }

  /** the compound inside the fence: a dressed-stone wall with volume and code cut into it, the crack, masons, lamps */
  function paintInside(r: () => number, gx: number, gy: number, GW: number, DH: number, wTop: number, tall: boolean) {
    const wBot = gy - DH * 0.02
    const wx0 = -W * 0.04, wx1 = W * 1.04
    // the wall rings the court too: toward both ends it turns away, its courses closing toward the horizon behind
    const yh = wTop - H * 0.03
    const wy = (x: number, y: number) => {
      const q = Math.min(1.3, Math.abs(x - gx) / (W * 0.55))
      return yh + (y - yh) * (1 - 0.34 * q * q)
    }
    const P = (x: number, y: number) => `${f1(x)} ${f1(wy(x, y))}`
    const quad = (xa: number, xb: number, ya: number, yb: number) => `M${P(xa, ya)}L${P((xa + xb) / 2, ya)}L${P(xb, ya)}L${P(xb, yb)}L${P((xa + xb) / 2, yb)}L${P(xa, yb)}Z`
    /** a dressed block: corners knocked off unevenly, its top a little crowned */
    const block = (xa: number, xb: number, ya: number, yb: number) => {
      const c = (yb - ya) * 0.16
      const j = () => (r() - 0.5) * c * 0.9
      return `M${P(xa + c + j(), ya + j())}L${P((xa + xb) / 2, ya - c * 0.25)}L${P(xb - c + j(), ya + j())}L${P(xb + j() * 0.5, ya + c)}L${P(xb + j() * 0.5, yb - c)}L${P(xb - c, yb + j() * 0.5)}L${P(xa + c, yb + j() * 0.5)}L${P(xa + j() * 0.5, yb - c)}L${P(xa + j() * 0.5, ya + c)}Z`
    }
    const rows = Math.max(5, Math.round((wBot - wTop) / clamp(H * 0.05, 14, 34)))
    const rh0 = (wBot - wTop) / rows
    const gap = clamp(rh0 * 0.07, 1, 2.6)
    // courses of uneven height, heavier toward the foot
    const hs = Array.from({ length: rows }, (_, i) => (0.8 + r() * 0.4) * (0.85 + 0.3 * (i / rows)))
    const hsum = hs.reduce((a, b) => a + b, 0)
    let faceA = '', faceB = '', faceC = '', tops = '', shade = '', codeD = '', codeL = '', mossD = ''
    let yRow = wTop
    for (let i = 0; i < rows; i++) {
      const rh = (hs[i] / hsum) * (wBot - wTop)
      const y0 = yRow, y1 = y0 + rh
      yRow = y1
      let x = wx0 - r() * rh * 1.5
      while (x < wx1) {
        const sw = rh * (1.3 + r() * 2.1)
        const xa = x + gap, xb = Math.min(wx1 + rh, x + sw - gap)
        const ya = y0 + gap + (r() - 0.5) * gap, yb = y1 - gap + (r() - 0.5) * gap
        const d = block(xa, xb, ya, yb)
        const tone = r()
        if (tone < 0.3) faceB += d
        else if (tone < 0.45) faceC += d
        else faceA += d
        // the dressed top edge catches the moon; the underside and the right-hand flank fall into shade
        tops += quad(xa + rh * 0.12, xb - rh * 0.12, ya, ya + rh * 0.13)
        shade += quad(xa + rh * 0.1, xb - rh * 0.1, yb - rh * 0.12, yb) + quad(xb - gap * 1.6, xb, ya + rh * 0.15, yb - rh * 0.1)
        if (r() < 0.16) mossD += blob(xa + (xb - xa) * (0.2 + r() * 0.6), wy(xa, yb), rh * (0.3 + r() * 0.4), rh * 0.1, 1970 + i * 31 + Math.round(x), 0.4, 10)
        // a line or two of code cut into most blocks: a dark groove, its lower lip lit
        const n = r() < 0.3 ? 0 : sw > rh * 2.3 ? 2 : 1
        for (let k = 0; k < n; k++) {
          const cy = ya + (yb - ya) * (n === 1 ? 0.52 : 0.38 + k * 0.28)
          let cx = xa + rh * (0.25 + r() * 0.25) + (k ? rh * 0.3 : 0)
          const end = xb - rh * 0.3
          while (cx < end) {
            const len = Math.min(end - cx, rh * (0.1 + r() * 0.5))
            if (len > rh * 0.08) {
              codeD += `M${P(cx, cy)}L${P(cx + len, cy)}`
              codeL += `M${P(cx, cy + 1.2)}L${P(cx + len, cy + 1.2)}`
            }
            cx += len + rh * (0.1 + r() * 0.12)
          }
        }
        x += sw
      }
    }
    // the coping along the top: a lit upper surface and a dark lip
    const rh = rh0
    const copeH = rh * 0.55
    const along = (y: number, rev = false) => Array.from({ length: 25 }, (_, k) => { const x = wx0 + ((wx1 - wx0) * (rev ? 24 - k : k)) / 24; return P(x, y) }).join('L')
    const coping = `M${along(wTop - copeH)}L${along(wTop, true)}Z`
    const copeTop = `M${along(wTop - copeH)}L${along(wTop - copeH * 0.45, true)}Z`
    // the crack: a thin vermilion fissure stepping down through the blocks and along their joints, broken where it is hairline
    const ch = wBot - wTop
    const crack: Pt[] = [[gx + rh * 0.2, wTop - copeH * 0.4]]
    let cxk = gx + rh * 0.2
    for (let i = 0; i < Math.round(rows * 0.68); i++) {
      const y0 = wTop + i * rh
      cxk += (r() - 0.5) * rh * 0.25
      crack.push([cxk, y0 + rh * 0.45])
      cxk += (r() < 0.5 ? -1 : 1) * rh * (0.25 + r() * 0.35)
      crack.push([cxk, y0 + rh])
    }
    const crackPts = crack.map(([x, y]) => [x, wy(x, y)] as Pt)
    let crackD = ''
    for (let i = 0; i < crackPts.length - 1; i++) {
      const [ax, ay] = crackPts[i], [bx, by] = crackPts[i + 1]
      // hairline breaks: each leg drawn in one or two pieces with a gap
      const cut = r() < 0.4 ? 0.55 + r() * 0.2 : 1
      crackD += stroke([[ax, ay], [ax + (bx - ax) * cut, ay + (by - ay) * cut]], clamp(W * 0.0012, 1, 1.9), 0.25, 0.3, 0.35)
      if (cut < 1) crackD += stroke([[ax + (bx - ax) * (cut + 0.12), ay + (by - ay) * (cut + 0.12)], [bx, by]], clamp(W * 0.001, 0.9, 1.6), 0.3, 0.3, 0.3)
    }
    const br = crackPts[Math.min(3, crackPts.length - 1)]
    crackD += stroke([br, [br[0] + rh * 0.5, br[1] + rh * 0.35], [br[0] + rh * 0.8, br[1] + rh * 0.3]], clamp(W * 0.0009, 0.8, 1.3), 0.3, 0.5, 0.2)
    const crackEnd = crackPts[crackPts.length - 1]
    const toroH = clamp(DH * 0.42, 50, 150)
    const tx0 = gx - Math.max(GW * 0.95, W * (tall ? 0.3 : 0.24)), tx1 = gx + Math.max(GW * 0.95, W * (tall ? 0.3 : 0.24))
    const workH = clamp(DH * 0.36, 34, 120)
    const mA = mason(crackEnd[0] - workH * 0.42, wBot + 2, workH, 1, 'reach')
    const mB = mason(crackEnd[0] + workH * 0.55, wBot, workH * 0.95, -1, 'bend')
    // twelve small lamps hung along the coping (the twelve launch partners); the tallest arc, in front of the far band
    let lamps = '', cords = '', halos: SVGElement[] = []
    const lampR = clamp(W * 0.0042, 3.2, 6.5)
    const lampX = (i: number) => wx0 + W * 0.08 + ((wx1 - wx0 - W * 0.16) * (i + 0.5)) / 12
    for (let i = 0; i < 12; i++) {
      const x = lampX(i)
      const y = wy(x, wTop - copeH) - lampR * 2.4
      lamps += `M${f1(x - lampR)} ${f1(y)}a${f1(lampR)} ${f1(lampR * 1.25)} 0 1 0 ${f1(lampR * 2)} 0a${f1(lampR)} ${f1(lampR * 1.25)} 0 1 0 ${f1(-lampR * 2)} 0`
      halos.push(s('circle', { cx: f1(x), cy: f1(y), r: f1(lampR * 4.5), fill: url('pool') }))
      if (i < 11) {
        const x2 = lampX(i + 1)
        cords += `M${f1(x)} ${f1(y - lampR * 1.3)}Q${f1((x + x2) / 2)} ${f1(y + lampR * 0.6)} ${f1(x2)} ${f1(wy(x2, wTop - copeH) - lampR * 3.7)}`
      }
    }
    if (low) halos = []
    let rake = ''
    for (let i = 0; i < 8; i++) {
      const y = wBot + 8 + Math.pow(i / 7, 1.4) * (H - wBot)
      rake += stroke([[-10, y + 2], [gx, y + 4], [W + 10, y + 2]], 1 + i * 0.3, 0.05, 0.05, 0.3)
    }
    inner.svg.replaceChildren(
      s('defs', null,
        grad('wall', [[0, 'var(--rock-mid)', 1], [0.7, 'color-mix(in srgb, var(--rock-mid) 45%, var(--rock-lo))', 1], [1, 'var(--rock-lo)', 1]], 0, 1),
        grad('wallB', [[0, 'color-mix(in srgb, var(--rock-mid) 70%, var(--rock-lo))', 1], [1, 'color-mix(in srgb, var(--rock-lo) 80%, var(--wash))', 1]], 0, 1),
        s('radialGradient', { id: `${uid}-pool` }, s('stop', { offset: 0, style: 'stop-color:var(--lantern);stop-opacity:.42' }), s('stop', { offset: 0.5, style: 'stop-color:var(--lantern);stop-opacity:.12' }), s('stop', { offset: 1, style: 'stop-color:var(--lantern);stop-opacity:0' }))),
      s('path', { class: 't19g-ground-in', d: `M0 ${f1(wBot - 6)}H${f1(W)}V${f1(H + 30)}H0Z` }),
      s('path', { class: 't19g-rake', d: rake }),
      s('path', { class: 't19g-joint-bed', d: `M${along(wTop)}L${along(wBot, true)}Z` }),
      s('g', { filter: low ? null : 'url(#ink-rough)' },
        s('path', { class: 't19g-face', d: faceA, fill: url('wall') }),
        s('path', { class: 't19g-face', d: faceB, fill: url('wallB') }),
        s('path', { class: 't19g-face t19g-face-c', d: faceC, fill: url('wall') })),
      s('path', { class: 't19g-wall-moss', d: mossD }),
      s('path', { class: 't19g-stone-top', d: tops }),
      s('path', { class: 't19g-stone-shade', d: shade }),
      s('path', { class: 't19g-code-lip', d: codeL }),
      s('path', { class: 't19g-code', d: codeD }),
      s('path', { class: 't19g-coping', d: coping }),
      s('path', { class: 't19g-coping-top', d: copeTop }),
      s('path', { class: 't19g-wall-ink', d: stroke(Array.from({ length: 13 }, (_, k) => { const x = wx0 + ((wx1 - wx0) * k) / 12; return [x, wy(x, wTop)] as Pt }), 2.4, 0.03, 0.03, 0.5), filter: 'url(#ink-rough)' }),
      s('path', { class: 't19g-wall-foot', d: stroke(Array.from({ length: 13 }, (_, k) => { const x = wx0 + ((wx1 - wx0) * k) / 12; return [x, wy(x, wBot)] as Pt }), 5, 0.03, 0.03, 0.5) }),
      mist(wx0 + W * 0.02, (wTop + wBot) / 2, W * 0.22, (wBot - wTop) * 0.8),
      mist(wx1 - W * 0.02, (wTop + wBot) / 2, W * 0.22, (wBot - wTop) * 0.8),
      mist(gx, wBot + H * 0.01, W * 0.6, H * 0.02),
      s('ellipse', { cx: f1(tx0), cy: f1(wBot + 4), rx: f1(toroH * 1.5), ry: f1(toroH * 0.9), fill: url('pool') }),
      s('ellipse', { cx: f1(tx1), cy: f1(wBot + 4), rx: f1(toroH * 1.5), ry: f1(toroH * 0.9), fill: url('pool') }),
      s('ellipse', { class: 't19g-workglow', cx: f1(crackEnd[0]), cy: f1(wTop + ch * 0.62), rx: f1(workH * 2.2), ry: f1(ch * 0.62), fill: url('pool') }),
      s('path', { class: 't19g-mortar', d: `M${crackPts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}`, pathLength: 1 }),
      s('path', { class: 't19g-crack', d: crackD }),
      s('ellipse', { class: 't19g-contact', cx: f1(crackEnd[0] - workH * 0.42), cy: f1(wBot + 3), rx: f1(workH * 0.3), ry: f1(workH * 0.05) }),
      s('ellipse', { class: 't19g-contact', cx: f1(crackEnd[0] + workH * 0.75), cy: f1(wBot + 2), rx: f1(workH * 0.42), ry: f1(workH * 0.05) }),
      s('path', { class: 't19g-worker', d: mA.body + mB.body }),
      s('path', { class: 't19g-worker-rim', d: mA.rim + mB.rim }),
      s('path', { class: 't19g-trowel', d: mA.blade + mB.blade }),
      ...halos,
      s('path', { class: 't19g-cord', d: cords }),
      s('path', { class: 't19g-lamps', d: lamps }),
      toro(tx0, wBot + 6, toroH, true),
      toro(tx1, wBot + 6, toroH, true))
  }

  /**
   * A door leaf, dw × dh: boards of grey wood below (dry-ink grain, dark seams, a knot), a lattice of split bamboo tied at
   * its crossings above, a heavy frame with darker inner edges, iron straps on the hinge side, the bolt's bracket; the moon
   * from the upper right on its face.
   */
  function paintDoor(svg: SVGSVGElement, dw: number, dh: number, side: 'l' | 'r') {
    const r = rng(side === 'l' ? 1931 : 1937)
    svg.setAttribute('viewBox', `0 0 ${f1(dw)} ${f1(dh)}`)
    const fr = clamp(dw * 0.085, 6, 16)
    const kick = dh * 0.6
    // the lattice: split bamboo, every strip its own weight, tied with cord where they cross
    let lat = '', latSh = '', knots = ''
    const cell = clamp(dw / 3.6, 16, 46)
    const lw = clamp(dw * 0.03, 2.2, 5)
    const span = kick - fr
    for (let k = -span; k < dw + span; k += cell) {
      const wa = lw * (0.75 + r() * 0.6), wb = lw * (0.75 + r() * 0.6)
      const a: Pt[] = [[k, fr], [k + span * 0.5 + (r() - 0.5) * 2, fr + span * 0.5], [k + span, kick]]
      const b: Pt[] = [[k, kick], [k + span * 0.5 + (r() - 0.5) * 2, fr + span * 0.5], [k + span, fr]]
      lat += stroke(a, wa, 0.06, 0.08, 0.55) + stroke(b, wb, 0.06, 0.08, 0.55)
      latSh += stroke(a.map(([x, y]) => [x - lw * 0.6, y + lw * 0.9] as Pt), wa, 0.06, 0.08, 0.55) + stroke(b.map(([x, y]) => [x - lw * 0.6, y + lw * 0.9] as Pt), wb, 0.06, 0.08, 0.55)
    }
    // the cord knots where the strips cross
    for (let m1 = 0; -span + m1 * cell < dw + span; m1++)
      for (let m2 = 0; -span + m2 * cell < dw + span; m2++) {
        const k1 = -span + m1 * cell, k2 = -span + m2 * cell
        const x = (k1 - fr + k2 + kick) / 2, y = (k2 + kick - k1 + fr) / 2
        if (y < fr + 2 || y > kick - 2 || x < fr || x > dw - fr) continue
        knots += stroke([[x - lw * 0.75, y - lw * 0.45], [x + lw * 0.75, y + lw * 0.45]], lw * 0.6, 0.2, 0.2, 0.5) + stroke([[x - lw * 0.55, y + lw * 0.55], [x + lw * 0.55, y - lw * 0.55]], lw * 0.42, 0.2, 0.2, 0.5)
      }
    // the boards below: dark seams, dry-ink grain running down each board, a knot
    let seams = '', grainD = '', knotD = ''
    const boards = 3
    for (let i = 0; i <= boards; i++) {
      const x = fr * 0.5 + ((dw - fr) * i) / boards + (r() - 0.5) * 2
      if (i > 0 && i < boards) seams += stroke([[x, kick + fr * 0.6], [x + (r() - 0.5) * 1.5, dh - fr * 0.8]], 1.8, 0.05, 0.05, 0.6)
      if (i === boards) break
      const bw = (dw - fr) / boards
      for (let g = 0; g < 4; g++) {
        const gx0 = x + bw * (0.18 + g * 0.2 + (r() - 0.5) * 0.08)
        const wv = (r() - 0.5) * bw * 0.16
        grainD += stroke(curve([gx0, kick + fr * (0.8 + r())], [gx0 + wv, (kick + dh) / 2], [gx0 - wv * 0.5, dh - fr * (1 + r())], 10), 0.7 + r() * 1.1, 0.25, 0.3, 0.1)
      }
      if (r() < 0.6) {
        const kx = x + bw * (0.3 + r() * 0.4), ky = kick + (dh - kick) * (0.3 + r() * 0.4)
        knotD += blob(kx, ky, bw * 0.07, bw * 0.11, 1940 + i, 0.2, 10)
      }
    }
    // the frame: stiles and rails, a hair darker on their inner edges where the lattice and the boards sit back
    const frameD = `M0 0H${f1(dw)}V${f1(dh)}H0Z M${f1(fr)} ${f1(fr)}V${f1(kick - fr * 0.1)}H${f1(dw - fr)}V${f1(fr)}Z M${f1(fr * 0.8)} ${f1(kick + fr * 0.6)}V${f1(dh - fr * 1.1)}H${f1(dw - fr * 0.8)}V${f1(kick + fr * 0.6)}Z`
    const inner = stroke([[fr, fr + 1], [dw - fr, fr + 1]], 2.2, 0.03, 0.03, 0.6) + stroke([[fr + 1, fr], [fr + 1, kick]], 2.2, 0.03, 0.03, 0.6) + stroke([[fr * 0.8, kick + fr * 0.6 + 1], [dw - fr * 0.8, kick + fr * 0.6 + 1]], 2, 0.03, 0.03, 0.6)
    const hingeX = side === 'l' ? 0 : dw
    const strap = (y: number) => `M${f1(hingeX)} ${f1(y)}H${f1(side === 'l' ? dw * 0.36 : dw * 0.64)}l${f1(side === 'l' ? 4 : -4)} ${f1(fr * 0.22)}l${f1(side === 'l' ? -4 : 4)} ${f1(fr * 0.22)}H${f1(hingeX)}Z`
    const clip = `${uid}-c${side}`, moonG = `${uid}-m${side}`, wood = `${uid}-w${side}`, bamboo = `${uid}-b${side}`
    const brx = side === 'l' ? dw * 0.62 : dw * 0.38
    const bh = clamp(dh * 0.11, 18, 42)
    svg.replaceChildren(
      s('defs', null,
        s('clipPath', { id: clip }, s('rect', { x: f1(fr), y: f1(fr), width: f1(dw - 2 * fr), height: f1(kick - fr) })),
        s('linearGradient', { id: wood, x1: 0, y1: 0, x2: 1, y2: 0.25 },
          s('stop', { offset: 0, style: 'stop-color:color-mix(in srgb, var(--step-lo) 55%, var(--wash))' }),
          s('stop', { offset: 0.5, style: 'stop-color:color-mix(in srgb, var(--step-mid) 55%, var(--step-lo))' }),
          s('stop', { offset: 1, style: 'stop-color:color-mix(in srgb, var(--step-lo) 75%, var(--wash))' })),
        s('linearGradient', { id: bamboo, x1: 0, y1: 0, x2: 1, y2: 1 },
          s('stop', { offset: 0, style: 'stop-color:color-mix(in srgb, var(--step-hi) 60%, var(--moss-c))' }),
          s('stop', { offset: 1, style: 'stop-color:color-mix(in srgb, var(--step-mid) 70%, var(--moss-b))' })),
        s('linearGradient', { id: moonG, x1: 1, y1: 0, x2: 0, y2: 0.9 },
          s('stop', { offset: 0, style: 'stop-color:var(--moon);stop-opacity:.34' }),
          s('stop', { offset: 0.5, style: 'stop-color:var(--moon);stop-opacity:.05' }),
          s('stop', { offset: 1, style: 'stop-color:var(--moon);stop-opacity:0' }))),
      s('rect', { class: 't19g-plank', x: 0, y: f1(kick), width: f1(dw), height: f1(dh - kick), fill: `url(#${wood})` }),
      s('path', { class: 't19g-plank-grain', d: grainD }),
      s('path', { class: 't19g-plank-knot', d: knotD }),
      s('path', { class: 't19g-plank-seam', d: seams }),
      s('g', { 'clip-path': `url(#${clip})` }, s('path', { class: 't19g-lattice-sh', d: latSh }), s('path', { class: 't19g-lattice', d: lat, fill: `url(#${bamboo})` }), s('path', { class: 't19g-lattice-knot', d: knots })),
      s('path', { class: 't19g-frame', d: frameD, 'fill-rule': 'evenodd', fill: `url(#${wood})` }),
      s('path', { class: 't19g-frame-grain', d: stroke([[fr * 0.5, fr], [fr * 0.45, dh - fr]], 0.9, 0.2, 0.2, 0.3) + stroke([[dw - fr * 0.5, fr * 2], [dw - fr * 0.55, dh - fr * 2]], 0.9, 0.2, 0.2, 0.3) + stroke([[fr * 2, fr * 0.5], [dw - fr * 2, fr * 0.55]], 0.9, 0.2, 0.2, 0.3) }),
      s('path', { class: 't19g-frame-inner', d: inner }),
      s('path', { class: 't19g-frame-ink', d: stroke([[0, 1], [dw, 1]], 2, 0.05, 0.05, 0.5) + stroke([[hingeX + (side === 'l' ? 1 : -1), 0], [hingeX + (side === 'l' ? 1 : -1), dh]], 2.2, 0.05, 0.05, 0.5) + stroke([[0, dh - 1], [dw, dh - 1]], 2.6, 0.05, 0.05, 0.5), filter: 'url(#ink-rough)' }),
      s('path', { class: 't19g-strap', d: strap(fr * 1.6) + strap(dh - fr * 2.4) }),
      s('rect', { class: 't19g-bracket', x: f1(brx - dw * 0.07), y: f1(dh * 0.52 - bh / 2), width: f1(dw * 0.14), height: f1(bh), rx: 1.5 }),
      s('rect', { class: 't19g-moonlit', x: 0, y: 0, width: f1(dw), height: f1(dh), fill: `url(#${moonG})` }),
      s('rect', { class: 't19g-dim', x: 0, y: 0, width: f1(dw), height: f1(dh) }))
  }

  function setSlide(x: number) {
    slide = clamp(x, -maxSlide, maxSlide)
    bolt.style.transform = `translateX(${f1(slide)}px)`
  }

  /** the bolt sticks: back into its brackets, the gate shudders — not open to you; then the wicket's man gets the dot */
  function open() {
    setSlide(0)
    ctx.chime('tap')
    if (!ctx.reduced) gate.animate([{ translate: '0 0' }, { translate: '3px 0' }, { translate: '-3px 0' }, { translate: '2px 0' }, { translate: '0 0' }], { duration: 420, easing: 'ease-out' })
    ctx.prompt(G.jammed, 'wrong')
    if (opened) return
    clearTimeout(nextT)
    nextT = window.setTimeout(() => ctx.prompt(G.steps[0]), ctx.reduced ? 1600 : 1900)
    if (jammed) return
    jammed = true
    boltDot.done()
    keeper.disabled = false
    keeperDot = g.dot(keeperDotAt, { dir: [1, -0.4] })
  }
  let nextT = 0
  ctx.onCleanup(() => clearTimeout(nextT))

  /** the small gate opens for him: his lantern goes in, lights the crack, the masons fill it; the reason is hung up, the tags
   *  swing in on the right-hand fence */
  function letIn() {
    if (opened || !jammed) return
    opened = true
    clearTimeout(nextT)
    keeper.disabled = true
    keeperDot?.done()
    root.classList.add('let')
    board.inert = false
    ctx.chime('soft')
    nextT = window.setTimeout(() => {
      ctx.prompt(G.steps[1])
      tags.forEach((b) => (b.disabled = false))
      tagDots = tagDotAt.map((el) => g.dot(el, { dir: [0, 1] }))
      count = g.count(L.heard, V.length, () => countPt)
    }, ctx.reduced ? 0 : low ? 1400 : 2600)
  }

  /** a tag speaks: its words on the forecourt (only the last one heard is written out); all three: the shared line */
  const heard = new Set<number>()
  let finT = 0
  ctx.onCleanup(() => clearTimeout(finT))
  function hear(i: number) {
    if (!opened) return
    const first = !heard.has(i)
    heard.add(i)
    tags.forEach((b, k) => b.classList.toggle('on', k === i))
    tags[i].classList.add('heard')
    tags[i].setAttribute('aria-pressed', 'true')
    tagDots[i]?.done()
    tagDots[i] = null
    voice.replaceChildren(h('p', { class: 't19g-who' }, V[i].who), ctx.fact(V[i].view as Fact, 'p', 't19g-view'))
    voice.classList.add('in')
    if (!ctx.reduced) voice.animate([{ opacity: 0, translate: '0 6px' }, { opacity: 1, translate: '0 0' }], { duration: 600, easing: 'ease-out' })
    ctx.chime('soft')
    if (!first) return
    count?.set(heard.size)
    if (heard.size < V.length) return
    // the last words stay a moment, then give way to the shared line (one block of words at a time)
    finT = window.setTimeout(() => {
      voice.classList.remove('in')
      tags.forEach((b) => b.classList.remove('on'))
      ctx.insight(G.insight as Fact, G.detail as Detail)
      ctx.chime('ok')
    }, low || ctx.reduced ? 2400 : 3200)
  }
  keeper.addEventListener('click', letIn)
  // H7: standing still before the bolt was tried, it gives a small nudge to the right; later the tags not yet heard sway
  const idle = () => {
    if (ctx.reduced) return
    if (!jammed) boltArt.animate([{ translate: '0 0' }, { translate: '2px 0' }, { translate: '0 0' }], { duration: 600, iterations: 2 })
    else if (count && heard.size < V.length) tags.forEach((b, k) => heard.has(k) || b.firstElementChild!.animate([{ rotate: '0deg' }, { rotate: '5deg' }, { rotate: '-4deg' }, { rotate: '0deg' }], { duration: 1200, easing: 'ease-in-out' }))
  }
  ctx.el.addEventListener('p2:idle', idle)
  ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', idle))

  // drag the bolt sideways out of its brackets (a tap or Enter slides it for you)
  let drag: { x0: number; s0: number; moved: boolean } | null = null
  bolt.addEventListener('pointerdown', (e) => {
    if (e.button) return
    drag = { x0: e.clientX, s0: slide, moved: false }
    bolt.setPointerCapture(e.pointerId)
    bolt.classList.add('held')
  })
  bolt.addEventListener('pointermove', (e) => {
    if (!drag) return
    const dx = e.clientX - drag.x0
    if (Math.abs(dx) > 4) drag.moved = true
    // the bolt is heavy: it follows the hand a little behind, then sticks
    setSlide(drag.s0 + dx * 0.85)
    if (Math.abs(dx) > maxSlide * 4) {
      drag = null
      bolt.classList.remove('held')
      open()
    }
  })
  const release = () => {
    if (!drag) return
    const d = drag
    drag = null
    bolt.classList.remove('held')
    if (!d.moved || Math.abs(slide) > maxSlide * 0.55) open()
    else setSlide(0)
  }
  bolt.addEventListener('pointerup', release)
  bolt.addEventListener('pointercancel', release)
  bolt.addEventListener('click', (e) => {
    // keyboard Enter / Space arrives as a click with no pointer drag
    if (e.detail === 0) open()
  })

  if (deep) {
    let box: DOMRect | null = null
    root.addEventListener('pointerenter', () => (box = null))
    root.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || drag) return
      const b = (box ??= root.getBoundingClientRect())
      parallax(((e.clientX - b.left) / b.width) * 2 - 1, ((e.clientY - b.top) / b.height) * 2 - 1)
    })
    root.addEventListener('pointerleave', () => parallax(0, 0))
    let g0: number | null = null, b0 = 0
    const tilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return
      if (g0 == null) (g0 = e.gamma), (b0 = e.beta)
      parallax(clamp((e.gamma - g0) / 20, -1, 1), clamp((e.beta - b0) / 20, -1, 1))
    }
    addEventListener('deviceorientation', tilt)
    ctx.onCleanup(() => removeEventListener('deviceorientation', tilt))
  }
  ctx.onCleanup(onSize(ctx.art, layout))
}
