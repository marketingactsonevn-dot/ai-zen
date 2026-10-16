import { fill, h, s } from '../../core/dom'
import { blob, clamp, curve, onSize, stroke, type Pt } from '../../ui/part2/ink'
import { paperLantern, pine } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import { C } from './content'
import { F, f1, gdefs, ink, wood, woodG } from '../t34/night'

const K = C.scenes.line
const N = K.stations.length

/** Floor boards running toward us from y0 to y1 (lines further apart as they come near), fading out at the sides. */
function floorBoards(x0: number, x1: number, y0: number, y1: number): string {
  let d = ''
  for (let k = 1, y = y0; y < y1 - 6 && k < 12; k++) {
    y = y0 + (y1 - y0) * Math.pow(k / 10, 1.6)
    const inset = (x1 - x0) * 0.08 * (1 - k / 12)
    d += stroke([[x0 + inset, y], [(x0 + x1) / 2, y + 0.8], [x1 - inset, y]], 1 + k * 0.12, 0.25, 0.25, 0.1)
  }
  return d
}

/** Scene 4 — an ink cord across the workshop with eight paper lanterns: light them to join the line, set a vermilion stone where a person must approve. */
export function lineScene(ctx: SceneCtx) {
  gdefs()
  const lit = new Set<number>()
  const stones = new Set<number>()
  let done = false
  let segs: SVGGElement[] = []
  const cells = K.stations.map((st, i) => {
    const art = s('svg', { class: 't35d-lamp-art', viewBox: '0 0 40 52', 'aria-hidden': 'true' }, paperLantern(20, 0, 9.5, 3540 + i, 7))
    const lamp = h('button', { class: 't35d-lamp', type: 'button', 'aria-pressed': 'false', 'aria-label': fill(K.stationAria, { n: i + 1, name: st.name }), onClick: () => light(i) },
      art, h('span', { class: 't35d-name' }, st.name))
    // the approval stone: an empty place on the floor, or a vermilion seal stone once set
    const seal = s('svg', { class: 't35d-seal', viewBox: '0 0 44 30', 'aria-hidden': 'true' },
      s('path', { class: 't35d-seal-place', d: blob(22, 17, 17, 9, 3550 + i, 0.12, 14) }),
      s('g', { class: 't35d-seal-stone' },
        s('ellipse', { class: 'g12-contact', cx: 23, cy: 25, rx: 17, ry: 3 }),
        ink(blob(22, 16, 16, 9.5, 3560 + i, 0.14, 14), 't35d-seal-body', 'rough'),
        ink(`M16 10h12v10h-12ZM19 13h6M22 13v5M19 18h6`, 't35d-seal-mark'),
        ink(stroke(curve([9, 12], [16, 7], [26, 8], 6), 1.6, 0.3, 0.3, 0.1), 't35d-seal-hi')))
    const stone = h('button', { class: 't35d-stone', type: 'button', 'aria-pressed': 'false', 'aria-label': fill(K.stoneAria, { name: st.name }), onClick: () => seal_(i) }, seal)
    return { el: h('li', { class: 't35d-cell' }, lamp, stone), lamp, stone, art }
  })
  const back = s('svg', { class: 't35d-back', 'aria-hidden': 'true' })
  const note = h('div', { class: 't35d-note', 'aria-live': 'polite' })
  const wrap = h('div', { class: 't35d-wrap' }, h('ol', { class: 't35d-line', 'aria-label': K.lineAria }, ...cells.map((c) => c.el)))
  const root = h('div', { class: 't35 t35d' },
    back,
    h('p', { class: 'visually-hidden' }, K.art),
    h('p', { class: 'p2-eyebrow t35d-task' }, K.task),
    wrap,
    note)
  ctx.art.append(root)
  ctx.prompt(K.prompt)
  ctx.onCleanup(onSize(ctx.art, layout))
  ctx.onCleanup(onSize(note, layout)) // a longer note re-centres the line: follow it

  /** The workshop and the cord through the tops of the lanterns, measured from where the lanterns are now. */
  function layout() {
    const W = root.clientWidth, H = root.clientHeight
    if (W < 60 || H < 60) return
    const R = root.getBoundingClientRect()
    const boxes = cells.map((c) => {
      const b = c.art.getBoundingClientRect(), st = c.stone.getBoundingClientRect()
      return { x: b.left - R.left + b.width / 2, top: b.top - R.top + 1, bot: b.bottom - R.top - b.height * 0.12, floor: st.bottom - R.top }
    })
    const tops = boxes.map((b) => [b.x, b.top] as Pt)
    const row = Math.abs(tops[N - 1][1] - tops[0][1]) < 20
    const out: SVGElement[] = []
    const [a, z] = [tops[0], tops[N - 1]]
    if (row) {
      // two pillars of the workshop hold the cord, the floor the stones rest on, the moon through a high window
      const gap = (z[0] - a[0]) / (N - 1)
      const px0 = Math.max(10, a[0] - gap * 0.62), px1 = Math.min(W - 10, z[0] + gap * 0.62)
      const floor = Math.max(...boxes.map((b) => b.floor)) + 8
      // the back wall: shoji screens lit by the moon behind them, a pine's shadow cast on the paper
      const wy = 6, wb = a[1] - 18
      const n = Math.max(4, Math.round((px1 - px0) / 170))
      const pw = (px1 - px0) / n
      let lat = ''
      for (let k = 0; k < n; k++) {
        const x0 = px0 + k * pw
        for (const f of [1 / 3, 2 / 3]) lat += stroke([[x0 + 4, wy + (wb - wy) * f], [x0 + pw - 4, wy + (wb - wy) * f]], 1.2, 0.05, 0.05, 0.6)
        lat += stroke([[x0 + pw / 2, wy + 4], [x0 + pw / 2, wb - 4]], 1.2, 0.05, 0.05, 0.6)
      }
      const mx = px0 + (px1 - px0) * 0.68
      out.push(
        s('clipPath', { id: 't35d-wall' }, s('rect', { x: f1(px0), y: f1(wy), width: f1(px1 - px0), height: f1(wb - wy) })),
        s('rect', { class: 't35d-shoji', x: f1(px0), y: f1(wy), width: f1(px1 - px0), height: f1(wb - wy) }),
        s('g', { 'clip-path': 'url(#t35d-wall)' },
          s('circle', { class: 't35d-glow', cx: f1(mx), cy: f1(wy + (wb - wy) * 0.42), r: f1((wb - wy) * 1.1), fill: 'url(#p2-halo)' }),
          s('g', { class: 't35d-shadow' }, pine(px0 + (px1 - px0) * 0.12, wb + (wb - wy) * 0.35, (wb - wy) * 1.25, 3549, 1))),
        ink(lat, 'g12-lattice', 'rough'),
        woodG([
          wood([px0 - 10, wy], [px1 + 10, wy], 7, 3541), wood([px0 - 10, wb], [px1 + 10, wb], 7, 3542),
          ...Array.from({ length: n - 1 }, (_, k) => wood([px0 + (k + 1) * pw, wy], [px0 + (k + 1) * pw, wb], 4, 3550 + k)),
        ]),
        ink(blob(W / 2, floor + 6, W * 0.5, 10, 3548, 0.2), 'p2p-wash t35d-floor', 'wash'),
        ink(floorBoards(px0 - 40, px1 + 40, floor + 4, H - 4), 't35d-boards', 'dry'),
        woodG([wood([px0 - gap * 0.4, floor], [px1 + gap * 0.4, floor + 1], 6, 3549)], 't35d-sill'),
        woodG([wood([px0, a[1] - 26], [px0 + 1, floor], 11, 3546), wood([px1, a[1] - 26], [px1 - 1, floor], 11, 3547)], 't35d-frame'),
        ink(stroke(curve([px0 + 4, a[1] - 4], [(px0 + a[0]) / 2, a[1] + 5], a, 8), 1.5, 0.1, 0.1, 0.5) + stroke(curve(z, [(px1 + z[0]) / 2, z[1] + 5], [px1 - 4, z[1] - 4], 8), 1.5, 0.1, 0.1, 0.5), 't35d-thread'))
    }
    if (!row) {
      const wy = Math.max(4, a[1] - 30), wb = Math.min(H - 4, boxes[N - 1].bot + 40)
      const n = 3, pw = W / n
      let lat = ''
      for (let k = 0; k < n; k++) for (let j = 1; j < 6; j++) lat += stroke([[k * pw + 4, wy + ((wb - wy) * j) / 6], [k * pw + pw - 4, wy + ((wb - wy) * j) / 6]], 1, 0.05, 0.05, 0.6)
      out.push(
        s('clipPath', { id: 't35d-wall' }, s('rect', { x: 0, y: f1(wy), width: f1(W), height: f1(wb - wy) })),
        s('rect', { class: 't35d-shoji phone', x: 0, y: f1(wy), width: f1(W), height: f1(wb - wy) }),
        s('g', { 'clip-path': 'url(#t35d-wall)' },
          s('circle', { class: 't35d-glow', cx: f1(W * 0.72), cy: f1(wy + (wb - wy) * 0.3), r: f1(W * 0.6), fill: 'url(#p2-halo)' }),
          s('g', { class: 't35d-shadow' }, pine(W * 0.62, wb + 10, (wb - wy) * 0.7, 3549, -1))),
        ink(lat, 'g12-lattice phone', 'rough'),
        woodG([wood([-10, wy], [W + 10, wy], 6, 3541), wood([-10, wb], [W + 10, wb], 6, 3542), ...Array.from({ length: n - 1 }, (_, k) => wood([(k + 1) * pw, wy], [(k + 1) * pw, wb], 3.5, 3550 + k))]))
    }
    segs = []
    for (let i = 0; i < N - 1; i++) {
      // across: tops joined, sagging; down (phone): the foot of one lantern to the top of the next
      const p: Pt = row ? tops[i] : [boxes[i].x, boxes[i].bot], q = tops[i + 1]
      const mid: Pt = row ? [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2 + clamp((q[0] - p[0]) * 0.12, 4, 16)] : [(p[0] + q[0]) / 2 + 3, (p[1] + q[1]) / 2]
      const pts = curve(p, mid, q, 12)
      const g = s('g', { class: `t35d-seg${lit.has(i) && lit.has(i + 1) ? ' on' : ''}` },
        ink(stroke(pts, 1.4, 0.05, 0.05, 0.6), 't35d-thread'),
        ink(stroke(pts, row ? 4.2 : 3, 0.12, 0.12, 0.35), 't35d-brush', 'rough'))
      segs.push(g)
      out.push(g)
    }
    back.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    back.replaceChildren(...out)
  }

  function paint() {
    segs.forEach((g, i) => g.classList.toggle('on', lit.has(i) && lit.has(i + 1)))
  }
  function light(i: number) {
    if (lit.has(i)) return
    lit.add(i)
    cells[i].lamp.setAttribute('aria-pressed', 'true')
    ctx.chime('tap')
    paint()
    check()
  }
  function seal_(i: number) {
    const st = K.stations[i]
    const on = !stones.has(i)
    if (on) stones.add(i)
    else stones.delete(i)
    cells[i].stone.setAttribute('aria-pressed', String(on))
    if (on) note.replaceChildren(h('p', null, st.human ? (st as { why?: string }).why ?? '' : K.extraStone))
    else note.replaceChildren()
    ctx.chime(on ? 'soft' : 'low')
    check()
  }
  function check() {
    if (done) return
    const missing = K.stations.filter((x, i) => x.human && !stones.has(i)).length
    if (lit.size === N && missing === 0) {
      done = true
      root.classList.add('is-done')
      note.replaceChildren(h('p', { class: 't35d-done' }, K.done), ctx.fact(F(K.facts[0]), 'p', 't35d-fact'))
      ctx.insight(F(K.insight), K.detail)
    } else if (lit.size === N) {
      note.append(h('p', { class: 't35d-miss' }, fill(K.missingStone, { n: missing })))
    }
  }
}
