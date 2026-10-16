import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { createStage, type Stage } from '../../core/three-stage'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import { onPrefs } from '../../core/prefs'
import { h } from '../../core/dom'
import type { SceneCtx } from '../../stations/types'
import { rng } from './ink'
import { diorama, nightGarden } from './depth'
import './part2.css'
import './stage3d.css'

/**
 * Moonlit sumi-e 3D for Part 2 (README "stage3d"): one createStage, ink-wash toon materials (brushed terminator, dry
 * strokes, moss, moon rim, lantern fill, paper grain, depth haze), procedural garden pieces, orbit with inertia, tappable
 * objects with focusable DOM proxies. Built in sliced steps, renders on demand (a loop only while something moves, plus a
 * gentle sway at quality=high), colours follow the theme tokens, everything is disposed on unmount.
 */

export type Tone = 'rock' | 'step' | 'moss' | 'pine' | 'bark' | 'bamboo'
export type V3 = [number, number, number]
export type XZ = [number, number]

export interface InkView {
  /** camera turn around the target in radians (0 looks toward -z), pitch above the ground */
  yaw?: number
  pitch?: number
  yawRange?: [number, number]
  pitchRange?: [number, number]
  /** half-width, half-height (world units) around the target that must stay in frame */
  fit?: [number, number]
  /** lens shift: share of the height the frame moves up, for more sky (default 0.12) */
  shift?: number
  target?: V3
}
export interface InkOpts {
  /** aria-label of the 3D view (from content JSON) */
  label: string
  /** aria-description: how to move it (from content JSON) */
  hint?: string
  view?: InkView
  fov?: number
  /** tilt the view with the phone (deviceorientation) */
  gyro?: boolean
  /** gentle idle sway at quality=high (default true) */
  sway?: boolean
  /** drawn instead when there is no WebGL (default: the nightGarden diorama, depth.ts); returns its cleanup */
  fallback?: (host: HTMLElement) => () => void
}
export interface InkKit {
  /** everything in the garden; built detached, added to the stage when the build ends */
  readonly root: THREE.Group
  readonly low: boolean
  /** null until the build has ended */
  readonly stage: Stage | null
  /** ink-wash material; each call is its own material (the shader program is shared) */
  ink(tone: Tone, o?: { moss?: number; rim?: number; edge?: number; double?: boolean }): THREE.ShaderMaterial
  /** a mesh in root with an inverted-hull brush outline (outline: false to skip); cast: soft ink shadow on the ground */
  mesh(geo: THREE.BufferGeometry, mat: THREE.Material, o?: { outline?: boolean; cast?: boolean; at?: V3; parent?: THREE.Object3D }): THREE.Mesh
  rock(o?: { at?: XZ; w?: number; h?: number; d?: number; seed?: number; moss?: number; tone?: Tone; rotY?: number; ring?: boolean }): THREE.Group
  stones(from: XZ, to: XZ, n: number, o?: { size?: number; seed?: number; bend?: number }): THREE.Group
  toro(o?: { at?: XZ; h?: number; rotY?: number; lit?: boolean }): THREE.Group
  bamboo(o?: { at?: XZ; n?: number; h?: number; seed?: number }): THREE.Group
  pine(o?: { at?: XZ; h?: number; seed?: number; lean?: number }): THREE.Group
  /** raked sand disc that melts into mist at its rim; rings round every rock built with ring: true; receives shadows */
  ground(o?: { r?: number; center?: XZ }): THREE.Mesh
  /** still water with the moon's broken road and the lantern's warm streak */
  pond(o?: { at?: XZ; r?: XZ; seed?: number }): THREE.Mesh
  /** moon + glow, three ink mountain ranges, drifting mist banks */
  backdrop(o?: { moon?: V3; seed?: number; mist?: number }): THREE.Group
  /** a soft glow sprite (lantern or moon colour) */
  glow(at: V3, size: number, color?: 'lantern' | 'moon', k?: number): THREE.Mesh
  /** make obj tappable: raycast for pointer, a focusable button (pointer-events: none) over it for keyboard / screen reader */
  tappable(obj: THREE.Object3D, label: string, onTap: () => void): HTMLButtonElement
  /** the tappable object under a client point, or null */
  pick(clientX: number, clientY: number): THREE.Object3D | null
  /** turn the view (radians, clamped to the ranges) */
  turn(yaw: number, pitch?: number): void
  /** request one frame (after you change something) */
  render(): void
}
export interface InkHandle {
  /** the kit once the stage is up, or null without WebGL (the fallback is already drawn) */
  ready: Promise<InkKit | null>
  dispose(): void
}

// ───────────────────────────── GLSL ─────────────────────────────
const NOISE = /* glsl */ `
float h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float h31(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float n2(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float n3(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1, 0, 0)), f.x), mix(h31(i + vec3(0, 1, 0)), h31(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(h31(i + vec3(0, 0, 1)), h31(i + vec3(1, 0, 1)), f.x), mix(h31(i + vec3(0, 1, 1)), h31(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm2(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < OCT; i++) { s += a * n2(p); p = p * 2.03 + 11.7; a *= 0.5; } return s / (1.0 - pow(0.5, float(OCT))); }
float fbm3(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < OCT; i++) { s += a * n3(p); p = p * 2.03 + 11.7; a *= 0.5; } return s / (1.0 - pow(0.5, float(OCT))); }
`
/** depth haze toward the paper, plus low mist lying in the far ground */
const HAZE = /* glsl */ `
uniform vec3 uFogC;
uniform vec2 uFog;
uniform vec2 uMist;
uniform float uTime;
float hazeK(vec3 w) {
  float d = distance(w, cameraPosition);
  float f = smoothstep(uFog.x, uFog.y, d);
  float low = (1.0 - smoothstep(0.0, uMist.x, w.y)) * uMist.y * smoothstep(uFog.x * 0.6, uFog.y, d * 1.4) * (0.55 + 0.45 * n2(w.xz * 0.35 + vec2(uTime * 0.03, 0.0)));
  return clamp(f + low * (1.0 - f), 0.0, 1.0);
}
vec3 haze(vec3 c, vec3 w) { return mix(c, uFogC, hazeK(w)); }
`
const WORLD_VERT = /* glsl */ `
varying vec3 vW;
varying vec3 vN;
varying vec3 vO;
varying vec2 vUv;
void main() {
  vO = position;
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`

const INK_FRAG = /* glsl */ `
${NOISE}
${HAZE}
uniform vec3 uLo, uMid, uHi, uInk, uMoonC, uLampC, uMossLo, uMossMid, uMossHi;
uniform vec3 uKey, uMoonDir, uLampP;
uniform float uLampK, uMossK, uHot, uSeed, uGrain, uRim, uEdge;
varying vec3 vW;
varying vec3 vN;
varying vec3 vO;
void main() {
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  vec3 V = normalize(cameraPosition - vW);
  float wob = (fbm3(vO * 2.4 + uSeed) - 0.5) * 0.6;
  float nl = dot(n, uKey);
  // three washes (shadow, body, lit plane) with a brushed, wandering terminator
  float lit = smoothstep(-0.14, 0.2, nl + wob);
  float top = smoothstep(0.45, 0.8, nl + wob * 0.7);
  vec3 col = mix(uLo, uMid, lit);
  col = mix(col, uHi, top * 0.9);
  // an ink seam where light turns to shadow, dry strokes inside the shadow
  float seam = 1.0 - smoothstep(0.0, 0.11, abs(nl + wob + 0.02));
  col = mix(col, uInk, seam * 0.2 * uEdge);
  float dry = smoothstep(0.6, 0.92, n2(vec2(dot(vO, vec3(0.7, 0.15, 0.7)) * 3.2 + uSeed, vO.y * 34.0)));
  col = mix(col, uInk, dry * (1.0 - lit) * 0.22 * uEdge);
  // moss gathers on what faces up
  float moss = smoothstep(0.35, 0.72, n.y + (fbm3(vO * 3.6 + uSeed + 7.0) - 0.5) * 1.15) * uMossK;
  col = mix(col, mix(mix(uMossLo, uMossMid, lit), uMossHi, top * 0.5), moss);
  // warm fill from the lantern
  vec3 lv = uLampP - vW;
  float ld = length(lv);
  col += uLampC * uLampK * max(dot(n, lv / max(ld, 1e-3)), 0.0) / (1.0 + ld * ld * 1.4);
  // moonlit rim on the side turned to the moon
  float fres = pow(1.0 - max(dot(n, V), 0.0), 2.6);
  col = mix(col, uMoonC, fres * smoothstep(-0.35, 0.55, dot(n, uMoonDir)) * uRim);
  col = mix(col, uLampC, uHot * (0.1 + 0.42 * fres));
  col += (h21(gl_FragCoord.xy) - 0.5) * uGrain;
  gl_FragColor = vec4(haze(col, vW), 1.0);
  #include <colorspace_fragment>
}`

