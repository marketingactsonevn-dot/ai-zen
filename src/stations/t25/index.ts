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
  // audit v3 t25 order: the familiar first (a kind reply: words), then the signal under the words, then the three layers
  // that gather both, then the voices
  scenes: [
    { label: S.mirror.label, text: 'tl', mount: mirrorScene },
    { label: S.current.label, text: 'br', mount: currentScene },
    { label: S.layers.label, mount: layersScene },
    circleScene,
  ],
}
export default station
