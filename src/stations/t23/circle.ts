import { h, nextId, s } from '../../core/dom'
import { onPrefs } from '../../core/prefs'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import type { SceneCtx, SceneDef } from '../types'
import { perspectiveCircle, type PondGeo } from '../../ui/part2/perspectives'
import { rng } from '../../ui/part2/ink'
import { C } from './data'
import { canvas, clamp, f1, fbm, field, lerp, mix, put, readPal, rgba, sm, softEllipse, stone, vn, type Pal, type RGB } from './lit'

const K = C.scenes.circle
const TAU = Math.PI * 2
/** the moon stands behind the tray, to the right: a stone turned toward it lights up */
const MOON_A = -Math.PI * 0.3
/** the four stones: w, h (shares of the tray radius), flat, moss, seal, squareness */
const SHAPES: [number, number, number, number, boolean, number][] = [
  [0.17, 0.36, 0.3, 0.12, false, 2.6], // tall, upright
  [0.38, 0.14, 0.45, 0.1, false, 3], // long, lying
  [0.27, 0.19, 0.62, 1, false, 2], // a cushion of moss
  [0.23, 0.22, 0.25, 0.15, true, 3.6], // carved with a seal
]
/** the stones stand on the turning top, between the water (WR) and the fixed rim (0.87) */
const RING = 0.8, WR = 0.42, TILT = 0.38

/**
 * Scene 4 — 3Q 25°, a still life: a round black lacquer tray on curved legs, standing on a wooden table under the high
 * moon. On its turning top, four stones of four shapes; in the middle, water holding the moon with fine rings. The
 * question is carved round its rim. Drag round the centre to turn the tray (a lazy susan): the stones run on the
 * ellipse, grow as they come near, pass in front of each other and catch the moon as they face it. The stone that stops
 * at six o'clock speaks: its words unroll on a paper strip across the table in front of the tray, and the moon in the
 * water leans toward it. Touch a stone (or 1–4) and the tray brings it round. All four heard: the rings stop, the
 * moon's reflection becomes one still circle.
 */
