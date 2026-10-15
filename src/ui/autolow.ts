import { h } from '../core/dom'
import { L } from '../core/content'
import { createLoop } from '../core/loop'
import { prefs, setAutoLow, setQuality } from '../core/prefs'

/**
 * Spec A.8: watch the first 4 s of a scene. If the device can't keep up (average < 40 fps, or 3 frames > 50 ms),
 * this session switches to the light version from the next scene on — the current scene is not re-mounted — and
 * a small note says so once, with a way back. The viewer's own quality choice always wins.
 */
export function watchScene(el: HTMLElement): () => void {
  if (prefs.quality === 'low' || prefs.qualityChosen || prefs.reduced) return () => {}
  let last = 0
  let time = 0
  let frames = 0
  let slow = 0
  const loop = createLoop(el, () => {
    const now = performance.now()
    const d = last ? now - last : 0
    last = now
    if (!d || d > 1000) return // first frame, or back from a hidden tab / offscreen: not a slow device
    time += d
    frames++
    if (d > 50) slow++
    if (slow >= 3 || (time >= 4000 && (frames * 1000) / time < 40)) {
      if (setAutoLow()) toast()
      return false
    }
    if (time >= 4000) return false
  })
  loop.start()
  return () => loop.dispose()
}

function toast() {
  const keep = h('button', { class: 'btn ghost', type: 'button' }, L.keepRich)
  const note = h('div', { class: 'toast', role: 'status' }, h('span', null, L.autoLowToast), keep)
  const close = () => note.remove()
  keep.addEventListener('click', () => {
    close()
    setQuality('high') // the viewer's choice: re-mounts the scene in high quality
  })
  document.body.append(note)
  setTimeout(close, 9000)
}
