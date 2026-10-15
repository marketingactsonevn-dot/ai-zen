import { h, nextId, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { arc, brush, C, clamp, rng, timers, type Pt } from './ink'

const K = C.scenes.consent

/** Lan's voice as a ring of radial ink strokes — a voice-print as personal as a fingerprint. Same seed → same print. */
function printD(cx: number, cy: number, r: number) {
  const rr = rng(77)
  let d = ''
  const N = 56
  for (let k = 0; k < N; k++) {
    const a = (k / N) * Math.PI * 2 - Math.PI / 2
    const v = clamp(0.5 + 0.26 * Math.sin(3 * a + 0.7) + 0.16 * Math.sin(7 * a + 2.1) + (rr() - 0.5) * 0.36, 0.12, 1)
    const c = Math.cos(a)
    const sn = Math.sin(a)
    const o0 = r * 1.14
    const o1 = o0 + r * 0.5 * v
    d += brush([[cx + c * o0, cy + sn * o0], [cx + c * o1, cy + sn * o1]], r * 0.052, { a: 0.08, b: 0.75, min: 0.12, wob: 0 })
    const i0 = r * 0.86
    const i1 = i0 - r * 0.2 * v
    d += brush([[cx + c * i0, cy + sn * i0], [cx + c * i1, cy + sn * i1]], r * 0.034, { a: 0.1, b: 0.7, min: 0.15, wob: 0 })
  }
  return d
}

const ringD = (cx: number, cy: number, r: number, seed: number) =>
  brush(arc(cx, cy, r, -80 + seed * 7, 252 + seed * 5, 60), r * 0.075, { a: 0.05, b: 0.55, min: 0.14, wob: 0.16 })

/** Scene 2 — copy Lan's voice: the copy stays a pale sketch until Lan's consent seal is pressed; then it is labelled "AI". */
export function consentScene(ctx: SceneCtx) {
  const svg = s('svg', { class: 't10c-svg', 'aria-hidden': 'true' })
  const own = h('button', { class: 't10c-own', type: 'button', 'aria-label': K.copyAria, onClick: copy })
  const ownLab = h('p', { class: 't10-cap t10c-lab' }, K.owner)
  const copyLab = h('p', { class: 't10-cap t10c-lab' }, K.copy)
  const wait = h('p', { class: 't10c-wait', 'aria-live': 'polite' })
  const imp = s('g', { class: 't10c-imp' },
    s('rect', { x: 7, y: 7, width: 46, height: 46, rx: 5, class: 'v', filter: 'url(#ink-rough)' }),
    s('rect', { x: 11, y: 11, width: 38, height: 38, rx: 3, class: 'imp-line' }),
    s('text', { x: 30, y: 30.5, class: 'imp-t', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, K.seal),
    ...[[15, 44, 1.4], [44, 16, 1], [40, 46, 1.8], [18, 14, 0.9], [27, 46, 0.8]].map(([cx, cy, r]) => s('circle', { cx, cy, r, class: 'imp-speck' })))
  const sealSvg = s('svg', { class: 't10c-seal-svg', viewBox: '0 0 60 60', 'aria-hidden': 'true' },
    s('rect', { x: 6, y: 6, width: 48, height: 48, rx: 6, class: 'slot' }), imp)
  const hint = h('span', { class: 't10c-hint', 'aria-hidden': 'true' }, K.ask)
  const seal = h('button', { class: 't10c-seal', type: 'button', 'aria-label': K.ask, onClick: stamp }, sealSvg, hint)
  // a square soapstone seal seen from above-right: a lit top face, a darker side, a carved knob with a cord hole;
  // only the foot of the block carries the vermilion paste
  const knobId = nextId('t10b')
  const block = s('svg', { class: 't10c-block', viewBox: '0 0 40 66', 'aria-hidden': 'true' },
    s('defs', null, s('linearGradient', { id: knobId, x1: 0, x2: 1, y1: 0, y2: 0.3 },
      s('stop', { offset: 0, class: 'b0' }), s('stop', { offset: 0.35, class: 'b1' }), s('stop', { offset: 1, class: 'b3' }))),
    s('path', { class: 'side', d: 'M30 27 L36 21.5 L36 57 L30 62.5 Z', filter: 'url(#ink-rough)' }),
    s('path', { class: 'front', d: 'M4 27 L30 27 L30 62.5 L4 62.5 Z', filter: 'url(#ink-rough)' }),
    s('path', { class: 'top', d: 'M4 27 L10 21.5 L36 21.5 L30 27 Z', filter: 'url(#ink-rough)' }),
    s('path', { d: 'M10.5 25 C10 15.5 14.5 7 20.5 7 C26.5 7 31 15.5 30.5 24.5 C25 26.6 16 26.6 10.5 25 Z', fill: `url(#${knobId})`, filter: 'url(#ink-rough)' }),
    s('path', { class: 'cut', d: 'M13 21 C14.5 17 17.5 15.6 20.5 15.6 C23.5 15.6 26.5 17 28 21' }),
    s('ellipse', { class: 'hole', cx: 20.5, cy: 11.6, rx: 1.9, ry: 1.6 }),
    s('path', { class: 'hi', d: 'M7 31 L7 58' }),
    s('path', { class: 'v', d: 'M4 59 L30 59 L36 53.6 L36 57 L30 62.5 L4 62.5 Z', filter: 'url(#ink-rough)' }))
  const flash = h('div', { class: 't10c-flash', 'aria-hidden': 'true' })
  const paper = s('svg', { class: 't10c-paper', 'aria-hidden': 'true' })
  const cord = s('svg', { class: 't10c-cord', 'aria-hidden': 'true' })
  const slip = h('div', { class: 't10c-slip' }, cord, paper,
    h('div', { class: 't10c-slip-in' }, h('p', { class: 't10c-slip-t' }, K.slip[0], h('br'), K.slip[1]), h('div', { class: 't10c-press' }, seal, block, flash)))
  const tag = h('p', { class: 't10c-tag' }, K.tag)
  const root = h('div', { class: 't10 t10c' }, h('p', { class: 'visually-hidden' }, K.art), svg, own, ownLab, copyLab, wait, slip, tag)
  ctx.art.append(root)
  ctx.prompt(K.prompt)

  let phase = 0 // 0 untouched · 1 sketched, waiting · 2 consented
  const tm = timers()
  let A: Pt = [0, 0]
  let B: Pt = [0, 0]
  let R = 40
  let wide = true
  let els: { ownG: SVGGElement; copyG: SVGGElement; inkM: SVGCircleElement; ghostM: SVGCircleElement; ghost: SVGGElement; dots: SVGCircleElement[]; thread: SVGPathElement; ring: SVGEllipseElement } | null = null
  let breath: gsap.core.Tween[] = []

  let lastW = 0
  function layout() {
    const W = root.clientWidth
    const H = root.clientHeight
    if (!W || !H) return
    const was = { W: lastW, y: A[1] }
    lastW = W
    wide = W / H > 1.25
    root.classList.toggle('wide', wide)
    root.classList.toggle('short', wide && H < 330)
    let slipW: number
    let slipH: number
    let slipX: number
    let slipY: number
    if (wide) {
      R = Math.min(W * 0.085, H * 0.17)
      A = [W * 0.2, H * 0.47]
      B = [W * 0.8, H * 0.47]
      slipW = clamp(W * 0.13, 140, 176)
      slipH = Math.min(H - 30, Math.max(172, H * 0.44), 226)
      slipX = (W - slipW) / 2
      slipY = clamp(A[1] - slipH / 2 + 8, 24, H - slipH - 4)
    } else {
      R = Math.min(W * 0.14, H * 0.12, 70)
      slipW = Math.min(W - 28, 320)
      slipH = 100
      const total = R * 3.3 + 56 + 44 + slipH + 34
      const y0 = Math.max(0, (H - total) / 2) + 34
      A = [W * 0.26, y0 + R * 1.65]
      B = [W * 0.74, y0 + R * 1.65]
      slipX = (W - slipW) / 2
      slipY = y0 + R * 3.3 + 56 + 44
    }
    root.style.setProperty('--seal', `${wide ? clamp(slipW * 0.42, 50, 64) : 54}px`)
    Object.assign(slip.style, { left: `${slipX}px`, top: `${slipY}px`, width: `${slipW}px`, height: `${slipH}px` })
    paintScroll(slipW, slipH, Math.min(24, slipY - 2))
    const ob = Math.max(48, R * 2.4)
    Object.assign(own.style, { left: `${A[0] - ob / 2}px`, top: `${A[1] - ob / 2}px`, width: `${ob}px`, height: `${ob}px` })
    const lw = wide ? R * 3.6 : W * 0.48
    const ly = A[1] + R * 1.72
    Object.assign(ownLab.style, { left: `${A[0] - lw / 2}px`, top: `${ly}px`, width: `${lw}px` })
    Object.assign(copyLab.style, { left: `${B[0] - lw / 2}px`, top: `${ly}px`, width: `${lw}px` })
    Object.assign(wait.style, { left: `${B[0] - lw / 2}px`, top: `${ly + 24}px`, width: `${lw}px` })
    // the "AI" tag hangs off the copy's ring
    const ta = (wide ? -38 : -90) * (Math.PI / 180)
    const tw = 84
    const tx = clamp(B[0] + Math.cos(ta) * R * 1.85 - tw / 2, 0, W - tw)
    const ty = clamp(B[1] + Math.sin(ta) * R * (wide ? 1.85 : 1.7) - (wide ? 14 : 30), 0, H - 30)
    Object.assign(tag.style, { left: `${tx}px`, top: `${ty}px`, width: `${tw}px` })
    build(W, H, [tx + tw / 2, ty + 4], ta)
    // only the height changed (the insight arrived below): the picture glides up instead of jumping
    if (!ctx.reduced && was.W === W && was.y !== A[1]) ctx.anim(() => gsap.from(root, { y: was.y - A[1], duration: 0.9, ease: 'power3.inOut' }))
  }

  /** The hanging scroll: a silk mount with a ragged edge, rice paper laid on it, a slim brushed roller at each end, a cord up to its nail. */
  function paintScroll(w: number, hh: number, ch: number) {
    paper.setAttribute('viewBox', `0 0 ${w} ${hh}`)
    const ix = 7
    const it = wide ? 14 : 10
    const ib = wide ? 18 : 10
    const gid = nextId('t10p')
    paper.replaceChildren(
      s('defs', null, s('linearGradient', { id: gid, x1: 0, x2: 0.35, y1: 0, y2: 1 },
        s('stop', { offset: 0, class: 'p0' }), s('stop', { offset: 0.6, class: 'p1' }), s('stop', { offset: 1, class: 'p2' }))),
      s('rect', { class: 'mount', x: 0, y: 0, width: w, height: hh, filter: 'url(#ink-rough)' }),
      s('rect', { x: ix, y: it, width: w - 2 * ix, height: hh - it - ib, fill: `url(#${gid})`, filter: 'url(#ink-rough)' }),
      ...rod(w, 1.5, 5),
      ...rod(w, hh - 1, 6))
    if (ch < 10) {
      cord.replaceChildren()
      return
    }
    Object.assign(cord.style, { top: `${-ch}px`, height: `${ch}px` })
    cord.setAttribute('viewBox', `0 0 ${w} ${ch}`)
    cord.replaceChildren(
      s('path', { class: 'thread', d: `M${w * 0.16} ${ch}L${w / 2} 2L${w * 0.84} ${ch}` }),
      s('circle', { class: 'nail', cx: w / 2, cy: 2, r: 1.8 }))
  }

  /** A roller: one flat brush stroke a little wider than the scroll, with a darker turned cap at each end. */
  function rod(w: number, y: number, t: number) {
    return [
      s('path', { class: 'rod', d: brush([[-3, y], [w * 0.5, y + 0.25], [w + 3, y]], t, { a: 0.02, b: 0.02, min: 0.8, wob: 0.05 }), filter: 'url(#ink-rough)' }),
      ...[-4.5, w + 4.5].map((x) => s('rect', { class: 'cap', x: x - 2.2, y: y - t * 0.9, width: 4.4, height: t * 1.8, rx: 1.4, filter: 'url(#ink-rough)' })),
    ]
  }

  function build(W: number, H: number, tagAt: Pt, ta: number) {
    breath.forEach((t) => t.kill())
    breath = []
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
    const inkId = nextId('t10m')
    const ghostId = nextId('t10m')
    const washId = nextId('t10w')
    const inkM = s('circle', { cx: B[0], cy: B[1], r: phase >= 2 ? R * 2.2 : 0, fill: '#fff' })
    const ghostM = s('circle', { cx: B[0], cy: B[1], r: phase >= 1 ? R * 2.2 : 0, fill: '#fff' })
    const defs = s('defs', null,
      s('radialGradient', { id: washId }, s('stop', { offset: 0.35, class: 'wash0' }), s('stop', { offset: 0.72, class: 'wash1' }), s('stop', { offset: 1, class: 'wash2' })),
      s('mask', { id: inkId, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, inkM), s('mask', { id: ghostId, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, ghostM))
    const pond = (p: Pt) => s('circle', { cx: p[0], cy: p[1], r: R * 1.75, fill: `url(#${washId})` })
    const name = (p: Pt) => s('text', { x: p[0], y: p[1], class: 't10c-name', 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': Math.max(13, R * 0.3) }, K.name)
    const ownG = s('g', { class: 't10c-print' },
      s('path', { class: 'k', d: ringD(A[0], A[1], R, 0), filter: 'url(#ink-rough)' }),
      s('path', { class: 'k', d: printD(A[0], A[1], R), filter: 'url(#ink-rough)' }),
      name(A))
    // the copy: an empty dashed circle, a pencil-sketch of the print, then the inked print
    const ghost = s('g', { mask: `url(#${ghostId})`, opacity: phase === 1 ? 1 : 0 },
      s('path', { class: 'ghost-t', d: printD(B[0], B[1], R) }),
      s('circle', { class: 'ghost-t', cx: B[0], cy: B[1], r: R }))
    const copyG = s('g', { class: 't10c-print', mask: `url(#${inkId})` },
      s('path', { class: 'k', d: ringD(B[0], B[1], R, 0), filter: 'url(#ink-rough)' }),
      s('path', { class: 'k', d: printD(B[0], B[1], R), filter: 'url(#ink-rough)' }),
      name(B))
    const slot = s('circle', { class: 'slot-c', cx: B[0], cy: B[1], r: R * 1.02, opacity: phase >= 2 ? 0 : 1 })
    const r = rng(9)
    const dots = Array.from({ length: 30 }, () => s('circle', { class: 'k', r: (0.8 + r() * 2.2) * Math.max(0.7, R / 70), cx: -20, cy: -20, opacity: 0 }))
    // the thread the tag hangs from
    const from: Pt = [B[0] + Math.cos(ta) * R * 1.12, B[1] + Math.sin(ta) * R * 1.12]
    const thread = s('path', { class: 'thread', d: `M${from[0]} ${from[1]}Q${(from[0] + tagAt[0]) / 2} ${Math.max(from[1], tagAt[1]) + 10} ${tagAt[0]} ${tagAt[1]}`, opacity: phase >= 2 ? 1 : 0 })
    const ring = s('ellipse', { class: 'rip', cx: A[0], cy: A[1], rx: 0, ry: 0, opacity: 0 })
    svg.replaceChildren(defs, pond(A), pond(B), slot, ownG, ghost, copyG, ring, thread, ...dots)
    els = { ownG, copyG, inkM, ghostM, ghost, dots, thread, ring }
    if (!ctx.reduced) {
      // a voice is alive: the print breathes; once copied, both breathe as one
      const b = (el: SVGGElement) => gsap.fromTo(el, { scale: 1 }, { scale: 1.025, svgOrigin: `${el === ownG ? A[0] : B[0]} ${A[1]}`, duration: 2.2, ease: 'sine.inOut', yoyo: true, repeat: -1 })
      breath = [b(ownG), b(copyG)]
    }
  }

  function ripple(p: Pt, cls: string) {
    if (!els || ctx.reduced) return
    const { ring } = els
    ring.setAttribute('class', `rip ${cls}`)
    gsap.fromTo(ring, { attr: { cx: p[0], cy: p[1], rx: R * 1.1, ry: R * 1.1 }, opacity: 0.8 }, { attr: { rx: R * 2, ry: R * 2 }, opacity: 0, duration: 1.6, ease: 'power2.out' })
  }

  function copy() {
    if (phase > 0) return ctx.anim(() => ripple(A, ''))
    phase = 1
    root.classList.add('copied')
    ctx.anim(() => {
      if (!els) return
      const { dots, ghostM, ghost } = els
      wait.textContent = K.waiting
      if (ctx.reduced) {
        gsap.set(ghostM, { attr: { r: R * 2.2 } })
        gsap.set(ghost, { opacity: 1 })
        gsap.set([slip, wait], { autoAlpha: 1 })
        ctx.prompt(K.askPrompt)
        return
      }
      ripple(A, '')
      // the voice is lifted off in flecks of ink and carried across
      const d = [B[0] - A[0], B[1] - A[1]]
      const len = Math.hypot(d[0], d[1])
      const u: Pt = [d[0] / len, d[1] / len]
      const p0: Pt = [A[0] + u[0] * R * 1.25, A[1] + u[1] * R * 1.25]
      const p2: Pt = [B[0] - u[0] * R * 1.25, B[1] - u[1] * R * 1.25]
      const bow = wide ? len * 0.3 : R * 1.1
      const p1: Pt = [(p0[0] + p2[0]) / 2 + u[1] * bow, (p0[1] + p2[1]) / 2 - Math.abs(u[0]) * bow]
      const jit = dots.map((_, i) => ((i * 37) % 11) / 11 - 0.5)
      const st = { u: 0 }
      const fleck = (el: SVGCircleElement, i: number) => {
        const t = clamp((st.u - (i / dots.length) * 0.45) / 0.55)
        const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
        const x = (1 - e) ** 2 * p0[0] + 2 * (1 - e) * e * p1[0] + e * e * p2[0]
        const y = (1 - e) ** 2 * p0[1] + 2 * (1 - e) * e * p1[1] + e * e * p2[1] + jit[i] * R * 0.5 * Math.sin(e * Math.PI)
        el.setAttribute('cx', x.toFixed(1))
        el.setAttribute('cy', y.toFixed(1))
        el.setAttribute('opacity', (Math.sin(t * Math.PI) * 0.85).toFixed(2))
      }
      gsap.to(st, { u: 1, duration: 2, ease: 'none', onUpdate: () => dots.forEach(fleck) })
      gsap.set(ghost, { opacity: 1 })
      gsap.fromTo(ghostM, { attr: { r: 0 } }, { attr: { r: R * 2.2 }, duration: 1.6, delay: 0.9, ease: 'power2.out' })
      gsap.fromTo(slip, { autoAlpha: 0, y: -14, scaleY: 0.7 }, { autoAlpha: 1, y: 0, scaleY: 1, duration: 1, delay: 1.7, ease: 'power3.out', transformOrigin: '50% 0%' })
      gsap.fromTo(wait, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8, delay: 2 })
    })
    tm.later(() => ctx.prompt(K.askPrompt), ctx.reduced ? 0 : 2400)
  }

  function stamp() {
    if (phase !== 1) return
    phase = 2
    seal.setAttribute('aria-disabled', 'true')
    ctx.anim(() => {
      if (!els) return
      const { inkM, ghost, thread } = els
      const done = () => {
        ctx.insight(K.insight, K.detail)
        ctx.chime('ok')
      }
      if (ctx.reduced) {
        gsap.set(imp, { opacity: 1 })
        gsap.set([hint, wait], { autoAlpha: 0 })
        gsap.set(inkM, { attr: { r: R * 2.2 } })
        gsap.set(ghost, { opacity: 0 })
        gsap.set(svg.querySelector('.slot-c'), { opacity: 0 })
        gsap.set([tag, thread], { autoAlpha: 1 })
        done()
        return
      }
      const tl = gsap.timeline()
      tl.fromTo(block, { autoAlpha: 0, y: -70, rotation: -10, scale: 1.08 }, { autoAlpha: 1, y: -16, rotation: -3, duration: 0.55, ease: 'power2.out' })
        .to(block, { y: 0, scale: 0.95, rotation: -2, duration: 0.16, ease: 'power4.in' })
        .set(imp, { opacity: 1 })
        .fromTo(sealSvg, { scale: 1.06 }, { scale: 1, duration: 0.4, ease: 'power2.out' })
        .fromTo(flash, { autoAlpha: 0.7, scale: 0.7 }, { autoAlpha: 0, scale: 1.9, duration: 1, ease: 'power2.out' }, '<')
        .to(hint, { autoAlpha: 0, duration: 0.3 }, '<')
        .to(block, { y: -54, autoAlpha: 0, scale: 1, rotation: 4, duration: 0.7, ease: 'power2.out' }, '<0.12')
        .to(wait, { autoAlpha: 0, duration: 0.4 }, '<')
        // consent given: the sketch is inked from the centre out
        .to(inkM, { attr: { r: R * 2.2 }, duration: 1.8, ease: 'power2.out' }, '<0.2')
        .to(ghost, { opacity: 0, duration: 1.2 }, '<0.4')
        .to(svg.querySelector('.slot-c'), { opacity: 0, duration: 0.8 }, '<')
        .fromTo(thread, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6 }, '<0.6')
        .fromTo(tag, { autoAlpha: 0, rotation: -24, y: -8 }, { autoAlpha: 1, rotation: 0, y: 0, duration: 1.2, ease: 'elastic.out(1, 0.5)', transformOrigin: '50% 0%' }, '<0.1')
      tl.call(() => tm.later(done, 0), undefined, 1.2)
      tm.later(() => ctx.anim(() => ripple(B, 'v')), 1100)
    })
  }

  gsap.set([slip, wait, tag], { autoAlpha: 0 })
  gsap.set(imp, { opacity: 0 })

  let raf = 0
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(layout)
  })
  ro.observe(root)
  layout()
  if (!ctx.reduced) gsap.from(svg, { opacity: 0, duration: 1.6, delay: 0.2, ease: 'power2.out' })

  return () => {
    ro.disconnect()
    cancelAnimationFrame(raf)
    tm.clear()
    breath.forEach((t) => t.kill())
  }
}
