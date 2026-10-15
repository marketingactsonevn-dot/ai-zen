import raw from '../../content/tram-23.json'
import type { Fact, StationContent } from '../../core/content'
import type { Perspectives } from '../../ui/part2/types'

export interface T23 extends StationContent {
  scenes: {
    bridge: {
      label: string; art: string; prompt: string; slider: string; sliderAria: string; valueText: string; question: string
      answers: string[]; answersNote: Fact; insight: Fact; detail: Fact
    }
    lotus: { label: string; art: string; prompt: string; shakeAria: string; neuron: string; meanings: string[]; meaningsNote: Fact; insight: Fact; detail: Fact }
    stream: {
      label: string; art: string; prompt: string; question: string
      nodes: { id: string; label: string; tier: number; aria: string }[]; edges: [string, string][]
      shortcut: string; stepAria: string; swap: string; swapAria: string; swapTo: string; swapResult: string; insight: Fact; detail: Fact; limit: Fact
    }
    circle: { label: string; art: string; prompt: string; question: string; perspectives: Perspectives; insight: Fact }
  }
}
export const C = raw as unknown as T23
