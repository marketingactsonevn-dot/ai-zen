import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { fill, h } from '../../core/dom'
import { onPrefs } from '../../core/prefs'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { inkGlsl, inkStage, type InkKit } from '../../ui/part2/stage3d'
import { blob, curve, rng, stroke, type Pt } from '../../ui/part2/ink'
import { C } from './data'
import { figure } from './brush'
import { fieldFallback } from './fieldsvg'
import { guide } from '../../ui/part2/guide'
import { A, COLS, FALL, HZ, PLINTH, R, R0, ROWS, Rl, SHRINK, TRAY, Y, at, fallK, thOf } from './hill'

const G = C.scenes.gardeners
/**
 * ★ Một nghìn người làm vườn (art direction §4 t28 `gardeners`, WebGL hero): a terraced hill of 25 curved rows × 40 moss
 * beds like a bonsai tray, a bamboo gutter on the lip of every row with a spout over every bed. One old gardener (a paper
 * puppet) waters bed after bed with his one can (CPU); the bamboo valve on the crest sends water down every gutter and a
 * thousand spouts drip at once (GPU). Beds, sprouts and spouts are one InstancedMesh each, the drops one Points; the wet
 * wave is a time uniform against a per-bed delay, so nothing is written to a buffer after the build.
 */
const N = ROWS * COLS
const FEED = 0.35, RUN = 0.55 // s: down the feeder, along a gutter
const rowStart = (i: number) => (FEED * (ROWS - 1 - i)) / (ROWS - 1)
const POUR = 3.2 // s, the whole pour
const WALK = 9 // s, the one can over the whole garden
const T1 = 0.8, T2 = 1.4 // s, to the first bed / back home
const RP = R0 + 1.25 // the gardener's path along the foot of the hill
const sep = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, G.sep)

// ───────────── GLSL: the kit's ink washes, haze and grain, for instanced pieces ─────────────
const HEAD = /* glsl */ `
${inkGlsl.noise}
${inkGlsl.haze}
uniform vec3 uKey, uMoonDir, uMoonC, uInk, uLampC, uRimC, uLampP;
uniform float uLampK, uRimK, uGrain, uLipK, uGlintK;
vec3 litInk(vec3 lo, vec3 mid, vec3 hi, vec3 n, vec3 w, float ao) {
  float wob = (fbm3(w * 2.2) - 0.5) * 0.55;
  float nl = dot(n, uKey);
  float lit = smoothstep(-0.14, 0.2, nl + wob);
  float top = smoothstep(0.45, 0.8, nl + wob * 0.7);
  vec3 col = mix(lo, mid, lit);
  col = mix(col, hi, top * 0.85);
  col = mix(mix(lo, uInk, 0.5), col, ao);
  vec3 V = normalize(cameraPosition - w);
  float fres = pow(1.0 - max(dot(n, V), 0.0), 2.6);
  col = mix(col, uMoonC, fres * smoothstep(-0.35, 0.55, dot(n, uMoonDir)) * uRimK);
  vec3 lv = uLampP - w;
  float ld = length(lv);
  col += uLampC * uLampK * max(dot(n, lv / max(ld, 1e-3)), 0.0) / (1.0 + ld * ld * 1.4);
  return col;
}
vec3 finish(vec3 col, vec3 w) {
  col += (h21(gl_FragCoord.xy) - 0.5) * uGrain;
  return haze(col, w);
}
`
const OUT = '#include <colorspace_fragment>'

/** treads, risers and cliffs: aC = (occlusion, distance from the lip, moss) */
const FIELD_V = /* glsl */ `
attribute vec3 aC;
varying vec3 vW; varying vec3 vN; varying vec3 vC;
void main() {
  vC = aC;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`
const FIELD_F = /* glsl */ `${HEAD}
uniform vec3 uLo, uMid, uHi, uMossLo, uMossMid, uWetSoil;
uniform float uMossK, uOneN, uMany;
varying vec3 vW; varying vec3 vN; varying vec3 vC;
// the tread soil darkens with its bed: which bed is under this point, and is it wet yet (same order and drip times as the beds)
float Jf(float i, float th) { return 1.0 + 0.03 * (0.65 * sin(th * 4.3 + i * 0.13 + 0.7) + 0.35 * sin(th * 9.7 - i * 0.21 + 2.1)); }
float wetAt(vec3 w) {
  vec2 q = vec2(w.x, w.z - (${HZ.toFixed(2)}));
  float th = atan(q.x, q.y), r = length(q);
  float j = floor((th + ${A.toFixed(2)}) / ${(2 * A).toFixed(2)} * ${COLS.toFixed(1)});
  float i = floor(log(${R0.toFixed(2)} / r) / ${Math.log(1 / SHRINK).toFixed(6)});
  i = floor(log(${R0.toFixed(2)} * Jf(i, th) / r) / ${Math.log(1 / SHRINK).toFixed(6)}); // the lips wander (hill.ts J)
  if (j < 0.0 || j > ${(COLS - 1).toFixed(1)} || i < 0.0 || i > ${(ROWS - 1).toFixed(1)}) return 0.0;
  float d = ${FEED.toFixed(2)} * (${(ROWS - 1).toFixed(1)} - i) / ${(ROWS - 1).toFixed(1)} + ${RUN.toFixed(2)} * (j + 0.5) / ${COLS.toFixed(1)} + 0.075;
  return max(clamp((uOneN - (j * ${ROWS.toFixed(1)} + i)) * 0.4, 0.0, 1.0), smoothstep(d + 0.3, d + 0.6, uMany));
}
void main() {
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  vec3 col = litInk(uLo, uMid, uHi, n, vW, vC.x);
  col = mix(col, uWetSoil * (0.75 + 0.5 * vC.x), wetAt(vW) * step(0.6, n.y) * (1.0 - vC.z) * 0.75);
  float moss = smoothstep(0.45, 0.72, fbm3(vW * 1.5) + vC.z * 0.45) * clamp(uMossK + vC.z, 0.0, 1.0) * smoothstep(0.5, 0.9, n.y);
  col = mix(col, mix(uMossLo, uMossMid, smoothstep(0.35, 0.8, fbm3(vW * 4.0 + 3.0))), moss);
  // every lip carries a silver line of moonlight, brightest where it turns toward the moon
  float fw = max(fwidth(vC.y), 1e-4);
  float lip = 1.0 - smoothstep(fw * 1.1, fw * 3.2, vC.y);
  float toMoon = 0.6 + 0.4 * smoothstep(-0.8, 0.8, normalize(vec2(vW.x, vW.z - (${HZ.toFixed(2)}))).x * sign(uMoonDir.x));
  col = mix(col, uRimC, lip * uLipK * toMoon * (0.7 + 0.3 * n2(vW.xz * 7.0)));
  gl_FragColor = vec4(finish(col, vW), 1.0);
  ${OUT}
}`

