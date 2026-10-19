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
    // audit v3 t30 "mạch đề xuất": what models learn from (courts) before the laws, which end on what you must do
    { label: S.copyright.label, mount: copyrightScene },
    { label: S.laws.label, mount: lawsScene },
  ],
}
export default station
