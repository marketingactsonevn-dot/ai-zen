import './path.css'
import { fill, h, s } from '../../core/dom'
import { sliced } from '../../core/chunk'
import { blob, clamp, curve, rng, stroke, type Pt } from '../../ui/part2/ink'
import { stepPath, type SlotGeo } from '../../ui/part2/steps'
import { pine } from '../../ui/part2/paint'
import { guide, type Drop, type Mark } from '../../ui/part2/guide'
import { onPrefs } from '../../core/prefs'
import type { SceneCtx, SceneDef } from '../types'
import { C } from './shell'
import { crescent, dawnGlow, f1, fog, g39Defs, lines, polyD, readTok, rgba, smoothD, type Tok } from './g39'

const P = C.scenes.path as typeof C.scenes.path & { shorts: string[] }

/** Per mount: the backdrop and the path's geometry (only one scene lives at a time). */
let M: { ctx: SceneCtx; back: HTMLElement; sky: SVGSVGElement; land: SVGSVGElement; front: SVGSVGElement; moss: HTMLCanvasElement; tok: Tok | null; redraw: (() => void) | null; sun: HTMLElement; centers: Pt[]; depth: number[]; size: Pt; wide: boolean; gh: number; placed: number; job: { cancel(): void } | null; first: boolean; onPlace: (k: number) => void } | null = null

/** Where the loose stones lie on the veranda: [x, y] as parts of the scene box and their scale, staggered and growing
 *  toward the viewer (wide: a zig-zag from the far left to the near right; tall: two loose pairs). Index = pile order. */
const PILE_W: [number, number, number][] = [[0.12, 0.785, 0.84], [0.34, 0.915, 1.02], [0.55, 0.8, 0.92], [0.74, 0.935, 1.04]]
const PILE_T: [number, number, number][] = [[0.25, 0.8, 0.74], [0.75, 0.825, 0.8], [0.3, 0.948, 0.86], [0.71, 0.968, 0.92]]

/**
 * Scene 4 — thirty days as four stacked week-stones (stepPath, 1PT backlit; audit 39-3 "Bậc đá chồng"). From the
 * veranda, eye level: a moss slope climbs to a garden gate on the horizon with the sun just below it; four hollows wait in
 * the gravel path, each farther one higher and smaller. The loose stones lie on the veranda boards, each a different rock
 * with a thing in relief and its short name cut faintly beside it (no number: the order is the puzzle). A week only stands
 * on the week before: set one in its hollow (drag, tap, or 1–4 = week 1–4) and it recedes to its depth; one set too early
 * slides back and the prompt says which stone it needs under it. All four: the sun clears the gate, a ray runs down the
 * path waking each stone, and the 30-day card lies rolled at the gate's threshold until touched.
 */
const def = stepPath(P.steps, {
  label: P.label, prompt: P.prompt, insight: P.insight, cards: P.weekCards,
  art: () => [],
  slots: (g) => {
    const wide = g.row
    const ys = wide ? [0.615, 0.515, 0.447, 0.398] : [0.58, 0.455, 0.36, 0.292]
    const xs = wide ? [-0.04, 0.035, -0.02, 0.01] : [-0.06, 0.06, -0.035, 0.015]
    const centers = ys.map((y, k) => [g.w / 2 + xs[k] * g.w, y * g.h] as Pt)
    if (M) {
      M.centers = centers
      M.depth = wide ? [1, 0.74, 0.56, 0.43] : [0.94, 0.74, 0.58, 0.46]
      M.size = g.size
      M.wide = wide
      M.gh = g.h
      paint(g)
      // stones already set keep their depth after a resize
      M.ctx.art.querySelectorAll<HTMLElement>('.p2s-stone.placed').forEach((el) => sink(el, Number(el.querySelector('.p2s-key')?.textContent) - 1))
    }
    return centers
  },
  pile: (g) => {
    const at = g.row ? PILE_W : PILE_T
    // each loose stone's painting takes the scale of its place (nearer = bigger; the box, hit area and drag stay as the
    // component made them); the pile index is its digit key - 1
    M?.ctx.art.querySelectorAll<HTMLElement>('.p2s-stone:not(.placed)').forEach((el) => {
      const k = Number(el.querySelector('.p2s-key')?.textContent) - 1
      if (at[k]) el.style.setProperty('--ps', String(at[k][2]))
    })
    return at.map(([x, y]) => [x * g.w, y * g.h] as Pt)
  },
  piece: (i, { w, h: hh, seed }) => stoneArt(w, hh, seed, i),
  onPlace: (k) => {
    if (!M) return
    const el = [...M.ctx.art.querySelectorAll<HTMLElement>('.p2s-stone.placed')].find((x) => x.querySelector('.p2s-key')?.textContent === String(k + 1))
    if (el) sink(el, k)
    M.placed++
    M.front.querySelectorAll('.t39p-pip').forEach((p, i) => p.classList.toggle('on', i < M!.placed))
    if (M.placed >= 4) M.back.classList.add('is-lit')
    M.onPlace(k)
  },
})

/** A set stone recedes to its hollow's depth: scaled about its centre, the shift the scale makes undone by `translate`. */
function sink(el: HTMLElement, k: number) {
  if (!M || !M.centers[k]) return
  const s0 = M.depth[k]
  el.style.setProperty('--k', String(k))
  el.style.setProperty('--s', String(s0))
  el.style.setProperty('--ps', '1')
  const [cx, cy] = M.centers[k]
  const [ox, oy] = [M.size[0] / 2, M.size[1] / 2]
  el.style.scale = String(s0)
  // `scale` also scales the component's translate: undo that shift so the stone's centre stays on its hollow
  el.style.translate = `${f1((cx - ox) * (1 - s0))}px ${f1((cy - oy) * (1 - s0))}px`
}

export const pathScene: SceneDef = {
  label: def.label,
  // the end leaves the veranda empty: the insight sits there, the payoff (gate, sun, path) stays clear
  text: 'bl',
  mount(ctx) {
    g39Defs()
    const sky = s('svg', { class: 't39p-sky', 'aria-hidden': 'true' })
    const sun = h('i', { class: 't39p-sun', 'aria-hidden': 'true' })
    const land = s('svg', { class: 't39p-land', 'aria-hidden': 'true' })
    // the moss is a canvas (thousands of mounds) between the far land and everything that stands on the slope
    const moss = h('canvas', { class: 't39p-moss', 'aria-hidden': 'true' }) as HTMLCanvasElement
    const front = s('svg', { class: 't39p-land', 'aria-hidden': 'true' })
    const back = h('div', { class: `t39p${ctx.reduced || ctx.quality === 'low' ? ' is-still' : ''}`, 'aria-hidden': 'true' }, sky, sun, land, moss, front)
    ctx.art.append(back, h('p', { class: 'visually-hidden' }, P.art))
    M = { ctx, back, sky, land, front, moss, tok: null, redraw: null, sun, centers: [], depth: [], size: [0, 0], wide: true, gh: 0, placed: 0, job: null, first: true, onPlace: () => {} }
    const out = def.mount(ctx)
    ctx.art.querySelector('.p2s')?.classList.add('t39p-steps')
    guideWeeks(ctx)
    // a theme change repaints the moss in one pass (only when its colours changed)
    ctx.onCleanup(onPrefs(() => {
      if (!M || M.back !== back || !M.tok) return
      const t = readTok()
      if (t.mossA === M.tok.mossA && t.umbra === M.tok.umbra && t.lantern === M.tok.lantern) return
      M.tok = t
      M.redraw?.()
    }))
    ctx.onCleanup(() => {
      if (M?.back === back) (M.job?.cancel(), (M = null))
    })
    return out
  },
}

