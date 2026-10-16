import './sumi.css'
import { nextId, s } from '../../core/dom'
import { blob, curve, p2Defs, rng, stroke, type Pt } from '../../ui/part2/ink'
import { perspectiveCircle, type PerspectiveOpts, type PondGeo } from '../../ui/part2/perspectives'
import type { Perspectives } from '../../ui/part2/types'
import type { SceneDef } from '../types'

/**
 * Garden 13 "Ngã rẽ dưới trăng" (stations 37–39): brush pieces the kit (ui/part2/paint.ts) does not have — maple leaves,
 * a thin moon, the dawn glow, bamboo, raked sand, stones along a curved path — and a perspective circle that can paint
 * over its water too. The moon sets across the garden: night at 37, moonset in mist at 38, first light at 39.
 * Static SVG, colours are tokens (sumi.css); animate parent <g>s only.
 */

export const f1 = (n: number) => (Math.round(n * 10) / 10).toString()
const P = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`

/** Gradients of this garden (dawn, lamp and ember glows, bamboo), once per page in the p2 defs. */
export function g13Defs() {
  p2Defs()
  if (document.getElementById('g13-defs')) return
  const stop = (o: number, c: string, a: number | string = 1) => s('stop', { offset: o, style: `stop-color:var(${c});stop-opacity:${a}` })
  document.getElementById('p2-defs')!.append(s('defs', { id: 'g13-defs' },
    s('radialGradient', { id: 'g13-dawn' }, stop(0, '--dawn'), stop(0.55, '--dawn', 0.55), stop(1, '--dawn', 0)),
    s('radialGradient', { id: 'g13-sun' }, stop(0, '--lantern', 0.55), stop(0.4, '--lantern', 0.2), stop(1, '--lantern', 0)),
    s('radialGradient', { id: 'g13-ember' }, stop(0, '--vermilion', 0.6), stop(0.45, '--vermilion', 0.16), stop(1, '--vermilion', 0)),
    s('radialGradient', { id: 'g13-veil' }, stop(0, '--mist', 0.7), stop(0.6, '--mist', 0.38), stop(1, '--mist', 0)),
    s('radialGradient', { id: 'g13-fog' }, stop(0, '--mist', 'var(--mist-a)'), stop(0.65, '--mist', 'calc(var(--mist-a) * 0.5)'), stop(1, '--mist', 0)),
    s('linearGradient', { id: 'g13-bamboo', x1: 0, y1: 0, x2: 1, y2: 0 }, stop(0, '--moss-c'), stop(0.45, '--moss-a'), stop(1, '--moss-b')),
    s('linearGradient', { id: 'g13-sky', x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, '--dawn', 0), stop(0.7, '--dawn', 0.7), stop(1, '--dawn', 1))))
}

/**
 * A fixed-viewBox painting (scaled by CSS): its paint layer fades out over the viewBox's edges, so the washes melt
 * into the paper instead of ending on a straight cut whatever the stage's shape.
 */
export function inkSheet(cls: string, viewBox: string) {
  g13Defs()
  const [vx, vy, vw, vh] = viewBox.split(' ').map(Number)
  const id = nextId('g13m')
  const white = (o: number, a: number) => s('stop', { offset: o, 'stop-color': '#fff', 'stop-opacity': a })
  const layer = s('g', { mask: `url(#${id})` })
  const box = { maskUnits: 'userSpaceOnUse', x: vx, y: vy, width: vw, height: vh }
  // side fade × top/bottom fade: the side rect is itself masked by the vertical one
  const svg = s('svg', { class: cls, viewBox, preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true' },
    s('defs', null,
      s('linearGradient', { id: `${id}-x` }, white(0, 0), white(0.07, 1), white(0.93, 1), white(1, 0)),
      s('linearGradient', { id: `${id}-y`, x1: 0, y1: 0, x2: 0, y2: 1 }, white(0, 0), white(0.06, 1), white(0.95, 1), white(1, 0)),
      s('mask', { id: `${id}-v`, ...box }, s('rect', { x: vx, y: vy, width: vw, height: vh, fill: `url(#${id}-y)` })),
      s('mask', { id, ...box }, s('rect', { x: vx, y: vy, width: vw, height: vh, fill: `url(#${id}-x)`, mask: `url(#${id}-v)` }))),
    layer)
  return { svg, layer }
}

/** Several short brushed lines [x0, y0, x1, y1] as one path d. */
export const lines = (ls: number[][], w: number, a = 0.15, b = 0.15) => ls.map(([x0, y0, x1, y1]) => stroke([[x0, y0], [x1, y1]], w, a, b, 0.4)).join('')

/** A maple leaf as one ink dab: five lobes brushed from the stalk (pointed tips), turned a°. d only. */
export function leafD(x: number, y: number, r: number, a: number): string {
  const lobes = [[-90, 1], [-38, 0.86], [-142, 0.86], [8, 0.52], [172, 0.52]]
  let d = ''
  for (const [deg, k] of lobes) {
    const t = ((deg + a) * Math.PI) / 180
    const L = r * k
    d += stroke([[x, y], [x + Math.cos(t) * L * 0.45, y + Math.sin(t) * L * 0.45], [x + Math.cos(t) * L, y + Math.sin(t) * L]], r * 0.7 * k + 0.4, 0, 0.7, 0.1)
  }
  const t = ((90 + a) * Math.PI) / 180
  return d + stroke([[x, y], [x + Math.cos(t) * r * 0.55, y + Math.sin(t) * r * 0.55]], r * 0.12 + 0.3, 0, 0.3, 0.4)
}

/** n maple leaves scattered in an ellipse round (cx, cy): one path d. */
export function leafCloud(cx: number, cy: number, rx: number, ry: number, n: number, size: number, seed: number): string {
  const r = rng(seed)
  let d = ''
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, k = Math.sqrt(r())
    d += leafD(cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k, size * (0.7 + r() * 0.6), r() * 360)
  }
  return d
}

