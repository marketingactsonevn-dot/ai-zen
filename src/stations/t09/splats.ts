import * as THREE from 'three'
import content from '../../content/tram-09.json'
import { createStage } from '../../core/three-stage'
import { cssVar, onPrefs, prefs } from '../../core/prefs'
import { fill, h, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { noise3, rng } from './koi'
import { devHook, layoutOf } from './shared'

const C = content.scenes.splats
const SECTORS = 8
const TAU = Math.PI * 2

type V3 = [number, number, number]
interface Splat {
  p: V3
  n: V3
  c: number // tone: 0 stone, 1 dark stone, 2 moss, 3 glow, 4 gravel, 5 light stone
  size: number
}

/** Hexagon radius at angle th for a hexagon of circumradius r. */
const hexR = (r: number, th: number) => {
  const k = ((th % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3)
  return (r * Math.cos(Math.PI / 6)) / Math.cos(k - Math.PI / 6)
}
const faceN = (th: number): V3 => {
  const a = Math.floor(th / (Math.PI / 3)) * (Math.PI / 3) + Math.PI / 6
  return [Math.cos(a), 0, Math.sin(a)]
}

/** A Kasuga-style stone lantern, sampled as surface splats (plus a little gravel bed and the lamp's glow). */
function lantern(n: number): Splat[] {
  const r = rng(1203)
  const out: Splat[] = []
  const add = (p: V3, nn: V3, c: number, size = 1) => out.push({ p, n: nn, c, size })
  const prism = (count: number, r0: number, r1: number, y0: number, y1: number, tone: (y: number, th: number) => number, holes?: (th: number, y: number) => boolean) => {
    for (let i = 0; i < count; i++) {
      const th = r() * TAU
      const t = r()
      const y = y0 + (y1 - y0) * t
      if (holes?.(th, y)) continue
      const rr = hexR(r0 + (r1 - r0) * t, th)
      add([Math.cos(th) * rr, y, Math.sin(th) * rr], faceN(th), tone(y, th))
    }
  }
  const disc = (count: number, rad: number, y: number, up: number, tone: number) => {
    for (let i = 0; i < count; i++) {
      const th = r() * TAU
      const rr = Math.sqrt(r()) * hexR(rad, th)
      add([Math.cos(th) * rr, y, Math.sin(th) * rr], [0, up, 0], tone)
    }
  }
  const N = (k: number) => Math.round(n * k)
  const weather = (y: number, th: number) => (noise3(Math.cos(th) * 3, y * 6, Math.sin(th) * 3) > 0.66 ? 1 : noise3(th * 2, y * 9, 4) > 0.68 ? 5 : 0)
  // base plinth, pillar (with a band), platform
  prism(N(0.08), 0.5, 0.44, 0, 0.16, weather)
  disc(N(0.03), 0.44, 0.16, 1, 0)
  for (let i = 0; i < N(0.12); i++) {
    const th = r() * TAU
    const y = 0.16 + r() * 0.64
    const rr = 0.14 + 0.012 * Math.sin(((y - 0.16) / 0.64) * Math.PI) + (Math.abs(y - 0.5) < 0.025 ? 0.02 : 0)
    add([Math.cos(th) * rr, y, Math.sin(th) * rr], [Math.cos(th), 0, Math.sin(th)], weather(y, th))
  }
  prism(N(0.07), 0.4, 0.4, 0.8, 0.92, weather)
  disc(N(0.03), 0.4, 0.92, 1, 0)
  // fire box with two open windows (front and back) and a warm light inside
  const win = (th: number, y: number) => {
    const a = Math.abs(Math.sin(th))
    return a > 0.86 && y > 1.0 && y < 1.24
  }
  prism(N(0.11), 0.28, 0.28, 0.92, 1.3, (y, th) => (win(th, y + 0.03) || win(th, y - 0.03) ? 1 : weather(y, th)), win)
  for (let i = 0; i < N(0.025); i++) {
    const a = r() * TAU, rr = Math.sqrt(r()) * 0.15
    add([Math.cos(a) * rr, 1.02 + r() * 0.2, Math.sin(a) * rr], [0, 0, 0], 3, 1.6)
  }
  // roof: a wide hexagonal cap with corners that curl upward, moss in the hollows
  for (let i = 0; i < N(0.27); i++) {
    const th = r() * TAU
    const t = Math.pow(r(), 0.8)
    const corner = Math.pow(Math.abs(Math.cos(3 * th)), 6)
    const rr = hexR(0.66, th) * (1 - t) + 0.05
    const y = 1.32 + 0.3 * Math.pow(t, 0.75) + 0.07 * corner * Math.pow(1 - t, 4)
    const moss = noise3(Math.cos(th) * 4, t * 5, Math.sin(th) * 4) > 0.64 && t > 0.2
    add([Math.cos(th) * rr, y, Math.sin(th) * rr], [Math.cos(th) * 0.5, 1, Math.sin(th) * 0.5], moss ? 2 : weather(y, th) === 1 ? 1 : 5)
  }
  disc(N(0.04), 0.62, 1.31, -1, 1)
  // jewel on top
  for (let i = 0; i < N(0.04); i++) {
    const u = r() * 2 - 1, a = r() * TAU, q = Math.sqrt(1 - u * u)
    const nn: V3 = [q * Math.cos(a), u, q * Math.sin(a)]
    const k = u > 0.6 ? 0.55 : 1
    add([nn[0] * 0.1 * k, 1.74 + nn[1] * 0.11 + (u > 0.6 ? 0.04 * (u - 0.6) * 5 : 0), nn[2] * 0.1 * k], nn, u > 0.3 && r() < 0.4 ? 2 : 5)
  }
  // gravel bed with raked rings and a few moss clumps
  for (let i = 0; i < N(0.16); i++) {
    const a = r() * TAU, rr = 0.5 + Math.sqrt(r()) * 0.95
    const ring = Math.abs(Math.sin(rr * 26)) > 0.75
    const moss = noise3(Math.cos(a) * rr * 2.5, 0, Math.sin(a) * rr * 2.5) > 0.72
    add([Math.cos(a) * rr, 0.005, Math.sin(a) * rr], [0, 1, 0], moss ? 2 : ring ? 5 : 4, 1.15)
  }
  return out
}

const SPLAT_VERT = /* glsl */ `
uniform float uShot[${SECTORS}];
uniform float uTime;
uniform float uScale;
uniform float uFog;
uniform vec3 uFogC;
attribute vec3 aCol;
attribute float aSize;
attribute float aMask;
attribute float aRnd;
attribute float aRot;
varying vec3 vCol;
varying float vA;
varying float vRot;
varying float vAsp;
void main() {
  int m = int(aMask + 0.5);
  float seen = 0.0;
  for (int k = 0; k < ${SECTORS}; k++) {
    if ((m & (1 << k)) != 0 && uShot[k] >= 0.0) seen = max(seen, smoothstep(uShot[k] + aRnd * 0.5, uShot[k] + 1.1 + aRnd * 0.9, uTime));
  }
  vec3 drift = vec3(sin(aRnd * 40.0 + uTime * 0.3), cos(aRnd * 31.0 + uTime * 0.25), sin(aRnd * 17.0 + uTime * 0.2)) * 0.07 * (1.0 - seen);
  vec4 mv = modelViewMatrix * vec4(position + drift, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * mix(1.9, 1.0, seen) * uScale / -mv.z;
  vA = mix(uFog * (0.4 + 0.6 * aRnd), 1.0, seen);
  vCol = mix(uFogC, aCol, seen);
  vRot = aRot;
  vAsp = mix(1.0, 0.45 + aRnd * 0.4, seen);
}`
const SPLAT_FRAG = /* glsl */ `
uniform float uOpacity;
varying vec3 vCol;
varying float vA;
varying float vRot;
varying float vAsp;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float cs = cos(vRot), sn = sin(vRot);
  c = vec2(cs * c.x - sn * c.y, sn * c.x + cs * c.y);
  c.y /= vAsp;
  float g = exp(-dot(c, c) * 16.0);
  float a = g * vA * uOpacity;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vCol, a);
  #include <colorspace_fragment>
}`

/** Scene 2 — walk round a stone lantern taking photos; each photo turns fog into soft splats on the side it saw. */
export function splatScene(ctx: SceneCtx) {
  const low = ctx.quality === 'low'
  const root = h('div', { class: 't9 t9s' })
  const host = h('div', {
    class: 't9-stage', tabindex: '0', role: 'slider', 'aria-label': C.aria,
    'aria-valuemin': '0', 'aria-valuemax': '360', 'aria-valuenow': '0', 'aria-valuetext': fill(C.valueText, { deg: 0 }),
  })
  const flash = h('div', { class: 't9s-flash', 'aria-hidden': 'true' })
  const finder = h('div', { class: 't9s-finder', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i'))
  const title = h('p', { class: 't9s-title' }, C.title)
  const count = h('p', { class: 't9s-count', 'aria-live': 'polite' }, fill(C.count, { n: 0 }))
  const shutter = h('button', { class: 't9s-shutter', type: 'button', 'aria-label': C.shutter }, h('span', { 'aria-hidden': 'true' }))
  const dial = s('svg', { class: 't9s-dial', viewBox: '-50 -50 100 100', 'aria-hidden': 'true' })
  const ticks = Array.from({ length: SECTORS }, (_, k) => {
    const a = (k / SECTORS) * TAU - Math.PI / 2
    const el = s('circle', { cx: (Math.cos(a) * 38).toFixed(1), cy: (Math.sin(a) * 38).toFixed(1), r: 4.2 })
    dial.append(el)
    return el
  })
  const needle = s('path', { class: 't9s-needle', d: 'M0 -30 L0 -46' })
  dial.prepend(s('circle', { class: 't9s-dial-ring', r: 38 }))
  dial.append(needle)
  const controls = h('div', { class: 't9s-controls' }, dial, shutter, count)
  root.append(host, finder, flash, title, controls)
  ctx.art.append(root)
  ctx.prompt(C.prompt)

  const stage = createStage(host, { fov: 30 })
  if (!stage) {
    host.removeAttribute('role')
    host.removeAttribute('tabindex')
    host.append(h('p', { class: 't9-nogl' }, C.noWebgl))
    controls.remove()
    ctx.insight(C.insight, C.detail)
    return () => root.remove()
  }
  const { scene, camera, renderer, canvas } = stage
  canvas.setAttribute('aria-hidden', 'true')

  // ── splats
  const list = lantern(low ? 6500 : 15000)
  const NS = list.length
  const pos = new Float32Array(NS * 3), col = new Float32Array(NS * 3), size = new Float32Array(NS), mask = new Float32Array(NS), rnd = new Float32Array(NS), rot = new Float32Array(NS)
  const r = rng(77)
  const dirs = Array.from({ length: SECTORS }, (_, k) => [Math.sin((k / SECTORS) * TAU), Math.cos((k / SECTORS) * TAU)])
  list.forEach((sp, i) => {
    pos.set(sp.p, i * 3)
    size[i] = (0.07 + r() * 0.07) * sp.size
    rnd[i] = r()
    rot[i] = r() * Math.PI
    // which photo directions can see this splat
    let nx = sp.n[0], nz = sp.n[2]
    const horiz = Math.hypot(nx, nz)
    let m = 0
    if (horiz < 0.35 && sp.c !== 3) {
      // faces up/down: seen from wherever it sits (from the far side, the lantern hides it)
      nx = sp.p[0]
      nz = sp.p[2]
    }
    const l = Math.hypot(nx, nz) || 1
    dirs.forEach(([dx, dz], k) => {
      // a photo sees only what faces it squarely: one shot clears about a quarter of the lantern
      if (sp.c === 3 ? Math.abs(dz) > 0.6 : (nx * dx + nz * dz) / l > 0.6) m |= 1 << k
    })
    if (!m) m = 1 << Math.floor(r() * SECTORS)
    mask[i] = m
  })
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aCol', new THREE.BufferAttribute(col, 3))
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
  geo.setAttribute('aMask', new THREE.BufferAttribute(mask, 1))
  geo.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 1))
  geo.setAttribute('aRot', new THREE.BufferAttribute(rot, 1))
  const order = new Uint32Array(NS).map((_, i) => i)
  geo.setIndex(new THREE.BufferAttribute(order, 1))
  const shots = new Array<number>(SECTORS).fill(-1)
  const mat = new THREE.ShaderMaterial({
    vertexShader: SPLAT_VERT, fragmentShader: SPLAT_FRAG, transparent: true, depthWrite: false,
    uniforms: { uShot: { value: shots }, uTime: { value: 0 }, uScale: { value: 1 }, uFog: { value: 0.12 }, uFogC: { value: new THREE.Color() }, uOpacity: { value: 1 } },
  })
  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false
  const world = new THREE.Group()
  const spin = new THREE.Group()
  world.add(spin)
  spin.add(points)
  points.position.y = -0.82
  scene.add(world)

  const tones = () => {
    const dark = prefs.theme === 'dark'
    const c = (n: string) => new THREE.Color(cssVar(n))
    const stone = c('--stone')
    const ink = dark ? c('--paper') : c('--ink')
    const stoneD = stone.clone().lerp(ink, 0.3)
    const stoneL = dark ? c('--ink-3') : c('--stone-2')
    const moss = c('--moss-2').lerp(stone, 0.25)
    const glow = c('--vermilion').lerp(dark ? c('--ink') : c('--card'), dark ? 0.15 : 0.35)
    const gravel = dark ? c('--stone-2') : c('--stone-3')
    const pal = [stone, stoneD, moss, glow, gravel, stoneL]
    const j = rng(5)
    const tmp = new THREE.Color()
    const L = [-0.55, 0.7, 0.45]
    list.forEach((sp, i) => {
      tmp.copy(pal[sp.c])
      if (sp.c !== 3) {
        // light baked in, as it is in real captures: lit from the upper left
        const d = sp.n[0] * L[0] + sp.n[1] * L[1] + sp.n[2] * L[2]
        tmp.lerp(ink, Math.max(0, -d) * 0.22 + (sp.p[1] < 1.31 && sp.p[1] > 1.2 ? 0.18 : 0))
        tmp.multiplyScalar(0.9 + Math.max(0, d) * 0.22 + (j() - 0.5) * 0.12)
      }
      col.set([tmp.r, tmp.g, tmp.b], i * 3)
    })
    geo.attributes.aCol.needsUpdate = true
    mat.uniforms.uFogC.value = dark ? c('--ink-3') : c('--stone-2')
    mat.uniforms.uFog.value = dark ? 0.06 : 0.08
    stage.render()
  }
  tones()
  const offPrefs = onPrefs(tones)

  // ── back-to-front order whenever the view turns (depth packed with the index into one sortable integer)
  const keys = new Uint32Array(NS)
  const sorted = [99, 99]
  const sort = (yaw: number, pitch: number) => {
    const sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch)
    for (let i = 0; i < NS; i++) {
      const z = sp * pos[i * 3 + 1] + cp * (-pos[i * 3] * sy + pos[i * 3 + 2] * cy) // larger = nearer
      const q = Math.max(0, Math.min(65535, Math.round(((z + 2.5) / 5) * 65535)))
      keys[i] = ((q << 16) | i) >>> 0
    }
    keys.sort()
    for (let i = 0; i < NS; i++) order[i] = keys[i] & 0xffff
    geo.index!.needsUpdate = true
    sorted[0] = yaw
    sorted[1] = pitch
  }

  // ── framing: the work fills what the controls leave (below them, or beside them on a cramped landscape)
  let dist = 6
  const frame = () => {
    const W = stage.width, H = stage.height
    const L = layoutOf(root)
    root.dataset.layout = L
    const cb = controls.getBoundingClientRect(), rr = root.getBoundingClientRect()
    const tb = title.getBoundingClientRect()
    const right = L === 'short' ? Math.max(0, rr.right - cb.left + 10) : 0
    const bottom = L === 'short' ? 0 : Math.max(0, rr.bottom - cb.top + 6)
    const top = L === 'tall' ? Math.max(0, tb.bottom - rr.top + 6) : 0
    const fw = W - right, fh = H - top - bottom
    camera.setViewOffset(W, H, W / 2 - fw / 2, H / 2 - (top + fh / 2), W, H)
    const t = Math.tan((camera.fov * Math.PI) / 360)
    dist = (H / t) * Math.max(1.66 / fh, 1.66 / (fw * 0.92))
    mat.uniforms.uScale.value = (H * renderer.getPixelRatio()) / (2 * t)
  }
  stage.onResize(frame)
  frame()

  // ── state + interaction
  let yawT = 0.35, yaw = 0.35, pitchT = 0.28, pitch = 0.28
  const t0 = performance.now()
  const now = () => (performance.now() - t0) / 1000
  let shotCount = 0
  let done = false
  const sectorOf = (y: number) => ((Math.round(-y / (TAU / SECTORS)) % SECTORS) + SECTORS) % SECTORS
  const nearest = (from: number, to: number) => to + Math.round((from - to) / TAU) * TAU

  const syncDial = () => {
    ticks.forEach((t, k) => t.classList.toggle('shot', shots[k] >= 0))
  }
  function take() {
    const k = sectorOf(yawT)
    ctx.anim(() => {
      if (!ctx.reduced) gsap.fromTo(flash, { opacity: 0.85 }, { opacity: 0, duration: 0.9, ease: 'power2.out' })
    })
    if (shots[k] >= 0) {
      ctx.prompt(C.more)
    } else {
      shots[k] = ctx.reduced ? 0 : now()
      shotCount++
      count.textContent = fill(C.count, { n: shotCount })
      syncDial()
      ctx.chime(shotCount === SECTORS ? 'ok' : 'tap')
    }
    // walk on to the next side not yet photographed
    for (let d = 1; d <= SECTORS; d++) {
      const nk = (k + d) % SECTORS
      if (shots[nk] < 0) {
        yawT = nearest(yawT, (-nk * TAU) / SECTORS)
        break
      }
    }
    if (shotCount === SECTORS && !done) {
      done = true
      ctx.insight(C.insight, C.detail)
    }
    stage!.render()
  }
  shutter.addEventListener('click', take)

  let drag: { id: number; x: number; y: number } | null = null
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
    yawT += (e.clientX - drag.x) * 0.008
    pitchT = Math.max(0.05, Math.min(0.9, pitchT + (e.clientY - drag.y) * 0.004))
    drag.x = e.clientX
    drag.y = e.clientY
    stage.render()
  }
  const onUp = () => {
    drag = null
    host.classList.remove('grabbing')
  }
  const onKey = (e: KeyboardEvent) => {
    const st = ({ ArrowLeft: [-TAU / SECTORS, 0], ArrowRight: [TAU / SECTORS, 0], ArrowUp: [0, -0.12], ArrowDown: [0, 0.12] } as Record<string, number[]>)[e.key]
    if (!st) return
    e.preventDefault()
    yawT += st[0]
    pitchT = Math.max(0.05, Math.min(0.9, pitchT + st[1]))
    stage.render()
  }
  host.addEventListener('pointerdown', onDown)
  host.addEventListener('pointermove', onMove)
  host.addEventListener('pointerup', onUp)
  host.addEventListener('pointercancel', onUp)
  host.addEventListener('keydown', onKey)

  // the viewfinder hugs the lantern and its gravel bed as the view turns
  const rim = [...Array.from({ length: 12 }, (_, k) => [Math.cos((k / 12) * TAU) * 1.42, 0.02, Math.sin((k / 12) * TAU) * 1.42]),
    ...Array.from({ length: 6 }, (_, k) => [Math.cos((k / 6) * TAU) * 0.66, 1.6, Math.sin((k / 6) * TAU) * 0.66]), [0, 1.88, 0]]
  const pv = new THREE.Vector3()
  let fb = ''
  const fitFinder = () => {
    points.updateMatrixWorld(true)
    camera.updateMatrixWorld()
    let x0 = 1, x1 = -1, y0 = 1, y1 = -1
    for (const [x, y, z] of rim) {
      pv.set(x, y, z).applyMatrix4(points.matrixWorld).project(camera)
      x0 = Math.min(x0, pv.x); x1 = Math.max(x1, pv.x); y0 = Math.min(y0, pv.y); y1 = Math.max(y1, pv.y)
    }
    const W = stage.width, H = stage.height
    const pad = Math.max(14, (x1 - x0) * W * 0.04)
    const l = ((x0 + 1) / 2) * W - pad, r = ((x1 + 1) / 2) * W + pad
    const t = ((1 - y1) / 2) * H - pad, b = ((1 - y0) / 2) * H + pad
    const key = `${l.toFixed(0)},${t.toFixed(0)},${r.toFixed(0)},${b.toFixed(0)}`
    if (key === fb) return
    fb = key
    Object.assign(finder.style, { left: `${l}px`, top: `${t}px`, width: `${r - l}px`, height: `${b - t}px` })
  }

  let lastDeg = -1
  const step = (_t: number, dt: number) => {
    if (dt > 0) {
      const f = 1 - Math.exp(-dt * 3)
      yaw += (yawT - yaw) * f
      pitch += (pitchT - pitch) * f
    } else {
      yaw = yawT
      pitch = pitchT
    }
    spin.rotation.y = yaw
    world.rotation.x = pitch
    camera.position.set(0, 0, dist)
    camera.lookAt(0, 0, 0)
    fitFinder()
    if (Math.abs(yaw - sorted[0]) > 0.04 || Math.abs(pitch - sorted[1]) > 0.04) sort(yaw, pitch)
    mat.uniforms.uTime.value = ctx.reduced ? 1e4 : now()
    const deg = Math.round(((((-yaw * 180) / Math.PI) % 360) + 360) % 360)
    if (deg !== lastDeg) {
      lastDeg = deg
      host.setAttribute('aria-valuenow', String(deg))
      host.setAttribute('aria-valuetext', fill(C.valueText, { deg }))
      needle.setAttribute('transform', `rotate(${deg})`)
    }
  }
  stage.onFrame(step)
  stage.render()
  devHook({ take, shots }, step, () => renderer.render(scene, camera))

  return () => {
    offPrefs()
    shutter.removeEventListener('click', take)
    host.removeEventListener('pointerdown', onDown)
    host.removeEventListener('pointermove', onMove)
    host.removeEventListener('pointerup', onUp)
    host.removeEventListener('pointercancel', onUp)
    host.removeEventListener('keydown', onKey)
    stage.dispose()
    root.remove()
  }
}