/** The land behind the path, in the full-bleed backdrop (offset from the component's own box by the page gutter). */
function paint(g: SlotGeo) {
  if (!M) return
  const { back, sky, land, front, moss: cv, sun, centers, depth, size } = M
  const BW = back.clientWidth, BH = back.clientHeight
  const ox = (BW - g.w) / 2
  const T0 = Math.max(0, BH - M.ctx.art.clientHeight - 24)
  const X = (x: number) => x + ox, Y = (y: number) => y + T0
  const wide = g.row
  const r = rng(3950)
  const hz = Y(g.h * (wide ? 0.33 : 0.15))
  const gx = X(g.w / 2)
  const gateH = g.h * (wide ? 0.2 : 0.14)
  const sunR = clamp(gateH * 0.3, 11, 38)
  const vy = Y(g.h * (wide ? 0.705 : 0.665))
  for (const el of [sky, land, front]) el.setAttribute('viewBox', `0 0 ${f1(BW)} ${f1(BH)}`)
  // the sky: dawn rising behind the gate, the thin moon high on the left
  sky.replaceChildren(
    s('rect', { class: 'g39-skyfill', x: -2, y: -2, width: f1(BW + 4), height: f1(hz + 4), fill: 'url(#g39-sky)' }),
    s('rect', { class: 'g39-skydawn', x: -2, y: f1(hz * 0.15), width: f1(BW + 4), height: f1(hz * 0.85 + 2), fill: 'url(#g39-dawnv)' }),
    dawnGlow(gx, hz, BW * 0.5, hz * 0.95, 3),
    crescent(X(g.w * (wide ? 0.12 : 0.13)), Y(g.h * (wide ? 0.07 : 0.035)) + 14, clamp(g.h * 0.02, 7, 14), 0.62, 160))
  Object.assign(sun.style, { left: `${f1(gx - sunR * 7)}px`, top: `${f1(hz + sunR * 0.5 - sunR * 7)}px`, width: `${f1(sunR * 14)}px`, height: `${f1(sunR * 14)}px` })
  sun.style.setProperty('--lift', `${f1(-gateH * 1.08)}px`)
  sun.style.setProperty('--r', `${f1(sunR)}px`)

  // the path's centre line, from under the veranda to the gate's foot; its width shrinks hard with distance
  const depthAt = (y: number) => clamp((y - hz) / (Y(g.h) - hz), 0, 1.2)
  const pts: Pt[] = [[gx, Y(g.h) + 40], ...centers.map(([x, y]) => [X(x), Y(y)] as Pt), [gx, hz + 3]]
  const line: Pt[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]
    line.push(...curve(a, [(a[0] + b[0]) / 2 + (i % 2 ? 1 : -1) * BW * 0.012, (a[1] + b[1]) / 2], b, 10).slice(i ? 1 : 0))
  }
  const half = (y: number) => (wide ? BW : BW * 1.5) * (0.006 + 0.3 * Math.pow(depthAt(y), 1.35))
  /** the path's centre at height y (the line runs bottom → top) */
  const midX = (y: number) => {
    for (let i = 1; i < line.length; i++) if (line[i][1] <= y) {
      const [ax, ay] = line[i - 1], [bx, by] = line[i]
      return ax + ((bx - ax) * (y - ay)) / (by - ay || 1)
    }
    return gx
  }
  const L: Pt[] = line.map(([x, y]) => [x - half(y), y]), R: Pt[] = line.map(([x, y]) => [x + half(y), y])
  const road = polyD([...L, ...R.reverse()]) + 'Z'
  // gravel on the path, larger near; a few pebbles kicked onto the moss at its edges
  let gravel = '', gravelHi = ''
  for (let i = 0; i < 420; i++) {
    const t = Math.pow(r(), 0.7)
    const k = Math.min(line.length - 1, Math.floor(t * (line.length - 1)))
    const [x, y] = line[line.length - 1 - k]
    const dd = depthAt(y)
    const rr = 0.6 + dd * 4.2
    const px = x + (r() - 0.5) * 2 * half(y) * 1.02, py = y + (r() - 0.5) * 6 * dd
    gravel += blob(px, py, rr, rr * 0.55, i, 0.2, 7)
    if (r() < 0.5) gravelHi += blob(px, py - rr * 0.28, rr * 0.7, rr * 0.25, i + 3, 0.2, 6)
  }
  // the moss: rows of mounds that overlap into one carpet, each with a shade falling toward the viewer, a body darker
  // at its foot and a rim lit by the sun behind; small and dense far off, big near; they spill over the path's edges.
  // Painted on a canvas in slices (first time) or in one pass (re-layout, theme)
  const dpr = M.ctx.quality === 'low' ? 1 : Math.min(devicePixelRatio || 1, 2)
  cv.width = Math.round(BW * dpr)
  cv.height = Math.round(BH * dpr)
  function* moss(): Generator {
    const T = (M!.tok ??= readTok())
    const c = cv.getContext('2d')!
    c.setTransform(dpr, 0, 0, dpr, 0, 0)
    c.clearRect(0, 0, BW, BH)
    const q0 = rng(3959)
    const isDark = document.documentElement.dataset.theme === 'dark'
    const top = T.mossC, body = T.mossB, foot = T.mossA
    // far: a fine nap of short strokes melting into the glare
    c.strokeStyle = rgba(T.mossB, isDark ? 0.55 : 0.45)
    c.lineCap = 'round'
    for (let i = 0; i < (wide ? 900 : 500); i++) {
      const y = hz + 3 + Math.pow(q0(), 1.3) * (vy - hz) * 0.12
      const x = q0() * BW, dd = depthAt(y), L = 2 + dd * 30
      c.lineWidth = 0.6 + dd * 4
      c.beginPath()
      c.moveTo(x, y)
      c.quadraticCurveTo(x + L / 2, y - 1 - dd * 3, x + L, y)
      c.stroke()
    }
    yield
    let y = hz + (vy - hz) * 0.05, n = 0
    const tones = [top, body, foot]
    while (y < vy + 6) {
      const dd = depthAt(y)
      const rx0 = 2.6 + dd * (wide ? 40 : 30), ry0 = rx0 * 0.42
      const mx = midX(y), hw = half(y)
      let x = -rx0 * q0()
      while (x < BW + rx0) {
        // clumps: mostly mid-sized cushions, now and then a big one or a few small ones; bare ground between some
        const k = q0()
        const rx = rx0 * (k < 0.15 ? 1.5 + q0() * 0.5 : k < 0.45 ? 0.45 + q0() * 0.3 : 0.75 + q0() * 0.5), ry = rx * (0.34 + q0() * 0.2)
        const yy = y + (q0() - 0.5) * ry0 * 0.9
        const off = Math.abs(x - mx) / hw
        if (off > 0.84 && q0() > 0.06) {
          c.fillStyle = rgba(T.umbra, isDark ? 0.45 : 0.22)
          c.beginPath()
          c.ellipse(x + rx * 0.05, yy + ry * 0.75, rx * 1.02, ry * 0.6, 0, 0, Math.PI * 2)
          c.fill()
          const t0 = tones[Math.floor(q0() * 3)], t1 = tones[1 + Math.floor(q0() * 2)]
          const g = c.createLinearGradient(0, yy - ry, 0, yy + ry)
          g.addColorStop(0, rgba(t0, 1))
          g.addColorStop(0.5, rgba(t1, 1))
          g.addColorStop(1, rgba(T.umbra, isDark ? 0.9 : 0.55))
          c.fillStyle = g
          c.beginPath()
          const lobes = 2 + Math.floor(q0() * 3)
          for (let j = 0; j < lobes; j++) {
            const lx = x + (j / Math.max(1, lobes - 1) - 0.5) * rx * 0.9 + (q0() - 0.5) * rx * 0.2
            const lr = rx * (0.42 + q0() * 0.3)
            c.ellipse(lx, yy + (q0() - 0.3) * ry * 0.3, lr, ry * (0.7 + q0() * 0.35), 0, 0, Math.PI * 2)
          }
          c.fill()
          if (isDark) {
            // at night the mounds stay dark; the veil keeps the cushions from glowing
            c.fillStyle = rgba(T.umbra, 0.3)
            c.fill()
          }
          // the sun behind lights the crowns' edges: not every one, brightest toward the path and the glare
          if (q0() < 0.7) {
            c.strokeStyle = rgba(T.lantern, (isDark ? 0.28 : 0.45) + (1 - Math.min(1, off / 3)) * 0.3)
            c.lineWidth = 0.5 + dd * 1.6 * q0()
            c.beginPath()
            c.ellipse(x, yy - ry * 0.18, rx * 0.6, ry * 0.85, 0, Math.PI * (1.2 + q0() * 0.1), Math.PI * (1.7 + q0() * 0.15))
            c.stroke()
          }
          if (dd > 0.3 && q0() < 0.16) {
            c.fillStyle = rgba(isDark ? T.lantern : '#ffffff', 0.7)
            c.beginPath()
            c.arc(x + (q0() - 0.5) * rx, yy - ry * 0.7, 0.7 + dd * 1.1, 0, Math.PI * 2)
            c.fill()
          }
        }
        x += rx * (0.8 + q0() * 0.5)
        n++
      }
      y += ry0 * (0.6 + q0() * 0.35)
      if (n > 260) (n = 0, yield)
    }
  }
  M.redraw = () => {
    M!.job?.cancel()
    M!.job = sliced(moss(), { sync: true })
  }
  // the slope: a moss field rising to the gate; its far edge melts into the light (no hard horizon)
  const field = `M-4 ${f1(hz + 14)}Q${f1(BW * 0.25)} ${f1(hz + 6)} ${f1(gx)} ${f1(hz)}Q${f1(BW * 0.75)} ${f1(hz + 8)} ${f1(BW + 4)} ${f1(hz + 18)}L${f1(BW + 4)} ${f1(BH + 4)}L-4 ${f1(BH + 4)}Z`
  const fieldG = s('linearGradient', { id: 't39p-fieldg', x1: 0, y1: f1(hz), x2: 0, y2: f1(vy), gradientUnits: 'userSpaceOnUse' },
    s('stop', { offset: 0, style: 'stop-color:var(--t39p-far)' }),
    s('stop', { offset: 0.3, style: 'stop-color:var(--t39p-mid)' }),
    s('stop', { offset: 1, style: 'stop-color:var(--t39p-near)' }))
  const roadG = s('linearGradient', { id: 't39p-roadg', x1: 0, y1: f1(hz), x2: 0, y2: f1(vy), gradientUnits: 'userSpaceOnUse' },
    s('stop', { offset: 0, style: 'stop-color:var(--t39p-road-far)' }),
    s('stop', { offset: 1, style: 'stop-color:var(--t39p-road)' }))
  // mist lying in the hollows of the slope, low and thin
  const mists = [[0.2, 0.4, 0.2], [0.8, 0.34, 0.18], [0.12, 0.7, 0.14]].map(([fx, fy, fw]) =>
    fog(BW * fx, hz + (vy - hz) * fy, BW * fw, (vy - hz) * 0.05, 'g39-fog t39p-mist'))
  // the hollows cut in the gravel: damp earth thrown up round a dark hole, the far lip lit by the sun behind
  const hollows = centers.map(([x, y], k) => {
    const rx = size[0] * depth[k] * 0.46, ry = rx * (wide ? 0.24 : 0.28)
    const cx = X(x), cy = Y(y) + size[1] * depth[k] * 0.36
    const arc = (k1: number, k2: number, a0: number, a1: number, dy = 0): Pt[] => Array.from({ length: 11 }, (_, j) => {
      const a = ((a0 + ((a1 - a0) * j) / 10) * Math.PI) / 180
      return [cx + Math.cos(a) * rx * k1, cy + dy + Math.sin(a) * ry * k2]
    })
    let crumbs = ''
    for (let j = 0; j < 9; j++) {
      const a = r() * Math.PI * 2, kk = 1.05 + r() * 0.4
      crumbs += blob(cx + Math.cos(a) * rx * kk, cy + Math.sin(a) * ry * kk, 1 + depth[k] * 3, 0.8 + depth[k] * 1.8, j + k * 9, 0.25, 7)
    }
    return s('g', { class: 't39p-hollow' },
      // the dug earth: an uneven damp ring, heaped more on the near side
      s('path', { class: 't39p-hollow-earth', d: blob(cx, cy + ry * 0.18, rx * 1.2, ry * 1.55, 3971 + k, 0.14, 18) }),
      s('path', { class: 't39p-hollow-crumbs', d: crumbs }),
      s('path', { class: 't39p-hollow-in', d: blob(cx, cy, rx, ry, 3975 + k, 0.08, 18) }),
      // the far inner wall faces the viewer, away from the sun: the deepest dark
      s('ellipse', { class: 't39p-hollow-deep', cx: f1(cx), cy: f1(cy - ry * 0.25), rx: f1(rx * 0.84), ry: f1(ry * 0.6) }),
      s('path', { class: 't39p-hollow-lip', d: stroke(arc(1.04, 1.12, 214, 326), Math.max(1, ry * 0.12), 0.35, 0.35, 0.15) }))
  })
  // the ray of the first sun: runs down the path from the gate, one stretch after another
  const rays = pts.slice(0).reverse().slice(0, -1).map((a, i, arr) => {
    const b = i + 1 < arr.length ? arr[i + 1] : pts[0]
    const wa = half(a[1]) * 0.42, wb = half(b[1]) * 0.42
    return s('path', { class: 't39p-ray', style: `--k:${i}`, d: `M${f1(a[0] - wa)} ${f1(a[1])}L${f1(a[0] + wa)} ${f1(a[1])}L${f1(b[0] + wb)} ${f1(b[1])}L${f1(b[0] - wb)} ${f1(b[1])}Z` })
  })
  // the veranda the camera stands on: boards running toward the gate (one-point perspective, they meet at the sun),
  // their seams and grain, the lip at its edge, the warm wedge of the ray across them
  const toVP = (xb: number, y: number) => gx + (xb - gx) * ((y - hz) / (BH - hz))
  let seams = '', grainD = '', knots = ''
  const nb = wide ? 16 : 9, bwid = (BW * 1.5) / (nb * 2)
  for (let i = -nb; i <= nb; i++) {
    const xb = gx + (i + 0.5) * bwid
    seams += `M${f1(toVP(xb, vy))} ${f1(vy)}L${f1(xb)} ${f1(BH)}`
    for (let k = 0; k < 3; k++) {
      const gxb = xb + bwid * (0.2 + r() * 0.6), y0 = vy + (BH - vy) * r() * 0.8, y1 = Math.min(BH, y0 + (BH - vy) * (0.15 + r() * 0.3))
      grainD += stroke([[toVP(gxb, y0), y0], [toVP(gxb, y1), y1]], 0.6 + ((y0 - vy) / (BH - vy)) * 1.2, 0.3, 0.3, 0.2)
    }
    if (r() < 0.35) {
      const ky = vy + (BH - vy) * (0.2 + r() * 0.7), kx = toVP(xb + bwid * (0.3 + r() * 0.4), ky)
      const kr = 1.5 + ((ky - vy) / (BH - vy)) * 4
      knots += blob(kx, ky, kr * 0.7, kr * 1.4, i + 40, 0.2, 8)
    }
  }
  // the ray on the boards: broken streaks along each board inside the wedge, stopping at the seams, fading toward us
  let rayFloor = ''
  const wedge = (y: number) => BW * (0.012 + 0.098 * ((y - vy) / (BH - vy)))
  for (let i = -nb; i <= nb; i++) {
    const c0 = gx + i * bwid
    if (Math.abs(i * bwid) > BW * 0.11 + bwid * 0.5) continue
    let y0 = vy + 2 + r() * 8
    while (y0 < BH) {
      const y1 = Math.min(BH, y0 + (BH - vy) * (0.25 + r() * 0.45))
      const edge = (y: number, side: number) => {
        const b = toVP(c0 + side * bwid * (0.47 - r() * 0.03), y), w = gx + side * wedge(y)
        return side < 0 ? Math.max(b, w) : Math.min(b, w)
      }
      const [a0, b0, a1, b1] = [edge(y0, -1), edge(y0, 1), edge(y1, -1), edge(y1, 1)]
      if (b0 > a0 && b1 > a1) rayFloor += `M${f1(a0)} ${f1(y0)}L${f1(b0)} ${f1(y0)}L${f1(b1)} ${f1(y1)}L${f1(a1)} ${f1(y1)}Z`
      y0 = y1 + (BH - vy) * (0.01 + r() * 0.04)
    }
  }
  // a quiet still life on the boards at the right, away from the loose stones: a low tray with a tea bowl and a tea
  // caddy (not something to touch), its shadow running toward the viewer
  const stillLife = wide ? tray(X(g.w * 0.915), Y(g.h * 0.965), g.h * 0.34, [gx, hz]) : ''
  // the two pines at either side: one tall and leaning in, one low and spreading; their needles rimmed by the sun
  const rimPine = (pg: SVGGElement, dx: number) => {
    const c = pg.cloneNode(true) as SVGGElement
    c.setAttribute('class', 't39p-pine-rim')
    c.setAttribute('transform', `translate(${f1(dx)} -2.6)`)
    return s('g', null, c, pg)
  }
  const p1x = X(g.w * (wide ? 0.1 : 0.03)), p1y = Y(g.h * (wide ? 0.53 : 0.35))
  const p1 = pine(p1x, p1y, g.h * (wide ? 0.34 : 0.22), 3951, 1)
  const p2x = X(g.w * (wide ? 0.92 : 1.0)), p2y = Y(g.h * (wide ? 0.47 : 0.3))
  const p2 = pine(0, 0, g.h * (wide ? 0.19 : 0.14), 3958, -1)
  p2.setAttribute('transform', `translate(${f1(p2x)} ${f1(p2y)}) scale(1.35 0.9)`)
  // the roots of each pine in the moss: a dark collar and its shadow toward the viewer
  const roots = [[p1x, p1y, g.h * 0.05], [p2x, p2y, g.h * 0.035]].map(([x, y, R]) =>
    s('path', { class: 't39p-root', d: blob(x, y + R * 0.15, R, R * 0.3, Math.round(x), 0.25, 12) }))
  land.replaceChildren(
    s('defs', null, fieldG, roadG),
    s('path', { class: 't39p-hills', d: `M-4 ${f1(hz + 2)}L${f1(BW * 0.08)} ${f1(hz - g.h * 0.05)}L${f1(BW * 0.2)} ${f1(hz - g.h * 0.02)}L${f1(BW * 0.32)} ${f1(hz - g.h * 0.075)}L${f1(BW * 0.42)} ${f1(hz - g.h * 0.01)}L${f1(BW * 0.6)} ${f1(hz - g.h * 0.03)}L${f1(BW * 0.72)} ${f1(hz - g.h * 0.08)}L${f1(BW * 0.86)} ${f1(hz - g.h * 0.02)}L${f1(BW + 4)} ${f1(hz - g.h * 0.06)}L${f1(BW + 4)} ${f1(hz + 6)}Z`, filter: 'url(#ink-wash)' }),
    s('path', { class: 't39p-field', d: field, fill: 'url(#t39p-fieldg)' }),
    ...mists,
    s('path', { class: 't39p-road', d: road, fill: 'url(#t39p-roadg)' }),
    s('path', { class: 't39p-road-edge', d: road }),
    s('path', { class: 't39p-gravel', d: gravel }),
    s('path', { class: 't39p-gravel-hi', d: gravelHi }))
  front.replaceChildren(
    ...hollows,
    s('g', { class: 't39p-rays' }, ...rays),
    gate(gx, hz + 3, gateH),
    // the crest: the field's far edge dissolves in the glare and the morning haze
    fog(gx, hz + 4, BW * 0.8, Math.max(16, g.h * 0.06), 'g39-fog t39p-crest'),
    s('ellipse', { class: 't39p-glare', cx: f1(gx), cy: f1(hz + 2), rx: f1(BW * 0.4), ry: f1(Math.max(10, g.h * 0.03)), fill: 'url(#g39-sun)' }),
    ...roots,
    rimPine(p1, 3.4),
    rimPine(p2, -3.4),
    s('rect', { class: 't39p-floor', x: -4, y: f1(vy), width: f1(BW + 8), height: f1(BH - vy + 4) }),
    s('defs', null, s('linearGradient', { id: 't39p-rayg', x1: 0, y1: f1(vy), x2: 0, y2: f1(BH), gradientUnits: 'userSpaceOnUse' },
      s('stop', { offset: 0, style: 'stop-color:var(--t39p-ray)' }),
      s('stop', { offset: 1, style: 'stop-color:var(--t39p-ray);stop-opacity:.12' }))),
    s('path', { class: 't39p-floor-ray', d: rayFloor, fill: 'url(#t39p-rayg)' }),
    s('path', { class: 't39p-planks', d: seams }),
    s('path', { class: 't39p-grain', d: grainD }),
    s('path', { class: 't39p-knots', d: knots }),
    s('rect', { class: 't39p-floor-shade', x: -4, y: f1(vy), width: f1(BW + 8), height: f1(BH - vy + 4), fill: 'url(#t39p-floorg)' }),
    s('defs', null, s('linearGradient', { id: 't39p-floorg', x1: 0, y1: 0, x2: 1, y2: 0 },
      s('stop', { offset: 0, style: 'stop-color:var(--umbra);stop-opacity:.4' }),
      s('stop', { offset: 0.38, style: 'stop-color:var(--umbra);stop-opacity:0' }),
      s('stop', { offset: 0.62, style: 'stop-color:var(--umbra);stop-opacity:0' }),
      s('stop', { offset: 1, style: 'stop-color:var(--umbra);stop-opacity:.4' }))),
    // the veranda's front beam: its lit top edge, then the shaded face dropping to the moss
    s('rect', { class: 't39p-beam-face', x: -4, y: f1(vy - 1), width: f1(BW + 8), height: f1(Math.max(5, g.h * 0.014)) }),
    s('path', { class: 't39p-floor-lit', d: stroke([[BW * 0.04, vy - 0.5], [BW * 0.5, vy - 1.5], [BW * 0.96, vy - 0.5]], 2, 0.3, 0.3, 0.1) }),
    stillLife)
  M.job?.cancel()
  M.job = sliced(moss(), { sync: M.ctx.reduced || !M.first })
  M.first = false
  // the step pips on the gate's tie beam keep their state across a re-layout
  front.querySelectorAll('.t39p-pip').forEach((p, i) => p.classList.toggle('on', i < M!.placed))
  // where the rolled 30-day scroll lies: on the gate's threshold (component coords)
  const p2s = M.ctx.art.querySelector<HTMLElement>('.p2s')
  p2s?.style.setProperty('--t39p-sx', `${f1(g.w / 2)}px`)
  p2s?.style.setProperty('--t39p-sy', `${f1(hz - T0 + gateH * 0.06)}px`)
  p2s?.style.setProperty('--t39p-sw', `${f1(clamp(gateH * 0.66, 56, 100))}px`)
}

