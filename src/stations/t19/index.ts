import './style.css'
import raw from '../../content/tram-19.json'
import type { StationContent } from '../../core/content'
import type { StationModule } from '../types'
import { courtScene } from './court'
import { gateScene } from './gate'
import { peaksScene } from './peaks'
import { steleScene } from './stele'
import { tideScene } from './tide'

const S = raw.scenes

const station: StationModule = {
  content: raw as unknown as StationContent,
  scenes: [
    { label: S.peaks.label, mount: peaksScene },
    { label: S.gate.label, mount: gateScene },
    courtScene(),
    { label: S.stele.label, mount: steleScene },
    { label: S.tide.label, mount: tideScene },
  ],
}
export default station