/** a bed: aBed = (order of the one can, drip time of its spout, seed, -); aF = (top face, height share) */
const BED_V = /* glsl */ `
attribute vec4 aBed;
attribute vec2 aF;
uniform float uOneN, uMany;
varying vec3 vW; varying vec3 vN; varying vec2 vUv; varying vec3 vF; varying float vSeed;
void main() {
  float wet = max(clamp((uOneN - aBed.x) * 0.4, 0.0, 1.0), smoothstep(aBed.y + 0.28, aBed.y + 0.5, uMany));
  vUv = uv;
  vSeed = aBed.z;
  vF = vec3(aF, wet);
  vec3 p = position;
  p.y *= 1.0 + 0.2 * wet; // a soaked bed swells a little
  vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * (transpose(inverse(mat3(instanceMatrix))) * normal));
  gl_Position = projectionMatrix * viewMatrix * w;
}`
const BED_F = /* glsl */ `${HEAD}
uniform vec3 uDry0, uDry1, uDry2, uWet0, uWet1, uWet2;
uniform float uShiver;
varying vec3 vW; varying vec3 vN; varying vec2 vUv; varying vec3 vF; varying float vSeed;
void main() {
  vec3 n = normalize(vN);
  float top = vF.x, wet = vF.z;
  vec3 lo = mix(uDry0, uWet0, wet), mid = mix(uDry1, uWet1, wet), hi = mix(uDry2, uWet2, wet);
  vec3 col = litInk(lo, mid, hi, n, vW, mix(0.5, 1.0, vF.y));
  // three furrows along the bed, inked edges; dry stubble speckles the dry ones
  float fu = vUv.x * 2.0;
  float fwu = fwidth(fu);
  float d = abs(fract(fu + 0.5) - 0.5);
  float fur = (1.0 - smoothstep(fwu * 0.5, fwu * 1.6, d)) * (1.0 - smoothstep(0.3, 0.6, fwu));
  col = mix(col, mix(lo, uInk, 0.4), fur * top * 0.35);
  float e = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
  float fwe = fwidth(e);
  col = mix(col, uInk, (1.0 - smoothstep(fwe * 0.6, fwe * 1.8, e)) * top * 0.22);
  // dry: stubble dashes and a tone of its own per bed; wet: the soil darkens unevenly
  float tone = (vSeed - 0.5) * 0.22;
  col *= 1.0 + tone * (1.0 - wet);
  float stub = smoothstep(0.68, 0.9, n2(vec2(vUv.x * 9.0 + vSeed * 13.0, vUv.y * 2.2)));
  col = mix(col, mix(lo, uInk, 0.35), stub * top * (1.0 - wet) * 0.45);
  col = mix(col, lo, smoothstep(0.55, 0.85, n2(vW.xz * 6.0 + vSeed)) * wet * top * 0.35);
  // wet: the moon shivers in every bed
  vec3 V = normalize(vW - cameraPosition);
  vec2 rp = vW.xz * 13.0 + vSeed * 5.0;
  float amp = 0.1 + 0.4 * uShiver;
  vec3 Nw = normalize(vec3((n2(rp + vec2(uTime * 2.3, 0.0)) - 0.5) * amp, 1.0, (n2(rp * 1.4 + vec2(0.0, -uTime * 1.9)) - 0.5) * amp));
  float m = max(dot(reflect(V, Nw), uMoonDir), 0.0);
  col += uMoonC * (pow(m, 14.0) * 0.9 + pow(m, 4.0) * 0.12) * wet * top * uGlintK;
  gl_FragColor = vec4(finish(col, vW), 1.0);
  ${OUT}
}`

/** sprouts push up as their bed gets wet */
const SPROUT_V = /* glsl */ `
attribute vec4 aBed;
uniform float uOneN, uMany;
varying vec3 vW; varying float vH; varying float vG;
void main() {
  float g = max(clamp((uOneN - aBed.x - 10.0) / 40.0, 0.0, 1.0), smoothstep(aBed.y + 0.5, aBed.y + 1.25, uMany));
  vG = g;
  vH = position.y;
  vec3 p = position * g;
  p.x += position.y * position.y * 0.35 * (fract(aBed.z * 7.31) - 0.5) * g;
  vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`
const SPROUT_F = /* glsl */ `${HEAD}
uniform vec3 uS0, uS1;
varying vec3 vW; varying float vH; varying float vG;
void main() {
  if (vG < 0.02) discard;
  vec3 col = mix(uS0, uS1, smoothstep(0.05, 1.0, vH));
  col = mix(col, uMoonC, smoothstep(0.7, 1.0, vH) * uRimK * 0.7);
  gl_FragColor = vec4(finish(col, vW), 1.0);
  ${OUT}
}`

/** bamboo: the spouts (instanced) and the gutters with the feeder (aRow: -1 = feeder) */
const SPOUT_V = /* glsl */ `
varying vec3 vW; varying vec3 vN;
void main() {
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * (transpose(inverse(mat3(instanceMatrix))) * normal));
  gl_Position = projectionMatrix * viewMatrix * w;
}`
const SPOUT_F = /* glsl */ `${HEAD}
uniform vec3 uB0, uB1, uB2;
varying vec3 vW; varying vec3 vN;
void main() {
  vec3 n = normalize(vN);
  float inside = gl_FrontFacing ? 1.0 : 0.45;
  if (!gl_FrontFacing) n = -n;
  vec3 col = litInk(uB0, uB1, uB2, n, vW, inside);
  gl_FragColor = vec4(finish(col, vW), 1.0);
  ${OUT}
}`
const PIPE_V = /* glsl */ `
attribute float aRow;
varying vec3 vW; varying vec3 vN; varying vec2 vUv; varying float vRow;
void main() {
  vUv = uv;
  vRow = aRow;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`
const PIPE_F = /* glsl */ `${HEAD}
uniform vec3 uB0, uB1, uB2, uWaterC;
uniform float uMany;
varying vec3 vW; varying vec3 vN; varying vec2 vUv; varying float vRow;
void main() {
  vec3 n = normalize(vN);
  vec3 col = litInk(uB0, uB1, uB2, n, vW, 1.0);
  // bamboo nodes
  float nd = abs(fract(vUv.x * (vRow < 0.0 ? 14.0 : 22.0)) - 0.5);
  col = mix(col, mix(uB0, uInk, 0.5), (1.0 - smoothstep(0.02, 0.05, nd)) * 0.5);
  // water running: down the feeder, then along each gutter from the feeder's side
  float f = vRow < 0.0 ? uMany / ${FEED.toFixed(2)} : (uMany - ${FEED.toFixed(2)} * (${(ROWS - 1).toFixed(1)} - vRow) / ${(ROWS - 1).toFixed(1)}) / ${RUN.toFixed(2)};
  float u = vRow < 0.0 ? vUv.x : vUv.x * 1.04 - 0.02;
  float run = step(u, f) * step(0.0, uMany) * (1.0 - smoothstep(2.2, 3.1, uMany));
  float head = smoothstep(f - 0.1, f, u) * run;
  col = mix(col, uWaterC, run * 0.45);
  col += uMoonC * (head * 0.7 + run * 0.12) * uGlintK;
  gl_FragColor = vec4(finish(col, vW), 1.0);
  ${OUT}
}`

/** a thousand drops, one per spout: three beats from its drip time, each falling onto its bed */
const DROP_V = /* glsl */ `
attribute vec2 aDrop;
uniform float uMany, uPx;
varying float vA;
void main() {
  float p = uMany - aDrop.x;
  float beat = floor(p / 0.5);
  float ph = (p - beat * 0.5) / 0.3;
  float on = step(0.0, p) * step(beat, 2.0) * step(ph, 1.0);
  vec3 q = position;
  q.y -= ph * ph * aDrop.y;
  vA = on * (1.0 - beat * 0.28);
  vec4 mv = modelViewMatrix * vec4(q, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = on * uPx / -mv.z;
}`
const DROP_F = /* glsl */ `
uniform vec3 uDropC;
varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = (1.0 - smoothstep(0.25, 0.5, length(c * vec2(1.0, 0.7)))) * vA;
  if (a < 0.02) discard;
  gl_FragColor = vec4(uDropC, a);
  ${OUT}
}`