/** A roofed garden gate standing on (x, y), H tall, against the light: foot stones, posts up into the roof, the tie beam
 *  with the four step pips, the head beam under the eaves, the tiled roof resting on it, doors swung in, and its shadow
 *  running down the path toward the viewer. */
function gate(x: number, y: number, H: number) {
  const u = H / 10
  const X = (v: number) => f1(x + v * u), Y = (v: number) => f1(y - v * u)
  // four notches cut into the tie beam, inked vermilion as each week is set (their lower lip takes the light)
  const nw = Math.max(2.4, u * 0.28), nh = Math.max(3.2, u * 0.42)
  const pip = (i: number) => {
    const cx = x + (i - 1.5) * u * 1.05, cy = y - 7 * u
    return s('g', null,
      s('path', { class: 't39p-pip-lip', d: `M${f1(cx - nw / 2)} ${f1(cy + nh * 0.5)}L${f1(cx + nw / 2)} ${f1(cy + nh * 0.5)}L${f1(cx + nw * 0.3)} ${f1(cy + nh * 0.75)}L${f1(cx - nw * 0.3)} ${f1(cy + nh * 0.75)}Z` }),
      s('path', { class: 't39p-pip', d: `M${f1(cx - nw / 2)} ${f1(cy - nh * 0.5)}L${f1(cx + nw / 2)} ${f1(cy - nh * 0.5)}L${f1(cx + nw * 0.32)} ${f1(cy + nh * 0.5)}L${f1(cx - nw * 0.32)} ${f1(cy + nh * 0.5)}Z` }))
  }
  return s('g', { class: 't39p-gate' },
    s('path', { class: 't39p-gate-sh', d: `M${X(-2.9)} ${Y(0)}L${X(2.9)} ${Y(0)}L${X(5.5)} ${Y(-2.4)}L${X(-5.5)} ${Y(-2.4)}Z`, fill: 'url(#g39-shadowv)' }),
    s('path', { class: 't39p-door', d: `M${X(-2.35)} ${Y(0)}L${X(-3.5)} ${Y(0.5)}L${X(-3.5)} ${Y(6.3)}L${X(-2.35)} ${Y(6.6)}ZM${X(2.35)} ${Y(0)}L${X(3.5)} ${Y(0.5)}L${X(3.5)} ${Y(6.3)}L${X(2.35)} ${Y(6.6)}Z` }),
    // posts run from their foot stones up into the roof (no light between post and eave)
    s('path', { class: 't39p-beam', d: lines([[x - 2.6 * u, y, x - 2.6 * u, y - 8.3 * u], [x + 2.6 * u, y, x + 2.6 * u, y - 8.3 * u]], u * 0.62, 0.01, 0.01) + lines([[x - 3.4 * u, y - 7 * u, x + 3.4 * u, y - 7 * u]], u * 0.42, 0.04, 0.04), filter: 'url(#ink-rough)' }),
    s('path', { class: 't39p-beam', d: `M${X(-5.2)} ${Y(8.1)}L${X(5.2)} ${Y(8.1)}L${X(5)} ${Y(7.7)}L${X(-5)} ${Y(7.7)}Z` }),
    s('path', { class: 't39p-roof', d: `M${X(-5.4)} ${Y(8.45)}Q${X(-2)} ${Y(9.1)} ${X(0)} ${Y(10)}Q${X(2)} ${Y(9.1)} ${X(5.4)} ${Y(8.45)}Q${X(5.6)} ${Y(8.2)} ${X(5.3)} ${Y(8.02)}L${X(-5.3)} ${Y(8.02)}Q${X(-5.6)} ${Y(8.2)} ${X(-5.4)} ${Y(8.45)}Z`, filter: 'url(#ink-rough)' }),
    s('path', { class: 't39p-footstone', d: blob(x - 2.6 * u, y - u * 0.05, u * 0.75, u * 0.32, 71, 0.15, 10) + blob(x + 2.6 * u, y - u * 0.05, u * 0.75, u * 0.32, 72, 0.15, 10) }),
    ...[0, 1, 2, 3].map(pip),
    s('path', { class: 't39p-gate-rim', d: stroke([[x - 5.4 * u, y - 8.47 * u], [x - 2 * u, y - 9.12 * u], [x, y - 10.02 * u], [x + 2 * u, y - 9.12 * u], [x + 5.4 * u, y - 8.47 * u]], Math.max(1.2, u * 0.16), 0.2, 0.2, 0.2) + stroke([[x + 2.6 * u + u * 0.33, y - 0.2 * u], [x + 2.6 * u + u * 0.33, y - 7.8 * u]], Math.max(1, u * 0.12), 0.1, 0.1, 0.3) + stroke([[x - 2.6 * u - u * 0.33, y - 0.2 * u], [x - 2.6 * u - u * 0.33, y - 7.8 * u]], Math.max(1, u * 0.12), 0.1, 0.1, 0.3) }))
}

