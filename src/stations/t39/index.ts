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
    { label: S.ask.label, mount: askScene },
    { label: S.kit.label, text: 'br', mount: kitScene },
    pathScene,
    adviceScene,
    { label: S.enso.label, mount: ensoScene },
  ],
}
export default station
