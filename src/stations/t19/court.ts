import raw from '../../content/tram-19.json'
import { h, nextId, s } from '../../core/dom'
import type { SceneDef } from '../types'
import type { Perspectives } from '../../ui/part2/types'
import { perspectiveCircle, type PondGeo } from '../../ui/part2/perspectives'
import { blob, clamp, rng, stroke, type Pt } from '../../ui/part2/ink'
import { mist, wash } from '../../ui/part2/paint'

const G = raw.scenes.gate
const V = G.perspectives as Perspectives
const f1 = (n: number) => n.toFixed(1)
const TILT = (55 * Math.PI) / 180

/** The plan's projection: a point (u, v) on the tilted court (px, v toward the viewer) → stage px, and its depth scale. */
type Proj = { cx: number; cy: number; P: number; at(u: number, v: number): [number, number, number] }
function proj(cx: number, cy: number, P: number): Proj {
  return {
    cx, cy, P,
    at(u, v) {
      const k = P / (P - v * Math.sin(TILT))
      return [cx + u * k, cy + v * Math.cos(TILT) * k, k]
    },
  }
}

/**
 * The four signs carved outside the gates (art direction §4, t19 gate.perspectives), by speaker i = data.stones[i], drawn
 * large beside the gate so each gate is known by its sign, not a number: a stone cut with a gate (Anthropic), a stone with a
 * pale fresh seam of mortar (Mozilla), a stone with one notch (VulnCheck, one CVE), a smaller fenced ring (OpenAI).
 */
function emblem(i: number): SVGElement {
  const x = 44
  const stone = (w: number, hh: number, notch = false) => {
    const l = x - w / 2, r = x + w / 2
    return notch
      ? `M${l} 0Q${l - 1} ${-hh * 0.7} ${l + w * 0.12} ${-hh}L${x - 2} ${-hh * 0.98}L${x + 1} ${-hh * 0.7}L${x + 4} ${-hh * 1.02}Q${r} ${-hh * 0.95} ${r + 1} ${-hh * 0.5}L${r} 0Z`
      : `M${l} 0Q${l - 1} ${-hh * 0.75} ${l + w * 0.2} ${-hh}Q${x + w * 0.2} ${-hh * 1.05} ${r} ${-hh * 0.62}L${r} 0Z`
  }
  const body = (d: string) => [
    s('ellipse', { class: 't19c-sh', cx: x + 3, cy: 1, rx: 17, ry: 3.5 }),
    s('path', { class: 't19c-emblem', d, filter: 'url(#ink-rough)' }),
    s('path', { class: 't19c-emblem-shade', d }),
  ]
  if (i === 0)
    return s('g', { class: 't19c-sign' }, ...body(stone(24, 34)),
      s('path', { class: 't19c-cut', d: stroke([[x - 6, -9], [x - 6, -22]], 1.8, 0.1, 0.1, 0.6) + stroke([[x + 6, -9], [x + 6, -22]], 1.8, 0.1, 0.1, 0.6) + stroke([[x - 9, -23], [x + 9, -24]], 2.2, 0.1, 0.1, 0.6) + stroke([[x - 7, -19.5], [x + 7, -19.5]], 1.3, 0.1, 0.1, 0.6) }))
  if (i === 1)
    return s('g', { class: 't19c-sign' }, ...body(stone(28, 30)),
      s('path', { class: 't19c-seam', d: stroke([[x - 13, -13], [x - 6, -16], [x + 1, -12], [x + 7, -15], [x + 13, -12]], 2.6, 0.1, 0.1, 0.5) }))
  if (i === 2) return s('g', { class: 't19c-sign' }, ...body(stone(26, 32, true)))
  let fence = ''
  for (let k = 0; k < 11; k++) {
    const a = (k / 11) * Math.PI * 2
    const px = x + Math.cos(a) * 13, py = Math.sin(a) * 5 - 2
    fence += stroke([[px, py], [px + 0.3, py - 13 - (k % 2) * 2.5]], 2.2, 0.05, 0.05, 0.6)
  }
  return s('g', { class: 't19c-sign' },
    s('ellipse', { class: 't19c-sh', cx: x, cy: -1, rx: 16, ry: 5.5 }),
    s('ellipse', { class: 't19c-mini-floor', cx: x, cy: -2, rx: 13, ry: 4.6 }),
    s('path', { class: 't19c-mini', d: fence + stroke(Array.from({ length: 13 }, (_, k) => [x + Math.cos((k / 12) * Math.PI) * 13.5, Math.sin((k / 12) * Math.PI) * 5 - 10] as Pt), 1.4, 0.05, 0.05, 0.6) }))
}

