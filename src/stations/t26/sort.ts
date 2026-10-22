import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { blob, curve, onDigit, onSize, rng, stableHeight, stroke, type Pt } from '../../ui/part2/ink'
import { diorama } from '../../ui/part2/depth'
import { guide } from '../../ui/part2/guide'
import { grass, hills, mist, moon, pine } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import C from '../../content/tram-26.json'
import { stele } from './rule'

/**
 * Scene 4 — two bamboo baskets (art direction §4, t26 `rule.sort`): 2.5D, three-quarter view from 30° above the foot of
 * the rule stele. The moon stands behind the stele; paper slips come fluttering down from it like leaves (CSS 3D), stop
 * in front of you, and you drop each into a basket — drag it there, tap a basket, or keys 1–2. The right basket takes the
 * slip and its weave glows; the wrong one bounces it back. In the end one basket holds a single slip, the other overflows.
 */

const R = C.scenes.rule
const K = R.sort
const F = (x: unknown) => x as Fact
const P = (p: Pt) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`

/** A woven bamboo basket standing on (0, 0), w wide, seen from 30° above: the mouth shows the slips inside (k1…k4). */
function basket(w: number, seed: number) {
  const r = rng(seed)
  const hh = w * 0.6, top = -hh, b = w * 0.36, my = w * 0.15
  const side = (t: number): [Pt, Pt] => [[-w / 2 + (w / 2 - b) * t, top + hh * t], [w / 2 - (w / 2 - b) * t, top + hh * t]]
  let weave = '', ribs = ''
  for (let i = 1; i < 8; i++) {
    const [l, rr] = side(i / 8)
    for (let k = i % 2; k < 9; k += 2) {
      const u0 = k / 9, u1 = (k + 0.85) / 9
      const P0: Pt = [l[0] + (rr[0] - l[0]) * u0, l[1] + Math.sin(u0 * Math.PI) * my * 0.55]
      const P1: Pt = [l[0] + (rr[0] - l[0]) * u1, l[1] + Math.sin(u1 * Math.PI) * my * 0.55]
      weave += stroke([P0, P1], w * 0.03 * (0.8 + r() * 0.4), 0.2, 0.2, 0.4)
    }
  }
  for (let i = 1; i < 9; i++) ribs += stroke([[-w / 2 + (w * i) / 9, top + my * 0.6], [-b + (2 * b * i) / 9, -1]], 1, 0.05, 0.05, 0.6)
  const rim: Pt[] = Array.from({ length: 41 }, (_, i) => {
    const a = (i / 40) * Math.PI * 2
    return [Math.cos(a) * w * 0.5, top + Math.sin(a) * my]
  })
  const body = `M${P(side(0)[0])}Q0 ${(top + my * 1.1).toFixed(1)} ${P(side(0)[1])}L${P([b, 0])}Q0 ${(w * 0.08).toFixed(1)} ${P([-b, 0])}Z`
  // slips inside, leaning in the mouth; k4…k5 stand up out of a full basket
  const slip = (cx: number, lean: number, tall: number, k: string) =>
    s('path', { class: `t26s-in ${k}`, d: `M${P([cx - w * 0.06, top + my * 0.3])}L${P([cx - w * 0.06 + lean, top - tall])}L${P([cx + w * 0.06 + lean, top - tall + w * 0.02])}L${P([cx + w * 0.06, top + my * 0.35])}Z` })
  return s('g', { class: 't26s-basket' },
    s('ellipse', { class: 't26s-sh', cx: (w * 0.08).toFixed(1), cy: 2, rx: (b * 1.5).toFixed(1), ry: (w * 0.07).toFixed(1) }),
    s('ellipse', { class: 't26s-mouth', cx: 0, cy: top.toFixed(1), rx: (w * 0.47).toFixed(1), ry: (my * 0.9).toFixed(1) }),
    slip(-w * 0.16, -w * 0.05, w * 0.1, 'k1'), slip(w * 0.04, w * 0.03, w * 0.16, 'k2'), slip(w * 0.2, w * 0.06, w * 0.12, 'k3'),
    slip(-w * 0.04, -w * 0.08, w * 0.3, 'k4'),
    s('path', { class: 't26s-glow', d: body }),
    s('path', { class: 't26s-body', d: body, filter: 'url(#ink-rough)' }),
    s('path', { d: body, fill: 'url(#p2-shade)' }),
    s('path', { class: 't26s-rib', d: ribs }),
    s('path', { class: 't26s-weave', d: weave }),
    s('path', { class: 't26s-rim', d: stroke(rim.slice(0, 21), w * 0.05, 0.02, 0.02, 0.8) + stroke(rim.slice(20), w * 0.035, 0.02, 0.02, 0.8), filter: 'url(#ink-rough)' }),
    s('path', { class: 'zk-ink t26s-edge', d: stroke([side(0)[1], [b, 0]], 1.8, 0.1, 0.3, 0.3) + stroke(curve([b, 0], [0, w * 0.09], [-b * 0.6, w * 0.02], 8), 1.8, 0.1, 0.5, 0.2), filter: 'url(#ink-rough)' }))
}

export function sortScene(ctx: SceneCtx) {
  const cases = K.cases
  const still = ctx.reduced || ctx.quality === 'low'
  let idx = 0
  const count = [0, 0]
  const q = h('p', { class: 't26s-q' }, K.prompt)
  const slipText = h('p', { class: 't26s-text' }, cases[0].text)
  const slip = h('div', { class: 't26s-slip' }, slipText)
  const fb = h('p', { class: 't26s-fb' })
  const bins = [0, 1].map((b) => h('button', { class: 't26s-bin', type: 'button', onClick: () => choose(b) }))
  const tags = [K.yes, K.no].map((t, i) => h('span', { class: `t26s-tag${i ? ' r' : ''}`, 'aria-hidden': 'true' }, t))
  const fly = h('div', { class: 't26s-fly' }, slip)
  const root = h('div', { class: 't26s' }, h('p', { class: 'visually-hidden' }, R.art), q, fly, fb)
  const aria = () => bins.forEach((b, i) => b.setAttribute('aria-label', idx < cases.length ? fill(i ? K.noAria : K.yesAria, { text: cases[idx].text }) : i ? K.no : K.yes))
  aria()

  // the garden at the stele's foot, seen from about 30° above: the diorama is mounted half again as tall as the frame and
  // slid up, so its eye sits above the frame's top and the floor fills it (a raised camera; the kit's eye stays where it is).
  // Big baskets in the two near corners (props 0, 1), the stele towering behind them (2) with the moon behind it, a pine
  // close on the right (3), mist lying between the ranges; a puddle between the baskets holds the moon
  const tall = ctx.art.clientHeight > ctx.art.clientWidth // one size read at mount
  const g = guide(ctx)
  const stable = stableHeight(ctx, [F(R.insight)])
  const frame = h('div', { class: 't26s-frame' })
  const inner = h('div', { class: 't26s-dio' })
  frame.append(inner)
  ctx.art.append(frame)
  const LIFT = 0.5 // how far the diorama is slid up, as a share of the frame's (stable) height
  const bw = tall ? 0.14 : 0.31, bx = tall ? 0.17 : 0.17
  const re = (i: number) => queueMicrotask(() => d.props[i].append(bins[i], tags[i])) // the diorama redraws its props on resize
  const d = diorama(ctx, inner, {
    seed: 26,
    layers: [
      // the moon low behind the stele's crown, its halo in a bank of mist (host px: the frame's top is LIFT/(1+LIFT) down)
      { depth: 1, art: (g) => { const y = g.h * (LIFT / (1 + LIFT)) + g.h * (tall ? 0.115 : 0.13); return [mist(g.w * 0.5, y + g.h * 0.03, g.w * 0.34, g.h * 0.05), moon(g.w * 0.5, y, Math.min(g.w, g.h) * (tall ? 0.06 : 0.045), 2646)] } },
      { depth: 0.75, art: (g) => [hills(-g.w * 0.2, g.w * 1.2, g.horizon, g.h * 0.09, 2647, 0.85, 5), mist(g.w * 0.5, g.horizon - g.h * 0.012, g.w * 0.7, g.h * 0.025)] },
      { depth: 0.45, art: (g) => [hills(-g.w * 0.25, g.w * 0.5, g.horizon, g.h * 0.06, 2648, 0.45, 2), hills(g.w * 0.55, g.w * 1.25, g.horizon, g.h * 0.045, 2653, 0.5, 2), mist(g.w * 0.3, g.horizon, g.w * 0.5, g.h * 0.02)] },
      { depth: 0.15, art: (g) => [mist(g.w * 0.75, g.horizon + g.h * 0.004, g.w * 0.45, g.h * 0.018), mist(g.w * 0.15, g.horizon + g.h * 0.006, g.w * 0.35, g.h * 0.015)] },
    ],
    floor: {
      stones: 0,
      art: (f) => {
        // a still puddle between the baskets: dark water holding the stele upside down and the moon above it, a wet rim
        const [px, py] = f.at(0.5, 0.17)
        const rx = Math.min(f.w * 0.05, 130), ry = rx * 1.3 // (the floor lies flat: depth foreshortens)
        let road = ''
        const r = rng(2655)
        for (let i = 0; i < 3; i++) {
          const y = py - ry * 0.7 + i * ry * 0.13, w2 = rx * (0.05 + r() * 0.07)
          road += stroke([[px - w2 + (r() - 0.5) * rx * 0.1, y], [px + w2 + (r() - 0.5) * rx * 0.1, y]], 1.6 + r() * 1.6, 0.3, 0.3, 0.2)
        }
        return [s('path', { class: 't26s-wet', d: blob(px, py, rx * 1.25, ry * 1.25, 2657, 0.14, 20) }), s('path', { class: 't26s-pool', d: blob(px, py, rx, ry, 2656, 0.22, 20) }),
          s('path', { class: 't26s-srefl', d: `M${(px - rx * 0.2).toFixed(1)} ${(py - ry * 0.82).toFixed(1)}L${(px + rx * 0.2).toFixed(1)} ${(py - ry * 0.82).toFixed(1)}L${(px + rx * 0.18).toFixed(1)} ${(py - ry * 0.1).toFixed(1)}Q${px.toFixed(1)} ${(py + ry * 0.05).toFixed(1)} ${(px - rx * 0.18).toFixed(1)} ${(py - ry * 0.1).toFixed(1)}Z` }),
          s('ellipse', { class: 't26s-mglow', cx: px.toFixed(1), cy: (py - ry * 0.86).toFixed(1), rx: (rx * 0.5).toFixed(1), ry: (ry * 0.2).toFixed(1), fill: 'url(#p2-halo)' }), s('ellipse', { class: 't26s-mrefl', cx: px.toFixed(1), cy: (py - ry * 0.86).toFixed(1), rx: (rx * 0.13).toFixed(1), ry: (ry * 0.07).toFixed(1) }), s('path', { class: 't26s-road', d: road }),
          s('path', { class: 't26s-poolrim', d: stroke(curve([px - rx * 0.95, py - ry * 0.1], [px, py - ry * 1.02], [px + rx * 0.95, py - ry * 0.12], 14), 1.4, 0.2, 0.3, 0.2) }),
          ...[0, 1, 2, 3].map((i) => { const [x, y] = f.at(0.06 + i * 0.3, 0.3 + (i % 2) * 0.25); return grass(x, y, 34, 2650 + i) })]
      },
    },
    props: [
      { x: bx, z: 0.03, w: bw, h: bw * 0.82, shadow: 0.25, art: (w) => (re(0), basket(w * 0.92, 2640)) },
      { x: 1 - bx, z: 0.03, w: bw, h: bw * 0.82, shadow: 0.25, art: (w) => (re(1), basket(w * 0.92, 2641)) },
      { x: 0.5, z: 0.3, w: tall ? 0.13 : 0.13, h: tall ? 0.34 : 0.5, art: (_w, hh) => stele(hh / 1.4, 2652) },
      { x: tall ? 0.95 : 0.86, z: 0.42, w: 0.2, h: tall ? 0.36 : 0.44, ring: false, shadow: 0.3, art: (_w, hh) => pine(0, 0, hh, 2649, -1) },
    ],
  })
  const place = () => {
    const H = ctx.art.clientHeight, Hs = stable(H)
    Object.assign(frame.style, { height: `${Hs}px` })
    Object.assign(inner.style, { top: `${-Hs * LIFT}px`, height: `${Hs * (1 + LIFT)}px` })
    // the reading lies on the sand under the basket that took the slip (tall: under both, where the words of the end come)
    const b = fb.dataset.b
    Object.assign(fb.style, { top: `${Hs * (tall ? 0.97 : 0.9)}px`, left: tall || b == null ? '50%' : `${(b === '0' ? bx : 1 - bx) * 100}%` })
    g.refresh() // the count on the stele follows the diorama's layout
  }
  ctx.onCleanup(onSize(ctx.art, place))
  ctx.art.append(root)
  ctx.prompt(K.pill)
  ctx.onCleanup(onDigit((n) => n <= 2 && choose(n - 1)))

  // guidance: a vermilion dot on the slip's corner; the count carved on the stele's foot; while a slip is carried, two
  // faint ink curves from it to the baskets; six seconds still, the slip leans toward them
  const dot = g.dot(slip, { dir: [0, 1] })
  const tm = setTimeout(() => g.refresh(), 400) // once the diorama has laid its props out
  ctx.onCleanup(() => clearTimeout(tm))
  const tally = g.count(K.count, cases.length, () => {
    const st = d.props[2]?.getBoundingClientRect(), base = ctx.art.getBoundingClientRect()
    return st ? [st.left - base.left + st.width / 2, st.bottom - base.top - st.height * 0.08] : [0, 0]
  })
  tally.el.classList.add('t26s-count')
  const ways = s('svg', { class: 't26s-ways', 'aria-hidden': 'true' })
  root.append(ways)
  const showWays = (on: boolean) => {
    if (!on) return void (ways.style.opacity = '0')
    const base = ctx.art.getBoundingClientRect(), a = slip.getBoundingClientRect()
    const from: Pt = [a.left - base.left + a.width / 2, a.bottom - base.top]
    ways.setAttribute('viewBox', `0 0 ${base.width.toFixed(0)} ${base.height.toFixed(0)}`)
    ways.replaceChildren(...bins.map((b) => {
      const r = b.getBoundingClientRect(), to: Pt = [r.left - base.left + r.width / 2, r.top - base.top + r.height * 0.3]
      return s('path', { d: `M${P(from)}Q${P([(from[0] + to[0]) / 2, from[1] + (to[1] - from[1]) * 0.15])} ${P(to)}` })
    }))
    ways.style.opacity = '1'
  }
  const onIdle = () => {
    if (idx >= cases.length || still || slip.classList.contains('held')) return
    slip.animate([{ rotate: '0deg', translate: '0 0' }, { rotate: '-5deg', translate: '-10px 8px' }, { rotate: '4deg', translate: '10px 8px' }, { rotate: '0deg', translate: '0 0' }], { duration: 2200, easing: 'ease-in-out', composite: 'add' })
  }
  ctx.el.addEventListener('p2:idle', onIdle)
  ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', onIdle))

  // the slip comes down from the moon like a leaf: turning over in 3D, swinging side to side, settling in front of you
  function flutter() {
    slip.classList.remove('gone')
    if (still) return
    slip.animate([
      { transform: 'translate(0, -38vh) rotateX(75deg) rotateY(-35deg) rotateZ(-18deg) scale(0.35)', opacity: 0 },
      { transform: 'translate(-9vw, -26vh) rotateX(-50deg) rotateY(28deg) rotateZ(12deg) scale(0.55)', opacity: 1, offset: 0.3 },
      { transform: 'translate(7vw, -12vh) rotateX(35deg) rotateY(-20deg) rotateZ(-8deg) scale(0.78)', offset: 0.62 },
      { transform: 'translate(-2vw, -3vh) rotateX(-12deg) rotateY(8deg) rotateZ(3deg) scale(0.95)', offset: 0.85 },
      { transform: 'none', opacity: 1 },
    ], { duration: 1900, easing: 'cubic-bezier(0.3, 0.1, 0.3, 1)' })
  }
  flutter()

  // drag the slip onto a basket
  let drag: { id: number; x: number; y: number; r: DOMRect[] } | null = null
  slip.addEventListener('pointerdown', (e) => {
    if (idx >= cases.length) return
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, r: bins.map((b) => b.getBoundingClientRect()) }
    slip.setPointerCapture(e.pointerId)
    slip.classList.add('held')
    showWays(true)
  })
  slip.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return
    slip.style.transform = `translate(${(e.clientX - drag.x).toFixed(0)}px, ${(e.clientY - drag.y).toFixed(0)}px) rotate(${((e.clientX - drag.x) * 0.02).toFixed(1)}deg)`
  })
  const drop = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return
    const hit = drag.r.findIndex((r) => e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top - 40 && e.clientY <= r.bottom)
    drag = null
    slip.classList.remove('held')
    slip.style.transform = ''
    showWays(false)
    if (hit >= 0) choose(hit)
  }
  slip.addEventListener('pointerup', drop)
  slip.addEventListener('pointercancel', drop)

  function choose(b: number) {
    if (idx >= cases.length) return
    const c = cases[idx]
    const right = c.banned === (b === 0)
    if (!fb.hasAttribute('aria-live')) fb.setAttribute('aria-live', 'polite')
    const box = d.props[b]
    if (!right) {
      // the basket jumps and throws the slip back up; the prompt says what to look at
      fb.replaceChildren()
      g.wrong(K.wrong)
      box.classList.remove('bounce')
      void box.offsetWidth
      box.classList.add('bounce')
      if (!still) slip.animate([{ transform: 'none' }, { transform: 'translateY(-26px) rotateX(30deg) rotate(-4deg)' }, { transform: 'none' }], { duration: 650, easing: 'ease-out' })
      ctx.chime('low')
      return
    }
    ctx.chime('ok')
    ctx.prompt(K.pill)
    // the reason lies on the sand under the basket that took the slip
    fb.replaceChildren(h('strong', null, K.right), ` — ${c.why}`)
    fb.dataset.b = String(b)
    place()
    count[b]++
    box.dataset.n = String(count[b])
    box.classList.remove('lit')
    void box.offsetWidth
    box.classList.add('lit')
    idx++
    tally.set(idx)
    aria()
    // the slip drops into the basket's mouth
    const a = slip.getBoundingClientRect(), t = box.getBoundingClientRect()
    const dx = t.left + t.width / 2 - (a.left + a.width / 2), dy = t.top + t.height * 0.2 - (a.top + a.height / 2)
    const next = () => {
      if (idx < cases.length) {
        slipText.textContent = cases[idx].text
        flutter()
      } else {
        // one text at the end: the insight (the note on the five cases goes with its details)
        root.classList.add('done')
        dot.done()
        tally.done()
        ctx.insight(F(R.insight), [F(R.detail), F(K.note)])
      }
    }
    slip.classList.add('gone')
    if (still) return next()
    slip.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${dx}px, ${dy - 40}px) rotateX(50deg) scale(0.5)`, opacity: 1, offset: 0.6 }, { transform: `translate(${dx}px, ${dy}px) rotateX(80deg) scale(0.3)`, opacity: 0 }], { duration: 750, easing: 'ease-in' }).finished.then(() => idx <= cases.length && root.isConnected && next(), () => {})
  }
}
