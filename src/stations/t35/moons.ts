import './moons.css'
import { fill, h, s, viDate } from '../../core/dom'
import type { Fact } from '../../core/content'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import { blob, clamp, curve, onSize, rng, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist, moon, reeds } from '../../ui/part2/paint'
import type { Tide } from '../../ui/part2/types'
import type { SceneCtx } from '../types'
import { C } from './content'
import { F, P, drift, f1, gdefs, ink } from './kit'

const K = C.scenes.moons
const T = K.tide as Tide
const MS = T.milestones
const N = MS.length // the last milestone is today
const PV = [0.07, 0.2, 0.34, 0.5, 0.66, 0.82] // depth of each milestone post along the path (0 near … 1 horizon)
// the path's line across the field (u: −1 left … 1 right) at depths v: it enters cut by the bottom-left corner, swings
// right, back left, and fades into the mist in the middle of the horizon
const KNOTS: Pt[] = [[-0.08, -1.3], [0.1, -0.6], [0.26, 0.35], [0.42, 0.85], [0.58, 0.35], [0.74, -0.55], [0.88, -0.25], [1.02, 0]]

/**
 * Scene 3 — a wide moss field under the moon, seen from about 35°. A faint trail of single footprints enters at the
 * bottom-left corner, swings in an S past six stone posts (each with a carved ink sign: a bridge, a fork, a carpenter's
 * square, a scroll, a rack of scrolls, a crowd of lanterns) and fades into the mist in the middle of the horizon. The
 * moon is the key light: drag it along its ink arc — it waxes from crescent to full, the posts' long shadows swing with
 * it — and as it passes each post the post lights, its date and fact are written on the moss, and the trail paves
 * itself stone by stone up to it. Today: many walk it with lanterns; beyond, the way runs on into the mist (a forecast).
 * Reduced motion / low: the moon jumps from post to post, every change is instant.
 */
