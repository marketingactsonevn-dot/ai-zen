import * as THREE from 'three'
import { cssVar, prefs } from '../../core/prefs'
import { NOISE_GLSL as NOISE } from './shared'

/**
 * A procedural koi (head at +x, back at +y): parametric body, fan fins, eyes, two wireframes
 * (a raw scan-like triangle soup and a clean retopologised quad grid) and one shader that can show it as
 * grey clay, painted PBR, a single PBR layer or an ink sketch. Every part swims with the same bend.
 */

export const HEAD_X = 1.1
export const BODY_LEN = 1.72
export const PED_X = HEAD_X - BODY_LEN
export const TAIL_LEN = 0.68
export const KLEN = BODY_LEN + TAIL_LEN

type V3 = [number, number, number]
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const norm = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}

/** Deterministic random (mulberry32). */
export function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const hash3 = (x: number, y: number, z: number) => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1440662683)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
/** Smooth value noise in [0, 1]. */
export function noise3(x: number, y: number, z: number) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z)
  const fx = x - ix, fy = y - iy, fz = z - iz
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz)
  const c = (a: number, b: number, d: number) => hash3(ix + a, iy + b, iz + d)
  const x00 = lerp(c(0, 0, 0), c(1, 0, 0), ux), x10 = lerp(c(0, 1, 0), c(1, 1, 0), ux)
  const x01 = lerp(c(0, 0, 1), c(1, 0, 1), ux), x11 = lerp(c(0, 1, 1), c(1, 1, 1), ux)
  return lerp(lerp(x00, x10, uy), lerp(x01, x11, uy), uz)
}

// ── Body shape ──────────────────────────────────────────────────────────────
const UMAX = 0.6 / (0.6 + 0.85)
const FMAX = Math.pow(UMAX, 0.6) * Math.pow(1 - UMAX, 0.85)
const PED = 0.13
/** Body radius along u (0 = nose, 1 = peduncle): blunt round head, widest at a third, slim tail root. */
function radius(u: number) {
  const f = (Math.pow(u, 0.6) * Math.pow(1 - u, 0.85)) / FMAX
  return f * (1 - PED) + PED * smooth(0.5, 1, u)
}
const yc = (u: number) => 0.035 * Math.sin(Math.PI * u) - 0.01
export function surf(u: number, th: number): V3 {
  const r = radius(u)
  const c = Math.cos(th), s = Math.sin(th)
  const sc = Math.sign(c) * Math.abs(c) ** 0.85
  const ss = Math.sign(s) * Math.abs(s) ** 0.9
  return [HEAD_X - u * BODY_LEN, yc(u) + ss * r * (s > 0 ? 0.33 : 0.26), sc * r * 0.285]
}
/** Outward direction from the body's centre line (good enough as a normal for offsets). */
function outward(u: number, p: V3): V3 {
  return norm([u < 0.04 ? 1 : 0, p[1] - yc(u), p[2]])
}
/** "Raw scan" lumps: a low-frequency wobble along the outward direction. */
function lump(p: V3, dir: V3, amp = 1): V3 {
  const n = (noise3(p[0] * 2.6 + 4, p[1] * 2.6, p[2] * 2.6) - 0.5) * 0.17 + (noise3(p[0] * 6.5, p[1] * 6.5 + 9, p[2] * 6.5) - 0.5) * 0.05
  return [dir[0] * n * amp, dir[1] * n * amp, dir[2] * n * amp]
}

/** JS twin of the shader bend, for overlays that ride the body (bones). */
export function bendZ(x: number, swim: number, phase: number) {
  const s = Math.min(1.3, Math.max(0, (HEAD_X - x) / KLEN))
  return swim * 0.17 * (0.1 + s * s) * Math.sin(phase - s * 5.2)
}
/** A point on the spine (u 0…1 body, up to 1.35 into the tail). */
export function spine(u: number): V3 {
  if (u <= 1) return [HEAD_X - u * BODY_LEN, yc(u), 0]
  return [PED_X - (u - 1) * (TAIL_LEN / 0.35), yc(1), 0]
}

