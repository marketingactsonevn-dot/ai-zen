import './guide.css'
import { fill, h, s } from '../../core/dom'
import type { SceneCtx } from '../../stations/types'
import { onSize, type Pt } from './ink'

/**
 * Part 2 guide marks (audit v3 G, H1–H7): the in-scene signs Part 1 teaches with — a vermilion dot on the next thing to
 * touch, a ticked groove to drag along, a dashed place to drop, a count carved in the scene, curved arrows for hidden
 * gestures. A scene only declares them; the frame does the rest (prompt per step, 6 s idle invite: see station.ts).
 *
 *   const g = guide(ctx)
 *   const next = g.dot(lampEl, { dir: [0, -1] })          // H1 on the lamp; when idle it leans up (the way to drag)
 *   const way = g.track(() => [[x0, y], [x1, y]], { ticks: 5, labels: ['2023', 'Hôm nay'] })   // H2 (points or a fn), way.set(t)
 *   const bowl = g.drop(bowlEl)                           // H3: bowl.lift(true) on pick-up, bowl.hit() on a good drop
 *   const lit = g.count(S.countTpl, 4, [x, y])            // H4 "{n}/{total} đèn", lit.set(2)
 *   const step = g.steps(S.prompts); step(0)              // H5 — and g.wrong(S.why, el) / g.ok(el) for H6
 *   g.gesture('rotate', wheelEl)                          // a hidden gesture gets a faint curved ink arrow
 *
 * Targets: an element (centre of its box, measured on resize and on refresh()), a point in px of ctx.art, or a function
 * returning one (read on every layout). No frame loop: CSS breathes the marks, `.scene.is-idle` makes them invite;
 * reduced motion = still marks, quality=low = no endless breathing. Everything is removed with the scene.
 */
export type Target = Element | Pt | (() => Pt)
export type Gesture = 'rotate' | 'drag-h' | 'drag-v' | 'hold' | 'swipe' | 'circle'

export interface Mark {
  el: HTMLElement
  /** move it to another target (the next lamp, the stone's new place) */
  at(t: Target): void
  /** fade out and remove: the step is done */
  done(): void
}
export interface Track extends Mark {
  /** how far along the groove the dragged thing is, 0 … 1 */
  set(t: number): void
}
export interface Drop extends Mark {
  /** something is being carried: the target wakes up */
  lift(on: boolean): void
  /** a good drop: a short glow, then gone */
  hit(): void
}
export interface Counter extends Mark {
  set(n: number): void
}
export interface Hold extends Mark {
  /** the ring fills as the press goes on, 0 … 1 */
  fill(p: number): void
}
export interface Guide {
  dot(t: Target, o?: { dir?: Pt; label?: string }): Mark
  track(pts: Pt[] | (() => Pt[]), o?: { ticks?: number; labels?: string[] }): Track
  drop(t: Target, o?: { w?: number; h?: number; round?: boolean }): Drop
  count(tpl: string, total: number, t: Target, o?: { n?: number }): Counter
  steps(texts: string[]): (i: number) => void
  wrong(text: string, t?: Element): void
  ok(t?: Element): void
  gesture(kind: 'hold', t: Target, o?: { r?: number }): Hold
  gesture(kind: Gesture, t: Target, o?: { r?: number }): Mark
  /** re-measure element targets after the scene moved things by hand */
  refresh(): void
}

const f1 = (n: number) => n.toFixed(1)
const px = (n: number) => `${f1(n)}px`

