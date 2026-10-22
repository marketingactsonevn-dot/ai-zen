import './views.css'
import { fill, h, nextId, s } from '../../core/dom'
import { createLoop } from '../../core/loop'
import { blob, clamp, curve, rng, rock, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist, moon, reeds } from '../../ui/part2/paint'
import { perspectiveCircle, type CircleApi } from '../../ui/part2/perspectives'
import { guide, type Mark } from '../../ui/part2/guide'
import type { SceneCtx, SceneDef } from '../types'
import { C } from './shell'
import { dawnGlow, f1, fog, g13Defs, lines } from './sumi'

/**
 * Scene 4 — how dangerous is AI? (art direction §4 t37 `views`): you stand on a stone in the middle of a pond at water
 * level and turn round, a 360° cylinder seen ≈110° at a time (≈70° in a tall frame). Each quarter is a stack, far to
 * near: a horizon whose distance and size say what that view fears — north (CAIS) a towering cumulonimbus lit by the
 * moon, lightning inside it, enormous but far; east (DAIR) a lit village right across the water, smoke rising, small but
 * close; south (Andreessen) the sun about to burst over the rim, rays fanning; west (Narayanan & Kapoor) a path off the
 * shore into ordinary fields under the setting moon — then a mid bank with reeds, the water with its reflections and
 * the moon's specular, and near you, standing in the water, the speaker's stone with the name carved in it, wet at the
 * waterline and mirrored. Drag to turn (inertia), ←/→, tap a stone or 1–4 to turn to it; face one for 0.6 s and it is
 * heard: what it says comes on a paper slip floating on the water, tied to the stone (a tall frame: the slip lies under
 * the picture). The moon's broken road on the water always leans the way you look. All four heard: the view tips up
 * and back and the cylinder curls into a little planet, the four horizons standing round one pond as big silhouettes,
 * the common ground written under it (the north storm softens once the detail is open). Four parallax planes per
 * quarter; one loop while turning. Low / reduced: the little planet, still, with the four stones.
 */

const V = C.scenes.views
/** where each view (JSON order) lies round you, degrees clockwise from north */
const AT = [0, 90, 180, 270]
const PLANES = [0.9, 0.96, 1, 1.07] // sky, far shore, water, near: turn rates (parallax)

// ── the four horizons, one quarter box Q wide × H tall each, horizon at hy, the direction at x = c

/** gradient ids shared by the painted clouds (set once per mount, in the scene's own defs) */
const G = { body: '', glow: '', refl: '', dark: '', lit: '' }
/** the storm's offset in its quarter for the current frame (wide / tall) */
let stormDx = 0.55

/** half-width of the storm's column (share of its height) at height share t: 0 foot … 0.74 the anvil's root */
const cbHalf = (t: number) => 0.36 + 0.04 * Math.sin(t * 6 + 0.6) - t * 0.12

/**
 * A cumulonimbus in ink wash, foot on the horizon at (cx, base), `hc` tall: one silhouette, not a pile of balls — the
 * west flank and the crown billow out in broad swells, the east side and the anvil's underside run smooth, the anvil
 * spreads flat and long to the east from an overshooting dome. Inside it (through its own clip) one soft wash each: a
 * dark core and base, the moon's light on the west flank and along the anvil's top; a moonlit rim brushed down the west
 * edge; a lightning glow; a rain veil under it. The kit's ink wash wets its edge.
 */
function thunderhead(cx: number, base: number, hc: number, seed: number, wash = true): SVGElement[] {
  const r = rng(seed)
  const id = nextId('t37v-cb')
  const P = (x: number, y: number): Pt => [cx + x * hc, base - y * hc]
  // the outline, anticlockwise from the foot on the west: [x, y] in shares of hc (y up), and how far each stretch swells
  const west: Pt[] = [], east: Pt[] = []
  for (let t = 0; t <= 0.64; t += 0.08) {
    west.push([-(cbHalf(t) + 0.05 * Math.sin(t * 9 + 1) + r() * 0.04), 0.04 + t])
    east.push([cbHalf(t) * 0.86 + 0.06 * Math.sin(t * 7 + 2) + t * 0.14 + r() * 0.03, 0.04 + t])
  }
  const top: Pt[] = [[-0.5, 0.86], [-0.36, 0.95], [-0.12, 0.99], [0.02, 1.06], [0.18, 1.05], [0.36, 0.99], [0.62, 0.97], [0.9, 0.95], [1.18, 0.92]]
  const under: Pt[] = [[1.24, 0.9], [0.95, 0.87], [0.68, 0.82], [east[east.length - 1][0] + 0.06, 0.74]]
  // a stretch from a to b swelling out by k (shares of hc) to the outside of the turning path
  const swell = (a: Pt, b: Pt, k: number) => {
    const [ax, ay] = P(a[0], a[1]), [bx, by] = P(b[0], b[1])
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1
    return `Q${f1((ax + bx) / 2 + (dy / L) * k * hc)} ${f1((ay + by) / 2 - (dx / L) * k * hc)} ${f1(bx)} ${f1(by)}`
  }
  const ring: [Pt, number][] = [
    ...west.map((p) => [p, 0.05 + r() * 0.03] as [Pt, number]),
    [[-0.44, 0.76], 0.06],
    ...top.map((p, i) => [p, i < 6 ? 0.04 + r() * 0.025 : 0.012] as [Pt, number]),
    ...under.map((p) => [p, -0.01] as [Pt, number]),
    ...east.slice().reverse().map((p) => [p, 0.02 + r() * 0.015] as [Pt, number]),
  ]
  const [sx, sy] = P(ring[0][0][0], ring[0][0][1])
  let body = `M${f1(sx)} ${f1(sy)}`
  for (let i = 1; i < ring.length; i++) body += swell(ring[i - 1][0], ring[i][0], ring[i][1])
  body += swell(ring[ring.length - 1][0], ring[0][0], -0.015) + 'Z'
  // the moon's rim: brushed down the west swells and along the crown, thinning toward the anvil's far end
  const rimPts: Pt[] = [...west, [-0.44, 0.76], ...top.slice(0, 6)].map(([x, y]) => P(x - 0.008, y + 0.004))
  const rim = stroke(rimPts, Math.max(1.2, hc * 0.014), 0.3, 0.7, 0.15)
  // dry-brush drag along the anvil's base and across the tower: the ink's own texture, no shapes
  let streak = ''
  for (let i = 0; i < 6; i++) {
    const y = 0.78 + i * 0.025, x0 = -0.2 + r() * 0.3
    const [ax, ay] = P(x0, y), [bx, by] = P(x0 + 0.5 + r() * 0.5, y - 0.02)
    streak += stroke([[ax, ay], [bx, by]], hc * 0.01, 0.2, 0.8, 0.05)
  }
  // rain: a slanting veil under the base, a few streaks in it
  let rain = ''
  for (let i = 0; i < 16; i++) {
    const x = cx - hc * 0.28 + r() * hc * 0.56
    rain += stroke([[x, base - hc * 0.02], [x - hc * 0.05, base + hc * 0.09]], 0.7 + r() * 0.8, 0.3, 0.6, 0.1)
  }
  const E = (cls: string, x: number, y: number, rx: number, ry: number, g: string) => s('ellipse', { class: cls, cx: f1(cx + x * hc), cy: f1(base - y * hc), rx: f1(rx * hc), ry: f1(ry * hc), fill: `url(#${g})` })
  return [
    s('defs', null, s('clipPath', { id }, s('path', { d: body }))),
    s('path', { class: 't37v-veil', d: `M${f1(cx - hc * 0.3)} ${f1(base - hc * 0.04)}L${f1(cx + hc * 0.3)} ${f1(base - hc * 0.04)}L${f1(cx + hc * 0.22)} ${f1(base + hc * 0.1)}L${f1(cx - hc * 0.38)} ${f1(base + hc * 0.1)}Z`, fill: 'url(#g13-fog)' }),
    s('path', { class: 't37v-rain', d: rain }),
    s('path', { class: 't37v-cb', d: body, fill: `url(#${G.body})`, filter: wash ? 'url(#ink-wash)' : null }),
    s('g', { 'clip-path': `url(#${id})` },
      // the heavy core and the rain-dark base, away from the moon
      E('t37v-cb-dark', 0.18, 0.28, 0.5, 0.42, G.dark),
      E('t37v-cb-dark', 0.05, 0.02, 0.55, 0.16, G.dark),
      E('t37v-cb-glow', 0.06, 0.36, 0.15, 0.2, G.glow),
      // the moon on the west flank, and along the anvil's top
      E('t37v-cb-lit', -0.34, 0.58, 0.32, 0.5, G.lit),
      E('t37v-cb-lit', 0.3, 1.0, 0.75, 0.08, G.lit),
      s('path', { class: 't37v-cb-streak', d: streak })),
    s('path', { class: 't37v-cb-rim', d: rim }),
    s('path', { class: 't37v-bolt', d: stroke([[cx + hc * 0.03, base - hc * 0.02], [cx - hc * 0.02, base + hc * 0.04], [cx + hc * 0.015, base + hc * 0.06], [cx - hc * 0.03, base + hc * 0.12]], 1.4, 0.1, 0.5, 0.2) }),
  ]
}

