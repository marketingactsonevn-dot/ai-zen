import './style.css'
import type { StationModule } from '../types'
import { perspectiveCircle } from '../../ui/part2/perspectives'
import { progressTide } from '../../ui/part2/tide'
import { C } from './shell'
import { forkScene } from './fork'
import { traysScene } from './trays'

const S = C.scenes
const station: StationModule = {
  content: C,
  scenes: [
    perspectiveCircle(S.defs.perspectives, { label: S.defs.label, prompt: S.defs.prompt, detail: S.defs.insight }),
    progressTide(S.tide.tide, { label: S.tide.label, prompt: S.tide.prompt, insight: S.tide.insight, detail: S.tide.detail }),
    { label: S.fork.label, mount: forkScene },
    { label: S.trays.label, mount: traysScene },
  ],
}
export default station
