import { fill, h, s } from '../../core/dom'
import { stroke, type Pt } from '../../ui/part2/ink'
import type { SceneCtx } from '../types'
import C from '../../content/tram-26.json'
import { F, P, f1, moon, place, rake, stage } from '../t25/kit'

/** A woven bamboo basket standing on (x, y), w wide: body, weave, rim, and four slips that show as it fills. */
function basket(x: number, y: number, w: number) {
  const hh = w * 0.62, top = y - hh, b = w * 0.36
  const side = (t: number): [Pt, Pt] => [[x - w / 2 + (w / 2 - b) * t, top + hh * t], [x + w / 2 - (w / 2 - b) * t, top + hh * t]]
  let weave = ''
  for (let i = 1; i < 6; i++) { const [l, r] = side(i / 6); weave += stroke([l, [(l[0] + r[0]) / 2, l[1] + 3], r], 1.3, 0.05, 0.05, 0.6) }
  for (let i = 1; i < 8; i++) { const t = i / 8; weave += stroke([[x - w / 2 + w * t, top], [x - b + 2 * b * t, y]], 1, 0.05, 0.05, 0.6) }
  const slips = [0, 1, 2, 3].map((i) => s('path', { class: 't26s-in', d: `M${P([x - w * 0.3 + i * w * 0.16, top + 4])}l${f1(w * 0.06)} ${f1(-w * 0.22)}l${f1(w * 0.12)} ${f1(w * 0.03)}l${f1(-w * 0.05)} ${f1(w * 0.22)}Z` }))
  const g = s('g', null,
    s('ellipse', { class: 'zk-sh', cx: x + 4, cy: y, rx: b * 1.2, ry: w * 0.05 }),
    ...slips,
    s('path', { class: 't26s-body', d: `M${P(side(0)[0])}L${P(side(0)[1])}L${P([x + b, y])}Q${f1(x)} ${f1(y + w * 0.06)} ${P([x - b, y])}Z`, filter: 'url(#ink-rough)' }),
    s('path', { class: 't26s-weave', d: weave }),
    s('ellipse', { class: 't26s-rim', cx: x, cy: top, rx: w / 2, ry: w * 0.07 }))
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
    baskets = xs.map((x) => basket(x, by, bw))
    svg.replaceChildren(rake(W, top + 60, H, 8, 9), moon(W * 0.9, top + 18, Math.min(W, H) * 0.024), ...baskets.map((b) => b.g))
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