/** A thin moon: the lit limb, the ashen rest of the disc, a small halo. tilt° turns the limb (0 = lit on the left). */
export function crescent(cx: number, cy: number, r: number, thin = 0.68, tilt = -20): SVGGElement {
  g13Defs()
  const d = `M0 ${f1(-r)}A${f1(r)} ${f1(r)} 0 0 0 0 ${f1(r)}A${f1(r * thin)} ${f1(r)} 0 0 1 0 ${f1(-r)}Z`
  return s('g', { class: 'g13-crescent', transform: `translate(${f1(cx)} ${f1(cy)}) rotate(${tilt})` },
    s('circle', { r: f1(r * 3), fill: 'url(#p2-halo)', class: 'g13-crescent-halo' }),
    s('circle', { r: f1(r), class: 'g13-crescent-ash' }),
    s('path', { d, class: 'g13-crescent-lit' }),
    s('path', { d: stroke(curve([0, -r], [-r * 1.33, 0], [0, r], 14), Math.max(0.8, r * 0.07), 0.3, 0.3, 0.1), class: 'g13-crescent-rim' }))
}

/** The first light: a warm glow (layers of the --dawn token) rising behind (cx, cy). */
export function dawnGlow(cx: number, cy: number, rx: number, ry: number, layers = 2): SVGGElement {
  g13Defs()
  return s('g', { class: 'g13-dawn' },
    ...Array.from({ length: layers }, (_, i) => s('ellipse', { cx: f1(cx), cy: f1(cy), rx: f1(rx * (1 - i * 0.35)), ry: f1(ry * (1 - i * 0.3)), fill: 'url(#g13-dawn)' })))
}

/** Mist that reads in both themes (the kit's fog is paper-white by day, a faint blue veil by night). */
export const fog = (cx: number, cy: number, rx: number, ry: number, cls = 'g13-fog') =>
  (g13Defs(), s('ellipse', { class: cls, cx: f1(cx), cy: f1(cy), rx: f1(rx), ry: f1(ry), fill: 'url(#g13-fog)' }))

