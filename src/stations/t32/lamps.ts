import raw from '../../content/tram-32.json'
import { fill, h } from '../../core/dom'
import type { Fact } from '../../core/content'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import { onPrefs } from '../../core/prefs'
import { onDigit, rng, type Pt } from '../../ui/part2/ink'
import type { SceneCtx } from '../types'
import { clamp, ease, fitCamera, flatEllipse, grainOver, live, mix, palette, poly, polyClip, radial, rgba, stageSize, type Cam, type Pal, type RGB, type V3 } from './kit'

const K = raw.scenes.lamps
type Id = 'lmstudio' | 'ollama' | 'llamacpp'

/** what stands on the shelf (t along it, 0 = near end) and its rough size (radius, height) for shadows and hit areas */
const PROPS: Record<Id | 'jar', { t: number; r: number; hgt: number }> = {
  lmstudio: { t: 0.1, r: 0.15, hgt: 0.5 },
  ollama: { t: 0.5, r: 0.13, hgt: 0.16 },
  llamacpp: { t: 0.82, r: 0.075, hgt: 0.3 },
  jar: { t: 0.95, r: 0.085, hgt: 0.2 },
}

/**
 * Scene 3 — a dark room, one long shelf running away from you (two vanishing points). Near: a paper lantern with its lid
 * open (LM Studio); middle: an oil lamp whose wick must be turned up (Ollama); far: a bare flame in a glass chimney
 * (llama.cpp), at first the only light, beside a jar of oil sealed GGUF. Carry fire from the far flame to the others:
 * the light and the shadows on the bamboo wall follow your hand. Canvas: the room painted lit and unlit once, then
 * composited per frame through a light map (radial pools minus projected shadows), only while something moves.
 */
