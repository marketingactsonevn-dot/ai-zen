import './style.css'
import type { StationModule } from '../types'
import { C } from './data'
import { powerScene } from './power'
import { manyScene, oneScene } from './drops'
import { thinkScene } from './think'
import { stonesScene } from './stones'
import { dawnScene } from './dawn'

const S = C.scenes
const station: StationModule = {
  content: C,
  scenes: [
    { label: S.power.label, mount: powerScene },
    { label: S.drops.label, mount: oneScene },
    { label: S.drops.labelMany, mount: manyScene },
    { label: S.think.label, mount: thinkScene },
    { label: S.stones.label, mount: stonesScene },
    { label: S.dawn.label, mount: dawnScene },
  ],
}
export default station
