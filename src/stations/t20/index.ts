import './style.css'
import raw from '../../content/tram-20.json'
import type { Fact, StationContent } from '../../core/content'
import type { StationModule } from '../types'
import type { Perspectives, Tide } from '../../ui/part2/types'
import { perspectiveCircle } from '../../ui/part2/perspectives'
import { progressTide } from '../../ui/part2/tide'
import { vortexScene } from './vortex'
import { masonScene } from './mason'

const S = raw.scenes
const well = progressTide(S.well.tide as Tide, { label: S.well.label, prompt: S.well.prompt, insight: S.well.insight as Fact, detail: S.well.detail, aria: S.well.moonAria })

const station: StationModule = {
  content: raw as unknown as StationContent,
  scenes: [
    {
      label: well.label,
      mount(ctx) {
        const done = well.mount(ctx)
        ctx.art.querySelector('.p2t-moon')?.setAttribute('aria-label', S.well.moonAria)
        return done
      },
    },
    { label: S.vortex.label, mount: vortexScene },
    { label: S.mason.label, mount: masonScene },
    perspectiveCircle(S.circle.perspectives as Perspectives, { label: S.circle.label, prompt: S.circle.prompt, detail: S.circle.insight as Fact }),
  ],
}
export default station
