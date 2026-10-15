import * as THREE from 'three'
import { createStage } from '../../core/three-stage'
import { cssVar, onPrefs, prefs } from '../../core/prefs'
import { h, nextId, s } from '../../core/dom'
import type { SceneCtx } from '../types'
import { pebbleArt, rng, stroke } from './brush'
import { paintStone, STONE_A, STONE_BASE, STONE_H, STONE_W, themeInk, type StoneShape } from './stone'

export interface BrainCopy {
  prompt: string
  again: string
  aria: string
  help: string
  done: string
  insight: string
  detail: string
  noWebgl: string
  scrub: { label: string; sand: string; brain: string }
}

type V3 = [number, number, number]

function unit(rand: () => number): V3 {
  const u = rand() * 2 - 1
  const a = rand() * Math.PI * 2
  const q = Math.sqrt(1 - u * u)
  return [q * Math.cos(a), u, q * Math.sin(a)]
}

// ── Brain shape ─────────────────────────────────────────────────────────────
// Directions on a unit sphere are deformed into a hemisphere: x = left/right, y = up, z = front(+)/back(−).
// Sulci are curves on that sphere: grains near them are rejected (the groove) and filaments trace them.

/** Meridional folds (gyri run between them), lateral sulcus, and the temporal-lobe fold. */
const FOLDS = [-0.82, -0.58, -0.35, -0.12, 0.1, 0.32, 0.55, 0.78]
const foldZ = (k: number, dy: number, side: number) => FOLDS[k] + 0.075 * Math.sin(9 * dy + 1.7 * k + side) + 0.03 * Math.sin(23 * dy + 2.3 * k) // meandering gyri
const lateralY = (dz: number) => -0.14 + 0.3 * dz
const temporalY = (dz: number) => -0.5 + 0.18 * dz + 0.04 * Math.sin(9 * dz)

function inSulcus([dx, dy, dz]: V3, side: number): boolean {
  const out = dx * side
  if (out < 0.2) return false // inner wall stays smooth
  if (dz > -0.4 && dz < 0.8 && Math.abs(dy - lateralY(dz)) < 0.05) return true
  if (dy < lateralY(dz)) return dz > -0.55 && dz < 0.75 && Math.abs(dy - temporalY(dz)) < 0.035
  return FOLDS.some((_, k) => Math.abs(dz - foldZ(k, dy, side)) < 0.034)
}

function cortex([dx, dy, dz]: V3, side: number, r = 1): V3 {
  const out = Math.max(0, dx * side)
  if (dx * side < 0) dx *= 0.49 // flat inner wall → a narrow longitudinal fissure
  if (dy < 0) dy *= dz < 0 ? 0.62 : 0.74 // flatter underside, raised above the cerebellum at the back
  const tb = out * Math.exp(-(((dy + 0.5) / 0.3) ** 2) - (((dz - 0.12) / 0.42) ** 2)) // temporal lobe bulge
  const pole = 1 - 0.16 * Math.abs(dz) ** 3 - (dz < 0 ? 0.08 * dz * dz : 0) // tapered frontal & occipital poles
  return [
    side * 0.4 + (dx * 0.76 * pole + side * 0.12 * tb) * r,
    0.2 + (dy * 0.78 * pole - 0.16 * tb) * r,
    (dz * 1.16 + 0.08 * tb) * r,
  ]
}

function cerebellum([dx, dy, dz]: V3): V3 {
  const notch = 1 - 0.18 * Math.exp(-((dx / 0.18) ** 2)) // two small lobes
  return [dx * 0.62, -0.5 + dy * 0.27 * notch + 0.014 * Math.sin(dy * 38), -0.6 + dz * 0.4 * notch]
}

function stem(rand: () => number): V3 {
  const t = rand()
  const a = rand() * Math.PI * 2
  const r = 0.11 - 0.025 * t
  return [Math.cos(a) * r, -0.32 - t * 0.6, -0.22 - t * 0.1 + Math.sin(a) * r]
}

// ── Garden ──────────────────────────────────────────────────────────────────
const SAND_Y = -1.45
type StoneSpot = [number, number, number, number]
/** [x, z, ripple radius, stone radius] — wide screens spread the stones; tall ones keep them inside the narrow view. */
const STONES_WIDE: StoneSpot[] = [
  [2.15, 0.35, 1.45, 0.46],
  [-2.55, -0.35, 1.05, 0.32],
  [3.3, -2.0, 0.62, 0.17],
]
const STONES_TALL: StoneSpot[] = [
  [0.62, 1.05, 0.95, 0.34],
  [-0.78, -0.8, 0.8, 0.25],
  [0.95, -2.5, 0.5, 0.15],
]
/** One painted shape per stone: a tall mossy one, a low one with a small cushion, a bare pebble. */
const SHAPES: StoneShape[] = [
  { seed: 11, profile: [0, 0.6, 0.86, 0.9, 0.84, 0.55, 0], moss: [-0.12, 1] },
  { seed: 23, profile: [0, 0.42, 0.58, 0.62, 0.6, 0.36, 0], moss: [0.1, 0.6] },
  { seed: 37, profile: [0, 0.34, 0.46, 0.44, 0.3, 0] },
]
/** Raked sand: straight rows parallel to the screen, concentric ripples around the stones. */
function sand(rand: () => number, STONES: StoneSpot[]): V3 {
  const x = (rand() * 2 - 1) * 4.6
  const z = -3.4 + rand() * 6.2
  for (const [cx, cz, R, sr] of STONES) {
    if (Math.hypot(x - cx, z - cz) < R) {
      const rings = Math.max(1, Math.round((R - sr) / 0.17))
      const r = sr + 0.14 + Math.floor(rand() * rings) * 0.17
      const a = rand() * Math.PI * 2
      return [cx + Math.cos(a) * r, SAND_Y, cz + Math.sin(a) * r * 0.92]
    }
  }
  const row = Math.round((z + 3.4) / 0.17)
  return [x, SAND_Y, -3.4 + row * 0.17 + Math.sin(x * 1.3 + row * 0.5) * 0.04]
}

