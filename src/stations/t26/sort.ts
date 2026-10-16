import { fill, h, s } from '../../core/dom'
import { curve, rng, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist, moon } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import C from '../../content/tram-26.json'
import { F, P, f1, place, stage } from '../t25/kit'

/** A woven bamboo basket standing on (x, y), w wide: body, checker weave, bound rim, and four slips that show as it fills. */
function basket(x: number, y: number, w: number, seed: number) {
  const r = rng(seed)
  const hh = w * 0.62, top = y - hh, b = w * 0.36
  const side = (t: number): [Pt, Pt] => [[x - w / 2 + (w / 2 - b) * t, top + hh * t], [x + w / 2 - (w / 2 - b) * t, top + hh * t]]
  let weave = '', ribs = ''
  for (let i = 1; i < 8; i++) {
    const [l, rr] = side(i / 8)
    const n = 9
    for (let k = (i % 2); k < n; k += 2) {
      const u0 = k / n, u1 = (k + 0.85) / n
      const P0: Pt = [l[0] + (rr[0] - l[0]) * u0, l[1] + Math.sin(u0 * Math.PI) * w * 0.035]
      const P1: Pt = [l[0] + (rr[0] - l[0]) * u1, l[1] + Math.sin(u1 * Math.PI) * w * 0.035]
      weave += stroke([P0, P1], w * 0.03 * (0.8 + r() * 0.4), 0.2, 0.2, 0.4)
    }
  }
  for (let i = 1; i < 9; i++) {
    const t = i / 9
    ribs += stroke([[x - w / 2 + w * t, top + 2], [x - b + 2 * b * t, y - 1]], 1, 0.05, 0.05, 0.6)
  }
  const rim: Pt[] = Array.from({ length: 33 }, (_, i) => {
    const a = (i / 32) * Math.PI * 2
    return [x + Math.cos(a) * w * 0.5, top + Math.sin(a) * w * 0.075]
  })
  let wraps = ''
  for (let i = 0; i < 7; i++) {
    const p = rim[18 + i * 2]
    wraps += stroke([[p[0] - 2, p[1] - w * 0.03], [p[0] + 2, p[1] + w * 0.03]], 1.6, 0.2, 0.2, 0.4)
  }
  const body = `M${P(side(0)[0])}L${P(side(0)[1])}L${P([x + b, y])}Q${f1(x)} ${f1(y + w * 0.07)} ${P([x - b, y])}Z`
  const slips = [0, 1, 2, 3].map((i) => s('path', { class: 't26s-in', d: `M${P([x - w * 0.3 + i * w * 0.16, top + 3])}l${f1(w * 0.05)} ${f1(-w * 0.24)}l${f1(w * 0.12)} ${f1(w * 0.03)}l${f1(-w * 0.04)} ${f1(w * 0.22)}Z` }))
  const g = s('g', null,
    s('ellipse', { class: 't26s-sh', cx: f1(x + w * 0.06), cy: f1(y + 2), rx: f1(b * 1.35), ry: f1(w * 0.06) }),
    s('ellipse', { class: 't26s-mouth', cx: f1(x), cy: f1(top), rx: f1(w * 0.47), ry: f1(w * 0.065) }),
    ...slips,
    s('path', { class: 't26s-body', d: body, filter: 'url(#ink-rough)' }),
    s('path', { d: body, fill: 'url(#p2-shade)' }),
    s('path', { class: 't26s-rib', d: ribs }),
    s('path', { class: 't26s-weave', d: weave }),
    s('path', { class: 't26s-rim', d: stroke(rim.slice(16), w * 0.055, 0.02, 0.02, 0.8) + stroke(rim.slice(0, 17), w * 0.035, 0.02, 0.02, 0.8), filter: 'url(#ink-rough)' }),
    s('path', { class: 'zk-ink t26s-wrap', d: wraps }),
    s('path', { class: 'zk-ink t26s-edge', d: stroke([side(0)[1], [x + b, y]], 1.8, 0.1, 0.3, 0.3) + stroke(curve([x + b, y], [x, y + w * 0.08], [x - b * 0.6, y + w * 0.02], 8), 1.8, 0.1, 0.5, 0.2), filter: 'url(#ink-rough)' }))
  return { g, slips }
}