/** the north quarter's storm: far off on the horizon, a quarter of the frame tall, east of the stone you face */
const STORM = { k: 0.3 }
const north = (Q: number, H: number, hy: number, seed: number) => thunderhead(Q / 2 + Q * stormDx, hy - H * 0.004, H * STORM.k, seed)

/** south: the sun's rim about to burst over the water, rays fanning, cloud bars lit from below */
function south(Q: number, H: number, hy: number, seed: number): SVGElement[] {
  const r = rng(seed)
  const c = Q / 2, sr = H * 0.085
  let rays = ''
  for (let i = 0; i < 13; i++) {
    const a = (-78 + i * 13 + (r() - 0.5) * 5) * (Math.PI / 180), L = H * (0.34 + r() * 0.16), w = H * (0.012 + r() * 0.012)
    const tx = c + Math.sin(a) * L, ty = hy - Math.cos(a) * L
    rays += `M${f1(c)} ${f1(hy)}L${f1(tx - Math.cos(a) * w)} ${f1(ty - Math.sin(a) * w)}L${f1(tx + Math.cos(a) * w)} ${f1(ty + Math.sin(a) * w)}Z`
  }
  let dark = '', lit = ''
  for (let i = 0; i < 6; i++) {
    const y = hy - H * (0.05 + i * 0.05 + r() * 0.02), len = Q * (0.3 + r() * 0.32), x0 = c - len * (0.3 + r() * 0.4)
    const pts: Pt[] = [[x0, y], [x0 + len * 0.5, y - H * 0.008], [x0 + len, y + H * 0.004]]
    dark += stroke(pts, H * (0.016 + r() * 0.012), 0.3, 0.4, 0.06)
    lit += stroke(pts.map(([x, yy]) => [x + 4, yy + H * 0.008] as Pt), H * (0.007 + r() * 0.005), 0.3, 0.45, 0.06)
  }
  return [
    s('ellipse', { class: 't37v-warm', cx: f1(c), cy: f1(hy), rx: f1(Q * 0.62), ry: f1(H * 0.42), fill: 'url(#g13-sun)' }),
    dawnGlow(c, hy, Q * 0.75, H * 0.6, 3),
    s('circle', { class: 't37v-sunhalo', cx: f1(c), cy: f1(hy), r: f1(H * 0.34), fill: 'url(#g13-sun)' }),
    s('path', { class: 't37v-rays', d: rays }),
    s('path', { class: 't37v-dawncloud', d: dark, filter: 'url(#ink-wash)' }),
    s('path', { class: 't37v-cloudlit', d: lit }),
    s('circle', { class: 't37v-sun', cx: f1(c), cy: f1(hy + sr * 0.35), r: f1(sr) }),
  ]
}

/** west: the moon going down over the fields, a veil of mist across it */
const west = (Q: number, H: number, hy: number, seed: number): SVGElement[] => [
  // its light reaches well round into the north: the storm's west side is the lit one
  s('ellipse', { class: 't37v-moonhaze', cx: f1(Q * 0.56), cy: f1(hy - H * 0.19), rx: f1(Q * 1.05), ry: f1(H * 0.42), fill: 'url(#p2-halo)' }),
  fog(Q * 0.56, hy - H * 0.18, Q * 0.42, H * 0.2), moon(Q * 0.56, hy - H * 0.19, H * 0.06, seed, true)]

/** the far and mid shore for each quarter: hills, a bank with reeds; the village close across the water (east); the
 *  path off the shore into fields (west) */
