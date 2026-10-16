import { fill, h, s } from '../../core/dom'
import { L, type Fact } from '../../core/content'
import { sliced } from '../../core/chunk'
import type { SceneDef } from '../types'
import type { Perspectives } from '../../ui/part2/types'
import { blob, clamp, onDigit, onSize, rng, stableHeight, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist } from '../../ui/part2/paint'
import { C } from './data'
import { t29Defs } from './figures'
import { f1, P } from './rig'

const S = C.scenes.refill
const DATA = S.perspectives as Perspectives
// data order = left to right: J.P. Morgan (years of drought), SK hynix (a fab rising), IDC (rain by 2027–28)

interface Geo {
  W: number
  H: number
  wide: boolean
  hz: number
  well: { cx: number; cy: number; rx: number; ry: number; ri: number; riy: number }
  /** the three stones on the rim: foot, width, height */
  stones: { x: number; y: number; w: number; h: number }[]
  /** where each voice is written in the sky: left, top, width */
  text: { x: number; y: number; w: number }[]
  /** each weather's third of the sky: x0, x1 */
  thirds: [number, number][]
}

function geo(W: number, H: number): Geo {
  const wide = W / H > 1.15
  if (wide) {
    const rx = W * 0.44, ry = H * 0.05
    const cx = W * 0.5, cy = H * 0.755
    const sw = clamp(W * 0.17, 150, 260)
    return {
      W, H, wide, hz: H * 0.66,
      well: { cx, cy, rx, ry, ri: rx * 0.88, riy: ry * 0.62 },
      stones: [
        { x: cx - rx * 0.64, y: cy + ry * 0.62, w: sw * 1.12, h: sw * 0.56 },
        { x: cx + rx * 0.04, y: cy - ry * 0.7, w: sw * 0.9, h: sw * 0.46 },
        { x: cx + rx * 0.66, y: cy + ry * 0.6, w: sw * 1.18, h: sw * 0.52 },
      ],
      text: [0.05, 0.36, 0.67].map((x) => ({ x: W * x, y: H * 0.06, w: W * 0.28 })),
      thirds: [[0, W * 0.38], [W * 0.31, W * 0.69], [W * 0.62, W]],
    }
  }
  const rx = W * 0.62, ry = H * 0.036
  const cx = W * 0.5, cy = H * 0.775
  const sw = W * 0.31
  return {
    W, H, wide, hz: H * 0.64,
    well: { cx, cy, rx, ry, ri: rx * 0.88, riy: ry * 0.6 },
    stones: [
      { x: W * 0.18, y: cy + ry * 0.75, w: sw * 1.08, h: sw * 0.58 },
      { x: W * 0.52, y: cy - ry * 0.75, w: sw * 0.9, h: sw * 0.48 },
      { x: W * 0.83, y: cy + ry * 0.7, w: sw * 1.1, h: sw * 0.54 },
    ],
    text: [0, 1, 2].map(() => ({ x: W * 0.06, y: H * 0.04, w: W * 0.88 })),
    thirds: [[0, W * 0.42], [W * 0.28, W * 0.72], [W * 0.58, W]],
  }
}

