import { counters } from './perf'
import { prefs } from './prefs'

export interface Loop {
  /** Run every frame (while visible, tab shown, motion allowed). */
  start(): void
  /** Stop after the current frame. */
  stop(): void
  /** Request one frame now (dt = 0) — also under reduced motion; use after an interaction or a resize. */
  wake(): void
  dispose(): void
  readonly running: boolean
}

/**
 * The one way to run a frame loop (spec A.3). `fn(t, dt)` — t: seconds the loop has run, dt: frame delta in seconds
 * (≤ 0.05; 0 for a wake() frame) — runs once per frame while started, `host` intersects the viewport, the tab is
 * visible and motion is allowed. Reduced motion pauses it unless `essential` (the loop IS the interaction, e.g. a drag
 * that settles); wake() frames always run. Return false from fn to stop (start()/wake() resume). dispose() on unmount.
 * Inside fn: no getComputedStyle/cssVar, no getBoundingClientRect, no new arrays/objects — read colours on mount and
 * in onPrefs, sizes in a ResizeObserver.
 */
const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)')

export function createLoop(host: Element | null, fn: (t: number, dt: number) => void | boolean, opts: { essential?: boolean } = {}): Loop {
  let want = false
  let once = false
  let raf = 0
  let last = 0
  let t = 0
  let visible = !host
  let disposed = false
  let inTick = false // fn may call start()/wake() on its own loop: the reschedule after fn covers it
  counters.loops++

  const canTick = () => !disposed && visible && !document.hidden
  const canRun = () => canTick() && (opts.essential || !prefs.reduced)
  const cancel = () => {
    if (!raf) return
    cancelAnimationFrame(raf)
    raf = 0
    counters.ticking--
  }
  const schedule = () => {
    if (raf || inTick || !((want && canRun()) || (once && canTick()))) return
    last = performance.now()
    raf = requestAnimationFrame(tick)
    counters.ticking++
  }
  function tick(now: number) {
    raf = 0
    counters.ticking--
    const run = want && canRun()
    const dt = run ? Math.min(0.05, Math.max(0, (now - last) / 1000)) : 0
    last = now
    t += dt
    once = false
    inTick = true
    const r = fn(t, dt)
    inTick = false
    if (r === false) want = false
    if ((want && canRun()) || (once && canTick())) {
      raf = requestAnimationFrame(tick)
      counters.ticking++
    }
  }

  const io = host
    ? new IntersectionObserver(([e]) => {
        visible = e.isIntersecting
        if (visible) schedule()
        else cancel()
      })
    : null
  if (host) io!.observe(host)
  const onVis = () => (document.hidden ? cancel() : schedule())
  document.addEventListener('visibilitychange', onVis)
  // reduced motion switched in the OS while the loop exists: pause decorative loops, resume them when it is off again
  const onReduce = () => (canRun() ? schedule() : !once && !opts.essential && cancel())
  reduceQuery.addEventListener('change', onReduce)

  return {
    start() {
      want = true
      schedule()
    },
    stop() {
      want = false
      cancel()
    },
    wake() {
      once = true
      schedule()
    },
    dispose() {
      if (disposed) return
      disposed = true
      want = once = false
      cancel()
      io?.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      reduceQuery.removeEventListener('change', onReduce)
      counters.loops--
    },
    get running() {
      return raf !== 0
    },
  }
}
