import './core/perf' // first: the ?perf=1 HUD must see every rAF / WebGL context
import '@fontsource/noto-serif/300.css'
import '@fontsource/noto-serif/400.css'
import '@fontsource/noto-serif/500.css'
import '@fontsource/be-vietnam-pro/400.css'
import '@fontsource/be-vietnam-pro/500.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/ui.css'

import { h } from './core/dom'
import { L, partOfStation } from './core/content'
import { apply, onQualityChoice } from './core/prefs'
import { inkDefs } from './ui/ink'
import { topbar, setCrumb, setPart } from './ui/topbar'
import { renderMap } from './ui/map'
import { renderStation } from './ui/station'
import { partTwoAdvice } from './ui/hint'

apply()

const main = h('main', { id: 'main', tabindex: '-1' })
const skip = h('a', { class: 'skip', href: '#main', onClick: (e: Event) => (e.preventDefault(), main.focus()) }, L.skip)
document.body.append(inkDefs(), skip, topbar(), main)

let cleanup: (() => void) | null = null
let token = 0

async function route() {
  const my = ++token
  const stale = () => my !== token
  cleanup?.()
  cleanup = null
  main.replaceChildren()
  main.className = ''
  setCrumb(null)
  delete document.documentElement.dataset.garden

  const m = location.hash.match(/^#\/tram\/(\d+)(?:\/(\d+))?/)
  // Part 2 = its map and stations 19–39; everything else (intro, glossary, exam, logos) counts as Part 1
  const part = m ? partOfStation(Number(m[1])) : location.hash === '#/vuon-trang' ? 2 : 1
  setPart(part)
  if (part === 2) document.documentElement.dataset.part = '2'
  else delete document.documentElement.dataset.part

  if (m) {
    const c = await renderStation(main, Number(m[1]), Math.max(0, Number(m[2] ?? 1) - 1), stale)
    if (stale()) c?.()
    else cleanup = c
  } else if (location.hash === '#/tu-dien' || location.hash === '#/bai-thi') {
    const mod = location.hash === '#/tu-dien' ? await import('./extras/glossary') : await import('./extras/exam')
    if (!stale()) cleanup = mod.render(main)
  } else if (location.hash === '#/logos') {
    main.className = 'scroll-page'
    const { renderLogos } = await import('./ui/logos-page')
    if (!stale()) cleanup = renderLogos(main)
  } else {
    // '#/' = home (title in the mist, then into the garden); '#/vuon' = the garden map directly; '#/vuon-trang' = Part 2
    cleanup = renderMap(main, { part, withIntro: part === 1 && location.hash !== '#/vuon' })
  }
  if (part === 2 && !stale()) partTwoAdvice()
}

addEventListener('hashchange', route)
// Re-mount the current scene when the viewer changes quality (renderer DPR, particle counts…).
// Auto-low (spec A.8) only switches data-quality and applies from the next scene.
onQualityChoice(route)
route()
