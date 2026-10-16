import { s } from '../../core/dom'
import { curve, rng, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist, paperLantern, reeds } from '../../ui/part2/paint'
import type { TideArt } from '../../ui/part2/tide'
import type { PondGeo } from '../../ui/part2/perspectives'
import { f1 } from '../t28/frame'
import { arc, crescent, intoPond, P } from '../t28/brush'

/** A long strip of paper whose centre line rises from (0, y0) by len, swaying; its two edges as one closed path. */
function strip(y0: number, len: number, wid: number, sway: number, seed: number): { page: string; mid: Pt[] } {
  const r = rng(seed)
  const ph = r() * 6
  const mid: Pt[] = Array.from({ length: 13 }, (_, i) => {
    const t = i / 12
    return [Math.sin(t * 3.2 + ph) * sway * t + sway * 0.3 * t, y0 - len * t] as Pt
  })
  const L: Pt[] = [], R: Pt[] = []
  mid.forEach(([x, y], i) => {
    const a = mid[Math.max(0, i - 1)], b = mid[Math.min(12, i + 1)]
    const dl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    const nx = -(b[1] - a[1]) / dl, ny = (b[0] - a[0]) / dl
    const k = wid / 2 * (i === 12 ? 0.9 : 1)
    L.push([x + nx * k, y + ny * k])
    R.push([x - nx * k, y - ny * k])
  })
  return { page: `M${L.map(P).join('L')}Q${P([mid[12][0] + wid * 0.2, mid[12][1] - wid * 0.4])} ${P(R[12])}L${R.reverse().map(P).join('L')}Z`, mid }
}

