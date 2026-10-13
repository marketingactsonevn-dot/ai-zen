import content from '../../content/tram-05.json'
import type { StationModule } from '../types'
import { mountCut } from './cut'
import { mountSpace } from './space'
import { mountThreads } from './threads'
import { mountOdds } from './odds'
import { mountWrite } from './write'
import './style.css'

const S = content.scenes

/** Trạm 5 — Hành trình một câu hỏi: one scene per stage of the pipeline, all following the question sent in scene 1. */
const station: StationModule = {
  content: content as unknown as StationModule['content'],
  scenes: [
    { label: S.cut.label, mount: mountCut },
    { label: S.space.label, mount: mountSpace },
    { label: S.threads.label, mount: mountThreads },
    { label: S.odds.label, mount: mountOdds },
    { label: S.write.label, mount: mountWrite },
  ],
}
export default station
