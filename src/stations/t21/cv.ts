import { cssVar } from '../../core/prefs'

/**
 * Canvas helpers for station 21's painted scenes: theme tokens as RGB (read on mount and in onPrefs, never per frame),
 * fog ramps as ready strings, paint.ts SVG art baked once into sprites (same brush shapes, same ink filters), and the
 * ink robot / runner drawn limb by limb in three tones + moon rim.
 */
export type RGB = [number, number, number]

let probe: CanvasRenderingContext2D | null = null
/** Any CSS colour → RGB (the browser normalises it for us). */
export function rgb(color: string): RGB {
  probe ??= document.createElement('canvas').getContext('2d')!
  probe.fillStyle = '#000'
  probe.fillStyle = color
  const v = String(probe.fillStyle)
  if (v[0] === '#') return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16)]
  const m = v.match(/[\d.]+/g) ?? ['0', '0', '0']
  return [+m[0], +m[1], +m[2]]
}
export const mix = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
export const col = (c: RGB, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a.toFixed(3)})`
/** n + 1 strings from a (k = 0) to b (k = 1): fogged colours chosen per draw without building strings in the frame. */
export const ramp = (a: RGB, b: RGB, n = 24, alpha = 1) => Array.from({ length: n + 1 }, (_, i) => col(mix(a, b, i / n), alpha))
export const pick = (r: string[], k: number) => r[Math.max(0, Math.min(r.length - 1, Math.round(k * (r.length - 1))))]

export interface Pal {
  dark: boolean
  paper: RGB; paper2: RGB; ink: RGB; ink2: RGB; ink3: RGB; wash: RGB; water: RGB; mist: RGB; moon: RGB; lantern: RGB
  vermilion: RGB; umbra: RGB; rockHi: RGB; rockMid: RGB; rockLo: RGB; stepHi: RGB; stepMid: RGB; stepLo: RGB; moss: RGB
  mistA: number
  /** the colour far things melt into (the sky at the horizon) */
  fog: RGB
  /** pine / reed ink: indigo wash by day, a pale moonlit ink by night (part2.css .p2p-pine) */
  tree: RGB
  serif: string
  sans: string
}
export function palette(): Pal {
  const v = (n: string) => rgb(cssVar(n))
  const dark = document.documentElement.dataset.theme === 'dark'
  const paper = v('--paper'), mist = v('--mist'), ink3 = v('--ink-3')
  const mistA = parseFloat(cssVar('--mist-a')) || 0.5
  return {
    dark, paper, paper2: v('--paper-2'), ink: v('--ink'), ink2: v('--ink-2'), ink3, wash: v('--wash'), water: v('--water'), mist,
    moon: v('--moon'), lantern: v('--lantern'), vermilion: v('--vermilion'), umbra: v('--umbra'),
    rockHi: v('--rock-hi'), rockMid: v('--rock-mid'), rockLo: v('--rock-lo'), stepHi: v('--step-hi'), stepMid: v('--step-mid'), stepLo: v('--step-lo'), moss: v('--moss-a'),
    mistA,
    fog: dark ? mix(paper, mist, 0.34) : mix(paper, mist, 0.6),
    tree: dark ? mix(ink3, paper, 0.48) : v('--wash'),
    serif: cssVar('--serif') || 'serif',
    sans: cssVar('--sans') || 'sans-serif',
  }
}

/** A canvas sized for the element box at a capped DPR; returns its 2D context already scaled to CSS px. */
export function fit(cv: HTMLCanvasElement, w: number, h: number, dprMax: number) {
  const d = Math.min(devicePixelRatio || 1, dprMax)
  cv.width = Math.max(1, Math.round(w * d))
  cv.height = Math.max(1, Math.round(h * d))
  const c = cv.getContext('2d')!
  c.setTransform(d, 0, 0, d, 0, 0)
  return { c, d }
}

/** soft: draw the shape a few times, nudged, at a fraction of the alpha — a bleeding ink edge without an SVG filter
 *  (canvas SVG filters rasterise on the main thread when the sprite is first drawn: hundreds of ms at 4× CPU) */
type Fill = { fill: string | CanvasGradient; alpha?: number; soft?: number } | null
/**
 * Bake paint.ts art (an SVG group built off-document) into a sprite: every path / ellipse / circle / rect is filled as a
 * Path2D with what `paint` says for its class (null = skip). box = the art's bounds in its own units, drawn at `scale`.
 * The sprite's anchor (art 0, 0) is returned in sprite px.
 */
export function bake(art: SVGElement, box: { x: number; y: number; w: number; h: number }, scale: number, paint: (cls: string, c: CanvasRenderingContext2D, el: Element) => Fill) {
  const cv = document.createElement('canvas')
  cv.width = Math.ceil(box.w * scale)
  cv.height = Math.ceil(box.h * scale)
  const c = cv.getContext('2d')!
  c.setTransform(scale, 0, 0, scale, -box.x * scale, -box.y * scale)
  for (const el of art.matches('path, ellipse, circle, rect') ? [art] : art.querySelectorAll('path, ellipse, circle, rect')) {
    const cls = `${el.getAttribute('class') ?? ''} ${(el.parentNode as Element | null)?.getAttribute?.('class') ?? ''}`
    const f = paint(cls, c, el)
    if (!f) continue
    const n = (a: string) => parseFloat(el.getAttribute(a) ?? '0')
    let p: Path2D
    if (el.tagName === 'path') p = new Path2D(el.getAttribute('d') ?? '')
    else if (el.tagName === 'rect') (p = new Path2D()), p.rect(n('x'), n('y'), n('width'), n('height'))
    else {
      p = new Path2D()
      const r = el.tagName === 'circle' ? [n('r'), n('r')] : [n('rx'), n('ry')]
      p.ellipse(n('cx'), n('cy'), r[0], r[1], 0, 0, Math.PI * 2)
    }
    c.fillStyle = f.fill
    const soft = f.soft ?? 0
    if (soft) {
      // three nudged passes build the same total density with a feathered, uneven edge
      c.globalAlpha = (f.alpha ?? 1) * 0.42
      for (let k = 0; k < 3; k++) {
        c.save()
        c.translate(Math.cos(k * 2.1) * soft, Math.sin(k * 2.1) * soft)
        c.fill(p)
        c.restore()
      }
    } else {
      c.globalAlpha = f.alpha ?? 1
      c.fill(p)
    }
  }
  return { cv, ax: -box.x * scale, ay: -box.y * scale, scale }
}
export type Sprite = ReturnType<typeof bake>

/** A soft round glow (radial alpha) to stamp lamps, pools of light and mist with drawImage. */
export function glow(color: RGB, size = 64, core = 0.5) {
  const cv = document.createElement('canvas')
  cv.width = cv.height = size
  const c = cv.getContext('2d')!
  const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, col(color, 1))
  g.addColorStop(core * 0.5, col(color, 0.55))
  g.addColorStop(core, col(color, 0.18))
  g.addColorStop(1, col(color, 0))
  c.fillStyle = g
  c.fillRect(0, 0, size, size)
  return cv
}

// ─────────────────────────── the ink robot ───────────────────────────

/** Gait and posture: phase 0…1 of the stride, run 0 (standing) … 1 (full stride), tip = fall angle (rad, + to the right),
 *  arms 0 swing … 1 flail out for balance, bend 0…1 crouch, lean sideways (rad). */
export interface Pose { phase: number; run: number; tip: number; arms: number; bend: number; lean: number }
export const pose = (): Pose => ({ phase: 0, run: 0, tip: 0, arms: 0, bend: 0, lean: 0 })

/** Robot tones, built once per theme. The robots are always backlit by the moon: an ink silhouette (`ol`, the far limbs a
 *  breath lighter in `shell`), a hairline moon rim, lantern eyes; `ghost*` paint the mist-white human runner. */
export interface Tones { ol: string; shell: string; hi: string; lo: string; rim: string; joint: string; visor: string; eye: string; ghost: string; ghostEdge: string; shadow: string }
export function tones(p: Pal, k = 0, _back = true): Tones {
  // fogged toward the far mist by k: the ink pales, the rim fades
  const ink = p.dark ? mix(p.paper, p.umbra, 0.62) : p.wash
  const f = (c: RGB) => mix(c, p.fog, k)
  const far = mix(ink, p.fog, 0.1)
  const rimC = p.dark ? p.moon : mix(p.moon, [255, 255, 255], 0.6)
  return {
    ol: col(f(ink)), shell: col(f(far)), hi: col(f(mix(ink, p.fog, 0.4))), lo: col(f(ink), 0.22),
    rim: col(rimC, 0.95 * (1 - k * 0.75)), joint: col(f(mix(ink, p.fog, 0.1))), visor: col(f(mix(ink, p.fog, 0.32))), eye: col(p.lantern),
    ghost: p.dark ? col(mix(p.mist, p.moon, 0.4), 0.55) : 'rgba(255,255,255,0.86)', ghostEdge: p.dark ? col(p.moon, 0.45) : col(p.ink3, 0.5),
    shadow: col(p.umbra, p.dark ? 0.5 : 0.22),
  }
}
/** Tones fogged in steps (index 0 = clear … n = almost mist), chosen per draw. */
export const toneRamp = (p: Pal, back = true, n = 8) => Array.from({ length: n + 1 }, (_, i) => tones(p, (i / n) * 0.92, back))

// joint positions in body metres (x right as seen by the camera, y up from the feet), reused: no allocation per frame
const J = new Float32Array(40)
// indices into J: x at i, y at i + 1
const HIP_L = 0, HIP_R = 2, KNEE_L = 4, KNEE_R = 6, FOOT_L = 8, FOOT_R = 10, SH_L = 12, SH_R = 14, EL_L = 16, EL_R = 18, HAND_L = 20, HAND_R = 22, NECK = 24, HEAD = 26, WAIST = 28, CHEST = 30
const LIFT = new Float32Array(2)
const SWING = new Float32Array(2)

/** The pose's joints in body metres (x right, y up from the feet): [x, y] pairs at the exported indices. Shared buffer. */
export function joints(p: Pose, human = false) {
  skeleton(p, human)
  return J
}
export const JI = { HEAD: 26, HAND_L: 20, HAND_R: 22, KNEE_L: 4, KNEE_R: 6, NECK: 24 }

function skeleton(p: Pose, human: boolean) {
  const T = Math.PI * 2
  const bob = p.run * 0.035 * Math.sin(T * 2 * p.phase) ** 2
  const hipY = (human ? 0.98 : 0.92) - 0.28 * p.bend + bob
  const sway = 0.018 * p.run * Math.sin(T * p.phase)
  for (let k = 0; k < 2; k++) {
    const s = k ? 1 : -1
    const lift = p.run * Math.max(0, Math.sin(T * (p.phase + (k ? 0.5 : 0))))
    LIFT[k] = lift
    const hx = sway + s * (human ? 0.08 : 0.11), hy = hipY
    const fx = s * (human ? 0.09 : 0.12) + s * 0.03 * lift + s * 0.1 * p.bend, fy = lift * (human ? 0.46 : 0.4)
    const kx = (hx + fx) / 2 + s * (0.025 + 0.12 * p.bend), ky = (hy + fy) / 2 + 0.06 * lift
    J[(k ? HIP_R : HIP_L)] = hx; J[(k ? HIP_R : HIP_L) + 1] = hy
    J[(k ? KNEE_R : KNEE_L)] = kx; J[(k ? KNEE_R : KNEE_L) + 1] = ky
    J[(k ? FOOT_R : FOOT_L)] = fx; J[(k ? FOOT_R : FOOT_L) + 1] = fy
    // the arm on this side swings against the leg on this side
    const sw = p.run * Math.sin(T * (p.phase + (k ? 0 : 0.5)))
    SWING[k] = sw
    const shx = sway * 0.6 + s * (human ? 0.17 : 0.25), shy = hipY + (human ? 0.5 : 0.47)
    const ex = shx + s * (0.05 + 0.08 * p.arms + 0.03 * Math.max(0, sw)), ey = shy - 0.27 + 0.07 * Math.max(0, -sw) + 0.24 * p.arms
    const fore = 0.25 * (1 - 0.55 * p.run * (1 - p.arms))
    const hx2 = ex + s * (0.02 + 0.2 * p.arms) + s * 0.02 * Math.max(0, sw), hy2 = ey - fore + 0.12 * Math.max(0, -sw) + 0.2 * p.arms
    J[(k ? SH_R : SH_L)] = shx; J[(k ? SH_R : SH_L) + 1] = shy
    J[(k ? EL_R : EL_L)] = ex; J[(k ? EL_R : EL_L) + 1] = ey
    J[(k ? HAND_R : HAND_L)] = hx2; J[(k ? HAND_R : HAND_L) + 1] = hy2
  }
  J[WAIST] = sway; J[WAIST + 1] = hipY + 0.06
  J[CHEST] = sway * 0.7; J[CHEST + 1] = hipY + (human ? 0.46 : 0.44)
  J[NECK] = sway * 0.6; J[NECK + 1] = hipY + (human ? 0.56 : 0.53)
  J[HEAD] = sway * 0.6; J[HEAD + 1] = hipY + (human ? 0.68 : 0.67)
}

export const FRONT = 1, BACK = 2, HUMAN = 4

// the figure being drawn: set once per call, read by the helpers below (no closures, nothing allocated per frame)
let C: CanvasRenderingContext2D
let TN: Tones
let FR = false, RIM = 1, OL = 0.01

/** One tapered ink segment a → b (body metres), widths wa → wb, as a filled quad (the round joints are drawn apart). */
function quad(a: number, b: number, wa: number, wb: number) {
  const ax = J[a], ay = J[a + 1], bx = J[b], by = J[b + 1]
  const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l
  C.beginPath()
  C.moveTo(ax + (nx * wa) / 2, ay + (ny * wa) / 2)
  C.lineTo(bx + (nx * wb) / 2, by + (ny * wb) / 2)
  C.lineTo(bx - (nx * wb) / 2, by - (ny * wb) / 2)
  C.lineTo(ax - (nx * wa) / 2, ay - (ny * wa) / 2)
  C.fill()
}
function dot(i: number, r: number) {
  C.beginPath()
  C.arc(J[i], J[i + 1], r, 0, Math.PI * 2)
  C.fill()
}
/** The moon catches the edge of a segment on its side (and, faint, the far edge: the light is behind the figure). */
function rimSeg(a: number, b: number, wa: number, wb: number, side: number) {
  const ax = J[a], ay = J[a + 1], bx = J[b], by = J[b + 1]
  const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1
  let nx = -dy / l, ny = dx / l
  // the lit side: toward the moon, or the top edge of a segment lying flat
  if ((Math.abs(nx) > 0.3 ? nx * RIM : ny) < 0) (nx = -nx), (ny = -ny)
  nx *= side
  ny *= side
  const ia = wa / 2 - OL * 0.45, ib = wb / 2 - OL * 0.45
  C.moveTo(ax + nx * ia + dx * 0.08, ay + ny * ia + dy * 0.08)
  C.lineTo(bx + nx * ib - dx * 0.08, by + ny * ib - dy * 0.08)
}
const W_TH = [0.19, 0.13, 0.085], W_AR = [0.11, 0.085, 0.06]
// one limb: hip / shoulder, knee / elbow, foot / hand
function inkLimb(a: number, b: number, d: number, w: number[], far: boolean) {
  C.fillStyle = far ? TN.shell : TN.ol
  quad(a, b, w[0], w[1])
  quad(b, d, w[1], w[2])
  dot(a, w[0] / 2)
  dot(b, w[1] * 0.6) // the knee / elbow joint: a small bulge in the silhouette
  dot(d, w[2] / 2)
}
function rimLimb(a: number, b: number, d: number, w: number[]) {
  rimSeg(a, b, w[0], w[1], 1)
  rimSeg(b, d, w[1], w[2], 1)
}
function inkFoot(i: number, lift: number, far: boolean) {
  const fx = J[i], fy = J[i + 1]
  C.fillStyle = far ? TN.shell : TN.ol
  C.beginPath()
  if (lift > 0.35 && !FR) C.ellipse(fx, fy + 0.01, 0.075, 0.06, 0, 0, Math.PI * 2) // the sole, kicked back
  else {
    // a flat boot: heel to toe, the sole on the ground
    C.moveTo(fx - 0.075, fy + 0.07)
    C.lineTo(fx + 0.075, fy + 0.07)
    C.lineTo(fx + 0.09, fy - 0.005)
    C.lineTo(fx - 0.09, fy - 0.005)
  }
  C.fill()
}
const nearArm = (k: number) => (FR ? SWING[k] < 0 : SWING[k] > 0)

/**
 * Draw the robot (or a runner with HUMAN) standing at screen (x, y) — the point between its feet — k px per metre.
 * The robot is always backlit: one ink silhouette, far limbs a breath paler, a hairline moon rim on the moon's side.
 * flags: FRONT (seen from the front: eyes), HUMAN (the mist-white runner). rim: the moon's side, -1 left … 1 right.
 * eyes: 0 dark … 1 lit (front only). A fallen pose (tip) rests on the ground instead of sinking into it.
 */
export function figure(c: CanvasRenderingContext2D, x: number, y: number, k: number, p: Pose, t: Tones, flags: number, rim = 1, eyes = 0, alpha = 1) {
  C = c
  TN = t
  FR = (flags & FRONT) !== 0
  RIM = rim
  const human = (flags & HUMAN) !== 0
  skeleton(p, human)
  c.save()
  // lying down, the body's half-thickness lifts it off the ground line
  c.translate(x, y - k * 0.13 * Math.abs(Math.sin(p.tip)))
  c.rotate(p.tip + p.lean)
  c.scale(k, -k) // metres, y up
  c.globalAlpha = alpha
  c.lineCap = 'round'
  c.lineJoin = 'round'
  OL = Math.max(1.3, k * 0.014) / k // a hairline: ~1.3 px or 1.4 cm
  if (human) ghostRunner(c, t)
  else robot(c, t, eyes)
  c.restore()
}

function robot(c: CanvasRenderingContext2D, t: Tones, eyes: number) {
  // the far arm and leg first, a breath paler (the only depth a backlit silhouette shows)
  const farLeg = (LIFT[0] > LIFT[1]) !== FR ? 1 : 0
  for (let n = 0; n < 2; n++) if (!nearArm(n)) inkLimb(n ? SH_R : SH_L, n ? EL_R : EL_L, n ? HAND_R : HAND_L, W_AR, true)
  inkLimb(farLeg ? HIP_R : HIP_L, farLeg ? KNEE_R : KNEE_L, farLeg ? FOOT_R : FOOT_L, W_TH, true)
  inkFoot(farLeg ? FOOT_R : FOOT_L, LIFT[farLeg], true)
  const q = 1 - farLeg
  inkLimb(q ? HIP_R : HIP_L, q ? KNEE_R : KNEE_L, q ? FOOT_R : FOOT_L, W_TH, false)
  inkFoot(q ? FOOT_R : FOOT_L, LIFT[q], false)
  // torso: broad shoulders, a pinched waist, a pelvis block; shoulder caps stand out in the silhouette
  const wx = J[WAIST], wy = J[WAIST + 1], cx = J[CHEST], cy = J[CHEST + 1]
  const sw = 0.26, ww = 0.14
  c.fillStyle = t.ol
  c.beginPath()
  c.moveTo(wx - ww * 1.15, wy - 0.1)
  c.lineTo(wx + ww * 1.15, wy - 0.1)
  c.lineTo(wx + ww, wy + 0.02)
  c.quadraticCurveTo(cx + sw * 0.95, (wy + cy) / 2, cx + sw, cy + 0.02)
  c.quadraticCurveTo(cx, cy + 0.1, cx - sw, cy + 0.02)
  c.quadraticCurveTo(cx - sw * 0.95, (wy + cy) / 2, wx - ww, wy + 0.02)
  c.closePath()
  c.fill()
  dot(SH_L, 0.1)
  dot(SH_R, 0.1)
  // neck and helmet
  const hx = J[HEAD], hy = J[HEAD + 1]
  c.fillRect(J[NECK] - 0.045, J[NECK + 1] - 0.06, 0.09, hy - J[NECK + 1])
  const hw = 0.135, hh = 0.155
  c.beginPath()
  c.roundRect(hx - hw, hy - hh, hw * 2, hh * 2, [0.06, 0.06, 0.09, 0.09])
  c.fill()
  for (let n = 0; n < 2; n++) if (nearArm(n)) inkLimb(n ? SH_R : SH_L, n ? EL_R : EL_L, n ? HAND_R : HAND_L, W_AR, false)
  if (FR) {
    // the face is in shadow: a visor slit a shade paler, and (autonomous) two lantern eyes with their glow
    c.fillStyle = t.visor
    c.fillRect(hx - hw * 0.78, hy - 0.005, hw * 1.56, 0.05)
    if (eyes > 0) {
      c.globalAlpha *= eyes
      c.fillStyle = t.eye
      c.globalAlpha *= 0.28
      c.beginPath()
      c.ellipse(hx, hy + 0.02, hw * 1.3, 0.09, 0, 0, Math.PI * 2)
      c.fill()
      c.globalAlpha /= 0.28
      c.fillRect(hx - hw * 0.62, hy + 0.006, hw * 0.42, 0.03)
      c.fillRect(hx + hw * 0.2, hy + 0.006, hw * 0.42, 0.03)
      c.globalAlpha /= eyes
    }
  }
  // the moon rim: a hairline on the lit edges — limbs, shoulder line, flank, helmet
  c.strokeStyle = t.rim
  c.lineWidth = OL * 0.75
  c.beginPath()
  // only the limbs on the moon's side: an edge inside the silhouette would not catch the light
  const ms = RIM > 0 ? 1 : 0
  rimLimb(ms ? HIP_R : HIP_L, ms ? KNEE_R : KNEE_L, ms ? FOOT_R : FOOT_L, W_TH)
  rimLimb(ms ? SH_R : SH_L, ms ? EL_R : EL_L, ms ? HAND_R : HAND_L, W_AR)
  c.moveTo(cx - sw * 0.85, cy + 0.04)
  c.quadraticCurveTo(cx, cy + 0.1 - OL, cx + sw * 0.85, cy + 0.04)
  c.moveTo(cx + RIM * (sw - OL * 0.5), cy - 0.01)
  c.quadraticCurveTo(cx + RIM * (sw * 0.95 - OL * 0.5), (wy + cy) / 2, wx + RIM * (ww - OL * 0.3), wy + 0.04)
  c.moveTo(hx + RIM * (hw - OL * 0.5), hy - hh * 0.5)
  c.lineTo(hx + RIM * (hw - OL * 0.5), hy + hh - 0.06)
  c.quadraticCurveTo(hx + RIM * (hw - OL * 0.5), hy + hh - OL * 0.5, hx + RIM * (hw - 0.06), hy + hh - OL * 0.5)
  c.lineTo(hx - RIM * hw * 0.4, hy + hh - OL * 0.5)
  c.stroke()
  // the far edge catches a fainter line: the moon is behind the figure
  c.globalAlpha *= 0.32
  c.beginPath()
  RIM = -RIM
  rimLimb(ms ? HIP_L : HIP_R, ms ? KNEE_L : KNEE_R, ms ? FOOT_L : FOOT_R, W_TH)
  c.moveTo(cx + RIM * (sw - OL * 0.5), cy - 0.01)
  c.quadraticCurveTo(cx + RIM * (sw * 0.95 - OL * 0.5), (wy + cy) / 2, wx + RIM * (ww - OL * 0.3), wy + 0.04)
  c.moveTo(hx + RIM * (hw - OL * 0.5), hy - hh * 0.4)
  c.lineTo(hx + RIM * (hw - OL * 0.5), hy + hh - 0.07)
  RIM = -RIM
  c.stroke()
  c.globalAlpha /= 0.32
}

// the human runner: a figure of mist, edged in moonlight
function ghostRunner(c: CanvasRenderingContext2D, t: Tones) {
  const limb = (a: number, b: number, d: number, w1: number, w2: number) => {
    c.beginPath()
    c.moveTo(J[a], J[a + 1]); c.lineTo(J[b], J[b + 1]); c.lineTo(J[d], J[d + 1])
    c.strokeStyle = t.ghostEdge
    c.lineWidth = w1 + OL * 0.8
    c.stroke()
    c.strokeStyle = t.ghost
    c.lineWidth = (w1 + w2) / 2
    c.stroke()
  }
  for (let n = 0; n < 2; n++) if (!nearArm(n)) limb(n ? SH_R : SH_L, n ? EL_R : EL_L, n ? HAND_R : HAND_L, 0.06, 0.05)
  for (let n = 0; n < 2; n++) limb(n ? HIP_R : HIP_L, n ? KNEE_R : KNEE_L, n ? FOOT_R : FOOT_L, 0.085, 0.065)
  const wx = J[WAIST], wy = J[WAIST + 1], cx = J[CHEST], cy = J[CHEST + 1]
  c.beginPath()
  c.moveTo(wx - 0.1, wy - 0.05)
  c.quadraticCurveTo(cx - 0.147, (wy + cy) / 2, cx - 0.14, cy + 0.02)
  c.quadraticCurveTo(cx, cy + 0.09, cx + 0.14, cy + 0.02)
  c.quadraticCurveTo(cx + 0.147, (wy + cy) / 2, wx + 0.1, wy - 0.05)
  c.closePath()
  c.fillStyle = t.ghost
  c.fill()
  c.strokeStyle = t.ghostEdge
  c.lineWidth = OL * 0.8
  c.stroke()
  for (let n = 0; n < 2; n++) if (nearArm(n)) limb(n ? SH_R : SH_L, n ? EL_R : EL_L, n ? HAND_R : HAND_L, 0.06, 0.05)
  c.beginPath()
  c.arc(J[HEAD], J[HEAD + 1], 0.1, 0, Math.PI * 2)
  c.fill()
  c.stroke()
}

// ─────────────────────────── bamboo, mist ───────────────────────────

/** A bamboo culm on screen from (x0, y0) to (x1, y1), w px thick: the stem, a lit edge on the moon's side, darker node
 *  rings every `seg` px along it. Colours are ready strings (no allocation). */
export function bamboo(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w: number, seg: number, stem: string, node: string, lit: string, side = 1) {
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = (-dy / l) * side, ny = (dx / l) * side
  g.lineCap = 'butt'
  g.strokeStyle = stem
  g.lineWidth = w
  g.beginPath()
  g.moveTo(x0, y0)
  g.lineTo(x1, y1)
  g.stroke()
  if (w < 1.6) return
  g.strokeStyle = lit
  g.lineWidth = Math.max(0.6, w * 0.22)
  g.beginPath()
  g.moveTo(x0 + nx * w * 0.28, y0 + ny * w * 0.28)
  g.lineTo(x1 + nx * w * 0.28, y1 + ny * w * 0.28)
  g.stroke()
  // node rings: short dark bands across the culm, a hair wider than it
  const n = Math.floor(l / Math.max(6, seg))
  g.strokeStyle = node
  g.lineWidth = Math.max(0.8, w * 0.28)
  g.beginPath()
  for (let i = 1; i <= n; i++) {
    const u = i / (n + 1) + 0.04 * Math.sin(i * 2.3)
    const px = x0 + dx * u, py = y0 + dy * u
    g.moveTo(px + nx * w * 0.62, py + ny * w * 0.62)
    g.lineTo(px - nx * w * 0.62, py - ny * w * 0.62)
  }
  g.stroke()
}

/** A vertical veil of mist (fog colour, alpha 0 at the top → full in the lower half → soft at the foot), stretched over a
 *  band of the screen with drawImage: the air between two depths. */
export function veil(color: RGB) {
  const cv = document.createElement('canvas')
  cv.width = 4
  cv.height = 128
  const c = cv.getContext('2d')!
  const g = c.createLinearGradient(0, 0, 0, 128)
  g.addColorStop(0, col(color, 0))
  g.addColorStop(0.55, col(color, 0.85))
  g.addColorStop(0.8, col(color, 1))
  g.addColorStop(1, col(color, 0))
  c.fillStyle = g
  c.fillRect(0, 0, 4, 128)
  return cv
}
