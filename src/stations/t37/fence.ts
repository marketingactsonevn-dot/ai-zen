import './fence.css'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { fill, h } from '../../core/dom'
import { onPrefs } from '../../core/prefs'
import { onSize, rng, stableHeight } from '../../ui/part2/ink'
import { inkGlsl, inkStage, type InkKit, type InkLamp } from '../../ui/part2/stage3d'
import type { SceneCtx } from '../types'
import { C } from './shell'
import { fenceFlat } from './fence-flat'
import { guide, type Mark } from '../../ui/part2/guide'
import { GAP, HOLES, LEAK, RR, YAW0, ang, lineThrough } from './fence-plan'

/**
 * Scene 3 ★ — the Swiss-cheese model in real depth (art direction §4 t37 `fence`, §5.3 budget). A sapling on a moss mound
 * in a garden of raked rings under the setting moon (west); six bundles of bamboo wait on the near sand, the next one
 * warm. Tap it: a yotsume-gaki ring rises out of the sand round the sapling, its two rails come down and tie on, and the
 * fireflies fly in again from the dark: each ring stops some (they strike the bamboo, flare and hover just outside),
 * never all (LEAK). Every ring is holed in three places of its own (fence-plan.ts); orbit the garden and, where the holes
 * of every standing ring line up toward you, a red thread runs from the edge to the sapling. One ring: three such lines.
 * Six: one narrow slit. The rake on the sand takes them all down. Labels are DOM on the posts (k.label); in a tall frame
 * the newest layer's card sits in a panel below. No WebGL: the flat painting (fence-flat.ts).
 */

const K = C.scenes.fence
const N = K.layers.length
const FLIES = 20
/** post spacing along a ring, and the post / rail heights (metres) */
const STEP = 0.27
const POST_H = 0.74
const RAILS = [0.3, 0.56]
/**
 * Each ring carries its name on a tall flag post (FAR[k]); the posts are fanned round the far half, left and right in
 * turn and closer to the back as the rings grow, so the names spread like a fan over the garden instead of stacking on
 * the sapling, each on a short leader up and out from its post top. The newest layer's card is a paper tag hung in the
 * frame's top-right corner, clear of the disc (a tall frame: the panel under the garden). CARD: the raised near post.
 */
const D2R = Math.PI / 180
const CARD = YAW0 + 62 * D2R
const FAR = [-78, 78, -50, 50, -22, 22].map((d) => YAW0 + Math.PI + d * D2R)
/** does slip k hang left of its post (it stands on the left half of the first view) */
const LEFT = FAR.map((a) => Math.sin(a - YAW0) < 0)
const T: [number, number, number] = [0, 0.3, 0.3]

const FRAG_HEAD = /* glsl */ `
${inkGlsl.noise}
${inkGlsl.haze}
`
const VERT = /* glsl */ `
varying vec3 vW;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`
/** the rings' soft ink shadows (swept away from the moon, broken at the holes) and the bundles' contact shadows */
const SHADOW_FRAG = /* glsl */ `
${FRAG_HEAD}
uniform vec3 uC;
uniform float uK;
uniform float uG[6];
uniform float uR[6];
uniform vec4 uH[6];
uniform vec4 uB[6];
uniform vec2 uSh;
varying vec3 vW;
float holes(vec2 q, int i) {
  float a = atan(q.x, q.y);
  vec4 hh = uH[i];
  float m = 1.0;
  for (int j = 0; j < 3; j++) {
    float d = abs(atan(sin(a - hh[j]), cos(a - hh[j])));
    m *= smoothstep(hh.w * 0.75, hh.w * 1.2, d);
  }
  return m;
}
void main() {
  vec2 p = vW.xz;
  float s = 0.0;
  for (int i = 0; i < 6; i++) {
    if (uG[i] < 0.002) continue;
    for (int j = 0; j < SAMPLES; j++) {
      float t = float(j) / float(SAMPLES - 1);
      vec2 q = p - uSh * t * uG[i];
      float w = 0.035 + 0.13 * t;
      float b = (1.0 - smoothstep(w * 0.35, w, abs(length(q) - uR[i]))) * (1.0 - 0.55 * t);
      s = max(s, b * holes(q, i) * uG[i]);
    }
  }
  for (int i = 0; i < 6; i++) {
    vec4 b = uB[i];
    if (b.w < 0.01) continue;
    vec2 q = p - b.xy - uSh * 0.12;
    vec2 tq = vec2(cos(b.z) * q.x - sin(b.z) * q.y, sin(b.z) * q.x + cos(b.z) * q.y);
    s = max(s, (1.0 - smoothstep(0.35, 1.0, length(tq / vec2(0.78, 0.22)))) * 0.85 * b.w);
  }
  s *= 0.78 + 0.22 * n2(p * 5.0);
  gl_FragColor = vec4(uC, s * uK * (1.0 - hazeK(vW)));
  #include <colorspace_fragment>
}`
/** mist standing round the garden: drawn back-faced, so only the far side of the band ever shows */
const MIST_FRAG = /* glsl */ `
${FRAG_HEAD}
uniform vec3 uMistC;
uniform float uK, uSeed, uFoot;
varying vec3 vW;
varying vec2 vUv;
void main() {
  float a = atan(vW.z, vW.x);
  // long streaks lying along the horizon, thickest low down
  float n = fbm2(vec2(a * 10.0 + uTime * 0.012 + uSeed, vW.y * 3.2 - uSeed));
  // nothing where the band meets the sand (no hard ellipse at the rim), thickest a little above it
  float prof = smoothstep(uFoot, uFoot + 0.22, vUv.y) * (1.0 - smoothstep(0.32, 0.92, vUv.y));
  gl_FragColor = vec4(uMistC, prof * smoothstep(0.3, 0.75, n) * uK);
  #include <colorspace_fragment>
}`
/** the red thread through the holes: a hard core and a soft halo, fading at its far end */
const THREAD_FRAG = /* glsl */ `
${FRAG_HEAD}
uniform vec3 uC;
uniform float uK;
varying vec3 vW;
varying vec2 vUv;
varying float vH;
void main() {
  float a = mix(1.0, 0.2, vH) * (1.0 - smoothstep(0.82, 1.0, vUv.y)) * smoothstep(0.0, 0.03, vUv.y);
  gl_FragColor = vec4(haze(uC, vW), a * uK);
  #include <colorspace_fragment>
}`
const THREAD_VERT = /* glsl */ `
attribute float aH;
varying vec3 vW;
varying vec2 vUv;
varying float vH;
void main() {
  vUv = uv;
  vH = aH;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`
