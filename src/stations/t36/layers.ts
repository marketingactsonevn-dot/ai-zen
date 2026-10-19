import './layers.css'
import { fill, h, s } from '../../core/dom'
import { createLoop } from '../../core/loop'
import { cssVar, onPrefs } from '../../core/prefs'
import { blob, clamp, curve, onDigit, onSize, rng, rock, stableHeight, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist, moon, reeds } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import { C } from './content'
import { F, f1, gdefs, ink } from './kit'
import { guide } from '../../ui/part2/guide'
import { findTakeaway, foldedTakeaway } from '../../ui/part2/takeaway'
import type { Takeaway } from '../../ui/part2/types'
import { koi } from './koi'

const K = C.scenes.layers
const P = K.play
const N = K.layers.length
const TAU = Math.PI * 2
/** the view: tilt of the world (rotateX), so the camera looks down 35°; the basin's proportions in units of its diameter d */
const TILT = 55
const RH = 0.22 // the rim's height
const WZ = 0.66 // the water's height, as a share of RH
interface Item { on: boolean; x: number; y: number; v: number; leaf: boolean }
interface Ring { on: boolean; x: number; y: number; t: number }

const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 24) =>
  Array.from({ length: n + 1 }, (_, i) => { const t = a0 + ((a1 - a0) * i) / n; return [cx + Math.cos(t) * rx, cy + Math.sin(t) * ry] as Pt })

/**
 * Where a point of the world lands in the scene box (px): the same perspective as the CSS (perspective 5d from 50% 20%,
 * the world turned rotateX(TILT) about its centre). X, Y from the basin's centre (Y toward the viewer), Z up.
 */
function projector(d: number) {
  const PP = d * 5, ox = d * 0.5, oy = d * 0.2, c = d / 2
  const a = (TILT * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a)
  return (X: number, Y: number, Z: number): Pt => {
    const y2 = Y * ca - Z * sa, z2 = Y * sa + Z * ca
    const k = PP / (PP - z2)
    return [ox + (c + X - ox) * k, oy + (c + y2 - oy) * k]
  }
}
/** the inverse on one plane: the world point (X, Y) at height Z that lands on scene px (sx, sy) */
function unprojector(d: number) {
  const PP = d * 5, ox = d * 0.5, oy = d * 0.2, c = d / 2
  const a = (TILT * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a)
  return (sx: number, sy: number, Z: number): Pt => {
    const A = (sy - oy) / PP
    const Y = (A * (PP - Z * ca) - (c - oy) + Z * sa) / (ca + A * sa)
    const k = PP / (PP - Y * sa - Z * ca)
    return [(sx - ox) / k - c + ox, Y]
  }
}
const ring = (pr: (X: number, Y: number, Z: number) => Pt, r: number, z: number, n = 40) => {
  let d = ''
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU
    const [x, y] = pr(Math.cos(a) * r, Math.sin(a) * r, z)
    d += `${i ? 'L' : 'M'}${f1(x)} ${f1(y)}`
  }
  return d + 'Z'
}

/** What each tracing sheet carries, drawn on the basin's water (viewBox 0 0 100 100, the water a circle of r 50). */
function layerArt(i: number): SVGSVGElement {
  const g = s('svg', { class: 't36g-art', viewBox: '0 0 100 100', 'aria-hidden': 'true' })
  const r = rng(3690 + i)
  const shard = (x: number, y: number, k: number) => `M${f1(x)} ${f1(y)}q${f1(3.2 * k)} ${f1(-1.2 * k)} ${f1(4.4 * k)} ${f1(2 * k)}q${f1(-2.4 * k)} ${f1(-1.4 * k)} ${f1(-4.4 * k)} ${f1(-2 * k)}Z`
  const parts: (SVGElement | string)[][] = [
    // water: a wash, the moon's reflection, ripples drawn in a dry brush
    [s('circle', { class: 't36g-water', cx: 50, cy: 50, r: 49 }),
      s('g', { class: 't36g-ripples' }, ink(Array.from({ length: 9 }, (_, k) => stroke(arc(50 + (r() - 0.5) * 30, 24 + k * 6.5, 6 + r() * 14, 1.1, 3.6, 4.6, 8), 1.2, 0.2, 0.2, 0.1)).join(''), 't36g-ripple')),
      s('ellipse', { class: 't36g-moonref', cx: 64, cy: 34, rx: 7, ry: 3.6 })],
    // the koi, swimming its circle
    [s('g', { class: 't36g-swim' }, koi(50, 20, 36, Math.PI + 0.2, 3692, 0.18))],
    // control: the fingertip that leads, a dotted wake bending toward it
    [ink(stroke(arc(70, 62, 5.5, 5.5, 0, TAU, 20), 1.6, 0.1, 0.1, 0.4) + stroke(arc(70, 62, 10, 10, 3.6, 5.9, 12), 1.1, 0.2, 0.2, 0.2), 't36g-line', 'rough'),
      ink(stroke([[88, 86], [80, 75], [72, 65]], 6.5, 0.04, 0.35, 0.45), 't36g-finger', 'wash'),
      ink(curve([40, 30], [68, 38], [68, 56], 7).map(([x, y]) => blob(x, y, 1.3, 1.3, 1, 0.2, 6)).join(''), 't36g-line')],
    // the moon falling in shards (one feature per sheet: the leaves are the next one)
    [ink(shard(30, 28, 2.1) + shard(56, 16, 1.7) + shard(24, 56, 1.5), 't36g-shard', 'rough')],
    // dry leaves (the ones to avoid) and the three hearts they cost
    [ink(stroke(curve([60, 70], [67, 62], [74, 70], 6), 5, 0.3, 0.3, 0.2) + stroke([[59, 71], [75, 69]], 0.7, 0.1, 0.1, 0.3), 't36g-leaf', 'rough'),
      ink([0, 1, 2].map((k) => `M${f1(62 + k * 7)} ${f1(42)}c-3 -2.1 -2.1 -4.5 0 -3c2.1 -1.5 3 0.9 0 3Z`).join(''), 't36g-heart')],
    // the end of a round: an ensō by the rim with the score's vermilion seal
    [ink(stroke(arc(78, 24, 10, 10, -1.3, 4.6, 26), 2.8, 0.08, 0.55, 0.12), 't36g-line', 'rough'),
      s('rect', { class: 't36g-seal', x: 12, y: 16, width: 9, height: 9, rx: 0.8 })],
    // sound: a drop and the rings of its "tõm"
    [ink(blob(28, 70, 2, 2.8, 3693, 0.1, 8) + [1, 2, 3].map((k) => stroke(arc(28, 74, k * 7, k * 3.4, 0.3 * k, TAU - 0.4 + 0.3 * k, 24), 1.2, 0.1, 0.1, 0.2)).join(''), 't36g-line', 'rough')],
  ]
  g.append(...parts[i])
  return g
}

