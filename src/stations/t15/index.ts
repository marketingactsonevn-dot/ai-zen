import './style.css'
import type { StationModule } from '../types'
import { C } from './data'
import { autonomyScene } from './autonomy'
import { kindsScene } from './kinds'
import { simScene } from './sim'

const S = C.scenes
const station: StationModule = {
  content: C,
  scenes: [
    { label: S.autonomy.label, mount: autonomyScene },
    { label: S.kinds.label, mount: kindsScene },
    { label: S.sim.label, mount: simScene },
  ],
}
export default station
