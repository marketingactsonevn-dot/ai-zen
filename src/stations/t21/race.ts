import raw from '../../content/tram-21.json'
import { fill, h, s, viDate } from '../../core/dom'
import { L, type Fact } from '../../core/content'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import { onPrefs } from '../../core/prefs'
import type { SceneDef } from '../types'
import { clamp, onSize, p2Defs, rng, stableHeight, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist, moon as moonArt, pine, reeds, toro } from '../../ui/part2/paint'
import { guide } from '../../ui/part2/guide'
import { BACK, HUMAN, bake, bamboo, col, figure, fit, glow, mix, palette, pick, pose, ramp, toneRamp, veil, type Pal, type Sprite, type Tones } from './cv'

const S = raw.scenes.race
const MS = S.tide.milestones
const N = MS.length - 1 // stops 0…N; the last milestone is "today"

// ───────── the world: a running track of constant curve round a moon lake (metres; camera looks down +z) ─────────
const R = 90 // track radius: the view ahead is the same everywhere on it, so running = scrolling along it
const xc = (z: number) => -(R - Math.sqrt(Math.max(0, R * R - z * z))) // lane centre, bending left round the lake
const ZN = 0.7, ZF = 86, NS = 72
const ZS = Float32Array.from({ length: NS + 1 }, (_, i) => ZN * (ZF / ZN) ** (i / NS))
const FIN_L = -1.75, FIN_R = 1.45, ROAD_L = -1.6, LANE_R = 1.6, RAIL = 1.84, HUM_R = 4.4, SHORE = -2.5, CAM0 = 2.0, CRANE = 13
const LOOP = 120 // scenery repeats along the track every LOOP m
// the lake: its inner shore follows the track out to 58 m (a wavering bank, not a ruled line), the far shore curls away
// left into the mist, and the water runs off the left edge of the picture (the camera rides the track behind the robot)
const SH: Pt[] = (() => {
  const pts: Pt[] = []
  for (const z of ZS) if (z >= 1.4 && z <= 58) pts.push([xc(z) + SHORE - 0.25 * Math.sin(z * 0.7) - 0.18 * Math.sin(z * 1.9 + 1), z])
  const [xf, zf] = pts[pts.length - 1]
  // the far shore wanders away left and back into the mist through bays and points (seen from the crane it is a
  // wavering line, not a ruled one)
  for (let j = 1; j <= 28; j++) {
    const u = j / 28
    pts.push([xf - 150 * u ** 1.1, zf + 34 * u + 9 * Math.sin(u * 7) + 5 * Math.sin(u * 17 + 1)])
  }
  for (let z = 60; z > 1.2; z *= 0.7) pts.push([-4 * z - 60, z])
  return pts
})()
const SHX = new Float32Array(SH.length), SHY = new Float32Array(SH.length)
const NIN = Array.from(ZS).filter((z) => z >= 1.4 && z <= 58).length // inner-shore points
const NSH = NIN + 28 // + the far shore (the rest runs off screen)
// pines on the far shore, mirrored in the water
const FARP = [[-0.5, 59, 6.5, 0, 0], [-0.6, 56.5, 5, 2, 0], [-0.7, 54, 7.4, 1, 0], [-0.84, 50, 5.6, 0, 0], [-0.98, 47, 6.8, 2, 0]].map(([a, z, hm, v, k]) => ({ x: k ? a : a * z, z, hm, v, k }))

type Prop = { kind: 0 | 1 | 2 | 3; s: number; u: number; hm: number; v: number } // 0 pine 1 lantern 2 reeds 3 grass
const PROPS: Prop[] = (() => {
  const r = rng(2121)
  const out: Prop[] = []
  for (let s0 = 9; s0 < LOOP; s0 += 9 + r() * 8) out.push({ kind: 0, s: s0, u: 6.4 + r() * 4.5, hm: 6.2 + r() * 2.8, v: Math.floor(r() * 3) })
  // stone lanterns on the verge beyond the human lane, a few small ones between the track and the water
  for (let s0 = 6; s0 < LOOP; s0 += 13 + r() * 5) out.push({ kind: 1, s: s0, u: 5.05, hm: 1.75, v: 0 })
  for (let s0 = 21; s0 < LOOP; s0 += 34 + r() * 8) out.push({ kind: 1, s: s0, u: -2.1, hm: 1.25, v: 0 })
  for (let s0 = 4; s0 < LOOP; s0 += 5 + r() * 7) out.push({ kind: 2, s: s0, u: SHORE - 0.3 - r() * 0.6, hm: 0.5 + r() * 0.5, v: Math.floor(r() * 2) })
  for (let s0 = 2; s0 < LOOP; s0 += 2.6 + r() * 3) out.push({ kind: 3, s: s0, u: r() < 0.5 ? 4.9 + r() * 0.8 : -2.25 - r() * 0.3, hm: 0.5 + r() * 0.3, v: Math.floor(r() * 2) })
  return out
})()
// the valley behind the lake: rows of low factory sheds whose windows are lit (an illustration of density, not a count),
// far → near so they are drawn in order; x0 z0 = the near left corner, w, h, lamps per metre
const SHEDS = (() => {
  const r = rng(77)
  const a: number[][] = []
  for (let c = 0; c < 70; c++) {
    const z0 = 48 + r() ** 0.8 * 200, x0 = z0 * (-1.15 + r() * 1.95)
    if (Math.hypot(x0 + R, z0) < R + 14) continue
    // a row of 2–4 sheds side by side along x, sometimes a second row behind
    const n = 2 + Math.floor(r() * 3), rows = r() < 0.4 ? 2 : 1
    for (let j = 0; j < rows; j++) for (let i = 0; i < n; i++) a.push([x0 + i * (14 + r() * 4), z0 + j * 9, 10 + r() * 6, 3 + r() * 2.5])
  }
  return a.sort((p, q) => q[1] - p[1]).flat()
})()
const NSHED = SHEDS.length / 4
const STREAK = (() => {
  const r = rng(9)
  return Float32Array.from(Array.from({ length: 150 * 4 }, (_, i) => [ROAD_L + 0.15 + r() * (HUM_R - ROAD_L - 0.3), r() * 60, 0.4 + r() * 1.8, 0.012 + r() * 0.03][i % 4]))
})()
const RIP = (() => {
  const r = rng(13)
  const a: number[] = []
  while (a.length < 120 * 3) {
    const z = 1.8 + r() ** 1.5 * 56, right = xc(z) + SHORE - 0.4, left = -1.05 * z - 4
    a.push(left + (right - left) * r() ** 0.6, z, 0.4 + r() * 1.6)
  }
  return Float32Array.from(a)
})()
const GLINT = (() => {
  const r = rng(31)
  return Float32Array.from(Array.from({ length: 64 * 3 }, () => r()))
})()

// draw list, sorted far → near every frame without allocating
const MAXD = 220
const DZ = new Float32Array(MAXD), DK = new Int16Array(MAXD), DI = new Int16Array(MAXD), ORD = new Int16Array(MAXD)
const K_PROP = 0, K_POST = 1, K_FIN = 2, K_OLD = 3, K_GHOST = 4, K_ROBOT = 5, K_FAR = 6, K_DOWN = 7

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))
const inOut = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2)
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const DUR = [4.8, 3.9, 4.6, 3.6]
// 04/2026: metres run since the season began — 7.5 m/s until the ribbon (3.2 s), then a hard, short stop
const run2 = (x: number) => (x < 3.2 ? 7.5 * x : 24 + (7.5 / 30) * (1 - Math.exp(-(x - 3.2) * 30)))

/**
 * ★ Scene 1 · Vạch đích lùi dần — CHASE, canvas. A low camera runs behind an ink robot on a track that curves round a
 * moonlit lake into the mist; pines and stone lanterns slide past on the right, a bamboo rail keeps the human lane.
 * Drag the moon across the sky through the seasons: the robot stumbles and falls (2025), a mist-white runner sets the
 * human record in the next lane (03/2026), the robot strides past it and breaks the red ribbon at its chest (04/2026);
 * the two finishes stay on the track as two ribbons at depths 0.31 apart. Today: the camera cranes over the pines and
 * the valley behind the lake is full of small warm factory lamps; the forecast drifts in the mist.
 */
