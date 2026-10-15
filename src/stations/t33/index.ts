import './style.css'
import raw from '../../content/tram-33.json'
import type { Fact, StationContent } from '../../core/content'
import type { StationModule } from '../types'
import { newsStones } from '../../ui/part2/news'
import { keeperScene } from './keeper'
import { keysScene } from './keys'
import { whisperScene } from './whisper'
import { houseScene } from './house'

const S = raw.scenes

const station: StationModule = {
  content: raw as unknown as StationContent,
  scenes: [
    { label: S.keeper.label, mount: keeperScene },
    { label: S.keys.label, mount: keysScene },
    { label: S.whisper.label, mount: whisperScene },
    { label: S.house.label, mount: houseScene },
    newsStones({ label: S.stones.label, tags: raw.newsTags, prompt: S.stones.prompt, insight: S.stones.insight as Fact, detail: S.stones.detail }),
  ],
}
export default station
