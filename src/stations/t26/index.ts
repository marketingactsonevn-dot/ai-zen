import './style.css'
import C from '../../content/tram-26.json'
import type { StationModule } from '../types'
import { lampsScene } from './lamps'
import { introspectScene } from './introspect'
import { sortScene } from './sort'
import { ruleScene } from './rule'
import { circleScene } from './circle'

const S = C.scenes
const station: StationModule = {
  content: C,
  scenes: [
    { label: S.lamps.label, mount: lampsScene },
    { label: S.introspect.label, mount: introspectScene },
    ruleScene,
    { label: S.rule.sort.label, mount: sortScene },
    circleScene,
  ],
}
export default station
