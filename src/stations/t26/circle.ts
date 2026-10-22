import { fill, h, nextId, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { blob, clamp, curve, onDigit, onSize, p2Defs, rng, stableHeight, stroke, type Pt } from '../../ui/part2/ink'
import { hills, mist, moon, pine, water } from '../../ui/part2/paint'
import { guide } from '../../ui/part2/guide'
import type { SceneDef } from '../types'
import C from '../../content/tram-26.json'

/**
 * Scene 5 — should there be a rule like this? (audit v3 26-5 "Làm lại": the balance beam under the pavilion roof).
 * You crouch at the front of an open pavilion (azumaya) and look up into it, as at a stage: the two front posts and the
 * front beam frame the picture, the question carved on a board hung from that beam; inside, the rafters climb toward the
 * smoke hole and the far beam on its posts frames the night — hills in mist, a low moon over them, its road on the
 * pond. A bamboo balance beam hangs on a cord from the smoke hole, "nên thận trọng" at one end, "còn hoài nghi" at the
 * other. Four bamboo-ribbed paper lanterns hang under the side beams, unlit. Tap one (or keys 1–4): it lights, a paper
 * strip unrolls under it with who says what, and it is carried to the end its reason belongs to; the beam tips, and levels
 * again at two and two. All four: the beam hangs level and the lantern light warms the whole ceiling.
 *
 * The pavilion is modelled in metres and drawn through a pinhole camera (clipped at a near plane), so the roof rests on its
 * beams and the beams on their posts by construction. Lanterns and strips are HTML (buttons, live text) placed on the
 * projected points; they move with CSS transitions only (no frame loop).
 */

const S = C.scenes.circle
const F = (x: unknown) => x as Fact
const f1 = (n: number) => n.toFixed(1)
type V3 = [number, number, number]

// ── the pavilion in metres: x right, y away from you, z up from the floor
const A = 1.5 // posts at (±A, ±A)
const PW = 0.09 // half a post's width
const BEAM: [number, number] = [2.24, 2.42] // the eave beam's underside and top
const E = A + 0.72 // the roof's edge, overhanging the beam
const ZE = 2.5 // height of the roof's edge
const ZA = 3.5 // the apex (the smoke hole's ring sits just under it)
const HOLE = 0.3
const PIVOT: V3 = [0, 0, 2.08] // where the balance beam hangs from its cord
const ARM = 0.9 // half the balance beam's length
const LAMP = 0.15 // a lantern's half width (m)
const NEAR = 0.06 // the camera's near plane (m)
// the four lanterns start on hooks under the side beams (two each side), then go to the end their reason belongs to
const START: V3[] = [[-A + 0.04, -0.3, BEAM[0]], [-A + 0.04, 0.8, BEAM[0]], [A - 0.04, -0.3, BEAM[0]], [A - 0.04, 0.8, BEAM[0]]]

interface Cam { f: number; cx: number; cy: number; e: V3; st: number; ct: number }
/** world → camera: [right, up, forward] */
const toCam = (c: Cam, p: V3): V3 => {
  const dx = p[0] - c.e[0], dy = p[1] - c.e[1], dz = p[2] - c.e[2]
  return [dx, -dy * c.ct + dz * c.st, dy * c.st + dz * c.ct]
}
const scr = (c: Cam, q: V3): Pt => [c.cx + (c.f * q[0]) / q[2], c.cy - (c.f * q[1]) / q[2]]
const proj = (c: Cam, p: V3): Pt => scr(c, toCam(c, p))
/** a world polygon, clipped at the near plane, as an SVG path ('' if wholly behind you) */
function poly(c: Cam, pts: V3[]) {
  const q = pts.map((p) => toCam(c, p))
  const out: V3[] = []
  for (let i = 0; i < q.length; i++) {
    const a = q[i], b = q[(i + 1) % q.length]
    const ain = a[2] >= NEAR, bin = b[2] >= NEAR
    if (ain) out.push(a)
    if (ain !== bin) {
      const t = (NEAR - a[2]) / (b[2] - a[2])
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR])
    }
  }
  return out.length < 3 ? '' : `M${out.map((v) => scr(c, v).map(f1).join(' ')).join('L')}Z`
}
/** a world segment clipped at the near plane, in screen px (null if behind you) */
function seg(c: Cam, a: V3, b: V3): [Pt, Pt] | null {
  let p = toCam(c, a), q = toCam(c, b)
  if (p[2] < NEAR && q[2] < NEAR) return null
  const cut = (u: V3, v: V3): V3 => { const t = (NEAR - u[2]) / (v[2] - u[2]); return [u[0] + (v[0] - u[0]) * t, u[1] + (v[1] - u[1]) * t, NEAR] }
  if (p[2] < NEAR) p = cut(p, q)
  if (q[2] < NEAR) q = cut(q, p)
  return [scr(c, p), scr(c, q)]
}
const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

/** The camera, crouched in front of the pavilion and looking up into it; on a tall frame lower and closer, the eaves
 *  running edge to edge with the night sky and the moon above them. */