// ── Geometry builders ───────────────────────────────────────────────────────
interface Bag {
  pos: number[]
  uv: number[]
  au: number[]
  raw: number[]
  part: number[]
  idx: number[]
}
const bag = (): Bag => ({ pos: [], uv: [], au: [], raw: [], part: [], idx: [] })
function toGeo(b: Bag, normals = true) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2))
  g.setAttribute('aU', new THREE.Float32BufferAttribute(b.au, 1))
  g.setAttribute('aRaw', new THREE.Float32BufferAttribute(b.raw, 3))
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(b.part, 1))
  if (b.idx.length) g.setIndex(b.idx)
  if (normals) g.computeVertexNormals()
  return g
}

function bodyBag(NU: number, NV: number): Bag {
  const b = bag()
  for (let i = 0; i <= NU; i++) {
    const u = Math.pow(i / NU, 1.45)
    for (let j = 0; j <= NV; j++) {
      const th = -Math.PI / 2 + (j / NV) * Math.PI * 2 // seam along the belly
      const p = surf(u, th)
      b.pos.push(...p)
      b.uv.push(u, j / NV)
      b.au.push(u)
      b.raw.push(...lump(p, outward(u, p)))
      b.part.push(0)
    }
  }
  for (let i = 0; i < NU; i++)
    for (let j = 0; j < NV; j++) {
      const a = i * (NV + 1) + j
      const c = a + NV + 1
      b.idx.push(a, a + 1, c, c, a + 1, c + 1)
    }
  // cap the peduncle
  const cap = b.pos.length / 3
  const pc = surf(1, 0)
  b.pos.push(PED_X, yc(1), 0)
  b.uv.push(1, 0.5)
  b.au.push(1)
  b.raw.push(...lump(pc, [-1, 0, 0], 0.3))
  b.part.push(0)
  const last = NU * (NV + 1)
  for (let j = 0; j < NV; j++) b.idx.push(cap, last + j, last + j + 1)
  return b
}

function eyeBag(): Bag {
  const b = bag()
  for (const side of [1, -1]) {
    const th = side > 0 ? 0.42 : Math.PI - 0.42
    const p = surf(0.075, th)
    const o = outward(0.075, p)
    const c: V3 = [p[0] + o[0] * 0.004, p[1] + o[1] * 0.004, p[2] + o[2] * 0.004]
    const s = new THREE.SphereGeometry(0.03, 12, 8)
    const base = b.pos.length / 3
    const P = s.attributes.position
    for (let k = 0; k < P.count; k++) {
      b.pos.push(c[0] + P.getX(k), c[1] + P.getY(k) * 0.9, c[2] + P.getZ(k) * 0.7)
      b.uv.push(0, 0)
      b.au.push(0.075)
      b.raw.push(0, 0, 0)
      b.part.push(2)
    }
    const I = s.index!
    for (let k = 0; k < I.count; k++) b.idx.push(base + I.getX(k))
    s.dispose()
  }
  return b
}

/** A fin as an (r, φ) grid: r runs root → tip (uv.x), φ across the rays (uv.y). */
function fin(b: Bag, f: (r: number, q: number) => V3, nr: number, nq: number, au: (r: number) => number) {
  const base = b.pos.length / 3
  for (let i = 0; i <= nr; i++)
    for (let j = 0; j <= nq; j++) {
      const r = i / nr, q = j / nq
      const p = f(r, q)
      b.pos.push(...p)
      b.uv.push(r, q)
      b.au.push(au(r))
      const n = noise3(p[0] * 5, p[1] * 5, p[2] * 5) - 0.5
      b.raw.push(0, n * 0.05 * r, n * 0.07 * r)
      b.part.push(1)
    }
  for (let i = 0; i < nr; i++)
    for (let j = 0; j < nq; j++) {
      const a = base + i * (nq + 1) + j
      const c = a + nq + 1
      b.idx.push(a, c, a + 1, a + 1, c, c + 1)
    }
}

