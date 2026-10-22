import raw from '../../content/tram-33.json'
import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import { blob, clamp, curve, onDigit, onSize, rng, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist, moon, pine, reeds, toro } from '../../ui/part2/paint'
import { guide, type Mark } from '../../ui/part2/guide'
import type { SceneCtx } from '../types'
import './house.css'
import { f1, lantern, live, P, t33Defs } from './kit'

const K = raw.scenes.house
type V3 = [number, number, number]
const D2R = Math.PI / 180
const YAW = [-40, 40], PITCH = [15, 45], HOME = { yaw: 20, pitch: 34 }
/** the moon, upper left and in front (view space, y up = negative) */
const LIGHT: V3 = (() => {
  const v: V3 = [-0.45, -0.55, 0.7]
  const l = Math.hypot(...v)
  return v.map((x) => x / l) as V3
})()

const svg = (w: number, hh: number, ...kids: (SVGElement | null)[]) =>
  s('svg', { class: 't33h-art', viewBox: `0 0 ${f1(w)} ${f1(hh)}`, width: f1(w), height: f1(hh), 'aria-hidden': 'true' }, ...kids)
const lines = (ls: number[][], w: number) => ls.map(([a, b, c, d]) => stroke([[a, b], [c, d]], w, 0.12, 0.12, 0.4)).join('')
const rect = (x: number, y: number, w: number, hh: number) => `M${f1(x)} ${f1(y)}h${f1(w)}v${f1(hh)}h${f1(-w)}Z`

// ── painted surfaces (px of the face; origin top-left) ─────────────────────────────────────────────────────────

/** Wood: a face of boards running along `along` ('x' | 'y'), long grain, an ink edge on the shaded side, a moonlit edge. */
function wood(w: number, hh: number, seed: number, along: 'x' | 'y' = 'y', board = 0, cls = 't33h-wood') {
  const r = rng(seed)
  let seams = '', grain = ''
  const L = along === 'y' ? hh : w, A = along === 'y' ? w : hh
  const n = board ? Math.max(1, Math.round(A / board)) : 1
  for (let i = 1; i < n; i++) {
    const a = (A * i) / n + (r() - 0.5) * 2
    seams += along === 'y' ? stroke([[a, 0], [a + (r() - 0.5) * 1.5, hh]], 1.1, 0.02, 0.02, 0.5) : stroke([[0, a], [w, a + (r() - 0.5) * 1.5]], 1.1, 0.02, 0.02, 0.5)
  }
  const g = Math.max(2, Math.round((A / 6) * Math.min(1, L / 40)))
  for (let i = 0; i < g; i++) {
    const a = r() * A, l0 = r() * L * 0.5, l1 = l0 + L * (0.25 + r() * 0.5)
    const pts: Pt[] = along === 'y' ? [[a, l0], [a + (r() - 0.5) * 2, (l0 + l1) / 2], [a + (r() - 0.5) * 2, l1]] : [[l0, a], [(l0 + l1) / 2, a + (r() - 0.5) * 2], [l1, a + (r() - 0.5) * 2]]
    grain += stroke(pts, 0.5 + r() * 0.8, 0.25, 0.3, 0.1)
  }
  return svg(w, hh,
    s('rect', { class: cls, width: f1(w), height: f1(hh) }),
    s('path', { class: 't33h-grain', d: grain }),
    seams ? s('path', { class: 't33h-seam', d: seams }) : null)
}

/** Plaster panel with a wainscot and a tie beam (back and side walls), posts every `bay` px (0 = none). */
function plaster(w: number, hh: number, seed: number, bay: number, post: number) {
  const r = rng(seed)
  const kids: SVGElement[] = [s('rect', { class: 't33h-plaster', width: f1(w), height: f1(hh) })]
  // stains and trowel marks, faint
  let stain = ''
  for (let i = 0; i < Math.round(w / 40); i++) stain += blob(r() * w, hh * (0.15 + r() * 0.5), 8 + r() * 22, 4 + r() * 12, seed + i, 0.3, 10)
  kids.push(s('path', { class: 't33h-stain', d: stain }))
  const wy = hh * 0.7
  kids.push(s('rect', { class: 't33h-wainscot', y: f1(wy), width: f1(w), height: f1(hh - wy) }))
  let boards = ''
  for (let x = 6; x < w; x += Math.max(7, hh * 0.08)) boards += stroke([[x, wy + 1], [x + 0.4, hh]], 0.9, 0.05, 0.05, 0.4)
  kids.push(s('path', { class: 't33h-seam', d: boards }))
  const beams = stroke([[0, hh * 0.06], [w, hh * 0.06]], Math.max(3, hh * 0.07), 0.01, 0.01, 0.8) + stroke([[0, hh * 0.38], [w, hh * 0.38 + 0.6]], Math.max(2.4, hh * 0.05), 0.01, 0.01, 0.8) + stroke([[0, wy], [w, wy]], Math.max(1.6, hh * 0.025), 0.01, 0.01, 0.8)
  kids.push(s('path', { class: 't33h-beam', d: beams, filter: 'url(#ink-rough)' }))
  if (bay) {
    let posts = ''
    for (let x = 0; x <= w + 1; x += bay) posts += rect(Math.min(w - post, Math.max(0, x - post / 2)), 0, post, hh)
    kids.push(s('path', { class: 't33h-postp', d: posts, filter: 'url(#ink-rough)' }))
  }
  // the room's dark corner up under the roof
  kids.push(s('rect', { class: 't33h-ao', width: f1(w), height: f1(hh * 0.3) }))
  return kids
}

/** What hangs on the back wall of a bay (px of one bay, B wide × Hw tall), drawn into the back wall. */
function wallArt(k: number, x0: number, B: number, Hw: number, seed: number): SVGElement[] {
  const cx = x0 + B / 2
  const r = rng(seed)
  if (k === 0) {
    // soot from the hearth fire climbing the wall
    return [s('path', { class: 't33h-soot', d: blob(cx, Hw * 0.25, B * 0.34, Hw * 0.3, seed, 0.25, 14), filter: 'url(#ink-wash)' })]
  }
  if (k === 1) {
    // the tool board: a rail with pegs, the tools hanging, each on a cord to a socket plate below (tools plugged in: MCP)
    const ry = Hw * 0.2
    const tools: string[] = []
    const xs = [0.2, 0.38, 0.56, 0.76].map((f) => x0 + B * f)
    const ink = stroke([[x0 + B * 0.1, ry], [x0 + B * 0.9, ry]], Math.max(2.4, B * 0.03), 0.02, 0.02, 0.7)
    // saw, mallet, chisel, sickle
    tools.push(`M${f1(xs[0] - B * 0.02)} ${f1(ry)}L${f1(xs[0] + B * 0.03)} ${f1(ry)}L${f1(xs[0] + B * 0.05)} ${f1(ry + Hw * 0.3)}L${f1(xs[0] - B * 0.04)} ${f1(ry + Hw * 0.3)}Z`)
    tools.push(rect(xs[1] - B * 0.008, ry, B * 0.016, Hw * 0.22) + rect(xs[1] - B * 0.05, ry + Hw * 0.2, B * 0.1, Hw * 0.08))
    tools.push(rect(xs[2] - B * 0.01, ry, B * 0.02, Hw * 0.16) + `M${f1(xs[2] - B * 0.016)} ${f1(ry + Hw * 0.16)}h${f1(B * 0.032)}l${f1(-B * 0.008)} ${f1(Hw * 0.12)}h${f1(-B * 0.016)}Z`)
    tools.push(stroke(curve([xs[3], ry], [xs[3] + B * 0.1, ry + Hw * 0.06], [xs[3] + B * 0.02, ry + Hw * 0.2], 10), Math.max(1.6, B * 0.02), 0.1, 0.5, 0.3) + rect(xs[3] - B * 0.008, ry, B * 0.016, Hw * 0.12))
    const plate = rect(x0 + B * 0.2, Hw * 0.6, B * 0.6, Hw * 0.08)
    let sockets = '', cords = ''
    xs.forEach((x, i) => {
      const sx = x0 + B * (0.28 + i * 0.15), sy = Hw * 0.64
      sockets += blob(sx, sy, B * 0.022, B * 0.022, seed + i, 0, 8)
      cords += stroke(curve([x, ry + Hw * (i === 0 ? 0.3 : 0.24)], [x + (sx - x) * 0.3, Hw * 0.62], [sx, sy], 10), 0.9, 0.05, 0.05, 0.5)
    })
    return [
      s('path', { class: 't33h-wallshadow', d: rect(x0 + B * 0.12, ry + 3, B * 0.8, Hw * 0.34), filter: 'url(#ink-wash)' }),
      s('path', { class: 't33h-beam', d: ink, filter: 'url(#ink-rough)' }),
      s('path', { class: 't33h-iron', d: tools.join('') }),
      s('path', { class: 't33h-cord', d: cords }),
      s('path', { class: 't33h-wood-hi', d: plate }),
      s('path', { class: 't33h-socket', d: sockets }),
    ]
  }
  if (k === 3) {
    // a round moon window (marumado) with a lattice
    const wy = Hw * 0.3, rr = Math.min(B * 0.2, Hw * 0.18)
    let lat = ''
    for (let i = -2; i <= 2; i++) lat += stroke([[cx + i * rr * 0.36, wy - rr], [cx + i * rr * 0.36, wy + rr]], 1, 0.05, 0.05, 0.6)
    lat += stroke([[cx - rr, wy], [cx + rr, wy]], 1, 0.05, 0.05, 0.6)
    return [
      s('circle', { class: 't33h-window', cx: f1(cx), cy: f1(wy), r: f1(rr) }),
      s('path', { class: 't33h-lattice', d: lat }),
      s('circle', { class: 't33h-winrim', cx: f1(cx), cy: f1(wy), r: f1(rr), filter: 'url(#ink-rough)' }),
    ]
  }
  if (k === 4) {
    // the gate: the wall opens onto the night, a sliding door half open, stepping stones going out
    const ox = x0 + B * 0.1, ow = B * 0.8
    let st = ''
    for (let i = 0; i < 3; i++) st += blob(cx + (r() - 0.5) * B * 0.2, Hw * (0.92 - i * 0.07), B * (0.12 - i * 0.025), Hw * (0.025 - i * 0.004), seed + i, 0.1, 10)
    return [
      s('rect', { class: 't33h-out', x: f1(ox), y: f1(Hw * 0.08), width: f1(ow), height: f1(Hw * 0.92) }),
      s('circle', { class: 't33h-outmoon', cx: f1(ox + ow * 0.7), cy: f1(Hw * 0.3), r: f1(B * 0.3) }),
      s('path', { class: 't33h-outhill', d: `M${f1(ox)} ${f1(Hw * 0.78)}Q${f1(ox + ow * 0.3)} ${f1(Hw * 0.62)} ${f1(ox + ow * 0.55)} ${f1(Hw * 0.74)}T${f1(ox + ow)} ${f1(Hw * 0.7)}V${f1(Hw)}H${f1(ox)}Z` }),
      s('path', { class: 't33h-outstep', d: st }),
      s('path', { class: 't33h-door', d: rect(ox - B * 0.02, Hw * 0.08, ow * 0.42, Hw * 0.92) }),
      s('path', { class: 't33h-lattice', d: lines([[ox + ow * 0.1, Hw * 0.1, ox + ow * 0.1, Hw], [ox + ow * 0.24, Hw * 0.1, ox + ow * 0.24, Hw], [ox - B * 0.02, Hw * 0.35, ox + ow * 0.4, Hw * 0.35], [ox - B * 0.02, Hw * 0.6, ox + ow * 0.4, Hw * 0.6]], 1.1) }),
      s('path', { class: 't33h-beam', d: stroke([[ox - B * 0.02, Hw * 0.08], [ox - B * 0.02, Hw]], 2.2, 0.02, 0.02, 0.6) + stroke([[ox + ow * 0.4, Hw * 0.08], [ox + ow * 0.4, Hw]], 2.2, 0.02, 0.02, 0.6), filter: 'url(#ink-rough)' }),
    ]
  }
  return []
}

