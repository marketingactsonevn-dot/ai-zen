import { fill, h, nextId, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx, SceneDef } from '../types'
import { C, type StoneId } from './data'
import { clamp, dryFilter, ell, ringsArt, sandArt, skyArt, stoneArt, type Pt } from './art'
import { onLayout, stableHeight } from './kit'

const L = C.scenes.loop
const STEPS = L.steps
/** ring stones, clockwise (degrees, 0 = right, 90 = down) */
const ANG: Partial<Record<StoneId, number>> = { plan: -135, act: -45, observe: 45, fix: 135 }
const IDS: StoneId[] = ['goal', 'plan', 'act', 'observe', 'fix', 'report']
const SEEDS: Record<StoneId, number> = { goal: 1.3, plan: 2.2, act: 4.1, observe: 0.7, fix: 3.3, report: 5.2 }
/** no two stones alike: size, how flat they lie, how much moss */
const SIZE: Record<StoneId, number> = { goal: 1.12, plan: 1, act: 0.9, observe: 1.06, fix: 0.92, report: 1.08 }
const FLAT: Record<StoneId, number> = { goal: 0.46, plan: 0.5, act: 0.42, observe: 0.48, fix: 0.53, report: 0.44 }
const MOSS: Record<StoneId, number> = { goal: 5, plan: 3, act: 0, observe: 6, fix: 2, report: 4 }
const rad = (d: number) => (d * Math.PI) / 180

/** Scene 3 — the agent loop: an ink dot walks a ring of stepping stones, one step per press. */
export const loopScene: SceneDef = { label: L.label, mount }