function finsBag(low: boolean): Bag {
  const b = bag()
  const R = low ? 6 : 10
  const Q = low ? 10 : 18
  const fan = (root: V3, dA: V3, dB: V3, len: (q: number) => number, spread: V3, droop: number) =>
    (r: number, q: number): V3 => {
      const d = norm([lerp(dA[0], dB[0], q), lerp(dA[1], dB[1], q), lerp(dA[2], dB[2], q)])
      const L = len(q) * r
      return [root[0] + spread[0] * q + d[0] * L, root[1] + spread[1] * q + d[1] * L - droop * r * r, root[2] + spread[2] * q + d[2] * L]
    }
  for (const side of [1, -1]) {
    // pectoral: big rounded fans spreading sideways (what you see first from above)
    const pr = surf(0.24, side > 0 ? -0.62 : Math.PI + 0.62)
    fin(b, fan(pr, [0.2, -0.14, side], [-1, -0.16, side * 0.35], (q) => 0.34 * (0.68 + 0.32 * Math.sin(Math.PI * q)), [-0.1, 0, 0], 0.05), R, Q, () => 0.24)
    // pelvic
    const pv = surf(0.56, side > 0 ? -1.12 : Math.PI + 1.12)
    fin(b, fan(pv, [-0.15, -1, side * 0.55], [-1, -0.45, side * 0.25], (q) => 0.17 * (0.75 + 0.25 * Math.sin(Math.PI * q)), [-0.06, 0, 0], 0.02), R - 2, Q - 6, () => 0.56)
  }
  // anal fin
  const an = surf(0.79, -Math.PI / 2)
  fin(b, fan([an[0], an[1] + 0.01, an[2]], [-0.25, -1, 0], [-1, -0.35, 0], (q) => 0.12 * (0.7 + 0.3 * Math.sin(Math.PI * q)), [-0.06, 0, 0], 0), R - 3, Q - 8, () => 0.79)
  // dorsal: a long sail along the back, rays leaning backwards
  fin(b, (r, q) => {
    const u = lerp(0.3, 0.68, q)
    const p = surf(u, Math.PI / 2)
    const hgt = 0.16 * smooth(0, 0.14, q) * (1 - 0.6 * q) * (1 - 0.6 * smooth(0.85, 1, q)) + 0.008
    const d = norm([-0.5, 1, 0])
    return [p[0] + d[0] * hgt * r, p[1] - 0.012 + d[1] * hgt * r, p[2]]
  }, R - 4, Q + 6, () => 0.48)
  // caudal: a flowing forked fan from the peduncle
  fin(b, (r, q) => {
    const ang = lerp(0.78, -0.72, q)
    const len = TAIL_LEN * (0.58 + 0.42 * Math.pow(Math.abs(2 * q - 1), 0.75))
    const flare = 1 + 0.15 * r
    return [PED_X + 0.03 - Math.cos(ang) * len * r, yc(1) + (0.5 - q) * 0.06 + Math.sin(ang) * len * r * flare, 0]
  }, R + 2, Q + 4, (r) => 1 + 0.35 * r)
  return b
}

function lineGeo(pts: number[], au: number[], raw: number[]) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  g.setAttribute('aU', new THREE.Float32BufferAttribute(au, 1))
  g.setAttribute('aRaw', new THREE.Float32BufferAttribute(raw, 3))
  return g
}

/** Clean quad flow: rings and long lines that follow the body, plus the tail's rays. */
function quadWire(low: boolean) {
  const P: number[] = [], A: number[] = [], Z: number[] = []
  const push = (p: V3, u: number) => (P.push(...p), A.push(u), Z.push(0, 0, 0))
  const off = (u: number, th: number): V3 => {
    const p = surf(u, th)
    const o = outward(u, p)
    return [p[0] + o[0] * 0.007, p[1] + o[1] * 0.007, p[2] + o[2] * 0.007]
  }
  const rings = low ? 11 : 16
  const segs = low ? 20 : 28
  for (let i = 1; i <= rings; i++) {
    const u = Math.pow(i / rings, 1.3)
    for (let j = 0; j < segs; j++) {
      push(off(u, (j / segs) * Math.PI * 2), u)
      push(off(u, ((j + 1) / segs) * Math.PI * 2), u)
    }
  }
  const longs = low ? 10 : 14
  const steps = 40
  for (let j = 0; j < longs; j++) {
    const th = (j / longs) * Math.PI * 2
    for (let i = 0; i < steps; i++) {
      const u0 = Math.pow(i / steps, 1.3), u1 = Math.pow((i + 1) / steps, 1.3)
      push(off(u0, th), u0)
      push(off(u1, th), u1)
    }
  }
  // tail: rays and two arcs
  const tail = (r: number, q: number): V3 => {
    const ang = lerp(0.78, -0.72, q)
    const len = TAIL_LEN * (0.58 + 0.42 * Math.pow(Math.abs(2 * q - 1), 0.75))
    return [PED_X + 0.03 - Math.cos(ang) * len * r, yc(1) + (0.5 - q) * 0.06 + Math.sin(ang) * len * r * (1 + 0.15 * r), 0.004]
  }
  for (let k = 0; k <= 6; k++)
    for (let i = 0; i < 8; i++) (push(tail(i / 8, k / 6), 1 + (0.35 * i) / 8), push(tail((i + 1) / 8, k / 6), 1 + (0.35 * (i + 1)) / 8))
  for (const r of [0.5, 1])
    for (let k = 0; k < 12; k++) (push(tail(r, k / 12), 1 + 0.35 * r), push(tail(r, (k + 1) / 12), 1 + 0.35 * r))
  return lineGeo(P, A, Z)
}

