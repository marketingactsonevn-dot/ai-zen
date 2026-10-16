import { s } from '../../core/dom'
import { blob, curve, onSize, p2Defs, rng, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import { progressTide, type TideGeo } from '../../ui/part2/tide'
import { mist } from '../../ui/part2/paint'
import type { Tide } from '../../ui/part2/types'
import type { SceneDef } from '../types'
import C from '../../content/tram-26.json'
import { bamboo, f1 } from '../t25/kit'

const ink = (d: string, cls = 't26r-ink') => s('path', { class: `zk-ink ${cls}`, d, filter: 'url(#ink-rough)' })
const rockFill = (d: string) => [s('path', { class: 't26r-stone', d, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }), s('path', { d, fill: 'url(#p2-shade)' })]
const shadow = (w: number) => s('ellipse', { class: 't26r-sh', cx: f1(w * 0.06), cy: 1.5, rx: f1(w * 0.55), ry: f1(Math.max(2.5, w * 0.08)) })

/** 0 · the call: a letter scroll half unrolled on a low stand, columns of writing, a red cord on the roll. */
function scroll(z: number, seed: number) {
  const r = rng(seed)
  const w = z * 1.2, hh = z * 0.5, y = -z * 0.16, x0 = -w * 0.5, x1 = w * 0.22
  let cols = ''
  for (let c = 0; c < 5; c++) {
    const x = x1 - w * 0.08 - c * w * 0.12
    for (let yy = y - hh * 0.84; yy < y - hh * 0.14; yy += 3.2 + r() * 2.4) if (r() < 0.82) cols += stroke([[x - 1.6, yy], [x + 1.6, yy + 0.5]], 1.4, 0.2, 0.2, 0.3)
  }
  const sheet = `M${f1(x0)} ${f1(y)}L${f1(x1)} ${f1(y)}L${f1(x1)} ${f1(y - hh)}L${f1(x0 + 2)} ${f1(y - hh * 0.97)}Z`
  return s('g', null, shadow(w),
    ...rockFill(`M${f1(-w * 0.52)} 0L${f1(-w * 0.47)} ${f1(-z * 0.16)}L${f1(w * 0.47)} ${f1(-z * 0.16)}L${f1(w * 0.52)} 0Z`),
    s('path', { class: 't26r-paper', d: sheet }),
    ink(stroke([[x0, y - hh * 0.97], [x1, y - hh]], 1.6, 0.1, 0.1, 0.3) + stroke([[x0, y], [x1, y]], 1.6, 0.1, 0.1, 0.3) + stroke([[x0, y], [x0 + 2, y - hh * 0.97]], 1.4, 0.1, 0.1, 0.3), 't26r-ink t26r-edge'),
    ink(cols, 't26r-ink t26r-text'),
    s('path', { class: 't26r-seal', d: blob(x0 + w * 0.08, y - hh * 0.22, 2.6, 2.6, 2, 0.1, 8) }),
    // the roll: a short cylinder with its end showing
    s('path', { class: 't26r-paper', d: `M${f1(x1)} ${f1(y - hh * 1.04)}L${f1(x1 + w * 0.2)} ${f1(y - hh * 1.04)}L${f1(x1 + w * 0.2)} ${f1(y + 1)}L${f1(x1)} ${f1(y + 1)}Z` }),
    s('path', { class: 't26r-wood', d: blob(x1 + w * 0.21, y - hh * 0.52, w * 0.035, hh * 0.56, 3, 0.04, 10) }),
    ink(stroke([[x1, y - hh * 1.04], [x1 + w * 0.2, y - hh * 1.04]], 1.4, 0.1, 0.1, 0.3) + stroke([[x1, y + 1], [x1 + w * 0.2, y + 1]], 1.4, 0.1, 0.1, 0.3)),
    s('path', { class: 't26r-cord', d: stroke([[x1 + w * 0.1, y - hh * 1.06], [x1 + w * 0.12, y - hh * 0.5], [x1 + w * 0.1, y + 1]], 2.2, 0.1, 0.1, 0.3) + stroke([[x1 + w * 0.11, y - hh * 0.4], [x1 + w * 0.2, y + hh * 0.16]], 1.6, 0.1, 0.5, 0.2) + stroke([[x1 + w * 0.11, y - hh * 0.4], [x1 + w * 0.04, y + hh * 0.18]], 1.6, 0.1, 0.5, 0.2) }))
}

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
  let carve = ''
  for (let c = 0; c < 4; c++) {
    const x = w * (0.26 - c * 0.17)
    for (let y = -hh * 0.82; y < -z * 0.3; y += 4 + r() * 3) if (r() < 0.8) carve += stroke([[x - 2.4, y], [x + 2.4, y + 0.4]], 1.5, 0.2, 0.2, 0.3)
  }
  return s('g', null, shadow(w * 1.3),
    ...rockFill(`M${f1(-w * 0.68)} 0L${f1(-w * 0.6)} ${f1(-z * 0.17)}L${f1(w * 0.6)} ${f1(-z * 0.17)}L${f1(w * 0.68)} 0Z` + slab),
    ink(carve, 't26r-ink t26r-carve'),
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
 * Scene 3 — the door and the rule board (art direction §4, t26 `rule`): HIGH 65°, looking down into an iris marsh at
 * night. A yatsuhashi bridge of eight planks zig-zags from the near bank into the mist like a flash of lightning; at each
 * bend stands a milestone with a little stone lantern. The moon's reflection on the marsh is what you drag (progressTide
 * with a zig-zag `track`); a paper figure — you — walks the planks beside it, the planks behind it catch the light, each
 * lantern warms as you reach it. Today the reflection sinks into the mist.
 */
const R = C.scenes.rule
const MARKS = [scroll, gate, door, stele, boundary]

/** bends of the bridge in band shares (u across, v down = near): B0 on the bank … B6 today in the mist … B8 gone */
function bends(w: number, hh: number): Pt[] {
  const land = w / hh > 1.6
  const uv: Pt[] = land
    ? [[0.035, 0.95], [0.13, 0.76], [0.29, 0.86], [0.4, 0.56], [0.55, 0.64], [0.63, 0.38], [0.76, 0.42], [0.84, 0.22], [0.95, 0.18]]
    : [[0.1, 0.96], [0.22, 0.84], [0.66, 0.78], [0.38, 0.6], [0.74, 0.5], [0.42, 0.36], [0.7, 0.26], [0.5, 0.14], [0.62, 0.05]]
  return uv.map(([u, v]) => [u * w, v * hh])
}
/** how near a point is (1 at the band's foot … 0.45 at its top): sizes shrink into the distance */
const near = (y: number, hh: number) => 0.45 + 0.55 * Math.max(0, Math.min(1, y / hh))

/** what the band holds, kept for onStep: the lit overlay, the walker, the milestones */
const live = { lit: null as SVGPathElement | null, len: [] as number[], total: 0, walker: null as SVGGElement | null, marks: [] as SVGGElement[], B: [] as Pt[], hh: 1, art: null as HTMLElement | null, near: null as SVGGElement | null }

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
  let top = '', hi = '', side = '', shade = '', posts = '', refl = '', seam = ''
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
    shade += stroke([[ax + 8 * ka, ay + 13 * ka], [bx + 8 * kb, by + 13 * kb]], (30 * (ka + kb)) / 2, 0.05, 0.05, 0.6)
    if (i > 0) {
      for (const sd of [-1, 1]) {
        const px = ax + nx * wa * 1.05 * sd, py = ay + ny * wa * 1.05 * sd
        posts += stroke([[px, py + 2], [px, py + 15 * ka]], 5 * ka, 0.05, 0.05, 0.8)
        refl += stroke([[px, py + 16 * ka], [px + 0.5, py + 26 * ka], [px - 0.4, py + 38 * ka]], 3.6 * ka, 0.05, 0.7, 0.15)
      }
    }
  }
  return [s('path', { class: 't26r-bshade', d: shade }), s('path', { class: 't26r-brefl', d: refl }), s('path', { class: 't26r-post', d: posts }), s('path', { class: 't26r-bside', d: side }), s('path', { class: 't26r-btop', d: top }), s('path', { class: 't26r-bhi', d: hi }), s('path', { class: 't26r-seam', d: seam })]
}

