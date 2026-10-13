import * as THREE from 'three'
import { createStage } from '../../core/three-stage'
import { cssVar } from '../../core/prefs'
import { fill, h, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { brush, C, clamp, onTheme, stableHeight, type Pt } from './kit'

const B = C.scenes.block
const MAX = 50
const FW = 1.6
const FH = 0.9
const GAP = 0.3

// ───────── Shaders ─────────
const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

/**
 * One frame of the clip: an ink landscape at dawn, a crane crossing it. The frame's own time uT moves the crane,
 * the sun and the wing beat. Denoising (uK): edges start soft and sharpen (coarse → fine), layers arrive in order
 * (sky and ridges first, the bird last), and the grain thins out. Every frame shares uK: they clear together.
 */
const FRAG = /* glsl */ `
uniform float uK;
uniform float uStep;
uniform float uT;
uniform float uSeed;
uniform float uHi;
uniform float uFade;
uniform float uDark;
uniform vec3 uPaper;
uniform vec3 uInk;
uniform vec3 uVerm;
uniform vec3 uMoss;
varying vec2 vUv;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return s;
}
float stroke(vec2 p, vec2 a, vec2 b, float w0, float w1, float soft) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  float d = length(pa - ba * h);
  float w = mix(w0, w1, h);
  return 1.0 - smoothstep(w - soft, w + soft, d);
}
/** A stroke that swells in the middle and tapers at both ends (a brush dab). */
float dab(vec2 p, vec2 a, vec2 b, float w, float soft) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  float d = length(pa - ba * h);
  // pow() of a negative base is NaN on the GPU, and sin(pi) lands just below zero past the dab's end
  float ww = w * pow(max(sin(h * 3.1416), 0.0), 0.6);
  return 1.0 - smoothstep(ww - soft, ww + soft, d);
}
/** A crane flying right: slim body, long neck, small head and beak, legs trailing, broad tapered wings. */
float crane(vec2 p, vec2 c, float fl, float soft) {
  vec2 q = (p - c) / 1.55;
  float b = 1.0 - smoothstep(0.011 - soft, 0.011 + soft, length(q * vec2(0.42, 1.4)));
  b = max(b, stroke(q, vec2(0.018, 0.003), vec2(0.074, 0.015), 0.0034, 0.0021, soft));
  b = max(b, 1.0 - smoothstep(0.0046 - soft, 0.0046 + soft, length((q - vec2(0.078, 0.016)) * vec2(0.8, 1.15))));
  b = max(b, stroke(q, vec2(0.081, 0.0155), vec2(0.1, 0.011), 0.0016, 0.0004, soft));
  b = max(b, stroke(q, vec2(-0.022, -0.003), vec2(-0.088, -0.013), 0.0015, 0.0009, soft));
  b = max(b, stroke(q, vec2(-0.02, -0.005), vec2(-0.083, -0.021), 0.0013, 0.0008, soft));
  b = max(b, stroke(q, vec2(-0.018, -0.001), vec2(-0.036, -0.006), 0.0055, 0.0018, soft));
  // the near wing: broad at the shoulder, tapering to a long tip; the far wing a little smaller and lighter
  vec2 sh = vec2(0.004, 0.003);
  vec2 ne = sh + vec2(-0.02, 0.028 + 0.03 * fl);
  vec2 nt = sh + vec2(-0.078, 0.048 + 0.076 * fl);
  b = max(b, stroke(q, sh, ne, 0.012, 0.0095, soft));
  b = max(b, stroke(q, ne, nt, 0.0095, 0.0014, soft));
  vec2 fs = vec2(0.0, 0.005);
  vec2 fe = fs + vec2(-0.013, 0.024 + 0.026 * fl);
  vec2 ft = fs + vec2(-0.052, 0.042 + 0.06 * fl);
  b = max(b, 0.7 * max(stroke(q, fs, fe, 0.009, 0.007, soft), stroke(q, fe, ft, 0.007, 0.0012, soft)));
  return b;
}
/** The red crown of the crane. */
float crown(vec2 p, vec2 c, float soft) {
  vec2 q = (p - c) / 1.55;
  return 1.0 - smoothstep(0.0022 - soft, 0.0022 + soft, length(q - vec2(0.077, 0.019)));
}

void main() {
  vec2 p = (vUv - 0.5) * vec2(1.7778, 1.0);
  vec2 qd = abs(p) - vec2(0.889 - 0.04, 0.5 - 0.04);
  float rr = length(max(qd, 0.0)) + min(max(qd.x, qd.y), 0.0) - 0.04;
  if (rr > 0.004) discard;
  float k = uK;
  float t = uT;
  float bl = mix(0.13, 0.0022, pow(k, 0.65));

  float aSky = smoothstep(0.0, 0.4, k);
  float aSun = smoothstep(0.02, 0.38, k);
  float aNear = smoothstep(0.12, 0.55, k);
  float aWater = smoothstep(0.32, 0.74, k);
  float aBird = smoothstep(0.42, 0.86, k);
  float aRefl = smoothstep(0.62, 0.97, k);

  vec3 col = uPaper;
  col = mix(col, uInk, 0.035 * vnoise(p * vec2(90.0, 14.0)) * (1.0 - uDark * 0.5));
  // a faint graded wash, darker near the top
  col = mix(col, uInk, 0.06 * smoothstep(-0.05, 0.55, p.y) * aSky);
  // the sun climbs a little through the clip
  vec2 sc = vec2(0.06, 0.1 + 0.08 * t);
  float sd = length(p - sc);
  col = mix(col, uVerm, uDark * 0.22 * exp(-sd * sd / 0.02) * aSun);
  // an ink-wash sun, not a sticker: a wobbly wet edge that bleeds a little, pigment pooled toward the lower rim,
  // a faint grain, and a strand of mist drawn across its lower half
  vec2 sv = (p - sc) / max(sd, 0.0001);
  float rad = 0.08 + 0.004 * (vnoise(sv * 2.0 + 5.0) - 0.5);
  float disc = 1.0 - smoothstep(rad - bl - 0.0025, rad + bl + 0.0025, sd);
  float halo = max(sd - rad, 0.0) / 0.018;
  float dens = 0.56 + 0.24 * smoothstep(0.05, -0.07, p.y - sc.y) + 0.12 * smoothstep(rad - 0.016, rad - 0.002, sd) + 0.08 * (vnoise((p - sc) * 46.0) - 0.5);
  float mist = smoothstep(0.016, 0.002, abs(p.y - sc.y + 0.034 - 0.005 * sin(p.x * 19.0 + 0.6))) * smoothstep(0.12, 0.0, abs(p.x - sc.x + 0.015));
  col = mix(col, uVerm, (disc * dens * (1.0 - 0.45 * mist) + 0.1 * exp(-halo * halo) * (1.0 - disc)) * aSun);
  // far ridges, sinking into mist
  float r1 = -0.06 + 0.17 * fbm(vec2(p.x * 1.6 + 4.1, 2.3)) + 0.05 * sin(p.x * 2.3 + 1.2);
  float far = smoothstep(bl, -bl, p.y - r1) * smoothstep(-0.24, r1 + 0.02, p.y);
  col = mix(col, uInk, far * 0.22 * aSky);
  // the near hill on the left, heavier ink at its crest
  float h1 = (p.x + 0.62) * 3.2;
  float h2 = (p.x + 0.38) * 5.0;
  float r2 = -0.2 + 0.2 * exp(-h1 * h1) + 0.1 * exp(-h2 * h2) + 0.035 * fbm(vec2(p.x * 5.0 + 9.0, 1.0));
  float near = smoothstep(bl, -bl, p.y - r2) * smoothstep(-0.24, r2, p.y);
  float crest = smoothstep(bl + 0.005, -bl, abs(p.y - r2) - 0.003) * step(p.y, r2 + 0.02) * smoothstep(-0.2, 0.0, p.y);
  col = mix(col, uInk, (near * 0.36 + crest * 0.34) * aNear);
  // water: a faint tint, broken ripple strokes, the sun's reflection
  float hz = -0.2;
  float water = smoothstep(hz + bl * 0.5, hz - bl * 0.5, p.y);
  col = mix(col, uInk, water * 0.035 * aWater);
  // ripples of different lengths and weights, tapered at both ends; spacing opens toward the viewer
  float rip = 0.0;
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float yy = hz - 0.026 - fi * 0.034 - fi * fi * 0.0035;
    float x0 = -0.84 + 1.1 * fract(fi * 0.613 + 0.23);
    float len = 0.1 + 0.32 * fract(fi * 0.371 + 0.5);
    float w = 0.0018 + 0.0032 * fract(fi * 0.53 + 0.1);
    rip = max(rip, dab(p, vec2(x0, yy), vec2(x0 + len, yy + 0.004 * (fract(fi * 0.29) - 0.5)), w, bl * 0.5 + 0.0016));
  }
  col = mix(col, uInk, rip * 0.3 * aWater);
  // the sun on the water: a column of broken horizontal streaks, widening and fading toward the viewer
  float dy = hz - p.y;
  float dx = (p.x - sc.x - 0.01 * sin(dy * 60.0)) / (0.045 + 0.35 * dy);
  float bands = smoothstep(0.35, 0.8, 0.5 + 0.5 * sin(dy * 210.0 + 2.2 * vnoise(vec2(p.x * 28.0, dy * 24.0))));
  float refl = exp(-dx * dx * 2.2) * smoothstep(0.004, 0.016, dy) * smoothstep(0.2, 0.03, dy) * bands;
  col = mix(col, uVerm, refl * 0.34 * aWater);
  // the crane: flies left → right through the clip, two and a half wing beats
  vec2 bc = vec2(mix(-0.62, 0.56, t), 0.05 + 0.09 * sin(t * 3.1416));
  float fl = sin(t * 6.2832 * 2.5);
  float bs = bl * 0.5 + 0.0012;
  col = mix(col, uInk, crane(p, bc, fl, bs) * 0.93 * aBird);
  col = mix(col, uVerm, crown(p, bc, bs) * 0.9 * aBird);
  vec2 rp = vec2(p.x + 0.005 * sin(p.y * 140.0), 2.0 * hz - p.y);
  col = mix(col, uInk, crane(rp, bc, fl, bs + 0.003) * 0.2 * water * aRefl);

  // the noise: soft grain caught in ink blots, re-seeded at every denoising step (mist, not TV static)
  float st = floor(uStep);
  vec2 off = vec2(uSeed * 13.1 + st * 7.3, uSeed * 3.3 + st * 3.7);
  float g = vnoise(vUv * vec2(270.0, 152.0) + off) * 0.62 + hash(floor(vUv * vec2(356.0, 200.0)) + off) * 0.38;
  float blot = smoothstep(0.3, 0.72, fbm(p * 5.0 + off * 0.11));
  float n = clamp((mix(g, blot, 0.5) - 0.5) * 1.45 + 0.5, 0.0, 1.0);
  vec3 ncol = mix(uPaper, uInk, n * 0.82);
  float tint = hash(floor(vUv * vec2(178.0, 100.0)) + 91.7 + st + uSeed);
  ncol = mix(ncol, uVerm, step(0.985, tint) * 0.6);
  ncol = mix(ncol, uMoss, step(tint, 0.015) * 0.5);
  // mid-way the grain sits in a soft mist rather than on the picture
  col = mix(col, uPaper, 0.22 * sin(k * 3.1416) * (1.0 - k));
  col = mix(col, ncol, 0.78 * pow(1.0 - k, 1.5));

  // the frame's edge: a thin ink line that warms to vermilion under the playhead
  float ring = 1.0 - smoothstep(0.0, 0.0035, abs(rr + 0.004));
  col = mix(col, mix(uInk, uVerm, uHi), ring * (0.32 + 0.5 * uHi));
  float alpha = (1.0 - smoothstep(-0.002, 0.003, rr)) * mix(0.8, 0.9, k) * uFade;
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}`

/** Raked sand around the block (a rock in a zen garden), with each frame's soft shadow. */
const GROUND_VERT = /* glsl */ `
varying vec2 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`
const GROUND_FRAG = /* glsl */ `
uniform vec3 uInk;
uniform vec3 uShadow;
uniform float uZ0;
uniform float uD;
uniform float uN;
uniform float uHalfW;
uniform float uFade;
varying vec2 vW;
void main() {
  vec2 g = vW;
  vec2 b = abs(g) - vec2(uHalfW + 0.12, uZ0 + 0.16);
  float d = length(max(b, 0.0)) + min(max(b.x, b.y), 0.0) - 0.14;
  float fade = 1.0 - smoothstep(0.35, 1.0, length(g / vec2(3.3 + uZ0 * 0.4, 2.6 + uZ0 * 0.6)));
  float ph = d * 7.5;
  float v = abs(fract(ph) - 0.5);
  float w = fwidth(ph);
  float rake = (1.0 - smoothstep(0.08, 0.08 + w * 1.5, v)) * step(0.0, d) * smoothstep(0.0, 0.08, d);
  float u = (g.y + uZ0) / max(uD, 0.001);
  float zi = clamp(floor(u + 0.5), 0.0, uN - 1.0) * uD - uZ0;
  float inX = smoothstep(uHalfW + 0.1, uHalfW - 0.3, abs(g.x));
  float sy = (g.y - zi) / 0.045;
  float sh = exp(-sy * sy) * inX;
  float body = smoothstep(0.3, -0.1, d) * 0.5;
  float a = (rake * 0.09 + sh * 0.16 + body * 0.08) * fade * uFade;
  gl_FragColor = vec4(mix(uInk, uShadow, clamp(sh + body, 0.0, 1.0)), a);
  #include <colorspace_fragment>
}`

/** Scene 1 — a stack of frames (a block of time) clears from noise together; drag to scrub the denoising. */
export function blockScene(ctx: SceneCtx) {
  const N = ctx.quality === 'low' ? 8 : 12
  const root = h('div', { class: 't08 t08b' })
  const host = h('div', { class: 't08b-stage', role: 'img', 'aria-label': B.art })
  const over = s('svg', { class: 't08b-over', 'aria-hidden': 'true' })
  const labFirst = h('span', { class: 't08b-lab', 'aria-hidden': 'true' }, B.first)
  const labLast = h('span', { class: 't08b-lab', 'aria-hidden': 'true' }, B.last)
  const labTime = h('span', { class: 't08b-lab t08b-time', 'aria-hidden': 'true' }, B.time)
  const range = h('input', { class: 'range t08b-range', type: 'range', min: 0, max: MAX, step: 1, value: 0, 'aria-label': B.slider }) as HTMLInputElement
  const count = h('span', { class: 't08b-count', 'aria-live': 'off' })
  const play = h('button', { class: 't08-btn t08b-play', type: 'button', hidden: true }, B.play)
  const controls = h('div', { class: 't08b-ctrl' }, range, count, play)
  const stageWrap = h('div', { class: 't08b-wrap' }, host, over, labFirst, labLast, labTime)
  root.append(stageWrap, controls)
  ctx.art.append(root)
  ctx.prompt(B.prompt)
  const stable = stableHeight(ctx, [[B.insight, B.detail]])

  const stage = createStage(host, { fov: 22 })
  if (!stage) {
    host.append(h('p', { class: 't08-nowebgl' }, B.noWebgl))
    ctx.complete()
    return
  }
  const { scene, camera, renderer } = stage
  renderer.setClearColor(0x000000, 0)

  const col = () => ({
    paper: new THREE.Color(cssVar('--card')),
    ink: new THREE.Color(cssVar('--ink')),
    verm: new THREE.Color(cssVar('--vermilion')),
    moss: new THREE.Color(cssVar('--moss')),
    dark: document.documentElement.dataset.theme === 'dark' ? 1 : 0,
  })
  let pal = col()
  const shared = {
    uK: { value: 0 },
    uStep: { value: 0 },
    uDark: { value: pal.dark },
    uPaper: { value: pal.paper },
    uInk: { value: pal.ink },
    uVerm: { value: pal.verm },
    uMoss: { value: pal.moss },
  }
  const geo = new THREE.PlaneGeometry(FW, FH)
  const frames = Array.from({ length: N }, (_, i) => {
    const u = { uT: { value: i / (N - 1) }, uSeed: { value: i * 1.37 + 0.5 }, uHi: { value: 0 }, uFade: { value: 1 } }
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { ...shared, ...u }, transparent: true, depthWrite: false, side: THREE.DoubleSide })
    const m = new THREE.Mesh(geo, mat)
    m.renderOrder = 10 + i
    scene.add(m)
    return { m, u }
  })
  const gu = {
    uInk: shared.uInk,
    uShadow: { value: new THREE.Color(cssVar('--umbra')) },
    uZ0: { value: 0 },
    uD: { value: GAP },
    uN: { value: N },
    uHalfW: { value: FW / 2 },
    uFade: { value: 1 },
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(12, 10), new THREE.ShaderMaterial({ vertexShader: GROUND_VERT, fragmentShader: GROUND_FRAG, uniforms: gu, transparent: true, depthWrite: false }))
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -FH / 2 - 0.16
  ground.renderOrder = 1
  scene.add(ground)
  // the block's four long edges, faint and dashed: the frames belong to one volume of time
  const edgeGeo = new THREE.BufferGeometry().setFromPoints([-1, 1].flatMap((sx) => [-1, 1].flatMap((sy) => [new THREE.Vector3((sx * FW) / 2, (sy * FH) / 2, -1), new THREE.Vector3((sx * FW) / 2, (sy * FH) / 2, 1)])))
  const edgeMat = new THREE.LineDashedMaterial({ color: pal.ink, transparent: true, opacity: 0.2, dashSize: 0.025, gapSize: 0.035, depthWrite: false })
  const edges = new THREE.LineSegments(edgeGeo, edgeMat)
  edges.computeLineDistances()
  edges.renderOrder = 5
  scene.add(edges)

  // ───────── state ─────────
  const st = { target: 0, k: 0, col: 0, px: 0, py: 0, tpx: 0, tpy: 0 }
  let done = false
  let collapsed = false
  let W = 1
  let H = 1
  let wide = true

  // ───────── camera fit: the whole block fits the stage, centred, at any aspect ─────────
  const corners = [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => new THREE.Vector3(x, y, z))))
  const tmp = new THREE.Vector3()
  const target = new THREE.Vector3()
  const dir = new THREE.Vector3()
  const right = new THREE.Vector3()
  const up = new THREE.Vector3()
  function place() {
    const c = st.col
    const az = (wide ? -0.66 : -0.5) * (1 - c) + st.px * 0.07 * (1 - c)
    const el = (wide ? 0.2 : 0.42) * (1 - c) + 0.03 * c + st.py * 0.04 * (1 - c)
    const z0 = ((N - 1) / 2) * GAP * (1 - c)
    dir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el))
    target.set(0, 0, 0)
    let dist = 6
    const tanH = Math.tan((camera.fov * Math.PI) / 360)
    const mx = wide ? 0.9 : 0.94
    const my = 0.84
    for (let it = 0; it < 5; it++) {
      camera.position.copy(target).addScaledVector(dir, dist)
      camera.lookAt(target)
      camera.updateMatrixWorld()
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
      for (const k of corners) {
        tmp.set((k.x * FW) / 2, (k.y * FH) / 2 + (k.y < 0 ? -0.12 : 0.04), k.z * (z0 + 0.02)).project(camera)
        x0 = Math.min(x0, tmp.x); x1 = Math.max(x1, tmp.x); y0 = Math.min(y0, tmp.y); y1 = Math.max(y1, tmp.y)
      }
      const need = Math.max((x1 - x0) / 2 / mx, (y1 - y0) / 2 / my)
      right.setFromMatrixColumn(camera.matrixWorld, 0)
      up.setFromMatrixColumn(camera.matrixWorld, 1)
      const hh = dist * tanH
      target.addScaledVector(right, ((x0 + x1) / 2) * hh * camera.aspect).addScaledVector(up, ((y0 + y1) / 2) * hh)
      dist *= need
    }
    camera.position.copy(target).addScaledVector(dir, dist)
    camera.lookAt(target)
    camera.updateMatrixWorld()
    // frames along the time axis: back (first) → front (last)
    frames.forEach(({ m }, i) => m.position.set(0, m.position.y, (i - (N - 1) / 2) * GAP * (1 - c)))
    edges.scale.set(1, 1, Math.max(0.0001, z0))
    edgeMat.opacity = 0.2 * (1 - c)
    gu.uZ0.value = z0
    gu.uD.value = GAP * (1 - c)
    placeLabels(z0)
  }

  const proj = (x: number, y: number, z: number): Pt => {
    tmp.set(x, y, z).project(camera)
    return [((tmp.x + 1) / 2) * W, ((1 - tmp.y) / 2) * H]
  }
  function placeLabels(z0: number) {
    if (W < 40 || H < 40) return
    const fade = String(Math.max(0, 1 - st.col * 2.5))
    const yb = -FH / 2 - 0.16
    const a = proj(-FW / 2 - 0.06, yb, -z0)
    const b = proj(-FW / 2 - 0.06, yb, z0 + 0.25)
    const pFirst = proj(-FW / 2, FH / 2, -z0)
    // tall: the back frames rise above the last one, so its name goes under its lowest corner
    let pLast = proj(FW / 2, FH / 2, z0)
    if (!wide) {
      const br = proj(FW / 2, -FH / 2, z0)
      const bl = proj(-FW / 2, -FH / 2, z0)
      pLast = [br[0], Math.max(br[1], bl[1])]
    }
    labLast.classList.toggle('under', !wide)
    // labels above a corner never rise out of the art box
    Object.assign(labFirst.style, { left: `${pFirst[0]}px`, top: `${Math.max(pFirst[1], 30)}px`, opacity: fade })
    Object.assign(labLast.style, { left: `${pLast[0]}px`, top: `${wide ? Math.max(pLast[1], 30) : pLast[1]}px`, opacity: fade })
    const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI
    const m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    Object.assign(labTime.style, { left: `${m[0]}px`, top: `${m[1]}px`, opacity: fade, transform: `translate(-50%, 4px) rotate(${ang.toFixed(1)}deg) translateY(10px)` })
    // the time arrow: one tapered brush stroke along the base, a small barb at its head
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    const ux = (b[0] - a[0]) / len
    const uy = (b[1] - a[1]) / len
    const w = Math.max(1.6, Math.min(3, W / 420))
    const head: Pt = b
    const barb: Pt = [head[0] - ux * 11 - uy * 6, head[1] - uy * 11 + ux * 6]
    over.setAttribute('viewBox', `0 0 ${W} ${H}`)
    over.replaceChildren(
      s('path', { class: 'k3', d: brush([a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 1], b], w, { a: 0.08, b: 0.12, min: 0.35 }), opacity: fade }),
      s('path', { class: 'k3', d: brush([barb, head], w * 0.9, { a: 0.1, b: 0.1, min: 0.4, straight: true }), opacity: fade }),
    )
  }

  // ───────── per frame ─────────
  let hiT = 0
  stage.onFrame((t, dt) => {
    const live = dt > 0
    // weighted: the picture eases toward the step the hand chose
    st.k = live ? st.k + (st.target - st.k) * (1 - Math.exp(-dt * 5)) : st.target
    if (Math.abs(st.k - st.target) < 0.0005) st.k = st.target
    st.px += (st.tpx - st.px) * (live ? 1 - Math.exp(-dt * 2.5) : 1)
    st.py += (st.tpy - st.py) * (live ? 1 - Math.exp(-dt * 2.5) : 1)
    shared.uK.value = st.k
    shared.uStep.value = Math.round(st.k * MAX)
    // once clear, a playhead walks the block: each frame lifts and warms in turn
    if (done && !ctx.reduced) hiT += dt
    const ph = ((hiT * 0.42) % 1.35) * (N - 1)
    frames.forEach(({ m, u }, i) => {
      const hi = done && !collapsed && !ctx.reduced ? Math.exp(-((i - ph) ** 2) / 0.9) * (1 - st.col) : 0
      u.uHi.value = hi
      m.position.y = hi * 0.06
      const last = i === N - 1
      u.uFade.value = last ? 1 : 1 - st.col
      if (last) u.uT.value = st.col > 0.98 && !ctx.reduced ? ((t * 0.24) % 1) : 1
    })
    place()
  })
  stage.onResize((w, hh) => {
    W = w
    H = hh
    place()
  })

  // ───────── layout: keep room for the insight that will come ─────────
  function size() {
    const full = ctx.art.clientHeight
    const hh = Math.max(160, stable.H(full))
    root.style.height = `${hh}px`
    // orientation comes from the art box, never from the stage (whose size depends on it)
    wide = ctx.art.clientWidth / hh > 1.15
    root.classList.toggle('tall', !wide)
    place()
  }
  const ro = new ResizeObserver(size)
  ro.observe(ctx.art)
  size()
  stable.afterFonts(size)

  // ───────── interaction ─────────
  function setStep(n: number, from?: 'range') {
    n = clamp(Math.round(n), 0, MAX)
    st.target = n / MAX
    if (from !== 'range') range.value = String(n)
    range.style.setProperty('--fill', `${(n / MAX) * 100}%`)
    count.textContent = fill(B.step, { n, max: MAX })
    stage!.render()
    if (n === MAX && !done) finish()
  }
  function finish() {
    done = true
    ctx.chime('ok')
    play.hidden = false
    if (!ctx.reduced) gsap.fromTo(play, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', delay: 0.6 })
    ctx.insight(B.insight, B.detail)
  }
  range.addEventListener('input', () => setStep(Number(range.value), 'range'))
  setStep(0)

  let drag: { x: number; v: number; id: number } | null = null
  host.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, v: Number(range.value), id: e.pointerId }
    host.setPointerCapture(e.pointerId)
    host.classList.add('dragging')
  })
  host.addEventListener('pointermove', (e) => {
    const r = host.getBoundingClientRect()
    if (!ctx.reduced) {
      st.tpx = ((e.clientX - r.left) / r.width - 0.5) * 2
      st.tpy = ((e.clientY - r.top) / r.height - 0.5) * 2
    }
    if (!drag || e.pointerId !== drag.id) return
    setStep(drag.v + ((e.clientX - drag.x) / Math.max(240, r.width * 0.6)) * MAX)
  })
  const end = () => {
    drag = null
    host.classList.remove('dragging')
  }
  host.addEventListener('pointerup', end)
  host.addEventListener('pointercancel', end)
  host.addEventListener('pointerleave', () => ((st.tpx = 0), (st.tpy = 0)))

  // collapse the block into one frame that plays: the block IS the video
  let colTween: gsap.core.Tween | null = null
  play.addEventListener('click', () => {
    collapsed = !collapsed
    play.textContent = collapsed ? B.unplay : B.play
    colTween?.kill()
    if (ctx.reduced) {
      st.col = collapsed ? 1 : 0
      stage!.render()
    } else colTween = gsap.to(st, { col: collapsed ? 1 : 0, duration: 1.8, ease: 'power3.inOut' })
    ctx.chime('soft')
  })

  onTheme(ctx, () => {
    pal = col()
    shared.uPaper.value = pal.paper
    shared.uInk.value = pal.ink
    shared.uVerm.value = pal.verm
    shared.uMoss.value = pal.moss
    shared.uDark.value = pal.dark
    gu.uShadow.value = new THREE.Color(cssVar('--umbra'))
    edgeMat.color = pal.ink
    stage!.render()
  })

  if (!ctx.reduced) gsap.from(host, { opacity: 0, scale: 0.96, duration: 1.6, ease: 'power3.out', delay: 0.15 })

  return () => {
    colTween?.kill()
    ro.disconnect()
    geo.dispose()
    edgeGeo.dispose()
    stage.dispose()
  }
}
