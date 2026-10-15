import { load, save } from './store'

export type Theme = 'light' | 'dark'
export type Quality = 'high' | 'low'

const mqDark = matchMedia('(prefers-color-scheme: dark)')
const mqReduce = matchMedia('(prefers-reduced-motion: reduce)')
const coarse = matchMedia('(pointer: coarse)').matches
const weakDevice = coarse || ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) < 4

const state = {
  theme: load<Theme | 'auto'>('theme', 'auto'),
  sound: load<boolean>('sound', false), // muted by default
  quality: load<Quality>('quality', weakDevice ? 'low' : 'high'),
}

const listeners = new Set<() => void>()

export const prefs = {
  get theme(): Theme {
    return state.theme === 'auto' ? (mqDark.matches ? 'dark' : 'light') : state.theme
  },
  get sound() {
    return state.sound
  },
  get quality() {
    return state.quality
  },
  get reduced() {
    return mqReduce.matches
  },
  /** Calm motion (touch screens, quality=low): transitions use opacity + transform only, never filters. */
  get calm() {
    return coarse || state.quality === 'low'
  },
}

export function setTheme(t: Theme) {
  state.theme = t
  save('theme', t)
  apply()
}
export function setSound(on: boolean) {
  state.sound = on
  save('sound', on)
  apply()
}
export function setQuality(q: Quality) {
  state.quality = q
  save('quality', q)
  apply()
}

/** Subscribe to theme/sound/quality changes (canvas scenes re-read CSS colours here). */
export function onPrefs(fn: () => void) {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

export function apply() {
  const d = document.documentElement.dataset
  d.theme = prefs.theme
  d.quality = prefs.quality
  listeners.forEach((f) => f())
}

mqDark.addEventListener('change', apply)

/** Read a design token, e.g. cssVar('--moss'). */
export function cssVar(name: string, el: Element = document.documentElement): string {
  return getComputedStyle(el).getPropertyValue(name).trim()
}
