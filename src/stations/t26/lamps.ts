import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { fill, h } from '../../core/dom'
import type { Fact } from '../../core/content'
import { onPrefs } from '../../core/prefs'
import { onDigit, rng } from '../../ui/part2/ink'
import { guide } from '../../ui/part2/guide'
import { inkGlsl, inkStage, type InkKit, type InkLamp } from '../../ui/part2/stage3d'
import type { SceneCtx } from '../types'
import C from '../../content/tram-26.json'
import { lampsFlat } from './lamps-flat'

/**
 * Scene 1 ★ — kage-e under four lanterns (art direction §4, t26 `lamps`): a faceless stone statue on raked sand atop a
 * mossy mound, a two-panel washi screen behind it, four stone lanterns of different make in an arc in front. Lighting a
 * lantern throws the statue's shadow along the sand and up the screen, and each theory's light shapes it differently: a
 * whole human figure, a figure half-faded looking back at itself, or only a stone. Turn round the statue: it is only stone.
 *
 * No shadow map: the shadow is cast by an invisible flat silhouette (the "puppet") standing in the statue, turned to face
 * the lit lantern. The screen's own shader and a decal over the sand ray-cast from each point toward each lantern through
 * that puppet plane (a mask texture: R = person, G = stone, B = person looking back), with a penumbra that widens with
 * the gap. One draw for every shadow on the sand, none extra on the screen.
 */

const K = C.scenes.lamps
const F = (x: unknown) => x as Fact
/** how human each lantern's shadow is (gwt, hot, iit, bio): an illustration of each theory's verdict */
const PERSON = [1, 0.6, 0, 0]
/** the statue's size against the masks and the lathe (both drawn at 1) */
const SC = 1.4
/** the puppet plane: half-width and height (m), standing on the statue's foot */
const PUP: [number, number] = [0.7 * SC, 1.6 * SC]
/** the lanterns on an arc in front of the statue (x, z): tighter on a tall frame so the outer two stay in it */
const arcAt = (tall: boolean) => (tall ? [-44, -18, 18, 44] : [-54, -24, 26, 54]).map((d) => [Math.sin((d * Math.PI) / 180) * (tall ? 2.25 : 2.45), Math.cos((d * Math.PI) / 180) * (tall ? 2.25 : 2.45)] as [number, number])
const FLAME = [0.505, 0.84, 0.65, 0.917]
/** the folding screen: wing ends (±x, z) and hinge (0, z); tall enough to take the big statue's head */
const SCR = { wing: [2.3, -1.0] as [number, number], hinge: -1.6, h: 2.5 }
const EMBER = 0.2