const FLY_VERT = /* glsl */ `
uniform float uPx;
attribute float aK;
varying float vK;
void main() {
  vK = aK;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  // a glowing sprite about 10 px across with its halo, swelling to twice that in the flash of a strike
  gl_PointSize = clamp(uPx * 0.42 * (0.75 + 0.45 * min(aK, 2.5)) / -mv.z, uPx * 0.02, uPx * 0.075);
}`
const FLY_FRAG = /* glsl */ `
uniform vec3 uC, uCore;
uniform float uK;
varying float vK;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float core = 1.0 - smoothstep(0.1, 0.26, d);
  float halo = exp(-d * d * 5.5) * 0.8;
  float flash = clamp(vK - 1.0, 0.0, 1.5);
  float a = clamp(vK, 0.0, 1.0) * max(core, halo * (0.75 + 0.5 * flash)) * uK;
  gl_FragColor = vec4(mix(uC, uCore, max(core, flash * 0.6 * halo)), a);
  #include <colorspace_fragment>
}`

const easeOut = (u: number) => 1 - (1 - u) ** 3
const easeBack = (u: number) => 1 + 2.2 * (u - 1) ** 3 + 1.2 * (u - 1) ** 2 // a small overshoot as a post seats

type Post = { a: number; h: number; w: number }
/** the posts of ring k: evenly between its holes, the two framing each hole heavier, one tall flag post */
function postsOf(k: number): { posts: Post[]; far: number; near: number; arcs: [number, number][] } {
  const r = rng(3700 + k * 7)
  const R = RR[k], hw = GAP / R
  const hs = HOLES[k].slice().sort((a, b) => a - b)
  const posts: Post[] = []
  const arcs: [number, number][] = []
  for (let i = 0; i < 3; i++) {
    const a0 = hs[i] + hw, a1 = (i < 2 ? hs[i + 1] : hs[0] + Math.PI * 2) - hw
    arcs.push([a0, a1])
    const n = Math.max(1, Math.round(((a1 - a0) * R) / STEP))
    for (let j = 0; j <= n; j++) {
      const edge = j === 0 || j === n
      posts.push({ a: a0 + ((a1 - a0) * j) / n + (edge ? 0 : (r() - 0.5) * 0.25 / n), h: POST_H * (edge ? 1.12 : 0.94 + r() * 0.1), w: edge ? 1.45 : 0.9 + r() * 0.2 })
    }
  }
  const nearest = (fa: number) => posts.reduce((b, p, i) => (ang(p.a, fa) < ang(posts[b].a, fa) ? i : b), 0)
  const far = nearest(FAR[k]), near = nearest(CARD)
  for (const f of [far, near]) (posts[f].h = POST_H * 1.42), (posts[f].w = 1.6)
  return { posts, far, near, arcs }
}