function shore(kind: number, Q: number, H: number, hy: number, seed: number): SVGElement[] {
  const r = rng(seed + kind * 7)
  const c = Q / 2
  const bank = (x0: number, x1: number, y: number, k: number) => s('path', { class: 't37v-bankband', d: blob((x0 + x1) / 2, y, (x1 - x0) / 2, H * 0.012 * k, seed + kind, 0.25), filter: 'url(#ink-wash)' })
  const reedRow = (x0: number, x1: number, y: number, n: number, hh: number) => Array.from({ length: n }, (_, i) => reeds(x0 + ((x1 - x0) * (i + r() * 0.6)) / n, y, hh * (0.7 + r() * 0.6), seed + kind * 31 + i, 4 + Math.round(r() * 3)))
  if (kind === 1) {
    // the village right across the water: its bank comes below the horizon (near), houses with warm windows, smoke
    const yb = hy + H * 0.026, u = H * 0.06
    let roofs = '', walls = '', shade = '', win = '', smoke = '', edges = '', trees = ''
    const houses: [number, number, number][] = [[-3.1, -0.15, 0.82], [-1.5, 0.05, 1.08], [0.15, -0.1, 0.9], [1.75, 0.02, 1.14], [3.35, -0.12, 0.8]]
    for (const [dx, dy, k] of houses) {
      const hx = c + dx * u * 1.2, hb = yb + dy * u, q = u * k
      trees += blob(hx + q * 1.2, hb - q * 1.5, q * 0.9, q * 0.7, seed + Math.round(dx * 10), 0.3)
      walls += `M${f1(hx - q)} ${f1(hb)}h${f1(q * 2)}v${f1(-q * 1.05)}h${f1(-q * 2)}Z`
      shade += `M${f1(hx + q * 0.25)} ${f1(hb)}h${f1(q * 0.75)}v${f1(-q * 1.05)}h${f1(-q * 0.75)}Z`
      roofs += `M${f1(hx - q * 1.45)} ${f1(hb - q * 0.95)}Q${f1(hx - q * 0.7)} ${f1(hb - q * 1.85)} ${f1(hx)} ${f1(hb - q * 2.05)}Q${f1(hx + q * 0.7)} ${f1(hb - q * 1.85)} ${f1(hx + q * 1.45)} ${f1(hb - q * 0.95)}Z`
      win += `M${f1(hx - q * 0.66)} ${f1(hb - q * 0.74)}h${f1(q * 0.5)}v${f1(q * 0.42)}h${f1(-q * 0.5)}ZM${f1(hx + q * 0.12)} ${f1(hb - q * 0.74)}h${f1(q * 0.36)}v${f1(q * 0.42)}h${f1(-q * 0.36)}Z`
      edges += stroke([[hx - q * 1.5, hb - q * 0.95], [hx + q * 1.5, hb - q * 0.95]], 1.8, 0.1, 0.1, 0.4) + stroke([[hx - q, hb], [hx + q, hb]], 1.4, 0.1, 0.1, 0.4)
      smoke += stroke(curve([hx + q * 0.3, hb - q * 2], [hx - u * 0.5, hb - H * 0.1], [hx + u * 1.3, hb - H * (0.17 + r() * 0.05)], 16), u * 0.45, 0.1, 0.95, 0.1)
    }
    const pier = lines([[c + u * 0.8, yb + u * 0.05, c + u * 1.4, yb + H * 0.06], [c + u * 1.3, yb + u * 0.05, c + u * 1.9, yb + H * 0.06]], 1.6) + stroke([[c + u * 0.6, yb + H * 0.02], [c + u * 2.2, yb + H * 0.024]], 3, 0.1, 0.1, 0.4)
    return [
      hills(c - Q * 0.7, c + Q * 0.7, hy - H * 0.004, H * 0.045, seed + 1, 1, 4),
      s('path', { class: 't37v-smoke', d: smoke, filter: 'url(#ink-wash)' }),
      s('path', { class: 't37v-tree', d: trees, filter: 'url(#ink-wash)' }),
      bank(c - Q * 0.42, c + Q * 0.44, yb + H * 0.006, 1.6),
      ...houses.map(([dx, dy, k]) => s('circle', { cx: f1(c + dx * u * 1.2 - u * 0.3), cy: f1(yb + dy * u - u * k * 0.55), r: f1(u * k * 1.5), fill: 'url(#p2-lamp)', class: 't37v-winglow' })),
      s('path', { class: 't37v-wall', d: walls, filter: 'url(#ink-rough)' }),
      s('path', { class: 't37v-wall-sh', d: shade }),
      s('path', { class: 't37v-win', d: win }),
      s('path', { class: 't37v-roof', d: roofs, filter: 'url(#ink-rough)' }),
      s('path', { class: 'g13-ink', d: edges + pier }),
      ...reedRow(c - Q * 0.46, c - Q * 0.32, yb + H * 0.01, 3, H * 0.05),
    ]
  }
  if (kind === 3) {
    // a worn path from the water's edge winding back into terraced fields, a few trees, a farmhouse far off
    const y = hy + H * 0.02
    let rows = ''
    for (let i = 0; i < 9; i++) {
      const yy = y - i * H * 0.007, x0 = c - Q * (0.46 - i * 0.025), x1 = c + Q * (0.4 - i * 0.02)
      rows += stroke([[x0, yy], [(x0 + x1) / 2 - Q * 0.05, yy - H * 0.003], [x1, yy + H * 0.001]], 1.2, 0.2, 0.2, 0.2)
    }
    return [
      hills(c - Q * 0.7, c + Q * 0.6, hy - H * 0.012, H * 0.05, seed + 8, 0.95, 3),
      s('path', { class: 't37v-field', d: blob(c - Q * 0.04, y - H * 0.02, Q * 0.46, H * 0.04, seed + 5, 0.1) }),
      s('path', { class: 'g13-ink t37v-rows', d: rows }),
      s('path', { class: 't37v-path', d: stroke(curve([c + Q * 0.06, hy + H * 0.075], [c + Q * 0.26, hy + H * 0.02], [c - Q * 0.08, y - H * 0.05], 20), H * 0.016, 0.7, 0.05, 0.3) }),
      s('path', { class: 't37v-tree', d: blob(c - Q * 0.3, y - H * 0.085, H * 0.04, H * 0.03, seed + 6, 0.3) + blob(c + Q * 0.22, y - H * 0.1, H * 0.045, H * 0.034, seed + 7, 0.3) + blob(c - Q * 0.12, y - H * 0.07, H * 0.026, H * 0.02, seed + 9, 0.3) }),
      s('path', { class: 'g13-ink', d: lines([[c - Q * 0.3, y - H * 0.02, c - Q * 0.3, y - H * 0.075], [c + Q * 0.22, y - H * 0.03, c + Q * 0.22, y - H * 0.09], [c - Q * 0.12, y - H * 0.03, c - Q * 0.12, y - H * 0.06]], 1.8) }),
      s('path', { class: 't37v-farm', d: `M${f1(c + Q * 0.04)} ${f1(y - H * 0.045)}h${f1(H * 0.04)}v${f1(-H * 0.022)}h${f1(-H * 0.04)}ZM${f1(c + Q * 0.04 - H * 0.008)} ${f1(y - H * 0.065)}L${f1(c + Q * 0.04 + H * 0.02)} ${f1(y - H * 0.085)}L${f1(c + Q * 0.04 + H * 0.048)} ${f1(y - H * 0.065)}Z` }),
      bank(c - Q * 0.5, c - Q * 0.02, hy + H * 0.012, 1.1),
      ...reedRow(c + Q * 0.28, c + Q * 0.46, hy + H * 0.018, 3, H * 0.05),
    ]
  }
  // north and south: far ranges low on the horizon, a long bank with reeds
  return [
    hills(c - Q * 0.7, c + Q * 0.7, hy, H * (kind ? 0.06 : 0.04), seed + 2, kind ? 0.75 : 1, kind ? 3 : 5),
    bank(c - Q * 0.5, c + Q * 0.5, hy + H * 0.008, 1),
    ...reedRow(c - Q * 0.48, c - Q * 0.2, hy + H * 0.014, 3, H * 0.045),
    ...reedRow(c + Q * 0.22, c + Q * 0.48, hy + H * 0.014, 2, H * 0.04),
  ]
}

/** the water of each quarter: dry-brush ripples, what stands on its horizon mirrored, the moon's glints */
function water(kind: number, Q: number, H: number, hy: number, seed: number): SVGElement[] {
  const r = rng(seed + 40 + kind)
  const c = Q / 2
  let rip = '', glint = ''
  for (let i = 0; i < 26; i++) {
    const y = hy + H * 0.01 + Math.pow(r(), 1.5) * (H - hy), near = (y - hy) / (H - hy), len = Q * (0.03 + near * 0.12) * (0.5 + r())
    const x = r() * Q
    rip += stroke([[x, y], [x + len, y + 0.5]], 0.6 + near * 1.6, 0.3, 0.3, 0.1)
  }
  for (let i = 0; i < 18; i++) {
    const y = hy + H * 0.02 + Math.pow(r(), 1.3) * (H - hy) * 0.8, near = (y - hy) / (H - hy), len = Q * (0.008 + near * 0.03)
    const x = c + (r() - 0.5) * Q * 0.9
    glint += stroke([[x, y], [x + len, y + 0.3]], 0.8 + near * 1.4, 0.3, 0.3, 0.1)
  }
  const roadOf = (x: number, y0: number, len: number, wd: number) => {
    let d = ''
    for (let i = 0; i < 16; i++) {
      const t = i / 15, y = y0 + t * len, l = wd * (0.4 + t * 1.6) * (0.5 + r())
      d += stroke([[x - l / 2 + (r() - 0.5) * wd * 0.4, y], [x + l / 2, y + 0.5]], 1 + t * 2.4, 0.3, 0.3, 0.1)
    }
    return d
  }
  const out: SVGElement[] = [s('path', { class: 't37v-rip', d: rip }), s('path', { class: 't37v-glint', d: glint })]
  if (kind === 0) {
    // the storm upside down in the water: darker than itself, broken into ripple bars, gone a little way down
    const hc = H * STORM.k, sx = c + Q * stormDx, gap = Math.max(3, H * 0.009)
    let refl = ''
    for (let y = hy + gap * 0.6, i = 0; y < hy + hc * 0.85; y += gap, i++) {
      const t = (y - hy) / (hc * 0.95)
      const u = Math.max(0, (t - 0.62) / 0.36)
      const [x0, x1] = t < 0.64 ? [sx - cbHalf(t) * hc, sx + cbHalf(t) * hc + t * hc * 0.12] : [sx - hc * (0.28 + u * 0.24), sx + hc * (0.3 + u * u * 0.95)]
      // two or three pieces, the gaps where the wind roughs the water
      const cut1 = x0 + (x1 - x0) * (0.28 + r() * 0.2), cut2 = cut1 + (x1 - x0) * (0.05 + r() * 0.06)
      const wd = gap * (0.62 - t * 0.25)
      refl += stroke([[x0 + (r() - 0.5) * gap * 2, y], [cut1, y + 0.4]], wd, 0.3, 0.3, 0.1) + stroke([[cut2, y], [x1 + (r() - 0.5) * gap * 2, y + 0.4]], wd, 0.3, 0.3, 0.1)
      if (i > 60) break
    }
    out.push(s('path', { class: 't37v-stormrefl', d: refl, fill: `url(#${G.refl})` }), s('path', { class: 't37v-boltrefl', d: roadOf(sx, hy + H * 0.012, hc * 0.2, H * 0.006) }))
  }
  if (kind === 1) out.push(s('path', { class: 't37v-winrefl', d: [-3.1, -1.5, 0.15, 1.75, 3.35].map((dx) => roadOf(c + dx * H * 0.06 * 1.2 - H * 0.025, hy + H * 0.04, H * 0.13, H * 0.016)).join('') }))
  if (kind === 2) out.push(s('ellipse', { class: 't37v-warm', cx: f1(c), cy: f1(hy + H * 0.02), rx: f1(Q * 0.4), ry: f1(H * 0.1), fill: 'url(#g13-sun)' }), s('path', { class: 't37v-dawnrefl', d: roadOf(c, hy + H * 0.008, (H - hy) * 0.85, Q * 0.07) }))
  if (kind === 3) out.push(s('path', { class: 't37v-moonrefl', d: roadOf(Q * 0.56, hy + H * 0.01, (H - hy) * 0.5, Q * 0.03) }))
  return out
}

