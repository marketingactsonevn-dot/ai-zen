import './style.css'
import { C } from './content'
import type { StationModule } from '../types'
import { marketScene } from './market'
import { creditScene } from './credit'
import { pathScene } from './path'
import { realScene } from './real'

const S = C.scenes

const station: StationModule = {
  content: C,
  scenes: [
    { label: S.market.label, mount: marketScene },
    pathScene(),
    { label: S.credit.label, mount: creditScene },
    realScene(),
  ],
}
export default station
