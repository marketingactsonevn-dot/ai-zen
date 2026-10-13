import { fill, h, s, viDate } from '../../core/dom'
import { gsap } from '../../core/anim'
import { L, type Fact } from '../../core/content'
import { COMPANY_DATA, logoStone, type Company } from '../../ui/logo'
import type { SceneCtx } from '../types'
import { ASOF, badgeText, C, fitOf, ladderOf, modelFact, monthPos, scaleOf } from './data'
import { brush, catGlyph, defs, hash, pebble, vf } from './ink'

const K = C.card
const VF = L.kinds.verify
// the timeline runs from 12/2025 (the oldest date in the data) to the day the data was checked
const SPAN = monthPos(ASOF)!

/** A cairn: the ladder stacked big (bottom) to small (top); the names sit beside each stone as text (so they can carry a verify ring). */
export function miniCairn(c: Company, R: number, tiered: boolean) {
  const tiers = ladderOf(c)
  const n = tiers.length
  const svg = s('svg', { class: 't17-cairn', 'aria-hidden': 'true' })
  const id = defs(svg)
  const rxs = tiers.map((_, i) => (tiered ? R * (1 - (0.44 * i) / Math.max(1, n - 1)) : R * (0.92 - 0.06 * i)))
  let y = 0
  const pos = rxs.map((rx, i) => {
    const ry = rx * 0.42
    const base = y
    y -= ry * 2 * 0.86
    return { x: (i % 2 ? 1 : -1) * rx * 0.05 * (i ? 1 : 0), base, rx, ry }
  })
  // names sit beside their stones; small stones near the top are thin, so names are spaced apart and their leaders bend
  const lh = tiers.map((t) => 10 + 17 * t.length)
  const ly = pos.map((p) => p.base - p.ry)
  for (let i = 1; i < ly.length; i++) ly[i] = Math.min(ly[i], ly[i - 1] - (lh[i - 1] + lh[i]) / 2)
  const top = Math.min(y, ly[ly.length - 1] - lh[lh.length - 1] / 2) - 8
  const left = -R - 6
  const labX = R * 1.06 + 16
  const vw = labX - left
  const vh = -top + R * 0.3
  svg.setAttribute('viewBox', `${left} ${top} ${vw} ${vh}`)
  Object.assign(svg.style, { width: `${vw}px`, height: `${vh}px` })
  const stones: SVGGElement[] = []
  const labels: HTMLElement[] = []
  let anyVf = false
  pos.forEach((p, i) => {
    const [m, ...more] = tiers[i]
    const g = pebble(p.x, p.base, p.rx, p.ry, hash(m.name), id, { moss: i === 0 })
    if (m.status) g.classList.add('t17-ghost')
    svg.append(g)
    stones.push(g)
    const ty = p.base - p.ry
    const sx = p.x + p.rx + 4
    svg.append(s('path', { class: 't17-lead', d: `M${sx.toFixed(1)} ${ty.toFixed(1)}L${(labX - 12).toFixed(1)} ${ly[i].toFixed(1)}H${(labX - 4).toFixed(1)}` }))
    const mark = (v?: boolean) => (v ? ((anyVf = true), vf(VF)) : null)
    labels.push(h('span', { class: 't17c-lab', style: `left:${labX - left + 2}px;top:${ly[i] - top}px` },
      h('span', null, m.name, mark(m.verify), m.status ? ` · ${C.status[m.status]}` : null),
      ...more.map((x) => h('span', { class: 't17c-lab2' }, x.name, mark(x.verify)))))
  })
  const el = h('div', { class: 't17c-cairnart', style: `height:${vh}px` }, svg, ...labels)
  return { el, stones, labels, anyVf }
}

interface Dot {
  at: number
  label: string
  fact: Fact
  verify: boolean
  gone: boolean
}

