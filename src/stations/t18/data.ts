import raw from '../../content/tram-18.json'
import type { Fact, StationContent } from '../../core/content'

type Copy = string | Fact

interface T18 extends StationContent {
  scenes: {
    power: {
      label: string; prompt: string; art: string; run: string; running: string
      labels: { grid: string; heat: string; steam: string }
      years: string; chart: string; share: string; forecast: string; unit: string
      v2024: Fact; v2030: Fact; japan: Fact
      insight2024: Fact; detail2024: Fact; insight2030: Fact; detail2030: Fact
    }
    drops: {
      label: string; labelMany: string; prompt: string; multiply: string; art: string; artMany: string; ask: string
      head: Fact; times: Fact; slider: string; stops: string[]; stopsAria: string[]; vessels: string[]
      metrics: { name: string; values: string[]; notes: string[] }[]
      caveatsTitle: string; caveats: Fact[]; insightOne: Copy; detailOne: Copy
      habitsTitle: string; habits: string[]; insight: Copy; where: Fact
    }
    think: {
      label: string; prompt: string; art: string; question: string; yours: string; placeholder: string
      start: string; timer: string; timerAria: string; done: string; reveal: string; veil: string
      ai: string; aiItems: string[]; compare: string; habitTitle: string; habit: string; habitSub: string
      skip: string; insight: Copy; detail: Copy
    }
    stones: {
      label: string; prompt: string; art: string; group: string; riskTitle: string; habitTitle: string
      flip: string; back: string; count: string; close: string; islands: string[]
      items: { id: string; name: string; risk: Copy; habit: string }[]
      insight: Copy
    }
    dawn: {
      label: string; prompt: string; art: string; group: string; good: string; bad: string
      goodAria: string; badAria: string; goodDone: string; badDone: string; next: string
      insight: Copy; detail: Copy
    }
  }
}

export const C = raw as unknown as T18
export type { Copy }