/** near you, in the water: reeds and lotus pads at the quarter's sides, cut by the frame */
function near(kind: number, Q: number, H: number, seed: number): SVGElement[] {
  const r = rng(seed + 70 + kind)
  const c = Q / 2
  // a low flat rock awash between this stone and the next, moss on its crown, its double broken in the water and the
  // ripples it makes (it fills the open water of a wide view; a tall view never sees it)
  const rx = c + Q * 0.47, ry = H * 0.82, rw = H * 0.2
  let rip = ''
  for (const [k, a0, a1] of [[1, 0.02, 0.4], [1, 0.6, 0.98], [1.35, 0.1, 0.3], [1.35, 0.7, 0.9], [1.7, 0.2, 0.36]] as const)
    rip += stroke(Array.from({ length: 9 }, (_, q) => {
      const a = Math.PI * (a0 + ((a1 - a0) * q) / 8)
      return [rx + Math.cos(a) * rw * 0.62 * k, ry + 1 + Math.sin(a) * rw * 0.1 * k] as Pt
    }), 1.4 / k, 0.3, 0.3, 0.1)
  return [
    s('g', { class: 't37v-mirror', transform: `translate(${f1(rx)} ${f1(ry)}) scale(1 -0.5)` }, stoneArt(rw, rw * 0.28, seed + 80 + kind)),
    s('path', { class: 't37v-wetring', d: rip }),
    s('g', { transform: `translate(${f1(rx)} ${f1(ry)})` }, stoneArt(rw, rw * 0.28, seed + 80 + kind)),
    s('path', { class: 't37v-moss', d: blob(rx - rw * 0.08, ry - rw * 0.22, rw * 0.24, rw * 0.05, seed + 90 + kind, 0.3) }),
    reeds(c - Q * 0.42 + r() * Q * 0.06, H * 1.0, H * 0.22, seed + 10 + kind, 7),
    reeds(c + Q * 0.38 + r() * Q * 0.06, H * 1.0, H * 0.16, seed + 14 + kind, 5),
    s('path', { class: 't37v-pad', d: blob(c + Q * 0.28, H * 0.95, H * 0.06, H * 0.017, seed + 11, 0.2) + blob(c + Q * 0.33, H * 0.975, H * 0.035, H * 0.011, seed + 12, 0.2) + blob(c - Q * 0.3, H * 0.93, H * 0.04, H * 0.012, seed + 13, 0.2) }),
  ]
}

/** the little planet: one pond, the four horizons curled round its rim as big silhouettes, each pointing outward */
function planet(cx: number, cy: number, R: number, seed: number, W = Infinity): SVGElement[] {
  const r = rng(seed + 99)
  const gid = nextId('t37v-pl')
  const stop = (o: number, a: number, cls: string) => s('stop', { offset: o, class: cls, 'stop-opacity': a })
  const out: SVGElement[] = [
    s('defs', null,
      s('radialGradient', { id: `${gid}-s` }, stop(0, 1, 't37v-pls'), stop(0.55, 0.7, 't37v-pls'), stop(1, 0, 't37v-pls')),
      s('radialGradient', { id: `${gid}-l` }, stop(0, 1, 't37v-pll'), stop(0.72, 0.9, 't37v-pll'), stop(1, 0, 't37v-pll')),
      s('radialGradient', { id: `${gid}-w`, cx: 0.45, cy: 0.42 }, stop(0, 1, 't37v-plw0'), stop(0.7, 1, 't37v-plw1'), stop(1, 1, 't37v-plw2'))),
    s('circle', { cx: f1(cx), cy: f1(cy), r: f1(R * 2.2), fill: `url(#${gid}-s)` }),
    s('circle', { cx: f1(cx), cy: f1(cy), r: f1(R * 1.5), fill: `url(#${gid}-l)` }),
  ]
  // each horizon, big, its foot on the rim, turned to its compass point (outward is up)
  for (const kind of [0, 1, 2, 3]) out.push(s('g', { class: `t37v-pl-q q${kind}`, transform: `translate(${f1(cx)} ${f1(cy)}) rotate(${AT[kind]}) translate(0 ${f1(-R * 1.03)}) scale(1.6)` }, ...vignette(kind, R, seed)))

  let moss = ''
  for (let i = 0; i < 60; i++) {
    const a = r() * Math.PI * 2, d = R * (1.0 + r() * 0.1)
    moss += blob(cx + Math.cos(a) * d, cy + Math.sin(a) * d, R * (0.025 + r() * 0.04), R * (0.018 + r() * 0.02), seed + i, 0.3, 8)
  }
  out.push(s('circle', { class: 't37v-pl-shore', cx: f1(cx), cy: f1(cy), r: f1(R * 1.07) }), s('path', { class: 't37v-pl-moss', d: moss }))
  let rip = ''
  for (let i = 0; i < 9; i++) {
    const k = 0.32 + i * 0.075, a0 = r() * 360
    for (let j = 0; j < 3; j++) {
      const a = ((a0 + j * 120 + r() * 30) * Math.PI) / 180, span = 0.6 + r() * 0.6
      rip += stroke(Array.from({ length: 8 }, (_, q) => [cx + Math.cos(a + (q / 7) * span) * R * k, cy + Math.sin(a + (q / 7) * span) * R * k] as Pt), 0.8 + k * 1.4, 0.3, 0.3, 0.1)
    }
  }
  out.push(
    s('circle', { cx: f1(cx), cy: f1(cy), r: f1(R), fill: `url(#${gid}-w)` }),
    s('ellipse', { class: 't37v-pl-dawn', cx: f1(cx), cy: f1(cy + R * 0.6), rx: f1(R * 0.5), ry: f1(R * 0.28) }),
    s('ellipse', { class: 't37v-pl-cloud', cx: f1(cx), cy: f1(cy - R * 0.6), rx: f1(R * 0.45), ry: f1(R * 0.22) }),
    s('path', { class: 't37v-pl-rip', d: rip }),
    s('ellipse', { class: 't37v-pl-moon', cx: f1(cx - R * 0.5), cy: f1(cy - R * 0.1), rx: f1(R * 0.1), ry: f1(R * 0.05) }),
    s('path', { class: 't37v-pl-rim', d: stroke(Array.from({ length: 40 }, (_, q) => [cx + Math.cos(Math.PI * (0.95 + q * 0.028)) * R * 0.99, cy + Math.sin(Math.PI * (0.95 + q * 0.028)) * R * 0.99] as Pt), Math.max(1.5, R * 0.015), 0.2, 0.2, 0.2) }))
  // each horizon carries the name of the view it stands for, upright, out past the shore (audit 37-4)
  for (const kind of [0, 1, 2, 3]) {
    const a = (AT[kind] * Math.PI) / 180, d = R * (kind % 2 ? 1.2 : 1.16)
    const text = (V.carve[kind] ?? []).join(' '), fs = Math.max(13, R * 0.12), tw = text.length * fs * 0.52
    const x = cx + Math.sin(a) * d
    let y = cy - Math.cos(a) * d + (kind === 2 ? R * 0.1 : kind ? R * 0.04 : 0)
    // a narrow frame: a side name that would run off the edge breaks onto its carved lines
    const lines = V.carve[kind] ?? []
    const split = lines.length > 1 && ((kind === 3 && x - tw < 4) || (kind === 1 && x + tw > W - 4))
    if (split) y -= fs * 0.5
    out.push(s('text', { class: 't37v-pl-name', x: f1(x), y: f1(y), 'text-anchor': kind === 1 ? 'start' : kind === 3 ? 'end' : 'middle', 'font-size': f1(fs) },
      ...(split ? lines.map((l, j) => s('tspan', { x: f1(x), dy: j ? f1(fs * 1.15) : '0' }, l)) : [text])))
  }
  return out
}