/** The marsh, the bridge and its milestones, painted inside the tide's band. */
function back({ w, h: hh, seed }: TideGeo): SVGElement[] {
  const B = bends(w, hh)
  live.B = B
  live.hh = hh
  const r = rng(seed)
  const out: SVGElement[] = []
  const spots: Pt[] = []
  for (let i = 0; i < 30; i++) {
    const x = 46 + r() * (w - 92), y = 60 + r() * (hh - 70)
    // not on the planks
    let ok = true
    for (let k = 0; k < B.length - 1 && ok; k++) {
      const [ax, ay] = B[k], [bx, by] = B[k + 1]
      const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)))
      if (Math.hypot(x - ax - (bx - ax) * t, y - ay - (by - ay) * t) < 52 * near(y, hh)) ok = false
    }
    if (ok) spots.push([x, y])
  }
  spots.sort((a, b) => a[1] - b[1]).forEach(([x, y], i) => out.push(...iris(x, y, near(y, hh), seed + 50 + i)))
  out.push(...planks(B, (y) => near(y, hh)))
  // the light that follows you along the planks (stroke dash = how far the moon has come)
  live.len = B.slice(1).map((p, k) => Math.hypot(p[0] - B[k][0], p[1] - B[k][1]))
  live.total = live.len.slice(0, 6).reduce((a, b) => a + b, 0)
  live.lit = s('path', { class: 't26r-lit', d: `M${B.slice(0, 7).map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}`, 'stroke-dasharray': `${f1(live.total)} ${f1(live.total)}`, 'stroke-dashoffset': f1(live.total) }) as SVGPathElement
  out.push(live.lit)
  // a milestone at each bend, a little lantern beside it, both scaled by distance
  live.marks = MARKS.map((mk, i) => {
    const [x, y] = B[i + 1]
    const k = near(y, hh)
    const z = Math.min(116, w * 0.19) * k
    const prev = B[i], next = B[i + 2]
    const sd = (prev[0] + next[0]) / 2 > x ? -1 : 1 // stand on the outside of the bend
    const ox = sd * z * 0.95
    return s('g', { class: 't26r-mk' },
      s('g', { class: 't26r-lamp', transform: `translate(${f1(x - sd * z * 0.5)} ${f1(y + 6 * k)})` }, oki(z * 0.4, seed + i * 5)),
      s('g', { class: 't26r-obj', transform: `translate(${f1(x + ox)} ${f1(y + 2 * k)}) scale(1 0.9)` }, mk(z, seed + i * 7)))
  })
  out.push(...live.marks)
  // you: a little paper figure on the planks
  const pk = near(B[1][1], hh)
  live.walker = s('g', { class: 't26r-walker' },
    s('ellipse', { class: 't26r-wsh', cx: 2, cy: 1, rx: 6, ry: 2 }),
    s('path', { class: 't26r-wbody', d: `M-4 0L-3 -12Q0 -15 3 -12L4 0Z` + blob(0, -17, 3.4, 3.8, 3, 0.05, 10) }))
  live.walker.style.setProperty('--k', String(pk))
  out.push(live.walker)
  // the bridge does not start at the band's edge: its first runs come up out of the frame's bottom-left corner (painted in
  // the marsh under the band, in frame px), so the whole bridge cuts the frame corner to corner like lightning
  const bandEl = live.art?.querySelector<HTMLElement>('.p2t-band')
  if (live.near && live.art && bandEl) {
    const bl = parseFloat(bandEl.style.left) || 0, bt = parseFloat(bandEl.style.top) || 0
    const W = live.art.clientWidth, H = live.art.clientHeight
    const b0: Pt = [bl + B[0][0], bt + B[0][1]]
    // (on a tall frame it leaves by the left edge at once: the words lie below the band there)
    const run: Pt[] = H > W ? [[-40, b0[1] + 70], [b0[0] + 2, b0[1]]] : [[Math.max(-20, b0[0] - W * 0.09), H + 40], [b0[0] + Math.min(140, W * 0.12), b0[1] + (H - b0[1]) * 0.5], [b0[0] + 2, b0[1]]]
    live.near.replaceChildren(...planks(run, (y) => 0.97 + 0.4 * Math.max(0, (y - b0[1]) / Math.max(1, H - b0[1]))))
  }
  // the far end melts into the mist where today becomes the horizon
  const [fx, fy] = B[6]
  out.push(mist(fx + w * 0.05, fy - hh * 0.04, w * 0.3, hh * 0.22), mist(B[8][0], B[8][1], w * 0.25, hh * 0.18))
  return out
}

