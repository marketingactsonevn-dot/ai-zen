import './style.css'
import C from '../../content/tram-26.json'
import type { StationModule } from '../types'
import type { Perspectives, Tide } from '../../ui/part2/types'
import { perspectiveCircle } from '../../ui/part2/perspectives'
import { progressTide } from '../../ui/part2/tide'
import { lampsScene } from './lamps'
import { introspectScene } from './introspect'
import { sortScene } from './sort'

const S = C.scenes
const station: StationModule = {
  content: C,
  scenes: [
    { label: S.lamps.label, mount: lampsScene },
    { label: S.introspect.label, mount: introspectScene },
    progressTide(S.rule.tide as Tide, { label: S.rule.label, prompt: S.rule.prompt }),
    { label: S.rule.sort.label, mount: sortScene },
    perspectiveCircle(S.circle.perspectives as Perspectives, { label: S.circle.label, prompt: S.circle.prompt, question: S.circle.question }),
  ],
}
export default station