/** Raked sand on the plinth (px Wp × Dp, top view, v = 0 at the back): rows, rings round two rocks, stepping stones out of the gate, the house's shadow. */
function sand(Wp: number, Dp: number, B: number, house: [number, number, number, number], rocks: Pt[], gate: number, seed: number) {
  const r = rng(seed)
  const [hx, hv, hw, hd] = house
  let rows = ''
  for (let v = 5; v < Dp - 2; v += Math.max(5, B * 0.07)) {
    const pts: Pt[] = []
    for (let i = 0; i <= 18; i++) pts.push([(Wp * i) / 18, v + Math.sin(i * 0.8 + v * 0.07) * 0.8])
    rows += `M${pts.map(P).join('L')}`
  }
  const kids: SVGElement[] = [
    s('rect', { class: 't33h-sandf', width: f1(Wp), height: f1(Dp) }),
    s('path', { class: 't33h-rake', d: rows }),
    s('path', { class: 't33h-rake-hi', d: rows, transform: 'translate(0 1.4)' }),
  ]
  // rings round each rock: smooth the rows away, then rake the rings
  for (const [i, [x, v]] of rocks.entries()) {
    const R = B * (i ? 0.32 : 0.46)
    kids.push(s('ellipse', { class: 't33h-sandf', cx: f1(x), cy: f1(v), rx: f1(R + B * 0.34), ry: f1(R + B * 0.3) }))
    let d = ''
    for (let k = 0; k < 4; k++) d += blob(x, v, R + k * B * 0.085, R * 0.9 + k * B * 0.08, seed + i, 0.03, 26)
    kids.push(s('path', { class: 't33h-ring', d }), s('path', { class: 't33h-ring-hi', d, transform: 'translate(0 1.4)' }))
  }
  // the house throws its moon shadow back and to the right
  kids.push(s('path', { class: 't33h-cast', d: `M${f1(hx + hw * 0.05)} ${f1(hv)}L${f1(hx + hw + B * 0.55)} ${f1(hv - B * 0.38)}L${f1(hx + hw + B * 0.55)} ${f1(hv + hd - B * 0.3)}L${f1(hx + hw)} ${f1(hv + hd)}L${f1(hx + hw)} ${f1(hv)}Z`, filter: 'url(#ink-wash)' }))
  kids.push(s('path', { class: 't33h-contact', d: rect(hx - 3, hv + hd - 2, hw + 6, B * 0.08), filter: 'url(#ink-wash)' }))
  // stepping stones out of the gate toward the front edge
  for (let i = 0; i < 3; i++) {
    const cx = gate + (r() - 0.5) * B * 0.18 + i * B * 0.08, cy = hv + hd + B * (0.18 + i * 0.2)
    const rx = B * (0.17 + r() * 0.04), ry = rx * 0.7
    kids.push(
      s('path', { class: 't33h-cast', d: blob(cx + rx * 0.3, cy - ry * 0.2, rx * 1.1, ry, seed + 9 + i, 0.12), filter: 'url(#ink-wash)' }),
      s('path', { class: 't33h-stoneside', d: blob(cx, cy + ry * 0.2, rx, ry, seed + 9 + i, 0.1, 14) }),
      s('path', { class: 't33h-stonetop', d: blob(cx, cy, rx, ry, seed + 9 + i, 0.1, 14), filter: 'url(#ink-rough)' }))
  }
  // a little moss where the sand meets the rocks
  kids.push(s('path', { class: 't33h-moss', d: rocks.map(([x, v], i) => blob(x - B * 0.2, v + B * 0.18, B * 0.16, B * 0.06, seed + 20 + i, 0.4, 12)).join(''), filter: 'url(#ink-wash)' }))
  return svg(Wp, Dp, ...kids)
}

/** The house floor (px W × D, v = 0 at the back wall): polished boards, the sunken hearth in bay 0, beaten earth in the gate bay, the partitions' moon shadows. */
function floorArt(W: number, D: number, B: number, part: number, seed: number) {
  const r = rng(seed)
  const kids: SVGElement[] = [...wood(W, D, seed, 'y', B * 0.16, 't33h-floorwood').children as unknown as SVGElement[]]
  // the gate bay: beaten earth (doma)
  kids.push(s('rect', { class: 't33h-doma', x: f1(B * 4), width: f1(B), height: f1(D) }))
  let pits = ''
  for (let i = 0; i < 26; i++) pits += blob(B * 4 + r() * B, r() * D, 0.8 + r() * 1.4, 0.6 + r(), seed + i, 0.2, 6)
  kids.push(s('path', { class: 't33h-pits', d: pits }))
  // the hearth (irori): a wooden frame, grey ash, the embers (they glow when the bay is lit)
  const hs = Math.min(B * 0.46, D * 0.42), hx = B * 0.5 - hs / 2, hy = D * 0.55 - hs / 2
  kids.push(
    s('path', { class: 't33h-hearthframe', d: rect(hx - 4, hy - 4, hs + 8, hs + 8), filter: 'url(#ink-rough)' }),
    s('rect', { class: 't33h-ash', x: f1(hx), y: f1(hy), width: f1(hs), height: f1(hs) }),
    s('path', { class: 't33h-ember', d: blob(B * 0.5, D * 0.55, hs * 0.2, hs * 0.14, seed, 0.35, 12) + blob(B * 0.46, D * 0.6, hs * 0.08, hs * 0.05, seed + 1, 0.3, 8) }),
    s('path', { class: 't33h-coal', d: blob(B * 0.52, D * 0.53, hs * 0.1, hs * 0.07, seed + 2, 0.3, 8) + blob(B * 0.43, D * 0.56, hs * 0.07, hs * 0.05, seed + 3, 0.3, 8) }))
  // the moon from the left: each partition and the left wall lay a slanted shadow over the floor beside them
  let sh = ''
  for (let k = 0; k < 5; k++) {
    const x = k * B, d = k === 0 ? D : part
    sh += `M${f1(x)} 0L${f1(x)} ${f1(d)}L${f1(x + B * 0.42)} ${f1(Math.min(D, d + B * 0.2))}L${f1(x + B * 0.42)} ${f1(B * 0.12)}Z`
  }
  kids.push(s('path', { class: 't33h-floorsh', d: sh, filter: 'url(#ink-wash)' }))
  // the back of the room is dark; a gleam of moon on the boards near the front
  kids.push(s('rect', { class: 't33h-floorao', width: f1(W), height: f1(D * 0.35) }))
  let gleam = ''
  for (let k = 0; k < 4; k++) gleam += stroke([[k * B + B * 0.55, D * 0.7], [k * B + B * 0.95, D * 0.96]], Math.max(2, B * 0.04), 0.3, 0.3, 0.1)
  kids.push(s('path', { class: 't33h-gleam', d: gleam }))
  return svg(W, D, ...kids)
}

/** A shōji partition (px w × hh): wood frame, paper panels in a lattice; it glows when a bay beside it is lit. */
function shoji(w: number, hh: number) {
  let lat = ''
  const cols = Math.max(2, Math.round(w / 18)), rows = Math.max(3, Math.round(hh / 22))
  for (let i = 1; i < cols; i++) lat += stroke([[(w * i) / cols, hh * 0.06], [(w * i) / cols, hh * 0.72]], 0.9, 0.02, 0.02, 0.6)
  for (let j = 1; j < rows; j++) {
    const y = hh * 0.06 + ((hh * 0.66) * j) / rows
    lat += stroke([[2, y], [w - 2, y]], 0.9, 0.02, 0.02, 0.6)
  }
  return svg(w, hh,
    s('rect', { class: 't33h-paperp', y: f1(hh * 0.06), width: f1(w), height: f1(hh * 0.66) }),
    s('rect', { class: 't33h-warm', y: f1(hh * 0.06), width: f1(w), height: f1(hh * 0.66) }),
    s('rect', { class: 't33h-wood', y: f1(hh * 0.72), width: f1(w), height: f1(hh * 0.28) }),
    s('path', { class: 't33h-lattice', d: lat }),
    s('path', { class: 't33h-beam', d: rect(0, 0, w, hh * 0.06) + rect(0, hh * 0.7, w, hh * 0.03) + rect(0, 0, 3, hh) + rect(w - 3, 0, 3, hh), filter: 'url(#ink-rough)' }),
    s('rect', { class: 't33h-ao', width: f1(w), height: f1(hh * 0.3) }))
}

