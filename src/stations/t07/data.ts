import raw from '../../content/tram-07.json'
import type { Fact, StationContent } from '../../core/content'

export interface Concept {
  id: string
  name: string
  term: string
  say: string
}

interface T7 extends StationContent {
  scenes: {
    diffuse: {
      label: string; prompt: string; promptLabel: string; pick: string; slider: string; stepOf: string; noise: string; image: string
      play: string; replay: string; canvas: string; note: string; same: string
      prompts: { short: string; text: string }[]
      insight: Fact; detail: Fact
    }
    chat: {
      label: string; prompt: string; image: string; first: string; firstReply: string; you: string; ai: string; suggest: string; send: string
      typing: string; note: string; written: string
      edits: { id: 'bg' | 'text' | 'dress'; say: string; reply: string }[]
      insight: Fact; detail: Fact
    }
    concepts: {
      label: string; prompt: string; group: string; idle: string
      groups: { name: string; items: Concept[] }[]
      art: { words: string; sketch: string; result: string; ref: string; seedA: string; seedB: string; ratios: string[]; neg: string; x4: string }
      insight: string
    }
    models: {
      label: string; prompt: string; needsLabel: string; gardenLabel: string; by: string; pickModel: string; asOf: string
      needs: { id: string; name: string; short: string; models: string[] }[]
      models: { id: string; company: string; names: string[]; label: string }[]
      newModel: Fact; insight: Fact; detail: Fact
    }
    recipe: {
      label: string; prompt: string; group: string; stripLabel: string; empty: string; canvas: string; written: string
      parts: { id: string; name: string; say: string }[]
      insight: string; detail: string
    }
  }
}

export const C = raw as unknown as T7
