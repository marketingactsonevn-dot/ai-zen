import './style.css'
import C from '../../content/tram-27.json'
import type { StationModule } from '../types'
import type { StepPath } from '../../ui/part2/types'
import { stepPath } from '../../ui/part2/steps'
import { F } from '../t25/kit'
import { facesScene } from './faces'
import { flatterScene } from './flatter'
import { lampScene } from './lamp'
import { pathArt } from './path'

const S = C.scenes
const station: StationModule = {
  content: C,
  scenes: [
    { label: S.faces.label, mount: facesScene },
    lampScene,
    { label: S.flatter.label, mount: flatterScene },
    stepPath(S.path.steps as StepPath, { label: S.path.label, prompt: S.path.prompt, insight: F(S.path.insight), art: pathArt }),
  ],
}
export default station