/** Raw generated mesh: jittered vertices, random diagonals — the tangle of triangles a model first outputs. */
function rawWire(low: boolean) {
  const r = rng(909)
  const NU = low ? 22 : 34, NV = low ? 14 : 20
  const V: { p: V3; u: number; raw: V3 }[][] = []
  for (let i = 0; i <= NU; i++) {
    const row: (typeof V)[number] = []
    for (let j = 0; j < NV; j++) {
      const ju = i === 0 || i === NU ? 0 : (r() - 0.5) * 0.7
      const jv = i === 0 ? 0 : (r() - 0.5) * 0.7
      const u = Math.min(1, Math.max(0, Math.pow((i + ju) / NU, 1.35)))
      const th = ((j + jv) / NV) * Math.PI * 2
      const p = surf(u, th)
      const o = outward(u, p)
      row.push({ p: [p[0] + o[0] * 0.008, p[1] + o[1] * 0.008, p[2] + o[2] * 0.008], u, raw: lump(surf(u, th), o) })
    }
    V.push(row)
  }
  const P: number[] = [], A: number[] = [], Z: number[] = []
  const edge = (a: (typeof V)[number][number], b: (typeof V)[number][number]) => {
    P.push(...a.p, ...b.p)
    A.push(a.u, b.u)
    Z.push(...a.raw, ...b.raw)
  }
  for (let i = 0; i <= NU; i++)
    for (let j = 0; j < NV; j++) {
      const a = V[i][j], b = V[i][(j + 1) % NV]
      if (i > 0) edge(a, b)
      if (i < NU) {
        const c = V[i + 1][j], d = V[i + 1][(j + 1) % NV]
        edge(a, c)
        if (r() < 0.5) edge(a, d)
        else edge(b, c)
      }
    }
  return lineGeo(P, A, Z)
}

export interface KoiGeometry {
  body: THREE.BufferGeometry
  fins: THREE.BufferGeometry
  wireQuad: THREE.BufferGeometry
  wireRaw: THREE.BufferGeometry
}

export function koiGeometry(low: boolean): KoiGeometry {
  const body = bodyBag(low ? 44 : 76, low ? 24 : 40)
  // smooth the seam: duplicated first/last columns share one normal
  const bodyGeo = toGeo(body)
  const NV = low ? 24 : 40
  const nrm = bodyGeo.attributes.normal as THREE.BufferAttribute
  const rows = (low ? 44 : 76) + 1
  for (let i = 0; i < rows; i++) {
    const a = i * (NV + 1), z = a + NV
    const n = new THREE.Vector3(nrm.getX(a) + nrm.getX(z), nrm.getY(a) + nrm.getY(z), nrm.getZ(a) + nrm.getZ(z)).normalize()
    nrm.setXYZ(a, n.x, n.y, n.z)
    nrm.setXYZ(z, n.x, n.y, n.z)
  }
  // eyes go in the same draw
  const eyes = toGeo(eyeBag())
  const merged = mergeTwo(bodyGeo, eyes)
  return { body: merged, fins: toGeo(finsBag(low)), wireQuad: quadWire(low), wireRaw: rawWire(low) }
}

