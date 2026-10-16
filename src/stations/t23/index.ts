import './style.css'
import type { StationModule } from '../types'
import { perspectiveCircle } from '../../ui/part2/perspectives'
import { C } from './data'
import { bridgeScene } from './bridge'
import { lotusScene } from './lotus'
import { streamScene } from './stream'
import { circleStones } from './circle'
import { withStones } from '../t22/kit'

const S = C.scenes
const station: StationModule = {
  content: C,
  scenes: [
    { label: S.bridge.label, mount: bridgeScene },
    { label: S.lotus.label, mount: lotusScene },
    { label: S.stream.label, mount: streamScene },
    withStones(perspectiveCircle(S.circle.perspectives, { label: S.circle.label, prompt: S.circle.prompt, question: S.circle.question, detail: S.circle.insight }), circleStones),
  ],
}
export default station
