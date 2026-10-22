import './moons.css'
import { fill, h, s, viDate } from '../../core/dom'
import type { Fact } from '../../core/content'
import { createLoop } from '../../core/loop'
import { sliced } from '../../core/chunk'
import { blob, clamp, curve, onSize, rng, stoneArt, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist, moon, reeds } from '../../ui/part2/paint'
import type { Tide } from '../../ui/part2/types'
import type { SceneCtx } from '../types'
import { guide } from '../../ui/part2/guide'
import { C } from './content'
import { F, P, drift, f1, gdefs, ink } from './kit'

const K = C.scenes.moons
const T = K.tide as Tide
const MS = T.milestones
const N = MS.length // the last milestone is today
// each layout: depth of the three steles along the way (0 near … 1 horizon), their place across (u), and the way's
// centre line (v, u) — it enters cut by the bottom edge, swings past them and fades into the mist mid-horizon
type Lay = { pv: number[]; pu: number[]; knots: Pt[]; ph: number[] }
const DESK: Lay = {
  pv: [0.035, 0.3, 0.62], pu: [-0.6, 0.72, -0.78], ph: [0.6, 0.3, 0.17],
  knots: [[-0.1, -0.42], [0.035, -0.26], [0.16, 0.12], [0.3, 0.38], [0.46, 0.12], [0.62, -0.38], [0.8, -0.18], [1.02, 0]],
}
const PHONE: Lay = {
  pv: [0.035, 0.3, 0.62], pu: [-0.36, 0.72, -1.0], ph: [0.38, 0.19, 0.1],
  knots: [[-0.1, 0.06], [0.035, 0.12], [0.16, 0.3], [0.3, 0.36], [0.46, 0.0], [0.62, -0.62], [0.8, -0.3], [1.02, 0]],
}

