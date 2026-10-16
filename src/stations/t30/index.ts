import './style.css'
import { h } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneDef, StationModule } from '../types'
import { perspectiveCircle } from '../../ui/part2/perspectives'
import { progressTide } from '../../ui/part2/tide'
import type { Perspectives, Tide } from '../../ui/part2/types'
import { C } from './data'
import { gateScene } from './gate'
import { fenceScene } from './fence'
import { copyrightArt, lawsArt } from './art'

const S = C.scenes
const cp = S.copyright
const circle = perspectiveCircle(cp.perspectives as Perspectives, { label: cp.label, prompt: cp.prompt, detail: cp.insight as Fact, art: copyrightArt })
// the circle as it is, plus the court files written into its reading card once every stone has spoken
const copyright: SceneDef = {
  label: cp.label,
  mount: (ctx) => circle.mount({
    ...ctx,
    insight(f, d) {
      const el = ctx.insight(f, d)
      const card = ctx.art.querySelector('.p2c-card')
      if (card && !card.querySelector('.t30c-cases')) card.append(h('div', { class: 't30c-cases gf-new' }, h('p', { class: 'gf-eyebrow' }, cp.casesLabel), ...cp.cases.map((c) => ctx.fact(c as Fact, 'p'))))
      return el
    },
  }),
}

const station: StationModule = {
  content: C,
  scenes: [
    { label: S.gate.label, mount: gateScene },
    { label: S.fence.label, mount: fenceScene },
    progressTide(S.laws.tide as Tide, { label: S.laws.label, prompt: S.laws.prompt, insight: S.laws.insight as Fact, aria: S.laws.sliderAria, art: lawsArt(S.laws.tide.milestones.map((m) => m.label)) }),
    copyright,
  ],
}
export default station