export const circleScene: SceneDef = {
  label: K.label,
  mount(ctx: SceneCtx) {
    let api: { pick(k: number): void } | null = null
    let phi = 0 // tray turn
    let phiT = 0
    let front = -1
    const n = K.perspectives.stones.length
    const still = ctx.quality === 'low' || ctx.reduced
    let geo: { cx: number; cy: number; rx: number; ry: number; Rt: number; w: number; h: number } | null = null
    // where the component put each stone's button (all at one point): the turn moves them from there by transform
    const base = { x: 0, y: 0 }
    let host: HTMLElement | null = null
    let root: HTMLElement | null = null
    const stones: { el: HTMLElement; lit: HTMLElement; sh: HTMLElement; w: number; h: number }[] = []
    const dots = Array.from({ length: 12 }, () => h('i', { class: 't23c-dot' }))
    let pal = readPal()

    // ── the turn: angle of stone k on the top, its place, size, light; the buttons follow
    const angle = (k: number) => phi + Math.PI / 2 + (k * TAU) / n
    function draw() {
      if (!geo || !root) return
      const { cx, cy, rx, ry } = geo
      const btns = root.querySelectorAll<HTMLElement>('.p2c-stone')
      for (let k = 0; k < n; k++) {
        const a = angle(k)
        const x = cx + Math.cos(a) * rx * RING, y = cy + Math.sin(a) * ry * RING
        const sc = 1 + Math.sin(a) * 0.16
        const lit = sm(-0.2, 1, Math.cos(a - MOON_A))
        const st = stones[k]
        if (!st) continue
        st.el.style.transform = `translate(${f1(x)}px,${f1(y)}px) scale(${sc.toFixed(3)})`
        st.el.style.zIndex = String(Math.round(y))
        st.lit.style.opacity = lit.toFixed(3)
        const b = btns[k]
        if (b) {
          b.style.transform = `translate(${f1(x - base.x)}px,${f1(y - st.h * sc * 0.45 - base.y)}px) scale(${sc.toFixed(3)})`
          b.style.zIndex = String(Math.round(y) + 1000)
        }
      }
      for (let i = 0; i < dots.length; i++) {
        const a = phi + (i * TAU) / dots.length
        dots[i].style.transform = `translate(${f1(cx + Math.cos(a) * rx * 0.93)}px,${f1(cy + Math.sin(a) * ry * 0.93)}px) scale(${(1 + Math.sin(a) * 0.2).toFixed(2)})`
      }
    }
    const loop = createLoop(ctx.art, (_t, dt) => {
      const d = phiT - phi
      if (Math.abs(d) < 0.0008) {
        phi = phiT
        draw()
        return false
      }
      phi += d * (dt > 0 ? 1 - Math.exp(-dt * 5) : 1)
      draw()
      return true
    }, { essential: true })
    ctx.onCleanup(() => loop.dispose())
    const turnTo = (k: number) => {
      // bring stone k to six o'clock by the short way round
      const want = -(k * TAU) / n
      let d = want - phiT
      d = Math.atan2(Math.sin(d), Math.cos(d))
      phiT += d
      if (still) phi = phiT
      loop.start()
      if (still) draw()
    }
    const nearest = () => {
      let best = 0, bd = 9
      for (let k = 0; k < n; k++) {
        const d = Math.abs(Math.atan2(Math.sin(angle(k) - Math.PI / 2), Math.cos(angle(k) - Math.PI / 2)))
        if (d < bd) (bd = d), (best = k)
      }
      return best
    }

    // ── the still life, baked per layout and theme
    let job: { cancel(): void } | null = null
    const art = h('div', { class: 't23-abs t23c-art' })
    const water = h('div', { class: 't23c-water' })
    const reflect = h('i', { class: 't23c-moonr' })
    const rings = s('svg', { class: 't23c-rings', 'aria-hidden': 'true' })
    const carve = s('svg', { class: 't23c-carve', 'aria-hidden': 'true' })
    const top = h('div', { class: 't23-abs t23c-top' })
    function* bake(W: number, H: number, first: boolean): Generator<unknown, void> {
      if (!host) return
      const p = pal
      const wide = W / H > 1.05
      // the tray takes about 60% of a wide frame; on a phone nearly all its width
      const Rt = wide ? Math.min(W * 0.3, H * 0.62) : Math.min(W * 0.46, H * 0.34)
      const rx = Rt, ry = Rt * TILT
      const lip = Math.max(Rt * 0.1, 19) // the side of the tray seen under its top (the question is carved on it)
      const legH = Rt * 0.13
      const cx = W / 2, cy = wide ? Math.max(Rt * 0.62, H * 0.42) : Math.max(Rt * 0.7, H * 0.25)
      geo = { cx, cy, rx, ry, Rt, w: W, h: H }
      const kids: HTMLElement[] = []
      const lacq: RGB = p.dark ? mix(p.umbra, p.lo, 0.22) : mix(p.wash, p.umbra, 0.35)
      const shine: RGB = p.dark ? p.moon : mix(p.card, p.moon, 0.5)
      const red: RGB = p.dark ? mix(p.red, p.umbra, 0.25) : mix(p.red, p.umbra, 0.15)
      // the night beyond and the table under the tray
      {
        const c = canvas(W, H, Math.min(2, devicePixelRatio || 1) * (ctx.quality === 'low' ? 0.75 : 1))
        const gg = c.g
        const ty = Math.max(H * 0.1, cy - ry * 1.75) // the far edge of the table
        const sky = gg.createLinearGradient(0, 0, 0, ty)
        sky.addColorStop(0, rgba(p.paper, 0))
        sky.addColorStop(1, rgba(p.dark ? mix(p.paper, p.mist, 0.14) : p.card, 0.85))
        gg.fillStyle = sky
        gg.fillRect(0, 0, W, ty)
        const mx = W * (wide ? 0.8 : 0.84), my = Math.max(Rt * 0.12, ty * 0.35), mr = Math.max(7, Rt * 0.05)
        const mg = gg.createRadialGradient(mx, my, 0, mx, my, mr * 6)
        mg.addColorStop(0, rgba(p.moon, p.dark ? 0.4 : 0.6))
        mg.addColorStop(1, rgba(p.moon, 0))
        gg.fillStyle = mg
        gg.fillRect(mx - mr * 6, my - mr * 6, mr * 12, mr * 12)
        gg.fillStyle = rgba(p.moon)
        gg.beginPath()
        gg.arc(mx, my, mr, 0, TAU)
        gg.fill()
        // a far ridge in the mist, melting at both ends
        const rg = gg.createLinearGradient(0, 0, W, 0)
        const rc = p.dark ? mix(p.wash, p.mist, 0.14) : mix(p.wash, p.paper, 0.8)
        rg.addColorStop(0, rgba(rc, 0))
        rg.addColorStop(0.3, rgba(rc, 0.85))
        rg.addColorStop(0.7, rgba(rc, 0.85))
        rg.addColorStop(1, rgba(rc, 0))
        gg.fillStyle = rg
        gg.beginPath()
        gg.moveTo(0, ty)
        for (let x = 0; x <= W; x += 6) gg.lineTo(x, ty - ty * 0.25 * (0.3 + 0.7 * fbm(x * 0.006 + 3, 3, 3)) * (0.5 + 0.5 * Math.sin((x / W) * 3 + 1)))
        gg.lineTo(W, ty)
        gg.fill()
        // the table: planks running across, narrower with distance, each its own tone; long wavy grain, a knot or
        // two, dark gaps with a lit lip; the moon's long sheen; it fades out toward us and the sides
        const th = H - ty
        const nPl = wide ? 9 : 8
        // plank edges: evenly spaced in depth, so the far ones are thin
        const edges: number[] = []
        for (let i = 0; i <= nPl; i++) {
          const z = 1 / lerp(1 / 1, 1 / 4.2, 1 - i / nPl) // 1 near … 4.2 far
          edges.push(ty + th * ((1 / z - 1 / 4.2) / (1 - 1 / 4.2)))
        }
        const plankAt = (y: number) => {
          let i = 0
          while (i < nPl - 1 && y > edges[i + 1]) i++
          return i
        }
        const wood: RGB = p.dark ? mix(p.lo, p.umbra, 0.3) : mix(mix(p.stepLo, p.lo, 0.4), p.lantern, 0.12)
        const woodHi: RGB = p.dark ? mix(p.lo, p.mid, 0.55) : mix(mix(p.stepMid, p.stepLo, 0.4), p.lantern, 0.12)
        const woodLo: RGB = p.dark ? mix(p.umbra, p.lo, 0.35) : mix(p.lo, p.umbra, 0.25)
        const tex = yield* field(W, th, 3, (x, y, o) => {
          const wy = ty + y
          const i = plankAt(wy)
          const y0 = edges[i], y1 = edges[i + 1]
          const v = (wy - y0) / Math.max(1, y1 - y0) // across the plank
          const u = (x - cx) / (W * 0.5)
          const depth = (wy - ty) / th
          // grain: fine fibres along the plank, a few long rings waving round knots
          const kx = fbm(x * 0.003 + i * 13, i * 3.1, 3)
          const ring = Math.sin((v * (4 + (i % 3)) + (kx - 0.5) * 2.2) * Math.PI)
          const fibre = vn(x * 0.012 + i * 31, v * 26 + i)
          const tone = (vn(i * 5.3, 1.7) - 0.5) * 0.3
          let c = mix(wood, tone > 0 ? woodHi : woodLo, Math.abs(tone))
          c = mix(c, woodLo, sm(0.75, 0.98, ring) * 0.3)
          c = mix(c, woodHi, sm(0.55, 0.85, fibre) * 0.18)
          // the gap at the far edge of each plank (dark), the lit lip just after it
          const gapW = 0.05 + 0.04 * (1 - depth)
          c = mix(c, p.umbra, (1 - sm(0, gapW, v)) * 0.8)
          c = mix(c, woodHi, sm(gapW, gapW + 0.03, v) * (1 - sm(gapW + 0.03, gapW + 0.09, v)) * 0.55)
          // the moon's long sheen across the boards toward us, from behind the tray on the right
          const sheen = Math.exp(-Math.pow((u - 0.42 + depth * 0.5) * 2.4, 2)) * (1 - depth * 0.55)
          c = mix(c, shine, sheen * (p.dark ? 0.2 : 0.3))
          o[0] = c[0]; o[1] = c[1]; o[2] = c[2]
          o[3] = (1 - sm(0.6, 1, Math.abs(u) * (1 - depth * 0.2))) * (1 - sm(0.88, 1, depth)) * sm(0, 0.03, depth)
        })
        put(gg, tex, 0, ty, W, th)
        yield
        const eg = gg.createLinearGradient(W * 0.1, 0, W * 0.9, 0)
        eg.addColorStop(0, rgba(shine, 0))
        eg.addColorStop(0.65, rgba(shine, p.dark ? 0.35 : 0.7))
        eg.addColorStop(1, rgba(shine, 0))
        gg.strokeStyle = eg
        gg.lineWidth = 1.2
        gg.beginPath()
        gg.moveTo(W * 0.1, ty + 0.5)
        gg.lineTo(W * 0.9, ty + 0.5)
        gg.stroke()
        // the tray's shadow on the table: the moon is high behind it on the right, so it falls long toward us and left
        softEllipse(gg, cx - Rt * 0.26, cy + lip + legH + ry * 0.45, rx * 1.2, ry * 1.15, p.umbra, p.dark ? 0.85 : 0.5, -0.12)
        softEllipse(gg, cx - Rt * 0.08, cy + lip + legH * 0.9, rx * 0.95, ry * 0.85, p.umbra, p.dark ? 0.7 : 0.35)
        // the legs: curved "cat's feet" under the side band, flaring at the foot, lit on the moon's side
        for (const a of [0.3, 1.1, 1.95, 2.8]) {
          const lx = cx + Math.cos(a) * rx * 0.8, ly = cy + Math.sin(a) * ry * 0.8 + lip
          const sd = Math.cos(a) > 0 ? 1 : -1
          const lw = Rt * 0.07
          softEllipse(gg, lx - lw * 0.6, ly + legH + 2, lw * 1.3, lw * 0.35, p.umbra, p.dark ? 0.8 : 0.45)
          gg.fillStyle = rgba(lacq)
          gg.beginPath()
          gg.moveTo(lx - lw * 0.55, ly - 2)
          gg.lineTo(lx + lw * 0.55, ly - 2)
          gg.quadraticCurveTo(lx + lw * 0.3, ly + legH * 0.6, lx + lw * (0.45 + sd * 0.35), ly + legH)
          gg.lineTo(lx - lw * (0.45 - sd * 0.35), ly + legH)
          gg.quadraticCurveTo(lx - lw * 0.3, ly + legH * 0.6, lx - lw * 0.55, ly - 2)
          gg.fill()
          gg.strokeStyle = rgba(shine, p.dark ? 0.55 : 0.7)
          gg.lineWidth = Math.max(1, lw * 0.1)
          gg.beginPath()
          gg.moveTo(lx + lw * 0.42, ly)
          gg.quadraticCurveTo(lx + lw * 0.22, ly + legH * 0.6, lx + lw * (0.4 + sd * 0.35), ly + legH - 1)
          gg.stroke()
          gg.strokeStyle = rgba(red, 0.75) // worn through to the red at the foot
          gg.lineWidth = Math.max(1, lw * 0.12)
          gg.beginPath()
          gg.moveTo(lx - lw * (0.4 - sd * 0.35), ly + legH - 0.5)
          gg.lineTo(lx + lw * (0.4 + sd * 0.35), ly + legH - 0.5)
          gg.stroke()
        }
        // the side band: black lacquer, a specular stripe where the moon catches the curve, the worn red at its lips
        gg.fillStyle = rgba(lacq)
        gg.beginPath()
        gg.ellipse(cx, cy + lip, rx, ry, 0, 0, Math.PI)
        gg.lineTo(cx - rx, cy)
        gg.ellipse(cx, cy, rx, ry, 0, Math.PI, 0, true)
        gg.closePath()
        gg.fill()
        gg.save()
        gg.clip()
        const sideG = gg.createLinearGradient(cx - rx, 0, cx + rx, 0)
        sideG.addColorStop(0, rgba(p.umbra, 0.45))
        sideG.addColorStop(0.62, rgba(shine, 0))
        sideG.addColorStop(0.76, rgba(shine, p.dark ? 0.32 : 0.4))
        sideG.addColorStop(0.8, rgba(shine, p.dark ? 0.12 : 0.15))
        sideG.addColorStop(0.92, rgba(shine, p.dark ? 0.22 : 0.3))
        sideG.addColorStop(1, rgba(p.umbra, 0.3))
        gg.fillStyle = sideG
        gg.fillRect(cx - rx, cy - ry, rx * 2, ry * 2 + lip * 2)
        gg.restore()
        const worn = (y0: number, from: number, to: number, a: number, wdt: number) => {
          // a red line broken where the black still holds
          for (let i = 0; i < 90; i++) {
            const t0 = from + ((to - from) * i) / 90, t1 = from + ((to - from) * (i + 1)) / 90
            const k = sm(0.45, 0.7, vn(i * 0.35 + y0 * 0.01, 4.2))
            if (k < 0.05) continue
            gg.strokeStyle = rgba(red, a * k)
            gg.lineWidth = wdt
            gg.beginPath()
            gg.ellipse(cx, y0, rx * 0.998, ry * 0.998, 0, t0, t1)
            gg.stroke()
          }
        }
        worn(cy + lip - 1, 0.05, Math.PI - 0.05, 0.85, Math.max(1.2, Rt * 0.008))
        // the top: lacquer with the moon's two specular bands on the far right of the rim, the worn red rim edge
        const topG = gg.createLinearGradient(0, cy - ry, 0, cy + ry)
        topG.addColorStop(0, rgba(mix(lacq, p.mid, p.dark ? 0.22 : 0.18)))
        topG.addColorStop(1, rgba(lacq))
        gg.fillStyle = topG
        gg.beginPath()
        gg.ellipse(cx, cy, rx, ry, 0, 0, TAU)
        gg.fill()
        gg.save()
        gg.beginPath()
        gg.ellipse(cx, cy, rx, ry, 0, 0, TAU)
        gg.clip()
        for (const [a0, a1, wq, al] of [[-0.62, -0.08, 0.06, 0.85], [-0.75, 0.05, 0.13, 0.22], [-2.7, -2.35, 0.04, 0.3]] as [number, number, number, number][]) {
          gg.strokeStyle = rgba(shine, (p.dark ? 0.8 : 1) * al)
          gg.lineWidth = Math.max(1.5, Rt * wq * 0.5)
          gg.lineCap = 'round'
          gg.beginPath()
          gg.ellipse(cx, cy, rx * 0.935, ry * 0.92, 0, Math.PI * a0, Math.PI * a1)
          gg.stroke()
        }
        // the moon's broad soft gleam on the turning top, beyond the water
        const tg = gg.createRadialGradient(cx + rx * 0.35, cy - ry * 0.55, 0, cx + rx * 0.35, cy - ry * 0.55, rx * 0.5)
        tg.addColorStop(0, rgba(shine, p.dark ? 0.16 : 0.2))
        tg.addColorStop(1, rgba(shine, 0))
        gg.fillStyle = tg
        gg.fillRect(cx - rx, cy - ry, rx * 2, ry * 2)
        gg.restore()
        worn(cy, Math.PI * 0.02, Math.PI * 0.98, 0.9, Math.max(1.2, Rt * 0.009))
        worn(cy, Math.PI * 1.05, Math.PI * 1.95, 0.55, Math.max(1, Rt * 0.007))
        // the turning top inside the rim: a groove between them
        gg.strokeStyle = rgba(p.umbra, 0.85)
        gg.lineWidth = Math.max(1.2, Rt * 0.01)
        gg.beginPath()
        gg.ellipse(cx, cy, rx * 0.87, ry * 0.87, 0, 0, TAU)
        gg.stroke()
        gg.strokeStyle = rgba(shine, p.dark ? 0.25 : 0.35)
        gg.lineWidth = 1
        gg.beginPath()
        gg.ellipse(cx, cy + 1.2, rx * 0.87, ry * 0.87, 0, 0.1, Math.PI - 0.1)
        gg.stroke()
        // the well of water in the middle: its lacquer lip, the water deepening toward us, faint still rings
        const wr = Rt * WR
        gg.fillStyle = rgba(mix(lacq, p.umbra, 0.5))
        gg.beginPath()
        gg.ellipse(cx, cy + 2, wr * 1.03, wr * TILT * 1.05, 0, 0, TAU)
        gg.fill()
        const wg = gg.createLinearGradient(0, cy - wr * TILT, 0, cy + wr * TILT)
        wg.addColorStop(0, rgba(p.dark ? mix(p.paper, p.mist, 0.34) : mix(p.water, p.card, 0.5)))
        wg.addColorStop(1, rgba(p.dark ? mix(p.paper, p.mist, 0.1) : mix(p.water, p.wash, 0.25)))
        gg.fillStyle = wg
        gg.beginPath()
        gg.ellipse(cx, cy, wr, wr * TILT, 0, 0, TAU)
        gg.fill()
        gg.strokeStyle = rgba(p.dark ? p.moon : p.card, p.dark ? 0.12 : 0.3)
        gg.lineWidth = 0.8
        for (let i = 1; i <= 4; i++) {
          gg.beginPath()
          gg.ellipse(cx, cy, wr * i * 0.21, wr * i * 0.21 * TILT, 0, 0, TAU)
          gg.stroke()
        }
        gg.strokeStyle = rgba(p.umbra, 0.6)
        gg.lineWidth = Math.max(1.5, Rt * 0.014)
        gg.beginPath()
        gg.ellipse(cx, cy - 1, wr, wr * TILT, 0, Math.PI * 1.02, Math.PI * 1.98)
        gg.stroke()
        // the table melts into the paper at the frame's edges
        const fade = (x0: number, y0: number, x1: number, y1: number, w: number) => {
          gg.save()
          gg.globalCompositeOperation = 'destination-out'
          const lg = gg.createLinearGradient(x0, y0, x1, y1)
          lg.addColorStop(0, '#000')
          lg.addColorStop(1, '#0000')
          gg.fillStyle = lg
          gg.fillRect(x0 < x1 ? x0 : x1, y0 < y1 ? y0 : y1, Math.abs(x1 - x0) || w, Math.abs(y1 - y0) || w)
          gg.restore()
        }
        fade(0, 0, W * 0.07, 0, H)
        fade(W, 0, W * 0.93, 0, H)
        fade(0, H, 0, H * 0.9, W)
        kids.push(c.c)
        yield
      }
      // the moon in the well, the rings, the carved question round the front of the side band
      const wr = Rt * WR
      Object.assign(water.style, { left: `${f1(cx - wr)}px`, top: `${f1(cy - wr * TILT)}px`, width: `${f1(wr * 2)}px`, height: `${f1(wr * TILT * 2)}px` })
      rings.setAttribute('viewBox', `${f1(-wr)} ${f1(-wr * TILT)} ${f1(wr * 2)} ${f1(wr * TILT * 2)}`)
      rings.replaceChildren(...[0, 1, 2, 3].map((i) => s('ellipse', { cx: 0, cy: 0, rx: f1(wr * 0.9), ry: f1(wr * 0.9 * TILT), style: `animation-delay:${-i * 1.6}s` })))
      const id = nextId('t23c-arc')
      const fs = clamp(Rt * 0.06, 14, 17)
      carve.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
      const by = cy + lip * 0.5 + fs * 0.36
      const a0 = 0.12, a1 = Math.PI - 0.12
      const arcLen = (() => {
        let L = 0
        for (let i = 1; i <= 40; i++) {
          const t0 = a0 + ((a1 - a0) * (i - 1)) / 40, t1 = a0 + ((a1 - a0) * i) / 40
          L += Math.hypot(rx * (Math.cos(t1) - Math.cos(t0)), ry * (Math.sin(t1) - Math.sin(t0)))
        }
        return L
      })()
      const need = K.question.length * fs * 0.52
      let qBottom = cy + ry + lip + legH
      if (need <= arcLen * 0.96) {
        carve.replaceChildren(
          s('defs', null, s('path', { id, d: `M${f1(cx + Math.cos(a1) * rx)} ${f1(by + Math.sin(a1) * ry)}A${f1(rx)} ${f1(ry)} 0 0 0 ${f1(cx + Math.cos(a0) * rx)} ${f1(by + Math.sin(a0) * ry)}` })),
          s('text', { 'font-size': f1(fs), 'text-anchor': 'middle' }, s('textPath', { href: `#${id}`, startOffset: '50%' }, K.question)))
      } else {
        // too long for the band on a narrow screen: carved in two lines into the table in front of the tray
        const words = K.question.split(' ')
        let a = '', b = ''
        for (const w of words) (a.length + w.length < K.question.length / 2 + 2 ? (a += (a ? ' ' : '') + w) : (b += (b ? ' ' : '') + w))
        const ty = cy + ry + lip + legH + fs * 1.4
        carve.replaceChildren(s('text', { 'font-size': f1(fs), 'text-anchor': 'middle', class: 'flat' }, s('tspan', { x: f1(cx), y: f1(ty) }, a), s('tspan', { x: f1(cx), y: f1(ty + fs * 1.3) }, b)))
        qBottom = ty + fs * 1.3 + fs * 0.4
      }
      // the paper strip: unrolled across the table in front of the tray (the component's reading card, restyled)
      if (root) {
        const sw = wide ? Math.min(W * 0.62, 780) : W - 8
        root.style.setProperty('--sx', `${f1(cx - sw / 2)}px`)
        root.style.setProperty('--sy', `${f1(qBottom + (wide ? 12 : 10))}px`)
        root.style.setProperty('--sw', `${f1(sw)}px`)
        root.style.setProperty('--sh', `${f1(Math.max(80, H - qBottom - (wide ? 16 : 12)))}px`)
      }
      // the inlay dots on the turning top, so the turn shows even between stones
      top.replaceChildren(...dots)
      // the four stones: lit and shaded versions (crossfaded as they turn to the moon), a contact shadow
      const tone: [RGB, RGB, RGB, RGB] = p.dark ? [p.hi, p.mid, p.lo, p.umbra] : [mix(p.hi, p.mid, 0.3), mix(p.mid, p.lo, 0.2), p.lo, mix(p.umbra, p.lo, 0.25)]
      const mt: [RGB, RGB, RGB] = p.dark ? [p.mossC, p.mossA, p.mossB] : [mix(p.mossC, p.paper, 0.15), p.mossA, p.mossB]
      const els: typeof stones = []
      const sdpr = Math.min(2, devicePixelRatio || 1)
      for (let k = 0; k < n; k++) {
        const [sw, sh, flat, moss, seal, sq] = SHAPES[k]
        const w = Rt * sw, hh = Rt * sh
        const bs = { w, h: hh, seed: 2440 + k, tone, mossTone: mt, moss, flat, sq, wob: 0.11, bump: 0.03, up: 'y' as const, inkA: 0.55, amb: 0.14, dry: 0.15, height: 0.9 }
        const back = yield* stone({ ...bs, light: [-0.3, -0.5, 0.45], rim: p.dark ? p.moon : p.wash, rimA: 0.25 }, sdpr)
        const lit = yield* stone({ ...bs, light: [0.62, -0.5, 0.6], rim: p.dark ? p.moon : mix(p.card, p.moon, 0.5), rimA: p.dark ? 0.85 : 0.7, amb: 0.2 }, sdpr)
        for (const cv of [back, lit]) {
          cv.style.cssText = `width:${f1(w)}px;height:${f1(hh)}px;left:${f1(-w / 2)}px;top:${f1(-hh * 0.92)}px`
          if (seal) sealMark(cv, w, hh, p)
        }
        const shadow = h('i', { class: 't23c-sh', style: `width:${f1(w * 1.3)}px;height:${f1(hh * 0.22 + Rt * 0.03)}px;left:${f1(-w * 0.82)}px;top:${f1(-Rt * 0.02)}px` })
        const litEl = h('div', { class: 't23c-lit' }, lit)
        const el = h('div', { class: 't23c-stone' }, shadow, back, litEl)
        els.push({ el, lit: litEl, sh: shadow, w, h: hh })
        yield
      }
      stones.splice(0, stones.length, ...els)
      kids.push(water, top, ...els.map((e) => e.el))
      water.replaceChildren(reflect, rings)
      art.replaceChildren(...kids, carve as unknown as HTMLElement)
      void first
      draw()
    }

    const stage = (el: HTMLElement, a: { pick(k: number): void; onLayout(fn: (g: PondGeo, feet: { x: number; y: number; s: number }[]) => void): void }) => {
      host = el
      api = a
      root = el.closest('.p2c')
      root?.classList.add('t23c', 'rip')
      el.append(art)
      let first = true
      // the stage fills the whole scene here (CSS): measure it once per layout
      const size = () => [el.clientWidth, el.clientHeight] as const
      a.onLayout(() => {
        const [W, H] = size()
        if (W < 40 || H < 40) return
        job?.cancel()
        job = sliced(bake(W, H, first), { sync: ctx.reduced || !first })
        first = false
      })
      const offPrefs = onPrefs(() => {
        const p = readPal()
        if (p.key === pal.key || !geo) return
        pal = p
        job?.cancel()
        job = sliced(bake(geo.w, geo.h, false), { sync: true })
      })
      // drag round the centre to turn the tray; release: the nearest stone settles at six o'clock and speaks
      const stageEl = el.parentElement!
      let drag: { id: number; a: number; moved: number; rect: DOMRect } | null = null
      const angleAt = (e: PointerEvent, r: DOMRect) => (geo ? Math.atan2((e.clientY - r.top - geo.cy) / TILT, e.clientX - r.left - geo.cx) : 0)
      const onDown = (e: PointerEvent) => {
        if (!geo) return
        const r = stageEl.getBoundingClientRect()
        drag = { id: e.pointerId, a: angleAt(e, r), moved: 0, rect: r }
      }
      const onMove = (e: PointerEvent) => {
        if (!drag || e.pointerId !== drag.id) return
        const a = angleAt(e, drag.rect)
        let d = a - drag.a
        d = Math.atan2(Math.sin(d), Math.cos(d))
        drag.a = a
        drag.moved += Math.abs(d)
        if (drag.moved < 0.05) return
        if (!stageEl.hasPointerCapture(e.pointerId)) stageEl.setPointerCapture(e.pointerId)
        phiT += d
        phi = phiT
        draw()
      }
      const onUp = (e: PointerEvent) => {
        if (!drag || e.pointerId !== drag.id) return
        const moved = drag.moved
        drag = null
        if (moved < 0.05) return
        const k = nearest()
        turnTo(k)
        front = k
        api?.pick(k)
      }
      const onClick = (e: MouseEvent) => {
        // a drag that ends on a stone is not a touch of it
        if (dragEnded > performance.now() - 60) e.stopPropagation()
      }
      let dragEnded = 0
      stageEl.addEventListener('pointerdown', onDown)
      stageEl.addEventListener('pointermove', onMove)
      stageEl.addEventListener('pointerup', (e) => (drag && drag.moved >= 0.05 && (dragEnded = performance.now()), onUp(e)))
      stageEl.addEventListener('pointercancel', onUp)
      stageEl.addEventListener('click', onClick, true)
      return () => {
        job?.cancel()
        offPrefs()
      }
    }

    const def = perspectiveCircle(K.perspectives, {
      label: K.label,
      prompt: K.prompt,
      detail: K.insight,
      stage,
      // every stone's button sits at one point; the turn moves it onto its stone by transform
      place: (_k, _n, g) => {
        base.x = g.w / 2
        base.y = g.h / 2
        return { x: base.x, y: base.y, s: 1 }
      },
      onHear: (k) => {
        if (k !== front) turnTo(k)
        front = k
        root?.style.setProperty('--lean', '1')
        // the water stirs again for a while (the rings are living motion: they run two rounds, then rest)
        if (root && !root.classList.contains('is-all')) {
          root.classList.remove('rip')
          void root.offsetWidth
          root.classList.add('rip')
        }
      },
    })
    const off = def.mount(ctx)
    ctx.art.querySelector('.p2c')?.prepend(h('p', { class: 'visually-hidden' }, K.art), h('p', { class: 'visually-hidden' }, K.question))
    return off
  },
}

