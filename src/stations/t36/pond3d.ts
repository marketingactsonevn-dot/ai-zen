import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { cssVar } from '../../core/prefs'
import type { InkKit } from '../../ui/part2/stage3d'
import { Koi } from '../t09/koi'
import { PADS, SHARD, swimR } from './pens-paint'

/**
 * Scene 2's 3D world (inside the easel's frame): a round stone basin of still water sunk in raked sand, lily pads, a
 * moon shard floating, and t09's koi (low LOD) swimming its slow circle; round it a garden big enough for the engine
 * pen to pull back over: a lit lantern, a pine, rocks, stepping stones, bamboo, ink mountains under the moon.
 * Units: the basin's inner radius is RB; the 2D paintings use the same layout (PADS, SHARD, swimR) in units of it.
 */
export const RB = 1.32
const KOI_S = 0.46

export interface Pond {
  koi: Koi
  shadow: THREE.Mesh
  /** the swim: angle round the basin and the tail's phase */
  swim: { a: number; ph: number }
  place(): void
  theme(): void
}

function hash(x: number, y: number) {
  const q = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return q - Math.floor(q)
}
function vnoise(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy)
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

/** the basin: a lathed stone lip, rough with noise (periodic round the ring), welded so the seam does not show */
function basinGeo(low: boolean) {
  // outer foot → over the lip → down the inner wall (this order faces the surface out of the stone)
  const prof: [number, number][] = [[1.96, -0.03], [1.92, 0.02], [1.86, 0.2], [1.77, 0.34], [1.62, 0.39], [1.46, 0.36], [1.36, 0.27], [1.3, 0.12], [1.27, -0.03]]
  const seg = low ? 40 : 72
  const g = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), seg)
  const p = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    const a = Math.atan2(z, x)
    // noise on a circle so 0 and 2π agree
    const n = vnoise(Math.cos(a) * 3 + 7, Math.sin(a) * 3 + y * 4) - 0.5
    const n2 = vnoise(Math.cos(a) * 9 + 2, Math.sin(a) * 9 + y * 9) - 0.5
    const k = 1 + (n * 0.05 + n2 * 0.018) * Math.min(1, y * 3 + 0.4)
    p.setXYZ(i, x * k, y + n * 0.05 * Math.max(0, y), z * k)
  }
  g.deleteAttribute('uv')
  g.deleteAttribute('normal')
  const w = mergeVertices(g, 1e-4)
  g.dispose()
  w.computeVertexNormals()
  return w
}
/** a lily pad: a disc with its notch, a hair thick (so it takes an ink edge) */
function padGeo(r: number, rot: number) {
  const sh = new THREE.Shape()
  sh.moveTo(0, 0)
  sh.absarc(0, 0, r, rot + 0.32, rot + Math.PI * 2 - 0.32, false)
  sh.lineTo(0, 0)
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.014, bevelEnabled: false, curveSegments: 16 })
  g.rotateX(-Math.PI / 2)
  return g
}
function shardGeo(r: number) {
  const sh = new THREE.Shape()
  sh.absarc(0, 0, r, -1.9, 1.9, false)
  sh.absarc(-r * 0.55, 0, r * 0.86, 1.25, -1.25, true)
  const g = new THREE.ShapeGeometry(sh, 12)
  g.rotateX(-Math.PI / 2)
  return g
}

const SH_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const SH_FRAG = /* glsl */ `
uniform vec3 uC;
uniform float uK;
varying vec2 vUv;
void main() {
  vec2 q = (vUv - 0.5) * 2.0;
  float d = length(q * vec2(1.0, 2.6));
  gl_FragColor = vec4(uC, uK * (1.0 - smoothstep(0.15, 1.0, d)));
  #include <colorspace_fragment>
}`