function mergeTwo(a: THREE.BufferGeometry, b: THREE.BufferGeometry) {
  const g = new THREE.BufferGeometry()
  for (const name of Object.keys(a.attributes)) {
    const A = a.attributes[name] as THREE.BufferAttribute
    const B = b.attributes[name] as THREE.BufferAttribute
    const arr = new Float32Array(A.array.length + B.array.length)
    arr.set(A.array as Float32Array)
    arr.set(B.array as Float32Array, A.array.length)
    g.setAttribute(name, new THREE.BufferAttribute(arr, A.itemSize))
  }
  const ia = a.index!.array, ib = b.index!.array
  const n = a.attributes.position.count
  const idx = new Uint32Array(ia.length + ib.length)
  idx.set(ia)
  for (let k = 0; k < ib.length; k++) idx[ia.length + k] = ib[k] + n
  g.setIndex(new THREE.BufferAttribute(idx, 1))
  a.dispose()
  b.dispose()
  return g
}

// ── Shaders ─────────────────────────────────────────────────────────────────
/** Shared bend: a travelling wave that grows toward the tail. */
export const BEND = /* glsl */ `
uniform float uSwim;
uniform float uPhase;
float koiS(float x) { return clamp((${HEAD_X.toFixed(3)} - x) / ${KLEN.toFixed(3)}, 0.0, 1.3); }
vec3 koiBend(vec3 p) {
  float s = koiS(p.x);
  p.z += uSwim * 0.17 * (0.1 + s * s) * sin(uPhase - s * 5.2);
  return p;
}
float koiSlope(float x) {
  float s = koiS(x);
  float d = uSwim * 0.17 * (2.0 * s * sin(uPhase - s * 5.2) - 5.2 * (0.1 + s * s) * cos(uPhase - s * 5.2));
  return -d / ${KLEN.toFixed(3)};
}`

/** Where the leaf in a bad photo hid the fish: the flank facing the camera, mid-body (object space). */
const LEAF = /* glsl */ `
float leafMask(vec3 o) {
  vec2 q = (o.xy - vec2(0.22, 0.0)) * mat2(0.94, 0.34, -0.34, 0.94);
  float l = length(q * vec2(1.0, 1.9));
  return (1.0 - smoothstep(0.15, 0.2, l)) * smoothstep(0.0, 0.06, o.z);
}`

const KOI_VERT = /* glsl */ `
${BEND}
${LEAF}
uniform float uNoise;
uniform float uDent;
attribute vec3 aRaw;
attribute float aU;
attribute float aPart;
varying vec3 vN;
varying vec3 vW;
varying vec3 vO;
varying vec2 vUv;
varying float vU;
varying float vPart;
void main() {
  vO = position;
  vUv = uv;
  vU = aU;
  vPart = aPart;
  vec3 p = koiBend(position + aRaw * uNoise - normal * uDent * leafMask(position) * 0.07);
  float k = koiSlope(position.x);
  vec3 n = normalize(vec3(normal.x - k * normal.z, normal.y, normal.z));
  vec4 w = modelMatrix * vec4(p, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * n);
  gl_Position = projectionMatrix * viewMatrix * w;
}`