/** A vermilion seal pressed into the stone's face: a square stamp with a character cut in it, worn in specks. */
function sealMark(cv: HTMLCanvasElement, w: number, hh: number, p: Pal) {
  const d = cv.width / w
  const sz = Math.min(w, hh) * 0.3
  const t = canvas(sz * 1.1, sz * 1.1, d)
  const sg = t.g
  const r = rng(2450)
  sg.fillStyle = rgba(p.red, 0.9)
  sg.beginPath()
  sg.moveTo(0, 0)
  sg.lineTo(sz, sz * 0.04)
  sg.lineTo(sz * 0.97, sz)
  sg.lineTo(sz * 0.02, sz * 0.96)
  sg.closePath()
  sg.fill()
  sg.strokeStyle = rgba(mix(p.red, p.umbra, 0.65), 0.9)
  sg.lineWidth = Math.max(1, sz * 0.07)
  sg.lineCap = 'square'
  sg.beginPath()
  sg.moveTo(sz * 0.5, sz * 0.18)
  sg.lineTo(sz * 0.5, sz * 0.82)
  sg.moveTo(sz * 0.2, sz * 0.42)
  sg.lineTo(sz * 0.8, sz * 0.42)
  sg.moveTo(sz * 0.25, sz * 0.7)
  sg.lineTo(sz * 0.75, sz * 0.68)
  sg.stroke()
  // the stamp is worn: the stone shows through in specks
  sg.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < 18; i++) {
    sg.fillStyle = `rgba(0,0,0,${(0.3 + r() * 0.5).toFixed(2)})`
    sg.beginPath()
    sg.arc(r() * sz, r() * sz, sz * (0.02 + r() * 0.05), 0, TAU)
    sg.fill()
  }
  cv.getContext('2d')!.drawImage(t.c, w * 0.5 * d, hh * 0.3 * d, sz * 1.1 * d, sz * 1.1 * d)
}
