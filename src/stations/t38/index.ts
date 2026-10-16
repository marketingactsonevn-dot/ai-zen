import './style.css'
import type { StationModule } from '../types'
import { C } from './shell'
import { defsScene } from './defs'
import { tideScene } from './tide'
import { forkScene } from './fork'
import { traysScene } from './trays'

const S = C.scenes
const station: StationModule = {
  content: C,
  scenes: [defsScene, tideScene, { label: S.fork.label, mount: forkScene }, { label: S.trays.label, mount: traysScene }],
}
export default station