/** inverted hull: pushed out along the normal by a share of the view distance, heavier in shadow, broken by noise */
const HULL_VERT = /* glsl */ `
${NOISE}
uniform float uW;
uniform vec3 uKey;
varying vec3 vW;
void main() {
  vec3 nw = normalize(mat3(modelMatrix) * normal);
  float k = (0.35 + 1.25 * n3(position * 2.7 + 3.0)) * (1.25 - 0.75 * max(dot(nw, uKey), 0.0));
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  mv.xyz += normalize(normalMatrix * normal) * uW * k * -mv.z;
  vW = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * mv;
}`
const HULL_FRAG = /* glsl */ `
${NOISE}
${HAZE}
uniform vec3 uInk;
varying vec3 vW;
void main() {
  gl_FragColor = vec4(haze(uInk, vW), 1.0);
  #include <colorspace_fragment>
}`

const GROUND_FRAG = /* glsl */ `
${NOISE}
${HAZE}
uniform vec3 uSand, uRake, uRakeHi, uShadowC, uLampC, uLampP;
uniform float uRakeA, uRakeHiA, uShadowK, uLampK, uR, uGrain;
uniform vec2 uCenter, uShDir;
uniform float uShLen;
uniform vec4 uRings[8];
uniform int uRingN;
uniform vec4 uCast[24];
uniform int uCastN;
varying vec3 vW;
void main() {
  vec2 p = vW.xz;
  // raked rows, bending into rings round the stones
  float ph = p.y * 4.6 + sin(p.x * 0.45) * 0.5;
  for (int i = 0; i < 8; i++) {
    if (i >= uRingN) break;
    float rd = length(p - uRings[i].xy) - uRings[i].z;
    if (rd > -0.02 && rd < uRings[i].w) { ph = rd * 4.6; break; }
  }
  float fw = fwidth(ph);
  float sn = sin(ph * 6.2832);
  float aa = 1.0 - smoothstep(0.18, 0.5, fw);
  float groove = smoothstep(0.7, 0.98, -sn) * aa;
  float ridge = smoothstep(0.72, 0.98, sn) * aa;
  vec3 col = uSand * (0.96 + 0.08 * fbm2(p * 0.45));
  col = mix(col, uRake, groove * uRakeA);
  col = mix(col, uRakeHi, ridge * uRakeHiA);
  // soft ink shadows thrown away from the key light, darkest at the foot
  float sh = 0.0;
  vec2 sp = vec2(-uShDir.y, uShDir.x);
  for (int i = 0; i < 24; i++) {
    if (i >= uCastN) break;
    vec4 c = uCast[i];
    vec2 q = p - c.xy;
    float L = c.w * uShLen;
    float a = dot(q, uShDir), b = dot(q, sp);
    float e = length(vec2((a - L * 0.42) / (c.z * 0.9 + L * 0.58), b / (c.z * 0.95)));
    float thrown = 1.0 - smoothstep(0.3, 1.05, e + (n2(p * 3.5 + float(i)) - 0.5) * 0.35);
    float foot = 1.0 - smoothstep(0.55, 1.12, length(q) / c.z);
    sh = max(sh, max(thrown * 0.7, foot));
  }
  col = mix(col, uShadowC, sh * uShadowK);
  vec3 lq = vec3(p.x, 0.0, p.y) - uLampP;
  col += uLampC * uLampK * 0.5 / (1.0 + dot(lq, lq) * 3.0);
  col += (h21(gl_FragCoord.xy) - 0.5) * uGrain;
  float rim = length(p - uCenter) + (fbm2(p * 0.5) - 0.5) * uR * 0.3;
  float a = 1.0 - smoothstep(uR * 0.5, uR, rim);
  gl_FragColor = vec4(haze(col, vW), a);
  #include <colorspace_fragment>
}`

const POND_FRAG = /* glsl */ `
${NOISE}
${HAZE}
uniform vec3 uWater, uSky, uMoonC, uLampC, uInk, uMoonDir, uLampP;
uniform float uLampK, uRoad, uGrain;
uniform vec2 uC, uR;
varying vec3 vW;
void main() {
  vec2 p = vW.xz;
  float edge = length((p - uC) / uR) + (n2(p * 2.2) - 0.5) * 0.14;
  float a = 1.0 - smoothstep(1.0 - fwidth(edge) * 1.5, 1.0, edge);
  vec3 V = normalize(vW - cameraPosition);
  vec2 rp = p * vec2(1.4, 4.2);
  float gx = n2(rp + vec2(uTime * 0.22, 0.0)) - 0.5;
  float gz = n2(rp * 1.7 + vec2(3.0, -uTime * 0.18)) - 0.5;
  vec3 N = normalize(vec3(gx * 0.05, 1.0, gz * 0.24));
  vec3 R = reflect(V, N);
  float fres = 0.2 + 0.8 * pow(1.0 - max(-V.y, 0.0), 3.0);
  vec3 col = mix(uWater, mix(uSky, uFogC, smoothstep(0.0, 0.5, R.y)), fres * 0.85);
  float m = dot(R, uMoonDir);
  col += uMoonC * (smoothstep(0.9965, 0.9993, m) + smoothstep(0.975, 0.999, m) * 0.18) * uRoad;
  col += uLampC * pow(max(dot(R, normalize(uLampP - vW)), 0.0), 70.0) * uLampK * 1.6;
  // dry-brush ripples and a darker wet rim
  float rip = smoothstep(0.7, 0.95, n2(vec2(p.x * 1.1, p.y * 14.0) + vec2(uTime * 0.05, 0.0)));
  col = mix(col, uSky, rip * 0.45);
  // deeper toward the near shore
  col = mix(col, uWater * 0.82, smoothstep(0.0, 0.9, (p.y - uC.y) / uR.y + 0.4) * 0.35);
  col = mix(col, uInk, smoothstep(0.8, 0.97, edge) * 0.55);
  col += (h21(gl_FragCoord.xy) - 0.5) * uGrain;
  gl_FragColor = vec4(haze(col, vW), a);
  #include <colorspace_fragment>
}`

