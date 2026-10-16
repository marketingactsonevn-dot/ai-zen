import { h } from '../../core/dom'
import { L } from '../../core/content'
import { stroke, type Pt } from '../../ui/part2/ink'
import { findTakeaway, takeaway } from '../../ui/part2/takeaway'

/**
 * Station 32 kit: a small painter for canvas scenes in true perspective (a pinhole camera over garden metres, y up), ink
 * colours read from the Part 2 tokens, a paper-grain tile, brushed strokes as Path2D, and two DOM helpers (live region,
 * take-away sheet). Frame code uses the zero-allocation paths (cam.p → cam.o, moveTo/lineTo); bake code may allocate.
 */

export type RGB = [number, number, number]
export type V3 = [number, number, number]

const TOKENS = ['paper', 'paper-2', 'card', 'ink', 'ink-2', 'ink-3', 'wash', 'umbra', 'rock-hi', 'rock-mid', 'rock-lo', 'step-hi', 'step-mid', 'step-lo', 'moss', 'moss-a', 'moss-b', 'moss-c', 'water', 'mist', 'moon', 'lantern', 'vermilion'] as const
export type Tok = (typeof TOKENS)[number]
export type Pal = Record<Tok, RGB> & { mistA: number; dark: boolean; key: string }

function parse(c: string): RGB {
  const t = c.trim()
  if (t[0] === '#') {
    const x = t.length === 4 ? t.slice(1).split('').map((d) => d + d).join('') : t.slice(1, 7)
    return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16)]
  }
  const m = t.match(/[\d.]+/g)
  return m ? [+m[0], +m[1], +m[2]] : [128, 128, 128]
}

/** The Part 2 tokens as numbers (read on mount and in onPrefs, never in a frame). `key` changes when any colour does. */
export function palette(): Pal {
  const cs = getComputedStyle(document.documentElement)
  const p = {} as Pal
  let key = ''
  for (const t of TOKENS) {
    const v = cs.getPropertyValue(`--${t}`)
    key += v
    p[t] = parse(v)
  }
  p.mistA = parseFloat(cs.getPropertyValue('--mist-a')) || 0.5
  p.dark = document.documentElement.dataset.theme === 'dark'
  p.key = key + p.dark
  return p
}

