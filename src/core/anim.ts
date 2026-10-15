import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { prefs } from './prefs'

export { gsap }

/**
 * Fade-up every [data-reveal] inside root as it scrolls into view. Call inside a gsap.context.
 * ScrollTrigger runs its own rAF loop for as long as it is enabled, so it is registered on first use and the
 * returned cleanup disables it again (spec A.9: no loop outlives the page that needs it).
 */
export function revealIn(root: ParentNode): () => void {
  if (prefs.reduced) return () => {}
  gsap.registerPlugin(ScrollTrigger)
  ScrollTrigger.enable()
  root.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
    gsap.from(el, {
      opacity: 0,
      y: 26,
      duration: 1.1,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    })
  })
  return () => ScrollTrigger.disable()
}

// Dev-only handle so automated visual checks can fast-forward motion (e.g. __aizen.gsap.globalTimeline.timeScale(20)).
if (import.meta.env.DEV) Object.assign(((window as unknown as { __aizen?: object }).__aizen ??= {}), { gsap })
