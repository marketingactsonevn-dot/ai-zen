import { fill, h, s } from '../../core/dom'
import { L, type Fact } from '../../core/content'
import { sliced } from '../../core/chunk'
import type { SceneDef } from '../types'
import type { Perspectives } from '../../ui/part2/types'
import { blob, clamp, curve, onDigit, onSize, rng, stableHeight, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist, moon, ridge } from '../../ui/part2/paint'
import { C } from './data'
import { guide } from '../../ui/part2/guide'
import { findTakeaway, foldedTakeaway } from '../../ui/part2/takeaway'
import { t29Defs } from './figures'
import { f1, P } from './rig'

const S = C.scenes.refill
const DATA = S.perspectives as Perspectives
// data order = near → far along the arc from the well: J.P. Morgan (years of drought), SK hynix (a fab rising), IDC (rain by 2027–28)
const KIND = ['slab', 'block', 'pebble'] as const

interface Stone { x: number; y: number; w: number; h: number }
interface Geo {
  W: number
  H: number
  wide: boolean
  hz: number
  moon: [number, number, number]
  /** the well: mouth centre, outer radii, the curb's visible height */
  well: { cx: number; cy: number; rx: number; ry: number; hc: number }
  /** the three stones, their feet on the ground: near (beside the well) → far (by the horizon) */
  stones: Stone[]
  /** where each voice is written, over its stone: left, top, width */
  text: { x: number; y: number; w: number }[]
  /** each weather's stretch of sky: x0, x1 */
  zones: [number, number][]
}

function geo(W: number, H: number): Geo {
  const wide = W / H > 1.15
  if (wide) {
    const rx = W * 0.175, cx = W * 0.235, cy = H * 0.7
    const stones: Stone[] = [
      { x: W * 0.475, y: H * 0.885, w: clamp(W * 0.12, 130, 200), h: clamp(H * 0.19, 96, 150) },
      { x: W * 0.665, y: H * 0.752, w: clamp(W * 0.092, 104, 150), h: clamp(H * 0.15, 78, 118) },
      { x: W * 0.85, y: H * 0.668, w: clamp(W * 0.068, 80, 112), h: clamp(H * 0.085, 48, 70) },
    ]
    const tw = clamp(W * 0.27, 300, 400)
    return {
      W, H, wide, hz: H * 0.6,
      moon: [W * 0.085, H * 0.15, clamp(H * 0.045, 18, 34)],
      well: { cx, cy, rx, ry: rx * 0.3, hc: H * 0.1 },
      stones,
      text: stones.map((st) => ({ x: clamp(st.x - tw / 2, W * 0.2, W * 0.985 - tw), y: H * 0.05, w: tw })),
      zones: [[W * 0.2, W * 0.57], [W * 0.5, W * 0.78], [W * 0.72, W * 1.02]],
    }
  }
  const rx = W * 0.31, cx = W * 0.35, cy = H * 0.775
  const stones: Stone[] = [
    { x: W * 0.8, y: H * 0.94, w: W * 0.33, h: H * 0.17 },
    { x: W * 0.6, y: H * 0.665, w: W * 0.22, h: H * 0.11 },
    { x: W * 0.86, y: H * 0.585, w: W * 0.17, h: H * 0.065 },
  ]
  return {
    W, H, wide, hz: H * 0.53,
    moon: [W * 0.13, H * 0.34, W * 0.042],
    well: { cx, cy, rx, ry: rx * 0.3, hc: H * 0.072 },
    stones,
    text: stones.map(() => ({ x: W * 0.05, y: H * 0.025, w: W * 0.9 })),
    zones: [[0, W * 0.42], [W * 0.3, W * 0.72], [W * 0.6, W]],
  }
}

/**
 * Giếng bao giờ đầy lại? (comp/2.5D, LOW, a great sky; audit v3 29-4): a dry stone well in the near left, seen a little
 * from above so its mouth is an ellipse (dry mud down the shaft); three stones of three shapes stand on along the curve of
 * its rim, farther and smaller toward the right horizon: a cracked slab (J.P. Morgan), a mason's dressed block (SK hynix),
 * a rain-worn pebble (IDC). The sky over each holds its weather, faint from the start; touch a stone and its weather comes
 * in and its words are written over it. Slab: heat makes the far hills waver, the curb cracks. Block: masons raise a fab on
 * the far hill, a cloud forms over it. Pebble: rain slants in from the right, spray on the field, and water with the moon in
 * it comes back down the well, trembling. All three heard: the sky holds them all at once.
 */