/** A low tray of dark wood standing on the boards at (x, y) (its front foot line), w wide, its sides running to the
 *  vanishing point vp like the boards: four short feet, a raised rim lit along its far edge by the sun behind, a tea bowl
 *  and a tea caddy on it; a contact shadow and a long one toward us. Still life: nothing to touch. */
function tray(x: number, y: number, w: number, vp: Pt) {
  const hgt = w * 0.075, foot = w * 0.05, d = w * 0.2
  const y0 = y - foot - hgt, yf = y0 - d
  const far = (px: number) => vp[0] + (px - vp[0]) * ((yf - vp[1]) / (y0 - vp[1]))
  const L = x - w / 2, R = x + w / 2
  const top: Pt[] = [[far(L), yf], [far(R), yf], [R, y0], [L, y0]]
  // the rim's inner edge, a little in from the outer one
  const ins = (p: Pt, q: Pt, t: number): Pt => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]
  const c: Pt = [(top[0][0] + top[2][0]) / 2, (top[0][1] + top[2][1]) / 2]
  const inner = top.map((p) => ins(p, c, 0.12))
  const front = `M${f1(L)} ${f1(y0)}L${f1(R)} ${f1(y0)}L${f1(R)} ${f1(y - foot)}L${f1(L)} ${f1(y - foot)}Z`
  const feet = [L + w * 0.05, R - w * 0.05 - w * 0.06].map((fx) => `M${f1(fx)} ${f1(y - foot - 1)}h${f1(w * 0.06)}v${f1(foot + 1)}h${f1(-w * 0.06)}Z`).join('')
  let grainD = ''
  for (let i = 1; i < 5; i++) {
    const t = i / 5
    grainD += stroke([ins(inner[3], inner[0], t), ins(inner[2], inner[1], t)], Math.max(0.6, w * 0.004), 0.3, 0.3, 0.2)
  }
  // the bowl: a cup from the side, its mouth an ellipse, left of the middle
  const bx = x - w * 0.14, by = y0 - d * 0.32, br = w * 0.1
  const bowl = `M${f1(bx - br)} ${f1(by - br * 0.6)}Q${f1(bx - br)} ${f1(by + br * 0.35)} ${f1(bx - br * 0.35)} ${f1(by + br * 0.42)}L${f1(bx + br * 0.35)} ${f1(by + br * 0.42)}Q${f1(bx + br)} ${f1(by + br * 0.35)} ${f1(bx + br)} ${f1(by - br * 0.6)}Z`
  // a tea caddy beside the bowl: a short lacquered cylinder with its lid
  const cx = x + w * 0.2, cy = y0 - d * 0.36, cr = br * 0.55, chh = br * 0.95
  const caddy = `M${f1(cx - cr)} ${f1(cy - chh)}L${f1(cx - cr)} ${f1(cy)}A${f1(cr)} ${f1(cr * 0.3)} 0 0 0 ${f1(cx + cr)} ${f1(cy)}L${f1(cx + cr)} ${f1(cy - chh)}Z`
  return s('g', { class: 't39p-tray', 'aria-hidden': 'true' },
    s('path', { class: 't39p-piece-sh', fill: 'url(#g39-shadowv)', d: `M${f1(L + 2)} ${f1(y - 1)}L${f1(R - 2)} ${f1(y - 1)}L${f1(R + w * 0.2)} ${f1(y + w * 0.45)}L${f1(L - w * 0.2)} ${f1(y + w * 0.45)}Z` }),
    s('ellipse', { class: 't39p-piece-contact', cx: f1(x), cy: f1(y), rx: f1(w * 0.52), ry: f1(Math.max(2.5, w * 0.025)) }),
    s('path', { class: 't39p-tray-wood', d: feet + front }),
    s('path', { class: 't39p-tray-rim', d: polyD(top) + 'Z' }),
    s('path', { class: 't39p-tray-top', d: polyD(inner) + 'Z' }),
    s('path', { class: 't39p-tray-grain', d: grainD }),
    s('path', { class: 't39p-gate-rim', d: stroke([top[0], top[1]], Math.max(1.2, w * 0.01), 0.1, 0.1, 0.2) }),
    s('path', { class: 't39p-tray-lip', d: stroke([[L, y0], [R, y0]], Math.max(1, w * 0.008), 0.1, 0.1, 0.2) }),
    s('ellipse', { class: 't39p-piece-contact', cx: f1(bx), cy: f1(by + br * 0.42), rx: f1(br * 0.75), ry: f1(br * 0.14) }),
    s('path', { class: 't39p-bowl', d: bowl }),
    s('ellipse', { class: 't39p-bowl-mouth', cx: f1(bx), cy: f1(by - br * 0.6), rx: f1(br), ry: f1(br * 0.24) }),
    s('path', { class: 't39p-gate-rim', d: stroke(curve([bx - br, by - br * 0.65], [bx, by - br * 0.95], [bx + br, by - br * 0.65], 10), Math.max(1, w * 0.007), 0.2, 0.2, 0.2) }),
    s('ellipse', { class: 't39p-piece-contact', cx: f1(cx), cy: f1(cy + 1), rx: f1(cr * 1.2), ry: f1(cr * 0.32) }),
    s('path', { class: 't39p-caddy', d: caddy }),
    s('ellipse', { class: 't39p-caddy-lid', cx: f1(cx), cy: f1(cy - chh), rx: f1(cr), ry: f1(cr * 0.3) }),
    s('path', { class: 't39p-cloth-fold', d: stroke([[cx - cr, cy - chh * 0.72], [cx + cr, cy - chh * 0.72]], Math.max(0.8, w * 0.005), 0.1, 0.1, 0.2) }),
    s('path', { class: 't39p-gate-rim', d: stroke(curve([cx - cr, cy - chh], [cx, cy - chh - cr * 0.42], [cx + cr, cy - chh], 8), Math.max(0.8, w * 0.006), 0.2, 0.2, 0.2) }))
}

