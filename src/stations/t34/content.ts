import raw from '../../content/tram-34.json'
import type { StationContent } from '../../core/content'

export const C = raw as unknown as StationContent & typeof raw
