import './style.css'
import type { StationModule } from '../types'
import { C } from './data'
import { scrollScene } from './scroll'
import { mistScene } from './mist'
import { viewsScene } from './views'

const S = C.scenes
const station: StationModule = {
  content: C,
  scenes: [
    { label: S.scroll.label, mount: scrollScene },
    { label: S.future.label, mount: mistScene },
    { label: S.views.label, mount: viewsScene },
  ],
}
export default station
