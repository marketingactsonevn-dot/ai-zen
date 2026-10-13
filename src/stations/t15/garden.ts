import { h, nextId, s } from '../../core/dom'
import type { SceneCtx } from '../types'
import { brush, ell, poly, type Pt } from './brush'

/** Shared pieces of the Trạm 15 garden: the stone lantern (you), flat stepping stones, raked sand, the agent's light. */

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const f1 = (n: number) => n.toFixed(1)

/** Gradients every picture here uses; ids are unique per scene so two scenes fading over each other never clash. */
export function gardenDefs() {
  const id = { stone: nextId('t15s'), side: nextId('t15l'), pool: nextId('t15p'), glow: nextId('t15g'), orb: nextId('t15o'), dryH: nextId('t15d'), you: nextId('t15y') }
  const defs = s('defs', null,
    // dry brush for horizontal strokes: the global ink-dry streaks run up and down, these run along the stroke
    s('filter', { id: id.dryH, x: '-5%', y: '-60%', width: '110%', height: '220%' },
      s('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.035 0.8', numOctaves: '2', seed: '5', result: 'n' }),
      s('feColorMatrix', { in: 'n', type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.5', result: 'm' }),
      s('feComposite', { in: 'SourceGraphic', in2: 'm', operator: 'in' })),
    s('radialGradient', { id: id.you },
      s('stop', { offset: 0, class: 'you0' }),
      s('stop', { offset: 0.55, class: 'you1' }),
      s('stop', { offset: 1, class: 'you2' })),
    s('linearGradient', { id: id.stone, x1: 0, y1: 0, x2: 0.3, y2: 1 },
      s('stop', { offset: 0, class: 'gs0' }),
      s('stop', { offset: 1, class: 'gs1' })),
    // the lantern is lit from the upper left: each block runs light → stone → shadow side
    s('linearGradient', { id: id.side, x1: 0, y1: 0, x2: 1, y2: 0 },
      s('stop', { offset: 0, class: 'gs0' }),
      s('stop', { offset: 0.5, class: 'gs1' }),
      s('stop', { offset: 1, class: 'gsd' })),
    s('radialGradient', { id: id.pool },
      s('stop', { offset: 0, class: 'pool0' }),
      s('stop', { offset: 1, class: 'pool1' })),
    s('radialGradient', { id: id.glow },
      s('stop', { offset: 0, class: 'glow0' }),
      s('stop', { offset: 0.35, class: 'glow1' }),
      s('stop', { offset: 1, class: 'glow2' })),
    s('radialGradient', { id: id.orb },
      s('stop', { offset: 0, class: 'orb0' }),
      s('stop', { offset: 0.4, class: 'orb1' }),
      s('stop', { offset: 1, class: 'orb2' })))
  return { defs, id }
}
export type Ids = ReturnType<typeof gardenDefs>['id']

/**
 * A kasuga-style stone lantern standing on (x, y), LH tall: foot, pillar, platform, light box, curled roof, jewel.
 * Returns the group and the window centre (where the thread to the agent starts) and the glow to pulse.
 */
export function lantern(x: number, y: number, LH: number, ids: Ids, r: () => number) {
  const u = LH / 100
  const T = (pts: Pt[]) => pts.map(([a, b]) => [x + a * u, y + b * u] as Pt)
  const g = s('g', { class: 't15-lantern' })
  const sideFill = `url(#${ids.side})`
  g.append(s('path', { class: 'sh', 'fill-opacity': 0.16, d: ell(x + 9 * u, y + 0.8 * u, 34 * u, 4 * u), filter: 'url(#ink-wash)' }))
  const body = s('g', { filter: 'url(#ink-rough)' })
  const block = (pts: Pt[], edge = 1) => {
    const P = T(pts)
    body.append(s('path', { d: poly(P), fill: sideFill }))
    // a heavier stroke down the shadow side, a hairline on the lit side
    const n = P.length
    const right = P.slice(1, Math.ceil(n / 2) + 1)
    body.append(s('path', { class: 'k', 'fill-opacity': 0.8, d: brush(right, Math.max(1.2, 1.5 * u * edge), { a: 0.15, b: 0.3, min: 0.3 }).d }))
    body.append(s('path', { class: 'k', 'fill-opacity': 0.55, d: brush([...P.slice(Math.ceil(n / 2)), P[0]], Math.max(0.8, 0.8 * u * edge), { a: 0.2, b: 0.3, min: 0.3 }).d }))
  }
  // foot (kiso), pillar (sao) with its ring, platform (chūdai)
  block([[-18, 0], [18, 0], [17, -4], [14, -7.5], [-14, -7.5], [-17, -4]])
  block([[-5.6, -7.5], [5.6, -7.5], [4.6, -46], [-4.6, -46]], 0.8)
  block([[-5.9, -25.5], [5.9, -25.5], [5.7, -29], [-5.7, -29]], 0.6)
  block([[-6, -46], [6, -46], [13, -50], [15.5, -53], [-15.5, -53], [-13, -50]])
  // light box (hibukuro) and its window
  block([[-10, -53], [10, -53], [10, -70.5], [-10, -70.5]])
  const win = T([[-6, -56.5], [6, -56.5], [6, -67], [-6, -67]])
  const winC: Pt = [x, y - 61.8 * u]
  const glow = s('circle', { class: 't15-glow', cx: f1(winC[0]), cy: f1(winC[1]), r: f1(30 * u), fill: `url(#${ids.glow})` })
  body.append(s('path', { class: 'win', d: poly(win) }))
  body.append(s('path', { class: 'k', 'fill-opacity': 0.7, d: brush([[x, y - 57 * u], [x, y - 66.6 * u]], Math.max(0.8, 0.9 * u), { straight: true, a: 0.1, b: 0.1 }).d }))
  // roof (kasa) with curled tips (warabide), then the jewel (hōju)
  const roof = T([[-24, -70], [-28.5, -73.6], [-26.5, -75.4], [-21, -74.4], [-9, -79.6], [0, -84.5], [9, -79.6], [21, -74.4], [26.5, -75.4], [28.5, -73.6], [24, -70]])
  body.append(s('path', { d: poly(roof), fill: sideFill }))
  body.append(s('path', { class: 'k', d: brush(roof.slice(1, 10), Math.max(1.4, 2.1 * u), { a: 0.08, b: 0.12, min: 0.3 }).d }))
  body.append(s('path', { class: 'k', 'fill-opacity': 0.6, d: brush([roof[10], roof[0]], Math.max(1, 1.2 * u), { straight: true, a: 0.1, b: 0.1 }).d }))
  block([[-4.2, -84], [4.2, -84], [4.2, -86.4], [-4.2, -86.4]], 0.6)
  const jewel = `M${f1(x - 4.6 * u)} ${f1(y - 86.4 * u)}Q${f1(x - 5.6 * u)} ${f1(y - 92 * u)} ${f1(x)} ${f1(y - 98 * u)}Q${f1(x + 5.6 * u)} ${f1(y - 92 * u)} ${f1(x + 4.6 * u)} ${f1(y - 86.4 * u)}Z`
  body.append(s('path', { d: jewel, fill: sideFill }), s('path', { class: 'k', 'fill-opacity': 0.7, d: brush(T([[0.5, -97.5], [3.4, -93], [4.6, -87]]), Math.max(1, 1.2 * u), { a: 0.2, b: 0.3 }).d }))
  // dry-brush grain down the pillar, moss on the roof and the foot
  const dry = s('g', { filter: 'url(#ink-dry)', class: 'sh', 'fill-opacity': 0.35 })
  for (const k of [0, 1]) dry.append(s('path', { d: brush(T([[1 + k * 1.6, -12], [1.5 + k * 1.2, -24], [1 + k, -42]]), 2.2 * u, { a: 0.2, b: 0.4 }).d }))
  const moss = s('g', { class: 'm', filter: 'url(#ink-rough)' })
  for (let k = 0; k < 16; k++) {
    const onRoof = k < 9
    const t = r()
    const px = onRoof ? -22 + t * 30 : -17 + t * 14
    const py = onRoof ? -71.5 - (1 - Math.abs(px) / 28) * 12 * (0.75 + r() * 0.2) : -6.5 + r() * 2
    moss.append(s('path', { d: ell(x + px * u, y + py * u, (0.8 + r() * 1.6) * u, (0.5 + r() * 0.8) * u), 'fill-opacity': (0.5 + r() * 0.45).toFixed(2) }))
  }
  g.append(glow, body, dry, moss)
  return { g, win: winC, glow, top: y - 98 * u, half: 28.5 * u }
}

/** A flat stepping stone seen from a low angle: a lit top, a dark flank, a shadow on the sand, a rim of light. */
export function flatStone(x: number, y: number, rx: number, ry: number, ids: Ids, r: () => number) {
  const g = s('g')
  const th = ry * 0.55
  const pts: Pt[] = []
  for (let a = 0; a <= 360; a += 15) {
    const t = (a * Math.PI) / 180
    const j = 1 + (r() - 0.5) * 0.12
    pts.push([x + rx * j * Math.cos(t), y + ry * j * Math.sin(t)])
  }
  pts[pts.length - 1] = pts[0]
  const lower = pts.slice(0, 13)
  const top = `M${pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')}Z`
  const drop = (a: number) => th * (0.7 + 0.3 * Math.sin(Math.PI * clamp((a - x + rx) / (2 * rx), 0, 1)))
  const under = lower.map(([a, b]) => [a, b + drop(a)] as Pt)
  const flank = `M${lower.map(([a, b]) => `${f1(a)} ${f1(b)}`).join('L')}L${under.slice().reverse().map(([a, b]) => `${f1(a)} ${f1(b)}`).join('L')}Z`
  g.append(
    s('path', { class: 'sh', 'fill-opacity': 0.15, d: ell(x + rx * 0.12, y + ry * 0.9, rx * 1.14, ry * 0.9), filter: 'url(#ink-wash)' }),
    s('path', { class: 'st-f', d: flank, filter: 'url(#ink-rough)' }),
    s('path', { d: top, fill: `url(#${ids.stone})`, filter: 'url(#ink-rough)' }),
    s('path', { class: 'sh', d: brush(under.slice(1), Math.max(1.4, rx * 0.07), { a: 0.12, b: 0.45 }).d, filter: 'url(#ink-rough)' }),
    s('path', { class: 'k', 'fill-opacity': 0.5, d: brush(lower.slice(4, 13), Math.max(0.8, rx * 0.024), { a: 0.3, b: 0.3 }).d }),
    s('path', { class: 'rim', d: brush(pts.slice(14, 22), Math.max(1, rx * 0.05), { a: 0.25, b: 0.4 }).d }))
  return g
}

/** Straight rakes from y0 down to y1, combed four tines at a time, wider apart as they come closer; a soft wave so they look hand-drawn. */
export function rakes(x0: number, x1: number, y0: number, y1: number, gap0 = 5, gap1 = 16) {
  const g = s('g')
  for (let y = y0, k = 0; y < y1; k++) {
    const pts: string[] = []
    for (let x = x0; x <= x1 + 24; x += 24) pts.push(`${x} ${f1(y + 0.9 * Math.sin(x / 47 + (k >> 2) * 0.8))}`)
    const d = `M${pts.join('L')}`
    g.append(s('path', { d, class: 'rk' }), s('path', { d, class: 'rk-hi', transform: 'translate(0 1.4)' }))
    const gap = gap0 + (gap1 - gap0) * ((y - y0) / Math.max(1, y1 - y0))
    y += k % 4 === 3 ? gap * 2.2 : gap * 0.7
  }
  return g
}

/**
 * Rakes inside a soft oval: the raked patch fades out at its edges instead of ending in a hard box.
 * `keepOff` (a centreline and a width) keeps the straight rakes away from a band — `extra` (e.g. rakes that follow it) fills it.
 */
export function softRakes(defs: SVGDefsElement, x: number, y: number, w: number, hh: number, gap0 = 5, gap1 = 16, keepOff?: { d: string; w: number }, extra: SVGElement[] = []) {
  const id = nextId('t15rk')
  defs.append(
    s('radialGradient', { id: `${id}-g`, cx: 0.5, cy: 0.5, r: 0.5 },
      s('stop', { offset: 0.55, 'stop-color': '#fff', 'stop-opacity': 1 }),
      s('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 })),
    s('mask', { id, maskUnits: 'userSpaceOnUse', x, y, width: w, height: hh },
      s('rect', { x, y, width: w, height: hh, fill: `url(#${id}-g)` })))
  let straight: SVGElement = rakes(x, x + w, y + 4, y + hh, gap0, gap1)
  if (keepOff) {
    defs.append(s('mask', { id: `${id}-k`, maskUnits: 'userSpaceOnUse', x, y, width: w, height: hh },
      s('rect', { x, y, width: w, height: hh, fill: '#fff' }),
      s('path', { d: keepOff.d, fill: 'none', stroke: '#000', 'stroke-width': f1(keepOff.w), 'stroke-linecap': 'round' })))
    straight = s('g', { mask: `url(#${id}-k)` }, straight)
  }
  return s('g', { mask: `url(#${id})` }, straight, ...extra)
}

/** The agent: a small ember of vermilion light (the colour of AI attention) hovering over a soft shadow. */
export function orb(R: number, ids: Ids, label?: string) {
  const halo = s('circle', { r: f1(R * 3.2), fill: `url(#${ids.orb})`, class: 't15-halo' })
  const core = s('circle', { r: f1(R), class: 'v' })
  const hi = s('circle', { r: f1(R * 0.36), cx: f1(-R * 0.3), cy: f1(-R * 0.32), class: 'orb-hi' })
  const lab = label ? s('text', { class: 'lab lab-agent', y: f1(-R * 2.4), 'text-anchor': 'middle' }, label) : null
  const g = s('g', { class: 't15-orb' }, halo, core, hi, lab)
  const shadow = s('ellipse', { class: 'sh', 'fill-opacity': 0.14, rx: f1(R * 1.3), ry: f1(R * 0.35) })
  return { g, shadow, halo, core }
}

/**
 * The art height once the tallest insight of this scene is showing. The picture is composed in that height
 * from the start, so nothing jumps when the insight grows the foot.
 */
export function stableHeight(ctx: SceneCtx, copies: string[]) {
  const foot = ctx.el.querySelector<HTMLElement>('.scene-foot')
  let probeW = -1
  let need = 0
  const H = (artH: number) => {
    if (!foot) return artH
    if (foot.clientWidth !== probeW) {
      probeW = foot.clientWidth
      const box = h('div', { class: 'scene-insight', 'aria-hidden': 'true', style: 'position:absolute;left:0;right:0;bottom:0;visibility:hidden;pointer-events:none' })
      foot.append(box)
      let max = 0
      for (const c of copies) {
        box.replaceChildren(ctx.fact(c, 'p', 'insight-text'), h('button', { class: 'insight-more', type: 'button', tabindex: '-1' }, '…'))
        max = Math.max(max, box.offsetHeight)
      }
      box.remove()
      const cs = getComputedStyle(foot)
      need = Math.max(parseFloat(cs.minHeight) || 0, max + (parseFloat(cs.paddingBottom) || 0))
    }
    return artH - Math.max(0, need - foot.offsetHeight)
  }
  return { H, reset: () => void (probeW = -1) }
}

/** Re-run a layout on resize (one per frame) and once the fonts are in (they change line breaks). */
export function watchSize(ctx: SceneCtx, fn: () => void, reset?: () => void) {
  let raf = 0
  let alive = true
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(fn)
  })
  ro.observe(ctx.art)
  document.fonts?.ready.then(() => {
    if (!alive) return
    reset?.()
    fn()
  })
  ctx.onCleanup(() => {
    alive = false
    ro.disconnect()
    cancelAnimationFrame(raf)
  })
}
