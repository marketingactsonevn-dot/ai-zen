import raw from '../../content/tram-11.json'
import type { Fact, StationContent } from '../../core/content'
import type { DeskId } from './desks'

export interface Task {
  text: string
  desk: DeskId
  why: string
  /** a kinder, more specific word for a near miss on that desk */
  near?: Partial<Record<DeskId, string>>
}
export interface LaneItem {
  company: string
  /** model names exactly as in companies.json (merged siblings share one stone) */
  models: string[]
  name?: string
  /** open/closed as the brief words it, when companies.json has no flag */
  weights?: Fact
  open?: boolean
  access?: Fact
  /** a plainer note than companies.json gives (still from the brief) */
  note?: Fact
}
export interface Lane {
  id: Exclude<DeskId, 'agent'>
  name: string
  items: LaneItem[]
}

interface T11 extends StationContent {
  scenes: {
    team: { label: string; prompt: string; group: string; deskAria: string; insight: string; detail: string; desks: Record<DeskId, { name: string; role: string; caption: string }> }
    game: { label: string; prompt: string; inbox: string; desks: string; card: string; picked: string; noCard: string; right: string; left: string; done: string; seal: string; insight: string; detail: string; tasks: Task[] }
    compare: {
      label: string
      prompt: string
      tabs: string
      stones: string
      stoneAria: string
      close: string
      asOf: string
      rows: Record<'maker' | 'strengths' | 'note' | 'focus' | 'weights' | 'access' | 'date', string>
      none: string
      weights: { closed: string; open: string }
      legend: { closed: string; open: string; unknown: string }
      status: { closed: string; open: string; unknown: string }
      insight: Fact
      detail: Fact
      lanes: Lane[]
    }
  }
}

export const C = raw as unknown as T11
