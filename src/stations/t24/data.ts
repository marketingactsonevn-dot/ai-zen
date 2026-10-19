import raw from '../../content/tram-24.json'
import type { Fact, StationContent } from '../../core/content'

export interface T24 extends StationContent {
  scenes: {
    flowers: {
      label: string; art: string; prompt: string; question: string; options: { text: string; aria: string; short: string }[]
      lean: string; repeat: string; swap: string; swapAria: string; scroll: string; rules: string[]; insight: Fact; detail: Fact; constitution: Fact
    }
    flattery: {
      label: string; art: string; prompt: string; pruneAria: string; userSays: string; flatter: string; honest: string; flatterShort: string; honestShort: string
      flatterLabel: string; honestLabel: string; insight: Fact; detail: Fact; cause: Fact
    }
    shortcut: {
      label: string; art: string; prompt: string; task: string; paths: { label: string; aria: string; honest: boolean; stone: string }[]
      bell: string; reveal: string; insight: Fact; detail: Fact; takeaway: string
    }
    incense: {
      label: string; art: string; prompt: string; slider: string; sliderAria: string; valueText: string; short: string; long: string; notches: string[]
      insight: Fact; detail: Fact; far: Fact
    }
    diary: {
      label: string; art: string; prompt: string; question: string; decode: string; pebbleAria: string; pebbleWrong: string
      answer: { label: string; before: string; after: string }; flip: string; flipNext: string; flipAria: string; pageCount: string; pages: string[]
      data: Fact; insight: Fact; detail: Fact
    }
  }
}
export const C = raw as unknown as T24
