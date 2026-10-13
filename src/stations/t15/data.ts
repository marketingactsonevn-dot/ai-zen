import raw from '../../content/tram-15.json'
import type { Fact, StationContent } from '../../core/content'

export interface Kind {
  id: 'chat' | 'flow' | 'code' | 'computer' | 'research' | 'team'
  name: string
  what: string
  example: string
}

interface T15 extends StationContent {
  scenes: {
    autonomy: {
      label: string; prompt: string; slider: string; valueText: string; level: string; you: string; agent: string; goal: string; report: string; ask: string
      scale: Fact; art: string; levels: { name: string; does: string; example: string }[]; insight: string; detail: string
    }
    kinds: { label: string; prompt: string; group: string; exampleLabel: string; items: Kind[]; insight: string; detail: string }
    sim: {
      label: string; prompt: string; region: string; taskLabel: string; task: string; start: string; steps: string[]; stepsLabel: string; hours: string[]
      planTitle: string; plan: string[]; calTitle: string; people: string[]; found: string
      draftTitle: string; to: string; subjectLabel: string; subject: string; body: string[]; recipients: string[]; wrong: string; right: string; note: string
      checkTitle: string; stone: Fact; approve: string; edit: string; editHint: string; swap: string
      sentWrong: string; sentRight: string; retry: string; again: string; insight: string; detail: string
      next: string; partner: string; team: string
    }
  }
}

export const C = raw as unknown as T15
