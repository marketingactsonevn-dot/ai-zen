import { h, s } from '../../core/dom'
import type { SceneCtx } from '../types'
import { C } from './data'
import { blob, brushLines, curve, f1, grass, hills, mist, moon, paperLantern, pine, put, reeds, rng, slider, stage, stroke, wash, type Pt } from '../t22/kit'

const K = C.scenes.bridge

/** Scene 1 — through a clear pond under the moon, a stone on the bottom carved with a suspension bridge; turn the lantern's wick up and the fish swim the bridge's curve. */
export function bridgeScene(ctx: SceneCtx) {
  const N = K.answers.length - 1
  let lvl = 0
  let done = false
  const answer = h('p', { class: 'g8b-answer' }, K.answers[0])
  const sl = slider(K.slider, K.sliderAria, N, K.valueText, turn)
  const card = h('div', { class: 'g8b-card g8-paper' },
    h('p', { class: 'g8-q' }, K.question), answer, ctx.fact(K.answersNote, 'p', 'g8-note'), sl.el)
  const back = s('g')
  const light = s('g', { class: 'g8b-light' })
  const fishG = s('g', { class: 'g8b-fish' })
  const front = s('g')
  const { root, svg } = stage(ctx, 'g8b', K.art, [K.insight], draw)
  svg.append(back, light, fishG, front)
  root.append(card)
  root.dataset.lvl = '0'
  ctx.prompt(K.prompt)

  const NF = 7
  let spots: { free: Pt[]; bridge: Pt[]; angF: number[]; angB: number[] } | null = null

  function draw(W: number, H: number) {
    const wide = W > 760
    const aw = wide ? W * 0.58 : W
    const ah = wide ? H : H * 0.5
    const cx = aw * 0.48, cy = ah * (wide ? 0.62 : 0.6)
    const rx = Math.min(aw * 0.4, ah * 0.8), ry = Math.min(ah * 0.3, rx * 0.46)
    const r = rng(23)
    // the stone on the bottom and the bridge carved on it
    const bw = rx * 1.05, by = cy + ry * 0.32
    const t1: Pt = [cx - bw * 0.27, by], t2: Pt = [cx + bw * 0.27, by]
    const tw = Math.max(4, bw * 0.024), th = ry * 0.82
    const cable = (t: number): Pt => {
      const x = cx - bw / 2 + t * bw
      const inMain = x > t1[0] && x < t2[0]
      const u = inMain ? (x - t1[0]) / (t2[0] - t1[0]) : 0
      const y = inMain ? by - th + Math.sin(Math.PI * u) * th * 0.74 : by - th + Math.abs(x < t1[0] ? (t1[0] - x) / (t1[0] - (cx - bw / 2)) : (x - t2[0]) / (cx + bw / 2 - t2[0])) * th * 0.82
      return [x, y]
    }
    const cablePts = Array.from({ length: 41 }, (_, i) => cable(i / 40))
    const deckY = by - th * 0.1
    const hangers: number[][] = []
    for (let i = 2; i < 39; i += 2) {
      const [x, y] = cable(i / 40)
      if (Math.abs(x - t1[0]) > 4 && Math.abs(x - t2[0]) > 4) hangers.push([x, y + 1, x, deckY])
    }
    const water = blob(cx, cy, rx, ry, 4, 0.05)
    const clip = `g8b-clip-${Math.round(W)}`
    // the lantern on a bent bamboo pole planted on the right bank
    const base: Pt = [cx + rx * 1.02, cy + ry * 0.55]
    const tip: Pt = [cx + rx * 0.3, ah * (wide ? 0.1 : 0.08)]
    const pole = curve(base, [cx + rx * 1.12, tip[1] + ah * 0.02], tip, 24)
    const lr = Math.max(11, Math.min(20, rx * 0.07))
    const lx = tip[0], ly = tip[1] + 2
    const lanY = ly + lr * 1.2 + lr * 1.25
    let nodes = ''
    for (const k of [5, 10, 15, 19]) nodes += stroke([[pole[k][0] - 4, pole[k][1] + 1], [pole[k][0] + 4, pole[k][1] - 1]], 2, 0.2, 0.2, 0.3)
    // pebbles on the pond floor, seen through the water
    let peb = ''
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2, d = 0.25 + r() * 0.7
      const x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d
      if (Math.abs(x - cx) < bw * 0.55 && y > by - th * 1.1 && y < by + ry * 0.2) continue
      peb += blob(x, y, 3 + r() * 6, 2 + r() * 3, 40 + i, 0.15, 10)
    }
    back.replaceChildren(
      s('defs', null, s('clipPath', { id: clip }, s('path', { d: water }))),
      mist(aw * 0.5, cy - ry * 1.4, aw * 0.62, ry * 1.2),
      moon(aw * (wide ? 0.16 : 0.14), ah * (wide ? 0.13 : 0.11), Math.min(aw, ah) * 0.045, 23, true),
      hills(-aw * 0.05, aw * 1.05, cy - ry * 0.75, Math.min(ry * 1.3, cy - ry * 0.75 - ah * 0.08), 231, 0.88, 5),
      hills(-aw * 0.08, aw * 0.45, cy - ry * 0.65, ry * 1.1, 232, 0.5, 2),
      mist(cx, cy - ry * 0.8, rx * 2.2, ry * 0.42),
      // the bank and the clear water over a pale floor
      s('path', { class: 'g8b-bank', d: blob(cx + rx * 0.02, cy + ry * 0.1, rx * 1.07, ry * 1.14, 5, 0.05), filter: 'url(#ink-wash)' }),
      s('path', { class: 'g8b-floor', d: water }),
      s('g', { 'clip-path': `url(#${clip})` },
        s('path', { class: 'g8b-peb', d: peb }),
        s('path', { class: 'g8b-stone', d: blob(cx, by - th * 0.38, bw * 0.64, th * 1.02, 8, 0.08), filter: 'url(#ink-wash)' }),
        s('path', { class: 'g8b-stone-hi', d: stroke(curve([cx - bw * 0.55, by - th * 0.95], [cx - bw * 0.1, by - th * 1.4], [cx + bw * 0.4, by - th * 1.05], 12), 3, 0.3, 0.3, 0.1) }),
        // the carving: towers in vermilion, the main cable's sag, hangers, the deck
        s('g', { class: 'g8b-carve' },
          s('path', { class: 'g8b-cut', d: stroke(cablePts, 2.2, 0.05, 0.05, 0.5) + stroke([[cx - bw / 2, deckY], [cx + bw / 2, deckY + 1]], 2.6, 0.05, 0.05, 0.5) + brushLines(hangers, 0.9, 0.2, 0.2), filter: 'url(#ink-rough)' }),
          s('path', { class: 'g8b-tower', d: [t1, t2].map(([x]) => stroke([[x, by + 2], [x, by - th * 1.12]], tw, 0.05, 0.05, 0.7) + stroke([[x - tw * 1.4, by - th * 0.62], [x + tw * 1.4, by - th * 0.62]], tw * 0.6, 0.1, 0.1, 0.5)).join(''), filter: 'url(#ink-rough)' })),
        // water over it all: a tint deepening to the near side, the moon's glint
        s('path', { class: 'g8b-water', d: water, fill: 'url(#p2-water-v)' }),
        // the moon's broken glint on the surface
        s('path', { class: 'g8b-moonglint', d: Array.from({ length: 7 }, (_, k) => { const y = cy - ry * 0.62 + k * ry * 0.09, len = rx * (0.05 + (k % 3) * 0.05) * (1 + k * 0.12), x = cx - rx * 0.42 + (r() - 0.5) * rx * 0.08; return stroke([[x - len / 2, y], [x + len / 2, y + (r() - 0.5)]], 1.4 + k * 0.25, 0.3, 0.3, 0.1) }).join('') }),
        // the towers' red reflection on the surface, once the lamp is bright
        s('path', { class: 'g8b-refl', d: [t1, t2].map(([x]) => { let d = ''; for (let k = 0; k < 6; k++) { const y = cy - ry * 0.75 + k * ry * 0.12; d += stroke([[x - 5 - r() * 4, y], [x + 4 + r() * 5, y + (r() - 0.5)]], tw * (1.1 - k * 0.12), 0.3, 0.3, 0.1) } return d }).join('') })),
      s('path', { class: 'g8b-rim', d: stroke(Array.from({ length: 30 }, (_, i) => { const a = Math.PI * (1.04 + (i / 29) * 0.92); return [cx + Math.cos(a) * rx * 1.01, cy + Math.sin(a) * ry * 1.02] as Pt }), 2.4, 0.2, 0.2, 0.2) + stroke(Array.from({ length: 30 }, (_, i) => { const a = Math.PI * (0.08 + (i / 29) * 0.84); return [cx + Math.cos(a) * rx * 1.02, cy + Math.sin(a) * ry * 1.04] as Pt }), 1.8, 0.2, 0.2, 0.2), filter: 'url(#ink-rough)' }),
      pine(cx - rx * 1.02, cy + ry * 0.2, ah * (wide ? 0.62 : 0.5), 233, 1))
    light.replaceChildren(
      s('path', { class: 'g8b-beam', d: `M${f1(lx - lr * 0.7)} ${f1(lanY + lr)}L${f1(lx + lr * 0.7)} ${f1(lanY + lr)}L${f1(cx + bw * 0.62)} ${f1(by + ry * 0.12)}L${f1(cx - bw * 0.55)} ${f1(by + ry * 0.12)}Z`, filter: 'url(#ink-wash)' }),
      s('ellipse', { class: 'g8b-pool', cx: f1(cx), cy: f1(by - th * 0.4), rx: f1(bw * 0.62), ry: f1(th * 1.05) }))
    front.replaceChildren(
      wash(blob(base[0], base[1] + 4, rx * 0.2, ry * 0.12, 9, 0.2), 0.3),
      s('path', { class: 'g8b-pole', d: stroke(pole, Math.max(3.5, rx * 0.018), 0.02, 0.3, 0.35), filter: 'url(#ink-rough)' }),
      s('path', { class: 'g8b-node', d: nodes }),
      s('g', { class: 'g8b-lamp' }, paperLantern(lx, ly, lr, 3, lr * 1.2)),
      reeds(cx + rx * 0.92, cy + ry * 0.7, ry * 0.7, 234, 7),
      reeds(cx - rx * 0.86, cy + ry * 0.66, ry * 0.5, 235, 5),
      grass(cx - rx * 0.2, cy + ry * 1.12, rx * 0.12, 236),
      grass(cx + rx * 0.45, cy + ry * 1.08, rx * 0.1, 237))
    // fish: free in the pond, or strung along the cable
    const free: Pt[] = [], angF: number[] = []
    for (let i = 0; i < NF; i++) {
      const a = r() * Math.PI * 2, d = 0.3 + r() * 0.55
      free.push([cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d])
      angF.push(r() * 360)
    }
    const bridge: Pt[] = [], angB: number[] = []
    for (let i = 0; i < NF; i++) {
      const t = 0.06 + (i / (NF - 1)) * 0.88
      const p = cable(t), q = cable(t + 0.01)
      bridge.push([p[0], p[1] - 5])
      angB.push((Math.atan2(q[1] - p[1], q[0] - p[0]) * 180) / Math.PI)
    }
    spots = { free, bridge, angF, angB }
    const fl = Math.max(15, rx * 0.1)
    fishG.replaceChildren(...free.map((_, i) => s('g', { class: 'g8b-f' }, koi(fl, i))))
    swim()
    if (wide) put(card, aw + 8, H * 0.5, W - aw - 32)
    else put(card, 12, ah + 4, W - 24)
    card.classList.toggle('wide', wide)
  }

  /** A koi in a few strokes, nose to the right at (0, 0): a tapering body, the tail fan, two pectoral fins, a red patch on some. */
  function koi(L: number, i: number) {
    const body: Pt[] = [[L * 0.5, 0], [L * 0.2, -0.4], [-L * 0.15, 0.3], [-L * 0.42, 0]]
    return s('g', null,
      s('path', { class: 'g8b-fin', d: stroke([[L * 0.12, L * 0.06], [-L * 0.02, L * 0.24]], L * 0.12, 0.1, 0.6, 0.2) + stroke([[L * 0.12, -L * 0.06], [-L * 0.02, -L * 0.24]], L * 0.12, 0.1, 0.6, 0.2) + stroke([[-L * 0.38, 0], [-L * 0.62, -L * 0.18]], L * 0.14, 0.05, 0.6, 0.2) + stroke([[-L * 0.38, 0], [-L * 0.62, L * 0.16]], L * 0.14, 0.05, 0.6, 0.2) }),
      s('path', { class: 'g8b-body', d: stroke(body, L * 0.3, 0.3, 0.55, 0.12) }),
      i % 3 !== 1 ? s('path', { class: 'g8b-spot', d: blob(L * (i % 2 ? 0.08 : -0.05), -L * 0.02, L * 0.13, L * 0.07, 60 + i, 0.25, 10) }) : null)
  }

  function swim() {
    if (!spots) return
    const t = lvl / N
    fishG.querySelectorAll<SVGGElement>('.g8b-f').forEach((g, i) => {
      const a = spots!.free[i], b = spots!.bridge[i]
      const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t
      let d = spots!.angB[i] - spots!.angF[i]
      d = ((d + 540) % 360) - 180
      g.style.transform = `translate(${f1(x)}px, ${f1(y)}px) rotate(${f1(spots!.angF[i] + d * t)}deg)`
    })
  }

  function turn(v: number) {
    lvl = v
    root.dataset.lvl = String(v)
    answer.textContent = K.answers[v]
    if (!answer.hasAttribute('aria-live')) answer.setAttribute('aria-live', 'polite')
    swim()
    ctx.chime(v === N ? 'ok' : 'tap')
    if (v === N && !done) {
      done = true
      ctx.insight(K.insight, K.detail)
    }
  }
}