// ───────────────────────────── shaders ─────────────────────────────
const VERT = /* glsl */ `
varying vec3 vW;
varying vec3 vN;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`
/** the shadow of the puppet at P from one light (xyz, how lit) with mask weights (person, stone, looking back) */
const SHADE = /* glsl */ `
uniform sampler2D uSil;
uniform vec4 uSL[4];
uniform vec3 uSW[4];
uniform vec3 uS;
uniform vec2 uPup;
float shade(vec3 P, vec4 sl, vec3 sw) {
  if (sl.w < 0.004) return 0.0;
  vec3 L = sl.xyz;
  vec2 d2 = L.xz - uS.xz;
  float dl = max(length(d2), 1e-3);
  vec3 n = vec3(d2.x / dl, 0.0, d2.y / dl);
  float dn = dot(L - P, n);
  if (abs(dn) < 1e-4) return 0.0;
  float t = dot(uS - P, n) / dn;
  if (t <= 0.0 || t >= 1.0) return 0.0;
  vec3 Q = P + (L - P) * t;
  vec2 uv = vec2(dot(Q - uS, vec3(-n.z, 0.0, n.x)) / (uPup.x * 2.0) + 0.5, (Q.y - uS.y) / uPup.y);
  if (uv.x <= 0.0 || uv.x >= 1.0 || uv.y <= 0.0 || uv.y >= 1.0) return 0.0;
  // a soft edge that widens with the gap between the puppet and what receives its shadow
  float gap = distance(P, Q) / max(distance(Q, L), 0.1);
  vec3 m = texture2D(uSil, uv, clamp(log2(1.0 + gap * 3.0) * 1.3, 0.0, 4.0)).rgb;
  return clamp(dot(m, sw), 0.0, 1.0) * sl.w;
}`
const SCREEN_FRAG = /* glsl */ `
${inkGlsl.noise}
${inkGlsl.haze}
${SHADE}
uniform sampler2D uPaper;
uniform vec3 uPaperC, uGoldC, uShadeC, uLC, uKey;
uniform float uLK, uShadeK;
uniform vec4 uLP[4];
varying vec3 vW;
varying vec3 vN;
varying vec2 vUv;
void main() {
  vec3 n = normalize(vN);
  vec4 tx = texture2D(uPaper, vUv);
  vec3 col = uPaperC * (0.78 + 0.44 * tx.r);
  col = mix(col, uGoldC, tx.g);
  col *= 0.8 + 0.2 * abs(dot(n, uKey));
  // the frame's thickness shades the paper along its edges; the fold between the two wings is a soft valley
  float e = min(min(vUv.x, 1.0 - vUv.x) * 2.4, min(vUv.y, 1.0 - vUv.y) * 2.0);
  col *= (0.84 + 0.16 * smoothstep(0.0, 0.05, e)) * (0.74 + 0.26 * smoothstep(0.0, 0.2, abs(vW.x)));
  // paper glows where a lantern reaches it, except where the puppet stands in the way
  vec3 warm = vec3(0.0);
  float lit = 1.0;
  for (int i = 0; i < 4; i++) {
    float s = shade(vW, uSL[i], uSW[i]);
    lit *= 1.0 - s;
    vec3 lv = uLP[i].xyz - vW;
    float d = length(lv);
    warm += uLC * (uLP[i].w * (0.35 + 0.65 * abs(dot(n, lv / d))) / (1.0 + d * d * 0.28)) * (1.0 - s);
  }
  col += warm * uLK * (0.75 + 0.25 * tx.r + 0.6 * tx.g);
  col = mix(col, uShadeC, (1.0 - lit) * uShadeK);
  col += (h21(gl_FragCoord.xy) - 0.5) * 0.024;
  gl_FragColor = vec4(haze(col, vW), 1.0);
  #include <colorspace_fragment>
}`
const SAND_FRAG = /* glsl */ `
${inkGlsl.noise}
${inkGlsl.haze}
${SHADE}
uniform vec3 uShadeC, uLC;
uniform float uGroundK, uPoolK, uR;
uniform vec3 uScr;
uniform vec4 uLP[4];
varying vec3 vW;
void main() {
  vec2 p = vW.xz;
  // behind the screen the screen itself takes the light
  float ax = abs(p.x);
  if (ax < uScr.x && p.y < mix(uScr.z, uScr.y, ax / uScr.x) - 0.03) discard;
  // the statue's shadows, and the warm pool each lantern lays on the sand round its foot
  float lit = 1.0, warm = 0.0;
  for (int i = 0; i < 4; i++) {
    float sh = shade(vW, uSL[i], uSW[i]);
    lit *= 1.0 - sh;
    vec2 q = p - uLP[i].xz;
    warm += uLP[i].w * exp(-dot(q, q) * 0.75) * (1.0 - sh);
  }
  float edge = 1.0 - smoothstep(uR * 0.7, uR, length(p - uS.xz));
  float s = (1.0 - lit) * uGroundK * edge * (0.85 + 0.3 * n2(p * 9.0));
  float w = min(warm, 1.0) * uPoolK * edge * (0.75 + 0.5 * n2(p * 2.6));
  float a = s + w - s * w;
  if (a < 0.004) discard;
  gl_FragColor = vec4(haze((uShadeC * s + uLC * w * (1.0 - s)) / a, vW), a);
  #include <colorspace_fragment>
}`
/** a soft billboard glow (the paper window seen through the night air), its strength ours to set */
const GLOW_VERT = /* glsl */ `
uniform vec2 uSize;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * uSize;
  gl_Position = projectionMatrix * mv;
}`
const GLOW_FRAG = /* glsl */ `
uniform vec3 uC;
uniform float uK;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  gl_FragColor = vec4(uC, uK * exp(-d * d * 4.5) * (1.0 - smoothstep(0.75, 1.0, d)));
  #include <colorspace_fragment>
}`
/** the far pine row on the hills round the garden: tiered ink silhouettes, two rows, their feet lost in mist */
const PINES_FRAG = /* glsl */ `
${inkGlsl.noise}
uniform vec3 uInk, uFogC;
uniform float uK;
varying vec2 vUv;
// the tree line's height at x (in tree cells): overlapping crowns, some pointed (cedar), some round (pine)
float line(float x, float seed) {
  float c = floor(x), H = 0.0;
  for (int k = -1; k <= 1; k++) {
    float ci = c + float(k);
    if (h21(vec2(ci, seed + 9.0)) < 0.15) continue;
    float cx = ci + 0.5 + (h21(vec2(ci, seed)) - 0.5) * 0.6;
    float h = 0.3 + 0.7 * h21(vec2(ci, seed + 1.0));
    float u = abs(x - cx) / (0.55 + 0.5 * h21(vec2(ci, seed + 2.0)));
    float t = h21(vec2(ci, seed + 3.0)) < 0.5 ? h * (1.0 - u) : h * 0.82 * sqrt(max(0.0, 1.0 - u * u));
    H = max(H, t);
  }
  return H;
}
float trees(vec2 p, float seed) {
  float H = line(p.x, seed) + (n2(vec2(p.x * 9.0, p.y * 6.0) + seed) - 0.5) * 0.09;
  float fw = fwidth(p.y) * 1.5;
  return smoothstep(-fw, fw, H - p.y);
}
void main() {
  vec2 p = vec2(vUv.x * 64.0, vUv.y * 1.12 - 0.08);
  float far = trees(p * vec2(1.4, 1.15) + vec2(0.37, -0.12), 11.0);
  float near = trees(p, 3.0);
  // their feet lost in the mist; the far row paler
  float foot = smoothstep(0.02, 0.32, vUv.y);
  float a = max(near * 0.9, far * 0.5) * foot * uK;
  vec3 col = mix(mix(uInk, uFogC, 0.74), mix(uInk, uFogC, 0.5), near);
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}`
const FLY_VERT = /* glsl */ `
uniform float uPx;
attribute float aS;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uPx * aS / -mv.z;
  gl_Position = projectionMatrix * mv;
}`
const FLY_FRAG = /* glsl */ `
uniform vec3 uC;
uniform float uK;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  gl_FragColor = vec4(uC, uK * exp(-d * d * 5.0) * (1.0 - smoothstep(0.7, 1.0, d)));
  #include <colorspace_fragment>
}`

// ───────────────────────────── geometry ─────────────────────────────
const hash3 = (x: number, y: number, z: number) => {
  const q = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
  return q - Math.floor(q)
}
function noise3(x: number, y: number, z: number) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z)
  const fx = x - ix, fy = y - iy, fz = z - iz
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz)
  const c = (a: number, b: number, d: number) => hash3(ix + a, iy + b, iz + d)
  const L = (a: number, b: number, t: number) => a + (b - a) * t
  return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w)
}
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const at = (g: THREE.BufferGeometry, y: number) => g.translate(0, y, 0)
const cyl = (rt: number, rb: number, hh: number, seg: number, y: number, rot = 0) => at(new THREE.CylinderGeometry(rt, rb, hh, seg, 1, false, rot), y + hh / 2)
const box = (w: number, hh: number, d: number, y: number) => at(new THREE.BoxGeometry(w, hh, d), y + hh / 2)
const ball = (r: number, y: number) => at(new THREE.SphereGeometry(r, 10, 8), y)
const lathe = (pts: [number, number][], seg: number, rot = 0) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg, rot)
/** merge parts into one geometry (all indexed, same attributes) and free the parts */
function merged(parts: THREE.BufferGeometry[]) {
  const g = mergeGeometries(parts)!
  parts.forEach((p) => p.dispose())
  return g
}
/** a rough field stone w × h × d standing on y0 */
function lump(seed: number, w: number, hh: number, d: number, y0: number, seg = 14) {
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7))
  const p = g.attributes.position as THREE.BufferAttribute
  let lo = Infinity, hi = -Infinity
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    const k = 1 + 0.38 * (noise3(x * 1.3 + seed, y * 1.3, z * 1.3) - 0.5) + 0.12 * (noise3(x * 3.7, y * 3.7 + seed, z * 3.7) - 0.5)
    const yy = Math.max(y * k, -0.55)
    p.setXYZ(i, x * k, yy, z * k)
    lo = Math.min(lo, yy)
    hi = Math.max(hi, yy)
  }
  for (let i = 0; i < p.count; i++) p.setXYZ(i, (p.getX(i) * w) / 2, y0 + ((p.getY(i) - lo) / (hi - lo)) * hh, (p.getZ(i) * d) / 2)
  g.computeVertexNormals()
  return g
}
/** a smooth closed solid of revolution, welded so its seam does not show */
function welded(g: THREE.BufferGeometry) {
  g.deleteAttribute('uv')
  g.deleteAttribute('normal')
  const w = mergeVertices(g)
  g.dispose()
  w.computeVertexNormals()
  return w
}

