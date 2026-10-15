import './part2.css'
import { fill, h, s, viDate } from '../../core/dom'
import { L, type Fact } from '../../core/content'
import type { SceneDef } from '../../stations/types'
import type { Tide } from './types'
import { clamp, onSize, p2Defs, rng, seedOf, stableHeight, stoneArt, stroke, type Pt } from './ink'

export interface TideOpts {
  label: string
  /** default "Kéo trăng qua các mốc" */
  prompt?: string
  question?: string
  /** shown as the scene's insight once the moon reaches today (else the scene is just marked explored) */
  insight?: Fact | string
  detail?: Fact | string
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
      const valueText = (i: number) => (i < n ? fill(L.tideValue, { date: viDate(ms[i].date), label: ms[i].label }) : `${L.today} · ${today}`)

      const sky = s('svg', { class: 'p2t-svg', 'aria-hidden': 'true' })
      const dates = [...ms.map((m) => viDate(m.date)), `${L.today}`].map((t, i) =>
        h('span', { class: `p2t-date${i === n ? ' today' : ''}` }, t, i === n ? h('small', null, today) : null))
      const moon = h('div', {
        class: 'p2t-moon', role: 'slider', tabindex: '0', 'aria-label': L.progressTide,
        'aria-valuemin': '0', 'aria-valuemax': String(n), 'aria-valuenow': '0', 'aria-valuetext': valueText(0),
      }, h('span', { class: 'p2t-moon-disc' }))
      const horizonLabel = h('span', { class: 'p2t-horizon-label' }, L.horizon)
      const band = h('div', { class: 'p2t-band' }, sky, ...dates, horizonLabel, moon)
      const read = h('div', { class: 'p2t-card' })
      const root = h('div', { class: 'p2t' }, o.question ? h('p', { class: 'p2-question p2t-q' }, o.question) : null, band, read)
      ctx.art.append(root)
      ctx.prompt(o.prompt ?? L.tidePrompt)

      let xs: number[] = [] // stop positions (px in the band)
      let stones: SVGGElement[] = []
      let at = -1 // the stop the card shows
      let mx = 0 // the moon's x
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

      // moon at x (px): every milestone it has passed stands up; the nearest stop fills the card
      function moveTo(x: number, snap: boolean) {
        if (!xs.length) return
        mx = clamp(x, xs[0], xs[n])
        let near = 0
        for (let i = 1; i <= n; i++) if (Math.abs(xs[i] - mx) < Math.abs(xs[near] - mx)) near = i
        if (snap) mx = xs[near]
        moon.classList.toggle('snap', snap)
        moon.style.transform = `translateX(${f1(mx)}px)`
        stones.forEach((g, i) => g.classList.toggle('up', xs[i] <= mx + 6))
        band.classList.toggle('past', mx >= xs[n] - 6)
        show(near)
      }

      // drag anywhere on the band; the moon follows the pointer and settles on the nearest stop
      let drag = false
      let bandX = 0
      band.addEventListener('pointerdown', (e) => {
        if (e.button) return
        drag = true
        bandX = band.getBoundingClientRect().left
        band.setPointerCapture(e.pointerId)
        moon.focus({ preventScroll: true })
        moveTo(e.clientX - bandX, false)
        ctx.chime('soft')
      })
      band.addEventListener('pointermove', (e) => drag && moveTo(e.clientX - bandX, false))
      const end = () => {
        if (!drag) return
        drag = false
        moveTo(mx, true)
      }
      band.addEventListener('pointerup', end)
      band.addEventListener('pointercancel', end)
      moon.addEventListener('keydown', (e) => {
        const k = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key]
        const to = k ? clamp(at + k, 0, n) : e.key === 'Home' ? 0 : e.key === 'End' ? n : -1
        if (to < 0) return
        e.preventDefault()
        moveTo(xs[to], true)
      })

      function layout() {
        const W = ctx.art.clientWidth
        const H = stableH(ctx.art.clientHeight)
        if (W < 60 || H < 60) return
        root.style.height = `${f1(H)}px`
        const qh = (root.querySelector('.p2t-q') as HTMLElement | null)?.offsetHeight ?? 0
        const bw = Math.min(W, 1120)
        const bh = clamp(H * 0.42, 150, 250)
        const top = qh ? qh + 8 : clamp(H * 0.04, 0, 24)
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
        moon.style.top = `${f1(bh * 0.2)}px`
        stones = draw(bw, bh, roll, ground, xt)
        moveTo(at < 0 ? xs[0] : xs[at], true)
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
          s('rect', { x: f1(x - roll / 2), y: 0, width: f1(roll), height: f1(hh), rx: f1(roll / 2) }),
          s('rect', { class: 'p2t-roller-hi', x: f1(x - roll * 0.22), y: 3, width: f1(roll * 0.18), height: f1(hh - 6), rx: f1(roll * 0.09) }))
        const gs = ms.map((m, i) => {
          const sw = clamp((xs[1] - xs[0]) * 0.56, 26, 56) * (0.9 + r() * 0.2)
          return s('g', { class: 'p2t-ms', transform: `translate(${f1(xs[i])} ${f1(ground)})` },
            s('g', { class: 'p2t-ms-in' }, stoneArt(sw, sw * (0.62 + r() * 0.2), seed + i * 17)),
            m.compare ? s('circle', { class: 'p2t-ms-dot', cx: 0, cy: 7, r: 2 }) : null)
        })
        // today: a slender upright stone with the red seal, then the horizon running on into the mist
        const tw = clamp((xs[1] - xs[0]) * 0.36, 18, 34)
        sky.replaceChildren(
          s('path', { class: 'p2t-paper', d: paper }),
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
