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

export interface StationMeta {
  id: number
  title: string
  teaser: string
}
export interface Garden {
  id: number
  name: string
  tagline: string
  motif: string
  stations: StationMeta[]
}

export const SITE = site
export const L = site.labels
export const GARDENS = gardensJson.gardens as Garden[]
export const ALL_STATIONS = GARDENS.flatMap((g) => g.stations.map((s) => ({ ...s, garden: g })))

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
