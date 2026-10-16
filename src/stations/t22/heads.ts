import { h, s } from '../../core/dom'
import type { SceneCtx } from '../types'
import { onDigit } from '../../ui/part2/ink'
import { C } from './data'
import { brushLines, drawIn, f1, measure, mist, nightShore, put, rng, stage, stroke, toro, wash, type Pt } from './kit'

const K = C.scenes.heads

/** Scene 2 — four stone lanterns, four ink tones, on a curved bridge: each shines on the same sentence on the water and joins its words into its own constellation. */
export function headsScene(ctx: SceneCtx) {
  const on = K.heads.map(() => false)
  let done = false
  const btns = K.heads.map((hd, i) =>
    h('button', { class: `g8h-lamp h${i}`, type: 'button', 'aria-pressed': 'false', 'aria-label': hd.aria, onClick: () => toggle(i) },
      h('span', { class: 'g8h-num', 'aria-hidden': 'true' }, String(i + 1)), h('span', { class: 'g8h-name' }, hd.name)))
  const cap = h('div', { class: 'g8h-cap' })
  const back = s('g')
  const beams = s('g')
  const words = s('g')
  const links = s('g', { class: 'g8h-links' })
  const { root, svg } = stage(ctx, 'g8h', K.art, [K.insight], draw)
  svg.append(back, beams, words, links)
  root.append(...btns, cap)
  ctx.prompt(K.prompt)
  ctx.onCleanup(onDigit((d) => d <= K.heads.length && toggle(d - 1)))

  let wpos: { x: number; y: number; w: number }[] = []
  let lamps: Pt[] = []
  let toros: SVGGElement[] = []
  let fs = 16
  let U = 60

  function draw(W: number, H: number) {
    const wide = W > 700
    const by = H * (wide ? 0.36 : 0.28)
    const rise = H * (wide ? 0.11 : 0.07)
    const x0 = W * 0.03, x1 = W * 0.97
    const deck = (t: number): Pt => [x0 + (x1 - x0) * t, by - Math.sin(Math.PI * t) * rise]
    const u = (U = Math.min(wide ? 92 : 62, H * 0.15))
    const ts = wide ? [0.2, 0.4, 0.6, 0.8] : [0.14, 0.38, 0.62, 0.86]
    lamps = ts.map((t) => deck(t))
    const wy = by + u * 0.32 // the waterline under the bridge
    // the sentence on the water
    fs = Math.max(15, Math.min(23, W * 0.026))
    const gap = fs * 0.62
    const ws = K.words.map((w) => measure(w, fs))
    const total = ws.reduce((a, w) => a + w + gap * 2, 0)
    const per = total > W - 40 ? Math.ceil(ws.length / 2) : ws.length
    const rows: number[][] = [ws.map((_, i) => i).slice(0, per), ws.map((_, i) => i).slice(per)].filter((r) => r.length)
    const rowY = rows.length === 1 ? [wy + (H - wy) * 0.42] : rows.map((_, r) => wy + (H - wy) * (0.3 + r * 0.2))
    wpos = []
    rows.forEach((idx, r) => {
      const tot = idx.reduce((a, i) => a + ws[i], 0) + gap * 2 * (idx.length - 1)
      let x = W / 2 - tot / 2
      for (const i of idx) {
        wpos[i] = { x: x + ws[i] / 2, y: rowY[r], w: ws[i] }
        x += ws[i] + gap * 2
      }
    })
    back.replaceChildren(...nightShore(W, wy, H, { seed: 31, mx: W * (wide ? 0.5 : 0.84), my: H * (wide ? 0.09 : 0.06), mr: Math.min(W, H) * 0.038, hh: rise * 1.6 + u * 0.4, side: 1 }),
      ...bridge(W, deck, by, rise, wy, u),
      // a band of moonlit mist on the water where the sentence is written
      ...rowY.map((y) => mist(W / 2, y - fs * 0.3, Math.min(W * 0.46, total * 0.62 + 40), fs * 1.9)))
    toros = lamps.map(([x, y], i) => {
      const g = toro(x, y + 1, u, true)
      g.classList.add('g8h-toro', `h${i}`)
      g.classList.toggle('lit', on[i])
      // the ink tone of each lamp: its own stone painted over with the tone (no filter, so it stays light)
      const st = g.querySelector('.p2p-toro-shade')
      if (st) st.after(s('path', { class: 'g8h-tone', d: st.getAttribute('d')! }))
      return g
    })
    back.append(...toros)
    words.replaceChildren(...K.words.map((w, i) => s('text', { class: 'g8h-word', x: f1(wpos[i].x), y: f1(wpos[i].y + fs * 0.35), 'font-size': f1(fs), 'text-anchor': 'middle' }, w)))
    btns.forEach((b, i) => {
      const [x, y] = lamps[i]
      put(b, x - u * 0.3, y - u * 0.98)
      b.style.width = `${f1(u * 0.6)}px`
      b.style.height = `${f1(u * 1.02)}px`
    })
    const capY = rowY[rowY.length - 1] + fs * 2.2
    put(cap, 16, capY, W - 32)
    drawLinks(false)
  }

  /** A curved wooden bridge in brush strokes: arch, deck planks, railing, piers in the water and its broken reflection. */
  function bridge(W: number, deck: (t: number) => Pt, by: number, rise: number, wy: number, u: number): SVGElement[] {
    const r = rng(2202)
    const N = 40
    const top = Array.from({ length: N + 1 }, (_, i) => deck(i / N))
    const th = Math.max(7, u * 0.13)
    const under = top.map(([x, y]) => [x, y + th] as Pt)
    // railing: a top rail and posts, a little above the deck
    const rh = u * 0.3
    const rail = top.map(([x, y]) => [x, y - rh] as Pt)
    const posts: number[][] = []
    for (let i = 1; i < 16; i++) {
      const [x, y] = deck(i / 16)
      posts.push([x, y + 1, x + (r() - 0.5), y - rh - 2])
    }
    const planks: number[][] = []
    for (let i = 1; i < 60; i++) {
      const [x, y] = deck(i / 60)
      planks.push([x, y + th * 0.25, x + 0.6, y + th * 0.9])
    }
    // piers: pairs of legs from the deck down into the water
    const legs: number[][] = []
    for (const t of [0.12, 0.3, 0.5, 0.7, 0.88]) {
      const [x, y] = deck(t)
      legs.push([x - 7, y + th, x - 8, wy + 6], [x + 7, y + th, x + 8, wy + 6])
    }
    const ref = (pts: Pt[]) => pts.map(([x, y]) => [x, 2 * wy - y + 3] as Pt)
    let rip = ''
    for (let i = 0; i < 26; i++) {
      const t = r()
      const [x, y] = deck(t)
      const ry = 2 * wy - y + 3 + r() * 6
      rip += stroke([[x - 18 - r() * 30, ry], [x + 10 + r() * 30, ry + (r() - 0.5)]], 1.2 + r() * 1.4, 0.3, 0.3, 0.1)
    }
    return [
      // reflection first: arch and legs mirrored, faint and broken by ripples
      s('path', { class: 'g8h-refl', d: stroke(ref(top), th * 1.1, 0.04, 0.04, 0.6) + brushLines(legs.map(([a, b, c, d]) => [a, 2 * wy - b + 3, c, 2 * wy - d + 3]), 4), filter: 'url(#ink-wash)' }),
      s('path', { class: 'g8h-rip', d: rip }),
      s('path', { class: 'g8h-legs', d: brushLines(legs, Math.max(4, u * 0.07), 0.05, 0.05), filter: 'url(#ink-rough)' }),
      wash(`M${top.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}L${[...under].reverse().map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}Z`, 0.9, 'p2p-wash g8h-deck'),
      s('path', { class: 'g8h-plank', d: brushLines(planks, 1.1, 0.2, 0.2) }),
      s('path', { class: 'g8h-edge', d: stroke(top, Math.max(2.4, th * 0.32), 0.05, 0.05, 0.5) + stroke(under, Math.max(2, th * 0.26), 0.05, 0.05, 0.5), filter: 'url(#ink-rough)' }),
      s('path', { class: 'g8h-rim', d: stroke(top.slice(4, N - 4).map(([x, y]) => [x, y - 1.2] as Pt), 1.4, 0.3, 0.3, 0.1) }),
      s('path', { class: 'g8h-rail', d: stroke(rail, Math.max(2, u * 0.035), 0.06, 0.06, 0.5) + brushLines(posts, Math.max(2.2, u * 0.04), 0.05, 0.05), filter: 'url(#ink-rough)' }),
      // the banks the bridge lands on
      wash(`M0 ${f1(wy + 6)}L0 ${f1(by - rise * 0.05)}Q${f1(W * 0.04)} ${f1(by + 4)} ${f1(W * 0.09)} ${f1(wy + 4)}Z`, 0.5),
      wash(`M${f1(W)} ${f1(wy + 6)}L${f1(W)} ${f1(by - rise * 0.05)}Q${f1(W * 0.96)} ${f1(by + 4)} ${f1(W * 0.91)} ${f1(wy + 4)}Z`, 0.5),
    ]
  }

  function drawLinks(animateIdx: number | false) {
    beams.replaceChildren()
    links.replaceChildren()
    if (!wpos.length) return
    K.heads.forEach((hd, i) => {
      if (!on[i]) return
      // a cone of light falling from the lamp to the words it joins (gradient stops read --hc from their own group)
      const ids = [...new Set(hd.links.flat())]
      const xs = ids.map((k) => wpos[k].x)
      const yb = Math.max(...ids.map((k) => wpos[k].y)) + fs * 0.6
      const [lx, ly] = lamps[i]
      const spread = Math.max(...xs) - Math.min(...xs) + fs * 3
      const mx = (Math.max(...xs) + Math.min(...xs)) / 2
      const id = `g8h-beam-${i}`
      const fy = ly - U * 0.62
      beams.append(s('g', { class: `h${i}` },
        s('defs', null, s('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 },
          s('stop', { offset: 0, class: 'g8h-stop', style: 'stop-opacity:.34' }),
          s('stop', { offset: 0.7, class: 'g8h-stop', style: 'stop-opacity:.1' }),
          s('stop', { offset: 1, class: 'g8h-stop', style: 'stop-opacity:0' }))),
        s('path', { class: 'g8h-beam', fill: `url(#${id})`, d: `M${f1(lx - U * 0.08)} ${f1(fy)}L${f1(lx + U * 0.08)} ${f1(fy)}L${f1(mx + spread / 2)} ${f1(yb)}L${f1(mx - spread / 2)} ${f1(yb)}Z`, filter: 'url(#ink-wash)' }),
        // where the light lands: a soft pool on the water under the words it joins
        s('ellipse', { class: 'g8h-pool', cx: f1(mx), cy: f1(yb - fs * 0.6), rx: f1(spread * 0.55), ry: f1(fs * 1.3), filter: 'url(#ink-wash)' })))
      const g = s('g', { class: `g8h-con h${i}` })
      const stars = new Set<number>()
      hd.links.forEach(([a, b], k) => {
        const A = wpos[a], B = wpos[b]
        const below = i === 2
        const sameRow = Math.abs(A.y - B.y) < 2
        const lift = (sameRow ? 12 + Math.abs(B.x - A.x) * 0.26 : 0) + i * 5
        const ay = below ? A.y + fs * 0.8 : A.y - fs * 1
        const byy = sameRow ? (below ? B.y + fs * 0.8 : B.y - fs * 1) : B.y + (B.y < A.y ? fs * 0.65 : -fs * 1)
        const cy = sameRow ? (below ? ay + lift : ay - lift) : (ay + byy) / 2
        const p = s('path', { class: 'g8h-link', d: `M${f1(A.x)} ${f1(ay)}Q${f1((A.x + B.x) / 2)} ${f1(cy)} ${f1(B.x)} ${f1(byy)}` })
        g.append(p)
        if (animateIdx === i) drawIn(ctx, p, 800, k * 90)
        for (const [w, yy] of [[a, ay], [b, byy]] as const) {
          if (stars.has(w * 1000 + Math.round(yy))) continue
          stars.add(w * 1000 + Math.round(yy))
          g.append(star(wpos[w].x, yy, i === 3 ? 4.2 : 3.4))
        }
      })
      links.append(g)
    })
  }

  /** A small four-pointed star where a thread touches a word. */
  function star(x: number, y: number, r: number) {
    const k = r * 0.28
    return s('path', { class: 'g8h-star', d: `M${f1(x)} ${f1(y - r)}Q${f1(x + k)} ${f1(y - k)} ${f1(x + r)} ${f1(y)}Q${f1(x + k)} ${f1(y + k)} ${f1(x)} ${f1(y + r)}Q${f1(x - k)} ${f1(y + k)} ${f1(x - r)} ${f1(y)}Q${f1(x - k)} ${f1(y - k)} ${f1(x)} ${f1(y - r)}Z` })
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
    toros[i]?.classList.toggle('lit', on[i])
    drawLinks(on[i] ? i : false)
  }

}
