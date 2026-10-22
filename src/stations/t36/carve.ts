import './carve.css'
import { fill, h, s } from '../../core/dom'
import { L } from '../../core/content'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import { cssVar, onPrefs } from '../../core/prefs'
import { clamp, onSize, rng, type Pt } from '../../ui/part2/ink'
import { codeScroll } from '../../ui/part2/code'
import { findTakeaway, takeaway } from '../../ui/part2/takeaway'
import { guide, type Mark } from '../../ui/part2/guide'
import type { CodeScroll, Takeaway } from '../../ui/part2/types'
import type { SceneCtx } from '../types'
import { C } from './content'
import { F, f1, gdefs, zonedHeight } from './kit'

const K = C.scenes.carve
const FEAT = K.features
const N = FEAT.length
/** the feature that breaks the game (dry leaves): the block cracks, checkpoint BUG (the one before it) heals it */
const BUG = 3
const TAU = Math.PI * 2
type G = CanvasRenderingContext2D
interface Pal { paper: string; paper2: string; card: string; wash: string; umbra: string; ink: string; moon: string; mist: string; water: string; rockLo: string; rockMid: string; rockHi: string; stepLo: string; stepMid: string; stepHi: string; lantern: string; moss: string; dark: boolean }
const readPal = (): Pal => ({
  paper: cssVar('--paper'), paper2: cssVar('--paper-2'), card: cssVar('--card'), wash: cssVar('--wash'), umbra: cssVar('--umbra'), ink: cssVar('--ink'), moon: cssVar('--moon'),
  mist: cssVar('--mist'), water: cssVar('--water'), rockLo: cssVar('--rock-lo'), rockMid: cssVar('--rock-mid'), rockHi: cssVar('--rock-hi'), stepLo: cssVar('--step-lo'), stepMid: cssVar('--step-mid'),
  stepHi: cssVar('--step-hi'), lantern: cssVar('--lantern'), moss: cssVar('--moss-b'), dark: document.documentElement.dataset.theme === 'dark',
})
const hex = (c: string) => (c.startsWith('#') && c.length >= 7 ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) : [128, 128, 128])
/** a CSS colour with alpha (tokens are #rrggbb) */
function rgba(c: string, a: number) {
  const [r, g, b] = hex(c)
  return `rgba(${r},${g},${b},${a})`
}
function mix(a: string, b: string, k: number) {
  const A = hex(a), B = hex(b)
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join('')}`
}
/** hinoki in this theme: pale, warm, three tones (the step stones' greys warmed by the lamp's colour) */
const woodOf = (P: Pal) => ({
  hi: mix(P.stepHi, P.lantern, P.dark ? 0.42 : 0.3),
  mid: mix(P.stepMid, P.lantern, P.dark ? 0.4 : 0.34),
  lo: mix(P.stepLo, P.lantern, P.dark ? 0.22 : 0.28),
})

// ── the carving, stage by stage (u along the block −0.5…0.5, head left; v across −1…1, back up) ──
type UV = [number, number]
type Seg = UV | [UV, UV]
const FISH: Seg[] = [[-0.47, 0.06], [[-0.32, -1.04], [0.02, -0.82]], [[0.24, -0.6], [0.33, -0.15]], [0.5, -0.9], [[0.42, 0], [0.5, 0.9]], [0.33, 0.16], [[0.22, 0.64], [0, 0.8]], [[-0.3, 0.98], [-0.47, 0.06]]]
const BLUNT: Seg[] = [[-0.47, 0.06], [[-0.3, -1.05], [0.02, -0.82]], [[0.24, -0.62], [0.36, -0.3]], [0.47, -0.36], [0.47, 0.38], [0.36, 0.3], [[0.22, 0.66], [0, 0.8]], [[-0.3, 0.98], [-0.47, 0.06]]]
const CUT: UV[] = [[-0.5, -0.22], [-0.42, -0.82], [-0.1, -0.99], [0.24, -0.84], [0.36, -0.42], [0.5, -0.66], [0.5, 0.66], [0.36, 0.42], [0.22, 0.86], [-0.1, 0.99], [-0.42, 0.8], [-0.5, 0.24]]
/** fins (n ≥ 5): dorsal, pectoral, pelvic, anal — each [root a, tip, root b] */
const FINS: [UV, UV, UV][] = [[[-0.12, -0.9], [0.08, -1.3], [0.27, -0.6]], [[-0.25, 0.5], [-0.12, 1.08], [-0.1, 0.62]], [[0.04, 0.76], [0.14, 1.08], [0.15, 0.72]], [[0.24, 0.5], [0.33, 0.78], [0.33, 0.3]]]

/** one geometry for the whole room, from the scene's size */
interface Geo {
  W: number; H: number; A: number; wide: boolean
  back: number; front: number; edge: number
  door: [number, number, number, number]
  blk: { x: number; y: number; w: number; h: number }
  foot: number
  rail: [number, number, number]
  lampX: number
  board: [number, number, number, number]
  scroll: [number, number, number]
  sheet: [number, number, number, number]
  /** the mallet lying on the bench: centre x, y, length */
  mallet: [number, number, number]
  /** the checkpoint tray along the front edge: x0, x1, top, foot */
  tray: [number, number, number, number]
  hollows: Pt[]
}
function geom(W: number, H: number, A: number): Geo {
  const wide = W / H > 1.1
  const hollowsOf = (t: [number, number, number, number]) => {
    const [x0, x1, y0, y1] = t, th = y1 - y0
    return Array.from({ length: N }, (_, k) => [x0 + ((x1 - x0) * (k + 0.5)) / N + (k - 2.5) * 1.5, y0 + th * 0.27] as Pt)
  }
  if (wide) {
    const back = H * 0.5, front = H * 0.86
    const bw = clamp(W * 0.3, 240, 440)
    const tray: [number, number, number, number] = [W * 0.2, W * 0.62, front - H * 0.095, front - H * 0.014]
    return {
      W, H, A, wide, back, front, edge: Math.min(A, front + H * 0.075),
      door: [W * 0.5, H * 0.03, W * 0.42, back - H * 0.03],
      blk: { x: W * 0.705, y: H * 0.27, w: bw, h: bw * 0.36 }, foot: back + H * 0.05,
      rail: [W * 0.12, W * 0.48, H * 0.022], lampX: W * 0.36,
      board: [W * 0.03, back - H * 0.36, clamp(W * 0.18, 170, 260), H * 0.36],
      scroll: [W * 0.045, back + H * 0.045, clamp(W * 0.12, 110, 170)],
      sheet: [W * 0.02, H * 0.03, Math.min(W * 0.44, 540), front - H * 0.05],
      mallet: [W * 0.4, back + (front - back) * 0.38, clamp(W * 0.17, 170, 250)],
      tray, hollows: hollowsOf(tray),
    }
  }
  const back = H * 0.47, front = H * 0.9
  const bw = W * 0.6
  const tray: [number, number, number, number] = [W * 0.04, W * 0.96, front - H * 0.085, front - H * 0.012]
  return {
    W, H, A, wide, back, front, edge: Math.min(A, H * 0.955),
    door: [W * 0.4, H * 0.02, W * 0.58, back - H * 0.02],
    blk: { x: W * 0.665, y: H * 0.235, w: bw, h: bw * 0.36 }, foot: back + H * 0.035,
    rail: [W * 0.04, W * 0.36, 3], lampX: W * 0.2,
    board: [W * 0.025, back - H * 0.31, W * 0.33, H * 0.31],
    scroll: [W * 0.05, back + H * 0.045, W * 0.28],
    sheet: [0, back - H * 0.02, W, H - back + H * 0.02],
    mallet: [W * 0.56, back + (front - back) * 0.42, W * 0.42],
    tray, hollows: hollowsOf(tray),
  }
}

/**
 * Scene 3 — the wood shop at night, eye level with the bench (audit 36-3: "a carving round with checkpoints"): a block of
 * hinoki on its carving horse stands in the open door, the moonlit lake behind it drawing a bright rim round each stage
 * of the carving; chalk on the wood marks the next cut. The work lamp hangs from the beam and lays warm light on the
 * near face, the board and the mallet. Each blow of the mallet adds one feature: chips fly and fall round the horse's
 * feet, the block becomes one stage more of a fish, and a pebble — a checkpoint, a saved version — drops into the tray
 * along the bench's front edge. The fourth feature (dry leaves) cracks the block: strike on and the crack spreads; touch
 * checkpoint 3 and the wood is whole again, ready for the feature to be asked again with evidence. The prompt of each cut
 * is chalked on a wooden board leaning on the wall. The code lies rolled up and tied on the bench: it unrolls into a
 * sheet with the sample prompts and the take-away cards.
 */
export function carveScene(ctx: SceneCtx) {
  gdefs()
  if (!document.getElementById('t36c-defs')) {
    const st = (o: number, c: string) => s('stop', { offset: o, style: `stop-color:var(${c})` })
    document.getElementById('p2-defs')!.append(s('defs', { id: 't36c-defs' }, s('linearGradient', { id: 't36c-stone', x1: 0.2, y1: 0, x2: 0.5, y2: 1 }, st(0, '--step-hi'), st(0.55, '--step-mid'), st(1, '--step-lo'))))
  }
  const stableH = zonedHeight(ctx, [F(K.insight)])
  const low = ctx.quality === 'low'
  let P = readPal()
  let saved = 0 // checkpoints in the tray
  let crack = 0 // 0 whole · 1 cracked · 2 the crack spread
  let fixed = false // went back once: the feature is asked again with evidence
  let over = false
  const stageOf = () => saved + 1 + (crack ? 1 : 0)
  let geo: Geo | null = null
  const geoOf = (W: number, H: number) => (geo && geo.W === W && geo.H === H ? geo : (geo = geom(W, H, ctx.art.clientHeight)))

  // ── layers: the painted shop, the lamp's light (wall glow, cone, pool), the carving, chips; objects on top
  const shop = h('canvas', { class: 't36c-shop', 'aria-hidden': 'true' })
  const wallGlow = h('i', { class: 't36c-wglow', 'aria-hidden': 'true' })
  const cone = h('i', { class: 't36c-cone', 'aria-hidden': 'true' })
  const pool = h('i', { class: 't36c-pool', 'aria-hidden': 'true' })
  const cvA = h('canvas', { class: 't36c-carve', 'aria-hidden': 'true' }), cvB = h('canvas', { class: 't36c-carve', 'aria-hidden': 'true' })
  const warm = h('canvas', { class: 't36c-warm', 'aria-hidden': 'true' })
  const chipCv = h('canvas', { class: 't36c-chips', 'aria-hidden': 'true' })
  const carving = h('div', { class: 't36c-block' }, cvA, cvB, warm, chipCv)
  const lampEl = h('div', { class: 't36c-lamp', 'aria-hidden': 'true' },
    s('svg', { viewBox: '0 0 60 140' },
      s('path', { class: 't36c-cord', d: 'M30 0V64' }),
      s('rect', { class: 't36c-hook', x: 24, y: 0, width: 12, height: 7, rx: 2 }),
      s('ellipse', { class: 't36c-glow', cx: 30, cy: 104, rx: 30, ry: 24 }),
      s('path', { class: 't36c-shade', d: 'M11 98Q13 74 30 68Q47 74 49 98Z' }),
      s('path', { class: 't36c-shade-hi', d: 'M17 92Q19 77 29 72', fill: 'none' }),
      s('ellipse', { class: 't36c-mouth', cx: 30, cy: 98, rx: 19, ry: 4.4 }),
      s('ellipse', { class: 't36c-bulb', cx: 30, cy: 98.6, rx: 8, ry: 3.4 })))

  // the board leaning on the wall: the decode at first, then each cut's prompt in chalk
  const bEye = h('p', { class: 't36c-sl-eye' })
  const bText = h('p', { class: 't36c-sl-text' }, K.decode)
  const board = h('div', { class: 't36c-board' }, h('i', { class: 't36c-bnail', 'aria-hidden': 'true' }), bEye, bText)
  // the mallet lying on the bench
  const mallet = h('button', { class: 't36c-mallet', type: 'button', 'aria-label': fill(K.malletAria, { name: FEAT[0].name }), onClick: () => strike() }, malletArt())
  // the tray: six hollows, a pebble for each checkpoint, the count carved in its front
  const count = h('p', { class: 't36c-count', 'aria-live': 'off' }, fill(K.trayCount, { n: 0, total: N }))
  const pebbles = FEAT.map((f, k) => {
    const b = h('button', { class: 't36c-peb', type: 'button', hidden: true, 'aria-label': fill(K.pebbleAria, { n: k + 1, name: f.name }), onClick: () => touchPebble(k) }, pebbleArt(k))
    return b
  })
  // the code, rolled up and tied on the bench: it unrolls into a sheet (code, the sample prompts, the take-away cards)
  const close = h('button', { class: 't36n-close', type: 'button' }, L.close)
  const cards = [K.steps.takeaway, ...K.steps.cards].map((id) => findTakeaway(id)).filter((c): c is Takeaway => !!c)
  const sheet = h('div', { class: 't36c-sheet t36c-unroll', role: 'region', 'aria-label': K.codeAria, hidden: true }, close,
    h('div', { class: 't36c-body' },
      h('div', { class: 't36c-code' }, codeScroll(K.code as CodeScroll, { title: K.fileName })),
      h('div', { class: 't36c-prompts' }, h('p', { class: 'p2-eyebrow' }, K.promptLabel),
        h('ol', null, ...K.prompts.map((p, i) => h('li', null, h('span', { class: 't36c-step' }, K.steps.steps[i].label), h('span', { class: 't36c-sdetail' }, K.steps.steps[i].detail), p)))),
      ...cards.map((c) => takeaway(c, null, ctx.onCleanup))))
  const scroll = h('button', { class: 't36c-scroll', type: 'button', 'aria-expanded': 'false', 'aria-label': K.sheetAria },
    scrollArt(), h('span', { class: 't36c-tag', 'aria-hidden': 'true' }, K.fileName))
  const objects = h('div', { class: 't36c-objs' }, board, scroll, mallet, count, ...pebbles, sheet)
  const back = h('div', { class: `t36 t36c${low ? ' low' : ''}` }, h('p', { class: 'visually-hidden' }, K.art), shop, wallGlow, cone, pool, carving, lampEl, objects)
  ctx.art.append(back)
  ctx.prompt(fill(K.strikePrompt, { name: FEAT[0].name }))

  const setSheet = (on: boolean) => {
    sheet.hidden = !on
    scroll.setAttribute('aria-expanded', String(on))
    ;(on ? close : scroll).focus()
    if (on) scrollDot?.done()
  }
  scroll.addEventListener('click', () => setSheet(true))
  close.addEventListener('click', () => setSheet(false))
  const esc = (e: KeyboardEvent) => e.key === 'Escape' && !sheet.hidden && setSheet(false)
  addEventListener('keydown', esc)
  ctx.onCleanup(() => removeEventListener('keydown', esc))

  // ── guide: a vermilion dot on the mallet (it lifts a little when idle), then on checkpoint 3 when the wood cracks
  const GD = guide(ctx)
  let dot: Mark | null = GD.dot(mallet, { dir: [0, -1] })
  let scrollDot: Mark | null = null
  const idle = () => {
    if (over || ctx.reduced || crack) return
    mallet.classList.remove('nudge')
    void mallet.offsetWidth
    mallet.classList.add('nudge')
  }
  ctx.el.addEventListener('p2:idle', idle)
  ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', idle))

  function chalk(eye: string, text: string) {
    bEye.textContent = eye
    bText.textContent = text
    board.classList.remove('new')
    void board.offsetWidth
    board.classList.add('new')
    if (!board.hasAttribute('aria-live')) board.setAttribute('aria-live', 'polite')
  }

  // ── a blow of the mallet: chips fly, the carving moves on one stage; the checkpoint drops into the tray
  let hitT = 0
  ctx.onCleanup(() => clearTimeout(hitT))
  function strike() {
    if (over || crack === 2) return
    mallet.classList.remove('hit', 'nudge')
    void mallet.offsetWidth
    mallet.classList.add('hit')
    if (crack === 1) {
      // carving on over the break: the crack runs further, only going back helps now
      crack = 2
      hitT = window.setTimeout(() => (carve(), ctx.chime('tap')), ctx.reduced ? 0 : 200)
      chalk(FEAT[BUG].name, K.spreadChalk)
      ctx.prompt(K.spreadPrompt, 'wrong')
      mallet.disabled = true
      return
    }
    const f = saved
    const breaks = f === BUG && !fixed
    hitT = window.setTimeout(() => {
      if (breaks) crack = 1
      else saved++
      carve()
      ctx.chime('tap')
      if (breaks) return broke()
      drop(saved - 1)
      if (saved === 1) count.setAttribute('aria-live', 'polite')
      count.textContent = fill(K.trayCount, { n: saved, total: N })
      chalk(`${fill(K.pebbleAria, { n: saved, name: FEAT[f].name })} · ${K.promptLabel}`, FEAT[f].ask)
      if (saved === N) return finish()
      mallet.setAttribute('aria-label', fill(K.malletAria, { name: FEAT[saved].name }))
      ctx.prompt(fill(K.strikePrompt, { name: FEAT[saved].name }))
    }, ctx.reduced ? 0 : 200)
  }
  function broke() {
    chalk(FEAT[BUG].name, K.crackChalk)
    ctx.prompt(K.crackPrompt, 'wrong')
    // the way back: checkpoint 3 carries the dot now
    dot?.done()
    dot = GD.dot(pebbles[BUG - 1], { dir: [0, 1] })
    pebbles[BUG - 1].setAttribute('aria-label', fill(K.backAria, { n: BUG, name: FEAT[BUG - 1].name }))
    pebbles[BUG - 1].classList.add('way')
  }
  function touchPebble(k: number) {
    if (crack && k === BUG - 1) {
      // back to checkpoint 3: the wood heals, the feature is asked again with evidence
      crack = 0
      fixed = true
      carve()
      GD.ok(pebbles[k])
      ctx.chime('ok')
      dot?.done()
      dot = GD.dot(mallet, { dir: [0, -1] })
      mallet.disabled = false
      pebbles[k].classList.remove('way')
      pebbles[k].setAttribute('aria-label', fill(K.pebbleAria, { n: k + 1, name: FEAT[k].name }))
      chalk(fill(K.pebbleAria, { n: BUG, name: FEAT[BUG - 1].name }), K.revertChalk)
      ctx.prompt(fill(K.redoPrompt, { name: FEAT[BUG].name }))
      mallet.focus({ preventScroll: true })
      return
    }
    // any other checkpoint: its prompt goes back on the board (nothing is a dead touch)
    if (crack) return ctx.prompt(K.crackPrompt, 'wrong')
    chalk(`${fill(K.pebbleAria, { n: k + 1, name: FEAT[k].name })} · ${K.promptLabel}`, FEAT[k].ask)
  }
  function drop(k: number) {
    const p = pebbles[k]
    p.hidden = false
    p.classList.remove('drop')
    void p.offsetWidth
    p.classList.add('drop')
  }
  function finish() {
    over = true
    dot?.done()
    dot = null
    mallet.disabled = true
    board.classList.add('rest')
    ctx.insight(F(K.insight), [K.detail, F(K.facts[0]), F(K.facts[1])])
    ctx.chime('ok')
    // the scroll waits now: the sample prompts and the cards are in it
    scrollDot = GD.dot(scroll, { dir: [0, -1] })
  }

  // ── geometry (set in layout), the painted shop, the carving canvases
  const blk = { cw: 0, chh: 0, top: 0, dpr: 1, foot: 0 }
  let job: { cancel(): void } | null = null
  ctx.onCleanup(() => job?.cancel())
  let drawn = false
  ctx.onCleanup(onSize(ctx.art, () => {
    const W = ctx.art.clientWidth, A = ctx.art.clientHeight
    const H = stableH(A)
    if (W < 60 || H < 60) return
    geo = null
    const o = geoOf(W, H)
    back.style.height = `${f1(A)}px`
    back.classList.toggle('wide', o.wide)
    const px = (n: number) => `${f1(n)}px`
    const [bx, by, bw, bh] = o.board
    Object.assign(board.style, { left: px(bx), top: px(by), width: px(bw), height: px(bh) })
    Object.assign(scroll.style, { left: px(o.scroll[0]), top: px(o.scroll[1]), width: px(o.scroll[2]) })
    const [mx, my, ml] = o.mallet
    Object.assign(mallet.style, { left: px(mx - ml / 2), top: px(my - ml * 0.2), width: px(ml), height: px(ml * (90 / 220)) })
    const [tx0, tx1, ty0, ty1] = o.tray
    Object.assign(count.style, { left: px(tx0 + 12), top: px(ty0 + (ty1 - ty0) * 0.78), width: px(tx1 - tx0 - 24) })
    const pw = clamp((tx1 - tx0) / N * 0.62, 34, 58)
    o.hollows.forEach(([x, y], k) => Object.assign(pebbles[k].style, { left: px(x - pw / 2 - 6), top: px(y - pw * 0.52), width: px(pw + 12), height: px(pw * 0.7 + 10) }))
    const set = (k: string, v: number) => back.style.setProperty(k, px(v))
    set('--ux', o.sheet[0])
    set('--uy', o.sheet[1])
    set('--uw', o.sheet[2])
    set('--uh', o.sheet[3])
    // the block on its horse: a canvas with room round it for fins, rim light and chips
    const { blk: b } = o
    blk.cw = b.w * 1.4
    blk.top = b.y - b.h * 1.08
    blk.foot = o.foot - blk.top
    blk.chh = blk.foot + 12
    blk.dpr = Math.min(devicePixelRatio || 1, low ? 1 : 1.5)
    Object.assign(carving.style, { left: px(b.x - blk.cw / 2), top: px(blk.top), width: px(blk.cw), height: px(blk.chh) })
    for (const c of [cvA, cvB, warm, chipCv]) {
      c.width = Math.round(blk.cw * blk.dpr)
      c.height = Math.round(blk.chh * blk.dpr)
    }
    placeLamp()
    const paint = paintShop(shop, o, P)
    if (!drawn && !ctx.reduced) {
      // first paint soaks in, in slices; later ones (resize, theme) in one go
      job?.cancel()
      job = sliced(paint, { budget: 6 })
    } else while (!paint.next().done);
    drawn = true
    drawCarving(stageOf())
    GD.refresh()
  }))
  ctx.onCleanup(onPrefs(() => {
    const was = JSON.stringify(P)
    P = readPal()
    if (was === JSON.stringify(P) || !geo) return
    const paint = paintShop(shop, geo, P)
    while (!paint.next().done);
    drawCarving(stageOf())
  }))

  function placeLamp() {
    const o = geo
    if (!o) return
    const ry = o.rail[2], x = o.lampX
    const lw = o.wide ? clamp(o.W * 0.042, 42, 62) : 34
    const lh = lw * (140 / 60)
    Object.assign(lampEl.style, { left: `${f1(x - lw / 2)}px`, top: `${f1(ry)}px`, width: `${f1(lw)}px`, height: `${f1(lh)}px` })
    // the light: a cone from the shade's mouth to the bench, a glow on the wall behind, a pool on the bench top
    const mouth = ry + lh * 0.7, benchY = o.mallet[1]
    back.style.setProperty('--lx', `${f1(x)}px`)
    back.style.setProperty('--ly', `${f1(mouth)}px`)
    back.style.setProperty('--lw', `${f1(lw * 0.62)}px`)
    back.style.setProperty('--ch', `${f1(benchY - mouth)}px`)
    back.style.setProperty('--cw', `${f1(o.wide ? o.W * 0.36 : o.W * 0.8)}px`)
    back.style.setProperty('--by', `${f1(benchY)}px`)
    back.style.setProperty('--wy', `${f1(o.back * 0.5)}px`)
  }

  // ── the carving: crossfade from the stage on show to the next
  let front = cvA, behind = cvB
  function carve() {
    ;[front, behind] = [behind, front]
    drawCarving(stageOf(), front)
    front.classList.add('in')
    behind.classList.remove('in')
    if (!low && !ctx.reduced) burst()
  }
  function drawCarving(n: number, into = front) {
    if (!geo) return
    const D = blk.dpr, b = geo.blk
    for (const [cv, kind] of [[into, 'base'], [warm, 'rake']] as const) {
      const g = cv.getContext('2d')!
      g.setTransform(D, 0, 0, D, 0, 0)
      g.clearRect(0, 0, blk.cw, blk.chh)
      paintCarving(g, n, kind, blk.cw, b.w, b.h, b.y - blk.top, blk.foot, P, crack, !over)
    }
    into.classList.add('in')
  }
  cvA.classList.add('in')

  // ── chips: ≤ 60 curls, a loop only while they fly; they come to rest on the bench round the horse's feet
  const chips = Array.from({ length: 60 }, () => ({ x: 0, y: 0, vx: 0, vy: 0, r: 0, a: 0, va: 0, on: false }))
  const cg = chipCv.getContext('2d')!
  const rr = rng(3660)
  const chipLoop = createLoop(chipCv, (_t, dt) => {
    const D = blk.dpr
    cg.setTransform(D, 0, 0, D, 0, 0)
    cg.clearRect(0, 0, blk.cw, blk.chh)
    let any = false
    const floor = blk.foot
    cg.fillStyle = woodOf(P).hi
    for (const c of chips) {
      if (!c.on) continue
      c.vy += 900 * dt
      c.x += c.vx * dt
      c.y += c.vy * dt
      c.a += c.va * dt
      if (c.y > floor) {
        c.y = floor
        c.vy *= -0.25
        c.vx *= 0.6
        c.va *= 0.5
        if (Math.abs(c.vy) < 30) c.on = false
      }
      any = true
      cg.save()
      cg.translate(c.x, c.y)
      cg.rotate(c.a)
      cg.beginPath()
      cg.arc(0, 0, c.r, 0.4, 2.8)
      cg.lineTo(0, -c.r * 0.2)
      cg.fill()
      cg.restore()
    }
    return any
  })
  ctx.onCleanup(() => chipLoop.dispose())
  function burst() {
    if (!geo) return
    const b = geo.blk
    const cx = blk.cw / 2 + (rr() - 0.5) * b.w * 0.5, cy = b.y - blk.top - b.h * 0.2
    for (const c of chips) {
      c.on = true
      c.x = cx + (rr() - 0.5) * 20
      c.y = cy + (rr() - 0.5) * 10
      const a = -Math.PI / 2 + (rr() - 0.5) * 2.4
      const sp = 140 + rr() * 260
      c.vx = Math.cos(a) * sp
      c.vy = Math.sin(a) * sp
      c.r = 1.6 + rr() * 2.8
      c.a = rr() * TAU
      c.va = (rr() - 0.5) * 20
    }
    chipLoop.start()
  }
}

/** a wooden mallet lying on the bench (viewBox 0 0 220 90): the handle worn pale where it is held, the head a short log
 *  lying across it, its end grain toward us with its rings; contact shadow under both */
function malletArt(): SVGSVGElement {
  const r = rng(3701)
  let grain = ''
  for (let k = 0; k < 4; k++) grain += `M${f1(14 + r() * 20)} ${f1(56 + (r() - 0.5) * 4)}Q60 ${f1(52 + (r() - 0.5) * 3)} ${f1(118 + r() * 6)} ${f1(49 + (r() - 0.5) * 4)}`
  return s('svg', { class: 't36c-mart', viewBox: '0 0 220 90', 'aria-hidden': 'true' },
    s('ellipse', { class: 't36c-msh', cx: 118, cy: 82, rx: 104, ry: 6.5 }),
    // the handle: from its butt (left) into the head, a little thicker toward the head
    s('path', { class: 't36c-mhandle', d: 'M8 61Q6 55 11 53L128 44L130 58L13 66Q8 66 8 61Z' }),
    s('path', { class: 't36c-mworn', d: 'M22 55L70 51L71 60L23 63Z' }),
    s('path', { class: 't36c-mgrain', d: grain, fill: 'none' }),
    s('path', { class: 't36c-mhandle-hi', d: 'M12 54L126 45', fill: 'none' }),
    // the head: its body running back (up and right), then its round end facing us
    s('path', { class: 't36c-mhead', d: 'M130 22Q158 8 190 18L204 30Q210 52 200 76L186 82Q152 88 132 78Z' }),
    s('path', { class: 't36c-mhead-top', d: 'M134 24Q160 10 190 18L203 29Q178 22 150 30Z' }),
    s('ellipse', { class: 't36c-mend', cx: 158, cy: 50, rx: 30, ry: 32 }),
    ...[1, 2, 3, 4].map((k) => s('ellipse', { class: 't36c-mrings', cx: f1(158 - k * 0.6), cy: f1(50 + k * 0.4), rx: f1(k * 6.2), ry: f1(k * 6.8), fill: 'none' })),
    s('path', { class: 't36c-mcheck', d: 'M158 50L178 28', fill: 'none' }),
    s('path', { class: 't36c-mrim', d: 'M131 40Q140 20 162 18', fill: 'none' }))
}

/** a checkpoint pebble (viewBox 0 0 60 42): a river stone of its own shape, its number cut small in its crown */
function pebbleArt(k: number): SVGSVGElement {
  const r = rng(3720 + k * 13)
  const rx = 22 + r() * 5, ry = 12 + r() * 3, skew = (r() - 0.5) * 6
  const pts: Pt[] = []
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * TAU
    const n = 1 + (r() - 0.5) * 0.08 + Math.sin(a * 2 + k) * 0.06
    pts.push([30 + Math.cos(a) * rx * n + Math.sin(a) * skew, 22 + Math.sin(a) * ry * n])
  }
  const d = `M${pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}Z`
  return s('svg', { class: `t36c-part t36c-t${k % 4}`, viewBox: '0 0 60 42', 'aria-hidden': 'true' },
    s('ellipse', { class: 't36c-ssh', cx: 32, cy: 33, rx: f1(rx * 1.02), ry: 4.5 }),
    s('path', { class: 't36c-sside', d, transform: 'translate(0 3)' }),
    s('path', { class: 't36c-stop', d, fill: 'url(#t36c-stone)' }),
    s('path', { class: 't36c-stint', d }),
    s('path', { class: 't36c-srim', d: `M${f1(30 - rx * 0.6)} ${f1(22 - ry * 0.55)}Q30 ${f1(22 - ry * 1.05)} ${f1(30 + rx * 0.55)} ${f1(22 - ry * 0.5)}`, fill: 'none' }),
    s('text', { class: 't36c-pnum', x: 30, y: 26.5, 'text-anchor': 'middle' }, String(k + 1)))
}

/** the code: a closed calligraphy scroll — paper roll, two rod ends, a cord wound round it (viewBox 0 0 200 40) */
function scrollArt(): SVGSVGElement {
  return s('svg', { class: 't36c-roll', viewBox: '0 0 200 40', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    s('ellipse', { class: 't36c-rsh', cx: 104, cy: 35, rx: 98, ry: 4 }),
    s('rect', { class: 't36c-rpaper', x: 14, y: 8, width: 172, height: 24, rx: 4 }),
    s('path', { class: 't36c-rshade', d: 'M14 24H186V28Q186 32 182 32H18Q14 32 14 28Z' }),
    s('path', { class: 't36c-rhi', d: 'M18 12.5H182', fill: 'none' }),
    s('rect', { class: 't36c-rend', x: 2, y: 10, width: 14, height: 20, rx: 3 }),
    s('rect', { class: 't36c-rend', x: 184, y: 10, width: 14, height: 20, rx: 3 }),
    // the cord: three turns, then its tail falling to the bench
    s('path', { class: 't36c-cordw', d: 'M92 7.5L98 32.5M99 7.5L105 32.5M106 7.5L112 32.5M112 32Q118 36 128 37', fill: 'none' }))
}

// ── painting the carving ──
function segPath(g: G, pts: Seg[], P: (u: number, v: number) => Pt) {
  g.beginPath()
  const p0 = pts[0] as UV
  g.moveTo(...P(p0[0], p0[1]))
  for (const p of pts.slice(1)) {
    if (typeof p[0] === 'number') g.lineTo(...P((p as UV)[0], (p as UV)[1]))
    else {
      const [c, e] = p as [UV, UV]
      g.quadraticCurveTo(...P(c[0], c[1]), ...P(e[0], e[1]))
    }
  }
  g.closePath()
}

/**
 * One stage of the carving into g (css px, w wide; the block bw × bh, its middle at y = cy; the horse's feet at y = foot).
 * kind: 'base' = the wood seen against the door (pale hinoki in its own shade, the moon wrapping its far edges in a
 * bright rim, saw and chisel marks, the horse, the chips on the bench, chalk for the next cut, a crack), 'rake' = the
 * lamp's warm light on the near face.
 */
function paintCarving(g: G, n: number, kind: 'base' | 'rake', w: number, bw: number, bh: number, cy: number, foot: number, P: Pal, crack: number, chalkOn: boolean) {
  const cx = w / 2
  // the fish flexes as it comes alive: the tail lifts (stage 6), more with the eye in (7)
  const bend = n >= 7 ? 0.32 : n >= 6 ? 0.2 : 0
  const at = (u: number, v: number): Pt => [cx + u * bw, cy + (v - bend * (Math.max(0, u + 0.5) ** 2.2) * 1.15 + bend * 0.32) * bh * 0.5]
  const r = rng(3670 + n)
  const Wd = woodOf(P)
  const shape = () => {
    if (n <= 1) {
      g.beginPath()
      const c: UV[] = [[-0.5, -0.93], [0.5, -0.95], [0.5, 0.93], [-0.5, 0.95]]
      c.forEach(([u, v], i) => (i ? g.lineTo(...at(u, v)) : g.moveTo(...at(u, v))))
      g.closePath()
    } else if (n === 2) {
      g.beginPath()
      CUT.forEach(([u, v], i) => (i ? g.lineTo(...at(u, v)) : g.moveTo(...at(u, v))))
      g.closePath()
    } else segPath(g, n === 3 ? BLUNT : FISH, at)
    if (n >= 5) {
      for (const [a, t, b] of FINS) {
        g.moveTo(...at(a[0], a[1]))
        g.quadraticCurveTo(...at(a[0] + (t[0] - a[0]) * 0.2, t[1] * 0.95), ...at(t[0], t[1]))
        g.quadraticCurveTo(...at((t[0] + b[0]) / 2 - 0.02, (t[1] + b[1]) / 2), ...at(b[0], b[1]))
        g.closePath()
      }
    }
  }
  const clipBody = () => {
    shape()
    g.clip('nonzero')
  }
  if (kind === 'base') {
    // ── the carving horse: two splayed legs each side, a rail, a padded cradle; dark against the door, rimmed
    const leg = mix(Wd.lo, P.wash, P.dark ? 0.55 : 0.35)
    g.lineCap = 'round'
    g.strokeStyle = leg
    g.lineWidth = Math.max(4, bh * 0.11)
    const top = at(0, 0.82)[1] + bh * 0.06
    for (const [a, b] of [[-0.34, -0.46], [-0.34, -0.22], [0.32, 0.2], [0.32, 0.46]]) {
      g.beginPath()
      g.moveTo(cx + a * bw, top)
      g.lineTo(cx + b * bw, foot)
      g.stroke()
    }
    g.lineWidth = Math.max(3, bh * 0.09)
    g.beginPath()
    g.moveTo(cx - 0.42 * bw, top + (foot - top) * 0.45)
    g.lineTo(cx + 0.42 * bw, top + (foot - top) * 0.45)
    g.stroke()
    g.fillStyle = leg
    g.fillRect(cx - 0.42 * bw, top - bh * 0.06, 0.84 * bw, bh * 0.12)
    g.strokeStyle = rgba(P.moon, P.dark ? 0.55 : 0.75)
    g.lineWidth = 1.2
    g.beginPath()
    g.moveTo(cx - 0.42 * bw, top - bh * 0.06)
    g.lineTo(cx + 0.42 * bw, top - bh * 0.06)
    for (const [a, b] of [[-0.34, -0.46], [0.32, 0.46]]) {
      g.moveTo(cx + a * bw + 2, top)
      g.lineTo(cx + b * bw + 2, foot)
    }
    g.stroke()
    // the horse's feet on the bench: a soft contact shadow under each, falling away from the door's light
    g.fillStyle = rgba(P.umbra, P.dark ? 0.55 : 0.3)
    for (const b of [-0.46, -0.22, 0.2, 0.46]) {
      g.beginPath()
      g.ellipse(cx + b * bw + bh * 0.06, foot + 1.5, bh * 0.14, bh * 0.035, 0, 0, TAU)
      g.fill()
    }
    // the chips fallen so far: pale curls on the bench round the feet
    g.fillStyle = Wd.hi
    for (let i = 0; i < Math.min(70, (n - 1) * 12); i++) {
      g.globalAlpha = 0.45 + r() * 0.45
      g.save()
      g.translate(cx + (r() - 0.5) * bw * 1.25, foot - r() * 5)
      g.rotate(r() * TAU)
      const k = 1.6 + r() * 3
      g.beginPath()
      g.arc(0, 0, k, 0.3, 2.9)
      g.lineTo(0, -k * 0.2)
      g.fill()
      g.restore()
    }
    g.globalAlpha = 1
    // ── the door's light blooming round the silhouette
    g.save()
    g.strokeStyle = rgba(P.moon, P.dark ? 0.16 : 0.3)
    g.shadowColor = P.moon
    g.shadowBlur = bh * 0.45
    g.lineWidth = bh * 0.04
    shape()
    g.stroke()
    g.restore()
    // ── the wood in its own shade: pale hinoki, lighter on its upper faces
    const body = g.createLinearGradient(0, cy - bh * 0.55, 0, cy + bh * 0.55)
    body.addColorStop(0, mix(Wd.mid, P.wash, P.dark ? 0.3 : 0.1))
    body.addColorStop(0.55, mix(Wd.lo, P.wash, P.dark ? 0.32 : 0.12))
    body.addColorStop(1, mix(Wd.lo, P.wash, P.dark ? 0.55 : 0.3))
    g.fillStyle = body
    shape()
    g.fill()
    g.save()
    clipBody()
    // grain: hinoki's fine straight lines along the block, a few slow waves
    g.strokeStyle = rgba(mix(Wd.lo, P.wash, 0.4), P.dark ? 0.32 : 0.26)
    g.lineWidth = 0.8
    for (let i = 0; i < 22; i++) {
      const v = -1.1 + i * 0.105 + (r() - 0.5) * 0.04
      g.beginPath()
      g.moveTo(...at(-0.56, v))
      g.bezierCurveTo(...at(-0.2, v + (r() - 0.5) * 0.12), ...at(0.18, v + (r() - 0.5) * 0.12), ...at(0.56, v + (r() - 0.5) * 0.06))
      g.stroke()
    }
    // the surface each stage leaves: saw marks (1–2), chisel facets (2–5), finer gouges (5+)
    if (n <= 2) {
      g.strokeStyle = rgba(Wd.lo, 0.35)
      g.lineWidth = 0.7
      for (let i = 0; i < 26; i++) {
        const u = -0.5 + i / 25
        g.beginPath()
        g.moveTo(...at(u, -1.2))
        g.lineTo(...at(u + 0.03, 1.2))
        g.stroke()
      }
    }
    if (n >= 2) {
      const count = n >= 6 ? 50 : n >= 4 ? 90 : 120
      const sz = n >= 6 ? 0.035 : n >= 4 ? 0.05 : 0.07
      for (let i = 0; i < count; i++) {
        const u = -0.5 + r(), v = -1.1 + r() * 2.2
        const [x, y] = at(u, v)
        const a = r() * TAU, k = bw * sz * (0.6 + r() * 0.6)
        // a facet: lit when it faces up-left (the lamp), shadowed when it faces down-right
        const lit = Math.cos(a + 2.3)
        g.fillStyle = lit > 0 ? rgba(Wd.hi, 0.14 + lit * 0.22) : rgba(mix(Wd.lo, P.wash, 0.3), 0.1 - lit * 0.2)
        g.beginPath()
        g.moveTo(x, y)
        g.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k * 0.55)
        g.lineTo(x + Math.cos(a + 1.3) * k * 0.7, y + Math.sin(a + 1.3) * k * 0.45)
        g.closePath()
        g.fill()
      }
    }
    if (n >= 3) {
      // gouge scoops: a dark hollow and the lit lip above it, with the grain
      g.lineCap = 'round'
      for (let i = 0; i < (n >= 6 ? 36 : 64); i++) {
        const u = -0.44 + r() * 0.86, v = -0.9 + r() * 1.8, len = bw * (0.025 + r() * 0.035)
        const [x, y] = at(u, v)
        g.strokeStyle = rgba(mix(Wd.lo, P.wash, 0.5), n >= 6 ? 0.22 : 0.38)
        g.lineWidth = 0.9 + r() * 1.1
        g.beginPath()
        g.moveTo(x, y)
        g.quadraticCurveTo(x + len * 0.5, y + bh * 0.03, x + len, y + bh * 0.01)
        g.stroke()
        g.strokeStyle = rgba(Wd.hi, n >= 6 ? 0.25 : 0.4)
        g.lineWidth = 0.8
        g.beginPath()
        g.moveTo(x, y - 1.6)
        g.quadraticCurveTo(x + len * 0.5, y - 1.6 + bh * 0.02, x + len, y - 1.6)
        g.stroke()
      }
    }
    g.restore()
    if (n <= 1) {
      // the end grain at the tail end: growth rings round the pith, a check splitting out from it
      const [ex, ey] = at(0.5, 0.15)
      g.fillStyle = mix(Wd.mid, Wd.hi, 0.35)
      g.beginPath()
      g.ellipse(ex, ey, bh * 0.1, bh * 0.4, 0, 0, TAU)
      g.fill()
      g.strokeStyle = rgba(Wd.lo, 0.7)
      g.lineWidth = 0.8
      for (let k = 1; k < 5; k++) {
        g.beginPath()
        g.ellipse(ex - bh * 0.02, ey + bh * 0.08, bh * 0.022 * k, bh * 0.09 * k, 0, 0, TAU)
        g.stroke()
      }
    }
    if (n >= 4) {
      // the split tail: rays fanning into each lobe
      g.strokeStyle = rgba(mix(Wd.lo, P.wash, 0.4), 0.6)
      g.lineWidth = 1.3
      for (let k = -3; k <= 3; k++) {
        if (!k) continue
        g.beginPath()
        g.moveTo(...at(0.35, k * 0.05))
        g.lineTo(...at(0.48, k * 0.27))
        g.stroke()
      }
    }
    if (n >= 5) {
      // fin rays, the gill line
      g.strokeStyle = rgba(mix(Wd.lo, P.wash, 0.4), 0.5)
      g.lineWidth = 1
      for (const [a, t, b] of FINS) {
        for (let k = 1; k < 5; k++) {
          const f = k / 5
          g.beginPath()
          g.moveTo(...at(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f))
          g.lineTo(...at(t[0] - 0.05 + 0.1 * f, t[1] * (0.82 + f * 0.1)))
          g.stroke()
        }
      }
      g.lineWidth = 1.8
      g.beginPath()
      g.moveTo(...at(-0.29, -0.6))
      g.quadraticCurveTo(...at(-0.22, 0), ...at(-0.29, 0.6))
      g.stroke()
    }
    if (n >= 6) {
      // scales, raised: rows of overlapping arcs, each lit on its upper lip
      g.save()
      segPath(g, FISH, at)
      g.clip()
      for (let i = 0; i < 10; i++) for (let j = -2; j <= 2; j++) {
        const [x, y] = at(-0.2 + i * 0.052, j * 0.32 + (i % 2) * 0.16)
        const k = bh * 0.1
        g.strokeStyle = rgba(mix(Wd.lo, P.wash, 0.45), 0.45)
        g.lineWidth = 1.2
        g.beginPath()
        g.arc(x, y, k, -1.2, 1.2)
        g.stroke()
        g.strokeStyle = rgba(Wd.hi, 0.5)
        g.lineWidth = 1
        g.beginPath()
        g.arc(x - 1, y - 1, k, -1.3, -0.4)
        g.stroke()
      }
      g.restore()
    }
    if (n >= 7) {
      // the eye, its socket and glint; the barbels at the mouth that make it a koi
      const [ex, ey] = at(-0.38, -0.16)
      g.strokeStyle = rgba(mix(Wd.lo, P.wash, 0.4), 0.7)
      g.lineWidth = 1.4
      g.beginPath()
      g.arc(ex, ey, bh * 0.1, 0, TAU)
      g.stroke()
      g.fillStyle = mix(P.wash, Wd.lo, 0.3)
      g.beginPath()
      g.arc(ex, ey, bh * 0.06, 0, TAU)
      g.fill()
      g.fillStyle = rgba(P.moon, 0.95)
      g.beginPath()
      g.arc(ex - bh * 0.02, ey - bh * 0.025, bh * 0.022, 0, TAU)
      g.fill()
      g.strokeStyle = mix(Wd.mid, Wd.lo, 0.3)
      g.lineCap = 'round'
      g.lineWidth = Math.max(1.6, bh * 0.035)
      for (const s0 of [0, 1]) {
        const [mx, my] = at(-0.46, 0.14 + s0 * 0.08)
        g.beginPath()
        g.moveTo(mx, my)
        g.quadraticCurveTo(mx - bw * 0.05, my + bh * 0.12, mx - bw * (0.03 + s0 * 0.02), my + bh * (0.3 + s0 * 0.05))
        g.stroke()
      }
    }
    // ── the moon wraps the edges that face it (it rises over the lake, high and to the left): a bright inner rim
    g.save()
    clipBody()
    g.strokeStyle = rgba(P.moon, P.dark ? 0.95 : 0.9)
    g.lineWidth = Math.max(3, bh * 0.08)
    g.shadowColor = P.moon
    g.shadowBlur = bh * 0.18
    shape()
    g.stroke()
    g.shadowBlur = 0
    // ...then the body's lower right pushed back over it, so only the upper-left edges keep their light
    g.globalCompositeOperation = 'source-atop'
    g.translate(bh * 0.05, bh * 0.08)
    const shade = g.createLinearGradient(0, cy - bh * 0.6, 0, cy + bh * 0.6)
    shade.addColorStop(0, rgba(Wd.mid, 0))
    shade.addColorStop(0.35, rgba(mix(Wd.lo, P.wash, P.dark ? 0.3 : 0.1), 0.6))
    shade.addColorStop(1, rgba(mix(Wd.lo, P.wash, P.dark ? 0.5 : 0.25), 0.8))
    g.fillStyle = shade
    shape()
    g.fill()
    g.restore()
    // a hairline of moon round the whole silhouette
    g.strokeStyle = rgba(P.moon, P.dark ? 0.75 : 0.85)
    g.lineWidth = 1.1
    shape()
    g.stroke()
    if (crack) paintCrack(g, at, bh, crack, P, Wd)
    else if (chalkOn) paintChalk(g, n, at, bh, P)
    return
  }
  // ── the lamp's warm light on the near face, raking from the upper left: it catches the lip of every cut
  const grad = g.createLinearGradient(...at(-0.6, -1.1), ...at(0.5, 0.9))
  grad.addColorStop(0, rgba(mix(P.lantern, Wd.hi, 0.35), 0.8))
  grad.addColorStop(0.5, rgba(P.lantern, 0.14))
  grad.addColorStop(1, rgba(P.lantern, 0))
  g.save()
  clipBody()
  g.fillStyle = grad
  g.fillRect(0, 0, w, foot)
  if (n >= 2) {
    const rr = rng(3670 + n)
    g.strokeStyle = rgba(mix(P.lantern, P.card, 0.45), 0.38)
    g.lineCap = 'round'
    for (let i = 0; i < (n >= 6 ? 40 : 70); i++) {
      const u = -0.44 + rr() * 0.86, v = -0.9 + rr() * 1.8, len = bw * (0.025 + rr() * 0.035)
      const [x, y] = at(u, v)
      g.lineWidth = 0.8 + rr() * 1.2
      g.beginPath()
      g.moveTo(x, y - 1.5)
      g.quadraticCurveTo(x + len * 0.5, y - 1.5 + bh * 0.02, x + len, y - 1.5)
      g.stroke()
    }
  }
  g.restore()
}

/** chalk on the wood where the next cut goes (H3): dashed, a carpenter's hand */
function paintChalk(g: G, n: number, at: (u: number, v: number) => Pt, bh: number, P: Pal) {
  if (n >= 7) return
  g.save()
  g.strokeStyle = rgba(P.dark ? P.ink : P.card, 0.92)
  g.lineWidth = Math.max(1.4, bh * 0.028)
  g.lineCap = 'round'
  g.setLineDash([7, 5])
  g.beginPath()
  if (n <= 1) {
    // the fish laid out on the squared blank, its centre line, two cross ticks
    segPath(g, FISH, at)
    g.stroke()
    g.setLineDash([2, 5])
    g.beginPath()
    g.moveTo(...at(-0.48, 0.04))
    g.lineTo(...at(0.48, 0.04))
  } else if (n === 2) segPath(g, BLUNT, at)
  else if (n === 3) {
    // where the tail splits
    g.moveTo(...at(0.33, -0.15))
    g.quadraticCurveTo(...at(0.42, -0.5), ...at(0.5, -0.9))
    g.moveTo(...at(0.33, 0.16))
    g.quadraticCurveTo(...at(0.42, 0.5), ...at(0.5, 0.9))
    g.moveTo(...at(0.47, -0.3))
    g.lineTo(...at(0.38, 0))
    g.lineTo(...at(0.47, 0.3))
  } else if (n === 4) {
    for (const [a, t, b] of FINS) {
      g.moveTo(...at(a[0], a[1]))
      g.quadraticCurveTo(...at(a[0] + (t[0] - a[0]) * 0.2, t[1] * 0.95), ...at(t[0], t[1]))
      g.quadraticCurveTo(...at((t[0] + b[0]) / 2 - 0.02, (t[1] + b[1]) / 2), ...at(b[0], b[1]))
    }
  } else if (n === 5) {
    for (let i = 0; i < 4; i++) for (let j = -1; j <= 1; j++) {
      const [x, y] = at(-0.12 + i * 0.09, j * 0.36 + (i % 2) * 0.18)
      g.moveTo(x + Math.cos(-1.1) * bh * 0.1, y + Math.sin(-1.1) * bh * 0.1)
      g.arc(x, y, bh * 0.1, -1.1, 1.1)
    }
  } else {
    const [ex, ey] = at(-0.38, -0.16)
    g.moveTo(ex + bh * 0.11, ey)
    g.arc(ex, ey, bh * 0.11, 0, TAU)
  }
  g.stroke()
  g.restore()
}

/** a split in the wood from the tail toward the head (1), run on through the body with a branch (2): a dark gap with
 *  its lit lip, splinters lifted along it */
function paintCrack(g: G, at: (u: number, v: number) => Pt, bh: number, level: number, P: Pal, Wd: { hi: string; mid: string; lo: string }) {
  const r = rng(3690)
  const run = (u0: number, v0: number, u1: number, v1: number, k: number): Pt[] => Array.from({ length: k + 1 }, (_, i) => {
    const t = i / k
    return at(u0 + (u1 - u0) * t + (i && i < k ? (r() - 0.5) * 0.025 : 0), v0 + (v1 - v0) * t + (i && i < k ? (r() - 0.5) * 0.22 : 0))
  })
  const main = run(0.46, -0.1, level > 1 ? -0.42 : -0.02, level > 1 ? 0.22 : 0.12, level > 1 ? 16 : 9)
  const branch = level > 1 ? run(0.06, 0.04, -0.12, -0.7, 6) : []
  g.save()
  g.lineJoin = 'round'
  g.lineCap = 'round'
  for (const pts of [main, branch]) {
    if (!pts.length) continue
    // the gap: widest where it opened (at the tail), narrowing to nothing
    for (let i = 1; i < pts.length; i++) {
      const t = i / pts.length
      g.strokeStyle = rgba(P.umbra, 0.92)
      g.lineWidth = Math.max(1, bh * 0.07 * (1 - t) + 1)
      g.beginPath()
      g.moveTo(...pts[i - 1])
      g.lineTo(...pts[i])
      g.stroke()
      // the lip above the gap catches the lamp
      g.strokeStyle = rgba(mix(Wd.hi, P.lantern, 0.3), 0.75)
      g.lineWidth = 1
      g.beginPath()
      g.moveTo(pts[i - 1][0], pts[i - 1][1] - bh * 0.035 * (1 - t) - 1)
      g.lineTo(pts[i][0], pts[i][1] - bh * 0.035 * (1 - t) - 1)
      g.stroke()
    }
    // splinters: thin slivers lifted off the edges of the split
    g.fillStyle = mix(Wd.hi, Wd.mid, 0.3)
    for (let i = 1; i < pts.length - 1; i += 2) {
      const [x, y] = pts[i]
      const s0 = r() < 0.5 ? -1 : 1, len = bh * (0.08 + r() * 0.1)
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x - len * 0.9, y + s0 * len * 0.35)
      g.lineTo(x - len * 0.2, y + s0 * bh * 0.025)
      g.closePath()
      g.fill()
    }
  }
  g.restore()
}

/** The shop, painted once per size / theme: plank wall and its tools, the open door on the moonlit lake, the bench and
 *  the checkpoint tray on its front edge. A generator for sliced(). */
function* paintShop(cv: HTMLCanvasElement, o: Geo, P: Pal) {
  const { W, A, wide, back: bb, front: bf, edge: be } = o
  const dpr = Math.min(devicePixelRatio || 1, 1.5)
  // drawn into a detached canvas, shown in one go (README: never clear a canvas on screen and redraw it in slices)
  const off = document.createElement('canvas')
  off.width = Math.round(W * dpr)
  off.height = Math.round(A * dpr)
  const g = off.getContext('2d')!
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  const r = rng(3680)
  const Wd = woodOf(P)
  // ── the wall: cedar boards, darker high up where the lamp does not reach
  const wall = P.dark ? mix(P.paper, P.rockLo, 0.65) : mix(P.paper2, P.lantern, 0.06)
  g.fillStyle = wall
  g.fillRect(0, 0, W, bb)
  const bwid = wide ? 64 : 34
  for (let x = -r() * bwid; x < W; x += bwid) {
    g.fillStyle = rgba(r() < 0.5 ? P.umbra : P.rockMid, 0.04 + r() * 0.08)
    g.fillRect(x, 0, bwid - 2, bb)
    g.strokeStyle = rgba(P.umbra, 0.08)
    g.lineWidth = 0.8
    for (let k = 0; k < 2; k++) {
      const gx = x + bwid * (0.25 + r() * 0.5)
      g.beginPath()
      g.moveTo(gx, 0)
      g.bezierCurveTo(gx + 3, bb * 0.3, gx - 3, bb * 0.6, gx + 1, bb)
      g.stroke()
    }
    g.fillStyle = rgba(P.umbra, P.dark ? 0.45 : 0.16)
    g.fillRect(x + bwid - 2, 0, 1.6, bb)
  }
  const shadeTop = g.createLinearGradient(0, 0, 0, bb)
  shadeTop.addColorStop(0, rgba(P.umbra, P.dark ? 0.35 : 0.14))
  shadeTop.addColorStop(0.6, rgba(P.umbra, 0))
  g.fillStyle = shadeTop
  g.fillRect(0, 0, W, bb)
  // the beam the lamp hangs from, held by two brackets to the wall
  const [rx0, rx1, ry] = o.rail
  g.fillStyle = mix(Wd.lo, P.wash, P.dark ? 0.6 : 0.4)
  g.fillRect(rx0 - 24, ry - 4, rx1 - rx0 + 48, 7)
  for (const x of [rx0 - 12, rx1 + 12]) {
    g.beginPath()
    g.moveTo(x - 5, ry + 3)
    g.lineTo(x + 5, ry + 3)
    g.lineTo(x, ry + 16)
    g.closePath()
    g.fill()
  }
  g.fillStyle = rgba(P.lantern, 0.35)
  g.fillRect(rx0 - 24, ry + 3, rx1 - rx0 + 48, 1)
  yield
  // ── the door: the night outside — sky, moon, ranges, mist, the lake and the moon's road
  const [dx, dy, dw, dh] = o.door
  g.save()
  g.beginPath()
  g.rect(dx, dy, dw, dh)
  g.clip()
  const sky = g.createLinearGradient(0, dy, 0, dy + dh)
  sky.addColorStop(0, P.dark ? mix(P.paper, P.mist, 0.14) : mix(P.mist, P.water, 0.16))
  sky.addColorStop(0.6, P.dark ? mix(P.paper, P.mist, 0.34) : P.card)
  sky.addColorStop(1, P.dark ? mix(P.paper, P.water, 0.5) : mix(P.card, P.water, 0.35))
  g.fillStyle = sky
  g.fillRect(dx, dy, dw, dh)
  const mx = dx + dw * 0.22, my = dy + dh * 0.2, mr = Math.max(8, dw * 0.05)
  const halo = g.createRadialGradient(mx, my, mr, mx, my, mr * 7)
  halo.addColorStop(0, rgba(P.moon, P.dark ? 0.5 : 0.65))
  halo.addColorStop(1, rgba(P.moon, 0))
  g.fillStyle = halo
  g.fillRect(dx, dy, dw, dh)
  g.fillStyle = P.moon
  g.beginPath()
  g.arc(mx, my, mr, 0, TAU)
  g.fill()
  g.fillStyle = rgba(P.rockMid, 0.18)
  g.beginPath()
  g.arc(mx - mr * 0.3, my + mr * 0.15, mr * 0.35, 0, TAU)
  g.arc(mx + mr * 0.35, my - mr * 0.3, mr * 0.2, 0, TAU)
  g.fill()
  yield
  // two ranges, far and pale, near and darker, their feet in mist
  const horizon = dy + dh * 0.66
  for (const [k, a] of [[0.7, P.dark ? 0.35 : 0.2], [0.45, P.dark ? 0.62 : 0.34]] as const) {
    g.fillStyle = rgba(P.wash, a)
    g.beginPath()
    g.moveTo(dx, horizon)
    for (let x = 0; x <= dw; x += 5) g.lineTo(dx + x, horizon - dh * (0.08 + 0.18 * k) * (0.5 + 0.5 * Math.sin(x * 0.018 * (1 + k) + k * 9) * Math.sin(x * 0.007 + k)))
    g.lineTo(dx + dw, horizon)
    g.closePath()
    g.fill()
  }
  const mist = g.createLinearGradient(0, horizon - dh * 0.12, 0, horizon + dh * 0.04)
  mist.addColorStop(0, rgba(P.mist, 0))
  mist.addColorStop(1, rgba(P.mist, P.dark ? 0.35 : 0.85))
  g.fillStyle = mist
  g.fillRect(dx, horizon - dh * 0.12, dw, dh * 0.16)
  // the lake: always darker than the sky above it, the moon's road broken on it
  g.fillStyle = P.dark ? mix(P.water, P.paper, 0.25) : mix(P.water, P.wash, 0.12)
  g.fillRect(dx, horizon, dw, dy + dh - horizon)
  for (let y = horizon + 3; y < dy + dh; y += 4) {
    const t = (y - horizon) / (dy + dh - horizon)
    const len = 4 + t * dw * 0.12 * (0.3 + r())
    g.fillStyle = rgba(P.moon, (P.dark ? 0.55 : 0.6) * (1 - t * 0.5))
    g.fillRect(mx - len / 2 + (r() - 0.5) * t * 30, y, len, 1)
  }
  g.restore()
  yield
  // the door frame: posts, a heavy lintel, a shoji leaf slid half across on the right, glowing with the night
  const fw = wide ? Math.max(10, dw * 0.035) : 7
  const post = mix(Wd.lo, P.wash, P.dark ? 0.62 : 0.45)
  g.fillStyle = post
  g.fillRect(dx - fw, dy - fw, fw, dh + fw)
  g.fillRect(dx + dw, dy - fw, fw, dh + fw)
  g.fillRect(dx - fw * 1.8, dy - fw * 1.7, dw + fw * 3.6, fw * 1.5)
  g.fillStyle = rgba(P.moon, P.dark ? 0.4 : 0.55)
  g.fillRect(dx - fw * 0.3, dy, 1.2, dh)
  g.fillRect(dx - fw * 1.8, dy - fw * 0.2, dw + fw * 3.6, 1)
  const sx0 = dx + dw * 0.7
  g.fillStyle = rgba(P.dark ? mix(P.mist, P.paper, 0.6) : P.card, P.dark ? 0.55 : 0.75)
  g.fillRect(sx0, dy, dw * 0.3, dh)
  g.strokeStyle = rgba(post, 0.95)
  g.lineWidth = 2
  g.beginPath()
  for (let k = 1; k < 3; k++) g.moveTo(sx0 + (dw * 0.3 * k) / 3, dy), g.lineTo(sx0 + (dw * 0.3 * k) / 3, dy + dh)
  for (let k = 1; k < 6; k++) g.moveTo(sx0, dy + (dh * k) / 6), g.lineTo(dx + dw, dy + (dh * k) / 6)
  g.stroke()
  g.fillStyle = post
  g.fillRect(sx0 - 2, dy, 4, dh)
  yield
  // ── left of the door: a rack of chisels and a saw on the wall, boards leaning in the corner — the lamp catches them
  const tool = mix(Wd.lo, P.wash, P.dark ? 0.35 : 0.2)
  const steel = P.dark ? mix(P.rockHi, P.moon, 0.2) : P.rockLo
  if (wide) {
    const kx = W * 0.24, ky = bb * 0.2, kw = W * 0.22
    g.fillStyle = tool
    g.fillRect(kx, ky, kw, 8)
    g.fillStyle = rgba(P.lantern, 0.4)
    g.fillRect(kx, ky, kw, 1.2)
    for (let i = 0; i < 6; i++) {
      const x = kx + kw * (0.07 + i * 0.1), len = bb * (0.13 + (i % 3) * 0.025)
      g.fillStyle = mix(Wd.mid, P.wash, 0.25)
      g.beginPath()
      g.roundRect(x - 4, ky - len * 0.42, 8, len * 0.5, 3)
      g.fill()
      g.fillStyle = steel
      g.fillRect(x - 1.8, ky + 6, 3.6, len * 0.55)
      g.fillStyle = rgba(P.umbra, 0.25)
      g.fillRect(x + 3, ky + 8, 2.5, len * 0.5)
    }
    // the saw, hung by its handle from a peg: a long blade with its teeth
    const sx = kx + kw * 0.72, sy = ky + 22
    g.fillStyle = tool
    g.beginPath()
    g.arc(sx - kw * 0.05, sy + 2, 3, 0, TAU)
    g.fill()
    g.fillStyle = steel
    g.beginPath()
    g.moveTo(sx, sy)
    g.lineTo(sx + kw * 0.26, sy + bb * 0.06)
    g.lineTo(sx + kw * 0.26, sy + bb * 0.13)
    g.lineTo(sx, sy + bb * 0.09)
    g.closePath()
    g.fill()
    g.strokeStyle = rgba(P.umbra, 0.45)
    g.lineWidth = 0.8
    g.beginPath()
    for (let k = 0; k <= 16; k++) {
      const t = k / 16
      g.lineTo(sx + kw * 0.26 * t, sy + bb * 0.09 + bb * 0.04 * t + (k % 2) * 2)
    }
    g.stroke()
    g.fillStyle = tool
    g.fillRect(sx - kw * 0.11, sy, kw * 0.12, 7)
  }
  // boards leaning in the corner by the door, on the bench
  for (const [x, wdt, tilt] of (wide ? [[W * 0.43, W * 0.03, -0.08], [W * 0.462, W * 0.026, -0.05]] : [[W * 0.36, W * 0.035, -0.06]]) as [number, number, number][]) {
    const topY = bb * 0.12
    g.fillStyle = mix(Wd.mid, P.wash, P.dark ? 0.45 : 0.22)
    g.beginPath()
    g.moveTo(x, bb)
    g.lineTo(x + wdt, bb)
    g.lineTo(x + wdt + tilt * bb, topY)
    g.lineTo(x + tilt * bb, topY)
    g.closePath()
    g.fill()
    g.strokeStyle = rgba(P.umbra, 0.18)
    g.lineWidth = 0.7
    for (let k = 1; k < 4; k++) {
      const f = k / 4
      g.beginPath()
      g.moveTo(x + wdt * f, bb)
      g.lineTo(x + wdt * f + tilt * bb, topY)
      g.stroke()
    }
    g.fillStyle = rgba(P.lantern, P.dark ? 0.22 : 0.3)
    g.fillRect(x + tilt * bb, topY, wdt, 2)
  }
  yield
  // ── the bench top: planks running across, nearer ones wider; the door's light lies across it toward us
  const top = g.createLinearGradient(0, bb, 0, bf)
  top.addColorStop(0, mix(Wd.mid, P.wash, P.dark ? 0.58 : 0.3))
  top.addColorStop(1, mix(Wd.mid, P.wash, P.dark ? 0.42 : 0.16))
  g.fillStyle = top
  g.fillRect(0, bb, W, bf - bb)
  let y = bb
  for (let k = 0; k < 6; k++) {
    const t = (k + 1) / 6
    const ny = bb + (bf - bb) * (t * t * 0.55 + t * 0.45)
    g.fillStyle = rgba(r() < 0.5 ? P.umbra : P.lantern, 0.04 + r() * 0.05)
    g.fillRect(0, y, W, ny - y)
    g.strokeStyle = rgba(mix(Wd.lo, P.wash, 0.5), 0.2)
    g.lineWidth = 0.7
    for (let q = 0; q < 3; q++) {
      const gy = y + (ny - y) * (0.2 + r() * 0.6), x0 = r() * W * 0.6
      g.beginPath()
      g.moveTo(x0, gy)
      g.bezierCurveTo(x0 + W * 0.15, gy + (r() - 0.5) * 3, x0 + W * 0.3, gy + (r() - 0.5) * 3, x0 + W * (0.4 + r() * 0.3), gy)
      g.stroke()
    }
    if (k < 5) {
      g.fillStyle = rgba(P.umbra, P.dark ? 0.5 : 0.22)
      g.fillRect(0, ny - 0.6, W, 1.2)
    }
    y = ny
  }
  // the wall meets the bench: a soft contact shadow, a moonlit lip from the door
  const cs = g.createLinearGradient(0, bb, 0, bb + (bf - bb) * 0.12)
  cs.addColorStop(0, rgba(P.umbra, P.dark ? 0.5 : 0.22))
  cs.addColorStop(1, rgba(P.umbra, 0))
  g.fillStyle = cs
  g.fillRect(0, bb, W, (bf - bb) * 0.12)
  g.fillStyle = rgba(P.moon, P.dark ? 0.14 : 0.3)
  g.beginPath()
  g.moveTo(dx, bb)
  g.lineTo(dx + dw, bb)
  g.lineTo(dx + dw * 1.15, bf)
  g.lineTo(dx - dw * 0.15, bf)
  g.closePath()
  g.fill()
  // the board's foot rests on the bench: its contact shadow, thrown away from the lamp
  const [kbx, , kbw] = o.board
  g.fillStyle = rgba(P.umbra, P.dark ? 0.55 : 0.28)
  g.beginPath()
  g.ellipse(kbx + kbw * 0.55, bb + 3, kbw * 0.58, (bf - bb) * 0.035, 0, 0, TAU)
  g.fill()
  // the mallet's shadow and the scroll's lie with the objects themselves (SVG)
  yield
  // ── the checkpoint tray on the front edge: a thick plank with six round hollows cut in its top
  const [tx0, tx1, ty0, ty1] = o.tray
  const th = ty1 - ty0, tTop = th * 0.48
  g.fillStyle = rgba(P.umbra, P.dark ? 0.6 : 0.3)
  g.beginPath()
  g.ellipse((tx0 + tx1) / 2 + 8, ty1 + 2, (tx1 - tx0) * 0.53, th * 0.16, 0, 0, TAU)
  g.fill()
  // its top face, then the front face in its own shade, the lamp on the near lip
  g.fillStyle = mix(Wd.mid, P.wash, P.dark ? 0.32 : 0.08)
  g.beginPath()
  g.moveTo(tx0 + th * 0.18, ty0)
  g.lineTo(tx1 - th * 0.18, ty0)
  g.lineTo(tx1, ty0 + tTop)
  g.lineTo(tx0, ty0 + tTop)
  g.closePath()
  g.fill()
  const tf = g.createLinearGradient(0, ty0 + tTop, 0, ty1)
  tf.addColorStop(0, mix(Wd.lo, P.wash, P.dark ? 0.42 : 0.18))
  tf.addColorStop(1, mix(Wd.lo, P.wash, P.dark ? 0.62 : 0.36))
  g.fillStyle = tf
  g.fillRect(tx0, ty0 + tTop, tx1 - tx0, th - tTop)
  g.strokeStyle = rgba(mix(Wd.lo, P.wash, 0.6), 0.3)
  g.lineWidth = 0.7
  for (let k = 0; k < 3; k++) {
    const gy = ty0 + tTop + (th - tTop) * (0.25 + k * 0.25)
    g.beginPath()
    g.moveTo(tx0 + 4, gy)
    g.bezierCurveTo(tx0 + (tx1 - tx0) * 0.3, gy + (r() - 0.5) * 2, tx0 + (tx1 - tx0) * 0.7, gy + (r() - 0.5) * 2, tx1 - 4, gy)
    g.stroke()
  }
  g.fillStyle = rgba(P.lantern, P.dark ? 0.45 : 0.55)
  g.fillRect(tx0, ty0 + tTop - 0.6, tx1 - tx0, 1.2)
  g.fillStyle = rgba(P.moon, P.dark ? 0.35 : 0.5)
  g.fillRect(tx0 + th * 0.18, ty0, tx1 - tx0 - th * 0.36, 0.8)
  // the hollows: dark inside, the far wall lit, the near lip in shade
  const hr = Math.min(((tx1 - tx0) / N) * 0.34, th * 1.1)
  for (const [hx, hy] of o.hollows) {
    g.fillStyle = mix(Wd.lo, P.umbra, P.dark ? 0.55 : 0.4)
    g.beginPath()
    g.ellipse(hx, hy + tTop * 0.12, hr, tTop * 0.36, 0, 0, TAU)
    g.fill()
    g.fillStyle = rgba(mix(Wd.hi, P.lantern, 0.3), P.dark ? 0.5 : 0.6)
    g.beginPath()
    g.ellipse(hx, hy + tTop * 0.12, hr, tTop * 0.36, 0, Math.PI * 1.08, Math.PI * 1.92)
    g.ellipse(hx, hy + tTop * 0.02, hr * 0.92, tTop * 0.28, 0, Math.PI * 1.92, Math.PI * 1.08, true)
    g.fill()
  }
  yield
  // ── the bench's front edge, the near layer: a thick beam cut by the frame, lit along its top
  const beam = g.createLinearGradient(0, bf, 0, be)
  beam.addColorStop(0, mix(Wd.mid, P.wash, P.dark ? 0.35 : 0.1))
  beam.addColorStop(1, mix(Wd.lo, P.wash, P.dark ? 0.55 : 0.32))
  g.fillStyle = beam
  g.fillRect(0, bf, W, be - bf)
  g.strokeStyle = rgba(mix(Wd.lo, P.wash, 0.5), 0.28)
  g.lineWidth = 0.8
  for (let k = 0; k < 7; k++) {
    const gy = bf + (be - bf) * (0.15 + k * 0.12)
    g.beginPath()
    g.moveTo(0, gy)
    for (let x = 0; x <= W; x += 40) g.lineTo(x, gy + Math.sin(x * 0.01 + k * 2) * 2)
    g.stroke()
  }
  g.fillStyle = rgba(P.lantern, P.dark ? 0.55 : 0.6)
  g.fillRect(0, bf, W, 1.6)
  const under = g.createLinearGradient(0, be, 0, A)
  under.addColorStop(0, rgba(P.umbra, P.dark ? 0.8 : 0.35))
  under.addColorStop(1, rgba(P.umbra, 0))
  g.fillStyle = under
  g.fillRect(0, be, W, A - be)
  cv.width = off.width
  cv.height = off.height
  cv.getContext('2d')!.drawImage(off, 0, 0)
}
