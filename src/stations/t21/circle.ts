import raw from '../../content/tram-21.json'
import { s } from '../../core/dom'
import type { Fact } from '../../core/content'
import type { SceneDef } from '../types'
import type { Perspectives } from '../../ui/part2/types'
import { perspectiveCircle, type PondGeo } from '../../ui/part2/perspectives'
import { blob, rng, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist, moon, reeds } from '../../ui/part2/paint'

const C = raw.scenes.circle
const f1 = (n: number) => n.toFixed(1)

// the stage fills the whole art box (style.css overrides the component's split layout) and the water bleeds past the
// gutters to the window's edges: read the sizes per layout
let SW = 0, SH = 0, PORT = false, GUT = 0
// a shallow arc at two depths, by seed: two big stones near (low in the frame), two small ones far (up by the horizon);
// x, y (share of the stage), scale
const arc = (port: boolean) => {
  const r = rng(2191)
  const j = () => (r() - 0.5) * 0.03
  return port
    ? [[0.21 + j(), 0.54, 1.75], [0.41 + j(), 0.41, 1.02], [0.61 + j(), 0.39, 0.94], [0.79 + j(), 0.52, 1.62]]
    : [[0.19 + j(), 0.86, 1.72], [0.42 + j(), 0.53, 0.86], [0.61 + j(), 0.5, 0.78], [0.82 + j(), 0.8, 1.5]]
}

/** A tall seed-shaped boulder split by a gold seam into two halves (art box -60 -70 120 90, foot on y = 0), with its
 *  reflection under the water line: the same halves flipped, broken by ripples, fading with depth. */
