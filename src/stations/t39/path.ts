import './path.css'
import { h, s } from '../../core/dom'
import { sliced } from '../../core/chunk'
import { blob, clamp, curve, rng, stroke, type Pt } from '../../ui/part2/ink'
import { stepPath, type SlotGeo } from '../../ui/part2/steps'
import { pine } from '../../ui/part2/paint'
import type { SceneCtx, SceneDef } from '../types'
import { C } from './shell'
import { crescent, dawnGlow, f1, fog, g39Defs, lines, mossBed, polyD } from './g39'

const P = C.scenes.path

/** Per mount: the backdrop and the path's geometry (only one scene lives at a time). */
let M: { ctx: SceneCtx; back: HTMLElement; sky: SVGSVGElement; land: SVGSVGElement; sun: HTMLElement; centers: Pt[]; depth: number[]; size: Pt; placed: number; job: { cancel(): void } | null; first: boolean } | null = null

/**
 * Scene 3 — thirty days as four week-stones (stepPath, 1PT backlit). From the veranda step, eye level: a moss slope climbs
 * to a garden gate on the horizon with the sun just below it; four hollows wait along the path, each farther one higher
 * and smaller. The loose stones lie big on the veranda floor. Set one in its hollow (drag, tap, or 1–4): it shrinks into
 * the distance. All four: the sun clears the gate and a ray runs down the path waking each stone. The component keeps the
 * logic, keys, drag and the take-away cards; this station paints the land and sets each stone's depth.
 */
const def = stepPath(P.steps, {
  label: P.label, prompt: P.prompt, insight: P.insight, cards: P.weekCards,
  art: () => [],
  slots: (g) => {
    const wide = g.row
    const ys = wide ? [0.66, 0.54, 0.455, 0.398] : [0.6, 0.475, 0.375, 0.302]
    const xs = wide ? [-0.05, 0.045, -0.025, 0.012] : [-0.06, 0.07, -0.04, 0.02]
    const centers = ys.map((y, k) => [g.w / 2 + xs[k] * g.w, y * g.h] as Pt)
    if (M) {
      M.centers = centers
      M.depth = wide ? [1, 0.74, 0.56, 0.43] : [1, 0.78, 0.6, 0.47]
      M.size = g.size
      paint(g)
      // stones already set keep their depth after a resize
      M.ctx.art.querySelectorAll<HTMLElement>('.p2s-stone.placed').forEach((el) => sink(el, Number(el.querySelector('.p2s-key')?.textContent) - 1))
    }
    return centers
  },
  pile: (g) => {
    if (g.row) {
      const y = g.h * 0.875
      const step = g.size[0] + 22
      return [0, 1, 2, 3].map((k) => [g.w / 2 + (k - 1.5) * step, y + (k % 2 ? 6 : -4)] as Pt)
    }
    const y = g.h * 0.8
    return [0, 1, 2, 3].map((k) => [g.w / 2 + (k % 2 ? 1 : -1) * (g.size[0] / 2 + 6), y + Math.floor(k / 2) * (g.size[1] + 12)] as Pt)
  },
  piece: (i, { w, h: hh, seed }) => stoneArt(w, hh, seed + i, i + 1),
  onPlace: (k) => {
    if (!M) return
    const el = [...M.ctx.art.querySelectorAll<HTMLElement>('.p2s-stone.placed')].find((x) => x.querySelector('.p2s-key')?.textContent === String(k + 1))
    if (el) sink(el, k)
    M.placed++
    if (M.placed >= 4) M.back.classList.add('is-lit')
  },
})

/** A set stone recedes to its hollow's depth: scaled about its centre, the shift the scale makes undone by `translate`. */
function sink(el: HTMLElement, k: number) {
  if (!M || !M.centers[k]) return
  const s0 = M.depth[k]
  const [cx, cy] = M.centers[k]
  const [ox, oy] = [M.size[0] / 2, M.size[1] / 2]
  el.style.setProperty('--k', String(k))
  el.style.setProperty('--s', String(s0))
  el.style.scale = String(s0)
  el.style.translate = `${f1((cx - ox) * (1 - s0))}px ${f1((cy - oy) * (1 - s0))}px`
}

