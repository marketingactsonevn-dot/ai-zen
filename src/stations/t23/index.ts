import './style.css'
import type { StationModule } from '../types'
import { C } from './data'
import { bridgeScene } from './bridge'
import { lotusScene } from './lotus'
import { streamScene } from './stream'
import { circleScene } from './circle'

const S = C.scenes
const station: StationModule = {
  content: C,
  scenes: [
    { label: S.bridge.label, mount: bridgeScene },
    { label: S.lotus.label, mount: lotusScene },
    { label: S.stream.label, mount: streamScene },
    circleScene,
  ],
}
export default station
