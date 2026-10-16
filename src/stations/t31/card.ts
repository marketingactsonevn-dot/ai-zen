import raw from '../../content/tram-31.json'
import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { onDigit, onSize } from '../../ui/part2/ink'
import { brushFrame, grass, water } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import { blob, cardSheet, ground, lantern, live, night, rng, stroke, type Pt } from './kit'
import { wellArt } from './wells'

const K = raw.scenes.card
const f1 = (n: number) => (Math.round(n * 10) / 10).toString()

/** The stele's own painting in its box (W × H px): stone face with moss, carved margin, plinth, and the moon puddle below. */
function paintStele(svg: SVGSVGElement, W: number, H: number) {
  const r = rng(3141)
  const arch = Math.min(70, W * 0.17)
  // the face: straight sides that lean a little, a rounded, slightly lopsided crown, a flat foot
  const face = `M2 ${f1(H)}L${f1(1 + r() * 2)} ${f1(arch)}C${f1(W * 0.02)} ${f1(arch * 0.3)} ${f1(W * 0.26)} 0 ${f1(W * 0.54)} 0C${f1(W * 0.8)} 0 ${f1(W - 3)} ${f1(arch * 0.36)} ${f1(W - 1 - r() * 2)} ${f1(arch)}L${f1(W - 2)} ${f1(H)}Z`
  // the crown's two cubic halves, sampled for the ink edge and the moonlit rim
  const halves = [[[2, arch], [W * 0.02, arch * 0.3], [W * 0.26, 0], [W * 0.54, 0]], [[W * 0.54, 0], [W * 0.8, 0], [W - 3, arch * 0.36], [W - 1, arch]]]
  const crown: Pt[] = Array.from({ length: 13 }, (_, i) => {
    const P = halves[i < 7 ? 0 : 1], t = i < 7 ? i / 6 : (i - 6) / 6, u = 1 - t
    return [0, 1].map((c) => u * u * u * P[0][c] + 3 * u * u * t * P[1][c] + 3 * u * t * t * P[2][c] + t * t * t * P[3][c]) as Pt
  })
  const moss = blob(W * 0.05, H - 8, W * 0.07, 9, 3142, 0.35, 14) + blob(W * 0.86, arch * 0.42, W * 0.07, 7, 3143, 0.35, 12) + blob(W * 0.7, H - 3, W * 0.08, 5, 3144, 0.35, 12) + blob(W * 0.015, H * 0.55, 5, 18, 3145, 0.3, 10)
  let lichen = ''
  for (let i = 0; i < 18; i++) {
    const x = r() < 0.5 ? r() * W * 0.18 : W * (0.8 + r() * 0.18)
    const y = H * (0.25 + r() * 0.72)
    lichen += blob(x, y, 1.5 + r() * 2.5, 1.2 + r() * 2, 3150 + i, 0.3, 8)
  }
  const pw = W * 1.1, px = (W - pw) / 2
  const plinth = `M${f1(px)} ${f1(H + 1)}L${f1(px + pw)} ${f1(H + 2)}L${f1(px + pw - 6)} ${f1(H + 16)}L${f1(px + 4)} ${f1(H + 15)}Z`
  const py = H + 44
  svg.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
  const ww = Math.min(W * 0.46, 210), wh = ww * (210 / 220)
  const well = wellArt('github', 3100, 't31c-well')
  for (const [k, v] of Object.entries({ x: f1(-ww - 4), y: f1(H + 16 - wh * 0.9), width: f1(ww), height: f1(wh) })) well.setAttribute(k, v)
  svg.replaceChildren(
    well,
    ground(W / 2, H + 18, W * 0.72, 12, 3146, 0.24),
    // the moon puddle in front: still water, the moon's road, the stele's dim reflection
    s('g', { class: 't31c-puddle' },
      s('path', { class: 't31c-pool', d: blob(W * 0.52, py, W * 0.5, 20, 3147, 0.12, 18), filter: 'url(#ink-wash)' }),
      s('path', { class: 't31c-refl', d: `M${f1(W * 0.2)} ${f1(py - 14)}L${f1(W * 0.8)} ${f1(py - 14)}L${f1(W * 0.74)} ${f1(py + 10)}L${f1(W * 0.26)} ${f1(py + 10)}Z`, filter: 'url(#ink-wash)' }),
      water(W * 0.08, py - 14, W * 0.96, py + 16, 3148, W * 0.72, false),
      s('ellipse', { class: 't31c-pmoon', cx: f1(W * 0.72), cy: f1(py - 6), rx: 9, ry: 3.4 }),
      s('g', { class: 't31c-lit' }, s('ellipse', { cx: f1(W * 0.5), cy: f1(py - 4), rx: f1(W * 0.3), ry: 10, fill: 'url(#p2-lamp)' }))),
    s('path', { class: 't31c-plinth', d: plinth, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
    s('path', { class: 'g11-wash t31c-ink', d: stroke([[px - 2, H + 15.5], [W / 2, H + 16.6], [px + pw + 2, H + 16]], 2.4, 0.05, 0.05, 0.4), filter: 'url(#ink-rough)' }),
    s('path', { class: 't31c-stone', d: face, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
    s('path', { d: face, fill: 'url(#p2-shade)', class: 't31c-shade' }),
    s('path', { class: 't31c-dim', d: face }),
    s('path', { class: 'g11-mossy t31c-moss', d: moss, filter: 'url(#ink-wash)' }),
    s('path', { class: 'g11-mossy t31c-lichen', d: lichen }),
    brushFrame(12, arch * 0.55 + 6, W - 24, H - arch * 0.55 - 18, 3149, 1.4),
    s('path', { class: 'g11-wash t31c-ink', d: stroke([[W - 2, arch], [W - 1.5, H * 0.55], [W - 2.5, H]], 2.6, 0.1, 0.1, 0.4) + stroke(crown.slice(6), 2.4, 0.2, 0.05, 0.3), filter: 'url(#ink-rough)' }),
    s('path', { class: 'g11-moonlit', d: stroke(crown.slice(0, 8).map(([x, y]) => [x + 2, y + 2.4] as Pt), 2.2, 0.1, 0.4, 0.2) + stroke([[3.5, arch + 6], [3, H * 0.6]], 1.6, 0.2, 0.5, 0.2) }),
    grass(px + 6, H + 14, 24, 3151),
    grass(px + pw - 4, H + 15, 20, 3152))
}

/** Scene 3 — a low mossy stele by the well (the model card); the lantern makes each carved line legible and says what to read in it. */
export function cardScene(ctx: SceneCtx) {
  const lit = new Set<number>()
  const read = live('t31c-read')
  const rows = K.lines.map((ln, n) => {
    const b = h('button', { class: 't31c-line', type: 'button', 'aria-label': fill(K.lineAria, { n: n + 1, label: ln.label }), onClick: () => light(n) },
      lantern('', 31 + n),
      h('span', { class: 't31c-label' }, ln.label),
      h('span', { class: 't31c-value' }, ln.value))
    return b
  })
  const face = s('svg', { class: 't31c-face', 'aria-hidden': 'true' })
  const stele = h('div', { class: 't31c-stele' },
    face,
    h('p', { class: 'g11-mock' }, K.mock),
    h('p', { class: 't31c-model' }, K.model),
    h('div', { class: 't31c-lines' }, ...rows))
  const root = h('div', { class: 'g11 t31c', role: 'group', 'aria-label': K.aria },
    night(),
    h('p', { class: 'visually-hidden' }, K.art),
    h('div', { class: 't31c-wrap' }, stele, read))
  ctx.art.append(root)
  const sheet = cardSheet(root, K.takeaway, ctx.onCleanup)
  ctx.onCleanup(onSize(stele, () => {
    const W = stele.clientWidth, H = stele.clientHeight
    if (W > 40 && H > 40) paintStele(face, W, H)
  }))

  function light(n: number) {
    const ln = K.lines[n]
    rows.forEach((r, k) => r.classList.toggle('cur', k === n))
    rows[n].classList.add('on')
    read.say(h('p', { class: 'p2-eyebrow' }, ln.label), h('p', { class: 't31c-readp' }, ln.read))
    if (lit.has(n)) return
    lit.add(n)
    stele.style.setProperty('--lit', String(lit.size / K.lines.length))
    ctx.chime('tap')
    if (lit.size === K.lines.length) {
      ctx.chime('ok')
      ctx.insight(K.insight as Fact, K.detail as Fact)
      sheet.show()
    }
  }
  ctx.onCleanup(onDigit((d) => d <= rows.length && rows[d - 1].click()))
  ctx.prompt(K.prompt)
}
