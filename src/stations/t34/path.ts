import './path.css'
import { h, s as svg } from '../../core/dom'
import { sliced } from '../../core/chunk'
import { blob, clamp, rng, stroke, type Pt } from '../../ui/part2/ink'
import { stepPath, type SlotGeo, type PathGeo } from '../../ui/part2/steps'
import type { StepPath } from '../../ui/part2/types'
import type { SceneDef } from '../types'
import { C } from './content'
import { F } from './night'
import { bleedBelow, brush, dprFor, grain, inkLine, layer, mist, mix, moonDisc, mountains, noise, rgba, soft, vgrad, watchTok, type C4, type Tok } from './cv'

const K = C.scenes.path

/*
 * Scene 2 — the path of one asset: seen from high behind the workshop gate (HIGH ~50°), a raked sand garden runs to a
 * lake near the top of the frame; eight shallow hollows make a long S over the sand from near (scale 1) to far (0.35),
 * spaced evenly along the S on the ground so none crowd at its bends. The two dark gate posts cut the lower corners,
 * the crossbeam's shadow lies across the near sand and the workshop's warm light spills between them. Eight stepping
 * stones lie in a loose heap on the near sand; set them in order (tap, drag or number keys): each hops into its hollow,
 * lands with a ring in the sand and the camera takes a step forward. The last one lights the stone lantern standing in
 * the shallows, its light rolls back down the path and its reflection appears on the lake. The component (stepPath)
 * keeps order, drag, keys, aria and the take-away card; this file paints the garden (canvas) and the stones (SVG).
 */

const N = K.steps.steps.length
const KC = 1 / 0.35 - 1 // ground depth so the last hollow is drawn at 0.35 of the first
/** scale of a point u along the path (0 = nearest hollow … 1 = farthest) as seen from the gate */
const kOf = (u: number) => 1 / (1 + KC * u)
/** the S: lateral swing (−1 … 1) */
const sx = (u: number) => Math.sin(1.6 * Math.PI * u - 0.35 * Math.PI) * (1 - 0.15 * u)
const PF = 0.86 // phone: the stones' scale against the component's two-column size

