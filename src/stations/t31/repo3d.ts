import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import raw from '../../content/tram-31.json'
import { fill, h } from '../../core/dom'
import type { Fact } from '../../core/content'
import { onPrefs } from '../../core/prefs'
import { inkGlsl, inkStage, type InkKit, type V3 } from '../../ui/part2/stage3d'
import type { SceneCtx } from '../types'
import { cardSheet, live, rng } from './kit'
import { repoFlat } from './repo'
import './repo3d.css'

/**
 * ★ Scene 4 (hero, WebGL) — two wooden houses on a raked gravel island in black water, identical from the front. The
 * real repo is a whole house: lamplight spills through its shōji onto the gravel, it throws a deep block of shadow, a
 * stepping-stone path runs from it across the water to 640 fork houses on the far hills. The copy is a painted front
 * 3 cm thick, propped on two bamboo poles: walk round it and it is hollow. Tap a thing on either house to read that
 * signal on both; light a gate lamp to choose (the wrong one blows over backward onto the gravel).
 */

const K = raw.scenes.repo
type G = THREE.BufferGeometry
type C3 = [number, number, number]
type Sig = 'readme' | 'stars' | 'forks' | 'issues' | 'releases' | 'license'

// house frame (house-local, front = +z): half width / depth, floor and wall-top heights
const HW = 1.3, HD = 1.0, FL = 0.3, Y1 = 1.34
// the houses stand at x = ∓hx (closer on a tall screen), turned a little toward the visitor so both read square-on
const RY = 0.12
const PC: [number, number] = [0, -0.4] // the pond's centre
// paper vertex colour: [glow, pattern (1 lattice · 0.3 writing), dye (0 paper · 0.4 indigo · 0.65 wood · 1 red)]
const SHOJI: C3 = [1, 1, 0], PAPER: C3 = [0, 0, 0], WRIT: C3 = [0, 0.3, 0], INDIGO: C3 = [0, 0, 0.4], WOOD: C3 = [0, 0, 0.65], RED: C3 = [0, 0, 1], LIT: C3 = [1, 0, 0]