/** Release dots on one shared axis (12/2025 → 10/2026). Dots that crowd fan out along a row, each tied to its day by a thin leader. */
function timeline(ctx: SceneCtx, c: Company) {
  const items: Dot[] = [
    ...c.models.filter((m) => monthPos(m.date) != null).map((m) => ({
      at: monthPos(m.date)!, label: fill(K.dot, { name: m.name, date: viDate(m.date) }), fact: modelFact(m), verify: !!m.verify, gone: !!m.status,
    })),
    ...(C.closures[c.id] ?? []).map((z) => ({ at: monthPos(z.date)!, label: fill(K.closed, { label: z.label, date: viDate(z.date) }), fact: z.fact, verify: false, gone: true })),
  ].sort((a, b) => a.at - b.at)
  if (!items.length) return null
  const say = h('div', { class: 't17c-say', 'aria-live': 'polite' }, h('p', { class: 't17c-hint' }, K.tlHint))
  const svg = s('svg', { class: 't17c-tlsvg', 'aria-hidden': 'true' })
  const track = h('div', { class: 't17c-track' }, svg)
  let cur = -1
  const show = (i: number) => {
    if (i === cur) return
    dots[cur]?.classList.remove('on')
    cur = i
    dots[i].classList.add('on')
    say.replaceChildren(ctx.fact(items[i].fact, 'p', 't17c-say-t'))
  }
  const dots = items.map((it, i) => {
    const b = h('button', {
      class: `t17c-dot${it.verify ? ' verify' : ''}${it.gone ? ' gone' : ''}`, type: 'button',
      'aria-label': it.verify ? `${it.label} (${VF})` : it.label,
    })
    b.addEventListener('click', () => show(i))
    b.addEventListener('pointerenter', () => show(i))
    b.addEventListener('focus', () => show(i))
    // ← → walk along the dots (the card already keeps the scene from flipping)
    b.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
      if (!d) return
      e.preventDefault()
      dots[(i + d + dots.length) % dots.length].focus()
    })
    track.append(b)
    return b
  })
  const lay = () => {
    const W = track.clientWidth
    if (!W) return
    const pad = 12
    const aw = W - pad * 2
    const rowY = 14
    const axisY = 44
    const xs = items.map((it) => pad + (it.at / SPAN) * aw)
    // fan crowded dots out to at least a touch target apart, then pull back from the right end
    const gap = items.length > 1 ? Math.min(44, aw / (items.length - 1)) : 0
    const f = [...xs]
    for (let i = 1; i < f.length; i++) f[i] = Math.max(f[i], f[i - 1] + gap)
    if (f[f.length - 1] > W - pad) {
      f[f.length - 1] = W - pad
      for (let i = f.length - 2; i >= 0; i--) f[i] = Math.min(f[i], f[i + 1] - gap)
    }
    svg.setAttribute('viewBox', `0 0 ${W} 56`)
    svg.replaceChildren(
      s('path', { class: 'k t17c-axis', d: brush([[pad - 4, axisY], [W / 2, axisY - 0.6], [W - pad + 3, axisY]], 1.8, { a: 0.05, b: 0.08, min: 0.5, wob: 0.06 }) }),
      ...Array.from({ length: Math.floor(SPAN) + 1 }, (_, i) => s('path', { class: 't17c-tick', d: `M${(pad + (i / SPAN) * aw).toFixed(1)} ${axisY}v4` })),
      s('path', { class: 't17c-now', d: `M${W - pad} ${axisY - 6}v12` }),
      ...items.map((_, i) => s('path', { class: 't17c-leader', d: `M${f[i].toFixed(1)} ${rowY + 6}C${f[i].toFixed(1)} ${rowY + 20} ${xs[i].toFixed(1)} ${axisY - 16} ${xs[i].toFixed(1)} ${axisY - 1}` })),
      ...items.map((_, i) => s('circle', { class: 't17c-pin', cx: xs[i].toFixed(1), cy: axisY, r: 1.6 })))
    dots.forEach((b, i) => Object.assign(b.style, { left: `${f[i]}px`, top: `${rowY}px` }))
  }
  const ro = new ResizeObserver(lay)
  ro.observe(track)
  const el = h('div', { class: 't17c-tl', role: 'group', 'aria-label': K.timelineGroup },
    h('p', { class: 't17c-k' }, K.timeline), say, track,
    h('div', { class: 't17c-ends', 'aria-hidden': 'true' }, h('span', null, K.start), h('span', { class: 'now' }, `${K.now} · ${viDate(ASOF)}`)))
  return { el, lay, stop: () => ro.disconnect(), anyVf: items.some((d) => d.verify) }
}

const block = (ctx: SceneCtx, label: string, f: Fact | undefined, cls = '') => (f ? h('div', { class: `t17c-b ${cls}` }, h('p', { class: 't17c-k' }, label), ctx.fact(f, 'p', 't17c-t')) : null)
const low = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)

