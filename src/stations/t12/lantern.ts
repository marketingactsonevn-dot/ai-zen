import { s } from '../../core/dom'
import { blob, f1, stroke, type Pt } from './ink'

/**
 * A Kasuga-style stone lantern in sumi-e, drawn straight in pixel space (so the ink filters keep their grain):
 * base · pillar with a band · lotus platform · fire box with an arched window (sun and moon carved beside it) ·
 * a sweeping roof with up-turned tips · lotus cup · jewel. Light from the upper left; moss on the roof and base.
 * Local units: 100 = lantern height, y = 100 is the ground, x is centred.
 */
export interface LanternParts {
  g: SVGGElement
  /** the window in pixels (light rises inside it) */
  win: { x: number; y: number; w: number; h: number; d: string }
  /** where the flame sits */
  core: Pt
  /** the base's half width in pixels */
  baseHW: number
}

const qb = (a: Pt, c: Pt, b: Pt, n = 10): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    const m = 1 - t
    return [m * m * a[0] + 2 * m * t * c[0] + t * t * b[0], m * m * a[1] + 2 * m * t * c[1] + t * t * b[1]] as Pt
  })
const cb = (a: Pt, c1: Pt, c2: Pt, b: Pt, n = 14): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    const m = 1 - t
    return [0, 1].map((j) => m * m * m * a[j] + 3 * m * m * t * c1[j] + 3 * m * t * t * c2[j] + t * t * t * b[j]) as Pt
  })
const mirror = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [-x, y] as Pt).reverse()

