import { s } from '../../core/dom'
import { rng, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist } from '../../ui/part2/paint'
import type { TideArt } from '../../ui/part2/tide'
import type { PondGeo } from '../../ui/part2/perspectives'
import { f1 } from '../t28/frame'
import { bucket, intoPond, P } from '../t28/brush'

/** Laws: an old law scroll (faint columns of script) by the tide; at each milestone a carved stone pillar rises from the sand.
 *  Pillars for Việt Nam carry a red seal; the last of them is still wet from the tide. */
export function lawsArt(labels: string[]): TideArt {
  const vn = labels.map((l) => /Việt Nam|Viet ?nam/i.test(l))
  const last = vn.lastIndexOf(true)
  return {
    back({ w, h, ground, xs, roll, seed }) {
      const r = rng(seed + 11)
      // columns of old script, right to left, fading toward the sand
      let script = ''
      for (let x = w - roll - 16; x > roll + 10; x -= 18 + r() * 6) {
        let y = h * 0.08 + r() * 10
        const end = ground - h * (0.18 + r() * 0.12)
        while (y < end) {
          const k = 4 + r() * 5
          script += r() < 0.5 ? stroke([[x - k * 0.4, y], [x + k * 0.5, y + k * 0.15]], 1.1, 0.2, 0.3, 0.2) : stroke([[x, y], [x + (r() - 0.5) * 2, y + k]], 1.1, 0.2, 0.3, 0.2)
          y += k + 3 + r() * 5
        }
      }
      // the tide: shallow water over the sand toward the scroll's end, ripples
      const n = xs.length - 1
      const t0 = xs[Math.max(0, last - 1)], t1 = xs[n] + (xs[1] - xs[0]) * 0.6
      let rip = ''
      for (let i = 0; i < 18; i++) {
        const y = ground + 3 + r() * h * 0.06, x = t0 + 20 + r() * (t1 - t0 - 50)
        rip += stroke([[x, y], [x + 10 + r() * 24, y + (r() - 0.5)]], 1 + r(), 0.3, 0.3, 0.1)
      }
      return [
        s('path', { class: 't30l-script', d: script }),
        mist(w * 0.5, ground - h * 0.25, w * 0.62, h * 0.3),
        hills(roll, w - roll, ground - h * 0.08, h * 0.3, seed + 1, 0.9, 6),
        mist(w * 0.5, ground - h * 0.04, w * 0.6, h * 0.12),
        s('path', { class: 't30l-tide', d: `M${f1(t0)} ${f1(ground + 2)}Q${f1((t0 + t1) / 2)} ${f1(ground - 1)} ${f1(t1)} ${f1(ground + 1)}Q${f1(t1 + 14)} ${f1(ground + h * 0.03)} ${f1(t1 - 24)} ${f1(ground + h * 0.06)}Q${f1((t0 + t1) / 2)} ${f1(ground + h * 0.085)} ${f1(t0 + 30)} ${f1(ground + h * 0.055)}Q${f1(t0 - 14)} ${f1(ground + h * 0.03)} ${f1(t0)} ${f1(ground + 2)}Z`, filter: 'url(#ink-wash)' }),
        s('path', { class: 't30l-ripple', d: rip }),
      ]
    },
    mark(i, size, seed) {
      const r = rng(seed)
      const pw = size * 0.38, ph = size * (1.2 + ((i * 37) % 5) * 0.12 + (vn[i] ? 0.2 : 0))
      const bw = pw * 1.5, bh = size * 0.12
      const body = `M${f1(-pw * 0.5)} ${f1(-bh)}L${f1(-pw * 0.44)} ${f1(-ph)}Q${f1(-pw * 0.4)} ${f1(-ph - pw * 0.26)} ${f1(0)} ${f1(-ph - pw * 0.3)}Q${f1(pw * 0.4)} ${f1(-ph - pw * 0.26)} ${f1(pw * 0.44)} ${f1(-ph)}L${f1(pw * 0.5)} ${f1(-bh)}Z`
      const base = `M${f1(-bw / 2)} 0L${f1(-bw * 0.44)} ${f1(-bh)}L${f1(bw * 0.44)} ${f1(-bh)}L${f1(bw / 2)} 0Z`
      // carved script down the face
      let carve = ''
      for (const cx of [-pw * 0.14, pw * 0.14]) {
        for (let y = -ph + pw * 0.15; y < -bh - pw * 0.25; y += pw * 0.22) carve += stroke([[cx - pw * 0.08, y], [cx + pw * 0.06, y + pw * 0.04]], Math.max(0.9, pw * 0.07), 0.2, 0.3, 0.3)
      }
      const wet = i === last
      let drips = ''
      if (wet) for (let k = 0; k < 4; k++) {
        const x = -pw * 0.4 + r() * pw * 0.8, y = -ph * (0.3 + r() * 0.5)
        drips += stroke([[x, y], [x + 0.4, y + ph * (0.12 + r() * 0.2)]], Math.max(1, pw * 0.05), 0.1, 0.6, 0.3)
      }
      return s('g', { class: `t30l-pillar${wet ? ' wet' : ''}` },
        s('ellipse', { class: wet ? 't30l-puddle' : 'gb-shadow', cx: f1(pw * 0.1), cy: 1, rx: f1(bw * (wet ? 0.95 : 0.65)), ry: f1(Math.max(2, bh * (wet ? 0.8 : 0.5))) }),
        s('path', { class: 'gb-stone', d: base + body, filter: 'url(#ink-rough)' }),
        s('path', { class: 'gb-stone-sh', d: base + body }),
        wet ? s('path', { class: 't30l-wetness', d: body }) : null,
        s('path', { class: 't30l-carve', d: carve }),
        s('path', { class: 'gb-rim-hi', d: stroke([[-pw * 0.42, -bh - 2], [-pw * 0.4, -ph], [-pw * 0.1, -ph - pw * 0.26]], Math.max(1, pw * 0.06), 0.2, 0.3, 0.1) }),
        vn[i] ? s('rect', { class: 'gb-seal', x: f1(pw * 0.08), y: f1(-ph + pw * 0.05), width: f1(pw * 0.26), height: f1(pw * 0.3), rx: 1, filter: 'url(#ink-rough)' }) : null,
        wet ? s('path', { class: 't30l-drip', d: drips }) : null,
        wet ? s('path', { class: 'gb-glint', d: stroke([[pw * 0.3, -ph * 0.9], [pw * 0.32, -ph * 0.55]], Math.max(1, pw * 0.05), 0.3, 0.4, 0.1) + stroke([[-pw * 0.3, -ph * 0.4], [-pw * 0.28, -ph * 0.25]], Math.max(1, pw * 0.04), 0.3, 0.4, 0.1) }) : null)
    },
  }
}

