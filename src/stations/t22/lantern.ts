import { fill, h, s } from '../../core/dom'
import type { SceneCtx } from '../types'
import { C } from './data'
import { blob, btn, drawIn, f1, glowDefs, hills, measure, moon, put, stage, stroke, waterBand } from './kit'

const K = C.scenes.lantern

/** Scene 1 — the sentence floats as paper lanterns on an ink river; touching “nó” throws threads of light to the words it needs. */
export function lanternScene(ctx: SceneCtx) {
  let end = 1
  let lit = false
  const words = () => [...K.words, K.endings[end].word]
  const pivotBtn = h('button', { class: 'g8l-pivot', type: 'button', 'aria-label': K.pivotAria, onClick: tap })
  const read = h('p', { class: 'g8l-read' })
  const swapBtn = btn(K.swap, null, swap, 'g8l-swap')
  const note = h('div', { class: 'g8l-note' })
  const ui = h('div', { class: 'g8l-ui g8-fade', 'data-off': '' }, read, swapBtn, note)
  const art = s('g')
  const threads = s('g', { class: 'g8l-threads' })
  const { root, svg, redraw } = stage(ctx, 'g8l', K.art, [K.insight], draw)
  const glow = glowDefs(svg)
  svg.append(art, threads)
  root.append(pivotBtn, ui)
  swapBtn.setAttribute('aria-label', fill(K.swapAria, { word: K.endings[1 - end].word }))
  ctx.prompt(K.prompt)

  let pos: { x: number; y: number; w: number; hh: number; fs: number }[] = []

  function draw(W: number, H: number) {
    const n = K.words.length + 1
    const wide = W > 700
    const rows = wide ? [n] : [6, n - 6]
    const per = Math.max(...rows)
    const lw = Math.min(88, ((W - 24) / per) * 0.84)
    const lh = lw * 1.18
    const fs = Math.max(12, Math.min(19, lw * 0.24))
    const ys = wide ? [H * 0.5] : [H * 0.36, H * 0.6]
    pos = []
    rows.forEach((cnt, r) => {
      const gap = Math.min((W - 24) / per, lw * 1.25)
      const x0 = W / 2 - ((cnt - 1) * gap) / 2
      for (let i = 0; i < cnt; i++) pos.push({ x: x0 + i * gap, y: ys[r], w: lw, hh: lh, fs })
    })
    const wy = wide ? H * 0.4 : H * 0.26
    art.replaceChildren(
      hills(W, wy, H * 0.12, 22),
      moon(W * (wide ? 0.82 : 0.78), H * (wide ? 0.14 : 0.1), Math.min(W, H) * 0.045),
      waterBand(W, wy, H, W * 0.8, 7),
      ...pos.map((p, i) => lanternArt(p, i)))
    const pv = pos[K.pivot]
    put(pivotBtn, pv.x - pv.w * 0.6, pv.y - pv.hh * 0.6)
    pivotBtn.style.width = `${f1(Math.max(44, pv.w * 1.2))}px`
    pivotBtn.style.height = `${f1(Math.max(48, pv.hh * 1.2))}px`
    const uy = Math.max(...ys) + lh * 0.9
    put(ui, 12, Math.min(uy, H - 150), W - 24)
    drawThreads(false)
  }

  function lanternArt(p: { x: number; y: number; w: number; hh: number; fs: number }, i: number) {
    const ws = words()
    const wt = lit ? K.endings[end].weights[i] ?? 0 : 0
    const isPivot = i === K.pivot
    const isEnd = i === ws.length - 1
    const tw = measure(ws[i], p.fs)
    const fs = tw > p.w * 0.84 ? (p.fs * p.w * 0.84) / tw : p.fs
    const rx = p.w / 2, ry = p.hh / 2
    const strong = lit ? wt / Math.max(...K.endings[end].weights) : 0
    return s('g', { class: `g8l-lan${isPivot ? ' pivot' : ''}${isEnd ? ' end' : ''}` },
      s('ellipse', { cx: f1(p.x), cy: f1(p.y + p.hh * 0.95), rx: f1(rx * 0.55), ry: f1(ry * 0.9), fill: glow, opacity: f1(0.25 + strong * 0.75) }),
      s('path', { class: 'ln', 'fill-opacity': f1(0.18 + strong * 0.5), d: stroke([[p.x, p.y + ry + 6], [p.x + 2, p.y + ry + p.hh * 0.4], [p.x - 1, p.y + ry + p.hh * 0.8]], rx * 0.5, 0.1, 0.6, 0.15) }),
      strong > 0.05 ? s('circle', { cx: f1(p.x), cy: f1(p.y), r: f1(p.w * (0.9 + strong * 0.7)), fill: glow, opacity: f1(strong) }) : null,
      s('path', { class: 'g8l-body', d: blob(p.x, p.y, rx, ry, 11 + i, 0.035) }),
      s('path', { class: 'ln', 'fill-opacity': f1(isPivot ? 0.45 : 0.1 + strong * 0.55), d: blob(p.x, p.y, rx, ry, 11 + i, 0.035) }),
      s('path', { class: 'g8l-rib', d: `M${f1(p.x - rx * 0.5)} ${f1(p.y - ry * 0.86)}Q${f1(p.x - rx * 0.75)} ${f1(p.y)} ${f1(p.x - rx * 0.5)} ${f1(p.y + ry * 0.86)}M${f1(p.x + rx * 0.5)} ${f1(p.y - ry * 0.86)}Q${f1(p.x + rx * 0.75)} ${f1(p.y)} ${f1(p.x + rx * 0.5)} ${f1(p.y + ry * 0.86)}` }),
      s('rect', { class: isPivot ? 'v' : 'k', x: f1(p.x - rx * 0.45), y: f1(p.y - ry - 3), width: f1(rx * 0.9), height: 5, rx: 1.5 }),
      s('rect', { class: isPivot ? 'v' : 'k', x: f1(p.x - rx * 0.45), y: f1(p.y + ry - 2), width: f1(rx * 0.9), height: 5, rx: 1.5 }),
      s('text', { class: 'g8l-word', x: f1(p.x), y: f1(p.y + fs * 0.35), 'font-size': f1(fs), 'text-anchor': 'middle' }, ws[i]))
  }

  function drawThreads(animate: boolean) {
    threads.replaceChildren()
    if (!lit || !pos.length) return
    const wts = K.endings[end].weights
    const top = K.endings[end].points
    const a = pos[K.pivot]
    const order = wts.map((w, i) => [w, i] as const).filter(([, i]) => i !== K.pivot).sort((x, y) => x[0] - y[0])
    for (const [w, i] of order) {
      const b = pos[i]
      const up = b.y < a.y - 2
      const ax = a.x, ay = a.y - a.hh / 2 - 2
      const bx = b.x, by = up ? b.y + b.hh / 2 + 4 : b.y - b.hh / 2 - 2
      const lift = up ? 0 : Math.min(a.hh * 1.5, 26 + Math.abs(bx - ax) * 0.3)
      const cx = (ax + bx) / 2, cy = (up ? (ay + by) / 2 : Math.min(ay, by) - lift)
      const d = `M${f1(ax)} ${f1(ay)}Q${f1(cx)} ${f1(cy)} ${f1(bx)} ${f1(by)}`
      const strong = i === top
      if (strong) threads.append(s('path', { class: 'g8l-thread glow', d, 'stroke-width': f1(7 + w * 10) }))
      const p = s('path', { class: `g8l-thread${strong ? ' top' : ''}`, d, 'stroke-width': f1(0.6 + w * 6), opacity: f1(Math.min(1, 0.18 + w * 1.8)) })
      threads.append(p)
      if (animate) drawIn(ctx, p, strong ? 1400 : 900, strong ? 250 : 0)
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
    redraw()
    drawThreads(true)
  }

  function swap() {
    end = 1 - end
    swapBtn.setAttribute('aria-label', fill(K.swapAria, { word: K.endings[1 - end].word }))
    setRead()
    ctx.chime('tap')
    redraw()
    drawThreads(true)
  }
}