const KOI_FRAG = /* glsl */ `
uniform vec3 uWhite;
uniform vec3 uRed;
uniform vec3 uInk;
uniform vec3 uShade;
uniform vec3 uClay;
uniform vec3 uRim;
uniform vec3 uSpecC;
uniform vec3 uLight;
uniform float uRimA;
uniform float uFacet;
uniform float uPaint;
uniform float uForm;
uniform vec4 uMapW;
uniform float uSketch;
uniform float uAlpha;
uniform float uGlare;
uniform float uCut;
uniform float uSolid;
uniform vec3 uLeafC;
varying vec3 vN;
varying vec3 vW;
varying vec3 vO;
varying vec2 vUv;
varying float vU;
varying float vPart;
${NOISE}
${LEAF}
// Koi scales: staggered columns of discs, each one's free (tail-side) edge lying over the next column, so the
// eye reads overlapping crescents. Smaller toward head and tail. x = relief (rises toward the free edge), y = edge line.
vec2 koiScales(vec2 uv) {
  float u = uv.x;
  float gx = (u + 0.055 * sin(6.2832 * u)) * 25.0;
  float gy = uv.y * 30.0;
  float c = floor(gx);
  const float R = 1.18;
  // the column in front (toward the head) lies on top
  float c0 = c - 1.0;
  float o0 = 0.5 * mod(c0, 2.0);
  float d0 = length(vec2(gx - c0, fract(gy - o0 + 0.5) - 0.5));
  float o1 = 0.5 * mod(c, 2.0);
  float d1 = length(vec2(gx - c, fract(gy - o1 + 0.5) - 0.5));
  float d = d0 < R ? d0 : d1;
  float h = smoothstep(0.0, R, d) * (1.0 - smoothstep(R - 0.09, R, d));
  float edge = smoothstep(R - 0.16, R - 0.02, d) * (1.0 - smoothstep(R - 0.02, R, d));
  float k = smoothstep(0.1, 0.2, u) * smoothstep(1.0, 0.92, u);
  return vec2(h, edge) * k;
}
void main() {
  bool fin = vPart > 0.5 && vPart < 1.5;
  bool eye = vPart > 1.5;
  if (vO.x < uCut) discard;
  // dissolve in (mesh being formed), with an ink edge
  float fn = n3(vO * 5.0 + 2.0);
  float thr = uForm * 1.2 - 0.1;
  if (fn > thr) discard;
  float formEdge = smoothstep(thr - 0.07, thr, fn) * step(uForm, 0.999);

  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  vec3 fnrm = normalize(cross(dFdx(vW), dFdy(vW)));
  n = normalize(mix(n, fnrm, uFacet));

  // paint sweeps from head to tail with a ragged, wet edge
  float E = uPaint * 1.65 - 0.25;
  float en = n3(vO * 7.0) - 0.5;
  float pm = 1.0 - smoothstep(E - 0.06, E + 0.02, vU + en * 0.14);
  float wet = smoothstep(E - 0.14, E - 0.03, vU + en * 0.14) * pm;

  // kohaku pattern: vermilion islands on the back, a cap on the head, white flanks and belly
  float top = smoothstep(0.0, 0.11, vO.y);
  float pn = n3(vO * vec3(2.2, 3.0, 3.0) + vec3(3.1, 0.0, 0.0)) * 0.75 + n3(vO * 6.0 + 11.0) * 0.25;
  float red = smoothstep(0.5, 0.535, pn) * top;
  float cap = smoothstep(0.16, 0.11, length((vO.xz - vec2(0.82, 0.0)) * vec2(1.0, 1.3))) * smoothstep(0.02, 0.09, vO.y);
  red = max(red, cap) * smoothstep(1.06, 0.99, vO.x) * smoothstep(${(PED_X + 0.04).toFixed(3)}, ${(PED_X + 0.16).toFixed(3)}, vO.x);
  float rays = 0.0;
  if (fin) {
    red = 0.0;
    rays = 1.0 - smoothstep(0.0, 0.32, abs(fract(vUv.y * 13.0) - 0.5) * 2.0);
    rays *= smoothstep(0.05, 0.25, vUv.x);
  }
  vec2 sc = fin || eye ? vec2(0.0) : koiScales(vUv);
  float scl = sc.x;
  // a bad photo bakes its flaws into the texture: a blown-out glare streak that wipes the pattern, the leaf that hid the flank
  vec2 gq = (vO.xy - vec2(0.62, 0.11)) * mat2(0.8, -0.6, 0.6, 0.8);
  float gl = uGlare * (1.0 - smoothstep(0.2, 0.3, length(gq * vec2(1.0, 4.2)))) * smoothstep(0.0, 0.05, vO.z + 0.06);
  float lf = fin || eye ? 0.0 : uGlare * leafMask(vO);
  red *= 1.0 - gl;

  vec3 painted = eye ? uInk : fin ? mix(uWhite, uShade, rays * 0.35 + vUv.x * 0.08) : mix(uWhite, uRed, red);
  // the scale edges: a faint sheen in colour, never a grid
  painted *= 1.0 - sc.y * mix(0.025, 0.05, red);
  float rough = eye ? 0.15 : fin ? 0.62 : mix(0.34, 0.28, red) + (0.5 - scl) * 0.06;
  vec3 albedo = mix(uClay, painted, pm);
  albedo = mix(albedo, albedo * 0.82, wet * 0.6);
  rough = mix(0.92, rough, pm);
  // "solid" viewport look while the topology is being worked on
  albedo = mix(albedo, mix(uClay, uWhite, 0.55), uSolid);
  rough = mix(rough, 0.8, uSolid);
  float lfVein = lf * (1.0 - smoothstep(0.0, 0.012, abs((vO.y - 0.0) - (vO.x - 0.22) * 0.36)));
  albedo = mix(albedo, uLeafC, lf * 0.88);
  albedo = mix(albedo, uLeafC * 0.7, lfVein * 0.6);
  albedo = mix(albedo, uWhite * 1.18 + 0.06, gl);
  rough = mix(rough, 0.08, gl);

  // relief from the scales
  vec3 dpx = dFdx(vW), dpy = dFdy(vW);
  vec3 r1 = cross(dpy, n), r2 = cross(n, dpx);
  float det = dot(dpx, r1);
  float hb = scl * pm * (1.0 - uSolid) * (1.0 - lf) * 0.0021; // world-space relief height
  vec3 grad = sign(det) * (dFdx(hb) * r1 + dFdy(hb) * r2);
  vec3 nb = normalize(abs(det) * n - grad);
  vec3 nb2 = normalize(abs(det) * n - grad * 6.5);

  vec3 L = normalize(uLight);
  vec3 V = normalize(cameraPosition - vW);
  float diff = smoothstep(-0.5, 1.0, dot(nb, L));
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(nb, H), 0.0), mix(110.0, 7.0, rough)) * (1.0 - rough) * 1.25;
  float fres = pow(1.0 - max(dot(n, V), 0.0), 2.5);

  vec3 lit = albedo * mix(uShade, vec3(1.0), diff) + uSpecC * spec;
  lit = mix(lit, uRim, fres * uRimA);
  vec3 colOnly = albedo * (0.86 + 0.14 * diff);
  vec3 roughV = mix(vec3(0.06), vec3(0.88), rough) * (0.8 + 0.2 * diff);
  vec3 bumpV = mix(vec3(0.3), vec3(0.92), smoothstep(-0.4, 1.0, dot(nb2, L)));
  vec3 col = lit * uMapW.x + colOnly * uMapW.y + roughV * uMapW.z + bumpV * uMapW.w;
  col = mix(col, uInk, formEdge * 0.85);

  float a = uAlpha;
  if (fin) a *= mix(0.94, (0.5 + rays * 0.3) * (1.0 - 0.35 * smoothstep(0.75, 1.0, vUv.x)), pm * uMapW.x) ;

  if (uSketch > 0.5) {
    float fs = pow(1.0 - max(dot(normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0), V), 0.0), 1.6);
    float ds = smoothstep(-0.2, 1.0, dot(normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0), L));
    float line = fin ? 0.1 + rays * 0.3 + fs * 0.25 : smoothstep(0.45, 0.95, fs) * 0.95;
    float shade = fin ? 0.0 : (1.0 - ds) * 0.3;
    if (eye) line = 1.0;
    gl_FragColor = vec4(clamp(line, 0.0, 1.0), red, shade, fin ? 0.55 : 1.0);
    return;
  }
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}`

