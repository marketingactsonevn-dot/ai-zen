import { fill, h, s } from '../../core/dom'
import { blob, curve, onSize, rng, stroke, type Pt } from '../../ui/part2/ink'
import type { SceneCtx } from '../types'
import { C } from './content'
import { cardButton, F, f1, gdefs, hangingLamp, ink, pebble, wood, woodG } from '../t34/night'
import { koi } from './koi'

const K = C.scenes.blueprint

/** The koi-pond sketch: one ink layer per spec piece (idea, rules, controls, end, style, device). */
function sketch(): [SVGSVGElement, SVGGElement[]] {
  const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => Array.from({ length: 21 }, (_, i) => { const t = a0 + ((a1 - a0) * i) / 20; return [cx + Math.cos(t) * r, cy + Math.sin(t) * r] as Pt })
  const shard = (x: number, y: number, k: number) => `M${f1(x)} ${f1(y)}Q${f1(x + 6 * k)} ${f1(y - 2 * k)} ${f1(x + 8 * k)} ${f1(y + 4 * k)}Q${f1(x + 4 * k)} ${f1(y + 1 * k)} ${f1(x)} ${f1(y)}Z`
  const layers = [
    s('g', null, // idea: the pond and its koi
      ink(blob(78, 66, 62, 36, 361, 0.08), 't36b-pond', 'wash'),
      ink(stroke(curve([18, 70], [40, 104], [92, 102], 10), 2.2, 0.1, 0.3, 0.2) + stroke(curve([98, 31], [134, 36], [140, 62], 10), 1.6, 0.2, 0.3, 0.2), 't36b-ink', 'rough'),
      koi(88, 62, 34, 0.25, 362)),
    s('g', null, // rules: moon shards falling, a dry leaf
      ink(shard(102, 16, 1) + shard(120, 32, 0.8) + shard(84, 30, 0.6), 't36b-shard', 'rough'),
      ink(stroke(curve([38, 26], [46, 18], [56, 24], 6), 4.2, 0.3, 0.3, 0.2) + stroke([[37, 27], [57, 22]], 0.6, 0.1, 0.1, 0.3), 't36b-leaf', 'rough')),
    s('g', null, // controls: a fingertip and its ripple
      ink(stroke(arc(106, 80, 7, 0, 6.2), 1, 0.1, 0.1, 0.4) + stroke(arc(106, 80, 12, 3.6, 6), 0.8, 0.2, 0.2, 0.2), 't36b-ink', 'rough'),
      ink(stroke([[120, 112], [111, 88]], 7, 0.05, 0.4, 0.5), 't36b-finger', 'wash')),
    s('g', null, // end: the ensō that holds the score
      ink(stroke(arc(140, 20, 11, -1.5, 4.4), 2.8, 0.1, 0.55, 0.15), 't36b-ink', 'rough')),
    s('g', null, // style: an ink-wash sky, the moon
      ink(stroke([[6, 10], [50, 7], [96, 11]], 13, 0.3, 0.5, 0.1), 't36b-sky', 'wash'),
      s('circle', { class: 't36b-moon', cx: 22, cy: 12, r: 6 })),
    s('g', null, // device: the phone frame around it all
      ink(stroke([[5, 4], [80, 3], [155, 4]], 1.8, 0.05, 0.05, 0.6) + stroke([[156, 3], [157, 60], [156, 117]], 1.8, 0.05, 0.05, 0.6) + stroke([[156, 116], [80, 117], [4, 116]], 2.2, 0.05, 0.05, 0.6) + stroke([[4, 117], [3, 60], [4, 3]], 1.8, 0.05, 0.05, 0.6), 't36b-ink', 'rough')),
  ]
  return [s('svg', { class: 't36b-sketch', viewBox: '0 0 160 120', 'aria-hidden': 'true' }, ...layers), layers]
}

