import { fill, h, s } from '../../core/dom'
import type { SceneCtx } from '../types'
import { C } from './data'
import { blob, btn, drawIn, f1, moon, put, stage, stroke, type Pt } from '../t22/kit'

const K = C.scenes.stream

/** Scene 3 — water falls over three stone terraces: Dallas and “capital” fill the pool “Texas”, which spills into “Austin”. */
export function streamScene(ctx: SceneCtx) {
  const ids = K.nodes.map((n) => n.id)
  let step = 0
  let swapped = false
  const nodeBtns = K.nodes.map((n, i) => h('button', { class: `g8s-node t${n.tier}`, type: 'button', onClick: () => go(i) }, h('span', null, n.label)))
  const swapBtn = btn(K.swap, K.swapAria, swap, 'g8s-swap g8-fade g8-abs')
  swapBtn.dataset.off = ''
  const cutLab = h('span', { class: 'g8s-cut g8-abs', 'aria-hidden': 'true' }, K.shortcut)
  const q = h('p', { class: 'g8-q g8s-q g8-abs' }, K.question)
  const limit = h('div', { class: 'g8s-limit g8-fade g8-abs', 'data-off': '' }, ctx.fact(K.limit, 'p', 'g8-note'))
  const back = s('g')
  const flow = s('g')
  const { root, svg } = stage(ctx, 'g8s', K.art, [K.insight], draw)
  svg.append(back, flow)
  root.append(q, ...nodeBtns, cutLab, swapBtn, limit)
  ctx.prompt(K.prompt)
  sync()

  let P: Record<string, Pt> = {}
  let r0 = 30

  function draw(W: number, H: number) {
    const wide = W > 700
    const top = wide ? 64 : 84
    const bot = H - (wide ? 70 : 96)
    const ty = [top + (bot - top) * 0.08, top + (bot - top) * 0.44, top + (bot - top) * 0.78]
    const xs: Record<string, number> = wide ? { dallas: 0.32, capital: 0.68, texas: 0.4, austin: 0.56 } : { dallas: 0.24, capital: 0.76, texas: 0.32, austin: 0.56 }
    P = {}
    K.nodes.forEach((n) => (P[n.id] = [W * (xs[n.id] ?? 0.5), ty[n.tier]]))
    r0 = Math.min(wide ? 70 : 54, W * 0.13)
    // terraces: stone walls under each tier
    const walls = ty.map((y, k) => s('path', { class: 'k', 'fill-opacity': 0.42 - k * 0.06, d: stroke([[W * 0.02, y + r0 * 0.5], [W * 0.3, y + r0 * 0.42], [W * 0.62, y + r0 * 0.56], [W * 0.98, y + r0 * 0.46]], 5, 0.05, 0.05, 0.4), filter: 'url(#ink-rough)' }))
    const terr = ty.map((y, k) => s('path', { class: 'g8s-terr', style: `fill-opacity:${(0.05 + k * 0.03).toFixed(2)}`, d: `M0 ${f1(y - r0 * 0.6)}L${f1(W)} ${f1(y - r0 * 0.5)}L${f1(W)} ${f1(y + r0 * 0.5)}L0 ${f1(y + r0 * 0.5)}Z` }))
    back.replaceChildren(
      moon(W * 0.88, top * 0.55 + 12, Math.min(W, H) * 0.03),
      ...terr, ...walls,
      ...K.edges.map(([a, b]) => s('path', { class: `g8s-bed${isCut(a, b) ? ' cut' : ''}`, d: chan(a, b, 1) })),
      ...K.nodes.map((n, i) => s('path', { class: 'g8s-pool', d: blob(P[n.id][0], P[n.id][1], r0 * (n.tier === 2 ? 1.1 : 0.9), r0 * 0.36, i + 5, 0.08) })))
    nodeBtns.forEach((b, i) => {
      const [x, y] = P[ids[i]]
      put(b, x - r0, y - 24, r0 * 2)
    })
    const [d0, d1] = [P.dallas, P.austin]
    const cx = d0[0] + (d1[0] - d0[0]) * 0.75 - Math.sin(Math.PI * 0.75) * r0 * 1.8
    const cy = d0[1] + r0 * 0.3 + (d1[1] - d0[1] - r0 * 0.6) * 0.75
    put(cutLab, Math.max(4, cx - 128), cy - 8, 120)
    put(q, 12, 8, W - 24)
    const [ax, ay] = P.austin
    put(swapBtn, wide ? Math.min(W - 280, ax + r0 * 1.4) : W / 2 - 140, wide ? ay - 22 : ay + r0 * 0.4 + 6, 280)
    put(limit, 16, H - (wide ? 52 : 70), W - 32)
    drawFlow(false)
  }

  function isCut(a: string, b: string) {
    return a === 'dallas' && b === 'austin'
  }
  function chan(a: string, b: string, k: number) {
    const [x1, y1] = P[a], [x2, y2] = P[b]
    const bend = isCut(a, b) ? -r0 * 1.8 : 0
    const pts: Pt[] = Array.from({ length: 13 }, (_, i) => {
      const t = i / 12
      return [x1 + (x2 - x1) * t + Math.sin(Math.PI * t) * bend, y1 + r0 * 0.3 + (y2 - y1 - r0 * 0.6) * t]
    })
    return k ? stroke(pts, isCut(a, b) ? 3 : 9, 0.1, 0.1, 0.4) : `M${pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')}`
  }

  function drawFlow(animate: boolean) {
    flow.replaceChildren()
    const filled = new Set(ids.slice(0, step))
    for (const [a, b] of K.edges) {
      if (!filled.has(a) || !filled.has(b)) continue
      const p = s('path', { class: `g8s-water${isCut(a, b) ? ' cut' : ''}`, d: chan(a, b, 0) })
      flow.append(p)
      if (animate && b === ids[step - 1]) drawIn(ctx, p, 1100)
    }
    for (const id of filled) {
      const [x, y] = P[id]
      flow.append(s('ellipse', { class: 'g8s-shine', cx: f1(x), cy: f1(y), rx: f1(r0 * 0.7), ry: f1(r0 * 0.2) }))
    }
  }

  function sync() {
    nodeBtns.forEach((b, i) => {
      const n = K.nodes[i]
      const isNext = i === step
      b.classList.toggle('next', isNext)
      b.classList.toggle('full', i < step)
      b.setAttribute('aria-disabled', String(!isNext))
      b.setAttribute('aria-label', isNext ? fill(K.stepAria, { label: label(i) }) : `${n.aria}${swapped && n.id !== 'dallas' && n.id !== 'capital' ? ` · ${label(i)}` : ''}`)
    })
  }
  function label(i: number) {
    return swapped && ids[i] === 'texas' ? K.swapTo : swapped && ids[i] === 'austin' ? K.swapResult : K.nodes[i].label
  }

  function go(i: number) {
    if (i !== step) return
    step++
    ctx.chime(step === ids.length ? 'ok' : 'tap')
    drawFlow(true)
    sync()
    if (step === ids.length) {
      delete swapBtn.dataset.off
      ctx.insight(K.insight, K.detail)
    } else nodeBtns[step].focus({ preventScroll: true })
  }

  function swap() {
    swapped = !swapped
    ;(nodeBtns[ids.indexOf('texas')].firstChild as HTMLElement).textContent = label(ids.indexOf('texas'))
    ;(nodeBtns[ids.indexOf('austin')].firstChild as HTMLElement).textContent = label(ids.indexOf('austin'))
    root.classList.toggle('swapped', swapped)
    swapBtn.setAttribute('aria-pressed', String(swapped))
    delete limit.dataset.off
    ctx.chime('soft')
    sync()
    drawFlow(true)
  }
}
