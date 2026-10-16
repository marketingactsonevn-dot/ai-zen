import { fill, h, s } from '../../core/dom'
import { L } from '../../core/content'
import type { SceneCtx } from '../types'
import { C } from './data'
import { f1, stage } from './kit'
import { blob, clamp, curve, onDigit, rng, seedOf, shuffledIdx, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist, moon, reeds, wash } from '../../ui/part2/paint'
import { grad, P, Z } from './brush'

const K = C.scenes.diary
const D = K.perspectives

/**
 * Scene 5 — the camera just above the water of a small pond: a thin wide ellipse, an open diary of dó paper afloat in the
 * middle with its pages mirrored below, three standing stones (two big and near on the bank, one small across the water).
 * Drag the moon along its arc over a stone (or press the stone, or 1–3): that stone lights and throws a long soft shadow
 * toward you, its words are laid on a strip of paper at the water's edge under it, and the moonlight turns the diary to
 * another page. In the water every page shows the vermilion seal of the hint it was given; only one page writes it down.
 * When all three have spoken the pond stills and what they share becomes the insight.
 */
export function diaryScene(ctx: SceneCtx) {
  const n = D.stones.length
  const order = shuffledIdx(n, seedOf(D.stones.map((x) => x.who).join('|'))) // stone k holds view order[k]
  const heard = new Set<number>()
  let sel = -1
  const { root } = stage(ctx, 't24d', K.art, [D.common], draw)
  const art = s('svg', { class: 't24-svg t24d-art', 'aria-hidden': 'true' })
  const shadowG = s('g', { class: 't24d-shadows' })
  const trail = s('path', { class: 't24d-trail' })
  const book = s('g', { class: 't24d-book' })
  const moonEl = h('div', { class: 't24d-moon', 'aria-hidden': 'true' }, s('svg', { viewBox: '-40 -40 80 80' }, moon(0, 0, 17, 2551, false)))
  const q = h('p', { class: 't24d-q' }, K.question)
  const stones = order.map((_, k) => h('button', { class: `t24d-stone k${k}`, type: 'button', 'aria-pressed': 'false', 'aria-label': fill(L.stoneN, { n: k + 1 }), onClick: () => pick(k) }))
  const words = h('div', { class: 't24d-words' })
  const group = h('div', { class: 't24d-stones', role: 'group', 'aria-label': L.perspectives }, ...stones)
  root.append(art, moonEl, q, group, words)
  ctx.prompt(K.prompt)
  ctx.onCleanup(onDigit((d) => pick(d - 1)))

  const G = { W: 0, H: 0, Hp: 0, wide: true, cx: 0, cy: 0, rx: 0, ry: 0, hz: 0, bx: 0, by: 0, pw: 0, ph: 0, arc: [] as Pt[], feet: [] as { x: number; y: number; h: number }[] }

  function* draw(W: number, H: number) {
    const wide = W / H >= 1.05
    const Hp = wide ? H : H * 0.65 // on a phone the painting takes the top, the words go under it
    const hz = Hp * (wide ? 0.47 : 0.46)
    const cx = W * 0.5, cy = Hp * (wide ? 0.61 : 0.62), rx = W * (wide ? 0.42 : 0.47), ry = Hp * (wide ? 0.09 : 0.085)
    // the stones: two big ones near us on the bank (left, right), a small one across the water
    const feet = [
      { x: W * (wide ? 0.14 : 0.14), y: Hp * (wide ? 0.9 : 0.96), h: Hp * (wide ? 0.34 : 0.32) },
      { x: W * (wide ? 0.6 : 0.62), y: hz + Hp * 0.035, h: Hp * 0.12 },
      { x: W * (wide ? 0.86 : 0.87), y: Hp * (wide ? 0.88 : 0.94), h: Hp * (wide ? 0.3 : 0.29) },
    ]
    Object.assign(G, { W, H, Hp, wide, cx, cy, rx, ry, hz, feet, bx: W * (wide ? 0.43 : 0.42), by: cy - ry * 0.55, pw: W * (wide ? 0.075 : 0.12), ph: Hp * (wide ? 0.13 : 0.13) })
    // the moon's way: an arc over the three stones, highest over the far one
    const tops = feet.map((f, k) => [f.x, f.y - f.h - Hp * (k === 1 ? 0.2 : 0.16)] as Pt)
    G.arc = curve(tops[0], [cx, Math.min(tops[1][1], Hp * 0.14) - Hp * 0.12], tops[2], 40)
    art.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    trail.setAttribute('d', P(G.arc))
    q.classList.toggle('flat', !wide)
    yield
    paint()
    yield
    drawBook()
    // the stones' buttons sit over their pictures
    stones.forEach((b, k) => {
      const f = feet[k], w = f.h * 0.95
      Object.assign(b.style, { left: `${f1(f.x - w / 2)}px`, top: `${f1(f.y - f.h)}px`, width: `${f1(w)}px`, height: `${f1(f.h)}px` })
    })
    words.classList.toggle('flat', !wide)
    if (!wide) Object.assign(words.style, { left: '12px', right: '12px', top: `${f1(Hp + 6)}px`, width: '' })
    light(sel)
  }

  /** Sky, far ranges and bank, the thin pond with its glints, the near bank, the stones; their shadows go in shadowG. */
  function paint() {
    const { W, Hp, cx, cy, rx, ry, hz, feet } = G
    const r = rng(2552)
    let rip = ''
    for (let k = 0; k < 9; k++) {
      const yy = cy - ry * 0.75 + k * ry * 0.19
      const half = rx * Math.sqrt(Math.max(0, 1 - Math.pow((yy - cy) / ry, 2))) * 0.94
      for (let j = 0; j < 3; j++) {
        const x0 = cx - half + r() * half * 1.4, len = rx * (0.08 + r() * 0.2) * (0.6 + k * 0.08)
        rip += stroke([[x0, yy], [Math.min(cx + half, x0 + len), yy + (r() - 0.5) * 0.6]], 0.7 + k * 0.12, 0.3, 0.3, 0.1)
      }
    }
    const water = blob(cx, cy, rx, ry, 2553, 0.03, 36)
    const nearBank = `M${f1(-W * 0.05)} ${f1(cy + ry * 0.5)}Q${f1(cx - rx * 0.7)} ${f1(cy + ry * 1.4)} ${f1(cx)} ${f1(cy + ry * 1.25)}Q${f1(cx + rx * 0.75)} ${f1(cy + ry * 1.15)} ${f1(W * 1.05)} ${f1(cy + ry * 0.35)}L${f1(W * 1.05)} ${f1(Hp * 1.05)}L${f1(-W * 0.05)} ${f1(Hp * 1.05)}Z`
    // the bank: moss washes and tufts of grass, denser toward us
    let tufts = ''
    for (let i = 0; i < 8; i++) tufts += blob(r() * W, cy + ry * 2 + r() * (Hp - cy - ry * 2), W * (0.06 + r() * 0.1), 4 + r() * 6, 2560 + i, 0.35, 14)
    const blades: SVGElement[] = []
    for (let i = 0; i < 14; i++) {
      const y = cy + ry * 1.5 + Math.pow(r(), 0.7) * (Hp - cy - ry * 1.5)
      blades.push(grass(r() * W, y, Hp * (0.02 + ((y - cy) / Hp) * 0.08), 2580 + i))
    }
    const stoneEls = feet.map((f, k) => {
      const w = f.h * (k === 1 ? 0.62 : 0.78)
      return s('g', { class: `t24d-stoneart k${k}`, transform: `translate(${f1(f.x)} ${f1(f.y)})` },
        s('ellipse', { class: 't24d-stone-glow', cx: 0, cy: f1(-f.h * 0.5), rx: f1(w * 1.1), ry: f1(f.h * 0.8), fill: 'url(#p2-halo)' }),
        stoneArt(w, f.h, 2550 + k * 7),
        s('path', { class: 't24d-stone-rim', d: stroke(curve([-w * 0.42, -f.h * 0.62], [-w * 0.1, -f.h * 1.04], [w * 0.3, -f.h * 0.88], 10), Math.max(1.6, w * 0.035), 0.3, 0.3, 0.15) }))
    })
    art.replaceChildren(
      s('defs', null,
        grad('t24d-water', 'linear', { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, 't24d-w0'], [0.5, 't24d-w1'], [1, 't24d-w2']]),
        s('linearGradient', { id: 't24d-shg', x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, class: 't24d-sh0' }), s('stop', { offset: 1, class: 't24d-sh1' })),
        s('clipPath', { id: 't24d-pond' }, s('path', { d: water }))),
      mist(cx, hz - Hp * 0.12, W * 0.7, Hp * 0.22),
      trail,
      hills(-W * 0.05, W * 1.05, hz, Hp * 0.17, 2554, 0.85, W > Hp ? 5 : 3),
      hills(W * 0.42, W * 1.05, hz + 1, Hp * 0.09, 2555, 0.45, 2),
      mist(cx, hz - Hp * 0.01, W * 0.6, Hp * 0.045),
      // the far bank: a dark low strip of grass and reeds the far stone stands on
      wash(`M${f1(-W * 0.05)} ${f1(hz + Hp * 0.01)}Q${f1(cx)} ${f1(hz - Hp * 0.012)} ${f1(W * 1.05)} ${f1(hz + Hp * 0.008)}L${f1(W * 1.05)} ${f1(cy)}L${f1(-W * 0.05)} ${f1(cy)}Z`, 0.5, 'p2p-wash t24d-farbank'),
      reeds(feet[1].x + Hp * 0.1, hz + Hp * 0.04, Hp * 0.07, 2559, 6),
      reeds(cx - rx * 0.62, hz + Hp * 0.045, Hp * 0.06, 2558, 5),
      s('path', { class: 't24d-water', d: water, fill: 'url(#t24d-water)' }),
      s('g', { 'clip-path': 'url(#t24d-pond)' },
        s('g', { class: 't24d-road' }, s('ellipse', { class: 't24d-road-glow', cx: 0, cy: f1(cy), rx: f1(rx * 0.12), ry: f1(ry * 1.4), fill: 'url(#p2-road)' }),
          s('path', { class: 't24d-road-ink', d: [0.12, 0.3, 0.5, 0.68, 0.84].map((t) => `M${f1(-rx * (0.02 + t * 0.05))} ${f1(cy - ry + t * ry * 2)}h${f1(rx * (0.04 + t * 0.1))}`).join('') })),
        s('path', { class: 't24d-rip', d: rip }),
        s('g', { class: 't24d-reflect' })),
      s('path', { class: 't24d-rim', d: stroke(curve([cx - rx, cy + 1], [cx, cy - ry * 2.05], [cx + rx, cy + 1], 30), 1.6, 0.1, 0.1, 0.3) }),
      s('path', { class: 't24d-near', d: nearBank, filter: 'url(#ink-wash)' }),
      s('path', { class: 't24d-tuft', d: tufts, filter: 'url(#ink-wash)' }),
      ...blades,
      s('path', { class: 't24d-wet', d: stroke(curve([cx - rx * 0.98, cy + ry * 0.3], [cx, cy + ry * 1.12], [cx + rx * 0.98, cy + ry * 0.3], 30), 2.2, 0.1, 0.1, 0.3) }),
      grass(cx - rx * 0.3, cy + ry * 1.4, Hp * 0.05, 2561),
      grass(cx + rx * 0.35, cy + ry * 1.35, Hp * 0.045, 2562),
      reeds(feet[0].x + Hp * 0.12, feet[0].y - Hp * 0.04, Hp * 0.16, 2563, 7),
      shadowG,
      book,
      ...stoneEls)
  }

  /**
   * The diary afloat: two pages standing open from the spine, their writing; below the water line the same pages upside
   * down, broken by ripples, with the vermilion seal of the hint on every one of them.
   */
  function drawBook() {
    const { bx, by, pw, ph } = G
    const page = (d: number): Pt[] => [[bx, by], ...curve([bx + d * pw * 0.1, by + ph * 0.035], [bx + d * pw * 0.6, by + ph * 0.09], [bx + d * pw, by - ph * 0.03], 8).slice(1), [bx + d * pw * 0.97, by - ph], ...curve([bx + d * pw * 0.97, by - ph], [bx + d * pw * 0.55, by - ph * 0.9], [bx, by - ph * 0.86], 8).slice(1)]
    const Lp = page(-1), Rp = page(1)
    const r = rng(2564)
    const lines = (v: number) => {
      let d = ''
      for (const side of [-1, 1]) for (let k = 0; k < 7; k++) {
        const t = (k + 1) / 8.5
        const yy = by - ph * 0.82 * (1 - t) - ph * 0.06
        const x0 = bx + side * pw * 0.14, x1 = bx + side * pw * (0.86 - r() * 0.22)
        if (v === 1 && side === 1 && (k === 3 || k === 4)) continue // left blank exactly where it matters
        d += stroke([[x0, yy], [(x0 + x1) / 2, yy + (r() - 0.5)], [x1, yy]], v === 0 ? 2 : 1.4, 0.2, 0.3, 0.3)
      }
      return d
    }
    // the seal: a vermilion square with a pale mark cut in it (read on the page, or mirrored in the water)
    const seal = (x: number, y: number, z: number, flip: number) => [
      s('rect', { class: 't24d-seal', x: f1(x - z / 2), y: f1(y - z / 2), width: f1(z), height: f1(z), rx: f1(z * 0.12) }),
      s('path', { class: 't24d-seal-cut', d: stroke([[x - z * 0.25, y - flip * z * 0.22], [x + z * 0.22, y - flip * z * 0.2]], z * 0.12, 0.1, 0.1, 0.5) + stroke([[x - z * 0.02, y - flip * z * 0.3], [x + z * 0.03, y + flip * z * 0.28]], z * 0.12, 0.1, 0.2, 0.5) + stroke([[x - z * 0.24, y + flip * z * 0.05], [x - z * 0.12, y + flip * z * 0.25]], z * 0.1, 0.1, 0.2, 0.5) }),
    ]
    const z = Math.max(12, pw * 0.2)
    const pages = [0, 1, 2].map((v) => s('g', { class: `t24d-page p${v}` },
      s('path', { class: 't24d-ink', d: lines(v) }),
      ...(v === 2 ? seal(bx + pw * 0.6, by - ph * 0.2, z * 0.8, 1) : [])))
    // in the water: the open book upside down and flattened, every page with its seal
    const mirror = `translate(0 ${f1(by * 2 + 2)}) scale(1 -1) translate(0 0)`
    const under = [0, 1, 2].map((v) => s('g', { class: `t24d-under p${v}` },
      s('g', { transform: mirror },
        s('path', { class: 't24d-mirror-paper', d: Z(Lp) + Z(Rp) }),
        s('path', { class: 't24d-mirror-ink', d: lines(v) })),
      ...seal(bx + pw * (v === 1 ? 0.5 : 0.56), by + ph * (0.36 + v * 0.06), z, -1)))
    let cuts = ''
    for (let k = 0; k < 6; k++) {
      const yy = by + ph * (0.12 + k * 0.13)
      cuts += stroke([[bx - pw * 1.1, yy], [bx + pw * 1.1, yy + (r() - 0.5)]], 1.4 + k * 0.3, 0.2, 0.2, 0.3)
    }
    art.querySelector('.t24d-reflect')?.replaceChildren(
      s('ellipse', { class: 't24d-under-glow', cx: f1(bx), cy: f1(by + ph * 0.45), rx: f1(pw * 1.3), ry: f1(ph * 0.6), fill: 'url(#p2-road)' }),
      ...under,
      s('path', { class: 't24d-cuts', d: cuts }))
    book.replaceChildren(
      s('ellipse', { class: 't24d-bookshadow', cx: f1(bx), cy: f1(by + 2), rx: f1(pw * 1.15), ry: f1(Math.max(2, ph * 0.06)) }),
      s('path', { class: 't24d-paper base', d: Z(Lp) + Z(Rp) }),
      s('path', { class: 't24d-cup', d: Z([[bx, by], [bx - pw * 0.24, by + ph * 0.01], [bx - pw * 0.22, by - ph * 0.88], [bx, by - ph * 0.86]]) }),
      ...pages,
      // the page that turns over when the moon moves to another stone
      s('g', { class: 't24d-turn' }, s('path', { class: 't24d-paper turn', d: Z(Rp) })),
      s('path', { class: 't24d-edge', d: stroke([...Lp, Lp[0]], 1.2, 0.05, 0.05, 0.4) + stroke([...Rp, Rp[0]], 1.2, 0.05, 0.05, 0.4) + stroke([[bx, by + 1], [bx, by - ph * 0.87]], 1.6, 0.1, 0.1, 0.4) }))
    ;(book.querySelector('.t24d-turn') as SVGGElement).style.transformOrigin = `${f1(bx)}px ${f1(by)}px`
  }

  /** The moon over stone k (−1: between them, nobody heard yet): the page, the shadows, the words follow. */
  function light(k: number) {
    if (!G.arc.length) return
    moveMoon(k < 0 ? 0.5 : k / 2)
    art.dataset.page = String(k)
    art.querySelectorAll('.t24d-stoneart').forEach((e, j) => {
      e.classList.toggle('on', j === k)
      e.classList.toggle('heard', heard.has(j))
    })
    if (k >= 0) say(k)
  }

  /** Long soft shadows from each stone's foot toward us, swung away from the moon (strongest under the lit stone). */
  function shadows(mx: number) {
    const { feet, Hp } = G
    shadowG.replaceChildren(...feet.map((f, k) => {
      const len = k === 1 ? Hp * 0.3 : Hp * 0.22, w = f.h * (k === 1 ? 0.3 : 0.36)
      const sk = (f.x - mx) * (k === 1 ? 0.35 : 0.25)
      const d = `M${f1(f.x - w)} ${f1(f.y)}L${f1(f.x + w)} ${f1(f.y)}L${f1(f.x + w * 1.7 + sk)} ${f1(f.y + len)}L${f1(f.x - w * 1.3 + sk)} ${f1(f.y + len)}Z`
      return s('path', { class: `t24d-shadow${k === sel ? ' on' : ''}`, d, fill: 'url(#t24d-shg)', filter: 'url(#ink-wash)' })
    }))
  }

  function moveMoon(t: number) {
    const i = Math.round(clamp(t, 0, 1) * (G.arc.length - 1))
    const [x, y] = G.arc[i]
    moonEl.style.transform = `translate(${f1(x)}px, ${f1(y)}px)`
    const road = art.querySelector<SVGGElement>('.t24d-road') // pointer-move rate, not a frame loop
    if (road) road.style.transform = `translateX(${f1(x)}px)`
    shadows(x)
  }

  /** What stone k says: on a strip of paper laid at the water's edge under it (on a phone: plain words under the picture). */
  function say(k: number) {
    const st = D.stones[order[k]]
    const first = !words.hasAttribute('aria-live')
    words.replaceChildren(h('p', { class: 't24d-who' }, st.who), ctx.fact(st.view, 'p', 't24d-view'))
    if (first) words.setAttribute('aria-live', 'polite') // after the first fill: not read out on entering the scene
    words.classList.add('shown')
    if (G.wide) {
      // laid at the water's edge on the lit stone's side (the near stones stand right at the frame's corners)
      const f = G.feet[k], w = Math.min(460, G.W * 0.34)
      const x = k === 0 ? G.W * 0.24 : k === 2 ? G.W * 0.76 - w : clamp(f.x - w / 2, G.W * 0.24, G.W * 0.76 - w)
      Object.assign(words.style, { width: `${f1(w)}px`, left: `${f1(x)}px`, top: `${f1(G.cy + G.ry * 1.25)}px` })
      words.style.setProperty('--tilt', `${k === 0 ? -1.2 : k === 2 ? 1 : -0.4}deg`)
    }
  }

  function pick(k: number) {
    if (k < 0 || k >= n) return
    const turn = sel !== k && sel >= 0
    if (sel >= 0) stones[sel].setAttribute('aria-pressed', 'false')
    sel = k
    heard.add(k)
    stones[k].setAttribute('aria-pressed', 'true')
    stones[k].setAttribute('aria-label', fill(L.stoneHeard, { n: k + 1, who: D.stones[order[k]].who }))
    root.classList.add(`is-heard-${k}`)
    light(k)
    // the moonlight turns the diary's page
    if (turn && !ctx.reduced) (book.querySelector('.t24d-turn') as SVGGElement).animate([{ transform: 'scaleX(1)', opacity: 1 }, { transform: 'scaleX(-1)', opacity: 1, offset: 0.85 }, { transform: 'scaleX(-1)', opacity: 0 }], { duration: 700, easing: 'cubic-bezier(.4,0,.2,1)' })
    if (heard.size === n && !root.classList.contains('is-all')) {
      root.classList.add('is-all')
      ctx.insight(D.common, [K.insight, K.detail])
      ctx.chime('ok')
    } else ctx.chime('soft')
  }

  // drag the moon along its arc; let go and it settles over the nearest stone (which is then heard)
  let id = -1
  let rect: DOMRect | null = null
  const nearest = (x: number, y: number) => {
    let best = 0, bd = Infinity
    G.arc.forEach(([ax, ay], i) => {
      const d = (ax - x) ** 2 + (ay - y) ** 2
      if (d < bd) (bd = d), (best = i)
    })
    return best / (G.arc.length - 1)
  }
  const low = ctx.quality === 'low'
  moonEl.addEventListener('pointerdown', (e) => {
    id = e.pointerId
    rect = root.getBoundingClientRect()
    moonEl.setPointerCapture(id)
    moonEl.classList.add('held')
    root.classList.add('dragging')
  })
  moonEl.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id || !rect) return
    const t = nearest(e.clientX - rect.left, e.clientY - rect.top)
    moveMoon(low ? Math.round(t * 2) / 2 : t)
  })
  const up = (e: PointerEvent) => {
    if (e.pointerId !== id || !rect) return
    id = -1
    moonEl.classList.remove('held')
    root.classList.remove('dragging')
    pick(Math.round(nearest(e.clientX - rect.left, e.clientY - rect.top) * 2))
  }
  moonEl.addEventListener('pointerup', up)
  moonEl.addEventListener('pointercancel', up)
}
