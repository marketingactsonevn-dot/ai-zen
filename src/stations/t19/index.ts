import './style.css'
import raw from '../../content/tram-19.json'
import { h } from '../../core/dom'
import type { Fact, StationContent } from '../../core/content'
import type { SceneCtx, SceneDef, StationModule } from '../types'
import type { Perspectives, Tide } from '../../ui/part2/types'
import { newsStones } from '../../ui/part2/news'
import { perspectiveCircle } from '../../ui/part2/perspectives'
import { progressTide } from '../../ui/part2/tide'
import { gateScene } from './gate'
import { steleScene } from './stele'

const S = raw.scenes

/** A shared component scene plus a few station words the component has no slot for. */
function extend(def: SceneDef, after: (ctx: SceneCtx) => void): SceneDef {
  return {
    label: def.label,
    mount(ctx) {
      const done = def.mount(ctx)
      after(ctx)
      return done
    },
  }
}

const peaks = extend(newsStones({ label: S.peaks.label, tags: raw.newsTags, prompt: S.peaks.prompt, insight: S.peaks.insight as Fact, detail: S.peaks.detail as Fact }), (ctx) => {
  ctx.art.querySelector('.p2n-path')?.setAttribute('aria-label', S.peaks.group)
  const head = ctx.art.querySelector('.p2n-head')
  head?.prepend(h('p', { class: 'p2-eyebrow t19-order' }, S.peaks.order))
  ;(ctx.art.querySelector('.p2n') ?? ctx.art).append(h('p', { class: 't19-others' }, S.peaks.othersNote))
})

const tide = extend(progressTide(S.tide.tide as Tide, { label: S.tide.label, prompt: S.tide.prompt, question: S.tide.paceNote, insight: S.tide.insight as Fact, detail: S.tide.detail }), (ctx) => {
  ctx.art.querySelector('.p2t-moon')?.setAttribute('aria-label', S.tide.moonAria)
})

const station: StationModule = {
  content: raw as unknown as StationContent,
  scenes: [
    peaks,
    { label: S.gate.label, mount: gateScene },
    perspectiveCircle(S.gate.perspectives as Perspectives, { label: S.gate.debateTitle }),
    { label: S.stele.label, mount: steleScene },
    tide,
  ],
}
export default station
