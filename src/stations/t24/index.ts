import './style.css'
import type { StationModule } from '../types'
import { C } from './data'
import { flowersScene } from './flowers'
import { flatteryScene } from './flattery'
import { shortcutScene } from './shortcut'
import { incenseScene } from './incense'
import { diaryScene } from './diary'

const S = C.scenes
const station: StationModule = {
  content: C,
  scenes: [
    { label: S.flowers.label, mount: flowersScene },
    { label: S.flattery.label, mount: flatteryScene },
    { label: S.shortcut.label, mount: shortcutScene },
    { label: S.incense.label, mount: incenseScene },
    { label: S.diary.label, mount: diaryScene },
  ],
}
export default station