export function refillScene(): SceneDef {
  return {
    label: S.label,
    mount(ctx) {
      t29Defs()
      const n = DATA.stones.length
      const back = s('svg', { class: 't29r-svg', 'aria-hidden': 'true' })
      const far = s('svg', { class: 't29r-svg', 'aria-hidden': 'true' })
      const near = s('svg', { class: 't29r-svg', 'aria-hidden': 'true' })
      const voice = h('div', { class: 't29r-voice' })
      const stones = DATA.stones.map((st, k) =>
        h('button', { class: `t29r-stone t29r-k-${KIND[k]}`, type: 'button', 'aria-pressed': 'false', 'aria-label': fill(L.stoneN, { n: k + 1 }) + ': ' + st.who, onClick: () => pick(k) },
          s('svg', { class: 't29r-stone-art', 'aria-hidden': 'true' }),
          h('span', { class: 't29r-carve', 'aria-hidden': 'true' }, S.stoneNames[k])))
      const ring = h('div', { class: 't29r-stones', role: 'group', 'aria-label': L.perspectives }, ...stones)
      const layers = [back, far, near].map((svg, i) => h('div', { class: `t29r-layer t29r-l${i}` }, svg))
      layers[2].append(ring)
      const root = h('div', { class: 't29r', role: 'group', 'aria-label': S.art }, ...layers, voice)
      ctx.art.append(root)
      ctx.prompt(S.prompt)
      const stableH = stableHeight(ctx, [DATA.common])
      const heard = new Set<number>()
      let g: Geo | null = null
      // guide: a dot on each stone not yet heard; "Đã nghe 0/3" carved on the curb from the start (audit v3 29-4)
      const gd = guide(ctx)
      const dots = stones.map((b) => gd.dot(b, { dir: [0, -1] }))
      const count = gd.count(S.countTpl, n, () => (g ? [g.well.cx, g.well.cy + g.well.ry + g.well.hc * 0.52] : [0, 0]))
      count.el.classList.add('t29r-count')
      // H7: the next stone not yet heard breathes
      const invite = () => {
        const k = [0, 1, 2].find((i) => !heard.has(i))
        if (k == null || ctx.reduced) return
        stones[k].classList.remove('is-invite')
        void stones[k].offsetWidth
        stones[k].classList.add('is-invite')
      }
      ctx.el.addEventListener('p2:idle', invite)
      ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', invite))
      let sel = -1

      function pick(k: number) {
        if (k < 0 || k >= n) return
        if (sel >= 0) stones[sel].setAttribute('aria-pressed', 'false')
        sel = k
        const st = DATA.stones[k]
        stones[k].setAttribute('aria-pressed', 'true')
        stones[k].classList.remove('is-invite')
        heard.add(k)
        dots[k].done()
        count.set(heard.size)
        root.classList.add(`sky-${k}`)
        root.dataset.now = String(k)
        placeVoice()
        voice.replaceChildren(ctx.fact(st.view, 'p', 't29r-view'), h('p', { class: 't29r-who' }, `— ${st.who}`))
        if (!voice.hasAttribute('aria-live')) voice.setAttribute('aria-live', 'polite')
        if (heard.size === n && !root.classList.contains('is-all')) {
          root.classList.add('is-all')
          count.done()
          ctx.insight(DATA.common, S.insight as Fact)
          ctx.chime('ok')
          // the station's take-away card, folded on the field at the foot right, at the end of the station
          const cards = C.takeaways.map((id) => findTakeaway(id)).filter((c) => !!c)
          if (cards.length) root.append(h('div', { class: 't29r-take' }, foldedTakeaway(cards, ctx.onCleanup)))
        } else ctx.chime('soft')
      }
      function placeVoice() {
        if (!g || sel < 0) return
        const t = g.text[sel]
        Object.assign(voice.style, { left: `${f1(t.x)}px`, top: `${f1(t.y)}px`, width: `${f1(t.w)}px` })
      }

      // hover parallax: the sky, the far field, the near ground slide apart a little (not on touch, low or reduced)
      if (!ctx.reduced && ctx.quality !== 'low') {
        let rect: DOMRect | null = null
        root.addEventListener('pointermove', (e) => {
          if (e.pointerType !== 'mouse') return
          rect ??= root.getBoundingClientRect()
          const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1, ny = ((e.clientY - rect.top) / rect.height) * 2 - 1
          layers.forEach((l, i) => (l.style.transform = `translate3d(${f1(-nx * [2, 4, 7][i])}px,${f1(-ny * [1, 2, 3][i])}px,0)`))
        })
        root.addEventListener('pointerleave', () => {
          rect = null
          layers.forEach((l) => (l.style.transform = ''))
        })
      }

      let job: { cancel(): void } | null = null
      let built = false
      ctx.onCleanup(() => job?.cancel())
      function layout() {
        const W = ctx.art.clientWidth
        const H = stableH(ctx.art.clientHeight)
        if (W < 60 || H < 60) return
        root.style.height = `${f1(H)}px`
        g = geo(W, H)
        root.classList.toggle('tall', !g.wide)
        for (const svg of [back, far, near]) svg.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
        g.stones.forEach((p, k) => {
          const b = stones[k]
          Object.assign(b.style, { left: `${f1(p.x - p.w / 2)}px`, top: `${f1(p.y - p.h)}px`, width: `${f1(p.w)}px`, height: `${f1(p.h)}px` })
          const art = b.firstChild as SVGSVGElement
          art.setAttribute('viewBox', `${f1(-p.w / 2)} ${f1(-p.h)} ${f1(p.w)} ${f1(p.h)}`)
          art.replaceChildren(...stoneShape(KIND[k], p.w, p.h, 2990 + k * 7))
          ;(b.querySelector('.t29r-carve') as HTMLElement).style.fontSize = `${f1(clamp(p.w * (k === 2 ? 0.16 : 0.105), 11, 18))}px`
        })
        placeVoice()
        job?.cancel()
        job = sliced(paint(g), { sync: ctx.reduced || built })
        built = true
        gd.refresh()
      }
      function* paint(gg: Geo) {
        back.replaceChildren(...skyArt(gg))
        yield
        far.replaceChildren(...fieldArt(gg))
        yield
        near.replaceChildren(...wellArt(gg))
      }

      ctx.onCleanup(onSize(ctx.art, layout))
      ctx.onCleanup(onDigit((d) => pick(d - 1)))
    },
  }
}

/** The sky: the moon low on the left behind a cloud bank, long streaks of cloud, and each voice's weather waiting, faint,
 *  over its stone: a dry warm glow, a small cloud gathering over the far hill, rain clouds rolling in from the right. */