export function drawLantern(lx: number, ly: number, Lh: number, lowQ: boolean): LanternParts {
  const u = Lh / 100
  const P = ([x, y]: Pt): Pt => [lx + x * u, ly - (100 - y) * u]
  const poly = (pts: Pt[]) => `M${pts.map(P).map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')}Z`
  const brush = (pts: Pt[], w: number, o?: Parameters<typeof stroke>[2]) => stroke(pts.map(P), w * u, o)
  const path = (d: string, cls: string, extra?: Record<string, unknown>) => s('path', { d, class: cls, ...extra })
  const fx = (id: string) => (lowQ ? null : `url(#${id})`)

  const wash = s('g', { filter: fx('ink-wash') })
  const body = s('g')
  const shade = s('g', { filter: fx('ink-wash') })
  const dry = s('g', { filter: fx('ink-dry') })
  const dryH = s('g', { filter: fx('t12-dryh') })
  const ink = s('g', { filter: fx('ink-rough') })
  const moss = s('g', { filter: fx('ink-wash') })

  // ground contact: a soft ink shadow under the base
  wash.append(path(blob(lx + 3 * u, ly + 0.6 * u, 27 * u, 3.4 * u, 31, 0.12), 't12-l-cast'))

  // ── base (kiso): a hexagonal block — front face, lit top, shaded right face
  const baseF: Pt[] = [[-21, 100], [21, 100], [19.6, 93.6], [-19.6, 93.6]]
  body.append(path(poly(baseF), 't12-l-body'), path(poly([[-19.6, 93.6], [19.6, 93.6], [16.8, 92], [-16.8, 92]]), 't12-l-top'))
  shade.append(path(poly([[8.5, 100], [21, 100], [19.6, 93.6], [8.2, 93.6]]), 't12-l-shade'), path(poly([[-21, 100], [21, 100], [20.6, 98.2], [-20.6, 98.2]]), 't12-l-shade'))
  ink.append(
    path(brush([[-21.8, 100], [0, 100.4], [21.8, 99.9]], 1.25, { head: 0.06, tail: 0.5, min: 0.3 }), 't12-l-ink'),
    path(brush([[-19.9, 93.5], [-6, 93.3], [8, 93.5], [19.9, 93.4]], 0.7, { head: 0.1, tail: 0.6, min: 0.25 }), 't12-l-ink'),
    path(brush([[-19.5, 93.6], [-21, 100]], 1.0, { tail: 0.4, min: 0.3 }), 't12-l-ink'),
    path(brush([[19.5, 93.6], [21, 100]], 0.9, { tail: 0.4, min: 0.3 }), 't12-l-ink'),
    path(brush([[-8.2, 94], [-8.5, 99.6]], 0.45, { min: 0.2 }), 't12-l-ink2'),
    path(brush([[8.2, 94], [8.5, 99.6]], 0.45, { min: 0.2 }), 't12-l-ink2'),
    path(brush([[-16.6, 92.1], [0, 91.8], [16.6, 92.1]], 0.45, { min: 0.3 }), 't12-l-ink2'),
  )
  // lotus petals carved on the base face
  for (const x of [-14, -4.5, 4.5, 14]) ink.append(path(brush([[x - 2.6, 97.4], [x, 95], [x + 2.6, 97.4]], 0.42, { head: 0.2, tail: 0.5, min: 0.25 }), 't12-l-ink2'))
  dryH.append(path(brush([[-18, 96.8], [-2, 97.2], [16, 96.6]], 2.6, { head: 0.1, tail: 0.4 }), 't12-l-dry'))

  // ── pillar (sao) with its band
  const pil: Pt[] = [[-6, 92.4], [6, 92.4], [5.1, 58.2], [-5.1, 58.2]]
  body.append(path(poly(pil), 't12-l-body'), path(poly([[-6.5, 77.3], [6.5, 77.3], [6.5, 74.1], [-6.5, 74.1]]), 't12-l-body'))
  shade.append(path(poly([[2, 92.4], [6, 92.4], [5.1, 58.2], [1.6, 58.2]]), 't12-l-shade'), path(poly([[-6.5, 74.1], [6.5, 74.1], [6.5, 74.9], [-6.5, 74.9]]), 't12-l-shade'))
  ink.append(
    path(brush([[-5.1, 58.4], [-5.5, 74], [-6.1, 92.6]], 1.1, { head: 0.08, tail: 0.6, min: 0.3 }), 't12-l-ink'),
    path(brush([[5.1, 58.6], [5.6, 76], [6, 92.4]], 0.75, { head: 0.1, tail: 0.5, min: 0.25 }), 't12-l-ink'),
    path(brush([[-6.7, 74.1], [6.7, 74.1]], 0.55, { min: 0.3 }), 't12-l-ink'),
    path(brush([[-6.7, 77.4], [6.7, 77.3]], 0.65, { min: 0.3 }), 't12-l-ink'),
  )
  dry.append(path(brush([[-3.6, 60], [-3.9, 72]], 2, { head: 0.1, tail: 0.3 }), 't12-l-dry'), path(brush([[-3, 79], [-3.7, 91]], 2.2, { head: 0.1, tail: 0.3 }), 't12-l-dry'))

  // ── lotus platform (chūdai): a flared bowl under a slab
  const flare: Pt[] = [...qb([-7.4, 58.4], [-13.4, 57.4], [-15.8, 52.6]), ...mirror(qb([-7.4, 58.4], [-13.4, 57.4], [-15.8, 52.6]))]
  body.append(path(poly(flare), 't12-l-body'), path(poly([[-16.6, 52.7], [16.6, 52.7], [16.6, 50.3], [-16.6, 50.3]]), 't12-l-top'))
  shade.append(path(poly([[4, 58.4], [7.4, 58.4], ...qb([7.4, 58.4], [13.4, 57.4], [15.8, 52.6]), [6, 52.6]]), 't12-l-shade'))
  ink.append(
    path(brush(qb([-7.6, 58.6], [-13.4, 57.6], [-16.2, 52.8]), 0.8, { tail: 0.5, min: 0.3 }), 't12-l-ink'),
    path(brush(qb([7.6, 58.6], [13.4, 57.6], [16.2, 52.8]), 0.7, { tail: 0.5, min: 0.3 }), 't12-l-ink'),
    path(brush([[-16.9, 52.8], [0, 53], [16.9, 52.7]], 0.9, { head: 0.06, tail: 0.5, min: 0.3 }), 't12-l-ink'),
    path(brush([[-16.7, 50.3], [16.7, 50.2]], 0.6, { min: 0.3 }), 't12-l-ink2'),
  )
  for (const x of [-10, -5, 0, 5, 10]) ink.append(path(brush([[x * 0.72, 57.6], [x * 0.9 - 0.6, 55.2], [x, 53.2]], 0.42, { head: 0.3, tail: 0.6, min: 0.2 }), 't12-l-ink2'))

  // ── fire box (hibukuro) with lintel, corner posts and an arched window
  body.append(path(poly([[-11.4, 50.3], [11.4, 50.3], [11.4, 35.7], [-11.4, 35.7]]), 't12-l-body'), path(poly([[-12.8, 35.9], [12.8, 35.9], [12.8, 33.5], [-12.8, 33.5]]), 't12-l-top'))
  shade.append(path(poly([[7.2, 50.3], [11.4, 50.3], [11.4, 35.7], [7.2, 35.7]]), 't12-l-shade'))
  const winPts: Pt[] = [[-5.1, 47.8], [-5.1, 41.2], ...qb([-5.1, 41.2], [-5, 37.4], [0, 37]).slice(1), ...qb([0, 37], [5, 37.4], [5.1, 41.2]).slice(1), [5.1, 47.8]]
  const winD = poly(winPts)
  ink.append(
    path(brush([[-11.4, 35.8], [-11.6, 43], [-11.4, 50.4]], 0.9, { tail: 0.5, min: 0.3 }), 't12-l-ink'),
    path(brush([[11.4, 35.8], [11.5, 43], [11.3, 50.4]], 0.75, { tail: 0.5, min: 0.3 }), 't12-l-ink'),
    path(brush([[-9.2, 36.2], [-9.3, 50]], 0.42, { min: 0.3 }), 't12-l-ink2'),
    path(brush([[9.2, 36.2], [9.3, 50]], 0.42, { min: 0.3 }), 't12-l-ink2'),
    path(brush([[-13.1, 35.9], [0, 36.1], [13.1, 35.8]], 0.8, { head: 0.06, tail: 0.5, min: 0.3 }), 't12-l-ink'),
    path(brush([[-5.6, 48.2], ...winPts.slice(1, -1), [5.6, 48.2]], 0.95, { head: 0.08, tail: 0.4, min: 0.35 }), 't12-l-ink'),
    path(brush([[-6, 48.1], [6, 48.1]], 0.6, { min: 0.3 }), 't12-l-ink'),
  )
  // the sun and the crescent moon carved beside the window
  ink.append(path(blob(...P([-7.25, 41.4]), 1.3 * u, 1.3 * u, 4, 0.06, 12), 't12-l-carve'))
  const moon = P([7.25, 41.4])
  ink.append(path(`${blob(moon[0], moon[1], 1.35 * u, 1.35 * u, 9, 0.05, 12)}${blob(moon[0] + 0.55 * u, moon[1] - 0.25 * u, 1.1 * u, 1.1 * u, 10, 0.05, 12)}`, 't12-l-carve', { 'fill-rule': 'evenodd' }))

  // ── roof (kasa): the one big gesture of the picture
  const roofR: Pt[] = [...cb([6, 22], [12, 24.2], [20, 26.8], [26.8, 27.2]), ...qb([26.8, 27.2], [28.8, 27], [27.6, 28.6], 4).slice(1), ...qb([27.6, 28.6], [26.4, 30.7], [23.6, 31.1], 4).slice(1), ...cb([23.6, 31.1], [16, 32.4], [8, 33.5], [0, 33.7]).slice(1)]
  const roof = [...mirror(roofR), ...roofR.slice(1)]
  body.append(path(poly(roof), 't12-l-body'))
  // the top slope catches the dawn; the underside stays in shadow
  body.append(path(poly([[-6, 22], [6, 22], ...cb([6, 22], [12, 24.2], [20, 26.8], [26.4, 27.4]).slice(1), [18, 28.4], [0, 29.4], [-18, 28.4], ...mirror(cb([6, 22], [12, 24.2], [20, 26.8], [26.4, 27.4]).slice(1))]), 't12-l-top'))
  shade.append(path(poly([[-23.6, 31.1], [-12, 32.6], [0, 33.7], [12, 32.6], [23.6, 31.1], [20, 30.2], [0, 31.4], [-20, 30.2]]), 't12-l-shade', { 'fill-opacity': 0.6 }))
  ink.append(
    path(brush([[-27.6, 28.6], [-23.4, 31.2], [-12, 32.8], [0, 33.9], [12, 32.8], [23.4, 31.2], [27.8, 28.4]], 1.7, { head: 0.05, tail: 0.25, min: 0.28 }), 't12-l-ink'),
    path(brush([[-6.2, 22.1], ...cb([-6.2, 22.1], [-12, 24.2], [-20, 26.8], [-27, 27.1]).slice(1), [-28.5, 26.4]], 1.15, { head: 0.08, tail: 0.5, min: 0.2 }), 't12-l-ink'),
    path(brush([[6.2, 22.1], ...cb([6.2, 22.1], [12, 24.2], [20, 26.8], [27, 27.1]).slice(1), [28.6, 26.2]], 1.0, { head: 0.08, tail: 0.5, min: 0.2 }), 't12-l-ink'),
    path(brush([[-4.4, 22.6], [-12, 26.4], [-19.5, 30.6]], 0.5, { head: 0.2, tail: 0.6, min: 0.2 }), 't12-l-ink2'),
    path(brush([[4.4, 22.6], [12, 26.4], [19.5, 30.6]], 0.5, { head: 0.2, tail: 0.6, min: 0.2 }), 't12-l-ink2'),
    path(brush([[0, 22.6], [0, 33.2]], 0.45, { head: 0.2, tail: 0.6, min: 0.2 }), 't12-l-ink2'),
  )
  dryH.append(path(brush([[-22, 27.4], [-10, 24.6], [-3, 23.4]], 1.8, { head: 0.1, tail: 0.3 }), 't12-l-dry'), path(brush([[4, 23.6], [14, 25.6], [22, 27.8]], 1.4, { head: 0.1, tail: 0.3 }), 't12-l-dry'))

  // ── cap, lotus cup and jewel (hōju)
  body.append(path(poly([[-6.6, 22.3], [6.6, 22.3], [5.6, 19.7], [-5.6, 19.7]]), 't12-l-body'))
  const cup: Pt[] = [[-5.4, 19.9], ...qb([-5.4, 19.9], [-5.9, 17.4], [-3.6, 16.9]).slice(1), ...qb([3.6, 16.9], [5.9, 17.4], [5.4, 19.9])]
  body.append(path(poly(cup), 't12-l-top'))
  const jewel: Pt[] = [...cb([-4.3, 17.1], [-6.5, 14], [-3.8, 9.8], [0, 5.4]), ...cb([0, 5.4], [3.8, 9.8], [6.5, 14], [4.3, 17.1]).slice(1)]
  body.append(path(poly(jewel), 't12-l-body'))
  shade.append(path(poly([[1.2, 6.4], ...cb([0, 5.4], [3.8, 9.8], [6.5, 14], [4.3, 17.1]).slice(2), [1.6, 16.6]]), 't12-l-shade'))
  ink.append(
    path(brush([[-6.8, 22.2], [6.8, 22.2]], 0.6, { min: 0.3 }), 't12-l-ink'),
    path(brush(cup, 0.5, { head: 0.2, tail: 0.6, min: 0.3 }), 't12-l-ink2'),
    path(brush([[-4.2, 17], [-6.4, 14], [-3.8, 9.8], [0, 5.3]], 0.75, { head: 0.1, tail: 0.6, min: 0.2 }), 't12-l-ink'),
    path(brush([[0, 5.3], [3.8, 9.8], [6.4, 14], [4.2, 17]], 0.55, { head: 0.3, tail: 0.6, min: 0.2 }), 't12-l-ink'),
  )
  body.append(path(blob(...P([-1.8, 12.5]), 1.1 * u, 2.2 * u, 3, 0.1, 10), 't12-l-gleam'))

  // ── moss: on the roof, the slab, the base
  for (const [x, y, rx, ry, sd] of [[-14, 25.6, 7, 1.3, 1], [-4, 23.4, 4.6, 0.9, 2], [11, 25.6, 5.6, 1.1, 3], [-11, 51.4, 4.6, 0.8, 4], [-15, 92.9, 4.8, 0.85, 5], [12.6, 93.1, 3.4, 0.7, 6]] as const) {
    const c = P([x, y])
    moss.append(path(blob(c[0], c[1], rx * u, ry * u, sd + 40, 0.22, 16), 't12-l-moss'))
  }

  const g = s('g', { class: 't12-lantern' }, wash, body, shade, dry, dryH, moss, ink)
  const a = P([-5.1, 37])
  const b = P([5.1, 47.8])
  return { g, win: { x: a[0], y: a[1], w: b[0] - a[0], h: b[1] - a[1], d: winD }, core: P([0, 44.6]), baseHW: 21 * u }
}

