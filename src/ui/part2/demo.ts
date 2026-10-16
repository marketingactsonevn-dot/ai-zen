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
      // stage3d.ts: a moonlit garden in WebGL — orbit, tap a rock / the lantern / the pine (or Tab to them)
      label: S.ink3d.label,
      mount(ctx) {
        const T = S.ink3d
        ctx.prompt(T.prompt)
        let told = false
        inkStage(ctx, ctx.art, { label: T.aria, hint: T.hint, gyro: true }, function* (k) {
          const tap = (o: THREE.Object3D, i: number) =>
            k.tappable(o, T.taps[i], () => {
              ctx.chime('tap')
              ctx.prompt(T.taps[i])
              if (!told) (told = true), ctx.insight(T.insight as Fact)
            })
          k.backdrop()
          yield
          k.ground({ r: 7.5 })
          k.pond({ at: [1.9, -1.1], r: [2, 1.2] })
          yield
          tap(k.rock({ at: [-2, 0.4], w: 1.7, h: 1.05, seed: 3, moss: 0.75 }), 0)
          tap(k.rock({ at: [-0.7, -1.5], w: 0.8, h: 1.4, d: 0.7, seed: 8, moss: 0.4 }), 1)
          k.rock({ at: [-1.1, 1.5], w: 0.6, h: 0.32, seed: 12, moss: 0.3 })
          yield
          tap(k.toro({ at: [0.4, -2.5], h: 1.6 }), 2)
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
  ],
}
export default station
