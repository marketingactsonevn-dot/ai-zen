import * as THREE from 'three'
import content from '../../content/tram-09.json'
import { createStage } from '../../core/three-stage'
import { cssVar, onPrefs, prefs } from '../../core/prefs'
import { fill, h, nextId, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { Koi, bendZ, rng, spine } from './koi'
import type { Fact } from '../../core/content'
import { brushStroke, devHook, layoutOf, NOISE_GLSL, smoothLine, staticFallback, type Pt } from './shared'

const C = content.scenes.pipeline

/** Everything the six stages animate. */
const S0 = {
  card: 1, // the input photo
  slot: 0, // 0 = photo at the centre, 1 = photo joins the ring of views
  ring: 0, // imagined views
  collapse: 0, // views pour into the centre
  dust: 0,
  dustP: 0,
  form: 0,
  noise: 1,
  facet: 1,
  paint: 0,
  raw: 0,
  quad: 0,
  bones: 0,
  swim: 0,
  use: 0,
  fit: 1.3,
  fitW: 1.05,
  shadow: 0,
  zen: 0.7,
  solid: 0,
}
type P = typeof S0
const STAGES: Partial<P>[] = [
  { card: 1, slot: 0, ring: 0, collapse: 0, dust: 0, dustP: 0, form: 0, noise: 1, facet: 1, paint: 0, raw: 0, quad: 0, bones: 0, swim: 0, use: 0, fit: 1.3, fitW: 1.05, shadow: 0, zen: 0.45, solid: 0 },
  { card: 1, slot: 1, ring: 1, collapse: 0, dust: 0.7, dustP: 0, form: 0, noise: 1, facet: 1, paint: 0, raw: 0, quad: 0, bones: 0, swim: 0, use: 0, fit: 1.95, fitW: 2.72, shadow: 0, zen: 0.45, solid: 0 },
  { card: 0, slot: 1, ring: 0, collapse: 1, dust: 0, dustP: 1, form: 1, noise: 0.9, facet: 1, paint: 0, raw: 0.85, quad: 0, bones: 0, swim: 0, use: 0, fit: 1.18, fitW: 1.3, shadow: 1, zen: 1, solid: 0 },
  { card: 0, slot: 1, ring: 0, collapse: 1, dust: 0, dustP: 1, form: 1, noise: 0.15, facet: 0, paint: 1, raw: 0.14, quad: 0, bones: 0, swim: 0, use: 0, fit: 1.18, fitW: 1.3, shadow: 1, zen: 1, solid: 0 },
  { card: 0, slot: 1, ring: 0, collapse: 1, dust: 0, dustP: 1, form: 1, noise: 0, facet: 0, paint: 1, raw: 0, quad: 1, bones: 1, swim: 0.55, use: 0, fit: 1.18, fitW: 1.3, shadow: 1, zen: 1, solid: 0.9 },
  { card: 0, slot: 1, ring: 0, collapse: 1, dust: 0, dustP: 1, form: 1, noise: 0, facet: 0, paint: 1, raw: 0, quad: 0, bones: 0, swim: 1, use: 1, fit: 2.05, fitW: 2.1, shadow: 1, zen: 0, solid: 0 },
]
/** Forward choreography: [duration, delay] per param (others: 1.4 s, no delay). */
const CHOREO: Partial<Record<keyof P, [number, number]>>[] = [
  {},
  { slot: [1.6, 0], ring: [1.8, 0.5], dust: [2, 0.9], fit: [1.8, 0], fitW: [1.8, 0] },
  { collapse: [1.5, 0], card: [1, 0.4], dustP: [2.4, 0.1], form: [2, 1], dust: [1.2, 2.3], raw: [1.2, 2.4], shadow: [1.6, 1], fit: [1.8, 0.2] },
  { paint: [2.8, 0], noise: [2.2, 0.2], facet: [2.2, 0.2], raw: [1.6, 0.4] },
  { raw: [0.9, 0], solid: [1, 0], quad: [1.8, 0.4], noise: [1.4, 0.5], facet: [1.4, 0.5], bones: [1.4, 1.6], swim: [2, 2.8] },
  { quad: [0.8, 0], bones: [0.8, 0], solid: [1.4, 0.3], swim: [1.4, 0.2], use: [2.6, 0.1], fit: [2.4, 0.1], zen: [1.2, 0] },
]
const PITCH = [0.06, 0.42, 0.34, 0.3, 0.3, 0.7]

// Six sheets on a ring: the input photo in front, five imagined views around (one of them from above).
const RING_R = 2.0
const SLOTS: [number, number, number][] = [0, 1, 2, 3, 4, 5].map((k) => {
  const a = (k * 2 * Math.PI) / 6
  return [Math.sin(a) * RING_R, -0.1, Math.cos(a) * RING_R] as [number, number, number]
})
// camera direction for each sheet's picture (koi at rest, head +x)
const VIEWS: [number, number, number][] = [
  [0.18, 0.28, 1],
  [0.95, 0.3, 0.45],
  [0.32, 1, 0.5],
  [-0.2, 0.25, -1],
  [-0.85, 0.42, -0.5],
  [0.55, 0.45, -0.8],
]

const CARD_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const CARD_FRAG = /* glsl */ `
uniform sampler2D uTex;
uniform float uSketch;
uniform float uAlpha;
uniform float uSeed;
uniform float uShadeK;
uniform float uTexel;
uniform vec3 uPaperC;
uniform vec3 uPaper2;
uniform vec3 uInkC;
uniform vec3 uRedC;
uniform vec3 uEdgeC;
varying vec2 vUv;
${NOISE_GLSL}
void main() {
  vec2 p = (vUv - 0.5) * vec2(1.6, 1.2);
  vec2 q = abs(p) - vec2(0.77, 0.57);
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.02;
  d += (n3(vec3(vUv * vec2(48.0, 36.0), uSeed)) - 0.5) * 0.02;
  float a = 1.0 - smoothstep(-0.004, 0.004, d);
  if (a * uAlpha < 0.01) discard;
  float fibre = n3(vec3(vUv * vec2(160.0, 120.0), uSeed + 3.0));
  float vig = smoothstep(0.95, 0.15, length((vUv - 0.5) * vec2(1.3, 1.5)));
  vec3 bg = mix(uPaper2, uPaperC, vig * 0.85 + 0.15);
  vec3 col = bg;
  if (gl_FrontFacing) {
    vec2 iuv = (vUv - 0.5) / 0.9 + 0.5;
    float inside = step(0.0, iuv.x) * step(iuv.x, 1.0) * step(0.0, iuv.y) * step(iuv.y, 1.0);
    vec4 t = texture2D(uTex, iuv) * inside;
    if (uSketch > 0.5) {
      // sumi-e: a pale uneven wash for the body, a second wash on the shadow side, red dabbed loosely
      // over the patches, then one ink contour traced round the silhouette with a wobbling brush
      float grain = 0.7 + 0.3 * fibre;
      float pool = n3(vec3(iuv * 5.0, uSeed));
      col = mix(bg, uInkC, t.a * (0.1 + 0.09 * pool));
      col = mix(col, uInkC, clamp(t.b * uShadeK, 0.0, 1.0) * 0.2 * grain);
      vec2 jit = (vec2(n3(vec3(iuv * 7.0, uSeed + 1.0)), n3(vec3(iuv * 7.0, uSeed + 2.0))) - 0.5) * 0.035;
      float red = texture2D(uTex, iuv + jit).g * inside;
      col = mix(col, uRedC, smoothstep(0.2, 0.6, red) * (0.62 + 0.25 * pool) * grain);
      float rr = (1.3 + 1.4 * n3(vec3(iuv * 11.0, uSeed + 5.0))) * uTexel;
      float mn = 1.0, mx = 0.0;
      for (int k = 0; k < 8; k++) {
        float ang = float(k) * 0.7853982;
        float sa = texture2D(uTex, iuv + vec2(cos(ang), sin(ang)) * rr).a;
        mn = min(mn, sa);
        mx = max(mx, sa);
      }
      float contour = smoothstep(0.3, 0.8, mx - mn);
      col = mix(col, uInkC, clamp(contour * 0.88 + t.r * 0.45, 0.0, 1.0) * grain);
    } else {
      col = bg * (1.0 - t.a) + t.rgb;
    }
  } else {
    col = mix(bg, uEdgeC, 0.08 + 0.06 * fibre);
  }
  col = mix(col, uEdgeC, smoothstep(-0.035, 0.0, d) * 0.45 + (fibre - 0.5) * 0.04);
  gl_FragColor = vec4(col, a * uAlpha);
  #include <colorspace_fragment>
}`

const DUST_VERT = /* glsl */ `
uniform float uProg;
uniform float uTime;
uniform float uSize;
uniform float uScale;
attribute vec3 aStart;
attribute float aDelay;
varying float vA;
void main() {
  float k = clamp((uProg - aDelay * 0.5) / 0.5, 0.0, 1.0);
  k = k * k * (3.0 - 2.0 * k);
  vec3 drift = vec3(sin(uTime * 0.6 + aDelay * 40.0), cos(uTime * 0.5 + aDelay * 31.0), sin(uTime * 0.55 + aDelay * 23.0)) * 0.05 * (1.0 - k);
  vec3 p = mix(aStart + drift, position, k);
  p.y += sin(k * 3.14159) * 0.3 * (aDelay - 0.35);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uScale * (0.5 + aDelay) / -mv.z;
  vA = 0.55 + 0.45 * sin(uTime * 1.6 + aDelay * 60.0);
}`
const DOT_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = exp(-dot(c, c) * 14.0);
  if (a < 0.02) discard;
  gl_FragColor = vec4(uColor, a * vA * uOpacity);
  #include <colorspace_fragment>
}`

// The floor: zen rings, the koi's ink shadow, and the three places a model goes (Blender grid, pond, desk).
const GROUND_VERT = /* glsl */ `
varying vec2 vP;
void main() {
  vP = vec2(position.x, -position.y);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const GROUND_FRAG = /* glsl */ `
uniform vec3 uInkC;
uniform vec3 uMossC;
uniform vec3 uVermC;
uniform vec3 uWaterC;
uniform vec3 uTableC;
uniform vec3 uShadowC;
uniform float uTime;
uniform float uShadow;
uniform float uCardSh;
uniform float uZen;
uniform float uGrid;
uniform float uPond;
uniform float uTable;
uniform float uDark;
uniform vec2 uKoi;
uniform vec2 uDir;
uniform vec2 uFade;
varying vec2 vP;
${NOISE_GLSL}
vec4 acc = vec4(0.0);
void over(vec3 c, float a) { acc = vec4(c * a, a) + acc * (1.0 - a); }
float ln(float c, float w) { float d = abs(fract(c - 0.5) - 0.5) / max(fwidth(c), 1e-4); return 1.0 - min(d / w, 1.0); }
float ring(float r, float R) { return 1.0 - smoothstep(0.0, 1.3 * fwidth(r), abs(r - R)); }
void main() {
  vec2 p = vP;
  float r = length(p);
  float wob = n3(vec3(p * 2.2, 1.0)) - 0.5;
  // desk (AR): a soft-edged table top with a faint grain
  if (uTable > 0.001) {
    vec2 q = abs(p) - vec2(2.0, 1.35);
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.35;
    float a = (1.0 - smoothstep(-0.25, 0.15, d + wob * 0.12)) * uTable;
    float grain = sin(p.y * 46.0 + sin(p.x * 2.3) * 1.6 + n3(vec3(p * vec2(0.6, 9.0), 4.0)) * 3.0);
    over(mix(uTableC, uShadowC, smoothstep(0.6, 1.0, grain) * 0.08), a * 0.85);
  }
  // pond: water with an ink-wash shore
  if (uPond > 0.001) {
    float edge = 1.62 + wob * 0.14;
    float a = (1.0 - smoothstep(edge - 0.05, edge + 0.05, r)) * uPond;
    float shore = smoothstep(edge - 0.45, edge, r) * a;
    over(mix(uWaterC, uMossC, shore * 0.55), a * (0.5 + 0.25 * shore));
    float dk = length(p - uKoi);
    float rip = smoothstep(0.82, 1.0, sin(dk * 22.0 - uTime * 2.2)) * exp(-dk * 1.4) * (1.0 - smoothstep(edge - 0.2, edge, r));
    over(uDark > 0.5 ? uMossC : uInkC, rip * 0.22 * uPond);
  }
  // Blender: a fading grid with red X and green Y axes
  if (uGrid > 0.001) {
    float fade = (1.0 - smoothstep(1.0, 2.7, r)) * uGrid;
    float g = max(ln(p.x * 4.0, 1.0), ln(p.y * 4.0, 1.0)) * 0.22 + max(ln(p.x, 1.4), ln(p.y, 1.4)) * 0.3;
    over(uInkC, g * fade * 0.7);
    float ax = 1.0 - smoothstep(0.0, 1.6 * fwidth(p.y), abs(p.y));
    float az = 1.0 - smoothstep(0.0, 1.6 * fwidth(p.x), abs(p.x));
    over(uVermC, ax * fade * 0.85);
    over(uMossC, az * fade * 0.85);
  }
  // the work rests on an ink-wash pool (pigment gathered at its ragged edge) ringed by three brushed ensō;
  // all of it thins away before the stepping stones
  float zf = uZen * (1.0 - uPond) * smoothstep(uFade.x, uFade.y, gl_FragCoord.y);
  if (zf > 0.001) {
    float th = atan(p.y, p.x);
    vec3 ca = vec3(cos(th), sin(th), 0.0);
    float pr = 1.1 + (n3(ca * 1.7 + vec3(0.0, 0.0, 3.0)) - 0.5) * 0.34 + wob * 0.08;
    float inPool = 1.0 - smoothstep(pr - 0.02, pr + 0.03, r);
    float bloom = smoothstep(pr - 0.26, pr - 0.01, r) * inPool;
    over(uDark > 0.5 ? uMossC : uInkC, (inPool * 0.022 + bloom * bloom * 0.04) * zf);
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float R = 1.42 + fi * 0.18;
      float tt = mod(th - fi * 2.3 + 12.566, 6.2832) / 6.2832; // 0 where this stroke starts
      float press = smoothstep(0.0, 0.035, tt) * (1.0 - smoothstep(0.8, 0.95, tt));
      float w = (0.026 - fi * 0.006) * (0.45 + 0.55 * press) * (0.75 + 0.5 * n3(ca * 3.0 + vec3(0.0, 0.0, fi * 5.0)));
      float rr = r + wob * 0.03 + (n3(ca * 2.0 + vec3(0.0, 0.0, fi + 9.0)) - 0.5) * 0.05;
      float d = abs(rr - R);
      float core = 1.0 - smoothstep(w * 0.45, w, d);
      float bristle = n3(vec3(th * 22.0, (rr - R) / max(w, 1e-3) * 5.0, fi * 7.0));
      float dry = mix(1.0, smoothstep(0.3, 0.62, bristle), 0.3 + 0.6 * tt);
      over(uInkC, core * dry * press * zf * (0.2 - fi * 0.045));
    }
  }
  // the photo's shadow, then the koi's
  if (uCardSh > 0.001) {
    float d = length(p * vec2(1.0 / 0.9, 1.0 / 0.26));
    over(uShadowC, pow(max(0.0, 1.0 - d), 1.6) * uCardSh * 0.22);
  }
  if (uShadow > 0.001) {
    vec2 q = p - uKoi;
    vec2 l = vec2(dot(q, uDir), dot(q, vec2(-uDir.y, uDir.x)));
    float d = length(l * vec2(1.0 / 1.05, 1.0 / 0.3));
    over(uShadowC, pow(max(0.0, 1.0 - d), 1.4) * uShadow * (uDark > 0.5 ? 0.55 : 0.2));
  }
  if (acc.a < 0.004) discard;
  gl_FragColor = vec4(acc.rgb / acc.a, acc.a);
  #include <colorspace_fragment>
}`

const nearest = (from: number, to: number) => to + Math.round((from - to) / (Math.PI * 2)) * Math.PI * 2

/** Scene 1 — six steps from a flat photo to a koi that swims; rotate the work at every step. */
export function pipelineScene(ctx: SceneCtx) {
  const low = ctx.quality === 'low'
  const root = h('div', { class: 't9 t9p' })
  const host = h('div', {
    class: 't9-stage', tabindex: '0', role: 'slider', 'aria-label': C.aria,
    'aria-valuemin': '0', 'aria-valuemax': '360', 'aria-valuenow': '0', 'aria-valuetext': fill(C.valueText, { deg: 0 }),
  })
  // caption
  const num = h('p', { class: 't9p-num' })
  const title = h('h2', { class: 't9p-title' })
  const text = h('p', { class: 't9p-text' })
  const note = h('p', { class: 't9p-note' })
  const mapBtns = C.maps.items.map((m, i) => h('button', { class: 't9-chip', type: 'button', 'aria-pressed': String(i === 0), onClick: () => pickMap(i) }, m))
  const useBtns = C.uses.items.map((u, i) => h('button', { class: 't9-chip', type: 'button', 'aria-pressed': String(i === 1), onClick: () => pickUse(i) }, u.name))
  const maps = h('div', { class: 't9p-chips', role: 'group', 'aria-label': C.maps.label }, ...mapBtns)
  const uses = h('div', { class: 't9p-chips', role: 'group', 'aria-label': C.uses.label }, ...useBtns)
  const capIn = h('div', { class: 't9p-cap-in' }, num, title, text, maps, uses, note)
  const cap = h('div', { class: 't9p-cap', 'aria-live': 'polite' }, capIn)
  // the path of six stepping stones
  const stepBtns = C.steps.map((st, i) =>
    h('li', null, h('button', { class: 't9p-step', type: 'button', 'aria-label': fill(C.stepAria, { n: i + 1, name: st.name }), onClick: () => go(i) },
      h('span', { class: 't9p-stone', 'aria-hidden': 'true' }, String(i + 1)),
      h('span', { class: 't9p-step-l', 'aria-hidden': 'true' }, st.short))))
  // the path between them: one brush stroke, inked darker as far as the visitor has walked
  const pathBase = s('path', { class: 'pb' })
  const pathInk = s('path', { class: 'pi' })
  const path = s('svg', { class: 't9p-path', 'aria-hidden': 'true' }, s('g', { filter: low ? null : 'url(#ink-rough)' }, pathBase, pathInk))
  const steps = h('nav', { class: 't9p-steps', 'aria-label': C.stepsLabel }, path, h('ol', null, ...stepBtns))
  // behind the work: a far ridge in pale wash, sinking into a band of mist
  const sky = s('svg', { class: 't9p-sky', 'aria-hidden': 'true' })
  // labels drawn in the picture
  const orLabel = h('p', { class: 't9p-or', 'aria-hidden': 'true' }, C.orText)
  const backLabel = h('p', { class: 't9p-back', 'aria-hidden': 'true' }, C.back)
  const phone = h('div', { class: 't9p-phone', 'aria-hidden': 'true' }, h('i'), h('b'))
  const gizmo = s('svg', { class: 't9p-gizmo', viewBox: '0 0 60 60', 'aria-hidden': 'true' },
    s('path', { class: 'gz-x', d: 'M30 30 L52 36' }), s('path', { class: 'gz-y', d: 'M30 30 L14 40' }), s('path', { class: 'gz-z', d: 'M30 30 L30 8' }),
    s('circle', { class: 'gz-x', cx: 52, cy: 36, r: 5 }), s('circle', { class: 'gz-y', cx: 14, cy: 40, r: 5 }), s('circle', { class: 'gz-z', cx: 30, cy: 8, r: 5 }))
  root.append(sky, host, phone, gizmo, orLabel, backLabel, cap, steps)
  ctx.art.append(root)
  ctx.prompt(C.prompt)

  const stage = createStage(host, { fov: 32 })
  if (!stage) {
    host.removeAttribute('role')
    host.removeAttribute('tabindex')
    staticFallback(host, C.noWebgl)
    cap.remove()
    steps.remove()
    ctx.insight(C.insight, C.detail)
    return () => root.remove()
  }
  const { scene, camera, renderer, canvas } = stage
  canvas.setAttribute('aria-hidden', 'true')

  const S: P = { ...S0 }
  const world = new THREE.Group() // pitch
  const spin = new THREE.Group() // yaw
  const koiRoot = new THREE.Group() // swim path
  world.add(spin)
  spin.add(koiRoot)
  scene.add(world)

  // ── the koi
  const koi = new Koi(low)
  koiRoot.add(koi.group)
  const KU = koi.U

  // ── sheets: photo + imagined views, rendered once from the finished koi
  const RW = low ? 256 : 384
  const rts = VIEWS.map(() => new THREE.WebGLRenderTarget(RW, (RW * 3) / 4, { samples: low ? 0 : 4 }))
  const cardGeo = new THREE.PlaneGeometry(1.6, 1.2)
  const cardU = {
    uPaperC: { value: new THREE.Color() },
    uPaper2: { value: new THREE.Color() },
    uInkC: { value: new THREE.Color() },
    uRedC: { value: new THREE.Color() },
    uEdgeC: { value: new THREE.Color() },
    uShadeK: { value: 1 },
    uTexel: { value: 1 / RW },
  }
  const cards = rts.map((rt, i) => {
    const m = new THREE.ShaderMaterial({
      vertexShader: CARD_VERT, fragmentShader: CARD_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { ...cardU, uTex: { value: rt.texture }, uSketch: { value: i ? 1 : 0 }, uAlpha: { value: 0 }, uSeed: { value: i * 7.3 } },
    })
    const mesh = new THREE.Mesh(cardGeo, m)
    mesh.renderOrder = 6
    spin.add(mesh)
    return mesh
  })
  const studio = new THREE.Scene()
  const studioCam = new THREE.PerspectiveCamera(26, 4 / 3, 0.1, 40)
  const shoot = () => {
    const keep = { swim: KU.uSwim.value, noise: KU.uNoise.value, facet: KU.uFacet.value, paint: KU.uPaint.value, form: KU.uForm.value, sketch: KU.uSketch.value }
    const mapW = (KU.uMapW.value as THREE.Vector4).clone()
    KU.uSwim.value = 0; KU.uNoise.value = 0; KU.uFacet.value = 0; KU.uPaint.value = 1; KU.uForm.value = 1
    ;(KU.uMapW.value as THREE.Vector4).set(1, 0, 0, 0)
    koi.wireRaw.visible = koi.wireQuad.visible = false
    const vis = koi.body.visible
    koi.body.visible = koi.fins.visible = true
    studio.add(koi.group)
    const clear = renderer.getClearColor(new THREE.Color())
    const alpha = renderer.getClearAlpha()
    renderer.setClearColor(0x000000, 0)
    rts.forEach((rt, i) => {
      const [x, y, z] = VIEWS[i]
      const d = i === 0 ? 4.15 : 3.55
      const l = Math.hypot(x, y, z)
      studioCam.position.set((x / l) * d, (y / l) * d, (z / l) * d)
      studioCam.up.set(0, 1, 0)
      studioCam.lookAt(-0.05, -0.05, 0)
      KU.uSketch.value = i ? 1 : 0
      renderer.setRenderTarget(rt)
      renderer.clear()
      renderer.render(studio, studioCam)
    })
    renderer.setRenderTarget(null)
    renderer.setClearColor(clear, alpha)
    koiRoot.add(koi.group)
    koi.body.visible = koi.fins.visible = vis
    KU.uSwim.value = keep.swim; KU.uNoise.value = keep.noise; KU.uFacet.value = keep.facet; KU.uPaint.value = keep.paint; KU.uForm.value = keep.form; KU.uSketch.value = keep.sketch
    ;(KU.uMapW.value as THREE.Vector4).copy(mapW)
  }

  // ── dust: what the views tell the model, drifting in to settle on the surface
  const rand = rng(99)
  const bodyPos = koi.body.geometry.attributes.position as THREE.BufferAttribute
  const finPos = koi.fins.geometry.attributes.position as THREE.BufferAttribute
  const ND = low ? 280 : 640
  const dTarget = new Float32Array(ND * 3), dStart = new Float32Array(ND * 3), dDelay = new Float32Array(ND)
  for (let i = 0; i < ND; i++) {
    const fromFin = rand() < 0.25
    const src = fromFin ? finPos : bodyPos
    const k = Math.floor(rand() * src.count)
    dTarget.set([src.getX(k), src.getY(k), src.getZ(k)], i * 3)
    const sl = SLOTS[Math.floor(rand() * SLOTS.length)]
    const a = rand() * Math.PI * 2, rr = 0.15 + rand() * 0.55
    dStart.set([sl[0] * 0.8 + Math.cos(a) * rr, sl[1] * 0.85 + (rand() - 0.5) * 0.6, sl[2] * 0.8 + Math.sin(a) * rr], i * 3)
    dDelay[i] = rand()
  }
  const dustGeo = new THREE.BufferGeometry()
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dTarget, 3))
  dustGeo.setAttribute('aStart', new THREE.BufferAttribute(dStart, 3))
  dustGeo.setAttribute('aDelay', new THREE.BufferAttribute(dDelay, 1))
  const dustMat = new THREE.ShaderMaterial({
    vertexShader: DUST_VERT, fragmentShader: DOT_FRAG, transparent: true, depthWrite: false,
    uniforms: { uProg: { value: 0 }, uTime: { value: 0 }, uSize: { value: 4 }, uScale: { value: 1 }, uColor: { value: new THREE.Color() }, uOpacity: { value: 0 } },
  })
  const dust = new THREE.Points(dustGeo, dustMat)
  dust.renderOrder = 5
  koiRoot.add(dust)

  // ── bones (rig): Blender-style octahedral bones along the spine, seen through the body like an x-ray
  const JU = [0.02, 0.2, 0.38, 0.56, 0.74, 0.9, 1.0, 1.17, 1.34]
  const octa = new THREE.BufferGeometry()
  octa.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.2, 1, 0, 0.2, 0, 1, 0.2, -1, 0, 0.2, 0, -1, 1, 0, 0], 3))
  octa.setIndex([0, 2, 1, 0, 3, 2, 0, 4, 3, 0, 1, 4, 5, 1, 2, 5, 2, 3, 5, 3, 4, 5, 4, 1])
  const octaEdges = new THREE.EdgesGeometry(octa)
  const boneMat = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, opacity: 0.32, side: THREE.DoubleSide })
  const boneLineMat = new THREE.LineBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, opacity: 0.95 })
  const jointMat = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false })
  const jointGeo = new THREE.SphereGeometry(1, 14, 10)
  const rig = new THREE.Group()
  const bones = JU.slice(0, -1).map(() => {
    const m = new THREE.Mesh(octa, boneMat)
    m.add(new THREE.LineSegments(octaEdges, boneLineMat))
    m.renderOrder = 8
    ;(m.children[0] as THREE.LineSegments).renderOrder = 9
    rig.add(m)
    return m
  })
  const jointMs = JU.map(() => {
    const m = new THREE.Mesh(jointGeo, jointMat)
    m.renderOrder = 10
    rig.add(m)
    return m
  })
  koiRoot.add(rig)
  const jp = JU.map(() => new THREE.Vector3())
  const JS = JU.map(spine) // rest positions of the joints along the spine (fixed: computed once)
  const X = new THREE.Vector3(1, 0, 0)

  // ── floor + lotus pads
  const groundMat = new THREE.ShaderMaterial({
    vertexShader: GROUND_VERT, fragmentShader: GROUND_FRAG, transparent: true, depthWrite: false,
    uniforms: {
      uInkC: { value: new THREE.Color() }, uMossC: { value: new THREE.Color() }, uVermC: { value: new THREE.Color() }, uWaterC: { value: new THREE.Color() },
      uTableC: { value: new THREE.Color() }, uShadowC: { value: new THREE.Color() }, uTime: { value: 0 }, uShadow: { value: 0 }, uCardSh: { value: 0 },
      uZen: { value: 0 }, uFade: { value: new THREE.Vector2(0, 1) }, uGrid: { value: 0 }, uPond: { value: 0 }, uTable: { value: 0 }, uDark: { value: 0 },
      uKoi: { value: new THREE.Vector2() }, uDir: { value: new THREE.Vector2(1, 0) },
    },
  })
  const GY = -0.64
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = GY
  ground.renderOrder = 1
  spin.add(ground)
  const padMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0 })
  const padMat2 = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0 })
  const pads = ([[-1.15, -0.55, 0.26, 0.4, 0], [1.05, 0.85, 0.2, 2.2, 1], [0.35, -1.25, 0.15, 4.1, 0], [-0.75, 1.05, 0.12, 5.3, 1]] as const).map(([x, z, r, rot, k]) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 32, 0.35, Math.PI * 2 - 0.35), k ? padMat2 : padMat)
    m.rotation.set(-Math.PI / 2, 0, rot)
    m.position.set(x, GY + 0.01, z)
    m.renderOrder = 2
    spin.add(m)
    return m
  })
  scene.traverse((o) => void (o.frustumCulled = false))

  // ── palette
  const applyTheme = () => {
    const dark = prefs.theme === 'dark'
    const c = (n: string) => new THREE.Color(cssVar(n))
    koi.theme()
    cardU.uPaperC.value = dark ? c('--card').lerp(c('--stone-3'), 0.35) : c('--card')
    cardU.uPaper2.value = dark ? c('--paper-2') : c('--paper-2')
    cardU.uInkC.value = c('--ink')
    cardU.uRedC.value = c('--vermilion')
    cardU.uEdgeC.value = dark ? c('--stone-3') : c('--stone')
    cardU.uShadeK.value = dark ? 0.15 : 1
    dustMat.uniforms.uColor.value = dark ? c('--moss') : c('--ink-3')
    dustMat.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending
    dustMat.needsUpdate = true
    boneMat.color = c('--vermilion')
    boneLineMat.color = c('--vermilion')
    jointMat.color = c('--vermilion')
    const G = groundMat.uniforms
    G.uInkC.value = c('--ink')
    G.uMossC.value = c('--moss')
    G.uVermC.value = c('--vermilion')
    G.uWaterC.value = dark ? c('--moss-soft') : c('--moss-soft')
    G.uTableC.value = dark ? c('--stone-3') : c('--paper-2')
    G.uShadowC.value = dark ? new THREE.Color(0, 0, 0) : c('--ink')
    G.uDark.value = dark ? 1 : 0
    padMat.color = c('--moss')
    padMat2.color = c('--moss-2')
    shoot()
    stage.render()
  }
  applyTheme()
  const offPrefs = onPrefs(applyTheme)

  // ── backdrop: two pale ridges framing the work (open in the middle, where the work stands), mist at their feet
  const skyId = nextId('t9sky')
  const drawSky = (W: number, H: number) => {
    sky.setAttribute('viewBox', `0 0 ${W} ${H}`)
    const foot = free.cy + free.h * 0.06
    const V = Math.min(free.h * 0.42, W * 0.22)
    const ridge = (peaks: number[][], k: number) => {
      const pts: Pt[] = []
      for (let i = 0; i <= 48; i++) {
        const t = i / 48
        let y = 0
        for (const [c, hh, w] of peaks) y = Math.max(y, hh * Math.exp(-(((t - c) / w) ** 2)))
        y += 0.035 * Math.sin(t * 37 + k) + 0.02 * Math.sin(t * 91 + k * 2)
        pts.push([-20 + (W + 40) * t, foot - V * Math.max(0, y)])
      }
      return `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}L${W + 20} ${foot + V * 0.3}L-20 ${foot + V * 0.3}Z`
    }
    // fades from a pale wash at the crests to nothing at the foot
    const grad = (id: string, op: number, top: number) => s('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1: 0, x2: 0, y1: top.toFixed(1), y2: (foot + V * 0.1).toFixed(1) },
      s('stop', { offset: 0, style: `stop-color:var(--ink);stop-opacity:${op}` }),
      s('stop', { offset: 1, style: 'stop-color:var(--ink);stop-opacity:0' }))
    const gf = grad(`${skyId}f`, 0.075, foot - V * 1.05), gn = grad(`${skyId}n`, 0.1, foot - V * 0.6)
    const mist = s('linearGradient', { id: `${skyId}m`, x1: 0, y1: 0, x2: 0, y2: 1 },
      s('stop', { offset: 0, style: 'stop-color:var(--paper);stop-opacity:0' }),
      s('stop', { offset: 0.55, style: 'stop-color:var(--paper);stop-opacity:0.92' }),
      s('stop', { offset: 1, style: 'stop-color:var(--paper);stop-opacity:0' }))
    const wash = low ? {} : { filter: 'url(#ink-wash)' }
    // the whole landscape dissolves into the paper toward both sides
    const side = s('mask', { id: `${skyId}x`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H },
      s('rect', { x: 0, y: 0, width: W, height: H, fill: `url(#${skyId}h)` }))
    const hg = s('linearGradient', { id: `${skyId}h`, x1: 0, x2: 1, y1: 0, y2: 0 },
      s('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 0 }),
      s('stop', { offset: 0.16, 'stop-color': '#fff', 'stop-opacity': 1 }),
      s('stop', { offset: 0.84, 'stop-color': '#fff', 'stop-opacity': 1 }),
      s('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 }))
    sky.replaceChildren(s('defs', null, gf, gn, mist, hg, side),
      s('g', { mask: `url(#${skyId}x)` },
        s('path', { d: ridge([[0.12, 1, 0.09], [0.24, 0.62, 0.08], [0.8, 0.5, 0.07], [0.92, 0.82, 0.07]], 1), fill: `url(#${skyId}f)`, ...wash }),
        s('path', { d: ridge([[0.03, 0.55, 0.07], [0.33, 0.3, 0.06], [0.7, 0.36, 0.06], [0.99, 0.5, 0.06]], 4), fill: `url(#${skyId}n)`, ...wash }),
        s('rect', { x: 0, y: (foot - V * 0.55).toFixed(1), width: W, height: (V * 0.85).toFixed(1), fill: `url(#${skyId}m)` })))
  }

  // ── the stepping-stone path as one brush stroke through the stones
  let walked = 0
  const drawPath = () => {
    const nb = steps.getBoundingClientRect()
    if (!nb.width) return
    path.setAttribute('viewBox', `0 0 ${nb.width.toFixed(1)} ${nb.height.toFixed(1)}`)
    const c = stepBtns.map((li) => {
      const r = (li.querySelector('.t9p-stone') as HTMLElement).getBoundingClientRect()
      return [r.left + r.width / 2 - nb.left, r.top + r.height / 2 - nb.top] as Pt
    })
    const line = smoothLine(c, 10)
    const sw = root.dataset.layout === 'short' ? 5 : 6
    pathBase.setAttribute('d', brushStroke(line, sw, 2))
    pathInk.setAttribute('d', walked ? brushStroke(line.slice(0, walked * 10 + 1), sw * 1.05, 5) : '')
  }

  // ── camera framing: keep the work inside the free area (clear of caption and stepping stones)
  let free = { cx: 0, cy: 0, w: 1, h: 1 }
  let dist = 0
  const measure = () => {
    const W = stage.width, H = stage.height
    if (W < 2 || H < 2) return
    const L = layoutOf(root)
    root.dataset.layout = L
    const rr = root.getBoundingClientRect()
    const cb = capIn.getBoundingClientRect()
    const sb = steps.getBoundingClientRect()
    let top = 0, left = 0, right = 0, bottom = 0
    if (L === 'short') {
      left = Math.max(0, cb.right - rr.left + 6)
      right = Math.max(0, rr.right - sb.left + 6)
    } else {
      bottom = Math.max(0, rr.bottom - sb.top + 6)
      if (L === 'tall') top = Math.max(0, cb.bottom - rr.top + 8)
      else left = Math.max(0, cb.right - rr.left) * 0.55
    }
    const fw = Math.max(80, W - left - right)
    free = { cx: left + fw / 2, cy: top + (H - top - bottom) / 2, w: fw, h: Math.max(60, H - top - bottom) }
    camera.setViewOffset(W, H, W / 2 - free.cx, H / 2 - free.cy, W, H)
    const pr = renderer.getPixelRatio()
    dustMat.uniforms.uScale.value = (H / 600) * pr * 5
    // the ground thins away above the stepping stones
    const fy = L === 'short' ? 0 : H - (sb.top - rr.top)
    groundMat.uniforms.uFade.value.set(fy * pr, (fy + Math.min(70, H * 0.12)) * pr)
    // AR phone: fits the free area, below the caption and note
    phone.style.setProperty('--ph', `${Math.min(free.h * 0.94, (free.w * 0.9 * 19) / 9)}px`)
    Object.assign(phone.style, { left: `${free.cx}px`, top: `${free.cy}px` })
    drawSky(W, H)
    drawPath()
  }
  stage.onResize(() => measure())
  measure()
  const ro = new ResizeObserver(() => measure())
  ro.observe(capIn)
  const targetDist = () => {
    const t = Math.tan((camera.fov * Math.PI) / 360)
    return (stage.height / t) * Math.max(S.fit / free.h, S.fitW / free.w)
  }
  dist = targetDist()

  // ── state
  let cur = 0
  let yawT = 0, pitchT = PITCH[0], yaw = 0, pitch = PITCH[0]
  let idle = 0, travel = -Math.PI / 2, phase = 1.2
  let tl: ReturnType<typeof gsap.timeline> | null = null
  let mapI = 0, useI = 1
  const mapW = KU.uMapW.value as THREE.Vector4
  const env = { grid: 0, pond: 1, table: 0 }
  const portrait = () => root.dataset.layout === 'tall'
  const baseYaw = (i: number) => (i === 0 ? 0 : i === 1 ? 0.2 : i === 5 ? 0.3 : portrait() ? -0.95 : -0.62)
  const seen = new Set<number>([0])
  let insightTimer = 0

  // The words come after the picture: a stage shows its number and name at once, its sentence only once the
  // change has played out (or the visitor turns the work). Stage 1's sentence waits for the photo's blank back.
  const told = new Set<number>()
  let textTimer = 0
  const setNote = () => note.replaceChildren(ctx.fact(C.uses.items[useI].note as Fact | string, 'span'))
  const tell = () => {
    clearTimeout(textTimer)
    if (told.has(cur) && text.classList.contains('on')) return
    told.add(cur)
    text.classList.add('on')
    note.classList.add('on')
    if (!ctx.reduced) ctx.anim(() => gsap.fromTo([text, note], { opacity: 0, y: 6, filter: 'blur(4px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.1, ease: 'power3.out', clearProps: 'filter' }))
  }
  const setCaption = (i: number, animate: boolean) => {
    const st = C.steps[i]
    num.textContent = fill(C.of, { n: i + 1 })
    title.textContent = st.name
    text.textContent = st.caption
    text.classList.toggle('on', told.has(i))
    note.classList.toggle('on', told.has(i))
    clearTimeout(textTimer)
    if (!told.has(i) && i > 0) textTimer = window.setTimeout(tell, 1900)
    maps.hidden = i !== 3
    uses.hidden = i !== 5
    note.hidden = i !== 5
    root.dataset.stage = String(i)
    if (animate && !ctx.reduced) ctx.anim(() => gsap.fromTo([num, title, maps, uses], { opacity: 0, y: 8, filter: 'blur(4px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.9, stagger: 0.07, ease: 'power3.out', clearProps: 'filter' }))
    stepBtns.forEach((li, k) => {
      const b = li.firstElementChild as HTMLElement
      if (k === i) b.setAttribute('aria-current', 'step')
      else b.removeAttribute('aria-current')
      b.classList.toggle('seen', seen.has(k))
      b.classList.toggle('next', k === i + 1)
    })
    walked = Math.max(walked, i)
    measure()
  }

  function go(i: number) {
    if (i === cur) return
    const fwd = i === cur + 1
    cur = i
    seen.add(i)
    setCaption(i, true)
    yawT = nearest(yawT, baseYaw(i))
    pitchT = PITCH[i]
    idle = 0
    if (i !== 3 && mapI) pickMap(0)
    const T = STAGES[i]
    tl?.kill()
    if (ctx.reduced) {
      Object.assign(S, T)
      stage!.render()
    } else {
      ctx.anim(() => {
        tl = gsap.timeline()
        for (const k of Object.keys(T) as (keyof P)[]) {
          const [d, dl] = fwd ? (CHOREO[i][k] ?? [1.4, 0]) : [1.2, 0]
          tl.to(S, { [k]: T[k], duration: d, ease: 'power2.inOut' }, dl)
        }
      })
    }
    ctx.chime('soft')
    if (i === 5 && !insightTimer) insightTimer = window.setTimeout(() => ctx.insight(C.insight, C.detail), ctx.reduced ? 0 : 2600)
  }

  function pickMap(i: number) {
    mapI = i
    mapBtns.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)))
    const t = { x: +(i === 0), y: +(i === 1), z: +(i === 2), w: +(i === 3) }
    if (ctx.reduced) (mapW.set(t.x, t.y, t.z, t.w), stage!.render())
    else ctx.anim(() => gsap.to(mapW, { ...t, duration: 0.8, ease: 'power2.inOut' }))
  }
  function pickUse(i: number) {
    useI = i
    useBtns.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)))
    setNote()
    tell()
    root.dataset.use = String(i)
    const t = { grid: +(i === 0), pond: +(i === 1), table: +(i === 2) }
    if (ctx.reduced) (Object.assign(env, t), stage!.render())
    else ctx.anim(() => gsap.to(env, { ...t, duration: 1, ease: 'power2.inOut' }))
    ctx.chime('tap')
  }
  root.dataset.use = '1'
  setNote()
  setCaption(0, false)

  // ── rotate: drag or arrow keys
  let drag: { id: number; x: number; y: number } | null = null
  const clampP = (p: number) => Math.max(-0.25, Math.min(1.25, p))
  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY }
    try {
      host.setPointerCapture(e.pointerId)
    } catch {
      /* gone */
    }
    host.classList.add('grabbing')
  }
  const onMove = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return
    yawT += (e.clientX - drag.x) * 0.009
    pitchT = clampP(pitchT + (e.clientY - drag.y) * 0.005)
    drag.x = e.clientX
    drag.y = e.clientY
    idle = 0
    if (cur > 0) tell()
    stage.render()
  }
  const onUp = () => {
    drag = null
    host.classList.remove('grabbing')
  }
  const onKey = (e: KeyboardEvent) => {
    const st = ({ ArrowLeft: [-0.35, 0], ArrowRight: [0.35, 0], ArrowUp: [0, -0.15], ArrowDown: [0, 0.15] } as Record<string, number[]>)[e.key]
    if (e.key === 'Home') {
      e.preventDefault()
      yawT = nearest(yawT, baseYaw(cur))
      pitchT = PITCH[cur]
    } else if (st) {
      e.preventDefault()
      yawT += st[0]
      pitchT = clampP(pitchT + st[1])
    } else return
    idle = 0
    if (cur > 0) tell()
    stage.render()
  }
  host.addEventListener('pointerdown', onDown)
  host.addEventListener('pointermove', onMove)
  host.addEventListener('pointerup', onUp)
  host.addEventListener('pointercancel', onUp)
  host.addEventListener('keydown', onKey)

  // ── per frame
  const q = new THREE.Quaternion()
  const v = new THREE.Vector3()
  const n = new THREE.Vector3()
  const bill = new THREE.Quaternion()
  const ident = new THREE.Quaternion()
  let lastDeg = -1
  const frame = (t: number, dt: number) => {
    const live = dt > 0
    // view
    if (live) {
      idle += dt
      if (!drag && idle > 3 && cur >= 1 && cur <= 4) yawT += dt * 0.13
      const f = 1 - Math.exp(-dt * 3.2)
      yaw += (yawT - yaw) * f
      pitch += (pitchT - pitch) * f
      dist += (targetDist() - dist) * (1 - Math.exp(-dt * 4))
      phase += dt * (1.6 + 1.2 * S.use)
      travel += dt * 0.32 * S.use
    } else {
      yaw = yawT
      pitch = pitchT
      dist = targetDist()
    }
    spin.rotation.y = yaw
    world.rotation.x = pitch
    camera.position.set(0, 0, dist)
    camera.lookAt(0, 0, 0)
    world.updateMatrixWorld()
    const deg = Math.round(((((yaw - baseYaw(cur)) * 180) / Math.PI) % 360 + 360) % 360)
    if (deg !== lastDeg) {
      lastDeg = deg
      host.setAttribute('aria-valuenow', String(deg))
      host.setAttribute('aria-valuetext', fill(C.valueText, { deg }))
    }

    // koi
    KU.uForm.value = S.form
    KU.uNoise.value = S.noise
    KU.uFacet.value = S.facet
    KU.uPaint.value = S.paint
    KU.uSwim.value = S.swim
    KU.uSolid.value = S.solid
    KU.uPhase.value = phase
    koi.body.visible = koi.fins.visible = S.form > 0.001
    koi.rawOpacity = S.raw * (prefs.theme === 'dark' ? 0.5 : 0.45)
    koi.quadOpacity = 0.75 * Math.min(1, S.quad * 3)
    koi.quadReveal = S.quad
    const r = 0.78 * S.use * (1 - 0.6 * env.table)
    koiRoot.position.set(Math.cos(travel) * r, -0.34 * S.use, Math.sin(travel) * r)
    koiRoot.rotation.y = -(travel + Math.PI / 2) * Math.min(1, S.use * 4)
    koiRoot.scale.setScalar(1 - 0.42 * env.table * S.use) // AR: small enough to stay inside the phone

    // sheets
    camera.updateMatrixWorld()
    spin.getWorldQuaternion(q)
    bill.copy(q).invert().multiply(camera.quaternion)
    for (let i = 0; i < cards.length; i++) {
      const m = cards[i]
      const mat = m.material as THREE.ShaderMaterial
      const [x, y0, z] = SLOTS[i]
      // front sheets dip, far ones rise, so the ring never stacks one sheet on another
      const y = y0 - 0.3 * ((-x * Math.sin(yaw) + z * Math.cos(yaw)) / RING_R)
      const k = 1 - S.collapse
      if (i === 0) {
        m.position.set(x * S.slot * k, y * S.slot * k + 0.14 * (1 - S.slot), z * S.slot * k)
        m.scale.setScalar(THREE.MathUtils.lerp(1, 0.7, S.slot) * (0.1 + 0.9 * k))
        m.quaternion.slerpQuaternions(ident, bill, S.slot)
        mat.uniforms.uAlpha.value = S.card * Math.min(1, k * 1.6)
      } else {
        const a = Math.max(0, Math.min(1, S.ring * 1.7 - i * 0.14))
        m.position.set(x * k, y * k, z * k)
        m.scale.setScalar(0.7 * (0.7 + 0.3 * a) * (0.1 + 0.9 * k))
        m.quaternion.copy(bill)
        mat.uniforms.uAlpha.value = a * Math.min(1, k * 1.6)
      }
      m.visible = mat.uniforms.uAlpha.value > 0.003
    }
    // the photo is flat: say so when its blank back turns to us
    const c0 = cards[0]
    let showBack = false
    if (cur === 0 && c0.visible) {
      c0.getWorldPosition(v)
      n.set(0, 0, 1).applyQuaternion(c0.getWorldQuaternion(q))
      showBack = n.dot(v.sub(camera.position).negate()) < 0
    }
    root.classList.toggle('show-back', showBack)
    if (showBack && !told.has(0)) tell()
    if (showBack) {
      v.set(0, 0, 0).applyMatrix4(c0.matrixWorld).project(camera)
      backLabel.style.transform = `translate(${((v.x + 1) / 2) * stage.width}px, ${((1 - v.y) / 2) * stage.height}px)`
    }
    if (cur === 0) {
      // the text alternative sits under the photo
      v.set(0, -0.68, 0).applyMatrix4(c0.matrixWorld).project(camera)
      orLabel.style.transform = `translate(-50%, 0) translate(${((v.x + 1) / 2) * stage.width}px, ${((1 - v.y) / 2) * stage.height + 10}px)`
    }

    // dust
    dust.visible = S.dust > 0.003
    dustMat.uniforms.uOpacity.value = S.dust * (prefs.theme === 'dark' ? 0.42 : 0.3)
    dustMat.uniforms.uProg.value = S.dustP
    dustMat.uniforms.uTime.value = t
    dustMat.uniforms.uSize.value = prefs.theme === 'dark' ? 12 : 13

    // bones
    rig.visible = S.bones > 0.003
    if (rig.visible) {
      for (let k = 0; k < JS.length; k++) {
        const [x, y, z] = JS[k]
        jp[k].set(x, y + 0.01, z + bendZ(x, S.swim, phase))
      }
      for (let k = 0; k < bones.length; k++) {
        const b = bones[k]
        const a = Math.max(0, Math.min(1, S.bones * bones.length - k))
        v.subVectors(jp[k + 1], jp[k])
        const len = v.length()
        b.position.copy(jp[k])
        b.quaternion.setFromUnitVectors(X, v.normalize())
        const w = Math.min(0.045, len * 0.16)
        b.scale.set(len * a + 1e-4, w * a + 1e-4, w * a + 1e-4)
        b.visible = a > 0.01
      }
      for (let k = 0; k < jointMs.length; k++) {
        const m = jointMs[k]
        const a = Math.max(0, Math.min(1, S.bones * bones.length - k + 0.5))
        m.position.copy(jp[k])
        m.scale.setScalar(0.022 * a + 1e-4)
        m.visible = a > 0.01
      }
    }

    // floor
    const G = groundMat.uniforms
    G.uTime.value = t
    G.uZen.value = S.zen
    G.uShadow.value = S.shadow * Math.min(1, S.form * 1.5)
    G.uCardSh.value = S.card * (1 - S.slot) * (1 - S.collapse)
    G.uGrid.value = env.grid * S.use
    G.uPond.value = env.pond * S.use
    G.uTable.value = env.table * S.use
    G.uKoi.value.set(koiRoot.position.x, koiRoot.position.z)
    G.uDir.value.set(Math.cos(koiRoot.rotation.y), -Math.sin(koiRoot.rotation.y))
    const pa = env.pond * S.use
    padMat.opacity = pa * 0.85
    padMat2.opacity = pa * 0.7
    for (let k = 0; k < pads.length; k++) {
      pads[k].visible = pa > 0.003
      pads[k].position.y = GY + 0.01 + Math.sin(t * 0.7 + k) * 0.004
    }
    root.style.setProperty('--use', S.use.toFixed(3))
    root.style.setProperty('--grid', (env.grid * S.use).toFixed(3))
    root.style.setProperty('--ar', (env.table * S.use).toFixed(3))
  }
  stage.onFrame(frame)
  stage.render()
  devHook({ S, koi, env }, frame, () => renderer.render(scene, camera))

  return () => {
    clearTimeout(insightTimer)
    clearTimeout(textTimer)
    ro.disconnect()
    tl?.kill()
    offPrefs()
    host.removeEventListener('pointerdown', onDown)
    host.removeEventListener('pointermove', onMove)
    host.removeEventListener('pointerup', onUp)
    host.removeEventListener('pointercancel', onUp)
    host.removeEventListener('keydown', onKey)
    rts.forEach((rt) => rt.dispose())
    studio.clear()
    stage.dispose()
    root.remove()
  }
}

