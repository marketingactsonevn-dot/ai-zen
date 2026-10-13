import * as THREE from 'three'
import { createStage } from '../../core/three-stage'
import { cssVar, onPrefs, prefs } from '../../core/prefs'
import { fill, h, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { C, journey, question, rng, stroke } from './shared'

const T = C.scenes.space
type V3 = [number, number, number]

/** Hand-placed neighbourhoods (illustrative): beauty sits next to colour, pets near food, food near weather. */
const CENTERS: V3[] = [
  [-1.55, 0.35, 0.35],
  [-0.7, 1.08, -0.6],
  [1.6, 0.6, 0.15],
  [0.95, -0.5, -0.8],
  [0.2, -0.4, 1.15],
  [-0.95, -0.78, -0.95],
]
/** On tall screens the space stands upright: x and y swap, so the neighbourhoods stack and the yaw orbit keeps them tall. */
const place = (v: V3, tall: boolean): V3 => (tall ? [v[1], v[0], v[2]] : v)
const floorOf = (tall: boolean) => (tall ? -2.7 : -1.75)

interface Word {
  w: string
  c: number
  /** position in the wide layout; place() gives the tall one */
  pos: V3
  q: boolean
  near: number[]
  el: HTMLElement
  sx: number
  sy: number
  z: number
}

function layoutWords(): Word[] {
  const q = question()
  const out: Word[] = []
  T.clusters.forEach((cl, c) => {
    const [cx, cy, cz] = CENTERS[c]
    const n = cl.words.length
    cl.words.forEach((w, k) => {
      let o: V3
      if (k === 0) o = [-0.17, 0.04, 0.02]
      else if (k === 1) o = [0.17, -0.05, 0.06]
      else {
        const a = k * 2.4 + c
        const y = ((k - 2) / Math.max(1, n - 3) - 0.5) * 0.6
        o = [Math.cos(a) * 0.56, y, Math.sin(a) * 0.56]
      }
      out.push({ w, c, pos: [cx + o[0], cy + o[1], cz + o[2]], q: q.words.includes(w), near: [], el: null as unknown as HTMLElement, sx: 0, sy: 0, z: 0 })
    })
  })
  out.forEach((a, i) => {
    a.near = out
      .map((b, j) => [j, Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1], a.pos[2] - b.pos[2])] as [number, number])
      .filter(([j]) => j !== i)
      .sort((x, y) => x[1] - y[1])
      .slice(0, 3)
      .map(([j]) => j)
  })
  return out
}

const PT_VERT = /* glsl */ `
attribute float aSize;
attribute float aQ;
attribute float aHi;
uniform float uScale;
uniform float uMax;
varying float vQ;
varying float vHi;
varying float vDepth;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min(uMax, aSize * (1.0 + aHi * 0.5) * uScale / -mv.z);
  vQ = aQ;
  vHi = aHi;
  vDepth = smoothstep(10.0, 4.5, -mv.z);
}`
const PT_FRAG = /* glsl */ `
uniform vec3 uInk;
uniform vec3 uVer;
uniform float uDim;
uniform float uGain;
varying float vQ;
varying float vHi;
varying float vDepth;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float core = 1.0 - smoothstep(0.3, 0.6, d);
  float bleed = (1.0 - smoothstep(0.25, 1.0, d)) * 0.32;
  float ring = smoothstep(0.66, 0.74, d) * (1.0 - smoothstep(0.86, 0.96, d));
  float isQ = step(0.5, vQ);
  float a = mix(core * 0.9 + bleed, max(core * 0.55, ring), isQ);
  vec3 col = mix(uInk, uVer, max(isQ, step(0.9, vHi)));
  a *= mix(0.4, 1.0, vDepth) * mix(uDim, 1.0, max(isQ, sign(vHi))) * mix(uGain, 1.0, isQ);
  if (a < 0.02) discard;
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}`

const SAND_VERT = /* glsl */ `
uniform float uScale;
varying float vDepth;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = 0.03 * uScale / -mv.z;
  vDepth = smoothstep(11.0, 5.0, -mv.z) * smoothstep(3.6, 2.2, length(position.xz * vec2(0.85, 1.2)));
}`
const SAND_FRAG = /* glsl */ `
uniform vec3 uInk;
uniform float uA;
varying float vDepth;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.4, 1.0, d)) * uA * vDepth;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uInk, a);
  #include <colorspace_fragment>
}`