// ── Shaders ─────────────────────────────────────────────────────────────────
// Every grain travels start → target (target is in brain space, turned by uRot) with its own delay,
// rising in an arc and swirling slightly, then breathes gently once settled. The path depends only on
// uProgress, so lowering it flies every grain back along the same arc into its raked row.
const MORPH = /* glsl */ `
uniform float uProgress;
uniform float uTime;
uniform float uDist;
uniform float uFar;
uniform mat4 uRot;
attribute vec3 aStart;
attribute float aDelay;
float easeIO(float x) { return x < 0.5 ? 4.0 * x * x * x : 1.0 - pow(-2.0 * x + 2.0, 3.0) * 0.5; }
vec3 morph(out float k) {
  k = easeIO(clamp((uProgress - aDelay * 0.4) / 0.6, 0.0, 1.0));
  vec3 tgt = (uRot * vec4(position, 1.0)).xyz;
  float travel = min(1.0, distance(aStart, tgt));
  vec3 p = mix(aStart, tgt, k);
  float arc = sin(k * 3.14159265) * travel;
  p.y += arc * 0.7;
  float a = arc * (aDelay - 0.5) * 1.8;
  float c = cos(a), s = sin(a);
  p.xz = vec2(c * p.x - s * p.z, s * p.x + c * p.z);
  p += travel * k * 0.012 * vec3(sin(uTime * 0.9 + aDelay * 40.0), cos(uTime * 0.7 + aDelay * 31.0), sin(uTime * 0.8 + aDelay * 23.0));
  return p;
}
float depthFade(float z) { return mix(uFar, 1.0, smoothstep(uDist + 2.2, uDist - 1.0, z)); }`

const DOT_VERT = /* glsl */ `
${MORPH}
uniform float uSize;
uniform float uScale;
uniform float uJit;
uniform float uMotes;
attribute float aSize;
attribute float aTone;
varying float vA;
varying float vTone;
void main() {
  float k;
  vec3 p = morph(k);
  // a few grains drift up from the sand like motes in the low sun (fireflies by night): the hint of what will rise
  float mote = uMotes * step(0.93, fract(aDelay * 53.7)) * step(abs(aStart.x), 2.2) * (1.0 - k);
  float ph = fract(uTime * 0.04 + aDelay * 13.0);
  p.y += mote * ph * 1.7;
  p.x += mote * sin(ph * 5.0 + aDelay * 20.0) * 0.1;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float tw = 0.82 + 0.18 * sin(uTime * 1.3 + aDelay * 57.0);
  gl_PointSize = uSize * aSize * tw * (1.0 + 0.5 * mote) * uScale / -mv.z;
  float edge = smoothstep(5.0, 2.8, length(aStart.xz * vec2(1.0, 1.35)));
  float jit = 1.0 - uJit * fract(aDelay * 91.7);
  vA = (0.5 + 0.5 * k) * depthFade(-mv.z) * mix(edge, 1.0, k) * jit * mix(1.0, sin(ph * 3.14159) * 1.7, mote);
  vTone = aTone;
}`

const DOT_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uColor2;
uniform float uOpacity;
uniform float uSoft;
varying float vA;
varying float vTone;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = mix(1.0 - smoothstep(0.55, 1.0, d), pow(max(0.0, 1.0 - d), 1.6), uSoft);
  if (a < 0.02) discard;
  gl_FragColor = vec4(mix(uColor, uColor2, vTone), a * vA * uOpacity);
  #include <colorspace_fragment>
}`

const THREAD_VERT = /* glsl */ `
${MORPH}
varying float vK;
varying float vF;
void main() {
  float k;
  vec3 p = morph(k);
  vK = k;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vF = depthFade(-mv.z);
  gl_Position = projectionMatrix * mv;
}`

const THREAD_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vK;
varying float vF;
void main() {
  gl_FragColor = vec4(uColor, smoothstep(0.8, 1.0, vK) * uOpacity * vF);
  #include <colorspace_fragment>
}`

// Filaments: brush-like trails of soft sprites along the folds — each fold its own weight, pressing and lifting
// along the stroke, thinner and paler on the far side. A few carry a vermilion pulse ("AI attention").
const FIL_VERT = /* glsl */ `
uniform float uTime;
uniform float uDist;
uniform float uFar;
uniform float uProgress;
uniform float uSize;
uniform float uScale;
attribute float aT;
attribute float aW;
attribute float aPhase;
attribute float aSpeed;
attribute float aPulse;
varying float vVis;
varying float vGlow;
varying float vF;
void main() {
  float reveal = clamp((uProgress - 0.55) / 0.45, 0.0, 1.0) * 1.08;
  vVis = 1.0 - smoothstep(reveal - 0.06, reveal, aT);
  float head = fract(uTime * aSpeed + aPhase);
  float d = head - aT;
  float g = aPulse * (d >= 0.0 ? pow(max(0.0, 1.0 - d / 0.18), 2.0) : 1.0 - smoothstep(0.0, 0.02, -d));
  vGlow = g * smoothstep(0.85, 1.0, uProgress);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float near = smoothstep(uDist + 2.2, uDist - 1.0, -mv.z);
  vF = mix(uFar, 1.0, near);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * (aW * mix(0.5, 1.0, near) + vGlow * 0.9) * uScale / -mv.z;
}`