/** The card that opens from an island: the model cairn first, then philosophy, release dots, who it suits. */
export function openCard(ctx: SceneCtx, c: Company, onClose: () => void): () => void {
  const tiered = C.scenes.ladder.companies.some((l) => l.id === c.id)
  const inLadder = new Set(ladderOf(c).flat())
  const rest = c.models.filter((m) => !inLadder.has(m))
  const country = C.countries[c.country ?? 'none'] ?? C.countries.none
  const wl = c.weights === 'closed' || c.weights === 'mixed' ? C.weights[c.weights] : ''
  const roomy = ctx.el.clientWidth > 640 && ctx.el.clientHeight > 620
  const tall = ctx.el.clientHeight > 860

  let about: HTMLElement | null
  if (c.philosophy) about = block(ctx, K.philosophy, c.philosophy)
  else if (c.country && COMPANY_DATA.regionPhilosophy[c.country]) about = block(ctx, K.regionPhilosophy, COMPANY_DATA.regionPhilosophy[c.country])
  else if (c.focus) about = block(ctx, K.focus, c.focus)
  else {
    // no stated philosophy: show a model's strengths, and say whose they are
    const m = c.models.find((x) => x.strengths)
    about = m ? block(ctx, fill(K.strengths, { model: m.name }), m.strengths) : null
  }
  const hist = block(ctx, K.history, c.history, 't17c-hist')

  const close = h('button', { class: 't17c-x', type: 'button', 'aria-label': K.close }, h('span', { 'aria-hidden': 'true' }))
  const title = h('h3', { class: 't17c-name', tabindex: '-1' }, c.name)
  const head = h('header', { class: 't17c-head' },
    logoStone(c.id, { size: 50, decorative: true, float: false }),
    h('div', null, title, h('p', { class: 't17c-meta' }, [country, wl].filter(Boolean).join(' · '))),
    close)
  // an ink stroke instead of a ruled line
  const rule = s('svg', { class: 't17c-rule', viewBox: '0 0 400 10', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    s('path', { class: 'k', d: brush([[2, 5.6], [140, 4.8], [290, 5.2], [398, 4.6]], 3.2, { a: 0.04, b: 0.62, min: 0.06, wob: 0.05 }) }))

  let anyVf = false
  let stones: SVGGElement[] = []
  let cairnLabels: HTMLElement[] = []
  let models: HTMLElement
  if (c.models.length) {
    const cn = miniCairn(c, tiered ? (tall ? 62 : roomy ? 52 : 42) : roomy ? 40 : 32, tiered)
    stones = cn.stones
    cairnLabels = cn.labels
    anyVf ||= cn.anyVf
    const sc = scaleOf(c.id)
    const others = rest.length
      ? h('ul', { class: 't17c-rest' }, ...[...new Set(rest.map((m) => m.kind))].map((k) =>
          h('li', null, catGlyph(k), h('span', { class: 't17c-kind' }, K.kinds[k]),
            h('span', null, ...rest.filter((m) => m.kind === k).flatMap((m, i) => {
              anyVf ||= !!m.verify
              return [i ? ', ' : '', m.name, m.verify ? vf(VF) : '', m.status ? ` (${C.status[m.status]})` : '']
            })))))
      : null
    models = h('div', { class: 't17c-b t17c-models' },
      h('p', { class: 't17c-k' }, K.ladder, tiered ? h('span', { class: 't17c-hint2' }, ` · ${fill(K.ladderHint, { big: low(sc[sc.length - 1]), small: low(sc[0]) })}`) : null),
      cn.el, others)
  } else models = h('p', { class: 't17c-t t17c-none' }, K.noModels)

  const tl = c.models.length ? timeline(ctx, c) : null
  anyVf ||= !!tl?.anyVf
  const body = h('div', { class: 't17c-body' },
    models,
    about,
    hist,
    tl?.el,
    block(ctx, K.fit, fitOf(c), 't17c-fit'),
    h('div', { class: 't17c-foot' },
      anyVf ? h('p', { class: 't17-legend on', 'aria-hidden': 'true' }, h('span', { class: 't17-vf' }), VF) : null,
      h('p', { class: 't17-badge in-card' }, badgeText())))
  const card = h('section', { class: 't17c', role: 'dialog', 'aria-modal': 'true', 'aria-label': fill(K.label, { name: c.name }) }, head, rule, body)
  const veil = h('div', { class: 't17c-veil', 'aria-hidden': 'true' })
  // the card floats over the whole scene (art and foot), below the top bar and above the rail
  ctx.el.append(veil, card)
  tl?.lay()
  title.focus({ preventScroll: true })

  let done = false
  const shut = () => {
    if (done) return
    done = true
    removeEventListener('keydown', onKey, true)
    tl?.stop()
    const end = () => {
      card.remove()
      veil.remove()
    }
    if (ctx.reduced) end()
    else {
      gsap.to(card, { opacity: 0, y: 12, duration: 0.45, ease: 'power2.in', onComplete: () => void setTimeout(end) })
      gsap.to(veil, { opacity: 0, duration: 0.45 })
    }
    onClose()
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      shut()
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault() // keep the scene from flipping under an open card
    } else if (e.key === 'Tab') {
      const f = [...card.querySelectorAll<HTMLElement>('button, a[href]')].filter((x) => x.offsetParent)
      if (!f.length) return
      const first = f[0]
      const last = f[f.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === title)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }
  addEventListener('keydown', onKey, true)
  close.addEventListener('click', shut)
  veil.addEventListener('click', shut)

  if (!ctx.reduced) {
    ctx.anim(() => {
      gsap.fromTo(veil, { opacity: 0 }, { opacity: 1, duration: 0.7 })
      gsap.fromTo(card, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', clearProps: 'transform' })
      gsap.fromTo(rule, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 1.1, delay: 0.25, ease: 'power2.out', clearProps: 'clipPath' })
      gsap.from(body.children, { opacity: 0, y: 8, duration: 0.8, stagger: 0.07, delay: 0.15, ease: 'power3.out', clearProps: 'opacity,transform' })
      // the cairn is built stone by stone, each name arriving as its stone lands
      if (stones.length) {
        gsap.from(stones, { y: -22, opacity: 0, duration: 0.7, stagger: 0.16, delay: 0.35, ease: 'power3.in' })
        gsap.from(cairnLabels, { opacity: 0, x: -6, duration: 0.6, stagger: 0.16, delay: 0.85, ease: 'power3.out', clearProps: 'opacity,transform' })
      }
    })
  }
  return shut
}
