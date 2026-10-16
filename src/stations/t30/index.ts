import './style.css'
import type { StationModule } from '../types'
import { C } from './data'
import { gateScene } from './gate'
import { fenceScene } from './fence'
import { lawsScene } from './laws'
import { copyrightScene } from './copyright'

const S = C.scenes

const station: StationModule = {
  content: C,
  scenes: [
    { label: S.gate.label, mount: gateScene },
    { label: S.fence.label, mount: fenceScene },
    { label: S.laws.label, mount: lawsScene },
    { label: S.copyright.label, mount: copyrightScene },
  ],
}
export default station
