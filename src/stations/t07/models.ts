import { fill, h, nextId, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { Fact } from '../../core/content'
import { company, logoStone } from '../../ui/logo'
import type { SceneCtx } from '../types'
import { ell, onSize, rng, stableHeight, type Pt } from './ink'
import { C } from './data'

const M = C.scenes.models
const TECH = __LOCALE__ === 'en' ? 'Technical name: ' : 'Tên kỹ thuật: '

/** Scene 4 — seven stones on raked sand; touch one and its card opens on the clean sand in the middle. */
export function modelsScene(ctx: SceneCtx) {
  const entries = M.models.map((m) => {
    const co = company(m.company)
    const models = (co?.models ?? []).filter((x) => m.names.includes(x.name))
    return { ...m, co, models }
  })

  // "what do you need?" — revealed after the first stone, so the scene opens with the garden only
  const needBtns = M.needs.map((n) =>
    h('button', { class: 't7m-need', type: 'button', 'aria-pressed': 'false', 'aria-label': n.name, onClick: () => need(n.id) },
      h('span', { class: 'full', 'aria-hidden': 'true' }, n.name), h('span', { class: 'brief', 'aria-hidden': 'true' }, n.short)))
  const needs = h('div', { class: 't7m-needs', role: 'group', 'aria-label': M.needsLabel, inert: '' },
    h('span', { class: 't7m-nlab', 'aria-hidden': 'true' }, M.needsLabel), ...needBtns, h('span', { class: 't7m-asof' }, M.asOf))

  const sand = s('svg', { class: 't7m-sand', 'aria-hidden': 'true' })
  const stones = entries.map((e, i) =>
    h('button', { class: 't7m-stone', type: 'button', 'aria-pressed': 'false', 'aria-label': fill(M.pickModel, { name: `${e.label}, ${fill(M.by, { company: e.co?.name ?? '' })}` }), onClick: () => pick(i) },
      h('span', { class: 't7m-rip', 'aria-hidden': 'true' }, h('i'), h('i')),
      logoStone(e.company, { size: 56, decorative: true, float: !ctx.reduced }),
      h('span', { class: 't7m-lab', 'aria-hidden': 'true' }, e.label)))
  const card = h('div', { class: 't7m-card', 'aria-live': 'polite' })
  const garden = h('div', { class: 't7m-garden', role: 'group', 'aria-label': M.gardenLabel }, sand, card, ...stones)
  const root = h('div', { class: 't7 t7m' }, needs, garden)
  ctx.art.append(root)
  ctx.prompt(M.prompt)
  stones[0].classList.add('next')

  const seen = new Set<number>()

  function cardKids(i: number): HTMLElement[] {
    const e = entries[i]
    const strengths: Fact = e.models.find((m) => m.strengths)?.strengths ?? M.newModel
    const noted = e.models.filter((m) => m.note)
    // two names from one family share one line: "Tên kỹ thuật: A · B"
    const note: Fact | null = !noted.length
      ? null
      : {
        text: noted.every((m) => m.note!.startsWith(TECH)) ? TECH + noted.map((m) => m.note!.slice(TECH.length)).join(' · ') : noted.map((m) => m.note).join(' · '),
        asOf: noted[0].asOf, source: noted[0].source, verify: noted.some((m) => m.verify),
      }
    const fits = M.needs.filter((n) => n.models.includes(e.id)).map((n) => n.name)
    return [
      h('p', { class: 't7m-name' }, e.label),
      h('p', { class: 't7m-by' }, fill(M.by, { company: e.co?.name ?? e.company }), h('span', { class: 't7m-byasof' }, ` · ${M.asOf}`)),
      ctx.fact(strengths, 'p', 't7m-str'),
      note ? ctx.fact(note, 'p', 't7m-note') : null,
      fits.length ? h('p', { class: 't7m-fit' }, h('span', { 'aria-hidden': 'true' }), fits.join(' · ')) : null,
    ].filter((x): x is HTMLElement => !!x)
  }

  function need(id: string) {
    const n = M.needs.find((x) => x.id === id)!
    needBtns.forEach((b, j) => b.setAttribute('aria-pressed', String(M.needs[j].id === id)))
    const i = entries.findIndex((e) => n.models.includes(e.id))
    if (i >= 0) pick(i, true)
  }

  function pick(i: number, fromNeed = false) {
    // a stone picked directly lights the need it suits (the reverse lookup)
    if (!fromNeed) needBtns.forEach((b, j) => b.setAttribute('aria-pressed', String(M.needs[j].models.includes(entries[i].id))))
    const first = seen.size === 0
    seen.add(i)
    stones.forEach((b, j) => {
      b.setAttribute('aria-pressed', String(j === i))
      b.classList.toggle('seen', seen.has(j))
      b.classList.remove('next')
    })
    card.replaceChildren(...cardKids(i))
    card.classList.add('on')
    if (first) {
      needs.removeAttribute('inert')
      needs.classList.add('on')
      if (ctx.reduced) clear?.setAttribute('opacity', '1')
    }
    ctx.anim(() => {
      if (ctx.reduced) return
      gsap.fromTo(card.children, { opacity: 0, y: 8, filter: 'blur(4px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.8, stagger: 0.07, ease: 'power3.out' })
      gsap.fromTo(stones[i].querySelectorAll('.t7m-rip i'), { scale: 0.6, opacity: 0.8 }, { scale: 2.1, opacity: 0, duration: 1.8, stagger: 0.35, ease: 'power2.out' })
      if (first && clear) gsap.to(clear, { attr: { opacity: 1 }, duration: 1.4, ease: 'power2.inOut' })
      if (first) gsap.fromTo(needs.children, { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: 0.9, stagger: 0.06, delay: 0.4, ease: 'power3.out' })
    })
    ctx.chime('soft')
    if (seen.size === 3) ctx.insight(M.insight, M.detail)
  }

  // arrows walk around the stones
  garden.addEventListener('keydown', (ev) => {
    const k = stones.indexOf(document.activeElement as HTMLButtonElement)
    if (k < 0) return
    const d = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 0
    if (!d) return
    ev.preventDefault()
    stones[(k + d + stones.length) % stones.length].focus()
  })

  /** The tallest card at this width (every model, in the current layout's type sizes). */
  function cardHeight(width: number) {
    const probe = h('div', { class: 't7m-card on', 'aria-hidden': 'true', style: `position:absolute;left:0;top:0;width:${width}px;visibility:hidden;pointer-events:none` })
    garden.append(probe)
    let max = 0
    for (let i = 0; i < entries.length; i++) {
      probe.replaceChildren(...cardKids(i))
      max = Math.max(max, probe.offsetHeight)
    }
    probe.remove()
    return max
  }

  let clear: SVGPathElement | null = null
  const ids = { mask: nextId('t7mm'), mist: nextId('t7mg'), fade: nextId('t7mf'), soft: nextId('t7ms') }
  /** Raked sand: rings around the clean middle (or straight rows), two rings hugging each stone, mist and moss. */
  function rake(gw: number, gh: number, pos: Pt[], size: number, ringMode: boolean, box: { x: number; y: number; w: number; h: number }) {
    // the sand also runs under the (still empty) row of needs above the garden
    const up = garden.offsetTop
    const y0 = -up
    const fh = gh + up
    sand.style.top = `${y0}px`
    sand.style.height = `${fh}px`
    sand.setAttribute('viewBox', `0 ${y0} ${gw} ${fh}`)
    const r = rng(41)
    const sr = (k: number) => [size * 0.82 + k * 6, size * 0.5 + k * 4.4]
    const wobble = (cx: number, cy: number, a: number, b: number, k: number) => {
      const pts: string[] = []
      for (let i = 0; i <= 72; i++) {
        const t = (i / 72) * Math.PI * 2
        const w = 1 + Math.sin(t * 3 + k) * 0.004 + Math.sin(t * 7 + k * 2) * 0.002
        pts.push(`${(cx + Math.cos(t) * a * w).toFixed(1)} ${(cy + Math.sin(t) * b * w).toFixed(1)}`)
      }
      return `M${pts.join('L')}Z`
    }
    const grooves = s('g', { mask: `url(#${ids.mask})` })
    const add = (g: SVGGElement, d: string) => g.append(s('path', { d, class: 't7-rk' }), s('path', { d, class: 't7-rk-hi', transform: 'translate(0 1.3)' }))
    if (ringMode) {
      const cx = box.x + box.w / 2
      const cy = box.y + box.h / 2
      const a0 = box.w / 2 + 14
      const b0 = box.h / 2 + 12
      const max = Math.hypot(gw, gh) * 0.6
      for (let k = 0, a = a0; a < max; k++, a += 6.5) add(grooves, wobble(cx, cy, a, b0 * (a / a0) ** 0.92, k))
    } else {
      for (let y = y0 + 3, k = 0; y < gh; y += 6, k++) {
        const pts: string[] = []
        for (let x = -10; x <= gw + 20; x += 20) pts.push(`${x} ${(y + 0.9 * Math.sin(x / 37 + k * 0.9)).toFixed(1)}`)
        add(grooves, `M${pts.join('L')}`)
      }
    }
    const rings = s('g', { mask: `url(#${ids.soft})` })
    for (const [x, y] of pos) for (let k = 1; k <= 2; k++) add(rings, wobble(x, y + size * 0.08, sr(k)[0], sr(k)[1], k + x))
    // moss tufts at the foot of two stones; a faint mist drifting across the sand
    const moss = s('g', { class: 't7-st-moss', filter: 'url(#ink-rough)' })
    for (const i of [1, 4]) {
      const [x, y] = pos[i] ?? [0, 0]
      for (let k = 0; k < 16; k++) {
        const a = Math.PI * (0.58 + r() * 0.42)
        const f = 0.62 + r() * 0.26
        moss.append(s('path', { d: ell(x + Math.cos(a) * size * f * 1.05, y + size * 0.3 + Math.sin(a) * size * 0.14 + r() * 3, 1.4 + r() * 2.6, 1 + r() * 1.6), 'fill-opacity': (0.45 + r() * 0.45).toFixed(2) }))
      }
    }
    sand.replaceChildren(
      s('defs', null,
        s('radialGradient', { id: ids.mist, cx: 0.5, cy: 0.5, r: 0.5 }, s('stop', { offset: 0, class: 't7m-mist0' }), s('stop', { offset: 1, class: 't7m-mist1' })),
        s('radialGradient', { id: ids.fade, cx: 0.5, cy: 0.5, r: 0.5 }, s('stop', { offset: 0.7, 'stop-color': '#fff' }), s('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 })),
        s('mask', { id: ids.soft, maskUnits: 'userSpaceOnUse', x: 0, y: y0, width: gw, height: fh }, s('rect', { y: y0, width: gw, height: fh, fill: `url(#${ids.fade})` })),
        s('mask', { id: ids.mask, maskUnits: 'userSpaceOnUse', x: 0, y: y0, width: gw, height: fh },
          s('rect', { y: y0, width: gw, height: fh, fill: `url(#${ids.fade})` }),
          // the sand under the card is smoothed clean once a card opens; each stone sits in its own rings
          clear = s('path', { opacity: card.classList.contains('on') ? 1 : 0, d: ringMode ? ell(box.x + box.w / 2, box.y + box.h / 2, box.w / 2 + 10, box.h / 2 + 8) : `M${box.x - 6} ${box.y - 4}h${box.w + 12}v${box.h + 8}h${-box.w - 12}Z`, fill: '#000', filter: 'url(#ink-wash)' }),
          ...pos.map(([x, y]) => s('path', { d: ell(x, y + size * 0.08, sr(2)[0] + 3, sr(2)[1] + 3), fill: '#000' })))),
      s('ellipse', { cx: gw / 2, cy: (gh + y0) / 2, rx: gw * 0.6, ry: fh * 0.6, fill: `url(#${ids.mist})` }),
      grooves, rings, moss)
  }

  const stable = stableHeight(ctx, [M.insight])
  function layout() {
    const W = ctx.art.clientWidth
    const H = stable(ctx.art.clientHeight)
    if (!W || !H) return
    root.style.height = `${H}px`
    const tight = W < 600
    root.classList.toggle('tight', tight)
    root.classList.toggle('short', !tight && H < 330)
    const gw = garden.clientWidth
    const gh = garden.clientHeight
    if (!gw || !gh) return
    const pos: Pt[] = []
    let size: number
    let bw: number
    let bh: number
    let box: { x: number; y: number; w: number; h: number }
    let ring = false
    if (tight) {
      // phone: four stones over three, staggered like stepping stones; the card below
      size = 44
      bw = Math.min(gw / 4 - 2, 96)
      // room for a two-line name under each stone before the next row's rings begin
      bh = size + 34
      const gap = gh > 420 ? 14 : 4
      for (let i = 0; i < 4; i++) pos.push([gw * (0.125 + i * 0.25), size / 2 + 4 + (i % 2 ? 3 : 0)])
      for (let i = 0; i < 3; i++) pos.push([gw * (0.25 + i * 0.25), size / 2 + bh + 2 + gap + (i % 2 ? 0 : 2)])
      const top = bh * 2 + 6 + gap * 2
      box = { x: 0, y: top, w: gw, h: gh - top }
    } else {
      size = Math.max(44, Math.min(68, gh * 0.125, gw * 0.1))
      bw = Math.max(size * 1.28, 96)
      // one row of seven (smaller stones) when the garden is too low for two
      const line = gh < 2 * (size + 40) + 70 && gw > 7 * bw
      root.classList.toggle('line', line)
      if (line) size = 36
      bh = size + (line ? 30 : 40)
      // a stone's centre is its logo; its name hangs below, so the ring sits a little high
      const cy = (gh - bh + size) / 2
      // big screens keep the ring compact, like a garden seen at arm's length
      const ry = Math.min((gh - bh) / 2 - 6, 300)
      const rx = Math.min(gw / 2 - bw / 2 - 4, ry * 1.75, 500)
      const cw = Math.min(360, 2 * (rx - bw * 0.62))
      const ch = 2 * (ry - bh * 0.62)
      ring = !line && cw >= 230 && ch >= cardHeight(cw) + 8
      if (ring) {
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI / 2 + (i / 7) * Math.PI * 2
          pos.push([gw / 2 + Math.cos(a) * rx, cy + Math.sin(a) * ry])
        }
        box = { x: gw / 2 - cw / 2, y: cy - ch / 2, w: cw, h: ch }
      } else if (line) {
        const step = gw / 7
        for (let i = 0; i < 7; i++) pos.push([step * (i + 0.5), size / 2 + 4 + (i % 2 ? 3 : 0)])
        const top = bh + 10
        box = { x: 0, y: top, w: gw, h: gh - top }
      } else {
        const step = Math.min(bw + 8, gw / 4)
        for (let i = 0; i < 4; i++) pos.push([gw / 2 + (i - 1.5) * step, size / 2 + 6])
        for (let i = 0; i < 3; i++) pos.push([gw / 2 + (i - 1) * step, size / 2 + bh + 10])
        const top = bh * 2 + 16
        box = { x: 0, y: top, w: gw, h: gh - top }
      }
    }
    root.classList.toggle('ring', ring)
    root.style.setProperty('--ls', `${size}px`)
    stones.forEach((b) => b.querySelector<HTMLElement>('.logo-stone')?.style.setProperty('--ls-size', `${size}px`))
    Object.assign(card.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px` })
    // never let the card run past the garden: drop the small technical note first
    root.classList.remove('cramped')
    if (!ring && cardHeight(box.w) > box.h) root.classList.add('cramped')
    stones.forEach((b, i) => Object.assign(b.style, { left: `${pos[i][0] - bw / 2}px`, top: `${pos[i][1] - size / 2}px`, width: `${bw}px`, height: `${bh}px` }))
    rake(gw, gh, pos, size, ring, box)
  }
  onSize(ctx, garden, layout)
}
