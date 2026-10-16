import './style.css'
import type { StationModule } from '../types'
import { perspectiveCircle } from '../../ui/part2/perspectives'
import { C } from './data'
import { flowersScene } from './flowers'
import { flatteryScene } from './flattery'
import { shortcutScene } from './shortcut'
import { incenseScene } from './incense'
import { diaryArt, withDiary } from './diary'

const S = C.scenes
const station: StationModule = {
  content: C,
  scenes: [
    { label: S.flowers.label, mount: flowersScene },
    { label: S.flattery.label, mount: flatteryScene },
    { label: S.shortcut.label, mount: shortcutScene },
    { label: S.incense.label, mount: incenseScene },
    withDiary(perspectiveCircle(S.diary.perspectives, { label: S.diary.label, prompt: S.diary.prompt, question: S.diary.question, detail: [S.diary.insight, S.diary.detail], art: diaryArt })),
  ],
}
export default station
