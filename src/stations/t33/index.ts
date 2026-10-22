import raw from '../../content/tram-33.json'
import type { StationContent } from '../../core/content'
import type { StationModule } from '../types'
import { keeperScene } from './keeper'
import { keysScene } from './keys'
import { whisperScene } from './whisper'
import { houseScene } from './house'

const S = raw.scenes

const station: StationModule = {
  content: raw as unknown as StationContent,
  scenes: [
    // audit v2 B.5: the agent's parts before its keys (keeper → house → keys → letter)
    { label: S.keeper.label, text: 'tr', mount: keeperScene },
    { label: S.house.label, text: 'tr', mount: houseScene },
    { label: S.keys.label, mount: keysScene },
    { label: S.whisper.label, mount: whisperScene },
  ],
}
export default station
