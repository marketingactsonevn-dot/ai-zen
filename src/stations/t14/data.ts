import content from '../../content/tram-14.json'
import type { Fact, StationContent } from '../../core/content'

export type Copy = string | Fact
export type StoneId = 'goal' | 'plan' | 'act' | 'observe' | 'fix' | 'report'
export interface Part {
  id: 'brain' | 'hands' | 'short' | 'long' | 'plan' | 'env' | 'fence'
  name: string
  sub: string
  text: string
}

export interface T14 extends StationContent {
  scenes: {
    jar: { label: string; prompt: string; art: string; attach: string; again: string; before: string; after: string; tools: string[]; done: string; insight: Copy; detail: Copy }
    anatomy: { label: string; prompt: string; art: string; group: string; parts: Part[]; insight: Copy; detail: Copy }
    loop: {
      label: string
      prompt: string
      art: string
      step: string
      again: string
      round: string
      repeat: string
      task: string
      slots: string[]
      stones: Record<StoneId, string>
      steps: { at: StoneId; text: string }[]
      insight: Copy
      detail: Copy
    }
  }
}

export const C = content as unknown as T14
