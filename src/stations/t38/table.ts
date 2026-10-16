import { clamp, rng } from '../../ui/part2/ink'
import { GRAIN, brush, col, fbm, glow, mix, noise2, sprite, type Pal, type RGB } from './ink2d'

/**
 * The bonseki of scene 3: a stone tray of sand on a pedestal, its landscape a real heightfield mixed from four baked
 * feature sets by the three levers (terraces ∝ slow, wild ground + pines ∝ fast & loose, a ring wall ∝ control with a
 * gate ∝ sharing, gentle common hills ∝ sharing), 40 lanterns that crowd inside the wall or spread out, and mist when
 * every lever sits in the middle. Lit by the setting moon (left, low) with cast shadows, cavity shade, paddies holding
 * the sky, depth haze, a brushed terminator, an ink line on every silhouette, paper grain. Rendered in software (a
 * column ray-cast with a y-buffer, front to back) into three depth slices, so pines and lanterns sit between them.
 * Nothing runs unless asked: mix() + render() on a lever change.
 */

export type Lv = { s: number; c: number; k: number }
export interface TrayView {
  /** render size (px) of the tray canvas */
  RW: number
  RH: number
  /** the tray in render px: centre x, near rim's ground line, half width */
  cx: number
  yN: number
  HW: number
}

const XR = 1.12, Z0 = -0.1, Z1 = 1.32, ZI = 1.2 // domain (rim included); interior |x| ≤ 1, 0 ≤ z ≤ ZI
const RIM = 0.16, FLOOR = 0.075
const RING = { x: 0.02, z: 0.66, rx: 0.58, rz: 0.36 }
const P = 0.38 // perspective: scale 1 / (1 + (z − Z0)·P)
const DEPTH = 0.6 // screen depth of the tray, near → far rim, as a share of HW
const HS = 0.8 // px per height unit at the near rim, as a share of HW
const N_LAMPS = 40
const SPLIT = [0.36, 0.78] // depth slices: near < 0.36 ≤ mid < 0.78 ≤ far

const norm = (x: number, y: number, z: number): [number, number, number] => {
  const l = Math.hypot(x, y, z)
  return [x / l, y / l, z / l]
}
const LM = norm(-0.8, 0.4, 0.3) // the setting moon: low, left, a little behind
const sstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

/** Feature sets for one grid size, baked once per module (re-mounting the scene reuses them). */
interface Baked {
  NX: number
  NZ: number
  rim: Float32Array
  terr: Float32Array
  paddy: Float32Array
  wild: Float32Array
  comm: Float32Array
  ring: Float32Array
  inRing: Float32Array
  gateX: Float32Array // |x − ring centre| on the ring's near half, else 9
  n1: Float32Array // brush noise for the terminator
  pines: { x: number; z: number; t: number; v: number; sz: number }[]
  spread: [number, number][]
  huddle: [number, number][]
}
const BAKED = new Map<number, Baked>()

