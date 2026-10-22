import './part2.css'
import { fill, h, s, viDate } from '../../core/dom'
import { L, type Fact } from '../../core/content'
import type { Detail, SceneDef } from '../../stations/types'
import type { Tide } from './types'
import { clamp, onSize, p2Defs, rng, seedOf, stableHeight, stoneArt, stroke, type Pt } from './ink'
import { hills, mist, moon as moonArt } from './paint'

/** The scroll's geometry in band px: w × h band, `ground` line, stops xs (xs[n] = today), roller width. */
export type TideGeo = { w: number; h: number; ground: number; xs: number[]; roll: number; seed: number }

/** A station's own painting for the scroll (each timeline its own composition). Sizes in band px. */
export interface TideArt {
  /** what lies behind the milestones */
  back?: (g: TideGeo) => SVGElement[]
  /** what rises for milestone i, standing on (0, 0) and about `size` wide (default: a garden stone) */
  mark?: (i: number, size: number, seed: number) => SVGElement
}

export interface TideOpts {
  label: string
  /** default "Kéo trăng qua các mốc" */
  prompt?: string
  question?: string
  /** shown as the scene's insight once the moon reaches today (else the scene is just marked explored) */
  insight?: Fact | string
  detail?: Detail
  /** the moon slider's aria-label (the station's `sliderAria`); default site.json labels.progressTide */
  aria?: string
  /** the slider's aria-valuetext as a template: {n} {total} {date} {label}; default "date · label" */
  valueText?: string
  art?: TideArt
  /** the moon's own path: t 0 (first milestone) … 1 (today) → its centre in band px (an arc, a zig-zag bridge, a rising
   *  water line, a polyline). Drag follows the path; keys and aria stay the same. Default: a straight run high over the scroll */
  track?: (g: TideGeo) => (t: number) => Pt
  /** what is dragged instead of the moon disc, drawn in a 50 × 50 box centred on 0, 0 (a reflection, a paperweight) */
  thumb?: () => SVGElement
  /** on every move: the nearest stop i (n = today) and where the moon is, t 0…1 (move the station's own art with it) */
  onStep?: (i: number, t: number) => void
  /** the band's own box in the art (px; W × H = the art at its stable height) instead of 60 % of the height at most
   *  1120 × 420 — for a station whose scroll is most of the picture (22-4's shōji wall). Default unchanged */
  band?: (W: number, H: number) => { w: number; h: number; top: number }
}

const f1 = (n: number) => n.toFixed(1)

/**
 * B.7.2 Thuỷ triều tiến triển: a long sand scroll; drag the moon left → right (mouse, touch, ← → Home End) and the
 * milestones rise from the sand like stones. The reading card shows the date, label and fact (with `compare` as two ink
 * bars side by side). The last stop is "Hôm nay · asOf", then the horizon: a faint line and the prediction in the mist.
 */
