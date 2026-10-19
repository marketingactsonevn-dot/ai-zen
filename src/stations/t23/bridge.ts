import { fill, h } from '../../core/dom'
import type { SceneCtx } from '../types'
import { rng } from '../../ui/part2/ink'
import { C } from './data'
import { MOON, canvas, clamp, f1, fbm, field, lerp, mix, put, rgba, rig, sheet, sm, softEllipse, softLine, stone, vn, type Pal, type Pt, type RGB, type Rig } from './lit'

const K = C.scenes.bridge
const TAU = Math.PI * 2
/** where a shadow falls per px of height: away from the high moon (upper right), short */
const SH: Pt = [-0.64 * 0.42, 0.77 * 0.42]
/** the slab under the water is lit by a raking moon from the right: the carving stands out in light and shadow */
const RAKE: [number, number, number] = (() => {
  const v = [0.8, -0.32, 0.5]
  const l = Math.hypot(v[0], v[1], v[2])
  return [v[0] / l, v[1] / l, v[2] / l] as [number, number, number]
})()

type Fish = { x: number; y: number; a: number; v: number; tp: number; tail: number; z: number; wx: number; wy: number; el: HTMLElement; tl: HTMLElement; sh: HTMLElement; col: number }
type Geo = {
  wide: boolean; R: number; pc: Pt; sc: Pt; sR: number; D: number; zF: number; zM: number; zRim: number; zMist: number; zPole: number; zBr: number; lr: number
  lz: [number, number]; Lw: Pt; slab: { x: number; y: number; w: number; h: number }; cable: Pt[]; route: Pt[]; L: number; tipEnd: Pt
}

/** The water's colours by depth (the shallow edge, the middle, the deep bowl) and the tint the surface lays over it. */
function waterTones(p: Pal) {
  return p.dark
    ? { shallow: mix(mix(p.mossC, p.mist, 0.28), p.paper, 0.18), mid: mix(mix(p.mossA, p.mist, 0.2), p.paper, 0.45), deep: mix(p.paper, p.mist, 0.09), tint: mix(p.paper, p.mist, 0.12) }
    : { shallow: mix(mix(p.mossC, p.water, 0.3), p.stepHi, 0.15), mid: mix(p.water, p.mossA, 0.35), deep: mix(p.water, p.wash, 0.55), tint: mix(p.water, p.wash, 0.35) }
}

/**
 * ★ Scene 1 — TOP 80°: a round pond held by a thick ring of mossy stones, seen almost straight down like a koi painting; it
 * is wider than the frame is tall, so the moss and the rocks crop the four corners. Under clear water (bright at the
 * shallow edge, blue and dark in the bowl) a slab on the bottom is carved with a suspension bridge, lit by a raking moon.
 * A paper lantern hangs from a bamboo pole; pull it down toward the water (the slider) and its pool of light tightens
 * onto the slab, the carving glows vermilion, caustics brighten on it, the koi leave their free swim to hold the cable
 * and then parade along it, and two vermilion towers rise in the reflection though nothing stands above the pond.
 */
