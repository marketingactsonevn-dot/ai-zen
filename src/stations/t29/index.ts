import './style.css'
import type { Fact } from '../../core/content'
import type { StationModule } from '../types'
import { perspectiveCircle } from '../../ui/part2/perspectives'
import { progressTide } from '../../ui/part2/tide'
import type { Perspectives, Tide } from '../../ui/part2/types'
import { C } from './data'
import { deskScene } from './desk'
import { wellsScene } from './wells'

const S = C.scenes
const station: StationModule = {
  content: C,
  scenes: [
    { label: S.desk.label, mount: deskScene },
    { label: S.wells.label, mount: wellsScene },
    progressTide(S.bill.tide as Tide, { label: S.bill.label, prompt: S.bill.prompt, insight: S.bill.insight as Fact, detail: S.bill.detail as Fact, aria: S.bill.sliderAria }),
    perspectiveCircle(S.refill.perspectives as Perspectives, { label: S.refill.label, prompt: S.refill.prompt, detail: S.refill.insight as Fact }),
  ],
}
export default station
