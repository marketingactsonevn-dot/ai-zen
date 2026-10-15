import { h, nextId, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { DEMOS, idleDemo, SH, SW, type Demo } from './demos'
import { createLoop } from '../../core/loop'
import { brush, C, path, pebble, rng, stableHeight, watchSize, type Pt } from './kit'

const K = C.scenes.concepts

/** Scene 3 — seven concept stones; each plays a tiny ink demo on the paper screen. */
export function conceptsScene(ctx: SceneCtx) {
  const root = h('div', { class: 't08 t08c' })
  const clipId = nextId('t08c')
  const stage = s('g', { 'clip-path': `url(#${clipId})` })
  const frame = s('g')
  const screen = s('svg', { class: 't08c-screen', viewBox: `-8 -8 ${SW + 16} ${SH + 16}`, role: 'img', 'aria-label': K.screen },
    s('defs', null, s('clipPath', { id: clipId }, s('rect', { width: SW, height: SH, rx: 8 }))),
    s('rect', { class: 'card', width: SW, height: SH, rx: 8 }),
    stage, frame)
  // the screen's frame: four brush strokes that overlap at the corners, like a mounted painting
  const r = rng(4)
  const side = (a: Pt, b: Pt, w: number) => path(brush([a, [(a[0] + b[0]) / 2 + (r() - 0.5), (a[1] + b[1]) / 2 + (r() - 0.5)], b], w, { a: 0.03, b: 0.08, min: 0.55 }), 'k2', { filter: ctx.quality === 'low' ? null : 'url(#ink-rough)' })
  frame.append(side([-2, 0], [SW + 2, 0.3], 1.5), side([SW, -1], [SW - 0.3, SH + 1.5], 1.3), side([SW + 2, SH], [-1, SH - 0.3], 1.8), side([0, SH + 1], [0.3, -1.5], 1.3))
  const title = h('p', { class: 't08c-title' })
  const term = h('span', { class: 't08c-term' })
  const cap = h('div', { class: 't08c-cap' })
  const caption = h('div', { class: 't08c-caption', 'aria-live': 'polite' }, h('div', { class: 't08c-head' }, title, term), cap)
  const seen = new Set<number>()
  const names = K.items.map((it) => h('span', { class: 't08c-name' }, it.name))
  const pebs = K.items.map(() => s('svg', { class: 't08c-peb', 'aria-hidden': 'true' }))
  const stones = K.items.map((_, i) => h('button', { class: 't08c-stone', type: 'button', 'aria-pressed': 'false', onClick: () => select(i) }, pebs[i], names[i]))
  const group = h('div', { class: 't08c-stones', role: 'group', 'aria-label': K.group }, ...stones)
  const side2 = h('div', { class: 't08c-side' }, caption, group)
  root.append(h('div', { class: 't08c-screenwrap' }, screen), side2)
  ctx.art.append(root)
  ctx.prompt(K.prompt)
  const stable = stableHeight(ctx, [[K.insight, K.detail]])

  let demo: Demo = idleDemo()
  stage.append(demo.root)
  demo.update(ctx.reduced ? demo.still : 0)
  let t0 = performance.now()
  let sel = -1

  function select(i: number) {
    if (i === sel) return
    sel = i
    const it = K.items[i]
    stones.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)))
    stones[i].classList.add('seen')
    seen.add(i)
    const old = demo.root
    demo = DEMOS[it.id](it.words)
    stage.append(demo.root)
    t0 = performance.now()
    demo.update(ctx.reduced ? demo.still : 0)
    title.textContent = it.name
    term.textContent = it.term
    cap.replaceChildren(ctx.fact(it.caption, 'p'))
    ctx.chime('soft')
    ctx.anim(() => {
      if (ctx.reduced) old.remove()
      else {
        gsap.to(old, { opacity: 0, duration: 0.45, ease: 'power2.out', onComplete: () => old.remove() })
        gsap.fromTo(demo.root, { opacity: 0 }, { opacity: 1, duration: 0.9, ease: 'power2.out', delay: 0.15 })
        gsap.fromTo(caption.children, { opacity: 0, y: 8, filter: 'blur(4px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.9, stagger: 0.12, ease: 'power3.out', clearProps: 'filter' })
      }
    })
    if (seen.size === 4) ctx.insight(K.insight, K.detail)
  }

  // the demo plays while the screen is in view; reduced motion keeps its still frame
  const play = createLoop(screen, () => demo.update((performance.now() - t0) / 1000))
  if (!ctx.reduced) play.start()

  // ───────── stepping stones: each pebble sized to its word, drawn at its real size ─────────
  // three or four sizes, a zigzag path when there is height, else two staggered rows (4 + 3)
  const SIZES = [1.06, 0.9, 1.12, 0.95, 0.84, 1.02, 0.9]
  const ZX = [0.27, 0.7, 0.33, 0.75, 0.25, 0.66, 0.4]
  function drawPebble(i: number, bw: number, bh: number) {
    const r = rng(31 + i * 7)
    const cx = bw / 2
    const cy = bh / 2
    const rx = bw / 2 - 2
    const ry = bh / 2 - 3
    pebs[i].setAttribute('viewBox', `0 0 ${bw} ${bh}`)
    pebs[i].replaceChildren(
      path(pebble(cx + 3, cy + 4, rx, ry * 0.96, r, 0.07), 'sh', { 'fill-opacity': 0.12, filter: ctx.quality === 'low' ? null : 'url(#ink-wash)' }),
      path(pebble(cx, cy, rx, ry, r, 0.07), 'peb'),
      path(brush([[cx - rx * 0.72, cy + ry * 0.5], [cx, cy + ry * 0.86], [cx + rx * 0.74, cy + ry * 0.42]], Math.max(2, bh * 0.05), { a: 0.3, b: 0.3, min: 0.2 }), 'sh', { 'fill-opacity': 0.16 }),
      path(brush([[cx - rx * 0.6, cy - ry * 0.5], [cx - rx * 0.1, cy - ry * 0.8], [cx + rx * 0.3, cy - ry * 0.76]], Math.max(1.6, bh * 0.04), { a: 0.3, b: 0.4, min: 0.2 }), 'rim'))
  }
  function placeStones(CW: number, AH: number, zig: boolean) {
    const r = rng(77)
    const slot = CW / 4
    const dims = stones.map((b, i) => {
      const k = SIZES[i]
      const nm = names[i]
      // names stay on one line on the path, two at most in rows
      nm.style.maxWidth = zig ? 'none' : `${Math.max(48, slot - 8)}px`
      const bw = Math.min(zig ? CW * 0.62 : slot - 2, nm.offsetWidth + (zig ? 30 : 16) * k + 8)
      const bh = Math.max(46, nm.offsetHeight + (zig ? 22 : 16) * k + 8)
      Object.assign(b.style, { width: `${Math.round(bw)}px`, height: `${Math.round(bh)}px` })
      drawPebble(i, Math.round(bw), Math.round(bh))
      return { bw, bh }
    })
    let total: number
    const pos: Pt[] = []
    if (zig) {
      total = AH
      const top = dims[0].bh / 2 + 4
      const bot = AH - dims[6].bh / 2 - 6
      dims.forEach(({ bw }, i) => {
        const x = Math.min(CW - bw / 2 - 2, Math.max(bw / 2 + 2, ZX[i] * CW))
        pos.push([x, top + ((bot - top) * i) / 6 + (r() - 0.5) * 6])
      })
    } else {
      const h1 = Math.max(...dims.slice(0, 4).map((d) => d.bh))
      const h2 = Math.max(...dims.slice(4).map((d) => d.bh))
      const gy = 4
      total = h1 + gy + h2 + 4
      dims.forEach((_, i) => pos.push(i < 4 ? [(i + 0.5) * slot, h1 / 2 + (r() - 0.5) * 5] : [(i - 4 + 1) * slot, h1 + gy + h2 / 2 + (r() - 0.5) * 5]))
    }
    stones.forEach((b, i) => Object.assign(b.style, { left: `${pos[i][0] - dims[i].bw / 2}px`, top: `${pos[i][1] - dims[i].bh / 2}px` }))
    group.style.height = `${Math.ceil(total)}px`
    return total
  }

  // ───────── layout: screen beside the stones when wide, above them when tall ─────────
  function layout(W: number, Hh: number) {
    const H = stable.H(Hh)
    root.style.height = `${H}px`
    const wide = W / H > 1.3
    root.classList.toggle('tall', !wide)
    root.classList.toggle('short', H < 330)
    const gap = Math.max(14, Math.min(40, W * 0.03))
    root.style.setProperty('--gap', `${gap}px`)
    const ratio = (SW + 16) / (SH + 16)
    const zig = wide && H >= 340
    root.classList.toggle('zig', zig)
    if (wide) {
      const sw = Math.min(W * 0.6, H * ratio, 820)
      const side = Math.floor(Math.min(W - sw - gap, 440))
      root.style.setProperty('--sw', `${Math.floor(sw)}px`)
      root.style.setProperty('--side', `${side}px`)
      const capH = caption.offsetHeight
      // the side column (caption + path) is about as tall as the screen, centred beside it;
      // a fixed breath above the insight: the path ends 12 px before the art does
      const AH = Math.min(H - capH - 18 - 12, Math.max(300, sw / ratio - capH + 16), 420)
      placeStones(side, Math.max(150, AH), zig)
    } else {
      const side = Math.floor(Math.min(W, 560))
      root.style.setProperty('--side', `${side}px`)
      const sh = placeStones(side, 0, false)
      const capH = caption.offsetHeight
      const sw = Math.min(W, (H - sh - capH - 10 * 2 - 12) * ratio, 640)
      root.style.setProperty('--sw', `${Math.floor(Math.max(180, sw))}px`)
    }
  }
  const unwatch = watchSize(ctx.art, layout)
  layout(ctx.art.clientWidth, ctx.art.clientHeight)
  stable.afterFonts(() => layout(ctx.art.clientWidth, ctx.art.clientHeight))

  if (!ctx.reduced) {
    gsap.from(screen, { opacity: 0, y: 14, filter: 'blur(6px)', duration: 1.3, ease: 'power3.out', delay: 0.15, clearProps: 'filter' })
    gsap.from(stones, { opacity: 0, y: 16, duration: 1, stagger: 0.07, ease: 'power3.out', delay: 0.45 })
  }

  return () => {
    play.dispose()
    unwatch()
  }
}
