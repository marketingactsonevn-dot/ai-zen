import raw from '../../content/tram-30.json'
import type { StationContent } from '../../core/content'

export const C = raw as unknown as StationContent & typeof raw
