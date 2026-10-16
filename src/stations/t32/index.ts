import './style.css'
import raw from '../../content/tram-32.json'
import type { StationContent } from '../../core/content'
import type { StationModule } from '../types'
import { scaleScene } from './scale'
import { tableScene } from './table'
import { lampsScene } from './lamps'
import { scrollScene } from './scroll'
import { firstLamp } from './path'
import { circleScene } from './circle'

const S = raw.scenes

const station: StationModule = {
  content: raw as unknown as StationContent,
  scenes: [
    { label: S.scale.label, mount: scaleScene },
    { label: S.table.label, mount: tableScene },
    { label: S.lamps.label, mount: lampsScene },
    firstLamp(),
    { label: S.scroll.label, mount: scrollScene },
    circleScene(),
  ],
}
export default station
