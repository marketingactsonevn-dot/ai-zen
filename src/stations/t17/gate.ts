import { fill, h, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import { L, type Fact } from '../../core/content'
import { company, logoStone } from '../../ui/logo'
import type { SceneCtx } from '../types'
import { C } from './data'
import { arc, brush, clamp, defs, ell, rng, sand, vf, type Pt } from './ink'

const G = C.scenes.gate
const VF = L.kinds.verify
type Kind = 'closed' | 'open'
interface Piece {
  kind: Kind
  id: string
  model: string
  fact: Fact
  btn: HTMLButtonElement
  /** which group on the sand (open stones), its place in that group, and its size there */
  grp: number
  slot: number
  k: number
  x: number
  y: number
  home: boolean
  busy: boolean
}

// closed stones inside the fence (fractions of rx, ry): two rows, staggered, clear of the gate
const IN_WIDE: Pt[] = [[-0.52, -0.3], [0.04, -0.52], [-0.18, 0.2], [0.42, -0.08]]
const IN_TALL: Pt[] = [[-0.62, 0.12], [-0.24, -0.52], [0.58, 0.1], [0.3, -0.5]]
const IN_ROW: Pt[] = [[-0.78, 0.02], [-0.36, -0.46], [0.36, -0.46], [0.78, 0.02]]
// open stones on the sand: a scalene three and a pair (offsets in stone sizes, with each stone's own size)
const THREE: [number, number, number][] = [[0, 0, 1], [1.55, -0.9, 0.8], [-0.4, -1.8, 0.66]]
const PAIR: [number, number, number][] = [[0, 0, 0.9], [1.65, 0.5, 0.72]]
// Gemma 4, Wan 3.0, Flux 2 stand together; the two 3D models (TRELLIS.2, Pixal3D) make the pair
// (a name typeset in a stone, like Black Forest Labs, takes the big front place so it stays legible)
const OPEN_GROUP: Record<string, [number, number]> = { 'Flux 2': [0, 0], 'Gemma 4': [0, 1], 'Wan 3.0': [0, 2], 'TRELLIS.2': [1, 0], Pixal3D: [1, 1] }

/** Scene 2 — closed models live behind the fence (you talk through the gate); open ones you can carry home. */
export function gateScene(ctx: SceneCtx) {
  const sandL = s('svg', { class: 't17-sandsvg', 'aria-hidden': 'true' })
  const back = s('svg', { class: 't17g-svg', 'aria-hidden': 'true' })
  const front = s('svg', { class: 't17g-svg t17g-front', 'aria-hidden': 'true' })
  const mist = h('div', { class: 't17-mist', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'))
  const say = h('div', { class: 't17g-say', 'aria-live': 'polite' })
  const lab = (t: string, cls = '') => h('p', { class: `t17g-lab ${cls}`, 'aria-hidden': 'true' }, t)
  const homeLab = lab(G.home, 'home')
  const fenceLab = lab(G.fence, 'fence')
  const gateLab = lab(G.gateLabel, 'note')
  const takeLab = lab(G.homeLabel, 'note')
  const wLab = lab(G.weightsLabel, 'weights')
  const legend = h('p', { class: 't17-legend on t17g-legend', 'aria-hidden': 'true' }, h('span', { class: 't17-vf' }), VF)
  const mk = (kind: Kind, p: { id: string; model: string; fact?: string }): Piece => {
    const name = company(p.id)?.name ?? p.id
    const tpl = kind === 'closed' ? G.closedFact : G.openFact
    // a model the brief marks "verify" keeps its mark here too
    const verify = company(p.id)?.models.find((m) => m.name === p.model)?.verify
    const fact = { ...tpl, text: p.fact ?? fill(tpl.text, { model: p.model, company: name }), verify }
    const btn = h('button', { class: `t17g-stone ls-host ${kind}${kind === 'closed' ? ' up' : ''}`, type: 'button', 'aria-label': fill(kind === 'closed' ? G.tryClosed : G.take, { model: p.model }) + (verify ? ` (${VF})` : '') },
      logoStone(p.id, { size: 46, decorative: true }), h('span', { class: 't17g-name', 'aria-hidden': 'true' }, p.model, verify ? vf(VF) : null))
    const [grp, slot] = OPEN_GROUP[p.model] ?? [0, 0]
    return { kind, id: p.id, model: p.model, fact, btn, grp, slot, k: 1, x: 0, y: 0, home: false, busy: false }
  }
  const pieces = [...G.closed.map((p) => mk('closed', p)), ...G.open.map((p) => mk('open', p))]
  const inGroup = h('div', { class: 't17g-group', role: 'group', 'aria-label': G.closedGroup }, ...pieces.filter((p) => p.kind === 'closed').map((p) => p.btn))
  const outGroup = h('div', { class: 't17g-group', role: 'group', 'aria-label': G.openGroup }, ...pieces.filter((p) => p.kind === 'open').map((p) => p.btn))
  const root = h('div', { class: 't17 t17g', role: 'group', 'aria-label': G.region }, sandL, back, mist, inGroup, outGroup, front, homeLab, fenceLab, gateLab, takeLab, wLab, say, legend)
  ctx.art.append(root)
  ctx.prompt(G.prompt)

  const tried = new Set<Kind>()
  let shown = false
  let geo = { W: 0, H: 0, wide: true, cx: 0, cy: 0, rx: 0, ry: 0, gate: [0, 0] as Pt, hx: 0, hy: 0, hs: 0, sz: 46 }
  let glow: SVGElement | null = null
  let doorLit: SVGElement | null = null
  let lantern: SVGCircleElement | null = null
  let walk: SVGPathElement | null = null
  let belowWas: boolean | null = null
  const was = new Map<Piece, Pt>()
  const NAME = 18 // a stone's name line

  function layout() {
    const W = root.clientWidth
    const H = root.clientHeight
    if (!W || !H) return
    const wide = W / H > 1.1
    root.classList.toggle('wide', wide)
    const top = wide ? H * 0.2 : Math.max(H * 0.15, 92)
    const sz = Math.round(wide ? clamp(Math.min(W / 19, H / 6.4), 30, 58) : clamp(Math.min(W / 7.6, H / 13), 30, 48))
    const rx = wide ? Math.min(W * 0.23, H * 0.78) : W * 0.44
    const tight = !wide && H < 600
    const ry = wide ? rx * 0.42 : tight ? clamp(rx * 0.4, sz * 1.25, H * 0.13) : clamp(rx * 0.6, sz * 1.5, H * 0.16)
    const cx = wide ? W * 0.28 : W / 2
    const cy = wide ? top + (H - top) * 0.42 : top + ry + sz * 0.7
    // the gate faces you: a little right of the front on a wide screen, straight ahead on a phone
    const ga = wide ? 68 : 90
    const onRim = (a: number, f = 1): Pt => [cx + rx * f * Math.cos((a * Math.PI) / 180), cy + ry * f * Math.sin((a * Math.PI) / 180)]
    const gate = onRim(ga)
    const hs = wide ? clamp(Math.min(W * 0.12, H * 0.34), 60, 150) : clamp(Math.min(W * 0.28, H * 0.15), 56, 100)
    const k = 0.36
    const sgap = wide ? 8 : 7
    // the house and its sand rings stay inside the garden's right edge
    const hx = wide ? Math.min(W * 0.87, W - hs * 0.95 - 2 * sgap - 8) : Math.min(W * 0.72, W - hs * 0.62)
    const hy = wide ? top + (H - top) * 0.62 : H - sz * 0.9 - 26
    // the stepping-stone path from your door (on the house's left) to the gate
    const door: Pt = [hx - hs * 0.62, hy + hs * 0.1]
    const mid: Pt = wide ? [(gate[0] + door[0]) / 2 + hs * 0.1, Math.max(gate[1], door[1]) + hs * 0.26] : [(gate[0] + door[0]) / 2 + sz * 0.5, (gate[1] + door[1]) / 2]
    const pathPts: Pt[] = [door, mid, [gate[0] + (wide ? sz * 0.2 : 0), gate[1] + (wide ? sz * 0.18 : sz * 0.3)]]
    geo = { W, H, wide, cx, cy, rx, ry, gate, hx, hy, hs, sz }

    back.replaceChildren()
    front.replaceChildren()
    sandL.replaceChildren()
    for (const v of [back, front, sandL]) v.setAttribute('viewBox', `0 0 ${W} ${H}`)
    const id = defs(back)
    back.append(s('ellipse', { cx: W / 2, cy: H * 0.6, rx: W * 0.62, ry: H * 0.55, fill: `url(#${id.warm})` }))
    sandL.append(sand(W, H, [{ x: cx, y: cy, r0: rx * 1.12, n: 3 }, { x: hx, y: hy + hs * 0.18, r0: hs * 0.95, n: 2 }], { top: top * 0.35, gap: sgap, k, fade: H * 0.12 }))
    // the walled garden: moss inside, a bamboo fence around
    const fr = rng(41)
    back.append(
      s('path', { class: 'sh', 'fill-opacity': 0.1, d: ell(cx + rx * 0.03, cy + ry * 0.1, rx * 1.04, ry * 1.02), filter: 'url(#ink-wash)' }),
      s('path', { class: 'floor', d: ell(cx, cy, rx * 0.99, ry * 0.97) }),
      ...[0.82, 0.62, 0.42].map((f) => s('path', { class: 'rk', d: ell(cx + rx * 0.04, cy + ry * 0.04, rx * f, ry * f) })),
      s('path', { class: 'm', 'fill-opacity': 0.16, d: ell(cx - rx * 0.55, cy - ry * 0.45, rx * 0.4, ry * 0.32), filter: 'url(#ink-wash)' }),
      s('path', { class: 'm', 'fill-opacity': 0.12, d: ell(cx + rx * 0.5, cy + ry * 0.5, rx * 0.3, ry * 0.25), filter: 'url(#ink-wash)' }),
      s('g', { class: 'm', filter: 'url(#ink-rough)' }, ...Array.from({ length: 12 }, () => {
        const t = Math.PI * (1.05 + fr() * 0.5)
        return s('path', { d: ell(cx + rx * 0.9 * Math.cos(t), cy + ry * 0.86 * Math.sin(t), 1.5 + fr() * 2.5, 1 + fr() * 1.5), 'fill-opacity': (0.3 + fr() * 0.4).toFixed(2) })
      })))

    // ── the bamboo fence: tapered posts with nodes, double rails lashed at each post, seated in a soft shadow
    const ph = sz * 0.62
    const gw = wide ? 9 : 10 // half-width of the gate opening, degrees
    const atGate = (a: number) => Math.abs(((((a - ga) % 360) + 540) % 360) - 180) > 180 - gw - 1
    const fence = (a0: number, a1: number, far: boolean) => {
      const g = s('g', { class: 't17g-fence', filter: 'url(#ink-rough)' })
      const op = far ? 0.42 : 0.82
      const sc = far ? 0.86 : 1
      g.append(s('path', { class: 'sh', 'fill-opacity': far ? 0.08 : 0.14, d: brush(arc(cx, cy + 2, rx, ry, a0, a1, 40), sz * 0.12, { a: 0.1, b: 0.1, min: 0.4, wob: 0.2 }), filter: 'url(#ink-wash)' }))
      const n = Math.round(((a1 - a0) / 360) * (wide ? 34 : 26))
      const tops: { x: number; y: number; hh: number; a: number }[] = []
      for (let i = 0; i <= n; i++) {
        const a = a0 + ((a1 - a0) * i) / n
        if (atGate(a)) continue
        const [x, y] = onRim(a)
        const hh = ph * sc * (0.9 + 0.1 * Math.sin(i * 2.3))
        const w = Math.max(far ? 1.6 : 2.2, sz * (far ? 0.05 : 0.068))
        tops.push({ x, y, hh, a })
        g.append(s('path', { class: 'k', 'fill-opacity': op, d: brush([[x, y + 1], [x + 0.5, y - hh * 0.5], [x + 0.2, y - hh]], w, { a: 0.03, b: 0.06, min: 0.7, wob: 0.04 }) }))
        // bamboo nodes: short dark bands
        for (const f of [0.38, 0.74]) g.append(s('path', { class: 'k', 'fill-opacity': op * 0.9, d: brush([[x - w * 0.75, y - hh * f], [x + w * 0.75, y - hh * f - 0.4]], Math.max(1, w * 0.36), { a: 0.2, b: 0.2, min: 0.5 }) }))
      }
      // double rails, broken at the gate, lashed with a small knot at every post
      for (const f of [0.3, 0.68]) {
        const runs: Pt[][][] = []
        let cur: Pt[][] = [[], []]
        for (let a = a0; a <= a1; a += 2.5) {
          if (atGate(a)) {
            if (cur[0].length > 1) runs.push(cur)
            cur = [[], []]
            continue
          }
          const [x, y] = onRim(a)
          cur[0].push([x, y - ph * sc * f])
          cur[1].push([x, y - ph * sc * f + Math.max(2.2, sz * 0.05)])
        }
        if (cur[0].length > 1) runs.push(cur)
        for (const r of runs) for (const line of r) g.append(s('path', { class: 'k', 'fill-opacity': op * 0.8, d: brush(line, Math.max(1, sz * 0.026), { a: 0.03, b: 0.04, min: 0.7, wob: 0.03 }) }))
        if (!far) for (const t of tops) g.append(s('path', { class: 'k', 'fill-opacity': 0.9, d: ell(t.x, t.y - ph * f + sz * 0.025, Math.max(1.4, sz * 0.03), Math.max(1.8, sz * 0.045)) }))
      }
      return g
    }
    back.append(fence(180, 360, true))
    front.append(fence(0, 180, false))

    // ── the gate: two posts, a lintel with lifted ends, a tie beam; the opening between them is clear
    const [l, r] = [onRim(ga - gw), onRim(ga + gw)]
    const gh = sz * 1.15
    const lift = sz * 0.12
    const over = sz * 0.3
    const lt: Pt = [l[0], l[1] - gh]
    const rt: Pt = [r[0], r[1] - gh]
    front.append(s('g', { class: 'k', filter: 'url(#ink-rough)' },
      s('path', { 'fill-opacity': 0.12, class: 'sh', d: ell((l[0] + r[0]) / 2, (l[1] + r[1]) / 2 + 2, Math.abs(r[0] - l[0]) * 0.55 + 4, sz * 0.08), filter: 'url(#ink-wash)' }),
      s('path', { d: brush([[l[0], l[1] + 2], [l[0] + 0.6, l[1] - gh * 0.5], [lt[0], lt[1] + 3]], Math.max(2.6, sz * 0.09), { a: 0.04, b: 0.06, min: 0.7 }) }),
      s('path', { d: brush([[r[0], r[1] + 2], [r[0] - 0.6, r[1] - gh * 0.5], [rt[0], rt[1] + 3]], Math.max(2.6, sz * 0.09), { a: 0.04, b: 0.06, min: 0.7 }) }),
      // tie beam
      s('path', { 'fill-opacity': 0.85, d: brush([[l[0] - sz * 0.05, l[1] - gh * 0.74], [r[0] + sz * 0.05, r[1] - gh * 0.74]], Math.max(1.6, sz * 0.05), { a: 0.1, b: 0.1, min: 0.6 }) }),
      // lintel: one confident stroke, ends lifted like eaves
      s('path', { d: brush([[lt[0] - over, lt[1] - lift * 0.2], [lt[0], lt[1] - lift * 0.55], [(lt[0] + rt[0]) / 2, (lt[1] + rt[1]) / 2 - lift * 0.75], [rt[0], rt[1] - lift * 0.55], [rt[0] + over, rt[1] - lift * 0.2 - lift * 0.5]], Math.max(3, sz * 0.11), { a: 0.18, b: 0.22, min: 0.35 }) })))

    // ── stepping stones from the house to the gate
    const steps = s('g', { class: 't17g-steps' })
    const n = Math.max(4, Math.round(Math.hypot(pathPts[2][0] - pathPts[0][0], pathPts[2][1] - pathPts[0][1]) / (sz * 0.75)))
    const pts = curve(pathPts, n)
    pts.slice(1, -1).forEach(([x, y], i) => {
      const w = sz * (0.22 + 0.04 * Math.sin(i * 1.7))
      steps.append(s('path', { class: 'st', d: ell(x, y, w, w * 0.42), filter: 'url(#ink-rough)' }), s('path', { class: 'sh', 'fill-opacity': 0.4, d: brush([[x - w, y + 1], [x, y + w * 0.44], [x + w, y]], Math.max(1, w * 0.12)) }))
    })
    back.append(steps)
    walk = s('path', { d: `M${pts.map((p) => p.join(' ')).join('L')}`, fill: 'none', stroke: 'none' })
    back.append(walk)

    // ── your house: a small tea house; its doorway is ink-washed, and glows softly once a stone is home
    const hr = rng(5)
    const bw = hs * 0.9
    const bh = hs * 0.48
    const bx = hx - bw / 2
    const by = hy - bh
    const dw = bw * 0.17
    const doorD = `M${hx - dw} ${hy}L${hx - dw + 0.6} ${by + bh * 0.24}Q${hx} ${by + bh * 0.2} ${hx + dw - 0.4} ${by + bh * 0.25}L${hx + dw} ${hy}Z`
    const house = s('g', { class: 't17g-house' })
    glow = s('ellipse', { cx: hx, cy: hy - bh * 0.4, rx: hs * 0.9, ry: hs * 0.62, fill: `url(#${id.glow})`, opacity: 0 })
    doorLit = s('path', { class: 't17g-doorlit', d: doorD, filter: 'url(#ink-wash)', opacity: 0 })
    house.append(
      glow,
      s('path', { class: 'sh', 'fill-opacity': 0.14, d: ell(hx, hy + hs * 0.05, hs * 0.8, hs * 0.13), filter: 'url(#ink-wash)' }),
      s('path', { class: 'pap', d: `M${bx} ${hy}V${by}H${bx + bw}V${hy}Z` }),
      s('path', { class: 'sh', 'fill-opacity': 0.08, d: `M${bx} ${by}H${bx + bw}V${by + bh * 0.28}H${bx}Z`, filter: 'url(#ink-wash)' }),
      s('path', { class: 'k t17g-door', 'fill-opacity': 0.3, d: doorD, filter: 'url(#ink-wash)' }),
      doorLit,
      // a short noren curtain over the doorway, and the shoji's thin frame
      s('g', { class: 'k', 'fill-opacity': 0.75, filter: 'url(#ink-rough)' },
        ...[-1, 0, 1].map((j) => s('path', { d: brush([[hx + j * dw * 0.66, by + bh * 0.22], [hx + j * dw * 0.66 + 0.3, by + bh * 0.46]], dw * 0.56, { a: 0.02, b: 0.3, min: 0.5, wob: 0.03 }) })),
        s('path', { d: brush([[hx - dw * 1.15, by + bh * 0.2], [hx + dw * 1.15, by + bh * 0.2]], Math.max(1.4, hs * 0.022), { a: 0.1, b: 0.1, min: 0.6 }) })),
      s('g', { class: 'k', 'fill-opacity': 0.35 },
        ...[0.38, 0.62].map((f) => s('path', { d: brush([[hx + dw + 3, by + bh * f], [bx + bw * 0.94, by + bh * f]], 1, { a: 0.1, b: 0.1, min: 0.7 }) }))),
      s('g', { class: 'k', filter: 'url(#ink-rough)' },
        s('path', { d: brush([[bx + 1, hy + 1], [bx + 1.5, by]], Math.max(1.6, hs * 0.03), { a: 0.05, b: 0.1, min: 0.6 }) }),
        s('path', { d: brush([[bx + bw - 1, hy + 1], [bx + bw - 1.5, by]], Math.max(1.6, hs * 0.03), { a: 0.05, b: 0.1, min: 0.6 }) }),
        s('path', { d: brush([[bx - hs * 0.08, hy + 1], [bx + bw + hs * 0.1, hy + 0.5]], Math.max(1.8, hs * 0.035), { a: 0.1, b: 0.2 }) }),
        // roof: a long tapered stroke with lifted eaves, and the ridge
        s('path', { d: brush([[bx - hs * 0.32, by + hs * 0.02], [bx - hs * 0.1, by - hs * 0.06], [hx, by - hs * 0.12 - hr() * 2], [bx + bw + hs * 0.1, by - hs * 0.06], [bx + bw + hs * 0.34, by + hs * 0.01]], Math.max(3, hs * 0.075), { a: 0.25, b: 0.25, min: 0.25 }) }),
        s('path', { d: brush([[bx + hs * 0.02, by - hs * 0.14], [hx, by - hs * 0.3], [bx + bw - hs * 0.02, by - hs * 0.14]], Math.max(2, hs * 0.05), { a: 0.3, b: 0.3, min: 0.3 }) })),
      s('circle', { class: 'k2', 'fill-opacity': 0.5, cx: bx + bw * 0.2, cy: by + bh * 0.45, r: bh * 0.16 }),
      s('circle', { class: 'pap', cx: bx + bw * 0.2, cy: by + bh * 0.45, r: bh * 0.12 }))
    back.append(house)
    if (pieces.some((q) => q.home)) {
      glow.setAttribute('opacity', '1')
      doorLit.setAttribute('opacity', '1')
    }
    lantern = s('circle', { class: 't17g-lantern', r: Math.max(3, sz * 0.09), cx: door[0], cy: door[1], opacity: 0 })
    front.append(lantern)

    // ── closed stones: two staggered rows inside the fence, names above (clear of the front fence)
    const inP = wide ? IN_WIDE : tight ? IN_ROW : IN_TALL
    let ci = 0
    const closed = pieces.filter((p) => p.kind === 'closed')
    for (const p of closed) {
      const [fx, fy] = inP[ci++]
      p.x = cx + fx * rx * 0.8
      p.y = cy + fy * ry * 0.8
    }
    // a small garden: the stones make room for each other (and their names) but stay inside the fence
    const cw = Math.max(56, sz * 1.5) + 4
    const chh = sz + NAME + 2
    for (let it = 0; it < 80; it++) {
      let moved = false
      for (const [i, a] of closed.entries())
        for (const b of closed.slice(i + 1)) {
          const ox = cw - Math.abs(a.x - b.x)
          const oy = chh - Math.abs(a.y - b.y)
          if (ox <= 0 || oy <= 0) continue
          moved = true
          if (ox * 1.4 < oy) {
            const d = (a.x < b.x ? -1 : 1) * ox * 0.5
            a.x += d
            b.x -= d
          } else {
            const d = (a.y < b.y ? -1 : 1) * oy * 0.5
            a.y += d
            b.y -= d
          }
        }
      for (const p of closed) {
        const nx = (p.x - cx) / (rx * 0.84 - cw / 2)
        const ny = (p.y - cy) / Math.max(4, ry * 0.86 - sz * 0.4)
        const r = Math.hypot(nx, ny)
        if (r > 1) {
          p.x = cx + (nx / r) * (rx * 0.84 - cw / 2)
          p.y = cy + (ny / r) * Math.max(4, ry * 0.86 - sz * 0.4)
        }
      }
      if (!moved) break
    }

    // ── open stones: two loose groups on the open sand, kept off the fence, the house, the path and the words
    const pathLow = Math.max(...pts.map((p) => p[1]))
    const fr0 = cx + rx + sz * 0.6 // the sand right of the fence
    const hl = hx - hs * 0.8 // …up to the house
    // (once chosen, the pair stays on its side of the path unless the room really runs out: no jump when the sentence arrives)
    const room = H - pathLow - sz * 0.5
    const below = belowWas == null ? room > sz * 1.25 + NAME : belowWas ? room > sz * 0.9 + NAME : room > sz * 1.25 + NAME
    belowWas = below
    const anchors: Pt[] = wide
      ? below
        ? [[fr0 + (hl - fr0) * 0.3, top * 0.6 + (pathLow - top) * 0.42], [fr0 + (hl - fr0) * 0.42, pathLow + sz * 0.95]]
        : [[fr0 + 0.4 * Math.max(sz * 0.84, 40) + 30, pathLow - sz * 0.84 * 0.5 - NAME - 8], [hl - 1.65 * Math.max(sz * 0.84, 40) - 30, sz * 0.42 + 8]]
      : [[W * 0.2, cy + ry + sz * 2.4], [W * 0.14, H - sz * 1.1]]
    const rocks = [
      { x: cx - rx - 6, y: cy - ry - sz * 0.9, w: rx * 2 + 12, h: ry * 2 + sz * (wide ? 1 : 1.5) },
      { x: hx - hs * 0.85, y: hy - hs * 1.05, w: hs * 1.7, h: hs * 1.05 + sz * 1.2 },
      // the path's stepping stones
      ...pts.map(([x, y]) => ({ x: x - sz * 0.45, y: y - sz * 0.3, w: sz * 0.9, h: sz * 0.6 })),
      // the gate's words, and the verify legend in its corner
      ...(wide ? [{ x: gate[0] - sz * 0.3 - 230, y: gate[1] + sz * 0.3, w: 230, h: 28 }, { x: hx - 95, y: hy + sz * 0.92, w: 190, h: 24 }] : []),
      wide ? { x: W - legend.offsetWidth - 4, y: 0, w: legend.offsetWidth + 4, h: legend.offsetHeight + 4 } : { x: 0, y: H - legend.offsetHeight - 4, w: legend.offsetWidth + 6, h: legend.offsetHeight + 4 },
      // the words at the top (weights, and the fact that appears when a stone is touched)
      { x: wide ? cx - rx : 0, y: 0, w: wide ? rx * 2 : W, h: 50 },
    ]
    const open = pieces.filter((p) => p.kind === 'open')
    const sets = [0, 1].map((gi) => open.filter((p) => p.grp === gi))
    const shapes = [THREE, PAIR]
    const shrink = wide && !below && H < 340 ? 0.84 : 1
    const box = (p: Piece) => {
      const z = sz * p.k
      const bw2 = Math.max(56, z * 1.5)
      return { x: p.x - bw2 / 2, y: p.y - z / 2, w: bw2, h: z + NAME }
    }
    const pos = sets.map((set, gi) => ({ x: anchors[gi][0], y: anchors[gi][1], set, shape: shapes[gi] }))
    const placeAll = (q: (typeof pos)[number]) => q.set.forEach((p) => {
      const [dx, dy, k] = q.shape[p.slot] ?? [0, 0, 1]
      // offsets in stone sizes, but never closer than a name's width allows
      const u = Math.max(sz * shrink, 40)
      p.k = k * shrink
      p.x = q.x + dx * u
      p.y = q.y + dy * u
    })
    for (let it = 0; it < 90; it++) {
      let moved = false
      for (const [qi, q] of pos.entries()) {
        placeAll(q)
        const bs = q.set.map(box)
        const x0 = Math.min(...bs.map((b) => b.x))
        const x1 = Math.max(...bs.map((b) => b.x + b.w))
        const y0 = Math.min(...bs.map((b) => b.y))
        const y1 = Math.max(...bs.map((b) => b.y + b.h))
        // push the whole group as one: it keeps its shape
        const others = [...rocks, ...pos.filter((_, j) => j !== qi).flatMap((o) => o.set.map(box))]
        for (const b of bs)
          for (const r of others) {
            const ox = Math.min(b.x + b.w, r.x + r.w) - Math.max(b.x, r.x) + 4
            const oy = Math.min(b.y + b.h, r.y + r.h) - Math.max(b.y, r.y) + 4
            if (ox <= 4 || oy <= 4) continue
            moved = true
            if (ox < oy) q.x += (b.x + b.w / 2 < r.x + r.w / 2 ? -1 : 1) * ox * 0.5
            else q.y += (b.y + b.h / 2 < r.y + r.h / 2 ? -1 : 1) * oy * 0.5
          }
        q.x += clamp(x0, 4, W) - x0 + Math.min(0, W - 4 - x1)
        q.y += clamp(y0, 4, H) - y0 + Math.min(0, H - 2 - y1)
      }
      if (!moved) break
    }
    pos.forEach(placeAll)

    const glide: [Piece, number, number][] = []
    for (const p of pieces) {
      const z = Math.round(sz * p.k)
      const bw2 = Math.max(56, z * 1.5)
      const up = p.kind === 'closed'
      Object.assign(p.btn.style, { left: `${p.x - bw2 / 2}px`, top: `${p.y - z / 2 - (up ? NAME : 0)}px`, width: `${bw2}px` })
      p.btn.style.setProperty('--sz', `${z}px`)
      p.btn.querySelector<HTMLElement>('.logo-stone')?.style.setProperty('--ls-size', `${z}px`)
      const old = was.get(p)
      was.set(p, [p.x, p.y])
      if (p.busy) continue
      gsap.set(p.btn, p.home ? homeXY(p) : { x: 0, y: 0, scale: 1 })
      if (old && !p.home && !ctx.reduced && Math.hypot(old[0] - p.x, old[1] - p.y) > 1) glide.push([p, old[0] - p.x, old[1] - p.y])
    }
    // a relayout (the sentence arriving, a resize) lets the stones glide to their new places
    if (glide.length) ctx.anim(() => glide.forEach(([p, dx, dy]) => gsap.fromTo(p.btn, { x: dx, y: dy }, { x: 0, y: 0, duration: 0.9, ease: 'power3.inOut' })))
    place(homeLab, hx + hs * 0.12, hy - hs * 0.9, 'bottom')
    // the garden's name stands over its back fence; the gate's words wait just outside, left of the gate
    place(fenceLab, cx - rx * 0.55, cy - ry - sz * 0.62, 'bottom')
    place(gateLab, gate[0] - sz * 0.3, gate[1] + sz * 0.42, 'right')
    place(takeLab, hx, hy + sz * 0.92 + 4, 'top')
    // wide: the words sit above the fence, leaving the open sand to the stones
    place(wLab, wide ? cx : W / 2, 0, 'top')
    const sayTop = wLab.offsetHeight + 4
    Object.assign(say.style, wide ? { left: `${cx}px`, top: `${sayTop}px`, width: `${Math.min(500, rx * 2)}px` } : { left: `${W / 2}px`, top: `${sayTop}px`, width: `${W - 8}px` })
  }

  function place(el: HTMLElement, x: number, y: number, anchor: 'top' | 'bottom' | 'left' | 'right') {
    Object.assign(el.style, { left: `${x}px`, top: `${y}px` })
    el.dataset.anchor = anchor
  }
  const curve = (p: Pt[], n: number): Pt[] =>
    Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n
      const u = 1 - t
      return [u * u * p[0][0] + 2 * u * t * p[1][0] + t * t * p[2][0], u * u * p[0][1] + 2 * u * t * p[1][1] + t * t * p[2][1]] as Pt
    })

  /** resting place on the veranda, as a transform from the stone's own spot */
  function homeXY(p: Piece) {
    const homed = pieces.filter((q) => q.home)
    const i = Math.max(0, homed.indexOf(p))
    const { hx, hy, hs, sz } = geo
    const span = Math.min(hs * 1.5, homed.length * sz * 0.85)
    const tx = hx - span / 2 + (homed.length > 1 ? (span * i) / (homed.length - 1) : span / 2)
    const ty = hy + sz * 0.42
    return { x: tx - p.x, y: ty - p.y, scale: 0.72 / p.k }
  }

  function show(on: HTMLElement[]) {
    for (const el of on) el.classList.add('on')
  }

  function tell(p: Piece) {
    // a phone has no room beside the gate or the house for their words, so they follow the fact
    const how = geo.wide ? null : h('p', { class: 't17g-say-n' }, p.kind === 'closed' ? G.gateLabel : G.homeLabel)
    say.replaceChildren(ctx.fact(p.fact, 'p', 't17g-say-t'), ...(how ? [how] : []))
    if (!ctx.reduced) ctx.anim(() => gsap.fromTo(say.children, { opacity: 0, y: 6, filter: 'blur(4px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.9, stagger: 0.12, ease: 'power3.out' }))
  }

  function settleHome() {
    ctx.anim(() => pieces.filter((q) => q.home && !q.busy).forEach((q) => (ctx.reduced ? gsap.set(q.btn, homeXY(q)) : gsap.to(q.btn, { ...homeXY(q), duration: 0.8, ease: 'power3.out' }))))
  }

  function act(p: Piece) {
    if (p.busy) return
    tried.add(p.kind)
    show([homeLab, fenceLab, wLab])
    tell(p)
    ctx.chime(p.kind === 'open' ? 'ok' : 'tap')
    if (p.kind === 'closed') knock(p)
    else carry(p)
    if (tried.size === 2 && !shown) {
      shown = true
      ctx.insight(G.insight, G.detail)
    }
  }

  /** a closed stone tries to leave: it bumps the fence; instead a little light walks to the gate and back */
  function knock(p: Piece) {
    show([gateLab])
    const { cx, gate } = geo
    const dx = gate[0] - p.x
    const dy = gate[1] - p.y
    const d = Math.hypot(dx, dy) || 1
    const reach = Math.min(d * 0.3, geo.sz * 0.7)
    if (ctx.reduced) return
    p.busy = true
    ctx.anim(() => {
      const tl = gsap.timeline({ onComplete: () => void (p.busy = false) })
      tl.to(p.btn, { x: (dx / d) * reach, y: (dy / d) * reach - 6, duration: 0.45, ease: 'power2.out' })
        .to(p.btn, { x: (dx / d) * reach * 0.8 + (p.x < cx ? -3 : 3), duration: 0.08, ease: 'power1.inOut', yoyo: true, repeat: 3 })
        .to(p.btn, { x: 0, y: 0, duration: 0.8, ease: 'power3.inOut' })
      if (lantern && walk) {
        const L2 = walk.getTotalLength()
        const o = { t: 0 }
        const put = () => {
          const pt = walk!.getPointAtLength(o.t * L2)
          lantern!.setAttribute('cx', String(pt.x))
          lantern!.setAttribute('cy', String(pt.y))
        }
        gsap.timeline()
          .set(lantern, { opacity: 1 })
          .to(o, { t: 1, duration: 1.2, ease: 'power1.inOut', onUpdate: put })
          .to(lantern, { attr: { r: geo.sz * 0.16 }, duration: 0.25, yoyo: true, repeat: 1 })
          .to(o, { t: 0, duration: 1.2, ease: 'power1.inOut', onUpdate: put })
          .to(lantern, { opacity: 0, duration: 0.4 })
      }
    })
  }

  /** an open stone floats home and rests at your doorway; tap it there to send it back */
  function carry(p: Piece) {
    p.home = !p.home
    p.btn.setAttribute('aria-label', fill(p.home ? G.back : G.take, { model: p.model }))
    p.btn.classList.toggle('home', p.home)
    if (p.home) show([takeLab])
    const lit = pieces.some((q) => q.home)
    if (ctx.reduced) {
      gsap.set(p.btn, p.home ? homeXY(p) : { x: 0, y: 0, scale: 1 })
      settleHome()
      if (glow && doorLit) gsap.set([glow, doorLit], { opacity: lit ? 1 : 0 })
      return
    }
    p.busy = true
    ctx.anim(() => {
      const to = p.home ? homeXY(p) : { x: 0, y: 0, scale: 1 }
      const cur = { x: gsap.getProperty(p.btn, 'x') as number, y: gsap.getProperty(p.btn, 'y') as number }
      const lift = -Math.max(40, Math.abs(to.y - cur.y) * 0.5 + 30)
      gsap.timeline({ onComplete: () => void ((p.busy = false), settleHome()) })
        .to(p.btn, { y: cur.y - 10, duration: 0.25, ease: 'power2.out' })
        .to(p.btn, { x: to.x, duration: 1.3, ease: 'power2.inOut' }, '>')
        .to(p.btn, { keyframes: { y: [cur.y - 10, Math.min(cur.y, to.y) + lift, to.y], easeEach: 'sine.inOut' }, duration: 1.3 }, '<')
        .to(p.btn, { scale: to.scale, duration: 1.3, ease: 'power2.inOut' }, '<')
      if (glow && doorLit) gsap.to([glow, doorLit], { opacity: lit ? 1 : 0, duration: 1.2, delay: p.home ? 1.1 : 0 })
      settleHome()
    })
  }

  // drag: an open stone can be carried home by hand; a closed one only presses against its fence
  const drag = { p: null as Piece | null, x0: 0, y0: 0, moved: false, ox: 0, oy: 0 }
  let swallow = false
  for (const p of pieces) {
    p.btn.addEventListener('click', () => {
      if (swallow) return void (swallow = false)
      act(p)
    })
    p.btn.addEventListener('pointerdown', (e) => {
      if (p.busy || p.home || e.button > 0) return
      drag.p = p
      drag.x0 = e.clientX
      drag.y0 = e.clientY
      drag.moved = false
      drag.ox = gsap.getProperty(p.btn, 'x') as number
      drag.oy = gsap.getProperty(p.btn, 'y') as number
      p.btn.setPointerCapture(e.pointerId)
    })
    p.btn.addEventListener('pointermove', (e) => {
      if (drag.p !== p) return
      let dx = e.clientX - drag.x0
      let dy = e.clientY - drag.y0
      if (!drag.moved && Math.hypot(dx, dy) < 7) return
      drag.moved = true
      p.btn.classList.add('held')
      if (p.kind === 'closed') {
        // the fence holds: past its line the stone only leans
        const { cx, cy, rx, ry } = geo
        const nx = (p.x + dx - cx) / (rx * 0.86)
        const ny = (p.y + dy - cy) / (ry * 0.8)
        const r = Math.hypot(nx, ny)
        if (r > 1) {
          const lean = 1 + (r - 1) * 0.15
          dx = cx + (nx / r) * lean * rx * 0.86 - p.x
          dy = cy + (ny / r) * lean * ry * 0.8 - p.y
        }
      }
      gsap.set(p.btn, { x: drag.ox + dx, y: drag.oy + dy })
    })
    const end = () => {
      if (drag.p !== p) return
      drag.p = null
      p.btn.classList.remove('held')
      if (!drag.moved) return
      swallow = true
      setTimeout(() => (swallow = false), 0)
      const x = p.x + (gsap.getProperty(p.btn, 'x') as number)
      const y = p.y + (gsap.getProperty(p.btn, 'y') as number)
      if (p.kind === 'open' && Math.hypot(x - geo.hx, y - geo.hy) < geo.hs * 0.9) act(p)
      else if (p.kind === 'closed') act(p)
      else ctx.anim(() => gsap.to(p.btn, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.6)' }))
    }
    p.btn.addEventListener('pointerup', end)
    p.btn.addEventListener('pointercancel', end)
  }

  if (!ctx.reduced) {
    gsap.from(pieces.map((p) => p.btn), { opacity: 0, y: 12, duration: 1.2, ease: 'power3.out', stagger: 0.08, delay: 0.3, clearProps: 'opacity' })
  }

  let raf = 0
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(layout)
  })
  ro.observe(root)
  layout()
  return () => {
    ro.disconnect()
    cancelAnimationFrame(raf)
  }
}
