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
    { label: S.gardeners.label, mount: gardenersScene },
    { label: S.scaling.label, mount: scalingScene },
    { label: S.moat.label, mount: moatScene },
    { label: S.goldrush.label, mount: goldrushScene },
    { label: S.loop.label, mount: wheelScene },
    { label: S.loop.circleLabel, mount: voicesScene },
  ],
}
export default station