/** The four week-stones are four different rocks: an outline each (u −1…1 across, v 0 foot … 1 crown, clockwise from
 *  the lower left), a size and a stone (granite slab, sandstone boulder, basalt with a sloped top, an upright of schist). */
const ROCKS: { o: number[][]; kw: number; kh: number }[] = [
  { kw: 1, kh: 0.84, o: [[-1, 0.04], [-0.99, 0.5], [-0.86, 0.86], [-0.42, 1], [0.3, 0.98], [0.8, 0.9], [0.98, 0.6], [0.97, 0.06], [0.4, -0.02], [-0.5, -0.02]] },
  { kw: 0.9, kh: 1, o: [[-0.94, 0.05], [-1, 0.42], [-0.8, 0.82], [-0.3, 1], [0.4, 0.96], [0.86, 0.72], [1, 0.32], [0.9, 0.03], [0, -0.03]] },
  { kw: 0.84, kh: 0.96, o: [[-1, 0.03], [-0.97, 0.66], [-0.66, 1], [0.15, 0.92], [0.76, 0.74], [1, 0.56], [0.98, 0.05], [0.2, -0.03]] },
  { kw: 0.74, kh: 1.14, o: [[-0.9, 0.03], [-1, 0.48], [-0.84, 0.9], [-0.36, 1], [0.32, 0.97], [0.78, 0.82], [0.97, 0.44], [0.86, 0.02], [0, -0.03]] },
]

