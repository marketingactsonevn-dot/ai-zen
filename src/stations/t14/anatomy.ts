import { h, nextId, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx, SceneDef } from '../types'
import { C, type Part } from './data'
import { armArt, armShape, brainArt, clamp, deskArt, fenceArt, handTool, paperLantern, pineArt, ropeStoneArt, scrollArt, stoneLantern, type Pt } from './art'
import { glowDefs, onLayout, stableHeight } from './kit'

const A = C.scenes.anatomy
type Id = Part['id']
type Dir = 't' | 'b' | 'l' | 'r'
type Rect = [number, number, number, number]
/** what each hand holds: up-left, down-left (on the laptop), down-right (on the files), up-right */
const TOOLS = ['search', 'click', 'file', 'mail'] as const

interface Hand {
  /** where the brush tip touches */
  tip: Pt
  /** the tool it holds: x, y, scale */
  tool: [number, number, number]
  /** which way the arm bows */
  bend: number
}

/** One composition of the garden, in design units. */
interface Comp {
  w: number
  h: number
  sand: number
  pine: [number, number, number]
  lantern: [number, number, number]
  toro: Pt
  brain: Pt
  hands: Hand[]
  scroll: [number, number, number]
  desk: [number, number, number]
  fence: [number, number, number]
  rope: Pt
  rect: Record<Id, Rect>
  lab: Record<Id, [number, number, Dir]>
  /** where the "not read yet" seed sits on each part */
  seed: Record<Id, Pt>
}

// The agent sits at its low desk like a person at work: head (the brain) above the laptop, two hands
// on the desk (laptop, files), two raised (search, mail).
const WIDE: Comp = {
  w: 1080,
  h: 500,
  sand: 438,
  pine: [-30, 40, 340],
  lantern: [205, 172, 122],
  toro: [112, 430],
  brain: [540, 218],
  hands: [
    { tip: [394, 134], tool: [366, 112, 1.9], bend: 0.14 },
    { tip: [532, 347], tool: [572, 314, 1.25], bend: 0.04 },
    { tip: [646, 326], tool: [664, 300, 1.6], bend: -0.16 },
    { tip: [708, 160], tool: [730, 146, 1.9], bend: -0.14 },
  ],
  scroll: [884, 104, 1],
  desk: [540, 352, 1],
  fence: [806, 430, 248],
  rope: [772, 432],
  rect: {
    brain: [466, 160, 148, 104],
    hands: [330, 70, 420, 290],
    short: [162, 116, 86, 124],
    long: [62, 290, 100, 146],
    plan: [772, 52, 224, 104],
    env: [376, 262, 328, 180],
    fence: [748, 326, 316, 114],
  },
  lab: {
    brain: [540, 154, 't'],
    hands: [366, 152, 'b'],
    short: [154, 190, 'l'],
    long: [168, 360, 'r'],
    plan: [884, 162, 'b'],
    env: [540, 450, 'b'],
    fence: [930, 320, 't'],
  },
  seed: {
    brain: [568, 196],
    hands: [446, 147],
    short: [205, 172],
    long: [112, 360],
    plan: [884, 104],
    env: [600, 300],
    fence: [930, 390],
  },
}

const TALL: Comp = {
  w: 560,
  h: 620,
  sand: 478,
  pine: [-30, 40, 230],
  lantern: [100, 116, 74],
  toro: [86, 600],
  brain: [280, 272],
  hands: [
    { tip: [160, 214], tool: [136, 194, 1.7], bend: 0.14 },
    { tip: [270, 394], tool: [300, 362, 1.1], bend: 0.04 },
    { tip: [372, 376], tool: [388, 352, 1.4], bend: -0.16 },
    { tip: [410, 232], tool: [430, 220, 1.7], bend: -0.14 },
  ],
  scroll: [404, 70, 0.84],
  desk: [280, 398, 0.9],
  fence: [300, 600, 228],
  rope: [262, 602],
  rect: {
    brain: [206, 214, 148, 106],
    hands: [104, 166, 352, 236],
    short: [66, 72, 70, 110],
    long: [36, 458, 104, 150],
    plan: [316, 30, 178, 82],
    env: [138, 316, 284, 160],
    fence: [236, 498, 304, 112],
  },
  lab: {
    brain: [280, 208, 't'],
    hands: [132, 232, 'b'],
    short: [134, 116, 'r'],
    long: [86, 454, 't'],
    plan: [404, 112, 'b'],
    env: [408, 446, 'r'],
    fence: [420, 498, 't'],
  },
  seed: {
    brain: [304, 250],
    hands: [197, 221],
    short: [100, 116],
    long: [86, 540],
    plan: [404, 70],
    env: [300, 350],
    fence: [414, 560],
  },
}

