import raw from '../../content/tram-16.json'
import type { Fact, StationContent } from '../../core/content'

type Copy = string | Fact
export type AppId = 'drive' | 'gmail' | 'slack' | 'figma' | 'db' | 'blender'

interface T16 extends StationContent {
  scenes: {
    socket: {
      label: string; prompt: string; group: string; plug: string; unplug: string; port: string; portSub: string; agent: string
      status: string; statusOff: string; apps: { id: AppId; name: string; ability: string }[]; insight: Copy; detail: Copy
    }
    tangle: {
      label: string; prompt: string; group: string; before: string; after: string; ais: string; apps: string
      countBefore: string; countAfter: string; mcp: string; art: string; insight: Copy; detail: Copy
    }
    stones: { label: string; prompt: string; group: string; items: { name: string; sub: string; caption: Copy; words: string[] }[]; insight: Copy }
    hidden: {
      label: string; prompt: string; lantern: string; letter: string[]; secret: string; agent: string; found: string; send: string
      tags: string[]; habitsLabel: string; habits: { name: string; caption: string }[]; held: string; ignored: string; insight: Copy; detail: Copy
    }
  }
}

export const C = raw as unknown as T16
