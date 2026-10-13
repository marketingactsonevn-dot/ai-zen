import { s } from '../../core/dom'
import { blob, stroke, type Pt } from './ink'

/** The running example of this station: one moss-glazed teapot, drawn around its resting point (0, 0). */
export const POT = {
  body: 'M-38 0 C-52 -6 -58 -28 -48 -44 C-40 -58 -24 -63 0 -63 C24 -63 40 -58 48 -44 C58 -28 52 -6 38 0 Z',
  spout: 'M-47 -18 C-62 -22 -72 -40 -86 -60 L-80 -64 C-70 -50 -60 -38 -45 -37 Z',
  lid: 'M-23 -62 C-20 -73 20 -73 23 -62 Z',
  handle: [[42, -50], [66, -48], [74, -30], [62, -14], [46, -11]] as Pt[],
  /** where the tea leaves the spout */
  tip: [-84, -62] as Pt,
}

/** Glaze wash + brush contours (the sumi-e teapot). */
export function potInk(): SVGGElement {
  const P = POT
  return s('g', { class: 'ink' },
    s('path', { class: 'glaze', d: P.spout, filter: 'url(#ink-wash)' }),
    s('path', { class: 'glaze', d: P.body, filter: 'url(#ink-wash)' }),
    s('path', { class: 'glaze', d: P.lid, filter: 'url(#ink-wash)' }),
    s('path', { class: 'glaze-dark', d: 'M-50 -22 C-48 -6 -30 2 0 2 C30 2 48 -6 50 -22 C40 -10 20 -6 0 -6 C-20 -6 -40 -10 -50 -22Z', filter: 'url(#ink-wash)' }),
    s('path', { class: 'hi', d: blob(20, -46, 11, 6, 2, 0.2) }),
    s('path', { class: 'ink-s', d: stroke([[-34, -1], [-51, -13], [-55, -30], [-46, -48], [-26, -61]], 3.8, { head: 0.08, tail: 0.6 }) }),
    s('path', { class: 'ink-s', d: stroke([[-36, 2], [0, 4], [36, 2]], 2.8, { head: 0.1, tail: 0.5, min: 0.3 }) }),
    s('path', { class: 'ink-s', d: stroke([[26, -61], [46, -48], [55, -28], [44, -7]], 2.4, { head: 0.1, tail: 0.6 }) }),
    s('path', { class: 'ink-s', d: stroke([[-44, -47], [0, -52], [44, -47]], 1.4, { head: 0.2, tail: 0.4 }) }),
    s('path', { class: 'ink-s', d: stroke([[-45, -19], [-62, -24], [-74, -42], [-86, -60]], 3, { head: 0.06, tail: 0.5 }) }),
    s('path', { class: 'ink-s', d: stroke([[-80, -64], [-70, -50], [-58, -40], [-45, -37]], 1.8, { head: 0.2, tail: 0.6 }) }),
    s('path', { class: 'ink-s', d: stroke([[-23, -62], [-14, -71], [14, -71], [23, -62]], 2.2, { head: 0.1, tail: 0.5 }) }),
    s('path', { class: 'ink-s', d: blob(0, -75, 6, 4.5, 8, 0.1) }),
    s('path', { class: 'ink-s', d: stroke(P.handle, 5, { head: 0.1, tail: 0.55, min: 0.3 }) }))
}

/** A small tea bowl (chén) resting at (0, 0); `level` is the tea surface, filled by the pour. */
export function teaCup() {
  const level = s('ellipse', { class: 'tea', cx: 0, cy: -9, rx: 15, ry: 3.2 })
  const g = s('g', { class: 'cup' },
    s('path', { class: 'pot-under', d: blob(0, 1, 22, 3.5, 6, 0.1), filter: 'url(#ink-wash)' }),
    s('path', { class: 'cup-f', d: 'M-21 -19 C-20 -6 -12 0 0 0 C12 0 20 -6 21 -19 Z', filter: 'url(#ink-wash)' }),
    level,
    s('path', { class: 'ink-s', d: stroke([[-21, -19], [-18, -7], [-8, -0.5], [8, -0.5], [18, -7], [21, -19]], 2.4, { head: 0.1, tail: 0.5, min: 0.35 }) }),
    s('path', { class: 'ink-s', d: stroke([[-21, -19.5], [0, -17.5], [21, -19.5]], 1.2, { head: 0.2, tail: 0.5 }) }),
    s('path', { class: 'ink-s', d: stroke([[-7, 0], [7, 0]], 2.2, { head: 0.3, tail: 0.5 }) }))
  return { g, level }
}
