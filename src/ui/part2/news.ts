import './part2.css'
import news from '../../content/news.json'
import { fill, h, nextId, s, viDate } from '../../core/dom'
import { L, addSources, type Fact } from '../../core/content'
import type { Detail, SceneDef } from '../../stations/types'
import type { NewsFile, NewsItem } from './types'
import { blob, clamp, onSize, rng, seedOf, stroke } from './ink'
import { hills, mist, moon } from './paint'
import { markGlyph, markOf } from './marks'

/** The shared news board (spec E: refreshed monthly); its sources resolve on every news station. */
export const NEWS = news as NewsFile
addSources(NEWS.sources)

export interface NewsOpts {
  label: string
  /** the station's `newsTags`: a stele shows when any of its tags is here */
  tags: string[]
  /** default "Chạm một tấm bia" */
  prompt?: string
  /** the scene's insight after the first stele is turned (else the scene is just marked explored) */
  insight?: Fact | string
  detail?: Detail
}

const toFact = (it: NewsItem, asOf: string): Fact => ({ text: it.what, asOf, source: it.source, kind: it.kind, claimBy: it.claimBy, verifiedBy: it.verifiedBy })
const verified = (it: NewsItem) => it.kind === 'fact' && (!it.claimBy || !!it.verifiedBy)

/** Older than six months before the board's asOf: the stele grows moss (this news may be out of date). */
function isOld(date: string, asOf: string) {
  const [y, m, d] = asOf.split('-').map(Number)
  const cut = new Date(Date.UTC(y, m - 1 - 6, d || 1)).toISOString().slice(0, 10)
  return date < cut
}

/**
 * B.7.4 Bảng tin trên đá: small steles along a path, newest first, one per news.json item whose tags meet the station's.
 * Touch one and it turns: what happened · why it matters · source · date · who confirmed it. "Verified only" hides
 * opinions, predictions and unconfirmed company claims; steles older than six months carry moss.
 */