/** Yukimi: the snow-viewing lantern — three bowed legs, a hexagonal firebox, a wide umbrella roof. Flame at 0.505. */
function yukimiGeo(low: boolean) {
  const H6 = Math.PI / 6
  const legs = [Math.PI / 2, (Math.PI * 7) / 6, (Math.PI * 11) / 6].map((a) => {
    const c = Math.cos(a), s = Math.sin(a)
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(c * 0.12, 0.38, s * 0.12), V(c * 0.26, 0.26, s * 0.26), V(c * 0.36, 0.0, s * 0.36)]), low ? 6 : 10, 0.03, 6, false)
  })
  const roof = lathe([[0.001, 0.6], [0.49, 0.615], [0.52, 0.665], [0.43, 0.655], [0.23, 0.74], [0.07, 0.835], [0.001, 0.86]], 6, H6)
  return merged([...legs, cyl(0.2, 0.17, 0.05, 6, 0.36, H6), cyl(0.12, 0.12, 0.2, 6, 0.41, H6), roof, ball(0.045, 0.885)])
}
/** Oribe: a square shaft planted in the ground, a flared seat, a square firebox, a low pyramid cap. Flame at 0.84. */
function oribeGeo() {
  const Q = Math.PI / 4
  return merged([box(0.15, 0.66, 0.15, 0), cyl(0.21, 0.11, 0.08, 4, 0.64, Q), box(0.25, 0.24, 0.25, 0.72), cyl(0.31, 0.31, 0.03, 4, 0.96, Q), cyl(0.03, 0.29, 0.15, 4, 0.99, Q), ball(0.05, 1.17)])
}
/** Yama-dōrō: rough stones stacked as found — a rock, a post, a holed stone, a slab. Flame at 0.65. */
function yamaGeo(low: boolean) {
  const n = low ? 10 : 14
  return merged([lump(31, 0.62, 0.26, 0.52, 0, n), lump(32, 0.22, 0.34, 0.22, 0.2, n), lump(33, 0.44, 0.32, 0.38, 0.5, n), lump(34, 0.66, 0.13, 0.52, 0.79, n)])
}
/** The paper windows of a lantern: two little panes, front and back, at height y. */
function panes(w: number, hh: number, y: number, z: number, round = false) {
  const a = round ? new THREE.CircleGeometry(w / 2, 14) : new THREE.PlaneGeometry(w, hh)
  const b = a.clone().rotateY(Math.PI)
  return merged([a.translate(0, y, z), b.translate(0, y, -z)])
}
/** the statue: a robed figure — a hem flaring on its plinth, folds falling from round shoulders, a neck, a bowed faceless
 *  head — drawn 1.09 tall and built SC times that, so its shadow is the biggest shape in the garden */
function statueGeo(low: boolean) {
  const prof: [number, number][] = [[0.001, 0], [0.33, 0], [0.345, 0.025], [0.325, 0.06], [0.3, 0.09], [0.285, 0.22], [0.258, 0.42], [0.245, 0.54], [0.26, 0.66], [0.282, 0.735], [0.278, 0.79], [0.24, 0.835], [0.165, 0.862], [0.088, 0.876], [0.07, 0.895], [0.076, 0.918], [0.115, 0.95], [0.134, 1.002], [0.126, 1.055], [0.094, 1.092], [0.048, 1.112], [0.001, 1.116]]
  // a smooth profile through the key points
  const curve = new THREE.SplineCurve(prof.map(([x, y]) => new THREE.Vector2(x, y)))
  const pts = curve.getPoints(low ? 32 : 56).map((p) => [Math.max(0.001, p.x), p.y] as [number, number])
  const g = welded(lathe(pts, low ? 28 : 44))
  const p = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), z = p.getZ(i) * 0.76
    const y = p.getY(i)
    // the robe falls in folds from the shoulders to the hem, deepest at the foot
    const a = Math.atan2(z, x)
    if (y < 0.8) {
      const k = 1 + 0.045 * Math.sin(a * 7 + Math.sin(y * 5) * 0.6) * Math.min(1, (0.8 - y) / 0.5)
      x *= k
      z *= k
    }
    // the hands rest folded in front at the waist, under the sleeves
    if (z > 0 && y > 0.4 && y < 0.64) z += 0.06 * Math.sin(((y - 0.4) / 0.24) * Math.PI) * Math.max(0, Math.cos(a - Math.PI / 2)) ** 2
    // the head bows toward the lanterns; the robe hangs a little fuller at the back
    if (y > 0.88) z += (y - 0.88) * 0.26
    if (z < 0 && y < 0.6) z *= 1 + (0.6 - y) * 0.12
    p.setXYZ(i, x * SC, y * SC, z * SC)
  }
  g.computeVertexNormals()
  return g
}
/** the mossy mound the garden sits on: flat under the sand, falling away into the mist */
function moundGeo(low: boolean) {
  // it does not end in an edge: a moss meadow runs on under the low mist and rises gently to where the far pines stand
  const prof: [number, number][] = [[0.001, -0.02], [5.0, -0.02], [6.2, -0.07], [8.5, -0.09], [11, -0.02], [14, 0.12], [19, 0.4], [28, 0.9]]
  const g = welded(lathe(prof, low ? 40 : 72))
  const p = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    const r = Math.hypot(x, z)
    // gentle swells only: a crest above the low mist would show as a sliver of moss in the fog
    if (r > 5.1) p.setY(i, y + (noise3(x * 0.35, 0, z * 0.35) - 0.65) * 0.3 * Math.min(1, (r - 5.1) / 2.5))
  }
  g.computeVertexNormals()
  return g
}
/** the two-panel screen: paper (one geometry, uv 0…1 per panel) and its lacquered frame (another) */
function screenGeo() {
  const [wx, wz] = SCR.wing
  const paper: THREE.BufferGeometry[] = []
  const frame: THREE.BufferGeometry[] = []
  const y0 = 0.08, H = SCR.h
  for (const side of [-1, 1]) {
    const ax = side * wx, az = wz, bx = 0, bz = SCR.hinge
    const len = Math.hypot(ax - bx, az - bz)
    const m = new THREE.Matrix4().makeRotationY(Math.atan2(-(az - bz), side * (ax - bx)) + (side < 0 ? Math.PI : 0))
    m.setPosition((ax + bx) / 2, 0, (az + bz) / 2)
    const pp = new THREE.PlaneGeometry(len - 0.06, H - 0.06)
    pp.translate(0, y0 + H / 2, 0)
    paper.push(pp.applyMatrix4(m))
    // a lacquered wooden frame with real depth: stiles, rails, a capping rail proud of the face, a low rail, two feet
    const t = 0.075, d = 0.1
    const rails = [box(len, t, d, y0 + H - t), box(len, t, d, y0), box(t, H, d, y0), box(t, H, d, y0), box(len, 0.04, d * 0.8, y0 + H * 0.24), box(len + 0.05, 0.035, d * 1.35, y0 + H)]
    rails[2].translate(-len / 2 + t / 2, 0, 0)
    rails[3].translate(len / 2 - t / 2, 0, 0)
    const feet = [-1, 1].map((k) => box(0.12, y0, 0.26, 0).translate(k * (len / 2 - 0.14), 0, 0))
    frame.push(...[...rails, ...feet].map((g) => g.applyMatrix4(m)))
  }
  return { paper: merged(paper), frame: merged(frame) }
}

