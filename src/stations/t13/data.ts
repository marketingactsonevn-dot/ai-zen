import raw from '../../content/tram-13.json'
import type { Fact, StationContent } from '../../core/content'

export interface Slot {
  name: string
  frag: string
  key?: boolean
}
export interface FormulaCopy {
  label: string
  prompt: string
  artLabel: string
  /** fragments are short phrases joined by commas (image, video) rather than whole sentences */
  phrases: boolean
  bad: { text: string; mistakes: string[] }
  slots: Slot[]
  insight: Fact | string
  detail?: Fact | string
}

interface T13 extends StationContent {
  ui: {
    promptLabel: string
    vagueLabel: string
    clearLabel: string
    compare: string
    vague: string
    clear: string
    mistakes: string
    stones: string
    added: string
    removed: string
    showVague: string
    showClear: string
    more: string
    less: string
  }
  scenes: {
    text: FormulaCopy & { words: { source: string; sample: string; ask: string[]; options: string[]; legendQ: string; legendEx: string } }
    image: FormulaCopy & {
      words: { brand: string; ways: string; sentence: string; keywords: string; sentenceText: string; keywordsText: string; sentenceFor: string; keywordsFor: string }
      paramFact: Fact
    }
    video: FormulaCopy & { words: { first: string; shot: string; next: string[]; end: string } }
    model: FormulaCopy & {
      materials: { id: 'glass' | 'matte' | 'metal'; name: string; frag: string }[]
      uses: { id: 'game' | 'render'; name: string; frag: string; budget: string }[]
      words: { input: string; matGroup: string; useGroup: string; pbr: string[]; tris: string; noGl: string; angle: string }
    }
    agent: FormulaCopy & { words: { run: string; again: string; ask: string; yes: string; no: string; folder: string; team: string; sent: string; held: string } }
  }
}

export const C = raw as unknown as T13
