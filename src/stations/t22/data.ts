import raw from '../../content/tram-22.json'
import type { Fact, StationContent } from '../../core/content'
import type { Tide } from '../../ui/part2/types'

export interface T22 extends StationContent {
  scenes: {
    lantern: {
      label: string; art: string; prompt: string; swapPrompt: string; decode: string; words: string[]; pivot: number; pivotAria: string; swap: string; swapAria: string
      endings: { word: string; points: number; weights: number[]; read: string }[]; threadAria: string; weightsNote: Fact; insight: Fact; detail: Fact
    }
    heads: {
      label: string; art: string; aria: string; hint: string; prompt: string; orbit: string; decode: string; words: string[]
      heads: { name: string; relation: string; aria: string; links: [number, number][] }[]
      allLit: string; headsNote: Fact; insight: Fact; detail: Fact; detail2: Fact
    }
    layers: {
      label: string; art: string; prompt: string; sentence: string; word: string; slider: string; ruler: string; sliderAria: string; valueText: string
      stages: { at: string; reads: string }[]; stagesNote: Fact; insight: Fact; detail: Fact; layers96: Fact
    }
    window: {
      label: string; art: string; prompt: string; prompt2: string; decode: string; claim: string; sealLabel: string; sealAria: string; ticks: string[]
      tide: Tide; insight: Fact; detail: Fact; growth: Fact
    }
  }
}
export const C = raw as unknown as T22
