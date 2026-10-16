import './style.css'
import { C } from './content'
import type { StationModule } from '../types'
import type { Perspectives, StepPath } from '../../ui/part2/types'
import { stepPath } from '../../ui/part2/steps'
import { perspectiveCircle } from '../../ui/part2/perspectives'
import { F } from './night'
import { marketScene } from './market'
import { creditScene } from './credit'
import { pathArt } from './path'
import { realArt } from './real'

const S = C.scenes

const station: StationModule = {
  content: C,
  scenes: [
    { label: S.market.label, mount: marketScene },
    stepPath(S.path.steps as StepPath, { label: S.path.label, prompt: S.path.prompt, insight: F(S.path.insight), detail: S.path.detail, art: pathArt }),
    { label: S.credit.label, mount: creditScene },
    perspectiveCircle(S.real.perspectives as Perspectives, { label: S.real.label, prompt: S.real.prompt, detail: S.real.detail, art: realArt }),
  ],
}
export default station
