import './style.css'
import type { StationModule } from '../types'
import { perspectiveCircle } from '../../ui/part2/perspectives'
import { stepPath } from '../../ui/part2/steps'
import { C } from './shell'
import { askScene } from './ask'
import { kitScene } from './kit'
import { ensoScene } from './enso'

const S = C.scenes
const station: StationModule = {
  content: C,
  scenes: [
    { label: S.ask.label, mount: askScene },
    { label: S.kit.label, mount: kitScene },
    stepPath(S.path.steps, { label: S.path.label, prompt: S.path.prompt, insight: S.path.insight, cards: S.path.weekCards }),
    perspectiveCircle(S.advice.perspectives, { label: S.advice.label, prompt: S.advice.prompt, detail: S.advice.insight }),
    { label: S.enso.label, mount: ensoScene },
  ],
}
export default station
