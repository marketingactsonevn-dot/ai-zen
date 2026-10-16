import './style.css'
import C from '../../content/tram-27.json'
import type { StationModule } from '../types'
import { facesScene } from './faces'
import { lampScene } from './lamp'
import { flatterScene } from './flatter'
import { pathScene } from './path'

const S = C.scenes
const station: StationModule = {
  content: C,
  scenes: [
    { label: S.faces.label, mount: facesScene },
    lampScene,
    { label: S.flatter.label, mount: flatterScene },
    pathScene,
  ],
}
export default station
