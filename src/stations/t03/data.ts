import raw from '../../content/tram-03.json'
import type { Fact, StationContent } from '../../core/content'
import type { Art } from './brush'

interface T3 extends StationContent {
  scenes: {
    scroll: { label: string; prompt: string; region: string; prev: string; next: string; status: string; insight: Fact; art: Art; events: { year: string; title: string; caption: Fact }[] }
    future: { label: string; prompt: string; group: string; stone: string; insight: string; steps: { title: string; caption: Fact }[] }
    views: { label: string; prompt: string; group: string; insight: string; items: { name: string; view: Fact }[] }
  }
}

export const C = raw as unknown as T3
