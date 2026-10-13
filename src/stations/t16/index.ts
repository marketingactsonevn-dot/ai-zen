import './style.css'
import type { StationModule } from '../types'
import { C } from './data'
import { socketScene } from './socket'
import { tangleScene } from './tangle'
import { stonesScene } from './stones'
import { hiddenScene } from './hidden'

const S = C.scenes
const station: StationModule = {
  content: C,
  scenes: [
    { label: S.socket.label, mount: socketScene },
    { label: S.tangle.label, mount: tangleScene },
    { label: S.stones.label, mount: stonesScene },
    { label: S.hidden.label, mount: hiddenScene },
  ],
}
export default station
