import './style.css'
import { C } from './content'
import type { StationModule } from '../types'
import { blueprintScene } from './blueprint'
import { pensScene } from './pens'
import { carveScene } from './carve'
import { layersScene } from './layers'
import { vibeScene } from './vibe'

const S = C.scenes

const station: StationModule = {
  content: C,
  scenes: [
    { label: S.blueprint.label, text: 'tr', mount: blueprintScene },
    { label: S.pens.label, mount: pensScene },
    { label: S.carve.label, text: 'br', mount: carveScene },
    { label: S.layers.label, text: 'br', mount: layersScene },
    { label: S.vibe.label, text: 'tl', mount: vibeScene },
  ],
}
export default station
