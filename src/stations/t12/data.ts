import raw from '../../content/tram-12.json'
import type { Fact, StationContent } from '../../core/content'

export interface Block {
  id: string
  name: string
  title: string
  hint: string
  example: string
}

interface T12 extends StationContent {
  scenes: {
    path: { label: string; prompt: string; group: string; place: string; again: string; meter: string; level: string; art: string; blocks: Block[]; insight: string; detail: string }
    compare: {
      label: string; prompt: string; send: string; sendText: string; weakTitle: string; strongTitle: string; ask: string; reply: string; waiting: string; showPrompt: string; hidePrompt: string; flagNote: string
      weakPrompt: string; weakReply: { t: string; flag?: string }[]; strongReply: string[]; done: string; insight: string; detail: Fact
    }
    rules: { label: string; prompt: string; group: string; open: string; count: string; items: { id: string; short: string; title: string; example: string }[]; insight: string; detail: string }
  }
}

export const C = raw as unknown as T12