// ───────────────────────────── textures ─────────────────────────────
/** The puppet masks: R = a person (head, neck, shoulders, arms apart from the robe), G = only a standing stone, B = a person turned to look back at itself. */
function silhouettes(N: number) {
  const cv = document.createElement('canvas')
  cv.width = cv.height = N
  const g = cv.getContext('2d')!
  g.fillStyle = '#000'
  g.fillRect(0, 0, N, N)
  g.globalCompositeOperation = 'lighter'
  g.setTransform(N / (PUP[0] * 2), 0, 0, -N / PUP[1], N / 2, N)
  g.scale(SC, SC) // the masks are drawn at the statue's drawn size
  if ('filter' in g) g.filter = `blur(${(N / 256).toFixed(1)}px)`
  const plinth = (c: string) => {
    g.fillStyle = c
    g.beginPath()
    g.ellipse(0, 0.12, 0.47, 0.11, 0, 0, Math.PI * 2)
    g.rect(-0.46, 0, 0.92, 0.12)
    g.fill()
  }
  const robe = (c: string) => {
    g.fillStyle = c
    g.beginPath()
    g.moveTo(-0.3, 0.2)
    g.quadraticCurveTo(-0.29, 0.5, -0.215, 0.74)
    g.quadraticCurveTo(-0.26, 0.86, -0.245, 0.93)
    g.quadraticCurveTo(-0.22, 1.0, -0.085, 1.02)
    g.lineTo(-0.045, 1.075)
    g.lineTo(0.045, 1.075)
    g.lineTo(0.085, 1.02)
    g.quadraticCurveTo(0.22, 1.0, 0.245, 0.93)
    g.quadraticCurveTo(0.26, 0.86, 0.215, 0.74)
    g.quadraticCurveTo(0.29, 0.5, 0.3, 0.2)
    g.closePath()
    g.fill()
    // arms hang a hand's width from the robe: the gap of light is what makes it read as a person
    g.strokeStyle = c
    g.lineCap = 'round'
    g.lineJoin = 'round'
    g.lineWidth = 0.075
    g.beginPath()
    g.moveTo(-0.235, 0.94)
    g.quadraticCurveTo(-0.33, 0.8, -0.318, 0.58)
    g.moveTo(0.235, 0.94)
    g.quadraticCurveTo(0.34, 0.82, 0.31, 0.6)
    g.stroke()
    g.beginPath()
    g.ellipse(-0.316, 0.545, 0.043, 0.058, 0.1, 0, Math.PI * 2)
    g.ellipse(0.306, 0.565, 0.043, 0.058, -0.2, 0, Math.PI * 2)
    g.fill()
  }
  // R: the whole person
  plinth('#f00')
  robe('#f00')
  g.fillStyle = '#f00'
  g.beginPath()
  g.ellipse(0, 1.16, 0.088, 0.102, 0, 0, Math.PI * 2)
  g.fill()
  // B: the same body, the head turned in profile to look down over its own shoulder
  plinth('#00f')
  robe('#00f')
  g.fillStyle = '#00f'
  g.beginPath()
  g.ellipse(0.025, 1.15, 0.08, 0.1, -0.35, 0, Math.PI * 2)
  g.moveTo(0.085, 1.19)
  g.lineTo(0.14, 1.135)
  g.lineTo(0.09, 1.12)
  g.quadraticCurveTo(0.1, 1.08, 0.06, 1.06)
  g.fill()
  // G: only a standing stone — the statue's true outline, no neck, no arms
  plinth('#0f0')
  g.fillStyle = '#0f0'
  g.beginPath()
  g.moveTo(-0.3, 0.2)
  g.quadraticCurveTo(-0.37, 0.55, -0.27, 0.86)
  g.quadraticCurveTo(-0.19, 1.07, 0.03, 1.09)
  g.quadraticCurveTo(0.21, 1.07, 0.27, 0.88)
  g.quadraticCurveTo(0.35, 0.55, 0.3, 0.2)
  g.closePath()
  g.fill()
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.NoColorSpace
  return t
}