/**
 * A gate on the court's rim in the stone's box (viewBox -60 -70 120 90, foot on y = 0): a small tam quan — a tall middle
 * gate between two low side gates, each under its own curved roof with upturned eaves — wooden leaves, and its sign.
 */
function gateArt(i: number): SVGElement {
  const roof = (x0: number, x1: number, y: number, rise: number) => {
    const w = x1 - x0, m = (x0 + x1) / 2
    return `M${x0 - w * 0.14} ${y - rise * 0.55}Q${x0 + w * 0.12} ${y - rise * 0.2} ${x0 + w * 0.2} ${y - rise}L${x1 - w * 0.2} ${y - rise}Q${x1 - w * 0.12} ${y - rise * 0.2} ${x1 + w * 0.14} ${y - rise * 0.55}Q${m} ${y - rise * 0.05} ${x0 - w * 0.14} ${y - rise * 0.55}Z`
  }
  const post = (x: number, y0: number, w: number) => stroke([[x, 1], [x, y0]], w, 0.02, 0.02, 0.9)
  const posts = post(-13, -38, 3.6) + post(13, -38, 3.6) + post(-30, -26, 2.8) + post(30, -26, 2.8)
  const beams = stroke([[-15, -36], [15, -36]], 2.4, 0.05, 0.05, 0.6) + stroke([[-32, -24.5], [-12, -24.5]], 1.8, 0.05, 0.05, 0.6) + stroke([[12, -24.5], [32, -24.5]], 1.8, 0.05, 0.05, 0.6)
  const roofs = roof(-17, 17, -38, 12) + roof(-34, -12, -26, 8) + roof(12, 34, -26, 8)
  const tiles = [-11, -6, -1, 4, 9].map((x) => stroke([[x, -49], [x * 1.3, -41]], 0.9, 0.2, 0.2, 0.3)).join('')
  const door = (side: 'l' | 'r') => {
    const x = side === 'l' ? -11.5 : 0
    return s('g', { class: `t19c-door t19c-door-${side}` },
      s('rect', { class: 't19c-leaf', x, y: -34, width: 11.5, height: 34 }),
      s('path', { class: 't19c-leaf-ink', d: stroke([[x + 3.8, -33], [x + 3.8, -1]], 0.8, 0.1, 0.1, 0.5) + stroke([[x + 7.7, -33], [x + 7.7, -1]], 0.8, 0.1, 0.1, 0.5) + stroke([[x + 1, -22], [x + 10.5, -22]], 1.1, 0.1, 0.1, 0.5) }))
  }
  return s('g', { class: 't19c-gate' },
    s('ellipse', { class: 't19c-sh', cx: -6, cy: 2, rx: 44, ry: 6.5 }),
    s('path', { class: 't19c-side', d: `M-28.6 -23H-14.4V0H-28.6ZM14.4 -23H28.6V0H14.4Z` }),
    door('l'), door('r'),
    s('path', { class: 't19c-post', d: posts + beams, filter: 'url(#ink-rough)' }),
    s('path', { class: 't19c-roof', d: roofs, filter: 'url(#ink-rough)' }),
    s('path', { class: 't19c-tiles', d: tiles }),
    emblem(i))
}

