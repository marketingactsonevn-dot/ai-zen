import './style.css'
import { C } from './content'
import type { StationModule } from '../types'
import type { StepPath, Tide } from '../../ui/part2/types'
import { stepPath } from '../../ui/part2/steps'
import { progressTide } from '../../ui/part2/tide'
import { F } from '../t34/night'
import { ladderScene } from './ladder'
import { scrollScene } from './scroll'
import { lineScene } from './line'
import { moonsArt, specArt } from './spec'

const S = C.scenes

const station: StationModule = {
  content: C,
  scenes: [
    { label: S.ladder.label, mount: ladderScene },
    { label: S.scroll.label, mount: scrollScene },
    progressTide(S.moons.tide as Tide, { label: S.moons.label, prompt: S.moons.prompt, insight: F(S.moons.insight), detail: S.moons.detail, valueText: S.moons.sliderAria, art: moonsArt }),
    stepPath(S.spec.steps as StepPath, { label: S.spec.label, prompt: S.spec.prompt, insight: F(S.spec.insight), detail: S.spec.detail, fact: F(S.spec.facts[0]), art: specArt }),
    { label: S.line.label, mount: lineScene },
  ],
}
export default station