/** Roof underside (px w × L, ridge at the top): straw between bamboo battens, rafters down the slope, darker toward the ridge. */
function underside(w: number, L: number, B: number, seed: number) {
  const r = rng(seed)
  let raf = '', bat = '', straw = ''
  for (let x = B * 0.08; x < w; x += B * 0.24) raf += stroke([[x, 0], [x + 0.5, L]], Math.max(2.4, B * 0.04), 0.02, 0.02, 0.85)
  for (let y = B * 0.06; y < L; y += B * 0.075) bat += stroke([[0, y], [w, y + 0.6]], Math.max(1.2, B * 0.018), 0.02, 0.02, 0.6)
  for (let i = 0; i < Math.round((w * L) / 260); i++) {
    const x = r() * w, y = r() * L, l = B * (0.05 + r() * 0.08)
    straw += stroke([[x, y], [x + (r() - 0.5) * 2, y + l]], 0.6 + r() * 0.5, 0.2, 0.3, 0.1)
  }
  return svg(w, L,
    s('rect', { class: 't33h-thatchu', width: f1(w), height: f1(L) }),
    s('path', { class: 't33h-straw', d: straw }),
    s('path', { class: 't33h-batten', d: bat }),
    s('path', { class: 't33h-rafter', d: raf, filter: 'url(#ink-rough)' }),
    s('rect', { class: 't33h-roofao', width: f1(w), height: f1(L) }),
    s('rect', { class: 't33h-roofwarm', width: f1(w), height: f1(L) }))
}

/**
 * The cut end of the thatch (side view, px dz·(1 + k) × (dy + th), x = 0 at the far eave): a thick band of straw up the far
 * slope to the ridge and a little way down the near one (the rest of the near half is cut away), the ends combed.
 */
function thatchEnd(dz: number, dy: number, th: number, B: number, seed: number, k: number) {
  const r = rng(seed)
  const w = dz * (1 + k)
  const band = `M0 ${f1(dy + th)}L${f1(dz)} ${f1(th)}L${f1(w)} ${f1(dy * k + th)}L${f1(w)} ${f1(dy * k)}L${f1(dz)} 0L0 ${f1(dy)}Z`
  let straw = '', layers = ''
  const n = Math.round(Math.hypot(dz, dy) / 2.2)
  for (let i = 0; i < n; i++) {
    const t = i / n, x = dz * t, y = dy * (1 - t)
    const l = th * (0.7 + r() * 0.3)
    straw += stroke([[x, y + th - l * 0.95], [x - th * 0.12, y + th]], 0.7 + r() * 0.5, 0.1, 0.2, 0.2)
  }
  for (let i = 0; i < Math.round(n * k); i++) {
    const t = i / (n * k), x = dz + dz * k * t, y = dy * k * t
    straw += stroke([[x, y + th * 0.05], [x + th * 0.12, y + th * (0.75 + r() * 0.25)]], 0.7 + r() * 0.5, 0.1, 0.2, 0.2)
  }
  // the layers the thatcher laid, seen in section
  for (const f of [0.35, 0.65]) layers += stroke([[0, dy + th * f], [dz, th * f], [w, dy * k + th * f]], Math.max(1, B * 0.012), 0.05, 0.05, 0.5)
  return svg(w, dy + th,
    s('path', { class: 't33h-thatch', d: band, filter: 'url(#ink-rough)' }),
    s('path', { class: 't33h-straw', d: straw }),
    s('path', { class: 't33h-layer', d: layers }),
    s('path', { class: 't33h-moonlit', d: stroke([[dz * 0.05, dy - 1], [dz * 0.98, 1]], Math.max(1.4, B * 0.025), 0.1, 0.2, 0.2) + stroke([[dz * 1.02, 1], [w - 2, dy * k]], Math.max(1.2, B * 0.02), 0.2, 0.2, 0.2) }),
    s('path', { class: 't33h-moss', d: blob(dz * 0.75, th * 0.15 + dy * 0.25, dz * 0.12, th * 0.25, seed, 0.3, 10) }))
}

/** The top of the near thatch where it starts down from the ridge (px w × L, ridge at the top): combed straw running down the slope. */
function thatchTop(w: number, L: number, B: number, seed: number) {
  const r = rng(seed)
  let straw = ''
  for (let i = 0; i < Math.round((w * L) / 90); i++) {
    const x = r() * w, y = r() * L, l = B * (0.08 + r() * 0.1)
    straw += stroke([[x, y], [x + (r() - 0.5) * 2, y + l]], 0.7 + r() * 0.6, 0.2, 0.3, 0.1)
  }
  return svg(w, L,
    s('rect', { class: 't33h-thatch', width: f1(w), height: f1(L) }),
    s('path', { class: 't33h-straw', d: straw }),
    s('rect', { class: 't33h-thatchsh', width: f1(w), height: f1(L) }),
    s('path', { class: 't33h-moss', d: blob(w * 0.22, L * 0.4, w * 0.08, L * 0.25, seed, 0.4, 12) + blob(w * 0.7, L * 0.3, w * 0.05, L * 0.2, seed + 1, 0.4, 10), filter: 'url(#ink-wash)' }),
    s('path', { class: 't33h-moonlit', d: stroke([[B * 0.1, 1.5], [w * 0.7, 1.5]], Math.max(1.2, B * 0.02), 0.1, 0.4, 0.2) }))
}

/**
 * The near slope with its thatch taken off (px w × L, ridge at the top): the bare rafters running down from the ridge to rest
 * on the front beam (a short overhang past it), the bamboo battens tied across them, the eave board at their feet. Open between.
 */
function rafters(w: number, L: number, B: number, onBeam: number) {
  let raf = '', bat = '', lit = ''
  const rw = Math.max(3, B * 0.045)
  for (let x = B * 0.08; x < w; x += B * 0.36) {
    raf += stroke([[x, 0], [x + 0.5, L]], rw, 0.02, 0.02, 0.85)
    lit += stroke([[x - rw * 0.3, 2], [x - rw * 0.3, L - 2]], Math.max(0.8, rw * 0.22), 0.1, 0.2, 0.2)
  }
  for (const f of [0.22, 0.46, 0.7]) bat += stroke([[0, L * f], [w, L * f + 0.6]], Math.max(1.6, B * 0.022), 0.02, 0.02, 0.7)
  // where the rafters sit on the beam: a wall plate shadow across them; the eave board along their feet
  const plate = stroke([[0, onBeam], [w, onBeam]], Math.max(3, B * 0.05), 0.01, 0.01, 0.9)
  const eave = stroke([[0, L - B * 0.025], [w, L - B * 0.025]], Math.max(3, B * 0.05), 0.01, 0.01, 0.9)
  return svg(w, L,
    s('path', { class: 't33h-batten', d: bat }),
    s('path', { class: 't33h-rafter', d: raf + plate + eave, filter: 'url(#ink-rough)' }),
    s('path', { class: 't33h-moonlit', d: lit }))
}

/** Crossed ridge sticks (karasu-odori) standing along the ridge (px w × hh, feet at the bottom). */
function chigi(w: number, hh: number, B: number) {
  let d = '', lit = ''
  const lw = Math.max(3, B * 0.055)
  for (let x = B * 0.5; x < w - B * 0.3; x += B * 0.8) {
    d += stroke([[x - hh * 0.42, hh], [x + hh * 0.36, hh * 0.1]], lw, 0.02, 0.15, 0.7) + stroke([[x + hh * 0.42, hh], [x - hh * 0.36, hh * 0.1]], lw, 0.02, 0.15, 0.7)
    lit += stroke([[x - hh * 0.42 - lw * 0.3, hh - 1], [x + hh * 0.36 - lw * 0.3, hh * 0.1]], lw * 0.25, 0.1, 0.3, 0.2)
  }
  return svg(w, hh, s('path', { class: 't33h-chigi', d, filter: 'url(#ink-rough)' }), s('path', { class: 't33h-moonlit', d: lit }))
}

/** The thatch cut through (front view, px w × th): the section of the near half — cut straw ends in layers, a dark core, the underside. */
function thatchCut(w: number, th: number, B: number, seed: number) {
  const r = rng(seed)
  let straw = '', layers = ''
  for (let x = 1; x < w; x += 1.4 + r() * 1.2) straw += blob(x, th * (0.12 + r() * 0.76), 0.7 + r() * 0.5, 0.6 + r() * 0.4, Math.round(x), 0.1, 6)
  for (const f of [0.3, 0.58, 0.82]) layers += stroke([[0, th * f], [w, th * f + (r() - 0.5) * 2]], Math.max(1, th * 0.05), 0.02, 0.02, 0.6)
  return svg(w, th,
    s('rect', { class: 't33h-cutface', width: f1(w), height: f1(th) }),
    s('path', { class: 't33h-cutends', d: straw }),
    s('path', { class: 't33h-layer', d: layers }),
    s('rect', { class: 't33h-cutcore', y: f1(th * 0.82), width: f1(w), height: f1(th * 0.18) }),
    s('path', { class: 't33h-moonlit', d: stroke([[B * 0.1, 1.5], [w * 0.7, 1.5]], Math.max(1.4, B * 0.025), 0.1, 0.4, 0.2) }))
}