/** A bamboo culm along pts (w wide): the cane, its nodes, a lit edge. Three path d's. */
export function bamboo(pts: Pt[], w: number, seed: number, nodeGap = w * 5): { cane: string; nodes: string; hi: string } {
  const r = rng(seed)
  const cane = stroke(pts, w, 0.02, 0.04, 0.75)
  let nodes = ''
  let run = nodeGap * (0.4 + r() * 0.4)
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]
    const L = Math.hypot(x1 - x0, y1 - y0) || 1
    for (let t = run; t < L; t += nodeGap * (0.85 + r() * 0.3)) {
      const x = x0 + ((x1 - x0) * t) / L, y = y0 + ((y1 - y0) * t) / L
      const nx = -(y1 - y0) / L, ny = (x1 - x0) / L
      nodes += stroke([[x - nx * w * 0.62, y - ny * w * 0.62], [x + nx * w * 0.62, y + ny * w * 0.62]], Math.max(0.7, w * 0.22), 0.2, 0.2, 0.5)
      run = t - L
    }
    run = Math.max(0, run)
  }
  const hi = stroke(pts.map(([x, y], i) => {
    const A = pts[Math.max(0, i - 1)], B = pts[Math.min(pts.length - 1, i + 1)]
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1
    return [x - ((B[1] - A[1]) / L) * w * 0.22, y + ((B[0] - A[0]) / L) * w * 0.22] as Pt
  }), Math.max(0.5, w * 0.18), 0.1, 0.1, 0.3)
  return { cane, nodes, hi }
}

/** Raked sand: rows of broken dry strokes between y0 and y1 (gap apart), bending by `bend`. d only. */
export function rakeD(x0: number, x1: number, y0: number, y1: number, gap: number, seed: number, bend = 0, w = 1.1): string {
  const r = rng(seed)
  let d = ''
  for (let y = y0; y <= y1; y += gap * (0.85 + r() * 0.3)) {
    for (let x = x0 + r() * 20; x < x1; ) {
      const len = 30 + r() * 90
      const e = Math.min(x1, x + len)
      const bow = (q: number) => y + Math.sin((q / (x1 - x0)) * Math.PI) * bend
      d += stroke([[x, bow(x - x0)], [(x + e) / 2, bow((x + e) / 2 - x0) + (r() - 0.5)], [e, bow(e - x0)]], w * (0.8 + r() * 0.5), 0.2, 0.2, 0.1)
      x = e + 5 + r() * 18
    }
  }
  return d
}

/** Rings of raked sand round (cx, cy) (radius rx0…rx1, flattened by k), each a few passes with dry gaps. d only. */
export function rakeRings(cx: number, cy: number, rx0: number, rx1: number, gap: number, k: number, seed: number, w = 1.2): string {
  const r = rng(seed)
  let d = ''
  for (let R = rx0; R <= rx1; R += gap) {
    let a = r() * 60
    while (a < 360 + 10) {
      const len = 40 + r() * 100
      const a1 = Math.min(a + len, a + 352)
      const pts: Pt[] = Array.from({ length: 13 }, (_, i) => {
        const t = ((a + ((a1 - a) * i) / 12) * Math.PI) / 180
        return [cx + Math.cos(t) * R, cy + Math.sin(t) * R * k]
      })
      d += stroke(pts, w * (0.8 + r() * 0.5), 0.15, 0.15, 0.1)
      a = a1 + 6 + r() * 22
    }
  }
  return d
}

/**
 * Flat stepping stones on the points (each its size, larger when near): contact shade, a rock face with a rough edge,
 * a lit crown. Kit classes (p2p-step*), so it reads like steppingStones() of the kit, along any curve.
 */
export function stonesOn(pts: Pt[], size: (i: number) => number, seed: number, cls = ''): SVGGElement {
  const r = rng(seed)
  let sh = '', face = '', hi = ''
  pts.forEach(([x, y], i) => {
    const rx = size(i) * (0.85 + r() * 0.3), ry = rx * 0.36
    sh += blob(x + rx * 0.08, y + ry * 0.5, rx * 1.05, ry, seed + i * 3, 0.06, 12)
    face += blob(x, y, rx, ry, seed + i, 0.1, 14)
    hi += stroke(curve([x - rx * 0.6, y - ry * 0.35], [x - rx * 0.1, y - ry * 0.85], [x + rx * 0.5, y - ry * 0.5], 6), Math.max(0.8, ry * 0.25), 0.3, 0.3, 0.1)
  })
  return s('g', { class: `p2p-steps ${cls}` },
    s('path', { class: 'p2p-step-sh', d: sh }),
    s('path', { class: 'p2p-step', d: face, filter: 'url(#ink-rough)' }),
    s('path', { class: 'g13-step-ink', d: face }),
    s('path', { class: 'p2p-step-hi', d: hi }))
}

