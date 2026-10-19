import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import raw from '../../content/tram-19.json'
import { fill, h, nextId, viDate } from '../../core/dom'
import { L, type Fact } from '../../core/content'
import { onPrefs } from '../../core/prefs'
import type { SceneCtx } from '../types'
import type { NewsItem } from '../../ui/part2/types'
import { inkGlsl, inkStage, type InkKit, type V3 } from '../../ui/part2/stage3d'
import { NEWS, newsStones } from '../../ui/part2/news'
import { markGlyph, markOf } from '../../ui/part2/marks'
import { rng } from '../../ui/part2/ink'
import { guide } from '../../ui/part2/guide'

const P = raw.scenes.peaks
const SHORT = P.short as Record<string, string>
/** what someone outside has checked on a stele (Mozilla's fixes, open weights): lit, its peak keeps a crag above the cloud */
const CHECKED = P.checked as Record<string, string>
const SRGB = THREE.SRGBColorSpace
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}

const toFact = (it: NewsItem): Fact => ({ text: it.what, asOf: NEWS.asOf, source: it.source, kind: it.kind, claimBy: it.claimBy, verifiedBy: it.verifiedBy })
/** same rule as newsStones' "verified only": a fact nobody but its maker vouches for stays hidden */
const verified = (it: NewsItem) => it.kind === 'fact' && (!it.claimBy || !!it.verifiedBy)
const kept = (it: NewsItem) => verified(it) || it.id in CHECKED
function isOld(date: string) {
  const [y, m, d] = NEWS.asOf.split('-').map(Number)
  return date < new Date(Date.UTC(y, m - 1 - 6, d || 1)).toISOString().slice(0, 10)
}

// ───────────── geometry (build time only) ─────────────
const hash = (x: number, y: number, z: number) => {
  const q = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
  return q - Math.floor(q)
}
function noise(x: number, y: number, z: number) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z)
  const fx = x - ix, fy = y - iy, fz = z - iz
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz)
  const c = (a: number, b: number, d: number) => hash(ix + a, iy + b, iz + d)
  const l = (a: number, b: number, t: number) => a + (b - a) * t
  return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v), l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w)
}
const fbm = (x: number, y: number, z: number) => noise(x, y, z) * 0.55 + noise(x * 2.1, y * 2.1, z * 2.1) * 0.3 + noise(x * 4.3, y * 4.3, z * 4.3) * 0.15

/**
 * A Huangshan spire, foot deep under the cloud (t = 0) to a pointed crown (t = 1): a convex taper into a point, granite
 * joints running down it, fbm crags that grow strong toward the crown (which splits into a few points), a lopsided shoulder.
 * Rows crowd toward the crown, where the detail is. Returns the geometry and where the crown ends up (x, z).
 */
function spireGeo(seed: number, r: number, base: number, top: number, ws: number, hs: number, crag = 1): { geo: THREE.BufferGeometry; tip: [number, number] } {
  const cyl = new THREE.CylinderGeometry(1, 1, 1, ws, hs, true)
  cyl.deleteAttribute('uv')
  cyl.deleteAttribute('normal')
  const g = mergeVertices(cyl)
  cyl.dispose()
  const R = rng(seed)
  const o = R() * 50
  const lean = (R() - 0.5) * 0.6, lean2 = (R() - 0.5) * 0.4
  const lobes = 5 + Math.floor(R() * 4), pw = 0.74 + R() * 0.14
  const shA = R() * Math.PI * 2, shK = 0.22 + R() * 0.3, shT = 0.66 + R() * 0.14
  const p = g.attributes.position as THREE.BufferAttribute
  const H = top - base
  const axis = (t: number): [number, number] => [r * (lean * t * t + lean2 * Math.sin(t * 3)), r * lean2 * t * 0.5]
  for (let i = 0; i < p.count; i++) {
    const s = p.getY(i) + 0.5
    const t = 1 - Math.pow(1 - s, 1.55)
    const a = Math.atan2(p.getZ(i), p.getX(i))
    const ca = Math.cos(a), sa = Math.sin(a)
    const crown = smooth(0.62, 1, t)
    const joint = Math.sin(a * lobes + noise(t * 2.5 + o, a, 1) * 3)
    const ridge = 1 - Math.abs(noise(ca * 1.6 + o, sa * 1.6 + t * 1.4, o * 0.3) * 2 - 1)
    const cr = fbm(ca * 3.1 + o, sa * 3.1, t * 8)
    const sh = shK * Math.exp(-(((t - shT) / 0.09) ** 2)) * Math.max(0, Math.cos(a - shA)) ** 2
    // a bamboo-shoot profile: gently swelling sides, then a pointed (not domed, not needle) crown
    let rad = r * Math.pow(1 - t, pw) * (1 + 0.7 * t * (1 - t))
    rad *= Math.max(0.05, 1 + 0.1 * joint * (1 - crown) + 0.3 * (ridge - 0.5) + (0.2 + 0.7 * crown * crag) * (cr - 0.5) * 2 + sh)
    // the crown splits into a few points: a vertical jitter that grows toward the tip, gone at the very top
    const yj = H * 0.035 * crag * crown * (1 - smooth(0.93, 1, t)) * (noise(ca * 2.6 + o, sa * 2.6, 9) - 0.5) * 2
    const [cx, cz] = axis(t)
    p.setXYZ(i, cx + ca * rad, base + t * H + yj, cz + sa * rad)
  }
  g.computeVertexNormals()
  return { geo: g, tip: axis(1) }
}

/** A massif: the main spire and two or three lower crags on its shoulders, lopsided, so each summit is a cluster of points. */
function massifGeo(seed: number, r: number, base: number, top: number, low: boolean): { geo: THREE.BufferGeometry; tip: [number, number] } {
  const R = rng(seed + 1)
  const H = top - base
  const side = R() < 0.5 ? -1 : 1
  const main = spireGeo(seed, r, base, top, low ? 28 : 44, low ? 26 : 44)
  const subs: [number, number, number, number][] = [
    [0.34, 0.93 + R() * 0.02, side * (0.26 + R() * 0.06), -(0.05 + R() * 0.1)], // crown points flanking the summit
    [0.62, 0.84 + R() * 0.04, side * (0.52 + R() * 0.15), -(0.15 + R() * 0.2)], // shoulders, lopsided
    [0.5, 0.75 + R() * 0.05, -side * (0.5 + R() * 0.12), -(0.25 + R() * 0.25)],
  ]
  if (!low) subs.push([0.28, 0.9 + R() * 0.03, -side * (0.24 + R() * 0.06), -(0.12 + R() * 0.1)], [0.82, 0.66 + R() * 0.05, side * (0.95 + R() * 0.2), -(0.45 + R() * 0.3)])
  const parts = [main.geo]
  subs.forEach(([k, hk, dx, dz], j) => {
    const small = k < 0.4
    const sp = spireGeo(seed + 7 + j * 5, r * k, base, base + H * hk, low ? 12 : small ? 16 : 24, low ? 12 : small ? 18 : 24, 0.8)
    sp.geo.translate(dx * r, 0, dz * r)
    parts.push(sp.geo)
  })
  const geo = mergeGeometries(parts)!
  parts.forEach((x) => x.dispose())
  return { geo, tip: main.tip }
}

