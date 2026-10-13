import { h, nextId, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import { brush, ell, peaks, pine, poly, rng, type Pt, type TL } from '../t03/brush'
import { DESK_IDS, TABLE, type Desk } from './desks'

/**
 * The room the team works in: a shoji wall slid open on a dawn garden, a long plank floor, mist drifting
 * past the opening. Desks stand at two depths (far ones smaller and paler) and never line up in a grid.
 */

/** x = centre, y = bottom of the 4:3 drawing, w = drawing width, d = depth 0 (far) … 1 (near) */
export interface Spot { x: number; y: number; w: number; d: number }
export interface Plan { mode: 'rows' | 'band' | 'tall'; spots: Spot[]; horizon: number; opening: [number, number] }

const KB = 0.82

/**
 * Lay out six desks under `top` in a W×H box (N = the name line under each desk).
 * Three shapes compete and the one giving the biggest desks wins:
 *  rows — far row of three behind a near row of three, staggered;
 *  band — the same zigzag pressed into one deep band (wide, short screens);
 *  tall — three rows of two receding up the screen (phones).
 */
export function plan(W: number, H: number, top: number, N: number, maxW = 440): Plan {
  const rows = Math.min((W * 0.94) / 3.14, (H - top - 2 * N) / 1.27, maxW)
  const band = Math.min((W - 240) / 3.14, (H - top - N) / 0.93, maxW)
  const tall = Math.min(W * 0.47, (H - top - 3 * N) / 1.84, maxW * 0.8)
  const mode = tall > Math.max(rows, band) * 1.04 ? 'tall' : band > rows * 1.08 ? 'band' : 'rows'
  if (mode === 'tall') {
    const dw = Math.max(50, tall)
    const lift = Math.max(0, H - top - 1.84 * dw - 3 * N) * 0.4
    const y2 = H - N - lift
    const y1 = y2 - 0.75 * dw * 0.87 - N
    const y0 = y1 - 0.75 * dw * 0.9 * 0.87 - N
    const ys = [y0, y1, y2]
    const ks = [0.8, 0.9, 1]
    const jy = [0, 0.02, -0.015, 0.01, 0.02, -0.01]
    const spots = Array.from({ length: 6 }, (_, i) => {
      const r = i >> 1
      return { x: W / 2 + (i & 1 ? 1 : -1) * W * 0.22 + (r % 2 ? -1 : 1) * W * 0.035, y: ys[r] + jy[i] * dw, w: ks[r] * dw * (1 + jy[i]), d: r / 2 }
    })
    return { mode, spots, horizon: y0 - 0.8 * 0.75 * dw * 0.46, opening: [W * 0.54, W * 0.94] }
  }
  const dw = Math.max(50, mode === 'rows' ? rows : band)
  // the far desk stands at the left end, a near one at the right
  const mL = 0.47 * KB * dw
  const mR = 0.47 * dw
  const Wc = Math.min(W * 0.94, dw * 4.3)
  const step = (Wc - mL - mR) / 5
  const need = mode === 'rows' ? 1.27 * dw + 2 * N : 0.93 * dw + N
  const lift = Math.max(0, H - top - need) * 0.4
  const yf = H - N - lift
  const yb = mode === 'rows' ? yf - 0.75 * dw * 0.87 - N : yf - 0.315 * dw
  // near desks (even i) take the odd places, far ones the even: the heavy near row sits toward the light at the right.
  // a hand-placed feel: nothing quite on a line (a desk set a little nearer is drawn a little larger)
  const J = [[0, 0, 0], [0.08, -0.025, -0.02], [-0.05, 0.02, 0.015], [-0.06, 0.018, 0.02], [0.04, -0.012, -0.01], [0.02, -0.03, -0.03]]
  const spots = DESK_IDS.map((_, i) => {
    const k = i ^ 1
    const near = i % 2 === 0
    return { x: mL + (k + J[k][0]) * step, y: (near ? yf : yb) + J[k][1] * dw, w: (near ? 1 : KB) * dw * (1 + J[k][2]), d: near ? 1 : 0 }
  })
  // centre on what is actually drawn (each table's ends), so neither side of the room is left empty
  const lo = Math.min(...spots.map((p, i) => p.x + (TABLE[DESK_IDS[i]][0] / 240 - 0.5) * p.w))
  const hi = Math.max(...spots.map((p, i) => p.x + (TABLE[DESK_IDS[i]][1] / 240 - 0.5) * p.w))
  const dx = (W - lo - hi) / 2
  spots.forEach((p) => (p.x += dx))
  return { mode, spots, horizon: yb - KB * 0.75 * dw * 0.42, opening: [lo + dx + (hi - lo) * 0.55, lo + dx + (hi - lo) * 0.84] }
}

/** Place desk buttons (drawing + name line) on their spots. The hit box is a little narrower than the drawing. */
export function placeDesks(btns: HTMLElement[], pl: Plan, N: number) {
  btns.forEach((b, i) => {
    const { x, y, w, d } = pl.spots[i]
    const bw = w * 0.84
    const dh = w * 0.75
    Object.assign(b.style, { left: `${x - bw / 2}px`, top: `${y - dh}px`, width: `${bw}px`, height: `${dh + N}px`, zIndex: String(2 + Math.round(d * 2)) })
    b.style.setProperty('--w', `${w}px`)
    b.style.setProperty('--d', String(d))
  })
}

const f1 = (n: number) => n.toFixed(1)
const line = (pts: Pt[], w: number, cls: string, op: number, o: Parameters<typeof brush>[2] = {}) =>
  s('path', { d: brush(pts, w, o).d, class: cls, 'fill-opacity': op })

/**
 * Paint the room into `svg` (W×H, redrawn on resize). quiet: no shoji lattice, for a busier scene.
 * clear: keep the sun below this line (the game's tray hangs over the opening) — it sinks low, onto the far ridges.
 */
export function paintRoom(svg: SVGSVGElement, W: number, H: number, pl: Plan, { quiet = false, clear = 0 } = {}) {
  const id = nextId('t11r')
  const r = rng(11)
  const hz = pl.horizon
  const lintel = Math.max(6, Math.min(hz * 0.08, 40))
  const sill = hz - (hz - lintel) * 0.15
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
  const stop = (o: number, a: number) => s('stop', { offset: o, 'stop-color': '#fff', 'stop-opacity': a })
  const fadeTop = Math.min(0.4, (lintel + (hz - lintel) * 0.35) / H)
  const defs = s('defs', null,
    s('linearGradient', { id: `${id}-h` }, stop(0, 0), stop(0.08, 1), stop(0.92, 1), stop(1, 0)),
    s('linearGradient', { id: `${id}-v`, x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, 0.15), stop(fadeTop, 1), stop(0.9, 1), stop(1, 0.35)),
    s('mask', { id: `${id}-mh`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, s('rect', { width: W, height: H, fill: `url(#${id}-h)` })),
    s('mask', { id: `${id}-mv`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, s('rect', { width: W, height: H, fill: `url(#${id}-v)` })))

  // ── the shoji wall, panel by panel; two panels slid aside onto the garden ──
  const pw = Math.max(64, Math.min(150, (hz - lintel) * 0.5))
  const n = Math.ceil(W / pw) + 2
  const ox = W / 2 - (n * pw) / 2
  const bx = Array.from({ length: n + 1 }, (_, k) => ox + k * pw)
  const oc = (pl.opening[0] + pl.opening[1]) / 2
  const span = Math.max(2, Math.round((pl.opening[1] - pl.opening[0]) / pw))
  let k0 = 0
  for (let k = 0; k < bx.length; k++) if (Math.abs(bx[k] + (span * pw) / 2 - oc) < Math.abs(bx[k0] + (span * pw) / 2 - oc)) k0 = k
  const o0 = bx[k0]
  const o1 = bx[Math.min(bx.length - 1, k0 + span)]
  const wall = s('g', { filter: 'url(#ink-rough)' })
  const koshi = s('g', null)
  bx.forEach((x, k) => {
    if (x > o0 + 1 && x < o1 - 1) return
    wall.append(line([[x, lintel], [x + 0.6, sill]], 1.8, 'k3', 0.3, { straight: true, a: 0.02, b: 0.06, min: 0.5 }))
    if (k === bx.length - 1 || (x >= o0 - 1 && x < o1 - 1)) return
    const x2 = bx[k + 1]
    koshi.append(s('rect', { x, y: sill, width: pw, height: hz - sill, class: 'k', 'fill-opacity': 0.03 }), s('rect', { x: x + 2, y: lintel + 2, width: pw - 4, height: sill - lintel - 4, class: 'washi' }))
    if (quiet) return
    for (const f of [0.34, 0.67]) wall.append(line([[x + 3, lintel + (sill - lintel) * f], [x2 - 3, lintel + (sill - lintel) * f]], 0.8, 'k3', 0.1, { straight: true, a: 0.05, b: 0.05, wob: 0 }))
  })
  wall.append(line([[-10, lintel], [W * 0.5, lintel + 0.6], [W + 10, lintel - 0.4]], 2.4, 'k3', 0.26, { a: 0.02, b: 0.02, wob: 0.05 }))
  wall.append(line([[-10, sill], [o0 - 2, sill]], 1.2, 'k3', 0.18, { straight: true, a: 0.02, b: 0.02 }))
  wall.append(line([[o1 + 2, sill], [W + 10, sill]], 1.2, 'k3', 0.18, { straight: true, a: 0.02, b: 0.02 }))

  // ── the garden outside: a pale sky, the sun (a moon at night), far ridges, a pine reaching in ──
  const ow = o1 - o0
  const oh = hz - lintel
  const clip = s('clipPath', { id: `${id}-o` }, s('rect', { x: o0, y: lintel, width: ow, height: oh }))
  defs.append(clip)
  const out = s('g', { 'clip-path': `url(#${id}-o)` })
  out.append(s('rect', { x: o0, y: lintel, width: ow, height: oh, class: 'sky' }))
  const R = Math.min(ow * 0.15, oh * (clear ? 0.14 : 0.17))
  const sy = Math.min(Math.max(lintel + oh * 0.34, clear + R * 1.25), hz - R * 0.35)
  out.append(s('path', { d: ell(o0 + ow * (clear ? 0.5 : 0.66), sy, R), class: 'sun', filter: 'url(#ink-wash)' }))
  const rg = s('g', { filter: 'url(#ink-wash)' })
  for (const [b, h0, h1, op] of [[hz - oh * 0.05, 0.1, 0.26, 0.07], [hz + 2, 0.05, 0.14, 0.12]] as const)
    for (const { d } of peaks(r, o0 - ow * 0.2, o1 + ow * 0.2, b, oh * h0, oh * h1, ow * 0.2)) rg.append(s('path', { d, class: 'k', 'fill-opacity': op }))
  out.append(rg)
  const bw = Math.max(2.4, Math.min(7, ow * 0.022))
  const y0 = lintel + oh * 0.16
  const pn = pine(r, [[o1 + bw * 4, y0], [o1 - ow * 0.12, y0 + oh * 0.06], [o1 - ow * 0.26, y0 + oh * 0.03], [o1 - ow * 0.4, y0 + oh * 0.11]], bw, 3)
  out.append(
    s('g', { filter: 'url(#ink-wash)' }, ...pn.pads.map((d) => s('path', { d, class: 'k', 'fill-opacity': 0.08 }))),
    s('g', { filter: 'url(#ink-rough)' },
      s('path', { d: pn.bough, class: 'k2', 'fill-opacity': 0.55 }),
      ...pn.twigs.map((d) => s('path', { d, class: 'k2', 'fill-opacity': 0.5 })),
      ...pn.needles.map((d) => s('path', { d, class: 'k2', 'fill-opacity': 0.32 }))))
  // the slid doors stand stacked beside the opening: two close frame lines
  const jamb = s('g', { filter: 'url(#ink-rough)' })
  for (const [x, dx] of [[o0, -5], [o1, 5]] as const) {
    jamb.append(line([[x, lintel], [x + 0.5, hz]], 2.6, 'k2', 0.38, { straight: true, a: 0.02, b: 0.04, min: 0.6 }))
    jamb.append(line([[x + dx, lintel + 2], [x + dx + 0.4, sill]], 1.4, 'k3', 0.26, { straight: true, a: 0.04, b: 0.06, min: 0.5 }))
  }

  // ── the floor: one long threshold, plank seams opening up toward us, a pool of light from the garden ──
  const floor = s('g', null)
  floor.append(s('rect', { x: 0, y: hz, width: W, height: H - hz, class: 'k', 'fill-opacity': 0.022 }))
  const sh = (H - hz) * 0.5
  defs.append(s('linearGradient', { id: `${id}-l`, gradientUnits: 'userSpaceOnUse', x1: 0, y1: hz, x2: 0, y2: H }, s('stop', { offset: 0, class: 'bm0' }), s('stop', { offset: 1, class: 'bm1' })))
  floor.append(s('path', { d: poly([[o0 + 8, hz + 3], [o1 - 8, hz + 3], [o1 - sh + ow * 0.2, H], [o0 - sh - ow * 0.16, H]]), fill: `url(#${id}-l)`, filter: 'url(#ink-wash)' }))
  const seams = s('g', { filter: 'url(#ink-rough)' })
  for (let k = 1; k <= 5; k++) {
    const y = hz + (H - hz) * (k / 5.4) ** 1.45
    seams.append(line([[-10, y], [W * (0.3 + r() * 0.4), y + (r() - 0.5) * 1.5], [W + 10, y]], 0.9 + k * 0.16, 'k3', 0.11, { a: 0.03, b: 0.03, min: 0.4, wob: 0.18 }))
  }
  seams.append(line([[-10, hz], [W * 0.4, hz + 0.8], [W + 10, hz - 0.3]], 2.4, 'k2', 0.36, { a: 0.02, b: 0.02, wob: 0.06 }))
  seams.append(line([[-10, hz + 5], [W + 10, hz + 5.5]], 1, 'k3', 0.2, { straight: true, a: 0.02, b: 0.02 }))
  // one shared shadow under each row of desks
  const shade = s('g', { filter: 'url(#ink-wash)' })
  for (const far of [true, false]) {
    const row = pl.spots.filter((p) => (pl.mode === 'tall' ? false : (p.d < 0.5) === far))
    if (!row.length) continue
    const xs = row.map((p) => p.x)
    const w = row[0].w
    const y = row[0].y - w * 0.04
    shade.append(s('path', { d: ell((Math.min(...xs) + Math.max(...xs)) / 2, y, (Math.max(...xs) - Math.min(...xs)) / 2 + w * 0.5, w * 0.045), class: 'k', 'fill-opacity': far ? 0.04 : 0.05 }))
  }
  if (pl.mode === 'tall') for (const p of pl.spots) shade.append(s('path', { d: ell(p.x, p.y - p.w * 0.04, p.w * 0.5, p.w * 0.05), class: 'k', 'fill-opacity': 0.045 }))
  floor.append(seams, shade)

  svg.replaceChildren(defs,
    s('g', { mask: `url(#${id}-mh)` }, s('g', { mask: `url(#${id}-mv)` }, out, koshi, wall, jamb, floor)))
  return { o0, o1, lintel, hz }
}

/** Two slow banks of mist, drifting across the opening (HTML, so they move on the compositor). */
export function makeMist(reduced: boolean) {
  const els = [0, 1, 2].map((i) => h('div', { class: 't11-mist', 'aria-hidden': 'true', style: `--i:${i}` }))
  const tw = reduced ? [] : els.map((el, i) => gsap.fromTo(el, { xPercent: i % 2 ? 10 : -12 }, { xPercent: i % 2 ? -14 : 12, duration: 26 + i * 9, ease: 'sine.inOut', yoyo: true, repeat: -1 }))
  return {
    els,
    place(W: number, room: { o0: number; o1: number; lintel: number; hz: number }) {
      const ow = room.o1 - room.o0
      const oh = room.hz - room.lintel
      els.forEach((el, i) => {
        const w = Math.min(W * 0.7, ow * (1.5 + i * 0.4))
        const hh = Math.max(26, oh * (0.34 - i * 0.06))
        const cx = i === 2 ? room.o0 - ow * 0.4 : room.o0 + ow * (0.5 + (i ? 0.25 : -0.1))
        Object.assign(el.style, { left: `${f1(cx - w / 2)}px`, top: `${f1(room.hz - hh * (0.62 + i * 0.1))}px`, width: `${f1(w)}px`, height: `${f1(hh)}px` })
      })
    },
    stop: () => tw.forEach((t) => t.kill()),
  }
}

/** Now and then one desk (never the same twice running) plays its small idle gesture. Returns stop. */
export function idler(desks: Desk[], after = 3.5) {
  let last = -1
  let tl: TL | null = null
  let call = gsap.delayedCall(after, next)
  function next() {
    let i = Math.floor(Math.random() * desks.length)
    if (i === last) i = (i + 1) % desks.length
    last = i
    tl = desks[i].idle()
    call = gsap.delayedCall(2.4 + Math.random() * 2, next)
  }
  return () => {
    call.kill()
    tl?.progress(1).kill()
  }
}
