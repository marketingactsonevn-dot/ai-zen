// the Part 2 styles (paint.ts pines and lanterns, eyebrows): the scenes no longer pull them in through a shared component
import '../../ui/part2/part2.css'
import raw from '../../content/tram-38.json'
import type { T38 } from './types'

export const C = raw as unknown as T38
