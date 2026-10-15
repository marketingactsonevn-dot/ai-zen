// Garden stones painted on a canvas in ink (sumi-e) and used as billboards in the 3D garden.
// The body is shaded per pixel from a soft height field (light from the upper left), then washed,
// grained and speckled; a tapered brush contour, a contact shadow and an optional moss cushion finish it.
import { cssVar, prefs } from '../../core/prefs'
import { rng, type Pt } from './brush'

export interface StoneShape {
  seed: number
  /** heights of the top edge from left to right (fractions of the half-width) */
  profile: number[]
  /** moss cushion: where on the top (−1 left … 1 right) and how big; omit for a bare stone */
  moss?: [at: number, size: number]
}

/** Colours for one theme: rice paper at dawn, or moonlight. ramp = shadow → body → light; moss = shade → body → lit tips. */
export interface StoneInk {
  ramp: [string, string, string]
  /** > 1 narrows the light to the upper-left planes (moonlight) */
  gamma: number
  edge: string
  edgeA: number
  rim: string
  rimA: number
  shadow: string
  shadowA: number
  moss: [dark: string, mid: string, light: string]
}

export const STONE_W = 512
export const STONE_H = 320
/** half-width of the painted stone, in canvas px */
export const STONE_A = 168
/** the stone's centre on the sand (the billboard's anchor), in canvas px */
export const STONE_BASE: Pt = [214, 200]
/** the front of the footprint lies this far below the base line (fraction of the half-width) */
const FOOT = 0.36

/** The current theme's stone colours, from the design tokens: ink wash at dawn, moonlit stone at night. */
export function themeInk(): StoneInk {
  const v = cssVar
  return prefs.theme === 'dark'
    ? { ramp: [v('--umbra'), v('--rock-lo'), v('--rock-hi')], gamma: 2.1, edge: v('--umbra'), edgeA: 0.8, rim: v('--rock-hi'), rimA: 0.6, shadow: v('--umbra'), shadowA: 0.6, moss: [v('--moss-soft'), v('--moss-b'), v('--moss-a')] }
    : { ramp: [v('--umbra'), v('--stone'), v('--stone-2')], gamma: 1.4, edge: v('--ink'), edgeA: 0.9, rim: v('--paper'), rimA: 0, shadow: v('--umbra'), shadowA: 0.22, moss: [v('--moss-b'), v('--moss-a'), v('--moss-c')] }
}

let probe: CanvasRenderingContext2D | null = null
/** Any CSS colour → [r, g, b] (0–255). */
function rgb(c: string): [number, number, number] {
  probe ??= document.createElement('canvas').getContext('2d')
  if (!probe) return [128, 128, 128]
  probe.fillStyle = '#808080'
  probe.fillStyle = c
  const v = String(probe.fillStyle)
  if (v.startsWith('#')) return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16)) as [number, number, number]
  const m = v.match(/[\d.]+/g) ?? ['128', '128', '128']
  return [+m[0], +m[1], +m[2]]
}
const rgba = (c: string, a: number) => `rgba(${rgb(c).join(',')},${Math.max(0, Math.min(1, a)).toFixed(3)})`

/** Smooth 2D value noise in 0..1. */
function noise2(seed: number) {
  const hash = (x: number, y: number) => {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 982451653)) | 0
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296
  }
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y)
    const xf = x - xi, yf = y - yi
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
  }
}

/** Gaussian-like blur of a float field (three box passes each way) — float, so no 8-bit terracing. Yields per row/column. */
function* blurField(src: Float32Array, W: number, H: number, sigma: number): Generator<void, Float32Array> {
  const a = src.slice()
  const b = new Float32Array(W * H)
  const R = Math.max(1, Math.round(sigma))
  const n = 2 * R + 1
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < H; y++) {
      const row = y * W
      let acc = 0
      for (let x = -R; x <= R; x++) acc += a[row + Math.min(W - 1, Math.max(0, x))]
      for (let x = 0; x < W; x++) {
        b[row + x] = acc / n
        acc += a[row + Math.min(W - 1, x + R + 1)] - a[row + Math.max(0, x - R)]
      }
      yield
    }
    for (let x = 0; x < W; x++) {
      let acc = 0
      for (let y = -R; y <= R; y++) acc += b[Math.min(H - 1, Math.max(0, y)) * W + x]
      for (let y = 0; y < H; y++) {
        a[y * W + x] = acc / n
        acc += b[Math.min(H - 1, y + R + 1) * W + x] - b[Math.max(0, y - R) * W + x]
      }
      yield
    }
  }
  return a
}

