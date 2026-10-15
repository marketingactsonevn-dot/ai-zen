import { fill, h } from '../core/dom'
import { L, PARTS, SITE, stationsOfPart } from '../core/content'
import { onPrefs, prefs, setQuality, setSound, setTheme } from '../core/prefs'
import { progress } from '../core/progress'
import { chime } from '../core/sound'
import { icon } from './icons'
import { brandMark } from './brush'
import { crossBridge } from './moon-garden'

const crumb = h('a', { class: 'crumb', href: '#/vuon' })
let part = 1 // the part being viewed: its map is the crumb target and the counter counts its stations
let syncPart = () => {}

/** Set by the router: Part 2 map / stations 19–39 = 2, everything else (intro, glossary, exam…) = 1. */
export function setPart(p: number) {
  part = p
  crumb.href = PARTS.find((x) => x.id === p)?.route ?? '#/vuon'
  syncPart()
}

/** Station label next to the brand ("01  AI là gì?"); null on the map. */
export function setCrumb(text: string | null) {
  crumb.textContent = text ?? ''
  crumb.hidden = !text
  crumb.title = L.backToMap
}

export function topbar(): HTMLElement {
  const themeBtn = h('button', { class: 'icon-btn', type: 'button', onClick: () => setTheme(prefs.theme === 'dark' ? 'light' : 'dark') })
  const soundBtn = h('button', { class: 'icon-btn', type: 'button', onClick: () => (setSound(!prefs.sound), chime('soft')) })
  const qualityBtn = h('button', { class: 'icon-btn', type: 'button', onClick: () => setQuality(prefs.quality === 'high' ? 'low' : 'high') })
  const count = h('span', { class: 'pcount', role: 'status' })
  // "I · II": the two gardens, the one being viewed marked aria-current
  const partLinks = PARTS.map((pt, i) => {
    const a = h('a', { class: 'icon-btn lang part-link', href: pt.route, 'aria-label': `${['I', 'II'][i]} · ${pt.name}`, title: pt.name }, ['I', 'II'][i])
    // to the other garden: the same "trăng lên" crossing as the bridge
    a.addEventListener('click', (e) => {
      if (pt.id === part || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      e.preventDefault()
      crossBridge(pt.route, pt.id as 1 | 2, document.activeElement === a)
    })
    return a
  })
  const partSwitch = h('nav', { class: 'part-switch', 'aria-label': L.part }, partLinks[0], h('span', { 'aria-hidden': 'true' }, '·'), partLinks[1])

  const syncCount = () => {
    const sts = stationsOfPart(part)
    count.textContent = fill(L.progress, { n: sts.filter((st) => progress.isVisited(st.id)).length, total: sts.length })
    partLinks.forEach((a, i) => (PARTS[i].id === part ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')))
  }
  const label = (b: HTMLElement, text: string) => (b.setAttribute('aria-label', text), (b.title = text))
  const sync = () => {
    const dark = prefs.theme === 'dark'
    themeBtn.replaceChildren(icon(dark ? 'sun' : 'moon'))
    label(themeBtn, dark ? L.themeToLight : L.themeToDark)
    soundBtn.replaceChildren(icon(prefs.sound ? 'soundOn' : 'soundOff'))
    soundBtn.setAttribute('aria-pressed', String(prefs.sound))
    label(soundBtn, prefs.sound ? L.soundOff : L.soundOn)
    const high = prefs.quality === 'high'
    qualityBtn.replaceChildren(icon(high ? 'leafHigh' : 'leafLow'))
    label(qualityBtn, high ? L.qualityHigh : L.qualityLow)
    syncCount()
  }
  syncPart = syncCount
  progress.onChange(syncCount)
  onPrefs(sync)
  sync()
  setCrumb(null)

  // The other edition: the English build lives in /en/ next to the Vietnamese one (dev: the LOCALE=en server on :5180).
  const en = __LOCALE__ === 'en'
  const otherBase = import.meta.env.DEV ? (en ? 'http://localhost:5179/' : 'http://localhost:5180/') : en ? '../' : './en/'
  const otherName = en ? 'Tiếng Việt' : 'English'
  const lang = h('a', { class: 'icon-btn lang', href: otherBase, hreflang: en ? 'vi' : 'en', lang: en ? 'vi' : 'en', 'aria-label': otherName, title: otherName }, en ? 'VI' : 'EN')
  lang.addEventListener('click', (e) => {
    e.preventDefault()
    location.href = otherBase + location.hash
  })

  return h('header', { class: 'topbar' },
    h('a', { class: 'brand', href: '#/', 'aria-label': `${SITE.title} — ${L.home}` }, brandMark(), h('span', { class: 'brand-name' }, SITE.title)),
    crumb,
    h('div', { class: 'tools' }, count, partSwitch, lang, themeBtn, soundBtn, qualityBtn))
}