export function progressTide(data: Tide, o: TideOpts): SceneDef {
  return {
    label: o.label,
    mount(ctx) {
      p2Defs()
      const ms = data.milestones
      const n = ms.length // stops 0…n-1 = milestones, n = today (and the horizon beyond it)
      const seed = seedOf(ms.map((m) => m.label).join('|'))
      const stableH = stableHeight(ctx, [o.insight])
      const today = viDate(data.horizon.asOf)
      const clip = `p2t-clip-${seed.toString(36)}`
      const valueText = (i: number) =>
        o.valueText ? fill(o.valueText, { n: i + 1, total: n + 1, date: i < n ? viDate(ms[i].date) : today, label: i < n ? ms[i].label : L.today })
        : i < n ? fill(L.tideValue, { date: viDate(ms[i].date), label: ms[i].label }) : `${L.today} · ${today}`

      const sky = s('svg', { class: 'p2t-svg', 'aria-hidden': 'true' })
      const disc = s('svg', { class: 'p2t-moon-disc', viewBox: '-25 -25 50 50', 'aria-hidden': 'true' }, o.thumb ? o.thumb() : moonArt(0, 0, 21, seed, true))
      const dates = [...ms.map((m) => viDate(m.date)), `${L.today}`].map((t, i) =>
        h('span', { class: `p2t-date${i === n ? ' today' : ''}` }, t, i === n ? h('small', null, today) : null))
      const moon = h('div', {
        class: 'p2t-moon', role: 'slider', tabindex: '0', 'aria-label': o.aria ?? L.progressTide,
        'aria-valuemin': '0', 'aria-valuemax': String(n), 'aria-valuenow': '0', 'aria-valuetext': valueText(0),
      }, disc)
      const horizonLabel = h('span', { class: 'p2t-horizon-label' }, L.horizon)
      const band = h('div', { class: 'p2t-band' }, sky, ...dates, horizonLabel, moon)
      const read = h('div', { class: 'p2t-card' })
      const root = h('div', { class: 'p2t' }, o.question ? h('p', { class: 'p2-question p2t-q' }, o.question) : null, band, read)
      ctx.art.append(root)
      ctx.prompt(o.prompt ?? L.tidePrompt)

      let xs: number[] = [] // stop positions (px in the band)
      let stones: SVGGElement[] = []
      let at = -1 // the stop the card shows
      let tt = 0 // where the moon is: 0 first milestone … 1 today
      let path: ((t: number) => Pt) | null = null // the station's track, else a straight run
      let samples: Pt[] = [] // the track every 1/96, to drag along it
      let reached = false

      function show(i: number) {
        if (i === at) return
        at = i
        moon.setAttribute('aria-valuenow', String(i))
        moon.setAttribute('aria-valuetext', valueText(i))
        dates.forEach((d, k) => d.classList.toggle('on', k === i))
        if (i < n) {
          const m = ms[i]
          read.className = 'p2t-card'
          read.replaceChildren(h('p', { class: 'p2-eyebrow' }, `${viDate(m.date)} · ${m.label}`), ctx.fact(m.fact, 'p', 'p2t-fact'))
          if (m.compare) read.append(compareBars(m.compare))
        } else {
          read.className = 'p2t-card mist'
          read.replaceChildren(h('p', { class: 'p2-eyebrow' }, `${L.today} · ${today}  →  ${L.horizon}`), ctx.fact(data.horizon, 'p', 'p2t-fact'))
          if (!reached) {
            reached = true
            if (o.insight) ctx.insight(o.insight, o.detail)
            else ctx.complete()
          }
        }
        if (!read.hasAttribute('aria-live')) read.setAttribute('aria-live', 'polite')
      }

      // moon at t: every milestone it has passed stands up; the nearest stop fills the card
      function moveTo(t: number, snap: boolean) {
        if (!xs.length) return
        tt = clamp(t, 0, 1)
        const near = Math.round(tt * n)
        if (snap) tt = near / n
        moon.classList.toggle('snap', snap)
        if (path) {
          const [x, y] = path(tt)
          moon.style.transform = `translate(${f1(x)}px, ${f1(y)}px)`
        } else moon.style.transform = `translateX(${f1(xs[0] + (xs[n] - xs[0]) * tt)}px)`
        const eps = 6 / Math.max(1, xs[n] - xs[0]) // a stone stands once the moon is within 6 px of it
        stones.forEach((g, i) => g.classList.toggle('up', i / n <= tt + eps))
        band.classList.toggle('past', tt >= 1 - eps)
        show(near)
        o.onStep?.(near, tt)
      }
      // the pointer (band px) as t: along the scroll, or the nearest point of the station's track
      function tAt(x: number, y: number) {
        if (!path) return (x - xs[0]) / Math.max(1, xs[n] - xs[0])
        let best = 0, bd = Infinity
        samples.forEach(([sx, sy], k) => {
          const d = (sx - x) ** 2 + (sy - y) ** 2
          if (d < bd) (bd = d), (best = k)
        })
        return best / (samples.length - 1)
      }

      // drag anywhere on the band; the moon follows the pointer and settles on the nearest stop
      let drag = false
      let bandX = 0, bandY = 0
      band.addEventListener('pointerdown', (e) => {
        if (e.button) return
        drag = true
        const r = band.getBoundingClientRect()
        bandX = r.left
        bandY = r.top
        band.setPointerCapture(e.pointerId)
        moon.focus({ preventScroll: true })
        moveTo(tAt(e.clientX - bandX, e.clientY - bandY), false)
        ctx.chime('soft')
      })
      band.addEventListener('pointermove', (e) => drag && moveTo(tAt(e.clientX - bandX, e.clientY - bandY), false))
      const end = () => {
        if (!drag) return
        drag = false
        moveTo(tt, true)
      }
      band.addEventListener('pointerup', end)
      band.addEventListener('pointercancel', end)
      moon.addEventListener('keydown', (e) => {
        const k = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key]
        const to = k ? clamp(at + k, 0, n) : e.key === 'Home' ? 0 : e.key === 'End' ? n : -1
        if (to < 0) return
        e.preventDefault()
        moveTo(to / n, true)
      })

      function layout() {
        const W = ctx.art.clientWidth
        const H = stableH(ctx.art.clientHeight)
        if (W < 60 || H < 60) return
        root.style.height = `${f1(H)}px`
        const qh = (root.querySelector('.p2t-q') as HTMLElement | null)?.offsetHeight ?? 0
        const own = o.band?.(W, H - qh)
        const bw = own?.w ?? Math.min(W, 1120)
        const bh = own?.h ?? clamp((H - qh) * 0.6, 160, 420)
        const top = own ? qh + own.top : qh ? qh + 8 : clamp(H * 0.04, 0, 24)
        Object.assign(band.style, { width: `${f1(bw)}px`, height: `${f1(bh)}px`, top: `${f1(top)}px`, left: `${f1((W - bw) / 2)}px` })
        Object.assign(read.style, { top: `${f1(top + bh + 14)}px`, maxHeight: `${f1(H - top - bh - 14)}px` })
        // stops from the left roller to "today"; the last 14 % of the scroll is mist
        const roll = clamp(bw * 0.02, 10, 18)
        const x0 = roll + clamp(bw * 0.07, 34, 70)
        const xt = bw - roll - clamp(bw * 0.17, 56, 190)
        xs = Array.from({ length: n + 1 }, (_, i) => x0 + ((xt - x0) * i) / n)
        const ground = bh * 0.74
        band.classList.toggle('tight', (xt - x0) / n < 62)
        dates.forEach((d, i) => Object.assign(d.style, { left: `${f1(xs[i])}px`, top: `${f1(ground + 8)}px` }))
        Object.assign(horizonLabel.style, { right: `${f1(roll + 8)}px`, width: `${f1(bw - roll - xt + 10)}px`, top: `${f1(ground - bh * 0.34)}px` })
        path = o.track ? o.track({ w: bw, h: bh, ground, xs, roll, seed }) : null
        if (path) {
          samples = Array.from({ length: 97 }, (_, k) => path!(k / 96))
          const [a, b] = [samples[0], samples[96]]
          moon.setAttribute('aria-orientation', Math.abs(b[1] - a[1]) > Math.abs(b[0] - a[0]) ? 'vertical' : 'horizontal')
          Object.assign(moon.style, { top: '0px', marginTop: 'calc(var(--m) / -2)' }) // the track gives the moon's centre
        } else moon.style.top = `${f1(bh * 0.2)}px`
        stones = draw(bw, bh, roll, ground, xt)
        moveTo(at < 0 ? 0 : at / n, true)
      }

      function draw(w: number, hh: number, roll: number, ground: number, xt: number): SVGGElement[] {
        sky.setAttribute('viewBox', `0 0 ${f1(w)} ${f1(hh)}`)
        const r = rng(seed)
        const paperTop = 6, paperBot = hh - 4
        const topE: Pt[] = [], botE: Pt[] = []
        for (let i = 0; i <= 16; i++) {
          const x = roll + ((w - 2 * roll) * i) / 16
          topE.push([x, paperTop + (r() - 0.5) * 1.8])
          botE.push([x, paperBot + (r() - 0.5) * 1.8])
        }
        const pp = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`
        const paper = `M${topE.map(pp).join('L')}L${botE.reverse().map(pp).join('L')}Z`
        const rakes = [0.08, 0.17, 0.27].map((k, i) => {
          const y = ground + (hh - ground) * k * 2.2
          const pts: Pt[] = []
          for (let x = roll + 6; x <= xt + 30; x += 12) pts.push([x, y + Math.sin(x / 38 + i) * 1.4])
          return s('path', { class: 'p2t-rake', d: `M${pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')}` })
        })
        const roller = (x: number) => s('g', { class: 'p2t-roller' },
          s('rect', { class: 'p2t-roller-knob', x: f1(x - roll * 0.34), y: -roll * 0.7, width: f1(roll * 0.68), height: f1(hh + roll * 1.4), rx: f1(roll * 0.3) }),
          s('rect', { x: f1(x - roll / 2), y: 0, width: f1(roll), height: f1(hh), rx: f1(roll * 0.3) }),
          s('rect', { class: 'p2t-roller-hi', x: f1(x - roll * 0.28), y: 3, width: f1(roll * 0.16), height: f1(hh - 6), rx: f1(roll * 0.08) }))
        const gs = ms.map((m, i) => {
          const sw = clamp((xs[1] - xs[0]) * 0.56, 26, 56) * (0.9 + r() * 0.2)
          return s('g', { class: 'p2t-ms', transform: `translate(${f1(xs[i])} ${f1(ground)})` },
            s('g', { class: 'p2t-ms-in' }, o.art?.mark ? o.art.mark(i, sw, seed + i * 17) : stoneArt(sw, sw * (0.62 + r() * 0.2), seed + i * 17)),
            m.compare ? s('circle', { class: 'p2t-ms-dot', cx: 0, cy: 7, r: 2 }) : null)
        })
        // today: a slender upright stone with the red seal, then the horizon running on into the mist
        const tw = clamp((xs[1] - xs[0]) * 0.36, 18, 34)
        const back = o.art?.back ?? defaultBack
        sky.replaceChildren(
          s('path', { class: 'p2t-paper', d: paper }),
          s('g', { 'clip-path': `url(#${clip})` }, ...back({ w, h: hh, ground, xs, roll, seed })),
          s('clipPath', { id: clip }, s('path', { d: paper })),
          ...rakes,
          s('path', { class: 'p2t-track', d: stroke([[xs[0] - 20, ground + 1], [(xs[0] + xt) / 2, ground + 2], [xt, ground + 1]], 2.6, 0.08, 0.04, 0.4), filter: 'url(#ink-rough)' }),
          s('path', { class: 'p2t-horizon', d: `M${f1(xt + 8)} ${f1(ground - 1)}L${f1(w - roll - 8)} ${f1(ground - 3)}` }),
          s('rect', { class: 'p2t-mist', x: f1(xt - 30), y: paperTop, width: f1(w - roll - xt + 30), height: f1(paperBot - paperTop), fill: 'url(#p2-mist)' }),
          ...gs,
          s('g', { class: 'p2t-today', transform: `translate(${f1(xs[n])} ${f1(ground)})` },
            stoneArt(tw, tw * 2.2, seed + 99),
            s('rect', { class: 'p2t-seal', x: f1(-tw * 0.16), y: f1(-tw * 1.3), width: f1(tw * 0.32), height: f1(tw * 0.4), rx: 1, filter: 'url(#ink-rough)' })),
          roller(roll / 2),
          roller(w - roll / 2))
        return gs
      }

      ctx.onCleanup(onSize(ctx.art, layout))
    },
  }
}