/** points along a midpoint spline through pts (open), for brushed rims */
function spline(pts: Pt[]): Pt[] {
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const out: Pt[] = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) out.push(...curve(mid(pts[i - 1], pts[i]), pts[i], mid(pts[i], pts[i + 1]), 6).slice(i > 1 ? 1 : 0))
  out.push(pts[pts.length - 1])
  return out
}

/**
 * A week-stone against the light (box w × h; it rises above the box): its rock's silhouette, a crown band catching the sky,
 * the face in shade, the crown's edge burning with the low sun behind it, a crack with moss packed in it, moss at the
 * foot, a tight contact shadow on the boards and a long one running toward the viewer. On the face, the week's thing in
 * low relief (tea bowl, picture frame, scroll, wooden box) over its short name, cut faintly — no numeral.
 */
function stoneArt(w: number, hh: number, seed: number, i: number) {
  const r = rng(seed)
  const R = ROCKS[i] ?? ROCKS[0]
  const bx = w / 2, by = hh * 0.97, rx = w * 0.48 * R.kw, H = hh * 1.14 * R.kh
  const at = ([u, v]: number[]): Pt => [bx + u * rx, by - v * H]
  const out = R.o.map(at)
  const body = smoothD(out)
  // the crown: the outline's top edge and the same edge dropped by the crown's depth (a plane seen from a little above)
  const topIdx = R.o.map((p, j) => (p[1] >= 0.6 ? j : -1)).filter((j) => j >= 0)
  const edge = topIdx.map((j) => out[j])
  const cd = hh * 0.22
  const crownPts: Pt[] = [...edge, ...edge.slice().reverse().map(([x, y]): Pt => [bx + (x - bx) * 0.9, y + cd * (0.75 + 0.5 * (1 - Math.abs(x - bx) / rx))])]
  const crown = smoothD(crownPts)
  const rimLine = spline(edge)
  // a crack down the face from the crown, moss packed in it and along the foot, a little on the crown's back
  const cu = 0.58 + r() * 0.16
  const [kx, ky] = at([cu, 0.78])
  const crack: Pt[] = [[kx, ky], [kx - rx * 0.06, by - H * 0.45], [kx + rx * 0.03, by - H * 0.12]]
  let moss = ''
  for (const t of [0.05, 0.62, 0.95]) moss += blob(kx - rx * 0.04 * t, ky + (by - H * 0.12 - ky) * t, 1.5 + r() * 2, 1.6 + r() * 2, seed + Math.round(t * 9), 0.35, 8)
  for (let j = 0; j < 8; j++) moss += blob(bx + rx * (-0.95 + r() * 1.5), by - H * (0.01 + r() * 0.1), 2 + r() * 4.5, 1.3 + r() * 2.2, seed + 20 + j, 0.3, 8)
  for (let j = 0; j < 4; j++) {
    const [ex, ey] = edge[Math.floor(r() * edge.length)]
    moss += blob(ex + (bx - ex) * 0.2, ey + cd * 0.35, 2 + r() * 3, 1 + r() * 1.4, seed + 40 + j, 0.3, 8)
  }
  let pits = ''
  for (let j = 0; j < 10; j++) {
    const x = bx + (r() - 0.5) * rx * 1.6, y = by - H * (0.08 + r() * 0.5)
    pits += stroke([[x, y], [x + 2 + r() * 4, y + (r() - 0.5) * 2]], 0.9, 0.3, 0.3, 0.3)
  }
  // the relief over its name, left of the crack
  const name = P.shorts?.[i] ?? ''
  const nx = bx + rx * (cu - 0.92) / 2 - rx * 0.06
  const room = (kx - 7 - (bx - rx * 0.9)) * 0.98
  const fs = clamp(room / Math.max(1, name.length * 0.53), 8, 12.5)
  const fr = clamp(H * 0.16, 7, 12)
  const ox = nx, oy = by - H * 0.24 - fs - fr * 0.9
  const ny = by - H * 0.17
  const thing = relief(i, ox, oy, fr)
  return s('g', { class: `t39p-piece t39p-st${i}` },
    // the long shadow toward the viewer, widening as it comes
    s('path', { class: 't39p-piece-sh', fill: 'url(#g39-shadowv)', d: `M${f1(bx - rx * 0.86)} ${f1(by - 2)}Q${f1(bx - rx * 1.1)} ${f1(by + hh * 0.5)} ${f1(bx - rx * 1.32)} ${f1(by + hh * 1.05)}L${f1(bx + rx * 1.32)} ${f1(by + hh * 1.05)}Q${f1(bx + rx * 1.1)} ${f1(by + hh * 0.5)} ${f1(bx + rx * 0.86)} ${f1(by - 2)}Z` }),
    s('ellipse', { class: 't39p-piece-contact', cx: f1(bx), cy: f1(by - 1), rx: f1(rx * 1.03), ry: f1(Math.max(3, hh * 0.07)) }),
    s('path', { class: 't39p-piece-glow', d: stroke(rimLine, Math.max(5, hh * 0.18), 0.2, 0.2, 0.2), filter: 'url(#g39-glow)' }),
    s('path', { class: 't39p-piece-body', d: body, filter: 'url(#ink-rough)' }),
    s('path', { class: 't39p-piece-foot', d: blob(bx, by - H * 0.08, rx * 0.95, H * 0.12, seed + 3, 0.1, 14) }),
    s('path', { class: 't39p-piece-top', d: crown }),
    s('path', { class: 't39p-piece-lip', d: stroke(crownPts.slice(edge.length), Math.max(1, hh * 0.022), 0.2, 0.2, 0.2) }),
    s('path', { class: 't39p-piece-pits', d: pits }),
    s('path', { class: 't39p-piece-crack', d: stroke(crack, Math.max(1.2, rx * 0.022), 0.2, 0.4, 0.2) }),
    s('path', { class: 't39p-piece-moss', d: moss }),
    // the rim: the crown's back edge catching the sun, running a little down each shoulder
    s('path', { class: 't39p-piece-rim', d: stroke(rimLine, Math.max(2, hh * 0.055), 0.15, 0.15, 0.1) }),
    s('path', { class: 't39p-relief-sh', d: thing, transform: 'translate(0 1.3)' }),
    s('path', { class: 't39p-relief-lit', d: thing, transform: 'translate(0 -0.9)' }),
    s('path', { class: 't39p-relief', d: thing, 'fill-rule': 'evenodd' }),
    s('path', { class: 't39p-relief-cut', d: reliefCut(i, ox, oy, fr) }),
    name ? s('text', { class: 't39p-name-lip', x: f1(nx), y: f1(ny + 0.8), 'font-size': f1(fs), 'text-anchor': 'middle' }, name) : '',
    name ? s('text', { class: 't39p-name', x: f1(nx), y: f1(ny), 'font-size': f1(fs), 'text-anchor': 'middle' }, name) : '')
}

