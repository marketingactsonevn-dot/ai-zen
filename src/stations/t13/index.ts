import './style.css'
import type { StationModule } from '../types'
import { C } from './data'
import { textScene } from './text'
import { imageScene } from './image'
import { videoScene } from './video'
import { modelScene } from './model3d'
import { agentScene } from './agent'

const S = C.scenes
const station: StationModule = {
  content: C,
  scenes: [
    { label: S.text.label, mount: textScene },
    { label: S.image.label, mount: imageScene },
    { label: S.video.label, mount: videoScene },
    { label: S.model.label, mount: modelScene },
    { label: S.agent.label, mount: agentScene },
  ],
}
export default station