/** Build the basin garden into k (a generator: yields between heavy parts). */
export function* buildPond(k: InkKit, out: { pond?: Pond }) {
  const low = k.low
  // the moon low and from the back left: a clear lit side and a long shadow side on every stone
  k.uniforms.uKey.value.set(-0.62, 0.55, 0.56).normalize()
  k.backdrop({ moon: [0.42, 0.3, -0.86], seed: 36 })
  yield
  k.ground({ r: 9 })
  k.pond({ at: [0, 0], r: [RB, RB], seed: 36 })
  yield
  const basinMat = k.ink('rock', { moss: 0.7, rim: 1.3 })
  const rockLo = basinMat.uniforms.uLo.value as THREE.Color // the kit's shared rock tone: what marks a stone's material
  k.mesh(basinGeo(low), basinMat, { at: [0, 0, 0] }).raycast = () => {}
  yield
  const padMat = k.ink('moss', { moss: 1, rim: 0.6, edge: 0.5 })
  for (const [u, v, r, rot] of PADS) k.mesh(padGeo(r * RB, rot), padMat, { at: [u * RB, 0.018, v * RB] }).raycast = () => {}
  const shardMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(cssVar('--moon')), transparent: true, opacity: 0.95 })
  const shard = new THREE.Mesh(shardGeo(0.12), shardMat)
  shard.position.set(SHARD[0] * RB, 0.022, SHARD[1] * RB)
  shard.renderOrder = 2
  k.root.add(shard)
  k.glow([SHARD[0] * RB, 0.08, SHARD[1] * RB], 0.7, 'moon', 0.5)
  yield
  // the koi and the soft shadow it throws on the water
  const koi = new Koi(true)
  koi.rawOpacity = 0
  koi.quadOpacity = 0
  koi.quadReveal = 0
  koi.U.uSwim.value = 0.55
  koi.group.scale.setScalar(KOI_S)
  k.root.add(koi.group)
  const shMat = new THREE.ShaderMaterial({ vertexShader: SH_VERT, fragmentShader: SH_FRAG, transparent: true, depthWrite: false, uniforms: { uC: { value: new THREE.Color() }, uK: { value: 0.4 } } })
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), shMat)
  shadow.rotation.x = -Math.PI / 2
  shadow.renderOrder = 1
  shadow.raycast = () => {}
  k.root.add(shadow)
  const swim = { a: 2.4, ph: 0 }
  const place = () => {
    const a = swim.a, R = swimR(a) * RB
    const x = Math.cos(a) * R, z = Math.sin(a) * R
    const dx = -Math.sin(a), dz = Math.cos(a)
    koi.group.position.set(x, 0.03, z)
    koi.group.rotation.y = Math.atan2(-dz, dx)
    koi.U.uPhase.value = swim.ph
    shadow.position.set(x - dx * 0.12 + 0.07, 0.016, z - dz * 0.12 + 0.09)
    shadow.rotation.z = Math.atan2(dz, dx)
  }
  // the stones' own tones: in the light theme the kit's pale greys go flat, so the shadow side is pushed darker here
  const inks: { m: THREE.ShaderMaterial; lo: THREE.Color; mid: THREE.Color; hi: THREE.Color }[] = []
  const own = () => {
    k.root.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined
      if (m?.uniforms?.uLo?.value !== rockLo || m.side === THREE.BackSide) return
      inks.push({ m, lo: m.uniforms.uLo.value, mid: m.uniforms.uMid.value, hi: m.uniforms.uHi.value })
      m.uniforms.uLo = { value: new THREE.Color() }
      m.uniforms.uMid = { value: new THREE.Color() }
    })
  }
  const theme = () => {
    koi.theme()
    const dark = document.documentElement.dataset.theme === 'dark'
    own()
    for (const x of inks) {
      ;(x.m.uniforms.uLo.value as THREE.Color).set(cssVar('--rock-lo')).multiplyScalar(dark ? 1 : 0.55)
      ;(x.m.uniforms.uMid.value as THREE.Color).set(cssVar('--rock-mid')).multiplyScalar(dark ? 1 : 0.86)
    }
    k.uniforms.uMist.value.y = dark ? 0.55 : 0.28
    shMat.uniforms.uC.value.set(cssVar('--umbra'))
    shMat.uniforms.uK.value = dark ? 0.55 : 0.32
    shardMat.color.set(cssVar('--moon'))
  }
  theme()
  place()
  out.pond = { koi, shadow, swim, place, theme }
  yield
  // the garden round the basin, for when the camera pulls back
  k.toro({ at: [-2.55, -1.35], h: 1.55, lit: true, rotY: 0.7 })
  k.rock({ at: [2.3, 0.9], w: 0.9, h: 0.55, seed: 3601, moss: 0.8 })
  k.rock({ at: [2.75, 0.35], w: 0.45, h: 0.3, seed: 3602, moss: 0.6 })
  k.rock({ at: [-2.15, 1.7], w: 0.6, h: 0.38, seed: 3603, moss: 0.7 })
  yield
  k.stones([0.6, 5.2], [0.35, 2.35], 4, { size: 0.62, seed: 36 })
  yield
  k.pine({ at: [2.9, -2.6], h: 3.3, lean: -1, seed: 36 })
  yield
  k.bamboo({ at: [-3.9, -3.2], n: low ? 4 : 6, h: 3.6, seed: 36 })
  k.rock({ at: [4.4, -1.2], w: 1.3, h: 0.9, seed: 3604, moss: 0.8 })
  // the ink outline (one shared hull material): at a low pixel ratio a hairline hull breaks into dots; give it body there
  const dprNow = Math.min(devicePixelRatio || 1, low ? 1.25 : 2)
  k.root.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined
    if (m?.side === THREE.BackSide && m.uniforms?.uW) m.uniforms.uW.value = dprNow < 1.6 ? 0.0042 : 0.0028
  })
  theme()
}
