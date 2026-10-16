import { fill, h, s } from '../../core/dom'
import type { SceneCtx } from '../types'
import { C } from './data'
import { blob, btn, drawIn, f1, grass, hills, mist, moon, put, reeds, rng, stage, stroke, type Pt } from '../t22/kit'

const K = C.scenes.stream

/** Scene 3 — a moonlit stream over three stone terraces: Dallas and “capital” spring from the rocks, fill the pool “Texas”, which spills into “Austin”; a thin trickle cuts straight down. */
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
    const top = wide ? 74 : 92
    const bot = H - (wide ? 70 : 96)
    const ty = [top + (bot - top) * 0.1, top + (bot - top) * 0.46, top + (bot - top) * 0.8]
    const xs: Record<string, number> = wide ? { dallas: 0.32, capital: 0.68, texas: 0.42, austin: 0.58 } : { dallas: 0.24, capital: 0.76, texas: 0.34, austin: 0.58 }
    P = {}
    K.nodes.forEach((n) => (P[n.id] = [W * (xs[n.id] ?? 0.5), ty[n.tier]]))
    r0 = Math.min(wide ? 70 : 54, W * 0.13)
    const r = rng(2303)
    // each terrace: a moonlit floor, its lip brushed in ink, a wall of stacked stones down to the next floor
    const lip = (k: number): Pt[] => Array.from({ length: 21 }, (_, i) => { const x = -20 + ((W + 40) * i) / 20; return [x, ty[k] + r0 * 0.42 + Math.sin(i * 0.7 + k * 2) * r0 * 0.05 + (i - 10) * (k % 2 ? 0.6 : -0.5)] as Pt })
    const floorTop = (k: number) => ty[k] - r0 * 0.55
    const terraces: SVGElement[] = []
    for (let k = 0; k < 3; k++) {
      const L = lip(k)
      const yTop = floorTop(k)
      const floor = `M-20 ${f1(yTop)}Q${f1(W * 0.5)} ${f1(yTop - r0 * 0.12)} ${f1(W + 20)} ${f1(yTop)}L${L.map(([x, y]) => `${f1(x)} ${f1(y)}`).reverse().join('L')}Z`
      terraces.push(s('path', { class: `g8s-floor f${k}`, d: floor, fill: 'url(#g8s-floor)' }))
      // the wall under this lip, down to the next floor (the last one fades into the ground)
      const wallBot = k < 2 ? floorTop(k + 1) : Math.min(H, ty[k] + r0 * 1.15)
      // dry-laid stones in clusters along the wall (the rest left to the shadow wash): a pale face each, the contour
      // brushed heavier on the shaded lower side
      let stones = '', dark = '', ink = ''
      const top0 = L[10][1], hgt = wallBot - top0
      const sh0 = Math.min(r0 * 0.3, hgt * 0.36)
      for (let c = 0, x = -10 + r() * 60; x < W + 10; c++, x += r0 * (1.2 + r() * 1.9)) {
        const n = 4 + Math.floor(r() * 5)
        for (let j = 0; j < n; j++) {
          const sw = r0 * (0.32 + r() * 0.4), sh = sh0 * (0.75 + r() * 0.5)
          const row = j < n * 0.6 ? 0 : 1
          const sx = x + (j - (row ? n * 0.6 : 0)) * r0 * 0.42 + (row ? r0 * 0.2 : 0) + (r() - 0.5) * 6
          const sy = top0 + sh * (0.75 + row * 1.6) + (r() - 0.5) * 3
          if (sy + sh > wallBot + 4) continue
          const d = blob(sx, sy, sw / 2, sh * 0.5, 500 + k * 97 + c * 13 + j, 0.16, 12)
          if (r() < 0.3) dark += d
          else stones += d
          ink += stroke(Array.from({ length: 9 }, (_, i) => { const a = Math.PI * (-0.1 + (i / 8) * 1.05); return [sx + Math.cos(a) * sw * 0.5, sy + Math.sin(a) * sh * 0.5] as Pt }), 1 + r() * 1.3, 0.25, 0.3, 0.2)
        }
      }
      terraces.push(
        // the drop under the lip: a shadow that fades down the wall
        s('path', { class: 'g8s-drop', d: `M${L.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}L${f1(W + 20)} ${f1(wallBot)}L-20 ${f1(wallBot)}Z`, fill: 'url(#g8s-drop)' }),
        s('path', { class: 'g8s-wall', d: stones, fill: 'url(#p2-rock)' }),
        s('path', { class: 'g8s-wall dark', d: dark, fill: 'url(#p2-rock)' }),
        s('path', { class: 'g8s-wall-ink', d: ink, filter: 'url(#ink-rough)' }),
        s('path', { class: 'g8s-lip', d: stroke(L, 3.2, 0.03, 0.03, 0.4), filter: 'url(#ink-rough)' }))
    }
    // springs: a dark cleft in a rock above each top source
    const spring = (x: number, y: number, seed: number) => s('g', { class: 'g8s-spring' },
      s('path', { class: 'g8s-rock', d: blob(x, y - r0 * 0.62, r0 * 0.5, r0 * 0.28, seed, 0.18), fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
      s('path', { class: 'g8s-cleft', d: stroke([[x - r0 * 0.05, y - r0 * 0.7], [x, y - r0 * 0.55], [x + r0 * 0.03, y - r0 * 0.42]], r0 * 0.07, 0.2, 0.2, 0.3) }))
    back.replaceChildren(
      s('defs', null,
        s('linearGradient', { id: 'g8s-drop', x1: 0, y1: 0, x2: 0, y2: 1 },
          s('stop', { offset: 0, style: 'stop-color:var(--umbra);stop-opacity:.2' }),
          s('stop', { offset: 1, style: 'stop-color:var(--umbra);stop-opacity:0' })),
        s('linearGradient', { id: 'g8s-floor', x1: 0, y1: 0, x2: 0, y2: 1 },
          s('stop', { offset: 0, class: 'g8s-fl0' }),
          s('stop', { offset: 1, class: 'g8s-fl1' }))),
      mist(W * 0.5, floorTop(0) - 20, W * 0.6, 60),
      moon(W * 0.9, top * 0.55 + 6, Math.min(W, H) * 0.03, 23, false),
      hills(-W * 0.04, W * 1.04, floorTop(0) + 4, Math.max(30, top * 0.6), 2304, 0.88, 6),
      mist(W * 0.5, floorTop(0) + 2, W * 0.6, 16),
      ...terraces,
      ...K.edges.map(([a, b]) => s('path', { class: `g8s-bed${isCut(a, b) ? ' cut' : ''}`, d: chan(a, b, 1) })),
      ...K.nodes.map((n, i) => {
        const [x, y] = P[n.id]
        const rx = r0 * (n.tier === 2 ? 1.12 : 0.92), ry = r0 * 0.36
        return s('g', { class: 'g8s-pool' },
          s('path', { class: 'g8s-pool-water', d: blob(x, y, rx, ry, i + 5, 0.08), fill: 'url(#p2-water-v)' }),
          s('path', { class: 'g8s-pool-rim', d: stroke(Array.from({ length: 17 }, (_, j) => { const a = Math.PI * (1.02 + (j / 16) * 0.96); return [x + Math.cos(a) * rx, y + Math.sin(a) * ry] as Pt }), 2.4, 0.2, 0.2, 0.2) + stroke(Array.from({ length: 13 }, (_, j) => { const a = Math.PI * (0.12 + (j / 12) * 0.76); return [x + Math.cos(a) * rx * 1.02, y + Math.sin(a) * ry * 1.06] as Pt }), 1.6, 0.2, 0.2, 0.2), filter: 'url(#ink-rough)' }))
      }),
      spring(P.dallas[0], P.dallas[1], 2305),
      spring(P.capital[0], P.capital[1], 2306),
      reeds(W * 0.05, ty[2] + r0 * 0.5, r0 * 1.2, 2307, 6),
      reeds(W * 0.96, ty[1] + r0 * 0.4, r0 * 0.9, 2308, 5),
      grass(W * 0.2, ty[1] + r0 * 0.38, r0 * 0.5, 2309),
      grass(W * 0.82, ty[2] + r0 * 0.4, r0 * 0.5, 2310))
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
    // a stream meanders a little; the shortcut bows out wide
    const wig = isCut(a, b) ? 0 : r0 * 0.12 * (x2 > x1 ? 1 : -1)
    const pts: Pt[] = Array.from({ length: 17 }, (_, i) => {
      const t = i / 16
      return [x1 + (x2 - x1) * t + Math.sin(Math.PI * t) * bend + Math.sin(Math.PI * 2 * t) * wig, y1 + r0 * 0.3 + (y2 - y1 - r0 * 0.6) * t]
    })
    return k ? stroke(pts, isCut(a, b) ? 3 : 10, 0.1, 0.1, 0.4) : `M${pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')}`
  }

  function drawFlow(animate: boolean) {
    flow.replaceChildren()
    const filled = new Set(ids.slice(0, step))
    for (const [a, b] of K.edges) {
      if (!filled.has(a) || !filled.has(b)) continue
      const p = s('path', { class: `g8s-water${isCut(a, b) ? ' cut' : ''}`, d: chan(a, b, 0) })
      flow.append(p)
      if (animate && b === ids[step - 1]) drawIn(ctx, p, 1100)
      // white water where the stream drops over a terrace lip
      if (!isCut(a, b)) {
        const [x1, y1] = P[a], [x2, y2] = P[b]
        const t = 0.42, x = x1 + (x2 - x1) * t, y = y1 + r0 * 0.3 + (y2 - y1 - r0 * 0.6) * t
        flow.append(s('path', { class: 'g8s-foam', d: stroke([[x - 3, y - r0 * 0.3], [x, y], [x + 2, y + r0 * 0.3]], 3, 0.3, 0.3, 0.2) + stroke([[x + 5, y - r0 * 0.2], [x + 6, y + r0 * 0.25]], 1.6, 0.3, 0.3, 0.2) }))
      }
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
