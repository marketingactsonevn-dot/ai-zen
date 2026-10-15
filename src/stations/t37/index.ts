import './style.css'
import type { StationModule } from '../types'
import { perspectiveCircle } from '../../ui/part2/perspectives'
import { C } from './shell'
import { goalScene } from './goal'
import { labScene } from './lab'
import { fenceScene } from './fence'

const S = C.scenes
const station: StationModule = {
  content: C,
  scenes: [
    { label: S.goal.label, mount: goalScene },
    { label: S.lab.label, mount: labScene },
    { label: S.fence.label, mount: fenceScene },
    perspectiveCircle(S.views.perspectives, { label: S.views.label, prompt: S.views.prompt, detail: S.views.insight }),
  ],
}
export default station
