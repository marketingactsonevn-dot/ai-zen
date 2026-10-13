import { h, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import { cssVar, prefs } from '../../core/prefs'
import { logoStone } from '../../ui/logo'
import type { SceneCtx } from '../types'
import { brush, C, clamp, fitCanvas, palette, rgba, ribbon, rng, timers, watchTheme, type Pal, type Pt } from './ink'

const S = C.scenes.stream

/** A description becomes a little composition: melody stones on the five lines, deeper harmony stones below. */
interface Mood {
  bps: number
  ppb: number
  melody: [number, number][]
  bass: [number, number][]
  hz: number[]
  wave: OscillatorType
  attack: number
  decay: number
  extra: 'none' | 'petals' | 'rain'
}
const MOODS: Mood[] = [
  // Thiền · sáo trúc · chậm rãi — D minor pentatonic, long breaths
  { bps: 0.85, ppb: 2.6, melody: [[5, 2], [7, 1], [6, 1], [5, 3], [3, 1], [4, 2], [2, 2], [5, 4]], bass: [[0, 0], [1, 8]],
    hz: [293.66, 349.23, 392, 440, 523.25, 587.33, 698.46, 783.99, 880], wave: 'sine', attack: 0.09, decay: 2, extra: 'none' },
  // Vui tươi · đàn tranh · nắng sớm — C major pentatonic, plucked and quick
  { bps: 1.7, ppb: 1.6, melody: [[4, 1], [5, 1], [6, 1], [8, 1], [7, 2], [6, 1], [5, 1], [4, 1], [5, 1], [6, 2], [5, 1], [3, 1], [4, 2]], bass: [[0, 0], [1, 4], [0, 8], [1, 12]],
    hz: [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99], wave: 'triangle', attack: 0.006, decay: 1, extra: 'petals' },
  // Mưa đêm · dương cầm · buồn nhẹ — A minor pentatonic, falling
  { bps: 1.05, ppb: 2.1, melody: [[6, 2], [5, 1], [4, 1], [3, 2], [4, 1], [2, 3], [3, 1], [4, 1], [5, 2], [3, 2]], bass: [[1, 0], [0, 4], [1, 8], [0, 12]],
    hz: [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25], wave: 'triangle', attack: 0.006, decay: 1.9, extra: 'rain' },
]
const LOOP = 16 // beats per phrase

interface Note { x: number; pos: number; beats: number; bass: boolean; born: number; drop: boolean; landed: boolean; sung: number; dead: number; seed: number; mark: boolean }

/** A pre-painted picture whose local origin (the bamboo's foot) sits at (ox, oy) inside it. */
interface Sprite { cv: HTMLCanvasElement; ox: number; oy: number; w: number; h: number }
function sprite(w: number, hh: number, ox: number, oy: number, dpr: number, paint: (g: CanvasRenderingContext2D) => void): Sprite {
  const cv = document.createElement('canvas')
  cv.width = Math.max(1, Math.ceil(w * dpr))
  cv.height = Math.max(1, Math.ceil(hh * dpr))
  const g = cv.getContext('2d')!
  g.setTransform(dpr, 0, 0, dpr, ox * dpr, oy * dpr)
  paint(g)
  return { cv, ox, oy, w, h: hh }
}
const put = (g: CanvasRenderingContext2D, sp: Sprite) => g.drawImage(sp.cv, -sp.ox, -sp.oy, sp.w, sp.h)

/** Sample a quadratic curve a → (b) → c. */
function quad(a: Pt, b: Pt, c: Pt, n = 10): Pt[] {
  return Array.from({ length: n + 1 }, (_, k) => {
    const t = k / n
    const p = (1 - t) ** 2
    const q = 2 * (1 - t) * t
    const r = t * t
    return [p * a[0] + q * b[0] + r * c[0], p * a[1] + q * b[1] + r * c[1]] as Pt
  })
}

/** A bamboo leaf in one press-and-lift: a pointed press, a full belly, a long fine tail bending to the ground. */
function leaf(g: CanvasRenderingContext2D, x: number, y: number, ang: number, len: number, wid: number, droop: number) {
  const c = Math.cos(ang)
  const sn = Math.sin(ang)
  const ex = x + c * len
  const ey = y + sn * len
  const [px, py] = c >= 0 ? [-sn, c] : [sn, -c] // the perpendicular that points down
  const pts = quad([x, y], [(x + ex) / 2 + px * len * droop, (y + ey) / 2 + py * len * droop], [ex, ey], 14)
  g.beginPath()
  ribbon(g, pts, (_, t) => wid * (t < 0.22 ? 0.18 + 0.82 * Math.sqrt(t / 0.22) : (1 - (t - 0.22) / 0.78) ** 0.9))
  g.fill()
}

interface StemOpt { len: number; bw: number; bend: number; seed: number; tone: number; L: number; front: boolean }

/** A sumi-e bamboo culm: each segment one flat-brush stroke (loaded edges, a thinner wash at the heart, dry-brush streaks),
 *  a gap of paper at every node bridged by two dark hooked strokes, twigs carrying hanging clusters of leaves in two inks.
 *  Origin = the foot, up = −y. */
function paintStem(g: CanvasRenderingContext2D, pal: Pal, o: StemOpt) {
  const r = rng(o.seed)
  const ink = (a: number) => rgba(pal.ink, a * o.tone)
  const cx = (y: number) => o.bend * o.len * (y / o.len) ** 2
  const wAt = (y: number) => o.bw * (1 + 0.32 * (y / o.len))
  const n = Math.max(4, Math.round(o.len / (o.bw * 4.4)))
  const ws = Array.from({ length: n }, (_, i) => 0.55 + 0.55 * Math.min(1, i / 3) + r() * 0.12)
  const sum = ws.reduce((a, b) => a + b, 0)
  const J = [0]
  for (const w of ws) J.push(J[J.length - 1] - (w / sum) * o.len)
  const gap = Math.max(1.6, o.bw * 0.2)

  for (let i = 0; i < n; i++) {
    const yA = J[i] - (i ? gap / 2 : 0)
    const yB = J[i + 1] + (i < n - 1 ? gap / 2 : 0)
    const pts: Pt[] = []
    for (let k = 0; k <= 12; k++) {
      const y = yA + ((yB - yA) * k) / 12
      pts.push([cx(y), y])
    }
    const ym = (yA + yB) / 2
    const w = wAt(ym)
    const xm = cx(ym)
    // the ink bleeds a little beyond the stroke
    g.fillStyle = ink(0.07)
    g.beginPath()
    ribbon(g, pts, (_, t) => (wAt(yA + (yB - yA) * t) / 2) * 1.28)
    g.fill()
    const gr = g.createLinearGradient(xm - w / 2, 0, xm + w / 2, 0)
    gr.addColorStop(0, ink(0.9))
    gr.addColorStop(0.14, ink(0.66))
    gr.addColorStop(0.5, ink(0.58))
    gr.addColorStop(0.86, ink(0.72))
    gr.addColorStop(1, ink(0.94))
    g.fillStyle = gr
    g.beginPath()
    // the brush presses where it starts and stops: the stroke swells a touch at each end
    const crown = i === n - 1
    ribbon(g, pts, (_, t) => (wAt(yA + (yB - yA) * t) / 2) * (crown ? 1 - 0.45 * t * t : 1 + 0.1 * Math.cos(t * Math.PI * 2)))
    g.fill()
    // dry brush: the bristles part along the stroke and let the paper through
    const streaks = 3 + Math.floor(r() * 3)
    for (let k = 0; k < streaks; k++) {
      const off = (r() - 0.5) * 0.62 * w
      const t0 = r() * 0.45
      const t1 = Math.min(1, t0 + 0.25 + r() * 0.6)
      const dp: Pt[] = []
      for (let q = 0; q <= 8; q++) {
        const y = yA + (yB - yA) * (t0 + ((t1 - t0) * q) / 8)
        dp.push([cx(y) + off, y])
      }
      const hw = (0.18 + r() * 0.42) * Math.max(0.7, o.bw / 9)
      g.fillStyle = rgba(pal.paper, 0.3 + r() * 0.45)
      g.beginPath()
      ribbon(g, dp, (_, t) => hw * Math.sin(Math.PI * t) ** 0.5)
      g.fill()
    }
  }
  // the nodes: two dark hooks bridge each gap, reaching a little past the culm
  g.fillStyle = ink(0.95)
  for (let i = 1; i < n; i++) {
    const y = J[i]
    const w = wAt(y)
    const x = cx(y)
    const th = Math.max(1, w * 0.19)
    for (const sg of [-1, 1]) {
      g.beginPath()
      ribbon(g, quad([x + sg * w * 0.72, y + th * 0.2], [x + sg * w * 0.42, y - th * 1.3], [x + sg * w * 0.02, y + th * 0.15], 9), (_, t) => th * (t < 0.2 ? 0.55 + 2.25 * t : 1 - (t - 0.2) * 0.8))
      g.fill()
    }
  }

  const L = o.L
  const lw = L * 0.088
  const tones = o.front ? [ink(0.92), ink(0.68), ink(0.38)] : [ink(0.7), ink(0.48)]
  const twig = (a: Pt, c: Pt, w0: number) => {
    const b: Pt = [(a[0] + c[0]) / 2 + (c[1] - a[1]) * 0.08, (a[1] + c[1]) / 2 - (c[0] - a[0]) * 0.08]
    g.fillStyle = ink(0.85)
    g.beginPath()
    ribbon(g, quad(a, b, c, 10), (_, t) => w0 * (1 - t * 0.55))
    g.fill()
  }
  /** Leaves hanging from a twig tip, fanning down and out (side +1 = to the right), each its own tone and length. */
  const cluster = (p: Pt, side: number, fans: number[], scale: number, seed: number) => {
    const rr = rng(seed)
    fans.forEach((a0, k) => {
      const a = a0 + (rr() - 0.5) * 0.3
      g.fillStyle = tones[k === 0 ? 0 : Math.floor(rr() * tones.length)]
      leaf(g, p[0], p[1], side > 0 ? a : Math.PI - a, L * scale * (0.72 + rr() * 0.4), lw * (0.85 + rr() * 0.25), 0.08 + rr() * 0.1)
    })
  }
  // short twigs from the upper nodes, alternating sides, each holding a hanging cluster
  const first = Math.max(1, Math.floor(n * (o.front ? 0.4 : 0.55)))
  for (let i = first; i < n; i++) {
    const side = ((n - i) % 2 ? 1 : -1) * (o.front ? 1 : -1)
    const y = J[i]
    const x = cx(y) + side * wAt(y) * 0.45
    const reach = L * (0.3 + 0.18 * r())
    const end: Pt = [x + side * reach * 0.72, y - reach * 0.78]
    twig([x, y - 1], end, Math.max(0.45, o.bw * 0.085))
    const fans = o.front ? (i % 2 ? [0.55, 1.05, 0.12, 1.5] : [0.75, 0.2, 1.3]) : [0.6, 1.2]
    cluster(end, side, fans, 0.9 + 0.2 * ((i - first) / Math.max(1, n - first)), o.seed * 31 + i)
  }
  // the crown: the culm thins into a whip; young leaves point up, older ones hang
  const tx = cx(-o.len)
  const ty = -o.len + 1
  const tip: Pt = [tx + L * 0.1 * (o.front ? -1 : 1), ty - L * 0.4]
  twig([tx, ty + 2], tip, Math.max(0.5, o.bw * 0.1))
  if (o.front) {
    cluster(tip, 1, [-1.15, -0.45, 0.6], 0.78, o.seed * 7 + 1)
    cluster(tip, -1, [-1.0, 0.35, 1.2], 0.82, o.seed * 7 + 2)
  } else {
    cluster(tip, 1, [-0.9, 0.5], 0.72, o.seed * 7 + 1)
    cluster(tip, -1, [0.4], 0.7, o.seed * 7 + 2)
  }
}

/** The far bank the bamboo grows from: a pool of wash, two dry ground strokes, grass, two pebbles. Origin = the foot. */
function paintBank(g: CanvasRenderingContext2D, pal: Pal, sp: number, bw: number) {
  const r = rng(41)
  g.save()
  g.scale(1, 0.24)
  const wash = g.createRadialGradient(bw, 0, 0, bw, 0, sp * 2.6)
  wash.addColorStop(0, rgba(pal.ink, pal.dark ? 0.16 : 0.11))
  wash.addColorStop(1, rgba(pal.ink, 0))
  g.fillStyle = wash
  g.beginPath()
  g.arc(bw, 0, sp * 2.6, 0, Math.PI * 2)
  g.fill()
  g.restore()
  const ground = (x0: number, x1: number, y: number, hw: number, a: number) => {
    const pts: Pt[] = []
    for (let k = 0; k <= 16; k++) {
      const x = x0 + ((x1 - x0) * k) / 16
      pts.push([x, y + Math.sin(k * 0.9) * 0.4])
    }
    g.fillStyle = rgba(pal.ink, a)
    g.beginPath()
    ribbon(g, pts, (i, t) => hw * Math.sin(Math.PI * t) ** 0.6 * (0.75 + 0.5 * Math.abs(Math.sin(i * 1.7))))
    g.fill()
  }
  ground(-sp * 1.7, sp * 2.9, 1.2, 1.1, 0.42)
  ground(-sp * 0.7, sp * 1.1, 0.4, 1.7, 0.7)
  // grass, a few blades either side of the culm
  g.fillStyle = rgba(pal.ink, 0.62)
  for (const [x, a, l] of [[-bw * 1.1, -2.2, 0.42], [-bw * 0.7, -1.9, 0.3], [bw * 1.2, -1.15, 0.38], [bw * 2.1, -0.9, 0.26], [sp * 1.6, -1.3, 0.24]] as const) {
    g.beginPath()
    ribbon(g, quad([x, 0.6], [x + Math.cos(a) * sp * l * 0.5, Math.sin(a) * sp * l * 0.6], [x + Math.cos(a + 0.25) * sp * l, Math.sin(a + 0.25) * sp * l], 8), (_, t) => 0.9 * (1 - t))
    g.fill()
  }
  // two pebbles resting on the bank
  for (const [x, rx, ry] of [[-bw * 1.9 - sp * 0.2, sp * 0.3, sp * 0.18], [bw * 3.4 + sp * 0.35, sp * 0.2, sp * 0.13]]) {
    const gr = g.createLinearGradient(x - rx, -ry, x + rx * 0.4, ry)
    gr.addColorStop(0, pal.dark ? pal.stone : pal.stone3)
    gr.addColorStop(1, pal.dark ? pal.stone3 : pal.stone2)
    g.fillStyle = gr
    g.beginPath()
    g.ellipse(x, 0.5 - ry * 0.4, rx, ry, (r() - 0.5) * 0.2, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = rgba(pal.ink, 0.34)
    g.lineWidth = 1
    g.beginPath()
    g.ellipse(x, 0.5 - ry * 0.4, rx, ry, 0, Math.PI * 0.1, Math.PI * 0.9)
    g.stroke()
  }
}

/** The far shore: two ranges of wash hills, darkest at the ridge and dissolving downward into mist, melting into the paper
 *  at both ends. Origin = the horizon (y = 0, up = −y). Returns the far ridge so the sun can set behind it. */
function paintShore(g: CanvasRenderingContext2D, pal: Pal, x0: number, x1: number, hMax: number) {
  const span = x1 - x0
  const wk = Math.max(1, (hMax * 6.5) / span)
  // [centre, height, half-width] of each peak, as fractions of the shore; a far range and a lower, nearer one
  const ranges = [
    { a: pal.dark ? 0.095 : 0.085, peaks: [[0.6, 1, 0.07], [0.71, 0.74, 0.055], [0.49, 0.5, 0.08], [0.84, 0.46, 0.08], [0.33, 0.28, 0.12], [0.97, 0.3, 0.1]] },
    { a: pal.dark ? 0.12 : 0.11, peaks: [[0.67, 0.5, 0.09], [0.79, 0.4, 0.07], [0.42, 0.26, 0.11], [0.92, 0.3, 0.09], [0.55, 0.22, 0.1]] },
  ]
  const ridges = ranges.map((R) => (x: number) => {
    const u = (x - x0) / span
    let m = 0.06
    // on a narrow frame the peaks keep their breadth (relative to their height) instead of turning into spikes
    for (const [c, hk, w] of R.peaks) m = Math.max(m, hk / (1 + ((u - c) / (w * wk)) ** 2) ** 1.4)
    return hMax * m * (1 + 0.035 * Math.sin(x * 0.06) + 0.02 * Math.sin(x * 0.17))
  })
  const xs: number[] = []
  for (let x = x0 - 8; x <= x1 + 8; x += 4) xs.push(x)
  // each range is laid in six washes that share the ridge but reach less and less far down: dark crest, misty foot
  const N = 6
  ranges.forEach((R, ri) => {
    const rd = ridges[ri]
    g.fillStyle = rgba(pal.ink, (R.a / N) * 1.7)
    for (let k = 1; k <= N; k++) {
      g.beginPath()
      xs.forEach((x, i) => (i ? g.lineTo(x, -rd(x) + (k - 1) * 0.6) : g.moveTo(x, -rd(x) + (k - 1) * 0.6)))
      for (let i = xs.length - 1; i >= 0; i--) g.lineTo(xs[i], -rd(xs[i]) * (1 - (0.94 * k) / N))
      g.closePath()
      g.fill()
    }
  })
  g.globalCompositeOperation = 'destination-out'
  for (const [e0, e1] of [[x0 - 8, x0 + span * 0.14], [x1 + 8, x1 - span * 0.08]]) {
    const fg = g.createLinearGradient(e0, 0, e1, 0)
    fg.addColorStop(0, 'rgba(0,0,0,1)')
    fg.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = fg
    g.fillRect(Math.min(e0, e1), -hMax * 1.2, Math.abs(e1 - e0), hMax * 1.4)
  }
  g.globalCompositeOperation = 'source-over'
  return ridges[0]
}

/** Scene 3 — a stream with five lines like a stave. Words go in; stones drop as notes and sing as they pass the bamboo. */
export function streamScene(ctx: SceneCtx) {
  const cv = h('canvas', { class: 't10s-cv', role: 'img', 'aria-label': S.art })
  const moods = S.moods.map((m, i) =>
    h('button', { class: 't10-chip t10s-mood', type: 'button', 'aria-pressed': 'false', onClick: () => choose(i) },
      h('span', { class: 't10s-dot', 'aria-hidden': 'true' }),
      h('span', { class: 't10s-txt' }, h('span', { class: 't10s-a' }, m.name), h('span', { class: 't10s-sep' }, ', '), h('span', { class: 't10s-b' }, m.rest))))
  const moodBox = h('div', { class: 't10s-moods', role: 'group', 'aria-label': S.group }, ...moods)
  const braceM = s('path')
  const braceH = s('path')
  const svgM = s('svg', { class: 't10s-brace', 'aria-hidden': 'true' }, braceM)
  const svgH = s('svg', { class: 't10s-brace', 'aria-hidden': 'true' }, braceH)
  const melLab = h('div', { class: 't10s-lab' }, svgM, h('span', { class: 't10-cap' }, S.melody))
  const harLab = h('div', { class: 't10s-lab' }, svgH, h('span', { class: 't10-cap' }, S.harmony))
  const brand = h('div', { class: 't10-brand t10s-brand' }, logoStone('suno', { size: 34, decorative: true }), ctx.fact(S.brand, 'p', 't10-cap'))
  const root = h('div', { class: 't10 t10s' }, cv, moodBox, melLab, harLab, brand)
  ctx.art.append(root)
  ctx.prompt(S.prompt)

  const tm = timers()
  let pal: Pal = palette()
  let serif = cssVar('--serif')
  let g: CanvasRenderingContext2D | null = null
  let W = 0
  let H = 0
  let wide = true
  let short = false
  let sp = 20 // stave spacing
  let cy = 0
  let amp = 0
  let sx0 = 0 // the stream runs from sx0 to sx1
  let sx1 = 0
  let sxFull = 0 // before the row labels arrive the stream runs to the edge; then it eases back to sxLab
  let sxLab = 0
  const st = { ext: 0 }
  const setSx = () => (sx1 = sxFull + (sxLab - sxFull) * st.ext)
  let shore: Sprite | null = null
  let horizon = 0
  let ridge: (x: number) => number = () => 0
  let skyClip: Path2D | null = null
  const view = { dy: 0 }
  const glideEls = [moodBox, brand, melLab, harLab]
  let xp = 0 // the bamboo: where stones sing
  let foot = 0
  let bw = 8
  let back: Sprite | null = null
  let front: Sprite | null = null
  let bank: Sprite | null = null
  let keep: { x0: number; x1: number; y0: number; y1: number }[] = []
  let mood = -1
  const tried = new Set<number>()
  let rights = false // a second description chosen: the © stones join the stream
  let rightsShown = false
  let notes: Note[] = []
  let nextLoop = 0
  let off = 0
  let last = performance.now()
  let kick = 0
  let firstSong = false
  let dirty = true
  const rings: { x: number; y: number; at: number; v: boolean; r: number }[] = []
  const petals: { x: number; y: number; a: number; s: number }[] = []
  let rainAt = 0
  let sunA = 0 // the morning sun of the second description, fading in and out
  let ac: AudioContext | null = null

  const yc = (x: number) => cy + amp * Math.sin((x / Math.max(1, W)) * Math.PI * 1.15 + 0.5)
  const yPos = (x: number, pos: number) => yc(x) + (2 - pos / 2) * sp
  const pxBeat = () => (mood >= 0 ? MOODS[mood].ppb : 2) * sp

  function placeBrace(el: HTMLElement, svg: SVGSVGElement, path: SVGPathElement, y0: number, y1: number) {
    const hh = Math.max(12, y1 - y0)
    svg.setAttribute('viewBox', `0 0 10 ${hh}`)
    svg.setAttribute('width', '10')
    svg.setAttribute('height', String(hh))
    path.setAttribute('d', brush([[1.5, 0.6], [5, 3.5], [5, hh / 2 - 5], [9, hh / 2], [5, hh / 2 + 5], [5, hh - 3.5], [1.5, hh - 0.6]], 1.5, { a: 0.08, b: 0.08, min: 0.45, wob: 0 }))
    Object.assign(el.style, { left: `${sxLab + 6}px`, top: `${y0}px`, height: `${hh}px`, width: `${Math.max(0, W - sxLab - 6)}px` })
  }

  function layout() {
    const was = { W, cy, tops: glideEls.map((el) => el.offsetTop) }
    W = root.clientWidth
    H = root.clientHeight
    if (!W || !H) return
    wide = W / H > 1.1
    short = wide && H < 330
    root.classList.toggle('wide', wide && !short)
    root.classList.toggle('short', short)
    root.classList.toggle('tall', !wide)

    sxLab = W - (short ? 78 : wide ? 82 : 76)
    sxFull = W - 6
    setSx()
    let top: number
    let bottom: number
    if (short) {
      // the descriptions in a column on the left, just as wide as they need; the notable name tucked under them
      Object.assign(moodBox.style, { left: '0px', width: '', top: '0px' })
      const mw = Math.min(moodBox.offsetWidth + 2, W * 0.34)
      moodBox.style.width = `${mw}px`
      Object.assign(brand.style, { left: '0px', top: '0px', width: `${mw}px` })
      brand.style.top = `${H - brand.offsetHeight}px`
      sx0 = mw + 16
      top = 4
      bottom = H - 4
    } else if (wide) {
      Object.assign(moodBox.style, { left: `${W * 0.32}px`, top: `${H * 0.03}px`, width: `${W * 0.68}px` })
      sx0 = 0
      Object.assign(brand.style, { left: '0px', top: `${H - 46}px`, width: `${Math.min(320, W * 0.4)}px` })
      top = moodBox.offsetTop + moodBox.offsetHeight + 16
      bottom = H - 58
    } else {
      Object.assign(moodBox.style, { left: '0px', width: `${W}px`, top: '0px' })
      const mTop = H - 46 - moodBox.offsetHeight - 10
      moodBox.style.top = `${mTop}px`
      sx0 = 0
      Object.assign(brand.style, { left: '0px', top: `${H - 40}px`, width: `${W}px` })
      top = 0
      bottom = mTop - 12
    }
    const span = bottom - top
    sp = short ? clamp(H / 13, 11, 17) : wide ? clamp(span / 7.4, 9, 34) : clamp(span / 14, 9, 20)
    amp = wide && !short ? Math.min(H * 0.03, sp * 0.55) : sp * 0.3
    cy = bottom - 3 * sp - 4 - amp
    // on a very tall frame the stream rises a little, but stays low enough to anchor the picture
    const extra = span - (wide ? 17 : 22) * sp
    if (!short && extra > 0) cy -= extra * 0.14
    xp = sx0 + (sxLab - sx0) * (short ? 0.17 : 0.2)

    // the bamboo on the far bank, above the stream
    foot = yc(xp) - 3.45 * sp
    const L = clamp(Math.min(sp * 2.5, (foot - 4) * 0.3), 12, 66)
    bw = clamp(sp * 0.46, 4.5, 13)
    const len = Math.max(sp * 2.5, foot - 4 - L * 1.05)
    const dpr = Math.min(devicePixelRatio || 1, ctx.quality === 'low' ? 1.25 : 2)
    const make = (o: StemOpt) => {
      const lft = L * 1.7 + o.bw + Math.max(0, -o.bend * o.len)
      const rgt = L * 1.9 + o.bw + Math.max(0, o.bend * o.len)
      const up = o.len + L * 1.25
      return sprite(lft + rgt, up + 8, lft, up, dpr, (gg) => paintStem(gg, pal, o))
    }
    back = make({ len: len * 0.8, bw: bw * 0.72, bend: 0.07, seed: 3, tone: 0.34, L: L * 0.85, front: false })
    front = make({ len, bw, bend: -0.045, seed: 8, tone: 1, L, front: true })
    bank = sprite(sp * 6.4, sp * 1.6, sp * 2.6, sp * 1.1, dpr, (gg) => paintBank(gg, pal, sp, bw))
    // the far shore behind the bamboo, in every mood
    horizon = foot + sp * 0.3
    const skyTop = wide && !short ? moodBox.offsetTop + moodBox.offsetHeight + 10 : 0
    const hMax = clamp((horizon - skyTop) * 0.6, sp * 1.4, sp * 5.5)
    shore = sprite(W, hMax * 1.25 + 4, 0, hMax * 1.25 + 2, dpr, (gg) => (ridge = paintShore(gg, pal, sx0, sxFull, hMax)))
    skyClip = new Path2D()
    skyClip.moveTo(0, 0)
    skyClip.lineTo(W, 0)
    for (let x = W; x >= 0; x -= 6) skyClip.lineTo(x, horizon - (x >= sx0 - 8 ? ridge(x) : 0))
    skyClip.lineTo(0, horizon)
    skyClip.closePath()

    // the row labels sit beside the stave's end, each with a small brace
    const ye = yc(sxLab)
    placeBrace(melLab, svgM, braceM, ye - 2 * sp - 3, ye + sp + 3)
    placeBrace(harLab, svgH, braceH, ye + 1.3 * sp, ye + 2.6 * sp)

    keep = [moodBox, brand].map((el) => ({ x0: el.offsetLeft - 8, x1: el.offsetLeft + el.offsetWidth + 8, y0: el.offsetTop, y1: el.offsetTop + el.offsetHeight + 8 }))
    // only the height changed (the insight arrived below): the picture glides to its new place instead of jumping
    if (!ctx.reduced && was.W === W && was.cy !== cy) {
      view.dy += was.cy - cy
      ctx.anim(() => {
        gsap.to(view, { dy: 0, duration: 0.9, ease: 'power3.inOut', overwrite: true })
        glideEls.forEach((el, i) => el.offsetTop !== was.tops[i] && gsap.from(el, { top: was.tops[i], duration: 0.9, ease: 'power3.inOut' }))
      })
    }
    g = fitCanvas(cv, W, H, ctx.quality)
    if (ctx.reduced && mood >= 0) placeStatic()
    dirty = true
    draw(performance.now())
  }

  function spawnLoop(m: Mood, startX: number, now: number, dropAll: boolean) {
    const pb = m.ppb * sp
    let b = 0
    const r = rng(Math.round(startX) + mood * 97)
    const markAt = rights ? m.melody.findIndex(([, beats], i) => i > 1 && beats >= 2) : -1
    const add = (x: number, pos: number, beats: number, bass: boolean, mark: boolean) => {
      const sx = x - off
      const drop = dropAll && sx < sx1 + sp * 2
      notes.push({ x, pos, beats, bass, born: drop ? now + clamp((sx - xp) / Math.max(1, sx1 - xp)) * 1300 + r() * 120 : now, drop, landed: !drop, sung: 0, dead: 0, seed: r() * 10, mark })
    }
    m.melody.forEach(([pos, beats], i) => {
      add(startX + b * pb, pos, beats, false, i === markAt)
      b += beats
    })
    for (const [pos, at] of m.bass) add(startX + at * pb + pb * 0.3, pos, 4, true, false)
    return startX + LOOP * pb
  }

  function choose(i: number) {
    if (i === mood) return
    const now = performance.now()
    notes.forEach((n) => (n.dead ||= now))
    mood = i
    tried.add(i)
    if (tried.size > 1) rights = true
    moods.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)))
    petals.length = 0
    if (ctx.reduced) {
      sunA = i === 1 ? 1 : 0
      placeStatic()
      dirty = true
      draw(now)
      ctx.chime('soft')
      if (!firstSong) revealAll()
      else if (rights) showRights()
      return
    }
    nextLoop = spawnLoop(MOODS[i], off + xp + sp * 1.8, now, true)
    while (nextLoop - off < sx1 + pxBeat() * 6) nextLoop = spawnLoop(MOODS[i], nextLoop, now, true)
    if (MOODS[i].extra === 'petals') {
      const r = rng(5)
      for (let k = 0; k < 3; k++) petals.push({ x: off + sx0 + (sx1 - sx0) * (0.22 + k * 0.34 + r() * 0.08), y: [-3, 3, -3][k] + (r() - 0.5) * 0.15, a: r() * 6, s: 0.88 + r() * 0.3 })
    }
  }

  function placeStatic() {
    notes = []
    off = 0
    const m = MOODS[mood]
    let x = xp - LOOP * m.ppb * sp * 0.25
    while (x < sx1 + sp * 4) x = spawnLoop(m, x, 0, false)
    // the stone at the bamboo is the one singing
    let best: Note | null = null
    for (const n of notes) if (!n.bass && (!best || Math.abs(n.x - xp) < Math.abs(best.x - xp))) best = n
    if (best) best.sung = -1
  }

  function revealAll() {
    if (firstSong) return
    firstSong = true
    const show = () => {
      ctx.insight(S.insight, S.detail)
      if (ctx.reduced) {
        gsap.set([melLab, harLab, brand], { autoAlpha: 1 })
        st.ext = 1
        dirty = true
        draw(performance.now())
      } else
        ctx.anim(() => {
          gsap.to(st, { ext: 1, duration: 1.6, ease: 'power3.inOut' })
          gsap.fromTo([melLab, harLab, brand], { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 1.2, delay: 0.5, stagger: 0.2, ease: 'power3.out' })
        })
    }
    if (ctx.reduced) show()
    else tm.later(show, 700)
  }

  /** A second description: the music is borrowed from somewhere — one stone in each phrase carries a © seal. */
  function showRights() {
    if (rightsShown) return
    rightsShown = true
    ctx.insight(S.rightsInsight, S.rightsDetail)
  }

  function pluck(n: Note) {
    if (!prefs.sound || mood < 0) return
    try {
      ac ??= new AudioContext()
      if (ac.state === 'suspended') void ac.resume()
      const m = MOODS[mood]
      const t = ac.currentTime
      const o = ac.createOscillator()
      const gn = ac.createGain()
      o.type = m.wave
      o.frequency.value = m.hz[clamp(n.pos, 0, 8)] / (n.bass ? 2 : 1)
      const peak = n.bass ? 0.028 : 0.045
      gn.gain.setValueAtTime(0, t)
      gn.gain.linearRampToValueAtTime(peak, t + m.attack)
      gn.gain.exponentialRampToValueAtTime(0.0001, t + m.decay * (n.bass ? 1.4 : 1))
      o.connect(gn).connect(ac.destination)
      o.start(t)
      o.stop(t + m.decay * 1.4 + 0.05)
    } catch {
      ac = null
    }
  }

  const size = (n: Note) => {
    const rx = sp * (n.bass ? 0.95 : 0.5 + 0.1 * Math.min(n.beats, 4))
    return [rx, rx * (n.bass ? 0.5 : 0.62)]
  }

  function stone(gc: CanvasRenderingContext2D, n: Note, x: number, y: number, a: number, now: number) {
    const [rx, ry] = size(n)
    const rot = (n.seed - 5) * 0.03
    gc.globalAlpha = a
    // contact shadow in the gravel
    gc.fillStyle = pal.dark ? rgba(pal.paper, 0.7) : rgba(pal.ink, 0.14)
    gc.beginPath()
    gc.ellipse(x + rx * 0.12, y + ry * 0.5, rx * 1.08, ry * 0.62, rot, 0, Math.PI * 2)
    gc.fill()
    const gr = gc.createLinearGradient(x - rx * 0.6, y - ry, x + rx * 0.5, y + ry)
    if (pal.dark) {
      gr.addColorStop(0, n.bass || n.mark ? pal.stone2 : pal.stone)
      gr.addColorStop(1, pal.stone3)
    } else {
      gr.addColorStop(0, n.bass || n.mark ? pal.stone2 : pal.stone3)
      gr.addColorStop(1, n.bass || n.mark ? pal.stone : pal.stone2)
    }
    gc.fillStyle = gr
    gc.beginPath()
    gc.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2)
    gc.fill()
    // the dark lower rim, brushed
    gc.strokeStyle = pal.dark ? rgba(pal.paper, 0.75) : rgba(pal.ink, 0.32)
    gc.lineWidth = Math.max(1, rx * 0.07)
    gc.beginPath()
    gc.ellipse(x, y, rx, ry, rot, Math.PI * 0.08, Math.PI * 0.92)
    gc.stroke()
    // a soft light on top
    gc.fillStyle = pal.dark ? rgba(pal.ink, 0.14) : rgba(pal.card, 0.7)
    gc.beginPath()
    gc.ellipse(x - rx * 0.3, y - ry * 0.38, rx * 0.42, ry * 0.22, rot - 0.2, 0, Math.PI * 2)
    gc.fill()
    // a © seal pressed into the stone: this note was learned from someone's music
    if (n.mark) {
      const m = Math.min(rx * 0.85, ry * 1.15)
      gc.save()
      gc.translate(x + rx * 0.06, y + ry * 0.04)
      gc.rotate(rot - 0.06)
      gc.strokeStyle = rgba(pal.ink, pal.dark ? 0.7 : 0.62)
      gc.lineWidth = Math.max(1, m * 0.07)
      gc.strokeRect(-m * 0.62, -m * 0.62, m * 1.24, m * 1.24)
      gc.fillStyle = rgba(pal.ink, pal.dark ? 0.78 : 0.7)
      gc.font = `500 ${Math.max(9, m * 1.05)}px ${serif}`
      gc.textAlign = 'center'
      gc.textBaseline = 'middle'
      gc.fillText(S.mark, 0, m * 0.05)
      gc.restore()
    }
    // singing: the stone warms with the reader's vermilion
    const age = n.sung === -1 ? 0.3 : n.sung ? (now - n.sung) / 1000 : 9
    if (age < 1.4) {
      const k = 1 - age / 1.4
      gc.fillStyle = rgba(pal.verm, 0.32 * k)
      gc.beginPath()
      gc.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2)
      gc.fill()
      gc.strokeStyle = rgba(pal.verm, 0.75 * k)
      gc.lineWidth = 1.3
      gc.beginPath()
      gc.ellipse(x, y, rx + 3 + (1 - k) * sp * 0.9, ry + 2 + (1 - k) * sp * 0.55, rot, 0, Math.PI * 2)
      gc.stroke()
    }
    gc.globalAlpha = 1
  }

  /** The highest a raindrop may fall from at x: below the description chips and the brand. */
  const skyTop = (x: number, stop: number) => keep.reduce((t, k) => (x > k.x0 && x < k.x1 && k.y0 < stop ? Math.max(t, k.y1) : t), 0)

  function rain(gc: CanvasRenderingContext2D, clock: number) {
    const N = ctx.quality === 'low' ? 16 : 30
    const a = pal.dark ? 0.2 : 0.13
    gc.lineWidth = 1
    for (let k = 0; k < N; k++) {
      const fx = (k * 0.6180339) % 1
      const x = sx0 + 6 + fx * (sx1 - sx0 - 12)
      const len = H * (0.14 + 0.12 * ((k * 0.37) % 1))
      const speed = H * (0.75 + 0.25 * ((k * 0.53) % 1))
      const stop = yc(x) - 3.4 * sp
      const top = skyTop(x, stop)
      const head = ((k * 0.29 * H + clock * speed) % (stop + len)) - 0
      const y0 = Math.max(top, head - len)
      const y1 = Math.min(stop, head)
      if (y1 - y0 < 6) continue
      const gr = gc.createLinearGradient(0, head - len, 0, head)
      gr.addColorStop(0, rgba(pal.ink, 0))
      gr.addColorStop(1, rgba(pal.ink, a))
      gc.strokeStyle = gr
      gc.beginPath()
      gc.moveTo(x + (y0 - head) * 0.05, y0)
      gc.lineTo(x + (y1 - head) * 0.05, y1)
      gc.stroke()
    }
  }

  /** A flat wash disc low in the sky, its pigment pooling at the rim (the morning-sun description). */
  function sun(gc: CanvasRenderingContext2D, a: number) {
    const k0 = keep[0]
    const skyT = short ? 6 : wide ? k0.y1 : 6
    const x = sx0 + (sxLab - sx0) * (short ? 0.8 : 0.82)
    const ry = horizon - ridge(x)
    const R = clamp((ry - skyT) * 0.4, sp * 0.9, sp * 2.6)
    const y = Math.max(skyT + R + 4, ry - R * 0.4)
    if (skyClip) {
      gc.save()
      gc.clip(skyClip)
    }
    const col = pal.dark ? pal.ink : pal.verm // a pale moon-like disc at night
    if (pal.dark) {
      // at night the disc carries a faint halo, so it reads as light rather than a hole in the sky
      const halo = gc.createRadialGradient(x, y, R * 0.9, x, y, R * 2.4)
      halo.addColorStop(0, rgba(col, 0.07 * a))
      halo.addColorStop(1, rgba(col, 0))
      gc.fillStyle = halo
      gc.fillRect(x - R * 2.4, y - R * 2.4, R * 4.8, R * 4.8)
    }
    const dg = gc.createRadialGradient(x, y, 0, x, y, R)
    dg.addColorStop(0, rgba(col, (pal.dark ? 0.1 : 0.075) * a))
    dg.addColorStop(0.86, rgba(col, (pal.dark ? 0.12 : 0.095) * a))
    dg.addColorStop(0.97, rgba(col, (pal.dark ? 0.16 : 0.13) * a))
    dg.addColorStop(1, rgba(col, 0))
    gc.fillStyle = dg
    gc.beginPath()
    gc.arc(x, y, R, 0, Math.PI * 2)
    gc.fill()
    if (skyClip) gc.restore()
  }

  /** A plum blossom adrift: five round petals of pale wash, a few ink stamens. */
  function blossom(gc: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, a: number) {
    gc.save()
    gc.translate(x, y)
    gc.rotate(rot)
    gc.scale(1, 0.62)
    gc.globalAlpha = a
    const petal = (k: number) => {
      const t = (k / 5) * Math.PI * 2
      gc.moveTo(Math.cos(t) * r * 0.62 + r * 0.5, Math.sin(t) * r * 0.62)
      gc.arc(Math.cos(t) * r * 0.62, Math.sin(t) * r * 0.62, r * 0.5, 0, Math.PI * 2)
    }
    if (pal.dark) {
      // pale translucent petals on a night stream: where they overlap, the light gathers at the heart
      gc.fillStyle = rgba(pal.ink, 0.16)
      for (let k = 0; k < 5; k++) {
        gc.beginPath()
        petal(k)
        gc.fill()
      }
    } else {
      // a fine ink outline only where the petals meet the paper: stroke first, the opaque petals cover the inner arcs
      gc.beginPath()
      for (let k = 0; k < 5; k++) petal(k)
      gc.strokeStyle = rgba(pal.ink3, 0.55)
      gc.lineWidth = 1.4
      gc.stroke()
      gc.fillStyle = pal.vermSoft
      gc.fill()
    }
    gc.fillStyle = rgba(pal.ink, pal.dark ? 0.5 : 0.55)
    for (let k = 0; k < 5; k++) {
      const t = (k / 5) * Math.PI * 2 + 0.6
      gc.beginPath()
      gc.arc(Math.cos(t) * r * 0.28, Math.sin(t) * r * 0.28, Math.max(0.6, r * 0.07), 0, Math.PI * 2)
      gc.fill()
    }
    gc.restore()
    gc.globalAlpha = 1
  }

  function draw(now: number) {
    const gc = g
    if (!gc || !front || !back || !bank) return
    const clock = now / 1000
    const flow = ctx.reduced ? 0 : clock
    const live = !ctx.reduced && ctx.quality !== 'low'
    gc.clearRect(0, 0, W, H)
    setSx()
    gc.save()
    gc.translate(0, view.dy)

    if (shore) {
      gc.save()
      gc.translate(0, horizon)
      put(gc, shore)
      gc.restore()
    }
    if (sunA > 0.01) sun(gc, sunA)
    if (mood === 2) rain(gc, flow)

    // raked gravel: a dry stream. The five middle grooves are the stave.
    const step = Math.max(6, W / 120)
    for (let j = -3; j <= 3; j++) {
      const staff = Math.abs(j) <= 2
      const pts: Pt[] = []
      for (let x = sx0 - step; x <= sx1 + step; x += step) pts.push([x, yc(x) + j * sp + Math.sin(x * 0.028 + flow * 1.5 + j * 0.9) * sp * 0.06])
      gc.fillStyle = staff ? rgba(pal.ink, pal.dark ? 0.3 : 0.32) : rgba(pal.ink, pal.dark ? 0.11 : 0.12)
      gc.beginPath()
      ribbon(gc, pts, (i, t) => (staff ? 0.55 : 0.45) + 0.4 * Math.sin(i * 0.37 + j * 1.7 + t * 9) ** 2)
      gc.fill()
      // the groove's lit edge
      gc.fillStyle = pal.rakeHi
      gc.beginPath()
      ribbon(gc, pts.map(([x, y]) => [x, y + 1.6] as Pt), () => 0.45)
      gc.fill()
    }
    // the gravel fades into paper at both ends (only the gravel band: the far shore above keeps its own fade)
    gc.globalCompositeOperation = 'destination-out'
    const fw = (sx1 - sx0) * 0.08
    const by = cy - amp - 3.6 * sp
    const bh = 2 * (amp + 3.6 * sp)
    for (const [x0, x1] of [[sx0, sx0 + fw], [sx1, sx1 - fw]]) {
      const fg = gc.createLinearGradient(x0, 0, x1, 0)
      fg.addColorStop(0, 'rgba(0,0,0,1)')
      fg.addColorStop(1, 'rgba(0,0,0,0)')
      gc.fillStyle = fg
      gc.fillRect(Math.min(x0, x1), by, Math.abs(x1 - x0), bh)
    }
    gc.fillStyle = 'rgba(0,0,0,1)'
    gc.fillRect(0, by, sx0, bh)
    gc.fillRect(sx1, by, W - sx1, bh)
    gc.globalCompositeOperation = 'source-over'

    // the bamboo on the far bank; the stream passes in front of it
    gc.save()
    gc.translate(xp, foot)
    put(gc, bank)
    gc.save()
    gc.translate(bw * 2.7, -sp * 0.2)
    gc.rotate(live ? Math.sin(clock * 0.6 + 1.3) * 0.006 : 0)
    put(gc, back)
    gc.restore()
    gc.rotate(live ? Math.sin(clock * 0.7) * 0.006 + kick * Math.sin(clock * 7) * 0.016 : 0)
    put(gc, front)
    gc.restore()

    // stones: where each sits, the gravel is raked in rings around it
    const DROP = 650
    const vis: [Note, number, number, number, boolean][] = []
    const SW = sx1 - sx0
    for (const n of notes) {
      const sx = n.x - off
      if (sx < sx0 - sp * 3 || sx > sx1 + sp * 3) continue
      let y = yPos(sx, n.pos) + Math.sin(clock * 1.3 + n.seed) * sp * 0.03
      // stones dissolve before the stream's ends instead of being cut by them
      let a = clamp((sx - sx0 - sp) / (SW * 0.1)) * clamp((sx1 - sx - sp) / (SW * 0.06))
      let down = true
      if (n.dead) {
        const k = clamp((now - n.dead) / 700)
        a *= 1 - k
        y += k * sp * 0.6
        if (k >= 1) continue
      }
      if (n.drop && !n.landed) {
        const k = (now - n.born) / DROP
        if (k < 0) continue
        if (k >= 1) {
          n.landed = true
          rings.push({ x: sx, y, at: now, v: false, r: sp * 0.8 })
        } else {
          y -= (1 - k * k) * sp * 4
          a *= clamp(k * 3)
          down = false
        }
      }
      if (a > 0.01) vis.push([n, sx, y, a, down])
    }
    vis.sort((p, q) => Number(q[0].bass) - Number(p[0].bass))
    gc.globalCompositeOperation = 'destination-out'
    for (const [n, x, y, a, down] of vis) {
      if (!down) continue
      const [rx, ry] = size(n)
      gc.fillStyle = `rgba(0,0,0,${a})`
      gc.beginPath()
      gc.ellipse(x, y, rx + sp * (n.bass ? 0.85 : 0.26), ry + sp * (n.bass ? 0.6 : 0.2), 0, 0, Math.PI * 2)
      gc.fill()
    }
    gc.globalCompositeOperation = 'source-over'
    for (const [n, x, y, a, down] of vis) {
      if (!down || !n.bass) continue
      const [rx, ry] = size(n)
      for (const k of [0.32, 0.72]) {
        gc.lineWidth = 1.1
        gc.strokeStyle = rgba(pal.ink, (pal.dark ? 0.26 : 0.22) * a)
        gc.beginPath()
        gc.ellipse(x, y, rx + sp * k, ry + sp * k * 0.7, 0, 0, Math.PI * 2)
        gc.stroke()
        gc.strokeStyle = pal.rakeHi
        gc.globalAlpha = a
        gc.beginPath()
        gc.ellipse(x, y + 1.4, rx + sp * k, ry + sp * k * 0.7, 0, 0.15, Math.PI - 0.15)
        gc.stroke()
        gc.globalAlpha = 1
      }
    }
    for (const [n, x, y, a] of vis) stone(gc, n, x, y, a, now)
    // each © stone is tied by a thread of ink dots to the ghost of the real song it was learned from, upstream
    for (const [n, x, y, a, down] of vis) {
      if (!n.mark || !down) continue
      const [rx, ry] = size(n)
      const gx = x + sp * 1.3
      const gy = yc(gx) - 3.3 * sp
      const ga = a * clamp((x - xp - sp * 2) / (sp * 4))
      if (ga < 0.02) continue
      gc.globalAlpha = ga
      gc.lineWidth = 1.6
      gc.lineCap = 'round'
      gc.strokeStyle = rgba(pal.ink, pal.dark ? 0.5 : 0.42)
      gc.setLineDash([0.1, 4.5])
      gc.beginPath()
      gc.moveTo(x + rx * 0.25, y - ry * 0.95)
      gc.quadraticCurveTo(x + rx * 0.4, gy + ry * 0.2, gx - rx * 0.55, gy + ry * 0.6)
      gc.stroke()
      gc.lineWidth = 1
      gc.lineCap = 'butt'
      gc.setLineDash([3, 3.5])
      gc.fillStyle = rgba(pal.ink, pal.dark ? 0.06 : 0.05)
      gc.beginPath()
      gc.ellipse(gx, gy, rx, ry, -0.04, 0, Math.PI * 2)
      gc.fill()
      gc.stroke()
      gc.setLineDash([])
      gc.globalAlpha = 1
    }

    // rings: a stone landing, a note sounding, rain on the gravel
    if (mood === 2 && !ctx.reduced && now - rainAt > (live ? 150 : 320)) {
      rainAt = now
      const x = sx0 + sp + Math.random() * (sx1 - sx0 - sp * 2)
      rings.push({ x, y: yc(x) + (Math.random() * 6 - 3) * sp, at: now, v: false, r: sp * 0.2 })
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const rg = rings[i]
      const age = (now - rg.at) / 1000
      if (age > 1.6) {
        rings.splice(i, 1)
        continue
      }
      const k = age / 1.6
      gc.strokeStyle = rgba(rg.v ? pal.verm : pal.ink2, (1 - k) * (rg.v ? 0.6 : 0.3))
      gc.lineWidth = 1
      gc.beginPath()
      gc.ellipse(rg.x, rg.y, rg.r + k * sp * 1.6, (rg.r + k * sp * 1.6) * 0.32, 0, 0, Math.PI * 2)
      gc.stroke()
    }
    // plum blossoms drifting with the stream (morning mood)
    for (const p of petals) {
      let x = p.x - off * 1.06
      if (x < sx0 - 20) {
        p.x += sx1 - sx0 + 40
        x = p.x - off * 1.06
      }
      const y = yc(x) + p.y * sp + Math.sin(clock + p.a) * 2
      const fade = clamp((x - sx0) / ((sx1 - sx0) * 0.08)) * clamp((sx1 - x) / ((sx1 - sx0) * 0.06))
      blossom(gc, x, y, sp * 0.52 * p.s, p.a + flow * 0.25, fade)
    }
    gc.restore()
    dirty = false
  }

  const frame = () => {
    const now = performance.now()
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    if (ctx.reduced) return
    if (mood >= 0) {
      const m = MOODS[mood]
      off += m.bps * m.ppb * sp * dt
      // stones crossing the bamboo sing
      for (const n of notes) {
        if (n.sung || n.dead || !n.landed) continue
        if (n.x - off <= xp) {
          n.sung = now
          kick = 1
          pluck(n)
          if (!n.bass) rings.push({ x: xp, y: yPos(xp, n.pos), at: now, v: true, r: sp * 0.5 })
          if (!firstSong) revealAll()
          else if (n.mark) showRights()
        }
      }
      if (nextLoop - off < sx1 + pxBeat() * 6) nextLoop = spawnLoop(m, nextLoop, now, false)
      notes = notes.filter((n) => n.x - off > sx0 - sp * 4 && !(n.dead && now - n.dead > 800))
    } else if (ctx.quality === 'low' && !dirty && !view.dy) return
    kick *= Math.exp(-dt * 2.2)
    sunA += ((mood === 1 ? 1 : 0) - sunA) * Math.min(1, dt * 1.2)
    draw(now)
  }

  gsap.set([melLab, harLab, brand], { autoAlpha: 0 })
  if (!ctx.reduced) gsap.from(moods, { y: 10, opacity: 0, duration: 1.1, stagger: 0.14, delay: 0.5, ease: 'power3.out' })

  let raf = 0
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(layout)
  })
  ro.observe(root)
  layout()
  const unTheme = watchTheme(() => {
    pal = palette()
    serif = cssVar('--serif')
    layout()
  })
  gsap.ticker.add(frame)

  return () => {
    gsap.ticker.remove(frame)
    ro.disconnect()
    cancelAnimationFrame(raf)
    unTheme()
    tm.clear()
    void ac?.close().catch(() => {})
  }
}
