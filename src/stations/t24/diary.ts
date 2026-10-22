import { fill, h, s } from '../../core/dom'
import type { SceneCtx } from '../types'
import { C } from './data'
import { f1, invite, nudge, stage } from './kit'
import { blob, curve, rng, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist, moon, reeds, wash } from '../../ui/part2/paint'
import { guide, type Counter, type Mark } from '../../ui/part2/guide'
import { grad, Z } from './brush'

const K = C.scenes.diary
const N = K.pages.length

/**
 * Scene 5 (audit g08 24-5) — the camera just above a small pond at night: a thick open diary of dó paper afloat in the
 * middle, big, its pages mirrored right under it in the water; the answer stele on the right bank, a vermilion pebble on the
 * left one. Beat 1: slip the pebble (a hint passed to the AI on the sly) into the dashed water under the diary: the answer on
 * the stele turns to the hinted one, and the hint's seal shows in the diary's reflection. Beat 2: turn the four pages, four
 * tries: the water shows the seal under every one, but only one page writes the hint down → the insight.
 */
export function diaryScene(ctx: SceneCtx) {
  let hinted = false
  let page = -1
  const { root } = stage(ctx, 't24d', K.art, [K.insight], draw, true)
  const art = s('svg', { class: 't24-svg t24d-art', 'aria-hidden': 'true' })
  const book = s('g', { class: 't24d-book' })
  const q = h('div', { class: 't24d-q flat' }, h('p', null, K.question), h('p', { class: 't24d-decode' }, K.decode))
  // the pebble: a smooth river stone lacquered vermilion, a highlight where the moon catches it, its own small shadow
  const pebble = h('button', { class: 't24d-pebble', type: 'button', 'aria-label': K.pebbleAria },
    s('svg', { viewBox: '-24 -18 48 34', 'aria-hidden': 'true' },
      s('defs', null, s('radialGradient', { id: 't24d-peb', cx: 0.38, cy: 0.3, r: 0.75 }, s('stop', { offset: 0, class: 't24d-pb0' }), s('stop', { offset: 0.55, class: 't24d-pb1' }), s('stop', { offset: 1, class: 't24d-pb2' }))),
      s('ellipse', { class: 'sh', cx: 3, cy: 9.5, rx: 19, ry: 4.2 }),
      s('path', { class: 'body', d: 'M-17 3C-18.5 -6 -8 -12 2 -11.5C12.5 -11 19 -4.5 17.5 3C16 9.5 6 11.5 -3 11C-11 10.5 -16 8.5 -17 3Z', fill: 'url(#t24d-peb)' }),
      s('path', { class: 'hi', d: 'M-9 -6.5C-5 -9.5 1 -9.6 5 -8.6' }),
      s('path', { class: 'lo', d: 'M-14 6C-6 10 6 10 14 5' })))
  const text = h('p', { class: 't24d-text', 'aria-live': 'off' })
  const flip = h('button', { class: 't24d-flip', type: 'button', 'aria-label': K.flipAria, disabled: true })
  const ans = h('p', { class: 't24d-ans' }, K.answer.before)
  const stele = h('div', { class: 't24d-stele' }, h('p', { class: 't24d-ans-l' }, K.answer.label), ans)
  const data = h('div', { class: 't24d-data', 'data-off': '' }, ctx.fact(K.data, 'p'))
  root.append(art, q, stele, text, flip, pebble, data)
  ctx.prompt(K.prompt)
  const g = guide(ctx)
  let dot: Mark | null = g.dot(pebble, { dir: [1, -0.4] })
  let count: Counter | null = null
  // the water under the diary, where the pebble goes (H3)
  const bed = (): Pt => [G.bx, G.by + G.ph * 0.36] // in the water at the foot of the stone the diary lies on
  const target = g.drop(bed, { w: 150, h: 50 })

  const G = { W: 0, H: 0, Hp: 0, wide: true, cx: 0, cy: 0, rx: 0, ry: 0, hz: 0, bx: 0, by: 0, pw: 0, ph: 0, mx: 0, home: [0, 0] as Pt, st: { x: 0, y: 0, h: 0 } }

  function* draw(W: number, H: number) {
    const wide = W / H >= 1.05
    const Hp = wide ? H : H * 0.84 // on a phone the data line goes under the painting
    const hz = Hp * (wide ? 0.4 : 0.34)
    // a desk keeps the bank at the lower left clear for the insight (text zone bl)
    const cx = W * (wide ? 0.5 : 0.5), cy = Hp * (wide ? 0.6 : 0.6), rx = W * (wide ? 0.37 : 0.48), ry = Hp * (wide ? 0.15 : 0.13)
    Object.assign(G, {
      W, H, Hp, wide, cx, cy, rx, ry, hz,
      // the diary big in the middle of the water (its reflection right under it), the stele in the right third
      bx: W * (wide ? 0.47 : 0.47), by: cy - ry * 0.12, pw: W * (wide ? 0.19 : 0.37), ph: Hp * (wide ? 0.31 : 0.25),
      st: { x: W * (wide ? 0.84 : 0.83), y: Hp * (wide ? 0.93 : 0.92), h: Hp * (wide ? 0.42 : 0.31) },
      mx: W * (wide ? 0.66 : 0.88), home: [W * (wide ? 0.13 : 0.13), Hp * (wide ? 0.86 : 0.9)],
    })
    art.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    yield
    paint()
    yield
    drawBook()
    place()
  }

  /** the HTML over the painting: the page's words, the page corner, the stele's face, the pebble (on the bank or in the water) */
  function place() {
    const { W, Hp, wide, bx, by, pw, ph, st } = G
    const sw = st.h * 0.62
    const fs = Math.max(12.5, Math.min(17, pw * 0.07))
    Object.assign(text.style, { left: `${f1(bx + pw * 0.14)}px`, top: `${f1(by - ph * 0.86)}px`, width: `${f1(pw * 0.72)}px`, fontSize: `${f1(fs)}px` })
    Object.assign(flip.style, { left: `${f1(bx + pw * 0.9 - 30)}px`, top: `${f1(by - ph * 0.14 - 30)}px` })
    Object.assign(stele.style, { left: `${f1(st.x - sw * 0.36)}px`, top: `${f1(st.y - st.h * 0.7)}px`, width: `${f1(sw * 0.72)}px` })
    const at = hinted ? bed() : G.home
    Object.assign(pebble.style, { left: `${f1(at[0])}px`, top: `${f1(at[1])}px`, translate: '' })
    if (wide) Object.assign(data.style, { left: '', right: '14px', top: '10px', width: `${f1(Math.min(360, W * 0.27))}px` })
    else Object.assign(data.style, { left: '12px', right: '12px', top: `${f1(Hp + 4)}px`, width: '' })
    q.classList.toggle('wide', wide)
    g.refresh()
  }

  /** Sky and moon, far ranges and bank, the pond with its glints and moon road, the near bank and its grasses, the stele. */
  function paint() {
    const { W, Hp, cx, cy, rx, ry, hz, st, mx } = G
    const r = rng(2552)
    let rip = ''
    for (let k = 0; k < 9; k++) {
      const yy = cy - ry * 0.75 + k * ry * 0.19
      const half = rx * Math.sqrt(Math.max(0, 1 - Math.pow((yy - cy) / ry, 2))) * 0.94
      for (let j = 0; j < 3; j++) {
        const x0 = cx - half + r() * half * 1.4, len = rx * (0.06 + r() * 0.16) * (0.6 + k * 0.08)
        if (Math.abs(x0 + len / 2 - G.bx) < G.pw * 1.1 && yy > G.by - 4) continue // not across the diary's reflection
        rip += stroke([[x0, yy], [Math.min(cx + half, x0 + len), yy + (r() - 0.5) * 0.6]], 0.7 + k * 0.12, 0.3, 0.3, 0.1)
      }
    }
    const water = blob(cx, cy, rx, ry, 2553, 0.03, 36)
    const nearBank = `M${f1(-W * 0.05)} ${f1(cy + ry * 0.4)}Q${f1(cx - rx * 0.7)} ${f1(cy + ry * 1.35)} ${f1(cx)} ${f1(cy + ry * 1.18)}Q${f1(cx + rx * 0.75)} ${f1(cy + ry * 1.1)} ${f1(W * 1.05)} ${f1(cy + ry * 0.3)}L${f1(W * 1.05)} ${f1(Hp * 1.05)}L${f1(-W * 0.05)} ${f1(Hp * 1.05)}Z`
    // grass: a low fringe all along the pond's near edge, clumps at the bank's corners (no stray blades in mid air)
    let fringe = ''
    for (let i = 0; i < 70; i++) {
      const t = i / 69, a = Math.PI * (0.06 + t * 0.88)
      const x = cx - Math.cos(a) * rx * 1.02, y = cy + Math.sin(a) * ry * 1.04 + 2
      const hgt = Hp * (0.012 + r() * 0.02) * (0.6 + Math.sin(a) * 0.6)
      for (let k = 0; k < 3; k++) {
        const ox = x + (r() - 0.5) * 8
        fringe += stroke([[ox, y], [ox + (r() - 0.5) * hgt * 0.6, y - hgt]], 1 + r() * 0.8, 0.1, 0.6, 0.2)
      }
    }
    let moss = ''
    for (let i = 0; i < 10; i++) moss += blob(r() * W, cy + ry * 1.5 + r() * (Hp - cy - ry * 1.5), W * (0.04 + r() * 0.06), 3 + r() * 4, 2560 + i, 0.35, 14)
    // the answer stele on the right bank: a tall stone with volume, moss on its shoulder, the moon on its rim
    const sw = st.h * 0.62
    const steleEl = s('g', { class: 't24d-stoneart', transform: `translate(${f1(st.x)} ${f1(st.y)})` },
      s('ellipse', { class: 't24d-stone-glow', cx: 0, cy: f1(-st.h * 0.5), rx: f1(sw * 1.1), ry: f1(st.h * 0.8), fill: 'url(#p2-halo)' }),
      s('ellipse', { class: 't24d-stone-cast', cx: f1(-sw * 0.25), cy: f1(4), rx: f1(sw * 0.9), ry: f1(Math.max(4, st.h * 0.04)) }),
      stoneArt(sw, st.h, 2564),
      s('path', { class: 't24d-stone-moss', d: blob(sw * 0.08, -st.h * 0.86, sw * 0.24, st.h * 0.035, 2566, 0.35, 14) + blob(-sw * 0.3, -st.h * 0.04, sw * 0.22, st.h * 0.025, 2567, 0.35, 12), filter: 'url(#ink-rough)' }),
      s('path', { class: 't24d-stone-rim', d: stroke(curve([-sw * 0.42, -st.h * 0.62], [-sw * 0.1, -st.h * 1.04], [sw * 0.3, -st.h * 0.88], 10), Math.max(1.6, sw * 0.035), 0.3, 0.3, 0.15) }))
    art.replaceChildren(
      s('defs', null,
        grad('t24d-water', 'linear', { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, 't24d-w0'], [0.5, 't24d-w1'], [1, 't24d-w2']]),
        s('clipPath', { id: 't24d-pond' }, s('path', { d: water }))),
      mist(cx, hz - Hp * 0.12, W * 0.7, Hp * 0.22),
      moon(mx, Hp * (G.wide ? 0.14 : 0.29), Math.min(20, Hp * (G.wide ? 0.035 : 0.026)), 2551, false),
      hills(-W * 0.05, W * 1.05, hz, Hp * 0.16, 2554, 0.85, W > Hp ? 5 : 3),
      hills(W * 0.42, W * 1.05, hz + 1, Hp * 0.08, 2555, 0.45, 2),
      mist(cx, hz - Hp * 0.01, W * 0.6, Hp * 0.045),
      wash(`M${f1(-W * 0.05)} ${f1(hz + Hp * 0.01)}Q${f1(cx)} ${f1(hz - Hp * 0.012)} ${f1(W * 1.05)} ${f1(hz + Hp * 0.008)}L${f1(W * 1.05)} ${f1(cy)}L${f1(-W * 0.05)} ${f1(cy)}Z`, 0.5, 'p2p-wash t24d-farbank'),
      reeds(W * 0.72, hz + Hp * 0.04, Hp * 0.07, 2559, 6),
      reeds(cx - rx * 0.66, hz + Hp * 0.045, Hp * 0.06, 2558, 5),
      s('path', { class: 't24d-water', d: water, fill: 'url(#t24d-water)' }),
      s('g', { 'clip-path': 'url(#t24d-pond)' },
        s('g', { class: 't24d-road', transform: `translate(${f1(mx)} 0)` }, s('ellipse', { class: 't24d-road-glow', cx: 0, cy: f1(cy), rx: f1(rx * 0.1), ry: f1(ry * 1.4), fill: 'url(#p2-road)' }),
          s('path', { class: 't24d-road-ink', d: [0.12, 0.3, 0.5, 0.68, 0.84].map((t) => `M${f1(-rx * (0.02 + t * 0.04))} ${f1(cy - ry + t * ry * 2)}h${f1(rx * (0.04 + t * 0.08))}`).join('') })),
        s('path', { class: 't24d-rip', d: rip }),
        s('g', { class: 't24d-reflect' })),
      s('path', { class: 't24d-rim', d: stroke(curve([cx - rx, cy + 1], [cx, cy - ry * 2.05], [cx + rx, cy + 1], 30), 1.6, 0.1, 0.1, 0.3) }),
      s('path', { class: 't24d-near', d: nearBank, filter: 'url(#ink-wash)' }),
      s('path', { class: 't24d-tuft', d: moss, filter: 'url(#ink-wash)' }),
      s('path', { class: 't24d-wet', d: stroke(curve([cx - rx * 0.98, cy + ry * 0.3], [cx, cy + ry * 1.12], [cx + rx * 0.98, cy + ry * 0.3], 30), 2.2, 0.1, 0.1, 0.3) }),
      s('path', { class: 't24d-fringe', d: fringe }),
      reeds(G.wide ? W * 0.95 : W * 0.05, Hp * 0.96, Hp * (G.wide ? 0.2 : 0.17), 2563, 8),
      book,
      steleEl)
  }

  /** A deckled edge: the line from a to b, roughened like torn dó fibre (screen px). */
  const deckle = (pts: Pt[], amt: number, seed: number): Pt[] => {
    const r = rng(seed)
    const out: Pt[] = []
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1]
      const n = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) / 6))
      for (let k = 0; k < n; k++) {
        const t = k / n
        out.push([ax + (bx - ax) * t + (r() - 0.5) * amt * 0.4, ay + (by - ay) * t + (r() - 0.5) * amt])
      }
    }
    out.push(pts[pts.length - 1])
    return out
  }
  /** Lines of handwriting with no letters in them: cursive loops along a baseline, breaking between "words". */
  const scribble = (x0: number, y: number, len: number, hgt: number, seed: number, w: number) => {
    const r = rng(seed)
    let d = '', x = x0
    while (x < x0 + len) {
      const wl = Math.min(x0 + len - x, hgt * (2 + r() * 4))
      const pts: Pt[] = []
      const loops = Math.max(2, Math.round(wl / (hgt * 0.55)))
      for (let i = 0; i <= loops * 6; i++) {
        const t = i / (loops * 6), th = t * loops * Math.PI * 2
        pts.push([x + t * wl - Math.sin(th) * hgt * 0.1, y - (1 - Math.cos(th)) * hgt * (0.16 + 0.12 * Math.abs(Math.sin(t * 5.3 + seed + r())))])
      }
      d += stroke(pts, w, 0.1, 0.2, 0.3)
      x += wl + hgt * (0.6 + r() * 0.6)
    }
    return d
  }

  /**
   * The diary afloat, big: a thick block of dó pages open from the spine on a dark cover, its torn fibre edges, the page
   * block's stacked edges, a shadow in the gutter; handwriting on the left page (the right one carries the page's words in
   * HTML). Below the water line the same pages upside down, broken by ripples, and — once the hint is in — the vermilion
   * seal of the hint under every page.
   */
  function drawBook() {
    const { bx, by, pw, ph } = G
    const th = ph * 0.07 // the page block's thickness
    const leaf = (d: number, lift = 0): Pt[] => [[bx, by - lift], ...curve([bx + d * pw * 0.1, by + ph * 0.03 - lift], [bx + d * pw * 0.6, by + ph * 0.09 - lift], [bx + d * pw, by - ph * 0.02 - lift], 8).slice(1), [bx + d * pw * 0.98, by - ph - lift * 0.4], ...curve([bx + d * pw * 0.98, by - ph - lift * 0.4], [bx + d * pw * 0.55, by - ph * 0.9], [bx, by - ph * 0.86], 8).slice(1)]
    const Lp = deckle(leaf(-1), 2.4, 2571), Rp = deckle(leaf(1), 2.4, 2572)
    // the cover under the pages (a dark board a little larger) and the stacked page edges along both lower sides
    const cover = (d: number): Pt[] => [[bx, by + th * 1.2], ...curve([bx + d * pw * 0.1, by + ph * 0.03 + th * 1.3], [bx + d * pw * 0.6, by + ph * 0.09 + th * 1.3], [bx + d * pw * 1.03, by - ph * 0.02 + th], 8).slice(1), [bx + d * pw * 1.03, by - ph * 0.05], [bx + d * pw * 0.98, by - ph * 0.02], [bx, by]]
    let edges = ''
    for (let k = 1; k <= 4; k++) for (const d of [-1, 1]) edges += stroke(curve([bx + d * pw * 0.04, by + ph * 0.03 + (th * k) / 4.5], [bx + d * pw * 0.6, by + ph * 0.09 + (th * k) / 4.5], [bx + d * pw * 0.99, by - ph * 0.02 + (th * k) / 4.5], 10), 0.9, 0.1, 0.1, 0.4)
    // the left page's handwriting (the right page's words are HTML)
    let hand = ''
    for (let k = 0; k < 7; k++) {
      const y = by - ph * (0.74 - k * 0.095) + Math.pow(k / 6, 2) * ph * 0.03
      const x0 = bx - pw * 0.88, len = pw * (0.66 - (k === 6 ? 0.3 : 0) + Math.sin(k * 1.7) * 0.06)
      hand += scribble(x0, y, len, ph * 0.045, 2580 + k, Math.max(0.9, ph * 0.006))
    }
    // the seal of the hint, as the water shows it: a rounded vermilion square with three carved strokes, wobbling
    const z = Math.max(16, pw * 0.13)
    const seal = (x: number, y: number) => [
      s('path', { class: 't24d-seal', d: blob(x, y, z * 0.55, z * 0.48, 2590, 0.12, 16) }),
      s('path', { class: 't24d-seal-cut', d: stroke([[x + z * 0.02, y + z * 0.28], [x - z * 0.04, y - z * 0.02], [x - z * 0.24, y - z * 0.26]], z * 0.1, 0.1, 0.3, 0.5) + stroke([[x - z * 0.03, y + z * 0.0], [x + z * 0.24, y - z * 0.24]], z * 0.09, 0.1, 0.3, 0.5) }),
    ]
    const r = rng(2573)
    // the diary lies open on a flat stone rising out of the pond: its top just under the cover, its wet foot at the water line wl
    const sTop = by + th * 1.35, srx = pw * 1.18, sry = ph * 0.075, wl = by + ph * 0.17
    const topD = blob(bx, sTop, srx, sry, 2574, 0.05, 30)
    const lower: Pt[] = Array.from({ length: 17 }, (_, i) => { const a = (i / 16) * Math.PI; return [bx + Math.cos(a) * srx * 0.995, sTop + Math.sin(a) * sry] as Pt })
    const front = `M${lower.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}L${f1(bx - srx * 0.96)} ${f1(wl)}Q${f1(bx)} ${f1(wl + ph * 0.02)} ${f1(bx + srx * 0.97)} ${f1(wl)}Z`
    // the reflection: everything mirrored about the water line at the stone's foot, flattened (y' = wl + 0.62 (wl - y))
    const mirror = `translate(0 ${f1(wl * 1.62)}) scale(1 -0.62)`
    const under = [...Array(N).keys()].map((v) => s('g', { class: `t24d-under p${v}` },
      s('g', { transform: mirror },
        s('path', { class: 't24d-mirror-paper', d: Z(Lp) + Z(Rp) }),
        s('path', { class: 't24d-mirror-ink', d: hand + scribble(bx + pw * 0.14, by - ph * 0.72, pw * 0.7, ph * 0.045, 2600 + v, 1) + scribble(bx + pw * 0.14, by - ph * 0.6, pw * 0.6, ph * 0.045, 2610 + v, 1) })),
      s('g', { class: 't24d-hintseal' }, ...seal(bx + pw * (0.36 + (v % 2) * 0.1), wl + ph * (0.24 + (v % 3) * 0.04)))))
    let cuts = ''
    for (let k = 0; k < 7; k++) {
      const yy = wl + 2 + ph * (0.05 + k * 0.08)
      cuts += stroke([[bx - pw * 1.15, yy], [bx + pw * 1.15, yy + (r() - 0.5)]], 1.2 + k * 0.35, 0.2, 0.2, 0.3)
    }
    art.querySelector('.t24d-reflect')?.replaceChildren(
      s('ellipse', { class: 't24d-under-glow', cx: f1(bx), cy: f1(wl + ph * 0.3), rx: f1(pw * 1.3), ry: f1(ph * 0.45), fill: 'url(#p2-road)' }),
      s('path', { class: 't24d-slab-mirror', d: front, transform: mirror }),
      ...under,
      s('path', { class: 't24d-cuts', d: cuts }))
    // the gutter's shadow on both pages
    const gut = (d: number): Pt[] => [[bx, by], [bx + d * pw * 0.13, by + ph * 0.04], [bx + d * pw * 0.13, by - ph * 0.87], [bx, by - ph * 0.86]]
    book.replaceChildren(
      s('defs', null, s('linearGradient', { id: 't24d-gut', x1: 0, y1: 0, x2: 1, y2: 0 }, s('stop', { offset: 0, class: 't24d-g0' }), s('stop', { offset: 1, class: 't24d-g1' }))),
      // the stone: its face (wet and dark toward the water), its top, moss on its shoulders, a ripple ring at its foot
      s('path', { class: 't24d-slab-face', d: front, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
      s('path', { class: 't24d-slab-shade', d: front, fill: 'url(#p2-shade)' }),
      s('path', { class: 't24d-slab-wet', d: stroke([[bx - srx * 0.95, wl - ph * 0.012], [bx, wl + ph * 0.006], [bx + srx * 0.96, wl - ph * 0.012]], Math.max(3, ph * 0.03), 0.1, 0.1, 0.4) }),
      s('path', { class: 't24d-slab-top', d: topD, filter: 'url(#ink-rough)' }),
      s('path', { class: 't24d-slab-moss', d: blob(bx - srx * 0.8, sTop + sry * 0.5, srx * 0.14, sry * 0.45, 2575, 0.35, 12) + blob(bx + srx * 0.78, sTop + sry * 0.4, srx * 0.12, sry * 0.4, 2576, 0.35, 12) }),
      s('path', { class: 't24d-slab-ring', d: stroke(curve([bx - srx * 1.08, wl + 2], [bx, wl + ph * 0.07], [bx + srx * 1.08, wl + 2], 20), 1.2, 0.2, 0.2, 0.2) }),
      s('ellipse', { class: 't24d-bookshadow', cx: f1(bx), cy: f1(by + th * 1.6), rx: f1(pw * 1.08), ry: f1(Math.max(3, sry * 0.5)) }),
      s('path', { class: 't24d-cover', d: Z(cover(-1)) + Z(cover(1)) }),
      s('path', { class: 't24d-blockedge', d: edges }),
      s('path', { class: 't24d-paper base', d: Z(Lp) + Z(Rp) }),
      s('path', { class: 't24d-gutter', d: Z(gut(1)), fill: 'url(#t24d-gut)', transform: `translate(${f1(bx * 2)} 0) scale(-1 1)` }),
      s('path', { class: 't24d-gutter', d: Z(gut(1)), fill: 'url(#t24d-gut)' }),
      s('path', { class: 't24d-ink', d: hand }),
      // the page that turns over
      s('g', { class: 't24d-turn' }, s('path', { class: 't24d-paper turn', d: Z(Rp) })),
      s('path', { class: 't24d-edge', d: stroke([...Lp, Lp[0]], 1, 0.05, 0.05, 0.4) + stroke([...Rp, Rp[0]], 1, 0.05, 0.05, 0.4) + stroke([[bx, by + 1], [bx, by - ph * 0.87]], 1.4, 0.1, 0.1, 0.4) }))
    ;(book.querySelector('.t24d-turn') as SVGGElement).style.transformOrigin = `${f1(bx)}px ${f1(by)}px`
    art.dataset.page = String(Math.max(0, page))
  }

  // ── beat 1: the pebble goes into the water under the diary (drag it there; a tap or Enter drops it in too)
  function hint() {
    if (hinted) return
    hinted = true
    pebble.disabled = true
    pebble.classList.add('placed')
    root.classList.add('is-hinted')
    target.hit()
    dot?.done()
    ans.textContent = K.answer.after
    if (!ctx.reduced) stele.animate([{ opacity: 0.2, filter: 'blur(2px)' }, { opacity: 1, filter: 'none' }], { duration: 900, easing: 'ease-out' })
    ctx.chime('soft')
    place()
    // beat 2: the pages, one try each
    flip.disabled = false
    count = g.count(K.pageCount, N, () => [G.bx, G.by - G.ph - 22], { n: 0 })
    turn()
    ctx.prompt(K.flip)
    dot = g.dot(flip, { dir: [-1, 0] })
    flip.focus({ preventScroll: true })
  }
  let id = -1, x0 = 0, y0 = 0, moved = 0
  pebble.addEventListener('pointerdown', (e) => {
    if (hinted) return
    id = e.pointerId
    x0 = e.clientX
    y0 = e.clientY
    moved = 0
    pebble.setPointerCapture(id)
    pebble.classList.add('held')
    target.lift(true)
  })
  pebble.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return
    const dx = e.clientX - x0, dy = e.clientY - y0
    moved = Math.max(moved, Math.hypot(dx, dy))
    pebble.style.translate = `${f1(dx)}px ${f1(dy)}px`
  })
  const up = (e: PointerEvent) => {
    if (e.pointerId !== id) return
    id = -1
    pebble.classList.remove('held')
    target.lift(false)
    const dx = e.clientX - x0, dy = e.clientY - y0
    const [tx, ty] = bed()
    if (moved < 8 || Math.hypot(G.home[0] + dx - tx, G.home[1] + dy - ty) < Math.max(70, G.pw * 0.5)) return hint()
    pebble.style.translate = ''
    g.wrong(K.pebbleWrong, pebble)
  }
  pebble.addEventListener('pointerup', up)
  pebble.addEventListener('pointercancel', up)
  pebble.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), hint()))

  // ── beat 2: turn the pages (the corner, the page itself, or a swipe across the book)
  function turn() {
    if (page >= N - 1) return
    page++
    const k = page
    art.dataset.page = String(k)
    text.textContent = K.pages[k]
    count?.set(k + 1)
    if (k > 0) {
      ctx.chime('tap')
      if (!ctx.reduced) (book.querySelector('.t24d-turn') as SVGGElement).animate([{ transform: 'scaleX(1)', opacity: 1 }, { transform: 'scaleX(-1)', opacity: 1, offset: 0.85 }, { transform: 'scaleX(-1)', opacity: 0 }], { duration: 700, easing: 'cubic-bezier(.4,0,.2,1)' })
    }
    if (k === N - 1) {
      flip.disabled = true
      dot?.done()
      count?.done()
      delete data.dataset.off
      root.classList.add('is-all')
      ctx.insight(K.insight, K.detail)
      ctx.chime('ok')
    } else if (k > 0) ctx.prompt(fill(K.flipNext, { n: k + 2 }))
  }
  flip.addEventListener('click', turn)
  text.addEventListener('click', () => hinted && turn())
  let sx = NaN
  root.addEventListener('pointerdown', (e) => void (sx = hinted ? e.clientX : NaN))
  root.addEventListener('pointerup', (e) => {
    if (!Number.isNaN(sx) && Math.abs(e.clientX - sx) > 50 && e.target !== pebble) turn()
    sx = NaN
  })
  // idle: before the hint the pebble edges toward the water; after it, the page's corner lifts
  invite(ctx, () => {
    if (!G.W) return
    if (!hinted) {
      const [tx, ty] = bed(), dx = tx - G.home[0], dy = ty - G.home[1], l = Math.hypot(dx, dy) || 1
      return nudge(ctx, pebble, (dx / l) * 11, (dy / l) * 11)
    }
    if (page >= N - 1 || ctx.reduced) return
    ;(book.querySelector('.t24d-turn') as SVGGElement).animate([{ transform: 'scaleX(1)', opacity: 0 }, { transform: 'scaleX(0.84)', opacity: 1, offset: 0.4 }, { transform: 'scaleX(1)', opacity: 0 }], { duration: 1300, easing: 'ease-in-out', iterations: 2 })
  })
}
