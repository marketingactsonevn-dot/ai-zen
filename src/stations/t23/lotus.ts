import { h, s } from '../../core/dom'
import type { SceneCtx } from '../types'
import { C } from './data'
import { curve, f1, nightShore, put, reeds, rng, stage, stroke, type Pt } from '../t22/kit'

const K = C.scenes.lotus

/** Scene 2 — one white lotus on the night pond, five petals folded into a single bud; a ripple parts them into five small flowers, each marked with one meaning. */
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
  const blooms = s('g')
  const rings = s('g', { class: 'g8o-rings' })
  const petals = s('g')
  const { root, svg } = stage(ctx, 'g8o', K.art, [K.insight], draw)
  svg.append(back, blooms, rings, petals)
  root.append(pond, neuron, ...labels, list, note)
  ctx.prompt(K.prompt)

  let home: Pt = [0, 0]
  let spots: Pt[] = []

  /** A lotus petal from its base (0, 0) up to its tip (0, -L): pale body, pink toward the tip, fine veins, a brushed edge. */
  function petal(L: number, seed: number) {
    const r = rng(seed)
    const c = (k: number): Pt[] => [...curve([0, 0], [-L * 0.42 * k, -L * 0.3], [0, -L], 14), ...curve([0, -L], [L * 0.42 * k, -L * 0.3], [0, 0], 14).slice(1)]
    const out = c(1)
    let veins = ''
    for (const dx of [-0.12, 0, 0.12]) veins += stroke(curve([L * dx * 0.3, -L * 0.08], [L * dx, -L * 0.5], [L * dx * 0.3, -L * 0.9], 8), 0.8 + r() * 0.3, 0.3, 0.4, 0.1)
    return [
      s('path', { class: 'g8o-pf', d: `M${out.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}Z`, fill: 'url(#g8o-petal)' }),
      s('path', { class: 'g8o-vein', d: veins }),
      s('path', { class: 'g8o-edge', d: stroke(out.slice(2, 26), Math.max(1.1, L * 0.022), 0.15, 0.15, 0.25), filter: 'url(#ink-rough)' }),
    ]
  }

  /** A painted lily pad (seen low, so flattened) with its notch and veins. */
  function pad(x: number, y: number, rx: number, seed: number, cls: string) {
    const r = rng(seed)
    const ry = rx * 0.32
    let veins = ''
    for (let k = 0; k < 9; k++) {
      const a = Math.PI * (0.1 + (k / 8) * 1.8)
      veins += stroke([[x, y], [x + Math.cos(a) * rx * (0.75 + r() * 0.15), y + Math.sin(a) * ry * 0.8]], 0.9, 0.2, 0.4, 0.1)
    }
    const n = 0.18
    const d = `M${f1(x)} ${f1(y)}L${f1(x + Math.cos(-Math.PI / 2 + n) * rx)} ${f1(y + Math.sin(-Math.PI / 2 + n) * ry)}A${f1(rx)} ${f1(ry)} 0 1 1 ${f1(x + Math.cos(-Math.PI / 2 - n) * rx)} ${f1(y + Math.sin(-Math.PI / 2 - n) * ry)}Z`
    return s('g', { class: cls },
      s('path', { class: 'g8o-pad', d, filter: 'url(#ink-wash)' }),
      s('path', { class: 'g8o-padv', d: veins }),
      s('path', { class: 'g8o-padrim', d: stroke(Array.from({ length: 16 }, (_, i) => { const a = Math.PI * (0.05 + (i / 15) * 0.9); return [x + Math.cos(a) * rx, y + Math.sin(a) * ry] as Pt }), 1.6, 0.2, 0.2, 0.2) }))
  }

  /** The one stroke each small flower carries: a DNA twist, a Hebrew letter, a line of law, a web address, a food label. */
  function glyph(k: number, x: number, y: number, u: number) {
    const g = s('g', { class: 'g8o-glyph' })
    if (k === 0) {
      const a: Pt[] = [], b: Pt[] = []
      let rungs = ''
      for (let i = 0; i <= 12; i++) {
        const t = i / 12, yy = y - u * 0.5 + t * u, w = Math.sin(t * Math.PI * 2) * u * 0.18
        a.push([x + w, yy]); b.push([x - w, yy])
        if (i % 2) rungs += stroke([[x - w * 0.8, yy], [x + w * 0.8, yy]], 0.9, 0.2, 0.2, 0.3)
      }
      g.append(s('path', { d: stroke(a, 1.5, 0.1, 0.1, 0.4) + stroke(b, 1.5, 0.1, 0.1, 0.4) + rungs }))
    } else if (k === 1) g.append(s('text', { x: f1(x), y: f1(y + u * 0.32), 'font-size': f1(u * 0.9), 'text-anchor': 'middle' }, 'א'))
    else if (k === 2) g.append(s('text', { x: f1(x), y: f1(y + u * 0.3), 'font-size': f1(u * 0.85), 'text-anchor': 'middle' }, '§'))
    else if (k === 3) g.append(s('text', { x: f1(x), y: f1(y + u * 0.2), 'font-size': f1(u * 0.46), 'text-anchor': 'middle', class: 'g8o-mono' }, 'www.'))
    else {
      let d = stroke([[x - u * 0.28, y - u * 0.4], [x + u * 0.28, y - u * 0.4], [x + u * 0.28, y + u * 0.4], [x - u * 0.28, y + u * 0.4], [x - u * 0.28, y - u * 0.4]], 1.1, 0.05, 0.05, 0.5)
      for (let i = 0; i < 5; i++) d += stroke([[x - u * 0.2, y - u * 0.24 + i * u * 0.13], [x + u * (i ? 0.2 : 0.06), y - u * 0.24 + i * u * 0.13]], i ? 0.8 : 1.6, 0.1, 0.1, 0.4)
      g.append(s('path', { d }))
    }
    return g
  }

  function draw(W: number, H: number) {
    const wide = W > 700
    const wy = H * (wide ? 0.3 : 0.24)
    const pl = Math.min(W, H) * (wide ? 0.16 : 0.15)
    // the five small flowers sit on an ellipse that keeps clear of the far shore and of the note at the foot
    const ry = Math.max(pl, (H - 64 - pl * 0.4 - (wy + pl * 0.75)) / 2)
    const cx = W / 2, cy = wy + pl * 0.75 + ry
    home = [cx, cy - pl * 0.1]
    const rx = Math.min(W * 0.36, wide ? H * 0.62 : W * 0.36)
    spots = K.meanings.map((_, k) => {
      const a = ((-90 + (k * 360) / M) * Math.PI) / 180
      return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as Pt
    })
    back.replaceChildren(
      s('defs', null, s('linearGradient', { id: 'g8o-petal', x1: 0, y1: 1, x2: 0, y2: 0 },
        s('stop', { offset: 0, class: 'g8o-p0' }), s('stop', { offset: 0.55, class: 'g8o-p1' }), s('stop', { offset: 1, class: 'g8o-p2' }))),
      ...nightShore(W, wy, H, { seed: 40, mx: W * 0.2, my: H * 0.11, mr: Math.min(W, H) * 0.042, hh: H * (wide ? 0.13 : 0.09), side: 1 }),
      // the stem under the water, then the big pad the bud rises from
      s('path', { class: 'g8o-stem', d: stroke([[home[0], home[1] + pl * 0.1], [home[0] + 8, home[1] + pl * 0.9], [home[0] - 6, home[1] + pl * 1.9]], 4, 0.05, 0.3, 0.3), filter: 'url(#ink-rough)' }),
      pad(home[0] + pl * 0.15, home[1] + pl * 0.12, pl * 1.05, 401, 'g8o-padc'),
      reeds(W * 0.08, H * 0.97, H * 0.2, 402, 8),
      reeds(W * 0.93, H * 0.95, H * 0.16, 403, 6))
    // where each petal ends up: a small pad, two side petals that open with it, and its mark
    blooms.replaceChildren(...spots.map(([x, y], k) => {
      const side = (rot: number) => s('g', { transform: `translate(${f1(x)} ${f1(y)}) rotate(${rot}) scale(0.5)` }, ...petal(pl, 410 + k * 3 + rot))
      return s('g', { class: 'g8o-bloom', style: `--k:${k}` },
        pad(x + pl * 0.12, y + pl * 0.08, pl * 0.6, 420 + k, 'g8o-spad'),
        side(-38), side(38),
        glyph(k, x + pl * 0.55, y - pl * 0.32, pl * 0.38))
    }))
    rings.replaceChildren(...[0, 1, 2].map((i) => s('path', { class: 'g8o-ring', d: stroke(Array.from({ length: 33 }, (_, j) => { const a = (j / 32) * Math.PI * 2; return [home[0] + Math.cos(a) * pl * 1.25, home[1] + pl * 0.2 + Math.sin(a) * pl * 0.42] as Pt }), 1.6, 0.05, 0.05, 0.3), style: `animation-delay:${i * 0.3}s` })))
    petals.replaceChildren(...K.meanings.map((_, k) => s('g', { class: 'g8o-petal', style: `--k:${k}` }, ...petal(pl, 430 + k))))
    put(pond, cx - Math.max(rx, pl) - 20, wy, Math.max(rx, pl) * 2 + 40)
    pond.style.height = `${f1(H - wy - 10)}px`
    put(neuron, home[0] + pl * 0.45, home[1] + pl * 0.62)
    labels.forEach((el, k) => put(el, spots[k][0] - 70, spots[k][1] + pl * 0.36, 140))
    put(note, 16, H - 54, W - 32)
    place()
  }

  function place() {
    petals.querySelectorAll<SVGGElement>('.g8o-petal').forEach((g, k) => {
      const [x, y] = open ? spots[k] : home
      const rot = open ? 0 : (k - (M - 1) / 2) * 16
      g.style.transform = `translate(${f1(x)}px, ${f1(y)}px) rotate(${rot}deg) scale(${open ? 0.6 : 1})`
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
