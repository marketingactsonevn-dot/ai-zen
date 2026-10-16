import { s } from '../../core/dom'
import type { SceneCtx } from '../types'
import { blob, clamp, curve, rng, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist, moon, reeds, toro, wash, water } from '../../ui/part2/paint'
import { perspectiveCircle, type PondGeo } from '../../ui/part2/perspectives'
import type { Perspectives } from '../../ui/part2/types'
import { C } from './data'

const G = C.scenes.loop
const V = G.perspectives as Perspectives
const f1 = (n: number) => n.toFixed(1)
const P = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`

/** split a name into at most three carved lines of at most `max` characters */
function lines(who: string, max: number): string[] {
  const out: string[] = []
  for (const w of who.split(' ')) {
    const last = out[out.length - 1]
    if (last != null && (last + ' ' + w).length <= max) out[out.length - 1] = `${last} ${w}`
    else out.push(w)
  }
  return out.length <= 3 ? out : [out.slice(0, -2).join(' '), ...out.slice(-2)]
}

/**
 * A tall standing stone in the stone box (viewBox -60 -70 120 90, foot on y = 0, cut by the frame below): a rough outline,
 * a moonlit face and a shadow side split by a crease, a lit cap, grain, cracks and lichen, a hard line of moonlight down
 * its upper-left edge. The speaker's name is cut into it; touched, it turns its dressed, carved face to you.
 * unit = screen px per box unit (names stay legible: at least ~13 px on screen).
 */
function standing(k: number, who: string, unit: number): SVGElement {
  const r = rng(2870 + k * 13)
  const w = 62 + r() * 14, top = -(108 + r() * 30), lean = (r() - 0.5) * 14, peak = 0.32 + r() * 0.36
  // the crown: narrower than the foot, irregular; the sides bulge and lean (a menhir, not a slab)
  const cw = w * (0.62 + r() * 0.16)
  const pts: Pt[] = []
  for (let i = 0; i <= 14; i++) {
    const t = i / 14
    const x = -cw / 2 + cw * t + lean * (1 - Math.abs(t - 0.5) * 2)
    const y = top + Math.pow(Math.abs(t - peak) * 1.8, 1.6) * 40 + (r() - 0.5) * 7
    pts.push([x, y])
  }
  const L: Pt = [-w / 2 - 4, 26], Rt: Pt = [w / 2 + 4, 26]
  const sideL: Pt[] = [[-w / 2 - 2 + (r() - 0.5) * 4, -10], [-w / 2 + (r() - 0.3) * 6, top + 75], [-cw / 2 - 4 + lean * 0.3, top + 38]]
  const sideR: Pt[] = [[cw / 2 + 5 + lean * 0.3, top + 30], [w / 2 + 2 + (r() - 0.6) * 6, top + 70], [w / 2 + 2 + (r() - 0.5) * 4, -14]]
  const body = `M${P(L)}L${sideL.map(P).join('L')}L${pts.map(P).join('L')}L${sideR.map(P).join('L')}L${P(Rt)}Z`
  // the crease from the peak down to the foot: left of it the face (moonlit), right of it the side (shadow)
  const pk = Math.round(peak * 14)
  const crease: Pt[] = [pts[pk], [pts[pk][0] + w * 0.06, top + 40], [pts[pk][0] + w * 0.1 + lean * 0.2, 26]]
  const face = `M${P(L)}L${sideL.map(P).join('L')}L${pts.slice(0, pk + 1).map(P).join('L')}L${crease.slice(1).map(P).join('L')}Z`
  const cap = `M${P(pts[Math.max(0, pk - 3)])}L${P(pts[pk])}L${P(pts[Math.min(14, pk + 2)])}L${P([pts[pk][0] + 4, pts[pk][1] + 14])}Z`
  let cracks = '', lichen = '', grain = ''
  for (let i = 0; i < 5; i++) {
    let p: Pt = [-w * 0.35 + r() * w * 0.7, top + 30 + r() * 70]
    const cp: Pt[] = [p]
    for (let j = 0; j < 4; j++) cp.push((p = [p[0] + (r() - 0.5) * 7, p[1] + 5 + r() * 7]))
    cracks += stroke(cp, 1.2, 0.2, 0.4, 0.2)
  }
  for (let i = 0; i < 6; i++) lichen += blob(-w * 0.4 + r() * w * 0.8, top + 40 + r() * 80, 2 + r() * 4, 1.5 + r() * 2.5, 2890 + k * 7 + i, 0.3, 8)
  for (let i = 0; i < 40; i++) grain += blob(-w * 0.45 + r() * w * 0.9, top + 20 + r() * 110, 0.6 + r() * 0.9, 0.5 + r() * 0.6, 2900 + k * 40 + i, 0.2, 5)
  const rim = stroke(pts.slice(0, pk + 1).map(([x, y]) => [x + 1.2, y + 1.6] as Pt), 2.4, 0.15, 0.2, 0.2)
  const edge = stroke([...sideL.slice(1).map(([x, y]) => [x + 1.6, y] as Pt), [pts[0][0] + 1.5, pts[0][1] + 4]], 2, 0.3, 0.3, 0.2)
  // the name: at least ~13 px on screen, three lines at most, inside the stone's width
  const fs = clamp(13 / unit, 6.2, 11)
  const ls = lines(who, Math.max(6, Math.floor((cw * 0.8) / (fs * 0.52))))
  const words = (cls: string) => ls.map((t, i) => s('text', { class: cls, x: f1(lean * 0.35 - 2), y: f1(top + 42 + i * fs * 1.25), 'text-anchor': 'middle', style: `font-size:${f1(fs)}px` }, t))
  return s('g', { class: 't28v-stone' },
    s('ellipse', { class: 't28v-foot', cx: 4, cy: 24, rx: f1(w * 0.62), ry: 5 }),
    s('g', { class: 't28v-back' },
      s('path', { class: 't28v-side', d: body, filter: 'url(#ink-rough)' }),
      s('path', { class: 't28v-lit', d: face }),
      s('path', { class: 't28v-cap', d: cap }),
      s('path', { class: 't28v-grain', d: grain }),
      s('path', { class: 't28v-crack', d: cracks }),
      s('path', { class: 't28v-lichen', d: lichen }),
      s('path', { class: 't28v-rim', d: rim + edge }),
      ...words('t28v-words t28v-words-back')),
    s('g', { class: 't28v-face' },
      s('path', { class: 't28v-dressed', d: body, filter: 'url(#ink-rough)' }),
      s('path', { class: 't28v-rim', d: rim }),
      ...words('t28v-words')))
}

// four stones close to the viewer: where each stands across the frame (share of its width), how near (1 = nearest), how tall
const SPOT = [{ u: 0.13, d: 1, s: 1.15 }, { u: 0.36, d: 0.3, s: 0.9 }, { u: 0.6, d: 0.85, s: 1.25 }, { u: 0.85, d: 0.4, s: 1.02 }]

/**
 * Bốn lời bình bên hồ (art direction §4 t28 `loop.perspectives`, comp/2.5D): four tall standing stones close to the viewer,
 * overlapping in depth and cut by the frame's foot; past them the lake runs to the frame's edges, the waterwheel and its
 * islands small and far, the wheel still turning. Touch a stone: it turns its carved face to you, the speaker's words are
 * pinned on it, and the lake takes that view — a silver moat of money round NVIDIA (Wedbush), a thread pulled thin
 * (Global X), many streams pouring in from beyond (Jensen Huang), the water swelling into a glossy, trembling dome with the
 * moon stretched on it (Bank of England). All four: half moat, half dome.
 */
export function voicesScene(ctx: SceneCtx) {
  let host: HTMLElement | null = null
  const near = ctx.reduced || ctx.quality === 'low'
  // the frame round the circle's stage (it keeps a column for its card; this scene paints and stands stones over all of it)
  const fr = { x0: 0, W: 1, H: 1, wide: true, bw: 64 }
  const feet: { x: number; y: number; s: number }[] = []
  const sc = () => (fr.wide ? clamp(fr.H / 300, 1.5, 2.4) : 2.15)
  return perspectiveCircle(V, {
    label: G.circleLabel,
    stage: (el, api) => {
      host = el
      el.classList.add('t28v')
      const sky = s('svg', { class: 't28v-l t28v-sky', 'aria-hidden': 'true' })
      const far = s('svg', { class: 't28v-l t28v-far', 'aria-hidden': 'true' })
      const lake = s('svg', { class: 't28v-l t28v-lake', 'aria-hidden': 'true' })
      el.append(sky, far, lake)
      api.onLayout((g: PondGeo) => {
        const { w, h } = g
        const r = rng(2880)
        // in stage px, the whole frame: from its left edge to its right, from its top to its foot
        const X0 = -fr.x0 - 8, X1 = fr.W - fr.x0 + 8, YB = fr.H + 8, FW = X1 - X0
        ;[sky, far, lake].forEach((v) => v.setAttribute('viewBox', `0 0 ${f1(w)} ${f1(h)}`))
        const hz = fr.wide ? h * 0.42 : h * 0.4
        const mx = X0 + FW * (fr.wide ? 0.42 : 0.5)
        sky.replaceChildren(
          mist(mx, hz - h * 0.1, FW * 0.5, h * 0.18),
          moon(mx - FW * 0.06, h * (fr.wide ? 0.16 : 0.14), Math.min(FW, h) * 0.07, 2881, true),
          hills(X0, X1, hz, h * 0.18, 2882, 0.9, Math.max(4, Math.round(FW / 260))),
          mist(mx, hz, FW * 0.6, h * 0.04))
        // the islands of the last scene, far and small: NVIDIA with its mill and wheel, the AI pavilion, the data centre's lamps
        const cxw = X0 + FW * 0.5
        const nv: Pt = [cxw, hz + h * 0.13], ai: Pt = [cxw - FW * 0.26, hz + h * 0.08], dc: Pt = [cxw + FW * 0.27, hz + h * 0.085]
        const wr = Math.min(h * 0.1, FW * 0.06)
        let spokes = ''
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2
          spokes += `M${f1(Math.cos(a) * wr * 0.15)} ${f1(Math.sin(a) * wr * 0.15)}L${f1(Math.cos(a) * wr)} ${f1(Math.sin(a) * wr)}`
        }
        const isle = (p: Pt, ww: number) => s('path', { class: 't28v-isle', d: `M${f1(p[0] - ww / 2)} ${f1(p[1])}Q${f1(p[0] - ww * 0.3)} ${f1(p[1] - ww * 0.22)} ${f1(p[0])} ${f1(p[1] - ww * 0.24)}Q${f1(p[0] + ww * 0.32)} ${f1(p[1] - ww * 0.2)} ${f1(p[0] + ww / 2)} ${f1(p[1])}Z`, filter: 'url(#ink-rough)' })
        const lamps: SVGElement[] = []
        for (let k = 0; k < 4; k++) lamps.push(s('g', { transform: `translate(${f1(dc[0] - wr * 0.6 + k * wr * 0.4)} ${f1(dc[1] - wr * 0.18)})` }, toro(0, 0, wr * 0.55, true)))
        far.replaceChildren(
          isle(ai, wr * 2.2), isle(dc, wr * 2.6), isle(nv, wr * 3.4),
          s('rect', { class: 't28v-mill', x: f1(nv[0] + wr * 0.35), y: f1(nv[1] - wr * 1.25), width: f1(wr * 0.9), height: f1(wr * 0.6) }),
          s('path', { class: 't28v-millroof', d: `M${f1(nv[0] + wr * 0.25)} ${f1(nv[1] - wr * 1.25)}L${f1(nv[0] + wr * 1.35)} ${f1(nv[1] - wr * 1.25)}L${f1(nv[0] + wr * 1.1)} ${f1(nv[1] - wr * 1.5)}L${f1(nv[0] + wr * 0.5)} ${f1(nv[1] - wr * 1.5)}Z` }),
          s('g', { transform: `translate(${f1(nv[0] - wr * 0.2)} ${f1(nv[1] - wr * 0.95)})` },
            s('g', { class: 't28v-wheel' }, s('circle', { class: 't28v-rimc', r: f1(wr) }), s('path', { class: 't28v-spoke', d: spokes }))),
          s('circle', { cx: f1(ai[0]), cy: f1(ai[1] - wr * 0.5), r: f1(wr * 0.6), fill: 'url(#p2-lamp)' }),
          s('path', { class: 't28v-pav', d: `M${f1(ai[0] - wr * 0.5)} ${f1(ai[1] - wr * 0.55)}L${f1(ai[0] + wr * 0.5)} ${f1(ai[1] - wr * 0.55)}L${f1(ai[0] + wr * 0.25)} ${f1(ai[1] - wr * 0.8)}L${f1(ai[0] - wr * 0.25)} ${f1(ai[1] - wr * 0.8)}Z` }),
          ...lamps)
        // the lake and the money on it: a base loop, then one painting per speaker (CSS shows the one heard last)
        const loopD = `M${P([nv[0] - wr, nv[1] + 4])}Q${P([cxw - FW * 0.18, hz + h * 0.2])} ${P([ai[0] + wr * 0.6, ai[1] + 3])}Q${P([cxw, hz + h * 0.04])} ${P([dc[0] - wr * 0.8, dc[1] + 3])}Q${P([cxw + FW * 0.2, hz + h * 0.22])} ${P([nv[0] + wr * 1.2, nv[1] + 5])}`
        // Wedbush: a broad silver band of money flowing round NVIDIA's island (its moat)
        const moatR: [number, number] = [wr * 3.1, h * 0.045]
        const ring = (k: number) => blob(nv[0], nv[1] + h * 0.012, moatR[0] * (1 + k * 0.12), moatR[1] * (1 + k * 0.14), 2883 + k, 0.025, 28)
        let inflow = ''
        for (let i = 0; i < 9; i++) {
          const sx = r() < 0.5 ? X0 : X1, sy = hz + h * (0.06 + r() * 0.4)
          inflow += stroke(curve([sx, sy], [(sx + nv[0]) / 2 + (r() - 0.5) * FW * 0.2, (sy + nv[1]) / 2 + h * 0.08], [nv[0] + (r() - 0.5) * wr * 3, nv[1] + h * 0.02], 14), 3 + r() * 3, 0.1, 0.4, 0.2)
        }
        // Bank of England: the lake swells into a glossy dome on the bank; the moon stretched long and bright across it
        const dome = `M${P([cxw - FW * 0.36, hz + h * 0.3])}Q${P([cxw, hz - h * 0.04])} ${P([cxw + FW * 0.36, hz + h * 0.3])}Q${P([cxw, hz + h * 0.37])} ${P([cxw - FW * 0.36, hz + h * 0.3])}Z`
        const sheen = `M${P([cxw - FW * 0.25, hz + h * 0.2])}Q${P([cxw - FW * 0.05, hz + h * 0.06])} ${P([cxw + FW * 0.18, hz + h * 0.12])}`
        const gid = `t28v-dome-${Math.round(w)}`
        lake.replaceChildren(
          s('defs', null,
            s('radialGradient', { id: gid, cx: 0.42, cy: 0.35, r: 0.7 },
              s('stop', { offset: 0, class: 't28v-dg0' }), s('stop', { offset: 0.55, class: 't28v-dg1' }), s('stop', { offset: 1, class: 't28v-dg2' })),
            s('linearGradient', { id: `${gid}-far`, x1: 0, x2: 0, y1: 0, y2: 1 },
              s('stop', { offset: 0, class: 't28v-fg0' }), s('stop', { offset: 1, class: 't28v-fg1' }))),
          water(X0, hz, X1, YB, 2887, mx - FW * 0.06),
          // the far water dissolves into the mist under the hills: no hard edge along the horizon
          s('rect', { x: f1(X0), y: f1(hz - h * 0.02), width: f1(FW), height: f1(h * 0.09), fill: `url(#${gid}-far)` }),
          s('path', { class: 't28v-loop', d: loopD }),
          s('g', { class: 't28v-st t28v-st0' },
            s('path', { class: 't28v-band', d: ring(0) + ring(1), 'fill-rule': 'evenodd' }),
            s('path', { class: 't28v-bandflow', d: ring(0.5), pathLength: 1 })),
          s('g', { class: 't28v-st t28v-st1' }, s('path', { class: 't28v-rope', d: loopD }), s('path', { class: 't28v-fray', d: `M${P([cxw + FW * 0.16, hz + h * 0.155])}l6 -4M${P([cxw + FW * 0.165, hz + h * 0.16])}l7 3` })),
          s('g', { class: 't28v-st t28v-st2' }, s('path', { class: 't28v-in', d: inflow })),
          s('g', { class: 't28v-st t28v-st3' },
            s('g', { class: 't28v-domeg' },
              s('path', { class: 't28v-dome', d: dome, fill: `url(#${gid})` }),
              s('path', { class: 't28v-sheen', d: sheen }),
              s('ellipse', { class: 't28v-domemoon', cx: f1(mx - FW * 0.06), cy: f1(hz + h * 0.13), rx: f1(FW * 0.012), ry: f1(h * 0.085) }))),
          mist(cxw, hz + h * 0.01, FW * 0.62, h * 0.06),
          wash(blob(cxw, fr.H * 0.98, FW * 0.6, h * 0.08, 2884, 0.2), 0.35, 'p2p-wash t28v-shore'),
          reeds(X0 + FW * 0.02, fr.H * 0.98, h * 0.2, 2885, 7),
          reeds(X1 - FW * 0.02, fr.H * 0.99, h * 0.18, 2886, 6))
      })
      // parallax: stones, near water, the islands and the sky drift apart with the pointer (transforms only)
      const move = (e: PointerEvent) => {
        if (near) return
        const b = el.getBoundingClientRect()
        el.style.setProperty('--px', clamp((e.clientX - b.left) / b.width - 0.5, -0.5, 0.5).toFixed(3))
        el.style.setProperty('--py', clamp((e.clientY - b.top) / b.height - 0.5, -0.5, 0.5).toFixed(3))
      }
      const root = el.closest('.p2c') as HTMLElement | null
      root?.addEventListener('pointermove', move)
      return () => root?.removeEventListener('pointermove', move)
    },
    // four tall stones over the whole frame's foot: the near ones big and low, the far ones smaller and set back; they
    // overlap and the frame cuts them
    place: (k, _n, g) => {
      if (k === 0) {
        // once per layout: where the circle put its stage in the frame (inline styles it has just written), the frame
        const stage = host?.parentElement
        const root = stage?.parentElement
        fr.x0 = parseFloat(stage?.style.left || '0') || 0
        fr.W = ctx.art.clientWidth
        fr.H = parseFloat(root?.style.height || '0') || g.h
        fr.wide = fr.W / fr.H > 1.15
        fr.bw = clamp(Math.min(g.w, g.h * 1.7) * 0.19, 64, 140) // the circle's stone box width (perspectives.ts)
        root?.style.setProperty('--t28v-below', `${f1(Math.max(0, fr.H - g.h))}px`)
      }
      const sp = SPOT[k % SPOT.length]
      const x = -fr.x0 + fr.W * sp.u
      const y = fr.H * (1.02 - (1 - sp.d) * 0.1)
      feet[k] = { x, y, s: sc() * sp.s * (0.78 + sp.d * 0.22) }
      return { x, y, s: feet[k].s, z: 10 + Math.round(sp.d * 10) }
    },
    stone: (k, _g, i) => standing(k, V.stones[i].who, (fr.bw * (feet[k]?.s ?? 1)) / 120),
    onHear: (k, i) => {
      const p = host?.closest('.p2c') as HTMLElement | null
      if (!p) return
      for (let j = 0; j < V.stones.length; j++) p.classList.toggle(`t28v-who${j}`, j === i)
      // the words are pinned on the stone that turned: just over its head, inside the frame
      const f = feet[k]
      if (!f) return
      const cw = Math.min(fr.wide ? 330 : 300, fr.W * 0.86)
      const unit = (fr.bw * f.s) / 120
      p.style.setProperty('--t28v-cx', `${f1(clamp(f.x + fr.x0, cw / 2 + fr.W * 0.05, fr.W - cw / 2 - fr.W * 0.05))}px`)
      p.style.setProperty('--t28v-cb', `${f1(f.y - unit * 96)}px`)
      p.style.setProperty('--t28v-cw', `${f1(cw)}px`)
    },
  }).mount(ctx)
}