export function lampsScene(ctx: SceneCtx) {
  const low = ctx.quality === 'low'
  const still = low || ctx.reduced
  const lit = new Set<Id>(['llamacpp'])
  let wick = 0, wickTo = 0 // Ollama's wick: 0 down … 1 up
  let shown: Id | null = null
  let thread = 0 // the oil threads, drawn in once all three burn
  let taper: { x: number; y: number; z: number; on: boolean; t: number; to: Id | null; from: V3 } | null = null
  let flick = 0 // a breath in the flames (high quality, a while after input)
  let idle = 0

  // ── DOM ──
  const cv = h('canvas', { class: 't32-cv t32-bleed', 'aria-hidden': 'true' })
  const info = live('t32l-info')
  info.hidden = true
  const seal = h('span', { class: 't32l-seal', 'aria-hidden': 'true' }, 'GGUF')
  const btn: Record<Id, HTMLButtonElement> = {} as Record<Id, HTMLButtonElement>
  const plaque: Record<Id, HTMLElement> = {} as Record<Id, HTMLElement>
  for (const lp of K.lamps) {
    const id = lp.id as Id
    plaque[id] = h('span', { class: 't32l-name' }, lp.name)
    btn[id] = h('button', { class: 't32l-lamp', type: 'button', 'aria-label': fill(K.lampAria, { name: lp.name }), 'aria-pressed': String(lit.has(id)) }, plaque[id])
    btn[id].addEventListener('click', () => !btn[id].dataset.dragged && touch(id))
    btn[id].addEventListener('keydown', (e) => {
      if (id === 'ollama' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault()
        setWick(e.key === 'ArrowUp' ? 1 : 0)
      }
    })
  }
  btn.llamacpp.addEventListener('pointerdown', (e) => grab(e))
  const knob = h('button', { class: 't32l-knob', type: 'button', 'aria-label': K.wickAria, 'aria-pressed': 'false' })
  knob.addEventListener('click', () => setWick(wickTo ? 0 : 1))
  const root = h('div', { class: 't32 t32l', role: 'group', 'aria-label': K.aria },
    cv,
    h('div', { class: 't32-mist', 'aria-hidden': 'true' }),
    h('p', { class: 'visually-hidden' }, K.art),
    seal, btn.lmstudio, btn.ollama, btn.llamacpp, knob, info)
  ctx.art.append(root)

  // ── geometry and layers ──
  let W = 0, H = 0, tall = false
  let P: Pal = palette()
  const POOL = radial([0, 0, 0], [[0, 1], [0.25, 0.75], [0.6, 0.25], [1, 0]])
  let HALO = radial(P.lantern, [[0, 1], [0.35, 0.35], [1, 0]])
  let FLAME = '', CORE = '', THREAD = ''
  const tones = () => {
    HALO = radial(P.lantern, [[0, 1], [0.35, 0.35], [1, 0]])
    FLAME = rgba(mix(P.lantern, P.moon, 0.2))
    CORE = rgba(P.moon)
    THREAD = rgba(P.lantern, 0.85)
  }
  tones()
  let cam: Cam = fitCamera({ yaw: 0, pitch: 10, fov: 40, W: 100, H: 100, box: [[0, 0, 0], [1, 1, 1]], rect: [0, 0, 100, 100] })
  let S0: V3 = [0, 0, 0], S1: V3 = [0, 0, 0]
  const TOP = 0.86, DEPTH = 0.3, WALL = -1.9
  const layer = () => document.createElement('canvas')
  const L = { bgDark: layer(), bgLit: layer(), fgDark: layer(), fgLit: layer(), mask: layer(), tmp: layer() }
  let dpr = 1
  let c: CanvasRenderingContext2D | null = null
  const at = (t: number, up = 0): V3 => [S0[0] + (S1[0] - S0[0]) * t, TOP + up, S0[2] + (S1[2] - S0[2]) * t]
  const flameOf = (id: Id): V3 => {
    const p = at(PROPS[id].t)
    if (id === 'lmstudio') return [p[0], TOP + 0.19, p[2]]
    if (id === 'ollama') return [p[0] + 0.07, TOP + 0.1 + wick * 0.025, p[2]]
    return [p[0], TOP + 0.12, p[2]]
  }

  // ── painting the room once (lit and unlit), objects as simple solids with ink edges ──
  /** the room's own tone in the dark: a night room in both themes (the page around it may be light) */
  const night = () => (P.dark ? mix(P.paper, P.wash, 0.55) : mix(P.ink, P['rock-lo'], 0.2))
  function* wallPaint(g: CanvasRenderingContext2D, litOn: boolean) {
    const base = litOn ? mix(P['step-mid'], P.lantern, P.dark ? 0.35 : 0.3) : night()
    const slat = litOn ? mix(P['step-hi'], P.lantern, 0.35) : mix(base, P['rock-lo'], P.dark ? 0.12 : 0.18)
    const gap = litOn ? mix(P['rock-lo'], P.umbra, 0.5) : mix(base, P.umbra, P.dark ? 0.6 : 0.5)
    const node = litOn ? mix(slat, P.moon, 0.35) : mix(slat, P.moon, 0.06)
    // floor
    polyClip(g, cam, [[-6, 0, WALL], [6, 0, WALL], [6, 0, 6], [-6, 0, 6]])
    g.fillStyle = rgba(litOn ? mix(P['rock-lo'], P.lantern, 0.22) : mix(base, P.umbra, 0.35))
    g.fill()
    // the bamboo screen: a dark backing, slats of uneven width with their nodes, three bound rails
    polyClip(g, cam, [[-6, 0, WALL], [6, 0, WALL], [6, 4, WALL], [-6, 4, WALL]])
    g.fillStyle = rgba(gap)
    g.fill()
    const r = rng(3401)
    let x = -6
    for (let i = 0; x < 6; i++) {
      if (i % 30 === 29) yield
      const w = 0.03 + r() * 0.045
      const tone = mix(slat, gap, r() * 0.3)
      poly(g, cam, [[x, 0, WALL + 0.01], [x + w, 0, WALL + 0.01], [x + w, 4, WALL + 0.01], [x, 4, WALL + 0.01]])
      g.fillStyle = rgba(tone)
      g.fill()
      // the slat is round: a lit edge on its left, its right falling into shade
      poly(g, cam, [[x + w * 0.62, 0, WALL + 0.011], [x + w, 0, WALL + 0.011], [x + w, 4, WALL + 0.011], [x + w * 0.62, 4, WALL + 0.011]])
      g.fillStyle = rgba(gap, 0.35)
      g.fill()
      // nodes every 35–45 cm, staggered from slat to slat: a pale ring over a dark line
      for (let ny = 0.12 + r() * 0.35; ny < 4; ny += 0.35 + r() * 0.1) {
        poly(g, cam, [[x, ny, WALL + 0.012], [x + w, ny, WALL + 0.012], [x + w, ny + 0.012, WALL + 0.012], [x, ny + 0.012, WALL + 0.012]])
        g.fillStyle = rgba(node, 0.8)
        g.fill()
        poly(g, cam, [[x, ny - 0.008, WALL + 0.012], [x + w, ny - 0.008, WALL + 0.012], [x + w, ny, WALL + 0.012], [x, ny, WALL + 0.012]])
        g.fillStyle = rgba(gap, 0.75)
        g.fill()
      }
      x += w + 0.006 + r() * 0.014
    }
    const rail = litOn ? mix(P['rock-mid'], P.lantern, 0.25) : mix(gap, P['rock-lo'], 0.25)
    const twine = litOn ? mix(P['rock-lo'], P.umbra, 0.3) : mix(gap, P.umbra, 0.3)
    for (const ry of [0.42, 1.28, 2.14]) {
      poly(g, cam, [[-6, ry, WALL + 0.035], [6, ry, WALL + 0.035], [6, ry + 0.04, WALL + 0.035], [-6, ry + 0.04, WALL + 0.035]])
      g.fillStyle = rgba(rail)
      g.fill()
      poly(g, cam, [[-6, ry + 0.028, WALL + 0.036], [6, ry + 0.028, WALL + 0.036], [6, ry + 0.04, WALL + 0.036], [-6, ry + 0.04, WALL + 0.036]])
      g.fillStyle = rgba(P.moon, litOn ? 0.28 : 0.06)
      g.fill()
      // twine lashings: a little cross every 30 cm
      g.strokeStyle = rgba(twine, 0.9)
      g.lineWidth = 1
      g.beginPath()
      for (let lx = -6 + r() * 0.2; lx < 6; lx += 0.3) {
        cam.p(lx - 0.012, ry - 0.008, WALL + 0.04); g.moveTo(cam.o[0], cam.o[1])
        cam.p(lx + 0.012, ry + 0.048, WALL + 0.04); g.lineTo(cam.o[0], cam.o[1])
        cam.p(lx + 0.012, ry - 0.008, WALL + 0.04); g.moveTo(cam.o[0], cam.o[1])
        cam.p(lx - 0.012, ry + 0.048, WALL + 0.04); g.lineTo(cam.o[0], cam.o[1])
      }
      g.stroke()
    }
    if (!litOn) {
      // the moon finds the room faintly: a cool wash high on the screen, so the dark has a shape
      cam.p(S0[0] - 0.6, 2.4, WALL)
      const mg = g.createRadialGradient(cam.o[0], cam.o[1], 0, cam.o[0], cam.o[1], Math.max(W, H) * 0.7)
      mg.addColorStop(0, rgba(P.moon, P.dark ? 0.09 : 0.12))
      mg.addColorStop(1, rgba(P.moon, 0))
      g.fillStyle = mg
      g.fillRect(0, 0, W, H)
    }
    grainOver(g, W, H, P.dark ? 0.45 : 0.35)
  }

  function shelfPaint(g: CanvasRenderingContext2D, litOn: boolean) {
    const wood = litOn ? mix(P['rock-mid'], P.lantern, 0.3) : mix(night(), P['rock-lo'], P.dark ? 0.25 : 0.3)
    const woodTop = litOn ? mix(P['rock-hi'], P.lantern, 0.35) : mix(night(), P['rock-lo'], P.dark ? 0.45 : 0.5)
    const dx = S1[0] - S0[0], dz = S1[2] - S0[2], dl = Math.hypot(dx, dz)
    const nx = (-dz / dl) * DEPTH * 0.5, nz = (dx / dl) * DEPTH * 0.5 // across the shelf
    const ink = rgba(P.dark ? P.wash : P.ink, litOn ? 0.75 : 0.5)
    // legs, then the slab: front face, top, and the near end
    for (const t of [0.04, 0.5, 0.96]) {
      const p = at(t)
      for (const s of [-0.8, 0.8]) {
        const x = p[0] + nx * s, z = p[2] + nz * s
        poly(g, cam, [[x - 0.025, 0, z], [x + 0.025, 0, z], [x + 0.025, TOP - 0.05, z], [x - 0.025, TOP - 0.05, z]])
        g.fillStyle = rgba(mix(wood, P.umbra, 0.25))
        g.fill()
      }
    }
    const a0: V3 = [S0[0] + nx, TOP, S0[2] + nz], a1: V3 = [S1[0] + nx, TOP, S1[2] + nz]
    const b0: V3 = [S0[0] - nx, TOP, S0[2] - nz], b1: V3 = [S1[0] - nx, TOP, S1[2] - nz]
    const dn = (p: V3): V3 => [p[0], p[1] - 0.055, p[2]]
    poly(g, cam, [a0, a1, dn(a1), dn(a0)])
    g.fillStyle = rgba(wood)
    g.fill()
    poly(g, cam, [a0, a1, b1, b0])
    g.fillStyle = rgba(woodTop)
    g.fill()
    poly(g, cam, [b0, a0, dn(a0), dn(b0)])
    g.fillStyle = rgba(mix(wood, P.umbra, 0.2))
    g.fill()
    g.strokeStyle = ink
    g.lineWidth = 1.6
    g.beginPath()
    cam.p(a0[0], a0[1], a0[2]); g.moveTo(cam.o[0], cam.o[1])
    cam.p(a1[0], a1[1], a1[2]); g.lineTo(cam.o[0], cam.o[1])
    g.stroke()
    // a thread of moon along the front edge
    g.strokeStyle = rgba(P.moon, litOn ? 0.4 : 0.18)
    g.lineWidth = 1
    g.beginPath()
    cam.p(a0[0], a0[1] + 0.002, a0[2]); g.moveTo(cam.o[0], cam.o[1] - 1)
    cam.p(a1[0], a1[1] + 0.002, a1[2]); g.lineTo(cam.o[0], cam.o[1] - 1)
    g.stroke()
    // grain along the top
    g.strokeStyle = rgba(P.dark ? P.umbra : P['rock-lo'], 0.35)
    g.lineWidth = 0.7
    g.beginPath()
    for (let i = 1; i < 6; i++) {
      const s = -0.8 + i * 0.27
      cam.p(S0[0] + nx * s + dx * 0.03, TOP + 0.001, S0[2] + nz * s + dz * 0.03); g.moveTo(cam.o[0], cam.o[1])
      cam.p(S0[0] + nx * s + dx * (0.6 + i * 0.07), TOP + 0.001, S0[2] + nz * s + dz * (0.6 + i * 0.07)); g.lineTo(cam.o[0], cam.o[1])
    }
    g.stroke()
    // contact shadows of the things on the shelf
    for (const id of ['lmstudio', 'ollama', 'llamacpp', 'jar'] as const) {
      const p = at(PROPS[id].t)
      g.fillStyle = rgba(P.umbra, litOn ? 0.35 : 0.2)
      flatEllipse(g, cam, p[0], TOP + 0.002, p[2], PROPS[id].r * 1.2, PROPS[id].r * 1.1, 18)
      g.fill()
    }
    lantern(g, litOn)
    oilLamp(g, litOn)
    chimney(g, litOn)
    jar(g, litOn)
  }

  /** a vertical cylinder centred on (x, z) from y0 to y1, radius r: a shaded body between its rims */
  function vcyl(g: CanvasRenderingContext2D, x: number, z: number, y0: number, y1: number, r0: number, r1: number, col: RGB, litOn: boolean, edge = true) {
    const d = cam.p(x, y0, z)
    const bx = cam.o[0], by = cam.o[1], rb = r0 * cam.k(d)
    const d1 = cam.p(x, y1, z)
    const tx = cam.o[0], ty = cam.o[1], rt = r1 * cam.k(d1)
    const gr = g.createLinearGradient(bx - rb, 0, bx + rb, 0)
    gr.addColorStop(0, rgba(mix(col, P.umbra, litOn ? 0.15 : 0.35)))
    gr.addColorStop(0.45, rgba(col))
    gr.addColorStop(1, rgba(mix(col, P.umbra, litOn ? 0.35 : 0.5)))
    g.fillStyle = gr
    g.beginPath()
    g.moveTo(tx - rt, ty)
    g.lineTo(bx - rb, by)
    g.ellipse(bx, by, rb, rb * 0.28, 0, Math.PI, 0, true)
    g.lineTo(tx + rt, ty)
    g.ellipse(tx, ty, rt, rt * 0.28, 0, 0, Math.PI, true)
    g.fill()
    if (!edge) return
    g.strokeStyle = rgba(P.dark ? P.wash : P.ink, litOn ? 0.7 : 0.45)
    g.lineWidth = 1.1
    g.stroke()
  }

  /** the paper lantern's outline and ribs on screen (the camera is fixed per layout): reused for its glow when lit */
  let LAN: { body: Path2D; ribs: Path2D; x: number; y0: number; y1: number; k: number } | null = null
  function lanternGeo() {
    const p = at(PROPS.lmstudio.t)
    const y0 = TOP + 0.06, y1 = TOP + 0.42, n = 12
    const rad = (u: number) => 0.1 + 0.058 * Math.sin(Math.PI * u)
    const L: Pt[] = [], R: Pt[] = []
    let k = 1, e = 0.28
    for (let i = 0; i <= n; i++) {
      const u = i / n
      const d = cam.p(p[0], y0 + (y1 - y0) * u, p[2])
      k = cam.k(d)
      L.push([cam.o[0] - rad(u) * k, cam.o[1]])
      R.push([cam.o[0] + rad(u) * k, cam.o[1]])
    }
    cam.p(p[0], y0, p[2] + 0.1)
    const fy = cam.o[1]
    cam.p(p[0], y0, p[2])
    e = clamp((fy - cam.o[1]) / (0.1 * k), 0.12, 0.6)
    const body = new Path2D()
    body.moveTo(L[0][0], L[0][1])
    for (const q of L) body.lineTo(q[0], q[1])
    body.ellipse((L[n][0] + R[n][0]) / 2, L[n][1], (R[n][0] - L[n][0]) / 2, ((R[n][0] - L[n][0]) / 2) * e, 0, Math.PI, 0)
    for (let i = n; i >= 0; i--) body.lineTo(R[i][0], R[i][1])
    body.ellipse((L[0][0] + R[0][0]) / 2, L[0][1], (R[0][0] - L[0][0]) / 2, ((R[0][0] - L[0][0]) / 2) * e, 0, 0, Math.PI)
    body.closePath()
    const ribs = new Path2D()
    for (let i = 1; i < n; i++) {
      const cx = (L[i][0] + R[i][0]) / 2, rw = (R[i][0] - L[i][0]) / 2
      ribs.moveTo(cx + rw, L[i][1])
      ribs.ellipse(cx, L[i][1], rw, rw * e, 0, 0, Math.PI)
    }
    LAN = { body, ribs, x: (L[0][0] + R[0][0]) / 2, y0: L[0][1], y1: L[n][1], k }
  }
  /** LM Studio: a paper chōchin on a lacquered foot, ribbed, its candle and wick showing through the paper */
  function lantern(g: CanvasRenderingContext2D, litOn: boolean) {
    const p = at(PROPS.lmstudio.t)
    if (!LAN) lanternGeo()
    const { body, ribs, x, k } = LAN!
    const lac = litOn ? mix(P['rock-lo'], P.lantern, 0.15) : mix(night(), P.umbra, 0.35)
    vcyl(g, p[0], p[2], TOP, TOP + 0.06, 0.11, 0.1, lac, litOn)
    // the candle inside, seen through the paper
    vcyl(g, p[0], p[2], TOP + 0.06, TOP + 0.17, 0.02, 0.02, litOn ? mix(P.card, P.lantern, 0.3) : mix(P['step-hi'], night(), 0.45), litOn, false)
    cam.p(p[0], TOP + 0.17, p[2])
    g.strokeStyle = rgba(P.umbra, 0.9)
    g.lineWidth = 1.4
    g.beginPath(); g.moveTo(cam.o[0], cam.o[1]); g.lineTo(cam.o[0] + 0.004 * k, cam.o[1] - 0.02 * k); g.stroke()
    // translucent washi over it, shaded round
    const paper = litOn ? mix(P['step-hi'], P.lantern, 0.35) : (P.dark ? mix(P['step-mid'], night(), 0.45) : mix(P['step-mid'], night(), 0.5))
    const rr = 0.158 * k
    const gr = g.createLinearGradient(x - rr, 0, x + rr, 0)
    gr.addColorStop(0, rgba(mix(paper, P.umbra, 0.45), 0.92))
    gr.addColorStop(0.38, rgba(mix(paper, P.moon, litOn ? 0.2 : 0.12), 0.8))
    gr.addColorStop(1, rgba(mix(paper, P.umbra, 0.55), 0.94))
    g.fillStyle = gr
    g.fill(body)
    g.strokeStyle = rgba(P.dark ? P.wash : P.umbra, litOn ? 0.5 : 0.6)
    g.lineWidth = 0.9
    g.stroke(ribs)
    g.strokeStyle = rgba(P.dark ? P.wash : P.umbra, 0.7)
    g.lineWidth = 1.1
    g.stroke(body)
    // the black lacquered rim on top, and the bail to carry it by
    vcyl(g, p[0], p[2], TOP + 0.42, TOP + 0.46, 0.1, 0.1, lac, litOn)
    cam.p(p[0] - 0.09, TOP + 0.46, p[2])
    const bx0 = cam.o[0], by0 = cam.o[1]
    cam.p(p[0] + 0.09, TOP + 0.46, p[2])
    const bx1 = cam.o[0]
    cam.p(p[0], TOP + 0.56, p[2])
    g.strokeStyle = rgba(lac)
    g.lineWidth = 1.6
    g.beginPath(); g.moveTo(bx0, by0); g.quadraticCurveTo(cam.o[0], cam.o[1] - (by0 - cam.o[1]) * 0.6, bx1, by0); g.stroke()
  }
  function oilLamp(g: CanvasRenderingContext2D, litOn: boolean) {
    const p = at(PROPS.ollama.t)
    const glaze = litOn ? mix(P['rock-mid'], P.lantern, 0.3) : mix(P['rock-lo'], P.umbra, 0.4)
    vcyl(g, p[0], p[2], TOP, TOP + 0.05, 0.05, 0.035, glaze, litOn)
    vcyl(g, p[0], p[2], TOP + 0.05, TOP + 0.09, 0.07, 0.13, glaze, litOn)
    g.fillStyle = rgba(litOn ? mix(P.lantern, P.umbra, 0.35) : P.umbra, 0.8)
    flatEllipse(g, cam, p[0], TOP + 0.089, p[2], 0.11, 0.11, 20)
    g.fill()
    // the brass wick holder and its knob at the side
    const brass = litOn ? mix(P.lantern, P.moon, 0.3) : mix(P.lantern, P.umbra, 0.55)
    vcyl(g, p[0] + 0.07, p[2], TOP + 0.08, TOP + 0.1, 0.018, 0.016, brass, litOn)
    vcyl(g, p[0] + 0.12, p[2] + 0.05, TOP + 0.06, TOP + 0.09, 0.022, 0.022, brass, litOn)
  }
  function chimney(g: CanvasRenderingContext2D, litOn: boolean) {
    const p = at(PROPS.llamacpp.t)
    const brass = litOn ? mix(P.lantern, P.moon, 0.25) : mix(P.lantern, P.umbra, 0.5)
    vcyl(g, p[0], p[2], TOP, TOP + 0.05, 0.065, 0.05, brass, litOn)
    // the glass: only its edges and a gleam
    const d = cam.p(p[0], TOP + 0.05, p[2])
    const bx = cam.o[0], by = cam.o[1], rr = 0.06 * cam.k(d)
    cam.p(p[0], TOP + 0.3, p[2])
    const ty = cam.o[1]
    g.fillStyle = rgba(litOn ? mix(P.lantern, P.moon, 0.5) : P.mist, litOn ? 0.12 : 0.06)
    g.beginPath()
    g.moveTo(bx - rr * 0.8, ty)
    g.bezierCurveTo(bx - rr * 0.6, by - (by - ty) * 0.5, bx - rr * 1.3, by - (by - ty) * 0.3, bx - rr, by)
    g.lineTo(bx + rr, by)
    g.bezierCurveTo(bx + rr * 1.3, by - (by - ty) * 0.3, bx + rr * 0.6, by - (by - ty) * 0.5, bx + rr * 0.8, ty)
    g.closePath()
    g.fill()
    g.strokeStyle = rgba(P.dark ? P['rock-hi'] : P.ink, litOn ? 0.55 : 0.3)
    g.lineWidth = 1
    g.stroke()
    g.strokeStyle = rgba(P.moon, litOn ? 0.7 : 0.3)
    g.lineWidth = 1.6
    g.beginPath()
    g.moveTo(bx - rr * 0.75, by - (by - ty) * 0.15)
    g.quadraticCurveTo(bx - rr * 1.05, by - (by - ty) * 0.35, bx - rr * 0.6, by - (by - ty) * 0.75)
    g.stroke()
  }
  function jar(g: CanvasRenderingContext2D, litOn: boolean) {
    const p = at(PROPS.jar.t)
    const glaze = litOn ? mix(P['rock-mid'], P.lantern, 0.2) : mix(P['rock-lo'], P.umbra, 0.35)
    vcyl(g, p[0], p[2], TOP, TOP + 0.16, 0.07, 0.085, glaze, litOn)
    vcyl(g, p[0], p[2], TOP + 0.16, TOP + 0.21, 0.05, 0.035, glaze, litOn)
    vcyl(g, p[0], p[2], TOP + 0.21, TOP + 0.24, 0.045, 0.045, litOn ? mix(P.card, P.lantern, 0.3) : mix(P.card, P.umbra, 0.6), litOn)
  }

  function* bake() {
    for (const k of ['bgDark', 'bgLit', 'fgDark', 'fgLit'] as const) {
      const e = L[k]
      e.width = Math.round(W * dpr)
      e.height = Math.round(H * dpr)
      const g = e.getContext('2d')!
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, W, H)
      if (k === 'bgDark' || k === 'bgLit') yield* wallPaint(g, k === 'bgLit')
      else shelfPaint(g, k === 'fgLit')
      yield
    }
    const mw = Math.max(1, Math.round(W / 2)), mh = Math.max(1, Math.round(H / 2))
    L.mask.width = L.tmp.width = mw
    L.mask.height = L.tmp.height = mh
  }

  // ── the light map: each flame's pool on the wall minus the shadows the others throw; things lit by every flame ──
  const lights: { p: V3; k: number }[] = []
  function collect() {
    lights.length = 0
    const breath = 1 + flick
    for (const lp of K.lamps) {
      const id = lp.id as Id
      if (!lit.has(id)) continue
      const k = id === 'llamacpp' ? 0.75 : id === 'lmstudio' ? 1.25 : 1.05
      lights.push({ p: flameOf(id), k: k * breath })
    }
    if (taper?.on) lights.push({ p: [taper.x, taper.y, taper.z], k: 0.7 })
  }
  function pool(g: CanvasRenderingContext2D, p: V3, k: number, s: number) {
    const d = cam.p(p[0], p[1], p[2])
    const x = cam.o[0] * s, y = cam.o[1] * s, rr = Math.min(W, H) * 0.62 * k * s * clamp(3 / d, 0.6, 1.8)
    g.drawImage(POOL, x - rr, y - rr, rr * 2, rr * 2)
  }
  /** the shadow a prop throws on the wall from light p: its box's corners pushed along the rays to z = WALL */
  const hull: number[] = []
  function shadow(g: CanvasRenderingContext2D, p: V3, q: V3, r: number, hgt: number, s: number) {
    hull.length = 0
    for (const [ox, oy, oz] of [[-r, 0, -r], [r, 0, -r], [r, 0, r], [-r, 0, r], [-r, hgt, -r], [r, hgt, -r], [r, hgt, r], [-r, hgt, r]]) {
      const qx = q[0] + ox, qy = q[1] + oy, qz = q[2] + oz
      const dz = qz - p[2]
      if (dz > -0.02) return // the prop is not between the light and the wall
      const t = (WALL - p[2]) / dz
      cam.p(p[0] + (qx - p[0]) * t, p[1] + (qy - p[1]) * t, WALL)
      hull.push(cam.o[0] * s, cam.o[1] * s)
    }
    // convex hull (gift wrap) of the 8 projected corners
    const n = hull.length / 2
    let start = 0
    for (let i = 1; i < n; i++) if (hull[i * 2] < hull[start * 2]) start = i
    g.beginPath()
    let cur = start
    for (let guard = 0; guard < 9; guard++) {
      g[guard ? 'lineTo' : 'moveTo'](hull[cur * 2], hull[cur * 2 + 1])
      let nxt = (cur + 1) % n
      for (let i = 0; i < n; i++) {
        const cr = (hull[nxt * 2] - hull[cur * 2]) * (hull[i * 2 + 1] - hull[cur * 2 + 1]) - (hull[nxt * 2 + 1] - hull[cur * 2 + 1]) * (hull[i * 2] - hull[cur * 2])
        if (cr < 0) nxt = i
      }
      cur = nxt
      if (cur === start) break
    }
    g.closePath()
    g.fill()
  }

  function frame() {
    if (!c || !W) return
    collect()
    const s = L.mask.width / W
    const m = L.mask.getContext('2d')!, t = L.tmp.getContext('2d')!
    // wall mask: per light, its pool with the others' shadows cut out, summed
    m.globalCompositeOperation = 'source-over'
    m.clearRect(0, 0, L.mask.width, L.mask.height)
    for (const li of lights) {
      t.globalCompositeOperation = 'source-over'
      t.clearRect(0, 0, L.tmp.width, L.tmp.height)
      pool(t, li.p, li.k, s)
      t.globalCompositeOperation = 'destination-out'
      t.fillStyle = 'rgba(0,0,0,0.26)'
      for (const id of ['lmstudio', 'ollama', 'llamacpp', 'jar'] as const) {
        const q = at(PROPS[id].t)
        if (Math.hypot(q[0] - li.p[0], q[2] - li.p[2]) < 0.14) continue // a lamp throws no shadow of itself
        // a penumbra that widens with the prop's distance from the screen: near the wall sharp, far from it soft
        const soft = 0.07 * Math.max(0.3, q[2] - WALL)
        for (let i = 0; i < 3; i++) shadow(t, li.p, q, PROPS[id].r * (1 + i * soft), PROPS[id].hgt * (1 + i * soft * 0.4), s)
      }
      m.globalCompositeOperation = 'lighter'
      m.drawImage(L.tmp, 0, 0)
    }
    c.globalCompositeOperation = 'source-over'
    c.clearRect(0, 0, W, H)
    c.drawImage(L.bgDark, 0, 0, W, H)
    // the lit wall through the mask (tmp = bgLit ∩ mask, at mask resolution is too soft: use a full-size pass)
    lit2(L.bgLit, L.mask)
    c.drawImage(L.fgDark, 0, 0, W, H)
    // the things on the shelf: lit by every flame, no wall shadows on them
    m.globalCompositeOperation = 'source-over'
    m.clearRect(0, 0, L.mask.width, L.mask.height)
    m.globalCompositeOperation = 'lighter'
    for (const li of lights) pool(m, li.p, li.k * 0.8, s)
    lit2(L.fgLit, L.mask)
    flames()
  }
  const big = document.createElement('canvas')
  function lit2(src: HTMLCanvasElement, mask: HTMLCanvasElement) {
    if (big.width !== src.width || big.height !== src.height) {
      big.width = src.width
      big.height = src.height
    }
    const b = big.getContext('2d')!
    b.globalCompositeOperation = 'source-over'
    b.clearRect(0, 0, big.width, big.height)
    b.drawImage(src, 0, 0)
    b.globalCompositeOperation = 'destination-in'
    b.drawImage(mask, 0, 0, big.width, big.height)
    c!.drawImage(big, 0, 0, W, H)
  }

  /** flames, their halos, the glowing paper, the taper, and the threads of oil once all burn */
  function flames() {
    const g = c!
    g.globalCompositeOperation = P.dark ? 'lighter' : 'source-over'
    for (const lp of K.lamps) {
      const id = lp.id as Id
      if (!lit.has(id)) continue
      const f = flameOf(id)
      const d = cam.p(f[0], f[1], f[2])
      const k = cam.k(d)
      if (id === 'lmstudio') {
        // the whole paper glows from within: bright round the candle, warmer toward the rims, the ribs dark against it
        const q = at(PROPS.lmstudio.t)
        cam.p(q[0], TOP + 0.24, q[2])
        halo(cam.o[0], cam.o[1], 0.5 * k, P.dark ? 0.5 : 0.4)
        if (LAN) {
          g.globalCompositeOperation = 'source-over'
          const cy = cam.o[1]
          const gl = g.createRadialGradient(LAN.x, cy + 0.03 * LAN.k, 0, LAN.x, cy, 0.24 * LAN.k)
          gl.addColorStop(0, rgba(P.moon, 0.95))
          gl.addColorStop(0.45, rgba(mix(P.lantern, P.moon, 0.35), 0.92))
          gl.addColorStop(1, rgba(mix(P.lantern, P.vermilion, 0.25), 0.9))
          g.fillStyle = gl
          g.fill(LAN.body)
          g.strokeStyle = rgba(mix(P.lantern, P.umbra, 0.55), 0.55)
          g.lineWidth = 1
          g.stroke(LAN.ribs)
          g.globalCompositeOperation = P.dark ? 'lighter' : 'source-over'
        }
      } else halo(cam.o[0], cam.o[1], (id === 'ollama' ? 0.3 : 0.2) * k, P.dark ? 0.6 : 0.45)
      const fh = (id === 'llamacpp' ? 0.07 : id === 'ollama' ? 0.06 + wick * 0.03 : 0.04) * k * (1 + flick * 2)
      cam.p(f[0], f[1], f[2])
      flameShape(cam.o[0], cam.o[1], fh)
    }
    if (taper?.on) {
      cam.p(taper.x, taper.y, taper.z)
      halo(cam.o[0], cam.o[1], 0.2 * cam.k(cam.o[2]), P.dark ? 0.6 : 0.5)
      // the taper's stick, from the hand down
      g.globalCompositeOperation = 'source-over'
      g.strokeStyle = rgba(P.dark ? P['rock-mid'] : P['ink-2'])
      g.lineWidth = 2
      g.beginPath()
      g.moveTo(cam.o[0], cam.o[1] + 4)
      g.lineTo(cam.o[0] + 26, cam.o[1] + 60)
      g.stroke()
      flameShape(cam.o[0], cam.o[1], 0.05 * cam.k(cam.o[2]))
    }
    g.globalCompositeOperation = 'source-over'
    if (thread > 0) {
      // golden threads of oil from the jar's mouth to every lamp
      const j = at(PROPS.jar.t, 0.24)
      cam.p(j[0], j[1], j[2])
      const jx = cam.o[0], jy = cam.o[1]
      g.strokeStyle = THREAD
      g.lineWidth = 1.4
      for (const id of ['llamacpp', 'ollama', 'lmstudio'] as const) {
        const f = flameOf(id)
        cam.p(f[0], f[1] - 0.06, f[2])
        const ex = cam.o[0], ey = cam.o[1]
        const mx = (jx + ex) / 2, my = Math.min(jy, ey) - Math.abs(ex - jx) * 0.18
        g.setLineDash([Math.hypot(ex - jx, ey - jy) * 1.3 * thread, 2000])
        g.beginPath()
        g.moveTo(jx, jy)
        g.quadraticCurveTo(mx, my, ex, ey)
        g.stroke()
      }
      g.setLineDash([])
    }
  }
  function halo(x: number, y: number, r: number, a: number) {
    const g = c!
    g.globalAlpha = a
    g.drawImage(HALO, x - r, y - r, r * 2, r * 2)
    g.globalAlpha = 1
  }
  function flameShape(x: number, y: number, hh: number) {
    const g = c!
    const w = hh * 0.36
    g.fillStyle = FLAME
    g.beginPath()
    g.moveTo(x, y - hh)
    g.bezierCurveTo(x + w * 0.5, y - hh * 0.55, x + w * 1.1, y - hh * 0.2, x + w * 0.7, y)
    g.quadraticCurveTo(x, y + w * 0.5, x - w * 0.7, y)
    g.bezierCurveTo(x - w * 1.1, y - hh * 0.2, x - w * 0.5, y - hh * 0.55, x, y - hh)
    g.fill()
    g.fillStyle = CORE
    g.beginPath()
    g.ellipse(x, y - hh * 0.25, w * 0.32, hh * 0.22, 0, 0, Math.PI * 2)
    g.fill()
  }

  // ── one loop: wick, taper flight, the threads, a slow breath in the flames (high, until idle) ──
  let wickT = 1, wickFrom = 0
  const loop = createLoop(root, (time, dt) => {
    let busy = false
    if (wickT < 1) {
      wickT = still ? 1 : Math.min(1, wickT + dt / 0.6)
      wick = wickFrom + (wickTo - wickFrom) * ease(wickT)
      busy = true
    }
    if (taper && taper.to) {
      taper.t = still ? 1 : Math.min(1, taper.t + dt / 0.9)
      const f = flameOf(taper.to), e = ease(taper.t)
      taper.x = taper.from[0] + (f[0] - taper.from[0]) * e
      taper.z = taper.from[2] + (f[2] - taper.from[2]) * e
      taper.y = taper.from[1] + (f[1] - taper.from[1]) * e + Math.sin(Math.PI * e) * 0.25
      busy = true
      if (taper.t >= 1) {
        const to = taper.to
        taper = null
        kindle(to)
      }
    }
    if (thread > 0 && thread < 1) {
      thread = still ? 1 : Math.min(1, thread + dt / 1.4)
      busy = true
    }
    if (!low && !ctx.reduced && idle < 10) {
      idle += dt
      flick = Math.sin(time * 0.95) * 0.025 + Math.sin(time * 2.3) * 0.01
      busy = true
    } else flick = 0
    frame()
    return busy || !!taper
  }, { essential: true })
  ctx.onCleanup(() => loop.dispose())
  const run = () => {
    idle = 0
    loop.start()
  }
  root.addEventListener('pointermove', () => (idle = 0) || (!loop.running && !still && run()))

  // ── actions ──
  function touch(id: Id) {
    if (lit.has(id)) return read(id)
    carry(id)
  }
  /** carry the fire from the far flame to lamp `id` (keyboard / tap) */
  function carry(id: Id) {
    if (taper) return
    const f = flameOf('llamacpp')
    taper = { x: f[0], y: f[1], z: f[2], on: true, t: 0, to: id, from: [f[0], f[1] + 0.05, f[2]] }
    ctx.chime('soft')
    run()
  }
  /** the fire touches lamp `id`: paper catches at once; oil only with the wick turned up */
  function kindle(id: Id) {
    if (id === 'ollama' && wickTo < 1) {
      info.hidden = false
      info.say(h('p', { class: 't32l-hint' }, K.wickHint))
      ctx.chime('low')
      run()
      return
    }
    lit.add(id)
    btn[id].setAttribute('aria-pressed', 'true')
    ctx.chime('tap')
    read(id)
    if (lit.size === K.lamps.length) {
      thread = 0.001
      root.classList.add('all')
      ctx.insight(K.insight as Fact, K.detail)
      ctx.chime('ok')
    }
    run()
  }
  function setWick(v: number) {
    if (v === wickTo) return
    wickFrom = wick
    wickTo = v
    wickT = 0
    knob.setAttribute('aria-pressed', String(!!v))
    ctx.chime('soft')
    run()
  }
  /** what a lit lamp says, written on the lit wall above it */
  function read(id: Id) {
    shown = id
    const lp = K.lamps.find((x) => x.id === id)!
    const upd = (lp as { update?: Fact }).update
    info.hidden = false
    info.say(
      h('p', { class: 't32l-kind' }, lp.kind),
      h('h3', { class: 't32l-h' }, lp.name),
      h('p', { class: 't32l-what' }, lp.what),
      h('p', { class: 't32l-fit' }, lp.fit),
      ctx.fact(lp.fact as Fact, 'p', 't32l-fact'),
      upd ? ctx.fact(upd, 'p', 't32l-fact') : '',
      h('p', { class: 't32l-foot' }, h('a', { class: 't32l-doc', href: lp.doc, target: '_blank', rel: 'noopener noreferrer' }, `${K.docLabel} ↗`), h('span', null, K.changeNote)))
    placeInfo()
  }

  // drag the fire from the far flame: the light and the shadows follow the hand; let go on a lamp to light it
  function grab(e: PointerEvent) {
    if (e.button || taper) return
    const b = btn.llamacpp
    const sx = e.clientX, sy = e.clientY
    const box = root.getBoundingClientRect()
    let moved = false
    delete b.dataset.dragged
    b.setPointerCapture(e.pointerId)
    const hy = TOP + 0.22
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return
      if (!moved) {
        const f = flameOf('llamacpp')
        taper = { x: f[0], y: hy, z: f[2], on: true, t: 1, to: null, from: f }
        ctx.chime('soft')
      }
      moved = true
      if (cam.floor(ev.clientX - box.left, ev.clientY - box.top, hy) && taper) {
        taper.x = clamp(cam.o[0], -3, 3)
        taper.z = clamp(cam.o[2], WALL + 0.25, 2)
      }
      run()
    }
    const up = (ev: PointerEvent) => {
      b.removeEventListener('pointermove', move)
      b.removeEventListener('pointerup', up)
      b.removeEventListener('pointercancel', up)
      if (!moved) return
      b.dataset.dragged = '1'
      setTimeout(() => delete b.dataset.dragged)
      const hit = (['lmstudio', 'ollama'] as const).find((id) => {
        const r = btn[id].getBoundingClientRect()
        return ev.clientX >= r.left - 12 && ev.clientX <= r.right + 12 && ev.clientY >= r.top - 12 && ev.clientY <= r.bottom + 12
      })
      taper = null
      if (hit && ev.type === 'pointerup' && !lit.has(hit)) kindle(hit)
      run()
    }
    b.addEventListener('pointermove', move)
    b.addEventListener('pointerup', up)
    b.addEventListener('pointercancel', up)
  }

  // ── layout ──
  const px = (n: number) => `${n.toFixed(1)}px`
  /** what a lamp says is written on the lit wall above it (or beside it, when the wall above runs out) */
  function placeInfo() {
    if (!shown || !W) return
    const w = tall ? Math.min(W - 24, 330) : Math.min(340, W * 0.27)
    info.style.width = px(w)
    const hh = info.offsetHeight // one read, after the text is in
    const q = at(PROPS[shown].t)
    cam.p(q[0], TOP + PROPS[shown].hgt + 0.08, q[2])
    let x = cam.o[0] - w / 2, y = cam.o[1] - hh - 10
    const top = H * 0.06
    if (y < top) {
      // no room above: to the lamp's left (wide) or the top of the frame (tall)
      y = top
      if (!tall) x = cam.o[0] - w - 70
    }
    Object.assign(info.style, { left: px(clamp(x, 8, W - w - 8)), top: px(y) })
  }
  function layoutDom() {
    const dx = S1[0] - S0[0], dz = S1[2] - S0[2], dl = Math.hypot(dx, dz)
    const nx = (-dz / dl) * DEPTH * 0.5, nz = (dx / dl) * DEPTH * 0.5
    for (const lp of K.lamps) {
      const id = lp.id as Id
      const q = at(PROPS[id].t)
      const r = PROPS[id].r * 1.25
      cam.p(q[0] - r, TOP + PROPS[id].hgt + 0.12, q[2])
      const x0 = cam.o[0], y0 = cam.o[1]
      cam.p(q[0] + r, TOP - 0.02, q[2])
      Object.assign(btn[id].style, { left: px(x0), top: px(y0), width: px(cam.o[0] - x0), height: px(cam.o[1] - y0) })
      // its name on a small plaque nailed to the shelf's front edge, turned with the edge
      const t = PROPS[id].t
      const a = at(Math.max(0, t - 0.04)), b = at(Math.min(1, t + 0.04))
      cam.p(a[0] + nx, TOP - 0.028, a[2] + nz)
      const ax = cam.o[0], ay = cam.o[1]
      cam.p(b[0] + nx, TOP - 0.028, b[2] + nz)
      const ang = (Math.atan2(cam.o[1] - ay, cam.o[0] - ax) * 180) / Math.PI
      cam.p(q[0] + nx, TOP - 0.028, q[2] + nz)
      Object.assign(plaque[id].style, { left: px(cam.o[0] - x0), top: px(cam.o[1] - y0), rotate: `${ang.toFixed(1)}deg` })
    }
    const k = at(PROPS.ollama.t)
    cam.p(k[0] + 0.12, TOP + 0.075, k[2] + 0.05)
    Object.assign(knob.style, { left: px(cam.o[0] - 14), top: px(cam.o[1] - 14) })
    const j = at(PROPS.jar.t, 0.1)
    cam.p(j[0], j[1], j[2] + 0.06)
    Object.assign(seal.style, { left: px(cam.o[0]), top: px(cam.o[1]) })
    placeInfo()
  }
  let job: ReturnType<typeof sliced> | null = null
  let painted = false
  function layout() {
    const [w, hh] = stageSize(ctx)
    if (w < 40 || hh < 40) return
    if (w === W && hh === H && painted) return
    W = w
    H = hh
    tall = W / H < 0.9
    root.classList.toggle('tall', tall)
    root.style.height = px(H)
    // the shelf runs from near-left away to the right (wide) or up the screen (tall)
    S0 = tall ? [-0.42, 0, 0.5] : [-0.9, 0, 0.9]
    S1 = tall ? [0.52, 0, -1.15] : [1.0, 0, -1.25]
    const box: V3[] = tall ? [at(0, -0.2), at(0, 0.62), at(1, 0.4), [S0[0] - 0.18, TOP, S0[2]], [S1[0] + 0.15, TOP, S1[2]]] : [at(0, -0.3), at(1, -TOP), at(0, 0.62), at(1, 0.4), [S1[0] + 0.4, 1.5, WALL], [S0[0] - 0.2, TOP, S0[2]]]
    // a phone frames the shelf big, on the diagonal from the near lantern (low left) to the far flame (high right)
    cam = fitCamera({ yaw: tall ? 2 : -14, pitch: tall ? 22 : 15, fov: 50, W, H, box, rect: tall ? [W * 0.04, H * 0.3, W * 0.96, H * 0.84] : [W * 0.3, H * 0.1, W * 0.98, H * 0.86] })
    LAN = null
    dpr = Math.min(devicePixelRatio || 1, low ? 1 : 1.25)
    cv.width = Math.round(W * dpr)
    cv.height = Math.round(H * dpr)
    cv.style.width = px(W)
    cv.style.height = px(H)
    c = cv.getContext('2d')!
    c.setTransform(dpr, 0, 0, dpr, 0, 0)
    job?.cancel()
    job = sliced(bake(), { sync: ctx.reduced || painted })
    job.done.then(() => frame())
    painted = true
    layoutDom()
  }
  ctx.onCleanup(() => job?.cancel())
  const ro = new ResizeObserver(() => requestAnimationFrame(layout))
  ro.observe(ctx.el)
  ctx.onCleanup(() => ro.disconnect())
  ctx.onCleanup(onPrefs(() => {
    const next = palette()
    if (next.key === P.key) return
    P = next
    tones()
    if (!W) return
    job?.cancel()
    job = sliced(bake(), { sync: true })
    frame()
  }))
  ctx.onCleanup(onDigit((d) => {
    const lp = K.lamps[d - 1]
    if (lp) touch(lp.id as Id)
  }))
  ctx.prompt(K.prompt)
}