/** Bills: from the great pond at the left, paper bills fly across to a phone stall at the garden gate; longer every milestone. */
export function billArt(n: number): TideArt {
  return {
    back({ w, h, ground, xs, roll, seed }) {
      const r = rng(seed + 3)
      const px = roll + (xs[0] - roll) * 0.55, prx = Math.max(26, (xs[0] - roll) * 0.75 + (xs[1] - xs[0]) * 0.2)
      const gap = xs[1] - xs[0]
      const sx = (xs[n - 1] + xs[n]) / 2 - gap * 0.08, sw = Math.min(h * 0.32, gap * 0.8), shh = sw * 0.9
      const sg = ground - h * 0.04
      // the gate: two posts and a curved roof beam; the stall beside it with its awning, phones and a lantern
      const gx = sx + sw * 0.78
      const gate = stroke([[gx - sw * 0.3, sg], [gx - sw * 0.3, sg - shh * 1.05]], Math.max(2, sw * 0.045), 0.02, 0.05, 0.6) + stroke([[gx + sw * 0.3, sg], [gx + sw * 0.3, sg - shh * 1.05]], Math.max(2, sw * 0.045), 0.02, 0.05, 0.6) +
        stroke([[gx - sw * 0.36, sg - shh * 0.86], [gx + sw * 0.36, sg - shh * 0.86]], Math.max(1.6, sw * 0.03), 0.05, 0.05, 0.6)
      const lintel = `M${P([gx - sw * 0.52, sg - shh * 1.02])}Q${P([gx - sw * 0.4, sg - shh * 1.1])} ${P([gx - sw * 0.3, sg - shh * 1.08])}L${P([gx + sw * 0.3, sg - shh * 1.08])}Q${P([gx + sw * 0.4, sg - shh * 1.1])} ${P([gx + sw * 0.52, sg - shh * 1.02])}Q${P([gx + sw * 0.36, sg - shh * 1.2])} ${P([gx + sw * 0.18, sg - shh * 1.3])}L${P([gx - sw * 0.18, sg - shh * 1.3])}Q${P([gx - sw * 0.36, sg - shh * 1.2])} ${P([gx - sw * 0.52, sg - shh * 1.02])}Z`
      const awning = `M${P([sx - sw * 0.5, sg - shh * 0.62])}L${P([sx + sw * 0.42, sg - shh * 0.66])}L${P([sx + sw * 0.32, sg - shh * 0.86])}L${P([sx - sw * 0.4, sg - shh * 0.84])}Z`
      const counter = `M${P([sx - sw * 0.46, sg])}h${f1(sw * 0.86)}v${f1(-shh * 0.3)}h${f1(-sw * 0.86)}Z`
      let phones = ''
      for (let i = 0; i < 4; i++) {
        const x = sx - sw * 0.38 + i * sw * 0.2, y = sg - shh * 0.3
        phones += `M${f1(x)} ${f1(y)}h${f1(sw * 0.09)}v${f1(-shh * 0.16)}h${f1(-sw * 0.09)}Z`
      }
      // the bills' road through the air, faint
      const flight = curve([px + prx * 0.3, ground - h * 0.12], [(px + sx) / 2, ground - h * 0.95], [sx, sg - shh * 0.9], 30)
      // little paper slips flutter along it
      let dots = ''
      flight.forEach(([x, y], i) => {
        if (i % 3 !== 1) return
        const a = r() * Math.PI, k = Math.max(2.4, h * 0.016) * (0.7 + r() * 0.6)
        const c = Math.cos(a) * k, sn = Math.sin(a) * k
        dots += `M${f1(x - c - sn * 0.6)} ${f1(y - sn + c * 0.6)}L${f1(x + c - sn * 0.6)} ${f1(y + sn + c * 0.6)}L${f1(x + c + sn * 0.6)} ${f1(y + sn - c * 0.6)}L${f1(x - c + sn * 0.6)} ${f1(y - sn - c * 0.6)}Z`
      })
      return [
        mist(w * 0.5, ground - h * 0.42, w * 0.7, h * 0.42),
        hills(-w * 0.02, w * 1.02, ground - h * 0.14, h * 0.32, seed + 1, 0.9, 6),
        hills(w * 0.3, w * 0.8, ground - h * 0.08, h * 0.26, seed + 2, 0.62, 2),
        mist(w * 0.5, ground - h * 0.06, w * 0.6, h * 0.12),
        // the great pond at the scroll's head
        s('ellipse', { class: 't29b-pond', cx: f1(px), cy: f1(ground - h * 0.03), rx: f1(prx), ry: f1(Math.max(6, h * 0.05)) }),
        s('path', { class: 't29b-glint', d: [0, 1, 2].map((i) => stroke([[px - prx * (0.5 - i * 0.2), ground - h * (0.04 - i * 0.01)], [px + prx * (0.1 + i * 0.15), ground - h * (0.04 - i * 0.01)]], 1.2, 0.3, 0.3, 0.1)).join('') }),
        reeds(px - prx * 0.9, ground - h * 0.01, Math.max(14, h * 0.12), seed + 4, 6),
        s('path', { class: 't29b-flight', d: dots }),
        s('ellipse', { class: 'gb-shadow', cx: f1(sx + sw * 0.1), cy: f1(sg + 1), rx: f1(sw * 0.7), ry: f1(Math.max(3, shh * 0.05)) }),
        s('path', { class: 't29b-post', d: gate, filter: 'url(#ink-rough)' }),
        s('path', { class: 't29b-roof', d: lintel, filter: 'url(#ink-rough)' }),
        s('path', { class: 't29b-post', d: stroke([[sx - sw * 0.44, sg], [sx - sw * 0.42, sg - shh * 0.84]], Math.max(1.4, sw * 0.025), 0.02, 0.05, 0.6) + stroke([[sx + sw * 0.36, sg], [sx + sw * 0.34, sg - shh * 0.86]], Math.max(1.4, sw * 0.025), 0.02, 0.05, 0.6), filter: 'url(#ink-rough)' }),
        s('path', { class: 'gb-wood', d: counter, filter: 'url(#ink-rough)' }),
        s('path', { class: 't29b-phone', d: phones }),
        s('path', { class: 't29b-awning', d: awning, filter: 'url(#ink-rough)' }),
        paperLantern(sx + sw * 0.3, sg - shh * 0.68, Math.max(3.5, sw * 0.05), seed, Math.max(3, shh * 0.04)),
      ]
    },
    mark(i, size, seed) {
      const r = rng(seed)
      const len = size * (0.9 + i * 0.6), wid = size * 0.4
      const lift = size * 0.5
      const { page, mid } = strip(-lift, len, wid, size * 0.32, seed)
      let lines = ''
      for (let k = 1; k < 11; k++) {
        const [x, y] = mid[k]
        const lw = wid * (0.3 + r() * 0.4)
        lines += stroke([[x - wid * 0.32, y], [x - wid * 0.32 + lw, y - 0.5]], Math.max(0.8, wid * 0.06), 0.2, 0.3, 0.2)
      }
      const [tx, ty] = mid[2]
      return s('g', { class: 't29b-bill' },
        s('ellipse', { class: 'gb-shadow', cx: f1(len * 0.25), cy: 1.5, rx: f1(wid + len * 0.25), ry: f1(Math.max(2, wid * 0.18)) }),
        s('g', { transform: `rotate(${f1(22 + i * 5)} 0 ${f1(-lift)})` },
        s('path', { class: 't29b-paper', d: page }),
        s('path', { class: 'gb-stone-sh', d: page }),
        s('path', { class: 't29b-lines', d: lines }),
        s('path', { class: 't29b-total', d: stroke([[tx - wid * 0.34, ty], [tx + wid * 0.34, ty - 0.6]], Math.max(1.2, wid * 0.1), 0.1, 0.1, 0.4) }),
        s('circle', { class: 'gb-seal', cx: f1(mid[1][0] + wid * 0.18), cy: f1(mid[1][1] - wid * 0.05), r: f1(Math.max(1.6, wid * 0.13)), opacity: 0.8 })))
    },
  }
}

