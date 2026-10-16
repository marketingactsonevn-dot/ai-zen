import { h, s } from '../../core/dom'
import { L } from '../../core/content'
import type { SceneCtx } from '../types'
import { createLoop } from '../../core/loop'
import { findTakeaway, takeaway } from '../../ui/part2/takeaway'
import { C } from './data'
import { alive, f1, stage } from './kit'
import { blob, clamp, curve, rng, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist, moon } from '../../ui/part2/paint'
import { P as poly } from './brush'

const K = C.scenes.shortcut
const TILT = 47 // the ground plane, degrees from the screen (camera high, about 50° down)
const N = 1, E = 2, S = 4, Wb = 8 // open sides of a cell
const STEP: [number, number, number, number][] = [[0, -1, N, S], [1, 0, E, Wb], [0, 1, S, N], [-1, 0, Wb, E]]

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

/**
 * Scene 3 — a karesansui maze seen from high above, in true CSS 3D: lanes of white gravel between tall bamboo fences, the
 * dead-end lanes raked along their turns, the way through scuffed and unraked; an entry gate below, a gate with a bronze
 * bell at the far end, moss and rocks all round. Clouds hide the moon; the only light is the viewer's lantern, a warm pool
 * that throws the fences' shadows outward as it moves. The bell has already rung ("tests pass"). Searching shows how:
 * footprints cut straight up through broken fences. The long way rakes every lane of the true path before it rings.
 */
