import { fill, h, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { craneD, landscape, SH, SW } from './demos'
import { arc, brush, C, clamp, ell, loop, path, pebble, rng, stableHeight, watchSize, type Pt } from './kit'

const S = C.scenes.sora as typeof C.scenes.sora & { month: string; dateFmt: string }
// day index in 2026 (0 = 1 January)
const MONTH0 = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273]
const dayOf = (iso: string) => {
  const [, m, d] = iso.split('-').map(Number)
  return MONTH0[m - 1] + d - 1
}
const END = dayOf('2026-10-12')
const E1 = dayOf(S.events[0].day)
const E2 = dayOf(S.events[1].day)
const LANTERNS = 5

/** Scene 5 — story card: the Sora screen goes dark (app), then its lanterns (API); then why, and the lesson. */
export function soraScene(ctx: SceneCtx) {
  const root = h('div', { class: 't08 t08s' })
  const svg = s('svg', { class: 't08s-svg', role: 'img', 'aria-label': S.art })
  const story = h('div', { class: 't08s-story', 'aria-live': 'polite' })
  const range = h('input', { class: 'range t08s-range', type: 'range', min: 0, max: END, step: 1, value: 0, 'aria-label': S.slider }) as HTMLInputElement
  const bubble = h('span', { class: 't08s-date', 'aria-hidden': 'true' })
  const months = h('div', { class: 't08s-months', 'aria-hidden': 'true' })
  root.append(svg, story, months, range, bubble)
  ctx.art.append(root)
  ctx.prompt(S.prompt)
  const stable = stableHeight(ctx, [[S.insight, S.detail]])

  // live pieces (rebuilt by layout, driven by state)
  let pic: SVGGElement | null = null
  let bird: SVGPathElement | null = null
  let paper: SVGPathElement | null = null
  let plaque: SVGTextElement | null = null
  let glows: SVGGElement[] = []
  let bodies: SVGPathElement[] = []
  let smoke: SVGGElement | null = null
  let evTitles: { label: SVGTextElement; x: number; end: boolean; day: number }[] = []
  let geo = { sx: 0, sy: 0, sw: 0, sh: 0, lan: [] as Pt[], lr: 8, x0: 0, x1: 0, ty: 0, W: 0, H: 0 }

  const state = { day: 0, app: true, api: true, end: false }

  function layout(W: number, Hh: number) {
    const H = stable.H(Hh)
    root.style.height = `${H}px`
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
    const wide = W / H > 1.2
    root.classList.toggle('tall', !wide)
    const short = H < 300
    root.classList.toggle('short', short)
    const tl = short ? 52 : 74
    const SA = H - tl
    let sw: number, sx: number, sy: number
    if (wide) {
      // a short screen turns into a wider cinema screen rather than a smaller one
      sw = Math.min(W * (short ? 0.42 : 0.5), (SA - 30) * (short ? 2.3 : (16 / 9) * 0.92), 680)
      sx = Math.max(16, W * 0.06)
      sy = Math.max(28, (SA - (sw * 9) / 16) * 0.42)
    } else {
      // bottom-up: timeline · lanterns and their label (~80) · rope gap (16) · the sign (30)
      const shMax = H - tl - 80 - 16 - 30
      sw = clamp(Math.min(W * 0.88, (shMax * 16) / 9), 150, 560)
      sx = (W - sw) / 2
      sy = 30
    }
    const sh = short && wide ? Math.min((sw * 9) / 16, SA - 30) : (sw * 9) / 16
    // tall: the ground sits below the hanging lanterns and their label (same geometry as the rope below)
    const span = sw + 2 * Math.max(8, sw * 0.03)
    const lrT = clamp(Math.min(sw * 0.045, span / (LANTERNS * 3)), 8, 17)
    const gy = wide ? Math.min(SA - 6, sy + sh + SA * 0.16) : Math.min(SA - 6, sy + sh + 16 + span * 0.1 + lrT * 4.3 + 22)
    const r = rng(12)
    const g = s('g')
    // a soft glow for lit lanterns: vermilion fading to nothing
    const gid = `t08s-g${Math.round(W)}x${Math.round(H)}`
    g.append(s('defs', null, s('radialGradient', { id: gid }, s('stop', { offset: 0, class: 'gl0' }), s('stop', { offset: 0.45, class: 'gl1' }), s('stop', { offset: 1, class: 'gl2' }))))
    // ground: a line of sand, raked lines, a low stone
    g.append(path(brush([[-6, gy], [W * 0.5, gy + 1.5], [W + 6, gy]], 1.8, { a: 0.05, b: 0.1, min: 0.4 }), 'k3'))
    for (let k = 1; k <= 3; k++) {
      const y = gy + k * Math.min(9, (SA - gy) / 4)
      if (y > SA - 2) break
      g.append(path(brush([[W * (0.04 + r() * 0.1), y], [W * (0.55 + r() * 0.4), y + 0.5]], 1, { a: 0.2, b: 0.3, min: 0.3 }), 'k3', { 'fill-opacity': 0.55 }))
    }
    // bamboo poles with their knots
    const pl = sx - Math.max(8, sw * 0.03)
    const pr = sx + sw + Math.max(8, sw * 0.03)
    const top = sy - Math.max(18, sh * 0.12)
    for (const x of [pl, pr]) {
      g.append(path(brush([[x, top], [x + 0.6, gy]], Math.max(3.4, sw * 0.012), { a: 0.02, b: 0.02, min: 0.8, straight: true }), 'k2'))
      for (let y = top + 24; y < gy - 10; y += Math.max(26, sh * 0.32)) g.append(path(brush([[x - 4, y], [x + 4, y]], 1.6, { a: 0.2, b: 0.2, min: 0.5, straight: true }), 'k'))
    }
    g.append(path(brush([[pl - 10, top + 6], [(pl + pr) / 2, top + 3], [pr + 10, top + 6]], 3, { a: 0.05, b: 0.1, min: 0.5 }), 'k'))
    // the paper screen and what plays on it
    paper = path(`M${sx} ${sy}H${sx + sw}V${sy + sh}H${sx}Z`, 'screen')
    g.append(paper)
    const film = s('svg', { x: sx, y: sy, width: sw, height: sh, viewBox: `0 0 ${SW} ${SH}`, preserveAspectRatio: 'xMidYMid slice' })
    pic = s('g')
    landscape(pic, 5)
    pic.prepend(path(ell(230, 60, 16), 'v', { 'fill-opacity': 0.85 }))
    bird = path(craneD(150, 70, 1.8, 0.4), 'k')
    pic.append(bird)
    film.append(pic)
    g.append(film)
    g.append(path(brush([[sx - 1, sy], [sx + sw + 1, sy + 0.3], [sx + sw + 0.5, sy + sh], [sx - 0.5, sy + sh + 0.3], [sx - 1, sy]], Math.max(1.4, sw * 0.004), { a: 0.02, b: 0.03, min: 0.6, straight: true }), 'k2', { filter: ctx.quality === 'low' ? null : 'url(#ink-rough)' }))
    for (const x of [sx + sw * 0.25, sx + sw * 0.75]) g.append(path(brush([[x, top + 5], [x, sy]], 1, { a: 0, b: 0, min: 1, straight: true }), 'k3'))
    // the name hangs from the beam on a small wooden sign
    const fs = Math.max(12, Math.min(19, sw * 0.042))
    const pw = fs * 0.62 * S.screen.length + fs * 1.4
    const py = top + 4
    g.append(path(`M${sx + sw / 2 - pw / 2} ${py - fs * 0.15}h${pw}v${fs * 1.45}h${-pw}Z`, 'card'),
      path(brush([[sx + sw / 2 - pw / 2, py - fs * 0.15], [sx + sw / 2 + pw / 2, py - fs * 0.15], [sx + sw / 2 + pw / 2, py + fs * 1.3], [sx + sw / 2 - pw / 2, py + fs * 1.3], [sx + sw / 2 - pw / 2, py - fs * 0.15]], 1.2, { a: 0, b: 0, min: 1, straight: true }), 'k2'))
    plaque = s('text', { x: sx + sw / 2, y: py + fs * 0.98, class: 't08-svgt t08s-plaque', 'text-anchor': 'middle', 'font-size': fs }, S.screen)
    g.append(plaque)
    // a rope of lanterns: the apps built on Sora's API
    let a: Pt, b: Pt
    if (wide) {
      a = [pr, sy + sh * (short ? 0.08 : 0.22)]
      b = [W - Math.max(14, W * 0.03), sy + sh * (short ? 0.18 : 0.4)]
      g.append(path(brush([[b[0], b[1] - 8], [b[0] + 0.5, gy]], 3, { a: 0.02, b: 0.02, min: 0.8, straight: true }), 'k2'))
    } else {
      a = [pl, sy + sh + 16]
      b = [pr, sy + sh + 16]
    }
    const sag = Math.abs(b[0] - a[0]) * 0.1
    const rope: Pt[] = Array.from({ length: 21 }, (_, i) => {
      const t = i / 20
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + Math.sin(Math.PI * t) * sag]
    })
    g.append(path(brush(rope, 1.3, { a: 0.05, b: 0.05, min: 0.6 }), 'k2'))
    const lr = clamp(Math.min(sw * 0.045, (b[0] - a[0]) / (LANTERNS * 3)), 8, 17)
    const lan: Pt[] = []
    glows = []
    bodies = []
    for (let i = 0; i < LANTERNS; i++) {
      const t = (i + 0.7) / (LANTERNS + 0.4)
      const top0: Pt = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + Math.sin(Math.PI * t) * sag]
      const c: Pt = [top0[0], top0[1] + lr * 2.1]
      lan.push(c)
      const glow = s('g', { class: 't08s-glow' }, path(ell(c[0], c[1] + lr * 0.2, lr * 3.2, lr * 3.4), '', { fill: `url(#${gid})` }))
      const body = path(ell(c[0], c[1], lr * 0.82, lr), 'lan')
      g.append(path(brush([top0, [c[0], c[1] - lr]], 1, { a: 0, b: 0, min: 1, straight: true }), 'k3'), glow, body,
        path(brush(arc(c[0], c[1], lr * 0.42, lr, -90, 90, 8), 0.9, { a: 0.2, b: 0.2 }) + brush(arc(c[0], c[1], lr * 0.42, lr, 90, 270, 8), 0.9, { a: 0.2, b: 0.2 }), 'k', { 'fill-opacity': 0.3 }),
        path(`M${c[0] - lr * 0.45} ${c[1] - lr - 2}h${lr * 0.9}v3h${-lr * 0.9}ZM${c[0] - lr * 0.45} ${c[1] + lr - 1}h${lr * 0.9}v3h${-lr * 0.9}Z`, 'k'))
      glows.push(glow)
      bodies.push(body)
    }
    const labY = Math.max(...lan.map((p) => p[1])) + lr * 2.2 + 10
    g.append(s('text', { x: (a[0] + b[0]) / 2, y: labY, class: 't08-svgt k2', 'text-anchor': 'middle', 'font-size': 12 }, S.lanterns))
    smoke = s('g')
    g.append(smoke)
    // timeline: the range is the line; ticks for months, seals for the two events
    const x0 = 56
    const x1 = W - 14
    const ty = H - (short ? 24 : 36)
    const X = (d: number) => x0 + (d / END) * (x1 - x0)
    g.append(s('text', { x: 4, y: ty + 5, class: 't08-svgt k', 'font-size': 14 }, S.year))
    for (const d of MONTH0) g.append(path(brush([[X(d), ty + 7], [X(d), ty + 12]], 1, { a: 0, b: 0, min: 1, straight: true }), 'k3'))
    evTitles = S.events.map((e, i) => {
      const x = X(i ? E2 : E1)
      const label = s('text', { x, y: ty - 22, class: 't08-svgt k2 t08s-ev', 'text-anchor': i ? 'end' : 'middle', 'font-size': 11.5 }, e.title)
      // a dab of vermilion ink, a little uneven, rather than a flat square
      g.append(path(pebble(x, ty - 13, 4.6, 4.2, rng(i ? 31 : 17), 0.12), 'v', { 'fill-opacity': 0.9 }), label)
      return { label, x, end: !!i, day: i ? E2 : E1 }
    })
    svg.replaceChildren(g)
    Object.assign(range.style, { left: `${x0 - 13}px`, width: `${x1 - x0 + 26}px`, top: `${ty - 16}px` })
    months.replaceChildren(...MONTH0.map((d, i) => h('span', { style: `left:${X(d)}px` }, fill(S.month, { n: i + 1 }))))
    months.style.top = `${ty + 13}px`
    // the story is told on the screen itself, once it has gone dark
    Object.assign(story.style, { left: `${sx + sw * 0.06}px`, width: `${sw * 0.88}px`, top: `${sy}px`, height: `${sh}px` })
    story.style.setProperty('--sfs', `${clamp(sw * 0.036, short ? 11 : 12, 19)}px`)
    geo = { sx, sy, sw, sh, lan, lr, x0, x1, ty, W, H }
    apply(true)
    placeBubble()
  }

  // ───────── state → picture ─────────
  function apply(instant = false) {
    const fast = instant || ctx.reduced
    const fx = (el: Element | null, v: Record<string, unknown>) => {
      if (!el) return
      if (fast) gsap.set(el, v)
      else ctx.anim(() => gsap.to(el, { ...v, duration: 1.4, ease: 'power2.inOut', overwrite: 'auto' }))
    }
    // a ghost of the last frame stays on the dark screen
    fx(pic, { opacity: state.app ? 1 : 0.07 })
    paper?.classList.toggle('off', !state.app)
    plaque?.classList.toggle('off', !state.app)
    glows.forEach((gl, i) => {
      if (fast) gsap.set(gl, { opacity: state.api ? 1 : 0 })
      else ctx.anim(() => gsap.to(gl, { opacity: state.api ? 1 : 0, duration: 0.9, delay: state.api ? 0 : i * 0.28, ease: 'power2.out', overwrite: 'auto' }))
      bodies[i].classList.toggle('off', !state.api)
    })
  }

  function puff(x: number, y: number, size: number, delay = 0) {
    if (ctx.reduced || !smoke) return
    const r = rng(Math.round(x * 13 + y))
    const p = path(brush([[x, y], [x + (r() - 0.5) * size, y - size * 0.6], [x + (r() - 0.5) * size * 1.2, y - size * 1.3], [x + (r() - 0.5) * size, y - size * 2]], size * 0.16, { a: 0.3, b: 0.6, min: 0.15 }), 'k3', { opacity: 0 })
    smoke.append(p)
    ctx.anim(() => gsap.timeline({ delay, onComplete: () => p.remove() })
      .to(p, { opacity: 0.6, duration: 0.5 })
      .to(p, { y: -size * 1.4, opacity: 0, duration: 2.2, ease: 'power1.out' }, 0.3))
  }

  function tell() {
    const kids: (Node | string)[] = []
    if (state.end) {
      // two small ink marks: a stack of coins (the running cost), a vermilion seal (the law)
      const coins = () => {
        const g: SVGElement[] = []
        for (let k = 0; k < 3; k++) {
          const y = 26 - k * 6
          g.push(path(ell(30, y, 15, 5), 'card'), path(brush(arc(30, y, 15, 5, 0, 180, 12), 1.8, { a: 0.1, b: 0.2, min: 0.4 }), 'k2'), path(brush(arc(30, y, 15, 5, 180, 360, 12), 1, { a: 0.2, b: 0.2, min: 0.4 }), 'k3'))
        }
        return g
      }
      const seal = () => [
        path(pebble(30, 18, 12, 12, rng(9), 0.05), 'v', { transform: 'rotate(-6 30 18)' }),
        path(brush([[24, 13], [36, 13]], 1.6, { a: 0, b: 0, min: 1, straight: true }) + brush([[30, 13], [30, 25]], 1.6, { a: 0, b: 0, min: 1, straight: true }) + brush([[24, 24], [36, 24]], 1.6, { a: 0, b: 0, min: 1, straight: true }), 'card', { transform: 'rotate(-6 30 18)' }),
      ]
      const peb = (label: string, i: number) =>
        h('span', { class: 't08s-reason' }, s('svg', { viewBox: '0 0 60 34', 'aria-hidden': 'true' }, ...(i ? seal() : coins())), h('span', null, label))
      // both closings, dated, so a quick drag to the end still tells the whole story
      const dates = h('div', { class: 't08s-dates' }, ...S.events.map((e) => h('span', { class: 't08s-when' }, h('span', { class: 't08s-seal', 'aria-hidden': 'true' }), ctx.fact(e.short, 'span'))))
      kids.push(dates, h('div', { class: 't08s-reasons' }, ...S.reasons.map(peb)), ctx.fact(S.reasonFact, 'p', 't08s-fact'))
    } else if (!state.app) {
      const e = state.api ? S.events[0] : S.events[1]
      kids.push(h('p', { class: 't08s-title' }, h('span', { class: 't08s-seal', 'aria-hidden': 'true' }), e.title), ctx.fact(e.fact, 'p', 't08s-fact'))
    }
    story.replaceChildren(...kids)
    story.hidden = !kids.length
    if (kids.length && !ctx.reduced) ctx.anim(() => gsap.fromTo(story.children, { opacity: 0, y: 8, filter: 'blur(4px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.9, stagger: 0.12, ease: 'power3.out', clearProps: 'filter' }))
  }

  function placeBubble() {
    const bx = clamp(geo.x0 + (state.day / END) * (geo.x1 - geo.x0), 46, geo.W - 46)
    bubble.style.left = `${bx}px`
    bubble.style.top = `${geo.ty - 40}px`
    // only the seals show at first; an event's name appears once the day has passed it, and steps aside for the date
    // (it hides only where there is no room to step aside, e.g. while the date passes right over it)
    const bw = (bubble.offsetWidth || 88) / 2 + 8
    const hit = (l: number, r: number) => r > bx - bw && l < bx + bw
    const ls = evTitles.map(({ label, x, end, day }) => {
      const w = label.getComputedTextLength() || 52
      const l = end ? x - w : x - w / 2
      const dx = hit(l, l + w) ? (l + w / 2 < bx ? bx - bw - l - w : bx + bw - l) : 0
      return { label, w, l, dx, on: state.day >= day }
    })
    // right to left: a name that stepped aside nudges its left neighbour along rather than landing on it
    for (let i = ls.length - 2; i >= 0; i--) {
      const a = ls[i]
      const b = ls[i + 1]
      if (a.on && b.on) a.dx = Math.min(a.dx, b.l + b.dx - 10 - a.l - a.w)
    }
    ls.forEach(({ label, w, l, dx, on }) => {
      const hide = !on || Math.abs(dx) > w * 1.5 || hit(l + dx + 1, l + dx + w - 1) || l + dx < geo.x0 - 24 || l + dx + w > geo.W - 4
      label.classList.toggle('hide', hide)
      if (!hide) label.style.transform = `translateX(${dx.toFixed(1)}px)`
    })
  }

  function setDay(d: number) {
    state.day = d
    const frac = d / END
    range.style.setProperty('--fill', `${frac * 100}%`)
    let mm = 0
    while (mm < MONTH0.length - 1 && MONTH0[mm + 1] <= d) mm++
    const date = fill(S.dateFmt, { d: String(d - MONTH0[mm] + 1).padStart(2, '0'), m: String(mm + 1).padStart(2, '0') })
    bubble.textContent = date
    range.setAttribute('aria-valuetext', date)
    placeBubble()
    const app = d < E1
    const api = d < E2
    const end = d >= END
    let changed = false
    if (app !== state.app) {
      state.app = app
      changed = true
      if (!app) {
        ctx.chime('low')
        for (let i = 0; i < 4; i++) puff(geo.sx + geo.sw * (0.2 + i * 0.2), geo.sy, Math.max(14, geo.sw * 0.06), i * 0.18)
      }
    }
    if (api !== state.api) {
      state.api = api
      changed = true
      if (!api) {
        ctx.chime('low')
        geo.lan.forEach(([x, y], i) => puff(x, y - geo.lr, geo.lr * 1.6, i * 0.28 + 0.2))
      }
    }
    if (end !== state.end) {
      state.end = end
      changed = true
      if (end) {
        ctx.chime('soft')
        ctx.insight(S.insight, S.detail)
      }
    }
    apply()
    if (changed) tell()
  }
  range.addEventListener('input', () => setDay(Number(range.value)))

  const unwatch = watchSize(ctx.art, layout)
  layout(ctx.art.clientWidth, ctx.art.clientHeight)
  stable.afterFonts(() => layout(ctx.art.clientWidth, ctx.art.clientHeight))
  setDay(0)
  tell()

  // the crane on the screen; the lanterns breathe
  const stop = ctx.reduced
    ? () => {}
    : loop((t) => {
        if (state.app && bird) {
          const u = (t / 6) % 1
          bird.setAttribute('d', craneD(-20 + u * 360, 74 - Math.sin(u * Math.PI) * 16, 1.8, Math.sin(t * 7)))
        }
        if (state.api) glows.forEach((gl, i) => gl.firstElementChild?.setAttribute('opacity', (0.85 + 0.15 * Math.sin(t * 1.7 + i * 1.3)).toFixed(3)))
      })
  if (!ctx.reduced) gsap.from(svg, { opacity: 0, duration: 1.4, ease: 'power2.out', delay: 0.1 })

  return () => {
    stop()
    unwatch()
  }
}