/** Refill: the pond is a dry well under a crescent moon — its far wall and well frame behind, inner shaft and curb added in. */
export function refillArt(g: PondGeo): SVGElement[] {
  const { w, cx, cy, rx, ry, top, seed } = g
  const r = rng(seed + 29)
  const sr = Math.max(10, Math.min(rx * 0.13, 26))
  const my = Math.max(sr * 1.8, top - ry * 1.5)
  const hc = ry * 0.32 // the curb's height
  // the far wall of the curb, standing above the back rim
  const backTop = arc(cx, cy - hc, rx * 1.04, ry * 1.04, 180, 360)
  const backBot = arc(cx, cy, rx * 1.04, ry * 1.04, 360, 180)
  const curbBack = `M${backTop.map(P).join('L')}L${backBot.map(P).join('L')}Z`
  let joints = ''
  backTop.forEach(([x, y], i) => { if (i % 3 === 1 && i < 23) joints += stroke([[x, y + 1], [x, y + hc * 0.9]], 1, 0.2, 0.2, 0.3) })
  const postL = cx - rx * 0.5, postR = cx + rx * 0.5, beam = Math.max(my + sr * 1.6, cy - ry - hc - ry * 1.1)
  const frame = stroke([[postL, cy - ry * 0.95], [postL + 2, beam]], Math.max(2.4, rx * 0.03), 0.03, 0.05, 0.6) + stroke([[postR, cy - ry * 0.95], [postR - 2, beam]], Math.max(2.4, rx * 0.03), 0.03, 0.05, 0.6) +
    stroke([[postL - rx * 0.1, beam + 3], [cx, beam - 2], [postR + rx * 0.1, beam + 3]], Math.max(2.6, rx * 0.035), 0.05, 0.05, 0.6)
  const marker = s('g', { class: 't29r-back' },
    crescent(cx + rx * 0.4, my, sr),
    mist(cx, cy - ry * 1.3, w * 0.62, ry * 1.1),
    hills(-w * 0.05, w * 1.05, cy - ry * 0.7, Math.min(ry * 1.4, cy - ry * 0.7 - my - sr), seed, 0.85, 5),
    mist(cx, cy - ry * 0.75, rx * 2.4, ry * 0.5),
    s('path', { class: 't29r-frame', d: frame, filter: 'url(#ink-rough)' }),
    s('circle', { class: 't29r-pulley', cx: f1(cx), cy: f1(beam + 4), r: f1(Math.max(3, rx * 0.04)) }),
    s('path', { class: 'gb-rope', d: `M${f1(cx)} ${f1(beam + 4)}V${f1(cy - ry)}` }),
    s('path', { class: 'gb-stone', d: curbBack, filter: 'url(#ink-rough)' }),
    s('path', { class: 'gb-stone-sh', d: curbBack }),
    s('path', { class: 't29r-joint', d: joints }),
    s('path', { class: 'gb-rim-hi', d: stroke(backTop.slice(2, 12), Math.max(1.2, rx * 0.012), 0.2, 0.3, 0.1) }))
  intoPond(marker, (svg, water) => {
    svg.classList.add('t29r-pond')
    // inside: the shaft's inner wall in courses, darkening down to a little water at the bottom; the rope going down
    let courses = ''
    for (let k = 0; k < 5; k++) {
      const pts = arc(cx, cy - ry * (0.1 + k * 0.05) + k * ry * 0.16, rx * (0.98 - k * 0.07), ry * (0.95 - k * 0.12), 190, 350, 18)
      for (let j = 0; j < pts.length - 1; j += 2) courses += stroke([pts[j], pts[j + 1]], 1 + r(), 0.2, 0.2, 0.3)
    }
    const shaft = s('g', { class: 't29r-shaft' },
      s('ellipse', { class: 't29r-deep', cx: f1(cx), cy: f1(cy + ry * 0.2), rx: f1(rx * 1.1), ry: f1(ry * 1.1) }),
      s('path', { class: 't29r-course', d: courses }),
      s('path', { class: 'gb-rope', d: `M${f1(cx)} ${f1(cy - ry)}L${f1(cx + rx * 0.02)} ${f1(cy - ry * 0.35)}` }))
    water.insertBefore(shaft, water.querySelector('.p2c-reflect'))
    // the curb's near half, standing over the rim
    const front = arc(cx, cy, rx * 1.05, ry * 1.06, 0, 180)
    const frontBot = arc(cx, cy + hc * 0.9, rx * 1.05, ry * 1.06, 180, 0)
    let fj = ''
    front.forEach(([x, y], i) => { if (i % 3 === 2 && i < 23) fj += stroke([[x, y + 2], [x, y + hc * 0.85]], 1, 0.2, 0.2, 0.3) })
    const d = `M${front.map(P).join('L')}L${frontBot.map(P).join('L')}Z`
    const curb = s('g', { class: 't29r-curb' },
      s('path', { class: 'gb-stone', d, filter: 'url(#ink-rough)' }),
      s('path', { class: 'gb-stone-sh', d }),
      s('path', { class: 't29r-joint', d: fj + stroke(front.map(([x, y]) => [x, y + hc * 0.45] as Pt).slice(2, -2), 1, 0.1, 0.1, 0.3) }),
      s('path', { class: 'gb-rim-hi', d: stroke(front.slice(14, 23).reverse(), Math.max(1.2, rx * 0.014), 0.2, 0.3, 0.1) }))
    water.after(curb)
  })
  return [marker]
}
