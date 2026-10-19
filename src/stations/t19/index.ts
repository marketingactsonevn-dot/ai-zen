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
    { label: S.peaks.label, text: 'bl', mount: peaksScene },
    // audit v3: the launch tide is the context ("why the news comes so fast"), so it comes second, before the fence
    { label: S.tide.label, mount: tideScene },
    { label: S.gate.label, mount: gateScene },
    courtScene(),
    { label: S.stele.label, mount: steleScene },
  ],
}
export default station
