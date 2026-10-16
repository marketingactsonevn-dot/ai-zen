import { s } from '../../core/dom'
import { stoneArt } from '../../ui/part2/ink'
import { mist } from '../../ui/part2/paint'
import type { TideArt } from '../../ui/part2/tide'
import { blob, rng, stroke, type Pt } from './kit'

const f1 = (n: number) => (Math.round(n * 10) / 10).toString()

/**
 * Scene 2 art — an old well in section laid along the scroll: stone rings set course by course through the years, the
 * water rising one notch per milestone, a carved date stone at each notch, the moon gliding along the well's lip and
 * white mist over the mouth at the end.
 */
export const depthArt: TideArt = {
  back({ w, h, ground, xs, roll, seed }) {
    const r = rng(seed + 31)
    const n = xs.length - 1
    const lipY = Math.max(10, h * 0.1) // the inner face of the top wall
    const xEnd = xs[n] + Math.max(24, (xs[n] - xs[n - 1]) * 0.45) // the mouth opens after today
    const x0 = roll
    // the two walls of the shaft: courses of cut stones, upright joints staggered ring by ring
    const wall = (y0: number, y1: number, to: number) => {
      let joints = ''
      const rows = Math.max(1, Math.round((y1 - y0) / 13))
      for (let k = 0; k <= rows; k++) {
        const y = y0 + ((y1 - y0) * k) / rows
        if (k > 0 && k < rows) joints += stroke([[x0, y + (r() - 0.5)], [(x0 + to) / 2, y + (r() - 0.5) * 2], [to, y]], 1.1, 0.02, 0.05, 0.4)
        if (k === rows) continue
        const yb = y0 + ((y1 - y0) * (k + 1)) / rows
        for (let x = x0 + (k % 2 ? 14 : 2) + r() * 8; x < to - 6; x += 22 + r() * 12) joints += stroke([[x, y + 1], [x + (r() - 0.5) * 2, yb - 1]], 1.1, 0.2, 0.2, 0.4)
      }
      return joints
    }
    const top = `M${f1(x0)} 0L${f1(xEnd)} 0L${f1(xEnd + 6)} ${f1(lipY * 0.6)}Q${f1(xEnd + 2)} ${f1(lipY + 2)} ${f1(xEnd - 8)} ${f1(lipY)}L${f1(x0)} ${f1(lipY)}Z`
    const bed = `M${f1(x0)} ${f1(ground + 3)}L${f1(w - roll)} ${f1(ground + 3)}L${f1(w - roll)} ${f1(h)}L${f1(x0)} ${f1(h)}Z`
    // the back wall of the shaft: irregular cut stones in rows; each stretch between stops is one ring of years, in its own tone
    const mids = xs.map((x, i) => (i ? (xs[i - 1] + x) / 2 : x0))
    const ringOf = (x: number) => mids.filter((m) => m <= x).length
    const stones = ['', '']
    const rh = Math.max(14, (ground - lipY) / Math.max(4, Math.round((ground - lipY) / 20)))
    for (let y = lipY + 2, row = 0; y < ground - 4; y += rh, row++) {
      for (let x = x0 + (row % 2 ? -16 : 0) + r() * 6; x < xEnd; ) {
        const sw = 34 + r() * 26
        const cx = x + sw / 2
        stones[ringOf(cx) % 2] += blob(cx, y + rh / 2, sw / 2 - 2.2, rh / 2 - 2, seed + row * 50 + Math.round(x), 0.16, 8)
        x += sw
      }
    }
    // the water: one level per stretch between stops, a notch higher at every milestone, soft ramps between
    const lvl = (i: number) => ground - h * (0.08 + (0.44 * i) / n)
    let water = `M${f1(x0)} ${f1(ground + 2)}L${f1(x0)} ${f1(lvl(0))}`
    let surf = '', notches = '', glints = ''
    for (let i = 0; i <= n; i++) {
      const a = mids[i], b = i < n ? mids[i + 1] : xEnd
      const y = lvl(i)
      const ramp = Math.min(16, (b - a) * 0.12)
      if (i) water += `Q${f1(a)} ${f1(lvl(i - 1))} ${f1(a + ramp * 0.5)} ${f1((lvl(i - 1) + y) / 2)}Q${f1(a + ramp)} ${f1(y)} ${f1(a + ramp * 2)} ${f1(y)}`
      water += `L${f1(b - ramp)} ${f1(y + 0.6)}`
      for (let k = 0; k < 4; k++) {
        const sx = a + ramp * 2 + (b - a - ramp * 3) * (k / 4) + r() * 10
        surf += stroke([[sx, y + 1 + k * 0.3], [sx + (b - a) * (0.08 + r() * 0.1), y + 1.4 + (r() - 0.5)]], 1.4 - k * 0.15, 0.2, 0.3, 0.15)
      }
      for (let k = 0; k < 4; k++) {
        const gx = a + (b - a) * (0.15 + r() * 0.7)
        const gy = y + 6 + r() * (ground - y - 12)
        glints += stroke([[gx, gy], [gx + 5 + r() * 12, gy + (r() - 0.5)]], 1, 0.3, 0.3, 0.1)
      }
      // the notch the water reached, cut into the wall at the start of each stretch
      notches += stroke([[a + 2, y - 3.5], [a + 9, y - 4.2], [a + 16, y - 3.8]], 2.4, 0.15, 0.4, 0.3)
    }
    water += `L${f1(xEnd)} ${f1(lvl(n))}L${f1(xEnd)} ${f1(ground + 2)}Z`
    const moss = blob(x0 + 26, lipY + 2, 26, 4, seed + 1, 0.3, 12) + blob(x0 + 70, ground + 5, 34, 4, seed + 2, 0.3, 12) + blob(xs[1] - 10, lipY + 1, 18, 3, seed + 3, 0.3, 12)
    return [
      s('rect', { class: 't31d-shaft', x: f1(x0), y: 0, width: f1(xEnd - x0), height: f1(ground + 3) }),
      s('path', { class: 't31d-stones', d: stones[0] }),
      s('path', { class: 't31d-stones t31d-ring', d: stones[1] }),
      s('path', { class: 'g11-wash t31d-notch', d: notches, filter: 'url(#ink-rough)' }),
      s('path', { class: 't31d-water', d: water, fill: 'url(#p2-water-v)', filter: 'url(#ink-wash)' }),
      s('path', { class: 't31d-glint', d: glints }),
      s('path', { class: 't31d-surf', d: surf }),
      s('path', { class: 't31d-wall', d: top, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
      s('path', { class: 'g11-wash t31d-joint', d: wall(0, lipY, xEnd) }),
      s('path', { class: 'g11-wash t31d-lip', d: stroke([[x0, lipY], [(x0 + xEnd) / 2, lipY + 0.8], [xEnd - 6, lipY]], 2.2, 0.02, 0.1, 0.4), filter: 'url(#ink-rough)' }),
      s('path', { class: 't31d-bed', d: bed, fill: 'url(#p2-rock)' }),
      s('path', { class: 'g11-wash t31d-joint t31d-bedj', d: wall(ground + 3, h, w - roll) }),
      s('path', { class: 'g11-mossy', d: moss, filter: 'url(#ink-wash)' }),
      // the mouth: the wall ends, the mist rolls over it
      mist(xEnd + (w - xEnd) * 0.35, lipY + h * 0.08, (w - xEnd) * 0.9 + 30, h * 0.26),
      mist(xEnd + 10, ground - h * 0.18, (w - xEnd) * 0.7 + 30, h * 0.34),
    ]
  },
  // a small stone at each notch with the date carved into it
  mark(i, size, seed) {
    const sw = size * 0.82, sh = size * 0.5
    const r = rng(seed)
    let cut = ''
    for (let k = 0; k < 2; k++) {
      const y = -sh * (0.52 - k * 0.2)
      const x = -sw * (0.22 - r() * 0.06)
      cut += stroke([[x, y], [x + sw * (0.32 + r() * 0.12), y - 0.4]], 1.3, 0.2, 0.3, 0.3)
    }
    return s('g', { class: 't31d-mark' },
      stoneArt(sw, sh, seed + i),
      s('path', { class: 'g11-wash t31d-cut', d: cut }),
      s('path', { class: 'g11-seal', d: stroke([[sw * 0.18, -sh * 0.62], [sw * 0.26, -sh * 0.64]] as Pt[], 2.4, 0.1, 0.1, 0.5) }))
  },
}
