import './style.css'
import raw from '../../content/tram-21.json'
import type { Fact, StationContent } from '../../core/content'
import type { StationModule } from '../types'
import type { Perspectives, Tide } from '../../ui/part2/types'
import { perspectiveCircle } from '../../ui/part2/perspectives'
import { progressTide } from '../../ui/part2/tide'
import { stringsScene } from './strings'
import { teacupScene } from './teacup'

const S = raw.scenes
const race = progressTide(S.race.tide as Tide, { label: S.race.label, prompt: S.race.prompt, insight: S.race.insight as Fact, detail: S.race.detail as Fact })

const station: StationModule = {
  content: raw as unknown as StationContent,
  scenes: [
    {
      label: race.label,
      mount(ctx) {
        const done = race.mount(ctx)
        ctx.art.querySelector('.p2t-moon')?.setAttribute('aria-label', S.race.moonAria)
        return done
      },
    },
    { label: S.strings.label, mount: stringsScene },
    { label: S.teacup.label, mount: teacupScene },
    perspectiveCircle(S.circle.perspectives as Perspectives, { label: S.circle.label, prompt: S.circle.prompt, detail: S.circle.insight as Fact }),
  ],
}
export default station
