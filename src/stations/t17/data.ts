import raw from '../../content/tram-17.json'
import type { Fact, StationContent } from '../../core/content'
import { fill, viDate } from '../../core/dom'
import { COMPANIES, COMPANY_DATA, type Category, type Company, type Model } from '../../ui/logo'

export type Region = 'us' | 'cn' | 'other'
export type Lens = 'closed' | 'open'
type Cat = Record<Category, string>
interface Pick { id: string; model: string; fact?: string }

interface T17 extends StationContent {
  badge: string
  regions: Record<Region, string>
  countries: Record<string, string>
  cats: Cat
  weights: { closed: string; mixed: string }
  status: { discontinued: string; unreleased: string }
  companies: Record<string, { motto?: Fact; fit: Fact }>
  regionMotto: Record<string, Fact>
  card: Record<'start' | 'label' | 'close' | 'philosophy' | 'regionPhilosophy' | 'focus' | 'strengths' | 'history' | 'ladder' | 'ladderHint' | 'noModels' | 'timeline' | 'timelineGroup' | 'tlHint' | 'dot' | 'closed' | 'now' | 'fit', string> & { kinds: Cat }
  closures: Record<string, { date: string; label: string; fact: Fact }[]>
  scenes: {
    map: {
      label: string; prompt: string; region: string; filters: string; regionGroup: string; island: string; regionNote: Partial<Record<Region, Fact | string>>
      weightsGroup: string; weightsLabel: string; weightsChips: Record<Lens, string>; weightsNote: Record<Lens, string>; insight: Fact; detail: Fact
    }
    gate: {
      label: string; prompt: string; region: string; home: string; fence: string; gateLabel: string; homeLabel: string; weightsLabel: string
      closedGroup: string; openGroup: string; take: string; back: string; tryClosed: string
      closed: Pick[]; open: Pick[]; closedFact: Fact; openFact: Fact; insight: string; detail: Fact
    }
    ladder: {
      label: string; prompt: string; group: string; region: string; scale: string[]; stone: string
      companies: { id: string; tiers: string[][]; scale?: string[]; note?: Fact }[]; insight: string; detail: Fact
    }
    compare: {
      label: string; prompt: string; region: string; prev: string; next: string; side: string[]; shared: string; only: string; none: string; doing: string; stone: string
      pair: string[]; note: string; insight: Fact
    }
  }
}

export const C = raw as unknown as T17
export const CATS: Category[] = ['text', 'image', 'video', '3d', 'audio']
export const ASOF = COMPANY_DATA.asOf
export const badgeText = () => fill(C.badge, { date: viDate(ASOF) })

export const regionOf = (c: Company): Region => (c.country === 'cn' ? 'cn' : c.country === 'us' || c.country === 'uk-us' ? 'us' : 'other')
export const ORDER: Region[] = ['us', 'cn', 'other']
export const byRegion = (r: Region) => COMPANIES.filter((c) => regionOf(c) === r)

/** Short motto: the company's own, else the shared philosophy of its region (from the brief). */
export const motto = (c: Company): Fact | undefined => C.companies[c.id]?.motto ?? C.regionMotto[c.country ?? '']
export const fitOf = (c: Company): Fact | undefined => C.companies[c.id]?.fit

/** Closed / open weights as the brief states them; "unknown" companies (e.g. Meta's Muse) are in neither. */
export const hasLens = (c: Company, l: Lens) =>
  c.weights === 'mixed' || c.weights === l || c.models.some((m) => m.openWeights === (l === 'open'))

/** Rough weight for island size: how much the brief lists for this company. */
export const heft = (c: Company) => Math.min(1.18, 0.86 + 0.045 * c.models.length + 0.03 * c.categories.length)

/** "2026-09-03" → sortable number of months since 2025-12 (month-only dates sit mid-month). */
export function monthPos(date?: string): number | null {
  if (!date) return null
  const [y, m, d] = date.split('-').map(Number)
  if (!m) return null
  return (y - 2025) * 12 + (m - 12) + ((d || 15) - 1) / 30
}

/** "Sora · Đã đóng: …": the status word is dropped when the note already starts with it. */
export const modelFact = (m: Model): Fact => {
  const st = m.status ? C.status[m.status] : ''
  const said = !!st && !!m.note?.toLowerCase().startsWith(st.toLowerCase())
  return {
    text: [m.name, m.date ? viDate(m.date) : '', said ? '' : st].filter(Boolean).join(' · ') + (m.note ? `: ${m.note}` : ''),
    asOf: m.asOf,
    source: m.source,
    verify: m.verify,
  }
}

/** The ladder's words for one company, small stone (top) first: its own when the brief tiers it differently. */
export const scaleOf = (id: string) => C.scenes.ladder.companies.find((l) => l.id === id)?.scale ?? C.scenes.ladder.scale


/** The ladder for a company: the station's tiers when given, else its main kind's live models in data order. */
export function ladderOf(c: Company): Model[][] {
  const t = C.scenes.ladder.companies.find((l) => l.id === c.id)
  const find = (n: string) => c.models.find((m) => m.name === n)
  if (t) return t.tiers.map((names) => names.map(find).filter((m): m is Model => !!m)).filter((g) => g.length)
  const main = c.categories[0]
  return c.models.filter((m) => m.kind === main).map((m) => [m])
}

/** Island groups, as in a stone garden: a few stones share one moss island. Order = the path across the map. */
export const GROUPS: { r: Region; ids: string[] }[] = [
  { r: 'us', ids: ['openai', 'google-deepmind', 'anthropic'] },
  { r: 'us', ids: ['meta', 'xai'] },
  { r: 'us', ids: ['microsoft'] },
  { r: 'cn', ids: ['deepseek', 'alibaba', 'moonshot'] },
  { r: 'cn', ids: ['zhipu', 'minimax'] },
  { r: 'cn', ids: ['bytedance', 'kuaishou', 'tencent'] },
  { r: 'other', ids: ['midjourney', 'black-forest-labs'] },
  { r: 'other', ids: ['runway', 'luma'] },
  { r: 'other', ids: ['meshy', 'hyper3d', 'tripo'] },
  { r: 'other', ids: ['elevenlabs', 'suno'] },
]
