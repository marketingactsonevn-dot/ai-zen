import { fill, h, s } from '../../core/dom'
import { createLoop } from '../../core/loop'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { blob, clamp, curve, onSize, p2Defs, rng, stableHeight, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist, moon, pine, reeds, toro, wash, water } from '../../ui/part2/paint'
import { C } from './data'
import { guide } from '../../ui/part2/guide'

const G = C.scenes.loop
// step k carries the money to island TO[k]; the fact each step brings (facts[1] is the 22 → 51 one: the water rises)
const FACT: (number | null)[] = [0, 2, null, 1]
const BUCKETS = 10
const f1 = (n: number) => n.toFixed(1)
const P = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`

/** a band along pts, w[i] wide at each point (perspective): one filled outline */
function ribbon(pts: Pt[], w: number[]): string {
  const L: Pt[] = [], Rr: Pt[] = []
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1
    const nx = -dy / l, ny = dx / l
    L.push([p[0] + (nx * w[i]) / 2, p[1] + (ny * w[i]) / 2])
    Rr.push([p[0] - (nx * w[i]) / 2, p[1] - (ny * w[i]) / 2])
  })
  return `M${L.map(P).join('L')}L${Rr.reverse().map(P).join('L')}Z`
}
const bez = (a: Pt, c: Pt, b: Pt, n = 24) => curve(a, c, b, n)

/**
 * Vòng tiền tuần hoàn (art direction §4 t28 `loop`, 2.5D): a great wooden waterwheel by a stone mill on NVIDIA's island,
 * seen from below its axle against the moon. A stone flume runs from its tail round the lake to the AI company's island
 * (a pavilion with a lamp) and the data centre's (a row of stone lanterns like racks), and back over the mill onto the
 * wheel. Turn the wheel a quarter at a time (drag, ← →, Enter): each quarter lights the next run of water and cuts its
 * line into a plank by the flume. After one round it keeps turning by itself, faster each round, the water rising.
 */
export function wheelScene(ctx: SceneCtx) {
  p2Defs()
  const low = ctx.quality === 'low'
  const still = low || ctx.reduced
  const stableH = stableHeight(ctx, [G.insight as Fact])
  ctx.prompt(G.prompt)
  const gd = guide(ctx)

  const sky = s('svg', { class: 't28w-sky', 'aria-hidden': 'true' })
  const back = s('svg', { class: 't28w-back', 'aria-hidden': 'true' }) // rims' far face and the spokes
  const rimBack = s('g', { class: 't28w-rim-back' })
  const rimFront = s('g', { class: 't28w-rim-front' })
  // the paddles span the two rims (the wheel has depth): one path, rebuilt only while it turns
  const paddles = s('path', { class: 't28w-paddle' })
  const paddleLit = s('path', { class: 't28w-paddle-lit' })
  const buckets = Array.from({ length: BUCKETS }, () => s('g', { class: 't28w-bucket' }))
  const wheelSvg = s('svg', { class: 't28w-wheel', 'aria-hidden': 'true' }, rimBack, paddles, paddleLit, ...buckets, rimFront)
  const near = s('svg', { class: 't28w-near', 'aria-hidden': 'true' })
  // the step's line and its fact, cut into one wet wooden board staked in the shallows (not a card over the painting)
  const plank = h('p', { class: 't28w-plank' })
  const slip = h('div', { class: 't28w-slip', 'aria-live': 'polite' })
  // a wet plank on two stakes driven into the shallows: the face carries the words, the stakes and ripples stand below
  const board = h('div', { class: 't28w-board' }, h('div', { class: 't28w-face' }, plank, slip), h('i', { class: 't28w-wet', 'aria-hidden': 'true' }))
  const wheel = h('div', { class: 't28w-hit', role: 'slider', tabindex: '0', 'aria-label': G.flowLabel, 'aria-valuemin': '0', 'aria-valuemax': String(G.flow.length), 'aria-valuenow': '0', 'aria-description': G.wheelAria })
  const islandTags = G.islands.map((n) => h('span', { class: 't28w-isle', 'data-t': n }, n)) // written on the water, with its reflection
  const root = h('div', { class: 't28w', role: 'group', 'aria-label': G.art }, sky, back, wheelSvg, near, ...islandTags, wheel)
  ctx.art.append(root, board) // the board sits outside the painting's soft edges

  let geo = { cx: 0, cy: 0, R: 1, sx: 0.88, dx: 0, dy: 0 }
  let segs: SVGGElement[] = []
  let step = 0
  let angle = 0 // radians the wheel has turned (clockwise on screen = the water side going down)
  let target = 0
  let spin = 0 // rad/s once it turns by itself
  let rounds = 0
  let done = false

  function label() {
    // the step just taken (none yet: the slider's own name)
    wheel.setAttribute('aria-valuenow', String(step))
    wheel.setAttribute('aria-valuetext', step ? fill(G.flowAria, { n: step, text: G.flow[step - 1] }) : G.flowLabel)
  }
  label()
  // guide: a dot on a paddle at three o'clock, a curved arrow along the rim (the turn is a hidden gesture), a count of
  // the four steps
  const dot = gd.dot(() => [geo.cx + geo.R * 1.02 * geo.sx, geo.cy], { dir: [0, 1] })
  const arrow = gd.gesture('rotate', () => [geo.cx, geo.cy], { r: 70 })
  // the four steps: notches cut in a row on the mill wall, each lit as its step is taken (H4, audit v3 28-5)
  const tally = s('g', { class: 't28w-tally' })
  const steps = { set: (n: number) => tally.querySelectorAll('.t28w-tick').forEach((e, i) => e.classList.toggle('on', i < n)), done: () => tally.classList.add('all') }

  /** a quarter turn forward: the next run of water lights, its words go on the plank, its fact on the slip */
  function advance() {
    if (step >= G.flow.length) return
    const k = step++
    segs[k]?.classList.add('lit')
    root.classList.add(`s${step}`)
    plank.textContent = G.flow[k]
    board.classList.remove('in')
    void board.offsetWidth
    board.classList.add('in')
    const f = FACT[k]
    // the board says the step; under it, its fact, when it has one
    if (f != null) slip.replaceChildren(ctx.fact(G.facts[f] as Fact, 'p', 't28w-fact'))
    slip.classList.toggle('open', f != null)
    if (f === 1) root.classList.add('high') // NVIDIA's stakes 22 → 51: the water climbs to the second notch
    label()
    steps.set(step)
    arrow.done()
    if (step === G.flow.length && !done) {
      done = true
      dot.done()
      steps.done()
      root.classList.add('round')
      ctx.insight(G.insight as Fact, G.detail as Fact)
      ctx.chime('ok')
      if (!still) (spin = 0.9), loop.start()
    } else ctx.chime('soft')
  }

  // ── one loop: the wheel eases to its target, then (after a round) turns by itself, faster each round, for a while
  let spinUntil = 0
  const PADS = 20
  const place = () => {
    const { cx, cy, R, sx, dx, dy } = geo
    const deg = f1((angle * 180) / Math.PI)
    // a disc turning in its own plane, seen a little from the side and below: rotate, then squash x; the far rim sits
    // up and to the right of the near one (depth)
    rimBack.setAttribute('transform', `translate(${f1(cx + dx)} ${f1(cy + dy)}) scale(${sx} 1) rotate(${deg}) translate(${f1(-cx)} ${f1(-cy)})`)
    rimFront.setAttribute('transform', `translate(${f1(cx)} ${f1(cy)}) scale(${sx} 1) rotate(${deg}) translate(${f1(-cx)} ${f1(-cy)})`)
    // paddles: boards from the near rim to the far one, wet and dark, their top edges catching the moon
    let d = '', lit = ''
    for (let i = 0; i < PADS; i++) {
      const a = angle + (i * Math.PI * 2) / PADS
      const c = Math.cos(a), sn = Math.sin(a)
      const p0: Pt = [cx + c * R * 0.84 * sx, cy + sn * R * 0.84], p1: Pt = [cx + c * R * 1.1 * sx, cy + sn * R * 1.1]
      d += `M${P(p0)}L${P(p1)}L${P([p1[0] + dx, p1[1] + dy])}L${P([p0[0] + dx, p0[1] + dy])}Z`
      if (sn < 0.2) lit += `M${P(p1)}L${P([p1[0] + dx, p1[1] + dy])}`
    }
    paddles.setAttribute('d', d)
    paddleLit.setAttribute('d', lit)
    for (let i = 0; i < BUCKETS; i++) {
      const a = angle + (i * Math.PI * 2) / BUCKETS
      const x = cx + Math.cos(a) * R * 0.98 * sx + dx * 0.5, y = cy + Math.sin(a) * R * 0.98 + dy * 0.5
      buckets[i].setAttribute('transform', `translate(${f1(x)} ${f1(y)})`)
      // full on the way down the right side (the water side), spilled at the bottom
      const c = Math.cos(a), sn = Math.sin(a)
      const full = c > -0.2 && sn > -0.75 && sn < 0.92
      if (buckets[i].classList.contains('full') !== full) buckets[i].classList.toggle('full', full)
    }
  }
  const loop = createLoop(root, (t, dt) => {
    if (spin > 0) {
      target += spin * dt
      if (t > spinUntil && spinUntil) spin *= Math.exp(-dt * 0.8)
      if (spin < 0.02) spin = 0
    }
    angle += (target - angle) * (1 - Math.exp(-dt * 6))
    // each full round faster
    const r = Math.floor(target / (Math.PI * 2))
    if (spin > 0 && r > rounds) {
      rounds = r
      if (rounds < 4) spin = Math.min(3, spin * 1.45)
      root.style.setProperty('--rise', String(Math.min(3, rounds)))
      if (rounds === 3) spinUntil = t + 3
    }
    place()
    return spin > 0 || Math.abs(target - angle) > 0.002
  })
  ctx.onCleanup(() => loop.dispose())
  const turnTo = (a: number) => {
    target = a
    if (still) (angle = target), place()
    else loop.start()
  }

  // ── input: drag round the axle (a quarter forward = a step), keys
  let drag: { id: number; a0: number; t0: number; moved: number } | null = null
  let rect: DOMRect | null = null
  const angAt = (e: PointerEvent) => Math.atan2(e.clientY - rect!.top - geo.cy, (e.clientX - rect!.left - geo.cx) / geo.sx)
  wheel.addEventListener('pointerdown', (e) => {
    if (e.button) return
    rect = root.getBoundingClientRect()
    drag = { id: e.pointerId, a0: angAt(e), t0: target, moved: 0 }
    wheel.setPointerCapture(e.pointerId)
    spin = 0
  })
  wheel.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return
    let d = angAt(e) - drag.a0
    d = Math.atan2(Math.sin(d), Math.cos(d))
    drag.a0 = angAt(e)
    drag.t0 += d
    drag.moved += Math.abs(d)
    turnTo(drag.t0)
    while (step < G.flow.length && drag.t0 >= ((step + 1) * Math.PI) / 2 - 0.15) advance()
  })
  const up = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return
    const tap = drag.moved < 0.08
    drag = null
    // a tap turns it a quarter (audit v3 28-5: a touch was a dead click); a drag settles on the nearest quarter (never
    // back past a step already taken)
    if (tap) return void quarter()
    turnTo(Math.max(Math.round(target / (Math.PI / 2)), step) * (Math.PI / 2))
  }
  function quarter() {
    spin = 0
    if (step < G.flow.length) advance()
    turnTo((Math.round(target / (Math.PI / 2)) + 1) * (Math.PI / 2))
  }
  // H7: the wheel nudges 8° on and back
  const invite = () => {
    if (done || still) return
    turnTo(target + 0.14)
    const tm = window.setTimeout(() => turnTo(target - 0.14), 450)
    ctx.onCleanup(() => clearTimeout(tm))
  }
  ctx.el.addEventListener('p2:idle', invite)
  ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', invite))
  wheel.addEventListener('pointerup', up)
  wheel.addEventListener('pointercancel', up)
  wheel.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      quarter()
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      spin = 0
      turnTo((Math.round(target / (Math.PI / 2)) - 1) * (Math.PI / 2))
    }
  })

  function layout() {
    const W = ctx.art.clientWidth
    const H = stableH(ctx.art.clientHeight)
    if (W < 60 || H < 60) return
    root.style.height = `${f1(H)}px`
    const wide = W / H > 1.15
    // a low camera under the axle: the wheel fills about 60 % of the height, against the moon; the far shore sits low
    // (a phone: the wheel near the middle, the mill pushed back to its right; the islands come forward onto the lower water)
    const R = wide ? H * 0.31 : Math.min(W * 0.3, H * 0.2)
    const cx = wide ? W * 0.42 : W * 0.42, cy = wide ? H * 0.4 : H * 0.25
    const sx = 0.86, dx = R * 0.17, dy = -R * 0.06
    geo = { cx, cy, R, sx, dx, dy }
    const hz = cy + R * 0.5 // the far shore, below the axle (we look up)
    const wl = cy + R * 0.95 // the millrace water line under the wheel
    ;[sky, back, wheelSvg, near].forEach((v) => v.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`))
    const r = rng(2850)
    // ── sky, the moon behind the wheel, the far ranges, the lake
    sky.replaceChildren(
      mist(W * 0.5, hz - H * 0.12, W * 0.75, H * 0.2),
      moon(cx + R * 0.12, cy - R * 0.1, R * 0.78, 2851, true),
      hills(-W * 0.04, W * 1.04, hz, H * 0.12, 2852, 0.9, wide ? 6 : 3),
      hills(W * 0.5, W * 1.05, hz + 2, H * 0.07, 2853, 0.65, 2),
      water(-W * 0.05, hz, W * 1.05, H, 2860, cx + R * 0.12),
      mist(W * 0.5, hz + 2, W * 0.8, H * 0.03))
    // ── the islands and the stone channel, in perspective (far = thin, pale)
    const isleAI: Pt = wide ? [W * 0.12, hz + H * 0.035] : [W * 0.2, H * 0.55]
    const isleDC: Pt = wide ? [W * 0.86, hz + H * 0.03] : [W * 0.76, H * 0.585]
    const millX = cx + R * sx * 1.04 + dx * 0.4, millW = wide ? R * 0.92 : R * 0.78, sideW = R * (wide ? 0.24 : 0.16)
    const tail: Pt = [cx - R * 0.45, wl + R * 0.04]
    const head: Pt = [cx + R * 0.3, cy - R * 1.06] // where the trough pours onto the wheel
    const wallTop = cy - R * 0.62, wallBot = wl + R * 0.05
    const millTop: Pt = [millX + millW * 0.55, wallTop - R * 0.34]
    const depthW = (y: number) => clamp(((y - hz) / (H - hz)) * R * (wide ? 0.55 : 0.4), 4, R * (wide ? 0.3 : 0.16))
    const run = (pts: Pt[]) => ({ pts, w: pts.map((p) => depthW(p[1])) })
    const runs = wide ? [
      run(bez(tail, [W * 0.08, wl + R * 0.25], [isleAI[0] + 10, isleAI[1] + 4])),
      run(bez([isleAI[0] + 14, isleAI[1]], [W * 0.5, hz + H * 0.004], [isleDC[0] - 14, isleDC[1]])),
      run(bez([isleDC[0] - 6, isleDC[1] + 4], [W * 0.95, wl - R * 0.1], [millX + millW * 0.7, wl - R * 0.02])),
    ] : [
      run(bez(tail, [W * 0.04, wl + R * 0.3], [isleAI[0] - 8, isleAI[1] - 6])),
      run(bez([isleAI[0] + 20, isleAI[1] - 4], [W * 0.48, isleAI[1] - H * 0.035], [isleDC[0] - 22, isleDC[1] - 6])),
      run(bez([isleDC[0] + 10, isleDC[1] - 8], [W * 0.98, wl + R * 0.25], [millX + millW * 0.7, wl - R * 0.02])),
    ]
    // a stone channel: its walls (lit lip, dark inner wall), dark water, short silver glints that slide along when lit
    segs = runs.map(({ pts, w }, k) => {
      const lip = ribbon(pts, w)
      const inner = ribbon(pts.map(([x, y]) => [x, y + 1] as Pt), w.map((x) => x * 0.62))
      const water = ribbon(pts.map(([x, y]) => [x, y + 2] as Pt), w.map((x) => x * 0.5))
      return s('g', { class: `t28w-seg${step > k ? ' lit' : ''}` },
        s('path', { class: 't28w-flume', d: lip, filter: 'url(#ink-rough)' }),
        s('path', { class: 't28w-wallin', d: inner }),
        s('path', { class: 't28w-run', d: water }),
        s('path', { class: 't28w-flow', d: `M${pts.map(([x, y]) => P([x, y + 2])).join('L')}`, 'stroke-width': f1(Math.max(1.2, Math.min(...w) * 0.16)), pathLength: 1 }))
    })
    // the aqueduct: a wooden trough on trestles from behind the mill down onto the wheel's crown (water inside, a lit lip)
    const tr = bez(millTop, [(millTop[0] + head[0]) / 2, Math.min(millTop[1], head[1]) - R * 0.05], head, 14)
    const tw = R * 0.075
    const trough = s('g', { class: `t28w-seg t28w-trough${step > 3 ? ' lit' : ''}` },
      s('path', { class: 't28w-trestle', d: [0.35, 0.7].map((t) => { const [x, y] = tr[Math.round(t * 14)]; return stroke([[x - tw * 0.6, y + tw * 0.6], [x - tw * 1.4, millTop[1] + R * 0.5]], tw * 0.4, 0.05, 0.05, 0.6) + stroke([[x + tw * 0.6, y + tw * 0.6], [x + tw * 1.4, millTop[1] + R * 0.5]], tw * 0.4, 0.05, 0.05, 0.6) }).join('') }),
      s('path', { class: 't28w-tside', d: ribbon(tr.map(([x, y]) => [x, y + tw * 0.55] as Pt), tr.map(() => tw * 1.1)), filter: 'url(#ink-rough)' }),
      s('path', { class: 't28w-run', d: ribbon(tr, tr.map(() => tw * 0.7)) }),
      s('path', { class: 't28w-tlip', d: stroke(tr.map(([x, y]) => [x, y - tw * 0.42] as Pt), Math.max(1.2, tw * 0.22), 0.05, 0.05, 0.5) }),
      s('path', { class: 't28w-flow', d: `M${tr.map(P).join('L')}`, 'stroke-width': f1(Math.max(1.2, tw * 0.3)), pathLength: 1 }))
    segs.push(trough)
    // the far islands: AI company (a pavilion with a lamp) · data centre (a row of stone lanterns, racks in the night)
    // each island: a rock with a moss top and a pine, its reflection on the water, a lantern's warmth on its stone
    const isle = (p: Pt, w: number, seed: number, dir: number) => [
      wash(blob(p[0], p[1] + w * 0.12, w * 0.62, w * 0.12, seed, 0.15), 0.35, 'p2p-wash t28w-double'),
      s('g', { class: 't28w-isl-refl', transform: `translate(${P([p[0], p[1] + w * 0.02])}) scale(1 -0.5)` }, stoneArt(w, w * 0.34, seed)),
      s('g', { transform: `translate(${P(p)})` }, stoneArt(w, w * 0.34, seed)),
      pine(p[0] + dir * w * 0.36, p[1] - w * 0.2, w * 0.62, seed + 3, -dir)]
    const iw = wide ? R * 0.9 : R * 0.82
    const racks: SVGElement[] = []
    for (let k = 0; k < 5; k++) racks.push(s('g', { transform: `translate(${f1(isleDC[0] - iw * 0.36 + k * iw * 0.16)} ${f1(isleDC[1] - iw * 0.24 + Math.abs(k - 2) * 1.5)})` }, toro(0, 0, iw * 0.36, true)))
    const pav = (p: Pt) => {
      const pw = iw * 0.62, ph = iw * 0.42
      return s('g', { class: 't28w-pav', transform: `translate(${f1(p[0])} ${f1(p[1] - iw * 0.2)})` },
        s('circle', { cx: 0, cy: f1(-ph * 0.5), r: f1(ph * 0.9), fill: 'url(#p2-lamp)', class: 't28w-pavglow' }),
        s('path', { class: 't28w-post', d: `M${f1(-pw * 0.35)} 0V${f1(-ph * 0.7)}M${f1(pw * 0.35)} 0V${f1(-ph * 0.7)}` }),
        s('rect', { class: 't28w-lampbox', x: f1(-ph * 0.13), y: f1(-ph * 0.62), width: f1(ph * 0.26), height: f1(ph * 0.3), rx: 2 }),
        s('path', { class: 't28w-roof', d: `M${f1(-pw * 0.7)} ${f1(-ph * 0.66)}Q0 ${f1(-ph * 0.8)} ${f1(pw * 0.7)} ${f1(-ph * 0.66)}L${f1(pw * 0.3)} ${f1(-ph * 1.05)}L${f1(-pw * 0.3)} ${f1(-ph * 1.05)}Z`, filter: 'url(#ink-rough)' }))
    }
    // ── the mill, seen from below: a front face (warm from the lantern side, left) and a darker side face in perspective,
    // stone blocks in courses, the eaves' underside, a roof with thickness, the two notches (22 · 51, true proportion) cut
    // into the stone with the water standing against the wall
    const inset = millW * 0.04 // verticals lean in toward the top (we look up)
    const F = { bl: [millX, wallBot], br: [millX + millW, wallBot], tr: [millX + millW - inset, wallTop], tl: [millX + inset, wallTop] } as Record<string, Pt>
    const S0 = { bl: F.br, br: [F.br[0] + sideW, wallBot - R * 0.06], tr: [F.tr[0] + sideW * 0.9, wallTop - R * 0.04], tl: F.tr } as Record<string, Pt>
    const quad = (q: Record<string, Pt>) => `M${P(q.bl)}L${P(q.br)}L${P(q.tr)}L${P(q.tl)}Z`
    let blocks = ''
    const rowH = R * 0.1
    for (let y = wallBot - rowH, row = 0; y > wallTop + rowH * 0.3; y -= rowH, row++) {
      const u0 = (wallBot - y) / (wallBot - wallTop)
      const xl = millX + inset * u0, xr = millX + millW - inset * u0
      for (let x = xl + (row % 2 ? R * 0.08 : 0); x < xr - 4; x += R * (0.14 + r() * 0.1)) blocks += `M${f1(x)} ${f1(y)}h${f1(Math.min(xr - x - 2, R * (0.12 + r() * 0.08)))}M${f1(x)} ${f1(y)}v${f1(rowH * 0.92)}`
    }
    const unit = ((wallBot - wallTop) * (wide ? 0.5 : 0.42)) / 51 // px per billion (51 stays below the step notches)
    const n22 = wallBot - unit * 22, n51 = wallBot - unit * 51
    root.style.setProperty('--w22', `${f1(wallBot - n22)}px`)
    root.style.setProperty('--w51', `${f1(wallBot - n51)}px`)
    // a notch: a V cut — its upper face in shadow, its lower face catching light — and the number cut beside it
    // a waterline notch: a cut across the wall (shadowed upper face, lit lower face), its number cut just above it, inside the wall
    const notch = (y: number, t: string) => {
      const [a, b] = t.split('\n') // a long notch name is cut on two lines (the line break is in the content)
      return s('g', { class: 't28w-notch' },
        s('path', { class: 't28w-cut-sh', d: `M${f1(millX + millW * 0.05)} ${f1(y - 3)}L${f1(millX + millW * 0.95)} ${f1(y - 3)}L${f1(millX + millW * 0.95)} ${f1(y)}L${f1(millX + millW * 0.05)} ${f1(y)}Z` }),
        s('path', { class: 't28w-cut-hi', d: `M${f1(millX + millW * 0.05)} ${f1(y)}L${f1(millX + millW * 0.95)} ${f1(y)}L${f1(millX + millW * 0.95)} ${f1(y + 2)}L${f1(millX + millW * 0.05)} ${f1(y + 2)}Z` }),
        s('text', { class: 't28w-carved', x: f1(millX + millW * 0.92), y: f1(y - (b ? 20 : 7)), 'text-anchor': 'end' }, a),
        b ? s('text', { class: 't28w-carved t28w-carved-s', x: f1(millX + millW * 0.92), y: f1(y - 7), 'text-anchor': 'end' }, b) : null)
    }
    // the four step notches in a row under the mill's name
    // (tally cuts: a narrow V in the stone, its numeral under it — not a row of buttons)
    const ty = wallTop + R * (wide ? 0.3 : 0.34), th0 = R * (wide ? 0.11 : 0.13)
    tally.replaceChildren(...G.flow.map((_, k) => {
      const x = millX + millW * (0.26 + k * 0.16)
      return s('g', { class: `t28w-tick${k < step ? ' on' : ''}` },
        s('path', { class: 't28w-tick-cut', d: stroke([[x, ty - th0 / 2], [x + 0.6, ty + th0 / 2]], Math.max(2.2, R * 0.016), 0.2, 0.2, 0.5) }),
        s('path', { class: 't28w-tick-lip', d: stroke([[x + 1.6, ty - th0 / 2 + 1], [x + 2.1, ty + th0 / 2]], 0.9, 0.2, 0.2, 0.4) }),
        s('text', { class: 't28w-tick-n', x: f1(x), y: f1(ty + th0 / 2 + 12), 'text-anchor': 'middle' }, String(k + 1)))
    }))
    const eave = millW * 0.14, fas = R * 0.055, roofH = R * 0.3
    const eL: Pt = [millX - eave, wallTop - R * 0.02], eR: Pt = [S0.tr[0] + eave * 0.8, wallTop - R * 0.07]
    const soffit = `M${P(eL)}L${P(eR)}L${P(S0.tr)}L${P(F.tr)}L${P(F.tl)}Z`
    const fascia = `M${P(eL)}L${P(eR)}L${P([eR[0], eR[1] - fas])}L${P([eL[0], eL[1] - fas])}Z`
    const slope = `M${P([eL[0], eL[1] - fas])}L${P([eR[0], eR[1] - fas])}L${P([eR[0] - millW * 0.28, eR[1] - fas - roofH])}L${P([eL[0] + millW * 0.3, eL[1] - fas - roofH])}Z`
    back.replaceChildren(
      ...isle(isleAI, iw, 2854, -1), pav([isleAI[0], isleAI[1]]),
      ...isle(isleDC, iw * 1.1, 2855, 1), ...racks,
      ...segs.slice(0, 3),
      s('path', { class: 't28w-wall', d: quad(F), filter: 'url(#ink-rough)' }),
      s('path', { class: 't28w-walllamp', d: quad(F) }),
      s('path', { class: 't28w-side', d: quad(S0), filter: 'url(#ink-rough)' }),
      s('path', { class: 't28w-course', d: blocks }),
      s('linearGradient', { id: 't28w-lv', x1: 0, x2: 0, y1: 0, y2: 1 }, s('stop', { offset: 0, class: 't28w-lv0' }), s('stop', { offset: 1, class: 't28w-lv1' })),
      s('rect', { class: 't28w-level', x: f1(millX), y: f1(n51), width: f1(millW), height: f1(wallBot - n51), fill: 'url(#t28w-lv)' }),
      notch(n22, G.notches[0]), notch(n51, G.notches[1]),
      s('path', { class: 't28w-slope', d: slope, filter: 'url(#ink-rough)' }),
      s('path', { class: 't28w-soffit', d: soffit }),
      s('path', { class: 't28w-fascia', d: fascia }),
      s('path', { class: 't28w-eavelit', d: stroke([[eL[0], eL[1] - fas], [eR[0], eR[1] - fas]], Math.max(1.2, R * 0.012), 0.05, 0.05, 0.5) }),
      s('text', { class: 't28w-carved t28w-name', x: f1(millX + millW * 0.5), y: f1(wallTop + R * 0.22), 'text-anchor': 'middle' }, G.islands[0]),
      tally,
      trough,
      s('circle', { class: 't28w-hub-sh', cx: f1(cx + R * 0.06), cy: f1(cy + R * 0.04), r: f1(R * 1.02) }))
    // ── the wheel: two rims (wet wood, grain, spokes), the axle; buckets hang from the rim and stay upright
    const rim = (k: number, cls: string) => {
      let d = ''
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2
        d += stroke([[cx + Math.cos(a) * R * 0.1, cy + Math.sin(a) * R * 0.1], [cx + Math.cos(a) * R * 0.95, cy + Math.sin(a) * R * 0.95]], R * 0.034 * k, 0.05, 0.05, 0.75)
      }
      const ring = (rr: number, w: number) => stroke(Array.from({ length: 73 }, (_, i) => [cx + Math.cos((i / 72) * Math.PI * 2) * rr, cy + Math.sin((i / 72) * Math.PI * 2) * rr] as Pt), w, 0.01, 0.01, 0.9)
      return s('path', { class: cls, d: d + ring(R * 0.97, R * 0.075 * k) + ring(R * 0.72, R * 0.035 * k), filter: 'url(#ink-rough)' })
    }
    // wet wood: dry-brush grain along the near rim, a wet sheen where the moon catches it (top left of the rim)
    let grain = ''
    for (let i = 0; i < 40; i++) {
      const a0 = r() * Math.PI * 2, len = 0.08 + r() * 0.18, rr = R * (0.94 + r() * 0.06)
      grain += stroke(Array.from({ length: 6 }, (_, j) => { const a = a0 + (len * j) / 5; return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr] as Pt }), Math.max(0.6, R * 0.006), 0.3, 0.3, 0.3)
    }
    rimBack.replaceChildren(rim(0.85, 't28w-rimb'))
    const hub = s('g', null, s('circle', { class: 't28w-hub', cx: f1(cx), cy: f1(cy), r: f1(R * 0.12) }), s('circle', { class: 't28w-axle', cx: f1(cx + R * 0.02), cy: f1(cy - R * 0.01), r: f1(R * 0.045) }))
    rimFront.replaceChildren(rim(1, 't28w-rimf'), s('path', { class: 't28w-grain', d: grain }), hub,
      s('path', { class: 't28w-rimlight', d: stroke(Array.from({ length: 19 }, (_, i) => { const a = -Math.PI * 0.95 + (i / 18) * Math.PI * 0.75; return [cx + Math.cos(a) * R * 1.0, cy + Math.sin(a) * R * 1.0] as Pt }), R * 0.022, 0.2, 0.2, 0.2) }))
    const bw = R * 0.22
    buckets.forEach((b) => b.replaceChildren(
      s('path', { class: 't28w-bkt', d: `M${f1(-bw / 2)} ${f1(-bw * 0.15)}L${f1(bw / 2)} ${f1(-bw * 0.15)}L${f1(bw * 0.4)} ${f1(bw * 0.55)}L${f1(-bw * 0.4)} ${f1(bw * 0.55)}Z` }),
      s('path', { class: 't28w-bkt-water', d: `M${f1(-bw * 0.46)} ${f1(-bw * 0.02)}L${f1(bw * 0.46)} ${f1(-bw * 0.02)}L${f1(bw * 0.4)} ${f1(bw * 0.5)}L${f1(-bw * 0.4)} ${f1(bw * 0.5)}Z` }),
      s('path', { class: 't28w-drip', d: stroke([[bw * 0.1, bw * 0.6], [bw * 0.14, bw * 1.4]], bw * 0.08, 0.3, 0.6, 0.2) })))
    // ── in front: the millrace, drops threading off the low paddles, spray, the pour, wet reeds cut by the frame
    // the wheel's rims mirrored under the race, broken by the ripples into short horizontal dashes
    const reflDash = () => {
      let d = ''
      for (const k of [0.97, 0.72]) for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2, x = cx + Math.cos(a) * R * k * sx, y = 2 * wl - cy + Math.sin(a) * R * k
        if (y < wl + R * 0.06) continue
        const len = R * (0.03 + r() * 0.07) * (1 - Math.abs(Math.cos(a)) * 0.5)
        d += stroke([[x - len, y], [x + len, y + (r() - 0.5)]], R * (k > 0.9 ? 0.03 : 0.018), 0.4, 0.4, 0.1)
      }
      return d
    }
    const millRefl = () => {
      let d = ''
      const x0 = millX, x1 = millX + millW + sideW
      for (let k = 0; k < 14; k++) {
        const u = k / 14, y = wl + R * 0.08 + u * R * 0.85
        for (let x = x0 + r() * 8; x < x1 - 6;) {
          const len = (x1 - x0) * (0.12 + r() * 0.3) * (1 - u * 0.6)
          d += stroke([[x, y], [Math.min(x1, x + len), y + (r() - 0.5)]], R * 0.022 * (1 - u * 0.7), 0.4, 0.4, 0.1)
          x += len + (x1 - x0) * (0.05 + r() * 0.12) * (1 + u)
        }
      }
      return d
    }
    let drops = ''
    for (let i = 0; i < 26; i++) {
      const a = Math.PI * (0.2 + r() * 0.6), x = cx + Math.cos(a) * R * 1.05 * sx + dx * r(), y0 = cy + Math.sin(a) * R * 1.02
      const fall = (wl - y0) * (0.3 + r() * 0.8)
      for (let j = 0; j < 3; j++) {
        const y = y0 + fall * ((j + 0.5) / 3) ** 1.5, k = R * (0.008 + j * 0.003)
        drops += `M${f1(x)} ${f1(y - k * 2)}Q${f1(x + k)} ${f1(y)} ${f1(x)} ${f1(y + k)}Q${f1(x - k)} ${f1(y)} ${f1(x)} ${f1(y - k * 2)}Z`
      }
    }
    let spray = ''
    for (let i = 0; i < 70; i++) {
      const x = cx - R * 1.1 + r() * R * 2.4, y = wl - R * 0.05 + (r() - 0.3) * R * 0.3, k = R * (0.005 + r() * 0.012)
      spray += blob(x, y, k, k * 0.8, 2870 + i, 0.2, 6)
    }
    near.replaceChildren(
      s('path', { class: 't28w-race', d: `M${f1(cx - R * 1.35)} ${f1(wl + R * 0.08)}Q${f1(cx - R * 0.6)} ${f1(wl - R * 0.03)} ${f1(cx)} ${f1(wl - R * 0.02)}L${f1(millX + millW + sideW)} ${f1(wl - R * 0.04)}L${f1(millX + millW + sideW + R * 0.2)} ${f1(wl + R * 0.12)}Q${f1(cx)} ${f1(wl + R * 0.24)} ${f1(cx - R * 1.35)} ${f1(wl + R * 0.08)}Z`, filter: 'url(#ink-wash)' }),
      s('path', { class: 't28w-pour', d: stroke(bez([head[0] - R * 0.02, head[1] + R * 0.02], [head[0] - R * 0.06, head[1] + R * 0.1], [head[0] - R * 0.05, head[1] + R * 0.2], 6), R * 0.035, 0.1, 0.5, 0.2) }),
      s('path', { class: 't28w-drops', d: drops }),
      s('path', { class: 't28w-foam', d: stroke(bez([cx - R * 0.85, wl + 2], [cx, wl - 6], [cx + R * 0.85, wl + 3], 16), R * 0.05, 0.3, 0.3, 0.2) }),
      s('path', { class: 't28w-spray', d: spray }),
      // the wheel and the mill in the water below: still rings and the wall, broken by the ripples (rings do not show
      // the turning, so the reflection needs no redraw)
      s('g', { class: 't28w-refl', 'clip-path': `url(#t28w-rc)` },
        s('clipPath', { id: 't28w-rc' }, s('rect', { x: 0, y: f1(wl + R * 0.06), width: f1(W), height: f1(H) })),
        s('path', { d: reflDash() }),
        s('path', { class: 't28w-refl-moon', d: blob(cx + R * 0.12, 2 * wl - cy + R * 0.1, R * 0.6 * sx, R * 0.5, 2863, 0.2) })),
      // the mill tower's reflection: dark ink broken into horizontal ripples, shorter and thinner as it goes down
      s('path', { class: 't28w-refl-mill', d: millRefl(), 'clip-path': 'url(#t28w-rc)' }),
      mist(cx, wl + R * 0.02, R * 1.3, R * 0.16),
      wash(blob(cx, wl + R * 0.14, R * 1.15, R * 0.12, 2856, 0.2), 0.3, 'p2p-wash t28w-reflect'),
      // wet reeds and foreground rushes fill the low frame, cut by its edges
      // (kept low and to the edges: the plank stands in the water in front of them)
      reeds(W * 0.03, H * 1.0, H * (wide ? 0.3 : 0.14), 2857, 11),
      reeds(W * 0.99, H * 1.01, H * (wide ? 0.16 : 0.12), 2858, 9),
      reeds(cx - R * 1.35, wl + R * 0.32, H * (wide ? 0.14 : 0.08), 2859, 6),
      ...(wide ? [reeds(W * 0.56, H * 1.02, H * 0.16, 2861, 7)] : []),
      wash(blob(W * 0.5, H * 1.02, W * 0.7, H * 0.08, 2862, 0.2), 0.45, 'p2p-wash t28w-bank'))
    // labels on the far islands (inside the frame), the board by the water, the wheel's hit area
    // (a tall frame: the wheel hides the far shore, so the names float on the water below the race, clear of the wheel)
    const tag = (el: HTMLElement, p: Pt) => Object.assign(el.style, { left: `${f1(clamp(p[0], wide ? 70 : 62, W - (wide ? 76 : 66)))}px`, top: `${f1(p[1] + iw * 0.12)}px` })
    // (wide: each name set off to the island's outer side, away from where the flumes land)
    tag(islandTags[1], wide ? [isleAI[0] - iw * 0.18, isleAI[1]] : isleAI)
    tag(islandTags[2], wide ? [isleDC[0] + iw * 0.2, isleDC[1]] : isleDC)
    islandTags[0].hidden = true // NVIDIA is cut into the mill wall
    // the board stands in the shallows at the front right (wide: the insight takes the left) / under the wheel's race (tall): never on the wheel or mill
    Object.assign(board.style, wide
      ? { left: `${f1(W * 0.965 - Math.min(360, W * 0.27))}px`, top: `${f1(Math.min(H * 0.7, wl + R * 0.28))}px`, width: `${f1(Math.min(360, W * 0.27))}px`, transform: '' }
      // (tall: hung from its foot, so a longer text grows up into the water, never down into the insight)
      : { left: `${f1(W * 0.06)}px`, top: `${f1(H - 46)}px`, width: `${f1(W * 0.88)}px`, transform: 'translateY(-100%)' })
    Object.assign(wheel.style, { left: `${f1(cx - R * 1.05)}px`, top: `${f1(cy - R * 1.05)}px`, width: `${f1(R * 2.1)}px`, height: `${f1(R * 2.1)}px` })
    place()
    gd.refresh()
  }
  ctx.onCleanup(onSize(ctx.art, layout))
}
