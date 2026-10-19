import { fill, h, s } from '../../core/dom'
import type { SceneCtx } from '../types'
import { C } from './data'
import { f1, stage } from './kit'
import { blob, curve, rng, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist, moon, reeds, wash } from '../../ui/part2/paint'
import { guide, type Counter, type Mark } from '../../ui/part2/guide'
import { grad, Z } from './brush'

const K = C.scenes.diary
const N = K.pages.length

/**
 * Scene 5 (audit v3 24-5: an experiment, not a carousel) — the camera just above a small pond: a thin wide ellipse, a big
 * open diary of dó paper afloat in the middle with its pages mirrored below, the answer stele on the right bank.
 * Beat 1: slip the vermilion pebble (a hint passed to the AI on the sly) into the water under the diary: the answer on
 * the stele turns to the hinted one, and the seal shows in the diary's reflection. Beat 2: turn the diary's four pages,
 * four tries: the water shows the seal under every one, but only one page writes the hint down → the insight.
 */
export function diaryScene(ctx: SceneCtx) {
  let hinted = false
  let page = -1
  const { root } = stage(ctx, 't24d', K.art, [K.insight], draw)
  const art = s('svg', { class: 't24-svg t24d-art', 'aria-hidden': 'true' })
  const book = s('g', { class: 't24d-book' })
  const q = h('div', { class: 't24d-q flat' }, h('p', null, K.question), h('p', { class: 't24d-decode' }, K.decode))
  const pebble = h('button', { class: 't24d-pebble', type: 'button', 'aria-label': K.pebbleAria },
    s('svg', { viewBox: '-22 -16 44 32', 'aria-hidden': 'true' }, s('ellipse', { class: 'sh', cx: 2, cy: 8, rx: 17, ry: 5 }), s('path', { class: 'body', d: 'M-16 2C-17 -7 -6 -12 3 -11C13 -10 18 -3 16 4C14 10 4 12 -4 11C-11 10 -15 8 -16 2Z' }), s('path', { class: 'hi', d: 'M-9 -5C-5 -9 2 -9 6 -8' })))
  const text = h('p', { class: 't24d-text', 'aria-live': 'off' })
  const flip = h('button', { class: 't24d-flip', type: 'button', 'aria-label': K.flipAria, disabled: true })
  const ans = h('p', { class: 't24d-ans' }, K.answer.before)
  const stele = h('div', { class: 't24d-stele' }, h('p', { class: 't24d-ans-l' }, K.answer.label), ans)
  const data = h('div', { class: 't24d-data', 'data-off': '' }, ctx.fact(K.data, 'p'))
  root.append(art, q, stele, text, flip, pebble, data)
  ctx.prompt(K.prompt)
  const g = guide(ctx)
  let dot: Mark | null = g.dot(pebble, { dir: [1, -0.4] })
  let count: Counter | null = null
  // the water under the diary, where the pebble goes (H3)
  const bed = (): Pt => [G.bx, G.by + G.ph * 0.14]
  const target = g.drop(bed, { w: 120, h: 46 })

  const G = { W: 0, H: 0, Hp: 0, wide: true, cx: 0, cy: 0, rx: 0, ry: 0, hz: 0, bx: 0, by: 0, pw: 0, ph: 0, mx: 0, home: [0, 0] as Pt, feet: [] as { x: number; y: number; h: number }[] }

  function* draw(W: number, H: number) {
    const wide = W / H >= 1.05
    const Hp = wide ? H : H * 0.84 // on a phone the data line goes under the painting
    const hz = Hp * (wide ? 0.4 : 0.36)
    const cx = W * 0.5, cy = Hp * (wide ? 0.6 : 0.58), rx = W * (wide ? 0.42 : 0.47), ry = Hp * (wide ? 0.15 : 0.13)
    // the answer stele on the right bank; the diary big in the middle of the water, its reflection right under it
    const feet = [{ x: W * (wide ? 0.85 : 0.84), y: Hp * (wide ? 0.9 : 0.96), h: Hp * (wide ? 0.4 : 0.3) }]
    Object.assign(G, { W, H, Hp, wide, cx, cy, rx, ry, hz, feet, bx: W * (wide ? 0.47 : 0.45), by: cy - ry * 0.25, pw: W * (wide ? 0.15 : 0.3), ph: Hp * (wide ? 0.3 : 0.24), mx: W * 0.62, home: [W * (wide ? 0.16 : 0.14), Hp * (wide ? 0.86 : 0.88)] })
    art.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    yield
    paint()
    yield
    drawBook()
    place()
  }

  /** the HTML over the painting: the page's words, the page corner, the stele's face, the pebble (on the bank or in the water) */
  function place() {
    const { W, Hp, wide, bx, by, pw, ph, feet } = G
    const f = feet[0], sw = f.h * 0.7
    const fs = Math.max(12, Math.min(17, pw * 0.085))
    Object.assign(text.style, { left: `${f1(bx + pw * 0.12)}px`, top: `${f1(by - ph * 0.86)}px`, width: `${f1(pw * 0.76)}px`, fontSize: `${f1(fs)}px` })
    Object.assign(flip.style, { left: `${f1(bx + pw * 0.92 - 30)}px`, top: `${f1(by - ph * 0.2 - 30)}px` })
    Object.assign(stele.style, { left: `${f1(f.x - sw * 0.39)}px`, top: `${f1(f.y - f.h * 0.72)}px`, width: `${f1(sw * 0.78)}px` })
    const at = hinted ? bed() : G.home
    Object.assign(pebble.style, { left: `${f1(at[0])}px`, top: `${f1(at[1])}px`, translate: '' })
    if (wide) Object.assign(data.style, { left: '', right: '14px', top: '10px', width: `${f1(Math.min(380, W * 0.3))}px` })
    else Object.assign(data.style, { left: '12px', right: '12px', top: `${f1(Hp + 4)}px`, width: '' })
    q.classList.toggle('wide', wide)
    g.refresh()
  }

  /** Sky and moon, far ranges and bank, the thin pond with its glints, the near bank, the answer stele. */
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
    // the answer stele on the right bank (its words are HTML over its face)
    const f = feet[0], w = f.h * 0.7
    const steleEl = s('g', { class: 't24d-stoneart on', transform: `translate(${f1(f.x)} ${f1(f.y)})` },
      s('ellipse', { class: 't24d-stone-glow', cx: 0, cy: f1(-f.h * 0.5), rx: f1(w * 1.1), ry: f1(f.h * 0.8), fill: 'url(#p2-halo)' }),
      stoneArt(w, f.h, 2564),
      s('path', { class: 't24d-stone-rim', d: stroke(curve([-w * 0.42, -f.h * 0.62], [-w * 0.1, -f.h * 1.04], [w * 0.3, -f.h * 0.88], 10), Math.max(1.6, w * 0.035), 0.3, 0.3, 0.15) }))
    art.replaceChildren(
      s('defs', null,
        grad('t24d-water', 'linear', { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, 't24d-w0'], [0.5, 't24d-w1'], [1, 't24d-w2']]),
        s('linearGradient', { id: 't24d-shg', x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, class: 't24d-sh0' }), s('stop', { offset: 1, class: 't24d-sh1' })),
        s('clipPath', { id: 't24d-pond' }, s('path', { d: water }))),
      mist(cx, hz - Hp * 0.12, W * 0.7, Hp * 0.22),
      moon(G.mx, Hp * 0.13, Math.min(22, Hp * 0.04), 2551, false),
      hills(-W * 0.05, W * 1.05, hz, Hp * 0.17, 2554, 0.85, W > Hp ? 5 : 3),
      hills(W * 0.42, W * 1.05, hz + 1, Hp * 0.09, 2555, 0.45, 2),
      mist(cx, hz - Hp * 0.01, W * 0.6, Hp * 0.045),
      // the far bank: a dark low strip of grass and reeds the far stone stands on
      wash(`M${f1(-W * 0.05)} ${f1(hz + Hp * 0.01)}Q${f1(cx)} ${f1(hz - Hp * 0.012)} ${f1(W * 1.05)} ${f1(hz + Hp * 0.008)}L${f1(W * 1.05)} ${f1(cy)}L${f1(-W * 0.05)} ${f1(cy)}Z`, 0.5, 'p2p-wash t24d-farbank'),
      reeds(W * 0.7, hz + Hp * 0.04, Hp * 0.07, 2559, 6),
      reeds(cx - rx * 0.62, hz + Hp * 0.045, Hp * 0.06, 2558, 5),
      s('path', { class: 't24d-water', d: water, fill: 'url(#t24d-water)' }),
      s('g', { 'clip-path': 'url(#t24d-pond)' },
        s('g', { class: 't24d-road', transform: `translate(${f1(G.mx)} 0)` }, s('ellipse', { class: 't24d-road-glow', cx: 0, cy: f1(cy), rx: f1(rx * 0.12), ry: f1(ry * 1.4), fill: 'url(#p2-road)' }),
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
      reeds(W * 0.08, Hp * 0.92, Hp * 0.16, 2563, 7),
      book,
      steleEl)
  }

  /**
   * The diary afloat, big: two pages standing open from the spine (the left one written, the right one carries the page's
   * words in HTML); below the water line the same pages upside down, broken by ripples, and — once the hint is in — the
   * vermilion seal of the hint under every page.
   */
  function drawBook() {
    const { bx, by, pw, ph } = G
    const leaf = (d: number): Pt[] => [[bx, by], ...curve([bx + d * pw * 0.1, by + ph * 0.035], [bx + d * pw * 0.6, by + ph * 0.09], [bx + d * pw, by - ph * 0.03], 8).slice(1), [bx + d * pw * 0.97, by - ph], ...curve([bx + d * pw * 0.97, by - ph], [bx + d * pw * 0.55, by - ph * 0.9], [bx, by - ph * 0.86], 8).slice(1)]
    const Lp = leaf(-1), Rp = leaf(1)
    const r = rng(2564)
    const lines = (v: number) => {
      let d = ''
      for (let k = 0; k < 7; k++) {
        const t = (k + 1) / 8.5
        const yy = by - ph * 0.82 * (1 - t) - ph * 0.06
        const x0 = bx - pw * 0.14, x1 = bx - pw * (0.86 - r() * 0.22)
        if (v === 1 && (k === 3 || k === 4)) continue
        d += stroke([[x0, yy], [(x0 + x1) / 2, yy + (r() - 0.5)], [x1, yy]], v === 0 ? 2 : 1.4, 0.2, 0.3, 0.3)
      }
      return d
    }
    // the seal: a vermilion square with a pale mark cut in it, mirrored in the water
    const seal = (x: number, y: number, z: number, flip: number) => [
      s('rect', { class: 't24d-seal', x: f1(x - z / 2), y: f1(y - z / 2), width: f1(z), height: f1(z), rx: f1(z * 0.12) }),
      s('path', { class: 't24d-seal-cut', d: stroke([[x - z * 0.25, y - flip * z * 0.22], [x + z * 0.22, y - flip * z * 0.2]], z * 0.12, 0.1, 0.1, 0.5) + stroke([[x - z * 0.02, y - flip * z * 0.3], [x + z * 0.03, y + flip * z * 0.28]], z * 0.12, 0.1, 0.2, 0.5) + stroke([[x - z * 0.24, y + flip * z * 0.05], [x - z * 0.12, y + flip * z * 0.25]], z * 0.1, 0.1, 0.2, 0.5) }),
    ]
    const z = Math.max(14, pw * 0.16)
    const pages = [...Array(N).keys()].map((v) => s('g', { class: `t24d-page p${v}` }, s('path', { class: 't24d-ink', d: lines(v % 3) })))
    // in the water: the open book upside down and flattened, and under it the seal of the hint (every page)
    const mirror = `translate(0 ${f1(by * 2 + 2)}) scale(1 -1)`
    const under = [...Array(N).keys()].map((v) => s('g', { class: `t24d-under p${v}` },
      s('g', { transform: mirror },
        s('path', { class: 't24d-mirror-paper', d: Z(Lp) + Z(Rp) }),
        s('path', { class: 't24d-mirror-ink', d: lines(v % 3) })),
      s('g', { class: 't24d-hintseal' }, ...seal(bx + pw * (0.4 + (v % 2) * 0.12), by + ph * (0.3 + (v % 3) * 0.04), z, -1))))
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
      // the page that turns over
      s('g', { class: 't24d-turn' }, s('path', { class: 't24d-paper turn', d: Z(Rp) })),
      s('path', { class: 't24d-edge', d: stroke([...Lp, Lp[0]], 1.2, 0.05, 0.05, 0.4) + stroke([...Rp, Rp[0]], 1.2, 0.05, 0.05, 0.4) + stroke([[bx, by + 1], [bx, by - ph * 0.87]], 1.6, 0.1, 0.1, 0.4) }))
    ;(book.querySelector('.t24d-turn') as SVGGElement).style.transformOrigin = `${f1(bx)}px ${f1(by)}px`
    art.dataset.page = String(Math.max(0, page))
  }

  // ── beat 1: the pebble goes into the water under the diary (drag it there; a tap or Enter drops it in too)
  function hint() {
    if (hinted) return
    hinted = true
    pebble.disabled = true
    pebble.classList.add('placed')
    root.classList.add('is-hinted')
    target.hit()
    dot?.done()
    ans.textContent = K.answer.after
    if (!ctx.reduced) stele.animate([{ opacity: 0.2, filter: 'blur(2px)' }, { opacity: 1, filter: 'none' }], { duration: 900, easing: 'ease-out' })
    ctx.chime('soft')
    place()
    // beat 2: the pages, one try each
    flip.disabled = false
    count = g.count(K.pageCount, N, () => [G.bx, G.by - G.ph - 20], { n: 0 })
    turn()
    ctx.prompt(K.flip)
    dot = g.dot(flip, { dir: [-1, 0] })
    flip.focus({ preventScroll: true })
  }
  let id = -1, x0 = 0, y0 = 0, moved = 0
  pebble.addEventListener('pointerdown', (e) => {
    if (hinted) return
    id = e.pointerId
    x0 = e.clientX
    y0 = e.clientY
    moved = 0
    pebble.setPointerCapture(id)
    pebble.classList.add('held')
    target.lift(true)
  })
  pebble.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return
    const dx = e.clientX - x0, dy = e.clientY - y0
    moved = Math.max(moved, Math.hypot(dx, dy))
    pebble.style.translate = `${f1(dx)}px ${f1(dy)}px`
  })
  const up = (e: PointerEvent) => {
    if (e.pointerId !== id) return
    id = -1
    pebble.classList.remove('held')
    target.lift(false)
    const dx = e.clientX - x0, dy = e.clientY - y0
    const [tx, ty] = bed()
    if (moved < 8 || Math.hypot(G.home[0] + dx - tx, G.home[1] + dy - ty) < Math.max(70, G.pw * 0.5)) return hint()
    pebble.style.translate = ''
    g.wrong(K.pebbleWrong, pebble)
  }
  pebble.addEventListener('pointerup', up)
  pebble.addEventListener('pointercancel', up)
  pebble.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), hint()))

  // ── beat 2: turn the pages (the corner, the page itself, or a swipe across the book)
  function turn() {
    if (page >= N - 1) return
    page++
    const k = page
    art.dataset.page = String(k)
    text.textContent = K.pages[k]
    count?.set(k + 1)
    if (k > 0) {
      ctx.chime('tap')
      if (!ctx.reduced) (book.querySelector('.t24d-turn') as SVGGElement).animate([{ transform: 'scaleX(1)', opacity: 1 }, { transform: 'scaleX(-1)', opacity: 1, offset: 0.85 }, { transform: 'scaleX(-1)', opacity: 0 }], { duration: 700, easing: 'cubic-bezier(.4,0,.2,1)' })
    }
    if (k === N - 1) {
      flip.disabled = true
      dot?.done()
      count?.done()
      delete data.dataset.off
      root.classList.add('is-all')
      ctx.insight(K.insight, K.detail)
      ctx.chime('ok')
    } else if (k > 0) ctx.prompt(fill(K.flipNext, { n: k + 2 }))
  }
  flip.addEventListener('click', turn)
  text.addEventListener('click', () => hinted && turn())
  let sx = NaN
  root.addEventListener('pointerdown', (e) => void (sx = hinted ? e.clientX : NaN))
  root.addEventListener('pointerup', (e) => {
    if (!Number.isNaN(sx) && Math.abs(e.clientX - sx) > 50 && e.target !== pebble) turn()
    sx = NaN
  })
}