/**
 * The light of a lantern: a pool on the sand and a halo behind it (`under`), and inside the window the dark,
 * a light that rises like water with the level, the flame, a warm spill on the stone (`over`).
 * `set(v)` with v = 0…1 is the quality meter; CSS reads --lvl on `host` for the soft parts.
 */
export function lanternLight(uid: string, lant: LanternParts, lx: number, ly: number, Lh: number, host: HTMLElement | SVGElement) {
  const stop = (o: number, a: number, v = '--vermilion') => s('stop', { offset: o, style: `stop-color:var(${v});stop-opacity:${a}` })
  const clipId = `${uid}-c`
  const defs = s('defs', null,
    s('radialGradient', { id: `${uid}-halo` }, stop(0, 0.9), stop(0.22, 0.55), stop(0.55, 0.16), stop(1, 0)),
    s('radialGradient', { id: `${uid}-pool` }, stop(0, 0.75), stop(0.5, 0.28), stop(1, 0)),
    s('linearGradient', { id: `${uid}-flame`, x1: 0, y1: 1, x2: 0, y2: 0 }, stop(0, 0.92), stop(0.6, 0.7), stop(1, 0.5, '--vermilion-soft')),
    s('clipPath', { id: clipId }, s('path', { d: lant.win.d })))
  const core = lant.core
  const under = [
    defs,
    s('ellipse', { class: 't12-pool', cx: f1(lx), cy: f1(ly + Lh * 0.01), rx: f1(Lh * 0.62), ry: f1(Lh * 0.62 * 0.21), fill: `url(#${uid}-pool)` }),
    s('circle', { class: 't12-halo', cx: f1(core[0]), cy: f1(core[1]), r: f1(Lh * 0.62), fill: `url(#${uid}-halo)` }),
  ]
  const wb = lant.win
  const lightRect = s('rect', { x: f1(wb.x - 2), y: f1(wb.y + wb.h), width: f1(wb.w + 4), height: 0, fill: `url(#${uid}-flame)` })
  const fh = wb.h * 0.62
  const fw = wb.w * 0.34
  const fx = wb.x + wb.w / 2
  const fy = wb.y + wb.h - wb.h * 0.08
  const fl = (k: number) =>
    `M${f1(fx)} ${f1(fy - fh * k)}C${f1(fx + fw * 0.2 * k)} ${f1(fy - fh * 0.62 * k)} ${f1(fx + fw * 0.62 * k)} ${f1(fy - fh * 0.32 * k)} ${f1(fx + fw * 0.5 * k)} ${f1(fy - fh * 0.1 * k)}` +
    `C${f1(fx + fw * 0.4 * k)} ${f1(fy + 1)} ${f1(fx - fw * 0.4 * k)} ${f1(fy + 1)} ${f1(fx - fw * 0.5 * k)} ${f1(fy - fh * 0.1 * k)}` +
    `C${f1(fx - fw * 0.62 * k)} ${f1(fy - fh * 0.32 * k)} ${f1(fx - fw * 0.2 * k)} ${f1(fy - fh * 0.62 * k)} ${f1(fx)} ${f1(fy - fh * k)}Z`
  const flick = s('g', null, s('path', { class: 't12-flame-o', d: fl(1) }), s('path', { class: 't12-flame-i', d: fl(0.55) }))
  const flame = s('g', { class: 't12-flame' }, flick)
  flame.style.transformOrigin = `${f1(fx)}px ${f1(fy)}px`
  const over = [
    s('g', { 'clip-path': `url(#${clipId})` }, s('path', { class: 't12-void', d: wb.d }), lightRect, flame),
    s('ellipse', { class: 't12-spill', cx: f1(core[0]), cy: f1(core[1] + Lh * 0.02), rx: f1(Lh * 0.2), ry: f1(Lh * 0.15), fill: `url(#${uid}-halo)` }),
  ]
  const set = (v: number) => {
    host.style.setProperty('--lvl', v.toFixed(3))
    const hh = wb.h * Math.min(1, v * 1.04)
    lightRect.setAttribute('y', f1(wb.y + wb.h - hh))
    lightRect.setAttribute('height', f1(hh))
    flame.style.scale = `${(v > 0 ? 0.35 + 0.65 * v : 0).toFixed(3)}`
  }
  return { under, over, set, flick, origin: `${f1(fx)} ${f1(fy)}` }
}
