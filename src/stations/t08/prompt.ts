import { h, nextId, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { character, landscape, SH, SW, walkPose, type Pose } from './demos'
import { arc, brush, C, clamp, ell, lerp, loop, path, pebble, rng, smooth, stableHeight, watchSize, type Pt } from './kit'

const P = C.scenes.prompt
type Part = 'subject' | 'action' | 'camera' | 'light' | 'sound'

// the bridge the walker crosses: an arch over the water
const BX0 = 62
const BX1 = 258
const deck = (x: number) => 131 - 17 * (1 - ((x - 160) / ((BX1 - BX0) / 2)) ** 2)
const SC = 50
const LEG = 0.46 * SC
const stand = (x: number): Pose => ({ x, y: deck(x) - LEG, s: SC, lean: 0, aL: [-0.12, -0.1], aR: [0.12, 0.1], lL: [-0.06, 0.02], lR: [0.06, 0.02] })

/**
 * Scene 5 — how to prompt a video: five stones (subject · action · camera · light · sound). Each one set into the
 * prompt line changes the little clip on the paper screen; with all five the clip carries the rule of thumb.
 */
export function promptScene(ctx: SceneCtx) {
  const root = h('div', { class: 't08 t08p' })
  const lowQ = ctx.quality === 'low'
  const wash = lowQ ? null : 'url(#ink-wash)'

  // ───────── the screen ─────────
  const clipId = nextId('t08p')
  const world = s('g')
  const overlay = s('g')
  const frame = s('g')
  const screen = s('svg', { class: 't08p-screen', viewBox: `-8 -8 ${SW + 16} ${SH + 16}`, role: 'img', 'aria-label': P.screen },
    s('defs', null, s('clipPath', { id: clipId }, s('rect', { width: SW, height: SH, rx: 8 }))),
    s('rect', { class: 'card', width: SW, height: SH, rx: 8 }),
    s('g', { 'clip-path': `url(#${clipId})` }, world, overlay), frame)
  const fr = rng(4)
  const side = (a: Pt, b: Pt, w: number) => path(brush([a, [(a[0] + b[0]) / 2 + (fr() - 0.5), (a[1] + b[1]) / 2 + (fr() - 0.5)], b], w, { a: 0.03, b: 0.08, min: 0.55 }), 'k2', { filter: lowQ ? null : 'url(#ink-rough)' })
  frame.append(side([-2, 0], [SW + 2, 0.3], 1.5), side([SW, -1], [SW - 0.3, SH + 1.5], 1.3), side([SW + 2, SH], [-1, SH - 0.3], 1.8), side([0, SH + 1], [0.3, -1.5], 1.3))

  // the world (moves with the camera)
  const warm = s('rect', { class: 'v', width: SW, height: 124, opacity: 0 })
  const sun = path(ell(250, 50, 13), 'v', { opacity: 0 })
  world.append(warm, sun)
  landscape(world, 6, SW, 118)
  // a small pagoda on the far ridge: the bell is there
  const pag = s('g', { class: 'k2', opacity: 0.7 })
  pag.append(
    path(brush([[262, 82], [272, 77], [282, 82]], 2.2, { a: 0.1, b: 0.1, min: 0.4 }) + brush([[264, 91], [272, 86.5], [280, 91]], 2, { a: 0.1, b: 0.1, min: 0.4 }), 'k2'),
    path('M267 82h10v18h-10Z', 'k2', { 'fill-opacity': 0.55 }),
    path(brush([[272, 77], [272, 71]], 0.9, { a: 0, b: 0, min: 1, straight: true }), 'k2'))
  const rings = [0, 1, 2].map(() => path('', 'k3'))
  world.append(pag, ...rings)
  // the bridge: deck, rail, posts, its reflection
  const deckPts: Pt[] = Array.from({ length: 21 }, (_, i) => {
    const x = lerp(BX0, BX1, i / 20)
    return [x, deck(x)] as Pt
  })
  const railPts = deckPts.map(([x, y]) => [x, y - 11] as Pt).slice(1, -1)
  let posts = ''
  for (let i = 2; i < 20; i += 3) posts += brush([deckPts[i], railPts[i - 1]], 1.1, { a: 0, b: 0, min: 1, straight: true })
  world.append(
    path(brush(deckPts.map(([x, y]) => [x, 2 * 134 - y + 6] as Pt).slice(2, -2), 2, { a: 0.3, b: 0.3, min: 0.2 }), 'k3', { 'fill-opacity': 0.22 }),
    path(brush(deckPts, 3.4, { a: 0.04, b: 0.04, min: 0.5 }), 'k2'),
    path(brush(railPts, 1.6, { a: 0.05, b: 0.05, min: 0.5 }) + posts, 'k2', { 'fill-opacity': 0.8 }),
    // two piers standing in the water
    path([104, 216].map((x) => brush([[x, deck(x) + 1], [x + 0.4, 147]], 2.6, { a: 0.02, b: 0.3, min: 0.4, straight: true })).join(''), 'k2'),
  )
  const walker = character()
  world.append(walker.g)
  // mist and the flat grey veil of an unlit scene
  const mists = ([[64, 30, 0], [104, 20, 2.1], [140, 24, 4.2]] as const).map(([y, w, ph]) => {
    const p = path(brush([[-80, y + 2], [60, y - 3], [200, y + 1], [400, y - 2]], w, { a: 0.35, b: 0.35, min: 0.08, wob: 0.2 }), 'card', { filter: wash })
    world.append(p)
    return { p, ph }
  })
  const veil = s('rect', { class: 'card', x: -20, y: -20, width: SW + 40, height: SH + 40, opacity: 0.4 })
  world.append(veil)

  // overlay (does not move with the camera): the sound track, the slate with the rule
  const track = s('g', { opacity: 0 })
  track.append(s('rect', { class: 'card', x: 0, y: 160, width: SW, height: 20, opacity: 0.8 }))
  const N = 54
  const bars = Array.from({ length: N }, (_, i) => {
    const b = s('rect', { class: 'k2', x: 14 + (i * (SW - 28)) / (N - 1) - 1.1, width: 2.2, rx: 1.1, y: 170, height: 1 })
    track.append(b)
    return b
  })
  const jr = rng(9)
  const jit = Array.from({ length: N }, () => jr())
  const slate = s('g', { opacity: 0 })
  slate.append(s('rect', { class: 'card', x: 8, y: 8, width: 1, height: 20, rx: 4, opacity: 0.9 }),
    path(pebble(18.5, 18, 3.8, 3.3, rng(3), 0.06), 'v'),
    s('text', { x: 27, y: 21.5, class: 't08-svgt k', 'font-size': 9.5 }, P.rule))
  overlay.append(track, slate)

  // ───────── the prompt line and the stones ─────────
  const line = h('p', { class: 't08p-line', 'aria-live': 'polite' })
  const caret = h('span', { class: 't08p-caret', 'aria-hidden': 'true' })
  const rail = s('svg', { class: 't08p-rail', viewBox: '0 0 400 8', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    path(brush([[2, 4], [140, 3.4], [270, 4.6], [398, 4]], 1.6, { a: 0.08, b: 0.12, min: 0.3 }), 'k3', { 'fill-opacity': 0.7 }))
  const lineWrap = h('div', { class: 't08p-linewrap' }, line, rail)
  const parts = P.parts as { id: Part; name: string; words: string }[]
  const placed = new Set<Part>()
  const names = parts.map((p) => h('span', { class: 't08p-name' }, p.name))
  const pebs = parts.map(() => s('svg', { class: 't08p-peb', 'aria-hidden': 'true' }))
  const stones = parts.map((p, i) => h('button', { class: 't08p-stone', type: 'button', 'aria-pressed': 'false', 'aria-label': `${p.name}: ${p.words}`, onClick: () => toggle(i) }, pebs[i], names[i]))
  const sandBox = h('div', { class: 't08p-stones', role: 'group', 'aria-label': P.group }, ...stones)
  root.append(h('div', { class: 't08p-screenwrap' }, screen), lineWrap, sandBox)
  ctx.art.append(root)
  ctx.prompt(P.prompt)
  const stable = stableHeight(ctx, [[P.insight, P.detail]])

  // ───────── state ─────────
  const prm = { subject: 0, action: 0, camera: 0, light: 0, sound: 0, rule: 0 }
  let tNow = 0
  let walkFrom = 160
  let walkT0 = 0
  let curX = 160

  function renderLine(fresh?: Part) {
    const kids: Node[] = []
    parts.forEach((p) => {
      if (!placed.has(p.id)) return
      if (kids.length) kids.push(h('span', { class: 't08p-sep', 'aria-hidden': 'true' }, ' · '))
      kids.push(h('span', { class: `t08p-frag${p.id === fresh ? ' fresh' : ''}`, 'data-id': p.id }, p.words))
    })
    line.replaceChildren(...kids, caret)
    line.classList.toggle('empty', !placed.size)
    const f = fresh && line.querySelector<HTMLElement>(`[data-id="${fresh}"]`)
    if (f && !ctx.reduced) ctx.anim(() => gsap.fromTo(f, { opacity: 0, y: 4, filter: 'blur(3px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.8, ease: 'power3.out', clearProps: 'filter' }))
    if (f) setTimeout(() => f.classList.remove('fresh'), 1600)
    return f
  }

  function toggle(i: number) {
    const p = parts[i]
    const on = !placed.has(p.id)
    if (on) placed.add(p.id)
    else placed.delete(p.id)
    stones[i].setAttribute('aria-pressed', String(on))
    if (p.id === 'action' && on) {
      walkFrom = curX
      walkT0 = tNow
    }
    const f = renderLine(on ? p.id : undefined)
    ctx.chime(on ? 'soft' : 'tap')
    const all = placed.size === parts.length
    const to = { [p.id]: on ? 1 : 0, rule: all ? 1 : 0 }
    if (ctx.reduced) Object.assign(prm, to)
    else ctx.anim(() => gsap.to(prm, { ...to, duration: p.id === 'camera' ? 2.6 : 1.3, ease: 'power2.inOut', overwrite: 'auto' }))
    if (on && f && !ctx.reduced) fly(stones[i], f)
    if (ctx.reduced) draw()
    if (all) ctx.insight(P.insight, P.detail)
  }

  // a small ink pebble travels from the stone to its words in the line
  function fly(from: HTMLElement, to: HTMLElement) {
    const r0 = root.getBoundingClientRect()
    const a = from.getBoundingClientRect()
    const b = to.getBoundingClientRect()
    const dot = h('span', { class: 't08p-fly', 'aria-hidden': 'true' })
    root.append(dot)
    const x0 = a.left + a.width / 2 - r0.left
    const y0 = a.top + a.height / 2 - r0.top
    const x1 = b.left + 6 - r0.left
    const y1 = b.top + b.height / 2 - r0.top
    ctx.anim(() => gsap.timeline({ onComplete: () => dot.remove() })
      .fromTo(dot, { x: x0, y: y0, scale: 1, opacity: 0.9 }, { x: x1, y: y1, duration: 0.7, ease: 'power2.inOut' })
      .to(dot, { scale: 0.3, opacity: 0, duration: 0.35, ease: 'power2.in' }))
  }

  // ───────── the clip ─────────
  function draw(t = tNow) {
    const L = prm.light
    warm.setAttribute('opacity', (0.07 * L).toFixed(3))
    sun.setAttribute('opacity', (0.85 * L).toFixed(3))
    veil.setAttribute('opacity', (0.42 * (1 - L)).toFixed(3))
    mists.forEach(({ p, ph }, i) => {
      p.setAttribute('opacity', (0.82 - 0.42 * L).toFixed(3))
      p.setAttribute('transform', `translate(${(Math.sin(t * 0.16 + ph) * 26 - i * 6).toFixed(1)} 0)`)
    })
    // the walker: stands on the bridge, or walks across it once there is an action
    let pose: Pose
    if (prm.action > 0.5) {
      const u = ((t - walkT0) / 9 + (walkFrom - 92) / (228 - 92)) % 1
      curX = lerp(92, 228, u)
      pose = walkPose(curX, deck(curX) - LEG, SC, t * 5)
    } else pose = stand(curX)
    walker.draw(pose)
    const fade = prm.action > 0.5 ? smooth(92, 100, curX) * (1 - smooth(220, 228, curX)) : 1
    // without a subject the AI has only a vague figure to move
    walker.g.setAttribute('opacity', (Math.max(prm.subject, 0.28 * prm.action) * fade).toFixed(3))
    // the camera pushes in on the walker
    const z = 1 + 0.28 * prm.camera
    const fx = lerp(160, curX, prm.camera)
    world.setAttribute('transform', `translate(${fx.toFixed(1)} 112) scale(${z.toFixed(3)}) translate(${(-fx).toFixed(1)} -112)`)
    // the bell: rings spread from the pagoda, the sound track pulses with each strike
    const S = prm.sound
    const k = t % 2.6
    rings.forEach((p, i) => {
      const u = clamp((k - i * 0.16) / 1.6)
      const R = 6 + u * 46
      p.setAttribute('d', S > 0.01 && u > 0 && u < 1 ? brush(arc(272, 84, R, R * 0.7, -160, -20, 18), 1.4 * (1 - u) + 0.3, { a: 0.2, b: 0.3, min: 0.3 }) : '')
      p.setAttribute('opacity', (S * 0.8 * (1 - u)).toFixed(3))
    })
    track.setAttribute('opacity', S.toFixed(3))
    if (S > 0.01) {
      bars.forEach((b, i) => {
        const x = i / (N - 1)
        const e = Math.exp(-Math.max(0, k - x * 0.25) / 0.6)
        const hh = 1.2 + S * (1.5 + 11 * e * (0.5 + 0.5 * jit[i]) + jit[(i * 7) % N] * 1.5)
        b.setAttribute('y', (170 - hh / 2).toFixed(1))
        b.setAttribute('height', hh.toFixed(1))
      })
    }
    slate.setAttribute('opacity', prm.rule.toFixed(3))
  }
  // size the slate's paper to its words once fonts are in
  const fitSlate = () => {
    const tx = slate.querySelector('text') as SVGTextElement
    const w = tx.getComputedTextLength?.() || 160
    slate.firstElementChild!.setAttribute('width', String(Math.ceil(w + 30)))
  }

  const stop = ctx.reduced
    ? () => {}
    : loop((t) => {
        tNow = t
        draw(t)
      })
  if (ctx.reduced) draw(3)

  // ───────── stones: pebbles sized to their names ─────────
  const SIZES = [1.08, 0.94, 1, 0.88, 1.02]
  function drawPebble(i: number, bw: number, bh: number) {
    const r = rng(51 + i * 9)
    const cx = bw / 2
    const cy = bh / 2
    const rx = bw / 2 - 2
    const ry = bh / 2 - 3
    pebs[i].setAttribute('viewBox', `0 0 ${bw} ${bh}`)
    pebs[i].replaceChildren(
      path(pebble(cx + 3, cy + 4, rx, ry * 0.96, r, 0.07), 'sh', { 'fill-opacity': 0.12, filter: wash }),
      path(pebble(cx, cy, rx, ry, r, 0.07), 'peb'),
      path(brush([[cx - rx * 0.72, cy + ry * 0.5], [cx, cy + ry * 0.86], [cx + rx * 0.74, cy + ry * 0.42]], Math.max(2, bh * 0.05), { a: 0.3, b: 0.3, min: 0.2 }), 'sh', { 'fill-opacity': 0.16 }),
      path(brush([[cx - rx * 0.6, cy - ry * 0.5], [cx - rx * 0.1, cy - ry * 0.8], [cx + rx * 0.3, cy - ry * 0.76]], Math.max(1.6, bh * 0.04), { a: 0.3, b: 0.4, min: 0.2 }), 'rim'),
      // the imprint left in the sand once the stone is in the line
      path(brush(arc(cx, cy, rx - 1, ry - 1, -170, 172, 40), 1.1, { a: 0.05, b: 0.05, min: 0.5, wob: 0.15 }), 'imp'))
  }

  // stones in gently uneven rows (one row, or 3 + 2 in a narrow column); returns the height they take
  function placeStones(CW: number, perRow: number, narrow: boolean) {
    const slot = Math.min(150, (CW - 8) / perRow)
    const dims = stones.map((b, i) => {
      names[i].style.maxWidth = narrow ? `${Math.max(40, slot - 22)}px` : 'none'
      const k = SIZES[i]
      const bw = Math.min(slot - 4, names[i].offsetWidth + 24 * k + 8)
      const bh = Math.max(46, names[i].offsetHeight + 20 * k + 6)
      Object.assign(b.style, { width: `${Math.round(bw)}px`, height: `${Math.round(bh)}px` })
      drawPebble(i, Math.round(bw), Math.round(bh))
      return { bw, bh }
    })
    const rowH = Math.max(...dims.map((d) => d.bh)) + 8
    const r = rng(12)
    stones.forEach((b, i) => {
      const row = Math.floor(i / perRow)
      const inRow = Math.min(perRow, parts.length - row * perRow)
      const x0 = (CW - slot * inRow) / 2
      const j = i - row * perRow
      Object.assign(b.style, { left: `${x0 + (j + 0.5) * slot - dims[i].bw / 2 + (r() - 0.5) * slot * 0.12}px`, top: `${row * rowH + (rowH - dims[i].bh) / 2 + (r() - 0.5) * 7}px` })
    })
    const h = rowH * Math.ceil(parts.length / perRow)
    Object.assign(sandBox.style, { height: `${h}px`, width: `${CW}px` })
    return h
  }
  // the line is tall enough for the full sentence at its width
  function lineHeight(w: number) {
    lineWrap.style.width = `${w}px`
    const full = line.cloneNode(false) as HTMLElement
    full.textContent = parts.map((p) => p.words).join(' · ')
    full.style.cssText = 'position:absolute;visibility:hidden;left:0;right:0'
    lineWrap.append(full)
    const lh = full.offsetHeight + 10
    full.remove()
    lineWrap.style.height = `${lh}px`
    return lh
  }

  function layout(W: number, Hh: number) {
    const H = stable.H(Hh)
    root.style.height = `${H}px`
    const narrow = W < 560
    root.classList.toggle('narrow', narrow)
    const ratio = (SW + 16) / (SH + 16)
    const gap = clamp(H * 0.025, 6, 16)
    root.style.setProperty('--gap', `${gap}px`)
    // short and wide: the screen on the left, the line and the stones beside it
    const side = W / H > 1.9 && H < 380
    root.classList.toggle('side', side)
    if (side) {
      const colW = Math.floor(Math.min(W * 0.46, 440))
      const sh = placeStones(colW, 3, true)
      const lh = lineHeight(colW)
      const sw = Math.max(160, Math.min(W - colW - 24, H * ratio, 720))
      root.style.setProperty('--sw', `${Math.floor(sw)}px`)
      root.style.setProperty('--col', `${colW}px`)
      root.style.setProperty('--colh', `${Math.ceil(sh + lh + gap)}px`)
    } else {
      const rowH = placeStones(W, parts.length, narrow)
      const lh = lineHeight(Math.min(W, 760))
      const sw = Math.max(160, Math.min(W, (H - rowH - lh - gap * 2 - 6) * ratio, 720))
      root.style.setProperty('--sw', `${Math.floor(sw)}px`)
      lineHeight(Math.min(W, Math.max(sw, Math.min(W, 640))))
    }
    fitSlate()
  }
  const unwatch = watchSize(ctx.art, layout)
  renderLine()
  layout(ctx.art.clientWidth, ctx.art.clientHeight)
  stable.afterFonts(() => layout(ctx.art.clientWidth, ctx.art.clientHeight))

  if (!ctx.reduced) {
    gsap.from(screen, { opacity: 0, y: 14, filter: 'blur(6px)', duration: 1.3, ease: 'power3.out', delay: 0.15, clearProps: 'filter' })
    gsap.from(stones, { opacity: 0, y: 14, duration: 1, stagger: 0.08, ease: 'power3.out', delay: 0.5 })
  }

  return () => {
    stop()
    unwatch()
  }
}
