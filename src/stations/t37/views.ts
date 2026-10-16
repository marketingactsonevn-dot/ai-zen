import './views.css'
import { h, nextId, s } from '../../core/dom'
import { createLoop } from '../../core/loop'
import { blob, clamp, curve, rng, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist, moon, reeds } from '../../ui/part2/paint'
import { perspectiveCircle, type CircleApi } from '../../ui/part2/perspectives'
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

/** gradient ids shared by every painted billow (set once per mount, in the scene's own defs) */
const G = { body: '', lit: '', shade: '', cloud: '' }
const billow = (x: number, y: number, rx: number, ry: number, id: string) => s('ellipse', { cx: f1(x), cy: f1(y), rx: f1(rx), ry: f1(ry), fill: `url(#${id})` })

/** north: a towering thunderhead far off, soft billows stacked to an anvil, their crowns lit by the moon on the west,
 *  bellies in shade, lightning glowing inside, rain trailing under it */
function north(Q: number, H: number, hy: number, seed: number): SVGElement[] {
  const r = rng(seed)
  const c = Q / 2, base = hy - H * 0.012, top = H * 0.03, cw = Q * 0.36
  const body: SVGElement[] = [], lit: SVGElement[] = [], shade: SVGElement[] = []
  for (let i = 0; i < 46; i++) {
    const t = Math.pow(i / 45, 0.9), y = base - (base - top) * t + (r() - 0.5) * H * 0.02
    const spread = t < 0.76 ? 0.6 + t * 0.45 : 1.15 + (t - 0.76) * 5.4
    const bx = c + (r() - 0.5) * cw * spread + t * cw * 0.28
    const br = H * (t < 0.76 ? 0.05 + r() * 0.05 : 0.03 + r() * 0.025)
    const rx = br * (t < 0.76 ? 1.3 : 2.9), ry = br
    body.push(billow(bx, y, rx, ry, G.body))
    lit.push(billow(bx - rx * 0.26, y - ry * 0.34, rx * 0.7, ry * 0.55, G.lit))
    if (t < 0.7) shade.push(billow(bx + rx * 0.22, y + ry * 0.36, rx * 0.75, ry * 0.5, G.shade))
  }
  let rain = ''
  for (let i = 0; i < 34; i++) {
    const x = c + (r() - 0.45) * cw * 1.2
    rain += stroke([[x, base], [x - H * 0.04, hy + H * 0.004]], 0.8 + r() * 0.9, 0.2, 0.5, 0.1)
  }
  // the billows are pushed about by a turbulence filter, so their edges boil like cauliflower and run together
  return [
    s('path', { class: 't37v-rain', d: rain }),
    s('g', { class: 't37v-cb', filter: `url(#${G.cloud})` }, ...body, ...shade),
    s('circle', { class: 't37v-cb-glow', cx: f1(c + cw * 0.08), cy: f1(base - (base - top) * 0.3), r: f1(H * 0.2), fill: 'url(#g13-sun)' }),
    s('g', { class: 't37v-cb', filter: `url(#${G.cloud})` }, ...lit),
    s('path', { class: 't37v-bolt', d: stroke([[c + cw * 0.1, base - H * 0.03], [c + cw * 0.02, base + (hy - base) * 0.45], [c + cw * 0.07, base + (hy - base) * 0.5], [c - cw * 0.02, hy - 1]], 1.8, 0.1, 0.5, 0.2) }),
  ]
}

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
const west = (Q: number, H: number, hy: number, seed: number): SVGElement[] => [fog(Q * 0.56, hy - H * 0.18, Q * 0.42, H * 0.2), moon(Q * 0.56, hy - H * 0.19, H * 0.06, seed, true)]

/** the far and mid shore for each quarter: hills, a bank with reeds; the village close across the water (east); the
 *  path off the shore into fields (west) */