/**
 * Scene 5 — a wide moss field under the moon, seen from about 35°. A worn trail of single footprints comes in at the
 * bottom edge and swings in an S past three standing steles, each carved with an ink sign and its date — one scroll
 * (Skills launch), many scrolls on one rack (the open standard), a crowd of lanterns (today) — and fades into the mist
 * mid-horizon. The near stele is the hero, cut by the frame. The moon is the key light: drag it along its ink arc (three
 * ticks, one per stele) — it waxes from crescent to full, the steles' long shadows swing with it — and as it passes each
 * stele the stele lights, its fact is written on the moss at its foot, and the trail paves itself stone by stone up to
 * it; people with lanterns come to walk it. Today: the insight takes the sky, the moss falls quiet. Reduced motion / low:
 * the moon jumps from stele to stele, every change is instant.
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
  // H4: the count rides under the moon
  const count = h('span', { class: 't35m-count', 'aria-hidden': 'true' }, fill(K.count, { n: 1, total: N }))
  const thumb = h('div', {
    class: 't35m-moon', role: 'slider', tabindex: '0', 'aria-label': K.label,
    'aria-valuemin': '1', 'aria-valuemax': String(N), 'aria-valuenow': '1', 'aria-valuetext': fill(K.sliderAria, { n: 1, total: N, label: label(0) }),
  }, disc, count)
  // the milestone is written on the moss at the foot of its stele
  const card = h('div', { class: 't35m-card' })
  const root = h('div', { class: `t35 t35m${still ? ' still' : ''}` },
    h('p', { class: 'visually-hidden' }, K.art), sky, field, shades, stand, card, thumb)
  ctx.art.append(root)
  ctx.prompt(K.prompt)
  const par = drift(ctx, root, [[sky, 4, 2], [field, 10, 3], [shades, 10, 3], [stand, 12, 3]])
  // H1: a vermilion dot on the moon until it has passed the first stele
  const GD = guide(ctx)
  const dot = GD.dot(thumb, { dir: [1, -0.25] })

  let W = 0, H = 0, hy = 0, port = false
  let L: Lay = DESK
  let arc: Pt[] = [] // the moon's way across the sky, 97 samples
  let posts: { x: number; y: number; h: number; w: number; el: SVGPathElement }[] = []
  let at = -1, t = 0, tt = 0 // the milestone shown, where the moon is, where it is going
  let reached = false
  let waitInsight: ReturnType<typeof setTimeout> | null = null
  ctx.onCleanup(() => waitInsight && clearTimeout(waitInsight))

  function placeCard(i: number) {
    if (!posts[i]) return
    if (port) {
      Object.assign(card.style, { left: '5%', right: '5%', width: 'auto', top: 'auto', bottom: `${f1(H * 0.025)}px` })
      return
    }
    const p = posts[i]
    const cw = clamp(W * 0.24, 270, 340)
    // beside the stele's foot, on the side away from the way
    const right = i !== 2
    const left = right ? p.x + p.w * 0.72 + 26 : p.x - p.w * 0.72 - 26 - cw
    const top = i === 0 ? p.y - p.h * 0.36 : p.y - 40
    Object.assign(card.style, { left: `${f1(clamp(left, W * 0.03, W * 0.97 - cw))}px`, right: 'auto', width: `${f1(cw)}px`, top: `${f1(top)}px`, bottom: 'auto' })
  }
  function show(i: number) {
    if (i === at) return
    at = i
    root.dataset.at = String(i)
    for (let k = 0; k < N; k++) root.classList.toggle(`p${k}`, k <= i)
    thumb.setAttribute('aria-valuenow', String(i + 1))
    thumb.setAttribute('aria-valuetext', fill(K.sliderAria, { n: i + 1, total: N, label: label(i) }))
    count.textContent = fill(K.count, { n: i + 1, total: N })
    root.classList.remove('rest')
    card.replaceChildren(h('p', { class: 't35m-when' }, label(i)), ctx.fact(MS[i].fact as Fact, 'p', 't35m-fact'))
    placeCard(i)
    if (!card.hasAttribute('aria-live')) card.setAttribute('aria-live', 'polite')
    if (i > 0) ctx.chime(i === N - 1 ? 'ok' : 'soft')
    if (i > 0) dot.done()
    if (i > 0 && i < N - 1) ctx.prompt(fill(K.left, { n: N - 1 - i }))
    if (i === N - 1 && !reached) {
      reached = true
      // today: a breath to read the last stele, then the insight takes the sky and the moss falls quiet (one block of words)
      const go = () => {
        waitInsight = null
        root.classList.add('rest')
        ctx.insight(F(K.insight), [F(MS[N - 1].fact), T.horizon as Fact, K.detail])
      }
      if (still) go()
      else waitInsight = setTimeout(go, 2600)
    } else if (reached && i === N - 1) root.classList.add('rest')
  }
  /** The moon is the key light: every stele's shadow runs away from it, longer as it sinks. */
  function castShadows(mx: number, my: number) {
    const low = clamp((my - hy * 0.1) / (hy * 0.9), 0, 1)
    for (const p of posts) {
      const dx = p.x - mx, dy = p.y - my
      const Lh = Math.hypot(dx, dy) || 1
      const len = p.h * (1.1 + low * 1.4)
      const ex = p.x + (dx / Lh) * len, ey = p.y + (dy / Lh) * len * 0.36
      const w = p.w * 0.42
      p.el.setAttribute('d', `M${f1(p.x - w)} ${f1(p.y)}Q${f1((p.x + ex) / 2 - w * 0.5)} ${f1((p.y + ey) / 2)} ${f1(ex)} ${f1(ey)}Q${f1((p.x + ex) / 2 + w * 0.5)} ${f1((p.y + ey) / 2 + w * 0.15)} ${f1(p.x + w)} ${f1(p.y + 1)}Z`)
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

  // drag the moon along its arc (anywhere in the sky works); release settles on the nearest stele
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
  // H7: standing still 6 s, the moon leans 10 px along its arc toward the next stele and back
  const idle = () => {
    if (reached || ctx.reduced || !arc.length) return
    const a = arc[Math.round(t * 96)], b = arc[Math.min(96, Math.round(t * 96) + 6)]
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    disc.animate([{ translate: '0 0' }, { translate: `${f1(((b[0] - a[0]) / d) * 10)}px ${f1(((b[1] - a[1]) / d) * 10)}px` }, { translate: '0 0' }], { duration: 1300, easing: 'ease-in-out' })
  }
  ctx.el.addEventListener('p2:idle', idle)
  ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', idle))

  let job: { cancel(): void } | null = null
  let first = true
  function layout() {
    W = root.clientWidth
    H = root.clientHeight
    if (W < 60 || H < 60) return
    port = W < H * 0.8
    L = port ? PHONE : DESK
    root.classList.toggle('port', port)
    hy = H * (port ? 0.3 : 0.36)
    job?.cancel()
    job = sliced(paint(), { sync: ctx.reduced || !first })
    first = false
    par.resize()
  }

  /** Ground point (u across, v 0 near … 1 at the horizon) → screen, and its scale. */
  const spread = () => W * (port ? 0.9 : 0.66)
  // on a phone the near moss below the field is kept plain: the words go there
  const near = () => H * (port ? 0.8 : 1.08)
  const proj = (u: number, v: number): [number, number, number] => {
    const k = 1 / (1 + v * 6)
    return [W / 2 + u * spread() * k, hy + (near() - hy) * k, k]
  }
  /** The way's centre line at depth v (Catmull-Rom through the knots). */
  const mid = (v: number) => {
    const KN = L.knots
    let i = 0
    while (i < KN.length - 2 && KN[i + 1][0] < v) i++
    const p0 = KN[Math.max(0, i - 1)], p1 = KN[i], p2 = KN[i + 1], p3 = KN[Math.min(KN.length - 1, i + 2)]
    const q = clamp((v - p1[0]) / (p2[0] - p1[0]), 0, 1), q2 = q * q, q3 = q2 * q
    return 0.5 * (2 * p1[1] + (p2[1] - p0[1]) * q + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * q2 + (3 * p1[1] - p0[1] - 3 * p2[1] + p3[1]) * q3)
  }
  const halfW = (v: number) => (port ? 0.17 : 0.13) * (1 - v * 0.3) // the way, in u: a little narrower far off (beyond perspective)

  function* paint() {
    // sky: the moon's arc as a faint ink stroke with a tick and a date under each stele's place, far ridges, mist
    // keep the whole moon (92 / 74 px) and its count inside the frame: the arc never rises above m
    const m = port ? 50 : 60
    const A: Pt = [m + 6, Math.max(m + 10, hy - m * 0.5)], B: Pt = [W - m - 6, m + 2], Cc: Pt = [W * 0.42, m - 6]
    arc = curve(A, Cc, B, 96)
    const full = curve([A[0] - W * 0.08, A[1] + hy * 0.12], [Cc[0], Cc[1] - 10], [W + 20, B[1] - 6], 40)
    let ticks = ''
    const tickLabels: SVGElement[] = []
    for (let i = 0; i < N; i++) {
      const k = Math.round((i / (N - 1)) * 96)
      const [x, y] = arc[k], [x2, y2] = arc[Math.min(96, k + 1)], [x0, y0] = arc[Math.max(0, k - 1)]
      const dl = Math.hypot(x2 - x0, y2 - y0) || 1
      const nx = -(y2 - y0) / dl, ny = (x2 - x0) / dl
      ticks += stroke([[x - nx * 7, y - ny * 7], [x + nx * 9, y + ny * 9]], 2.4, 0.2, 0.2, 0.4)
      const short = i === N - 1 ? K.today : viDate(MS[i].date.slice(0, 7))
      // above the arc (the count rides under the moon)
      tickLabels.push(s('text', { class: 't35m-tick-l', x: f1(clamp(x - nx * 68, 40, W - 40)), y: f1(Math.max(15, y - ny * 68 + 4)), 'text-anchor': 'middle' }, short))
    }
    sky.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    sky.replaceChildren(
      mist(W * 0.5, hy * 0.62, W * 0.62, hy * 0.5),
      ink(stroke(full, port ? 2 : 2.6, 0.15, 0.15, 0.2), 't35m-track', 'rough'),
      ink(ticks, 't35m-tick', 'rough'), ...tickLabels,
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
      const u = mid(v) + side2 * (halfW(v) + 0.22 + r() * 0.6)
      const [x, y, sc] = proj(u, v)
      clumps.push(s('g', { class: 't35m-reedg' }, reeds(x, y, H * 0.28 * sc * (0.7 + r() * 0.6), 380 + k, 4 + Math.floor(r() * 4))))
    }
    // the way: per stretch, a worn trail of single footprints and its paved twin — flagstones with a lit top and a dark
    // front lip, three tones, moss in the joints, smaller with distance (shown once the moon has passed that stretch)
    const segs: SVGElement[] = []
    const vs = [0, ...L.pv, 1]
    for (let k = 0; k < vs.length - 1; k++) {
      const v0 = vs[k] - (k ? 0 : 0.1), v1 = vs[k + 1]
      let prints = '', lips = ''
      const tone = ['', '', '']
      const Lp: Pt[] = [], Rp: Pt[] = []
      const n = Math.max(8, Math.round((v1 - v0) * 70))
      for (let j = 0; j <= n; j++) {
        const v = v0 + ((v1 - v0) * j) / n
        const [xl, yl] = proj(mid(v) - halfW(v), v), [xr, yr] = proj(mid(v) + halfW(v), v)
        Lp.push([xl, yl])
        Rp.push([xr, yr])
        if (j % 2 === 0 && j < n) {
          const side2 = (j / 2) % 2 ? 1 : -1
          const [x, y, sc] = proj(mid(v) + side2 * halfW(v) * 0.25, v)
          prints += blob(x, y, 20 * sc, 8 * sc, 362 + k * 40 + j, 0.2, 8)
        }
      }
      const bed = `M${Lp.map(P).join('L')}L${Rp.reverse().map(P).join('L')}Z`
      // rows of flagstones laid in perspective: each row about one stone deep, two or three across, joints of moss
      let v = v0
      let row = 0
      while (v < v1) {
        const [, , sc] = proj(0, v)
        const dv = Math.min(v1 - v, (12 + r() * 6) / ((near() - hy) * sc))
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
          // the stone's near edge: a thickness in shade under its front
          const th = Math.max(1, 5 * sc)
          lips += `M${P(q[3])}L${P(q[2])}L${P([q[2][0], q[2][1] + th])}L${P([q[3][0], q[3][1] + th])}Z`
        }
        v += dv
        row++
      }
      segs.push(s('g', { class: `t35m-seg t35m-seg-${k}` },
        s('path', { class: 't35m-trail', d: prints, filter: 'url(#ink-wash)' }),
        s('g', { class: 't35m-paved' },
          s('path', { class: 't35m-bed', d: bed, filter: 'url(#ink-wash)' }),
          s('path', { class: 't35m-lip', d: lips }),
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
      // the moon's sheen on the moss far off, under where it rides
      s('ellipse', { class: 't35m-sheen', cx: f1(W * 0.62), cy: f1(hy + (H - hy) * 0.12), rx: f1(W * 0.42), ry: f1((H - hy) * 0.1), fill: 'url(#t35k-moonpool)' }),
      s('path', { class: 't35m-tuft', d: tufts }),
      ...segs,
      // past today the way runs on into the mist: a forecast, not a fact
      s('path', { class: 't35m-beyond', d: stroke(Array.from({ length: 12 }, (_, j) => { const v2 = 0.66 + j * 0.03; return proj(mid(v2), v2).slice(0, 2) as Pt }), Math.max(1.5, 26 * proj(0, 0.85)[2]), 0.1, 0.8, 0.2), filter: 'url(#ink-wash)' }),
      mist(W * 0.5, hy + (H - hy) * 0.04, W * 0.62, (H - hy) * 0.07),
      ...clumps)
    yield
    // the steles, near (first) to far (today), each with its carved sign and date; their long shadows (cast from the
    // moon) on their own layer, so moving the moon redraws only those
    posts = []
    const postEls: SVGElement[] = []
    const shadeEls: SVGElement[] = []
    for (let i = 0; i < N; i++) {
      const v = L.pv[i]
      const [x, y] = proj(L.pu[i], v)
      const ph = H * L.ph[i], pw = ph * (i ? 0.44 : 0.4)
      const el = s('path', { class: `t35m-shadow t35m-shadow-${i}` })
      shadeEls.push(el)
      posts.push({ x, y, h: ph, w: pw, el })
      const sg = sign(i)
      const date = viDate(MS[i].date)
      const fs = Math.max(9, pw * 0.13)
      // moss on its crown, lichen on its flank, a few tufts at its foot
      const crown = blob(-pw * 0.04, -ph * 0.93, pw * 0.3, ph * 0.035, 395 + i, 0.4, 12)
      const lichen = blob(pw * 0.2, -ph * 0.3, pw * 0.07, ph * 0.03, 396 + i, 0.4, 10) + blob(-pw * 0.26, -ph * 0.18, pw * 0.05, ph * 0.02, 397 + i, 0.4, 10)
      let foot = ''
      const rf = rng(398 + i)
      for (let k = 0; k < 14; k++) {
        const fx = (rf() - 0.5) * pw * 1.4, L2 = ph * (0.04 + rf() * 0.06)
        foot += stroke([[fx, 2], [fx + (rf() - 0.5) * L2 * 0.6, 2 - L2]], Math.max(0.8, pw * 0.02), 0.1, 0.7, 0.1)
      }
      postEls.push(s('g', { class: `t35m-post t35m-post-${i}`, transform: `translate(${f1(x)} ${f1(y)})` },
        s('circle', { class: 't35m-halo', cx: 0, cy: f1(-ph * 0.6), r: f1(ph * 0.85), fill: 'url(#p2-halo)' }),
        stoneArt(pw, ph, 390 + i, 'p2-stone t35m-stone'),
        s('path', { class: 't35m-crown', d: crown, filter: 'url(#ink-wash)' }),
        s('path', { class: 't35m-lichen', d: lichen, filter: 'url(#ink-wash)' }),
        // the sign is carved: a lit lower lip under the dark groove; the date chiselled under it
        s('g', { transform: `translate(${f1(-pw * 0.02)} ${f1(-ph * 0.6)}) scale(${f1(pw * 0.36)})` },
          s('path', { class: 't35m-sign-lip', d: sg, transform: 'translate(0.05 0.06)' }),
          ink(sg, 't35m-sign', 'rough')),
        s('text', { class: 't35m-carved-lip', x: f1(-pw * 0.02 + 0.8), y: f1(-ph * 0.3 + 1), 'font-size': f1(fs), 'text-anchor': 'middle' }, date),
        s('text', { class: 't35m-carved', x: f1(-pw * 0.02), y: f1(-ph * 0.3), 'font-size': f1(fs), 'text-anchor': 'middle' }, date),
        s('path', { class: 't35m-foot', d: foot })))
    }
    // the walkers who come once the way is known: a few with the open standard, a crowd today, lanterns in hand
    const walkers: SVGElement[] = []
    const rw = rng(377)
    for (let k = 0; k < 16; k++) {
      const from = k < 5 ? 1 : 2
      const v = clamp(0.06 + rw() * L.pv[from] * 0.98, 0.06, 0.7)
      const [x, y, sc] = proj(mid(v) + (rw() - 0.5) * halfW(v) * 1.2, v)
      const u = 90 * sc * (port ? 0.85 : 1)
      walkers.push(s('g', { class: `t35m-walker w${from}`, transform: `translate(${f1(x)} ${f1(y)})`, style: `--d:${(rw() * 0.8).toFixed(2)}s` },
        s('ellipse', { class: 't35k-contact', cx: 0, cy: 0, rx: f1(u * 0.3), ry: f1(u * 0.06) }),
        s('path', { class: 't35m-robe', d: `M${f1(-u * 0.17)} 0L${f1(-u * 0.06)} ${f1(-u * 0.6)}Q${f1(u * 0.01)} ${f1(-u * 0.66)} ${f1(u * 0.08)} ${f1(-u * 0.6)}L${f1(u * 0.17)} 0Z` }),
        s('circle', { class: 't35m-robe', cx: f1(u * 0.01), cy: f1(-u * 0.72), r: f1(u * 0.09) }),
        s('path', { class: 't35m-hat', d: `M${f1(-u * 0.16)} ${f1(-u * 0.74)}L${f1(u * 0.01)} ${f1(-u * 0.9)}L${f1(u * 0.18)} ${f1(-u * 0.74)}Z` }),
        s('path', { class: 't35m-cordline', d: `M${f1(u * 0.09)} ${f1(-u * 0.44)}L${f1(u * 0.3)} ${f1(-u * 0.5)}L${f1(u * 0.3)} ${f1(-u * 0.38)}` }),
        s('circle', { class: 't35m-glow', cx: f1(u * 0.3), cy: f1(-u * 0.3), r: f1(u * 0.5), fill: 'url(#t35k-pool)' }),
        s('ellipse', { class: 't35m-lamp', cx: f1(u * 0.3), cy: f1(-u * 0.3), rx: f1(u * 0.07), ry: f1(u * 0.09) })))
    }
    shades.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    shades.replaceChildren(...shadeEls)
    stand.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    stand.replaceChildren(
      ...postEls.slice().reverse().slice(0, N - 1),
      ...walkers,
      postEls[0],
      mist(W * 0.5, H * 1.02, W * 0.7, H * 0.06),
      ink(grass(W * 0.03, H + 4, H * 0.3, 363).getAttribute('d')! + grass(W * 0.97, H + 6, H * 0.26, 364).getAttribute('d')!, 't35m-near', 'wash'))
    moveTo(at < 0 ? 0 : at / (N - 1), true)
    placeCard(Math.max(0, at))
    GD.refresh()
  }

  ctx.onCleanup(onSize(root, layout))
  ctx.onCleanup(() => {
    job?.cancel()
    loop.dispose()
  })
}

/** The ink sign on stele i, in a unit box centred on 0, 0 (path data): one scroll, a rack of scrolls, a crowd of lanterns. */
function sign(i: number): string {
  const w = 0.16
  if (i === 0) // one hanging scroll (Skills): a rod with its cord, the paper, three lines of writing, the weighted rod
    return stroke([[-0.62, -0.78], [0.62, -0.78]], w * 1.3) + stroke([[-0.2, -0.8], [0, -1.05], [0.2, -0.8]], w * 0.45) +
      stroke([[-0.42, -0.7], [-0.42, 0.66]], w * 0.8) + stroke([[0.42, -0.7], [0.42, 0.66]], w * 0.8) +
      stroke([[-0.24, -0.42], [0.24, -0.42]], w * 0.7) + stroke([[-0.24, -0.14], [0.18, -0.14]], w * 0.7) + stroke([[-0.24, 0.14], [0.22, 0.14]], w * 0.7) +
      stroke([[-0.66, 0.74], [0.66, 0.74]], w * 1.5) + blob(-0.74, 0.74, 0.1, 0.12, 31, 0.1, 8) + blob(0.74, 0.74, 0.1, 0.12, 32, 0.1, 8)
  if (i === 1) // many scrolls on one rack (an open standard)
    return stroke([[-0.95, -0.7], [0.95, -0.7]], w) + [-0.6, 0, 0.6].map((x) => stroke([[x, -0.66], [x, 0.7]], w * 1.6)).join('')
  // a crowd of lanterns (today)
  return [[-0.6, 0.1], [-0.15, -0.35], [0.35, 0.05], [0.7, -0.4], [0, 0.55], [-0.75, -0.55]].map(([x, y], k) => blob(x, y, 0.15, 0.19, 40 + k, 0.1, 8)).join('')
}
