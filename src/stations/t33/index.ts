import raw from '../../content/tram-33.json'
import type { StationContent } from '../../core/content'
import type { StationModule } from '../types'
import { keeperScene } from './keeper'
import { keysScene } from './keys'
import { whisperScene } from './whisper'
import { houseScene } from './house'
import { stonesScene } from './stones'

const S = raw.scenes

const station: StationModule = {
  content: raw as unknown as StationContent,
  scenes: [
    { label: S.keeper.label, mount: keeperScene },
    { label: S.keys.label, mount: keysScene },
    { label: S.whisper.label, mount: whisperScene },
    { label: S.house.label, mount: houseScene },
    { label: S.stones.label, mount: stonesScene },
  ],
}
export default station