/** Scene 4 — paper slips flutter down under the moon; drop each into the right bamboo basket. */
export function sortScene(ctx: SceneCtx) {
  const R = C.scenes.rule
  const K = R.sort
  const cases = K.cases
  let idx = 0
  const count = [0, 0]
  const q = h('p', { class: 'p2-question zk-q t26s-q' }, K.prompt)
  const slipText = h('p', { class: 't26s-text' }, cases[0].text)
  const slip = h('div', { class: 't26s-slip' }, slipText)
  const fb = h('p', { class: 't26s-fb', hidden: true })
  const labels = [h('p', { class: 'zk-lab t26s-lab' }, K.yes), h('p', { class: 'zk-lab t26s-lab' }, K.no)]
  const bins = [0, 1].map((b) => h('button', { class: 'zk-hit t26s-basket', type: 'button', onClick: () => choose(b) }))
  const col = h('div', { class: 't26s-col' }, slip, fb)
  const note = h('div', { class: 'zk-small t26s-note' }, ctx.fact(F(K.note), 'div'))
  let baskets: ReturnType<typeof basket>[] = []
  const aria = () => bins.forEach((b, i) => b.setAttribute('aria-label', idx < cases.length ? fill(i ? K.noAria : K.yesAria, { text: cases[idx].text }) : i ? K.no : K.yes))
  aria()

  const { root, svg } = stage(ctx, 't26s', R.art, [R.insight], (W, H) => {
    const land = W / H > 1.05
    const cw = Math.min(W - 24, 520)
    place(q, (W - cw) / 2, 4, cw)
    const top = q.offsetHeight + 12
    const sw = Math.min(W - 40, 440)
    place(col, (W - sw) / 2, top + 8, sw)
    const bw = land ? Math.min(W * 0.2, 240) : W * 0.34
    const by = H - 34
    const xs = land ? [W * 0.34, W * 0.66] : [W * 0.26, W * 0.74]
    baskets = xs.map((x, i) => basket(x, by, bw, 2640 + i))
    const hz = land ? top + Math.min(170, H * 0.34) : top + 120
    const r = rng(2645)
    let comb = ''
    for (let y = hz + 16; y < H - 4; y += 11 + r() * 5) {
      for (let x = -10; x < W + 10; ) {
        const len = 40 + r() * 160
        comb += stroke([[x, y + (r() - 0.5)], [x + len * 0.5, y + Math.sin(x) * 1.2], [x + len, y + (r() - 0.5)]], 1 + r() * 0.7, 0.15, 0.15, 0.2)
        x += len + 14 + r() * 60
      }
    }
    svg.replaceChildren(
      mist(W * 0.88, top + 20, W * 0.3, H * 0.14),
      moon(W * 0.88, top + 22, Math.min(W, H) * 0.024, 2646, true),
      hills(-W * 0.04, W * 1.04, hz, Math.min(90, H * 0.14), 2647, 0.9, 6),
      mist(W * 0.5, hz, W * 0.7, H * 0.06),
      s('path', { class: 't26s-comb', d: comb }),
      ...xs.map((x, i) => grass(x + bw * (i ? 0.55 : -0.55), by + 2, 18, 2648 + i)),
      s('g', { transform: `translate(${f1(land ? W * 0.21 : W * 0.06)} ${f1(by - 4)})` }, stoneArt(bw * 0.42, bw * 0.26, 2650)),
      s('g', { transform: `translate(${f1(land ? W * 0.86 : W * 0.95)} ${f1(by - bw * 0.4)})` }, stoneArt(bw * 0.3, bw * 0.2, 2651)),
      ...baskets.map((b) => b.g))
    xs.forEach((x, i) => {
      place(bins[i], x - bw / 2 - 6, by - bw * 0.62 - 20, bw + 12)
      bins[i].style.height = `${f1(bw * 0.62 + 30)}px`
      place(labels[i], x - bw * 0.7, by + 4, bw * 1.4)
      baskets[i].slips.forEach((p, k) => p.classList.toggle('on', k < count[i]))
    })
    place(note, 12, land ? H - 52 : by - bw * 0.62 - 112, land ? Math.min(W * 0.2, 240) : W - 24)
  })
  root.append(q, col, ...bins, ...labels, note)
  ctx.prompt(K.pill)

  function choose(b: number) {
    if (idx >= cases.length) return
    const c = cases[idx]
    const right = c.banned === (b === 0)
    fb.hidden = false
    if (!fb.hasAttribute('aria-live')) fb.setAttribute('aria-live', 'polite')
    if (!right) {
      fb.textContent = K.wrong
      slip.classList.remove('shake')
      void slip.offsetWidth
      slip.classList.add('shake')
      ctx.chime('low')
      return
    }
    ctx.chime('ok')
    fb.replaceChildren(h('strong', null, K.right), ` — ${c.why}`)
    count[b]++
    baskets[b]?.slips[count[b] - 1]?.classList.add('on')
    idx++
    if (idx < cases.length) {
      slipText.textContent = cases[idx].text
      slip.classList.remove('next')
      void slip.offsetWidth
      slip.classList.add('next')
    } else {
      slip.classList.add('gone')
      ctx.insight(F(R.insight), F(R.detail))
    }
    aria()
  }
}