function camera(w: number, hh: number): Cam {
  const land = w / hh > 1.1
  const T = ((land ? 69 : 50) * Math.PI) / 180 // from the zenith toward the far side
  return land
    ? { f: hh * 1.12, cx: w / 2, cy: hh * 0.42, e: [0, -4.4, 0.55], st: Math.sin(T), ct: Math.cos(T) }
    : { f: w * 0.6, cx: w / 2, cy: hh * 0.45, e: [0, -3.0, 0.3], st: Math.sin(T), ct: Math.cos(T) }
}

/** A paper lantern (chōchin) seen a little from below: a knot and lacquered top cap, the paper body on bamboo hoops (each
 *  hoop's near half sags toward you), the bottom cap with its mouth, the inside aglow when lit. Local units, r = 20 (half
 *  its width); the knot's top is at (0, 0), the body runs down to y ≈ 3.6 r. Sized by CSS (--r). */
const LR = 20
function lanternArt() {
  const r = LR, hh = r * 1.3, cy = r * 0.66 + hh
  let hoops = ''
  for (let i = 1; i < 8; i++) {
    const t = -1 + (i * 2) / 8 // -1 top … 1 bottom
    const y = cy + t * hh * 0.97
    const hw = r * 1.03 * Math.sqrt(Math.max(0, 1 - t * t))
    const sag = r * (0.1 + 0.16 * (1 - t) * 0.5) // the near half bows down, more on the upper hoops (seen from below)
    hoops += stroke(curve([-hw, y], [0, y + sag], [hw, y], 10), 0.9, 0.15, 0.15, 0.3)
  }
  const body = `M0 ${f1(cy - hh)}C${f1(r * 0.62)} ${f1(cy - hh)} ${f1(r * 1.04)} ${f1(cy - hh * 0.55)} ${f1(r * 1.04)} ${f1(cy)}C${f1(r * 1.04)} ${f1(cy + hh * 0.55)} ${f1(r * 0.62)} ${f1(cy + hh)} 0 ${f1(cy + hh)}C${f1(-r * 0.62)} ${f1(cy + hh)} ${f1(-r * 1.04)} ${f1(cy + hh * 0.55)} ${f1(-r * 1.04)} ${f1(cy)}C${f1(-r * 1.04)} ${f1(cy - hh * 0.55)} ${f1(-r * 0.62)} ${f1(cy - hh)} 0 ${f1(cy - hh)}Z`
  const cap = (y: number, w: number, d: number) => `M${f1(-w)} ${f1(y)}Q0 ${f1(y + d * 0.6)} ${f1(w)} ${f1(y)}L${f1(w * 0.94)} ${f1(y + d)}Q0 ${f1(y + d * 1.6)} ${f1(-w * 0.94)} ${f1(y + d)}Z`
  return s('svg', { class: 't26c-lamp', viewBox: `${-3 * r} ${-1.5 * r} ${6 * r} ${7 * r}`, 'aria-hidden': 'true' },
    s('circle', { class: 't26c-lglow', cx: 0, cy: f1(cy), r: f1(r * 2.9), fill: 'url(#p2-lamp)' }),
    s('path', { class: 't26c-lbody', d: body }),
    s('path', { class: 't26c-lshade', d: body }),
    s('ellipse', { class: 't26c-lcore', cx: 0, cy: f1(cy + hh * 0.15), rx: f1(r * 0.62), ry: f1(hh * 0.62) }),
    s('path', { class: 't26c-lrib', d: hoops }),
    // the moon's light from the open side, low and in front: a thin bright lip along the lower left of the paper
    s('path', { class: 't26c-lrim', d: stroke(curve([-r * 0.98, cy + hh * 0.05], [-r * 0.9, cy + hh * 0.72], [-r * 0.2, cy + hh * 0.98], 10), r * 0.07, 0.3, 0.4, 0.1) }),
    s('path', { class: 't26c-lcap', d: cap(cy - hh - r * 0.16, r * 0.46, r * 0.22) + cap(cy + hh - r * 0.08, r * 0.5, r * 0.22) }),
    s('ellipse', { class: 't26c-lmouth', cx: 0, cy: f1(cy + hh + r * 0.22), rx: f1(r * 0.4), ry: f1(r * 0.09) }),
    s('path', { class: 't26c-lknot', d: blob(0, r * 0.18, r * 0.13, r * 0.14, 3, 0.1, 8) }))
}