/** A lantern bearer: an ink figure with a lantern hung on a short pole, its warm pool on the gravel, standing on (0, 0). */
function bearer(hh: number): SVGSVGElement {
  const u = hh / 20
  const d = stroke([[-3.4 * u, -16 * u], [0, -19.4 * u], [3.4 * u, -16 * u]], 2.4 * u, 0.2, 0.2, 0.3) + // hat
    stroke([[0, -15.5 * u], [0.8 * u, -8 * u], [-0.3 * u, 0]], 4.6 * u, 0.05, 0.25, 0.45) + // body
    stroke([[-0.4 * u, -7 * u], [-1.6 * u, 0]], 1.8 * u, 0.1, 0.1, 0.7) + // the other leg
    stroke([[0.5 * u, -12 * u], [4 * u, -13 * u], [6.5 * u, -17 * u]], 1.4 * u, 0.1, 0.2, 0.3) + // arm and pole
    stroke([[6.5 * u, -17 * u], [9 * u, -18.5 * u]], 1 * u, 0.1, 0.1, 0.5)
  return s('svg', { class: 't19c-bearer-svg', viewBox: `${f1(-14 * u)} ${f1(-22 * u)} ${f1(36 * u)} ${f1(28 * u)}`, 'aria-hidden': 'true' },
    s('ellipse', { class: 't19c-pool', cx: f1(4 * u), cy: f1(0.5 * u), rx: f1(12 * u), ry: f1(12 * u * Math.cos(TILT)) }),
    s('ellipse', { class: 't19c-sh', cx: f1(-2 * u), cy: 0, rx: f1(5 * u), ry: f1(1.4 * u) }),
    s('circle', { class: 't19c-glow', cx: f1(9 * u), cy: f1(-15 * u), r: f1(6 * u) }),
    s('path', { class: 't19c-man', d, filter: 'url(#ink-rough)' }),
    s('path', { class: 't19c-man-rim', d: stroke([[1.9 * u, -15 * u], [2.4 * u, -8 * u]], 0.6 * u, 0.2, 0.2, 0.3) }),
    s('ellipse', { class: 't19c-lamp', cx: f1(9 * u), cy: f1(-15.5 * u), rx: f1(1.5 * u), ry: f1(2 * u) }))
}

/** a sole print on the plan at (x, y), heading ang (toward the centre), sz long: heel and ball */
function foot(x: number, y: number, ang: number, sz: number): string {
  const ca = Math.cos(ang), sa = Math.sin(ang)
  const at = (fx: number, fy: number): Pt => [x + fx * ca - fy * sa, y + fx * sa + fy * ca]
  const ell = (fx: number, rx: number, ry: number) => {
    const pts = Array.from({ length: 10 }, (_, i) => {
      const t = (i / 10) * Math.PI * 2
      return at(fx + Math.cos(t) * rx, Math.sin(t) * ry)
    })
    return `M${pts.map(([a, b]) => `${f1(a)} ${f1(b)}`).join('L')}Z`
  }
  return ell(-sz * 0.28, sz * 0.2, sz * 0.15) + ell(sz * 0.18, sz * 0.3, sz * 0.19)
}

/** a cumulus bank from x0 to x1: two staggered rows of heads of every size along y, a flat belly hgt below */
function bank(x0: number, x1: number, y: number, hgt: number, seed: number): string {
  const r = rng(seed)
  let out = ''
  for (const [dy, k] of [[-hgt * 0.22, 0.8], [0, 1]] as const) {
    let x = x0 - r() * hgt
    let yy = y + dy
    let d = `M${f1(x)} ${f1(y + hgt)}L${f1(x)} ${f1(yy)}`
    while (x < x1) {
      const rr = hgt * k * (0.3 + r() * 0.8)
      const nx = x + rr * (1.2 + r() * 0.7)
      yy = y + dy + (r() - 0.5) * hgt * 0.45
      d += `A${f1(rr)} ${f1(rr * (0.6 + r() * 0.3))} 0 0 1 ${f1(nx)} ${f1(yy)}`
      x = nx
    }
    out += d + `L${f1(x)} ${f1(y + hgt)}Z`
  }
  return out
}

/**
 * Scene 3 · who says what (HIGH, an axonometric plan, 2.5D). The fenced summit seen from above at 55°, like a temple plan
 * floating on a deep sea of cloud: a raked gravel court ringed by low bamboo, a small tam quan gate at each quarter, a
 * lantern bearer and a large carved sign outside each (a stone cut with a gate · a stone with fresh mortar · a stone with one
 * notch · a smaller fenced ring). Touch a gate: it opens, its bearer walks in, leaving left-right footprints, and stops short
 * of the centre; who it is is written on the gravel in that gate's quarter, and what they say hangs from the gate on a paper
 * strip. All four: a raked cross joins their paths in the centre and the cloud round the summit stills into a mirror.
 */