export function fenceScene(ctx: SceneCtx) {
  const tall = ctx.art.clientHeight > ctx.art.clientWidth * 1.05
  const stable = stableHeight(ctx, [K.insight])
  const host = h('div', { class: 't37f-stage' })
  const panel = h('div', { class: 't37f-panel', 'aria-live': 'polite' })
  const cardEl = h('div', { class: 't37f-card', 'aria-live': 'polite' })
  const status = h('p', { class: 'visually-hidden' })
  const root = h('div', { class: `t37f${tall ? ' tall' : ''}` }, host, panel, cardEl, status)
  ctx.art.append(root)
  ctx.onCleanup(onSize(ctx.art, () => void (root.style.height = `${Math.max(240, stable(ctx.art.clientHeight))}px`)))
  ctx.prompt(fill(K.prompt, { n: 0, total: K.layers.length }))
  // H5 per step; after the sixth layer a faint arrow for the hidden gesture (walking round), gone once aligned
  const g = guide(ctx)
  let turnMark: Mark | null = null
  /** H1 on the next bundle: a vermilion dot riding a 3D point over it (k.label), so it stays on it as you walk round */
  let nextAt: THREE.Object3D | null = null
  let nextDot: HTMLElement | null = null

  // ── colours of our own materials, read on mount and on every theme change (registered before the first yield)
  const cs = () => getComputedStyle(document.documentElement)
  const col = { verm: new THREE.Color(), core: new THREE.Color(), umbra: new THREE.Color(), mist: new THREE.Color(), moss: new THREE.Color() }
  const tone = { shadow: { value: 0.5 }, mist: { value: 0.5 }, fly: { value: 1 }, moss: 0 }
  let mossGlow: THREE.Mesh | null = null
  let flyPts: THREE.Points | null = null
  let moonDisc: THREE.Object3D | null = null
  const readCol = () => {
    const c = cs()
    // (THREE.Color reads #rrggbb, not the #rrggbbaa some tokens carry)
    const v = (n: string) => (c.getPropertyValue(n).trim() || '#888').replace(/^(#[0-9a-f]{6})[0-9a-f]{2}$/i, '$1')
    const dark = document.documentElement.dataset.theme === 'dark'
    col.verm.setStyle(v('--vermilion'), THREE.SRGBColorSpace)
    col.core.copy(col.verm).lerp(new THREE.Color().setStyle(v('--lantern'), THREE.SRGBColorSpace), dark ? 0.7 : 0.25)
    col.umbra.setStyle(dark ? v('--umbra') : v('--wash'), THREE.SRGBColorSpace)
    col.mist.setStyle(v('--mist'), THREE.SRGBColorSpace)
    tone.shadow.value = dark ? 0.62 : 0.3
    tone.mist.value = (parseFloat(v('--mist-a')) || 0.5) * (dark ? 1.9 : 0.62)
    tone.fly.value = dark ? 1 : 0.95
    if (flyPts) (flyPts.material as THREE.ShaderMaterial).blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending
    // the moss glow is a night thing (--glow-moss has no alpha by day)
    const g = v('--glow-moss').match(/rgba?\(([^)]+)\)/)?.[1].split(/[\s,/]+/).map(Number) ?? [0, 0, 0, 0]
    col.moss.setRGB(g[0] / 255, g[1] / 255, g[2] / 255, THREE.SRGBColorSpace)
    tone.moss = Math.max((g[3] ?? 1) * 2.2, 0.3)
    if (mossGlow) (mossGlow.material as THREE.ShaderMaterial).uniforms.uK.value = tone.moss
  }
  readCol()
  let kit: InkKit | null = null
  ctx.onCleanup(onPrefs(() => (readCol(), kit?.render())))

  // ── state
  let built = 0
  let told = false
  type Ring = { g: THREE.Group; posts: THREE.Group; rails: THREE.Group; far: THREE.Mesh; near: THREE.Mesh; slip: HTMLElement | null; card: HTMLElement | null }
  const rings: Ring[] = []
  type Bundle = { g: THREE.Group; btn: HTMLButtonElement; at: [number, number, number] }
  const bundles: Bundle[] = []
  let lamp: InkLamp | null = null
  let lampGlow: THREE.Mesh | null = null
  let rakeBtn: HTMLButtonElement | null = null
  let groundMesh: THREE.Mesh | null = null
  /** bumped by reset: a ring still rising stops where it is */
  let gen = 0
  let flyDirty = true
  /** the backdrop's ink ranges: seen from high up only their feet show, smudged, at the top of the frame, so they fade in as you look low */
  const ranges: THREE.IUniform[] = []
  const rangeK = new Map<THREE.IUniform, { base: number; last: number }>()
  let countTag: HTMLElement | null = null
  let leakTag: HTMLElement | null = null
  const shadowU = {
    uG: { value: new Array(6).fill(0) as number[] },
    uR: { value: RR.slice() },
    uH: { value: HOLES.map((hs, k) => new THREE.Vector4(hs[0], hs[1], hs[2], GAP / RR[k])) },
    uB: { value: Array.from({ length: 6 }, () => new THREE.Vector4()) },
    uSh: { value: new THREE.Vector2() },
  }
  // fireflies: positions written on the CPU each drawn frame (20 points)
  const flyPos = new Float32Array(FLIES * 3)
  const flyK = new Float32Array(FLIES)
  let flyGeo: THREE.BufferGeometry | null = null
  type Plan = { from: THREE.Vector3; via: THREE.Vector3; to: THREE.Vector3; rest: THREE.Vector3; hit: boolean; delay: number; dur: number }
  const plans: Plan[] = Array.from({ length: FLIES }, () => ({ from: new THREE.Vector3(), via: new THREE.Vector3(), to: new THREE.Vector3(), rest: new THREE.Vector3(), hit: false, delay: 0, dur: 1 }))
  let waveT = 99
  let waveEnd = 0
  const leaves: THREE.Vector3[] = []
  // the red thread
  let thread: THREE.Mesh | null = null
  const threadK = { value: 0 }
  let threadWant = 0
  let threadAt = NaN
  let threadRun = false

  const label = (k: InkKit, obj: THREE.Object3D, el: HTMLElement, off?: [number, number, number]) => (obj.updateWorldMatrix(true, false), k.label(obj, el, off))

  /** where every firefly flies this wave, for `b` rings standing (LEAK decides who gets through) */
  function plan(b: number, fresh: boolean) {
    const r = rng(1777 + b * 13)
    // the lines still open through every ring: the ones that get through come in along them
    const open: number[] = []
    if (b) for (let i = 0; i < 720; i++) {
      const a = lineThrough((i / 720) * Math.PI * 2, b)
      if (!Number.isNaN(a) && !open.some((o) => ang(o, a) < 0.05)) open.push(a)
    }
    let longest = 0
    plans.forEach((p, i) => {
      let a = i * 2.39996 + 0.4
      const passes = i < LEAK[b]
      if (passes) {
        if (open.length) a = open[i % open.length] + (r() - 0.5) * 0.05
        const leaf = leaves[i % leaves.length]
        const u = r() * Math.PI * 2
        p.rest.set(leaf.x + Math.cos(u) * 0.09, leaf.y + 0.03 + r() * 0.05, leaf.z + Math.sin(u) * 0.09)
        p.to.copy(p.rest)
        p.via.set(Math.sin(a) * 0.9, 0.5 + r() * 0.2, Math.cos(a) * 0.9)
        p.hit = false
      } else {
        let m = 0
        while (i < LEAK[m + 1]) m++
        // it strikes bamboo, not a hole
        while (HOLES[m].some((hh) => ang(hh, a) < (GAP / RR[m]) * 1.6)) a += 0.21
        const y = 0.3 + r() * 0.3
        p.to.set(Math.sin(a) * (RR[m] + 0.05), y, Math.cos(a) * (RR[m] + 0.05))
        const out = RR[m] + 0.22 + (i % 3) * 0.08
        p.rest.set(Math.sin(a + 0.04) * out, 0.32 + (i % 4) * 0.13, Math.cos(a + 0.04) * out)
        p.via.set(Math.sin(a + 0.25) * (RR[m] + 1.3), y + 0.35, Math.cos(a + 0.25) * (RR[m] + 1.3))
        p.hit = true
      }
      const R0 = 6.4 + r() * 0.8
      p.from.set(Math.sin(a - 0.3) * R0, 0.8 + r() * 0.9, Math.cos(a - 0.3) * R0)
      p.delay = fresh ? r() * 1.0 : 0
      p.dur = 1.5 + r() * 0.45
      longest = Math.max(longest, p.delay + p.dur + (p.hit ? 0.85 : 0))
    })
    waveEnd = longest
  }
  const v = new THREE.Vector3()
  /** firefly i at wave time t (and its brightness), written into the buffers */
  function flyAt(i: number, t: number, now: number, live: boolean) {
    const p = plans[i]
    const u = Math.min(1, Math.max(0, (t - p.delay) / p.dur))
    let k: number
    if (t < p.delay) (v.copy(p.from), (k = 0))
    else if (u < 1) {
      // a quadratic arc in, with a wandering sideways flutter
      const e = u * u * (3 - 2 * u)
      const a = (1 - e) * (1 - e), b = 2 * e * (1 - e), c = e * e
      v.set(p.from.x * a + p.via.x * b + p.to.x * c, p.from.y * a + p.via.y * b + p.to.y * c, p.from.z * a + p.via.z * b + p.to.z * c)
      v.y += Math.sin(u * 9 + i) * 0.06 * (1 - u)
      k = Math.min(1, u * 4) * 0.9
    } else if (p.hit) {
      // struck the bamboo: a flare, then it backs off to hover just outside
      const s = t - p.delay - p.dur
      const back = easeOut(Math.min(1, Math.max(0, (s - 0.2) / 0.6)))
      v.lerpVectors(p.to, p.rest, back)
      k = 0.85 + 2.2 * Math.exp(-s * 7)
    } else (v.copy(p.rest), (k = 0.95))
    if (live && t >= waveEnd) {
      v.y += Math.sin(now * 0.9 + i * 1.7) * 0.025
      v.x += Math.sin(now * 0.53 + i) * 0.02
      k *= 0.82 + 0.18 * Math.sin(now * 1.6 + i * 2.3)
    }
    flyPos[i * 3] = v.x
    flyPos[i * 3 + 1] = v.y
    flyPos[i * 3 + 2] = v.z
    flyK[i] = k
  }

  /** fly a new wave in (low / reduced: they are simply where the wave would leave them) */
  function wave(k: InkKit, fresh = true) {
    plan(built, fresh)
    flyDirty = true
    if (k.low || ctx.reduced) {
      waveT = waveEnd
      return k.render()
    }
    waveT = 0
    k.animate((dt) => (waveT += dt) < waveEnd)
  }

  /** the next bundle glows warm; used ones are gone (from the scene, the raycast and the Tab order) */
  function syncBundles() {
    const nl = K.layers[built]
    bundles.forEach((b, i) => {
      const used = i < built
      b.g.visible = !used
      b.g.traverse((o) => o.layers.set(used ? 1 : 0))
      // only the next bundle is in the Tab order (any bundle still builds the next layer when tapped)
      b.btn.hidden = i !== built
      if (nl) b.btn.setAttribute('aria-label', fill(K.addAria, { name: nl.name }))
      shadowU.uB.value[i].w = used ? 0 : 1
    })
    const nb = bundles[built]
    if (lamp && nb) {
      lamp.obj.position.set(nb.at[0], 0.55, nb.at[2])
      lampGlow?.position.set(nb.at[0], 0.32, nb.at[2])
    }
    lampGlow && (lampGlow.visible = !!nb)
    lamp?.set(nb ? 0.95 : 0)
    if (rakeBtn) rakeBtn.hidden = built === 0
    if (nextAt && nb) (nextAt.position.set(nb.at[0], 0.42, nb.at[2]), nextAt.updateWorldMatrix(true, false))
    // a tall frame: closer on the sapling while the garden is bare, stepping back ring by ring until all six fill it
    if (tall) kit?.dolly([0.72, 0.76, 0.82, 0.87, 0.92, 0.97, 1][built])
    nextDot?.classList.toggle('off', !nb)
    if (countTag) countTag.querySelector('span')!.textContent = fill(K.count, { n: built })
    if (leakTag) leakTag.querySelector('.n')!.textContent = fill(K.leak, { n: LEAK[built] })
  }

  const nameOf = (i: number) => h('p', { class: 't37f-name' }, h('span', { class: 't37f-no' }, String(i + 1)), h('span', { class: 't37f-nm' }, K.layers[i].name))
  /** ring i's name slip on its flag post, out on a short leader (a tall frame has no room: just its number) */
  const slipOf = (k: InkKit, i: number) => {
    // up and outward, a little longer for the outer rings so the papers step back like a fan
    const dx = (LEFT[i] ? -1 : 1) * (tall ? 10 + i * 2 : 16 + i * 5), dy = -(tall ? 14 + i * 3 : 22 + i * 6)
    const lead = h('i', { class: 't37f-lead', style: `width:${Math.hypot(dx, dy).toFixed(1)}px;transform:rotate(${((Math.atan2(dy, dx) * 180) / Math.PI).toFixed(1)}deg)` })
    const paper = h('div', { class: 't37f-paper', style: `--dx:${dx}px;--dy:${dy}px` }, tall ? h('p', { class: 't37f-name' }, h('span', { class: 't37f-no' }, String(i + 1))) : nameOf(i))
    return label(k, rings[i].far, h('div', { class: `t37f-tag${LEFT[i] ? ' left' : ''}${tall ? ' num' : ''}`, 'aria-hidden': 'true' }, lead, paper), [0, 0.04, 0])
  }
  /** ring i is the newest: its card unrolls on the near post (or in the panel of a tall frame); the one before rolls up */
  function tagOf(k: InkKit, i: number) {
    const L = K.layers[i]
    const more = h('div', { class: 't37f-more' },
      h('p', { class: 't37f-what' }, L.what),
      ...(L.fact ? [ctx.fact(L.fact, 'p', 't37f-fact')] : []),
      ...(L.station ? [h('a', { class: 't37f-link', href: `#/tram/${L.station}` }, fill(K.seeStation, { n: L.station }))] : []))
    const prev = rings[i - 1]
    if (prev?.card) {
      prev.card.remove()
      prev.card = null
    }
    // only the newest ring's slip keeps its name; the older ones keep their number
    prev?.slip?.classList.remove('newest')
    if (tall) {
      panel.replaceChildren(h('p', { class: 't37f-pcount' }, fill(K.count, { n: i + 1 })), nameOf(i), more)
      rings[i].slip ??= slipOf(k, i)
      // lift the garden into the height the panel leaves free (the whole stage slides; labels ride with it)
      root.classList.add('lifted')
    } else {
      cardEl.replaceChildren(h('div', { class: 't37f-tag new' }, h('div', { class: 't37f-paper' }, nameOf(i), more)))
      rings[i].slip ??= slipOf(k, i)
      rings[i].slip?.classList.add('newest')
    }
  }

  function build1(k: InkKit) {
    if (built >= N) return
    const i = built++
    const rg = rings[i]
    rg.g.visible = true
    syncBundles()
    status.textContent = `${fill(K.count, { n: built })}. ${fill(K.leak, { n: LEAK[built] })}. ${K.layers[i].name}: ${K.layers[i].what}`
    // posts rise out of the sand, then the rails come down and are tied on
    let t = 0
    const dur = k.low ? 0.5 : 1.15
    const post = k.low ? easeOut : easeBack
    const g0 = gen
    k.animate((dt) => {
      if (g0 !== gen) return false
      t = Math.min(dur, t + dt)
      const u = t / dur
      rg.posts.position.y = -1 + post(Math.min(1, u / 0.7))
      rg.rails.position.y = 0.6 * (1 - easeOut(Math.max(0, (u - 0.55) / 0.45)))
      rg.rails.visible = u > 0.55
      shadowU.uG.value[i] = easeOut(Math.min(1, u / 0.7))
      if (u >= 1) tagOf(k, i)
      return u < 1
    })
    wave(k)
    // the insight waits for the "aha": the one gap through all six, found by walking round (audit 37-3)
    if (built < N) ctx.prompt(fill(K.prompt, { n: built, total: N }))
    else if (threadWant) found()
    else if (!told) {
      ctx.prompt(K.walk)
      turnMark ??= g.gesture('drag-h', () => [host.clientWidth / 2, host.clientHeight * 0.86], { r: 56 })
    }
  }
  /** all six up and the gap seen through them: name it, then the insight */
  function found() {
    if (told) return
    told = true
    turnMark?.done()
    turnMark = null
    ctx.prompt(K.aligned, 'ok')
    const t = window.setTimeout(() => {
      root.classList.add('told')
      ctx.insight(K.insight, K.detail)
    }, ctx.reduced ? 0 : 1600)
    ctx.onCleanup(() => clearTimeout(t))
  }

  function reset(k: InkKit) {
    if (!built) return
    const was = built
    built = 0
    gen++
    rings.forEach((rg) => (rg.slip?.remove(), rg.card?.remove(), (rg.slip = rg.card = null)))
    root.classList.remove('told')
    panel.replaceChildren()
    cardEl.replaceChildren()
    root.classList.remove('lifted')
    syncBundles()
    status.textContent = `${fill(K.count, { n: 0 })}. ${fill(K.leak, { n: LEAK[0] })}`
    let t = 0
    const dur = k.low ? 0.4 : 0.9
    k.animate((dt) => {
      t = Math.min(dur, t + dt)
      const e = easeOut(t / dur)
      for (let i = 0; i < was; i++) {
        rings[i].posts.position.y = -e
        rings[i].rails.position.y = -e
        shadowU.uG.value[i] = 1 - e
      }
      if (t >= dur) for (let i = 0; i < was; i++) rings[i].g.visible = false
      return t < dur
    })
    wave(k)
  }

  // ── the 3D garden
  // a tall frame: 48° down (0.71 + the kit's 0.13), pulled back so the bundles and the rake stay in, and the garden
  // lifted into the height the panel leaves free
  const view = { yaw: YAW0, pitch: tall ? 0.71 : 0.56, yawRange: [-1e4, 1e4] as [number, number], pitchRange: [0.31, 1.08] as [number, number], fit: (tall ? [9.4, 4.5] : [4.9, 2.75]) as [number, number], target: T, shift: tall ? 0.02 : 0.05, zoomRange: [0.6, 1.3] as [number, number] }
  inkStage(ctx, host, { label: K.aria, hint: K.hint, fov: 30, gyro: true, dpr: [1.75, 1.25], view, fallback: (el) => fenceFlat(ctx, el) }, function* (k) {
    kit = k
    const low = k.low
    // the moon is setting in the west, low: long shadows thrown east, a cold rim on the west faces
    k.uniforms.uKey.value.set(-0.8, 0.42, -0.3).normalize()
    const bd = k.backdrop({ moon: [-0.66, 0.1, -0.74], seed: 37, mist: 0 })
    bd.traverse((o) => (o as THREE.Mesh).geometry?.type === 'CylinderGeometry' && ranges.push(((o as THREE.Mesh).material as THREE.ShaderMaterial).uniforms.uK))
    // the setting moon itself: the garden is seen from high up, so the sky is above the frame. Its disc is hung low in the
    // west just past the sand's far edge, in the haze at the top of the first view, and painted over the far mist
    // (shortcut: drawn without depth test, fine while nothing stands out there; the rim light keeps the true direction)
    bd.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined
      if (!m?.uniforms?.uDisc) return
      m.uniforms.uSize.value.set(tall ? 7 : 8.5, tall ? 7 : 8.5)
      m.depthTest = false
      o.renderOrder = 5
      moonDisc = o
    })
    const key = k.uniforms.uKey.value as THREE.Vector3
    shadowU.uSh.value.set(-key.x, -key.z).normalize().multiplyScalar(Math.min(2.2, Math.sqrt(1 - key.y * key.y) / key.y) * POST_H * 0.9)
    yield
    // a wide sand, so the top of a high view is sand melting into the haze (the ranges show only when you look low)
    groundMesh = k.ground({ r: 11 })
    // mist round the garden, back faces only: it hangs beyond the far fences from wherever you stand
    for (const [R, hh, y, sd] of (low ? [[8.6, 2.4, 0.9, 3]] : [[8.6, 2.4, 0.9, 3], [6.9, 1.1, 0.4, 9]]) as number[][]) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(R, R, hh, 72, 1, true), new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: MIST_FRAG, defines: { OCT: low ? 2 : 4 }, transparent: true, depthWrite: false, side: THREE.BackSide,
        uniforms: { ...k.uniforms, uMistC: { value: col.mist }, uK: tone.mist, uSeed: { value: sd }, uFoot: { value: (hh / 2 - y) / hh } },
      }))
      m.position.y = y
      m.renderOrder = 6
      m.raycast = () => {}
      k.root.add(m)
    }
    yield

    // the mound and the sapling: a young maple, three limbs, clumps of new leaves (where the fireflies that get through land)
    // (far stones first: the kit rakes rings in build order, and the mound's rings are widened over the whole garden)
    k.rock({ at: [-4.7, 1.0], w: 0.95, h: 0.62, seed: 3713, moss: 0.6 })
    k.rock({ at: [-5.2, 0.2], w: 0.5, h: 0.32, seed: 3714, moss: 0.4 })
    k.rock({ at: [0, 0], w: 1.25, h: 0.3, d: 1.1, seed: 3711, moss: 0.95, rotY: 0.4 })
    const sap = new THREE.Group()
    // the hero: about twice the size it was (audit 37-3), crown well above the first ring's rails
    const SAP = tall ? 2.35 : 1.9
    sap.position.set(0.04, 0.2, -0.02)
    sap.scale.setScalar(SAP)
    k.root.add(sap)
    const wood: THREE.BufferGeometry[] = []
    const limb = (from: THREE.Vector3, to: THREE.Vector3, r0: number, r1: number) => {
      const d = to.clone().sub(from)
      const g = new THREE.CylinderGeometry(r1, r0, d.length(), 6, 3)
      g.translate(0, d.length() / 2, 0)
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()))
      g.translate(from.x, from.y, from.z)
      wood.push(g)
    }
    const P = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
    limb(P(0, -0.1, 0), P(0.03, 0.45, 0), 0.034, 0.024)
    limb(P(0.03, 0.45, 0), P(-0.02, 0.86, 0.02), 0.024, 0.012)
    limb(P(0.02, 0.38, 0), P(-0.3, 0.6, 0.06), 0.014, 0.006)
    limb(P(0.02, 0.52, 0), P(0.32, 0.72, -0.05), 0.013, 0.006)
    limb(P(0, 0.64, 0.01), P(-0.12, 0.8, -0.2), 0.011, 0.005)
    k.mesh(mergeGeometries(wood)!, k.ink('bark', { rim: 1.3 }), { parent: sap, cast: true })
    wood.forEach((g) => g.dispose())
    const r = rng(377)
    const clumps: THREE.BufferGeometry[] = []
    ;[[-0.3, 0.62, 0.06, 0.15], [0.32, 0.74, -0.05, 0.14], [-0.02, 0.9, 0.02, 0.17], [-0.13, 0.82, -0.2, 0.12], [0.12, 0.66, 0.16, 0.1], [-0.18, 0.5, 0.1, 0.09]].forEach(([x, y, z, s]) => {
      const g = new THREE.IcosahedronGeometry(1, low ? 1 : 2)
      const p = g.attributes.position as THREE.BufferAttribute
      for (let j = 0; j < p.count; j++) {
        const q = 1 + (r() - 0.5) * 0.28
        p.setXYZ(j, p.getX(j) * s * q, p.getY(j) * s * 0.62 * q, p.getZ(j) * s * q)
      }
      g.computeVertexNormals()
      g.translate(x, y, z)
      clumps.push(g)
      leaves.push(new THREE.Vector3(x * SAP + sap.position.x, (y + s * 0.4) * SAP + sap.position.y, z * SAP + sap.position.z))
    })
    k.mesh(mergeGeometries(clumps)!, k.ink('moss', { moss: 1, rim: 1.6 }), { parent: sap })
    clumps.forEach((g) => g.dispose())
    // single leaves standing out of the clumps' edges: the crown reads as leaves, not as balls
    {
      // a five-lobed maple leaf: tips (long on top, short at the foot) and the notches between them
      const tip = [1, 0.86, 0.62, 0.62, 0.86], shape = new THREE.Shape()
      for (let j = 0; j < 10; j++) {
        const a = Math.PI / 2 + (j / 10) * Math.PI * 2, R = j % 2 ? 0.4 : tip[j / 2]
        shape[j ? 'lineTo' : 'moveTo'](Math.cos(a) * R, Math.sin(a) * R)
      }
      const leaf = new THREE.ShapeGeometry(shape, 1)
      const lv: THREE.BufferGeometry[] = []
      const q = new THREE.Quaternion(), e = new THREE.Euler(), n = new THREE.Vector3()
      ;[[-0.3, 0.62, 0.06, 0.15], [0.32, 0.74, -0.05, 0.14], [-0.02, 0.9, 0.02, 0.17], [-0.13, 0.82, -0.2, 0.12], [0.12, 0.66, 0.16, 0.1], [-0.18, 0.5, 0.1, 0.09]].forEach(([x, y, z, sz]) => {
        for (let j = 0; j < (low ? 6 : 11); j++) {
          const th = r() * Math.PI * 2, ph = (r() - 0.25) * 1.3
          n.set(Math.cos(th) * Math.cos(ph), Math.sin(ph) * 0.62, Math.sin(th) * Math.cos(ph))
          const g = leaf.clone().scale(sz * 0.36, sz * 0.36, 1)
          e.set(r() * 0.8 - 0.4, th + Math.PI / 2, r() * Math.PI)
          g.applyQuaternion(q.setFromEuler(e))
          g.translate(x + n.x * sz * 1.02, y + n.y * sz, z + n.z * sz * 1.02)
          lv.push(g)
        }
      })
      leaf.dispose()
      k.mesh(mergeGeometries(lv)!, k.ink('moss', { moss: 1, rim: 2.2, double: true }), { parent: sap })
      lv.forEach((g) => g.dispose())
    }
    mossGlow = k.glow([0, 0.5, 0], 2.4, col.moss, tone.moss)
    readCol()
    yield

    // six rings, hidden in the sand until built: posts in one mesh, rails in another (one slice each)
    const cane = new THREE.CylinderGeometry(0.021, 0.025, 1, low ? 5 : 6, 1, false)
    cane.translate(0, 0.5, 0)
    const node = new THREE.CylinderGeometry(0.03, 0.03, 0.018, low ? 5 : 6, 1, true)
    const foot = new THREE.CylinderGeometry(0.034, 0.075, 0.05, low ? 6 : 8, 1, false)
    foot.translate(0, 0.012, 0)
    const tiny = new THREE.BoxGeometry(0.01, 0.01, 0.01)
    const hidden = new THREE.MeshBasicMaterial()
    for (let i = 0; i < N; i++) {
      const { posts, far, near, arcs } = postsOf(i)
      const R = RR[i]
      const parts: THREE.BufferGeometry[] = []
      for (const p of posts) {
        const x = Math.sin(p.a) * R, z = Math.cos(p.a) * R
        parts.push(cane.clone().scale(p.w, p.h, p.w).translate(x, -0.02, z), foot.clone().scale(p.w, 1, p.w).translate(x, 0, z))
        if (!low) for (const y of [0.34, 0.68]) parts.push(node.clone().scale(p.w, 1, p.w).translate(x, p.h * y, z))
      }
      const g = new THREE.Group()
      g.visible = false
      k.root.add(g)
      const pg = new THREE.Group()
      pg.position.y = -1
      g.add(pg)
      k.mesh(mergeGeometries(parts)!, k.ink('bamboo', { rim: 2.6, edge: 0.8 }), { parent: pg })
      parts.forEach((x) => x.dispose())
      const [farM, nearM] = [far, near].map((f) => {
        const m = new THREE.Mesh(tiny, hidden)
        m.position.set(Math.sin(posts[f].a) * R, posts[f].h, Math.cos(posts[f].a) * R)
        m.visible = false
        pg.add(m)
        return m
      })
      yield
      // two rails along each arc, on the outer face of the posts, reaching a little into the hole
      const rails: THREE.BufferGeometry[] = []
      const segTotal = low ? 48 : 96
      for (const [a0, a1] of arcs)
        for (const y of RAILS) {
          const e0 = a0 - 0.05 / R, e1 = a1 + 0.05 / R
          const n = Math.max(3, Math.round((e1 - e0) / 0.22))
          const pts = Array.from({ length: n + 1 }, (_, j) => {
            const a = e0 + ((e1 - e0) * j) / n
            return new THREE.Vector3(Math.sin(a) * (R + 0.036), y, Math.cos(a) * (R + 0.036))
          })
          rails.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(4, Math.round((segTotal * (e1 - e0)) / (Math.PI * 2))), 0.016, low ? 4 : 5, false))
        }
      const rgp = new THREE.Group()
      rgp.visible = false
      rgp.position.y = 0.6
      g.add(rgp)
      k.mesh(mergeGeometries(rails)!, k.ink('bamboo', { rim: 2, edge: 0.7 }), { parent: rgp })
      rails.forEach((x) => x.dispose())
      rings.push({ g, posts: pg, rails: rgp, far: farM, near: nearM, slip: null, card: null })
      yield
    }
    cane.dispose()
    node.dispose()
    foot.dispose()

    // the shadow decal under the rings and the bundles
    const sh = new THREE.Mesh(new THREE.CircleGeometry(5.6, 96), new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: SHADOW_FRAG, defines: { OCT: low ? 2 : 4, SAMPLES: low ? 2 : 3 }, transparent: true, depthWrite: false,
      uniforms: { ...k.uniforms, ...shadowU, uC: { value: col.umbra }, uK: tone.shadow },
    }))
    sh.rotation.x = -Math.PI / 2
    sh.position.y = 0.006
    sh.renderOrder = -3
    sh.raycast = () => {}
    k.root.add(sh)

    // six bundles of bamboo on the near sand, tied with straw; the next one glows warm
    const bundleGeo = (() => {
      const g: THREE.BufferGeometry[] = []
      const rr = rng(3790)
      const off = [[0, 0], ...Array.from({ length: 6 }, (_, j) => [Math.cos((j / 6) * Math.PI * 2) * 0.072, Math.sin((j / 6) * Math.PI * 2) * 0.072])]
      for (const [y, z] of off) {
        const L = 1.25 + (rr() - 0.5) * 0.18
        const c = new THREE.CylinderGeometry(0.031, 0.033, L, low ? 5 : 7, 1, false)
        c.rotateZ(Math.PI / 2)
        c.translate((rr() - 0.5) * 0.1, 0.11 + y, z)
        g.push(c)
      }
      for (const x of [-0.36, 0.34]) {
        const t = new THREE.TorusGeometry(0.112, 0.02, 5, low ? 10 : 14)
        t.rotateY(Math.PI / 2)
        t.translate(x, 0.11, 0)
        g.push(t)
      }
      const m = mergeGeometries(g)!
      g.forEach((x) => x.dispose())
      return m
    })()
    for (let i = 0; i < N; i++) {
      // (a tall frame: further round toward you, so the pile is in the narrow view)
      const a = YAW0 + (tall ? 20 + i * 8 : 40 + i * 8) * (Math.PI / 180)
      const R = (tall ? 4.25 : 4.5) + (i % 2) * 0.3
      const x = Math.sin(a) * R, z = Math.cos(a) * R
      const g = new THREE.Group()
      g.position.set(x, 0, z)
      g.rotation.y = a - Math.PI / 2 + (i % 2 ? 0.1 : -0.08)
      k.root.add(g)
      k.mesh(bundleGeo, k.ink('bamboo', { rim: 1.2, moss: 0.15 }), { parent: g, outline: !low })
      const btn = k.tappable(g, fill(K.addAria, { name: K.layers[0].name }), () => i >= built && build1(k))
      bundles.push({ g, btn, at: [x, 0, z] })
      shadowU.uB.value[i].set(x, z, g.rotation.y, 1)
    }
    lamp = k.lamp([bundles[0].at[0], 0.55, bundles[0].at[2]], { tint: '--lantern', k: 0.95, halo: 0 })
    lampGlow = k.glow([bundles[0].at[0], 0.32, bundles[0].at[2]], 1.3, 'lantern', 0.7)
    yield

    // the rake lying at the sand's edge: tap it and every fence sinks back into the sand
    const rake = (() => {
      const g: THREE.BufferGeometry[] = []
      const hnd = new THREE.CylinderGeometry(0.017, 0.02, 1.7, 6)
      hnd.rotateZ(Math.PI / 2)
      hnd.translate(0, 0.05, 0)
      g.push(hnd)
      const head = new THREE.BoxGeometry(0.06, 0.06, 0.56)
      head.translate(0.86, 0.07, 0)
      g.push(head)
      for (let j = 0; j < 8; j++) {
        const t = new THREE.BoxGeometry(0.11, 0.022, 0.022)
        t.translate(0.93, 0.05, -0.24 + j * 0.068)
        g.push(t)
      }
      const m = mergeGeometries(g.map((x) => x.toNonIndexed()))!
      g.forEach((x) => x.dispose())
      return m
    })()
    const ra = YAW0 - 58 * (Math.PI / 180)
    const rakeG = new THREE.Group()
    rakeG.position.set(Math.sin(ra) * 4.5, 0, Math.cos(ra) * 4.5)
    rakeG.rotation.y = ra + 1.15
    k.root.add(rakeG)
    k.mesh(rake, k.ink('bark', { rim: 1.2 }), { parent: rakeG, cast: true })
    rakeBtn = k.tappable(rakeG, K.reset, () => reset(k))
    rakeBtn.hidden = true

    // a stone lantern far back on the left: the garden's one other warm light
    k.toro({ at: [Math.sin(YAW0 + 1.78) * 5.3, Math.cos(YAW0 + 1.78) * 5.3], h: 1.35, lit: 0.85 })
    yield

    // the fireflies and the thread
    flyGeo = new THREE.BufferGeometry()
    flyGeo.setAttribute('position', new THREE.BufferAttribute(flyPos, 3).setUsage(THREE.DynamicDrawUsage))
    flyGeo.setAttribute('aK', new THREE.BufferAttribute(flyK, 1).setUsage(THREE.DynamicDrawUsage))
    const flyU = { uPx: { value: 600 }, uC: { value: col.verm }, uCore: { value: col.core }, uK: tone.fly }
    const pts = (flyPts = new THREE.Points(flyGeo, new THREE.ShaderMaterial({ vertexShader: FLY_VERT, fragmentShader: FLY_FRAG, transparent: true, depthWrite: false, uniforms: flyU })))
    pts.frustumCulled = false
    pts.renderOrder = 7
    pts.raycast = () => {}
    k.root.add(pts)
    const core = new THREE.CylinderGeometry(0.011, 0.011, 1, 5, 1, true)
    const halo = new THREE.CylinderGeometry(0.05, 0.05, 1, 7, 1, true)
    const tag = (g: THREE.BufferGeometry, v0: number) => g.setAttribute('aH', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(v0), 1))
    tag(core, 0)
    tag(halo, 1)
    const tg = mergeGeometries([core, halo])!
    core.dispose()
    halo.dispose()
    // lie it along +z from the sapling (uv.y runs 0 at the tree … 1 at the far end)
    tg.translate(0, 0.5, 0)
    tg.rotateX(Math.PI / 2)
    thread = new THREE.Mesh(tg, new THREE.ShaderMaterial({ vertexShader: THREAD_VERT, fragmentShader: THREAD_FRAG, defines: { OCT: 2 }, transparent: true, depthWrite: false, uniforms: { ...k.uniforms, uC: { value: col.verm }, uK: threadK } }))
    thread.position.set(0.03, 0.62, 0)
    thread.scale.set(1, 1, 6.4)
    thread.visible = false
    thread.renderOrder = 8
    thread.raycast = () => {}
    k.root.add(thread)

    // labels: the count on the bundles, what still gets through on the sapling
    const pile = new THREE.Mesh(tiny, hidden)
    pile.position.set(Math.sin(YAW0 + 1.05) * 4.75, 0.95, Math.cos(YAW0 + 1.05) * 4.75)
    pile.visible = false
    k.root.add(pile)
    if (!tall) countTag = label(k, pile, h('p', { class: 't37f-count', 'aria-hidden': 'true' }, h('span', null, fill(K.count, { n: 0 }))))
    // what the sapling and the sparks stand for, and what still gets through: one block in the frame's corner (a 3D
    // anchor on the sand left the frame as the camera came closer)
    leakTag = h('div', { class: 't37f-under' }, h('p', { class: 't37f-legend' }, K.legend), h('p', { class: 't37f-leak' }, h('span', { class: 'n' }, fill(K.leak, { n: LEAK[0] })), ' ', ctx.tag('illustration')))
    root.append(leakTag)

    nextAt = new THREE.Mesh(tiny, hidden)
    nextAt.visible = false
    k.root.add(nextAt)
    nextDot = label(k, nextAt, h('i', { class: 't37f-dot', 'aria-hidden': 'true' }))
    plan(0, true)
    syncBundles()

    // every drawn frame: the fireflies, the haze following the camera's distance, and the thread when the holes line up
    let moonSet = false
    let lastAz = NaN
    k.onFrame((now) => {
      const cam = k.stage?.camera
      if (!cam) return
      // once, when the camera first stands at the first view: hang the moon's disc low in the west, in the haze at the
      // top left of the frame, 20 m out along that sightline (it stays there in the world as you orbit)
      if (!moonSet && moonDisc && cam.position.lengthSq() > 1) {
        moonSet = true
        const dir = new THREE.Vector3(tall ? -0.5 : -0.5, tall ? 0.8 : 0.5, 0.5).unproject(cam).sub(cam.position).normalize()
        moonDisc.position.copy(cam.position).addScaledVector(dir, 20)
      }
      const live = k.live
      if (waveT < waveEnd || live || flyDirty) {
        for (let i = 0; i < FLIES; i++) flyAt(i, waveT, now, live)
        flyGeo!.attributes.position.needsUpdate = true
        flyGeo!.attributes.aK.needsUpdate = true
        flyDirty = waveT < waveEnd
      }
      const d = Math.hypot(cam.position.x - T[0], cam.position.y - T[1], cam.position.z - T[2])
      k.uniforms.uFog.value.set(d * 0.74, d * 2.05)
      const low = Math.min(1, Math.max(0, (0.6 - Math.asin((cam.position.y - T[1]) / d)) / 0.26))
      for (const u of ranges) {
        let r = rangeK.get(u)
        if (!r || u.value !== r.last) rangeK.set(u, (r = { base: u.value, last: 0 }))
        r.last = u.value = r.base * low * low
      }
      const az = Math.atan2(cam.position.x - T[0], cam.position.z - T[2])
      // reduced motion draws one frame per input, and the kit places the camera after these callbacks: while the view
      // is still moving, ask for one more frame so the check below sees where the input left it
      if (ctx.reduced && az !== lastAz) k.render()
      lastAz = az
      const a = lineThrough(az, built)
      const want = Number.isNaN(a) ? 0 : 1
      if (want && a !== threadAt) {
        threadAt = a
        thread!.rotation.y = a
      }
      if (want !== threadWant) {
        threadWant = want
        if (want) {
          status.textContent = K.aligned
          if (built === N) {
            ctx.chime('soft')
            found()
          }
        }
        if (!threadRun) {
          threadRun = true
          k.animate((dt) => {
            threadK.value += (threadWant ? 1 : -1) * dt / (threadWant ? 0.35 : 0.25)
            threadK.value = Math.min(1, Math.max(0, threadK.value))
            thread!.visible = threadK.value > 0.001
            threadRun = threadWant ? threadK.value < 1 : threadK.value > 0
            return threadRun
          })
        }
      }
    })
    // the first wave: they come in from the dark to the bare sapling
    wave(k)
  }).ready.then((k) => {
    if (!k?.stage) return
    kit = k
    const st = k.stage
    // the first draw meets a dozen programs at once (three's onFirstUse reads each one back from the GPU): one long
    // task at CPU 4×. They are compiled before it (compileAsync), so the draw is spread under the fade-in instead, a
    // fifth of the garden more each frame (as t28/gardeners.ts)
    const parts = k.root.children.slice(), N = 5, was = new Map<THREE.Object3D, boolean>()
    let reveal = -1
    st.onFrame(() => {
      if (reveal >= N) return
      if (reveal < 0) {
        if (st.renderer.info.render.frame) return void (reveal = N) // already drawn (a resize / theme redraw)
        const progs = st.renderer.info.programs
        if (!progs?.length || progs.some((p) => !(p as unknown as { isReady(): boolean }).isReady())) return
        parts.forEach((o, i) => i % N && (was.set(o, o.visible), (o.visible = false)))
        reveal = 1
      } else {
        parts.forEach((o, i) => i % N === reveal && (o.visible = was.get(o) ?? true))
        reveal++
      }
      st.render()
    })
    // the sand rakes in rings round the mound all the way out (the kit rakes only a band round each stone)
    const rg = (groundMesh?.material as THREE.ShaderMaterial | undefined)?.uniforms.uRings.value as THREE.Vector4[] | undefined
    const c = rg?.find((q) => Math.hypot(q.x, q.y) < 0.3 && q.w > 0)
    if (c) c.w = 7
    const u = (flyPts?.material as THREE.ShaderMaterial | undefined)?.uniforms
    const px = () => u && (u.uPx.value = (st.height * st.renderer.getPixelRatio()) / (2 * Math.tan((st.camera.fov * Math.PI) / 360)))
    px()

    st.onResize(px)
    k.render()
  })
}