export function guide(ctx: SceneCtx): Guide {
  const layer = h('div', { class: 'p2g' })
  ctx.art.append(layer)
  type Item = { el: HTMLElement; t: Target; place: (p: Pt, box: DOMRect | null) => void }
  const items = new Set<Item>()

  function layout() {
    if (!layer.isConnected) return
    // read every box first, then write (one layout, README "gom một lượt")
    const base = ctx.art.getBoundingClientRect()
    const reads = [...items].map((it) => {
      const t = it.t
      if (t instanceof Element) {
        const r = t.getBoundingClientRect()
        return [it, [r.left - base.left + r.width / 2, r.top - base.top + r.height / 2] as Pt, r] as const
      }
      return [it, typeof t === 'function' ? t() : t, null] as const
    })
    for (const [it, p, box] of reads) it.place(p, box)
  }
  ctx.onCleanup(onSize(ctx.art, layout))

  function add(el: HTMLElement, t: Target, place: Item['place']): Mark & { item: Item } {
    const item: Item = { el, t, place }
    items.add(item)
    layer.append(el)
    let raf = requestAnimationFrame(layout) // the scene has laid itself out by the next frame
    ctx.onCleanup(() => cancelAnimationFrame(raf))
    return {
      el,
      item,
      at(nt) {
        item.t = nt
        cancelAnimationFrame(raf)
        raf = requestAnimationFrame(layout)
      },
      done() {
        if (!items.delete(item)) return
        el.classList.add('out')
        setTimeout(() => el.remove(), ctx.reduced ? 0 : 450)
      },
    }
  }
  const centre = (el: HTMLElement) => (p: Pt) => (el.style.transform = `translate(${px(p[0])}, ${px(p[1])})`)

  const g: Guide = {
    dot(t, o = {}) {
      const [dx, dy] = o.dir ?? [0, 0]
      const el = h('div', { class: 'p2g-dot', 'aria-hidden': 'true', style: `--dx:${f1(dx)};--dy:${f1(dy)}` }, h('i'), o.label ? h('span', { class: 'p2g-label' }, o.label) : null)
      // on an HTML element the dot rides inside it (dragged along, no measuring); elsewhere it is placed on the layer
      const ride = (x: Target) => x instanceof HTMLElement && !(x instanceof HTMLButtonElement && x.disabled)
      if (ride(t)) {
        el.classList.add('ride')
        ;(t as HTMLElement).append(el)
        const done = () => {
          el.classList.add('out')
          setTimeout(() => el.remove(), ctx.reduced ? 0 : 450)
        }
        ctx.onCleanup(() => el.remove())
        return { el, at: (nt) => (ride(nt) ? (nt as HTMLElement).append(el) : null), done }
      }
      const m = add(el, t, centre(el))
      return { el, at: m.at, done: m.done }
    },

    track(path, o = {}) {
      const ticks = o.ticks ?? o.labels?.length ?? 0
      const groove = s('path', { class: 'p2g-groove', pathLength: 1 })
      const run = s('path', { class: 'p2g-run', pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1 })
      const tickG = s('g', { class: 'p2g-ticks' })
      const svg = s('svg', { class: 'p2g-track' }, groove, run, tickG)
      const labels = (o.labels ?? []).map((l) => h('span', { class: 'p2g-tick-label' }, l))
      const el = h('div', { class: 'p2g-track-box', 'aria-hidden': 'true' }, svg, ...labels)
      const m = add(el, [0, 0], () => {
        const W = ctx.art.clientWidth, H = ctx.art.clientHeight
        const pts = typeof path === 'function' ? path() : path
        svg.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
        Object.assign(svg.style, { width: px(W), height: px(H) })
        const d = `M${pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')}`
        groove.setAttribute('d', d)
        run.setAttribute('d', d)
        // ticks evenly along the polyline, each a short stroke across it
        const L = [0]
        for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
        const len = L[L.length - 1] || 1
        let td = ''
        const where: Pt[] = []
        for (let k = 0; k < ticks; k++) {
          const at = ticks > 1 ? (k / (ticks - 1)) * len : 0
          let i = 1
          while (i < pts.length - 1 && L[i] < at) i++
          const a = pts[i - 1], b = pts[i]
          const u = (at - L[i - 1]) / (L[i] - L[i - 1] || 1)
          const x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u
          const sl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
          const nx = -(b[1] - a[1]) / sl, ny = (b[0] - a[0]) / sl
          const k2 = k === 0 || k === ticks - 1 ? 9 : 6
          td += `M${f1(x - nx * k2)} ${f1(y - ny * k2)}L${f1(x + nx * k2)} ${f1(y + ny * k2)}`
          where.push([x + nx * 20, y + ny * 20])
        }
        tickG.replaceChildren(s('path', { d: td }))
        labels.forEach((l, k) => where[k] && (l.style.transform = `translate(${px(where[k][0])}, ${px(where[k][1])}) translate(-50%, -50%)`))
      })
      return {
        el, at: m.at, done: m.done,
        set(t) {
          run.setAttribute('stroke-dashoffset', (1 - Math.max(0, Math.min(1, t))).toFixed(3))
        },
      }
    },

    drop(t, o = {}) {
      const el = h('div', { class: `p2g-drop${o.round === false ? ' rect' : ''}`, 'aria-hidden': 'true' })
      const m = add(el, t, (p, box) => {
        const w = o.w ?? (box ? box.width + 16 : 72), hh = o.h ?? (box ? box.height + 16 : 72)
        Object.assign(el.style, { width: px(w), height: px(hh), transform: `translate(${px(p[0] - w / 2)}, ${px(p[1] - hh / 2)})` })
      })
      return {
        el, at: m.at, done: m.done,
        lift: (on) => el.classList.toggle('is-lift', on),
        hit() {
          el.classList.remove('is-lift')
          el.classList.add('is-hit')
          m.done()
        },
      }
    },

    count(tpl, total, t, o = {}) {
      const el = h('p', { class: 'p2g-count' }, fill(tpl, { n: o.n ?? 0, total }))
      let live = false
      const m = add(el, t, centre(el))
      return {
        el, at: m.at, done: m.done,
        set(n) {
          el.textContent = fill(tpl, { n, total })
          if (!live) (live = true), el.setAttribute('aria-live', 'polite') // after the first change only
          if (!ctx.reduced) el.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 420 })
        },
      }
    },

    steps: (texts) => (i) => texts[i] && ctx.prompt(texts[i]),

    wrong(text, t) {
      ctx.prompt(text, 'wrong')
      // added on top of whatever places the element (its own transform / translate stays)
      if (t && !ctx.reduced) t.animate([{ translate: '0 0' }, { translate: '-5px 0' }, { translate: '4px 0' }, { translate: '-2px 0' }, { translate: '0 0' }], { duration: 380, easing: 'ease-out', composite: 'add' })
    },

    ok(t) {
      if (!t) return
      const ring = h('div', { class: 'p2g-ok', 'aria-hidden': 'true' })
      const m = add(ring, t, centre(ring))
      setTimeout(m.done, ctx.reduced ? 600 : 900)
    },

    gesture(kind: Gesture, t: Target, o: { r?: number } = {}): Hold {
      const r = o.r ?? 40
      const svg = s('svg', { class: 'p2g-gesture', viewBox: `${-r - 12} ${-r - 12} ${2 * r + 24} ${2 * r + 24}`, width: 2 * r + 24, height: 2 * r + 24 }, ...gestureArt(kind, r))
      const el = h('div', { class: `p2g-g p2g-${kind}`, 'aria-hidden': 'true' }, svg)
      const m = add(el, t, centre(el))
      const ring = svg.querySelector('.p2g-hold-fill')
      return {
        el, at: m.at, done: m.done,
        fill: (p) => ring?.setAttribute('stroke-dashoffset', f1(1 - Math.max(0, Math.min(1, p)))),
      }
    },

    refresh: () => requestAnimationFrame(layout),
  }
  return g
}

