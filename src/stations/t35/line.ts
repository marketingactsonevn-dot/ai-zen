import './line.css'
import { fill, h, s } from '../../core/dom'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import { blob, clamp, curve, onSize, rng, stroke, type Pt } from '../../ui/part2/ink'
import { mist, moon, pine } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import { guide } from '../../ui/part2/guide'
import { C } from './content'
import { F, P, drift, f1, gdefs, ink, lantern, wood, woodG } from './kit'

const K = C.scenes.line
const N = K.stations.length
type St = (typeof K.stations)[number] & { why?: string; miss?: string }

/**
 * Scene 5 — a long workshop corridor at night in one-point perspective, its far door open on the moonlit garden.
 * Eight paper lanterns hang down it, left and right, near and big to far and small. Draw an ink cord from lantern to
 * lantern (or tap them in order): each joined lantern lights. Set vermilion stones on the floor under the stations that
 * need a person (drag one from the bowl, or tap the floor spot). Once the cord is whole the paper boat waits by the
 * first lantern until you tap it: then it runs the cord (it never sets off by itself). At each red stone it waits for you
 * to tap the stone (you are the human in the loop); a human station with no stone, it rushes through and that station
 * says what went wrong. Reduced motion / low: no boat run, lights by class.
 */
export function lineScene(ctx: SceneCtx) {
  gdefs()
  const still = ctx.reduced || ctx.quality === 'low'
  const stations = K.stations as St[]
  const lit = new Set<number>()
  const stones = new Set<number>()
  let done = false

  const hall = s('svg', { class: 't35d-hall', 'aria-hidden': 'true' })
  const cord = s('svg', { class: 't35d-cord', 'aria-hidden': 'true' })
  const trail = s('path', { class: 't35d-trail' })
  cord.append(trail)
  const boat = h('div', { class: 't35d-boat', 'aria-hidden': 'true' }, s('svg', { viewBox: '-20 -14 40 24' },
    s('circle', { class: 't35d-boat-glow', r: 13, fill: 'url(#t35k-pool)' }),
    s('path', { class: 't35d-boat-paper', d: 'M-12 2L12 2L7 7L-7 7Z M-8 2L-1 -9L-1 2Z M1 2L1 -7L7 2Z' })))
  const lamps = stations.map((st, i) => {
    const art = s('svg', { class: 't35d-lamp-art', 'aria-hidden': 'true' })
    // the name on the lantern's paper (or its number, where the paper is small), and on a tanzaku under it
    const btn = h('button', { class: 't35d-lamp', type: 'button', 'aria-pressed': 'false', 'aria-label': fill(K.stationAria, { n: i + 1, name: st.name }) },
      art, h('span', { class: 't35d-on', 'aria-hidden': 'true' }, h('span', { class: 't35d-on-name' }, st.name), h('span', { class: 't35d-on-n' }, String(i + 1))),
      h('span', { class: 't35d-name t35k-paper', 'aria-hidden': 'true' }, st.name))
    // keyboard only (a click with detail 0): a pointer tap is placed by geometry in the hall (see tapAt), since the near
    // lanterns' boxes and tanzaku overlap the far ones
    btn.addEventListener('click', (e) => e.detail === 0 && join(i))
    btn.addEventListener('keydown', (e) => {
      if (e.key !== 's' && e.key !== 'S') return
      e.preventDefault()
      toggle(i)
    })
    const spot = h('button', { class: 't35d-spot', type: 'button', 'aria-pressed': 'false', 'aria-label': fill(K.stoneAria, { name: st.name }), onClick: () => tapStone(i) },
      s('svg', { viewBox: '-30 -14 60 24', 'aria-hidden': 'true' },
        // a faint chalk mark on the boards where a stone may go
        s('path', { class: 't35d-chalk', d: stroke(Array.from({ length: 22 }, (_, q) => { const a = (q / 20) * Math.PI * 2 + i; return [Math.cos(a) * 21 * (1 + Math.sin(q * 2.1 + i) * 0.05), Math.sin(a) * 6.5] as Pt }), 1.8, 0.2, 0.25, 0.3) }),
        s('g', { class: 't35d-seal' },
          s('ellipse', { class: 't35k-contact', cx: 2, cy: 4, rx: 20, ry: 5 }),
          s('path', { class: 't35d-seal-body', d: blob(0, -3, 17, 9, 3560 + i, 0.14, 14), filter: 'url(#ink-rough)' }),
          ink(stroke(curve([-12, -7], [-4, -12], [8, -10], 6), 2, 0.3, 0.3, 0.1), 't35d-seal-hi'))))
    return { btn, art, spot, x: 0, y: 0, r: 0, fx: 0, fy: 0, k: 1 }
  })
  const table = s('svg', { class: 't35d-table', 'aria-hidden': 'true' })
  const bowl = h('div', { class: 't35d-bowl', 'aria-hidden': 'true' }, s('svg', { viewBox: '0 0 120 60', 'aria-hidden': 'true' },
    s('ellipse', { class: 't35k-contact', cx: 62, cy: 52, rx: 56, ry: 7 }),
    s('path', { class: 't35d-bowl-body', d: 'M8 24Q10 50 60 52Q110 50 112 24Z', filter: 'url(#ink-rough)' }),
    s('ellipse', { class: 't35d-bowl-in', cx: 60, cy: 24, rx: 52, ry: 9 }),
    ...[[40, 22], [58, 20], [76, 23], [50, 26], [68, 26]].map(([x, y], k) => s('path', { class: 't35d-seal-body', d: blob(x, y, 9, 5, 3600 + k, 0.14, 10) }))))
  const ghost = h('div', { class: 't35d-ghost', 'aria-hidden': 'true' }, s('svg', { viewBox: '-20 -12 40 24' }, s('path', { class: 't35d-seal-body', d: blob(0, 0, 16, 9, 3610, 0.14, 12) })))
  const board = h('div', { class: 't35d-board', 'aria-hidden': 'true' }, K.task)
  // what the bowl is for, written beside it; the boat's own button, by the first lantern once the cord is whole
  bowl.append(h('span', { class: 't35d-bowl-label' }, K.bowlLabel))
  const release = h('button', { class: 't35d-release t35k-paper', type: 'button', onClick: () => launch() }, K.release)
  const note = h('div', { class: 't35d-note t35k-halo' })
  const doorFact = h('div', { class: 't35d-doorfact t35k-paper' })
  const root = h('div', { class: `t35 t35d${still ? ' still' : ''}` },
    h('p', { class: 'visually-hidden' }, K.art), hall, cord, board, table,
    h('ol', { class: 't35d-line', 'aria-label': K.lineAria }, ...lamps.map((l) => h('li', null, l.btn, l.spot))),
    bowl, boat, release, ghost, doorFact, note)
  ctx.art.append(root)
  ctx.prompt(K.prompt)

  // ── guide: a dot on the next lantern (then the bowl, then the boat), a faint ink line to the next lantern, two counts
  const GD = guide(ctx)
  const dot = GD.dot(lamps[0].btn, { dir: [1, 0] })
  const way = GD.track(() => {
    const a = lamps[Math.max(0, lit.size - 1)], b = lamps[Math.min(N - 1, lit.size)]
    return [[a.x, a.y - a.r * 1.3], [b.x, b.y - b.r * 1.3]]
  })
  const lampN = GD.count(K.lampCount, N, () => [W * (port ? 0.82 : 0.88), H * 0.05])
  const stoneN = GD.count(K.stoneCount, 0, () => [W * (port ? 0.82 : 0.88), H * 0.05 + 24])
  /** the step after the cord: stones first, the boat once there is at least one */
  function nextStep() {
    if (lit.size < N || run || done) return
    root.classList.add('ready')
    if (stones.size) {
      dot.at(release)
      ctx.prompt(K.releasePrompt)
    } else {
      dot.at(bowl)
      ctx.prompt(K.stonesPrompt)
    }
  }
  const par = drift(ctx, root, [[hall, 5, 3]])

  let W = 0, H = 0, vx = 0, vy = 0, port = false
  let door: [number, number, number, number] = [0, 0, 0, 0]

  /** Which lanterns show their tanzaku: on a wide frame the ones too small for their name; on a phone only the next three. */
  const tagShown = (i: number) => !port || (i >= lit.size && i < lit.size + 3)
  function names() {
    lamps.forEach((l, i) => l.btn.classList.toggle('tag', !l.btn.classList.contains('named') && tagShown(i)))
  }
  /** Tanzaku on the same wall hang one under another: read their heights once, then let the far ones hang lower. */
  function stack() {
    const tags = lamps.map((l) => l.btn.querySelector<HTMLElement>('.t35d-name')!)
    const hs = tags.map((tg) => tg.offsetHeight)
    for (const side of [0, 1]) {
      let below = -Infinity
      lamps.forEach((l, i) => {
        if (i % 2 !== side || !l.btn.classList.contains('tag')) return
        const base = l.y + l.r * 1.25 + 6
        const top = Math.max(base, below + 6)
        tags[i].style.marginTop = `${f1(top - base + 6)}px`
        tags[i].style.setProperty('--drop', `${f1(top - base + 6)}px`)
        below = top + hs[i]
      })
    }
  }

  // ── joining: tap in order, or draw: a pointer stroke from a lit lantern picks up each next lantern it passes over
  function join(i: number) {
    if (lit.has(i)) return
    if (i > 0 && !lit.has(i - 1)) {
      lamps[i].btn.classList.remove('nope')
      void lamps[i].btn.offsetWidth // restart the shake
      lamps[i].btn.classList.add('nope')
      ctx.chime('low')
      return
    }
    lit.add(i)
    root.classList.add(`l${i}`)
    lamps[i].btn.classList.add('on')
    lamps[i].btn.setAttribute('aria-pressed', 'true')
    ctx.chime('tap')
    drawCord()
    if (port) (names(), stack())
    lampN.set(lit.size)
    if (lit.size < N) {
      dot.at(lamps[lit.size].btn)
      GD.refresh()
    } else {
      way.done()
      nextStep()
    }
  }
  let swiped = false
  let drawing = -1
  const pts: Pt[] = []
  let ox = 0, oy = 0
  /** A tap in the hall: the next lantern if it is near, else the nearest lantern (by its own size), else nothing. */
  function tapAt(x: number, y: number) {
    const d = (l: (typeof lamps)[number]) => Math.hypot(l.x - x, l.y - y) / Math.max(l.r, 18)
    const nx = lit.size < N ? lamps[lit.size] : null
    if (nx && d(nx) < 1.9) return join(lit.size)
    let best = -1, bd = 1.5
    lamps.forEach((l, i) => {
      const v = d(l)
      if (v < bd) (bd = v), (best = i)
    })
    if (best >= 0) join(best)
  }
  root.addEventListener('pointerdown', (e) => {
    if (e.button || (e.target as Element).closest('.t35d-spot, .t35d-bowl, .t35d-release, .t35d-doorfact, .t35d-seal')) return
    const r = root.getBoundingClientRect()
    ox = r.left
    oy = r.top
    drawing = e.pointerId
    swiped = false
    pts.length = 0
    pts.push([e.clientX - ox, e.clientY - oy])
    // no capture yet: a plain tap must still reach the lantern's own button (its click joins it)
  })
  root.addEventListener('pointermove', (e) => {
    if (e.pointerId === drawing) {
      const p: Pt = [e.clientX - ox, e.clientY - oy]
      if (!swiped && Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]) < 12) return
      if (!swiped) {
        swiped = true
        root.setPointerCapture(e.pointerId)
        const first = lamps.findIndex((l) => Math.hypot(l.x - pts[0][0], l.y - pts[0][1]) < l.r * 1.8)
        if (first >= 0) join(first)
      }
      pts.push(p)
      if (pts.length > 60) pts.shift()
      trail.setAttribute('d', stroke(pts, 4, 0.3, 0.05, 0.3))
      const next = lit.size
      if (next < N && Math.hypot(lamps[next].x - p[0], lamps[next].y - p[1]) < lamps[next].r * 1.6) join(next)
    } else if (e.pointerId === dragStone) moveGhost(e)
  })
  const endDraw = (e: PointerEvent) => {
    if (e.pointerId === drawing) {
      drawing = -1
      if (!swiped && e.type === 'pointerup') tapAt(pts[0][0], pts[0][1])
      trail.setAttribute('d', '')
      setTimeout(() => (swiped = false))
    } else if (e.pointerId === dragStone) dropStone(e)
  }
  root.addEventListener('pointerup', endDraw)
  root.addEventListener('pointercancel', endDraw)

  // ── red stones: drag one from the bowl to a floor spot, or tap the spot (tap again to lift it)
  let dragStone = -1
  bowl.addEventListener('pointerdown', (e) => {
    if (e.button) return
    const r = root.getBoundingClientRect()
    ox = r.left
    oy = r.top
    dragStone = e.pointerId
    root.setPointerCapture(e.pointerId)
    root.classList.add('carry')
    moveGhost(e)
  })
  function moveGhost(e: PointerEvent) {
    ghost.style.transform = `translate3d(${f1(e.clientX - ox)}px, ${f1(e.clientY - oy)}px, 0)`
  }
  function dropStone(e: PointerEvent) {
    dragStone = -1
    root.classList.remove('carry')
    const x = e.clientX - ox, y = e.clientY - oy
    let best = -1, bd = Infinity
    lamps.forEach((l, i) => {
      const d = Math.hypot(l.fx - x, l.fy - y)
      if (d < bd) (bd = d), (best = i)
    })
    if (best >= 0 && bd < Math.max(50, lamps[best].r * 3) && !stones.has(best)) toggle(best)
  }
  function tapStone(i: number) {
    if (run && run.wait === i) return approve()
    toggle(i)
  }
  function toggle(i: number) {
    if (done || run) return
    const st = stations[i]
    const on = !stones.has(i)
    if (on) stones.add(i)
    else stones.delete(i)
    lamps[i].spot.classList.toggle('on', on)
    lamps[i].spot.setAttribute('aria-pressed', String(on))
    say(on ? (st.human ? st.why ?? '' : K.extraStone) : '')
    ctx.chime(on ? 'soft' : 'low')
    stoneN.set(stones.size)
    nextStep()
  }
  function say(text: string, cls = '') {
    note.replaceChildren(text ? h('p', { class: cls }, text) : '')
    if (!note.hasAttribute('aria-live')) note.setAttribute('aria-live', 'polite')
  }

  // ── the run: a glowing paper boat along the cord to the door
  let run: { s: number; wait: number; leak: number; miss: number; passed: Set<number> } | null = null
  let path: Pt[] = [] // lantern feet then the door, the boat's way
  let lens: number[] = []
  function launch() {
    if (done || run || lit.size < N) return
    const firstMiss = stations.findIndex((x, i) => x.human && !stones.has(i))
    if (still) {
      if (firstMiss >= 0) {
        lamps[firstMiss].spot.classList.add('missed')
        return lose(firstMiss)
      }
      return finish()
    }
    run = { s: 0, wait: -1, leak: 0, miss: -1, passed: new Set() }
    root.classList.add('running')
    lamps.forEach((l) => l.spot.classList.remove('missed'))
    dot.at(boat)
    loop.start()
  }
  function lose(i: number) {
    root.classList.add('lost')
    say(`${stations[i].miss ?? ''} ${K.lost}`, 'miss')
    nextStep()
    dot.at(bowl)
    GD.wrong(K.stonesPrompt)
    setTimeout(() => root.classList.remove('lost'), 1600)
    ctx.chime('low')
  }
  function approve() {
    if (!run) return
    lamps[run.wait].spot.classList.remove('waiting')
    run.passed.add(run.wait)
    run.wait = -1
    dot.at(boat)
    ctx.prompt(K.releasePrompt)
    ctx.chime('soft')
    loop.start()
  }
  const at = (d: number): Pt => {
    let k = 0
    while (k < lens.length - 1 && lens[k + 1] < d) k++
    const a = path[k], b = path[Math.min(k + 1, path.length - 1)]
    const seg = (lens[k + 1] ?? lens[k]) - lens[k] || 1
    const t = clamp((d - lens[k]) / seg, 0, 1)
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
  }
  const loop = createLoop(root, (_t, dt) => {
    if (!run || run.wait >= 0) return false
    const total = lens[lens.length - 1]
    const next = run.passed.size < N ? run.passed.size : -1 // lanterns are met in order
    // it slows near each lantern; a human station without a stone, it rushes past
    const hurry = run.leak ? 2.4 : 1
    run.s = Math.min(total, run.s + dt * W * 0.42 * hurry)
    if (next >= 0 && run.s >= lens[next]) {
      run.s = lens[next]
      if (stones.has(next)) {
        run.wait = next
        lamps[next].spot.classList.add('waiting')
        dot.at(lamps[next].spot)
        ctx.prompt(K.waitPrompt)
        if (!stations[next].human) say(K.extraStone)
      } else {
        run.passed.add(next)
        if (stations[next].human) {
          // nobody there: what goes wrong is said at that station, at once
          run.leak++
          if (run.miss < 0) run.miss = next
          lamps[next].spot.classList.add('missed')
          say(stations[next].miss ?? '', 'miss')
        }
      }
    }
    const [x, y] = at(run.s)
    boat.style.transform = `translate3d(${f1(x)}px, ${f1(y)}px, 0) scale(${f1(clamp(1 - run.s / total * 0.7, 0.3, 1))})`
    if (run.s >= total) {
      const miss = run.miss
      run = null
      root.classList.remove('running')
      if (miss >= 0) lose(miss)
      else finish()
      return false
    }
    return run?.wait === -1
  })

  function finish() {
    if (done) return
    done = true
    root.classList.add('is-done')
    root.classList.remove('ready')
    say('')
    dot.done()
    doorFact.replaceChildren(h('p', { class: 't35d-done' }, K.done), ctx.fact(F(K.facts[0]), 'p'))
    ctx.chime('ok')
    ctx.insight(F(K.insight), K.detail)
  }

  /** The cord: catenaries from each lit lantern to the next lit one, and from the last on to the door. */
  function drawCord() {
    const segs: SVGElement[] = []
    for (let i = 0; i < N - 1; i++) {
      if (!lit.has(i) || !lit.has(i + 1)) continue
      const a: Pt = [lamps[i].x, lamps[i].y - lamps[i].r * 1.3], b: Pt = [lamps[i + 1].x, lamps[i + 1].y - lamps[i + 1].r * 1.3]
      const m: Pt = [(a[0] + b[0]) / 2, Math.max(a[1], b[1]) + Math.abs(a[0] - b[0]) * 0.08]
      segs.push(ink(stroke(curve(a, m, b, 14), Math.max(1.2, lamps[i].k * 3.4), 0.08, 0.08, 0.5), 't35d-ink', 'rough'))
    }
    if (lit.size === N) {
      const a: Pt = [lamps[N - 1].x, lamps[N - 1].y - lamps[N - 1].r * 1.3]
      segs.push(ink(stroke(curve(a, [(a[0] + vx) / 2, a[1] + 4], [vx, door[1] + door[3] * 0.18], 10), 1.2, 0.1, 0.4, 0.4), 't35d-ink', 'rough'))
    }
    cord.replaceChildren(trail, ...segs)
  }

  function* paint() {
    port = W < H * 0.8
    vx = W * 0.5
    vy = H * (port ? 0.42 : 0.5)
    // one-point perspective: depth d 0 (the frame) … 1 (the door plane); k = scale at that depth
    const kd = port ? 0.24 : 0.17
    const K0 = 1 / kd - 1
    const sc = (d: number) => 1 / (1 + d * K0)
    const halfW = port ? W * 0.62 : W * 0.56, floorY = port ? H * 0.62 : H * 0.6, ceilY = port ? H * 0.46 : H * 0.6
    const pt = (u: number, v: number, d: number): Pt => { const k = sc(d); return [vx + u * halfW * k, v < 0 ? vy + -v * floorY * k : vy - v * ceilY * k] }
    const quad = (a: Pt, b: Pt, c: Pt, d: Pt) => `M${P(a)}L${P(b)}L${P(c)}L${P(d)}Z`
    const dw = halfW * kd * 1.9, dh = (floorY + ceilY * 0.92) * kd
    door = [vx - dw / 2, vy + floorY * kd - dh, dw, dh]
    const [dx, dy, dW, dH] = door
    // the floor: planks running to the door, two tones, seams, butt joints; warm pools under the lanterns
    const r = rng(3600)
    const tone = ['', '']
    let seams = '', joints = ''
    const nb = port ? 9 : 13
    for (let k = 0; k < nb; k++) {
      const u0 = -1 + (2 * k) / nb, u1 = -1 + (2 * (k + 1)) / nb
      tone[k % 2] += quad(pt(u0, -1, 0), pt(u1, -1, 0), pt(u1, -1, 1), pt(u0, -1, 1))
      seams += stroke([pt(u0, -1, 0), pt(u0, -1, 1)], 1.6, 0.02, 0.5, 0.2)
      for (let j = 0; j < 3; j++) {
        const d = r() * 0.8
        joints += stroke([pt(u0, -1, d), pt(u1, -1, d)], Math.max(0.6, 2 * sc(d)), 0.05, 0.05, 0.4)
      }
    }
    // the walls: shoji panels between dark posts over a dark wainscot; the ceiling dark with beams
    const pd = [0.0, 0.1, 0.22, 0.36, 0.52, 0.72, 1]
    let posts = '', beams = '', lat = '', wains = ''
    const panels: string[] = []
    for (let k = 0; k < pd.length - 1; k++) {
      for (const u of [-1, 1]) {
        panels.push(quad(pt(u, 1, pd[k]), pt(u, 1, pd[k + 1]), pt(u, -0.55, pd[k + 1]), pt(u, -0.55, pd[k])))
        wains += quad(pt(u, -0.55, pd[k]), pt(u, -0.55, pd[k + 1]), pt(u, -1, pd[k + 1]), pt(u, -1, pd[k]))
        for (let j = 1; j < 4; j++) {
          const v = 1 - (j * 1.55) / 4
          lat += stroke([pt(u, v, pd[k]), pt(u, v, pd[k + 1])], Math.max(0.7, 2 * sc(pd[k])), 0.05, 0.05, 0.6)
        }
        for (let j = 1; j < 3; j++) {
          const dm = pd[k] + ((pd[k + 1] - pd[k]) * j) / 3
          lat += stroke([pt(u, 1, dm), pt(u, -0.55, dm)], Math.max(0.7, 2 * sc(dm)), 0.05, 0.05, 0.6)
        }
      }
    }
    for (const d of pd.slice(0, -1)) {
      const k = sc(d)
      beams += stroke([pt(-1, 1, d), pt(1, 1, d)], 14 * k + 2, 0.02, 0.02, 0.85)
      for (const u of [-1, 1]) posts += stroke([pt(u, 1, d), pt(u, -1, d)], 16 * k + 2, 0.02, 0.02, 0.85)
    }
    const wallL = quad(pt(-1, 1, 0), pt(-1, 1, 1), pt(-1, -1, 1), pt(-1, -1, 0))
    const wallR = quad(pt(1, 1, 0), pt(1, 1, 1), pt(1, -1, 1), pt(1, -1, 0))
    const ceil = quad(pt(-1, 1, 0), pt(-1, 1, 1), pt(1, 1, 1), pt(1, 1, 0))
    // the lanterns' depths: near left (large, cut by the frame) to far right (small, by the door), on alternate walls
    const ds = Array.from({ length: N }, (_, i) => (port ? 0.03 : 0.02) + Math.pow(i / (N - 1), 1.15) * (port ? 0.62 : 0.4))
    // warm pools on the floor and on the shoji under each lantern; near ones warm, far ones cool (the moon's side)
    const pools: SVGElement[] = []
    lamps.forEach((_, i) => {
      const d = ds[i], k = sc(d)
      const side = i % 2 ? 1 : -1
      const [fx, fy] = pt(side * 0.55, -1, d + 0.015)
      const warm = d < 0.28
      pools.push(
        s('ellipse', { class: `t35d-pool${warm ? '' : ' cool'}`, 'data-i': String(i), cx: f1(fx), cy: f1(fy), rx: f1(halfW * k * 0.55), ry: f1(floorY * k * 0.16), fill: `url(#${warm ? 't35d-warm' : 't35d-cool'})` }),
        s('ellipse', { class: `t35d-pool wall${warm ? '' : ' cool'}`, 'data-i': String(i), cx: f1(pt(side, 0.3, d)[0]), cy: f1(pt(side, 0.3, d)[1]), rx: f1(halfW * k * 0.12), ry: f1(ceilY * k * 0.75), fill: `url(#${warm ? 't35d-warm' : 't35d-cool'})` }))
    })
    // washi fibres for the shoji (one small tile)
    const rf = rng(3610)
    let fibres = ''
    for (let k = 0; k < 14; k++) {
      const fx2 = rf() * 64, fy2 = rf() * 64, a = rf() * Math.PI
      fibres += stroke([[fx2, fy2], [fx2 + Math.cos(a) * (6 + rf() * 10), fy2 + Math.sin(a) * (6 + rf() * 10)]], 0.7 + rf() * 0.6, 0.3, 0.3, 0.2)
    }
    // the moon garden beyond the door: the light and the goal; the door's frame in silhouette against it
    yield
    hall.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    hall.replaceChildren(
      s('defs', null,
        s('radialGradient', { id: 't35d-warm' }, s('stop', { offset: 0, class: 't35d-w0' }), s('stop', { offset: 0.45, class: 't35d-w1' }), s('stop', { offset: 1, class: 't35d-w2' })),
        s('radialGradient', { id: 't35d-cool' }, s('stop', { offset: 0, class: 't35d-c0' }), s('stop', { offset: 1, class: 't35d-c2' })),
        s('radialGradient', { id: 't35d-garden', cx: 0.5, cy: 0.62, r: 0.75 }, s('stop', { offset: 0, class: 't35d-g0' }), s('stop', { offset: 1, class: 't35d-g1' })),
        s('pattern', { id: 't35d-fiber', width: 64, height: 64, patternUnits: 'userSpaceOnUse' },
          s('rect', { class: 't35d-fiber-bg', width: 64, height: 64 }),
          s('path', { class: 't35d-fiber', d: fibres }))),
      s('rect', { class: 't35d-dark', width: f1(W), height: f1(H) }),
      s('clipPath', { id: 't35d-door' }, s('rect', { x: f1(dx), y: f1(dy), width: f1(dW), height: f1(dH) })),
      s('rect', { x: f1(dx), y: f1(dy), width: f1(dW), height: f1(dH), fill: 'url(#t35d-garden)' }),
      s('g', { 'clip-path': 'url(#t35d-door)' },
        moon(dx + dW * 0.64, dy + dH * 0.26, Math.min(dW * 0.11, 15), 3701, false),
        mist(dx + dW / 2, dy + dH * 0.78, dW, dH * 0.22),
        s('g', { class: 't35d-bough' }, pine(dx + dW * 0.16, dy + dH * 1.05, dH * 0.9, 3702, 1)),
        ink(blob(dx + dW * 0.62, dy + dH * 0.95, dW * 0.3, dH * 0.06, 3703, 0.2, 12), 't35d-gardenrock', 'wash')),
      s('path', { class: 't35d-wall', d: wallL }), s('path', { class: 't35d-wall', d: wallR }),
      s('path', { class: 't35d-shoji', d: panels.join(''), fill: 'url(#t35d-fiber)' }),
      s('path', { class: 't35d-wains', d: wains }),
      s('path', { class: 't35d-ceil', d: ceil }),
      s('path', { class: 't35d-floor f0', d: tone[0] }), s('path', { class: 't35d-floor f1', d: tone[1] }),
      ink(seams, 't35d-seam', 'dry'), ink(joints, 't35d-seam', 'rough'),
      // the moonlight spills in through the door along the floor
      s('path', { class: 't35d-moonfloor', d: `M${P([dx + dW * 0.06, dy + dH])}L${P([dx + dW * 0.94, dy + dH])}L${P(pt(0.42, -1, 0.15))}L${P(pt(-0.32, -1, 0.15))}Z`, fill: 'url(#t35k-beam)' }),
            ...pools,
      ink(lat, 't35d-lattice', 'rough'), ink(beams + posts, 't35d-timber', 'rough'),
      // the far end falls into cool shadow; near, the warm lanterns
      s('rect', { class: 't35d-depthwash', x: f1(dx - dW * 1.6), y: f1(dy - dH * 0.4), width: f1(dW * 4.2), height: f1(dH * 1.8), rx: f1(dW), filter: 'url(#ink-wash)' }),
      s('rect', { class: 't35d-doorglow', x: f1(dx - dW * 0.4), y: f1(dy - dH * 0.1), width: f1(dW * 1.8), height: f1(dH * 1.25), rx: f1(dW * 0.6), fill: 'url(#t35d-garden)' }),
      woodG([wood([dx - 5, dy + dH], [dx - 5, dy - 3], Math.max(4, dW * 0.06), 3704), wood([dx + dW + 5, dy + dH], [dx + dW + 5, dy - 3], Math.max(4, dW * 0.06), 3705), wood([dx - 12, dy - 3], [dx + dW + 12, dy - 3], Math.max(4, dW * 0.08), 3706)], 't35d-doorframe'))
    yield
    // the lanterns down the hall; each one's floor spot (a faint chalk mark) under it
    lamps.forEach((l, i) => {
      const d = ds[i], k = sc(d)
      const side = i % 2 ? 1 : -1
      const u = side * (port ? 0.5 : 0.56)
      const [x, top] = pt(u, 1, d)
      const cordLen = (port ? H * 0.1 : H * 0.08) * k + 6
      const rr = clamp((port ? W * 0.1 : W * 0.06) * k, port ? 8 : 22, port ? 38 : 78)
      l.k = k
      l.r = rr
      l.x = x
      l.y = top + cordLen + rr * 1.25
      const [fx, fy] = pt(u * 0.92, -1, d + 0.015)
      l.fx = fx
      l.fy = fy
      const bw = rr * 2.6, bh = cordLen + rr * 2.7
      Object.assign(l.btn.style, { left: `${f1(x - bw / 2)}px`, top: `${f1(top)}px`, width: `${f1(bw)}px`, height: `${f1(bh)}px`, zIndex: String(N - i + 2) })
      l.art.setAttribute('viewBox', `${f1(-bw / 2)} 0 ${f1(bw)} ${f1(bh)}`)
      l.art.replaceChildren(lantern(0, 0, rr, 3720 + i, cordLen, d > 0.26))
      // the name is written on the lantern's paper when there is room (wide frame, near ones); else on a tanzaku under it
      const body = l.btn.querySelector<HTMLElement>('.t35d-on')!
      const onBody = !port && rr >= 40
      l.btn.classList.toggle('named', onBody)
      Object.assign(body.style, { left: `${f1(bw / 2 - rr * 0.78)}px`, width: `${f1(rr * 1.56)}px`, top: `${f1(cordLen + rr * 0.32)}px`, height: `${f1(rr * 1.86)}px`, fontSize: `${f1(onBody ? clamp(rr * 0.25, 13, 17) : clamp(rr * 0.55, 12, 18))}px` })
      const sw = clamp(110 * k, 40, 100)
      Object.assign(l.spot.style, { left: `${f1(fx - sw / 2)}px`, top: `${f1(fy - sw * 0.24)}px`, width: `${f1(sw)}px`, height: `${f1(sw * 0.4)}px` })
      l.btn.classList.toggle('right', side > 0)
      const tag = l.btn.querySelector<HTMLElement>('.t35d-name')!
      const tw = port ? Math.min(W * 0.4, 150) : clamp(W * 0.085, 104, 124)
      const cx = side < 0 ? clamp(x, tw / 2 + W * 0.02, vx - dW * 0.6 - tw / 2) : clamp(x, vx + dW * 0.6 + tw / 2, W * 0.98 - tw / 2)
      Object.assign(tag.style, { width: `${f1(tw)}px`, left: `${f1(cx - (x - bw / 2))}px` })
    })
    names()
    stack()
    // the run's way: each lantern, then the door
    path = [...lamps.map((l) => [l.x, l.y - l.r * 1.3] as Pt), [vx, dy + dH * 0.18]]
    lens = [0]
    for (let i = 1; i < path.length; i++) lens.push(lens[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]))
    boat.style.transform = `translate3d(${f1(path[0][0])}px, ${f1(path[0][1])}px, 0)`
    release.style.transform = `translate3d(${f1(path[0][0])}px, ${f1(lamps[0].y + lamps[0].r * 1.3)}px, 0)`
    cord.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    drawCord()
    // the near table, cut by the frame: the bowl of red stones, the inkstone with the brush across it
    const tw2 = port ? W * 0.5 : W * 0.3, th2 = port ? H * 0.13 : H * 0.17
    const tx = -tw2 * 0.12, ty = H - th2 * 0.82
    table.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    table.replaceChildren(
      s('path', { class: 't35d-tablesh', d: blob(tx + tw2 * 0.55, ty + th2 * 0.2, tw2 * 0.62, th2 * 0.35, 3730, 0.2, 14), filter: 'url(#ink-wash)' }),
      s('path', { class: 't35d-tabletop', d: `M${P([tx, ty + th2 * 0.12])}L${P([tx + tw2 * 0.92, ty])}L${P([tx + tw2, ty + th2 * 0.5])}L${P([tx + tw2 * 0.04, ty + th2 * 0.7])}Z` }),
      s('path', { class: 't35d-tableedge', d: `M${P([tx + tw2 * 0.04, ty + th2 * 0.7])}L${P([tx + tw2, ty + th2 * 0.5])}L${P([tx + tw2, ty + th2 * 0.62])}L${P([tx + tw2 * 0.04, ty + th2 * 0.84])}Z` }),
      ink(stroke([[tx + tw2 * 0.1, ty + th2 * 0.18], [tx + tw2 * 0.9, ty + th2 * 0.06]], 1.2, 0.1, 0.1, 0.3) + stroke([[tx + tw2 * 0.12, ty + th2 * 0.4], [tx + tw2 * 0.95, ty + th2 * 0.26]], 1, 0.1, 0.1, 0.3), 't35d-tablegrain', 'dry'),
      s('ellipse', { class: 't35d-tablepool', cx: f1(tx + tw2 * 0.6), cy: f1(ty + th2 * 0.3), rx: f1(tw2 * 0.5), ry: f1(th2 * 0.4), fill: 'url(#t35d-warm)' }),
      s('rect', { class: 't35d-inkstone', x: f1(tx + tw2 * 0.16), y: f1(ty + th2 * 0.24), width: f1(tw2 * 0.18), height: f1(th2 * 0.3), rx: 5, transform: `rotate(-8 ${f1(tx + tw2 * 0.25)} ${f1(ty + th2 * 0.4)})`, filter: 'url(#ink-rough)' }),
      ink(stroke([[tx + tw2 * 0.1, ty + th2 * 0.42], [tx + tw2 * 0.44, ty + th2 * 0.3]], Math.max(2.4, th2 * 0.04), 0.02, 0.3, 0.4) + stroke([[tx + tw2 * 0.44, ty + th2 * 0.3], [tx + tw2 * 0.5, ty + th2 * 0.28]], Math.max(4, th2 * 0.07), 0.1, 0.6, 0.3), 't35d-brush', 'rough'))
    const bwid = clamp(W * (port ? 0.2 : 0.1), 72, 130)
    Object.assign(bowl.style, { left: `${f1(tx + tw2 * 0.56)}px`, top: `${f1(ty + th2 * 0.06 - bwid * 0.3)}px`, width: `${f1(bwid)}px` })
    const l0 = lamps[0]
    Object.assign(board.style, port
      ? { left: `${f1(W * 0.04)}px`, top: `${f1(H * 0.015)}px`, maxWidth: `${f1(W * 0.6)}px` }
      : { left: `${f1(Math.max(W * 0.03, l0.x - l0.r * 1.6))}px`, top: `${f1(Math.max(4, l0.y - l0.r * 1.25 - (l0.y - l0.r * 1.25 - 0) * 0.62))}px`, maxWidth: `${f1(W * 0.22)}px` })
    Object.assign(note.style, port
      ? { left: `${f1(tw2 * 0.86)}px`, right: '3%', top: 'auto', bottom: `${f1(H * 0.02)}px` }
      : { left: `${f1(W * 0.34)}px`, right: '12%', top: 'auto', bottom: `${f1(H * 0.03)}px` })
    // the fact hangs in the lower half of the door, the moon garden still above it; on a phone it lies on the near table
    const fw = Math.min(Math.max(dW * 1.05, 240), 320)
    Object.assign(doorFact.style, port
      ? { left: '4%', right: '4%', width: 'auto', top: 'auto', bottom: `${f1(H * 0.02)}px` }
      : { left: `${f1(Math.max(W * 0.03, dx - fw - 18))}px`, right: 'auto', width: `${f1(fw)}px`, top: `${f1(dy + dH * 0.8)}px`, bottom: 'auto' })
    root.classList.toggle('port', port)
    par.resize()
    GD.refresh()
  }
  let job: { cancel(): void } | null = null
  let first = true
  function layout() {
    W = root.clientWidth
    H = root.clientHeight
    if (W < 60 || H < 60) return
    job?.cancel()
    job = sliced(paint(), { sync: ctx.reduced || !first }) // only the first paint soaks in
    first = false
  }
  ctx.onCleanup(onSize(root, layout))
  ctx.onCleanup(() => {
    job?.cancel()
    loop.dispose()
  })
}