export function bridgeScene(ctx: SceneCtx) {
  const N = K.answers.length - 1
  let lvl = 0
  let done = false
  let prog = 0 // the lantern, 0 = high (level 0) … 1 = low over the slab (level N)
  let progT = 0
  let G: Geo | null = null
  let ready = false
  const low = ctx.quality === 'low'
  const NF = low ? 7 : 9
  const fish: Fish[] = []

  const R = rig(ctx, { cls: 't23b', art: K.art, copies: [K.insight], persp: 1.1, lean: 0.25, swing: 0.07, bleed: true, build })
  const zf = (k: keyof Geo) => () => (G ? (G[k] as number) : 0)
  const Lfloor = R.layer(() => (G ? -G.D : 0), 't23b-floor')
  const Lfish = R.layer(zf('zF'), 't23b-fishes')
  const Lmir = R.layer(zf('zM'), 't23b-mirror')
  const Lsurf = R.layer(0, 't23b-surface')
  const Lrim = R.layer(zf('zRim'), 't23b-rim')
  const Lmist = R.layer(zf('zMist'), 't23b-mist')
  const Lpole = R.layer(zf('zPole'), 't23b-pole')
  const over = h('div', { class: 't23-over' })
  const Lbr = R.layer(zf('zBr'), 't23b-branch')
  R.view.append(over, Lbr) // the lantern rides above the pole; the blurred branch is nearest of all

  // ── persistent pieces (repositioned on layout, never rebuilt)
  const floorArt = h('div', { class: 't23b-fa' })
  const pool = h('div', { class: 't23b-pool' })
  const caus = h('div', { class: 't23b-caus' }, h('i', { class: 'c1' }), h('i', { class: 'c2' }))
  const glow = h('div', { class: 't23b-glow' })
  const shadows = h('div', { class: 't23b-shadows' })
  const dim = h('div', { class: 't23b-dim' })
  Lfloor.append(floorArt, pool, caus, glow, dim, shadows)
  const mirArt = h('div', { class: 't23b-ma' })
  const towers = h('div', { class: 't23b-towers' })
  const lampRefl = h('div', { class: 't23b-lrefl' })
  const stRefl = h('div', { class: 't23b-ma' })
  Lmir.append(mirArt, stRefl, towers, lampRefl)
  const surfArt = h('div', { class: 't23b-sa' })
  const ring = h('div', { class: 't23b-ring' })
  // the question on a small washi slip afloat near the bank; the answer is ink spreading on the open water beside it
  const qPaper = h('div', { class: 't23b-q t23-paper' }, h('p', null, K.question))
  const ans = h('p', { class: 't23b-ans' }, K.answers[0])
  Lsurf.append(surfArt, ring, ans, qPaper)
  const rimArt = h('div', { class: 't23b-ra' })
  Lrim.append(rimArt)
  const wisps = [h('i', { class: 't23b-wisp w1' }), h('i', { class: 't23b-wisp w2' })]
  Lmist.append(...wisps)
  const poleArt = h('div', { class: 't23b-pa' })
  // what the lantern turns, on a wooden tag hanging from the pole (level, upright: easy to read)
  const tag = h('div', { class: 't23b-tag', 'aria-hidden': 'true' }, h('span', null, K.slider))
  Lpole.append(poleArt, tag)
  const brArt = h('div', { class: 't23b-ba' })
  Lbr.append(brArt)
  const cord = h('i', { class: 't23b-cord' })
  const lampArt = h('div', { class: 't23b-lart' })
  let lampHot: HTMLCanvasElement | null = null
  const halo = h('i', { class: 't23b-halo' })
  const lamp = h('div', {
    class: 't23b-lamp t23-grab', role: 'slider', tabindex: '0', 'aria-label': K.sliderAria, 'aria-valuemin': '0', 'aria-valuemax': String(N),
    'aria-valuenow': '0', 'aria-valuetext': fill(K.valueText, { n: 0, total: N }),
  }, halo, lampArt)
  over.append(cord, lamp)
  // what the carved stone stands for (once it shows), and, at the top level, that this really happened
  const stoneSays = h('p', { class: 't23-note t23b-stone', 'data-off': '' }, K.stone)
  const real = h('div', { class: 't23b-real', 'data-off': '' }, ctx.fact(K.real, 'p', 't23-note'))
  const note = h('div', { class: 't23b-note' }, ctx.fact(K.answersNote, 'p', 't23-note'), stoneSays, real)
  R.root.append(note)
  ctx.prompt(K.prompt)

  // ── fish (sprites rebuilt with the palette; state kept)
  for (let i = 0; i < NF; i++) {
    const tl = h('i', { class: 't23b-tail' })
    const el = h('i', { class: 't23b-koi' }, tl)
    const sh = h('i', { class: 't23b-fsh' })
    Lfish.append(el)
    shadows.append(sh)
    fish.push({ x: 0, y: 0, a: 0, v: 0, tp: i * 1.7, tail: 0, z: 0, wx: 0, wy: 0, el, tl, sh, col: [0, 1, 2, 0, 3, 4, 1, 0, 2][i] })
  }

  function* build(R: Rig, first: boolean): Generator<unknown, void> {
    const { W, H, P, pal: p } = R
    const T = waterTones(p)
    const wide = W / H > 1.1
    // the pond is wider than the frame is tall: its bank bleeds off the edges and only the corners show the moss
    const Rr = wide ? H * 0.6 : Math.max(H * 0.555, W * 0.7)
    const pc: Pt = [W / 2, H * 0.5]
    // depths follow the perspective distance, so a phone and a desktop see the same lean
    const D = P * 0.14
    const fsc = P / (P + D) // the floor's scale on the screen
    // a layer at depth z sees the pond's opening (pc, Rr on the screen) at its own centre and radius: the floor sinks
    // and lies lower on the screen (the camera leans), so it is painted round where the opening shows it
    const inv = (z: number, x: number, y: number): Pt => { const k = P / (P - z); return [R.cx + (x - R.cx) / k, R.cy + (y - R.cy + z * 0.25) / k] }
    const fwd = (z: number, x: number, y: number): Pt => { const k = P / (P - z); return [R.cx + (x - R.cx) * k, R.cy + (y - R.cy) * k - z * 0.25] }
    const fc = inv(-D, pc[0], pc[1]), fR = Rr / fsc
    const sw = Math.min(fR * 1.32, (W * 0.86) / fsc)
    const slab = { x: fc[0], y: fc[1] + fR * 0.05, w: sw, h: sw * 0.44 }
    const g: Geo = {
      wide, R: Rr, pc, sc: [0, 0], sR: 0, D, zF: -D * 0.5, zM: -D * 0.8, zRim: P * 0.012, zMist: P * 0.07, zPole: P * 0.33, zBr: P * 0.45, lr: Rr * (wide ? 0.11 : 0.12),
      lz: [P * 0.26, P * 0.08], Lw: [fc[0] + fR * 0.02, slab.y - slab.h * 0.06], slab, cable: [], route: [], L: Rr * (wide ? 0.25 : 0.26), tipEnd: [0, 0],
    }
    // the bridge in slab coordinates (0…w, 0…h), then in the world
    const bw = slab.w, bh = slab.h
    const tx = [0.25, 0.75], deck = 0.72, top = 0.16, sag = 0.6
    const cableAt = (u: number): Pt => {
      const x = u
      if (x < tx[0]) { const k = (tx[0] - x) / tx[0]; return [x, top + (0.66 - top) * Math.pow(k, 1.25)] }
      if (x > tx[1]) { const k = (x - tx[1]) / (1 - tx[1]); return [x, top + (0.66 - top) * Math.pow(k, 1.25)] }
      const k = (x - tx[0]) / (tx[1] - tx[0])
      return [x, top + (sag - top) * Math.sin(Math.PI * k)]
    }
    const toW = ([u, v]: Pt): Pt => [slab.x - bw / 2 + u * bw, slab.y - bh / 2 + v * bh]
    // the fish swim in their own layer: the cable they follow is the slab's, seen from where they are
    const toFish = (q: Pt) => inv(g.zF, ...fwd(-D, q[0], q[1]))
    g.cable = Array.from({ length: 41 }, (_, i) => toFish(toW(cableAt(0.04 + (i / 40) * 0.92))))
    g.route = [...g.cable, ...Array.from({ length: 20 }, (_, i) => toFish(toW([0.96 - (i / 19) * 0.92, deck + 0.06])))]
    g.sc = inv(g.zF, pc[0], pc[1])
    g.sR = Rr / (P / (P - g.zF))
    const mc = inv(g.zM, pc[0], pc[1]), mR = Rr / (P / (P - g.zM))
    // what lies in or under the water stays inside the pond (the veil, pool and caustics are wider than it)
    Lfloor.style.clipPath = `circle(${f1(fR * 1.04)}px at ${f1(fc[0])}px ${f1(fc[1])}px)`
    Lmir.style.clipPath = `circle(${f1(mR * 1.0)}px at ${f1(mc[0])}px ${f1(mc[1])}px)`
    if (!first && G && G.R !== Rr) fish.forEach((f) => (f.x = 0))
    G = g
    placeFish(true)
    // the pole reaches in from the bank, low over the water (from the left on a wide frame, the right on a phone),
    // so the tag hanging from it stays clear of the lantern
    const ang = Math.atan2(wide ? -0.24 : -0.62, wide ? -1 : 1)
    g.tipEnd = [g.Lw[0] + Math.cos(ang) * Rr * 3.2, g.Lw[1] + Math.sin(ang) * Rr * 3.2]
    const fresh: [HTMLElement, Node[]][] = []
    const out = (el: HTMLElement, ...kids: Node[]) => (first ? el.replaceChildren(...kids) : fresh.push([el, kids]))
    // the carving's height (white raised, black cut): drawn at half resolution and stretched up, which softens its
    // edges like a blur (a canvas filter here, on a CPU canvas, was a long task)
    const relief = (gg: CanvasRenderingContext2D, w: number, hh: number) => {
      const t = canvas(w, hh, gg.getTransform().a * 0.5)
      carving(t.g, w, hh, false)
      gg.imageSmoothingQuality = 'high'
      gg.drawImage(t.c, 0, 0, w, hh)
    }
    const carving = (gg: CanvasRenderingContext2D, w: number, hh: number, glowOnly: boolean) => {
      const X = (u: number) => u * w, Y = (v: number) => v * hh
      gg.lineCap = 'round'
      gg.lineJoin = 'round'
      const line = (pts: Pt[], lw: number) => {
        gg.lineWidth = lw
        gg.beginPath()
        pts.forEach(([u, v], i) => (i ? gg.lineTo(X(u), Y(v)) : gg.moveTo(X(u), Y(v))))
        gg.stroke()
      }
      const cab = Array.from({ length: 61 }, (_, i) => cableAt(0.03 + (i / 60) * 0.94))
      // raised: the deck and the towers (white); cut: the cable and the hangers (black)
      if (!glowOnly) {
        gg.strokeStyle = 'rgba(255,255,255,0.95)'
        line([[0.03, deck], [0.97, deck]], hh * 0.075)
        // the deck's girder: a lattice of small cuts along it
        gg.strokeStyle = 'rgba(0,0,0,0.5)'
        for (let u = 0.05; u < 0.96; u += 0.022) line([[u, deck - 0.025], [u + 0.011, deck + 0.025]], w * 0.0025)
        gg.strokeStyle = 'rgba(255,255,255,0.95)'
      }
      for (const x of tx) {
        line([[x, deck + 0.16], [x, top - 0.05]], w * 0.032)
        if (!glowOnly) for (const v of [0.24, 0.42]) line([[x - 0.024, v], [x + 0.024, v]], hh * 0.035)
      }
      if (!glowOnly) gg.strokeStyle = 'rgba(0,0,0,0.9)'
      line(cab, w * 0.009)
      let d = 0
      for (let u = 0.06; u < 0.95; u += 0.032) {
        if (Math.abs(u - tx[0]) < 0.02 || Math.abs(u - tx[1]) < 0.02) continue
        const [, v] = cableAt(u)
        line([[u, v + 0.02], [u, deck - 0.035]], w * 0.0045)
        d++
      }
      return d
    }

    // ── floor (sand shelving from the bright edge to the blue bowl, pebbles toward the bank, the carved slab)
    {
      const s = sheet(R, -g.D, 60, 1, [fc[0] - fR * 1.1, fc[1] - fR * 1.1, fc[0] + fR * 1.1, fc[1] + fR * 1.1])
      const gg = s.g
      const fw = s.x1 - s.x0, fh = s.y1 - s.y0
      gg.save()
      gg.beginPath()
      gg.arc(fc[0], fc[1], fR * 1.06, 0, TAU)
      gg.clip()
      const depth = (wx: number, wy: number, n: number) => clamp(1 - sm(0.5, 1.02, Math.hypot(wx - fc[0], wy - fc[1]) / fR + (n - 0.5) * 0.18) * 1.05, 0, 1)
      const sand = yield* field(fw, fh, 6, (x, y, o) => {
        const wx = s.x0 + x, wy = s.y0 + y
        const n = fbm(wx * 0.012, wy * 0.012, 3)
        const ripple = vn(wx * 0.05 + n * 3, wy * 0.012) // sand ripples drawn by the current
        const d = depth(wx, wy, n)
        const c = d < 0.5 ? mix(T.shallow, T.mid, d * 2) : mix(T.mid, T.deep, (d - 0.5) * 2)
        const b = 1 + (ripple - 0.5) * (0.1 - d * 0.05) + (n - 0.5) * 0.07
        o[0] = c[0] * b; o[1] = c[1] * b; o[2] = c[2] * b; o[3] = 1
      })
      put(gg, sand, s.x0, s.y0, fw, fh)
      yield
      // pebbles where the floor shelves up to the bank, tinted by the water over them
      const r = rng(2301)
      const peb: [number, number, number][] = []
      for (let i = 0; peb.length < (wide ? 52 : 40) && i < 500; i++) {
        const a = r() * TAU, q = 0.6 + Math.sqrt(r()) * 0.42
        const x = fc[0] + Math.cos(a) * fR * q, y = fc[1] + Math.sin(a) * fR * q
        if (Math.abs(x - slab.x) < slab.w * 0.56 && Math.abs(y - slab.y) < slab.h * 0.62) continue
        if (x < s.x0 || x > s.x1 || y < s.y0 || y > s.y1) continue
        peb.push([x, y, fR * (0.02 + r() * r() * 0.06)])
      }
      for (const [x, y, rr] of peb) {
        const k = 0.15 + depth(x, y, 0.5) * 0.6
        const pt: [RGB, RGB, RGB, RGB] = p.dark ? [mix(p.hi, T.mid, k), mix(p.mid, T.mid, k), mix(p.lo, T.deep, k), p.umbra] : [mix(p.hi, T.mid, k * 0.7), mix(p.mid, T.mid, k * 0.7), mix(p.lo, T.deep, k * 0.6), mix(p.umbra, T.deep, 0.3)]
        gg.fillStyle = rgba(p.umbra, p.dark ? 0.5 : 0.24)
        gg.beginPath()
        gg.ellipse(x - rr * 0.35, y + rr * 0.45, rr * 1.15, rr * 0.8, -0.6, 0, TAU)
        gg.fill()
        const st = yield* stone({ w: rr * 2, h: rr * 1.6, seed: (x * 7 + y) | 0, tone: pt, flat: 0.55, wob: 0.16, rim: p.moon, rimA: p.dark ? 0.35 : 0.25, grain: 0.05, inkA: 0.45 }, s.d)
        gg.drawImage(st, x - rr, y - rr * 0.8, rr * 2, rr * 1.6)
      }
      // the slab: its shadow on the sand (it stands a hand above the floor), then the stone in raking light, the bridge in relief
      softEllipse(gg, slab.x - slab.w * 0.04, slab.y + slab.h * 0.12, slab.w * 0.6, slab.h * 0.66, p.umbra, p.dark ? 0.75 : 0.42)
      const stt: [RGB, RGB, RGB, RGB] = p.dark
        ? [mix(p.stepMid, p.hi, 0.4), mix(p.mid, T.mid, 0.25), mix(p.lo, T.deep, 0.35), p.umbra]
        : [mix(p.stepHi, T.shallow, 0.3), mix(p.stepMid, T.mid, 0.45), mix(p.stepLo, T.deep, 0.45), mix(p.umbra, T.deep, 0.35)]
      const sl = yield* stone({
        w: slab.w, h: slab.h, seed: 2302, tone: stt, light: RAKE, slab: 0.08, sq: 4.5, wob: 0.05, bump: 0.05, height: 0.3, relief: (q, w, hh) => void relief(q, w, hh), reliefK: 0.42,
        rim: p.moon, rimA: p.dark ? 0.45 : 0.35, inkA: 0.55, amb: 0.2, dry: 0.3, moss: 0.3, mossTone: [mix(p.mossC, T.mid, 0.2), mix(p.mossA, T.mid, 0.25), mix(p.mossB, T.deep, 0.3)], up: 'z',
      }, s.d)
      gg.drawImage(sl, slab.x - slab.w / 2, slab.y - slab.h / 2, slab.w, slab.h)
      // the bank on the moon's side throws its shadow into the water: a soft crescent inside the upper-right edge
      const sl0 = Math.hypot(SH[0], SH[1])
      for (const [k, rr, a] of [[0.26, 1.0, 0.1], [0.19, 0.99, 0.13], [0.12, 0.985, 0.17]] as [number, number, number][]) {
        gg.fillStyle = rgba(p.umbra, (p.dark ? 1.6 : 1) * a)
        gg.beginPath()
        gg.rect(s.x0, s.y0, fw, fh)
        gg.arc(fc[0] + (SH[0] / sl0) * fR * k, fc[1] + (SH[1] / sl0) * fR * k, fR * rr, 0, TAU)
        gg.fill('evenodd')
      }
      // the bamboo pole's shadow across the floor
      const po = g.zPole + g.D
      const pw = Math.max(8, Rr * 0.04)
      softLine(gg, g.Lw[0] + SH[0] * po * 0.5, g.Lw[1] + SH[1] * po * 0.5, g.tipEnd[0] + SH[0] * po * 0.5, g.tipEnd[1] + SH[1] * po * 0.5, pw, p.umbra, p.dark ? 0.55 : 0.28)
      gg.restore()
      const sc = s.c
      sc.className = 't23b-floorc'
      out(floorArt, sc)
      // the carving lit from inside: vermilion grooves with a soft glow (opacity follows the lantern)
      // (one blurred copy under the sharp lines: a shadowBlur on every stroke would be a long task)
      const sharp = canvas(slab.w, slab.h, R.dpr)
      sharp.g.strokeStyle = rgba(p.red, 1)
      carving(sharp.g, slab.w, slab.h, true)
      const gl = canvas(slab.w, slab.h, R.dpr)
      gl.g.filter = `blur(${f1(Rr * 0.02 * R.dpr)}px)`
      gl.g.drawImage(sharp.c, 0, 0, slab.w, slab.h)
      gl.g.drawImage(sharp.c, 0, 0, slab.w, slab.h)
      gl.g.filter = 'none'
      gl.g.drawImage(sharp.c, 0, 0, slab.w, slab.h)
      Object.assign(gl.c.style, { position: 'absolute', left: `${f1(slab.x - slab.w / 2)}px`, top: `${f1(slab.y - slab.h / 2)}px` })
      out(glow, gl.c)
      yield
    }
    // pool, caustics, dim veil: centred on the lantern's foot
    {
      const [lx, ly] = g.Lw
      const pr = fR * 0.95
      Object.assign(pool.style, { left: `${f1(lx - pr)}px`, top: `${f1(ly - pr)}px`, width: `${f1(pr * 2)}px`, height: `${f1(pr * 2)}px` })
      const cr = slab.w * 0.46
      Object.assign(caus.style, { left: `${f1(lx - cr)}px`, top: `${f1(ly - cr)}px`, width: `${f1(cr * 2)}px`, height: `${f1(cr * 2)}px` })
      const tile = yield* causticTile(p)
      for (const el of caus.children as HTMLCollectionOf<HTMLElement>) el.style.backgroundImage = `url(${tile})`
      const dr = Rr * 2.2
      Object.assign(dim.style, { left: `${f1(lx - dr)}px`, top: `${f1(ly - dr)}px`, width: `${f1(dr * 2)}px`, height: `${f1(dr * 2)}px` })
    }
    // ── the mirror: the moon's reflection with its glints, the vermilion towers that are not there
    const moonAt: Pt = wide ? [mc[0] + mR * 0.5, mc[1] - mR * 0.56] : [mc[0] - mR * 0.32, mc[1] - mR * 0.62]
    {
      const s = sheet(R, g.zM, 40, 1, [mc[0] - mR * 1.1, mc[1] - mR * 1.1, mc[0] + mR * 1.1, mc[1] + mR * 1.1])
      const gg = s.g
      const [mx, my] = moonAt
      const mr = mR * 0.075
      const hg = gg.createRadialGradient(mx, my, 0, mx, my, mr * 5)
      hg.addColorStop(0, rgba(p.moon, p.dark ? 0.42 : 0.6))
      hg.addColorStop(0.35, rgba(p.moon, p.dark ? 0.14 : 0.22))
      hg.addColorStop(1, rgba(p.moon, 0))
      gg.fillStyle = hg
      gg.fillRect(mx - mr * 5, my - mr * 5, mr * 10, mr * 10)
      const md = gg.createRadialGradient(mx, my, 0, mx, my, mr)
      const moonC = p.dark ? p.moon : mix(p.card, p.moon, 0.5)
      md.addColorStop(0, rgba(moonC, 1))
      md.addColorStop(0.8, rgba(moonC, 0.95))
      md.addColorStop(1, rgba(moonC, 0))
      gg.fillStyle = md
      gg.beginPath()
      gg.ellipse(mx, my, mr, mr * 0.92, 0, 0, TAU)
      gg.fill()
      // ripples cut it into bands and scatter glints round it
      // a ripple slides through it: a soft dark band, not a drawn line
      const cut = gg.createLinearGradient(0, my - mr * 0.2, 0, my + mr * 0.25)
      cut.addColorStop(0, rgba(T.tint, 0))
      cut.addColorStop(0.5, rgba(T.tint, p.dark ? 0.45 : 0.3))
      cut.addColorStop(1, rgba(T.tint, 0))
      gg.fillStyle = cut
      gg.fillRect(mx - mr * 1.2, my - mr * 0.2, mr * 2.4, mr * 0.45)
      const r = rng(2304)
      gg.lineCap = 'round'
      for (let i = 0; i < 26; i++) {
        const a = r() * TAU, q = 1.2 + r() * r() * 3.2
        const x = mx + Math.cos(a) * mr * q * 1.3, y = my + Math.sin(a) * mr * q * 0.7
        const len = mr * (0.25 + r() * 0.6) * (1.6 - q * 0.25)
        gg.strokeStyle = rgba(p.moon, (p.dark ? 0.7 : 0.9) * (1 - q / 5))
        gg.lineWidth = Math.max(0.8, mr * 0.06)
        gg.beginPath()
        gg.moveTo(x - len / 2, y)
        gg.lineTo(x + len / 2, y + (r() - 0.5) * 1.5)
        gg.stroke()
      }
      out(mirArt, s.c)
      // the towers: bars and the cable, inverted and broken by the ripples, drawn once; faded in by the lantern
      const th = Rr * 0.85
      const t = canvas(slab.w * 1.1, th, R.dpr)
      const tg = t.g
      const red = p.red
      for (let row = 0; row < th; row += 2.5) {
        const k = row / th
        const off = Math.sin(row * 0.21) * Rr * 0.012 * (0.4 + k) + Math.sin(row * 0.05 + 1) * Rr * 0.01
        const a = (1 - k) * (0.55 + 0.45 * vn(row * 0.3, 3))
        if (vn(row * 0.4, 9) < 0.28) continue // gaps where a ripple breaks the reflection
        tg.fillStyle = rgba(red, a)
        for (const x of tx) {
          const cx = slab.w * 0.05 + x * slab.w
          tg.fillRect(cx - slab.w * 0.016 + off, row, slab.w * 0.032, 2.4)
          if (Math.abs(row - th * 0.22) < 3 || Math.abs(row - th * 0.45) < 3) tg.fillRect(cx - slab.w * 0.03 + off, row, slab.w * 0.06, 2.4)
        }
      }
      tg.strokeStyle = rgba(red, 0.5)
      tg.lineWidth = Math.max(1.4, Rr * 0.008)
      tg.beginPath()
      for (let i = 0; i <= 30; i++) {
        const u = tx[0] + (tx[1] - tx[0]) * (i / 30)
        const x = slab.w * 0.05 + u * slab.w, y = th * 0.82 - Math.sin(Math.PI * (i / 30)) * th * 0.5 + Math.sin(i * 1.7) * 1.5
        i ? tg.lineTo(x, y) : tg.moveTo(x, y)
      }
      tg.stroke()
      const ts = inv(g.zM, ...fwd(-D, slab.x, slab.y + slab.h * 0.14))
      Object.assign(t.c.style, { position: 'absolute', left: `${f1(ts[0] - slab.w * 0.55)}px`, top: `${f1(ts[1])}px` })
      out(towers, t.c)
      const lr = Rr * 0.42
      Object.assign(lampRefl.style, { left: `${f1(g.Lw[0] - lr)}px`, top: `${f1(g.Lw[1] + Rr * 0.08 - lr)}px`, width: `${f1(lr * 2)}px`, height: `${f1(lr * 2)}px` })
      yield
    }
    // ── the surface: a blue tint that deepens over the bowl, the sky's sheen on the far water, ripple rings, glints
    {
      const s = sheet(R, 0, 30, 1, [pc[0] - Rr * 1.2, pc[1] - Rr * 1.2, pc[0] + Rr * 1.2, pc[1] + Rr * 1.2])
      const gg = s.g
      gg.save()
      gg.beginPath()
      gg.arc(pc[0], pc[1], Rr * 1.03, 0, TAU)
      gg.clip()
      const tg = gg.createRadialGradient(pc[0], pc[1] + Rr * 0.05, Rr * 0.05, pc[0], pc[1], Rr * 1.03)
      tg.addColorStop(0, rgba(T.tint, p.dark ? 0.42 : 0.34))
      tg.addColorStop(0.55, rgba(T.tint, p.dark ? 0.3 : 0.22))
      tg.addColorStop(0.88, rgba(T.tint, p.dark ? 0.1 : 0.05))
      tg.addColorStop(1, rgba(T.tint, p.dark ? 0.22 : 0.12))
      gg.fillStyle = tg
      gg.fillRect(pc[0] - Rr * 1.1, pc[1] - Rr * 1.1, Rr * 2.2, Rr * 2.2)
      // the sky held in the water on the moon's side: a broad soft sheen
      const shx = pc[0] + Rr * 0.45, shy = pc[1] - Rr * 0.45
      const sh = gg.createRadialGradient(shx, shy, 0, shx, shy, Rr * 0.7)
      sh.addColorStop(0, rgba(p.dark ? p.mist : p.card, p.dark ? 0.1 : 0.22))
      sh.addColorStop(1, rgba(p.dark ? p.mist : p.card, 0))
      gg.fillStyle = sh
      gg.fillRect(pc[0] - Rr * 1.1, pc[1] - Rr * 1.1, Rr * 2.2, Rr * 2.2)
      // the meniscus: a thin bright line just inside the bank, where the water climbs the stones
      gg.strokeStyle = rgba(p.dark ? p.moon : p.card, p.dark ? 0.25 : 0.55)
      gg.lineWidth = Math.max(1, Rr * 0.005)
      gg.beginPath()
      gg.arc(pc[0], pc[1], Rr * 0.985, -Math.PI * 0.95, Math.PI * 0.15)
      gg.stroke()
      const r = rng(2305)
      gg.strokeStyle = rgba(p.dark ? p.mist : p.card, p.dark ? 0.14 : 0.42)
      for (let i = 0; i < 8; i++) {
        const rr = Rr * (0.22 + i * 0.09)
        gg.lineWidth = 0.9
        gg.beginPath()
        gg.ellipse(pc[0] - Rr * 0.4, pc[1] + Rr * 0.38, rr, rr * 0.92, 0, -0.6 - r() * 0.5, 0.3 + r() * 0.6)
        gg.stroke()
      }
      gg.restore()
      out(surfArt, s.c)
      yield
    }
    // ── the bank: a carpet of moss cushions to the frame's edges, the rim of overlapping mossy rocks, their reflections
    {
      const s = sheet(R, g.zRim, 40)
      const gg = s.g
      const fw = s.x1 - s.x0, fh = s.y1 - s.y0
      const r = rng(2306)
      const mHi: RGB = p.dark ? mix(p.mossC, p.moon, 0.12) : mix(p.mossC, p.card, 0.25)
      const mMid: RGB = p.dark ? p.mossA : mix(p.mossA, p.mossC, 0.35)
      const mLo: RGB = p.dark ? mix(p.mossB, p.umbra, 0.35) : mix(p.mossB, p.wash, 0.18)
      const mDeep: RGB = p.dark ? mix(p.mossB, p.umbra, 0.7) : mix(p.mossB, p.wash, 0.45)
      const [Lx, Ly] = [MOON[0], MOON[1]]
      const vw = R.span(g.zRim, 0)
      const ground = yield* field(fw, fh, 4, (x, y, o) => {
        const wx = s.x0 + x, wy = s.y0 + y
        const q = Math.hypot(wx - pc[0], wy - pc[1]) / Rr
        if (q < 0.97) return void (o[3] = 0)
        // cushions: the slope of a noise turned to the moon (lit on their upper-right shoulders, dark in the hollows)
        const f = 0.022
        const n = fbm(wx * f, wy * f, 4)
        const hx = fbm((wx + 5) * f, wy * f, 4) - n, hy = fbm(wx * f, (wy + 5) * f, 4) - n
        const lit = clamp(0.5 + (-hx * Lx - hy * Ly) * 9, 0, 1)
        const fine = vn(wx * 0.22, wy * 0.22)
        let c = mix(mLo, mMid, sm(0.25, 0.65, lit))
        c = mix(c, mHi, sm(0.62, 0.95, lit) * (0.6 + 0.4 * fine))
        c = mix(c, mDeep, sm(0.42, 0.25, n) * 0.8)
        // wetter and darker where it meets the water
        c = mix(c, mDeep, (1 - sm(1.0, 1.12, q)) * 0.55)
        // the far frame sinks into shade so the eye stays on the pond
        const ex = Math.min(wx - vw[0], vw[2] - wx) / (vw[2] - vw[0]), ey = Math.min(wy - vw[1], vw[3] - wy) / (vw[3] - vw[1])
        c = mix(c, mDeep, (1 - sm(0, 0.22, Math.min(ex * 1.6, ey))) * 0.45 + sm(1.3, 2.4, q) * 0.2)
        const b = 1 + (fine - 0.5) * 0.12
        o[0] = c[0] * b; o[1] = c[1] * b; o[2] = c[2] * b
        o[3] = clamp((q - 0.97) * 40, 0, 1)
      })
      put(gg, ground, s.x0, s.y0, fw, fh)
      yield
      // the rim: rocks of every size, overlapping, an inner row that leans over the water and an outer row behind it
      const tone: [RGB, RGB, RGB, RGB] = p.dark ? [p.hi, p.mid, p.lo, p.umbra] : [mix(p.hi, p.mid, 0.45), mix(p.mid, p.lo, 0.35), mix(p.lo, p.umbra, 0.12), mix(p.umbra, p.lo, 0.3)]
      const mt: [RGB, RGB, RGB] = p.dark ? [p.mossC, p.mossA, p.mossB] : [mix(p.mossC, p.paper, 0.15), p.mossA, p.mossB]
      type Rock = [number, number, number, number, number, number] // x, y, w, h, moss, seed
      const rocks: Rock[] = []
      const inView = (x: number, y: number, rr: number) => x + rr > vw[0] && x - rr < vw[2] && y + rr > vw[1] && y - rr < vw[3]
      let a = r() * TAU
      const a1 = a + TAU
      while (a < a1) {
        const big = r() < 0.28
        const sz = Rr * (big ? 0.2 + r() * 0.14 : 0.08 + r() * 0.1)
        const q = 1 + (sz / Rr) * 0.42 + (r() - 0.5) * 0.04
        const w = sz * (1.25 + r() * 0.6), hh = sz * (0.9 + r() * 0.35)
        const x = pc[0] + Math.cos(a) * Rr * q, y = pc[1] + Math.sin(a) * Rr * q
        if (inView(x, y, w)) rocks.push([x, y, w, hh, 0.25 + r() * 0.45, (x * 13 + y * 7) | 0])
        if (r() < 0.55) {
          const s2 = sz * (0.7 + r() * 0.8), q2 = q + (sz + s2) / Rr * 0.55
          const a2 = a + (r() - 0.5) * (sz / Rr)
          const x2 = pc[0] + Math.cos(a2) * Rr * q2, y2 = pc[1] + Math.sin(a2) * Rr * q2
          if (inView(x2, y2, s2 * 1.6)) rocks.push([x2, y2, s2 * (1.3 + r() * 0.5), s2 * (0.95 + r() * 0.3), 0.4 + r() * 0.5, (x2 * 11 + y2 * 5) | 0])
        }
        a += (sz / Rr) * (0.95 + r() * 0.55)
      }
      // boulders cropped by the corners (two on a wide frame; on a phone the bank shows only in the corners)
      for (const [ux, uy, us] of wide ? [[0.035, 0.92, 0.5], [0.97, 0.06, 0.42]] : [[0.02, 0.97, 0.3], [0.99, 0.95, 0.24], [0.98, 0.04, 0.2], [0.01, 0.05, 0.22]]) {
        const x = vw[0] + (vw[2] - vw[0]) * ux, y = vw[1] + (vw[3] - vw[1]) * uy, sz = Rr * us
        rocks.push([x, y, sz * 1.5, sz * 1.1, 0.7, (x * 3 + y) | 0])
      }
      rocks.sort((u, v) => u[1] + u[3] * 0.3 - (v[1] + v[3] * 0.3))
      // their reflections in the water (only the rocks on the far bank show in it)
      const rf = sheet(R, g.zM, 40, 0.5, [mc[0] - mR * 1.1, mc[1] - mR * 1.1, mc[0] + mR * 1.1, mc[1] + mR * 1.1])
      const ms = Rr / mR
      rf.g.save()
      rf.g.beginPath()
      rf.g.arc(mc[0], mc[1], mR, 0, TAU)
      rf.g.clip()
      const cushion = (x: number, y: number, rx: number, ry: number) => {
        softEllipse(gg, x + SH[0] * ry * 0.8, y + SH[1] * ry * 0.8, rx * 1.05, ry * 0.9, p.umbra, p.dark ? 0.55 : 0.3)
        const cg = gg.createRadialGradient(x + rx * 0.3, y - ry * 0.35, ry * 0.1, x, y, Math.max(rx, ry) * 1.05)
        cg.addColorStop(0, rgba(mHi))
        cg.addColorStop(0.55, rgba(mMid))
        cg.addColorStop(1, rgba(mLo, 0.9))
        gg.fillStyle = cg
        gg.beginPath()
        gg.ellipse(x, y, rx, ry, 0, 0, TAU)
        gg.fill()
      }
      let i = 0
      for (const [x, y, w, hh, moss, seed] of rocks) {
        // the stone sits in its moss: a cushion or two at its foot, the contact shadow toward the lower left
        if (r() < 0.75) cushion(x + (r() - 0.6) * w * 0.6, y + hh * (0.25 + r() * 0.2), w * (0.3 + r() * 0.2), hh * (0.2 + r() * 0.12))
        softEllipse(gg, x + SH[0] * hh * 0.9, y + SH[1] * hh * 0.9, w * 0.62, hh * 0.6, p.umbra, p.dark ? 0.75 : 0.4)
        const st = yield* stone({ w, h: hh, seed, tone, rim: p.dark ? p.moon : p.wash, rimA: p.dark ? 0.55 : 0.38, moss, mossTone: mt, flat: 0.38 + (seed % 7) * 0.03, wob: 0.14 + (seed % 5) * 0.02, bump: 0.05, height: 1.1, grain: 0.06, inkA: 0.6 }, s.d)
        gg.drawImage(st, x - w / 2, y - hh / 2, w, hh)
        if (Math.hypot(x - pc[0], y - pc[1]) < Rr * 1.35 && y < pc[1] + Rr * 0.2) {
          const [mx, my] = inv(g.zM, x, y + hh * 0.95)
          rf.g.globalAlpha = p.dark ? 0.3 : 0.26
          rf.g.save()
          rf.g.translate(mx, my)
          rf.g.scale(1 / ms, -0.8 / ms)
          rf.g.drawImage(st, -w / 2, -hh / 2, w, hh)
          rf.g.restore()
        }
        // now and then a cushion grows over the stone's shoulder
        if ((i++ & 3) === 1) cushion(x - w * 0.18, y - hh * 0.05, w * 0.22, hh * 0.16)
      }
      rf.g.restore()
      rf.c.classList.add('t23b-srefl')
      out(stRefl, rf.c)
      // the pole's shadow on the bank (outside the water)
      const po = g.zPole - g.zRim
      gg.save()
      gg.globalCompositeOperation = 'source-atop'
      softLine(gg, g.Lw[0] + SH[0] * po * 0.5, g.Lw[1] + SH[1] * po * 0.5, g.tipEnd[0] + SH[0] * po * 0.5, g.tipEnd[1] + SH[1] * po * 0.5, Math.max(7, Rr * 0.035), p.umbra, p.dark ? 0.5 : 0.26)
      gg.restore()
      out(rimArt, s.c)
      yield
    }
    // ── the bamboo pole from the top edge to the lantern's hook
    let poleDir: Pt = [0, 0]
    let pw = 0
    {
      const [ax, ay] = g.Lw, [bx, by] = g.tipEnd
      const s = sheet(R, g.zPole, 40, 1, [Math.min(ax, bx) - Rr * 0.2, Math.min(ay, by) - Rr * 0.2, Math.max(ax, bx) + Rr * 0.2, Math.max(ay, by) + Rr * 0.2])
      const gg = s.g
      const len = Math.hypot(bx - ax, by - ay), an = Math.atan2(by - ay, bx - ax)
      poleDir = [Math.cos(an), Math.sin(an)]
      pw = Math.max(9, Rr * 0.045)
      gg.save()
      gg.translate(ax, ay)
      gg.rotate(an)
      // a cylinder lit from the moon's side: the gradient runs across the pole
      const side = Math.sin(an) * MOON[0] - Math.cos(an) * MOON[1] > 0 ? -1 : 1
      const cg = gg.createLinearGradient(0, (-pw / 2) * side, 0, (pw / 2) * side)
      const bam: [RGB, RGB, RGB] = p.dark ? [mix(p.mossC, p.stepMid, 0.5), mix(p.mossA, p.mid, 0.4), mix(p.mossB, p.umbra, 0.5)] : [mix(p.mossC, p.stepHi, 0.45), mix(p.mossA, p.stepMid, 0.4), mix(p.mossB, p.wash, 0.35)]
      cg.addColorStop(0, rgba(bam[0]))
      cg.addColorStop(0.3, rgba(bam[1]))
      cg.addColorStop(0.85, rgba(bam[2]))
      cg.addColorStop(1, rgba(mix(bam[2], p.umbra, 0.5)))
      gg.fillStyle = cg
      gg.beginPath()
      gg.roundRect(-pw * 0.4, -pw / 2, len + pw, pw, pw / 2)
      gg.fill()
      // nodes: a dark ring with a lit lip
      for (let x = pw * 2.2; x < len; x += Rr * 0.42) {
        gg.fillStyle = rgba(mix(bam[2], p.umbra, 0.35), 0.9)
        gg.fillRect(x - 1.5, -pw / 2, 3, pw)
        gg.fillStyle = rgba(bam[0], 0.8)
        gg.fillRect(x + 1.5, -pw / 2, 1.5, pw)
      }
      gg.strokeStyle = rgba(p.ink, 0.5)
      gg.lineWidth = 1
      gg.strokeRect(-pw * 0.4, -pw / 2, len + pw, pw)
      gg.restore()
      out(poleArt, s.c)
      yield
    }
    // ── a pine branch at the corner, nearest of all and out of focus (painted at a quarter of the resolution: soft)
    if (wide) {
      const s0 = R.span(g.zBr, 40)
      const s = sheet(R, g.zBr, 40, 0.3, [s0[0], s0[1], s0[0] + Rr * 1.2, s0[1] + Rr * 0.9])
      const gg = s.g
      const bx = s.x0 + Rr * 0.05, by = s.y0 + Rr * 0.05
      const col = p.dark ? mix(p.wash, p.mossB, 0.25) : mix(p.wash, p.mossB, 0.4)
      gg.strokeStyle = rgba(col, 0.92)
      gg.lineCap = 'round'
      gg.lineWidth = Rr * 0.05
      gg.beginPath()
      gg.moveTo(bx - Rr * 0.2, by - Rr * 0.1)
      gg.quadraticCurveTo(bx + Rr * 0.3, by + Rr * 0.12, bx + Rr * 0.55, by + Rr * 0.32)
      gg.stroke()
      const r = rng(2307)
      for (let i = 0; i < 7; i++) {
        const t = 0.25 + i * 0.11
        const cx = bx - Rr * 0.2 + Rr * 0.75 * t + (r() - 0.5) * Rr * 0.1, cy = by - Rr * 0.1 + Rr * 0.42 * t * t + (r() - 0.5) * Rr * 0.1
        gg.lineWidth = Rr * 0.012
        for (let k = 0; k < 22; k++) {
          const b = r() * TAU, l = Rr * (0.07 + r() * 0.06)
          gg.beginPath()
          gg.moveTo(cx, cy)
          gg.lineTo(cx + Math.cos(b) * l, cy + Math.sin(b) * l)
          gg.stroke()
        }
      }
      out(brArt, s.c)
      yield
    } else out(brArt)
    // ── the lantern (a round paper chōchin seen from above: its cap, its hoops, the warm paper) and the fish sprites
    {
      const lr = g.lr
      const hot = paperLamp(p, lr, R.dpr * 1.3, true)
      hot.className = 't23b-hot'
      lampHot = hot
      out(lampArt, paperLamp(p, lr, R.dpr * 1.3, false), hot)
      Object.assign(lamp.style, { width: `${f1(lr * 2.4)}px`, height: `${f1(lr * 2.4)}px` })
      yield
      const sprites = fishSprites(p, g.L, R.dpr * 1.2)
      fish.forEach((f) => {
        const sp = sprites[f.col]
        f.el.replaceChildren(sp.body.cloneNode() as HTMLCanvasElement, f.tl)
        ;(f.el.firstChild as HTMLCanvasElement).getContext('2d')!.drawImage(sp.body, 0, 0)
        const tc = sp.tail.cloneNode() as HTMLCanvasElement
        tc.getContext('2d')!.drawImage(sp.tail, 0, 0)
        f.tl.replaceChildren(tc)
        const sc = sp.shadow.cloneNode() as HTMLCanvasElement
        sc.getContext('2d')!.drawImage(sp.shadow, 0, 0)
        f.sh.replaceChildren(sc)
        Object.assign(f.el.style, { width: `${f1(g.L * 0.72)}px`, height: `${f1(g.L * 0.44)}px` })
        Object.assign(f.tl.style, { width: `${f1(g.L * 0.38)}px`, height: `${f1(g.L * 0.32)}px`, left: `${f1(-g.L * 0.32)}px`, top: `${f1(g.L * 0.06)}px` })
        Object.assign(f.sh.style, { width: `${f1(g.L * 1.05)}px`, height: `${f1(g.L * 0.4)}px` })
      })
    }
    for (const [el, kids] of fresh) el.replaceChildren(...kids)
    // the tag hangs from the pole where it crosses the upper part of the frame (layer px: it is scaled with the pole)
    {
      const sp = R.sc(g.zPole)
      const t = (Rr * (wide ? 0.62 : 0.44)) / sp
      const at: Pt = [g.Lw[0] + poleDir[0] * t, g.Lw[1] + poleDir[1] * t]
      // the board keeps inside the frame; its string stays on the pole
      const bwS = wide ? 176 : 138
      const ax = fwd(g.zPole, at[0], at[1])[0]
      const off = clamp(ax - bwS / 2, R.gut + 8, W - R.gut - 8 - bwS) - (ax - bwS / 2)
      Object.assign(tag.style, { left: `${f1(at[0])}px`, top: `${f1(at[1] + pw * 0.3)}px`, fontSize: `${f1((wide ? 14 : 13) / sp)}px`, width: `${f1(bwS / sp)}px` })
      tag.style.setProperty('--off', `${f1(off / sp)}px`)
    }
    // the answer is ink on the open water under the slab; the question's slip floats near the bank beside it
    const slabBot = fwd(-D, slab.x, slab.y + slab.h / 2)[1]
    const fsA = wide ? 19 : 16
    if (wide) {
      const ax = pc[0] - Rr * 0.14
      Object.assign(ans.style, { left: `${f1(ax)}px`, top: `${f1(slabBot + 14)}px`, width: `${f1(Rr * 0.92)}px`, fontSize: `${f1(fsA)}px`, textAlign: 'left' })
      Object.assign(qPaper.style, { left: `${f1(pc[0] - Rr * 0.8)}px`, top: `${f1(slabBot + 22)}px`, maxWidth: `${f1(Rr * 0.5)}px`, fontSize: '15px', rotate: '-7deg' })
      Object.assign(note.style, { left: `${f1(R.gut)}px`, right: 'auto', top: 'auto', bottom: '2px', width: `${f1(Math.max(220, Math.min(330, pc[0] - Rr * 1.1 - R.gut)))}px` })
    } else {
      Object.assign(ans.style, { left: '20px', top: `${f1(slabBot + 10)}px`, width: `${f1(W - 40)}px`, fontSize: `${f1(fsA)}px`, textAlign: 'center' })
      Object.assign(qPaper.style, { left: `${f1(R.gut + 10)}px`, top: `${f1(slabBot + 10 + fsA * 1.45 * 2 + 8)}px`, maxWidth: `${f1(Math.min(230, W * 0.62))}px`, fontSize: '14px', rotate: '4deg' })
      Object.assign(note.style, { left: `${f1(R.gut + 4)}px`, right: `${f1(R.gut + 4)}px`, top: 'auto', bottom: '0px', width: 'auto' })
    }
    Object.assign(ring.style, { left: `${f1(g.Lw[0] - Rr * 0.5)}px`, top: `${f1(g.Lw[1] - Rr * 0.5)}px`, width: `${f1(Rr)}px`, height: `${f1(Rr)}px` })
    wisps.forEach((w, i) => Object.assign(w.style, { left: `${f1(pc[0] - Rr * (i ? -0.1 : 0.9))}px`, top: `${f1(pc[1] + Rr * (i ? -0.55 : 0.15))}px`, width: `${f1(Rr * 1.1)}px`, height: `${f1(Rr * 0.4)}px` }))
    ready = true
    placeFish(false)
    paint()
    R.wake()
  }

  // ── fish behaviour
  const wander = (f: Fish, r: () => number) => {
    if (!G) return
    const a = r() * TAU, q = Math.sqrt(r()) * 0.72
    f.wx = G.sc[0] + Math.cos(a) * G.sR * q
    f.wy = G.sc[1] + Math.sin(a) * G.sR * q
  }
  const rr = rng(2399)
  const along = (pts: Pt[], u: number, closed: boolean): [number, number, number] => {
    const n = pts.length - (closed ? 0 : 1)
    const t = (((u % 1) + 1) % 1) * n
    const i = Math.floor(t), k = t - i
    const a = pts[i % pts.length], b = pts[(i + 1) % pts.length]
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, Math.atan2(b[1] - a[1], b[0] - a[0])]
  }
  let parade = 0
  /** Where fish i wants to be now: [x, y, heading, hold] */
  const goal = (i: number): [number, number, number, number] => {
    const f = fish[i]
    if (!G) return [f.x, f.y, f.a, 0]
    if (lvl === 0) return [f.wx, f.wy, Math.atan2(f.wy - f.y, f.wx - f.x), 0]
    if (lvl < N) {
      const [x, y, a] = along(G.cable, 0.04 + (i / (NF - 1)) * 0.92, false)
      return [x, y - G.L * 0.12, a, 1]
    }
    const [x, y, a] = along(G.route, parade + i / NF, true)
    return [x, y, a, 1]
  }
  function placeFish(init: boolean) {
    if (!G) return
    fish.forEach((f, i) => {
      if (init && f.x === 0) {
        wander(f, rr)
        f.x = f.wx
        f.y = f.wy
        wander(f, rr)
        f.a = rr() * TAU
        f.z = G!.zF + (rr() - 0.5) * G!.D * 0.25
      }
      if ((!R.live() || ctx.reduced || low) && lvl > 0) {
        const [x, y, a] = goal(i)
        f.x = x
        f.y = y
        f.a = a
      }
      draw1(f)
    })
  }
  function draw1(f: Fish) {
    if (!G) return
    const L = G.L
    f.el.style.transform = `translate(${f1(f.x)}px,${f1(f.y)}px) rotate(${f.a.toFixed(3)}rad) translate(${f1(-L * 0.36)}px,${f1(-L * 0.22)}px)`
    f.tl.style.transform = `rotate(${f.tail.toFixed(3)}rad)`
    // the shadow lies on the floor, away from the moon by the fish's height over it
    const h0 = f.z + G.D
    f.sh.style.transform = `translate(${f1(f.x + SH[0] * h0 * 1.6)}px,${f1(f.y + SH[1] * h0 * 1.6)}px) rotate(${f.a.toFixed(3)}rad) translate(${f1(-L * 0.6)}px,${f1(-L * 0.2)}px)`
  }

  R.tick((dt) => {
    if (!G || !ready || dt === 0) return false
    let moving = false
    const live = R.live()
    // the lantern eases toward its target (it is heavy: a damped follow)
    const dp = progT - prog
    if (Math.abs(dp) > 0.001) {
      prog += dp * (1 - Math.exp(-dt * 7))
      moving = true
    } else prog = progT
    paint()
    if (low) return moving
    if (lvl === N && live) parade = (parade + dt * 0.035) % 1
    for (let i = 0; i < NF; i++) {
      const f = fish[i]
      const [gx, gy, ga, hold] = goal(i)
      const dx = gx - f.x, dy = gy - f.y
      const dist = Math.hypot(dx, dy)
      const R0 = G.R
      if (lvl === 0) {
        // idle long enough: the fish glide to a stop where they are (no new targets, no frames)
        if (!live && f.v < R0 * 0.004) continue
        if (live && dist < R0 * 0.12) wander(f, rr)
      } else if (dist < R0 * 0.006 && !(lvl === N && live)) {
        // holding on the cable: settle the heading, tail at rest
        const da = Math.atan2(Math.sin(ga - f.a), Math.cos(ga - f.a))
        if (Math.abs(da) > 0.01) (f.a += da * (1 - Math.exp(-dt * 5))), (moving = true)
        f.tail *= Math.exp(-dt * 4)
        draw1(f)
        continue
      }
      const want = hold && dist < R0 * 0.08 ? ga : Math.atan2(dy, dx)
      const da = Math.atan2(Math.sin(want - f.a), Math.cos(want - f.a))
      f.a += clamp(da, -dt * 2.4, dt * 2.4)
      const vmax = R0 * (lvl === 0 ? 0.11 : 0.3)
      const vt = hold ? Math.min(vmax, dist * 2.2) : live ? vmax : 0
      f.v += (vt - f.v) * (1 - Math.exp(-dt * 2.5))
      const step = f.v * dt * (hold ? 1 : Math.max(0.25, Math.cos(da)))
      f.x += Math.cos(f.a) * step
      f.y += Math.sin(f.a) * step
      f.tp += dt * (5 + (f.v / R0) * 30)
      f.tail = Math.sin(f.tp) * (0.18 + Math.min(0.4, (f.v / R0) * 2.2)) + da * 0.3
      draw1(f)
      moving = true
    }
    return moving
  })

  /** Everything that follows the lantern: its place and size, the pool, the glow, caustics, the towers, the dim veil. */
  const pr: number[] = [0, 0, 0], pt: number[] = [0, 0, 0]
  function paint() {
    if (!G) return
    const z = lerp(G.lz[0], G.lz[1], prog)
    R.proj(G.Lw[0], G.Lw[1], z, pr)
    R.proj(G.Lw[0], G.Lw[1], G.zPole, pt)
    const s0 = R.sc(G.lz[0])
    const half = G.lr * 1.2
    const sc = pr[2] / s0
    lamp.style.transform = `translate(${f1(pr[0] - half)}px,${f1(pr[1] - half)}px) scale(${sc.toFixed(4)})`
    // the cord leaves from the cap, which sits toward the top of the lantern seen from above
    const ex = pr[0], ey = pr[1] - G.lr * 0.62 * sc
    const cl = Math.hypot(pt[0] - ex, pt[1] - ey)
    cord.style.transform = `translate(${f1(ex)}px,${f1(ey)}px) rotate(${Math.atan2(pt[1] - ey, pt[0] - ex).toFixed(3)}rad) scaleX(${f1(cl)})`
    const lv = prog * N
    const e = sm(0, 1, prog)
    pool.style.transform = `scale(${lerp(1, 0.42, e).toFixed(3)})`
    pool.style.opacity = lerp(0.3, 1, e * e * 0.6 + e * 0.4).toFixed(3)
    glow.style.opacity = sm(0.15, 1, prog).toFixed(3)
    caus.style.opacity = lerp(0.5, 1, e).toFixed(3)
    caus.style.transform = `scale(${lerp(1, 0.7, e).toFixed(3)})`
    towers.style.opacity = (sm(0.25, 1, prog) * 0.9).toFixed(3)
    dim.style.opacity = (sm(0.3, 1, prog) * 0.8).toFixed(3)
    dim.style.transform = `scale(${lerp(1.25, 0.6, e).toFixed(3)})`
    halo.style.opacity = lerp(0.6, 1, e).toFixed(3)
    if (lampHot) lampHot.style.opacity = lerp(0.45, 1, e).toFixed(3)
    halo.style.transform = `scale(${lerp(1, 1.3, e).toFixed(3)})`
    lampRefl.style.opacity = lerp(0.3, 0.75, e).toFixed(3)
    lamp.dataset.lv = String(Math.round(lv))
  }

  // ── the lantern as a slider: drag it down toward the water (or tap / keys)
  function setLevel(v: number, snap = true) {
    v = clamp(Math.round(v), 0, N)
    if (snap) progT = v / N
    if (v !== lvl) turn(v)
    if (ctx.reduced) prog = progT
    R.touch()
    if (ctx.reduced) paint()
  }
  let dragS: { id: number; y: number; p0: number; moved: boolean } | null = null
  lamp.addEventListener('pointerdown', (e) => {
    dragS = { id: e.pointerId, y: e.clientY, p0: progT, moved: false }
    lamp.setPointerCapture(e.pointerId)
    lamp.classList.add('drag')
    e.preventDefault()
  })
  lamp.addEventListener('pointermove', (e) => {
    if (!dragS || e.pointerId !== dragS.id || !G) return
    const dy = e.clientY - dragS.y
    if (Math.abs(dy) > 4) dragS.moved = true
    if (!dragS.moved) return
    progT = clamp(dragS.p0 + dy / (G.R * 0.6), 0, 1)
    if (Math.round(progT * N) !== lvl) turn(Math.round(progT * N))
    if (ctx.reduced) (prog = progT), paint()
    R.touch()
  })
  const end = (e: PointerEvent) => {
    if (!dragS || e.pointerId !== dragS.id) return
    const tap = !dragS.moved
    dragS = null
    lamp.classList.remove('drag')
    setLevel(tap ? (lvl < N ? lvl + 1 : 0) : Math.round(progT * N))
  }
  lamp.addEventListener('pointerup', end)
  lamp.addEventListener('pointercancel', end)
  lamp.addEventListener('keydown', (e) => {
    const k = e.key
    const v = k === 'ArrowRight' || k === 'ArrowDown' ? lvl + 1 : k === 'ArrowLeft' || k === 'ArrowUp' ? lvl - 1 : k === 'Home' ? 0 : k === 'End' ? N : k === 'Enter' || k === ' ' ? (lvl < N ? lvl + 1 : 0) : null
    if (v == null) return
    e.preventDefault()
    setLevel(v)
  })

  function turn(v: number) {
    lvl = v
    lamp.setAttribute('aria-valuenow', String(v))
    lamp.setAttribute('aria-valuetext', fill(K.valueText, { n: v, total: N }))
    R.root.dataset.lvl = String(v)
    ans.textContent = K.answers[v]
    if (!ans.hasAttribute('aria-live')) ans.setAttribute('aria-live', 'polite')
    if (!ctx.reduced) {
      ans.animate([{ opacity: 0, filter: low ? 'none' : 'blur(5px)', letterSpacing: '0.06em' }, { opacity: 1, filter: 'blur(0)', letterSpacing: '0em' }], { duration: 1100, easing: 'cubic-bezier(.3,.1,.2,1)' })
      ring.classList.remove('go')
      void ring.offsetWidth // restart the ripple from the lantern's foot
      ring.classList.add('go')
    }
    if (low || ctx.reduced) placeFish(false)
    ctx.chime(v === N ? 'ok' : 'tap')
    if (v > 0) delete stoneSays.dataset.off
    if (v === N) delete real.dataset.off
    if (v === N && !done) {
      done = true
      ctx.insight(K.insight, K.detail)
    }
  }
}

