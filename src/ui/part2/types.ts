// Data shapes shared by the Part 2 components (spec B.7), the station JSON (src/content/tram-19…39.json),
// src/content/news.json and src/content/toolkit.json. Content and code both follow these: change them here first.
import type { Fact, FactKind, Source } from '../../core/content'

/** B.7.1 Vòng đá góc nhìn: 3–5 views around the moon pond, then what they share. */
export interface Perspectives {
  stones: { who: string; view: Fact }[]
  common: Fact
}

/** B.7.2 Thuỷ triều tiến triển: milestones along a sand scroll; the last one is always "today", then the horizon. */
export interface Tide {
  milestones: {
    date: string
    label: string
    fact: Fact
    /** two numbers side by side as ink bars, e.g. { before: '2:40:42', after: '50:26', ratio: 0.31 } (ratio = after / before) */
    compare?: { before: string; after: string; ratio?: number; beforeLabel?: string; afterLabel?: string }
  }[]
  /** the faint line in the mist after "today": always kind 'prediction' or 'opinion' */
  horizon: Fact
}

/** B.7.4 one stele in news.json; a news station shows the items whose tags meet its `newsTags`. */
export interface NewsItem {
  id: string
  /** YYYY-MM-DD of the event */
  date: string
  title: string
  what: string
  why: string
  kind: FactKind
  /** key into news.json `sources` (or the shared sources.json) */
  source: string
  /** the company/lab that made the claim, when it is their own announcement or benchmark */
  claimBy?: string
  /** who independently confirmed it (a source key or a short name) */
  verifiedBy?: string
  tags: string[]
}
export interface NewsFile {
  asOf: string
  items: NewsItem[]
  sources: Record<string, Source>
}

/** B.7.5 Thẻ mang về; all of them live in toolkit.json and are shown again on #/do-nghe. */
export interface Takeaway {
  id: string
  station: number
  title: string
  type: 'prompt' | 'checklist' | 'command' | 'table'
  /** the text that gets copied; placeholders are written [IN HOA TRONG NGOẶC VUÔNG] and highlighted */
  body: string
  note?: string
  source?: string
  /** C.2 shelf the card sits on in #/do-nghe, e.g. "Đọc tin & kiểm chứng" (free text, same words across cards) */
  topic?: string
  /** YYYY-MM-DD the card was last checked (C.2) */
  asOf?: string
}
export interface ToolkitFile {
  cards: Takeaway[]
  /** sources the cards cite: #/do-nghe does not load the station files, so their keys must resolve here (or in sources.json) */
  sources?: Record<string, Source>
}

/** B.7.6 Lối đá từng bước: put the steps in order; done → the takeaway card (id in toolkit.json) opens. */
export interface StepPath {
  steps: { label: string; detail: string; why: string }[]
  takeaway?: string
}

/** B.7.7 Cuộn mã: a short code scroll with a Vietnamese note beside each block. */
export interface CodeScroll {
  lang: 'js' | 'html' | 'css' | 'bash' | 'python' | 'json' | 'text'
  code: string
  notes: { line: number; text: string }[]
}
