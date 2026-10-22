import type { StationModule } from '../types'
import { C } from './shell'
import { askScene } from './ask'
import { kitScene } from './kit'
import { pathScene } from './path'
import { adviceScene } from './advice'
import { ensoScene } from './enso'

const S = C.scenes
const station: StationModule = {
  content: C,
  scenes: [
    { label: S.ask.label, text: 'br', mount: askScene },
    { label: S.kit.label, text: 'br', mount: kitScene },
    // "learning that lasts" is the ground of week 1, so it comes before the 30-day path (audit v2 B.5)
    adviceScene,
    pathScene,
    { label: S.enso.label, mount: ensoScene },
  ],
}
export default station
