import { STATIONS } from '../stations/registry'

// Fetch the next chunk before it is needed (spec A.7). Importing a station chunk also pulls its CSS and, for 3D
// stations, the shared three.js chunk — all cached by the module system, so the real visit only mounts.

type Conn = { saveData?: boolean; effectiveType?: string }
/** Data saver on, or a 2g/3g link: only fetch what the viewer actually opens. */
export const lightNet = () => {
  const c = (navigator as Navigator & { connection?: Conn }).connection
  return !!c && (c.saveData === true || /(^|-)(2g|3g)$/.test(c.effectiveType ?? ''))
}

const asked = new Set<number>()
/** Download + evaluate a station's chunk ahead of the visit (once; unbuilt ids are ignored). */
export function prefetchStation(id: number | undefined) {
  if (id == null || asked.has(id) || !STATIONS[id]) return
  asked.add(id)
  STATIONS[id]!().catch(() => asked.delete(id))
}

/** three.js for the first 3D scene, unless the network is light. */
export function prefetchThree() {
  if (!lightNet()) import('../core/three-stage').catch(() => {})
}

/** Run fn when the browser is idle (at the latest after `timeout` ms); returns a cancel function. */
export function whenIdle(fn: () => void, timeout = 4000): () => void {
  const w = window as Window & { requestIdleCallback?: (f: () => void, o: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void }
  if (w.requestIdleCallback && w.cancelIdleCallback) {
    const id = w.requestIdleCallback(fn, { timeout })
    return () => w.cancelIdleCallback!(id)
  }
  const id = setTimeout(fn, 1200)
  return () => clearTimeout(id)
}