function skyArt(g: Geo): SVGElement[] {
  const { W, H, hz, zones, wide } = g
  const [mx, my, mr] = g.moon
  const q = rng(2990)
  // long thin clouds across the upper sky (a pale wash in the light theme, moonlit grey at night)
  let streaks = ''
  for (let i = 0; i < 6; i++) {
    const y = H * (0.1 + i * 0.07) + (q() - 0.5) * H * 0.03, x = W * (q() * 0.7 - 0.05), len = W * (0.18 + q() * 0.22)
    streaks += `M${f1(x)} ${f1(y)}Q${f1(x + len * 0.5)} ${f1(y - H * 0.012)} ${f1(x + len)} ${f1(y + H * 0.004)}Q${f1(x + len * 0.55)} ${f1(y + H * 0.008)} ${f1(x)} ${f1(y)}Z`
  }
  // ── J.P. Morgan: a dry warm glow, the sky clear
  const [a0, a1] = zones[0]
  const dry = s('g', { class: 't29r-w t29r-w0' },
    s('ellipse', { cx: f1((a0 + a1) / 2), cy: f1(hz - H * 0.18), rx: f1((a1 - a0) * 0.7), ry: f1(H * 0.34), fill: 'url(#t29-dry)' }))
  // ── SK hynix: a small cloud gathering over the fab, puff by puff
  const [b0, b1] = zones[1]
  const bc = (b0 + b1) / 2 - (b1 - b0) * 0.05, by = hz - H * (wide ? 0.2 : 0.17)
  let puffs = '', puffSh = ''
  for (let i = 0; i < 6; i++) {
    const x = bc + (i - 2.5) * (b1 - b0) * 0.075 + (q() - 0.5) * 6, y = by - (i % 2) * H * 0.022 - (i === 2 || i === 3 ? H * 0.02 : 0)
    const rx = (b1 - b0) * (0.075 + q() * 0.04), ry = H * (0.028 + q() * 0.014)
    puffs += blob(x, y, rx, ry, 2991 + i, 0.15, 14)
    puffSh += blob(x + rx * 0.15, y + ry * 0.45, rx * 0.8, ry * 0.45, 3091 + i, 0.2, 12)
  }
  const forming = s('g', { class: 't29r-w t29r-w1' }, s('g', { class: 't29r-grow', style: `transform-origin:${f1(bc)}px ${f1(by)}px` },
    s('path', { class: 't29r-puff', d: puffs, filter: 'url(#ink-wash)' }),
    s('path', { class: 't29r-puff-sh', d: puffSh })))
  // ── IDC: rain clouds in ink wash rolling in from the right, dark bellies, slanting rain to the field
  const [c0, c1] = zones[2]
  let cloud = '', belly = '', rain = '', spray = ''
  const cy0 = H * (wide ? 0.4 : 0.37)
  for (let i = 0; i < 7; i++) {
    const x = c0 + (c1 - c0) * (0.06 + i * 0.15) + (q() - 0.5) * 20, y = cy0 + (q() - 0.5) * H * 0.05
    cloud += blob(x, y, (c1 - c0) * (0.14 + q() * 0.08), H * (0.05 + q() * 0.03), 2993 + i, 0.18, 16)
    belly += blob(x + 6, y + H * 0.035, (c1 - c0) * (0.11 + q() * 0.05), H * 0.02, 3001 + i, 0.25, 12)
  }
  const slant = 0.32 // the wind drives it leftward as it falls
  for (let i = 0; i < (wide ? 120 : 70); i++) {
    const x = c0 + (c1 - c0) * (0.04 + q() * 1.0), y = cy0 + H * 0.04 + q() * (hz - cy0 - H * 0.02), l = H * (0.03 + q() * 0.035)
    rain += stroke([[x, y], [x - l * slant, y + l]], 0.8 + q() * 0.8, 0.3, 0.3, 0.2)
  }
  for (let i = 0; i < (wide ? 26 : 16); i++) {
    const x = c0 + (c1 - c0) * (0.08 + q() * 0.9), y = hz + H * (0.01 + q() * 0.05), r = 2 + q() * 4
    spray += `M${f1(x - r)} ${f1(y)}q${f1(r * 0.5)} ${f1(-r * 1.1)} ${f1(r)} ${f1(-r * 0.2)}M${f1(x + r * 0.2)} ${f1(y - r * 0.1)}q${f1(r * 0.5)} ${f1(-r * 0.9)} ${f1(r)} 0`
  }
  const wet = s('g', { class: 't29r-w t29r-w2' },
    s('linearGradient', { id: 't29r-cloud', x1: 0, y1: 0, x2: 0, y2: 1 },
      s('stop', { offset: 0, style: 'stop-color:var(--t29-cloud);stop-opacity:0.1' }),
      s('stop', { offset: 0.55, style: 'stop-color:var(--t29-cloud);stop-opacity:0.6' }),
      s('stop', { offset: 1, style: 'stop-color:var(--t29-cloud);stop-opacity:0.9' })),
    s('g', { class: 't29r-roll' },
      s('path', { class: 't29r-cloud', d: cloud, fill: 'url(#t29r-cloud)', filter: 'url(#ink-wash)' }),
      s('path', { class: 't29r-belly', d: belly, filter: 'url(#ink-wash)' })),
    s('g', { class: 't29r-rain' }, s('path', { d: rain })),
    s('path', { class: 't29r-spray', d: spray }))
  return [
    // night thinning toward the horizon
    mist(W * 0.5, hz - H * 0.02, W * 0.9, H * 0.3),
    moon(mx, my, mr, 2989, true),
    s('path', { class: 't29r-streak', d: streaks }),
    // the cloud bank the moon sinks behind (garden 10: the moon half hidden)
    s('path', { class: 't29r-bank', d: blob(mx + mr * 2.2, my + mr * 0.95, mr * 4.4, mr * 0.5, 2988, 0.18, 18) + blob(mx - mr * 0.6, my + mr * 1.45, mr * 3, mr * 0.34, 2987, 0.2, 14) }),
    dry,
    forming,
    wet,
  ]
}

/** The far field: ink hills on the horizon (the middle one carries the fab, the left ones waver in the heat), the dry plain
 *  coming forward (cracking where the heat is), a worn path from the well out past the stones, tufts and pebbles. */
