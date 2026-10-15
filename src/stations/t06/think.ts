import { h, nextId, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { blob, brush, C, clamp, ell, layer, loop, measure, onSize, place, rng, sheet, stableHeight, type Pt } from './ink'

const T = C.scenes.think

interface Tray { x: number; y: number; w: number; h: number }
interface Parts {
  texts: { el: SVGTextElement; clip: SVGRectElement; w: number; x0: number; y: number }[]
  pebbles: SVGGElement[]
  stick: SVGPathElement
  ember: SVGCircleElement
  ash: SVGPathElement
  smoke: SVGPathElement[]
  base: Pt
  len: number
  mark: SVGPathElement
  rest: Pt
}
interface Col {
  key: 'fast' | 'slow'
  btn: HTMLButtonElement
  g: SVGGElement
  fude: SVGGElement
  lines: string[]
  /** pebbles dropped into the dish (tokens) and incense burnt (time) by the end — illustrative */
  pebbles: number
  burn: number
  state: 'idle' | 'running' | 'done'
  tl?: ReturnType<typeof gsap.timeline>
  burnNow: number
  parts?: Parts
  labs: HTMLElement[]
}

/** A calligraphy brush, tip at (0, 0), bamboo handle up and to the right (≈ 34k × 82k). */
function fude() {
  const g = s('g')
  const k = 1
  g.append(
    s('path', { class: 'w1', d: brush([[5 * k, -14 * k], [20 * k, -48 * k], [34 * k, -82 * k]], 4.4 * k, { a: 0, b: 0, min: 1, wob: 0 }).d }),
    s('path', { class: 'k', 'fill-opacity': 0.5, d: brush([[13 * k, -33 * k], [17.5 * k, -31 * k]], 1.2 * k, { min: 0.6 }).d }),
    s('path', { class: 'k', 'fill-opacity': 0.5, d: brush([[23 * k, -57 * k], [27.5 * k, -55 * k]], 1.2 * k, { min: 0.6 }).d }),
    s('path', { class: 'k', d: brush([[3.6 * k, -9 * k], [6.8 * k, -17 * k]], 5.4 * k, { a: 0, b: 0, min: 1, wob: 0 }).d }),
    s('path', { class: 'k', d: brush([[4.6 * k, -11 * k], [2.4 * k, -5 * k], [0, 0]], 6 * k, { a: 0, b: 0.95, min: 0.08, wob: 0 }).d }),
  )
  return g
}
/** At rest the brush lies on the board in front of its paper; it stands up to write. */
const REST_ROT = 64

/** Scene 2 — a still life: an instant answer vs a scratch paper filling with steps; incense = time, pebbles = tokens. */
export function thinkScene(ctx: SceneCtx) {
  const stable = stableHeight(ctx, [T.insight])
  const svg = layer()
  const board = s('g')
  const pens = s('g')
  svg.append(board)
  const q = h('p', { class: 't6t-q' }, h('span', null, T.question), ' ', ctx.tag('illustration'))
  const live = h('p', { class: 'visually-hidden', 'aria-live': 'polite' })
  const root = h('div', { class: 't6 t6t' }, h('p', { class: 'visually-hidden' }, T.art), svg, q, live)
  ctx.art.append(root)

  const mk = (key: 'fast' | 'slow', label: string, aria: string, lines: string[], pebbles: number, burn: number): Col => ({
    key, lines, pebbles, burn, state: 'idle', burnNow: 0, g: s('g'), fude: fude(),
    btn: h('button', { class: 't6-btn', type: 'button', 'aria-label': aria }, label),
    labs: [T.time, T.cost].map((t) => h('span', { class: 't6-lab t6t-lab', 'aria-hidden': 'true' }, t)),
  })
  const cols = [mk('fast', T.fast, T.fastAria, [T.fastAnswer], 4, 0.06), mk('slow', T.slow, T.slowAria, [...T.steps, T.slowAnswer], 46, 0.55)]
  for (const c of cols) {
    root.append(c.btn, ...c.labs)
    svg.append(c.g)
    pens.append(c.fude)
    c.btn.addEventListener('click', () => run(c))
  }
  svg.append(pens)

  let fs = 16
  let fastFs = 18
  let W = 1
  let fk = 1
  let inset = 0
  const pen = (c: Col, x: number, y: number, rot: number) => c.fude.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(1)}) scale(${fk.toFixed(3)})`)

  function layout() {
    W = root.clientWidth
    const Hraw = root.clientHeight
    if (!W || !Hraw) return
    const H = stable.H(Hraw)
    svg.setAttribute('viewBox', `0 0 ${W} ${Hraw}`)
    const land = W / H > 1.1
    // short landscape: the pills sit on the papers' top edge and the trays stand beside the papers
    const side = land && H < 400
    const qw = Math.min(W - 8, side ? W - 8 : land ? 680 : 520)
    q.style.width = `${qw}px`
    const qh = q.offsetHeight
    const pillH = 46
    const n = cols[1].lines.length
    // sizes per 1px of type
    const longest = Math.max(...cols[1].lines.map((l, i) => measure(l, 100, i === n - 1 ? 500 : 400) * (i === n - 1 ? 1.15 : 1))) / 100
    const fastEm = measure(T.fastAnswer, 1, 500)
    const slowWk = longest + 2.9
    const slowHk = n * 1.5 + 1.7
    const fastWk = Math.max(fastEm * 1.15 + 3.6, slowWk * 0.6)
    const overlap = 0.05
    const groupWk = fastWk + slowWk * (1 - overlap)
    const trayWk = side ? clamp(slowHk * 0.62, 5, 8) : 0
    const fsW = (W - 14 - (side ? 2 * 10 : 0)) / (groupWk + 2 * trayWk)
    const fsH = side ? (H - qh - 8 - pillH / 2 - 26) / (slowHk + 0.6) : (H - qh - 12 - pillH - 10 - 6 - 30 - 8) / (slowHk * 1.5 + 0.6)
    fs = clamp(Math.min(fsW, fsH), 12, land ? 30 : 22)
    fastFs = fs * 1.15
    fk = clamp(fs / 16, 0.75, 1.5)
    inset = side ? pillH / 2 : 0
    const lh = fs * 1.5
    const padX = fs * 1.2
    const slowW = slowWk * fs
    const slowH = slowHk * fs + inset
    const fastW = fastWk * fs
    const fastH = Math.max(slowH * 0.58, fastFs * 2.6 + inset)
    const trayW = trayWk * fs
    const trayH = side ? slowH * 0.78 : clamp(slowH * 0.5, 56, 160)
    const groupW = fastW + slowW * (1 - overlap) + (side ? 2 * (trayW + 10) : 0)
    const gx = (W - groupW) / 2 + (side ? trayW + 10 : 0)
    const edge = clamp(fs * 0.55, 6, 14)
    const used = side ? qh + 8 + pillH / 2 + slowH + edge + 18 : qh + 12 + pillH + 10 + slowH + 6 + trayH + edge + 30
    const top = Math.max(0, (H - used) * 0.42)
    place(q, (W - qw) / 2, top)
    const pillY = side ? top + qh + 8 : top + qh + 12
    const paperY = side ? pillY + pillH / 2 : pillY + pillH + 10
    const groundY = side ? paperY + slowH + 4 : paperY + slowH + 6 + trayH
    const boxes = [
      { x: gx, y: paperY + slowH * 0.1, w: fastW, h: fastH, rot: -1.8 },
      { x: gx + fastW - slowW * overlap, y: paperY, w: slowW, h: slowH, rot: 0.9 },
    ]
    drawBoard(boxes[0].x - (side ? trayW + 10 : 0), boxes[1].x + slowW + (side ? trayW + 10 : 0), paperY + slowH * (side ? 0.45 : 0.55), groundY, edge, fs)
    // pills over each paper, pushed apart if they would touch
    const bw = cols.map((c) => c.btn.offsetWidth || 140)
    const cx = boxes.map((b) => b.x + b.w / 2)
    const clash = cx[0] + bw[0] / 2 + 8 - (cx[1] - bw[1] / 2)
    if (clash > 0) (cx[0] -= clash / 2), (cx[1] += clash / 2)
    cols.forEach((c, i) => {
      const b = boxes[i]
      place(c.btn, clamp(cx[i] - bw[i] / 2, 2, W - bw[i] - 2), side ? pillY - pillH / 2 + b.y - paperY : pillY)
      const tw = Math.min(b.w * 1.05, 320)
      const tray: Tray = side
        ? { x: i ? b.x + b.w + 10 : b.x - trayW - 10, y: groundY - trayH, w: trayW, h: trayH }
        : { x: b.x + (b.w - tw) / 2, y: groundY - trayH, w: tw, h: trayH }
      build(c, b.x, b.y, b.w, b.h, padX, lh, tray, b.rot, groundY)
      const p = c.parts!
      // the two meter words under each tray
      c.labs.forEach((l) => (l.hidden = side))
      if (!side) {
        lab(c.labs[0], p.base[0], groundY + edge + 4)
        lab(c.labs[1], dishAt[c.key][0], groundY + edge + 4)
      }
    })
    root.style.setProperty('--t6-fs', `${clamp(fs * 0.82, 12.5, 16)}px`)
  }
  const dishAt: Record<string, Pt> = { fast: [0, 0], slow: [0, 0] }
  function lab(el: HTMLElement, cx: number, y: number) {
    const w = el.offsetWidth || 60
    place(el, clamp(cx - w / 2, 2, W - w - 2), y)
  }

  /** The low wooden board everything stands on: a pale wash top with dry grain, a darker front edge, a soft shadow. */
  function drawBoard(x0: number, x1: number, yTop: number, yFront: number, edge: number, f: number) {
    const m = Math.max(22, f * 1.6)
    x0 -= m
    x1 += m
    const d = (yFront - yTop) * 0.22
    const r = rng(14)
    const topD = `M${x0 + d} ${yTop}L${x1 - d} ${yTop}L${x1} ${yFront}L${x0} ${yFront}Z`
    // wood grain: long thin strokes that swell and taper, a knot with rings
    const grain = s('g', { class: 'w1', filter: 'url(#ink-rough)' })
    for (let i = 0; i < 9; i++) {
      const t = (i + 0.3 + r() * 0.4) / 9
      const y = yTop + (yFront - yTop) * t
      const a = x0 + d * (1 - t) + (x1 - x0) * r() * 0.3
      const b = Math.min(x1 - d * (1 - t), a + (x1 - x0) * (0.3 + r() * 0.5))
      const sag = (r() - 0.5) * (yFront - yTop) * 0.12
      grain.append(s('path', { 'fill-opacity': (0.1 + r() * 0.12).toFixed(2), d: brush([[a, y], [(a + b) / 2, y + sag], [b, y + sag * 0.4]], 0.9 + r() * 1.3, { a: 0.3, b: 0.4, min: 0.2 }).d }))
    }
    const kx = x0 + (x1 - x0) * 0.78, ky = yTop + (yFront - yTop) * 0.45
    for (let k = 1; k <= 3; k++) grain.append(s('path', { 'fill-opacity': 0.16, d: brush([[kx - k * 9, ky], [kx, ky - k * 2.4], [kx + k * 9, ky]], 0.9, { a: 0.3, b: 0.3, min: 0.3 }).d }))
    board.replaceChildren(
      s('path', { class: 't6-sh', 'fill-opacity': 0.1, d: blob((x0 + x1) / 2, yFront + edge + 4, (x1 - x0) * 0.52, edge * 1.1 + 4, 3, 0.05), filter: 'url(#ink-wash)' }),
      s('path', { class: 't6t-board', d: topD, filter: 'url(#ink-rough)' }),
      s('path', { class: 'k', 'fill-opacity': 0.05, d: blob(x0 + (x1 - x0) * 0.62, (yTop + yFront) / 2, (x1 - x0) * 0.3, (yFront - yTop) * 0.4, 7, 0.2), filter: 'url(#ink-wash)' }),
      grain,
      s('path', { class: 't6t-edge', d: `M${x0} ${yFront}L${x1} ${yFront}L${x1 - 2} ${yFront + edge}L${x0 + 2} ${yFront + edge}Z`, filter: 'url(#ink-rough)' }),
      s('path', { class: 'k', 'fill-opacity': 0.55, d: brush([[x0 - 2, yFront], [(x0 + x1) / 2, yFront + 0.6], [x1 + 2, yFront]], Math.max(1.6, edge * 0.24), { a: 0.04, b: 0.2, min: 0.3 }).d, filter: 'url(#ink-rough)' }),
      s('path', { class: 'k', 'fill-opacity': 0.22, d: brush([[x0 + d + 4, yTop], [x1 - d - 4, yTop]], 1.2, { a: 0.2, b: 0.2, min: 0.3 }).d }),
    )
  }

  /** Draw one column: the paper (lines hidden until written), its brush, the incense censer and the pebble dish. */
  function build(c: Col, x: number, y: number, w: number, hh: number, padX: number, lh: number, tray: Tray, rot: number, groundY: number) {
    c.g.replaceChildren()
    const isFast = c.key === 'fast'
    const r = rng(isFast ? 3 : 7)
    const defs = s('defs')
    const paper = s('g', { transform: `rotate(${rot} ${x + w / 2} ${y + hh / 2})` })
    c.g.append(defs, paper)
    paper.append(
      s('path', { class: 't6-sh', 'fill-opacity': 0.1, d: sheet(x + 3, y + 6, w, hh, 2), filter: 'url(#ink-wash)' }),
      s('path', { class: 't6t-paper', d: sheet(x, y, w, hh, isFast ? 4 : 9) }),
      // a paperweight holds the sheet down
      s('path', { class: 't6-sh', 'fill-opacity': 0.14, d: brush([[x + w * 0.12, y + 4], [x + w * 0.12 + fs * 3.2, y + 4]], fs * 0.55, { a: 0.1, b: 0.1, min: 0.6, wob: 0 }).d, filter: 'url(#ink-wash)' }),
      s('path', { class: 'w2', 'fill-opacity': 0.9, d: brush([[x + w * 0.1, y + 1], [x + w * 0.1 + fs * 3.2, y + 1]], fs * 0.5, { a: 0.04, b: 0.04, min: 0.8, wob: 0 }).d, filter: 'url(#ink-rough)' }),
      s('path', { class: 'p', 'fill-opacity': 0.35, d: brush([[x + w * 0.1 + fs * 0.3, y - fs * 0.08], [x + w * 0.1 + fs * 2.4, y - fs * 0.1]], fs * 0.1, { a: 0.2, b: 0.4, min: 0.3 }).d }),
    )
    const texts = c.lines.map((line, i) => {
      const last = i === c.lines.length - 1
      const size = isFast ? fastFs : last ? fs * 1.15 : fs
      const wt = last ? 500 : 400
      const ty = isFast ? y + inset / 2 + hh * 0.48 + size * 0.36 : y + inset + fs * 0.7 + lh * (i + 0.75) + (last ? lh * 0.15 : 0)
      const tw = measure(line, size, wt)
      const tx = isFast ? x + w / 2 - tw / 2 : x + padX
      const id = nextId('t6tc')
      const clip = s('rect', { x: tx - 3, y: ty - size * 1.2, width: c.state === 'done' ? tw + 8 : 0, height: size * 1.7 })
      defs.append(s('clipPath', { id }, clip))
      const el = s('text', { class: last ? 't6t-ans' : 'k2', x: tx, y: ty, 'font-size': size.toFixed(1), 'clip-path': `url(#${id})` }, line)
      paper.append(el)
      return { el, clip, w: tw + 8, x0: tx - 3, y: ty - size * 0.28 }
    })
    // the answer's mark: a teacher's vermilion strike (wrong) or a moss swash under it (right)
    const a = texts[texts.length - 1]
    const ax = a.x0 + 3, ay = Number(a.el.getAttribute('y')), aw = a.w - 8
    const mark = isFast
      ? s('path', { class: 'v', 'fill-opacity': 0.9, d: brush([[ax - 8, ay - fs * 0.22], [ax + aw * 0.5, ay - fs * 0.36], [ax + aw + 10, ay - fs * 0.56]], Math.max(2.4, fs * 0.18), { a: 0.08, b: 0.4 }).d, filter: 'url(#ink-rough)', opacity: 0 })
      : s('path', { class: 'm', 'fill-opacity': 0.9, d: brush([[ax - 4, ay + fs * 0.34], [ax + aw * 0.45, ay + fs * 0.44], [ax + aw + 6, ay + fs * 0.24], [ax + aw + 14, ay - fs * 0.5]], Math.max(2.2, fs * 0.16), { a: 0.06, b: 0.5 }).d, filter: 'url(#ink-rough)', opacity: 0 })
    paper.append(mark)
    // the brush lies on the board just in front of its paper, inside the art
    const rest: Pt = [clamp(x + w * 0.4, 6, W - 92 * fk), Math.min(y + hh + 3 * fk, groundY - 2)]
    if (c.state !== 'running') pen(c, rest[0], rest[1], REST_ROT)

    // the censer: a bronze bowl filled with sand, a stick of incense, curls of fallen ash
    const bw = Math.min(tray.h * 0.62, tray.w * 0.34)
    const bx = tray.x + tray.w * 0.2
    const by = groundY - bw * 0.3
    const len = Math.max(20, (by - bw * 0.22 - tray.y) * 0.92)
    const base: Pt = [bx, by - bw * 0.22]
    const bowl = `M${bx - bw * 0.5} ${by - bw * 0.2}Q${bx - bw * 0.5} ${by + bw * 0.26} ${bx} ${by + bw * 0.27}Q${bx + bw * 0.5} ${by + bw * 0.26} ${bx + bw * 0.5} ${by - bw * 0.2}Z`
    const ashC: string[] = []
    for (let k = 0; k < 3; k++) {
      const ax2 = bx + (r() - 0.3) * bw * 0.6, ay2 = by - bw * 0.2 + (r() - 0.5) * bw * 0.06
      const sz = bw * (0.05 + r() * 0.03)
      ashC.push(brush([[ax2 - sz * 1.4, ay2], [ax2 - sz * 0.2, ay2 - sz], [ax2 + sz, ay2 - sz * 0.2], [ax2 + sz * 0.2, ay2 + sz * 0.5]], Math.max(1, bw * 0.03), { a: 0.2, b: 0.3, min: 0.4 }).d)
    }
    c.g.append(
      s('path', { class: 't6-sh', 'fill-opacity': 0.14, d: ell(bx + bw * 0.06, groundY - 1, bw * 0.62, bw * 0.1), filter: 'url(#ink-wash)' }),
      s('path', { class: 't6t-bronze', d: `M${bx - bw * 0.3} ${by + bw * 0.2}L${bx - bw * 0.34} ${groundY}L${bx - bw * 0.24} ${groundY}Z M${bx + bw * 0.3} ${by + bw * 0.2}L${bx + bw * 0.34} ${groundY}L${bx + bw * 0.24} ${groundY}Z` }),
      s('path', { class: 't6t-bronze', d: bowl, filter: 'url(#ink-rough)' }),
      s('path', { class: 't6-sh', 'fill-opacity': 0.22, d: `M${bx + bw * 0.12} ${by - bw * 0.16}Q${bx + bw * 0.46} ${by - bw * 0.1} ${bx + bw * 0.46} ${by - bw * 0.16}Q${bx + bw * 0.44} ${by + bw * 0.22} ${bx + bw * 0.04} ${by + bw * 0.26}Z`, filter: 'url(#ink-wash)' }),
      s('path', { class: 't6-rim', 'fill-opacity': 0.5, d: brush([[bx - bw * 0.42, by - bw * 0.06], [bx - bw * 0.38, by + bw * 0.1], [bx - bw * 0.22, by + bw * 0.2]], Math.max(1.2, bw * 0.05), { a: 0.2, b: 0.4 }).d }),
      s('path', { class: 't6t-sand', d: ell(bx, by - bw * 0.2, bw * 0.48, bw * 0.09) }),
      s('path', { class: 'k', 'fill-opacity': 0.6, d: brush([[bx - bw * 0.5, by - bw * 0.2], [bx - bw * 0.44, by + bw * 0.1], [bx, by + bw * 0.27], [bx + bw * 0.44, by + bw * 0.1], [bx + bw * 0.5, by - bw * 0.2]], Math.max(1.3, bw * 0.045), { a: 0.1, b: 0.3 }).d, filter: 'url(#ink-rough)' }),
      s('path', { class: 'k', 'fill-opacity': 0.35, d: brush([[bx - bw * 0.48, by - bw * 0.21], [bx, by - bw * 0.3], [bx + bw * 0.48, by - bw * 0.21]], Math.max(1, bw * 0.03), { a: 0.2, b: 0.3 }).d }),
      s('path', { class: 't6t-ashc', d: ashC.join('') }),
    )
    const smoke = [s('path', { class: 't6t-smoke' }), s('path', { class: 't6t-smoke' })]
    const stick = s('path', { class: 't6t-stick' })
    const ash = s('path', { class: 't6t-ash' })
    const ember = s('circle', { class: 'v t6t-ember', r: Math.max(1.6, bw * 0.04) })
    c.g.append(ash, stick, ember, ...smoke)

    // the dish: a shallow celadon bowl, glaze pooled darker inside, a pale highlight on the lip
    const drx = Math.min(tray.w * 0.3, tray.h * 0.9)
    const dry = drx * 0.32
    const dx = tray.x + tray.w * 0.68
    const dy = groundY - dry * 1.05
    dishAt[c.key] = [dx, dy]
    c.g.append(
      s('path', { class: 't6-sh', 'fill-opacity': 0.14, d: ell(dx + drx * 0.06, groundY - 1, drx * 1.02, dry * 0.4), filter: 'url(#ink-wash)' }),
      s('path', { class: 't6t-glaze', d: `M${dx - drx} ${dy}Q${dx - drx * 0.86} ${dy + dry * 1.1} ${dx} ${dy + dry * 1.05}Q${dx + drx * 0.86} ${dy + dry * 1.1} ${dx + drx} ${dy}Z`, filter: 'url(#ink-rough)' }),
      s('path', { class: 't6t-glaze', d: ell(dx, dy, drx, dry), filter: 'url(#ink-rough)' }),
      s('path', { class: 't6t-glaze2', d: ell(dx, dy + dry * 0.12, drx * 0.84, dry * 0.68), filter: 'url(#ink-wash)' }),
      s('path', { class: 't6-rim', 'fill-opacity': 0.75, d: brush([[dx - drx * 0.9, dy - dry * 0.3], [dx - drx * 0.4, dy - dry * 0.95], [dx + drx * 0.2, dy - dry * 0.98]], Math.max(1.2, dry * 0.12), { a: 0.2, b: 0.5 }).d }),
      s('path', { class: 'k', 'fill-opacity': 0.5, d: brush([[dx - drx, dy], [dx - drx * 0.62, dy + dry * 0.98], [dx + drx * 0.5, dy + dry * 1.0], [dx + drx, dy]], Math.max(1.2, drx * 0.028), { a: 0.1, b: 0.3 }).d, filter: 'url(#ink-rough)' }),
    )
    // pebbles heap up from the middle of the dish
    const pr = Math.max(2.8, drx * 0.085)
    const pebbles: SVGGElement[] = []
    const cls = ['t6t-pb1', 't6t-pb2', 't6t-pb3']
    for (let i = 0; i < c.pebbles; i++) {
      const rad = Math.min(0.86, Math.sqrt(i / 50) * 0.9 + r() * 0.06)
      const a2 = r() * Math.PI * 2
      const px = dx + Math.cos(a2) * drx * rad * 0.78
      const py = dy + Math.sin(a2) * dry * rad * 0.6 - (1 - rad) * pr * 1.4
      const k = 0.8 + r() * 0.45
      pebbles.push(s('g', { opacity: c.state === 'done' ? 1 : 0 },
        s('path', { class: 't6-sh', 'fill-opacity': 0.25, d: ell(px + pr * 0.15, py + pr * 0.45, pr * k, pr * k * 0.42) }),
        s('path', { class: cls[i % 3], d: blob(px, py, pr * k, pr * k * 0.68, i + 1, 0.12, 10) }),
        s('path', { class: 't6-rim', 'fill-opacity': 0.7, d: ell(px - pr * k * 0.25, py - pr * k * 0.25, pr * k * 0.32, pr * k * 0.16) })))
    }
    c.g.append(...pebbles)
    c.parts = { texts, pebbles, stick, ember, ash, smoke, base, len, mark, rest }
    setBurn(c, c.burnNow)
    if (c.state === 'done') gsap.set(mark, { opacity: !isFast || cols[1].state === 'done' ? 1 : 0 })
  }

  function setBurn(c: Col, b: number) {
    c.burnNow = b
    const p = c.parts
    if (!p) return
    const [bx, by] = p.base
    const tip = by - p.len * (1 - b)
    p.stick.setAttribute('d', brush([[bx, by], [bx + 0.3, tip]], Math.max(1.6, p.len * 0.028), { a: 0, b: 0, min: 1, wob: 0 }).d)
    // the burnt part curls over as ash
    const al = Math.min(9, p.len * b * 0.22)
    p.ash.setAttribute('d', b > 0.01 ? brush([[bx + 0.3, tip], [bx + 1 + al * 0.3, tip - al * 0.6], [bx + 2 + al * 0.7, tip - al * 0.7]], Math.max(1.4, p.len * 0.024), { a: 0, b: 0.5, wob: 0 }).d : '')
    p.ember.setAttribute('cx', (bx + 0.3).toFixed(1))
    p.ember.setAttribute('cy', tip.toFixed(1))
  }

  // smoke: a thread rises from each stick, livelier while that column is thinking
  if (!ctx.reduced) {
    let t = 0
    loop(ctx, (dt) => {
      t += dt
      for (const c of cols) {
        const p = c.parts
        if (!p) continue
        const [bx, by] = p.base
        const tip = by - p.len * (1 - c.burnNow) - 2
        const k = c.state === 'running' ? 1 : 0.6
        for (let j = 0; j < p.smoke.length; j++) {
          const L = p.len * (0.8 + j * 0.3) * k
          let d = ''
          for (let i = 0; i <= 14; i++) {
            const u = i / 14
            const x = bx + Math.sin(u * 4.6 + t * (0.8 + j * 0.35) + j * 2.2) * u * (5 + j * 4) + u * u * (j ? -7 : 9)
            d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${(tip - u * L).toFixed(1)}`
          }
          p.smoke[j].setAttribute('d', d)
        }
      }
    })
  }

  function run(c: Col) {
    if (c.state === 'running') return
    c.tl?.kill()
    const p = c.parts!
    c.state = 'running'
    c.btn.classList.remove('done')
    c.btn.classList.add('on')
    ctx.chime('soft')
    p.texts.forEach((t) => t.clip.setAttribute('width', '0'))
    gsap.set(p.pebbles, { opacity: 0 })
    gsap.set(p.mark, { opacity: 0 })
    setBurn(c, 0)
    const done = () => {
      c.state = 'done'
      c.btn.classList.remove('on')
      c.btn.classList.add('done')
      after()
    }
    if (ctx.reduced) {
      p.texts.forEach((t) => t.clip.setAttribute('width', String(t.w)))
      gsap.set(p.pebbles, { opacity: 1 })
      setBurn(c, c.burn)
      if (c.key === 'slow') gsap.set(p.mark, { opacity: 1 })
      done()
      return
    }
    ctx.anim(() => {
      const tl = gsap.timeline({ onComplete: done })
      c.tl = tl
      const per = c.key === 'fast' ? 0.65 : 0.95
      const total = p.texts.length * per + 0.5
      const burn = { b: 0 }
      tl.to(burn, { b: c.burn, duration: total, ease: 'none', onUpdate: () => setBurn(c, burn.b) }, 0)
      // the brush rises from the board, writes each line, and is laid down again
      const o = { x: p.rest[0], y: p.rest[1], r: REST_ROT }
      const move = () => pen(c, o.x, o.y, o.r)
      p.texts.forEach((t, i) => {
        const at = 0.3 + i * per
        tl.to(o, { x: t.x0, y: t.y, r: 0, duration: i ? 0.18 : 0.3, ease: 'power2.inOut', onUpdate: move }, at - (i ? 0.18 : 0.3))
        const wv = { w: 0 }
        tl.to(wv, {
          w: t.w, duration: per * 0.78, ease: 'power1.inOut',
          onUpdate: () => {
            t.clip.setAttribute('width', wv.w.toFixed(1))
            o.x = t.x0 + wv.w
            o.y = t.y
            move()
          },
        }, at)
      })
      tl.to(o, { x: p.rest[0], y: p.rest[1], r: REST_ROT, duration: 0.6, ease: 'power2.inOut', onUpdate: move }, total - 0.3)
      // tokens: one pebble after another drops into the dish while it writes
      const n = p.pebbles.length
      p.pebbles.forEach((pg, i) => tl.fromTo(pg, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.35, ease: 'bounce.out' }, 0.25 + (i / n) * (total - 0.6)))
      if (c.key === 'slow') tl.fromTo(p.mark, { opacity: 0 }, { opacity: 1, duration: 0.6 }, total - 0.2)
    })
  }

  function after() {
    const [fast, slow] = cols
    if (fast.state === 'done' && slow.state === 'done') {
      const m = fast.parts!.mark
      if (ctx.reduced) gsap.set(m, { opacity: 1 })
      else ctx.anim(() => gsap.fromTo(m, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power2.out' }))
      live.textContent = `${T.fastAnswer} ✗ · ${T.slowAnswer} ✓`
      ctx.insight(T.insight, T.detail)
      ctx.chime('ok')
    } else {
      live.textContent = (fast.state === 'done' ? fast : slow).lines.slice(-1)[0]
      ctx.prompt(T.again)
    }
  }

  onSize(ctx, root, layout, stable.reset)
  layout()
  ctx.prompt(T.prompt)
  if (!ctx.reduced) gsap.from([q, board, ...cols.map((c) => c.btn), ...cols.map((c) => c.g), pens], { opacity: 0, y: 12, duration: 1.2, stagger: 0.12, ease: 'power3.out', delay: 0.3 })

  return () => cols.forEach((c) => c.tl?.kill())
}