/** Faint ink arrows for gestures nobody would guess: an arc round the thing, a two-way stroke, a ring that fills. */
function gestureArt(kind: Gesture, r: number): SVGElement[] {
  const head = (x: number, y: number, ang: number) => {
    const a = (ang * Math.PI) / 180, k = 7
    return `M${f1(x + Math.cos(a + 2.6) * k)} ${f1(y + Math.sin(a + 2.6) * k)}L${f1(x)} ${f1(y)}L${f1(x + Math.cos(a - 2.6) * k)} ${f1(y + Math.sin(a - 2.6) * k)}`
  }
  const arc = (a0: number, a1: number, rr: number) => {
    const p = (a: number) => [Math.cos((a * Math.PI) / 180) * rr, Math.sin((a * Math.PI) / 180) * rr]
    const [x0, y0] = p(a0), [x1, y1] = p(a1)
    return { d: `M${f1(x0)} ${f1(y0)}A${rr} ${rr} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} 1 ${f1(x1)} ${f1(y1)}`, end: [x1, y1, a1 + 90] as const }
  }
  const ink = (d: string, cls = 'p2g-ink') => s('path', { class: cls, d })
  switch (kind) {
    case 'rotate': {
      const a = arc(-150, 60, r)
      return [ink(a.d + head(a.end[0], a.end[1], a.end[2]))]
    }
    case 'circle': {
      const a = arc(-80, 245, r)
      return [ink(a.d + head(a.end[0], a.end[1], a.end[2]))]
    }
    case 'drag-h':
      return [ink(`M${-r} 0Q0 -6 ${r} 0` + head(r, 0, 0) + head(-r, 0, 180))]
    case 'drag-v':
      return [ink(`M0 ${-r}Q6 0 0 ${r}` + head(0, r, 90) + head(0, -r, -90))]
    case 'swipe':
      return [ink(`M${-r} ${f1(r * 0.15)}C${f1(-r * 0.4)} ${f1(-r * 0.35)} ${f1(r * 0.2)} ${f1(r * 0.4)} ${r} ${f1(-r * 0.1)}` + head(r, -r * 0.1, -20))]
    case 'hold':
      return [
        s('circle', { class: 'p2g-ink p2g-hold-track', r }),
        s('circle', { class: 'p2g-hold-fill', r, pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, transform: 'rotate(-90)' }),
      ]
  }
}