/**
 * A round paper lantern (chōchin) seen from above and a little in front: the lacquered cap near the top, the bamboo
 * hoops as latitude rings (each drawn only where it faces us), the paper lit from inside (hot) or by the moon (cold).
 * The canvas is 2.4 lr square, the lantern's centre in the middle.
 */
function paperLamp(p: Pal, lr: number, dpr: number, hot: boolean) {
  const c = canvas(lr * 2.4, lr * 2.4, dpr)
  const gg = c.g
  const x = lr * 1.2, y = lr * 1.2
  const ce = 0.6, se = 0.8 // the view: cos and sin of the camera's angle above the horizon
  const ry = lr * 1.06 // a chōchin is a little taller than wide
  const at = (phi: number, th: number): Pt => [x + lr * Math.cos(phi) * Math.cos(th), y - ry * Math.sin(phi) * ce + lr * Math.cos(phi) * Math.sin(th) * se]
  // the paper body: its silhouette and its light
  const body = () => {
    gg.beginPath()
    gg.ellipse(x, y, lr, lr * 1.02, 0, 0, TAU)
  }
  body()
  const bg = gg.createRadialGradient(x - lr * 0.1, y + lr * 0.2, lr * 0.05, x, y, lr)
  if (hot) {
    bg.addColorStop(0, rgba(mix(p.moon, p.lantern, 0.15)))
    bg.addColorStop(0.45, rgba(mix(p.lantern, p.moon, 0.2)))
    bg.addColorStop(0.85, rgba(p.lantern))
    bg.addColorStop(1, rgba(mix(p.lantern, p.red, 0.45)))
  } else {
    const pp = p.dark ? mix(p.lantern, p.mid, 0.55) : mix(p.card, p.lantern, 0.35)
    bg.addColorStop(0, rgba(mix(pp, p.moon, 0.3)))
    bg.addColorStop(0.7, rgba(pp))
    bg.addColorStop(1, rgba(mix(pp, p.umbra, 0.35)))
  }
  gg.fillStyle = bg
  gg.fill()
  // the hoops: latitude rings, drawn where the paper faces us (n · view > 0)
  const rib = hot ? rgba(mix(p.red, p.umbra, 0.35), 0.42) : rgba(mix(p.lo, p.umbra, 0.3), 0.5)
  gg.strokeStyle = rib
  gg.lineWidth = Math.max(0.7, lr * 0.028)
  for (const deg of [62, 46, 31, 16, 1, -14, -29, -44, -58]) {
    const phi = (deg * Math.PI) / 180
    gg.beginPath()
    let on = false
    for (let i = 0; i <= 48; i++) {
      const th = (i / 48) * TAU
      const vis = Math.sin(phi) * se + Math.cos(phi) * Math.sin(th) * ce > 0.02
      const [px, py] = at(phi, th)
      if (vis && on) gg.lineTo(px, py)
      else if (vis) (gg.moveTo(px, py), (on = true))
      else on = false
    }
    gg.stroke()
  }
  // the paper between the hoops swells a little: a soft light band along each
  if (hot) {
    gg.save()
    body()
    gg.clip()
    const hg = gg.createRadialGradient(x, y + lr * 0.25, 0, x, y + lr * 0.25, lr * 0.75)
    hg.addColorStop(0, rgba(p.moon, 0.55))
    hg.addColorStop(1, rgba(p.moon, 0))
    gg.fillStyle = hg
    gg.fillRect(x - lr, y - lr, lr * 2, lr * 2)
    gg.restore()
  }
  // the moon's sheen on the far shoulder, the ink outline heavier in the shade
  gg.strokeStyle = rgba(p.moon, hot ? 0.4 : 0.7)
  gg.lineWidth = lr * 0.07
  gg.beginPath()
  gg.ellipse(x, y, lr * 0.93, lr * 0.91, 0, -1.55, -0.25)
  gg.stroke()
  gg.strokeStyle = rgba(p.dark ? p.umbra : p.ink, 0.55)
  gg.lineWidth = Math.max(1, lr * 0.03)
  body()
  gg.stroke()
  gg.strokeStyle = rgba(p.dark ? p.umbra : p.ink, 0.35)
  gg.lineWidth = Math.max(1, lr * 0.06)
  gg.beginPath()
  gg.ellipse(x, y, lr * 0.99, lr * 0.97, 0, 1.9, 3.6)
  gg.stroke()
  // the lacquered cap: a ring of black wood near the top, its rim lit, the hook in its middle
  const cx0 = x, cy0 = at(1.32, 0)[1]
  const crx = lr * 0.27, cry = lr * 0.27 * se
  gg.fillStyle = rgba(p.umbra, 0.35)
  gg.beginPath()
  gg.ellipse(cx0, cy0 + cry * 0.35, crx * 1.08, cry * 1.1, 0, 0, TAU)
  gg.fill()
  const capC: RGB = p.dark ? mix(p.umbra, p.lo, 0.45) : mix(p.wash, p.umbra, 0.4)
  gg.fillStyle = rgba(capC)
  gg.beginPath()
  gg.ellipse(cx0, cy0, crx, cry, 0, 0, TAU)
  gg.fill()
  gg.strokeStyle = rgba(p.red, 0.75) // the worn red under the black lacquer on its edge
  gg.lineWidth = Math.max(0.8, lr * 0.025)
  gg.beginPath()
  gg.ellipse(cx0, cy0, crx * 0.97, cry * 0.95, 0, 0.3, 2.6)
  gg.stroke()
  gg.strokeStyle = rgba(p.moon, 0.75)
  gg.lineWidth = Math.max(1, lr * 0.04)
  gg.beginPath()
  gg.ellipse(cx0, cy0, crx * 0.92, cry * 0.88, 0, -2.6, -0.3)
  gg.stroke()
  // the wood's top face, lit, and the iron ring the cord goes through
  const tg = gg.createLinearGradient(cx0 + crx, cy0 - cry, cx0 - crx, cy0 + cry)
  tg.addColorStop(0, rgba(mix(capC, p.moon, 0.25)))
  tg.addColorStop(1, rgba(mix(capC, p.lo, 0.3)))
  gg.fillStyle = tg
  gg.beginPath()
  gg.ellipse(cx0, cy0, crx * 0.66, cry * 0.66, 0, 0, TAU)
  gg.fill()
  gg.strokeStyle = rgba(p.dark ? p.hi : p.stepMid, 0.95)
  gg.lineWidth = Math.max(1, lr * 0.04)
  gg.beginPath()
  gg.ellipse(cx0, cy0 - cry * 0.15, crx * 0.2, cry * 0.32, 0, Math.PI * 1.05, Math.PI * 1.95)
  gg.stroke()
  return c.c
}