export function shortcutScene(ctx: SceneCtx) {
  const lit0 = ctx.quality === 'low' // low: lit from the start, the bell has already rung
  let found = false
  let walking = -1
  const card = findTakeaway(K.takeaway)

  const { root } = stage(ctx, 't24c', K.art, [K.insight], draw)
  root.classList.toggle('lit', lit0)
  const host = h('div', { class: 't24c-host' })
  const skySvg = s('svg', { class: 't24-svg t24c-sky', 'aria-hidden': 'true' })
  const clouds = s('svg', { class: 't24-svg t24c-cloudart', 'aria-hidden': 'true' })
  const plane = h('div', { class: 't24c-plane' })
  const groundSvg = s('svg', { class: 't24c-ground', 'aria-hidden': 'true' })
  const floorSvg = s('svg', { class: 't24c-floor', 'aria-hidden': 'true' })
  const shadowSvg = s('svg', { class: 't24c-shadows', 'aria-hidden': 'true' })
  const shadowPath = s('path', { class: 't24c-fshadow' })
  shadowSvg.append(shadowPath)
  const pool = h('div', { class: 't24c-pool' })
  const dark = h('div', { class: 't24c-dark' }) // screen-space: the night with one warm hole in it
  const lantern = h('div', { class: 't24c-lantern', 'aria-hidden': 'true' }, h('i'))
  const gate = h('div', { class: 't24c-gate' })
  const gateSvg = s('svg', { class: 't24c-gateart', 'aria-hidden': 'true' })
  const bellG = s('g', { class: 't24c-bell' })
  const entry = h('div', { class: 't24c-entry' })
  const entrySvg = s('svg', { class: 't24c-gateart', 'aria-hidden': 'true' })
  entry.append(entrySvg)
  gate.append(gateSvg)
  // things hung in the scene (screen space, at their projected cords): the bell's plaque, the result strip, the ema
  const plaque = h('p', { class: 't24c-plaque' }, h('i', { class: 't24c-cord', 'aria-hidden': 'true' }), h('span', null, K.bell))
  const reveal = h('p', { class: 't24c-reveal t24-paper', 'aria-live': 'polite' }, h('i', { class: 't24c-cord', 'aria-hidden': 'true' }), h('span'))
  const tag = card ? h('button', { class: 't24c-ema small', type: 'button', onClick: openCard }, h('i', { class: 't24c-cord', 'aria-hidden': 'true' }), h('span', null, card.title)) : null
  const task = h('p', { class: 't24c-ema task' }, h('i', { class: 't24c-cord', 'aria-hidden': 'true' }), h('span', null, K.task))
  const bough = s('svg', { class: 't24-svg t24c-bough', 'aria-hidden': 'true' })
  const stones = K.paths.map((p, i) => h('button', { class: `t24c-stone s${i}`, type: 'button', 'aria-label': p.aria, 'aria-pressed': 'false', onClick: () => walk(i) },
    s('svg', { viewBox: '-60 -46 120 52', preserveAspectRatio: 'none', 'aria-hidden': 'true' }, stoneArt(116, 42, 2460 + i)), h('span', null, p.stone)))
  plane.append(groundSvg, floorSvg, shadowSvg, pool, gate, entry)
  // the clouds and the moon behind them stay above the night: the dark is the garden's, the sky still glows
  host.append(skySvg, plane, dark, clouds, lantern, bough, task, plaque, ...stones, reveal, ...(tag ? [tag] : []))
  const sheet = h('div', { class: 't24c-sheet', hidden: true })
  root.append(host, sheet)
  ctx.prompt(K.prompt)
  alive(ctx, root)

  // plan geometry (px on the plane): x across, y from the far edge (bell gate) toward the viewer; cs = one cell
  const G = { W: 0, H: 0, FW: 0, FD: 0, cs: 0, fh: 0, cols: 7, rows: 6, R: 0, wide: true, left: 0, top: 0, Hinv: [0, 0, 0, 0, 0, 0, 0, 0, 0], lu: 0, lv: 0 }
  let gaps: Pt[] = [] // where the shortcut broke through
  let long: Pt[] = [], short: Pt[] = []
  let runs: [number, number, number, number][] = [] // fences as x0 y0 x1 y1 on the plane
  let rakeMain: SVGPathElement[] = []
  let mainFrom = 0, mainLen = 1

  function* draw(W: number, H: number) {
    const wide = W / H >= 1.05
    const cols = wide ? 9 : 5, rows = wide ? 6 : 7
    const cs = wide ? Math.min((H * 0.64) / rows, (W * 0.44) / cols) : Math.min((W * 0.8) / cols, (H * 0.66) / rows)
    const FW = cs * cols, FD = cs * rows
    const P = Math.round(H * 1.6)
    const near = H * (wide ? 0.8 : 0.82) // the maze's near edge on screen
    Object.assign(G, { W, H, FW, FD, cs, fh: cs * 0.5, cols, rows, R: cs * 2.3, wide, left: (W - FW) / 2, top: near - FD })
    host.style.perspective = `${P}px`
    host.style.perspectiveOrigin = `50% ${f1(H * 0.14)}px`
    Object.assign(plane.style, { left: `${f1(G.left)}px`, top: `${f1(G.top)}px`, width: `${f1(FW)}px`, height: `${f1(FD)}px`, transform: `rotateX(${TILT}deg)` })
    G.Hinv = homography(W, H, P)
    dark.style.width = `${f1(W * 2)}px`
    dark.style.height = `${f1(H * 2)}px`
    dark.style.setProperty('--rx', `${f1(G.R * 1.3)}px`)
    dark.style.setProperty('--ry', `${f1(G.R * 1.0)}px`)
    // the maze: the seed that makes the true way longest and leaves walls up the middle for the shortcut to break
    const mid = Math.floor(cols / 2)
    let best = { open: new Uint8Array(0), sol: [] as number[], score: -1 }
    for (let k = 0; k < 14; k++) {
      const open = carve(cols, rows, 2460 + k)
      const sol = solve(open, cols, mid + (rows - 1) * cols, mid)
      let walls = 0
      for (let r = 1; r < rows; r++) if (!(open[mid + r * cols] & N)) walls++
      const score = sol.length + walls * 3
      if (score > best.score) best = { open, sol, score }
    }
    drawSky(W, H)
    yield
    drawGround()
    yield
    drawMaze(best.open, best.sol)
    yield
    drawFences(best.open)
    yield
    drawGates()
    placeThings()
    if (!G.lu) moveLamp(FW / 2, FD + cs * 0.2)
    else moveLamp(G.lu, G.lv)
  }

  /** Build the plane's transform as a matrix and keep its inverse homography: screen px → plan px. */
  function homography(W: number, H: number, P: number) {
    const ox = W / 2, oy = H * 0.14
    const m = new DOMMatrix().translate(ox, oy).multiply(new DOMMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, -1 / P, 0, 0, 0, 1])).translate(-ox, -oy)
      .translate(G.left + G.FW / 2, G.top + G.FD / 2).rotate(TILT, 0, 0).translate(-G.FW / 2, -G.FD / 2)
    projM = m
    const a = [m.m11, m.m21, m.m41, m.m12, m.m22, m.m42, m.m14, m.m24, m.m44]
    const [A, B, Cc, D, Ee, F, Gg, Hh, I] = a
    const det = A * (Ee * I - F * Hh) - B * (D * I - F * Gg) + Cc * (D * Hh - Ee * Gg)
    return [(Ee * I - F * Hh) / det, (Cc * Hh - B * I) / det, (B * F - Cc * Ee) / det, (F * Gg - D * I) / det, (A * I - Cc * Gg) / det, (Cc * D - A * F) / det, (D * Hh - Ee * Gg) / det, (B * Gg - A * Hh) / det, (A * Ee - B * D) / det]
  }
  let projM = new DOMMatrix()
  const out: Pt = [0, 0]
  /** plan px → screen px (no allocation: fills and returns one shared pair) */
  const project = (u: number, v: number): Pt => {
    const m = projM, w = m.m14 * u + m.m24 * v + m.m44
    out[0] = (m.m11 * u + m.m21 * v + m.m41) / w
    out[1] = (m.m12 * u + m.m22 * v + m.m42) / w
    return out
  }
  const unproject = (x: number, y: number): Pt => {
    const m = G.Hinv
    const k = m[6] * x + m[7] * y + m[8]
    return [(m[0] * x + m[1] * y + m[2]) / k, (m[3] * x + m[4] * y + m[5]) / k]
  }

  /** The sky beyond the garden: ranges in mist, the moon behind banks of cloud lit at their edges (they drift off once the trick is found). */
  function drawSky(W: number, H: number) {
    skySvg.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    clouds.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    const farY = project(G.FW / 2, -G.FD * 0.36)[1]
    const mx = W * (G.wide ? 0.76 : 0.74), my = Math.max(H * 0.08, farY - H * 0.15), mr = Math.min(W, H) * (G.wide ? 0.05 : 0.07)
    skySvg.replaceChildren(
      mist(W * 0.5, farY - H * 0.04, W * 0.8, H * 0.1),
      hills(-W * 0.1, W * 1.1, farY + 4, H * 0.1, 2462, 0.85, G.wide ? 6 : 4),
      hills(-W * 0.1, W * 0.45, farY + 6, H * 0.06, 2463, 0.45, 2),
      hills(W * 0.6, W * 1.1, farY + 6, H * 0.05, 2464, 0.5, 2),
      mist(W * 0.5, farY + 4, W * 0.7, H * 0.03))
    // cloud banks: soft masses over the moon, their upper edges silvered by it
    const bank = (x: number, y: number, w: number, seed: number) => {
      const r = rng(seed)
      let d = '', rim = ''
      for (let i = 0; i < 6; i++) {
        const cx = x - w * 0.5 + (w * i) / 5 + (r() - 0.5) * w * 0.08, cy = y - Math.sin((i / 5) * Math.PI) * w * 0.08
        const rx = w * (0.13 + r() * 0.07), ry = rx * (0.5 + r() * 0.2)
        d += blob(cx, cy, rx, ry, seed + i, 0.2, 16)
        rim += stroke(curve([cx - rx * 0.8, cy - ry * 0.3], [cx, cy - ry * 1.15], [cx + rx * 0.8, cy - ry * 0.4], 10), Math.max(1.4, ry * 0.08), 0.3, 0.3, 0.1)
      }
      d += blob(x, y + w * 0.04, w * 0.55, w * 0.06, seed + 9, 0.15, 18)
      return [s('path', { class: 't24c-cloud', d, filter: 'url(#ink-wash)' }), s('path', { class: 't24c-cloud-rim', d: rim })]
    }
    clouds.replaceChildren(
      s('circle', { class: 't24c-moonglow', cx: f1(mx), cy: f1(my), r: f1(mr * 7), fill: 'url(#p2-halo)' }),
      moon(mx, my, mr, 2461, false),
      s('g', { class: 't24c-bank a' }, ...bank(mx + mr * 0.6, my + mr * 0.5, mr * 9, 2465)),
      s('g', { class: 't24c-bank b' }, ...bank(mx - mr * 4.5, my - mr * 1.6, mr * 6, 2467)),
      s('g', { class: 't24c-bank c' }, ...bank(W * 0.22, my + mr * 2.2, mr * 7, 2469)))
  }

  /** The ground all round the gravel bed: dark moss, a stone curb, rocks and clipped shrubs standing on it, a path in. */
  function drawGround() {
    const { FW, FD, cs } = G
    const x0 = -FW * 1.4, y0 = -FD * 0.42, gw = FW * 3.8, gd = FD * 1.9
    Object.assign(groundSvg.style, { left: `${f1(x0)}px`, top: `${f1(y0)}px`, width: `${f1(gw)}px`, height: `${f1(gd)}px` })
    groundSvg.setAttribute('viewBox', `${f1(x0)} ${f1(y0)} ${f1(gw)} ${f1(gd)}`)
    const r = rng(2471)
    let moss = '', specks = '', curb = '', path = ''
    for (let i = 0; i < 70; i++) moss += blob(x0 + r() * gw, y0 + r() * gd, cs * (0.8 + r() * 2.4), cs * (0.5 + r() * 1.2), 2472 + i, 0.3, 14)
    for (let i = 0; i < 500; i++) {
      const x = x0 + r() * gw, y = y0 + r() * gd
      if (x > -cs * 0.3 && x < FW + cs * 0.3 && y > -cs * 0.3 && y < FD + cs * 0.3) continue
      specks += `M${f1(x)} ${f1(y)}h${f1(1.5 + r() * 2.5)}`
    }
    // a curb of small stones round the bed
    const per: Pt[] = [[-cs * 0.18, -cs * 0.18], [FW + cs * 0.18, -cs * 0.18], [FW + cs * 0.18, FD + cs * 0.18], [-cs * 0.18, FD + cs * 0.18]]
    for (let k = 0; k < 4; k++) {
      const [ax, ay] = per[k], [bx, by] = per[(k + 1) % 4]
      const n = Math.round(Math.hypot(bx - ax, by - ay) / (cs * 0.32))
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n
        curb += blob(ax + (bx - ax) * t, ay + (by - ay) * t, cs * (0.14 + r() * 0.05), cs * (0.11 + r() * 0.04), 2480 + k * 50 + i, 0.2, 10)
      }
    }
    // stepping stones from the bottom of the frame to the entry gate
    for (let i = 0; i < 5; i++) path += blob(FW / 2 + (r() - 0.5) * cs * 0.5, FD + cs * (0.8 + i * 0.75), cs * (0.32 + r() * 0.08), cs * 0.24, 2490 + i, 0.15, 12)
    groundSvg.replaceChildren(
      s('rect', { class: 't24c-moss0', x: f1(x0), y: f1(y0), width: f1(gw), height: f1(gd) }),
      s('path', { class: 't24c-moss1', d: moss, filter: 'url(#ink-wash)' }),
      s('path', { class: 't24c-specks', d: specks }),
      s('path', { class: 't24c-curb-sh', d: curb, transform: `translate(${f1(cs * 0.04)} ${f1(cs * 0.05)})` }),
      s('path', { class: 't24c-curb', d: curb, filter: 'url(#ink-rough)' }),
      s('path', { class: 't24c-steps-in', d: path, filter: 'url(#ink-rough)' }))
    // rocks and clipped shrubs stand round the bed (billboards leaning back to face the camera)
    plane.querySelectorAll('.t24c-prop').forEach((e) => e.remove())
    // in cells: x, y (from the far edge), width, height, shrub or stone
    const { cols, rows } = G
    const props: [number, number, number, number, boolean][] = [
      [-1.3, 1.2, 1.5, 0.9, false], [-0.9, rows * 0.55, 1.2, 0.75, true], [-1.6, rows - 0.6, 1.3, 0.8, true], [-0.8, rows + 0.7, 1.1, 0.6, false], [-2.4, rows * 0.3, 1.4, 0.8, true],
      [cols + 1.1, 0.9, 1.4, 0.85, true], [cols + 0.9, rows * 0.6, 1.1, 0.65, false], [cols + 1.6, rows - 0.4, 1.3, 0.8, true], [cols + 0.8, rows + 0.8, 1.0, 0.55, false], [cols + 2.4, rows * 0.35, 1.5, 0.8, false],
    ]
    for (const [px, py, pw, ph, shrub] of props) {
      const w = cs * pw, hh = cs * ph
      const el = h('div', { class: `t24c-prop${shrub ? ' shrub' : ''}` }, s('svg', { viewBox: `${f1(-w / 2)} ${f1(-hh)} ${f1(w)} ${f1(hh * 1.1)}`, 'aria-hidden': 'true' }, shrub ? shrubArt(w, hh, 2510 + Math.round(px * 10 + py)) : stoneArt(w, hh, 2500 + Math.round(px * 10 + py * 3))))
      Object.assign(el.style, { left: `${f1(px * cs - w / 2)}px`, top: `${f1(py * cs - hh)}px`, width: `${f1(w)}px`, height: `${f1(hh)}px` })
      plane.insertBefore(el, pool)
    }
  }

  /** A clipped azalea mound: a dark rounded mass, lit clumps on top, a contact shadow (w × h, standing on y = 0). */
  function shrubArt(w: number, hh: number, seed: number) {
    const r = rng(seed)
    let lit = ''
    for (let i = 0; i < 5; i++) lit += blob(-w * 0.3 + i * w * 0.15 + (r() - 0.5) * w * 0.05, -hh * (0.62 + Math.sin((i / 4) * Math.PI) * 0.2), w * 0.16, hh * 0.14, seed + i, 0.3, 12)
    return s('g', null,
      s('ellipse', { class: 't24c-shrub-sh', cx: f1(w * 0.06), cy: 0, rx: f1(w * 0.52), ry: f1(hh * 0.12) }),
      s('path', { class: 't24c-shrub', d: blob(0, -hh * 0.45, w * 0.48, hh * 0.46, seed, 0.12, 18), filter: 'url(#ink-rough)' }),
      s('path', { class: 't24c-shrub-lit', d: lit, filter: 'url(#ink-wash)' }))
  }

  /** Smooth a lane's centre line: straight runs, a quarter turn of radius cs/2 at every corner (dense points). */
  function smooth(pts: Pt[], rad: number): Pt[] {
    const outP: Pt[] = [pts[0]]
    for (let i = 1; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], [cx, cy] = pts[i + 1]
      const d1 = Math.hypot(bx - ax, by - ay) || 1, d2 = Math.hypot(cx - bx, cy - by) || 1
      const p: Pt = [bx - ((bx - ax) / d1) * rad, by - ((by - ay) / d1) * rad], q: Pt = [bx + ((cx - bx) / d2) * rad, by + ((cy - by) / d2) * rad]
      outP.push(...curve(p, [bx, by], q, 6))
    }
    outP.push(pts[pts.length - 1])
    // resample every few px so offsets stay smooth
    const dense: Pt[] = [outP[0]]
    for (let i = 1; i < outP.length; i++) {
      const [ax, ay] = outP[i - 1], [bx, by] = outP[i]
      const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / 4))
      for (let k = 1; k <= n; k++) dense.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n])
    }
    return dense
  }
  const offsetD = (pts: Pt[], o: number) => {
    let d = ''
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
      d += `${i ? 'L' : 'M'}${f1(p[0] - ((b[1] - a[1]) / l) * o)} ${f1(p[1] + ((b[0] - a[0]) / l) * o)}`
    })
    return d
  }

  /**
   * The gravel bed: grain everywhere; the dead-end lanes raked along their own turns; the true way scuffed and unraked (its
   * rake lines wait, hidden, for the long walk to lay them); footprints straight up the middle through the broken fences.
   */
  function drawMaze(open: Uint8Array, sol: number[]) {
    const { FW, FD, cs, cols, rows } = G
    floorSvg.setAttribute('viewBox', `0 0 ${f1(FW)} ${f1(FD)}`)
    shadowSvg.setAttribute('viewBox', `0 0 ${f1(FW)} ${f1(FD)}`)
    const r = rng(2466)
    const at = (i: number): Pt => [((i % cols) + 0.5) * cs, (((i / cols) | 0) + 0.5) * cs]
    const mid = Math.floor(cols / 2)
    // lanes as chains: the true way first (entry → exit), then every branch off it, depth first
    const next = new Map(sol.map((v, i) => [v, sol[i + 1]]))
    const seen = new Uint8Array(open.length)
    const chains: number[][] = []
    const todo: [number, number | null][] = [[sol[0], null]]
    while (todo.length) {
      const [start, from] = todo.pop()!
      const chain = from == null ? [start] : [from, start]
      seen[start] = 1
      let cur = start
      for (;;) {
        if (from == null && cur === sol[sol.length - 1]) {
          for (const [dx, dy, bit] of STEP) if (open[cur] & bit && !seen[cur + dx + dy * cols]) todo.push([cur + dx + dy * cols, cur])
          break
        }
        const nb: number[] = []
        for (const [dx, dy, bit] of STEP) if (open[cur] & bit && !seen[cur + dx + dy * cols]) nb.push(cur + dx + dy * cols)
        if (!nb.length) break
        const pref = next.get(cur)
        nb.sort((a, b) => (b === pref ? 1 : 0) - (a === pref ? 1 : 0))
        for (const j of nb.slice(1)) todo.push([j, cur])
        cur = nb[0]
        seen[cur] = 1
        chain.push(cur)
      }
      chains.push(chain)
    }
    const offs = [-0.3, -0.15, 0, 0.15, 0.3].map((k) => k * cs)
    let rakes = '', scuff = '', grain = '', steps = ''
    rakeMain = []
    chains.forEach((ch, k) => {
      const pts = ch.map(at)
      if (k === 0) {
        // the true way: from below the entry to above the exit
        pts.unshift([pts[0][0], FD + cs * 0.4])
        pts.push([pts[pts.length - 1][0], -cs * 0.4])
        const dense = smooth(pts, cs * 0.5)
        long = [[FW / 2, FD + cs * 1.2], ...dense]
        mainFrom = cs * 0.8
        mainLen = dense.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - dense[i - 1][0], p[1] - dense[i - 1][1]) : 0), 0)
        for (const o of offs) rakeMain.push(s('path', { class: 't24c-rake main', d: offsetD(dense, o), pathLength: 1 }))
        for (let i = 0; i < dense.length; i += 3) {
          const [x, y] = dense[i]
          if (r() < 0.6) scuff += stroke([[x + (r() - 0.5) * cs * 0.7, y + (r() - 0.5) * cs * 0.7], [x + (r() - 0.5) * cs * 0.9, y + (r() - 0.5) * cs * 0.9]], 1 + r() * 0.8, 0.3, 0.3, 0.2)
        }
      } else {
        // a branch: from the edge of the lane it leaves, to its dead end (a rounded end)
        const [a, b] = [pts[0], pts[1]]
        pts[0] = [a[0] + (b[0] - a[0]) * 0.45, a[1] + (b[1] - a[1]) * 0.45]
        const dense = smooth(pts, cs * 0.5)
        for (const o of offs) rakes += offsetD(dense, o)
        const [ex, ey] = dense[dense.length - 1], [px, py] = dense[dense.length - 2]
        const ang = Math.atan2(ey - py, ex - px)
        for (const o of offs.filter((o) => o > 0)) rakes += poly(Array.from({ length: 9 }, (_, i) => { const t = ang - Math.PI / 2 + (i / 8) * Math.PI; return [ex + Math.cos(t) * o, ey + Math.sin(t) * o] as Pt }))
      }
    })
    for (let i = 0; i < 700; i++) grain += `M${f1(r() * FW)} ${f1(r() * FD)}h${f1(0.8 + r() * 1.2)}`
    // the shortcut: straight up the middle column, a footprint pair every half cell, scuffs at each broken fence
    const sx = (mid + 0.5) * cs
    short = [[sx, FD + cs * 1.2], [sx, FD - cs * 0.1], [sx - cs * 0.05, cs], [sx, -cs * 0.4]]
    gaps = []
    for (let rr = 1; rr < rows; rr++) if (!(open[mid + rr * cols] & N)) gaps.push([sx, rr * cs])
    for (let y = FD + cs * 0.3, i = 0; y > -cs * 0.3; y -= cs * 0.24, i++) {
      const side = i % 2 ? 1 : -1
      steps += blob(sx + side * cs * 0.07 + (r() - 0.5) * 2, y, cs * 0.032, cs * 0.06, 2470 + i, 0.15, 10) + blob(sx + side * cs * 0.07, y - cs * 0.075, cs * 0.026, cs * 0.026, 2570 + i, 0.15, 8)
    }
    for (const [gx, gy] of gaps) for (let k = 0; k < 7; k++) scuff += stroke([[gx + (r() - 0.5) * cs * 0.5, gy + (r() - 0.5) * cs * 0.4], [gx + (r() - 0.5) * cs * 0.6, gy + (r() - 0.5) * cs * 0.5]], 1.4, 0.3, 0.3, 0.2)
    floorSvg.replaceChildren(
      s('defs', null, s('radialGradient', { id: 't24c-bed', cx: 0.5, cy: 0.5, r: 0.72 }, s('stop', { offset: 0, class: 't24c-bed0' }), s('stop', { offset: 0.8, class: 't24c-bed1' }), s('stop', { offset: 1, class: 't24c-bed2' }))),
      s('rect', { class: 't24c-bedfill', x: 0, y: 0, width: f1(FW), height: f1(FD), fill: 'url(#t24c-bed)' }),
      s('path', { class: 't24c-grain', d: grain }),
      s('path', { class: 't24c-rake', d: rakes }),
      s('path', { class: 't24c-rake-hi', d: rakes, transform: 'translate(0 1.2)' }),
      ...rakeMain,
      s('path', { class: 't24c-scuff', d: scuff }),
      s('path', { class: 't24c-steps', d: steps }),
      s('path', { class: 't24c-moonsh' }),
      s('path', { class: 't24c-trail', d: poly(short) }))
  }

  /** Fences on every wall: tall split-bamboo runs with rails and black cord bindings; broken where the shortcut went through. */
  function drawFences(open: Uint8Array) {
    const { cs, cols, rows, fh } = G
    const mid = Math.floor(cols / 2)
    runs = []
    // horizontal walls (top of each cell row), merged along x; gaps left where the shortcut crossed
    for (let rr = 0; rr <= rows; rr++) {
      let x0 = -1
      for (let c = 0; c <= cols; c++) {
        const wall = c < cols && (rr === 0 ? c !== mid : rr === rows ? c !== mid : !(open[c + rr * cols] & N))
        const broken = wall && c === mid && rr > 0 && rr < rows
        if (wall && !broken && x0 < 0) x0 = c
        if ((!wall || broken) && x0 >= 0) {
          runs.push([x0 * cs, rr * cs, c * cs, rr * cs])
          x0 = -1
        }
        if (broken) {
          runs.push([c * cs, rr * cs, (c + 0.3) * cs, rr * cs], [(c + 0.72) * cs, rr * cs, (c + 1) * cs, rr * cs])
        }
      }
    }
    // vertical walls (left of each cell column), merged along y
    for (let c = 0; c <= cols; c++) {
      let y0 = -1
      for (let rr = 0; rr <= rows; rr++) {
        const wall = rr < rows && (c === 0 || c === cols || !(open[c + rr * cols] & Wb))
        if (wall && y0 < 0) y0 = rr
        if (!wall && y0 >= 0) {
          runs.push([c * cs, y0 * cs, c * cs, rr * cs])
          y0 = -1
        }
      }
    }
    plane.querySelectorAll('.t24c-fence').forEach((e) => e.remove())
    runs.forEach(([x0, y0, x1, y1], i) => {
      const len = Math.hypot(x1 - x0, y1 - y0) + cs * 0.04
      const el = h('div', { class: 't24c-fence' }, s('svg', { viewBox: `0 0 ${f1(len)} ${f1(fh)}`, 'aria-hidden': 'true' }, ...bamboo(len, fh, 2480 + i)))
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
      Object.assign(el.style, { left: `${f1(cx - len / 2)}px`, top: `${f1(cy - fh)}px`, width: `${f1(len)}px`, height: `${f1(fh)}px`, transform: `${x0 === x1 ? 'rotateZ(90deg) ' : ''}rotateX(-90deg)` })
      plane.insertBefore(el, gate)
    })
    // the moon's shadows (seen once the clouds have gone): every run thrown a little toward us and to the left
    let msh = ''
    const dx = -fh * 0.35, dy = fh * 0.55
    for (const [x0, y0, x1, y1] of runs) msh += `M${f1(x0)} ${f1(y0)}L${f1(x1)} ${f1(y1)}L${f1(x1 + dx)} ${f1(y1 + dy)}L${f1(x0 + dx)} ${f1(y0 + dy)}Z`
    floorSvg.querySelector('.t24c-moonsh')?.setAttribute('d', msh)
    // broken canes lying in the gaps
    let litter = ''
    const r = rng(2499)
    for (const [gx, gy] of gaps) for (let k = 0; k < 3; k++) {
      const a = (r() - 0.5) * 1.6, l = cs * (0.2 + r() * 0.2), x = gx + (r() - 0.5) * cs * 0.4, y = gy + (r() - 0.3) * cs * 0.3
      litter += stroke([[x, y], [x + Math.cos(a) * l, y + Math.sin(a) * l]], cs * 0.035, 0.05, 0.05, 0.6)
    }
    floorSvg.append(s('path', { class: 't24c-litter', d: litter }))
  }

  /** A run of tall bamboo fence len × fh: canes split and uneven, nodes, two rails, black cord bindings, a moonlit edge. */
  function bamboo(len: number, fh: number, seed: number): SVGElement[] {
    const r = rng(seed)
    let canes = '', nodes = '', rails = '', lit = '', ties = ''
    for (let x = 2; x < len - 1; x += fh * (0.085 + r() * 0.03)) {
      const hh = fh * (0.86 + r() * 0.14), w = fh * (0.065 + r() * 0.025)
      canes += `M${f1(x - w / 2)} ${f1(fh)}L${f1(x - w / 2)} ${f1(fh - hh + w * 0.3)}Q${f1(x)} ${f1(fh - hh - w * 0.4)} ${f1(x + w / 2)} ${f1(fh - hh + w * 0.3)}L${f1(x + w / 2)} ${f1(fh)}Z`
      for (const t of [0.3, 0.62]) nodes += `M${f1(x - w * 0.6)} ${f1(fh - hh * t)}h${f1(w * 1.2)}`
      lit += `M${f1(x - w * 0.25)} ${f1(fh - hh + w)}V${f1(fh - 2)}`
    }
    const ry = [0.32, 0.7]
    for (const t of ry) rails += stroke([[0, fh * (1 - t)], [len, fh * (1 - t) + (r() - 0.5)]], fh * 0.065, 0.01, 0.01, 0.6)
    // bindings: a cross of black cord where each rail meets a post (every so often)
    const posts = Math.max(2, Math.round(len / (fh * 1.1)) + 1)
    let postD = ''
    for (let k = 0; k < posts; k++) {
      const x = Math.min(len - fh * 0.06, Math.max(fh * 0.06, (k * len) / (posts - 1)))
      postD += `M${f1(x - fh * 0.06)} ${f1(fh)}L${f1(x - fh * 0.06)} ${f1(fh * 0.02)}L${f1(x + fh * 0.06)} ${f1(fh * 0.02)}L${f1(x + fh * 0.06)} ${f1(fh)}Z`
      for (const t of ry) {
        const y = fh * (1 - t), q = fh * 0.05
        ties += stroke([[x - q, y - q], [x + q, y + q]], fh * 0.03, 0.1, 0.1, 0.6) + stroke([[x + q, y - q], [x - q, y + q]], fh * 0.03, 0.1, 0.1, 0.6)
      }
    }
    return [
      s('path', { class: 't24c-cane', d: canes }),
      s('path', { class: 't24c-cane-lit', d: lit }),
      s('path', { class: 't24c-node', d: nodes }),
      s('path', { class: 't24c-rail', d: rails + postD }),
      s('path', { class: 't24c-tie', d: ties }),
    ]
  }

  /** The bell gate at the far middle (posts, a long beam, the bronze bell on a red cord) and the low entry gate below. */
  function drawGates() {
    const { cs, FW, FD } = G
    const gw = cs * 2.2, gh = cs * 1.7
    Object.assign(gate.style, { left: `${f1(FW / 2 - gw / 2)}px`, top: `${f1(-gh)}px`, width: `${f1(gw)}px`, height: `${f1(gh)}px` })
    gateSvg.setAttribute('viewBox', `0 0 ${f1(gw)} ${f1(gh)}`)
    const px = gw * 0.27, bw = gw * 0.07, top = gh * 0.12
    const bx = gw / 2, bt = top + gh * 0.22, br = gw * 0.075
    const bell = `M${f1(bx - br)} ${f1(bt + br * 2.3)}Q${f1(bx - br * 1.04)} ${f1(bt + br * 0.2)} ${f1(bx)} ${f1(bt)}Q${f1(bx + br * 1.04)} ${f1(bt + br * 0.2)} ${f1(bx + br)} ${f1(bt + br * 2.3)}Q${f1(bx)} ${f1(bt + br * 2.6)} ${f1(bx - br)} ${f1(bt + br * 2.3)}Z`
    bellG.replaceChildren(
      s('circle', { class: 't24c-bellglow', cx: f1(bx), cy: f1(bt + br * 1.3), r: f1(br * 4), fill: 'url(#p2-lamp)' }),
      s('path', { class: 't24c-rope', d: `M${f1(bx)} ${f1(top + gh * 0.04)}V${f1(bt + 1)}` }),
      s('path', { class: 't24c-bronze', d: bell, fill: 'url(#t24c-bronzeg)' }),
      s('path', { class: 't24c-bell-ink', d: stroke([[bx - br * 1.02, bt + br * 2.25], [bx, bt + br * 2.5], [bx + br * 1.02, bt + br * 2.25]], 2, 0.1, 0.1, 0.4) + stroke([[bx - br * 0.85, bt + br * 1.1], [bx + br * 0.85, bt + br * 1.1]], 1.2, 0.2, 0.2, 0.4) }),
      s('path', { class: 't24c-bell-hi', d: stroke(curve([bx - br * 0.55, bt + br * 0.5], [bx - br * 0.72, bt + br * 1.2], [bx - br * 0.6, bt + br * 1.9], 6), 2, 0.3, 0.3, 0.1) }),
      s('circle', { class: 't24c-clapper', cx: f1(bx), cy: f1(bt + br * 2.6), r: f1(br * 0.2) }))
    bellG.style.transformOrigin = `${f1(bx)}px ${f1(top + gh * 0.04)}px`
    gateSvg.replaceChildren(
      s('defs', null, s('linearGradient', { id: 't24c-bronzeg', x1: 0, y1: 0, x2: 1, y2: 0.4 }, s('stop', { offset: 0, class: 't24c-br0' }), s('stop', { offset: 0.5, class: 't24c-br1' }), s('stop', { offset: 1, class: 't24c-br2' }))),
      s('path', { class: 't24c-post', d: `M${f1(px)} ${f1(top)}h${f1(bw)}V${f1(gh)}h${f1(-bw)}ZM${f1(gw - px - bw)} ${f1(top)}h${f1(bw)}V${f1(gh)}h${f1(-bw)}Z`, filter: 'url(#ink-rough)' }),
      s('path', { class: 't24c-beam', d: stroke(curve([0, top + 4], [gw / 2, top - gh * 0.05], [gw, top + 4], 12), gh * 0.065, 0.04, 0.04, 0.7) + stroke([[px * 0.7, top + gh * 0.1], [gw - px * 0.7, top + gh * 0.1]], gh * 0.035, 0.05, 0.05, 0.7), filter: 'url(#ink-rough)' }),
      s('path', { class: 't24c-post-lit', d: `M${f1(px + 1)} ${f1(top + 4)}V${f1(gh)}M${f1(gw - px - bw + 1)} ${f1(top + 4)}V${f1(gh)}` }),
      bellG)
    // the entry: two bamboo posts and a crossbar where both ways in begin
    const ew = cs * 1.4, eh = cs * 0.9
    Object.assign(entry.style, { left: `${f1(FW / 2 - ew / 2)}px`, top: `${f1(FD + cs * 0.12 - eh)}px`, width: `${f1(ew)}px`, height: `${f1(eh)}px` })
    entrySvg.setAttribute('viewBox', `0 0 ${f1(ew)} ${f1(eh)}`)
    const pw = ew * 0.07
    entrySvg.replaceChildren(
      s('path', { class: 't24c-cane', d: `M${f1(ew * 0.12)} ${f1(eh * 0.1)}h${f1(pw)}V${f1(eh)}h${f1(-pw)}ZM${f1(ew * 0.88 - pw)} ${f1(eh * 0.1)}h${f1(pw)}V${f1(eh)}h${f1(-pw)}Z` }),
      s('path', { class: 't24c-rail', d: stroke([[ew * 0.02, eh * 0.16], [ew * 0.98, eh * 0.14]], eh * 0.08, 0.02, 0.02, 0.7) }),
      s('path', { class: 't24c-tie', d: [ew * 0.12 + pw / 2, ew * 0.88 - pw / 2].map((x) => stroke([[x - 4, eh * 0.1], [x + 4, eh * 0.22]], 2, 0.1, 0.1, 0.6) + stroke([[x + 4, eh * 0.1], [x - 4, eh * 0.22]], 2, 0.1, 0.1, 0.6)).join('') }))
    root.style.setProperty('--r', `${f1(G.R)}px`)
  }

  /**
   * Hang the things that carry words, at the screen points of their cords: the plaque under the bell, the result strip
   * from the beam's right end, the takeaway ema from its left end, the task's ema from a pine bough in the top-left corner;
   * the two carved stones before the entry.
   */
  function placeThings() {
    const { W, H, cs, FW, FD, wide } = G
    const gw = cs * 2.2, gh = cs * 1.7
    // the bell gate stands up from the far edge, leaning toward us: its beam is about gh above the plane
    const [gx, gy] = project(FW / 2, 0)
    const k = (project(FW / 2 + 100, 0)[0] - gx) / 100 // screen px per plane px at the far edge
    const beamY = gy - gh * k * 0.84
    // each hangs with its top at (x, y) on a cord tied at (ax, ay): the cord slants when the two are not plumb
    const hang = (el: HTMLElement, x: number, y: number, ax: number, ay: number) => {
      el.style.left = `${f1(x)}px`
      el.style.top = `${f1(y)}px`
      el.style.setProperty('--cl', `${f1(Math.hypot(ax - x, ay - y))}px`)
      el.style.setProperty('--ca', `${Math.atan2(ax - x, y - ay).toFixed(3)}rad`)
    }
    hang(plaque, gx, beamY + gh * k * 0.52, gx, beamY + gh * k * 0.46)
    // the takeaway's ema off the beam's left end, the result strip off its right end, both clear of the bell
    const end = gw * k * 0.5, ew = wide ? 150 : 124, rw = wide ? 128 : 112
    hang(reveal, Math.min(gx + end + rw * 0.5 + 6, W - rw * 0.5 - 6), beamY + gh * k * 0.3, gx + end, beamY)
    // (no room beside the gate on a phone: there the ema hangs on under the bell's plaque)
    if (tag && wide) hang(tag, Math.max(gx - end - ew * 0.5 - 6, ew * 0.5 + 6), beamY + gh * k * 0.36, gx - end, beamY)
    tag?.style.setProperty('--ew', `${ew}px`)
    reveal.style.setProperty('--rw', `${rw}px`)
    // the task: an ema on a pine bough reaching in from the top-left corner
    const bx = wide ? Math.max(W * 0.12, G.left - cs * 1.4) : 72, by = wide ? H * 0.06 : H * 0.02
    hang(task, bx, by + (wide ? 30 : 10), bx, by)
    task.style.setProperty('--ew', `${wide ? 184 : 134}px`)
    // (no room beside the gate on a phone: there the takeaway's ema takes the task's place on the bough once found)
    if (tag && !wide) hang(tag, bx, by + 10, bx, by), tag.style.setProperty('--ew', '134px')
    bough.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    const r = rng(2498)
    let needles = ''
    const b0: Pt = [-W * 0.04, by - H * 0.03], b1: Pt = [bx + cs * 1.2, by - H * 0.005]
    for (let i = 0; i < 6; i++) {
      const t = 0.15 + i * 0.16, ox = b0[0] + (b1[0] - b0[0]) * t, oy = b0[1] + (b1[1] - b0[1]) * t
      for (let j = 0; j < 14; j++) {
        const a = Math.PI * (0.05 + (j / 13) * 0.9) + (r() - 0.5) * 0.1
        const l = cs * (0.35 + r() * 0.25)
        needles += stroke([[ox, oy], [ox + Math.cos(a) * l, oy + Math.sin(a) * l * 0.9]], 1.4, 0.05, 0.6, 0.2)
        if (j % 3 === 0) needles += stroke([[ox, oy], [ox + Math.cos(-a) * l * 0.7, oy + Math.sin(-a) * l * 0.6]], 1.3, 0.05, 0.6, 0.2)
      }
    }
    bough.replaceChildren(
      s('path', { class: 't24c-bough-wood', d: stroke(curve(b0, [(b0[0] + b1[0]) / 2, b0[1] - H * 0.01], b1, 10), Math.max(4, cs * 0.09), 0.05, 0.4, 0.4), filter: 'url(#ink-rough)' }),
      s('path', { class: 't24c-bough-needle', d: needles }))
    // the two carved stones before the entry: the long way (left) and the shortcut (right)
    const sw = wide ? clamp(cs * 3, 170, 210) : Math.min(152, (W - 30) / 2)
    const [ex, ey] = project(FW / 2, FD + cs * 0.9)
    stones.forEach((b, i) => {
      const x = clamp(ex + (i ? 0.08 : -1.08) * sw, 8, W - sw - 8)
      Object.assign(b.style, { left: `${f1(x)}px`, top: `${f1(Math.min(ey, H - 62))}px`, width: `${f1(sw)}px` })
    })
  }

  // ── the lantern: a warm pool that follows the pointer; the dark lifts only there, the fences' shadows fan out from it
  function moveLamp(u: number, v: number) {
    const { FW, FD, cs, fh } = G
    G.lu = clamp(u, -cs * 0.6, FW + cs * 0.6)
    G.lv = clamp(v, -cs * 0.6, FD + cs * 1.4)
    pool.style.transform = `translate(${f1(G.lu)}px, ${f1(G.lv)}px)`
    const [x, y] = project(G.lu, G.lv)
    dark.style.transform = `translate(${f1(x - G.W)}px, ${f1(y - G.H)}px)`
    lantern.style.transform = `translate(${f1(x)}px, ${f1(y - cs * 0.9)}px)`
    // shadows: each fence top seen from the lantern (held 2.2 fence-heights up) falls outward on the gravel
    const hl = fh * 2.2, kf = hl / (hl - fh), reach = cs * 3.6
    let d = ''
    for (const [x0, y0, x1, y1] of runs) {
      const mx = Math.max(x0, Math.min(G.lu, x1)), my = Math.max(y0, Math.min(G.lv, y1))
      if (Math.hypot(mx - G.lu, my - G.lv) > reach) continue
      const a0 = G.lu + (x0 - G.lu) * kf, b0 = G.lv + (y0 - G.lv) * kf, a1 = G.lu + (x1 - G.lu) * kf, b1 = G.lv + (y1 - G.lv) * kf
      d += `M${f1(x0)} ${f1(y0)}L${f1(x1)} ${f1(y1)}L${f1(a1)} ${f1(b1)}L${f1(a0)} ${f1(b0)}Z`
    }
    shadowPath.setAttribute('d', d)
    shadowSvg.style.setProperty('--lx', `${f1(G.lu)}px`)
    shadowSvg.style.setProperty('--ly', `${f1(G.lv)}px`)
    // the light finds a broken fence (not while it is walking the long way on its rails: it keeps to the true lanes)
    if (!found && !(walking >= 0 && K.paths[walking].honest)) for (let i = 0; i < gaps.length; i++) if (Math.hypot(G.lu - gaps[i][0], G.lv - gaps[i][1]) < cs * 0.9) discover()
  }

  // pointer: drag anywhere on the garden (or just move the mouse over it) to carry the light
  let rect: DOMRect | null = null
  let dragging = -1
  const here = (e: PointerEvent) => {
    rect ??= host.getBoundingClientRect()
    const [u, v] = unproject(e.clientX - rect.left, e.clientY - rect.top)
    if (walking < 0) moveLamp(u, v)
  }
  host.addEventListener('pointerenter', () => void (rect = host.getBoundingClientRect()))
  host.addEventListener('pointerdown', (e) => {
    if ((e.target as Element).closest('button')) return
    rect = host.getBoundingClientRect()
    dragging = e.pointerId
    host.setPointerCapture(e.pointerId)
    here(e)
  })
  host.addEventListener('pointermove', (e) => (e.pointerId === dragging || e.pointerType === 'mouse') && here(e))
  const up = (e: PointerEvent) => e.pointerId === dragging && (dragging = -1)
  host.addEventListener('pointerup', up)
  host.addEventListener('pointercancel', up)

  // one loop: the light walking a way in (from a carved stone), raking the true way as it goes on the long walk
  let route: Pt[] = [], lens: number[] = [], dist = 0, total = 0, speed = 0
  const loop = createLoop(host, (_t, dt) => {
    if (walking < 0) return false
    dist = Math.min(total, dist + dt * speed)
    const [u, v] = along(dist)
    moveLamp(u, v)
    if (K.paths[walking].honest) rakeTo(dist)
    if (dist >= total) {
      const i = walking
      walking = -1
      arrive(i)
      return false
    }
    return true
  }, { essential: true })
  ctx.onCleanup(() => loop.dispose())
  function along(d: number): Pt {
    let i = 1
    while (i < lens.length - 1 && lens[i] < d) i++
    const a = route[i - 1], b = route[i], k = (d - lens[i - 1]) / (lens[i] - lens[i - 1] || 1)
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]
  }
  /** Lay the rake lines of the true way up to where the light has walked. */
  function rakeTo(d: number) {
    const k = clamp((d - mainFrom) / mainLen, 0, 1)
    for (const p of rakeMain) p.style.strokeDashoffset = String(1 - k)
  }

  function walk(i: number) {
    stones.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)))
    root.classList.toggle('long', K.paths[i].honest)
    ctx.chime('tap')
    route = K.paths[i].honest ? long : short
    lens = [0]
    for (let k = 1; k < route.length; k++) lens.push(lens[k - 1] + Math.hypot(route[k][0] - route[k - 1][0], route[k][1] - route[k - 1][1]))
    total = lens[lens.length - 1]
    dist = 0
    speed = total / (K.paths[i].honest ? 7 : 1.8)
    walking = i
    if (ctx.reduced) {
      walking = -1
      const [u, v] = route[route.length - 1]
      moveLamp(u, v)
      if (K.paths[i].honest) rakeTo(total)
      arrive(i)
    } else loop.start()
  }

  function arrive(i: number) {
    ring()
    if (!K.paths[i].honest) discover()
  }

  function ring() {
    root.classList.remove('ring')
    void root.offsetWidth
    root.classList.add('ring')
    ctx.chime('ok')
  }

  /** The trick is seen: the clouds drift off, the moon lights the whole maze, the result is hung on the bell gate. */
  function discover() {
    if (found) return
    found = true
    root.classList.add('found')
    ;(reveal.lastChild as HTMLElement).textContent = K.reveal
    ctx.insight(K.insight, K.detail)
  }

  function openCard() {
    if (!card) return
    sheet.replaceChildren(h('button', { class: 't24c-close', type: 'button', 'aria-label': L.close, onClick: () => (sheet.hidden = true) }, '×'), takeaway(card, null, ctx.onCleanup))
    sheet.hidden = false
    ;(sheet.querySelector('button') as HTMLElement | null)?.focus()
  }

  // on entering: the bell rings by itself — the tests already "pass"
  if (!lit0 && !ctx.reduced) {
    const t = setTimeout(ring, 900)
    ctx.onCleanup(() => clearTimeout(t))
  } else root.classList.add('rang')
}
