import { h, s } from '../core/dom'
import { ALL_STATIONS, L, PARTS, addSources, displayNo, stationIndex, type Fact } from '../core/content'
import { STATIONS } from '../stations/registry'
import type { SceneCtx, SceneDef, StationModule } from '../stations/types'
import { prefs } from '../core/prefs'
import { progress } from '../core/progress'
import { gsap } from '../core/anim'
import { chime } from '../core/sound'
import { fact, tag } from './fact'
import { quizScene } from './quiz'
import { icon } from './icons'
import { setCrumb } from './topbar'
import { ensoBrush } from './brush'
import { prefetchStation, whenIdle } from './prefetch'
import { watchScene } from './autolow'

const TYPING = 'input, textarea, select, [contenteditable], [role="slider"], [role="listbox"]'

/** Station = full-viewport scene player: art → interaction → insight, flipped with ← → or the rail. */
export async function renderStation(root: HTMLElement, id: number, start: number, stale: () => boolean): Promise<(() => void) | null> {
  const idx = stationIndex(id)
  if (idx < 0) {
    location.hash = '#/vuon'
    return null
  }
  const meta = ALL_STATIONS[idx]
  const part = meta.garden.part
  const after = ALL_STATIONS[idx + 1]
  const next = after?.garden.part === part ? after : undefined // "next station" never crosses into the other part
  const mapHref = PARTS.find((p) => p.id === part)?.route ?? '#/vuon'
  document.documentElement.dataset.garden = String(meta.garden.id)
  setCrumb(`${displayNo(id)}  ${meta.title}`)

  const player = h('section', { class: 'player', 'aria-label': `${L.station} ${part === 1 ? id : displayNo(id)}: ${meta.title}` }) // Part 1 aria unchanged
  root.append(player)

  const loader = STATIONS[id]
  if (!loader) {
    player.append(soon(meta.title, mapHref))
    return () => {}
  }
  const loading = h('p', { class: 'player-loading' }, L.loading)
  player.append(loading)
  let mod: StationModule
  try {
    mod = (await loader()).default
  } catch (e) {
    console.error(e)
    loading.textContent = L.error
    return null
  }
  if (stale()) return null
  loading.remove()
  addSources(mod.content.sources)
  progress.visit(id)

  // the last station of Part 1 (18) has no next one: its ensō leads over the bridge to Part 2 instead
  const scenes: SceneDef[] = [...mod.scenes, quizScene(id, mod.content.quiz), summaryScene(mod.content.summary, mapHref, next, !next && part === 1)]
  const explored = new Set<number>()
  const host = h('div', { class: 'scenes' })
  const prevBtn = h('button', { class: 'rail-btn', type: 'button', 'aria-label': L.prevScene, onClick: () => go(cur - 1) }, icon('arrowL'))
  const nextBtn = h('button', { class: 'rail-btn next', type: 'button', 'aria-label': L.nextScene, onClick: () => (cur === scenes.length - 1 && next ? (location.hash = `#/tram/${next.id}`) : go(cur + 1)) }, icon('arrowR'))
  const dots = scenes.map((sc, i) =>
    h('button', { class: `rail-dot${i === scenes.length - 2 ? ' is-quiz' : i === scenes.length - 1 ? ' is-end' : ''}`, type: 'button', 'aria-label': `${i + 1}. ${sc.label}`, title: sc.label, onClick: () => go(i) }))
  const rail = h('nav', { class: 'rail', 'aria-label': L.sceneNav }, prevBtn, h('div', { class: 'rail-dots' }, ...dots), nextBtn)
  player.append(host, rail)

  let cur = -1 // the scene the rail points at (where the viewer is going)
  let curEl: HTMLElement | null = null // the scene actually mounted
  let curCleanup: (() => void) | null = null
  let leaving: Animation | null = null // the mounted scene is fading out; the swap then mounts whatever `cur` is by then
  let disposed = false
  let unwatch: (() => void) | null = null // auto-low watch on the mounted scene
  const calm = prefs.calm

  // Old scene out → cleaned up → new scene mounted → in. Two heavy scenes (WebGL, physics, loops) never live together,
  // and spamming ← → only mounts the last target. Transitions run on the compositor (WAAPI), so a heavy mount can't stutter them.
  function go(i: number) {
    i = Math.max(0, Math.min(scenes.length - 1, i))
    if (i === cur) return
    const dir = i > cur ? 1 : -1
    cur = i
    sync()
    history.replaceState(null, '', `#/tram/${id}/${i + 1}`)
    if (leaving) return
    if (!curEl || prefs.reduced) return swap(dir)
    const el = curEl
    el.inert = true
    const from = getComputedStyle(el).opacity // may still be fading in
    el.getAnimations().forEach((a) => a.cancel())
    leaving = el.animate([{ opacity: from }, { opacity: 0, transform: calm ? 'translateY(-6px)' : `translateX(${-30 * dir}px)` }], {
      duration: calm ? 160 : 320,
      easing: 'cubic-bezier(0.55, 0.085, 0.68, 0.53)', // power2.in
      fill: 'forwards',
    })
    // Revert the old scene's gsap context OUTSIDE gsap's render loop: reverting inside a tween callback
    // flags gsap as "reverting" mid-frame and rewinds the new scene's from() tweens (stones stuck invisible).
    leaving.onfinish = () => void setTimeout(() => !disposed && swap(dir))
  }

  function swap(dir: number) {
    leaving = null
    const first = !curEl
    curCleanup?.()
    curEl?.remove()
    const { el, cleanup } = mountScene(cur)
    curEl = el
    curCleanup = cleanup
    unwatch?.()
    unwatch = watchScene(el)
    if (first || prefs.reduced) return
    // calm: ink settling into paper — a soft fade with a few pixels of drift; rich: the old feel, with a light 3 px blur
    el.animate(
      calm
        ? [{ opacity: 0, transform: 'translateY(10px) scale(0.995)' }, { opacity: 1, transform: 'none' }]
        : [{ opacity: 0, transform: `translateX(${50 * dir}px)`, filter: 'blur(3px)' }, { opacity: 1, transform: 'none', filter: 'blur(0px)' }],
      { duration: calm ? 420 : 900, easing: 'cubic-bezier(0.215, 0.61, 0.355, 1)' }, // power3.out
    )
  }

  function sync() {
    dots.forEach((d, i) => {
      d.classList.toggle('on', i === cur)
      d.classList.toggle('seen', explored.has(i))
      if (i === cur) d.setAttribute('aria-current', 'step')
      else d.removeAttribute('aria-current')
    })
    prevBtn.disabled = cur === 0
    nextBtn.disabled = cur === scenes.length - 1 && !next
    nextBtn.classList.toggle('ready', explored.has(cur))
    nextBtn.setAttribute('aria-label', cur === scenes.length - 1 && next ? `${L.next}: ${next.title}` : L.nextScene)
  }

  function mountScene(i: number) {
    const art = h('div', { class: 'scene-art' })
    const foot = h('div', { class: 'scene-foot' })
    const el = h('div', { class: 'scene', 'data-scene': i + 1, role: 'group', 'aria-label': scenes[i].label }, art, foot)
    host.append(el)
    const cleanups: (() => void)[] = []
    const gctx = gsap.context(() => {}, el)
    let promptEl: HTMLElement | null = null
    let insightEl: HTMLElement | null = null

    const hidePrompt = () => {
      if (!promptEl) return
      const p = promptEl
      promptEl = null
      p.classList.add('out')
      setTimeout(() => p.remove(), 500)
    }
    art.addEventListener('pointerdown', hidePrompt)
    el.addEventListener('keydown', (e) => !['ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key) && hidePrompt())

    const markExplored = () => {
      if (explored.has(i)) return
      explored.add(i)
      if (i === cur) sync()
    }

    const ctx: SceneCtx = {
      reduced: prefs.reduced,
      quality: prefs.quality,
      art,
      el,
      prompt(text) {
        promptEl?.remove()
        promptEl = h('p', { class: 'scene-prompt', role: 'status' }, h('span', { class: 'prompt-dot', 'aria-hidden': 'true' }), text)
        foot.append(promptEl)
      },
      insight(f: Fact | string, detail?: Fact | string) {
        hidePrompt()
        insightEl?.remove()
        const box = h('div', { class: 'scene-insight', 'aria-live': 'polite' }, fact(f, 'p', 'insight-text'))
        if (detail) {
          const more = fact(detail, 'p', 'insight-detail')
          more.hidden = true
          const btn = h('button', { class: 'insight-more', type: 'button', 'aria-expanded': 'false' }, L.more)
          btn.addEventListener('click', () => {
            more.hidden = !more.hidden
            btn.setAttribute('aria-expanded', String(!more.hidden))
            btn.textContent = more.hidden ? L.more : L.less
          })
          box.append(btn, more)
        }
        foot.prepend(box)
        insightEl = box
        if (!prefs.reduced) {
          gctx.add(() => gsap.fromTo(box, { clipPath: 'inset(0 100% 0 0)', opacity: 0.2 }, { clipPath: 'inset(0 -2% 0 0)', opacity: 1, duration: 1.4, ease: 'power2.out', clearProps: 'clipPath' }))
        }
        markExplored()
        return box
      },
      complete: markExplored,
      fact,
      tag,
      chime,
      anim: (fn) => void gctx.add(fn),
      onCleanup: (fn) => void cleanups.push(fn),
    }
    gctx.add(() => {
      try {
        const c = scenes[i].mount(ctx)
        if (typeof c === 'function') cleanups.push(c)
      } catch (e) {
        console.error(e)
        art.append(h('p', { class: 'player-loading' }, L.error))
      }
    })
    return {
      el,
      cleanup: () => {
        cleanups.reverse().forEach((f) => {
          try {
            f()
          } catch (e) {
            console.error(e)
          }
        })
        gctx.revert()
      },
    }
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey) return
    if ((e.target as Element).closest?.(TYPING)) return
    if (e.key === 'ArrowRight' || e.key === 'PageDown') (e.preventDefault(), nextBtn.click())
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') (e.preventDefault(), go(cur - 1))
  }
  addEventListener('keydown', onKey)

  go(Math.min(start, scenes.length - 1))
  const chapterCleanup = start === 0 ? chapter(player, displayNo(id), meta.title, mod.content.kicker, calm) : null

  return () => {
    disposed = true
    leaving?.cancel()
    unwatch?.()
    removeEventListener('keydown', onKey)
    chapterCleanup?.()
    curCleanup?.()
    gsap.killTweensOf(host.children)
  }
}

/** Opening card: big station number + title + one metaphor line, dissolves into the first scene. */
function chapter(player: HTMLElement, no: string, title: string, kicker: string, calm: boolean) {
  const card = h('div', { class: 'chapter', role: 'presentation' },
    h('p', { class: 'chapter-num' }, no),
    h('h1', { class: 'chapter-title', tabindex: '-1' }, title),
    h('p', { class: 'chapter-kicker' }, kicker))
  player.append(card)
  ;(card.querySelector('h1') as HTMLElement).focus({ preventScroll: true })
  let done = false
  const close = () => {
    if (done) return
    done = true
    clearTimeout(timer)
    removeEventListener('keydown', close, true)
    if (prefs.reduced) card.remove()
    else if (calm) gsap.to(card, { opacity: 0, y: -8, duration: 0.6, ease: 'power2.inOut', onComplete: () => card.remove() })
    else gsap.to(card, { opacity: 0, filter: 'blur(10px)', scale: 1.02, duration: 0.9, ease: 'power2.inOut', onComplete: () => card.remove() })
  }
  if (!prefs.reduced) gsap.from(card.children, { opacity: 0, y: 16, ...(calm ? {} : { filter: 'blur(6px)' }), stagger: 0.18, duration: 1.2, ease: 'power3.out' })
  const timer = setTimeout(close, 2800)
  card.addEventListener('pointerdown', close)
  addEventListener('keydown', close, true)
  return () => {
    clearTimeout(timer)
    removeEventListener('keydown', close, true)
    card.remove()
  }
}

/** Last scene: an ensō is brushed, the one sentence to remember appears inside, then onward. */
function summaryScene(text: string, mapHref: string, next?: (typeof ALL_STATIONS)[number], toPartTwo = false): SceneDef {
  return {
    label: L.summaryEyebrow,
    mount(ctx) {
      const b = ensoBrush(text.length % 7)
      const mid = `enso-m-${Math.round(performance.now())}`
      const reveal = s('path', { d: b.spine, fill: 'none', stroke: '#fff', 'stroke-width': 40, 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': ctx.reduced ? 0 : 1 })
      const enso = s('svg', { class: 'enso', viewBox: '0 0 200 200', 'aria-hidden': 'true' },
        s('defs', null, s('mask', { id: mid, maskUnits: 'userSpaceOnUse', x: -20, y: -20, width: 240, height: 240 }, reveal)),
        s('g', { mask: `url(#${mid})` },
          s('path', { class: 'enso-bleed', d: b.body, filter: 'url(#ink-wash)' }),
          s('path', { class: 'enso-body', d: b.body, filter: 'url(#ink-rough)' }),
          ...b.streaks.map((d) => s('path', { class: 'enso-hair', d }))),
        // the painter's red seal (hanko), stamped beside the ensō — a small carved square, not a dot on the stroke
        s('g', { class: 'enso-seal', transform: 'translate(176 174) rotate(-5)' },
          s('rect', { class: 'enso-seal-ink', x: -8, y: -10, width: 16, height: 20, rx: 1.4, filter: 'url(#ink-rough)' }),
          s('path', { class: 'enso-seal-cut', d: 'M-1.2-5.6a4.3 4.3 0 1 0 4.6 2.2' }),
          s('path', { class: 'enso-seal-cut', d: 'M-4 3.6h8M-2.6 6.4h5.2' })))
      const textEl = h('p', { class: 'summary-text' }, text)
      const actions = h('div', { class: 'summary-actions' },
        next ? h('a', { class: 'btn primary', href: `#/tram/${next.id}` }, `${L.next}: ${next.title}`, icon('arrowR', 'icon sm')) : null,
        toPartTwo ? h('a', { class: 'btn primary', href: PARTS[1].route }, L.toPartTwo, icon('arrowR', 'icon sm')) : null,
        h('a', { class: 'btn ghost', href: mapHref }, L.backToMap))
      ctx.art.append(h('div', { class: 'summary' }, h('div', { class: 'summary-in' }, h('p', { class: 'summary-label' }, L.summaryEyebrow), h('div', { class: 'summary-ring' }, enso, textEl), actions)))
      ctx.complete()
      ctx.onCleanup(whenIdle(() => prefetchStation(next?.id))) // the next station is the likely click
      if (!ctx.reduced) {
        gsap.to(reveal, { attr: { 'stroke-dashoffset': 0 }, duration: 2.4, ease: 'power2.inOut', delay: 0.2 })
        gsap.from(enso.querySelector('.enso-seal'), { scale: 1.35, opacity: 0, transformOrigin: '50% 50%', duration: 0.45, delay: 2.5, ease: 'power3.in' })
        gsap.from(textEl, { opacity: 0, filter: 'blur(6px)', duration: 1.4, delay: 1.1 })
        gsap.from(actions, { opacity: 0, y: 10, duration: 1, delay: 1.8 })
      }
    },
  }
}

function soon(title: string, mapHref: string) {
  return h('div', { class: 'soon' },
    h('p', { class: 'soon-label' }, L.soon),
    h('h1', { tabindex: '-1' }, title),
    h('p', null, L.soonText),
    h('a', { class: 'btn ghost', href: mapHref }, L.backToMap))
}