export const pathScene: SceneDef = {
  label: def.label,
  mount(ctx) {
    g39Defs()
    const sky = s('svg', { class: 't39p-sky', 'aria-hidden': 'true' })
    const sun = h('i', { class: 't39p-sun', 'aria-hidden': 'true' })
    const land = s('svg', { class: 't39p-land', 'aria-hidden': 'true' })
    const back = h('div', { class: `t39p${ctx.reduced || ctx.quality === 'low' ? ' is-still' : ''}`, 'aria-hidden': 'true' }, sky, sun, land)
    ctx.art.append(back, h('p', { class: 'visually-hidden' }, P.art))
    M = { ctx, back, sky, land, sun, centers: [], depth: [], size: [0, 0], placed: 0, job: null, first: true }
    const out = def.mount(ctx)
    ctx.art.querySelector('.p2s')?.classList.add('t39p-steps')
    // the 30-day sheet is a scroll hung from the gate: its close rolls it up there (and a touch unrolls it again)
    const roll = (e: Event) => {
      const sheet = ctx.art.querySelector<HTMLElement>('.t39p-steps .p2s-sheet')
      if (!sheet || !sheet.contains(e.target as Node)) return
      const btn = (e.target as Element).closest('.p2s-close')
      const rolled = sheet.classList.contains('is-rolled')
      if (!btn && !rolled) return
      e.stopPropagation()
      e.preventDefault()
      sheet.classList.toggle('is-rolled', !rolled)
      sheet.querySelector('.p2s-close')?.setAttribute('aria-expanded', String(rolled))
      for (const c of sheet.children) if (!c.classList.contains('p2s-close')) (c as HTMLElement).inert = !rolled
    }
    ctx.art.addEventListener('click', roll, true)
    ctx.onCleanup(() => {
      ctx.art.removeEventListener('click', roll, true)
      if (M?.back === back) (M.job?.cancel(), (M = null))
    })
    return out
  },
}