/** the moon's reflection runs on the water just in front of the planks */
function track(g: TideGeo) {
  const B = bends(g.w, g.h)
  return (t: number): Pt => {
    const u = Math.max(0, Math.min(5, t * 5))
    const i = Math.min(4, Math.floor(u)), f = u - i
    const [ax, ay] = B[i + 1], [bx, by] = B[i + 2]
    const x = ax + (bx - ax) * f, y = ay + (by - ay) * f
    return [x, y + 34 * near(y, g.h)]
  }
}
/** the thumb: the moon mirrored in the marsh, a few ripples across it */
function thumb() {
  return s('g', { class: 't26r-moon' },
    s('ellipse', { class: 't26r-moonglow', rx: 26, ry: 17, fill: 'url(#p2-halo)' }),
    s('ellipse', { class: 't26r-ring', rx: 23, ry: 8.5 }),
    s('ellipse', { class: 't26r-ring t26r-ring2', rx: 17.5, ry: 6.2 }),
    s('ellipse', { class: 't26r-moondisc', rx: 12, ry: 7.2 }),
    // the water breaks the disc into a few bright dashes and dark ripples across it
    s('path', { class: 't26r-moonrip', d: stroke([[-14, -1.6], [0, -2.3], [14, -1.4]], 1.5, 0.3, 0.3, 0.2) + stroke([[-10, 2.6], [2, 2.1], [11, 2.9]], 1.2, 0.3, 0.3, 0.2) }),
    s('path', { class: 't26r-moonhi', d: stroke([[-7, -4.4], [3, -4.8]], 1.4, 0.3, 0.3, 0.2) + stroke([[-18, 5.6], [-12, 5.4]], 1.1, 0.3, 0.3, 0.2) + stroke([[13, 5.2], [19, 5.5]], 1.1, 0.3, 0.3, 0.2) }))
}
/** follow the moon: light the planks behind it, walk the figure, warm the lanterns reached */
function onStep(i: number, t: number) {
  const { lit, walker, marks, B, len, total, hh } = live
  if (!lit || !walker || !B.length) return
  const u = t * 5, k = Math.min(4, Math.floor(u)), f = u - k
  const done = len[0] + len.slice(1, k + 1).reduce((a, b) => a + b, 0) + len[k + 1] * f
  lit.setAttribute('stroke-dashoffset', f1(Math.max(0, total - done)))
  const [ax, ay] = B[k + 1], [bx, by] = B[k + 2]
  const x = ax + (bx - ax) * f, y = ay + (by - ay) * f
  walker.setAttribute('transform', `translate(${f1(x)} ${f1(y)}) scale(${(near(y, hh) * 1.1).toFixed(2)})`)
  marks.forEach((m, j) => {
    m.classList.toggle('up', j <= i)
    m.classList.toggle('on', j === i)
  })
}