function boulder(k: number, view: number): SVGElement {
  const r = rng(2190 + k * 13)
  const w = 92 + r() * 8, hgt = 80 + r() * 8
  // outline: a lopsided egg; the seam runs from the crown to the foot with a few kinks
  const pts: Pt[] = []
  for (let i = 0; i <= 32; i++) {
    const a = Math.PI * (i / 32) // 0 = right foot … π = left foot, over the top
    const bulge = 1 + 0.05 * Math.sin(a * 3 + k) + 0.04 * Math.sin(a * 5 + r())
    pts.push([Math.cos(a) * (w / 2) * bulge, -(Math.sin(a) ** 0.82) * hgt * bulge])
  }
  const seam: Pt[] = [[2 + r() * 4, -hgt * 1.01], [-4 + r() * 4, -hgt * 0.72], [5 + r() * 4, -hgt * 0.48], [-3 + r() * 4, -hgt * 0.22], [2, 0]]
  const P = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`
  const rightD = `M${seam.map(P).join('L')}L${pts[0][0].toFixed(1)} 0L${pts.slice(0, 17).map(P).join('L')}Z`
  const leftD = `M${seam.map(P).join('L')}L${pts[32][0].toFixed(1)} 0L${pts.slice(16).reverse().map(P).join('L')}Z`
  // moss as a painter dots it: a faint wash, then a cluster of ink dots on the crown's shaded side
  const moss = (cx: number, cy: number, seed: number) => {
    const q = rng(seed)
    let d = ''
    for (let i = 0; i < 9; i++) d += blob(cx + (q() - 0.5) * 18, cy + (q() - 0.5) * 5, 1.2 + q() * 1.8, 0.9 + q() * 1.2, seed + i, 0.3, 7)
    return d
  }
  // the reflection: each half flipped under the water line (it opens with its half, mirrored)
  const mirror = (d: string, side: 'l' | 'r') => s('g', { class: `t21c-mhalf ${side}` },
    s('path', { class: 't21c-mirror', d, transform: 'scale(1 -0.82)', mask: 'url(#t21c-mir)' }))
  const half = (d: string, side: 'l' | 'r') => s('g', { class: `t21c-half ${side}` },
    s('path', { class: 't21c-rock', d, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
    s('path', { class: 't21c-shade', d, fill: 'url(#p2-shade)' }),
    side === 'l'
      ? s('path', { class: 't21c-rim', d: stroke(pts.slice(18, 30), 2.6, 0.3, 0.4, 0.15) })
      : s('path', { class: 't21c-edge', d: stroke(pts.slice(3, 14), 2.4, 0.2, 0.2, 0.3) }),
    // the cut face along the seam: the shell's thickness, lit by the lamp once the stone is open
    s('path', { class: 't21c-cut', d: stroke(seam, 4.6, 0.12, 0.12, 0.5), transform: `translate(${side === 'l' ? -2.2 : 2.2} 0)` }),
    s('path', { class: 't21c-mosswash', d: blob(side === 'l' ? -16 : 14, -hgt * 0.92, 13, 4.4, k + (side === 'l' ? 1 : 2), 0.3) }),
    s('path', { class: 't21c-moss', d: moss(side === 'l' ? -16 : 14, -hgt * 0.92, 2195 + k * 3 + (side === 'l' ? 0 : 1)) }))
  // the hollow inside: the stone's cut section round a cavity warm from a small lamp, its inner lip lit, the carving
  const hollow = s('g', { class: 't21c-hollow' },
    s('path', { class: 't21c-section', d: blob(1, -hgt * 0.47, 30, hgt * 0.44, 2199 + k, 0.08) }),
    s('path', { class: 't21c-cave', d: blob(1, -hgt * 0.46, 24, hgt * 0.37, 2199 + k, 0.08), fill: 'url(#t21c-cavelight)' }),
    s('path', { class: 't21c-lip', d: stroke(Array.from({ length: 13 }, (_, i) => { const a = Math.PI * (0.1 + (i / 12) * 0.8); return [1 + Math.cos(a) * 23, -hgt * 0.46 + Math.sin(a) * hgt * 0.36] as Pt }), 2.2, 0.3, 0.3, 0.2) }),
    s('path', { class: 't21c-carve', d: carving(view, hgt) }),
    s('circle', { class: 't21c-lamp', cx: -13, cy: -hgt * 0.2, r: 2.6 }))
  // the kintsugi seam: a hair of gold, with three glints along it
  const glints = [0.18, 0.5, 0.78].map((u, i) => {
    const p = seam[Math.min(seam.length - 1, Math.round(u * (seam.length - 1)))]
    const z = 2.2 + (i % 2) * 0.8
    return s('path', { class: 't21c-glint', style: `--d:${(i * 1.3 + k * 0.7).toFixed(1)}s`, d: `M${f1(p[0])} ${f1(p[1] - z * 2)}L${f1(p[0] + z * 0.35)} ${f1(p[1] - z * 0.35)}L${f1(p[0] + z * 2)} ${f1(p[1])}L${f1(p[0] + z * 0.35)} ${f1(p[1] + z * 0.35)}L${f1(p[0])} ${f1(p[1] + z * 2)}L${f1(p[0] - z * 0.35)} ${f1(p[1] + z * 0.35)}L${f1(p[0] - z * 2)} ${f1(p[1])}L${f1(p[0] - z * 0.35)} ${f1(p[1] - z * 0.35)}Z` })
  })
  return s('g', { class: 't21c-boulder' },
    mirror(leftD, 'l'),
    mirror(rightD, 'r'),
    s('ellipse', { class: 't21c-wet', cx: 3, cy: 1, rx: w * 0.6, ry: 4.5 }),
    hollow,
    half(leftD, 'l'),
    half(rightD, 'r'),
    s('path', { class: 't21c-seam', d: stroke(seam, 1.25, 0.15, 0.15, 0.4) }),
    ...glints)
}

/** What each hollow holds, carved in a few strokes: a figure · a factory arm · a broken stair going down · an empty chair in a door. */
function carving(view: number, hgt: number): string {
  const y = (v: number) => -hgt * 0.2 - v
  if (view === 0) {
    // a person-shaped machine standing
    return stroke([[0, y(34)], [0, y(16)]], 4.2, 0.1, 0.1, 0.6) + stroke([[-8, y(30)], [0, y(28)], [8, y(30)]], 2.4, 0.1, 0.1) +
      stroke([[-7, y(28)], [-9, y(18)]], 2, 0.1, 0.1) + stroke([[7, y(28)], [9, y(18)]], 2, 0.1, 0.1) +
      stroke([[-2, y(16)], [-4, y(2)]], 2.4, 0.1, 0.1) + stroke([[2, y(16)], [4, y(2)]], 2.4, 0.1, 0.1) + blob(0, y(38), 3.6, 3.8, 3, 0.05, 10)
  }
  if (view === 1) {
    // an industrial arm bolted down
    return stroke([[-12, y(2)], [8, y(2)]], 3.4, 0.05, 0.05, 0.8) + stroke([[-4, y(2)], [-4, y(14)]], 4.6, 0.05, 0.05, 0.8) +
      stroke([[-4, y(14)], [8, y(30)]], 3.6, 0.05, 0.05, 0.7) + stroke([[8, y(30)], [16, y(22)]], 2.8, 0.05, 0.05, 0.6) +
      stroke([[16, y(22)], [19, y(17)]], 1.6, 0.1, 0.3) + stroke([[16, y(22)], [13, y(16)]], 1.6, 0.1, 0.3) + blob(-4, y(14), 2.4, 2.4, 4, 0.05, 8) + blob(8, y(30), 2.2, 2.2, 5, 0.05, 8)
  }
  if (view === 2) {
    // a stair going down, broken in the middle
    return stroke([[-17, y(34)], [-11, y(34)], [-11, y(27)], [-5, y(27)], [-5, y(20)]], 2.4, 0.05, 0.05, 0.8) +
      stroke([[-1, y(17)], [4, y(17)], [4, y(10)], [10, y(10)], [10, y(3)], [17, y(3)]], 2.4, 0.05, 0.05, 0.8) + stroke([[-5, y(20)], [-2, y(18.5)]], 1.2, 0.2, 0.2)
  }
  // a door frame with an empty chair in it
  return stroke([[-13, y(2)], [-13, y(38)], [13, y(38)], [13, y(2)]], 2.2, 0.05, 0.05, 0.8) +
    stroke([[-5, y(2)], [-5, y(14)], [5, y(14)], [5, y(2)]], 2, 0.05, 0.05, 0.6) + stroke([[5, y(14)], [5, y(26)]], 2, 0.05, 0.05, 0.6)
}

/**
 * Scene 4 · Có cần hình người? — GRAZE from the bank, the camera just above the water, 2.5D (perspectiveCircle with its
 * hooks). Four equal boulders stand in the shallows of the moon lake in a shallow arc at two depths — two near and big,
 * two far and small — each with a hair-thin kintsugi seam that glints; their reflections hang under them, broken by
 * ripples. Touch one (1–4): it cracks along the seam and its halves swing open like a seed, showing the shell's cut face;
 * a small lamp in the hollow lights its inner lip and what is carved there — a figure, a factory arm, a broken stair going
 * down, an empty chair in a doorway — and its warm light runs down the water. The words lie on the water in front, with
 * their reflection. All four heard: the four lights meet on the water as one ring of rippling light.
 */
export function circleScene(): SceneDef {
  let host: HTMLElement | null = null
  let back: SVGSVGElement | null = null
  return perspectiveCircle(C.perspectives as Perspectives, {
    label: C.label,
    prompt: C.prompt,
    detail: C.insight as Fact,
    stage(el, api) {
      host = el
      el.closest('.p2c')?.classList.add('t21c')
      back = s('svg', { class: 't21c-back', 'aria-hidden': 'true' }) as SVGSVGElement
      const front = s('svg', { class: 't21c-front', 'aria-hidden': 'true' })
      el.append(back, front)
      api.onLayout((_g, feet) => {
        const W = SW, H = SH, G = GUT
        if (!W || !H || !back) return
        // the svgs reach past the gutters: their viewBox starts G px left of the stage
        const vb = `${f1(-G)} 0 ${f1(W + 2 * G)} ${f1(H)}`
        back.setAttribute('viewBox', vb)
        front.setAttribute('viewBox', vb)
        const X0 = -G, X1 = W + G, WW = W + 2 * G
        const hz = H * (PORT ? 0.27 : 0.31), mx = W * (PORT ? 0.6 : 0.55), mr = Math.min(W, H) * (PORT ? 0.055 : 0.045)
        // ripples: dry strokes that lengthen toward us
        const r = rng(2180)
        let rip = ''
        for (let i = 0; i < 90; i++) {
          const t = r() ** 0.7, y = hz + 4 + (H - hz) * t
          const len = W * (0.015 + t * 0.07) * (0.5 + r())
          const x = X0 + r() * (WW - len)
          rip += stroke([[x, y], [x + len * 0.5, y + (r() - 0.5)], [x + len, y]], 0.7 + t * 1.8, 0.3, 0.3, 0.1)
        }
        let road = ''
        for (let y = hz + 3; y < H; y += 3 + (y - hz) * 0.05 + r() * 3) {
          const near = (y - hz) / (H - hz)
          if (r() > 0.9 - near * 0.25) continue
          const len = W * (0.012 + near * 0.05) * (0.5 + r())
          const x = mx + (r() - 0.5) * W * (0.02 + near * 0.1) - len / 2
          road += stroke([[x, y], [x + len, y + (r() - 0.5)]], 0.8 + near * 2, 0.25, 0.25, 0.1)
        }
        // when a stone opens: a warm broken streak down the water from its foot
        const warm = feet.map(({ x, y, s: k }, i) => s('g', { class: `t21c-under k${i}` }, s('path', { class: 't21c-warm', d: streak(x, y + 4, H, k, 2184 + i) })))
        // all four heard: a ring of light on the water through the four feet, drawn as rippling strokes in two sets that
        // shimmer in turn
        const near = feet.reduce((a, f) => Math.max(a, f.y), 0), far = feet.reduce((a, f) => Math.min(a, f.y), H)
        const rcx = W / 2, rcy = (near + far) / 2 + H * 0.02, rrx = W * (PORT ? 0.36 : 0.34), rry = (near - far) / 2 + H * 0.04
        const ring = ['', '']
        for (let i = 0; i < 64; i++) {
          const a = (i / 64) * Math.PI * 2 + r() * 0.05
          const x = rcx + Math.cos(a) * rrx, y = rcy + Math.sin(a) * rry
          const nearK = (y - (rcy - rry)) / (2 * rry) // 0 far … 1 near
          const len = (8 + nearK * 30) * (0.5 + r() * 0.8)
          ring[i % 2] += stroke([[x - len / 2, y], [x, y + (r() - 0.5) * 0.8], [x + len / 2, y]], 0.8 + nearK * 2.2, 0.3, 0.3, 0.1)
        }
        back.replaceChildren(
          s('defs', null,
            // the reflection mask: fading with depth, broken by horizontal ripples that thicken toward the far edge
            s('linearGradient', { id: 't21c-fade', x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 0.9 }), s('stop', { offset: 0.55, 'stop-color': '#fff', 'stop-opacity': 0.35 }), s('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 })),
            s('mask', { id: 't21c-mir', maskContentUnits: 'objectBoundingBox' },
              s('rect', { x: 0, y: 0, width: 1, height: 1, fill: 'url(#t21c-fade)' }),
              ...[0.12, 0.22, 0.31, 0.39, 0.46, 0.53, 0.59, 0.65, 0.71, 0.77, 0.83, 0.89].map((y, i) => s('rect', { x: (i % 3) * 0.08, y, width: 1, height: 0.012 + i * 0.004, fill: '#000' }))),
            s('radialGradient', { id: 't21c-cavelight', cx: 0.32, cy: 0.78, r: 0.85 },
              s('stop', { offset: 0, style: 'stop-color:var(--lantern);stop-opacity:.95' }),
              s('stop', { offset: 0.35, style: 'stop-color:var(--lantern);stop-opacity:.45' }),
              s('stop', { offset: 1, style: 'stop-color:var(--umbra);stop-opacity:.95' }))),
          mist(W * 0.5, hz - H * 0.12, WW * 0.65, H * 0.18),
          moon(mx, hz - H * (PORT ? 0.13 : 0.17), mr, 2185, true),
          hills(X0 - W * 0.02, X1 + W * 0.02, hz + 1, H * (PORT ? 0.1 : 0.13), 2186, 0.88, PORT ? 3 : 6),
          hills(X0, W * 0.42, hz + 2, H * (PORT ? 0.07 : 0.08), 2187, 0.5, 2),
          s('rect', { class: 't21c-water', x: f1(X0), y: f1(hz), width: f1(WW), height: f1(H - hz + 4) }),
          // the far edge of the water melts into the mist over the whole width
          s('rect', { class: 't21c-haze', x: f1(X0), y: f1(hz - H * 0.05), width: f1(WW), height: f1(H * 0.12), fill: 'url(#t21c-hazeg)' }),
          s('ellipse', { class: 't21c-moonglow', cx: f1(mx), cy: f1(hz + (H - hz) * 0.42), rx: f1(W * 0.09), ry: f1((H - hz) * 0.55) }),
          ...warm,
          s('path', { class: 't21c-ripple', d: rip }),
          s('path', { class: 't21c-road', d: road }),
          s('g', { class: 't21c-ring' }, s('path', { class: 't21c-ring-a', d: ring[0] }), s('path', { class: 't21c-ring-b', d: ring[1] })),
          mist(W * 0.5, hz + H * 0.015, WW * 0.62, H * 0.03))
        back.querySelector('defs')!.append(s('linearGradient', { id: 't21c-hazeg', x1: 0, y1: 0, x2: 0, y2: 1 },
          s('stop', { offset: 0, style: 'stop-color:var(--mist);stop-opacity:0' }),
          s('stop', { offset: 0.42, style: 'stop-color:var(--mist);stop-opacity:var(--mist-a)' }),
          s('stop', { offset: 1, style: 'stop-color:var(--mist);stop-opacity:0' })))
        // the near bank: reeds at both edges of the window, out of focus, cut by the frame
        front.replaceChildren(
          reeds(X0 + WW * 0.03, H + 4, H * (PORT ? 0.24 : 0.3), 2188, 9),
          reeds(X1 - WW * 0.03, H + 4, H * (PORT ? 0.2 : 0.26), 2189, 7))
      })
      return () => back?.remove()
    },
    place(k, n, g: PondGeo) {
      // the stage fills the art box (CSS): measure it once per layout, here, before the component writes the stones
      if (k === 0 && host) {
        const box = host.closest('.p2c') as HTMLElement | null
        SW = box?.clientWidth ?? g.w
        SH = box?.clientHeight ?? g.h
        PORT = SH > SW * 1.05
        GUT = back ? Math.max(0, (back.getBoundingClientRect().width - SW) / 2) : 0
      }
      const [x, y, sc] = arc(PORT)[k % 4]
      void n
      return { x: SW * x, y: SH * y, s: sc }
    },
    stone: (k, _g, i) => boulder(k, i),
  })
}

/** A warm broken streak down the water from a stone's foot (the light of its open hollow). */
function streak(x: number, y0: number, H: number, k: number, seed: number) {
  const r = rng(seed)
  let d = ''
  for (let y = y0; y < H; y += 3 + (y - y0) * 0.06 + r() * 2) {
    const near = (y - y0) / Math.max(1, H - y0)
    if (r() > 0.85) continue
    const len = (10 + near * 40) * k * (0.5 + r())
    const xx = x + (r() - 0.5) * (6 + near * 30) * k - len / 2
    d += stroke([[xx, y], [xx + len, y]], 1 + near * 2, 0.25, 0.25, 0.1)
  }
  return d
}
