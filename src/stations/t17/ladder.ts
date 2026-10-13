import { fill, h, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import { L as UI } from '../../core/content'
import { company, logoStone, type Company, type Model } from '../../ui/logo'
import type { SceneCtx } from '../types'
import { C, ladderOf, modelFact, scaleOf } from './data'
import { brush, clamp, defs, hash, pebble, sand, vf } from './ink'

const L = C.scenes.ladder
const VF = UI.kinds.verify

interface Rock {
  g: SVGGElement
  ring: SVGEllipseElement
  btn: HTMLButtonElement
  tier: Model[]
  x: number
  base: number
  rx: number
  ry: number
}

/** Scene 3 — a company's models as a cairn: the big heavy stone at the bottom, the small quick one on top. */
export function ladderScene(ctx: SceneCtx) {
  const sandL = s('svg', { class: 't17-sandsvg', 'aria-hidden': 'true' })
  const svg = s('svg', { class: 't17l-svg', 'aria-hidden': 'true' })
  const stack = s('g')
  const mist = h('div', { class: 't17-mist', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'))
  const picks = L.companies.map((l, i) => {
    const c = company(l.id)!
    return h('button', { class: 't17l-pick ls-host', type: 'button', 'aria-pressed': 'false', onClick: () => pick(i) },
      logoStone(c.id, { size: 40, decorative: true, float: false }), h('span', null, c.name))
  })
  const bar = h('div', { class: 't17l-picks', role: 'group', 'aria-label': L.group }, ...picks)
  const scale = [0, 1, 2].map(() => h('p', { class: 't17l-scale', 'aria-hidden': 'true' }))
  const hits = h('div', { class: 't17l-hits' })
  const say = h('div', { class: 't17l-say', 'aria-live': 'polite' })
  // a company whose tiers the brief does not state says so, beside its cairn
  const aside = h('div', { class: 't17l-aside' })
  const legend = h('p', { class: 't17-legend t17l-legend', 'aria-hidden': 'true' }, h('span', { class: 't17-vf' }), VF)
  const root = h('div', { class: 't17 t17l', role: 'group', 'aria-label': L.region }, sandL, svg, mist, hits, ...scale, aside, bar, say, legend)
  ctx.art.append(root)
  ctx.prompt(L.prompt)

  let cur = -1
  let rocks: Rock[] = []
  const seen = new Set<number>()
  const touched = new Set<string>()
  let geo = { W: 0, H: 0, wide: true, cx: 0, base: 0, R: 0, top: 0 }
  let scaleLine: SVGPathElement | null = null
  let ids = { stone: '', dry: '' }
  let shown = false
  let tallK = 0.42
  let sel: string | null = null

  function layout() {
    const W = root.clientWidth
    const H = root.clientHeight
    if (!W || !H) return
    const wide = W / H > 1.1
    root.classList.toggle('wide', wide)
    const top = bar.offsetHeight + (wide ? 20 : 14)
    // the tallest cairn (four stones) must fit between the picks and the sand's edge
    const R = wide ? clamp(Math.min(W * 0.11, (H - top - 30) / 2.8), 40, 132) : clamp(Math.min(W * 0.17, (H - top - 120) / 3.3), 34, 70)
    // narrow screens: the scale words hug the left edge (measured, so none spills out), names to the right
    const sw0 = Math.max(...scale.map((el) => el.offsetWidth), 56)
    const cx = wide ? W * 0.34 : sw0 + 30 + R * 1.25
    const base = wide ? H - 18 - R * 0.12 : top + (H - top) * 0.84
    tallK = wide ? 0.42 : 0.5
    geo = { W, H, wide, cx, base, R, top }
    for (const v of [svg, sandL]) {
      v.replaceChildren()
      v.setAttribute('viewBox', `0 0 ${W} ${H}`)
    }
    const id = defs(svg)
    ids = id
    svg.append(s('ellipse', { cx, cy: base - R * 0.6, rx: W * 0.5, ry: H * 0.55, fill: `url(#${id.warm})` }))
    sandL.append(sand(W, H, [{ x: cx, y: base - R * 0.05, r0: R * 1.25, n: wide ? 5 : 4 }], { top: top + (H - top) * 0.25, gap: wide ? 9 : 7, k: 0.3, fade: H * 0.2 }))
    scaleLine = s('path', { class: 'k t17l-line', filter: 'url(#ink-rough)' })
    svg.append(scaleLine, stack)
    const sw = Math.min(340, W * 0.3)
    Object.assign(say.style, wide
      ? { left: `${Math.min(W - sw, Math.max(W * 0.66, cx + R * 1.1 + 220))}px`, top: `${Math.max(top + 8, Math.min(base - R * 2.5, H - 170))}px`, width: `${sw}px` }
      : { left: '0px', top: `${top}px`, width: `${W}px` })
    if (cur >= 0) build(cur, false)
  }

  /** stack the current company's tiers; animate = drop them in one by one */
  function build(i: number, animate: boolean) {
    const c: Company = company(L.companies[i].id)!
    const tiers = ladderOf(c)
    const n = tiers.length
    const { cx, base, R, W } = geo
    const old = rocks
    rocks = []
    let y = base
    const fresh = s('g')
    const labX = cx + R * 1.08 + (geo.wide ? 14 : 8)
    let prevLy = Infinity
    let prevLh = 0
    tiers.forEach((tier, k) => {
      const rx = R * (1 - (0.46 * k) / Math.max(1, n - 1))
      const ry = rx * tallK
      const x = cx + (k % 2 ? 1 : -1) * rx * 0.06 * (k ? 1 : 0)
      const g = s('g', { class: 't17l-rock' })
      const ring = s('ellipse', { class: 't17l-sel', cx: x, cy: y - ry, rx: rx * 1.12, ry: ry * 1.35, opacity: 0 })
      g.append(pebble(x, y, rx, ry, hash(tier[0].name), ids, { moss: k === 0 }), ring)
      // the names keep a touch target apart even where the top stones are thin; their leaders bend to reach them
      const lh = 24 + 16 * (tier.length - 1)
      const ly = Math.min(y - ry, prevLy - Math.max(40, (prevLh + lh) / 2 + 6))
      prevLy = ly
      prevLh = lh
      g.append(s('path', { class: 't17-lead', d: `M${(x + rx + 5).toFixed(1)} ${(y - ry).toFixed(1)}L${(labX - 30).toFixed(1)} ${ly.toFixed(1)}H${(labX - 6).toFixed(1)}` }))
      fresh.append(g)
      const m = tier[0]
      const v = tier.some((t) => t.verify)
      const btn = h('button', { class: 't17l-hit', type: 'button', 'aria-label': fill(L.stone, { name: tier.map((t) => t.name).join(', ') }) + (v ? ` (${VF})` : ''), onClick: () => tap(rock) },
        h('span', { class: 't17l-name' }, h('span', null, m.name, m.verify ? vf(VF) : null), ...tier.slice(1).map((t) => h('span', { class: 't17l-name2' }, t.name, t.verify ? vf(VF) : null))))
      const t0 = Math.min(y - ry * 2, ly - 22)
      const t1 = Math.max(y, ly + 22)
      Object.assign(btn.style, { left: `${x - rx}px`, top: `${t0}px`, height: `${t1 - t0}px`, width: `${Math.min(W - (x - rx) - 4, labX - (x - rx) + 200)}px` })
      btn.style.setProperty('--lx', `${labX - (x - rx)}px`)
      btn.style.setProperty('--nw', `${Math.max(90, W - labX - 4)}px`)
      btn.style.setProperty('--ly', `${ly - t0}px`)
      const rock: Rock = { g, ring, btn, tier, x, base: y, rx, ry }
      rocks.push(rock)
      y -= ry * 2 * 0.86
    })
    stack.append(fresh)
    hits.replaceChildren(...rocks.map((r) => r.btn))
    // a re-layout keeps the stone that was picked
    for (const r of rocks)
      if (r.tier[0].name === sel) {
        r.btn.classList.add('on')
        r.ring.setAttribute('opacity', '1')
      }
    // the scale beside the cairn: heavy at the foot, thin at the top
    const sx = cx - R * 1.25 - 16
    const topY = y + rocks[rocks.length - 1].ry * 0.6
    scaleLine?.setAttribute('d', brush([[sx, base], [sx + 0.5, (base + topY) / 2], [sx, topY]], Math.max(3, R * 0.07), { a: 0.02, b: 0.5, min: 0.12 }))
    const ys = [topY, (base + topY) / 2 - R * 0.1, base - rocks[0].ry]
    // the scale's words for this company (two stones have no middle: only the ends are named)
    const words = scaleOf(c.id)
    const at = words.length < 3 || n < 3 ? [words[0], '', words[words.length - 1]] : words
    scale.forEach((el, k) => {
      el.textContent = at[k]
      Object.assign(el.style, { left: `${sx - 10}px`, top: `${ys[k]}px`, visibility: at[k] ? '' : 'hidden' })
    })
    const note = L.companies[i].note
    aside.replaceChildren(...(note ? [ctx.fact(note, 'p', 't17l-aside-t')] : []))
    Object.assign(aside.style, geo.wide ? { left: say.style.left, top: 'auto', bottom: '2px', width: say.style.width } : { left: '0px', top: `${base + R * 0.2}px`, bottom: 'auto', width: `${W}px` })
    legend.classList.toggle('on', tiers.flat().some((t) => t.verify))

    if (!animate || ctx.reduced) {
      old[0]?.g.parentElement?.remove()
      return
    }
    ctx.anim(() => {
      if (old.length) {
        const og = old[0].g.parentNode as SVGGElement
        gsap.to(old.map((r) => r.g).reverse(), { y: -24, opacity: 0, duration: 0.45, stagger: 0.07, ease: 'power2.in', onComplete: () => void og.remove() })
      }
      const tl = gsap.timeline({ delay: old.length ? 0.35 : 0.2 })
      rocks.forEach((r, k) => {
        const t = k * 0.42
        tl.fromTo(r.g, { y: -geo.H * 0.55, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, ease: 'power2.in' }, t)
          .to(r.g, { y: -3, duration: 0.1, ease: 'power1.out' }, t + 0.55)
          .to(r.g, { y: 0, duration: 0.18, ease: 'power1.in' }, t + 0.65)
          .fromTo(r.btn.querySelector('.t17l-name'), { opacity: 0, x: -6 }, { opacity: 1, x: 0, duration: 0.6, ease: 'power3.out' }, t + 0.5)
        if (k === 0) tl.add(() => thud(r), t + 0.55)
      })
    })
  }

  /** the first stone lands: one ring spreads through the sand */
  function thud(r: Rock) {
    const e = s('ellipse', { class: 't17l-thud', cx: r.x, cy: r.base - r.ry * 0.1, rx: r.rx, ry: r.rx * 0.3 })
    svg.insertBefore(e, stack)
    ctx.anim(() => gsap.fromTo(e, { attr: { rx: r.rx, ry: r.rx * 0.3 }, opacity: 0.7 }, { attr: { rx: r.rx * 2.6, ry: r.rx * 0.78 }, opacity: 0, duration: 1.8, ease: 'power2.out', onComplete: () => e.remove() }))
    ctx.chime('tap')
  }

  function pick(i: number) {
    if (i === cur) return
    cur = i
    sel = null
    picks.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)))
    say.replaceChildren()
    build(i, true)
    seen.add(i)
    check()
  }

  function tap(r: Rock) {
    sel = r.tier[0].name
    rocks.forEach((q) => {
      q.btn.classList.toggle('on', q === r)
      ctx.anim(() => (ctx.reduced ? gsap.set(q.ring, { opacity: q === r ? 1 : 0 }) : gsap.to(q.ring, { opacity: q === r ? 1 : 0, duration: 0.6 })))
    })
    if (!ctx.reduced) ctx.anim(() => gsap.fromTo(r.g, { y: 0 }, { y: -5, duration: 0.25, yoyo: true, repeat: 1, ease: 'power1.out' }))
    say.replaceChildren(...r.tier.map((m) => ctx.fact(modelFact(m), 'p', 't17l-say-t')))
    if (!ctx.reduced) ctx.anim(() => gsap.fromTo(say.children, { opacity: 0, y: 6, filter: 'blur(4px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.9, stagger: 0.12, ease: 'power3.out' }))
    touched.add(r.tier[0].name)
    ctx.chime('soft')
    check()
  }

  function check() {
    if (shown || !(seen.size >= 2 || touched.size >= 2)) return
    shown = true
    ctx.insight(L.insight, L.detail)
  }

  let raf = 0
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(layout)
  })
  ro.observe(root)
  layout()
  pick(0)
  seen.clear()
  if (!ctx.reduced) gsap.from(picks, { opacity: 0, y: -8, duration: 1, stagger: 0.08, ease: 'power3.out', delay: 0.2, clearProps: 'opacity,transform' })
  return () => {
    ro.disconnect()
    cancelAnimationFrame(raf)
  }
}
