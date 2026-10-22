import { h, nextId, s } from '../../core/dom'
import { onPrefs } from '../../core/prefs'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import type { SceneCtx, SceneDef } from '../types'
import { perspectiveCircle, type PondGeo } from '../../ui/part2/perspectives'
import '../../ui/part2/guide.css'
import { rng } from '../../ui/part2/ink'
import { C } from './data'
import { canvas, clamp, f1, fbm, field, lerp, mix, put, readPal, rgba, sm, softEllipse, vn, type Pal, type Pt, type RGB } from './lit'

const K = C.scenes.circle
const TAU = Math.PI * 2
/** the four stones: w, h (shares of the tray radius), flat, moss, seal, squareness, tone (0 granite, 1 dark, 2 pale) */
const SHAPES: [number, number, number, number, boolean, number, number][] = [
  [0.19, 0.36, 0.22, 0.06, false, 3.2, 0], // tall, upright granite
  [0.38, 0.16, 0.4, 0.14, false, 3.4, 1], // long, lying, dark
  [0.27, 0.2, 0.62, 1, false, 2.1, 1], // a cushion of moss
  [0.24, 0.23, 0.22, 0.08, true, 3.8, 2], // pale, a seal cut into it
]
/** the stones stand on the turning top, between the water (WR) and the fixed rim (0.87) */
const RING = 0.78, WR = 0.42, TILT = 0.38
/** the high moon stands behind the tray: light from above, a little from the right and in front */
const LIGHT: [number, number, number] = (() => {
  const v = [0.35, 0.85, 0.3] // stone space: x right, y up, z toward us
  const l = Math.hypot(v[0], v[1], v[2])
  return [v[0] / l, v[1] / l, v[2] / l] as [number, number, number]
})()

/**
 * Scene 4 — 3Q 25°, a still life under the high moon: a round black lacquer tray on curved legs on a wooden table, low in
 * the frame so the moon above and its reflection in the tray's water make one vertical axis. On its turning top, four
 * stones of four kinds; the question is carved round its side. Drag round the centre (or along the faint arrow on its
 * rim) to turn it; the stone that stops at six o'clock speaks: its words lie on a thin strip of washi across the water,
 * the moon in the water leans toward it, and a small pool of light opens on the tray round its foot. Each unheard stone
 * carries a vermilion dot. All four heard: the rings still, the moon round, and the lit pools cover only a little of the
 * tray — what looking inside has shown so far.
 */
