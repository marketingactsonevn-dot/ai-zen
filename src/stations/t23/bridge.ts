import { h, s } from '../../core/dom'
import type { SceneCtx } from '../types'
import { C } from './data'
import { blob, f1, glowDefs, put, rng, slider, stage, stroke, type Pt } from '../t22/kit'

const K = C.scenes.bridge

/** Scene 1 — a lantern over a clear pond; turning its wick up steers the fish along the bridge carved on a stone below. */
export function bridgeScene(ctx: SceneCtx) {
  const N = K.answers.length - 1
  let lvl = 0
  let done = false
  const answer = h('p', { class: 'g8b-answer' }, K.answers[0])
  const sl = slider(K.slider, K.sliderAria, N, K.valueText, turn)
  const card = h('div', { class: 'g8b-card' },
    h('p', { class: 'g8-q' }, K.question), answer, ctx.fact(K.answersNote, 'p', 'g8-note'), sl.el)
  const back = s('g')
  const fishG = s('g', { class: 'g8b-fish' })
  const { root, svg } = stage(ctx, 'g8b', K.art, [K.insight], draw)
  const glow = glowDefs(svg)
  svg.append(back, fishG)
  root.append(card)
  root.dataset.lvl = '0'
  ctx.prompt(K.prompt)

  const NF = 7
  let spots: { free: Pt[]; bridge: Pt[]; angF: number[]; angB: number[] } | null = null

  function draw(W: number, H: number) {
    const wide = W > 760
    const aw = wide ? W * 0.58 : W
    const ah = wide ? H : H * 0.5
    const cx = aw / 2, cy = ah * 0.6
    const rx = Math.min(aw * 0.44, ah * 0.75), ry = Math.min(ah * 0.34, rx * 0.5)
    // the bridge carved on the stone at the bottom of the pond
    const bw = rx * 0.9, by = cy + ry * 0.2
    const t1: Pt = [cx - bw * 0.3, by], t2: Pt = [cx + bw * 0.3, by]
    const tw = Math.max(5, bw * 0.03), th = ry * 0.75
    const cable = (t: number): Pt => {
      // left span, main span (sagging), right span
      const x = cx - bw / 2 + t * bw
      const inMain = x > t1[0] && x < t2[0]
      const u = inMain ? (x - t1[0]) / (t2[0] - t1[0]) : 0
      const y = inMain ? by - th + Math.sin(Math.PI * u) * th * 0.78 : by - th + Math.abs(x < t1[0] ? (t1[0] - x) / (t1[0] - (cx - bw / 2)) : (x - t2[0]) / (cx + bw / 2 - t2[0])) * th * 0.85
      return [x, y]
    }
    const cablePts = Array.from({ length: 41 }, (_, i) => cable(i / 40))
    const r = rng(23)
    const lx = cx + rx * 0.55, ly = ah * 0.08
    back.replaceChildren(
      // branch the lantern hangs from
      s('path', { class: 'k', 'fill-opacity': 0.7, d: stroke([[aw, ly - 10], [lx + rx * 0.4, ly - 4], [lx - 20, ly + 2]], 7, 0.1, 0.6, 0.2), filter: 'url(#ink-rough)' }),
      s('path', { class: 'g8b-beam', d: `M${f1(lx - 6)} ${f1(ly + 30)}L${f1(lx + 6)} ${f1(ly + 30)}L${f1(cx + bw * 0.6)} ${f1(by + 10)}L${f1(cx - bw * 0.6)} ${f1(by + 10)}Z` }),
      s('path', { class: 'g8b-bank', d: blob(cx, cy + ry * 0.06, rx * 1.08, ry * 1.12, 4, 0.05), filter: 'url(#ink-wash)' }),
      s('path', { class: 'g8b-pond', d: blob(cx, cy, rx, ry, 4, 0.05) }),
      s('path', { class: 'g8b-stone', d: blob(cx, by - th * 0.35, bw * 0.62, th * 0.95, 8, 0.08) }),
      s('g', { class: 'g8b-carve' },
        s('path', { class: 'k', 'fill-opacity': 0.55, d: stroke(cablePts, 2.2, 0.05, 0.05, 0.5) }),
        s('path', { class: 'k', 'fill-opacity': 0.5, d: stroke([[cx - bw / 2, by - th * 0.12], [cx + bw / 2, by - th * 0.12]], 2.6, 0.05, 0.05, 0.5) }),
        ...[t1, t2].map(([x]) => s('rect', { class: 'v', x: f1(x - tw / 2), y: f1(by - th * 1.15), width: f1(tw), height: f1(th * 1.15) }))),
      // the towers' reflection on the surface
      s('g', { class: 'g8b-refl' }, ...[t1, t2].map(([x]) => s('path', { class: 'v', d: stroke([[x, cy - ry * 0.7], [x + 2, cy - ry * 0.35], [x - 1, cy]], tw * 1.4, 0.1, 0.5, 0.2) }))),
      s('path', { class: 'g8b-rim', d: stroke(Array.from({ length: 30 }, (_, i) => { const a = Math.PI * (1.05 + i / 29 * 0.9); return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as Pt }), 2.4, 0.2, 0.2, 0.2), filter: 'url(#ink-rough)' }),
      // the lantern
      s('path', { class: 'k', d: `M${f1(lx)} ${f1(ly)}V${f1(ly + 8)}` }),
      s('circle', { class: 'g8b-glow', cx: f1(lx), cy: f1(ly + 26), r: f1(Math.min(90, rx * 0.4)), fill: glow }),
      s('path', { class: 'g8b-lan', d: blob(lx, ly + 26, 14, 18, 3, 0.03) }),
      s('rect', { class: 'k', x: f1(lx - 8), y: f1(ly + 6), width: 16, height: 4, rx: 1 }),
      s('rect', { class: 'k', x: f1(lx - 8), y: f1(ly + 42), width: 16, height: 4, rx: 1 }))
    // fish: free in the pond, or lined up on the cable
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
      bridge.push([p[0], p[1] - 6])
      angB.push((Math.atan2(q[1] - p[1], q[0] - p[0]) * 180) / Math.PI)
    }
    spots = { free, bridge, angF, angB }
    const fl = Math.max(16, rx * 0.11)
    fishG.replaceChildren(...free.map((_, i) => s('g', { class: 'g8b-f' },
      s('path', { class: 'k', 'fill-opacity': 0.8, d: stroke([[fl * 0.5, 0], [0, 0.6], [-fl * 0.5, -1]], fl * 0.32, 0.25, 0.7, 0.15) }),
      s('path', { class: 'k', 'fill-opacity': 0.6, d: `M${f1(-fl * 0.45)} -1L${f1(-fl * 0.8)} ${f1(-fl * 0.18)}L${f1(-fl * 0.72)} ${f1(fl * 0.14)}Z` }),
      i % 3 === 0 ? s('circle', { class: 'v', cx: f1(fl * 0.12), cy: -0.5, r: f1(fl * 0.08) }) : null)))
    swim()
    if (wide) put(card, aw + 8, H * 0.5, W - aw - 32)
    else put(card, 12, ah - 6, W - 24)
    card.classList.toggle('wide', wide)
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
