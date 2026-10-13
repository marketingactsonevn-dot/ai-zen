import './style.css'
import type { StationModule } from '../types'
import { C } from './data'
import { pathScene } from './path'
import { compareScene } from './compare'
import { rulesScene } from './rules'

const S = C.scenes
const station: StationModule = {
  content: C,
  scenes: [
    { label: S.path.label, mount: pathScene },
    { label: S.compare.label, mount: compareScene },
    { label: S.rules.label, mount: rulesScene },
  ],
}
export default station
