import { fill, s } from '../../core/dom'
import { blob, clamp, curve, onSize, p2Defs, rng, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import { guide } from '../../ui/part2/guide'
import { progressTide, type TideGeo } from '../../ui/part2/tide'
import { mist } from '../../ui/part2/paint'
import type { Tide } from '../../ui/part2/types'
import type { Fact } from '../../core/content'
import type { SceneDef } from '../types'
import C from '../../content/tram-26.json'
import { bamboo, f1 } from '../t25/kit'

const ink = (d: string, cls = 't26r-ink') => s('path', { class: `zk-ink ${cls}`, d, filter: 'url(#ink-rough)' })
const rockFill = (d: string) => [s('path', { class: 't26r-stone', d, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }), s('path', { d, fill: 'url(#p2-shade)' })]
const shadow = (w: number) => s('ellipse', { class: 't26r-sh', cx: f1(w * 0.06), cy: 1.5, rx: f1(w * 0.55), ry: f1(Math.max(2.5, w * 0.08)) })

/** 1 · the programme opens: a bamboo gate, one leaf swung half open. */
function gate(z: number, seed: number) {
  const w = z * 1.05, hh = z * 1.1
  const posts = [bamboo([-w * 0.42, 2], [-w * 0.42, -hh], z * 0.09, seed, 2), bamboo([w * 0.42, 2], [w * 0.42, -hh], z * 0.09, seed + 1, 2)]
  const top = bamboo([-w * 0.56, -hh * 0.9], [w * 0.56, -hh * 0.93], z * 0.08, seed + 2, 2)
  let slats = ''
  // the open leaf: hinged on the left post, swung toward us — narrower, its top edge tilting
  const lx = -w * 0.38, rx = w * 0.02
  for (let i = 0; i < 5; i++) {
    const t = i / 4, x = lx + (rx - lx) * t
    slats += stroke([[x, -2 - t * hh * 0.03], [x + 0.6, -hh * (0.76 - t * 0.06)]], z * 0.06, 0.03, 0.05, 0.7)
  }
  slats += stroke([[lx, -hh * 0.2], [rx, -hh * 0.22]], z * 0.045, 0.05, 0.05, 0.6) + stroke([[lx, -hh * 0.58], [rx, -hh * 0.64]], z * 0.045, 0.05, 0.05, 0.6)
  return s('g', null, shadow(w),
    s('path', { class: 't26r-light', d: `M${f1(rx + 2)} 0L${f1(w * 0.4)} 0L${f1(w * 0.4)} ${f1(-hh * 0.86)}L${f1(rx + 2)} ${f1(-hh * 0.8)}Z` }),
    s('path', { class: 'zk-cane', d: posts[0].cane + posts[1].cane + top.cane, filter: 'url(#ink-rough)' }),
    s('path', { class: 'zk-knot', d: posts[0].knots + posts[1].knots + top.knots }),
    s('path', { class: 'zk-cane t26r-slat', d: slats, filter: 'url(#ink-rough)' }),
    ink(stroke([[-w * 0.47, -hh * 0.86], [-w * 0.37, -hh * 0.8]], 1.4, 0.2, 0.2, 0.3) + stroke([[w * 0.37, -hh * 0.88], [w * 0.47, -hh * 0.82]], 1.4, 0.2, 0.2, 0.3)))
}

/** 2 · a door that can be closed: plank door in a stone frame, its bar lifted aside, ready. */
function door(z: number, seed: number) {
  const w = z * 0.9, hh = z * 1.12
  const r = rng(seed)
  let planks = ''
  for (let i = 1; i < 4; i++) planks += stroke([[-w * 0.32 + i * w * 0.16, -2], [-w * 0.32 + i * w * 0.16 + (r() - 0.5), -hh * 0.82]], 1.2, 0.1, 0.1, 0.4)
  const frame = `M${f1(-w * 0.5)} 0L${f1(-w * 0.5)} ${f1(-hh)}L${f1(w * 0.5)} ${f1(-hh)}L${f1(w * 0.5)} 0L${f1(w * 0.36)} 0L${f1(w * 0.36)} ${f1(-hh * 0.86)}L${f1(-w * 0.36)} ${f1(-hh * 0.86)}L${f1(-w * 0.36)} 0Z`
  return s('g', null, shadow(w),
    ...rockFill(frame),
    s('path', { class: 't26r-wood', d: `M${f1(-w * 0.34)} 0L${f1(-w * 0.34)} ${f1(-hh * 0.84)}L${f1(w * 0.34)} ${f1(-hh * 0.84)}L${f1(w * 0.34)} 0Z`, filter: 'url(#ink-rough)' }),
    ink(planks, 't26r-ink t26r-plank'),
    s('path', { class: 't26r-iron', d: blob(-w * 0.2, -hh * 0.44, w * 0.05, w * 0.05, 2, 0.1, 8) + blob(w * 0.2, -hh * 0.44, w * 0.05, w * 0.05, 3, 0.1, 8) }),
    // the bar, lifted and leaning at the right of the frame: one move to drop it across
    s('path', { class: 't26r-bar', d: stroke([[w * 0.56, -2], [w * 0.62, -hh * 0.5], [w * 0.66, -hh * 0.98]], z * 0.09, 0.05, 0.05, 0.8), filter: 'url(#ink-rough)' }),
    ink(stroke([[-w * 0.5, -hh], [w * 0.5, -hh - 1]], z * 0.07, 0.05, 0.05, 0.6)))
}

/** 3 · the new rule: an upright stele (also the stele of scene 4), rounded crown, lines carved down its face, on a plinth. */
export function stele(z: number, seed: number) {
  const w = z * 0.68, hh = z * 1.35
  const r = rng(seed)
  const slab = `M${f1(-w * 0.5)} ${f1(-z * 0.16)}L${f1(-w * 0.47)} ${f1(-hh * 0.8)}Q${f1(-w * 0.45)} ${f1(-hh)} ${f1(0)} ${f1(-hh * 1.02)}Q${f1(w * 0.45)} ${f1(-hh)} ${f1(w * 0.47)} ${f1(-hh * 0.8)}L${f1(w * 0.5)} ${f1(-z * 0.16)}Z`
  // a recessed panel, and four columns of characters cut into it: each cut dark, its lower lip catching the moon
  const px0 = -w * 0.36, px1 = w * 0.36, py0 = -hh * 0.86, py1 = -z * 0.26
  const panel = `M${f1(px0)} ${f1(py1)}L${f1(px0)} ${f1(py0)}L${f1(px1)} ${f1(py0)}L${f1(px1)} ${f1(py1)}`
  const cw = Math.max(1.2, z * 0.016), gl = Math.max(2.2, z * 0.034)
  let carve = '', lip = ''
  for (let c = 0; c < 4; c++) {
    const x = w * (0.24 - c * 0.16)
    for (let y = py0 + z * 0.06; y < py1 - z * 0.03; y += gl * 1.9 + r() * gl) {
      if (r() < 0.12) continue
      const k = r()
      const seg = k < 0.4 ? [[x - gl, y], [x + gl, y + 0.3]] : k < 0.7 ? [[x, y - gl * 0.7], [x + 0.3, y + gl * 0.7]] : [[x - gl * 0.8, y - gl * 0.5], [x + gl * 0.8, y + gl * 0.5]]
      carve += stroke(seg as Pt[], cw, 0.2, 0.2, 0.3)
      lip += stroke((seg as Pt[]).map(([a, b]) => [a + 0.4, b + cw * 0.9] as Pt), cw * 0.6, 0.2, 0.2, 0.3)
    }
  }
  return s('g', null, shadow(w * 1.3),
    ...rockFill(`M${f1(-w * 0.68)} 0L${f1(-w * 0.6)} ${f1(-z * 0.17)}L${f1(w * 0.6)} ${f1(-z * 0.17)}L${f1(w * 0.68)} 0Z` + slab),
    s('path', { class: 't26r-panel', d: panel, 'stroke-width': f1(Math.max(1, z * 0.012)) }),
    s('path', { class: 't26r-lip', d: lip }),
    s('path', { class: 't26r-carve', d: carve }),
    s('path', { class: 't26r-rim', d: stroke(curve([-w * 0.44, -hh * 0.78], [-w * 0.4, -hh * 0.98], [w * 0.05, -hh * 1.0], 8), 1.6, 0.2, 0.4, 0.1) }))
}

/** 4 · today: a boundary stone (sekimori-ishi) tied with a black cord — do not pass, for now only by custom. */
function boundary(z: number, seed: number) {
  const w = z * 0.62
  return s('g', null,
    stoneArt(w * 1.4, w * 0.5, seed + 5),
    s('g', { transform: `translate(0 ${f1(-w * 0.5)})` },
      shadow(w * 0.6),
      s('path', { class: 't26r-stone', d: blob(0, -w * 0.32, w * 0.36, w * 0.33, seed, 0.06, 12), fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
      s('path', { d: blob(0, -w * 0.32, w * 0.36, w * 0.33, seed, 0.06, 12), fill: 'url(#p2-shade)' }),
      s('path', { class: 't26r-rope', d: stroke(curve([-w * 0.34, -w * 0.28], [0, -w * 0.12], [w * 0.34, -w * 0.3], 8), 2.4, 0.05, 0.05, 0.6) + stroke(curve([0, -w * 0.66], [w * 0.1, -w * 0.32], [0, -w * 0.02], 8), 2.4, 0.05, 0.05, 0.6) + stroke(curve([-w * 0.02, -w * 0.66], [-w * 0.18, -w * 0.82], [-w * 0.1, -w * 0.9], 5), 2, 0.1, 0.4, 0.3) + stroke(curve([w * 0.02, -w * 0.66], [w * 0.18, -w * 0.8], [w * 0.12, -w * 0.9], 5), 2, 0.1, 0.4, 0.3) + blob(0, -w * 0.67, 3, 2.6, 4, 0.1, 8), filter: 'url(#ink-rough)' })))
}

/** a small stone lantern (oki-dōrō) set low by a milestone: a rough foot stone, a square firebox with a paper window, a
 *  wide low cap with lifted corners, a knob; its glow (class p2p-lamp-halo) and window (p2p-toro-fire) warm on arrival */
function oki(hh: number, seed: number) {
  const u = hh / 10
  const P = (x: number, y: number) => `${f1(x * u)} ${f1(-y * u)}`
  const box = `M${P(-1.7, 2.1)}L${P(1.7, 2.1)}L${P(1.55, 5.9)}L${P(-1.55, 5.9)}Z`
  const cap = `M${P(-3.3, 6.4)}Q${P(-2.6, 6.2)} ${P(-1.8, 6.9)}L${P(0, 8.6)}L${P(1.8, 6.9)}Q${P(2.6, 6.2)} ${P(3.3, 6.4)}Q${P(3.2, 5.6)} ${P(2.4, 5.7)}L${P(-2.4, 5.7)}Q${P(-3.2, 5.6)} ${P(-3.3, 6.4)}Z`
  const foot = blob(0, -u * 1.15, u * 2.3, u * 1.25, seed, 0.12, 12)
  const stone = foot + box + cap + blob(0, -u * 9.1, u * 0.65, u * 0.6, seed + 1, 0.1, 8)
  return s('g', { class: 't26r-oki' },
    s('ellipse', { class: 't26r-sh', cx: f1(u * 0.6), cy: 1, rx: f1(u * 3), ry: f1(u * 0.7) }),
    s('circle', { class: 'p2p-lamp-halo', cx: 0, cy: f1(-u * 4), r: f1(u * 6.5), fill: 'url(#p2-lamp)' }),
    ...rockFill(stone),
    s('rect', { class: 'p2p-toro-fire', x: f1(-u * 0.85), y: f1(-u * 5.2), width: f1(u * 1.7), height: f1(u * 2.4) }),
    ink(stroke([[-u * 3.3, -u * 6.4], [0, -u * 6.55], [u * 3.3, -u * 6.4]], u * 0.35, 0.1, 0.1, 0.3) + stroke([[-u * 1.7, -u * 2.1], [u * 1.7, -u * 2.15]], u * 0.25, 0.1, 0.1, 0.3)),
    s('path', { class: 't26r-rim', d: stroke([[-u * 3.1, -u * 6.5], [-u * 1.6, -u * 7.2], [0, -u * 8.5]], u * 0.3, 0.2, 0.3, 0.1) }))
}

/**
 * Scene 3 — the milestones of a rule (audit v3 26-3 "Làm lại"): HIGH, looking down into an iris marsh at night that holds
 * the sky — lighter far off, a broad glow round the moon's reflection. A yatsuhashi bridge of plank runs zig-zags up from
 * the frame's lower left into the mist at the upper right. Three milestones stand at its bends, each on a stone landing
 * with a little stone lantern and its date: a bamboo gate half open (04/2025), a plank door with its bar ready (08/2025),
 * the stele of the new policy (10/2026); then a boundary stone at today, where the planks go on into the mist. The moon's
 * reflection is what you drag (progressTide with a zig-zag `track`); a paper figure — you — walks the planks with it, the
 * planks behind it catch the light, each lantern warms as you reach it. The reading lies on the open water at the lower
 * right, never across the bridge; at today it gives way to the insight in that same corner.
 */
const R = C.scenes.rule
const F = (x: unknown) => x as Fact
// one object per stop: the three dated milestones, then today's boundary stone
const MARKS = [gate, door, stele, boundary]
const N = R.tide.milestones.length // stops 0…N-1 milestones, N = today

/** bends of the bridge in frame shares (u across, v down = near): B0 below the frame … stops at B1, B3, B5, today at B7,
 *  B8 lost in the mist. Wide: up from the lower left, the lower right left open for the words; tall: up the top part */
function bends(w: number, hh: number): Pt[] {
  const land = w / hh > 1.1
  const uv: Pt[] = land
    ? [[-0.03, 1.06], [0.13, 0.78], [0.3, 0.9], [0.37, 0.56], [0.53, 0.64], [0.58, 0.35], [0.73, 0.4], [0.79, 0.19], [0.95, 0.12]]
    : [[-0.08, 0.7], [0.2, 0.6], [0.78, 0.53], [0.3, 0.42], [0.8, 0.33], [0.34, 0.23], [0.74, 0.15], [0.5, 0.07], [0.66, -0.03]]
  return uv.map(([u, v]) => [u * w, v * hh])
}
/** how near a point is (1 at the frame's foot … 0.5 at its top): sizes shrink into the distance */
const near = (y: number, hh: number) => 0.5 + 0.5 * Math.max(0, Math.min(1, y / hh))
/** stop i (0…N) sits at bend 2i + 1 */
const stopAt = (B: Pt[], i: number) => B[2 * i + 1]
/** the point a share f of the way from stop i to stop i + 1, along the two runs between them (by length) */
function between(B: Pt[], i: number, f: number): Pt {
  const a = B[2 * i + 1], m = B[2 * i + 2], b = B[2 * i + 3]
  const l1 = Math.hypot(m[0] - a[0], m[1] - a[1]), l2 = Math.hypot(b[0] - m[0], b[1] - m[1])
  const d = f * (l1 + l2)
  if (d <= l1) { const k = d / (l1 || 1); return [a[0] + (m[0] - a[0]) * k, a[1] + (m[1] - a[1]) * k] }
  const k = (d - l1) / (l2 || 1)
  return [m[0] + (b[0] - m[0]) * k, m[1] + (b[1] - m[1]) * k]
}

/** what the band holds, kept for onStep: the lit overlay, the walker, the milestones */
const live = { lit: null as SVGPathElement | null, len: [] as number[], walker: null as SVGGElement | null, marks: [] as SVGGElement[], B: [] as Pt[], hh: 1, reached: -1, onReach: null as ((i: number) => void) | null }

/** an iris clump in the marsh water: flat fans of sword leaves, a few arching over, now and then a stalk with
*  a bud or an open flower above them, the moon along some edges */
function iris(x: number, y: number, k: number, sd: number) {
  const q = rng(sd)
  let d = '', rim = '', stalk = '', fl = ''
  const fans = 2 + Math.floor(q() * 2)
  for (let f = 0; f < fans; f++) {
    const fx = x + (f - (fans - 1) / 2) * 9 * k + (q() - 0.5) * 6 * k, lean = (q() - 0.5) * 0.35
    const nb = 4 + Math.floor(q() * 3)
    for (let i = 0; i < nb; i++) {
      const off = i - (nb - 1) / 2
      const a = -Math.PI / 2 + off * 0.13 + lean + (q() - 0.5) * 0.08
      const len = (30 + q() * 30) * k * (1 - Math.abs(off) * 0.13)
      const p0: Pt = [fx + off * 1.6 * k, y]
      const p1: Pt = [p0[0] + Math.cos(a) * len * 0.55, p0[1] + Math.sin(a) * len * 0.55]
      const bend = q() < 0.28 ? Math.sign(off || 1) * 0.85 : 0 // a few blades arch over at the top
      const p2: Pt = [p1[0] + Math.cos(a + bend) * len * 0.45, p1[1] + Math.sin(a + bend) * len * 0.45]
      d += stroke([p0, p1, p2], (3 + q() * 1.6) * k, 0.06, 0.72, 0.1)
      if (q() < 0.5) rim += stroke([[p1[0] - 1.2 * k, p1[1]], [p2[0] - 0.8 * k, p2[1]]], 0.9 * k, 0.3, 0.6, 0.1)
    }
  }
  const nf = q() < 0.6 ? 1 + Math.floor(q() * 2) : 0
  for (let i = 0; i < nf; i++) {
    const bx = x + (q() - 0.5) * 14 * k, top: Pt = [bx + (q() - 0.5) * 8 * k, y - (58 + q() * 22) * k]
    stalk += stroke([[bx, y], [(bx + top[0]) / 2, (y + top[1]) / 2], top], 1.3 * k, 0.05, 0.3, 0.6)
    if (q() < 0.5) fl += `M${f1(top[0])} ${f1(top[1] + 2 * k)}Q${f1(top[0] - 2.6 * k)} ${f1(top[1] - 4 * k)} ${f1(top[0])} ${f1(top[1] - 9 * k)}Q${f1(top[0] + 2.6 * k)} ${f1(top[1] - 4 * k)} ${f1(top[0])} ${f1(top[1] + 2 * k)}Z`
    else {
      // an open flower: three falls drooping, the standards upright between them
      for (const ang of [-2.5, -0.65, Math.PI / 2]) fl += blob(top[0] + Math.cos(ang) * 4.2 * k, top[1] + Math.sin(ang) * 2.6 * k + 1.5 * k, 3.6 * k, 2.3 * k, sd + i * 3 + Math.round(ang * 10), 0.25, 8)
      fl += blob(top[0], top[1] - 4.2 * k, 1.6 * k, 3.4 * k, sd + 9, 0.2, 8)
    }
  }
  return [s('ellipse', { class: 't26r-irish', cx: f1(x + 6 * k), cy: f1(y + 3 * k), rx: f1(24 * k), ry: f1(6 * k) }), s('path', { class: 't26r-iris', d: d + stalk }), s('path', { class: 't26r-irisrim', d: rim }), s('path', { class: 't26r-flower', d: fl })]
}

/** The bridge's planks along B (bend points) at scale k(y): two weathered boards per run on posts standing in the water —
 *  a moonlit edge strip, the board's face, cross seams, the shaded side below, a soft shadow and the posts' reflections. */
function planks(B: Pt[], k: (y: number) => number): SVGElement[] {
  let top = '', hi = '', side = '', shade = '', posts = '', refl = '', seam = '', rings = ''
  const Q = (x: number, y: number) => `${f1(x)} ${f1(y)}`
  for (let i = 0; i < B.length - 1; i++) {
    const [ax, ay] = B[i], [bx, by] = B[i + 1]
    const ka = k(ay), kb = k(by)
    const L = Math.hypot(bx - ax, by - ay) || 1
    const nx = -(by - ay) / L, ny = (bx - ax) / L
    const wa = 19 * ka, wb = 19 * kb
    for (const off of [-0.52, 0.52]) {
      const ca: Pt = [ax + nx * wa * off, ay + ny * wa * off], cb: Pt = [bx + nx * wb * off, by + ny * wb * off]
      const hw = 0.46
      top += `M${Q(ca[0] - nx * wa * hw, ca[1] - ny * wa * hw)}L${Q(cb[0] - nx * wb * hw, cb[1] - ny * wb * hw)}L${Q(cb[0] + nx * wb * hw, cb[1] + ny * wb * hw)}L${Q(ca[0] + nx * wa * hw, ca[1] + ny * wa * hw)}Z`
      // the edge toward the moon (up the frame) catches the light
      const e = ny > 0 ? -hw : hw
      hi += `M${Q(ca[0] + nx * wa * e, ca[1] + ny * wa * e)}L${Q(cb[0] + nx * wb * e, cb[1] + ny * wb * e)}L${Q(cb[0] + nx * wb * e * 0.62, cb[1] + ny * wb * e * 0.62)}L${Q(ca[0] + nx * wa * e * 0.62, ca[1] + ny * wa * e * 0.62)}Z`
      // seams where one board ends and the next begins
      for (let t = 0.22 + (off > 0 ? 0.17 : 0); t < 0.95; t += 0.36) {
        const sx = ca[0] + (cb[0] - ca[0]) * t, sy = ca[1] + (cb[1] - ca[1]) * t, w = (wa + (wb - wa) * t) * hw
        seam += `M${Q(sx - nx * w, sy - ny * w)}L${Q(sx + nx * w, sy + ny * w)}`
      }
    }
    const th = (5 * (ka + kb)) / 2
    side += `M${Q(ax - nx * wa, ay - ny * wa + 1)}L${Q(bx - nx * wb, by - ny * wb + 1)}L${Q(bx - nx * wb, by - ny * wb + th + 1)}L${Q(ax - nx * wa, ay - ny * wa + th + 1)}Z` +
      `M${Q(ax + nx * wa, ay + ny * wa + 1)}L${Q(bx + nx * wb, by + ny * wb + 1)}L${Q(bx + nx * wb, by + ny * wb + th + 1)}L${Q(ax + nx * wa, ay + ny * wa + th + 1)}Z`
    shade += stroke([[ax + 6 * ka, ay + 26 * ka], [bx + 6 * kb, by + 26 * kb]], (18 * (ka + kb)) / 2, 0.05, 0.05, 0.6)
    // piles: a pair at every joint and two more pairs along each run, standing in the water, each with a short
    // broken reflection under it (so the boards visibly stand in the marsh, not float on it)
    for (const u of i > 0 ? [0, 0.34, 0.67] : [0.34, 0.67]) {
      const cx = ax + (bx - ax) * u, cy = ay + (by - ay) * u, kk = ka + (kb - ka) * u, ww = wa + (wb - wa) * u
      for (const sd of [-1, 1]) {
        const px = cx + nx * ww * 0.98 * sd, py = cy + ny * ww * 0.98 * sd + th
        posts += stroke([[px, py], [px + 0.3, py + 20 * kk]], 5.2 * kk, 0.05, 0.05, 0.8)
        refl += stroke([[px, py + 21 * kk], [px + 0.6, py + 31 * kk], [px - 0.5, py + 44 * kk]], 3.8 * kk, 0.05, 0.75, 0.15)
        rings += stroke([[px - 5 * kk, py + 20.5 * kk], [px + 5 * kk, py + 20.8 * kk]], 1.1 * kk, 0.2, 0.2, 0.2)
      }
    }
  }
  return [s('path', { class: 't26r-bshade', d: shade }), s('path', { class: 't26r-brefl', d: refl }), s('path', { class: 't26r-pring', d: rings }), s('path', { class: 't26r-post', d: posts }), s('path', { class: 't26r-bside', d: side }), s('path', { class: 't26r-btop', d: top }), s('path', { class: 't26r-bhi', d: hi }), s('path', { class: 't26r-seam', d: seam })]
}

/** The bridge, its milestones and lanterns, painted inside the tide's band (the band is the whole frame here). */
function back({ w, h: hh, seed }: TideGeo): SVGElement[] {
  const B = bends(w, hh)
  live.B = B
  live.hh = hh
  const out: SVGElement[] = []
  // the last run, past today, fades out into the mist instead of ending in the air
  const [ex0, ey0] = B[7], [ex1, ey1] = B[8]
  const fade = `t26r-fade-${seed}`
  out.push(s('defs', null,
    s('linearGradient', { id: `${fade}-g`, gradientUnits: 'userSpaceOnUse', x1: f1(ex0), y1: f1(ey0), x2: f1(ex0 + (ex1 - ex0) * 0.8), y2: f1(ey0 + (ey1 - ey0) * 0.8) }, s('stop', { offset: 0, 'stop-color': '#fff' }), s('stop', { offset: 1, 'stop-color': '#000' })),
    s('mask', { id: fade, maskUnits: 'userSpaceOnUse', x: 0, y: -hh, width: w, height: hh * 3 }, s('rect', { x: 0, y: -hh, width: w, height: hh * 3, fill: `url(#${fade}-g)` }))))
  out.push(...planks(B.slice(0, 8), (y) => near(y, hh)), s('g', { mask: `url(#${fade})` }, ...planks(B.slice(7), (y) => near(y, hh))))
  // the light that follows you along the planks (stroke dash = how far the moon has come), from the bank to today
  const path = B.slice(0, 2 * N + 2)
  live.len = path.slice(1).map((p, k) => Math.hypot(p[0] - path[k][0], p[1] - path[k][1]))
  const total = live.len.reduce((a, b) => a + b, 0)
  live.lit = s('path', { class: 't26r-lit', d: `M${path.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}`, 'stroke-dasharray': `${f1(total)} ${f1(total)}`, 'stroke-dashoffset': f1(total) }) as SVGPathElement
  out.push(live.lit)
  // at each stop, on the outside of the bend: a stone landing in the water, the milestone on it, a little lantern and its
  // date carved on a post by the planks; all scaled by distance
  live.marks = MARKS.slice(0, N + 1).map((mk, i) => {
    const [x, y] = stopAt(B, i)
    const k = near(y, hh)
    const z = Math.min(150, Math.max(w, hh) * 0.125) * k
    const prev = B[2 * i], next = B[2 * i + 2]
    const sd = (prev[0] + next[0]) / 2 > x ? -1 : 1 // the outside of the bend
    const ox = x + sd * z * 0.95, oy = y + z * 0.12
    const lx = x - sd * z * 0.42, ly = y + z * 0.2
    return s('g', { class: 't26r-mk' },
      // the landing: a flat stone, its wet rim, its reflection
      s('path', { class: 't26r-landsh', d: blob(ox + z * 0.06, oy + z * 0.08, z * 0.66, z * 0.18, seed + i * 3, 0.12, 14) }),
      s('path', { class: 't26r-land', d: blob(ox, oy, z * 0.6, z * 0.15, seed + i * 3 + 1, 0.1, 14), fill: 'url(#p2-rock)' }),
      s('path', { class: 't26r-landrim', d: stroke(curve([ox - z * 0.55, oy - z * 0.03], [ox, oy - z * 0.16], [ox + z * 0.5, oy - z * 0.05], 10), z * 0.025, 0.2, 0.3, 0.2) }),
      s('ellipse', { class: 't26r-pool', cx: f1(lx), cy: f1(ly + z * 0.05), rx: f1(z * 0.9), ry: f1(z * 0.32) }),
      // its reflection under the landing, then the thing itself
      s('g', { class: 't26r-refl', transform: `translate(${f1(ox)} ${f1(oy + z * 0.1)}) scale(1 -0.5)` }, mk(z, seed + i * 7)),
      s('g', { class: 't26r-obj', transform: `translate(${f1(ox)} ${f1(oy - z * 0.04)}) scale(1 0.92)` }, mk(z, seed + i * 7)),
      s('g', { class: 't26r-lamp', transform: `translate(${f1(lx)} ${f1(ly)})` }, oki(z * 0.42, seed + i * 5)),
      s('text', { class: 't26r-date', x: f1(ox), y: f1(oy + z * 0.36), 'text-anchor': 'middle', style: `font-size:${f1(clamp(z * 0.16, 11, 15))}px` }, R.ticks[i]))
  })
  out.push(...live.marks)
  // you: a little paper figure on the planks
  live.walker = s('g', { class: 't26r-walker' },
    s('ellipse', { class: 't26r-wsh', cx: 2, cy: 1, rx: 6, ry: 2 }),
    s('path', { class: 't26r-wbody', d: `M-4 0L-3 -12Q0 -15 3 -12L4 0Z` + blob(0, -17, 3.4, 3.8, 3, 0.05, 10) }))
  out.push(live.walker)
  // the far end melts into the mist where today becomes the horizon
  const [fx, fy] = stopAt(B, N)
  out.push(mist(fx + w * 0.06, fy - hh * 0.06, w * 0.32, hh * 0.2), mist(B[8][0], B[8][1], w * 0.3, hh * 0.2))
  return out
}

/** the moon's reflection runs on the water just in front of the planks */
function track(g: TideGeo) {
  const B = bends(g.w, g.h)
  return (t: number): Pt => {
    const u = clamp(t * N, 0, N)
    const i = Math.min(N - 1, Math.floor(u))
    const [x, y] = between(B, i, u - i)
    return [x, y + 30 * near(y, g.h)]
  }
}
/** the thumb: the moon mirrored in the marsh, a few ripples across it */
function thumb() {
  return s('g', { class: 't26r-moon' },
    s('ellipse', { class: 't26r-moonglow', rx: 64, ry: 30, fill: 'url(#p2-halo)' }),
    s('ellipse', { class: 't26r-ring', rx: 23, ry: 8.5 }),
    s('ellipse', { class: 't26r-ring t26r-ring2', rx: 17.5, ry: 6.2 }),
    s('ellipse', { class: 't26r-moondisc', rx: 12, ry: 7.2 }),
    s('path', { class: 't26r-moonrip', d: stroke([[-14, -1.6], [0, -2.3], [14, -1.4]], 1.5, 0.3, 0.3, 0.2) + stroke([[-10, 2.6], [2, 2.1], [11, 2.9]], 1.2, 0.3, 0.3, 0.2) }),
    s('path', { class: 't26r-moonhi', d: stroke([[-7, -4.4], [3, -4.8]], 1.4, 0.3, 0.3, 0.2) + stroke([[-18, 5.6], [-12, 5.4]], 1.1, 0.3, 0.3, 0.2) + stroke([[13, 5.2], [19, 5.5]], 1.1, 0.3, 0.3, 0.2) }))
}
/** follow the moon: light the planks behind it, walk the figure, warm the lanterns reached */
function onStep(i: number, t: number) {
  const { lit, walker, marks, B, len, hh } = live
  if (!lit || !walker || !B.length) return
  const u = clamp(t * N, 0, N), k = Math.min(N - 1, Math.floor(u)), f = u - k
  // how far along the lit path: the approach run, the runs of the stops passed, then this part of the next two
  const a = B[2 * k + 1], m = B[2 * k + 2]
  const l1 = Math.hypot(m[0] - a[0], m[1] - a[1]), l2 = len[2 * k + 1] ?? 0
  const done = len.slice(0, 2 * k + 1).reduce((x, y) => x + y, 0) + f * (l1 + l2)
  const total = len.reduce((x, y) => x + y, 0)
  lit.setAttribute('stroke-dashoffset', f1(Math.max(0, total - done)))
  const [x, y] = between(B, k, f)
  walker.setAttribute('transform', `translate(${f1(x)} ${f1(y)}) scale(${(near(y, hh) * 1.6).toFixed(2)})`)
  marks.forEach((mk, j) => {
    mk.classList.toggle('up', j <= i)
    mk.classList.toggle('on', j === i)
  })
  if (i > live.reached) {
    live.reached = i
    live.onReach?.(i)
  }
}

export const ruleScene: SceneDef = {
  label: R.label,
  text: 'br',
  mount(ctx) {
    p2Defs()
    // the marsh under the whole scene: the sky held in the water, lighter far off, a broad glow where the moon lies,
    // glints, lily pads, iris standing in it, big dark iris at the frame's near edges
    const marsh = s('svg', { class: 't26r-marsh', 'aria-hidden': 'true' })
    ctx.art.classList.add('t26r-art')
    ctx.art.append(marsh)
    live.reached = -1
    ctx.onCleanup(() => {
      ctx.art.classList.remove('t26r-art')
      marsh.remove()
      live.onReach = null
    })
    ctx.onCleanup(onSize(ctx.art, () => {
      const W = ctx.art.clientWidth, H = ctx.art.clientHeight
      if (!W || !H) return
      const tall = H > W
      marsh.setAttribute('viewBox', `0 0 ${W} ${H}`)
      const r = rng(2660)
      const B = bends(W, H)
      const stop = (o: number, c: string, a: number) => s('stop', { offset: o, style: `stop-color:var(${c});stop-opacity:${a}` })
      const [gx, gy] = between(B, 0, 0.35)
      const kids: SVGElement[] = [s('defs', null,
        // the sky held in the water: paler toward the far edge (the top), deepest near you
        s('linearGradient', { id: 't26r-sky', x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, '--mist', 0.55), stop(0.45, '--mist', 0.14), stop(1, '--mist', 0)),
        s('radialGradient', { id: 't26r-glow', cx: f1(gx), cy: f1(gy + H * 0.06), r: f1(Math.max(W, H) * 0.42), gradientUnits: 'userSpaceOnUse', gradientTransform: `translate(${f1(gx)} ${f1(gy)}) scale(1 0.55) translate(${f1(-gx)} ${f1(-gy)})` }, stop(0, '--moon', 0.3), stop(0.4, '--moon', 0.1), stop(1, '--moon', 0))),
        s('rect', { class: 't26r-water', width: W, height: H }),
        s('rect', { class: 't26r-skyin', width: W, height: H, fill: 'url(#t26r-sky)' }),
        s('rect', { width: W, height: H, fill: 'url(#t26r-glow)', class: 't26r-moonwash' })]
      // moonlight scattered on the water, short strokes, longer toward us
      let glints = ''
      for (let i = 0; i < 160; i++) {
        const y = H * (0.1 + 0.9 * r()), k = y / H, x = r() * W, len = 6 + k * 34 * r()
        glints += stroke([[x, y], [x + len, y + 0.4]], 0.8 + k * 1.2, 0.3, 0.3, 0.2)
      }
      kids.push(s('path', { class: 't26r-glint', d: glints }))
      // lily pads, flattened by the high view, kept off the planks
      const onPlanks = (x: number, y: number, pad: number) => {
        for (let k = 0; k < B.length - 1; k++) {
          const [ax, ay] = B[k], [bx, by] = B[k + 1]
          const u = clamp(((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2), 0, 1)
          if (Math.hypot(x - ax - (bx - ax) * u, y - ay - (by - ay) * u) < pad) return true
        }
        return false
      }
      for (let i = 0; i < 22; i++) {
        const y = H * (0.15 + 0.85 * r()), k = 0.5 + (y / H) * 0.7, x = r() * W
        if (onPlanks(x, y, 40 * k)) continue
        kids.push(s('path', { class: 't26r-pad', d: blob(x, y, 17 * k, 10 * k, 2661 + i, 0.08, 14) }), s('path', { class: 't26r-padrim', d: stroke([[x - 14 * k, y - 4 * k], [x, y - 9 * k], [x + 12 * k, y - 5 * k]], 1.1 * k, 0.2, 0.3, 0.2) }))
      }
      // iris clumps in the water, away from the planks and the words (lower right on a wide frame, the foot on a tall one)
      const words = (x: number, y: number) => (tall ? y > H * 0.64 : x > W * 0.6 && y > H * 0.6)
      const spots: Pt[] = []
      for (let i = 0; i < 46 && spots.length < (tall ? 10 : 18); i++) {
        const x = 30 + r() * (W - 60), y = 50 + r() * (H - 60)
        if (!onPlanks(x, y, 58 * near(y, H)) && !words(x, y)) spots.push([x, y])
      }
      spots.sort((a, b) => a[1] - b[1]).forEach(([x, y], i) => kids.push(...iris(x, y, near(y, H), 2690 + i)))
      // near iris, big and dark, cut by the frame's edges (clear of the words)
      const nearIris: [number, number, number][] = tall ? [[W * 0.97, H * 0.4, 5], [W * 0.02, H * 0.3, 4]] : [[W * 0.99, H * 0.5, 6], [W * 0.03, H * 0.5, 5], [W * 0.48, H * 1.02, 5]]
      for (const [x0, y0, nb] of nearIris) {
        let d = '', rim = ''
        const k = 0.6 + (y0 / H) * 0.9
        for (let i = 0; i < nb; i++) {
          const a = -Math.PI / 2 + (r() - 0.5) * 1.6, len = (60 + r() * 90) * k
          const bx = x0 + (r() - 0.5) * 50 * k
          const tip: Pt = [bx + Math.cos(a) * len, y0 + Math.sin(a) * len]
          d += stroke([[bx, y0 + 10], [bx + Math.cos(a) * len * 0.5 + (r() - 0.5) * 10, y0 + Math.sin(a) * len * 0.45], tip], (8 + r() * 6) * k, 0.05, 0.8, 0.1)
          rim += stroke(curve([bx + Math.cos(a) * len * 0.4, y0 + Math.sin(a) * len * 0.4], [bx + Math.cos(a) * len * 0.7, y0 + Math.sin(a) * len * 0.68], tip, 6), 1.5 * k, 0.2, 0.6, 0.1)
        }
        kids.push(s('path', { class: 't26r-iris t26r-near', d }), s('path', { class: 't26r-irisrim', d: rim }))
      }
      // mist over the far water
      kids.push(s('rect', { class: 't26r-farmist', width: W, height: H * 0.42, fill: 'url(#t26r-farg)' }), s('defs', null, s('linearGradient', { id: 't26r-farg', x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, '--paper', 0.85), stop(0.6, '--paper', 0.3), stop(1, '--paper', 0))))
      marsh.replaceChildren(...kids)
    }))
    // guidance: the moon in the water carries the dot (it leans along the bridge when idle); each new stop moves the prompt on
    const g = guide(ctx)
    let dot: ReturnType<typeof g.dot> | null = null
    live.onReach = (i) => {
      if (i === 0) return
      if (i < N) ctx.prompt(fill(R.promptNext, { n: N - i }))
      else dot?.done()
    }
    const sc = progressTide(R.tide as Tide, {
      label: R.label, prompt: R.prompt, aria: R.sliderAria, insight: F(R.tideInsight), detail: [F(R.tide.horizon), F(R.tideDetail)], art: { back }, track, thumb, onStep,
      band: (W, H) => ({ w: W, h: H, top: 0 }),
    }).mount(ctx)
    const moonEl = ctx.art.querySelector<HTMLElement>('.p2t-moon')
    if (moonEl) dot = g.dot(moonEl, { dir: [0.7, -0.7] })
    // six seconds still: the paper figure takes a step along the planks
    const onIdle = () => {
      if (ctx.reduced || !live.walker || live.reached >= N) return
      live.walker.animate([{ translate: '0 0' }, { translate: '6px -6px' }, { translate: '0 0' }], { duration: 900, easing: 'ease-in-out', iterations: 2, composite: 'add' })
    }
    ctx.el.addEventListener('p2:idle', onIdle)
    ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', onIdle))
    return sc
  },
}