export const raceScene: SceneDef = {
  label: S.label,
  mount(ctx) {
    p2Defs()
    const stableH = stableHeight(ctx, [S.insight as Fact])
    const low = ctx.quality === 'low'
    const still = low || ctx.reduced // each stop is a single frame

    const sky = s('svg', { class: 't21r-sky', 'aria-hidden': 'true' })
    const skyG = s('g')
    sky.append(skyG)
    const cv = h('canvas', { class: 't21r-cv', 'aria-hidden': 'true' })
    const fade = h('canvas', { class: 't21r-cv t21r-fade', 'aria-hidden': 'true' })
    const read = h('div', { class: 't21r-read' })
    const hz = h('div', { class: 't21r-horizon' }, h('p', { class: 'p2-eyebrow' }, L.horizon), ctx.fact(S.tide.horizon as Fact, 'p', 't21r-hz-text'))
    const c = MS[2].compare!
    const tagNear = h('p', { class: 't21r-tag near' }, h('span', null, c.afterLabel), h('b', null, c.after))
    const tagFar = h('p', { class: 't21r-tag far' }, h('span', null, c.beforeLabel), h('b', null, c.before))
    const disc = s('svg', { class: 't21r-disc', viewBox: '-25 -25 50 50', 'aria-hidden': 'true' }, moonArt(0, 0, 21, 2101, false))
    const valueText = (i: number) => fill(L.tideValue, { date: viDate(MS[i].date), label: MS[i].label })
    const moon = h('div', {
      class: 't21r-moon', role: 'slider', tabindex: '0', 'aria-label': S.moonAria,
      'aria-valuemin': '0', 'aria-valuemax': String(N), 'aria-valuenow': '0', 'aria-valuetext': valueText(0),
    }, disc)
    const textCol = h('div', { class: 't21r-text' }, read, hz)
    const root = h('div', { class: 't21r' }, h('p', { class: 'visually-hidden' }, S.art), sky, cv, fade, tagFar, tagNear, textCol, moon)
    ctx.art.append(root)
    ctx.prompt(S.prompt)
    // H1 on the moon (it goes left), H2 its path across the sky with the four seasons ticked on it
    const gd = guide(ctx)
    const moonDot = gd.dot(moon, { dir: [-1, -0.4] })
    const way = gd.track(() => {
      const a = ctx.art.getBoundingClientRect(), r = root.getBoundingClientRect()
      return Array.from({ length: 13 }, (_, k) => {
        const [x, y] = arc(k / 12)
        return [x + r.left - a.left, y + r.top - a.top] as Pt
      })
    }, { labels: S.ticks })

    // ── layout (CSS px)
    let W = 0, H = 0, F = 1, cx = 0, hy0 = 0, port = false, camX = -1.7, ZR = 5.2
    let ready = false
    let pal: Pal, ton: Tones[] = []
    let c2: CanvasRenderingContext2D | null = null
    const spr: { pine: Sprite[]; toro: Sprite | null; lit: Sprite | null; reeds: Sprite[]; grass: Sprite[]; lamp: HTMLCanvasElement | null; shade: HTMLCanvasElement | null; warm: HTMLCanvasElement | null; fog: HTMLCanvasElement | null; veil: HTMLCanvasElement | null; moonGlow: HTMLCanvasElement | null } =
      { pine: [], toro: null, lit: null, reeds: [], grass: [], lamp: null, shade: null, warm: null, fog: null, veil: null, moonGlow: null }
    // colour ramps (index = fog 0…1), rebuilt with the theme
    let rGround: string[] = [], rRoad: string[] = [], rLane: string[] = [], rWater: string[] = [], rEdge: string[] = [], rBam: string[] = [], rNode: string[] = [], rShed: string[] = []
    let cRips: string[] = [], cRake = '', cRefl = '', cDash = '', cStreak = '', cGlint = '', cShadow = '', cRibbon = '', cRibbonOld = '', cRibbonEdge = '', cBamLit = '', cWin = '', cSoak = ''
    const fogK = (z: number) => 1 - Math.exp(-z / 42)

    // ── the state of the world this frame (one object, reused)
    const P = pose(), GP = pose(), FP = pose()
    FP.tip = -1.52; FP.arms = 0.7; FP.bend = 0.4 // another runner of 2025, down on the track ahead
    const st = { down: 0, dist: 0, zr: 5.2, camH: CAM0, hyK: 0, lamps: 0, fin: 112, broke: -1, ghost: 0, gz: 14, num: 0, numS: 15, cmp: 0, nearZ: 4, mx: 0, my: 0 }
    const from = { camH: CAM0, hyK: 0, lamps: 0 }
    let stop = 0, tt = 0, tau = 0, drag = false, d0 = 0
    const NUMS = S.road // painted on the track, one format: h:mm (2025's winner, the human record, 2026's winner)
    const numSpr: (HTMLCanvasElement | null)[] = [null, null, null]

    function episode(i: number, t: number) {
      t = Math.min(t, DUR[i]) // a still frame (low / reduced motion) is the episode's last moment
      const sm = smooth
      let camH = CAM0, hyK = 0, lamps = 0
      P.tip = P.arms = P.bend = P.lean = 0
      st.down = 0
      st.ghost = 0
      st.broke = -1
      st.cmp = 0
      st.zr = ZR
      if (i === 0) {
        // 2025: staggering, a fall, getting up, a wobbling stand; the finish is a red dot in the mist
        st.fin = 112
        st.num = 0
        P.phase = t * 1.25
        if (t < 1.5) (P.run = 0.42), (P.lean = 0.09 * Math.sin(t * 5.2)), (P.arms = 0.35 + 0.35 * Math.sin(t * 6.5) ** 2), (st.dist = 1.1 * t)
        else if (t < 2.1) {
          const u = (t - 1.5) / 0.6
          P.run = 0.25; P.arms = 1; P.bend = 0.2; P.tip = 1.5 * u * u; st.dist = 1.65
        } else if (t < 2.9) (P.run = 0), (P.arms = 0.7), (P.bend = 0.35), (P.tip = 1.5 - 0.07 * Math.sin(Math.min(1, (t - 2.1) / 0.25) * Math.PI)), (st.dist = 1.65)
        else if (t < 3.8) {
          const u = inOut((t - 2.9) / 0.9)
          P.run = 0; P.tip = 1.5 * (1 - u); P.bend = 0.8 - 0.5 * u; P.arms = 0.65; st.dist = 1.65
        } else {
          // up again, but only just: knees bent, arms out, leaning
          const u = sm((t - 3.8) / 0.9)
          P.run = 0.32 * (1 - u); P.lean = 0.05 * Math.sin(t * 4) * (1 - u) + 0.1 * u; P.arms = 0.65 + 0.2 * u; P.bend = 0.3 + 0.05 * u
          st.dist = 1.65 + 0.7 * Math.min(t - 3.8, 0.9)
        }
        st.down = 1
        st.numS = ZR + 13 - st.dist
      } else if (i === 1) {
        // 03/2026: the human record runs past in the next lane, mist-white
        P.run = 0.6; P.phase = t * 1.7 + 0.2; st.dist = 2.6 * t
        st.ghost = sm(t / 0.6); st.gz = 1.8 + 1.85 * t
        GP.run = 1; GP.phase = t * 2.5
        st.num = 1; st.numS = ZR + 9 - st.dist
        st.fin = 78 - st.dist
      } else {
        // 04/2026: an even stride past the runner; the ribbon rushes in and breaks at the chest; (today) the camera cranes up
        const v = 7.5, tb = 3.2
        const tr = i === 2 ? run2(t) : run2(99)
        P.run = i === 2 && t > tb ? 1 - 0.55 * sm((t - tb) / 0.5) : 1
        P.phase = t * 2.35
        st.dist = 5 + tr
        st.fin = st.zr + v * tb - tr
        if (i === 2 && t >= tb) st.broke = t - tb
        else if (i === 3) st.broke = 9
        if (i === 2) {
          st.ghost = sm((st.gz = 8.6 - 2.7 * t) - 1.2)
          GP.run = 1; GP.phase = t * 2.5
          st.num = 2; st.numS = ZR + 12 - tr
          st.cmp = sm((t - 3.6) / 0.8)
        } else {
          st.num = -1
          st.cmp = 1
          st.zr = ZR + 15 * inOut(Math.min(1, t / 3.4)) * 3.4
          P.run = 1
          const u = inOut(t / 2.7)
          camH = lerp(CAM0, CRANE, u); hyK = u
          lamps = sm((t - 0.7) / 1.8)
        }
        st.nearZ = ZR + v * tb - run2(99) // where the broken ribbon came to rest, just behind the chest
      }
      const b = t >= 0.9 ? 1 : inOut(t / 0.9)
      st.camH = lerp(from.camH, camH, b)
      st.hyK = lerp(from.hyK, hyK, b)
      st.lamps = lerp(from.lamps, lamps, b)
    }

    // ── projection
    let hy = 0
    const SX = (x: number, z: number) => cx + ((x - camX) * F) / z
    const SY = (y: number, z: number) => hy + ((st.camH - y) * F) / z

    function frame() {
      if (!c2 || !ready) return
      const g = c2
      hy = hy0 - st.hyK * H * (port ? 0.16 : 0.24)
      g.clearRect(0, 0, W, H)
      // the moon's light: azimuth / altitude from where the disc hangs → long shadows thrown toward us
      const mdx = (st.mx - cx) / F
      const alt = Math.max(0.14, (hy - st.my) / F)
      const sl = 1 / Math.hypot(mdx, 1)
      const shx = -mdx * sl / alt, shz = -sl / alt // ground offset per metre of height

      // the sky thickens into mist toward the horizon across the whole width: no edge where the ground begins
      if (spr.veil) {
        const vh = H * 0.34
        g.globalAlpha = pal.dark ? 0.9 : 0.8
        g.drawImage(spr.veil, 0, hy - vh * 0.8, W, vh)
        g.globalAlpha = 1
      }
      // ground: bands from the fog at the horizon to the near bank
      const bands = 18
      for (let i = 0; i < bands; i++) {
        const y0 = hy + ((H - hy) * i) / bands, y1 = hy + ((H - hy) * (i + 1)) / bands
        const z = (st.camH * F) / Math.max(1, (y0 + y1) / 2 - hy)
        g.fillStyle = pick(rGround, fogK(z))
        g.fillRect(0, y0 - 0.5, W, y1 - y0 + 1)
      }
      // the valley behind the lake (revealed when the camera cranes up): rows of low sheds, their windows lit
      if (st.lamps > 0.01) valley(g)
      lake(g)
      road(g)
      // shadows of everything standing, then everything standing far → near, with veils of mist between the depths
      n = 0
      for (let i = 0; i < PROPS.length; i++) add(relZ(PROPS[i].s), K_PROP, i)
      for (let i = 0; i < FARP.length; i++) add(FARP[i].z, K_FAR, i)
      for (let i = 0; i * 2.4 < LOOP; i++) add(relZ(i * 2.4 + 1.1), K_POST, i)
      if (st.fin < ZF) add(Math.max(st.fin, ZN + 0.25), K_FIN, 0)
      if (st.cmp > 0.01) add(st.nearZ / 0.31, K_OLD, 0)
      if (st.ghost > 0.01) add(st.gz, K_GHOST, 0)
      add(st.zr, K_ROBOT, 0)
      if (st.down) add(ZR + 6.5 - st.dist, K_DOWN, 0)
      for (let i = 1; i < n; i++) {
        const o = ORD[i]
        let j = i - 1
        while (j >= 0 && DZ[ORD[j]] < DZ[o]) (ORD[j + 1] = ORD[j]), j--
        ORD[j + 1] = o
      }
      for (let q = 0; q < n; q++) shadow(g, ORD[q], shx, shz)
      let vi = 0
      for (let q = 0; q < n; q++) {
        while (vi < VZ.length && DZ[ORD[q]] < VZ[vi]) airAt(g, VZ[vi++], 10, pal.dark ? 0.34 : 0.3)
        item(g, ORD[q])
      }
      while (vi < VZ.length) airAt(g, VZ[vi++], 10, pal.dark ? 0.34 : 0.3)
      place()
    }
    const VZ = [62, 38, 22, 12.5] // the depths the mist hangs between
    let n = 0
    function add(z: number, k: number, i: number) {
      if (n >= MAXD || z < ZN + 0.2 || z > ZF) return
      DZ[n] = z; DK[n] = k; DI[n] = i; ORD[n] = n; n++
    }
    // a veil of mist standing at depth z, up to `top` metres: everything drawn so far (farther) sinks into it
    function airAt(g: CanvasRenderingContext2D, z: number, top: number, a: number) {
      if (!spr.veil) return
      const y0 = Math.max(SY(top, z), hy - H * 0.16), y1 = SY(-0.6, z)
      if (y1 <= y0) return
      g.globalAlpha = a
      g.drawImage(spr.veil, 0, y0, W, (y1 - y0) / 0.86)
      g.globalAlpha = 1
    }
    function valley(g: CanvasRenderingContext2D) {
      const a = st.lamps
      let vi = 0
      for (let i = 0; i < NSHED; i++) {
        const o = i * 4, z = SHEDS[o + 1]
        while (vi < VV.length && z < VV[vi]) airAt(g, VV[vi++], 9, 0.5 * a)
        const x0 = SHEDS[o], w = SHEDS[o + 2], hm = SHEDS[o + 3]
        const xl = SX(x0, z), xr = SX(x0 + w, z)
        if (xr < -4 || xl > W + 4) continue
        const f = fogK(z)
        const yb = SY(0, z), yt = SY(hm, z), yr = SY(hm * 1.4, z)
        // the shed: a low ink block with a saw-tooth roof
        g.globalAlpha = a
        g.fillStyle = pick(rShed, f)
        g.beginPath()
        g.moveTo(xl, yb)
        g.lineTo(xl, yt)
        for (let t = 0; t < 3; t++) {
          const u0 = xl + ((xr - xl) * t) / 3, u1 = xl + ((xr - xl) * (t + 1)) / 3
          g.lineTo(u0 + (u1 - u0) * 0.8, yr)
          g.lineTo(u1, yt)
        }
        g.lineTo(xr, yb)
        g.fill()
        // a warm pool of light on the mist round it, then its row of lit windows
        if (spr.lamp) {
          const gw = (xr - xl) * 1.9, gh = Math.max(4, (yb - yr) * 2.4)
          g.globalAlpha = a * (pal.dark ? 0.32 : 0.22) * (1 - f * 0.5)
          g.drawImage(spr.lamp, (xl + xr) / 2 - gw / 2, (yb + yt) / 2 - gh / 2, gw, gh)
        }
        const wy = SY(hm * 0.42, z), wh = Math.max(0.7, (hm * 0.2 * F) / z)
        g.globalAlpha = a * (1 - f * 0.45)
        g.fillStyle = cWin
        const panes = Math.min(9, Math.max(2, Math.round((xr - xl) / 5)))
        const pw = (xr - xl) / panes
        for (let k = 0; k < panes; k++) g.fillRect(xl + k * pw + pw * 0.2, wy - wh / 2, Math.max(0.7, pw * 0.56), wh)
      }
      while (vi < VV.length) airAt(g, VV[vi++], 9, 0.5 * a)
      g.globalAlpha = 1
    }
    const VV = [190, 140, 100, 72]
    const relZ = (s0: number) => {
      const d = (((s0 - st.dist) % LOOP) + LOOP) % LOOP
      return d < 1.2 ? d + LOOP : d // just passed: wraps to the far end (and is culled there)
    }

    function lake(g: CanvasRenderingContext2D) {
      for (let i = 0; i < SH.length; i++) {
        SHX[i] = clamp(SX(SH[i][0], SH[i][1]), -W * 2, W * 3)
        SHY[i] = Math.min(H * 4, SY(-0.12, SH[i][1]))
      }
      g.save()
      g.beginPath()
      g.moveTo(SHX[0], SHY[0])
      for (let i = 1; i < SH.length; i++) g.lineTo(SHX[i], SHY[i])
      g.closePath()
      g.clip()
      // the body: the sky's light far away, deep water near
      const bands = 20
      for (let i = 0; i < bands; i++) {
        const y0 = hy + ((H - hy) * i) / bands
        g.fillStyle = pick(rWater, (i / (bands - 1)) ** 0.6)
        g.fillRect(0, y0 - 0.5, W, (H - hy) / bands + 1)
      }
      // the far bank mirrored: the track as a soft band under the inner shore, the far pines upside down
      g.fillStyle = cRefl
      g.beginPath()
      for (let i = 0; i < NIN; i++) g.lineTo(SHX[i], SHY[i])
      for (let i = NIN - 1; i >= 0; i--) g.lineTo(SHX[i] - 0.3 * F / SH[i][1], SHY[i] + (1.3 * F) / SH[i][1])
      g.fill()
      for (let i = 0; i < 5; i++) {
        const p = FARP[i], sp = spr.pine[p.v]
        if (!sp) continue
        const q = (F / p.z) / ((400 / p.hm) * sp.scale)
        const px = SX(p.x, p.z), py = SY(-0.12, p.z)
        g.globalAlpha = (pal.dark ? 0.32 : 0.22) * (1 - fogK(p.z) * 0.6)
        g.setTransform(dpr * q, 0, 0, -dpr * q * 0.85, dpr * (px - sp.ax * q), dpr * (py + sp.ay * q * 0.85))
        g.drawImage(sp.cv, 0, 0)
        g.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
      g.globalAlpha = 1
      // the moon's broken road on the water, under the disc
      const yb = H
      if (spr.moonGlow) {
        g.globalAlpha = pal.dark ? 0.5 : 0.42
        g.drawImage(spr.moonGlow, st.mx - (yb - hy) * 0.2, hy - 6, (yb - hy) * 0.4, yb - hy)
        g.globalAlpha = 1
      }
      g.fillStyle = cGlint
      const kF = F / 900
      for (let i = 0; i < GLINT.length; i += 3) {
        const k = GLINT[i], near = k ** 1.7
        const y = hy + 4 + (yb - hy - 4) * near
        const w = (5 + 60 * near) * (0.35 + GLINT[i + 2]) * kF
        const x = st.mx + (GLINT[i + 1] - 0.5) * (6 + 120 * near) * kF
        g.fillRect(x - w / 2, y, w, 0.8 + 2.6 * near * kF)
      }
      // dry ripples, longer as they come near
      for (let i = 0; i < RIP.length; i += 3) {
        const z = RIP[i + 1]
        const px = SX(RIP[i], z), py = SY(-0.12, z)
        if (px < -60 || px > W + 60 || py > H + 4) continue
        const w = (RIP[i + 2] * F) / z, t2 = Math.max(0.5, (0.018 * F) / z)
        g.fillStyle = cRips[i % 3]
        g.beginPath()
        g.moveTo(px - w / 2, py)
        g.quadraticCurveTo(px - w * 0.1, py - t2, px + w / 2, py + t2 * 0.3)
        g.quadraticCurveTo(px, py + t2, px - w / 2, py)
        g.fill()
      }
      g.restore()
      // the shore: a wet dark rim and an ink line, both fading into the mist
      g.lineCap = 'round'
      for (let i = 1; i < NSH; i++) {
        const z = SH[i][1]
        if (SHY[i] > H + 20 && SHY[i - 1] > H + 20) continue
        g.strokeStyle = pick(rEdge, fogK(z))
        g.lineWidth = clamp((0.05 * F) / z, 0.5, 3)
        g.beginPath()
        g.moveTo(SHX[i - 1], SHY[i - 1])
        g.lineTo(SHX[i], SHY[i])
        g.stroke()
      }
    }

    function road(g: CanvasRenderingContext2D) {
      // surface, far → near: the robots' lane, the human lane a shade darker, a soft verge on both sides
      // one polygon per surface, its fog a vertical gradient (rebuilt only when the horizon or camera height moves)
      grads()
      strip(g, ROAD_L - 0.5, HUM_R + 0.6, gVerge!)
      strip(g, ROAD_L, LANE_R + 0.15, gRoad!)
      strip(g, RAIL + 0.15, HUM_R, gLane!)
      // the packed sand darkens where it meets the verge: ink soaking in along both edges of each lane
      strip(g, ROAD_L, ROAD_L + 0.42, cSoak)
      strip(g, LANE_R - 0.3, LANE_R + 0.15, cSoak)
      strip(g, RAIL + 0.15, RAIL + 0.45, cSoak)
      strip(g, HUM_R - 0.35, HUM_R, cSoak)
      // the moon's sheen on the sand, in a column under the disc (only on the track)
      if (spr.moonGlow) {
        g.save()
        g.beginPath()
        for (let i = 0; i <= NS; i++) g.lineTo(SX(xc(ZS[i]) + ROAD_L, ZS[i]), Math.min(H * 3, SY(0, ZS[i])))
        for (let i = NS; i >= 0; i--) g.lineTo(SX(xc(ZS[i]) + HUM_R, ZS[i]), Math.min(H * 3, SY(0, ZS[i])))
        g.clip()
        g.globalAlpha = pal.dark ? 0.3 : 0.5
        const sw = (H - hy) * 0.5
        g.drawImage(spr.moonGlow, st.mx - sw / 2, hy - 4, sw, (H - hy) * 1.3)
        g.restore()
        g.globalAlpha = 1
      }
      // raked sand: fine lines along the track, converging into the mist (karesansui, and the lanes' perspective)
      g.strokeStyle = cRake
      g.lineCap = 'butt'
      for (let r = 0; r < 26; r++) {
        const u = ROAD_L - 0.45 + r * 0.21 + (r > 15 ? 0.25 : 0)
        g.lineWidth = 0.9
        g.beginPath()
        for (let i = 0; i <= NS; i += 2) {
          const z = ZS[i]
          if (z > 60) break
          const y = SY(0, z)
          if (y > H + 40) continue
          g.lineTo(SX(xc(z) + u, z), y)
        }
        g.stroke()
      }
      // warm pools under the two lit finish lanterns
      if (spr.warm && st.fin < ZF && st.fin > ZN) {
        for (let k = 0; k < 2; k++) {
          const z = st.fin, x = xc(z) + (k ? FIN_R : FIN_L)
          const w = (3.4 * F) / z, hh = Math.max(4, (st.camH * F * 3) / (z * z))
          g.globalAlpha = 0.32 * (1 - fogK(z))
          g.drawImage(spr.warm, SX(x, z) - w / 2, SY(0, z) - hh / 2, w, hh)
        }
        g.globalAlpha = 1
      }
      // dry-brush grit scrolling past (the motion cue on the sand)
      g.fillStyle = cStreak
      for (let i = 0; i < STREAK.length; i += 4) {
        const d = ((((STREAK[i + 1] - st.dist) % 60) + 60) % 60) + ZN + 0.3
        const z0 = d, z1 = d + STREAK[i + 2]
        if (z1 > ZF) continue
        const u = STREAK[i]
        const x0 = SX(xc(z0) + u, z0), x1 = SX(xc(z1) + u, z1)
        const y0 = SY(0, z0), y1 = SY(0, z1)
        const w = Math.max(0.6, (STREAK[i + 3] * F) / z0)
        g.beginPath()
        g.moveTo(x0 - w, y0); g.lineTo(x0 + w, y0); g.lineTo(x1 + w * 0.3, y1); g.lineTo(x1 - w * 0.3, y1)
        g.fill()
      }
      // ink edges of the lanes as tapered strips (heavy near, a hair in the mist), a dashed line down the robots' lane
      for (let e = 0; e < 4; e++) {
        const u = e === 0 ? ROAD_L : e === 1 ? LANE_R + 0.15 : e === 2 ? RAIL + 0.15 : HUM_R
        const hw = e === 0 || e === 3 ? 0.035 : 0.02
        for (let ch = 0; ch < 3; ch++) {
          const i0 = ch * 24, i1 = Math.min(NS, i0 + 24)
          g.fillStyle = pick(rEdge, fogK(ZS[i0 + 12]))
          g.beginPath()
          for (let i = i0; i <= i1; i++) {
            const z = ZS[i]
            g.lineTo(SX(xc(z) + u - hw, z), SY(0, z))
          }
          for (let i = i1; i >= i0; i--) {
            const z = ZS[i]
            g.lineTo(SX(xc(z) + u + hw, z), SY(0, z))
          }
          g.fill()
        }
      }
      g.fillStyle = cDash
      for (let j = 0; j < 14; j++) {
        const d0 = ((((j * 6 - st.dist) % 84) + 84) % 84) + ZN + 0.2
        const d1 = d0 + 2.6
        if (d1 > ZF) continue
        g.globalAlpha = 1 - fogK(d0)
        g.beginPath()
        g.moveTo(SX(xc(d0) - 0.05, d0), SY(0, d0)); g.lineTo(SX(xc(d0) + 0.05, d0), SY(0, d0))
        g.lineTo(SX(xc(d1) + 0.04, d1), SY(0, d1)); g.lineTo(SX(xc(d1) - 0.04, d1), SY(0, d1))
        g.fill()
      }
      g.globalAlpha = 1
      // the season's time, painted big in ink on the track and running at us; the two winning times stay painted at
      // their two finishes (0.31 apart in depth) once the second season is run
      if (st.num >= 0) paintNum(g, st.num, st.num === 1 ? (RAIL + HUM_R) / 2 + 0.2 : st.num === 0 ? 0.1 : 0, st.numS, 9, st.num === 1 ? 2.1 : 3.0, 1)
      if (st.cmp > 0.01) {
        paintNum(g, 2, 0, st.nearZ + 0.8, 7.5, 2.9, st.cmp)
        paintNum(g, 0, 0, st.nearZ / 0.31 + 0.8, 9, 3.0, st.cmp)
      }
    }
    // a painted number lying on the track from z0 (its foot, near) to z0 + len (its head, far), `span` m wide, centred
    // `u` m off the lane centre: sliced into strips, each scaled to its own depth, so it foreshortens like paint would
    function paintNum(g: CanvasRenderingContext2D, k: number, u: number, z0: number, len: number, span: number, a: number) {
      const sp = numSpr[k]
      if (!sp) return
      // each strip is a sheared copy of its rows: top edge at its far depth, bottom at its near one (the lane bends and
      // converges, so rectangles would step); strips overlap half a pixel, the paint is opaque, no seams
      const N = 32, sw = sp.width, sh = sp.height / N
      g.globalAlpha = a
      for (let i = 0; i < N; i++) {
        const za = z0 + len * (1 - i / N), zb = z0 + len * (1 - (i + 1) / N)
        if (zb < ZN + 0.3 || za > ZF) continue
        const ya = SY(0, za), yb = SY(0, zb)
        if (ya > H || yb < hy) continue
        const xa = SX(xc(za) + u, za), xb = SX(xc(zb) + u, zb), w = (span * F) / ((za + zb) / 2)
        const sa = w / sw, c = (xb - xa) / sh, d = (yb - ya + 0.5) / sh
        g.setTransform(dpr * sa, 0, dpr * c, dpr * d, dpr * (xa - w / 2 - c * i * sh), dpr * (ya - d * i * sh))
        g.drawImage(sp, 0, i * sh, sw, sh, 0, i * sh, sw, sh)
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.globalAlpha = 1
    }
    let dpr = 1
    function strip(g: CanvasRenderingContext2D, u0: number, u1: number, fillS: CanvasGradient | string) {
      g.fillStyle = fillS
      g.beginPath()
      for (let i = 0; i <= NS; i++) g.lineTo(SX(xc(ZS[i]) + u0, ZS[i]), Math.min(H * 3, SY(0, ZS[i])))
      for (let i = NS; i >= 0; i--) g.lineTo(SX(xc(ZS[i]) + u1, ZS[i]), Math.min(H * 3, SY(0, ZS[i])))
      g.fill()
    }
    // shortcut: a gradient object per frame while the camera cranes (≈ 2.7 s); cached otherwise
    let gHy = NaN, gCam = NaN, gH = 0, gPal: Pal | null = null, gVerge: CanvasGradient | null = null, gRoad: CanvasGradient | null = null, gLane: CanvasGradient | null = null
    function grads() {
      if ((Math.abs(hy - gHy) < 0.05 && Math.abs(st.camH - gCam) < 0.005 && gH === H && gPal === pal) || !c2) return
      gHy = hy; gCam = st.camH; gH = H; gPal = pal
      const mk = (r: string[], k0: number, k1: number) => {
        const gr = c2!.createLinearGradient(0, hy, 0, H)
        for (let k = 0; k <= 10; k++) {
          const y = hy + ((H - hy) * k) / 10
          const z = (st.camH * F) / Math.max(0.5, y - hy)
          gr.addColorStop(k / 10, pick(r, fogK(z) * k1 + k0))
        }
        return gr
      }
      gVerge = mk(rGround, 0.12, 0.6)
      gRoad = mk(rRoad, 0, 1)
      gLane = mk(rLane, 0, 1)
    }

    // where item d stands (x, z) and how tall / wide it is
    function foot(d: number, out: Float32Array) {
      const k = DK[d], z = DZ[d], i = DI[d]
      if (k === K_PROP) {
        const p = PROPS[i]
        out[0] = xc(z) + p.u; out[1] = z; out[2] = p.kind === 0 ? p.hm * 0.55 : p.kind === 1 ? p.hm : p.hm * 0.6; out[3] = p.kind === 0 ? 1.6 : p.kind === 1 ? 0.9 : 0.6
      } else if (k === K_POST) (out[0] = xc(z) + RAIL), (out[1] = z), (out[2] = 1), (out[3] = 0.08)
      else if (k === K_FIN) (out[0] = xc(z)), (out[1] = z), (out[2] = 1.5), (out[3] = 0.6)
      else if (k === K_OLD) (out[0] = xc(z), out[1] = z, out[2] = 1.1, out[3] = 3.4)
      else if (k === K_GHOST) (out[0] = xc(z) + (RAIL + HUM_R) / 2 + 0.1), (out[1] = z), (out[2] = 1.75), (out[3] = 0.4)
      else (out[0] = xc(z)), (out[1] = z), (out[2] = 1.62), (out[3] = 0.55)
      return out
    }
    const FT = new Float32Array(4)
    function shadow(g: CanvasRenderingContext2D, d: number, shx: number, shz: number) {
      const k = DK[d]
      if ((k === K_PROP && PROPS[DI[d]].kind > 1) || k === K_OLD || k === K_POST || k === K_FAR) return
      foot(d, FT)
      const x = FT[0], z = FT[1], wm = FT[3]
      // a body lying down throws almost no shadow: only the one it lies in
      const tip = k === K_ROBOT ? P.tip : k === K_DOWN ? FP.tip : 0
      const up = Math.cos(tip), side = Math.sin(tip)
      let L = FT[2] * up
      let tz = z + shz * L
      if (tz < ZN + 0.3) (L *= (z - ZN - 0.3) / (z - tz)), (tz = z + shz * L)
      const tx = x + shx * L
      const f = fogK(z)
      g.fillStyle = cShadow
      g.globalAlpha = (k === K_GHOST ? 0.35 * st.ghost : 1) * (1 - f)
      const hw = (k === K_FIN ? 0.25 : wm) / 2
      g.beginPath()
      if (k === K_FIN) {
        // two lantern shadows
        for (let q = 0; q < 2; q++) {
          const bx = xc(z) + (q ? FIN_R : FIN_L)
          g.moveTo(SX(bx - hw, z), SY(0, z)); g.lineTo(SX(bx + hw, z), SY(0, z)); g.lineTo(SX(bx + shx * L * 0.9 + hw * 0.4, tz), SY(0, tz)); g.lineTo(SX(bx + shx * L * 0.9 - hw * 0.4, tz), SY(0, tz))
        }
      } else if (L > 0.05) {
        g.moveTo(SX(x - hw, z), SY(0, z))
        g.lineTo(SX(x + hw, z), SY(0, z))
        g.lineTo(SX(tx + hw * 0.35, tz), SY(0, tz))
        g.lineTo(SX(tx - hw * 0.35, tz), SY(0, tz))
      }
      g.fill()
      // contact shadow: a soft dark pool where it touches the sand (along the body when it lies down), a darker core
      if (k !== K_FIN && spr.shade) {
        const cxm = x + 0.82 * side, rx = (wm * 0.62 + 0.12 + 0.8 * Math.abs(side)) * F / z
        const ry = Math.max(1.2, ((wm * 0.24 + 0.08) * st.camH * F) / (z * z) + 1)
        const px = SX(cxm, z), py = SY(0, z)
        g.globalAlpha = (k === K_GHOST ? 0.3 * st.ghost : pal.dark ? 0.85 : 0.6) * (1 - f)
        g.drawImage(spr.shade, px - rx * 1.3, py - ry * 1.4, rx * 2.6, ry * 2.8)
        g.globalAlpha *= 0.8
        g.beginPath()
        g.ellipse(px, py, rx * 0.7, ry * 0.55, 0, 0, Math.PI * 2)
        g.fill()
      }
      g.globalAlpha = 1
    }

    function stamp(g: CanvasRenderingContext2D, sp: Sprite, unitsPerM: number, x: number, z: number, alpha: number) {
      const q = (F / z) / (unitsPerM * sp.scale)
      const px = SX(x, z), py = SY(0, z)
      const w = sp.cv.width * q, hh = sp.cv.height * q
      if (px + w < -20 || px - w > W + 20 || py - hh > H) return
      g.globalAlpha = alpha
      g.drawImage(sp.cv, px - sp.ax * q, py - sp.ay * q, w, hh)
      g.globalAlpha = 1
    }

    function item(g: CanvasRenderingContext2D, d: number) {
      const k = DK[d], z = DZ[d]
      const f = fogK(z)
      if (k === K_PROP) {
        const p = PROPS[DI[d]]
        const x = xc(z) + p.u
        if (p.kind === 0) spr.pine[p.v] && stamp(g, spr.pine[p.v], 400 / p.hm, x, z, (1 - f * 0.3) * (1 - st.hyK * clamp((26 - z) / 12, 0, 1)))
        else if (p.kind === 1) spr.toro && stamp(g, spr.toro, 100 / p.hm, x, z, 1 - f * 0.4)
        else if (p.kind === 2) spr.reeds[p.v] && stamp(g, spr.reeds[p.v], 100 / p.hm, x, z, (1 - f) * 0.9)
        else spr.grass[p.v] && stamp(g, spr.grass[p.v], 100 / p.hm, x, z, (1 - f) * 0.8)
      } else if (k === K_POST) {
        // a bamboo post and the two bamboo rails running on to the next post, nodes and a moonlit edge
        const x = xc(z) + RAIL, z2 = z + 2.4
        const px = SX(x, z)
        if (px > W + 40) return
        const fi = Math.round(f * 24)
        const pw = clamp((0.075 * F) / z, 0.7, 40)
        bamboo(g, px, SY(0, z), px, SY(1.02, z), pw, (0.34 * F) / z, rBam[fi], rNode[fi], cBamLit, rimSide())
        if (z2 < ZF) {
          const x2 = xc(z2) + RAIL, rw = clamp((0.05 * F) / z, 0.5, 26)
          const seg = (0.7 * F) / z
          bamboo(g, px, SY(0.9, z), SX(x2, z2), SY(0.9, z2), rw, seg, rBam[fi], rNode[fi], cBamLit, 1)
          bamboo(g, px, SY(0.48, z), SX(x2, z2), SY(0.48, z2), rw * 0.9, seg, rBam[fi], rNode[fi], cBamLit, 1)
        }
      } else if (k === K_FAR) {
        const p = FARP[DI[d]]
        if (p.k) spr.reeds[p.v] && stamp(g, spr.reeds[p.v], 100 / p.hm, p.x, z, 0.95)
        else spr.pine[p.v] && stamp(g, spr.pine[p.v], 400 / p.hm, p.x, z, 1 - f * 0.4)
      } else if (k === K_DOWN) figure(g, SX(xc(z) - 1.0, z), SY(0, z), F / z, FP, ton[Math.min(ton.length - 1, Math.round(f * (ton.length - 1)))], BACK, rimSide())
      else if (k === K_FIN) finish(g, z, f)
      else if (k === K_OLD) oldRibbon(g, z, f)
      else if (k === K_GHOST) {
        g.globalAlpha = 1
        figure(g, SX(xc(z) + (RAIL + HUM_R) / 2 + 0.1, z), SY(0, z), F / z, GP, ton[0], HUMAN, rimSide(), 0, st.ghost * (1 - f * 0.8))
      } else figure(g, SX(xc(z), z), SY(0, z), F / z, P, ton[Math.min(ton.length - 1, Math.round(f * (ton.length - 1)))], BACK, rimSide())
    }
    const rimSide = () => (st.mx > cx ? 1 : -1)

    // the finish: two lit stone lanterns and the red silk between them (a dot in the mist, then rushing in, then broken)
    function finish(g: CanvasRenderingContext2D, z: number, f: number) {
      const a = xc(z)
      for (let k = 0; k < 2; k++) if (spr.lit) stamp(g, spr.lit, 100 / 1.5, a + (k ? FIN_R : FIN_L), z, 1 - f * 0.8)
      if (st.broke < 0) {
        g.strokeStyle = cRibbon
        g.globalAlpha = 1 - f * 0.6
        g.lineWidth = Math.max(1.4, (0.045 * F) / z)
        g.lineCap = 'round'
        g.beginPath()
        g.moveTo(SX(a + FIN_L + 0.12, z), SY(1.08, z))
        g.quadraticCurveTo(SX(a - 0.2, z), SY(0.9, z), SX(a + FIN_R - 0.12, z), SY(1.08, z))
        g.stroke()
        g.globalAlpha = 1
      } else ribbonEnds(g, z)
    }
    // the broken ribbon: two halves trailing from the lanterns, fluttering down
    function ribbonEnds(g: CanvasRenderingContext2D, z: number) {
      // snapped at the chest: each half whips back and settles hanging from its lantern, its end on the sand
      const a = xc(z), t = st.broke
      const k = smooth(t / 1.2), fl = Math.exp(-t * 2.4) * Math.sin(t * 13)
      g.strokeStyle = cRibbon
      g.lineCap = 'round'
      g.lineWidth = Math.max(1.2, (0.035 * F) / z)
      g.beginPath()
      for (let q = 0; q < 2; q++) {
        const x0 = a + (q ? FIN_R - 0.1 : FIN_L + 0.1), dir = q ? -1 : 1
        const ex = lerp(a - dir * 0.1, x0 + dir * 0.35, k) + 0.15 * fl, ey = lerp(1.15, 0.04, k), ez = z - 0.5 * k
        g.moveTo(SX(x0, z), SY(1.08, z))
        g.bezierCurveTo(SX(x0 + dir * lerp(0.6, 0.3, k), z), SY(lerp(1.2, 0.95, k) + 0.12 * fl, z),
          SX(lerp(a - dir * 0.3, x0 + dir * 0.5, k), z - 0.2 * k), SY(lerp(1.2, 0.35, k), z - 0.2 * k), SX(ex, ez), SY(ey, ez))
      }
      g.stroke()
    }
    // the 2025 finish, far up the track: an old grey silk on two stakes
    function oldRibbon(g: CanvasRenderingContext2D, z: number, f: number) {
      const a = xc(z)
      g.globalAlpha = st.cmp * (1 - f * 0.7)
      g.strokeStyle = cRibbonEdge
      g.lineCap = 'round'
      g.lineWidth = Math.max(1, (0.06 * F) / z)
      g.beginPath()
      g.moveTo(SX(a - 1.9, z), SY(0, z)); g.lineTo(SX(a - 1.9, z), SY(1.15, z))
      g.moveTo(SX(a + 1.55, z), SY(0, z)); g.lineTo(SX(a + 1.55, z), SY(1.15, z))
      g.stroke()
      g.strokeStyle = cRibbonOld
      g.lineWidth = Math.max(1.2, (0.08 * F) / z)
      g.beginPath()
      g.moveTo(SX(a - 1.9, z), SY(1.1, z))
      g.quadraticCurveTo(SX(a - 0.2, z), SY(0.86, z), SX(a + 1.55, z), SY(1.1, z))
      g.stroke()
      g.globalAlpha = 1
    }

    // DOM that rides the world: the two ribbon tags, the moon
    function place() {
      for (let k = 0; k < 2; k++) {
        const el = k ? tagFar : tagNear
        const z = k ? st.nearZ / 0.31 : st.nearZ
        const on = st.cmp > 0.02 && z > ZN && stop === 2
        el.style.opacity = on ? String(st.cmp) : '0'
        if (!on || port) continue
        // the old finish: its tag hangs left of its left stake (the runner hides the middle); the new one over its lantern
        const x = clamp(k ? SX(xc(z) - 1.95, z) - 132 : SX(xc(z) + FIN_R - 0.3, z), W * 0.03, W * 0.97 - 120), y = SY(k ? 1.3 : 1.75, z)
        el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
      }
      
      sky.style.transform = `translate3d(0, ${((hy - hy0) * 0.9).toFixed(1)}px, 0)`
      moon.style.transform = `translate(${st.mx.toFixed(1)}px, ${st.my.toFixed(1)}px)`
    }

    // ── the moon's path across the sky: low over the hills on the right (garden 7's low moon, long shadows), climbing
    // leftward over the lake through the seasons
    const arc = (t: number): Pt => port
      ? [W * (0.84 - 0.14 * t), hy0 - H * (0.1 + 0.23 * t ** 0.85)]
      : [W * (0.82 - 0.36 * t), hy0 - hy0 * (0.34 + 0.46 * t ** 0.85)]
    const SAMP = new Float32Array(97 * 2)
    function setMoon(t: number) {
      const [x, y] = arc(t)
      st.mx = x
      st.my = y
      way.set(t)
    }

    // ── stops
    let shown = -1, reached = false
    function showText(i: number) {
      if (i === shown) return
      shown = i
      moon.setAttribute('aria-valuenow', String(i))
      moon.setAttribute('aria-valuetext', valueText(i))
      const m = MS[i]
      // "today" has no fact of its own: the camera cranes up, and the forecast in the mist says the rest
      read.replaceChildren(h('p', { class: 'p2-eyebrow' }, `${viDate(m.date)} · ${m.label}`), 'fact' in m && m.fact ? ctx.fact(m.fact as Fact, 'p', 't21r-fact') : '')
      read.classList.remove('in')
      void read.offsetWidth
      read.classList.add('in')
      if (!read.hasAttribute('aria-live')) read.setAttribute('aria-live', 'polite')
      root.classList.toggle('today', i === N)
    }
    function go(i: number) {
      const first = shown < 0
      stop = i
      tt = i / N
      setMoon(tt)
      showText(i)
      from.camH = st.camH; from.hyK = st.hyK; from.lamps = st.lamps
      if (!first) crossfade()
      tau = still ? 99 : 0
      if (still) (from.camH = CAM0), (from.hyK = 0), (from.lamps = 0)
      episode(stop, tau)
      if (still) loop.wake()
      else loop.start()
      // the insight comes where the robot passes the human record (04/2026), then on to today
      if (i >= 2 && !reached) {
        reached = true
        moonDot.done()
        ctx.insight(S.insight as Fact, S.detail as Fact)
        if (i < N) ctx.prompt(S.next)
      }
      if (i === N) way.done()
    }
    function crossfade() {
      // the new season cuts in over a fading copy of the last frame (one drawImage, then an opacity tween)
      const g = fade.getContext('2d')
      if (!g) return
      fade.width = cv.width
      fade.height = cv.height
      g.drawImage(cv, 0, 0)
      fade.getAnimations().forEach((a) => a.cancel())
      if (!ctx.reduced) fade.animate([{ opacity: 1 }, { opacity: 0 }], { duration: still ? 320 : 420, easing: 'ease-out', fill: 'forwards' })
      else fade.style.opacity = '0'
    }

    const loop = createLoop(root, (_t, dt) => {
      if (!ready) return false
      if (!drag) {
        tau += dt
        episode(stop, still ? 99 : tau)
      }
      frame()
      return !drag && tau < DUR[stop] + 0.1 ? true : drag
    })
    ctx.onCleanup(() => loop.dispose())

    // drag anywhere: the moon follows the nearest point of its path; the shadows swing with it
    let rect: DOMRect | null = null
    const tAt = (x: number, y: number) => {
      let best = 0, bd = Infinity
      for (let k = 0; k < 97; k++) {
        const d = (SAMP[k * 2] - x) ** 2 + (SAMP[k * 2 + 1] - y) ** 2
        if (d < bd) (bd = d), (best = k)
      }
      return best / 96
    }
    const scrub = (e: PointerEvent) => {
      tt = tAt(e.clientX - rect!.left, e.clientY - rect!.top)
      setMoon(tt)
      showText(Math.round(tt * N))
      st.dist = d0 + tt * 6
      loop.wake()
    }
    root.addEventListener('pointerdown', (e) => {
      if (e.button || !ready || (e.target as Element).closest('.t21r-text, .t21r-tag, .t21r-horizon')) return
      drag = true
      rect = root.getBoundingClientRect()
      root.setPointerCapture(e.pointerId)
      root.classList.add('grab')
      moon.focus({ preventScroll: true })
      d0 = st.dist - tt * 6
      ctx.chime('soft')
      scrub(e)
    })
    root.addEventListener('pointermove', (e) => drag && scrub(e))
    const end = () => {
      if (!drag) return
      drag = false
      root.classList.remove('grab')
      go(Math.round(tt * N))
    }
    root.addEventListener('pointerup', end)
    root.addEventListener('pointercancel', end)
    moon.addEventListener('keydown', (e) => {
      const k = ({ ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 } as Record<string, number>)[e.key]
      const to = k ? clamp(stop + k, 0, N) : e.key === 'Home' ? 0 : e.key === 'End' ? N : -1
      if (to < 0) return
      e.preventDefault()
      if (to !== stop || shown < 0) go(to)
    })

    // ── build: palette + sprites (sliced), then the first frame
    function colours() {
      pal = palette()
      ton = toneRamp(pal, true)
      const p = pal
      const groundNear = p.dark ? mix(p.paper, p.rockLo, 0.55) : mix(p.paper2, p.rockMid, 0.32)
      rGround = ramp(groundNear, p.fog)
      rRoad = ramp(p.dark ? mix(p.stepLo, p.paper, 0.2) : mix(p.stepHi, p.stepMid, 0.3), p.fog)
      rLane = ramp(p.dark ? mix(p.stepLo, p.paper, 0.45) : mix(p.stepHi, p.stepMid, 0.62), p.fog)
      rWater = ramp(p.dark ? mix(p.fog, p.water, 0.4) : mix(p.fog, p.water, 0.3), p.dark ? mix(p.water, p.fog, 0.3) : mix(p.water, p.wash, 0.18))
      rEdge = ramp(p.dark ? mix(p.ink3, p.paper, 0.35) : p.wash, p.fog, 24, p.dark ? 0.75 : 0.62)
      // bamboo: a yellowed green culm, dark node rings, a soft moonlit edge (not chrome)
      const stem = p.dark ? mix(mix(p.moss, p.lantern, 0.22), p.paper, 0.25) : mix(mix(p.moss, p.lantern, 0.2), p.wash, 0.18)
      rBam = ramp(stem, p.fog)
      rNode = ramp(mix(stem, p.umbra, 0.6), p.fog)
      cBamLit = p.dark ? col(p.moon, 0.38) : 'rgba(255,255,255,0.5)'
      rShed = ramp(p.dark ? mix(p.paper, p.umbra, 0.3) : mix(p.wash, p.fog, 0.45), p.fog)
      cWin = col(p.dark ? p.lantern : mix(p.lantern, p.vermilion, 0.3))
      cSoak = p.dark ? col(p.umbra, 0.24) : col(p.wash, 0.08)
      cRefl = p.dark ? col(mix(p.stepLo, p.paper, 0.3), 0.3) : col(p.wash, 0.13)
      cRake = p.dark ? col(p.moon, 0.07) : col(p.wash, 0.09)
      cDash = p.dark ? col(p.moon, 0.45) : 'rgba(255,255,255,0.95)'
      cStreak = p.dark ? col(p.moon, 0.07) : col(p.wash, 0.1)
      cRips = [0.5, 0.8, 1.2].map((k) => (p.dark ? col(p.moon, 0.14 * k) : `rgba(255,255,255,${(0.4 * k).toFixed(2)})`))
      cGlint = p.dark ? col(p.moon, 0.8) : 'rgba(255,255,255,0.85)'
      cShadow = p.dark ? 'rgba(0,0,0,0.42)' : col(p.umbra, 0.15)
      cRibbon = col(p.vermilion, 0.95)
      cRibbonOld = p.dark ? col(p.ink3, 0.75) : col(p.ink3, 0.6)
      cRibbonEdge = col(p.dark ? p.ink3 : p.wash, 0.6)
    }
    function* sprites() {
      const p = pal
      const scale = Math.min(devicePixelRatio || 1, low ? 1 : 1.25)
      const ink = col(p.tree)
      // pines are solid ink masses (the mist between the depths pales them, not their own transparency)
      const pad = col(p.dark ? mix(p.paper, p.fog, 0.32) : mix(p.wash, p.fog, 0.5))
      const needle = col(p.dark ? mix(p.paper, p.fog, 0.12) : p.wash)
      const trunk = col(p.dark ? mix(p.paper, p.umbra, 0.2) : p.wash)
      const treePaint = (cls: string) =>
        cls.includes('p2p-pad') ? { fill: pad, alpha: 0.96, soft: low ? 0 : 1.4 }
        : cls.includes('p2p-trunk') ? { fill: trunk, alpha: 0.95, soft: low ? 0 : 0.7 }
        : cls.includes('p2p-bark') ? { fill: pad, alpha: 0.6 }
        : cls.includes('p2p-needle') ? { fill: needle, alpha: 0.88 }
        : cls.includes('p2p-reeds') ? { fill: ink, alpha: 0.6, soft: 0.9 }
        : cls.includes('p2p-grass') ? { fill: ink, alpha: 0.45 }
        : null
      spr.pine = []
      for (let v = 0; v < 3; v++) {
        spr.pine.push(bake(pine(0, 0, 400, 2140 + v * 7, v === 1 ? -1 : 1), { x: -320, y: -540, w: 660, h: 560 }, scale, treePaint))
        yield
      }
      const toroPaint = (lit: boolean) => (cls: string, g: CanvasRenderingContext2D) => {
        if (cls.includes('p2p-contact')) return null
        if (cls.includes('p2p-lamp-halo')) return lit ? { fill: radial(g, 0, -63, 34, p.lantern), alpha: 0.9 } : null
        if (cls.includes('p2p-toro-stone')) {
          const gr = g.createLinearGradient(0, -95, 12, 0)
          gr.addColorStop(0, col(p.rockHi)); gr.addColorStop(0.55, col(p.rockMid)); gr.addColorStop(1, col(p.rockLo))
          return { fill: gr, soft: 0.9 }
        }
        if (cls.includes('p2p-toro-shade')) {
          const gr = g.createLinearGradient(-20, 0, 20, 0)
          gr.addColorStop(0, col(p.umbra, 0)); gr.addColorStop(0.55, col(p.umbra, 0.08)); gr.addColorStop(1, col(p.umbra, 0.42))
          return { fill: gr }
        }
        if (cls.includes('p2p-toro-fire')) return lit ? { fill: col(p.lantern) } : { fill: col(p.umbra), alpha: 0.55 }
        if (cls.includes('p2p-toro-ink')) return { fill: col(p.wash), alpha: 0.45 }
        return null
      }
      spr.toro = bake(toro(0, 0, 100, false), { x: -40, y: -100, w: 80, h: 104 }, scale * 1.5, toroPaint(false))
      yield
      spr.lit = bake(toro(0, 0, 100, true), { x: -40, y: -100, w: 80, h: 104 }, scale * 1.5, toroPaint(true))
      yield
      spr.reeds = [bake(reeds(0, 0, 100, 2150, 9), { x: -50, y: -130, w: 110, h: 134 }, scale * 2, treePaint), bake(reeds(0, 0, 100, 2151, 6), { x: -50, y: -130, w: 110, h: 134 }, scale * 2, treePaint)]
      spr.grass = [bake(grass(0, 0, 100, 2152), { x: -70, y: -90, w: 140, h: 94 }, scale * 1.5, treePaint), bake(grass(0, 0, 100, 2153), { x: -70, y: -90, w: 140, h: 94 }, scale * 1.5, treePaint)]
      spr.lamp = glow(p.dark ? p.lantern : mix(p.lantern, p.vermilion, 0.3), 32, 0.42)
      spr.warm = glow(p.lantern, 64, 0.6)
      spr.shade = glow(p.dark ? [0, 0, 0] : p.wash, 64, 0.7)
      spr.fog = glow(p.fog, 64, 0.8)
      spr.veil = veil(p.fog)
      spr.moonGlow = glow(p.dark ? p.moon : mix(p.moon, [255, 255, 255], 0.5), 64, 0.7)
      yield
      // the three times as ink painted on sand: a bold numeral, dry-brush gaps raked through it
      for (let k = 0; k < 3; k++) numSpr[k] = paintedNumber(NUMS[k], numInk(k), `600 120px ${p.serif}`, 2160 + k)
      yield
    }
    // the paint: ink (ivory on the night track), the 2026 winner in vermilion; a little of the sand shows through
    const numInk = (k: number) => mix(k === 2 ? pal.vermilion : pal.ink, pal.dark ? mix(pal.stepLo, pal.paper, 0.2) : pal.stepHi, 0.16)
    function paintedNumber(text: string, c0: [number, number, number], font: string, seed: number) {
      const cvN = document.createElement('canvas')
      const g = cvN.getContext('2d')!
      g.font = font
      const w = Math.ceil(g.measureText(text).width) + 8
      cvN.width = w
      cvN.height = 128
      g.font = font
      g.textBaseline = 'alphabetic'
      g.fillStyle = col(c0)
      g.fillText(text, 4, 112)
      g.globalCompositeOperation = 'destination-out'
      const r = rng(seed)
      for (let i = 0; i < 22; i++) {
        g.globalAlpha = 0.12 + r() * 0.3
        g.fillRect(r() * w, 20 + r() * 96, 10 + r() * 50, 0.8 + r() * 1.2)
      }
      return cvN
    }
    function radial(g: CanvasRenderingContext2D, x: number, y: number, r: number, c0: [number, number, number]) {
      const gr = g.createRadialGradient(x, y, 0, x, y, r)
      gr.addColorStop(0, col(c0, 0.55)); gr.addColorStop(0.42, col(c0, 0.16)); gr.addColorStop(1, col(c0, 0))
      return gr
    }
    function backdrop() {
      // the far ranges and the moonlit mist they stand in (static SVG; slides up as the camera cranes)
      sky.setAttribute('viewBox', `0 0 ${W.toFixed(0)} ${H.toFixed(0)}`)
      const base = hy0 + 2
      skyG.replaceChildren(
        mist(W * 0.42, base - H * 0.16, W * 0.7, H * 0.22),
        hills(-W * 0.05, W * 1.05, base, H * (port ? 0.13 : 0.17), 2111, 0.9, port ? 3 : 6),
        hills(W * 0.42, W * 1.08, base + 1, H * (port ? 0.1 : 0.12), 2112, 0.62, 3),
        mist(W * 0.5, base, W * 0.75, H * 0.05),
        mist(W * 0.2, base - H * 0.02, W * 0.4, H * 0.04),
      )
    }

    let job: ReturnType<typeof sliced> | null = null
    function layout() {
      // the painting bleeds past the gutters to the window's edges (style.css); the art box decides the orientation
      const aw = ctx.art.clientWidth, w = root.clientWidth || aw, hh = stableH(ctx.art.clientHeight)
      if (aw < 60 || hh < 60) return
      root.style.height = `${hh.toFixed(1)}px`
      W = w
      H = hh
      port = H > aw * 1.05
      // CHASE: the camera rides behind the robot, which stands in the lower third, centred, its feet on the track
      F = port ? W * 1.0 : Math.min(W * 0.62, H * 1.45)
      const robotPx = H * (port ? 0.22 : 0.32), footY = H * (port ? 0.84 : 0.87)
      ZR = (1.62 * F) / robotPx
      hy0 = Math.round(footY - (CAM0 * robotPx) / 1.62)
      camX = xc(ZR)
      cx = W * 0.5
      const r = fit(cv, W, H, low ? 1 : 1.75)
      c2 = r.c
      dpr = r.d
      for (let k = 0; k < 97; k++) {
        const [x, y] = arc(k / 96)
        SAMP[k * 2] = x
        SAMP[k * 2 + 1] = y
      }
      root.classList.toggle('port', port)
      root.style.setProperty('--hy', `${hy0}px`)
      backdrop()
      setMoon(tt)
      if (ready) frame()
    }

    colours()
    ctx.onCleanup(onSize(ctx.art, () => (layout(), gd.refresh()))) // the moon's path is known only after layout
    const offPrefs = onPrefs(() => {
      const before = pal
      colours()
      if (before && before.dark === pal.dark && before.paper.join() === pal.paper.join()) return
      // re-bake in slices (no long task on a theme switch), then one redraw
      job?.cancel()
      gPal = null
      job = sliced(sprites(), { sync: ctx.reduced })
      job.done.then(frame)
    })
    ctx.onCleanup(offPrefs)
    job = sliced(sprites(), { sync: ctx.reduced })
    ctx.onCleanup(() => job?.cancel())
    job.done.then(() => {
      ready = true
      root.classList.add('ready')
      // the station's opening card covers the first season: hold the stumble until it has dissolved
      const card = ctx.el.closest('.player')?.querySelector(':scope > .chapter')
      if (!card || still) return go(0)
      episode(0, 0)
      frame()
      const mo = new MutationObserver(() => {
        if (card.isConnected) return
        mo.disconnect()
        if (shown < 0) go(0)
      })
      mo.observe(card.parentElement!, { childList: true })
      ctx.onCleanup(() => mo.disconnect())
    })
    // the painted numbers are baked in the serif: bake them again once it has loaded
    let alive = true
    ctx.onCleanup(() => void (alive = false))
    if (document.fonts.status !== 'loaded') document.fonts.ready.then(() => {
      if (!ready || !alive) return
      for (let k = 0; k < 3; k++) numSpr[k] = paintedNumber(NUMS[k], numInk(k), `600 120px ${pal.serif}`, 2160 + k)
      frame()
    })
  },
}