/** The land behind the path, in the full-bleed backdrop (offset from the component's own box by the page gutter). */
function paint(g: SlotGeo) {
  if (!M) return
  const { back, sky, land, sun, centers, depth, size } = M
  const BW = back.clientWidth, BH = back.clientHeight
  const ox = (BW - g.w) / 2
  const T0 = Math.max(0, BH - M.ctx.art.clientHeight - 24)
  const X = (x: number) => x + ox, Y = (y: number) => y + T0
  const wide = g.row
  const r = rng(3950)
  const hz = Y(g.h * (wide ? 0.34 : 0.17))
  const gx = X(g.w / 2)
  const gateH = g.h * (wide ? 0.2 : 0.13)
  const sunR = clamp(gateH * 0.32, 12, 40)
  for (const el of [sky, land]) el.setAttribute('viewBox', `0 0 ${f1(BW)} ${f1(BH)}`)
  // the sky: dawn rising behind the gate, the thin moon high on the left
  sky.replaceChildren(
    s('rect', { class: 'g39-skyfill', x: -2, y: -2, width: f1(BW + 4), height: f1(hz + 4), fill: 'url(#g39-sky)' }),
    s('rect', { class: 'g39-skydawn', x: -2, y: f1(hz * 0.15), width: f1(BW + 4), height: f1(hz * 0.85 + 2), fill: 'url(#g39-dawnv)' }),
    dawnGlow(gx, hz, BW * 0.5, hz * 0.95, 3),
    crescent(X(g.w * (wide ? 0.12 : 0.14)), Y(g.h * (wide ? 0.08 : 0.04)) + 16, clamp(g.h * 0.022, 8, 15), 0.62, 160))
  Object.assign(sun.style, { left: `${f1(gx - sunR * 7)}px`, top: `${f1(hz + sunR * 0.5 - sunR * 7)}px`, width: `${f1(sunR * 14)}px`, height: `${f1(sunR * 14)}px` })
  sun.style.setProperty('--lift', `${f1(-gateH * 1.05)}px`)
  sun.style.setProperty('--r', `${f1(sunR)}px`)

  // the path's centre line, from under the veranda to the gate's foot; its width shrinks hard with distance
  const depthAt = (y: number) => clamp((y - hz) / (Y(g.h) - hz), 0, 1.2)
  const pts: Pt[] = [[gx, Y(g.h) + 40], ...centers.map(([x, y]) => [X(x), Y(y)] as Pt), [gx, hz + 3]]
  const line: Pt[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]
    line.push(...curve(a, [(a[0] + b[0]) / 2 + (i % 2 ? 1 : -1) * BW * 0.012, (a[1] + b[1]) / 2], b, 10).slice(i ? 1 : 0))
  }
  const half = (y: number) => BW * (0.006 + 0.26 * Math.pow(depthAt(y), 1.45))
  const L: Pt[] = line.map(([x, y]) => [x - half(y), y]), R: Pt[] = line.map(([x, y]) => [x + half(y), y])
  const road = polyD([...L, ...R.reverse()]) + 'Z'
  // gravel on the path, larger near
  let gravel = ''
  for (let i = 0; i < 360; i++) {
    const t = Math.pow(r(), 0.7)
    const k = Math.min(line.length - 1, Math.floor(t * (line.length - 1)))
    const [x, y] = line[line.length - 1 - k]
    const dd = depthAt(y)
    const rr = 0.6 + dd * 4.4
    gravel += blob(x + (r() - 0.5) * 2 * half(y) * 0.9, y + (r() - 0.5) * 6 * dd, rr, rr * 0.55, i, 0.2, 7)
  }
  // the moss: tufts in three tones, small and dense far off, big near; each lit along its top edge by the sun behind
  // (built in slices after the land is up: the heaviest part of the painting)
  const mossG = s('g', { class: 't39p-mossg' })
  const gy = Y(g.h)
  function* moss(): Generator {
    const q0 = rng(3959)
    let mossDk = '', mossMd = '', mossHi = ''
    for (let i = 0; i < 1000; i++) {
      const y = hz + Math.pow(q0(), 1.5) * (gy - hz) * 1.05
      const x = q0() * BW
      const dd = depthAt(y)
      const len = 2 + dd * 24
      const tuft = stroke([[x, y], [x + len * 0.5, y - 0.5 - dd * 2.2], [x + len, y]], 0.7 + dd * 3.6, 0.3, 0.3, 0.2)
      if (q0() < 0.45) mossDk += tuft
      else mossMd += tuft
      if (q0() < 0.5) mossHi += stroke([[x + len * 0.15, y - 0.8 - dd * 2.3], [x + len * 0.5, y - 1 - dd * 2.8], [x + len * 0.85, y - 0.8 - dd * 2.3]], 0.4 + dd * 1.1, 0.3, 0.3, 0.2)
      if (i % 120 === 119) yield
    }
    mossG.replaceChildren(
      s('path', { class: 't39p-moss t39p-moss-dk', d: mossDk }),
      s('path', { class: 't39p-moss t39p-moss-md', d: mossMd }),
      s('path', { class: 't39p-moss-hi', d: mossHi }))
  }
  // the slope: a moss field rising to the gate; its far edge melts into the light (no hard horizon)
  const field = `M-4 ${f1(hz + 14)}Q${f1(BW * 0.25)} ${f1(hz + 6)} ${f1(gx)} ${f1(hz)}Q${f1(BW * 0.75)} ${f1(hz + 8)} ${f1(BW + 4)} ${f1(hz + 18)}L${f1(BW + 4)} ${f1(BH + 4)}L-4 ${f1(BH + 4)}Z`
  const fieldG = s('linearGradient', { id: 't39p-fieldg', x1: 0, y1: f1(hz), x2: 0, y2: f1(BH), gradientUnits: 'userSpaceOnUse' },
    s('stop', { offset: 0, style: 'stop-color:var(--t39p-far)' }),
    s('stop', { offset: 0.3, style: 'stop-color:var(--t39p-mid)' }),
    s('stop', { offset: 1, style: 'stop-color:var(--t39p-near)' }))
  // mist lying in the hollows of the slope, and the glare of the low sun along the crest
  const mists = [[0.24, 0.42, 0.22], [0.78, 0.36, 0.2], [0.5, 0.22, 0.36], [0.12, 0.62, 0.16]].map(([fx, fy, fw]) =>
    fog(BW * fx, hz + (Y(g.h) - hz) * fy * (wide ? 0.62 : 0.55), BW * fw, (Y(g.h) - hz) * 0.05, 'g39-fog t39p-mist'))
  // the hollows: dark where a stone will sit, their far lips lit by the sun behind
  const hollows = centers.map(([x, y], k) => {
    const rx = size[0] * depth[k] * 0.55, ry = rx * (wide ? 0.26 : 0.3)
    const cx = X(x), cy = Y(y) + size[1] * depth[k] * 0.22
    return s('g', { class: 't39p-hollow' },
      s('ellipse', { class: 't39p-hollow-in', cx: f1(cx), cy: f1(cy), rx: f1(rx), ry: f1(ry) }),
      s('path', { class: 't39p-hollow-lip', d: stroke(curve([cx - rx * 0.92, cy - ry * 0.2], [cx, cy - ry * 1.35], [cx + rx * 0.92, cy - ry * 0.2], 12), Math.max(1.2, ry * 0.22), 0.25, 0.25, 0.1) }))
  })
  // the ray of the first sun: runs down the path from the gate, one stretch after another
  const rays = pts.slice(0).reverse().slice(0, -1).map((a, i, arr) => {
    const b = i + 1 < arr.length ? arr[i + 1] : pts[0]
    const wa = half(a[1]) * 0.42, wb = half(b[1]) * 0.42
    return s('path', { class: 't39p-ray', style: `--k:${i}`, d: `M${f1(a[0] - wa)} ${f1(a[1])}L${f1(a[0] + wa)} ${f1(a[1])}L${f1(b[0] + wb)} ${f1(b[1])}L${f1(b[0] - wb)} ${f1(b[1])}Z` })
  })
  // the veranda the camera stands on: boards running toward the gate (one-point perspective, they meet at the sun),
  // their seams and grain, the sunlit lip at the edge and the warm wedge of the ray across them
  const vy = Y(g.h * (wide ? 0.8 : 0.74))
  const toVP = (xb: number, y: number) => gx + (xb - gx) * ((y - hz) / (BH - hz))
  let seams = '', grainD = ''
  const nb = wide ? 16 : 9, bwid = (BW * 1.5) / (nb * 2)
  for (let i = -nb; i <= nb; i++) {
    const xb = gx + (i + 0.5) * bwid
    seams += `M${f1(toVP(xb, vy))} ${f1(vy)}L${f1(xb)} ${f1(BH)}`
    for (let k = 0; k < 3; k++) {
      const gxb = xb + bwid * (0.2 + r() * 0.6), y0 = vy + (BH - vy) * r() * 0.8, y1 = Math.min(BH, y0 + (BH - vy) * (0.15 + r() * 0.3))
      grainD += stroke([[toVP(gxb, y0), y0], [toVP(gxb, y1), y1]], 0.6 + ((y0 - vy) / (BH - vy)) * 1.2, 0.3, 0.3, 0.2)
    }
  }
  const rayFloor = `M${f1(gx - BW * 0.012)} ${f1(vy)}L${f1(gx + BW * 0.012)} ${f1(vy)}L${f1(gx + BW * 0.11)} ${f1(BH)}L${f1(gx - BW * 0.11)} ${f1(BH)}Z`
  // the two pines at either side: not twins — one tall and leaning in, one low and spreading — their needles rimmed by
  // the sun behind (a lit copy set just toward the light, under the dark one)
  const rimPine = (pg: SVGGElement, dx: number) => {
    const c = pg.cloneNode(true) as SVGGElement
    c.setAttribute('class', 't39p-pine-rim')
    c.setAttribute('transform', `translate(${f1(dx)} -2.6)`)
    return s('g', null, c, pg)
  }
  const p1 = pine(X(g.w * (wide ? 0.13 : 0.04)), Y(g.h * (wide ? 0.52 : 0.36)), g.h * (wide ? 0.34 : 0.24), 3951, 1)
  const p2 = pine(0, 0, g.h * (wide ? 0.19 : 0.15), 3958, -1)
  p2.setAttribute('transform', `translate(${f1(X(g.w * (wide ? 0.87 : 0.99)))} ${f1(Y(g.h * (wide ? 0.46 : 0.31)))}) scale(1.35 0.9)`)
  land.replaceChildren(
    s('defs', null, fieldG),
    s('path', { class: 't39p-hills', d: `M-4 ${f1(hz + 2)}L${f1(BW * 0.08)} ${f1(hz - g.h * 0.05)}L${f1(BW * 0.2)} ${f1(hz - g.h * 0.02)}L${f1(BW * 0.32)} ${f1(hz - g.h * 0.075)}L${f1(BW * 0.42)} ${f1(hz - g.h * 0.01)}L${f1(BW * 0.6)} ${f1(hz - g.h * 0.03)}L${f1(BW * 0.72)} ${f1(hz - g.h * 0.08)}L${f1(BW * 0.86)} ${f1(hz - g.h * 0.02)}L${f1(BW + 4)} ${f1(hz - g.h * 0.06)}L${f1(BW + 4)} ${f1(hz + 6)}Z`, filter: 'url(#ink-wash)' }),
    s('path', { class: 't39p-field', d: field, fill: 'url(#t39p-fieldg)' }),
    mossG,
    ...mists,
    // the crest: the field's far edge dissolves in the glare and the morning haze
    fog(gx, hz + 4, BW * 0.8, Math.max(18, g.h * 0.075)),
    fog(gx, hz + g.h * 0.05, BW * 0.7, Math.max(12, g.h * 0.05)),
    s('ellipse', { class: 't39p-glare', cx: f1(gx), cy: f1(hz + 2), rx: f1(BW * 0.4), ry: f1(Math.max(10, g.h * 0.03)), fill: 'url(#g39-sun)' }),
    rimPine(p1, 3.4),
    rimPine(p2, -3.4),
    mossBed(X(g.w * 0.22), Y(g.h * 0.6), g.w * 0.12, g.h * 0.03, 3953),
    mossBed(X(g.w * 0.8), Y(g.h * 0.55), g.w * 0.1, g.h * 0.025, 3954),
    s('path', { class: 't39p-road', d: road }),
    s('path', { class: 't39p-gravel', d: gravel }),
    s('path', { class: 't39p-road-lit', d: stroke(line.slice(0, Math.round(line.length * 0.98)).reverse(), half(hz) * 0.6 + 1, 0.02, 0.8, 0.05) }),
    ...hollows,
    s('g', { class: 't39p-rays' }, ...rays),
    gate(gx, hz + 3, gateH),
    s('rect', { class: 't39p-floor', x: -4, y: f1(vy), width: f1(BW + 8), height: f1(BH - vy + 4) }),
    s('path', { class: 't39p-floor-ray', d: rayFloor }),
    s('path', { class: 't39p-planks', d: seams }),
    s('path', { class: 't39p-grain', d: grainD }),
    s('rect', { class: 't39p-floor-shade', x: -4, y: f1(vy), width: f1(BW + 8), height: f1(BH - vy + 4), fill: 'url(#t39p-floorg)' }),
    s('defs', null, s('linearGradient', { id: 't39p-floorg', x1: 0, y1: 0, x2: 1, y2: 0 },
      s('stop', { offset: 0, style: 'stop-color:var(--umbra);stop-opacity:.35' }),
      s('stop', { offset: 0.4, style: 'stop-color:var(--umbra);stop-opacity:0' }),
      s('stop', { offset: 0.6, style: 'stop-color:var(--umbra);stop-opacity:0' }),
      s('stop', { offset: 1, style: 'stop-color:var(--umbra);stop-opacity:.35' }))),
    s('path', { class: 't39p-floor-edge', d: stroke([[-4, vy + 1], [BW / 2, vy], [BW + 4, vy + 1]], 3, 0.02, 0.02, 0.8) }),
    s('path', { class: 't39p-floor-lit', d: stroke([[BW * 0.12, vy + 3.5], [BW * 0.5, vy + 2.5], [BW * 0.88, vy + 3.5]], 2.2, 0.3, 0.3, 0.1) }))
  M.job?.cancel()
  M.job = sliced(moss(), { sync: M.ctx.reduced || !M.first })
  M.first = false
  // where the scroll hangs: from the gate's beam down toward the veranda (component coords)
  const p2s = M.ctx.art.querySelector<HTMLElement>('.p2s')
  p2s?.style.setProperty('--t39p-top', `${f1(hz - gateH * 0.82 - T0)}px`)
  p2s?.style.setProperty('--t39p-max', `${f1((wide ? vy - 14 : Y(g.h * 0.5)) - (hz - gateH * 0.82))}px`)
}