/** One bay's thing (a free-standing card, px w × hh, standing on its foot): the iron pot on its hook, the bell, the gardener. */
function potArt(w: number, hh: number) {
  const cx = w / 2, py = hh * 0.86, pr = w * 0.32
  return svg(w, hh,
    s('path', { class: 't33h-bamboo', d: stroke([[cx, 0], [cx + 0.6, py - pr * 1.1]], Math.max(3, w * 0.07), 0.02, 0.05, 0.85), filter: 'url(#ink-rough)' }),
    s('path', { class: 't33h-seam', d: lines([[cx - w * 0.04, hh * 0.18, cx + w * 0.04, hh * 0.18], [cx - w * 0.04, hh * 0.38, cx + w * 0.04, hh * 0.38]], 1.2) }),
    // the wooden fish that sets the hook's height
    s('path', { class: 't33h-woodhi', d: `M${f1(cx - w * 0.3)} ${f1(hh * 0.5)}Q${f1(cx)} ${f1(hh * 0.44)} ${f1(cx + w * 0.3)} ${f1(hh * 0.5)}Q${f1(cx + w * 0.38)} ${f1(hh * 0.46)} ${f1(cx + w * 0.42)} ${f1(hh * 0.52)}Q${f1(cx + w * 0.36)} ${f1(hh * 0.56)} ${f1(cx + w * 0.3)} ${f1(hh * 0.54)}Q${f1(cx)} ${f1(hh * 0.6)} ${f1(cx - w * 0.3)} ${f1(hh * 0.54)}Z`, filter: 'url(#ink-rough)' }),
    s('path', { class: 't33h-iron', d: stroke(curve([cx, py - pr * 1.2], [cx + pr * 0.25, py - pr * 0.95], [cx, py - pr * 0.8], 6), 1.6, 0.1, 0.1, 0.5) }),
    s('path', { class: 't33h-pot', d: `M${f1(cx - pr)} ${f1(py - pr * 0.55)}Q${f1(cx - pr * 1.1)} ${f1(py + pr * 0.45)} ${f1(cx)} ${f1(py + pr * 0.5)}Q${f1(cx + pr * 1.1)} ${f1(py + pr * 0.45)} ${f1(cx + pr)} ${f1(py - pr * 0.55)}Q${f1(cx)} ${f1(py - pr * 0.9)} ${f1(cx - pr)} ${f1(py - pr * 0.55)}Z`, filter: 'url(#ink-rough)' }),
    s('path', { class: 't33h-potrim', d: stroke(curve([cx - pr * 0.9, py - pr * 0.5], [cx - pr * 0.6, py + pr * 0.2], [cx - pr * 0.1, py + pr * 0.4], 8), Math.max(1.2, w * 0.02), 0.2, 0.3, 0.1) }),
    s('path', { class: 't33h-steam', d: stroke(curve([cx + pr * 0.2, py - pr * 0.9], [cx - pr * 0.3, py - pr * 1.6], [cx + pr * 0.2, py - pr * 2.3], 10), Math.max(1.4, w * 0.03), 0.2, 0.7, 0.1) }))
}

function bellArt(w: number, hh: number) {
  const cx = w / 2, by = hh * 0.5, br = w * 0.3
  return svg(w, hh,
    s('path', { class: 't33h-cord', d: `M${f1(cx)} 0V${f1(by - br)}` }),
    s('path', { class: 't33h-bronze', d: `M${f1(cx - br)} ${f1(by + br * 0.6)}Q${f1(cx - br)} ${f1(by - br)} ${f1(cx)} ${f1(by - br * 1.05)}Q${f1(cx + br)} ${f1(by - br)} ${f1(cx + br)} ${f1(by + br * 0.6)}Z`, filter: 'url(#ink-rough)' }),
    s('path', { class: 't33h-moonlit', d: stroke(curve([cx - br * 0.7, by + br * 0.3], [cx - br * 0.7, by - br * 0.6], [cx - br * 0.1, by - br * 0.85], 8), Math.max(1.2, w * 0.05), 0.2, 0.3, 0.1) }),
    s('path', { class: 't33h-cord', d: `M${f1(cx)} ${f1(by + br * 0.6)}V${f1(hh * 0.86)}` }),
    s('path', { class: 't33h-strip', d: rect(cx - w * 0.09, hh * 0.78, w * 0.18, hh * 0.22) }))
}

function keeperArt(w: number, hh: number) {
  const u = hh / 10, x = w * 0.55
  const X = (k: number) => x + u * k, Y = (k: number) => hh - u * k
  return svg(w, hh,
    s('ellipse', { class: 't33h-contactf', cx: f1(X(0)), cy: f1(hh - u * 0.15), rx: f1(u * 2.2), ry: f1(u * 0.35) }),
    s('path', { class: 't33h-robe', d: `M${f1(X(-1.6))} ${f1(Y(0))}Q${f1(X(-1.7))} ${f1(Y(3.6))} ${f1(X(-0.9))} ${f1(Y(6.4))}Q${f1(X(0))} ${f1(Y(7.1))} ${f1(X(0.9))} ${f1(Y(6.4))}Q${f1(X(1.5))} ${f1(Y(3.6))} ${f1(X(1.5))} ${f1(Y(0))}Z`, filter: 'url(#ink-wash)' }),
    s('path', { class: 't33h-figink', d: stroke(curve([X(-0.9), Y(6.3)], [X(-1.7), Y(3.4)], [X(-1.5), Y(0.1)], 10), u * 0.42, 0.1, 0.2, 0.2) + stroke([[X(-1.6), Y(0.1)], [X(1.5), Y(0.1)]], u * 0.3, 0.1, 0.1, 0.3) + stroke(curve([X(0.6), Y(5.8)], [X(-1.2), Y(4.8)], [X(-2.4), Y(5.3)], 8), u * 0.5, 0.1, 0.4, 0.3), filter: 'url(#ink-rough)' }),
    s('circle', { class: 't33h-face', cx: f1(X(0)), cy: f1(Y(7.4)), r: f1(u * 0.62) }),
    s('path', { class: 't33h-hat', d: `M${f1(X(-2))} ${f1(Y(7.5))}Q${f1(X(0))} ${f1(Y(9.6))} ${f1(X(2))} ${f1(Y(7.5))}Q${f1(X(0))} ${f1(Y(8))} ${f1(X(-2))} ${f1(Y(7.5))}Z`, filter: 'url(#ink-rough)' }),
    s('path', { class: 't33h-moonlit', d: stroke(curve([X(-1.3), Y(1)], [X(-1.5), Y(3.6)], [X(-0.8), Y(6)], 8), u * 0.18, 0.2, 0.3, 0.1) }),
    // the lantern pole he holds out toward the house
    s('path', { class: 't33h-figink', d: stroke([[X(-2.3), Y(5.3)], [X(-3.6), Y(6.4)]], u * 0.16, 0.1, 0.1, 0.5) }),
    s('ellipse', { class: 't33h-handlamp', cx: f1(X(-3.7)), cy: f1(Y(5.3)), rx: f1(u * 0.55), ry: f1(u * 0.75) }))
}

/** Front face of the recipe shelf: three boards of bound books and rolled scrolls. */
function shelfArt(w: number, hh: number, seed: number) {
  const r = rng(seed)
  const kids: SVGElement[] = [s('rect', { class: 't33h-woodlo', width: f1(w), height: f1(hh) })]
  let books = '', bands = '', boards = ''
  for (let row = 0; row < 3; row++) {
    const y1 = hh * (0.32 + row * 0.32), y0 = y1 - hh * 0.27
    boards += rect(0, y1, w, Math.max(2, hh * 0.04))
    for (let x = w * 0.06; x < w * 0.92; ) {
      const bw = w * (0.05 + r() * 0.05), bh = (y1 - y0) * (0.65 + r() * 0.33)
      if (r() < 0.18) {
        // a stack lying flat
        const sh = (y1 - y0) * 0.14
        for (let k = 0; k < 3; k++) books += rect(x, y1 - sh * (k + 1), w * 0.16, sh * 0.9)
        x += w * 0.18
        continue
      }
      books += rect(x, y1 - bh, bw, bh)
      bands += rect(x, y1 - bh * 0.78, bw, Math.max(1, bh * 0.05))
      x += bw + 0.8
    }
  }
  kids.push(
    s('path', { class: 't33h-books', d: books }),
    s('path', { class: 't33h-bands', d: bands }),
    s('path', { class: 't33h-wood', d: boards + rect(0, 0, Math.max(3, w * 0.05), hh) + rect(w - Math.max(3, w * 0.05), 0, Math.max(3, w * 0.05), hh) + rect(0, 0, w, Math.max(2, hh * 0.04)), filter: 'url(#ink-rough)' }))
  return svg(w, hh, ...kids)
}

/** Front of the notebook chest (tansu): two columns of drawers, iron pulls, corner plates. */
function chestArt(w: number, hh: number, seed: number) {
  let dr = '', pulls = ''
  for (let c = 0; c < 2; c++) for (let row = 0; row < 3; row++) {
    const x = w * (0.06 + c * 0.46), y = hh * (0.08 + row * 0.3), dw = w * 0.42, dh = hh * 0.26
    dr += rect(x, y, dw, dh)
    pulls += blob(x + dw / 2, y + dh / 2, Math.max(1.6, w * 0.035), Math.max(1.2, w * 0.022), seed + c * 3 + row, 0.1, 8)
  }
  return svg(w, hh,
    ...(wood(w, hh, seed, 'x', 0, 't33h-woodhi').children as unknown as SVGElement[]),
    s('path', { class: 't33h-drawer', d: dr }),
    s('path', { class: 't33h-iron', d: pulls + rect(0, 0, w * 0.08, hh * 0.1) + rect(w * 0.92, 0, w * 0.08, hh * 0.1) + rect(0, hh * 0.9, w * 0.08, hh * 0.1) + rect(w * 0.92, hh * 0.9, w * 0.08, hh * 0.1) }))
}

