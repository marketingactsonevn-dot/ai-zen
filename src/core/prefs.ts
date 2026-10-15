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
  /** null = the viewer never chose; the device decides, and auto-low (spec A.8) may lower it for this session */
  quality: load<Quality | null>('quality', null),
}
let autoLow = (() => {
  try {
    return sessionStorage.getItem('aizen:autoLow') === '1'
  } catch {
    return false
  }
})()

const listeners = new Set<() => void>()

export const prefs = {
  get theme(): Theme {
    return state.theme === 'auto' ? (mqDark.matches ? 'dark' : 'light') : state.theme
  },
  get sound() {
    return state.sound
  },
  get quality(): Quality {
    return state.quality ?? (weakDevice || autoLow ? 'low' : 'high')
  },
  /** The viewer picked a quality themselves (it wins over auto-low). */
  get qualityChosen() {
    return state.quality != null
  },
  get reduced() {
    return mqReduce.matches
  },
  /** Calm motion (touch screens, quality=low): transitions use opacity + transform only, never filters. */
  get calm() {
    return coarse || prefs.quality === 'low'
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
const choiceListeners = new Set<() => void>()
export function setQuality(q: Quality) {
  state.quality = q
  save('quality', q)
  apply()
  choiceListeners.forEach((f) => f())
}
/** The viewer changed quality themselves (main re-mounts the scene for it; auto-low does not). */
export function onQualityChoice(fn: () => void) {
  choiceListeners.add(fn)
  return () => void choiceListeners.delete(fn)
}
/** The device struggled (spec A.8): light version for the rest of the session, from the next scene on. */
export function setAutoLow(): boolean {
  if (state.quality != null || autoLow) return false
  autoLow = true
  try {
    sessionStorage.setItem('aizen:autoLow', '1')
  } catch {
    /* lasts until reload */
  }
  apply()
  return true
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