export function courtScene(): SceneDef {
  let api: { geo: PondGeo | null; P: Proj | null; bearers: HTMLElement[]; words: HTMLElement[]; heard: Set<number> } = { geo: null, P: null, bearers: [], words: [], heard: new Set() }
  const order: number[] = [] // order[k] = which speaker stands at gate k (the component's stable shuffle)
  return perspectiveCircle(V, {
    label: G.debateTitle,
    prompt: G.courtPrompt,
    // gates at the four quarters, clockwise from the far one; nearer is bigger
    place: (k, n, g) => {
      const R = rim(g)
      const a = -Math.PI / 2 + (k * 2 * Math.PI) / n
      const P = proj(g.cx, g.cy, persp(g))
      const [x, y, sc] = P.at(Math.cos(a) * R.fence, Math.sin(a) * R.fence)
      return { x, y: y + 2, s: (R.tight ? 1.05 : 1.25) * sc, z: Math.round(y) + 10 }
    },
    stone: (k, _g, i) => {
      order[k] = i
      return gateArt(i)
    },
    onHear: (k) => walk(k),
    stage: (host, cap) => {
      const root = host.closest('.p2c')
      root?.classList.add('t19c')
      host.setAttribute('role', 'img')
      host.setAttribute('aria-label', G.courtArt)
      const uid = nextId('t19c')
      const sea = s('svg', { class: 't19c-sea', 'aria-hidden': 'true' })
      const cliff = s('svg', { class: 't19c-cliff', 'aria-hidden': 'true' })
      const planSvg = s('svg', { class: 't19c-plan-svg', 'aria-hidden': 'true' })
      const plan = h('div', { class: 't19c-plan' }, planSvg)
      const tilt = h('div', { class: 't19c-tilt' }, plan)
      const back = s('svg', { class: 't19c-fence t19c-fence-back', 'aria-hidden': 'true' })
      const men = h('div', { class: 't19c-men', 'aria-hidden': 'true' })
      const front = s('svg', { class: 't19c-fence t19c-fence-front', 'aria-hidden': 'true' })
      host.append(sea, cliff, tilt, back, men, front)
      api.bearers = []
      api.words = []

      cap.onLayout((g) => {
        api.geo = g
        const P = proj(g.cx, g.cy, persp(g))
        api.P = P
        const R = rim(g)
        const r = rng(g.seed)
        const W = g.w, H = g.h
        for (const el of [sea, cliff, back, front]) el.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
        Object.assign(tilt.style, { perspective: `${f1(P.P)}px`, perspectiveOrigin: `${f1(P.cx)}px ${f1(P.cy)}px` })
        const PS = R.rock * 2.6
        Object.assign(plan.style, { left: `${f1(P.cx - PS / 2)}px`, top: `${f1(P.cy - PS / 2)}px`, width: `${f1(PS)}px`, height: `${f1(PS)}px` })
        planSvg.setAttribute('viewBox', `${f1(-PS / 2)} ${f1(-PS / 2)} ${f1(PS)} ${f1(PS)}`)
        const ring = (rr: number, n = 72): Pt[] => Array.from({ length: n + 1 }, (_, i) => {
          const a = (i / n) * Math.PI * 2
          const [x, y] = P.at(Math.cos(a) * rr, Math.sin(a) * rr)
          return [x, y]
        })
        const rimPts = ring(R.rock, 96)
        const near = rimPts.filter(([, y]) => y > P.cy - R.rock * 0.02).sort((a, b) => a[0] - b[0])
        const xl = near[0][0], xr = near[near.length - 1][0]
        const drop = R.rock * 0.62
        const yRim = Math.max(...near.map(([, y]) => y))
        const ySea = yRim + drop * 0.62 // the cloud surface the summit stands in

        // ── the sea of cloud: banks of billows in layers, lit on their heads; behind the summit and round its foot
        const defs = s('defs', null,
          s('linearGradient', { id: `${uid}-cloud`, x1: 0, y1: 0, x2: 0, y2: 1 },
            s('stop', { offset: 0, style: 'stop-color:var(--t19c-cloud-hi)' }),
            s('stop', { offset: 0.55, style: 'stop-color:var(--t19c-cloud)' }),
            s('stop', { offset: 1, style: 'stop-color:var(--t19c-cloud-lo);stop-opacity:.9' })),
          s('radialGradient', { id: `${uid}-calm`, cx: 0.5, cy: 0.45, r: 0.55 },
            s('stop', { offset: 0, style: 'stop-color:var(--moon);stop-opacity:.42' }),
            s('stop', { offset: 0.6, style: 'stop-color:var(--t19c-cloud-hi);stop-opacity:.6' }),
            s('stop', { offset: 1, style: 'stop-color:var(--t19c-cloud-hi);stop-opacity:0' })),
          s('filter', { id: `${uid}-soft`, x: '-5%', y: '-30%', width: '110%', height: '160%' }, s('feGaussianBlur', { stdDeviation: clamp(R.rock * 0.012, 1.5, 4) })),
          s('clipPath', { id: `${uid}-mclip` }, s('ellipse', { cx: f1(P.cx), cy: f1(ySea + drop * 0.25), rx: f1(R.rock * 1.9), ry: f1(drop * 0.75) })))
        const cloud = `url(#${uid}-cloud)`
        host.style.setProperty('--t19c-soft', `url(#${uid}-soft)`)
        // the fenced ring mirrored in the stilled cloud (shown once everyone has been heard)
        const mirrorG = s('g', { class: 't19c-mirror-img', transform: `translate(0 ${f1(ySea * 2)}) scale(1 -1)`, 'clip-path': `url(#${uid}-mclip)` })
        sea.replaceChildren(defs,
          mist(W * 0.5, P.cy - R.rock * 0.9, W * 0.7, R.rock * 0.35),
          s('path', { class: 't19c-bank t19c-bank-far', d: bank(-W * 0.8, W * 2.2, P.cy - R.rock * 0.32, R.rock * 0.16, g.seed + 1), fill: cloud }),
          s('path', { class: 't19c-bank t19c-bank-back', d: bank(-W * 0.8, W * 2.2, P.cy + R.rock * 0.08, R.rock * 0.22, g.seed + 2), fill: cloud }),
          s('g', { class: 't19c-mirror' },
            s('ellipse', { cx: f1(P.cx), cy: f1(ySea + drop * 0.25), rx: f1(R.rock * 2), ry: f1(drop * 0.8), fill: `url(#${uid}-calm)` }),
            mirrorG))

        // ── the summit's cliff under the near rim: three tones, a brushed terminator, deep clefts, its foot in the cloud
        const cr = rng(g.seed + 77)
        const bottom: Pt[] = []
        for (let i = 0; i <= 12; i++) {
          const t = i / 12
          const x = xr - (xr - xl) * t
          const inset = (xr - xl) * 0.1 * (1 - Math.sin(t * Math.PI))
          bottom.push([x + (t < 0.5 ? -inset : inset) * -1 + (cr() - 0.5) * R.rock * 0.06, yRim + drop * (1.05 + cr() * 0.4) * (0.6 + 0.4 * Math.sin(t * Math.PI))])
        }
        const shape = `M${near.map(([x, y]) => `${f1(x)} ${f1(y - 1)}`).join('L')}L${bottom.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}Z`
        // the moon from the upper right: the right of the cliff lit, the left in shade, the line between them wanders
        const term: Pt[] = []
        for (let i = 0; i <= 10; i++) {
          const t = i / 10
          term.push([P.cx + R.rock * (0.18 + 0.07 * Math.sin(t * 6 + 1) + (cr() - 0.5) * 0.05) - t * R.rock * 0.45, yRim - R.rock * 0.1 + t * drop * 1.5])
        }
        const litD = `M${term.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}L${f1(xr + 40)} ${f1(yRim + drop * 1.6)}L${f1(xr + 40)} ${f1(yRim - R.rock * 0.2)}Z`
        let clefts = '', ledges = ''
        for (let i = 0; i < 9; i++) {
          const [x, y] = near[Math.floor((0.08 + 0.84 * (i / 8) + (cr() - 0.5) * 0.06) * (near.length - 1))]
          const len = drop * (0.35 + cr() * 0.5)
          clefts += stroke([[x, y + 2], [x + (cr() - 0.5) * 10, y + len * 0.5], [x + (cr() - 0.5) * 16, y + len]], R.rock * (0.02 + cr() * 0.03), 0.04, 0.75, 0.12)
        }
        for (let i = 0; i < 6; i++) {
          const x = xl + (xr - xl) * (0.15 + cr() * 0.7), y = yRim + drop * (0.2 + cr() * 0.5)
          ledges += stroke([[x, y], [x + R.rock * (0.08 + cr() * 0.12), y + 2]], 1.6 + cr() * 1.4, 0.3, 0.3, 0.2)
        }
        const clip = `${uid}-cliff`
        cliff.replaceChildren(
          s('defs', null, s('clipPath', { id: clip }, s('path', { d: shape }))),
          s('g', { 'clip-path': `url(#${clip})` },
            s('path', { class: 't19c-cliff-lo', d: shape, filter: 'url(#ink-wash)' }),
            s('path', { class: 't19c-cliff-mid', d: litD, filter: 'url(#ink-wash)' }),
            s('path', { class: 't19c-cleft', d: clefts }),
            s('path', { class: 't19c-ledge', d: ledges })),
          s('path', { class: 't19c-rimlit', d: stroke(near.filter(([x]) => x > P.cx - R.rock * 0.2), Math.max(2, R.rock * 0.012), 0.2, 0.15, 0.3) }),
          // the cloud sea swallows its foot: a bank across the cliff, a lower one in front
          s('path', { class: 't19c-bank t19c-bank-mid', d: bank(-W * 0.8, W * 2.2, ySea - R.rock * 0.06, R.rock * 0.26, g.seed + 3), fill: cloud }),
          s('path', { class: 't19c-bank t19c-bank-front', d: bank(-W * 0.8, W * 2.2, ySea + R.rock * 0.22, R.rock * 0.32, g.seed + 4), fill: cloud }),
          mist(P.cx, ySea + R.rock * 0.5, W * 0.7, R.rock * 0.25))

        // ── the court in top view: rock rim with moss, raked gravel rings, the four footpaths (revealed as they walk),
        //    the raked cross that joins them once all four are in
        let rake = ''
        for (let i = 1; i <= 7; i++) {
          const rr = R.fence * (0.1 + i * 0.105)
          let a = r() * 0.6
          while (a < Math.PI * 2) {
            const len = 0.7 + r() * 1.2
            const pts: Pt[] = Array.from({ length: 12 }, (_, j) => { const t = a + (len * j) / 11; return [Math.cos(t) * rr, Math.sin(t) * rr] })
            rake += stroke(pts, 1.2 + r() * 0.5, 0.2, 0.2, 0.2)
            a += len + 0.08 + r() * 0.2
          }
        }
        const stop = R.fence * STOP
        const fs = clamp(R.rock * 0.05, 7, 13) // a print's length
        const paths = [0, 1, 2, 3].map((k) => {
          const a = -Math.PI / 2 + (k * Math.PI) / 2
          const ca = Math.cos(a), sa = Math.sin(a)
          const ages = ['', '', '']
          const n = 10
          for (let j = 0; j < n; j++) {
            const t = j / (n - 1)
            const rr = R.fence * 0.92 - (R.fence * 0.92 - stop - fs) * t
            const side = j % 2 ? 1 : -1
            const x = ca * rr - sa * side * fs * 0.32, y = sa * rr + ca * side * fs * 0.32
            ages[Math.min(2, Math.floor(t * 3))] += foot(x, y, a + Math.PI, fs)
          }
          return { k, ages, mask: `${uid}-m${k}`, a }
        })
        const cross = [0, 1].map((q) => {
          const a = (q * Math.PI) / 2
          const dx = Math.cos(a) * stop, dy = Math.sin(a) * stop
          const ox = -Math.sin(a) * 3, oy = Math.cos(a) * 3
          return `M${f1(-dx + ox)} ${f1(-dy + oy)}L${f1(dx + ox)} ${f1(dy + oy)}M${f1(-dx - ox)} ${f1(-dy - oy)}L${f1(dx - ox)} ${f1(dy - oy)}`
        }).join('')
        planSvg.replaceChildren(
          s('defs', null, ...paths.map((p) => s('mask', { id: p.mask, maskUnits: 'userSpaceOnUse', x: -PS, y: -PS, width: PS * 2, height: PS * 2 },
            s('path', { class: `t19c-reveal t19c-reveal-${p.k}`, d: `M${f1(Math.cos(p.a) * R.fence)} ${f1(Math.sin(p.a) * R.fence)}L${f1(Math.cos(p.a) * stop * 0.9)} ${f1(Math.sin(p.a) * stop * 0.9)}`, pathLength: 1 })))),
          s('path', { class: 't19c-top', d: blob(0, 0, R.rock, R.rock, g.seed + 3, 0.06, 28), filter: 'url(#ink-wash)' }),
          wash(blob(R.rock * 0.62, -R.rock * 0.58, R.rock * 0.22, R.rock * 0.1, g.seed + 5, 0.3) + blob(-R.rock * 0.7, R.rock * 0.2, R.rock * 0.14, R.rock * 0.07, g.seed + 4, 0.3), 0.45, 'p2p-wash t19c-moss'),
          s('circle', { class: 't19c-gravel', r: f1(R.fence * 1.02) }),
          s('path', { class: 't19c-rake', d: rake }),
          s('path', { class: 't19c-cross', d: cross, pathLength: 1 }),
          s('circle', { class: 't19c-heart', r: f1(R.fence * 0.05) }),
          ...paths.flatMap((p) => p.ages.map((d, j) => s('path', { class: `t19c-prints t19c-prints-${j}`, d, mask: `url(#${p.mask})` }))))

        // ── the fence: low culms of bamboo on the ring (screen space, so they stand upright), the far half behind, the near
        //    in front; the gates stand in the four gaps
        let farD = '', nearD = '', farN = '', nearN = '', rimD = ''
        const N = R.tight ? 96 : 120
        const fh = R.fence * 0.16
        for (let i = 0; i < N; i++) {
          const a = ((i + (r() - 0.5) * 0.4) / N) * Math.PI * 2
          const q = (((a + Math.PI / 2) / (Math.PI / 2)) % 1 + 1) % 1
          if (q < 0.11 || q > 0.89) continue // the four gates
          const [x, y, sc] = P.at(Math.cos(a) * R.fence, Math.sin(a) * R.fence)
          const hh = fh * sc * (0.85 + r() * 0.3)
          const w = Math.max(1.6, 3.4 * sc * (0.8 + r() * 0.4))
          const lean = (r() - 0.5) * hh * 0.08
          const d = stroke([[x, y + 1], [x + lean, y - hh]], w, 0.02, 0.05, 0.7)
          const node = stroke([[x - w * 0.6 + lean * 0.5, y - hh * 0.55], [x + w * 0.6 + lean * 0.5, y - hh * 0.55]], Math.max(0.8, w * 0.3), 0.1, 0.1, 0.4)
          if (Math.sin(a) < 0) (farD += d), (farN += node)
          else {
            nearD += d
            nearN += node
            if (Math.cos(a) > -0.2) rimD += stroke([[x + w * 0.3, y - 1], [x + w * 0.3 + lean, y - hh * 0.95]], Math.max(0.6, w * 0.25), 0.1, 0.1, 0.4)
          }
        }
        const railD = (half: 'far' | 'near', k: number) => {
          let d = ''
          for (let q = 0; q < 4; q++) {
            const a0 = -Math.PI / 2 + q * (Math.PI / 2) + 0.11 * (Math.PI / 2), a1 = a0 + 0.78 * (Math.PI / 2)
            const pts: Pt[] = []
            for (let j = 0; j <= 16; j++) {
              const a = a0 + ((a1 - a0) * j) / 16
              if ((Math.sin(a) < 0) !== (half === 'far')) continue
              const [x, y, sc] = P.at(Math.cos(a) * R.fence, Math.sin(a) * R.fence)
              pts.push([x, y - fh * sc * k])
            }
            if (pts.length > 1) d += stroke(pts, 1.5, 0.05, 0.05, 0.6)
          }
          return d
        }
        back.replaceChildren(s('path', { class: 't19c-culm t19c-culm-far', d: farD, filter: 'url(#ink-rough)' }), s('path', { class: 't19c-node', d: farN }), s('path', { class: 't19c-rail', d: railD('far', 0.35) + railD('far', 0.75) }))
        front.replaceChildren(s('path', { class: 't19c-culm', d: nearD, filter: 'url(#ink-rough)' }), s('path', { class: 't19c-node', d: nearN }), s('path', { class: 't19c-culm-rim', d: rimD }), s('path', { class: 't19c-rail', d: railD('near', 0.35) + railD('near', 0.75) }))
        // the reflection: the court's rim and its fence, flipped in the still cloud
        mirrorG.replaceChildren(
          s('path', { class: 't19c-mirror-rim', d: `M${rimPts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}Z` }),
          s('path', { class: 't19c-mirror-fence', d: farD + nearD }))

        // ── the bearers outside their gates, and the speakers' names, written on the gravel in each gate's quarter
        if (!api.bearers.length) {
          for (let k = 0; k < 4; k++) {
            const b = h('div', { class: 't19c-bearer' })
            men.append(b)
            api.bearers.push(b)
            const w = h('div', { class: 't19c-word' })
            plan.append(w)
            api.words.push(w)
          }
        }
        for (let k = 0; k < 4; k++) {
          const bh = clamp(R.rock * 0.2, 26, 64)
          api.bearers[k].replaceChildren(bearer(bh))
          api.bearers[k].style.setProperty('--s', `${f1(clamp(R.rock * 0.25, 34, 92))}px`)
          place(k)
          // the name lies on the gravel at its bearer's feet, on the side of the court that faces its gate, never under a figure
          // (bodies rise up the screen from their feet) nor behind the near gate
          const f = R.fence, st = f * STOP
          const [wu, wv] = [[-0.3 * f, -st + 0.02 * f], [st, 0.2 * f], [0.44 * f, st - 0.08 * f], [-st, 0.2 * f]][k]
          Object.assign(api.words[k].style, { left: `${f1(PS / 2 + wu)}px`, top: `${f1(PS / 2 + wv)}px`, fontSize: `${f1(clamp(R.rock * 0.095, 15, 24))}px` })
        }
      })

      // a breath of tilt with the pointer (high only): the whole stage leans, gates and court together
      const stageEl = host.parentElement as HTMLElement
      let box: DOMRect | null = null
      const tiltOn = (e: PointerEvent) => {
        if (e.pointerType !== 'mouse' || !stageEl) return
        const b = (box ??= stageEl.getBoundingClientRect())
        const nx = ((e.clientX - b.left) / b.width) * 2 - 1, ny = ((e.clientY - b.top) / b.height) * 2 - 1
        stageEl.style.transform = `perspective(1400px) rotateY(${f1(clamp(nx, -1, 1) * 4)}deg) rotateX(${f1(clamp(-ny, -1, 1) * 2.5)}deg)`
      }
      const tiltOff = () => {
        box = null
        stageEl.style.transform = ''
      }
      const deep = document.documentElement.dataset.quality !== 'low' && !matchMedia('(prefers-reduced-motion: reduce)').matches
      if (deep) {
        stageEl.addEventListener('pointermove', tiltOn)
        stageEl.addEventListener('pointerleave', tiltOff)
      }
      return () => {
        stageEl.removeEventListener('pointermove', tiltOn)
        stageEl.removeEventListener('pointerleave', tiltOff)
        stageEl.style.transform = ''
        api = { geo: null, P: null, bearers: [], words: [], heard: new Set() }
      }
    },
  })

  /** bearer k outside its gate, or (heard) arrived on its gate's axis, a stop short of the centre */
  function place(k: number) {
    const { geo, P } = api
    if (!geo || !P) return
    const R = rim(geo)
    const a = -Math.PI / 2 + (k * Math.PI) / 2
    const inside = api.heard.has(k)
    const rr = inside ? R.fence * STOP : R.fence * 1.22
    const off = inside ? 0 : 0.3 // outside, a little off the gate's axis, so it does not hide the gate
    const [x, y, sc] = P.at(Math.cos(a + off) * rr, Math.sin(a + off) * rr)
    const b = api.bearers[k]
    b.style.transform = `translate(${f1(x)}px, ${f1(y)}px) scale(${f1(sc)})`
    b.style.zIndex = String(Math.round(y))
  }
  function walk(k: number) {
    if (!api.bearers[k] || api.heard.has(k)) return
    api.heard.add(k)
    api.bearers[k].classList.add('in')
    place(k)
    const who = V.stones[order[k]]?.who ?? ''
    api.words[k].textContent = who.split(' · ')[0]
  }
}

/** the summit's rock and the fence ring on it; a narrow stage (phone) gives the court nine-tenths of its width */
const rim = (g: PondGeo) => {
  const tight = g.w < g.h * 1.25
  const rock = Math.min(g.w * (tight ? 0.45 : 0.36), g.h * (tight ? 0.52 : 0.5))
  return { rock, fence: rock * 0.8, tight }
}
const persp = (g: PondGeo) => Math.max(g.w, g.h) * 1.6
/** where a bearer stops on its gate's axis (share of the fence radius): short of the centre, where the raked cross begins */
const STOP = 0.55
