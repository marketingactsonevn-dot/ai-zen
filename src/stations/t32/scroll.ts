import raw from '../../content/tram-32.json'
import { fill, h } from '../../core/dom'
import type { Fact } from '../../core/content'
import { sliced } from '../../core/chunk'
import { onPrefs } from '../../core/prefs'
import { codeScroll } from '../../ui/part2/code'
import { curve, rng, type Pt } from '../../ui/part2/ink'
import type { CodeScroll } from '../../ui/part2/types'
import type { SceneCtx } from '../types'
import { brush, cardSheet, clamp, fit, grainOver, mix, palette, rgba, stageSize, type Pal } from './kit'

const K = raw.scenes.scroll

/**
 * Scene 5 — the tokonoma: a hanging scroll in the alcove, seen straight on, a small oil lamp on the floor board lighting
 * it from below (the warmth climbs the plaster; the scroll's shadow falls above it). Pull the heavy lower rod down and
 * the paper unrolls the four commands, block by block; let go halfway and the rod springs back a little. Hover a line and
 * the flame leans toward it. 2.5D: the alcove painted once on a canvas, the scroll a DOM layer (clip + transform only).
 */
export function scrollScene(ctx: SceneCtx) {
  const still = ctx.quality === 'low' || ctx.reduced
  const blocks = K.code.notes.length
  // 0 rolled … 1 fully open: it hangs with its first command showing (low quality: hung open already)
  let open = ctx.quality === 'low' ? 1 : 1 / blocks
  let done = false

  const cv = h('canvas', { class: 't32-cv t32-bleed', 'aria-hidden': 'true' })
  const code = codeScroll(K.code as CodeScroll)
  // the mounting: silk frame (chūmawashi) round the paper, gold bands (ichimonji) above and below it, the lower silk (chi)
  const paper = h('div', { class: 't32x-paper' }, h('div', { class: 't32x-frame' }, h('i', { class: 't32x-ichi', 'aria-hidden': 'true' }), code, h('i', { class: 't32x-ichi', 'aria-hidden': 'true' })), h('i', { class: 't32x-chi', 'aria-hidden': 'true' }))
  const roll = h('div', { class: 't32x-roll', 'aria-hidden': 'true' })
  const rod = h('div', { class: 't32x-rod', role: 'slider', tabindex: '0', 'aria-label': K.rodAria, 'aria-valuemin': '0', 'aria-valuemax': String(blocks) },
    h('span', { class: 't32x-knob', 'aria-hidden': 'true' }), h('span', { class: 't32x-knob t32x-knob-r', 'aria-hidden': 'true' }), h('span', { class: 't32x-tassel', 'aria-hidden': 'true' }))
  // the upper silk (ten) with its two hanging strips (fūtai), under the top rod
  const ten = h('div', { class: 't32x-ten', 'aria-hidden': 'true' }, h('i', { class: 't32x-futai' }), h('i', { class: 't32x-futai t32x-futai-r' }))
  const hang = h('div', { class: 't32x-hang' }, h('span', { class: 't32x-cord', 'aria-hidden': 'true' }), ten, h('span', { class: 't32x-top', 'aria-hidden': 'true' }), paper, roll, rod)
  const flame = h('div', { class: 't32x-flame', 'aria-hidden': 'true' }, h('i'))
  const note = h('p', { class: 't32-paper t32x-note', hidden: true }, K.modelNote)
  const root = h('div', { class: `t32 t32x${still ? ' still' : ''}`, role: 'group', 'aria-label': K.aria },
    cv,
    h('div', { class: 't32-mist', 'aria-hidden': 'true' }),
    h('p', { class: 'visually-hidden' }, K.art),
    flame, hang, note)
  ctx.art.append(root)
  const sheet = cardSheet(root, K.takeaway, ctx.onCleanup)

  let W = 0, H = 0, tall = false
  let full = 0 // the paper's full open height, px
  let P: Pal = palette()
  let lamp: Pt = [0, 0] // the flame's foot, px

  /** show `open` (0…1): the paper clipped from below, the roll and the rod riding its lower edge */
  function show(glide = true) {
    const y = full * open
    paper.style.clipPath = `inset(0 0 ${(full - y).toFixed(1)}px 0)`
    roll.style.transform = rod.style.transform = `translateY(${y.toFixed(1)}px)`
    hang.classList.toggle('glide', glide && !still)
    const n = Math.round(open * blocks)
    rod.setAttribute('aria-valuenow', String(n))
    rod.setAttribute('aria-valuetext', fill(K.rodValue, { n, total: blocks }))
    if (open >= 0.999 && !done) finish()
  }
  function finish() {
    done = true
    root.classList.add('open')
    // the model-name caveat: a slip beside the scroll (wide), or under the insight's "more" (a phone has no room)
    note.hidden = tall
    ctx.chime('soft')
    ctx.insight(K.insight as Fact, tall ? [K.detail as Fact, K.modelNote] : (K.detail as Fact))
    sheet.show()
  }
  const notch = (d: number) => {
    open = clamp(Math.round(open * blocks + d) / blocks, 0, 1)
    show()
  }

  rod.addEventListener('keydown', (e) => {
    const k = e.key
    if (k === 'ArrowDown' || k === 'ArrowRight' || k === 'Enter' || k === ' ') notch(1)
    else if (k === 'ArrowUp' || k === 'ArrowLeft') notch(-1)
    else if (k === 'End') (open = 1), show()
    else if (k === 'Home') (open = 0), show()
    else return
    e.preventDefault()
  })
  // pull the rod: the paper follows the hand; let go between notches and the heavy rod springs back to the last one
  let pulled = false
  rod.addEventListener('pointerdown', (e) => {
    if (e.button) return
    const y0 = e.clientY, o0 = open
    pulled = false
    rod.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientY - y0) > 4) pulled = true
      open = clamp(o0 + (ev.clientY - y0) / Math.max(1, full), 0, 1)
      show(false)
    }
    const up = () => {
      rod.removeEventListener('pointermove', move)
      rod.removeEventListener('pointerup', up)
      rod.removeEventListener('pointercancel', up)
      if (open < 0.97) open = Math.floor(open * blocks + 0.15) / blocks
      else open = 1
      show()
    }
    rod.addEventListener('pointermove', move)
    rod.addEventListener('pointerup', up)
    rod.addEventListener('pointercancel', up)
  })
  rod.addEventListener('click', () => !pulled && open < 1 && notch(1)) // a tap opens one more section
  // the flame leans toward the line under the hand (or the focus)
  const lean = (e: Event) => {
    const t = (e.target as Element).closest?.('.p2x-line, .p2x-block')
    if (!t) return
    const r = t.getBoundingClientRect(), b = root.getBoundingClientRect()
    const dx = r.left + r.width / 2 - b.left - lamp[0]
    flame.style.setProperty('--lean', `${clamp(dx / W, -0.5, 0.5) * 24}deg`)
  }
  paper.addEventListener('pointerover', lean)
  paper.addEventListener('focusin', lean)
  paper.addEventListener('pointerleave', () => flame.style.setProperty('--lean', '0deg'))

  // ── the alcove, painted once per size / theme ──
  function* paint(c: CanvasRenderingContext2D, sx: number, sw: number, top: number) {
    c.clearRect(0, 0, W, H)
    const floorY = H * (tall ? 0.76 : 0.82)
    const px = tall ? W * 0.04 : W * 0.12, pw = tall ? W * 0.07 : W * 0.042 // the post (toko-bashira)
    const rx = tall ? W * 0.97 : W * 0.86 // the alcove's right side wall
    // plaster: a night wall, warm where the lamp below reaches, cooler and darker toward the lintel
    const wall = P.dark ? mix(P.paper, P['paper-2'], 0.7) : mix(P['paper-2'], P.wash, 0.08)
    c.fillStyle = rgba(wall)
    c.fillRect(0, 0, W, floorY)
    const up = c.createLinearGradient(0, floorY, 0, 0)
    up.addColorStop(0, rgba(P.lantern, P.dark ? 0.42 : 0.16))
    up.addColorStop(0.5, rgba(P.lantern, P.dark ? 0.12 : 0.04))
    up.addColorStop(1, rgba(P.umbra, P.dark ? 0.5 : 0.14))
    c.fillStyle = up
    c.fillRect(0, 0, W, floorY)
    // the lamp's own light: a tall fan climbing the plaster above it
    c.save()
    c.translate(lamp[0], lamp[1])
    c.scale(1, 1.7)
    const pool = c.createRadialGradient(0, 0, 0, 0, 0, H * 0.5)
    pool.addColorStop(0, rgba(P.lantern, P.dark ? 0.55 : 0.26))
    pool.addColorStop(0.4, rgba(P.lantern, P.dark ? 0.2 : 0.08))
    pool.addColorStop(1, rgba(P.lantern, 0))
    c.fillStyle = pool
    c.fillRect(-W, -H, W * 2, H * 2)
    c.restore()
    // trowel marks in the plaster
    const r = rng(3501)
    c.fillStyle = rgba(P.dark ? P.umbra : P.wash, P.dark ? 0.12 : 0.04)
    for (let i = 0; i < 46; i++) {
      const x = r() * W, y = r() * floorY, l = 40 + r() * 140
      c.fill(brush([[x, y], [x + l * 0.5, y - 2 + r() * 4], [x + l, y + (r() - 0.5) * 3]], 6 + r() * 10, 0.4, 0.4, 0.05))
    }
    grainOver(c, W, H, P.dark ? 0.5 : 0.4)
    yield
    // the rolled top's soft shadow on the plaster just above it (the open scroll's shadow is the hang's own drop shadow)
    c.save()
    c.translate(sx + sw / 2, top - H * 0.09)
    c.scale(1, 0.22)
    const sh = c.createRadialGradient(0, 0, sw * 0.1, 0, 0, sw * 0.62)
    sh.addColorStop(0, rgba(P.umbra, P.dark ? 0.35 : 0.12))
    sh.addColorStop(1, rgba(P.umbra, 0))
    c.fillStyle = sh
    c.fillRect(-sw, -sw, sw * 2, sw * 2)
    c.restore()
    // the alcove's right side wall, turning away into shade
    const side = c.createLinearGradient(rx, 0, W, 0)
    side.addColorStop(0, rgba(mix(wall, P.umbra, P.dark ? 0.45 : 0.18)))
    side.addColorStop(1, rgba(mix(wall, P.umbra, P.dark ? 0.7 : 0.32)))
    c.fillStyle = side
    c.beginPath()
    c.moveTo(rx, H * 0.06)
    c.lineTo(W, 0)
    c.lineTo(W, floorY + H * 0.1)
    c.lineTo(rx, floorY)
    c.closePath()
    c.fill()
    yield
    // the lintel (otoshigake) across the top: a plain beam with grain, its shadow on the plaster
    const wood = P.dark ? mix(mix(P['rock-lo'], P.lantern, 0.12), P.wash, 0.3) : mix(mix(P['rock-lo'], P.lantern, 0.18), P.ink, 0.35)
    const beam = c.createLinearGradient(0, 0, 0, H * 0.06)
    beam.addColorStop(0, rgba(mix(wood, P.umbra, 0.3)))
    beam.addColorStop(1, rgba(mix(wood, P.lantern, 0.12)))
    c.fillStyle = beam
    c.fillRect(0, 0, W, H * 0.06)
    c.fillStyle = rgba(P.umbra, P.dark ? 0.35 : 0.14)
    c.fillRect(0, H * 0.06, W, H * 0.018)
    c.strokeStyle = rgba(P.umbra, 0.25)
    c.lineWidth = 0.8
    c.beginPath()
    for (let i = 0; i < 4; i++) {
      const y = H * (0.012 + i * 0.012)
      c.moveTo(0, y)
      c.bezierCurveTo(W * 0.3, y + 2, W * 0.6, y - 2, W, y + 1)
    }
    c.stroke()
    // the post: a natural log with its bark left on, knots, a lit edge toward the lamp
    const bark = c.createLinearGradient(px - pw / 2, 0, px + pw / 2, 0)
    bark.addColorStop(0, rgba(mix(wood, P.umbra, 0.45)))
    bark.addColorStop(0.45, rgba(mix(wood, P['rock-mid'], 0.35)))
    bark.addColorStop(0.8, rgba(mix(wood, P.lantern, 0.3)))
    bark.addColorStop(1, rgba(mix(wood, P.umbra, 0.2)))
    c.fillStyle = bark
    c.fill(brush([[px, -10], [px + pw * 0.06, floorY * 0.5], [px - pw * 0.04, floorY + 6]], pw, 0.01, 0.01, 0.9))
    c.strokeStyle = rgba(P.dark ? P.umbra : P.ink, 0.35)
    c.lineWidth = 0.9
    c.beginPath()
    for (let k = 0; k < 7; k++) {
      const x = px - pw * 0.4 + (k / 6) * pw * 0.8
      c.moveTo(x, 0)
      for (let y = 0; y <= floorY; y += floorY / 12) c.lineTo(x + Math.sin(y * 0.02 + k * 1.7) * pw * 0.04, y)
    }
    c.stroke()
    c.fillStyle = rgba(P.dark ? P.umbra : P.ink, 0.45)
    for (let i = 0; i < 26; i++) {
      const y = r() * floorY, x = px - pw * 0.42 + r() * pw * 0.3
      c.fill(brush([[x, y], [x + pw * 0.2, y + 3 + r() * 6]], 1.2 + r() * 1.4, 0.2, 0.4, 0.2))
    }
    for (const ky of [0.28, 0.61]) {
      c.fillStyle = rgba(P.umbra, 0.5)
      c.beginPath(); c.ellipse(px + pw * 0.05, floorY * ky, pw * 0.12, pw * 0.2, 0, 0, Math.PI * 2); c.fill()
      c.strokeStyle = rgba(mix(wood, P.lantern, 0.4), 0.6)
      c.beginPath(); c.ellipse(px + pw * 0.05, floorY * ky, pw * 0.18, pw * 0.28, 0, 0, Math.PI * 2); c.stroke()
    }
    yield
    // the floor board (toko-ita): its top seen a little from above, grain running along it, the black lacquered front edge
    const bh = H * 0.065
    const board = c.createLinearGradient(0, floorY, 0, floorY + bh)
    board.addColorStop(0, rgba(mix(mix(P['rock-mid'], P.lantern, 0.3), P.umbra, P.dark ? 0.2 : 0)))
    board.addColorStop(1, rgba(mix(P['rock-mid'], P.umbra, 0.3)))
    c.fillStyle = board
    c.fillRect(0, floorY, W, bh)
    c.strokeStyle = rgba(P.umbra, 0.22)
    c.lineWidth = 0.8
    c.beginPath()
    for (let i = 0; i < 6; i++) {
      const y = floorY + bh * (0.12 + i * 0.15)
      c.moveTo(0, y)
      c.bezierCurveTo(W * 0.25, y + (r() - 0.5) * 3, W * 0.7, y + (r() - 0.5) * 3, W, y + (r() - 0.5) * 2)
    }
    c.stroke()
    const glow = c.createRadialGradient(lamp[0], floorY + bh * 0.4, 0, lamp[0], floorY + bh * 0.4, W * 0.3)
    glow.addColorStop(0, rgba(P.lantern, P.dark ? 0.45 : 0.25))
    glow.addColorStop(1, rgba(P.lantern, 0))
    c.fillStyle = glow
    c.fillRect(0, floorY, W, bh)
    c.fillStyle = rgba(P.dark ? P.umbra : P.ink, P.dark ? 0.9 : 0.82)
    c.fillRect(0, floorY + bh, W, H * 0.026)
    c.fillStyle = rgba(P.moon, 0.35)
    c.fillRect(0, floorY + bh, W, 1.2)
    yield
    // a slim vase with one flowering branch, beside the scroll (for scale)
    const vx = tall ? W * 0.93 : sx + sw + (rx - sx - sw) * 0.64, vh = H * (tall ? 0.055 : 0.2)
    const vw = vh * 0.32
    c.fillStyle = rgba(P.umbra, P.dark ? 0.5 : 0.25)
    c.beginPath(); c.ellipse(vx + vw * 0.3, floorY + bh * 0.35, vw * 0.9, bh * 0.16, 0, 0, Math.PI * 2); c.fill()
    const glaze = c.createLinearGradient(vx - vw / 2, 0, vx + vw / 2, 0)
    glaze.addColorStop(0, rgba(mix(P['moss-b'], P.umbra, 0.4)))
    glaze.addColorStop(0.35, rgba(mix(P['moss-c'], P.moon, 0.2)))
    glaze.addColorStop(1, rgba(mix(P['moss-b'], P.lantern, 0.35)))
    const vb = floorY + bh * 0.3
    c.fillStyle = glaze
    c.beginPath()
    c.moveTo(vx - vw * 0.18, vb - vh)
    c.quadraticCurveTo(vx - vw * 0.15, vb - vh * 0.6, vx - vw * 0.5, vb - vh * 0.3)
    c.quadraticCurveTo(vx - vw * 0.62, vb - vh * 0.05, vx - vw * 0.35, vb)
    c.lineTo(vx + vw * 0.35, vb)
    c.quadraticCurveTo(vx + vw * 0.62, vb - vh * 0.05, vx + vw * 0.5, vb - vh * 0.3)
    c.quadraticCurveTo(vx + vw * 0.15, vb - vh * 0.6, vx + vw * 0.18, vb - vh)
    c.closePath()
    c.fill()
    const ink = P.dark ? mix(P.wash, P['rock-lo'], 0.3) : P.ink
    c.fillStyle = rgba(ink, 0.9)
    const branch = curve([vx, vb - vh], [vx - vw * 0.4, vb - vh * 2.2], [vx - vw * 2.6, vb - vh * 2.6], 14)
    c.fill(brush(branch, Math.max(2, vw * 0.1), 0.05, 0.6, 0.2))
    c.fill(brush(curve(branch[6], [vx + vw * 0.5, vb - vh * 2.1], [vx + vw * 0.9, vb - vh * 2.5], 8), Math.max(1.4, vw * 0.06), 0.05, 0.7, 0.2))
    for (const [bx, by, br] of [[-1.6, -2.55, 1], [-0.9, -2.3, 0.8], [-2.3, -2.62, 0.7], [0.6, -2.38, 0.85], [-0.3, -2.05, 0.6], [0.85, -2.5, 0.55]] as const) {
      const x = vx + bx * vw, y = vb + by * vh, rr = vw * 0.17 * br
      c.fillStyle = rgba(mix(P.card, P.lantern, 0.3))
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + bx
        c.beginPath()
        c.arc(x + Math.cos(a) * rr * 0.6, y + Math.sin(a) * rr * 0.6, rr * 0.55, 0, Math.PI * 2)
        c.fill()
      }
      c.fillStyle = rgba(ink)
      c.beginPath()
      c.arc(x, y, rr * 0.22, 0, Math.PI * 2)
      c.fill()
    }
    yield
    // the lamp: a tall wooden stand (tōdai) on the floor board, a clay dish of oil on top; its flame is DOM (it leans)
    const lx = lamp[0], base = floorY + bh * 0.42, dy = lamp[1]
    c.fillStyle = rgba(P.umbra, P.dark ? 0.55 : 0.3)
    c.beginPath(); c.ellipse(lx + 6, base + 2, W * 0.03 + 12, bh * 0.14, 0, 0, Math.PI * 2); c.fill()
    const stand = c.createLinearGradient(lx - 6, 0, lx + 6, 0)
    stand.addColorStop(0, rgba(mix(wood, P.umbra, 0.3)))
    stand.addColorStop(0.6, rgba(mix(wood, P.lantern, 0.35)))
    stand.addColorStop(1, rgba(mix(wood, P.umbra, 0.2)))
    c.fillStyle = rgba(mix(wood, P.umbra, 0.15))
    c.beginPath(); c.ellipse(lx, base, 22, 6, 0, 0, Math.PI * 2); c.fill()
    c.fillStyle = stand
    c.fillRect(lx - 3.5, dy + 10, 7, base - dy - 10)
    c.fillStyle = rgba(mix(wood, P.lantern, 0.2))
    c.fillRect(lx - 14, dy + 8, 28, 4)
    const dish = c.createLinearGradient(lx - 22, 0, lx + 22, 0)
    dish.addColorStop(0, rgba(mix(P['rock-lo'], P.umbra, 0.4)))
    dish.addColorStop(0.5, rgba(mix(P['rock-mid'], P.lantern, 0.45)))
    dish.addColorStop(1, rgba(mix(P['rock-lo'], P.umbra, 0.3)))
    c.fillStyle = dish
    c.beginPath()
    c.moveTo(lx - 20, dy)
    c.quadraticCurveTo(lx, dy + 14, lx + 20, dy)
    c.closePath()
    c.fill()
    c.fillStyle = rgba(mix(P.lantern, P.umbra, 0.3))
    c.beginPath(); c.ellipse(lx, dy, 20, 3.5, 0, 0, Math.PI * 2); c.fill()
  }

  let job: { cancel(): void } | null = null
  let painted = false
  function layout(force = false) {
    const [w, hh] = stageSize(ctx)
    if (w < 40 || hh < 40) return
    if (!force && w === W && hh === H && painted) return
    W = w
    H = hh
    tall = W / H < 0.9
    root.classList.toggle('tall', tall)
    root.style.height = `${H}px`
    // a tall, narrow kakejiku: under half the width, its paper about 60 % of the height
    const sw = tall ? Math.min(W - 64, 330) : clamp(W * 0.3, 340, 420)
    const sx = (W - sw) / 2 + (tall ? 4 : 0)
    const tenH = H * (tall ? 0.05 : 0.065)
    const top = H * 0.1 + tenH
    full = H * (tall ? 0.555 : 0.64)
    Object.assign(hang.style, { left: `${sx}px`, top: `${top}px`, width: `${sw}px` })
    hang.style.setProperty('--ten', `${tenH.toFixed(1)}px`)
    paper.style.height = `${full}px`
    const floorY = H * (tall ? 0.76 : 0.82)
    // the lamp stands on the floor board left of the scroll (a phone: a low one under its corner)
    lamp = [tall ? W * 0.11 : sx - W * 0.09, floorY - H * (tall ? 0.04 : 0.22)]
    Object.assign(flame.style, { left: `${lamp[0]}px`, top: `${lamp[1] + 1}px` })
    Object.assign(note.style, tall ? { left: '12px', right: '12px', top: `${top + full + 34}px`, width: 'auto' } : { left: `${sx + sw + 34}px`, top: `${top + 4}px`, width: `${Math.min(220, W - sx - sw - 60)}px` })
    // the take-away card lies on the floor board, at the right
    Object.assign(sheet.pill.style, { left: 'auto', right: tall ? '6px' : `${W * 0.04}px`, top: tall ? `${H * 0.012}px` : `${floorY + H * 0.012}px`, bottom: 'auto' })
    const c = fit(cv, W, H, ctx.quality === 'low')
    job?.cancel()
    job = sliced(paint(c, sx, sw, top), { sync: ctx.reduced || painted })
    painted = true
    show(false)
  }
  ctx.onCleanup(() => job?.cancel())
  const ro = new ResizeObserver(() => requestAnimationFrame(() => layout()))
  ro.observe(ctx.el)
  ctx.onCleanup(() => ro.disconnect())
  ctx.onCleanup(onPrefs(() => {
    const next = palette()
    if (next.key === P.key || !W) return
    P = next
    layout(true)
  }))
  ctx.prompt(K.prompt)
}