/** Copyright: the pond mirrors thousands of pages, paintings and scores; a well-sweep on the far bank lifts one bucket from it. */
export function copyrightArt(g: PondGeo): SVGElement[] {
  const { w, cx, cy, rx, ry, seed } = g
  const r = rng(seed + 30)
  const px = cx - rx * 0.88, py = cy - ry * 0.92 // the sweep's post
  const pivot: Pt = [px, py - ry * 0.95]
  const tip: Pt = [cx - rx * 0.12, pivot[1] - ry * 0.3]
  const tail: Pt = [pivot[0] - (tip[0] - pivot[0]) * 0.35, pivot[1] + (pivot[1] - tip[1]) * 0.35]
  const marker = s('g', { class: 't30c-back' },
    mist(cx, cy - ry * 1.3, w * 0.62, ry * 1.1),
    hills(-w * 0.05, w * 1.05, cy - ry * 0.7, Math.min(ry * 1.4, cy - ry * 0.7 - 10), seed, 0.85, 5),
    hills(w * 0.55, w * 1.02, cy - ry * 0.62, ry * 0.8, seed + 2, 0.55, 2),
    mist(cx, cy - ry * 0.75, rx * 2.4, ry * 0.5),
    s('path', { class: 't30c-sweep', d: stroke([[px, py], [px + 1, pivot[1] - 2]], Math.max(2.6, rx * 0.03), 0.03, 0.05, 0.6) + stroke([tail, pivot, tip], Math.max(2.2, rx * 0.022), 0.1, 0.1, 0.5), filter: 'url(#ink-rough)' }),
    s('circle', { class: 't30c-weight', cx: f1(tail[0]), cy: f1(tail[1] + 4), r: f1(Math.max(4, rx * 0.05)) }))
  intoPond(marker, (_svg, water) => {
    // in the water: the reflection of pages, hanging paintings and scores, thousands of them, faint and wavering
    let pages = '', lines = '', staves = '', notes = '', scrolls = ''
    for (let i = 0; i < 56; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.92
      const x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d
      if (Math.abs(x - cx) < rx * 0.2 && Math.abs(y - cy) < ry * 0.3) continue // leave the moon's reflection clear
      const k = Math.max(5, rx * 0.06) * (0.6 + (y - cy + ry) / (2 * ry) * 0.6)
      const kind = i % 3
      if (kind === 0) {
        pages += `M${P([x - k * 0.5, y - k * 0.3])}L${P([x + k * 0.5, y - k * 0.34])}L${P([x + k * 0.52, y + k * 0.3])}L${P([x - k * 0.48, y + k * 0.32])}Z`
        for (let j = 0; j < 3; j++) lines += `M${f1(x - k * 0.36)} ${f1(y - k * 0.14 + j * k * 0.14)}h${f1(k * (0.5 + r() * 0.2))}`
      } else if (kind === 1) {
        for (let j = 0; j < 5; j++) staves += `M${f1(x - k * 0.7)} ${f1(y - k * 0.2 + j * k * 0.1)}h${f1(k * 1.4)}`
        for (let j = 0; j < 3; j++) notes += `M${f1(x - k * 0.4 + j * k * 0.35)} ${f1(y - k * 0.1 + (r() - 0.5) * k * 0.3)}a${f1(k * 0.07)} ${f1(k * 0.05)} 0 1 0 0.1 0Z`
      } else {
        scrolls += `M${f1(x - k * 0.25)} ${f1(y - k * 0.6)}h${f1(k * 0.5)}v${f1(k * 1.2)}h${f1(-k * 0.5)}Z`
        lines += `M${f1(x - k * 0.18)} ${f1(y + k * 0.3)}l${f1(k * 0.12)} ${f1(-k * 0.35)}l${f1(k * 0.12)} ${f1(k * 0.2)}l${f1(k * 0.1)} ${f1(-k * 0.12)}`
      }
    }
    const mirror = s('g', { class: 't30c-mirror' },
      s('path', { class: 't30c-page', d: pages + scrolls }),
      s('path', { class: 't30c-line', d: lines + staves }),
      s('path', { class: 't30c-note', d: notes }))
    water.insertBefore(mirror, water.querySelector('.p2c-reflect'))
    // above the water: the rope from the sweep's tip and the bucket it lifts, brimming with pages, dripping back
    const bw = Math.max(14, rx * 0.15)
    const by = cy - ry * 0.72
    const b = bucket(tip[0], by - bw * 0.5, bw)
    let spill = ''
    for (let j = 0; j < 4; j++) {
      const x = tip[0] - bw * 0.35 + j * bw * 0.22, y = by - bw * 0.1
      spill += `M${P([x, y])}l${f1(bw * 0.1)} ${f1(-bw * (0.22 + r() * 0.1))}l${f1(bw * 0.14)} ${f1(bw * 0.05)}l${f1(-bw * 0.06)} ${f1(bw * 0.2)}Z`
    }
    let drops = ''
    for (let j = 0; j < 4; j++) {
      const x = tip[0] - bw * 0.3 + r() * bw * 0.6, y = by + bw * 1.1 + j * bw * 0.32
      drops += `M${f1(x)} ${f1(y)}q${f1(bw * 0.06)} ${f1(bw * 0.1)} 0 ${f1(bw * 0.14)}q${f1(-bw * 0.06)} ${f1(-bw * 0.04)} 0 ${f1(-bw * 0.14)}Z`
    }
    water.after(s('g', { class: 't30c-lift' },
      s('path', { class: 'gb-rope', d: `M${P(tip)}L${f1(tip[0])} ${f1(by - bw * 0.62)}` }),
      s('path', { class: 't30c-page', d: spill }),
      s('path', { class: 'gb-wood', d: b.body, filter: 'url(#ink-rough)' }),
      s('path', { class: 'gb-hoop', d: b.hoops }),
      s('path', { class: 'gb-rope', d: b.bail }),
      s('path', { class: 'gb-drop', d: drops }),
      s('ellipse', { class: 't30c-ring', cx: f1(tip[0]), cy: f1(by + bw * 2.6), rx: f1(bw * 1.2), ry: f1(bw * 0.3) })))
  })
  return [marker]
}
