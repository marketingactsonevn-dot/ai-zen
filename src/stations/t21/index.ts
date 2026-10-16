import './style.css'
import raw from '../../content/tram-21.json'
import type { StationContent } from '../../core/content'
import type { StationModule } from '../types'
import { raceScene } from './race'
import { stringsScene } from './strings'
import { teacupScene } from './teacup'
import { circleScene } from './circle'

const S = raw.scenes

const station: StationModule = {
  content: raw as unknown as StationContent,
  scenes: [
    raceScene,
    { label: S.strings.label, mount: stringsScene },
    { label: S.teacup.label, mount: teacupScene },
    circleScene(),
  ],
}
export default station
