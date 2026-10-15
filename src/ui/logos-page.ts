import copy from '../content/logo-credits.json'
import { fill, h, viDate } from '../core/dom'
import { L } from '../core/content'
import { gsap, revealIn } from '../core/anim'
import { prefs } from '../core/prefs'
import { COMPANIES, loadLogos, logoStone, type Company, type LogoManifest } from './logo'

/** #/logos — "Nguồn logo": every company's stone, where its file came from, and the trademark note. */
export function renderLogos(root: HTMLElement): () => void {
  let alive = true
  const title = h('h1', { tabindex: '-1' }, copy.title)
  const count = h('p', { class: 'lp-count', 'aria-live': 'polite' }, copy.loading)
  const grid = h('ul', { class: 'lp-grid' })
  const generated = h('p', { class: 'lp-note-meta' })

  root.append(
    h('header', { class: 'lp-head sand' },
      h('div', { class: 'wrap' },
        h('p', { class: 'eyebrow' }, copy.eyebrow),
        title,
        h('p', { class: 'lp-lede' }, copy.lede),
        h('ol', { class: 'lp-rules' }, ...copy.rules.map((r) => h('li', null, r))))),
    h('div', { class: 'wrap' },
      h('section', { class: 'lp-grid-section', 'aria-labelledby': 'lp-grid-title' },
        h('h2', { id: 'lp-grid-title' }, copy.gridTitle),
        count,
        grid),
      h('aside', { class: 'card lp-note', 'data-reveal': '' },
        h('p', { class: 'lp-note-main' }, copy.note),
        generated,
        h('p', { class: 'lp-note-meta' }, copy.license)),
      h('p', { class: 'lp-back' }, h('a', { class: 'btn ghost', href: '#/vuon' }, L.backToMap))),
  )
  title.focus({ preventScroll: true })

  const gctx = gsap.context(() => {})
  let offReveal: (() => void) | null = null
  loadLogos().then((m) => {
    if (!alive) return
    grid.append(...COMPANIES.map((c) => card(c, m)))
    const logos = COMPANIES.filter((c) => m?.items[c.id]).length
    count.textContent = m ? fill(copy.count, { logos, names: COMPANIES.length - logos }) : copy.loadError
    if (m) generated.textContent = fill(copy.generated, { package: m.package, date: viDate(m.generatedAt.slice(0, 10)) })
    else generated.remove()
    gctx.add(() => {
      offReveal = revealIn(root) // registers ScrollTrigger (needed by the stagger below too)
      if (!prefs.reduced)
        gsap.from(grid.children, {
          opacity: 0,
          y: 18,
          duration: 1,
          stagger: 0.035,
          ease: 'power3.out',
          scrollTrigger: { trigger: grid, start: 'top 92%', once: true },
        })
    })
  })

  return () => {
    alive = false
    gctx.revert()
    offReveal?.()
  }
}

function card(c: Company, m: LogoManifest | null): HTMLElement {
  const item = m?.items[c.id]
  const link = (label: string, href?: string) =>
    href ? h('a', { href, target: '_blank', rel: 'noopener noreferrer', 'aria-label': fill(copy.linkLabel, { label, name: c.name }) }, label) : null
  const links = (item
    ? [link(copy.links.source, item.source), link(copy.links.guidelines, item.guidelines), link(copy.links.license, item.license?.url)]
    : [link(copy.links.pressKit, c.logo.pressKit)]
  ).filter((a): a is HTMLAnchorElement => a !== null)

  return h('li', { class: 'lp-item ls-host', 'data-origin': item ? item.origin : 'name' },
    // the name is written right beside the stone, so the stone itself is decorative here
    logoStone(c.id, { size: 62, decorative: true }),
    h('div', null,
      h('h3', null, c.name),
      h('p', { class: 'lp-cats' }, c.categories.map((k) => copy.categories[k]).join(' · ')),
      item && item.title !== c.name ? h('p', { class: 'lp-title' }, fill(copy.iconTitle, { title: item.title })) : null,
      // without the manifest we can't tell which marks exist, so no origin claim at all
      m ? h('span', { class: 'lp-origin' }, item ? copy.originIcon : copy.originName) : null,
      links.length ? h('p', { class: 'lp-links' }, ...links) : null))
}