/**
 * Giếng bao giờ đầy lại? (comp/2.5D, LOW, a great sky): the camera sits at the height of a dry well's rim, looking a
 * little up. The rim fills the foot of the frame, three big stones stand on it with their speakers' names carved in
 * them, and the sky over it all is the stage. Touch a stone: its weather comes into its third of the sky and its words
 * are written there. J.P. Morgan: a clear dry sky, heat shimmering over cracked earth, the rim cracking. SK hynix: on the
 * far hill masons raise a fab in scaffolding, a small cloud forming above it. IDC: rain clouds in ink wash roll in from
 * the right, rain falls, the moon's reflection appears down in the well. All three heard: the sky holds them all at
 * once, the reflection trembles, not yet round.
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
        h('button', { class: 't29r-stone', type: 'button', 'aria-pressed': 'false', 'aria-label': fill(L.stoneN, { n: k + 1 }) + ': ' + st.who, onClick: () => pick(k) },
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
      let sel = -1
      let g: Geo | null = null

      function pick(k: number) {
        if (k < 0 || k >= n) return
        if (sel >= 0) stones[sel].setAttribute('aria-pressed', 'false')
        sel = k
        const st = DATA.stones[k]
        stones[k].setAttribute('aria-pressed', 'true')
        heard.add(k)
        root.classList.add(`sky-${k}`)
        root.dataset.now = String(k)
        placeVoice()
        voice.replaceChildren(ctx.fact(st.view, 'p', 't29r-view'), h('p', { class: 't29r-who' }, `— ${st.who}`))
        if (!voice.hasAttribute('aria-live')) voice.setAttribute('aria-live', 'polite')
        if (heard.size === n && !root.classList.contains('is-all')) {
          root.classList.add('is-all')
          ctx.insight(DATA.common, S.insight as Fact)
          ctx.chime('ok')
        } else ctx.chime('soft')
      }
      function placeVoice() {
        if (!g || sel < 0) return
        const t = g.text[sel]
        Object.assign(voice.style, { left: `${f1(t.x)}px`, top: `${f1(t.y)}px`, width: `${f1(t.w)}px` })
      }

      // hover parallax: the sky, the far field, the rim slide apart a little (not on touch, low or reduced)
      if (!ctx.reduced && ctx.quality !== 'low') {
        let rect: DOMRect | null = null
        root.addEventListener('pointermove', (e) => {
          if (e.pointerType !== 'mouse') return
          rect ??= root.getBoundingClientRect()
          const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1, ny = ((e.clientY - rect.top) / rect.height) * 2 - 1
          layers.forEach((l, i) => (l.style.transform = `translate3d(${f1(-nx * [2, 5, 10][i])}px,${f1(-ny * [1, 2, 4][i])}px,0)`))
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
          art.setAttribute('viewBox', `${f1(-p.w / 2)} ${f1(-p.h)} ${f1(p.w)} ${f1(p.h * 1.08)}`)
          art.replaceChildren(stoneArt(p.w * 0.96, p.h * 0.94, 2990 + k * 7))
          ;(b.lastChild as HTMLElement).style.fontSize = `${f1(clamp(p.w * 0.08, 12, 18))}px`
        })
        placeVoice()
        job?.cancel()
        job = sliced(paint(g), { sync: ctx.reduced || built })
        built = true
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

/** The sky: night nearly over (lighter low down), and each voice's weather waiting unseen in its third. */
function skyArt(g: Geo): SVGElement[] {
  const { W, H, hz, thirds } = g
  const q = rng(2990)
  // ── J.P. Morgan: a dry warm glow, the sky clear
  const [a0, a1] = thirds[0]
  const dry = s('g', { class: 't29r-w t29r-w0' },
    s('ellipse', { cx: f1((a0 + a1) / 2), cy: f1(hz - H * 0.2), rx: f1((a1 - a0) * 0.75), ry: f1(H * 0.38), fill: 'url(#t29-dry)' }))
  // ── SK hynix: a small cloud forming over the fab (a pale wash, a few puffs)
  const [b0, b1] = thirds[1]
  const bc = (b0 + b1) / 2
  let puffs = ''
  for (let i = 0; i < 5; i++) puffs += blob(bc + (i - 2) * (b1 - b0) * 0.07 + (q() - 0.5) * 6, hz - H * (0.27 + (i % 2) * 0.02), (b1 - b0) * (0.07 + q() * 0.04), H * (0.022 + q() * 0.012), 2991 + i, 0.15, 14)
  const forming = s('g', { class: 't29r-w t29r-w1' }, s('g', { class: 't29r-grow', style: `transform-origin:${f1(bc)}px ${f1(hz - H * 0.27)}px` },
    s('path', { class: 't29r-puff', d: puffs, filter: 'url(#ink-wash)' })))
  // ── IDC: rain clouds in ink wash rolling in from the right, dark bellies, rain falling to the horizon
  const [c0, c1] = thirds[2]
  let cloud = '', belly = '', rain = ''
  for (let i = 0; i < 7; i++) {
    const x = c0 + (c1 - c0) * (0.1 + i * 0.15) + (q() - 0.5) * 20, y = H * (g.wide ? 0.27 : 0.3) + (q() - 0.5) * H * 0.04
    cloud += blob(x, y, (c1 - c0) * (0.13 + q() * 0.08), H * (0.045 + q() * 0.03), 2993 + i, 0.18, 16)
    belly += blob(x + 6, y + H * 0.03, (c1 - c0) * (0.1 + q() * 0.05), H * 0.018, 3001 + i, 0.25, 12)
  }
  for (let i = 0; i < 70; i++) {
    const x = c0 + (c1 - c0) * (0.08 + q() * 0.95), y = H * (g.wide ? 0.32 : 0.35) + q() * (hz - H * 0.36), l = H * (0.03 + q() * 0.04)
    rain += stroke([[x, y], [x - l * 0.22, y + l]], 0.9 + q() * 0.7, 0.3, 0.3, 0.2)
  }
  const wet = s('g', { class: 't29r-w t29r-w2' },
    s('linearGradient', { id: 't29r-cloud', x1: 0, y1: 0, x2: 0, y2: 1 },
      s('stop', { offset: 0, style: 'stop-color:var(--t29-cloud);stop-opacity:0.05' }),
      s('stop', { offset: 0.55, style: 'stop-color:var(--t29-cloud);stop-opacity:0.5' }),
      s('stop', { offset: 1, style: 'stop-color:var(--t29-cloud);stop-opacity:0.85' })),
    s('g', { class: 't29r-roll' },
      s('path', { class: 't29r-cloud', d: cloud, fill: 'url(#t29r-cloud)', filter: 'url(#ink-wash)' }),
      s('path', { class: 't29r-belly', d: belly, filter: 'url(#ink-wash)' })),
    s('g', { class: 't29r-rain' }, s('path', { d: rain })))
  return [
    // night nearly over: the sky pales toward the horizon
    mist(W * 0.5, hz - H * 0.02, W * 0.9, H * 0.3),
    mist(W * 0.5, hz - H * 0.08, W * 0.7, H * 0.16),
    dry,
    forming,
    wet,
  ]
}

