import './style.css'
import raw from '../../content/tram-31.json'
import type { Fact, StationContent } from '../../core/content'
import type { StationModule } from '../types'
import type { StepPath, Tide } from '../../ui/part2/types'
import { progressTide } from '../../ui/part2/tide'
import { stepPath } from '../../ui/part2/steps'
import { wellsScene } from './wells'
import { cardScene } from './card'
import { repoScene } from './repo'

const S = raw.scenes

const station: StationModule = {
  content: raw as unknown as StationContent,
  scenes: [
    { label: S.wells.label, mount: wellsScene },
    progressTide(S.depth.tide as Tide, { label: S.depth.label, prompt: S.depth.prompt, insight: S.depth.insight as Fact, detail: S.depth.detail }),
    { label: S.card.label, mount: cardScene },
    { label: S.repo.label, mount: repoScene },
    stepPath(S.clean.steps as StepPath, { label: S.clean.label, prompt: S.clean.prompt, insight: S.clean.insight as Fact, detail: S.clean.detail as Fact }),
  ],
}
export default station