/** The scroll's default painting: a far ink range, nearer peaks crowding toward today, mist along the sand. */
function defaultBack({ w, h, ground, xs, roll, seed }: TideGeo): SVGElement[] {
  return [
    mist(w * 0.45, ground - h * 0.35, w * 0.7, h * 0.4),
    hills(roll, w - roll, ground - h * 0.1, h * 0.36, seed, 0.9, 5),
    hills(roll + w * 0.26, xs[xs.length - 1] - 10, ground - h * 0.02, h * 0.5, seed + 1, 0.45, 3),
    mist(w * 0.55, ground - h * 0.05, w * 0.62, h * 0.14),
  ]
}

/** Two numbers side by side as brushed ink bars, long–short (B.7.2 `compare`). Without a ratio: the numbers only. */
function compareBars(c: NonNullable<Tide['milestones'][number]['compare']>): HTMLElement {
  const r = c.ratio && c.ratio > 0 ? c.ratio : 0
  const [wb, wa] = !r ? [0, 0] : r <= 1 ? [1, r] : [1 / r, 1]
  const bar = (k: number, cls: string) =>
    s('svg', { class: `p2t-bar ${cls}`, viewBox: '0 0 200 14', preserveAspectRatio: 'none', style: `width:${f1(Math.max(3, k * 100))}%`, 'aria-hidden': 'true' },
      s('path', { d: stroke([[2, 7.5], [100, 6.6], [198, 7.2]], 11, 0.04, 0.12, 0.5) }))
  const row = (label: string | undefined, value: string, k: number, cls: string) =>
    h('div', { class: 'p2t-row' }, h('span', { class: 'p2t-row-l' }, label ?? ''), h('span', { class: 'p2t-row-b' }, r ? bar(k, cls) : null), h('span', { class: 'p2t-row-v' }, value))
  return h('div', { class: 'p2t-compare' }, row(c.beforeLabel, c.before, wb, 'before'), row(c.afterLabel, c.after, wa, 'after'))
}
