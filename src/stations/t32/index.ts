import './style.css'
import raw from '../../content/tram-32.json'
import type { Fact, StationContent } from '../../core/content'
import type { StationModule } from '../types'
import type { Perspectives, StepPath } from '../../ui/part2/types'
import { perspectiveCircle } from '../../ui/part2/perspectives'
import { stepPath } from '../../ui/part2/steps'
import { scaleScene } from './scale'
import { tableScene } from './table'
import { lampsScene } from './lamps'
import { scrollScene } from './scroll'
import { firstLampArt } from './path'

const S = raw.scenes

const station: StationModule = {
  content: raw as unknown as StationContent,
  scenes: [
    { label: S.scale.label, mount: scaleScene },
    { label: S.table.label, mount: tableScene },
    { label: S.lamps.label, mount: lampsScene },
    stepPath(S.lamps.steps as StepPath, { label: S.lamps.stepsLabel, prompt: S.lamps.stepsPrompt, art: firstLampArt }),
    { label: S.scroll.label, mount: scrollScene },
    perspectiveCircle(S.circle.perspectives as Perspectives, { label: S.circle.label, prompt: S.circle.prompt, detail: S.circle.insight as Fact }),
  ],
}
export default station
