import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { prefs } from './prefs'

gsap.registerPlugin(ScrollTrigger)
export { gsap, ScrollTrigger }

/** Fade-up every [data-reveal] inside root as it scrolls into view. Call inside a gsap.context. */
export function revealIn(root: ParentNode) {
  if (prefs.reduced) return
  root.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
    gsap.from(el, {
      opacity: 0,
      y: 26,
      duration: 1.1,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    })
  })
}

// Dev-only handle so automated visual checks can fast-forward motion (e.g. __aizen.gsap.globalTimeline.timeScale(20)).
if (import.meta.env.DEV) (window as unknown as { __aizen: unknown }).__aizen = { gsap, ScrollTrigger }