export const rgba = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`
export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
export const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2) // power2.inOut
export const easeOut = (t: number) => 1 - (1 - t) ** 3

/** Size a canvas to W × H css px at a capped device pixel ratio; returns its 2D context in css-px units. */
export function fit(cv: HTMLCanvasElement, W: number, H: number, low: boolean): CanvasRenderingContext2D {
  const dpr = Math.min(devicePixelRatio || 1, low ? 1 : 1.5)
  const w = Math.max(1, Math.round(W * dpr)), hh = Math.max(1, Math.round(H * dpr))
  if (cv.width !== w || cv.height !== hh) {
    cv.width = w
    cv.height = hh
  }
  cv.style.width = `${W}px`
  cv.style.height = `${H}px`
  const c = cv.getContext('2d')!
  c.setTransform(dpr, 0, 0, dpr, 0, 0)
  return c
}

let tile: HTMLCanvasElement | null = null
/** A 128² paper/ink grain tile (alpha noise, built once per module): pattern it over a painted surface. */
export function grain(): HTMLCanvasElement {
  if (tile) return tile
  tile = document.createElement('canvas')
  tile.width = tile.height = 128
  const c = tile.getContext('2d')!
  const img = c.createImageData(128, 128)
  let s = 7
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 128 * 128; i++) {
    const y = (i / 128) | 0
    // fine speckle plus faint fibres running across
    const v = r() * 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(y * 0.9 + Math.sin(i * 0.013) * 3))
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 0
    img.data[i * 4 + 3] = (v * v * 70) | 0
  }
  c.putImageData(img, 0, 0)
  return tile
}

/** A soft radial sprite (64², `col` at alpha stops [offset, alpha]): drawn scaled with drawImage, no gradient per frame. */
export function radial(col: RGB, stops: [number, number][]): HTMLCanvasElement {
  const e = document.createElement('canvas')
  e.width = e.height = 64
  const c = e.getContext('2d')!
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32)
  for (const [o, a] of stops) g.addColorStop(o, rgba(col, a))
  c.fillStyle = g
  c.fillRect(0, 0, 64, 64)
  return e
}

/** A pinhole camera: p(x, y, z) writes screen x, y and depth into `o` (no allocation) and returns the depth (> 0 in front). */
export interface Cam {
  readonly W: number
  readonly H: number
  readonly f: number
  readonly eye: V3
  readonly o: Float64Array
  p(x: number, y: number, z: number): number
  /** allocating version for bake code */
  pt(x: number, y: number, z: number): Pt
  /** the point on the plane y = h under screen point (sx, sy), into `o` (x, z); false if the ray misses it */
  floor(sx: number, sy: number, h: number): boolean
  /** projected size of a length `len` at depth d */
  k(d: number): number
}

export function camera(eye: V3, at: V3, fovY: number, W: number, H: number, sx = 0, sy = 0): Cam {
  let bx = eye[0] - at[0], by = eye[1] - at[1], bz = eye[2] - at[2]
  let l = Math.hypot(bx, by, bz)
  bx /= l; by /= l; bz /= l
  // right = up × back, with world up (0, 1, 0)
  let rx = bz, rz = -bx
  l = Math.hypot(rx, rz) || 1
  rx /= l; rz /= l
  const ux = by * rz - bz * 0, uy = bz * rx - bx * rz, uz = bx * 0 - by * rx
  const f = H / 2 / Math.tan((fovY * Math.PI) / 360)
  const cx = W / 2 + sx, cy = H / 2 + sy
  const o = new Float64Array(3)
  const cam: Cam = {
    W, H, f, eye, o,
    p(x, y, z) {
      const dx = x - eye[0], dy = y - eye[1], dz = z - eye[2]
      const X = dx * rx + dz * rz
      const Y = dx * ux + dy * uy + dz * uz
      const Z = -(dx * bx + dy * by + dz * bz)
      const d = Math.max(1e-3, Z)
      o[0] = cx + (f * X) / d
      o[1] = cy - (f * Y) / d
      o[2] = Z
      return Z
    },
    pt(x, y, z) {
      cam.p(x, y, z)
      return [o[0], o[1]]
    },
    floor(px, py, hgt) {
      const X = (px - cx) / f, Y = -(py - cy) / f
      // ray direction in world: X·right + Y·up − back
      const wx = X * rx + Y * ux - bx, wy = Y * uy - by, wz = X * rz + Y * uz - bz
      if (Math.abs(wy) < 1e-6) return false
      const t = (hgt - eye[1]) / wy
      if (t <= 0) return false
      o[0] = eye[0] + wx * t
      o[1] = hgt
      o[2] = eye[2] + wz * t
      return true
    },
    k: (d) => f / Math.max(1e-3, d),
  }
  return cam
}

/**
 * A camera looking along (yaw, pitch) in degrees, pulled back until every point of `box` fits the screen rect
 * [x0, y0, x1, y1] (css px), then lens-shifted so the box sits centred in it. Bake-time only.
 */
export function fitCamera(o: { yaw: number; pitch: number; fov: number; W: number; H: number; box: V3[]; rect: [number, number, number, number] }): Cam {
  const n = o.box.length
  const at: V3 = [0, 0, 0]
  for (const p of o.box) for (let i = 0; i < 3; i++) at[i] += p[i] / n
  const yw = (o.yaw * Math.PI) / 180, pt = (o.pitch * Math.PI) / 180
  const dir: V3 = [Math.sin(yw) * Math.cos(pt), Math.sin(pt), Math.cos(yw) * Math.cos(pt)]
  const rw = o.rect[2] - o.rect[0], rh = o.rect[3] - o.rect[1]
  const span = (d: number) => {
    const c = camera([at[0] + dir[0] * d, at[1] + dir[1] * d, at[2] + dir[2] * d], at, o.fov, o.W, o.H)
    let a = Infinity, b = Infinity, A = -Infinity, B = -Infinity
    for (const p of o.box) {
      c.p(p[0], p[1], p[2])
      a = Math.min(a, c.o[0]); b = Math.min(b, c.o[1]); A = Math.max(A, c.o[0]); B = Math.max(B, c.o[1])
    }
    return { c, a, b, A, B }
  }
  let lo = 0.5, hi = 200
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2
    const s = span(m)
    if (s.A - s.a <= rw && s.B - s.b <= rh) hi = m
    else lo = m
  }
  const s = span(hi)
  const eye: V3 = [at[0] + dir[0] * hi, at[1] + dir[1] * hi, at[2] + dir[2] * hi]
  return camera(eye, at, o.fov, o.W, o.H, (o.rect[0] + o.rect[2]) / 2 - (s.a + s.A) / 2, (o.rect[1] + o.rect[3]) / 2 - (s.b + s.B) / 2)
}

/** A tapered brush stroke (ink.ts `stroke`) as a canvas path. Bake-time (it allocates). */
export const brush = (pts: Pt[], w: number, a = 0.15, b = 0.35, min = 0.2) => new Path2D(stroke(pts, w, a, b, min))

/** Trace a polygon of world points through the camera (moveTo/lineTo, no allocation of its own beyond `pts`). */
export function poly(c: CanvasRenderingContext2D, cam: Cam, pts: readonly V3[]) {
  c.beginPath()
  for (let i = 0; i < pts.length; i++) {
    cam.p(pts[i][0], pts[i][1], pts[i][2])
    if (i) c.lineTo(cam.o[0], cam.o[1])
    else c.moveTo(cam.o[0], cam.o[1])
  }
  c.closePath()
}

/** poly() for big planes (walls, floor) that may reach behind the camera: clipped to a near plane first. Bake-time. */
export function polyClip(c: CanvasRenderingContext2D, cam: Cam, pts: readonly V3[], near = 0.3) {
  const out: V3[] = []
  const dz = (p: readonly number[]) => cam.p(p[0], p[1], p[2]) - near
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length]
    const da = dz(a), db = dz(b)
    if (da >= 0) out.push([a[0], a[1], a[2]])
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db)
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t])
    }
  }
  if (out.length < 3) {
    c.beginPath()
    return
  }
  poly(c, cam, out)
}

/** Trace an ellipse lying on the plane y = h (centre x, z, radii rx, rz) through the camera. */
export function flatEllipse(c: CanvasRenderingContext2D, cam: Cam, x: number, h: number, z: number, rx: number, rz: number, n = 28) {
  c.beginPath()
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2
    cam.p(x + Math.cos(a) * rx, h, z + Math.sin(a) * rz)
    if (i) c.lineTo(cam.o[0], cam.o[1])
    else c.moveTo(cam.o[0], cam.o[1])
  }
  c.closePath()
}

/** A radial sprite laid flat on the plane y = h (centre x, z, radii rx, rz): an affine map of its square, no banding. */
export function flatSprite(c: CanvasRenderingContext2D, cam: Cam, x: number, h: number, z: number, rx: number, rz: number, sp: CanvasImageSource, a: number, dpr: number) {
  cam.p(x, h, z)
  const cx = cam.o[0], cy = cam.o[1]
  cam.p(x + rx, h, z)
  const ax = cam.o[0] - cx, ay = cam.o[1] - cy
  cam.p(x, h, z + rz)
  const bx = cam.o[0] - cx, by = cam.o[1] - cy
  c.save()
  c.globalAlpha = a
  c.setTransform(dpr * ax, dpr * ay, dpr * bx, dpr * by, dpr * cx, dpr * cy)
  c.drawImage(sp, -1, -1, 2, 2)
  c.restore()
}

/** A soft wash: concentric fills of an ellipse on y = h fading out (contact shadows, light pools). */
export function softPool(c: CanvasRenderingContext2D, cam: Cam, x: number, h: number, z: number, rx: number, rz: number, col: string, a: number, rings = 6) {
  c.fillStyle = col
  for (let i = rings; i >= 1; i--) {
    const k = i / rings
    c.globalAlpha = (a / rings) * 1.6
    flatEllipse(c, cam, x, h, z, rx * (0.35 + k * 0.65), rz * (0.35 + k * 0.65), 22)
    c.fill()
  }
  c.globalAlpha = 1
}

/** Pattern the grain tile over what is painted (inside the current clip), at alpha a. */
export function grainOver(c: CanvasRenderingContext2D, W: number, H: number, a: number, op: GlobalCompositeOperation = 'source-over') {
  const pat = c.createPattern(grain(), 'repeat')
  if (!pat) return
  c.save()
  c.globalAlpha = a
  c.globalCompositeOperation = op
  c.fillStyle = pat
  c.fillRect(0, 0, W, H)
  c.restore()
}

/** A polite live region that is only made live after its first fill (so entering the scene is not read twice). */
export function live(cls: string): HTMLElement & { say(...kids: (Node | string)[]): void } {
  const el = h('div', { class: cls }) as unknown as HTMLElement & { say(...kids: (Node | string)[]): void }
  el.say = (...kids) => {
    el.replaceChildren(...kids)
    if (!el.hasAttribute('aria-live')) el.setAttribute('aria-live', 'polite')
  }
  return el
}

/** The take-away card behind a pill: the pill appears on `show()`, the card opens over the art as a sheet. */
export function cardSheet(root: HTMLElement, id: string, onCleanup?: (fn: () => void) => void) {
  const card = findTakeaway(id)
  const sheet = h('div', { class: 't32-sheet', hidden: true })
  const pill = h('button', { class: 't32-take', type: 'button', hidden: true, 'aria-expanded': 'false' }, L.takeaway)
  const close = () => {
    sheet.hidden = true
    pill.setAttribute('aria-expanded', 'false')
    pill.focus({ preventScroll: true })
  }
  pill.addEventListener('click', () => {
    if (!card) return
    if (!sheet.childElementCount) sheet.append(h('button', { class: 't32-close', type: 'button', 'aria-label': L.close, onClick: close }, '×'), takeaway(card, null, onCleanup))
    sheet.hidden = false
    pill.setAttribute('aria-expanded', 'true')
    ;(sheet.querySelector('.p2k-copy') as HTMLElement | null)?.focus({ preventScroll: true })
  })
  sheet.addEventListener('keydown', (e) => e.key === 'Escape' && (e.stopPropagation(), close()))
  root.append(pill, sheet)
  return { show: () => card && (pill.hidden = false), pill }
}

/** The stage size for a canvas scene: the art plus the foot below it (stable when the insight grows), css px. */
export function stageSize(ctx: { el: HTMLElement; art: HTMLElement }): [number, number] {
  const cs = getComputedStyle(ctx.el)
  return [ctx.art.clientWidth, ctx.el.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0)]
}