function shore(kind: number, Q: number, H: number, hy: number, seed: number): SVGElement[] {
  const r = rng(seed + kind * 7)
  const c = Q / 2
  const bank = (x0: number, x1: number, y: number, k: number) => s('path', { class: 't37v-bankband', d: blob((x0 + x1) / 2, y, (x1 - x0) / 2, H * 0.012 * k, seed + kind, 0.25), filter: 'url(#ink-wash)' })
  const reedRow = (x0: number, x1: number, y: number, n: number, hh: number) => Array.from({ length: n }, (_, i) => reeds(x0 + ((x1 - x0) * (i + r() * 0.6)) / n, y, hh * (0.7 + r() * 0.6), seed + kind * 31 + i, 4 + Math.round(r() * 3)))
  if (kind === 1) {
    // the village right across the water: its bank comes below the horizon (near), houses with warm windows, smoke
    const yb = hy + H * 0.032, u = H * 0.085
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
      smoke += stroke(curve([hx + q * 0.3, hb - q * 2], [hx + u * 0.2, hb - H * 0.16], [hx + u * 1.6, hb - H * (0.3 + r() * 0.08)], 16), u * 0.32, 0.08, 0.95, 0.1)
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
  if (kind === 0) out.push(
    s('g', { class: 't37v-stormrefl' }, ...[0, 1, 2, 3].map((i) => billow(c + Q * (0.02 + i * 0.02), hy + H * (0.03 + i * 0.045), Q * (0.16 - i * 0.02), H * 0.035, G.body))),
    s('path', { class: 't37v-boltrefl', d: roadOf(c + Q * 0.02, hy + H * 0.01, H * 0.12, H * 0.008) }))
  if (kind === 1) out.push(s('path', { class: 't37v-winrefl', d: [-3.1, -1.5, 0.15, 1.75, 3.35].map((dx) => roadOf(c + dx * H * 0.085 * 1.2 - H * 0.035, hy + H * 0.05, H * 0.17, H * 0.02)).join('') }))
  if (kind === 2) out.push(s('ellipse', { class: 't37v-warm', cx: f1(c), cy: f1(hy + H * 0.02), rx: f1(Q * 0.4), ry: f1(H * 0.1), fill: 'url(#g13-sun)' }), s('path', { class: 't37v-dawnrefl', d: roadOf(c, hy + H * 0.008, (H - hy) * 0.85, Q * 0.07) }))
  if (kind === 3) out.push(s('path', { class: 't37v-moonrefl', d: roadOf(Q * 0.56, hy + H * 0.01, (H - hy) * 0.5, Q * 0.03) }))
  return out
}

/** near you, in the water: reeds and lotus pads at the quarter's sides, cut by the frame */
function near(kind: number, Q: number, H: number, seed: number): SVGElement[] {
  const r = rng(seed + 70 + kind)
  const c = Q / 2
  return [
    reeds(c - Q * 0.42 + r() * Q * 0.06, H * 1.0, H * 0.22, seed + 10 + kind, 7),
    reeds(c + Q * 0.38 + r() * Q * 0.06, H * 1.0, H * 0.16, seed + 14 + kind, 5),
    s('path', { class: 't37v-pad', d: blob(c + Q * 0.28, H * 0.95, H * 0.06, H * 0.017, seed + 11, 0.2) + blob(c + Q * 0.33, H * 0.975, H * 0.035, H * 0.011, seed + 12, 0.2) + blob(c - Q * 0.3, H * 0.93, H * 0.04, H * 0.012, seed + 13, 0.2) }),
  ]
}

/** the little planet: one pond, the four horizons curled round its rim as big silhouettes, each pointing outward */
function planet(cx: number, cy: number, R: number, seed: number): SVGElement[] {
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
  return out
}

/** one horizon of the little planet as a big silhouette: foot at 0, 0 on the rim, outward toward −y, ~0.8 R tall */
function vignette(kind: number, R: number, seed: number): SVGElement[] {
  const r = rng(seed + 300 + kind)
  const reedsAt = (x: number, k: number) => reeds(x, 0, R * 0.16 * k, seed + kind * 13 + Math.round(x), 5)
  if (kind === 0) {
    // the storm: a column of billows climbing to an anvil, moonlit on its west side, a flicker at its foot
    const body: SVGElement[] = [], lit: SVGElement[] = []
    for (let i = 0; i < 16; i++) {
      const t = i / 15, y = -R * (0.12 + t * 0.66), w = R * (t < 0.78 ? 0.26 + t * 0.12 : 0.62)
      const bx = (r() - 0.5) * R * 0.1 + t * R * 0.06, hh = R * (t < 0.78 ? 0.13 : 0.07)
      body.push(billow(bx, y, w, hh, G.body))
      lit.push(billow(bx - w * 0.28, y - hh * 0.35, w * 0.62, hh * 0.5, G.lit))
    }
    return [
      s('g', { class: 't37v-cb', filter: `url(#${G.cloud})` }, ...body),
      s('circle', { class: 't37v-cb-glow', cx: f1(R * 0.03), cy: f1(-R * 0.3), r: f1(R * 0.26), fill: 'url(#g13-sun)' }),
      s('g', { class: 't37v-cb', filter: `url(#${G.cloud})` }, ...lit),
      s('path', { class: 't37v-anvil', d: stroke(curve([-R * 0.5, -R * 0.76], [R * 0.05, -R * 0.86], [R * 0.6, -R * 0.74], 16), R * 0.07, 0.5, 0.7, 0.06) }),
      s('path', { class: 't37v-bolt', d: stroke([[R * 0.04, -R * 0.12], [-R * 0.03, -R * 0.06], [R * 0.02, -R * 0.04], [-R * 0.02, 0]], 1.6, 0.1, 0.5, 0.2) }),
      reedsAt(-R * 0.4, 1), reedsAt(R * 0.36, 0.8),
    ]
  }
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
  G.lit = nextId('t37v-gl')
  G.shade = nextId('t37v-gs')
  G.cloud = nextId('t37v-cf')
  const soft = (id: string, cls: string, a: number) => s('radialGradient', { id }, s('stop', { offset: 0, class: cls, 'stop-opacity': a }), s('stop', { offset: 0.62, class: cls, 'stop-opacity': a * 0.75 }), s('stop', { offset: 1, class: cls, 'stop-opacity': 0 }))
  const defs = s('svg', { class: 'visually-hidden', 'aria-hidden': 'true' }, s('defs', null, s('linearGradient', { id: wid, x1: 0, y1: 0, x2: 0, y2: 1 },
    s('stop', { offset: 0, class: 't37v-w0' }), s('stop', { offset: 0.3, class: 't37v-w1' }), s('stop', { offset: 1, class: 't37v-w2' })),
    soft(G.body, 't37v-gb', 0.9), soft(G.lit, 't37v-gl', 0.85), soft(G.shade, 't37v-gs', 0.7),
    s('filter', { id: G.cloud, x: '-25%', y: '-25%', width: '150%', height: '150%' },
      s('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.018', numOctaves: ctx.quality === 'low' ? 1 : 3, seed: '37', result: 'n' }),
      s('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: '34', xChannelSelector: 'R', yChannelSelector: 'G', result: 'd' }),
      s('feGaussianBlur', { in: 'd', stdDeviation: '2.2' }))))
  const pan = h('div', { class: 't37v-pan' }, defs, ...planes.map((p) => p.el), column, own)
  const plEl = h('div', { class: 't37v-pl' }, pl)
  const turn = h('div', { class: 't37v-turn', tabindex: '0', role: 'group', 'aria-label': V.art, 'aria-description': V.hint }, pan, plEl)
  host.append(turn)
  const root = host.closest<HTMLElement>('.p2c')!
  const stageEl = host.parentElement as HTMLElement

  let W = 0, SH = 0, tall = false
  let feet: { x: number; y: number; s: number }[] = []
  let Q = 400 // px per quarter
  let stoneW = 170, bwPx = 140
  let P = { cx: 0, cy: 0, R: 0 } // the planet
  let yaw = 0, want = 0, vel = 0
  let dwell = 0
  const stones = () => [...root.querySelectorAll<HTMLButtonElement>('.p2c-stone')]
  const wrap = (a: number) => ((a % 360) + 540) % 360 - 180

  /** draw the panorama (each quarter painted once per plane, used six times round) and the planet for this size */
  function draw() {
    const hh = SH, hy = hh * 0.5
    const fov = tall ? 70 : 110
    Q = (W * 90) / fov
    planes.forEach(({ svg }, p) => {
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
    const cx = W / 2
    own.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(hh)}`)
    own.replaceChildren(s('g', { transform: `translate(${f1(cx)} ${f1(hh * 1.05)})` }, stoneArt(Math.min(W * 0.46, 420), hh * 0.12, 3751)))
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
    P = tall ? { cx: W / 2, cy: hh * 0.5, R: Math.min(W * 0.2, hh * 0.21) } : { cx: W * 0.42, cy: hh * 0.45, R: hh * 0.155 }
    pl.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(hh)}`)
    pl.replaceChildren(...planet(P.cx, P.cy, P.R, 3750))
    const common = root.querySelector<HTMLElement>('.t37v-common')
    // the common ground under the planet (a tall frame: just under the picture, above the slip)
    if (common) Object.assign(common.style, { left: `${f1(P.cx)}px`, top: `${f1(tall ? hh + 2 : P.cy + P.R * 2.5)}px`, width: `${f1(Math.min(W * (tall ? 0.94 : 0.5), 560))}px` })
    apply()
  }

  /** the reading slip: floating on the water by the faced stone (wide), beside the planet (wide, all heard), under the
   *  picture (tall) */
  function placeCard() {
    const card = root.querySelector<HTMLElement>('.p2c-card')
    if (!card) return
    card.classList.add('t37v-slip')
    if (tall) {
      const top = SH + (hooks.all ? (root.querySelector<HTMLElement>('.t37v-common')?.offsetHeight ?? 0) + 12 : 6)
      return void Object.assign(card.style, { left: '0px', top: `${f1(top)}px`, width: `${f1(W)}px`, maxHeight: `${f1(root.clientHeight - top - 2)}px`, transform: 'none' })
    }
    const w = Math.min(330, W * 0.25)
    const x = hooks.all ? Math.min(W - w - 8, P.cx + P.R * 2.7) : W / 2 + stoneW * 0.42
    Object.assign(card.style, { left: `${f1(x)}px`, top: `${f1(hooks.all ? SH * 0.18 : SH * 0.55)}px`, width: `${f1(w)}px`, maxHeight: `${f1(SH * 0.42)}px`, transform: '' })
  }

  const stoneAt = (k: number) => AT[hooks.view[k] ?? k]
  /** write the turn: each plane slides at its own rate; the stones ride on the near plane; the moon's road leans */
  function apply() {
    if (!W) return
    const pxPerDeg = Q / 90, cx = W / 2
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
      b.style.transform = `translate(${f1(cx + x - f.x)}px, ${f1(SH * 0.9 - f.y)}px) scale(${f1(stoneW / bwPx)})`
      b.style.visibility = Math.abs(x) > Math.min(W * 0.62, Q * 0.62) ? 'hidden' : ''
    })
    // the moon's road leans toward the stone you face
    const n = nearest()
    const lean = n.k >= 0 ? clamp(n.d / 30, -1, 1) * 9 : 0
    ;(column.firstChild as SVGGElement | null)?.setAttribute('transform', `rotate(${f1(-lean)} ${f1(cx)} ${f1(SH * 0.5)})`)
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
    if (!drag.moved) (drag.moved = true), turn.setPointerCapture(e.pointerId), turn.classList.add('grabbing')
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
    W = ctx.art.clientWidth
    const H = root.clientHeight
    tall = W / H < 1.15
    SH = Math.round(tall ? H * 0.58 : H)
    root.classList.toggle('t37v-tall', tall)
    Object.assign(stageEl.style, { left: '0px', width: `${f1(W)}px`, height: `${f1(SH)}px` })
    bwPx = parseFloat(stones()[0]?.style.width || '140') || 140
    stoneW = tall ? Math.min(W * 0.52, 200) : clamp(W * 0.17, 230, 290)
    draw()
    placeCard()
  })
  hooks.redraw = () => (apply(), placeCard())
  if (still) hooks.planetNow()
  return () => {
    clearTimeout(dwell)
    loop.dispose()
  }
}

