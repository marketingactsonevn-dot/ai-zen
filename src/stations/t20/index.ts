import './style.css'
import raw from '../../content/tram-20.json'
import type { Fact, StationContent } from '../../core/content'
import type { StationModule } from '../types'
import type { Perspectives, Tide } from '../../ui/part2/types'
import { perspectiveCircle } from '../../ui/part2/perspectives'
import { progressTide } from '../../ui/part2/tide'
import { vortexScene } from './vortex'
import { masonScene } from './mason'
import { wellArt, wellRing } from './art'

const S = raw.scenes
const well = progressTide(S.well.tide as Tide, { label: S.well.label, prompt: S.well.prompt, insight: S.well.insight as Fact, detail: S.well.detail, aria: S.well.moonAria, art: wellArt })

const station: StationModule = {
  content: raw as unknown as StationContent,
  scenes: [
    well,
    { label: S.vortex.label, mount: vortexScene },
    { label: S.mason.label, mount: masonScene },
    perspectiveCircle(S.circle.perspectives as Perspectives, { label: S.circle.label, prompt: S.circle.prompt, detail: S.circle.insight as Fact, art: wellRing }),
  ],
}
export default station
