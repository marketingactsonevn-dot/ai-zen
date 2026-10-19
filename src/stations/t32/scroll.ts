import raw from '../../content/tram-32.json'
import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { sliced } from '../../core/chunk'
import { onPrefs } from '../../core/prefs'
import { curve, rng, type Pt } from '../../ui/part2/ink'
import { guide, type Mark } from '../../ui/part2/guide'
import { findTakeaway, foldedTakeaway } from '../../ui/part2/takeaway'
import type { Takeaway } from '../../ui/part2/types'
import type { SceneCtx } from '../types'
import { brush, clamp, fit, grainOver, mix, palette, rgba, stageSize, type Pal } from './kit'

const K = raw.scenes.scroll

/**
 * Scene 5 — "Một dòng lệnh": the tokonoma, a hanging scroll in the alcove seen straight on, a small oil lamp on the floor
 * board lighting it from below. On the washi only one line, `ollama run ____`, with the margin note on where to type it.
 * Drag (or tap) a small model's name slip into the blank: the lamp flares, and a chat written in ink appears on the paper
 * — the model answering — beside a crossed-out wifi (it runs with the network off). A little back door in the alcove's
 * side wall carries `localhost:11434`; touch it to read what it is for. The other commands stay in the take-away card.
 * 2.5D: the alcove painted once on a canvas, the scroll and the slips DOM.
 */