/** Raked sand under the space: straight rows, concentric ripples under each neighbourhood. */
function sandPoints(low: boolean, tall: boolean) {
  const r = rng(51)
  const FLOOR = floorOf(tall)
  const centres = CENTERS.map((c) => place(c, tall))
  const n = low ? 2600 : 6000
  const pos = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    let x = (r() * 2 - 1) * 3.6
    let z = -3 + r() * 5.6
    const hit = centres.find(([cx, , cz]) => Math.hypot(x - cx, z - cz) < 0.9)
    if (hit) {
      const ring = 0.32 + Math.floor(r() * 4) * 0.15
      const a = r() * Math.PI * 2
      x = hit[0] + Math.cos(a) * ring
      z = hit[2] + Math.sin(a) * ring * 0.94
    } else {
      z = -3 + Math.round((z + 3) / 0.15) * 0.15 + Math.sin(x * 1.4 + z) * 0.03
    }
    pos.set([x, FLOOR, z], i * 3)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  return g
}

function hazeTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const x = c.getContext('2d')
  if (x) {
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.45, 'rgba(255,255,255,0.45)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = g
    x.fillRect(0, 0, 128, 128)
  }
  return new THREE.CanvasTexture(c)
}

/** Scene 2: your words fly into a quiet 3D space where meanings gather in neighbourhoods. Orbit, tap a word, see its neighbours. */
export function mountSpace(ctx: SceneCtx) {
  const words = layoutWords()
  const host = h('div', { class: 't5-space', tabindex: '0', role: 'group', 'aria-label': T.aria })
  const labels = h('div', { class: 't5-sp-labels' })
  const threads = s('svg', { class: 't5-sp-threads', 'aria-hidden': 'true' })
  const near = h('p', { class: 't5-sp-near', 'aria-live': 'polite' })
  const tagSlot = h('div', { class: 't5-sp-tag' }, ctx.tag('illustration'))
  const root = h('div', { class: 't5-scene t5-sp' }, journey(1), host, near, tagSlot)
  ctx.art.append(root)
  ctx.prompt(T.prompt)

  let selected = -1
  let focusIdx = 0
  let hovered = -1
  let explored = false
  const timers: number[] = []

  // labels: your words are real buttons (keyboard path); neighbours are quiet serif captions
  words.forEach((wd, i) => {
    wd.el = wd.q
      ? h('button', { class: 't5-lb is-q', type: 'button', 'aria-label': fill(T.wordAria, { w: wd.w }), onClick: () => select(i === selected ? -1 : i) }, wd.w)
      : h('span', { class: 't5-lb', 'aria-hidden': 'true' }, wd.w)
    labels.append(wd.el)
  })
  // each name fades by itself (depth, overlap) inside its span, which keeps the CSS reveal
  const nameText = T.clusters.map((cl) => h('span', { style: 'opacity:0' }, cl.name))
  const names = nameText.map((t) => h('span', { class: 't5-cl', 'aria-hidden': 'true' }, t))
  const nameVis = names.map(() => 0)
  labels.append(...names)
  const threadPaths = [0, 1, 2].map(() => s('path', { class: 't5-sp-thread' }))
  const leader = s('path', { class: 't5-sp-leader' })
  threads.append(leader, ...threadPaths)

  const stage = createStage(host, { fov: 40 })
  if (!stage) {
    fallback()
    return
  }
  host.append(threads, labels)
  const { scene, camera } = stage
  const low = ctx.quality === 'low'
  // the space orbits inside `world`; `wide` stretches it sideways on wide screens so it fills the frame
  const world = new THREE.Group()
  const wide = new THREE.Group()
  wide.add(world)
  scene.add(wide)

  // ── points (one per word)
  const n = words.length
  const pos = new Float32Array(n * 3)
  let tall = false
  let target = words.map((w) => place(w.pos, tall))
  const aSize = new Float32Array(n)
  const aQ = new Float32Array(n)
  const aHi = new Float32Array(n)
  words.forEach((w, i) => {
    pos.set(w.pos, i * 3)
    aSize[i] = w.q ? 0.24 : 0.12
    aQ[i] = w.q ? 1 : 0
  })
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1))
  geo.setAttribute('aQ', new THREE.BufferAttribute(aQ, 1))
  geo.setAttribute('aHi', new THREE.BufferAttribute(aHi, 1))
  const uScale = { value: 1 }
  const ptMat = new THREE.ShaderMaterial({
    vertexShader: PT_VERT,
    fragmentShader: PT_FRAG,
    uniforms: { uScale, uMax: { value: 30 * stage.renderer.getPixelRatio() }, uInk: { value: new THREE.Color() }, uVer: { value: new THREE.Color() }, uDim: { value: 1 }, uGain: { value: 1 } },
    transparent: true,
    depthWrite: false,
  })
  const points = new THREE.Points(geo, ptMat)
  points.renderOrder = 3
  world.add(points)

  // ── faint constellation threads: each word to its two nearest neighbours
  const pairs = words.flatMap((w, i) => w.near.slice(0, 2).filter((j) => j > i || !words[j].near.slice(0, 2).includes(i)).map((j) => [i, j]))
  const linePos = new Float32Array(pairs.length * 6)
  const lineGeo = new THREE.BufferGeometry()
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3))
  const lineMat = new THREE.LineBasicMaterial({ transparent: true, depthWrite: false, opacity: 0.2 })
  const lines = new THREE.LineSegments(lineGeo, lineMat)
  lines.renderOrder = 2
  world.add(lines)
  const syncLines = () => {
    pairs.forEach(([i, j], k) => {
      linePos.set([pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], pos[j * 3], pos[j * 3 + 1], pos[j * 3 + 2]], k * 6)
    })
    lineGeo.attributes.position.needsUpdate = true
  }
  syncLines()

  // ── haze over each neighbourhood + raked sand below
  const hazeTex = hazeTexture()
  const hazeSprites = CENTERS.map((c) => {
    const m = new THREE.SpriteMaterial({ map: hazeTex, transparent: true, depthWrite: false, depthTest: false, opacity: 0.5 })
    const sp = new THREE.Sprite(m)
    sp.position.set(...c)
    sp.scale.setScalar(1.9)
    sp.renderOrder = 1
    world.add(sp)
    return sp
  })
  const hazes = hazeSprites.map((sp) => sp.material)
  const sandMat = new THREE.ShaderMaterial({
    vertexShader: SAND_VERT,
    fragmentShader: SAND_FRAG,
    uniforms: { uScale, uInk: { value: new THREE.Color() }, uA: { value: 0.4 } },
    transparent: true,
    depthWrite: false,
  })
  const sand = new THREE.Points(sandPoints(low, tall), sandMat)
  sand.renderOrder = 0
  world.add(sand)

  // ── theme
  const applyTheme = () => {
    const dark = prefs.theme === 'dark'
    const blend = dark ? THREE.AdditiveBlending : THREE.NormalBlending
    ptMat.uniforms.uInk.value.set(cssVar('--ink'))
    ptMat.uniforms.uVer.value.set(cssVar('--vermilion'))
    ptMat.blending = blend
    // night: the neighbourhoods would sink into the dark, so the quiet points glow a little brighter
    ptMat.uniforms.uGain.value = dark ? 1.4 : 1
    sandMat.uniforms.uInk.value.set(cssVar(dark ? '--moss' : '--ink-3'))
    sandMat.uniforms.uA.value = dark ? 0.35 : 0.5
    sandMat.blending = blend
    hazes.forEach((m) => {
      m.color.set(cssVar(dark ? '--moss-2' : '--moss-soft'))
      m.opacity = dark ? 0.16 : 0.85
      m.blending = blend
      m.needsUpdate = true
    })
    lineMat.color.set(cssVar(dark ? '--moss' : '--ink-3'))
    lineMat.opacity = dark ? 0.42 : 0.3
    lineMat.blending = blend
    ptMat.needsUpdate = sandMat.needsUpdate = lineMat.needsUpdate = true
    stage.render()
  }
  const offPrefs = onPrefs(applyTheme)
  applyTheme()

  // ── camera framing: keep the whole space in view in any aspect; tall screens get the upright layout
  let dist = 6.4
  let near0 = 2.5 // camera distance when gliding into a neighbourhood
  const relayout = () => {
    target = words.map((w) => place(w.pos, tall))
    target.forEach((p, i) => pos.set(p, i * 3))
    geo.attributes.position.needsUpdate = true
    syncLines()
    hazeSprites.forEach((sp, c) => sp.position.set(...place(CENTERS[c], tall)))
    sand.geometry.dispose()
    sand.geometry = sandPoints(low, tall)
  }
  const onSize = (w: number, hh: number) => {
    const tanY = Math.tan(THREE.MathUtils.degToRad(20))
    const aspect = w / hh
    const t = aspect < 0.85
    if (t !== tall) {
      tall = t
      relayout()
    }
    if (tall) {
      wide.scale.set(0.82, 1, 0.82)
      dist = Math.max(2.5 / tanY, 1.6 / (tanY * aspect))
      near0 = Math.max(2.4, 0.8 / (tanY * aspect))
    } else {
      wide.scale.set(THREE.MathUtils.clamp(aspect / 1.9, 1, 1.55), 1, 1)
      dist = Math.max(4.5, 2.4 / (tanY * aspect))
      near0 = Math.max(2.4, 0.95 / (tanY * aspect))
    }
    uScale.value = (hh * stage.renderer.getPixelRatio()) / (2 * tanY)
  }
  stage.onResize(onSize)

  // ── orbit (drag / arrows), slow idle drift
  let yaw = -0.35, pitch = 0.18, vYaw = 0, vPitch = 0, idle = 0
  let dragging = false, downX = 0, downY = 0, lastX = 0, lastY = 0, moved = false, pid: number | null = null
  const canvas = stage.canvas
  canvas.setAttribute('aria-hidden', 'true')

  const pick = (x: number, y: number, r: number) => {
    let best = -1, bd = r
    words.forEach((w, i) => {
      const d = Math.hypot(w.sx - x, w.sy - y)
      if (d < bd && w.z > 0) (bd = d), (best = i)
    })
    return best
  }
  const local = (e: PointerEvent) => {
    const rr = host.getBoundingClientRect()
    return [e.clientX - rr.left, e.clientY - rr.top]
  }
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return
    pid = e.pointerId
    dragging = true
    moved = false
    ;[downX, downY] = local(e)
    lastX = downX
    lastY = downY
    vYaw = vPitch = 0
    host.classList.add('is-grabbing')
    try {
      canvas.setPointerCapture(e.pointerId)
    } catch {
      /* gone */
    }
  })
  canvas.addEventListener('pointermove', (e) => {
    const [x, y] = local(e)
    if (dragging && e.pointerId === pid) {
      if (!moved && Math.hypot(x - downX, y - downY) < 5) return
      moved = true
      vYaw = (x - lastX) * 0.007
      vPitch = (y - lastY) * 0.005
      yaw += vYaw
      pitch = THREE.MathUtils.clamp(pitch + vPitch, -0.55, 0.75)
      lastX = x
      lastY = y
      idle = 0
      stage.render()
    } else if (e.pointerType === 'mouse') {
      setHover(pick(x, y, 24))
    }
  })
  const up = (e: PointerEvent) => {
    if (e.pointerId !== pid) return
    pid = null
    dragging = false
    host.classList.remove('is-grabbing')
    if (!moved) {
      const [x, y] = local(e)
      const i = pick(x, y, e.pointerType === 'mouse' ? 24 : 34)
      select(i === selected ? -1 : i)
    } else ctx.complete()
  }
  canvas.addEventListener('pointerup', up)
  canvas.addEventListener('pointercancel', up)
  canvas.addEventListener('pointerleave', () => setHover(-1))
  // arrows orbit the space wherever focus is inside it (the space itself or one of your words)
  host.addEventListener('keydown', (e) => {
    const k = { ArrowLeft: [-0.16, 0], ArrowRight: [0.16, 0], ArrowUp: [0, -0.12], ArrowDown: [0, 0.12] }[e.key]
    if (!k) return
    e.preventDefault()
    yaw += k[0]
    pitch = THREE.MathUtils.clamp(pitch + k[1], -0.55, 0.75)
    idle = 0
    stage.render()
  })

  // ── selection: threads to the 3 nearest meanings + their names
  let dwell = 0
  function setHover(i: number) {
    if (i === hovered) return
    hovered = i
    clearTimeout(dwell)
    if (i >= 0 && !explored) dwell = window.setTimeout(() => hovered === i && reveal(i), 900)
    paintHi()
  }
  /** choosing a word glides the camera into its neighbourhood (0 = whole space, 1 = close up) */
  const fz = { k: 0 }
  function select(i: number) {
    selected = i
    if (i >= 0) focusIdx = i
    if (ctx.reduced) fz.k = i >= 0 ? 1 : 0
    else ctx.anim(() => gsap.to(fz, { k: i >= 0 ? 1 : 0, duration: 1.5, ease: 'power3.inOut', overwrite: true }))
    paintHi()
    if (i >= 0) reveal(i)
    else near.textContent = ''
  }
  function reveal(i: number) {
    const wd = words[i]
    near.textContent = fill(T.near, { w: wd.w, list: wd.near.map((j) => words[j].w).join(', ') })
    if (!ctx.reduced) ctx.anim(() => gsap.fromTo(near, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }))
    if (!explored) {
      explored = true
      ctx.chime('ok')
      ctx.insight(T.insight, T.detail)
      root.classList.add('is-named')
    }
  }
  const focus = () => (hovered >= 0 ? hovered : selected)
  function paintHi() {
    const f = focus()
    aHi.fill(0)
    words.forEach((w) => w.el.classList.remove('is-on', 'is-near'))
    if (f >= 0) {
      aHi[f] = 1
      words[f].el.classList.add('is-on')
      words[f].near.forEach((j) => {
        aHi[j] = 0.5
        words[j].el.classList.add('is-near')
      })
    }
    ptMat.uniforms.uDim.value = f >= 0 ? 0.45 : 1
    geo.attributes.aHi.needsUpdate = true
    root.classList.toggle('has-focus', f >= 0)
    stage!.render()
  }

  // ── your words fly up from the sand into their neighbourhoods
  const order = question().words.map((w) => words.findIndex((x) => x.w === w))
  const fly = { t: ctx.reduced ? 1 : 0 }
  const startOf = (k: number): V3 => [(k / Math.max(1, order.length - 1) - 0.5) * (tall ? 1.8 : 2.6), floorOf(tall) + 0.05, 1.9]
  if (!ctx.reduced) {
    ctx.anim(() => gsap.to(fly, { t: 1, duration: 3.2, delay: 0.5, ease: 'none' }))
    order.forEach((wi, k) => timers.push(window.setTimeout(() => words[wi]?.el.classList.add('is-land'), 500 + (k * 0.12 + 0.55) * 3200)))
  }
  const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
  onSize(stage.width, stage.height)

  // ── per-frame: orbit, fly-in, project labels, ink threads
  const v = new THREE.Vector3()
  const ft = new THREE.Vector3()
  const lbW = new Map<HTMLElement, number>()
  stage.onFrame((t, dt) => {
    if (!dragging) {
      yaw += vYaw
      pitch = THREE.MathUtils.clamp(pitch + vPitch, -0.55, 0.75)
      vYaw *= 0.92
      vPitch *= 0.92
      idle += dt
      if (idle > 2.5 && focus() < 0) yaw += dt * 0.06 * Math.min(1, (idle - 2.5) / 2)
    }
    world.rotation.set(pitch, yaw, 0)
    wide.updateMatrixWorld()
    const k = fz.k
    if (k > 0) {
      ft.set(pos[focusIdx * 3], pos[focusIdx * 3 + 1], pos[focusIdx * 3 + 2]).applyMatrix4(world.matrixWorld)
      camera.position.set(ft.x * k, 0.35 + (ft.y + 0.15 - 0.35) * k, dist + (ft.z + near0 - dist) * k)
      camera.lookAt(ft.x * k, 0.05 + (ft.y - 0.05) * k, ft.z * k)
    } else {
      camera.position.set(0, 0.35, dist)
      camera.lookAt(0, 0.05, 0)
    }
    if (fly.t < 1 || t === 0) {
      order.forEach((wi, k) => {
        if (wi < 0) return
        const u = ease(THREE.MathUtils.clamp((fly.t - k * 0.12) / 0.55, 0, 1))
        const a = startOf(k), b = target[wi]
        const lift = Math.sin(u * Math.PI) * 0.9
        pos.set([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u + lift, a[2] + (b[2] - a[2]) * u], wi * 3)
      })
      geo.attributes.position.needsUpdate = true
      syncLines()
    }
    camera.updateMatrixWorld()
    const W = stage.width, H = stage.height
    const shown: { i: number; x: number; y: number; w: number }[] = []
    words.forEach((w, i) => {
      v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).applyMatrix4(world.matrixWorld).project(camera)
      w.sx = (v.x * 0.5 + 0.5) * W
      w.sy = (-v.y * 0.5 + 0.5) * H
      w.z = v.z < 1 ? 1 : 0
      const lw = lbW.get(w.el) ?? lbW.set(w.el, w.el.offsetWidth).get(w.el)!
      const x = Math.min(W - lw - 4, Math.max(4, w.sx + 12))
      const y = Math.max(4, w.sy - 11)
      const off = w.z === 0 || w.sx < -8 || w.sx > W + 8 || w.sy < -8 || w.sy > H + 8
      w.el.classList.toggle('is-off', off)
      if (off) return
      if (w.q || aHi[i] > 0) shown.push({ i, x, y, w: lw })
      else w.el.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`
    })
    // visible labels never sit on top of each other: walk down the screen, nudging overlaps below
    shown.sort((a, b) => a.y - b.y)
    let lead = ''
    shown.forEach((a, k) => {
      for (let m = 0; m < k; m++) {
        const b = shown[m]
        if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + 22) a.y = b.y + 22
      }
      words[a.i].el.style.translate = `${a.x.toFixed(1)}px ${a.y.toFixed(1)}px`
      // a nudged label keeps a fine hairline back to its dot
      const w = words[a.i]
      if (a.y - Math.max(4, w.sy - 11) > 6) lead += `M${(w.sx + 2).toFixed(1)} ${(w.sy + 1).toFixed(1)}L${(a.x + 2).toFixed(1)} ${(a.y + 11).toFixed(1)}`
    })
    leader.setAttribute('d', lead)
    // neighbourhood names: only for neighbourhoods on the near side of the orbit (a far name would float over near
    // words); close up, only the chosen word's; never clamped to the frame or laid over a word
    const zo = v.set(0, 0, 0).applyMatrix4(world.matrixWorld).applyMatrix4(camera.matrixWorldInverse).z
    const only = k > 0.4 ? words[focusIdx].c : -1
    const rate = ctx.reduced ? 1 : Math.min(1, dt * 4)
    names.forEach((el, c) => {
      const cc = place(CENTERS[c], tall)
      const dz = v.set(...cc).applyMatrix4(world.matrixWorld).applyMatrix4(camera.matrixWorldInverse).z - zo
      v.set(cc[0], cc[1] + 0.62, cc[2]).applyMatrix4(world.matrixWorld).project(camera)
      const half = (lbW.get(el) ?? lbW.set(el, el.offsetWidth).get(el)!) / 2
      const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H
      let want = only >= 0 ? Number(c === only) : THREE.MathUtils.smoothstep(dz, -0.2, 0.45)
      if (v.z > 1 || x < half + 2 || x > W - half - 2 || y < 18 || y > H - 4) want = 0
      else if (want > 0 && shown.some((a) => x + half > a.x && x - half < a.x + a.w && y > a.y && y - 16 < a.y + 22)) want = 0
      nameVis[c] += (want - nameVis[c]) * rate
      nameText[c].style.opacity = nameVis[c].toFixed(3)
      if (nameVis[c] > 0.01) el.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`
    })
    const f = focus()
    threadPaths.forEach((p, k) => {
      if (f < 0) return void p.setAttribute('d', '')
      const a = words[f], b = words[a.near[k]]
      const mx = (a.sx + b.sx) / 2, my = (a.sy + b.sy) / 2 - Math.hypot(b.sx - a.sx, b.sy - a.sy) * 0.18
      p.setAttribute('d', stroke([[a.sx, a.sy], [mx, my], [b.sx, b.sy]], 4.2 - k * 1.1, { head: 0.05, tail: 0.8, min: 0.18 }))
    })
  })
  const ro = new ResizeObserver(() => lbW.clear())
  ro.observe(labels)
  stage.render()

  function fallback() {
    host.classList.add('is-static')
    host.removeAttribute('tabindex')
    const svg = s('svg', { class: 't5-sp-fallback', viewBox: '-2.4 -1.6 4.8 3.2', role: 'img', 'aria-label': T.noWebgl },
      ...words.map((w) => s('g', null,
        s('circle', { cx: w.pos[0] + w.pos[2] * 0.2, cy: -w.pos[1], r: w.q ? 0.06 : 0.035, class: w.q ? 'is-q' : '' }),
        s('text', { x: w.pos[0] + w.pos[2] * 0.2 + 0.07, y: -w.pos[1] + 0.03 }, w.w))))
    host.append(svg)
    ctx.complete()
  }

  return () => {
    timers.forEach(clearTimeout)
    clearTimeout(dwell)
    ro.disconnect()
    offPrefs()
    hazeTex.dispose()
    stage.dispose()
  }
}