export const ruleScene: SceneDef = {
  label: R.label,
  mount(ctx) {
    p2Defs()
    // the marsh under the whole scene: water darkening toward us, the far half lost in mist, big iris at the near edge
    const marsh = s('svg', { class: 't26r-marsh', 'aria-hidden': 'true' })
    ctx.art.classList.add('t26r-art')
    ctx.art.append(marsh)
    live.art = ctx.art
    live.near = s('g', { class: 't26r-approach' }) as SVGGElement
    ctx.onCleanup(() => {
      ctx.art.classList.remove('t26r-art')
      marsh.remove()
    })
    ctx.onCleanup(onSize(ctx.art, () => {
      const W = ctx.art.clientWidth, H = ctx.art.clientHeight
      if (!W || !H) return
      marsh.setAttribute('viewBox', `0 0 ${W} ${H}`)
      const r = rng(2660)
      const stop = (o: number, a: number) => s('stop', { offset: o, style: `stop-color:var(--paper);stop-opacity:${a}` })
      const kids: SVGElement[] = [s('defs', null, s('linearGradient', { id: 't26r-far', x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, 0.96), stop(0.55, 0.5), stop(1, 0))), s('rect', { class: 't26r-water', width: W, height: H })]
      // moonlight scattered on the water, short strokes, longer toward us
      let glints = ''
      for (let i = 0; i < 140; i++) {
        const y = H * (0.15 + 0.85 * r()), k = y / H, x = r() * W, len = 6 + k * 30 * r()
        glints += stroke([[x, y], [x + len, y + 0.4]], 0.8 + k * 1.2, 0.3, 0.3, 0.2)
      }
      kids.push(s('path', { class: 't26r-glint', d: glints }))
      // lily pads, flattened by the high view
      for (let i = 0; i < 16; i++) {
        const y = H * (0.2 + 0.8 * r()), k = 0.5 + y / H * 0.7, x = r() * W
        kids.push(s('path', { class: 't26r-pad', d: blob(x, y, 16 * k, 10 * k, 2661 + i, 0.08, 14) }))
      }
      kids.push(live.near!)
      // iris standing in the lower water too, either side of where the words lie
      const lower: Pt[] = H > W ? [[W * 0.12, H * 1.0], [W * 0.86, H * 1.01]] : [[W * 0.78, H * 0.8], [W * 0.86, H * 0.93], [W * 0.62, H * 0.97], [W * 0.94, H * 0.7], [W * 0.3, H * 0.94]]
      lower.forEach(([x, y], i) => kids.push(...iris(x, y, H > W ? 0.8 : 1.1 + (y / H) * 0.3, 2680 + i * 7)))
      // near iris, big and dark, cut by the frame (on a tall frame only up the sides, clear of the words below the band)
      const tallF = H > W
      const nearIris: [number, number, number][] = tallF ? [[W * 0.96, H * 0.3, 5], [W * 0.03, H * 0.18, 4]] : [[W * 0.98, H * 0.9, 10], [W * 0.9, H * 0.35, 6], [W * 0.06, H * 0.42, 5]]
      for (const [x0, y0, n] of nearIris) {
        let d = '', rim = ''
        const k = 0.6 + (y0 / H) * 0.9
        for (let i = 0; i < n; i++) {
          const a = -Math.PI / 2 + (r() - 0.5) * 1.6, len = (60 + r() * 90) * k
          const bx = x0 + (r() - 0.5) * 50 * k
          const tip: Pt = [bx + Math.cos(a) * len, y0 + Math.sin(a) * len]
          d += stroke([[bx, y0 + 10], [bx + Math.cos(a) * len * 0.5 + (r() - 0.5) * 10, y0 + Math.sin(a) * len * 0.45], tip], (7 + r() * 5) * k, 0.05, 0.8, 0.1)
          rim += stroke(curve([bx + Math.cos(a) * len * 0.4, y0 + Math.sin(a) * len * 0.4], [bx + Math.cos(a) * len * 0.7, y0 + Math.sin(a) * len * 0.68], tip, 6), 1.4 * k, 0.2, 0.6, 0.1)
        }
        kids.push(s('path', { class: 't26r-iris t26r-near', d }), s('path', { class: 't26r-irisrim', d: rim }))
      }
      kids.push(s('rect', { class: 't26r-far', width: W, height: H * 0.5 }))
      marsh.replaceChildren(...kids)
    }))
    return progressTide(R.tide as Tide, { label: R.label, prompt: R.prompt, aria: R.sliderAria, art: { back }, track, thumb, onStep }).mount(ctx)
  },
}
