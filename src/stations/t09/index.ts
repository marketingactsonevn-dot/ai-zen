import content from '../../content/tram-09.json'
import type { StationModule } from '../types'
import { pipelineScene } from './pipeline'
import { splatScene } from './splats'
import { inputScene } from './input'
import { modelsScene } from './models'
import './style.css'

const S = content.scenes

const station: StationModule = {
  content: content as unknown as StationModule['content'],
  scenes: [
    { label: S.pipeline.label, mount: pipelineScene },
    { label: S.splats.label, mount: splatScene },
    { label: S.input.label, mount: inputScene },
    { label: S.models.label, mount: modelsScene },
  ],
}
export default station