function mount(ctx: SceneCtx) {
  const id = nextId('t14l')
  const root = h('div', { class: 't14 t14-loop' })
  const svg = s('svg', { class: 't14-svg', 'aria-hidden': 'true' })
  const labs = Object.fromEntries(IDS.map((k) => [k, h('p', { class: 't14-stone-lab', 'aria-hidden': 'true' }, L.stones[k])])) as unknown as Record<StoneId, HTMLElement>
  const rep = h('p', { class: 't14-repeat', 'aria-hidden': 'true' }, L.repeat)
  const hit = h('button', { class: 't14-stone-hit', type: 'button', tabindex: '-1', 'aria-hidden': 'true', onClick: () => step() })
  // the caption panel: the slip of work, the step's name, what happens, the button
  const slip = slipArt()
  const name = h('span', { class: 't14-loop-name' })
  const round = h('span', { class: 't14-loop-round' })
  const text = h('p', { class: 't14-loop-text' })
  const btnTxt = h('span', null, L.step)
  const btn = h('button', { class: 't14-seal', type: 'button', onClick: () => step() }, h('span', { class: 't14-seal-dot', 'aria-hidden': 'true' }), btnTxt)
  const words = h('div', { class: 't14-loop-words', 'aria-live': 'polite' }, h('p', { class: 't14-loop-head' }, name, round, ctx.tag('illustration')), text)
  const panel = h('div', { class: 't14-loop-cap' }, slip.svg, words, btn)
  root.append(h('p', { class: 'visually-hidden' }, L.art), svg, ...Object.values(labs), rep, hit, panel)
  ctx.art.append(root)
  ctx.prompt(L.prompt)
  const artH = stableHeight(ctx, [L.insight])

  let cur = 0
  let started = false
  let walk: gsap.core.Tween | null = null
  let told = false
  /** footprints left on the path: segment (from step i-1 to i) + position along it */
  const prints: { i: number; t: number }[] = []
  let G = { cx: 0, cy: 0, rx: 1, ry: 1, srx: 20, sry: 9, k: 1 }
  let walker: SVGGElement | null = null
  let printsG: SVGGElement | null = null
  let halo: SVGEllipseElement | null = null
  const stoneEls = {} as Record<StoneId, SVGGElement>

  function pos(k: StoneId): Pt {
    const { cx, cy, rx, ry } = G
    if (k === 'goal') return [cx - 0.38 * rx, cy + 0.02 * ry]
    if (k === 'report') return [cx + 0.38 * rx, cy + 0.02 * ry]
    const a = rad(ANG[k]!)
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]
  }
  /** a point on the way from step i-1 to step i */
  function along(i: number, t: number): Pt {
    const from = STEPS[i - 1].at
    const to = STEPS[i].at
    const a0 = ANG[from]
    let a1 = ANG[to]
    if (a0 !== undefined && a1 !== undefined) {
      if (a1 <= a0) a1 += 360
      const a = rad(a0 + (a1 - a0) * t)
      return [G.cx + G.rx * Math.cos(a), G.cy + G.ry * Math.sin(a)]
    }
    const P = pos(from)
    const Q = pos(to)
    const mx = (P[0] + Q[0]) / 2
    const my = (P[1] + Q[1]) / 2
    const dx = Q[0] - P[0]
    const dy = Q[1] - P[1]
    const c: Pt = [mx - dy * 0.22, my + dx * 0.22]
    const u = 1 - t
    return [u * u * P[0] + 2 * u * t * c[0] + t * t * Q[0], u * u * P[1] + 2 * u * t * c[1] + t * t * Q[1]]
  }
  const lift = (p: Pt): Pt => [p[0], p[1] - G.sry * 0.35]

  function build() {
    const W = root.clientWidth
    const H0 = root.clientHeight
    if (!W || !H0) return
    walk?.progress(1)
    const H = artH(H0)
    const col = W / H >= 1.3 && H >= 360
    const wideRow = W / H >= 1.3 && !col
    root.classList.toggle('col', col)
    // the panel first: its size decides how much room the ring gets
    const fs = clamp(Math.min(W, H * 1.6) / 52, 15, 21)
    panel.style.setProperty('--fs', `${fs}px`)
    let ringW: number
    let ringTop: number
    let ringH: number
    if (col || wideRow) {
      const cw = col ? clamp(W * 0.28, 250, 340) : clamp(W * 0.4, 280, 400)
      panel.style.width = `${cw}px`
      panel.style.setProperty('--sw', `${col ? Math.min(cw, 220) : clamp(cw * 0.42, 130, 160)}px`)
      panel.classList.toggle('stack', col)
      const ph = panel.offsetHeight
      Object.assign(panel.style, { left: `${W - cw - 8}px`, top: `${Math.max(0, (H - ph) / 2)}px` })
      ringW = W - cw - 24
      ringTop = 0
      ringH = H
    } else {
      // tall: the ring first, the slip, seal and words under it
      const pw = Math.min(W, 520)
      panel.style.width = `${pw}px`
      panel.style.setProperty('--sw', `${clamp(W * 0.4, 130, 180)}px`)
      panel.classList.remove('stack')
      const ph = panel.offsetHeight
      Object.assign(panel.style, { left: `${(W - pw) / 2}px`, top: `${H - ph}px` })
      ringW = W
      ringTop = 0
      ringH = H - ph - 10
    }
    const labH = fs * 1.6
    let ratio = 0.56
    let rx = Math.min(ringW / 2 - 56, (ringH - 2 * labH - 16) / (2 * 0.707 * ratio + 0.2))
    if (!col && !wideRow) {
      // tall: the ring may stand rounder to use the height
      rx = ringW / 2 - 52
      ratio = clamp((ringH - 2 * labH - 20 - 0.16 * rx) / (1.414 * rx), 0.56, 0.92)
      rx = Math.min(rx, (ringH - 2 * labH - 16) / (2 * 0.707 * ratio + 0.2))
    }
    // a garden path, not a racetrack: big screens keep the ring at a walkable size
    rx = clamp(rx, 60, 520)
    const ry = rx * ratio
    const srx = clamp(rx * 0.15, 22, 70)
    const sry = srx * 0.46
    const k = srx / 50
    G = { cx: ringW / 2, cy: ringTop + ringH / 2, rx, ry, srx, sry, k }
    const { cx, cy } = G

    svg.setAttribute('viewBox', `0 0 ${W} ${H0}`)
    svg.replaceChildren(s('defs', null, dryFilter(),
      s('radialGradient', { id: `${id}-g` }, s('stop', { offset: 0, class: 'gl0' }), s('stop', { offset: 1, class: 'gl2' }))))
    const low = ctx.quality === 'low'
    // dawn beyond the path when there is room above it: far ridges, mist, a pale sun low on the horizon
    const hz = cy - ry - 10
    if (hz > 36) {
      const R = clamp(hz * 0.2, 12, 40)
      const room = hz > 110
      svg.append(skyArt(id, {
        W, hz, sun: room ? [cx + rx * 0.46, hz - R * 0.85] : undefined, R, seed: 3, low,
        ridges: [[-40, cx - rx * 0.1, hz * 0.12, Math.min(70, hz * 0.4), 0.8], [cx + rx * 0.2, W + 40, hz * 0.18, Math.min(96, hz * 0.62), 1]],
      }))
    }
    // straight rakes outside the path, a few rings following it
    const gap = clamp(srx * 0.85, 14, 46)
    const outR = rx + 2.2 * gap
    svg.append(sandArt(id, W, H0, Math.max(0, hz), [[cx, cy, outR, outR * ratio]]))
    svg.append(ringsArt(cx, cy, rx - 1.6 * gap, ratio, 2, 0.8 * gap), ringsArt(cx, cy, rx + 0.8 * gap, ratio, 2, 0.8 * gap))
    // small ripples around the two inner stones
    const rings = s('g')
    for (const kk of ['goal', 'report'] as StoneId[]) {
      const [x, y] = pos(kk)
      const z = SIZE[kk]
      for (let j = 1; j <= 2; j++) rings.append(s('path', { d: ell(x, y + sry * 0.4, srx * z * (1.25 + j * 0.3), sry * z * (1.3 + j * 0.32)), class: 'rk' }))
    }
    svg.append(rings)
    // the path: a faint ink trail on the ring and on the two side paths
    const trail = s('g', { class: 't14-trail' })
    trail.append(s('path', { d: ell(cx, cy, rx, ry), class: 'path' }))
    for (const [a, b] of [['goal', 'plan'], ['observe', 'report']] as StoneId[][]) {
      const i = STEPS.findIndex((st, j) => j > 0 && STEPS[j - 1].at === a && st.at === b)
      const pts = Array.from({ length: 13 }, (_, j) => along(i, j / 12))
      trail.append(s('path', { d: `M${pts.map((p) => p.map((v) => v.toFixed(1)).join(' ')).join('L')}`, class: 'path' }))
    }
    // direction chevrons on the ring, between stones
    for (const a of [-90, 0, 90, 180]) {
      const p: Pt = [cx + rx * Math.cos(rad(a)), cy + ry * Math.sin(rad(a))]
      const tx = -rx * Math.sin(rad(a))
      const ty = ry * Math.cos(rad(a))
      const ang = (Math.atan2(ty, tx) * 180) / Math.PI
      const c = clamp(srx * 0.14, 3.5, 7)
      trail.append(s('path', { d: `M${-c} ${-c}L${c * 0.4} 0L${-c} ${c}`, class: 'chev-l', transform: `translate(${p[0].toFixed(1)} ${p[1].toFixed(1)}) rotate(${ang.toFixed(1)})` }))
    }
    svg.append(trail)
    printsG = s('g')
    svg.append(printsG)
    halo = s('ellipse', { rx: srx * 1.35, ry: sry * 1.6, class: 'halo t14-halo' })
    svg.append(halo)
    // the stones, far ones first so the near ones overlap them
    for (const kk of [...IDS].sort((a, b) => pos(a)[1] - pos(b)[1])) {
      const [x, y] = pos(kk)
      const z = SIZE[kk]
      const g = s('g', null, stoneArt(50, 50 * FLAT[kk], SEEDS[kk], MOSS[kk]))
      if (kk === 'goal' || kk === 'report') g.append(s('rect', { x: -5, y: -6, width: 10, height: 10, rx: 2, class: 'v', transform: 'rotate(8)', opacity: kk === 'goal' ? 1 : 0, 'data-seal': kk }))
      stoneEls[kk] = g
      svg.append(s('g', { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${(k * z).toFixed(3)})` }, g))
      const l = labs[kk]
      l.style.setProperty('--fs', `${clamp(fs * 0.86, 13, 18)}px`)
      const above = kk === 'plan' || kk === 'act'
      const half = 50 * FLAT[kk] * k * z
      Object.assign(l.style, { left: `${x}px`, top: `${above ? y - half * 1.3 - fs * 1.2 : y + half * 1.75 + fs * 0.45}px` })
    }
    // "lặp lại" beside the ring's left turn: outside it when there is room, else just under the turn
    Object.assign(rep.style, { left: `${cx - rx - 12}px`, top: `${cy}px`, '--fs': `${clamp(fs * 0.78, 12, 16)}px` })
    rep.style.translate = '-100% -50%'
    if (cx - rx - 12 - rep.offsetWidth < 2) {
      rep.style.translate = '-50% 0'
      rep.style.left = `${cx - rx}px`
      rep.style.top = `${cy + clamp(srx * 0.4, 9, 14)}px`
    }
    // the walker: an ink drop with a warm glow
    walker = s('g', { class: 't14-walker' },
      s('circle', { r: srx * 0.42, class: 'walker-glow' }),
      s('circle', { r: clamp(srx * 0.13, 4, 8), class: 'walker' }))
    svg.append(walker)
    drawPrints()
    settle()
  }

  function drawPrints() {
    if (!printsG) return
    printsG.replaceChildren(...prints.map(({ i, t }) => {
      const [x, y] = along(i, t)
      return s('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: clamp(G.srx * 0.05, 1.4, 2.6), class: 'foot' })
    }))
  }

  /** Everything that follows from `cur`: walker on its stone, labels, slip, halo on the next stone. */
  function settle() {
    const here = STEPS[cur].at
    const p = lift(pos(here))
    walker?.setAttribute('transform', `translate(${p[0].toFixed(1)} ${p[1].toFixed(1)})`)
    for (const kk of IDS) labs[kk].classList.toggle('here', kk === here)
    // before the first press the halo rests on the goal itself: touch it to read the task
    const nxt = started ? STEPS[cur + 1]?.at : here
    if (halo) halo.style.display = nxt ? '' : 'none'
    if (nxt) {
      const [x, y] = pos(nxt)
      const z = SIZE[nxt]
      halo?.setAttribute('cx', x.toFixed(1))
      halo?.setAttribute('cy', (y + G.sry * 0.15).toFixed(1))
      halo?.setAttribute('rx', (G.srx * 1.35 * z).toFixed(1))
      halo?.setAttribute('ry', (G.sry * 1.6 * z).toFixed(1))
      Object.assign(hit.style, { left: `${x}px`, top: `${y}px`, width: `${Math.max(44, G.srx * 2.4 * z)}px`, height: `${Math.max(44, G.sry * 3 * z)}px`, display: '' })
    } else hit.style.display = 'none'
    stoneEls.report?.querySelector('[data-seal]')?.setAttribute('opacity', cur === STEPS.length - 1 ? '1' : '0')
    name.textContent = L.stones[here]
    round.textContent = here === 'goal' || here === 'report' ? '' : fill(L.round, { n: cur <= 4 ? 1 : 2 })
    text.textContent = started ? STEPS[cur].text : ''
    btnTxt.textContent = cur === STEPS.length - 1 ? L.again : L.step
    slip.show(cur)
  }

  function step() {
    if (walk) walk.progress(1)
    if (!started) {
      // the first press only reads the task off the goal stone
      started = true
      root.classList.add('started')
      ctx.chime('soft')
      settle()
      return
    }
    if (cur === STEPS.length - 1) {
      // start over: the trail is raked away
      cur = 0
      prints.length = 0
      drawPrints()
      settle()
      ctx.chime('tap')
      return
    }
    const i = cur + 1
    ctx.chime(STEPS[i].at === 'report' ? 'ok' : 'soft')
    const arrive = () => {
      cur = i
      settle()
      if (!ctx.reduced) gsap.fromTo([text, slip.svg], { opacity: 0.2, filter: 'blur(3px)' }, { opacity: 1, filter: 'blur(0px)', duration: 0.7, ease: 'power2.out', clearProps: 'filter' })
      if (STEPS[i].at === 'report' && !told) {
        told = true
        ctx.insight(L.insight, L.detail)
      }
    }
    const n = 14
    if (ctx.reduced) {
      for (let j = 1; j < n; j++) prints.push({ i, t: j / n })
      drawPrints()
      arrive()
      return
    }
    const o = { t: 0 }
    let dropped = 0
    ctx.anim(() => {
      walk = gsap.to(o, {
        t: 1,
        duration: 1.25,
        ease: 'power1.inOut',
        onUpdate: () => {
          const p = lift(along(i, o.t))
          walker?.setAttribute('transform', `translate(${p[0].toFixed(1)} ${p[1].toFixed(1)})`)
          while (dropped < n - 1 && o.t >= (dropped + 1) / n) {
            dropped++
            prints.push({ i, t: dropped / n })
            const [x, y] = along(i, dropped / n)
            printsG?.append(s('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: clamp(G.srx * 0.05, 1.4, 2.6), class: 'foot' }))
          }
        },
        onComplete: () => {
          walk = null
          arrive()
          const st = stoneEls[STEPS[i].at]
          if (st) gsap.fromTo(st, { y: 0 }, { y: 2, duration: 0.18, yoyo: true, repeat: 1, ease: 'power1.out' })
        },
      })
    })
  }

  const stop = onLayout(root, build)
  build()
  return () => {
    stop()
    walk?.kill()
  }
}

/** The slip of work in the panel: Friday, two time slots, five people. */
function slipArt() {
  const dots = (y: number) => [0, 1, 2, 3, 4].map((i) => s('circle', { cx: 82 + i * 19, cy: y, r: 5, class: 'free' }))
  const d9 = dots(52)
  const d14 = dots(86)
  const band9 = s('rect', { x: 68, y: 40, width: 108, height: 24, rx: 6, class: 'band', opacity: 0 })
  const band14 = s('rect', { x: 68, y: 74, width: 108, height: 24, rx: 6, class: 'band', opacity: 0 })
  const ptr9 = s('path', { d: 'M56 47l7 5-7 5z', class: 'busy', opacity: 0 })
  const ptr14 = s('path', { d: 'M56 81l7 5-7 5z', class: 'busy', opacity: 0 })
  const strike = s('path', { d: 'M66 53Q118 49 178 52', class: 'strike', opacity: 0 })
  const tick = s('path', { d: 'M167 86l3 3 6-7', class: 'tick', opacity: 0 })
  const seal = s('g', { opacity: 0, transform: 'translate(170 20) rotate(-8)' }, s('rect', { x: -13, y: -13, width: 26, height: 26, rx: 5, class: 'busy' }), s('path', { d: 'M-6 0l4 4 8-9', class: 'seal-tick' }))
  const svg = s('svg', { class: 't14-slip', viewBox: '0 0 184 120', 'aria-hidden': 'true' },
    s('rect', { x: 1, y: 1, width: 182, height: 118, rx: 10, class: 'frame' }),
    s('text', { x: 14, y: 24, 'font-size': 14.5, class: 'ttl' }, L.task),
    s('path', { d: 'M14 32H170', class: 'rule' }),
    band9, band14,
    s('text', { x: 12, y: 57, 'font-size': 13.5, class: 'time' }, L.slots[0]),
    s('text', { x: 12, y: 91, 'font-size': 13.5, class: 'time' }, L.slots[1]),
    ptr9, ptr14, ...d9, ...d14, strike, tick, seal)
  const show = (i: number) => {
    const op = (el: Element, on: boolean) => el.setAttribute('opacity', on ? '1' : '0')
    op(ptr9, i === 1 || i === 2)
    op(band9, i >= 2 && i <= 3)
    op(strike, i >= 4)
    op(ptr14, i === 5 || i === 6)
    op(band14, i >= 6)
    op(tick, i >= 7)
    op(seal, i >= 8)
    d9.forEach((c, j) => c.setAttribute('class', i >= 3 ? (j === 1 ? 'busy' : 'ok') : 'free'))
    d14.forEach((c) => c.setAttribute('class', i >= 7 ? 'ok' : 'free'))
  }
  return { svg, show }
}
