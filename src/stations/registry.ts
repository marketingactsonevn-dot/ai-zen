import type { StationModule } from './types'

// One lazy chunk per station, found by folder: src/stations/tNN/index.ts is station NN.
// A station without a folder shows as "Đang dựng" on the map.
const found = import.meta.glob<{ default: StationModule }>('./t[0-9][0-9]/index.ts')

export const STATIONS: Partial<Record<number, () => Promise<{ default: StationModule }>>> = {
  ...Object.fromEntries(Object.entries(found).map(([path, load]) => [Number(path.slice(3, 5)), load])),
  // dev only (#/tram/99): every Part 2 component with fake data; dropped from the production build
  ...(import.meta.env.DEV ? { 99: () => import('../ui/part2/demo') } : {}),
}
