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
    // credit before the path: the path's "draft cheap, upscale the final one" leans on what a scoop costs
    { label: S.market.label, text: 'bl', mount: marketScene },
    { label: S.credit.label, text: 'tl', mount: creditScene },
    pathScene(),
    realScene(),
  ],
}
export default station
