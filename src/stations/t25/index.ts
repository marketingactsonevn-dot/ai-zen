import './style.css'
import C from '../../content/tram-25.json'
import type { StationModule } from '../types'
import { layersScene } from './layers'
import { currentScene } from './current'
import { mirrorScene } from './mirror'
import { circleScene } from './circle'

const S = C.scenes
const station: StationModule = {
  content: C,
  scenes: [
    { label: S.layers.label, mount: layersScene },
    { label: S.current.label, mount: currentScene },
    { label: S.mirror.label, mount: mirrorScene },
    circleScene,
  ],
}
export default station
