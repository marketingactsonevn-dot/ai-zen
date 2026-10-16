import raw from '../../content/tram-32.json'
import { fill, h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { onSize } from '../../ui/part2/ink'
import { mist, moon } from '../../ui/part2/paint'
import type { SceneCtx } from '../types'
import { bamboo, cardSheet, curve, ground, live, needles, plank, rng, room, stroke, type Pt } from '../t31/kit'

const K = raw.scenes.table
const num = (n: number) => n.toLocaleString(document.documentElement.lang || 'vi')
const f1 = (n: number) => (Math.round(n * 10) / 10).toString()

/** The round moon window (viewBox 0 0 200 200): night and the moon inside, a pine twig, a bamboo lattice, a brushed frame. */
function moonWindow(): SVGSVGElement {
  const ring: Pt[] = Array.from({ length: 41 }, (_, i) => { const a = (i / 40) * Math.PI * 2 - 2.2; return [100 + Math.cos(a) * 88, 100 + Math.sin(a) * 88] as Pt })
  return s('svg', { class: 't32t-window', viewBox: '0 0 200 200', 'aria-hidden': 'true' },
    s('defs', null, s('clipPath', { id: 't32t-win' }, s('circle', { cx: 100, cy: 100, r: 86 }))),
    s('circle', { class: 't32t-sky', cx: 100, cy: 100, r: 87 }),
    s('g', { 'clip-path': 'url(#t32t-win)' },
      mist(100, 150, 120, 50),
      moon(124, 76, 26, 3250, true),
      s('path', { class: 'p2p-trunk', d: stroke(curve([-6, 40], [60, 70], [104, 122], 10), 6, 0.02, 0.6, 0.2), filter: 'url(#ink-rough)' }),
      needles(72, 92, 52, 3251), needles(102, 124, 40, 3252),
      bamboo([70, -4], [69, 204], 4, 3253, 60), bamboo([132, -4], [133, 204], 4, 3254, 60), bamboo([-4, 142], [204, 141], 3.4, 3255, 70)),
    s('circle', { class: 't32t-frame', cx: 100, cy: 100, r: 92 }),
    s('path', { class: 'g11-wash t32t-ring', d: stroke(ring, 6, 0.04, 0.12, 0.3), filter: 'url(#ink-rough)' }),
    s('path', { class: 'g11-moonlit', d: stroke(ring.slice(22, 34), 2, 0.2, 0.3, 0.2) }))
}

/** The low tea table on its mat (stage px W × H, the top's upper face at y = H - 46): slab, apron, legs, tatami, shadow. */
function paintTable(svg: SVGSVGElement, W: number, H: number) {
  const r = rng(3260)
  const ty = H - 46
  let weave = ''
  for (let x = -W * 0.12; x < W * 1.12; x += 5 + r()) weave += stroke([[x, H - 9], [x + 0.6, H - 1]], 0.7, 0.2, 0.2, 0.4)
  svg.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
  svg.replaceChildren(
    // the tatami: a pale band with weave and a dark cloth edge
    s('rect', { class: 't32t-mat', x: f1(-W * 0.12), y: f1(H - 10), width: f1(W * 1.24), height: 10 }),
    s('path', { class: 'g11-wash t32t-weave', d: weave }),
    s('path', { class: 'g11-wash t32t-hem', d: stroke([[-W * 0.12, H - 10], [W / 2, H - 10.5], [W * 1.12, H - 10]], 2.4, 0.02, 0.02, 0.6), filter: 'url(#ink-rough)' }),
    ground(W / 2, H - 9, W * 0.48, 5, 3261, 0.3),
    // legs and apron, then the slab
    s('path', { class: 't32t-leg', d: stroke([[W * 0.09, ty + 12], [W * 0.088, H - 9]], 8, 0.02, 0.02, 0.8) + stroke([[W * 0.91, ty + 12], [W * 0.912, H - 9]], 8, 0.02, 0.02, 0.8), filter: 'url(#ink-rough)' }),
    s('path', { class: 'g11-wash t32t-apron', d: stroke([[W * 0.05, ty + 15], [W / 2, ty + 15.5], [W * 0.95, ty + 15]], 4, 0.02, 0.02, 0.7), filter: 'url(#ink-rough)' }),
    plank(0, ty, W, 12, 3262, 'g11-wood t32t-slab'))
}

/** Scene 2 — a low tea table under a round moon window: the table top is your RAM, each model a bundle of scrolls. */
export function tableScene(ctx: SceneCtx) {
  let ram = 16
  let bit = 'q4'
  let model: (typeof K.models)[number] | null = null
  let first = true

  const seg = <T extends string | number>(items: { v: T; label: string }[], get: () => T, set: (v: T) => void, aria: string) => {
    const btns = items.map((it) => h('button', { class: 'g11-pill t32t-seg', type: 'button', 'aria-pressed': String(it.v === get()), onClick: () => (set(it.v), btns.forEach((b, k) => b.setAttribute('aria-pressed', String(items[k].v === get()))), draw()) }, it.label))
    return h('div', { class: 't32t-segs', role: 'group', 'aria-label': aria }, h('span', { class: 'p2-eyebrow' }, aria), ...btns)
  }
  const ramSeg = seg(K.ramOptions.map((n) => ({ v: n, label: fill(K.ramText, { n }) })), () => ram, (v) => (ram = v), K.ramLabel)
  const bitSeg = seg(K.bits.map((b) => ({ v: b.id, label: b.label })), () => bit, (v) => (bit = v), K.bitsLabel)
  const gbOf = (m: (typeof K.models)[number]) => (bit === 'q4' ? m.gbQ4 : m.gb16)
  const models = K.models.map((m) => {
    const size = h('span', { class: 't32t-size' })
    const b = h('button', { class: 't32t-model', type: 'button', 'aria-pressed': 'false', onClick: () => ((model = m), draw()) }, h('span', { class: 't32t-roll', 'aria-hidden': 'true' }), h('span', { class: 't32t-ml' }, m.label), size)
    return { m, b, size }
  })

  const bundle = h('div', { class: 't32t-bundle' })
  const spill = h('div', { class: 't32t-spill', 'aria-hidden': 'true' })
  const top = h('div', { class: 't32t-top' },
    h('span', { class: 't32t-tick', style: `left:${K.fitRule.roomy * 100}%` }),
    h('span', { class: 't32t-tick', style: `left:${K.fitRule.tight * 100}%` }),
    h('span', { class: 't32t-ram' }, fill(K.ramText, { n: ram })))
  const state = live('t32t-state')
  const note = h('p', { class: 't32t-note', hidden: true }, K.note)
  const tableArt = s('svg', { class: 't32t-table', 'aria-hidden': 'true' })
  const stage = h('div', { class: 't32t-stage' }, tableArt, bundle, top, spill)
  const root = h('div', { class: 'g11 t32t', role: 'group', 'aria-label': K.aria },
    room(),
    h('p', { class: 'visually-hidden' }, K.art),
    moonWindow(),
    stage,
    state,
    h('div', { class: 't32t-models' }, ...models.map((x) => x.b)),
    h('div', { class: 't32t-controls' }, ramSeg, bitSeg),
    ctx.fact(K.rule as Fact, 'p', 't32t-rule'),
    note)
  ctx.art.append(root)
  const sheet = cardSheet(root, K.takeaway, ctx.onCleanup)
  ctx.onCleanup(onSize(stage, () => paintTable(tableArt, stage.clientWidth, stage.clientHeight)))

  function draw() {
    ;(top.lastChild as HTMLElement).textContent = fill(K.ramText, { n: ram })
    for (const x of models) {
      const gb = gbOf(x.m)
      x.size.textContent = fill(K.sizeText, { gb: num(gb) })
      x.b.setAttribute('aria-pressed', String(x.m === model))
      x.b.setAttribute('aria-label', fill(K.modelAria, { label: x.m.label, gb: num(gb), ram }))
    }
    if (!model) return
    const r = gbOf(model) / ram
    const kind = r <= K.fitRule.roomy ? 'roomy' : r <= K.fitRule.tight ? 'tight' : 'spill'
    root.dataset.fit = kind
    bundle.style.width = `${Math.min(r, 1.25) * 100}%`
    spill.classList.toggle('on', kind === 'spill')
    state.say(h('strong', null, `${model.label} · ${fill(K.sizeText, { gb: num(gbOf(model)) })} — `), K.states[kind as keyof typeof K.states])
    ctx.chime(kind === 'spill' ? 'low' : 'tap')
    if (first) {
      first = false
      note.hidden = false
      ctx.insight(K.insight as Fact, K.detail as Fact)
      sheet.show()
    }
  }
  draw()
  ctx.prompt(K.prompt)
}