/** The far field: ink hills (the middle one carries the fab), the dry plain to the horizon (it cracks when J.P. Morgan
 *  speaks, heat shimmering over it), the well's long shadow thrown forward by the moon behind us. */
function fieldArt(g: Geo): SVGElement[] {
  const { W, H, hz, thirds, well } = g
  const q = rng(3010)
  // ── the fab on the middle hill: a long hall with a saw-tooth roof, a stack, bamboo scaffolding, a crane, masons
  const [b0, b1] = thirds[1]
  const fx = (b0 + b1) / 2 - (b1 - b0) * 0.06, fy = hz - H * 0.05
  const fw = (b1 - b0) * (g.wide ? 0.36 : 0.42), fh = fw * 0.3
  let saw = ''
  for (let i = 0; i < 5; i++) saw += `l${f1(fw / 10)} ${f1(-fh * 0.35)}l${f1(fw / 10)} ${f1(fh * 0.35)}`
  const hall = `M${f1(fx - fw / 2)} ${f1(fy)}V${f1(fy - fh * 0.6)}${saw}V${f1(fy)}Z`
  const stack = `M${f1(fx - fw * 0.3)} ${f1(fy - fh * 0.6)}v${f1(-fh * 1.1)}h${f1(fw * 0.05)}v${f1(fh * 1.1)}Z`
  let scaf = ''
  const sx0 = fx + fw * 0.1, sx1 = fx + fw * 0.62
  for (let i = 0; i <= 6; i++) scaf += stroke([[sx0 + ((sx1 - sx0) * i) / 6, fy], [sx0 + ((sx1 - sx0) * i) / 6 + 0.4, fy - fh * 1.25]], 0.9, 0.05, 0.05, 0.6)
  for (let j = 1; j <= 4; j++) scaf += stroke([[sx0 - 2, fy - (fh * 1.2 * j) / 4], [sx1 + 2, fy - (fh * 1.2 * j) / 4 + 0.6]], 0.8, 0.05, 0.05, 0.6)
  scaf += stroke([[sx0, fy], [sx1, fy - fh * 1.2]], 0.7, 0.05, 0.05, 0.6)
  const mast = fx + fw * 0.82
  const crane = stroke([[mast, fy], [mast, fy - fh * 2.6]], 1.4, 0.02, 0.02, 0.7) + stroke([[mast - fw * 0.45, fy - fh * 2.5], [mast + fw * 0.2, fy - fh * 2.55]], 1.2, 0.02, 0.02, 0.7) +
    stroke([[mast - fw * 0.38, fy - fh * 2.5], [mast - fw * 0.38, fy - fh * 1.5]], 0.6, 0.02, 0.02, 0.8)
  let masons = ''
  const fig = (x: number, y: number, s1: number, lean = 0) => {
    // conical hat, head, a body stroke, legs: a mason in a few dabs of ink
    masons += `M${f1(x - s1 * 0.5)} ${f1(y - s1 * 2.1)}L${f1(x + lean)} ${f1(y - s1 * 2.7)}L${f1(x + s1 * 0.5)} ${f1(y - s1 * 2.1)}Z`
    masons += stroke([[x + lean * 0.6, y - s1 * 2], [x, y - s1 * 0.9]], s1 * 0.55, 0.1, 0.1, 0.6)
    masons += stroke([[x, y - s1 * 0.9], [x - s1 * 0.35, y]], s1 * 0.3, 0.1, 0.1, 0.6) + stroke([[x, y - s1 * 0.9], [x + s1 * 0.35, y]], s1 * 0.3, 0.1, 0.1, 0.6)
  }
  const ms = Math.max(2.4, fh * 0.12)
  fig(fx - fw * 0.62, fy, ms, 1)
  fig(fx - fw * 0.75, fy, ms * 0.95, -1)
  fig(sx0 + (sx1 - sx0) * 0.3, fy - (fh * 1.2) / 2, ms * 0.9)
  fig(sx0 + (sx1 - sx0) * 0.7, fy - (fh * 1.2 * 3) / 4, ms * 0.9, 1)
  fig(mast + fw * 0.12, fy, ms)
  // a beam carried between two masons
  masons += stroke([[fx - fw * 0.8, fy - ms * 1.6], [fx - fw * 0.56, fy - ms * 1.7]], ms * 0.35, 0.05, 0.05, 0.6)
  const fab = s('g', { class: 't29r-w t29r-w1 t29r-fab' },
    s('path', { class: 't29r-fab-hall', d: hall + stack, filter: 'url(#ink-wash)' }),
    s('path', { class: 't29r-fab-line', d: scaf + crane }),
    s('path', { class: 't29r-masons', d: masons }))
  // ── the dry plain: a crack network over the left of the field, heat shimmer above it
  const [a0, a1] = thirds[0]
  let cracks = ''
  for (let i = 0; i < 46; i++) {
    const x = a0 + q() * (a1 - a0), y = hz + q() * (well.cy - well.ry - hz) * 0.95
    const k = (y - hz) / (well.cy - hz)
    let p: Pt = [x, y]
    const pts: Pt[] = [p]
    for (let j = 0; j < 3; j++) {
      p = [p[0] + (q() - 0.5) * 40 * (0.4 + k), p[1] + (q() - 0.3) * 4 * (0.4 + k)]
      pts.push(p)
    }
    cracks += stroke(pts, 0.5 + k * 1.4, 0.2, 0.3, 0.2)
  }
  const shimmer = Array.from({ length: 6 }, (_, i) => {
    const y = hz - H * (0.012 + i * 0.022)
    const pts: Pt[] = []
    for (let x = a0 + 6; x <= a1 - 6; x += (a1 - a0) / 24) pts.push([x, y + Math.sin(x * 0.05 + i * 1.9) * (1.6 + i * 0.4)])
    return stroke(pts, 1.4 + (5 - i) * 0.25, 0.3, 0.3, 0.1)
  }).join('')
  const drought = s('g', { class: 't29r-w t29r-w0' },
    s('path', { class: 't29r-crack', d: cracks }),
    s('g', { class: 't29r-shimmer' }, s('path', { d: shimmer })))
  // the well's shadow: thrown forward to the horizon by the low moon at our backs
  const { cx, cy, rx } = well
  const shadow = `M${f1(cx - rx * 0.92)} ${f1(cy - well.ry * 0.4)}L${f1(cx - rx * 0.38)} ${f1(hz + H * 0.006)}L${f1(cx + rx * 0.38)} ${f1(hz + H * 0.006)}L${f1(cx + rx * 0.92)} ${f1(cy - well.ry * 0.4)}Z`
  let tufts = ''
  for (let i = 0; i < 70; i++) {
    const x = q() * W, y = hz + Math.pow(q(), 0.8) * (cy - hz)
    tufts += stroke([[x, y], [x + (q() - 0.5) * 2, y - 2 - ((y - hz) / (cy - hz)) * 5]], 0.8, 0.1, 0.6, 0.2)
  }
  return [
    mist(W * 0.5, hz - H * 0.04, W * 0.8, H * 0.08),
    hills(-W * 0.05, W * 0.42, hz + 2, H * 0.11, 2994, 0.82, 3),
    hills(W * 0.3, W * 0.74, hz + 2, H * 0.085, 2995, 0.6, 2),
    hills(W * 0.6, W * 1.05, hz + 2, H * 0.12, 2996, 0.82, 3),
    fab,
    mist(W * 0.5, hz + H * 0.004, W * 0.85, H * 0.025),
    s('rect', { class: 't29r-field', x: 0, y: f1(hz), width: f1(W), height: f1(H - hz) }),
    s('path', { class: 't29r-shadow', d: shadow }),
    s('path', { class: 't29r-tuft', d: tufts }),
    drought,
  ]
}

