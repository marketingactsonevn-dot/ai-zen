import { h, nextId, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { C } from './data'
import { drawLantern, lanternLight } from './lantern'
import { dryH, mossIsland, rakeLines } from './garden'
import { afterFonts, blob, clamp, lerp, ring, rng, stableHeight, stoneArt, stroke, type Pt } from './ink'

const VB = { w: 272, h: 232 }
const LX = 184
const LY = 204
const LH = 172

/** A flat stepping stone seen from a little above, drawn in ink (viewBox units). */
function flatStone(cx: number, cy: number, rx: number, seed: number) {
  const ry = rx * 0.34
  return s('g', { class: 't12c-step' },
    s('path', { class: 't12-st-shadow', d: blob(cx + rx * 0.08, cy + ry * 0.5, rx * 1.02, ry * 0.75, seed + 5, 0.1, 14) }),
    s('path', { class: 't12-st-base', d: blob(cx, cy, rx, ry, seed, 0.1, 16) }),
    s('path', { class: 't12-st-hi', d: blob(cx - rx * 0.15, cy - ry * 0.25, rx * 0.62, ry * 0.42, seed + 2, 0.18, 12) }),
    s('path', { class: 't12-st-low', d: stroke([[cx - rx * 0.92, cy + ry * 0.1], [cx, cy + ry * 0.95], [cx + rx * 0.92, cy + ry * 0.05]], rx * 0.1, { head: 0.2, tail: 0.6, min: 0.2 }) }))
}

/**
 * A red-ink loop drawn round a phrase, in the phrase's own pixels (w × hgt): a stadium with real room at the ends,
 * so no letter sits under the stroke, drawn as one pen movement that overshoots its start and lifts off.
 */
function handLoop(w: number, hgt: number, fs: number, seed: number) {
  const r = rng(seed)
  const top = -0.12 * fs
  const bot = hgt + 0.1 * fs
  const cy = (top + bot) / 2
  const cx = w / 2
  const R = (bot - top) / 2
  const xl = -0.36 * fs + R
  const xr = w + 0.36 * fs - R
  const L = Math.max(0, xr - xl)
  const T = 2 * L + 2 * Math.PI * R
  // the long sides bow out a little, the way a hand does it
  const bow = (x: number) => Math.sin(((x - xl) / Math.max(1, L)) * Math.PI) * 0.1 * fs
  const at = (u: number): Pt => {
    let d = (((u % 1) + 1) % 1) * T
    if (d < L) return [xl + d, top - bow(xl + d)]
    d -= L
    if (d < Math.PI * R) return [xr + R * Math.sin(d / R) * 1.06, cy - R * Math.cos(d / R)]
    d -= Math.PI * R
    if (d < L) return [xr - d, bot + bow(xr - d) * 0.7]
    d -= L
    return [xl - R * Math.sin(d / R) * 1.06, cy + R * Math.cos(d / R)]
  }
  const ph = r() * 6
  const tilt = (-1.2 * Math.PI) / 180
  const pts: Pt[] = []
  // one pen movement: starts on the top a little in from the left, goes round, overshoots and lifts upward
  const u0 = 0.04 + r() * 0.03
  const u1 = u0 + 1.13
  for (let i = 0; i <= 72; i++) {
    const u = u0 + ((u1 - u0) * i) / 72
    const spiral = (u - u0) * 0.09 * fs
    let [x, y] = at(u)
    const nx = x - cx
    const ny = y - cy
    const len = Math.hypot(nx / Math.max(1, w / 2 + R), ny / R) || 1
    x += (nx / len / Math.max(1, w / 2 + R)) * spiral * 0.6
    y += (ny / len / R) * spiral + Math.sin(u * 17 + ph) * 0.025 * fs
    pts.push([cx + (x - cx) * Math.cos(tilt) - (y - cy) * Math.sin(tilt), cy + (x - cx) * Math.sin(tilt) + (y - cy) * Math.cos(tilt)])
  }
  // pressure: heavy along the bottom and the far end, light across the top, a dry lift at the finish
  const press = (t: number) => 0.55 + 0.55 * Math.max(0, Math.sin((t - 0.08) * Math.PI * 1.8)) ** 1.4
  return stroke(pts, Math.max(1.8, fs * 0.15), { head: 0.04, tail: 0.9, min: 0.18, press })
}

/** One garden vignette: the lantern on its moss island, raked sand fading out, and the stones of this prompt. */
function vignette(uid: string, stones: number, lowQ: boolean) {
  const svg = s('svg', { class: 't12c-art', viewBox: `0 0 ${VB.w} ${VB.h}`, preserveAspectRatio: 'xMidYMax meet', 'aria-hidden': 'true' })
  const fadeId = `${uid}-f`
  const lant = drawLantern(LX, LY, LH, lowQ)
  const light = lanternLight(uid, lant, LX, LY, LH, svg)
  svg.append(s('defs', null,
    dryH(),
    s('radialGradient', { id: `${fadeId}g`, cx: 0.58, cy: 0.62, r: 0.62 }, s('stop', { offset: 0.35, 'stop-color': '#fff' }), s('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 })),
    s('mask', { id: fadeId, maskUnits: 'userSpaceOnUse', x: -40, y: 120, width: VB.w + 80, height: 140 }, s('rect', { x: -40, y: 120, width: VB.w + 80, height: 140, fill: `url(#${fadeId}g)` }))))
  const isle = LH * 0.36
  const holeId = `${uid}-h`
  svg.append(s('defs', null, s('mask', { id: holeId, maskUnits: 'userSpaceOnUse', x: -40, y: 0, width: VB.w + 80, height: VB.h + 40 },
    s('rect', { x: -40, y: 0, width: VB.w + 80, height: VB.h + 40, fill: '#fff' }),
    s('ellipse', { cx: LX, cy: LY, rx: isle * 1.5, ry: isle * 1.5 * 0.3, fill: '#000' }))))
  svg.append(s('g', { mask: `url(#${fadeId})` }, s('g', { mask: `url(#${holeId})` }, rakeLines(-30, VB.w + 30, 150, VB.h + 4, 0.55, 7))))
  const rings = s('g', { filter: lowQ ? null : 'url(#ink-rough)' })
  for (let k = 1; k <= 3; k++) rings.append(s('path', { class: 't12-ring', d: ring(LX, LY, isle * (1 + k * 0.14), isle * (1 + k * 0.14) * 0.3, lerp(0.9, 1.3, k / 3), 70 + k) }))
  svg.append(rings, mossIsland(LX + 3, LY + 1, isle * 0.92, isle * 0.92 * 0.3, lowQ), ...light.under, lant.g, ...light.over)
  // the stepping stones of this prompt, coming towards the lantern from the near left
  const g = s('g', { filter: lowQ ? null : 'url(#ink-rough)' })
  // six stones: a zigzag (chidori) path that recedes from the near left to the lantern's moss island
  const path: [number, number, number][] = [[24, 222, 20], [56, 211, 18.5], [82, 223.5, 17], [104, 210.5, 15.5], [122, 220, 14.5], [136, 208.5, 13.5]]
  // (the vague prompt has a single stone, lost halfway: no path leads to its lantern)
  const used = stones === 1 ? [path[2]] : path.slice(0, stones)
  for (let k = used.length - 1; k >= 0; k--) {
    const [x, y, rx] = used[k]
    g.append(flatStone(x, y, rx, k * 5 + 3))
  }
  svg.append(g)
  return { svg, light }
}

/**
 * Scene 2 — "Hai lời nhờ": the same garden twice. One stone vs six stones; the visitor sends both requests to the
 * same AI with the stone in the middle; one lantern barely glows, the other lights up; the replies are brushed
 * onto paper, and red ink circles what went wrong in the vague one.
 */
export function compareScene(ctx: SceneCtx) {
  const T = C.scenes.compare
  const B = C.scenes.path.blocks
  const lowQ = ctx.quality === 'low'
  const uid = nextId('t12c')
  const stable = stableHeight(ctx, [[T.insight, T.detail]])

  // a sheet of rice paper: deckled edges, a faint wash along the rim (stretched to the paper's box)
  const sheet = (seed: number) => {
    const r = rng(seed)
    const edge = (y: number, amp: number, from: number, to: number) => {
      const pts: string[] = []
      const n = 44
      for (let i = 0; i <= n; i++) pts.push(`${(from + ((to - from) * i) / n).toFixed(2)} ${(y + (r() - 0.5) * amp + Math.sin(i * 0.9 + seed) * amp * 0.3).toFixed(2)}`)
      return pts
    }
    const top = edge(0.9, 1.6, 0.3, 99.7)
    const bot = edge(99.2, 1.1, 99.7, 0.3)
    const d = `M${top.join('L')}L${(99.7 + (r() - 0.5) * 0.3).toFixed(2)} 50L${bot.join('L')}L${(0.3 + (r() - 0.5) * 0.3).toFixed(2)} 50Z`
    return s('svg', { class: 't12c-sheet', viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
      s('path', { class: 't12c-sheet-p', d }),
      s('path', { class: 't12c-sheet-e', d, 'vector-effect': 'non-scaling-stroke' }))
  }
  // before sending: the paper lies in a morning mist, a few pale dry-brush bands
  const mist = (seed: number) => {
    const svg = s('svg', { viewBox: '0 0 100 60', preserveAspectRatio: 'none', 'aria-hidden': 'true' })
    const g = s('g', { filter: lowQ ? null : 'url(#t12-dryh)' })
    const bands: [number, number, number, number][] = [[4, 16, 92, 11], [14, 33, 98, 12], [0, 49, 74, 9]]
    bands.forEach(([x0, y, x1, w], i) => {
      const k = (seed * 7 + i * 3) % 5
      const pts: Pt[] = [[x0 + k, y], [(x0 + x1) / 2, y + (i % 2 ? 1.5 : -1.5)], [x1 - k, y + 0.5]]
      g.append(s('path', { class: 't12c-fog', d: stroke(pts, w, { head: 0.18, tail: 0.5, min: 0.3, wob: 0.08 }) }))
    })
    svg.append(g)
    return h('div', { class: 't12c-mist' }, svg, h('span', { class: 't12c-wait' }, T.waiting))
  }

  // ── weak column
  const weakArt = vignette(`${uid}w`, 1, lowQ)
  const flags: { el: HTMLElement; svg: SVGSVGElement; path: SVGPathElement; seed: number }[] = []
  const weakReply = h('p', { class: 't12c-reply' }, ...T.weakReply.map((p) => {
    if (!p.flag) return p.t
    const path = s('path')
    const loop = s('svg', { class: 't12c-loop', 'aria-hidden': 'true' }, path)
    const el = h('span', { class: 't12c-flag' }, p.t, loop)
    flags.push({ el, svg: loop, path, seed: p.t.length * 7 })
    return el
  }))
  const notes = h('p', { class: 't12c-notes' }, h('span', { class: 'visually-hidden' }, T.flagNote + ': '),
    ...T.weakReply.filter((p) => p.flag).map((p) => h('span', { class: 't12c-note' }, h('i', { 'aria-hidden': 'true' }), p.flag)))
  const weakPaper = h('div', { class: 't12c-paper' }, sheet(3), h('p', { class: 't12c-from' }, T.reply), h('div', { class: 't12c-body' }, weakReply, notes), mist(1))
  const weak = h('section', { class: 't12c-col weak', 'aria-label': T.weakTitle },
    weakArt.svg,
    h('div', { class: 't12c-label' }, h('h3', { class: 't12c-title' }, T.weakTitle), h('p', { class: 't12c-ask' }, `“${T.weakPrompt}”`)),
    weakPaper)

  // ── strong column
  const strongArt = vignette(`${uid}s`, 6, lowQ)
  const tagged = (line: string) => line.split(/(#\S+)/).map((part) => (part.startsWith('#') ? h('span', { class: 't12c-tag' }, part) : part))
  const strongReply = h('div', { class: 't12c-reply' }, ...T.strongReply.map((line) => h('p', { class: 't12c-line' }, ...tagged(line))))
  const strongPaper = h('div', { class: 't12c-paper' }, sheet(8), h('p', { class: 't12c-from' }, T.reply), h('div', { class: 't12c-body' }, strongReply), mist(2))
  const popId = nextId('t12c-pop')
  // the whole strong prompt, unrolled like a sheet over the garden
  const close = h('button', { class: 't12c-close', type: 'button' }, T.hidePrompt)
  const pop = h('div', { class: 't12c-pop', id: popId, role: 'region', 'aria-label': T.strongTitle, hidden: true },
    sheet(11),
    h('div', { class: 't12c-pop-top' }, h('p', { class: 't12c-pop-h' }, T.strongTitle), close),
    h('ol', null, ...B.map((b) => h('li', null, h('span', { class: 't12c-pop-n' }, b.title), h('span', { class: 't12c-pop-x' }, b.example)))))
  const more = h('button', { class: 't12c-more', type: 'button', 'aria-expanded': 'false', 'aria-controls': popId }, T.showPrompt)
  const togglePop = (open = pop.hidden) => {
    pop.hidden = !open
    more.setAttribute('aria-expanded', String(open))
    if (open) {
      // the sheet may spread over the insight below the garden; its type is as large as fits, never below 12px
      const foot = ctx.el.querySelector<HTMLElement>('.scene-foot')
      const room = (foot ? foot.getBoundingClientRect().bottom : root.getBoundingClientRect().bottom) - root.getBoundingClientRect().top
      pop.style.setProperty('--popMax', `${Math.max(root.offsetHeight, room).toFixed(0)}px`)
      let pf = 16
      pop.style.setProperty('--pfs', `${pf}px`)
      while (pop.scrollHeight > pop.clientHeight + 1 && pf > 12) pop.style.setProperty('--pfs', `${(pf -= 0.5)}px`)
      close.focus({ preventScroll: true })
      if (!ctx.reduced) ctx.anim(() => gsap.fromTo(pop, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }))
    } else more.focus({ preventScroll: true })
  }
  more.addEventListener('click', () => togglePop())
  close.addEventListener('click', () => togglePop(false))
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !pop.hidden) togglePop(false)
  }
  addEventListener('keydown', onKey)
  const strong = h('section', { class: 't12c-col strong', 'aria-label': T.strongTitle },
    strongArt.svg,
    h('div', { class: 't12c-label' }, h('h3', { class: 't12c-title' }, T.strongTitle), more),
    strongPaper)

  // ── the stone in the middle: send both to the same AI
  const ripple = h('span', { class: 't12c-ripple', 'aria-hidden': 'true' }, h('i'), h('i'))
  const send = h('button', { class: 't12-stone t12c-send', type: 'button', 'aria-label': T.send },
    ripple, h('span', { class: 't12-stone-body' }, stoneArt(41), h('span', { class: 't12-word' }, T.sendText)))
  const status = h('p', { class: 'visually-hidden', 'aria-live': 'polite' })
  const root = h('div', { class: 't12 t12c' }, h('div', { class: 't12c-cols' }, weak, send, strong), pop, status)
  ctx.art.append(root)
  ctx.prompt(T.prompt)

  // ── layout: three arrangements; the font shrinks until both papers hold their reply
  function layout() {
    const r = ctx.art.getBoundingClientRect()
    const W = r.width
    const H = stable.H(r.height)
    root.style.height = `${H}px`
    const mode = W / H < 1.3 ? 'port' : H < 330 ? 'compact' : 'land'
    root.dataset.mode = mode
    const artH = mode === 'port' ? clamp(H * 0.36, 96, 280) : mode === 'compact' ? H : clamp(H * 0.52, 150, 460)
    root.style.setProperty('--artH', `${artH.toFixed(0)}px`)
    let fs = mode === 'land' ? clamp(W / 68, 15, 20) : mode === 'port' ? clamp(W / 26, 12.5, 16) : 13.5
    const papers = [weakPaper, strongPaper]
    const labels = [...root.querySelectorAll<HTMLElement>('.t12c-label')]
    const over = () => {
      // both titles take the same height, so the two papers start on one line
      labels.forEach((l) => (l.style.minHeight = ''))
      const lh = Math.max(...labels.map((l) => l.offsetHeight))
      labels.forEach((l) => (l.style.minHeight = `${lh}px`))
      const wr = weakPaper.querySelector<HTMLElement>('.t12c-body')!.getBoundingClientRect().right
      return flags.some((f) => f.el.getBoundingClientRect().right > wr + 2) || papers.some((p) => {
        const b = p.querySelector<HTMLElement>('.t12c-body')!
        return b.scrollHeight > b.clientHeight + 1
      })
    }
    root.style.setProperty('--fs', `${fs}px`)
    papers.forEach((p) => (p.style.minHeight = ''))
    const floor = mode === 'land' ? 13 : mode === 'port' ? 11.5 : 12.5
    while (over() && fs > floor) {
      fs -= 0.5
      root.style.setProperty('--fs', `${fs}px`)
    }
    // the red loops, drawn for the phrases' real size
    for (const f of flags) {
      const w = f.el.offsetWidth
      const hh = f.el.offsetHeight
      f.svg.setAttribute('viewBox', `0 0 ${w} ${hh}`)
      f.path.setAttribute('d', handLoop(w, hh, fs, f.seed))
    }
    // two sheets of the same size
    const ph = Math.max(...papers.map((p) => p.offsetHeight))
    papers.forEach((p) => (p.style.minHeight = `${ph}px`))
    // portrait: the send stone sits between the requests and the replies, clear of both gardens
    if (mode === 'port') {
      const lb = labels[0].getBoundingClientRect().bottom - root.getBoundingClientRect().top
      send.style.top = `${(lb + (papers[0].getBoundingClientRect().top - root.getBoundingClientRect().top - lb) / 2).toFixed(1)}px`
    } else send.style.top = ''
  }
  const ro = new ResizeObserver(() => layout())
  ro.observe(ctx.art)
  layout()
  afterFonts(ctx, () => (stable.reset(), layout()))

  // ── sending
  const lv = { w: 0, s: 0 }
  const apply = () => (weakArt.light.set(lv.w), strongArt.light.set(lv.s))
  apply()
  const flicks: gsap.core.Tween[] = []
  let sent = false
  const doSend = () => {
    ctx.chime('tap')
    root.classList.add('sent')
    status.textContent = T.done
    const finish = () => {
      if (!sent) ctx.insight(T.insight, T.detail)
      sent = true
    }
    if (ctx.reduced) {
      lv.w = 1 / 6
      lv.s = 1
      apply()
      root.querySelectorAll<HTMLElement>('.t12c-mist').forEach((m) => (m.style.opacity = '0'))
      return finish()
    }
    ctx.anim(() => {
      flicks.forEach((t) => t.kill())
      if (!lowQ)
        for (const a of [weakArt, strongArt])
          flicks.push(gsap.to(a.light.flick, { rotation: 'random(-4, 4)', y: 'random(-0.6, 0.6)', duration: 0.24, repeat: -1, yoyo: true, repeatRefresh: true, ease: 'sine.inOut', svgOrigin: a.light.origin }))
      const mists = root.querySelectorAll('.t12c-mist')
      const tl = gsap.timeline({ onComplete: finish })
      tl.set(lv, { w: 0, s: 0, onUpdate: apply })
        .fromTo(ripple.children, { scale: 0.4, opacity: 0.9 }, { scale: 3.2, opacity: 0, duration: 1.6, ease: 'power2.out', stagger: 0.25 }, 0)
        .to(lv, { w: 1 / 6, duration: 1.2, ease: 'power2.out', onUpdate: apply }, 0.3)
        .to(lv, { s: 1, duration: 2, ease: 'power2.out', onUpdate: apply }, 0.3)
        .fromTo(mists, { opacity: 1, scale: 1, filter: 'blur(0px)' }, { opacity: 0, scale: 1.08, filter: 'blur(6px)', duration: 1.1, ease: 'power2.inOut' }, 0.4)
        .fromTo(weakReply, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 -4% 0 0)', duration: 1.1, ease: 'power1.inOut' }, 0.7)
        .fromTo(strongReply.children, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 -4% 0 0)', duration: 1.3, ease: 'power1.inOut', stagger: 0.7 }, 0.9)
        .fromTo(flags.map((f) => f.svg), { clipPath: 'inset(-60% 100% -60% -20%)', opacity: 1 }, { clipPath: 'inset(-60% -20% -60% -20%)', duration: 0.7, ease: 'power2.out', stagger: 0.35, clearProps: 'clipPath' }, 2.1)
        .fromTo(notes, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, 2.7)
    })
  }
  send.addEventListener('click', doSend)

  return () => {
    ro.disconnect()
    removeEventListener('keydown', onKey)
    flicks.forEach((t) => t.kill())
  }
}