/** Washi with gold dust: R = fibre light/dark around 0.5, G = gold (mist bands of leaf at the top and foot, scattered flakes). */
function* washi(N: number, out: { tex?: THREE.CanvasTexture }) {
  const cv = document.createElement('canvas')
  cv.width = cv.height = N
  const g = cv.getContext('2d')!
  const r = rng(2690)
  g.fillStyle = 'rgb(128,0,0)'
  g.fillRect(0, 0, N, N)
  const k = N / 512
  for (let i = 0; i < 420; i++) {
    const x = r() * N, y = r() * N, len = (10 + r() * 50) * k, a = r() * Math.PI
    g.strokeStyle = r() < 0.6 ? `rgba(255,0,0,${(0.08 + r() * 0.14).toFixed(2)})` : `rgba(40,0,0,${(0.05 + r() * 0.1).toFixed(2)})`
    g.lineWidth = (0.5 + r() * 1.2) * k
    g.beginPath()
    g.moveTo(x, y)
    g.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + (r() - 0.5) * 8 * k, y + Math.sin(a) * len * 0.5 + (r() - 0.5) * 8 * k, x + Math.cos(a) * len, y + Math.sin(a) * len)
    g.stroke()
  }
  yield
  // the pulp lies unevenly (clouds of thicker and thinner paper), and long kozo fibres curl through it
  for (let i = 0; i < 26; i++) {
    const x = r() * N, y = r() * N, rad = (40 + r() * 110) * k
    const gr = g.createRadialGradient(x, y, 0, x, y, rad)
    const c = r() < 0.5 ? '255,0,0' : '30,0,0'
    gr.addColorStop(0, `rgba(${c},${(0.05 + r() * 0.07).toFixed(2)})`)
    gr.addColorStop(1, `rgba(${c},0)`)
    g.fillStyle = gr
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2)
  }
  for (let i = 0; i < 90; i++) {
    let x = r() * N, y = r() * N, a = r() * Math.PI * 2
    g.strokeStyle = `rgba(255,0,0,${(0.18 + r() * 0.2).toFixed(2)})`
    g.lineWidth = (0.4 + r() * 0.7) * k
    g.beginPath()
    g.moveTo(x, y)
    for (let j = 0; j < 6; j++) {
      a += (r() - 0.5) * 1.4
      x += Math.cos(a) * 18 * k
      y += Math.sin(a) * 18 * k
      g.lineTo(x, y)
    }
    g.stroke()
  }
  yield
  g.globalCompositeOperation = 'lighter'
  // suyari-gasumi: long gold mist bands across the top and the foot of each panel
  const band = (y0: number, y1: number, seed: number) => {
    const rr = rng(seed)
    for (let i = 0; i < 5; i++) {
      const cy = (y0 + (y1 - y0) * rr()) * N, x0 = (rr() * 0.6 - 0.3) * N, w = (0.5 + rr() * 0.7) * N, hh = (0.025 + rr() * 0.03) * N
      g.fillStyle = 'rgb(0,44,0)'
      g.beginPath()
      g.moveTo(x0, cy)
      g.bezierCurveTo(x0 + w * 0.2, cy - hh, x0 + w * 0.8, cy - hh, x0 + w, cy)
      g.bezierCurveTo(x0 + w * 0.8, cy + hh * 0.8, x0 + w * 0.2, cy + hh, x0, cy)
      g.fill()
    }
  }
  band(0.02, 0.12, 3)
  band(0.86, 0.97, 4)
  yield
  // scattered flakes, thicker in the bands
  for (let i = 0; i < 900; i++) {
    const y = r() < 0.55 ? (r() < 0.5 ? r() * 0.18 : 0.8 + r() * 0.2) : r()
    const x = r() * N, s = (0.6 + r() * r() * 3.2) * k
    g.fillStyle = `rgb(0,${Math.round(90 + r() * 120)},0)`
    g.fillRect(x, y * N, s, s * (0.5 + r()))
  }
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.NoColorSpace
  t.anisotropy = 4
  out.tex = t
}

