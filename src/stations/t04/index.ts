import content from '../../content/tram-04.json'
import type { StationModule } from '../types'
import { mountShatter, type ShatterCopy } from './shatter'
import { mountCompare, type CompareCopy } from './compare'
import { mountBowl, type BowlCopy } from './bowl'
import { mountScale, type ScaleCopy } from './scale'
import './style.css'

const S = content.scenes

const station: StationModule = {
  content: content as unknown as StationModule['content'],
  scenes: [
    { label: S.shatter.label, mount: (ctx) => mountShatter(ctx, S.shatter as ShatterCopy) },
    { label: S.compare.label, mount: (ctx) => mountCompare(ctx, S.compare as unknown as CompareCopy) },
    { label: S.bowl.label, mount: (ctx) => mountBowl(ctx, S.bowl as unknown as BowlCopy) },
    { label: S.scale.label, mount: (ctx) => mountScale(ctx, S.scale as ScaleCopy) },
  ],
}
export default station