/** the black lacquer tray under the hill: the moon as a sheen on its rim and a hard line on its edge, the lantern warm on its side */
const LACQ_V = /* glsl */ `
varying vec3 vW; varying vec3 vN;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`
const LACQ_F = /* glsl */ `${HEAD}
uniform vec3 uLacq, uLacqHi;
varying vec3 vW; varying vec3 vN;
void main() {
  vec3 n = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  vec3 col = uLacq * (0.8 + 0.4 * fbm3(vW * vec3(0.6, 3.0, 0.6)));
  // the rim's bevel turns toward the moon behind: one hard silver line along the edge, a soft sheen beside it
  float m = max(dot(reflect(-V, n), normalize(uMoonDir + vec3(0.0, 0.25, 0.0))), 0.0);
  float bevel = smoothstep(0.12, 0.45, n.y) * (1.0 - smoothstep(0.86, 0.98, n.y));
  col += uLacqHi * (pow(m, 30.0) * 0.25 + pow(m, 160.0) * 0.6 + bevel * 0.6);
  col += uLacqHi * pow(1.0 - max(dot(n, V), 0.0), 4.0) * 0.08;
  vec3 lv = uLampP - vW;
  float ld = length(lv);
  col += uLampC * uLampK * 0.7 * max(dot(n, lv / ld), 0.0) / (1.0 + ld * ld * 0.6);
  gl_FragColor = vec4(finish(col, vW), 1.0);
  ${OUT}
}`

/** a soft bank of mist on a plane */
const MIST_V = /* glsl */ `
varying vec2 vUv; varying vec3 vW;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`
const MIST_F = /* glsl */ `
${inkGlsl.noise}
uniform vec3 uMistC;
uniform float uK;
varying vec2 vUv; varying vec3 vW;
void main() {
  float a = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x) * smoothstep(0.0, 0.45, vUv.y) * smoothstep(1.0, 0.4, vUv.y);
  a *= 0.45 + 0.55 * fbm2(vec2(vW.x * 0.35, vUv.y * 2.0) + vW.z);
  gl_FragColor = vec4(uMistC, a * uK);
  ${OUT}
}`

// ───────────── geometry ─────────────
/** one push into flat arrays: position, normal, aC */
class Strip {
  p: number[] = []
  n: number[] = []
  c: number[] = []
  quad(a: number[], b: number[], c: number[], d: number[], nrm: number[], ca: number[], cb: number[], cc: number[], cd: number[]) {
    // a b on one edge, d c on the other (a → b → c → d round the quad)
    for (const [v, k] of [[a, ca], [b, cb], [c, cc], [a, ca], [c, cc], [d, cd]] as [number[], number[]][]) {
      this.p.push(...v)
      this.n.push(...nrm)
      this.c.push(...k)
    }
  }
  geo() {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3))
    g.setAttribute('aC', new THREE.Float32BufferAttribute(this.c, 3))
    return g
  }
}

/** a bed: a squat frustum (top inset), open below; uv across the top, aF = (top?, height share) */
function bedGeo(): THREE.BufferGeometry {
  const b = 0.5, t = 0.3
  const B = [[-b, 0, -b], [b, 0, -b], [b, 0, b], [-b, 0, b]]
  const T = [[-t, 1, -t], [t, 1, -t], [t, 1, t], [-t, 1, t]]
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], f: number[] = []
  const face = (vs: number[][], uvs: number[][], fs: number[][]) => {
    const [a, bb, c] = vs.map((v) => new THREE.Vector3(...v))
    const nn = bb.clone().sub(a).cross(c.clone().sub(a)).normalize()
    for (const k of [0, 1, 2, 0, 2, 3]) {
      pos.push(...vs[k])
      nor.push(nn.x, nn.y, nn.z)
      uv.push(...uvs[k])
      f.push(...fs[k])
    }
  }
  face([T[3], T[2], T[1], T[0]], [[0, 1], [1, 1], [1, 0], [0, 0]], [[1, 1], [1, 1], [1, 1], [1, 1]])
  for (let k = 0; k < 4; k++) {
    const k2 = (k + 1) % 4
    face([B[k], T[k], T[k2], B[k2]], [[0, 0], [0, 1], [1, 1], [1, 0]], [[0, 0], [0, 1], [0, 1], [0, 0]])
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('aF', new THREE.Float32BufferAttribute(f, 2))
  return g
}

/** three blades fanning from the soil, 1 tall */
function sproutGeo(): THREE.BufferGeometry {
  const pos: number[] = []
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.4
    const cx = Math.cos(a), sz = Math.sin(a)
    pos.push(-sz * 0.09, 0, cx * 0.09, sz * 0.09, 0, -cx * 0.09, cx * 0.42, 1 - k * 0.18, sz * 0.42)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  return g
}

// ───────────── palette (read on mount and in onPrefs only) ─────────────
const css = (c: THREE.Color, v: string) => {
  const m = v.match(/rgba?\(([^)]+)\)/)
  if (!m) return c.setStyle(v || '#888', THREE.SRGBColorSpace)
  const [r, g, b] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number)
  return c.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace)
}
const NAMES = ['step-lo', 'step-mid', 'step-hi', 'rock-lo', 'rock-mid', 'rock-hi', 'moss-a', 'moss-b', 'moss-c', 'wash', 'moon', 'moon-rim', 'water', 'paper', 'lantern', 'umbra'] as const
type Tok = (typeof NAMES)[number]