/** an irregular slab outline: a few chipped straight edges between rounded corners (seeded) */
function slab(cx: number, cy: number, rx: number, ry: number, seed: number): string {
  const r = rng(seed)
  const n = 7 + Math.floor(r() * 3)
  const pts: Pt[] = []
  for (let i = 0; i < n; i++) {
    const a = ((i + (r() - 0.5) * 0.6) / n) * Math.PI * 2
    const k = 0.74 + r() * 0.3
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k])
  }
  const f = (p: Pt) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`
  const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
  let d = `M${f(lerp(pts[n - 1], pts[0], 0.82))}`
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n]
    d += `Q${f(p)} ${f(lerp(p, q, 0.18))}L${f(lerp(p, q, 0.82))}`
  }
  return d + 'Z'
}

export function pathScene(): SceneDef {
  return {
    label: K.label,
    mount(ctx) {
      const still = ctx.reduced || ctx.quality === 'low'
      let T: Tok = watchTok(ctx, (t) => {
        T = t
        if (pg) paintAll(pg)
      })
      const far = layer('t34p-cv'), sand = layer('t34p-cv'), lit = layer('t34p-cv t34p-lit'), near = layer('t34p-cv t34p-cv-near')
      const farW = h('div', { class: 't34p-far' }, far.cv, lit.cv)
      const nearW = h('div', { class: 't34p-near' }, near.cv)
      const glow = h('div', { class: 't34p-glow', 'aria-hidden': 'true' })
      const refl = h('div', { class: 't34p-refl', 'aria-hidden': 'true' })
      const back = h('div', { class: 't34p-back', 'aria-hidden': 'true' }, farW, sand.cv, glow, refl)
      const front = h('div', { class: 't34p-front', 'aria-hidden': 'true' }, nearW)

      // geometry shared by the hooks and the painter
      let geo: { w: number; h: number; wide: boolean; hz: number; y0: number; amp: number; size: Pt; us: number[] } | null = null
      let pg: PathGeo | null = null
      let count = 0
      let corners: Pt[] = []
      let centres: Pt[] = []
      let host: HTMLElement | null = null
      /** scale of hollow k (on a phone everything on the path is drawn a little smaller: the stones are ~40 % wide) */
      const kAt = (k: number) => kOf(geo!.us[k]) * (geo!.wide ? 1 : PF)
      /** depth scale for something sitting in hollow k. The component positions with `transform`, which CSS applies
       *  inside `scale`; an outer `translate` of (1 − s) × position puts it back where the component meant. */
      const shrink = (el: HTMLElement, k: number) => {
        const c = corners[k]
        if (!c || !geo) return
        const s = kAt(k)
        el.style.setProperty('scale', s.toFixed(3))
        el.style.setProperty('translate', `${((1 - s) * c[0]).toFixed(1)}px ${((1 - s) * c[1]).toFixed(1)}px`)
        el.classList.toggle('far', s < 0.6)
      }
      /** a point u along the S, o px to its side (o measured at the nearest hollow's scale) */
      const P = (u: number, o = 0): Pt => {
        const g = geo!
        const k = kOf(u)
        return [g.w / 2 + k * (g.amp * sx(u) + o), g.hz + (g.y0 - g.hz) * k]
      }
      /** the hollows evenly spaced along the S on the ground (lateral px vs depth), so the bends do not crowd them */
      function spread(amp: number, depth: number): number[] {
        const M = 240
        const acc = [0]
        for (let i = 1; i <= M; i++) {
          const a = (i - 1) / M, b = i / M
          acc.push(acc[i - 1] + Math.hypot(amp * (sx(b) - sx(a)), depth * (b - a)))
        }
        return Array.from({ length: N }, (_, k) => {
          const want = (acc[M] * k) / (N - 1)
          let i = 1
          while (i < M && acc[i] < want) i++
          return (i - 1 + (want - acc[i - 1]) / (acc[i] - acc[i - 1] || 1)) / M
        })
      }
      /** the words raked beside hollow k (wide), or in the foot band under the garden (phone) */
      function noteAt(k: number) {
        if (!geo || !host) return
        const G = geo
        if (!G.wide) {
          host.style.setProperty('--t34p-nx', '0px')
          host.style.setProperty('--t34p-ny', `${(G.h + 6).toFixed(1)}px`)
          host.style.setProperty('--t34p-nw', `${G.w.toFixed(1)}px`)
          host.style.setProperty('--t34p-na', 'center')
          return
        }
        const [x, y] = centres[Math.max(0, Math.min(N - 1, k))]
        const s = kAt(Math.max(0, Math.min(N - 1, k)))
        const nw = Math.min(400, G.w * 0.3)
        const right = x < G.w * 0.5
        const nx = clamp(right ? x + G.size[0] * s * 0.55 + 18 : x - G.size[0] * s * 0.55 - 18 - nw, 8, G.w - nw - 8)
        host.style.setProperty('--t34p-nx', `${nx.toFixed(1)}px`)
        host.style.setProperty('--t34p-ny', `${(y - 22).toFixed(1)}px`)
        host.style.setProperty('--t34p-nw', `${nw.toFixed(1)}px`)
        host.style.setProperty('--t34p-na', right ? 'left' : 'right')
      }

      const def = stepPath(K.steps as StepPath, {
        label: K.label,
        prompt: K.prompt,
        insight: F(K.insight),
        detail: K.detail,
        slots(g: SlotGeo) {
          const wide = g.row
          // the horizon high in the frame: the near hollow low, the far one a quarter down (phone: higher still)
          const yn = g.h * (wide ? 0.69 : 0.52), yf = g.h * (wide ? 0.25 : 0.15)
          const hz = (yf - 0.35 * yn) / 0.65
          const amp = g.w * (wide ? 0.2 : 0.3)
          geo = { w: g.w, h: g.h, wide, hz, y0: yn, amp, size: g.size, us: spread(amp, amp * 1.35) }
          centres = geo.us.map((u) => P(u))
          corners = centres.map(([x, y]) => [x - g.size[0] / 2, y - g.size[1] / 2] as Pt)
          ctx.art.querySelectorAll<HTMLElement>('.p2s-slot').forEach((el, i) => shrink(el, i))
          ctx.art.querySelectorAll<HTMLElement>('.p2s-stone.placed').forEach((el) => shrink(el, Number(el.querySelector('.p2s-key')?.textContent) - 1))
          noteAt(Math.max(0, count - 1))
          return centres
        },
        pile(g: SlotGeo) {
          // one loose heap on the near sand, clear of the path (phone: two staggered columns under it)
          const r = rng(3460)
          if (g.row) {
            const xs = [0.44, 0.56, 0.68, 0.8, 0.5, 0.62, 0.74, 0.86], ys = [0.835, 0.835, 0.835, 0.835, 0.945, 0.945, 0.945, 0.945]
            return xs.map((x, k) => [g.w * x + (r() - 0.5) * 16, g.h * ys[k] + (r() - 0.5) * 10 - (k % 4 === 1 ? 8 : 0)] as Pt)
          }
          const pts = Array.from({ length: N }, (_, k) => [g.w * (k % 2 ? 0.73 : 0.27) + (r() - 0.5) * 8, g.h * (0.62 + Math.floor(k / 2) * 0.09 + (k % 2) * 0.045)] as Pt)
          // smaller, and put back where the component means them (it moves them by transform, which `scale` scales)
          ctx.art.querySelectorAll<HTMLElement>('.p2s-stone').forEach((el, k) => {
            if (el.classList.contains('placed')) return
            el.style.setProperty('scale', String(PF))
            el.style.setProperty('translate', `${((1 - PF) * (pts[k][0] - g.size[0] / 2)).toFixed(1)}px ${((1 - PF) * (pts[k][1] - g.size[1] / 2)).toFixed(1)}px`)
          })
          return pts
        },
        piece: (i, b) => stone(i, b.w, b.h),
        onPlace(k) {
          count++
          const el = [...ctx.art.querySelectorAll<HTMLElement>('.p2s-stone.placed')].find((x) => x.querySelector('.p2s-key')?.textContent === String(k + 1))
          if (el) {
            shrink(el, k)
            el.style.setProperty('--k', String(N - 1 - k))
            if (!still) {
              el.classList.remove('hop')
              void el.offsetWidth
              el.classList.add('hop')
            }
          }
          const slot = ctx.art.querySelectorAll<HTMLElement>('.p2s-slot')[k]
          slot?.classList.add('land')
          noteAt(k)
          // the camera takes a step forward: the gate slides out faster than the far shore comes in
          back.style.setProperty('--step', String(count))
          front.style.setProperty('--step', String(count))
          if (count === N) {
            back.classList.add('lit')
            ctx.art.querySelector('.t34p')?.classList.add('lit')
          }
        },
        art(g: PathGeo) {
          pg = g
          paintAll(g)
          return []
        },
      })
      def.mount(ctx)
      host = ctx.art.querySelector<HTMLElement>('.p2s')!
      host.classList.add('t34p')
      ctx.art.prepend(back)
      ctx.art.append(front)
      noteAt(0)
      // a wrong stone: the hint is raked at the hollow it was tried on (the next empty one)
      const note = host.querySelector<HTMLElement>('.p2s-note')
      if (note) {
        const mo = new MutationObserver(() => note.classList.contains('wrong') && noteAt(count))
        mo.observe(note, { attributes: true, attributeFilter: ['class'], childList: true, characterData: true })
        ctx.onCleanup(() => mo.disconnect())
      }
      // per-stone tilt so the heap looks scattered, not ranked
      ctx.art.querySelectorAll<HTMLElement>('.p2s-stone').forEach((el, i) => el.style.setProperty('--tilt', `${((((i * 37) % 11) - 5) * 1.3).toFixed(1)}deg`))

      // ── painting (the first time soaks in; later in one go)
      let first = true
      let job: { cancel(): void } | null = null
      ctx.onCleanup(() => job?.cancel())
      let HB = 0
      function paintAll(g: PathGeo) {
        if (!geo) return
        const W = g.w, H = g.h
        const gut = Math.max(0, (back.clientWidth - W) / 2) // the layers bleed past the art by the page gutter (CSS)
        HB = H + bleedBelow(ctx, H)
        const d = dprFor(ctx, 1.75)
        back.style.height = front.style.height = `${HB}px`
        for (const l of [far, sand, lit, near]) l.size(W + gut * 2, HB, d)
        job?.cancel()
        job = sliced((function* () {
          paintFar(W, H, gut)
          yield
          yield* paintSand(W, H, gut)
          yield
          paintNear(W, H, gut)
          paintLit(W, H, gut)
        })(), { sync: ctx.reduced || !first })
        first = false
      }
      const shoreY = () => P(1.07)[1]
      const lampAt = (): [number, number, number] => {
        const [x, y] = P(1.16)
        return [x, y, Math.min(geo!.size[1] * 7 * kOf(1.16), y * 0.86)]
      }

      function paintFar(W: number, H: number, gut: number) {
        const g = far.g, G = geo!
        far.clear()
        g.translate(gut, 0)
        const shore = shoreY()
        const fs = shore - H * (G.wide ? 0.065 : 0.05) // the lake's far shore, high in the frame
        g.fillStyle = vgrad(g, 0, fs, T.dark ? [[0, T.wash, 0], [0.6, T.wash, 0.35], [1, mix(T.paper, T.mist, 0.25), 0.85]] : [[0, T.paper2, 0], [0.6, mix(T.paper2, T.water, 0.2), 0.5], [1, mix(T.paper, T.water, 0.3), 0.85]])
        g.fillRect(-gut, 0, W + gut * 2, fs)
        const mx = W * 0.8, my = Math.max(H * 0.035, fs * 0.32)
        moonDisc(g, T, mx, my, clamp(H * 0.026, 8, 18), 3461, 1, false)
        mountains(g, T, -W * 0.08, W * 1.08, fs + 2, Math.max(26, fs * 0.8), 3462, 6, 0.85)
        mountains(g, T, W * 0.05, W * 0.6, fs + 2, Math.max(16, fs * 0.45), 3463, 3, 0.55)
        // mist over the mountains' feet
        mist(g, T, W * 0.5, fs - 2, W * 0.75, Math.max(8, H * 0.03), T.dark ? 1.4 : 0.8)
        // the lake: pale at the far shore, deeper to the near one; the moon's road in dry strokes; ripples
        g.fillStyle = vgrad(g, fs, shore, T.dark ? [[0, mix(T.water, T.mist, 0.22), 1], [1, T.water, 1]] : [[0, mix(T.water, T.paper, 0.5), 1], [1, mix(T.water, T.paper, 0.1), 1]])
        g.fillRect(-gut, fs, W + gut * 2, shore - fs + 6)
        const r = rng(3464)
        for (let y = fs + 2, i = 0; y < shore; y += 1.6 + (y - fs) * 0.06, i++) {
          const t = (y - fs) / (shore - fs)
          if (noise(i * 0.4, 2) < 0.3) continue
          const ww = (6 + t * W * 0.05) * (0.4 + noise(i * 0.3, 5))
          inkLine(g, [[mx - ww / 2 + (noise(i * 0.2, 8) - 0.5) * 14, y], [mx + ww / 2 + (noise(i * 0.2, 8) - 0.5) * 14, y]], 0.8 + t * 1.6, mix(T.moon, [255, 255, 255, 1], 0.2), (T.dark ? 0.7 : 0.65) * (1 - t * 0.3), 0.3, 0.3, 0.1)
        }
        for (let i = 0; i < 30; i++) {
          const y = fs + (shore - fs) * r(), x = r() * W, l = 20 + r() * 80
          inkLine(g, [[x, y], [x + l, y]], 0.8, T.wash, T.dark ? 0.2 : 0.14, 0.3, 0.3, 0.1)
        }
        // the stone lantern standing in the shallows at the end of the path, unlit, its dark reflection
        const [lx, ly, lh] = lampAt()
        toro(g, lx, ly, lh, false)
        grain(g, -gut, 0, W + gut * 2, shore, T.dark ? 0.05 : 0.07)
      }

      function* paintSand(W: number, H: number, gut: number) {
        const g = sand.g, G = geo!
        sand.clear()
        g.translate(gut, 0)
        const shore = shoreY()
        // the sand, warmer near the gate behind us, a damp line at the shore
        g.beginPath()
        g.moveTo(-gut, shore)
        for (let x = -gut; x <= W + gut; x += 24) g.lineTo(x, shore + Math.sin(x * 0.02) * 1.6 + Math.sin(x * 0.007) * 2.6)
        g.lineTo(W + gut, HB)
        g.lineTo(-gut, HB)
        g.closePath()
        const sandC = T.dark ? mix(T.paper2, T.rockLo, 0.38) : mix(T.paper2, T.card, 0.4)
        g.fillStyle = vgrad(g, shore, HB, [[0, mix(sandC, T.mist, T.dark ? 0.12 : 0.3), 1], [0.5, sandC, 1], [1, mix(sandC, T.lantern, T.dark ? 0.16 : 0.1), 1]])
        g.fill()
        inkLine(g, Array.from({ length: 30 }, (_, i) => [-gut + ((W + gut * 2) * i) / 29, shore + 2 + Math.sin(i * 0.9) * 1.2] as Pt), 2, T.wash, T.dark ? 0.5 : 0.3, 0.05, 0.05, 0.4)
        // shore stones along the water's edge
        const r = rng(3466)
        for (let i = 0; i < (G.wide ? 16 : 8); i++) {
          const x = -gut * 0.5 + r() * (W + gut), y = shore + 2 + r() * 4, rr = 3 + r() * (G.wide ? 7 : 5)
          rock(g, x, y, rr, true)
        }
        // the workshop's warm light spilling forward between the gate posts, and the crossbeam's shadow across it
        soft(g, W / 2, HB * 0.98, W * 0.5, (HB - H * 0.55) * 0.9, T.lantern, T.dark ? 0.3 : 0.2)
        g.fillStyle = vgrad(g, H * 0.97, HB, [[0, T.umbra, 0], [0.35, T.umbra, T.dark ? 0.45 : 0.22], [1, T.umbra, T.dark ? 0.55 : 0.28]])
        g.fillRect(-gut, H * 0.97, W + gut * 2, HB - H * 0.97)
        // the posts' long shadows thrown forward up the sand by the light behind them
        for (const sd of [-1, 1]) {
          const bx = sd < 0 ? -gut * 0.4 + W * 0.02 : W + gut * 0.4 - W * 0.02
          g.beginPath()
          g.moveTo(bx - 18, HB)
          g.lineTo(bx + 18, HB)
          g.lineTo(W / 2 + sd * W * 0.12, H * 0.5)
          g.closePath()
          g.fillStyle = vgrad(g, H * 0.5, HB, [[0, T.umbra, 0], [1, T.umbra, T.dark ? 0.35 : 0.16]])
          g.fill()
        }
        // two mossy rocks the rake lines bend round, each beside the path on the side its swing leaves free
        const rocks: [number, number, number][] = [[0.3, 1, 1.2], [0.72, -1, 1]].map(([u, side, k]) => {
          const kk = kOf(u), r0 = G.size[0] * (G.wide ? 0.36 : 0.24) * k
          return [G.w / 2 + kk * (G.amp * sx(u) + side * (G.size[0] * 1.05 + r0 * 1.7)), G.hz + (G.y0 - G.hz) * kk, r0 * kk]
        })
        yield
        // rake lines along the S, closer, thinner and fainter as they go out (strongly foreshortened from up here)
        const lines = G.wide ? 26 : 15
        const sp = G.size[0] * (G.wide ? 0.13 : 0.16)
        g.lineCap = 'round'
        for (let j = -lines; j <= lines; j++) {
          if (Math.abs(j) < 3) continue // the path itself is smooth
          const o = j * sp
          for (const [dy, c, a, w0] of [[0, T.dark ? T.umbra : T.wash, T.dark ? 0.36 : 0.2, 1.8], [sp * 0.3, T.dark ? T.moon : T.card, T.dark ? 0.12 : 0.75, 1.3]] as [number, C4, number, number][]) {
            let prev: Pt | null = null
            for (let i = 0; i <= 70; i++) {
              const u = -0.35 + (1.45 * i) / 70
              const k = kOf(Math.max(-0.45, u))
              const p = P(u, o + dy)
              if (p[1] < shore + 3) break
              if (prev) {
                g.beginPath()
                g.moveTo(prev[0], prev[1])
                g.lineTo(p[0], p[1])
                g.strokeStyle = rgba(c, a * (0.45 + 0.55 * k))
                g.lineWidth = w0 * (0.35 + 0.65 * k)
                g.stroke()
              }
              prev = p
            }
          }
        }
        for (const [x, y, rr] of rocks) {
          // sand smoothed round the rock, then the rings, squashed by the angle
          g.fillStyle = rgba(sandC)
          g.beginPath()
          g.ellipse(x, y, rr * 2.4, rr * 0.9, 0, 0, Math.PI * 2)
          g.fill()
          for (let k = 0; k < 5; k++) {
            g.beginPath()
            g.ellipse(x, y + rr * 0.05, rr * (1.2 + k * 0.28), rr * (0.42 + k * 0.1), 0, 0, Math.PI * 2)
            g.strokeStyle = rgba(T.dark ? T.umbra : T.wash, T.dark ? 0.3 : 0.16)
            g.lineWidth = 1.4
            g.stroke()
            g.beginPath()
            g.ellipse(x, y + rr * 0.05 + 1.4, rr * (1.2 + k * 0.28), rr * (0.42 + k * 0.1), 0, 0.1, Math.PI - 0.1)
            g.strokeStyle = rgba(T.dark ? T.moon : T.card, T.dark ? 0.08 : 0.6)
            g.lineWidth = 1
            g.stroke()
          }
        }
        yield
        // the hollows: shallow dips with a soft ring of shade, dark on the far lip, catching light on the near one
        for (let i = 0; i < N; i++) {
          const k = kAt(i)
          const [x, y] = centres[i]
          const rx = G.size[0] * 0.56 * k, ry = G.size[1] * 0.62 * k
          soft(g, x, y, rx * 1.3, ry * 1.35, T.umbra, T.dark ? 0.42 : 0.22, 0, 0.45)
          g.beginPath()
          g.ellipse(x, y + ry * 0.08, rx, ry, 0, 0, Math.PI * 2)
          g.fillStyle = vgrad(g, y - ry, y + ry, [[0, mix(sandC, T.umbra, 0.38), 1], [0.7, mix(sandC, T.umbra, 0.08), 1], [1, mix(sandC, T.dark ? T.moon : T.card, 0.3), 1]])
          g.fill()
          g.beginPath()
          g.ellipse(x, y + ry * 0.15, rx, ry, 0, 0.1 * Math.PI, 0.9 * Math.PI)
          g.strokeStyle = rgba(T.dark ? T.moon : T.card, T.dark ? 0.2 : 0.85)
          g.lineWidth = 1.3
          g.stroke()
        }
        // the rocks themselves: moss on top, the moon's rim, shadow thrown toward us, sitting down in the sand
        for (const [x, y, rr] of rocks) rock(g, x, y, rr)
        grain(g, -gut, shore, W + gut * 2, HB - shore, T.dark ? 0.08 : 0.1)
      }

      /** a mossy rock at (x, y): contact AO, a shadow tied to its foot, three tones, moss on top, moon rim, ink edge */
      function rock(g: CanvasRenderingContext2D, x: number, y: number, rr: number, small = false) {
        // the moon (upper right) throws its shadow toward us and left; a tight dark contact where it meets the sand
        soft(g, x - rr * 0.5, y + rr * 0.32, rr * 1.9, rr * 0.5, T.umbra, T.dark ? 0.5 : 0.28, 0.12)
        soft(g, x, y + rr * 0.02, rr * 1.35, rr * 0.36, T.umbra, T.dark ? 0.85 : 0.5, 0, 0.55)
        const d = blob(x, y - rr * 0.42, rr * 1.15, rr * 0.72, Math.round(x * 7 + rr), 0.16, 22)
        const p = new Path2D(d)
        g.fillStyle = vgrad(g, y - rr * 1.15, y + rr * 0.3, [[0, T.rockHi, 1], [0.5, T.rockMid, 1], [1, mix(T.rockLo, T.umbra, 0.35), 1]])
        g.fill(p)
        g.save()
        g.clip(p)
        // the terminator: the shaded flank away from the moon, its edge broken like a brush
        g.fillStyle = rgba(mix(T.rockLo, T.umbra, 0.3), 0.75)
        g.beginPath()
        g.moveTo(x - rr * 1.3, y - rr * 0.3)
        for (let i = 0; i <= 8; i++) g.lineTo(x - rr * 1.3 + i * rr * 0.2, y - rr * (0.25 + 0.18 * noise(x * 0.1 + i * 0.7, rr)))
        g.lineTo(x + rr * 1.3, y + rr * 0.5)
        g.lineTo(x - rr * 1.3, y + rr * 0.5)
        g.fill()
        if (!small) {
          soft(g, x - rr * 0.15, y - rr * 0.95, rr * 0.95, rr * 0.34, T.mossB, 0.9)
          soft(g, x - rr * 0.35, y - rr * 1.0, rr * 0.55, rr * 0.2, T.mossC, 0.8)
        }
        // sand-coloured bounce and a band of dark where it sinks into the sand
        soft(g, x, y + rr * 0.32, rr * 1.2, rr * 0.22, T.umbra, T.dark ? 0.6 : 0.35)
        soft(g, x + rr * 0.2, y + rr * 0.1, rr * 0.8, rr * 0.18, T.lantern, T.dark ? 0.2 : 0.14)
        g.restore()
        brush(g, stroke(Array.from({ length: 9 }, (_, i) => {
          const a = Math.PI * (1.15 + i * 0.09)
          return [x + Math.cos(a) * rr * 1.08 + rr * 0.2, y - rr * 0.42 + Math.sin(a) * rr * 0.7] as Pt
        }), Math.max(1, rr * 0.07), 0.3, 0.3, 0.1), T.dark ? T.moon : T.card, T.dark ? 0.5 : 0.8)
        inkLine(g, [[x - rr * 1.12, y - rr * 0.32], [x - rr * 0.4, y + rr * 0.24], [x + rr * 0.9, y + rr * 0.06]], Math.max(1, rr * 0.07), T.dark ? T.wash : T.ink, T.dark ? 0.8 : 0.55, 0.1, 0.2, 0.3)
      }

      /** a Kasuga stone lantern standing on (x, y), H tall: lit side, shaded side, cap, its reflection in the shallows */
      function toro(g: CanvasRenderingContext2D, x: number, y: number, H: number, lit: boolean) {
        const u = H / 10
        if (!lit) {
          const hi = T.dark ? T.rockHi : T.rockMid, mid = T.dark ? T.rockMid : T.rockLo, lo = mix(T.rockLo, T.umbra, T.dark ? 0.5 : 0.4)
          /** a block with its lit (moon, right) face and its shaded face */
          const block = (x0: number, y0: number, w: number, h: number, side = 0.32) => {
            const gr = g.createLinearGradient(x0, 0, x0 + w, 0)
            gr.addColorStop(0, rgba(lo))
            gr.addColorStop(side, rgba(mid))
            gr.addColorStop(side + 0.02, rgba(hi))
            gr.addColorStop(1, rgba(mix(hi, T.moon, T.dark ? 0.25 : 0.1)))
            g.fillStyle = gr
            g.fillRect(x0, y0, w, h)
          }
          // the reflection in the shallows below, broken by ripples (dark by day, a ghost by night)
          for (let d = 0; d < u * 6; d += 2) {
            if (noise(d * 0.2, 4) < 0.35) continue
            const w = u * (d < u * 1.2 ? 3.4 : d < u * 4 ? 1.1 : 2.6) * (0.8 + noise(d * 0.3, 6) * 0.4)
            g.fillStyle = rgba(T.dark ? T.rockMid : T.wash, (T.dark ? 0.22 : 0.18) * (1 - d / (u * 6)))
            g.fillRect(x - w / 2 + (noise(d * 0.25, 7) - 0.5) * 3, y + 2 + d, w, 1.6)
          }
          soft(g, x, y + u * 0.2, u * 3, u * 0.7, T.umbra, T.dark ? 0.45 : 0.28)
          block(x - u * 1.8, y - u * 1.2, u * 3.6, u * 1.2) // base
          block(x - u * 0.55, y - u * 4.6, u * 1.1, u * 3.4, 0.4) // shaft
          block(x - u * 1.5, y - u * 5.2, u * 3, u * 0.6) // platform
          block(x - u * 1.1, y - u * 7.2, u * 2.2, u * 2) // firebox
          g.beginPath()
          g.moveTo(x - u * 2.4, y - u * 7.0)
          g.quadraticCurveTo(x, y - u * 8.6, x + u * 2.4, y - u * 7.0)
          g.lineTo(x + u * 1.6, y - u * 8.2)
          g.quadraticCurveTo(x, y - u * 9.1, x - u * 1.6, y - u * 8.2)
          g.closePath()
          const cg = g.createLinearGradient(x - u * 2.4, 0, x + u * 2.4, 0)
          cg.addColorStop(0, rgba(lo))
          cg.addColorStop(0.45, rgba(mid))
          cg.addColorStop(1, rgba(mix(hi, T.moon, T.dark ? 0.3 : 0.1)))
          g.fillStyle = cg
          g.fill()
          g.fillStyle = rgba(mid)
          g.fillRect(x - u * 0.25, y - u * 9.8, u * 0.5, u * 0.8)
          const ink = T.dark ? T.wash : T.ink
          inkLine(g, [[x - u * 2.4, y - u * 7.0], [x, y - u * 7.55], [x + u * 2.4, y - u * 7.0]], Math.max(1, u * 0.22), ink, 0.75, 0.1, 0.1, 0.5)
          inkLine(g, [[x - u * 1.8, y], [x - u * 1.8, y - u * 1.2], [x + u * 1.8, y - u * 1.2]], Math.max(0.8, u * 0.14), ink, 0.55, 0.1, 0.1, 0.5)
          inkLine(g, [[x - u * 0.55, y - u * 1.2], [x - u * 0.55, y - u * 4.6]], Math.max(0.8, u * 0.14), ink, 0.55, 0.1, 0.1, 0.5)
          inkLine(g, [[x - u * 1.1, y - u * 5.2], [x - u * 1.1, y - u * 7.2]], Math.max(0.8, u * 0.14), ink, 0.55, 0.1, 0.1, 0.5)
          // the moon's rim on the right edges
          inkLine(g, [[x + u * 2.3, y - u * 7.1], [x + u * 1.55, y - u * 8.15]], Math.max(0.8, u * 0.12), T.dark ? T.moon : T.card, T.dark ? 0.6 : 0.9, 0.1, 0.1, 0.3)
          inkLine(g, [[x + u * 0.5, y - u * 1.3], [x + u * 0.5, y - u * 4.5]], Math.max(0.8, u * 0.1), T.dark ? T.moon : T.card, T.dark ? 0.45 : 0.8, 0.1, 0.1, 0.3)
        }
        // the window: dark, or burning
        g.fillStyle = lit ? rgba(mix(T.lantern, T.moon, 0.4)) : rgba(T.umbra, 0.85)
        g.fillRect(x - u * 0.55, y - u * 6.8, u * 1.1, u * 1.2)
        if (lit) {
          soft(g, x, y - u * 6.2, u * 6, u * 6, T.lantern, T.dark ? 0.55 : 0.4)
          soft(g, x, y - u * 6.2, u * 1.8, u * 1.8, T.lantern, 0.85)
        }
      }

      function paintLit(W: number, H: number, gut: number) {
        // the lantern lit (faded in by CSS when the path is done): its window, its light on the water
        const g = lit.g
        lit.clear()
        g.translate(gut, 0)
        const [lx, ly, lh] = lampAt()
        toro(g, lx, ly, lh, true)
        soft(g, lx, shoreY() - 2, W * 0.14, H * 0.025, T.lantern, T.dark ? 0.4 : 0.28)
        glow.style.transform = `translate3d(${(lx + gut).toFixed(1)}px,${(ly - lh * 0.62).toFixed(1)}px,0)`
        refl.style.transform = `translate3d(${(lx + gut).toFixed(1)}px,${(ly + 2).toFixed(1)}px,0)`
        refl.style.height = `${Math.max(14, shoreY() - ly + 16).toFixed(1)}px`
      }

      function paintNear(W: number, H: number, gut: number) {
        // the gate's two dark posts cutting the lower corners, lit warm on their inner edges, a dark band where bound
        const g = near.g, G = geo!
        near.clear()
        g.translate(gut, 0)
        const pw = clamp(W * 0.05, 26, 64)
        for (const side of [-1, 1]) {
          const x = side < 0 ? -gut * 0.3 - pw * 0.15 : W + gut * 0.3 - pw * 0.85
          const top = H * (G.wide ? 0.5 : 0.66)
          const wood = T.dark ? mix(T.stepLo, T.umbra, 0.62) : mix(T.umbra, T.stepLo, 0.45)
          const gr = g.createLinearGradient(x, 0, x + pw, 0)
          const inner = side < 0 ? 1 : 0
          gr.addColorStop(inner ? 0 : 1, rgba(mix(wood, T.umbra, 0.45)))
          gr.addColorStop(0.5, rgba(wood))
          gr.addColorStop(inner ? 0.9 : 0.1, rgba(mix(wood, T.lantern, T.dark ? 0.4 : 0.3)))
          gr.addColorStop(inner ? 1 : 0, rgba(mix(wood, T.lantern, T.dark ? 0.55 : 0.4)))
          g.fillStyle = gr
          g.beginPath()
          g.moveTo(x + pw * 0.1, top)
          g.lineTo(x + pw * 0.9, top)
          g.lineTo(x + pw * 1.04, HB + 2)
          g.lineTo(x - pw * 0.04, HB + 2)
          g.closePath()
          g.fill()
          const r = rng(3475 + side)
          for (let k = 0; k < 6; k++) {
            const gx = x + pw * (0.15 + r() * 0.7)
            inkLine(g, [[gx, top + r() * 40], [gx + (r() - 0.5) * 3, HB]], 0.9, T.umbra, 0.35, 0.2, 0.1, 0.3)
          }
          inkLine(g, [[x + (inner ? pw * 0.96 : pw * 0.04), top + 8], [x + (inner ? pw * 1.02 : -pw * 0.02), HB]], 1.4, T.dark ? T.lantern : T.card, T.dark ? 0.45 : 0.6, 0.1, 0.05, 0.4)
          g.fillStyle = rgba(T.umbra, 0.5)
          g.fillRect(x, top + (HB - top) * 0.32, pw * 1.02, 5)
        }
      }

      /** a stepping stone seen from above at ~50°: an irregular slab — side band, top face in three tones with moss,
       *  a facet ridge, the gate's warm rim on its near edge, the moon's long shadow and a tight contact shadow */
      function stone(i: number, w: number, hh: number): SVGElement {
        const id = `t34p-s${i}-${Math.round(w)}`
        const r = rng(3470 + i * 7)
        const cx = w / 2, cy = hh * 0.42, rx = w * 0.47, ry = hh * 0.36
        const face = slab(cx, cy, rx, ry, 3470 + i)
        const side = slab(cx + 1, cy + hh * 0.15, rx * 0.99, ry * 1.04, 3470 + i)
        const stop = (o: number, c: string, a = 1) => svg('stop', { offset: o, style: `stop-color:var(${c});stop-opacity:${a}` })
        const moss = r() < 0.75 ? blob(cx - rx * (0.1 + r() * 0.4), cy - ry * 0.35, rx * (0.18 + r() * 0.14), ry * (0.22 + r() * 0.14), 3480 + i, 0.35, 14) : ''
        const moss2 = r() < 0.5 ? blob(cx + rx * (0.2 + r() * 0.3), cy - ry * 0.45, rx * 0.1, ry * 0.14, 3490 + i, 0.4, 10) : ''
        // a facet: the slab breaks along a ridge, the far part tilted away from the moon
        const fx0 = cx - rx * (0.6 + r() * 0.2), fx1 = cx + rx * (0.5 + r() * 0.3)
        const ridge: Pt[] = [[fx0, cy - ry * (0.1 + r() * 0.3)], [cx, cy - ry * (0.05 + r() * 0.2)], [fx1, cy + ry * (0.1 + r() * 0.2)]]
        let grainD = ''
        for (let k = 0; k < 4; k++) {
          const x0 = cx - rx * 0.6 + r() * rx * 1.2, y0 = cy - ry * 0.4 + r() * ry * 0.8
          grainD += stroke([[x0, y0], [x0 + rx * (0.12 + r() * 0.2), y0 + (r() - 0.5) * 3]], 1, 0.3, 0.3, 0.1)
        }
        return svg('g', { class: 't34p-stone' },
          svg('defs', null,
            svg('linearGradient', { id: `${id}-f`, x1: 0.85, y1: 0, x2: 0.2, y2: 1 }, stop(0, '--rock-hi'), stop(0.55, '--rock-mid'), stop(1, '--rock-lo')),
            svg('linearGradient', { id: `${id}-s`, x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, '--rock-lo'), stop(1, '--umbra', 0.95)),
            svg('clipPath', { id: `${id}-c` }, svg('path', { d: face }))),
          // shadow: the moon's long one thrown toward us and left, a tight dark contact under it
          svg('g', { class: 't34p-sh' },
            svg('path', { class: 't34p-sh-l', d: blob(cx - rx * 0.42, cy + hh * 0.36, rx * 1.2, ry * 0.8, 3490 + i, 0.14, 16) }),
            svg('ellipse', { class: 't34p-sh-c', cx: cx + 1, cy: cy + hh * 0.19, rx: rx * 1.02, ry: ry * 0.98 })),
          svg('g', { class: 't34p-body' },
            svg('path', { d: side, fill: `url(#${id}-s)` }),
            svg('path', { d: face, fill: `url(#${id}-f)`, filter: 'url(#ink-rough)' }),
            svg('g', { 'clip-path': `url(#${id}-c)` },
              svg('path', { class: 't34p-facet', d: `M${ridge.map((p) => p.map((v) => v.toFixed(1)).join(' ')).join('L')}L${(cx + rx * 1.2).toFixed(1)} ${(cy - ry * 1.3).toFixed(1)}L${(cx - rx * 1.2).toFixed(1)} ${(cy - ry * 1.3).toFixed(1)}Z` }),
              moss ? svg('path', { class: 't34p-moss', d: moss }) : '',
              moss2 ? svg('path', { class: 't34p-moss t34p-moss-2', d: moss2 }) : '',
              svg('path', { class: 't34p-grain', d: grainD })),
            svg('path', { class: 't34p-ridge', d: stroke(ridge, 1.1, 0.3, 0.3, 0.1) }),
            // the gate's warm light on the near lip, the moon's rim on the far one, an ink edge on the shaded side
            svg('path', { class: 't34p-warm', d: stroke(Array.from({ length: 11 }, (_, k) => {
              const a = Math.PI * (0.14 + k * 0.072)
              return [cx + Math.cos(a) * rx * 0.97, cy + hh * 0.06 + Math.sin(a) * ry] as Pt
            }), 2.2, 0.3, 0.3, 0.1) }),
            svg('path', { class: 't34p-rim', d: stroke(Array.from({ length: 9 }, (_, k) => {
              const a = Math.PI * (1.35 + k * 0.07)
              return [cx + Math.cos(a) * rx * 0.96, cy + Math.sin(a) * ry * 0.96] as Pt
            }), 1.6, 0.3, 0.3, 0.1) }),
            svg('path', { class: 't34p-edge', d: stroke(Array.from({ length: 9 }, (_, k) => {
              const a = Math.PI * (0.62 + k * 0.07)
              return [cx + Math.cos(a) * rx * 1.0, cy + hh * 0.12 + Math.sin(a) * ry * 1.02] as Pt
            }), 1.6, 0.2, 0.3, 0.2), filter: 'url(#ink-rough)' })))
      }
    },
  }
}
