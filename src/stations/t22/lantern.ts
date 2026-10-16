import { fill, h, s } from '../../core/dom'
import type { SceneCtx } from '../types'
import { C } from './data'
import { blob, btn, curve, drawIn, f1, measure, nightShore, put, reeds, rng, stage, stroke, wash } from './kit'

const K = C.scenes.lantern

type Spot = { x: number; y: number; rx: number; ry: number; fs: number }

/** Scene 1 — the sentence floats as paper lanterns on a night river of ink; touching “nó” throws threads of moonlight to the words it needs. */
export function lanternScene(ctx: SceneCtx) {
  let end = 1
  let lit = false
  const words = () => [...K.words, K.endings[end].word]
  const pivotBtn = h('button', { class: 'g8l-pivot', type: 'button', 'aria-label': K.pivotAria, onClick: tap })
  const read = h('p', { class: 'g8l-read' })
  const swapBtn = btn(K.swap, null, swap, 'g8l-swap')
  const note = h('div', { class: 'g8l-note' })
  const ui = h('div', { class: 'g8l-ui g8-fade', 'data-off': '' }, read, swapBtn, note)
  const back = s('g')
  const refl = s('g')
  const lamps = s('g')
  const threads = s('g', { class: 'g8l-threads' })
  const { root, svg } = stage(ctx, 'g8l', K.art, [K.insight], draw)
  svg.append(back, refl, threads, lamps)
  root.append(pivotBtn, ui)
  swapBtn.setAttribute('aria-label', fill(K.swapAria, { word: K.endings[1 - end].word }))
  ctx.prompt(K.prompt)

  let pos: Spot[] = []

  function draw(W: number, H: number) {
    const n = K.words.length + 1
    const wide = W > 700
    // phone: two rows on the river, the far one smaller (perspective)
    const rows = wide ? [n] : [6, n - 6]
    const wy = H * (wide ? 0.3 : 0.22)
    const ys = wide ? [H * 0.52] : [H * 0.38, H * 0.56]
    const scale = wide ? [1] : [0.86, 1]
    pos = []
    rows.forEach((cnt, r) => {
      const slot = Math.min((W - 28) / (wide ? n : 6), 112)
      const rx = Math.min(36, slot * 0.4) * scale[r]
      const gap = slot * scale[r]
      const x0 = W / 2 - ((cnt - 1) * gap) / 2 + (wide ? 0 : r ? gap * 0.18 : -gap * 0.08)
      const fs = Math.max(11.5, Math.min(17, rx * 0.5))
      for (let i = 0; i < cnt; i++) pos.push({ x: x0 + i * gap, y: ys[r] + (i % 2 ? 3 : -2) * scale[r], rx, ry: rx * 1.22, fs })
    })
    const mx = W * (wide ? 0.8 : 0.76)
    back.replaceChildren(
      ...nightShore(W, wy, H, { seed: 22, mx, my: H * (wide ? 0.11 : 0.08), mr: Math.min(W, H) * (wide ? 0.04 : 0.05), hh: H * (wide ? 0.16 : 0.1), side: -1 }),
      // the near bank: a dark wash along the bottom with reeds, so the river reads as a river
      wash(`M0 ${f1(H)}L0 ${f1(H * 0.9)}Q${f1(W * 0.18)} ${f1(H * 0.86)} ${f1(W * 0.34)} ${f1(H * 0.93)}Q${f1(W * 0.6)} ${f1(H * 1.01)} ${f1(W)} ${f1(H * 0.92)}L${f1(W)} ${f1(H)}Z`, 0.22),
      reeds(W * 0.06, H * 0.95, H * (wide ? 0.2 : 0.14), 221, 8),
      reeds(W * 0.95, H * 0.97, H * (wide ? 0.16 : 0.11), 222, 6))
    const pv = pos[K.pivot]
    put(pivotBtn, pv.x - Math.max(24, pv.rx * 1.3), pv.y - Math.max(28, pv.ry * 1.25))
    pivotBtn.style.width = `${f1(Math.max(48, pv.rx * 2.6))}px`
    pivotBtn.style.height = `${f1(Math.max(56, pv.ry * 2.5))}px`
    const uy = Math.max(...pos.map((p) => p.y + p.ry)) + (wide ? 34 : 40)
    put(ui, 12, Math.min(uy, H - 150), W - 24)
    paint()
    drawThreads(false)
  }

  /** The lanterns and their reflections: brightness follows how much “nó” looks at each word. */
  function paint() {
    const ws = words()
    const wts = K.endings[end].weights
    const max = Math.max(...wts)
    let rafts = ''
    refl.replaceChildren()
    lamps.replaceChildren()
    pos.forEach((p, i) => {
      const isPivot = i === K.pivot
      const isEnd = i === ws.length - 1
      const glow = isPivot ? 0.85 : lit ? 0.04 + 0.96 * Math.pow((wts[i] ?? 0) / max, 0.9) : 0.5
      const { x, y, rx, ry } = p
      const r = rng(31 + i * 7)
      const by = y + ry * 1.06
      // reflection: broken strokes of warm light under the lantern, longer near it
      let rd = ''
      for (let k = 0; k < 6; k++) {
        const yy = by + 6 + k * ry * 0.26
        const len = rx * (1.3 - k * 0.17) * (0.7 + r() * 0.5)
        const xx = x + (r() - 0.5) * rx * 0.4 - len / 2
        rd += stroke([[xx, yy], [xx + len * 0.5, yy + (r() - 0.5) * 1.5], [xx + len, yy]], Math.max(1.2, ry * (0.16 - k * 0.018)), 0.3, 0.3, 0.1)
      }
      refl.append(
        s('path', { class: 'g8l-refl', d: rd, style: `opacity:${f1(0.12 + glow * 0.55)}` }),
        s('ellipse', { class: 'g8l-shadow', cx: f1(x + 2), cy: f1(by + 3), rx: f1(rx * 1.15), ry: f1(Math.max(3, ry * 0.12)) }))
      rafts += stroke(curve([x - rx * 1.05, by - 1], [x, by + 2.5], [x + rx * 1.05, by - 1.5], 6), Math.max(3, ry * 0.13), 0.08, 0.08, 0.5)
      // the lantern: halo, paper, light inside, ribs, lacquered caps, the word
      let ribs = ''
      for (let k = 1; k < 5; k++) {
        const t = -1 + (k * 2) / 5
        const yy = y + t * ry * 0.92
        const hw = rx * Math.sqrt(1 - t * t * 0.9)
        ribs += stroke(curve([x - hw, yy], [x, yy + ry * 0.1], [x + hw, yy], 8), 0.9 + r() * 0.4, 0.15, 0.15, 0.2)
      }
      const body = blob(x, y, rx, ry, 11 + i, 0.03, 22)
      const capW = rx * 0.62
      const cap = (yy: number, w: number) => `M${f1(x - w)} ${f1(yy - ry * 0.07)}Q${f1(x)} ${f1(yy - ry * 0.12)} ${f1(x + w)} ${f1(yy - ry * 0.07)}L${f1(x + w * 0.92)} ${f1(yy + ry * 0.08)}L${f1(x - w * 0.92)} ${f1(yy + ry * 0.08)}Z`
      const tw = measure(ws[i], p.fs)
      const fs = tw > rx * 1.62 ? (p.fs * rx * 1.62) / tw : p.fs
      lamps.append(s('g', { class: `g8l-lan${isPivot ? ' pivot' : ''}${isEnd ? ' end' : ''}` },
        s('circle', { class: 'g8l-halo', cx: f1(x), cy: f1(y), r: f1(rx * (2 + glow * 1.6)), fill: 'url(#p2-lamp)', style: `opacity:${f1(glow)}` }),
        s('path', { class: 'g8l-paper', d: body }),
        s('path', { class: 'g8l-light', d: body, fill: 'url(#p2-lamp-body)', style: `opacity:${f1(0.25 + glow * 0.75)}` }),
        s('path', { class: 'p2p-lamp-rib', d: ribs }),
        // roundness: a shaded crescent on the far side, a breath of moonlight on the near one
        s('path', { class: 'g8l-shade', d: `M${f1(x + rx * 0.1)} ${f1(y - ry * 0.97)}A${f1(rx)} ${f1(ry)} 0 0 1 ${f1(x + rx * 0.1)} ${f1(y + ry * 0.97)}A${f1(rx * 0.62)} ${f1(ry)} 0 0 0 ${f1(x + rx * 0.1)} ${f1(y - ry * 0.97)}Z` }),
        s('path', { class: 'g8l-sheen', d: stroke(curve([x - rx * 0.62, y - ry * 0.55], [x - rx * 0.84, y], [x - rx * 0.6, y + ry * 0.55], 8), rx * 0.14, 0.3, 0.3, 0.1) }),
        s('path', { class: `g8l-cap${isPivot ? ' v' : ''}`, d: cap(y - ry * 0.98, capW) + cap(y + ry * 0.98, capW * 1.08), filter: 'url(#ink-rough)' }),
        s('path', { class: 'g8l-hook', d: stroke([[x, y - ry * 1.05], [x + 1, y - ry * 1.3]], 1.6, 0.1, 0.3, 0.4) }),
        isEnd ? s('path', { class: 'g8l-mark', d: stroke([[x - tw * 0.42, y + fs * 0.62], [x, y + fs * 0.7], [x + tw * 0.42, y + fs * 0.6]], 1.8, 0.2, 0.3, 0.3) }) : null,
        s('text', { class: 'g8l-word', x: f1(x), y: f1(y + fs * 0.36), 'font-size': f1(fs), 'text-anchor': 'middle' }, ws[i])))
    })
    refl.append(s('path', { class: 'g8l-raft', d: rafts, filter: 'url(#ink-rough)' }))
  }

  /** From the pivot: one bright brush line to the word it needs most, fainter ones to the rest (thickness = weight). */
  function drawThreads(animate: boolean) {
    threads.replaceChildren()
    if (!lit || !pos.length) return
    const wts = K.endings[end].weights
    const top = K.endings[end].points
    const a = pos[K.pivot]
    const order = wts.map((w, i) => [w, i] as const).filter(([, i]) => i !== K.pivot).sort((x, y) => x[0] - y[0])
    for (const [w, i] of order) {
      const b = pos[i]
      const up = b.y < a.y - 6
      const ax = a.x, ay = a.y - a.ry * 1.15
      const bx = b.x, by = up ? b.y + b.ry * 1.1 : b.y - b.ry * 1.15
      const lift = up ? 0 : Math.min(a.ry * 2.6, 28 + Math.abs(bx - ax) * 0.32)
      const cx = (ax + bx) / 2, cy = up ? (ay + by) / 2 - a.ry : Math.min(ay, by) - lift
      const d = `M${f1(ax)} ${f1(ay)}Q${f1(cx)} ${f1(cy)} ${f1(bx)} ${f1(by)}`
      const strong = i === top
      if (strong) threads.append(s('path', { class: 'g8l-thread glow', d, 'stroke-width': f1(6 + w * 12) }))
      const p = s('path', { class: `g8l-thread${strong ? ' top' : ''}`, d, 'stroke-width': f1(strong ? 2.2 : 0.5 + w * 5), style: `opacity:${f1(strong ? 1 : Math.min(0.8, 0.16 + w * 1.6))}` })
      threads.append(p)
      if (animate) drawIn(ctx, p, strong ? 1400 : 900, strong ? 250 : 0)
      if (strong) threads.append(s('circle', { class: 'g8l-knot', cx: f1(bx), cy: f1(by), r: 3 }))
    }
  }

  function setRead() {
    const e = K.endings[end]
    read.replaceChildren(h('span', null, e.read), h('span', { class: 'visually-hidden' }, ` · ${fill(K.threadAria, { word: words()[e.points] })}`))
  }

  function tap() {
    if (!lit) {
      lit = true
      root.classList.add('lit')
      delete ui.dataset.off
      note.replaceChildren(ctx.fact(K.weightsNote, 'p', 'g8-note'))
      setRead()
      read.setAttribute('aria-live', 'polite')
      ctx.insight(K.insight, K.detail)
    }
    ctx.chime('soft')
    paint()
    drawThreads(true)
  }

  function swap() {
    end = 1 - end
    swapBtn.setAttribute('aria-label', fill(K.swapAria, { word: K.endings[1 - end].word }))
    setRead()
    ctx.chime('tap')
    paint()
    drawThreads(true)
  }
}

