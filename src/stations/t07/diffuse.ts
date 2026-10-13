import * as THREE from 'three'
import { fill, h, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import { createStage } from '../../core/three-stage'
import type { SceneCtx } from '../types'
import { brush, ell, onSize, stableHeight, watchTheme, type Pt } from './ink'
import { paintCanvas, palette } from './paint'
import { C } from './data'

const D = C.scenes.diffuse
const STEPS = 50

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`

// x_t = mix(mid, x0̂, √ᾱ) + √(1-ᾱ)·ε — the model's guess x0̂ starts as a blurry blob (high mip level) and sharpens.
// ε is ink on paper: big wash clouds, smaller swirls, a fine grain and a few dark specks, never coloured static.
const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uTex;
uniform float uS;
uniform float uT;
uniform float uGrain;
uniform vec3 uPaper;
uniform vec3 uInk;
varying vec2 vUv;
float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { float a = 0.5, r = 0.0; for (int i = 0; i < 4; i++) { r += a * vnoise(p); p = p * 2.03 + 1.7; a *= 0.5; } return r; }
void main() {
  float t = 1.0 - uS;
  float ab = cos(t * 1.5707963); ab *= ab;
  vec3 x0 = textureLod(uTex, vUv, 7.0 * pow(t, 0.7)).rgb;
  vec2 dr = vec2(uT * 0.012, -uT * 0.008);
  float cloud = fbm(vUv * 2.4 + dr) - 0.5;
  float wisp = fbm(vUv * 7.5 - dr * 1.7 + 3.1) - 0.5;
  vec2 px = floor(vUv * uGrain);
  float grain = hash(px) + hash(px + 17.17) - 1.0;
  // specks are soft round ink dots inside their cell, not square dead pixels
  vec2 sc = vUv * uGrain * 0.42;
  float speck = step(0.9975, hash(floor(sc) + 5.3)) * smoothstep(0.48, 0.18, length(fract(sc) - 0.5));
  float e = cloud * 1.6 + wisp * 0.7 + grain * 0.42 - speck * 1.3;
  vec3 col = mix(mix(uPaper, uInk, 0.3), x0, sqrt(ab)) + sqrt(1.0 - ab) * e * (uPaper - uInk) * 0.56;
  gl_FragColor = vec4(clamp(col, min(uPaper, uInk), max(uPaper, uInk)), 1.0);
}`

function rgb(css: string): THREE.Vector3 {
  const c = document.createElement('canvas')
  c.width = c.height = 1
  const x = c.getContext('2d')!
  x.fillStyle = css
  x.fillRect(0, 0, 1, 1)
  const [r, g, b] = x.getImageData(0, 0, 1, 1).data
  return new THREE.Vector3(r / 255, g / 255, b / 255)
}

const PLAY = 'M8 5.5v13l10.5-6.5z'
const AGAIN = 'M18.4 9.2A7 7 0 1 0 19 13M19.2 4.6v4.8h-4.8'

/** Scene 1 — pure noise on a hanging scroll; the slider removes it step by step, guided by the words on the strip. */
export function diffuseScene(ctx: SceneCtx) {
  const st = { s: 0 }
  let cur = 0
  let insightShown = false
  const finished = new Set<number>()

  // ── DOM ──
  const gl = h('div', { class: 't7d-gl', role: 'img', 'aria-label': fill(D.canvas, { prompt: D.prompts[0].text }) })
  const deco = s('svg', { class: 't7d-deco', 'aria-hidden': 'true' })
  const same = h('p', { class: 't7d-same', 'aria-live': 'polite' })
  const kake = h('div', { class: 't7d-kake' }, deco, h('div', { class: 't7d-silk', 'aria-hidden': 'true' }, h('i'), h('i')), gl, same)

  // the words hang beside the scroll on a paper tag; the other prompts, the note and the ends wake after the first move
  const ptext = h('span', { class: 't7d-ptext' }, D.prompts[0].text)
  const chips = D.prompts.map((p, i) =>
    h('button', { class: 't7d-chip', type: 'button', 'aria-pressed': String(i === 0), onClick: () => choose(i) }, p.short))
  const strip = h('p', { class: 't7d-strip' }, h('span', { class: 'visually-hidden' }, `${D.promptLabel}: `), h('span', { class: 't7d-seal', 'aria-hidden': 'true' }), ptext)
  const chipBox = h('div', { class: 't7d-chips t7d-later', role: 'group', 'aria-label': D.pick, inert: '' }, ...chips)
  const note = h('p', { class: 't7d-note t7d-later' }, D.note)

  const range = h('input', { class: 't7d-range', type: 'range', min: 0, max: STEPS, step: 1, value: 0, 'aria-label': D.slider, 'aria-valuetext': fill(D.stepOf, { n: 0 }) })
  const readout = h('span', { class: 't7d-step', 'aria-hidden': 'true' }, fill(D.stepOf, { n: 0 }))
  const trackBase = s('path', { class: 't7d-tb' })
  const trackFill = s('path', { class: 't7d-tf' })
  const ticks = s('g', { class: 't7d-ticks' })
  const trackSvg = s('svg', { class: 't7d-tsvg', viewBox: '0 0 300 24', preserveAspectRatio: 'none', 'aria-hidden': 'true' }, trackBase, s('g', { class: 't7d-tfill' }, trackFill), ticks)
  const icoPath = s('path', { d: PLAY })
  const play = h('button', { class: 't7d-play', type: 'button', 'aria-label': D.play, onClick: () => run() },
    s('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, icoPath))
  const ends = [h('span', { class: 't7d-later' }, D.noise), readout, h('span', { class: 't7d-later' }, D.image)]
  const ctrl = h('div', { class: 't7d-ctrl' }, play,
    h('div', { class: 't7d-track' },
      h('div', { class: 't7d-rail' }, trackSvg, range),
      h('div', { class: 't7d-ends' }, ...ends)))
  const later = [chipBox, note, ends[0], ends[2]]

  const root = h('div', { class: 't7 t7d' }, strip, kake, chipBox, note, ctrl)
  ctx.art.append(root)
  ctx.prompt(D.prompt)

  // brush track: thick wet start (noise) thinning to a clean line (image)
  trackBase.setAttribute('d', brush([[4, 12], [150, 12.4], [296, 11.8]], 7, { a: 0.02, b: 0.5, min: 0.25, wob: 0.15 }).d)
  trackFill.setAttribute('d', brush([[4, 12], [150, 12.4], [296, 11.8]], 7, { a: 0.02, b: 0.5, min: 0.25, wob: 0.15 }).d)
  for (let k = 0; k <= 5; k++) ticks.append(s('path', { d: ell(6 + k * 57.6, 21.5, 1.3, 1) }))

  // ── WebGL ──
  const U = {
    uTex: { value: null as THREE.Texture | null },
    uS: { value: 0 },
    uT: { value: 0 },
    uGrain: { value: 160 },
    uPaper: { value: new THREE.Vector3(1, 1, 1) },
    uInk: { value: new THREE.Vector3(0, 0, 0) },
  }
  const stage = createStage(gl, { animate: false })
  const tex: (THREE.CanvasTexture | undefined)[] = []
  let fallback: { cv: HTMLCanvasElement; noise: HTMLCanvasElement; img?: HTMLCanvasElement } | null = null
  const canvases: (HTMLCanvasElement | undefined)[] = []
  let gen = 0

  if (stage) {
    U.uTex.value = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1)
    U.uTex.value.needsUpdate = true
    const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: FRAG, depthTest: false })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat)
    mesh.frustumCulled = false
    stage.scene.add(mesh)
    stage.onResize((w, hh) => (U.uGrain.value = Math.max(90, Math.min(w, hh) / (ctx.quality === 'low' ? 1.8 : 1.3))))
  } else {
    // no WebGL: the same idea in 2D — the picture fades up through a grain layer
    const cv = h('canvas', { class: 'stage-canvas' })
    const noise = h('canvas')
    noise.width = noise.height = 160
    const nx = noise.getContext('2d')!
    const id = nx.createImageData(160, 160)
    for (let i = 0; i < id.data.length; i += 4) {
      const v = 70 + Math.random() * 120
      id.data.set([v, v * 0.98, v * 0.95, 255], i)
    }
    nx.putImageData(id, 0, 0)
    gl.append(cv)
    fallback = { cv, noise }
  }

  function colors() {
    U.uPaper.value = rgb(getComputedStyle(root).getPropertyValue('--card').trim() || '#fff')
    U.uInk.value = rgb(getComputedStyle(root).getPropertyValue('--ink').trim() || '#000')
  }

  function useImage(i: number) {
    const c = canvases[i]
    if (!c) return
    if (stage) {
      let t = tex[i]
      if (!t) {
        t = tex[i] = new THREE.CanvasTexture(c)
        t.generateMipmaps = true
        t.minFilter = THREE.LinearMipmapLinearFilter
      }
      U.uTex.value = t
    } else if (fallback) fallback.img = c
    draw()
  }

  /** (Re)paint all three pictures for the current palette; the shown one first. */
  async function paintAll() {
    const my = ++gen
    const pal = palette(root)
    tex.forEach((t) => t?.dispose())
    tex.length = 0
    const order = [cur, ...[0, 1, 2].filter((i) => i !== cur)]
    for (const i of order) {
      try {
        const c = await paintCanvas(i, pal, ctx.quality === 'low' ? 512 : 1024)
        if (my !== gen) return
        canvases[i] = c
        if (i === cur) useImage(i)
      } catch (e) {
        console.error(e)
      }
    }
  }

  function draw() {
    U.uS.value = st.s
    if (stage) stage.render()
    else if (fallback) {
      const { cv, noise, img } = fallback
      const w = gl.clientWidth
      if (!w) return
      if (cv.width !== w) cv.width = cv.height = w
      const x = cv.getContext('2d')!
      x.imageSmoothingEnabled = false
      x.globalAlpha = 1
      x.drawImage(noise, 0, 0, w, w)
      if (img) {
        x.imageSmoothingEnabled = true
        x.globalAlpha = st.s ** 1.6
        x.drawImage(img, 0, 0, w, w)
      }
    }
  }

  function sync(writeRange = true) {
    const n = Math.round(st.s * STEPS)
    if (writeRange) range.value = String(n)
    const shown = Number(range.value)
    readout.textContent = fill(D.stepOf, { n: shown })
    range.setAttribute('aria-valuetext', fill(D.stepOf, { n: shown }))
    ;(trackSvg.querySelector('.t7d-tfill') as SVGGElement).style.clipPath = `inset(0 ${(100 - (st.s * 100)).toFixed(2)}% 0 0)`
    icoPath.setAttribute('d', st.s > 0.995 ? AGAIN : PLAY)
    play.setAttribute('aria-label', st.s > 0.995 ? D.replay : D.play)
    draw()
    if (st.s > 0.995) reached()
  }

  let woke = false
  function wake() {
    if (woke) return
    woke = true
    chipBox.removeAttribute('inert')
    root.classList.add('woke')
    if (!ctx.reduced) ctx.anim(() => gsap.fromTo(later, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 1, stagger: 0.12, delay: 0.3, ease: 'power3.out' }))
  }

  function reached() {
    if (finished.has(cur)) return
    finished.add(cur)
    if (!insightShown) {
      insightShown = true
      ctx.insight(D.insight, D.detail)
      ctx.chime('soft')
    }
    if (finished.size >= 2 && !same.textContent) {
      same.textContent = D.same
      if (!ctx.reduced) ctx.anim(() => gsap.fromTo(same, { opacity: 0, y: 6, filter: 'blur(4px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.2, ease: 'power3.out' }))
    }
  }

  let tl: gsap.core.Timeline | null = null
  const stop = () => {
    tl?.kill()
    tl = null
  }

  function run() {
    stop()
    wake()
    if (ctx.reduced) {
      st.s = 1
      return sync()
    }
    ctx.anim(() => {
      tl = gsap.timeline({ onComplete: () => void (tl = null) })
      if (st.s > 0.995) tl.to(st, { s: 0, duration: 0.9, ease: 'power2.in', onUpdate: sync })
      tl.to(st, { s: 1, duration: 0.6 + 3.4 * (st.s > 0.995 ? 1 : 1 - st.s), ease: 'power1.inOut', onUpdate: sync })
    })
  }

  function choose(i: number) {
    if (i === cur) return
    cur = i
    chips.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)))
    gl.setAttribute('aria-label', fill(D.canvas, { prompt: D.prompts[i].text }))
    stop()
    if (ctx.reduced) {
      ptext.textContent = D.prompts[i].text
      finished.delete(i)
      useImage(i)
      return sync()
    }
    ctx.anim(() => {
      gsap.to(ptext, { opacity: 0, filter: 'blur(4px)', duration: 0.3, onComplete: () => void (ptext.textContent = D.prompts[i].text) })
      gsap.to(ptext, { opacity: 1, filter: 'blur(0px)', duration: 0.7, delay: 0.32, ease: 'power2.out' })
      // back into the same noise, swap the words, then clear again
      tl = gsap.timeline({ onComplete: () => void (tl = null) })
      tl.to(st, { s: 0, duration: 0.25 + 0.8 * st.s, ease: 'power2.in', onUpdate: sync })
        .call(() => {
          finished.delete(i)
          useImage(i)
        })
        .to(st, { s: 1, duration: 3.6, ease: 'power1.inOut', onUpdate: sync }, '+=0.15')
    })
    ctx.chime('soft')
  }

  range.addEventListener('input', () => {
    stop()
    wake()
    const target = Number(range.value) / STEPS
    if (ctx.reduced) {
      st.s = target
      return sync(false)
    }
    ctx.anim(() => gsap.to(st, { s: target, duration: 0.35, ease: 'power2.out', overwrite: true, onUpdate: () => sync(false) }))
  })

  // mist drifts slowly while noise remains (paused at rest, under reduced motion and on the light setting)
  if (stage && !ctx.reduced && ctx.quality === 'high') {
    const drift = () => {
      if (st.s > 0.995 || !root.isConnected) return
      U.uT.value = performance.now() / 1000
      stage.render()
    }
    gsap.ticker.add(drift)
    ctx.onCleanup(() => gsap.ticker.remove(drift))
  }

  // ── layout ──
  const stable = stableHeight(ctx, [D.insight])
  function layout() {
    const W = ctx.art.clientWidth
    const Hs = stable(ctx.art.clientHeight)
    if (!W || !Hs) return
    const wide = W / Hs > 1.05 && W > 520
    root.classList.toggle('wide', wide)
    root.classList.toggle('tall', !wide)
    root.classList.toggle('short', wide && Hs < 330)
    root.style.height = `${Hs}px`
    let side: number
    if (wide) {
      const cw = Math.min(380, Math.max(240, W * 0.32))
      root.style.setProperty('--cw', `${cw}px`)
      side = Math.min(Hs / (Hs < 330 ? 1.48 : 1.56), (W - cw - Math.min(72, W * 0.05)) / 1.32, 560)
    } else {
      // portrait: the tag above, the slider and the other prompts below; the scroll takes the rest
      root.style.setProperty('--cw', `${Math.min(W, 440)}px`)
      const used = strip.offsetHeight + chipBox.offsetHeight + ctrl.offsetHeight + 3 * 10
      side = Math.min((W - 4) / 1.32, (Hs - used) / 1.45, 520)
    }
    side = Math.max(90, Math.floor(side))
    root.style.setProperty('--side', `${side}px`)
    // the scroll's rods and cord, brushed to size
    const kw = side * 1.16
    const kh = side * 1.36
    deco.setAttribute('viewBox', `0 0 ${kw} ${kh}`)
    const rod = (y: number, w: number, ext: number) => brush([[-ext, y], [kw / 2, y + 0.6], [kw + ext, y]], w, { a: 0.03, b: 0.03, min: 0.7, wob: 0.03 }).d
    const cy = -side * 0.08
    // the tag's string, from the scroll to the paper strip
    // (layout offsets, not client rects: the scene may be mid-transition and scaled)
    const sx = strip.offsetLeft - kake.offsetLeft
    const sy = strip.offsetTop - kake.offsetTop
    const A: Pt = wide ? [kw + side * 0.02, side * 0.012] : [kw / 2, cy]
    const B: Pt = wide ? [sx + 3, sy + 14] : [sx + strip.offsetWidth / 2, sy + strip.offsetHeight - 3]
    const sag: Pt = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2 + (wide ? Math.min(26, Math.abs(B[0] - A[0]) * 0.3) : 0)]
    deco.replaceChildren(
      s('path', { class: 't7-k3', d: brush([A, sag, B], 1.3, { a: 0.1, b: 0.1, min: 0.6, wob: 0.1 }).d }),
      s('path', { class: 't7-k2', d: ell(B[0], B[1], 2.4, 2) }),
      s('path', { class: 't7-k3', d: brush([[kw * 0.33, side * 0.01], [kw / 2, cy], [kw * 0.67, side * 0.01]], 1.6, { a: 0, b: 0, min: 1, wob: 0 }).d }),
      s('path', { class: 't7-v', d: ell(kw / 2, cy, 2.6) }),
      s('path', { class: 't7-k2', d: rod(side * 0.012, side * 0.024, side * 0.015) }),
      s('path', { class: 't7-k', d: rod(kh - side * 0.022, side * 0.042, side * 0.055) }),
      s('path', { class: 't7-k', d: ell(-side * 0.058, kh - side * 0.022, side * 0.024, side * 0.034) }),
      s('path', { class: 't7-k', d: ell(kw + side * 0.058, kh - side * 0.022, side * 0.024, side * 0.034) }))
    draw()
  }
  onSize(ctx, ctx.art, layout)

  colors()
  paintAll()
  sync()
  watchTheme(ctx, () => {
    colors()
    paintAll()
    sync()
  })

  return () => {
    stop()
    gen++
    tex.forEach((t) => t?.dispose())
    ;(U.uTex.value as THREE.Texture | null)?.dispose()
    stage?.dispose()
  }
}