// ───────────────────────────── the scene ─────────────────────────────
export function lampsScene(ctx: SceneCtx) {
  const n = K.lamps.length
  // portrait: the words take the sky, so the garden sits lower and the lanterns stand closer (one size read at mount)
  const tall = ctx.art.clientHeight > ctx.art.clientWidth
  const AT = arcAt(tall)
  const css = getComputedStyle(document.documentElement)
  const tok = (name: string, c = new THREE.Color()) => c.setStyle(css.getPropertyValue(name).trim() || '#888', THREE.SRGBColorSpace)
  const C3 = () => new THREE.Color()
  // colours of our own materials: read on mount and on every theme change (registered before the build yields)
  const pal = {
    paper: C3(), gold: C3(), shade: C3(), sandShade: C3(), lantern: C3(), off: C3(), fly: C3(), cold: C3(), dark: false,
    // granite (lanterns, statue, stones) and lacquered wood (the screen's frame): shadow, body, lit plane
    granite: [C3(), C3(), C3()] as THREE.Color[], wood: [C3(), C3(), C3()] as THREE.Color[], needle: [C3(), C3(), C3()] as THREE.Color[],
  }
  const U = {
    uSil: { value: null as THREE.Texture | null },
    uSL: { value: AT.map(() => new THREE.Vector4()) },
    uSW: { value: PERSON.map((p) => (p >= 1 ? new THREE.Vector3(1, 0, 0) : p > 0 ? new THREE.Vector3(0, 0, p) : new THREE.Vector3(0, 1, 0))) },
    uS: { value: new THREE.Vector3(0, 0, 0) },
    uPup: { value: new THREE.Vector2(...PUP) },
    uLP: { value: AT.map(() => new THREE.Vector4()) },
    uPaperC: { value: pal.paper }, uGoldC: { value: pal.gold }, uShadeC: { value: pal.shade }, uLC: { value: pal.lantern },
    uLK: { value: 1 }, uShadeK: { value: 0.5 }, uGroundK: { value: 0.5 }, uPoolK: { value: 0.3 },
  }
  const readPal = () => {
    pal.dark = document.documentElement.dataset.theme === 'dark'
    tok('--lantern', pal.lantern)
    tok('--rock-lo', pal.off)
    tok('--firefly', pal.fly)
    const [gl, gm, gh] = pal.granite, [wl, wm, wh] = pal.wood, [nl, nm, nh] = pal.needle
    // the pine's needles in ink: near black in the body, a cold moss green only where they catch the light
    tok('--wash', nl).lerp(tok('--moss-b'), pal.dark ? 0.15 : 0.22)
    tok('--moss-b', nm).lerp(tok('--wash'), pal.dark ? 0.35 : 0.5)
    tok('--moss-b', nh).lerp(tok('--wash'), pal.dark ? 0.1 : 0.2)
    if (pal.dark) {
      tok('--rock-mid', pal.paper).lerp(tok('--rock-hi'), 0.35)
      tok('--lantern', pal.gold).lerp(tok('--rock-mid'), 0.45)
      tok('--umbra', pal.shade)
      tok('--umbra', pal.sandShade)
      tok('--rock-lo', gl).lerp(tok('--wash'), 0.25)
      tok('--rock-mid', gm).lerp(tok('--rock-lo'), 0.12)
      tok('--rock-hi', gh).lerp(tok('--rock-mid'), 0.25)
      tok('--wash', wl).lerp(tok('--lantern'), 0.06)
      tok('--rock-lo', wm).lerp(tok('--lantern'), 0.14)
      tok('--rock-mid', wh).lerp(tok('--lantern'), 0.2)
      tok('--moon', pal.cold).lerp(tok('--mist'), 0.55)
    } else {
      // washi a step below the paper, so the shadows and the lamplight both carry on it
      tok('--paper-2', pal.paper).lerp(tok('--rock-mid'), 0.32).lerp(tok('--lantern'), 0.05)
      tok('--lantern', pal.gold).lerp(tok('--rock-lo'), 0.3)
      tok('--ink', pal.shade).lerp(tok('--ink-3'), 0.2)
      tok('--wash', pal.sandShade).lerp(tok('--rock-lo'), 0.35)
      // grey granite, never white: the paper's lightest value stays the paper's
      tok('--rock-lo', gl).lerp(tok('--wash'), 0.38)
      tok('--rock-lo', gm).lerp(tok('--rock-mid'), 0.3)
      tok('--rock-mid', gh).lerp(tok('--rock-lo'), 0.24)
      tok('--umbra', wl).lerp(tok('--lantern'), 0.08)
      tok('--umbra', wm).lerp(tok('--lantern'), 0.26)
      tok('--umbra', wh).lerp(tok('--lantern'), 0.45)
      tok('--card', pal.cold).lerp(tok('--water'), 0.22)
    }
    U.uLK.value = pal.dark ? 1.25 : 0.75
    U.uShadeK.value = pal.dark ? 0.78 : 0.7
    U.uGroundK.value = pal.dark ? 0.8 : 0.64
    U.uPoolK.value = pal.dark ? 0.32 : 0.28
  }
  readPal()

  // how lit each lantern is now (0…1), where it is heading, and the shadow light's height above its flame
  const kNow = AT.map(() => 0), kTo = AT.map(() => 0), lift = AT.map(() => 0)
  const lit = new Set<number>()
  let done = false
  let kit: InkKit | null = null
  const lamps: InkLamp[] = []
  const groups: THREE.Group[] = []
  const winMats: THREE.MeshBasicMaterial[] = []
  const glows: THREE.ShaderMaterial[] = []
  const flicker = AT.map(() => 0)
  // the lit lantern's name hangs on the sand below it (a zero-size anchor, the words below it)
  const tags = K.lamps.map((l, i) => h('div', { class: `t26l-tag${i === 0 || i === n - 1 ? ' up' : ''}`, 'aria-hidden': 'true' }, h('p', null, h('span', { class: 't26l-tname' }, l.name), h('span', { class: 't26l-ten' }, l.en))))
  const side = h('div', { class: 't26l-side', hidden: true })
  // guidance (audit v3 26-1): a vermilion dot on each unlit lantern's paper window, the count carved under the plinth from
  // the start, a faint curved arrow under the tray for walking round the statue; six seconds still, the nearest unlit
  // lantern flares like a struck match
  const dotHosts = K.lamps.map(() => h('div', { class: 't26l-dothost', 'aria-hidden': 'true' }))
  const countEl = h('p', { class: 't26l-count' }, fill(K.count, { n: 0, total: n }))
  const gd = guide(ctx)
  const dots = dotHosts.map((el) => gd.dot(el))
  const orbit = gd.gesture('rotate', () => [ctx.art.clientWidth * 0.5, ctx.art.clientHeight * (tall ? 0.9 : 0.88)], { r: 52 })
  let flyMat: THREE.ShaderMaterial | null = null
  let pineMat: THREE.ShaderMaterial | null = null

  const paintWin = (i: number) => {
    const m = winMats[i]
    if (m) m.color.copy(pal.off).lerp(pal.lantern, 0.12 + 0.88 * kNow[i])
    if (glows[i]) glows[i].uniforms.uK.value = kNow[i] * (pal.dark ? 0.35 : 0.85)
  }
  /** write lantern i's light: its fill (toolkit slot), the screen's warm light, the shadow light, its paper window */
  const sync = (i: number, force = false) => {
    const L = lamps[i]
    const [x, z] = AT[i]
    U.uLP.value[i].set(x, FLAME[i], z, kNow[i])
    U.uSL.value[i].set(x, FLAME[i] + lift[i], z, kNow[i] ** 1.4)
    paintWin(i)
    // the toolkit's slot renders a frame per set(): only on a real change
    if (L && (force || Math.abs(L.k - kNow[i]) > 0.035)) L.set(kNow[i])
  }
  const offPrefs = onPrefs(() => {
    readPal()
    if (flyMat) flyMat.uniforms.uK.value = pal.dark ? 0.9 : 0.5
    if (pineMat) pineMat.uniforms.uK.value = pal.dark ? 0.95 : 0.7
    for (let i = 0; i < n; i++) sync(i, true)
    kit?.render()
  })
  ctx.onCleanup(offPrefs)

  const ownTex: THREE.Texture[] = []
  ctx.onCleanup(() => ownTex.forEach((t) => t.dispose()))
  const flat = (host: HTMLElement) => {
    lampsFlat(Object.create(ctx, { art: { value: host } }) as SceneCtx)
    return () => {}
  }
  /** our own tones on the kit's ink material: granite or wood washes, a cold moon rim (stronger than the kit's in light) */
  const rimK = { get value() { return pal.dark ? 0.95 : 0.85 }, set value(_v: number) { /* the kit's theme write: ours wins */ } }
  // stone takes the lamplight more soberly than the kit's default (four lamps close round the statue would bleach it)
  const lampK = { get value() { return pal.dark ? 0.34 : 0.3 }, set value(_v: number) { /* ours */ } }
  /** granite grain in the stone itself: dark mica and pale feldspar specks, fixed to the object (not the screen) */
  const speckle = (m: THREE.ShaderMaterial) => {
    m.onBeforeCompile = (sh) => void (sh.fragmentShader = sh.fragmentShader.replace('col += (h21(gl_FragCoord.xy) - 0.5) * uGrain;', 'col *= 0.88 + 0.22 * n3(vO * 46.0 + uSeed); col = mix(col, uLo, step(0.91, h31(floor(vO * 58.0))) * 0.3); col = mix(col, uHi, step(0.95, h31(floor(vO * 67.0) + 5.0)) * 0.22); col += (h21(gl_FragCoord.xy) - 0.5) * uGrain;'))
    m.customProgramCacheKey = () => 't26-granite'
  }
  const tone = (obj: THREE.Object3D, t: THREE.Color[]) => obj.traverse((o) => {
    const u = ((o as THREE.Mesh).material as THREE.ShaderMaterial | undefined)?.uniforms
    if (!u?.uLo || u.uW) return
    u.uLo = { value: t[0] }
    u.uMid = { value: t[1] }
    u.uHi = { value: t[2] }
    u.uMoonC = { value: pal.cold }
    u.uRim = rimK
    u.uLampK = lampK
    if (t === pal.granite) speckle((o as THREE.Mesh).material as THREE.ShaderMaterial)
  })

  const view = { yaw: 0.14, pitch: tall ? 0.14 : 0.2 }
  const stage = inkStage(ctx, ctx.art, {
    label: K.art, hint: K.hint, idle: 0, sway: false, dpr: [1.75, 1.25], fallback: flat,
    view: { ...view, yawRange: [view.yaw - 0.61, view.yaw + 0.61], pitchRange: [0.2, 0.62], fit: tall ? [4.4, 2.8] : [5.6, 2.7], target: [0, tall ? 0.9 : 0.7, 0.45], shift: tall ? 0.08 : 0.03, zoomRange: [0.72, 1.3] },
  }, function* (k) {
    const low = k.low
    k.uniforms.uKey.value.set(-0.62, 0.6, 0.5).normalize()
    // the ground runs on into a fog that eats it, mist lying low over the far slopes
    k.uniforms.uFog.value.set(11, 30)
    k.uniforms.uMist.value.set(1.4, 0.75)
    // the moon low behind the garden on the left, just over the far pines: its cold rim is on the left of every stone
    const ma = view.yaw + (tall ? 0.17 : 0.44), me = tall ? 0.03 : 0.075
    k.backdrop({ moon: [-Math.sin(ma) * Math.cos(me), Math.sin(me), -Math.cos(ma) * Math.cos(me)], seed: 26, mist: 1.5 })
    // the far pine row on the slopes all round the back
    pineMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: PINES_FRAG, defines: { OCT: low ? 2 : 4 }, transparent: true, depthWrite: false, side: THREE.BackSide,
      uniforms: { uInk: k.uniforms.uInk, uFogC: k.uniforms.uFogC, uK: { value: pal.dark ? 0.95 : 0.7 } },
    })
    const row = new THREE.Mesh(new THREE.CylinderGeometry(13.5, 13.5, 3.2, 72, 1, true, Math.PI * 0.42, Math.PI * 1.16), pineMat)
    row.position.set(0, 1.25, -0.25)
    row.renderOrder = -6
    row.raycast = () => {}
    k.root.add(row)
    yield
    k.ground({ r: 5.2 })
    k.mesh(moundGeo(low), k.ink('moss', { moss: 1, rim: 0.4, edge: 0.5 }), { outline: false, at: [0, 0, 0] })
    // a still pool at the lanterns' feet: it takes their lit windows and the statue upside down
    k.pond(tall ? { at: [0, 3.05], r: [2.05, 0.6], seed: 26 } : { at: [0.1, 3.2], r: [2.35, 0.58], seed: 26 })
    yield
    // the statue on its mossy plinth
    const plinth = k.rock({ at: [0, 0], w: 1.3, h: 0.3, d: 1.1, seed: 2611, moss: 0.9, rotY: 0.5 })
    const statue = k.mesh(statueGeo(low), k.ink('rock', { moss: 0.3, edge: 1.2 }), { cast: true, at: [0, 0.24, 0], outline: false })
    statue.raycast = () => {}
    tone(plinth, pal.granite)
    tone(statue, pal.granite)
    yield
    // the folding screen and its paper
    const scr = screenGeo()
    const paperTex: { tex?: THREE.CanvasTexture } = {}
    yield* washi(low ? 256 : 512, paperTex)
    ownTex.push(paperTex.tex!)
    const sil = silhouettes(low ? 128 : 256)
    ownTex.push(sil)
    U.uSil.value = sil
    const screenMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: SCREEN_FRAG, defines: { OCT: low ? 2 : 4 }, side: THREE.DoubleSide,
      uniforms: { ...k.uniforms, ...U, uPaper: { value: paperTex.tex } },
    })
    k.mesh(scr.paper, screenMat, { outline: false }).raycast = () => {}
    const frame = k.mesh(scr.frame, k.ink('bark', { edge: 0.6 }), { outline: false })
    frame.raycast = () => {}
    tone(frame, pal.wood)
    yield
    // four lanterns, each its own make, turned to the statue
    const geos = [() => yukimiGeo(low), () => oribeGeo(), () => yamaGeo(low)]
    const paneGeo = [() => panes(0.1, 0.12, 0.505, 0.106), () => panes(0.13, 0.13, 0.84, 0.127), () => panes(0.13, 0.13, 0.65, 0.17, true)]
    for (let i = 0; i < n; i++) {
      const [x, z] = AT[i]
      const rot = Math.atan2(-x, -z)
      let g: THREE.Group
      if (i < 3) {
        g = new THREE.Group()
        g.position.set(x, 0, z)
        g.rotation.y = rot
        k.root.add(g)
        k.mesh(geos[i](), k.ink('rock', { moss: 0.6, edge: 1.2 }), { parent: g, cast: true, outline: false })
        const wm = new THREE.MeshBasicMaterial()
        winMats[i] = wm
        g.add(new THREE.Mesh(paneGeo[i](), wm))
        lamps[i] = k.lamp([0, FLAME[i], 0], { tint: '--lantern', k: 0, parent: g, halo: 1.25 })
      } else {
        const t = k.toro({ at: [x, z], h: 1.45, rotY: rot, lit: 0 })
        lamps[i] = t.lamp!
        g = t
      }
      tone(g, pal.granite)
      // the paper window's glow in the night air (ours: it carries in the light theme too)
      const gm = new THREE.ShaderMaterial({ vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, transparent: true, depthWrite: false, uniforms: { uSize: { value: new THREE.Vector2(1.5, 1.5) }, uC: { value: pal.lantern }, uK: { value: 0 } } })
      glows[i] = gm
      const gq = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), gm)
      gq.position.set(x, i < 3 ? FLAME[i] : 0.95, z)
      gq.renderOrder = 4
      gq.raycast = () => {}
      k.root.add(gq)
      groups[i] = g
      sync(i)
      k.tappable(g, fill(K.lampAria, { name: K.lamps[i].name }), () => light(i))
      yield
    }
    // an old pine leaning out of the mist behind the screen, a few stones on the tray
    // (not on a tall frame: there it would only show its crown, floating under the words)
    if (!tall) {
      const pine = k.pine({ at: [-4.5, -3.9], h: 3.8, lean: 1, seed: 26 })
      pine.position.y = -0.22 // rooted in the slope, not standing on the tray's level
      tone(pine.children[1], pal.needle)
    }
    yield
    tone(k.rock({ at: [2.95, -0.2], w: 0.55, h: 0.36, seed: 2612, moss: 0.8 }), pal.granite)
    tone(k.rock({ at: [-2.9, -0.55], w: 0.4, h: 0.24, seed: 2613, moss: 0.7 }), pal.granite)
    // no cel outlines in this garden: ink washes only (the kit's hull meshes come off every stone, lantern and the pine)
    const hulls: THREE.Object3D[] = []
    k.root.traverse((o) => void ((((o as THREE.Mesh).material as THREE.ShaderMaterial | undefined)?.uniforms?.uW) && hulls.push(o)))
    hulls.forEach((o) => o.removeFromParent())
    yield
    // the shadow on the sand: one decal over the tray, ray-cast through the puppet
    const sandMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: SAND_FRAG, defines: { OCT: low ? 2 : 4 }, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4,
      uniforms: { ...k.uniforms, ...U, uR: { value: 4.6 }, uScr: { value: new THREE.Vector3(SCR.wing[0], SCR.wing[1], SCR.hinge) } },
    })
    const decal = new THREE.Mesh(new THREE.CircleGeometry(4.6, 64), sandMat)
    decal.rotation.x = -Math.PI / 2
    decal.position.y = 0.006
    decal.renderOrder = -3
    decal.raycast = () => {}
    k.root.add(decal)
    // a few fireflies, still (this scene draws nothing while nobody touches it)
    if (!low) {
      const r = rng(2614)
      const N = 16, pos = new Float32Array(N * 3), sz = new Float32Array(N)
      for (let i = 0; i < N; i++) {
        const a = r() * Math.PI * 2, d = 2.6 + r() * 3.5
        pos.set([Math.cos(a) * d, 0.3 + r() * 1.6, Math.sin(a) * d - 0.8], i * 3)
        sz[i] = 0.5 + r() * 0.8
      }
      const fg = new THREE.BufferGeometry()
      fg.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      fg.setAttribute('aS', new THREE.BufferAttribute(sz, 1))
      flyMat = new THREE.ShaderMaterial({ vertexShader: FLY_VERT, fragmentShader: FLY_FRAG, transparent: true, depthWrite: false, uniforms: { uPx: { value: 70 * Math.min(devicePixelRatio, 1.75) }, uC: { value: pal.fly }, uK: { value: pal.dark ? 0.9 : 0.5 } } })
      const pts = new THREE.Points(fg, flyMat)
      pts.renderOrder = 5
      pts.raycast = () => {}
      k.root.add(pts)
    }
    // words: the statue's name carved on its plinth; the lit lantern's name on the sand by it (keys and aria number them)
    k.label(plinth, h('p', { class: 't26l-carve', 'aria-hidden': 'true' }, K.statue), [0, -0.08, 0.5])
    groups.forEach((g, i) => {
      const top = new THREE.Box3().setFromObject(g).max.y
      // the outer lanterns carry their names above them (open sand), the inner ones below (clear of the statue)
      k.label(g, tags[i], [0, tags[i].classList.contains('up') ? 0.08 : -top, 0])
      k.label(g, dotHosts[i], [0, (i < 3 ? FLAME[i] : 0.95) - top, 0])
    })
    k.label(plinth, countEl, tall ? [0, -0.36, 2.15] : [0, -0.36, 0.6]) // tall: on the sand in front, clear of the lanterns
  })
  ctx.prompt(K.prompt)

  stage.ready.then((k) => {
    if (!k) return
    kit = k
    ctx.art.append(side)
    ctx.onCleanup(onDigit((d) => d <= n && light(d - 1)))
    ctx.onCleanup(() => side.remove())
  })

  /** one timed animation for every lantern: lights ease to their level, the new flame flickers, the shadow light settles */
  let running = false
  const step = (dt: number) => {
    let moving = false
    for (let i = 0; i < n; i++) {
      const f = 1 - Math.exp(-dt * 3.2)
      let want = kTo[i]
      if (flicker[i] > 0) {
        // the match flares, the paper catches, the flame trembles and settles (≤ 2 s)
        flicker[i] = Math.max(0, flicker[i] - dt)
        const u = 1 - flicker[i] / 1.8
        want = Math.min(1, u * 5) * (1 - 0.22 * (1 - u) * (0.5 + 0.5 * Math.sin(u * 47) * Math.sin(u * 13)))
        moving = true
      }
      kNow[i] += (want - kNow[i]) * (flicker[i] > 0 ? 0.6 : f)
      if (Math.abs(want - kNow[i]) > 0.003) moving = true
      else kNow[i] = want
      if (lift[i] > 0.002) {
        lift[i] *= Math.exp(-dt * 2.1)
        moving = true
      } else lift[i] = 0
      sync(i, !moving)
    }
    running = moving
    return moving
  }
  function run() {
    if (!kit || running) return
    running = true
    kit.animate(step)
  }

  const onIdle = () => {
    const i = [...Array(n).keys()].find((j) => !lit.has(j))
    if (i == null || !kit || ctx.reduced) return
    kNow[i] = Math.max(kNow[i], 0.45) // the match flares, then the window goes dark again
    run()
  }
  ctx.el.addEventListener('p2:idle', onIdle)
  ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', onIdle))
  let tm = 0
  ctx.onCleanup(() => clearTimeout(tm))

  function light(i: number) {
    const k = kit
    if (!k) return
    const first = !lit.has(i)
    lit.add(i)
    dots[i].done()
    countEl.textContent = fill(K.count, { n: lit.size, total: n })
    if (!countEl.hasAttribute('aria-live')) countEl.setAttribute('aria-live', 'polite')
    if (lit.size >= 2) orbit.done()
    const all = lit.size === n
    for (let j = 0; j < n; j++) kTo[j] = all ? 0.9 : j === i ? 1 : lit.has(j) ? EMBER : 0
    if (first) {
      flicker[i] = ctx.reduced || k.low ? 0 : 1.8
      lift[i] = ctx.reduced ? 0 : 2.2 // the shadow starts short and stretches over the sand onto the screen
    }
    run()
    // its name rides on the lantern; what it asks and how it sees the AI, at the edge of the stage
    const l = K.lamps[i]
    tags.forEach((t, j) => t.classList.toggle('on', j === i))
    side.replaceChildren(
      h('p', { class: 't26l-eyebrow' }, fill(K.eyebrow, { i: i + 1, n, name: l.name, en: l.en })),
      h('p', { class: 't26l-q' }, l.asks),
      ctx.fact(F(l.view), 'p', 't26l-view'),
      // what the two shadows mean, said once where they appear
      h('p', { class: 't26l-decode' }, K.decode))
    side.hidden = false
    if (!side.hasAttribute('aria-live')) side.setAttribute('aria-live', 'polite')
    ctx.chime('soft')
    if (!all) ctx.prompt(fill(K.promptNext, { n: n - lit.size }))
    if (all && !done) {
      done = true
      ctx.insight(F(K.insight), F(K.detail))
      // one text at the end: the lamp's words give way to the insight
      tm = window.setTimeout(() => side.classList.add('gone'), ctx.reduced ? 0 : 3200)
      countEl.replaceChildren() // (the label's own fade sets opacity inline, so empty it rather than fade it)
      // step back to the front, where all four shadows stand side by side on the screen
      k.fly(null, 0, view.pitch + 0.05, 1.6)
    }
  }
}
