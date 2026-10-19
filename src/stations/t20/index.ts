import './style.css'
import raw from '../../content/tram-20.json'
import type { StationContent } from '../../core/content'
import type { StationModule } from '../types'
import { vortexScene } from './vortex'
import { masonScene } from './mason'
import { circleScene } from './circle'
import { wellScene } from './well'

const S = raw.scenes

const station: StationModule = {
  content: raw as unknown as StationContent,
  scenes: [
    { label: S.well.label, mount: wellScene },
    { label: S.vortex.label, mount: vortexScene },
    { label: S.mason.label, text: 'br', mount: masonScene },
    circleScene,
  ],
}
export default station
