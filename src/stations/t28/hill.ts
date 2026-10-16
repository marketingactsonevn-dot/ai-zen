/** The terraced hill of t28 `gardeners`, shared by the 3D scene and its painted fallback. */
export const ROWS = 25, COLS = 40
export const A = 1.1 // half the fan's angle: the terraces wrap round the hill
export const FALL = 0.34 // past each end of the fan the rows sink into the hillside and the mist
export const HZ = -8 // the hill's centre (x = 0, z = HZ)
export const R0 = 10, SHRINK = 0.964, H = 4.6, PLINTH = 0.2
export const TRAY = 0.34 // the lacquer tray the hill sits in: its top
/** R[i] = the lip (front edge) of row i; row i's tread runs back to R[i + 1] */
export const R = Array.from({ length: ROWS + 2 }, (_, i) => R0 * SHRINK ** i)
/** convex: steep at the foot, nearly flat on the crest */
export const Y = (i: number) => TRAY + PLINTH + (H * (1 - (1 - (0.86 * i) / ROWS) ** 1.8)) / (1 - 0.14 ** 1.8)
/** each lip wanders ±3 % like a hand-built contour; neighbouring rows wander together (≤ 0.5 % apart, rows are 3.6 % apart) */
export const J = (i: number, th: number) => 1 + 0.03 * (0.65 * Math.sin(th * 4.3 + i * 0.13 + 0.7) + 0.35 * Math.sin(th * 9.7 - i * 0.21 + 2.1))
/** the lip of row i at angle th */
export const Rl = (i: number, th: number) => R[i] * J(i, th)
/** past the fan's ends the hill falls away: 1 on the fan … 0 at ±(A + FALL) */
export const fallK = (th: number) => {
  const u = Math.min(1, Math.max(0, (Math.abs(th) - A) / FALL))
  return 1 - u * u * (3 - 2 * u)
}
export const thOf = (j: number) => -A + ((j + 0.5) * 2 * A) / COLS
export const at = (th: number, r: number, y = 0): [number, number, number] => [Math.sin(th) * r, y, HZ + Math.cos(th) * r]