// ───────────────────────────── geometry helpers ─────────────────────────────
const B = (w: number, hh: number, d: number, x: number, y: number, z: number, ry = 0, rz = 0, rx = 0): G => {
  const g = new THREE.BoxGeometry(w, hh, d)
  g.deleteAttribute('uv')
  if (rx) g.rotateX(rx)
  if (rz) g.rotateZ(rz)
  if (ry) g.rotateY(ry)
  return g.translate(x, y, z)
}
const tint = (g: G, c: C3): G => {
  const n = g.attributes.position.count, a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) a.set(c, i * 3)
  g.setAttribute('color', new THREE.BufferAttribute(a, 3))
  return g
}
/** a paper plane (w × hh) facing +z turned by ry, at x, y, z */
const PP = (w: number, hh: number, x: number, y: number, z: number, ry: number, c: C3) => tint(new THREE.PlaneGeometry(w, hh).rotateY(ry).translate(x, y, z), c)
/** a paper (or painted) box, keeps uv for the fibre */
const PB = (w: number, hh: number, d: number, x: number, y: number, z: number, c: C3, rz = 0, rx = 0) => {
  const g = new THREE.BoxGeometry(w, hh, d)
  if (rx) g.rotateX(rx)
  if (rz) g.rotateZ(rz)
  return tint(g.translate(x, y, z), c)
}
/** an ellipsoid of paper or cloth */
const PE = (rx: number, ry: number, rz: number, x: number, y: number, z: number, c: C3, low: boolean) => tint(new THREE.SphereGeometry(1, low ? 8 : 12, low ? 6 : 9).scale(rx, ry, rz).translate(x, y, z), c)
const merge = (gs: G[]): G => {
  const g = mergeGeometries(gs)!
  gs.forEach((x) => x.dispose())
  return g
}
/** a round pole from a to b */
const rod = (a: V3, b: V3, r: number, seg = 7): G => {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2])
  const g = new THREE.CylinderGeometry(r, r * 1.12, d.length(), seg, 1)
  g.deleteAttribute('uv')
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()))
  return g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)
}
/** a curled horn (the upturned eave tip): from p outward along (dx, dz), rising at the end */
const horn = (p: V3, dx: number, dz: number, len: number, rise: number, r: number): G => {
  const a = new THREE.Vector3(...p)
  const c = new THREE.QuadraticBezierCurve3(a, a.clone().add(new THREE.Vector3(dx * len * 0.8, rise * 0.15, dz * len * 0.8)), a.clone().add(new THREE.Vector3(dx * len, rise, dz * len)))
  const g = new THREE.TubeGeometry(c, 8, r, 6, false)
  g.deleteAttribute('uv')
  return g
}
// value noise (build time only)
const hsh = (x: number, y: number) => {
  const q = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return q - Math.floor(q)
}
const vn = (x: number, y: number) => {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy)
  return (hsh(ix, iy) * (1 - u) + hsh(ix + 1, iy) * u) * (1 - v) + (hsh(ix, iy + 1) * (1 - u) + hsh(ix + 1, iy + 1) * u) * v
}
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))
/** a lumpy flat stone w × hh × d standing on y = 0 at (x, z) */
function lump(seed: number, w: number, hh: number, d: number, x: number, z: number, ry: number, low: boolean): G {
  const g = new THREE.SphereGeometry(1, low ? 7 : 9, low ? 5 : 6)
  g.deleteAttribute('uv')
  const p = g.attributes.position as THREE.BufferAttribute
  const o = seed * 7.31
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i), py = p.getY(i), pz = p.getZ(i)
    const k = 1 + 0.34 * (vn(px * 1.6 + o, pz * 1.6 + py * 1.3) - 0.5)
    p.setXYZ(i, (px * k * w) / 2, ((Math.max(py * k, -0.25) + 0.25) / 1.25) * hh, (pz * k * d) / 2)
  }
  g.computeVertexNormals()
  return g.rotateY(ry).translate(x, 0, z)
}
/** rings of points lofted into one surface (each ring the same count, closed round) */
function loft(rings: V3[][]): G {
  const n = rings[0].length
  const pos = new Float32Array(rings.length * n * 3)
  rings.forEach((r, j) => r.forEach((p, i) => pos.set(p, (j * n + i) * 3)))
  const idx: number[] = []
  for (let j = 0; j < rings.length - 1; j++)
    for (let i = 0; i < n; i++) {
      const a = j * n + i, a1 = j * n + ((i + 1) % n), b = a + n, b1 = a1 + n
      idx.push(a, a1, b, a1, b1, b)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}
/**
 * A hipped roof that sags like a temple roof and curls up at the corners: eave rectangle (hw, hd) at y, rising by
 * `rise` to an inner rectangle (ihw, ihd; ihd = 0 is a ridge), a fascia `th` thick and a soffit back to the wall line
 * (sw, sd). Tile rows are a ripple across the slope.
 */
function roof(o: { hw: number; hd: number; y: number; rise: number; ihw: number; ihd: number; curl: number; th: number; sw: number; sd: number; k: number; tiles: boolean }): G {
  const per: [number, number, number][] = []
  for (let s = 0; s < 4; s++)
    for (let i = 0; i < o.k; i++) {
      const u = i / o.k
      const p = s === 0 ? [2 * u - 1, 1] : s === 1 ? [1, 1 - 2 * u] : s === 2 ? [1 - 2 * u, -1] : [-1, -1 + 2 * u]
      per.push([p[0], p[1], [0, 1, 0, -1][i % 4]])
    }
  const ring = (t: number, dy: number): V3[] =>
    per.map(([ux, uz, rip]) => {
      const c = Math.min(Math.abs(ux), Math.abs(uz)) ** 4 * (1 - t) ** 2
      const x = ux * (o.hw * (1 - t) + o.ihw * t) * (1 + 0.07 * c)
      const z = uz * (o.hd * (1 - t) + o.ihd * t) * (1 + 0.07 * c)
      return [x, o.y + o.rise * t ** 1.55 + o.curl * c + (o.tiles ? rip * 0.014 * Math.sqrt(1 - t) : 0) + dy, z]
    })
  const soffit: V3[] = per.map(([ux, uz]) => [ux * o.sw, o.y - o.th + 0.05, uz * o.sd])
  return loft([soffit, ring(0, -o.th), ...[0, 0.12, 0.26, 0.42, 0.6, 0.8, 1].map((t) => ring(t, 0))])
}
/** keep only the triangles in front of z (the painted front's share of a roof) */
function cut(g: G, zc: number): G {
  const idx = g.index!.array, p = g.attributes.position
  const keep: number[] = []
  for (let i = 0; i < idx.length; i += 3) if (p.getZ(idx[i]) + p.getZ(idx[i + 1]) + p.getZ(idx[i + 2]) > zc * 3) keep.push(idx[i], idx[i + 1], idx[i + 2])
  g.setIndex(keep)
  return g
}

interface Parts { wood: G[]; wall: G[]; roof: G[]; paper: G[]; props: G[] }
/**
 * One house in house-local coordinates. fake: only what shows from the front (front wall boards, porch, the front of
 * both roofs, short side returns), with battens on the raw back, two bamboo props to the ground and a cobweb.
 */
function house(fake: boolean, low: boolean): Parts {
  const P: Parts = { wood: [], wall: [], roof: [], paper: [], props: [] }
  const K2 = low ? 20 : 32
  const wh = Y1 - FL
  // front wall: four posts, head beam, sill, two window bays and the double shōji door
  for (const x of [-HW, -0.42, 0.42, HW]) P.wood.push(B(0.11, wh + 0.12, 0.11, x, FL + wh / 2, HD))
  P.wood.push(B(HW * 2 + 0.16, 0.1, 0.13, 0, Y1, HD), B(HW * 2, 0.07, 0.12, 0, FL + 0.035, HD))
  for (const s of [-1, 1]) {
    const cx = s * 0.86
    P.wall.push(B(0.77, 0.78 - FL, 0.05, cx, (FL + 0.78) / 2, HD - 0.02), B(0.77, Y1 - 0.83, 0.03, cx, (0.83 + Y1) / 2, HD - 0.03))
    P.wood.push(B(0.79, 0.05, 0.1, cx, 0.8, HD))
    P.paper.push(PP(0.77, Y1 - 0.88, cx, (0.83 + Y1 - 0.05) / 2, HD - 0.01, 0, SHOJI))
  }
  P.wall.push(B(0.73, wh, 0.03, 0, FL + wh / 2, HD - 0.04), B(HW * 2, 0.1, 0.05, 0, Y1 + 0.1, HD - 0.02))
  P.paper.push(PP(0.37, wh - 0.12, -0.18, FL + wh / 2, HD + 0.004, 0, SHOJI), PP(0.37, wh - 0.12, 0.18, FL + wh / 2, HD - 0.012, 0, SHOJI))
  // porch: five planks on low posts; a step stone at the door; footing stones
  for (let i = 0; i < 5; i++) P.wall.push(B(HW * 2 + 0.26, 0.045, 0.088, 0, FL - 0.02, HD + 0.1 + i * 0.096))
  for (const x of [-HW - 0.02, 0, HW + 0.02]) P.wood.push(B(0.07, FL - 0.05, 0.07, x, (FL - 0.05) / 2, HD + 0.5))
  P.roof.push(B(0.52, 0.12, 0.3, 0, 0.06, HD + 0.78))
  // the lower skirt roof (the front part only, on the copy) and the upper roof (its front half)
  const skirt = roof({ hw: HW + 0.46, hd: HD + 0.46, y: 1.42, rise: 0.3, ihw: HW * 0.66, ihd: HD * 0.62, curl: 0.12, th: 0.07, sw: HW, sd: HD, k: K2, tiles: true })
  const top = roof({ hw: HW * 0.66 + 0.42, hd: HD * 0.62 + 0.42, y: 1.86, rise: 0.6, ihw: 0.46, ihd: 0, curl: 0.17, th: 0.07, sw: HW * 0.66, sd: HD * 0.62, k: K2, tiles: true })
  P.roof.push(fake ? cut(skirt, HD - 0.42) : skirt, fake ? cut(top, -0.06) : top)
  // ridge beam with curled ends, horns at the upper eave corners
  P.roof.push(B(1.02, 0.1, 0.13, 0, 2.48, 0))
  for (const s of [-1, 1]) P.roof.push(horn([s * 0.5, 2.49, 0], s, 0, 0.18, 0.15, 0.045))
  const ex = (HW * 0.66 + 0.42) * 1.07, ez = (HD * 0.62 + 0.42) * 1.07
  for (const sx of [-1, 1]) for (const sz of fake ? [1] : [-1, 1]) P.roof.push(horn([sx * ex, 1.86 + 0.17, sz * ez], sx * 0.7, sz * 0.7, 0.14, 0.15, 0.03))
  // the name board hung over the door, and (real one only) the licence plaque on the wall: their carved faces are the License signal
  P.wood.push(B(0.66, 0.19, 0.03, 0, 1.2, HD + 0.075))
  if (!fake) P.wood.push(B(0.18, 0.22, 0.02, 0.62, 0.6, HD + 0.01))
  if (!fake) {
    // the rest of a real house: side and back walls with posts and beams, a window each side, upper wall band, floor
    for (const s of [-1, 1]) {
      P.wood.push(B(0.11, wh + 0.12, 0.11, s * HW, FL + wh / 2, -HD), B(0.11, wh + 0.12, 0.11, s * HW, FL + wh / 2, 0), B(0.13, 0.1, HD * 2 + 0.14, s * HW, Y1, 0))
      P.wall.push(B(0.05, wh, HD * 2 - 0.1, s * (HW - 0.02), FL + wh / 2, 0))
      P.paper.push(PP(0.62, 0.4, s * (HW + 0.006), 1.02, -0.48, s * Math.PI / 2, SHOJI))
    }
    P.wood.push(B(0.11, wh + 0.12, 0.11, 0, FL + wh / 2, -HD), B(HW * 2 + 0.16, 0.1, 0.13, 0, Y1, -HD))
    P.wall.push(B(HW * 2 - 0.1, wh, 0.05, 0, FL + wh / 2, -HD + 0.02), B(HW * 2, 0.1, HD * 2, 0, Y1 + 0.1, 0))
    P.paper.push(PP(0.72, 0.42, 0.62, 1.02, -HD - 0.006, Math.PI, SHOJI))
    P.wood.push(B(HW * 1.32, 0.3, HD * 1.24, 0, 1.74, 0), B(HW * 2 + 0.08, 0.07, HD * 2 + 0.08, 0, FL - 0.035, 0), B(HW * 2 - 0.12, FL - 0.07, HD * 2 - 0.12, 0, (FL - 0.07) / 2, 0))
    for (const x of [-HW + 0.05, 0, HW - 0.05]) for (const z of [-HD + 0.05, HD - 0.05]) P.roof.push(B(0.2, 0.1, 0.2, x, 0.05, z))
  } else {
    // the copy: a front board for the upper band, short returns at the sides, the floor's front edge, then the raw back
    P.wood.push(B(HW * 1.32, 0.3, 0.03, 0, 1.74, HD * 0.62), B(HW * 2 + 0.08, 0.07, 0.3, 0, FL - 0.035, HD - 0.12), B(HW * 2 - 0.12, FL - 0.07, 0.03, 0, (FL - 0.07) / 2, HD - 0.06))
    for (const s of [-1, 1]) {
      P.wall.push(B(0.03, wh, 0.36, s * (HW - 0.02), FL + wh / 2, HD - 0.2))
      P.wood.push(B(0.13, 0.1, 0.4, s * HW, Y1, HD - 0.2))
      // a bamboo prop from the back of the board down to the gravel behind (its own piece: it falls on its own)
      P.props.push(rod([s * 0.95, 1.22, HD - 0.07], [s * 1.18, 0, HD - 1.5], 0.04))
    }
    P.wood.push(B(HW * 2 - 0.1, 0.07, 0.035, 0, 0.62, HD - 0.075), B(HW * 2 - 0.1, 0.07, 0.035, 0, 1.12, HD - 0.075))
    for (const x of [-HW + 0.05, 0, HW - 0.05]) P.roof.push(B(0.2, 0.1, 0.2, x, 0.05, HD - 0.05))
    // a cobweb strung between the left prop and the board
    const c: V3 = [-0.7, 1.08, HD - 0.1]
    for (let i = 0; i < 5; i++) {
      const a = (i / 4) * Math.PI * 0.5 + 0.2
      P.paper.push(PB(0.004, 0.36, 0.004, c[0] - Math.cos(a) * 0.17, c[1] - Math.sin(a) * 0.17, c[2] - 0.02, PAPER, a - Math.PI / 2 + Math.PI / 2))
    }
  }
  return P
}

// ───────────────────────────── shaders ─────────────────────────────
const VERT = /* glsl */ `
varying vec3 vW;
varying vec3 vN;
varying vec2 vUv;
varying vec3 vC;
void main() {
  vUv = uv;
  #ifdef USE_COLOR
  vC = color;
  #else
  vC = vec3(0.0);
  #endif
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`
/** paper, shōji and cloth: fibre, a lattice or lines of writing, warm light from within (colour.r × uGlow) */
const PAPER_FRAG = /* glsl */ `
${inkGlsl.noise}
${inkGlsl.haze}
uniform vec3 uPaper, uDye, uWood, uRed, uKey, uLampC, uInk;
uniform float uGlow, uHot, uDark;
varying vec3 vW;
varying vec3 vN;
varying vec2 vUv;
varying vec3 vC;
void main() {
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  float d = vC.b;
  vec3 base = d < 0.25 ? uPaper : d < 0.5 ? uDye : d < 0.8 ? uWood : uRed;
  vec3 col = base * (0.66 + 0.34 * smoothstep(-0.3, 0.7, dot(n, uKey)));
  col *= 0.93 + 0.1 * n2(vUv * vec2(70.0, 9.0) + vW.xz * 3.0);
  if (vC.g > 0.6) {
    // shōji lattice
    vec2 q = fract(vUv * vec2(3.0, 4.0));
    vec2 e = min(q, 1.0 - q);
    col = mix(col, uInk, (1.0 - smoothstep(0.035, 0.075, min(e.x, e.y))) * 0.72);
  } else if (vC.g > 0.15) {
    // lines of writing
    float row = fract(vUv.y * 11.0);
    float dash = step(0.42, n2(vec2(vUv.x * 9.0, floor(vUv.y * 11.0) * 3.7)));
    float in_ = step(0.12, vUv.x) * step(vUv.x, 0.88) * step(0.1, vUv.y) * step(vUv.y, 0.9);
    col = mix(col, uInk, smoothstep(0.35, 0.45, row) * (1.0 - smoothstep(0.55, 0.65, row)) * dash * in_ * 0.55);
  }
  float g = vC.r * uGlow * (gl_FrontFacing ? 1.0 : 0.55);
  vec3 warm = mix(uPaper, uLampC, 0.62 + 0.3 * uDark) * (0.92 + 0.3 * (1.0 - 2.0 * length(vUv - 0.5)));
  col = mix(col, warm, clamp(g, 0.0, 1.0)) + uLampC * max(g - 1.0, 0.0) * 0.6;
  col = mix(col, uLampC, uHot * 0.3);
  gl_FragColor = vec4(haze(col, vW), 1.0);
  #include <colorspace_fragment>
}`
/** carved name boards: wood grain, the letters (texture alpha) cut in pale */
const BOARD_FRAG = /* glsl */ `
${inkGlsl.noise}
${inkGlsl.haze}
uniform sampler2D uMap;
uniform vec3 uWood, uWoodHi, uCarve, uKey, uLampC;
uniform float uHot;
varying vec3 vW;
varying vec3 vN;
varying vec2 vUv;
void main() {
  vec3 n = normalize(vN);
  vec3 col = mix(uWood, uWoodHi, smoothstep(-0.3, 0.6, dot(n, uKey)) * 0.5);
  col *= 0.88 + 0.18 * n2(vec2(vUv.x * 5.0, vUv.y * 140.0));
  float m = texture2D(uMap, vUv).a;
  col = mix(col, uCarve, m * 0.92);
  col = mix(col, uLampC, uHot * 0.3);
  gl_FragColor = vec4(haze(col, vW), 1.0);
  #include <colorspace_fragment>
}`
/** a cast shadow on the gravel: the house's footprint (half) swept along the light for uLen, softening as it goes */
const SHADOW_FRAG = /* glsl */ `
${inkGlsl.noise}
${inkGlsl.haze}
uniform vec3 uC;
uniform vec2 uDir, uHalf, uOff;
uniform float uLen, uK, uDark;
varying vec3 vW;
varying vec2 vUv;
float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
void main() {
  float best = 1e3, bt = 0.0;
  vec2 p = vUv;
  for (int i = 0; i < 10; i++) {
    float t = float(i) / 9.0;
    float d = sdBox(p - uOff - uDir * uLen * t, uHalf + vec2(0.3, 0.3) * smoothstep(0.35, 0.8, t) * step(0.1, uHalf.y));
    if (d < best) { best = d; bt = t; }
  }
  float soft = 0.04 + 0.22 * bt;
  float a = (1.0 - smoothstep(-soft, soft, best + (n2(p * 3.3) - 0.5) * 0.14)) * (1.0 - 0.5 * bt);
  gl_FragColor = vec4(haze(uC, vW), a * uK * (0.6 + 0.25 * uDark));
  #include <colorspace_fragment>
}`
/** the fork village: tiny huts, one instanced mesh; some windows lit */
const HUT_VERT = /* glsl */ `
varying vec3 vW;
varying vec3 vN;
varying vec3 vO;
varying vec3 vL;
varying float vH;
void main() {
  mat4 m = modelMatrix * instanceMatrix;
  vec4 w = m * vec4(position, 1.0);
  vW = w.xyz;
  vO = position;
  vL = normal;
  vN = normalize(mat3(m) * normal);
  vH = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
  gl_Position = projectionMatrix * viewMatrix * w;
}`
const HUT_FRAG = /* glsl */ `
${inkGlsl.noise}
${inkGlsl.haze}
uniform vec3 uWall, uRoofC, uKey, uLampC;
uniform float uDark;
varying vec3 vW;
varying vec3 vN;
varying vec3 vO;
varying vec3 vL;
varying float vH;
void main() {
  vec3 n = normalize(vN);
  float lit = smoothstep(-0.15, 0.45, dot(n, uKey));
  vec3 col = vL.y > 0.3 ? mix(uRoofC * 0.75, uRoofC, lit) : mix(uWall * 0.62, uWall, lit);
  float win = step(0.42, vH) * step(0.5, abs(vL.z)) * step(abs(vO.x), 0.045) * step(0.05, vO.y) * step(vO.y, 0.13);
  col = mix(col, uLampC, win * (0.85 + 0.15 * uDark));
  // far, but not lost: the haze takes only part of a hut, so the village reads as roofs and lit windows
  gl_FragColor = vec4(mix(col, haze(col, vW), 0.62 - 0.3 * win), 1.0);
  #include <colorspace_fragment>
}`

/** rings of ripples on the water round the island, brushed and broken, following the raked circles */
const RIPPLE_FRAG = /* glsl */ `
${inkGlsl.noise}
${inkGlsl.haze}
uniform vec3 uC;
uniform float uA;
varying vec3 vW;
void main() {
  vec2 p = vW.xz - vec2(0.0, 0.2);
  float r = length(p), a = atan(p.y, p.x);
  float ph = (r - 5.25) * 2.2 + 0.25 * n2(vec2(a * 2.0, r * 0.5));
  float s = sin(ph * 6.2832);
  float line = smoothstep(0.9, 0.99, s) * (1.0 - smoothstep(0.25, 0.5, fwidth(ph)));
  float brk = smoothstep(0.4, 0.7, n2(vec2(a * 7.0, floor(ph) * 3.1)));
  float fade = smoothstep(5.2, 5.5, r) * (1.0 - smoothstep(5.8, 7.6, r));
  gl_FragColor = vec4(haze(uC, vW), line * brk * fade * uA);
  #include <colorspace_fragment>
}`

// ───────────────────────────── the scene ─────────────────────────────
/** the far hills under the fork village (also where the huts stand) */
const hill = (x: number, z: number) => {
  const r = Math.hypot(x - PC[0], z - PC[1])
  return smooth((r - 13) / 5) * (0.22 + 1.6 * vn(x * 0.12 + 3.1, z * 0.12) ** 1.6 + 0.3 * vn(x * 0.42, z * 0.42)) - 0.06
}

export function repoScene3d(ctx: SceneCtx) {
  const say = live('visually-hidden')
  // the sky caption: what a signal means, or the verdict, written in the empty sky over the island
  const cap = h('div', { class: 't31r3-cap', 'aria-hidden': 'true' })
  const root = h('div', { class: 't31r3' }, h('p', { class: 'visually-hidden' }, K.art), h('p', { class: 'g11-mock t31r3-mock' }, K.mock), cap, say)
  ctx.art.append(root)
  const sheet = cardSheet(root, K.takeaway, ctx.onCleanup)
  ctx.prompt(K.prompt)
  const portrait = ctx.art.clientWidth < ctx.art.clientHeight
  // far enough apart that the twins read as two from the front, near enough to share the island
  const HX = portrait ? 2.3 : 2.75
  let tex: THREE.CanvasTexture | null = null
  let offPrefs = () => {}
  ctx.onCleanup(() => (tex?.dispose(), offPrefs()))

  inkStage(ctx, root, {
    label: K.aria, hint: K.hint, dpr: [1.75, 1.25],
    // a tall frame already looks down 0.13 more (toolkit): start lower so the moon and hills stay in it
    // a tall frame is cropped tight on the two houses (their outer eaves run off it; the gap between them stays in) and
    // looks down a little more, onto the raked sand rather than the water in front
    view: { yaw: 0, pitch: portrait ? 0.22 : 0.27, yawRange: [-2.97, 2.97], pitchRange: [portrait ? 0.02 : 0.14, 0.87], fit: [portrait ? 6.5 : 8.3, portrait ? 2.6 : 3.0], target: [0, 1.0, portrait ? 0.9 : 0.6], zoomRange: [0.32, 1.25], shift: 0.1 },
    fallback: (host) => repoFlat(ctx, host),
  }, function* (k: InkKit) {
    const low = k.low
    const ol = !low // outlines on the smaller pieces only at high
    // ── colours from the theme tokens (linear light), recomputed on a theme change
    const C = () => new THREE.Color()
    const col = { paper: C(), dye: C(), wood: C(), woodLo: C(), woodHi: C(), tile: C(), tileLo: C(), tileHi: C(), red: C(), carve: C(), hutWall: C(), hutRoof: C(), umbra: C(), ripple: C(), dark: { value: 0 } }
    let warmMoon: THREE.Mesh | null = null
    const read = () => {
      const cs = getComputedStyle(document.documentElement)
      const v = (n: string, c = C()) => c.setStyle(cs.getPropertyValue(n).trim() || '#888', THREE.SRGBColorSpace)
      const dark = document.documentElement.dataset.theme === 'dark'
      col.dark.value = dark ? 1 : 0
      const wash = v('--wash'), lo = v('--rock-lo'), mid = v('--rock-mid'), lan = v('--lantern')
      v('--moon', col.ripple)
      if (!dark) col.ripple.set(1, 1, 1)
      if (warmMoon) warmMoon.visible = !dark
      col.paper.copy(dark ? v('--step-mid').lerp(v('--step-lo'), 0.3) : v('--card').lerp(v('--step-hi'), 0.5))
      col.dye.copy(dark ? lo.clone().lerp(mid, 0.4) : wash.clone().lerp(lo, 0.4))
      col.woodLo.copy(wash).lerp(lo, dark ? 0.6 : 0.5)
      col.wood.copy(lo).lerp(lan, dark ? 0.12 : 0.17)
      col.woodHi.copy(mid).lerp(lan, dark ? 0.12 : 0.15)
      col.red.copy(v('--vermilion'))
      col.carve.copy(dark ? v('--step-hi').lerp(v('--moon'), 0.4) : v('--card'))
      col.hutWall.copy(dark ? lo : mid)
      col.hutRoof.copy(dark ? wash.clone().lerp(lo, 0.3) : wash.clone().lerp(lo, 0.2))
      // tiles: dark ink roofs, their upper planes catching the moon
      col.tileLo.copy(wash).lerp(lo, dark ? 0.35 : 0.2)
      col.tile.copy(wash).lerp(lo, dark ? 0.85 : 0.6)
      col.tileHi.copy(lo).lerp(mid, dark ? 0.75 : 0.55)
      v('--umbra', col.umbra)
    }
    read()
    /** ink wash in the station's own tones: warm wood (the kit's bark is cold), dark tile */
    const toned = (m: THREE.ShaderMaterial, lo: THREE.Color, mid: THREE.Color, hi: THREE.Color) => {
      m.uniforms.uLo = { value: lo }
      m.uniforms.uMid = { value: mid }
      m.uniforms.uHi = { value: hi }
      return m
    }
    const wood = (o: { double?: boolean; moss?: number } = {}) => toned(k.ink('bark', { rim: 1.1, moss: o.moss ?? 0.15, double: o.double }), col.woodLo, col.wood, col.woodHi)
    const tiles = (double = false) => toned(k.ink('rock', { moss: 0.12, rim: 1.4, double }), col.tileLo, col.tile, col.tileHi)
    const U = k.uniforms
    const paperMat = (glow: number) =>
      new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: PAPER_FRAG, defines: { OCT: low ? 2 : 3 }, vertexColors: true, side: THREE.DoubleSide,
        uniforms: { ...U, uPaper: { value: col.paper }, uDye: { value: col.dye }, uWood: { value: col.woodLo }, uRed: { value: col.red }, uGlow: { value: glow }, uHot: { value: 0 }, uDark: col.dark },
      })
    offPrefs = onPrefs(() => (read(), k.render()))

    // ── sky, water, the island
    U.uKey.value.set(-0.52, 0.6, -0.6).normalize() // moon high behind-left: front faces in shade, shadows fall toward the visitor
    U.uFog.value.set(11, 42)
    k.backdrop({ moon: [0.03, 0.06, -1], moonRise: 4, mist: low ? 0.3 : 0.45, seed: 31 })
    // in the light theme the moon is a pale disc on pale paper: a warm halo round it (the kit's moon sits 80 out)
    const md = new THREE.Vector3(0.03, 0.06, -1).normalize().multiplyScalar(79).add(new THREE.Vector3(0, 1.0, portrait ? 0.9 : 0.6))
    warmMoon = k.glow([md.x, md.y, md.z], 24, 'lantern', 0.7)
    warmMoon.visible = col.dark.value === 0
    yield
    const pond = k.pond({ at: PC, r: [12, 11.2], seed: 31 })
    pond.renderOrder = -6 // under the island, which melts into it
    ;(pond.material as THREE.Material).depthWrite = false
    pond.position.y = -0.03
    const isle = k.ground({ r: 7, center: [0, 0.2] })
    isle.scale.set(5.05 / 7, 5.05 / 7, 1) // cut the sand at the kerb, before it fades
    const r = rng(311)
    // the kerb: stones in clusters of one to three, mostly small with a few big ones, sunk in the sand, gaps between
    const kerb: G[] = []
    for (let a = r() * 0.3, i = 0; a < Math.PI * 2 - 0.12; i++) {
      const n = 2 + Math.floor(r() * 3)
      for (let j = 0; j < n && a < Math.PI * 2 - 0.08; j++) {
        const w = 0.22 + r() * r() * 0.85, rad = 5.0 + (r() - 0.5) * 0.4
        const g = lump(i * 5 + j + 3, w, (0.1 + r() * 0.14) * (0.7 + w), w * (0.55 + r() * 0.35), Math.cos(a) * rad, 0.2 + Math.sin(a) * rad, -a - Math.PI / 2 + (r() - 0.5) * 0.7, low)
        kerb.push(g.translate(0, -(0.02 + r() * 0.06) * (0.6 + w), 0))
        a += (w * 0.55 + 0.06) / rad
      }
      a += (low ? 0.16 : 0.05) + r() * 0.2
    }
    // the two houses' worlds, and the stepping stones from the front of the island up to each gate
    const M = [0, 1].map((i) => new THREE.Matrix4().makeRotationY(i ? -RY : RY).setPosition(i ? HX : -HX, 0, 0))
    const W = (i: number, p: V3): V3 => {
      const v = new THREE.Vector3(...p).applyMatrix4(M[i])
      return [v.x, v.y, v.z]
    }
    for (const i of [0, 1]) for (const [z, s] of [[HD + 1.2, 0.44], [HD + 1.75, 0.4], [HD + 2.3, 0.44]]) {
      const [x, , zz] = W(i, [(r() - 0.5) * 0.1, 0, z])
      kerb.push(lump(40 + i * 5 + z * 3, s, 0.1, s * 0.75, x, zz, r() * 3, low))
    }
    k.mesh(merge(kerb), k.ink('rock', { moss: 0.85 }), { outline: ol })
    // ripples round the island on the black water, in rings like the rake's
    const rip = new THREE.RingGeometry(5.15, 9.6, low ? 64 : 128, 1).rotateX(-Math.PI / 2).translate(0, 0.004, 0.2)
    const ripM = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: RIPPLE_FRAG, defines: { OCT: 2 }, transparent: true, depthWrite: false, uniforms: { ...k.uniforms, uC: { value: col.ripple }, uA: { value: 0.2 } } })
    const ripQ = k.mesh(rip, ripM, { outline: false })
    ripQ.renderOrder = -5
    ripQ.raycast = () => {}
    yield

    // ── the real house (left) and the painted front (right)
    const hidden = new THREE.MeshBasicMaterial()
    const houseG = [0, 1].map((i) => {
      const g = new THREE.Group()
      g.position.set(i ? HX : -HX, 0, 0)
      g.rotation.y = i ? -RY : RY
      k.root.add(g)
      return g
    })
    // the shadows tell them apart from the front: a deep block thrown by the real one, a thin line under the board
    const key = U.uKey.value
    const shLen = Math.min(2.2, Math.sqrt(1 - key.y * key.y) / Math.max(0.2, key.y)) * 0.75
    const shadow = (i: number, half: [number, number], len: number, kk: number) => {
      const d = new THREE.Vector3(-key.x, 0, -key.z).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), i ? RY : -RY)
      const L = len * shLen
      const w = half[0] * 2 + 1.4 + Math.abs(d.x) * L, dd = half[1] * 2 + 1.4 + Math.abs(d.z) * L
      const g = new THREE.PlaneGeometry(w, dd).rotateX(-Math.PI / 2).translate((d.x * L) / 2, 0.006, (d.z * L) / 2 + (i ? HD : 0))
      const pa = g.attributes.position as THREE.BufferAttribute, ua = g.attributes.uv as THREE.BufferAttribute
      for (let j = 0; j < ua.count; j++) ua.setXY(j, pa.getX(j), pa.getZ(j)) // uv = house-space x, z
      const m = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: SHADOW_FRAG, defines: { OCT: 2 }, transparent: true, depthWrite: false,
        uniforms: { ...U, uC: { value: col.umbra }, uDir: { value: new THREE.Vector2(d.x, d.z) }, uLen: { value: L }, uHalf: { value: new THREE.Vector2(...half) }, uOff: { value: new THREE.Vector2(0, i ? HD : 0) }, uK: { value: kk }, uDark: col.dark },
      })
      const q = k.mesh(g, m, { parent: houseG[i], outline: false })
      q.renderOrder = -4
      q.raycast = () => {}
      return q
    }
    shadow(0, [HW + 0.1, HD + 0.1], 2.1, 1.5)
    const thin = shadow(1, [HW + 0.05, 0.035], 0.32, 0.8)
    // the first lamp slot: the light inside the real house, spilling through its shōji onto the porch and gravel
    const inside = k.lamp(W(0, [0, 0.85, HD + 0.32]), { k: 0.8, halo: low ? 0 : 1.5 })
    const realPaper = paperMat(0.62)
    const P0 = house(false, low)
    k.mesh(merge(P0.wood), wood(), { parent: houseG[0], outline: ol })
    k.mesh(merge(P0.wall), k.ink('step', { moss: 0.1, rim: 0.8 }), { parent: houseG[0], outline: ol })
    const roof0 = k.mesh(merge(P0.roof), tiles(), { parent: houseG[0] })
    k.mesh(merge(P0.paper), realPaper, { parent: houseG[0], outline: false })
    yield
    const facade = new THREE.Group()
    facade.position.z = HD // it pivots on the foot of its front wall
    houseG[1].add(facade)
    const P1 = house(true, low)
    const back = (gs: G[]) => gs.map((g) => g.translate(0, 0, -HD))
    k.mesh(merge(back(P1.wood)), wood({ double: true }), { parent: facade, outline: ol })
    k.mesh(merge(back(P1.wall)), k.ink('step', { moss: 0.1, rim: 0.8 }), { parent: facade, outline: ol })
    const roof1 = k.mesh(merge(back(P1.roof)), tiles(true), { parent: facade })
    k.mesh(merge(back(P1.paper)), paperMat(0.62), { parent: facade, outline: false })
    // the two bamboo props, each pivoting on its foot in the gravel: they go down with the front, outward, and stay in view
    const props = P1.props.map((geo, j) => {
      const foot = new THREE.Vector3(j ? 1.18 : -1.18, 0, HD - 1.5)
      const pg = new THREE.Group()
      pg.position.copy(foot)
      houseG[1].add(pg)
      k.mesh(geo.translate(-foot.x, -foot.y, -foot.z), wood(), { parent: pg, outline: ol })
      return { g: pg, s: j ? 1 : -1 }
    })
    yield

    // ── the gate lamps (paper andon on a post at the head of each walk): lighting one chooses that house
    const GZ = HD + 1.7
    const andon = [0, 1].map((i) => {
      const s = i ? -1 : 1
      const x = s * 0.95, z = GZ
      const g = new THREE.Group()
      k.root.add(g)
      const geo = merge([
        PB(0.07, 0.7, 0.07, x, 0.35, z, WOOD), PB(0.3, 0.035, 0.3, x, 0.71, z, WOOD), PB(0.33, 0.04, 0.33, x, 1.12, z, WOOD),
        tint(new THREE.CylinderGeometry(0.06, 0.2, 0.08, 4, 1).rotateY(Math.PI / 4).translate(x, 1.18, z), WOOD),
        ...[0, 1, 2, 3].map((f) => PP(0.24, 0.36, x + Math.sin((f * Math.PI) / 2) * 0.12, 0.91, z + Math.cos((f * Math.PI) / 2) * 0.12, (f * Math.PI) / 2, SHOJI)),
      ]).applyMatrix4(M[i])
      const mat = paperMat(0.08)
      k.mesh(geo, mat, { parent: g, outline: false })
      const L = k.lamp(W(i, [x, 0.92, z + 0.3]), { k: 0, halo: low ? 0 : 1.3 })
      return { g, mat, L }
    })
    yield

    // ── signals: one tappable group each, holding its piece on BOTH houses (they glow together)
    const dot = new THREE.BoxGeometry(0.01, 0.01, 0.01)
    const anchor = (p: V3) => {
      const m = new THREE.Mesh(dot, hidden)
      m.visible = false
      m.position.set(...p)
      k.root.add(m)
      return m
    }
    const riders: THREE.Mesh[] = [] // pieces fixed to the painted front: they move when it blows over
    type Bag = { wood: G[]; paper: G[]; step: G[] }
    const bag = (): Bag => ({ wood: [], paper: [], step: [] })
    const sigGroups: Record<Sig, THREE.Group> = {} as Record<Sig, THREE.Group>
    const sigAnch: Record<Sig, THREE.Mesh[]> = {} as Record<Sig, THREE.Mesh[]>
    const sigGlow: Record<Sig, THREE.Mesh[]> = {} as Record<Sig, THREE.Mesh[]>
    const build = (id: Sig, real: Bag, fixed: Bag, ride: Bag, anchors: [V3, V3]) => {
      const g = new THREE.Group()
      k.root.add(g)
      sigGroups[id] = g
      // at low the small wooden bits are drawn with the paper material (no outline pass)
      const asPaper = (x: G) => (x.attributes.uv || x.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2)), tint(x, WOOD))
      if (low) for (const b of [real, fixed, ride]) b.paper.push(...b.wood.map(asPaper)), (b.wood.length = 0)
      const world = (b: Bag, i: number) => [...b.wood, ...b.paper, ...b.step].forEach((x) => x.applyMatrix4(M[i]))
      world(real, 0)
      world(fixed, 1)
      const wd = [...real.wood, ...fixed.wood], pp = [...real.paper, ...fixed.paper], st = [...real.step, ...fixed.step]
      if (wd.length) k.mesh(merge(wd), wood(), { parent: g, outline: ol })
      if (pp.length) k.mesh(merge(pp), paperMat(1), { parent: g, outline: false })
      if (st.length) k.mesh(merge(st), k.ink('step', { moss: 0.5 }), { parent: g, outline: ol })
      // the painted front's share, in facade space
      const rideGeos: [G[], THREE.Material, boolean][] = [[ride.wood, wood(), ol], [ride.paper, paperMat(1), false]]
      for (const [gs, mat, outline] of rideGeos) {
        if (!gs.length) continue
        const m = k.mesh(merge(back(gs)), mat, { parent: g, outline })
        m.matrixAutoUpdate = false
        riders.push(m)
      }
      sigAnch[id] = [anchor(W(0, anchors[0])), anchor(W(1, anchors[1]))]
      sigGlow[id] = sigAnch[id].map((a) => {
        const q = k.glow([a.position.x, a.position.y - 0.25, a.position.z], 1.1, 'moon', 0.75)
        q.visible = false
        return q
      })
    }
    // README: a scroll pinned by the door; the copy's has a red slip "quick installer" stuck on it
    const scroll = (): Bag => ({ wood: [], paper: [PB(0.13, 0.42, 0.01, -0.5, 0.96, HD + 0.075, WRIT), PB(0.17, 0.025, 0.025, -0.5, 1.18, HD + 0.08, WOOD), PB(0.17, 0.025, 0.025, -0.5, 0.74, HD + 0.08, WOOD)], step: [] })
    const fakeScroll = scroll()
    fakeScroll.paper.push(PB(0.075, 0.1, 0.012, -0.47, 0.84, HD + 0.088, RED, 0.28))
    build('readme', scroll(), bag(), fakeScroll, [[-0.5, 1.22, HD + 0.08], [-0.5, 1.22, HD + 0.08]])
    // Stars: a string of small paper lanterns under the front eave — the same number on both (on purpose)
    const string = (): Bag => ({
      wood: [], step: [],
      paper: [PB(HW * 2 - 0.3, 0.012, 0.012, 0, 1.34, HD + 0.42, WOOD), ...[-1, -0.5, 0, 0.5, 1].flatMap((x) => [PB(0.008, 0.06, 0.008, x, 1.3, HD + 0.42, WOOD), PE(0.068, 0.092, 0.068, x, 1.19, HD + 0.42, LIT, low)])],
    })
    build('stars', string(), bag(), string(), [[0, 1.12, HD + 0.42], [0, 1.12, HD + 0.42]])
    // Fork: stepping stones from the real house's back across the water toward the fork village; weeds behind the copy
    const path: G[] = []
    const p0 = W(0, [-0.35, 0, -HD - 0.6])
    const p1: V3 = [-7.6, 0, -7.6], pc: V3 = [-3.6, 0, -4.9]
    const ns = low ? 9 : 14
    for (let i = 0; i < ns; i++) {
      const t = i / (ns - 1), u = 1 - t
      const x = u * u * p0[0] + 2 * u * t * pc[0] + t * t * p1[0], z = u * u * p0[2] + 2 * u * t * pc[2] + t * t * p1[2]
      const s = 0.5 - t * 0.08
      path.push(lump(70 + i, s, 0.1 + (t > 0.3 ? 0.06 : 0), s * 0.72, x + (r() - 0.5) * 0.12, z + (r() - 0.5) * 0.12, r() * 3, low))
    }
    const weeds = [0, 1, 2, 3].map((j) => lump(90 + j, 0.32 + r() * 0.2, 0.2 + r() * 0.12, 0.3, 0.3 + (r() - 0.5) * 0.7, -HD - 0.7 + (r() - 0.5) * 0.4, r() * 3, low))
    build('forks', { wood: [], paper: [], step: [] }, { wood: [], paper: [], step: weeds }, bag(), [[-0.35, 0.45, -HD - 0.7], [0.3, 0.55, -HD - 0.7]])
    k.mesh(merge(path), k.ink('step', { moss: 0.4 }), { parent: sigGroups.forks, outline: ol })
    yield
    // Issues: a mailbox with a new letter tied in red string (answered) / a bell wrapped shut in paper (turned off)
    const mx = -1.05, mz = HD + 1.12
    build('issues',
      { wood: [B(0.07, 0.96, 0.07, mx, 0.48, mz), B(0.3, 0.2, 0.22, mx, 1.03, mz), B(0.34, 0.035, 0.26, mx, 1.15, mz, 0, 0.12)], paper: [PB(0.18, 0.13, 0.012, mx + 0.02, 1.19, mz + 0.02, PAPER, 0.1), PB(0.014, 0.135, 0.016, mx + 0.03, 1.19, mz + 0.024, RED, 0.1)], step: [] },
      { wood: [B(0.07, 1.25, 0.07, -mx, 0.62, mz), B(0.34, 0.05, 0.05, -mx + 0.13, 1.22, mz), B(0.01, 0.1, 0.01, -mx + 0.26, 1.15, mz)], paper: [PE(0.1, 0.13, 0.1, -mx + 0.26, 0.99, mz, PAPER, low), PB(0.21, 0.012, 0.21, -mx + 0.26, 1.02, mz, WOOD), PB(0.012, 0.27, 0.205, -mx + 0.26, 0.99, mz, WOOD)], step: [] },
      bag(), [[mx, 1.24, mz], [-mx + 0.2, 1.24, mz]])
    // Releases: a notice board behind the real house, dated notes pinned on it / a nameless bundle tied to the copy's prop
    const bx = 0.25, bz = -HD - 0.95
    const bun: V3 = [1.06, 0.5, HD - 0.74]
    build('releases',
      { wood: [B(0.08, 1.3, 0.08, bx - 0.44, 0.65, bz), B(0.08, 1.3, 0.08, bx + 0.44, 0.65, bz), B(0.96, 0.6, 0.05, bx, 0.98, bz), B(1.1, 0.04, 0.22, bx, 1.31, bz, 0, 0, 0.08)], paper: [PP(0.24, 0.3, bx - 0.26, 1.0, bz - 0.03, Math.PI, WRIT), PP(0.2, 0.26, bx + 0.02, 0.96, bz - 0.03, Math.PI, WRIT), PP(0.24, 0.22, bx + 0.28, 1.03, bz - 0.03, Math.PI, WRIT)], step: [] },
      bag(),
      { wood: [rod([1.03, 0.94, HD - 0.62], [bun[0], bun[1] + 0.14, bun[2]], 0.008, 4)], paper: [PE(0.17, 0.14, 0.15, ...bun, INDIGO, low), PE(0.055, 0.06, 0.04, bun[0] - 0.05, bun[1] + 0.15, bun[2], INDIGO, low), PE(0.055, 0.06, 0.04, bun[0] + 0.05, bun[1] + 0.15, bun[2], INDIGO, low)], step: [] },
      [[bx, 1.42, bz], [bun[0], 0.82, bun[2]]])
    // License: the carved name boards on both gates, and the MIT plaque only on the real one (canvas atlas)
    const cv = document.createElement('canvas')
    const S = low ? 512 : 1024
    cv.width = cv.height = S
    tex = new THREE.CanvasTexture(cv)
    tex.anisotropy = low ? 1 : 4
    const carve = () => {
      const c = cv.getContext('2d')
      if (!c) return
      const fam = getComputedStyle(document.documentElement).getPropertyValue('--serif').trim() || 'serif'
      c.clearRect(0, 0, S, S)
      c.fillStyle = '#fff'
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      const line = (t: string, x: number, y: number, w: number, px: number) => {
        c.font = `600 ${px}px ${fam}`
        const k2 = Math.min(1, w / c.measureText(t).width)
        c.font = `600 ${Math.floor(px * k2)}px ${fam}`
        c.fillText(t, x, y)
      }
      line(K.repos[0].name, S / 2, S * 0.14, S * 0.9, S * 0.13)
      line(K.repos[1].name, S / 2, S * 0.43, S * 0.9, S * 0.13)
      line(K.repos[0].values.license, S * 0.16, S * 0.75, S * 0.26, S * 0.12)
      tex!.needsUpdate = true
    }
    carve()
    void document.fonts?.load(`600 40px ${getComputedStyle(document.documentElement).getPropertyValue('--serif').trim() || 'serif'}`).then(() => (carve(), k.render()))
    const boardMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: BOARD_FRAG, defines: { OCT: 2 },
      uniforms: { ...U, uMap: { value: tex }, uWood: { value: col.woodLo }, uWoodHi: { value: col.wood }, uCarve: { value: col.carve }, uHot: { value: 0 } },
    })
    /** a board face showing the atlas cell [u0, v0 (top), u1, v1] */
    /** a board face showing the atlas cell [u0, v0 (top), u1, v1]; on the real house (world) or the painted front (its own space) */
    const face = (w: number, hh: number, x: number, y: number, z: number, cell: [number, number, number, number], real: boolean) => {
      const g = new THREE.PlaneGeometry(w, hh)
      const uv = g.attributes.uv as THREE.BufferAttribute
      for (let j = 0; j < uv.count; j++) uv.setXY(j, cell[0] + uv.getX(j) * (cell[2] - cell[0]), 1 - (cell[1] + (1 - uv.getY(j)) * (cell[3] - cell[1])))
      return real ? g.translate(x, y, z).applyMatrix4(M[0]) : g.translate(x, y, z - HD)
    }
    const lic = new THREE.Group()
    k.root.add(lic)
    sigGroups.license = lic
    k.mesh(merge([face(0.62, 0.17, 0, 1.2, HD + 0.092, [0.02, 0.04, 0.98, 0.24], true), face(0.16, 0.2, 0.62, 0.6, HD + 0.021, [0.02, 0.62, 0.3, 0.88], true)]), boardMat, { parent: lic, outline: false })
    const licCopy = k.mesh(face(0.62, 0.17, 0, 1.2, HD + 0.092, [0.02, 0.33, 0.98, 0.53], false), boardMat, { parent: lic, outline: false })
    licCopy.matrixAutoUpdate = false
    riders.push(licCopy)
    sigAnch.license = [anchor(W(0, [0, 1.32, HD + 0.1])), anchor(W(1, [0, 1.32, HD + 0.1]))]
    sigGlow.license = sigAnch.license.map((a) => {
      const q = k.glow([a.position.x, a.position.y - 0.3, a.position.z + 0.1], 1.2, 'moon', 0.7)
      q.visible = false
      return q
    })
    yield

    // ── the fork village on the far hills: terrain, 640 huts (120 at low), faint paths between the hamlets
    const ring = new THREE.RingGeometry(13, 27, low ? 64 : 112, low ? 7 : 12)
    ring.deleteAttribute('uv')
    ring.rotateX(-Math.PI / 2).translate(PC[0], 0, PC[1])
    const rp = ring.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < rp.count; i++) rp.setY(i, hill(rp.getX(i), rp.getZ(i)))
    ring.computeVertexNormals()
    k.mesh(ring, k.ink('rock', { moss: 0.55, rim: 0.5, edge: 0.35 }), { outline: false })
    yield
    const rv = rng(3131)
    const hamlets: [number, number][] = []
    const nh = low ? 10 : 24
    for (let i = 0; i < nh; i++) {
      const a = (i / nh) * Math.PI * 2 + rv() * 0.3, rr = 17.5 + rv() * 7
      hamlets.push([PC[0] + Math.cos(a) * rr, PC[1] + Math.sin(a) * rr])
    }
    const hut = merge([B(0.34, 0.2, 0.26, 0, 0.1, 0), (() => {
      const g = new THREE.CylinderGeometry(0.22, 0.22, 0.42, 3, 1)
      g.deleteAttribute('uv')
      return g.rotateZ(-Math.PI / 2).rotateX(-Math.PI / 2).translate(0, 0.31, 0)
    })()])
    const hutMat = new THREE.ShaderMaterial({
      vertexShader: HUT_VERT, fragmentShader: HUT_FRAG, defines: { OCT: 2 },
      uniforms: { ...U, uWall: { value: col.hutWall }, uRoofC: { value: col.hutRoof }, uDark: col.dark },
    })
    const N = low ? 120 : 640
    const huts = new THREE.InstancedMesh(hut, hutMat, N)
    const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), s4 = new THREE.Vector3(), p4 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0)
    for (let i = 0; i < N; i++) {
      const [hx, hz] = hamlets[i % nh]
      const a = rv() * Math.PI * 2, d = 0.3 + rv() * rv() * 2.6
      const x = hx + Math.cos(a) * d, z = hz + Math.sin(a) * d
      p4.set(x, hill(x, z) - 0.02, z)
      q4.setFromAxisAngle(up, rv() * Math.PI * 2)
      s4.setScalar(0.62 + rv() * 0.4)
      huts.setMatrixAt(i, m4.compose(p4, q4, s4))
    }
    huts.raycast = () => {}
    k.root.add(huts)
    const trail: number[] = [], tri: number[] = []
    const seen = new Set<string>()
    hamlets.forEach((a, i) => {
      const near = hamlets.map((b, j) => [j, Math.hypot(b[0] - a[0], b[1] - a[1])] as [number, number]).filter(([j]) => j !== i).sort((x, y) => x[1] - y[1]).slice(0, 2)
      for (const [j] of near) {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`
        if (seen.has(key)) continue
        seen.add(key)
        const b = hamlets[j]
        const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), nx = -dz / L, nz = dx / L
        const n0 = trail.length / 3, steps = 14
        for (let s = 0; s <= steps; s++) {
          const t = s / steps, wig = Math.sin(t * Math.PI * 2 + i) * 0.35 * Math.sin(t * Math.PI)
          const x = a[0] + dx * t + nx * wig, z = a[1] + dz * t + nz * wig, w = 0.035
          trail.push(x - nx * w, hill(x - nx * w, z - nz * w) + 0.03, z - nz * w, x + nx * w, hill(x + nx * w, z + nz * w) + 0.03, z + nz * w)
          if (s) tri.push(n0 + s * 2 - 2, n0 + s * 2 - 1, n0 + s * 2, n0 + s * 2 - 1, n0 + s * 2 + 1, n0 + s * 2)
        }
      }
    })
    const tg = new THREE.BufferGeometry()
    tg.setAttribute('position', new THREE.Float32BufferAttribute(trail, 3))
    tg.setIndex(tri)
    tg.computeVertexNormals()
    k.mesh(tg, k.ink('step', { rim: 0, edge: 0.2 }), { outline: false }).raycast = () => {}
    yield

    // ── a pine leaning over the back of the island, two stones in front (high only)
    if (!low) {
      k.pine({ at: [-3.4, -3.3], h: 3.5, lean: 1, seed: 9 })
      k.rock({ at: [-4.1, 2.35], w: 0.95, h: 0.55, seed: 4, moss: 0.7 })
    }
    houseG[1].updateMatrixWorld(true)
    const ride = () => {
      facade.updateMatrixWorld(true)
      for (const m of riders) m.matrix.copy(facade.matrixWorld), (m.matrixWorldNeedsUpdate = true)
    }
    ride()

    // ── interaction
    const values = (j: number) => K.repos[j].values as Record<string, string>
    const views: Record<Sig, [V3, number, number, number]> = {
      readme: [[0, 1.0, 1.1], 0, 0.2, 0.6],
      stars: [[0, 1.25, 1.1], 0, 0.15, 0.72],
      forks: [[-4.8, 0.3, -5.4], 0.75, 0.56, 1.1],
      issues: [[0, 0.9, 2.6], 0, 0.24, 0.62],
      releases: [[0, 1.0, -1.2], 2.8, 0.32, 0.95],
      license: [[0, 1.1, 1.6], 0, 0.1, 0.34],
    }
    let tags: HTMLElement[] = []
    let lit: Sig | null = null
    // the choice waits for evidence: the gate lamps' tags show once two signals have been compared on both houses
    const compared = new Set<string>()
    const clear = () => {
      tags.forEach((t) => t.remove())
      tags = []
      if (lit) sigGlow[lit].forEach((q) => (q.visible = false))
      lit = null
    }
    const signal = (sg: (typeof K.signals)[number]) => {
      const id = sg.id as Sig
      clear()
      lit = id
      sigGlow[id].forEach((q) => (q.visible = true))
      cap.replaceChildren(h('p', { class: 't31r3-sig-name' }, sg.label), h('p', { class: 't31r3-sig-what' }, sg.what))
      K.repos.forEach((rp2, j) => tags.push(k.label(sigAnch[id][j], h('p', { class: `t31r3-val${rp2.trust ? '' : ' copy'}` }, values(j)[id]))))
      say.say(`${sg.label}: ${sg.what} ${K.repos.map((x, j) => `${x.name}: ${values(j)[id]}`).join('. ')}.`)
      const [t, yaw, pitch, z] = views[id]
      void k.fly(t, yaw, portrait ? pitch - 0.1 : pitch, 1.3)
      k.dolly(z)
      ctx.chime('tap')
      compared.add(id)
      if (compared.size === 1) ctx.prompt(K.prompts[1])
      else if (compared.size === 2 && !root.classList.contains('t31r3-ready')) root.classList.add('t31r3-ready'), ctx.prompt(K.prompts[2])
    }
    K.signals.forEach((sg) => k.tappable(sigGroups[sg.id as Sig], fill(K.signalAria, { label: sg.label }), () => signal(sg)))

    let picked = false
    let blown = false
    const blow = () => {
      if (blown) return
      blown = true
      thin.visible = false
      let t = 0
      k.animate((dt) => {
        t = Math.min(1, t + dt / 1.7)
        // the wind catches it (a shiver), then it goes over backward onto the gravel and settles
        const u = Math.max(0, (t - 0.3) / 0.7)
        const shiver = t < 0.3 ? -0.07 * Math.sin((t / 0.3) * Math.PI * 3) * (t / 0.3) : 0
        facade.rotation.x = shiver - 1.48 * u * u + (u > 0.9 ? Math.sin((u - 0.9) * 31) * 0.02 : 0)
        const v = Math.max(0, (t - 0.42) / 0.58)
        for (const pr of props) pr.g.rotation.z = -pr.s * 1.4 * v * v
        ride()
        return t < 1
      })
    }
    const pick = (j: number) => {
      if (compared.size < 2) return ctx.prompt(K.readFirst, 'wrong')
      const rp2 = K.repos[j]
      clear()
      const a = andon[j]
      let t = 0
      k.animate((dt) => {
        t = Math.min(1, t + dt / 0.8)
        a.mat.uniforms.uGlow.value = 0.08 + 1.1 * t
        a.L.set(t)
        if (rp2.trust) realPaper.uniforms.uGlow.value = 0.62 + 0.55 * t, inside.set(0.8 + 0.2 * t)
        return t < 1
      })
      if (rp2.trust) void k.fly([-HX, 1.0, 0.9], 0.32, portrait ? 0.16 : 0.26, 1.3), k.dolly(0.8)
      // the front lies on its back: look down on it from the island's middle, painted roof and shōji up, nothing behind
      // it, the whole real house beside it for comparison (and the open water out of the frame)
      else blow(), void k.fly([HX - 0.7, 0.15, -0.35], 1.0, portrait ? 0.76 : 0.8, 1.7), k.dolly(0.74)
      cap.replaceChildren(h('p', { class: `t31r3-verdict${rp2.trust ? '' : ' bad'}` }, h('span', { class: 't31r3-seal', 'aria-hidden': 'true' }), rp2.trust ? K.right : K.wrong))
      root.classList.add('t31r3-picked')
      say.say(rp2.trust ? K.right : K.wrong)
      ctx.chime(rp2.trust ? 'ok' : 'low')
      // the insight comes with the real house, not with a wrong guess (the verdict says why it was wrong)
      if (!rp2.trust) return ctx.prompt(K.prompts[2], 'wrong')
      if (picked) return
      picked = true
      ctx.insight(K.insight as Fact, K.detail as Fact)
      sheet.show()
    }
    k.root.updateMatrixWorld(true)
    andon.forEach((a, j) => {
      k.tappable(a.g, fill(K.pickAria, { name: K.repos[j].name }), () => pick(j))
      k.label(a.g, h('p', { class: 't31r3-tag' }, K.pick), [0, 0.06, 0]) // a paper tag tied to the lantern's cap
    })
    // the lamps' tags and the names read only from the front: hide them once the walk goes round the side or back
    let behind = false
    k.onFrame(() => {
      const c = k.stage!.camera.position
      const b = c.z < Math.abs(c.x) * 1.1
      if (b !== behind) root.classList.toggle('t31r3-back', (behind = b))
    })
    // the labels below measure the houses' boxes: their parents' world matrices must be current first
    k.root.updateMatrixWorld(true)
    // names may break after the slash on a narrow screen
    k.label(roof0, h('p', { class: 't31r3-name' }, K.repos[0].name.replace('/', '/\u200b')), [0, 0.22, 0])
    k.label(roof1, h('p', { class: 't31r3-name' }, K.repos[1].name.replace('/', '/\u200b')), [0, 0.22, 0])
  })
}
