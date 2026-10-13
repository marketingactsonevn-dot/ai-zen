import './style.css'
import type { StationModule } from '../types'
import { C } from './data'
import { mapScene } from './map'
import { gateScene } from './gate'
import { ladderScene } from './ladder'
import { compareScene } from './compare'

const S = C.scenes
const station: StationModule = {
  content: C,
  scenes: [
    { label: S.map.label, mount: mapScene },
    { label: S.gate.label, mount: gateScene },
    { label: S.ladder.label, mount: ladderScene },
    { label: S.compare.label, mount: compareScene },
  ],
}
export default station