function fieldArt(g: Geo): SVGElement[] {
  const { W, H, hz, zones, well, stones, wide } = g
  const q = rng(3010)
  // ── the fab on the far hill over the block: a long hall with a saw-tooth roof, a stack, bamboo scaffolding, a crane
  const [b0, b1] = zones[1]
  const fx = stones[1].x + (wide ? -W * 0.01 : W * 0.02), fy = hz - H * 0.012
  const fw = (b1 - b0) * (wide ? 0.42 : 0.5), fh = fw * 0.26
  let saw = ''
  for (let i = 0; i < 5; i++) saw += `l${f1(fw / 10)} ${f1(-fh * 0.35)}l${f1(fw / 10)} ${f1(fh * 0.35)}`
  const hall = `M${f1(fx - fw / 2)} ${f1(fy)}V${f1(fy - fh * 0.6)}${saw}V${f1(fy)}Z`
  const stack = `M${f1(fx - fw * 0.32)} ${f1(fy - fh * 0.6)}v${f1(-fh * 1.2)}h${f1(fw * 0.05)}v${f1(fh * 1.2)}Z`
  let scaf = ''
  const sx0 = fx + fw * 0.1, sx1 = fx + fw * 0.55
  for (let i = 0; i <= 6; i++) scaf += stroke([[sx0 + ((sx1 - sx0) * i) / 6, fy], [sx0 + ((sx1 - sx0) * i) / 6 + 0.4, fy - fh * 1.3]], 1, 0.05, 0.05, 0.6)
  for (let j = 1; j <= 4; j++) scaf += stroke([[sx0 - 2, fy - (fh * 1.25 * j) / 4], [sx1 + 2, fy - (fh * 1.25 * j) / 4 + 0.6]], 0.9, 0.05, 0.05, 0.6)
  scaf += stroke([[sx0, fy], [sx1, fy - fh * 1.25]], 0.8, 0.05, 0.05, 0.6)
  const mast = fx + fw * 0.78
  const crane = stroke([[mast, fy], [mast, fy - fh * 2.8]], 1.6, 0.02, 0.02, 0.7) + stroke([[mast - fw * 0.42, fy - fh * 2.7], [mast + fw * 0.18, fy - fh * 2.75]], 1.3, 0.02, 0.02, 0.7) +
    stroke([[mast - fw * 0.35, fy - fh * 2.7], [mast - fw * 0.35, fy - fh * 1.6]], 0.7, 0.02, 0.02, 0.8) + stroke([[mast, fy - fh * 2.8], [mast - fw * 0.42, fy - fh * 2.7]], 0.6, 0.02, 0.02, 0.8)
  let masons = ''
  const fig = (x: number, y: number, s1: number, lean = 0) => {
    masons += `M${f1(x - s1 * 0.5)} ${f1(y - s1 * 2.1)}L${f1(x + lean)} ${f1(y - s1 * 2.7)}L${f1(x + s1 * 0.5)} ${f1(y - s1 * 2.1)}Z`
    masons += stroke([[x + lean * 0.6, y - s1 * 2], [x, y - s1 * 0.9]], s1 * 0.55, 0.1, 0.1, 0.6)
    masons += stroke([[x, y - s1 * 0.9], [x - s1 * 0.35, y]], s1 * 0.3, 0.1, 0.1, 0.6) + stroke([[x, y - s1 * 0.9], [x + s1 * 0.35, y]], s1 * 0.3, 0.1, 0.1, 0.6)
  }
  const ms = Math.max(2.6, fh * 0.13)
  fig(fx - fw * 0.62, fy, ms, 1)
  fig(fx - fw * 0.76, fy, ms * 0.95, -1)
  fig(sx0 + (sx1 - sx0) * 0.3, fy - (fh * 1.25) / 2, ms * 0.9)
  fig(mast + fw * 0.1, fy, ms)
  masons += stroke([[fx - fw * 0.8, fy - ms * 1.6], [fx - fw * 0.56, fy - ms * 1.7]], ms * 0.35, 0.05, 0.05, 0.6)
  const fab = s('g', { class: 't29r-w t29r-w1 t29r-fab' },
    s('path', { class: 't29r-fab-hall', d: hall + stack }),
    s('path', { class: 't29r-fab-win', d: Array.from({ length: 6 }, (_, i) => `M${f1(fx - fw * 0.42 + i * fw * 0.14)} ${f1(fy - fh * 0.38)}h${f1(fw * 0.05)}v${f1(fh * 0.16)}h${f1(-fw * 0.05)}Z`).join('') }),
    s('path', { class: 't29r-fab-line', d: scaf + crane }),
    s('path', { class: 't29r-masons', d: masons }))
  // ── the heat over the left stretch of the horizon: the far ridge again in thin slices that slide apart (a mirage)
  const [a0, a1] = zones[0]
  const hr = ridge(a0 - W * 0.04, a1 + W * 0.02, hz + 2, H * (wide ? 0.13 : 0.1), 2994, 3)
  const hd = `M${f1(a0 - W * 0.04)} ${f1(hz + 2)}L${hr.map(P).join('L')}L${f1(a1 + W * 0.02)} ${f1(hz + 2)}Z`
  const band = H * (wide ? 0.13 : 0.1)
  const slices: SVGElement[] = []
  for (let i = 0; i < 7; i++) {
    const y0 = hz - band + (band * i) / 7, id = `t29r-hs${i}`
    slices.push(s('g', { class: 't29r-slice', style: `--i:${i}` },
      s('clipPath', { id }, s('rect', { x: f1(a0 - W * 0.05), y: f1(y0), width: f1(a1 - a0 + W * 0.08), height: f1(band / 7 + 1.5) })),
      s('path', { class: 't29r-mirage', d: hd, 'clip-path': `url(#${id})` })))
  }
  // warm ripples of air: short broken dashes over the ridge, denser low down, fading up
  let shimmer = ''
  for (let i = 0; i < 6; i++) {
    const y = hz - H * (0.008 + i * 0.022)
    let x = a0 + q() * 30
    while (x < a1 - 20) {
      const len = (a1 - a0) * (0.04 + q() * 0.08)
      if (q() > 0.3 + i * 0.08) {
        const pts: Pt[] = []
        for (let k = 0; k <= 6; k++) pts.push([x + (len * k) / 6, y + Math.sin((x + (len * k) / 6) * 0.06 + i * 1.9) * (1.2 + i * 0.3)])
        shimmer += stroke(pts, 1.1 + (5 - i) * 0.18, 0.4, 0.4, 0.1)
      }
      x += len + (a1 - a0) * (0.02 + q() * 0.05)
    }
  }
  // cracks in the plain where the heat lies, finer far, heavier near
  let cracks = ''
  for (let i = 0; i < 54; i++) {
    const x = a0 + q() * (a1 - a0 + W * 0.04), y = hz + Math.pow(q(), 0.8) * (H * 0.98 - hz)
    const k = (y - hz) / (H - hz)
    let p: Pt = [x, y]
    const pts: Pt[] = [p]
    for (let j = 0; j < 3; j++) {
      p = [p[0] + (q() - 0.5) * 46 * (0.3 + k), p[1] + (q() - 0.3) * 5 * (0.3 + k)]
      pts.push(p)
    }
    cracks += stroke(pts, 0.5 + k * 1.6, 0.2, 0.3, 0.2)
  }
  const drought = s('g', { class: 't29r-w t29r-w0' },
    s('path', { class: 't29r-crack', d: cracks }),
    s('g', { class: 't29r-heat' }, ...slices),
    s('g', { class: 't29r-shimmer' }, s('path', { d: shimmer })))
  // the plain: darker toward us; a worn path from the well out along the stones toward the horizon
  const field = `M0 ${f1(hz - H * 0.012)}H${f1(W)}V${f1(H)}H0Z`
  const way: Pt[] = [[well.cx + well.rx * 0.6, well.cy + well.ry + well.hc * 1.1], [stones[0].x, stones[0].y + H * 0.01], [stones[1].x - stones[1].w * 0.2, stones[1].y + H * 0.008], [stones[2].x - stones[2].w * 0.4, stones[2].y + H * 0.004], [W * (wide ? 0.95 : 0.98), hz + H * 0.012]]
  const wayPts = way.slice(1).reduce<Pt[]>((acc, p, i) => acc.concat(curve(way[i], [(way[i][0] + p[0]) / 2, (way[i][1] + p[1]) / 2 + H * 0.012], p, 8).slice(i ? 1 : 0)), [])
  const wayW = (y: number) => clamp(((y - hz) / (H - hz)) * H * 0.06, 2, 44)
  // the worn way: a pale band of trodden earth, wide near, a thread by the horizon, broken by tufts
  const rev = [...wayPts].reverse()
  let path = ''
  for (let i = 0; i < rev.length - 4; i += 4) path += stroke(rev.slice(i, i + 5), wayW(rev[Math.min(i + 4, rev.length - 1)][1]) * 0.9, 0.3, 0.3, 0.3)
  let edge = ''
  for (let i = 2; i < wayPts.length - 1; i += 2) {
    const [x, y] = wayPts[i]
    edge += stroke([[x - wayW(y) * 0.9, y + wayW(y) * 0.12], [x - wayW(y) * 0.3, y + wayW(y) * 0.2]], 0.5 + wayW(y) * 0.035, 0.3, 0.3, 0.2)
  }
  let tufts = '', pebbles = ''
  for (let i = 0; i < (wide ? 140 : 80); i++) {
    const x = q() * W, y = hz + Math.pow(q(), 0.75) * (H - hz)
    const k = (y - hz) / (H - hz)
    tufts += stroke([[x, y], [x + (q() - 0.5) * 3, y - 2 - k * 9]], 0.6 + k * 1.1, 0.1, 0.6, 0.2)
  }
  for (let i = 0; i < (wide ? 40 : 22); i++) {
    const x = q() * W, y = hz + H * 0.02 + Math.pow(q(), 0.7) * (H - hz), k = (y - hz) / (H - hz)
    pebbles += blob(x, y, 1.5 + k * 5, 1 + k * 2.4, 3040 + i, 0.25, 8)
  }
  return [
    mist(W * 0.5, hz - H * 0.04, W * 0.8, H * 0.08),
    hills(-W * 0.05, W * 0.46, hz + 2, H * (wide ? 0.11 : 0.09), 2994, 0.82, 3),
    hills(W * 0.42, W * 0.82, hz + 2, H * (wide ? 0.085 : 0.075), 2995, 0.6, 2),
    hills(W * 0.7, W * 1.05, hz + 2, H * 0.1, 2996, 0.82, 3),
    fab,
    mist(W * 0.5, hz + H * 0.004, W * 0.85, H * 0.025),
    s('linearGradient', { id: 't29r-fieldfade', x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, style: 'stop-color:var(--t29-field);stop-opacity:0' }), s('stop', { offset: 0.07, style: 'stop-color:var(--t29-field);stop-opacity:1' })),
    s('path', { class: 't29r-field', d: field, fill: 'url(#t29r-fieldfade)' }),
    s('rect', { class: 't29r-field-shade', x: 0, y: f1(hz), width: f1(W), height: f1(H - hz), fill: 'url(#t29-dusk)' }),
    // the moon low on the left lights the plain under it a little
    s('ellipse', { class: 't29r-moonpool', cx: f1(g.moon[0] + W * 0.08), cy: f1(hz + H * 0.08), rx: f1(W * (wide ? 0.32 : 0.5)), ry: f1(H * 0.12), fill: 'url(#t29-glint)' }),
    s('path', { class: 't29r-path', d: path }),
    s('path', { class: 't29r-path-edge', d: edge }),
    s('path', { class: 't29r-pebble', d: pebbles }),
    s('path', { class: 't29r-tuft', d: tufts }),
    mist(W * 0.5, hz + H * 0.006, W * 0.75, H * 0.03),
    drought,
  ]
}