function* bake(NX: number, NZ: number): Generator<void, Baked> {
  const n = NX * NZ
  const B: Baked = {
    NX, NZ,
    rim: new Float32Array(n), terr: new Float32Array(n), paddy: new Float32Array(n), wild: new Float32Array(n), comm: new Float32Array(n),
    ring: new Float32Array(n), inRing: new Float32Array(n), gateX: new Float32Array(n), n1: new Float32Array(n),
    pines: [], spread: [], huddle: [],
  }
  const step = 0.032 // terrace riser
  for (let j = 0; j < NZ; j++) {
    const z = Z0 + ((Z1 - Z0) * j) / (NZ - 1)
    for (let i = 0; i < NX; i++) {
      const x = -XR + (2 * XR * i) / (NX - 1)
      const k = j * NX + i
      // the rim: outside the rounded interior rect, a soft one-cell bevel
      const qx = Math.abs(x) - 0.92, qz = Math.abs(z - ZI / 2) - (ZI / 2 - 0.08)
      const sd = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - 0.08
      B.rim[k] = sstep(-0.012, 0.012, sd)
      // terraces: two hills cut into even steps; the flats hold water
      const hill = 0.3 * Math.exp(-((x - 0.28) ** 2 / 0.34 + (z - 0.78) ** 2 / 0.16)) + 0.17 * Math.exp(-((x + 0.58) ** 2 / 0.12 + (z - 0.42) ** 2 / 0.1)) + 0.03 * fbm(x * 2.2, z * 2.2, 11, 3)
      const q = hill / step, f = q - Math.floor(q)
      B.terr[k] = (Math.floor(q) + sstep(0.82, 1, f)) * step
      B.paddy[k] = hill > step * 0.8 && f < 0.78 ? 1 : 0
      // wild ground: lumps and gullies
      const w1 = fbm(x * 2.6 + 3, z * 2.6, 23, 4)
      B.wild[k] = Math.max(0, w1 - 0.38) * 0.42 + 0.05 * Math.abs(fbm(x * 6, z * 6, 29, 2) - 0.5)
      // the common: long gentle swells
      B.comm[k] = 0.055 * (0.5 + 0.5 * Math.sin(x * 2.1 + 0.6) * Math.cos(z * 2.4 - 0.3)) + 0.03 * fbm(x * 1.4, z * 1.4, 31, 2)
      // the wall ring: an ellipse band, a little thicker at the front
      const dx = (x - RING.x) / RING.rx, dz = (z - RING.z) / RING.rz
      const r = Math.hypot(dx, dz)
      const d = Math.abs(r - 1) * Math.min(RING.rx, RING.rz)
      B.ring[k] = 1 - sstep(0.022, 0.04, d)
      B.inRing[k] = 1 - sstep(0.85, 1.02, r)
      B.gateX[k] = z < RING.z ? Math.abs(x - RING.x) : 9
      B.n1[k] = fbm(x * 7, z * 7, 41, 2)
    }
    if (j % 6 === 5) yield
  }
  const r = rng(3838)
  // pine candidates in groves: off the wall band and the gate path, sorted far → near for drawing
  const groves: [number, number][] = [[-0.72, 0.95], [0.7, 1.0], [-0.55, 0.22], [0.75, 0.3], [0.05, 1.08], [-0.1, 0.62]]
  while (B.pines.length < 34) {
    const [gx, gz] = groves[B.pines.length % groves.length]
    const x = clamp(gx + (r() - 0.5) * 0.42, -0.92, 0.92), z = clamp(gz + (r() - 0.5) * 0.3, 0.06, 1.14)
    const dr = Math.hypot((x - RING.x) / RING.rx, (z - RING.z) / RING.rz)
    if (Math.abs(dr - 1) < 0.14 || (z < RING.z && Math.abs(x - RING.x) < 0.14)) continue
    B.pines.push({ x, z, t: r(), v: Math.floor(r() * 3), sz: 0.6 + r() * 0.75 })
  }
  B.pines.sort((a, b) => b.z - a.z)
  // lanterns: an even scatter over the whole tray, or crowded inside the wall
  for (let i = 0; i < N_LAMPS; i++) {
    const gx = i % 8, gz = Math.floor(i / 8)
    B.spread.push([-0.86 + (gx + 0.2 + r() * 0.6) * (1.72 / 8), 0.08 + (gz + 0.2 + r() * 0.6) * (1.06 / 5)])
    const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * 0.72
    B.huddle.push([RING.x + Math.cos(a) * RING.rx * rr, RING.z + Math.sin(a) * RING.rz * rr])
  }
  return B
}

export interface Table {
  /** heavy first build, run with sliced(); resolves when ready */
  build(): Generator<void, void>
  /** new lever values / palette → heights, light and colour of every cell */
  mix(lv: Lv, p: Pal): void
  /** the same as mix + render, in slices (the first painting, under sliced()) */
  steps(lv: Lv, p: Pal, out: CanvasRenderingContext2D, v: TrayView): Generator<void, void>
  /** draw into a canvas sized RW × RH */
  render(g: CanvasRenderingContext2D, v: TrayView, p: Pal): void
  ready(): boolean
}