/** Top of the chest: a pile of thick notebooks and a brush. */
function notebooks(w: number, d: number, seed: number) {
  const r = rng(seed)
  let b = '', pg = ''
  for (let k = 0; k < 3; k++) {
    const x = w * (0.18 + r() * 0.08), y = d * (0.18 + k * 0.08), bw = w * 0.5, bd = d * 0.55
    b += rect(x, y, bw, bd)
    pg += stroke([[x + bw * 0.06, y + bd + 1], [x + bw * 0.94, y + bd + 1]], 1.2, 0.05, 0.05, 0.5)
  }
  return svg(w, d,
    ...(wood(w, d, seed, 'x', 0, 't33h-woodhi').children as unknown as SVGElement[]),
    s('path', { class: 't33h-nb', d: b, filter: 'url(#ink-rough)' }),
    s('path', { class: 't33h-pages', d: pg }),
    s('path', { class: 't33h-figink', d: stroke([[w * 0.74, d * 0.2], [w * 0.86, d * 0.8]], Math.max(1.6, w * 0.025), 0.1, 0.4, 0.3) }))
}

/** Top of the work bench in the tool bay: a plane, a chisel, a coil of cord. */
function benchTop(w: number, d: number, seed: number) {
  return svg(w, d,
    ...(wood(w, d, seed, 'x', d * 0.33, 't33h-woodhi').children as unknown as SVGElement[]),
    s('path', { class: 't33h-iron', d: rect(w * 0.12, d * 0.3, w * 0.26, d * 0.3) + rect(w * 0.5, d * 0.45, w * 0.3, d * 0.08) }),
    s('path', { class: 't33h-cord', d: blob(w * 0.82, d * 0.3, w * 0.07, d * 0.18, seed, 0.1, 10) }))
}

/** A moth (px w square): two pairs of vermilion wings, an ink body. */
const mothArt = (w: number) => svg(w, w,
  s('path', { class: 't33h-wing', d: `M${f1(w / 2)} ${f1(w * 0.5)}Q${f1(w * 0.05)} ${f1(w * 0.1)} ${f1(w * 0.08)} ${f1(w * 0.5)}Q${f1(w * 0.12)} ${f1(w * 0.72)} ${f1(w / 2)} ${f1(w * 0.55)}ZM${f1(w / 2)} ${f1(w * 0.5)}Q${f1(w * 0.95)} ${f1(w * 0.1)} ${f1(w * 0.92)} ${f1(w * 0.5)}Q${f1(w * 0.88)} ${f1(w * 0.72)} ${f1(w / 2)} ${f1(w * 0.55)}Z` }),
  s('path', { class: 't33h-figink', d: stroke([[w / 2, w * 0.3], [w / 2, w * 0.74]], Math.max(1.4, w * 0.07), 0.2, 0.3, 0.4) }))

// ── the scene ─────────────────────────────────────────────────────────────────────────────────────────────────

interface Shaded { el: HTMLElement; n: V3; two: boolean; k: number }

