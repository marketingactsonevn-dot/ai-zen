import './style.css'
import type { StationModule } from '../types'
import { C } from './data'
import { diffuseScene } from './diffuse'
import { chatScene } from './chat'
import { stonesScene } from './stones'
import { modelsScene } from './models'
import { recipeScene } from './recipe'

const S = C.scenes
const station: StationModule = {
  content: C,
  scenes: [
    { label: S.diffuse.label, mount: diffuseScene },
    { label: S.chat.label, mount: chatScene },
    { label: S.concepts.label, mount: stonesScene },
    { label: S.models.label, mount: modelsScene },
    { label: S.recipe.label, mount: recipeScene },
  ],
}
export default station