export function createTable(low: boolean): Table {
  const NX = low ? 92 : 148, NZ = low ? 64 : 104
  let B: Baked | null = BAKED.get(NX) ?? null
  const n = NX * NZ
  const H = new Float32Array(n)
  const C = new Float32Array(n * 3)
  const warm = new Float32Array(32 * 24)
  const lamps: [number, number][] = Array.from({ length: N_LAMPS }, () => [0, 0])
  let drift = 0, pineN = 0, pineSize = 1, wildness = 0
  let sprites: { key: string; c: HTMLCanvasElement[] } = { key: '', c: [] }
  // render scratch, grown on demand
  let bufW = 0, bufH = 0
  let slices: { im: ImageData; cv: HTMLCanvasElement; g: CanvasRenderingContext2D }[] = []
  let dep = new Float32Array(0)

  const dxC = (2 * XR) / (NX - 1), dzC = (Z1 - Z0) / (NZ - 1)
  const hAt = (x: number, z: number) => {
    const gx = clamp((x + XR) / dxC, 0, NX - 1.001), gz = clamp((z - Z0) / dzC, 0, NZ - 1.001)
    const i = gx | 0, j = gz | 0, tx = gx - i, tz = gz - j, k = j * NX + i
    return (H[k] * (1 - tx) + H[k + 1] * tx) * (1 - tz) + (H[k + NX] * (1 - tx) + H[k + NX + 1] * tx) * tz
  }

  const run = (g: Generator<void, void>) => {
    while (!g.next().done);
  }
  const mixLv = (lv: Lv, p: Pal) => run(mixGen(lv, p))
  function* mixGen(lv: Lv, p: Pal): Generator<void, void> {
    if (!B) return
    const { s, c, k } = lv
    const wT = 1 - sstep(0.12, 0.62, s)
    const wW = sstep(0.38, 0.92, s) * (1 - sstep(0.2, 0.72, k))
    const wC = sstep(0.3, 0.9, c)
    const wallH = 0.21 * sstep(0.04, 1, k)
    const gw = 0.02 + sstep(0.15, 1, c) * 0.17, gk = sstep(0.12, 0.32, c)
    drift = clamp(1 - Math.max(Math.abs(s - 0.5), Math.abs(c - 0.5), Math.abs(k - 0.5)) * 2.6, 0, 1)
    pineN = s
    pineSize = 0.55 + 0.6 * s
    wildness = wW
    for (let i = 0; i < n; i++) {
      const gate = B.gateX[i] < 9 ? (1 - sstep(gw, gw + 0.035, B.gateX[i])) * gk : 0
      const h = FLOOR + wT * B.terr[i] + wW * B.wild[i] + wC * B.comm[i] * (1 - 0.5 * wT) + wallH * B.ring[i] * (1 - gate)
      H[i] = h + (RIM - h) * B.rim[i]
    }
    // lanterns crowd inside the wall, or spread over the whole tray, with sharing
    const sp = sstep(0, 1, c)
    warm.fill(0)
    for (let i = 0; i < N_LAMPS; i++) {
      const a = B.huddle[i], b = B.spread[i]
      lamps[i][0] = a[0] + (b[0] - a[0]) * sp
      lamps[i][1] = a[1] + (b[1] - a[1]) * sp
      // splat its warmth on a coarse grid (lights the sand round it)
      const gx = ((lamps[i][0] + XR) / (2 * XR)) * 31, gz = ((lamps[i][1] - Z0) / (Z1 - Z0)) * 23
      for (let yy = Math.max(0, Math.floor(gz - 3)); yy <= Math.min(23, Math.ceil(gz + 3)); yy++)
        for (let xx = Math.max(0, Math.floor(gx - 3)); xx <= Math.min(31, Math.ceil(gx + 3)); xx++)
          warm[yy * 32 + xx] += Math.exp(-((xx - gx) ** 2 + (yy - gz) ** 2) / 2.2)
    }
    yield
    yield* shade(p, wT, wW, wC, wallH)
  }

  /** tone ramps per material, per theme: [lo, mid, hi] */
  function ramps(p: Pal) {
    const d = p.dark
    return {
      sand: d ? [p['rock-lo'], mix(p['rock-mid'], p['step-mid'], 0.4), p['step-mid']] : [mix(p['rock-mid'], p['rock-lo'], 0.35), mix(p['rock-hi'], p['rock-mid'], 0.45), p['step-hi']],
      stone: d ? [mix(p['rock-lo'], p.umbra, 0.4), p['rock-mid'], p['rock-hi']] : [p['rock-lo'], p['rock-mid'], p['rock-hi']],
      moss: d ? [mix(p['moss-b'], p.umbra, 0.4), p['moss-b'], p['moss-c']] : [p['moss-b'], p['moss-a'], p['moss-c']],
      earth: d ? [mix(p['rock-lo'], p.umbra, 0.6), p['rock-lo'], p['rock-mid']] : [mix(p['rock-lo'], p.wash, 0.35), p['rock-lo'], p['rock-mid']],
      paddy: d ? mix(p.water, p.moon, 0.16) : mix(p.water, p.mist, 0.42),
      glint: d ? p.moon : p['step-hi'],
      fog: d ? mix(p.paper, p.mist, 0.28) : p.mist,
      lamp: p.lantern,
      dawn: [p.dawn[0], p.dawn[1], p.dawn[2], 1] as RGB,
    }
  }

  function* shade(p: Pal, wT: number, wW: number, wC: number, wallH: number): Generator<void, void> {
    if (!B) return
    const R = ramps(p)
    const lx = LM[0], ly = LM[1], lz = LM[2]
    const lh = Math.hypot(lx, lz)
    const sx = lx / lh, sz = lz / lh, slope = ly / lh
    const stepW = Math.min(dxC, dzC)
    const fog0 = p.dark ? 0.04 : 0.08, fog1 = p.dark ? 0.3 : 0.42
    const tone = (r3: RGB[], t: number, out: number[]) => {
      const [a, b] = t < 0.5 ? [r3[0], r3[1]] : [r3[1], r3[2]]
      const u = t < 0.5 ? t * 2 : (t - 0.5) * 2
      out[0] = a[0] + (b[0] - a[0]) * u
      out[1] = a[1] + (b[1] - a[1]) * u
      out[2] = a[2] + (b[2] - a[2]) * u
    }
    const tmp = [0, 0, 0], acc = [0, 0, 0]
    for (let j = 0; j < NZ; j++) {
      if (j % 26 === 25) yield
      const z = Z0 + j * dzC
      const zn = clamp((z - Z0) / (Z1 - Z0), 0, 1)
      for (let i = 0; i < NX; i++) {
        const k = j * NX + i
        const x = -XR + i * dxC
        const h = H[k]
        const hl = H[k - (i > 0 ? 1 : 0)], hr = H[k + (i < NX - 1 ? 1 : 0)]
        const hb = H[k - (j > 0 ? NX : 0)], hf = H[k + (j < NZ - 1 ? NX : 0)]
        let nx = -(hr - hl) / (2 * dxC), nz = -(hf - hb) / (2 * dzC)
        const nl = Math.hypot(nx, 1, nz)
        nx /= nl
        nz /= nl
        const ny = 1 / nl
        const lam = Math.max(0, nx * lx + ny * ly + nz * lz)
        const steep = 1 - ny // 0 flat … ~1 vertical
        // cast shadow: march toward the moon until the ground rises over the ray
        let sh = 0
        let px = x, pz = z, ray = h + 0.004
        for (let t = 0; t < 30; t++) {
          px += sx * stepW
          pz += sz * stepW
          ray += slope * stepW
          if (px < -XR || px > XR || pz < Z0 || pz > Z1 || ray > 0.42) break
          const gi = Math.round((px + XR) / dxC), gj = Math.round((pz - Z0) / dzC)
          const over = H[gj * NX + gi] - ray
          if (over > 0) {
            sh = Math.min(1, sh + over * 60)
            if (sh >= 1) break
          }
        }
        // cavity: hollows darker, crests a touch lighter
        const i2 = Math.min(NX - 1, i + 2), i0 = Math.max(0, i - 2), j2 = Math.min(NZ - 1, j + 2), j0 = Math.max(0, j - 2)
        const cav = (H[j * NX + i0] + H[j * NX + i2] + H[j0 * NX + i] + H[j2 * NX + i]) * 0.25 - h
        let t = 0.16 + 0.95 * lam * (1 - 0.72 * sh) + (B.n1[k] - 0.5) * 0.22 - cav * 4
        // materials
        const rim = B.rim[k]
        const wall = wallH > 0.02 ? B.ring[k] * sstep(0.02, 0.06, h - FLOOR) : 0
        const paddy = wT * B.paddy[k] * (1 - wall) * (1 - rim) * (steep < 0.2 ? 1 : 0)
        const moss = (1 - rim) * (1 - wall) * Math.max(wC * 0.85 * (1 - steep * 2), wW * 0.9)
        const earth = (1 - rim) * (1 - wall) * clamp(steep * 3 - 0.2, 0, 1) * Math.max(wT, wW)
        const stone = Math.max(rim, wall)
        // raked sand: lines across the tray, in the open sand only
        const sandW = clamp(1 - stone - moss - paddy - earth, 0, 1)
        if (sandW > 0.3 && steep < 0.15) {
          const rv = z * 34 + 0.35 * Math.sin(x * 2.3 + z), rk = rv - Math.floor(rv)
          t += rk < 0.2 ? -0.13 : rk < 0.36 ? 0.08 : 0
        }
        // stone courses on the wall's faces
        if (wall > 0.3 && steep > 0.25 && ((h * 30) % 1) < 0.14) t -= 0.12
        t = clamp(t, 0, 1)
        acc[0] = acc[1] = acc[2] = 0
        let wsum = 0
        const add = (r3: RGB[], w: number) => {
          if (w <= 0.001) return
          tone(r3, t, tmp)
          acc[0] += tmp[0] * w
          acc[1] += tmp[1] * w
          acc[2] += tmp[2] * w
          wsum += w
        }
        add(R.sand as RGB[], sandW)
        add(R.stone as RGB[], stone)
        add(R.moss as RGB[], moss)
        add(R.earth as RGB[], earth)
        if (paddy > 0.001) {
          // each paddy holds a sliver of sky; a broken moon glint in a few
          const gl = noise2(x * 26, z * 5, 7) > 0.74 ? 0.55 : 0
          const sky = 0.25 + 0.45 * zn
          const pr = R.paddy[0] + (R.glint[0] - R.paddy[0]) * (sky * 0.4 + gl) * (1 - sh * 0.6)
          const pg = R.paddy[1] + (R.glint[1] - R.paddy[1]) * (sky * 0.4 + gl) * (1 - sh * 0.6)
          const pb = R.paddy[2] + (R.glint[2] - R.paddy[2]) * (sky * 0.4 + gl) * (1 - sh * 0.6)
          acc[0] += pr * paddy
          acc[1] += pg * paddy
          acc[2] += pb * paddy
          wsum += paddy
        }
        let r = acc[0] / wsum, g = acc[1] / wsum, b = acc[2] / wsum
        // undergrowth speckle on wild ground
        if (wW > 0.15 && (1 - rim) * (1 - wall) > 0.5) {
          const sp = noise2(x * 40, z * 40, 3)
          if (sp > 0.62) {
            const a = (sp - 0.62) * 2.2 * wW
            r += (p.umbra[0] - r) * a
            g += (p.umbra[1] - g) * a
            b += (p.umbra[2] - b) * a
          }
        }
        // lantern warmth on the ground round them
        const wv = Math.min(1, warm[Math.round(((z - Z0) / (Z1 - Z0)) * 23) * 32 + Math.round(((x + XR) / (2 * XR)) * 31)] * 0.5)
        if (wv > 0.01) {
          const a = wv * (p.dark ? 0.5 : 0.22) * (1 - stone * 0.5)
          r += (R.lamp[0] - r) * a
          g += (R.lamp[1] - g) * a
          b += (R.lamp[2] - b) * a
        }
        // dawn on the far right, haze with depth (and the drifting mist when every lever sits midway)
        const dw = zn * zn * clamp(0.4 + x * 0.4, 0, 1) * (p.dark ? 0.12 : 0.28)
        r += (R.dawn[0] - r) * dw
        g += (R.dawn[1] - g) * dw
        b += (R.dawn[2] - b) * dw
        const fg = Math.min(0.9, fog0 + fog1 * Math.pow(zn, 1.6) + drift * (p.dark ? 0.35 : 0.5) * (0.35 + 0.65 * zn) * (1 - rim * 0.6))
        r += (R.fog[0] - r) * fg
        g += (R.fog[1] - g) * fg
        b += (R.fog[2] - b) * fg
        C[k * 3] = r
        C[k * 3 + 1] = g
        C[k * 3 + 2] = b
      }
    }
  }

  function ensure(RW: number, RH: number) {
    if (RW === bufW && RH === bufH) return
    bufW = RW
    bufH = RH
    slices = [0, 1, 2].map(() => {
      const cv = document.createElement('canvas')
      cv.width = RW
      cv.height = RH
      const g = cv.getContext('2d')!
      return { im: g.createImageData(RW, RH), cv, g }
    })
    dep = new Float32Array(RW * RH)
  }

  const render = (out: CanvasRenderingContext2D, v: TrayView, p: Pal) => run(renderGen(out, v, p))
  function* renderGen(out: CanvasRenderingContext2D, v: TrayView, p: Pal): Generator<void, void> {
    if (!B) return
    const { RW, RH, cx, yN, HW } = v
    ensure(RW, RH)
    const s1 = 1 / (1 + (Z1 - Z0) * P)
    const K = (HW * DEPTH) / (1 - s1) // near ground line − horizon
    const vy = yN - K
    const hs = HW * HS
    const NS = Math.ceil(((Z1 - Z0) * K * P) / 0.7)
    const zs = new Float32Array(NS + 1), ss = new Float32Array(NS + 1), yg = new Float32Array(NS + 1)
    for (let i = 0; i <= NS; i++) {
      const z = Z0 + ((Z1 - Z0) * i) / NS
      zs[i] = z
      ss[i] = 1 / (1 + (z - Z0) * P)
      yg[i] = vy + K * ss[i]
    }
    const d0 = slices[0].im.data, d1 = slices[1].im.data, d2 = slices[2].im.data
    d0.fill(0)
    d1.fill(0)
    d2.fill(0)
    dep.fill(1e9)
    const R = ramps(p)
    const face = R.stone as RGB[]
    const ink: RGB = p.dark ? p.umbra : p.wash
    const umb = p.umbra
    const sideK = p.dark ? 0.62 : 0.7 // the face is in shade: pulled toward umbra
    const moonC: RGB = p.dark ? mix(p.moon, p['rock-hi'], 0.3) : p['rake-hi']
    const cham = Math.max(2, Math.round(HW * 0.014))
    const fx = 1 / dxC, fz = 1 / dzC
    for (let X = 0; X < RW; X++) {
      if (X % 240 === 239) yield
      const dx = X + 0.5 - cx
      let yTop = Math.min(RH, Math.round(yg[0]))
      for (let i = 0; i <= NS; i++) {
        const s = ss[i]
        const x = dx / (HW * s)
        if (x <= -XR || x >= XR) break
        const z = zs[i]
        const gx = (x + XR) * fx, gz = (z - Z0) * fz
        const ii = Math.min(NX - 2, gx | 0), jj = Math.min(NZ - 2, gz | 0)
        const tx = gx - ii, tz = gz - jj
        const k = jj * NX + ii
        const w00 = (1 - tx) * (1 - tz), w10 = tx * (1 - tz), w01 = (1 - tx) * tz, w11 = tx * tz
        const h = H[k] * w00 + H[k + 1] * w10 + H[k + NX] * w01 + H[k + NX + 1] * w11
        const y = yg[i] - h * hs * s
        const top = Math.max(0, Math.ceil(y))
        if (top >= yTop) continue
        const sl = z < SPLIT[0] ? d0 : z < SPLIT[1] ? d1 : d2
        let r: number, g: number, b: number
        if (i === 0) {
          // the tray's front face: carved stone in the moon's shade (darker than the rim), a little lighter toward the left
          const u = clamp(0.5 - x * 0.3, 0, 1) * 0.5
          r = (face[0][0] + (face[1][0] - face[0][0]) * u) * sideK + umb[0] * (1 - sideK)
          g = (face[0][1] + (face[1][1] - face[0][1]) * u) * sideK + umb[1] * (1 - sideK)
          b = (face[0][2] + (face[1][2] - face[0][2]) * u) * sideK + umb[2] * (1 - sideK)
        } else {
          const c = k * 3
          r = C[c] * w00 + C[c + 3] * w10 + C[c + NX * 3] * w01 + C[c + NX * 3 + 3] * w11
          g = C[c + 1] * w00 + C[c + 4] * w10 + C[c + NX * 3 + 1] * w01 + C[c + NX * 3 + 4] * w11
          b = C[c + 2] * w00 + C[c + 5] * w10 + C[c + NX * 3 + 2] * w01 + C[c + NX * 3 + 5] * w11
        }
        const run = yTop - top
        const stoneCell = i === 0 || B.rim[k] > 0.5
        // the chamfer along the front's top edge catches the setting moon: brightest at the left end
        const chLit = i === 0 ? clamp(0.65 - x * 0.35, 0.15, 1) : 0
        for (let row = top; row < yTop; row++) {
          // long runs are faces (risers, walls, the front): darker toward their foot
          let f = run > 2 ? 1 - 0.3 * ((row - top) / run) : 1
          const o = (row * RW + X) * 4
          if (i === 0) {
            const rr = row - top
            if (rr < cham) {
              const a = (1 - rr / cham) * chLit
              f = 1.08
              sl[o] = (r + (moonC[0] - r) * a) * f
              sl[o + 1] = (g + (moonC[1] - g) * a) * f
              sl[o + 2] = (b + (moonC[2] - b) * a) * f
              sl[o + 3] = 255
              dep[row * RW + X] = z
              continue
            }
            // chisel strata across the face, tool marks down it
            const gr = GRAIN[(((row >> 1) & 127) << 7) | ((X >> 2) & 127)]
            f *= 0.84 + gr * 0.3
            if ((row + ((X * 7) >> 5)) % 9 === 0) f *= 0.86
            if (GRAIN[((X >> 1) & 127) | 64 * 128] > 0.82) f *= 0.9
          }
          f *= stoneCell ? 0.86 + GRAIN[((row & 127) << 7) | (X & 127)] * 0.26 : 0.94 + GRAIN[((row & 127) << 7) | (X & 127)] * 0.12
          sl[o] = r * f
          sl[o + 1] = g * f
          sl[o + 2] = b * f
          sl[o + 3] = 255
          dep[row * RW + X] = z
        }
        yTop = top
        if (yTop <= 0) break
      }
    }
    // ink on every silhouette: where the surface above a pixel is far behind it (or empty), a broken brush line
    const ia = p.dark ? 0.75 : 0.5
    for (let X = 0; X < RW; X++) {
      let prev = 1e9
      for (let row = 0; row < RH; row++) {
        const o = row * RW + X
        const z = dep[o]
        if (z < 1e8 && prev - z > 0.07) {
          const gr = GRAIN[((row & 127) << 7) | ((X * 3) & 127)]
          const a = ia * (gr > 0.25 ? 1 : 0.35)
          for (let dr = 0; dr < 2 && row + dr < RH; dr++) {
            const q = (o + dr * RW) * 4
            const zz = dep[o + dr * RW]
            const sl = zz < SPLIT[0] ? d0 : zz < SPLIT[1] ? d1 : d2
            const aa = dr ? a * 0.4 : a
            sl[q] += (ink[0] - sl[q]) * aa
            sl[q + 1] += (ink[1] - sl[q + 1]) * aa
            sl[q + 2] += (ink[2] - sl[q + 2]) * aa
          }
        }
        prev = z
      }
    }
    yield
    slices.forEach((sl) => sl.g.putImageData(sl.im, 0, 0))

    // pines and lanterns go between the slices they stand in
    const spr = pines(p)
    const proj = (x: number, z: number, h: number): [number, number, number] => {
      const s = 1 / (1 + (z - Z0) * P)
      return [cx + x * HW * s, vy + K * s - h * hs * s, s]
    }
    out.clearRect(0, 0, RW, RH)
    const visible = B.pines.filter((q) => q.t < pineN * 1.08 - 0.06)
    const glowA = p.dark ? 0.9 : 0.75
    for (let si = 2; si >= 0; si--) {
      out.drawImage(slices[si].cv, 0, 0)
      const lo = si === 0 ? -1 : SPLIT[si - 1], hi = si === 2 ? 9 : SPLIT[si]
      for (const q of visible) {
        if (q.z < lo || q.z >= hi) continue
        const [X, Y, s] = proj(q.x, q.z, hAt(q.x, q.z))
        const ph = hs * s * 0.26 * q.sz * pineSize
        const img = spr[(wildness > 0.4 ? 3 : 0) + q.v]
        const pw = (ph * img.width) / img.height
        glow(out, X + ph * 0.42, Y, ph * 0.5, ph * 0.09, p.umbra, p.dark ? 0.6 : 0.3, 0.5)
        out.drawImage(img, X - pw / 2, Y - ph, pw, ph)
      }
      for (const [lx, lz] of lamps) {
        if (lz < lo || lz >= hi) continue
        const [X, Y, s] = proj(lx, lz, hAt(lx, lz))
        const ph = Math.max(2.5, hs * s * 0.05)
        out.fillStyle = col(p.dark ? p.umbra : p.wash, 0.8)
        out.fillRect(X - 0.7, Y - ph, 1.4, ph)
        glow(out, X, Y - ph, ph * 1.6, ph * 1.6, p.lantern, glowA * 0.55, 0.3)
        glow(out, X, Y - ph, ph * 0.5, ph * 0.5, p.dark ? p.moon : p.lantern, glowA, 0.5)
      }
    }
    // mist drifting over the tray when every lever sits midway
    if (drift > 0.02) {
      for (let i = 0; i < 4; i++) {
        const z = 0.25 + i * 0.28
        const [X, Y, s] = proj((i % 2 ? 0.35 : -0.3), z, 0.12)
        glow(out, X, Y, HW * s * 1.1, HW * s * 0.16, p.dark ? mix(p.paper, p.mist, 0.4) : p.mist, drift * (p.dark ? 0.55 : 0.85), 0.6)
      }
    }
  }

  function pines(p: Pal) {
    if (sprites.key === p.key) return sprites.c
    const c: HTMLCanvasElement[] = []
    for (let w = 0; w < 2; w++) for (let v = 0; v < 3; v++) c.push(inkPine(p, w ? 46 : 56, 70, 2, 3900 + v * 13 + w * 101, w ? 1 : 0.1))
    sprites = { key: p.key, c }
    return c
  }

  return {
    *build() {
      if (!B) {
        B = yield* bake(NX, NZ)
        BAKED.set(NX, B)
      }
    },
    mix: mixLv,
    render,
    *steps(lv, p, out, v) {
      yield* mixGen(lv, p)
      yield
      yield* renderGen(out, v, p)
    },
    ready: () => !!B,
  }
}