/** The rim at our eye level, big across the foot of the frame: the far curb top, the mouth (a dark slit where the
 *  moon's reflection trembles when the rain has come), the near curb top, its face in courses cut by the frame; cracks. */
function wellArt(g: Geo): SVGElement[] {
  const { W, H, well: { cx, cy, rx, ry, ri, riy } } = g
  const q = rng(3020)
  const arc = (a: number, b: number, ex: number, ey: number, dy = 0, nn = 40): Pt[] =>
    Array.from({ length: nn + 1 }, (_, i) => {
      const t = ((a + ((b - a) * i) / nn) * Math.PI) / 180
      return [cx + Math.cos(t) * ex, cy + dy + Math.sin(t) * ey] as Pt
    })
  const ring = `M${arc(0, 360, rx, ry, 0, 64).map(P).join('L')}ZM${arc(360, 0, ri, riy, 0, 64).map(P).join('L')}Z`
  const face = `M${arc(0, 180, rx, ry).map(P).join('L')}L${f1(cx - rx)} ${f1(H * 1.02)}L${f1(cx + rx)} ${f1(H * 1.02)}Z`
  let joints = ''
  for (let a = 8; a < 360; a += 13 + q() * 6) {
    const c = Math.cos((a * Math.PI) / 180), sn = Math.sin((a * Math.PI) / 180)
    joints += `M${f1(cx + c * ri)} ${f1(cy + sn * riy)}L${f1(cx + c * rx)} ${f1(cy + sn * ry)}`
  }
  const course = H - cy
  for (let row = 1; row < 4; row++) joints += `M${arc(2, 178, rx, ry, (course * row) / 3.4).map(P).join('L')}`
  for (let row = 0; row < 3; row++)
    for (let a = 6 + row * 7; a < 176; a += 11 + q() * 5) {
      const c = Math.cos((a * Math.PI) / 180), sn = Math.sin((a * Math.PI) / 180)
      const y0 = cy + sn * ry + (course * row) / 3.4
      joints += `M${f1(cx + c * rx)} ${f1(y0 + 2)}v${f1(course / 3.4 - 4)}`
    }
  // the reflection: a broken, trembling ellipse of moonlight in the slit (it shows when the rain has come)
  const mx = cx + ri * 0.08
  const reflect = s('g', { class: 't29r-w t29r-w2 t29r-reflect', style: `transform-origin:${f1(mx)}px ${f1(cy)}px` },
    s('ellipse', { class: 't29r-moon-halo', cx: f1(mx), cy: f1(cy), rx: f1(ri * 0.14), ry: f1(riy * 0.9), fill: 'url(#t29-glint)' }),
    s('path', { class: 't29r-moon-in', d: stroke([[mx - ri * 0.06, cy - riy * 0.15], [mx + ri * 0.06, cy - riy * 0.2]], riy * 0.5, 0.3, 0.3, 0.3) + stroke([[mx - ri * 0.08, cy + riy * 0.25], [mx + ri * 0.05, cy + riy * 0.22]], riy * 0.35, 0.3, 0.3, 0.3) }))
  const crack = stroke([[cx - rx * 0.34, cy + ry * 0.95], [cx - rx * 0.31, cy + ry + course * 0.2], [cx - rx * 0.36, cy + ry + course * 0.45], [cx - rx * 0.32, cy + ry + course * 0.8]], 2, 0.1, 0.4, 0.3) +
    stroke([[cx - rx * 0.31, cy + ry + course * 0.2], [cx - rx * 0.24, cy + ry + course * 0.32]], 1.4, 0.1, 0.4, 0.3) +
    stroke([[cx + rx * 0.5, cy + ry * 0.85], [cx + rx * 0.47, cy + ry + course * 0.25], [cx + rx * 0.53, cy + ry + course * 0.5]], 1.6, 0.1, 0.4, 0.3)
  return [
    s('path', { class: 't29r-curb-face', d: face }),
    s('path', { class: 't29r-curb-shade', d: face, fill: 'url(#t29-cyl)' }),
    s('path', { class: 't29r-curb-top', d: ring, 'fill-rule': 'evenodd' }),
    s('ellipse', { class: 't29r-mouth', cx: f1(cx), cy: f1(cy), rx: f1(ri), ry: f1(riy) }),
    reflect,
    s('path', { class: 't29r-joint', d: joints }),
    s('path', { class: 't29r-ink', d: stroke(arc(4, 176, rx, ry), Math.max(2, H * 0.004), 0.1, 0.1, 0.3) + stroke(arc(186, 354, ri, riy), Math.max(1.4, H * 0.003), 0.2, 0.2, 0.3), filter: 'url(#ink-rough)' }),
    s('path', { class: 't29r-rim', d: stroke(arc(196, 344, rx * 0.995, ry * 0.97), Math.max(1.4, H * 0.003), 0.2, 0.2, 0.2) + stroke(arc(20, 160, ri * 1.01, riy * 1.05), Math.max(1.2, H * 0.0025), 0.3, 0.3, 0.2) }),
    s('path', { class: 't29r-w t29r-w0 t29r-crack t29r-rimcrack', d: crack }),
    grass(cx - rx * 1.02, H * 1.01, H * 0.08, 3021),
    grass(cx + rx * 1.0, H * 1.01, H * 0.07, 3022),
    grass(W * 0.5, cy - ry * 0.2, H * 0.03, 3023),
  ]
}