export const circleScene: SceneDef = {
  label: S.label,
  mount(ctx) {
    p2Defs()
    const id = nextId('t26c')
    const stones = S.perspectives.stones
    const n = stones.length
    const side = S.sides // 0 = nên thận trọng (left end), 1 = còn hoài nghi (right end)
    const stable = stableHeight(ctx, [F(S.perspectives.common)])
    ctx.art.classList.add('t26c-art')
    ctx.onCleanup(() => ctx.art.classList.remove('t26c-art'))

    const svg = s('svg', { class: 't26c-svg', 'aria-hidden': 'true' })
    const beamG = s('g', { class: 't26c-beam' })
    const ends = S.ends.map((t, i) => h('p', { class: `t26c-end e${i}`, 'aria-hidden': 'true' }, t))
    // the lanterns: buttons on the projected points; the cord is drawn by CSS up from the top cap
    const lamps = stones.map((st, i) => {
      return h('button', { class: 't26c-lantern', type: 'button', 'aria-pressed': 'false', 'aria-label': fill(S.lampAria, { n: i + 1 }), 'data-who': st.who, onClick: () => hear(i) }, h('span', { class: 't26c-cord', 'aria-hidden': 'true' }), lanternArt())
    })
    const strip = h('div', { class: 't26c-strip', hidden: true })
    const root = h('div', { class: 't26c' }, h('p', { class: 'visually-hidden' }, S.art), h('p', { class: 'visually-hidden' }, S.question), svg, ...ends, h('div', { class: 't26c-lamps', role: 'group', 'aria-label': S.label }, ...lamps), strip)
    ctx.art.append(root)
    ctx.prompt(S.prompt)
    const g = guide(ctx)

    // ── state
    const heard = new Set<number>()
    let active = -1
    let cam: Cam | null = null
    let W = 0, Hs = 0
    const at: ('start' | 'beam')[] = stones.map(() => 'start')
    const slot: number[] = stones.map(() => -1) // which of the two places on its end a hung lantern takes
    let lampR = 20 // a lantern's radius on the beam (px), for the count board below it

    /** where lantern i's hook is now (screen px), and how the beam is tipped */
    const tilt = () => {
      let l = 0, r = 0
      at.forEach((a, i) => a === 'beam' && (side[i] ? r++ : l++))
      return clamp((r - l) * 5.5, -11, 11) // degrees; the heavier end goes down
    }
    let pivot: Pt = [0, 0], endL: Pt = [0, 0], endR: Pt = [0, 0]
    const rot = (p: Pt, deg: number): Pt => {
      const a = (deg * Math.PI) / 180, dx = p[0] - pivot[0], dy = p[1] - pivot[1]
      return [pivot[0] + dx * Math.cos(a) - dy * Math.sin(a), pivot[1] + dx * Math.sin(a) + dy * Math.cos(a)]
    }
    /** the hook a lantern hangs from (screen px) and the screen "down" there (toward away from the zenith) */
    function hook(i: number): Pt {
      if (!cam) return [0, 0]
      if (at[i] === 'start') return proj(cam, START[i])
      const e = rot(side[i] ? endR : endL, tilt())
      // two lanterns share an end: one hangs at the tip, the other a hand's width in
      const k = slot[i] === 1 ? 0.5 : 1
      return [pivot[0] + (e[0] - pivot[0]) * k, pivot[1] + (e[1] - pivot[1]) * k]
    }
    let vp: Pt = [0, -1e4]
    function place(i: number) {
      if (!cam) return
      const [hx, hy] = hook(i)
      const dx = hx - vp[0], dy = hy - vp[1]
      const ang = (Math.atan2(-dx, dy) * 180) / Math.PI * 0.85
      // nearer things are larger: the scale of a lantern from its depth at the hook
      const depth = at[i] === 'start' ? toCam(cam, START[i])[2] : toCam(cam, PIVOT)[2]
      const r = clamp((cam.f * LAMP) / depth, 14, 34)
      const cord = r * (at[i] === 'start' ? 1.5 : slot[i] === 1 ? 0.7 : 1.5)
      const b = lamps[i]
      const bw = r * 2.6, bh = r * 3.7
      b.style.setProperty('--cord', `${f1(cord)}px`)
      b.style.setProperty('--r', `${f1(r)}px`)
      Object.assign(b.style, { width: `${f1(bw)}px`, height: `${f1(bh)}px`, transform: `translate(${f1(hx - bw / 2)}px, ${f1(hy + cord)}px) rotate(${f1(ang)}deg)`, transformOrigin: `50% ${f1(-cord)}px` })
      if (i === active) placeStrip()
    }
    function placeStrip() {
      if (active < 0 || !cam) return
      const [hx, hy] = hook(active)
      const b = lamps[active]
      const r = parseFloat(b.style.getPropertyValue('--r')) || lampR
      const cord = parseFloat(b.style.getPropertyValue('--cord')) || r
      const sw = Math.min(W * (W > Hs * 1.1 ? 0.16 : 0.46), 230)
      const top = hy + cord + r * 3.75
      // keep the strip inside the frame
      const x = clamp(hx - sw / 2, 10, W - sw - 10)
      Object.assign(strip.style, { width: `${f1(sw)}px`, transform: `translate(${f1(x)}px, ${f1(top)}px)` })
    }
    function placeBeam() {
      const t = tilt()
      beamG.style.transform = `rotate(${t}deg)`
      beamG.style.transformOrigin = `${f1(pivot[0])}px ${f1(pivot[1])}px`
      const el = rot(endL, t), er = rot(endR, t)
      ends[0].style.transform = `translate(${f1(el[0])}px, ${f1(el[1])}px)`
      ends[1].style.transform = `translate(${f1(er[0])}px, ${f1(er[1])}px)`
    }

    // ── paint: the night beyond, then the pavilion, far to near
    function paint() {
      const w = ctx.art.clientWidth, hh0 = ctx.art.clientHeight
      if (w < 60 || hh0 < 60) return
      W = w
      Hs = stable(hh0)
      root.style.height = `${f1(Hs)}px`
      const c = (cam = camera(W, Hs))
      const land = W / Hs > 1.1
      svg.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(Hs)}`)
      const r = rng(2670)
      vp = [c.cx, c.cy - (c.f * c.st) / c.ct]
      const yh = c.cy + (c.f * c.ct) / c.st // the horizon
      const P0 = A + 0.36 // the platform's half size
      const edgeY = proj(c, [0, P0, 0])[1] // its far edge on screen

      // the night: stars, hills in mist, the low moon in the right-hand opening, its road on the pond
      let stars = ''
      for (let i = 0; i < 70; i++) stars += `M${f1(r() * W)} ${f1(r() * yh * 0.95)}h${f1(0.6 + r() * 1.2)}`
      // the moon low over the hills in the right-hand opening, clear of the strips that hang in the middle
      const mx = W * (land ? 0.885 : 0.76), my = land ? yh - Hs * 0.2 : Hs * 0.08
      const mr = Math.min(W, Hs) * (land ? 0.038 : 0.05)
      const kids: SVGElement[] = [s('rect', { class: 't26c-skyfill', width: f1(W), height: f1(Hs) }), s('path', { class: 't26c-stars', d: stars }),
        moon(mx, my, mr, 2671, true),
        hills(-W * 0.1, W * 1.1, yh, Hs * 0.1, 2672, 1, 5), mist(W * 0.5, yh - Hs * 0.025, W * 0.6, Hs * 0.04),
        hills(-W * 0.15, W * 0.5, yh, Hs * 0.06, 2673, 0.55, 2), hills(W * 0.55, W * 1.15, yh, Hs * 0.05, 2674, 0.6, 2),
        mist(W * 0.7, yh - Hs * 0.008, W * 0.4, Hs * 0.02),
        s('g', { class: 't26c-pond' }, water(0, yh, W, Math.max(yh + 10, edgeY + 4), 2675, mx)),
        // a pine on the far bank at the left, behind the pavilion
        s('path', { class: 't26c-bank', d: `M-10 ${f1(yh + 1)}Q${f1(W * 0.14)} ${f1(yh - Hs * 0.014)} ${f1(W * 0.32)} ${f1(yh + 3)}L${f1(W * 0.32)} ${f1(yh + 6)}L-10 ${f1(yh + 7)}Z` }),
        pine(W * (land ? 0.1 : 0.1), yh + 4, Hs * (land ? 0.4 : 0.26), 2676, 1)]

      // the platform: stone slabs to its far edge, its lip over the water
      const floor = poly(c, [[-P0, -P0, 0], [P0, -P0, 0], [P0, P0, 0], [-P0, P0, 0]])
      const lip = poly(c, [[-P0, P0, 0], [P0, P0, 0], [P0, P0, -0.3], [-P0, P0, -0.3]]) + poly(c, [[-P0, -P0, 0], [-P0, P0, 0], [-P0, P0, -0.3], [-P0, -P0, -0.3]]) + poly(c, [[P0, -P0, 0], [P0, P0, 0], [P0, P0, -0.3], [P0, -P0, -0.3]])
      let joints = ''
      for (let k = -2; k <= 2; k++) { const q = seg(c, [-P0, k * 0.72, 0], [P0, k * 0.72, 0]); if (q) joints += stroke(q, 1, 0.1, 0.1, 0.4) }
      for (let k = -2; k <= 2; k++) { const q = seg(c, [k * 0.74 + 0.1, -P0, 0], [k * 0.74 + 0.1, P0, 0]); if (q) joints += stroke(q, 1, 0.1, 0.1, 0.4) }
      // slabs of slightly different stone, a little lighter toward the open side where the moon is
      const slabs: SVGElement[] = []
      const xs = [-P0, -1.38, -0.64, 0.1, 0.84, 1.58, P0], ys = [-P0, -1.44, -0.72, 0, 0.72, 1.44, P0]
      for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) {
        const d = poly(c, [[xs[a], ys[b], 0.001], [xs[a + 1], ys[b], 0.001], [xs[a + 1], ys[b + 1], 0.001], [xs[a], ys[b + 1], 0.001]])
        if (d) slabs.push(s('path', { class: `t26c-slab${r() < 0.5 ? ' dk' : ''}`, d, style: `opacity:${(0.03 + r() * 0.06).toFixed(2)}` }))
      }
      const moonLine = seg(c, [-P0, P0, 0], [P0, P0, 0])
      kids.push(s('path', { class: 't26c-lip', d: lip }), s('path', { class: 't26c-floor', d: floor }), ...slabs, s('path', { class: 't26c-joint', d: joints }),
        s('path', { class: 't26c-floorrim', d: moonLine ? stroke(moonLine, 1.4, 0.05, 0.05, 0.6) : '' }))

      // a post on its stone footing: the faces turned to you, lit on the moon's side (the moon is in front, low)
      const post = (X: number, Y: number) => {
        const faces: SVGElement[] = []
        const edges: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
        for (let e = 0; e < 4; e++) {
          const [ax, ay] = edges[e], [bx, by] = edges[(e + 1) % 4]
          const nx = (ax + bx) / 2, ny = (ay + by) / 2
          if ((c.e[0] - X) * nx + (c.e[1] - Y) * ny <= 0) continue // turned away
          faces.push(s('path', { class: ny < 0 ? 't26c-postlit' : 't26c-post', d: poly(c, [[X + ax * PW, Y + ay * PW, 0.1], [X + bx * PW, Y + by * PW, 0.1], [X + bx * PW, Y + by * PW, BEAM[0]], [X + ax * PW, Y + ay * PW, BEAM[0]]]) }))
        }
        const fw = PW * 1.9
        const foot = poly(c, [[X - fw, Y - fw, 0.12], [X + fw, Y - fw, 0.12], [X + fw, Y - fw, 0], [X - fw, Y - fw, 0]]) + poly(c, [[X - fw, Y - fw, 0.12], [X + fw, Y - fw, 0.12], [X + fw, Y + fw, 0.12], [X - fw, Y + fw, 0.12]])
        const contact = poly(c, [[X - fw * 1.6, Y - fw * 1.2, 0.002], [X + fw * 1.9, Y - fw * 1.2, 0.002], [X + fw * 2.2, Y + fw * 1.8, 0.002], [X - fw * 1.3, Y + fw * 1.8, 0.002]])
        // its shadow, long across the floor toward you and away from the low moon on the far right
        const cast = poly(c, [[X - PW, Y, 0.003], [X + PW, Y, 0.003], [X + PW - 0.55, Y - 1.7, 0.003], [X - PW - 0.55, Y - 1.7, 0.003]])
        const grain = [-0.7, -0.35, 0.05, 0.4, 0.72].map((o, k) => seg(c, [X + o * PW, Y - PW * 1.01, 0.15 + k * 0.07], [X + o * PW, Y - PW * 1.01, BEAM[0] - 0.08 - k * 0.1])).filter(Boolean).map((q, k) => stroke(q!, 0.8 + (k % 2) * 0.7, 0.2, 0.3, 0.2)).join('')
        const br = poly(c, [[X - PW * 1.5, Y - PW * 1.5, BEAM[0] - 0.13], [X + PW * 1.5, Y - PW * 1.5, BEAM[0] - 0.13], [X + PW * 1.5, Y - PW * 1.5, BEAM[0]], [X - PW * 1.5, Y - PW * 1.5, BEAM[0]]])
        return s('g', { class: 't26c-postg' }, s('path', { class: 't26c-cast', d: cast }), s('path', { class: 't26c-contact', d: contact }), ...faces, s('path', { class: 't26c-foot', d: foot }), s('path', { class: 't26c-grain', d: grain }), s('path', { class: 't26c-post', d: br }))
      }

      // the roof's underside: four facets from the edge up to the apex, boards across them, rafters under the boards
      const C4: V3[] = [[E, E, ZE], [E, -E, ZE], [-E, -E, ZE], [-E, E, ZE]] // far-right, near-right, near-left, far-left
      const apex: V3 = [0, 0, ZA]
      const roof: SVGElement[] = []
      const facets: [number, number, string][] = [[3, 0, 'f-far'], [0, 1, 'f-side'], [2, 3, 'f-side'], [1, 2, 'f-near']]
      for (const [a, b, cls] of facets) roof.push(s('path', { class: `t26c-facet ${cls}`, d: poly(c, [apex, C4[a], C4[b]]) }))
      let boards = ''
      for (const [a, b] of facets) {
        for (let k = 1; k < 10; k++) {
          const t = 0.14 + k * 0.088
          const q = seg(c, lerp3(apex, C4[a], t), lerp3(apex, C4[b], t))
          if (q) boards += stroke(q, 0.9, 0.1, 0.1, 0.4)
        }
      }
      roof.push(s('path', { class: 't26c-boards', d: boards }))
      const ap = proj(c, apex)
      roof.push(s('path', { d: poly(c, C4), fill: `url(#${id}-deep)` }))
      const bars: { d: number; els: SVGElement[] }[] = []
      const rafter = (e: V3, half: number, depth: number) => {
        const L = Math.hypot(e[0], e[1]), ux = e[0] / L, uy = e[1] / L, nx = -uy, ny = ux
        const s0: V3 = [ux * HOLE * 1.25, uy * HOLE * 1.25, ZA - 0.13]
        const off = (p: V3, o: number, dz: number): V3 => [p[0] + nx * o, p[1] + ny * o, p[2] - dz]
        const sd = (c.e[0] * nx + c.e[1] * ny) > 0 ? 1 : -1
        const under = poly(c, [off(s0, -half, depth), off(e, -half, depth), off(e, half, depth), off(s0, half, depth)])
        const face = poly(c, [off(s0, sd * half, 0), off(e, sd * half, 0), off(e, sd * half, depth), off(s0, sd * half, depth)])
        bars.push({ d: toCam(c, lerp3(s0, e, 0.5))[2], els: [s('path', { class: 't26c-rface', d: face }), s('path', { class: 't26c-runder', d: under })] })
      }
      for (let i = 0; i < 4; i++) {
        const a = C4[i], b = C4[(i + 1) % 4]
        for (let k = 1; k < 8; k++) rafter(lerp3(a, b, k / 8), 0.042, 0.08)
        rafter(a, 0.08, 0.14)
      }
      bars.sort((x, y) => y.d - x.d)
      roof.push(...bars.flatMap((b) => b.els))
      for (let i = 0; i < 4; i++) {
        const a = C4[i], b = C4[(i + 1) % 4]
        roof.push(s('path', { class: 't26c-fascia', d: poly(c, [a, b, [b[0], b[1], b[2] - 0.13], [a[0], a[1], a[2] - 0.13]]) }))
      }
      let lipD = ''
      for (let i = 0; i < 4; i++) { const q = seg(c, [C4[i][0], C4[i][1], ZE - 0.13], [C4[(i + 1) % 4][0], C4[(i + 1) % 4][1], ZE - 0.13]); if (q) lipD += stroke(q, 1.6, 0.05, 0.05, 0.6) }
      roof.push(s('path', { class: 't26c-eaverim', d: lipD }))

      // the eave beams, resting on the posts' brackets: underside, the two faces, the face toward you lit by the moon
      const beamPart = (a: V3, b: V3, front: boolean) => {
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L
        const nx = -uy * 0.1, ny = ux * 0.1
        const [z0, z1] = BEAM
        const o = (p: V3, k: number, z: number): V3 => [p[0] + nx * k, p[1] + ny * k, z]
        const faces = [-1, 1].filter((k) => (c.e[0] - a[0]) * nx * k + (c.e[1] - a[1]) * ny * k > 0)
        return [s('path', { class: 't26c-bunder', d: poly(c, [o(a, -1, z0), o(b, -1, z0), o(b, 1, z0), o(a, 1, z0)]) }),
          ...faces.map((k) => s('path', { class: front ? 't26c-bfront' : 't26c-binner', d: poly(c, [o(a, k, z0), o(b, k, z0), o(b, k, z1), o(a, k, z1)]) }))]
      }
      const ext = 0.3 // beam ends run past the posts
      const farBeam = beamPart([-A - ext, A, 0], [A + ext, A, 0], false)
      const sideBeams = [beamPart([-A, -A - ext, 0], [-A, A + ext, 0], false), beamPart([A, -A - ext, 0], [A, A + ext, 0], false)]
      const nearBeam = beamPart([-A - ext, -A, 0], [A + ext, -A, 0], true)

      // the question carved on a board (gaku) hung from the front beam: a frame, the panel, the words in a groove
      const bc = proj(c, [0, -A - 0.1, BEAM[0]])
      const bScale = c.f / toCam(c, [0, -A - 0.1, BEAM[0]])[2] // px per metre at the board
      const words = S.question
      // the board fits between the front posts: one line if it reads at 13 px or more, else two, split at the dash
      const room = (proj(c, [A - PW * 2, -A, BEAM[0]])[0] - proj(c, [-A + PW * 2, -A, BEAM[0]])[0]) * 0.8
      const fitAt = (ls: string[]) => room / (Math.max(...ls.map((l) => [...l].length)) * 0.52 + 2.4)
      const split = (() => { const cut = words.includes('—') ? words.indexOf('—') + 1 : words.lastIndexOf(' ', Math.floor(words.length / 2)); return [words.slice(0, cut).trim(), words.slice(cut).trim()] })()
      const lines = fitAt([words]) >= 13 ? [words] : split
      const fs = clamp(Math.min(bScale * 0.075, fitAt(lines)), 10.5, 17)
      const bw = Math.max(...lines.map((l) => [...l].length)) * fs * 0.52 + fs * 2.4
      const bh = lines.length * fs * 1.35 + fs * 1.3
      const by = bc[1] + bScale * 0.06
      const board = s('g', { class: 't26c-board' },
        s('path', { class: 't26c-bcord', d: `M${f1(bc[0] - bw * 0.32)} ${f1(bc[1] - 2)}L${f1(bc[0] - bw * 0.36)} ${f1(by)}M${f1(bc[0] + bw * 0.32)} ${f1(bc[1] - 2)}L${f1(bc[0] + bw * 0.36)} ${f1(by)}` }),
        s('rect', { class: 't26c-bframe', x: f1(bc[0] - bw / 2), y: f1(by), width: f1(bw), height: f1(bh), rx: 2 }),
        s('rect', { class: 't26c-bpanel', x: f1(bc[0] - bw / 2 + fs * 0.35), y: f1(by + fs * 0.35), width: f1(bw - fs * 0.7), height: f1(bh - fs * 0.7) }),
        s('path', { class: 't26c-bgrain', d: [0.3, 0.55, 0.8].map((k) => stroke([[bc[0] - bw / 2 + fs * 0.5, by + bh * k], [bc[0] + bw / 2 - fs * 0.5, by + bh * k + 0.6]], 0.8, 0.1, 0.1, 0.3)).join('') }),
        s('path', { class: 't26c-brim', d: stroke([[bc[0] - bw / 2 + 2, by + bh - 1], [bc[0] + bw / 2 - 2, by + bh - 1]], 1.4, 0.05, 0.05, 0.6) }),
        ...lines.map((l, i) => s('text', { class: 't26c-q', x: f1(bc[0]), y: f1(by + fs * 0.65 + fs * 1.35 * (i + 0.78)), 'text-anchor': 'middle', style: `font-size:${f1(fs)}px` }, l)))

      // the balance beam: a bamboo pole on a cord from the smoke hole, a hook at each end (screen, tipped by CSS)
      pivot = proj(c, PIVOT)
      endL = proj(c, [-ARM, 0, PIVOT[2]])
      endR = proj(c, [ARM, 0, PIVOT[2]])
      const top = proj(c, [0, 0, ZA - 0.1])
      const thick = clamp((c.f * 0.05) / toCam(c, PIVOT)[2], 6, 13)
      let nodes = ''
      for (const t of [0.12, 0.34, 0.66, 0.88]) {
        const x = endL[0] + (endR[0] - endL[0]) * t, y = endL[1] + (endR[1] - endL[1]) * t
        nodes += stroke([[x, y - thick * 0.5], [x + 0.6, y + thick * 0.5]], 1.5, 0.1, 0.1, 0.6)
      }
      const hookD = (e: Pt, dir: number) => stroke(curve([e[0], e[1] + thick * 0.3], [e[0] + dir * 2, e[1] + thick * 1.9], [e[0] - dir * thick * 0.6, e[1] + thick * 1.4], 8), 1.8, 0.1, 0.2, 0.5)
      beamG.replaceChildren(
        s('path', { class: 't26c-pole', d: stroke([[endL[0] - thick * 0.8, endL[1]], [pivot[0], pivot[1]], [endR[0] + thick * 0.8, endR[1]]], thick, 0.06, 0.06, 0.75) }),
        s('path', { class: 't26c-polehi', d: stroke([[endL[0], endL[1] + thick * 0.18], [endR[0], endR[1] + thick * 0.18]], thick * 0.2, 0.2, 0.2, 0.3) }),
        s('path', { class: 't26c-node', d: nodes }),
        s('path', { class: 't26c-hook', d: hookD(endL, 1) + hookD(endR, -1) }),
        // the halo at each hook: where a lantern goes (H3)
        s('circle', { class: 't26c-hookglow', cx: f1(endL[0]), cy: f1(endL[1] + thick * 1.4), r: f1(thick * 3.4), fill: `url(#${id}-moonglow)` }),
        s('circle', { class: 't26c-hookglow', cx: f1(endR[0]), cy: f1(endR[1] + thick * 1.4), r: f1(thick * 3.4), fill: `url(#${id}-moonglow)` }),
        s('path', { class: 't26c-binding', d: stroke([[pivot[0] - thick * 0.9, pivot[1] - thick * 0.5], [pivot[0] + thick * 0.9, pivot[1] + thick * 0.5]], 2.2, 0.1, 0.1, 0.6) + stroke([[pivot[0] - thick * 0.9, pivot[1] + thick * 0.5], [pivot[0] + thick * 0.9, pivot[1] - thick * 0.5]], 2.2, 0.1, 0.1, 0.6) }))
      // the warm light a hung lantern throws on the rafters round its end, and round the hooks they start on
      const warm = [endL, endR].map((e, i) => s('circle', { class: `t26c-warm w${i}`, cx: f1(e[0]), cy: f1(e[1] + thick * 4), r: f1(Math.min(W, Hs) * 0.24), fill: `url(#${id}-w)` }))

      svg.replaceChildren(
        s('defs', null,
          s('radialGradient', { id: `${id}-w` }, s('stop', { offset: 0, style: 'stop-color:var(--lantern);stop-opacity:.5' }), s('stop', { offset: 0.5, style: 'stop-color:var(--lantern);stop-opacity:.14' }), s('stop', { offset: 1, style: 'stop-color:var(--lantern);stop-opacity:0' })),
          s('radialGradient', { id: `${id}-moonglow` }, s('stop', { offset: 0, style: 'stop-color:var(--moon);stop-opacity:.6' }), s('stop', { offset: 1, style: 'stop-color:var(--moon);stop-opacity:0' })),
          s('radialGradient', { id: `${id}-deep`, cx: f1(ap[0]), cy: f1(ap[1]), r: f1(Math.max(W, Hs) * 0.45), gradientUnits: 'userSpaceOnUse' }, s('stop', { offset: 0, style: 'stop-color:var(--umbra);stop-opacity:.6' }), s('stop', { offset: 0.6, style: 'stop-color:var(--umbra);stop-opacity:.15' }), s('stop', { offset: 1, style: 'stop-color:var(--umbra);stop-opacity:0' }))),
        ...kids,
        // far to near: the far posts, the roof seen from below, the far and side beams, the warm light, the cord and the
        // balance beam, then the front beam with its board and the front posts
        post(-A, A), post(A, A),
        s('g', { class: 't26c-roof' }, ...roof),
        ...farBeam, ...sideBeams.flat(),
        ...warm,
        s('ellipse', { class: 't26c-allwarm', cx: f1(pivot[0]), cy: f1(pivot[1] - Hs * 0.08), rx: f1(W * 0.3), ry: f1(Hs * 0.3), fill: `url(#${id}-w)` }),
        s('path', { class: 't26c-rope', d: stroke([top, [pivot[0] + 0.5, (top[1] + pivot[1]) / 2], pivot], 1.6, 0.05, 0.05, 0.7) }),
        beamG,
        ...nearBeam, board,
        post(-A, -A), post(A, -A))
      lampR = (c.f * LAMP) / toCam(c, PIVOT)[2]
      lamps.forEach((_, i) => place(i))
      placeBeam()
      placeStrip()
      g.refresh()
    }
    ctx.onCleanup(onSize(ctx.art, paint))

    // ── guidance: a dot on each lantern not yet heard, the count on a tag under the beam's binding, a nudge when idle
    const dots = lamps.map((b) => g.dot(b, { dir: [0, -1] }))
    const count = g.count(S.count, n, () => [pivot[0], pivot[1] + Math.max(26, lampR * 1.7)])
    count.el.classList.add('t26c-count')
    const onIdle = () => {
      if (heard.size === n || ctx.reduced) return
      beamG.animate([{ rotate: '0deg' }, { rotate: '1.6deg' }, { rotate: '-1.2deg' }, { rotate: '0deg' }], { duration: 1600, easing: 'ease-in-out', composite: 'add' })
    }
    ctx.el.addEventListener('p2:idle', onIdle)
    ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', onIdle))
    ctx.onCleanup(onDigit((d) => d <= n && hear(d - 1)))

    function hear(i: number) {
      if (!cam) return
      const first = !heard.has(i)
      heard.add(i)
      if (active >= 0) lamps[active].classList.remove('speaking')
      active = i
      const st = stones[i]
      lamps.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)))
      lamps[i].setAttribute('aria-label', fill(S.lampHeard, { n: i + 1, who: st.who }))
      lamps[i].classList.add('lit', 'speaking')
      dots[i].done()
      // the strip unrolls under it: who, and their reason
      strip.replaceChildren(h('p', { class: 't26c-who' }, st.who), ctx.fact(F(st.view), 'p', 't26c-view'))
      const firstFill = strip.hidden
      strip.hidden = false
      if (firstFill) strip.setAttribute('aria-live', 'polite')
      if (!ctx.reduced) strip.animate([{ clipPath: 'inset(0 0 100% 0)', rotate: '-3deg' }, { clipPath: 'inset(0 0 0 0)', rotate: '2deg', offset: 0.6 }, { clipPath: 'inset(0 0 0 0)', rotate: '0deg' }], { duration: 1100, easing: 'ease-out' })
      if (first) {
        // carried to the end its reason belongs to: the second lantern on an end hangs a hand's width in
        at[i] = 'beam'
        slot[i] = stones.filter((_, j) => j !== i && at[j] === 'beam' && side[j] === side[i]).length ? 1 : 0
        root.classList.toggle(`w${side[i]}`, true)
        lamps.forEach((_, j) => at[j] === 'beam' && place(j))
        placeBeam()
        count.set(heard.size)
      }
      placeStrip()
      ctx.chime(first ? 'soft' : 'tap')
      if (heard.size === n && !root.classList.contains('all')) {
        root.classList.add('all')
        // the reasons are hung: the strips roll up, the beam settles level, the light warms the whole ceiling
        setTimeout(() => {
          if (!root.isConnected) return
          strip.hidden = true
          lamps.forEach((b) => b.classList.remove('speaking'))
          active = -1
        }, ctx.reduced ? 0 : 2600)
        count.done()
        ctx.insight(F(S.perspectives.common))
        ctx.chime('ok')
      } else if (heard.size < n) ctx.prompt(fill(S.promptNext, { n: n - heard.size }))
    }
  },
}
