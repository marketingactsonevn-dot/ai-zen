import './style.css'
import type { StationModule } from '../types'
import { C } from './data'
import { deskScene } from './desk'
import { wellsScene } from './wells'
import { billScene } from './bill'
import { refillScene } from './refill'

const S = C.scenes
const station: StationModule = {
  content: C,
  scenes: [
    { label: S.desk.label, mount: deskScene },
    { label: S.wells.label, mount: wellsScene },
    billScene(),
    refillScene(),
  ],
}
export default station