/** A tray pine as a clean ink silhouette on a sprite, standing on (w/2, h): a leaning trunk, flat cloud pads (a darker
 *  belly under each), a moon rim on the pads' upper left. `wild` 0…1: more pads, broken and lopsided. No fine needles:
 *  the sprite is drawn small, and fine strokes would alias into noise. */
function inkPine(p: Pal, w: number, hh: number, dpr: number, seed: number, wild: number) {
  return sprite(w, hh, dpr, (g) => {
    const r = rng(seed)
    const x0 = w / 2, y0 = hh
    const lean = (r() - 0.5) * w * (0.22 + wild * 0.3)
    const at = (t: number): [number, number] => [x0 + lean * t + Math.sin(t * 3 + seed) * w * 0.04 * (1 + wild), y0 - hh * 0.95 * t]
    const ink = p.dark ? mix(p.umbra, p['moss-b'], 0.5) : mix(mix(p.wash, p['moss-b'], 0.55), p.paper, 0.14)
    const deep = p.dark ? p.umbra : mix(p.wash, p.umbra, 0.35)
    const rimC = p.dark ? col(p.moon, 0.6) : col(p['rake-hi'], 1)
    brush(g, [0, 0.35, 0.7, 0.93].map(at), Math.max(1.6, w * 0.085), col(deep), 0.04, 0.2, 0.35)
    const pads = 3 + Math.round(r() + wild * 1.6)
    for (let i = 0; i < pads; i++) {
      const t = 0.4 + (i / Math.max(1, pads - 1)) * 0.55
      const [tx, ty] = at(t)
      const span = w * (0.5 - t * 0.27) * (0.88 + r() * 0.24) * (1 - wild * 0.15)
      const side = (i % 2 ? 1 : -1) * (i === pads - 1 ? 0.1 : 0.22)
      const cx = tx + side * span, ph = hh * (0.075 + r() * 0.02)
      if (Math.abs(side) > 0.15) brush(g, [[tx, ty + ph * 0.5], [cx, ty + ph * 0.3]], Math.max(0.9, w * 0.035), col(deep), 0.1, 0.3, 0.3)
      const lobes = 3 + Math.round(wild * 2)
      g.fillStyle = col(ink)
      for (let k = 0; k < lobes; k++) {
        const u = k / (lobes - 1) - 0.5
        g.beginPath()
        g.ellipse(cx + u * span * 0.9 + (r() - 0.5) * span * 0.12 * wild, ty + Math.abs(u) * ph * 0.5, span * (0.3 - Math.abs(u) * 0.1), ph * (0.85 - Math.abs(u) * 0.35), 0, 0, Math.PI * 2)
        g.fill()
      }
      g.fillStyle = col(deep, 0.55)
      g.beginPath()
      g.ellipse(cx, ty + ph * 0.42, span * 0.48, ph * 0.32, 0, 0, Math.PI * 2)
      g.fill()
      // the moon low on the left: a lit rim along each pad's upper left
      g.strokeStyle = rimC
      g.lineWidth = Math.max(1.2, w * 0.034)
      g.lineCap = 'round'
      g.beginPath()
      g.ellipse(cx - span * 0.08, ty - ph * 0.02, span * 0.42, ph * 0.72, 0, Math.PI * 1.04, Math.PI * 1.58)
      g.stroke()
    }
  })
}
