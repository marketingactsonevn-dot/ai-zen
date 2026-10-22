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
    { label: S.flowers.label, text: 'bl', mount: flowersScene },
    { label: S.flattery.label, text: 'br', mount: flatteryScene },
    { label: S.shortcut.label, text: 'br', mount: shortcutScene },
    { label: S.incense.label, text: 'tl', mount: incenseScene },
    // insight bottom-left, opposite the answer stele (audit v3 24-5)
    { label: S.diary.label, text: 'bl', mount: diaryScene },
  ],
}
export default station