/** A tileable net of caustic light (cell edges of a jittered grid), moon-coloured on transparent; data URL per palette. */
const causCache = new Map<string, string>()
function* causticTile(p: Pal): Generator<void, string> {
  const key = rgba(p.moon) + p.dark
  const hit = causCache.get(key)
  if (hit) return hit
  const S = 256, n = 7
  const r = rng(2310)
  const pts: Pt[] = []
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) pts.push([(i + 0.15 + r() * 0.7) / n, (j + 0.15 + r() * 0.7) / n])
  const c = document.createElement('canvas')
  c.width = c.height = S
  const img = new ImageData(S, S)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S
      let d1 = 9, d2 = 9
      const ci = Math.floor(u * n), cj = Math.floor(v * n)
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const ii = (ci + di + n) % n, jj = (cj + dj + n) % n
          const q = pts[jj * n + ii]
          const qx = q[0] + (ci + di < 0 ? -1 : ci + di >= n ? 1 : 0), qy = q[1] + (cj + dj < 0 ? -1 : cj + dj >= n ? 1 : 0)
          const d = Math.hypot(qx - u, qy - v)
          if (d < d1) (d2 = d1), (d1 = d)
          else if (d < d2) d2 = d
        }
      const e = 1 - sm(0, 0.045, d2 - d1)
      const j = (y * S + x) * 4
      img.data[j] = p.moon[0]
      img.data[j + 1] = p.moon[1]
      img.data[j + 2] = p.moon[2]
      img.data[j + 3] = e * e * 245
    }
    if ((y & 15) === 15) yield
  }
  c.getContext('2d')!.putImageData(img, 0, 0)
  const url = c.toDataURL()
  causCache.set(key, url)
  return url
}

