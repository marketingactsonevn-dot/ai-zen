import content from '../../content/tram-01.json'
import type { StationModule } from '../types'
import { mountBrain } from './brain'
import { mountLadder, type LadderCopy } from './ladder'
import { mountNextWord, type NextWordCopy } from './nextword'
import './style.css'

const S = content.scenes

const station: StationModule = {
  content: content as unknown as StationModule['content'],
  scenes: [
    { label: S.brain.label, mount: (ctx) => mountBrain(ctx, S.brain) },
    { label: S.ladder.label, mount: (ctx) => mountLadder(ctx, S.ladder as unknown as LadderCopy) },
    { label: S.nextWord.label, mount: (ctx) => mountNextWord(ctx, S.nextWord as unknown as NextWordCopy) },
  ],
}
export default station
