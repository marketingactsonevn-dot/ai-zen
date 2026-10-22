import { fill, h, s } from '../../core/dom'
import type { SceneCtx } from '../types'
import { createLoop } from '../../core/loop'
import { findTakeaway, foldedTakeaway } from '../../ui/part2/takeaway'
import { guide, type Counter, type Mark } from '../../ui/part2/guide'
import { C } from './data'
import { alive, f1, invite, nudge, stage } from './kit'
import { clamp, curve, rng, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist, moon, paperLantern } from '../../ui/part2/paint'

const K = C.scenes.shortcut
const N = 1, E = 2, S = 4, Wb = 8 // open sides of a cell
const STEP: [number, number, number, number][] = [[0, -1, N, S], [1, 0, E, Wb], [0, 1, S, N], [-1, 0, Wb, E]]
// in cells (one cell = one gravel lane): fence height / thickness, posts, the bell gate, the lantern carried above the gravel
const FH = 0.42, FT = 0.07, PH = 0.52, PR = 0.045, GH = 1.5, NK = 1.04, LH = 1.0
const REACH = 0.7 // how near the light must come for a footprint to be seen
const FOUND = 60 // % of the trail seen before the trick shows

/** A perfect maze on cols × rows (recursive backtracker, seeded): open[i] = the sides of cell i that are passages. */
function carve(cols: number, rows: number, seed: number) {
  const r = rng(seed)
  const open = new Uint8Array(cols * rows)
  const seen = new Uint8Array(cols * rows)
  const st = [Math.floor(cols / 2) + (rows - 1) * cols]
  seen[st[0]] = 1
  while (st.length) {
    const i = st[st.length - 1]
    const c = i % cols, rr = (i / cols) | 0
    const opts = STEP.filter(([dx, dy]) => c + dx >= 0 && rr + dy >= 0 && c + dx < cols && rr + dy < rows && !seen[c + dx + (rr + dy) * cols])
    if (!opts.length) {
      st.pop()
      continue
    }
    const [dx, dy, b, ob] = opts[Math.floor(r() * opts.length)]
    const j = c + dx + (rr + dy) * cols
    open[i] |= b
    open[j] |= ob
    seen[j] = 1
    st.push(j)
  }
  return open
}
/** The cells of the only way from a to b (breadth first over the passages). */
function solve(open: Uint8Array, cols: number, a: number, b: number) {
  const prev = new Int32Array(open.length).fill(-1)
  prev[a] = a
  const q = [a]
  while (q.length) {
    const i = q.shift()!
    if (i === b) break
    for (const [dx, dy, bit] of STEP) {
      if (!(open[i] & bit)) continue
      const j = i + dx + dy * cols
      if (prev[j] < 0) (prev[j] = i), q.push(j)
    }
  }
  const out = [b]
  while (out[0] !== a) out.unshift(prev[out[0]])
  return out
}

/** Smooth a lane's centre line (cells): straight runs, a quarter turn of radius rad at each corner, resampled densely. */
function smooth(pts: Pt[], rad: number): Pt[] {
  const o: Pt[] = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], [cx, cy] = pts[i + 1]
    const d1 = Math.hypot(bx - ax, by - ay) || 1, d2 = Math.hypot(cx - bx, cy - by) || 1
    o.push(...curve([bx - ((bx - ax) / d1) * rad, by - ((by - ay) / d1) * rad], [bx, by], [bx + ((cx - bx) / d2) * rad, by + ((cy - by) / d2) * rad], 6))
  }
  o.push(pts[pts.length - 1])
  const dense: Pt[] = [o[0]]
  for (let i = 1; i < o.length; i++) {
    const [ax, ay] = o[i - 1], [bx, by] = o[i]
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / 0.06))
    for (let k = 1; k <= n; k++) dense.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n])
  }
  return dense
}
const offset = (pts: Pt[], o: number): Pt[] => pts.map((p, i) => {
  const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
  return [p[0] - ((b[1] - a[1]) / l) * o, p[1] + ((b[0] - a[0]) / l) * o]
})

/** Path data, painted in order: within one batch nothing overlaps, so each tone can be one path. */
const TONES = ['face shade', 'face', 'face lit', 'slat', 'batten', 'tie', 'cap', 'rail', 'rail-lit', 'post', 'post-lit', 'post-cap', 'beam', 'beam-lit'] as const
type Tone = (typeof TONES)[number]
type Item = { z: number; box: number[]; paint?: (acc: Record<Tone, string>) => void; el?: () => SVGElement }

/**
 * Scene 3 (audit g08 24-3, Làm lại) — a real karesansui seen obliquely from about 45° up: white gravel lanes divided by
 * bound bamboo fences with real thickness, moss and rocks round it, the bell gate at the far end (upper right), the entry
 * gate below left with the task's ema. Mist hides the moon; the only light is the lantern you carry. The bell has already
 * rung. Carry the light back along the footprints from the bell toward the gate: once more than 60 % of the trail is seen,
 * the holes in the fences and the never-raked lanes of the true way show; the mist lifts, and the long way runs by itself
 * for comparison, raking every lane before the bell rings again. Then the three checks are handed over.
 */
