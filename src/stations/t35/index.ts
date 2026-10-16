import { C } from './content'
import type { StationModule } from '../types'
import { ladderScene } from './ladder'
import { scrollScene } from './scroll'
import { moonsScene } from './moons'
import { lineScene } from './line'
import { specScene } from './spec'

const S = C.scenes

const station: StationModule = {
  content: C,
  scenes: [
    { label: S.ladder.label, mount: ladderScene },
    { label: S.scroll.label, mount: scrollScene },
    { label: S.moons.label, mount: moonsScene },
    { label: S.spec.label, mount: specScene },
    { label: S.line.label, mount: lineScene },
  ],
}
export default station
