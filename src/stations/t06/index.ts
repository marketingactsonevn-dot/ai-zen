import './style.css'
import type { StationModule } from '../types'
import { C } from './ink'
import { lifeScene } from './life'
import { thinkScene } from './think'
import { halluScene } from './hallu'
import { ragScene } from './rag'
import { pondScene } from './pond'

const S = C.scenes
const station: StationModule = {
  content: C,
  scenes: [
    { label: S.life.label, mount: lifeScene },
    { label: S.think.label, mount: thinkScene },
    { label: S.hallu.label, mount: halluScene },
    { label: S.rag.label, mount: ragScene },
    { label: S.pond.label, mount: pondScene },
  ],
}
export default station