/** The drafting table under the paper: planks, the lamp's pool of light, weights, an ink stone and a brush. */
function table(svg: SVGSVGElement, w: number, hh: number, above: number) {
  const r = rng(363)
  const m = 26
  const n = Math.max(3, Math.round((hh + m * 2) / 90))
  const planks = Array.from({ length: n }, (_, i) => {
    const y = -m + ((i + 0.5) * (hh + m * 2)) / n
    return wood([-m * 2.4, y], [w + m * 2.4, y + (r() - 0.5) * 3], (hh + m * 2) / n - 3, 364 + i)
  })
  svg.setAttribute('viewBox', `0 0 ${f1(w)} ${f1(hh)}`)
  const M = m * 2.4
  svg.replaceChildren(
    s('mask', { id: 't36b-fade', maskUnits: 'userSpaceOnUse', x: f1(-M), y: f1(-M), width: f1(w + M * 2), height: f1(hh + M * 2) },
      s('rect', { x: f1(-M), y: f1(-M), width: f1(w + M * 2), height: f1(hh + M * 2), fill: 'url(#g12-feather)' })),
    s('g', { mask: 'url(#t36b-fade)' }, woodG(planks, 't36b-planks')),
    s('ellipse', { class: 'g12-pool', cx: f1(w * 0.5), cy: f1(hh * 0.3), rx: f1(w * 0.8), ry: f1(hh * 0.65), fill: 'url(#g12-pool)' }),
    // the ink stone with its well, a brush resting on it
    s('g', { class: 't36b-inkstone' },
      ink(`M${f1(w + m * 0.1)} ${f1(hh - 64)}L${f1(w + m * 0.95)} ${f1(hh - 66)}L${f1(w + m * 0.9)} ${f1(hh - 4)}L${f1(w + m * 0.15)} ${f1(hh - 2)}Z`, 't36b-stone', 'rough'),
      s('ellipse', { class: 't36b-well', cx: f1(w + m * 0.52), cy: f1(hh - 52), rx: f1(m * 0.26), ry: 6 }),
      ink(stroke([[w + m * 0.7, hh - 100], [w + m * 0.55, hh - 30]], 4, 0.05, 0.1, 0.7) + stroke([[w + m * 0.55, hh - 30], [w + m * 0.52, hh - 18]], 5, 0.1, 0.8, 0.2), 't36b-brush', 'rough')),
    pebble(-4, hh * 0.92, 15, 365),
    pebble(w * 0.97, 10, 13, 366),
    above > 70 ? hangingLamp(w * 0.86, -above, above - 50, 13, 367) : '')
}

/** Scene 1 — a drawing table: six paper pieces; each choice inks one corner of the pond and one line of spec.md. */
export function blueprintScene(ctx: SceneCtx) {
  gdefs()
  const chosen: number[] = K.pieces.map(() => -1)
  let cur = 0
  const [art, layers] = sketch()
  const lines = K.pieces.map((p) => h('li', null, h('span', { class: 't36b-key' }, p.label), h('span', { class: 't36b-val' }, '…')))
  const tabs = K.pieces.map((p, i) => h('button', { class: 't36b-tab g12-paper', type: 'button', 'aria-label': p.label, 'aria-current': 'false', style: `--r:${[-4, 3, -2, 5, -3, 2][i]}deg`, onClick: () => show(i) }, String(i + 1)))
  const head = h('p', { class: 't36b-head' })
  const opts = h('div', { class: 't36b-opts' })
  const tail = h('div', { class: 't36b-tail' })
  const sheet = h('div', { class: 't36b-sheet g12-paper big' },
    h('div', { class: 't36b-top' }, h('p', { class: 't36b-title' }, K.specTitle), art),
    h('ol', { class: 't36b-spec' }, ...lines))
  const tbl = s('svg', { class: 't36b-table', 'aria-hidden': 'true' })
  const pick = h('div', { class: 't36b-pick' }, h('div', { class: 't36b-tabs', role: 'group', 'aria-label': K.group }, ...tabs), head, opts, tail)
  const desk = h('div', { class: 't36b-desk' }, tbl, sheet)
  const root = h('div', { class: 't36 t36b' }, h('p', { class: 'visually-hidden' }, K.art),
    pick,
    desk)
  ctx.art.append(root)
  ctx.prompt(K.prompt)
  ctx.onCleanup(onSize(desk, () => {
    const w = desk.clientWidth, hh = desk.clientHeight
    const d = desk.getBoundingClientRect(), pk = pick.getBoundingClientRect()
    // the lamp hangs over the desk only when nothing sits above it (side by side, not stacked)
    if (w > 40 && hh > 40) table(tbl, w, hh, d.left >= pk.right ? d.top - ctx.art.getBoundingClientRect().top : 0)
  }))
  const pill = cardButton(ctx, root, K.takeaway)
  show(0)

  function show(i: number) {
    cur = i
    const p = K.pieces[i]
    tabs.forEach((t, k) => {
      t.setAttribute('aria-current', String(k === i))
      t.classList.toggle('done', chosen[k] >= 0)
    })
    head.textContent = p.label
    opts.replaceChildren(...p.options.map((o, k) => h('button', { class: 't36b-opt g12-paper', type: 'button', 'aria-pressed': String(chosen[i] === k), 'aria-label': fill(K.pieceAria, { piece: p.label, option: o }), onClick: () => choose(k) }, o)))
  }
  function choose(k: number) {
    const first = chosen[cur] < 0
    chosen[cur] = k
    lines[cur].lastElementChild!.textContent = K.pieces[cur].options[k]
    lines[cur].classList.add('on')
    layers[cur].classList.add('on')
    ctx.chime('tap')
    const next = chosen.findIndex((c) => c < 0)
    if (next >= 0) {
      show(first ? next : cur)
      if (first) opts.querySelector<HTMLElement>('button')?.focus()
      return
    }
    show(cur)
    if (!tail.childElementCount) {
      tail.append(ctx.fact(F(K.facts[0]), 'p', 't36b-fact'))
      if (pill) tail.append(pill)
      ctx.insight(F(K.insight), K.detail)
    }
  }
}