/** A roofed garden gate standing on (x, y), H tall, against the light: posts, tie beams, the tiled roof, doors swung in. */
function gate(x: number, y: number, H: number) {
  const u = H / 10
  const X = (v: number) => f1(x + v * u), Y = (v: number) => f1(y - v * u)
  return s('g', { class: 't39p-gate' },
    s('ellipse', { class: 't39p-gate-sh', cx: X(0), cy: Y(-0.2), rx: f1(u * 6), ry: f1(u * 0.7) }),
    s('path', { class: 't39p-door', d: `M${X(-2.6)} ${Y(0)}L${X(-3.9)} ${Y(0.5)}L${X(-3.9)} ${Y(6.5)}L${X(-2.6)} ${Y(6.9)}ZM${X(2.6)} ${Y(0)}L${X(3.9)} ${Y(0.5)}L${X(3.9)} ${Y(6.5)}L${X(2.6)} ${Y(6.9)}Z` }),
    s('path', { class: 't39p-roof', d: `M${X(-4.8)} ${Y(8.3)}Q${X(-2)} ${Y(9.1)} ${X(0)} ${Y(10)}Q${X(2)} ${Y(9.1)} ${X(4.8)} ${Y(8.3)}Q${X(5.1)} ${Y(8.1)} ${X(5)} ${Y(7.8)}L${X(-5)} ${Y(7.8)}Q${X(-5.1)} ${Y(8.1)} ${X(-4.8)} ${Y(8.3)}Z`, filter: 'url(#ink-rough)' }),
    s('path', { class: 't39p-beam', d: lines([[x - 2.6 * u, y, x - 2.6 * u, y - 8 * u], [x + 2.6 * u, y, x + 2.6 * u, y - 8 * u]], u * 0.6, 0.02, 0.02) + lines([[x - 3.5 * u, y - 7 * u, x + 3.5 * u, y - 7 * u], [x - 5 * u, y - 7.85 * u, x + 5 * u, y - 7.85 * u]], u * 0.34, 0.05, 0.05), filter: 'url(#ink-rough)' }),
    s('path', { class: 't39p-gate-rim', d: stroke([[x - 4.8 * u, y - 8.32 * u], [x - 2 * u, y - 9.12 * u], [x, y - 10.02 * u], [x + 2 * u, y - 9.12 * u], [x + 4.8 * u, y - 8.32 * u]], Math.max(1.2, u * 0.16), 0.2, 0.2, 0.2) + stroke([[x + 2.6 * u + u * 0.32, y - 0.2 * u], [x + 2.6 * u + u * 0.32, y - 7.8 * u]], Math.max(1, u * 0.12), 0.1, 0.1, 0.3) + stroke([[x - 2.6 * u - u * 0.32, y - 0.2 * u], [x - 2.6 * u - u * 0.32, y - 7.8 * u]], Math.max(1, u * 0.12), 0.1, 0.1, 0.3) }))
}