/** one horizon of the little planet as a big silhouette: foot at 0, 0 on the rim, outward toward −y, ~0.8 R tall */
function vignette(kind: number, R: number, seed: number): SVGElement[] {
  const reedsAt = (x: number, k: number) => reeds(x, 0, R * 0.16 * k, seed + kind * 13 + Math.round(x), 5)
  if (kind === 0) return [...thunderhead(-R * 0.1, 0, R * 0.66, seed + 5, false), reedsAt(-R * 0.4, 1), reedsAt(R * 0.36, 0.8)]
  if (kind === 1) {
    // the village: houses with lit windows, smoke rising
    const u = R * 0.11
    let roofs = '', walls = '', win = '', smoke = ''
    for (const [dx, k] of [[-2.2, 0.8], [-0.6, 1.1], [1.0, 0.9], [2.5, 0.75]] as const) {
      const hx = dx * u * 1.1, q = u * k
      walls += `M${f1(hx - q)} 0h${f1(q * 2)}v${f1(-q * 1.0)}h${f1(-q * 2)}Z`
      roofs += `M${f1(hx - q * 1.45)} ${f1(-q * 0.85)}Q${f1(hx - q * 0.6)} ${f1(-q * 1.95)} ${f1(hx)} ${f1(-q * 2.1)}Q${f1(hx + q * 0.6)} ${f1(-q * 1.95)} ${f1(hx + q * 1.45)} ${f1(-q * 0.85)}Z`
      win += `M${f1(hx - q * 0.55)} ${f1(-q * 0.66)}h${f1(q * 0.44)}v${f1(q * 0.38)}h${f1(-q * 0.44)}Z`
      smoke += stroke(curve([hx + q * 0.3, -q * 2], [hx - u * 0.6, -R * 0.36], [hx + u * 1.4, -R * 0.66], 12), u * 0.36, 0.05, 0.9, 0.1)
    }
    return [
      s('path', { class: 't37v-smoke', d: smoke, filter: 'url(#ink-wash)' }),
      s('circle', { cx: 0, cy: f1(-u * 0.6), r: f1(R * 0.36), fill: 'url(#p2-lamp)', class: 't37v-winglow' }),
      s('path', { class: 't37v-wall', d: walls }), s('path', { class: 't37v-win', d: win }), s('path', { class: 't37v-roof', d: roofs, filter: 'url(#ink-rough)' }),
      reedsAt(-R * 0.42, 0.8),
    ]
  }
  if (kind === 2) {
    // the dawn about to blaze: the sun's rim on the edge, rays fanning, cloud bars lit from below
    let rays = ''
    for (let i = 0; i < 9; i++) {
      const a = (-72 + i * 18) * (Math.PI / 180), L = R * (0.7 + (i % 2) * 0.16), w = R * 0.035
      const tx = Math.sin(a) * L, ty = -Math.cos(a) * L
      rays += `M0 0L${f1(tx - Math.cos(a) * w)} ${f1(ty - Math.sin(a) * w)}L${f1(tx + Math.cos(a) * w)} ${f1(ty + Math.sin(a) * w)}Z`
    }
    let dark = '', lit = ''
    for (let i = 0; i < 4; i++) {
      const y = -R * (0.2 + i * 0.13), len = R * (0.9 - i * 0.14)
      const pts: Pt[] = [[-len / 2, y], [0, y - R * 0.02], [len / 2, y + R * 0.01]]
      dark += stroke(pts, R * 0.045, 0.3, 0.4, 0.06)
      lit += stroke(pts.map(([x, yy]) => [x + 3, yy + R * 0.02] as Pt), R * 0.02, 0.3, 0.45, 0.06)
    }
    return [dawnGlow(0, 0, R * 1.2, R * 0.95, 3), s('circle', { class: 't37v-sunhalo', cx: 0, cy: 0, r: f1(R * 0.5), fill: 'url(#g13-sun)' }), s('path', { class: 't37v-rays', d: rays }), s('path', { class: 't37v-dawncloud', d: dark, filter: 'url(#ink-wash)' }), s('path', { class: 't37v-cloudlit', d: lit }),
      s('path', { class: 't37v-sun', d: `M${f1(-R * 0.2)} 0A${f1(R * 0.2)} ${f1(R * 0.2)} 0 0 1 ${f1(R * 0.2)} 0Z` })]
  }
  // the worn path out into ordinary fields, trees, the moon going down beyond
  let rows = ''
  for (let i = 0; i < 6; i++) rows += stroke([[-R * 0.5, -R * (0.06 + i * 0.05)], [R * 0.16, -R * (0.07 + i * 0.05)]], 1.2, 0.2, 0.2, 0.2)
  return [
    s('g', { transform: `rotate(-${AT[3]}) translate(${f1(-R * 0.62)} ${f1(-R * 0.1)})` }, moon(0, 0, R * 0.09, seed, false)),
    s('path', { class: 't37v-field', d: blob(-R * 0.16, -R * 0.17, R * 0.38, R * 0.16, seed + 5, 0.1) }),
    s('path', { class: 'g13-ink t37v-rows', d: rows }),
    s('path', { class: 't37v-path', d: stroke(curve([R * 0.05, 0], [R * 0.24, -R * 0.2], [-R * 0.06, -R * 0.44], 14), R * 0.04, 0.6, 0.1, 0.4) }),
    s('path', { class: 't37v-tree', d: blob(R * 0.34, -R * 0.27, R * 0.08, R * 0.06, seed + 6, 0.3) + blob(-R * 0.4, -R * 0.4, R * 0.07, R * 0.05, seed + 7, 0.3) }),
    s('path', { class: 'g13-ink', d: lines([[R * 0.34, -R * 0.12, R * 0.34, -R * 0.23], [-R * 0.4, -R * 0.27, -R * 0.4, -R * 0.36]], 1.8) }),
    reedsAt(R * 0.44, 0.9),
  ]
}

