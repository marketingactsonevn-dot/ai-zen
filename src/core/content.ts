import site from '../content/site.json'
import gardensJson from '../content/gardens.json'
import sharedSources from '../content/sources.json'

export type FactKind = 'fact' | 'opinion' | 'prediction' | 'illustration'

/** Anything shown as a fact carries where it came from and when it was checked. */
export interface Fact {
  text: string
  asOf: string
  /** key into the sources registry (shared sources.json or the station's own `sources`) */
  source: string
  verify?: boolean
  kind?: FactKind
  /** Part 2: the company/lab that made this claim about itself (benchmark, "solved X") — shown as ◇ until verified */
  claimBy?: string
  /** Part 2: who independently confirmed it (source key or short name) */
  verifiedBy?: string
}

export interface Source {
  title: string
  publisher?: string
  url?: string
  date?: string
  note?: string
}

export interface Quiz {
  q: string
  options: string[]
  answer: number
  explain: string
}

/** Every station JSON has at least these fields; the rest is station-specific. */
export interface StationContent {
  id: number
  kicker: string
  quiz: Quiz
  summary: string
  sources?: Record<string, Source>
}

export type StationKind = 'concept' | 'news' | 'practice'

export interface StationMeta {
  id: number
  title: string
  teaser: string
  /** stations worth reading first (shown in the map tooltip) */
  prereq?: number[]
  kind?: StationKind
}
export interface Garden {
  id: number
  part: number
  name: string
  tagline: string
  motif: string
  stations: StationMeta[]
}
export interface Part {
  id: number
  name: string
  tagline: string
  route: string
}

export const SITE = site
export const L = site.labels
export const PARTS = gardensJson.parts as Part[]
export const GARDENS = gardensJson.gardens as Garden[]
/** Flat list of every station of both parts, in walking order. */
export const ALL_STATIONS = GARDENS.flatMap((g) => g.stations.map((s) => ({ ...s, garden: g })))

export const gardensOfPart = (p: number) => GARDENS.filter((g) => g.part === p)
export const stationsOfPart = (p: number) => ALL_STATIONS.filter((s) => s.garden.part === p)
/** Unknown ids count as Part 1 (the station route then falls back to the Part 1 map). */
export const partOfStation = (id: number) => ALL_STATIONS.find((s) => s.id === id)?.garden.part ?? 1

/** Number shown to people: '01'…'18' in Part 1, 'II·01'…'II·21' in Part 2 (ids keep running 19–39 inside). */
export function displayNo(id: number) {
  const p = partOfStation(id)
  const n = String(stationsOfPart(p).findIndex((s) => s.id === id) + 1).padStart(2, '0')
  return p === 1 ? n : `II·${n}`
}

const SOURCES = new Map<string, Source>(Object.entries(sharedSources as Record<string, Source>))

export function addSources(map?: Record<string, Source>) {
  if (map) for (const [k, v] of Object.entries(map)) SOURCES.set(k, v)
}

export function getSource(id: string): Source | undefined {
  const s = SOURCES.get(id)
  if (!s && import.meta.env.DEV) console.warn(`[content] unknown source "${id}"`)
  return s
}

export function stationIndex(id: number) {
  return ALL_STATIONS.findIndex((s) => s.id === id)
}
