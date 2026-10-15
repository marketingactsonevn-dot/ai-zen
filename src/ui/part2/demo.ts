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
  ],
}
export default station