const WIRE_VERT = /* glsl */ `
${BEND}
uniform float uNoise;
attribute vec3 aRaw;
attribute float aU;
varying float vU;
void main() {
  vU = aU;
  vec3 p = koiBend(position + aRaw * uNoise);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`
const WIRE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uReveal;
varying float vU;
void main() {
  float r = 1.0 - smoothstep(uReveal * 1.5 - 0.15, uReveal * 1.5, vU);
  if (r < 0.01) discard;
  gl_FragColor = vec4(uColor, uOpacity * r);
  #include <colorspace_fragment>
}`

export interface KoiUniforms {
  [k: string]: THREE.IUniform
}

/** The whole fish: body (+eyes), fins, two wireframes; all share one uniform set. */
export class Koi {
  readonly group = new THREE.Group()
  readonly body: THREE.Mesh
  readonly fins: THREE.Mesh
  readonly wireRaw: THREE.LineSegments
  readonly wireQuad: THREE.LineSegments
  readonly U: KoiUniforms
  private bodyMat: THREE.ShaderMaterial
  private finMat: THREE.ShaderMaterial
  private rawMat: THREE.ShaderMaterial
  private quadMat: THREE.ShaderMaterial

  constructor(low: boolean) {
    const G = koiGeometry(low)
    this.U = {
      uSwim: { value: 0 },
      uPhase: { value: 0 },
      uNoise: { value: 0 },
      uWhite: { value: new THREE.Color() },
      uRed: { value: new THREE.Color() },
      uInk: { value: new THREE.Color() },
      uShade: { value: new THREE.Color() },
      uClay: { value: new THREE.Color() },
      uRim: { value: new THREE.Color() },
      uSpecC: { value: new THREE.Color() },
      uLight: { value: new THREE.Vector3(-0.5, 1, 0.65) },
      uRimA: { value: 0 },
      uFacet: { value: 0 },
      uPaint: { value: 1 },
      uForm: { value: 1 },
      uMapW: { value: new THREE.Vector4(1, 0, 0, 0) },
      uSketch: { value: 0 },
      uAlpha: { value: 1 },
      uGlare: { value: 0 },
      uCut: { value: -9 },
      uSolid: { value: 0 },
      uDent: { value: 0 },
      uLeafC: { value: new THREE.Color() },
    }
    const mk = (transparent: boolean) => new THREE.ShaderMaterial({
      vertexShader: KOI_VERT, fragmentShader: KOI_FRAG, uniforms: this.U, transparent,
      side: THREE.DoubleSide, depthWrite: !transparent,
    })
    this.bodyMat = mk(false)
    this.bodyMat.side = THREE.FrontSide
    this.finMat = mk(true)
    const wire = (color: string) => new THREE.ShaderMaterial({
      vertexShader: WIRE_VERT, fragmentShader: WIRE_FRAG, transparent: true, depthWrite: false,
      uniforms: { uSwim: this.U.uSwim, uPhase: this.U.uPhase, uNoise: this.U.uNoise, uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 }, uReveal: { value: 1 } },
    })
    this.rawMat = wire('#000')
    this.quadMat = wire('#000')
    this.body = new THREE.Mesh(G.body, this.bodyMat)
    this.fins = new THREE.Mesh(G.fins, this.finMat)
    this.wireRaw = new THREE.LineSegments(G.wireRaw, this.rawMat)
    this.wireQuad = new THREE.LineSegments(G.wireQuad, this.quadMat)
    this.body.renderOrder = 2
    this.fins.renderOrder = 3
    this.wireRaw.renderOrder = 4
    this.wireQuad.renderOrder = 4
    this.group.add(this.body, this.fins, this.wireRaw, this.wireQuad)
    this.group.traverse((o) => void (o.frustumCulled = false))
  }

  set rawOpacity(v: number) {
    this.rawMat.uniforms.uOpacity.value = v
    this.wireRaw.visible = v > 0.003
  }
  set quadOpacity(v: number) {
    this.quadMat.uniforms.uOpacity.value = v
  }
  set quadReveal(v: number) {
    this.quadMat.uniforms.uReveal.value = v
    this.wireQuad.visible = v > 0.003 && this.quadMat.uniforms.uOpacity.value > 0.003
  }

  /** Re-read the palette (rice paper by day, night garden by night). */
  theme() {
    const dark = prefs.theme === 'dark'
    const c = (n: string) => new THREE.Color(cssVar(n))
    const U = this.U
    U.uWhite.value = dark ? c('--ink') : c('--card')
    U.uRed.value = c('--vermilion')
    U.uInk.value = dark ? c('--paper') : c('--ink')
    U.uShade.value = dark ? c('--stone').multiplyScalar(0.9) : c('--stone')
    U.uClay.value = dark ? c('--stone') : c('--stone-2')
    U.uRim.value = dark ? c('--moss') : c('--card')
    U.uSpecC.value = dark ? c('--ink').multiplyScalar(0.8) : new THREE.Color(1, 0.98, 0.94)
    U.uRimA.value = dark ? 0.55 : 0.3
    U.uLeafC.value = c('--moss-2')
    this.rawMat.uniforms.uColor.value = dark ? c('--ink-2') : c('--ink-2')
    this.quadMat.uniforms.uColor.value = dark ? c('--moss') : c('--moss')
  }
}