/** The thing in relief on week i's stone, centred on (x, y), about 2r across: a tea bowl, a picture frame, a scroll, a box. */
function relief(i: number, x: number, y: number, r: number): string {
  const R = (a: number, b: number, w: number, hgt: number) => `M${f1(x + a * r)} ${f1(y + b * r)}h${f1(w * r)}v${f1(hgt * r)}h${f1(-w * r)}Z`
  if (i === 0) return `M${f1(x - r)} ${f1(y - r * 0.3)}Q${f1(x - r * 0.98)} ${f1(y + r * 0.72)} ${f1(x - r * 0.3)} ${f1(y + r * 0.78)}L${f1(x + r * 0.3)} ${f1(y + r * 0.78)}Q${f1(x + r * 0.98)} ${f1(y + r * 0.72)} ${f1(x + r)} ${f1(y - r * 0.3)}Z` + R(-0.36, 0.76, 0.72, 0.2)
  if (i === 1) return R(-1, -0.8, 2, 1.6) + R(-0.72, -0.52, 1.44, 1.04)
  if (i === 2) return R(-1, -0.42, 2, 0.84) + `M${f1(x - r * 1.18)} ${f1(y - r * 0.55)}h${f1(r * 0.24)}v${f1(r * 1.1)}h${f1(-r * 0.24)}Z` + `M${f1(x + r * 0.94)} ${f1(y - r * 0.55)}h${f1(r * 0.24)}v${f1(r * 1.1)}h${f1(-r * 0.24)}Z`
  return R(-1.08, -0.62, 2.16, 0.36) + R(-0.96, -0.26, 1.92, 1.08)
}
/** The lines cut into the relief: the bowl's mouth, the picture, the scroll's tie, the box's cord. */
function reliefCut(i: number, x: number, y: number, r: number): string {
  const lw = Math.max(0.9, r * 0.12)
  if (i === 0) return blob(x, y - r * 0.3, r * 0.9, r * 0.2, 5, 0.05, 14)
  if (i === 1) return stroke([[x - r * 0.6, y + r * 0.42], [x - r * 0.15, y - r * 0.12], [x + r * 0.12, y + r * 0.18], [x + r * 0.6, y - r * 0.28]], lw, 0.1, 0.1, 0.4)
  if (i === 2) return stroke([[x - r * 0.1, y - r * 0.42], [x - r * 0.1, y + r * 0.42]], lw, 0.1, 0.1, 0.3) + stroke([[x - r * 0.62, y - r * 0.05], [x + r * 0.55, y - r * 0.05]], lw * 0.6, 0.2, 0.2, 0.3)
  return stroke([[x, y - r * 0.62], [x, y + r * 0.82]], lw, 0.1, 0.1, 0.3) + stroke([[x - r * 0.96, y + r * 0.25], [x + r * 0.96, y + r * 0.25]], lw * 0.8, 0.1, 0.1, 0.3)
}