const RANGE_FRAG = /* glsl */ `
${NOISE}
uniform vec3 uInk, uFogC, uMoonC;
uniform float uDepth, uSeed, uBase, uAmp, uRimK, uK;
varying vec2 vUv;
float ridged(float x, float s) { return 1.0 - abs(n2(vec2(x, s)) * 2.0 - 1.0); }
void main() {
  float x = vUv.x * 46.0;
  float r = uBase + uAmp * (0.6 * pow(ridged(x * 0.32, uSeed), 2.2) + 0.28 * ridged(x * 0.95 + 3.0, uSeed + 1.0) + 0.12 * n2(vec2(x * 3.4, uSeed + 2.0)));
  float y = vUv.y;
  float fw = fwidth(y) * 1.2;
  float edge = r - y + (n2(vec2(x * 14.0, y * 40.0)) - 0.5) * 0.006;
  float inside = smoothstep(-fw, fw, edge);
  // dense on the ridge, thinning into mist toward the foot, gone below the base line
  float t = clamp(edge / (uAmp * 0.9 + 0.03), 0.0, 1.0);
  float body = 0.2 + 0.8 * (1.0 - t) * (1.0 - t);
  float grain = 0.82 + 0.36 * n2(vec2(x * 26.0, y * 90.0));
  float k = inside * uK * body * grain * smoothstep(uBase - 0.1, uBase + 0.05, y);
  vec3 col = mix(uInk, uFogC, uDepth * 0.45);
  float rim = (1.0 - smoothstep(0.0, fw * 2.5, edge)) * inside * uRimK;
  col = mix(col, uMoonC, rim);
  gl_FragColor = vec4(col, clamp(k + rim * 0.5, 0.0, 1.0));
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
const MOON_FRAG = /* glsl */ `
${NOISE}
uniform vec3 uMoonC, uRimC, uFogC;
uniform float uDisc, uHalo, uTime;
varying vec2 vUv;
void main() {
  vec2 p = vUv - 0.5;
  float d = length(p);
  float fw = fwidth(d);
  float disc = 1.0 - smoothstep(uDisc - fw, uDisc + fw, d);
  float halo = exp(-pow(max(d - uDisc * 0.8, 0.0) / (uDisc * 1.6), 1.2)) * uHalo * (1.0 - disc);
  float maria = smoothstep(0.52, 0.72, fbm2(p / uDisc * 1.7 + 4.0)) * 0.13;
  vec3 col = uMoonC * (1.0 - maria);
  col = mix(col, uRimC, (1.0 - smoothstep(0.0, fw * 2.5, abs(d - uDisc))) * 0.5);
  // a breath of cloud drawn across the lower disc
  float cl = smoothstep(0.5, 0.78, fbm2(vec2(p.x * 2.6 + uTime * 0.01, p.y * 15.0) + 7.0)) * (1.0 - smoothstep(0.0, uDisc * 0.5, abs(p.y + uDisc * 0.35)));
  col = mix(col, uFogC, cl * 0.75);
  float a = max(disc * (1.0 - cl * 0.5), halo);
  gl_FragColor = vec4(mix(uMoonC, col, disc), a);
  #include <colorspace_fragment>
}`
const GLOW_FRAG = /* glsl */ `
uniform vec3 uC;
uniform float uK;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float a = uK * exp(-d * d * 5.0) * (1.0 - smoothstep(0.8, 1.0, d));
  gl_FragColor = vec4(uC, a);
  #include <colorspace_fragment>
}`
const MIST_FRAG = /* glsl */ `
${NOISE}
uniform vec3 uMistC;
uniform float uK, uSeed, uTime;
varying vec2 vUv;
void main() {
  float band = smoothstep(0.0, 0.42, vUv.y) * (1.0 - smoothstep(0.5, 1.0, vUv.y)) * smoothstep(0.0, 0.3, vUv.x) * (1.0 - smoothstep(0.7, 1.0, vUv.x));
  float n = fbm2(vec2(vUv.x * 3.2 + uSeed + uTime * 0.02, vUv.y * 2.4 + uSeed * 0.3));
  gl_FragColor = vec4(uMistC, band * smoothstep(0.28, 0.72, n) * uK);
  #include <colorspace_fragment>
}`

// ───────────────────────────── geometry ─────────────────────────────
const hash3 = (x: number, y: number, z: number) => {
  const q = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
  return q - Math.floor(q)
}
/** value noise in 0…1 (geometry only, at build time) */
function noise3(x: number, y: number, z: number) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z)
  const fx = x - ix, fy = y - iy, fz = z - iz
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz)
  const c = (a: number, b: number, d: number) => hash3(ix + a, iy + b, iz + d)
  const L = (a: number, b: number, t: number) => a + (b - a) * t
  return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w)
}

/** A garden stone: a lumpy sphere, chiselled by a few cut planes, flat at the foot, sized w × h × d standing on y = 0. */
function rockGeo(seed: number, w: number, h: number, d: number, cuts = 4): THREE.BufferGeometry {
  const r = rng(seed)
  const sp = new THREE.SphereGeometry(1, 26, 16)
  sp.deleteAttribute('uv')
  sp.deleteAttribute('normal')
  const g = mergeVertices(sp)
  sp.dispose()
  const o = [r() * 40, r() * 40, r() * 40]
  const planes = Array.from({ length: cuts }, () => {
    const a = r() * Math.PI * 2
    const n = new THREE.Vector3(Math.cos(a), 0.15 + r() * 0.9, Math.sin(a)).normalize()
    return [n.x, n.y, n.z, 0.66 + r() * 0.16]
  })
  const p = g.attributes.position as THREE.BufferAttribute
  let y0 = Infinity, y1 = -Infinity
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    const k = 1 + 0.45 * (noise3(x * 1.2 + o[0], y * 1.2 + o[1], z * 1.2 + o[2]) - 0.5) + 0.14 * (noise3(x * 3.4 + o[1], y * 3.4, z * 3.4 + o[0]) - 0.5)
    x *= k
    y *= k
    z *= k
    for (const [nx, ny, nz, c] of planes) {
      const t = x * nx + y * ny + z * nz - c
      if (t > 0) (x -= nx * t), (y -= ny * t), (z -= nz * t)
    }
    y = Math.max(y, -0.3)
    p.setXYZ(i, x, y, z)
    y0 = Math.min(y0, y)
    y1 = Math.max(y1, y)
  }
  for (let i = 0; i < p.count; i++) p.setXYZ(i, (p.getX(i) * w) / 2, ((p.getY(i) - y0) / (y1 - y0)) * h, (p.getZ(i) * d) / 2)
  g.computeVertexNormals()
  return g
}

/** A Kasuga stone lantern, 1.55 tall: plinth, pillar, platform, firebox, curled hexagonal roof, jewel (one geometry). */
function toroGeo(): THREE.BufferGeometry {
  const H6 = Math.PI / 6
  const cyl = (rt: number, rb: number, hh: number, seg: number, y: number) => {
    const g = new THREE.CylinderGeometry(rt, rb, hh, seg, 1, false, H6)
    g.translate(0, y + hh / 2, 0)
    return g
  }
  const roof = new THREE.ConeGeometry(0.5, 0.3, 12, 2, false, H6)
  const p = roof.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    const rr = Math.hypot(x, z)
    if (rr < 1e-4) continue
    const j = Math.round((Math.atan2(x, z) - H6) / (Math.PI / 6))
    const mid = ((j % 2) + 2) % 2 === 1
    const k = mid ? Math.cos(Math.PI / 6) : 1
    p.setXYZ(i, x * k, y + (!mid && y < -0.1 ? 0.07 : 0), z * k)
  }
  roof.computeVertexNormals()
  roof.translate(0, 1.135 + 0.15, 0)
  const jewel = new THREE.SphereGeometry(0.065, 10, 8)
  jewel.translate(0, 1.47, 0)
  const tip = new THREE.ConeGeometry(0.04, 0.1, 8)
  tip.translate(0, 1.56, 0)
  const parts = [cyl(0.3, 0.34, 0.12, 6, 0), cyl(0.2, 0.26, 0.06, 6, 0.12), cyl(0.085, 0.1, 0.56, 12, 0.18), cyl(0.27, 0.22, 0.1, 6, 0.74), cyl(0.17, 0.17, 0.26, 6, 0.84), cyl(0.4, 0.38, 0.035, 6, 1.1), roof, jewel, tip]
  const g = mergeGeometries(parts)!
  parts.forEach((x) => x.dispose())
  return g
}

/** A tube along pts whose radius tapers from r0 to r1. */
function taperTube(pts: THREE.Vector3[], r0: number, r1: number, seg = 20, rad = 7): THREE.BufferGeometry {
  const path = new THREE.CatmullRomCurve3(pts)
  const g = new THREE.TubeGeometry(path, seg, 1, rad, false)
  const p = g.attributes.position as THREE.BufferAttribute
  const c = new THREE.Vector3()
  for (let i = 0; i <= seg; i++) {
    const t = i / seg
    path.getPointAt(t, c)
    const r = r0 + (r1 - r0) * t
    for (let j = 0; j <= rad; j++) {
      const k = i * (rad + 1) + j
      p.setXYZ(k, c.x + (p.getX(k) - c.x) * r, c.y + (p.getY(k) - c.y) * r, c.z + (p.getZ(k) - c.z) * r)
    }
  }
  g.computeVertexNormals()
  return g
}

/** One bamboo leaf (a slim lens) pointing up its local +y. */
function leafGeo(len: number): THREE.BufferGeometry {
  const sh = new THREE.Shape()
  sh.moveTo(0, 0)
  sh.quadraticCurveTo(len * 0.13, len * 0.4, 0, len)
  sh.quadraticCurveTo(-len * 0.1, len * 0.4, 0, 0)
  return new THREE.ShapeGeometry(sh, 5)
}

// ───────────────────────────── palette ─────────────────────────────
/** Set a THREE colour from a CSS colour (hex, rgb(), rgba()); returns the alpha. */
function setCss(c: THREE.Color, css: string): number {
  const m = css.match(/rgba?\(([^)]+)\)/)
  if (!m) return c.setStyle(css || '#888', THREE.SRGBColorSpace), 1
  const [r, g, b, a = '1'] = m[1].split(/[\s,/]+/).filter(Boolean)
  c.setRGB(+r / 255, +g / 255, +b / 255, THREE.SRGBColorSpace)
  return +a
}
const C = () => new THREE.Color()
const tri = (): [THREE.Color, THREE.Color, THREE.Color] => [C(), C(), C()]

function makePalette() {
  const P = {
    paper: C(), sand: C(), wash: C(), moon: C(), moonRim: C(), lantern: C(), water: C(), sky: C(), umbra: C(), mist: C(), rake: C(), rakeHi: C(),
    tones: { rock: tri(), step: tri(), moss: tri(), pine: tri(), bark: tri(), bamboo: tri() } as Record<Tone, [THREE.Color, THREE.Color, THREE.Color]>,
    rakeA: 0.15, rakeHiA: 0.7, mistA: 0.8, dark: false,
  }
  const read = () => {
    const cs = getComputedStyle(document.documentElement)
    const v = (n: string) => cs.getPropertyValue(n).trim()
    const dark = (P.dark = document.documentElement.dataset.theme === 'dark')
    const tmp = C()
    const get = (n: string) => (setCss(tmp, v(n)), tmp.clone())
    setCss(P.paper, v('--paper'))
    setCss(P.wash, v('--wash'))
    setCss(P.moon, v('--moon'))
    setCss(P.moonRim, v('--moon-rim'))
    setCss(P.lantern, v('--lantern'))
    setCss(P.water, v('--water'))
    setCss(P.umbra, v('--umbra'))
    P.mistA = setCss(P.mist, v('--mist')) * (dark ? 2.6 : 0.95) * (parseFloat(v('--mist-a')) || 0.5)
    P.rakeA = setCss(P.rake, v('--rake'))
    P.rakeHiA = setCss(P.rakeHi, v('--rake-hi'))
    // colours mix in linear light: night lines stay faint or the sand turns grey
    if (dark) P.rakeHi.copy(P.mist), (P.rakeHiA *= 0.8)
    P.sand.copy(get('--paper-2')).lerp(P.mist, dark ? 0.05 : 0).lerp(P.paper, dark ? 0 : 0.6)
    P.sky.copy(P.paper).lerp(P.moon, dark ? 0.22 : 0.5)
    const t = P.tones
    const set3 = (k: Tone, a: string, b: string, c: string) => (t[k][0].copy(get(a)), t[k][1].copy(get(b)), t[k][2].copy(get(c)))
    set3('rock', '--rock-lo', '--rock-mid', '--rock-hi')
    set3('step', '--step-lo', '--step-mid', '--step-hi')
    set3('moss', '--moss-b', '--moss-a', '--moss-c')
    set3('bamboo', '--moss-b', '--moss-a', '--moss-c')
    const mb = get('--moss-b'), ma = get('--moss-a'), rl = get('--rock-lo')
    t.pine[0].copy(P.wash).lerp(mb, dark ? 0.55 : 0.3)
    t.pine[1].copy(mb).lerp(P.wash, dark ? 0 : 0.25)
    t.pine[2].copy(ma)
    t.bark[0].copy(P.wash).lerp(rl, dark ? 0.4 : 0.15)
    t.bark[1].copy(P.wash).lerp(rl, 0.55)
    t.bark[2].copy(rl)
    if (dark) t.bamboo.forEach((c) => c.lerp(P.paper, 0.25))
  }
  return { P, read }
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

// ───────────────────────────── the kit ─────────────────────────────
/**
 * Mount a moonlit 3D view in `host` (which must be positioned). `build(k)` adds the garden to k.root (a generator may
 * `yield` between heavy pieces); the stage is created after it, so every shader compiles once, asynchronously.
 * Cleans itself up with ctx.onCleanup; dispose() also works.
 */
export function inkStage(ctx: SceneCtx, host: HTMLElement, opts: InkOpts, build: (k: InkKit) => Iterator<unknown> | void): InkHandle {
  const low = ctx.quality === 'low'
  const view = opts.view ?? {}
  const yawR = view.yawRange ?? [-0.75, 0.75]
  const pitchR = view.pitchRange ?? [0.08, 0.72]
  const fit = view.fit ?? [6.6, 3]
  const T = new THREE.Vector3(...(view.target ?? [0, 1, 0]))
  const swaying = opts.sway !== false && !low && !ctx.reduced

  const el = h('div', { class: 'p2s3', tabindex: '0', role: 'group', 'aria-label': opts.label })
  if (opts.hint) el.setAttribute('aria-description', opts.hint)
  const hits = h('div', { class: 'p2s3-hits' })
  el.append(hits)
  host.append(el)

  const { P, read } = makePalette()
  const root = new THREE.Group()
  const defines = { OCT: low ? 2 : 4 }
  // shared uniforms: one object per name, referenced by every material, so a theme change is one write
  const U = {
    uTime: { value: 0 },
    uKey: { value: new THREE.Vector3(-0.66, 0.62, 0.42).normalize() },
    uMoonDir: { value: new THREE.Vector3(0.25, 0.16, -0.95).normalize() },
    uMoonC: { value: P.moon },
    uInk: { value: P.wash },
    uFogC: { value: P.paper },
    uFog: { value: new THREE.Vector2(12, 46) },
    uMist: { value: new THREE.Vector2(1.2, 0.55) },
    uLampP: { value: new THREE.Vector3(0, -50, 0) },
    uLampC: { value: P.lantern },
    uLampK: { value: 0 },
    uGrain: { value: 0.03 },
    uMossLo: { value: P.tones.moss[0] },
    uMossMid: { value: P.tones.moss[1] },
    uMossHi: { value: P.tones.moss[2] },
  }
  const seedR = rng(17)
  const hullMat = new THREE.ShaderMaterial({ vertexShader: HULL_VERT, fragmentShader: HULL_FRAG, defines, side: THREE.BackSide, uniforms: { ...U, uW: { value: low ? 0.002 : 0.0017 } } })
  const casters: THREE.Object3D[] = []
  const rings: THREE.Object3D[] = []
  const lamps: THREE.Object3D[] = []
  let groundMat: THREE.ShaderMaterial | null = null
  const billboards: THREE.ShaderMaterial[] = []
  const recolor: (() => void)[] = []

  const applyPal = () => {
    read()
    U.uGrain.value = P.dark ? 0.022 : 0.03
    U.uLampK.value = lamps.length ? (P.dark ? 0.9 : 0.35) : 0
    recolor.forEach((f) => f())
  }
  applyPal()
  // before the first yield, so a theme change while building still lands (README A.10)
  const offPrefs = onPrefs(() => {
    applyPal()
    stage?.render()
  })

  const ink: InkKit['ink'] = (tone, o = {}) => {
    const [lo, mid, hi] = P.tones[tone]
    const m = new THREE.ShaderMaterial({
      vertexShader: WORLD_VERT, fragmentShader: INK_FRAG, defines, side: o.double ? THREE.DoubleSide : THREE.FrontSide,
      uniforms: { ...U, uLo: { value: lo }, uMid: { value: mid }, uHi: { value: hi }, uMossK: { value: o.moss ?? 0 }, uHot: { value: 0 }, uSeed: { value: seedR() * 20 }, uRim: { value: 0 }, uEdge: { value: o.edge ?? 1 } },
    })
    const rimK = o.rim ?? 1
    recolor.push(() => void (m.uniforms.uRim.value = rimK * (P.dark ? 0.85 : 0.3)))
    m.uniforms.uRim.value = rimK * (P.dark ? 0.85 : 0.3)
    return m
  }
  const mesh: InkKit['mesh'] = (geo, mat, o = {}) => {
    const m = new THREE.Mesh(geo, mat)
    if (o.at) m.position.set(...o.at)
    if (o.outline !== false) {
      const hull = new THREE.Mesh(geo, hullMat)
      hull.raycast = () => {}
      m.add(hull)
    }
    if (o.cast) casters.push(m)
    ;(o.parent ?? root).add(m)
    return m
  }
  const groupAt = (at: XZ | undefined, rotY = 0) => {
    const g = new THREE.Group()
    if (at) g.position.set(at[0], 0, at[1])
    g.rotation.y = rotY
    root.add(g)
    return g
  }
  const rock: InkKit['rock'] = (o = {}) => {
    const seed = o.seed ?? 1
    const g = groupAt(o.at, o.rotY ?? seed * 1.7)
    const w = o.w ?? 1, hh = o.h ?? 0.8
    const m = mesh(rockGeo(seed, w, hh, o.d ?? w * 0.8), ink(o.tone ?? 'rock', { moss: o.moss ?? 0.5 }), { parent: g })
    m.position.y = -hh * 0.06
    casters.push(g)
    if (o.ring !== false) rings.push(g)
    return g
  }
  const stones: InkKit['stones'] = (from, to, n, o = {}) => {
    const g = new THREE.Group()
    root.add(g)
    const r = rng(o.seed ?? 5)
    const size = o.size ?? 0.7
    const bend = o.bend ?? 0.25
    for (let i = 0; i < n; i++) {
      const t = n > 1 ? i / (n - 1) : 0
      const nx = -(to[1] - from[1]), nz = to[0] - from[0]
      const off = Math.sin(t * Math.PI) * bend + (r() - 0.5) * 0.12
      const x = from[0] + (to[0] - from[0]) * t + nx * off * 0.3
      const z = from[1] + (to[1] - from[1]) * t + nz * off * 0.3
      const w = size * (0.85 + r() * 0.35)
      const st = mesh(rockGeo((o.seed ?? 5) * 31 + i, w, size * 0.16, w * (0.7 + r() * 0.2), 2), ink('step', { moss: 0.25 }), { parent: g, at: [x, -0.01, z] })
      st.rotation.y = r() * Math.PI
      casters.push(st)
    }
    return g
  }
  const glow: InkKit['glow'] = (at, size, color = 'lantern', k = 1) => {
    const m = new THREE.ShaderMaterial({ vertexShader: BILL_VERT, fragmentShader: GLOW_FRAG, transparent: true, depthWrite: false, uniforms: { uSize: { value: new THREE.Vector2(size, size) }, uC: { value: color === 'moon' ? P.moon : P.lantern }, uK: { value: k } } })
    const base = k
    recolor.push(() => void (m.uniforms.uK.value = base * (P.dark ? 1 : 0.55)))
    m.uniforms.uK.value = base * (P.dark ? 1 : 0.55)
    const q = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m)
    q.position.set(...at)
    q.renderOrder = 4
    q.raycast = () => {}
    root.add(q)
    return q
  }
  const toro: InkKit['toro'] = (o = {}) => {
    const g = groupAt(o.at, o.rotY ?? 0.35)
    const k = (o.h ?? 1.5) / 1.55
    g.scale.setScalar(k)
    mesh(toroGeo(), ink('rock', { moss: 0.35 }), { parent: g })
    if (o.lit !== false) {
      const winMat = new THREE.MeshBasicMaterial({ color: P.lantern })
      recolor.push(() => void winMat.color.copy(P.lantern))
      const win = new THREE.PlaneGeometry(0.13, 0.15)
      for (const z of [0.148, -0.148]) {
        const w = new THREE.Mesh(win, winMat)
        w.position.set(0, 0.98, z)
        if (z < 0) w.rotation.y = Math.PI
        g.add(w)
      }
      const lamp = new THREE.Object3D()
      lamp.position.set(0, 0.98, 0)
      g.add(lamp)
      lamps.push(lamp)
      U.uLampK.value = P.dark ? 0.9 : 0.35
      const halo = glow([0, 0.98, 0], 1.5, 'lantern', 0.85)
      g.add(halo)
    }
    casters.push(g)
    rings.push(g)
    return g
  }
  const bamboo: InkKit['bamboo'] = (o = {}) => {
    const g = groupAt(o.at)
    const r = rng(o.seed ?? 3)
    const n = o.n ?? 5, H = o.h ?? 3.4
    const stalks: THREE.BufferGeometry[] = []
    const leaves: THREE.BufferGeometry[] = []
    const leaf = leafGeo(0.42)
    const tmp = new THREE.Object3D()
    for (let i = 0; i < n; i++) {
      const hh = H * (0.7 + r() * 0.3)
      const parts = [new THREE.CylinderGeometry(0.036, 0.044, hh, 9, 1)]
      parts[0].translate(0, hh / 2, 0)
      for (let y = 0.28 + r() * 0.2; y < hh - 0.1; y += 0.36 + r() * 0.08) {
        const nd = new THREE.CylinderGeometry(0.05, 0.047, 0.022, 9)
        nd.translate(0, y, 0)
        parts.push(nd)
      }
      const st = mergeGeometries(parts)!
      parts.forEach((p) => p.dispose())
      tmp.position.set((r() - 0.5) * 0.9, 0, (r() - 0.5) * 0.6)
      tmp.rotation.set((r() - 0.5) * 0.08, 0, (r() - 0.5) * 0.12)
      tmp.scale.setScalar(1)
      tmp.updateMatrix()
      st.applyMatrix4(tmp.matrix)
      stalks.push(st)
      const stalkM = tmp.matrix.clone()
      // leaves hang in fans of three to five from a few upper nodes
      const top = new THREE.Vector3()
      for (let f = 0; f < 3; f++) {
        top.set(0, hh * (0.55 + f * 0.15 + r() * 0.08), 0).applyMatrix4(stalkM)
        const fan = 3 + Math.floor(r() * 3)
        const yaw = r() * Math.PI * 2
        for (let j = 0; j < fan; j++) {
          const lg = leaf.clone()
          const s0 = 0.7 + r() * 0.5
          tmp.position.copy(top)
          tmp.rotation.set(0, yaw + (j - fan / 2) * 0.5, -Math.PI * (0.55 + r() * 0.2))
          tmp.scale.setScalar(s0)
          tmp.updateMatrix()
          lg.applyMatrix4(tmp.matrix)
          leaves.push(lg)
        }
      }
    }
    leaf.dispose()
    mesh(mergeGeometries(stalks)!, ink('bamboo', { rim: 1.2 }), { parent: g })
    mesh(mergeGeometries(leaves)!, ink('pine', { double: true, edge: 0.4 }), { parent: g, outline: false })
    stalks.concat(leaves).forEach((x) => x.dispose())
    casters.push(g)
    return g
  }
  const pine: InkKit['pine'] = (o = {}) => {
    const g = groupAt(o.at)
    const r = rng(o.seed ?? 7)
    const H = o.h ?? 3, L = o.lean ?? 1
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x * H, y * H, z * H)
    const trunkPts = [V(0, 0, 0), V(L * 0.12, 0.28, 0.02), V(-L * 0.04, 0.52, -0.02), V(L * 0.26, 0.78, 0.03), V(L * 0.44, 0.97, 0)]
    const wood = [taperTube(trunkPts, H * 0.06, H * 0.022, 26, 8)]
    const path = new THREE.CatmullRomCurve3(trunkPts)
    const ends: [THREE.Vector3, number][] = [[trunkPts[4].clone(), 1.15]]
    const at = new THREE.Vector3()
    ;[0.42, 0.58, 0.7, 0.84].forEach((t, i) => {
      path.getPointAt(t, at)
      const side = i % 2 ? -L : L
      const len = H * (0.24 + r() * 0.16) * (i ? 1 : 1.25)
      const a = (r() - 0.5) * 0.9
      const end = at.clone().add(new THREE.Vector3(side * len * Math.cos(a), len * (0.06 + r() * 0.16), len * Math.sin(a) * 0.8))
      const mid = at.clone().lerp(end, 0.5).add(new THREE.Vector3(0, -len * 0.12, 0))
      wood.push(taperTube([at.clone(), mid, end], H * 0.022, H * 0.008, 10, 6))
      ends.push([end, 0.75 + r() * 0.35])
    })
    const pads = ends.map(([e, k], i) => {
      const pg = rockGeo((o.seed ?? 7) * 13 + i, H * 0.42 * k, H * 0.12 * k, H * 0.32 * k, 3)
      pg.translate(e.x, e.y - H * 0.03, e.z)
      return pg
    })
    mesh(mergeGeometries(wood)!, ink('bark', { rim: 1.2 }), { parent: g })
    mesh(mergeGeometries(pads)!, ink('pine', { rim: 1.3, edge: 0.7 }), { parent: g })
    wood.concat(pads).forEach((x) => x.dispose())
    casters.push(g)
    return g
  }
  const ground: InkKit['ground'] = (o = {}) => {
    const R = o.r ?? 7
    const c = o.center ?? [0, 0]
    const m = new THREE.ShaderMaterial({
      vertexShader: WORLD_VERT, fragmentShader: GROUND_FRAG, defines, transparent: true,
      uniforms: {
        ...U, uSand: { value: P.sand }, uRake: { value: P.rake }, uRakeHi: { value: P.rakeHi }, uShadowC: { value: P.umbra },
        uRakeA: { value: 0 }, uRakeHiA: { value: 0 }, uShadowK: { value: 0 }, uR: { value: R }, uCenter: { value: new THREE.Vector2(...c) },
        uShDir: { value: new THREE.Vector2() }, uShLen: { value: 0.9 },
        uRings: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) }, uRingN: { value: 0 },
        uCast: { value: Array.from({ length: 24 }, () => new THREE.Vector4()) }, uCastN: { value: 0 },
      },
    })
    const tone = () => {
      m.uniforms.uRakeA.value = P.rakeA * (P.dark ? 0.7 : 1.2)
      m.uniforms.uRakeHiA.value = P.rakeHiA
      m.uniforms.uShadowK.value = P.dark ? 0.6 : 0.34
    }
    tone()
    recolor.push(tone)
    groundMat = m
    const g = new THREE.Mesh(new THREE.CircleGeometry(R, 72), m)
    g.rotation.x = -Math.PI / 2
    g.position.set(c[0], 0, c[1])
    g.renderOrder = -5
    g.raycast = () => {}
    root.add(g)
    return g
  }
  const pond: InkKit['pond'] = (o = {}) => {
    const at = o.at ?? [1.5, -0.5], rr = o.r ?? [1.6, 1.1]
    const m = new THREE.ShaderMaterial({
      vertexShader: WORLD_VERT, fragmentShader: POND_FRAG, defines, transparent: true,
      uniforms: { ...U, uWater: { value: P.water }, uSky: { value: P.sky }, uRoad: { value: 1 }, uC: { value: new THREE.Vector2(...at) }, uR: { value: new THREE.Vector2(...rr) } },
    })
    const tone = () => void (m.uniforms.uRoad.value = P.dark ? 1 : 0.55)
    tone()
    recolor.push(tone)
    const q = new THREE.Mesh(new THREE.CircleGeometry(1, 64), m)
    q.rotation.x = -Math.PI / 2
    q.scale.set(rr[0], rr[1], 1)
    q.position.set(at[0], 0.012, at[1])
    q.renderOrder = -4
    q.raycast = () => {}
    root.add(q)
    return q
  }
  const backdrop: InkKit['backdrop'] = (o = {}) => {
    const g = new THREE.Group()
    root.add(g)
    if (o.moon) U.uMoonDir.value.set(...o.moon).normalize()
    const seed = o.seed ?? 3
    // moon: a billboard far out along uMoonDir, behind the ranges
    const mm = new THREE.ShaderMaterial({
      vertexShader: BILL_VERT, fragmentShader: MOON_FRAG, defines, transparent: true, depthWrite: false,
      uniforms: { uSize: { value: new THREE.Vector2(26, 26) }, uMoonC: { value: P.moon }, uRimC: { value: P.moonRim }, uFogC: { value: P.paper }, uDisc: { value: 0.085 }, uHalo: { value: 0.6 }, uTime: U.uTime },
    })
    const halo = () => void (mm.uniforms.uHalo.value = P.dark ? 0.55 : 0.75)
    halo()
    recolor.push(halo)
    billboards.push(mm)
    const moonQ = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mm)
    moonQ.position.copy(U.uMoonDir.value).multiplyScalar(80).add(T)
    moonQ.renderOrder = -10
    g.add(moonQ)
    // three ranges: near and dark, far and pale
    // [radius, depth, ridge base, ridge height (shares of the 16-unit band from y = -1.2), opacity]
    ;[[24, 0, 0.25, 0.12, 0.55], [32, 0.5, 0.24, 0.18, 0.36], [44, 1, 0.23, 0.25, 0.24]].forEach(([R, depth, base, amp, k], i) => {
      const rm = new THREE.ShaderMaterial({
        vertexShader: WORLD_VERT, fragmentShader: RANGE_FRAG, defines, transparent: true, depthWrite: false, side: THREE.BackSide,
        uniforms: { uInk: { value: P.wash }, uFogC: { value: P.paper }, uMoonC: { value: P.moon }, uDepth: { value: depth }, uSeed: { value: seed * 7 + i * 3 }, uBase: { value: base }, uAmp: { value: amp }, uRimK: { value: 0 }, uK: { value: k } },
      })
      const t = () => {
        rm.uniforms.uRimK.value = P.dark ? 0.32 * (1 - depth * 0.7) : 0.12
        rm.uniforms.uK.value = k * (P.dark ? 1.45 : 1)
      }
      t()
      recolor.push(t)
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 16, 120, 1, true), rm)
      cyl.position.set(T.x, 8 - 1.2, T.z)
      cyl.renderOrder = -7 - depth * 2 // far ranges first
      g.add(cyl)
    })
    // mist banks drifting at the feet of the ranges and over the back of the garden
    const r = rng(seed + 5)
    const nb = Math.round((o.mist ?? 1) * (low ? 4 : 7))
    for (let i = 0; i < nb; i++) {
      const a = (r() - 0.5) * 2.2
      const d = 7 + r() * 13
      const w = 9 + r() * 12
      const mt = new THREE.ShaderMaterial({ vertexShader: BILL_VERT, fragmentShader: MIST_FRAG, defines, transparent: true, depthWrite: false, uniforms: { uSize: { value: new THREE.Vector2(w, w * 0.16) }, uMistC: { value: P.mist }, uK: { value: P.mistA }, uSeed: { value: r() * 30 }, uTime: U.uTime } })
      recolor.push(() => void (mt.uniforms.uK.value = P.mistA))
      const q = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mt)
      q.position.set(T.x + Math.sin(a) * d, 0.35 + r() * 1.1 + d * 0.03, T.z - Math.cos(a) * d)
      q.renderOrder = 6
      g.add(q)
    }
    g.traverse((x) => void (x.raycast = () => {}))
    return g
  }

  // ── tappables: raycast for the pointer, a button over each for keyboard and screen readers
  interface Tap { obj: THREE.Object3D; btn: HTMLButtonElement; c: THREE.Vector3; r: number; mats: THREE.ShaderMaterial[]; hot: number; want: number; focus: boolean; x: number; y: number; z: number }
  const taps: Tap[] = []
  const tappable: InkKit['tappable'] = (obj, label, onTap) => {
    const btn = h('button', { class: 'p2s3-hit', type: 'button', 'aria-label': label })
    const t: Tap = { obj, btn, c: new THREE.Vector3(), r: 1, mats: [], hot: 0, want: 0, focus: false, x: -1, y: -1, z: -1 }
    btn.addEventListener('click', onTap)
    btn.addEventListener('focus', () => ((t.focus = true), setHot()))
    btn.addEventListener('blur', () => ((t.focus = false), setHot()))
    obj.userData.p2tap = onTap
    hits.append(btn)
    taps.push(t)
    return btn
  }
  const ray = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  let rect: DOMRect | null = null
  const pick: InkKit['pick'] = (x, y) => {
    if (!stage || !taps.length) return null
    rect ??= el.getBoundingClientRect()
    ndc.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1)
    ray.setFromCamera(ndc, stage.camera)
    const hit = ray.intersectObjects(taps.map((t) => t.obj), true)[0]
    let o: THREE.Object3D | null = hit?.object ?? null
    while (o && !o.userData.p2tap) o = o.parent
    return o
  }
  let hover: THREE.Object3D | null = null
  function setHot() {
    for (const t of taps) t.want = t.focus || t.obj === hover ? 1 : 0
    el.classList.toggle('hot', !!hover)
    kick()
  }

  // ── view
  const tgt = { yaw: view.yaw ?? 0, pitch: view.pitch ?? 0.2, zoom: 1 }
  const cur = { ...tgt }
  const vel = { yaw: 0, pitch: 0 }
  const gy = { x: 0, y: 0, x0: NaN, y0: NaN }
  let fitDist = 10
  let tall = 0
  let swayT = 0
  const tanHalf = () => Math.tan(((stage?.camera.fov ?? 38) * Math.PI) / 360)
  const refit = (w: number, hh: number) => {
    const asp = w / hh
    const tv = tanHalf(), th = tv * asp
    fitDist = Math.max((fit[0] * (asp < 1 ? 0.56 : 1)) / th, fit[1] / tv)
    tall = asp < 1 ? 0.13 : 0 // a tall frame looks down a little more, so the garden fills it
    stage!.camera.setViewOffset(w, hh, 0, -(view.shift ?? 0.12) * hh, w, hh)
  }
  const place = () => {
    const cam = stage!.camera
    const yaw = cur.yaw + gy.x + (swaying ? Math.sin(swayT * 0.23) * 0.035 : 0)
    const pitch = cur.pitch + tall + gy.y + (swaying ? Math.sin(swayT * 0.17 + 1) * 0.012 : 0)
    const d = fitDist * cur.zoom
    cam.position.set(T.x + d * Math.cos(pitch) * Math.sin(yaw), T.y + d * Math.sin(pitch), T.z + d * Math.cos(pitch) * Math.cos(yaw))
    cam.lookAt(T)
    cam.updateMatrixWorld()
    // proxies follow their objects (writes only)
    const W = stage!.width, H = stage!.height
    const k = H / 2 / tanHalf()
    for (const t of taps) {
      v3.copy(t.c).project(cam)
      const x = Math.round(((v3.x + 1) / 2) * W), y = Math.round(((1 - v3.y) / 2) * H)
      const z = Math.max(44, Math.round((t.r / cam.position.distanceTo(t.c)) * k * 2))
      if (x === t.x && y === t.y && z === t.z) continue
      t.x = x
      t.y = y
      if (z !== t.z) (t.btn.style.width = t.btn.style.height = `${z}px`)
      t.z = z
      t.btn.style.transform = `translate(${x - z / 2}px,${y - z / 2}px)`
    }
  }
  const v3 = new THREE.Vector3()
  const settle = () => {
    Object.assign(cur, tgt)
    vel.yaw = vel.pitch = 0
    for (const t of taps) t.hot = t.want
    syncHot()
  }
  const syncHot = () => {
    for (const t of taps) for (const m of t.mats) m.uniforms.uHot.value = t.hot
  }
  /** one animation step; true while something still moves */
  const step = (dt: number) => {
    let moving = false
    if (!drag && (Math.abs(vel.yaw) > 0.002 || Math.abs(vel.pitch) > 0.002)) {
      tgt.yaw = clamp(tgt.yaw + vel.yaw * dt, yawR[0], yawR[1])
      tgt.pitch = clamp(tgt.pitch + vel.pitch * dt, pitchR[0], pitchR[1])
      const f = Math.exp(-dt * 4)
      vel.yaw *= f
      vel.pitch *= f
      moving = true
    }
    const f = 1 - Math.exp(-dt * 8)
    cur.yaw += (tgt.yaw - cur.yaw) * f
    cur.pitch += (tgt.pitch - cur.pitch) * f
    cur.zoom += (tgt.zoom - cur.zoom) * f
    moving ||= Math.abs(tgt.yaw - cur.yaw) + Math.abs(tgt.pitch - cur.pitch) + Math.abs(tgt.zoom - cur.zoom) > 2e-4
    for (const t of taps) {
      t.hot += (t.want - t.hot) * f
      moving ||= Math.abs(t.want - t.hot) > 0.01
    }
    syncHot()
    return moving
  }

  let stage: Stage | null = null
  let motion: ReturnType<typeof createLoop> | null = null
  /** something changed: animate it, or (reduced motion / before the stage) jump there and draw once */
  function kick() {
    if (!stage) return
    if (ctx.reduced || !motion) {
      settle()
      stage.render()
    } else motion.start()
  }

  // ── input
  let drag: { id: number; sx: number; sy: number; x: number; y: number; t: number; moved: boolean } | null = null
  let askedGyro = false
  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return
    rect = el.getBoundingClientRect()
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, t: performance.now(), moved: false }
    vel.yaw = vel.pitch = 0
    const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent
    if (opts.gyro && !askedGyro && DOE?.requestPermission) (askedGyro = true), DOE.requestPermission().catch(() => {})
  }
  const onMove = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) {
      if (e.pointerType !== 'mouse' || drag) return
      const o = pick(e.clientX, e.clientY)
      if (o !== hover) (hover = o), setHot()
      return
    }
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 5) return
      drag.moved = true
      el.classList.add('grabbing')
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        /* pointer already gone */
      }
    }
    const now = performance.now()
    const dt = Math.max(8, now - drag.t) / 1000
    const dy = -(e.clientX - drag.x) * 0.0065, dp = (e.clientY - drag.y) * 0.004
    tgt.yaw = clamp(tgt.yaw + dy, yawR[0], yawR[1])
    tgt.pitch = clamp(tgt.pitch + dp, pitchR[0], pitchR[1])
    vel.yaw = vel.yaw * 0.4 + (dy / dt) * 0.6
    vel.pitch = vel.pitch * 0.4 + (dp / dt) * 0.6
    drag.x = e.clientX
    drag.y = e.clientY
    drag.t = now
    kick()
  }
  const onUp = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return
    const tap = !drag.moved
    if (performance.now() - drag.t > 90) vel.yaw = vel.pitch = 0 // held still before letting go: no throw
    drag = null
    el.classList.remove('grabbing')
    if (tap) {
      const o = pick(e.clientX, e.clientY)
      ;(o?.userData.p2tap as (() => void) | undefined)?.()
    }
    kick()
  }
  const onLeave = () => {
    if (hover) (hover = null), setHot()
  }
  const onKey = (e: KeyboardEvent) => {
    const k = e.key
    if (k === 'ArrowLeft' || k === 'ArrowRight') tgt.yaw = clamp(tgt.yaw + (k === 'ArrowLeft' ? 0.14 : -0.14), yawR[0], yawR[1])
    else if (k === 'ArrowUp' || k === 'ArrowDown') tgt.pitch = clamp(tgt.pitch + (k === 'ArrowUp' ? 0.06 : -0.06), pitchR[0], pitchR[1])
    else if (k === '+' || k === '=' || k === '-' || k === '_') tgt.zoom = clamp(tgt.zoom * (k === '-' || k === '_' ? 1.1 : 0.9), 0.65, 1.35)
    else return
    e.preventDefault()
    kick()
  }
  const onTilt = (e: DeviceOrientationEvent) => {
    if (e.gamma == null || e.beta == null) return
    if (Number.isNaN(gy.x0)) (gy.x0 = e.gamma), (gy.y0 = e.beta)
    gy.x = clamp((e.gamma - gy.x0) / 25, -1, 1) * -0.18
    gy.y = clamp((e.beta - gy.y0) / 25, -1, 1) * 0.08
    kick()
  }

  // ── build: the garden into the detached root, then the stage, so the first frame compiles every shader at once
  let resolve: (k: InkKit | null) => void = () => {}
  const ready = new Promise<InkKit | null>((r) => (resolve = r))
  let job: { cancel(): void } | null = null
  let undo: (() => void) | null = null
  const kit: InkKit = {
    root, low, ink, mesh, rock, stones, toro, bamboo, pine, ground, pond, backdrop, glow, tappable, pick,
    get stage() {
      return stage
    },
    turn(yaw, pitch) {
      tgt.yaw = clamp(yaw, yawR[0], yawR[1])
      if (pitch != null) tgt.pitch = clamp(pitch, pitchR[0], pitchR[1])
      kick()
    },
    render: () => stage?.render(),
  }
  function* run() {
    const user = build(kit)
    if (user) yield* { [Symbol.iterator]: () => user }
    yield
    // what the builders registered, now that everything sits where it will stay
    root.updateMatrixWorld(true)
    const box = new THREE.Box3(), size = new THREE.Vector3(), mid = new THREE.Vector3()
    if (lamps.length) lamps[0].getWorldPosition(U.uLampP.value)
    const key = U.uKey.value
    if (groundMat) {
      const gu = groundMat.uniforms
      ;(gu.uShDir.value as THREE.Vector2).set(-key.x, -key.z).normalize()
      gu.uShLen.value = Math.min(2.2, Math.sqrt(1 - key.y * key.y) / Math.max(0.2, key.y)) * 0.75
      const cast = gu.uCast.value as THREE.Vector4[]
      const n = Math.min(cast.length, casters.length)
      for (let i = 0; i < n; i++) {
        box.setFromObject(casters[i]).getSize(size)
        box.getCenter(mid)
        cast[i].set(mid.x, mid.z, Math.max(0.08, Math.min(size.x, size.z) * 0.5), size.y)
      }
      gu.uCastN.value = n
      const rg = gu.uRings.value as THREE.Vector4[]
      const m = Math.min(rg.length, rings.length)
      for (let i = 0; i < m; i++) {
        box.setFromObject(rings[i]).getSize(size)
        box.getCenter(mid)
        rg[i].set(mid.x, mid.z, Math.max(size.x, size.z) * 0.5 + 0.06, 0.7)
      }
      gu.uRingN.value = m
    }
    for (const t of taps) {
      box.setFromObject(t.obj)
      box.getCenter(t.c)
      t.r = box.getSize(size).length() * 0.42
      t.obj.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined
        if (m?.uniforms?.uHot) t.mats.push(m)
      })
    }
    yield
    // the stage on its own slice (a WebGL context costs ~20–35 ms on a slow phone)
    stage = createStage(el, { fov: opts.fov ?? 38, animate: false })
    if (!stage) {
      el.removeAttribute('tabindex')
      el.removeAttribute('role')
      hits.hidden = true // the proxies belong to 3D objects that are not there
      undo = opts.fallback ? opts.fallback(el) : inkFallback(ctx, el, opts.label)
      return resolve(null)
    }
    const st = stage
    st.canvas.setAttribute('aria-hidden', 'true')
    el.insertBefore(st.canvas, hits)
    st.scene.add(root)
    refit(st.width, st.height)
    st.onResize((w, hh) => {
      refit(w, hh)
      rect = null
      for (const t of taps) t.x = -1
    })
    st.onFrame(place)
    motion = createLoop(el, (t, dt) => {
      swayT = t
      if (dt > 0) U.uTime.value = t
      const moving = step(dt)
      place()
      // until the stage has drawn once (its async shader compile) let it draw: drawing here would compile synchronously
      if (st.renderer.info.render.frame) st.renderer.render(st.scene, st.camera)
      else st.render()
      return moving || swaying
    })
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('pointerleave', onLeave)
    el.addEventListener('keydown', onKey)
    if (opts.gyro && !ctx.reduced) addEventListener('deviceorientation', onTilt)
    st.render()
    if (swaying) motion.start()
    resolve(kit)
  }
  const raf = requestAnimationFrame(() => void (job = sliced(run(), { sync: ctx.reduced, budget: 6 })))

  let disposed = false
  const dispose = () => {
    if (disposed) return
    disposed = true
    cancelAnimationFrame(raf)
    job?.cancel()
    offPrefs()
    motion?.dispose()
    removeEventListener('deviceorientation', onTilt)
    undo?.()
    if (stage) stage.dispose()
    else
      root.traverse((o) => {
        ;(o as THREE.Mesh).geometry?.dispose()
      })
    hullMat.dispose()
    el.remove()
    resolve(null)
  }
  ctx.onCleanup(dispose)
  return { ready, dispose }
}

/** The night garden as a 2.5D paper diorama (depth.ts): the default stand-in without WebGL. Returns its cleanup. */
export function inkFallback(ctx: SceneCtx, host: HTMLElement, label?: string): () => void {
  return diorama(ctx, host, { ...nightGarden(), label }).dispose
}