const FIL_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uAccent;
uniform float uOpacity;
varying float vVis;
varying float vGlow;
varying float vF;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = pow(max(0.0, 1.0 - d), 1.4);
  if (a < 0.01) discard;
  gl_FragColor = vec4(mix(uColor, uAccent, vGlow), a * vVis * min(1.0, uOpacity * vF + vGlow * 0.9));
  #include <colorspace_fragment>
}`

const HEAD_VERT = /* glsl */ `
uniform float uSize;
uniform float uScale;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uScale / -mv.z;
}`

const HEAD_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = pow(max(0.0, 1.0 - d), 2.2) + 1.0 - smoothstep(0.0, 0.3, d);
  if (a < 0.02) discard;
  gl_FragColor = vec4(uColor, min(1.0, a) * uOpacity);
  #include <colorspace_fragment>
}`

// Soft ink-wash shadow of the brain on the sand.
const SHADOW_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const SHADOW_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  float r = length(vUv * 2.0 - 1.0);
  gl_FragColor = vec4(uColor, uOpacity * pow(1.0 - smoothstep(0.0, 1.0, r), 1.6));
  #include <colorspace_fragment>
}`

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

const HOLD_SECONDS = 3.2
const YAW = -1.05 // a 3/4 view from the front-top: one side's folds, the fissure, the cerebellum
const PITCH = 0.34
// Opening view: the camera looks down at ~31° onto the garden's centre, so the raked bed fills the frame
// from just below the low sun to the bottom edge on every aspect ratio (vertical framing ignores the width).
const VIEW0 = { pitch: 0.54, dist: 6.5 }

/** Scene 1: raked-sand grains; hold to make them rise into a brain woven of light threads, and scrub back to sand. */
export function mountBrain(ctx: SceneCtx, c: BrainCopy) {
  const helpId = nextId('t1-help')
  const host = h('div', { class: 't1-brain', tabindex: '0', role: 'button', 'aria-label': c.aria, 'aria-describedby': helpId })
  const halo = h('div', { class: 't1-halo', 'aria-hidden': 'true' })
  // dawn sun (a pale moon at night) rising behind the garden, where the brain will form; it fades as the grains gather
  const sunId = nextId('t1-sun')
  const sun = s('svg', { class: 't1-sun', viewBox: '0 0 100 100', 'aria-hidden': 'true' },
    s('defs', null, s('radialGradient', { id: sunId },
      s('stop', { offset: '0', 'stop-color': 'currentColor', 'stop-opacity': 0.8 }),
      s('stop', { offset: '0.86', 'stop-color': 'currentColor', 'stop-opacity': 1 }),
      s('stop', { offset: '0.95', 'stop-color': 'currentColor', 'stop-opacity': 0.6 }),
      s('stop', { offset: '1', 'stop-color': 'currentColor', 'stop-opacity': 0 }))),
    s('circle', { cx: 50, cy: 50, r: 50, fill: `url(#${sunId})` }))
  const mist = h('div', { class: 't1-mist', 'aria-hidden': 'true' })
  const ring = s('svg', { class: 't1-hold', viewBox: '0 0 80 80', 'aria-hidden': 'true' },
    s('circle', { class: 't1-hold-wash', cx: 40, cy: 40, r: 30 }),
    s('circle', { class: 't1-hold-track', cx: 40, cy: 40, r: 30 }),
    s('circle', { class: 't1-hold-ring', cx: 40, cy: 40, r: 30, pathLength: 1, transform: 'rotate(-90 40 40)' }))
  const help = h('p', { class: 'visually-hidden', id: helpId }, c.help)
  const live = h('p', { class: 'visually-hidden', 'aria-live': 'polite' })
  host.append(sun, halo, mist, ring, help, live)

  // The sand ⟷ brain track: grains on the left thicken into one thread on the right; the pebble marks where you are.
  const scrubIn = h('input', { class: 't1-scrub-input', type: 'range', min: '0', max: '1', step: 'any', value: '0', 'aria-label': c.scrub.label })
  const knob = h('span', { class: 't1-scrub-knob', 'aria-hidden': 'true' }, pebbleArt(null))
  const line = s('svg', { class: 't1-scrub-line', viewBox: '0 0 300 12', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    s('path', { d: stroke([[70, 6.3], [190, 5.7], [299, 6]], 3.2, { head: 0.9, tail: 0.3, min: 0.08 }) }))
  const track = h('div', { class: 't1-scrub-track' }, h('div', { class: 't1-scrub-rail' }, line, scrubIn, knob))
  const scrub = h('div', { class: 't1-scrub' },
    h('span', { class: 't1-scrub-end', 'aria-hidden': 'true' }, c.scrub.sand), track,
    h('span', { class: 't1-scrub-end', 'aria-hidden': 'true' }, c.scrub.brain))
  scrub.hidden = true
  ctx.art.append(host, scrub)
  ctx.prompt(c.prompt)

  const stage = createStage(host, { fov: 40 })
  if (!stage) {
    host.removeAttribute('role')
    host.removeAttribute('tabindex')
    brainFallback(host, c.noWebgl)
    ctx.insight(c.insight, c.detail)
    return () => (host.remove(), scrub.remove())
  }
  const { scene, camera, canvas, renderer } = stage
  canvas.setAttribute('aria-hidden', 'true')
  const low = ctx.quality === 'low'
  const rand = rng(1956)
  const STONES = stage.height > stage.width * 1.05 ? STONES_TALL : STONES_WIDE

  // ── Grains: each starts as sand and flies up into the cortex, cerebellum or stem.
  const N = low ? 1500 : 4200
  const target = new Float32Array(N * 3)
  const start = new Float32Array(N * 3)
  const delay = new Float32Array(N)
  const size = new Float32Array(N)
  const tone = new Float32Array(N)
  const surface: number[] = []
  for (let i = 0; i < N; i++) {
    const st = sand(rand, STONES)
    const r = rand()
    const side = rand() < 0.5 ? -1 : 1
    let tg: V3
    if (r < 0.08) tg = cerebellum(unit(rand))
    else if (r < 0.1) tg = stem(rand)
    else if (r < 0.18) tg = cortex(unit(rand), side, 0.4 + rand() * 0.45)
    else {
      let d = unit(rand)
      for (let k = 0; k < 8 && inSulcus(d, side); k++) d = unit(rand)
      tg = cortex(d, side, 0.985 + rand() * 0.03)
      surface.push(i)
    }
    start.set(st, i * 3)
    target.set(tg, i * 3)
    delay[i] = 0.72 * rand() + 0.28 * ((st[0] + 4.6) / 9.2) // a sweep from left to right
    size[i] = 0.55 + Math.pow(rand(), 3) * 0.6 // fine, even grains; only a few slightly heavier
    tone[i] = rand() < 0.16 ? 1 : 0
  }

  const brainG = new THREE.Group() // the brain's own turn + breath; grains read it through uRot
  const U = {
    uProgress: { value: 0 },
    uTime: { value: 0 },
    uScale: { value: 1 },
    uDist: { value: 5 },
    uFar: { value: 0.28 },
    uRot: { value: brainG.matrix },
  }
  const mat = (vertexShader: string, fragmentShader: string, extra: Record<string, THREE.IUniform>) =>
    new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms: { ...U, ...extra }, transparent: true, depthWrite: false, depthTest: false })
  const dotUniforms = () => ({
    uColor: { value: new THREE.Color() },
    uColor2: { value: new THREE.Color() },
    uOpacity: { value: 1 },
    uSoft: { value: 0 },
    uSize: { value: 5 },
    uJit: { value: 0 },
    uMotes: { value: 0 },
  })

  const dotGeo = new THREE.BufferGeometry()
  dotGeo.setAttribute('position', new THREE.BufferAttribute(target, 3))
  dotGeo.setAttribute('aStart', new THREE.BufferAttribute(start, 3))
  dotGeo.setAttribute('aDelay', new THREE.BufferAttribute(delay, 1))
  dotGeo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
  dotGeo.setAttribute('aTone', new THREE.BufferAttribute(tone, 1))
  const dotMat = mat(DOT_VERT, DOT_FRAG, { ...dotUniforms(), uMotes: { value: 1 } })
  const dots = new THREE.Points(dotGeo, dotMat)

  // ── Ink-wash mass: a few hundred large soft sprites just under the cortex, so the shape reads as a volume.
  const WN = low ? 160 : 320
  const washPos = new Float32Array(WN * 3)
  for (let i = 0; i < WN; i++) washPos.set(i % 12 === 0 ? cerebellum(unit(rand)) : cortex(unit(rand), i % 2 ? 1 : -1, 0.72 + rand() * 0.2), i * 3)
  const washGeo = new THREE.BufferGeometry()
  washGeo.setAttribute('position', new THREE.BufferAttribute(washPos, 3))
  washGeo.setAttribute('aStart', new THREE.BufferAttribute(washPos, 3))
  washGeo.setAttribute('aDelay', new THREE.BufferAttribute(Float32Array.from({ length: WN }, () => rand() * 0.02), 1))
  washGeo.setAttribute('aSize', new THREE.BufferAttribute(Float32Array.from({ length: WN }, () => 0.7 + rand() * 0.6), 1))
  washGeo.setAttribute('aTone', new THREE.BufferAttribute(new Float32Array(WN), 1))
  const washMat = mat(DOT_VERT, DOT_FRAG, dotUniforms())
  const washMass = new THREE.Points(washGeo, washMat)
  let washA = 0
  let shadowA = 0.2 // brain shadow strength for the theme (read in applyTheme, not per frame)

  // ── The raked bed: dense dotted grooves and rings that stay on the ground (never turns).
  const bed: number[] = []
  const rowStep = low ? 0.2 : 0.15, dotStep = low ? 0.06 : 0.03
  const inStone = (x: number, z: number) => STONES.some(([sx, sz, , sr]) => Math.hypot(x - sx, (z - sz) / 0.92) < sr + 0.16)
  const inRings = (x: number, z: number) => STONES.some(([sx, sz, R]) => Math.hypot(x - sx, z - sz) < R)
  for (let z = -3.4; z <= 2.8; z += rowStep) {
    for (let x = -5; x <= 5; x += dotStep * (0.7 + rand() * 0.6)) {
      const zz = z + Math.sin(x * 1.3 + z * 2.6) * 0.04 + (rand() - 0.5) * 0.01
      if (!inRings(x, zz)) bed.push(x, SAND_Y, zz)
    }
  }
  for (const [sx, sz, R, sr] of STONES) {
    for (let r = sr + 0.16; r < R; r += rowStep * 0.9) {
      for (let a = 0; a < Math.PI * 2; a += dotStep / r) {
        const x = sx + Math.cos(a) * r, z = sz + Math.sin(a) * r * 0.92
        if (!inStone(x, z)) bed.push(x, SAND_Y, z)
      }
    }
  }
  const BN = bed.length / 3
  const bedPos = new Float32Array(bed)
  const bedRand = Float32Array.from({ length: BN }, () => rand())
  const bedGeo = new THREE.BufferGeometry()
  bedGeo.setAttribute('position', new THREE.BufferAttribute(bedPos, 3))
  bedGeo.setAttribute('aStart', new THREE.BufferAttribute(bedPos, 3))
  bedGeo.setAttribute('aDelay', new THREE.BufferAttribute(bedRand, 1))
  bedGeo.setAttribute('aSize', new THREE.BufferAttribute(bedRand.map((r) => 0.35 + r * 0.35), 1))
  bedGeo.setAttribute('aTone', new THREE.BufferAttribute(bedRand.map((r) => (r > 0.93 ? 1 : 0)), 1))
  const bedMat = mat(DOT_VERT, DOT_FRAG, { ...dotUniforms(), uProgress: { value: 0 }, uRot: { value: new THREE.Matrix4() } })
  const sandBed = new THREE.Points(bedGeo, bedMat)

  // ── Stones: painted in ink on canvases (see stone.ts) and stood on the sand as billboards facing the camera.
  const ground = new THREE.Group()
  const stones = STONES.map(([sx, sz, , sr], i) => {
    const cv = document.createElement('canvas')
    const tex = new THREE.CanvasTexture(cv)
    tex.colorSpace = THREE.SRGBColorSpace
    const k = (sr * 1.15) / STONE_A // world units per canvas px
    const geo = new THREE.PlaneGeometry(STONE_W * k, STONE_H * k)
    geo.translate(-(STONE_BASE[0] - STONE_W / 2) * k, -(STONE_H / 2 - STONE_BASE[1]) * k, 0) // anchor on the sand
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }))
    m.position.set(sx, SAND_Y, sz)
    m.renderOrder = sz > 0.2 ? 7 : 4.5 // in front of the brain's grains, or only of the sand
    ground.add(m)
    return { cv, tex, m, shape: SHAPES[i] }
  })
  const brainShadowMat = new THREE.ShaderMaterial({
    vertexShader: SHADOW_VERT, fragmentShader: SHADOW_FRAG, transparent: true, depthWrite: false, depthTest: false,
    uniforms: { uColor: { value: new THREE.Color() }, uOpacity: { value: 0 } },
  })
  const brainShadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), brainShadowMat)
  brainShadow.rotation.x = -Math.PI / 2
  brainShadow.scale.set(3.6, 2.6, 1)
  brainShadow.position.set(0.15, SAND_Y + 0.002, 0.1)
  brainShadow.renderOrder = 1
  ground.add(brainShadow)

  // ── Nearest-neighbour threads between surface grains (each end rides its grain).
  const M = Math.min(surface.length, low ? 320 : 900)
  const seen = new Set<number>()
  const pairs: number[] = []
  for (let a = 0; a < M; a++) {
    const ia = surface[a]
    const best: [number, number][] = []
    for (let b = 0; b < M; b++) {
      if (a === b) continue
      const ib = surface[b]
      const dx = target[ia * 3] - target[ib * 3]
      const dy = target[ia * 3 + 1] - target[ib * 3 + 1]
      const dz = target[ia * 3 + 2] - target[ib * 3 + 2]
      const d2 = dx * dx + dy * dy + dz * dz
      if (d2 < 0.09) best.push([d2, ib])
    }
    best.sort((p, q) => p[0] - q[0])
    for (const [, ib] of best.slice(0, 2)) {
      const key = Math.min(ia, ib) * N + Math.max(ia, ib)
      if (!seen.has(key)) (seen.add(key), pairs.push(ia, ib))
    }
  }
  const pick = (src: Float32Array, n: number) => {
    const out = new Float32Array(pairs.length * n)
    pairs.forEach((p, j) => out.set(src.subarray(p * n, p * n + n), j * n))
    return out
  }
  const threadGeo = new THREE.BufferGeometry()
  threadGeo.setAttribute('position', new THREE.BufferAttribute(pick(target, 3), 3))
  threadGeo.setAttribute('aStart', new THREE.BufferAttribute(pick(start, 3), 3))
  threadGeo.setAttribute('aDelay', new THREE.BufferAttribute(pick(delay, 1), 1))
  const threadMat = mat(THREAD_VERT, THREAD_FRAG, { uColor: { value: new THREE.Color() }, uOpacity: { value: 0.2 } })
  const threads = new THREE.LineSegments(threadGeo, threadMat)

  // ── Filaments along the sulci, the lateral sulcus, the temporal fold and the fissure's inner edge.
  const curves: { pts: V3[]; w: number }[] = []
  const trace = (n: number, f: (t: number) => V3 | null, side: number, w: number) => {
    const pts: V3[] = []
    for (let j = 0; j <= n; j++) {
      const d = f(j / n)
      if (d) pts.push(cortex(d, side))
      else if (pts.length > 4) break
    }
    if (pts.length > 4) curves.push({ pts, w })
  }
  const onSphere = (dy: number, dz: number, side: number): V3 | null => {
    const q = 1 - dy * dy - dz * dz
    return q > 0.04 ? [side * Math.sqrt(q), dy, dz] : null
  }
  for (const side of [-1, 1]) {
    FOLDS.forEach((_, k) => {
      if (low && k % 2) return
      const dy0 = k >= 2 && k <= 6 ? lateralY(FOLDS[k]) + 0.06 : -0.45
      trace(60, (t) => {
        const dy = dy0 + (0.99 - dy0) * t
        return onSphere(dy, foldZ(k, dy, side), side)
      }, side, 0.45 + 0.55 * rand()) // some folds are bold, others a hair
    })
    trace(70, (t) => {
      const dz = -0.4 + 1.2 * t
      return onSphere(lateralY(dz), dz, side)
    }, side, 1.35)
    trace(60, (t) => {
      const dz = -0.55 + 1.3 * t
      return onSphere(temporalY(dz), dz, side)
    }, side, 0.9)
    trace(80, (t) => {
      const dz = -0.96 + 1.92 * t
      const q = Math.sqrt(1 - dz * dz)
      return [-side * 0.45 * q, 0.89 * q, dz]
    }, side, 1.1)
  }
  // resample each curve evenly so the sprites overlap into a continuous, tapering stroke
  const SPACING = low ? 0.022 : 0.012
  const fP: number[] = [], fT: number[] = [], fW: number[] = [], fPh: number[] = [], fSp: number[] = [], fPu: number[] = []
  const pulseCurves: { pts: V3[]; speed: number; phase: number }[] = []
  curves.forEach(({ pts, w }, ci) => {
    const len = [0]
    for (let j = 1; j < pts.length; j++) len.push(len[j - 1] + Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1], pts[j][2] - pts[j - 1][2]))
    const total = len[len.length - 1]
    const n = Math.max(8, Math.round(total / SPACING))
    const pulse = ci % 3 === 1 ? 1 : 0
    const speed = 0.06 + ((ci * 37) % 11) / 170
    const phase = (ci * 0.618) % 1
    if (pulse) pulseCurves.push({ pts, speed, phase })
    let j = 0
    for (let i = 0; i <= n; i++) {
      const L = (i / n) * total
      while (j < len.length - 2 && len[j + 1] < L) j++
      const u = (L - len[j]) / (len[j + 1] - len[j] || 1)
      const a = pts[j], b = pts[j + 1]
      const t = i / n
      fP.push(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u)
      fT.push(t)
      // swells mid-stroke and tapers to a hair at both ends; the brush presses and lifts along the way
      fW.push(w * (0.12 + 0.88 * Math.pow(Math.sin(Math.PI * t), 0.9)) * (0.72 + 0.28 * Math.sin(t * 8.2 + ci * 1.7)))
      fPh.push(phase)
      fSp.push(speed)
      fPu.push(pulse)
    }
  })
  const filGeo = new THREE.BufferGeometry()
  filGeo.setAttribute('position', new THREE.Float32BufferAttribute(fP, 3))
  filGeo.setAttribute('aT', new THREE.Float32BufferAttribute(fT, 1))
  filGeo.setAttribute('aW', new THREE.Float32BufferAttribute(fW, 1))
  filGeo.setAttribute('aPhase', new THREE.Float32BufferAttribute(fPh, 1))
  filGeo.setAttribute('aSpeed', new THREE.Float32BufferAttribute(fSp, 1))
  filGeo.setAttribute('aPulse', new THREE.Float32BufferAttribute(fPu, 1))
  const filMat = mat(FIL_VERT, FIL_FRAG, {
    uColor: { value: new THREE.Color() },
    uAccent: { value: new THREE.Color() },
    uOpacity: { value: 0.3 },
    uSize: { value: 2 },
  })
  const filaments = new THREE.Points(filGeo, filMat)

  // ── Pulse heads: soft vermilion sparks riding the pulse filaments (same clock as the shader).
  const headPos = new Float32Array(pulseCurves.length * 3)
  const headGeo = new THREE.BufferGeometry()
  headGeo.setAttribute('position', new THREE.BufferAttribute(headPos, 3))
  const headMat = mat(HEAD_VERT, HEAD_FRAG, { uColor: { value: new THREE.Color() }, uOpacity: { value: 0 }, uSize: { value: 16 } })
  const heads = new THREE.Points(headGeo, headMat)
  const placeHeads = (t: number) => {
    for (let k = 0; k < pulseCurves.length; k++) {
      const { pts, speed, phase } = pulseCurves[k]
      const f = (((t * speed + phase) % 1) + 1) % 1
      const x = f * (pts.length - 1)
      const j = Math.min(pts.length - 2, Math.floor(x))
      const u = x - j
      for (let a = 0; a < 3; a++) headPos[k * 3 + a] = pts[j][a] * (1 - u) + pts[j + 1][a] * u
    }
    headGeo.attributes.position.needsUpdate = true
  }

  brainG.add(filaments, heads)
  ;[sandBed, ground, washMass, threads, dots, brainG].forEach((o) => scene.add(o))
  sandBed.renderOrder = 0
  washMass.renderOrder = 2
  threads.renderOrder = 3
  dots.renderOrder = 4
  filaments.renderOrder = 5
  heads.renderOrder = 6
  scene.traverse((o) => void (o.frustumCulled = false))

  // ── Theme: ink on rice paper by day; by night soft additive glow over moonlit stones.
  const applyTheme = () => {
    const dark = prefs.theme === 'dark'
    const col = (name: string) => new THREE.Color(cssVar(name))
    const u = (m: THREE.ShaderMaterial) => m.uniforms
    U.uFar.value = dark ? 0.28 : 0.14
    u(dotMat).uColor.value = col(dark ? '--moss' : '--ink-2')
    u(dotMat).uColor2.value = col(dark ? '--ink' : '--moss')
    u(dotMat).uSoft.value = 1
    u(dotMat).uJit.value = dark ? 0.25 : 0.4
    u(dotMat).uOpacity.value = dark ? 0.85 : 0.62
    u(dotMat).uSize.value = (dark ? 6.5 : 5.6) * (low ? 1.25 : 1)
    u(bedMat).uColor.value = col(dark ? '--ink-3' : '--ink-2')
    u(bedMat).uColor2.value = col(dark ? '--moss' : '--moss-2')
    u(bedMat).uSoft.value = dark ? 0.6 : 0.35
    u(bedMat).uJit.value = 0.45
    u(bedMat).uOpacity.value = dark ? 1.1 : 1.55 // grounded grains sit at half strength (k = 0)
    u(bedMat).uSize.value = (dark ? 5.6 : 5) * (low ? 1.3 : 1)
    u(threadMat).uColor.value = col(dark ? '--moss-2' : '--ink-3')
    u(threadMat).uOpacity.value = dark ? 0.3 : 0.07
    u(filMat).uColor.value = col(dark ? '--ink-2' : '--ink')
    u(filMat).uAccent.value = col('--vermilion')
    u(filMat).uOpacity.value = dark ? 0.45 : 0.7
    u(filMat).uSize.value = dark ? 3.8 : 7.5
    u(washMat).uColor.value = col(dark ? '--moss-2' : '--stone')
    u(washMat).uColor2.value = u(washMat).uColor.value
    u(washMat).uSoft.value = 1
    u(washMat).uSize.value = 70
    washA = dark ? 0.05 : 0.06
    shadowA = dark ? 0.55 : 0.2
    u(headMat).uColor.value = col('--vermilion')
    u(headMat).uSize.value = dark ? 22 : 14
    u(brainShadowMat).uColor.value = col('--umbra')
    const ink = themeInk()
    for (const st of stones) {
      paintStone(st.cv, st.shape, ink)
      st.tex.needsUpdate = true
    }
    const blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending
    for (const m of [dotMat, bedMat, washMat, threadMat, filMat, headMat]) m.blending = blending
    for (const m of [dotMat, bedMat, washMat, threadMat, filMat, headMat]) m.needsUpdate = true
    stage.render()
  }
  applyTheme()
  const offPrefs = onPrefs(applyTheme)

  // ── Camera: looking down onto the raked garden at first, settling to eye level as the brain gathers.
  let dist0 = VIEW0.dist, dist1 = 5, lift = 0
  const camPos = new THREE.Vector3()
  const look = new THREE.Vector3()
  let camE = 0
  const sunP = new THREE.Vector3()
  const frame = (w: number, hgt: number) => {
    const tall = Math.max(1, (1.2 * hgt) / w)
    dist1 = 5.8 * Math.pow(tall, 0.6) // narrow screens: pull back, but keep the brain large
    dist0 = VIEW0.dist
    if (w / hgt > 2.2) {
      // short landscape strip: come closer so the garden and the brain fill the height
      dist1 *= 0.78
      dist0 *= 0.76
    }
    scrub.classList.toggle('is-vertical', hgt < 300) // short strip: the track stands at the right edge, sand below, brain above
    lift = Math.min(0.6, (tall - 1) * 0.5) // portrait: lift the final aim so the brain sits mid-frame
    U.uScale.value = (hgt / 600) * 5 * renderer.getPixelRatio()
    // the low sun hangs just above the garden's far edge, over where the brain will gather
    placeCamera(0)
    camera.updateMatrixWorld()
    sunP.set(0, SAND_Y, -3.4).project(camera)
    const d = w > hgt ? Math.min(0.24 * w, 0.4 * hgt) : 0.46 * w
    const cy = Math.max(d * 0.56, ((1 - sunP.y) / 2) * hgt - d * 0.22)
    host.style.setProperty('--sy', `${Math.round(cy)}px`)
    host.style.setProperty('--sd', `${Math.round(d)}px`)
    placeCamera(camE)
  }
  function placeCamera(e: number) {
    const p0y = SAND_Y + dist0 * Math.sin(VIEW0.pitch), p0z = dist0 * Math.cos(VIEW0.pitch)
    const d1 = dist1
    camPos.set(0, mix(p0y, 1.15, e), mix(p0z, d1 * 0.9, e))
    look.set(0, mix(SAND_Y, -0.22 - lift * 0.8, e), 0)
    camera.position.copy(camPos)
    camera.lookAt(look)
    U.uDist.value = camPos.length()
    for (const st of stones) st.m.quaternion.copy(camera.quaternion) // billboards face the camera
  }
  stage.onResize((w, hh) => frame(w, hh))

  // ── Interaction. Hold to gather; once the brain has formed, hold again to scatter it back into the sand.
  //    The sand ⟷ brain track scrubs freely both ways; drag (or arrow keys) turns the formed brain.
  let progress = 0 // what is shown: 0 = raked sand … 1 = brain
  let goal = 0 // where the visitor is taking it; progress eases after it
  let dir = 1
  let holding = false
  let gathered = false // the brain has formed at least once
  let yawT = YAW, pitchT = PITCH, sway = 0
  let dragging = false, pending = false, lx = 0, ly = 0, sx0 = 0, sy0 = 0
  let holdTimer = 0
  let lastNow = 0
  brainG.rotation.set(pitchT, yawT, 0)
  const clampPitch = (p: number) => Math.max(-0.2, Math.min(0.75, p))

  const holdArc = ring.querySelector('.t1-hold-ring') as SVGCircleElement
  const syncScrub = () => {
    scrubIn.value = String(goal)
    track.style.setProperty('--v', goal.toFixed(4))
    holdArc.style.strokeDashoffset = String(1 - goal)
    const pct = Math.round(goal * 100)
    scrubIn.setAttribute('aria-valuetext', pct <= 0 ? c.scrub.sand : pct >= 100 ? c.scrub.brain : `${pct}%`)
  }
  const setGoal = (v: number) => {
    goal = clamp01(v)
    if (ctx.reduced) progress = goal
    syncScrub()
    stage.render()
  }

  const finish = () => {
    if (gathered) return
    gathered = true
    host.classList.add('is-gathered')
    live.textContent = c.done
    scrub.hidden = false
    ctx.chime('ok')
    ctx.insight(c.insight, c.detail)
  }
  const setHold = (on: boolean, x?: number, y?: number) => {
    if (on) {
      if (goal >= 1) dir = -1
      else if (goal <= 0) dir = 1
      if (ctx.reduced) return setGoal(dir > 0 ? 1 : 0) // no flight: jump to the other end
      holding = true
      host.classList.add('is-holding')
      const r = host.getBoundingClientRect()
      ring.style.left = `${x ?? r.width / 2}px`
      ring.style.top = `${y ?? r.height / 2}px`
      stage.render()
      return
    }
    if (!holding) return
    holding = false
    host.classList.remove('is-holding')
    if (!gathered && goal > 0 && goal < 1) ctx.prompt(c.again)
  }

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return
    try {
      canvas.setPointerCapture(e.pointerId)
    } catch {
      /* pointer already gone */
    }
    const r = host.getBoundingClientRect()
    if (!gathered) return setHold(true, e.clientX - r.left, e.clientY - r.top)
    // after the brain has formed: a still press is a hold (scatter / gather), a moving one turns the brain
    pending = true
    lx = sx0 = e.clientX
    ly = sy0 = e.clientY
    clearTimeout(holdTimer)
    holdTimer = window.setTimeout(() => {
      if (pending) (pending = false), setHold(true, sx0 - r.left, sy0 - r.top)
    }, 280)
  }
  const onMove = (e: PointerEvent) => {
    if (pending && Math.hypot(e.clientX - sx0, e.clientY - sy0) > 6) {
      pending = false
      clearTimeout(holdTimer)
      dragging = true
      host.classList.add('is-grabbing')
    }
    if (!dragging) return
    yawT += (e.clientX - lx) * 0.008
    pitchT = clampPitch(pitchT + (e.clientY - ly) * 0.004)
    lx = e.clientX
    ly = e.clientY
    stage.render()
  }
  const onUp = () => {
    pending = false
    clearTimeout(holdTimer)
    setHold(false)
    dragging = false
    host.classList.remove('is-grabbing')
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      if (!e.repeat) setHold(true)
      return
    }
    if (!gathered) return // before the brain exists, arrows keep flipping scenes
    const step = { ArrowLeft: [-0.3, 0], ArrowRight: [0.3, 0], ArrowUp: [0, -0.15], ArrowDown: [0, 0.15] }[e.key]
    if (!step) return
    e.preventDefault()
    yawT += step[0]
    pitchT = clampPitch(pitchT + step[1])
    stage.render()
  }
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') setHold(false)
  }
  // the track: drag the pebble (native range input underneath), or arrows / PageUp / PageDown / Home / End
  const onScrub = () => {
    setHold(false)
    setGoal(Number(scrubIn.value))
  }
  const onScrubKey = (e: KeyboardEvent) => {
    const k = e.key
    const next = k === 'Home' ? 0 : k === 'End' ? 1
      : k === 'ArrowRight' || k === 'ArrowUp' ? goal + 0.1 : k === 'ArrowLeft' || k === 'ArrowDown' ? goal - 0.1
      : k === 'PageUp' ? goal + 0.25 : k === 'PageDown' ? goal - 0.25 : null
    if (next == null) return
    e.preventDefault() // the player must not flip scenes
    setHold(false)
    setGoal(next)
  }
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onUp)
  host.addEventListener('keydown', onKey)
  host.addEventListener('keyup', onKeyUp)
  host.addEventListener('blur', onUp)
  scrubIn.addEventListener('input', onScrub)
  scrubIn.addEventListener('keydown', onScrubKey)

  stage.onFrame((t, dt) => {
    // the hold keeps real time even when frames are slow (the stage clamps dt for motion)
    const now = performance.now()
    const holdDt = lastNow && dt > 0 ? Math.min(0.25, (now - lastNow) / 1000) : 0
    lastNow = now
    U.uTime.value = t
    if (holding && holdDt > 0) {
      // not setGoal(): its stage.render() (loop.wake) from inside the running frame would schedule a second rAF chain
      goal = clamp01(goal + (dir * holdDt) / HOLD_SECONDS)
      syncScrub()
      if (goal <= 0 || goal >= 1) setHold(false) // arrived: the next hold goes the other way
    }
    // weighted, never instant: the shown morph eases toward the goal both ways
    progress = dt > 0 ? progress + (goal - progress) * (1 - Math.exp(-dt * 7)) : goal
    if (Math.abs(goal - progress) < 1e-4) progress = goal
    if (progress >= 0.999) finish()
    U.uProgress.value = progress
    const e = smooth(0, 1, progress)
    host.style.setProperty('--p', e.toFixed(3))
    camE = e
    placeCamera(e)
    if (dt > 0 && !dragging) sway += dt // idle sway around the chosen view, only once gathered
    const ty = yawT + Math.sin(sway * 0.16) * 0.32 * e
    if (dt === 0) brainG.rotation.set(pitchT, ty, 0)
    else {
      const f = 1 - Math.exp(-dt * 4)
      brainG.rotation.y += (ty - brainG.rotation.y) * f
      brainG.rotation.x += (pitchT - brainG.rotation.x) * f
    }
    brainG.scale.setScalar(1 + 0.014 * Math.sin(t * 0.8) * e) // slow breathing once formed
    brainG.updateMatrix()
    brainShadowMat.uniforms.uOpacity.value = e * shadowA
    const hv = smooth(0.85, 1, progress)
    headMat.uniforms.uOpacity.value = hv
    if (hv > 0) placeHeads(t)
    washMat.uniforms.uOpacity.value = washA * smooth(0.55, 1, progress)
  })
  frame(stage.width, stage.height)
  syncScrub()
  stage.render()

  return () => {
    offPrefs()
    clearTimeout(holdTimer)
    canvas.removeEventListener('pointerdown', onDown)
    canvas.removeEventListener('pointermove', onMove)
    canvas.removeEventListener('pointerup', onUp)
    canvas.removeEventListener('pointercancel', onUp)
    host.removeEventListener('keydown', onKey)
    host.removeEventListener('keyup', onKeyUp)
    host.removeEventListener('blur', onUp)
    scrubIn.removeEventListener('input', onScrub)
    scrubIn.removeEventListener('keydown', onScrubKey)
    stage.dispose()
    host.remove()
    scrub.remove()
  }
}

/** No WebGL: a still side-view of the brain drawn in ink dots above raked sand. */
function brainFallback(host: HTMLElement, label: string) {
  const rand = rng(7)
  const dots = Array.from({ length: 520 }, () => {
    const d = unit(rand)
    const [, y, z] = rand() < 0.1 ? cerebellum(d) : cortex(d, 1)
    return s('circle', { cx: (160 - z * 78).toFixed(1), cy: (92 - y * 78).toFixed(1), r: (0.7 + rand() * 1.3).toFixed(2), opacity: (0.45 + rand() * 0.55).toFixed(2) })
  })
  const rakes = [0, 1, 2, 3, 4].map((i) =>
    s('path', { class: 't1-fb-rake', d: `M10 ${170 + i * 7} Q 85 ${164 + i * 7} 160 ${170 + i * 7} T 310 ${170 + i * 7}` }))
  host.classList.add('is-static')
  host.append(s('svg', { class: 't1-fallback', viewBox: '0 0 320 210', role: 'img', 'aria-label': label }, ...rakes, s('g', { class: 't1-fb-dots' }, ...dots)))
}
