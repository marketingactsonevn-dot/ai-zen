import './style.css'
import type { StationModule } from '../types'
import { progressTide } from '../../ui/part2/tide'
import { C } from './data'
import { lanternScene } from './lantern'
import { headsScene } from './heads'
import { layersScene } from './layers'

const S = C.scenes
const station: StationModule = {
  content: C,
  scenes: [
    { label: S.lantern.label, mount: lanternScene },
    { label: S.heads.label, mount: headsScene },
    { label: S.layers.label, mount: layersScene },
    progressTide(S.window.tide, { label: S.window.label, prompt: S.window.prompt, insight: S.window.insight, detail: S.window.detail }),
  ],
}
export default station
