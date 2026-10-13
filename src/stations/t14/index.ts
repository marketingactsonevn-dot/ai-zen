import './style.css'
import type { StationModule } from '../types'
import { C } from './data'
import { jarScene } from './jar'
import { anatomyScene } from './anatomy'
import { loopScene } from './loop'

const station: StationModule = {
  content: C,
  scenes: [jarScene, anatomyScene, loopScene],
}
export default station
