import { h, nextId, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx, SceneDef } from '../types'
import { C } from './data'
import { armArt, armShape, brainArt, browserArt, bubbleArt, calendarArt, clamp, filesArt, jarArt, mailArt, ringsArt, sandArt, skyArt, type Pt, type Tool } from './art'
import { glowDefs, onLayout, stableHeight } from './kit'

const J = C.scenes.jar
/** wide composition, jar units [x, y, scale]: far left, near left, far right, near right (far ones sit higher, smaller) */
const WIDE: [number, number, number][] = [[-318, -40, 0.76], [-236, 96, 0.9], [314, -36, 0.76], [232, 100, 0.9]]
/** which way each arm bows (its elbow lifts away from the sand) */
const BEND = [0.15, -0.1, -0.15, 0.1]
const MAKE = [browserArt, filesArt, calendarArt, mailArt]

interface Built {
  glass: SVGGElement[]
  bubbles: SVGGElement
  arms: { m: SVGPathElement; hand: SVGGElement }[]
  tools: Tool[]
  ripples: SVGEllipseElement[]
  ambient: gsap.core.Tween[]
}

/** Scene 1 — a brain in a glass jar can only talk; give it arms and it reaches the tools around it. */
export const jarScene: SceneDef = { label: J.label, mount }

function mount(ctx: SceneCtx) {
  const id = nextId('t14j')
  const root = h('div', { class: 't14 t14-jar' })
  const svg = s('svg', { class: 't14-svg', 'aria-hidden': 'true' })
  const cap = h('p', { class: 't14-cap', 'aria-hidden': 'true' }, J.before)
  const labs = J.tools.map((t) => h('span', { class: 't14-tlab', 'aria-hidden': 'true' }, t))
  const live = h('p', { class: 'visually-hidden', 'aria-live': 'polite' })
  const txt = h('span', null, J.attach)
  const btn = h('button', { class: 't14-seal', type: 'button', 'aria-pressed': 'false', onClick: () => toggle() }, h('span', { class: 't14-seal-dot', 'aria-hidden': 'true' }), txt)
  root.append(h('p', { class: 'visually-hidden' }, J.art), svg, cap, ...labs, btn, live)
  ctx.art.append(root)
  ctx.prompt(J.prompt)
  const artH = stableHeight(ctx, [J.insight])

  let on = false
  let busy = false
  let told = false
  let G: Built | null = null
  const bubbles = new Set<SVGGElement>()

  function build() {
    const W = root.clientWidth
    const H0 = root.clientHeight
    if (!W || !H0) return
    const H = artH(H0)
    G?.ambient.forEach((t) => t.kill())
    busy = false
    const wide = W / H >= 1.15
    // short and wide: the words sit beside the seal in one row under the jar
    const row = wide && H < 380
    const jx = W / 2
    let k: number
    let jy: number
    let tools: [number, number, number][]
    let capY: number
    let hz: number
    let sun: Pt
    let R: number
    let ridges: [number, number, number, number, number][]
    const fsOf = (kk: number) => clamp(15 * kk, 13, 17)
    if (wide) {
      k = clamp(Math.min(W / 880, (H - (row ? 64 : 104)) / (row ? 256 : 304)), 0.28, 1.7)
      const top = 150 * k
      const below = row ? 106 * k + 60 : Math.max(112 * k + fsOf(k) * 1.5 + 64, 160 * k + 28)
      jy = top + Math.max(0, (H - top - below) / 2)
      tools = row
        ? [[jx - 0.42 * W, jy - 40 * k, 0.7], [jx - 0.25 * W, jy + 8 * k, 0.8], [jx + 0.42 * W, jy - 36 * k, 0.7], [jx + 0.25 * W, jy + 12 * k, 0.8]]
        : WIDE.map(([x, y, sc]) => [jx + x * k, jy + y * k, sc])
      capY = jy + (row ? 104 : 112) * k + 4
      hz = jy - 58 * k
      sun = [jx - 200 * k, jy - 110 * k]
      R = 28 * k
      ridges = [[jx + 110 * k, W + 40, 22 * k, 60 * k, 1], [-40, jx - 250 * k, 10 * k, 28 * k, 0.7]]
    } else {
      // tall: the sun above the jar, far tools at the horizon's corners, near ones low; words and seal under it all
      const capH = 18 + 10 + fsOf(0.8) * 1.3 + 8 + 44 + 12
      k = clamp(Math.min(W / 404, (H - capH) / 422), 0.28, 1.3)
      const y0 = Math.max(0, (H - 422 * k - capH) / 2)
      jy = y0 + 240 * k
      const dx = Math.min(W / 2 - 46 * k, 160 * k)
      tools = [[jx - dx, jy - 196 * k, 0.76], [jx - dx, jy + 118 * k, 0.9], [jx + dx, jy - 196 * k, 0.76], [jx + dx, jy + 118 * k, 0.9]]
      capY = jy + 182 * k + 18 + 10
      hz = jy - 170 * k
      sun = [jx, jy - 208 * k]
      R = 24 * k
      ridges = [[-30, jx - 50 * k, 12 * k, 30 * k, 0.75], [jx + 70 * k, W + 30, 16 * k, 42 * k, 1]]
    }
    const fs = fsOf(k)
    const bx = jx
    const by = jy - 8 * k
    const T = (x: number, y: number, sc: number) => `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${sc.toFixed(3)})`

    svg.setAttribute('viewBox', `0 0 ${W} ${H0}`)
    svg.replaceChildren(glowDefs(id))
    const defs = svg.firstChild as SVGDefsElement
    const low = ctx.quality === 'low'
    // dawn: a pale sun, far ridges in mist, then raked sand from the horizon down
    svg.append(skyArt(id, { W, hz, sun, R, ridges, seed: 14, low }))
    const ringY = jy + 80 * k
    const built = tools.map(([, , sc], i) => ({ t: MAKE[i](), sc }))
    const holes: [number, number, number, number][] = [[jx, ringY, 190 * k, 190 * k * 0.21 + 4]]
    built.forEach(({ t, sc }, i) => {
      const [x, y] = tools[i]
      holes.push([x, y + t.stone * sc * k, 86 * sc * k, 86 * sc * k * 0.24 + 3])
    })
    svg.append(sandArt(id, W, H0, hz, holes))
    // raked rings around the jar and around each tool's stone
    svg.append(ringsArt(jx, ringY, 138 * k, 0.21, 4, 13 * k))
    const ripples: SVGEllipseElement[] = []
    built.forEach(({ t, sc }, i) => {
      const [x, y] = tools[i]
      svg.append(ringsArt(x, y + t.stone * sc * k + 2 * sc * k, 64 * sc * k, 0.24, 2, 10 * sc * k))
      const g = s('g', { transform: T(x, y, k * sc) }, t.g)
      const rp = s('ellipse', { cx: 0, cy: t.stone, rx: 54, ry: 12, class: 'ripple', opacity: 0 })
      g.insertBefore(rp, g.firstChild)
      ripples.push(rp)
      svg.append(g)
      Object.assign(labs[i].style, { left: `${x}px`, top: `${y + t.foot * sc * k + 2}px`, fontSize: `${clamp(14 * k, 12, 17)}px` })
    })
    // the jar
    const jar = jarArt()
    const glassIn = s('g', { class: 't14-glass' }, jar.back)
    const glassFront = s('g', { class: 't14-glass' }, jar.front)
    svg.append(s('g', { transform: T(jx, jy, k) }, jar.base, glassIn))
    // arms (behind the brain, above the tools): one calligraphic stroke each, ending in a brush tip that touches
    const washG = s('g', { filter: 'url(#ink-wash)' })
    const armG = s('g', { class: 't14-arms', filter: 'url(#ink-rough)' })
    const hairG = s('g', { opacity: 0.7 })
    const handG = s('g', { filter: 'url(#ink-rough)' })
    const aw = 11.5 * k
    const arms = built.map(({ sc }, i) => {
      const [tx, ty] = tools[i]
      const ux = tx - bx
      const uy = ty - by
      const ul = Math.hypot(ux, uy)
      const S0: Pt = [bx + (ux / ul) * 44 * k, by + (uy / ul) * 30 * k]
      const reach = 46 * sc * k
      const Tp: Pt = [tx - (ux / ul) * reach, ty - (uy / ul) * reach * 0.75]
      const a = armArt(armShape(S0, Tp, aw, BEND[i]), aw, `${id}-a${i}`)
      defs.append(a.mask)
      washG.append(a.wash)
      hairG.append(...a.hairs)
      armG.append(a.body)
      handG.append(a.hand)
      return { m: a.m, hand: a.hand }
    })
    svg.append(washG, armG, hairG, handG)
    // the brain and its warm light
    const glow = s('ellipse', { cx: bx, cy: by, rx: 120 * k, ry: 100 * k, fill: `url(#${id}-glow)`, class: 't14-bglow' })
    svg.append(glow, s('g', { transform: T(bx, by, k * 0.95) }, brainArt()))
    const bub = s('g')
    svg.append(s('g', { transform: T(jx, jy, k) }, glassFront, bub))
    bubbles.clear()

    // the glass (back and front) lifts as one
    G = { glass: [glassIn, glassFront], bubbles: bub, arms, tools: built.map((b) => b.t), ripples, ambient: [] }

    // html overlays: caption and the seal under the jar
    cap.style.fontSize = `${fs}px`
    btn.style.fontSize = `${fs}px`
    btn.style.setProperty('--pad', `${clamp(20 * k, 12, 20)}px`)
    if (row) {
      const cw = cap.offsetWidth
      const bw = btn.offsetWidth
      const x0 = jx - (cw + 14 + bw) / 2
      Object.assign(cap.style, { left: `${x0 + cw / 2}px`, top: `${capY + (44 - fs * 1.25) / 2}px` })
      Object.assign(btn.style, { left: `${x0 + cw + 14 + bw / 2}px`, top: `${capY}px` })
    } else {
      // keep a little air under the seal (it grows a touch on hover)
      const by2 = Math.min(capY + fs * 1.3 + 8, H - 44 - 12)
      Object.assign(cap.style, { left: `${jx}px`, top: `${by2 - fs * 1.3 - 8}px` })
      Object.assign(btn.style, { left: `${jx}px`, top: `${by2}px` })
    }

    setState(on)
    // the brain's warm light breathes (opacity only: the inked brain itself stays still, so its filters are not redrawn)
    if (!ctx.reduced && ctx.quality === 'high') G.ambient.push(gsap.fromTo(glow, { opacity: 0.7 }, { opacity: 1, duration: 3.2, ease: 'sine.inOut', yoyo: true, repeat: -1 }))
  }

  /** Put every element straight into the attached / detached look (no motion). */
  function setState(attached: boolean) {
    if (!G) return
    gsap.set(G.glass, { y: attached ? -46 : 0, opacity: attached ? 0 : 1 })
    for (const a of G.arms) {
      a.m.setAttribute('stroke-dashoffset', attached ? '0' : '1')
      gsap.set(a.hand, { opacity: attached ? 1 : 0 })
    }
    for (const t of G.tools) gsap.set(t.act, { opacity: attached ? 1 : 0, scale: 1, transformOrigin: '50% 50%' })
    gsap.set(G.ripples, { opacity: 0 })
    root.classList.toggle('on', attached)
  }

  function toggle() {
    if (busy || !G) return
    on = !on
    btn.setAttribute('aria-pressed', String(on))
    txt.textContent = on ? J.again : J.attach
    cap.textContent = on ? J.after : J.before
    ctx.chime(on ? 'soft' : 'tap')
    if (on) for (const b of bubbles) gsap.to(b, { opacity: 0, duration: 0.4 })
    if (ctx.reduced) {
      setState(on)
      if (on) finish()
      return
    }
    const g = G
    const glass = g.glass
    busy = true
    ctx.anim(() => {
      const tl = gsap.timeline({ onComplete: () => void (busy = false) })
      if (on) {
        root.classList.add('on')
        tl.to(glass, { y: -46, opacity: 0, duration: 1.2, ease: 'power2.inOut' }, 0)
        g.arms.forEach((a, i) => {
          const at = 0.6 + i * 0.24
          tl.fromTo(a.m, { attr: { 'stroke-dashoffset': 1 } }, { attr: { 'stroke-dashoffset': 0 }, duration: 1.15, ease: 'power2.inOut' }, at)
          tl.fromTo(a.hand, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: 'power1.out' }, at + 0.95)
          const t = g.tools[i]
          tl.fromTo(t.lift, { y: 0 }, { y: -7, duration: 0.35, ease: 'power2.out', yoyo: true, repeat: 1 }, at + 1.05)
          tl.fromTo(t.act, { opacity: 0, scale: 0.4, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.7, ease: 'back.out(2.2)' }, at + 1.15)
          tl.fromTo(g.ripples[i], { attr: { rx: 54, ry: 12 }, opacity: 0.7 }, { attr: { rx: 100, ry: 22 }, opacity: 0, duration: 1.6, ease: 'power2.out' }, at + 1.05)
        })
        tl.add(finish, 2.5)
      } else {
        root.classList.remove('on')
        g.arms.forEach((a, i) => {
          tl.to(a.hand, { opacity: 0, duration: 0.3 }, i * 0.08)
          tl.to(a.m, { attr: { 'stroke-dashoffset': 1 }, duration: 0.9, ease: 'power2.inOut' }, 0.15 + i * 0.08)
        })
        tl.to(g.tools.map((t) => t.act), { opacity: 0, duration: 0.5 }, 0)
        tl.to(glass, { y: 0, opacity: 1, duration: 1.1, ease: 'power3.out' }, 0.7)
      }
    })
  }

  function finish() {
    live.textContent = J.done
    if (told) return
    told = true
    ctx.insight(J.insight, J.detail)
  }

  // the chatbot "talks": word bubbles rise inside the jar and bump against the glass
  let n = 0
  const timer = ctx.reduced
    ? 0
    : window.setInterval(() => {
        if (on || !G || document.hidden) return
        const b = s('g', null, s('g', { transform: 'scale(1.3)' }, bubbleArt(n)))
        const x = ((n * 37) % 50) - 25
        n++
        G.bubbles.append(b)
        bubbles.add(b)
        const done = () => (bubbles.delete(b), b.remove())
        gsap.timeline({ onComplete: done })
          .fromTo(b, { x, y: -40, scale: 0.5, opacity: 0, transformOrigin: '50% 100%' }, { y: -76, scale: 1, opacity: 1, duration: 2.4, ease: 'sine.out' })
          .to(b, { y: -81, scaleY: 0.84, duration: 0.35, ease: 'power2.out' })
          .to(b, { y: -77, scaleY: 1, opacity: 0, duration: 0.9, ease: 'power1.in' })
      }, ctx.quality === 'low' ? 3200 : 1900)

  const stop = onLayout(root, build)
  build()
  return () => {
    stop()
    clearInterval(timer)
    G?.ambient.forEach((t) => t.kill())
    gsap.killTweensOf([...bubbles])
  }
}
