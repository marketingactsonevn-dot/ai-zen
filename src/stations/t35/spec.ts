import './spec.css'
import { h, s } from '../../core/dom'
import { L } from '../../core/content'
import { sliced } from '../../core/chunk'
import { blob, clamp, curve, onSize, rng, stroke, type Pt } from '../../ui/part2/ink'
import { mist, moon, pine } from '../../ui/part2/paint'
import { stepPath, type SlotGeo } from '../../ui/part2/steps'
import type { StepPath } from '../../ui/part2/types'
import type { SceneCtx } from '../types'
import { C } from './content'
import { F, P, f1, gdefs, ink, lantern, roof } from './kit'

const K = C.scenes.spec
const RINGS: Pt[] = [[0.05, 0.9], [0.05, 0.6], [0.05, 0.28], [0.3, 0.05], [0.7, 0.05], [0.95, 0.28], [0.95, 0.6], [0.95, 0.9]] // on the sheet's margin

type Bench = { W: number; H: number; port: boolean; A: number; Pz: number; ox: number; oy: number; tx: number; ty: number; tw: number; th: number; edge: number; sheet: [number, number, number, number] }

/**
 * Scene 4 — a thick workbench under a hanging paper lamp, seen from about 55° above in real CSS 3D. A blueprint on
 * washi lies on its planks in the lamp's warm pool; eight pencil rings round its margin are the places of the steps.
 * Eight river pebbles lie along the near edge, each with its step carved on top. Set them in order (stepPath): each one
 * changes the sheet — a sketch of the feeling, pencilled questions, a block of spec, cut lines; then the cut pieces fold
 * up into a paper workshop (two walls and a roof), a pine and a fence by a paper pond, standing in 3D with their own
 * shadows and the lamp glowing through them; the square slides in under a flash, a crooked piece is set straight, and
 * the whole thing folds flat and rolls up into a skill that hangs on a hook. Tap the hook: it opens as a sheet on the
 * bench. Drag the empty bench to tilt it (35–70°) and turn it (±20°) to see the pop-up from the side.
 * Reduced motion / low: a fixed angle; every change is a cut.
 */