export function moonsScene(ctx: SceneCtx) {
  gdefs()
  const still = ctx.reduced || ctx.quality === 'low'
  const sky = s('svg', { class: 't35m-sky', 'aria-hidden': 'true' })
  const field = s('svg', { class: 't35m-field', 'aria-hidden': 'true' })
  const shades = s('svg', { class: 't35m-field t35m-shades', 'aria-hidden': 'true' })
  const stand = s('svg', { class: 't35m-field t35m-stand', 'aria-hidden': 'true' })
  const shadow = s('circle', { fill: '#000' })
  // the moon: its glow sits outside the phase mask (a glow clipped by the mask would show its square)
  const disc = s('svg', { class: 't35m-disc', viewBox: '-48 -48 96 96', 'aria-hidden': 'true' },
    s('circle', { class: 't35m-glow-sky', r: 48, fill: 'url(#p2-halo)' }),
    s('mask', { id: 't35m-phase', maskUnits: 'userSpaceOnUse', x: -48, y: -48, width: 96, height: 96 }, s('rect', { x: -48, y: -48, width: 96, height: 96, fill: '#fff' }), shadow),
    s('circle', { class: 't35m-dark', r: 31 }),
    s('g', { mask: 'url(#t35m-phase)' }, moon(0, 0, 30, 356, false)))
  const label = (i: number) => `${viDate(MS[i].date)} · ${MS[i].label}`
  const thumb = h('div', {
    class: 't35m-moon', role: 'slider', tabindex: '0', 'aria-label': K.label,
    'aria-valuemin': '1', 'aria-valuemax': String(N), 'aria-valuenow': '1', 'aria-valuetext': fill(K.sliderAria, { n: 1, total: N, label: label(0) }),
  }, disc)
  // the milestone is written on the moss; the forecast lies in the mist where the way fades out
  const card = h('div', { class: 't35m-card' })
  const horizon = h('div', { class: 't35m-horizon' }, ctx.fact(T.horizon as Fact, 'p'))
  const root = h('div', { class: `t35 t35m${still ? ' still' : ''}` },
    h('p', { class: 'visually-hidden' }, K.art), sky, field, shades, stand, horizon, card, thumb)
  ctx.art.append(root)
  ctx.prompt(K.prompt)
  const par = drift(ctx, root, [[sky, 4, 2], [field, 10, 3], [shades, 10, 3], [stand, 12, 3]])

  let W = 0, H = 0, hy = 0, port = false
  let arc: Pt[] = [] // the moon's way across the sky, 97 samples
  let posts: { x: number; y: number; h: number; el: SVGPathElement }[] = []
  let at = -1, t = 0, tt = 0 // the milestone shown, where the moon is, where it is going
  let reached = false

  function show(i: number) {
    if (i === at) return
    at = i
    root.dataset.at = String(i)
    for (let k = 0; k < N; k++) root.classList.toggle(`p${k}`, k <= i)
    thumb.setAttribute('aria-valuenow', String(i + 1))
    thumb.setAttribute('aria-valuetext', fill(K.sliderAria, { n: i + 1, total: N, label: label(i) }))
    card.replaceChildren(h('p', { class: 't35m-when' }, label(i)), ctx.fact(MS[i].fact as Fact, 'p', 't35m-fact'))
    if (!card.hasAttribute('aria-live')) card.setAttribute('aria-live', 'polite')
    if (i > 0) ctx.chime(i === N - 1 ? 'ok' : 'soft')
    if (i === N - 1 && !reached) {
      reached = true
      ctx.insight(F(K.insight), K.detail)
    }
  }
  /** The moon is the key light: every post's shadow runs away from it, longer as it sinks. */
  function castShadows(mx: number, my: number) {
    const low = clamp((my - hy * 0.1) / (hy * 0.9), 0, 1)
    for (const p of posts) {
      const dx = p.x - mx, dy = p.y - my
      const L = Math.hypot(dx, dy) || 1
      const len = p.h * (1.3 + low * 1.6)
      const ex = p.x + (dx / L) * len, ey = p.y + (dy / L) * len * 0.42
      const w = p.h * 0.16
      p.el.setAttribute('d', `M${f1(p.x - w)} ${f1(p.y)}Q${f1((p.x + ex) / 2 - w * 0.6)} ${f1((p.y + ey) / 2)} ${f1(ex)} ${f1(ey)}Q${f1((p.x + ex) / 2 + w * 0.6)} ${f1((p.y + ey) / 2 + w * 0.2)} ${f1(p.x + w)} ${f1(p.y + 1)}Z`)
    }
  }
  function moveTo(v: number, snap: boolean) {
    if (!arc.length) return
    t = clamp(v, 0, 1)
    const near = Math.round(t * (N - 1))
    if (snap || still) t = near / (N - 1)
    const [x, y] = arc[Math.round(t * 96)]
    thumb.style.transform = `translate3d(${f1(x)}px, ${f1(y)}px, 0)`
    // the moon waxes from a thin crescent to full as it nears today
    shadow.setAttribute('cx', f1(-64 * (0.12 + 0.88 * t)))
    shadow.setAttribute('r', '32')
    castShadows(x, y)
    show(near)
  }
  const loop = createLoop(root, (_t, dt) => {
    const f = dt > 0 ? 1 - Math.exp(-dt * 6) : 1
    const v = t + (tt - t) * f
    moveTo(Math.abs(tt - v) < 0.002 ? tt : v, false)
    return Math.abs(tt - t) > 0.002
  }, { essential: true })
  const glide = (v: number) => {
    tt = clamp(v, 0, 1)
    if (still) return moveTo(tt, true)
    loop.start()
  }

  // drag the moon along its arc (anywhere in the sky works); release settles on the nearest post
  const tAt = (x: number, y: number) => {
    let best = 0, bd = Infinity
    arc.forEach(([ax, ay], k) => {
      const d = (ax - x) ** 2 + (ay - y) ** 2
      if (d < bd) (bd = d), (best = k)
    })
    return best / 96
  }
  let drag = -1, ox = 0, oy = 0
  root.addEventListener('pointerdown', (e) => {
    if (e.button || !arc.length) return
    const b = root.getBoundingClientRect()
    ox = b.left
    oy = b.top
    if (e.clientY - oy > hy + H * 0.06 && e.target !== thumb && !thumb.contains(e.target as Node)) return
    drag = e.pointerId
    root.setPointerCapture(e.pointerId)
    thumb.focus({ preventScroll: true })
    glide(tAt(e.clientX - ox, e.clientY - oy))
  })
  root.addEventListener('pointermove', (e) => e.pointerId === drag && glide(tAt(e.clientX - ox, e.clientY - oy)))
  const end = (e: PointerEvent) => {
    if (e.pointerId !== drag) return
    drag = -1
    glide(Math.round(tt * (N - 1)) / (N - 1))
  }
  root.addEventListener('pointerup', end)
  root.addEventListener('pointercancel', end)
  thumb.addEventListener('keydown', (e) => {
    const k = ({ ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 } as Record<string, number>)[e.key]
    const to = k ? clamp(at + k, 0, N - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? N - 1 : -1
    if (to < 0) return
    e.preventDefault()
    glide(to / (N - 1))
  })

  let job: { cancel(): void } | null = null
  let first = true
  function layout() {
    W = root.clientWidth
    H = root.clientHeight
    if (W < 60 || H < 60) return
    port = W < H * 0.8
    root.classList.toggle('port', port)
    hy = H * (port ? 0.25 : 0.32)
    job?.cancel()
    job = sliced(paint(), { sync: ctx.reduced || !first })
    first = false
    par.resize()
  }

  /** Ground point (u across, v 0 near … 1 at the horizon) → screen, and its scale. */
  const spread = () => W * (port ? 0.9 : 0.66)
  // on a phone the near moss below the field is kept plain: the words go there
  const near = () => H * (port ? 0.72 : 1.06)
  const proj = (u: number, v: number): [number, number, number] => {
    const k = 1 / (1 + v * 6)
    return [W / 2 + u * spread() * k, hy + (near() - hy) * k, k]
  }
  /** The path's centre line at depth v (Catmull-Rom through the knots). */
  const mid = (v: number) => {
    let i = 0
    while (i < KNOTS.length - 2 && KNOTS[i + 1][0] < v) i++
    const p0 = KNOTS[Math.max(0, i - 1)], p1 = KNOTS[i], p2 = KNOTS[i + 1], p3 = KNOTS[Math.min(KNOTS.length - 1, i + 2)]
    const q = clamp((v - p1[0]) / (p2[0] - p1[0]), 0, 1), q2 = q * q, q3 = q2 * q
    return 0.5 * (2 * p1[1] + (p2[1] - p0[1]) * q + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * q2 + (3 * p1[1] - p0[1] - 3 * p2[1] + p3[1]) * q3)
  }
  const halfW = (v: number) => 0.13 * (1 - v * 0.3) // the way, in u: a little narrower far off (beyond perspective)

  function* paint() {
    // sky: the moon's arc as a faint ink stroke across the whole sky, far ridges on the horizon, banks of mist
    // keep the whole moon (92 / 74 px) inside the frame with a 16 px margin: the arc never rises above m
    const m = port ? 53 : 62
    const A: Pt = [m, Math.max(m + 10, hy - m * 0.35)], B: Pt = [W - m, m + 4], Cc: Pt = [W * 0.42, m]
    arc = curve(A, Cc, B, 96)
    const full = curve([A[0] - W * 0.08, A[1] + hy * 0.12], [Cc[0], Cc[1] - 10], [W + 20, B[1] - 6], 40)
    sky.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    sky.replaceChildren(
      mist(W * 0.5, hy * 0.62, W * 0.62, hy * 0.5),
      ink(stroke(full, port ? 2 : 2.6, 0.15, 0.15, 0.2), 't35m-track', 'rough'),
      hills(-W * 0.1, W * 1.1, hy + 2, H * 0.13, 357, 0.95, 7),
      hills(-W * 0.2, W * 0.4, hy + 6, H * 0.16, 358, 0.66, 2),
      hills(W * 0.6, W * 1.2, hy + 6, H * 0.12, 359, 0.7, 2),
      mist(W * 0.5, hy + 4, W * 0.8, H * 0.05))
    yield
    // the field: a ground that rises and dips (light and dark washes across it), tufts that shrink with distance, reeds
    const r = rng(360)
    let tufts = '', hollows = '', rises = ''
    for (let k = 0; k < 340; k++) {
      const v = Math.pow(r(), 0.7), u = (r() - 0.5) * 3.4
      const [x, y, sc] = proj(u, v)
      if (y < hy + 2) continue
      const len = 30 * sc * (0.6 + r())
      tufts += stroke([[x, y], [x + len * (r() - 0.5) * 0.6, y - len]], Math.max(0.6, 3.2 * sc), 0.1, 0.7, 0.1)
      if (k % 11 === 0) tufts += stroke([[x + 3, y], [x + 3 + len * 0.3, y - len * 1.3]], Math.max(0.6, 2.6 * sc), 0.1, 0.7, 0.1)
    }
    for (let k = 0; k < 9; k++) {
      const v = 0.04 + (k / 9) * 0.8, u = (r() - 0.5) * 2.4
      const [x, y, sc] = proj(u, v)
      hollows += blob(x, y, W * (0.25 + r() * 0.2) * sc * 2, (H - hy) * 0.06 * sc * 3, 361 + k, 0.3, 14)
      const [x2, y2, sc2] = proj(u + (r() - 0.5), v + 0.04)
      rises += blob(x2, y2, W * (0.2 + r() * 0.2) * sc2 * 2, (H - hy) * 0.04 * sc2 * 3, 371 + k, 0.3, 14)
    }
    const clumps: SVGElement[] = []
    for (let k = 0; k < 9; k++) {
      const v = Math.pow(r(), 1.4) * 0.6, side2 = r() < 0.5 ? -1 : 1
      const u = mid(v) + side2 * (halfW(v) + 0.12 + r() * 0.6)
      const [x, y, sc] = proj(u, v)
      clumps.push(s('g', { class: 't35m-reedg' }, reeds(x, y, H * 0.28 * sc * (0.7 + r() * 0.6), 380 + k, 4 + Math.floor(r() * 4))))
    }
    // the way: per stretch, a worn trail of single footprints and its paved twin — flagstones in three tones, moss in
    // the joints, smaller with distance (shown once the moon has passed that stretch)
    const segs: SVGElement[] = []
    const vs = [0, ...PV, 1]
    for (let k = 0; k < vs.length - 1; k++) {
      const v0 = vs[k] - (k ? 0 : 0.08), v1 = vs[k + 1]
      let prints = '', bed = ''
      const tone = ['', '', '']
      const L: Pt[] = [], R: Pt[] = []
      const n = Math.max(8, Math.round((v1 - v0) * 70))
      for (let j = 0; j <= n; j++) {
        const v = v0 + ((v1 - v0) * j) / n
        const [xl, yl] = proj(mid(v) - halfW(v), v), [xr, yr] = proj(mid(v) + halfW(v), v)
        L.push([xl, yl])
        R.push([xr, yr])
        if (j % 2 === 0 && j < n) {
          const side2 = (j / 2) % 2 ? 1 : -1
          const [x, y, sc] = proj(mid(v) + side2 * halfW(v) * 0.25, v)
          prints += blob(x, y, 20 * sc, 8 * sc, 362 + k * 40 + j, 0.2, 8)
        }
      }
      bed = `M${L.map(P).join('L')}L${R.reverse().map(P).join('L')}Z`
      // rows of flagstones laid in perspective: each row about one stone deep, two or three across, joints of moss
      let v = v0
      let row = 0
      while (v < v1) {
        const [, , sc] = proj(0, v)
        const dv = Math.min(v1 - v, (10 + r() * 5) / ((near() - hy) * sc))
        if (dv < 0.002) break
        const across = row % 3 === 1 ? 1 : 2
        const cut = across === 1 ? [0, 1] : [0, 0.35 + r() * 0.3, 1]
        for (let c = 0; c < across; c++) {
          const a = cut[c], b = cut[c + 1]
          const g = 0.06 // the joint
          const corner = (fu: number, fv: number): Pt => {
            const vv = v + dv * fv
            const [x, y] = proj(mid(vv) - halfW(vv) + (fu + (r() - 0.5) * 0.04) * halfW(vv) * 2, vv)
            return [x, y]
          }
          const q = [corner(a + g / across, 0.1), corner(b - g / across, 0.1), corner(b - g / across, 0.84), corner(a + g / across, 0.84)]
          const lp = (p: Pt, o: Pt, f: number): Pt => [p[0] + (o[0] - p[0]) * f, p[1] + (o[1] - p[1]) * f]
          let d = ''
          for (let e = 0; e < 4; e++) {
            const p0 = q[e], p1 = q[(e + 1) % 4], p2 = q[(e + 2) % 4]
            d += `${e ? 'L' : 'M'}${P(lp(p0, p1, 0.18))}L${P(lp(p0, p1, 0.82))}Q${P(p1)} ${P(lp(p1, p2, 0.18))}`
          }
          tone[Math.floor(r() * 3)] += d + 'Z'
        }
        v += dv
        row++
      }
      segs.push(s('g', { class: `t35m-seg t35m-seg-${k}` },
        s('path', { class: 't35m-trail', d: prints, filter: 'url(#ink-wash)' }),
        s('g', { class: 't35m-paved' },
          s('path', { class: 't35m-bed', d: bed, filter: 'url(#ink-wash)' }),
          s('path', { class: 't35m-flag f0', d: tone[0], filter: 'url(#ink-rough)' }),
          s('path', { class: 't35m-flag f1', d: tone[1], filter: 'url(#ink-rough)' }),
          s('path', { class: 't35m-flag f2', d: tone[2], filter: 'url(#ink-rough)' }))))
    }
    field.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    field.replaceChildren(
      s('linearGradient', { id: 't35m-ground', x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, class: 't35m-g0' }), s('stop', { offset: 0.22, class: 't35m-g1' }), s('stop', { offset: 1, class: 't35m-g2' })),
      s('rect', { class: 't35m-moss', x: 0, y: f1(hy - 2), width: f1(W), height: f1(H - hy + 2), fill: 'url(#t35m-ground)' }),
      s('path', { class: 't35m-hollow', d: hollows, filter: 'url(#ink-wash)' }),
      s('path', { class: 't35m-rise', d: rises, filter: 'url(#ink-wash)' }),
      s('path', { class: 't35m-tuft', d: tufts }),
      ...segs,
      // past today the way runs on into the mist: a forecast, not a fact
      s('path', { class: 't35m-beyond', d: stroke(Array.from({ length: 12 }, (_, j) => { const v2 = 0.82 + j * 0.017; return proj(mid(v2), v2).slice(0, 2) as Pt }), Math.max(1.5, 26 * proj(0, 0.9)[2]), 0.1, 0.8, 0.2), filter: 'url(#ink-wash)' }),
      mist(W * 0.5, hy + (H - hy) * 0.04, W * 0.62, (H - hy) * 0.07),
      ...clumps)
    yield
    // the posts, near (first) to far (today), on alternate sides of the path, each with its carved sign; their long
    // shadows (cast from the moon) on their own layer, so moving the moon redraws only those
    posts = []
    const postEls: SVGElement[] = []
    const shadeEls: SVGElement[] = []
    for (let i = 0; i < N; i++) {
      const v = PV[i]
      const side2 = i % 2 ? -1 : 1
      const [x, y, sc] = proj(mid(v) + side2 * (halfW(v) + (port ? 0.42 : 0.3)), v)
      const ph = H * (port ? 0.4 : 0.56) * sc, pw = ph * 0.46
      const el = s('path', { class: `t35m-shadow t35m-shadow-${i}` })
      shadeEls.push(el)
      posts.push({ x, y, h: ph, el })
      const sg = sign(i)
      postEls.push(s('g', { class: `t35m-post t35m-post-${i}`, transform: `translate(${f1(x)} ${f1(y)})` },
        s('circle', { class: 't35m-halo', cx: 0, cy: f1(-ph * 0.6), r: f1(ph * 0.95), fill: 'url(#p2-halo)' }),
        stoneArt(pw, ph, 390 + i, 'p2-stone t35m-stone'),
        // the sign is carved: a lit lower lip under the dark groove
        s('g', { transform: `translate(${f1(-pw * 0.02)} ${f1(-ph * 0.52)}) scale(${f1(pw * 0.6)})` },
          s('path', { class: 't35m-sign-lip', d: sg, transform: `translate(${f1(0.05)} ${f1(0.06)})` }),
          ink(sg, 't35m-sign', 'rough'))))
    }
    // the walkers who come once the way is known: two at Skills, a few more with the open standard, a crowd today
    const walkers: SVGElement[] = []
    const rw = rng(377)
    for (let k = 0; k < 18; k++) {
      const from = k < 2 ? 3 : k < 6 ? 4 : 5
      const v = clamp(0.02 + rw() * PV[from] * 1.02, 0.02, 0.84)
      const [x, y, sc] = proj(mid(v) + (rw() - 0.5) * halfW(v) * 1.3, v)
      const u = 80 * sc * (port ? 0.8 : 1)
      walkers.push(s('g', { class: `t35m-walker w${from}`, transform: `translate(${f1(x)} ${f1(y)})`, style: `--d:${(rw() * 0.8).toFixed(2)}s` },
        s('ellipse', { class: 't35k-contact', cx: 0, cy: 0, rx: f1(u * 0.32), ry: f1(u * 0.06) }),
        s('path', { class: 't35m-robe', d: `M${f1(-u * 0.16)} 0L${f1(-u * 0.05)} ${f1(-u * 0.62)}L${f1(u * 0.07)} ${f1(-u * 0.62)}L${f1(u * 0.17)} 0Z` }),
        s('circle', { class: 't35m-robe', cx: f1(u * 0.01), cy: f1(-u * 0.72), r: f1(u * 0.1) }),
        s('path', { class: 't35m-cordline', d: `M${f1(u * 0.1)} ${f1(-u * 0.45)}L${f1(u * 0.32)} ${f1(-u * 0.5)}L${f1(u * 0.32)} ${f1(-u * 0.36)}` }),
        s('circle', { class: 't35m-glow', cx: f1(u * 0.32), cy: f1(-u * 0.3), r: f1(u * 0.5), fill: 'url(#t35k-pool)' }),
        s('ellipse', { class: 't35m-lamp', cx: f1(u * 0.32), cy: f1(-u * 0.3), rx: f1(u * 0.07), ry: f1(u * 0.09) })))
    }
    shades.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    shades.replaceChildren(...shadeEls)
    stand.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    stand.replaceChildren(
      ...postEls.reverse(),
      ...walkers,
      mist(W * 0.5, H * 1.02, W * 0.7, H * 0.08),
      ink(grass(W * 0.03, H + 4, H * 0.3, 363).getAttribute('d')! + grass(W * 0.97, H + 6, H * 0.26, 364).getAttribute('d')!, 't35m-near', 'wash'))
    // where the words lie: on the open moss in front (wide frame) or in the strip along the bottom (phone);
    // the forecast in the mist where the way fades out
    if (port) {
      Object.assign(card.style, { left: '5%', right: '5%', width: 'auto', top: 'auto', bottom: `${f1(H * 0.03)}px` })
      Object.assign(horizon.style, { left: '5%', right: 'auto', width: '64%', top: 'auto', bottom: `${f1(H - hy + 6)}px` })
    } else {
      const cw = clamp(W * 0.27, 280, 380)
      Object.assign(card.style, { left: `${f1(W * 0.94 - cw)}px`, right: 'auto', width: `${f1(cw)}px`, top: `${f1(H * 0.66)}px`, bottom: 'auto' })
      const hw = clamp(W * 0.3, 280, 420)
      const [fx] = proj(mid(0.95), 0.95)
      Object.assign(horizon.style, { left: `${f1(clamp(fx - hw / 2, W * 0.05, W * 0.95 - hw))}px`, right: 'auto', width: `${f1(hw)}px`, top: `${f1(hy - H * 0.085)}px`, bottom: 'auto' })
    }
    moveTo(at < 0 ? 0 : at / (N - 1), true)
  }

  ctx.onCleanup(onSize(root, layout))
  ctx.onCleanup(() => {
    job?.cancel()
    loop.dispose()
  })
}

