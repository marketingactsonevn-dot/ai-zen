import './style.css'
import type { StationModule } from '../types'
import { C } from './data'
import { teamScene } from './team'
import { gameScene } from './game'
import { compareScene } from './compare'

const S = C.scenes
const station: StationModule = {
  content: C,
  scenes: [
    { label: S.team.label, mount: teamScene },
    { label: S.game.label, mount: gameScene },
    { label: S.compare.label, mount: compareScene },
  ],
}
export default station
