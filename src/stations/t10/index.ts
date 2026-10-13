import './style.css'
import type { StationModule } from '../types'
import { C } from './ink'
import { voiceScene } from './voice'
import { consentScene } from './consent'
import { streamScene } from './stream'

const S = C.scenes
const station: StationModule = {
  content: C,
  scenes: [
    { label: S.voice.label, mount: voiceScene },
    { label: S.consent.label, mount: consentScene },
    { label: S.stream.label, mount: streamScene },
  ],
}
export default station