/** Points spaced along a polyline: n of them from t0 to t1 (0…1 of its length). */
export function along(pts: Pt[], n: number, t0 = 0, t1 = 1): Pt[] {
  const L = [0]
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  const tot = L[L.length - 1]
  return Array.from({ length: n }, (_, k) => {
    const want = tot * (t0 + ((t1 - t0) * k) / Math.max(1, n - 1))
    let i = 1
    while (i < L.length - 1 && L[i] < want) i++
    const u = (want - L[i - 1]) / (L[i] - L[i - 1] || 1)
    return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u] as Pt
  })
}

/** A bed of moss: a soft green wash, a darker heart, a scatter of dabs at its edge. */
export function mossBed(x: number, y: number, rx: number, ry: number, seed: number): SVGGElement {
  const r = rng(seed)
  let dots = ''
  for (let i = 0; i < Math.round(rx / 2.2); i++) {
    const a = r() * Math.PI * 2, k = 0.55 + r() * 0.6
    dots += blob(x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k, 0.7 + r() * 1.3, 0.5 + r() * 0.7, seed + i, 0.2, 8)
  }
  return s('g', { class: 'g13-mossbed' },
    s('path', { class: 'p2p-wash g13-moss g13-moss-a', d: blob(x, y, rx, ry, seed, 0.25), filter: 'url(#ink-wash)' }),
    s('path', { class: 'p2p-wash g13-moss g13-moss-b', d: blob(x - rx * 0.1, y + ry * 0.1, rx * 0.55, ry * 0.6, seed + 1, 0.3), filter: 'url(#ink-wash)' }),
    s('path', { class: 'g13-moss-dot', d: dots }))
}

/** A plain d for a polyline (for clip paths and thin cords). */
export const polyD = (pts: Pt[]) => `M${pts.map(P).join('L')}`

/**
 * perspectiveCircle with a station painting both behind the pond (`back`, as the kit's `art`) and over its water
 * (`front`: mist in a well, a leaf, lamplight) — a second SVG between the pond and the stones, same viewBox.
 * `cls` goes on the circle's root so the station CSS can tune the kit's pond for this scene.
 */
export function paintedCircle(data: Perspectives, o: PerspectiveOpts, cls: string, paint: (g: PondGeo) => { back: SVGElement[]; front?: SVGElement[] }): SceneDef {
  let front: SVGSVGElement | null = null
  const def = perspectiveCircle(data, {
    ...o,
    sky: false,
    art: (g) => {
      g13Defs()
      const p = paint(g)
      if (front) {
        front.setAttribute('viewBox', `0 0 ${f1(g.w)} ${f1(g.h)}`)
        front.replaceChildren(...(p.front ?? []))
      }
      return p.back
    },
  })
  return {
    label: def.label,
    mount(ctx) {
      const out = def.mount(ctx)
      const stage = ctx.art.querySelector('.p2c-stage')
      ctx.art.querySelector('.p2c')?.classList.add(cls)
      front = s('svg', { class: 'g13-front', 'aria-hidden': 'true' })
      stage?.insertBefore(front, stage.querySelector('.p2c-stones'))
      return out
    },
  }
}

/** Where the kit puts stone k of n round the pond (same sums as perspectives.ts layout), for painting beside them. */
export function stoneSpots(g: PondGeo, n: number) {
  let bw = Math.min(140, Math.max(64, Math.min(g.w, g.h * 1.7) * 0.19))
  if (Math.min(g.w / 2 - bw * 1.15, (g.h / 2 - bw * 0.75 * 1.2) / 0.46, bw * 2.3) < 50) bw = 60
  const bh = bw * 0.75
  const RX = g.rx + bw * 0.62, RY = g.ry + bh * 0.56
  return {
    bw, bh,
    pts: Array.from({ length: n }, (_, k) => {
      const a = ((-90 + 180 / n + (k * 360) / n) * Math.PI) / 180
      return { a, x: g.cx + RX * Math.cos(a), y: g.cy + RY * Math.sin(a) }
    }),
  }
}
