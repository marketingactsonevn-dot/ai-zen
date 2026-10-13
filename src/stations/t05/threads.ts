import { fill, h, nextId, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { C, blob, journey, question, rng, sheetArt, stoneArt, stroke, tokText, type Pt } from './shared'

const T = C.scenes.threads

/** Points along a cubic Bézier. */
function bez(a: Pt, c1: Pt, c2: Pt, b: Pt, n = 14): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n, u = 1 - t
    return [u * u * u * a[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * b[0], u * u * u * a[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * b[1]] as Pt
  })
}

/** Scene 3: the question as stones over still water. Tap a word: vermilion threads reach back to the words it "looks at"
 *  (thicker = more attention, illustrative); ripples bloom under them. */
export function mountThreads(ctx: SceneCtx) {
  const q = question()
  const names = [C.sheet.name, ...q.tokens.map(([t]) => tokText(t))]
  const ink = s('svg', { class: 't5-att-ink', 'aria-hidden': 'true' })
  const water = s('g', { class: 't5-att-water' })
  const web = s('g', { class: 't5-att-web' })
  const defs = s('defs')
  const ripples = s('g', { class: 't5-att-ripples' })
  const threadsG = s('g', { class: 't5-att-threads' })
  ink.append(defs, water, web, ripples, threadsG)

  const stones = names.map((name, i) =>
    h('button', { class: `t5-tok t5-att-tok${i === 0 ? ' is-sheet' : ''}${i === q.hint ? ' is-hint' : ''}`, type: 'button', 'aria-pressed': 'false', 'aria-label': fill(T.tokAria, { w: name }), tabindex: i === q.hint ? '0' : '-1' },
      h('span', { class: 't5-tok-body' }, i === 0 ? sheetArt() : stoneArt(i * 7 + 3), h('span', { class: 't5-tok-w' }, i === 0 ? C.sheet.name : name))))
  // on narrow screens the sentence breaks into two even lines (the break only shows there)
  const half = Math.ceil(stones.length / 2)
  const row = h('div', { class: 't5-att-row', role: 'group', 'aria-label': T.aria }, ...stones.slice(0, half), h('span', { class: 't5-att-brk', 'aria-hidden': 'true' }), ...stones.slice(half))
  const stage = h('div', { class: 't5-att-stage' }, ink, row)
  const cap = h('p', { class: 't5-att-cap', 'aria-live': 'polite' })
  const root = h('div', { class: 't5-scene t5-att' }, journey(2), stage, cap, h('div', { class: 't5-att-tag' }, ctx.tag('illustration')))
  ctx.art.append(root)
  ctx.prompt(T.prompt)

  // the pond's wash fades out towards its edge
  const pondId = nextId('t5pond')
  const pondGrad = s('radialGradient', { id: pondId },
    s('stop', { offset: '0', class: 't5-pond-in' }), s('stop', { offset: '0.6', class: 't5-pond-mid' }), s('stop', { offset: '1', class: 't5-pond-out' }))
  let sel = -1
  let explored = false
  let anchors: { top: Pt; bot: Pt; w: number }[] = []
  let maxLift = 120
  let maxDrop = 60
  let rowOf: number[] = []
  let rows = 1

  const measure = () => {
    const sr = stage.getBoundingClientRect()
    ink.setAttribute('viewBox', `0 0 ${sr.width.toFixed(0)} ${sr.height.toFixed(0)}`)
    anchors = stones.map((st) => {
      const b = (st.querySelector('.t5-tok-body') as HTMLElement).getBoundingClientRect()
      const cx = b.left - sr.left + b.width / 2
      return { top: [cx, b.top - sr.top + 2] as Pt, bot: [cx, b.bottom - sr.top] as Pt, w: b.width }
    })
    maxLift = Math.max(40, Math.min(...anchors.map((a) => a.top[1])) - 14)
    maxDrop = Math.max(24, sr.height - Math.max(...anchors.map((a) => a.bot[1])) - 10)
    const tops = [...new Set(anchors.map((a) => Math.round(a.bot[1] / 16)))].sort((a, b) => a - b)
    rowOf = anchors.map((a) => tops.indexOf(Math.round(a.bot[1] / 16)))
    rows = tops.length
    root.classList.toggle('is-wrapped', rows > 1)
    // still water: a soft wash under the stones, a few long tapered ripples below it
    const rb = row.getBoundingClientRect()
    const rcx = rb.left - sr.left + rb.width / 2
    const y0 = rb.bottom - sr.top + 8
    const pond = s('path', { class: 't5-att-pond', fill: `url(#${pondId})`, d: blob(rcx, rb.top - sr.top + rb.height * 0.62, rb.width * 0.62, rb.height * 0.75 + 16, 4, 0.06, 26) })
    const lines: SVGPathElement[] = []
    for (let k = 0; k < 4; k++) {
      const y = y0 + k * Math.max(9, Math.min(16, (sr.height - y0) / 5)) + k * k
      if (y > sr.height - 4) break
      const half = Math.min(sr.width * 0.46, rb.width * (0.32 + k * 0.1))
      const cx = rcx + Math.sin(k * 2.3) * 24
      lines.push(s('path', { d: stroke([[cx - half, y + 1], [cx, y - 1.5], [cx + half, y + 0.5]], 0.8 + k * 0.5, { head: 0.3, tail: 0.6, min: 0.05 }), style: `opacity:${(0.32 - k * 0.07).toFixed(2)}` }))
    }
    water.replaceChildren(pondGrad, pond, ...lines)
    // faint web of every glance in the sentence: dry, uneven hairlines (left out when the sentence wraps)
    const r = rng(23)
    web.replaceChildren(...(rows > 1 ? [] : q.attn.flatMap((list, i) => list.map(([j, w]) => {
      const pts = arcPts(i, j, () => (r() - 0.5) * 14)
      return s('path', { d: stroke(pts, 0.7 + w * 1.6 + r() * 0.5, { head: 0.1, tail: 0.5 + r() * 0.6, min: 0.1 }), style: `opacity:${(0.14 + w * 0.3 + r() * 0.1).toFixed(2)}` })
    }))))
    draw(false)
  }

  /** a thread from token i back to token j: over the stones on one line, under them on the lower line,
   *  and through the gap between the lines when it crosses — so no thread ever passes through a stone */
  const arcPts = (i: number, j: number, jit: () => number = () => 0) => {
    const dx = anchors[i].top[0] - anchors[j].top[0]
    if (rowOf[i] === rowOf[j]) {
      const under = rows > 1 && rowOf[i] === rows - 1
      const a = under ? anchors[i].bot : anchors[i].top, b = under ? anchors[j].bot : anchors[j].top
      const lift = Math.min(under ? maxDrop : maxLift, 26 + Math.abs(dx) * 0.32 + Math.abs(a[1] - b[1]) * 0.4) + jit()
      const y = under ? Math.max(a[1], b[1]) + lift : Math.min(a[1], b[1]) - lift
      return bez(a, [a[0] - dx * 0.08 + jit(), y], [b[0] + dx * 0.08 + jit(), y], b)
    }
    const a = anchors[i].top, b = anchors[j].bot
    const gy = (a[1] + b[1]) / 2
    return bez(a, [a[0], gy + jit()], [b[0], gy + jit()], b)
  }

  function draw(animate: boolean) {
    threadsG.replaceChildren()
    ripples.replaceChildren()
    defs.replaceChildren()
    stones.forEach((st, i) => {
      st.classList.toggle('is-sel', i === sel)
      st.classList.remove('is-tgt')
      st.style.removeProperty('--w')
      st.setAttribute('aria-pressed', String(i === sel))
    })
    root.classList.toggle('has-sel', sel >= 0)
    if (sel < 0 || anchors.length !== stones.length) return
    const list = [...q.attn[sel]].sort((a, b) => b[1] - a[1])
    list.forEach(([j, w], k) => {
      const pts = arcPts(sel, j)
      const id = nextId('t5m')
      const reveal = s('path', { d: `M${pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L')}`, fill: 'none', stroke: '#fff', 'stroke-width': 40, 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': animate ? 1 : 0 })
      defs.append(s('mask', { id, maskUnits: 'userSpaceOnUse' }, reveal))
      const body = stroke(pts, 2.2 + w * 13, { head: 0.08, tail: 0.75, min: 0.12 })
      threadsG.append(s('g', { mask: `url(#${id})`, style: `opacity:${(0.35 + w * 0.65).toFixed(2)}` },
        s('path', { class: 't5-att-bleed', d: body }),
        s('path', { class: 't5-att-thread', d: body })))
      // ripples under the stone being looked at
      const a = anchors[j]
      const rings = Math.max(1, Math.round(w * 3.4))
      const g = s('g', { class: 't5-att-ring', style: `--w:${w}` })
      for (let r = 0; r < rings; r++) {
        g.append(s('ellipse', { cx: a.bot[0], cy: a.bot[1] - 3, rx: a.w * (0.42 + r * 0.2 + w * 0.2), ry: 5 + r * 3 + w * 4, style: `animation-delay:${(0.5 + k * 0.12 + r * 0.45).toFixed(2)}s` }))
      }
      ripples.append(g)
      stones[j].classList.add('is-tgt')
      stones[j].style.setProperty('--w', w.toFixed(2))
      if (animate) ctx.anim(() => gsap.to(reveal, { attr: { 'stroke-dashoffset': 0 }, duration: 0.7 + (1 - w) * 0.4, delay: 0.08 + k * 0.1, ease: 'power2.inOut' }))
    })
    const top = list.slice(0, 2).map(([j]) => `“${names[j]}”`).join(', ')
    cap.textContent = fill(T.caption, { w: names[sel], list: top })
    if (animate) ctx.anim(() => gsap.fromTo(cap, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.3, ease: 'power3.out' }))
  }

  function choose(i: number, focus = false) {
    sel = i
    stones.forEach((st, k) => st.setAttribute('tabindex', k === i ? '0' : '-1'))
    if (focus) stones[i].focus({ preventScroll: true })
    root.classList.add('is-touched')
    if (q.attn[i].length === 0) {
      cap.textContent = ''
      draw(false)
      return
    }
    draw(!ctx.reduced)
    ctx.chime('soft')
    if (!explored) {
      explored = true
      ctx.insight(T.insight, T.detail)
    }
  }
  stones.forEach((st, i) => st.addEventListener('click', () => choose(i)))
  row.addEventListener('keydown', (e) => {
    const cur = stones.indexOf(document.activeElement as HTMLButtonElement)
    if (cur < 0) return
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!d) return
    e.preventDefault()
    choose((cur + d + stones.length) % stones.length, true)
  })

  const ro = new ResizeObserver(() => {
    root.classList.toggle('is-short', root.clientHeight < 300)
    measure()
  })
  ro.observe(stage)
  measure()
  // stones rise into place; the threads are measured again once they have settled
  if (!ctx.reduced) ctx.anim(() => gsap.from(stones, { opacity: 0, y: 18, duration: 1.1, stagger: 0.07, ease: 'power3.out', clearProps: 'opacity,transform', onComplete: () => void setTimeout(measure) }))
  return () => ro.disconnect()
}