export function newsStones(o: NewsOpts, file: NewsFile = NEWS): SceneDef {
  return {
    label: o.label,
    mount(ctx) {
      if (file !== NEWS) addSources(file.sources)
      const items = file.items.filter((it) => it.tags.some((t) => o.tags.includes(t))).sort((a, b) => b.date.localeCompare(a.date))
      const only = h('button', { class: 'p2n-only', type: 'button', 'aria-pressed': 'false' }, h('span', { class: 'p2n-switch', 'aria-hidden': 'true' }), L.newsVerifiedOnly)
      const empty = h('p', { class: 'p2n-empty' }, items.length ? L.newsNoneVerified : L.newsEmpty)
      empty.hidden = items.length > 0
      let turned = false
      const steles = items.map((it, i) => stele(it, i))
      const path = h('ul', { class: 'p2n-path', role: 'list' }, ...steles.map((x) => x.li))
      const scape = s('svg', { class: 'p2n-scape', 'aria-hidden': 'true' })
      const root = h('div', { class: 'p2n' },
        scape,
        h('div', { class: 'p2n-head' }, h('p', { class: 'p2-eyebrow' }, fill(L.newsAsOf, { date: viDate(file.asOf) })), items.length ? only : null),
        path, empty)
      ctx.art.append(root)
      ctx.prompt(o.prompt ?? L.newsPrompt)

      // the night behind the steles: ranges under the moon, the steles standing on their shoulders, raked ground below
      const seed = seedOf(o.tags.join('|'))
      ctx.onCleanup(onSize(root, () => {
        const W = root.clientWidth, H = root.clientHeight
        const rr = root.getBoundingClientRect(), pr = path.getBoundingClientRect()
        if (W < 40 || H < 40) return
        const top = pr.top - rr.top + 10, foot = pr.bottom - rr.top - 26
        const mr = clamp(W * 0.022, 13, 28)
        const r = rng(seed)
        let rake = ''
        for (let i = 0; i < 4; i++) {
          const y = foot + 5 + i * 6
          for (let x = -10; x < W; ) {
            const len = 60 + r() * 160
            rake += stroke([[x, y + (r() - 0.5)], [x + len, y + (r() - 0.5)]], 1.1 + r() * 0.6, 0.15, 0.15, 0.1)
            x += len + 6 + r() * 20
          }
        }
        scape.setAttribute('viewBox', `0 0 ${W} ${H}`)
        scape.replaceChildren(
          mist(W * 0.55, top + (foot - top) * 0.1, W * 0.7, (foot - top) * 0.55),
          moon(W * 0.78, Math.max(mr * 2.2, top * 0.55), mr, seed, true),
          hills(-W * 0.04, W * 1.04, top + (foot - top) * 0.42, (foot - top) * 0.55, seed, 0.88, 6),
          hills(W * 0.1, W * 0.95, top + (foot - top) * 0.62, (foot - top) * 0.6, seed + 1, 0.5, 4),
          mist(W * 0.5, top + (foot - top) * 0.72, W * 0.75, (foot - top) * 0.2),
          s('path', { class: 'p2n-ground', d: `M0 ${foot}H${W}V${foot + 30}H0Z`, filter: 'url(#ink-wash)' }),
          s('path', { class: 'p2n-rake', d: rake }))
      }))

      only.addEventListener('click', () => {
        const on = only.getAttribute('aria-pressed') !== 'true'
        only.setAttribute('aria-pressed', String(on))
        let shown = 0
        steles.forEach((x) => {
          x.li.hidden = on && !verified(x.it)
          if (!x.li.hidden) shown++
        })
        empty.hidden = shown > 0
      })

      function stele(it: NewsItem, i: number) {
        const backId = nextId('p2n')
        const old = isOld(it.date, file.asOf)
        const m = markOf(toFact(it, file.asOf))
        const r = rng(seedOf(it.id))
        const front = h('button', { class: 'p2n-face p2n-front', type: 'button', 'aria-expanded': 'false', 'aria-controls': backId },
          h('span', { class: 'p2n-date' }, viDate(it.date)),
          m ? markGlyph(m, 'cmark-glyph p2n-mark') : null,
          h('span', { class: 'p2n-title' }, it.title),
          old ? moss(r) : null)
        const backBtn = h('button', { class: 'p2n-back-btn', type: 'button' }, L.newsFlipBack)
        const back = h('div', { class: 'p2n-face p2n-back', id: backId },
          h('p', { class: 'p2-eyebrow' }, L.newsWhat),
          ctx.fact(toFact(it, file.asOf), 'p', 'p2n-what'),
          h('p', { class: 'p2-eyebrow' }, L.newsWhy),
          h('p', { class: 'p2n-why' }, it.why),
          h('p', { class: 'p2n-meta' }, viDate(it.date), ' · ',
            it.verifiedBy ? fill(L.independent, { who: it.verifiedBy }) : it.claimBy ? fill(L.vendorClaim, { who: it.claimBy }) + ` · ${L.newsNotVerified}` : ''),
          old ? h('p', { class: 'p2n-old' }, L.newsOld) : null,
          backBtn)
        back.inert = true
        const card = h('div', { class: 'p2n-flip' }, front, back)
        const li = h('li', { class: `p2n-stele${old ? ' old' : ''}`, style: `--i:${i};--tilt:${((r() - 0.5) * 2.4).toFixed(2)}deg` }, card)
        const turn = (open: boolean) => {
          li.classList.toggle('turned', open)
          front.setAttribute('aria-expanded', String(open))
          front.inert = open
          back.inert = !open
          ;(open ? backBtn : front).focus({ preventScroll: true })
          if (open) {
            ctx.chime('soft')
            if (!turned) {
              turned = true
              if (o.insight) ctx.insight(o.insight, o.detail)
              else ctx.complete()
            }
          }
        }
        front.addEventListener('click', () => turn(true))
        backBtn.addEventListener('click', () => turn(false))
        return { li, it }
      }
    },
  }
}

/** Moss on an old stele: a soft wash at its foot and shoulder, freckled with small tufts. */
function moss(r: () => number) {
  const dots = (cx: number, cy: number, rx: number, ry: number, k: number) =>
    Array.from({ length: k }, () => {
      const a = r() * Math.PI * 2, d = Math.sqrt(r())
      return s('circle', { cx: (cx + Math.cos(a) * rx * d).toFixed(1), cy: (cy + Math.sin(a) * ry * d).toFixed(1), r: (0.8 + r() * 1.6).toFixed(1) })
    })
  return s('svg', { class: 'p2n-moss', viewBox: '0 0 100 160', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    s('path', { class: 'p2n-moss-wash', d: blob(16, 156, 30, 12, 3 + r() * 100, 0.25) + blob(78, 158, 26, 8, 7 + r() * 100, 0.3) + blob(86, 16, 12, 7, 11 + r() * 100, 0.3), filter: 'url(#ink-wash)' }),
    s('g', { class: 'p2n-moss-dots' }, ...dots(16, 152, 24, 8, 26), ...dots(80, 155, 20, 5, 14), ...dots(86, 17, 9, 5, 9)))
}
