import { fill, h } from '../core/dom'
import { ALL_STATIONS, L, SITE } from '../core/content'
import { onPrefs, prefs, setQuality, setSound, setTheme } from '../core/prefs'
import { progress } from '../core/progress'
import { chime } from '../core/sound'
import { icon } from './icons'
import { brandMark } from './brush'

const crumb = h('a', { class: 'crumb', href: '#/vuon' })

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
    count.textContent = fill(L.progress, { n: progress.visitedCount(), total: ALL_STATIONS.length })
  }
  progress.onChange(sync)
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
    h('div', { class: 'tools' }, count, lang, themeBtn, soundBtn, qualityBtn))
}