/** A low stele slab: wider than tall, its top corners chamfered by hand (unevenly), bevelled edges; on y = 0, facing +z. */
function slabGeo(w: number, hh: number, d: number): THREE.BufferGeometry {
  const s = new THREE.Shape()
  const c = w * 0.16
  s.moveTo(-w / 2, 0)
  s.lineTo(-w / 2, hh - c)
  s.lineTo(-w / 2 + c, hh)
  s.lineTo(w / 2 - c * 0.7, hh - c * 0.12)
  s.lineTo(w / 2, hh - c * 0.85)
  s.lineTo(w / 2, 0)
  s.lineTo(-w / 2, 0)
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: d * 0.22, bevelSize: w * 0.04, bevelSegments: 1, curveSegments: 1 })
  g.translate(0, 0, -d / 2)
  g.deleteAttribute('uv')
  return g
}

/** a tube along pts whose radius tapers from r0 to r1 (a trunk, a bough) */
function taperTube(pts: THREE.Vector3[], r0: number, r1: number, seg: number, rs: number): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(pts)
  const fr = curve.computeFrenetFrames(seg, false)
  const pos: number[] = []
  const idx: number[] = []
  const P0 = new THREE.Vector3()
  for (let i = 0; i <= seg; i++) {
    const u = i / seg
    curve.getPointAt(u, P0)
    const rr = r0 + (r1 - r0) * Math.pow(u, 0.8)
    for (let j = 0; j < rs; j++) {
      const a = (j / rs) * Math.PI * 2
      const N = fr.normals[i], B = fr.binormals[i]
      pos.push(P0.x + (N.x * Math.cos(a) + B.x * Math.sin(a)) * rr, P0.y + (N.y * Math.cos(a) + B.y * Math.sin(a)) * rr, P0.z + (N.z * Math.cos(a) + B.z * Math.sin(a)) * rr)
    }
  }
  for (let i = 0; i < seg; i++)
    for (let j = 0; j < rs; j++) {
      const a = i * rs + j, b = i * rs + ((j + 1) % rs), c = a + rs, d = b + rs
      idx.push(a, c, b, b, c, d)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// ───────────── shaders of this scene (the toolkit's noise + haze, so they match its ink) ─────────────
const VERT = /* glsl */ `
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`
/**
 * The sea of cloud filling the valley: big rolling billows lit from the moon's side, shaded in their hollows, and the long
 * shadows of the peaks thrown across it away from the low moon (to the left), broken by the billows.
 */
const SEA_FRAG = /* glsl */ `
${inkGlsl.noise}
${inkGlsl.haze}
uniform vec3 uKey, uMoonDir, uMoonC, uInk, uMistC, uDeepC;
uniform float uDark, uR, uSeaY;
uniform vec2 uC;
uniform vec4 uPk[5];
varying vec3 vW;
void main() {
  vec2 p = vW.xz;
  vec2 q = p * vec2(0.1, 0.17) + vec2(uTime * 0.01, uTime * 0.003);
  float n = fbm2(q) * 0.7 + fbm2(q * 2.7 + 4.0) * 0.3;
  float nx = fbm2(q + vec2(0.05, 0.0)), nz = fbm2(q + vec2(0.0, 0.05));
  vec3 N = normalize(vec3((n - nx) * 14.0, 1.0, (n - nz) * 14.0));
  float lit = smoothstep(-0.2, 0.8, dot(N, normalize(vec3(uKey.x, 0.4, uKey.z))));
  float puff = smoothstep(0.3, 0.75, n);
  vec3 col = mix(uDeepC, uMistC, smoothstep(0.05, 0.95, 0.12 + 0.5 * puff + 0.45 * lit));
  // long shadows of the peaks laid across the cloud, away from the low moon
  vec2 sd = -normalize(uKey.xz);
  vec2 sp = vec2(-sd.y, sd.x);
  float sh = 0.0;
  for (int i = 0; i < 5; i++) {
    vec4 k = uPk[i];
    if (k.w <= uSeaY + 0.05) continue;
    vec2 d = p - k.xy;
    float a = dot(d, sd), b = dot(d, sp);
    float len = (k.w - uSeaY) * 3.2;
    float w = k.z * 1.5 * (1.0 - 0.7 * clamp(a / len, 0.0, 1.0));
    float s1 = (1.0 - smoothstep(0.45, 1.05, abs(b) / max(w, 0.05) + (n - 0.5) * 0.9)) * smoothstep(-k.z * 0.5, k.z * 0.6, a) * (1.0 - smoothstep(len * 0.35, len, a));
    sh = max(sh, s1 * (0.75 + 0.25 * puff));
  }
  // the moon's sheen on the far billows
  vec3 V = normalize(vW - cameraPosition);
  float m = max(dot(normalize(V.xz), normalize(uMoonDir.xz)), 0.0);
  col = mix(col, uMoonC, pow(m, 20.0) * puff * lit * (0.15 + 0.3 * uDark) * smoothstep(6.0, 26.0, distance(p, cameraPosition.xz)));
  // haze by distance only: the cloud is the low mist itself, it must not wash itself out
  col = haze(col, vec3(vW.x, uMist.x + 1.0, vW.z));
  // the shadows lie on top, thinning into the distance
  float far = smoothstep(uFog.x, uFog.y, distance(vW, cameraPosition));
  col = mix(col, mix(uDeepC, uInk, 0.5 - 0.2 * uDark), sh * (0.78 + 0.1 * uDark) * (1.0 - 0.5 * far));
  col += (h21(gl_FragCoord.xy) - 0.5) * 0.025;
  float rim = length(p - uC) / uR + (n - 0.5) * 0.3;
  gl_FragColor = vec4(col, 1.0 - smoothstep(0.7, 1.0, rim));
  #include <colorspace_fragment>
}`
const PEAK_VERT = /* glsl */ `
varying vec3 vW;
varying vec3 vN;
varying vec3 vO;
void main() {
  vO = position;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`
/**
 * A mountain painted in ink: three washes with a brushed terminator, ink gathering toward the summit, long texture strokes
 * (cun) running down the slopes, moss dots (dian) on the ledges, the moon's rim on its side, the foot dissolving into cloud.
 */
const PEAK_FRAG = /* glsl */ `
${inkGlsl.noise}
${inkGlsl.haze}
uniform vec3 uKey, uMoonDir, uMoonC, uInk, uLampC, uLo, uMid, uHi, uMoss, uCloudC;
uniform float uTop, uSeed, uHot, uRim, uInkK, uSeaY;
varying vec3 vW;
varying vec3 vN;
varying vec3 vO;
void main() {
  vec3 n = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  float wob = (fbm3(vO * 0.8 + uSeed) - 0.5) * 0.75;
  float nl = dot(n, uKey);
  float lit = smoothstep(-0.12, 0.24, nl + wob);
  float hi = smoothstep(0.5, 0.85, nl + wob * 0.6);
  vec3 col = mix(uLo, uMid, lit);
  col = mix(col, uHi, hi * 0.85);
  // ink gathers toward the summit, on the shadowed side most
  float hk = clamp((vW.y - uSeaY) / max(uTop - uSeaY, 0.1), 0.0, 1.0);
  col = mix(col, mix(uLo, uInk, 0.5), smoothstep(0.45, 1.0, hk) * (1.0 - 0.7 * lit) * 0.42 * uInkK);
  // texture strokes: long dry strokes down the slopes, heavier in shadow, a few catching light on the lit face
  float az = atan(vO.z, vO.x);
  float c1 = n2(vec2(az * 8.0 + uSeed, vO.y * 0.7 + n2(vec2(az * 2.5, vO.y * 0.4)) * 2.2));
  float c2 = n2(vec2(az * 21.0 + uSeed * 1.7, vO.y * 1.8 + c1));
  float cun = smoothstep(0.6, 0.8, c1) * 0.6 + smoothstep(0.68, 0.86, c2) * 0.45;
  col = mix(col, uInk, cun * (0.62 - 0.42 * lit) * 0.55 * uInkK);
  // the ledges facing up: moss, and dark moss dots along them
  float up = smoothstep(0.3, 0.75, n.y + (fbm3(vO * 1.6 + uSeed) - 0.5) * 0.9);
  float dots = smoothstep(0.77, 0.83, n3(vO * 9.0 + uSeed)) * smoothstep(0.15, 0.55, up);
  col = mix(col, uMoss, up * 0.32);
  col = mix(col, mix(uMoss, uInk, 0.55), dots * 0.9);
  // the moon's rim, the warm hover
  float fres = pow(1.0 - max(dot(n, V), 0.0), 2.4);
  col = mix(col, uMoonC, fres * smoothstep(-0.3, 0.6, dot(n, uMoonDir)) * uRim);
  col = mix(col, uLampC, uHot * (0.05 + 0.3 * fres));
  // the foot goes into the cloud: it dissolves upward in ragged wisps, so only the crown stands clear
  float foot = 1.0 - smoothstep(uSeaY - 0.4, uSeaY + 1.7, vW.y + (fbm3(vW * vec3(0.7, 1.4, 0.7) + uSeed) - 0.5) * 1.6);
  col = mix(col, uCloudC, foot);
  col += (h21(gl_FragCoord.xy) - 0.5) * 0.03;
  gl_FragColor = vec4(haze(col, vW), 1.0);
  #include <colorspace_fragment>
}`
const BILL_VERT = /* glsl */ `
uniform vec2 uSize;
varying vec2 vUv;
varying vec3 vW;
void main() {
  vUv = uv;
  vW = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * uSize;
  gl_Position = projectionMatrix * mv;
}`
/** a rolling cloud: a soft fbm billow, lit along its top edge, shaded underneath */
const CLOUD_FRAG = /* glsl */ `
${inkGlsl.noise}
${inkGlsl.haze}
uniform vec3 uMistC, uDeepC;
uniform float uK, uSeed;
varying vec2 vUv;
varying vec3 vW;
void main() {
  vec2 p = vUv - 0.5;
  float n = fbm2(vec2(vUv.x * 3.4 + uSeed, vUv.y * 2.2 + uSeed * 0.7 + uTime * 0.015));
  // billows: a row of rounded heads along the top, a flat soft belly
  float heads = 0.12 * sin(vUv.x * 9.0 + uSeed * 3.0) + (n - 0.5) * 0.5;
  float shape = (1.0 - smoothstep(0.08, 0.5, length(p * vec2(1.0, 2.0)) + (n - 0.5) * 0.55)) * smoothstep(-0.02, 0.16, 0.28 + heads * 0.4 - p.y);
  float top = smoothstep(-0.15, 0.22, p.y + (n - 0.5) * 0.35);
  vec3 col = mix(uDeepC, uMistC, 0.4 + 0.6 * top);
  gl_FragColor = vec4(haze(col, vW), shape * uK);
  #include <colorspace_fragment>
}`
/** a pine pad as an ink mass: domed on top, flat and dark below, needle tufts along its edge, the moon on its upper rim */
const PAD_FRAG = /* glsl */ `
${inkGlsl.noise}
${inkGlsl.haze}
uniform vec3 uDarkC, uMidC, uRimC;
uniform float uSeed, uRim;
varying vec2 vUv;
varying vec3 vW;
void main() {
  vec2 p = vUv - 0.5;
  float y = p.y + 0.08;
  float e = length(vec2(p.x / 0.47, y / (y > 0.0 ? 0.36 : 0.13)));
  float ang = atan(y, p.x);
  float tuft = n2(vec2(ang * 11.0 + uSeed, uSeed)) * 0.6 + n2(vec2(ang * 31.0 + uSeed * 2.0, 3.0)) * 0.4;
  vec2 q = vec2(p.x, p.y * 0.42);
  e += (tuft - 0.5) * 0.24 + (fbm2(q * 7.0 + uSeed) - 0.5) * 0.3;
  float mask = 1.0 - smoothstep(0.86, 1.0, e);
  if (mask < 0.01) discard;
  float v = clamp(y / 0.36, 0.0, 1.0);
  vec3 col = mix(uDarkC, uMidC, smoothstep(0.05, 0.85, v + (fbm2(q * 9.0 + uSeed * 1.3) - 0.5) * 0.5));
  // dry needle strokes, a dark flat belly, an ink edge
  float s = n2(vec2((q.x * 1.4 + q.y) * 46.0 + uSeed, q.y * 30.0));
  col = mix(col, uDarkC, smoothstep(0.6, 0.8, s) * 0.55);
  col = mix(col, uDarkC, (1.0 - smoothstep(-0.04, 0.12, y)) * 0.6);
  col = mix(col, uDarkC, smoothstep(0.7, 0.92, e) * 0.5);
  // the moon from the upper right lights its crest
  float crest = smoothstep(0.62, 0.86, e) * (1.0 - smoothstep(0.9, 1.0, e)) * smoothstep(0.0, 0.3, p.x * 0.6 + y);
  col = mix(col, uRimC, crest * uRim);
  gl_FragColor = vec4(haze(col, vW), mask * 0.97);
  #include <colorspace_fragment>
}`
/** a warm pool of light on the rock round the lantern's foot (verified only = lit) */
const POOL_FRAG = /* glsl */ `
uniform vec3 uC;
uniform float uK;
varying vec2 vUv;
varying vec3 vW;
void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float d = length(p * vec2(1.0, 2.4));
  gl_FragColor = vec4(uC, uK * exp(-d * d * 2.6) * (1.0 - smoothstep(0.85, 1.0, d)));
  #include <colorspace_fragment>
}`
/** the date thread: dry ink, fading into the far haze */
const LINE_FRAG = /* glsl */ `
${inkGlsl.noise}
${inkGlsl.haze}
uniform vec3 uInk;
uniform float uK;
varying vec3 vW;
void main() {
  gl_FragColor = vec4(haze(uInk, vW), uK);
  #include <colorspace_fragment>
}`
const FLY_VERT = /* glsl */ `
attribute float aPh;
uniform float uTime, uPx;
varying float vA;
void main() {
  vec3 p = position + vec3(sin(uTime * 0.31 + aPh * 6.0), sin(uTime * 0.23 + aPh * 9.0) * 0.6, cos(uTime * 0.27 + aPh * 4.0)) * 0.25;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vA = 0.25 + 0.75 * pow(0.5 + 0.5 * sin(uTime * (0.6 + aPh) + aPh * 30.0), 3.0);
  gl_PointSize = uPx / -mv.z;
  gl_Position = projectionMatrix * mv;
}`
const FLY_FRAG = /* glsl */ `
uniform vec3 uC;
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  gl_FragColor = vec4(uC, vA * exp(-d * d * 4.0) * (1.0 - smoothstep(0.8, 1.0, d)));
  #include <colorspace_fragment>
}`

/**
 * ★ Scene 1 · the news peaks (ORBIT, 3D). From a rock ridge above a sea of cloud, five Huangshan spires — one per news
 * stele, in date order left to right — rise out of the cloud on an arc round the eye, so from here they are all the same
 * height (no ranking); the low moon on the right lays their shadows long across the cloud; drag to look around. Touch a
 * peak: the camera comes in, its low stele slab turns and a rubbing of its back (what · why · source · who confirmed) hangs
 * beside it on pale paper. Then the lantern on the ridge (audit v3 19-1, the scene's point): lit, the cloud rises and the
 * peaks only their makers vouch for sink into it; where someone outside checked something (Mozilla's fixes, open weights)
 * a crag stays above it. The insight comes with the light. Guide: a dot on every unread stele, "read n/5", then the lantern.
 */
export function peaksScene(ctx: SceneCtx) {
  const items = NEWS.items.filter((it) => it.tags.some((t) => raw.newsTags.includes(t))).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5)
  const W0 = ctx.art.clientWidth || 1, H0 = ctx.art.clientHeight || 1
  const asp = W0 / H0
  const tall = asp < 1
  const tv = Math.tan((32 * Math.PI) / 360), th = tv * asp
  // the eye stands D from the turning point T, looking down over the cloud sea; the kit tips a tall frame 0.13 further down
  const D = 12
  const pitch0 = tall ? 0.04 : 0.155, tip = tall ? 0.13 : 0
  const T: V3 = [0, tall ? 1.5 : 1.45, 0]
  const camY = T[1] + D * Math.sin(pitch0 + tip), camZ = T[2] + D * Math.cos(pitch0 + tip)
  const half = Math.atan(th)
  const A = half * (tall ? 0.76 : 0.56) // the five peaks span ± A round the eye
  const Rp = 16
  const moonAz = tall ? half * 0.78 : half * 0.84, moonEl = tall ? 0.075 : 0.11
  const n = items.length
  const base = -6.6 // the spires' feet, far under the cloud: only their upper 40 % stands clear of it

  // palette of this scene's own shaders (read on mount and on theme change, compared before redrawing)
  const pal = {
    mist: new THREE.Color(), deep: new THREE.Color(), cloud: new THREE.Color(), fly: new THREE.Color(), lo: new THREE.Color(), mid: new THREE.Color(), hi: new THREE.Color(), moss: new THREE.Color(),
    padDark: new THREE.Color(), padMid: new THREE.Color(), padRim: new THREE.Color(), lamp: new THREE.Color(),
    dark: { value: 0 }, rim: { value: 1 }, inkK: { value: 1 }, padRimK: { value: 0.5 },
  }
  let palKey = ''
  const readPal = () => {
    const cs = getComputedStyle(document.documentElement)
    const v = (k: string) => cs.getPropertyValue(k).trim()
    const key = [v('--paper'), v('--mist'), v('--water'), v('--firefly'), v('--rock-lo'), v('--rock-mid'), v('--rock-hi'), v('--moss-b'), v('--moon'), v('--lantern')].join()
    if (key === palKey) return false
    palKey = key
    const dark = document.documentElement.dataset.theme === 'dark'
    const col = (k: string) => new THREE.Color().setStyle(v(k), SRGB)
    const paper = col('--paper'), mist = col('--mist'), water = col('--water'), wash = col('--wash'), mb = col('--moss-b'), ma = col('--moss-a')
    pal.mist.copy(dark ? paper.clone().lerp(mist, 0.42) : mist)
    pal.deep.copy(dark ? paper.clone().lerp(water, 0.35) : paper.clone().lerp(water, 0.5))
    pal.cloud.copy(pal.mist).lerp(pal.deep, dark ? 0.35 : 0.2)
    pal.fly.setStyle(v('--firefly'), SRGB)
    // by day the peaks are ink washes, not snow: every tone a step down toward the ink
    pal.lo.setStyle(v('--rock-lo'), SRGB).lerp(wash, dark ? 0 : 0.22)
    pal.mid.setStyle(v('--rock-mid'), SRGB).lerp(pal.lo, dark ? 0 : 0.35)
    pal.hi.setStyle(v('--rock-hi'), SRGB).lerp(pal.mid, dark ? 0 : 0.4)
    pal.moss.copy(mb)
    // the pine: ink washed with moss, never a game-asset green
    pal.padDark.copy(wash).lerp(mb, dark ? 0.45 : 0.22)
    pal.padMid.copy(mb).lerp(wash, dark ? 0.1 : 0.42).lerp(ma, dark ? 0.25 : 0)
    pal.padRim.copy(dark ? col('--moon') : mist)
    pal.padRimK.value = dark ? 0.75 : 0.5
    pal.lamp.setStyle(v('--lantern'), SRGB)
    pal.dark.value = dark ? 1 : 0
    pal.rim.value = dark ? 1.1 : 0.35
    pal.inkK.value = dark ? 0.7 : 1
    return true
  }
  readPal()

  // DOM over the view: the board's date and the ranges not yet charted (wide: low on the cloud; tall: inside the rubbing)
  const eyebrow = h('p', { class: 'p2-eyebrow' }, fill(L.newsAsOf, { date: viDate(NEWS.asOf) }))
  const head = h('div', { class: 't19p-head' },
    eyebrow,
    h('p', { class: 't19p-sky' }, P.sky),
    tall ? h('p', { class: 't19p-order' }, P.order) : null)
  const rub = h('div', { class: 't19p-rub', role: 'region', tabindex: '-1' })
  rub.hidden = true
  const wrap = h('div', { class: `t19p${tall ? ' tall' : ''}` }, head)
  if (tall) wrap.append(rub)
  ctx.art.append(wrap)
  ctx.prompt(P.prompt)
  // H1 a dot on every unread stele (riding its label), H4 "read n/5" carved under the date, the lantern's dot after the first
  const g = guide(ctx)
  const read = new Set<number>()
  const dots: { done(): void }[] = []
  let lampDot: { done(): void } | null = null
  const count = g.count(P.count, items.length, () => {
    const a = ctx.art.getBoundingClientRect(), b = eyebrow.getBoundingClientRect()
    return [b.left - a.left + b.width / 2, b.bottom - a.top + 13]
  })
  // the rubbing is paper on the view: a press on it is not a drag of the camera, keys in it do not turn the view
  rub.addEventListener('pointerdown', (e) => e.stopPropagation())
  rub.addEventListener('keydown', (e) => e.key !== 'Escape' && e.stopPropagation())

  let kit: InkKit | null = null
  let open = -1
  let turned = false
  let only = false
  let lit = false // the lantern has been lit once: the insight is out
  const groups: THREE.Group[] = []
  const steles: THREE.Mesh[] = []
  const peakMats: THREE.ShaderMaterial[] = []
  const tags: HTMLElement[] = []
  const hot: boolean[] = []
  const taps: HTMLButtonElement[] = []
  const sink = items.map(() => ({ y: 0, to: 0 }))
  const pk = Array.from({ length: 5 }, () => new THREE.Vector4())
  const pkH: number[] = []
  const recolor: (() => void)[] = []
  let lantern: (THREE.Group & { lamp?: { set(k: number): void } }) | null = null
  let lampBtn: HTMLButtonElement | null = null
  let lampTag: HTMLElement | null = null
  let poolMat: THREE.ShaderMaterial | null = null
  let none: HTMLElement | null = null
  let sea: THREE.Mesh | null = null
  let thread: THREE.Mesh | null = null
  let rubAt: THREE.Mesh | null = null
  const seaY = { y: 0, to: 0, u: { value: 0 } }

  ctx.onCleanup(onPrefs(() => {
    if (readPal()) recolor.forEach((f) => f()), kit?.render()
  }))

  const turnStele = (i: number, to: number) => {
    const m = steles[i]
    const from = m.rotation.y
    let u = 0
    kit?.animate((dt) => {
      u = Math.min(1, u + dt / 0.9)
      const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2
      m.rotation.y = from + (to - from) * e
      return u < 1
    })
  }

  /** a torn paper edge: a jagged polygon round the sheet, different for every stele */
  const torn = (seed: number) => {
    const r = rng(seed)
    const pts: string[] = []
    const edge = (n: number, f: (t: number, j: number) => string) => {
      for (let k = 0; k < n; k++) pts.push(f(k / n, (r() - 0.5) * 2))
    }
    edge(24, (t, j) => `${(t * 100).toFixed(1)}% ${(0.7 + j * 0.7).toFixed(2)}%`)
    edge(30, (t, j) => `${(99.2 + j * 0.8).toFixed(2)}% ${(t * 100).toFixed(1)}%`)
    edge(24, (t, j) => `${(100 - t * 100).toFixed(1)}% ${(99.2 + j * 0.8).toFixed(2)}%`)
    edge(30, (t, j) => `${(0.8 + j * 0.8).toFixed(2)}% ${(100 - t * 100).toFixed(1)}%`)
    return `polygon(${pts.join(',')})`
  }

  function show(i: number) {
    const k = kit
    if (!k) return
    if (open >= 0 && open !== i) turnStele(open, steles[open].userData.face)
    open = i
    const it = items[i]
    const top = steles[i].getWorldPosition(new THREE.Vector3())
    // the eye walks a few steps toward the peak and turns to it: the stele off-centre, the rubbing on its side away from the
    // moon (wide), or the stele high in the frame above the rubbing (tall). Walking up to it, not flying in among the peaks.
    const left = i >= Math.ceil(n / 2) // the right-hand steles stand near the moon: their rubbing hangs on their left
    const ex = top.x, ez = top.z - camZ
    const dist = Math.hypot(ex, ez)
    const walk = tall ? 4.5 : 5.5
    const C = new THREE.Vector3((ex / dist) * walk, camY + 0.1, camZ + (ez / dist) * walk)
    const yawS = Math.atan2(-(top.x - C.x), -(top.z - C.z))
    const yaw = yawS + (tall ? 0 : left ? 0.13 : -0.13)
    // pitch as the kit will apply it (a tall frame adds its tip)
    const pe = tall ? 0.08 : 0.07
    const tgt: V3 = [C.x - Math.sin(yaw) * Math.cos(pe) * D, C.y - Math.sin(pe) * D, C.z - Math.cos(yaw) * Math.cos(pe) * D]
    k.dolly(1)
    k.fly(tgt, yaw, pe - tip, 1.3)
    turnStele(i, steles[i].userData.face + Math.PI)
    const m = markOf(toFact(it))
    const old = isOld(it.date)
    const back = h('button', { class: 't19p-rub-back', type: 'button', 'aria-label': L.newsFlipBack, title: L.newsFlipBack })
    back.addEventListener('click', close)
    rub.setAttribute('aria-label', it.title)
    rub.replaceChildren(
      h('div', { class: 't19p-rub-sheet', style: `clip-path:${torn(1901 + i * 17)}` },
        back,
        h('p', { class: 't19p-rub-date' }, viDate(it.date), m ? markGlyph(m, 'cmark-glyph t19p-rub-mark') : null),
        h('p', { class: 't19p-rub-title' }, it.title),
        h('p', { class: 'p2-eyebrow' }, L.newsWhat),
        ctx.fact(toFact(it), 'p', 't19p-rub-what'),
        h('p', { class: 'p2-eyebrow' }, L.newsWhy),
        h('p', { class: 't19p-rub-why' }, it.why),
        h('p', { class: 't19p-rub-meta' }, it.verifiedBy ? fill(L.independent, { who: it.verifiedBy }) : it.claimBy ? `${fill(L.vendorClaim, { who: it.claimBy })} · ${L.newsNotVerified}` : ''),
        old ? h('p', { class: 't19p-rub-old' }, L.newsOld) : '',
        h('span', { class: 't19p-rub-seal', 'aria-hidden': 'true' })))
    rub.classList.toggle('side-l', left)
    if (rubAt && !tall) {
      rubAt.position.set(top.x, top.y + 0.18, top.z)
      k.render()
    }
    rub.hidden = false
    wrap.classList.add('reading')
    rub.classList.remove('in')
    void rub.offsetWidth
    rub.classList.add('in')
    taps[i]?.setAttribute('aria-expanded', 'true')
    back.focus({ preventScroll: true })
    ctx.chime('soft')
    dots[i]?.done()
    read.add(i)
    count.set(read.size)
    if (!turned) {
      turned = true
      if (!lit) ctx.prompt(P.steps[0])
      const at = lampTag?.querySelector<HTMLElement>('.t19p-lamp-dot')
      if (at && !lit) lampDot = g.dot(at, { dir: [0, -1] })
    }
  }
  function close() {
    if (open < 0 || !kit) return
    const i = open
    open = -1
    turnStele(i, steles[i].userData.face)
    rub.hidden = true
    wrap.classList.remove('reading')
    taps[i]?.setAttribute('aria-expanded', 'false')
    kit.dolly(1)
    kit.fly(T, 0, pitch0, 1.2)
    taps[i]?.focus({ preventScroll: true })
  }
  function setOnly(on: boolean) {
    only = on
    wrap.classList.toggle('only', on)
    lampBtn?.setAttribute('aria-pressed', String(on))
    lampTag?.classList.toggle('on', on)
    lantern?.lamp?.set(on ? 1 : 0.38)
    if (open >= 0 && on && !kept(items[open])) close()
    items.forEach((it, i) => {
      const hide = on && !kept(it)
      // checked by someone outside: the peak goes down too (its makers' numbers sink), but a crag stays clear of the cloud
      const crag = on && !verified(it) && it.id in CHECKED
      sink[i].to = hide ? -(pkH[i] + 1.4) : crag ? -Math.max(0, pkH[i] - 3.1) : 0
      tags[i]?.classList.toggle('sunk', hide)
      if (taps[i]) taps[i].disabled = hide
    })
    seaY.to = on ? 0.7 : 0
    none?.classList.toggle('on', on)
    ctx.chime(on ? 'soft' : 'tap')
    if (on && !lit) {
      lit = true
      lampDot?.done()
      ctx.insight(P.insight as Fact, P.detail)
      ctx.prompt(P.steps[1])
    }
    const pool = poolMat
    const poolTo = on ? 1 : 0
    kit?.animate((dt) => {
      let moving = false
      let deepest = 0
      const f = 1 - Math.exp(-dt * 2.2)
      for (let i = 0; i < sink.length; i++) {
        const s = sink[i]
        s.y += (s.to - s.y) * f
        if (Math.abs(s.to - s.y) > 0.01) moving = true
        else s.y = s.to
        groups[i].position.y = s.y
        pk[i].w = pkH[i] + s.y
        deepest = Math.min(deepest, s.y)
      }
      // the date thread goes down with the deepest peak
      if (thread) thread.position.y = deepest
      seaY.y += (seaY.to - seaY.y) * f
      if (Math.abs(seaY.to - seaY.y) > 0.005) moving = true
      if (sea) sea.position.y = seaY.y
      seaY.u.value = seaY.y
      if (kit) kit.uniforms.uMist.value.x = 2.2 + seaY.y * 1.6
      if (pool) {
        const k0 = pool.uniforms.uK.value as number
        const k1 = k0 + (poolTo * (pal.dark.value ? 0.85 : 0.6) - k0) * f
        pool.uniforms.uK.value = k1
        if (Math.abs(k1 - poolTo * (pal.dark.value ? 0.85 : 0.6)) > 0.01) moving = true
      }
      return moving
    })
  }

  const handle = inkStage(ctx, wrap, {
    label: P.art,
    hint: P.hint,
    fov: 32,
    dpr: [1.5, 1],
    gyro: true,
    view: { yaw: 0, pitch: pitch0, yawRange: tall ? [-0.42, 0.42] : [-0.7, 0.7], pitchRange: [tall ? -0.12 : 0.06, 0.42 - tip], target: T, fit: [(D * th) / (tall ? 0.56 : 1), 0.01], shift: tall ? 0.02 : 0.03, home: true, zoomRange: [0.55, 1.15] },
    fallback: (host) => {
      // without WebGL: the stele path of Part 2's news board (flip, verified only), with this scene's words
      newsStones({ label: P.label, tags: raw.newsTags, prompt: P.prompt, insight: P.insight as Fact, detail: P.detail }).mount({ ...ctx, art: host })
      host.querySelector('.p2n-path')?.setAttribute('aria-label', P.group)
      head.hidden = true
      count.done()
      return () => {}
    },
  }, function* (k) {
    kit = k
    const low = k.low
    k.uniforms.uKey.value.set(0.7, 0.36, -0.6).normalize()
    k.uniforms.uMist.value.set(2.2, 0.85)
    k.uniforms.uFog.value.set(13, 52)
    const md = [Math.sin(moonAz) * Math.cos(moonEl), Math.sin(moonEl), -Math.cos(moonAz) * Math.cos(moonEl)] as V3
    const back = k.backdrop({ moon: md, seed: 19, mist: 0, moonRise: 4.5 })
    // a big rising moon: the toolkit's disc, drawn half as large again
    const mq = back.children[0] as THREE.Mesh
    ;(mq.material as THREE.ShaderMaterial).uniforms.uSize.value.multiplyScalar(1.45)
    yield

    // ── the sea of cloud in the valley
    const seaR = 34
    const seaMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: SEA_FRAG, defines: { OCT: low ? 2 : 4 }, transparent: true,
      uniforms: { ...k.uniforms, uMistC: { value: pal.mist }, uDeepC: { value: pal.deep }, uDark: pal.dark, uR: { value: seaR }, uC: { value: new THREE.Vector2(0, camZ - Rp * 0.9) }, uPk: { value: pk }, uSeaY: seaY.u },
    })
    sea = new THREE.Mesh(new THREE.CircleGeometry(seaR, 64), seaMat)
    sea.rotation.x = -Math.PI / 2
    sea.position.set(0, 0, camZ - Rp * 0.9)
    sea.renderOrder = -6
    sea.raycast = () => {}
    k.root.add(sea)
    yield

    // ── the ridge the eye stands on: crags along an arc round the eye, cut by the bottom of the frame, rising at the sides
    const r = rng(1907)
    const ridgeD = 6.4 // from the eye
    for (let j = -8; j <= 8; j++) {
      const a = j * (half * 0.15) + (r() - 0.5) * 0.05
      const dd = ridgeD - r() * 1.1 + (Math.abs(j) % 2) * 0.9
      const rise = smooth(half * 0.35, half * 1.05, Math.abs(a))
      const hh = 1.6 + r() * 0.9 + rise * 0.8
      const gg = k.rock({ at: [Math.sin(a) * dd, camZ - Math.cos(a) * dd], w: 1.9 + r() * 1.6 + rise, h: hh, d: 2 + r() * 1.2, seed: 30 + j * 7, moss: 0.45, ring: false })
      gg.position.y = camY - (tall ? 2.85 : 2.3) + rise * (tall ? 1.15 : 0.95) - hh
    }
    yield
    const side = (az: number, dist: number): [number, number] => [Math.sin(az) * dist, camZ - Math.cos(az) * dist]
    const la = half * (tall ? 0.6 : 0.86)
    lantern = k.toro({ at: side(la, 7.2), h: tall ? 0.8 : 0.9, lit: 0.38, rotY: 0.5 })
    lantern.position.y = camY - (tall ? 2.05 : 1.85)
    k.rock({ at: side(la + 0.02, 7.5), w: 1.9, h: 1.3, seed: 77, moss: 0.45, ring: false }).position.y = lantern.position.y - 1.25
    // the warm pool the lit lantern throws on the rock (verified only)
    poolMat = new THREE.ShaderMaterial({ vertexShader: BILL_VERT, fragmentShader: POOL_FRAG, transparent: true, depthWrite: false, uniforms: { uSize: { value: new THREE.Vector2(2.6, 1.1) }, uC: { value: pal.lamp }, uK: { value: 0 } } })
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), poolMat)
    const [lx, lz] = side(la, 7.2)
    pool.position.set(lx, lantern.position.y + 0.05, lz + 0.25)
    pool.renderOrder = 9
    pool.raycast = () => {}
    k.root.add(pool)
    yield

    // ── the pine: its trunk cut by the left edge of the frame, short boughs reaching in, pads of flat ink with the moon on them
    {
      const pa = -half * (tall ? 1.02 : 1.0)
      const [px, pz] = side(pa, tall ? 6.6 : 7.4)
      const Hp = tall ? 1.9 : 2.5
      const g = new THREE.Group()
      g.position.set(px, camY - (tall ? 2.55 : 2.3), pz)
      const fwd = new THREE.Vector3(Math.cos(pa), 0, Math.sin(pa)) // across the view, into the frame
      const at = (x: number, y: number, z = 0) => new THREE.Vector3().addScaledVector(fwd, x * Hp).add(new THREE.Vector3(0, y * Hp, z * Hp))
      const trunk = [at(-0.2, 0), at(-0.1, 0.3), at(-0.12, 0.55, 0.04), at(0.02, 0.78), at(0.2, 0.92)]
      const wood = [taperTube(trunk, Hp * 0.05, Hp * 0.016, low ? 16 : 24, low ? 6 : 8)]
      const curve = new THREE.CatmullRomCurve3(trunk)
      const ends: [THREE.Vector3, number][] = [[trunk[4].clone().add(at(0.04, 0.02)), 1]]
      const rp = rng(1911)
      const boughs = tall ? [[0.62, 0.34, 0.06]] : [[0.5, 0.42, 0.02], [0.66, 0.36, 0.1], [0.82, 0.26, 0.04]]
      boughs.forEach(([u, len, lift]) => {
        const s0 = curve.getPointAt(u)
        const e = s0.clone().addScaledVector(fwd, len * Hp * (0.85 + rp() * 0.3)).add(new THREE.Vector3(0, lift * Hp, (rp() - 0.5) * 0.3))
        const m = s0.clone().lerp(e, 0.5).add(new THREE.Vector3(0, -0.04 * Hp, 0))
        wood.push(taperTube([s0, m, e], Hp * 0.016, Hp * 0.006, 8, 5))
        ends.push([e, 0.6 + rp() * 0.25])
      })
      k.mesh(mergeGeometries(wood)!, k.ink('bark', { rim: 1.3 }), { parent: g })
      wood.forEach((x) => x.dispose())
      ends.forEach(([e, s], j) => {
        const w = Hp * 0.46 * s
        const mat = new THREE.ShaderMaterial({
          vertexShader: BILL_VERT, fragmentShader: PAD_FRAG, defines: { OCT: low ? 2 : 3 }, transparent: true, depthWrite: false,
          uniforms: { ...k.uniforms, uSize: { value: new THREE.Vector2(w, w * 0.42) }, uSeed: { value: 3 + j * 7.7 }, uDarkC: { value: pal.padDark }, uMidC: { value: pal.padMid }, uRimC: { value: pal.padRim }, uRim: pal.padRimK },
        })
        const q = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat)
        q.position.copy(e).add(new THREE.Vector3(0, w * 0.06, 0.05))
        q.renderOrder = 9 + j
        g.add(q)
      })
      g.traverse((x) => void (x.raycast = () => {}))
      k.root.add(g)
    }
    yield

    // ── five spires, one per stele, in date order left → right, on an arc round the eye: all equal at first sight
    const tipUp = tall ? 0.004 : 0.035
    for (let i = 0; i < n; i++) {
      const it = items[i]
      const a = n > 1 ? -A + (2 * A * i) / (n - 1) : 0
      const far = [1, 1.3, 1.06, 1.38, 1.12][i % 5]
      const R = Rp * far
      const x = Math.sin(a) * R, z = camZ - Math.cos(a) * R
      const top = camY + tipUp * R // the same height above the eye, seen from here
      const rad = (tall ? 1.35 : 1.75) * far * [1, 0.9, 1.1, 0.92, 1.04][i % 5]
      const ms = massifGeo(190 + i * 13, rad, base, top, low)
      // the crown (where the stele sits) stands on the arc, wherever the spire leans
      const g = new THREE.Group()
      g.position.set(x - ms.tip[0], 0, z - ms.tip[1])
      g.userData.a = a
      k.root.add(g)
      const pm = new THREE.ShaderMaterial({
        vertexShader: PEAK_VERT, fragmentShader: PEAK_FRAG, defines: { OCT: low ? 2 : 4 },
        uniforms: { ...k.uniforms, uLo: { value: pal.lo }, uMid: { value: pal.mid }, uHi: { value: pal.hi }, uMoss: { value: pal.moss }, uCloudC: { value: pal.cloud }, uTop: { value: top }, uSeed: { value: i * 7.3 }, uHot: { value: 0 }, uRim: pal.rim, uInkK: pal.inkK, uSeaY: seaY.u },
      })
      const peak = k.mesh(ms.geo, pm, { parent: g })
      peak.raycast = () => {}
      peakMats.push(pm)
      // what the pointer and the keyboard take hold of: the stele and a plain cone round the part above the cloud
      const tap = new THREE.Group()
      g.add(tap)
      const proxy = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.62, top, 8, 1, true))
      proxy.position.set(ms.tip[0] * 0.5, top / 2, ms.tip[1] * 0.5)
      proxy.visible = false
      tap.add(proxy)
      // the stele: a low slab set into the crown, leaning with it, turned to the eye
      const sm = k.mesh(slabGeo(0.5, 0.3, 0.11), k.ink('step', { moss: isOld(it.date) ? 0.85 : 0.1, rim: 1.6 }), { parent: tap, at: [ms.tip[0], top - 0.17, ms.tip[1]], outline: !low })
      sm.userData.face = Math.atan2(-x, camZ - z)
      sm.rotation.y = sm.userData.face
      sm.rotation.z = clamp(-ms.tip[0] / rad, -0.18, 0.18) + (i % 2 ? 0.05 : -0.05)
      g.userData.tap = tap
      groups.push(g)
      steles.push(sm)
      pk[i].set(g.position.x, g.position.z, rad * 0.62, top)
      pkH.push(top)
      yield
    }
    // rolling billows hugging every foot, so the spires stand in the cloud, not on it
    const nf = 1
    const billows: THREE.ShaderMaterial[] = []
    const billow = (x: number, y: number, z: number, w: number, hk: number, kk: number, seed: number) => {
      const mat = new THREE.ShaderMaterial({
        vertexShader: BILL_VERT, fragmentShader: CLOUD_FRAG, defines: { OCT: low ? 2 : 3 }, transparent: true, depthWrite: false,
        uniforms: { ...k.uniforms, uSize: { value: new THREE.Vector2(w, w * hk) }, uMistC: { value: pal.mist }, uDeepC: { value: pal.deep }, uK: { value: kk }, uSeed: { value: seed } },
      })
      billows.push(mat)
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat)
      m.position.set(x, y, z)
      m.renderOrder = 5
      m.raycast = () => {}
      k.root.add(m)
      return m
    }
    groups.forEach((g, i) => {
      const rr = rng(400 + i)
      // one billow wrapping the foot, a little behind it, so the shadow in front stays on open cloud
      const w = pk[i].z * (2.2 + rr() * 0.8)
      billow(g.position.x + pk[i].z * (0.3 + rr() * 0.4), 0.3 + rr() * 0.3, g.position.z - pk[i].z * 0.3, w, 0.3, 0.9, rr() * 40)
    })
    yield

    // ── what each stele says, cut into its face: one atlas (decorative carving; the words are in the taps' aria and the labels)
    const AW = low ? 256 : 512, CH = AW / 2, AH = CH * 5
    const atlas = h('canvas')
    atlas.width = AW
    atlas.height = AH
    const tex = new THREE.CanvasTexture(atlas)
    tex.colorSpace = SRGB
    const carve = () => {
      const g = atlas.getContext('2d')!
      const cs = getComputedStyle(document.documentElement)
      const v = (k: string) => cs.getPropertyValue(k).trim()
      const serif = v('--serif') || 'serif'
      g.clearRect(0, 0, AW, AH)
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      const cut = (text: string, x: number, y: number) => {
        // a groove: lit on its lower lip, shadowed in its upper wall
        g.fillStyle = v('--rock-hi')
        g.globalAlpha = 0.55
        g.fillText(text, x, y + 2)
        g.fillStyle = v('--wash')
        g.globalAlpha = 0.85
        g.fillText(text, x, y)
      }
      items.forEach((it, i) => {
        const y0 = i * CH
        let fs = CH * 0.3
        g.font = `600 ${fs}px ${serif}`
        const name = SHORT[it.id] ?? it.claimBy ?? it.title
        while (g.measureText(name).width > AW * 0.84 && fs > 8) g.font = `600 ${(fs *= 0.92)}px ${serif}`
        cut(name, AW / 2, y0 + CH * 0.38)
        g.font = `500 ${CH * 0.2}px ${serif}`
        cut(viDate(it.date), AW / 2, y0 + CH * 0.74)
        g.globalAlpha = 1
      })
      tex.needsUpdate = true
    }
    carve()
    recolor.push(carve)
    const decal = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    steles.forEach((sm, i) => {
      const geo = new THREE.PlaneGeometry(0.4, 0.2)
      const uv = geo.attributes.uv as THREE.BufferAttribute
      for (let j = 0; j < uv.count; j++) uv.setY(j, (4 - i + uv.getY(j)) / 5)
      const d = new THREE.Mesh(geo, decal)
      d.position.set(0, 0.14, 0.11 / 2 + 0.11 * 0.22 + 0.004)
      d.raycast = () => {}
      sm.add(d)
    })
    yield

    // ── the date thread: a fine dry brush line from slab to slab, nearly straight, broken where the brush ran dry
    k.root.updateMatrixWorld(true)
    const tops = steles.map((s) => s.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.2, 0)))
    const dashes: THREE.BufferGeometry[] = []
    const rd = rng(1933)
    const tmp = new THREE.Vector3()
    for (let i = 0; i < tops.length - 1; i++) {
      const a = tops[i], b = tops[i + 1]
      const len = a.distanceTo(b)
      const at = (u: number) => tmp.copy(a).lerp(b, u).add(new THREE.Vector3(0, Math.sin(u * Math.PI) * len * 0.025, 0)).clone()
      let u = 0.08 + rd() * 0.04
      while (u < 0.9) {
        const du = Math.min(0.92 - u, 0.06 + rd() * 0.16)
        dashes.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([at(u), at(u + du * 0.5), at(u + du)]), 3, 0.007 + rd() * 0.01, 3, false))
        u += du + 0.02 + rd() * 0.05
      }
    }
    const lineMat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: LINE_FRAG, defines: { OCT: 2 }, transparent: true, depthWrite: false, uniforms: { ...k.uniforms, uK: { value: 0.6 } } })
    thread = new THREE.Mesh(mergeGeometries(dashes)!, lineMat)
    dashes.forEach((x) => x.dispose())
    thread.renderOrder = 8
    thread.raycast = () => {}
    k.root.add(thread)
    const mid = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1))
    mid.visible = false
    mid.raycast = () => {}
    mid.position.copy(tops[2]).lerp(tops[3], 0.5).add(new THREE.Vector3(0, 0.25, 0))
    k.root.add(mid)
    // where the rubbing hangs (moved to the stele being read)
    rubAt = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01))
    rubAt.visible = false
    rubAt.raycast = () => {}
    k.root.add(rubAt)
    yield

    // ── clouds drifting along the valley (high), a few still banks (low); fireflies over the ridge (high)
    const nc = low ? 4 : 8
    const clouds: { m: THREE.Mesh; v: number; x0: number; span: number }[] = []
    for (let j = 0; j < nc; j++) {
      // banks behind the peaks (so the peaks stand out against them) and a few low wisps in the gaps
      const R = Rp * (j % 3 === 2 ? 0.75 + r() * 0.15 : 1.2 + r() * 0.35)
      const a = -A * 1.4 + 2.8 * A * (j / Math.max(1, nc - 1)) + (r() - 0.5) * 0.1
      const w = (j % 3 === 2 ? 2.5 : 5) + r() * 4
      const m = billow(Math.sin(a) * R, 0.4 + r() * 0.9, camZ - Math.cos(a) * R, w, 0.22 + r() * 0.1, 0.6, r() * 40)
      clouds.push({ m, v: (0.05 + r() * 0.05) * (r() < 0.5 ? -1 : 1), x0: m.position.x, span: Rp * Math.sin(A) * 1.6 })
    }
    const tone = () => billows.forEach((b, j) => void (b.uniforms.uK.value = (j < n * nf ? 0.85 : 0.55) * (pal.dark.value ? 0.8 : 1)))
    tone()
    recolor.push(tone)
    if (!low && !ctx.reduced) {
      const N = 20
      const pos = new Float32Array(N * 3), ph = new Float32Array(N)
      for (let j = 0; j < N; j++) {
        const a = (r() - 0.5) * half * 2.4
        const d = 3.5 + r() * 6
        pos.set([Math.sin(a) * d, camY - 2.2 + r() * 2.2, camZ - Math.cos(a) * d], j * 3)
        ph[j] = r()
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      geo.setAttribute('aPh', new THREE.BufferAttribute(ph, 1))
      const fm = new THREE.ShaderMaterial({ vertexShader: FLY_VERT, fragmentShader: FLY_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: k.uniforms.uTime, uPx: { value: 26 * Math.min(devicePixelRatio, 1.5) }, uC: { value: pal.fly } } })
      const pts3 = new THREE.Points(geo, fm)
      pts3.renderOrder = 7
      pts3.raycast = () => {}
      k.root.add(pts3)
    }
    k.onFrame((_t, dt) => {
      // the hover / focus warmth of a stele spreads to its peak, and its label shows the full title (writes only)
      for (let i = 0; i < n; i++) {
        const sh = (steles[i].material as THREE.ShaderMaterial).uniforms.uHot.value as number
        peakMats[i].uniforms.uHot.value = sh
        const on = sh > 0.35
        if (on !== hot[i]) (hot[i] = on), tags[i]?.classList.toggle('hot', on)
      }
      if (!k.live || dt <= 0) return
      for (const c of clouds) {
        c.m.position.x += c.v * dt
        if (Math.abs(c.m.position.x - c.x0) > c.span) c.v = -c.v
      }
    })

    // ── words and taps: the steles (date order), then the lantern; labels hang just under each slab
    k.root.updateMatrixWorld(true)
    items.forEach((it, i) => {
      const dd = viDate(it.date)
      const dotAt = h('span', { class: 't19p-tag-dot', 'aria-hidden': 'true' })
      const lab = h('div', { class: 't19p-tag' },
        dotAt,
        // tall: day and month only ("24/04", "Apr 24"); the year is on the board's date and in the aria
        tall ? h('span', { class: 't19p-tag-date' }, dd.replace(/[/,]\s?\d{4}$/, '')) : h('span', { class: 't19p-tag-name' }, SHORT[it.id] ?? it.claimBy ?? it.title),
        tall ? null : h('span', { class: 't19p-tag-date' }, dd),
        tall ? null : h('span', { class: 't19p-tag-title' }, it.title),
        CHECKED[it.id] ? h('span', { class: 't19p-tag-checked' }, CHECKED[it.id]) : null)
      tags.push(lab)
      hot.push(false)
      k.label(steles[i], lab, [0, -0.36, 0])
      const b = k.tappable(groups[i].userData.tap, fill(P.stoneAria, { title: it.title, date: dd }), () => (open === i ? close() : show(i)))
      b.setAttribute('aria-expanded', 'false')
      taps.push(b)
      dots.push(g.dot(dotAt, { dir: [0, -1] }))
    })
    if (!tall) k.label(mid, h('p', { class: 't19p-order' }, P.order))
    lampBtn = k.tappable(lantern, P.verifiedOnlyAria, () => setOnly(!only))
    lampBtn.setAttribute('aria-pressed', 'false')
    lampTag = k.label(lantern, h('p', { class: 't19p-lamp' }, h('span', { class: 't19p-lamp-dot', 'aria-hidden': 'true' }), P.verifiedOnly), [0, -1.0, 0])
    if (rubAt && !tall) k.label(rubAt, rub)
    const seaMark = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1))
    seaMark.visible = false
    seaMark.raycast = () => {}
    seaMark.position.set(0, tall ? 2.2 : 1.4, camZ - Rp)
    k.root.add(seaMark)
    k.root.updateMatrixWorld(true)
    none = k.label(seaMark, h('p', { class: 't19p-none' }, P.litNote))
  })

  // Esc, or a tap on the open sky / sea, closes the rubbing and flies home
  let down: { x: number; y: number } | null = null
  const onDown = (e: PointerEvent) => void (down = { x: e.clientX, y: e.clientY })
  const onUp = (e: PointerEvent) => {
    const d = down
    down = null
    if (!d || open < 0 || !kit || rub.contains(e.target as Node)) return
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return
    if (!kit.pick(e.clientX, e.clientY)) close()
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open >= 0) {
      e.preventDefault()
      close()
    }
  }
  wrap.addEventListener('pointerdown', onDown)
  wrap.addEventListener('pointerup', onUp)
  wrap.addEventListener('keydown', onKey)
  void handle.ready.then((k) => {
    if (!k) return
    rub.id = nextId('t19p-rub')
    taps.forEach((b) => b.setAttribute('aria-controls', rub.id))
  })
}