/** The well, near left, a little from above: its cast shadow thrown right by the moon on the left, the curb in courses of
 *  dressed blocks with moss at its foot, the top ring, the dark shaft with its far wall in courses, dry cracked mud far down
 *  (water with the moon in it once the rain has come); the near grass. */
function wellArt(g: Geo): SVGElement[] {
  const { W, H, well: { cx, cy, rx, ry, hc }, stones, wide } = g
  const q = rng(3020)
  const ri = rx * 0.8, riy = ry * 0.74
  const arc = (a: number, b: number, ex: number, ey: number, dy = 0, nn = 40): Pt[] =>
    Array.from({ length: nn + 1 }, (_, i) => {
      const t = ((a + ((b - a) * i) / nn) * Math.PI) / 180
      return [cx + Math.cos(t) * ex, cy + dy + Math.sin(t) * ey] as Pt
    })
  const foot = cy + hc
  const ring = `M${arc(0, 360, rx, ry, 0, 64).map(P).join('L')}ZM${arc(360, 0, ri, riy, 0, 64).map(P).join('L')}Z`
  const face = `M${arc(0, 180, rx, ry).map(P).join('L')}L${arc(180, 0, rx, ry, hc).map(P).join('L')}Z`
  // courses of dressed blocks on the face, staggered joints
  let joints = ''
  const rows = 3
  for (let row = 1; row < rows; row++) joints += `M${arc(3, 177, rx, ry, (hc * row) / rows).map(P).join('L')}`
  for (let row = 0; row < rows; row++)
    for (let a = 8 + row * 9; a < 174; a += 15 + q() * 6) {
      const c = Math.cos((a * Math.PI) / 180), sn = Math.sin((a * Math.PI) / 180)
      const y0 = cy + sn * ry + (hc * row) / rows
      joints += `M${f1(cx + c * rx)} ${f1(y0 + 1.5)}v${f1(hc / rows - 3)}`
    }
  for (let a = 6; a < 360; a += 16 + q() * 6) {
    const c = Math.cos((a * Math.PI) / 180), sn = Math.sin((a * Math.PI) / 180)
    joints += `M${f1(cx + c * ri)} ${f1(cy + sn * riy)}L${f1(cx + c * rx)} ${f1(cy + sn * ry)}`
  }
  // dry brush along the courses: the stone's grain, heavier on the shaded right
  let grain = ''
  for (let i = 0; i < 40; i++) {
    const a = 10 + q() * 160, row = Math.floor(q() * rows), len = 6 + q() * 10
    const c = Math.cos((a * Math.PI) / 180), sn = Math.sin((a * Math.PI) / 180)
    const x = cx + c * rx * 0.98, y = cy + sn * ry + (hc * (row + 0.3 + q() * 0.4)) / rows
    grain += stroke([[x, y], [x + len * 0.5, y + 0.4], [x + len, y + (q() - 0.5)]], 0.8 + (a < 90 ? 0.8 : 0.2), 0.3, 0.4, 0.2)
  }
  // the shaft: its far wall in courses falling into the dark; the bottom far down
  const id = 't29r-mouth'
  let wall = ''
  for (let k = 1; k < 7; k++) wall += `M${arc(196, 344, ri * (1 - k * 0.035), riy * (1 - k * 0.04), riy * k * 0.24).map(P).join('L')}`
  const bx = cx - ri * 0.04, byy = cy + riy * 0.5, brx = ri * 0.66, bry = riy * 0.42
  let mud = ''
  for (let i = 0; i < 9; i++) {
    const a = q() * Math.PI * 2, d = q() * 0.7
    const x = bx + Math.cos(a) * brx * d, y = byy + Math.sin(a) * bry * d
    mud += stroke([[x, y], [x + (q() - 0.5) * brx * 0.5, y + (q() - 0.5) * bry * 0.4], [x + (q() - 0.5) * brx * 0.7, y + (q() - 0.5) * bry * 0.6]], 0.8, 0.2, 0.3, 0.2)
  }
  // the reflection: water down the shaft, the moon on it broken and trembling (it shows when the rain has come)
  const mx = bx - brx * 0.22
  const reflect = s('g', { class: 't29r-w t29r-w2 t29r-reflect', style: `transform-origin:${f1(mx)}px ${f1(byy)}px` },
    s('ellipse', { class: 't29r-water', cx: f1(bx), cy: f1(byy), rx: f1(brx), ry: f1(bry) }),
    s('ellipse', { class: 't29r-moon-halo', cx: f1(mx), cy: f1(byy), rx: f1(brx * 0.42), ry: f1(bry * 0.9), fill: 'url(#t29-glint)' }),
    s('path', { class: 't29r-moon-in', d: stroke([[mx - brx * 0.13, byy - bry * 0.22], [mx + brx * 0.1, byy - bry * 0.28]], bry * 0.42, 0.3, 0.3, 0.3) + stroke([[mx - brx * 0.16, byy + bry * 0.18], [mx + brx * 0.08, byy + bry * 0.14]], bry * 0.3, 0.3, 0.3, 0.3) + stroke([[mx - brx * 0.04, byy + bry * 0.52], [mx + brx * 0.12, byy + bry * 0.5]], bry * 0.18, 0.3, 0.3, 0.3) }),
    s('path', { class: 't29r-ripple', d: stroke(arc(200, 330, brx * 0.82, bry * 0.7, byy - cy, 14), Math.max(0.8, bry * 0.06), 0.3, 0.3, 0.2) }))
  // cracks in the curb that open in the heat (one faint from the start)
  const crack = stroke([[cx + rx * 0.36, cy + ry * 0.92], [cx + rx * 0.33, cy + ry + hc * 0.3], [cx + rx * 0.38, cy + ry + hc * 0.6], [cx + rx * 0.34, cy + ry + hc * 0.95]], 2.2, 0.1, 0.4, 0.3) +
    stroke([[cx + rx * 0.33, cy + ry + hc * 0.3], [cx + rx * 0.24, cy + ry + hc * 0.42]], 1.4, 0.1, 0.4, 0.3) +
    stroke([[cx - rx * 0.55, cy + ry * 0.8], [cx - rx * 0.52, cy + ry * 0.8 + hc * 0.35], [cx - rx * 0.58, cy + ry * 0.8 + hc * 0.7]], 1.8, 0.1, 0.4, 0.3)
  // moss: clumps at the curb's foot and over the back of the top ring (the side the damp keeps)
  let moss = ''
  // clumps where the damp keeps: three patches on the back of the ring, a few at the foot on the shaded side
  for (const [a0, n] of [[205, 5], [248, 4], [300, 3]] as const)
    for (let i = 0; i < n; i++) {
      const a = (a0 + (q() - 0.5) * 22) * (Math.PI / 180), d = 0.5 + (q() - 0.5) * 0.25
      moss += blob(cx + Math.cos(a) * (ri + (rx - ri) * d * 2) * 1, cy + Math.sin(a) * (riy + (ry - riy) * d * 2), rx * (0.012 + q() * 0.025), ry * (0.03 + q() * 0.04), 3060 + a0 + i, 0.35, 8)
    }
  for (const [a0, n] of [[40, 5], [110, 4], [160, 3]] as const)
    for (let i = 0; i < n; i++) {
      const a = (a0 + (q() - 0.5) * 18) * (Math.PI / 180)
      moss += blob(cx + Math.cos(a) * rx * 1.0, foot + Math.sin(a) * ry - hc * (0.02 + q() * 0.08), rx * (0.012 + q() * 0.03), hc * (0.04 + q() * 0.07), 3080 + a0 + i, 0.35, 8)
    }
  // the stones' cast shadows on the field (the moon on the left throws them right) and their contact
  const shadows = stones.map((st) => blob(st.x + st.w * 0.42, st.y - st.h * 0.02, st.w * 0.62, Math.max(4, st.h * 0.11), 3100 + Math.round(st.x), 0.15, 14)).join('')
  const contact = stones.map((st) => blob(st.x + st.w * 0.04, st.y, st.w * 0.52, Math.max(3, st.h * 0.06), 3110 + Math.round(st.x), 0.1, 12)).join('')
  return [
    // the well's shadow: thrown right along the ground, and its contact
    s('path', { class: 't29r-shadow', d: blob(cx + rx * 0.42, foot + ry * 0.35, rx * 1.12, ry * 0.75, 3024, 0.08, 24) }),
    s('path', { class: 't29r-contact', d: blob(cx + rx * 0.06, foot + ry * 0.05, rx * 1.03, ry * 1.04, 3025, 0.05, 28) }),
    s('path', { class: 't29r-shadow', d: shadows }),
    s('path', { class: 't29r-contact', d: contact }),
    s('path', { class: 't29r-curb-face', d: face }),
    s('path', { class: 't29r-curb-shade', d: face, fill: 'url(#t29-cyl)' }),
    s('path', { class: 't29r-grain', d: grain }),
    s('path', { class: 't29r-curb-top', d: ring, 'fill-rule': 'evenodd' }),
    s('defs', null, s('clipPath', { id }, s('ellipse', { cx: f1(cx), cy: f1(cy), rx: f1(ri), ry: f1(riy) }))),
    s('g', { 'clip-path': `url(#${id})` },
      s('rect', { class: 't29r-shaft', x: f1(cx - ri), y: f1(cy - riy), width: f1(ri * 2), height: f1(riy * 2), fill: 'url(#t29-shaft)' }),
      s('path', { class: 't29r-shaft-course', d: wall }),
      s('path', { class: 't29r-mud', d: blob(bx, byy, brx, bry, 3026, 0.1, 18) }),
      s('path', { class: 't29r-mud-crack', d: mud }),
      reflect),
    s('path', { class: 't29r-joint', d: joints }),
    s('path', { class: 't29r-moss', d: moss }),
    s('path', { class: 't29r-ink', d: stroke(arc(4, 176, rx, ry, hc), Math.max(2, H * 0.004), 0.1, 0.1, 0.3) + stroke(arc(186, 354, ri, riy), Math.max(1.4, H * 0.003), 0.2, 0.2, 0.3) + stroke(arc(-4, 40, rx, ry), Math.max(1.6, H * 0.003), 0.2, 0.2, 0.3), filter: 'url(#ink-rough)' }),
    s('path', { class: 't29r-rim', d: stroke(arc(150, 260, rx * 0.995, ry * 0.97), Math.max(1.4, H * 0.003), 0.2, 0.2, 0.2) + stroke(arc(300, 380, ri * 1.01, riy * 1.05), Math.max(1.2, H * 0.0025), 0.3, 0.3, 0.2) }),
    s('path', { class: 't29r-crack t29r-rimcrack', d: crack }),
    grass(cx - rx * 1.02, foot + ry * 0.3, rx * 0.26, 3021),
    grass(cx + rx * 0.98, foot + ry * 0.4, rx * 0.2, 3022),
    grass(W * (wide ? 0.97 : 0.04), H * 1.01, H * 0.07, 3023),
    grass(W * (wide ? 0.6 : 0.5), H * 0.995, H * 0.045, 3027),
    grass(W * (wide ? 0.03 : 0.96), H * 1.0, H * 0.06, 3028),
    grass(stones[0].x - stones[0].w * 0.52, stones[0].y + 2, stones[0].w * 0.22, 3029),
    grass(stones[1].x + stones[1].w * 0.32, stones[1].y + 1, stones[1].w * 0.18, 3031),
  ]
}