/** The ink sign on post i, in a unit box centred on 0, 0 (path data). */
function sign(i: number): string {
  const w = 0.16
  const arcPts = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number): Pt[] =>
    Array.from({ length: 13 }, (_, k) => { const a = a0 + ((a1 - a0) * k) / 12; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as Pt })
  if (i === 0) // a bridge joining two banks (MCP)
    return stroke(arcPts(0, 0.3, 0.8, 0.7, Math.PI * 1.05, Math.PI * 1.95), w) + stroke([[-1, 0.32], [-0.6, 0.3]], w) + stroke([[0.6, 0.3], [1, 0.32]], w) + stroke([[-0.4, 0.62], [0.4, 0.6]], w * 0.6)
  if (i === 1) // a way that forks (workflow or agent)
    return stroke([[0, 0.9], [0, 0.1]], w) + stroke(curve([0, 0.12], [-0.1, -0.3], [-0.6, -0.8], 8), w) + stroke(curve([0, 0.12], [0.1, -0.3], [0.62, -0.78], 8), w)
  if (i === 2) // a carpenter's square on a drawing (spec first)
    return stroke([[-0.7, -0.6], [0.6, -0.6], [0.6, 0.7], [-0.7, 0.7], [-0.7, -0.6]], w * 0.5) + stroke([[-0.4, -0.85], [-0.4, 0.4], [0.85, 0.4]], w * 1.2)
  if (i === 3) // one scroll (skills)
    return stroke([[-0.55, -0.75], [0.55, -0.75]], w * 1.2) + stroke([[-0.38, -0.72], [-0.38, 0.68], [0.38, 0.68], [0.38, -0.72]], w * 0.6) + stroke([[-0.55, 0.72], [0.55, 0.72]], w * 1.2) + stroke([[-0.2, -0.3], [0.2, -0.3]], w * 0.4) + stroke([[-0.2, 0], [0.15, 0]], w * 0.4)
  if (i === 4) // many scrolls on one rack (an open standard)
    return stroke([[-0.95, -0.7], [0.95, -0.7]], w) + [-0.6, 0, 0.6].map((x) => stroke([[x, -0.66], [x, 0.7]], w * 1.6)).join('')
  // a crowd of lanterns (today)
  return [[-0.6, 0.1], [-0.15, -0.35], [0.35, 0.05], [0.7, -0.4], [0, 0.55], [-0.75, -0.55]].map(([x, y], k) => blob(x, y, 0.15, 0.19, 40 + k, 0.1, 8)).join('')
}