/** a garden stone standing on y = 0 (centred on x = 0): contact shadow, face, shaded flank, moonlit crown */
function rockArt(w: number, hh: number, seed: number): SVGGElement {
  const { top, d } = rock(w, hh, seed)
  return s('g', { class: 't36g-rock' },
    s('ellipse', { class: 't36g-rsh', cx: f1(w * 0.12), cy: 1, rx: f1(w * 0.62), ry: f1(hh * 0.16) }),
    s('path', { d, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
    s('path', { d, fill: 'url(#p2-shade)' }),
    s('path', { class: 't36g-rcrown', d: stroke(top.slice(4, 22), Math.max(1.4, hh * 0.06), 0.3, 0.4, 0.15) }))
}

/** a deckled sheet edge: a polygon close to the box, torn a little all round (clip-path, % of the box) */
function torn(seed: number) {
  const r = rng(seed)
  const pts: string[] = []
  const side = (n: number, f: (t: number, j: number) => [number, number]) => {
    for (let i = 0; i < n; i++) {
      const [x, y] = f(i / n, (r() - 0.5) * 2.4 + Math.sin(i * 1.7 + seed) * 0.6)
      pts.push(`${f1(x)}% ${f1(y)}%`)
    }
  }
  side(12, (t, j) => [t * 100, 1.2 + j])
  side(12, (t, j) => [98.8 + j, t * 100])
  side(12, (t, j) => [100 - t * 100, 98.8 + j])
  side(12, (t, j) => [1.2 + j, 100 - t * 100])
  return `polygon(${pts.join(',')})`
}

/**
 * Scene 4 — the game grows layer by layer (art direction §4 t36 `layers`): near-axonometric, a round stone basin sits on
 * raked sand under the moon, its contact shadow on the ground, a warm light from the front left; above it seven sheets of
 * tracing paper hang apart in CSS 3D, torn at the edges and faintly lit, each carrying one layer (water → koi → control
 * → falling moon → score → sound → effects), its name written along its front edge. Drag turns the stack. Touch the lit
 * sheet: it sinks into the basin with a ripple, its prompt is carved round the rim with the others, and the pond comes
 * one step more alive. After the seventh, the view leans in and the real 30-second game (Canvas 2D) plays in the
 * basin's water; the score and time are carved on the rim, a pebble pauses, a little bell gives sound.
 * The basin's lathed body is painted in 2D from the same projection as the CSS (a round body looks the same however the
 * stack turns); its rim, water and the sheets are the 3D layers.
 */
export function layersScene(ctx: SceneCtx) {
  gdefs()
  const stableH = stableHeight(ctx, [F(K.insight)])
  const calm = ctx.reduced || ctx.quality === 'low'
  const low = ctx.quality === 'low'
  const r = rng(36)

  let next = 0

  // ── the world in CSS 3D: rim, water, sunk sheets, the sheets above; the painted basin behind it; the 2D overlay on top
  const rimText = s('text', { class: 't36g-rimtext' }, s('textPath', { href: '#t36g-rimpath', startOffset: '1%' }))
  const rimText2 = s('text', { class: 't36g-rimtext' }, s('textPath', { href: '#t36g-rimpath2', startOffset: '1%' }))
  const hudCarve = s('text', { class: 't36g-hudtext', 'text-anchor': 'middle' }, s('textPath', { href: '#t36g-hudpath', startOffset: '50%' }))
  const rim = h('div', { class: 't36g-rim' },
    h('i', { class: 't36g-rimlight' }),
    s('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true' },
      s('path', { id: 't36g-rimpath', d: 'M50 3.6A46.4 46.4 0 1 1 49.9 3.6', fill: 'none' }),
      s('path', { id: 't36g-rimpath2', d: 'M50 7.2A42.8 42.8 0 1 1 49.9 7.2', fill: 'none' }),
      s('path', { id: 't36g-hudpath', d: 'M4.6 50A45.4 45.4 0 0 0 95.4 50', fill: 'none' }),
      rimText, rimText2, hudCarve))
  const water = h('div', { class: 't36g-pool' })
  const sunk = h('div', { class: 't36g-sunk' })
  const ripple = h('i', { class: 't36g-ring' })
  const sheets = K.layers.map((l, i) => {
    const name = fill(K.layerAria, { n: i + 1, name: l.name })
    const tab = h('button', { class: 't36g-tab', type: 'button', 'aria-label': name, 'aria-disabled': i ? 'true' : null, onClick: () => add(i) }, name)
    return h('div', { class: 't36g-sheet', style: `--k:${i}` }, h('div', { class: 't36g-paper' }, h('i', { style: `clip-path:${torn(3700 + i * 7)}` })), layerArt(i), tab)
  })
  // the game, on the water's own plane inside the world
  const cv = h('canvas', { class: 't36g-cv', 'aria-hidden': 'true', hidden: true })
  const g = cv.getContext('2d')!
  const world = h('div', { class: 't36g-world' }, water, cv, sunk, ripple, rim, ...sheets)
  const body = s('svg', { class: 't36g-body', 'aria-hidden': 'true' })
  // on the rim while playing: a pebble that pauses, a little bell for sound
  const pause = h('button', { class: 't36g-obj t36g-pebble', type: 'button', 'aria-label': P.pause, title: P.pause, onClick: togglePause },
    s('svg', { viewBox: '0 0 40 28', 'aria-hidden': 'true' },
      s('ellipse', { class: 't36g-osh', cx: 22, cy: 24, rx: 16, ry: 3.5 }),
      s('path', { class: 't36g-pb', d: 'M5 17C4 9 12 4 21 4S37 9 36 16C35 22 27 24 20 24S6 23 5 17Z' }),
      s('path', { class: 't36g-pbhi', d: 'M10 10Q20 4 31 9', fill: 'none' }),
      s('path', { class: 't36g-pmark', d: 'M17 10V18M24 10V18' })))
  const sound = h('button', { class: 't36g-obj t36g-bell', type: 'button', 'aria-pressed': 'false', 'aria-label': P.sound, title: P.sound, onClick: toggleSound },
    s('svg', { viewBox: '0 0 34 40', 'aria-hidden': 'true' },
      s('ellipse', { class: 't36g-osh', cx: 18, cy: 37, rx: 13, ry: 2.6 }),
      s('path', { class: 't36g-cord2', d: 'M17 0V6', fill: 'none' }),
      s('path', { class: 't36g-bl', d: 'M9 30C9 18 10 8 17 7S25 18 25 30Z' }),
      s('rect', { class: 't36g-blip', x: 6, y: 29, width: 22, height: 4, rx: 1.5 }),
      s('path', { class: 't36g-blhi', d: 'M12 27C12 18 13 11 16 10', fill: 'none' }),
      s('path', { class: 't36g-waves', d: 'M28 14Q31 18 28 22M30.5 11Q35 18 30.5 25', fill: 'none' })))
  const endMsg = h('p', { class: 't36g-endmsg' })
  const again = h('button', { class: 't36g-start', type: 'button', onClick: play }, P.again)
  const endRow = h('div', { class: 't36g-endrow' }, again)
  const endBox = h('div', { class: 't36g-end', hidden: true }, endMsg, endRow)
  const over = h('div', { class: 't36g-over' }, pause, sound)
  const scene = h('div', { class: 't36g-scene' }, body, world, over)
  // what the screen reader hears of the score (the rim's carving is aria-hidden)
  const scoreEl = h('span'), livesEl = h('span'), timeEl = h('span')
  const hud = h('p', { class: 'visually-hidden', hidden: true }, scoreEl, ' · ', livesEl, ' · ', timeEl)
  const live = h('p', { class: 'visually-hidden', 'aria-live': 'assertive' })
  const said = h('div', { class: 't36g-said' })
  const start = h('button', { class: 't36g-start t36g-go', type: 'button', hidden: true, onClick: play }, P.start)
  const far = s('svg', { class: 't36g-far', 'aria-hidden': 'true' })
  const near = s('svg', { class: 't36g-near', 'aria-hidden': 'true' })
  const root = h('div', { class: `t36 t36g${calm ? ' calm' : ''}` },
    h('p', { class: 'visually-hidden' }, K.art),
    far, scene, near, hud, said, start, endBox, live,
    ctx.reduced ? h('p', { class: 't36g-still' }, P.still) : null)
  ctx.art.append(root)
  ctx.prompt(K.prompt)
  // the take-away after a round: the full prompt pack, with the phone and before-you-publish cards folded in it
  const kit = [K.takeaway, ...K.cards].map((id) => findTakeaway(id)).filter((c): c is Takeaway => !!c)
  if (kit.length) endRow.append(foldedTakeaway(kit, ctx.onCleanup))
  const GD = guide(ctx)
  sheets[0].classList.add('lit', 't36g-base')
  ctx.onCleanup(onDigit((d) => d === next + 1 && add(next)))

  // ── turn the stack: drag sideways
  let rz = -24
  const pose = () => world.style.setProperty('--rz', `${f1(rz)}deg`)
  pose()
  let drag: { id: number; x: number; rz: number } | null = null
  scene.addEventListener('pointerdown', (e) => {
    if (e.button || mode !== 'build' || (e.target as Element).closest('button')) return
    drag = { id: e.pointerId, x: e.clientX, rz }
    scene.setPointerCapture(e.pointerId)
    world.classList.add('held')
  })
  scene.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return
    rz = clamp(drag.rz + (e.clientX - drag.x) * 0.25, -64, 16)
    pose()
  })
  const up = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return
    drag = null
    world.classList.remove('held')
  }
  scene.addEventListener('pointerup', up)
  scene.addEventListener('pointercancel', up)
  // living motion (water, koi, shards, fireflies) rests after 10 s without input
  let idleT = 0
  const wake = () => {
    root.classList.remove('idle')
    clearTimeout(idleT)
    idleT = window.setTimeout(() => root.classList.add('idle'), 10000)
  }
  wake()
  root.addEventListener('pointermove', wake)
  root.addEventListener('pointerdown', wake)
  ctx.onCleanup(() => clearTimeout(idleT))

  // ── layout: the basin's size from the room; everything painted in 2D follows from the same projection
  let D = 300, AW = 300, SH = 300, wide = true
  ctx.onCleanup(onSize(ctx.art, () => {
    AW = ctx.art.clientWidth
    const A = ctx.art.clientHeight
    SH = stableH(A)
    if (AW < 60 || SH < 60) return
    root.style.height = `${f1(A)}px`
    wide = AW / SH > 1.1
    root.classList.toggle('wide', wide)
    D = wide ? Math.min(SH * 0.6, AW * 0.32) : Math.min(AW * 0.66, SH * 0.44)
    root.style.setProperty('--d', `${f1(D)}px`)
    root.style.setProperty('--gap', `${f1(D * (wide ? 0.064 : 0.078))}px`)
    // the rim's centre sits at (cx, cy) of the art; the scene box is d × d round the world's centre
    const cx = AW / 2, cy = wide ? SH * 0.6 : SH * 0.54
    const pr = projector(D)
    const [, rimY] = pr(0, 0, RH * D)
    const sx = cx - D / 2, sy = cy - rimY
    Object.assign(scene.style, { left: `${f1(sx)}px`, top: `${f1(sy)}px` })
    // the play view leans in toward the basin: a scale about the water's centre
    const [, wy] = pr(0, 0, RH * WZ * D)
    scene.style.transformOrigin = `50% ${f1(wy)}px`
    const zoom = wide ? clamp((SH * 0.92) / (D * 1.05), 1, 1.6) : clamp((AW * 0.98) / (D * 1.08), 1, 1.35)
    root.style.setProperty('--zoom', zoom.toFixed(3))
    Object.assign(said.style, wide ? { left: `${f1(AW / 2)}px`, top: `${f1(SH * 0.865)}px`, width: `${f1(Math.min(640, AW * 0.6))}px` } : { left: `${f1(AW / 2)}px`, top: `${f1(cy + D * 0.62)}px`, width: `${f1(AW - 8)}px` })
    Object.assign(start.style, { left: `${f1(AW / 2)}px`, top: `${f1(sy + pr(0, 0, RH * D + D * 0.55)[1])}px` })
    paintBody(pr)
    paintFar(sy, pr)
    // the pebble and the bell on the near rim, the end card over the water (scene px)
    const [px, py] = pr(-Math.cos(0.5) * D * 0.47, Math.sin(0.5) * D * 0.47, RH * D)
    const [bx, by] = pr(Math.cos(0.5) * D * 0.47, Math.sin(0.5) * D * 0.47, RH * D)
    Object.assign(pause.style, { left: `${f1(px)}px`, top: `${f1(py)}px` })
    Object.assign(sound.style, { left: `${f1(bx)}px`, top: `${f1(by)}px` })
    // the end card lies on the sand in front of the basin (where the zoomed view puts its foot)
    const [, fy] = pr(0, D * 0.5, 0)
    Object.assign(endBox.style, { left: `${f1(cx)}px`, top: `${f1(Math.min(SH - 104, sy + wy + (fy - wy) * zoom + 10))}px` })
    if (mode !== 'build') fitGame()
  }))

  /** the basin's body, the ground round it and its shadow: painted from the projection, once per size */
  function paintBody(pr: (X: number, Y: number, Z: number) => Pt) {
    const d = D, R = d / 2, rh = RH * d
    const pad = d * 0.9
    body.setAttribute('viewBox', `${f1(-pad)} ${f1(-pad)} ${f1(d + pad * 2)} ${f1(d + pad * 2)}`)
    Object.assign(body.style, { left: `${f1(-pad)}px`, top: `${f1(-pad)}px`, width: `${f1(d + pad * 2)}px`, height: `${f1(d + pad * 2)}px` })
    // the ground: raked sand in rings round the basin, fading out; moss here and there; two small stones
    let rake = ''
    for (let k = 0; k < 9; k++) rake += ring(pr, R * (1.12 + k * 0.105), 0, 56)
    const [gx, gy] = pr(0, 0, 0)
    const groundR = pr(R * 2.1, 0, 0)[0] - gx
    const shadow = ring(pr, R * 1.04, 0, 40)
    // the lathe: rings from foot to lip, each band a little lighter, the lip throwing a shadow under it
    const prof: [number, number][] = [[0.8, 0], [0.86, 0.05], [0.93, 0.17], [0.97, 0.36], [0.965, 0.55], [0.935, 0.7], [0.915, 0.77], [0.97, 0.83], [1.0, 0.91], [0.995, 1]]
    const steps = low ? 14 : 26
    const bands: SVGElement[] = []
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const j = Math.min(prof.length - 2, Math.floor(t * (prof.length - 1)))
      const f = t * (prof.length - 1) - j
      const rad = (prof[j][0] + (prof[j + 1][0] - prof[j][0]) * f) * R
      const z = (prof[j][1] + (prof[j + 1][1] - prof[j][1]) * f) * rh
      const d0 = ring(pr, rad, z, 44)
      const under = z / rh > 0.76 && z / rh < 0.84 ? 0.25 : 0
      bands.push(s('path', { class: 't36g-band', d: d0 }), s('path', { class: 't36g-bshade', d: d0, style: `opacity:${(Math.pow(1 - z / rh, 1.6) * 0.42 + under).toFixed(3)}` }))
    }
    const top = ring(pr, R, rh, 44)
    // the stone's grain: dark pits and pale crystals over the visible (near) half of the wall
    const sr = rng(3720)
    let pits = '', glints = ''
    for (let i = 0; i < (low ? 90 : 220); i++) {
      const a = 0.08 + sr() * (Math.PI - 0.16), zz = sr() * 0.9
      const rad = R * (0.83 + 0.15 * Math.sin(Math.min(1, zz / 0.6) * Math.PI * 0.5))
      const [x, y] = pr(Math.cos(a) * rad, Math.sin(a) * rad, zz * rh)
      const k = 0.6 + sr() * 1.6
      if (sr() < 0.6) pits += `M${f1(x)} ${f1(y)}h${f1(k)}`
      else glints += `M${f1(x)} ${f1(y)}h${f1(k * 0.8)}`
    }
    // moss on the wall where it stays damp: under the lip at the back left, and in a long drip on the near left
    let moss = ''
    for (const [a, z, k] of [[3.6, 0.82, 0.13], [2.4, 0.76, 0.1], [2.75, 0.55, 0.07], [4.4, 0.8, 0.08]] as const) {
      const [mx, my] = pr(Math.cos(a) * R * 0.98, Math.sin(a) * R * 0.98, z * rh)
      moss += blob(mx, my, R * k, R * k * 0.45, 3721 + a * 10, 0.3, 12)
    }
    // two small stones and some grass on the sand
    const stone = (X: number, Y: number, w: number, seed: number) => {
      const [x, y] = pr(X, Y, 0)
      return s('g', { transform: `translate(${f1(x)} ${f1(y)})` }, rockArt(w, w * 0.62, seed))
    }
    const [g1x, g1y] = pr(-R * 1.25, R * 0.45, 0), [g2x, g2y] = pr(R * 1.3, -R * 0.2, 0)
    body.replaceChildren(
      s('defs', null,
        s('radialGradient', { id: 't36g-groundg', cx: f1(gx), cy: f1(gy), r: f1(groundR), gradientUnits: 'userSpaceOnUse', gradientTransform: `translate(${f1(gx)} ${f1(gy)}) scale(1 0.62) translate(${f1(-gx)} ${f1(-gy)})` },
          s('stop', { offset: 0, class: 't36g-gs0' }), s('stop', { offset: 0.62, class: 't36g-gs1' }), s('stop', { offset: 1, class: 't36g-gs2' })),
        s('linearGradient', { id: 't36g-wallg', x1: f1(-R * 0.05), x2: f1(d + R * 0.05), y1: 0, y2: 0, gradientUnits: 'userSpaceOnUse' },
          s('stop', { offset: 0, class: 't36g-w0' }), s('stop', { offset: 0.3, class: 't36g-w1' }), s('stop', { offset: 0.66, class: 't36g-w2' }), s('stop', { offset: 1, class: 't36g-w3' })),
        s('filter', { id: 't36g-soft', x: '-30%', y: '-30%', width: '160%', height: '160%' }, s('feGaussianBlur', { stdDeviation: f1(d * 0.03) }))),
      s('ellipse', { cx: f1(gx), cy: f1(gy), rx: f1(groundR), ry: f1(groundR * 0.62), fill: 'url(#t36g-groundg)' }),
      s('path', { class: 't36g-rake', d: rake }),
      s('path', { class: 't36g-cshadow', d: shadow, transform: `translate(${f1(R * 0.1)} ${f1(-R * 0.04)})`, filter: low ? null : 'url(#t36g-soft)' }),
      s('path', { class: 't36g-ao', d: ring(pr, R * 0.9, 0, 40) }),
      ink(blob(...pr(-R * 1.5, -R * 0.4, 0), R * 0.35, R * 0.14, 3722, 0.25) + blob(...pr(R * 1.1, R * 0.8, 0), R * 0.3, R * 0.1, 3723, 0.25), 't36g-gmoss', 'wash'),
      stone(-R * 1.28, R * 0.3, 54, 3724),
      stone(R * 1.38, -R * 0.35, 40, 3725),
      grass(g1x - R * 0.42, g1y + 6, R * 0.24, 3726),
      grass(g2x + R * 0.3, g2y + 3, R * 0.2, 3727),
      s('g', { filter: low ? null : 'url(#ink-rough)' }, ...bands),
      s('path', { class: 't36g-pits', d: pits }),
      s('path', { class: 't36g-glints', d: glints }),
      ink(moss, 't36g-moss', 'wash'),
      s('path', { class: 't36g-lip', d: top }),
      s('path', { class: 't36g-inner', d: ring(pr, R * 0.84, rh, 44) }))
  }

  /** the far layer (moon, ink hills, mist behind the basin) and the near one (grass and a stone, big and soft) */
  function paintFar(sy: number, pr: (X: number, Y: number, Z: number) => Pt) {
    for (const v of [far, near]) {
      v.setAttribute('viewBox', `0 0 ${f1(AW)} ${f1(SH)}`)
      v.style.height = `${f1(SH)}px`
    }
    const horizon = sy + pr(0, -D * 1.5, 0)[1]
    const mr = clamp(SH * 0.045, 14, 30)
    far.replaceChildren(
      mist(AW * 0.5, horizon - SH * 0.05, AW * 0.7, SH * 0.2),
      moon(wide ? AW * 0.8 : AW * 0.8, wide ? SH * 0.12 : SH * 0.07, mr, 3730, true),
      hills(-AW * 0.05, AW * 1.05, horizon, SH * (wide ? 0.16 : 0.1), 3731, 0.9, 6),
      hills(AW * 0.55, AW * 1.1, horizon + SH * 0.02, SH * (wide ? 0.1 : 0.07), 3732, 0.65, 2),
      mist(AW * 0.5, horizon + SH * 0.03, AW * 0.8, SH * 0.07))
    near.replaceChildren(
      s('g', { class: 't36g-nearg' },
        s('g', { class: 't36g-reedg' }, reeds(AW * 0.03, SH * 1.02, SH * (wide ? 0.32 : 0.22), 3733, 8)),
        s('g', { transform: `translate(${f1(AW * 0.96)} ${f1(SH * 1.02)})` }, rockArt(wide ? AW * 0.13 : AW * 0.26, wide ? SH * 0.12 : SH * 0.08, 3734)),
        grass(AW * 0.86, SH * 1.01, AW * 0.08, 3735)))
  }

  // ── colours for the game (read on mount and on theme change, never per frame)
  let col = { ink: '', moon: '', red: '', leaf: '', fly: '', card: '', water: '' }
  const readCol = () => {
    const dark = document.documentElement.dataset.theme === 'dark'
    col = { ink: cssVar('--ink'), moon: cssVar('--moon'), red: cssVar('--vermilion'), leaf: cssVar('--lantern'), fly: cssVar('--firefly'), card: cssVar(dark ? '--moon' : '--card'), water: cssVar(dark ? '--umbra' : '--water') }
    loop.wake()
  }

  // ── building: the lit sheet sinks into the basin; the pond comes one step more alive
  function add(i: number) {
    if (mode !== 'build') return
    if (i !== next) {
      // not this one yet: it shakes and the prompt names the sheet that comes first (one feature builds on the last)
      if (i > next) GD.wrong(fill(K.wrongOrder, { name: K.layers[next].name }), sheets[i])
      return
    }
    next++
    const sh = sheets[i]
    sh.classList.remove('lit')
    sh.classList.add('down')
    sh.querySelector('button')!.setAttribute('aria-disabled', 'true')
    sheets[next]?.classList.add('lit')
    sheets[next]?.querySelector('button')!.removeAttribute('aria-disabled')
    root.classList.add(`on-${i}`)
    ripple.classList.remove('go')
    void ripple.offsetWidth
    ripple.classList.add('go')
    ctx.chime('tap')
    wake()
    // the prompts so far, carved round the rim in two lines (the older ones outside)
    const all = K.layers.slice(0, next).map((l) => l.prompt)
    const cut = Math.ceil(all.length / 2)
    rimText.firstElementChild!.textContent = all.slice(0, cut).join('  ·  ')
    rimText2.firstElementChild!.textContent = all.slice(cut).join('  ·  ')
    said.replaceChildren(h('p', { class: 't36g-eye' }, `${fill(K.layerAria, { n: i + 1, name: K.layers[i].name })} · ${K.promptLabel}`), h('p', { class: 't36g-prompt' }, K.layers[i].prompt), i === 0 ? ctx.fact(F(K.facts[0]), 'p', 't36g-fact') : '')
    if (!said.hasAttribute('aria-live')) said.setAttribute('aria-live', 'polite')
    if (next < N) sheets[next].querySelector('button')!.focus({ preventScroll: true })
    else {
      start.hidden = false
      ctx.insight(F(K.insight), K.detail)
      start.focus({ preventScroll: true })
    }
  }

  // ── game state (pre-allocated: nothing is created per frame) ──
  let mode: 'build' | 'play' | 'end' = 'build'
  let score = 0, lives = 3, left = 30, spawn = 0, paused = false, shown = ''
  let W = 300, H = 300, dpr = 1
  const koiP = { x: 150, y: 170, tx: 150, ty: 170, a: 0 }
  const keys = { l: false, r: false, u: false, d: false }
  const items: Item[] = Array.from({ length: 12 }, () => ({ on: false, x: 0, y: 0, v: 0, leaf: false }))
  const rings: Ring[] = Array.from({ length: 6 }, () => ({ on: false, x: 0, y: 0, t: 0 }))
  const flies = Array.from({ length: 7 }, () => ({ x: r(), y: r(), p: r() * TAU }))
  const loop = createLoop(cv, frame, { essential: true })
  ctx.onCleanup(() => loop.dispose())
  ctx.onCleanup(onPrefs(readCol))
  readCol()

  /** the canvas is the water's plane in the world (0.84 d across); only its pixel size needs setting */
  function fitGame() {
    W = H = Math.max(40, D * 0.84)
    const zoom = parseFloat(root.style.getPropertyValue('--zoom')) || 1
    dpr = Math.min(2.5, (devicePixelRatio || 1) * zoom * 1.15)
    cv.width = Math.round(W * dpr)
    cv.height = Math.round(H * dpr)
    loop.wake()
  }

  // ── input: the pointer's spot on the water — back through the zoom and the projection onto the water's plane
  const aim = (e: PointerEvent) => {
    if (mode !== 'play' || (e.target as Element).closest('button')) return
    const b = scene.getBoundingClientRect(), z = b.width / D
    const [X, Y] = unprojector(D)((e.clientX - b.left) / z, (e.clientY - b.top) / z, RH * WZ * D)
    koiP.tx = X + W / 2
    koiP.ty = Y + H / 2
  }
  scene.addEventListener('pointerdown', aim)
  scene.addEventListener('pointermove', aim)
  const key = (down: boolean) => (e: KeyboardEvent) => {
    const k = ({ ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd' } as const)[e.key as 'ArrowLeft']
    if (!k || mode !== 'play') return
    e.preventDefault()
    keys[k] = down
  }
  const kd = key(true), ku = key(false)
  cv.addEventListener('keydown', kd)
  cv.addEventListener('keyup', ku)

  // ── sound: a soft "tõm", off by default ──
  let ac: AudioContext | null = null
  let soundOn = false
  ctx.onCleanup(() => void ac?.close())
  function plop() {
    if (!soundOn) return
    try {
      ac ??= new AudioContext()
      const o = ac.createOscillator(), gn = ac.createGain(), t = ac.currentTime
      o.frequency.setValueAtTime(420, t)
      o.frequency.exponentialRampToValueAtTime(140, t + 0.18)
      gn.gain.setValueAtTime(0.06, t)
      gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.3)
      o.connect(gn).connect(ac.destination)
      o.start(t)
      o.stop(t + 0.32)
    } catch {
      /* no audio: silent */
    }
  }
  function toggleSound() {
    soundOn = !soundOn
    const t = soundOn ? P.mute : P.sound
    sound.setAttribute('aria-label', t)
    sound.title = t
    sound.setAttribute('aria-pressed', String(soundOn))
    plop()
  }

  // ── play: the view leans in over the basin, the game runs in its water ──
  function play() {
    mode = 'play'
    root.classList.add('is-play')
    rz = 0
    pose()
    start.hidden = true
    endBox.hidden = true
    score = 0
    lives = 3
    left = 30
    spawn = 0
    paused = false
    shown = ''
    items.forEach((it) => (it.on = false))
    rings.forEach((it) => (it.on = false))
    fitGame()
    koiP.x = koiP.tx = W / 2
    koiP.y = koiP.ty = H * 0.62
    cv.hidden = false
    hud.hidden = false
    cv.removeAttribute('aria-hidden')
    cv.setAttribute('role', 'application')
    cv.setAttribute('aria-label', P.region)
    cv.tabIndex = 0
    cv.focus({ preventScroll: true })
    pause.setAttribute('aria-label', P.pause)
    pause.title = P.pause
    pause.classList.remove('on')
    loop.start()
  }
  function togglePause() {
    if (mode !== 'play') return
    paused = !paused
    const t = paused ? P.resume : P.pause
    pause.setAttribute('aria-label', t)
    pause.title = t
    pause.classList.toggle('on', paused)
    if (paused) loop.stop()
    else {
      loop.start()
      cv.focus({ preventScroll: true })
    }
  }
  function end() {
    mode = 'end'
    loop.stop()
    root.classList.add('is-end')
    endMsg.textContent = fill(P.end, { n: score })
    live.textContent = fill(P.endAria, { n: score })
    endBox.hidden = false
    again.focus({ preventScroll: true })
    ctx.chime('ok')
  }
  function hudText() {
    const t = `${score}|${lives}|${Math.ceil(left)}`
    if (t === shown) return
    shown = t
    scoreEl.textContent = fill(P.score, { n: score })
    livesEl.textContent = fill(P.lives, { n: lives })
    timeEl.textContent = fill(P.time, { n: Math.ceil(left) })
    hudCarve.firstElementChild!.textContent = `${scoreEl.textContent}  ·  ${livesEl.textContent}  ·  ${timeEl.textContent}`
  }

  function step(dt: number) {
    left -= dt
    const sp = 260 * dt
    if (keys.l) koiP.tx -= sp
    if (keys.r) koiP.tx += sp
    if (keys.u) koiP.ty -= sp
    if (keys.d) koiP.ty += sp
    // the koi stays in the water: a circle (the canvas is the basin's round of water)
    const rx = W / 2 - 22, ry = H / 2 - 22, ox = koiP.tx - W / 2, oy = koiP.ty - H / 2, q = Math.hypot(ox / rx, oy / ry)
    if (q > 1) (koiP.tx = W / 2 + ox / q), (koiP.ty = H / 2 + oy / q)
    const dx = koiP.tx - koiP.x, dy = koiP.ty - koiP.y
    const k = Math.min(1, dt * 5)
    koiP.x += dx * k
    koiP.y += dy * k
    if (dx * dx + dy * dy > 4) koiP.a = Math.atan2(dy, dx)
    spawn -= dt
    const z = W / 220
    if (spawn <= 0) {
      spawn = ctx.reduced ? 1.2 : Math.max(0.42, 0.95 - (30 - left) * 0.018)
      const it = items.find((x) => !x.on)
      if (it) {
        it.on = true
        it.x = W * 0.2 + r() * W * 0.6
        it.y = H * 0.08
        it.leaf = r() < 0.3
        it.v = (ctx.reduced ? 38 : 70 + (30 - left) * 3.2) * z * 0.8
      }
    }
    for (const it of items) {
      if (!it.on) continue
      it.y += it.v * dt
      const ex = it.x - koiP.x, ey = it.y - koiP.y
      if (ex * ex + ey * ey < (26 * z) ** 2) {
        it.on = false
        if (it.leaf) lives--
        else {
          score++
          plop()
          const rg = calm ? null : rings.find((x) => !x.on)
          if (rg) Object.assign(rg, { on: true, x: it.x, y: it.y, t: 0 })
        }
      } else if (Math.hypot(it.x - W / 2, it.y - H / 2) > W / 2 - 4 && it.y > H / 2) it.on = false
    }
    for (const rg of rings) if (rg.on && (rg.t += dt) > 1) rg.on = false
    hudText()
    if (left <= 0 || lives <= 0) {
      left = Math.max(0, left)
      hudText()
      end()
    }
  }

  /** The game on its canvas, the basin's water: the koi fills it (it is a big fish in a small pond). */
  function frame(t: number, dt: number): boolean {
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, W, H)
    const z = W / 220
    if (mode === 'build') return false
    if (mode === 'play' && !paused) step(dt)
    g.save()
    g.beginPath()
    g.arc(W / 2, H / 2, W / 2, 0, TAU)
    g.clip()
    for (const it of items) if (it.on) {
      // its shadow on the water, then the thing itself
      g.fillStyle = col.water
      g.globalAlpha = 0.5
      g.beginPath()
      g.ellipse(it.x + 5 * z, it.y + 7 * z, 7 * z, 3 * z, 0, 0, TAU)
      g.fill()
      g.globalAlpha = 1
      g.fillStyle = it.leaf ? col.leaf : col.moon
      g.beginPath()
      if (it.leaf) g.ellipse(it.x, it.y, 10 * z, 5 * z, 0.6, 0, TAU)
      else {
        g.moveTo(it.x - 8 * z, it.y + 4.5 * z)
        g.lineTo(it.x + 2 * z, it.y - 9 * z)
        g.lineTo(it.x + 9 * z, it.y + 5.5 * z)
      }
      g.fill()
    }
    if (!calm) {
      g.strokeStyle = col.moon
      g.lineWidth = 1.4
      for (const rg of rings) if (rg.on) {
        g.globalAlpha = 1 - rg.t
        g.beginPath()
        g.ellipse(rg.x, rg.y, (6 + rg.t * 30) * z, (6 + rg.t * 30) * z * 0.8, 0, 0, TAU)
        g.stroke()
      }
      g.fillStyle = col.fly
      for (const f of flies) {
        g.globalAlpha = 0.35 + 0.35 * Math.sin(t * 1.7 + f.p)
        g.beginPath()
        g.arc(W * (0.2 + f.x * 0.6) + Math.sin(t * 0.4 + f.p) * 12, H * (0.15 + f.y * 0.5) + Math.cos(t * 0.5 + f.p) * 8, 2.4 * Math.sqrt(z), 0, TAU)
        g.fill()
      }
      g.globalAlpha = 1
    }
    // the koi: its shadow below, a white body, vermilion patches, a beating tail
    g.save()
    g.translate(koiP.x + 6 * z, koiP.y + 9 * z)
    g.rotate(koiP.a)
    g.scale(z, z)
    g.fillStyle = col.water
    g.globalAlpha = 0.55
    g.beginPath()
    g.ellipse(-4, 0, 26, 9, 0, 0, TAU)
    g.fill()
    g.restore()
    g.save()
    g.translate(koiP.x, koiP.y)
    g.rotate(koiP.a)
    g.scale(z, z)
    const sw = calm ? 0 : Math.sin(t * 6) * 0.25
    g.fillStyle = col.card
    g.globalAlpha = 0.85
    g.beginPath()
    g.moveTo(-19, 0)
    g.lineTo(-35, -10 + sw * 10)
    g.lineTo(-32, 0 + sw * 6)
    g.lineTo(-35, 10 + sw * 10)
    g.closePath()
    g.fill()
    g.beginPath()
    g.ellipse(-2, -8, 6, 3, -0.5, 0, TAU)
    g.ellipse(-2, 8, 6, 3, 0.5, 0, TAU)
    g.fill()
    g.globalAlpha = 1
    g.beginPath()
    g.ellipse(0, 0, 23, 9.5, 0, 0, TAU)
    g.fill()
    g.fillStyle = col.red
    g.beginPath()
    g.ellipse(7, -1, 8, 5.2, 0.2, 0, TAU)
    g.ellipse(-8, 2, 5.5, 4, 0, 0, TAU)
    g.fill()
    g.fillStyle = col.ink
    g.beginPath()
    g.arc(17, -3.6, 1.3, 0, TAU)
    g.arc(17, 3.6, 1.3, 0, TAU)
    g.fill()
    g.restore()
    g.strokeStyle = col.ink
    g.globalAlpha = 0.4
    g.lineWidth = 1.2
    g.beginPath()
    g.arc(koiP.tx, koiP.ty, 10 * z, 0, TAU)
    g.stroke()
    g.globalAlpha = 1
    // the end: a big ensō on the water with the score in it
    if (mode === 'end') {
      const rr = Math.min(W, H) * 0.24
      g.strokeStyle = col.ink
      g.lineWidth = 8
      g.lineCap = 'round'
      g.beginPath()
      g.arc(W / 2, H / 2, rr, -1.2, 4.6)
      g.stroke()
      g.fillStyle = col.ink
      g.font = `500 ${Math.round(rr * 0.7)}px 'Noto Serif', Georgia, serif`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(String(score), W / 2, H / 2)
    }
    g.restore()
    return mode === 'play' && !paused
  }
}