/** Smooth closed path through points (quadratic curves between midpoints). */
function closed(pts: Pt[]): Path2D {
  const p = new Path2D()
  const n = pts.length
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const m0 = mid(pts[n - 1], pts[0])
  p.moveTo(m0[0], m0[1])
  for (let i = 0; i < n; i++) {
    const m = mid(pts[i], pts[(i + 1) % n])
    p.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1])
  }
  p.closePath()
  return p
}

/**
 * Paint one stone into `cv` (STONE_W × STONE_H times `scale`, transparent outside the stone and its shadow).
 * A generator that yields between rows (~0.1 ms steps): run it with sliced() so a scene can mount without a long task.
 */
export function* paintStoneSteps(cv: HTMLCanvasElement, sh: StoneShape, ink: StoneInk, scale = 1): Generator<void, void> {
  const W = Math.round(STONE_W * scale), H = Math.round(STONE_H * scale)
  cv.width = W
  cv.height = H
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  if (!ctx) return
  ctx.clearRect(0, 0, W, H)
  yield
  const A = STONE_A * scale
  const [cx, by] = [STONE_BASE[0] * scale, STONE_BASE[1] * scale]
  const bot = A * FOOT
  const r = rng(sh.seed)
  const vn = noise2(sh.seed)
  const fbm = (x: number, y: number) => 0.65 * vn(x, y) + 0.35 * vn(x * 2.3 + 17, y * 2.3 + 5)
  const L = [-0.62, -0.55, 0.58] // light from the upper left and a little in front (x right, y down, z out)
  const Ll = Math.hypot(L[0], L[1], L[2])
  const lx = L[0] / Ll, ly = L[1] / Ll, lz = L[2] / Ll

  // ── Silhouette: the top edge follows the profile (with small bumps), the bottom is the front of the footprint.
  const prof = sh.profile
  const height = (u: number) => {
    const t = ((u + 1) / 2) * (prof.length - 1)
    const i = Math.min(prof.length - 2, Math.floor(t))
    const f = t - i
    const e = (1 - Math.cos(f * Math.PI)) / 2
    return prof[i] + (prof[i + 1] - prof[i]) * e
  }
  const ph = [r() * 6.3, r() * 6.3, r() * 6.3]
  const pts: Pt[] = []
  const NT = 72, NB = 36
  for (let i = 0; i <= NT; i++) {
    const u = 1 - (2 * i) / NT // right → left over the top
    const bump = 1 + 0.035 * Math.sin(7 * u + ph[0]) + 0.018 * Math.sin(16 * u + ph[1]) + 0.008 * Math.sin(37 * u + ph[2])
    pts.push([cx + u * A * (1 + 0.012 * Math.sin(5 * u + ph[2])), by - A * height(u) * bump])
  }
  for (let i = 1; i < NB; i++) {
    const u = -1 + (2 * i) / NB // left → right along the front of the footprint
    pts.push([cx + u * A, by + bot * Math.sqrt(1 - u * u) * (1 + 0.03 * Math.sin(5 * u + ph[0]))])
  }
  const N = pts.length
  const body = closed(pts)

  // ── Cast shadow on the sand, away from the light.
  ctx.save()
  ctx.filter = `blur(${(A * 0.09).toFixed(1)}px)`
  ctx.fillStyle = rgba(ink.shadow, ink.shadowA)
  ctx.beginPath()
  ctx.ellipse(cx + A * 0.4, by + bot * 0.55, A * 1.1, bot * 0.7, -0.04, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  yield

  // ── Body, shaded per pixel: soft dome from the distance to the edge, gentle weathering, washes and grain.
  const off = document.createElement('canvas')
  off.width = W
  off.height = H
  const octx = off.getContext('2d', { willReadFrequently: true })
  if (!octx) return
  octx.fillStyle = '#fff'
  octx.fill(body)
  yield
  const img = octx.getImageData(0, 0, W, H)
  const px = img.data
  // height field: the silhouette blurred at two scales (a soft dome with rounded edges), rising toward the
  // front face so the upper surface tilts up into the light; weathering bumps fade out toward the rim
  const mask = new Float32Array(W * H)
  for (let i = 0; i < W * H; i++) mask[i] = px[i * 4 + 3] / 255
  yield
  const b1 = yield* blurField(mask, W, H, A * 0.2), b2 = yield* blurField(mask, W, H, A * 0.04)
  const yTop = by - A * Math.max(...prof)
  const Hf = new Float32Array(W * H)
  const s1 = 1 / (A * 0.5), s2 = 1 / (A * 0.2)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      const m = 0.6 * b1[i] + 0.4 * b2[i]
      const f = Math.max(0, Math.min(1, (y - yTop) / (by + bot - yTop)))
      const ramp = 0.72 + 0.28 * f * f * (3 - 2 * f)
      const wv = (fbm(x * s1, y * s1) - 0.5) * 0.14 + (vn(x * s2 + 40, y * s2) - 0.5) * 0.04
      Hf[i] = A * 1.5 * (m * ramp + wv * m * m)
    }
    yield
  }
  const [c0, c1, c2] = ink.ramp.map(rgb)
  const sb = 1 / (A * 0.3)
  const sc = 1 / (A * 0.06)
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x
      const a = px[i * 4 + 3]
      if (!a) continue
      const dx = (Hf[i + 1] - Hf[i - 1]) / 2
      const dy = (Hf[i + W] - Hf[i - W]) / 2
      const nl = Math.hypot(dx, dy, 1)
      let t = Math.max(0, (-dx * lx - dy * ly + lz) / nl)
      t = Math.pow(t, ink.gamma)
      // grounded: the foot sinks into shadow; the far shaded side is darker still
      const yw = y + (fbm(x * sb + 3, y * sb * 0.6) - 0.5) * A * 0.22 // the wash's upper edge is ragged, not ruled
      const foot = Math.min(1, Math.max(0, (yw - (by - A * 0.2)) / (A * 0.2 + bot)))
      t *= 1 - 0.3 * foot * foot
      // the whole right side turns away from the light
      t -= 0.14 * (x - cx) / A
      // ink washes: soft blooms of darker and paler pigment
      t += (fbm(x * sb + 9, y * sb) - 0.5) * 0.14
      // wet edge: pigment pools along the shaded rim
      const rim = Math.max(0, Math.min(1, (0.85 - b2[i]) * 3))
      const side = Math.max(0, Math.min(1, 0.5 + ((x - cx) * 0.6 + (y - by) * 0.8) / A))
      t -= rim * side * 0.28
      // dry-brush texture strokes (cun), slanting down the shaded planes, broken where the brush ran dry
      const su = (x * 0.5 + y * 0.866) * sc
      const sv = (-x * 0.866 + y * 0.5) * sc + (fbm(x * sb, y * sb + 21) - 0.5) * 2.5 // gently wavering strokes
      const dry = vn(su * 0.16 + 5, sv * 2.2) * vn(su * 0.45, sv * 0.45 + 9)
      t -= Math.max(0, Math.min(1, (dry - 0.38) * 5)) * Math.max(0, 0.6 - t) * 0.7
      // stone grain and a sparse speckle
      t += (r() - 0.5) * 0.06
      const sp = r()
      if (sp < 0.018) t -= 0.12 + r() * 0.1
      else if (sp > 0.992) t += 0.1
      t = Math.max(0, Math.min(1, t))
      const [p, q, k] = t < 0.5 ? [c0, c1, t * 2] : [c1, c2, (t - 0.5) * 2]
      px[i * 4] = p[0] + (q[0] - p[0]) * k
      px[i * 4 + 1] = p[1] + (q[1] - p[1]) * k
      px[i * 4 + 2] = p[2] + (q[2] - p[2]) * k
    }
    yield
  }
  octx.putImageData(img, 0, 0)
  yield
  // a tight contact shadow where the stone meets the sand (drawn under the body; only its lower right shows)
  ctx.save()
  ctx.filter = `blur(${(A * 0.03).toFixed(1)}px)`
  ctx.fillStyle = rgba(ink.shadow, Math.min(0.9, ink.shadowA * 2.4))
  ctx.beginPath()
  ctx.ellipse(cx + A * 0.07, by + bot * 0.32, A * 1.0, bot * 0.82, -0.03, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  ctx.drawImage(off, 0, 0)
  yield

  // ── Contour: one tapered brush line, heavy on the shaded side, thin and broken where the light falls.
  const shade = pts.map((_, i) => {
    const a = pts[(i + N - 1) % N], b = pts[(i + 1) % N]
    const tx = b[0] - a[0], ty = b[1] - a[1]
    const len = Math.hypot(tx, ty) || 1
    return (1 - ((-ty / len) * lx + (tx / len) * ly) / Math.hypot(lx, ly)) / 2 // 0 lit … 1 shaded
  })
  const ribbon = (color: string, alpha: number, width: (s: number) => number, gap: (s: number) => number) => {
    ctx.fillStyle = rgba(color, alpha)
    const draw = (run: number[]) => {
      if (run.length < 3) return
      const outer: Pt[] = [], inner: Pt[] = []
      run.forEach((i, j) => {
        const p = pts[i % N], q = pts[(i + 1) % N], o = pts[(i + N - 1) % N]
        const tx = q[0] - o[0], ty = q[1] - o[1]
        const len = Math.hypot(tx, ty) || 1
        const nx = -ty / len, ny = tx / len
        const taper = Math.min(1, (Math.min(j, run.length - 1 - j) + 0.5) / 4)
        const w = width(shade[i % N]) * taper * (0.8 + 0.4 * vn(i * 0.35, 3))
        outer.push([p[0] + nx * w * 0.25, p[1] + ny * w * 0.25])
        inner.push([p[0] - nx * w * 0.75, p[1] - ny * w * 0.75])
      })
      ctx.beginPath()
      ;[...outer, ...inner.reverse()].forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
      ctx.closePath()
      ctx.fill()
    }
    let run: number[] = []
    for (let i = 0; i <= N; i++) {
      if (i < N && r() < gap(shade[i])) {
        draw(run)
        run = []
        i += 1 + Math.floor(r() * 3)
        continue
      }
      run.push(i)
    }
    draw(run)
  }
  ribbon(ink.edge, ink.edgeA, (s) => A * (0.006 + 0.03 * Math.pow(s, 1.6)), (s) => (s < 0.4 ? 0.14 : 0.006))
  if (ink.rimA > 0) ribbon(ink.rim, ink.rimA, (s) => A * 0.022 * Math.max(0, 1 - s * 2.6), (s) => (s < 0.36 ? 0.04 : 1))
  yield

  // ── Moss: a soft cushion lying on the top surface (seen from above), with its soft shadow.
  if (sh.moss) {
    const [at, size] = sh.moss
    const upper = pts.slice(0, NT + 1) // right → left
    const topY = (x: number) => {
      for (let i = 1; i < upper.length; i++) {
        const [x0, y0] = upper[i - 1], [x1, y1] = upper[i]
        if ((x - x0) * (x - x1) <= 0) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1)
      }
      return by
    }
    const mx = cx + at * A, mw = A * 0.42 * size
    const hump = A * 0.045 * size
    const drape = A * 0.2 * size
    const edgeTop = (u: number, j: number) => topY(mx + u * mw) - hump * Math.pow(1 - u * u, 0.6) * (0.6 + 0.4 * vn(j * 0.9, 7))
    const edgeBot = (u: number, j: number) => topY(mx + u * mw) + drape * Math.pow(1 - u * u, 0.9) * (0.65 + 0.35 * vn(j * 0.6, 11))
    const [mDark, mMid, mLight] = ink.moss
    // its shadow on the stone, toward the lower right
    ctx.save()
    ctx.clip(body)
    ctx.filter = `blur(${(A * 0.03).toFixed(1)}px)`
    ctx.fillStyle = rgba(ink.ramp[0], 0.45)
    ctx.beginPath()
    for (let j = 0; j <= 24; j++) {
      const u = -1 + (2 * j) / 24
      ctx.lineTo(mx + u * mw + A * 0.03, edgeBot(u, j) + A * 0.03)
    }
    for (let j = 24; j >= 0; j--) ctx.lineTo(mx + (-1 + (2 * j) / 24) * mw, topY(mx + (-1 + (2 * j) / 24) * mw))
    ctx.closePath()
    ctx.fill()
    ctx.restore()
    yield
    // one soft mass underneath, so the dabs read as a cushion and not as beads
    ctx.save()
    ctx.filter = `blur(${(A * 0.01).toFixed(1)}px)`
    ctx.fillStyle = rgba(mDark, 0.96)
    ctx.beginPath()
    for (let j = 0; j <= 24; j++) {
      const u = -1 + (2 * j) / 24
      ctx.lineTo(mx + u * mw, edgeTop(u, j))
    }
    for (let j = 24; j >= 0; j--) {
      const u = -1 + (2 * j) / 24
      ctx.lineTo(mx + u * mw, edgeBot(u, j))
    }
    ctx.closePath()
    ctx.fill()
    ctx.restore()
    // dabs: greens lit from the upper left, the palest at the cushion's upper-left crown
    const n = Math.round(420 * size)
    for (let i = 0; i < n; i++) {
      const u = (r() * 2 - 1) * 0.94
      const j = ((u + 1) / 2) * 24
      const v = r() // 0 = upper edge … 1 = lower edge
      const y0 = edgeTop(u, j), y1 = edgeBot(u, j)
      const y = y0 + (y1 - y0) * v * 0.92 + A * 0.006
      const lit = (1 - v) * 0.8 + (-u * 0.25) + (r() - 0.5) * 0.25
      ctx.fillStyle = lit > 0.62 ? rgba(mLight, 0.92) : lit > 0.22 ? rgba(mMid, 0.88) : rgba(mDark, 0.8)
      const rad = A * (0.007 + r() * 0.011)
      ctx.beginPath()
      ctx.ellipse(mx + u * mw, y, rad * 1.35, rad, 0, 0, Math.PI * 2)
      ctx.fill()
      if (i % 32 === 31) yield
    }
  }
}