/** One watering can walks the beds in turn (CPU) vs a thousand bamboo spouts drip on every bed at once (GPU). */
export function gardenersScene(ctx: SceneCtx) {
  const gd = guide(ctx)
  const step = gd.steps(G.prompts)
  step(0)
  // one layout read at mount: a tall frame looks down more steeply from farther away (art direction)
  const tall = ctx.art.clientHeight > ctx.art.clientWidth * 1.05
  const yaw0 = tall ? -0.08 : -0.2
  // a tall frame: 45° down (the stage adds 0.13 rad to a tall pitch), the whole tray inside the side gutters
  const VIEW: { pitch: number; fit: [number, number]; target: [number, number, number]; shift: number } = tall
    ? { pitch: 0.655, fit: [20.6, 12], target: [0, 1.0, 1.6], shift: 0.17 }
    : { pitch: 0.46, fit: [13.6, 6.2], target: [-0.3, 1.3, -1.3], shift: 0.0 }
  // the foreground: where the gardener waits (left of the hill on a wide frame, in front of it on a tall one), the stele
  const HOME: [number, number, number] = tall ? [-3.2, 0, 9.6] : [-6.2, 0, 3.6]
  const STELE: [number, number] = tall ? [3.1, 9.2] : [6.5, 4.0]
  const CAN: [number, number] = tall ? [HOME[0] + 1.6, HOME[2] + 0.5] : [HOME[0] + 1.4, HOME[2] + 0.5]
  const low = ctx.quality === 'low'
  const stepped = low || ctx.reduced

  const tok = Object.fromEntries(NAMES.map((n) => [n, new THREE.Color()])) as Record<Tok, THREE.Color>
  const mix = (a: Tok, b: Tok, k: number, out = new THREE.Color()) => out.copy(tok[a]).lerp(tok[b], k)
  const U = (c = new THREE.Color()) => ({ value: c })
  // colours every material reads (the uniform objects are shared: a theme change is one write each)
  const pal = {
    uRimC: U(), uLampP: { value: new THREE.Vector3(-4.6, 0.75, 2.4) }, uLampK: { value: 0.35 }, uRimK: { value: 0.3 }, uGrain: { value: 0.03 }, uLipK: { value: 0.35 }, uGlintK: { value: 0.6 },
  }
  const tones = {
    tread: { uLo: U(), uMid: U(), uHi: U(), uMossLo: U(), uMossMid: U(), uWetSoil: U(), uMossK: { value: 0.12 } },
    wall: { uLo: U(), uMid: U(), uHi: U(), uMossLo: U(), uMossMid: U(), uWetSoil: U(), uMossK: { value: 0 } },
    bed: { uDry0: U(), uDry1: U(), uDry2: U(), uWet0: U(), uWet1: U(), uWet2: U() },
    sprout: { uS0: U(), uS1: U() },
    bamboo: { uB0: U(), uB1: U(), uB2: U(), uWaterC: U() },
    drop: { uDropC: U() },
    tray: { uLacq: U(), uLacqHi: U() },
  }
  let dark = false
  const read = () => {
    const cs = getComputedStyle(document.documentElement)
    NAMES.forEach((n) => css(tok[n], cs.getPropertyValue(`--${n}`).trim()))
    dark = document.documentElement.dataset.theme === 'dark'
    // every lip: a silver line of moonlight (white by day, the moon by night)
    if (dark) mix('moon', 'step-hi', 0.25, pal.uRimC.value)
    else pal.uRimC.value.copy(tok['step-hi'])
    pal.uLampK.value = dark ? 0.9 : 0.45
    pal.uRimK.value = dark ? 0.85 : 0.35
    pal.uGrain.value = dark ? 0.022 : 0.03
    pal.uLipK.value = dark ? 0.75 : 0.9
    pal.uGlintK.value = dark ? 1.2 : 0.9
    const t = tones
    // treads: bare earth between the beds; risers: stone, darkest at their foot (AO in the geometry)
    mix('step-lo', 'wash', dark ? 0.4 : 0.35, t.tread.uLo.value)
    mix('step-lo', 'rock-lo', 0.4, t.tread.uMid.value)
    mix('step-lo', 'step-mid', 0.5, t.tread.uHi.value)
    t.tread.uMossLo.value.copy(tok['moss-b'])
    t.tread.uMossMid.value.copy(tok['moss-a'])
    mix('moss-b', 'wash', dark ? 0.55 : 0.32, t.tread.uWetSoil.value)
    mix('rock-lo', 'wash', dark ? 0.6 : 0.7, t.wall.uLo.value)
    mix('rock-lo', 'wash', dark ? 0.2 : 0.3, t.wall.uMid.value)
    mix('rock-lo', 'rock-mid', 0.6, t.wall.uHi.value)
    t.wall.uMossLo.value.copy(tok['moss-b'])
    t.wall.uMossMid.value.copy(tok['moss-a'])
    // dry beds: pale sand (--step-mid); wet: dark moss (--moss-b) holding a glint of the moon — a strong change of value
    mix('step-mid', 'step-lo', dark ? 0.55 : 0.45, t.bed.uDry0.value)
    t.bed.uDry1.value.copy(tok['step-mid'])
    mix('step-mid', 'step-hi', dark ? 0.7 : 0.6, t.bed.uDry2.value)
    mix('moss-b', 'wash', dark ? 0.7 : 0.55, t.bed.uWet0.value)
    mix('moss-b', 'wash', dark ? 0.35 : 0.25, t.bed.uWet1.value)
    mix('moss-b', 'moss-a', dark ? 0.15 : 0.3, t.bed.uWet2.value)
    // the lacquer: near-black ink, its sheen the moon
    mix('wash', 'umbra', 0.5, t.tray.uLacq.value)
    if (dark) mix('moon', 'step-hi', 0.3, t.tray.uLacqHi.value)
    else mix('step-mid', 'rock-lo', 0.25, t.tray.uLacqHi.value)
    t.sprout.uS0.value.copy(tok['moss-b'])
    mix('moss-a', 'moss-c', 0.6, t.sprout.uS1.value)
    mix('moss-b', 'wash', 0.35, t.bamboo.uB0.value)
    mix('moss-a', 'step-lo', 0.4, t.bamboo.uB1.value)
    mix('moss-c', 'step-mid', 0.45, t.bamboo.uB2.value)
    mix('water', 'moon', dark ? 0.25 : 0.1, t.bamboo.uWaterC.value)
    if (dark) t.drop.uDropC.value.copy(tok.moon)
    else mix('water', 'wash', 0.35, t.drop.uDropC.value)
  }
  read()
  let kit: InkKit | null = null
  let paintPuppet: (() => void) | null = null
  let dropMat: THREE.ShaderMaterial | null = null
  let mistFx: (() => void) | null = null
  let moonQ: THREE.Mesh | null = null
  const MOON: [number, number] = tall ? [0.74, 0.17] : [0.77, 0.2] // the moon's centre, as shares of the frame
  // registered before the build's first yield (README A.10); onPrefs also fires for sound / quality: compare first
  ctx.onCleanup(onPrefs(() => {
    const was = [tok.wash.getHex(), tok.moon.getHex(), dark].join()
    read()
    if (was !== [tok.wash.getHex(), tok.moon.getHex(), dark].join()) paintPuppet?.(), mistFx?.()
    kit?.render()
  }))

  // the run state: one uniform pair drives every bed, sprout, spout and drop
  const RUNU = { uOneN: { value: 0 }, uMany: { value: -1 }, uShiver: { value: 0 } }
  const wetTimes: number[] = [] // when each bed turns wet under the pour (sorted), for the stone's count

  // the stone's engraving and a quiet status line for screen readers (the count itself is not read out as it runs)
  const num = h('span', { class: 't28g-num' })
  const rest = h('span', { class: 't28g-rest' })
  const engr = h('p', { class: `t28g-stele${tall ? ' is-tall' : ''}`, 'aria-hidden': 'true' }, num, rest)
  const status = h('p', { class: 't28-sr' })
  ctx.art.append(status)
  let shownN = -1
  const count = (n: number) => {
    if (n === shownN) return
    shownN = n
    const t = fill(G.rows, { n: sep(Math.min(n, N)) })
    const k = t.indexOf(' ')
    num.textContent = t.slice(0, k)
    rest.textContent = n >= N ? G.done : t.slice(k + 1)
  }
  count(0)
  const say = (t: string) => {
    if (!status.hasAttribute('aria-live')) status.setAttribute('aria-live', 'polite')
    status.textContent = t
  }

  let btnOne: HTMLButtonElement | null = null, btnMany: HTMLButtonElement | null = null
  let shown = false
  // the insight comes only once both ways have been seen (audit v3 28-1): one can, bed after bed; then a thousand spouts
  const seen = { one: false, many: false }
  let dotOne: ReturnType<typeof gd.dot> | null = null, dotMany: ReturnType<typeof gd.dot> | null = null
  function watered(many: boolean) {
    seen[many ? 'many' : 'one'] = true
    ;(many ? dotMany : dotOne)?.done()
    if (shown) return
    if (seen.one && seen.many) {
      shown = true
      ctx.insight(G.insight as Fact, G.detail as Fact)
    } else step(many ? 2 : 1)
  }
  let run = 0 // the current run's token: a new tap cancels the old one
  const timers: number[] = []
  ctx.onCleanup(() => timers.forEach(clearTimeout))
  // gardener pieces (set in the build)
  let man: THREE.Group | null = null
  let manTex: THREE.CanvasTexture | null = null
  let canOnRock: THREE.Object3D | null = null
  let lever: THREE.Object3D | null = null
  const home = new THREE.Vector3(...HOME)
  const pathAt = (th: number) => new THREE.Vector3(...at(th, RP, 0))
  const start = pathAt(-A - 0.04), end = pathAt(A + 0.04)

  /** where the gardener is at time t of the one-can run, and how many beds are wet */
  function poseOne(t: number) {
    let n = 0, p: THREE.Vector3, face = 1, walking = true
    if (t < T1) p = home.clone().lerp(start, ease(t / T1))
    else if (t < T1 + WALK) {
      const f = (t - T1) / WALK
      n = f * N
      p = pathAt(-A - 0.04 + f * (2 * A + 0.08))
    } else {
      n = N
      const u = Math.min(1, (t - T1 - WALK) / T2)
      p = end.clone().lerp(home, ease(u))
      face = -1
      walking = u < 1
    }
    return { n, p, face, walking, carry: t < T1 + WALK + T2 }
  }
  const ease = (u: number) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2)

  function placeMan(p: THREE.Vector3, face: number, carry: boolean, bob: number) {
    if (!man || !manTex) return
    man.position.set(p.x, bob, p.z)
    const fig = man.children[0]
    fig.scale.x = face
    man.children[1].scale.x = face
    manTex.offset.x = carry ? 0.5 : 0
    if (canOnRock) canOnRock.visible = !carry
  }

  function setOne(t: number) {
    const s = poseOne(t)
    RUNU.uOneN.value = s.n
    placeMan(s.p, s.face, s.carry, s.walking && !stepped ? Math.abs(Math.sin(t * 9)) * 0.045 : 0)
    count(Math.floor(s.n))
  }
  function setMany(t: number) {
    RUNU.uMany.value = t
    RUNU.uShiver.value = Math.max(0, 1 - Math.abs(t - 1.5) / 1.7)
    if (lever) lever.rotation.z = -Math.min(1, t / 0.3) * 1.1
    let lo = 0, hi = wetTimes.length
    while (lo < hi) {
      const m = (lo + hi) >> 1
      if (wetTimes[m] <= t) lo = m + 1
      else hi = m
    }
    count(lo)
  }

  function go(many: boolean) {
    if (!kit) return
    const k = kit
    const my = ++run
    timers.forEach(clearTimeout)
    timers.length = 0
    btnOne?.setAttribute('aria-pressed', String(!many))
    btnMany?.setAttribute('aria-pressed', String(many))
    // back to a dry garden, the gardener home, the valve shut
    RUNU.uOneN.value = 0
    RUNU.uMany.value = -1
    RUNU.uShiver.value = 0
    if (lever) lever.rotation.z = 0
    placeMan(home, 1, false, 0)
    count(0)
    say(many ? G.manyAria : G.oneAria)
    ctx.chime('tap')
    const total = many ? POUR : T1 + WALK + T2
    const set = many ? setMany : setOne
    const done = () => {
      if (my !== run) return
      set(total)
      k.render()
      say(G.done)
      ctx.chime(many ? 'ok' : 'soft')
      watered(many)
    }
    if (stepped) {
      // low / reduced: the can jumps along in a few steps (4 under reduced motion), the pour in three
      const steps = many ? (ctx.reduced ? [] : [0.6, 1.1]) : Array.from({ length: ctx.reduced ? 4 : 9 }, (_, i) => T1 + (WALK * (i + 1)) / (ctx.reduced ? 4 : 9))
      const gap = many ? 450 : (WALK * 1000) / steps.length
      steps.forEach((t, i) => timers.push(window.setTimeout(() => my === run && (set(t), k.render()), gap * (i + (many ? 1 : 0.5)))))
      timers.push(window.setTimeout(done, gap * (steps.length + (many ? 1 : 0.5))))
      set(many ? 0.3 : T1)
      k.render()
      return
    }
    let t = 0
    k.animate((dt) => {
      if (my !== run) return false
      t = Math.min(total, t + dt)
      set(t)
      if (t >= total) done()
      return t < total
    })
  }

  inkStage(ctx, ctx.art, {
    label: G.art, hint: G.hint, fov: 35, dpr: [1.75, 1], idle: 0, sway: false,
    view: {
      yaw: yaw0, pitch: VIEW.pitch, yawRange: [yaw0 - 0.52, yaw0 + 0.52], pitchRange: tall ? [0.22, 0.74] : [0.35, 0.87],
      fit: VIEW.fit, target: VIEW.target, shift: VIEW.shift, home: true, zoomRange: [0.7, 1.25],
    },
    fallback: (host) => fieldFallback(ctx, host, { go: (many, el) => fbGo(many, el) }),
  }, function* (k) {
    kit = k
    const U0 = k.uniforms
    const defines = { OCT: k.low ? 2 : 4 }
    const base = { ...U0, ...pal }
    const shader = (v: string, f: string, extra: Record<string, THREE.IUniform>, o: Partial<THREE.ShaderMaterialParameters> = {}) =>
      new THREE.ShaderMaterial({ vertexShader: v, fragmentShader: f, defines, uniforms: { ...base, ...RUNU, ...extra }, ...o })
    U0.uMist.value.set(0.45, 0.3) // a thin ground mist: the lacquer stays black

    // a low full moon over the far ranges, right of the hill (in front of the camera on a tall frame)
    moonQ = k.backdrop({ moon: tall ? [0.3, 0.2, -0.93] : [0.45, 0.16, -0.88], seed: 10 }).children[0] as THREE.Mesh
    k.ground({ r: 15, center: [0, -2.5] })
    // low mist on both flanks and along the plinth, so the hill sits in the night instead of on a table
    const cs = getComputedStyle(document.documentElement)
    const mistU = { uMistC: U(css(new THREE.Color(), cs.getPropertyValue('--mist').trim())), uK: { value: 0 } }
    const mistK = () => void (mistU.uK.value = (dark ? 0.32 : 0.8) * (parseFloat(cs.getPropertyValue('--mist-a')) || 0.5))
    mistK()
    mistFx = () => (css(mistU.uMistC.value, getComputedStyle(document.documentElement).getPropertyValue('--mist').trim()), mistK())
    const mistM = new THREE.ShaderMaterial({ vertexShader: MIST_V, fragmentShader: MIST_F, defines, transparent: true, depthWrite: false, uniforms: { ...U0, ...mistU } })
    for (const [x, y, z, w, hh, ry] of [[-10.2, 0.9, -5.2, 9, 2.6, 0.9], [10.4, 0.9, -5.4, 9, 2.4, -0.9], [0, 0.16, 2.3, 22, 0.55, 0], [0, 4.2, -9.5, 18, 2.2, 0]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), mistM)
      m.position.set(x, y, z)
      m.rotation.y = yaw0 + ry
      m.renderOrder = 5
      m.raycast = () => {}
      k.root.add(m)
    }
    yield

    // ── the terraced hill: treads (earth, moss on the crest), risers (stone, a dark band of occlusion at the foot);
    // past the fan's ends the rows sink into the hillside (fallK), so the sides fall away instead of ending in a cut
    const segs = k.low ? 36 : 72
    const tread = new Strip(), wall = new Strip()
    const AE = A + FALL
    const yAt = (i: number, th: number) => TRAY + (Y(i) - TRAY) * fallK(th)
    const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3()
    const nrmOf = (a: number[], b: number[], c: number[], ref: number[]) => {
      v1.set(b[0] - a[0], b[1] - a[1], b[2] - a[2])
      v2.set(c[0] - a[0], c[1] - a[1], c[2] - a[2])
      v0.crossVectors(v1, v2).normalize()
      if (v0.x * ref[0] + v0.y * ref[1] + v0.z * ref[2] < 0) v0.negate()
      return [v0.x, v0.y, v0.z]
    }
    for (let i = 0; i <= ROWS; i++) {
      const crest = i === ROWS
      for (let s = 0; s < segs; s++) {
        const a0 = -AE + (2 * AE * s) / segs, a1 = -AE + (2 * AE * (s + 1)) / segs
        const side = fallK((a0 + a1) / 2) < 0.999 // the shoulders: moss and wild grass, no beds
        const r1a = Rl(i, a0), r1b = Rl(i, a1)
        const r2a = crest ? r1a - 1.6 : Rl(i + 1, a0), r2b = crest ? r1b - 1.6 : Rl(i + 1, a1)
        const ya = yAt(i, a0), yb = yAt(i, a1)
        const y0a = i ? yAt(i - 1, a0) : TRAY, y0b = i ? yAt(i - 1, a1) : TRAY
        const m = crest ? 1 : side ? 0.55 : 0
        const A0 = at(a0, r1a, ya), B0 = at(a1, r1b, yb), C0 = at(a1, r2b, yb), D0 = at(a0, r2a, ya)
        // tread: lit lip in front, the next riser's occlusion at the back
        const back = crest ? 0.9 : 0.3
        tread.quad(A0, B0, C0, D0, nrmOf(A0, B0, C0, [0, 1, 0]), [1, 0, m], [1, 0, m], [back, r1b - r2b, m], [back, r1a - r2a, m])
        // riser in front of the tread
        const am = (a0 + a1) / 2
        const out = [Math.sin(am), 0, Math.cos(am)]
        const F0 = at(a0, r1a, y0a), F1 = at(a1, r1b, y0b)
        wall.quad(F0, F1, B0, A0, nrmOf(F0, F1, B0, out), [0.08, ya - y0a, 0], [0.08, yb - y0b, 0], [1, 0, 0], [1, 0, 0])
        if (crest) {
          const E0 = at(a0, r2a, TRAY), E1 = at(a1, r2b, TRAY)
          wall.quad(E1, E0, D0, C0, out.map((v) => -v), [0.5, yb - TRAY, 0], [0.5, ya - TRAY, 0], [0.9, 0, 0], [0.9, 0, 0])
        }
      }
      if (i % 5 === 4) yield
    }
    const field = (t: typeof tones.tread) => shader(FIELD_V, FIELD_F, t)
    k.mesh(tread.geo(), field(tones.tread), { outline: false })
    k.mesh(wall.geo(), field(tones.wall))
    // the black lacquer tray: a D under the fan, its rim catching the moon
    const RT = R0 + 0.6
    const shp = new THREE.Shape()
    shp.absarc(0, 0, RT, Math.PI, Math.PI * 2, false)
    shp.lineTo(RT, 1.2)
    shp.lineTo(-RT, 1.2)
    shp.closePath()
    const trayG = new THREE.ExtrudeGeometry(shp, { depth: TRAY - 0.08, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.1, bevelSegments: k.low ? 1 : 3, curveSegments: k.low ? 40 : 90 })
    trayG.rotateX(-Math.PI / 2)
    trayG.translate(0, 0.04, HZ)
    k.mesh(trayG, shader(LACQ_V, LACQ_F, tones.tray), { outline: false })
    yield

    // ── beds, sprouts, spouts, drops: one instance each per (row, column)
    const bedG = bedGeo()
    const order = new Float32Array(N * 4)
    const beds = new THREE.InstancedMesh(bedG, shader(BED_V, BED_F, tones.bed), N)
    const sprouts = new THREE.InstancedMesh(sproutGeo(), shader(SPROUT_V, SPROUT_F, tones.sprout, { side: THREE.DoubleSide }), N)
    const spoutG = new THREE.CylinderGeometry(0.5, 0.5, 1, k.low ? 3 : 7, 1, true)
    spoutG.translate(0, 0.5, 0)
    spoutG.rotateX(Math.PI / 2) // its axis along +z
    const spouts = new THREE.InstancedMesh(spoutG, shader(SPOUT_V, SPOUT_F, tones.bamboo, { side: THREE.DoubleSide }), N)
    const dropPos = new Float32Array(N * 3), dropAttr = new Float32Array(N * 2)
    const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e3 = new THREE.Euler(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3()
    const rnd = rng(2810)
    for (let i = 0; i < ROWS; i++) {
      const w = (R[i] * 2 * A) / COLS
      const bh = 0.03 + w * 0.07
      const pr = 0.008 + w * 0.035 // gutter radius
      for (let j = 0; j < COLS; j++) {
        const b = i * COLS + j
        const th = thOf(j)
        const dR = Rl(i, th) - Rl(i + 1, th)
        // the bed
        v3.set(...at(th, Rl(i, th) - dR * 0.47, Y(i)))
        q4.setFromAxisAngle(new THREE.Vector3(0, 1, 0), th)
        s3.set(w * (0.8 + rnd() * 0.1), bh * (0.8 + rnd() * 0.4), dR * (0.58 + rnd() * 0.1))
        beds.setMatrixAt(b, m4.compose(v3, q4, s3))
        // its sprout
        v3.y += bh
        s3.set(dR * 0.9, dR * (1.1 + rnd() * 0.5), dR * 0.9)
        sprouts.setMatrixAt(b, m4.compose(v3, q4, s3))
        // the spout over it, from the gutter on the lip above
        const drip = rowStart(i) + (RUN * (j + 0.5)) / COLS + 0.05 + rnd() * 0.05
        order[b * 4] = j * ROWS + i // the one can goes column by column, front to back
        order[b * 4 + 1] = drip
        order[b * 4 + 2] = rnd()
        wetTimes.push(drip + 0.38)
        const L = dR * (0.4 + rnd() * 0.12), tilt = 0.12 + rnd() * 0.16
        const g0 = at(th, Rl(i + 1, th) - pr * 0.6, Y(i + 1) + pr)
        e3.set(tilt, th, 0, 'YXZ')
        q4.setFromEuler(e3)
        s3.set(pr * 0.62, pr * 0.62, L)
        spouts.setMatrixAt(b, m4.compose(v3.set(...g0), q4, s3))
        const mouth = [g0[0] + Math.sin(th) * Math.cos(tilt) * L, g0[1] - Math.sin(tilt) * L, g0[2] + Math.cos(th) * Math.cos(tilt) * L]
        dropPos.set(mouth, b * 3)
        dropAttr[b * 2] = drip
        dropAttr[b * 2 + 1] = Math.max(0.03, mouth[1] - (Y(i) + bh))
      }
      if (i % 6 === 5) yield
    }
    wetTimes.sort((a, b) => a - b)
    const aBed = new THREE.InstancedBufferAttribute(order, 4)
    bedG.setAttribute('aBed', aBed)
    sprouts.geometry.setAttribute('aBed', aBed)
    for (const m of [beds, sprouts, spouts]) {
      m.instanceMatrix.needsUpdate = true
      m.frustumCulled = false
      m.raycast = () => {}
      k.root.add(m)
    }
    const dropG = new THREE.BufferGeometry()
    dropG.setAttribute('position', new THREE.BufferAttribute(dropPos, 3))
    dropG.setAttribute('aDrop', new THREE.BufferAttribute(dropAttr, 2))
    const dropM = (dropMat = new THREE.ShaderMaterial({ vertexShader: DROP_V, fragmentShader: DROP_F, transparent: true, depthWrite: false, uniforms: { ...RUNU, ...tones.drop, uPx: { value: 30 } } }))
    const drops = new THREE.Points(dropG, dropM)
    drops.frustumCulled = false
    drops.renderOrder = 3
    drops.raycast = () => {}
    k.root.add(drops)
    yield

    // ── the gutters on every lip and the feeder down the left flank
    const tubes: THREE.BufferGeometry[] = []
    const tube = (pts: THREE.Vector3[], r: number, row: number, segN: number) => {
      const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), segN, r, k.low ? 4 : 6, false)
      g.setAttribute('aRow', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(row), 1))
      tubes.push(g)
    }
    for (let i = 0; i < ROWS; i++) {
      const w = (R[i] * 2 * A) / COLS
      const pr = 0.008 + w * 0.035
      const pts = Array.from({ length: 25 }, (_, s) => {
        const th = -A - 0.03 + ((2 * A + 0.04) * s) / 24
        return new THREE.Vector3(...at(th, Rl(i + 1, th) - pr * 0.6, Y(i + 1) + pr))
      })
      tube(pts, pr, i, k.low ? 24 : 48)
    }
    // the feeder runs down the left shoulder just behind the row ends, sunk to the lip of every row so it reads as part of
    // the terraces (not a ladder): it climbs each riser's back and lies along each tread
    const thF = -A - 0.05
    const feed = [new THREE.Vector3(...at(-A + 0.12, R[ROWS] - 0.5, Y(ROWS) + 0.18)), new THREE.Vector3(...at(thF, Rl(ROWS, thF) - 0.05, Y(ROWS) + 0.02))]
    for (let i = ROWS - 1; i >= 0; i -= 2) feed.push(new THREE.Vector3(...at(thF, Rl(i + 1, thF) - 0.02, TRAY + (Y(i + 1) - TRAY) * fallK(thF) - 0.01)))
    feed.push(new THREE.Vector3(...at(thF, Rl(0, thF) - 0.15, TRAY + PLINTH * 0.5)))
    tube(feed, 0.045, -1, 60)
    const pipes = new THREE.Mesh(mergeGeometries(tubes)!, shader(PIPE_V, PIPE_F, tones.bamboo))
    tubes.forEach((g) => g.dispose())
    pipes.raycast = () => {}
    k.root.add(pipes)
    yield

    // ── the spring on the crest: a mossy rock, the bamboo head of the feeder, the valve and its lever
    const sp = at(-A + 0.06, R[ROWS] - 0.62, 0)
    const spring = new THREE.Group()
    const rockS = k.rock({ at: [sp[0] - 0.2, sp[2] - 0.3], w: 1.35, h: 1.0, seed: 31, moss: 0.85, ring: false })
    rockS.position.y = Y(ROWS) - 0.04
    spring.add(rockS)
    const bam = k.ink('bamboo', { rim: 1.2 })
    const head = k.mesh(new THREE.CylinderGeometry(0.1, 0.11, 1.0, 9), bam, { parent: spring })
    head.position.set(feed[0].x + 0.1, feed[0].y + 0.32, feed[0].z - 0.1)
    head.rotation.z = 0.5
    const valve = k.mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.34, 10), k.ink('bark'), { parent: spring })
    valve.position.copy(feed[1]).add(new THREE.Vector3(0, 0.02, 0))
    valve.rotation.x = Math.PI / 2
    lever = new THREE.Group()
    lever.position.copy(valve.position).add(new THREE.Vector3(0, 0.08, 0))
    const arm = k.mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), k.ink('bark', { rim: 1.4 }), { parent: lever })
    arm.position.y = 0.42
    const grip = k.mesh(new THREE.BoxGeometry(0.22, 0.08, 0.1), k.ink('bark', { rim: 1.4 }), { parent: lever })
    grip.position.y = 0.86
    spring.add(lever)
    k.root.add(spring)
    k.root.updateMatrixWorld(true)
    btnMany = k.tappable(spring, G.manyAria, () => go(true))
    btnMany.setAttribute('aria-pressed', 'false')
    dotMany = gd.dot(btnMany, { dir: [0, 1] })
    k.label(spring, h('p', { class: 't28g-tag' }, G.many), [0.15, 0.12, 0])
    // the crest: a pine leaning toward the moon, a second rock
    if (!k.low) {
      const pn = at(0.2, R[ROWS] - 0.7, 0)
      const pine = k.pine({ at: [pn[0], pn[2]], h: 2.3, lean: 1, seed: 12 })
      pine.position.y = Y(ROWS) - 0.02
    }
    const r2 = at(0.33, R[ROWS] - 0.35, 0)
    k.rock({ at: [r2[0], r2[2]], w: 0.6, h: 0.42, seed: 33, moss: 0.7, ring: false }).position.y = Y(ROWS) - 0.03
    yield

    // ── the foreground: stepping stones, a lit lantern, the can on its rock, the stele with the count
    k.stones([HOME[0] - 1.4, HOME[2] + 2.8], [HOME[0], HOME[2] + 0.05], 4, { size: 0.7, seed: 9, bend: 0.4 })
    const lampAt: [number, number] = tall ? [HOME[0] - 1.6, HOME[2] - 1.1] : [HOME[0] - 1.3, HOME[2] - 1.3]
    k.toro({ at: lampAt, h: 1.35, lit: 1 })
    pal.uLampP.value.set(lampAt[0], 0.85, lampAt[1])
    const canGroup = new THREE.Group()
    const canRock = k.rock({ at: CAN, w: 0.7, h: 0.38, seed: 21, moss: 0.55 })
    canGroup.add(canRock)
    const can = new THREE.Group()
    const iron = k.ink('rock', { moss: 0, rim: 1.3 })
    k.mesh(new THREE.CylinderGeometry(0.11, 0.125, 0.2, 12), iron, { parent: can }).position.y = 0.1
    const spoutM = k.mesh(new THREE.CylinderGeometry(0.014, 0.022, 0.34, 6), iron, { parent: can })
    spoutM.position.set(0.17, 0.2, 0)
    spoutM.rotation.z = -0.95
    const rose = k.mesh(new THREE.CylinderGeometry(0.045, 0.016, 0.05, 8), iron, { parent: can })
    rose.position.set(0.31, 0.3, 0)
    rose.rotation.z = -0.95
    const handle = k.mesh(new THREE.TorusGeometry(0.1, 0.014, 5, 12, Math.PI), iron, { parent: can })
    handle.position.y = 0.2
    can.position.set(CAN[0], 0.31, CAN[1])
    can.scale.setScalar(1.25)
    can.rotation.y = 0.6
    canGroup.add(can)
    canOnRock = can
    k.root.add(canGroup)
    k.root.updateMatrixWorld(true)
    btnOne = k.tappable(canGroup, G.oneAria, () => go(false))
    btnOne.setAttribute('aria-pressed', 'false')
    dotOne = gd.dot(btnOne, { dir: [0, -1] })
    // its name is cut on the stone under it (anchored at the stone's foot, set below by CSS), clear of the gardener's head
    k.label(canRock, h('p', { class: 't28g-tag t28g-under' }, G.one), [0, -0.4, 0.42])
    const stele = new THREE.Group()
    const slab = k.mesh(new THREE.BoxGeometry(tall ? 5 : 2.7, tall ? 2.4 : 1.25, 0.2), k.ink('rock', { moss: 0.3 }), { parent: stele })
    slab.position.y = tall ? 1.25 : 0.7
    if (tall) slab.rotation.x = -0.42 // leaning back on its foot, its face toward a camera that looks down 45°
    const foot = k.mesh(new THREE.BoxGeometry(tall ? 5.3 : 2.95, 0.16, tall ? 0.9 : 0.46), k.ink('rock', { moss: 0.5 }), { parent: stele })
    foot.position.y = 0.07
    stele.position.set(STELE[0], 0, STELE[1])
    stele.rotation.y = yaw0 - 0.25
    k.root.add(stele)
    k.root.updateMatrixWorld(true) // labels measure their object's box now
    k.label(slab, engr, [0, tall ? -1.25 : -0.85, tall ? 0.5 : 0.1])
    yield

    // ── the gardener: a paper puppet standing in 3D (bunraku), his long moon shadow on the sand
    const tw = k.low ? 512 : 1024
    const cv = document.createElement('canvas')
    cv.width = tw
    cv.height = tw / 2
    manTex = new THREE.CanvasTexture(cv)
    manTex.colorSpace = THREE.SRGBColorSpace
    manTex.repeat.set(0.5, 1)
    paintPuppet = () => {
      drawPuppet(cv, tok, dark)
      if (manTex) manTex.needsUpdate = true
    }
    paintPuppet()
    const HP = 2
    const pg = new THREE.PlaneGeometry(HP, HP)
    pg.translate(HP * 0.28, HP * 0.485, 0) // the feet at the origin (drawn at 22 % across, 98.5 % down)
    man = new THREE.Group()
    const fig = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ map: manTex, transparent: true, alphaTest: 0.04, side: THREE.DoubleSide }))
    fig.rotation.y = yaw0
    fig.renderOrder = 2
    const shade = new THREE.Group()
    const md = k.uniforms.uMoonDir.value as THREE.Vector3
    shade.rotation.y = Math.atan2(md.x, md.z) // the figure's up lies along the ground, away from the moon
    // the moon is low: his shadow runs long across the sand toward us
    const sh = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ map: manTex, color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }))
    sh.rotation.x = -Math.PI / 2
    sh.scale.set(1, 3.4, 1)
    sh.position.y = 0.015
    sh.renderOrder = -3
    shade.add(sh)
    man.add(fig, shade)
    fig.raycast = sh.raycast = () => {}
    k.root.add(man)
    placeMan(home, 1, false, 0)
  }).ready.then((k) => {
    if (!k?.stage) return
    const st = k.stage
    const size = (w: number, hh: number) => {
      const tv = Math.tan((st.camera.fov * Math.PI) / 360), asp = w / hh
      // the haze starts just behind the front rows and swallows the crest a little, whatever the frame (inkStage's fit)
      const d = Math.max((VIEW.fit[0] * (asp < 1 ? 0.56 : 1)) / (tv * asp), VIEW.fit[1] / tv)
      ;(k.uniforms.uFog.value as THREE.Vector2).set(d * 0.95, d * 2.6)
      // the moon: large and low behind the hill's right shoulder (about 18 % of the frame's height), wherever the frame
      // puts the horizon — its billboard sits on the ray through that point of the hero view (the light keeps uMoonDir)
      if (moonQ) {
        const pitch = VIEW.pitch + (asp < 1 ? 0.13 : 0), T = new THREE.Vector3(...VIEW.target)
        const cam = new THREE.PerspectiveCamera(st.camera.fov, asp, 0.1, 500)
        cam.position.set(T.x + d * Math.cos(pitch) * Math.sin(yaw0), T.y + d * Math.sin(pitch), T.z + d * Math.cos(pitch) * Math.cos(yaw0))
        cam.lookAt(T)
        cam.setViewOffset(w, hh, 0, -VIEW.shift * hh, w, hh)
        cam.updateMatrixWorld()
        const ray = new THREE.Vector3(MOON[0] * 2 - 1, 1 - MOON[1] * 2, 0.5).unproject(cam).sub(cam.position).normalize()
        moonQ.position.copy(cam.position).addScaledVector(ray, 100)
        ;(moonQ.material as THREE.ShaderMaterial).uniforms.uSize.value.setScalar((0.18 * tv * 100) / 0.085)
      }
      // a drop is ~5 cm across
      if (dropMat) dropMat.uniforms.uPx.value = (0.075 * hh * st.renderer.getPixelRatio()) / (2 * tv)
      k.render()
    }
    size(st.width, st.height)
    st.onResize(size)
  })

  // no WebGL: the painted field takes the taps
  function fbGo(many: boolean, el: { set(k: number): void; done(): void }) {
    const my = ++run
    timers.forEach(clearTimeout)
    timers.length = 0
    say(many ? G.manyAria : G.oneAria)
    const steps = many ? 3 : ctx.reduced ? 4 : 9
    const gap = many ? 380 : (WALK * 1000) / steps
    el.set(0)
    for (let i = 1; i <= steps; i++)
      timers.push(window.setTimeout(() => {
        if (my !== run) return
        el.set(i / steps)
        if (i === steps) {
          el.done()
          say(G.done)
          ctx.chime(many ? 'ok' : 'soft')
          watered(many)
        }
      }, gap * i))
  }
}

