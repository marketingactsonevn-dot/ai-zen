import { fill, h, s } from '../../core/dom'
import { cssVar, onPrefs } from '../../core/prefs'
import { createLoop } from '../../core/loop'
import type { SceneCtx } from '../types'
import { C } from './data'
import { f1, stage } from './kit'
import { blob, clamp, curve, rng, stroke, type Pt } from '../../ui/part2/ink'
import { moon, reeds, ridge } from '../../ui/part2/paint'

const K = C.scenes.incense
const N = 4 // sticks: 1 = a quick answer … 4 = thinking long

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
 * Scene 4 — seen from a little above the lake shore (about 25° down), a vertical picture whose spine is a column of incense
 * smoke: it rises from a bronze censer in the middle of a flat stone, past the moon, to the top of the frame, and drafts
 * (meaningless brush squiggles) ride in it and dissolve. A monk in a few strokes sits at the left; a stele with the answer
 * carved on it stands at the right, faint at first. The sticks are the handle: draw them up (or ← →) to burn more. More
 * sticks: the column grows taller and curls more, the moon moves on, the carving comes clear; the last stick lights a whole
 * far shore of embers.
 */
export function incenseScene(ctx: SceneCtx) {
  let v = 1
  let done = false
  const quick = ctx.reduced || ctx.quality === 'low'
  const { root } = stage(ctx, 't24i', K.art, [K.insight], draw)
  const bg = h('canvas', { class: 't24i-bg', 'aria-hidden': 'true' })
  const embers = h('canvas', { class: 't24i-embers', 'aria-hidden': 'true' })
  const moonSvg = s('svg', { class: 't24i-moon', viewBox: '-60 -60 120 120', 'aria-hidden': 'true' })
  const smoke = h('canvas', { class: 't24i-smoke', 'aria-hidden': 'true' })
  const figSvg = s('svg', { class: 't24-svg t24i-fig', 'aria-hidden': 'true' })
  const answer = s('g', { class: 't24i-answer' })
  // words carved on the stones: the two scores by the stele's notches, the two ends of the sticks' scale on the base
  const notches = K.notches.map((t) => h('span', { class: 't24i-num', 'aria-hidden': 'true' }, t))
  const scale = h('div', { class: 't24i-scale', 'aria-hidden': 'true' },
    h('span', { class: 't24i-end' }, K.short),
    h('span', { class: 't24i-ticks' }, ...Array.from({ length: N }, (_, i) => h('i', { class: `t${i + 1}` }))),
    h('span', { class: 't24i-end' }, K.long))
  const censer = h('div', { class: 't24i-censer', role: 'slider', tabindex: '0', 'aria-label': K.sliderAria, 'aria-valuemin': '1', 'aria-valuemax': String(N), 'aria-orientation': 'vertical' })
  root.append(bg, embers, moonSvg, smoke, figSvg, ...notches, scale, censer)
  root.dataset.v = '1'
  ctx.prompt(K.prompt)

  const G = { W: 0, H: 0, dpr: 1, wide: true, hz: 0, sy: 0, ix: 0, iy: 0, u: 0, stick: 0, step: 40, moon: [] as Pt[] }
  let col = { paper: '', paper2: '', wash: '', water: '', mist: '', moon: '', lantern: '', rockHi: '', rockMid: '', rockLo: '', moss: '', umbra: '', dark: false }
  const read = () => {
    const c = (n: string) => cssVar(n)
    col = { paper: c('--paper'), paper2: c('--paper-2'), wash: c('--wash'), water: c('--water'), mist: c('--mist'), moon: c('--moon'), lantern: c('--lantern'), rockHi: c('--rock-hi'), rockMid: c('--rock-mid'), rockLo: c('--rock-lo'), moss: c('--moss-a'), umbra: c('--umbra'), dark: document.documentElement.dataset.theme === 'dark' }
    warm = tint(col.lantern)
    // by day the smoke is ink against the pale sky; by night, moonlit mist
    cool = tint(col.dark ? col.mist : col.rockLo)
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
    const hz = H * (wide ? 0.4 : 0.36)
    const u = wide ? Math.min(H * 0.3, W * 0.19) : Math.min(H * 0.23, W * 0.32)
    const ix = W * 0.5, iy = H * (wide ? 0.79 : 0.8)
    Object.assign(G, { W, H, dpr, wide, hz, u, ix, iy, sy: H * (wide ? 0.66 : 0.68), stick: u * 0.42, step: Math.max(26, H * 0.06) })
    // the moon crosses the sky behind the smoke as the sticks burn: right of the column → left of it
    G.moon = Array.from({ length: N }, (_, i) => [W * (wide ? 0.69 - i * 0.1 : 0.8 - i * 0.18), H * ((wide ? 0.15 : 0.12) - Math.sin((i / (N - 1)) * Math.PI) * 0.035)] as Pt)
    for (const c of [bg, embers, smoke]) {
      c.width = Math.round(W * dpr)
      c.height = Math.round(H * dpr)
      c.style.width = `${f1(W)}px`
      c.style.height = `${f1(H)}px`
    }
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
  const farShore = (x: number) => G.hz + G.H * 0.004 + G.H * 0.03 * Math.pow(Math.sin(Math.PI * clamp((x / G.W) * 0.9 + 0.08, 0, 1)), 3) - G.H * 0.006 * Math.sin((x / G.W) * 11)

  // ── the painting behind: sky, far ranges in mist, the lake, the rocky shore in front with its wet edge
  function paintBg() {
    const { W, H, dpr, hz, ix, iy, u, sy } = G
    const g = bg.getContext('2d')!
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, W, H)
    const r = rng(2492)
    const sky = g.createLinearGradient(0, 0, 0, hz)
    sky.addColorStop(0, col.dark ? col.paper : col.paper2)
    sky.addColorStop(1, col.dark ? col.paper2 : col.paper)
    g.fillStyle = sky
    g.fillRect(0, 0, W, hz + 2)
    // two ranges, the far one paler, mist at their feet
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
    range(H * 0.15, 2490, col.dark ? 0.45 : 0.14, G.wide ? 6 : 4)
    range(H * 0.08, 2491, col.dark ? 0.7 : 0.22, 2, -W * 0.05, W * 0.42)
    range(H * 0.06, 2489, col.dark ? 0.7 : 0.2, 2, W * 0.62, W * 1.05)
    // the lake: no hard top edge, the far water melts into the mist under the ranges
    const lake = g.createLinearGradient(0, hz - H * 0.01, 0, H)
    lake.addColorStop(0, rgba(col.water, 0))
    lake.addColorStop(0.06, rgba(col.water, col.dark ? 0.6 : 0.38))
    lake.addColorStop(1, rgba(col.water, col.dark ? 1 : 0.85))
    g.fillStyle = lake
    g.fillRect(0, hz - H * 0.01, W, H - hz)
    // the far shore: a low dark strip of land curving round a bay (the embers will stand on it)
    g.fillStyle = rgba(col.wash, col.dark ? 0.75 : 0.22)
    g.beginPath()
    g.moveTo(-W * 0.05, hz - H * 0.006)
    for (let x = -W * 0.05; x <= W * 1.05; x += W / 60) g.lineTo(x, farShore(x) + H * 0.004 + Math.sin(x * 0.05) * H * 0.002)
    for (let x = W * 1.05; x >= -W * 0.05; x -= W / 60) g.lineTo(x, farShore(x) - H * 0.008 - Math.abs(Math.sin(x * 0.021)) * H * 0.006)
    g.fill()
    glow(g, W * 0.5, hz + 2, W * 0.7, H * 0.035, col.mist, col.dark ? 0.4 : 0.85)
    g.strokeStyle = rgba(col.dark ? col.moon : '#ffffff', col.dark ? 0.12 : 0.42)
    for (let i = 0; i < 130; i++) {
      const t = Math.pow(r(), 0.7), y = hz + 6 + t * (sy - hz)
      const len = W * (0.01 + t * 0.05) * (0.5 + r()), x = r() * W
      g.lineWidth = 0.6 + t * 1.4
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x + len, y + (r() - 0.5))
      g.stroke()
    }
    // the moon's road on the water (under where it ends up) and the censer's warm glow spilling on the water at the shore
    const mx = G.moon[N - 1][0]
    g.strokeStyle = rgba(col.moon, col.dark ? 0.45 : 0.75)
    for (let y = hz + (sy - hz) * 0.25; y < sy; y += 3 + r() * 4) {
      const t = (y - hz) / (sy - hz), len = W * (0.012 + t * 0.05) * (0.5 + r())
      g.lineWidth = 0.8 + t * 1.6
      g.beginPath()
      const x = mx + (r() - 0.5) * W * (0.02 + t * 0.04) - len / 2
      g.moveTo(x, y)
      g.lineTo(x + len, y)
      g.stroke()
    }
    glow(g, ix, sy, u * 1.3, u * 0.22, col.lantern, col.dark ? 0.4 : 0.35)
    g.strokeStyle = rgba(col.lantern, col.dark ? 0.5 : 0.55)
    for (let k = 0; k < 9; k++) {
      const y = sy - u * (0.04 + k * 0.035), len = u * (0.12 + r() * 0.2) * (1 - k * 0.08)
      g.lineWidth = 1.4 - k * 0.1
      g.beginPath()
      g.moveTo(ix - len / 2 + (r() - 0.5) * u * 0.1, y)
      g.lineTo(ix + len / 2 + (r() - 0.5) * u * 0.1, y)
      g.stroke()
    }
    // the shore: rocks along the water's edge, broken into boulders, a wet dark lip, the flat rocks the monk and censer use
    const edge: Pt[] = []
    for (let i = 0; i <= 40; i++) {
      const x = -W * 0.04 + (W * 1.08 * i) / 40
      const bump = Math.pow(0.5 + 0.5 * Math.sin(i * 0.9 + 1.3), 2) * u * 0.12 + Math.pow(0.5 + 0.5 * Math.sin(i * 0.37), 2) * u * 0.1
      edge.push([x, sy - bump + Math.sin(i * 0.21) * u * 0.05])
    }
    const shore: Pt[] = [...edge, [W * 1.04, H * 1.02], [-W * 0.04, H * 1.02]]
    const sg = g.createLinearGradient(0, sy - u * 0.2, 0, H)
    sg.addColorStop(0, col.rockMid)
    sg.addColorStop(0.35, col.rockLo)
    sg.addColorStop(1, col.dark ? col.umbra : col.rockLo)
    g.fillStyle = sg
    poly(g, shore)
    g.fill()
    g.save()
    poly(g, shore)
    g.clip()
    // boulders: rounded masses with a lit top (moon, upper right) and a dark underside, crevices between them
    for (let i = 0; i < 10; i++) {
      const bx = -W * 0.02 + (W * 1.04 * (i + r() * 0.5)) / 10, by = sy + u * (0.02 + r() * 0.3), bw = u * (0.3 + r() * 0.35), bh = bw * (0.38 + r() * 0.22)
      const gr = g.createLinearGradient(bx + bw * 0.3, by - bh, bx - bw * 0.2, by + bh)
      gr.addColorStop(0, rgba(col.rockHi, col.dark ? 0.5 : 0.7))
      gr.addColorStop(0.45, rgba(col.rockMid, 0.45))
      gr.addColorStop(1, rgba(col.umbra, col.dark ? 0.55 : 0.3))
      g.fillStyle = gr
      // a lumpy rock: a flat-bottomed outline with a lopsided crown
      g.beginPath()
      for (let k = 0; k <= 18; k++) {
        const a = Math.PI + (k / 18) * Math.PI, wob = 1 + 0.12 * Math.sin(a * 3 + i) + 0.07 * Math.sin(a * 7 + i * 2)
        const x = bx + Math.cos(a) * bw * wob, y = by + Math.sin(a) * bh * wob * (k > 9 ? 0.85 : 1.1)
        if (k) g.lineTo(x, y)
        else g.moveTo(x, y)
      }
      g.quadraticCurveTo(bx, by + bh * 0.25, bx - bw, by)
      g.fill()
      g.strokeStyle = rgba(col.dark ? col.umbra : col.wash, col.dark ? 0.6 : 0.3)
      g.lineWidth = 1.6
      g.beginPath()
      g.moveTo(bx - bw * 0.95, by + 1)
      g.quadraticCurveTo(bx, by + bh * 0.28, bx + bw * 0.95, by + 1)
      g.stroke()
    }
    // the flat rocks: the monk's seat (left) and the low slab under the censer
    glow(g, ix, iy - u * 0.02, u * 1.4, u * 0.3, col.lantern, col.dark ? 0.25 : 0.2)
    g.strokeStyle = rgba(col.dark ? col.umbra : col.wash, col.dark ? 0.55 : 0.28)
    for (let i = 0; i < 60; i++) {
      const x = r() * W, y = sy + r() * (H - sy), l = 8 + r() * 26
      g.lineWidth = 0.8 + r() * 1.6
      g.beginPath()
      g.moveTo(x, y)
      g.quadraticCurveTo(x + l * 0.5, y + (r() - 0.5) * 6, x + l, y + (r() - 0.3) * 8)
      g.stroke()
    }
    g.restore()
    // the wet lip where rock meets water: a dark band and a thin moonlit edge
    g.lineCap = 'round'
    g.strokeStyle = rgba(col.umbra, col.dark ? 0.7 : 0.3)
    g.lineWidth = 4
    g.beginPath()
    edge.forEach(([x, y], i) => (i ? g.lineTo(x, y + 2) : g.moveTo(x, y + 2)))
    g.stroke()
    g.strokeStyle = rgba(col.dark ? col.moon : '#ffffff', col.dark ? 0.35 : 0.7)
    g.lineWidth = 1.2
    g.beginPath()
    edge.forEach(([x, y], i) => (i ? g.lineTo(x, y - 1) : g.moveTo(x, y - 1)))
    g.stroke()
    g.fillStyle = rgba(col.moss, col.dark ? 0.55 : 0.6)
    for (let i = 0; i < 12; i++) {
      const [ex, ey] = edge[Math.floor(r() * edge.length)]
      g.beginPath()
      g.ellipse(ex, ey + 2 + r() * u * 0.15, 8 + r() * 24, 2.5 + r() * 3, 0, 0, Math.PI * 2)
      g.fill()
    }
  }

  /**
   * The last stick: a whole far shore of tiny embers, like a field of incense. The shore curves round a bay; the embers
   * stand in rows along it, smaller and fainter further off, broken into groups, with a veil of mist over them.
   */
  function paintEmbers() {
    const { W, H, dpr, hz } = G
    const g = embers.getContext('2d')!
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, W, H)
    const r = rng(2493)
    const shore = farShore
    const gapAt = (x: number) => Math.sin(x * 0.013) + 0.7 * Math.sin(x * 0.031 + 2) + 0.4 * Math.sin(x * 0.07 + 5)
    const rows = 4
    const per = (ctx.quality === 'low' ? 220 : 520) * (col.dark ? 1 : 0.32)
    for (let k = 0; k < rows; k++) {
      const near = k / (rows - 1) // 0 the far row … 1 the near one
      for (let i = 0; i < per; i++) {
        const x = r() * W
        if (gapAt(x + k * 40) < -0.4 + near * 0.3) continue
        const y = shore(x) + near * H * 0.012 + (r() - 0.5) * H * 0.003
        const sz = (col.dark ? 0.55 : 0.35) + near * (col.dark ? 1.1 : 0.55)
        g.fillStyle = rgba(col.lantern, (0.2 + near * 0.5) * (0.6 + r() * 0.4) * (col.dark ? 1 : 0.75))
        g.beginPath()
        g.arc(x, y, sz, 0, Math.PI * 2)
        g.fill()
      }
    }
    glow(g, W * 0.5, hz + H * 0.012, W * 0.6, H * 0.03, col.lantern, col.dark ? 0.28 : 0.18)
    // the mist veil laid over them
    glow(g, W * 0.5, hz + H * 0.002, W * 0.65, H * 0.016, col.mist, col.dark ? 0.35 : 0.6)
  }

  // ── the monk, the censer and its sticks on the flat stone, the stele with the answer carved on it
  function drawFigures() {
    const { W, u, ix, iy, wide } = G
    figSvg.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(G.H)}`)
    figSvg.replaceChildren(
      reeds(W * (wide ? 0.86 : 0.95), G.sy + u * 0.05, u * 0.55, 2441, 8),
      ...stele(),
      ...monk(ix - u * (wide ? 0.95 : 0.88), iy - u * 0.02),
      ...slab(),
      ...censerArt(),
      s('defs', null, s('linearGradient', { id: 't24i-bronze', x1: 0, y1: 0, x2: 1, y2: 0.3 }, s('stop', { offset: 0, class: 't24i-br0' }), s('stop', { offset: 0.5, class: 't24i-br1' }), s('stop', { offset: 1, class: 't24i-br2' }))))
    moonSvg.replaceChildren(moon(0, 0, G.wide ? 22 : 18, 2494, true))
    // the handle: the sticks themselves (a tall strip over them and the censer); you draw them up to burn more
    const cw = Math.max(64, u * 0.5), ch = G.stick + u * 0.35
    Object.assign(censer.style, { left: `${f1(ix - cw / 2)}px`, top: `${f1(iy - ch + u * 0.1)}px`, width: `${f1(cw)}px`, height: `${f1(ch)}px` })
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
    // the kesa: a darker band from the left shoulder across the chest
    const kesa = stroke(curve(P(-0.06, -0.68), P(0.02, -0.5), P(0.14, -0.3), 8), u * 0.045, 0.15, 0.25, 0.3)
    // the head: round, joined by the neck; the back of the skull in one stroke, an ear, a closed eye, the brow and nose
    const head = blob(hx, hy, hr, hr * 1.06, 2443, 0.04, 16)
    const skull = stroke(Array.from({ length: 16 }, (_, j) => { const a = Math.PI * (0.55 + (j / 15) * 1.1); return [hx + Math.cos(a) * hr, hy + Math.sin(a) * hr * 1.06] as Pt }), u * 0.02, 0.2, 0.3, 0.25)
    const face = stroke([[hx + hr * 0.35, hy - hr * 0.05], [hx + hr * 0.72, hy - hr * 0.02]], u * 0.008, 0.2, 0.2, 0.3) + stroke(curve([hx + hr * 0.88, hy - hr * 0.3], [hx + hr * 1.12, hy + hr * 0.05], [hx + hr * 0.92, hy + hr * 0.2], 6), u * 0.009, 0.2, 0.3, 0.3) + stroke(curve([hx - hr * 0.12, hy - hr * 0.1], [hx - hr * 0.3, hy + hr * 0.1], [hx - hr * 0.1, hy + hr * 0.3], 6), u * 0.011, 0.2, 0.3, 0.3)
    const neck = `M${f1(hx - hr * 0.42)} ${f1(hy + hr * 0.7)}L${f1(hx + hr * 0.35)} ${f1(hy + hr * 0.8)}L${f1(mx + 0.07 * u)} ${f1(my - 0.68 * u)}L${f1(mx - 0.03 * u)} ${f1(my - 0.7 * u)}Z`
    return [
      s('ellipse', { class: 't24i-mat', cx: f1(mx + 0.04 * u), cy: f1(my + 2), rx: f1(u * 0.62), ry: f1(u * 0.07) }),
      s('path', { class: 't24i-robe', d: `M${robe.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}Z`, filter: 'url(#ink-wash)' }),
      s('path', { class: 't24i-kesa', d: kesa, filter: 'url(#ink-rough)' }),
      s('path', { class: 't24i-fold', d: folds }),
      s('path', { class: 't24i-contour', d: back + sleeve + legs, filter: 'url(#ink-rough)' }),
      s('path', { class: 't24i-hands', d: blob(mx + 0.2 * u, my - 0.23 * u, u * 0.06, u * 0.035, 2444, 0.15, 10) }),
      s('path', { class: 't24i-head', d: neck + head }),
      s('path', { class: 't24i-head-ink', d: skull + face }),
      // the warm side of him, toward the ember
      s('path', { class: 't24i-warmrim', d: stroke(curve(P(0.12, -0.65), P(0.26, -0.48), P(0.24, -0.3), 8), u * 0.012, 0.3, 0.3, 0.1) + stroke(curve([hx + hr * 0.6, hy - hr * 0.75], [hx + hr * 1.05, hy - hr * 0.3], [hx + hr * 0.95, hy + hr * 0.3], 6), u * 0.009, 0.3, 0.3, 0.1) }),
    ]
  }

  /** The low flat stone under the censer: lit top, a front face where the two ends of the scale are written. */
  function slab(): SVGElement[] {
    const { u, ix, iy, wide } = G
    const w = wide ? clamp(u * 1.75, 230, 300) : clamp(u * 1.75, 180, 200), fh = u * 0.15
    const x0 = ix - w / 2, x1 = ix + w / 2, top = iy - u * 0.02
    const topD = `M${f1(x0)} ${f1(top)}Q${f1(ix)} ${f1(top - u * 0.07)} ${f1(x1)} ${f1(top - u * 0.01)}Q${f1(x1 + u * 0.03)} ${f1(top + u * 0.03)} ${f1(x1 - u * 0.02)} ${f1(top + u * 0.05)}Q${f1(ix)} ${f1(top + u * 0.08)} ${f1(x0 + u * 0.02)} ${f1(top + u * 0.05)}Q${f1(x0 - u * 0.03)} ${f1(top + u * 0.03)} ${f1(x0)} ${f1(top)}Z`
    const face = `M${f1(x0 + u * 0.02)} ${f1(top + u * 0.05)}Q${f1(ix)} ${f1(top + u * 0.08)} ${f1(x1 - u * 0.02)} ${f1(top + u * 0.05)}L${f1(x1 - u * 0.05)} ${f1(top + fh)}Q${f1(ix)} ${f1(top + fh + u * 0.04)} ${f1(x0 + u * 0.05)} ${f1(top + fh)}Z`
    Object.assign(scale.style, { left: `${f1(x0 + u * 0.08)}px`, top: `${f1(top + u * 0.065)}px`, width: `${f1(w - u * 0.16)}px` })
    return [
      s('ellipse', { class: 't24i-slab-sh', cx: f1(ix + u * 0.06), cy: f1(top + fh + 2), rx: f1(w * 0.55), ry: f1(u * 0.05) }),
      s('path', { class: 't24i-slab-face', d: face, filter: 'url(#ink-rough)' }),
      s('path', { class: 't24i-slab-top', d: topD, filter: 'url(#ink-rough)' }),
      s('path', { class: 't24i-slab-ink', d: stroke([[x0 + u * 0.02, top + u * 0.05], [ix, top + u * 0.075], [x1 - u * 0.02, top + u * 0.05]], 1.6, 0.1, 0.1, 0.3) }),
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
      const top: Pt = [sx + lean * G.stick, cy - cw * 0.5 - G.stick * (0.92 - k * 0.04)]
      sticks.push(s('g', { class: `t24i-stick k${k}` },
        s('path', { class: 't24i-stem', d: stroke([[sx, cy - cw * 0.5], top], 2.2, 0.02, 0.02, 0.8) }),
        s('circle', { class: 't24i-coal', cx: f1(top[0]), cy: f1(top[1]), r: 2.6 }),
        s('circle', { class: 't24i-coalglow', cx: f1(top[0]), cy: f1(top[1]), r: f1(u * 0.12), fill: 'url(#p2-lamp)' })))
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
   * The stele at the right: a tall stone with its answer carved in short columns (clearer with every stick), two notches
   * cut into its left edge (the two scores, written on the stone beside them) and, at the last stick, a vermilion seal.
   */
  function stele(): SVGElement[] {
    const { u, ix, iy, wide } = G
    const sw = u * (wide ? 0.62 : 0.6), sh = u * 1.2
    const x0 = ix + u * (wide ? 0.78 : 0.62), base = iy + u * 0.03
    const nY = [base - sh * 0.5, base - sh * 0.72] // 75.7 % · 87.5 %
    // the outline, the left edge with two V notches cut into it
    const left: Pt[] = [[x0 + sw * 0.02, base]]
    for (const y of [nY[0], nY[1]]) left.push([x0 + sw * 0.0, y + u * 0.035], [x0 + sw * 0.13, y], [x0 + sw * 0.0, y - u * 0.035])
    left.push([x0 + sw * 0.04, base - sh * 0.92])
    const outline = `M${left.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}Q${f1(x0 + sw * 0.1)} ${f1(base - sh * 1.02)} ${f1(x0 + sw * 0.5)} ${f1(base - sh)}Q${f1(x0 + sw * 0.95)} ${f1(base - sh * 0.98)} ${f1(x0 + sw)} ${f1(base - sh * 0.86)}L${f1(x0 + sw * 1.02)} ${f1(base)}Z`
    // the cut's inside: in shadow above (the moon is high), a pale chipped face below
    const notchInk = nY.map((y) => `M${f1(x0 - 1)} ${f1(y - u * 0.035)}L${f1(x0 + sw * 0.13)} ${f1(y)}L${f1(x0 - 1)} ${f1(y + u * 0.004)}Z`).join('')
    // the answer: short columns of carved marks in the upper right of the face
    const gr = rng(2445)
    let glyphs = ''
    for (let c = 0; c < 3; c++) {
      const x = x0 + sw * (0.82 - c * 0.17)
      for (let k = 0; k < 6 - c; k++) {
        const y = base - sh * 0.86 + k * sh * 0.11, q = sw * 0.05
        const kind = Math.floor(gr() * 4)
        if (kind === 0) glyphs += stroke([[x - q, y], [x + q, y + 0.6]], 2, 0.2, 0.3, 0.3) + stroke([[x + q * 0.4, y + q * 0.9], [x + q * 0.7, y + q * 1.4]], 2.2, 0.1, 0.5, 0.3)
        else if (kind === 1) glyphs += stroke([[x - q * 0.3, y - q * 0.4], [x - q, y + q * 1.1]], 1.8, 0.2, 0.4, 0.3) + stroke([[x + q * 0.3, y - q * 0.3], [x + q, y + q * 1.1]], 1.8, 0.2, 0.5, 0.3)
        else if (kind === 2) glyphs += stroke([[x - q * 0.5, y - q * 0.5], [x - q * 0.5, y + q * 1.2]], 2, 0.2, 0.4, 0.3) + stroke([[x + q * 0.4, y], [x + q * 0.7, y + q * 0.4]], 2.2, 0.1, 0.5, 0.3)
        else glyphs += [0, 1, 2].map((j) => stroke([[x - q * (0.8 - j * 0.1), y - q * 0.4 + j * q * 0.7], [x + q * (0.8 - j * 0.2), y - q * 0.4 + j * q * 0.7 + 0.5]], 1.6, 0.2, 0.3, 0.3)).join('')
      }
    }
    answer.replaceChildren(s('path', { class: 't24i-glyphs', d: glyphs }), s('path', { class: 't24i-seal', d: blob(x0 + sw * 0.66, base - sh * 0.16, sw * 0.07, sw * 0.08, 3, 0.05) }))
    // the scores written on the stone just right of their notches
    notches.forEach((el, i) => Object.assign(el.style, { left: `${f1(x0 + sw * 0.17)}px`, top: `${f1(nY[i] - 9)}px` }))
    const lit = stroke([[x0 + sw * 0.98, base - sh * 0.84], [x0 + sw * 1.0, base - sh * 0.3]], Math.max(1.6, u * 0.012), 0.2, 0.3, 0.2)
    return [
      s('ellipse', { class: 't24i-stele-sh', cx: f1(x0 + sw * 0.6), cy: f1(base + 2), rx: f1(sw * 0.75), ry: f1(u * 0.05) }),
      s('path', { class: 't24i-stele', d: outline, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
      s('path', { class: 't24i-stele-shade', d: outline, fill: 'url(#p2-shade)' }),
      s('path', { class: 't24i-stele-lit', d: lit }),
      s('path', { class: 't24i-notch', d: notchInk }),
      answer,
    ]
  }

  // ── smoke: puffs along a column straight up the middle of the frame, from the ember to the top edge; the more sticks,
  // the taller, wider and curlier. Called every frame while the sticks are drawn (quality=high): no allocation in here.
  let phase = 0
  let seed = 0
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  const S = { y0: 0, top: 0, n: 1, ph: 0 }
  const cx = (y: number, k: number) => {
    const t = (S.y0 - y) / (S.y0 - S.top)
    return G.ix + Math.sin(t * 2.2 + 0.6) * G.W * 0.018 * t + Math.sin(t * (3 + S.n) + S.ph * 1.3 + k) * G.u * (0.04 + t * 0.11 * (0.6 + S.n * 0.25))
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
    S.top = H * (0.6 - n * 0.17) // with more sticks the column climbs past the top edge
    seed = 2495
    const a0 = col.dark ? 0.06 : 0.07
    const steps = Math.round((S.y0 - S.top) / 4)
    for (let i = 0; i < steps; i++) {
      const y = S.y0 - i * 4 - ((ph * 22) % 4)
      const t = (S.y0 - y) / (S.y0 - S.top)
      if (t < 0 || t > 1.02) continue
      const w = u * (0.03 + t * (0.25 + n * 0.08))
      const fade = Math.min(1, t * 6) * (1 - Math.pow(t, 2.2))
      for (let k = 0; k < 1 + Math.floor(n / 2); k++) {
        const x = cx(y, k * 1.7) + (rnd() - 0.5) * w * 0.6
        const sz = w * (1.4 + rnd() * 0.8)
        g.globalAlpha = a0 * fade * (0.6 + n * 0.12)
        g.drawImage(t < 0.12 ? warm : cool, x - sz / 2, y - sz / 2, sz, sz)
      }
      // curls: a little eddy now and then, more of them with more sticks
      if (n > 1 && i % (26 - n * 4) === 0 && t > 0.15 && t < 0.85) {
        const ex = cx(y, 0), rr = w * 0.8
        for (let a = 0; a < 10; a++) {
          const q = (a / 10) * Math.PI * 1.6 + ph
          g.globalAlpha = a0 * 0.8 * fade
          g.drawImage(cool, ex + Math.cos(q) * rr - w * 0.4, y + Math.sin(q) * rr * 0.6 - w * 0.4, w * 0.8, w * 0.8)
        }
      }
    }
    // threads: a few fine sinuous lines inside the column, the smoke's grain
    g.lineCap = 'round'
    g.strokeStyle = smokeLine
    for (let k = 0; k < 1 + Math.ceil(n / 2); k++) {
      g.lineWidth = 0.8 + rnd() * 1.2
      g.globalAlpha = (col.dark ? 0.14 : 0.08) * (0.5 + rnd() * 0.5)
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
    // the ember's warmth at the root of the column
    g.globalAlpha = 0.5
    g.drawImage(warm, ix - u * 0.15, S.y0 - u * 0.12, u * 0.3, u * 0.24)
    // drafts: meaningless brush squiggles riding the smoke, heavier low down, thinning and fading as they rise
    g.strokeStyle = draftInk
    for (let k = 0; k < 5 + n * 4; k++) {
      const t = 0.1 + rnd() * 0.75, y = S.y0 - t * (S.y0 - S.top)
      const x = cx(y, 0) + (rnd() - 0.5) * u * (0.25 + t * 0.7)
      const len = u * (0.08 + n * 0.03) * (0.6 + rnd()) * (1 + t * 0.6)
      g.globalAlpha = (col.dark ? 0.55 : 0.6) * Math.pow(1 - t, 1.4) * (0.6 + rnd() * 0.4)
      squiggle(g, x, y, len, Math.max(0.6, (1 - t) * (1.6 + rnd() * 2.8)))
    }
    g.globalAlpha = 1
  }
  /**
   * A draft: a run of cursive loops, like handwriting with no letters in it, the line swelling in the middle and tapering
   * at both ends (rnd() only, no allocation).
   */
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
    const [mx, my] = G.moon[v - 1]
    moonSvg.style.transform = `translate(${f1(mx)}px, ${f1(my)}px)`
    root.dataset.v = String(v)
    root.style.setProperty('--t', String((v - 1) / (N - 1)))
    censer.setAttribute('aria-valuenow', String(v))
    censer.setAttribute('aria-valuetext', fill(K.valueText, { n: v, total: N }))
  }

  function set(n: number) {
    n = clamp(Math.round(n), 1, N)
    if (n === v) return
    v = n
    place()
    paintSmoke(phase)
    ctx.chime(v === N ? 'ok' : 'tap')
    if (v >= 3 && !done) {
      done = true
      ctx.insight(K.insight, [K.detail, K.far])
    }
  }

  // draw the sticks up (or right), or ← → ↑ ↓ Home End on them; the smoke only moves while the hand is on them
  const loop = createLoop(smoke, (_t, dt) => {
    phase += dt * 0.8
    paintSmoke(phase)
  })
  ctx.onCleanup(() => loop.dispose())
  let drag: { id: number; x: number; y: number; v: number } | null = null
  censer.addEventListener('pointerdown', (e) => {
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, v }
    censer.setPointerCapture(e.pointerId)
    root.classList.add('held')
    if (!quick) loop.start()
  })
  censer.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return
    set(drag.v + Math.max(drag.y - e.clientY, e.clientX - drag.x) / G.step)
  })
  const up = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return
    // a plain tap adds a stick (wraps back to one after the last)
    if (Math.abs(e.clientY - drag.y) < 6 && Math.abs(e.clientX - drag.x) < 6) set(v === N ? 1 : v + 1)
    drag = null
    root.classList.remove('held')
    loop.stop()
  }
  censer.addEventListener('pointerup', up)
  censer.addEventListener('pointercancel', up)
  censer.addEventListener('keydown', (e) => {
    const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key]
    if (d) set(v + d)
    else if (e.key === 'Home') set(1)
    else if (e.key === 'End') set(N)
    else return
    e.preventDefault()
  })
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