export function shortcutScene(ctx: SceneCtx) {
  const still = ctx.reduced || ctx.quality === 'low'
  let found = false
  const card = findTakeaway(K.takeaway)
  const { root } = stage(ctx, 't24c', K.art, [K.insight], draw, true)
  const svg = (cls: string) => s('svg', { class: `t24-svg ${cls}`, 'aria-hidden': 'true' })
  const skySvg = svg('t24c-sky')
  const groundSvg = svg('t24c-ground')
  const lampShSvg = svg('t24c-lampsh')
  const lampSh = s('path', { class: 't24c-lsh' })
  lampShSvg.append(lampSh)
  const buildSvg = svg('t24c-build')
  const nearSvg = svg('t24c-near')
  // the night over the garden (not the sky): one warm hole where the lantern is; the warm pool on the gravel
  const dark = h('div', { class: 't24c-dark' })
  const night = h('div', { class: 't24c-night' }, dark)
  const pool = h('div', { class: 't24c-pool' })
  const lampSvg = s('svg', { class: 't24c-lampart', 'aria-hidden': 'true' })
  const lamp = h('div', { class: 't24c-lamp', role: 'slider', tabindex: '0', 'aria-label': K.lampAria, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0', 'aria-orientation': 'vertical' }, lampSvg)
  // words hung on things: the bell's plaque, the task's ema at the entry, the note on the broken fence, the long way's tag
  const cord = () => h('i', { class: 't24c-cord', 'aria-hidden': 'true' })
  const plaque = h('div', { class: 't24c-plaque' }, h('b', null, K.bell))
  const claim = h('div', { class: 't24c-claim' }, h('p', null, K.claim), h('p', { class: 't24c-claim-decode' }, K.decode)) // (a phone says the decode up here: its ema stays short)
  const task = h('div', { class: 't24c-ema t24c-wood' }, cord(), h('p', null, K.task, h('small', null, K.decode)))
  const reveal = h('div', { class: 't24c-note', 'aria-live': 'polite' }, h('p'))
  const longTag = h('div', { class: 't24c-tag t24c-wood', 'aria-hidden': 'true' }, h('p', null, K.long))
  const slip = h('div', { class: 't24c-slip' }, card ? foldedTakeaway([card], ctx.onCleanup) : null)
  const host = h('div', { class: 't24c-host' }, skySvg, groundSvg, lampShSvg, pool, buildSvg, night, nearSvg, task, plaque, claim, reveal, longTag, lamp, slip)
  root.append(host)
  ctx.prompt(K.prompt)
  alive(ctx, root)
  const g = guide(ctx)
  let dot: Mark | null = g.dot(lamp, { dir: [-0.6, 0.8] })
  let count: Counter | null = null

  // ── the camera: plan in cells (x across, z from the far edge toward us, y up), turned by yaw, looking down by pitch
  const cam = { ca: 1, sa: 0, cp: 0.7, sp: 0.71, D: 14, f: 1, ox: 0, oy: 0, cx: 0, cz: 0 }
  const tmp: Pt = [0, 0]
  /** plan → screen px into o; returns the depth (distance along the view, for painting far to near) */
  function P(x: number, y: number, z: number, o: Pt = tmp) {
    const px = x - cam.cx, pz = z - cam.cz
    const rx = px * cam.ca - pz * cam.sa, rz = px * cam.sa + pz * cam.ca
    const zc = cam.D - y * cam.sp - rz * cam.cp
    o[0] = cam.ox + (cam.f * rx) / zc
    o[1] = cam.oy - (cam.f * (y * cam.cp - rz * cam.sp)) / zc
    return zc
  }
  const pt = (x: number, y: number, z: number): Pt => {
    const o: Pt = [0, 0]
    P(x, y, z, o)
    return o
  }
  /** screen px → the point of the gravel under it (plan) */
  function U(sx: number, sy: number): Pt {
    const a = (sx - cam.ox) / cam.f, b = -(sy - cam.oy) / cam.f
    const dy = Math.min(-1e-3, b * cam.cp - cam.sp)
    const t = (-cam.D * cam.sp) / dy
    const rx = t * a, rz = cam.D * cam.cp + t * (-b * cam.sp - cam.cp)
    return [rx * cam.ca + rz * cam.sa + cam.cx, -rx * cam.sa + rz * cam.ca + cam.cz]
  }
  /** px per cell at a depth */
  const scale = (zc: number) => cam.f / zc
  const poly = (pts: Pt[]) => `M${pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}Z`
  const line = (pts: Pt[]) => `M${pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}`
  const flat = (pts: Pt[], y = 0) => pts.map(([x, z]) => pt(x, y, z))
  const ring = (x: number, z: number, rx: number, rz: number, a = 0, n = 12, wob = 0, seed = 1): Pt[] => {
    const r = rng(seed)
    const ca = Math.cos(a), sa = Math.sin(a)
    return Array.from({ length: n }, (_, i) => {
      const t = (i / n) * Math.PI * 2, k = 1 + (r() - 0.5) * wob
      const u = Math.cos(t) * rx * k, v = Math.sin(t) * rz * k
      return [x + u * ca - v * sa, z + u * sa + v * ca] as Pt
    })
  }

  const G = { W: 0, H: 0, cols: 7, rows: 6, mid: 3, wide: true, cpx: 0, cpz: 0, mx: 0, mz: 0, lu: 0, lv: 0, k: 0, pr: 0, keep: [] as number[][], emaC: [0, 0, 0, 0] }
  let runs: [number, number, number, number][] = [] // fence runs on the plan (cells), for the lantern's shadows
  let prints: { x: number; z: number; el: SVGPathElement; seen: boolean }[] = []
  let gaps: Pt[] = []
  let rakeMain: SVGPathElement[] = []
  let bell: SVGGElement | null = null
  let RACK: Pt = [0, 0] // the ema rack on the moss (plan), left of the entry

  function* draw(W: number, H: number) {
    const wide = W / H >= 1.05
    const cols = wide ? 7 : 5, rows = wide ? 6 : 7
    const mid = Math.floor(cols / 2)
    Object.assign(G, { W, H, cols, rows, mid, wide })
    // the bell gate a third in from the top right, the entry low on the left: the true axis runs across the frame
    const yaw = ((wide ? 31 : 17) * Math.PI) / 180, pitch = ((wide ? 46 : 50) * Math.PI) / 180
    Object.assign(cam, { ca: Math.cos(yaw), sa: Math.sin(yaw), cp: Math.cos(pitch), sp: Math.sin(pitch), D: Math.max(cols, rows) * 2.1, cx: cols / 2, cz: rows / 2, f: 1, ox: 0, oy: 0 })
    G.cpx = cam.cx + cam.D * cam.cp * cam.sa
    G.cpz = cam.cz + cam.D * cam.cp * cam.ca
    // the moon (behind the mist): high, to the right and beyond the far edge
    G.mx = 0.55 * cam.ca - 0.83 * cam.sa
    G.mz = -0.55 * cam.sa - 0.83 * cam.ca
    // fit the bed and the gate's beam into the frame
    const box = wide ? [W * 0.19, H * 0.11, W * 0.66, H * 0.92] : [W * 0.08, H * 0.13, W * 0.92, H * 0.72]
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity
    for (const [x, y, z] of [[0, 0, 0], [cols, 0, 0], [cols, 0, rows], [0, 0, rows], [mid - 0.4, GH, 0], [mid + 1.4, GH, 0], [mid + 0.5, 0, rows + 0.6]]) {
      P(x, y, z)
      bx0 = Math.min(bx0, tmp[0]), bx1 = Math.max(bx1, tmp[0]), by0 = Math.min(by0, tmp[1]), by1 = Math.max(by1, tmp[1])
    }
    const k = Math.min((box[2] - box[0]) / (bx1 - bx0), (box[3] - box[1]) / (by1 - by0))
    cam.f = k
    cam.ox = (box[0] + box[2]) / 2 - (k * (bx0 + bx1)) / 2
    cam.oy = (box[1] + box[3]) / 2 - (k * (by0 + by1)) / 2
    for (const el of [skySvg, groundSvg, lampShSvg, buildSvg, nearSvg]) el.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    // the maze whose true way is longest and whose middle column keeps most walls (the shortcut breaks them)
    let best = { open: new Uint8Array(0), sol: [] as number[], score: -1 }
    for (let q = 0; q < 14; q++) {
      const open = carve(cols, rows, 2460 + q)
      const sol = solve(open, cols, mid + (rows - 1) * cols, mid)
      let walls = 0
      for (let r = 1; r < rows; r++) if (!(open[mid + r * cols] & N)) walls++
      const score = sol.length + walls * 3
      if (score > best.score) best = { open, sol, score }
    }
    drawSky()
    yield
    place()
    drawGround(best.open, best.sol)
    yield
    yield* drawBuilt(best.open)
    drawNear()
    if (!G.lu) moveLamp(mid + 0.5, 0.6)
    else moveLamp(G.lu, G.lv)
  }

  /** Beyond the far edge the ground melts into mist; far ranges; the moon high on the right, veiled by a drifting band. */
  function drawSky() {
    const { W, H, wide } = G
    const far = pt(cam.cx, 0, -2.2)[1]
    const mx = W * (wide ? 0.86 : 0.18), my = Math.max(H * 0.07, far - H * (wide ? 0.13 : 0.08)), mr = Math.min(W, H) * (wide ? 0.034 : 0.05)
    skySvg.replaceChildren(
      hills(-W * 0.1, W * 1.1, far + 2, H * (wide ? 0.11 : 0.07), 2462, 0.9, wide ? 6 : 3),
      hills(W * 0.35, W * 1.15, far + 4, H * 0.06, 2463, 0.6, 2),
      mist(W * 0.5, far + 2, W * 0.75, H * 0.05),
      s('circle', { class: 't24c-moonglow', cx: f1(mx), cy: f1(my), r: f1(mr * 6), fill: 'url(#p2-halo)' }),
      moon(mx, my, mr, 2461, false),
      // the veil over the moon: thin mist, not clouds; it drifts off once the trick is seen
      s('g', { class: 't24c-veil' }, mist(mx - mr * 1.5, my + mr * 0.3, mr * 7, mr * 1.1), mist(mx + mr * 2, my - mr * 0.6, mr * 5, mr * 0.8), mist(mx - mr * 4, my + mr * 1.4, mr * 6, mr * 0.7)))
  }

  /**
   * The ground plane: moss all round fading into the mist far off, the gravel bed with its curb, the dead-end lanes raked
   * along their turns, the true way scuffed and never raked (its rake lines wait for the long walk), the footprints of the
   * shortcut straight from the entry to the bell, the moon's short shadows (shown once the mist lifts).
   */
  function drawGround(open: Uint8Array, sol: number[]) {
    const { W, H, cols, rows, mid } = G
    const r = rng(2471)
    const farY = pt(cam.cx, 0, -2.2)[1]
    // moss: a field far bigger than the frame, with darker cushions and specks
    const field = flat([[-30, -14], [cols + 30, -14], [cols + 30, rows + 12], [-30, rows + 12]])
    let cushions = '', specks = '', curb = '', curbSh = '', stepD = ''
    // moss: low tufts in drifts, thicker near the curb (short strokes on the ground, no blots)
    for (let i = 0; i < 70; i++) {
      const edge = r() < 0.6
      const x = edge ? (r() < 0.5 ? -0.25 - r() * 0.8 : cols + 0.25 + r() * 0.8) : -4 + r() * (cols + 8)
      const z = edge ? r() * rows : -1 + r() * (rows + 4)
      if (x > -0.2 && x < cols + 0.2 && z > -0.2 && z < rows + 0.2) continue
      const [sx, sy] = pt(x, 0, z), k = scale(P(x, 0, z)) * 0.05
      for (let j = 0; j < 7; j++) {
        const ox = sx + (r() - 0.5) * k * 3.4, oy = sy + (r() - 0.5) * k * 1.2
        cushions += stroke([[ox, oy], [ox + (r() - 0.5) * k * 0.8, oy - k * (0.6 + r() * 0.7)]], Math.max(1, k * 0.22), 0.1, 0.5, 0.3)
      }
    }
    for (let i = 0; i < 900; i++) {
      const x = -5 + r() * (cols + 10), z = -2 + r() * (rows + 7)
      if (x > -0.3 && x < cols + 0.3 && z > -0.3 && z < rows + 0.3) continue
      const [sx, sy] = pt(x, 0, z)
      specks += `M${f1(sx)} ${f1(sy)}h${f1(1 + r() * 2)}`
    }
    // the curb: small stones round the bed, each with its contact shadow
    const per: Pt[] = [[-0.12, -0.12], [cols + 0.12, -0.12], [cols + 0.12, rows + 0.12], [-0.12, rows + 0.12]]
    for (let k = 0; k < 4; k++) {
      const [ax, az] = per[k], [bx, bz] = per[(k + 1) % 4]
      const n = Math.round(Math.hypot(bx - ax, bz - az) / 0.3)
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t
        if (Math.abs(x - mid - 0.5) < 0.6 && (k === 0 || k === 2)) continue // the two gates
        curb += poly(flat(ring(x, z, 0.13 + r() * 0.04, 0.1 + r() * 0.03, r(), 10, 0.2, 2480 + k * 50 + i), 0.03))
        curbSh += poly(flat(ring(x - G.mx * 0.04, z - G.mz * 0.04, 0.15, 0.12, 0, 10)))
      }
    }
    // stepping stones from the bottom of the frame to the entry gate
    let stepSide = ''
    for (let i = 0; i < 4; i++) {
      const q = ring(mid + 0.5 - i * 0.5 - 0.15 * Math.sin(i), rows + 0.85 + i * 0.75, 0.3, 0.22, 0.4 + i * 0.2, 14, 0.15, 2490 + i)
      stepSide += poly(flat(q, 0))
      stepD += poly(flat(q, 0.07))
    }
    // the gravel: grain everywhere on the bed
    let grain = ''
    for (let i = 0; i < (G.wide ? 900 : 600); i++) {
      const [sx, sy] = pt(r() * cols, 0, r() * rows)
      grain += `M${f1(sx)} ${f1(sy)}h${f1(0.8 + r() * 1.2)}`
    }
    // lanes as chains: the true way first (entry → bell), then every branch off it, depth first
    const at = (i: number): Pt => [(i % cols) + 0.5, ((i / cols) | 0) + 0.5]
    const next = new Map(sol.map((v, i) => [v, sol[i + 1]]))
    const done = new Uint8Array(open.length)
    const chains: number[][] = []
    const todo: [number, number | null][] = [[sol[0], null]]
    while (todo.length) {
      const [start, from] = todo.pop()!
      const chain = from == null ? [start] : [from, start]
      done[start] = 1
      let cur = start
      for (;;) {
        if (from == null && cur === sol[sol.length - 1]) {
          for (const [dx, dy, bit] of STEP) if (open[cur] & bit && !done[cur + dx + dy * cols]) todo.push([cur + dx + dy * cols, cur])
          break
        }
        const nb: number[] = []
        for (const [dx, dy, bit] of STEP) if (open[cur] & bit && !done[cur + dx + dy * cols]) nb.push(cur + dx + dy * cols)
        if (!nb.length) break
        const pref = next.get(cur)
        nb.sort((a, b) => (b === pref ? 1 : 0) - (a === pref ? 1 : 0))
        for (const j of nb.slice(1)) todo.push([j, cur])
        cur = nb[0]
        done[cur] = 1
        chain.push(cur)
      }
      chains.push(chain)
    }
    const offs = [-0.3, -0.15, 0, 0.15, 0.3]
    let rakes = '', scuff = ''
    rakeMain = []
    chains.forEach((ch, k) => {
      const pts = ch.map(at)
      if (k === 0) {
        pts.unshift([pts[0][0], rows + 0.3])
        pts.push([pts[pts.length - 1][0], -0.2])
        const dense = smooth(pts, 0.5)
        for (const o of offs) rakeMain.push(s('path', { class: 't24c-rake main', d: line(flat(offset(dense, o))), pathLength: 1 }))
        for (let i = 0; i < dense.length; i += 2) {
          const [x, z] = dense[i]
          if (r() < 0.3) { const sx0 = x + (r() - 0.5) * 0.7, sz0 = z + (r() - 0.5) * 0.7; scuff += line(flat([[sx0, sz0], [sx0 + (r() - 0.5) * 0.22, sz0 + (r() - 0.5) * 0.22]])) }
        }
      } else {
        const [a, b] = [pts[0], pts[1]]
        pts[0] = [a[0] + (b[0] - a[0]) * 0.45, a[1] + (b[1] - a[1]) * 0.45]
        const dense = smooth(pts, 0.5)
        for (const o of offs) rakes += line(flat(offset(dense, o)))
        // a rounded end where the lane stops
        const [ex, ez] = dense[dense.length - 1], [qx, qz] = dense[dense.length - 2]
        const ang = Math.atan2(ez - qz, ex - qx)
        for (const o of offs.filter((o) => o > 0)) rakes += line(flat(Array.from({ length: 9 }, (_, i) => { const t = ang - Math.PI / 2 + (i / 8) * Math.PI; return [ex + Math.cos(t) * o, ez + Math.sin(t) * o] as Pt })))
      }
    })
    // the shortcut's footprints: straight up the middle column from outside the entry to under the bell (toes toward it)
    const sx = mid + 0.5
    gaps = []
    for (let rr = 1; rr < rows; rr++) if (!(open[mid + rr * cols] & N)) gaps.push([sx, rr])
    const old = new Set(prints.filter((p) => p.seen).map((p) => `${p.x.toFixed(2)},${p.z.toFixed(2)}`))
    prints = []
    for (let z = 0.25, i = 0; z < rows + 0.45; z += 0.26, i++) {
      const side = i % 2 ? 1 : -1, x = sx + side * 0.075
      const d = poly(flat(ring(x, z - 0.03, 0.034, 0.05, 0, 10))) + poly(flat(ring(x, z + 0.055, 0.026, 0.03, 0, 8)))
      const el = s('path', { class: 't24c-print', d })
      const p = { x, z, el, seen: old.has(`${x.toFixed(2)},${z.toFixed(2)}`) }
      el.classList.toggle('seen', p.seen)
      prints.push(p)
    }
    // where the shortcut broke through: kicked-up gravel, broken canes lying about
    let litter = ''
    for (const [gx, gz] of gaps) {
      for (let k = 0; k < 4; k++) { const x = gx + (r() - 0.5) * 0.45, z = gz + (r() - 0.5) * 0.35; scuff += line(flat([[x, z], [x + (r() - 0.5) * 0.25, z + (r() - 0.5) * 0.2]])) }
      for (let k = 0; k < 3; k++) {
        const a = (r() - 0.5) * 1.6, l = 0.2 + r() * 0.2, x = gx + (r() - 0.5) * 0.4, z = gz + (r() - 0.3) * 0.35
        const q = flat([[x, z], [x + Math.cos(a) * l, z + Math.sin(a) * l]], 0.015)
        litter += stroke(q, Math.max(1.6, scale(P(x, 0, z)) * 0.03), 0.05, 0.05, 0.6)
      }
    }
    groundSvg.replaceChildren(
      s('defs', null,
        s('linearGradient', { id: 't24c-mossg', gradientUnits: 'userSpaceOnUse', x1: 0, y1: f1(farY - H * 0.02), x2: 0, y2: f1(H) }, s('stop', { offset: 0, class: 't24c-mg0' }), s('stop', { offset: 0.18, class: 't24c-mg1' }), s('stop', { offset: 1, class: 't24c-mg2' })),
        s('radialGradient', { id: 't24c-bedg', gradientUnits: 'userSpaceOnUse', cx: f1(pt(cam.cx, 0, cam.cz)[0]), cy: f1(pt(cam.cx, 0, cam.cz)[1]), r: f1(Math.max(W, H) * 0.5) }, s('stop', { offset: 0, class: 't24c-bg0' }), s('stop', { offset: 1, class: 't24c-bg1' }))),
      s('path', { class: 't24c-moss0', d: poly(field), fill: 'url(#t24c-mossg)' }),
      s('ellipse', { class: 't24c-moonwash', cx: f1(W * 0.78), cy: f1(farY + H * 0.12), rx: f1(W * 0.7), ry: f1(H * 0.45), fill: 'url(#p2-halo)' }),
      s('path', { class: 't24c-moss1', d: cushions }),
      s('path', { class: 't24c-specks', d: specks }),
      s('path', { class: 't24c-steps-sh', d: stepSide, transform: 'translate(3 2)' }),
      s('path', { class: 't24c-steps-side', d: stepSide }),
      s('path', { class: 't24c-steps', d: stepD, filter: 'url(#ink-rough)' }),
      s('path', { class: 't24c-bed', d: poly(flat([[-0.05, -0.05], [cols + 0.05, -0.05], [cols + 0.05, rows + 0.05], [-0.05, rows + 0.05]])), fill: 'url(#t24c-bedg)' }),
      s('path', { class: 't24c-grain', d: grain }),
      s('path', { class: 't24c-rake', d: rakes }),
      s('path', { class: 't24c-rake-hi', d: rakes, transform: 'translate(0 1.1)' }),
      s('g', { class: 't24c-mainrake' }, ...rakeMain),
      s('path', { class: 't24c-scuff', d: scuff }),
      s('path', { class: 't24c-moonsh' }),
      s('g', { class: 't24c-prints' }, ...prints.map((p) => p.el)),
      s('path', { class: 't24c-litter', d: litter }),
      s('path', { class: 't24c-gapmark', d: gaps.map(([x, z]) => poly(flat(ring(x, z, 0.36, 0.22, 0, 24)))).join('') }),
      s('path', { class: 't24c-curb-sh', d: curbSh }),
      s('path', { class: 't24c-curb', d: curb, filter: 'url(#ink-rough)' }))
    for (const p of rakeMain) p.style.strokeDashoffset = (1 - (found ? t : 0)).toFixed(4)
  }

  /**
   * What stands on the ground, painted far to near: every fence (a face toward us, its top, split canes, two battens with
   * black cord, a round rail on top), the posts at the joints, the two gates and the bell, rocks and clipped shrubs.
   */
  function* drawBuilt(open: Uint8Array) {
    const { cols, rows, mid } = G
    const items: Item[] = []
    const r = rng(2480)
    runs = []
    const nodes = new Set<number>()
    const node = (x: number, z: number) => nodes.add(x * 100 + z)
    const box = (ps: Pt[]) => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
      for (const [x, y] of ps) (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y))
      return [x0 - 2, y0 - 2, x1 + 2, y1 + 2]
    }
    // a fence between plan points a and b (one cell), the part t0 … t1 of it
    const fence = (ax: number, az: number, bx: number, bz: number, t0: number, t1: number) => {
      const ex = bx - ax, ez = bz - az
      let nx = -ez, nz = ex
      const mx = ax + ex * (t0 + t1) * 0.5, mz = az + ez * (t0 + t1) * 0.5
      if ((G.cpx - mx) * nx + (G.cpz - mz) * nz < 0) (nx = -nx), (nz = -nz)
      const ox = (nx * FT) / 2, oz = (nz * FT) / 2
      const x0 = ax + ex * t0, z0 = az + ez * t0, x1 = ax + ex * t1, z1 = az + ez * t1
      const lit = nx * G.mx + nz * G.mz
      const tone: Tone = lit > 0.25 ? 'face lit' : lit < -0.25 ? 'face shade' : 'face'
      const g0 = pt(x0 + ox, 0, z0 + oz), g1 = pt(x1 + ox, 0, z1 + oz), u0 = pt(x0 + ox, FH, z0 + oz), u1 = pt(x1 + ox, FH, z1 + oz)
      const b0 = pt(x0 - ox, FH, z0 - oz), b1 = pt(x1 - ox, FH, z1 - oz)
      const zc = P(mx, FH / 2, mz)
      const sc = scale(zc)
      const seed = Math.round(ax * 31 + az * 17 + t0 * 7)
      items.push({
        z: zc,
        box: box([g0, g1, u0, u1, b0, b1]),
        paint(acc) {
          const q = rng(seed)
          acc[tone] += poly([g0, g1, u1, u0])
          acc.cap += poly([u0, u1, b1, b0])
          // split canes standing side by side
          const n = Math.max(3, Math.round(((t1 - t0) / 0.055) * Math.min(1, sc / 40)))
          for (let i = 1; i < n; i++) {
            const t = t0 + ((t1 - t0) * (i + (q() - 0.5) * 0.3)) / n
            acc.slat += line([pt(ax + ex * t + ox, 0.015, az + ez * t + oz), pt(ax + ex * t + ox, FH * (0.96 + q() * 0.03), az + ez * t + oz)])
          }
          // two battens proud of the face, bound with black cord; the round rail on top
          for (const y of [FH * 0.3, FH * 0.7]) {
            const o2x = ox * 1.7, o2z = oz * 1.7
            acc.batten += poly([pt(x0 + o2x, y - 0.016, z0 + o2z), pt(x1 + o2x, y - 0.016, z1 + o2z), pt(x1 + o2x, y + 0.016, z1 + o2z), pt(x0 + o2x, y + 0.016, z0 + o2z)])
            for (const t of [0.3, 0.7]) {
              if (t < t0 || t > t1) continue
              const cx = ax + ex * t + o2x * 1.1, cz = az + ez * t + o2z * 1.1, w = 0.022
              acc.tie += poly([pt(cx - ex * w, y - 0.03, cz - ez * w), pt(cx + ex * w, y - 0.03, cz + ez * w), pt(cx + ex * w, y + 0.03, cz + ez * w), pt(cx - ex * w, y + 0.03, cz - ez * w)])
            }
          }
          const o3x = ox * 1.25, o3z = oz * 1.25
          acc.rail += poly([pt(x0 + o3x, FH - 0.018, z0 + o3z), pt(x1 + o3x, FH - 0.018, z1 + o3z), pt(x1, FH + 0.035, z1), pt(x0, FH + 0.035, z0)])
          acc['rail-lit'] += line([pt(x0 + ex * 0.03, FH + 0.03, z0 + ez * 0.03), pt(x1 - ex * 0.03, FH + 0.03, z1 - ez * 0.03)])
        },
      })
    }
    const wall = (ax: number, az: number, bx: number, bz: number, broken: boolean) => {
      node(ax, az)
      node(bx, bz)
      runs.push([ax, az, bx, bz])
      if (!broken) return fence(ax, az, bx, bz, 0, 1)
      // kicked through: two stubs with ragged ends
      fence(ax, az, bx, bz, 0, 0.27 + r() * 0.04)
      fence(ax, az, bx, bz, 0.71 + r() * 0.04, 1)
    }
    for (let rr = 0; rr <= rows; rr++)
      for (let c = 0; c < cols; c++) {
        const edge = rr === 0 || rr === rows
        if (edge ? c === mid : open[c + rr * cols] & N) continue
        wall(c, rr, c + 1, rr, !edge && c === mid)
      }
    for (let c = 0; c <= cols; c++)
      for (let rr = 0; rr < rows; rr++) if (c === 0 || c === cols || !(open[c + rr * cols] & Wb)) wall(c, rr, c, rr + 1, false)
    yield
    // posts at every joint (the gates' own posts are taller)
    const gate = new Set([mid * 100, (mid + 1) * 100, mid * 100 + rows, (mid + 1) * 100 + rows])
    for (const key of nodes) {
      if (gate.has(key)) continue
      const x = Math.floor(key / 100), z = key % 100
      post(items, x, z, PR, PH)
    }
    post(items, mid, 0, PR * 1.5, GH + 0.05)
    post(items, mid + 1, 0, PR * 1.5, GH + 0.05)
    post(items, mid, rows, PR * 1.2, 0.86)
    post(items, mid + 1, rows, PR * 1.2, 0.86)
    // the bell gate's beams: the kasagi on top (ends lifted), a low tie; the entry's crossbar
    beam(items, mid - 0.38, mid + 1.38, 0, GH, 0.09, 0.05)
    beam(items, mid - 0.14, mid + 1.14, 0, NK, 0.065, 0)
    beam(items, mid - 0.25, mid + 1.25, rows, 0.78, 0.055, 0.02)
    // the ema rack: two bamboo legs and a bar, out on the moss left of the gate
    // (tall and wide enough that the ema hangs between its legs, clear of the ground)
    const rw = G.wide ? 1.05 : 1.15, rh = G.wide ? 2.3 : 2.2
    post(items, RACK[0] - rw, RACK[1], PR * 1.3, rh + 0.08)
    post(items, RACK[0] + rw, RACK[1], PR * 1.3, rh + 0.08)
    beam(items, RACK[0] - rw - 0.18, RACK[0] + rw + 0.18, RACK[1] - 0.04, rh, 0.07, 0.03)
    beam(items, RACK[0] - rw, RACK[0] + rw, RACK[1] - 0.04, 0.35, 0.05, 0)
    // the bell under the kasagi
    {
      const xm = mid + 0.5
      const top = pt(xm, NK - 0.01, 0.02), t2 = pt(xm, NK - 0.12, 0.02), bot = pt(xm, NK - 0.5, 0.02)
      const zc = P(xm, NK - 0.3, 0)
      const bw = scale(zc) * 0.17
      items.push({
        z: zc - 0.05,
        box: [top[0] - bw * 1.4, top[1], top[0] + bw * 1.4, bot[1] + 4],
        el: () => (bell = bellArt(top, t2, bot, bw)),
      })
    }
    // rocks and clipped azaleas round the bed (billboards standing on the moss)
    const props: [number, number, number, number, boolean][] = G.wide
      ? [[-0.9, 0.9, 1.0, 0.55, false], [-0.8, 3.2, 0.9, 0.55, true], [-1.6, 5.4, 1.1, 0.6, true], [-0.9, rows + 1.1, 0.8, 0.4, false], [cols + 0.9, 0.5, 0.9, 0.55, true], [cols + 0.8, 2.6, 1.1, 0.6, false], [cols + 1.5, 4.8, 1.0, 0.55, true], [cols + 0.6, rows + 0.9, 0.7, 0.38, false], [mid + 2.6, -0.9, 1.1, 0.62, true], [mid - 1.8, -0.8, 0.8, 0.45, false]]
      : [[-0.6, 1.4, 0.7, 0.42, true], [cols + 0.6, 2.8, 0.8, 0.45, false], [-0.6, 5.2, 0.7, 0.4, false], [cols + 0.6, rows - 0.6, 0.7, 0.42, true], [mid + 2.3, -0.8, 0.9, 0.5, true], [mid - 1.6, -0.7, 0.7, 0.4, false]]
    for (const [x, z, w, hh, shrub] of props) {
      const b = pt(x, 0, z), zc = P(x, hh / 2, z), sc = scale(zc)
      const pw = w * sc, ph = hh * sc
      // nothing stands where words are written
      if (G.keep.some((k) => b[0] + pw * 0.6 > k[0] && b[0] - pw * 0.6 < k[2] && b[1] > k[1] && b[1] - ph < k[3])) continue
      items.push({
        z: zc,
        box: [b[0] - pw * 0.6, b[1] - ph, b[0] + pw * 0.6, b[1] + ph * 0.2],
        el: () => s('g', { transform: `translate(${f1(b[0])} ${f1(b[1])})` }, shrub ? shrubArt(pw, ph, 2510 + Math.round(x * 10 + z)) : stoneArt(pw, ph, 2500 + Math.round(x * 10 + z * 3), 'p2-stone t24c-rock')),
      })
    }
    yield
    // paint far to near; whatever does not overlap shares one path per tone
    items.sort((a, b) => b.z - a.z)
    const out: SVGElement[] = []
    let acc = blank(), batch: number[][] = []
    const flush = () => {
      if (!batch.length) return
      const grp = s('g', null)
      for (const t of TONES) if (acc[t]) grp.append(s('path', { class: `t24c-${t.replace(' ', ' t24c-')}`, d: acc[t] }))
      out.push(grp)
      acc = blank()
      batch = []
    }
    for (const it of items) {
      if (it.el) {
        flush()
        out.push(it.el())
        continue
      }
      const [x0, y0, x1, y1] = it.box
      if (batch.some((b) => x0 < b[2] && x1 > b[0] && y0 < b[3] && y1 > b[1])) flush()
      it.paint!(acc)
      batch.push(it.box)
    }
    flush()
    buildSvg.replaceChildren(...out)
    // the moon's shadows of every run, for the ground (seen once the mist lifts)
    let msh = ''
    const sx = -G.mx * FH * 0.4, sz = -G.mz * FH * 0.4
    for (const [x0, z0, x1, z1] of runs) msh += poly([pt(x0, 0, z0), pt(x1, 0, z1), pt(x1 + sx, 0, z1 + sz), pt(x0 + sx, 0, z0 + sz)])
    groundSvg.querySelector('.t24c-moonsh')?.setAttribute('d', msh)
  }
  const blank = () => Object.fromEntries(TONES.map((t) => [t, ''])) as Record<Tone, string>

  /** A round post at a joint: its shaft (lit on the moon's side), the cut end on top. */
  function post(items: Item[], x: number, z: number, rad: number, ht: number) {
    const b = pt(x, 0, z), t = pt(x, ht, z)
    const zc = P(x, ht / 2, z)
    const w = scale(zc) * rad
    const side = G.mx * cam.ca - G.mz * cam.sa > 0 ? 1 : -1 // the moon's side on screen
    items.push({
      z: zc - 0.08,
      box: [b[0] - w - 2, t[1] - w - 2, b[0] + w + 2, b[1] + 2],
      paint(acc) {
        acc.post += poly([[b[0] - w, b[1]], [t[0] - w, t[1]], [t[0] + w, t[1]], [b[0] + w, b[1]]])
        acc['post-lit'] += poly([[t[0] + side * w * 0.35, t[1]], [t[0] + side * w * 0.8, t[1]], [b[0] + side * w * 0.8, b[1]], [b[0] + side * w * 0.35, b[1]]])
        const ry = w * cam.sp * 0.9
        acc['post-cap'] += `M${f1(t[0] - w)} ${f1(t[1])}a${f1(w)} ${f1(ry)} 0 1 0 ${f1(w * 2)} 0a${f1(w)} ${f1(ry)} 0 1 0 ${f1(-w * 2)} 0Z`
      },
    })
  }
  /** A beam across a gate at height y (plan x0 … x1 at z), th thick, its ends lifted by lift. */
  function beam(items: Item[], x0: number, x1: number, z: number, y: number, th: number, lift: number) {
    const n = 12
    const top: Pt[] = [], bot: Pt[] = []
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = x0 + (x1 - x0) * t, up = lift * Math.pow(Math.abs(t - 0.5) * 2, 3)
      top.push(pt(x, y + th + up, z + 0.04))
      bot.push(pt(x, y + up, z + 0.04))
    }
    const zc = P((x0 + x1) / 2, y, z) - 0.12
    items.push({
      z: zc,
      box: box2([...top, ...bot]),
      paint(acc) {
        acc.beam += poly([...top, ...bot.reverse()])
        bot.reverse()
        acc['beam-lit'] += line(top)
      },
    })
  }
  const box2 = (ps: Pt[]) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const [x, y] of ps) (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y))
    return [x0 - 2, y0 - 2, x1 + 2, y1 + 2]
  }

  /** The bronze bell on its rope: crown, waist, flared lip, a lit flank, the striker below (swings from the rope's top). */
  function bellArt(top: Pt, t2: Pt, bot: Pt, bw: number) {
    const x = t2[0], y0 = t2[1], hh = bot[1] - y0
    const d = `M${f1(x - bw * 0.42)} ${f1(y0 + hh * 0.06)}Q${f1(x)} ${f1(y0 - hh * 0.06)} ${f1(x + bw * 0.42)} ${f1(y0 + hh * 0.06)}C${f1(x + bw * 0.5)} ${f1(y0 + hh * 0.5)} ${f1(x + bw * 0.55)} ${f1(y0 + hh * 0.78)} ${f1(x + bw * 0.78)} ${f1(y0 + hh * 0.95)}Q${f1(x)} ${f1(y0 + hh * 1.06)} ${f1(x - bw * 0.78)} ${f1(y0 + hh * 0.95)}C${f1(x - bw * 0.55)} ${f1(y0 + hh * 0.78)} ${f1(x - bw * 0.5)} ${f1(y0 + hh * 0.5)} ${f1(x - bw * 0.42)} ${f1(y0 + hh * 0.06)}Z`
    const gr = s('g', { class: 't24c-bell' },
      s('defs', null, s('linearGradient', { id: 't24c-bronzeg', x1: 0, y1: 0, x2: 1, y2: 0.2 }, s('stop', { offset: 0, class: 't24c-br0' }), s('stop', { offset: 0.45, class: 't24c-br1' }), s('stop', { offset: 1, class: 't24c-br2' }))),
      s('circle', { class: 't24c-bellglow', cx: f1(x), cy: f1(y0 + hh * 0.6), r: f1(bw * 2.6), fill: 'url(#p2-lamp)' }),
      s('path', { class: 't24c-rope', d: stroke([top, [t2[0], t2[1] + 1]], Math.max(1.4, bw * 0.06), 0.05, 0.05, 0.8) }),
      s('path', { class: 't24c-bronze', d, fill: 'url(#t24c-bronzeg)' }),
      s('path', { class: 't24c-bell-ink', d: stroke([[x - bw * 0.78, y0 + hh * 0.95], [x, y0 + hh * 1.02], [x + bw * 0.78, y0 + hh * 0.95]], Math.max(1.6, bw * 0.06), 0.1, 0.1, 0.4) + stroke([[x - bw * 0.5, y0 + hh * 0.55], [x + bw * 0.5, y0 + hh * 0.55]], 1.2, 0.2, 0.2, 0.4) }),
      s('path', { class: 't24c-bell-hi', d: stroke(curve([x + bw * 0.22, y0 + hh * 0.12], [x + bw * 0.36, y0 + hh * 0.5], [x + bw * 0.5, y0 + hh * 0.86], 6), Math.max(1.4, bw * 0.06), 0.3, 0.3, 0.1) }),
      s('path', { class: 't24c-clapper', d: stroke([[x, y0 + hh * 0.98], [x, y0 + hh * 1.16]], Math.max(1.2, bw * 0.05), 0.05, 0.05, 0.6) }))
    gr.style.transformOrigin = `${f1(top[0])}px ${f1(top[1])}px`
    return gr
  }

  /** A clipped azalea mound: overlapping rounded clumps, each dark below and lit on the moon's side, leaf-tips at the edge. */
  function shrubArt(w: number, hh: number, seed: number) {
    const r = rng(seed)
    const side = G.mx * cam.ca - G.mz * cam.sa > 0 ? 1 : -1
    let base = '', lit = '', leaves = ''
    const clumps: [number, number, number][] = []
    for (let i = 0; i < 7; i++) {
      const t = i / 6, x = (t - 0.5) * w * 0.72 + (r() - 0.5) * w * 0.06
      const y = -hh * (0.32 + Math.sin(t * Math.PI) * 0.3 + r() * 0.06), rr = w * (0.16 + r() * 0.05)
      clumps.push([x, y, rr])
    }
    clumps.push([0, -hh * 0.72, w * 0.2])
    clumps.sort((a, b) => b[1] - a[1])
    for (const [x, y, rr] of clumps) {
      base += blob2(x, y, rr, rr * 0.82)
      lit += blob2(x + side * rr * 0.28, y - rr * 0.3, rr * 0.55, rr * 0.4)
      for (let k = 0; k < 5; k++) {
        const a = Math.PI * (1.1 + r() * 0.8)
        const lx = x + Math.cos(a) * rr * 0.9, ly = y + Math.sin(a) * rr * 0.74
        leaves += stroke([[lx, ly], [lx + Math.cos(a) * rr * 0.28, ly + Math.sin(a) * rr * 0.22]], Math.max(1, rr * 0.09), 0.2, 0.5, 0.2)
      }
    }
    return s('g', { class: 't24c-shrubg' },
      s('ellipse', { class: 't24c-shrub-sh', cx: f1(-side * w * 0.1), cy: f1(hh * 0.02), rx: f1(w * 0.56), ry: f1(Math.max(2, hh * 0.14)) }),
      s('path', { class: 't24c-shrub', d: base, filter: 'url(#ink-rough)' }),
      s('path', { class: 't24c-shrub-lit', d: lit }),
      s('path', { class: 't24c-shrub-leaf', d: leaves }))
  }
  const blob2 = (x: number, y: number, rx: number, ry: number) => `M${f1(x - rx)} ${f1(y)}a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(rx * 2)} 0a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(-rx * 2)} 0Z`

  /** The ema's cord, from the rack's bar down into the hole at its top (the ema itself is HTML, clipped to its pentagon). */
  function drawNear() {
    const [ax, ay, bx, by] = G.emaC
    nearSvg.replaceChildren(s('path', { class: 't24c-emacord', d: `M${f1(ax - 5)} ${f1(ay)}L${f1(bx)} ${f1(by)}L${f1(ax + 5)} ${f1(ay)}` }))
  }

  /** Hang the words on their things: the plaque on the bell gate's tie, the ema on the entry's crossbar, notes on the fences. */
  function place() {
    const { W, H, cols, rows, mid, wide } = G
    const keep: number[][] = []
    // each hangs with its top at (x, y) on a cord tied at (ax, ay)
    const hang = (el: HTMLElement, x: number, y: number, ax: number, ay: number) => {
      el.style.left = `${f1(x)}px`
      el.style.top = `${f1(y)}px`
      el.style.setProperty('--cl', `${f1(Math.hypot(ax - x, ay - y))}px`)
      el.style.setProperty('--ca', `${Math.atan2(ax - x, y - ay).toFixed(3)}rad`)
    }
    const at = (el: HTMLElement, x: number, y: number, w?: number) => Object.assign(el.style, { left: `${f1(x)}px`, top: `${f1(y)}px`, width: w ? `${f1(w)}px` : '' })
    // the gate's name board between its two beams says what the grader says; the AI's claim beside it, in the sky
    const [bx, by] = pt(mid + 0.5, (GH + NK + 0.065) / 2, 0.03)
    const kb = scale(P(mid + 0.5, GH, 0))
    Object.assign(plaque.style, { left: `${f1(bx)}px`, top: `${f1(by)}px`, width: `${f1(kb * 0.62)}px`, height: `${f1(kb * (GH - NK - 0.08))}px`, fontSize: `${f1(clamp(kb * 0.2, 12, 17))}px` })
    const [gx, gy] = pt(mid + 1.4, GH + 0.05, 0)
    Object.assign(claim.style, wide ? { left: `${f1(gx + 14)}px`, top: `${f1(gy - 4)}px`, right: '' } : { left: '', right: '12px', top: `${f1(H * 0.035)}px` })
    if (wide) keep.push([gx, gy - 10, gx + 250, gy + 30])
    // the task's ema on its rack on the moss, left of the entry
    RACK = wide ? [mid - 2.9, rows + 1.6] : [mid + 0.85, rows + 1.45]
    const [ex, ey] = pt(RACK[0], wide ? 2.3 : 2.2, RACK[1] - 0.04)
    const ew = wide ? 184 : 132
    task.style.setProperty('--w', `${ew}px`)
    const tx0 = clamp(ex, ew / 2 + 8, W - ew / 2 - 8)
    hang(task, tx0, ey + 22, ex, ey)
    G.emaC = [ex, ey + 1, tx0, ey + 29]
    const rg = pt(RACK[0], 0, RACK[1])
    keep.push([tx0 - ew / 2 - 40, ey - 10, tx0 + ew / 2 + 40, Math.max(ey + 175, rg[1] + 12)])
    const near = pt(0, 0, rows), farR = pt(cols, 0, 0)
    if (wide) {
      // what the light found, written on the moss left of the bed; the long way's sign staked by the entry; the checks on the right
      const rw = 230
      at(reveal, Math.max(14, near[0] - rw - 20), near[1] - 150, rw)
      keep.push([near[0] - rw - 30, near[1] - 160, near[0], near[1] - 60])
      const [lx, ly] = pt(mid + 1.7, 0, rows + 1.45)
      at(longTag, lx, ly)
      keep.push([lx - 130, ly - 80, lx + 130, ly + 6])
      at(slip, Math.min(W - 270, farR[0] + 30), farR[1] - 24)
      keep.push([farR[0] + 20, farR[1] - 40, farR[0] + 300, farR[1] + 30])
      // the insight's corner (bottom right) stays clear of rocks and shrubs
      keep.push([W * 0.6, H * 0.7, W, H])
    } else {
      // a phone: the task's ema and the count at the bottom; once found, the sign and the checks
      // (the note takes the claim's place at the top once found: the ema keeps its rack)
      Object.assign(reveal.style, { left: '', right: '12px', top: `${f1(H * 0.035)}px`, width: `${f1(Math.min(220, W * 0.6))}px` })
      at(longTag, W * 0.74, H * 0.9)
      at(slip, 8, H - 58)
      keep.push([0, H * 0.74, W, H])
    }
    G.keep = keep
    // the lantern's size at its depth
    const zc = P(mid + 0.5, 0, rows / 2)
    G.k = scale(zc)
    G.pr = Math.max(9, G.k * 0.13)
    const lw = G.pr * 6, lh = G.pr * 5.2
    Object.assign(lamp.style, { width: `${f1(lw)}px`, height: `${f1(lh)}px`, marginLeft: `${f1(-lw / 2)}px`, marginTop: `${f1(-lh * 0.46)}px` })
    lampSvg.setAttribute('viewBox', `${f1(-lw / 2)} ${f1(-lh * 0.46)} ${f1(lw)} ${f1(lh)}`)
    lampSvg.replaceChildren(
      s('path', { class: 't24c-handle', d: stroke([[-G.pr * 2.6, -G.pr * 2.25], [G.pr * 0.6, -G.pr * 2.05]], Math.max(2.4, G.pr * 0.2), 0.05, 0.1, 0.6), filter: 'url(#ink-rough)' }),
      paperLantern(0, -G.pr * 2.1, G.pr, 2477, G.pr * 0.55))
    const hole = G.k * 1.6
    Object.assign(dark.style, { width: `${f1(W * 2)}px`, height: `${f1(H * 2)}px` })
    dark.style.setProperty('--r', `${f1(hole)}px`)
    Object.assign(pool.style, { width: `${f1(hole * 2.4)}px`, height: `${f1(hole * 1.5)}px`, marginLeft: `${f1(-hole * 1.2)}px`, marginTop: `${f1(-hole * 0.75)}px` })
    night.style.setProperty('--sky', `${f1(pt(cam.cx, 0, -1.2)[1])}px`)
    longTag.style.setProperty('--st', `${f1(G.k * 0.45)}px`)
    if (!count && !found) count = g.count(K.count, 100, () => (G.wide ? [G.W * 0.5, G.H - 18] : [G.W * 0.74, G.H * 0.95]), { n: 0 })
    g.refresh()
  }

  // ── the lantern: a warm pool where it is carried; the night lifts only there, the fences' shadows fan out from it
  const sp: Pt = [0, 0]
  /** where the top of a fence over plan point (x, z) throws its shadow from the lantern (capped: a long throw fades out anyway), into sp */
  function throw1(x: number, z: number) {
    const dx = x - G.lu, dz = z - G.lv, l = Math.hypot(dx, dz) || 1
    const k = Math.min((l * FH) / (LH - FH), 1.1) / l
    P(x + dx * k, 0, z + dz * k, sp)
  }
  function moveLamp(u: number, v: number) {
    const { cols, rows } = G
    G.lu = clamp(u, -0.7, cols + 0.7)
    G.lv = clamp(v, -0.3, rows + 1.2)
    P(G.lu, 0, G.lv, sp)
    dark.style.transform = `translate(${f1(sp[0] - G.W)}px, ${f1(sp[1] - G.H)}px)`
    pool.style.transform = `translate(${f1(sp[0])}px, ${f1(sp[1])}px)`
    const zc = P(G.lu, 0.62, G.lv, sp) // the lantern hangs low from its handle; its light is figured from a little higher
    lamp.style.transform = `translate(${f1(sp[0])}px, ${f1(sp[1])}px) scale(${(scale(zc) / G.k).toFixed(3)})`
    // shadows: each fence top seen from the lantern falls outward on the gravel
    let d = ''
    for (const [x0, z0, x1, z1] of runs) {
      const mx = clamp(G.lu, Math.min(x0, x1), Math.max(x0, x1)), mz = clamp(G.lv, Math.min(z0, z1), Math.max(z0, z1))
      if (Math.hypot(mx - G.lu, mz - G.lv) > 2.2) continue
      P(x0, 0, z0, sp)
      d += `M${f1(sp[0])} ${f1(sp[1])}`
      P(x1, 0, z1, sp)
      d += `L${f1(sp[0])} ${f1(sp[1])}`
      throw1(x1, z1)
      d += `L${f1(sp[0])} ${f1(sp[1])}`
      throw1(x0, z0)
      d += `L${f1(sp[0])} ${f1(sp[1])}Z`
    }
    lampSh.setAttribute('d', d)
    if (found) return
    // the footprints the light reaches are seen (and stay so)
    let more = false
    for (const p of prints) if (!p.seen && Math.hypot(p.x - G.lu, p.z - G.lv) < REACH) (p.seen = true), p.el.classList.add('seen'), (more = true)
    if (more) progress()
  }
  let shown = 0
  const pct = () => (prints.length ? Math.round((prints.filter((p) => p.seen).length / prints.length) * 100) : 0)
  let stage2 = false
  function progress() {
    const n = pct()
    if (n !== shown) (shown = n), count?.set(n)
    lamp.setAttribute('aria-valuenow', String(n))
    lamp.setAttribute('aria-valuetext', fill(K.lampValue, { n }))
    if (n >= 30 && !stage2) (stage2 = true), ctx.prompt(K.prompt2)
    if (n >= FOUND) discover()
  }

  // pointer: carry the light (drag anywhere on the garden, or just move the mouse over it)
  let rect: DOMRect | null = null
  let dragging = -1
  const here = (e: PointerEvent) => {
    rect ??= host.getBoundingClientRect()
    const [u, v] = U(e.clientX - rect.left, e.clientY - rect.top)
    if (!walking) moveLamp(u, v)
  }
  host.addEventListener('pointerenter', () => void (rect = host.getBoundingClientRect()))
  host.addEventListener('pointerdown', (e) => {
    if ((e.target as Element).closest('button')) return
    rect = host.getBoundingClientRect()
    dragging = e.pointerId
    host.setPointerCapture(e.pointerId)
    lamp.classList.add('held')
    here(e)
  })
  host.addEventListener('pointermove', (e) => (e.pointerId === dragging || e.pointerType === 'mouse') && here(e))
  const up = (e: PointerEvent) => {
    if (e.pointerId !== dragging) return
    dragging = -1
    lamp.classList.remove('held')
  }
  host.addEventListener('pointerup', up)
  host.addEventListener('pointercancel', up)
  // keys: step the light along the footprints, bell → gate
  let ki = 0
  lamp.addEventListener('keydown', (e) => {
    const d = { ArrowDown: 1, ArrowRight: 1, PageDown: 3, ArrowUp: -1, ArrowLeft: -1, PageUp: -3 }[e.key]
    if (d) ki = clamp(ki + d * 2, 0, prints.length - 1)
    else if (e.key === 'Home') ki = 0
    else if (e.key === 'End') ki = prints.length - 1
    else return
    e.preventDefault()
    moveLamp(prints[ki].x, prints[ki].z)
  })
  // idle: the next footprint not yet seen lights up, and the lantern leans toward it
  invite(ctx, () => {
    if (found) return
    const p = prints.find((q) => !q.seen)
    if (!p) return
    p.el.classList.remove('beckon')
    void p.el.getBoundingClientRect()
    p.el.classList.add('beckon')
    const a = pt(G.lu, 0, G.lv), b = pt(p.x, 0, p.z), l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    nudge(ctx, lamp, ((b[0] - a[0]) / l) * 10, ((b[1] - a[1]) / l) * 10)
  })

  // the long way, run by itself once the trick is seen: a light walks the true lanes and rakes them, then the bell rings
  let walking = false, t = 0
  const loop = createLoop(host, (_t, dt) => {
    t = Math.min(1, t + dt / 6)
    for (const p of rakeMain) p.style.strokeDashoffset = (1 - t).toFixed(4)
    if (t >= 1) {
      walking = false
      arrived()
      return false
    }
    return true
  }, { essential: true })
  ctx.onCleanup(() => loop.dispose())
  function arrived() {
    root.classList.add('raked')
    ringBell()
    root.classList.add('handed')
  }

  function ringBell() {
    if (!bell) return
    root.classList.remove('ring')
    void root.offsetWidth
    root.classList.add('ring')
    ctx.chime('ok')
  }

  /** The trick is seen: the holes, the unraked lanes, the mist lifting; the note on the fence; then the long way for comparison. */
  function discover() {
    if (found) return
    found = true
    root.classList.add('found')
    dot?.done()
    dot = null
    ;(reveal.lastChild as HTMLElement).textContent = K.reveal
    count?.done()
    count = null
    ctx.chime('soft')
    ctx.insight(K.insight, K.detail)
    const go = () => {
      root.classList.add('long')
      if (still) {
        t = 1
        for (const p of rakeMain) p.style.strokeDashoffset = '0'
        arrived()
      } else {
        walking = true
        loop.start()
      }
    }
    if (still) go()
    else {
      const tm = setTimeout(go, 1800)
      ctx.onCleanup(() => clearTimeout(tm))
    }
  }

  // on entering: the bell rings by itself — the grader already says "pass"
  if (!still) {
    const tm = setTimeout(ringBell, 900)
    ctx.onCleanup(() => clearTimeout(tm))
  }
}