/** the puppet's two poses side by side: waiting, and carrying the can (spray from its rose); a moonlit rim on the right */
function drawPuppet(cv: HTMLCanvasElement, tok: Record<Tok, THREE.Color>, dark: boolean) {
  const c = cv.getContext('2d')
  if (!c) return
  const W = cv.width / 2, H = cv.height
  const hex = (x: THREE.Color) => `#${x.getHexString(THREE.SRGBColorSpace)}`
  const ink = hex(tok.wash), rim = hex(dark ? tok.moon : tok['step-hi']), water = hex(dark ? tok.moon : tok.water)
  const L = hex(tok.lantern)
  const lamp = (a: number) => `rgba(${parseInt(L.slice(1, 3), 16)},${parseInt(L.slice(3, 5), 16)},${parseInt(L.slice(5, 7), 16)},${a})`
  c.clearRect(0, 0, cv.width, H)
  for (const pose of [0, 1]) {
    c.save()
    c.translate(pose * W, 0)
    const k = H * 0.84, x = W * 0.22, y = H * 0.985
    const body = new Path2D(figure(x, y, k, 2811, 1, { hat: 'cone', stoop: 0.35 }))
    const cp: Pt = [x + k * 0.36, y - k * 0.5]
    const can = pose ? new Path2D(blob(cp[0], cp[1], k * 0.13, k * 0.1, 2812, 0.05, 10) +
      stroke([[cp[0] + k * 0.1, cp[1] - k * 0.02], [cp[0] + k * 0.24, cp[1] - k * 0.1], [cp[0] + k * 0.34, cp[1] - k * 0.16]], k * 0.035, 0.1, 0.1, 0.5) +
      stroke(curve([cp[0] - k * 0.1, cp[1] - k * 0.06], [cp[0] - k * 0.02, cp[1] - k * 0.2], [cp[0] + k * 0.08, cp[1] - k * 0.07], 6), k * 0.025, 0.1, 0.1, 0.5)) : null
    // the moon behind his right shoulder: the whole figure in moonlight, the body over it shifted away
    c.fillStyle = rim
    c.fill(body)
    if (can) c.fill(can)
    c.save()
    c.translate(-k * 0.014, k * 0.01)
    c.fillStyle = ink
    c.fill(body)
    if (can) c.fill(can)
    // the lantern stands on his left: warm light across that side of the robe and the hat
    c.clip(body)
    const g = c.createLinearGradient(x - k * 0.2, 0, x + k * 0.1, 0)
    g.addColorStop(0, lamp(dark ? 0.8 : 0.62))
    g.addColorStop(0.45, lamp(dark ? 0.3 : 0.2))
    g.addColorStop(1, lamp(0))
    c.fillStyle = g
    c.fillRect(0, 0, W, H)
    c.restore()
    // the moon behind his right shoulder catches the cone of the hat: its right slope and the brim's edge
    const u = k / 10, nk: Pt = [x + 0.35 * u * 3, y - u * 7.6], hd: Pt = [nk[0] + 0.35 * u * 1.2, nk[1] - u * 1.1]
    c.strokeStyle = rim
    c.lineCap = 'round'
    c.lineWidth = u * 0.26
    c.beginPath()
    c.moveTo(hd[0] + u * 0.15, hd[1] - u * 1.1)
    c.quadraticCurveTo(hd[0] + u * 1.15, hd[1] - u * 0.72, hd[0] + u * 2, hd[1] - u * 0.12)
    c.stroke()
    c.lineWidth = u * 0.16
    c.globalAlpha = 0.8
    c.beginPath()
    c.moveTo(hd[0] + u * 2, hd[1] - u * 0.1)
    c.quadraticCurveTo(hd[0] + u * 0.8, hd[1] - u * 0.35, hd[0] - u * 0.4, hd[1] - u * 0.36)
    c.stroke()
    c.globalAlpha = 1
    if (pose) {
      c.fillStyle = water
      c.globalAlpha = 0.85
      const r = rng(2813)
      for (let i = 0; i < 4; i++) {
        const a: Pt = [cp[0] + k * 0.35, cp[1] - k * 0.14]
        c.fill(new Path2D(stroke([a, [a[0] + k * (0.05 + i * 0.03), a[1] + k * (0.06 + i * 0.05 + r() * 0.02)]], k * 0.016, 0.1, 0.6, 0.2)))
      }
      c.globalAlpha = 1
    }
    c.restore()
  }
}
