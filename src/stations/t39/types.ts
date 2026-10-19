import type { Fact, StationContent } from '../../core/content'
import type { Perspectives, StepPath } from '../../ui/part2/types'

export type Answers = Partial<Record<'role' | 'goal' | 'device' | 'budget', string>>
interface Note { add?: string[]; drop?: string[]; keep?: string[]; stations?: number[]; note?: string }
export interface T39 extends StationContent {
  takeaways: string[]
  scenes: {
    ask: {
      label: string; art: string; prompt: string; progress: string; optionAria: string; change: string; privacy: string
      questions: { id: keyof Answers; q: string; options: { id: string; label: string }[] }[]
      insight: Fact
    }
    kit: {
      label: string; art: string; prompt: string; next: string; later: string; open: string; empty: string; revisit: string; stationLink: string; examplesLabel: string; docsLabel: string
      types: { id: string; name: string; what: string; examples: { name: string; source: string }[]; stations: number[] }[]
      rules: { role: Record<string, string[]>; goal: Record<string, Note>; device: Record<string, Note>; budget: Record<string, Note> }
      priceNote: Fact; insight: Fact
    }
    path: { label: string; art: string; prompt: string; next: string; keys: string; stoneAria: string; wrong: string; wrongFirst: string; done: string; steps: StepPath; weekCards: string[]; insight: Fact }
    advice: { label: string; art: string; prompt: string; drop: string; legend: string; leafAria: string; group: string; stoneAria: string; perspectives: Perspectives; detail: Fact }
    enso: {
      label: string; art: string; prompt: string; more: string; draw: string; drawAria: string; visited: string; visitedAll: string; copied: string
      exam: string; examAria: string; toolkit: string; toolkitAria: string; insight: Fact
    }
  }
}
