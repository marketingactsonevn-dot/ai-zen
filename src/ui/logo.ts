import companiesJson from '../content/companies.json'
import type { Fact } from '../core/content'
import { h } from '../core/dom'
import './logo.css'

// ───────── Company data (src/content/companies.json) ─────────
export type Category = 'text' | 'image' | 'video' | '3d' | 'audio'
export type Weights = 'closed' | 'open' | 'mixed' | 'unknown'

export interface Model {
  name: string
  kind: Category
  /** release date as written in the brief: YYYY-MM-DD, YYYY-MM or YYYY */
  date?: string
  note?: string
  /** qualitative strengths — always kind "opinion" */
  strengths?: Fact
  openWeights?: boolean
  status?: 'discontinued' | 'unreleased'
  verify?: boolean
  asOf: string
  source: string
}

export interface Company {
  id: string
  name: string
  /** "us" | "uk-us" | "cn" …; null when the brief does not say */
  country: string | null
  philosophy: Fact | null
  history?: Fact
  focus?: Fact
  /** company-level open/closed stance as stated in the brief ("unknown" = not stated) */
  weights: Weights
  categories: Category[]
  models: Model[]
  logo: { simpleIcons?: string; pressKit?: string }
}

export interface CompaniesData {
  asOf: string
  /** shared philosophy for a region, e.g. "cn" */
  regionPhilosophy: Record<string, Fact>
  companies: Company[]
}

export const COMPANY_DATA = companiesJson as unknown as CompaniesData
export const COMPANIES = COMPANY_DATA.companies
const byId = new Map(COMPANIES.map((c) => [c.id, c]))
export const company = (id: string): Company | undefined => byId.get(id)

// ───────── Logo manifest (public/logos/logos.json, written by `npm run logos`) ─────────
export interface LogoItem {
  name: string
  /** the icon's own title in simple-icons (may differ from the company name, e.g. "Alibaba Cloud") */
  title: string
  file: string
  origin: string
  slug: string
  source: string
  /** 'image' = official full-colour artwork shown as is; 'mask' (default) = single-colour shape tinted with hex */
  mode?: 'image' | 'mask'
  /** symbol vs. long wordmark (wordmarks get a wider box) */
  kind?: 'symbol' | 'wordmark'
  guidelines?: string
  license?: { type: string; url?: string }
  hex: string
}

export interface LogoManifest {
  generatedAt: string
  package: string
  license: string
  items: Record<string, LogoItem>
  missing: { id: string; name: string; reason: string; pressKit?: string }[]
}

let manifest: Promise<LogoManifest | null> | undefined

/** Fetched once (relative URL, works under Vite base './'). Resolves null on failure → stones show names. */
export function loadLogos(): Promise<LogoManifest | null> {
  return (manifest ??= fetch('logos/logos.json')
    .then((r) => (r.ok ? (r.json() as Promise<LogoManifest>) : null))
    .catch(() => null))
}

// ───────── Logo stone ─────────
export interface StoneOpts {
  /** stone height in px (width is ~1.28×). Default 72. */
  size?: number
  /** true when the company name is already written next to the stone (no label + aria-hidden) */
  decorative?: boolean
  /** gentle idle float. Default true; always off under reduced motion. */
  float?: boolean
}

const hash = (s: string) => [...s].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 7)
// Longer names get a smaller type scale so they fit the stone without an invented abbreviation.
const nameScale = (n: string) => (n.length <= 5 ? 0.24 : n.length <= 7 ? 0.2 : n.length <= 10 ? 0.165 : 0.15)

/**
 * A light, pebble-shaped badge carrying the company's official mark — or, if no official file exists,
 * its name in serif type. The file is never altered: simple-icons SVGs are bare shapes (black unless filled),
 * so the shape is painted in the brand colour simple-icons records rather than shown as an unofficial monochrome.
 * Motion (float, ink ripple, fade) happens around the mark. Wrap it in an element with class "ls-host"
 * (or a link/button) to ripple on that element's hover/focus. Name badges widen for long names and keep
 * their type ≥ 11px; they read best at size ≥ 48.
 */
export function logoStone(id: string, { size = 72, decorative = false, float = true }: StoneOpts = {}): HTMLElement {
  const name = company(id)?.name ?? id
  const seed = hash(id)
  const body = h('span', { class: 'ls-body' })
  const el = h('span', {
    class: 'logo-stone',
    'data-shape': seed % 4,
    'data-float': float,
    'aria-hidden': decorative ? 'true' : null,
    style: `--ls-size:${size}px;--ls-delay:${-((seed % 70) / 10)}s`,
  },
    h('span', { class: 'ls-ripple', 'aria-hidden': 'true' }),
    h('span', { class: 'ls-shadow', 'aria-hidden': 'true' }),
    body)

  const showName = () => {
    el.dataset.kind = 'name'
    body.replaceChildren(h('span', { class: 'ls-name', style: `--ls-fs:${nameScale(name)}` }, name))
  }
  loadLogos().then((m) => {
    const item = m?.items[id]
    if (!item) return showName()
    // Absolute URL set directly (not via a custom property, where relative url() resolves inconsistently).
    const url = new URL(`logos/${item.file}`, document.baseURI).href
    const mark = h('span', {
      class: 'ls-mark',
      role: decorative ? null : 'img',
      // say whose icon it is when it is a unit's mark, e.g. "Alibaba (Alibaba Cloud)"
      'aria-label': decorative ? null : item.title !== name ? `${name} (${item.title})` : name,
    })
    if (item.kind === 'wordmark') mark.classList.add('is-wordmark')
    if (item.mode === 'image') {
      // official colour artwork, untouched
      mark.classList.add('is-image')
      mark.style.backgroundImage = `url("${url}")`
    } else {
      mark.style.backgroundColor = item.hex
      mark.style.setProperty('-webkit-mask-image', `url("${url}")`)
      mark.style.setProperty('mask-image', `url("${url}")`)
    }
    const probe = new Image()
    probe.addEventListener('error', showName, { once: true })
    probe.src = url
    el.dataset.kind = 'logo'
    body.replaceChildren(mark)
  })
  return el
}
