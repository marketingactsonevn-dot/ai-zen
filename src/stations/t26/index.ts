import './style.css'
import C from '../../content/tram-26.json'
import type { StationModule } from '../types'
import type { Tide } from '../../ui/part2/types'
import { progressTide } from '../../ui/part2/tide'
import { lampsScene } from './lamps'
import { introspectScene } from './introspect'
import { sortScene } from './sort'
import { ruleArt } from './rule'
import { circleScene } from './circle'

const S = C.scenes
const station: StationModule = {
  content: C,
  scenes: [
    { label: S.lamps.label, mount: lampsScene },
    { label: S.introspect.label, mount: introspectScene },
    progressTide(S.rule.tide as Tide, { label: S.rule.label, prompt: S.rule.prompt, art: ruleArt }),
    { label: S.rule.sort.label, mount: sortScene },
    circleScene,
  ],
}
export default station
