import { s } from '../../core/dom'
import type { SceneDef } from '../types'
import type { PondGeo } from '../../ui/part2/perspectives'
import { curve, f1, hills, mist, rng, stroke, type Pt } from '../t22/kit'

/**
 * Scene 5 (art: three stones round a small pool under the moon; in the middle an open diary of dó paper, its writing
 * mirrored on the water; each stone turns the moonlight to another page — one written boldly, one left blank exactly
 * where it matters). perspectiveCircle paints the pool; the diary floats over it in an SVG of our own, laid out from
 * the pool's geometry through the `art` hook, and the page follows whichever stone is pressed.
 */
let diary: SVGSVGElement | null = null

/** The circle's own far shore (same as its default), plus: lay the diary out on this pool. */
export function diaryArt(g: PondGeo): SVGElement[] {
  const { w, cx, cy, rx, ry, top, seed } = g
  if (diary) paintDiary(diary, g)
  const sr = Math.max(10, Math.min(26, rx * 0.13))
  const my = Math.max(sr * 1.6, top - ry * 1.5)
  const sky = my + sr * 2 < top
  return [
    mist(cx, cy - ry * 1.3, w * 0.62, ry * 1.1),
    hills(-w * 0.05, w * 1.05, cy - ry * 0.7, Math.min(ry * 1.5, cy - ry * 0.7 - (sky ? my + sr : 0)), seed, 0.85, 5),
    hills(w * 0.05, w * 0.62, cy - ry * 0.6, ry * 0.9, seed + 2, 0.55, 2),
    mist(cx, cy - ry * 0.75, rx * 2.4, ry * 0.5),
  ]
}

function paintDiary(svg: SVGSVGElement, { w, h, cx, cy, rx, ry }: PondGeo) {
  svg.setAttribute('viewBox', `0 0 ${f1(w)} ${f1(h)}`)
  const r = rng(2450)
  const x = cx + rx * 0.16, y = cy + ry * 0.28 // the spine's foot, on the water
  const pw = rx * 0.3, ph = ry * 0.62 // one page
  // two pages fanning up from the spine, a little cupped
  const page = (d: number): Pt[] => [[x, y], ...curve([x + d * pw * 0.1, y + ph * 0.02], [x + d * pw * 0.6, y + ph * 0.1], [x + d * pw, y - ph * 0.05], 8).slice(1), [x + d * pw * 0.97, y - ph], ...curve([x + d * pw * 0.97, y - ph], [x + d * pw * 0.55, y - ph * 0.92], [x, y - ph * 0.86], 8).slice(1)]
  const P = (pts: Pt[]) => `M${pts.map(([a, b]) => `${f1(a)} ${f1(b)}`).join('L')}Z`
  const L = page(-1), R = page(1)
  // the writing: each page variant its own lines (v = which stone's light)
  const lines = (v: number) => {
    let d = '', gap = ''
    for (const side of [-1, 1]) for (let k = 0; k < 6; k++) {
      const t = (k + 1) / 7.5
      const yy = y - ph * 0.86 * (1 - t) - ph * 0.1 + ph * 0.06 * t
      const x0 = x + side * pw * 0.12, x1 = x + side * pw * (0.82 - r() * 0.15)
      if (v === 1 && side === 1 && (k === 2 || k === 3)) {
        // a page left blank exactly where it matters: two lines stop short, a vermilion ring round the gap
        d += stroke([[x0, yy], [x0 + side * pw * 0.18, yy]], 1.6, 0.2, 0.3, 0.3)
        if (k === 2) gap += stroke(Array.from({ length: 15 }, (_, j) => { const a = (j / 14) * Math.PI * 2.1; return [x + pw * 0.55 + Math.cos(a) * pw * 0.26, yy + ph * 0.07 + Math.sin(a) * ph * 0.11] as Pt }), 1.3, 0.1, 0.3, 0.3)
        continue
      }
      d += stroke([[x0, yy], [(x0 + x1) / 2, yy + (r() - 0.5)], [x1, yy]], v === 0 ? 2.4 : 1.5, 0.2, 0.3, 0.3)
    }
    return { d, gap }
  }
  const pages = [0, 1, 2].map((v) => {
    const { d, gap } = lines(v)
    return s('g', { class: `g8d-page p${v}` },
      s('path', { class: 'g8d-ink', d }),
      gap ? s('path', { class: 'g8d-gap', d: gap }) : null,
      // the same page mirrored on the water under the book
      s('path', { class: 'g8d-mirror', d, transform: `translate(0 ${f1(2 * y + 4)}) scale(1 -1)` }))
  })
  let rip = ''
  for (let k = 0; k < 5; k++) {
    const yy = y + 4 + k * ph * 0.16
    rip += stroke([[x - pw * (1.1 - k * 0.1) + r() * 6, yy], [x + pw * (1.1 - k * 0.12) - r() * 6, yy + (r() - 0.5)]], 1.2, 0.3, 0.3, 0.1)
  }
  svg.replaceChildren(
    s('ellipse', { class: 'g8d-light', cx: f1(x), cy: f1(y - ph * 0.4), rx: f1(pw * 1.9), ry: f1(ph * 1.2), fill: 'url(#p2-halo)' }),
    s('path', { class: 'g8d-reflect', d: `${P(L.map(([a, b]) => [a, 2 * y + 4 - b] as Pt))}${P(R.map(([a, b]) => [a, 2 * y + 4 - b] as Pt))}` }),
    s('path', { class: 'g8d-rip', d: rip }),
    s('ellipse', { class: 'g8d-shadow', cx: f1(x), cy: f1(y + 2), rx: f1(pw * 1.08), ry: f1(Math.max(2, ph * 0.07)) }),
    s('path', { class: 'g8d-paper', d: P(L) + P(R) }),
    s('path', { class: 'g8d-cup', d: P([[x, y], [x - pw * 0.22, y + ph * 0.01], [x - pw * 0.2, y - ph * 0.88], [x, y - ph * 0.86]]) }),
    ...pages,
    s('path', { class: 'g8d-edge', d: stroke([...L, L[0]], 1.4, 0.05, 0.05, 0.4) + stroke([...R, R[0]], 1.4, 0.05, 0.05, 0.4) + stroke([[x, y + 1], [x, y - ph * 0.87]], 1.8, 0.1, 0.1, 0.4), filter: 'url(#ink-rough)' }))
}

/** Mount the circle, float the diary over its pool, and turn the page whenever a stone is pressed. */
export function withDiary(def: SceneDef): SceneDef {
  return {
    label: def.label,
    mount(ctx) {
      const svg = s('svg', { class: 'g8d-diary', 'aria-hidden': 'true', 'data-page': '-1' })
      diary = svg
      ctx.onCleanup(() => {
        if (diary === svg) diary = null
      })
      const off = def.mount(ctx)
      const stage = ctx.art.querySelector('.p2c-stage')
      const ring = stage?.querySelector('.p2c-stones')
      if (stage) stage.insertBefore(svg, ring ?? null)
      const stones = [...ctx.art.querySelectorAll('.p2c-stone')]
      const mo = new MutationObserver(() => {
        const k = stones.findIndex((b) => b.getAttribute('aria-pressed') === 'true')
        svg.dataset.page = String(k < 0 ? -1 : k % 3)
      })
      mo.observe(ctx.art, { subtree: true, attributes: true, attributeFilter: ['aria-pressed'] })
      ctx.onCleanup(() => mo.disconnect())
      return off
    },
  }
}