function stage(ctx: SceneCtx, host: HTMLElement, api: CircleApi, hooks: Hooks): () => void {
  g13Defs()
  const still = ctx.quality === 'low' || ctx.reduced
  const planes = PLANES.map((_, p) => {
    const svg = s('svg', { class: 't37v-svg', 'aria-hidden': 'true' })
    const el = h('div', { class: `t37v-plane p${p}` }, svg)
    return { el, svg }
  })
  const column = s('svg', { class: 't37v-column', 'aria-hidden': 'true' })
  const own = s('svg', { class: 't37v-own', 'aria-hidden': 'true' })
  const pl = s('svg', { class: 't37v-planet', 'aria-hidden': 'true' })
  // water: pale where it mirrors the sky at the horizon, deep toward you
  const wid = nextId('t37v-w')
  G.body = nextId('t37v-gb')
  G.glow = nextId('t37v-gg')
  G.refl = nextId('t37v-gr')
  G.dark = nextId('t37v-gd')
  G.lit = nextId('t37v-gl')
  const stop = (o: number, cls: string, a = 1) => s('stop', { offset: o, class: cls, 'stop-opacity': a })
  const defs = s('svg', { class: 'visually-hidden', 'aria-hidden': 'true' }, s('defs', null, s('linearGradient', { id: wid, x1: 0, y1: 0, x2: 0, y2: 1 },
    s('stop', { offset: 0, class: 't37v-w0' }), s('stop', { offset: 0.3, class: 't37v-w1' }), s('stop', { offset: 1, class: 't37v-w2' })),
    // the cloud: crowns pale toward the moon, the foot heavy with rain
    s('linearGradient', { id: G.body, x1: 0, y1: 0, x2: 0.25, y2: 1 }, stop(0, 't37v-gb0'), stop(0.55, 't37v-gb1'), stop(1, 't37v-gb2')),
    s('radialGradient', { id: G.glow }, stop(0, 't37v-gg', 0.85), stop(0.5, 't37v-gg', 0.3), stop(1, 't37v-gg', 0)),
    s('linearGradient', { id: G.refl, x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, 't37v-gr', 1), stop(1, 't37v-gr', 0)),
    s('radialGradient', { id: G.dark }, stop(0, 't37v-gd', 1), stop(0.6, 't37v-gd', 0.6), stop(1, 't37v-gd', 0)),
    s('radialGradient', { id: G.lit }, stop(0, 't37v-gl', 1), stop(0.55, 't37v-gl', 0.5), stop(1, 't37v-gl', 0))))
  const pan = h('div', { class: 't37v-pan' }, defs, ...planes.map((p) => p.el), column, own)
  const plEl = h('div', { class: 't37v-pl' }, pl)
  const turn = h('div', { class: 't37v-turn', tabindex: '0', role: 'group', 'aria-label': V.art, 'aria-description': V.hint }, pan, plEl)
  host.append(turn)
  const root = host.closest<HTMLElement>('.p2c')!
  const stageEl = host.parentElement as HTMLElement

  let W = 0, SH = 0, tall = false
  /** where the way you face meets the frame (share of its width) */
  let AX = 0.5
  let feet: { x: number; y: number; s: number }[] = []
  let Q = 400 // px per quarter
  let stoneW = 170, bwPx = 140
  let P = { cx: 0, cy: 0, R: 0 } // the planet
  let yaw = 0, want = 0, vel = 0
  let dwell = 0
  let facing = -2
  const stones = () => [...root.querySelectorAll<HTMLButtonElement>('.p2c-stone')]
  const wrap = (a: number) => ((a % 360) + 540) % 360 - 180

  /** draw the panorama (each quarter painted once per plane, used six times round) and the planet for this size */
  function draw() {
    const hh = SH, hy = hh * (tall ? 0.4 : 0.46)
    // a wide frame sees 140°: the faced stone stands in the left third, the next one peeks in at the right edge
    const fov = tall ? 70 : 140
    Q = (W * 90) / fov
    AX = tall ? 0.5 : 0.31
    stormDx = tall ? 0.14 : 0.55
    STORM.k = tall ? 0.2 : 0.3
    // low / reduced motion never turns: the little planet is all there is, so the panorama is not painted at all
    if (still) planes.forEach(({ svg }) => svg.replaceChildren())
    else planes.forEach(({ svg }, p) => {
      svg.setAttribute('viewBox', `0 0 ${f1(Q * 6)} ${f1(hh)}`)
      svg.setAttribute('width', f1(Q * 6))
      svg.setAttribute('height', f1(hh))
      const id = nextId(`t37v-q${p}`)
      const art = (kind: number) =>
        p === 0 ? (kind === 0 ? north(Q, hh, hy, 3750) : kind === 2 ? south(Q, hh, hy, 3750) : kind === 3 ? west(Q, hh, hy, 3750) : [mist(Q / 2, hy - hh * 0.1, Q * 0.5, hh * 0.07)])
          : p === 1 ? shore(kind, Q, hh, hy, 3750) : p === 2 ? water(kind, Q, hh, hy, 3750) : near(kind, Q, hh, 3750)
      const kids: SVGElement[] = [s('defs', null, ...[0, 1, 2, 3].map((kind) => s('g', { id: `${id}-${kind}` }, ...art(kind))))]
      if (p === 2) kids.push(s('rect', { class: 't37v-water', x: 0, y: f1(hy), width: f1(Q * 6), height: f1(hh - hy), fill: `url(#${wid})` }))
      if (p === 1) kids.push(s('g', { class: 't37v-range' }, hills(0, Q * 6, hy, hh * 0.05, 3753, 1, 22)))
      for (let j = -1; j <= 4; j++) kids.push(s('use', { href: `#${id}-${(j + 4) % 4}`, transform: `translate(${f1((j + 1) * Q)} 0)` }))
      if (p === 1) kids.push(mist(Q * 3, hy - hh * 0.004, Q * 3.2, hh * 0.025), s('rect', { class: 't37v-horizon', x: 0, y: f1(hy - 1), width: f1(Q * 6), height: 2 }))
      svg.replaceChildren(...kids)
    })
    // you stand on a dark stone at the bottom; the moon's broken road runs to it on the water
    const cx = W * AX
    own.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(hh)}`)
    own.replaceChildren(s('g', { transform: `translate(${f1(tall ? cx : W * 0.56)} ${f1(hh * (tall ? 1.05 : 1.1))})` }, stoneArt(Math.min(W * 0.46, 420), hh * 0.12, 3751)))
    column.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(hh)}`)
    let road = '', spec = ''
    const r = rng(3752)
    for (let i = 0; i < 30; i++) {
      const t = i / 29, y = hy + hh * 0.008 + Math.pow(t, 1.3) * (hh - hy) * 0.86, len = W * (0.02 + t * 0.12) * (0.5 + r() * 0.7)
      road += stroke([[cx - len / 2 + (r() - 0.5) * W * 0.02, y], [cx + len / 2, y + 0.5]], 1.2 + t * 3.4, 0.3, 0.3, 0.1)
      if (i % 3 === 0) spec += stroke([[cx - len * 0.12, y - 1], [cx + len * 0.14, y - 0.6]], 1 + t * 1.6, 0.3, 0.3, 0.1)
    }
    column.replaceChildren(s('g', { class: 't37v-road' }, s('path', { d: road }), s('path', { class: 't37v-spec', d: spec })))
    // the planet: about 70 % of the frame's height with its horizons; the slip beside it (wide) or under (tall)
    // (the pond R, its horizons reaching about 1.1 R further: the whole ≈ 0.8 of the frame's height)
    P = tall ? { cx: W / 2, cy: hh * 0.42, R: Math.min(W * 0.24, hh * 0.15) } : { cx: W * 0.33, cy: hh * 0.53, R: hh * 0.215 }
    pl.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(hh)}`)
    pl.replaceChildren(...planet(P.cx, P.cy, P.R, 3750, W))
    apply()
  }

  /** the reading slip: floating on the water by the faced stone (wide), beside the planet (wide, all heard), under the
   *  picture (tall) */
  function placeCard() {
    const card = root.querySelector<HTMLElement>('.p2c-card')
    if (!card) return
    card.classList.add('t37v-slip')
    if (tall) {
      // a tall frame: the words lie on the near water under the stone and the compass
      const top = SH * 0.685
      return void Object.assign(card.style, { left: '0px', top: `${f1(top)}px`, width: `${f1(W)}px`, maxHeight: `${f1(root.clientHeight - top - 2)}px`, transform: 'none' })
    }
    // on the water beside the faced stone (all heard: in the right column, where the insight will be)
    const w = Math.min(340, W * 0.26)
    const x = hooks.all ? W * 0.64 : W * AX + stoneW * 0.64
    Object.assign(card.style, { left: `${f1(x)}px`, top: `${f1(hooks.all ? SH * 0.2 : SH * 0.56)}px`, width: `${f1(w)}px`, maxHeight: `${f1(SH * 0.4)}px`, transform: '' })
  }

  const stoneAt = (k: number) => AT[hooks.view[k] ?? k]
  /** write the turn: each plane slides at its own rate; the stones ride on the near plane; the moon's road leans */
  function apply() {
    if (!W) return
    const pxPerDeg = Q / 90, cx = W * AX
    // parallax: each plane slides a little more or less than the turn, but all agree at every quarter's middle (period 90°)
    const par = (p: number) => (PLANES[p] - 1) * pxPerDeg * (90 / (2 * Math.PI)) * Math.sin((2 * Math.PI * yaw) / 90)
    planes.forEach(({ el }, p) => {
      // x of the panorama's 0° at the screen centre, wrapped so a full copy always covers the frame
      let x = cx - (Q + Q / 2) - yaw * pxPerDeg - par(p)
      x = ((x % (Q * 4)) + Q * 4) % (Q * 4) - Q * 4
      el.style.transform = `translateX(${f1(x)}px)`
    })
    const all = hooks.all
    stones().forEach((b, k) => {
      const f = feet[k]
      if (!f) return
      if (all) {
        // standing in the planet's pond, just inside the shore below their own horizon
        const a = ((stoneAt(k) - 90) * Math.PI) / 180, R = P.R * 0.66
        b.style.transform = `translate(${f1(P.cx + Math.cos(a) * R - f.x)}px, ${f1(P.cy + Math.sin(a) * R + P.R * 0.08 - f.y)}px) scale(${f1((P.R * 0.55) / bwPx)})`
        b.style.visibility = ''
        return
      }
      const x = wrap(stoneAt(k) - yaw) * pxPerDeg - par(3)
      b.style.transform = `translate(${f1(cx + x - f.x)}px, ${f1(SH * (tall ? 0.58 : 0.88) - f.y)}px) scale(${f1(stoneW / bwPx)})`
      b.style.visibility = cx + x < -stoneW * 0.55 || cx + x > W + stoneW * 0.3 ? 'hidden' : ''
    })
    // the moon's road leans toward the stone you face; the compass marks that way
    const n = nearest()
    if (n.k !== facing) {
      facing = n.k
      hooks.facing(n.k >= 0 && Math.abs(n.d) < 30 ? (hooks.view[n.k] ?? n.k) : -1)
    }
    const lean = n.k >= 0 ? clamp(n.d / 30, -1, 1) * 9 : 0
    ;(column.firstChild as SVGGElement | null)?.setAttribute('transform', `rotate(${f1(-lean)} ${f1(cx)} ${f1(SH * (tall ? 0.4 : 0.46))})`)
  }
  function nearest() {
    let k = -1, d = 999
    for (let i = 0; i < 4; i++) {
      const dd = wrap(stoneAt(i) - yaw)
      if (Math.abs(dd) < Math.abs(d)) (d = dd), (k = i)
    }
    return { k, d }
  }

  // ── turning: drag with inertia, ←/→, or fly to a stone; facing one 0.6 s hears it
  const loop = createLoop(turn, (_t, dt) => {
    if (!drag) {
      want += vel * dt
      vel *= Math.exp(-dt * 3)
    }
    yaw += (want - yaw) * (dt > 0 ? 1 - Math.exp(-dt * 8) : 1)
    apply()
    const moving = !!drag || Math.abs(vel) > 0.6 || Math.abs(want - yaw) > 0.05
    if (!moving) settle()
    return moving
  })
  const go = (to: number) => {
    want = to
    vel = 0
    if (ctx.reduced) (yaw = want), apply(), settle()
    else loop.start()
  }
  /** came to rest: if a stone is in front, hear it after a breath */
  function settle() {
    clearTimeout(dwell)
    hooks.laid() // the guide's dot follows its stone to where the turn left it (one read, when the turn stops)
    if (hooks.all) return
    const n = nearest()
    if (n.k < 0 || Math.abs(n.d) > 18) return
    dwell = window.setTimeout(() => !hooks.heard.has(n.k) && api.pick(n.k), ctx.reduced ? 0 : 600)
  }
  hooks.face = (k) => go(yaw + wrap(stoneAt(k) - yaw)) // the shortest way round to stone k
  let drag: { id: number; x: number; t: number; y0: number; moved: boolean } | null = null
  turn.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || hooks.all || still) return
    drag = { id: e.pointerId, x: e.clientX, t: performance.now(), y0: want, moved: false }
    vel = 0
    clearTimeout(dwell)
  })
  turn.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return
    const dx = e.clientX - drag.x
    if (!drag.moved && Math.abs(dx) < 5) return
    if (!drag.moved) (drag.moved = true), turn.setPointerCapture(e.pointerId), turn.classList.add('grabbing'), hooks.turned()
    const now = performance.now(), dt = Math.max(8, now - drag.t) / 1000
    const next = drag.y0 - (dx * 90) / Q
    vel = vel * 0.4 + ((next - want) / dt) * 0.6
    want = next
    drag.t = now
    loop.start()
  })
  const up = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return
    if (performance.now() - drag.t > 90) vel = 0
    drag = null
    turn.classList.remove('grabbing')
    loop.start()
  }
  turn.addEventListener('pointerup', up)
  turn.addEventListener('pointercancel', up)
  turn.addEventListener('keydown', (e) => {
    if (hooks.all || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return
    e.preventDefault()
    go(want + (e.key === 'ArrowRight' ? 30 : -30))
  })

  // the component lays its stage out beside its card; this scene takes the whole frame (a tall one: the top 60 %, the
  // slip under it), so every layout the stage is resized and the stones are moved from where the component put them
  api.onLayout((_geo, ft) => {
    feet = ft
    // say who stands there, not "stone n" (once heard, the component names it itself)
    stones().forEach((b, k) => !hooks.heard.has(k) && b.setAttribute('aria-label', fill(V.stoneAria, { who: V.perspectives.stones[hooks.view[k] ?? k].who })))
    W = ctx.art.clientWidth
    const H = root.clientHeight
    tall = W / H < 1.15
    SH = H
    root.classList.toggle('t37v-tall', tall)
    Object.assign(stageEl.style, { left: '0px', width: `${f1(W)}px`, height: `${f1(SH)}px` })
    bwPx = parseFloat(stones()[0]?.style.width || '140') || 140
    stoneW = tall ? Math.min(W * 0.52, 200) : clamp(W * 0.17, 230, 290)
    draw()
    placeCard()
    hooks.laid()
  })
  hooks.redraw = () => (apply(), placeCard())
  if (still) hooks.planetNow()
  // 1–4 = north, east, south, west (the component's own digits follow its shuffled order, so they are caught first)
  const keys = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey || !/^[1-4]$/.test(e.key)) return
    const k = hooks.view.indexOf(Number(e.key) - 1)
    if (k < 0) return
    e.preventDefault()
    api.pick(k)
  }
  document.addEventListener('keydown', keys)
  hooks.pick = (d) => api.pick(hooks.view.indexOf(d))
  // H7: standing still, the view drifts 8° toward the nearest stone not heard yet, then back
  let back = 0
  const invite = () => {
    if (hooks.all || drag || still) return
    let best = 0
    for (let k = 0; k < 4; k++) if (!hooks.heard.has(k) && (!best || Math.abs(wrap(stoneAt(k) - yaw)) < Math.abs(best))) best = wrap(stoneAt(k) - yaw) || 1
    if (!best) return
    const from = want
    go(want + Math.sign(best) * 8)
    clearTimeout(back)
    back = window.setTimeout(() => !drag && go(from), 900)
  }
  ctx.el.addEventListener('p2:idle', invite)
  return () => {
    clearTimeout(dwell)
    clearTimeout(back)
    loop.dispose()
    document.removeEventListener('keydown', keys)
    ctx.el.removeEventListener('p2:idle', invite)
  }
}

type Hooks = {
  view: number[]; heard: Set<number>; all: boolean; face: (k: number) => void; redraw: () => void; planetNow: () => void
  /** the compass: hear the stone standing that way (0 north … 3 west); mark the way you face; the first turn by hand */
  pick: (d: number) => void; facing: (d: number) => void; turned: () => void; laid: () => void
}

export const viewsScene: SceneDef = {
  label: V.label,
  text: 'br',
  mount(ctx) {
    const hooks: Hooks = { view: [], heard: new Set(), all: false, face: () => {}, redraw: () => {}, planetNow: () => {}, pick: () => {}, facing: () => {}, turned: () => {}, laid: () => {} }
    ctx.art.classList.add('t37v-art')
    ctx.onCleanup(() => ctx.art.classList.remove('t37v-art'))
    const n = V.perspectives.stones.length
    const g = guide(ctx)
    let arrows: Mark[] = []
    // the insight (with the evidence dilemma in its detail) once all four are heard; no common line under the planet
    const def = perspectiveCircle(V.perspectives, {
      label: V.label,
      prompt: V.prompt,
      detail: V.detail,
      // every stone stands in the near water at the middle of the frame; the stage slides it round as you turn
      place: (_k, _n, g) => ({ x: g.w / 2, y: g.h * 0.86, s: 1.1, z: 5 }),
      stone: (k, _g, i) => ((hooks.view[k] = i), speaker(i)),
      onHear: (k) => {
        hooks.heard.add(k)
        markNext()
        compass.querySelector(`[data-d="${hooks.view[k] ?? k}"]`)?.classList.add('on')
        const m = hooks.heard.size
        // one block of words at a time: the key to the picture gives way to what the stone says
        root.classList.add('heard')
        if (m === n) {
          for (const a of arrows) a.done()
          if (still) root.classList.add('quiet')
          return void setTimeout(curl, ctx.reduced ? 0 : 700)
        }
        // H5: hear the one in front → turn to the next → all four, counted
        ctx.prompt(m === 1 && !still ? V.turn : fill(V.count, { n: m, total: n }))
        hooks.face(k)
      },
      stage: (host, api) => stage(ctx, host, api, hooks),
    })
    const still = ctx.quality === 'low' || ctx.reduced
    // the ink compass under the picture: four dots N E S W on an arc, inked vermilion once heard; touch one to turn
    // and hear (H2 + H4: where the others are, how many are left)
    const compass = h('div', { class: 't37v-compass', role: 'group', 'aria-label': V.compassAria },
      s('svg', { class: 't37v-arc', viewBox: '0 0 194 30', 'aria-hidden': 'true' }, s('path', { d: stroke(curve([2, 2], [97, 26], [192, 2], 20), 2, 0.2, 0.2, 0.3) })),
      ...V.compass.map((c, d) => h('button', { type: 'button', class: 't37v-cp', 'data-d': String(d), style: `--d:${d}`, 'aria-label': fill(V.compassTo, { dir: V.compassNames[d] }), onClick: () => hooks.pick(d) }, c)))
    def.mount(ctx)
    const root = ctx.art.querySelector<HTMLElement>('.p2c')!
    root.classList.add('t37v')
    // what the picture means, written on the sky from the start (audit 37-4: far = later, big = heavier)
    root.querySelector('.p2c-stage')!.append(h('p', { class: 't37v-legend' }, V.legend), compass)
    const cps = [...compass.children]
    hooks.facing = (d) => cps.forEach((b, i) => b.classList.toggle('here', i === d))
    // (which stone holds which view is known once the component has laid them out)
    hooks.laid = () => (markNext(), g.refresh())
    hooks.turned = () => {
      for (const a of arrows) a.done()
      arrows = []
    }
    // a dot on every stone not heard yet; two faint arrows at the sides for the turn
    // one vermilion focus at a time: on the stone suggested next (north, east, south, west: the first not heard yet),
    // moving on after each is heard
    const stoneEls = [...root.querySelectorAll<HTMLButtonElement>('.p2c-stone')]
    let nextDot: Mark | null = null
    function markNext() {
      let k = -1
      stoneEls.forEach((_, i) => !hooks.heard.has(i) && (k < 0 || (hooks.view[i] ?? i) < (hooks.view[k] ?? k)) && (k = i))
      if (k < 0) return void (nextDot?.done(), (nextDot = null))
      if (nextDot) nextDot.at(stoneEls[k])
      else nextDot = g.dot(stoneEls[k], { dir: [0, -1] })
    }
    markNext()
    if (!still) {
      const stageEl = root.querySelector<HTMLElement>('.p2c-stage')!
      // the turn's two faint arrows on the water either side of the faced stone (the same sums as the stage's layout)
      const at = (side: number) => () => {
        const W = ctx.art.clientWidth, H = stageEl.clientHeight, t = W / Math.max(1, H) < 1.15
        const sw = t ? Math.min(W * 0.52, 200) : clamp(W * 0.17, 230, 290)
        return [W * (t ? 0.5 : 0.31) + side * sw * (t ? 0.62 : 0.72), H * (t ? 0.5 : 0.8)] as Pt
      }
      arrows = [g.gesture('drag-h', at(-1), { r: 30 }), g.gesture('drag-h', at(1), { r: 30 })]
    }
    ctx.prompt(still ? fill(V.count, { n: 0, total: n }) : V.prompt)
    // all heard, the planet speaks through the insight; a stone touched again brings its words back beside it
    root.querySelectorAll('.p2c-stone').forEach((b) => b.addEventListener('click', () => hooks.all && hooks.heard.size === n && root.classList.remove('quiet')))
    hooks.planetNow = () => {
      root.classList.add('planet', 'now')
      hooks.all = true
      const card = root.querySelector<HTMLElement>('.p2c-card')
      if (card) card.hidden = false
      hooks.redraw()
    }
    if (ctx.quality === 'low' || ctx.reduced) hooks.planetNow()
    /** all four heard: tip up and back, the cylinder curls into a little planet */
    function curl() {
      hooks.all = true
      root.classList.add('planet', 'quiet')
      hooks.redraw()
      g.refresh()
      // the north storm softens once the detail is open
      ctx.el.querySelector('.insight-more')?.addEventListener('click', () => root.classList.toggle('calm'))
    }
  },
}

/** a speaking stone standing in the water, the speaker's name carved in its face, dark and wet at the waterline,
 *  mirrored below it (the component's box: -60 -70 120 90, foot at 0) */
function speaker(i: number): SVGElement {
  const name = V.carve[i] ?? []
  const y0 = -30 - (name.length - 1) * 6
  const seed = 3760 + i * 7
  const { top } = rock(84, 56, seed)
  const r = rng(seed + 3)
  // moss on the stone's crown (the faces turned up), a few dabs spilling down the moonward side
  let moss = ''
  top.slice(Math.floor(top.length * 0.18), Math.floor(top.length * 0.72)).forEach(([x, y], j) => {
    if (j % 2) return
    moss += blob(x + (r() - 0.5) * 3, y + 2.4 + r() * 1.5, 3 + r() * 3.4, 1.4 + r() * 1.2, seed + j, 0.3, 9)
  })
  // the water rings round its foot: broken arcs, not a ring
  let rings = ''
  for (const [k, a0, a1] of [[1, 0.05, 0.42], [1, 0.58, 0.95], [1.28, 0.12, 0.34], [1.28, 0.66, 0.86]] as const)
    rings += stroke(Array.from({ length: 9 }, (_, q) => {
      const a = Math.PI * (a0 + ((a1 - a0) * q) / 8)
      return [Math.cos(a) * 50 * k, 2 + Math.sin(a) * 6.5 * k] as Pt
    }), 1.3 / k, 0.3, 0.3, 0.1)
  return s('g', { class: 't37v-speaker' },
    s('g', { class: 't37v-mirror', transform: 'scale(1 -0.62)' }, stoneArt(84, 56, seed)),
    s('path', { class: 't37v-wetring', d: rings }),
    stoneArt(84, 56, seed),
    s('path', { class: 't37v-moss', d: moss }),
    s('path', { class: 't37v-wet', d: 'M-42 0Q-43 -7 -38 -11Q0 -7 40 -11Q44 -6 42 0Z' }),
    s('path', { class: 't37v-wl', d: stroke(Array.from({ length: 11 }, (_, q) => [Math.cos(Math.PI * (0.1 + q * 0.08)) * 44, Math.sin(Math.PI * (0.1 + q * 0.08)) * 4.5] as Pt), 1.4, 0.3, 0.3, 0.2) }),
    ...name.map((line, j) => s('g', { class: 't37v-carve' },
      s('text', { class: 't37v-carve-lo', x: 0, y: y0 + j * 12 + 0.7, 'text-anchor': 'middle' }, line),
      s('text', { class: 't37v-carve-hi', x: 0, y: y0 + j * 12, 'text-anchor': 'middle' }, line))))
}
