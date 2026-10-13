import { fill, h, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import { COMPANIES, logoStone, type Category, type Company } from '../../ui/logo'
import type { SceneCtx } from '../types'
import { badgeText, C, CATS, fitOf, motto } from './data'
import { catGlyph, clamp, defs, sand } from './ink'
import { icon } from '../../ui/icons'

const X = C.scenes.compare
type Zone = 'a' | 'both' | 'b' | 'none'

/** Scene 4 — two stones, their ripples overlap; the kinds of work drift to one side, the other, or the middle. */
export function compareScene(ctx: SceneCtx) {
  const back = s('svg', { class: 't17x-svg', 'aria-hidden': 'true' })
  const sandL = s('svg', { class: 't17-sandsvg', 'aria-hidden': 'true' })
  const svg = s('svg', { class: 't17x-svg', 'aria-hidden': 'true' })
  const mist = h('div', { class: 't17-mist', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'))
  const idx = X.pair.map((id) => Math.max(0, COMPANIES.findIndex((c) => c.id === id)))
  const pebs = CATS.map((k, i) => h('span', { class: 't17x-peb', 'data-zone': 'none', style: `--i:${i}`, 'aria-hidden': 'true' }, catGlyph(k), h('span', null, C.cats[k])))
  const both = h('p', { class: 't17x-both', 'aria-hidden': 'true' }, X.shared)
  const none = h('p', { class: 't17x-none', 'aria-hidden': 'true' }, X.none)
  const live = h('p', { class: 't17x-live', 'aria-live': 'polite' })

  const side = (k: 0 | 1) => {
    // tapping the stone itself turns to the next company
    const stone = h('button', { class: 't17x-stone ls-host', type: 'button', onClick: () => turn(k, 1) })
    const name = h('h3', { class: 't17x-name' })
    const prev = h('button', { class: 't17x-nav', type: 'button', 'aria-label': X.prev, onClick: () => turn(k, -1) }, icon('arrowL', 'icon sm'))
    const next = h('button', { class: 't17x-nav', type: 'button', 'aria-label': X.next, onClick: () => turn(k, 1) }, icon('arrowR', 'icon sm'))
    const text = h('div', { class: `t17x-text s${k}` })
    const col = h('section', { class: `t17x-col s${k}` }, h('div', { class: 't17x-head' }, prev, name, next))
    return { stone, name, text, col, prev, next }
  }
  const sides = [side(0), side(1)]
  const badge = h('p', { class: 't17-badge' }, badgeText())
  const root = h('div', { class: 't17 t17x', role: 'group', 'aria-label': X.region }, back, sandL, svg, mist, both, none, ...pebs, ...sides.map((x) => x.stone), ...sides.map((x) => x.col), ...sides.map((x) => x.text), live, badge)
  // on a narrow screen only the side just turned speaks, across the whole width
  let focus: 0 | 1 = 1
  ctx.art.append(root)
  ctx.prompt(X.prompt)

  let changes = 0
  let shown = false
  let geo = { W: 0, H: 0, ax: 0, bx: 0, sy: 0, S: 60, py: 0, peb: 30, wide: true, short: false }

  function layout() {
    const W = root.clientWidth
    const H = root.clientHeight
    if (!W || !H) return
    const wide = W / H > 1.1
    // a short landscape phone: the two columns of words move beside the ripples
    const short = wide && H < 340
    root.classList.toggle('wide', wide)
    root.classList.toggle('short', short)
    const S = Math.round(short ? clamp(H * 0.19, 32, 50) : wide ? clamp(Math.min(W * 0.065, H * 0.15), 44, 80) : clamp(Math.min(W * 0.16, H * 0.095), 40, 62))
    const d = short ? W * 0.25 : wide ? Math.min(W * 0.34, 520) : W * 0.46
    const ax = W / 2 - d / 2
    const bx = W / 2 + d / 2
    const sy = short ? H * 0.2 : wide ? H * 0.25 + S * 0.3 : H * 0.12 + S * 0.6
    const peb = short ? 26 : wide ? 32 : 28
    const py = sy + S * (short ? 0.62 : 0.75)
    geo = { W, H, ax, bx, sy, S, py, peb, wide, short }
    for (const v of [back, sandL, svg]) {
      v.replaceChildren()
      v.setAttribute('viewBox', `0 0 ${W} ${H}`)
    }
    const id = defs(back)
    const k = 0.36
    const outer = d * 0.74
    const n = wide ? 7 : 5
    const gap = (outer - S * 0.95) / n
    back.append(s('ellipse', { cx: W / 2, cy: sy + S * 0.6, rx: W * 0.55, ry: H * 0.45, fill: `url(#${id.warm})` }))
    sandL.append(sand(W, H, [{ x: ax, y: sy + S * 0.45, r0: S * 0.95, n }, { x: bx, y: sy + S * 0.45, r0: S * 0.95, n }], { top: Math.max(0, sy - S * 1.4), gap, k, fade: S, keep: true }))
    // the meeting of the two ripples: a faint wash where both reach
    back.append(s('ellipse', { class: 't17x-meet', cx: W / 2, cy: sy + S * 0.45, rx: outer - d / 2, ry: (outer - d / 2) * k * 1.6, filter: 'url(#ink-wash)' }))
    sides.forEach((x, i) => {
      const cx = i ? bx : ax
      Object.assign(x.stone.style, { left: `${cx}px`, top: `${sy}px` })
      x.stone.style.setProperty('--sz', `${S}px`)
      x.stone.querySelector<HTMLElement>('.logo-stone')?.style.setProperty('--ls-size', `${S}px`)
      const cw = short ? W * 0.23 : wide ? Math.min(d * 0.8, W * 0.36) : W / 2 - 6
      const left = short ? (i ? W - cw : 0) : wide ? cx - cw / 2 : i ? W / 2 + 3 : 3
      Object.assign(x.col.style, { left: `${left}px`, width: `${cw}px` })
    })
    Object.assign(both.style, { left: `${W / 2}px`, top: `${py - 22}px` })
    place()
  }

  /** where each kind of work goes, then the columns of text under the pebbles */
  function place() {
    const [a, b] = idx.map((i) => COMPANIES[i])
    const { W, ax, bx, py, peb, wide, d } = { ...geo, d: geo.bx - geo.ax }
    const zoneOf = (k: Category): Zone => {
      const x = a.categories.includes(k)
      const y = b.categories.includes(k)
      return x && y ? 'both' : x ? 'a' : y ? 'b' : 'none'
    }
    const cols: Record<Zone, number> = { a: ax - d * 0.36, both: W / 2, b: bx + d * 0.36, none: W / 2 }
    const count: Record<Zone, number> = { a: 0, both: 0, b: 0, none: 0 }
    const zones = CATS.map(zoneOf)
    let deepest = py
    zones.forEach((z, i) => {
      if (z === 'none') return
      const y = py + count[z]++ * (peb + (geo.short ? 2 : 6))
      deepest = Math.max(deepest, y + peb)
      const hw = (pebs[i].offsetWidth || 70) / 2 + 2
      Object.assign(pebs[i].style, { left: `${clamp(cols[z], hw, W - hw)}px`, top: `${y}px` })
    })
    // what neither does sinks into the sand under the middle, faint; it shows only once a stone has been turned
    const told = changes > 0
    const n0 = deepest + (geo.short ? 20 : 26)
    const nn = told ? zones.filter((z) => z === 'none').length : 0
    Object.assign(none.style, { left: `${W / 2}px`, top: `${n0 - 18}px` })
    zones.forEach((z, i) => {
      if (z !== 'none') return
      const j = count.none++
      const row = !wide || geo.short
      const x = row ? W / 2 + (j - (nn - 1) / 2) * Math.min(86, (W - 20) / Math.max(1, nn)) : W / 2
      const y = row ? n0 : n0 + j * (peb - 4)
      Object.assign(pebs[i].style, { left: `${x}px`, top: `${told ? y : deepest - peb}px` })
    })
    pebs.forEach((p, i) => (p.dataset.zone = zones[i]))
    both.classList.toggle('on', count.both > 0)
    none.classList.toggle('on', nn > 0)
    const textTop = geo.short ? 0 : wide ? deepest + 14 : (nn ? n0 + peb : Math.max(deepest, py + peb * 2)) + 12
    sides.forEach((x, k) => {
      x.col.style.top = `${textTop}px`
      const head = x.col.offsetHeight + 2
      if (wide) Object.assign(x.text.style, { top: `${textTop + head}px`, left: x.col.style.left, width: x.col.style.width })
      else Object.assign(x.text.style, { top: `${textTop + head}px`, left: '3px', width: `${W - 6}px` })
      x.text.classList.toggle('mute', !wide && k !== focus)
    })
    live.textContent = [
      count.both ? `${X.shared}: ${zones.flatMap((z, i) => (z === 'both' ? [C.cats[CATS[i]]] : [])).join(', ')}` : '',
      ...[a, b].map((c, j) => {
        const only = zones.flatMap((z, i) => (z === (j ? 'b' : 'a') ? [C.cats[CATS[i]]] : []))
        return only.length ? `${fill(X.only, { name: c.name })}: ${only.join(', ')}` : ''
      }),
    ].filter(Boolean).join('. ')
  }

  function fillSide(k: 0 | 1, animate: boolean) {
    const c: Company = COMPANIES[idx[k]]
    const x = sides[k]
    const swap = () => {
      x.stone.replaceChildren(logoStone(c.id, { size: geo.S, decorative: true }))
      x.stone.setAttribute('aria-label', `${fill(X.stone, { name: c.name })} (${fill(X.side[k], { name: c.name })})`)
      x.name.textContent = c.name
      const m = motto(c)
      const f = fitOf(c)
      const wl = c.weights === 'closed' || c.weights === 'mixed' ? C.weights[c.weights] : ''
      x.text.replaceChildren(
        m ? ctx.fact(m, 'p', 't17x-motto') : h('p', { class: 't17x-motto' }),
        h('p', { class: 't17x-w' }, [C.countries[c.country ?? 'none'] ?? '', wl].filter(Boolean).join(' · ')),
        h('div', { class: 't17x-fit' }, f ? h('p', { class: 't17c-k' }, C.card.fit) : null, f ? ctx.fact(f, 'p', 't17x-fit-t') : null))
      x.prev.setAttribute('aria-label', `${X.prev} (${fill(X.side[k], { name: c.name })})`)
      x.next.setAttribute('aria-label', `${X.next} (${fill(X.side[k], { name: c.name })})`)
      // a longer name can take two lines: the words below follow it
      if (geo.W) place()
    }
    if (!animate || ctx.reduced) {
      swap()
      return
    }
    ctx.anim(() => {
      gsap.timeline()
        .to([x.stone, x.text, x.name], { opacity: 0, y: 6, filter: 'blur(4px)', duration: 0.3, ease: 'power2.in' })
        .add(swap)
        .to([x.stone, x.text, x.name], { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.7, ease: 'power3.out', stagger: 0.06 })
    })
  }

  function turn(k: 0 | 1, dir: number) {
    const n = COMPANIES.length
    let i = idx[k]
    do i = (i + dir + n) % n
    while (i === idx[1 - k])
    idx[k] = i
    focus = k
    changes++
    // the words about each company arrive with the first turn
    root.classList.add('told')
    fillSide(k, true)
    place()
    if (!ctx.reduced) ripple(k)
    ctx.chime('soft')
    if (changes >= 2 && !shown) {
      shown = true
      ctx.insight(X.insight, X.note)
    }
  }

  function ripple(k: 0 | 1) {
    const cx = k ? geo.bx : geo.ax
    const cy = geo.sy + geo.S * 0.45
    const rs = [0, 1].map(() => s('ellipse', { class: 't17x-rip', cx, cy, rx: geo.S, ry: geo.S * 0.36 }))
    svg.append(...rs)
    ctx.anim(() => gsap.fromTo(rs, { attr: { rx: geo.S * 0.9, ry: geo.S * 0.32 }, opacity: 0.8 }, { attr: { rx: geo.S * 3.4, ry: geo.S * 1.22 }, opacity: 0, duration: 2.2, stagger: 0.35, ease: 'power2.out', onComplete: () => rs.forEach((r) => r.remove()) }))
  }

  fillSide(0, false)
  fillSide(1, false)
  let raf = 0
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(layout)
  })
  ro.observe(root)
  layout()
  if (!ctx.reduced) {
    gsap.from(sides.map((x) => x.stone), { opacity: 0, y: 14, duration: 1.2, stagger: 0.15, ease: 'power3.out', delay: 0.25, clearProps: 'opacity,transform' })
  }
  return () => {
    ro.disconnect()
    cancelAnimationFrame(raf)
  }
}