export const circleScene: SceneDef = {
  label: K.label,
  text: 'tl',
  mount(ctx: SceneCtx) {
    let api: { pick(k: number): void } | null = null
    let phi = 0 // tray turn
    let phiT = 0
    let front = -1
    const n = K.perspectives.stones.length
    const still = ctx.quality === 'low' || ctx.reduced
    let geo: { cx: number; cy: number; rx: number; ry: number; Rt: number; w: number; h: number; wide: boolean } | null = null
    /** where a stone stands when it speaks: front left on a wide frame (beside the strip of words), front on a phone */
    let SPEAK = Math.PI / 2
    // where the component put each stone's button (all at one point): the turn moves them from there by transform
    const base = { x: 0, y: 0 }
    let host: HTMLElement | null = null
    let root: HTMLElement | null = null
    const stones: { el: HTMLElement; lit: HTMLElement; w: number; h: number }[] = []
    const pools = Array.from({ length: n }, () => h('i', { class: 't23c-pool' }))
    const dots = Array.from({ length: 12 }, () => h('i', { class: 't23c-dot' }))
    const heard = new Set<number>()
    let pal = readPal()

    // ── the turn: angle of stone k on the top, its place, size, light; the buttons, the pools of light follow
    const angle = (k: number) => phi + SPEAK + (k * TAU) / n
    function draw() {
      if (!geo || !root) return
      const { cx, cy, rx, ry, Rt } = geo
      const btns = root.querySelectorAll<HTMLElement>('.p2c-stone')
      for (let k = 0; k < n; k++) {
        const a = angle(k)
        const x = cx + Math.cos(a) * rx * RING, y = cy + Math.sin(a) * ry * RING
        const sc = 1 + Math.sin(a) * 0.14
        const st = stones[k]
        if (!st) continue
        st.el.style.transform = `translate(${f1(x)}px,${f1(y)}px) scale(${sc.toFixed(3)})`
        st.el.style.zIndex = String(Math.round(y))
        // a stone turned toward the moon side (the back right) catches more of it
        st.lit.style.opacity = (0.45 + 0.55 * sm(-0.6, 1, -Math.sin(a) * 0.6 + Math.cos(a) * 0.5)).toFixed(3)
        const b = btns[k]
        if (b) {
          b.style.transform = `translate(${f1(x - base.x)}px,${f1(y - st.h * sc * 0.45 - base.y)}px) scale(${sc.toFixed(3)})`
          b.style.zIndex = String(Math.round(y) + 1000)
        }
        const pr = Rt * 0.2 * sc
        pools[k].style.transform = `translate(${f1(x - pr)}px,${f1(y - pr * TILT)}px)`
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
        const d = Math.abs(Math.atan2(Math.sin(angle(k) - SPEAK), Math.cos(angle(k) - SPEAK)))
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
    // the hidden gesture made visible: a faint curved ink arrow along the front of the rim (gone after the first turn)
    const arrow = s('svg', { class: 't23c-arrow', 'aria-hidden': 'true' })
    // the washi still rolled up on the table where its words will lie, until the first stone speaks
    const roll = h('i', { class: 't23c-roll', 'aria-hidden': 'true' }, h('i'))
    function* bake(W: number, H: number, first: boolean): Generator<unknown, void> {
      if (!host) return
      const p = pal
      const wide = W / H > 1.05
      // low in the frame: the moon above, its reflection in the tray's water below it, one vertical axis
      const Rt = wide ? Math.min(W * 0.21, H * 0.5) : Math.min(W * 0.46, H * 0.35)
      const rx = Rt, ry = Rt * TILT
      const lip = Math.max(Rt * 0.09, 18) // the side of the tray seen under its top (the question is carved on it)
      const legH = Rt * 0.11
      const cx = wide ? W * 0.6 : W / 2, cy = wide ? H * 0.7 : H * 0.42
      SPEAK = wide ? Math.PI * 0.72 : Math.PI / 2
      geo = { cx, cy, rx, ry, Rt, w: W, h: H, wide }
      const kids: HTMLElement[] = []
      const lacq: RGB = p.dark ? mix(p.umbra, p.lo, 0.22) : mix(p.wash, p.umbra, 0.35)
      const shine: RGB = p.dark ? p.moon : mix(p.card, p.moon, 0.5)
      const red: RGB = p.dark ? mix(p.red, p.umbra, 0.25) : mix(p.red, p.umbra, 0.15)
      const ty = Math.max(H * (wide ? 0.43 : 0.26), cy - ry * 2.6) // the far edge of the table
      const mx = cx, my = Math.max(Rt * 0.1, H * (wide ? 0.1 : 0.08)), mr = Math.max(9, Rt * 0.045)
      // the night beyond and the table under the tray
      {
        const c = canvas(W, H, Math.min(2, devicePixelRatio || 1) * (ctx.quality === 'low' ? 0.75 : 1))
        const gg = c.g
        const sky = gg.createLinearGradient(0, 0, 0, ty)
        sky.addColorStop(0, rgba(p.paper, 0))
        sky.addColorStop(1, rgba(p.dark ? mix(p.paper, p.mist, 0.14) : p.card, 0.85))
        gg.fillStyle = sky
        gg.fillRect(0, 0, W, ty)
        const mg = gg.createRadialGradient(mx, my, 0, mx, my, mr * 8)
        mg.addColorStop(0, rgba(p.moon, p.dark ? 0.42 : 0.6))
        mg.addColorStop(0.35, rgba(p.moon, p.dark ? 0.1 : 0.18))
        mg.addColorStop(1, rgba(p.moon, 0))
        gg.fillStyle = mg
        gg.fillRect(mx - mr * 8, my - mr * 8, mr * 16, mr * 16)
        gg.fillStyle = rgba(p.moon)
        gg.beginPath()
        gg.arc(mx, my, mr, 0, TAU)
        gg.fill()
        // two far ridges in the mist, melting at both ends, and a breath of mist on the table's far edge
        for (const [k, amp, col, a] of [[3, 0.3, p.dark ? mix(p.wash, p.mist, 0.16) : mix(p.wash, p.paper, 0.82), 0.85], [7, 0.18, p.dark ? mix(p.wash, p.mist, 0.08) : mix(p.wash, p.paper, 0.7), 0.9]] as [number, number, RGB, number][]) {
          const rg = gg.createLinearGradient(0, 0, W, 0)
          rg.addColorStop(0, rgba(col, 0))
          rg.addColorStop(0.2, rgba(col, a))
          rg.addColorStop(0.8, rgba(col, a))
          rg.addColorStop(1, rgba(col, 0))
          gg.fillStyle = rg
          gg.beginPath()
          gg.moveTo(0, ty)
          for (let x = 0; x <= W; x += 6) gg.lineTo(x, ty - ty * amp * (0.3 + 0.7 * fbm(x * 0.005 + k, k, 3)) * (0.45 + 0.55 * Math.abs(Math.sin((x / W) * 3.1 + k))))
          gg.lineTo(W, ty)
          gg.fill()
        }
        // beyond the table the pond: dark water holding the moon's road on the same axis, its far bank low with reeds
        {
          const w0 = ty - H * (wide ? 0.11 : 0.09)
          const wg = gg.createLinearGradient(0, w0, 0, ty)
          wg.addColorStop(0, rgba(p.dark ? mix(p.paper, p.mist, 0.22) : mix(p.water, p.card, 0.5)))
          wg.addColorStop(1, rgba(p.dark ? mix(p.paper, p.umbra, 0.3) : mix(p.water, p.wash, 0.15)))
          gg.fillStyle = wg
          gg.fillRect(0, w0, W, ty - w0 + 2)
          const r = rng(2462)
          gg.lineCap = 'round'
          for (let i = 0; i < 60; i++) {
            const t = r()
            const y = w0 + 2 + t * (ty - w0 - 2)
            const x = mx + (r() - 0.5) * W * (0.02 + t * 0.08)
            const len = W * (0.004 + t * 0.02) * (0.5 + r())
            gg.strokeStyle = rgba(p.dark ? p.moon : p.card, (p.dark ? 0.75 : 0.9) * (0.4 + r() * 0.6))
            gg.lineWidth = 0.8 + t * 1.6
            gg.beginPath()
            gg.moveTo(x - len / 2, y)
            gg.lineTo(x + len / 2, y)
            gg.stroke()
          }
          // the far bank: a low dark shore, reeds in clumps, mist lying on the water
          const bank = p.dark ? mix(p.wash, p.mossB, 0.3) : mix(p.wash, p.paper, 0.55)
          gg.fillStyle = rgba(bank, 0.95)
          gg.beginPath()
          gg.moveTo(0, w0 + 3)
          for (let x = 0; x <= W; x += 8) gg.lineTo(x, w0 - H * 0.012 * (0.4 + 0.6 * fbm(x * 0.01, 5, 3)))
          gg.lineTo(W, w0 + 3)
          gg.fill()
          gg.strokeStyle = rgba(bank, 0.9)
          for (let i = 0; i < (wide ? 26 : 12); i++) {
            const x0 = r() * W
            if (Math.abs(x0 - mx) < W * 0.07) continue // the moon's road stays open
            const nn = 4 + Math.floor(r() * 6), hh2 = H * (0.03 + r() * 0.04)
            for (let j = 0; j < nn; j++) {
              const x = x0 + (j - nn / 2) * 3
              gg.lineWidth = 1 + r()
              gg.beginPath()
              gg.moveTo(x, w0 + 1)
              gg.quadraticCurveTo(x + (r() - 0.3) * 6, w0 - hh2 * 0.5, x + (r() - 0.3) * 10, w0 - hh2 * (0.7 + r() * 0.3))
              gg.stroke()
            }
          }
          softEllipse(gg, mx, w0 + 3, W * 0.5, H * 0.012, p.mist, p.dark ? 0.16 : 0.5)
        }
        // the table: planks running across, narrower with distance, each its own tone; long wavy grain, a knot or
        // two, dark gaps with a lit lip; the moon's long sheen down the middle toward us
        const th = H - ty
        const nPl = wide ? 8 : 7
        const edges: number[] = []
        for (let i = 0; i <= nPl; i++) {
          const z = 1 / lerp(1, 1 / 4.2, 1 - i / nPl)
          edges.push(ty + th * ((1 / z - 1 / 4.2) / (1 - 1 / 4.2)))
        }
        const plankAt = (y: number) => {
          let i = 0
          while (i < nPl - 1 && y > edges[i + 1]) i++
          return i
        }
        const wood: RGB = p.dark ? mix(p.lo, p.lantern, 0.06) : mix(mix(p.stepLo, p.lo, 0.3), p.lantern, 0.14)
        const woodHi: RGB = p.dark ? mix(p.mid, p.lantern, 0.08) : mix(mix(p.stepMid, p.stepLo, 0.3), p.lantern, 0.14)
        const woodLo: RGB = p.dark ? mix(p.umbra, p.lo, 0.45) : mix(p.lo, p.umbra, 0.2)
        const tex = yield* field(W, th, 2, (x, y, o) => {
          const wy = ty + y
          const i = plankAt(wy)
          const y0 = edges[i], y1 = edges[i + 1]
          const v = (wy - y0) / Math.max(1, y1 - y0) // across the plank
          const u = (x - cx) / (W * 0.5)
          const depth = (wy - ty) / th
          const sx = (x - cx) * (0.55 + depth * 0.45) + cx // the grain converges a little toward the far edge
          // grain: long fibres along the plank, rings waving round knots
          const kx = fbm(sx * 0.0025 + i * 13, i * 3.1, 3)
          const ring = Math.sin((v * (5 + (i % 3)) + (kx - 0.5) * 3.2) * Math.PI)
          const fibre = vn(sx * 0.008 + i * 31, v * 34 + i)
          const tone = (vn(i * 5.3, 1.7) - 0.5) * 0.35
          let c = mix(wood, tone > 0 ? woodHi : woodLo, Math.abs(tone))
          c = mix(c, woodLo, sm(0.7, 0.97, ring) * 0.38)
          c = mix(c, woodHi, sm(0.6, 0.88, fibre) * 0.22)
          const gapW = 0.04 + 0.04 * (1 - depth)
          c = mix(c, p.umbra, (1 - sm(0, gapW, v)) * 0.85)
          c = mix(c, woodHi, sm(gapW, gapW + 0.03, v) * (1 - sm(gapW + 0.03, gapW + 0.09, v)) * 0.6)
          const sheen = Math.exp(-Math.pow(u * (2.6 - depth * 1.2), 2)) * (0.4 + depth * 0.6)
          c = mix(c, shine, sheen * (p.dark ? 0.12 : 0.22))
          o[0] = c[0]; o[1] = c[1]; o[2] = c[2]
          o[3] = (1 - sm(0.72, 1.05, Math.abs(u))) * sm(0, 0.025, depth)
        })
        put(gg, tex, 0, ty, W, th)
        yield
        const eg = gg.createLinearGradient(W * 0.12, 0, W * 0.88, 0)
        eg.addColorStop(0, rgba(shine, 0))
        eg.addColorStop(0.5, rgba(shine, p.dark ? 0.35 : 0.7))
        eg.addColorStop(1, rgba(shine, 0))
        gg.strokeStyle = eg
        gg.lineWidth = 1.2
        gg.beginPath()
        gg.moveTo(W * 0.12, ty + 0.5)
        gg.lineTo(W * 0.88, ty + 0.5)
        gg.stroke()
        // the tray's shadow on the table: the moon is high behind it, so the shadow falls toward us, short and soft
        softEllipse(gg, cx + Rt * 0.04, cy + lip + legH + ry * 0.35, rx * 1.12, ry * 0.95, p.umbra, p.dark ? 0.85 : 0.5)
        softEllipse(gg, cx, cy + lip + legH * 0.85, rx * 0.95, ry * 0.75, p.umbra, p.dark ? 0.7 : 0.35)
        // the legs: curved "cat's feet" under the side band, flaring at the foot, lit on top by the moon
        for (const a of [0.35, 1.15, 1.99, 2.79]) {
          const lx = cx + Math.cos(a) * rx * 0.78, ly = cy + Math.sin(a) * ry * 0.78 + lip
          const sd = Math.cos(a) > 0 ? 1 : -1
          const lw = Rt * 0.07
          softEllipse(gg, lx, ly + legH + 2, lw * 1.3, lw * 0.32, p.umbra, p.dark ? 0.9 : 0.5)
          gg.fillStyle = rgba(lacq)
          gg.beginPath()
          gg.moveTo(lx - lw * 0.55, ly - 2)
          gg.lineTo(lx + lw * 0.55, ly - 2)
          gg.quadraticCurveTo(lx + lw * 0.3, ly + legH * 0.6, lx + lw * (0.45 + sd * 0.35), ly + legH)
          gg.lineTo(lx - lw * (0.45 - sd * 0.35), ly + legH)
          gg.quadraticCurveTo(lx - lw * 0.3, ly + legH * 0.6, lx - lw * 0.55, ly - 2)
          gg.fill()
          gg.strokeStyle = rgba(shine, p.dark ? 0.45 : 0.6)
          gg.lineWidth = Math.max(1, lw * 0.09)
          gg.beginPath()
          gg.moveTo(lx + lw * 0.42 * sd, ly)
          gg.quadraticCurveTo(lx + lw * 0.22 * sd, ly + legH * 0.6, lx + lw * (0.4 * sd + 0.35 * sd), ly + legH - 1)
          gg.stroke()
          gg.strokeStyle = rgba(red, 0.75) // worn through to the red at the foot
          gg.lineWidth = Math.max(1, lw * 0.12)
          gg.beginPath()
          gg.moveTo(lx - lw * (0.4 - sd * 0.35), ly + legH - 0.5)
          gg.lineTo(lx + lw * (0.4 + sd * 0.35), ly + legH - 0.5)
          gg.stroke()
        }
        // the side band: black lacquer; the moon from above catches its upper lip; the worn red at its lips
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
        sideG.addColorStop(0, rgba(p.umbra, 0.5))
        sideG.addColorStop(0.45, rgba(shine, 0))
        sideG.addColorStop(0.55, rgba(shine, p.dark ? 0.16 : 0.2))
        sideG.addColorStop(0.68, rgba(shine, 0))
        sideG.addColorStop(1, rgba(p.umbra, 0.4))
        gg.fillStyle = sideG
        gg.fillRect(cx - rx, cy - ry, rx * 2, ry * 2 + lip * 2)
        const vg = gg.createLinearGradient(0, cy, 0, cy + ry + lip)
        vg.addColorStop(0, rgba(p.umbra, 0))
        vg.addColorStop(1, rgba(p.umbra, 0.45))
        gg.fillStyle = vg
        gg.fillRect(cx - rx, cy, rx * 2, ry + lip)
        gg.restore()
        const worn = (y0: number, from: number, to: number, a: number, wdt: number) => {
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
        worn(cy + lip - 1, 0.05, Math.PI - 0.05, 0.5, Math.max(1, Rt * 0.006))
        // the top: lacquer with the moon's specular band along the far rim (it stands behind), the worn red rim edge
        const topG = gg.createLinearGradient(0, cy - ry, 0, cy + ry)
        topG.addColorStop(0, rgba(mix(lacq, p.mid, p.dark ? 0.25 : 0.2)))
        topG.addColorStop(1, rgba(lacq))
        gg.fillStyle = topG
        gg.beginPath()
        gg.ellipse(cx, cy, rx, ry, 0, 0, TAU)
        gg.fill()
        gg.save()
        gg.beginPath()
        gg.ellipse(cx, cy, rx, ry, 0, 0, TAU)
        gg.clip()
        for (const [a0, a1, wq, al] of [[-0.74, -0.26, 0.025, 0.4], [-0.84, -0.16, 0.08, 0.08]] as [number, number, number, number][]) {
          gg.strokeStyle = rgba(shine, (p.dark ? 0.8 : 1) * al)
          gg.lineWidth = Math.max(1.5, Rt * wq * 0.5)
          gg.lineCap = 'round'
          gg.beginPath()
          gg.ellipse(cx, cy, rx * 0.935, ry * 0.92, 0, Math.PI * a0, Math.PI * a1)
          gg.stroke()
        }
        const tg = gg.createRadialGradient(cx, cy - ry * 0.6, 0, cx, cy - ry * 0.6, rx * 0.6)
        tg.addColorStop(0, rgba(shine, p.dark ? 0.14 : 0.18))
        tg.addColorStop(1, rgba(shine, 0))
        gg.fillStyle = tg
        gg.fillRect(cx - rx, cy - ry, rx * 2, ry * 2)
        gg.restore()
        worn(cy, Math.PI * 0.02, Math.PI * 0.98, 0.55, Math.max(1, Rt * 0.007))
        worn(cy, Math.PI * 1.05, Math.PI * 1.95, 0.35, Math.max(1, Rt * 0.006))
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
        // the well of water in the middle: its lacquer lip, the water deepening toward us
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
        gg.strokeStyle = rgba(p.umbra, 0.6)
        gg.lineWidth = Math.max(1.5, Rt * 0.014)
        gg.beginPath()
        gg.ellipse(cx, cy - 1, wr, wr * TILT, 0, Math.PI * 1.02, Math.PI * 1.98)
        gg.stroke()
        // the table melts into the paper at the frame's sides
        const fade = (x0: number, x1: number) => {
          gg.save()
          gg.globalCompositeOperation = 'destination-out'
          const lg = gg.createLinearGradient(x0, 0, x1, 0)
          lg.addColorStop(0, '#000')
          lg.addColorStop(1, '#0000')
          gg.fillStyle = lg
          gg.fillRect(Math.min(x0, x1), 0, Math.abs(x1 - x0), H)
          gg.restore()
        }
        fade(0, W * 0.06)
        fade(W, W * 0.94)
        kids.push(c.c)
        yield
      }
      // the moon in the well, the rings, the carved question round the front of the side band
      const wr = Rt * WR
      Object.assign(water.style, { left: `${f1(cx - wr)}px`, top: `${f1(cy - wr * TILT)}px`, width: `${f1(wr * 2)}px`, height: `${f1(wr * TILT * 2)}px` })
      rings.setAttribute('viewBox', `${f1(-wr)} ${f1(-wr * TILT)} ${f1(wr * 2)} ${f1(wr * TILT * 2)}`)
      rings.replaceChildren(...[0, 1, 2, 3].map((i) => s('ellipse', { cx: 0, cy: 0, rx: f1(wr * 0.9), ry: f1(wr * 0.9 * TILT), style: `animation-delay:${-i * 1.6}s` })))
      const id = nextId('t23c-arc')
      const fs = clamp(Rt * 0.055, 14, 17)
      carve.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
      arrow.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
      const by = cy + lip * 0.5 + fs * 0.36
      const a0 = 0.12, a1 = Math.PI - 0.12
      let arcLen = 0
      for (let i = 1; i <= 40; i++) {
        const t0 = a0 + ((a1 - a0) * (i - 1)) / 40, t1 = a0 + ((a1 - a0) * i) / 40
        arcLen += Math.hypot(rx * (Math.cos(t1) - Math.cos(t0)), ry * (Math.sin(t1) - Math.sin(t0)))
      }
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
        const qy = cy + ry + lip + legH + fs * 1.3
        carve.replaceChildren(s('text', { 'font-size': f1(fs), 'text-anchor': 'middle', class: 'flat' }, s('tspan', { x: f1(cx), y: f1(qy) }, a), s('tspan', { x: f1(cx), y: f1(qy + fs * 1.3) }, b)))
        qBottom = qy + fs * 1.3 + fs * 0.4
      }
      // the faint ink arrow: an elliptic arc just outside the front of the rim, a head at its end (the way to turn)
      {
        const ax = rx * 1.06, ay = ry * 1.12 + lip * 0.2
        const t0 = Math.PI * (wide ? 0.08 : 0.66), t1 = Math.PI * (wide ? 0.4 : 0.98)
        const pt = (t: number) => [cx + Math.cos(t) * ax, cy + lip * 0.5 + Math.sin(t) * ay]
        let d = ''
        for (let i = 0; i <= 24; i++) {
          const [x, y] = pt(t0 + ((t1 - t0) * i) / 24)
          d += `${i ? 'L' : 'M'}${f1(x)} ${f1(y)}`
        }
        const [ex, ey] = pt(t1), [px, py] = pt(t1 - 0.04)
        const ang = Math.atan2(ey - py, ex - px)
        const hd = (o: number) => `L${f1(ex + Math.cos(ang + Math.PI + o) * 9)} ${f1(ey + Math.sin(ang + Math.PI + o) * 9)}`
        const [sx2, sy2] = pt(t0)
        arrow.replaceChildren(s('path', { class: 'ink', d }), s('path', { class: 'ink head', d: `M${f1(ex)} ${f1(ey)}${hd(0.5)}M${f1(ex)} ${f1(ey)}${hd(-0.5)}` }), s('path', { class: 'ink', d: `M${f1(sx2)} ${f1(sy2)}m0 0` }))
      }
      // the washi strip, unrolled on the table: in front of the tray to its left, beside the stone that speaks (wide);
      // under the tray and its carved question on a phone. The count of stones heard sits just above it.
      if (root) {
        const sw = wide ? Math.min(W * 0.31, cx - rx - W * 0.05) : W - 16
        const sx = wide ? W * 0.035 : 8
        const sy = wide ? cy + ry * 0.05 : qBottom + fs * 1.9
        root.style.setProperty('--sx', `${f1(sx)}px`)
        root.style.setProperty('--sy', `${f1(sy)}px`)
        root.style.setProperty('--sw', `${f1(sw)}px`)
        root.style.setProperty('--sh', `${f1(Math.max(80, H - sy - H * 0.04))}px`)
        root.classList.toggle('wide', wide)
        const count = root.querySelector<HTMLElement>('.p2c-count-out')
        if (count) Object.assign(count.style, { left: `${f1(sx + sw / 2)}px`, top: `${f1(sy - fs * 1.75)}px` })
        const rw = Math.min(sw * 0.62, Rt * 1.0), rh = Math.max(18, Rt * 0.07)
        Object.assign(roll.style, { left: `${f1(sx + sw * 0.5 - rw / 2)}px`, top: `${f1(sy + fs * 0.6)}px`, width: `${f1(rw)}px`, height: `${f1(rh)}px`, fontSize: `${f1(rh)}px` })
        if (!roll.isConnected) root.append(roll)
      }
      // the inlay dots on the turning top, so the turn shows even between stones; the pools of light under the heard
      top.replaceChildren(...pools, ...dots)
      pools.forEach((el) => Object.assign(el.style, { width: `${f1(Rt * 0.4)}px`, height: `${f1(Rt * 0.4 * TILT)}px` }))
      // the four stones: lit and shaded versions (crossfaded as they turn), a contact shadow and a short cast one
      const tones: [RGB, RGB, RGB, RGB][] = p.dark
        ? [[p.hi, p.mid, p.lo, p.umbra], [mix(p.mid, p.hi, 0.2), mix(p.lo, p.mid, 0.3), mix(p.lo, p.umbra, 0.4), p.umbra], [mix(p.hi, p.moon, 0.18), mix(p.mid, p.hi, 0.4), p.lo, p.umbra]]
        : [[mix(p.hi, p.mid, 0.3), mix(p.mid, p.lo, 0.2), p.lo, mix(p.umbra, p.lo, 0.25)], [mix(p.mid, p.lo, 0.2), mix(p.lo, p.mid, 0.2), mix(p.lo, p.umbra, 0.35), p.umbra], [p.hi, mix(p.mid, p.hi, 0.5), mix(p.lo, p.mid, 0.4), mix(p.umbra, p.lo, 0.3)]]
      const mt: [RGB, RGB, RGB] = p.dark ? [mix(p.mossC, p.moon, 0.15), p.mossA, p.mossB] : [mix(p.mossC, p.paper, 0.15), p.mossA, p.mossB]
      const els: typeof stones = []
      const sdpr = Math.min(2, devicePixelRatio || 1)
      for (let k = 0; k < n; k++) {
        const [sw, sh, flat, moss, seal, sq, ti] = SHAPES[k]
        const w = Rt * sw, hh = Rt * sh
        const bs = { w, h: hh, seed: 2440 + k, tone: tones[ti], mossTone: mt, moss, flat, sq, wob: 0.16, bump: 0.03, up: 'y' as const, inkA: 0.7, amb: 0.05, dry: 0.4, height: 1.35, grain: ti === 2 ? 0.1 : 0.06 }
        void bs
        // faceted river stones: a foot ring, a bulging middle ring and a top face, each facet lit flat by the moon
        const back = facetStone(p, w, hh, k, tones[ti], moss, mt, [-0.5, 0.75, -0.3], sdpr)
        yield
        const lit = facetStone(p, w, hh, k, tones[ti], moss, mt, LIGHT, sdpr)
        for (const cv of [back, lit]) {
          cv.style.cssText = `width:${f1(w)}px;height:${f1(hh)}px;left:${f1(-w / 2)}px;top:${f1(-hh * 0.94)}px`
          if (seal) sealMark(cv, w, hh, p)
        }
        const contact = h('i', { class: 't23c-sh', style: `width:${f1(w * 1.12)}px;height:${f1(Math.max(5, hh * 0.12))}px;left:${f1(-w * 0.56)}px;top:${f1(-hh * 0.06)}px` })
        const cast = h('i', { class: 't23c-sh cast', style: `width:${f1(w * 1.1)}px;height:${f1(hh * 0.32 + Rt * 0.02)}px;left:${f1(-w * 0.5)}px;top:${f1(-hh * 0.02)}px` })
        const litEl = h('div', { class: 't23c-lit' }, lit)
        // the vermilion dot of a stone not yet heard sits on its crown and turns with it
        const dot = heard.has(k) ? null : h('div', { class: 'p2g-dot t23c-mark', 'aria-hidden': 'true', style: `--dx:1;--dy:0;top:${f1(-hh * 0.8)}px` }, h('i'))
        const el = h('div', { class: 't23c-stone' }, cast, contact, back, litEl, dot)
        els.push({ el, lit: litEl, w, h: hh })
        yield
      }
      stones.splice(0, stones.length, ...els)
      kids.push(water, top, ...els.map((e) => e.el))
      water.replaceChildren(reflect, rings)
      art.replaceChildren(...kids, carve as unknown as HTMLElement, arrow as unknown as HTMLElement)
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
      let dragEnded = 0
      const onUp = (e: PointerEvent) => {
        if (!drag || e.pointerId !== drag.id) return
        const moved = drag.moved
        drag = null
        if (moved < 0.05) return
        dragEnded = performance.now()
        root?.classList.add('turned')
        const k = nearest()
        turnTo(k)
        front = k
        api?.pick(k)
      }
      // a drag that ends on a stone is not a touch of it
      const onClick = (e: MouseEvent) => void (dragEnded > performance.now() - 60 && e.stopPropagation())
      stageEl.addEventListener('pointerdown', onDown)
      stageEl.addEventListener('pointermove', onMove)
      stageEl.addEventListener('pointerup', onUp)
      stageEl.addEventListener('pointercancel', onUp)
      stageEl.addEventListener('click', onClick, true)
      return () => {
        job?.cancel()
        offPrefs()
      }
    }

    const left = () => n - heard.size
    const def = perspectiveCircle(K.perspectives, {
      label: K.label,
      prompt: K.prompt,
      detail: K.insight,
      countOut: true,
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
        heard.add(k)
        root?.classList.add('unrolled')
        stones[k]?.el.querySelector('.t23c-mark')?.classList.add('out')
        pools[k].classList.add('on')
        root?.style.setProperty('--lean', '1')
        if (left() > 0) ctx.prompt(left() === 1 ? K.left1 : K.leftN.replace('{n}', String(left())))
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
    // what "looking inside" means, once, in the sky's corner opposite the insight
    ctx.art.append(h('p', { class: 't23-note t23c-decode' }, K.decode))
    // six seconds of stillness: the tray turns itself 10° toward the next stone not yet heard (if the one in front is
    // that stone, it rocks 10° and back: the tray turns)
    const timers: number[] = []
    ctx.onCleanup(() => timers.forEach(clearTimeout))
    const nudge = () => {
      if (!geo || left() === 0) return
      let best = -1, bd = 9
      for (let k = 0; k < n; k++) {
        if (heard.has(k)) continue
        const d = Math.atan2(Math.sin(SPEAK - angle(k)), Math.cos(SPEAK - angle(k)))
        if (Math.abs(d) > 0.05 && Math.abs(d) < Math.abs(bd)) (bd = d), (best = k)
      }
      const step = (10 * Math.PI) / 180
      if (best >= 0) phiT += Math.sign(bd) * Math.min(Math.abs(bd), step)
      else {
        phiT += step
        timers.push(window.setTimeout(() => ((phiT -= step), still && ((phi = phiT), draw()), loop.start()), 700))
      }
      if (still) phi = phiT
      loop.start()
      if (still) draw()
    }
    ctx.el.addEventListener('p2:idle', nudge)
    ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', nudge))
    return off
  },
}

/** the four stones' builds: [top lift (share of h), top radius, middle radius, middle height, lean of the top] */
const FACETS: [number, number, number, number, number][] = [
  [0.86, 0.42, 0.98, 0.5, 0.1], // tall, upright, leaning a little
  [0.6, 0.66, 1.06, 0.36, -0.06], // long, lying
  [0.64, 0.42, 1.1, 0.4, 0.04], // a cushion, its round top mossy
  [0.72, 0.72, 1.02, 0.42, 0.03], // a block, the seal cut in its front
]
/**
 * A faceted river stone in a w × h canvas, foot at the bottom: three rings (foot, bulging middle, top) joined by flat
 * facets, plus the top face. Each facet takes the moon's light by its own normal (flat, like a cut plane), with a soft
 * grain over all; edges between facets turned to the moon catch a pale line; the outline is broken ink. `L` is the
 * light in stone space (x right, y up, z toward us).
 */
function facetStone(p: Pal, w: number, hh: number, kind: number, tone: [RGB, RGB, RGB, RGB], moss: number, mt: [RGB, RGB, RGB], L: [number, number, number], dpr: number) {
  const c = canvas(w, hh, dpr)
  const g = c.g
  const [lift, rt, rm, mh, lean] = FACETS[kind]
  const r = rng(2440 + kind * 17)
  const n = kind === 0 ? 6 : 7
  const ll = Math.hypot(...L), Lx = L[0] / ll, Ly = L[1] / ll, Lz = L[2] / ll
  const R = w * 0.47, H = hh * lift, tilt = 0.32
  type V = [number, number, number]
  // three rings, each turned half a step from the one below and jittered: the facets come out as uneven triangles
  const ring = (rad: number, y: number, dx: number, off: number, jy: number) => Array.from({ length: n }, (_, i) => {
    const a = ((i + off + (r() - 0.5) * 0.45) / n) * TAU
    const q = rad * (0.82 + r() * 0.32)
    return [Math.cos(a) * R * q + dx, y * (1 - jy / 2 + r() * jy), Math.sin(a) * R * q] as V
  })
  const foot = ring(1, 0, 0, 0, 0), mid = ring(rm, H * mh, lean * R * 0.5, 0.5, 0.35), top = ring(rt, H, lean * R, 0, 0.14)
  const scr = ([x, y, z]: V): Pt => [w / 2 + x, hh * 0.86 - y + z * tilt]
  const axis = (y: number): V => [lean * R * (y / H), y, 0]
  const shade = (a: V, b: V, cc: V) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = cc[0] - a[0], vy = cc[1] - a[1], vz = cc[2] - a[2]
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    const nl = Math.hypot(nx, ny, nz) || 1
    nx /= nl; ny /= nl; nz /= nl
    // outward: away from the stone's axis at the facet's height
    const cy = (a[1] + b[1] + cc[1]) / 3, ax = axis(cy)
    const ox = (a[0] + b[0] + cc[0]) / 3 - ax[0], oz = (a[2] + b[2] + cc[2]) / 3
    if (nx * ox + nz * oz + ny * 0.2 < 0) (nx = -nx), (ny = -ny), (nz = -nz)
    return [Math.max(0, nx * Lx + ny * Ly + nz * Lz), ny, nz] as const
  }
  const col = (t: number, up: number): RGB => {
    let c2 = t < 0.3 ? mix(tone[3], tone[2], t / 0.3) : t < 0.65 ? mix(tone[2], tone[1], (t - 0.3) / 0.35) : mix(tone[1], tone[0], Math.min(1, (t - 0.65) / 0.3))
    if (moss > 0 && up > 0.3) c2 = mix(c2, mix(mt[2], mt[0], t), Math.min(0.9, moss * (up - 0.15) * 1.5))
    return c2
  }
  type Face = { pts: V[]; depth: number }
  const faces: Face[] = []
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    faces.push({ pts: [foot[i], foot[j], mid[i]], depth: 0 }, { pts: [foot[j], mid[j], mid[i]], depth: 0 })
    faces.push({ pts: [mid[i], mid[j], top[j]], depth: 0 }, { pts: [mid[i], top[j], top[i]], depth: 0 })
  }
  for (const f of faces) f.depth = (f.pts[0][2] + f.pts[1][2] + f.pts[2][2]) / 3
  faces.sort((a, b) => a.depth - b.depth)
  const draw = (pts: V[], t: number, up: number) => {
    const q = pts.map(scr)
    g.beginPath()
    q.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
    g.closePath()
    const cc = col(Math.min(1, 0.04 + t * 1.12), up)
    g.fillStyle = rgba(cc)
    g.fill()
    g.strokeStyle = rgba(cc)
    g.lineWidth = 0.9
    g.stroke()
  }
  for (const f of faces) if (f.depth < 0) {
    const [t, up] = shade(f.pts[0], f.pts[1], f.pts[2])
    draw(f.pts, t, up)
  }
  const [tt, tu] = shade(top[0], top[2], top[4])
  draw(top, Math.max(tt, 0.8), Math.max(tu, 0.9))
  for (const f of faces) if (f.depth >= 0) {
    const [t, up] = shade(f.pts[0], f.pts[1], f.pts[2])
    draw(f.pts, t, up)
  }
  // the edges that face the moon catch it: the top face's back rim, the ridges between bright facets
  g.lineCap = 'round'
  g.strokeStyle = rgba(p.dark ? p.moon : mix(p.card, p.moon, 0.5), p.dark ? 0.75 : 0.85)
  g.lineWidth = Math.max(1, w * 0.012)
  g.beginPath()
  for (let i = 0; i < n; i++) {
    const a = top[i], b = top[(i + 1) % n]
    if ((a[2] + b[2]) / 2 > R * rt * 0.2) continue
    const [x0, y0] = scr(a), [x1, y1] = scr(b)
    g.moveTo(x0, y0)
    g.lineTo(x1, y1)
  }
  g.stroke()
  g.strokeStyle = rgba(p.dark ? p.moon : p.card, p.dark ? 0.35 : 0.45)
  g.lineWidth = Math.max(0.7, w * 0.006)
  g.beginPath()
  for (let i = 0; i < n; i++) {
    if (mid[i][2] < 0) continue
    const [x0, y0] = scr(mid[i]), [x1, y1] = scr(top[i])
    g.moveTo(x0, y0)
    g.lineTo(x1, y1)
  }
  g.stroke()
  // grain and speckles over the whole stone (granite), then the broken ink outline, heavier low and on the left
  g.save()
  g.globalCompositeOperation = 'source-atop'
  for (let i = 0; i < w * hh * 0.03; i++) {
    g.fillStyle = rgba(r() < 0.55 ? tone[3] : tone[0], 0.18 + r() * 0.2)
    const sz = r() < 0.85 ? 1 : 2
    g.fillRect(r() * w, r() * hh, sz, sz)
  }
  // a few soft washes across facets: the stone is not one flat colour per plane
  for (let i = 0; i < 6; i++) {
    const gx = r() * w, gy = r() * hh, gr = Math.max(w, hh) * (0.2 + r() * 0.3)
    const sg = g.createRadialGradient(gx, gy, 0, gx, gy, gr)
    sg.addColorStop(0, rgba(r() < 0.5 ? tone[3] : tone[1], 0.18))
    sg.addColorStop(1, rgba(tone[1], 0))
    g.fillStyle = sg
    g.fillRect(0, 0, w, hh)
  }
  g.restore()
  g.strokeStyle = rgba(p.dark ? p.umbra : p.ink, p.dark ? 0.7 : 0.45)
  g.lineWidth = Math.max(1, w * 0.012)
  g.beginPath()
  const sil = [...foot.filter((v) => v[2] >= -R * 0.2)].sort((a, b) => a[0] - b[0]).map(scr)
  sil.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
  g.stroke()
  return c.c
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
  // the stamp is cut into the stone: a dark lip on its upper edge, and worn so the stone shows through in specks
  sg.strokeStyle = rgba(p.umbra, 0.5)
  sg.lineWidth = Math.max(1, sz * 0.05)
  sg.beginPath()
  sg.moveTo(0, sz * 0.02)
  sg.lineTo(sz, sz * 0.06)
  sg.stroke()
  sg.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < 18; i++) {
    sg.fillStyle = `rgba(0,0,0,${(0.3 + r() * 0.5).toFixed(2)})`
    sg.beginPath()
    sg.arc(r() * sz, r() * sz, sz * (0.02 + r() * 0.05), 0, TAU)
    sg.fill()
  }
  cv.getContext('2d')!.drawImage(t.c, w * 0.5 * d, hh * 0.32 * d, sz * 1.1 * d, sz * 1.1 * d)
}
