import './style.css'
import C from '../../content/tram-25.json'
import type { StationModule } from '../types'
import type { Perspectives } from '../../ui/part2/types'
import { perspectiveCircle } from '../../ui/part2/perspectives'
import { layersScene } from './layers'
import { currentScene } from './current'
import { mirrorScene } from './mirror'

const S = C.scenes
const station: StationModule = {
  content: C,
  scenes: [
    { label: S.layers.label, mount: layersScene },
    { label: S.current.label, mount: currentScene },
    { label: S.mirror.label, mount: mirrorScene },
    perspectiveCircle(S.circle.perspectives as Perspectives, { label: S.circle.label, prompt: S.circle.prompt, question: S.circle.question }),
  ],
}
export default station