/** Koi seen from above (kohaku, hi, sumi, ogon, shiro-bekko): the body with fins (nose to the right), a separate tail
 *  that sways, and a shadow shaped like the fish for the floor. */
function fishSprites(p: Pal, L: number, dpr: number) {
  const ivory = p.dark ? mix(p.moon, p.ink, 0.2) : mix(p.card, p.moon, 0.5)
  const red = p.dark ? mix(p.red, p.lantern, 0.12) : p.red
  const sumi = mix(p.umbra, p.lo, p.dark ? 0.4 : 0.3)
  const gold = mix(p.moon, p.lantern, 0.6)
  const looks: [RGB, RGB | null][] = [[ivory, red], [red, ivory], [sumi, ivory], [gold, null], [ivory, sumi]]
  return looks.map(([base, patch], k) => {
    const bw = L * 0.72, bh = L * 0.44
    const b = canvas(bw, bh, dpr)
    const g = b.g
    const cy = bh / 2, W0 = L * 0.14
    // t: 0 at the tail root, 1 at the nose; the widest just behind the head
    const half = (t: number) => W0 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.1 + t * 0.92)), 0.7) * (0.55 + 0.45 * Math.min(1, t * 1.6))
    const outline = (gg: CanvasRenderingContext2D, k2 = 1) => {
      gg.beginPath()
      for (let i = 0; i <= 28; i++) {
        const t = i / 28
        i ? gg.lineTo(t * bw * 0.98, cy - half(t) * k2) : gg.moveTo(0, cy - half(0) * k2)
      }
      for (let i = 28; i >= 0; i--) {
        const t = i / 28
        gg.lineTo(t * bw * 0.98, cy + half(t) * k2)
      }
      gg.closePath()
    }
    // pectoral fins, translucent with rays
    for (const sd of [-1, 1]) {
      g.fillStyle = rgba(mix(base, p.moon, 0.3), 0.6)
      g.beginPath()
      g.moveTo(bw * 0.7, cy + sd * W0 * 0.7)
      g.quadraticCurveTo(bw * 0.62, cy + sd * W0 * 2.0, bw * 0.45, cy + sd * W0 * 1.85)
      g.quadraticCurveTo(bw * 0.52, cy + sd * W0 * 1.1, bw * 0.6, cy + sd * W0 * 0.75)
      g.fill()
      g.strokeStyle = rgba(p.umbra, 0.22)
      g.lineWidth = 0.6
      for (let i = 0; i < 4; i++) {
        g.beginPath()
        g.moveTo(bw * 0.66, cy + sd * W0 * 0.8)
        g.lineTo(bw * (0.49 + i * 0.03), cy + sd * W0 * (1.82 - i * 0.12))
        g.stroke()
      }
    }
    outline(g)
    g.fillStyle = rgba(base)
    g.fill()
    g.save()
    outline(g)
    g.clip()
    if (patch) {
      const r = rng(2320 + k)
      g.fillStyle = rgba(patch, 0.96)
      for (let i = 0; i < 3; i++) {
        const x = bw * (0.22 + r() * 0.62), y = cy + (r() - 0.5) * W0 * 0.7
        g.beginPath()
        g.ellipse(x, y, bw * (0.09 + r() * 0.09), W0 * (0.7 + r() * 0.45), (r() - 0.5) * 0.6, 0, TAU)
        g.fill()
      }
    }
    // a cylinder: dark flanks, a sheen down the spine; the head a touch paler
    const cg = g.createLinearGradient(0, cy - W0, 0, cy + W0)
    cg.addColorStop(0, rgba(p.umbra, 0.45))
    cg.addColorStop(0.32, rgba(p.umbra, 0))
    cg.addColorStop(0.46, rgba(p.moon, p.dark ? 0.4 : 0.55))
    cg.addColorStop(0.6, rgba(p.umbra, 0))
    cg.addColorStop(1, rgba(p.umbra, 0.5))
    g.fillStyle = cg
    g.fillRect(0, 0, bw, bh)
    const hg = g.createLinearGradient(bw * 0.78, 0, bw, 0)
    hg.addColorStop(0, rgba(p.moon, 0))
    hg.addColorStop(1, rgba(p.moon, p.dark ? 0.2 : 0.3))
    g.fillStyle = hg
    g.fillRect(0, 0, bw, bh)
    g.restore()
    // the dorsal fin down the spine
    g.strokeStyle = rgba(mix(base, p.umbra, 0.45), 0.6)
    g.lineWidth = Math.max(0.8, L * 0.014)
    g.lineCap = 'round'
    g.beginPath()
    g.moveTo(bw * 0.28, cy)
    g.lineTo(bw * 0.66, cy)
    g.stroke()
    g.strokeStyle = rgba(p.dark ? p.umbra : p.wash, 0.6)
    g.lineWidth = Math.max(0.8, L * 0.012)
    outline(g)
    g.stroke()
    g.fillStyle = rgba(p.umbra, 0.9)
    for (const sd of [-1, 1]) {
      g.beginPath()
      g.arc(bw * 0.9, cy + sd * W0 * 0.55, Math.max(0.9, L * 0.014), 0, TAU)
      g.fill()
    }
    const tw = L * 0.38, th = L * 0.32
    const t = canvas(tw, th, dpr)
    const tg = t.g
    tg.fillStyle = rgba(mix(base, p.moon, 0.25), 0.7)
    tg.beginPath()
    tg.moveTo(tw, th / 2 - L * 0.025)
    tg.quadraticCurveTo(tw * 0.5, th * 0.22, 0, 0)
    tg.quadraticCurveTo(tw * 0.28, th * 0.5, 0, th)
    tg.quadraticCurveTo(tw * 0.5, th * 0.78, tw, th / 2 + L * 0.025)
    tg.closePath()
    tg.fill()
    tg.strokeStyle = rgba(p.umbra, 0.25)
    tg.lineWidth = 0.6
    for (let i = 0; i < 7; i++) {
      tg.beginPath()
      tg.moveTo(tw, th / 2)
      tg.lineTo(tw * 0.05, th * (0.05 + i * 0.15))
      tg.stroke()
    }
    // the shadow: the fish's shape with its fins and tail, soft, on the floor
    const sw = L * 1.05, shh = L * 0.4
    const s = canvas(sw, shh, Math.min(1, dpr))
    s.g.filter = `blur(${f1(L * 0.03)}px)`
    s.g.fillStyle = rgba(p.umbra, p.dark ? 0.6 : 0.36)
    s.g.beginPath()
    s.g.ellipse(sw * 0.6, shh / 2, bw * 0.5, W0 * 1.05, 0, 0, TAU)
    s.g.moveTo(sw * 0.28, shh / 2)
    s.g.lineTo(sw * 0.06, shh * 0.18)
    s.g.lineTo(sw * 0.12, shh / 2)
    s.g.lineTo(sw * 0.06, shh * 0.82)
    s.g.closePath()
    s.g.fill()
    return { body: b.c, tail: t.c, shadow: s.c }
  })
}
