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
    // one concrete skill first, then how a good run becomes one, then how far to automate, where you approve, and
    // last that a skill travels between tools (audit v2 B: the station opened with five terms at once)
    { label: S.scroll.label, mount: scrollScene },
    { label: S.spec.label, mount: specScene },
    { label: S.ladder.label, text: 'tr', mount: ladderScene },
    { label: S.line.label, text: 'br', mount: lineScene },
    { label: S.moons.label, mount: moonsScene },
  ],
}
export default station