type Hooks = { view: number[]; heard: Set<number>; all: boolean; face: (k: number) => void; redraw: () => void; planetNow: () => void }

export const viewsScene: SceneDef = {
  label: V.label,
  mount(ctx) {
    const hooks: Hooks = { view: [], heard: new Set(), all: false, face: () => {}, redraw: () => {}, planetNow: () => {} }
    ctx.art.classList.add('t37v-art')
    ctx.onCleanup(() => ctx.art.classList.remove('t37v-art'))
    // the common ground is written under the planet; the scene's insight (and its detail) come after it
    const def = perspectiveCircle({ ...V.perspectives, common: V.insight }, {
      label: V.label,
      prompt: V.prompt,
      detail: V.detail,
      // every stone stands in the near water at the middle of the frame; the stage slides it round as you turn
      place: (_k, _n, g) => ({ x: g.w / 2, y: g.h * 0.86, s: 1.1, z: 5 }),
      stone: (k, _g, i) => ((hooks.view[k] = i), speaker(i)),
      onHear: (k) => {
        hooks.heard.add(k)
        if (hooks.heard.size === V.perspectives.stones.length) return void setTimeout(curl, ctx.reduced ? 0 : 700)
        hooks.face(k)
      },
      stage: (host, api) => stage(ctx, host, api, hooks),
    })
    def.mount(ctx)
    const root = ctx.art.querySelector<HTMLElement>('.p2c')!
    root.classList.add('t37v')
    const common = h('div', { class: 't37v-common' }, ctx.fact(V.perspectives.common, 'p'))
    root.querySelector('.p2c-stage')!.append(common)
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
      root.classList.add('planet')
      hooks.redraw()
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
  return s('g', { class: 't37v-speaker' },
    s('g', { class: 't37v-mirror', transform: 'scale(1 -0.62)' }, stoneArt(84, 56, 3760 + i * 7)),
    s('ellipse', { class: 't37v-wetring', cx: 0, cy: 1, rx: 58, ry: 6.5 }),
    stoneArt(84, 56, 3760 + i * 7),
    s('path', { class: 't37v-wet', d: 'M-42 0Q-43 -7 -38 -11Q0 -7 40 -11Q44 -6 42 0Z' }),
    s('ellipse', { class: 't37v-wl', cx: 0, cy: 0, rx: 46, ry: 4.5 }),
    ...name.map((line, j) => s('g', { class: 't37v-carve' },
      s('text', { class: 't37v-carve-lo', x: 0, y: y0 + j * 12 + 0.7, 'text-anchor': 'middle' }, line),
      s('text', { class: 't37v-carve-hi', x: 0, y: y0 + j * 12, 'text-anchor': 'middle' }, line))))
}
