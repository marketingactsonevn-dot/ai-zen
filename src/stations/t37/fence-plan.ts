/**
 * The plan of the fence scene, shared by the 3D hero and its flat fallback. Azimuth a puts a point at (r·sin a, r·cos a)
 * on the ground, so a camera at yaw y looks at the garden from azimuth y and the nearest bit of any ring is at a = y.
 */

/** fireflies still reaching the sapling once k rings stand (illustration: every layer stops some, none stops all) */
export const LEAK = [20, 11, 6, 4, 2, 1, 1]
/** ring radii, metres, inside out (ring 0 is the first built) */
export const RR = [1.05, 1.6, 2.15, 2.7, 3.25, 3.8]
/** half a hole, metres: two posts left out */
export const GAP = 0.3
/** the camera's first yaw: ring 0's front hole faces it, so the first fence already shows a line through */
export const YAW0 = 0.3
const D = Math.PI / 180
/** the one direction open through all six rings */
export const SLIT = YAW0 + 125 * D
/**
 * Three holes per ring, degrees from SLIT. One ring: three open lines. Two and three: two (115° stays open, 118° overlaps
 * it). From four on only SLIT survives, as narrow as the outer ring's hole (±4.5°, wider than one arrow-key turn).
 */
const REL = [[0, 115, 235], [0, 115, 300], [0, 118, 190], [0, 60, 160], [0, 80, 250], [0, 140, 210]]
const wrap = (a: number) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
/** each ring's hole azimuths (radians, 0…2π); [k][0] is the slit */
export const HOLES = REL.map((r) => r.map((a) => wrap(SLIT + a * D)))
export const ang = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))

/** the hole of ring k open at azimuth phi, or -1 */
export const holeAt = (k: number, phi: number) => HOLES[k].findIndex((a) => ang(a, phi) < GAP / RR[k])

/** with `built` rings standing, the azimuth of the line open through all of them seen from phi (the outermost ring's hole), else NaN */
export function lineThrough(phi: number, built: number): number {
  if (!built) return NaN
  let j = -1
  for (let k = 0; k < built; k++) if ((j = holeAt(k, phi)) < 0) return NaN
  return HOLES[built - 1][j]
}

// self-check: one line open through ring 0 alone at the first view, exactly one direction open through all six
if (import.meta.env.DEV) {
  const open = (b: number) => {
    let n = 0, was = false
    for (let i = 0; i < 3600; i++) {
      const on = !Number.isNaN(lineThrough((i / 3600) * 2 * Math.PI, b))
      if (on && !was) n++
      was = on
    }
    return n
  }
  console.assert(!Number.isNaN(lineThrough(YAW0, 1)) && open(1) === 3 && open(4) === 1 && open(6) === 1 && !Number.isNaN(lineThrough(SLIT, 6)), 't37 fence plan: holes do not line up as designed')
}