export function scrollScene(ctx: SceneCtx) {
  const still = ctx.quality === 'low' || ctx.reduced
  let done = false

  const cv = h('canvas', { class: 't32-cv t32-bleed', 'aria-hidden': 'true' })
  // the line on the paper: the command, the blank to drop a model name in, then the chat that answers
  const blank = h('span', { class: 't32x-blank', 'aria-label': K.blankAria })
  const chat = h('div', { class: 't32x-chat', hidden: true },
    h('p', { class: 't32x-you' }, h('span', { 'aria-hidden': 'true' }, '>>> '), K.chat.you),
    h('p', { class: 't32x-ai' }, K.chat.ai),
    h('p', { class: 't32x-off' },
      s('svg', { viewBox: '0 0 24 18', 'aria-hidden': 'true' },
        s('path', { d: 'M2 6.5C8 1 16 1 22 6.5M5.5 10C9.5 6.5 14.5 6.5 18.5 10M9 13.4C10.8 12 13.2 12 15 13.4', fill: 'none' }),
        s('circle', { cx: 12, cy: 16, r: 1.4 }),
        s('path', { class: 't32x-cross', d: 'M4 1L20 17', fill: 'none' })),
      K.offline))
  const sheetIn = h('div', { class: 't32x-sheet' },
    h('p', { class: 't32x-margin' }, K.typeHere),
    h('p', { class: 't32x-cmd' }, h('code', null, `${K.cmd} `), blank),
    chat)
  // the mounting: silk frame (chūmawashi) round the paper, gold bands (ichimonji) above and below it, the lower silk (chi)
  const paper = h('div', { class: 't32x-paper' }, h('div', { class: 't32x-frame' }, h('i', { class: 't32x-ichi', 'aria-hidden': 'true' }), sheetIn, h('i', { class: 't32x-ichi', 'aria-hidden': 'true' })), h('i', { class: 't32x-chi', 'aria-hidden': 'true' }))
  const rod = h('div', { class: 't32x-rod', 'aria-hidden': 'true' },
    h('span', { class: 't32x-knob' }), h('span', { class: 't32x-knob t32x-knob-r' }), h('span', { class: 't32x-tassel' }))
  // the upper silk (ten) with its two hanging strips (fūtai), under the top rod
  const ten = h('div', { class: 't32x-ten', 'aria-hidden': 'true' }, h('i', { class: 't32x-futai' }), h('i', { class: 't32x-futai t32x-futai-r' }))
  const hang = h('div', { class: 't32x-hang' }, h('span', { class: 't32x-cord', 'aria-hidden': 'true' }), ten, h('span', { class: 't32x-top', 'aria-hidden': 'true' }), paper, rod)
  const flame = h('div', { class: 't32x-flame', 'aria-hidden': 'true' }, h('i'))
  // the model name slips on the floor board, and the back door in the side wall
  const models = K.models.map((m) => h('button', { class: 't32x-model', type: 'button', 'aria-label': fill(K.modelAria, m) }, h('code', null, m.name), h('small', null, m.size)))
  const tray = h('div', { class: 't32x-tray' }, ...models)
  const door = h('button', { class: 't32x-door', type: 'button', 'aria-label': K.doorAria, 'aria-expanded': 'false' }, h('code', null, K.door))
  const doorNote = h('p', { class: 't32-paper t32x-note', hidden: true }, K.doorNote)
  const fold = h('div', { class: 't32x-fold' })
  const root = h('div', { class: `t32 t32x${still ? ' still' : ''}`, role: 'group', 'aria-label': K.aria },
    cv,
    h('div', { class: 't32-mist', 'aria-hidden': 'true' }),
    h('p', { class: 'visually-hidden' }, K.art),
    flame, hang, door, doorNote, tray, fold)
  ctx.art.append(root)
  ctx.prompt(K.prompt)
  // guide: a dot on the first slip leaning toward the blank, the blank a dashed place to drop (H1, H3); then the back door
  const g = guide(ctx)
  let dot: Mark | null = g.dot(models[0], { dir: [-1, -0.4] })
  const target = g.drop(blank, { round: false })

  let W = 0, H = 0, tall = false
  let P: Pal = palette()
  let lamp: Pt = [0, 0] // the flame's foot, px

  /** a model's name goes into the blank: the lamp flares, the chat answers on the paper, the back door gets the dot */
  function run(i: number) {
    if (done) return
    done = true
    const m = K.models[i]
    blank.textContent = m.name
    blank.classList.add('filled')
    models.forEach((b, j) => ((b.disabled = true), b.classList.toggle('used', j === i)))
    target.hit()
    dot?.done()
    root.classList.add('lit')
    ctx.chime('soft')
    const id = setTimeout(() => {
      chat.hidden = false
      ctx.insight(K.insight as Fact, [K.detail as Fact, K.modelNote as Fact])
      const card = findTakeaway(K.takeaway)
      if (card) fold.append(foldedTakeaway([card as Takeaway], ctx.onCleanup))
      dot = g.dot(door, { dir: [0, 1] })
    }, ctx.reduced ? 0 : 900)
    ctx.onCleanup(() => clearTimeout(id))
  }
  door.addEventListener('click', () => {
    const open = doorNote.hidden
    doorNote.hidden = !open
    door.setAttribute('aria-expanded', String(open))
    if (open) dot?.done(), (dot = null), ctx.chime('tap')
  })

  // drag a slip onto the blank (tap = it goes there by itself)
  models.forEach((b, i) => {
    let moved = false
    b.addEventListener('click', () => !moved && run(i))
    b.addEventListener('pointerdown', (e) => {
      if (e.button || done) return
      const x0 = e.clientX, y0 = e.clientY
      moved = false
      b.setPointerCapture(e.pointerId)
      const move = (ev: PointerEvent) => {
        if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return
        if (!moved) b.classList.add('drag'), target.lift(true)
        moved = true
        b.style.translate = `${(ev.clientX - x0).toFixed(1)}px ${(ev.clientY - y0).toFixed(1)}px`
      }
      const up = (ev: PointerEvent) => {
        b.removeEventListener('pointermove', move)
        b.removeEventListener('pointerup', up)
        b.removeEventListener('pointercancel', up)
        b.classList.remove('drag')
        target.lift(false)
        b.style.translate = ''
        if (!moved) return
        setTimeout(() => (moved = false))
        const r = blank.getBoundingClientRect()
        if (ev.type === 'pointerup' && ev.clientX > r.left - 40 && ev.clientX < r.right + 40 && ev.clientY > r.top - 30 && ev.clientY < r.bottom + 30) run(i)
      }
      b.addEventListener('pointermove', move)
      b.addEventListener('pointerup', up)
      b.addEventListener('pointercancel', up)
    })
  })

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
    const sw = tall ? Math.min(W - 48, 340) : clamp(W * 0.3, 360, 440)
    const sx = (W - sw) / 2 + (tall ? 4 : 0)
    const tenH = H * (tall ? 0.05 : 0.065)
    const top = H * 0.1 + tenH
    // the paper about 60 % of the height, hung open from the start
    const full = H * (tall ? 0.5 : 0.6)
    Object.assign(hang.style, { left: `${sx}px`, top: `${top}px`, width: `${sw}px` })
    hang.style.setProperty('--ten', `${tenH.toFixed(1)}px`)
    paper.style.height = `${full}px`
    rod.style.transform = `translateY(${full.toFixed(1)}px)`
    const floorY = H * (tall ? 0.76 : 0.82)
    // the lamp stands on the floor board left of the scroll (a phone: a low one under its corner)
    lamp = [tall ? W * 0.11 : sx - W * 0.09, floorY - H * (tall ? 0.04 : 0.22)]
    Object.assign(flame.style, { left: `${lamp[0]}px`, top: `${lamp[1] + 1}px` })
    // the name slips lie on the floor board right of the scroll (a phone: under it); the back door is in the side wall
    const below = top + full + 40 // a phone: the row under the scroll (slips left, the door right; the card once done)
    Object.assign(tray.style, tall ? { left: '12px', right: '72px', top: `${below}px`, width: 'auto' } : { left: `${sx + sw + 28}px`, right: 'auto', top: `${floorY - H * 0.2}px`, width: `${Math.min(200, W - sx - sw - 60)}px` })
    Object.assign(door.style, tall ? { left: 'auto', right: '12px', top: `${below - 14}px` } : { left: `${W * 0.875}px`, right: 'auto', top: `${floorY - H * 0.36}px` })
    Object.assign(doorNote.style, tall ? { left: '12px', right: '12px', top: `${top + full - 64}px`, width: 'auto' } : { left: `${sx + sw + 28}px`, right: 'auto', top: `${top + 4}px`, width: `${Math.min(220, W - sx - sw - 60)}px` })
    // the take-away slip lies on the floor board at the right, away from the insight (a phone: where the slips were)
    Object.assign(fold.style, tall ? { left: '12px', right: 'auto', top: `${below}px` } : { left: 'auto', right: `${W * 0.04}px`, top: `${floorY + H * 0.012}px` })
    const c = fit(cv, W, H, ctx.quality === 'low')
    job?.cancel()
    job = sliced(paint(c, sx, sw, top), { sync: ctx.reduced || painted })
    painted = true
    g.refresh()
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