/** A week-stone against the light (w × h box): a dark body, its top and back edge burning with the low sun behind it,
 *  the week's numeral cut deep in its face, a long shadow running toward the viewer. */
function stoneArt(w: number, hh: number, seed: number, n: number) {
  const r = rng(seed)
  const top = blob(w / 2, hh * 0.36, w * 0.47, hh * 0.3, seed, 0.08, 18)
  const body = `M${f1(w * 0.04)} ${f1(hh * 0.38)}Q${f1(w * 0.02)} ${f1(hh * 0.86)} ${f1(w * 0.18)} ${f1(hh * 0.95)}Q${f1(w * 0.5)} ${f1(hh * 1.04)} ${f1(w * 0.84)} ${f1(hh * 0.95)}Q${f1(w * 0.98)} ${f1(hh * 0.86)} ${f1(w * 0.96)} ${f1(hh * 0.38)}Z`
  let moss = ''
  for (let i = 0; i < 6; i++) moss += blob(w * (0.12 + r() * 0.2), hh * (0.22 + r() * 0.2), 2 + r() * 5, 1.5 + r() * 2.5, seed + i, 0.3, 8)
  let pits = ''
  for (let i = 0; i < 8; i++) pits += stroke([[w * (0.12 + r() * 0.7), hh * (0.5 + r() * 0.38)], [w * (0.16 + r() * 0.7), hh * (0.52 + r() * 0.38)]], 1, 0.3, 0.3, 0.3)
  const back = curve([w * 0.05, hh * 0.34], [w * 0.5, hh * -0.04], [w * 0.95, hh * 0.34], 18)
  return s('g', { class: 't39p-piece' },
    // the long shadow toward the viewer, widening as it comes
    s('path', { class: 't39p-piece-sh', fill: 'url(#g39-shadowv)', d: `M${f1(w * 0.12)} ${f1(hh * 0.86)}Q${f1(w * 0.06)} ${f1(hh * 1.5)} ${f1(-w * 0.02)} ${f1(hh * 2.2)}Q${f1(w * 0.5)} ${f1(hh * 2.32)} ${f1(w * 1.02)} ${f1(hh * 2.2)}Q${f1(w * 0.94)} ${f1(hh * 1.5)} ${f1(w * 0.88)} ${f1(hh * 0.86)}Z` }),
    s('path', { class: 't39p-piece-glow', d: stroke(back, Math.max(6, hh * 0.26), 0.2, 0.2, 0.2), filter: 'url(#g39-glow)' }),
    s('path', { class: 't39p-piece-body', d: body, filter: 'url(#ink-rough)' }),
    s('path', { class: 't39p-piece-top', d: top }),
    s('path', { class: 't39p-piece-pits', d: pits }),
    s('path', { class: 't39p-piece-moss', d: moss }),
    // the rim: the back edge of the crown and the flanks catching the sun
    s('path', { class: 't39p-piece-rim', d: stroke(back, Math.max(2.2, hh * 0.08), 0.12, 0.12, 0.1) + stroke([[w * 0.04, hh * 0.4], [w * 0.05, hh * 0.7], [w * 0.13, hh * 0.9]], Math.max(1.2, hh * 0.035), 0.1, 0.6, 0.2) + stroke([[w * 0.96, hh * 0.4], [w * 0.95, hh * 0.7], [w * 0.87, hh * 0.9]], Math.max(1.2, hh * 0.035), 0.1, 0.6, 0.2) }),
    // the week, cut into the face: the cut's shadowed upper wall, its lit lower lip
    s('text', { class: 't39p-num-lip', x: f1(w / 2), y: f1(hh * 0.86 + 1.2), 'text-anchor': 'middle', 'font-size': f1(hh * 0.62) }, String(n)),
    s('text', { class: 't39p-num', x: f1(w / 2), y: f1(hh * 0.86), 'text-anchor': 'middle', 'font-size': f1(hh * 0.62) }, String(n)))
}
