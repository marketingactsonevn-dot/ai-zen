import raw from '../../content/tram-20.json'
import { h, s } from '../../core/dom'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import { onPrefs } from '../../core/prefs'
import type { SceneDef } from '../types'
import type { Perspectives } from '../../ui/part2/types'
import type { PondGeo } from '../../ui/part2/perspectives'
import { perspectiveCircle } from '../../ui/part2/perspectives'
import { clamp, rng, type Pt } from '../../ui/part2/ink'
import { mist, moon } from '../../ui/part2/paint'
import { guide } from '../../ui/part2/guide'
import { brush, canvas, col, dprOf, fit, glow, mix, mossDots, paintRock, palette, poly, range, sprite, type Pal, type RGB } from './ink2d'

const S = raw.scenes.circle
const P = S.perspectives as Perspectives
const TAU = Math.PI * 2
// the frame square on and wider than deep: two chimes hang from the front beam (near, outside, bigger), two from the back
// beam (far, inside, on longer cords so they show under the front beam) — four apart, left to right in key order
const FZ = 1.4 // the frame's half depth (× Rw); its half width FX is set per layout (wide 2, tall 1.45)
const SIDE = [-1, -1, 1, 1], FAR = [false, true, true, false]
const HR = 0.38, OH = 0.08, OV = 0.12 // the roof: ridge above the beams, eave past the front beam, verge past the posts (× Rw)
const SHX = -0.9, SHZ = 0.3 // a shadow's run per unit of height: the moon is up right, a little behind — shadows fall left, over half the well
const TRAIN = 4.2 // seconds a ripple train runs before it holds still
const KEEP = 16 // seconds a struck chime keeps swaying gently before it hangs still
type V3 = [number, number, number]

/**
 * Scene 4 · Bốn khánh đá quanh giếng (canvas, EYE 3/4 from a little above, fixed frame): a well of uneven stacked stone,
 * its thick curb capped with mossy stones and streaked by water, the moon in its water. Over it a square frame of cedar:
 * four square posts and four beams, built as boxes in one perspective (lit flank, dark flank, the beam ends jutting past
 * the posts where they are jointed, two beams lapped over the other two). From the middle of each beam hangs an L-shaped
 * chime of thick black polished stone with a moonlit rim, told apart by the sign cut into it (○ △ + □). Touch a chime
 * (or 1–4): it swings like a damped pendulum, rings, and sends a train of ripples across the water from its side; the
 * trains cross and interfere; the words are on a paper strip hung beside the frame on that side. When all four have rung
 * the trains meet and cancel, the water stills and the whole moon lies in the well, the brightest thing in the frame.
 */
