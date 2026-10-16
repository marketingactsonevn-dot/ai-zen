import raw from '../../content/tram-22.json'
import type { Fact, StationContent } from '../../core/content'
import type { Tide } from '../../ui/part2/types'

export interface T22 extends StationContent {
  scenes: {
    lantern: {
      label: string; art: string; prompt: string; swapPrompt: string; words: string[]; pivot: number; pivotAria: string; swap: string; swapAria: string
      endings: { word: string; points: number; weights: number[]; read: string }[]; threadAria: string; weightsNote: Fact; insight: Fact; detail: Fact
    }
    heads: {
      label: string; art: string; aria: string; hint: string; prompt: string; orbit: string; words: string[]
      heads: { name: string; relation: string; aria: string; links: [number, number][] }[]
      allLit: string; headsNote: Fact; insight: Fact; detail: Fact; caveat: Fact
    }
    layers: {
      label: string; art: string; prompt: string; word: string; slider: string; sliderAria: string; valueText: string
      stages: { at: string; reads: string }[]; stagesNote: Fact; insight: Fact; detail: Fact
    }
    window: { label: string; art: string; prompt: string; tide: Tide; insight: Fact; detail: Fact }
  }
}
export const C = raw as unknown as T22
