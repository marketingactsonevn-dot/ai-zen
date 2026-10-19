import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { fill, h, s } from '../../core/dom'
import { onPrefs } from '../../core/prefs'
import type { SceneCtx } from '../types'
import { inkGlsl, inkStage, type InkKit, type V3 } from '../../ui/part2/stage3d'
import { onDigit, onSize, rng, stableHeight, stoneArt } from '../../ui/part2/ink'
import { toro as paintToro } from '../../ui/part2/paint'
import { guide, type Mark } from '../../ui/part2/guide'
import { C } from './data'
import { placedRock, raftGeo, shapedTube, withAttr } from './geo3d'

const K = C.scenes.heads
/** each head's arcs crest at their own height: "Ai làm" lowest … "“Nó” là ai" highest */
const APEX = [0.3, 0.48, 0.66, 1.35]
const SRGB = THREE.SRGBColorSpace
/** the pond: a rounded square (superellipse of this power) */
const SQ = 5

// ── shaders (same haze / time / lamp uniforms as the kit)
const LAMPS = /* glsl */ `
uniform vec4 uLamps[4];
uniform vec3 uLampCs[4];
uniform float uLampK;`
const PONDFN = /* glsl */ `
uniform vec4 uPond;
float pondEdge(vec2 p) { vec2 q = abs((p - uPond.xy) / uPond.zw); return pow(pow(q.x, ${SQ}.0) + pow(q.y, ${SQ}.0), ${(1 / SQ).toFixed(3)}); }
float inPond(vec3 w) { return 1.0 - smoothstep(0.9, 0.985, pondEdge(w.xz)); }`
const WVERT = /* glsl */ `
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
/** where a point's mirror image meets the water, seen from the camera: drawn there, it hides behind what stands in front */
const MIRROR = /* glsl */ `
vec3 onWater(vec3 w) {
  vec3 m = vec3(w.x, -w.y, w.z);
  float t = (cameraPosition.y - 0.03) / max(cameraPosition.y - m.y, 1e-3);
  vec3 q = cameraPosition + (m - cameraPosition) * t;
  q.x += sin(q.z * 9.0 + uTime * 1.3) * 0.02 * clamp(w.y, 0.0, 1.0);
  return q;
}`
const MVERT = /* glsl */ `
uniform float uTime;
${MIRROR}
attribute float aG;
varying vec3 vW;
varying vec3 vN;
varying vec3 vO;
varying float vG;
varying float vH;
varying vec2 vUv;
void main() {
  vG = aG;
  vO = position;
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vH = w.y;
#ifdef ON_WATER
  vec3 q = onWater(w.xyz);
  vW = q;
  vN.y = -vN.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(q, 1.0);
#else
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
#endif
}`
/** the water: a rounded square, dark and deep where you look in, the sky where you look along it, the moon's road, glints, the lamps' streaks */
const POND_FRAG = /* glsl */ `
${inkGlsl.noise}
${inkGlsl.haze}
${LAMPS}
${PONDFN}
uniform vec3 uWater, uSky, uMoonC, uInk, uMoonDir;
uniform float uRoad, uGrain, uDark;
varying vec3 vW;
void main() {
  vec2 p = vW.xz;
  float edge = pondEdge(p) + (n2(p * 2.6) - 0.5) * 0.026;
  float fw = fwidth(edge);
  float wet = 1.0 - smoothstep(1.0 - fw, 1.0 + fw, edge);
  if (wet <= 0.0) discard;
  float deep = smoothstep(0.0, 0.5, 1.0 - edge);
  vec3 V = normalize(vW - cameraPosition);
  float steep = max(-V.y, 0.0);
  // ripples long across the view and short toward it, so lights break into roads that run at the eye
  vec2 toC = normalize(cameraPosition.xz - uPond.xy), side = vec2(toC.y, -toC.x);
  vec2 pc = vec2(dot(p, side), dot(p, toC));
  float gx = n2(pc * vec2(1.4, 4.2) + vec2(uTime * 0.22, 0.0)) - 0.5;
  float gz = n2(pc * vec2(2.3, 7.4) + vec2(3.0, -uTime * 0.18)) - 0.5;
  vec2 dn = gx * 0.05 * side + gz * 0.26 * toC;
  vec3 N = normalize(vec3(dn.x, 1.0, dn.y));
  vec3 R = reflect(V, N);
  // looking in: ink gathering toward the middle; looking along: the sky (Fresnel, bolder than nature on a small pond)
  vec3 body = mix(mix(uWater, uInk, 0.34 - 0.04 * uDark), mix(uWater, uInk, 0.74 - 0.08 * uDark), deep);
  vec3 sky = mix(uSky, uFogC, smoothstep(0.02, 0.6, R.y));
  float fres = 0.1 + 0.9 * pow(1.0 - steep, 3.2);
  vec3 col = mix(body, sky, clamp(fres * (0.62 + 0.48 * uDark), 0.0, 0.9));
  // the stones' shadow just inside the rim
  float rim = 1.0 - smoothstep(0.0, 0.15, 1.0 - edge + (n2(p * 5.0) - 0.5) * 0.05);
  col = mix(col, mix(uInk, uWater, 0.25 * (1.0 - uDark)), rim * 0.62);
  // dry-brush ripples: pale dashes on the dark near water, ink dashes on the bright far water
  float rip = smoothstep(0.68, 0.95, n2(vec2(pc.x * 1.1, pc.y * 13.0) + vec2(uTime * 0.05, 0.0)));
  float rip2 = smoothstep(0.72, 0.97, n2(vec2(pc.x * 0.8 + 9.0, pc.y * 22.0) - vec2(uTime * 0.04, 0.0)));
  col = mix(col, uSky, rip * (1.0 - fres) * (0.22 + 0.2 * uDark) * deep);
  col = mix(col, uInk, rip2 * fres * 0.14 * deep);
  // the moon's broken road and its glints
  float brk = 0.3 + 0.7 * smoothstep(0.3, 0.7, n2(vec2(pc.x * 3.0, pc.y * 18.0 - uTime * 0.1)));
  float m = dot(R, uMoonDir);
  float glint = smoothstep(0.93, 1.0, n2(pc * vec2(34.0, 92.0) + vec2(uTime * 0.4, -uTime * 0.25)));
  col += uMoonC * (smoothstep(0.9955, 0.9992, m) * brk + smoothstep(0.97, 0.999, m) * 0.16 + glint * smoothstep(0.94, 0.995, m) * 0.9) * uRoad * (0.45 + 0.55 * deep);
  // each lantern's light, broken into a streak running at the eye
  vec3 Nl = normalize(vec3(dn.x * 0.6, 1.0, dn.y * 0.6));
  vec3 Rl = reflect(V, Nl);
  for (int i = 0; i < 4; i++) {
    float l = max(dot(Rl, normalize(uLamps[i].xyz - vW)), 0.0);
    col += uLampCs[i] * (pow(l, 180.0) * brk * 1.8 + pow(l, 26.0) * 0.1) * (0.55 + uLampK) * uLamps[i].w;
  }
  col += (h21(gl_FragCoord.xy) - 0.5) * uGrain;
  gl_FragColor = vec4(haze(col, vW), wet);
  #include <colorspace_fragment>
}`
/** a stone lantern: granite pitted by noise (a bumped normal), stains running from the ledges, lichen, moss at its foot */
const STONE_FRAG = /* glsl */ `
${inkGlsl.noise}
${inkGlsl.haze}
${LAMPS}
uniform vec3 uLo, uMid, uHi, uInk, uMoonC, uLampC, uMossLo, uMossMid, uMossHi, uKey, uMoonDir;
uniform float uMossK, uHot, uSeed, uGrain, uRim;
varying vec3 vW;
varying vec3 vN;
varying vec3 vO;
float pit(vec3 q) { return n3(q) + 0.5 * n3(q * 2.7 + 5.0); }
void main() {
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  vec3 V = normalize(cameraPosition - vW);
  vec3 q = vO * 12.0 + uSeed;
  float b0 = pit(q);
  const float e = 0.05;
  vec3 gr = vec3(pit(q + vec3(e, 0.0, 0.0)), pit(q + vec3(0.0, e, 0.0)), pit(q + vec3(0.0, 0.0, e))) - b0;
  n = normalize(n - gr / e * 0.03);
  float wob = (fbm3(vO * 3.0 + uSeed) - 0.5) * 0.45;
  float nl = dot(n, uKey);
  float lit = smoothstep(-0.2, 0.3, nl + wob);
  float top = smoothstep(0.4, 0.85, nl + wob * 0.6);
  vec3 col = mix(uLo, uMid, lit);
  col = mix(col, uHi, top * 0.7);
  float stain = smoothstep(0.52, 0.82, fbm3(vec3(vO.x * 7.0, vO.y * 1.4, vO.z * 7.0) + uSeed));
  col = mix(col, mix(uLo, uInk, 0.4), stain * 0.38);
  float lichen = smoothstep(0.76, 0.9, n3(vO * 24.0 + uSeed + 3.0));
  col = mix(col, uHi, lichen * 0.4 * lit);
  col *= 0.84 + 0.3 * smoothstep(0.3, 1.2, b0);
  // what faces down sits in its own shadow (under the roof, the platform's lip)
  col *= 1.0 - 0.5 * smoothstep(-0.15, -0.75, n.y);
  // moss: in tufts on what faces up (a lantern: thick at its foot too)
  float mn = fbm3(vO * 8.0 + uSeed + 7.0);
#ifdef ROCK
  float moss = smoothstep(0.35, 0.8, n.y + (mn - 0.5) * 0.9) * uMossK;
#else
  float moss = clamp(smoothstep(0.34, 0.03, vO.y) + smoothstep(0.55, 0.9, n.y) * 0.55, 0.0, 1.0) * smoothstep(0.38, 0.62, mn + 0.12) * uMossK;
#endif
  col = mix(col, mix(mix(uMossLo, uMossMid, lit), uMossHi, top * 0.4), moss);
  // its own window's light on the firebox, the others' on its flanks
  for (int i = 0; i < 4; i++) {
    vec3 lv = uLamps[i].xyz - vW;
    float ld = length(lv);
    col += uLampCs[i] * (uLampK + 0.25) * uLamps[i].w * max(dot(n, lv / max(ld, 1e-3)), 0.0) / (1.0 + ld * ld * 7.0);
  }
  float fres = pow(1.0 - max(dot(n, V), 0.0), 2.6);
  col = mix(col, uMoonC, fres * smoothstep(-0.35, 0.55, dot(n, uMoonDir)) * uRim);
  col = mix(col, uLampC, uHot * (0.1 + 0.42 * fres));
  col += (h21(gl_FragCoord.xy) - 0.5) * uGrain;
  gl_FragColor = vec4(haze(col, vW), 1.0);
  #include <colorspace_fragment>
}`
/** what stands on the bank, mirrored in the water: a soft dark image, trembling, only inside the pond */
const REFL_FRAG = /* glsl */ `
${inkGlsl.noise}
${inkGlsl.haze}
${PONDFN}
uniform vec3 uC, uMoonC, uMoonDir;
uniform float uK;
varying vec3 vW;
varying vec3 vN;
varying float vH;
void main() {
  float a = inPond(vW) * uK * (1.0 - smoothstep(0.3, 2.2, vH)) * (0.6 + 0.4 * n2(vec2(vW.x * 3.0, vW.z * 26.0) + vec2(0.0, uTime * 0.3)));
  vec3 col = mix(uC, uMoonC, 0.18 * max(dot(normalize(vN), uMoonDir), 0.0));
  gl_FragColor = vec4(haze(col, vW), a);
  #include <colorspace_fragment>
}`
/** an arc of attention: thin, tapered, brightest along its core and fading at its sides (added light at night) */
const ARC_FRAG = /* glsl */ `
${inkGlsl.noise}
${inkGlsl.haze}
${PONDFN}
uniform vec3 uC;
uniform float uK, uGrow, uDark;
varying vec3 vW;
varying vec3 vN;
varying float vG;
varying float vH;
void main() {
  vec3 V = normalize(cameraPosition - vW);
  float core = pow(abs(dot(normalize(vN), V)), mix(1.3, 2.2, uDark));
  float shown = 1.0 - smoothstep(uGrow - 0.03, uGrow, vG);
  float flow = 0.78 + 0.22 * sin(vG * 60.0 - uTime * 2.4);
  float a = uK * shown * core * flow;
#ifdef ON_WATER
  a *= inPond(vW) * 0.24 * (1.0 - 0.75 * smoothstep(0.0, 1.4, vH)) * smoothstep(0.3, 0.75, n2(vec2(vW.x * 3.0, vW.z * 24.0) + vec2(0.0, uTime * 0.4)));
#endif
  a *= 1.0 - 0.6 * hazeK(vW);
  gl_FragColor = vec4(uC * (1.0 + uDark * core * 0.5), a * (0.95 - 0.1 * uDark));
  #include <colorspace_fragment>
}`
/** a lantern's light: a cone falling through the mist (vG 0 at the window … 1 on the water), and its pool on the water (vG 2) */
const CONE_FRAG = /* glsl */ `
${inkGlsl.noise}
${inkGlsl.haze}
${PONDFN}
uniform vec3 uC;
uniform float uK, uCone, uDark;
varying vec3 vW;
varying vec3 vN;
varying vec2 vUv;
varying float vG;
void main() {
  float a;
  if (vG > 1.5) {
    float r = length(vUv - 0.5) * 2.0;
    a = (0.46 - 0.2 * uDark) * (1.0 - smoothstep(0.0, 1.0, r)) * (0.75 + 0.25 * n2(vW.xz * 5.0)) * (0.35 + 0.65 * inPond(vW));
  } else {
    vec3 V = normalize(cameraPosition - vW);
    float core = pow(abs(dot(normalize(vN), V)), 1.5);
    float mist = 0.5 + 0.5 * fbm2(vec2(vW.x + vW.z, vW.y * 2.2 - uTime * 0.08) * 1.4);
    a = uCone * (0.36 - 0.06 * uDark) * core * smoothstep(0.0, 0.1, vG) * (1.0 - 0.5 * vG) * (1.0 - smoothstep(0.85, 1.0, vG)) * mist;
  }
  gl_FragColor = vec4(uC, a * uK);
  #include <colorspace_fragment>
}`
/** the rafts: a word inked on each from the atlas, bobbing a little (aL: where on the sheet, aT: atlas uv) */
const RAFT_VERT = /* glsl */ `
uniform float uTime;
${MIRROR}
uniform vec4 uGlow[9];
attribute float aI;
attribute vec2 aL;
attribute vec2 aT;
varying vec3 vW;
varying vec3 vN;
varying vec4 vGl;
varying vec2 vL;
varying vec2 vT;
void main() {
  vL = aL;
  vT = aT;
  vec4 w = modelMatrix * vec4(position, 1.0);
  float ph = aI * 2.17;
  w.y += sin(uTime * 0.9 + ph) * 0.008 + aL.y * sin(uTime * 0.7 + ph * 1.3) * 0.022 + aL.x * sin(uTime * 0.55 + ph) * 0.016;
  vN = normalize(mat3(modelMatrix) * normal);
  vGl = uGlow[int(aI + 0.5)];
#ifdef ON_WATER
  vec3 q = onWater(w.xyz);
  vW = q;
  vN.y = -vN.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(q, 1.0);
#else
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
#endif
}`
const RAFT_FRAG = /* glsl */ `
${inkGlsl.noise}
${inkGlsl.haze}
${PONDFN}
uniform sampler2D uAtlas;
uniform vec3 uPaper, uInkW, uMoonC, uKey;
uniform float uDark;
varying vec3 vW;
varying vec3 vN;
varying vec4 vGl;
varying vec2 vL;
varying vec2 vT;
void main() {
  vec3 n = normalize(vN);
  float top = smoothstep(0.5, 0.85, abs(n.y));
  float lit = 0.76 + 0.24 * max(dot(n, uKey), 0.0);
  // dó paper: long fibres, a few flecks, a rim that darkens where it drinks the water
  float fib = 0.94 + 0.08 * n2(vL * vec2(90.0, 14.0)) - 0.05 * smoothstep(0.82, 0.95, n2(vL * 160.0));
  float e = 0.5 - max(abs(vL.x), abs(vL.y)) + (n2(vL * 40.0) - 0.5) * 0.03;
  vec3 pap = uPaper * fib * mix(0.8, 1.0, smoothstep(0.0, 0.07, e));
  float ink = texture2D(uAtlas, vT).a * top;
  vec3 inkC = mix(uInkW, vGl.rgb, clamp(vGl.a, 0.0, 1.0) * 0.55);
  vec3 col = mix(pap * lit, inkC, ink * 0.94);
  // a lit head warms the sheets it joins; the thickness of the paper shows on its sides
  col = mix(col, col + vGl.rgb * 0.22, clamp(vGl.a, 0.0, 1.0) * top * (1.0 - ink));
  col = mix(uPaper * (0.62 + 0.2 * uDark), col, top);
  vec3 V = normalize(cameraPosition - vW);
  col = mix(col, uMoonC, pow(1.0 - max(dot(n, V), 0.0), 3.0) * 0.25 * uDark);
  float a = 1.0;
#ifdef ON_WATER
  a = inPond(vW) * 0.38 * (0.45 + 0.55 * n2(vec2(vW.x * 3.0, vW.z * 26.0) + vec2(0.0, uTime * 0.3)));
#endif
  gl_FragColor = vec4(haze(col, vW), a);
  #include <colorspace_fragment>
}`
/** under each raft: a soft shadow in the water and a bright meniscus ring where the paper meets it; or (MIST) a torn sheet of mist */
const SOFT_FRAG = /* glsl */ `
${inkGlsl.noise}
${inkGlsl.haze}
uniform vec3 uC, uRing;
uniform float uK, uSeed, uRingK;
varying vec3 vW;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
#ifdef MIST
  float n = fbm2(vec2(vW.x * 0.45 + uTime * 0.035 + uSeed, vW.z * 0.8 - uSeed));
  gl_FragColor = vec4(uC, (1.0 - smoothstep(0.3, 1.0, r)) * smoothstep(0.42, 0.8, n) * uK * (1.0 - hazeK(vW)));