const overlap = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]))
const box = (el: HTMLElement): Rect => [el.offsetLeft, el.offsetTop, el.offsetWidth, el.offsetHeight]
/** top-left of a w × h box placed on side `dir` of the point x, y */
function beside(dir: Dir, x: number, y: number, w: number, hh: number, gap = 6): Pt {
  return [dir === 'r' ? x + gap : dir === 'l' ? x - gap - w : x - w / 2, dir === 'b' ? y + gap : dir === 't' ? y - gap - hh : y - hh / 2]
}

/** Scene 2 — the anatomy of an agent as one garden picture; touch each part to name it. */
export const anatomyScene: SceneDef = { label: A.label, mount }

function mount(ctx: SceneCtx) {
  const id = nextId('t14a')
  const parts = A.parts
  const root = h('div', { class: 't14 t14-ana' })
  const svg = s('svg', { class: 't14-svg', 'aria-hidden': 'true' })
  const live = h('p', { class: 'visually-hidden', 'aria-live': 'polite' })
  const labs = parts.map((p) =>
    h('div', { class: 't14-lab', 'aria-hidden': 'true' }, h('span', { class: 't14-lab-name' }, p.name), h('span', { class: 't14-lab-sub' }, p.sub), h('span', { class: 't14-lab-text' }, p.text)))
  const seeds = parts.map(() => h('span', { class: 't14-seed', 'aria-hidden': 'true' }))
  const hots = parts.map((p, i) => h('button', { class: 't14-hot', type: 'button', 'aria-pressed': 'false', 'aria-label': `${p.name}: ${p.sub}`, onClick: () => pick(i) }))
  const group = h('div', { role: 'group', 'aria-label': A.group }, ...hots)
  root.append(h('p', { class: 'visually-hidden' }, A.art), svg, group, ...seeds, ...labs, live)
  ctx.art.append(root)
  ctx.prompt(A.prompt)
  const artH = stableHeight(ctx, [A.insight])

  const read = new Set<number>()
  let sel = -1
  let first = true
  let geo = { ox: 0, oy: 0, k: 1, W: 0, H: 0, comp: WIDE }
  let groups = {} as Record<Id, SVGGElement[]>
  let glow: SVGEllipseElement | null = null
  let rip: SVGGElement | null = null
  let ambient: gsap.core.Tween[] = []

  group.addEventListener('keydown', (e) => {
    const i = hots.indexOf(e.target as HTMLButtonElement)
    if (i < 0) return
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!d) return
    e.preventDefault()
    hots[(i + d + hots.length) % hots.length].focus()
  })

  function build() {
    const W = root.clientWidth
    const H0 = root.clientHeight
    if (!W || !H0) return
    const H = artH(H0)
    const comp = W / H >= 1.25 ? WIDE : TALL
    const k = Math.min(W / comp.w, H / comp.h)
    const ox = (W - comp.w * k) / 2
    const oy = (H - comp.h * k) / 2
    geo = { ox, oy, k, W, H, comp }
    const c = comp

    svg.setAttribute('viewBox', `0 0 ${W} ${H0}`)
    svg.replaceChildren(glowDefs(id))
    const defs = svg.firstChild as SVGDefsElement
    const world = s('g', { transform: `translate(${ox.toFixed(1)} ${oy.toFixed(1)}) scale(${k.toFixed(4)})` })
    svg.append(world)
    const X0 = -ox / k
    const X1 = (W - ox) / k
    const Y1 = (H0 - oy) / k

    // raked sand in front, a soft horizon behind
    defs.append(
      s('linearGradient', { id: `${id}-sv`, x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, class: 'sw0' }), s('stop', { offset: 0.35, class: 'sw1' })),
      s('linearGradient', { id: `${id}-sh`, x1: 0, y1: 0, x2: 1, y2: 0 }, s('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 0 }), s('stop', { offset: 0.08, 'stop-color': '#fff' }), s('stop', { offset: 0.92, 'stop-color': '#fff' }), s('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 })),
      s('mask', { id: `${id}-sm`, maskContentUnits: 'objectBoundingBox' }, s('rect', { width: 1, height: 1, fill: `url(#${id}-sh)` })))
    world.append(s('rect', { x: X0, y: c.sand - 34, width: X1 - X0, height: Y1 - c.sand + 34, fill: `url(#${id}-sv)`, mask: `url(#${id}-sm)` }))
    const rk = s('g', { mask: `url(#${id}-sm)` })
    for (let y = c.sand, n = 0; y < Y1 + 4; n++) {
      const pts: string[] = []
      for (let x = X0 - 10; x <= X1 + 24; x += 24) pts.push(`${x.toFixed(0)} ${(y + 1.2 * Math.sin(x / 47 + n * 0.8)).toFixed(1)}`)
      const d = `M${pts.join('L')}`
      rk.append(s('path', { d, class: 'rk', 'stroke-width': 1.2 / k }), s('path', { d, class: 'rk-hi', 'stroke-width': 1.2 / k, transform: `translate(0 ${1.4 / k})` }))
      y += (7 + 6 * (n / 8)) / Math.max(0.6, k)
    }
    world.append(rk)

    const at = (x: number, y: number, sc = 1) => `translate(${x} ${y}) scale(${sc})`
    groups = {} as Record<Id, SVGGElement[]>
    const part = (pid: Id, ...kids: SVGElement[]) => {
      const inner = s('g', { class: 't14-part', 'data-part': pid }, ...kids)
      ;(groups[pid] ??= []).push(inner)
      return s('g', { class: 't14-in' }, inner)
    }
    glow = s('ellipse', { cx: 0, cy: 0, rx: 1, ry: 1, fill: `url(#${id}-glow)`, opacity: 0 })
    rip = s('g', { class: 't14-rip' })
    world.append(glow)

    // memory: the paper lantern hangs from a pine branch; the stone lantern stands on the ground
    const pine = s('g', { class: 't14-part', transform: at(c.pine[0], c.pine[1]) }, pineArt(c.pine[2]))
    const lan = paperLantern(c.lantern[2])
    lan.glow.setAttribute('fill', `url(#${id}-lamp)`)
    world.append(pine)
    const order: SVGElement[] = [
      part('long', s('g', { transform: at(c.toro[0], c.toro[1]) }, stoneLantern())),
      part('short', s('g', { transform: at(c.lantern[0], c.lantern[1]) }, lan.g)),
      part('fence', s('g', { transform: at(c.fence[0], c.fence[1]) }, fenceArt(c.fence[2])), s('g', { transform: at(c.rope[0], c.rope[1]) }, ropeStoneArt())),
    ]
    // arms: drawn before the brain and the desk, so they come out from behind the head and around the laptop
    const [bx, by] = c.brain
    // the typing hand reaches behind the laptop screen: only its brush tip shows, on the keyboard
    const wash = s('g', { filter: 'url(#ink-wash)' })
    const ink = s('g', { filter: 'url(#ink-rough)' })
    const hair = s('g', { opacity: 0.7 })
    const held = s('g')
    const draws: SVGPathElement[] = []
    const hands: SVGGElement[] = []
    c.hands.forEach(({ tip, tool, bend }, i) => {
      const ux = tip[0] - bx
      const uy = tip[1] - by
      const ul = Math.hypot(ux, uy)
      const S0: Pt = [bx + (ux / ul) * 50, by + (uy / ul) * 32]
      const a = armArt(armShape(S0, tip, 12.5, bend), 12.5, `${id}-h${i}`)
      defs.append(a.mask)
      draws.push(a.m)
      wash.append(a.wash)
      ink.append(a.body)
      hair.append(...a.hairs)
      const hand = s('g', null, s('g', { transform: at(tool[0], tool[1], tool[2]) }, handTool(TOOLS[i])), s('g', { filter: 'url(#ink-rough)' }, a.hand))
      held.append(hand)
      hands.push(hand)
    })
    order.push(part('hands', wash, ink, hair))
    const bglow = s('ellipse', { cx: bx, cy: by, rx: 130, ry: 108, fill: `url(#${id}-glow)` })
    order.push(
      part('brain', bglow, s('g', { transform: at(bx, by) }, brainArt())),
      part('env', s('g', { transform: at(c.desk[0], c.desk[1], c.desk[2]) }, deskArt())),
      part('plan', s('g', { transform: at(c.scroll[0], c.scroll[1], c.scroll[2]) }, scrollArt())),
      part('hands', held))
    world.append(...order, rip)
    ambient.forEach((tw) => tw.kill())
    ambient = []
    if (!ctx.reduced && ctx.quality === 'high') {
      ambient.push(
        gsap.to(lan.glow, { opacity: 0.7, duration: 1.7, ease: 'sine.inOut', yoyo: true, repeat: -1, repeatRefresh: true }),
        gsap.fromTo(bglow, { opacity: 0.75 }, { opacity: 1, duration: 3.2, ease: 'sine.inOut', yoyo: true, repeat: -1 }),
      )
    }

    // html overlays
    parts.forEach((p, i) => {
      const [x, y, w, hh] = c.rect[p.id]
      const pw = Math.max(44, w * k)
      const ph = Math.max(44, hh * k)
      Object.assign(hots[i].style, { left: `${ox + x * k + (w * k - pw) / 2}px`, top: `${oy + y * k + (hh * k - ph) / 2}px`, width: `${pw}px`, height: `${ph}px` })
      const [sx, sy] = c.seed[p.id]
      Object.assign(seeds[i].style, { left: `${ox + sx * k}px`, top: `${oy + sy * k}px` })
    })
    // z-order: big areas below, small ones on top (tab order stays the parts' order)
    ;(['hands', 'env', 'fence', 'long', 'short', 'plan', 'brain'] as Id[]).forEach((pid, z) => (hots[parts.findIndex((p) => p.id === pid)].style.zIndex = String(z + 1)))
    // small pictures show names only; the picked part opens into a slip
    root.classList.toggle('compact', comp === TALL || k < 0.8)
    root.classList.toggle('tiny', k < 0.42)
    root.style.setProperty('--fs', `${clamp(15 + (k - 0.6) * 6, 12.5, 18)}px`)
    root.style.setProperty('--lw', `${comp === TALL ? W - 16 : Math.min(W - 16, 280)}px`)
    place()
    if (sel >= 0) mark(sel, false)

    if (first) {
      first = false
      if (ctx.reduced) return
      const ins = svg.querySelectorAll('.t14-in')
      gsap.from(ins, { opacity: 0, y: 10, duration: 1.2, stagger: 0.12, ease: 'power3.out', delay: 0.2 })
      gsap.fromTo(draws, { attr: { 'stroke-dashoffset': 1 } }, { attr: { 'stroke-dashoffset': 0 }, duration: 1.2, stagger: 0.15, ease: 'power2.inOut', delay: 0.9 })
      gsap.from(hands, { opacity: 0, duration: 0.6, stagger: 0.15, delay: 1.9 })
      gsap.from(seeds, { scale: 0, duration: 0.8, stagger: 0.08, delay: 2.2, ease: 'back.out(2)', clearProps: 'transform' })
    } else {
      for (const m of draws) m.setAttribute('stroke-dashoffset', '0')
    }
  }

  /**
   * Names sit at their anchors. The picked one opens into a slip, placed on whichever side of its part
   * covers the least (its own part, other names, other parts); names still under it step back.
   */
  function place() {
    const { ox, oy, k, W, H, comp } = geo
    const px = (r: Rect): Rect => [ox + r[0] * k, oy + r[1] * k, r[2] * k, r[3] * k]
    const put = (el: HTMLElement, l: number, t: number) => Object.assign(el.style, { left: `${l}px`, top: `${t}px` })
    parts.forEach((p, i) => {
      if (i === sel) return
      const el = labs[i]
      el.style.width = ''
      put(el, 0, 0)
      const [ax, ay, dir] = comp.lab[p.id]
      const w = el.offsetWidth
      const hh = el.offsetHeight
      const [l, t] = beside(dir, ox + ax * k, oy + ay * k, w, hh)
      put(el, clamp(l, 4, W - w - 4), clamp(t, 4, Math.max(4, H - hh - 4)))
    })
    // names that would touch are nudged apart (small screens put them close together)
    const boxes = labs.map((el, i) => ({ el, i, x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight }))
      .filter((b) => b.i !== sel && b.el.classList.contains('read'))
    for (let pass = 0; pass < 3; pass++)
      boxes.forEach((a, n) => {
        for (const b of boxes.slice(0, n)) {
          const dx = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
          const dy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
          if (dx <= 0 || dy <= -2) continue
          a.y = a.y >= b.y ? b.y + b.h + 2 : b.y - a.h - 2
          a.y = clamp(a.y, 4, Math.max(4, H - a.h - 4))
          a.el.style.top = `${a.y}px`
        }
      })
    if (sel < 0) return
    const el = labs[sel]
    const pid = parts[sel].id
    const own = px(comp.rect[pid])
    if (comp === TALL) {
      // tall screens: the slip spans the width, over the half of the picture away from the part
      el.style.width = `${W - 16}px`
      put(el, 0, 0)
      const hh = el.offsetHeight
      put(el, 8, own[1] + own[3] / 2 > H / 2 ? 4 : Math.max(4, H - hh - 4))
    } else {
      el.style.width = ''
      put(el, 0, 0)
      const w = el.offsetWidth
      const hh = el.offsetHeight
      const [ax, ay, dir] = comp.lab[pid]
      const g = 8
      const cands: [Pt, number][] = [
        [beside(dir, ox + ax * k, oy + ay * k, w, hh), 0],
        [[own[0] + own[2] / 2 - w / 2, own[1] - g - hh], 1],
        [[own[0] + own[2] / 2 - w / 2, own[1] + own[3] + g], 1],
        [[own[0] - g - w, own[1] + own[3] / 2 - hh / 2], 1],
        [[own[0] + own[2] + g, own[1] + own[3] / 2 - hh / 2], 1],
      ]
      const names = labs.filter((l, j) => j !== sel && l.classList.contains('read')).map(box)
      const rects = parts.filter((_, j) => j !== sel).map((p) => [px(comp.rect[p.id]), p.id === 'hands' ? 0.25 : 1] as const)
      let best: Pt = cands[0][0]
      let low = Infinity
      for (const [[l0, t0], pen] of cands) {
        const l = clamp(l0, 4, W - w - 4)
        const t = clamp(t0, 4, Math.max(4, H - hh - 4))
        const r: Rect = [l, t, w, hh]
        let score = overlap(r, own) * 3 + (Math.abs(l - l0) + Math.abs(t - t0)) * hh * 0.5 + pen * w * hh * 0.04
        for (const b of names) score += overlap(r, b) * 2
        for (const [b, wt] of rects) score += overlap(r, b) * wt
        if (score < low) {
          low = score
          best = [l, t]
        }
      }
      put(el, best[0], best[1])
    }
    const sb = box(el)
    labs.forEach((l, j) => l.classList.toggle('under', j !== sel && overlap(box(l), sb) > 0))
  }

  function mark(i: number, anim: boolean) {
    const p = parts[i]
    const [x, y, w, hh] = geo.comp.rect[p.id]
    for (const [pid, gs] of Object.entries(groups)) for (const g of gs) g.classList.toggle('sel', pid === p.id)
    root.classList.add('picked')
    if (!glow || !rip) return
    const cx = x + w / 2
    const cy = y + hh / 2
    gsap.set(glow, { attr: { cx, cy, rx: w * 0.75, ry: hh * 0.7 } })
    if (!anim || ctx.reduced) {
      gsap.set(glow, { opacity: 1 })
      return
    }
    gsap.fromTo(glow, { opacity: 0 }, { opacity: 1, duration: 1.1, ease: 'power2.out' })
    rip.replaceChildren()
    // grounded parts ripple out over the sand; hanging / floating ones pulse in the air
    const ground = p.id === 'long' || p.id === 'env' || p.id === 'fence'
    const r0 = Math.max(w, hh) * 0.42
    const f = ground ? 0.24 : 0.8
    const rs = [0, 1, 2].map(() => s('ellipse', { cx, cy: ground ? y + hh * 0.92 : cy, rx: r0, ry: r0 * f, class: 'ripple', 'stroke-width': 1.2 / geo.k }))
    rip.append(...rs)
    gsap.fromTo(rs, { attr: { rx: r0 * 0.6, ry: r0 * 0.6 * f }, opacity: ground ? 0.8 : 0.5 }, { attr: { rx: r0 * 1.6, ry: r0 * 1.6 * f }, opacity: 0, duration: 2.2, stagger: 0.3, ease: 'power2.out' })
  }

  function pick(i: number) {
    if (i === sel) return
    sel = i
    ctx.anim(() => {
      hots.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)))
      labs.forEach((l, j) => l.classList.toggle('sel', j === i))
      labs[i].classList.add('read')
      seeds[i].classList.add('read')
      read.add(i)
      place()
      mark(i, true)
      if (!ctx.reduced) gsap.fromTo(labs[i], { y: 6, filter: 'blur(4px)' }, { y: 0, filter: 'blur(0px)', duration: 0.8, ease: 'power3.out', clearProps: 'filter,transform' })
      const p = parts[i]
      live.textContent = `${p.name} — ${p.sub}. ${p.text}`
      ctx.chime('soft')
      if (read.size === parts.length) ctx.insight(A.insight, A.detail)
    })
  }

  const stop = onLayout(root, build)
  build()
  return () => {
    stop()
    ambient.forEach((tw) => tw.kill())
  }
}