/** ★ Scene 4 — a five-bay farmhouse cut open like a paper theatre, floating on a raked-sand plinth: turn it, light each bay. */
export function houseScene(ctx: SceneCtx) {
  t33Defs()
  const low = ctx.quality === 'low'
  const lit = new Set<number>()
  const reading = live('t33h-read')
  const note = ctx.fact(K.note as Fact, 'p', 't33h-note t33-ink')
  note.hidden = true
  const short = (k: number) => K.rooms[k].name.split(/\s*=\s*/)
  const night = s('svg', { class: 't33-night t33h-night', 'aria-hidden': 'true' })
  const cam = h('div', { class: 't33h-cam' })
  const turnId = 't33h-turn'
  const stage = h('div', { class: 't33h-stage', 'aria-describedby': turnId }, cam)
  const fog = s('svg', { class: 't33-night t33h-fog', 'aria-hidden': 'true' })
  const root = h('div', { class: `t33 t33h${low ? ' low' : ''}`, role: 'group', 'aria-label': K.aria },
    night, stage, fog,
    h('p', { class: 'visually-hidden' }, K.art),
    h('p', { class: 'visually-hidden', id: turnId }, K.turnAria),
    h('div', { class: 't33h-foot' }, reading, note))
  ctx.art.append(root)
  ctx.prompt(K.prompt)
  // guide: a dot on the next bay's lantern, the count of lit bays, a curved ink arrow under the plinth (turn me) until the first turn
  const g = guide(ctx)
  const count = g.count(K.count, K.rooms.length, () => geo.countAt)
  let next: Mark | null = null
  let turnHint: Mark | null = low ? null : g.gesture('rotate', () => geo.turnAt, { r: 30 })
  const lamps: HTMLElement[] = []

  // the bay buttons persist across layouts (focus survives a resize); the planes around them are rebuilt
  const bays = K.rooms.map((r, i) => h('button', { class: `t33h-bay t33h-b${i}`, type: 'button', 'aria-pressed': 'false', 'aria-label': fill(K.roomAria, { name: r.name }), onClick: () => !dragged && light(i) }))
  let shaded: Shaded[] = []
  const view = { yaw: HOME.yaw, pitch: HOME.pitch }
  const tgt = { ...view }
  let geo = { B: 0, cy: 0, lift: 0, countAt: [0, 0] as Pt, turnAt: [0, 0] as Pt }

  const applyCam = () => void (cam.style.transform = `translate3d(0,${f1(geo.lift)}px,0) rotateX(${(-view.pitch).toFixed(2)}deg) rotateY(${view.yaw.toFixed(2)}deg)`)
  /** Moon shading of every face for the current turn: once per settle, never per frame. */
  function shade() {
    const cy = Math.cos(view.yaw * D2R), sy = Math.sin(view.yaw * D2R)
    const cp = Math.cos(-view.pitch * D2R), sp = Math.sin(-view.pitch * D2R)
    for (const f of shaded) {
      const [x, y, z] = f.n
      let x1 = cy * x + sy * z
      const z1 = -sy * x + cy * z
      let y2 = cp * y - sp * z1, z2 = sp * y + cp * z1
      if (f.two && z2 < 0) (x1 = -x1), (y2 = -y2), (z2 = -z2)
      const d = x1 * LIGHT[0] + y2 * LIGHT[1] + z2 * LIGHT[2]
      f.el.style.setProperty('--sh', ((1 - (0.34 + 0.66 * Math.max(0, d))) * f.k).toFixed(3))
      f.el.style.setProperty('--rim', Math.max(0, d).toFixed(2))
    }
  }

  // ── build: every plane placed with translate3d + rotations about its own centre
  let job: { cancel(): void } | null = null
  let first = true
  function layout() {
    const W0 = stage.clientWidth, H0 = stage.clientHeight
    if (!W0 || !H0) return
    const mobile = W0 < 640
    const side = mobile ? 0.3 : 1.1
    // the house fills ~58% of a desk's width (audit 33-4: it was 30%), the whole width of a phone
    const B = Math.round(Math.min((W0 * (mobile ? 0.84 : 0.54)) / 5, H0 * (mobile ? 0.16 : 0.175)))
    if (first && mobile) {
      // a phone looks from higher and turned a little more square-on: the house stands taller in the frame, margins at the sides
      view.yaw = tgt.yaw = 10
      view.pitch = tgt.pitch = 46
    }
    const W = 5 * B, D = 1.35 * B, Hw = B, F = 0.12 * B, Hr = 0.95 * B, ov = 0.22 * B, sov = 0.16 * B
    const Wp = W + side * B, Dp = D + 1.1 * B, T = 0.16 * B
    const zc = -0.22 * B // the house sits toward the back of the plinth
    const yT = -F - Hw, yR = yT - Hr
    // the far slope runs from the ridge through the top of the back wall (its rafters sit on the wall plate) and on out to the eave
    const dz = D / 2 + ov, dy = (Hr * dz) / (D / 2), th = 0.34 * B, k = 0.24
    const gb = Hr - (D / 2) * (dy / dz) // = 0: no gap between the roof and the back wall
    const camX = W0 * (mobile ? 0.5 : 0.42)
    // a phone sets the house lower, its garden running on below it, and writes the bay's line in the sky above
    geo = { B, cy: H0 * (mobile ? 0.5 : 0.47), lift: B * 0.62, countAt: [0, 0], turnAt: [0, 0] }
    root.style.setProperty('--camx', `${f1(camX)}px`)
    /** under the plinth's front edge (measured once the model is built, at the home view): the count, then the bay's line */
    const foot = (bottom: number) => {
      geo.countAt = mobile ? [camX, H0 * 0.05] : [camX, bottom + 12]
      geo.turnAt = [camX + W * (mobile ? 0.36 : 0.52), bottom - B * (mobile ? 0.1 : 0.3)]
      root.style.setProperty('--foot', `${f1(mobile ? H0 * 0.05 + 20 : bottom + 30)}px`)
      g.refresh()
    }
    root.style.setProperty('--B', `${B}px`)
    cam.style.left = `${f1(camX)}px`
    cam.style.top = `${f1(geo.cy)}px`
    stage.style.perspective = `${Math.round(Math.max(1300, H0 * 2.6))}px`
    stage.style.perspectiveOrigin = `${f1(camX)}px ${f1(geo.cy - B * 0.4)}px`
    const bx = (k: number) => -W / 2 + (k + 0.5) * B
    const list: Shaded[] = []
    const plane = (cls: string, w: number, hh: number, at: V3, rot: string, n: V3 | null, kids: (Node | null)[] = [], two = false, k = 0.62) => {
      const el = h('div', { class: `t33h-f${n ? ' sq' : ''} ${cls}`, style: `width:${f1(w)}px;height:${f1(hh)}px;margin:${f1(-hh / 2)}px 0 0 ${f1(-w / 2)}px;transform:translate3d(${f1(at[0])}px,${f1(at[1])}px,${f1(at[2])}px)${rot ? ' ' + rot : ''}` }, ...kids)
      if (n) list.push({ el, n, two, k })
      return el
    }
    const UP: V3 = [0, -1, 0], FRONT: V3 = [0, 0, 1], RIGHT: V3 = [1, 0, 0], LEFT: V3 = [-1, 0, 0]
    const FLAT = 'rotateX(90deg)', SIDE = 'rotateY(-90deg)'
    /** a box (front, left, right, top) centred on x, standing on y, its front at z */
    const box = (cls: string, x: number, y: number, z: number, w: number, hh: number, d: number, front: Node | null, top: Node | null, sideArt: (w: number, h: number) => Node) => [
      plane(`${cls} t33h-boxf`, w, hh, [x, y - hh / 2, z], '', FRONT, [front]),
      plane(`${cls} t33h-boxs`, d, hh, [x - w / 2, y - hh / 2, z - d / 2], SIDE, LEFT, [sideArt(d, hh)]),
      plane(`${cls} t33h-boxs`, d, hh, [x + w / 2, y - hh / 2, z - d / 2], 'rotateY(90deg)', RIGHT, [sideArt(d, hh)]),
      plane(`${cls} t33h-boxt`, w, d, [x, y - hh, z - d / 2], FLAT, UP, [top]),
    ]

    let plinthFront: HTMLElement | null = null
    function* build() {
      cam.replaceChildren()
      // the night: moon high on the left (it lights the house), far ranges, mist
      night.setAttribute('viewBox', `0 0 ${W0} ${H0}`)
      night.setAttribute('preserveAspectRatio', 'none')
      const hz = geo.cy - B * (mobile ? 0.2 : 0.75)
      // the garden floor: raked sand from the horizon to the foot of the frame, rows closer together far away
      let rows = ''
      for (let y = hz + 3, i = 0; y < H0; y += 2.5 + (y - hz) * 0.05, i++) rows += stroke([[-10, y], [W0 * 0.5, y + Math.sin(i) * 0.8], [W0 + 10, y]], Math.min(1.6, 0.7 + (y - hz) * 0.002), 0.02, 0.02, 0.6)
      night.replaceChildren(
        mist(W0 * 0.5, hz - H0 * 0.12, W0 * 0.75, H0 * 0.26),
        moon(W0 * (mobile ? 0.16 : 0.1), H0 * (mobile ? 0.08 : 0.11), Math.max(16, Math.min(W0, H0) * 0.042), 3343, true),
        hills(-W0 * 0.05, W0 * 1.05, hz, H0 * 0.2, 3344, 0.9, 6),
        hills(W0 * 0.45, W0 * 1.08, hz + H0 * 0.04, H0 * 0.13, 3345, 0.62, 3),
        s('rect', { class: 't33h-groundp', x: f1(-10), y: f1(hz), width: f1(W0 + 20), height: f1(H0 - hz + 10) }),
        s('path', { class: 't33h-grake', d: rows }),
        mist(W0 * 0.5, hz + H0 * 0.01, W0 * 0.7, H0 * 0.05),
        ...(mobile ? [
          pine(W0 * 0.97, hz + H0 * 0.02, H0 * 0.13, 3342, -1),
          // the garden in front of the plinth: stepping stones from its foot toward us, a lit stone lantern beside them
          s('path', { class: 't33h-pathst', d: [[0.5, 0.71, 0.09], [0.42, 0.765, 0.11], [0.5, 0.83, 0.13], [0.38, 0.9, 0.15]].map(([x, y, r], i) => blob(W0 * x, H0 * y, W0 * r, W0 * r * 0.28, 3360 + i, 0.15, 14)).join(''), filter: 'url(#ink-rough)' }),
          s('ellipse', { class: 't33h-toropool', cx: f1(W0 * 0.8), cy: f1(H0 * 0.86), rx: f1(W0 * 0.2), ry: f1(H0 * 0.025) }),
          s('ellipse', { class: 't33h-torocast', cx: f1(W0 * 0.82), cy: f1(H0 * 0.862), rx: f1(W0 * 0.1), ry: f1(H0 * 0.01) }),
          toro(W0 * 0.8, H0 * 0.865, H0 * 0.19, true),
          reeds(W0 * 0.06, H0 * 0.9, H0 * 0.12, 3365, 7),
        ] : [
          // a stone lantern on the garden floor, front right, and its pool of light and shadow (the frame's near layer)
          s('ellipse', { class: 't33h-toropool', cx: f1(W0 * 0.885), cy: f1(H0 * 0.86), rx: f1(H0 * 0.13), ry: f1(H0 * 0.03) }),
          s('ellipse', { class: 't33h-torocast', cx: f1(W0 * 0.9), cy: f1(H0 * 0.865), rx: f1(H0 * 0.07), ry: f1(H0 * 0.012) }),
          toro(W0 * 0.885, H0 * 0.865, H0 * 0.26, true)]),
        mist(W0 * 0.5, hz + H0 * 0.05, W0 * 0.75, H0 * 0.04))
      fog.setAttribute('viewBox', `0 0 ${W0} ${H0}`)
      fog.setAttribute('preserveAspectRatio', 'none')
      // two layers of low mist: one drifting behind the plinth's foot, one thin in the foreground corners
      const fy = geo.cy + geo.lift + B * 0.95
      fog.replaceChildren(mist(W0 * 0.12, fy + B * 0.35, W0 * 0.22, B * 0.3), mist(W0 * 0.9, fy + B * 0.25, W0 * 0.22, B * 0.26), mist(W0 * 0.5, H0 * 1.02, W0 * 0.7, B * 0.4))
      yield
      // the plinth: raked top, four stone sides, mist pooled under it
      const rocks: Pt[] = [[Wp * 0.12, Dp * 0.8], [Wp * 0.86, Dp * 0.9]]
      const houseRect: [number, number, number, number] = [(Wp - W) / 2, Dp / 2 + zc - D / 2, W, D]
      const plinthSide = (w: number, hh: number) => svg(w, hh,
        s('rect', { class: 't33h-plinth', width: f1(w), height: f1(hh) }),
        s('path', { class: 't33h-seam', d: lines([[0, 2, w, 2]], 1.4) }),
        s('path', { class: 't33h-moss', d: blob(w * 0.2, hh, w * 0.12, hh * 0.5, Math.round(w), 0.3, 12), filter: 'url(#ink-wash)' }))
      cam.append(
        plane('t33h-groundbed', Wp * 3, Dp * 3.4, [0, T + 1, 0], FLAT, null),
        plane('t33h-contactbed', Wp + B * 0.5, Dp + B * 0.5, [B * 0.08, T, B * 0.06], FLAT, null),
        plane('t33h-sand', Wp, Dp, [0, 0, 0], FLAT, UP, [sand(Wp, Dp, B, houseRect, rocks, Wp / 2 + bx(4), 3346)], false, 0.5),
        plinthFront = plane('t33h-pl', Wp, T, [0, T / 2, Dp / 2], '', FRONT, [plinthSide(Wp, T)]),
        plane('t33h-pl', Wp, T, [0, T / 2, -Dp / 2], 'rotateY(180deg)', [0, 0, -1], [plinthSide(Wp, T)]),
        plane('t33h-pl', Dp, T, [-Wp / 2, T / 2, 0], SIDE, LEFT, [plinthSide(Dp, T)]),
        plane('t33h-pl', Dp, T, [Wp / 2, T / 2, 0], 'rotateY(90deg)', RIGHT, [plinthSide(Dp, T)]))
      yield
      // the house: raised floor and its stone footing, back wall, ends, gables
      const part = D * 0.6
      cam.append(
        plane('t33h-floor', W, D, [0, -F, zc], FLAT, UP, [floorArt(W, D, B, part, 3347)], false, 0.5),
        plane('t33h-footing', W, F, [0, -F / 2, zc + D / 2], '', FRONT, [svg(W, F, s('rect', { class: 't33h-plinth', width: f1(W), height: f1(F) }), s('path', { class: 't33h-seam', d: lines(Array.from({ length: 10 }, (_, i) => [(W * (i + 0.5)) / 10, 0, (W * (i + 0.5)) / 10 + 2, F]), 1.2) }))]),
        plane('t33h-wall', W, Hw, [0, -F - Hw / 2, zc - D / 2], '', FRONT, [svg(W, Hw, ...plaster(W, Hw, 3348, B, Math.max(4, B * 0.07)), ...[0, 1, 3, 4].flatMap((k) => wallArt(k, k * B, B, Hw, 3350 + k)))]),
        plane('t33h-wall', D, Hw, [-W / 2, -F - Hw / 2, zc], SIDE, LEFT, [svg(D, Hw, ...plaster(D, Hw, 3349, D, Math.max(4, B * 0.07)))], true),
        plane('t33h-wall', D, Hw, [W / 2, -F - Hw / 2, zc], SIDE, LEFT, [svg(D, Hw, ...plaster(D, Hw, 3351, D, Math.max(4, B * 0.07)))], true))
      // the gables: plaster on the far half, open timber where the near roof was taken away (local x = 0 is the back)
      const gable = () => svg(D, Hr,
        s('path', { class: 't33h-plaster', d: `M0 ${f1(Hr)}L0 ${f1(Hr - gb)}L${f1(D / 2)} 0L${f1(D / 2)} ${f1(Hr)}Z` }),
        s('path', { class: 't33h-ao', d: `M0 ${f1(Hr)}L0 ${f1(Hr - gb)}L${f1(D / 2)} 0L${f1(D / 2)} ${f1(Hr * 0.6)}Z` }),
        s('path', { class: 't33h-beam', d: stroke([[D / 2, 0], [D / 2, Hr]], Math.max(3, B * 0.05), 0.02, 0.02, 0.8) + stroke([[D / 2, Hr * 0.35], [D * 0.9, Hr - 0.02 * B]], Math.max(2, B * 0.035), 0.02, 0.02, 0.8) + stroke([[0, Hr - 0.02 * B], [D, Hr - 0.02 * B]], Math.max(3, B * 0.05), 0.02, 0.02, 0.8), filter: 'url(#ink-rough)' }))
      cam.append(
        plane('t33h-gable', D, Hr, [-W / 2, yT - Hr / 2, zc], SIDE, null, [gable()]),
        plane('t33h-gable', D, Hr, [W / 2, yT - Hr / 2, zc], SIDE, null, [gable()]))
      yield
      // partitions (shōji, half depth) and the posts at their open ends and along the front
      for (let k = 1; k < 5; k++) {
        const x = -W / 2 + k * B
        cam.append(plane(`t33h-shoji t33h-p${k}`, part, Hw, [x, -F - Hw / 2, zc - D / 2 + part / 2], SIDE, LEFT, [shoji(part, Hw)], true, 0.45))
      }
      const p = Math.max(5, B * 0.075)
      const post = (x: number, z: number, i: number) => {
        const art = (w: number) => wood(w, Hw, 3370 + i, 'y', 0, 't33h-postw')
        cam.append(
          plane('t33h-post', p, Hw, [x, -F - Hw / 2, z + p / 2], '', FRONT, [art(p)]),
          plane('t33h-post', p, Hw, [x - p / 2, -F - Hw / 2, z], SIDE, LEFT, [art(p)]),
          plane('t33h-post', p, Hw, [x + p / 2, -F - Hw / 2, z], 'rotateY(90deg)', RIGHT, [art(p)]))
      }
      for (let k = 0; k <= 5; k++) post(-W / 2 + k * B + (k === 0 ? p / 2 : k === 5 ? -p / 2 : 0), zc + D / 2 - p / 2, k)
      for (let k = 1; k < 5; k++) post(-W / 2 + k * B, zc - D / 2 + part, 10 + k)
      // the front beam across the post tops (the near roof is cut away, the beam that carried it stays): the boards and lanterns hang from it
      const bh = 0.1 * B, bw = W + p
      const beamArt = (w: number, hh: number) => svg(w, hh, ...(wood(w, hh, 3378, 'x', 0, 't33h-woodlo').children as unknown as SVGElement[]), s('path', { class: 't33h-moonlit', d: stroke([[2, 1.2], [w * 0.6, 1.2]], Math.max(1, B * 0.012), 0.1, 0.3, 0.2) }))
      cam.append(
        plane('t33h-fbeam', bw, bh, [0, yT + bh / 2, zc + D / 2 + 0.5], '', FRONT, [beamArt(bw, bh)], false, 0.5),
        plane('t33h-fbeam', bw, p, [0, yT, zc + D / 2 - p / 2], FLAT, UP, [beamArt(bw, p)], false, 0.5))
      yield
      // the far half of the roof, steep thatch seen from beneath; its cut ends; the heavy ridge
      const Lr = Math.hypot(dz, dy)
      const slope = Math.atan2(dy, dz)
      const phi = -(90 - slope / D2R)
      const rw = W + 2 * sov
      const nUnder: V3 = [0, Math.cos(slope), Math.sin(slope)]
      cam.append(plane('t33h-roof', rw, Lr, [0, yR + dy / 2, zc - dz / 2], `rotateX(${phi.toFixed(2)}deg)`, nUnder, [underside(rw, Lr, B, 3382)], false, 0.5))
      for (const sx of [-1, 1]) cam.append(plane('t33h-thatchend', dz * (1 + k), dy + th, [sx * rw / 2, yR - th + (dy + th) / 2, zc - dz + (dz * (1 + k)) / 2], SIDE, null, [thatchEnd(dz, dy, th, B, 3383 + sx, k)]))
      // the near half starts down from the ridge, then is cut away: its top, and the section through the straw
      const nTop: V3 = [0, -Math.cos(slope), Math.sin(slope)]
      cam.append(
        plane('t33h-roof t33h-near', rw, Lr * k, [0, yR - th + (dy * k) / 2, zc + (dz * k) / 2], `rotateX(${(-phi).toFixed(2)}deg)`, nTop, [thatchTop(rw, Lr * k, B, 3388)], false, 0.5),
        plane('t33h-thatchcut', rw, th, [0, yR - th + dy * k + th / 2, zc + dz * k], '', FRONT, [thatchCut(rw, th, B, 3387)], false, 0.4))
      // below the cut the near slope's frame stays: rafters from the ridge down onto the front beam, a short overhang past it
      const fz = (D / 2 + 0.07 * B) / dz, Ln = Lr * fz
      cam.append(plane('t33h-rafters', rw, Ln, [0, yR + (dy * fz) / 2, zc + (dz * fz) / 2], `rotateX(${(-phi).toFixed(2)}deg)`, null, [rafters(rw, Ln, B, Lr * ((D / 2) / dz))]))
      // the eave's shadow along the top of the back wall
      cam.append(plane('t33h-eaveshadow', W, Hw * 0.4, [0, yT + Hw * 0.2, zc - D / 2 + 0.6], '', null))
      const rh = Math.max(12, 0.24 * B), rlen = rw + 0.1 * B
      cam.append(
        plane('t33h-ridge', rlen, rh, [0, yR - th - rh / 2 + 2, zc + 0.04 * B], '', FRONT, [svg(rlen, rh,
          s('path', { class: 't33h-ridgef', d: `M0 ${f1(rh)}Q${f1(-B * 0.04)} ${f1(rh * 0.3)} ${f1(B * 0.1)} 0H${f1(rlen - B * 0.1)}Q${f1(rlen + B * 0.04)} ${f1(rh * 0.3)} ${f1(rlen)} ${f1(rh)}Z`, filter: 'url(#ink-rough)' }),
          s('path', { class: 't33h-moss', d: blob(rlen * 0.3, rh * 0.15, rlen * 0.2, rh * 0.18, 3385, 0.4, 16) + blob(rlen * 0.72, rh * 0.12, rlen * 0.15, rh * 0.16, 3386, 0.4, 16) }),
          s('path', { class: 't33h-seam', d: Array.from({ length: Math.round(rlen / (B * 0.3)) }, (_, i) => stroke([[(i + 0.5) * B * 0.3, rh * 0.3], [(i + 0.5) * B * 0.3, rh]], Math.max(1.6, B * 0.025), 0.1, 0.1, 0.6)).join('') }),
          s('path', { class: 't33h-moonlit', d: stroke([[B * 0.1, 1.5], [rlen * 0.55, 1.5]], Math.max(1.4, B * 0.022), 0.1, 0.4, 0.2) }))]),
        plane('t33h-ridge', rlen, th + 0.1 * B, [0, yR - th + 2, zc - (th + 0.1 * B) / 2 + 0.04 * B], FLAT, UP, [svg(rlen, th + 0.1 * B, s('rect', { class: 't33h-ridgef', width: f1(rlen), height: f1(th + 0.1 * B) }))]),
        plane('t33h-chigiw', rlen, 0.2 * B, [0, yR - th - rh - 0.1 * B + 4, zc], '', null, [chigi(rlen, 0.2 * B, B)]))
      yield
      // what each bay holds
      const hookH = Hw + 0.3 * B
      const shelfW = 0.78 * B, shelfH = 0.8 * Hw, shelfD = 0.22 * B
      const chestW = 0.64 * B, chestH = 0.42 * Hw, chestD = 0.34 * B
      const benchW = 0.7 * B, benchH = 0.3 * Hw, benchD = 0.26 * B
      const sideWood = (w: number, hh: number) => wood(w, hh, 3390, 'y', 0, 't33h-woodlo')
      cam.append(
        plane('t33h-item t33h-b0', 0.5 * B, hookH, [bx(0), yT - 0.3 * B + hookH / 2, zc + 0.05 * D], '', null, [potArt(0.5 * B, hookH)]),
        ...box('t33h-item t33h-b1', bx(1), -F, zc - D / 2 + 0.14 * B + benchD, benchW, benchH, benchD, wood(benchW, benchH, 3391, 'x', benchH / 3, 't33h-woodhi'), benchTop(benchW, benchD, 3392), sideWood),
        ...box('t33h-item t33h-b2', bx(2), -F, zc - D / 2 + shelfD + 1, shelfW, shelfH, shelfD, shelfArt(shelfW, shelfH, 3393), wood(shelfW, shelfD, 3394, 'x', 0, 't33h-woodhi'), sideWood),
        ...box('t33h-item t33h-b3', bx(3), -F, zc - D / 2 + 0.12 * B + chestD, chestW, chestH, chestD, chestArt(chestW, chestH, 3395), notebooks(chestW, chestD, 3396), sideWood),
        plane('t33h-item t33h-b4', 0.2 * B, 0.42 * B, [bx(4) + 0.28 * B, yT + 0.1 * B + 0.2 * B + 0.21 * B, zc + D / 2 - 0.08 * B], '', null, [bellArt(0.2 * B, 0.42 * B)]),
        plane('t33h-keeper', 0.6 * B, 0.92 * B, [bx(4) + 0.36 * B, -0.46 * B, zc + D / 2 + 0.5 * B], '', null, [keeperArt(0.6 * B, 0.92 * B)]),
        plane('t33h-rock', 0.62 * B, 0.36 * B, [rocks[0][0] - Wp / 2, -0.18 * B, rocks[0][1] - Dp / 2], '', null, [svg(0.62 * B, 0.36 * B, s('g', { transform: `translate(${f1(0.31 * B)} ${f1(0.36 * B)})` }, stoneArt(0.56 * B, 0.33 * B, 3397)))]),
        plane('t33h-rock', 0.4 * B, 0.24 * B, [rocks[1][0] - Wp / 2, -0.12 * B, rocks[1][1] - Dp / 2], '', null, [svg(0.4 * B, 0.24 * B, s('g', { transform: `translate(${f1(0.2 * B)} ${f1(0.24 * B)})` }, stoneArt(0.36 * B, 0.22 * B, 3398)))]))
      yield
      // per bay: the paper lantern, the warm pool on the floor and the back wall, the light thrown out onto the sand, the button
      for (let k = 0; k < 5; k++) {
        const x = bx(k)
        const lam = h('div', { class: 't33h-lamp' }, lantern('', 3330 + k))
        cam.append(
          plane(`t33h-glow t33h-gfloor t33h-b${k}`, B, D, [x, -F - 0.6, zc], FLAT, null),
          plane(`t33h-glow t33h-gwall t33h-b${k}`, B, Hw, [x, -F - Hw / 2, zc - D / 2 + 0.8], '', null),
          plane(`t33h-glow t33h-spill t33h-b${k}`, 1.5 * B, 1.15 * B, [x + 0.12 * B, -0.6, zc + D / 2 + 0.575 * B], FLAT, null),
          plane(`t33h-lampp t33h-b${k}`, 0.22 * B, 0.35 * B, [x - 0.3 * B, yT + bh + 0.2 * B + 0.175 * B, zc + D / 2 - p / 2], '', null, [lam]),
          plane(`t33h-boardp t33h-b${k}`, 0.9 * B, 0.2 * B, [x, yT + bh + 0.1 * B + 1, zc + D / 2 + 1], '', null, [h('span', { class: 't33h-board', 'aria-hidden': 'true' }, h('b', null, short(k)[0]), short(k)[1] ? h('small', null, short(k)[1]) : null)]))
        lamps[k] = lam
        const btn = bays[k]
        btn.style.cssText = `width:${f1(B)}px;height:${f1(Hw + F)}px;margin:${f1(-(Hw + F) / 2)}px 0 0 ${f1(-B / 2)}px;transform:translate3d(${f1(x)}px,${f1(-(Hw + F) / 2)}px,${f1(zc + D / 2 + 2)}px)`
        cam.append(btn)
      }
      // the gold thread a message runs (gate → hearth → tools, recipes, notebooks → gate), and the moth's ink rings
      const at = (k: number, v: number): Pt => [k * B + B * 0.5, D * v]
      const way: Pt[] = [at(4, 0.86), at(2, 0.94), at(0, 0.8), at(0, 0.55), at(1, 0.42), at(2, 0.4), at(3, 0.62), at(4, 0.7), at(4, 0.86)]
      const smooth: Pt[] = []
      for (let i = 0; i < way.length - 1; i++) {
        const p0 = way[Math.max(0, i - 1)], p1 = way[i], p2 = way[i + 1], p3 = way[Math.min(way.length - 1, i + 2)]
        for (let j = 0; j < 8; j++) {
          const t = j / 8, t2 = t * t, t3 = t2 * t
          const c = (a: number, b: number, c2: number, d: number) => 0.5 * (2 * b + (c2 - a) * t + (2 * a - 5 * b + 4 * c2 - d) * t2 + (3 * b - a - 3 * c2 + d) * t3)
          smooth.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])])
        }
      }
      smooth.push(way[way.length - 1])
      const ring = (k: number, v: number, rx: number, ry: number) => s('ellipse', { class: 't33h-inkring', cx: f1(k * B + B * 0.5), cy: f1(D * v), rx: f1(rx), ry: f1(ry), pathLength: 1 })
      cam.append(plane('t33h-threadp', W, D, [0, -F - 1.2, zc], FLAT, null, [svg(W, D,
        // the groove the message runs in: faint gold dots from the start, the thread itself once every bay is lit
        s('path', { class: 't33h-groove', d: `M${smooth.map(P).join('L')}` }),
        s('path', { class: 't33h-thread', d: `M${smooth.map(P).join('L')}`, pathLength: 1 }),
        ring(3, (0.12 * B + chestD / 2) / D, chestW * 0.72, chestD * 1.05),
        ring(2, (shelfD / 2 + 0.04 * B) / D, shelfW * 0.66, shelfD * 1.5))]))
      // the moth: off in the night, then the notebook chest, then the recipe shelf
      const mw = Math.max(18, 0.26 * B)
      const mp = (x: number, y: number, z: number, r: number) => `translate3d(${f1(x)}px,${f1(y)}px,${f1(z)}px) rotateY(${r}deg)`
      cam.append(h('div', { class: 't33h-moth', style: `width:${f1(mw)}px;height:${f1(mw)}px;margin:${f1(-mw / 2)}px 0 0 ${f1(-mw / 2)}px;--m0:${mp(W * 0.7, yR - B, D, 0)};--m1:${mp(bx(3), -F - chestH - mw * 0.3, zc - D / 2 + 0.12 * B + chestD / 2, -20)};--m2:${mp(bx(2) + shelfW * 0.25, -F - shelfH - mw * 0.3, zc - D / 2 + shelfD / 2, 15)}` }, mothArt(mw)))
      shaded = list
      shade()
      applyCam()
      pointNext()
      // one read after the build (not per frame): where the plinth's front edge lands on screen
      const edge = () => {
        const sb = stage.getBoundingClientRect(), pb = plinthFront!.getBoundingClientRect()
        foot(pb.bottom - sb.top)
      }
      edge()
      // and once more after the scene's entrance has settled (its fade-in moves the whole art while it runs)
      const id = setTimeout(edge, 900)
      ctx.onCleanup(() => clearTimeout(id))
    }
    job?.cancel()
    job = sliced(build(), { sync: ctx.reduced || !first })
    first = false
  }
  ctx.onCleanup(onSize(stage, layout))
  ctx.onCleanup(() => job?.cancel())

  // ── turning: drag (mouse / touch), arrows; damped toward the target in one loop that stops when settled
  const loop = createLoop(stage, (_t, dt) => {
    const f = dt > 0 ? 1 - Math.exp(-dt * 7) : 1
    view.yaw += (tgt.yaw - view.yaw) * f
    view.pitch += (tgt.pitch - view.pitch) * f
    applyCam()
    if (Math.abs(tgt.yaw - view.yaw) + Math.abs(tgt.pitch - view.pitch) > 0.05) return
    view.yaw = tgt.yaw
    view.pitch = tgt.pitch
    applyCam()
    shade()
    return false
  }, { essential: true })
  ctx.onCleanup(() => loop.dispose())
  const turn = (dy: number, dp: number) => {
    tgt.yaw = clamp(tgt.yaw + dy, YAW[0], YAW[1])
    tgt.pitch = clamp(tgt.pitch + dp, PITCH[0], PITCH[1])
    if (ctx.reduced) {
      view.yaw = tgt.yaw
      view.pitch = tgt.pitch
      applyCam()
      shade()
    } else loop.start()
  }
  let drag: { id: number; x: number; y: number } | null = null
  let dragged = false
  if (!low) {
    stage.addEventListener('pointerdown', (e) => {
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY }
      dragged = false
    })
    stage.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y
      if (!dragged && Math.hypot(dx, dy) < 6) return
      if (!dragged) {
        dragged = true
        stage.setPointerCapture(e.pointerId)
        stage.classList.add('drag')
        turnHint?.done()
        turnHint = null
      }
      drag.x = e.clientX
      drag.y = e.clientY
      turn(dx * 0.32, -dy * 0.22)
    })
    const up = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return
      drag = null
      stage.classList.remove('drag')
      // the click that ends a drag must not light a bay
      setTimeout(() => (dragged = false), 0)
    }
    stage.addEventListener('pointerup', up)
    stage.addEventListener('pointercancel', up)
    root.addEventListener('keydown', (e) => {
      const d = ({ ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, 5], ArrowDown: [0, -5] } as Record<string, number[]>)[e.key]
      if (!d || (e.target as Element).closest('.t33h-read, .t33h-foot')) return
      e.preventDefault()
      turn(d[0], d[1])
      turnHint?.done()
      turnHint = null
    })
  }

  // ── lighting the bays
  function light(i: number) {
    const r = K.rooms[i]
    bays.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)))
    root.classList.add(`on-${i}`)
    root.dataset.cur = String(i)
    const st = (r as { station?: number }).station
    note.hidden = true
    reading.say(h('p', { class: 't33h-slip t33-ink' },
      h('b', { class: 't33h-name' }, r.name), ' — ', h('span', { class: 't33h-what' }, r.what),
      st ? h('a', { class: 't33h-link', href: `#/tram/${st}` }, fill(K.seeStation, { n: st })) : null))
    if (lit.has(i)) return
    lit.add(i)
    ctx.chime('tap')
    count.set(lit.size)
    pointNext()
    if (lit.size === K.rooms.length) {
      root.classList.add('all')
      ctx.insight(K.insight as Fact, K.detail as Fact)
      // after the thread has run: the moth settles on the notebooks, then the recipes; its warning takes the bay's line
      const steps: [number, () => void][] = [[low || ctx.reduced ? 0 : 2600, () => root.classList.add('moth1')], [low || ctx.reduced ? 0 : 2200, () => root.classList.add('moth2')], [low || ctx.reduced ? 0 : 1600, () => (reading.say(''), (note.hidden = false))]]
      let t = 0
      for (const [dt, fn] of steps) {
        t += dt
        const id = setTimeout(fn, t)
        ctx.onCleanup(() => clearTimeout(id))
      }
    }
  }
  ctx.onCleanup(onDigit((d) => d <= bays.length && bays[d - 1].click()))

  /** H1 + H5: the dot on the next dark bay's lantern (it rides in the model as it turns), the prompt naming that bay */
  function pointNext() {
    const k = K.rooms.findIndex((_, j) => !lit.has(j))
    if (k < 0) {
      next?.done()
      next = null
      return
    }
    if (!lamps[k]) return
    if (next) next.at(lamps[k])
    else next = g.dot(lamps[k], { dir: [0, 1] })
    root.dataset.next = String(k)
    if (lit.size) ctx.prompt(fill(K.promptNext, { name: short(k)[0] }))
  }
  // H7 · standing still: the next bay's lantern swings on its cord
  const onIdle = () => {
    const k = root.dataset.next
    if (low || ctx.reduced || k === undefined || !lamps[+k]) return
    lamps[+k].animate([{ rotate: '0deg' }, { rotate: '9deg', offset: 0.3 }, { rotate: '-6deg', offset: 0.65 }, { rotate: '0deg' }], { duration: 1500, easing: 'ease-in-out' })
  }
  ctx.el.addEventListener('p2:idle', onIdle)
  ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', onIdle))
}
