import raw from '../../content/tram-19.json'
import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { blob, clamp, onSize, rng, stableHeight, stroke, type Pt } from '../../ui/part2/ink'
import { brushFrame, moon, pine, wash } from '../../ui/part2/paint'
import { findTakeaway, takeaway } from '../../ui/part2/takeaway'

const T = raw.scenes.stele

/** Scene 3 · read the stele without being fooled: sweep a lantern over a mock press release, five faint marks appear. */
export function steleScene(ctx: SceneCtx) {
  const stableH = stableHeight(ctx, [T.insight as Fact])
  const found = new Set<number>()
  const roof = h('div', { class: 't19s-roof' }) // room for the painted eaves (pavilion below)
  const pav = s('svg', { class: 't19s-pav', 'aria-hidden': 'true' })
  const glow = h('div', { class: 't19s-glow', 'aria-hidden': 'true' })
  const lines = T.lines.map((l, i) => {
    const sign = h('span', { class: 't19s-sign', 'aria-hidden': 'true' }, l.sign)
    const b = h('button', { class: 't19s-line', type: 'button', 'aria-label': l.aria, onClick: () => reveal(i) }, h('span', { class: 't19s-text' }, l.text), sign)
    b.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && reveal(i))
    return b
  })
  const stele = h('div', { class: 't19s-stele', role: 'group', 'aria-label': T.lanternAria },
    glow,
    h('p', { class: 't19s-title' }, T.mockTitle),
    h('div', { class: 't19s-lines' }, ...lines))
  const count = h('p', { class: 'p2-eyebrow t19s-count' }, fill(T.found, { n: 0 }))
  const read = h('div', { class: 't19s-read' })
  const doneBtn = h('button', { class: 't19s-done', type: 'button', onClick: openCard }, T.done)
  doneBtn.hidden = true
  const side = h('div', { class: 't19s-side' }, count, read, doneBtn, ctx.fact(T.mockNote as Fact, 'p', 't19s-note'))
  const hall = h('div', { class: 't19s-hall' }, pav, roof, stele)
  const root = h('div', { class: 't19 t19s' }, hall, side)
  ctx.art.append(root)
  ctx.prompt(T.prompt)

  let box: DOMRect | null = null
  stele.addEventListener('pointerenter', () => (box = stele.getBoundingClientRect()))
  stele.addEventListener('pointermove', (e) => {
    if (!box) return
    glow.style.transform = `translate(${e.clientX - box.left}px, ${e.clientY - box.top}px)`
    glow.classList.add('on')
  })
  stele.addEventListener('pointerleave', () => glow.classList.remove('on'))
  ctx.onCleanup(onSize(ctx.art, () => {
    box = null
    root.style.height = `${stableH(ctx.art.clientHeight)}px`
    paintPavilion(pav, hall.clientWidth, hall.clientHeight, roof.offsetHeight)
  }))

  function reveal(i: number) {
    const l = T.lines[i]
    lines[i].classList.add('found')
    lines[i].setAttribute('aria-label', `${l.aria} · ${l.sign}`)
    read.setAttribute('aria-live', 'polite')
    read.replaceChildren(h('p', { class: 't19s-sign-big' }, l.sign), h('p', { class: 't19s-q' }, l.question))
    if (found.has(i)) return
    found.add(i)
    ctx.chime('tap')
    count.textContent = fill(T.found, { n: found.size })
    if (found.size === T.lines.length) {
      doneBtn.hidden = false
      ctx.insight(T.insight as Fact, T.detail as Fact)
    }
  }

  function openCard() {
    const card = findTakeaway(T.takeaway)
    if (!card || root.classList.contains('carded')) return
    root.classList.add('carded')
    const wrap = h('div', { class: 't19s-card' }, takeaway(card, null, ctx.onCleanup))
    root.append(wrap)
    ;(wrap.querySelector('button') as HTMLElement | null)?.focus({ preventScroll: true })
  }
}

/** The pavilion round the stele, in the hall's px: moon and pine behind, two posts, sweeping eaves, the stone plinth. */
function paintPavilion(svg: SVGSVGElement, W: number, H: number, roofH: number) {
  if (W < 40 || H < 40) return
  const r = rng(1931)
  const pad = clamp(W * 0.07, 14, 34)
  const x0 = -pad, x1 = W + pad
  const ey = roofH + 4 // the eave line, just over the stele's top
  const rise = clamp(W * 0.1, 22, 46)
  // eaves flat in the middle, flicking up at the corners; a heavy ridge above
  const ex0 = x0 - pad * 0.9, ex1 = x1 + pad * 0.9
  const eave: Pt[] = Array.from({ length: 25 }, (_, i) => {
    const u = Math.abs(i / 12 - 1)
    return [ex0 + ((ex1 - ex0) * i) / 24, ey - rise * 0.8 * Math.pow(u, 3.2)]
  })
  const ridgeLine: Pt[] = Array.from({ length: 25 }, (_, i) => {
    const u = Math.abs(i / 12 - 1)
    return [W * 0.16 + (W * 0.68 * i) / 24, ey - rise * 1.5 - rise * 0.1 * Math.pow(u, 4)]
  })
  let tiles = ''
  for (let i = 1; i < 24; i += 1) {
    const [ax, ay] = ridgeLine[i], [bx, by] = eave[i]
    tiles += stroke([[ax, ay + 2], [(ax + bx) / 2 + (r() - 0.5), (ay + by) / 2], [bx, by - 2]], 1.6 + r() * 0.8, 0.15, 0.25, 0.3)
  }
  const roofShape = `M${eave.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}L${ridgeLine.slice().reverse().map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z`
  const post = (x: number) => stroke([[x, ey - 2], [x + (r() - 0.5) * 2, (ey + H) / 2], [x, H + 14]], clamp(W * 0.028, 7, 13), 0.02, 0.04, 0.7)
  const base: Pt[] = [[-pad * 0.4, H + 2], [W + pad * 0.4, H + 2]]
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
  svg.replaceChildren(
    moon(W * 0.86, -rise * 1.2, clamp(W * 0.05, 12, 22), 1932, true),
    pine(x0 - pad * 1.2, H + 14, H * 0.9, 1933, 1),
    wash(blob(W / 2, H + 14, W * 0.75, 12, 1934, 0.1), 0.2),
    s('path', { class: 't19s-post', d: post(x0 + pad * 0.3) + post(x1 - pad * 0.3), filter: 'url(#ink-rough)' }),
    s('path', { class: 't19s-plinth', d: `M${base[0][0]} ${H - 2}H${base[1][0]}V${H + 14}H${base[0][0]}Z` }),
    brushFrame(base[0][0], H - 2, base[1][0] - base[0][0], 16, 1935, 1.6),
    s('path', { class: 't19s-eave', d: roofShape, filter: 'url(#ink-wash)' }),
    s('path', { class: 't19s-tiles', d: tiles }),
    s('path', { class: 't19s-eave-ink', d: stroke(eave, 3.2, 0.06, 0.06, 0.4) + stroke(ridgeLine, 5, 0.04, 0.04, 0.6), filter: 'url(#ink-rough)' }))
}