#else
  float sh = (1.0 - smoothstep(0.3, 0.95, r)) * uK;
  float ring = (1.0 - smoothstep(0.0, 0.06, abs(r - 0.74 - (n2(vUv * 20.0 + uTime * 0.2) - 0.5) * 0.04))) * uRingK * (0.5 + 0.5 * n2(vUv * 9.0));
  gl_FragColor = vec4(mix(uC, uRing, ring / max(ring + sh, 1e-3)), max(sh, ring) * (1.0 - hazeK(vW)));
#endif
  #include <colorspace_fragment>
}`
/** layered hills behind the garden: a ridge from noise, dense on the crest, thinning into mist at the foot */
const HILL_FRAG = /* glsl */ `
${inkGlsl.noise}
uniform vec3 uC, uFogC, uMoonC, uMistC;
uniform float uSeed, uBase, uAmp, uK, uDepth, uRimK;
varying vec2 vUv;
float ridged(float x, float s) { return 1.0 - abs(n2(vec2(x, s)) * 2.0 - 1.0); }
void main() {
  float x = vUv.x * 40.0;
  float r = uBase + uAmp * (0.55 * pow(ridged(x * 0.3, uSeed), 1.6) + 0.3 * n2(vec2(x * 0.9, uSeed + 1.0)) + 0.15 * n2(vec2(x * 3.2, uSeed + 2.0)));
  float y = vUv.y;
  float fw = fwidth(y) * 1.4;
  float edge = r - y;
  float inside = smoothstep(-fw, fw, edge);
  float t = clamp(edge / (uAmp * 0.8 + 0.04), 0.0, 1.0);
  float body = (0.25 + 0.75 * (1.0 - t) * (1.0 - t)) * (0.85 + 0.3 * n2(vec2(x * 20.0, y * 70.0)));
  // moonlit mist pooling in the valley at its foot
  vec3 col = mix(mix(uC, uFogC, uDepth), uMistC, smoothstep(0.25, 1.0, t) * 0.7);
  float rim = (1.0 - smoothstep(0.0, fw * 3.0, edge)) * inside * uRimK;
  col = mix(col, uMoonC, rim);
  gl_FragColor = vec4(col, clamp(inside * body * uK * smoothstep(uBase - 0.16, uBase + 0.08, y) + rim * 0.3, 0.0, 1.0));
  #include <colorspace_fragment>
}`
/** "four gazes, one sentence" written on the water, left to right, trembling with it */
const WRITE_FRAG = /* glsl */ `
${inkGlsl.noise}
${inkGlsl.haze}
${PONDFN}
uniform sampler2D uAtlas;
uniform vec4 uRect;
uniform vec3 uC;
uniform float uK, uGrow;
varying vec3 vW;
varying vec2 vUv;
void main() {
  vec2 uv = vUv + vec2(sin(vUv.y * 40.0 + uTime * 1.3) * 0.002, 0.0);
  float a = texture2D(uAtlas, uRect.xy + uv * uRect.zw).a;
  float shown = 1.0 - smoothstep(uGrow - 0.08, uGrow, vUv.x);
  gl_FragColor = vec4(haze(uC, vW), a * uK * shown * inPond(vW) * (0.82 + 0.18 * n2(vW.xz * 18.0)));
  #include <colorspace_fragment>
}`
const FLY_VERT = /* glsl */ `
uniform float uTime, uPx;
attribute float aG;
varying float vA;
void main() {
  vec3 p = position;
  p.x += sin(uTime * 0.35 + aG * 6.3) * 0.32;
  p.z += cos(uTime * 0.29 + aG * 4.1) * 0.32;
  p.y += sin(uTime * 0.5 + aG * 9.0) * 0.14;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uPx * 0.045 / -mv.z;
  vA = 0.4 + 0.6 * (0.5 + 0.5 * sin(uTime * 1.7 + aG * 20.0));
}`
const FLY_FRAG = /* glsl */ `
uniform vec3 uC;
uniform float uK;
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  gl_FragColor = vec4(uC, (1.0 - smoothstep(0.0, 1.0, d)) * vA * uK);
  #include <colorspace_fragment>
}`

interface HeadsView {
  set(i: number, lit: boolean): void
  all(): void
}
type Raft = { x: number; z: number; w: number; d: number; a: number }

/**
 * ★ Scene 2 (hero, WebGL) — a moonlit pond, a rounded square rimmed with mossy stones, a stone lantern at each corner
 * in its own tint. The sentence floats on nine dó-paper rafts, each word inked on its sheet. Light a lantern: a cone of
 * its light falls through the mist and the words it joins arc up as thin bands of its colour, every head at its own
 * height. From above the bands tangle; lowered toward the water they part into four tiers — orbit to see multi-head
 * attention.
 */
export function headsScene(ctx: SceneCtx) {
  const N = K.heads.length
  const on = K.heads.map(() => false)
  let done = false
  let view: HeadsView | null = null
  const stableH = stableHeight(ctx, [K.insight])
  const root = h('div', { class: 'g8h3' }, h('p', { class: 'visually-hidden' }, K.art), h('p', { class: 'visually-hidden' }, K.words.join(' ')))
  const live = h('p', { class: 'visually-hidden' })
  ctx.art.append(root, live)
  const W0 = ctx.art.clientWidth, H0 = ctx.art.clientHeight
  const tall = W0 < H0
  root.style.height = `${stableH(H0)}px`
  ctx.onCleanup(onSize(ctx.art, () => void (root.style.height = `${stableH(ctx.art.clientHeight)}px`)))
  ctx.prompt(fill(K.prompt, { n: 0 }))
  ctx.onCleanup(onDigit((d) => d <= N && toggle(d - 1)))
  // H1 a vermilion dot over every unlit lantern (riding on an anchor the kit keeps over its roof); H5 the count in the prompt
  const g = guide(ctx)
  const dots: (Mark | null)[] = K.heads.map(() => null)
  const g8dot = (el: HTMLElement) => {
    const d = g.dot(el)
    d.el.classList.add('g8h-dot')
    return d
  }
  let decoded = false
  let painted = false // no WebGL: the painted view

  // ── the garden's plan: the pond square to the world, the camera at a 3/4 turn to it; the rafts face the camera
  const POND: [number, number] = tall ? [2.45, 4.4] : [3.3, 2.2]
  const yaw0 = tall ? -0.05 : -0.32
  // (a tall frame adds 0.13 of its own: 50° there, 35° on a wide one)
  const pitch0 = tall ? 0.74 : 0.61
  const T: V3 = tall ? [0, 0.5, 0.35] : [-0.1, 0.45, 0.45]
  /** below this pitch the eye is down at the water and the four tiers have parted */
  const lowP = pitch0 - 0.17
  const cy = Math.cos(yaw0), sy = Math.sin(yaw0)
  /** camera frame (u right, v toward the viewer) → world x, z */
  const W = (u: number, v: number): [number, number] => [u * cy + v * sy, -u * sy + v * cy]
  const corners: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [a * POND[0] * 0.97, b * POND[1] * 0.97])
  const lampAt = corners
  const BASE = 0.36 // the mossy stone each lantern stands on
  const LH = tall ? 1.55 : 1.45
  const windowY = BASE * 0.9 + 0.98 * (LH / 1.55)

  // ── the rafts, sized to their words (measured in the atlas font); one bowed row, two on a tall frame
  let E = tall ? 0.3 : 0.22 // a word's em on the paper, world units (less when the words are long)
  const SZ = 1.35 // drawn taller along the paper than across, so it reads at the camera's tilt
  const raft: Raft[] = []
  let widths: number[] = []
  function planRafts(textW: number[], F: number) {
    const rows = tall ? [[0, 1, 2, 3], [4, 5, 6, 7, 8]] : [K.words.map((_, i) => i)]
    const gap = tall ? 0.12 : 0.1
    // the longest row must lie inside the pond's rim
    const limit = POND[0] * 2 * (tall ? 0.86 : 0.88)
    for (const idx of rows) E = Math.min(E, (limit - gap * (idx.length - 1)) / idx.reduce((a, i) => a + textW[i] / F + 0.9, 0))
    widths = textW.map((tw) => (tw / F) * E + E * 0.9)
    const d = E * SZ * 1.9
    rows.forEach((idx, r) => {
      const L = idx.reduce((a, i) => a + widths[i], 0) + gap * (idx.length - 1)
      let u = -L / 2
      for (const i of idx) {
        const uc = u + widths[i] / 2
        const t = uc / (L / 2)
        const v = (tall ? -1.45 + r * 1.4 : -0.45) + (tall ? 0.3 : 0.5) * (1 - t * t) + Math.sin(i * 2.3) * 0.05
        const [x, z] = W(uc, v)
        raft[i] = { x, z, w: widths[i], d, a: Math.sin(i * 1.7 + 0.4) * 0.07 }
        u += widths[i] + gap
      }
    })
  }

  /** each link of head i as one arc from word to word, cresting at the head's height */
  const linkPaths = (i: number) =>
    K.heads[i].links.map(([a, b]) => {
      const A = raft[a], B = raft[b]
      const P0 = new THREE.Vector3(A.x, 0.05, A.z), P3 = new THREE.Vector3(B.x, 0.05, B.z)
      const d = P3.clone().sub(P0).multiplyScalar(0.12)
      const lift = (APEX[i] - 0.05) / 0.75
      return new THREE.CubicBezierCurve3(P0, P0.clone().add(d).setY(lift), P3.clone().sub(d).setY(lift), P3)
    })

  // ── shared state → whichever view is up (3D, or the painted fallback)
  function toggle(i: number) {
    if (done && on[i]) return // all four lit: they stay lit while the eye goes down to the water
    on[i] = !on[i]
    ctx.chime(on[i] ? 'tap' : 'soft')
    view?.set(i, on[i])
    const hd = K.heads[i]
    live.textContent = on[i] ? `${hd.name}: ${hd.relation}` : ''
    if (!live.hasAttribute('aria-live')) live.setAttribute('aria-live', 'polite')
    dots[i]?.el.classList.toggle('g8h-off', on[i])
    const lit = on.filter(Boolean).length
    if (on.every(Boolean) && !done) {
      done = true
      dots.forEach((d) => d?.done())
      view?.all()
      live.textContent = K.allLit
      // the 3D moment: lower the eye to the water (drag down, ↓, or the camera sinks by itself when left alone);
      // without WebGL there is nothing to lower: the insight comes now
      if (painted) return void show()
      ctx.prompt(K.orbit)
      if (kit) arrow()
    } else if (!done) ctx.prompt(fill(K.prompt, { n: lit }))
  }
  let down: Mark | null = null
  // a faint curved arrow at the right edge, pointing down (the hidden gesture)
  const arrow = () => void (down ??= g.gesture('drag-v', () => [ctx.art.clientWidth - 46, ctx.art.clientHeight * 0.46], { r: 34 }))
  let shown = false
  function show() {
    if (shown) return
    shown = true
    down?.done()
    ctx.insight(K.insight, [K.detail, K.detail2, K.headsNote])
  }
  // H7: left alone with every lantern lit, the camera sinks to the water itself
  const sink = () => void (done && !shown && kit?.fly(T, yaw0 + (tall ? 0.05 : 0.1), lowP - 0.06, ctx.reduced ? 0 : 2.4))
  ctx.el.addEventListener('p2:idle', sink)
  ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', sink))

  let kit: InkKit | null = null
  // the visitor took the camera (a real drag, the wheel, the arrows — not a tap on a lantern): no more flights of ours
  let took = false
  const take = () => void (took = true)
  root.addEventListener('wheel', take, { passive: true })
  root.addEventListener('keydown', (e) => e.key.startsWith('Arrow') && take())
  // The kit turns like an orbit control (drag down = look from higher). Here "down" lowers the eye to the water, as the
  // prompt says (audit 22-2): the vertical part of a one-finger drag is mirrored on its way into the stage.
  const mirrored = new WeakSet<Event>()
  let mId = -1, mY = 0, mX = 0, downs = 0
  root.addEventListener('pointerdown', (e) => {
    downs++
    if (downs === 1) (mId = e.pointerId), (mY = e.clientY), (mX = e.clientX)
  }, true)
  root.addEventListener('pointermove', (e) => {
    if (mirrored.has(e) || e.pointerId !== mId || downs !== 1 || !(e.target instanceof Element)) return
    if (Math.hypot(e.clientX - mX, e.clientY - mY) > 6) take()
    e.stopImmediatePropagation()
    const m = new PointerEvent('pointermove', { bubbles: true, pointerId: e.pointerId, pointerType: e.pointerType, isPrimary: e.isPrimary, buttons: e.buttons, clientX: e.clientX, clientY: 2 * mY - e.clientY })
    mirrored.add(m)
    e.target.dispatchEvent(m)
  }, true)
  const lift = (e: PointerEvent) => {
    downs = Math.max(0, downs - 1)
    if (e.pointerId === mId) mId = -1
  }
  root.addEventListener('pointerup', lift, true)
  root.addEventListener('pointercancel', lift, true)
  const home = () => void kit?.fly(T, yaw0, pitch0, 1.1)
  let lastUp = 0, lx = 0, ly = 0
  root.addEventListener('pointerup', (e) => {
    const t = performance.now()
    if (t - lastUp < 320 && Math.hypot(e.clientX - lx, e.clientY - ly) < 24) return void ((lastUp = 0), home())
    lastUp = t
    lx = e.clientX
    ly = e.clientY
  })
  root.addEventListener('keydown', (e) => e.key === 'Home' && (e.preventDefault(), home()))

  let atlasTex: THREE.CanvasTexture | null = null
  inkStage(ctx, root, {
    label: K.aria, hint: K.hint, gyro: true, dpr: [1.75, 1.25], fallback,
    // (no higher than a little over the default: from above, the far lanterns leave the frame — audit 22-2)
    view: { yaw: yaw0, pitch: pitch0, yawRange: [yaw0 - 1.05, yaw0 + 1.05], pitchRange: [0.21 - (tall ? 0.13 : 0), pitch0 + 0.16], fit: tall ? [6.8, 3.6] : [4.6, 2.75], target: T, shift: 0, zoomRange: [0.6, 1.4] },
  }, build).ready.then((k) => {
    if (!k?.stage) return
    kit = k
    // every lit lantern lit before the stage was up (keys): the eye goes down now
    if (done && !shown) arrow()
    // the eye is down at the water (its height over the target, as an angle): the four tiers part → the insight
    const cam = k.stage.camera
    k.onFrame(() => {
      if (!done || shown) return
      const dx = cam.position.x - T[0], dy = cam.position.y - T[1], dz = cam.position.z - T[2]
      if (Math.asin(dy / Math.hypot(dx, dy, dz)) < lowP + (tall ? 0.13 : 0)) show()
    })
    const st = k.stage
    const px = () => void (flyU.uPx.value = (st.height * st.renderer.getPixelRatio()) / (2 * Math.tan((st.camera.fov * Math.PI) / 360)))
    px()
    st.onResize(px)
    // the words are read at a slant: sharpen the atlas along it
    if (atlasTex) (atlasTex.anisotropy = Math.min(8, st.renderer.capabilities.getMaxAnisotropy())), (atlasTex.needsUpdate = true), k.render()
  })

  const flyU = { uPx: { value: 600 } }
  function* build(k: InkKit) {
    const low = k.low
    const cs = () => getComputedStyle(document.documentElement)
    const dark = { value: 0 }
    const pondU = { value: new THREE.Vector4(0, 0, POND[0], POND[1]) }
    const arcC = K.heads.map(() => new THREE.Color()), lightC = K.heads.map(() => new THREE.Color())
    const rockC = [new THREE.Color(), new THREE.Color(), new THREE.Color()]
    const paper = new THREE.Color(), inkW = new THREE.Color(), mistC = new THREE.Color(), shadowC = new THREE.Color(), ringC = new THREE.Color(), flyC = new THREE.Color(), reflC = new THREE.Color(), writeC = new THREE.Color(), hillC = new THREE.Color()
    const mistK = { value: 0.3 }, shadowK = { value: 0.3 }, ringK = { value: 0.5 }, flyK = { value: 0.8 }, coneK = { value: 1 }, reflK = { value: 0.5 }
    const blendables: THREE.ShaderMaterial[] = []
    const hillMats: THREE.ShaderMaterial[] = []
    type Head = { arcs: THREE.Mesh; mirror: THREE.Mesh | null; light: THREE.Mesh; u: Record<string, THREE.IUniform>; cu: Record<string, THREE.IUniform>; want: number; k: number; running: boolean }
    const heads: Head[] = []
    const recolor = () => {
      const c = cs()
      const v = (n: string) => c.getPropertyValue(n).trim() || '#888'
      dark.value = document.documentElement.dataset.theme === 'dark' ? 1 : 0
      arcC.forEach((hc, i) => hc.setStyle(v(`--g8h-${i}`), SRGB))
      lightC.forEach((hc, i) => hc.setStyle(v(`--g8h-${i}l`), SRGB))
      rockC.forEach((c2, i) => c2.setStyle(v(`--g8h-rock${i}`), SRGB))
      paper.setStyle(v('--g8h-paper'), SRGB)
      inkW.setStyle(v('--g8h-ink'), SRGB)
      mistC.setStyle(v('--mist'), SRGB)
      shadowC.setStyle(v('--umbra'), SRGB)
      ringC.setStyle(v('--g8h-meniscus'), SRGB)
      flyC.setStyle(v('--firefly'), SRGB)
      reflC.setStyle(v('--g8h-refl'), SRGB)
      writeC.setStyle(v('--g8h-write'), SRGB)
      hillC.setStyle(v('--g8h-hill'), SRGB)
      mistK.value = dark.value ? 0.14 : 0.1
      coneK.value = ctx.reduced ? 0 : 1
      shadowK.value = dark.value ? 0.55 : 0.32
      ringK.value = dark.value ? 0.4 : 0.75
      reflK.value = dark.value ? 0.55 : 0.42
      flyK.value = dark.value ? 0.9 : 0.55
      // light adds up at night; by day the arcs are ink and the light a pale wash laid over
      for (const m of blendables) m.blending = dark.value ? THREE.AdditiveBlending : THREE.NormalBlending
      hillMats.forEach((m, i) => (m.uniforms.uRimK.value = dark.value ? 0.16 - i * 0.04 : 0.05, m.uniforms.uK.value = (dark.value ? 1.25 : 0.9) * [0.62, 0.42, 0.28][i]))
      glowAll()
    }
    ctx.onCleanup(onPrefs(() => (recolor(), k.render())))
    const defines = { OCT: low ? 2 : 4 }
    const mat = (o: { frag: string; vert?: string; u: Record<string, THREE.IUniform>; water?: boolean; side?: THREE.Side; blend?: boolean; def?: Record<string, number> }) =>
      new THREE.ShaderMaterial({
        vertexShader: o.vert ?? MVERT, fragmentShader: o.frag, uniforms: o.u, transparent: o.blend !== false, depthWrite: o.blend === false, side: o.side ?? THREE.FrontSide,
        defines: { ...defines, ...(o.water ? { ON_WATER: 1 } : {}), ...o.def },
      })

    // the moon high behind the far right of the pond: its road runs down the water at us; the key light from its side
    const [mx, mz] = W(0.35, -1)
    const ml = Math.hypot(mx, mz), el = 0.72
    k.uniforms.uMoonDir.value.set((mx / ml) * Math.cos(el), Math.sin(el), (mz / ml) * Math.cos(el)).normalize()
    k.uniforms.uKey.value.set((mx / ml) * 0.6 - 0.25, 0.8, (mz / ml) * 0.6).normalize()
    k.ground({ r: 9 })
    const pondMesh = k.pond({ at: [0, 0], r: POND, seed: 22 })
    // the kit's pond is an oval: keep its uniforms (theme, lamps, moon), paint our own rounded square with them
    const pu = (pondMesh.material as THREE.ShaderMaterial).uniforms
    pu.uPond = pondU
    ;(pondMesh.material as THREE.Material).dispose()
    pondMesh.material = new THREE.ShaderMaterial({ vertexShader: WVERT, fragmentShader: POND_FRAG, uniforms: pu, defines, transparent: true })
    yield

    // layered hills behind the garden, thinning into mist at their feet (the far half of three rings: BackSide)
    ;[[7.6, 0.06, 0.2, 0.0], [10.5, 0.07, 0.26, 0.35], [14, 0.08, 0.32, 0.65]].forEach(([R, base, amp, depth], i) => {
      if (low && i === 2) return
      const m = new THREE.ShaderMaterial({
        vertexShader: WVERT, fragmentShader: HILL_FRAG, defines, transparent: true, depthWrite: false, side: THREE.BackSide,
        uniforms: { uC: { value: hillC }, uMistC: { value: mistC }, uFogC: k.uniforms.uFogC, uMoonC: k.uniforms.uMoonC, uSeed: { value: 5 + i * 3.3 }, uBase: { value: base }, uAmp: { value: amp }, uK: { value: 0.5 }, uDepth: { value: depth }, uRimK: { value: 0.2 } },
      })
      hillMats.push(m)
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 12, low ? 64 : 120, 1, true), m)
      cyl.position.set(0, 6 - 0.6, 0)
      cyl.renderOrder = -8 + i * -1
      cyl.raycast = () => {}
      k.root.add(cyl)
    })
    yield

    const stoneC = { uLo: { value: rockC[0] }, uMid: { value: rockC[1] }, uHi: { value: rockC[2] } }
    // four stone lanterns on the pond's corners, unlit (an ember in the window), each its own tint; tap or Tab to them.
    // The kit's toro, re-dressed in pitted, mossy granite (no ink outline: that read as a toy)
    const lamps = lampAt.map(([x, z], i) => {
      const g = k.toro({ at: [x, z], h: LH, tint: `--g8h-${i}l`, lit: 0.1, rotY: yaw0 + (i - 1.5) * 0.12 })
      g.position.y = BASE * 0.9
      const body = g.children.find((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh && (c as THREE.Mesh).geometry.attributes.position.count > 400)
      if (body) {
        body.material = new THREE.ShaderMaterial({ vertexShader: WVERT, fragmentShader: STONE_FRAG, defines, uniforms: { ...k.ink('rock', { moss: 0.85 }).uniforms, ...stoneC } })
        body.children.forEach((hull) => (hull.visible = false))
      }
      const btn = k.tappable(g, K.heads[i].aria, () => toggle(i))
      btn.setAttribute('aria-pressed', 'false')
      // its name and what it joins, riding above it once lit
      const inner = h('div', { class: 'g8h-tagi' }, h('b', null, K.heads[i].name), h('span', null, K.heads[i].relation), h('em', { class: 'g8h-decode' }, K.decode))
      const tag = k.label(g, h('div', { class: `g8h-tag h${i}` }, inner), [0, 0.16, 0])
      // the dot rides an anchor the kit keeps on the lantern's roof (the tap proxy itself is invisible)
      if (!done) dots[i] = g8dot(k.label(g, h('div', { class: 'g8h-anchor' }), [0, -0.06, 0]))
      dots[i]?.el.classList.toggle('g8h-off', on[i])
      const box = new THREE.Box3().setFromObject(g)
      // where the kit pins the tag (its box's top centre + the offset), and the lantern's own extent on screen
      const pin = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y + 0.16, (box.min.z + box.max.z) / 2)
      return { g, body, btn, tag, inner, pin, top: box.max.y, foot: new THREE.Vector3(x, BASE * 0.9, z), w: 0, h: 0, dx: 0, dy: 0 }
    })
    yield

    // the rim: a continuous ring of mossy stones round the rounded square (one merged mesh), lantern bases at the corners
    const r = rng(2204)
    const rocks: number[][] = lampAt.map(([x, z], i) => [x, z, 1.15, BASE, 1.05, 40 + i, r() * 3, 0.42])
    const ring: [number, number][] = []
    for (let j = 0; j <= 400; j++) {
      const a = (j / 400) * Math.PI * 2, c = Math.cos(a), s2 = Math.sin(a)
      ring.push([Math.sign(c) * Math.abs(c) ** (2 / SQ) * POND[0], Math.sign(s2) * Math.abs(s2) ** (2 / SQ) * POND[1]])
    }
    const per = ring.reduce((acc, p, j) => acc + (j ? Math.hypot(p[0] - ring[j - 1][0], p[1] - ring[j - 1][1]) : 0), 0)
    const n = Math.round(per / (low ? 0.5 : 0.4))
    let acc = 0, next = 0, j = 1
    for (let s1 = 0; s1 < n; s1++) {
      while (j < ring.length && acc < next) (acc += Math.hypot(ring[j][0] - ring[j - 1][0], ring[j][1] - ring[j - 1][1])), j++
      next += per / n
      const [px0, pz0] = ring[Math.min(j, ring.length - 1)]
      const out = 1.06 + r() * 0.05
      const x = px0 * out, z = pz0 * out
      if (lampAt.some(([lx2, lz]) => Math.hypot(lx2 - x, lz - z) < 0.62)) continue
      const near = x * sy + z * cy // toward the viewer: low, flat stones, so the water stays open
      const lowS = near > POND[1] * 0.55
      const w = lowS ? 0.42 + r() * 0.22 : 0.46 + r() * 0.34
      rocks.push([x, z, w, w * (lowS ? 0.28 + r() * 0.1 : 0.42 + r() * 0.34), w * (0.75 + r() * 0.2), 60 + s1, r() * 6, 0])
    }
    const parts: THREE.BufferGeometry[] = []
    for (let q = 0; q < rocks.length; q++) {
      parts.push(placedRock(rocks[q], true))
      if (q % 5 === 4) yield
    }
    const rockGeo = mergeGeometries(parts)!
    parts.forEach((g) => g.dispose())
    k.mesh(rockGeo, new THREE.ShaderMaterial({ vertexShader: WVERT, fragmentShader: STONE_FRAG, defines: { ...defines, ROCK: 1 }, uniforms: { ...k.ink('rock', { moss: 0.7 }).uniforms, ...stoneC } }), { outline: false })
    // invisible stand-ins cast the far stones' shadows on the sand (the kit keeps 24 casters: the lanterns came first)
    const proxy = new THREE.BoxGeometry(1, 1, 1)
    const hidden = new THREE.MeshBasicMaterial()
    for (const [x, z, w, hh, d] of rocks.slice(4)) {
      if (x * sy + z * cy > 0) continue
      const m = k.mesh(proxy, hidden, { cast: true, outline: false, at: [x, hh / 2, z] })
      m.scale.set(w * 0.8, hh, d * 0.8)
      m.visible = false
    }
    // the bank mirrored in the water (high): the rim stones and the four lanterns, trembling
    if (!low) {
      const ru = { ...k.uniforms, uC: { value: reflC }, uK: reflK, uPond: pondU }
      const rm = mat({ frag: REFL_FRAG, u: ru, water: true, side: THREE.DoubleSide })
      const rr = new THREE.Mesh(withAttr(rockGeo.clone(), 'aG', 0), rm)
      rr.renderOrder = 1
      rr.raycast = () => {}
      k.root.add(rr)
      const tg = lamps[0].body ? withAttr(lamps[0].body.geometry.clone(), 'aG', 0) : null
      if (tg) for (const L of lamps) {
        const m = new THREE.Mesh(tg, rm)
        m.renderOrder = 1
        m.raycast = () => {}
        L.g.add(m)
      }
    }
    yield

    // the atlas: the nine words and "four gazes, one sentence", white on clear (the shaders ink them in the theme's colour)
    const AW = low ? 512 : 1024, AH = AW / 2, F = AW / 16, cellW = AW / 3, cellH = AH / 4
    const can = document.createElement('canvas')
    can.width = AW
    can.height = AH
    const g2 = can.getContext('2d')!
    const font = `500 ${F}px ${cs().getPropertyValue('--serif').trim() || 'serif'}`
    const paintAtlas = () => {
      g2.clearRect(0, 0, AW, AH)
      g2.font = font
      g2.fillStyle = '#fff'
      g2.textAlign = 'center'
      g2.textBaseline = 'middle'
      K.words.forEach((w, i) => g2.fillText(w, cellW * (i % 3) + cellW / 2, cellH * Math.floor(i / 3) + cellH / 2, cellW * 0.9))
      g2.font = font.replace(`${F}px`, `${Math.round(F * 1.05)}px`)
      g2.fillText(K.allLit, AW / 2, cellH * 3.5, AW * 0.96)
    }
    g2.font = font
    const textW = K.words.map((w) => Math.min(cellW * 0.9, g2.measureText(w).width))
    const allW = Math.min(AW * 0.99, g2.measureText(K.allLit).width * 1.14)
    paintAtlas()
    const tex = new THREE.CanvasTexture(can)
    tex.colorSpace = THREE.NoColorSpace
    atlasTex = tex
    // a font that arrives late: ink the sheets again
    if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(() => void (paintAtlas(), (tex.needsUpdate = true), k.render()))
    planRafts(textW, F)
    yield

    // nine paper rafts (one merged mesh): the word inked on each, a soft shadow and a meniscus in the water, a reflection
    const glowU = { value: Array.from({ length: 9 }, () => new THREE.Vector4()) }
    const sx = E / F, sz = sx * SZ
    const raftParts: THREE.BufferGeometry[] = [], shadowParts: THREE.BufferGeometry[] = []
    K.words.forEach((_, i) => {
      const { x, z, w, d, a } = raft[i]
      const ccx = cellW * (i % 3) + cellW / 2, ccy = cellH * Math.floor(i / 3) + cellH / 2
      const g = withAttr(raftGeo(w, d, 0.05, i * 7 + 3, (lx2, lz) => [(ccx + lx2 / sx) / AW, 1 - (ccy + lz / sz) / AH]), 'aI', i)
      g.rotateY(yaw0 + a)
      g.translate(x, 0.02, z)
      raftParts.push(g)
      const sh = new THREE.PlaneGeometry(w * 1.38, d * 1.5)
      sh.rotateX(-Math.PI / 2)
      sh.rotateY(yaw0 + a)
      sh.translate(x + 0.03, 0.022, z + 0.04)
      shadowParts.push(sh)
    })
    const raftGeoAll = mergeGeometries(raftParts)!
    raftParts.forEach((g) => g.dispose())
    const raftU = { ...k.uniforms, uGlow: glowU, uAtlas: { value: tex }, uPaper: { value: paper }, uInkW: { value: inkW }, uDark: dark, uPond: pondU }
    k.mesh(raftGeoAll, mat({ vert: RAFT_VERT, frag: RAFT_FRAG, u: raftU, blend: false }), { outline: false })
    const shadow = new THREE.Mesh(mergeGeometries(shadowParts)!, mat({ vert: WVERT, frag: SOFT_FRAG, u: { ...k.uniforms, uC: { value: shadowC }, uRing: { value: ringC }, uK: shadowK, uRingK: ringK, uSeed: { value: 0 } } }))
    shadowParts.forEach((g) => g.dispose())
    shadow.renderOrder = 1
    shadow.raycast = () => {}
    k.root.add(shadow)
    if (!low) {
      const refl = new THREE.Mesh(raftGeoAll, mat({ vert: RAFT_VERT, frag: RAFT_FRAG, u: raftU, water: true, side: THREE.DoubleSide }))
      refl.renderOrder = 2
      refl.raycast = () => {}
      k.root.add(refl)
    }
    yield

    // each head: its arcs (one merged tapered tube, grown by aG), their reflection, a cone from its lantern, a pool on the water
    const [seg, rad] = low ? [24, 4] : [48, 6]
    const makeHead = (hd: (typeof K.heads)[number], i: number): Head => {
      const parts2: THREE.BufferGeometry[] = []
      const nl = hd.links.length, stg = nl > 1 ? 0.3 : 0, span = 1 + (nl - 1) * stg
      linkPaths(i).forEach((arc, j) => {
        const o = j * stg
        const r0 = (i === 2 ? 0.032 : 0.052) * (tall ? 1.45 : 1) // twice the old width: the bands must read (audit 22-2)
        parts2.push(shapedTube(arc, i === 2 ? Math.round(seg * 0.6) : seg, rad, (u) => r0 * (0.35 + 0.65 * Math.sin(Math.PI * u) ** 0.7), (u) => (o + u) / span))
      })
      const geo = mergeGeometries(parts2)!
      parts2.forEach((g) => g.dispose())
      const u = { ...k.uniforms, uC: { value: arcC[i] }, uK: { value: 0 }, uGrow: { value: 0 }, uDark: dark, uPond: pondU }
      const am = mat({ frag: ARC_FRAG, u })
      blendables.push(am)
      const arcs = new THREE.Mesh(geo, am)
      arcs.renderOrder = 3
      arcs.visible = false
      arcs.raycast = () => {}
      k.root.add(arcs)
      let mirror: THREE.Mesh | null = null
      if (!low) {
        const mm = mat({ frag: ARC_FRAG, u, water: true, side: THREE.DoubleSide })
        blendables.push(mm)
        mirror = new THREE.Mesh(geo, mm)
        mirror.renderOrder = 2
        mirror.visible = false
        mirror.raycast = () => {}
        k.root.add(mirror)
      }
      // the cone: from the lantern's window down to the middle of the words it joins
      const ids = [...new Set(hd.links.flat())]
      const fx = ids.reduce((a, q) => a + raft[q].x, 0) / ids.length, fz = ids.reduce((a, q) => a + raft[q].z, 0) / ids.length
      const spread = Math.min(1.9, Math.max(...ids.map((q) => Math.hypot(raft[q].x - fx, raft[q].z - fz) + raft[q].w * 0.5)) + 0.3)
      const top = new THREE.Vector3(lampAt[i][0], windowY, lampAt[i][1]), foot = new THREE.Vector3(fx, 0.03, fz)
      const dir = foot.clone().sub(top)
      const L = dir.length()
      const cone = new THREE.CylinderGeometry(0.07, spread * 0.8, L, low ? 20 : 32, 1, true)
      cone.translate(0, -L / 2, 0)
      withAttr(cone, 'aG', (q) => -cone.attributes.position.getY(q) / L)
      cone.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize()))
      cone.translate(top.x, top.y, top.z)
      const pool = withAttr(new THREE.CircleGeometry(1, 40), 'aG', 2)
      pool.rotateX(-Math.PI / 2)
      pool.scale(spread * 1.1, 1, spread * 0.85)
      pool.rotateY(yaw0)
      pool.translate(fx, 0.03, fz)
      const cu = { ...k.uniforms, uC: { value: lightC[i] }, uK: { value: 0 }, uCone: coneK, uDark: dark, uPond: pondU }
      const cm = mat({ vert: MVERT, frag: CONE_FRAG, u: cu, side: THREE.DoubleSide })
      blendables.push(cm)
      const light = new THREE.Mesh(mergeGeometries([cone, pool])!, cm)
      cone.dispose()
      pool.dispose()
      light.renderOrder = 4
      light.visible = false
      light.raycast = () => {}
      k.root.add(light)
      return { arcs, mirror, light, u, cu, want: 0, k: 0, running: false }
    }
    // one slice per head
    for (let i = 0; i < N; i++) {
      heads.push(makeHead(K.heads[i], i))
      yield
    }

    // low mist over the water, and fireflies (high only: they are living motion)
    for (const [y, sd, sc] of (low ? [[0.45, 2, 1]] : [[0.4, 1, 1], [1.1, 5, 0.7]]) as number[][]) {
      const g = new THREE.PlaneGeometry(11 * sc, 8 * sc)
      g.rotateX(-Math.PI / 2)
      const m = new THREE.Mesh(g, mat({ vert: WVERT, frag: SOFT_FRAG, u: { ...k.uniforms, uC: { value: mistC }, uRing: { value: mistC }, uK: mistK, uRingK: { value: 0 }, uSeed: { value: sd } }, def: { MIST: 1 } }))
      m.position.set(0, y, 0)
      m.renderOrder = 5
      m.raycast = () => {}
      k.root.add(m)
    }
    if (!low && !ctx.reduced) {
      const nf = 30
      const pos = new Float32Array(nf * 3), ph = new Float32Array(nf)
      for (let i = 0; i < nf; i++) {
        const a = r() * Math.PI * 2, d = 1.2 + r() * 3.6
        pos.set([Math.cos(a) * d, 0.35 + r() * 1.6, Math.sin(a) * d], i * 3)
        ph[i] = r()
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      g.setAttribute('aG', new THREE.BufferAttribute(ph, 1))
      const pts = new THREE.Points(g, new THREE.ShaderMaterial({ vertexShader: FLY_VERT, fragmentShader: FLY_FRAG, transparent: true, depthWrite: false, uniforms: { uTime: k.uniforms.uTime, uPx: flyU.uPx, uC: { value: flyC }, uK: flyK } }))
      pts.renderOrder = 6
      pts.frustumCulled = false
      k.root.add(pts)
    }

    // "four gazes, one sentence", written on the near water in perspective once every lantern is lit
    const ww = Math.min(tall ? 3.6 : 3.8, (allW / F) * E * 1.35), wd = ww * (cellH / allW) * SZ
    const wg = new THREE.PlaneGeometry(ww, wd)
    wg.rotateX(-Math.PI / 2)
    wg.rotateY(yaw0)
    const [ax, az] = W(0, tall ? 1.55 : 1.2)
    wg.translate(ax, 0.034, az)
    const writeU = { ...k.uniforms, uAtlas: { value: tex }, uRect: { value: new THREE.Vector4((AW - allW) / 2 / AW, 0, allW / AW, cellH / AH) }, uC: { value: writeC }, uK: { value: 0 }, uGrow: { value: 0 }, uPond: pondU }
    const write = new THREE.Mesh(wg, mat({ vert: WVERT, frag: WRITE_FRAG, u: writeU }))
    write.renderOrder = 2
    write.visible = false
    write.raycast = () => {}
    k.root.add(write)

    // raft glow: the words a lit head joins take its colour (the last lit wins)
    function glowAll() {
      glowU.value.forEach((g4, q) => {
        g4.set(0, 0, 0, 0)
        heads.forEach((hs, i) => {
          if (hs.k > 0.001 && K.heads[i].links.some((l) => l.includes(q))) g4.set(arcC[i].r, arcC[i].g, arcC[i].b, hs.k)
        })
      })
    }
    recolor()

    // each tag finds a clear place by its lantern: above it, else on its outer side, else below its foot, else the other
    // side — clear of the other lanterns, the rafts, the tags already placed (nearest first) and the frame's edges
    const pv = new THREE.Vector3()
    const tx = [0, 0, 0, 0], ty = [0, 0, 0, 0], tz = [0, 0, 0, 0], lx = [0, 0, 0, 0], lt = [0, 0, 0, 0], lb = [0, 0, 0, 0], lw = [0, 0, 0, 0], ord = [0, 1, 2, 3]
    const rA = raft.map(({ x, z, w }) => new THREE.Vector3(x - (cy * w) / 2, 0.06, z + (sy * w) / 2)), rB = raft.map(({ x, z, w }) => new THREE.Vector3(x + (cy * w) / 2, 0.06, z - (sy * w) / 2))
    const rx0 = raft.map(() => 0), rx1 = raft.map(() => 0), ry0 = raft.map(() => 0), ry1 = raft.map(() => 0)
    const byDepth = (a: number, b: number) => tz[a] - tz[b]
    const hit = (ax0: number, ay0: number, ax1: number, ay1: number, bx0: number, by0: number, bx1: number, by1: number) => ax0 < bx1 && bx0 < ax1 && ay0 < by1 && by0 < ay1
    const shown = (i: number) => lamps[i].w > 0 && lamps[i].tag.classList.contains('on')
    const free = (i: number, n2: number, x0: number, y0: number, Wd: number, Hd: number) => {
      const L = lamps[i], x1 = x0 + L.w, y1 = y0 + L.h
      if (x0 < 4 || x1 > Wd - 4 || y0 < 2 || y1 > Hd - 6) return false
      for (let j = 0; j < 4; j++) if (j !== i && hit(x0, y0, x1, y1, lx[j] - lw[j] * 0.85, lt[j] + 4, lx[j] + lw[j] * 0.85, lb[j])) return false
      for (let q = 0; q < rx0.length; q++) if (hit(x0, y0, x1, y1, rx0[q], ry0[q], rx1[q], ry1[q])) return false
      for (let m = 0; m < n2; m++) {
        const j = ord[m], J = lamps[j]
        if (!shown(j)) continue
        const bx0 = tx[j] - J.w / 2 + J.dx, by0 = ty[j] - J.h + J.dy
        if (hit(x0, y0, x1, y1, bx0, by0, bx0 + J.w, by0 + J.h)) return false
      }
      return true
    }
    let settleN = 0
    k.onFrame(() => {
      const st = k.stage
      if (!st) return
      const cam = st.camera, Wd = st.width, Hd = st.height
      let moved = false
      for (let i = 0; i < 4; i++) {
        const L = lamps[i]
        pv.copy(L.pin).project(cam)
        tx[i] = ((pv.x + 1) / 2) * Wd
        ty[i] = ((1 - pv.y) / 2) * Hd
        tz[i] = pv.z
        pv.set(L.foot.x, L.top, L.foot.z).project(cam)
        lx[i] = ((pv.x + 1) / 2) * Wd
        lt[i] = ((1 - pv.y) / 2) * Hd
        pv.copy(L.foot).project(cam)
        lb[i] = ((1 - pv.y) / 2) * Hd
        lw[i] = Math.abs(lb[i] - lt[i]) * 0.34 // the roof is about two thirds as wide as the lantern is tall
      }
      for (let q = 0; q < rx0.length; q++) {
        pv.copy(rA[q]).project(cam)
        const ax = ((pv.x + 1) / 2) * Wd, ay = ((1 - pv.y) / 2) * Hd
        pv.copy(rB[q]).project(cam)
        const bx = ((pv.x + 1) / 2) * Wd, by = ((1 - pv.y) / 2) * Hd
        const hh = Math.abs(bx - ax) * 0.2 + 6
        rx0[q] = Math.min(ax, bx)
        rx1[q] = Math.max(ax, bx)
        ry0[q] = (ay + by) / 2 - hh - 6
        ry1[q] = (ay + by) / 2 + hh
      }
      ord.sort(byDepth)
      for (let n2 = 0; n2 < 4; n2++) {
        const i = ord[n2], L = lamps[i]
        if (!shown(i)) continue
        const ax = tx[i] - L.w / 2, ay = ty[i] - L.h // where the kit puts it: above the lantern
        const mid = (lt[i] + lb[i]) / 2 - L.h * 0.8, outer = lx[i] < Wd / 2 ? -1 : 1
        // candidates: above (raised step by step), its outer side, below its foot, its other side
        let px = Math.min(Wd - 4 - L.w, Math.max(4, ax)), py = Math.max(2, ay)
        for (let c = 0; c < 10; c++) {
          const side = c === 7 ? outer : -outer
          const cx = c < 7 ? ax : c === 8 ? lx[i] - L.w / 2 : side < 0 ? lx[i] - lw[i] - 8 - L.w : lx[i] + lw[i] + 8
          const cyy = c < 7 ? ay - c * 14 : c === 8 ? lb[i] + 6 : mid
          if (free(i, n2, cx, cyy, Wd, Hd)) {
            px = cx
            py = cyy
            break
          }
        }
        const dx = px - ax, dy = py - ay
        if (Math.abs(dx - L.dx) + Math.abs(dy - L.dy) > 0.5) {
          L.dx = dx
          L.dy = dy
          L.inner.style.transform = `translate(${Math.round(dx)}px,${Math.round(dy)}px)`
          moved = true
        }
      }
      // this frame read the camera before the kit placed it: when a tag moved, look once more with the camera settled
      // (a cut under reduced motion draws a single frame)
      if (moved && settleN++ < 3) k.render()
      else if (!moved) settleN = 0
    })

    const apply = (i: number) => {
      const hs = heads[i]
      lamps[i].g.lamp?.set(0.1 + 0.9 * hs.k)
      hs.u.uK.value = hs.cu.uK.value = hs.k
      hs.arcs.visible = hs.light.visible = hs.k > 0.001
      if (hs.mirror) hs.mirror.visible = hs.arcs.visible
      glowAll()
    }
    view = {
      set(i, lit) {
        const hs = heads[i]
        hs.want = lit ? 1 : 0
        lamps[i].btn.setAttribute('aria-pressed', String(lit))
        lamps[i].tag.classList.toggle('on', lit)
        // the first lantern lit says once what a lantern stands for
        if (lit && !decoded) (decoded = true), lamps[i].tag.classList.add('first')
        if (lit && !lamps[i].w) (lamps[i].w = lamps[i].tag.offsetWidth), (lamps[i].h = lamps[i].tag.offsetHeight)
        const grow = 1.3 + (i === 2 ? 0.9 : 0)
        if (hs.running) return
        hs.running = true
        k.animate((dt) => {
          hs.k = hs.want ? Math.min(1, hs.k + dt / 0.55) : Math.max(0, hs.k - dt / 0.4)
          if (hs.want) hs.u.uGrow.value = Math.min(1.04, hs.u.uGrow.value + dt / grow)
          else if (!hs.k) hs.u.uGrow.value = 0
          apply(i)
          const moving = hs.want ? hs.k < 1 || hs.u.uGrow.value < 1.04 : hs.k > 0
          if (!moving) hs.running = false
          return moving
        })
      },
      all() {
        write.visible = true
        let t = 0
        k.animate((dt) => {
          t += dt
          writeU.uK.value = Math.min(1, t / 0.8)
          writeU.uGrow.value = Math.min(1.1, Math.max(0, (t - 0.4) / 2.2) * 1.1)
          return writeU.uGrow.value < 1.1
        })
        // back to the default view (from there the visitor lowers the eye, or it sinks by itself when left alone)
        if (took) return
        k.dolly(tall ? 1 : 1.1)
        k.fly(T, yaw0 + (tall ? 0.05 : 0.1), pitch0, 1.4)
      },
    }
    on.forEach((lit, i) => lit && view!.set(i, true))
    if (done) view.all()
  }

  /** No WebGL: the same garden from the default view, projected once into a painting (lanterns are buttons). */
  function fallback(host: HTMLElement) {
    const svg = s('svg', { class: 'g8h-fb', 'aria-hidden': 'true' })
    const btns = K.heads.map((hd, i) => h('button', { class: `g8h-fbb h${i}`, type: 'button', 'aria-label': hd.aria, 'aria-pressed': 'false', onClick: () => toggle(i) }))
    const words = K.words.map((w) => h('span', { class: 'g8h-fbw' }, w))
    const allP = h('p', { class: 'g8h-all g8h-fball' }, h('span', null, K.allLit))
    host.append(svg, ...words, allP, ...btns)
    painted = true
    btns.forEach((b, i) => {
      dots[i] = done ? null : g8dot(b)
      dots[i]?.el.classList.toggle('g8h-off', on[i])
    })
    if (!raft.length) planRafts(K.words.map((w) => w.length * 30), 64)
    const cam = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
    const v = new THREE.Vector3()
    let Wd = 0, Hd = 0
    const P = (x: number, y: number, z: number): [number, number] => (v.set(x, y, z).project(cam), [((v.x + 1) / 2) * Wd, ((1 - v.y) / 2) * Hd])
    const f1 = (n: number) => n.toFixed(1)
    const path = (pts: [number, number][]) => `M${pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}`
    const draw = () => {
      Wd = host.clientWidth
      Hd = host.clientHeight
      if (Wd < 40 || Hd < 40) return
      svg.setAttribute('viewBox', `0 0 ${Wd} ${Hd}`)
      cam.aspect = Wd / Hd
      const tv = Math.tan((19 * Math.PI) / 180), fit = tall ? [6.8, 3.6] : [4.6, 2.75]
      const d = Math.max((fit[0] * (cam.aspect < 1 ? 0.56 : 1)) / (tv * cam.aspect), fit[1] / tv)
      const p = pitch0 + (tall ? 0.13 : 0)
      cam.position.set(T[0] + d * Math.cos(p) * Math.sin(yaw0), T[1] + d * Math.sin(p), T[2] + d * Math.cos(p) * Math.cos(yaw0))
      cam.lookAt(...T)
      cam.updateProjectionMatrix()
      cam.updateMatrixWorld()
      const pond = Array.from({ length: 73 }, (_, q) => {
        const a = (q / 72) * Math.PI * 2, c = Math.cos(a), s2 = Math.sin(a)
        return P(Math.sign(c) * Math.abs(c) ** (2 / SQ) * POND[0], 0, Math.sign(s2) * Math.abs(s2) ** (2 / SQ) * POND[1])
      })
      const kids: SVGElement[] = [s('path', { class: 'g8h-fb-water', d: `${path(pond)}Z` })]
      raft.forEach(({ x, z, w, d: dd }, i) => {
        const ux = Math.cos(yaw0) * w * 0.5, uz = -Math.sin(yaw0) * w * 0.5, vx = Math.sin(yaw0) * dd * 0.5, vz = Math.cos(yaw0) * dd * 0.5
        kids.push(s('path', { class: 'g8h-fb-raft', d: `${path([P(x - ux - vx, 0.05, z - uz - vz), P(x + ux - vx, 0.05, z + uz - vz), P(x + ux + vx, 0.05, z + uz + vz), P(x - ux + vx, 0.05, z - uz + vz)])}Z` }))
        const [wx, wy] = P(x, 0.05, z)
        Object.assign(words[i].style, { left: `${f1(wx)}px`, top: `${f1(wy)}px` })
      })
      const unit = Math.abs(P(0, 1, 0)[1] - P(0, 0, 0)[1])
      K.heads.forEach((_, i) => {
        if (!on[i]) return
        for (const arc of linkPaths(i)) kids.push(s('path', { class: `g8h-fb-arc h${i}`, d: path(arc.getPoints(24).map((q) => P(q.x, q.y, q.z))) }))
      })
      lampAt.forEach(([x, z], i) => {
        const [lx2, ly2] = P(x, BASE * 0.9, z)
        const g = paintToro(lx2, ly2, unit * LH, on[i])
        g.classList.add('g8h-fb-toro', `h${i}`)
        kids.push(s('g', { transform: `translate(${f1(lx2)} ${f1(ly2 + unit * 0.05)})` }, stoneArt(unit * 1.05, unit * BASE, 40 + i)), g)
        Object.assign(btns[i].style, { left: `${f1(lx2 - unit * 0.35)}px`, top: `${f1(ly2 - unit * 1.25)}px`, width: `${f1(unit * 0.7)}px`, height: `${f1(unit * 1.3)}px` })
        btns[i].setAttribute('aria-pressed', String(on[i]))
      })
      svg.replaceChildren(...kids)
      const [ax, ay] = P(...((): V3 => { const [x, z] = W(0, tall ? 1.55 : 1.2); return [x, 0, z] })())
      Object.assign(allP.style, { left: `${f1(ax)}px`, top: `${f1(ay)}px` })
      allP.classList.toggle('on', done)
    }
    const off = onSize(host, draw)
    view = { set: draw, all: draw }
    return () => {
      off()
      view = null
      svg.remove()
      allP.remove()
      words.forEach((x) => x.remove())
      btns.forEach((x) => x.remove())
    }
  }
}
