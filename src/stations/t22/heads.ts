import { h, s } from '../../core/dom'
import type { SceneCtx } from '../types'
import { onDigit } from '../../ui/part2/ink'
import { C } from './data'
import { drawIn, f1, hills, measure, moon, put, stage, stroke, waterBand, type Pt } from './kit'

const K = C.scenes.heads

/** Scene 2 — four stone lanterns on a curved bridge each shine on the same sentence and draw their own constellation. */
export function headsScene(ctx: SceneCtx) {
  const on = K.heads.map(() => false)
  let done = false
  const btns = K.heads.map((hd, i) =>
    h('button', { class: `g8h-lamp h${i}`, type: 'button', 'aria-pressed': 'false', 'aria-label': hd.aria, onClick: () => toggle(i) },
      h('span', { class: 'g8h-num', 'aria-hidden': 'true' }, String(i + 1)), h('span', { class: 'g8h-name' }, hd.name)))
  const cap = h('div', { class: 'g8h-cap' })
  const back = s('g')
  const beams = s('g')
  const links = s('g', { class: 'g8h-links' })
  const words = s('g')
  const { root, svg } = stage(ctx, 'g8h', K.art, [K.insight], draw)
  svg.append(back, beams, links, words)
  root.append(...btns, cap)
  ctx.prompt(K.prompt)
  ctx.onCleanup(onDigit((d) => d <= K.heads.length && toggle(d - 1)))

  let wpos: { x: number; y: number; w: number }[] = []
  let lamps: Pt[] = []
  let fs = 16

  function draw(W: number, H: number) {
    const wide = W > 700
    // the bridge: a taiko arc across the top
    const by = H * (wide ? 0.33 : 0.27)
    const rise = H * 0.1
    const x0 = W * 0.04, x1 = W * 0.96
    const deck = (t: number): Pt => [x0 + (x1 - x0) * t, by - Math.sin(Math.PI * t) * rise]
    const deckPts = Array.from({ length: 25 }, (_, i) => deck(i / 24))
    const u = Math.min(wide ? 74 : 54, H * 0.13)
    const ts = wide ? [0.2, 0.4, 0.6, 0.8] : [0.15, 0.38, 0.62, 0.85]
    lamps = ts.map((t) => deck(t))
    // the sentence on the water
    fs = Math.max(14, Math.min(22, W * 0.026))
    const gap = fs * 0.55
    const ws = K.words.map((w) => measure(w, fs))
    const total = ws.reduce((a, w) => a + w + gap * 2, 0)
    const per = total > W - 40 ? Math.ceil(ws.length / 2) : ws.length
    const rows: number[][] = [ws.map((_, i) => i).slice(0, per), ws.map((_, i) => i).slice(per)].filter((r) => r.length)
    const wy0 = by + rise * 0.2 + u * 0.35
    const rowY = rows.length === 1 ? [H * 0.6] : rows.map((_, r) => H * (0.45 + r * 0.12))
    wpos = []
    rows.forEach((idx, r) => {
      const tot = idx.reduce((a, i) => a + ws[i], 0) + gap * 2 * (idx.length - 1)
      let x = W / 2 - tot / 2
      for (const i of idx) {
        wpos[i] = { x: x + ws[i] / 2, y: rowY[r], w: ws[i] }
        x += ws[i] + gap * 2
      }
    })
    back.replaceChildren(
      hills(W, by - rise * 0.6, H * 0.1, 31),
      moon(W * (wide ? 0.5 : 0.88), H * (wide ? 0.08 : 0.05), Math.min(W, H) * 0.035),
      waterBand(W, wy0, H, W * 0.5, 13),
      // the bridge's reflection, then the bridge
      s('path', { class: 'g8h-refl', d: stroke(deckPts.map(([x, y]) => [x, 2 * wy0 - y + 4] as Pt), 6, 0.1, 0.1, 0.3) }),
      s('path', { class: 'k', d: stroke(deckPts, Math.max(5, u * 0.12), 0.05, 0.05, 0.6), filter: 'url(#ink-rough)' }),
      s('path', { class: 'v', 'fill-opacity': 0.75, d: stroke(deckPts.map(([x, y]) => [x, y - u * 0.32] as Pt), 2.4, 0.05, 0.05, 0.6) }),
      ...[0.06, 0.12, 0.3, 0.5, 0.7, 0.88, 0.94].map((t) => {
        const [x, y] = deck(t)
        return s('rect', { class: 'v', 'fill-opacity': 0.75, x: f1(x - 1.6), y: f1(y - u * 0.32), width: 3.2, height: f1(u * 0.32) })
      }),
      s('path', { class: 'k', 'fill-opacity': 0.5, d: stroke([deck(0.02), [x0 + 6, wy0 + 4]], 4) + stroke([deck(0.98), [x1 - 6, wy0 + 4]], 4) }),
      ...lamps.map(([x, y], i) => toro(x, y, u, i)))
    words.replaceChildren(...K.words.map((w, i) => s('text', { class: 'g8h-word', x: f1(wpos[i].x), y: f1(wpos[i].y + fs * 0.35), 'font-size': f1(fs), 'text-anchor': 'middle' }, w)))
    btns.forEach((b, i) => {
      const [x, y] = lamps[i]
      put(b, x - u * 0.55, y - u * 1.25)
      b.style.width = `${f1(u * 1.1)}px`
      b.style.height = `${f1(u * 1.3)}px`
    })
    const capY = rowY[rowY.length - 1] + fs * 2.6
    put(cap, 16, capY, W - 32)
    drawLinks(false)
  }

  function toro(x: number, y: number, u: number, i: number) {
    const w = u * 0.5
    const lit = on[i]
    return s('g', { class: `g8h-toro h${i}${lit ? ' lit' : ''}` },
      s('circle', { class: 'g8h-halo', cx: f1(x), cy: f1(y - u * 0.62), r: f1(u * 0.7) }),
      s('path', { class: 'k', 'fill-opacity': 0.85, d: `M${f1(x - w * 0.5)} ${f1(y)}L${f1(x + w * 0.5)} ${f1(y)}L${f1(x + w * 0.38)} ${f1(y - u * 0.1)}L${f1(x - w * 0.38)} ${f1(y - u * 0.1)}Z` }),
      s('rect', { class: 'k', 'fill-opacity': 0.8, x: f1(x - w * 0.14), y: f1(y - u * 0.42), width: f1(w * 0.28), height: f1(u * 0.33) }),
      s('rect', { class: 'k', 'fill-opacity': 0.85, x: f1(x - w * 0.42), y: f1(y - u * 0.48), width: f1(w * 0.84), height: f1(u * 0.07), rx: 1 }),
      s('rect', { class: 'k', 'fill-opacity': 0.75, x: f1(x - w * 0.32), y: f1(y - u * 0.76), width: f1(w * 0.64), height: f1(u * 0.28) }),
      s('rect', { class: 'g8h-win', x: f1(x - w * 0.18), y: f1(y - u * 0.72), width: f1(w * 0.36), height: f1(u * 0.2), rx: 1 }),
      s('path', { class: 'k', d: `M${f1(x - w * 0.75)} ${f1(y - u * 0.74)}Q${f1(x - w * 0.3)} ${f1(y - u * 0.8)} ${f1(x)} ${f1(y - u * 0.98)}Q${f1(x + w * 0.3)} ${f1(y - u * 0.8)} ${f1(x + w * 0.75)} ${f1(y - u * 0.74)}Z`, filter: 'url(#ink-rough)' }),
      s('circle', { class: 'k', cx: f1(x), cy: f1(y - u * 1.02), r: f1(u * 0.05) }))
  }

  function drawLinks(animateIdx: number | false) {
    beams.replaceChildren()
    links.replaceChildren()
    if (!wpos.length) return
    K.heads.forEach((hd, i) => {
      if (!on[i]) return
      // a cone of light from the lamp to the words it joins
      const ids = [...new Set(hd.links.flat())]
      const xs = ids.map((k) => wpos[k].x)
      const ym = Math.min(...ids.map((k) => wpos[k].y)) - fs
      const [lx, ly] = lamps[i]
      const spread = Math.max(...xs) - Math.min(...xs) + fs * 3
      const mx = (Math.max(...xs) + Math.min(...xs)) / 2
      beams.append(s('path', { class: `g8h-beam h${i}`, d: `M${f1(lx - 4)} ${f1(ly - 18)}L${f1(lx + 4)} ${f1(ly - 18)}L${f1(mx + spread / 2)} ${f1(ym + fs * 1.6)}L${f1(mx - spread / 2)} ${f1(ym + fs * 1.6)}Z` }))
      hd.links.forEach(([a, b], k) => {
        const A = wpos[a], B = wpos[b]
        const below = i === 2
        const sameRow = Math.abs(A.y - B.y) < 2
        const lift = (sameRow ? 14 + Math.abs(B.x - A.x) * 0.28 : 0) + i * 5
        const ay = below ? A.y + fs * 0.75 : A.y - fs * 0.95
        const byy = sameRow ? (below ? B.y + fs * 0.75 : B.y - fs * 0.95) : B.y + (B.y < A.y ? fs * 0.6 : -fs * 0.95)
        const cy = sameRow ? (below ? ay + lift : ay - lift) : (ay + byy) / 2
        const p = s('path', { class: `g8h-link h${i}`, d: `M${f1(A.x)} ${f1(ay)}Q${f1((A.x + B.x) / 2)} ${f1(cy)} ${f1(B.x)} ${f1(byy)}` })
        links.append(p, s('circle', { class: `g8h-dot h${i}`, cx: f1(B.x), cy: f1(byy), r: 3.4 }))
        if (animateIdx === i) drawIn(ctx, p, 800, k * 90)
      })
    })
  }

  function toggle(i: number) {
    on[i] = !on[i]
    btns[i].setAttribute('aria-pressed', String(on[i]))
    ctx.chime(on[i] ? 'tap' : 'soft')
    const hd = K.heads[i]
    const all = on.every(Boolean)
    if (all && !done) {
      done = true
      cap.replaceChildren(h('p', { class: 'g8h-all' }, K.allLit), ctx.fact(K.caveat, 'p', 'g8-note'), ctx.fact(K.headsNote, 'p', 'g8-note'))
      ctx.insight(K.insight, K.detail)
    } else if (!done) {
      cap.replaceChildren(h('p', { class: `g8h-rel h${i}` }, h('b', null, hd.name), ' · ', hd.relation))
      if (!cap.hasAttribute('aria-live')) cap.setAttribute('aria-live', 'polite')
    }
    // redraw the lamps (lit window + halo) and the links
    const g = svg.querySelectorAll<SVGGElement>('.g8h-toro')[i]
    g?.classList.toggle('lit', on[i])
    drawLinks(on[i] ? i : false)
  }
}
