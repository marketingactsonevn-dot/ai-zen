import { fill, h, s } from '../../core/dom'
import { cssVar, onPrefs } from '../../core/prefs'
import { createLoop } from '../../core/loop'
import type { SceneCtx } from '../types'
import { guide, type Mark } from '../../ui/part2/guide'
import { C } from './data'
import { f1, invite, nudge, stage } from './kit'
import { blob, clamp, curve, rng, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import { moon, reeds, ridge } from '../../ui/part2/paint'

const K = C.scenes.incense
const N = 4 // sticks: 1 = a quick answer … 4 = thinking long
const STEP = 60 // px of groove per stick (audit g08 24-4)

/** One soft puff, white, drawn once for the module and tinted per theme (the smoke is hundreds of these). */
let puff: HTMLCanvasElement | null = null
function puffSprite() {
  if (puff) return puff
  puff = document.createElement('canvas')
  puff.width = puff.height = 64
  const g = puff.getContext('2d')!
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  r.addColorStop(0, 'rgba(255,255,255,1)')
  r.addColorStop(0.45, 'rgba(255,255,255,0.45)')
  r.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = r
  g.fillRect(0, 0, 64, 64)
  return puff
}
const tint = (c: string) => {
  const t = document.createElement('canvas')
  t.width = t.height = 64
  const g = t.getContext('2d')!
  g.drawImage(puffSprite(), 0, 0)
  g.globalCompositeOperation = 'source-in'
  g.fillStyle = c
  g.fillRect(0, 0, 64, 64)
  return t
}

/**
 * Scene 4 (audit g08 24-4) — seen from a little above a lake shore at night, a picture whose vertical axis is a column of
 * incense smoke: it rises from a bronze censer low in the middle, past the moon, to the top of the frame, drafts (meaningless
 * brush squiggles) riding in it. The monk sits on a flat rock at the left; a large natural stele stands in the right third
 * with a puzzle and its answer carved in it. Beside the censer a wooden post has a groove with four notches: draw the
 * bundle up a notch (≈ 60 px) and another stick burns — the column grows, the moon moves on, the carved answer turns from
 * the hasty "100đ" to the right "50đ"; the last stick lights a whole far shore of embers, mirrored in the water.
 */
export function incenseScene(ctx: SceneCtx) {
  let v = 1
  let done = false
  const quick = ctx.reduced || ctx.quality === 'low'
  const { root } = stage(ctx, 't24i', K.art, [K.insight], draw, true)
  const bg = h('canvas', { class: 't24i-bg', 'aria-hidden': 'true' })
  const embers = h('canvas', { class: 't24i-embers', 'aria-hidden': 'true' })
  const moonBox = s('svg', { class: 't24i-moon', viewBox: '-60 -60 120 120', 'aria-hidden': 'true' })
  const road = s('svg', { class: 't24-svg t24i-road', 'aria-hidden': 'true' })
  const smoke = h('canvas', { class: 't24i-smoke', 'aria-hidden': 'true' })
  const figSvg = s('svg', { class: 't24-svg t24i-fig', 'aria-hidden': 'true' })
  const nearSvg = s('svg', { class: 't24-svg t24i-near', 'aria-hidden': 'true' })
  // the scores carved by the stele's two notches (shown once the answer has turned)
  const notches = K.notches.map((t) => h('span', { class: 't24i-num', 'aria-hidden': 'true' }, t))
  const ends = K.ends.map((t) => h('span', { class: 't24i-end', 'aria-hidden': 'true' }, t))
  // the handle: the incense bundle in the post's groove
  const bundle = h('div', { class: 't24i-bundle', role: 'slider', tabindex: '0', 'aria-label': K.sliderAria, 'aria-valuemin': '1', 'aria-valuemax': String(N), 'aria-orientation': 'vertical' },
    s('svg', { viewBox: '-14 -64 28 72', 'aria-hidden': 'true' },
      s('path', { class: 't24i-b-sticks', d: [-5, -2.5, 0, 2.5, 5].map((x, i) => stroke([[x * 0.6, 4], [x, -58 + (i % 2) * 4]], 1.8, 0.02, 0.02, 0.8)).join('') }),
      s('path', { class: 't24i-b-tips', d: [-5, 0, 5].map((x) => stroke([[x, -50], [x, -58]], 2.4, 0.05, 0.05, 0.8)).join('') }),
      s('path', { class: 't24i-b-band', d: 'M-6.5 -20h13v7h-13Z' }),
      s('path', { class: 't24i-b-band-hi', d: 'M-6 -19.5h12v1.4h-12Z' })))
  // the bridge from learning to thinking and what a stick stands for (top left, until the insight takes that corner)
  const top = h('div', { class: 't24i-top' }, h('p', { class: 't24i-bridge' }, K.bridge), h('p', { class: 't24i-decode' }, K.decode))
  const note = h('div', { class: 't24i-pnote-box' }, ctx.fact(K.puzzleNote, 'p', 't24i-pnote'))
  const puzzle = h('div', { class: 't24i-puzzle' }, h('p', { class: 't24i-pq' }, K.puzzle),
    h('p', { class: 't24i-pa', 'aria-live': 'polite' }, h('s', { class: 't24i-quick' }, K.quick), h('b', { class: 't24i-right' }, K.right)))
  root.append(bg, embers, road, moonBox, smoke, figSvg, nearSvg, ...notches, ...ends, puzzle, bundle, top, note)
  root.dataset.v = '1'
  ctx.prompt(K.prompt)
  const g = guide(ctx)
  let dot: Mark | null = g.dot(bundle, { dir: [0, -1] })
  const way = g.track(() => (G.notch.length ? G.notch.map((y) => [G.gx, y] as Pt) : [[0, 0], [0, 1]]), { ticks: N })

  const G = { W: 0, H: 0, dpr: 1, wide: true, hz: 0, sy: 0, ix: 0, iy: 0, u: 0, stick: 0, gx: 0, mx: 0, my: 0, moon: [] as Pt[], notch: [] as number[], st: { x0: 0, sw: 0, sh: 0, base: 0 } }
  let col = { paper: '', paper2: '', wash: '', water: '', mist: '', moon: '', lantern: '', rockHi: '', rockMid: '', rockLo: '', moss: '', mossC: '', umbra: '', dark: false }
  const read = () => {
    const c = (n: string) => cssVar(n)
    col = { paper: c('--paper'), paper2: c('--paper-2'), wash: c('--wash'), water: c('--water'), mist: c('--mist'), moon: c('--moon'), lantern: c('--lantern'), rockHi: c('--rock-hi'), rockMid: c('--rock-mid'), rockLo: c('--rock-lo'), moss: c('--moss-a'), mossC: c('--moss-c'), umbra: c('--umbra'), dark: document.documentElement.dataset.theme === 'dark' }
    warm = tint(col.lantern)
    // by night the smoke is moonlit mist; by day a thin wash of ink, so it never turns into a grey slab
    cool = tint(col.dark ? col.mist : col.wash)
    smokeLine = rgba(col.dark ? col.mist : col.wash, 1)
    draftInk = col.dark ? col.moon : col.wash
  }
  let warm: HTMLCanvasElement, cool: HTMLCanvasElement
  let smokeLine = '', draftInk = ''
  let theme = ''
  ctx.onCleanup(onPrefs(() => {
    const t = document.documentElement.dataset.theme ?? ''
    if (t === theme || !G.W) return
    theme = t
    read()
    paintBg()
    paintEmbers()
    paintSmoke(phase)
  }))

  function* draw(W: number, H: number) {
    const wide = W / H >= 1.05
    const dpr = Math.min(devicePixelRatio || 1, ctx.quality === 'low' ? 1 : 1.5)
    const u = wide ? Math.min(H * 0.3, W * 0.19) : Math.min(H * 0.21, W * 0.3)
    const ix = W * (wide ? 0.5 : 0.46), iy = H * (wide ? 0.86 : 0.85)
    Object.assign(G, { W, H, dpr, wide, u, ix, iy, hz: H * (wide ? 0.43 : 0.36), sy: H * (wide ? 0.67 : 0.62), stick: u * 0.42, gx: ix + u * (wide ? 0.5 : 0.5) })
    // the groove's four notches, 60 px apart, the first at the bundle's resting place
    const g0 = iy - u * 0.12
    G.notch = Array.from({ length: N }, (_, i) => g0 - i * STEP)
    // the stele in the right third, at least 40 % of the frame high
    const sw = wide ? u * 0.82 : Math.min(W - (ix + u * 0.9) - 8, u * 1.02)
    const x0 = wide ? ix + u * 1.24 : W - sw - 8
    const sh = Math.max(H * (wide ? 0.45 : 0.42), u * 1.4)
    G.st = { x0, sw, sh, base: H * (wide ? 0.93 : 0.95) }
    // the moon crosses the sky behind the smoke as the sticks burn: right of the column → left of it
    const span = wide ? W * 0.11 : W * 0.3
    G.moon = Array.from({ length: N }, (_, i) => [ix + span * (1 - (i * 2) / (N - 1)), H * ((wide ? 0.15 : 0.13) - Math.sin((i / (N - 1)) * Math.PI) * 0.045)] as Pt)
    for (const c of [bg, embers, smoke]) {
      c.width = Math.round(W * dpr)
      c.height = Math.round(H * dpr)
      c.style.width = `${f1(W)}px`
      c.style.height = `${f1(H)}px`
    }
    for (const el of [figSvg, nearSvg, road]) el.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    theme = document.documentElement.dataset.theme ?? ''
    read()
    yield
    paintBg()
    yield
    paintEmbers()
    yield
    drawFigures()
    yield
    paintSmoke(phase)
    place()
  }

  /** The far shore's line: it bows toward us round a bay and wanders a little (screen px). */
  const farShore = (x: number) => G.hz + G.H * 0.004 + G.H * 0.025 * Math.pow(Math.sin(Math.PI * clamp((x / G.W) * 0.9 + 0.08, 0, 1)), 3) - G.H * 0.006 * Math.sin((x / G.W) * 11)
  /** the near shore's edge (where rock meets water) at x */
  const nearEdge = (x: number) => G.sy - Math.pow(0.5 + 0.5 * Math.sin(x * 0.011 + 1.3), 2) * G.u * 0.1 - Math.pow(0.5 + 0.5 * Math.sin(x * 0.004), 2) * G.u * 0.08

  // ── the painting behind: sky, far ranges in mist, the lake (always darker than the sky), the rocky near shore
  function paintBg() {
    const { W, H, dpr, hz, sy, ix, iy, u } = G
    const g = bg.getContext('2d')!
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, W, H)
    const r = rng(2492)
    const sky = g.createLinearGradient(0, 0, 0, hz)
    sky.addColorStop(0, col.dark ? col.paper : col.paper2)
    sky.addColorStop(1, col.dark ? col.paper2 : col.paper)
    g.fillStyle = sky
    g.fillRect(0, 0, W, hz + 2)
    const range = (h: number, seed: number, a: number, peaks: number, x0 = -W * 0.05, x1 = W * 1.05) => {
      const pts = ridge(x0, x1, hz, h, seed, peaks)
      const gr = g.createLinearGradient(0, hz - h, 0, hz)
      gr.addColorStop(0, rgba(col.wash, a))
      gr.addColorStop(1, rgba(col.wash, a * 0.1))
      g.fillStyle = gr
      g.beginPath()
      g.moveTo(x0, hz)
      for (const [x, y] of pts) g.lineTo(x, y)
      g.lineTo(x1, hz)
      g.fill()
    }
    range(H * 0.15, 2490, col.dark ? 0.45 : 0.16, G.wide ? 6 : 4)
    range(H * 0.08, 2491, col.dark ? 0.7 : 0.24, 2, -W * 0.05, W * 0.38)
    range(H * 0.06, 2489, col.dark ? 0.7 : 0.22, 2, W * 0.66, W * 1.05)
    // the lake: by day a mid blue-grey clearly darker than the sky, by night near black
    const lake = g.createLinearGradient(0, hz - H * 0.01, 0, sy + u * 0.2)
    lake.addColorStop(0, rgba(col.water, col.dark ? 0.55 : 0.62))
    lake.addColorStop(0.12, rgba(col.water, col.dark ? 0.8 : 0.82))
    lake.addColorStop(1, rgba(col.water, 1))
    g.fillStyle = lake
    g.fillRect(0, hz - H * 0.006, W, sy - hz + u * 0.3)
    // the far shore: a low dark strip curving round a bay (the embers will stand on it)
    g.fillStyle = rgba(col.wash, col.dark ? 0.78 : 0.42)
    g.beginPath()
    g.moveTo(-W * 0.05, hz - H * 0.006)
    for (let x = -W * 0.05; x <= W * 1.05; x += W / 60) g.lineTo(x, farShore(x) + H * 0.004 + Math.sin(x * 0.05) * H * 0.002)
    for (let x = W * 1.05; x >= -W * 0.05; x -= W / 60) g.lineTo(x, farShore(x) - H * 0.009 - Math.abs(Math.sin(x * 0.021)) * H * 0.006)
    g.fill()
    glow(g, W * 0.5, hz + 2, W * 0.7, H * 0.03, col.mist, col.dark ? 0.4 : 0.7)
    // a few dry ripples, far fewer near the monk (no stripes behind his head), longer toward us
    g.strokeStyle = rgba(col.dark ? col.moon : '#ffffff', col.dark ? 0.1 : 0.35)
    const mx0 = ix - u * 1.75, mx1 = ix - u * 0.6
    for (let i = 0; i < 70; i++) {
      const t = Math.pow(r(), 0.8), y = hz + 8 + t * (sy - hz - 14)
      const len = W * (0.01 + t * 0.04) * (0.5 + r()), x = r() * W
      if (x + len > mx0 && x < mx1) continue
      g.lineWidth = 0.6 + t * 1.2
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x + len, y + (r() - 0.5))
      g.stroke()
    }
    // the censer's warm light spilling on the water at the shore
    glow(g, ix, sy, u * 1.3, u * 0.2, col.lantern, col.dark ? 0.35 : 0.3)
    // the near shore: boulders with lit tops and dark undersides, moss on the tops, a wet dark lip
    const edge: Pt[] = []
    for (let i = 0; i <= 48; i++) {
      const x = -W * 0.04 + (W * 1.08 * i) / 48
      edge.push([x, nearEdge(x)])
    }
    const shore: Pt[] = [...edge, [W * 1.04, H * 1.02], [-W * 0.04, H * 1.02]]
    const sg = g.createLinearGradient(0, sy - u * 0.2, 0, H)
    sg.addColorStop(0, col.rockMid)
    sg.addColorStop(0.3, col.rockLo)
    sg.addColorStop(1, col.dark ? col.umbra : col.rockLo)
    g.fillStyle = sg
    poly(g, shore)
    g.fill()
    g.save()
    poly(g, shore)
    g.clip()
    // boulders: rounded masses, a lit crown toward the moon (high, behind the smoke), a shadowed underside, moss on top
    for (let i = 0; i < 13; i++) {
      const bx = -W * 0.03 + (W * 1.06 * (i + r() * 0.6)) / 13, by = sy + u * (0.02 + r() * 0.28), bw = u * (0.26 + r() * 0.3), bh = bw * (0.42 + r() * 0.2)
      const gr = g.createLinearGradient(bx, by - bh, bx, by + bh * 0.6)
      gr.addColorStop(0, rgba(col.rockHi, col.dark ? 0.55 : 0.85))
      gr.addColorStop(0.4, rgba(col.rockMid, 0.6))
      gr.addColorStop(1, rgba(col.umbra, col.dark ? 0.6 : 0.35))
      g.fillStyle = gr
      g.beginPath()
      for (let k = 0; k <= 18; k++) {
        const a = Math.PI + (k / 18) * Math.PI, wob = 1 + 0.12 * Math.sin(a * 3 + i) + 0.07 * Math.sin(a * 7 + i * 2)
        const x = bx + Math.cos(a) * bw * wob, y = by + Math.sin(a) * bh * wob * (k > 9 ? 0.85 : 1.1)
        if (k) g.lineTo(x, y)
        else g.moveTo(x, y)
      }
      g.quadraticCurveTo(bx, by + bh * 0.25, bx - bw, by)
      g.fill()
      g.fillStyle = rgba(col.moss, col.dark ? 0.5 : 0.55)
      g.beginPath()
      g.ellipse(bx - bw * 0.1 + (r() - 0.5) * bw * 0.3, by - bh * 0.92, bw * (0.3 + r() * 0.25), bh * 0.12, 0, 0, Math.PI * 2)
      g.fill()
      g.strokeStyle = rgba(col.dark ? col.umbra : col.wash, col.dark ? 0.65 : 0.32)
      g.lineWidth = 1.6
      g.beginPath()
      g.moveTo(bx - bw * 0.95, by + 1)
      g.quadraticCurveTo(bx, by + bh * 0.28, bx + bw * 0.95, by + 1)
      g.stroke()
    }
    glow(g, ix, iy - u * 0.02, u * 1.4, u * 0.3, col.lantern, col.dark ? 0.25 : 0.2)
    g.strokeStyle = rgba(col.dark ? col.umbra : col.wash, col.dark ? 0.55 : 0.26)
    for (let i = 0; i < 50; i++) {
      const x = r() * W, y = sy + u * 0.15 + r() * (H - sy), l = 8 + r() * 26
      g.lineWidth = 0.8 + r() * 1.6
      g.beginPath()
      g.moveTo(x, y)
      g.quadraticCurveTo(x + l * 0.5, y + (r() - 0.5) * 6, x + l, y + (r() - 0.3) * 8)
      g.stroke()
    }
    g.restore()
    // the wet lip where rock meets water: a dark band and a thin moonlit edge
    g.lineCap = 'round'
    g.strokeStyle = rgba(col.umbra, col.dark ? 0.7 : 0.32)
    g.lineWidth = 4
    g.beginPath()
    edge.forEach(([x, y], i) => (i ? g.lineTo(x, y + 2) : g.moveTo(x, y + 2)))
    g.stroke()
    g.strokeStyle = rgba(col.dark ? col.moon : '#ffffff', col.dark ? 0.35 : 0.75)
    g.lineWidth = 1.2
    g.beginPath()
    edge.forEach(([x, y], i) => (i ? g.lineTo(x, y - 1) : g.moveTo(x, y - 1)))
    g.stroke()
  }

  /**
   * The last stick: a whole far shore of tiny embers, like a field of incense, each mirrored as a short streak in the
   * water below; smaller and fainter further off, in groups, with a veil of mist over them.
   */
  function paintEmbers() {
    const { W, H, dpr, hz } = G
    const g = embers.getContext('2d')!
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, W, H)
    const r = rng(2493)
    const gapAt = (x: number) => Math.sin(x * 0.013) + 0.7 * Math.sin(x * 0.031 + 2) + 0.4 * Math.sin(x * 0.07 + 5)
    const rows = 4
    const per = (ctx.quality === 'low' ? 150 : 300) * (col.dark ? 1 : 0.5)
    for (let k = 0; k < rows; k++) {
      const near = k / (rows - 1)
      for (let i = 0; i < per; i++) {
        const x = r() * W
        if (gapAt(x + k * 40) < -0.4 + near * 0.3) continue
        const y = farShore(x) + near * H * 0.01 + (r() - 0.5) * H * 0.003
        const sz = (col.dark ? 0.45 : 0.45) + near * (col.dark ? 0.8 : 0.6)
        const a = (0.2 + near * 0.5) * (0.6 + r() * 0.4) * (col.dark ? 1 : 0.9)
        g.fillStyle = rgba(col.lantern, a)
        g.beginPath()
        g.arc(x, y, sz, 0, Math.PI * 2)
        g.fill()
        // a thread of smoke from some of them (a field of incense, not a town)
        if (r() < 0.22) {
          g.fillStyle = rgba(col.dark ? col.mist : col.wash, col.dark ? 0.18 : 0.12)
          g.fillRect(x - 0.3, y - H * (0.012 + r() * 0.02), 0.6, H * 0.012)
        }
        // its reflection: a short broken streak straight down in the water
        if (r() < 0.6) {
          g.fillStyle = rgba(col.lantern, a * 0.4)
          g.fillRect(x - sz * 0.4, y + H * 0.008 + near * H * 0.006, sz * 0.8, H * (0.006 + near * 0.012) * (0.5 + r()))
        }
      }
    }
    glow(g, W * 0.5, hz + H * 0.012, W * 0.6, H * 0.03, col.lantern, col.dark ? 0.28 : 0.2)
    glow(g, W * 0.5, hz + H * 0.002, W * 0.65, H * 0.014, col.mist, col.dark ? 0.32 : 0.5)
  }

  // ── the monk on his rock, the censer and the groove post on their slab, the stele, the reeds; the near rocks
  function drawFigures() {
    const { W, H, u, ix, iy, wide } = G
    figSvg.replaceChildren(
      s('defs', null,
        s('linearGradient', { id: 't24i-bronze', x1: 0, y1: 0, x2: 1, y2: 0.3 }, s('stop', { offset: 0, class: 't24i-br0' }), s('stop', { offset: 0.5, class: 't24i-br1' }), s('stop', { offset: 1, class: 't24i-br2' })),
        s('linearGradient', { id: 't24i-stone', x1: 0, y1: 0, x2: 1, y2: 0.15 }, s('stop', { offset: 0, class: 't24i-sg0' }), s('stop', { offset: 0.35, class: 't24i-sg1' }), s('stop', { offset: 1, class: 't24i-sg2' })),
        s('linearGradient', { id: 't24i-wood', x1: 0, y1: 0, x2: 1, y2: 0 }, s('stop', { offset: 0, class: 't24i-wd0' }), s('stop', { offset: 0.4, class: 't24i-wd1' }), s('stop', { offset: 1, class: 't24i-wd2' }))),
      reeds(W * (wide ? 0.93 : 0.04), G.sy + u * 0.08, u * (wide ? 0.6 : 0.5), 2441, 9),
      ...stele(),
      ...seat(ix - u * (wide ? 1.28 : 0.98), iy + u * 0.03),
      ...monk(ix - u * (wide ? 1.28 : 0.98), iy - u * 0.02),
      ...slab(),
      ...post(),
      ...censerArt())
    moonBox.replaceChildren(moon(0, 0, wide ? 20 : 17, 2494, false))
    // the moon's road on the water, moved with the moon (dry strokes, longer toward us)
    const r = rng(2496)
    let d = ''
    for (let y = G.hz + 5; y < G.hz + (G.sy - G.hz) * 0.3; y += 3 + r() * 4) {
      const t = (y - G.hz) / (G.sy - G.hz), len = W * (0.008 + t * 0.05) * (0.5 + r())
      const x = (r() - 0.5) * W * (0.015 + t * 0.03) - len / 2
      d += `M${f1(x)} ${f1(y)}h${f1(len)}`
    }
    road.replaceChildren(s('path', { class: 't24i-roadink', d }))
    // near and dark: a big boulder cut by the bottom-left corner (a stone with volume, moss on its crown)
    const nw = u * (wide ? 1.7 : 1.1), nh = u * (wide ? 0.62 : 0.42)
    nearSvg.replaceChildren(s('g', { class: 't24i-near', transform: `translate(${f1(nw * 0.22)} ${f1(H + nh * 0.32)})` }, stoneArt(nw, nh, 2499, 'p2-stone t24i-near-stone'),
      s('path', { class: 't24i-near-moss', d: blob(-nw * 0.05, -nh * 0.92, nw * 0.24, nh * 0.07, 2500, 0.3, 14), filter: 'url(#ink-rough)' })))
  }

  /** The monk's flat rock: a low boulder with a lit top, a shadowed face, moss, a contact shadow. */
  function seat(mx: number, my: number): SVGElement[] {
    const { u } = G
    const w = u * 0.62, hh = u * 0.13
    const top = `M${f1(mx - w)} ${f1(my)}Q${f1(mx - w * 0.6)} ${f1(my - hh * 0.7)} ${f1(mx)} ${f1(my - hh * 0.75)}Q${f1(mx + w * 0.7)} ${f1(my - hh * 0.65)} ${f1(mx + w)} ${f1(my - hh * 0.1)}Q${f1(mx + w * 1.02)} ${f1(my + hh * 0.7)} ${f1(mx + w * 0.85)} ${f1(my + hh)}Q${f1(mx)} ${f1(my + hh * 1.25)} ${f1(mx - w * 0.85)} ${f1(my + hh)}Q${f1(mx - w * 1.04)} ${f1(my + hh * 0.6)} ${f1(mx - w)} ${f1(my)}Z`
    return [
      s('ellipse', { class: 't24i-slab-sh', cx: f1(mx + u * 0.05), cy: f1(my + hh * 1.1), rx: f1(w * 1.08), ry: f1(u * 0.05) }),
      s('path', { class: 't24i-seat', d: top, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
      s('path', { class: 't24i-seat-shade', d: top, fill: 'url(#p2-shade)' }),
      s('path', { class: 't24i-seat-moss', d: blob(mx + w * 0.55, my - hh * 0.35, w * 0.22, hh * 0.18, 2501, 0.3, 12) + blob(mx - w * 0.7, my - hh * 0.05, w * 0.14, hh * 0.14, 2502, 0.3, 10) }),
      s('path', { class: 't24i-slab-ink', d: stroke([[mx - w * 0.95, my + hh * 0.2], [mx, my + hh * 0.42], [mx + w * 0.92, my + hh * 0.2]], 1.6, 0.1, 0.1, 0.3) }),
    ]
  }

  /**
   * The monk in confident strokes, seated facing the censer (to the right): a shaved head on a short neck, the robe a
   * mountain of wash, one stroke for the back, one for the sleeve down to the folded hands, one for the crossed legs, folds.
   */
  function monk(mx: number, my: number): SVGElement[] {
    const { u } = G
    const P = (x: number, y: number): Pt => [mx + x * u, my + y * u]
    const robe = [P(-0.02, -0.71), ...curve(P(-0.16, -0.66), P(-0.34, -0.45), P(-0.38, 0), 12), P(0.47, 0), P(0.46, -0.08), ...curve(P(0.4, -0.15), P(0.26, -0.2), P(0.19, -0.24), 6), ...curve(P(0.24, -0.34), P(0.22, -0.52), P(0.1, -0.66), 8), P(0.06, -0.7)]
    const hx = mx + 0.09 * u, hy = my - 0.81 * u, hr = u * 0.095
    const back = stroke([P(-0.03, -0.73), ...curve(P(-0.17, -0.67), P(-0.36, -0.47), P(-0.4, 0.01), 14).slice(1)], u * 0.05, 0.05, 0.35, 0.25)
    const sleeve = stroke([P(0.07, -0.69), ...curve(P(0.2, -0.6), P(0.27, -0.42), P(0.19, -0.25), 10).slice(1)], u * 0.034, 0.08, 0.4, 0.3)
    const legs = stroke([P(-0.05, -0.12), ...curve(P(0.12, -0.17), P(0.36, -0.15), P(0.48, -0.02), 10).slice(1)], u * 0.03, 0.1, 0.3, 0.3) + stroke([P(-0.42, 0.01), P(0.05, 0.03), P(0.5, 0.01)], u * 0.026, 0.05, 0.3, 0.35)
    const folds = stroke(curve(P(-0.12, -0.58), P(-0.2, -0.32), P(-0.14, -0.08), 10), u * 0.014, 0.2, 0.3, 0.2) + stroke(curve(P(0.03, -0.55), P(0.0, -0.36), P(0.06, -0.2), 8), u * 0.012, 0.2, 0.3, 0.2) + stroke(curve(P(0.12, -0.12), P(0.26, -0.1), P(0.38, -0.05), 6), u * 0.011, 0.2, 0.3, 0.2)
    const kesa = stroke(curve(P(-0.06, -0.68), P(0.02, -0.5), P(0.14, -0.3), 8), u * 0.045, 0.15, 0.25, 0.3)
    const head = blob(hx, hy, hr, hr * 1.06, 2443, 0.04, 16)
    const skull = stroke(Array.from({ length: 16 }, (_, j) => { const a = Math.PI * (0.55 + (j / 15) * 1.1); return [hx + Math.cos(a) * hr, hy + Math.sin(a) * hr * 1.06] as Pt }), u * 0.02, 0.2, 0.3, 0.25)
    const face = stroke([[hx + hr * 0.35, hy - hr * 0.05], [hx + hr * 0.72, hy - hr * 0.02]], u * 0.008, 0.2, 0.2, 0.3) + stroke(curve([hx + hr * 0.88, hy - hr * 0.3], [hx + hr * 1.12, hy + hr * 0.05], [hx + hr * 0.92, hy + hr * 0.2], 6), u * 0.009, 0.2, 0.3, 0.3) + stroke(curve([hx - hr * 0.12, hy - hr * 0.1], [hx - hr * 0.3, hy + hr * 0.1], [hx - hr * 0.1, hy + hr * 0.3], 6), u * 0.011, 0.2, 0.3, 0.3)
    const neck = `M${f1(hx - hr * 0.42)} ${f1(hy + hr * 0.7)}L${f1(hx + hr * 0.35)} ${f1(hy + hr * 0.8)}L${f1(mx + 0.07 * u)} ${f1(my - 0.68 * u)}L${f1(mx - 0.03 * u)} ${f1(my - 0.7 * u)}Z`
    return [
      s('ellipse', { class: 't24i-mat', cx: f1(mx + 0.04 * u), cy: f1(my + 2), rx: f1(u * 0.5), ry: f1(u * 0.05) }),
      s('path', { class: 't24i-robe', d: `M${robe.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}Z`, filter: 'url(#ink-wash)' }),
      s('path', { class: 't24i-kesa', d: kesa, filter: 'url(#ink-rough)' }),
      s('path', { class: 't24i-fold', d: folds }),
      s('path', { class: 't24i-contour', d: back + sleeve + legs, filter: 'url(#ink-rough)' }),
      s('path', { class: 't24i-hands', d: blob(mx + 0.2 * u, my - 0.23 * u, u * 0.06, u * 0.035, 2444, 0.15, 10) }),
      s('path', { class: 't24i-head', d: neck + head }),
      s('path', { class: 't24i-head-ink', d: skull + face }),
      s('path', { class: 't24i-warmrim', d: stroke(curve(P(0.12, -0.65), P(0.26, -0.48), P(0.24, -0.3), 8), u * 0.012, 0.3, 0.3, 0.1) + stroke(curve([hx + hr * 0.6, hy - hr * 0.75], [hx + hr * 1.05, hy - hr * 0.3], [hx + hr * 0.95, hy + hr * 0.3], 6), u * 0.009, 0.3, 0.3, 0.1) }),
    ]
  }

  /** The low flat stone under the censer and the post: lit top, a front face, an ink line where they meet. */
  function slab(): SVGElement[] {
    const { u, ix, iy } = G
    const x0 = ix - u * 0.42, x1 = G.gx + u * 0.18, fh = u * 0.13, top = iy - u * 0.02, m = (x0 + x1) / 2
    const topD = `M${f1(x0)} ${f1(top)}Q${f1(m)} ${f1(top - u * 0.07)} ${f1(x1)} ${f1(top - u * 0.01)}Q${f1(x1 + u * 0.03)} ${f1(top + u * 0.03)} ${f1(x1 - u * 0.02)} ${f1(top + u * 0.05)}Q${f1(m)} ${f1(top + u * 0.08)} ${f1(x0 + u * 0.02)} ${f1(top + u * 0.05)}Q${f1(x0 - u * 0.03)} ${f1(top + u * 0.03)} ${f1(x0)} ${f1(top)}Z`
    const face = `M${f1(x0 + u * 0.02)} ${f1(top + u * 0.05)}Q${f1(m)} ${f1(top + u * 0.08)} ${f1(x1 - u * 0.02)} ${f1(top + u * 0.05)}L${f1(x1 - u * 0.05)} ${f1(top + fh)}Q${f1(m)} ${f1(top + fh + u * 0.04)} ${f1(x0 + u * 0.05)} ${f1(top + fh)}Z`
    return [
      s('ellipse', { class: 't24i-slab-sh', cx: f1(m + u * 0.05), cy: f1(top + fh + 2), rx: f1((x1 - x0) * 0.56), ry: f1(u * 0.05) }),
      s('path', { class: 't24i-slab-face', d: face, filter: 'url(#ink-rough)' }),
      s('path', { class: 't24i-slab-top', d: topD, filter: 'url(#ink-rough)' }),
      s('path', { class: 't24i-slab-ink', d: stroke([[x0 + u * 0.02, top + u * 0.05], [m, top + u * 0.075], [x1 - u * 0.02, top + u * 0.05]], 1.6, 0.1, 0.1, 0.3) }),
    ]
  }

  /** The groove post standing on the slab: a squared timber with a vertical slot and four notches cut across it. */
  function post(): SVGElement[] {
    const { u, gx, iy, notch } = G
    const w = Math.max(16, u * 0.11), foot = iy - u * 0.02, topY = notch[N - 1] - u * 0.22
    let cuts = ''
    for (const y of notch) cuts += `M${f1(gx - w * 0.5)} ${f1(y)}L${f1(gx - w * 0.2)} ${f1(y + 3)}L${f1(gx + w * 0.2)} ${f1(y + 3)}L${f1(gx + w * 0.5)} ${f1(y)}`
    return [
      s('path', { class: 't24i-post', d: `M${f1(gx - w / 2)} ${f1(foot)}L${f1(gx - w / 2)} ${f1(topY + w * 0.25)}L${f1(gx)} ${f1(topY)}L${f1(gx + w / 2)} ${f1(topY + w * 0.25)}L${f1(gx + w / 2)} ${f1(foot)}Z`, fill: 'url(#t24i-wood)', filter: 'url(#ink-rough)' }),
      s('path', { class: 't24i-slot', d: `M${f1(gx - w * 0.14)} ${f1(notch[0] + 6)}V${f1(notch[N - 1] - 8)}h${f1(w * 0.28)}V${f1(notch[0] + 6)}Z` }),
      s('path', { class: 't24i-cuts', d: cuts }),
      s('path', { class: 't24i-post-lit', d: `M${f1(gx - w / 2 + 1)} ${f1(topY + w * 0.3)}V${f1(foot - 2)}` }),
    ]
  }

  /** The censer: a three-legged bronze bowl lit by its own embers; up to four sticks rising from the ash. */
  function censerArt(): SVGElement[] {
    const { u, ix, iy } = G
    const cw = u * 0.17, cy = iy - u * 0.07
    const bowl = `M${f1(ix - cw)} ${f1(cy - cw * 0.55)}Q${f1(ix - cw * 1.08)} ${f1(cy + cw * 0.55)} ${f1(ix)} ${f1(cy + cw * 0.6)}Q${f1(ix + cw * 1.08)} ${f1(cy + cw * 0.55)} ${f1(ix + cw)} ${f1(cy - cw * 0.55)}Z`
    const sticks: SVGElement[] = []
    for (let k = 0; k < N; k++) {
      const sx = ix + (k - (N - 1) / 2) * cw * 0.3, lean = (k - (N - 1) / 2) * 0.05
      const tp: Pt = [sx + lean * G.stick, cy - cw * 0.5 - G.stick * (0.92 - k * 0.04)]
      sticks.push(s('g', { class: `t24i-stick k${k}` },
        s('path', { class: 't24i-stem', d: stroke([[sx, cy - cw * 0.5], tp], 2.2, 0.02, 0.02, 0.8) }),
        s('circle', { class: 't24i-coal', cx: f1(tp[0]), cy: f1(tp[1]), r: 2.6 }),
        s('circle', { class: 't24i-coalglow', cx: f1(tp[0]), cy: f1(tp[1]), r: f1(u * 0.12), fill: 'url(#p2-lamp)' })))
    }
    return [
      s('circle', { class: 't24i-censer-glow', cx: f1(ix), cy: f1(cy - cw * 0.3), r: f1(u * 0.5), fill: 'url(#p2-lamp)' }),
      s('path', { class: 't24i-legs', d: stroke([[ix - cw * 0.6, cy + cw * 0.4], [ix - cw * 0.75, cy + cw * 0.85]], 2.4, 0.1, 0.2, 0.5) + stroke([[ix + cw * 0.6, cy + cw * 0.4], [ix + cw * 0.75, cy + cw * 0.85]], 2.4, 0.1, 0.2, 0.5) + stroke([[ix, cy + cw * 0.55], [ix, cy + cw * 0.9]], 2.2, 0.1, 0.2, 0.5) }),
      s('path', { class: 't24i-bowl', d: bowl, fill: 'url(#t24i-bronze)' }),
      s('ellipse', { class: 't24i-ash', cx: f1(ix), cy: f1(cy - cw * 0.55), rx: f1(cw), ry: f1(cw * 0.2) }),
      s('path', { class: 't24i-bowl-hi', d: stroke(curve([ix - cw * 0.8, cy - cw * 0.3], [ix - cw * 0.85, cy + cw * 0.1], [ix - cw * 0.5, cy + cw * 0.4], 6), 1.8, 0.3, 0.3, 0.1) }),
      s('path', { class: 't24i-bowl-band', d: stroke([[ix - cw * 0.95, cy - cw * 0.2], [ix, cy - cw * 0.1], [ix + cw * 0.95, cy - cw * 0.2]], 1.4, 0.1, 0.1, 0.4) }),
      ...sticks,
    ]
  }

  /**
   * The stele in the right third: a tall natural slab, uneven edges, a weathered crown, vertical grain, a moonlit rim, moss
   * at its foot and a contact shadow; two notches cut into its left edge low down (the two scores, carved beside them).
   * The puzzle and its answer are HTML carved into the face (sunk letters catching the moon).
   */
  function stele(): SVGElement[] {
    const { u, wide } = G
    const { x0, sw, sh, base } = G.st
    const r = rng(2445)
    const nY = [base - sh * 0.2, base - sh * 0.33] // 75.7 % · 87.5 %
    // the outline: left edge (with the two V notches) up, a crown with a broken shoulder, the right edge down
    const left: Pt[] = [[x0 + sw * 0.03, base]]
    for (const y of nY) left.push([x0 + sw * 0.0, y + u * 0.03], [x0 + sw * 0.1, y], [x0 + sw * 0.0, y - u * 0.03])
    left.push([x0 - sw * 0.02, base - sh * 0.62], [x0 + sw * 0.03, base - sh * 0.9])
    const crown: Pt[] = [[x0 + sw * 0.1, base - sh * 0.97], [x0 + sw * 0.3, base - sh * 1.03], [x0 + sw * 0.52, base - sh * 1.0], [x0 + sw * 0.62, base - sh * 1.04], [x0 + sw * 0.78, base - sh * 0.95], [x0 + sw * 0.86, base - sh * 0.97], [x0 + sw * 1.0, base - sh * 0.83]]
    const right: Pt[] = [[x0 + sw * 1.04, base - sh * 0.66], [x0 + sw * 0.99, base - sh * 0.45], [x0 + sw * 1.03, base - sh * 0.2], [x0 + sw * 1.06, base]]
    const outline = `M${[...left, ...crown, ...right].map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}Z`
    let grain = ''
    for (let k = 0; k < 9; k++) {
      const x = x0 + sw * (0.1 + r() * 0.82), y0 = base - sh * (0.08 + r() * 0.75), l = sh * (0.08 + r() * 0.18)
      grain += stroke([[x, y0], [x + (r() - 0.5) * sw * 0.06, y0 + l * 0.5], [x + (r() - 0.5) * sw * 0.08, y0 + l]], 1 + r() * 1.2, 0.3, 0.4, 0.2)
    }
    const notchInk = nY.map((y) => `M${f1(x0 - 1)} ${f1(y - u * 0.03)}L${f1(x0 + sw * 0.1)} ${f1(y)}L${f1(x0 - 1)} ${f1(y + u * 0.004)}Z`).join('')
    // the face's flat dressed panel where the words are cut (a slightly paler, smoother field)
    const fx0 = x0 + sw * 0.13, fx1 = x0 + sw * 0.9, fy0 = base - sh * 0.9, fy1 = base - sh * 0.42
    Object.assign(puzzle.style, { left: `${f1(fx0 + 6)}px`, top: `${f1(fy0 + 8)}px`, width: `${f1(fx1 - fx0 - 12)}px`, fontSize: `${f1(clamp(sw * (wide ? 0.085 : 0.11), 12, 15))}px` })
    notches.forEach((el, i) => Object.assign(el.style, { left: `${f1(x0 + sw * 0.16)}px`, top: `${f1(nY[i] - 9)}px`, maxWidth: `${f1(sw * 0.82)}px` }))
    const rim = stroke([[x0 + sw * 0.03, base - sh * 0.9], [x0 + sw * 0.14, base - sh * 0.99], [x0 + sw * 0.42, base - sh * 1.02], [x0 + sw * 0.66, base - sh * 0.99]], Math.max(1.6, u * 0.012), 0.2, 0.3, 0.2)
    return [
      s('ellipse', { class: 't24i-stele-sh', cx: f1(x0 + sw * 0.5), cy: f1(base + 2), rx: f1(sw * 0.72), ry: f1(u * 0.05) }),
      s('path', { class: 't24i-stele', d: outline, fill: 'url(#t24i-stone)', filter: 'url(#ink-rough)' }),
      s('path', { class: 't24i-stele-shade', d: outline, fill: 'url(#p2-shade)' }),
      s('path', { class: 't24i-panel', d: `M${f1(fx0)} ${f1(fy0)}L${f1(fx1)} ${f1(fy0 + 2)}L${f1(fx1 - 1)} ${f1(fy1)}L${f1(fx0 + 1)} ${f1(fy1 - 1)}Z` }),
      s('path', { class: 't24i-grain', d: grain, filter: 'url(#ink-dry)' }),
      s('path', { class: 't24i-lichen', d: [0, 1, 2, 3, 4].map((k) => blob(x0 + sw * (0.15 + r() * 0.7), base - sh * (0.05 + r() * 0.35 + (k > 2 ? 0.5 : 0)), sw * (0.03 + r() * 0.04), sw * (0.02 + r() * 0.03), 2448 + k, 0.4, 10)).join('') }),
      s('path', { class: 't24i-stele-lit', d: rim }),
      s('path', { class: 't24i-notch', d: notchInk }),
      s('path', { class: 't24i-stele-moss', d: blob(x0 + sw * 0.25, base - u * 0.02, sw * 0.28, u * 0.04, 2446, 0.35, 14) + blob(x0 + sw * 0.82, base - u * 0.015, sw * 0.18, u * 0.03, 2447, 0.35, 12), filter: 'url(#ink-rough)' }),
    ]
  }

  // ── smoke: puffs along a column straight up the middle of the frame, from the ember to the top edge; the more sticks,
  // the taller, wider and curlier. Called every frame while the bundle is drawn (quality=high): no allocation in here.
  let phase = 0
  let seed = 0
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  const S = { y0: 0, top: 0, n: 1, ph: 0 }
  const cx = (y: number, k: number) => {
    const t = (S.y0 - y) / (S.y0 - S.top)
    return G.ix + Math.sin(t * 2.2 + 0.6) * G.W * 0.012 * t + Math.sin(t * (3 + S.n) + S.ph * 1.3 + k) * G.u * (0.04 + t * 0.11 * (0.6 + S.n * 0.25))
  }
  function paintSmoke(ph: number) {
    const { W, H, dpr, ix, stick, u, iy } = G
    const g = smoke.getContext('2d')!
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, W, H)
    const n = v
    S.n = n
    S.ph = ph
    S.y0 = iy - u * 0.12 - stick * 0.9
    S.top = H * (0.3 - n * 0.12) // even one stick reaches far up; four go past the top edge
    seed = 2495
    const a0 = col.dark ? 0.05 : 0.016
    const steps = Math.round((S.y0 - S.top) / 4)
    for (let i = 0; i < steps; i++) {
      const y = S.y0 - i * 4 - ((ph * 22) % 4)
      const t = (S.y0 - y) / (S.y0 - S.top)
      if (t < 0 || t > 1.02) continue
      const w = u * (0.03 + t * (0.17 + n * 0.05))
      const fade = Math.min(1, t * 6) * (1 - Math.pow(t, 2.2))
      for (let k = 0; k < 1 + Math.floor(n / 3); k++) {
        const x = cx(y, k * 1.7) + (rnd() - 0.5) * w * 0.6
        const sz = w * (1.4 + rnd() * 0.8)
        g.globalAlpha = a0 * fade * (0.62 + n * 0.05)
        g.drawImage(t < 0.12 ? warm : cool, x - sz / 2, y - sz / 2, sz, sz)
      }
      if (n > 1 && i % (26 - n * 4) === 0 && t > 0.15 && t < 0.85) {
        const ex = cx(y, 0), rr = w * 0.8
        for (let a = 0; a < 10; a++) {
          const q = (a / 10) * Math.PI * 1.6 + ph
          g.globalAlpha = a0 * 0.8 * fade
          g.drawImage(cool, ex + Math.cos(q) * rr - w * 0.4, y + Math.sin(q) * rr * 0.6 - w * 0.4, w * 0.8, w * 0.8)
        }
      }
    }
    // threads: a few fine sinuous lines inside the column, the smoke's grain (by day: the whole of it, thin ink)
    g.lineCap = 'round'
    g.strokeStyle = smokeLine
    for (let k = 0; k < 1 + Math.ceil(n / 2); k++) {
      g.lineWidth = 0.8 + rnd() * 1.2
      g.globalAlpha = (col.dark ? 0.14 : 0.2) * (0.5 + rnd() * 0.5)
      g.beginPath()
      const off = (rnd() - 0.5) * u * 0.18
      for (let y = S.y0 - 6; y > S.top + (S.y0 - S.top) * 0.15; y -= 6) {
        const t = (S.y0 - y) / (S.y0 - S.top)
        const x = cx(y, k * 2.3) + off * t * 3 + Math.sin(t * 7 + k * 2 + ph) * u * 0.09 * t
        if (y === S.y0 - 6) g.moveTo(x, y)
        else g.lineTo(x, y)
      }
      g.stroke()
    }
    g.globalAlpha = 0.5
    g.drawImage(warm, ix - u * 0.15, S.y0 - u * 0.12, u * 0.3, u * 0.24)
    // drafts: meaningless brush squiggles riding the smoke, heavier low down, thinning and fading as they rise
    g.strokeStyle = draftInk
    // (only inside the visible part of the column, hugging its axis: drafts carried by the smoke, not glyphs in the sky)
    for (let k = 0; k < 3 + n * 3; k++) {
      const t = 0.08 + rnd() * (0.3 + n * 0.08), y = S.y0 - t * (S.y0 - S.top)
      const x = cx(y, 0) + (rnd() - 0.5) * u * (0.12 + t * 0.3)
      const len = u * (0.08 + n * 0.03) * (0.6 + rnd()) * (1 + t * 0.6)
      g.globalAlpha = (col.dark ? 0.55 : 0.5) * Math.pow(1 - t, 1.4) * (0.6 + rnd() * 0.4)
      squiggle(g, x, y, len, Math.max(0.6, (1 - t) * (1.6 + rnd() * 2.8)))
    }
    g.globalAlpha = 1
  }
  /** A draft: a run of cursive loops with no letters in it, swelling in the middle (rnd() only, no allocation). */
  function squiggle(g: CanvasRenderingContext2D, x: number, y: number, len: number, w: number) {
    const loops = 2 + Math.floor(rnd() * 3), steps = loops * 8
    const r = len / (loops * 2.2), tilt = (rnd() - 0.5) * 0.8, ca = Math.cos(tilt), sa = Math.sin(tilt)
    let px = x, py = y
    g.lineCap = 'round'
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, th = t * loops * Math.PI * 2
      const lx = t * len - Math.sin(th) * r * 0.9, ly = -(1 - Math.cos(th)) * r * (0.8 + 0.3 * Math.sin(t * 5))
      const nx = x + lx * ca - ly * sa, ny = y + lx * sa + ly * ca
      g.lineWidth = 0.4 + w * Math.sin(t * Math.PI)
      g.beginPath()
      g.moveTo(px, py)
      g.lineTo(nx, ny)
      g.stroke()
      px = nx
      py = ny
    }
  }

  // ── state → painting
  function place() {
    const { W, H, wide } = G
    const [mx, my] = G.moon[v - 1]
    moonBox.style.transform = `translate(${f1(mx)}px, ${f1(my)}px)`
    road.style.transform = `translateX(${f1(mx)}px)`
    root.dataset.v = String(v)
    root.style.setProperty('--t', String((v - 1) / (N - 1)))
    const bw = Math.max(26, G.u * 0.16), bh = bw * 2.6
    Object.assign(bundle.style, { left: `${f1(G.gx - bw / 2)}px`, top: `${f1(G.notch[v - 1] - bh * 0.86)}px`, width: `${f1(bw)}px`, height: `${f1(bh)}px` })
    bundle.setAttribute('aria-valuenow', String(v))
    bundle.setAttribute('aria-valuetext', fill(K.valueText, { n: v, total: N }))
    way.set((v - 1) / (N - 1))
    // the groove's two ends, written by the post: right of it on a desk, above and below it on a phone
    const lo = G.notch[0], hi = G.notch[N - 1]
    if (wide) {
      Object.assign(ends[0].style, { left: `${f1(G.gx + 14)}px`, top: `${f1(lo - 9)}px`, translate: '' })
      Object.assign(ends[1].style, { left: `${f1(G.gx + 14)}px`, top: `${f1(hi - 9)}px`, translate: '' })
    } else {
      Object.assign(ends[0].style, { left: `${f1(G.gx)}px`, top: `${f1(G.iy + G.u * 0.16)}px`, translate: '-50% 0' })
      Object.assign(ends[1].style, { left: `${f1(G.gx)}px`, top: `${f1(hi - G.u * 0.22 - 22)}px`, translate: '-50% 0' })
    }
    // the puzzle's note sits on the ground right of the stele (desk) / under the top lines (phone)
    const { x0, sw, base } = G.st
    if (wide) {
      if (note.parentElement !== root) root.append(note)
      Object.assign(note.style, { left: `${f1(Math.min(x0 + sw + 18, W - 230))}px`, top: `${f1(base - 46)}px`, width: `${f1(Math.min(240, W - x0 - sw - 30))}px` })
    } else {
      if (note.parentElement !== top) top.append(note)
      Object.assign(note.style, { left: '', top: '', width: '' })
    }
    void H
    g.refresh()
  }

  function set(n: number) {
    n = clamp(Math.round(n), 1, N)
    if (n === v) return
    v = n
    place()
    paintSmoke(phase)
    ctx.chime(v === N ? 'ok' : 'tap')
    if (v === 2 && !done) ctx.prompt(K.prompt2)
    if (v >= 3 && !done) {
      done = true
      dot?.done()
      dot = null
      root.classList.add('done')
      ctx.insight(K.insight, [K.detail, K.far])
    }
  }

  // draw the bundle up its groove (or ↑ ↓ Home End on it); a tap adds a stick; the smoke moves only while it is held
  const loop = createLoop(smoke, (_t, dt) => {
    phase += dt * 0.8
    paintSmoke(phase)
  })
  ctx.onCleanup(() => loop.dispose())
  let drag: { id: number; y: number; v: number; moved: boolean } | null = null
  bundle.addEventListener('pointerdown', (e) => {
    drag = { id: e.pointerId, y: e.clientY, v, moved: false }
    bundle.setPointerCapture(e.pointerId)
    root.classList.add('held')
    if (!quick) loop.start()
  })
  bundle.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return
    if (Math.abs(drag.y - e.clientY) > 6) drag.moved = true
    set(drag.v + (drag.y - e.clientY) / STEP)
  })
  const up = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return
    if (!drag.moved) set(v === N ? 1 : v + 1)
    drag = null
    root.classList.remove('held')
    loop.stop()
  }
  bundle.addEventListener('pointerup', up)
  bundle.addEventListener('pointercancel', up)
  bundle.addEventListener('keydown', (e) => {
    const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key]
    if (d) set(v + d)
    else if (e.key === 'Home') set(1)
    else if (e.key === 'End') set(N)
    else return
    e.preventDefault()
  })
  // idle: one stick of the bundle rises a little up the groove — the way to draw it
  invite(ctx, () => v < N && nudge(ctx, bundle, 0, -10))
}

/** A colour from a CSS token at some alpha ("#rrggbb", "rgb(…)" or "rgba(…)"). */
function rgba(c: string, a: number) {
  if (c.startsWith('#')) {
    const n = c.length === 4 ? c.slice(1).split('').map((x) => parseInt(x + x, 16)) : [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
    return `rgba(${n[0]},${n[1]},${n[2]},${a})`
  }
  const m = c.match(/[\d.]+/g)
  return m ? `rgba(${m[0]},${m[1]},${m[2]},${a * (m[3] ? Number(m[3]) : 1)})` : c
}
/** A soft elliptical glow (radial gradient) on a canvas. */
function glow(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, c: string, a: number) {
  g.save()
  g.translate(x, y)
  g.scale(1, ry / rx)
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx)
  gr.addColorStop(0, rgba(c, a))
  gr.addColorStop(0.5, rgba(c, a * 0.4))
  gr.addColorStop(1, rgba(c, 0))
  g.fillStyle = gr
  g.fillRect(-rx, -rx, rx * 2, rx * 2)
  g.restore()
}
function poly(g: CanvasRenderingContext2D, pts: Pt[]) {
  g.beginPath()
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
  g.closePath()
}
