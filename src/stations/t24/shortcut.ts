import { h, s } from '../../core/dom'
import { L } from '../../core/content'
import type { SceneCtx } from '../types'
import { findTakeaway, takeaway } from '../../ui/part2/takeaway'
import { C } from './data'
import { blob, btn, curve, drawIn, f1, hills, mist, moon, put, rng, stage, stoneArt, stroke, type Pt } from '../t22/kit'

const K = C.scenes.shortcut

/** Scene 3 — a maze of white gravel under the moon, a bronze bell on the gate: the long way rakes every lane; the shortcut slips through the bamboo fence, rings the bell and leaves the gravel unraked. */
export function shortcutScene(ctx: SceneCtx) {
  let done = false
  const task = h('p', { class: 'g8-q g8-abs' }, K.task)
  const pathBtns = K.paths.map((p, i) => btn(p.label, p.aria, () => walk(i), 'g8-abs'))
  const bellLab = h('span', { class: 'g8c-bell g8-abs g8-fade', 'data-off': '' }, K.bell)
  const reveal = h('p', { class: 'g8c-reveal g8-abs g8-fade', 'data-off': '' }, K.reveal)
  const sheet = h('div', { class: 'g8-sheet', hidden: true })
  const back = s('g')
  const trail = s('g')
  const front = s('g')
  const { root, svg } = stage(ctx, 'g8c', K.art, [K.insight], draw)
  svg.append(back, trail, front)
  root.append(task, ...pathBtns, bellLab, reveal, sheet)
  ctx.prompt(K.prompt)

  let routes: string[] = []

  function draw(W: number, H: number) {
    const wide = W > 760
    put(task, 12, 6, W - 24)
    const x0 = wide ? W * 0.18 : 14, x1 = wide ? W * 0.82 : W - 14
    const y0 = wide ? 132 : 150, y1 = H - (wide ? 120 : 156)
    const lanes = 4
    const lh = (y1 - y0) / lanes
    const r = rng(24)
    // the garden seen from a little above: far lanes narrower and shallower (plan → view)
    const cxm = (x0 + x1) / 2
    const depth = (y: number) => Math.max(0, Math.min(1, (y - y0) / (y1 - y0)))
    const T = ([x, y]: Pt): Pt => { const t = depth(y); const k = 0.74 + 0.26 * t; return [cxm + (x - cxm) * k, y0 + (y1 - y0) * t * (0.72 + 0.28 * t)] }
    const K0 = (y: number) => 0.74 + 0.26 * depth(y)
    const TP = (pts: Pt[]) => pts.map(T)
    const start: Pt = [x0 + lh * 0.5, y1 - lh / 2]
    const bell: Pt = [x1 - lh * 0.5, y0 - 2]
    // the long way: back and forth through every lane
    const long: Pt[] = [start]
    for (let k = lanes - 1; k >= 0; k--) {
      const y = y0 + k * lh + lh / 2
      const goRight = (lanes - 1 - k) % 2 === 0
      long.push([goRight ? x1 - lh * 0.5 : x0 + lh * 0.5, y])
      if (k > 0) long.push([goRight ? x1 - lh * 0.5 : x0 + lh * 0.5, y - lh])
    }
    long.push(bell)
    const mid: Pt = [(start[0] + bell[0]) / 2 - lh * 0.3, (start[1] + bell[1]) / 2]
    const short = curve(start, mid, bell, 30)
    const dense = (pts: Pt[]) => pts.flatMap((p, i) => (i ? Array.from({ length: 8 }, (_, j) => [pts[i - 1][0] + ((p[0] - pts[i - 1][0]) * (j + 1)) / 8, pts[i - 1][1] + ((p[1] - pts[i - 1][1]) * (j + 1)) / 8] as Pt) : [p]))
    const P = (pts: Pt[]) => `M${pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')}`
    routes = [P(TP(dense(long))), P(TP(short))]
    // where the shortcut crosses each fence (the gap it slips through)
    const crossX = (y: number) => short.reduce((a, b) => (Math.abs(b[1] - y) < Math.abs(a[1] - y) ? b : a))[0]
    // the gravel field: no hard edge, a pale wash fading out; a border of dark stones along the near and far edges
    const [fx0, fy0] = T([x0, y0]), [fx1] = T([x1, y0]), [nx0, ny1] = T([x0, y1]), [nx1] = T([x1, y1])
    const field = `M${f1(fx0 - 10)} ${f1(fy0 - 6)}L${f1(fx1 + 10)} ${f1(fy0 - 6)}L${f1(nx1 + 14)} ${f1(ny1 + 8)}L${f1(nx0 - 14)} ${f1(ny1 + 8)}Z`
    // raked lines along each lane (shown once the long way is walked) and the unraked scuff (shown otherwise)
    let rake = '', mess = ''
    for (let k = 0; k < lanes; k++) for (let j = 1; j < 6; j++) {
      const y = y0 + k * lh + (j * lh) / 6
      rake += stroke(TP([[x0 + 8, y], [cxm, y + (r() - 0.5) * 1.6], [x1 - 8, y]]), 1.5 * K0(y), 0.05, 0.05, 0.5)
    }
    for (let i = 0; i < 170; i++) {
      const x = x0 + 8 + r() * (x1 - x0 - 16), y = y0 + 6 + r() * (y1 - y0 - 12)
      const len = (4 + r() * 14) * K0(y), a = (r() - 0.5) * 1.4
      const p = T([x, y])
      mess += stroke([p, [p[0] + Math.cos(a) * len, p[1] + Math.sin(a) * len * 0.6]], (1 + r() * 0.8) * K0(y), 0.3, 0.3, 0.2)
    }
    // bamboo fences between lanes: canes of uneven height with nodes, two rails, a few cord ties; one opening at
    // alternating ends, and a narrow gap where the shortcut slips through
    let canes = '', rails = '', nodes = '', ties = ''
    const fence = (a: number, b: number, y: number) => {
      const k = K0(y)
      const A = T([a, y]), B = T([b, y])
      const hgt = lh * 0.48 * k
      rails += stroke([[A[0], A[1] - hgt * 0.62], [B[0], B[1] - hgt * 0.62 + (r() - 0.5)]], 2.6 * k, 0.02, 0.02, 0.6) + stroke([[A[0], A[1] - hgt * 0.25], [B[0], B[1] - hgt * 0.25]], 2.2 * k, 0.02, 0.02, 0.6)
      for (let x = A[0] + 2; x <= B[0] - 1; x += (14 + r() * 12) * k) {
        const hh = hgt * (0.85 + r() * 0.3)
        canes += stroke([[x, A[1] + 2], [x + (r() - 0.5), A[1] - hh / 2], [x + (r() - 0.5) * 1.5, A[1] - hh]], (2.4 + r() * 1.6) * k, 0.03, 0.06, 0.6)
        if (r() < 0.7) nodes += stroke([[x - 2 * k, A[1] - hh * (0.4 + r() * 0.2)], [x + 2 * k, A[1] - hh * 0.45]], 1.2, 0.2, 0.2, 0.4)
        if (r() < 0.22) ties += stroke([[x - 3 * k, A[1] - hgt * 0.6], [x + 3 * k, A[1] - hgt * 0.68]], 1.6 * k, 0.2, 0.2, 0.4)
      }
    }
    for (let k = 1; k < lanes; k++) {
      const y = y0 + k * lh
      const open = k % 2 ? x1 - lh * 0.9 : x0 + lh * 0.9
      const [a, b] = k % 2 ? [x0, open - lh * 0.5] : [open + lh * 0.5, x1]
      const g = crossX(y)
      if (g > a + 8 && g < b - 8) {
        fence(a, g - 12, y)
        fence(g + 12, b, y)
      } else fence(a, b, y)
    }
    fence(x0, x1 - lh * 1.05, y0)
    // the gate at the bell: two posts, a curved top beam, a crossbar; the bronze bell hanging on a red cord
    const [bx, by] = T(bell)
    const gk = K0(y0)
    const gw = Math.max(26, lh * 0.5 * gk), gh = Math.max(46, lh * 1.0 * gk)
    const gate = stroke([[bx - gw, by + 8], [bx - gw, by - gh]], 5.5, 0.03, 0.05, 0.6) + stroke([[bx + gw, by + 8], [bx + gw, by - gh]], 5.5, 0.03, 0.05, 0.6) +
      stroke(curve([bx - gw * 1.5, by - gh - 4], [bx, by - gh - 14], [bx + gw * 1.5, by - gh - 4], 12), 6.5, 0.1, 0.1, 0.6) + stroke([[bx - gw * 1.12, by - gh + 10], [bx + gw * 1.12, by - gh + 10]], 3.6, 0.05, 0.05, 0.6)
    const bw = Math.max(9, gw * 0.36), bt = by - gh + 18
    const bellD = `M${f1(bx - bw)} ${f1(bt + bw * 2.3)}Q${f1(bx - bw * 1.02)} ${f1(bt + bw * 0.2)} ${f1(bx)} ${f1(bt)}Q${f1(bx + bw * 1.02)} ${f1(bt + bw * 0.2)} ${f1(bx + bw)} ${f1(bt + bw * 2.3)}Q${f1(bx)} ${f1(bt + bw * 2.55)} ${f1(bx - bw)} ${f1(bt + bw * 2.3)}Z`
    // a small figure, slipping through the gap in the middle fence
    const [fx, fy] = T([crossX(y0 + 2 * lh) - 2, y0 + 2 * lh])
    const u = Math.max(1.4, lh * 0.022) * K0(y0 + 2 * lh)
    const figure = stroke([[fx - 4 * u, fy - 15 * u], [fx, fy - 17.5 * u], [fx + 4 * u, fy - 15 * u]], 2.2 * u, 0.2, 0.2, 0.3) + stroke([[fx, fy - 14 * u], [fx + 2.5 * u, fy - 7 * u], [fx + 1 * u, fy]], 4 * u, 0.05, 0.3, 0.4) +
      stroke([[fx + 1 * u, fy - 10 * u], [fx + 7 * u, fy - 9 * u], [fx + 10 * u, fy - 13 * u]], 1.5 * u, 0.1, 0.3, 0.3) + stroke([[fx + 1 * u, fy - 1 * u], [fx - 4 * u, fy + 5 * u]], 1.7 * u, 0.1, 0.4, 0.3)
    const [sx, sy] = T(start)
    // garden rocks with moss in two corners
    const rock = (p: Pt, w: number, seed: number) => s('g', { transform: `translate(${f1(p[0])} ${f1(p[1])})` }, stoneArt(w, w * 0.55, seed))
    back.replaceChildren(
      s('defs', null,
        s('radialGradient', { id: 'g8c-field', cx: 0.5, cy: 0.55, r: 0.62 },
          s('stop', { offset: 0, class: 'g8c-f0' }), s('stop', { offset: 0.78, class: 'g8c-f1' }), s('stop', { offset: 1, class: 'g8c-f2' })),
        s('linearGradient', { id: 'g8c-bronze', x1: 0, y1: 0, x2: 1, y2: 0.4 },
          s('stop', { offset: 0, class: 'g8c-br0' }), s('stop', { offset: 0.5, class: 'g8c-br1' }), s('stop', { offset: 1, class: 'g8c-br2' }))),
      mist(W * 0.5, fy0 - 30, W * 0.5, 60),
      moon(W * (wide ? 0.88 : 0.84), wide ? 78 : 104, Math.min(W, H) * (wide ? 0.034 : 0.045), 241, true),
      hills(fx0 - W * 0.14, fx1 + W * 0.14, fy0 - 6, Math.min(80, y0 * 0.6), 2411, 0.9, 5),
      hills(fx0 - W * 0.1, fx0 + (fx1 - fx0) * 0.35, fy0 - 4, Math.min(70, y0 * 0.5), 2414, 0.5, 2),
      mist(W * 0.5, fy0 - 4, (fx1 - fx0) * 0.7, 16),
      s('path', { class: 'g8c-bed', d: field, fill: 'url(#g8c-field)' }),
      s('path', { class: 'g8c-mess', d: mess }),
      s('path', { class: 'g8c-rake', d: rake, filter: 'url(#ink-dry)' }),
      s('path', { class: 'g8c-border', d: stroke([[nx0 - 14, ny1 + 6], [(nx0 + nx1) / 2, ny1 + 9], [nx1 + 14, ny1 + 6]], 3.2, 0.05, 0.05, 0.5) + stroke([[fx0 - 10, fy0 - 4], [fx1 + 10, fy0 - 4]], 2, 0.05, 0.05, 0.5), filter: 'url(#ink-rough)' }),
      rock([nx0 - 6, ny1 + 10], Math.max(36, lh * 0.7), 2415),
      rock([nx1 + 4, ny1 + 12], Math.max(28, lh * 0.5), 2416),
      s('path', { class: 'g8c-start', d: blob(sx, sy + 4, 9, 4, 2413, 0.2, 10) }))
    front.replaceChildren(
      s('path', { class: 'g8c-cane', d: canes, filter: 'url(#ink-rough)' }),
      s('path', { class: 'g8c-rail', d: rails + ties }),
      s('path', { class: 'g8c-node', d: nodes }),
      s('path', { class: 'g8c-gate', d: gate, filter: 'url(#ink-rough)' }),
      s('path', { class: 'g8c-cord', d: `M${f1(bx)} ${f1(by - gh + 10)}V${f1(bt + 1)}` }),
      s('g', { class: 'g8c-bellg' },
        s('circle', { class: 'g8c-bell-glow', cx: f1(bx), cy: f1(bt + bw * 1.4), r: f1(bw * 3.2), fill: 'url(#p2-lamp)' }),
        s('path', { class: 'g8c-bronze', d: bellD, fill: 'url(#g8c-bronze)' }),
        s('path', { class: 'g8c-bell-ink', d: stroke([[bx - bw * 1.02, bt + bw * 2.25], [bx, bt + bw * 2.45], [bx + bw * 1.02, bt + bw * 2.25]], 2, 0.1, 0.1, 0.4) + stroke([[bx - bw * 0.85, bt + bw * 1.1], [bx + bw * 0.85, bt + bw * 1.1]], 1.2, 0.2, 0.2, 0.4), filter: 'url(#ink-rough)' }),
        s('path', { class: 'g8c-bell-hi', d: stroke(curve([bx - bw * 0.55, bt + bw * 0.5], [bx - bw * 0.72, bt + bw * 1.2], [bx - bw * 0.6, bt + bw * 1.9], 6), 2, 0.3, 0.3, 0.1) }),
        s('circle', { class: 'g8c-clapper', cx: f1(bx), cy: f1(bt + bw * 2.55), r: f1(bw * 0.18) })),
      s('path', { class: 'g8c-figure', d: figure, filter: 'url(#ink-rough)' }))
    front.querySelector<SVGGElement>('.g8c-bellg')!.style.transformOrigin = `${f1(bx)}px ${f1(by - gh + 10)}px`
    put(bellLab, bx - gw * 1.6 - 154, by - gh - 6, 150)
    if (wide) {
      put(pathBtns[0], W * 0.5 - 300, H - 62, 290)
      put(pathBtns[1], W * 0.5 + 10, H - 62, 290)
      put(reveal, x0, ny1 + 18, x1 - x0)
    } else {
      put(pathBtns[0], 12, H - 110, W - 24)
      put(pathBtns[1], 12, H - 58, W - 24)
      put(reveal, 12, ny1 + 12, W - 24)
    }
  }

  function walk(i: number) {
    const honest = K.paths[i].honest
    pathBtns.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)))
    const p = s('path', { class: `g8c-trail${honest ? '' : ' cheat'}`, d: routes[i] })
    trail.replaceChildren(p)
    drawIn(ctx, p, honest ? 3200 : 1100)
    root.classList.toggle('raked', honest)
    root.classList.toggle('cheat', !honest)
    root.classList.remove('ring')
    const ms = ctx.reduced ? 0 : honest ? 3200 : 1100
    const t = setTimeout(() => {
      root.classList.add('ring')
      delete bellLab.dataset.off
      ctx.chime('ok')
      if (honest) {
        reveal.dataset.off = ''
        return
      }
      delete reveal.dataset.off
      if (done) return
      done = true
      ctx.insight(K.insight, K.detail)
      const card = findTakeaway(K.takeaway)
      if (!card) return
      const t2 = setTimeout(() => {
        sheet.replaceChildren(h('button', { class: 'g8-close', type: 'button', 'aria-label': L.close, onClick: () => (sheet.hidden = true) }, '×'), takeaway(card, null, ctx.onCleanup))
        sheet.hidden = false
      }, ctx.reduced ? 0 : 1800)
      ctx.onCleanup(() => clearTimeout(t2))
    }, ms)
    ctx.onCleanup(() => clearTimeout(t))
  }
}
