import type { Fact, StationContent } from '../../core/content'
import type { Perspectives, Tide } from '../../ui/part2/types'

type Level = 'low' | 'high'
interface View { who: string; view: Fact }
export interface T38 extends StationContent {
  scenes: {
    defs: { label: string; art: string; prompt: string; group: string; stoneAria: string; names: string[]; strip: string; perspectives: Perspectives; insight: Fact }
    tide: { label: string; art: string; prompt: string; next: string; legend: string; hours: string[]; slider: string; valueText: string; tide: Tide; insight: Fact; detail: Fact[] }
    fork: {
      label: string; art: string; prompt: string; sliderAria: string
      sliders: { id: 'speed' | 'share' | 'control'; label: string; low: string; high: string }[]
      note: Fact
      scenarios: { id: string; when: Partial<Record<'speed' | 'share' | 'control', Level>>; name: string; text: string }[]
      mistsLabel: string; mists: View[]; insight: Fact
    }
    trays: {
      label: string; art: string; prompt: string; keys: string; pickAria: string; compare: string; match: string
      trays: { id: string; name: string }[]
      tasks: { id: string; label: string; short: string; expert: string; why: string }[]
      expertNote: Fact; insight: Fact; detail: Fact; jobs: Fact
    }
  }
}
