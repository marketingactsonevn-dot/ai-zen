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
    // the problem first (one neuron, many meanings), then pulling a concept out and turning it (audit v3 t23)
    { label: S.lotus.label, text: 'tl', mount: lotusScene },
    { label: S.bridge.label, mount: bridgeScene },
    { label: S.stream.label, text: 'bl', mount: streamScene },
    circleScene,
  ],
}
export default station
