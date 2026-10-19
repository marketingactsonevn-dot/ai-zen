import './style.css'
import type { StationModule } from '../types'
import { C } from './data'
import { gardenersScene } from './gardeners'
import { scalingScene } from './scaling'
import { moatScene } from './moat'
import { goldrushScene } from './goldrush'
import { wheelScene } from './wheel'
import { voicesScene } from './voices'

const S = C.scenes
const station: StationModule = {
  content: C,
  scenes: [
    // audit v3 t28 "mạch đề xuất": the story opens with the gold rush, then why GPUs, why more chips, why NVIDIA stays
    { label: S.goldrush.label, mount: goldrushScene },
    { label: S.gardeners.label, mount: gardenersScene },
    { label: S.scaling.label, mount: scalingScene },
    { label: S.moat.label, text: 'br', mount: moatScene },
    { label: S.loop.label, mount: wheelScene },
    { label: S.loop.circleLabel, mount: voicesScene },
  ],
}
export default station