/**
 * The station's own guide over the component (audit 39-3): keys 1–4 take week 1–4 (the component's digits follow the
 * shuffled pile, so they are caught first); a dot on every loose stone; the next hollow breathes; the prompt counts the
 * hollows and says, when a stone is set too early, which stone it needs under it; the placed week's name and why sit
 * next to its stone; standing still, the right stone leans toward its hollow; at the end the rolled scroll at the gate
 * carries the dot and opens in the right column.
 */
function guideWeeks(ctx: SceneCtx) {
  const steps = P.steps.steps
  const n = steps.length
  const root = ctx.art.querySelector<HTMLElement>('.p2s')!
  const note = root.querySelector<HTMLElement>('.p2s-note')!
  const stones = [...root.querySelectorAll<HTMLButtonElement>('.p2s-stone')]
  const weekOf = (el: Element) => steps.findIndex((x) => x.label === el.querySelector('.p2s-label')?.textContent)
  const stoneOf = (w: number) => stones.find((el) => weekOf(el) === w)
  const keysNote = root.querySelector('p.visually-hidden[id]')
  if (keysNote) keysNote.textContent = P.keys
  const g = guide(ctx)
  // one vermilion dot at a time: on the stone for the next hollow (the others only breathe a faint ink ring)
  let stoneDot: Mark | null = null
  const pointStone = () => {
    stoneDot?.done()
    const el = (M?.placed ?? 0) < n ? stoneOf(M?.placed ?? 0) : undefined
    stoneDot = el ? g.dot(el, { dir: [0, -1] }) : null
  }
  pointStone()
  // the next hollow: a breathing ring where its stone will sit, sized to that depth
  const holeAt = (): Drop => {
    const k = M?.placed ?? 0
    const s0 = M?.depth[k] ?? 1, [w, hh] = M?.size ?? [120, 44]
    return g.drop(() => {
      const c = M?.centers[M.placed] ?? [0, 0]
      return [c[0] + root.offsetLeft, c[1] + root.offsetTop + hh * (M?.depth[M.placed] ?? 1) * 0.36]
    }, { w: Math.max(56, w * s0 * 1.05), h: Math.max(26, w * s0 * 0.32) })
  }
  let hole: Drop | null = holeAt()
  // the placed week: its full name and why it comes now, beside its stone (≤ 2 lines; the long how-to is in its card)
  const placeNote = (k: number) => {
    if (!M || !M.centers[k]) return
    const [cx, cy] = M.centers[k]
    const half = (M.size[0] * M.depth[k]) / 2
    const W = root.clientWidth
    note.classList.add('t39p-note')
    if (M.wide) {
      const w = Math.min(470, W * 0.34)
      const right = cx + half + 28
      const x = right + w <= W - 8 ? right : cx - half - 28 - w
      Object.assign(note.style, { left: `${f1(x)}px`, top: `${f1(cy - 26)}px`, width: `${f1(w)}px`, textAlign: x > cx ? 'left' : 'right' })
    } else {
      // on the veranda boards, just under its front beam (the loose stones lie lower)
      Object.assign(note.style, { left: '0px', width: `${f1(W)}px`, top: `${f1(M.gh * 0.665 + 8)}px`, textAlign: 'center' })
    }
  }
  M!.onPlace = (k) => {
    const el = root.querySelector('.p2s-stone.placed:not([data-guided])')
    if (el) (el as HTMLElement).dataset.guided = ''
    pointStone()
    // (a phone keeps it to the week's name: two lines at most)
    note.replaceChildren(h('b', null, steps[k].label), M?.wide ? h('span', null, steps[k].why) : '')
    placeNote(k)
    hole?.done()
    hole = null
    const placed = M?.placed ?? n
    if (placed < n) {
      ctx.prompt(fill(P.next, { n: placed + 1, total: n }))
      hole = holeAt()
      g.refresh()
      return
    }
    // the component builds its sheet right after this: the folded card becomes the scroll at the gate
    setTimeout(() => {
      const slip = root.querySelector<HTMLElement>('.p2s-sheet .p2k-slip')
      if (!slip) return
      slip.setAttribute('aria-label', P.done)
      const t = window.setTimeout(() => {
        const dot = g.dot(slip, { dir: [0, -1] })
        slip.addEventListener('click', () => dot.done(), { once: true })
      }, ctx.reduced || ctx.quality === 'low' ? 0 : 3400)
      ctx.onCleanup(() => clearTimeout(t))
    })
  }
  // a wrong try: the component writes its own line; the prompt says instead which stone this one needs under it (H6)
  let last: Element | null = null
  const touch = (e: Event) => (last = (e.target as Element).closest?.('.p2s-stone') ?? last)
  root.addEventListener('pointerdown', touch, true)
  root.addEventListener('click', touch, true)
  const mo = new MutationObserver(() => {
    if (!note.classList.contains('wrong') || !note.textContent) return
    const w = last ? weekOf(last) : -1
    ctx.prompt(w > 0 ? fill(P.wrong, { prev: steps[w - 1].label }) : P.wrongFirst, 'wrong')
    note.textContent = '' // one text block: the prompt carries it
  })
  mo.observe(note, { attributes: true, childList: true, characterData: true, subtree: true })
  ctx.onCleanup(() => mo.disconnect())
  // 1–4 = week 1–4, whatever order the stones lie in (document runs before the component's window listener)
  const keys = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey || !/^[1-9]$/.test(e.key)) return
    const el = stoneOf(Number(e.key) - 1)
    if (!el) return
    e.preventDefault()
    last = el
    if (!el.classList.contains('placed')) el.click()
  }
  document.addEventListener('keydown', keys)
  ctx.onCleanup(() => document.removeEventListener('keydown', keys))
  // H7: the stone that comes next leans 6 px toward its hollow
  const invite = () => {
    const k = M?.placed ?? n
    const el = k < n ? stoneOf(k) : null
    const c = M?.centers[k]
    if (!el || !c || ctx.reduced) return
    const r = el.getBoundingClientRect(), b = root.getBoundingClientRect()
    const dx = c[0] - (r.left - b.left + r.width / 2), dy = c[1] - (r.top - b.top + r.height / 2), d = Math.hypot(dx, dy) || 1
    el.animate([{ translate: '0 0' }, { translate: `${f1((dx / d) * 6)}px ${f1((dy / d) * 6)}px` }, { translate: '0 0' }], { duration: 1200, easing: 'ease-in-out', composite: 'add' })
  }
  ctx.el.addEventListener('p2:idle', invite)
  ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', invite))
}
