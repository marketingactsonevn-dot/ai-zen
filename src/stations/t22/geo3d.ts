import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { rng } from '../../ui/part2/ink'

/** Build-time geometry for the t22 hero (stage3d.ts keeps its own private; this is a lower-poly copy so many rocks merge into one draw). */

const hash3 = (x: number, y: number, z: number) => {
  const q = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
  return q - Math.floor(q)
}
function noise3(x: number, y: number, z: number) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z)
  const fx = x - ix, fy = y - iy, fz = z - iz
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz)
  const c = (a: number, b: number, d: number) => hash3(ix + a, iy + b, iz + d)
  const L = (a: number, b: number, t: number) => a + (b - a) * t
  return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w)
}

/** A welded unit sphere, built once per resolution for the module and cloned (welding is the slow part). */
const spheres = new Map<number, THREE.BufferGeometry>()
function unitSphere(ws: number, hs: number): THREE.BufferGeometry {
  let g = spheres.get(ws * 1000 + hs)
  if (!g) {
    const sp = new THREE.SphereGeometry(1, ws, hs)
    sp.deleteAttribute('uv')
    sp.deleteAttribute('normal')
    g = mergeVertices(sp)
    sp.dispose()
    spheres.set(ws * 1000 + hs, g)
  }
  return g.clone()
}

/** A garden stone w × h × d standing on y = 0: a lumpy sphere chiselled by cut planes, flat at the foot. */
export function rockGeo(seed: number, w: number, h: number, d: number, low: boolean, flat = 0): THREE.BufferGeometry {
  const r = rng(seed)
  const g = unitSphere(low ? 14 : 20, low ? 9 : 13)
  const o = [r() * 40, r() * 40, r() * 40]
  const planes = Array.from({ length: 4 }, () => {
    const a = r() * Math.PI * 2
    const n = new THREE.Vector3(Math.cos(a), 0.15 + r() * 0.9, Math.sin(a)).normalize()
    return [n.x, n.y, n.z, 0.66 + r() * 0.16]
  })
  // a flat-topped stone (a lantern's base) gets one level cut across its crown
  if (flat) planes.push([0, 1, 0, flat])
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

/** One stone of a merged rim, placed: [x, z, w, h, d, seed, rotY, flat]. */
export function placedRock([x, z, w, hh, d, seed, rot, flat]: number[], low: boolean): THREE.BufferGeometry {
  const g = rockGeo(seed, w, hh, d, low, flat)
  g.rotateY(rot)
  g.translate(x, -hh * 0.05, z)
  return g
}

/** A tube along curve whose radius follows r(u), with a per-vertex `aG` (when it lights up while growing): g(u), u 0…1 along it. */
export function shapedTube(curve: THREE.Curve<THREE.Vector3>, seg: number, radial: number, r: (u: number) => number, g: (u: number) => number): THREE.BufferGeometry {
  const t = new THREE.TubeGeometry(curve, seg, 1, radial, false)
  const p = t.attributes.position as THREE.BufferAttribute
  const a = new Float32Array(p.count)
  const c = new THREE.Vector3()
  for (let i = 0; i <= seg; i++) {
    const u = i / seg
    curve.getPointAt(u, c)
    const k = r(u)
    for (let j = 0; j <= radial; j++) {
      const v = i * (radial + 1) + j
      p.setXYZ(v, c.x + (p.getX(v) - c.x) * k, c.y + (p.getY(v) - c.y) * k, c.z + (p.getZ(v) - c.z) * k)
      a[v] = g(u)
    }
  }
  t.setAttribute('aG', new THREE.BufferAttribute(a, 1))
  return t
}

/**
 * A sheet of dó paper w × d, th thick, its edges curling up and a little deckled, in its own frame (x right, z toward
 * the viewer). aL = where each vertex sits on the sheet (-0.5…0.5 both ways), aT = its atlas uv from at(x, z).
 */
export function raftGeo(w: number, d: number, th: number, seed: number, at: (x: number, z: number) => [number, number]): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, th, d, 12, 1, 5)
  const p = g.attributes.position as THREE.BufferAttribute
  const L = new Float32Array(p.count * 2), T = new Float32Array(p.count * 2)
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    const ex = Math.abs(x) / (w / 2), ez = Math.abs(z) / (d / 2)
    L[i * 2] = x / w
    L[i * 2 + 1] = z / d
    ;[T[i * 2], T[i * 2 + 1]] = at(x, z)
    // the edges curl up as the paper dries on the water; the torn rim wanders a little
    y += 0.03 * ex ** 4 + 0.022 * ez ** 4
    x *= 1 + 0.025 * (noise3(z * 9 + seed, seed, 0) - 0.5) * ex
    z *= 1 + 0.05 * (noise3(x * 7 + seed, 0, seed) - 0.5) * ez
    p.setXYZ(i, x, y, z)
  }
  g.setAttribute('aL', new THREE.BufferAttribute(L, 2))
  g.setAttribute('aT', new THREE.BufferAttribute(T, 2))
  g.computeVertexNormals()
  return g
}

/** Add a constant float attribute (to merge geometries that need it). */
export function withAttr(g: THREE.BufferGeometry, name: string, v: number | ((i: number) => number)): THREE.BufferGeometry {
  const n = g.attributes.position.count
  const a = new Float32Array(n)
  for (let i = 0; i < n; i++) a[i] = typeof v === 'number' ? v : v(i)
  g.setAttribute(name, new THREE.BufferAttribute(a, 1))
  return g
}
