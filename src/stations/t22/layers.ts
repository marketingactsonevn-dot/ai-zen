import { fill, h, s } from '../../core/dom'
import { sliced } from '../../core/chunk'
import type { SceneCtx } from '../types'
import { onSize, p2Defs, stableHeight, stoneArt } from '../../ui/part2/ink'
import { guide } from '../../ui/part2/guide'
import { C } from './data'
import { blob, curve, f1, hills, mist, moon, rng, stroke, type Pt } from './kit'

const K = C.scenes.layers
const TICKS = 96

/**
 * Scene 3 (2.5D, CSS 3D) — a cutaway into the ground (not a block in the air): the garden's surface (moss, grass, pebbles,
 * the pond with its lily pads and the moon in it) runs on left and right to the frame, and one clean cut down through it
 * shows the pond in section — a glass-clear face where the water lies in silk bands (mist → water → ink) between
 * ragged soil walls, the earth either side in beds of stone and root — fading into the night below. 96 growth rings
 * along the cut edge in three bands; the essay's scroll half-buried in the sand of the bed. The pebble carved "nó" is the
 * slider: drag it down (or ← → ↑ ↓) and it sinks; each band it passes lights up, adds a coat of ink to the word and
 * writes its reading in the record column on the right, level with it.
 */
export function layersScene(ctx: SceneCtx) {
  p2Defs()
  const N = K.stages.length
  const low = ctx.quality === 'low'
  let v = 0 // where the pebble is: 0 on the surface … N on the bed (fractional while dragged)
  let done = false
  const stableH = stableHeight(ctx, [K.insight])

  const face = (cls: string) => h('div', { class: `g8y2-face ${cls}` })
  const sky = s('svg', { class: 'g8y2-sky', 'aria-hidden': 'true' })
  const top = face('top'), front = face('front'), back = face('back'), inner = face('inner'), dust = face('dust'), veil = face('fog')
  // the cut runs on through the ground either side: earth faces in the cut's plane, the ground surface over them
  const earthL = face('earth l'), earthR = face('earth r'), groundL = face('ground l'), groundR = face('ground r')
  const frontArt = s('svg', { 'aria-hidden': 'true' })
  // where the surface, each band's middle and the bed are on the cut edge: measured on layout to line the record up
  const marks = [0, 1, 2, 3, 4].map(() => h('i', { class: 'g8y3-mark' }))
  front.append(frontArt, ...marks)
  // ── the record column on the right: the sentence, what the marks are, a rule with a notch per band (level with it on
  // the block), and each band's reading written beside its notch as the pebble passes it; they stay
  const reads = K.stages.map((st) => h('div', { class: 'g8y3-read' }, h('span', { class: 'g8y3-at' }, st.at), h('p', null, st.reads)))
  const notches = K.stages.map(() => h('i', { class: 'g8y3-notch' }))
  const rule = h('div', { class: 'g8y3-rule', 'aria-hidden': 'true' }, h('i', { class: 'g8y3-run' }), ...notches)
  const col = h('div', { class: 'g8y3-col' }, rule, ...reads)
  const head = h('div', { class: 'g8y3-head' }, h('p', { class: 'g8y3-sentence' }, K.sentence), h('p', { class: 'g8y3-cap' }, h('b', null, K.slider), ' · ', K.ruler))
  const ink = s('g', { class: 'g8y2-ink' })
  const pebble = h('div', {
    class: 'g8y2-pebble', role: 'slider', tabindex: '0', 'aria-label': K.sliderAria,
    'aria-valuemin': '0', 'aria-valuemax': String(N), 'aria-valuenow': '0', 'aria-valuetext': fill(K.valueText, { n: 0, total: N }),
  }, s('svg', { viewBox: '-60 -40 120 80', 'aria-hidden': 'true' }, ink))
  const world = h('div', { class: 'g8y2-world' }, back, inner, earthL, earthR, front, groundL, groundR, top, pebble, dust, veil)
  const view = h('div', { class: 'g8y2-view' }, world)
  // the sentence of slide 2, so this slide reads on its own (whose “nó” is it?)
  const root = h('div', { class: 'g8y2 g8y3' }, h('p', { class: 'visually-hidden' }, K.art), sky, view, col, head)
  ctx.art.append(root)
  ctx.prompt(K.prompt)
  // H1 on the pebble (it leans down, the way to drag); H7: still for 6 s, it dips 8 px and floats back
  const g = guide(ctx)
  const dot = g.dot(pebble, { dir: [0, 1] })
  const idle = () => void (!done && !ctx.reduced && pebble.animate([{ translate: '0 0' }, { translate: '0 8px' }, { translate: '0 0' }], { duration: 1300, easing: 'cubic-bezier(.45,.05,.3,1)', composite: 'add' }))
  ctx.el.addEventListener('p2:idle', idle)
  ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', idle))

  let G2 = { eL: 0, eR: 0 }
  let G = { W: 0, H: 0, Bw: 0, Bh: 0, Bd: 0, surf: 0, floor: 0, band: 0, wide: true }
  let job: { cancel(): void } | null = null
  ctx.onCleanup(() => job?.cancel())

  function layout() {
    const W = ctx.art.clientWidth, H = stableH(ctx.art.clientHeight)
    if (W < 60 || H < 60) return
    const wide = W > H
    // the block in the left third, 55 % of the height (whole in frame: the camera never draws back); the record column right
    const Bh = Math.round(H * (wide ? 0.58 : 0.62))
    const Bw = Math.round(wide ? Math.min(W * 0.3, Bh * 0.92, 470) : W * 0.46)
    const Bd = Math.round(Bw * 0.62)
    // (the pond's bed a quarter above the cut's foot: earth below it, fading into the night)
    const surf = -Bh / 2, floor = Bh / 2 - Bh * 0.24
    G = { W, H, Bw, Bh, Bd, surf, floor, band: (floor - surf) / N, wide }
    root.style.height = `${f1(H)}px`
    view.style.perspective = `${Math.round(Math.max(W, H) * 1.6)}px`
    view.style.perspectiveOrigin = `${wide ? 46 : 50}% 30%`
    // faces a pixel over their edges, so the seams of the box never open
    const put = (el: HTMLElement, w: number, hh: number, tf: string) => Object.assign(el.style, { width: `${w + 1}px`, height: `${hh + 1}px`, left: `${-(w + 1) / 2}px`, top: `${-(hh + 1) / 2}px`, transform: tf })
    put(front, Bw, Bh, `translateZ(${Bd / 2}px)`)
    put(back, Bw, Bh, `translateZ(${-Bd / 2}px)`)
    put(inner, Bd, Bh, `translateX(${-Bw / 2}px) rotateY(90deg)`)
    const eL = Math.round(W * (wide ? 0.24 : 0.22)), eR = Math.round(W * (wide ? 0.16 : 0.1))
    put(earthL, eL, Bh, `translate3d(${-(Bw + eL) / 2}px, 0, ${Bd / 2}px)`)
    put(earthR, eR, Bh, `translate3d(${(Bw + eR) / 2}px, 0, ${Bd / 2}px)`)
    put(groundL, eL, Bd, `translate3d(${-(Bw + eL) / 2}px, ${surf}px, 0) rotateX(90deg)`)
    put(groundR, eR, Bd, `translate3d(${(Bw + eR) / 2}px, ${surf}px, 0) rotateX(90deg)`)
    G2 = { eL, eR }
    put(top, Bw, Bd, `translateY(${surf}px) rotateX(90deg)`)
    put(dust, Bw * 1.1, Bh, `translateZ(${Bd / 2 + 36}px)`)
    // a veil of night mist round the block's foot, in front and behind
    put(veil, Bw * 2.4, Bh * 0.26, `translate3d(0, ${Bh * 0.6}px, ${Bd / 2 + 70}px)`)
    world.style.left = `${f1(W * (wide ? 0.3 : 0.31))}px`
    world.style.top = `${f1(H * (wide ? 0.6 : 0.565))}px`
    // the marks on the cut edge: surface, the middle of each band, the bed
    const fy0 = G.floor + Bh / 2
    ;[0, ...K.stages.map((_, i) => G.band * (i + 0.5)), fy0].forEach((y, k) => Object.assign(marks[k].style, { left: `${Bw}px`, top: `${f1(y)}px` }))
    job?.cancel()
    job = sliced(paint(), { sync: ctx.reduced })
    move(false)
    cancelAnimationFrame(colRaf)
    colRaf = requestAnimationFrame(placeCol)
  }
  /** the record column level with the block: read the marks' boxes once (after the block is placed), then write */
  let colRaf = 0
  ctx.onCleanup(() => cancelAnimationFrame(colRaf))
  function placeCol() {
    const a = root.getBoundingClientRect()
    const ys = marks.map((m) => m.getBoundingClientRect()).map((r) => r.top - a.top)
    const xr = Math.max(...marks.map((m) => m.getBoundingClientRect().left - a.left))
    const { W, wide } = G
    const x0 = Math.max(xr + (wide ? 70 : 14), W * (wide ? 0.56 : 0.6))
    Object.assign(col.style, { left: `${f1(x0)}px`, width: `${f1(W - x0 - (wide ? 40 : 10))}px` })
    Object.assign(rule.style, { top: `${f1(ys[0])}px`, height: `${f1(ys[4] - ys[0])}px` })
    notches.forEach((el, i) => (el.style.top = `${f1(ys[i + 1] - ys[0])}px`))
    reads.forEach((el, i) => (el.style.top = `${f1(ys[i + 1])}px`))
    // the sentence and what the marks mean head the column (on a phone, across the top, clear of the moon)
    Object.assign(head.style, wide ? { left: `${f1(x0)}px`, right: '40px', top: '', bottom: `${f1(a.height - ys[0] + 14)}px` } : { left: '14px', right: '64px', top: '6px', bottom: '' })
  }

  function* paint() {
    const { W, H, Bw, Bh, floor, band, wide } = G
    const r = rng(2203)
    const fy = floor + Bh / 2 // the bed, in face coordinates (0 = surface)
    // ── the night behind: the moon high, a far range low in the mist
    sky.setAttribute('viewBox', `0 0 ${W} ${H}`)
    sky.replaceChildren(
      mist(W * 0.5, H * 0.86, W * 0.7, H * 0.18),
      moon(W * (wide ? 0.86 : 0.88), H * (wide ? 0.1 : 0.06), Math.min(W, H) * (wide ? 0.028 : 0.04), 7, true),
      hills(-W * 0.05, W * 1.05, H * 0.98, H * 0.16, 2231, 0.95, 4),
      mist(W * 0.5, H * 0.99, W * 0.8, H * 0.08))
    yield
    // ── the cut face: water in translucent silk bands over a sediment of sand with the scroll half-buried in it,
    // moonbeams thinning as they sink, 96 growth rings along the cut edge, the glass's bevelled edges
    const id = `g8y2-${Bw}`
    const P = (pts: Pt[]) => pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')
    const wave = (y: number, amp: number, ph: number): Pt[] => Array.from({ length: 17 }, (_, k) => [(Bw * k) / 16, y + Math.sin(k * 0.7 + ph) * amp + Math.sin(k * 1.9 + ph * 2) * amp * 0.4] as Pt)
    const bands = K.stages.map((_, i) => {
      const y0 = band * i, y1 = band * (i + 1)
      const t0 = wave(y0 + (i ? 0 : 2), i ? band * 0.035 : 1, i * 2.1), t1 = wave(y1, band * 0.035, i * 2.1 + 2.1)
      // soft sheens folded through the silk (wide and faint, then a thread of light on the fold)
      let fold = '', thread = ''
      for (let k = 0; k < 3; k++) {
        const y = y0 + band * (0.25 + k * 0.25) + (r() - 0.5) * 10
        const x0 = Bw * (0.04 + r() * 0.3), x1 = x0 + Bw * (0.35 + r() * 0.35)
        const c = curve([x0, y], [(x0 + x1) / 2, y - band * (0.04 + r() * 0.05)], [x1, y + 3], 16)
        fold += stroke(c, 10 + r() * 10, 0.3, 0.3, 0.05)
        thread += stroke(c.map(([x, yy]) => [x, yy - 2] as Pt), 1.1 + r() * 0.8, 0.3, 0.3, 0.05)
      }
      return s('g', { class: `g8y2-band b${i}` },
        s('path', { class: `g8y2-silk s${i}`, d: `M${P(t0)}L${P([...t1].reverse())}Z`, fill: `url(#${id}-b${i})` }),
        s('path', { class: 'g8y2-lit', d: `M${P(t0)}L${P([...t1].reverse())}Z` }),
        s('path', { class: 'g8y2-fold', d: fold }),
        s('path', { class: 'g8y2-thread', d: thread }),
        i ? s('path', { class: 'g8y2-seamline', d: stroke(t0, 1.4, 0.05, 0.05, 0.3) }) : null)
    })
    // moonlight falling in: tapered, fading with depth, soft-sided (blurred once at high), dust caught in them
    const shafts: SVGElement[] = []
    let motes = ''
    ;[0.18, 0.34, 0.5, 0.63, 0.78].forEach((t, i) => {
      const a = Bw * t, w0 = 8 + (i % 2) * 8, dx = Bw * (0.22 + i * 0.03), len = fy * (0.5 + (i % 3) * 0.14), w1 = w0 * 3.2
      shafts.push(s('path', { d: `M${f1(a)} 0L${f1(a + w0)} 0L${f1(a + w0 - dx + w1)} ${f1(len)}L${f1(a - dx)} ${f1(len)}Z`, fill: `url(#${id}-shaft)` }))
      for (let k = 0; k < 9; k++) {
        const u = r() * 0.9, x = a - dx * u + (w0 + (w1 - w0) * u) * r(), y = len * u
        motes += `M${f1(x)} ${f1(y)}h0.01`
      }
    })
    // 96 growth rings on the cut edge, in three bands; each band lights as the pebble passes it
    const rings = K.stages.map((_, i) => {
      let d = '', late = ''
      for (let k = (TICKS / N) * i; k < (TICKS / N) * (i + 1); k++) {
        const y = (fy * (k + (r() - 0.5) * 0.5)) / TICKS
        const len = k % 32 === 0 ? 30 : k % 8 === 0 ? 17 : 7 + r() * 6
        const bow = len * 0.28
        const c = curve([Bw - 2, y - bow * 0.3], [Bw - 2 - len * 0.6, y + bow], [Bw - 2 - len, y - bow * 0.1], 6)
        if (k % 4 === 0) late += stroke(c, 1.8, 0.1, 0.4, 0.3)
        else d += stroke(c, 0.9, 0.1, 0.4, 0.3)
      }
      return s('g', { class: `g8y2-rings b${i}` }, s('path', { class: 'g8y2-ring', d }), s('path', { class: 'g8y2-ring late', d: late }))
    })
    // the sand bed, and the essay's scroll lying half-buried in it: its roll and its sheet lifting a little, lines of writing
    const sx = Bw * 0.52, sw = Bw * 0.5, rh = Math.max(9, Bw * 0.04), sy = fy + rh * 0.35
    const sheet = `M${f1(sx + sw * 0.3)} ${f1(sy - rh * 1.4)}Q${f1(sx + sw * 0.62)} ${f1(sy - rh * 3.4)} ${f1(sx + sw * 0.95)} ${f1(sy - rh * 1.2)}L${f1(sx + sw * 0.94)} ${f1(sy + rh)}L${f1(sx + sw * 0.32)} ${f1(sy + rh)}Z`
    let lines = ''
    for (let k = 0; k < 7; k++) {
      const x = sx + sw * (0.4 + k * 0.075)
      lines += stroke([[x, sy - rh * (2.3 - Math.abs(k - 3) * 0.22)], [x + 0.6, sy - rh * 0.1]], 1.4, 0.2, 0.2, 0.3)
    }
    let grains = '', strata = ''
    for (let k = 0; k < 60; k++) grains += `M${f1(r() * Bw)} ${f1(fy + r() * (Bh - fy))}h0.01`
    for (let k = 0; k < 6; k++) {
      const y = fy + rh * 1.2 + ((Bh - fy - rh) * (k + 0.5)) / 6
      strata += stroke(Array.from({ length: 9 }, (_, j) => [(Bw * j) / 8, y + (r() - 0.5) * 3] as Pt), 1 + r() * 1.5, 0.1, 0.1, 0.2)
    }
    const sand = `M0 ${f1(fy - 2)}Q${f1(Bw * 0.2)} ${f1(fy - 7)} ${f1(Bw * 0.34)} ${f1(fy + 1)}Q${f1(Bw * 0.5)} ${f1(fy + rh * 0.9)} ${f1(Bw * 0.7)} ${f1(fy + rh * 0.4)}Q${f1(Bw * 0.88)} ${f1(fy - 4)} ${f1(Bw)} ${f1(fy - 2)}L${f1(Bw)} ${Bh}L0 ${Bh}Z`
    frontArt.setAttribute('viewBox', `0 0 ${Bw} ${Bh}`)
    frontArt.replaceChildren(
      s('defs', null,
        s('linearGradient', { id: `${id}-w`, x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, class: 'g8y2-w0' }), s('stop', { offset: 0.55, class: 'g8y2-w1' }), s('stop', { offset: 1, class: 'g8y2-w2' })),
        ...[0, 1, 2].map((i) => s('linearGradient', { id: `${id}-b${i}`, x1: 0, y1: 0, x2: 0.2, y2: 1 }, s('stop', { offset: 0, class: `g8y2-bt${i}` }), s('stop', { offset: 1, class: `g8y2-bb${i}` }))),
        s('linearGradient', { id: `${id}-shaft`, x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, class: 'g8y2-s0' }), s('stop', { offset: 1, class: 'g8y2-s1' })),
        s('linearGradient', { id: `${id}-spec`, x1: 0, y1: 0, x2: 1, y2: 0.35 }, s('stop', { offset: 0.2, class: 'g8y2-sp0' }), s('stop', { offset: 0.42, class: 'g8y2-sp1' }), s('stop', { offset: 0.62, class: 'g8y2-sp0' })),
        low ? null : s('filter', { id: `${id}-soft`, x: '-30%', y: '-10%', width: '160%', height: '120%' }, s('feGaussianBlur', { stdDeviation: 6 }))),
      s('rect', { class: 'g8y2-water', width: Bw, height: f1(fy), fill: `url(#${id}-w)` }),
      ...bands,
      s('g', { class: 'g8y2-shafts', filter: low ? null : `url(#${id}-soft)` }, ...shafts),
      ...(low ? [] : [s('path', { class: 'g8y2-mote lit', d: motes })]),
      s('g', { class: 'g8y2-scroll' },
        s('path', { class: 'g8y2-sheet', d: sheet }),
        s('path', { class: 'g8y2-lines', d: lines }),
        s('rect', { class: 'g8y2-roll', x: f1(sx - sw / 2), y: f1(sy - rh), width: f1(sw * 0.86), height: f1(rh * 2), rx: f1(rh) }),
        s('path', { class: 'g8y2-roll-hi', d: stroke([[sx - sw * 0.45, sy - rh * 0.55], [sx + sw * 0.3, sy - rh * 0.6]], rh * 0.35, 0.2, 0.3, 0.2) }),
        s('ellipse', { class: 'g8y2-cap', cx: f1(sx - sw / 2 + 2), cy: f1(sy), rx: f1(rh * 0.5), ry: f1(rh * 1.05) })),
      // the sand covers the scroll's lower half
      s('path', { class: 'g8y2-earth', d: sand }),
      // the cut's own earth: ragged soil walls holding the water either side, roots and stones in them, a crust of moss
      ...[0, 1].map((side) => {
        const pts: Pt[] = []
        for (let y = 0; y <= fy + 6; y += 9) pts.push([Bw * (0.035 + 0.025 * Math.sin(y * 0.045 + side * 3)) + r() * Bw * 0.02, y])
        const X = (x: number) => (side ? Bw - x : x)
        const d = `M${f1(X(0))} 0${pts.map(([x, y]) => `L${f1(X(x))} ${f1(y)}`).join('')}L${f1(X(0))} ${f1(fy + 6)}Z`
        let rootD = ''
        for (let k = 0; k < 5; k++) {
          const y0 = r() * fy * 0.8, x0 = X(Bw * 0.03)
          rootD += stroke(curve([x0, y0], [X(Bw * (0.06 + r() * 0.05)), y0 + 14 + r() * 20], [X(Bw * (0.04 + r() * 0.1)), y0 + 30 + r() * 40], 10), 0.9 + r() * 1.2, 0.05, 0.7, 0.1)
        }
        return s('g', { class: 'g8y2-cut' },
          s('path', { class: 'g8y2-soil', d }),
          s('path', { class: 'g8y2-soilink', d: stroke(pts.map(([x, y]) => [X(x), y] as Pt), 1.6, 0.05, 0.1, 0.4), filter: 'url(#ink-rough)' }),
          s('path', { class: 'g8y2-roots', d: rootD }),
          ...[0.22, 0.5, 0.78].map((f, k) => s('g', { transform: `translate(${f1(X(Bw * 0.02))} ${f1(fy * f)})` }, stoneArt(Bw * (0.04 + k * 0.008), Bw * 0.028, 2270 + side * 7 + k))))
      }),
      s('path', { class: 'g8y2-strata', d: strata, filter: 'url(#ink-dry)' }),
      s('path', { class: 'g8y2-grain', d: grains }),
      ...rings,
      // the glass: a faint specular sheet across it, bevels catching the moon along its top and cut edge, a dark lip below
      s('rect', { class: 'g8y2-spec', width: Bw, height: f1(fy), fill: `url(#${id}-spec)` }),
      s('path', { class: 'g8y2-bevel', d: stroke([[1, 1.5], [Bw * 0.5, 1], [Bw - 1, 1.5]], 3, 0.02, 0.06, 0.5) + stroke([[Bw - 1.5, 2], [Bw - 1.8, fy * 0.5], [Bw - 1.5, fy + 4]], 2.4, 0.04, 0.6, 0.5) }),
      s('path', { class: 'g8y2-bevel in', d: stroke([[6, 6], [Bw * 0.5, 5.5], [Bw - 6, 6]], 1.2, 0.1, 0.1, 0.4) + stroke([[Bw - 6, 7], [Bw - 6.5, fy * 0.6]], 1, 0.1, 0.3, 0.3) + stroke([[1.5, 3], [1.5, fy + 4]], 1.4, 0.1, 0.6, 0.4) }),
      // grass along the top of the soil walls, where the cut meets the ground
      s('path', { class: 'g8y2-wallmoss', d: [0, 1].map((side) => Array.from({ length: 9 }, (_, k) => {
        const x = side ? Bw - 2 - k * Bw * 0.009 : 2 + k * Bw * 0.009, hh = 5 + r() * 9
        return stroke([[x, 1], [x + (r() - 0.5) * 5, -hh]], 1.6 + r(), 0.05, 0.7, 0.2)
      }).join('')).join('') }))
    yield
    // ── rock walls: thick beds of three tones darkening toward the foot, pebbles set in them, moss along the top,
    // roots hanging from it (back and inner left seen through the glass, the outer right cut face lit by the moon)
    const wall = (w: number, seed: number, cls: string) => {
      const q = rng(seed)
      const kids: SVGElement[] = []
      const P2 = (pts: Pt[]) => pts.map(([x, yy]) => `${f1(x)} ${f1(yy)}`).join('L')
      let y = 0, k = 0, seams = '', hatch = ''
      let prev: Pt[] = Array.from({ length: 13 }, (_, j) => [(w * j) / 12, -2] as Pt)
      while (y < Bh) {
        const hh = 18 + q() * 56
        y += hh
        const ph = q() * 6
        const next: Pt[] = Array.from({ length: 13 }, (_, j) => [(w * j) / 12, y + Math.sin(j * 0.8 + ph) * hh * 0.18 + (q() - 0.5) * 6] as Pt)
        kids.push(s('path', { class: `g8y2-layer t${k % 3}`, d: `M${P2(prev)}L${P2([...next].reverse())}Z` }))
        if (q() > 0.2) seams += stroke(next.slice(Math.floor(q() * 4), 9 + Math.floor(q() * 4)), 1 + q() * 2.4, 0.15, 0.25, 0.15)
        // the grain of each bed: short dry strokes along it
        for (let j = 0; j < 4 + hh / 12; j++) {
          const x0 = q() * w, y0 = y - hh * q()
          hatch += stroke([[x0, y0], [x0 + 6 + q() * 16, y0 + (q() - 0.5) * 2]], 0.8 + q(), 0.2, 0.4, 0.2)
        }
        prev = next
        k++
      }
      kids.push(s('path', { class: 'g8y2-hatch', d: hatch }))
      kids.push(s('path', { class: 'g8y2-seam', d: seams, filter: 'url(#ink-rough)' }))
      for (let j = 0; j < 7; j++) kids.push(s('g', { transform: `translate(${f1(q() * w)} ${f1(Bh * (0.2 + q() * 0.75))})` }, stoneArt(18 + q() * 34, 10 + q() * 20, seed + j)))
      // deeper is darker
      kids.push(s('rect', { class: 'g8y2-dusk', width: f1(w), height: f1(Bh), fill: `url(#g8y2-dusk-${seed})` }))
      let roots = '', moss = ''
      for (let j = 0; j < 11; j++) {
        const x = w * (0.04 + q() * 0.92), len = Bh * (0.08 + q() * 0.22)
        roots += stroke(curve([x, -2], [x + (q() - 0.5) * 50, len * 0.5], [x + (q() - 0.5) * 40, len], 16), 1 + q() * 3, 0.05, 0.75, 0.08)
      }
      for (let j = 0; j < w / 5; j++) {
        const x = (j * 5 + q() * 4), hh = 5 + q() * 12
        moss += stroke([[x, -1], [x + (q() - 0.5) * 3, hh]], 2.4 + q() * 2, 0.05, 0.7, 0.2)
      }
      kids.push(s('path', { class: 'g8y2-roots', d: roots, filter: 'url(#ink-rough)' }), s('path', { class: 'g8y2-wallmoss', d: moss }))
      return s('svg', { class: `g8y2-wall ${cls}`, viewBox: `0 0 ${w} ${Bh}`, 'aria-hidden': 'true' },
        s('defs', null, s('linearGradient', { id: `g8y2-dusk-${seed}`, x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, class: 'g8y2-d0' }), s('stop', { offset: 1, class: 'g8y2-d1' }))),
        ...kids)
    }
    back.replaceChildren(wall(Bw, 2241, ''))
    yield
    inner.replaceChildren(wall(G.Bd, 2242, ''))
    earthL.replaceChildren(wall(G2.eL, 2243, 'out'))
    earthR.replaceChildren(wall(G2.eR, 2244, 'out'))
    // the ground on either side: moss and grass, a few pebbles, its cut edge lit by the moon, grass leaning over it
    const ground = (w: number, seed: number) => {
      const q = rng(seed)
      const d = G.Bd
      let tuft = '', lip = ''
      for (let k = 0; k < w / 6; k++) {
        const x = q() * w, y = d * (0.1 + q() * 0.9), hh = 3 + q() * 6 * (y / d)
        tuft += stroke([[x, y], [x + (q() - 0.5) * 4, y - hh]], 1 + q(), 0.05, 0.7, 0.2)
      }
      for (let x = 2; x < w; x += 4 + q() * 4) lip += stroke([[x, d - 1], [x + (q() - 0.5) * 4, d - 6 - q() * 8]], 1.4 + q(), 0.05, 0.7, 0.2)
      return s('svg', { viewBox: `0 0 ${w} ${d}`, 'aria-hidden': 'true' },
        s('rect', { class: 'g8y2-turf', width: w, height: d }),
        s('path', { class: 'g8y2-padhi', d: tuft }),
        ...Array.from({ length: 5 }, (_, k) => s('g', { transform: `translate(${f1(w * (0.1 + q() * 0.8))} ${f1(d * (0.3 + q() * 0.6))})` }, stoneArt(10 + q() * 16, 5 + q() * 7, seed + k))),
        s('path', { class: 'g8y2-edge', d: stroke([[0, d - 1.5], [w, d - 1.5]], 2.4, 0.02, 0.02, 0.6) }),
        s('path', { class: 'g8y2-wallmoss', d: lip }))
    }
    groundL.replaceChildren(ground(G2.eL, 2245))
    groundR.replaceChildren(ground(G2.eR, 2246))
    yield
    // ── the surface seen from above: moss rim, still water, lily pads, the moon's disc in it, rings where the pebble went in
    const { Bd } = G
    let pads = '', padHi = '', veins = '', road = '', rip = ''
    // lily pads: round leaves with their notch, veins from the notch, a lit lip; a cluster by the bank, a few strays
    const spots: [number, number, number][] = [[0.2, 0.4, 1], [0.27, 0.52, 0.8], [0.15, 0.62, 0.7], [0.36, 0.36, 0.6], [0.48, 0.78, 0.75], [0.84, 0.66, 0.55], [0.58, 0.3, 0.5]]
    spots.forEach(([fx, fy2, k], j) => {
      const x = Bw * fx, y = Bd * fy2, rr = Bw * 0.055 * k + 5, a = r() * Math.PI * 2
      const n0 = a + 0.22, n1 = a - 0.22 + Math.PI * 2
      const pt = (q: number, m = 1): Pt => [x + Math.cos(q) * rr * m, y + Math.sin(q) * rr * m]
      const [x0, y0] = pt(n0), [x1, y1] = pt(n1)
      pads += `M${f1(x)} ${f1(y)}L${f1(x0)} ${f1(y0)}A${f1(rr)} ${f1(rr)} 0 1 1 ${f1(x1)} ${f1(y1)}Z`
      for (let v = 1; v < 6; v++) veins += stroke([[x, y], pt(n0 + ((n1 - n0) * v) / 6, 0.86)], 0.7, 0.1, 0.4, 0.3)
      padHi += stroke(Array.from({ length: 7 }, (_, q) => pt(Math.PI * (1.05 + q * 0.07), 0.97)), Math.max(1, rr * 0.08), 0.3, 0.3, 0.2)
      if (j === 0) padHi += `M${f1(x + rr * 0.9)} ${f1(y - rr * 0.6)}a${f1(rr * 0.22)} ${f1(rr * 0.3)} 0 1 0 0.1 0Z` // a closed bud by the first leaf
    })
    // the moon's road on the water: dry dashes from its disc toward the near edge, longer as they come
    for (let k = 0; k < 9; k++) {
      const y = Bd * (0.56 + k * 0.05), len = Bw * (0.03 + k * 0.012) * (0.7 + r() * 0.6), x = Bw * 0.64 - len / 2 + (r() - 0.5) * Bw * 0.04
      road += stroke([[x, y], [x + len, y + (r() - 0.5)]], 1 + k * 0.25, 0.3, 0.3, 0.1)
    }
    for (let k = 0; k < 26; k++) {
      const y = Bd * (0.2 + r() * 0.78), len = Bw * (0.03 + r() * 0.08), x = r() * (Bw - len)
      rip += stroke([[x, y], [x + len, y + (r() - 0.5)]], 1 + (y / Bd) * 1.4, 0.3, 0.3, 0.1)
    }
    const bankPts: Pt[] = [[0, Bd * 0.9], [Bw * 0.05, Bd * 0.5], [Bw * 0.12, Bd * 0.22], [Bw * 0.4, Bd * 0.14], [Bw * 0.7, Bd * 0.18], [Bw, Bd * 0.12]]
    const bankLine = curve(bankPts[0], bankPts[1], bankPts[2], 8).concat(curve(bankPts[2], bankPts[3], bankPts[4], 10), curve(bankPts[4], [Bw * 0.85, Bd * 0.16], bankPts[5], 6))
    top.replaceChildren(s('svg', { viewBox: `0 0 ${Bw} ${Bd}`, 'aria-hidden': 'true' },
      s('rect', { class: 'g8y2-pond', width: Bw, height: Bd }),
      s('ellipse', { class: 'g8y2-moonhalo', cx: f1(Bw * 0.64), cy: f1(Bd * 0.5), rx: f1(Bw * 0.16), ry: f1(Bd * 0.22) }),
      s('ellipse', { class: 'g8y2-moondisc', cx: f1(Bw * 0.64), cy: f1(Bd * 0.5), rx: f1(Bw * 0.045), ry: f1(Bw * 0.045 * 0.8) }),
      s('path', { class: 'g8y2-rip', d: rip }),
      s('path', { class: 'g8y2-road', d: road }),
      s('path', { class: 'g8y2-rim', d: `M0 0L${f1(Bw)} 0L${bankLine.slice().reverse().map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}Z` }),
      s('path', { class: 'g8y2-bankink', d: stroke(bankLine, 2.2, 0.05, 0.05, 0.3), filter: 'url(#ink-rough)' }),
      s('path', { class: 'g8y2-pad', d: pads }),
      s('path', { class: 'g8y2-vein', d: veins }),
      s('path', { class: 'g8y2-padhi', d: padHi }),
      s('path', { class: 'g8y2-edge', d: stroke([[0, Bd - 1.5], [Bw, Bd - 1.5]], 2.6, 0.02, 0.02, 0.6) + stroke([[Bw - 1.5, 0], [Bw - 1.5, Bd]], 2, 0.02, 0.02, 0.6) }),
      s('g', { class: 'g8y2-rings' }, ...[1, 2, 3].map((k) => s('ellipse', { cx: f1(Bw * 0.34), cy: f1(Bd * 0.62), rx: f1(14 + k * 16), ry: f1(9 + k * 10) })))))
    // ── what floats in the water in front of the glass (high only): motes catching the moon
    if (!low) {
      let d = ''
      for (let k = 0; k < 60; k++) d += `M${f1(r() * Bw * 1.1)} ${f1(r() * fy)}h0.01`
      dust.replaceChildren(s('svg', { viewBox: `0 0 ${f1(Bw * 1.1)} ${Bh}`, 'aria-hidden': 'true' }, s('path', { class: 'g8y2-mote', d })))
    }
    // ── the pebble: a flat river stone; the word in four coats of ink, each band adds one; focused, wet ink blooms in it
    const coats = [0, 1, 2, 3].map((k) => s('text', { class: `g8y2-coat c${k}`, y: 12, 'text-anchor': 'middle', filter: k ? 'url(#ink-wash)' : null }, K.word))
    ink.replaceChildren(
      s('defs', null, s('radialGradient', { id: 'g8y2-bloom' }, s('stop', { offset: 0, class: 'g8y2-bl0' }), s('stop', { offset: 0.55, class: 'g8y2-bl1' }), s('stop', { offset: 1, class: 'g8y2-bl2' }))),
      s('ellipse', { class: 'g8y2-pshadow', cx: 4, cy: 26, rx: 46, ry: 7 }),
      s('path', { class: 'g8y2-stone', d: blob(0, 0, 50, 27, 9, 0.07) }),
      s('path', { class: 'g8y2-bloom', d: blob(-2, 2, 40, 21, 13, 0.18), fill: 'url(#g8y2-bloom)' }),
      s('path', { class: 'g8y2-flank', d: 'M10 -26A50 27 0 0 1 10 26A36 27 0 0 0 10 -26Z' }),
      s('path', { class: 'g8y2-prim', d: stroke([[-40, -12], [-10, -25], [28, -20]], 2.4, 0.3, 0.4, 0.2) }),
      ...coats)
  }

  // ── the pebble's way down: surface, the middle of each band, then the bed beside the scroll
  const py = (t: number) => {
    const { surf, floor, band } = G
    const stops = [surf - 10, ...K.stages.map((_, i) => surf + band * (i + 0.5)).slice(0, N - 1), floor - 22]
    const i = Math.min(N - 1, Math.floor(t)), f = t - i
    return stops[i] + (stops[i + 1] - stops[i]) * f
  }
  /** The block holds still (whole in frame, so it never shrinks); the pebble sinks through the bands, drifting a little. */
  function move(animate: boolean) {
    const { H, Bw, Bd, wide } = G
    if (!H) return
    const y = py(v)
    const x = -Bw * (wide ? 0.2 : 0.08) + Math.sin(v * 2.1) * Bw * 0.04
    const ry = wide ? 26 : 20
    world.classList.toggle('glide', animate && !ctx.reduced)
    world.style.transform = `rotateX(-13deg) rotateY(${-ry}deg)`
    // (in front of the glass by its own half-width, so its turned face never dips behind it)
    pebble.style.transform = `translate3d(${f1(x)}px,${f1(y)}px,${f1(Bd / 2 + 42)}px) rotateY(${ry}deg) rotateX(13deg) rotate(${f1(v * 5 - 4)}deg)`
    const n = Math.round(v)
    root.dataset.at = String(n)
    reads.forEach((el, i) => el.classList.toggle('on', i < n))
    notches.forEach((el, i) => (el.classList.toggle('on', i < n), el.classList.toggle('next', i === n)))
  }

  function set(t: number, animate: boolean) {
    const was = Math.round(v)
    v = Math.max(0, Math.min(N, t))
    move(animate)
    const n = Math.round(v)
    if (n !== was) {
      ctx.chime(n ? 'tap' : 'soft')
      if (!done && n > 0 && n < N) ctx.prompt(K.steps[n - 1])
      pebble.setAttribute('aria-valuenow', String(n))
      pebble.setAttribute('aria-valuetext', fill(K.valueText, { n, total: N }))
    }
    if (n === N && !done && animate) {
      done = true
      dot.done()
      root.classList.add('done')
      ctx.insight(K.insight, [K.detail, K.layers96, K.stagesNote])
    }
  }

  pebble.addEventListener('keydown', (e) => {
    const k = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key]
    const to = k ? Math.round(v) + k : e.key === 'Home' ? 0 : e.key === 'End' ? N : NaN
    if (Number.isNaN(to)) return
    e.preventDefault()
    set(to, true)
  })
  // drag anywhere on the block (the pebble is small): down = deeper; let go and it settles on the nearest band
  let drag: { id: number; y: number; v: number } | null = null
  root.addEventListener('pointerdown', (e) => {
    if (e.button) return
    drag = { id: e.pointerId, y: e.clientY, v }
    root.setPointerCapture(e.pointerId)
    pebble.focus({ preventScroll: true })
  })
  root.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return
    set(drag.v + (e.clientY - drag.y) / Math.max(60, G.H * 0.22), false)
  })
  const end = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return
    const moved = Math.abs(e.clientY - drag.y) > 6
    drag = null
    // a tap drops the pebble one band
    set(moved ? Math.round(v) : Math.round(v) + 1, true)
  }
  root.addEventListener('pointerup', end)
  root.addEventListener('pointercancel', end)

  ctx.onCleanup(onSize(ctx.art, layout))
}