export const circleScene: SceneDef = {
  label: S.label,
  mount(ctx) {
    const low = ctx.quality === 'low'
    const still = low || ctx.reduced
    // ── geometry (stage px), set in place() each layout ──
    let sw = 0, sh = 0, Rw = 0, F = 0, cx0 = 0, cy0 = 0, wide = true, FX = 2
    let NEAR_X = 0.65, FAR_X = 0.27 // where a chime hangs along its beam (× FX); tall: the far pair wider apart (touch boxes ≥ 56 px)
    let C: V3 = [0, 0, 0], fwd: V3 = [0, 0, 1], up: V3 = [0, 1, 0]
    let SX = 0, SY = 0, SZ = 1
    const proj = (x: number, y: number, z: number) => {
      const dx = x - C[0], dy = y - C[1], dz = z - C[2]
      const zc = dx * fwd[0] + dy * fwd[1] + dz * fwd[2]
      const yc = dx * up[0] + dy * up[1] + dz * up[2]
      SZ = zc
      SX = cx0 + (F * dx) / zc
      SY = cy0 - (F * yc) / zc
    }
    const pt = (p: V3): Pt => (proj(p[0], p[1], p[2]), [SX, SY])
    // corners k = 0 front right, 1 front left, 2 back left, 3 back right: beam k runs corner k → k+1 (0 front, 2 back)
    const corner = (k: number): Pt => [(k % 4 === 0 || k % 4 === 3 ? 1 : -1) * FX * Rw, (k % 4 < 2 ? 1 : -1) * FZ * Rw]
    const HP = 2.7 // post height (× Rw)
    const PS = 0.17 // post side
    const BW = 0.14, BH = 0.16 // beam width, height
    const CORD = 0.42 // the chime's cord (× Rw); the far ones hang lower
    const cordOf = (k: number) => CORD + (FAR[k] ? 0.3 : 0)
    const RIM = 0.62, WATER = 0.52 // curb top, water level (× Rw)
    const RO = 1.24 // the curb's outer radius
    /** beam k's top (× Rw): two beams lie on top, the other two lap under them through the posts */
    const beamTop = (k: number) => (k % 2 ? HP - BH * 1.05 : HP)
    // each chime hangs under the front (near) or back (far) beam
    const hang = (k: number): V3 => [SIDE[k] * (FAR[k] ? FAR_X : NEAR_X) * FX * Rw, Rw * (HP - BH), (FAR[k] ? -FZ : FZ) * Rw]
    let rootEl: HTMLElement | null = null
    const rootOf = () => (rootEl ??= ctx.art.querySelector<HTMLElement>('.p2c')) // the component's root (it lays out before mount returns)
    function setGeo(w: number, hh: number) {
      const wasWide = wide
      wide = rootOf()?.classList.contains('wide') ?? true
      if (w === sw && hh === sh && wide === wasWide) return
      sw = w
      sh = hh
      Rw = wide ? Math.min(w * 0.17, hh * 0.19) : Math.min(w * 0.13, hh * 0.15)
      FX = wide ? 2 : 1.6
      NEAR_X = wide ? 0.65 : 0.68
      FAR_X = wide ? 0.27 : 0.38
      C = [0, Rw * 3.1, Rw * 5.6] // a little above the beams: we see their tops and joints
      const T = [0, Rw * 1.05, 0]
      const d = [T[0] - C[0], T[1] - C[1], T[2] - C[2]]
      const L = Math.hypot(d[0], d[1], d[2])
      fwd = [d[0] / L, d[1] / L, d[2] / L]
      up = [0, -fwd[2], fwd[1]] // right (1, 0, 0) × forward
      // the well and its frame are the hero: ~65% of the frame's height on wide screens, 90% of the width on tall ones
      F = wide ? hh * 1.22 : Math.min(w * 1.04, hh * 0.95)
      cx0 = w * 0.5
      cy0 = hh * (wide ? 0.52 : 0.65) // (wide: the count and the words fit under the well, clear of the insight)
    }
    /** the stage's height: the component's on wide screens; on tall ones most of the art (the strip hangs inside it) */
    const stageH = (g: PondGeo) => {
      const r = rootOf()
      return !r || r.classList.contains('wide') ? g.h : Math.min(parseFloat(r.style.height) * 0.94, g.w * 2.2)
    }

    // ── state ──
    const n = P.stones.length
    const t0 = new Float32Array(n).fill(-1) // when chime k was struck
    let allAt = -1 // when the last voice was heard (the trains meet and cancel)
    let now = 0
    let pal: Pal = palette()
    let dpr = 1
    let chimes: HTMLCanvasElement[] = []
    let ready = false
    let job: ReturnType<typeof sliced> | null = null
    let host: HTMLElement | null = null
    const back = s('svg', { class: 't20c-back', 'aria-hidden': 'true' })
    const ropes = P.stones.map(() => h('span', { class: 't20c-rope', 'aria-hidden': 'true' })) // where each chime's dot rides
    const base = canvas('t20c-base'), fx = canvas('t20c-fx'), front = canvas('t20c-front')
    let g: CanvasRenderingContext2D | null = null
    let shWater: Path2D | null = null

    const def = perspectiveCircle(P, {
      label: S.label, prompt: S.prompt, // the three questions are the common line on screen (audit v3 20-4)
      countOut: true, // "heard 0/4" from the start, at the well's foot (H4)
      stage(el, api) {
        host = el
        el.append(back, base, fx, front, ...ropes)
        api.onLayout((geo) => layout(geo))
      },
      place(k, _n, geo) {
        setGeo(geo.w, stageH(geo))
        const [x, y, z] = hang(k)
        proj(x, y - Rw * (cordOf(k) + 0.42), z) // the chime's lowest point
        return { x: SX, y: SY, s: (F / SZ) * Rw * 0.0066, z: Math.round(1000 - SZ) }
      },
      stone: () => s('g'),
      onHear(k) {
        if (t0[k] < 0) t0[k] = now
        else t0[k] = now - 0.01 // struck again: the swing restarts (its train stays)
        swing[k] = now
        dots[k]?.done()
        hangStrip()
        if (t0.every((v) => v >= 0) && allAt < 0) allAt = now + 0.9
        loop.start()
        loop.wake()
      },
    })
    const swing = new Float32Array(n).fill(-9)
    const nudge = new Float32Array(n).fill(-9) // when an unstruck chime was stirred by the idle invite
    def.mount(ctx)
    const root = rootOf()!
    root.classList.add('t20c')
    root.prepend(h('p', { class: 'visually-hidden' }, S.art))
    const card = root.querySelector<HTMLElement>('.p2c-card')!
    const count = root.querySelector<HTMLElement>('.p2c-count-out')!
    let stageLeft = 0
    // H1: a dot on each chime's cord, gone once that chime has rung
    const gd = guide(ctx)
    const dots = ropes.map((r) => gd.dot(r, { dir: [0, -1] }))
    // H7: standing still, the chimes not yet struck stir a little on their cords
    const idle = () => {
      if (still) return
      for (let k = 0; k < n; k++) if (t0[k] < 0) nudge[k] = now
      loop.start()
      loop.wake()
    }
    ctx.el.addEventListener('p2:idle', idle)
    ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', idle))

    /** the words are written on the water (audit v3 20-4: no card beside the frame), over the near half of the well */
    function hangStrip() {
      if (!sw) return
      const W = root.clientWidth
      // the count on the ground at the well's foot, the words in a clear band just under it (no letters on the curb)
      proj(0, 0, Rw * RO * 1.12)
      const fx0 = stageLeft + SX, fy = SY + 6
      Object.assign(count.style, { left: `${fx0.toFixed(1)}px`, top: `${fy.toFixed(1)}px` })
      const cw = Math.min(wide ? 640 : W - 24, W - 24)
      Object.assign(card.style, { width: `${cw}px`, maxHeight: '', transform: 'translateX(-50%)', left: `${fx0.toFixed(1)}px`, top: `${(fy + 28).toFixed(1)}px` })
    }

    /**
     * Audit v3 20-4 (P1: the chimes' touch boxes overlapped, so a touch on one rang another): every box at least MIN px
     * square round its chime, then each overlapping pair is cut apart halfway between their centres, along the axis they
     * stand furthest apart on, with a small gap. Reads only the inline styles the component has just written.
     */
    function unstack() {
      const btns = [...rootOf()!.querySelectorAll<HTMLElement>('.p2c-stone')]
      const MIN = 56, GAP = 4
      const bx = btns.map((b) => {
        const l = parseFloat(b.style.left), t = parseFloat(b.style.top), w = parseFloat(b.style.width), hh = parseFloat(b.style.height)
        const cx = l + w / 2, cy = t + hh / 2, W2 = Math.max(w, MIN) / 2, H2 = Math.max(hh, MIN) / 2
        return { cx, cy, l: cx - W2, r: cx + W2, t: cy - H2, b: cy + H2 }
      })
      for (let i = 0; i < bx.length; i++)
        for (let j = i + 1; j < bx.length; j++) {
          const a = bx[i], c = bx[j]
          if (a.r <= c.l || c.r <= a.l || a.b <= c.t || c.b <= a.t) continue
          if (Math.abs(a.cx - c.cx) >= Math.abs(a.cy - c.cy)) {
            const m = (a.cx + c.cx) / 2
            const [lo, hi] = a.cx < c.cx ? [a, c] : [c, a]
            lo.r = Math.min(lo.r, m - GAP / 2)
            hi.l = Math.max(hi.l, m + GAP / 2)
          } else {
            const m = (a.cy + c.cy) / 2
            const [up, dn] = a.cy < c.cy ? [a, c] : [c, a]
            up.b = Math.min(up.b, m - GAP / 2)
            dn.t = Math.max(dn.t, m + GAP / 2)
          }
        }
      btns.forEach((b, k) => {
        const q = bx[k]
        Object.assign(b.style, { left: `${q.l.toFixed(1)}px`, top: `${q.t.toFixed(1)}px`, width: `${(q.r - q.l).toFixed(1)}px`, height: `${(q.b - q.t).toFixed(1)}px` })
      })
    }

    function layout(geo: PondGeo) {
      if (!host) return
      unstack()
      const stage = host.parentElement!
      dpr = dprOf(low)
      const W = geo.w, H = stageH(geo)
      // wide: the stage in the middle of the art (the strip hangs inside it, beside the frame); tall: taller than the
      // component's, the strip on the right
      const RWd = root.clientWidth
      stageLeft = wide ? (RWd - W) / 2 : 0
      Object.assign(stage.style, { left: `${stageLeft.toFixed(1)}px`, height: `${H.toFixed(1)}px` })
      // the canvases spill past the stage so the ground and the mist have no hard edge
      const padX = Math.min(W * 0.25, 160), padY = Math.min(H * 0.18, 90)
      for (const c of [base, fx, front]) Object.assign(c.style, { left: `${-padX}px`, top: `${-padY}px` })
      Object.assign(back.style, { left: `${-padX}px`, top: `${-padY}px`, width: `${W + padX * 2}px`, height: `${H + padY * 2}px` })
      back.setAttribute('viewBox', `${-padX} ${-padY} ${W + padX * 2} ${H + padY * 2}`)
      proj(0, 0, -Rw * 3)
      const hz = SY
      back.replaceChildren(
        mist(W * 0.5, hz - H * 0.18, W * 0.75, H * 0.22),
        moon(wide ? W + padX * 0.45 : W * 0.82, H * (wide ? 0.06 : 0.04), clamp(Rw * 0.2, 12, 26), 2071, true),
        range(-padX, W + padX, hz, H * 0.26, 2072, 0.85, 5),
        mist(W * 0.5, hz, W * 0.8, H * 0.07),
        range(-padX, W * 0.45, hz + H * 0.02, H * 0.2, 2073, 0.62, 2),
        mist(W * 0.3, hz + H * 0.03, W * 0.6, H * 0.06))
      fit(base, W + padX * 2, H + padY * 2, dpr).translate(padX, padY)
      g = fit(fx, W + padX * 2, H + padY * 2, dpr)
      g.translate(padX, padY)
      fit(front, W + padX * 2, H + padY * 2, dpr).translate(padX, padY)
      hangStrip()
      ropes.forEach((el, k) => {
        const [x, y, z] = hang(k)
        proj(x, y - Rw * cordOf(k) * (FAR[k] ? 0.85 : 0.35), z) // (a far cord shows only below the front beam)
        Object.assign(el.style, { left: `${SX.toFixed(1)}px`, top: `${SY.toFixed(1)}px` })
      })
      gd.refresh()
      shWater = shadow(Rw * WATER)
      job?.cancel()
      job = sliced(bake(W, H, padX, padY), { sync: ctx.reduced || ready })
      job.done.then(() => {
        ready = true
        loop.wake()
      })
    }

    /** the faces of a box (origin o, edges u, v, w) that look at the camera, each lit by the moon (up, right, toward us) */
    function box(gx: CanvasRenderingContext2D, o: V3, u: V3, v: V3, w: V3, hi: RGB, lo: RGB, seed: number, beam = false) {
      const p = pal
      const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
      const unit = (a: V3, k: number): V3 => {
        const l = Math.hypot(a[0], a[1], a[2]) * k
        return [a[0] / l, a[1] / l, a[2] / l]
      }
      const Lm = [0.62, 0.66, 0.42]
      // each face: a corner, its two edges, its outward normal (u × v points along w)
      const faces: [V3, V3, V3, V3][] = [[o, u, v, unit(w, -1)], [add(o, w), u, v, unit(w, 1)], [o, v, w, unit(u, -1)], [add(o, u), v, w, unit(u, 1)], [o, u, w, unit(v, -1)], [add(o, v), u, w, unit(v, 1)]]
      const r = rng(seed)
      for (let fi = 0; fi < 6; fi++) {
        const [f0, a, b, nrm] = faces[fi]
        const c = add(add(f0, a, 0.5), b, 0.5)
        if (nrm[0] * (C[0] - c[0]) + nrm[1] * (C[1] - c[1]) + nrm[2] * (C[2] - c[2]) <= 0) continue
        const lit = Math.max(0, nrm[0] * Lm[0] + nrm[1] * Lm[1] + nrm[2] * Lm[2])
        const q = [pt(f0), pt(add(f0, a)), pt(add(add(f0, a), b)), pt(add(f0, b))]
        const path = poly(q)
        gx.fillStyle = col(mix(lo, hi, lit))
        gx.fill(path)
        // grain along the longer edge, a few strokes
        gx.save()
        gx.clip(path)
        const [e0, e1] = Math.hypot(...a) > Math.hypot(...b) ? [q[0], q[1]] : [q[0], q[3]]
        const [s0, s1] = Math.hypot(...a) > Math.hypot(...b) ? [q[0], q[3]] : [q[0], q[1]]
        for (let i = 0; i < 16; i++) {
          const t = r(), l0 = r() * 0.3, l1 = l0 + 0.3 + r() * 0.6
          const bx = s0[0] + (s1[0] - s0[0]) * t, by = s0[1] + (s1[1] - s0[1]) * t
          const dx = e1[0] - e0[0], dy = e1[1] - e0[1]
          brush(gx, [[bx + dx * l0, by + dy * l0], [bx + dx * l1, by + dy * l1]], 0.8 + r() * 0.8, col(p.umbra, 0.22 + r() * 0.15), 0.2, 0.2, 0.2)
        }
        gx.restore()
        gx.strokeStyle = col(p.dark ? p.umbra : p.wash, p.dark ? 0.85 : 0.45)
        gx.lineWidth = 1
        gx.stroke(path)
        // a beam's end where it juts past the post (its tenon end): the end grain, growth rings round an off-centre pith
        if (beam && fi > 1 && fi < 4) {
          const [cx, cy] = pt(c)
          const rr = Math.min(Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]), Math.hypot(q[3][0] - q[0][0], q[3][1] - q[0][1])) * 0.42
          gx.strokeStyle = col(p.umbra, 0.5)
          gx.lineWidth = 0.8
          for (const k of [0.35, 0.7, 1]) {
            gx.beginPath()
            gx.ellipse(cx - rr * 0.15, cy + rr * 0.1, rr * k, rr * k * 0.9, 0, 0, TAU)
            gx.stroke()
          }
        }
        // the moon's edge on a face that turns to it
        if (lit > 0.55 && !p.dark) {
          gx.strokeStyle = col(p['rake-hi'], 0.9)
          gx.beginPath()
          gx.moveTo(q[3][0], q[3][1])
          gx.lineTo(q[2][0], q[2][1])
          gx.stroke()
        }
      }
    }

    // ── the baked parts: ground, the well, the frame behind it; the frame in front of it on its own canvas ──
    function* bake(W: number, H: number, padX: number, padY: number) {
      const p = pal
      const gb = base.getContext('2d')!
      const gf = front.getContext('2d')!
      gb.clearRect(-padX, -padY, W + padX * 2, H + padY * 2)
      gf.clearRect(-padX, -padY, W + padX * 2, H + padY * 2)
      const r = rng(2070)
      // the ground: moss and gravel round the curb, a moonlit floor, no rake (the only rings in this scene are on water)
      proj(0, 0, 0)
      const gs = F / SZ
      glow(gb, SX, SY, Rw * 3.2 * gs, Rw * 0.95 * gs, mix(p['moss-b'], p['rock-lo'], 0.5), p.dark ? 0.55 : 0.32, 0.55)
      proj(Rw * 0.4, 0, -Rw * 0.2)
      glow(gb, SX, SY, Rw * 3.4 * gs, Rw * 1.0 * gs, p.moon, p.dark ? 0.07 : 0.16, 0.5)
      gb.fillStyle = col(p.rake, 1.4)
      for (let i = 0; i < 700; i++) {
        const a = r() * TAU, rr = Rw * (1.3 + r() * r() * 2.2)
        proj(Math.cos(a) * rr, 0, Math.sin(a) * rr)
        gb.globalAlpha = 0.3 + r() * 0.5
        gb.fillRect(SX, SY, 1.3, 1.1)
      }
      gb.globalAlpha = 1
      yield
      // the roof's shadow on the ground (soft), the posts' long shadows, all falling left and toward us, away from the moon
      gb.save()
      gb.filter = `blur(${Math.max(4, Rw * 0.14).toFixed(1)}px)`
      // (fading as it runs away from the frame, so it never meets the canvas's edge)
      const s0 = pt([Rw * FX, 0, 0]), s1 = pt([Rw * (FX + SHX * HP * 1.6 - 2.4), 0, Rw * SHZ * HP])
      const sg = gb.createLinearGradient(s0[0], s0[1], s1[0], s1[1])
      sg.addColorStop(0, col(p.umbra, p.dark ? 0.5 : 0.16))
      sg.addColorStop(1, col(p.umbra, 0))
      gb.fillStyle = sg
      gb.fill(shadow(0))
      gb.restore()
      proj(-Rw * 0.9, 0, Rw * 0.15)
      glow(gb, SX, SY, Rw * 2.0 * gs, Rw * 0.36 * gs, p.umbra, p.dark ? 0.7 : 0.3, 0.6)
      // stones on the ground: back left and right, and a few in the foreground, clear of the well's foot where the count is
      for (const [x, z, w, seed] of [[-2.9, -1.2, 0.42, 2074], [2.7, 0.2, 0.34, 2075], [3.1, 0.5, 0.18, 2076], [-2.7, 2.4, 0.46, 2078], [2.5, 2.7, 0.36, 2079], [2.95, 2.5, 0.17, 2081]] as const) {
        proj(x * Rw, 0, z * Rw)
        const ww = Rw * w * (F / SZ)
        paintRock(gb, p, SX, SY, ww, ww * 0.52, seed, { light: 1, cast: 0.8, moss: 0.6 })
      }
      yield
      // the frame, far half: posts and beams behind the well, far first
      const pieces = frame()
      for (const pc of pieces.filter((q) => !q.near)) box(gb, pc.o, pc.u, pc.v, pc.w, pc.hi, pc.lo, pc.seed, pc.beam)
      yield
      // the well: its outer face of uneven stacked stone (near half), the curb's capstones, the far inner wall
      const ring = (rr: number, y: number, from: number, to: number, out: Pt[]) => {
        for (let i = 0; i <= 10; i++) {
          const a = from + ((to - from) * i) / 10
          out.push(pt([Math.cos(a) * rr, y, Math.sin(a) * rr]))
        }
        return out
      }
      const courses = [0, 0.27, 0.5, 0.78].map((t) => t * RIM * Rw)
      for (let c = 0; c < 3; c++) {
        const y0 = courses[c], y1 = courses[c + 1]
        let a = -0.1 + r() * 0.25
        while (a < Math.PI + 0.1) {
          const a1 = a + 0.26 + r() * 0.3
          const lo = Math.max(0.02, a), hi = Math.min(Math.PI - 0.02, a1)
          if (hi > lo) {
            const bulge = 1 + r() * 0.025
            const q = ring(Rw * RO * bulge, y1 - r() * 2, lo, hi, [])
            ring(Rw * RO * bulge, y0, hi, lo, q)
            const mid = (lo + hi) / 2
            const lit = 0.35 + 0.65 * Math.max(0, Math.cos(mid) * 0.62 + Math.sin(mid) * 0.42) // the moon from the right
            const tone = mix(p['rock-lo'], p['rock-mid'], 0.3 + r() * 0.5)
            gb.fillStyle = col(mix(mix(tone, p.umbra, 0.35), mix(p['rock-mid'], p['rock-hi'], 0.3), lit * 0.8))
            gb.fill(poly(q))
            gb.strokeStyle = col(p.umbra, p.dark ? 0.85 : 0.5)
            gb.lineWidth = 1.4
            gb.stroke(poly(q))
          }
          a = a1 + 0.012
        }
        yield
      }
      // water stains down the face under the lip, moss at its foot
      for (let i = 0; i < 9; i++) {
        const a = 0.15 + r() * (Math.PI - 0.3)
        const top = pt([Math.cos(a) * Rw * RO, RIM * Rw * 0.98, Math.sin(a) * Rw * RO]), bot = pt([Math.cos(a) * Rw * RO, RIM * Rw * (0.25 + r() * 0.4), Math.sin(a) * Rw * RO])
        brush(gb, [top, [(top[0] + bot[0]) / 2 + 1, (top[1] + bot[1]) / 2], bot], 2 + r() * 4, col(p.umbra, p.dark ? 0.45 : 0.22), 0.05, 0.6, 0.2)
      }
      for (let i = 0; i < 7; i++) {
        const a = 0.1 + r() * (Math.PI - 0.2)
        const [x, y] = pt([Math.cos(a) * Rw * RO * 1.02, 2, Math.sin(a) * Rw * RO * 1.02])
        mossDots(gb, p, x, y - 2, Rw * (0.1 + r() * 0.1) * gs, Rw * 0.04 * gs, 2077 + i)
      }
      yield
      // the far inner wall, from the lip down to the water, darker courses
      const inner = ring(Rw, RIM * Rw, Math.PI, TAU, [])
      ring(Rw, WATER * Rw, TAU, Math.PI, inner)
      gb.fillStyle = col(mix(p['rock-lo'], p.umbra, p.dark ? 0.6 : 0.4))
      gb.fill(poly(inner))
      gb.strokeStyle = col(p.umbra, 0.5)
      gb.lineWidth = 1
      for (let a = Math.PI + 0.15; a < TAU - 0.1; a += 0.3 + r() * 0.2) {
        const t = pt([Math.cos(a) * Rw, RIM * Rw, Math.sin(a) * Rw]), b = pt([Math.cos(a) * Rw, WATER * Rw, Math.sin(a) * Rw])
        gb.beginPath()
        gb.moveTo(t[0], t[1])
        gb.lineTo(b[0], b[1])
        gb.stroke()
      }
      // the capstones: uneven blocks round the curb top, a lit top over a dark outer lip, moss dotted on some
      let a = r() * 0.3
      while (a < TAU) {
        const a1 = a + 0.36 + r() * 0.34
        const span = Math.min(a1, TAU + 0.02) - a
        const out = 1 + r() * 0.06
        const top: Pt[] = []
        for (let i = 0; i <= 8; i++) {
          const aa = a + (span * i) / 8, rr = RO * out * (1 + 0.02 * Math.sin(i * 1.7 + a * 5))
          top.push(pt([Math.cos(aa) * Rw * rr, RIM * Rw, Math.sin(aa) * Rw * rr]))
        }
        for (let i = 8; i >= 0; i--) {
          const aa = a + (span * i) / 8
          top.push(pt([Math.cos(aa) * Rw * 0.99, RIM * Rw, Math.sin(aa) * Rw * 0.99]))
        }
        const lipH = Rw * 0.05 * gs
        const mid = a + span / 2
        if (Math.sin(mid) > -0.1) {
          gb.fillStyle = col(mix(p['rock-lo'], p.umbra, 0.3))
          gb.fill(poly(top.slice(0, 9).concat(top.slice(0, 9).reverse().map(([x, y]) => [x, y + lipH] as Pt))))
        }
        const lit = 0.5 + 0.5 * Math.max(0, Math.cos(mid) * 0.7 - Math.sin(mid) * 0.3)
        gb.fillStyle = col(mix(mix(p['rock-mid'], p['rock-lo'], r() * 0.4), mix(p['rock-hi'], p.moon, p.dark ? 0.1 : 0), lit * 0.85))
        gb.fill(poly(top))
        gb.strokeStyle = col(p.dark ? p.umbra : p.wash, p.dark ? 0.85 : 0.45)
        gb.lineWidth = 1.2
        gb.stroke(poly(top))
        if (r() < 0.5) {
          const [mx, my] = pt([Math.cos(mid) * Rw * 1.12, RIM * Rw, Math.sin(mid) * Rw * 1.12])
          gb.save()
          gb.clip(poly(top))
          mossDots(gb, p, mx, my, Rw * 0.1 * gs, Rw * 0.03 * gs, 2080 + Math.round(a * 10))
          gb.restore()
        }
        a = a1 + 0.03
      }
      // the moonlit inner lip on the far side
      const lip: Pt[] = []
      ring(Rw * 1.004, RIM * Rw, Math.PI * 1.06, Math.PI * 1.94, lip)
      brush(gb, lip, Math.max(1.2, Rw * 0.018 * gs), col(p.dark ? p.moon : p['rake-hi'], p.dark ? 0.45 : 0.95), 0.2, 0.2, 0.2)
      // the roof's shadow across the curb (the water gets its share each frame)
      const annulus = new Path2D()
      annulus.addPath(poly(ring(Rw * RO * 1.06, RIM * Rw, 0, TAU, [])))
      annulus.addPath(poly(ring(Rw * 0.99, RIM * Rw, 0, TAU, [])))
      gb.save()
      gb.clip(annulus, 'evenodd')
      gb.filter = `blur(${Math.max(1.5, Rw * 0.025).toFixed(1)}px)`
      gb.fillStyle = col(p.umbra, p.dark ? 0.55 : 0.3)
      gb.fill(shadow(RIM * Rw))
      gb.restore()
      yield
      // the frame's near half (in front of the chimes on the far beams), on the front canvas
      for (const pc of pieces.filter((q) => q.near)) box(gf, pc.o, pc.u, pc.v, pc.w, pc.hi, pc.lo, pc.seed, pc.beam)
      // the pegs that lock the front beam onto the posts' tenons
      for (const sx of [-1, 1]) {
        const [x, y] = pt([sx * FX * Rw, (HP - BH * 0.74) * Rw, (FZ + BW / 2) * Rw])
        const r0 = Math.max(1.5, Rw * 0.026 * (F / SZ))
        gf.fillStyle = col(p.umbra, 0.85)
        gf.beginPath()
        gf.arc(x, y, r0, 0, TAU)
        gf.fill()
        gf.strokeStyle = col(p.dark ? p.moon : p['rake-hi'], p.dark ? 0.4 : 0.8)
        gf.lineWidth = 1
        gf.beginPath()
        gf.arc(x, y, r0, 0.2, Math.PI - 0.2)
        gf.stroke()
      }
      roof(gf)
      yield
      // the chimes: one thick polished black L-stone each, baked once (swung by rotation)
      chimes = P.stones.map((_, k) => {
        const [x, y, z] = hang(k)
        proj(x, y, z)
        const w = Rw * 0.62 * (F / SZ), hh = w
        return sprite(w * 2, hh * 1.6, dpr, (sp) => chimeArt(sp, w, hh, k))
      })
    }

    // weathered cedar: the step tones warmed a touch toward the wood's own red-brown
    const wood = (p: Pal): [RGB, RGB] => [
      mix(p.dark ? mix(p['step-lo'], p['step-mid'], 0.55) : mix(p['step-mid'], p['step-hi'], 0.35), p.lantern, p.dark ? 0.22 : 0.2),
      mix(p.dark ? mix(p['step-lo'], p.umbra, 0.6) : mix(p['step-lo'], p.umbra, 0.5), p.lantern, 0.08),
    ]

    /** the roof's shadow on the level plane y (stage units): its six corners carried along the moonlight (SHX, SHZ) */
    function shadow(y: number) {
      const X = (FX + OV) * Rw, zE = (FZ + OH) * Rw, yE = (HP - (HR * OH) / FZ) * Rw, yR = (HP + HR) * Rw
      const at = (x: number, yy: number, z: number) => pt([x + SHX * (yy - y), y, z + SHZ * (yy - y)])
      const out = poly([at(-X, yE, zE), at(X, yE, zE), at(X, yR, 0), at(X, yE, -zE), at(-X, yE, -zE), at(-X, yR, 0)])
      // and each post's, a long strip from where the post meets the plane
      const hw = PS * Rw * 0.5, top = HP * Rw - Math.max(0, y)
      for (let k = 0; k < 4; k++) {
        const [x, z] = corner(k)
        out.addPath(poly([pt([x, y, z - hw]), pt([x, y, z + hw]), pt([x + SHX * top, y, z + hw + SHZ * top]), pt([x + SHX * top, y, z - hw + SHZ * top])]))
      }
      return out
    }

    /**
     * The small tiled roof, a gable over the frame: its front slope rests on the front beam (the eave just past it) and runs
     * up to a ridge over the frame's middle (the back slope rests on the back beam, out of sight behind the ridge: the
     * camera is below it). Rows of round cover tiles with their ends along the eave, course lines, verge boards, the
     * fascia under the eave, a ridge cap with the moon along it.
     */
    function roof(gx: CanvasRenderingContext2D) {
      const p = pal
      const [woodHi, woodLo] = wood(p)
      const X = (FX + OV) * Rw, zE = (FZ + OH) * Rw, yb = HP * Rw, hr = HR * Rw, zF = FZ * Rw
      // the slope, its eave turned up a little toward both corners (more toward the eave, none at the ridge)
      const lift = (x: number, z: number) => Rw * 0.035 * (Math.abs(x) / X) ** 4 * (z / zE)
      const P3 = (x: number, z: number, dy = 0) => pt([x, yb + hr * (1 - z / zF) + lift(x, z) + dy, z])
      proj(0, yb, zF)
      const px = (F / SZ) * Rw // px per Rw at the eave
      const tile = p.dark ? mix(p['rock-lo'], p.wash, 0.4) : mix(p['rock-mid'], p.wash, 0.5)
      const lit = p.dark ? mix(p['rock-mid'], p.moon, 0.25) : mix(p['rock-hi'], p.paper, 0.3)
      const line = (x0: number, x1: number, z: number, dy = 0) => Array.from({ length: 17 }, (_, i) => P3(x0 + ((x1 - x0) * i) / 16, z, dy))
      const eave = line(-X, X, zE), rL = P3(-X, 0), rR = P3(X, 0)
      const slope = poly([...eave, rR, rL])
      const r = rng(2069)
      // the fascia: the roof's thickness along the eave, on the beam
      const T = Rw * 0.035
      gx.fillStyle = col(mix(woodLo, p.umbra, 0.35))
      gx.fill(poly([...eave, ...line(-X, X, zE, -T).reverse()]))
      const lg = gx.createLinearGradient(0, rL[1], 0, eave[8][1])
      lg.addColorStop(0, col(mix(tile, lit, 0.5)))
      lg.addColorStop(1, col(mix(tile, p.umbra, 0.2)))
      gx.fillStyle = lg
      gx.fill(slope)
      gx.save()
      gx.clip(slope)
      // course lines (each tile's lower lip), every row its own weathering — a band a touch darker or lighter, the lip
      // not quite straight — so the slope reads as laid tiles, not a sheet
      const rows: number[] = []
      for (let z = zE - Rw * 0.11; z > 0; z -= Rw * 0.16) rows.push(z)
      rows.forEach((z, j) => {
        const z1 = j ? rows[j - 1] : zE
        gx.fillStyle = col(r() < 0.5 ? p.umbra : lit, 0.03 + r() * 0.07)
        gx.fill(poly([...line(-X, X, z), ...line(-X, X, z1).reverse()]))
        gx.strokeStyle = col(p.umbra, (p.dark ? 0.4 : 0.22) + r() * 0.15)
        gx.lineWidth = 1
        gx.beginPath()
        for (let i = 0; i <= 24; i++) {
          const [x, y] = P3(-X + (2 * X * i) / 24, z + Rw * (r() - 0.5) * 0.012)
          if (i) gx.lineTo(x, y)
          else gx.moveTo(x, y)
        }
        gx.stroke()
      })
      // the cover tiles, each row its own tone: a dark joint, then the round back lit on its right (the moon is up right)
      const cols = Math.max(8, Math.round((2 * X) / (Rw * 0.17)))
      for (let i = 0; i <= cols; i++) {
        const x = -X + (2 * X * i) / cols
        const a = P3(x, zE), b = P3(x, 0), a2 = P3(x + Rw * 0.035, zE), b2 = P3(x + Rw * 0.035, 0)
        if (i < cols) {
          const c0 = P3(x + Rw * 0.05, zE), c1 = P3(x + (2 * X) / cols - Rw * 0.01, zE), c2 = P3(x + (2 * X) / cols - Rw * 0.01, 0), c3 = P3(x + Rw * 0.05, 0)
          gx.fillStyle = col(r() < 0.5 ? p.umbra : lit, 0.04 + r() * 0.08)
          gx.fill(poly([c0, c1, c2, c3]))
        }
        gx.strokeStyle = col(p.umbra, p.dark ? 0.55 : 0.35)
        gx.lineWidth = Math.max(1, px * 0.02)
        gx.beginPath()
        gx.moveTo(a[0], a[1])
        gx.lineTo(b[0], b[1])
        gx.stroke()
        gx.strokeStyle = col(lit, p.dark ? 0.2 : 0.35)
        gx.lineWidth = Math.max(1, px * 0.014)
        gx.beginPath()
        gx.moveTo(a2[0], a2[1])
        gx.lineTo(b2[0], b2[1])
        gx.stroke()
      }
      gx.restore()
      // the tile ends along the eave, round, each with its lit lip
      for (let i = 0; i < cols; i++) {
        const [x, y] = P3(-X + (2 * X * (i + 0.5 + (r() - 0.5) * 0.12)) / cols, zE, -T * (0.4 + r() * 0.25))
        const r0 = Math.max(1.6, px * 0.04 * (0.85 + r() * 0.3))
        gx.fillStyle = col(mix(tile, p.umbra, 0.35))
        gx.beginPath()
        gx.arc(x, y, r0, 0, TAU)
        gx.fill()
        gx.strokeStyle = col(lit, p.dark ? 0.6 : 0.85)
        gx.lineWidth = 1
        gx.beginPath()
        gx.arc(x, y, r0 * 0.7, Math.PI * 1.1, Math.PI * 1.9)
        gx.stroke()
      }
      // verge boards down both sides (the right one takes the moon), then the ridge cap, its ends curled up
      gx.lineCap = 'round'
      for (const [a, b, rim] of [[eave[0], rL, false], [eave[16], rR, true]] as const) {
        gx.strokeStyle = col(mix(woodLo, woodHi, 0.4))
        gx.lineWidth = Math.max(2, px * 0.06)
        gx.beginPath()
        gx.moveTo(a[0], a[1])
        gx.lineTo(b[0], b[1])
        gx.stroke()
        if (!rim) continue
        gx.strokeStyle = col(p.dark ? p.moon : p['rake-hi'], p.dark ? 0.5 : 0.9)
        gx.lineWidth = 1
        gx.beginPath()
        gx.moveTo(a[0] + 1, a[1])
        gx.lineTo(b[0] + 1, b[1])
        gx.stroke()
      }
      const k0 = P3(-X, 0, Rw * 0.03), k1 = P3(X, 0, Rw * 0.03)
      const c0 = P3(-X - Rw * 0.12, 0, Rw * 0.13), c1 = P3(X + Rw * 0.12, 0, Rw * 0.13)
      gx.strokeStyle = col(mix(tile, p.umbra, 0.3))
      gx.lineWidth = Math.max(3, px * 0.09)
      gx.lineJoin = 'round'
      gx.beginPath()
      gx.moveTo(c0[0], c0[1])
      gx.quadraticCurveTo(k0[0], k0[1], k0[0] + (k1[0] - k0[0]) * 0.05, k0[1])
      gx.lineTo(k1[0] - (k1[0] - k0[0]) * 0.05, k1[1])
      gx.quadraticCurveTo(k1[0], k1[1], c1[0], c1[1])
      gx.stroke()
      gx.strokeStyle = col(p.dark ? p.moon : p['rake-hi'], p.dark ? 0.3 : 0.7)
      gx.lineWidth = Math.max(1, px * 0.018)
      gx.beginPath()
      gx.moveTo(k0[0], k0[1] - px * 0.035)
      gx.lineTo(k1[0], k1[1] - px * 0.035)
      gx.stroke()
      gx.lineCap = 'butt'
    }

    /** the four posts and four beams as boxes (× Rw), each marked near (front canvas) or far, sorted far → near */
    function frame() {
      const p = pal
      const [woodHi, woodLo] = wood(p)
      const ca = 1, sa = 0 // posts square to the frame
      const out: { o: V3; u: V3; v: V3; w: V3; hi: RGB; lo: RGB; seed: number; near: boolean; d: number; beam: boolean }[] = []
      const s0 = PS * Rw
      for (let k = 0; k < 4; k++) {
        const [x, z] = corner(k)
        const u: V3 = [ca * s0, 0, sa * s0], w: V3 = [-sa * s0, 0, ca * s0]
        out.push({ o: [x - u[0] / 2 - w[0] / 2, 0, z - u[2] / 2 - w[2] / 2], u, v: [0, HP * Rw, 0], w, hi: woodHi, lo: woodLo, seed: 2090 + k, near: z > Rw * 0.3, d: Math.hypot(x - C[0], z - C[2]), beam: false })
      }
      for (let k = 0; k < 4; k++) {
        const a = corner(k), b = corner(k + 1)
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]), dx = (b[0] - a[0]) / L, dz = (b[1] - a[1]) / L
        const over = Rw * 0.22 // the ends jut past the posts: the joint shows
        const u: V3 = [dx * (L + over * 2), 0, dz * (L + over * 2)], w: V3 = [-dz * BW * Rw, 0, dx * BW * Rw]
        const yT = beamTop(k) * Rw
        const mz = (a[1] + b[1]) / 2, mx = (a[0] + b[0]) / 2
        out.push({ o: [a[0] - dx * over - w[0] / 2, yT - BH * Rw, a[1] - dz * over - w[2] / 2], u, v: [0, BH * Rw, 0], w, hi: woodHi, lo: woodLo, seed: 2095 + k, near: mz > 0 || k % 2 === 1, d: Math.hypot(mx - C[0], mz - C[2]) - (k % 2 ? 0 : 0.01), beam: true })
      }
      return out.sort((p0, p1) => p1.d - p0.d)
    }

    /** An L-shaped chime of thick black stone hanging from (w, 0) of its box: the back face shows as its thickness, the
     *  front is polished (a sheen and a moon rim on the upper edges), the speaker's sign cut large into the long arm. */
    function chimeArt(sp: CanvasRenderingContext2D, w: number, hh: number, k: number) {
      const p = pal
      const ox = w, oy = hh * 0.1
      // a khánh: a thick slab bent at an obtuse angle, hung at the bend; the short broad arm left, the long narrow arm
      // right, the underside cut in a curve up to the inner corner
      // it hangs tilted: the long arm is the heavier, so it rides lower (rotated about the hole)
      const tc = Math.cos(0.2), ts = Math.sin(0.2)
      const R = (x: number, y: number): Pt => [ox + (x * tc - y * ts) * w, oy + (x * ts + y * tc) * hh]
      const shape: Pt[] = [[-0.6, 0.48], [-0.07, 0.02], [0.06, 0.0], [0.78, 0.5], [0.7, 0.66], [0.3, 0.42], [0.04, 0.31], [-0.04, 0.31], [-0.3, 0.5], [-0.46, 0.66]]
      const at = (dx: number, dy: number) => shape.map(([x, y]) => { const q = R(x, y); return [q[0] + dx, q[1] + dy] as Pt })
      const tk = Math.max(2, w * 0.07) // its thickness, seen a little from above
      const backF = at(tk * 0.5, -tk), frontF = at(0, 0)
      const ink = mix(p.umbra, p['rock-lo'], p.dark ? 0.35 : 0.2)
      // the thickness: the back face, then each top edge swept to it, catching the moon
      sp.fillStyle = col(mix(ink, p['rock-mid'], 0.25))
      sp.fill(poly(backF))
      for (let i = 0; i < shape.length; i++) {
        const j = (i + 1) % shape.length
        const e = [frontF[i], frontF[j], backF[j], backF[i]]
        if (backF[i][1] + backF[j][1] > frontF[i][1] + frontF[j][1]) continue // the underside: unseen
        sp.fillStyle = col(mix(ink, p['rock-hi'], p.dark ? 0.32 : 0.45))
        sp.fill(poly(e))
      }
      // the polished face
      const lg = sp.createLinearGradient(ox - w * 0.5, oy, ox + w * 0.6, oy + hh * 0.8)
      lg.addColorStop(0, col(mix(p.umbra, p['rock-lo'], 0.15)))
      lg.addColorStop(0.55, col(mix(p['rock-lo'], p.umbra, 0.7)))
      lg.addColorStop(1, col(mix(p['rock-lo'], p.umbra, 0.45)))
      sp.fillStyle = lg
      sp.fill(poly(frontF))
      sp.save()
      sp.clip(poly(frontF))
      sp.globalCompositeOperation = p.dark ? 'lighter' : 'source-over'
      // polish: a long thin sheen just under each upper edge, as on wet black stone
      sp.lineCap = 'round'
      sp.lineWidth = Math.max(1.5, w * 0.035)
      sp.strokeStyle = col(p.moon, p.dark ? 0.3 : 0.5)
      sp.beginPath()
      sp.moveTo(...R(-0.48, 0.48))
      sp.lineTo(...R(-0.1, 0.16))
      sp.moveTo(...R(0.14, 0.13))
      sp.lineTo(...R(0.66, 0.5))
      sp.stroke()
      const sh = R(0.4, 0.3)
      glow(sp, sh[0], sh[1], w * 0.16, hh * 0.06, p.moon, p.dark ? 0.3 : 0.45, 0.4)
      sp.restore()
      sp.strokeStyle = col(p.dark ? p.moon : p['rake-hi'], p.dark ? 0.8 : 1)
      sp.lineWidth = Math.max(1.2, w * 0.02)
      sp.beginPath()
      sp.moveTo(frontF[0][0], frontF[0][1])
      sp.lineTo(frontF[1][0], frontF[1][1])
      sp.lineTo(frontF[2][0], frontF[2][1])
      sp.lineTo(frontF[3][0], frontF[3][1])
      sp.stroke()
      sp.strokeStyle = col(p.umbra, 0.9)
      sp.lineWidth = 1
      sp.stroke(poly(frontF))
      // the hanging hole
      sp.fillStyle = col(p.dark ? p['rock-hi'] : p.paper, 0.9)
      sp.beginPath()
      sp.arc(...R(0, 0.11), Math.max(1.4, w * 0.03), 0, TAU)
      sp.fill()
      // the speaker's sign, cut big into the long arm: a dark groove with the moon on its lower lip
      const [mx, my] = R(0.42, 0.4), mr = w * 0.07
      const sign = (dy: number) => {
        sp.beginPath()
        if (k === 0) sp.arc(mx, my + dy, mr, 0, TAU)
        else if (k === 1) (sp.moveTo(mx - mr, my + mr * 0.85 + dy), sp.lineTo(mx, my - mr + dy), sp.lineTo(mx + mr, my + mr * 0.85 + dy), sp.closePath())
        else if (k === 2) (sp.moveTo(mx - mr, my + dy), sp.lineTo(mx + mr, my + dy), sp.moveTo(mx, my - mr + dy), sp.lineTo(mx, my + mr + dy))
        else sp.rect(mx - mr * 0.85, my - mr * 0.85 + dy, mr * 1.7, mr * 1.7)
        sp.stroke()
      }
      sp.lineCap = 'round'
      sp.lineWidth = Math.max(1.6, w * 0.026)
      sp.strokeStyle = col(p.moon, p.dark ? 0.55 : 0.85)
      sign(Math.max(0.8, w * 0.01))
      sp.strokeStyle = col(p.umbra, 0.95)
      sign(0)
    }

    // ── one frame: water, ripple trains, the moon in the well, the chimes swinging ──
    function draw() {
      if (!g || !ready) return
      const p = pal
      g.save()
      g.setTransform(1, 0, 0, 1, 0, 0)
      g.clearRect(0, 0, fx.width, fx.height)
      g.restore()
      // the water surface inside the curb
      const wy = Rw * WATER
      g.save()
      g.beginPath()
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * TAU
        proj(Math.cos(a) * Rw * 0.995, wy, Math.sin(a) * Rw * 0.995)
        if (i) g.lineTo(SX, SY)
        else g.moveTo(SX, SY)
      }
      g.closePath()
      g.fillStyle = col(mix(p.water, p.umbra, p.dark ? 0.15 : 0.1))
      g.fill()
      g.clip()
      proj(0, wy, -Rw * 0.4)
      glow(g, SX, SY, Rw * 1.1 * (F / SZ), Rw * 0.3 * (F / SZ), p.mist, p.dark ? 0.12 : 0.35, 0.5)
      // the roof's shadow on the water
      if (shWater) {
        g.fillStyle = col(p.umbra, p.dark ? 0.3 : 0.22)
        g.fill(shWater)
      }
      // how stirred the water is: trains running, then held; all four heard → they meet and cancel
      const settle = allAt < 0 ? 0 : clamp((now - allAt) / 2.4, 0, 1)
      const calm = still ? (allAt >= 0 ? 1 : 0) : settle
      const heardN = t0.reduce((a, v) => a + (v >= 0 ? 1 : 0), 0)
      // the moon's reflection: flakes scattered by the trains, gathering into one bright disc as they cancel
      proj(Rw * 0.48, wy, -Rw * 0.5) // far half, in the light: the words take the near half
      const mx = SX, my = SY, ms = (F / SZ) * Rw * 0.9
      const spread = (1 - calm) * Math.min(1, 0.35 + heardN * 0.18)
      g.globalCompositeOperation = p.dark ? 'lighter' : 'source-over'
      glow(g, mx, my, ms * (0.7 + calm * 0.5), ms * (0.3 + calm * 0.2), p.moon, (p.dark ? 0.35 : 0.45) * (0.6 + calm * 0.8), 0.4)
      g.fillStyle = p.dark ? col(p.moon, 0.95) : 'rgba(255,255,255,0.96)'
      if (spread < 0.02) {
        // the whole moon: a bright full disc, a halo round it, a glint — the lightest thing in the frame
        glow(g, mx, my, ms * 0.5, ms * 0.22, p.moon, p.dark ? 0.9 : 0.9, 0.5)
        g.beginPath()
        g.ellipse(mx, my, ms * 0.26 * (0.8 + calm * 0.2), ms * 0.11 * (0.8 + calm * 0.2), 0, 0, TAU)
        g.fill()
      } else {
        for (let q = -4; q <= 4; q++) {
          const half = ms * 0.17 * Math.sqrt(1 - (q / 4.6) ** 2) * (0.5 + 0.5 * Math.abs(Math.cos(q * 1.3)))
          const off = Math.sin(q * 2.2 + now * 1.4 * (still ? 0 : 1)) * ms * 0.12 * spread
          g.globalAlpha = 0.5 + 0.5 * Math.abs(Math.cos(q))
          g.fillRect(mx - half + off, my + q * ms * 0.019 * (1 + spread), half * 2, ms * 0.012 + 1)
        }
        g.globalAlpha = 1
      }
      // the water is never quite still: a few faint rings round the reflection
      g.strokeStyle = col(p.moon, p.dark ? 0.16 : 0.3)
      g.lineWidth = 1
      for (let i = 1; i <= 3; i++) {
        g.beginPath()
        g.ellipse(mx, my, ms * (0.36 + i * 0.22), ms * (0.13 + i * 0.08), 0, Math.PI * 0.1, Math.PI * 0.9)
        g.stroke()
      }
      // each heard chime's train: crests (moonlit) and troughs (dark) running in from the water's edge on its side;
      // where trains cross, the crests add up — the interference shows as brighter knots
      for (let k = 0; k < n; k++) {
        if (t0[k] < 0) continue
        const [hx, , hz] = hang(k)
        const a = Math.atan2(hz, hx)
        const sx0 = Math.cos(a) * Rw * 0.98, sz0 = Math.sin(a) * Rw * 0.98
        const age = still ? TRAIN : now - t0[k]
        for (let j = 0; j < 7; j++) {
          const life = Math.min(age, TRAIN) - j * 0.36
          if (life <= 0) continue
          const rr = Rw * (0.06 + life * 0.32)
          if (rr > Rw * 2.1) continue
          const fade = (1 - rr / (Rw * 2.2)) * (1 - calm)
          for (const [dr, style, wdt] of [[0, p.dark ? col(p.moon, 0.5) : 'rgba(255,255,255,0.75)', 1.6], [Rw * 0.05, col(p.umbra, p.dark ? 0.5 : 0.25), 1.4]] as const) {
            g.strokeStyle = style
            g.globalAlpha = fade
            g.lineWidth = wdt
            g.beginPath()
            for (let i = 0; i <= 48; i++) {
              const b = (i / 48) * TAU
              proj(sx0 + Math.cos(b) * (rr + dr), wy, sz0 + Math.sin(b) * (rr + dr))
              if (i) g.lineTo(SX, SY)
              else g.moveTo(SX, SY)
            }
            g.stroke()
          }
        }
      }
      // once the water has stilled, each voice still keeps one faint ring on it
      if (calm > 0)
        for (let k = 0; k < n; k++) {
          if (t0[k] < 0) continue
          const [hx, , hz] = hang(k)
          const a = Math.atan2(hz, hx)
          g.strokeStyle = col(p.moon, (p.dark ? 0.3 : 0.5) * calm)
          g.lineWidth = 1.2
          g.beginPath()
          for (let i = 0; i <= 40; i++) {
            const b = (i / 40) * TAU
            proj(Math.cos(a) * Rw * 0.6 + Math.cos(b) * Rw * 0.28, wy, Math.sin(a) * Rw * 0.6 + Math.sin(b) * Rw * 0.28)
            if (i) g.lineTo(SX, SY)
            else g.moveTo(SX, SY)
          }
          g.stroke()
        }
      g.globalAlpha = 1
      // when the four trains meet: a bright still ring of moonlight closing on the whole moon
      if (allAt >= 0 && calm > 0 && calm < 1) {
        g.strokeStyle = col(p.moon, 1)
        g.globalAlpha = Math.sin(calm * Math.PI) * 0.7
        g.lineWidth = 1.5
        g.beginPath()
        g.ellipse(mx, my, ms * (0.7 - calm * 0.42), ms * (0.3 - calm * 0.18), 0, 0, TAU)
        g.stroke()
        g.globalAlpha = 1
      }
      g.globalCompositeOperation = 'source-over'
      g.restore()
      // the chimes: cords from the beams, the L-stones swinging (damped), far ones first
      for (const k of order) {
        if (!chimes[k]) continue
        const [x, y, z] = hang(k)
        proj(x, y, z)
        const hx = SX, hy = SY
        const age = now - swing[k], ag2 = now - nudge[k]
        let th = 0
        if (still) th = (t0[k] >= 0 ? 0.08 : 0.03) * SIDE[k]
        else {
          if (age < 6) th += 0.3 * Math.exp(-age * 0.7) * Math.sin(age * 5.2) // struck: a damped swing
          if (t0[k] >= 0 && age < KEEP) th += 0.035 * Math.sin(now * 1.7 + k) * Math.min(1, age / 3, (KEEP - age) / 3) // then gently on
          if (ag2 < 3.5) th += 0.06 * Math.sin(ag2 * 3.4) * (1 - ag2 / 3.5) // stirred by the idle invite
        }
        const cord = Rw * cordOf(k) * (F / SZ)
        g.strokeStyle = col(p.dark ? p['ink-3'] : p.wash, 0.8)
        g.lineWidth = 1
        g.beginPath()
        g.moveTo(hx, hy)
        g.lineTo(hx + Math.sin(th) * cord, hy + Math.cos(th) * cord)
        g.stroke()
        g.save()
        g.translate(hx, hy)
        g.rotate(th)
        if (SIDE[k] < 0) g.scale(-1, 1) // the left pair mirrored: each long arm points out
        const cw = chimes[k].width / dpr, ch = chimes[k].height / dpr
        if (t0[k] >= 0 && allAt < 0) glow(g, 0, cord + ch * 0.3, cw * 0.5, ch * 0.4, p.moon, p.dark ? 0.18 : 0.3)
        g.drawImage(chimes[k], -cw / 2, cord - ch * 0.06, cw, ch)
        g.restore()
      }
    }
    // far chimes first (drawn under the near ones)
    const order = [1, 2, 0, 3]

    const loop = createLoop(root, (_t, dt) => {
      now += dt
      draw()
      let busy = false
      for (let k = 0; k < n; k++) if ((t0[k] >= 0 && now - t0[k] < TRAIN + 0.5) || now - swing[k] < (t0[k] >= 0 ? KEEP : 6) || now - nudge[k] < 3.5) busy = true
      if (allAt >= 0 && now - allAt < 3) busy = true
      return busy
    })
    ctx.onCleanup(() => {
      loop.dispose()
      job?.cancel()
    })
    ctx.onCleanup(onPrefs(() => {
      const p = palette()
      if (p.key === pal.key) return
      pal = p
      if (!ready || !sw) return
      job?.cancel()
      const padX = Math.min(sw * 0.25, 160), padY = Math.min(sh * 0.18, 90)
      job = sliced(bake(sw, sh, padX, padY), { sync: true })
      loop.wake()
    }))
  },
}
