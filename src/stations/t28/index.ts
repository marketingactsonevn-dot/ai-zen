import './style.css'
import type { StationModule } from '../types'
import { C } from './data'
import { gardenersScene } from './gardeners'
import { scalingScene } from './scaling'
import { moatScene } from './moat'
import { goldrushScene } from './goldrush'
import { wheelScene } from './wheel'

const S = C.scenes
const station: StationModule = {
  content: C,
  scenes: [
    // audit v3 t28 "mạch đề xuất": the story opens with the gold rush, then why GPUs, why more chips, why NVIDIA stays
    { label: S.goldrush.label, mount: goldrushScene },
    { label: S.gardeners.label, mount: gardenersScene },
    { label: S.scaling.label, text: 'br', mount: scalingScene },
    { label: S.moat.label, text: 'bl', mount: moatScene },
    { label: S.loop.label, mount: wheelScene },
  ],
}
export default station
