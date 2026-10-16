import raw from '../../content/tram-32.json'
import { h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import { onPrefs } from '../../core/prefs'
import { perspectiveCircle, type PondGeo } from '../../ui/part2/perspectives'
import { blob, curve, rng, rock } from '../../ui/part2/ink'
import type { Perspectives } from '../../ui/part2/types'
import type { SceneCtx, SceneDef } from '../types'
import { brush, camera, clamp, ease, grainOver, mix, palette, polyClip, radial, rgba, stageSize, type Cam, type Pal, type RGB, type V3 } from './kit'

const K = raw.scenes.circle
const R = 3.2 // the pond's radius (m)
type Stone = { x: number; z: number; r: number; h: number }
/** the four stones, clockwise from the far right: two small on the far bank, two big on the near bank */
const STONES_W: Stone[] = [
  { x: 1.6, z: -3.15, r: 0.42, h: 0.5 },
  { x: 1.8, z: 2.9, r: 0.46, h: 0.52 },
  { x: -2.15, z: 2.6, r: 0.52, h: 0.48 },
  { x: -1.75, z: -3.0, r: 0.38, h: 0.44 },
]
/** a phone sees a narrow slice of the pond: the stones gather into it, the near two big and cut by the frame's foot */
const STONES_T: Stone[] = [
  { x: 1.05, z: -3.05, r: 0.42, h: 0.5 },
  { x: 0.5, z: 5.45, r: 0.36, h: 0.4 },
  { x: -0.52, z: 5.25, r: 0.4, h: 0.38 },
  { x: -1.15, z: -2.85, r: 0.38, h: 0.44 },
]

/**
 * Scene 6 — four stones round a round pond, the camera grazing the water (about 5°): the pond is a thin ellipse holding
 * the sky, the moon's road a long path of soft broken glints running at you. Touch a stone: its little lamp lights and,
 * this close to the water, its reflection draws a long warm streak toward you while the moon's road bends to that stone.
 * Move the pointer (or drag) and the camera slides ±6° round the pond: every streak slides on the water. All four heard:
 * the streaks and the road gather at the pond's centre. Canvas behind the perspectiveCircle stones (its keys and logic
 * unchanged; the speaker's words are written over the night without a box).
 */
export function circleScene(): SceneDef {
  return {
    label: K.label,
    mount(ctx: SceneCtx) {
      const low = ctx.quality === 'low'
      const still = low || ctx.reduced
      let host: HTMLElement | null = null
      let cv: HTMLCanvasElement | null = null
      let c: CanvasRenderingContext2D | null = null
      let P: Pal = palette()
      let GLOW = radial(P.lantern, [[0, 1], [1, 0]])
      let GLINT = radial(P.moon, [[0, 1], [0.5, 0.45], [1, 0]])
      let WARM = radial(mix(P.lantern, P.moon, 0.15), [[0, 1], [0.5, 0.4], [1, 0]])
      let SHADOW = radial(P.umbra, [[0, 1], [0.6, 0.5], [1, 0]])
      const T = { paper: '', warm: '', edge: '', cap: '' }
      const tones = () => {
        GLOW = radial(P.lantern, [[0, 1], [1, 0]])
        GLINT = radial(P.moon, [[0, 1], [0.5, 0.45], [1, 0]])
        WARM = radial(mix(P.lantern, P.moon, 0.15), [[0, 1], [0.5, 0.4], [1, 0]])
        SHADOW = radial(P.umbra, [[0, 1], [0.6, 0.5], [1, 0]])
        T.paper = rgba(P.dark ? mix(P['rock-hi'], P.moon, 0.2) : P.card)
        T.warm = rgba(mix(P.lantern, P.moon, 0.15))
        T.edge = rgba(P.dark ? P.wash : P.ink, 0.6)
        T.cap = rgba(P.dark ? P.wash : P.ink, 0.85)
      }
      tones()
      let W = 0, H = 0, x0 = 0, sw = 0, sh = 0, dpr = 1, tall = false
      let ST = STONES_W
      let yaw = 0, yawTo = 0
      const lit = [0, 0, 0, 0], litTo = [0, 0, 0, 0]
      let bend = 0, bendFrom = 0, bendTo = 0, tBend = 1 // the road leans toward the last stone heard (screen x share)
      let gather = 0, gatherTo = 0
      let cam: Cam = camera([0, 1, 6], [0, 0, 0], 40, 10, 10)
      const back = document.createElement('canvas') // sky, moon, far hills and mist (wider than the frame: it pans with the yaw)
      const pond = document.createElement('canvas') // the ground, banks, the water holding the sky, far reeds
      const reeds = document.createElement('canvas') // the near reeds, out of focus dark (they pan the most)
      const sprites: HTMLCanvasElement[] = []
      const rnd = new Float32Array(400)
      { const r = rng(3601); for (let i = 0; i < rnd.length; i++) rnd[i] = r() }
      let wp = new Path2D()
      let waterYaw = NaN

      const camAt = (yw: number) => {
        // the eye on a circle round the pond, low over the water (a grazing look), at the far bank
        const d = tall ? 7.6 : 8.6
        const eye: V3 = [Math.sin(yw) * d, tall ? 0.78 : 0.68, Math.cos(yw) * d]
        const fov = tall ? 50 : sw / sh > 1.2 ? 34 : 42
        // the pond's centre lands in the middle of the stone stage, a little low (the sky above it)
        const base = camera(eye, [0, 0.2, 0], fov, W, H)
        base.p(0, 0, 0)
        return camera(eye, [0, 0.2, 0], fov, W, H, x0 + sw / 2 - base.o[0], (tall ? H * 0.5 : sh * 0.76) - base.o[1])
      }
      const bw = () => clamp(Math.min(sw, sh * 1.7) * 0.19, 64, 140) // shortcut: perspectiveCircle's default stone width, kept in step by hand

      function geo(g: PondGeo) {
        const st = host?.parentElement
        ;[W, H] = stageSize(ctx)
        tall = W / H < 0.9
        ST = tall ? STONES_T : STONES_W
        x0 = parseFloat(st?.style.left || '0') || 0
        sw = g.w
        sh = g.h
        cam = camAt(yaw)
        waterYaw = NaN
      }
      /** the water's outline for this camera (rebuilt only when the camera turned) */
      function waterPath() {
        if (waterYaw === yaw) return wp
        waterYaw = yaw
        const p = new Path2D()
        for (let i = 0; i <= 72; i++) {
          const a = (i / 72) * Math.PI * 2
          cam.p(Math.cos(a) * R, 0, Math.sin(a) * R)
          if (i) p.lineTo(cam.o[0], cam.o[1])
          else p.moveTo(cam.o[0], cam.o[1])
        }
        p.closePath()
        wp = p
        return p
      }

      // ── baked layers ──
      function* bake() {
        if (!cv || !c) return
        waterYaw = NaN
        const r = rng(3610)
        // the far world: sky gradient, moon, two ink ranges, mist on the far bank
        const bw2 = Math.round(W * 1.3)
        back.width = Math.round(bw2 * dpr)
        back.height = Math.round(H * dpr)
        const b = back.getContext('2d')!
        b.setTransform(dpr, 0, 0, dpr, 0, 0)
        cam.p(0, 0, -R)
        const hz = cam.o[1] // the far bank's line on screen
        const skyTop = rgba(P.dark ? mix(P.wash, P.paper, 0.5) : mix(P.water, P.mist, 0.5))
        const skyLow = rgba(P.dark ? mix(P.paper, P.mist, 0.2) : P.mist)
        const sky = b.createLinearGradient(0, 0, 0, hz)
        sky.addColorStop(0, skyTop)
        sky.addColorStop(1, skyLow)
        b.fillStyle = sky
        b.fillRect(0, 0, bw2, hz + 4)
        const ox = (bw2 - W) / 2
        const m = moonAt(0)
        const mr = Math.min(sw, tall ? H * 0.5 : sh) * 0.07
        const halo = b.createRadialGradient(m[0] + ox, m[1], mr, m[0] + ox, m[1], mr * 4)
        halo.addColorStop(0, rgba(P.moon, P.dark ? 0.3 : 0.55))
        halo.addColorStop(1, rgba(P.moon, 0))
        b.fillStyle = halo
        b.fillRect(0, 0, bw2, hz)
        b.fillStyle = rgba(P.dark ? P.moon : mix(P.moon, P.lantern, 0.12))
        b.beginPath()
        b.arc(m[0] + ox, m[1], mr, 0, Math.PI * 2)
        b.fill()
        b.strokeStyle = rgba(P.dark ? P.wash : P.ink, 0.25)
        b.lineWidth = 1
        b.stroke()
        const hh = tall ? H * 0.5 : sh
        const range = (hgt: number, seed: number, col: RGB, a: number) => {
          b.beginPath()
          b.moveTo(0, hz + 2)
          for (let i = 0; i <= 50; i++) {
            const t = i / 50
            const pk = Math.max(0, Math.sin(t * 7 + seed)) ** 1.4 * 0.8 + Math.sin(t * 19 + seed) * 0.05
            b.lineTo(t * bw2, hz - hgt * pk)
          }
          b.lineTo(bw2, hz + 2)
          b.fillStyle = rgba(col, a)
          b.fill()
        }
        range(hh * 0.22, 3, P.dark ? mix(P.wash, P.mist, 0.14) : mix(P.water, P.mist, 0.3), 0.7)
        mistBand(b, bw2, hz - hh * 0.05, hh * 0.05, P.dark ? 0.12 : 0.6)
        range(hh * 0.1, 8, P.dark ? P.wash : mix(P.water, P.wash, 0.25), 0.85)
        mistBand(b, bw2, hz - hh * 0.01, hh * 0.025, P.dark ? 0.14 : 0.7)
        grainOver(b, bw2, H, P.dark ? 0.4 : 0.3)
        yield
        // the ground: wet earth and moss, darker and closer toward you, dry strokes, tufts and pebbles on it
        pond.width = Math.round(W * dpr)
        pond.height = Math.round(H * dpr)
        const p = pond.getContext('2d')!
        p.setTransform(dpr, 0, 0, dpr, 0, 0)
        polyClip(p, cam, [[-30, 0, -R * 1.12], [30, 0, -R * 1.12], [30, 0, 30], [-30, 0, 30]])
        cam.p(0, 0, -R)
        const gy = cam.o[1]
        const far = P.dark ? mix(P['moss-a'], P.wash, 0.6) : mix(P['paper-2'], P['moss-c'], 0.3)
        const near = P.dark ? mix(P['moss-b'], P.umbra, 0.65) : mix(mix(P['paper-2'], P['rock-mid'], 0.4), P['moss-b'], 0.3)
        const gg = p.createLinearGradient(0, gy, 0, H)
        gg.addColorStop(0, rgba(far))
        gg.addColorStop(1, rgba(near))
        p.fillStyle = gg
        p.fill()
        p.save()
        p.clip()
        // dry brush across the earth, longer toward you; a lighter wash where the moon lies on it
        for (let i = 0; i < 260; i++) {
          const a = r() * Math.PI * 2, rr = R * (1.12 + r() * 2.2)
          if (Math.sin(a) < -0.3) continue
          cam.p(Math.cos(a) * rr, 0, Math.sin(a) * rr)
          const x = cam.o[0], y = cam.o[1], l = 8 + (y - gy) * 0.25 * (0.5 + r())
          p.fillStyle = rgba(r() < 0.6 ? mix(near, P.umbra, 0.35) : mix(far, P.moon, 0.35), 0.25 + r() * 0.25)
          p.fill(brush([[x - l / 2, y], [x + l / 2, y + (r() - 0.5) * 2]], 1.2 + (y - gy) * 0.016, 0.3, 0.3, 0.2))
        }
        // the near bank in long dry strokes: moss dark, a few moonlit, thicker toward you
        cam.p(0, 0, R)
        const nb = cam.o[1]
        for (let i = 0; i < 170; i++) {
          const y = nb + (H - nb) * Math.sqrt(r()), x = r() * W, k = (y - nb) / Math.max(1, H - nb)
          const lit2 = r() < 0.25
          p.fillStyle = rgba(lit2 ? mix(far, P.moon, 0.4) : mix(near, P.umbra, P.dark ? 0.4 : 0.3), lit2 ? 0.25 : 0.3 + r() * 0.25)
          if (r() < 0.55) {
            // a tuft: a few blades leaning out from one root
            const hgt = 5 + k * 22
            for (let j = 0; j < 4; j++) p.fill(brush([[x + j * 2, y], [x + j * 2 + (r() - 0.5) * hgt * 0.8, y - hgt * (0.6 + r() * 0.4)]], 1 + k * 1.4, 0.05, 0.7, 0.15))
          } else {
            const l = 14 + k * 50 * (0.4 + r())
            p.fill(brush([[x - l / 2, y], [x, y - 1 - r() * 2], [x + l / 2, y + (r() - 0.5) * 2]], 1.2 + k * 2, 0.3, 0.3, 0.15))
          }
        }
        // low mounds of moss and earth along the frame's foot, grass on their crowns: the near ground has a body
        const inkM = P.dark ? mix(P.wash, P['moss-b'], 0.25) : mix(P['moss-b'], P.ink, 0.25)
        for (const [mx2, mw, mh] of [[0.1, 0.22, 0.09], [0.48, 0.2, 0.06], [0.88, 0.24, 0.1]] as const) {
          const cx = W * mx2, cy = H * (tall ? 0.97 : 0.99)
          for (let i = 4; i >= 1; i--) {
            p.fillStyle = rgba(inkM, (P.dark ? 0.2 : 0.11) * (5 - i) * 0.5)
            p.fill(new Path2D(blob(cx, cy, W * mw * (0.6 + i * 0.12), H * mh * (0.6 + i * 0.12), 3640 + i + Math.round(mx2 * 10), 0.18, 22)))
          }
          p.fillStyle = rgba(inkM, P.dark ? 0.75 : 0.45)
          for (let j = 0; j < 26; j++) {
            const x = cx + (r() - 0.5) * W * mw * 1.4, y = cy - H * mh * (0.55 + r() * 0.35), l = H * (0.015 + r() * 0.03)
            p.fill(brush([[x, y], [x + (r() - 0.4) * l * 0.6, y - l]], 1 + r() * 1.2, 0.05, 0.7, 0.15))
          }
        }
        grainOver(p, W, H, P.dark ? 0.4 : 0.3)
        p.restore()
        // grass tufts round the bank
        p.fillStyle = rgba(P.dark ? P.wash : P['moss-b'], P.dark ? 0.6 : 0.4)
        for (let i = 0; i < 180; i++) {
          const a = r() * Math.PI * 2, rr = R * (1.12 + r() * 1.4)
          if (Math.sin(a) < -0.2) continue
          cam.p(Math.cos(a) * rr, 0, Math.sin(a) * rr)
          const x = cam.o[0], y = cam.o[1], l = 3 + (y - gy) * 0.06
          p.fill(brush([[x, y], [x + (r() - 0.5) * l, y - l]], 1 + r(), 0.2, 0.6, 0.2))
        }
        // the bank: wet earth round the water, wider at the near side
        p.beginPath()
        for (let i = 0; i <= 64; i++) {
          const a = (i / 64) * Math.PI * 2
          const rr = R * (1.1 + 0.05 * Math.sin(a * 3 + 1))
          cam.p(Math.cos(a) * rr, 0.02, Math.sin(a) * rr)
          if (i) p.lineTo(cam.o[0], cam.o[1])
          else p.moveTo(cam.o[0], cam.o[1])
        }
        p.closePath()
        p.fillStyle = rgba(P.dark ? mix(P['moss-b'], P.wash, 0.55) : mix(mix(P['moss-b'], P['rock-lo'], 0.5), P.wash, 0.2), P.dark ? 0.95 : 0.55)
        p.fill()
        // pebbles along the bank and in front: a moonlit crown, a dark contact under each
        for (let i = 0; i < 70; i++) {
          const a = r() * Math.PI * 2, rr = R * (1.04 + r() * (r() < 0.6 ? 0.25 : 1.6))
          if (Math.sin(a) < 0.05) continue
          const d = cam.p(Math.cos(a) * rr, 0, Math.sin(a) * rr)
          const x = cam.o[0], y = cam.o[1], k = cam.k(d) * (0.035 + r() * 0.05)
          p.fillStyle = rgba(P.umbra, P.dark ? 0.6 : 0.3)
          p.beginPath(); p.ellipse(x + k * 0.2, y + k * 0.1, k * 1.15, k * 0.3, 0, 0, Math.PI * 2); p.fill()
          p.fillStyle = rgba(mix(P['rock-mid'], P['rock-lo'], r()))
          p.beginPath(); p.ellipse(x, y - k * 0.2, k, k * 0.55, 0, Math.PI, 0); p.ellipse(x, y - k * 0.2, k, k * 0.2, 0, 0, Math.PI); p.fill()
          p.fillStyle = rgba(P.moon, P.dark ? 0.35 : 0.55)
          p.beginPath(); p.ellipse(x - k * 0.3, y - k * 0.5, k * 0.4, k * 0.14, -0.2, 0, Math.PI * 2); p.fill()
        }
        yield
        // the water holds the sky: bright mist at the far bank, the upper sky toward you; the far hills upside down under the bank
        const wpth = waterPath()
        cam.p(0, 0, -R)
        const fy = cam.o[1]
        cam.p(0, 0, R)
        const ny = cam.o[1]
        p.save()
        p.clip(wpth)
        const wg = p.createLinearGradient(0, fy, 0, ny)
        wg.addColorStop(0, skyLow)
        wg.addColorStop(0.5, rgba(P.dark ? mix(P.paper, P.wash, 0.4) : mix(P.water, P.mist, 0.5)))
        wg.addColorStop(1, rgba(P.dark ? mix(P.wash, P.water, 0.5) : mix(P.water, P.wash, 0.1)))
        p.fillStyle = wg
        p.fillRect(0, fy - 2, W, ny - fy + 4)
        p.save()
        p.globalAlpha = P.dark ? 0.55 : 0.4
        p.translate(0, fy * 2)
        p.scale(1, -1)
        p.drawImage(back, 0, 0, back.width, back.height, -W * 0.15, 0, W * 1.3, H)
        p.restore()
        // long soft ripples: thin pale lines, a few, longer toward you
        p.strokeStyle = rgba(P.dark ? P.mist : P.paper, P.dark ? 0.07 : 0.22)
        p.lineWidth = 0.7
        p.beginPath()
        for (let i = 0; i < 26; i++) {
          const t = (i / 26) ** 1.4, y = fy + (ny - fy) * t
          const x = r() * W, len = W * (0.15 + t * 0.5) * (0.5 + r())
          p.moveTo(x - len / 2, y)
          p.lineTo(x + len / 2, y + (r() - 0.5))
        }
        p.stroke()
        p.restore()
        // a dark lip along the far bank, a moonlit one along the near
        p.strokeStyle = rgba(P.dark ? P.wash : P.ink, P.dark ? 0.9 : 0.5)
        p.lineWidth = 2
        p.beginPath()
        for (let i = 0; i <= 32; i++) {
          const a = Math.PI + (i / 32) * Math.PI
          cam.p(Math.cos(a) * R, 0, Math.sin(a) * R)
          if (i) p.lineTo(cam.o[0], cam.o[1])
          else p.moveTo(cam.o[0], cam.o[1])
        }
        p.stroke()
        p.strokeStyle = rgba(P.moon, P.dark ? 0.25 : 0.6)
        p.lineWidth = 1.2
        p.beginPath()
        for (let i = 2; i <= 30; i++) {
          const a = (i / 32) * Math.PI
          cam.p(Math.cos(a) * R, 0.01, Math.sin(a) * R)
          if (i > 2) p.lineTo(cam.o[0], cam.o[1])
          else p.moveTo(cam.o[0], cam.o[1])
        }
        p.stroke()
        // reeds on the far bank, low mist over them and over the near ground
        p.fillStyle = rgba(P.dark ? P.wash : P.ink, P.dark ? 0.8 : 0.42)
        for (let i = 0; i < 30; i++) {
          const a = Math.PI * (1.1 + r() * 0.8)
          cam.p(Math.cos(a) * R * 1.08, 0, Math.sin(a) * R * 1.08)
          const x = cam.o[0], y = cam.o[1], hh2 = hh * (0.03 + r() * 0.04)
          p.fill(brush([[x, y], [x + (r() - 0.4) * hh2 * 0.3, y - hh2]], 1.2, 0.05, 0.7, 0.15))
        }
        mistBand(p, W, fy - hh * 0.006, hh * 0.032, P.dark ? 0.13 : 0.55)
        mistBand(p, W, ny + (H - ny) * 0.15, (H - ny) * 0.12, P.dark ? 0.06 : 0.22)
        mistBand(p, W, ny - (ny - fy) * 0.1, (ny - fy) * 0.25, P.dark ? 0.04 : 0.12)
        yield
        // the near reeds, front left: brushed stems and blades, a seed head or two (painted once, panned per frame)
        const rh = tall ? H * 0.3 : sh * 0.6, rw = rh * 0.5
        reeds.width = Math.round(rw * dpr)
        reeds.height = Math.round(rh * dpr)
        const q = reeds.getContext('2d')!
        q.setTransform(dpr, 0, 0, dpr, 0, 0)
        const inkC = P.dark ? mix(P.wash, P.umbra, 0.3) : mix(P.ink, P['moss-b'], 0.2)
        for (let i = 0; i < 11; i++) {
          const bx = rw * (0.15 + r() * 0.6), top = rh * (0.05 + r() * 0.45), lean = (r() - 0.35) * rw * 0.5
          q.fillStyle = rgba(inkC, 0.55 + r() * 0.4)
          const stem = curve([bx, rh], [bx + lean * 0.3, (rh + top) / 2], [bx + lean, top], 12)
          q.fill(brush(stem, 1.6 + r() * 1.6, 0.02, 0.85, 0.15))
          if (r() < 0.45) {
            // a blade bending away from the stem
            const s0 = stem[Math.floor(4 + r() * 4)], dir = r() < 0.5 ? -1 : 1
            q.fill(brush(curve(s0, [s0[0] + dir * rw * 0.18, s0[1] - rh * 0.12], [s0[0] + dir * rw * 0.32, s0[1] + rh * 0.02], 10), 2.4 + r() * 1.6, 0.05, 0.8, 0.12))
          }
          if (r() < 0.3) {
            q.beginPath()
            q.ellipse(bx + lean, top + rh * 0.03, 2.2, rh * 0.035, lean * 0.004, 0, Math.PI * 2)
            q.fill()
          }
        }
        yield
        // the stones: brushed boulders with a moonlit crown, moss on top
        sprites.length = 0
        for (const st of ST) {
          const d = cam.p(st.x, 0, st.z)
          const k = cam.k(d)
          const w = st.r * 2 * k, hh3 = st.h * k
          const e = document.createElement('canvas')
          const pad = 6
          e.width = Math.round((w + pad * 2) * dpr)
          e.height = Math.round((hh3 + pad * 2) * dpr)
          const g = e.getContext('2d')!
          g.setTransform(dpr, 0, 0, dpr, 0, 0)
          g.translate(pad + w / 2, pad + hh3)
          const { d: dd, top } = rock(w, hh3, 3620 + Math.round(st.x * 10))
          const path = new Path2D(dd)
          const gr = g.createLinearGradient(-w * 0.3, -hh3, w * 0.4, 0)
          gr.addColorStop(0, rgba(P['rock-hi']))
          gr.addColorStop(0.55, rgba(P['rock-mid']))
          gr.addColorStop(1, rgba(mix(P['rock-lo'], P.umbra, 0.3)))
          g.fillStyle = gr
          g.fill(path)
          g.save()
          g.clip(path)
          g.fillStyle = rgba(P.umbra, 0.25)
          for (let i = 0; i < 40; i++) g.fillRect((r() - 0.5) * w, -r() * hh3, 1 + r(), 1 + r())
          // the wet foot, darker where the water laps
          const wet = g.createLinearGradient(0, -hh3 * 0.2, 0, 0)
          wet.addColorStop(0, rgba(P.umbra, 0))
          wet.addColorStop(1, rgba(P.umbra, 0.45))
          g.fillStyle = wet
          g.fillRect(-w, -hh3 * 0.2, w * 2, hh3 * 0.2)
          g.restore()
          g.fillStyle = rgba(P.dark ? P['moss-a'] : P['moss-b'], 0.7)
          g.fill(new Path2D(blob(-w * 0.08, -hh3 * 0.82, w * 0.26, hh3 * 0.08, 3630 + st.x, 0.3)))
          g.fillStyle = rgba(P.dark ? P.wash : P.ink, P.dark ? 0.9 : 0.55)
          g.fill(brush(top.slice(Math.floor(top.length * 0.45)), Math.max(1.4, w * 0.03), 0.2, 0.1, 0.3))
          g.fillStyle = rgba(P.moon, P.dark ? 0.55 : 0.85)
          g.fill(brush(top.slice(Math.floor(top.length * 0.08), Math.floor(top.length * 0.55)), Math.max(1.2, w * 0.022), 0.3, 0.4, 0.15))
          sprites.push(e)
        }
      }
      function mistBand(g: CanvasRenderingContext2D, w: number, y: number, hh: number, a: number) {
        const gr = g.createLinearGradient(0, y - hh, 0, y + hh)
        gr.addColorStop(0, rgba(P.mist, 0))
        gr.addColorStop(0.5, rgba(P.mist, a))
        gr.addColorStop(1, rgba(P.mist, 0))
        g.fillStyle = gr
        g.fillRect(0, y - hh, w, hh * 2)
      }
      /** the moon's screen point for this camera (it sits at infinity, so only the yaw moves it) */
      const mo: [number, number] = [0, 0]
      function moonAt(yw: number): [number, number] {
        cam.p(0, 0, -R)
        mo[0] = x0 + sw * (tall ? 0.7 : 0.58) - yw * W * 0.9
        mo[1] = cam.o[1] - (tall ? H * 0.16 : sh * 0.3)
        return mo
      }

      // ── every frame something moves: the pan, the moon's road, the warm streaks, the stones and their lamps ──
      function frame() {
        if (!c || !W) return
        cam = camAt(yaw)
        c.clearRect(0, 0, W, H)
        // the far world pans less than the pond (it is far): a share of the yaw's shift
        const shift = -yaw * W * 0.9
        c.drawImage(back, 0, 0, back.width, back.height, -(W * 0.15) + shift, 0, W * 1.3, H)
        c.drawImage(pond, 0, 0, pond.width, pond.height, 0, 0, W, H)
        cam.p(0, 0, -R)
        const fy = cam.o[1]
        cam.p(0, 0, R)
        const ny = cam.o[1]
        const mx = moonAt(yaw)[0]
        cam.p(0, 0, 0)
        const cx0 = cam.o[0]
        const wpth = waterPath()
        // on the water only: the moon's road of soft broken glints, wider and longer toward you; the lamps' warm streaks
        c.save()
        c.clip(wpth)
        c.globalCompositeOperation = P.dark ? 'lighter' : 'source-over'
        let ri = 0
        for (let i = 0; i < 70; i++) {
          const t = (i / 70) ** 1.25
          const y = fy + (ny - fy) * t
          if (rnd[ri++ % 400] < 0.24) continue
          const lean = (bend * (1 - gather) * t * t) + (cx0 - mx) * gather * t
          const len = (8 + t * sw * 0.1) * (0.45 + rnd[ri++ % 400])
          const th = 1.4 + t * 4
          const xo = (rnd[ri++ % 400] - 0.5) * (4 + t * sw * 0.05)
          c.globalAlpha = (0.35 + 0.6 * rnd[ri++ % 400]) * (P.dark ? 0.85 : 0.95)
          c.drawImage(GLINT, mx + lean + xo - len / 2, y - th / 2, len, th)
        }
        for (let k = 0; k < ST.length; k++) {
          const st = ST[k]
          if (lit[k] < 0.02) continue
          cam.p(st.x, 0, st.z)
          const sx = cam.o[0]
          const farS = st.z < 0
          const y0 = farS ? Math.max(fy, Math.min(cam.o[1], ny)) + 1 : ny - (ny - fy) * 0.12, y1 = farS ? ny : ny + 2
          for (let i = 0; i < 34; i++) {
            const t = i / 34
            const y = y0 + (y1 - y0) * t
            if (rnd[ri++ % 400] < 0.22) continue
            const x = sx + (cx0 - sx) * gather * t * 0.8 + (rnd[ri++ % 400] - 0.5) * 6
            const len = (6 + t * 30) * (0.5 + rnd[ri++ % 400])
            const th = 1.2 + t * 2.6
            c.globalAlpha = lit[k] * (0.45 + 0.5 * rnd[ri++ % 400])
            c.drawImage(WARM, x - len / 2, y - th / 2, len, th)
          }
        }
        c.globalAlpha = 1
        c.globalCompositeOperation = 'source-over'
        // the stones' dark reflections, only on the water
        for (let k = 0; k < ST.length; k++) {
          const sp = sprites[k]
          if (!sp) continue
          cam.p(ST[k].x, 0, ST[k].z)
          const w = sp.width / dpr, hh = sp.height / dpr
          c.globalAlpha = P.dark ? 0.4 : 0.28
          c.save()
          c.translate(cam.o[0], cam.o[1])
          c.scale(1, -0.6)
          c.drawImage(sp, -w / 2, -hh + 6, w, hh)
          c.restore()
        }
        c.globalAlpha = 1
        c.restore()
        // stones, far first; then their lamps
        const order = ST[1].z > ST[2].z ? [0, 3, 2, 1] : [0, 3, 1, 2]
        for (const k of order) {
          const st = ST[k]
          const d = cam.p(st.x, 0, st.z)
          const kk = cam.k(d)
          const sp = sprites[k]
          if (!sp) continue
          const w = sp.width / dpr, hh = sp.height / dpr
          const x = cam.o[0], y = cam.o[1]
          c.globalAlpha = P.dark ? 0.6 : 0.3
          c.drawImage(SHADOW, x - w * 0.62, y - w * 0.06, w * 1.3, w * 0.16)
          c.globalAlpha = 1
          c.drawImage(sp, x - w / 2, y - hh + 6, w, hh)
          // the lamp on its crown: a small paper lantern, ribbed, pale until it is lit
          const lx = x + st.r * kk * 0.18, ly = y - st.h * kk * 0.95
          const lr = clamp(0.09 * kk, 4, 13)
          if (lit[k] > 0) {
            c.globalAlpha = 0.55 * lit[k]
            c.drawImage(GLOW, lx - lr * 9, ly - lr * 9, lr * 18, lr * 18)
          }
          c.globalAlpha = 1
          c.fillStyle = T.paper
          c.beginPath()
          c.ellipse(lx, ly, lr, lr * 1.3, 0, 0, Math.PI * 2)
          c.fill()
          c.globalAlpha = lit[k]
          c.fillStyle = T.warm
          c.fill()
          c.globalAlpha = 1
          c.strokeStyle = T.edge
          c.lineWidth = 1
          c.stroke()
          c.beginPath()
          for (const v of [-0.6, 0, 0.6]) c.ellipse(lx, ly + v * lr, lr * Math.sqrt(1 - v * v * 0.6), lr * 0.18, 0, 0, Math.PI)
          c.lineWidth = 0.6
          c.stroke()
          c.fillStyle = T.cap
          c.fillRect(lx - lr * 0.6, ly - lr * 1.45, lr * 1.2, lr * 0.3)
          c.fillRect(lx - lr * 0.6, ly + lr * 1.15, lr * 1.2, lr * 0.3)
        }
        // near reeds at the front left, out of focus dark (they pan the most)
        if (reeds.width) {
          const rw = reeds.width / dpr, rh = reeds.height / dpr
          c.drawImage(reeds, x0 + sw * (tall ? -0.06 : 0.0) - yaw * W * 1.6, (tall ? H * 0.72 : ny + (H - ny) * 0.5) - rh, rw, rh)
        }
        // the stone buttons slide with the camera
        stones.forEach((b, k) => {
          const st = ST[k]
          cam.p(st.x, 0, st.z)
          b.style.translate = `${(cam.o[0] - base[k][0]).toFixed(1)}px ${(cam.o[1] - base[k][1]).toFixed(1)}px`
        })
      }
      let stones: HTMLElement[] = []
      let base: [number, number][] = []

      const loop = createLoop(ctx.art, (_, dt) => {
        let busy = false
        const k = still ? 1 : Math.min(1, dt * 4)
        yaw += (yawTo - yaw) * k
        if (Math.abs(yawTo - yaw) > 0.0004) busy = true
        for (let i = 0; i < 4; i++) {
          lit[i] += (litTo[i] - lit[i]) * (still ? 1 : Math.min(1, dt * 2.5))
          if (Math.abs(litTo[i] - lit[i]) > 0.01) busy = true
        }
        if (tBend < 1) {
          tBend = still ? 1 : Math.min(1, tBend + dt / 1.1)
          bend = bendFrom + (bendTo - bendFrom) * ease(tBend)
          busy = true
        }
        gather += (gatherTo - gather) * (still ? 1 : Math.min(1, dt * 1.2))
        if (Math.abs(gatherTo - gather) > 0.005) busy = true
        frame()
        return busy
      }, { essential: true })
      ctx.onCleanup(() => loop.dispose())

      const def = perspectiveCircle(K.perspectives as Perspectives, {
        label: K.label,
        prompt: K.prompt,
        detail: K.insight as Fact,
        sky: false,
        place: (k, _n, g) => {
          geo(g)
          const st = ST[k] ?? ST[0]
          const d = cam.p(st.x, 0, st.z)
          const w = st.r * 2 * cam.k(d)
          return { x: cam.o[0] - x0, y: cam.o[1] + 4, s: clamp(w / bw(), 0.45, 2.6), z: Math.round(cam.o[1]) }
        },
        stone: () => s('g'),
        onHear: (k) => {
          litTo[k] = 1
          cam.p(ST[k].x, 0, ST[k].z)
          bendFrom = bend
          bendTo = cam.o[0] - moonAt(yaw)[0]
          tBend = 0
          if (litTo.every((v) => v === 1)) gatherTo = 1
          loop.start()
        },
        stage: (el, api) => {
          host = el
          cv = h('canvas', { class: 't32c-cv t32-bleed', 'aria-hidden': 'true' })
          el.append(cv)
          let job: ReturnType<typeof sliced> | null = null
          api.onLayout((g) => {
            geo(g)
            if (!cv || !W) return
            dpr = Math.min(devicePixelRatio || 1, low ? 1 : 1.5)
            cv.width = Math.round(W * dpr)
            cv.height = Math.round(H * dpr)
            Object.assign(cv.style, { left: `${-x0}px`, top: '0px', width: `${W}px`, height: `${H}px` })
            c = cv.getContext('2d')!
            c.setTransform(dpr, 0, 0, dpr, 0, 0)
            const p2c = el.closest('.p2c') as HTMLElement | null
            p2c?.classList.toggle('t32c-tall', tall)
            stones = [...el.parentElement!.querySelectorAll<HTMLElement>('.p2c-stone')]
            const c0 = camAt(0)
            base = ST.map((st) => (c0.p(st.x, 0, st.z), [c0.o[0], c0.o[1]] as [number, number]))
            job?.cancel()
            job = sliced(bake(), { sync: ctx.reduced || painted })
            painted = true
            job.done.then(() => frame())
          })
          let painted = false
          // the camera slides round the pond with the pointer (mouse) or a drag (touch); not at low quality / reduced motion
          const root = el.closest('.p2c') as HTMLElement
          const onMove = (e: PointerEvent) => {
            if (still || !W) return
            if (e.pointerType !== 'mouse' && !(e.buttons & 1)) return
            const b = root.getBoundingClientRect()
            yawTo = clamp(((e.clientX - b.left) / b.width - 0.5) * 2, -1, 1) * (6 * Math.PI / 180)
            loop.start()
          }
          root.addEventListener('pointermove', onMove)
          const off = onPrefs(() => {
            const next = palette()
            if (next.key === P.key) return
            P = next
            tones()
            job?.cancel()
            job = sliced(bake(), { sync: true })
            frame()
          })
          return () => {
            job?.cancel()
            off()
            root.removeEventListener('pointermove', onMove)
          }
        },
      })
      ctx.art.classList.add('t32c')
      ctx.art.append(h('p', { class: 'visually-hidden' }, K.art))
      def.mount(ctx)
    },
  }
}