/** One of the three speakers' stones, foot at (0, 0), w × h, lit from the moon on the upper left: a cracked angular slab,
 *  a mason's dressed block with chisel marks, a rain-worn pebble with a cap of moss. */
function stoneShape(kind: (typeof KIND)[number], w: number, h: number, seed: number): SVGElement[] {
  const q = rng(seed)
  const poly = (pts: Pt[]) => `M${pts.map(([x, y]) => `${f1(x * w)} ${f1(y * h)}`).join('L')}Z`
  const ink = (pts: Pt[], wd: number) => stroke(pts.map(([x, y]) => [x * w, y * h] as Pt), wd, 0.15, 0.2, 0.3)
  if (kind === 'slab') {
    const out: Pt[] = [[-0.5, 0], [-0.47, -0.5], [-0.33, -0.9], [-0.02, -1], [0.3, -0.84], [0.47, -0.42], [0.5, 0]]
    const lit: Pt[] = [[-0.47, -0.5], [-0.33, -0.9], [-0.02, -1], [0.3, -0.84], [0.08, -0.62], [-0.2, -0.56]]
    const shade: Pt[] = [[0.08, -0.62], [0.3, -0.84], [0.47, -0.42], [0.5, 0], [0.12, 0]]
    return [
      s('path', { class: 't29r-st-body', d: poly(out), filter: 'url(#ink-rough)' }),
      s('path', { class: 't29r-st-lit', d: poly(lit) }),
      s('path', { class: 't29r-st-shade', d: poly(shade) }),
      s('path', { class: 't29r-st-crack t29r-w t29r-w0', d: ink([[-0.12, -0.98], [-0.06, -0.7], [-0.15, -0.45], [-0.08, -0.15]], Math.max(1.4, w * 0.012)) + ink([[-0.06, -0.7], [0.12, -0.62]], Math.max(1, w * 0.008)) }),
      s('path', { class: 't29r-st-crack', d: ink([[0.2, -0.86], [0.24, -0.6], [0.33, -0.5]], Math.max(1, w * 0.008)) }),
      s('path', { class: 't29r-st-ink', d: ink([[-0.02, -1], [0.3, -0.84], [0.47, -0.42], [0.5, 0]], Math.max(1.8, w * 0.018)) + ink([[-0.5, 0], [0.5, 0]], Math.max(1.4, w * 0.012)) }),
      s('path', { class: 't29r-st-rim', d: ink([[-0.46, -0.48], [-0.33, -0.88], [-0.04, -0.98]], Math.max(1.4, w * 0.014)) }),
    ]
  }
  if (kind === 'block') {
    // a dressed block seen a little from above: top, front, right side; not a box: the faces lean, a corner is knocked off
    const top: Pt[] = [[-0.45, -0.7], [-0.31, -0.97], [0.36, -1], [0.47, -0.93], [0.31, -0.69]]
    const front: Pt[] = [[-0.47, 0], [-0.45, -0.7], [0.31, -0.69], [0.33, -0.04], [0.28, 0]]
    const side: Pt[] = [[0.28, 0], [0.33, -0.04], [0.31, -0.69], [0.47, -0.93], [0.5, -0.26], [0.42, -0.12]]
    const chip: Pt[] = [[0.36, -1], [0.47, -0.93], [0.41, -0.86], [0.33, -0.9]]
    let chisel = ''
    for (let i = 0; i < 30; i++) {
      const x = -0.42 + q() * 0.68, y = -0.64 + q() * 0.58
      chisel += ink([[x, y], [x + 0.04, y + 0.07]], Math.max(0.8, w * 0.006))
    }
    for (let i = 0; i < 10; i++) {
      const x = -0.3 + q() * 0.62, y = -0.93 + q() * 0.18
      chisel += ink([[x, y], [x + 0.06, y + 0.01]], Math.max(0.7, w * 0.005))
    }
    return [
      s('path', { class: 't29r-st-body', d: poly([[-0.47, 0], [-0.45, -0.7], [-0.31, -0.97], [0.36, -1], [0.47, -0.93], [0.5, -0.26], [0.42, -0.12], [0.28, 0]]), filter: 'url(#ink-rough)' }),
      s('path', { class: 't29r-st-top', d: poly(top) }),
      s('path', { class: 't29r-st-front', d: poly(front) }),
      s('path', { class: 't29r-st-shade', d: poly(side) }),
      s('path', { class: 't29r-st-shade', d: poly(chip) }),
      s('path', { class: 't29r-st-moss', d: blob(-w * 0.32, -h * 0.74, w * 0.1, h * 0.035, seed + 5, 0.4, 10) + blob(-w * 0.06, -h * 0.71, w * 0.06, h * 0.025, seed + 6, 0.4, 8) }),
      s('path', { class: 't29r-st-chisel', d: chisel }),
      s('path', { class: 't29r-st-ink', d: ink([[0.31, -0.69], [0.33, -0.04], [0.28, 0]], Math.max(1.4, w * 0.012)) + ink([[0.41, -0.86], [0.5, -0.26], [0.42, -0.12], [0.28, 0]], Math.max(1.6, w * 0.016)) + ink([[-0.47, 0], [0.28, 0]], Math.max(1.4, w * 0.012)) }),
      s('path', { class: 't29r-st-rim', d: ink([[-0.45, -0.68], [-0.31, -0.96], [0.34, -0.99]], Math.max(1.2, w * 0.012)) }),
    ]
  }
  // the pebble: wide, low, round; moss on its crown
  const d = blob(0, -h * 0.5, w * 0.5, h * 0.5, seed, 0.06, 22)
  return [
    s('path', { class: 't29r-st-body', d, filter: 'url(#ink-rough)' }),
    s('path', { class: 't29r-st-lit', d: blob(-w * 0.1, -h * 0.66, w * 0.34, h * 0.28, seed + 1, 0.1, 16) }),
    s('path', { class: 't29r-st-shade', d: blob(w * 0.2, -h * 0.32, w * 0.3, h * 0.32, seed + 2, 0.1, 16) }),
    s('path', { class: 't29r-st-moss', d: blob(-w * 0.04, -h * 0.9, w * 0.3, h * 0.12, seed + 3, 0.3, 14) + blob(w * 0.26, -h * 0.78, w * 0.1, h * 0.07, seed + 4, 0.3, 10) }),
    s('path', { class: 't29r-st-ink', d: stroke(curve([w * 0.12, -h * 0.98], [w * 0.55, -h * 0.85], [w * 0.46, -h * 0.05], 10), Math.max(1.4, w * 0.02), 0.2, 0.2, 0.3) }),
    s('path', { class: 't29r-st-rim', d: stroke(curve([-w * 0.47, -h * 0.4], [-w * 0.42, -h * 0.96], [0, -h * 0.99], 10), Math.max(1.2, w * 0.016), 0.3, 0.3, 0.2) }),
  ]
}
