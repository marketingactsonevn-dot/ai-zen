import './style.css'
import type { StationModule } from '../types'
import { C } from './kit'
import { blockScene } from './block'
import { glitchScene } from './glitch'
import { conceptsScene } from './concepts'
import { modelsScene } from './models'
import { promptScene } from './prompt'
import { soraScene } from './sora'

const S = C.scenes
const station: StationModule = {
  content: C,
  scenes: [
    { label: S.block.label, mount: blockScene },
    { label: S.glitch.label, mount: glitchScene },
    { label: S.concepts.label, mount: conceptsScene },
    { label: S.models.label, mount: modelsScene },
    { label: S.prompt.label, mount: promptScene },
    { label: S.sora.label, mount: soraScene },
  ],
}
export default station
