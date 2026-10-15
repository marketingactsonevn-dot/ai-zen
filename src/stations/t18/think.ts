import { fill, h, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import { createLoop } from '../../core/loop'
import { cssVar } from '../../core/prefs'
import type { SceneCtx } from '../types'
import { C } from './data'
import { arc, brush, clamp, ell, enso, onTheme, poly, rng, stable, stroke, wash, watch, type Pt } from './ink'

const S = C.scenes.think
const TOTAL = 120 // seconds: one stick of incense
const EARLY = 20 // seconds: with at least one idea written, the AI may answer after this
const VB = { y: 74, w: 140, h: 248 }
const BASE: Pt = [71, 251] // where the stick enters the ash
const TOP = 100 // stick tip at the start (viewBox y)
const END = 232 // where it has burnt down to after two minutes

const rgb = (c: string, fb: string) => {
  const m = c.trim().match(/^#?([0-9a-f]{6})$/i)
  return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).join(',') : fb
}

/** A stoneware incense bowl on a flat stone, painted in ink; the stick shortens as `burn` goes 0 → 1. */
function incense(low: boolean) {
  const svg = s('svg', { class: 't18t-svg', viewBox: `0 ${VB.y} ${VB.w} ${VB.h}`, 'aria-hidden': 'true' })
  const f = (id: string) => (low ? null : { filter: `url(#${id})` })
  const body = s('g', f('ink-wash'))
  const dry = s('g', f('ink-dry'))
  const ink = s('g', f('ink-rough'))
  const r = rng(4)
  // the ground shadow it sits in
  body.append(wash(ell(80, 300, 70, 7), 0.16), wash(ell(74, 298, 44, 4), 0.2))
  // the bowl: a round-bellied stoneware koro full of ash, lit from the left, on three small feet
  const rim = { cx: 70, cy: 251, rx: 45, ry: 9 }
  const bowlPts: Pt[] = [...arc(rim.cx, rim.cy, rim.rx, rim.ry, 0, 180, 18)]
  const side = (t: number, sd: number): Pt => [70 + sd * (45 + 9 * Math.sin(Math.PI * t * 0.85) - 16 * t * t), 251 + 39 * t]
  const left: Pt[] = []
  const right: Pt[] = []
  for (let i = 0; i <= 12; i++) {
    left.push(side(i / 12, -1))
    right.push(side(i / 12, 1))
  }
  const bowl = poly([...left, ...arc(70, 290, 38, 5, 180, 0, 14), ...right.slice().reverse(), ...bowlPts.slice().reverse()])
  body.append(
    s('path', { class: 'p', d: bowl }),
    wash(bowl, 0.3),
    // shadow side and the turn of the belly
    wash(poly([...right, ...right.slice().reverse().map(([x, y]) => [70 + (x - 70) * 0.45, y] as Pt)]), 0.26),
    wash(poly([...arc(70, 266, 44, 7, 10, 170, 14), ...arc(70, 273, 42, 7, 170, 10, 14)]), 0.07),
    s('path', { class: 'ash', d: ell(rim.cx, rim.cy, rim.rx - 4, rim.ry - 2.2) }),
  )
  for (const [fx, w, op] of [[0.82, 8, 0.22], [0.62, 6, 0.14], [-0.7, 4, 0.06]] as const) {
    const pts: Pt[] = []
    for (let i = 1; i <= 11; i++) {
      const [x, y] = side(i / 12, 1)
      pts.push([70 + (x - 70) * fx, y])
    }
    dry.append(stroke(pts, w, 'k', { a: 0.15, b: 0.2, min: 0.5, wob: 0.2 }, op))
  }
  // a few grains of ash and a fallen curl
  for (let i = 0; i < 7; i++) body.append(s('path', { class: 'k', 'fill-opacity': 0.18, d: ell(52 + r() * 36, 249 + r() * 4, 1 + r() * 1.4, 0.6 + r() * 0.6) }))
  ink.append(
    stroke(arc(rim.cx, rim.cy, rim.rx, rim.ry, 190, 330, 16), 1.3, 'k', { a: 0.2, b: 0.3, min: 0.3 }, 0.6),
    stroke(arc(rim.cx, rim.cy, rim.rx, rim.ry, 176, 6, 22), 2.6, 'k', { a: 0.1, b: 0.3, min: 0.35 }),
    stroke(left, 3.4, 'k', { a: 0.06, b: 0.3, min: 0.3 }),
    stroke(right.slice(0, 7), 1.6, 'k', { a: 0.2, b: 0.4, min: 0.3 }, 0.75),
    stroke(right.slice(8), 2, 'k', { a: 0.3, b: 0.2, min: 0.3 }, 0.8),
    stroke(arc(70, 290, 38, 5, 160, 20, 12), 2.2, 'k', { a: 0.2, b: 0.3, min: 0.3 }),
    stroke(arc(70, 259, 50, 6.5, 150, 40, 14), 1, 'k2', { a: 0.3, b: 0.3, min: 0.3 }, 0.4),
    // three small feet
    ...([[44, 291], [70, 296], [96, 291]] as Pt[]).map(([x, y]) => stroke([[x - 4, y - 1], [x, y + 4], [x + 4, y - 1]], 3.2, 'k', { a: 0.2, b: 0.3, min: 0.4 })),
  )
  // light caught on the bowl's shoulder
  const shine = stroke(left.slice(2, 9).map(([x, y]) => [x + 9, y] as Pt), 3.2, 'p', { a: 0.3, b: 0.5, min: 0.2 }, 0.7)
  const stick = s('line', { class: 'stick', x1: BASE[0], y1: BASE[1], x2: BASE[0] - 2, y2: TOP })
  const ashTip = s('line', { class: 'ashtip', x1: BASE[0] - 2, y1: TOP, x2: BASE[0] - 2, y2: TOP - 6 })
  const glow = s('circle', { class: 'glow', cx: BASE[0] - 2, cy: TOP, r: 9, opacity: 0 })
  const ember = s('circle', { class: 'ember', cx: BASE[0] - 2, cy: TOP, r: 2.2, opacity: 0 })
  svg.append(body, dry, shine, stick, ashTip, glow, ember, ink)
  const set = (burn: number) => {
    const y = TOP + (END - TOP) * burn
    const x = BASE[0] - 2 + 2 * ((y - TOP) / (BASE[1] - TOP))
    stick.setAttribute('x2', String(x))
    stick.setAttribute('y2', String(y))
    ashTip.setAttribute('x1', String(x))
    ashTip.setAttribute('y1', String(y))
    ashTip.setAttribute('x2', String(x - 1 + Math.sin(burn * 40)))
    ashTip.setAttribute('y2', String(y - 7))
    for (const c of [ember, glow]) {
      c.setAttribute('cx', String(x))
      c.setAttribute('cy', String(y))
    }
    return [x, y] as const
  }
  return { svg, set, ember, glow }
}

/**
 * Incense smoke on a canvas: two ribbons of points emitted at the tip, each rising and swaying more the older it
 * gets; drawn as a thin stroke that widens and fades, and gone before it reaches the top edge.
 */
function smoke(canvas: HTMLCanvasElement, reduced: boolean) {
  const g = canvas.getContext('2d')!
  let color = '0,0,0'
  const tip = { x: 0, y: 0 }
  let on = false
  let clock = 0
  let cssH = 1
  type P = { x0: number; y: number; t: number; ph: number }
  const ribbons: P[][] = [[], []]
  const spare: P[] = [] // recycled particles: no new objects per frame
  const readColor = () => (color = rgb(cssVar('--ink'), '40,40,40'))
  const size = () => {
    const r = canvas.getBoundingClientRect()
    const d = Math.min(2, devicePixelRatio || 1)
    cssH = Math.max(1, r.height)
    canvas.width = Math.round(r.width * d)
    canvas.height = Math.round(r.height * d)
    g.setTransform(d, 0, 0, d, 0, 0)
  }
  const step = (dt: number) => {
    clock += dt
    for (let k = 0; k < 2; k++) {
      const pts = ribbons[k]
      if (on) {
        const p = spare.pop() ?? { x0: 0, y: 0, t: 0, ph: 0 }
        p.x0 = tip.x + (k ? 1.2 : -0.6)
        p.y = tip.y - 2
        p.t = 0
        p.ph = clock * 0.55 + k * 2.1
        pts.push(p)
      }
      for (const p of pts) {
        p.t += dt
        p.y -= (26 + p.t * 5) * dt
      }
      while (pts.length && (pts[0].y < -20 || pts[0].t > 9)) spare.push(pts.shift()!)
    }
  }
  const xOf = (p: P, k: number) => {
    // calm near the tip, swaying wider (and drifting with the air) as it rises
    const amp = 0.4 + p.t * (k ? 5 : 3.6)
    return p.x0 + amp * Math.sin(p.t * (k ? 1.1 : 1.45) + p.ph) + Math.sin(p.t * 0.5 + k * 2.4) * p.t * 2.6 + p.t * 2.4
  }
  const draw = () => {
    g.clearRect(0, 0, canvas.width, canvas.height)
    g.lineCap = 'round'
    g.lineJoin = 'round'
    const fadeTop = cssH * 0.16
    for (let k = 0; k < 2; k++) {
      const pts = ribbons[k]
      for (let i = 2; i < pts.length; i += 2) {
        const a = pts[i - 2]
        const b = pts[i]
        const life = Math.min(1, b.t / 8.5)
        const edge = clamp((b.y - 4) / fadeTop)
        const fade = (1 - life) ** 1.6 * Math.min(1, b.t * 2.5) * edge * edge
        const halo = (k ? 0.025 : 0.035) * fade * Math.min(1, b.t * 0.8)
        const core = (k ? 0.13 : 0.18) * fade * (1 - life * 0.6)
        const ax = xOf(a, k)
        const bx = xOf(b, k)
        if (halo > 0.004) {
          g.strokeStyle = `rgba(${color},${halo.toFixed(3)})`
          g.lineWidth = 1.5 + b.t * 2.4
          g.beginPath()
          g.moveTo(ax, a.y)
          g.lineTo(bx, b.y)
          g.stroke()
        }
        if (core > 0.004) {
          g.strokeStyle = `rgba(${color},${core.toFixed(3)})`
          g.lineWidth = 0.6 + b.t * 0.45
          g.beginPath()
          g.moveTo(ax, a.y)
          g.lineTo(bx, b.y)
          g.stroke()
        }
      }
    }
  }
  // runs while lit and until the last wisp has faded after out()
  const loop = createLoop(canvas, (_, dt) => {
    step(dt)
    draw()
    return on || ribbons[0].length + ribbons[1].length > 0
  })
  readColor()
  return {
    size: () => (size(), draw()),
    readColor: () => (readColor(), draw()),
    setTip(x: number, y: number) {
      tip.x = x
      tip.y = y
    },
    light() {
      on = true
      if (reduced) {
        // a still wisp: the same ribbons, simulated once
        for (let i = 0; i < 360; i++) step(1 / 60)
        draw()
        return
      }
      loop.start()
    },
    out() {
      on = false
    },
    dispose: () => loop.dispose(),
  }
}

/** Morning fog lying over the AI's ideas: soft paper-coloured puffs that drift, then thin out and part. */
function fog(canvas: HTMLCanvasElement, reduced: boolean) {
  const g = canvas.getContext('2d')!
  const r = rng(21)
  const puffs = Array.from({ length: 16 }, (_, i) => ({ u: (i % 4) / 3 + (r() - 0.5) * 0.2, v: Math.floor(i / 4) / 3 + (r() - 0.5) * 0.2, k: 0.42 + r() * 0.3, ph: r() * 6, sp: 0.2 + r() * 0.25 }))
  let paper = '240,240,240'
  let W = 1
  let H = 1
  let clear = 0
  let t = 0
  const read = () => (paper = rgb(cssVar('--paper'), '240,240,240'))
  const size = () => {
    const b = canvas.getBoundingClientRect()
    const d = Math.min(2, devicePixelRatio || 1)
    W = Math.max(1, b.width)
    H = Math.max(1, b.height)
    canvas.width = Math.round(W * d)
    canvas.height = Math.round(H * d)
    g.setTransform(d, 0, 0, d, 0, 0)
  }
  const draw = () => {
    g.clearRect(0, 0, W, H)
    const base = 0.36 * (1 - clear) ** 1.5
    if (base > 0.003) {
      g.fillStyle = `rgba(${paper},${base.toFixed(3)})`
      g.fillRect(0, 0, W, H)
    }
    const R = Math.max(W, H)
    for (const p of puffs) {
      // as it clears, every puff drifts outward from the middle and fades
      const out = clear * 0.9
      const x = (p.u + Math.sin(t * p.sp + p.ph) * 0.05 + (p.u - 0.5) * out) * W
      const y = (p.v + Math.cos(t * p.sp * 0.8 + p.ph) * 0.06 + (p.v - 0.5) * out * 0.6) * H
      const rr = R * p.k * (1 + clear * 0.5)
      const a = 0.48 * (1 - clear) ** 1.2
      if (a < 0.004) continue
      // TODO(perf): 16 gradients per frame; a pre-rendered puff sprite would avoid them but may shift the look
      const grd = g.createRadialGradient(x, y, 0, x, y, rr)
      grd.addColorStop(0, `rgba(${paper},${a.toFixed(3)})`)
      grd.addColorStop(0.5, `rgba(${paper},${(a * 0.6).toFixed(3)})`)
      grd.addColorStop(1, `rgba(${paper},0)`)
      g.fillStyle = grd
      g.fillRect(x - rr, y - rr, rr * 2, rr * 2)
    }
  }
  const loop = createLoop(canvas, (_, dt) => {
    t += dt
    draw()
    return clear < 1
  })
  read()
  return {
    size: () => (size(), draw()),
    read: () => (read(), draw()),
    start() {
      if (reduced || loop.running) return draw()
      loop.start()
    },
    /** 0 → 1 */
    set(k: number) {
      clear = k
      if (reduced || !loop.running) draw()
    },
    dispose: () => loop.dispose(),
  }
}

/** Ruled ink lines for a sheet of rice paper, drawn to its size and line height. */
function rules(svg: SVGSVGElement, w: number, lh: number, n: number, seed: number) {
  const r = rng(seed)
  svg.setAttribute('viewBox', `0 0 ${w} ${lh * n + 4}`)
  svg.replaceChildren(...Array.from({ length: n }, (_, i) => {
    const y = (i + 1) * lh - 2
    const x0 = r() * 6
    const x1 = w - r() * 14
    return stroke([[x0, y + (r() - 0.5)], [(x0 + x1) / 2, y + (r() - 0.5) * 1.4], [x1, y + (r() - 0.5)]], 1.1, 'k3', { a: 0.04, b: 0.2, min: 0.4, wob: 0.12 }, 0.42)
  }))
}

export function thinkScene(ctx: SceneCtx) {
  const low = ctx.quality === 'low'
  const inc = incense(low)
  const smokeC = h('canvas', { class: 't18t-smoke', 'aria-hidden': 'true' })
  const timer = h('p', { class: 't18t-timer', 'aria-live': 'off' }, '2:00')
  const start = h('button', { class: 'btn ghost t18t-start', type: 'button', 'aria-label': S.start }, h('span', { class: 't18t-flame', 'aria-hidden': 'true' }), h('span', { class: 't18t-st', 'aria-hidden': 'true' }, S.start))
  const stick = h('div', { class: 't18t-incense' }, inc.svg, h('div', { class: 't18t-ctl' }, timer, start))

  // the question is brushed in; once the AI has answered, the good habit takes its place
  const under = s('svg', { class: 't18t-under', viewBox: '0 0 200 10', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    s('path', { class: 'k', 'fill-opacity': 0.22, d: brush([[2, 6], [80, 4.6], [198, 5.4]], 3.4, { a: 0.05, b: 0.6, min: 0.15 }).d }))
  const q = h('div', { class: 't18t-qwrap' }, h('h2', { class: 't18t-q' }, S.question), under)
  const mark = enso('t18t-enso', 2)
  const habit = h('div', { class: 't18t-habit' }, mark.svg,
    h('div', null, h('p', { class: 't18t-ht' }, S.habitTitle), h('p', { class: 't18t-h' }, S.habit), h('p', { class: 't18t-hs' }, S.habitSub)))
  habit.setAttribute('aria-hidden', 'true')
  const head = h('div', { class: 't18t-head' }, q, habit)

  const youRules = s('svg', { class: 't18t-rules', 'aria-hidden': 'true', preserveAspectRatio: 'none' })
  const ta = h('textarea', { class: 't18t-ta', 'aria-label': S.yours, placeholder: S.placeholder, rows: 4 }) as HTMLTextAreaElement
  const compare = h('p', { class: 't18t-compare' }, S.compare)
  const you = h('div', { class: 't18t-paper you' }, h('p', { class: 't18t-lab' }, S.yours), h('div', { class: 't18t-sheet' }, youRules, ta), compare)

  const aiRules = s('svg', { class: 't18t-rules', 'aria-hidden': 'true', preserveAspectRatio: 'none' })
  const items = S.aiItems.map((t) => h('li', null, t))
  const list = h('ol', { class: 't18t-list', 'aria-hidden': 'true' }, ...items)
  const fogC = h('canvas', { class: 't18t-fog', 'aria-hidden': 'true' })
  const reveal = h('button', { class: 'btn t18t-reveal', type: 'button' }, S.reveal)
  const skip = h('button', { class: 't18t-skip', type: 'button' }, S.skip)
  reveal.hidden = true
  const veil = h('div', { class: 't18t-veil' }, h('p', { class: 't18t-veilt' }, S.veil), reveal, skip)
  const ai = h('div', { class: 't18t-paper ai' }, h('p', { class: 't18t-lab' }, S.ai, ' ', ctx.tag('illustration')), h('div', { class: 't18t-sheet' }, aiRules, list, fogC, veil))

  const status = h('p', { class: 'visually-hidden', 'aria-live': 'polite' })
  const root = h('div', { class: 't18 t18t' }, h('p', { class: 'visually-hidden' }, S.art), smokeC, head, stick, you, ai, status)
  ctx.art.append(root)
  const st = stable(ctx, [S.insight], root)
  const fx = smoke(smokeC, ctx.reduced)
  const mist = fog(fogC, ctx.reduced || low)

  let lit = false
  let burn = 0
  let t0 = 0
  let tick = 0
  let ready = false
  let opened = false

  const placeTip = () => {
    const [x, y] = inc.set(burn)
    const b = inc.svg.getBoundingClientRect()
    const R = root.getBoundingClientRect()
    const k = Math.min(b.width / VB.w, b.height / VB.h)
    fx.setTip(b.left + (b.width - VB.w * k) / 2 - R.left + x * k, b.top + (b.height - VB.h * k) / 2 - R.top + (y - VB.y) * k)
  }

  const fmt = (sec: number) => ({ m: String(Math.floor(sec / 60)), s: String(Math.floor(sec % 60)).padStart(2, '0') })
  const ideas = () => ta.value.split('\n').filter((l) => l.trim().length > 1).length

  /** the AI may answer once the incense has burnt, or once you have written something and thought a little */
  function gate() {
    if (ready || opened) return
    const el = lit ? (performance.now() - t0) / 1000 : 0
    if (burn < 1 && !(ideas() > 0 && el >= EARLY)) return
    ready = true
    reveal.hidden = false
    skip.hidden = true
    status.textContent = S.reveal
    ctx.chime('soft')
    if (!ctx.reduced) ctx.anim(() => gsap.fromTo(reveal, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 1, ease: 'power3.out' }))
  }

  function light() {
    if (lit) return
    lit = true
    start.disabled = true
    root.classList.add('lit')
    ctx.chime('soft')
    if (ctx.reduced) gsap.set([inc.ember, inc.glow], { opacity: 1 })
    else ctx.anim(() => {
      gsap.fromTo(inc.glow, { opacity: 0, scale: 0.2, svgOrigin: `${BASE[0] - 2} ${TOP}` }, { opacity: 0.9, scale: 1, duration: 1.2, ease: 'power2.out' })
      gsap.fromTo(inc.ember, { opacity: 0 }, { opacity: 1, duration: 0.4 })
    })
    placeTip()
    fx.light()
    t0 = performance.now()
    tick = window.setInterval(() => {
      const el = (performance.now() - t0) / 1000
      burn = Math.min(1, el / TOTAL)
      placeTip()
      const left = fmt(Math.max(0, TOTAL - el))
      timer.textContent = fill(S.timer, left)
      timer.setAttribute('aria-label', fill(S.timerAria, left))
      if (burn >= 1) {
        clearInterval(tick)
        timer.textContent = S.done
        fx.out()
        gsap.to([inc.ember, inc.glow], { opacity: 0, duration: 2 })
        root.classList.add('done')
        ctx.chime('ok')
        status.textContent = S.done
      }
      gate()
    }, 250)
  }

  function open() {
    if (opened) return
    opened = true
    list.removeAttribute('aria-hidden')
    habit.removeAttribute('aria-hidden')
    root.classList.add('opened')
    root.classList.toggle('wrote', ideas() > 0)
    status.textContent = `${S.ai}: ${S.aiItems.join('; ')}`
    const after = () => {
      veil.hidden = true
      fogC.hidden = true
      st.apply()
      ctx.insight(S.insight, S.detail)
    }
    if (ctx.reduced) {
      mist.set(1)
      gsap.set(list, { filter: 'none', opacity: 1 })
      gsap.set(q, { opacity: 0 })
      gsap.set(habit, { opacity: 1 })
      after()
      return
    }
    ctx.anim(() => {
      const tl = gsap.timeline()
      const k = { v: 0 }
      tl.to(veil, { opacity: 0, duration: 0.6, ease: 'power2.in' }, 0)
      tl.to(k, { v: 1, duration: 2.4, ease: 'power2.inOut', onUpdate: () => mist.set(k.v) }, 0)
      tl.to(list, { filter: 'blur(0px)', opacity: 1, duration: 1.8, ease: 'power2.out' }, 0.2)
      tl.fromTo(items, { opacity: 0, clipPath: 'inset(0 100% 0 0)' }, { opacity: 1, clipPath: 'inset(0 -4% 0 0)', duration: 1.1, stagger: 0.3, ease: 'power2.out', clearProps: 'clipPath' }, 0.7)
      tl.to(q, { opacity: 0, filter: 'blur(6px)', duration: 0.9, ease: 'power2.in' }, 0.4)
      tl.fromTo(habit, { opacity: 0 }, { opacity: 1, duration: 0.8 }, 1.3)
      tl.fromTo(mark.reveal, { attr: { 'stroke-dashoffset': 1.02 } }, { attr: { 'stroke-dashoffset': 0 }, duration: 1.6, ease: 'power2.inOut' }, 1.3)
      tl.fromTo(habit.lastElementChild, { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: 1, ease: 'power3.out' }, 1.8)
      tl.fromTo(compare, { opacity: 0 }, { opacity: 1, duration: 1 }, 2.2)
      tl.add(() => setTimeout(after), 2.4)
    })
  }

  start.addEventListener('click', light)
  ta.addEventListener('focus', light)
  ta.addEventListener('input', gate)
  reveal.addEventListener('click', open)
  skip.addEventListener('click', open)

  function layout() {
    st.apply()
    const W = root.clientWidth
    const H = Math.max(1, root.clientHeight)
    const wide = W / H > 1.05
    root.classList.toggle('wide', wide)
    root.classList.toggle('short', wide && H < 360)
    // both sheets share one height: enough ruled lines for your ideas and for the AI's list
    const lh = parseFloat(getComputedStyle(ta).lineHeight) || 26
    root.style.setProperty('--lh', `${lh}px`)
    // phones give each sheet its own height (the AI's runs full width under the incense)
    const rows = wide && H < 360 ? 3 : 4
    const nAi = Math.max(wide ? rows : 2, Math.ceil((list.scrollHeight - 2) / lh))
    const nYou = wide ? Math.max(rows, nAi) : rows
    root.style.setProperty('--rows', String(nYou))
    root.style.setProperty('--rows-ai', String(wide ? nYou : nAi))
    rules(youRules, Math.max(40, youRules.getBoundingClientRect().width), lh, nYou, 3)
    rules(aiRules, Math.max(40, aiRules.getBoundingClientRect().width), lh, wide ? nYou : nAi, 8)
    fx.size()
    mist.size()
    placeTip()
  }

  watch(ctx, layout)
  onTheme(ctx, () => {
    fx.readColor()
    mist.read()
  })
  inc.set(0)
  mist.start()
  ctx.prompt(S.prompt)
  if (!ctx.reduced) {
    gsap.from(inc.svg, { opacity: 0, y: 14, duration: 1.8, ease: 'power2.out', delay: 0.2 })
    gsap.from(q, { opacity: 0, clipPath: 'inset(0 100% 0 0)', duration: 1.8, ease: 'power2.out', delay: 0.5, clearProps: 'clipPath' })
    gsap.from([you, ai], { opacity: 0, y: 10, duration: 1.4, stagger: 0.2, ease: 'power3.out', delay: 0.9 })
  }
  gsap.set(habit, { opacity: 0 })
  // the AI's lines wait as soft grey shapes in the mist
  gsap.set(list, { filter: 'blur(5px)', opacity: 0.55 })
  return () => {
    clearInterval(tick)
    fx.dispose()
    mist.dispose()
  }
}
