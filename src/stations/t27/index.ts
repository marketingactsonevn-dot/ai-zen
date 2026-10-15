import './style.css'
import C from '../../content/tram-27.json'
import type { StationModule } from '../types'
import type { Perspectives, StepPath } from '../../ui/part2/types'
import { perspectiveCircle } from '../../ui/part2/perspectives'
import { stepPath } from '../../ui/part2/steps'
import { F } from '../t25/kit'
import { facesScene } from './faces'
import { flatterScene } from './flatter'

const S = C.scenes
const station: StationModule = {
  content: C,
  scenes: [
    { label: S.faces.label, mount: facesScene },
    perspectiveCircle(S.lamp.perspectives as Perspectives, { label: S.lamp.label, prompt: S.lamp.prompt, question: S.lamp.question, detail: F(S.lamp.insight) }),
    { label: S.flatter.label, mount: flatterScene },
    stepPath(S.path.steps as StepPath, { label: S.path.label, prompt: S.path.prompt, insight: F(S.path.insight) }),
  ],
}
export default station
