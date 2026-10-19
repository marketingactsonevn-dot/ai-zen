import { fill, h, nextId, s } from '../../core/dom'
import { blob, curve, onDigit, rng, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist, moon, toro } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import C from '../../content/tram-26.json'
import { F, f1, grad, place, stage } from '../t25/kit'

/** how human the statue's shadow looks under each lamp (gwt, hot, iit, bio): an illustration of each theory's verdict */
const PERSON = [1, 0.6, 0, 0]

const stone = (d: string) => [
  s('path', { class: 't26l-stone', d, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
  s('path', { d, fill: 'url(#p2-shade)' }),
]
const halo = (x: number, y: number, r: number) => s('circle', { class: 't26l-halo', cx: f1(x), cy: f1(y), r: f1(r), fill: 'url(#p2-lamp)' })
const contact = (x: number, y: number, rx: number) => s('ellipse', { class: 't26l-contact', cx: f1(x + rx * 0.15), cy: f1(y), rx: f1(rx), ry: f1(rx * 0.2) })

/** Yukimi: the snow-viewing lantern — a wide umbrella roof on a squat firebox and three bowed legs. */
function yukimi(x: number, y: number, H: number) {
  const u = H / 8.2
  const P = (a: number, b: number) => `${f1(x + a * u)} ${f1(y - b * u)}`
  const legs = stroke(curve([x - 2.5 * u, y], [x - 2.1 * u, y - 2.2 * u], [x - 1 * u, y - 3.1 * u], 8), u * 0.75, 0.05, 0.05, 0.7) +
    stroke(curve([x + 2.5 * u, y], [x + 2.1 * u, y - 2.2 * u], [x + 1 * u, y - 3.1 * u], 8), u * 0.75, 0.05, 0.05, 0.7) +
    stroke(curve([x + 0.3 * u, y + 0.35 * u], [x + 0.3 * u, y - 1.6 * u], [x + 0.1 * u, y - 3 * u], 8), u * 0.7, 0.05, 0.05, 0.7)
  const deck = `M${P(-1.7, 3)}L${P(1.7, 3)}L${P(1.4, 3.7)}L${P(-1.4, 3.7)}Z`
  const box = `M${P(-1.15, 3.7)}L${P(1.15, 3.7)}L${P(1.05, 5.5)}L${P(-1.05, 5.5)}Z`
  const roof = `M${P(-3.5, 5.55)}Q${P(-1.7, 5.75)} ${P(-0.45, 7.15)}L${P(0.45, 7.15)}Q${P(1.7, 5.75)} ${P(3.5, 5.55)}L${P(3.6, 5.85)}L${P(3.35, 5.3)}L${P(-3.35, 5.3)}L${P(-3.6, 5.85)}Z`
  return [
    contact(x, y, 2.8 * u), halo(x, y - 4.6 * u, 3.6 * u),
    ...stone(legs + deck + box),
    s('rect', { class: 't26l-fire', x: f1(x - 0.6 * u), y: f1(y - 5.2 * u), width: f1(1.2 * u), height: f1(1.2 * u) }),
    ...stone(roof + blob(x, y - 7.55 * u, 0.42 * u, 0.42 * u, 5, 0.1, 10)),
    s('path', { class: 'zk-ink t26l-ink', d: stroke([[x - 3.5 * u, y - 5.55 * u], [x, y - 5.32 * u], [x + 3.5 * u, y - 5.55 * u]], u * 0.22, 0.1, 0.1, 0.3) + stroke([[x - 1.7 * u, y - 3 * u], [x + 1.7 * u, y - 3 * u]], u * 0.16, 0.1, 0.2, 0.3), filter: 'url(#ink-rough)' }),
  ]
}

/** Oribe: a square shaft planted straight in the ground (a figure carved on it), a flared seat, a box, a low cap. */
function oribe(x: number, y: number, H: number) {
  const u = H / 9.3
  const P = (a: number, b: number) => `${f1(x + a * u)} ${f1(y - b * u)}`
  const shaft = `M${P(-0.55, 0)}L${P(0.55, 0)}L${P(0.62, 4.7)}L${P(-0.62, 4.7)}Z`
  const seat = `M${P(-0.62, 4.6)}Q${P(-1.3, 4.9)} ${P(-1.35, 5.4)}L${P(1.35, 5.4)}Q${P(1.3, 4.9)} ${P(0.62, 4.6)}Z`
  const box = `M${P(-0.95, 5.4)}L${P(0.95, 5.4)}L${P(0.95, 7.3)}L${P(-0.95, 7.3)}Z`
  const cap = `M${P(-1.55, 7.3)}L${P(1.55, 7.3)}L${P(0.5, 8.2)}L${P(-0.5, 8.2)}Z`
  return [
    contact(x, y, 1.3 * u), halo(x, y - 6.3 * u, 3.4 * u),
    ...stone(shaft + seat + box),
    s('rect', { class: 't26l-fire', x: f1(x - 0.5 * u), y: f1(y - 7 * u), width: f1(1 * u), height: f1(1.3 * u) }),
    ...stone(cap + blob(x, y - 8.65 * u, 0.4 * u, 0.45 * u, 7, 0.1, 10)),
    s('path', { class: 'zk-ink t26l-ink', d: stroke([[x, y - 3.9 * u], [x + 0.05 * u, y - 2.1 * u]], u * 0.16, 0.2, 0.3, 0.3) + blob(x, y - 4.15 * u, 0.17 * u, 0.2 * u, 3, 0.1, 8) + stroke([[x - 0.3 * u, y - 3.3 * u], [x + 0.32 * u, y - 3.25 * u]], u * 0.1, 0.3, 0.3, 0.3) + stroke([[x - 1.55 * u, y - 7.3 * u], [x + 1.55 * u, y - 7.32 * u]], u * 0.2, 0.1, 0.1, 0.3), filter: 'url(#ink-rough)' }),
  ]
}

/** Yama-dōrō: a mountain lantern of rough stones stacked as found — a rock, a post, a holed stone, a slab. */
function yama(x: number, y: number, H: number) {
  const u = H / 7.6
  return [
    contact(x, y, 1.9 * u), halo(x + 0.1 * u, y - 5.3 * u, 3.2 * u),
    ...stone(blob(x, y - 0.55 * u, 1.65 * u, 0.75 * u, 11, 0.18, 12) + blob(x - 0.1 * u, y - 2.8 * u, 0.62 * u, 1.75 * u, 12, 0.16, 12) + blob(x + 0.1 * u, y - 5.3 * u, 1.25 * u, 1.05 * u, 13, 0.14, 12)),
    s('path', { class: 't26l-fire', d: blob(x + 0.15 * u, y - 5.3 * u, 0.48 * u, 0.5 * u, 14, 0.15, 10) }),
    ...stone(blob(x - 0.05 * u, y - 6.75 * u, 1.95 * u, 0.45 * u, 15, 0.12, 12)),
    s('path', { class: 't26l-moss', d: blob(x - 0.6 * u, y - 7.05 * u, 0.9 * u, 0.2 * u, 16, 0.3, 10) + blob(x + 0.9 * u, y - 0.95 * u, 0.6 * u, 0.2 * u, 17, 0.3, 10), filter: 'url(#ink-wash)' }),
  ]
}

/** Scene 1 without WebGL (the 3D stage's fallback) — a faceless statue on raked sand atop a mossy hill, four different stone lanterns: each light casts another shadow. */
export function lampsFlat(ctx: SceneCtx) {
  const K = C.scenes.lamps
  const n = K.lamps.length
  const lit = new Set<number>()
  let active = -1
  let done = false
  const lampG = K.lamps.map(() => s('g', { class: 't26l-lampg' }))
  const nums = K.lamps.map((_, i) => h('span', { class: 'zk-lab t26l-num', 'aria-hidden': 'true' }, String(i + 1)))
  const btns = K.lamps.map((l, i) => h('button', { class: 'zk-hit t26l-lamp', type: 'button', 'aria-pressed': 'false', 'aria-label': fill(K.lampAria, { name: l.name }), onClick: () => light(i) }))
  const statue = h('p', { class: 'zk-lab t26l-statue' }, K.statue)
  const card = h('div', { class: 'zk-note t26l-card', hidden: true })
  const rot = s('g', { class: 't26l-rot' })
  const person = s('g', { class: 't26l-sh' })
  const rock = s('g', { class: 't26l-sh' })
  rot.append(person, rock)
  const shadow = s('g', null, rot)
  const clip = nextId('t26l')
  let lampXY: Pt[] = []
  let foot: Pt = [0, 0]

  const { root, svg } = stage(ctx, 't26l', K.art, [K.insight], (W, H) => {
    const land = W / H > 1.05
    const gw = land ? W * 0.62 : W, gh = land ? H : H * 0.6
    const st = Math.min(gh * 0.23, gw * 0.15, 150)
    const gx = gw * 0.5, gy = gh * (land ? 0.6 : 0.62)
    const rx = Math.min(gw * 0.45, st * 3.5), ry = rx * 0.34
    const sy = gy + st * 0.2 // the sand's centre, a little in front of the statue
    const r = rng(2601)
    const t = st * 1.6
    const ang = [-163, -122, -58, -17].map((d) => (d * Math.PI) / 180)
    lampXY = ang.map((a) => [gx + Math.cos(a) * rx * 0.94, sy + Math.sin(a) * ry * 1.02])
    foot = [gx, gy]
    // shadows along local +y: a stretched human figure, or only a stone's
    const L = st * 2.4
    person.replaceChildren(s('path', { d:
      blob(0, L * 0.86, st * 0.16, st * 0.2, 1, 0.05, 10) +
      `M${f1(-st * 0.24)} 0Q${f1(-st * 0.34)} ${f1(L * 0.4)} ${f1(-st * 0.3)} ${f1(L * 0.74)}L${f1(st * 0.3)} ${f1(L * 0.74)}Q${f1(st * 0.34)} ${f1(L * 0.4)} ${f1(st * 0.24)} 0Z` +
      stroke([[-st * 0.28, L * 0.7], [-st * 0.5, L * 0.42], [-st * 0.44, L * 0.2]], st * 0.13, 0.1, 0.3, 0.4) +
      stroke([[st * 0.28, L * 0.7], [st * 0.5, L * 0.42], [st * 0.44, L * 0.2]], st * 0.13, 0.1, 0.3, 0.4), filter: 'url(#ink-wash)' }))
    rock.replaceChildren(s('path', { d: `M${f1(-st * 0.26)} 0Q${f1(-st * 0.38)} ${f1(L * 0.3)} ${f1(st * 0.02)} ${f1(L * 0.4)}Q${f1(st * 0.36)} ${f1(L * 0.28)} ${f1(st * 0.26)} 0Z`, filter: 'url(#ink-wash)' }))
    shadow.setAttribute('transform', `translate(${f1(gx)} ${f1(gy)})`)
    // the statue: a smooth robed figure with no face
    const bodyD = `M${f1(gx - st * 0.27)} ${f1(gy)}C${f1(gx - st * 0.33)} ${f1(gy - st * 0.5)} ${f1(gx - st * 0.22)} ${f1(gy - st * 0.7)} ${f1(gx)} ${f1(gy - st * 0.72)}C${f1(gx + st * 0.22)} ${f1(gy - st * 0.7)} ${f1(gx + st * 0.33)} ${f1(gy - st * 0.5)} ${f1(gx + st * 0.27)} ${f1(gy)}Q${f1(gx)} ${f1(gy + st * 0.05)} ${f1(gx - st * 0.27)} ${f1(gy)}Z`
    const headD = blob(gx, gy - st * 0.87, st * 0.15, st * 0.18, 2602, 0.03, 12)
    // raked sand: parallel combing, rings round the statue, moss along the edge
    const sand = blob(gx, sy, rx, ry, 2603, 0.04, 22)
    let comb = ''
    for (let y = sy - ry * 1.1; y < sy + ry * 1.1; y += 6 + r()) {
      const pts: Pt[] = []
      for (let x = gx - rx * 1.05; x <= gx + rx * 1.05; x += 14) pts.push([x, y + Math.sin(x / 70 + y) * 1.1])
      comb += stroke(pts, 1.1 + r() * 0.5, 0.05, 0.05, 0.4)
    }
    let rings = ''
    for (let k = 1; k <= 4; k++) {
      const pts: Pt[] = Array.from({ length: 41 }, (_, i) => {
        const a = (i / 40) * Math.PI * 2
        return [gx + Math.cos(a) * st * (0.42 + k * 0.17), gy + Math.sin(a) * st * (0.14 + k * 0.06)]
      })
      rings += stroke(pts, 1.3, 0.02, 0.02, 0.6)
    }
    let dots = ''
    for (let i = 0; i < 90; i++) {
      const a = r() * Math.PI * 2, k = 1 + r() * 0.12
      const x = gx + Math.cos(a) * rx * k, y = sy + Math.sin(a) * ry * k
      dots += stroke([[x, y], [x + 2.5 + r() * 2, y + 1.2]], 2.4 + r() * 2.4, 0.35, 0.35, 0.45)
    }
    const kinds = [
      (x: number, y: number) => toro(x, y, t, true),
      (x: number, y: number) => s('g', null, ...yukimi(x, y, t * 0.68)),
      (x: number, y: number) => s('g', null, ...oribe(x, y, t * 0.95)),
      (x: number, y: number) => s('g', null, ...yama(x, y, t * 0.78)),
    ]
    const mx = land ? gw * 0.12 : gw * 0.86, my = gh * 0.12
    svg.replaceChildren(
      s('defs', null, s('clipPath', { id: clip }, s('path', { d: sand + blob(gx, gy + st * 0.02, st * 1.12, st * 0.4, 2604, 0.02, 16), 'clip-rule': 'evenodd' }))),
      mist(mx, my, gw * 0.35, gh * 0.18),
      moon(mx, my, Math.min(W, H) * 0.026, 2605, true),
      hills(-gw * 0.05, gw * 1.05, sy - ry * 1.5, gh * 0.2, 2606, 0.9, 5),
      mist(gx, sy - ry * 1.55, gw * 0.6, gh * 0.08),
      // the mossy hilltop the garden sits on
      s('path', { class: 't26l-hill', d: blob(gx, sy + ry * 1.9, rx * 1.6, ry * 3.3, 2607, 0.05, 22), fill: grad(svg, [[0, '--moss-b', 1], [0.4, '--moss-b', 0.8], [1, '--moss-b', 0]], 'v', [0, sy - ry * 2.4, 0, H]) }),
      s('path', { class: 'zk-ink t26l-ridge', d: stroke(curve([gx - rx * 1.5, sy + ry * 0.2], [gx, sy - ry * 2.45], [gx + rx * 1.5, sy + ry * 0.1], 24), 2.2, 0.15, 0.15, 0.2), filter: 'url(#ink-rough)' }),
      s('path', { class: 't26l-sand', d: sand, filter: 'url(#ink-wash)' }),
      s('path', { class: 't26l-comb', d: comb, 'clip-path': `url(#${clip})` }),
      s('path', { class: 't26l-comb', d: rings }),
      s('path', { class: 't26l-dots', d: dots }),
      shadow,
      // the lamps behind the statue first, so the statue stands in front
      ...lampXY.map(([x, y], i) => (lampG[i].replaceChildren(kinds[i](x, y)), lampG[i])),
      s('ellipse', { class: 't26l-contact', cx: f1(gx + st * 0.05), cy: f1(gy), rx: f1(st * 0.34), ry: f1(st * 0.07) }),
      ...stone(bodyD + headD),
      s('path', { class: 'zk-ink t26l-ink', d: stroke(curve([gx + st * 0.27, gy], [gx + st * 0.33, gy - st * 0.48], [gx + st * 0.12, gy - st * 0.7], 10), Math.max(1.6, st * 0.03), 0.1, 0.4, 0.2) + stroke(curve([gx + st * 0.15, gy - st * 0.8], [gx + st * 0.16, gy - st * 0.95], [gx + st * 0.04, gy - st * 1.04], 6), Math.max(1.4, st * 0.025), 0.2, 0.4, 0.2), filter: 'url(#ink-rough)' }),
      s('path', { class: 't26l-rim', d: stroke(curve([gx - st * 0.26, gy - st * 0.12], [gx - st * 0.3, gy - st * 0.5], [gx - st * 0.1, gy - st * 0.7], 10), Math.max(1.4, st * 0.025), 0.2, 0.3, 0.1) + stroke(curve([gx - st * 0.13, gy - st * 0.82], [gx - st * 0.14, gy - st * 0.97], [gx - st * 0.02, gy - st * 1.04], 6), Math.max(1.2, st * 0.02), 0.3, 0.3, 0.1) }),
      s('path', { class: 't26l-moss', d: blob(gx - st * 0.12, gy - st * 0.02, st * 0.2, st * 0.05, 2608, 0.3, 10), filter: 'url(#ink-wash)' }))
    lampXY.forEach(([x, y], i) => {
      place(btns[i], x - t * 0.45, y - t * 0.95, t * 0.9)
      btns[i].style.height = `${f1(t)}px`
      place(nums[i], x - 10, y + 5, 20)
    })
    place(statue, gx - 60, gy - st * 1.08 - 26, 120)
    if (land) place(card, gw + 8, H * 0.18, Math.min(W - gw - 24, 400))
    else place(card, 12, gh + 4, W - 24)
    aim()
  })
  root.append(statue, ...btns, ...nums, card)
  ctx.prompt(K.prompt)
  ctx.onCleanup(onDigit((d) => d <= n && light(d - 1)))

  function aim() {
    if (active < 0) {
      rot.style.opacity = '0'
      return
    }
    const [lx, ly] = lampXY[active]
    const deg = (Math.atan2(foot[1] - ly + 40, foot[0] - lx) * 180) / Math.PI - 90
    rot.style.opacity = '1'
    rot.style.transform = `rotate(${deg.toFixed(1)}deg)`
    person.style.opacity = String(PERSON[active] * 0.55)
    rock.style.opacity = String((1 - PERSON[active]) * 0.55)
  }
  function light(i: number) {
    const l = K.lamps[i]
    active = i
    lit.add(i)
    lampG.forEach((g, k) => g.classList.toggle('lit', lit.has(k)))
    lampG.forEach((g, k) => g.classList.toggle('on', k === i))
    btns.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)))
    aim()
    card.replaceChildren(
      h('p', { class: 'p2-eyebrow' }, fill(K.eyebrow, { i: i + 1, n, name: l.name, en: l.en })),
      h('p', { class: 'p2-question t26l-asks' }, l.asks),
      ctx.fact(F(l.view)),
      h('p', { class: 't26l-decode' }, K.decode))
    card.hidden = false
    if (!card.hasAttribute('aria-live')) card.setAttribute('aria-live', 'polite')
    ctx.chime('soft')
    if (lit.size < n) ctx.prompt(fill(K.promptNext, { n: n - lit.size }))
    if (lit.size === n && !done) {
      done = true
      ctx.insight(F(K.insight), F(K.detail))
    }
  }
}
