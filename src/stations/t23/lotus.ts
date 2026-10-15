import { h, s } from '../../core/dom'
import type { SceneCtx } from '../types'
import { C } from './data'
import { f1, hills, moon, put, stage, stroke, waterBand, type Pt } from '../t22/kit'

const K = C.scenes.lotus

/** Scene 2 — one stem, one bud of five stacked petals; a ripple parts them into five small flowers, one meaning each. */
export function lotusScene(ctx: SceneCtx) {
  const M = K.meanings.length
  let open = false
  let told = false
  const pond = h('button', { class: 'g8o-pond', type: 'button', 'aria-label': K.shakeAria, 'aria-pressed': 'false', onClick: shake })
  const neuron = h('span', { class: 'g8o-neuron g8-abs' }, K.neuron)
  const labels = K.meanings.map((m) => h('span', { class: 'g8o-mean g8-abs', 'aria-hidden': 'true' }, m))
  const list = h('ul', { class: 'visually-hidden' })
  const note = h('div', { class: 'g8o-note g8-fade g8-abs', 'data-off': '' }, ctx.fact(K.meaningsNote, 'p', 'g8-note'))
  const back = s('g')
  const rings = s('g', { class: 'g8o-rings' })
  const petals = s('g')
  const { root, svg } = stage(ctx, 'g8o', K.art, [K.insight], draw)
  svg.append(back, rings, petals)
  root.append(pond, neuron, ...labels, list, note)
  ctx.prompt(K.prompt)

  let home: Pt = [0, 0]
  let spots: Pt[] = []

  function draw(W: number, H: number) {
    const wide = W > 700
    const wy = H * (wide ? 0.3 : 0.24)
    const cx = W / 2, cy = H * (wide ? 0.5 : 0.46)
    const pl = Math.min(W, H) * (wide ? 0.13 : 0.15)
    home = [cx, cy]
    const rx = Math.min(W * 0.36, wide ? H * 0.62 : W * 0.36), ry = Math.min(H * 0.28, wide ? H * 0.3 : H * 0.26)
    spots = K.meanings.map((_, k) => {
      const a = ((-90 + (k * 360) / M) * Math.PI) / 180
      return [cx + Math.cos(a) * rx, cy + 10 + Math.sin(a) * ry] as Pt
    })
    back.replaceChildren(
      hills(W, wy, H * 0.1, 40),
      moon(W * 0.2, H * 0.1, Math.min(W, H) * 0.04),
      waterBand(W, wy, H, W * 0.2, 41),
      // lily pads and the one stem going down into the water
      ...spots.map(([x, y], k) => s('ellipse', { class: 'g8o-pad', cx: f1(x), cy: f1(y + pl * 0.36), rx: f1(pl * 0.5), ry: f1(pl * 0.16), style: `--k:${k}` })),
      s('ellipse', { class: 'g8o-padc', cx: f1(cx), cy: f1(cy + pl * 0.2), rx: f1(pl * 0.95), ry: f1(pl * 0.3) }),
      s('path', { class: 'k', 'fill-opacity': 0.55, d: stroke([[cx, cy + pl * 0.15], [cx + 6, cy + pl * 0.9], [cx - 4, cy + pl * 1.7]], 4, 0.05, 0.3, 0.3) }))
    rings.replaceChildren(...[0, 1, 2].map((i) => s('ellipse', { class: 'g8o-ring', cx: f1(cx), cy: f1(cy + pl * 0.2), rx: f1(pl * 1.2), ry: f1(pl * 0.4), style: `animation-delay:${i * 0.3}s` })))
    const petal = `M0 0C${f1(-pl * 0.32)} ${f1(-pl * 0.25)} ${f1(-pl * 0.26)} ${f1(-pl * 0.75)} 0 ${f1(-pl)}C${f1(pl * 0.26)} ${f1(-pl * 0.75)} ${f1(pl * 0.32)} ${f1(-pl * 0.25)} 0 0Z`
    petals.replaceChildren(...K.meanings.map((_, k) => s('g', { class: 'g8o-petal', style: `--k:${k}` },
      s('path', { class: 'g8o-pf', d: petal }),
      s('path', { class: 'g8o-vein', d: `M0 ${f1(-pl * 0.12)}Q${f1(pl * 0.04)} ${f1(-pl * 0.5)} 0 ${f1(-pl * 0.86)}` }))))
    put(pond, cx - Math.max(rx, pl) - 20, wy, Math.max(rx, pl) * 2 + 40)
    pond.style.height = `${f1(H - wy - 10)}px`
    put(neuron, cx + pl * 0.3, cy + pl * 1.2)
    labels.forEach((el, k) => put(el, spots[k][0] - 60, spots[k][1] + pl * 0.55, 120))
    put(note, 16, H - 54, W - 32)
    place()
  }

  function place() {
    petals.querySelectorAll<SVGGElement>('.g8o-petal').forEach((g, k) => {
      const [x, y] = open ? spots[k] : home
      const rot = open ? 0 : (k - (M - 1) / 2) * 17
      g.style.transform = `translate(${f1(x)}px, ${f1(y)}px) rotate(${rot}deg) scale(${open ? 0.72 : 1})`
    })
    root.classList.toggle('open', open)
  }

  function shake() {
    open = !open
    pond.setAttribute('aria-pressed', String(open))
    root.classList.remove('rip')
    void root.offsetWidth // restart the ripple animation
    root.classList.add('rip')
    place()
    ctx.chime(open ? 'tap' : 'soft')
    if (open && !told) {
      told = true
      list.replaceChildren(...K.meanings.map((m) => h('li', null, m)))
      list.setAttribute('aria-live', 'polite')
      delete note.dataset.off
      ctx.insight(K.insight, K.detail)
    }
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== ' ' || e.defaultPrevented || (e.target as Element).closest?.('button, input, textarea, select, a, [contenteditable]')) return
    e.preventDefault()
    shake()
  }
  addEventListener('keydown', onKey)
  ctx.onCleanup(() => removeEventListener('keydown', onKey))
}
