import './style.css'
import type { Fact } from '../../core/content'
import type { StationModule } from '../types'
import { perspectiveCircle } from '../../ui/part2/perspectives'
import { progressTide } from '../../ui/part2/tide'
import type { Perspectives, Tide } from '../../ui/part2/types'
import { C } from './data'
import { gardenersScene } from './gardeners'
import { scalingScene } from './scaling'
import { moatScene } from './moat'
import { flowScene } from './flow'

const S = C.scenes
const station: StationModule = {
  content: C,
  scenes: [
    { label: S.gardeners.label, mount: gardenersScene },
    { label: S.scaling.label, mount: scalingScene },
    { label: S.moat.label, mount: moatScene },
    progressTide(S.goldrush.tide as Tide, { label: S.goldrush.label, prompt: S.goldrush.prompt, insight: S.goldrush.insight as Fact }),
    { label: S.loop.label, mount: flowScene },
    perspectiveCircle(S.loop.perspectives as Perspectives, { label: S.loop.circleLabel }),
  ],
}
export default station
