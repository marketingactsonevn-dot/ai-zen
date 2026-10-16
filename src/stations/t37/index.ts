import './style.css'
import type { StationModule } from '../types'
import { C } from './shell'
import { goalScene } from './goal'
import { labScene } from './lab'
import { fenceScene } from './fence'
import { viewsScene } from './views'

const S = C.scenes
const station: StationModule = {
  content: C,
  scenes: [
    { label: S.goal.label, mount: goalScene },
    { label: S.lab.label, mount: labScene },
    { label: S.fence.label, mount: fenceScene },
    viewsScene,
  ],
}
export default station
