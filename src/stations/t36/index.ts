import './style.css'
import { C } from './content'
import type { StationModule } from '../types'
import type { Perspectives } from '../../ui/part2/types'
import { perspectiveCircle } from '../../ui/part2/perspectives'
import { blueprintScene } from './blueprint'
import { pensScene } from './pens'
import { carveScene } from './carve'
import { layersScene } from './layers'
import { vibeArt } from './vibe'

const S = C.scenes

const station: StationModule = {
  content: C,
  scenes: [
    { label: S.blueprint.label, mount: blueprintScene },
    { label: S.pens.label, mount: pensScene },
    { label: S.carve.label, mount: carveScene },
    { label: S.layers.label, mount: layersScene },
    perspectiveCircle(S.vibe.perspectives as Perspectives, { label: S.vibe.label, prompt: S.vibe.prompt, detail: S.vibe.detail, art: vibeArt }),
  ],
}
export default station
