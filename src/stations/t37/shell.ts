import raw from '../../content/tram-37.json'
import type { Fact, StationContent } from '../../core/content'
import type { Perspectives } from '../../ui/part2/types'

interface Opt { id: string; say: string; result: string; ok: boolean }
interface Layer { id: string; name: string; what: string; station?: number; fact?: Fact }
export interface T37 extends StationContent {
  takeaways: string[]
  scenes: {
    goal: { label: string; art: string; prompt: string; group: string; optionAria: string; morning: string; retry: string; options: Opt[]; insight: Fact; detail: Fact }
    lab: {
      label: string; art: string; prompt: string; toggle: string; on: string; off: string; watched: string; unwatched: string
      toolsLabel: string; tools: { id: string; name: string; what: string }[]; insight: Fact; detail: Fact; exampleLabel: string; example: Fact
      aria: string; hint: string
    }
    fence: {
      label: string; art: string; prompt: string; add: string; addAria: string; count: string; leak: string; reset: string; seeStation: string
      aria: string; hint: string; aligned: string
      layers: Layer[]; insight: Fact; detail: Fact
    }
    views: { label: string; art: string; prompt: string; group: string; stoneAria: string; hint: string; carve: string[][]; perspectives: Perspectives; insight: Fact; detail: Fact }
  }
}
export const C = raw as unknown as T37

