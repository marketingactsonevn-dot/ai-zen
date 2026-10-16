import './style.css'
import type { StationModule } from '../types'
import { C } from './data'
import { lanternScene } from './lantern'
import { headsScene } from './heads'
import { layersScene } from './layers'
import { windowScene } from './window'

const S = C.scenes
const station: StationModule = {
  content: C,
  scenes: [
    { label: S.lantern.label, mount: lanternScene },
    { label: S.heads.label, mount: headsScene },
    { label: S.layers.label, mount: layersScene },
    windowScene,
  ],
}
export default station
