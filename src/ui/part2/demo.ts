import raw from './demo-data.json'
import type { Fact, StationContent } from '../../core/content'
import type { StationModule } from '../../stations/types'
import type { CodeScroll, NewsFile, Perspectives, StepPath, Takeaway, Tide } from './types'
import { perspectiveCircle } from './perspectives'
import { progressTide } from './tide'
import { stepPath } from './steps'
import { newsStones } from './news'
import { codeScroll } from './code'
import { takeaway } from './takeaway'
import { h } from '../../core/dom'
import { inkStage } from './stage3d'
import { diorama, nightGarden } from './depth'
import { stoneArt } from './ink'
import { toro } from './paint'
import { guide } from './guide'
import { s } from '../../core/dom'
import type * as THREE from 'three'

/** Dev-only station #/tram/99 (registry.ts): every B.7 component with fake data, to try them by hand. */
const C = raw as unknown as StationContent & typeof raw
const S = C.scenes

const station: StationModule = {
  content: C,
  scenes: [
    perspectiveCircle(S.circle.perspectives as Perspectives, { label: S.circle.label, question: S.circle.question, detail: S.circle.detail }),
    progressTide(S.tide.tide as Tide, { label: S.tide.label, question: S.tide.question, insight: S.tide.insight as Fact }),
    stepPath(S.path.steps as StepPath, { label: S.path.label, question: S.path.question, insight: S.path.insight as Fact, card: S.path.card as Takeaway }),
    newsStones({ label: S.news.label, tags: S.news.tags, insight: S.news.insight as Fact }, S.news.file as NewsFile),
    {
      label: S.code.label,
      mount(ctx) {
        // codeScroll + two takeaway cards, side by side on wide screens; the insight carries a ◇ company claim
        ctx.art.append(h('div', { style: 'position:absolute;inset:0;display:flex;flex-wrap:wrap;gap:20px;overflow:auto;align-content:flex-start;justify-content:center;padding:4px' },
          h('div', { style: 'flex:1 1 380px;max-width:640px;min-height:0;max-height:100%;display:flex' }, codeScroll(S.code.scroll as CodeScroll, { title: S.code.fileName })),
          h('div', { style: 'flex:1 1 300px;max-width:420px;display:grid;gap:16px;align-content:start' }, takeaway(S.code.card as Takeaway), takeaway(S.code.command as Takeaway))))
        ctx.insight(S.code.insight as Fact)
      },
    },
    {
      // stage3d.ts: a moonlit garden in WebGL — orbit (drag, keys, wheel, pinch), tap a rock / the lantern / the pine (or Tab
      // to them): the camera flies to it and its name rides above it (k.fly, k.label); let go of a drag and it drifts back (view.home)
      label: S.ink3d.label,
      mount(ctx) {
        const T = S.ink3d
        ctx.prompt(T.prompt)
        let told = false
        let tag: HTMLElement | null = null
        const views: [number, number][] = [[0.35, 0.3], [0.1, 0.36], [-0.05, 0.3], [-0.4, 0.26]] // yaw, pitch to look at each
        inkStage(ctx, ctx.art, { label: T.aria, hint: T.hint, gyro: true, view: { home: true } }, function* (k) {
          const tap = (o: THREE.Object3D, i: number) =>
            k.tappable(o, T.taps[i], () => {
              ctx.chime('tap')
              ctx.prompt(T.taps[i])
              tag?.remove()
              tag = k.label(o, h('p', null, T.taps[i]), [0, 0.15, 0])
              k.fly([o.position.x, 0.9, o.position.z], ...views[i])
              if (!told) (told = true), ctx.insight(T.insight as Fact)
            })
          k.backdrop({ moonRise: 4 })
          yield
          k.ground({ r: 7.5 })
          k.pond({ at: [1.25, -1.05], r: [2.1, 1.25] })
          yield
          tap(k.rock({ at: [-2, 0.4], w: 1.7, h: 1.05, seed: 3, moss: 0.75 }), 0)
          tap(k.rock({ at: [-0.7, -1.5], w: 0.8, h: 1.4, d: 0.7, seed: 8, moss: 0.4 }), 1)
          k.rock({ at: [-1.1, 1.5], w: 0.6, h: 0.32, seed: 12, moss: 0.3 })
          yield
          const lamp = k.toro({ at: [0.4, -2.5], h: 1.6 })
          tap(lamp, 2)
          k.stones([-0.2, 4.3], [0.9, 0.7], 5, { size: 0.72, seed: 4 })
          yield
          tap(k.pine({ at: [3.7, -2.3], h: 3.2, lean: -1, seed: 5 }), 3)
          k.bamboo({ at: [-3.9, -2.7], n: 6, h: 3.6, seed: 2 })
        })
      },
    },
    {
      // depth.ts: the same night as a 2.5D paper diorama (no WebGL) — move the pointer, drag, or tilt the phone
      label: S.diorama.label,
      mount(ctx) {
        ctx.prompt(S.diorama.prompt)
        diorama(ctx, ctx.art, { ...nightGarden(), label: S.diorama.aria, gyro: true })
      },
    },
    // the components' station hooks (README §1, §2, §6): same data, each laid out in its own place
    {
      // progressTide + track: the moon's reflection slides along a zig-zag bridge and brightens as it nears today
      label: S.hooks.tide,
      mount(ctx) {
        const glint = s('ellipse', { rx: 20, ry: 7, style: 'fill:var(--moon)' })
        return progressTide(S.tide.tide as Tide, {
          label: S.hooks.tide, question: S.tide.question, insight: S.tide.insight as Fact,
          track: (g) => {
            const pts = g.xs.map((x, i) => [x, g.h * (i % 2 ? 0.28 : 0.6)] as [number, number])
            return (t) => {
              const u = t * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(u)), f = u - i
              return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f]
            }
          },
          thumb: () => glint,
          onStep: (_i, t) => void (glint.style.opacity = (0.45 + 0.55 * t).toFixed(2)),
        }).mount(ctx)
      },
    },
    {
      // guide.ts H1–H7: drag the stone along the ticked groove (dot, track) into the dashed ring (drop), the count goes up;
      // hold the lantern (hold ring) — stand still 6 s and every mark invites (.is-idle from the frame)
      label: S.guide.label,
      mount(ctx) {
        const G = S.guide
        const g = guide(ctx)
        const step = g.steps(G.steps)
        step(0)
        const stone = h('div', { style: 'position:absolute;left:0;top:0;width:110px;height:70px;touch-action:none;cursor:grab' },
          s('svg', { viewBox: '-60 -70 120 80', width: 110, height: 70, 'aria-hidden': 'true' }, stoneArt(92, 58, 7)))
        const lamp = h('div', { style: 'position:absolute;width:70px;height:110px' }, s('svg', { viewBox: '-40 -110 80 115', width: 70, height: 110, 'aria-hidden': 'true' }, toro(0, 0, 100, false)))
        ctx.art.append(stone, lamp)
        let W = 0, H = 0, x = 0, a: [number, number] = [0, 0], b: [number, number] = [0, 0]
        const put = () => (stone.style.transform = `translate(${x - 55}px, ${a[1] - 50}px)`)
        const ro = new ResizeObserver(() => {
          W = ctx.art.clientWidth
          H = ctx.art.clientHeight
          a = [W * 0.18, H * 0.62]
          b = [W * 0.72, H * 0.62]
          x = a[0]
          put()
          lamp.style.transform = `translate(${W * 0.86 - 35}px, ${H * 0.62 - 100}px)`
          g.refresh()
        })
        ro.observe(ctx.art)
        ctx.onCleanup(() => ro.disconnect())
        const dot = g.dot(stone, { dir: [1, 0], label: G.dot })
        const way = g.track(() => [[a[0], a[1] + 20], [b[0], b[1] + 20]], { labels: G.ticks })
        const ring = g.drop(() => b, { w: 130, h: 80 })
        const count = g.count(G.count, 1, () => [W * 0.45, H * 0.2])
        const hold = g.gesture('hold', lamp, { r: 46 })
        stone.addEventListener('pointerdown', (e) => {
          stone.setPointerCapture(e.pointerId)
          ring.lift(true)
          const x0 = e.clientX - x
          const move = (ev: PointerEvent) => {
            x = Math.max(a[0], Math.min(b[0], ev.clientX - x0))
            put()
            way.set((x - a[0]) / (b[0] - a[0]))
          }
          const up = () => {
            stone.removeEventListener('pointermove', move)
            ring.lift(false)
            if (b[0] - x < 30) {
              ring.hit(), dot.done(), way.done(), count.set(1), g.ok(stone), step(2)
              dot.at(lamp)
            } else g.wrong(G.wrong, stone)
          }
          stone.addEventListener('pointermove', move)
          stone.addEventListener('pointerup', up, { once: true })
        })
        // the ring fills by a CSS transition while pressed (no frame loop); 1.2 s held = lit
        let held = 0
        lamp.addEventListener('pointerdown', () => {
          hold.fill(1)
          held = window.setTimeout(() => (hold.done(), ctx.insight(G.insight)), 1200)
        })
        lamp.addEventListener('pointerup', () => (clearTimeout(held), hold.fill(0)))
        ctx.onCleanup(() => clearTimeout(held))
        g.gesture('rotate', () => [W * 0.18, H * 0.3], { r: 34 })
      },
    },
    {
      // perspectiveCircle + stage/place/stone: the night garden diorama behind, the views as lanterns along an arc in front
      label: S.hooks.circle,
      mount(ctx) {
        return perspectiveCircle(S.circle.perspectives as Perspectives, {
          label: S.hooks.circle, question: S.circle.question, detail: S.circle.detail,
          stage: (host) => diorama(ctx, host, { ...nightGarden(), floor: false }).dispose,
          place: (k, n, g) => ({ x: g.w * (0.18 + (0.64 * k) / Math.max(1, n - 1)), y: g.h * (0.8 - 0.1 * Math.sin((Math.PI * k) / Math.max(1, n - 1))), s: 1.3 }),
          stone: () => toro(0, 0, 66, true),
          onHear: (k) => void (ctx.art.dataset.heard = String(k)),
        }).mount(ctx)
      },
    },
    {
      // stepPath + slots/pile/piece: the path climbs the right side, the loose stones wait in a column on the left
      label: S.hooks.path,
      mount(ctx) {
        return stepPath(S.path.steps as StepPath, {
          label: S.hooks.path, question: S.path.question, insight: S.path.insight as Fact, card: S.path.card as Takeaway,
          // headroom over the top slot for the lantern at the path's end
          slots: ({ w, h: H, n, size, top }) => Array.from({ length: n }, (_, i) => [w - size[0] * 0.6 - (i % 2) * size[0] * 0.12, top + size[1] * 2 + ((n - i - 0.5) * (H - top - size[1] * 2 - 40)) / n] as [number, number]),
          pile: ({ h: H, n, size, top }) => Array.from({ length: n }, (_, k) => [size[0] * 0.6, top + ((k + 0.5) * (H - top - 40)) / n] as [number, number]),
          piece: (_i, g) => s('g', { transform: `translate(${g.w / 2} ${g.h})` }, stoneArt(g.w * 0.96, g.h * 0.92, g.seed)),
          onPlace: (k) => void (ctx.art.dataset.placed = String(k)),
        }).mount(ctx)
      },
    },
  ],
}
export default station
