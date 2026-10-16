import { nextId, s } from '../../core/dom'
import { rng, stroke, type Pt } from '../../ui/part2/ink'
import type { PondGeo } from '../../ui/part2/perspectives'
import { perspectiveCircle } from '../../ui/part2/perspectives'
import type { Perspectives } from '../../ui/part2/types'
import { hills, mist, paperLantern } from '../../ui/part2/paint'
import C from '../../content/tram-26.json'
import { f1, pondWithFront, type Foot } from '../t25/kit'

/** The arched stone bridge between the two far stones: its face (with the arch cut out), parapet, steps, arch stones. */
function bridgeShape({ cx, cy, rx, ry }: PondGeo, stones: Foot[]) {
  const far = [...stones].sort((a, b) => a.y - b.y).slice(0, 2).sort((a, b) => a.x - b.x)
  const [L, R] = far.length === 2 ? far : [{ x: cx - rx, y: cy - ry, w: 60 }, { x: cx + rx, y: cy - ry, w: 60 }]
  const bx = (L.x + R.x) / 2, S = (R.x - L.x) / 2
  const base = cy - ry * 0.84
  const rise = rx * 0.34
  const A = S * 0.56, Ah = Math.min(rise * 0.9, base - (Math.min(L.y, R.y) - rise) - 8)
  const top = (x: number) => {
    const u = (x - bx) / S
    return (L.y + (R.y - L.y) * ((u + 1) / 2)) - rise * (1 - u * u)
  }
  const deck: Pt[] = Array.from({ length: 33 }, (_, i) => {
    const x = L.x + ((R.x - L.x) * i) / 32
    return [x, top(x)]
  })
  const face = `M${f1(L.x)} ${f1(base)}L${deck.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}L${f1(R.x)} ${f1(base)}L${f1(bx + A)} ${f1(base)}A${f1(A)} ${f1(Ah)} 0 0 0 ${f1(bx - A)} ${f1(base)}Z`
  return { L, R, bx, S, base, rise, A, Ah, top, deck, face }
}

/** Behind the pond: hills in the mist, the bridge across the far side, a paper lantern hanging under its arch. */
function back(g: PondGeo, stones: Foot[]): SVGElement[] {
  const { w, cx, cy, rx, ry, seed } = g
  const b = bridgeShape(g, stones)
  const P = rx * 0.07
  let posts = '', steps = '', arch = ''
  for (let i = 0; i <= 8; i++) {
    const x = b.L.x + ((b.R.x - b.L.x) * i) / 8, y = b.top(x)
    posts += stroke([[x, y + 1], [x + 0.3, y - P]], Math.max(2.4, rx * 0.022), 0.05, 0.05, 0.7)
  }
  // the treads: short marks on the deck, closer together where it climbs
  for (let i = 1; i < 32; i++) {
    if (i > 13 && i < 19) continue
    const [x, y] = b.deck[i]
    steps += stroke([[x - 2.4, y + 2.2], [x + 2.4, y + 2.6]], 1.3, 0.2, 0.2, 0.3)
  }
  for (let a = 12; a < 180; a += 14) {
    const t = (a * Math.PI) / 180
    const x0 = b.bx + Math.cos(t) * b.A, y0 = b.base - Math.sin(t) * b.Ah
    const k = 1 + (rx * 0.09) / Math.max(b.A, 1)
    arch += stroke([[x0, y0], [b.bx + Math.cos(t) * b.A * k, b.base - Math.sin(t) * b.Ah * k]], 1.3, 0.1, 0.1, 0.4)
  }
  const rail = b.deck.map(([x, y]) => [x, y - P] as Pt)
  const lr = Math.max(7, rx * 0.06)
  return [
    mist(cx, cy - ry * 1.5, w * 0.6, ry * 1.1),
    hills(-w * 0.05, w * 1.05, cy - ry * 0.8, ry * 1.25, seed, 0.9, 5),
    mist(cx, b.base - b.Ah * 0.4, rx * 1.6, ry * 0.5),
    s('path', { class: 't26c-bridge', d: b.face, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
    s('path', { d: b.face, fill: 'url(#p2-shade)' }),
    s('path', { class: 'zk-ink t26c-ink', d: stroke(b.deck, Math.max(2, rx * 0.02), 0.04, 0.04, 0.5) + arch, filter: 'url(#ink-rough)' }),
    s('path', { class: 'zk-ink t26c-steps', d: steps }),
    s('path', { class: 't26c-rail', d: stroke(rail, Math.max(2.4, rx * 0.022), 0.04, 0.04, 0.6) + posts, filter: 'url(#ink-rough)' }),
    s('path', { class: 't26c-rim', d: stroke(rail.slice(2, 15).map(([x, y]) => [x, y - 1.4] as Pt), 1.2, 0.3, 0.3, 0.1) }),
    s('g', { class: 't26c-lantern' }, paperLantern(b.bx, b.base - b.Ah, lr, seed + 3, Math.max(4, b.Ah * 0.18))),
  ]
}

/** In front of the water: the bridge's ring mirrored in the pond, the lantern's warm smear, a stone step under each stone. */
function front(g: PondGeo, stones: Foot[]): SVGElement[] {
  const { cx, cy, rx, ry, seed } = g
  const b = bridgeShape(g, stones)
  const id = nextId('t26c')
  // a cut stone step under each stone: a skewed top face, its front face, a rough ink edge
  const steps = stones.map((f, i) => {
    const r = rng(seed + 10 + i)
    const sw = f.w * 0.6, th = f.w * 0.11, j = () => (r() - 0.5) * th * 0.3
    const tl: Pt = [f.x - sw, f.y - th * 0.55 + j()], tr: Pt = [f.x + sw * 0.96, f.y - th * 0.7 + j()]
    const br: Pt = [f.x + sw, f.y + th * 0.75 + j()], bl: Pt = [f.x - sw * 0.97, f.y + th * 0.8 + j()]
    const Q = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`
    return [
      s('path', { class: 't26c-step-side', d: `M${Q(bl)}L${Q(br)}L${f1(br[0] - 1)} ${f1(br[1] + th * 1.1)}L${f1(bl[0] + 1)} ${f1(bl[1] + th * 1.15)}Z`, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
      s('path', { class: 't26c-step', d: `M${Q(tl)}L${Q(tr)}L${Q(br)}L${Q(bl)}Z`, filter: 'url(#ink-rough)' }),
      s('path', { class: 'zk-ink t26c-ink', d: stroke([bl, br], 1.6, 0.1, 0.1, 0.4) + stroke([[br[0] - 1, br[1] + th * 1.1], [bl[0] + 1, bl[1] + th * 1.15]], 2, 0.1, 0.1, 0.4) }),
    ]
  }).flat()
  return [
    s('defs', null, s('clipPath', { id }, s('ellipse', { cx: f1(cx), cy: f1(cy), rx: f1(rx * 0.98), ry: f1(ry * 0.96) }))),
    s('g', { 'clip-path': `url(#${id})` },
      s('g', { class: 't26c-refl', transform: `translate(0 ${f1(b.base * 2)}) scale(1 -1)` }, s('path', { d: b.face })),
      s('ellipse', { class: 't26c-glow', cx: f1(b.bx), cy: f1(b.base + b.Ah * 0.9), rx: f1(rx * 0.1), ry: f1(ry * 0.22), fill: 'url(#p2-lamp)' })),
    ...steps,
  ]
}

const S = C.scenes.circle
export const circleScene = pondWithFront(
  (art) => perspectiveCircle(S.perspectives as Perspectives, { label: S.label, prompt: S.prompt, question: S.question, art }),
  back, front)