export function specScene(ctx: SceneCtx) {
  gdefs()
  const still = ctx.reduced || ctx.quality === 'low'
  const back = s('svg', { class: 't35p-back', 'aria-hidden': 'true' })
  const topArt = s('svg', { class: 't35p-top-art', 'aria-hidden': 'true' })
  const paperArt = s('svg', { class: 't35p-paper-art', 'aria-hidden': 'true' })
  const face = (cls: string) => {
    const art = s('svg', { class: 't35p-face-art', 'aria-hidden': 'true' })
    return { el: h('div', { class: `t35p-face ${cls}` }, art), art }
  }
  // the pop-up: a workshop (front wall, side wall, roof), a pine on its V-stand, a fence folded like a screen
  const house = { front: face('front'), side: face('side'), roof: face('roof') }
  const houseEl = h('div', { class: 't35p-piece house' }, house.front.el, house.side.el, house.roof.el)
  const tree = face('tree'), stand = face('stand')
  const treeEl = h('div', { class: 't35p-piece tree' }, tree.el, stand.el)
  const fenceFaces = [0, 1, 2].map((k) => face(`fold f${k}`))
  const fenceEl = h('div', { class: 't35p-piece fence' }, ...fenceFaces.map((x) => x.el))
  const sheetEl = h('div', { class: 't35p-sheet' }, paperArt, houseEl, treeEl, fenceEl)
  const lip = h('div', { class: 't35p-lip', 'aria-hidden': 'true' })
  const bench = h('div', { class: 't35p-bench' }, topArt, lip, sheetEl)
  const view = h('div', { class: 't35p-view' }, bench)
  const note = h('div', { class: 't35p-pencil' }, ctx.fact(F(K.facts[0]), 'p'))
  const flash = h('div', { class: 't35p-flash', 'aria-hidden': 'true' })
  const front = s('svg', { class: 't35p-back t35p-front', 'aria-hidden': 'true' })
  // when done: the skill hangs rolled on a hook; tapped, it lies open on the bench as a sheet
  const hook = h('button', { class: 't35p-hook', type: 'button', 'aria-expanded': 'false', 'aria-controls': 't35p-out', 'aria-label': K.hookAria, hidden: true },
    s('svg', { viewBox: '0 0 60 150', 'aria-hidden': 'true' },
      s('path', { class: 't35p-hook-iron', d: 'M30 0V14Q30 24 22 24Q16 24 16 18' }),
      s('path', { class: 't35p-cordline', d: 'M30 20L22 40M30 20L38 40' }),
      s('rect', { class: 't35p-roll-silk', x: 18, y: 38, width: 24, height: 104, rx: 4 }),
      s('rect', { class: 't35p-roll-paper', x: 20, y: 48, width: 20, height: 84 }),
      s('rect', { x: 18, y: 38, width: 24, height: 104, rx: 4, fill: 'url(#t35k-cyl)' }),
      ink(stroke([[14, 40], [46, 40]], 5, 0.02, 0.02, 0.8) + stroke([[14, 140], [46, 140]], 6, 0.02, 0.02, 0.8), 't35p-roll-rod', 'rough'),
      ink(stroke([[17, 88], [30, 90], [43, 88]], 3.4, 0.1, 0.1, 0.5), 't35p-tick', 'rough')))
  const out = h('div', { class: 't35p-out', id: 't35p-out', hidden: true })
  const strip = h('div', { class: 't35p-strip' })
  const stage = h('div', { class: `t35 t35p${still ? ' still' : ''}` },
    h('p', { class: 'visually-hidden' }, K.art), back, view, front, flash, note)
  ctx.art.append(stage)
  ctx.art.classList.add('t35p-art')

  let g: Bench | null = null
  let tilt = { a: 0, b: 0 } // the viewer's tilt on top of the resting angle (deg)
  /** Bench-top point (px from the top's top-left) → scene px at the resting angle (the same maths as the CSS 3D). */
  const proj = (x: number, y: number, G = g!): Pt => {
    const dy = y - G.th / 2
    // rotateX tips the far edge away and brings the near edge toward us (+z)
    const Y = dy * Math.cos((G.A * Math.PI) / 180), Z = dy * Math.sin((G.A * Math.PI) / 180)
    const k = G.Pz / (G.Pz - Z)
    const cx = G.tx + G.tw / 2, cy = G.ty + G.th / 2
    return [G.ox + (cx + (x - G.tw / 2) - G.ox) * k, G.oy + (cy + Y - G.oy) * k]
  }

  function measure() {
    const W = ctx.art.clientWidth, H = ctx.art.clientHeight
    const port = W < H * 0.8
    const tw = port ? W * 1.55 : Math.min(W * 0.92, 1220)
    const th = tw * (port ? 0.98 : 0.56)
    const sw = tw * (port ? 0.6 : 0.54), sh = th * (port ? 0.42 : 0.6)
    const G: Bench = { W, H, port, A: port ? 48 : 56, Pz: port ? 900 : 1150, ox: W / 2, oy: port ? -H * 0.1 : -H * 0.05, tx: (W - tw) / 2, ty: 0, tw, th, edge: clamp(th * 0.06, 18, 40), sheet: [(tw - sw) / 2, th * (port ? 0.06 : 0.08), sw, sh] }
    // slide the bench so the sheet's top sits near the top of the frame (a phone crops into the sheet)
    const want = H * (port ? 0.07 : 0.08)
    for (let k = 0; k < 4; k++) G.ty += (want - proj(G.sheet[0], G.sheet[1], G)[1]) * 0.9
    g = G
    return G
  }

  function* draw() {
    const G = measure()
    const { W, H, port, tw, th } = G
    const [sx, sy, sw, sh] = G.sheet
    view.style.perspective = `${G.Pz}px`
    view.style.perspectiveOrigin = `${f1(G.ox)}px ${f1(G.oy)}px`
    Object.assign(bench.style, { left: `${f1(G.tx)}px`, top: `${f1(G.ty)}px`, width: `${f1(tw)}px`, height: `${f1(th)}px` })
    bench.style.setProperty('--a', `${G.A}deg`)
    Object.assign(lip.style, { height: `${f1(G.edge)}px` })
    Object.assign(sheetEl.style, { left: `${f1(sx)}px`, top: `${f1(sy)}px`, width: `${f1(sw)}px`, height: `${f1(sh)}px` })
    // the room behind: a dark workshop wall and floor, the open door with the moon, the lamp's cord
    const [, farY] = proj(0, 0)
    back.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    const dw = port ? W * 0.32 : W * 0.15, dh = Math.max(40, farY + H * 0.02)
    const ddx = port ? W * 0.04 : W * 0.06
    back.replaceChildren(
      s('rect', { class: 't35p-room', width: f1(W), height: f1(H) }),
      s('rect', { class: 't35p-floor-sh', y: f1(proj(0, G.th)[1]), width: f1(W), height: f1(H) }),
      s('clipPath', { id: 't35p-door' }, s('rect', { x: f1(ddx), y: -2, width: f1(dw), height: f1(dh) })),
      s('rect', { class: 't35p-night', x: f1(ddx), y: -2, width: f1(dw), height: f1(dh) }),
      s('g', { 'clip-path': 'url(#t35p-door)' },
        moon(ddx + dw * 0.62, dh * 0.42, Math.min(dw * 0.12, 18), 365, false),
        mist(ddx + dw / 2, dh * 0.9, dw * 0.8, dh * 0.2),
        s('g', { class: 't35p-bough' }, pine(ddx + dw * 0.12, dh * 1.5, dh * 1.4, 366, 1))),
      s('path', { class: 't35p-spill', d: `M${f1(ddx)} ${f1(dh)}L${f1(ddx + dw)} ${f1(dh)}L${f1(ddx + dw * 1.8)} ${f1(dh + H * 0.3)}L${f1(ddx + dw * 0.2)} ${f1(dh + H * 0.3)}Z`, fill: 'url(#t35k-beam)' }),
      s('path', { class: 't35p-jamb', d: `M${f1(ddx - 8)} -4h7v${f1(dh + 6)}h-7ZM${f1(ddx + dw + 1)} -4h7v${f1(dh + 6)}h-7Z` }))
    yield
    // the bench top: thick planks with gaps and grain, the lamp's warm pool falling off to dark edges, the sheet's shadow
    topArt.setAttribute('viewBox', `0 0 ${f1(tw)} ${f1(th)}`)
    const r = rng(370)
    const pn = port ? 7 : 6
    const ph = th / pn
    let planks = '', gaps = '', grain = '', knots = ''
    const tone = ['', '']
    for (let k = 0; k < pn; k++) {
      const y = k * ph
      tone[k % 2] += `M0 ${f1(y + 1.5)}H${f1(tw)}V${f1(y + ph - 1.5)}H0Z`
      gaps += `M0 ${f1(y + ph - 1.6)}H${f1(tw)}V${f1(y + ph + 1.6)}H0Z`
      // a butt joint somewhere along each plank
      const jx = tw * (0.15 + r() * 0.7)
      gaps += `M${f1(jx)} ${f1(y + 1)}h2.4v${f1(ph - 2)}h-2.4Z`
      for (let j = 0; j < 7; j++) {
        const gy = y + ph * (0.15 + r() * 0.7)
        const x0 = r() * tw * 0.6, len = tw * (0.2 + r() * 0.5)
        grain += stroke(Array.from({ length: 10 }, (_, q) => [x0 + (len * q) / 9, gy + Math.sin(q * 0.8 + j + k) * ph * 0.04] as Pt), 0.9 + r() * 0.9, 0.1, 0.1, 0.3)
      }
      if (r() < 0.6) knots += blob(tw * (0.05 + r() * 0.9), y + ph * (0.3 + r() * 0.4), ph * 0.12, ph * 0.07, 380 + k, 0.2, 10)
    }
    planks = tone[0]
    const u = sw / 100 // the drawing's unit
    const tools = s('g', { class: 't35p-tools' },
      s('rect', { class: 't35p-inkstone', x: f1(tw * 0.06), y: f1(th * 0.1), width: f1(tw * 0.07), height: f1(th * 0.13), rx: 8, filter: 'url(#ink-rough)' }),
      s('ellipse', { class: 't35p-inkpool', cx: f1(tw * 0.095), cy: f1(th * 0.14), rx: f1(tw * 0.022), ry: f1(th * 0.026) }),
      ink(stroke([[tw * 0.08, th * 0.34], [tw * 0.16, th * 0.27]], th * 0.012, 0.02, 0.4, 0.4) + stroke([[tw * 0.16, th * 0.27], [tw * 0.178, th * 0.256]], th * 0.022, 0.1, 0.6, 0.3), 't35p-brush', 'rough'),
      s('rect', { class: 't35p-rulesh', x: f1(tw * 0.8 + 4), y: f1(th * 0.2 + 4), width: f1(tw * 0.15), height: f1(th * 0.03), transform: `rotate(-74 ${f1(tw * 0.87)} ${f1(th * 0.21)})` }),
      s('rect', { class: 't35p-rule', x: f1(tw * 0.8), y: f1(th * 0.2), width: f1(tw * 0.15), height: f1(th * 0.03), transform: `rotate(-74 ${f1(tw * 0.87)} ${f1(th * 0.21)})` }))
    topArt.replaceChildren(
      s('defs', null,
        s('radialGradient', { id: 't35p-pool', cx: 0.5, cy: 0.42, r: 0.62 }, s('stop', { offset: 0, class: 't35p-pool0' }), s('stop', { offset: 0.38, class: 't35p-pool1' }), s('stop', { offset: 1, class: 't35p-pool2' })),
        s('filter', { id: 't35p-soft', x: '-10%', y: '-10%', width: '120%', height: '120%' }, s('feGaussianBlur', { stdDeviation: still ? 3 : 7 }))),
      s('path', { class: 't35p-plank p0', d: planks }), s('path', { class: 't35p-plank p1', d: tone[1] }),
      s('path', { class: 't35p-grain', d: grain, filter: 'url(#ink-dry)' }),
      s('path', { class: 't35p-knot', d: knots, filter: 'url(#ink-wash)' }),
      s('path', { class: 't35p-gap', d: gaps }),
      // the warm pool and the falloff to the dark edges of the bench
      s('rect', { width: f1(tw), height: f1(th), fill: 'url(#t35p-pool)' }),
      // the sheet lies a hair above the wood: a soft dark shadow toward the near edge
      s('rect', { class: 't35p-sheet-sh', x: f1(sx + 4), y: f1(sy + 10), width: f1(sw), height: f1(sh), rx: 3, filter: 'url(#t35p-soft)' }),
      tools,
      // the corner pebbles hold the sheet down
      ...[[sx, sy], [sx + sw, sy], [sx + sw, sy + sh], [sx, sy + sh]].map(([x, y], k) => s('g', { class: 't35p-weight' },
        s('ellipse', { class: 't35k-contact', cx: f1(x + 3), cy: f1(y + 5), rx: f1(sw * 0.032), ry: f1(sw * 0.022) }),
        s('path', { d: blob(x, y, sw * 0.028, sw * 0.02, 383 + k, 0.15, 12), fill: 'url(#t35k-rock)', filter: 'url(#ink-rough)' }))))
    yield
    // the sheet: washi with a faint grid; each step inks a layer; the pencil rings of the eight places in its margin
    paperArt.setAttribute('viewBox', `0 0 ${f1(sw)} ${f1(sh)}`)
    const x = (v: number) => v * u, y = (v: number) => v * (sh / 100)
    const pt = (a: number, b: number): Pt => [x(a), y(b)]
    let grid = ''
    const gs = sw / 24
    for (let gx = gs; gx < sw - 2; gx += gs) grid += `M${f1(gx)} 3V${f1(sh - 3)}`
    for (let gy = gs; gy < sh - 2; gy += gs) grid += `M3 ${f1(gy)}H${f1(sw - 3)}`
    const rings = RINGS.map(([a, b], k) => {
      const cx = a * sw, cy = b * sh, rr = sw * 0.026
      return s('g', { class: `t35p-ring r${k + 1}` },
        s('path', { class: 't35p-ring-line', d: stroke(Array.from({ length: 26 }, (_, q) => { const t2 = (q / 24) * Math.PI * 2 + k; return [cx + Math.cos(t2) * rr * (1 + Math.sin(q * 1.7 + k) * 0.06), cy + Math.sin(t2) * rr * 0.98] as Pt }), Math.max(0.9, sw * 0.0022), 0.1, 0.1, 0.4) }),
        s('text', { class: 't35p-ring-n', x: f1(cx + (a > 0.5 ? -rr * 1.9 : a < 0.5 && b > 0.1 ? rr * 1.5 : rr * 1.4)), y: f1(cy - rr * 0.9), 'font-size': f1(Math.max(11, sw * 0.022)) }, String(k + 1)),
        s('g', { class: 't35p-ring-stone' },
          s('ellipse', { class: 't35k-contact', cx: f1(cx + 1.5), cy: f1(cy + rr * 0.35), rx: f1(rr * 0.8), ry: f1(rr * 0.3) }),
          s('path', { d: blob(cx, cy, rr * 0.72, rr * 0.5, 600 + k, 0.14, 12), fill: 'url(#t35k-rock)', filter: 'url(#ink-rough)' })))
    })
    paperArt.replaceChildren(
      s('rect', { class: 't35p-paper', width: f1(sw), height: f1(sh), filter: 'url(#ink-rough)' }),
      s('rect', { class: 't35p-paper-glow', width: f1(sw), height: f1(sh) }),
      s('path', { class: 't35p-grid', d: grid }),
      ...rings,
      // 1 · the feeling, sketched loose: a pond, a moon in it, a koi
      s('g', { class: 't35p-l t35p-l1' },
        s('path', { class: 't35p-wash', d: blob(x(30), y(60), 18 * u, 11 * (sh / 100), 380, 0.18, 18), filter: 'url(#ink-wash)' }),
        ink(stroke(curve(pt(18, 62), pt(30, 54), pt(42, 61), 10), 1.6 * u, 0.2, 0.3, 0.2) + stroke(curve(pt(26, 64), pt(32, 68), pt(37, 62), 8), 1.2 * u, 0.2, 0.4, 0.2) + blob(x(36), y(56), 2.4 * u, 2.4 * u, 381, 0.1, 8), 't35p-ink', 'rough')),
      // 2 · the AI's questions, in pencil in the margins
      s('g', { class: 't35p-l t35p-l2' }, ...[[14, 16], [86, 40], [80, 82], [16, 84]].map(([a, b], k) => s('text', { class: 't35p-q', x: f1(x(a)), y: f1(y(b)), 'font-size': f1(7 * u), transform: `rotate(${k % 2 ? 8 : -6} ${f1(x(a))} ${f1(y(b))})` }, '?'))),
      // 3 · the spec itself: a title and a block of written lines
      s('g', { class: 't35p-l t35p-l3' },
        ink(stroke([pt(56, 16), pt(84, 16)], 2.6 * u, 0.05, 0.1, 0.5), 't35p-ink', 'rough'),
        ink([24, 31, 38, 45].map((b, k) => stroke([pt(56, b), pt(56 + 18 + ((k * 7) % 12), b + 0.4)], 1.1 * u, 0.1, 0.2, 0.4)).join(''), 't35p-ink2', 'rough')),
      // 4 · cut into stages: dotted cut lines round the pieces that will stand up
      s('path', { class: 't35p-l t35p-l4 t35p-cut', d: `M${P(pt(12, 46))}H${f1(x(46))}M${P(pt(64, 52))}H${f1(x(76))}M${P(pt(52, 74))}H${f1(x(88))}M${P(pt(12, 46))}V${f1(y(30))}M${P(pt(46, 46))}V${f1(y(30))}` }),
      // 5 · the pond lies flat: a cut of water paper with its rim; the shadows the standing pieces throw toward us
      s('g', { class: 't35p-l t35p-l5' },
        s('path', { class: 't35p-pond', d: blob(x(28), y(68), 15 * u, 9 * (sh / 100), 382, 0.15, 18) }),
        s('path', { class: 't35p-pond-rim', d: stroke(curve(pt(14, 70), pt(28, 80), pt(42, 69), 10), 1.2 * u, 0.1, 0.1, 0.3) }),
        s('path', { class: 't35p-cast', d: `M${P(pt(12, 46))}L${P(pt(46, 46))}L${P(pt(52, 60))}L${P(pt(16, 60))}Z`, filter: 'url(#ink-wash)' }),
        s('path', { class: 't35p-cast', d: `M${P(pt(64, 52))}L${P(pt(76, 52))}L${P(pt(80, 64))}L${P(pt(66, 64))}Z`, filter: 'url(#ink-wash)' }),
        s('path', { class: 't35p-cast', d: `M${P(pt(52, 74))}L${P(pt(88, 74))}L${P(pt(91, 80))}L${P(pt(55, 80))}Z`, filter: 'url(#ink-wash)' })),
      // 7 · the red tick for the piece set straight
      s('path', { class: 't35p-l t35p-l7 t35p-tick', d: stroke([pt(82, 46), pt(85, 50), pt(91, 40)], 1.6 * u, 0.1, 0.1, 0.5) }))
    yield
    // the pieces, in sheet px, each folding up on its foot: house front at y 46 from x 12 to 46, its side wall back
    // from x 46, its roof; a pine at x 70 on a V-stand; a fence of three folds from x 52 to 88 at y 74
    const place = (el: HTMLElement, left: number, top: number, w: number, hh: number) => Object.assign(el.style, { left: `${f1(left)}px`, top: `${f1(top)}px`, width: `${f1(w)}px`, height: `${f1(hh)}px` })
    const fw = 34 * u, fh = sh * 0.34, sd = 12 * u
    place(houseEl, x(12), y(46) - fh, fw, fh)
    place(house.front.el, 0, 0, fw, fh)
    place(house.side.el, fw, 0, sd, fh)
    place(house.roof.el, -fw * 0.06, -fh * 0.32, fw * 1.12, fh * 0.34)
    paint(house.front.art, fw, fh, (w, hh) => {
      const wallT = hh * 0.12
      let lat = ''
      for (let k = 1; k < 3; k++) lat += stroke([[w * 0.36 + (w * 0.28 * k) / 3, hh * 0.42], [w * 0.36 + (w * 0.28 * k) / 3, hh - 1]], 1, 0.05, 0.05, 0.5)
      lat += stroke([[w * 0.36, hh * 0.68], [w * 0.64, hh * 0.68]], 1, 0.05, 0.05, 0.5)
      return [
        s('rect', { class: 't35p-card', x: 0, y: f1(wallT), width: f1(w), height: f1(hh - wallT) }),
        s('rect', { class: 't35p-door', x: f1(w * 0.36), y: f1(hh * 0.42), width: f1(w * 0.28), height: f1(hh * 0.58) }),
        s('rect', { class: 't35p-window', x: f1(w * 0.08), y: f1(hh * 0.36), width: f1(w * 0.18), height: f1(hh * 0.22) }),
        s('rect', { class: 't35p-window', x: f1(w * 0.74), y: f1(hh * 0.36), width: f1(w * 0.18), height: f1(hh * 0.22) }),
        ink(lat, 't35p-ink2', 'rough'),
        ink(stroke([[1, wallT], [1, hh]], 1.6, 0.05, 0.05, 0.5) + stroke([[w - 1, wallT], [w - 1, hh]], 1.6, 0.05, 0.05, 0.5) + stroke([[0, hh - 1], [w, hh - 1]], 2.2, 0.02, 0.02, 0.6), 't35p-ink', 'rough'),
        s('rect', { class: 't35p-glowthru', x: 0, y: f1(wallT), width: f1(w), height: f1(hh - wallT) }),
      ]
    })
    paint(house.side.art, sd, fh, (w, hh) => [
      s('rect', { class: 't35p-card shade', x: 0, y: f1(hh * 0.12), width: f1(w), height: f1(hh * 0.88) }),
      s('rect', { class: 't35p-window', x: f1(w * 0.3), y: f1(hh * 0.4), width: f1(w * 0.4), height: f1(hh * 0.2) }),
      s('rect', { class: 't35p-fold', x: 0, y: f1(hh * 0.12), width: f1(w * 0.3), height: f1(hh * 0.88) }),
    ])
    paint(house.roof.art, fw * 1.12, fh * 0.34, (w, hh) => {
      let tiles = ''
      for (let k = 1; k < 9; k++) tiles += stroke([[(w * k) / 9, hh * 0.08], [(w * k) / 9 + w * 0.01, hh * 0.86]], 1, 0.1, 0.1, 0.4)
      return [
        s('path', { class: 't35p-card shade', d: roof(w * 0.08, w * 0.92, hh * 0.9, w / 160, hh * 0.7) }),
        ink(tiles, 't35p-ink2', 'rough'),
        ink(stroke([[0, hh * 0.88], [w * 0.5, hh * 0.92], [w, hh * 0.88]], 2, 0.05, 0.05, 0.5) + stroke([[w * 0.2, hh * 0.1], [w * 0.8, hh * 0.1]], 2.4, 0.05, 0.05, 0.5), 't35p-ink', 'rough'),
        s('rect', { class: 't35p-edge', x: 0, y: f1(hh * 0.9), width: f1(w), height: f1(Math.max(1.5, hh * 0.06)) }),
      ]
    })
    const tw2 = 14 * u, th2 = sh * 0.36
    place(treeEl, x(63), y(52) - th2, tw2, th2)
    place(tree.el, 0, 0, tw2, th2)
    place(stand.el, tw2 * 0.5, th2 * 0.4, tw2 * 0.35, th2 * 0.6)
    paint(tree.art, tw2, th2, (w, hh) => [s('g', { class: 't35p-tree' }, pine(w * 0.42, hh, hh * 0.95, 388, 1)), s('rect', { class: 't35p-edge', x: 0, y: f1(hh - 2), width: f1(w), height: 2 })])
    paint(stand.art, tw2 * 0.35, th2 * 0.6, (w, hh) => [s('path', { class: 't35p-card shade', d: `M0 ${f1(hh)}L${f1(w)} ${f1(hh)}L0 0Z` })])
    const fw3 = 12 * u, fh3 = sh * 0.14
    place(fenceEl, x(52), y(74) - fh3, fw3 * 3, fh3)
    fenceFaces.forEach((f, k) => {
      place(f.el, fw3 * k, 0, fw3, fh3)
      paint(f.art, fw3, fh3, (w, hh) => {
        let pal = ''
        for (let q = 0; q <= 4; q++) pal += stroke([[(w * q) / 4 + 1, hh], [(w * q) / 4 + 1, hh * 0.12]], 1.6, 0.05, 0.05, 0.6)
        return [s('rect', { class: `t35p-card${k === 1 ? ' shade' : ''}`, width: f1(w), height: f1(hh) }), ink(pal + stroke([[0, hh * 0.35], [w, hh * 0.35]], 1.4, 0.05, 0.05, 0.6), 't35p-ink2', 'rough')]
      })
    })
    // the lamp hangs over the bench, between us and it
    const lr = clamp(W * 0.02, 13, 24), lx = W * (port ? 0.86 : 0.6), ly = -lr * (port ? 0.9 : 0.6)
    front.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    front.replaceChildren(s('path', { class: 't35p-cord', d: `M${f1(lx)} -10V${f1(ly)}` }), s('g', { class: 't35p-lamp' }, lantern(lx, ly, lr, 389, 2)))
    // the pencil note: in the room's dark left of the sheet; on a phone in the strip along the bottom
    const [nl, nt] = proj(sx, sy + sh * 0.4)
    if (port) {
      strip.append(note)
      Object.assign(note.style, { left: '', right: '', width: '', top: '', bottom: '' })
    } else {
      stage.append(note)
      Object.assign(note.style, { left: `${f1(W * 0.025)}px`, right: 'auto', width: `${f1(clamp(nl - W * 0.05, 170, 250))}px`, top: `${f1(nt)}px`, bottom: 'auto' })
    }
    stage.classList.toggle('port', port)
    ctx.art.classList.toggle('port', port)
    applyTilt()
  }
  function paint(svg: SVGSVGElement, w: number, hh: number, fn: (w: number, hh: number) => SVGElement[]) {
    svg.setAttribute('viewBox', `0 0 ${f1(w)} ${f1(hh)}`)
    svg.replaceChildren(...fn(w, hh))
  }
  function applyTilt() {
    if (!g) return
    bench.style.transform = `rotateX(${f1(g.A + tilt.a)}deg) rotateZ(${f1(tilt.b)}deg)`
  }

  let job: { cancel(): void } | null = null
  let first = true
  ctx.onCleanup(onSize(ctx.art, () => {
    job?.cancel()
    job = sliced(draw(), { sync: ctx.reduced || !first }) // only the first paint soaks in
    first = false
  }))
  ctx.onCleanup(() => job?.cancel())

  // tilt: drag the empty bench to look at the pop-up from lower or higher, and to turn it a little; it settles back
  if (!still) {
    let dragT: { id: number; x: number; y: number; a: number; b: number } | null = null
    const downT = (e: PointerEvent) => {
      if (e.button || (e.target as Element).closest('button, a, .t35p-out')) return
      dragT = { id: e.pointerId, x: e.clientX, y: e.clientY, a: tilt.a, b: tilt.b }
      stage.classList.add('tilting')
    }
    const moveT = (e: PointerEvent) => {
      if (!dragT || e.pointerId !== dragT.id || !g) return
      tilt = { a: clamp(dragT.a + (e.clientY - dragT.y) * 0.12, 35 - g.A, 70 - g.A), b: clamp(dragT.b + (e.clientX - dragT.x) * 0.08, -20, 20) }
      applyTilt()
    }
    const upT = (e: PointerEvent) => {
      if (!dragT || e.pointerId !== dragT.id) return
      dragT = null
      stage.classList.remove('tilting')
      tilt = { a: 0, b: 0 }
      applyTilt()
    }
    ctx.art.addEventListener('pointerdown', downT)
    addEventListener('pointermove', moveT)
    addEventListener('pointerup', upT)
    addEventListener('pointercancel', upT)
    ctx.onCleanup(() => {
      ctx.art.removeEventListener('pointerdown', downT)
      removeEventListener('pointermove', moveT)
      removeEventListener('pointerup', upT)
      removeEventListener('pointercancel', upT)
    })
  }

  // the path itself (logic, keys, drag, wrong hints) is stepPath's; its places sit on the sheet's pencil rings
  const ring = (n: number): Pt[] => {
    const G = g ?? measure()
    const [sx, sy, sw, sh] = G.sheet
    return RINGS.slice(0, n).map(([a, b]) => proj(sx + sw * a, sy + sh * b))
  }
  // the loose pebbles: a row along the bench's near edge (a phone: two columns right under the sheet)
  const pile = (sg: SlotGeo): Pt[] => {
    const G = g ?? measure()
    const { w, n, size } = sg
    const [sx, sy, , sh] = G.sheet
    const below = proj(sx, sy + sh)[1]
    if (G.port) {
      // two columns of pebbles (drawn 52 px tall, spec.css) stacked up from the strip of words at the bottom
      const rows = Math.ceil(n / 2), ph = 52, gap = 5
      const last = sg.h - 122 - ph / 2
      const first = Math.max(below + ph / 2 + 6, last - (rows - 1) * (ph + gap))
      const step = rows > 1 ? (last - first) / (rows - 1) : 0
      return Array.from({ length: n }, (_, k) => [w * (k % 2 ? 0.74 : 0.26), first + Math.floor(k / 2) * step + (k % 2 ? 4 : 0) - (size[1] - ph) / 2] as Pt)
    }
    const sz = 158 // the pebbles are drawn a little larger than stepPath's default (spec.css)
    const gap = (w - n * sz) / (n + 1)
    const near = proj(0, G.th)[1]
    const yy = Math.min(G.H - size[1] * 0.75, below + (near - below) * 0.62)
    ctx.art.style.setProperty('--t35p-note', `${f1(G.H - yy + size[1] * 0.5 + 10)}px`)
    return Array.from({ length: n }, (_, k) => [gap + sz / 2 + k * (sz + gap) - (sz - size[0]) / 2, yy + Math.sin(k * 1.7) * 6] as Pt)
  }
  stepPath(K.steps as StepPath, {
    label: K.label,
    prompt: K.prompt,
    insight: F(K.insight),
    detail: K.detail,
    art: () => [],
    slots: (sg) => ring(sg.n),
    pile,
    piece: (_i, { w, h: hh, seed }) => s('g', null,
      s('ellipse', { class: 't35k-contact', cx: f1(w * 0.52), cy: f1(hh * 0.84), rx: f1(w * 0.5), ry: f1(hh * 0.18) }),
      s('path', { d: blob(w / 2, hh * 0.48, w * 0.49, hh * 0.42, seed, 0.1, 18), fill: 'url(#t35k-rock)', filter: 'url(#ink-rough)' }),
      s('path', { d: blob(w / 2, hh * 0.48, w * 0.49, hh * 0.42, seed, 0.1, 18), fill: 'url(#p2-shade)' }),
      ink(stroke(curve([w * 0.14, hh * 0.28], [w * 0.4, hh * 0.08], [w * 0.75, hh * 0.16], 8), Math.max(1.4, hh * 0.05), 0.3, 0.3, 0.1), 't35k-rim')),
    onPlace: (k) => {
      stage.classList.add(`s${k + 1}`)
      if (k === 5 && !still) {
        flash.classList.remove('go')
        void flash.offsetWidth // restart the flash
        flash.classList.add('go')
      }
      if (k === 7) queueMicrotask(hang)
    },
  }).mount(ctx)
  // stepPath opens its take-away as a sheet over the scene: take the card out of it and hang it on the hook instead
  const pathRoot = ctx.art.querySelector<HTMLElement>('.p2s')
  pathRoot?.append(hook, out)
  // on a phone the step's note and the pencil fact share the strip along the bottom
  const stepNote = ctx.art.querySelector<HTMLElement>('.p2s-note')
  if (stepNote) strip.prepend(stepNote)
  pathRoot?.append(strip)
  function hang() {
    const card = ctx.art.querySelector<HTMLElement>('.p2s-sheet .p2k')
    if (card) {
      out.replaceChildren(h('button', { class: 't35p-out-close', type: 'button', 'aria-label': L.close, onClick: () => toggle(false) }, '×'), card)
      const copy = card.querySelector('.p2k-copy')
      if (copy) card.querySelector('.p2k-foot')?.append(copy)
    }
    hook.hidden = false
    setTimeout(() => hook.focus({ preventScroll: true }), still ? 0 : 1900)
  }
  function toggle(on: boolean = out.hidden === true) {
    out.hidden = !on
    hook.setAttribute('aria-expanded', String(on))
    stage.classList.toggle('reading', on)
    ctx.art.classList.toggle('reading', on)
    ctx.chime('soft')
    if (on) out.querySelector<HTMLElement>('.p2k-copy')?.focus({ preventScroll: true })
    else hook.focus({ preventScroll: true })
  }
  hook.addEventListener('click', () => toggle())
}
