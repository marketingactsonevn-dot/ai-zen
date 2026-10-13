import { prefs } from './prefs'

let ac: AudioContext | null = null
const NOTES = { soft: [528], ok: [528, 792], tap: [880], low: [264] } as const

/** Very quiet bell. Silent unless the visitor turned sound on. */
export function chime(kind: keyof typeof NOTES = 'soft') {
  if (!prefs.sound) return
  try {
    ac ??= new AudioContext()
    const t0 = ac.currentTime
    NOTES[kind].forEach((f, i) => {
      const o = ac!.createOscillator()
      const g = ac!.createGain()
      const t = t0 + i * 0.09
      o.type = 'sine'
      o.frequency.value = f
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.045, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4)
      o.connect(g).connect(ac!.destination)
      o.start(t)
      o.stop(t + 1.5)
    })
  } catch {
    /* audio unavailable */
  }
}
