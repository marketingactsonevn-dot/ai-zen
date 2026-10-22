import { h, s } from '../../core/dom'
import type { SceneCtx } from '../types'
import { rng } from '../../ui/part2/ink'
import { guide, type Mark } from '../../ui/part2/guide'
import { C } from './data'
import { canvas, clamp, f1, fbm, field, grain, mix, put, rgba, rig, sm, vn, type Pal, type Pt, type RGB, type Rig } from './lit'

const K = C.scenes.lotus

/** A petal's sprite is padded round the petal (PX × its width, PY × its length, base at the bottom): its glow needs room. */
const PX = 1.3, PY = 1.06
/** Bud petal k: where it stands in the bud (x offset in bud heights, lean in degrees, scale) — back ones first. */
const BUD: [number, number, number][] = [[0, 0, 0.94], [-0.07, -15, 0.9], [0.07, 15, 0.9], [-0.035, -6, 1], [0.04, 7, 1]]

/**
 * Where the five meanings come to rest after the bloom, as [x, y, scale, haze] (shares of W and H): they drift along one
 * curve out to the right and away, the first near and big, the last small and pale by the horizon. Each one's words are
 * written beside it on the water ([x, y, side]: side 0 = the words start at x, 1 = they end at x).
 */
const SPOTS_WIDE: [number, number, number, number][] = [[0.88, 0.93, 1.0, 0], [0.77, 0.7, 0.6, 0.25], [0.88, 0.58, 0.42, 0.48], [0.68, 0.51, 0.3, 0.66], [0.56, 0.465, 0.22, 0.8]]
const SLIPS_WIDE: [number, number, number][] = [[0.835, 0.755, 0], [0.8, 0.665, 0], [0.85, 0.555, 1], [0.66, 0.493, 1], [0.545, 0.452, 1]]
const SPOTS_TALL: [number, number, number, number][] = [[0.84, 0.83, 0.62, 0], [0.86, 0.76, 0.5, 0.25], [0.2, 0.71, 0.38, 0.48], [0.74, 0.61, 0.28, 0.66], [0.28, 0.545, 0.22, 0.8]]
const SLIPS_TALL: [number, number, number][] = [[0.68, 0.8, 1], [0.72, 0.725, 1], [0.3, 0.685, 0], [0.62, 0.592, 1], [0.36, 0.528, 0]]

/**
 * Scene 2 — MACRO + GRAZE: the camera nearly on the night water, the horizon high and the moon's road running from it
 * down to one white lotus bud standing low in the frame, backlit (the moon rims its petals); its stem dives into the
 * water, where it is written "one neuron". A real lily pad lies beside it, a reed out of focus at the side. A vermilion
 * dot and a breathing ripple mark the water by its foot; a faint ring round the bud fills a third with every flick
 * (tap, swipe, Space, a shake): the ripples run out, the petals sway harder each time — at the third the bud bursts.
 * The five petals drift along one curve out to the right and away as five lotuses, each with its ink mark and meaning
 * written beside it; silver threads under the water still tie all five to the one stem. Far off by the horizon a field
 * of tiny lotuses rises with the real numbers (512 neurons → more than 4,000 concepts).
 */
export function lotusScene(ctx: SceneCtx) {
  const M = K.meanings.length
  const low = ctx.quality === 'low'
  const still = low || ctx.reduced
  let energy = 0
  let flicks = 0
  let open = false
  let told = false
  let G: {
    W: number; H: number; hy: number; wy: number; bx: number; by: number; Hb: number; wide: boolean; gut: number
    spots: { x: number; y: number; s: number; haze: number }[]
  } | null = null

  const R = rig(ctx, { cls: 't23o', art: K.art, copies: [K.insight], persp: 1000, swing: 0.045, bleed: true, build })
  const Lsky = R.layer(0, 't23o-sky')
  const Lwater = R.layer(70, 't23o-water')
  const Lbud = R.layer(150, 't23o-budl')
  const Lnear = R.layer(330, 't23o-near')
  const skyArt = h('div', { class: 't23-abs' })
  Lsky.append(skyArt)
  const waterArt = h('div', { class: 't23-abs' })
  const farField = h('div', { class: 't23-abs t23o-field' })
  const threads = s('svg', { class: 't23o-threads', 'aria-hidden': 'true' })
  const rings = s('svg', { class: 't23o-rings', 'aria-hidden': 'true' })
  // H4 the load ring round the bud's foot: a faint track, a third of it inked with every flick
  const load = s('svg', { class: 't23o-load', 'aria-hidden': 'true' })
  // H1 + H7 a breathing ripple on the water by the bud's foot (the vermilion dot sits in it)
  const call = h('i', { class: 't23o-call' })
  const budRefl = h('div', { class: 't23o-brefl' })
  Lwater.append(waterArt, farField, budRefl, threads, rings, load, call)
  const stem = h('div', { class: 't23-abs t23o-stem' })
  const pod = h('div', { class: 't23-abs t23o-pod' })
  const neuron = h('span', { class: 't23o-neuron', 'aria-hidden': 'true' }, K.neuron)
  const pad = h('div', { class: 't23-abs' })
  const flowers = K.meanings.map((_, k) => h('div', { class: 't23o-flower', style: `--k:${k}` }))
  const petals = K.meanings.map((_, k) => h('div', { class: 't23o-petal', style: `--k:${k}` }))
  const bud = h('div', { class: 't23o-bud' }, ...petals)
  // flowers far to near, so the near one covers the far ones
  Lbud.append(stem, neuron, pad, ...[...flowers].reverse(), pod, bud)
  const nearArt = h('div', { class: 't23-abs' })
  Lnear.append(nearArt)
  // each meaning is written on the water beside its lotus, an ink mark before it (no paper slips, no cards)
  const labels = K.meanings.map((m, k) => h('div', { class: 't23o-mean', 'aria-hidden': 'true' }, glyph(k), h('span', null, m)))
  R.layer(150, 't23o-slips').append(...labels)
  const pond = h('button', { class: 't23o-pond', type: 'button', 'aria-label': K.shakeAria, 'aria-pressed': 'false' })
  const list = h('ul', { class: 'visually-hidden' })
  // once the bud opens: what the flicking stands for and the illustration mark (top right, away from the insight);
  // the real numbers by the far field of lotuses
  const note = h('div', { class: 't23o-note', 'data-off': '' }, h('p', { class: 't23-note t23o-decode' }, K.decode), ctx.fact(K.meaningsNote, 'p', 't23-note'))
  const count = h('div', { class: 't23o-count', 'data-off': '' }, ctx.fact(K.count, 'p', 't23-note'))
  R.view.append(pond)
  R.root.append(list, note, count)
  ctx.prompt(K.prompt)
  const gd = guide(ctx)
  let dot: Mark | null = gd.dot(() => (G ? callAt() : [0, 0]), { dir: [-1, 0] })
  const callAt = (): Pt => [G!.bx - G!.gut, G!.wy + G!.Hb * 0.126]

  function* build(R: Rig, first: boolean): Generator<unknown, void> {
    const { W, H, pal: p } = R
    const wide = W / H > 1.1
    // the horizon is high (we look down at the water at our feet), the bud low in the frame: the moon's road runs from
    // the horizon down to it
    const hy = Math.round(H * (wide ? 0.38 : 0.36))
    const Hb = wide ? Math.min(H * 0.38, W * 0.23) : Math.min(H * 0.3, W * 0.52)
    const wy = H * (wide ? 0.9 : 0.86)
    const bx = W * 0.5, by = wy - Hb * 0.16
    const geo = { W, H, hy, wy, bx, by, Hb, wide, gut: R.gut, spots: (wide ? SPOTS_WIDE : SPOTS_TALL).map(([x, y, sc, haze]) => ({ x: W * x, y: H * y, s: sc, haze })) }
    G = geo
    const roadX = W * 0.5
    let skyC: HTMLCanvasElement | null = null
    const fresh: [HTMLElement, Node[]][] = []
    const out = (el: HTMLElement, ...kids: Node[]) => (first ? el.replaceChildren(...kids) : fresh.push([el, kids]))
    const mistC: RGB = p.dark ? mix(p.paper, p.mist, 0.3) : p.mist

    // ── sky and the far shore: the moon is above the frame; its light pools at the top, mist lies on the water line
    {
      const c = canvas(W, hy + 40, R.dpr)
      const g = c.g
      const sky = g.createLinearGradient(0, 0, 0, hy)
      sky.addColorStop(0, rgba(p.dark ? mix(p.paper, p.mist, 0.12) : mix(p.paper, p.card, 0.6), 0))
      sky.addColorStop(0.4, rgba(p.dark ? mix(p.paper, p.mist, 0.14) : mix(p.paper, p.card, 0.7), 0.85))
      sky.addColorStop(1, rgba(p.dark ? mix(p.paper, p.mist, 0.24) : p.card))
      g.fillStyle = sky
      g.fillRect(0, 0, W, hy + 40)
      const mg = g.createRadialGradient(roadX, -hy * 0.6, 0, roadX, -hy * 0.6, Math.max(hy * 2.4, W * 0.5))
      mg.addColorStop(0, rgba(p.moon, p.dark ? 0.34 : 0.55))
      mg.addColorStop(0.5, rgba(p.moon, p.dark ? 0.12 : 0.2))
      mg.addColorStop(1, rgba(p.moon, 0))
      g.fillStyle = mg
      g.fillRect(0, 0, W, hy)
      const ridge = (base: number, amp: number, seed: number, col: RGB, a: number) => {
        g.fillStyle = rgba(col, a)
        g.beginPath()
        g.moveTo(0, base)
        for (let x = 0; x <= W; x += 6) g.lineTo(x, base - amp * (0.35 + 0.65 * fbm(x * 0.004 + seed, seed, 4)) * (0.6 + 0.4 * Math.sin(x * 0.003 + seed)))
        g.lineTo(W, hy + 2)
        g.lineTo(0, hy + 2)
        g.closePath()
        g.fill()
      }
      ridge(hy, hy * 0.42, 3, p.dark ? mix(p.wash, p.mist, 0.18) : mix(p.wash, p.paper, 0.8), 0.85)
      ridge(hy, hy * 0.2, 9, p.dark ? mix(p.wash, p.mist, 0.07) : mix(p.wash, p.paper, 0.64), 0.92)
      const r = rng(2331)
      g.fillStyle = rgba(p.dark ? mix(p.wash, p.mist, 0.05) : mix(p.wash, p.paper, 0.52), 0.9)
      for (let x = 0; x < W; x += 5 + r() * 9) {
        const th = hy * (0.025 + r() * 0.04)
        g.beginPath()
        g.ellipse(x, hy - th * 0.5, 3 + r() * 5, th, 0, 0, Math.PI * 2)
        g.fill()
      }
      const mist = g.createLinearGradient(0, hy - hy * 0.2, 0, hy + 40)
      mist.addColorStop(0, rgba(mistC, 0))
      mist.addColorStop(0.6, rgba(mistC, p.dark ? 0.34 : 0.8))
      mist.addColorStop(1, rgba(mistC, p.dark ? 0.2 : 0.5))
      g.fillStyle = mist
      g.fillRect(0, hy - hy * 0.2, W, hy * 0.2 + 40)
      skyC = c.c
      out(skyArt, c.c)
      yield
    }
    // ── the water, edge to edge up to the horizon: the sky held in the far water, darker toward us, the moon's road
    {
      const top = hy - 14
      const c = canvas(W, H - top + 30, R.dpr)
      const g = c.g
      g.translate(0, -top)
      const deep: RGB = p.dark ? mix(p.paper, p.mist, 0.05) : mix(p.water, p.wash, 0.35)
      const mid: RGB = p.dark ? mix(p.paper, p.mist, 0.13) : p.water
      const far: RGB = p.dark ? mix(p.paper, p.mist, 0.28) : mix(p.water, p.card, 0.55)
      const body = yield* field(W, H - top + 30, 6, (x, y, o) => {
        const t = clamp((y - 14) / (H - hy), 0, 1)
        const n = fbm(x * 0.006, y * 0.03 + 9, 3)
        const c2 = t < 0.35 ? mix(far, mid, sm(0, 0.35, t)) : mix(mid, deep, sm(0.35, 1, t))
        const k = 1 + (n - 0.5) * 0.08
        const rd = Math.exp(-Math.pow((x - roadX) / (W * (0.03 + t * 0.14)), 2)) * (0.3 + t * 0.15)
        const c3 = mix(c2, p.dark ? p.moon : p.card, rd * (p.dark ? 0.32 : 0.5))
        o[0] = c3[0] * k; o[1] = c3[1] * k; o[2] = c3[2] * k
        o[3] = sm(0, 14, y)
      })
      put(g, body, 0, top, W, H - top + 30)
      if (skyC) {
        const band = hy * 0.45
        const rc = canvas(W, band, R.dpr)
        rc.g.translate(0, band)
        rc.g.scale(1, -1)
        rc.g.drawImage(skyC, 0, (hy - band) * R.dpr, skyC.width, band * R.dpr, 0, 0, W, band)
        rc.g.setTransform(1, 0, 0, 1, 0, 0)
        rc.g.globalCompositeOperation = 'destination-in'
        const fg = rc.g.createLinearGradient(0, 0, 0, rc.c.height)
        fg.addColorStop(0, '#000')
        fg.addColorStop(1, '#0000')
        rc.g.fillStyle = fg
        rc.g.fillRect(0, 0, rc.c.width, rc.c.height)
        g.globalAlpha = p.dark ? 0.4 : 0.32
        g.drawImage(rc.c, 0, hy + 1, W, band * 0.7)
        g.globalAlpha = 1
      }
      // the moon's road: broken dry strokes, short and dense by the horizon, long and loose toward the bud
      const r = rng(2332)
      g.lineCap = 'round'
      for (let i = 0; i < (wide ? 170 : 110); i++) {
        const t = Math.pow(r(), 1.4)
        const y = hy + 3 + t * (wy - hy)
        const spread = W * (0.015 + t * 0.12)
        const x = roadX + (r() - 0.5) * 2 * spread * Math.pow(r(), 0.8)
        const len = W * (0.004 + t * 0.04) * (0.4 + r())
        g.strokeStyle = rgba(p.dark ? p.moon : p.card, (p.dark ? 0.9 : 1) * (1 - t * 0.35) * (0.45 + r() * 0.55))
        g.lineWidth = 0.7 + t * 2.2 * r()
        g.beginPath()
        g.moveTo(x - len / 2, y)
        g.lineTo(x + len / 2, y + (r() - 0.5))
        g.stroke()
      }
      // a few long ripple lines across the water, gentle, shorter and closer by the horizon
      for (let i = 0; i < 30; i++) {
        const t = r()
        const y = hy + 6 + t * t * (H - hy)
        const len = W * (0.03 + t * 0.2)
        const x = r() * W
        g.strokeStyle = rgba(p.dark ? p.mist : p.card, (p.dark ? 0.1 : 0.3) * (0.3 + r() * 0.7))
        g.lineWidth = 0.6 + t
        g.beginPath()
        g.moveTo(x - len / 2, y)
        g.quadraticCurveTo(x, y + (r() - 0.5) * 3, x + len / 2, y)
        g.stroke()
      }
      Object.assign(c.c.style, { top: `${top}px` })
      out(waterArt, c.c)
      yield
    }
    // ── far off by the horizon, a field of tiny lotuses (it rises after the bloom, with the real numbers)
    {
      const fx0 = W * (wide ? 0.6 : 0.42), fx1 = W * (wide ? 0.97 : 0.98)
      const c = canvas(fx1 - fx0, H * 0.08, R.dpr)
      const g = c.g
      const r = rng(2339)
      const n = wide ? 90 : 46
      for (let i = 0; i < n; i++) {
        const t = r()
        const x = r() * (fx1 - fx0), y = H * 0.004 + t * t * H * 0.07
        const sz = W * (wide ? 0.0024 : 0.005) * (0.55 + t * 1.4)
        const haze = 1 - t
        g.fillStyle = rgba(mix(p.dark ? mix(p.mossA, p.mist, 0.3) : mix(p.mossB, p.water, 0.4), p.dark ? mix(p.paper, p.mist, 0.3) : p.mist, haze * 0.6), 0.9)
        g.beginPath()
        g.ellipse(x, y + sz * 0.5, sz * 2.2, sz * 0.5, 0, 0, Math.PI * 2)
        g.fill()
        g.fillStyle = rgba(mix(mix(p.dark ? mix(p.moon, p.ink, 0.3) : p.card, mix(p.red, p.moon, 0.5), 0.2), p.dark ? mix(p.paper, p.mist, 0.35) : p.mist, haze * 0.55), 0.85 - haze * 0.45)
        for (const [dx, h2] of [[-0.7, 0.9], [0, 1.4], [0.7, 0.9]]) {
          g.beginPath()
          g.ellipse(x + dx * sz, y - h2 * sz * 0.4, sz * 0.38, sz * h2 * 0.6, dx * 0.4, 0, Math.PI * 2)
          g.fill()
        }
      }
      Object.assign(c.c.style, { left: `${f1(fx0)}px`, top: `${f1(hy + 2)}px` })
      out(farField, c.c)
      yield
    }
    // ── the bud: five petal sprites, a stem with its seed head, its pad; the reflection baked from the closed bud
    const petalSprites: HTMLCanvasElement[] = []
    {
      const Lp = Hb * 0.92, Wp = Hb * 0.42
      for (let k = 0; k < M; k++) {
        petalSprites.push(petal(p, Wp, Lp, 2340 + k, R.dpr * 1.1, k >= 3))
        yield
      }
      petals.forEach((el, k) => {
        el.replaceChildren(petalSprites[k])
        Object.assign(el.style, { width: `${f1(Wp * PX)}px`, height: `${f1(Lp * PY)}px` })
      })
      Object.assign(bud.style, { left: `${f1(bx)}px`, top: `${f1(by)}px` })
      sway(0)
      // the stem above the water, then refracted below (shifted, wavering, paler), the words on it
      const st = canvas(Hb * 0.4, H - by + 10, R.dpr)
      const sg = st.g
      const sx = Hb * 0.2
      const green: RGB = p.dark ? mix(p.mossA, p.mossC, 0.5) : mix(p.mossB, p.mossA, 0.5)
      sg.lineCap = 'round'
      sg.strokeStyle = rgba(green)
      sg.lineWidth = Math.max(3, Hb * 0.03)
      sg.beginPath()
      sg.moveTo(sx, 0)
      sg.lineTo(sx + 1, wy - by)
      sg.stroke()
      sg.strokeStyle = rgba(p.moon, p.dark ? 0.5 : 0.7)
      sg.lineWidth = Math.max(1, Hb * 0.006)
      sg.beginPath()
      sg.moveTo(sx + Hb * 0.012, 0)
      sg.lineTo(sx + Hb * 0.012 + 1, wy - by)
      sg.stroke()
      for (let y = wy - by + 2; y < H - by; y += 3) {
        const t = (y - (wy - by)) / (H - wy + 1)
        sg.strokeStyle = rgba(green, (p.dark ? 0.55 : 0.5) * (1 - t * 0.7))
        sg.lineWidth = Math.max(2.5, Hb * 0.027) * (1 + t * 0.2)
        sg.beginPath()
        const off = Hb * 0.05 + Math.sin(y * 0.09) * Hb * 0.015
        sg.moveTo(sx + off, y)
        sg.lineTo(sx + off + Math.sin((y + 3) * 0.09) * 1.5, y + 3.2)
        sg.stroke()
      }
      Object.assign(st.c.style, { left: `${f1(bx - sx)}px`, top: `${f1(by)}px` })
      out(stem, st.c)
      out(pod, seedHead(p, Hb * 0.26, R.dpr))
      Object.assign(pod.style, { left: `${f1(bx - Hb * 0.13)}px`, top: `${f1(by - Hb * 0.2)}px` })
      // the words on the stem under the water, beyond the load ring: to its right on a wide frame (the pad lies on the
      // left), to its left on a phone (the nearest lotus comes to rest on the right)
      if (wide) Object.assign(neuron.style, { left: `${f1(bx + Hb * 0.54)}px`, right: 'auto', top: `${f1(wy - Hb * 0.05)}px`, fontSize: `${f1(clamp(Hb * 0.058, 13.5, 17))}px`, textAlign: 'left', maxWidth: `${f1(Math.min(230, W - bx - Hb * 0.54 - R.gut - 10))}px` })
      else Object.assign(neuron.style, { left: `${f1(R.gut + 14)}px`, right: 'auto', top: `${f1(wy + Hb * 0.17)}px`, fontSize: '13px', textAlign: 'center', maxWidth: 'none', width: `${f1(W - R.gut * 2 - 28)}px` })
      // the pad beside the bud: curled rim, veins, beads of water, the moon's sheen
      const pr = Hb * (wide ? 0.62 : 0.5)
      const pd = lilyPad(p, pr, pr * 0.24, 2335, R.dpr)
      Object.assign(pd.style, { left: `${f1(bx - pr * 2.0)}px`, top: `${f1(wy - pr * 0.18)}px` })
      if (wide) out(pad, pd)
      else out(pad)
      yield
      // the reflection: the bud flipped about the water line, sliced by ripples, held in the moon's road
      const bw = Hb * 1.1
      const comp = canvas(bw, Hb * 1.25, R.dpr)
      for (let k = 0; k < M; k++) {
        const [ox, rot, sc] = BUD[k]
        comp.g.save()
        comp.g.translate(bw / 2 + ox * Hb, Hb * 1.22)
        comp.g.rotate((rot * Math.PI) / 180)
        comp.g.scale(sc, sc)
        comp.g.drawImage(petalSprites[k], (-Wp * PX) / 2, -Lp * PY, Wp * PX, Lp * PY)
        comp.g.restore()
      }
      yield
      const rh = Math.min(Hb * 1.4, H - wy + Hb * 0.2)
      const rf = canvas(bw, rh, R.dpr)
      const rg = rf.g
      const gap = wy - by
      for (let y = 0; y < rh; y += 3) {
        const sy = Hb * 1.22 - (y - gap)
        if (y < gap || sy < 0) continue
        const t = (y - gap) / (Hb * 1.2)
        if (vn(y * 0.12, 7) < 0.04 + t * 0.22) continue
        rg.globalAlpha = (p.dark ? 0.5 : 0.42) * (1 - t) * (0.75 + 0.25 * vn(y * 0.5, 3))
        const off = Math.sin(y * 0.11) * (1 + t * 5)
        rg.drawImage(comp.c, 0, sy * R.dpr, comp.c.width, 3 * R.dpr, off, y, bw, 3.4)
      }
      Object.assign(rf.c.style, { left: `${f1(bx - bw / 2)}px`, top: `${f1(by)}px` })
      out(budRefl, rf.c)
      yield
    }
    // ── the five lotuses waiting where the petals will drift (with their own reflections), the threads, the words
    {
      const F = Hb * 0.5
      const slips = wide ? SLIPS_WIDE : SLIPS_TALL
      for (let k = 0; k < M; k++) {
        const q = geo.spots[k]
        const fl = flower(p, F * q.s, 2350 + k, R.dpr, q.haze)
        Object.assign(fl.style, { left: `${f1(q.x - F * q.s * 0.8)}px`, top: `${f1(q.y - F * q.s * 0.95)}px` })
        out(flowers[k], fl)
        const [sx, sy, side] = slips[k]
        const fs = clamp(wide ? 16.5 - q.haze * 2.5 : 14.5 - q.haze * 1.5, 13, 16.5)
        Object.assign(labels[k].style, { left: `${f1(W * sx)}px`, top: `${f1(H * sy)}px`, fontSize: `${f1(fs)}px`, translate: `${-side * 100}% 0`, flexDirection: side ? 'row-reverse' : 'row' })
        labels[k].style.setProperty('--haze', q.haze.toFixed(2))
        yield
      }
      threads.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
      const root: Pt = [bx + Hb * 0.06, Math.min(H - 6, wy + Hb * 0.5)]
      threads.replaceChildren(...geo.spots.map((q) => {
        const top: Pt = [q.x, Math.min(H - 4, q.y + F * q.s * 0.08)]
        const mid: Pt = [(q.x + root[0]) / 2, Math.max(q.y, root[1]) + 10]
        return s('g', null, ...['under', 'over'].map((c) => s('path', { class: c, d: `M${f1(top[0])} ${f1(top[1])}Q${f1(mid[0])} ${f1(mid[1])} ${f1(root[0])} ${f1(root[1])}`, pathLength: 1 })))
      }))
      rings.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    }
    // ── nearest: a big pad cut by the frame, a reed — out of focus, painted at the screen's resolution
    {
      const blur = wide ? 5 : 3
      const near = (rx: number, ry: number, seed: number, cx: number, cy: number) => {
        const sp = lilyPad(p, rx, ry, seed, R.dpr, true)
        const m = blur * 3
        const c = canvas(rx * 2 + 4 + m * 2, ry * 2 + 8 + m * 2, R.dpr)
        c.g.filter = `blur(${f1(blur * R.dpr)}px)`
        c.g.drawImage(sp, m, m, rx * 2 + 4, ry * 2 + 8)
        c.g.filter = 'none'
        Object.assign(c.c.style, { left: `${f1(cx - rx - 2 - m)}px`, top: `${f1(cy - ry - 2 - m)}px` })
        return c.c
      }
      const a = near(W * (wide ? 0.17 : 0.3), W * (wide ? 0.17 : 0.3) * 0.22, 2336, W * (wide ? 0.08 : 0.04), H * 1.0)
      yield
      // the reed: stalks rising past the horizon at the left side, a plume or two, a long blade
      const rw = W * (wide ? 0.14 : 0.18)
      const rc = canvas(rw, H, R.dpr)
      const g = rc.g
      g.filter = `blur(${f1((blur - 1) * R.dpr)}px)`
      const col = p.dark ? mix(p.wash, p.mossB, 0.35) : mix(p.wash, p.mossB, 0.5)
      g.strokeStyle = rgba(col, 0.9)
      g.lineCap = 'round'
      const r = rng(2338)
      const tops: Pt[] = []
      for (let i = 0; i < 5; i++) {
        const x0 = rw * (0.55 - i * 0.1)
        const tx = x0 + rw * (0.12 + r() * 0.2), ty = H * (0.16 + r() * 0.2)
        g.lineWidth = Math.max(2.5, W * 0.0035) * (1.4 - i * 0.15)
        g.beginPath()
        g.moveTo(x0, H + 10)
        g.quadraticCurveTo(x0 + rw * 0.05, H * 0.6, tx, ty)
        g.stroke()
        tops.push([tx, ty])
      }
      for (const [tx, ty] of tops.slice(1, 3)) {
        g.fillStyle = rgba(mix(col, p.moon, p.dark ? 0.35 : 0.2), 0.75)
        g.beginPath()
        g.ellipse(tx + rw * 0.02, ty - H * 0.04, Math.max(4, rw * 0.04), H * 0.06, 0.35, 0, Math.PI * 2)
        g.fill()
      }
      g.fillStyle = rgba(col, 0.85)
      g.beginPath()
      g.moveTo(rw * 0.05, H + 10)
      g.quadraticCurveTo(rw * 0.45, H * 0.55, rw * 0.85, H * 0.42)
      g.quadraticCurveTo(rw * 0.4, H * 0.62, -rw * 0.05, H + 10)
      g.fill()
      g.filter = 'none'
      Object.assign(rc.c.style, { left: '0px', top: '0px' })
      out(nearArt, a, rc.c)
    }
    for (const [el, kids] of fresh) el.replaceChildren(...kids)
    // the water button covers the water; the notes sit top right (the insight takes the empty sky top left)
    Object.assign(pond.style, { left: '0px', top: `${f1(hy)}px`, width: `${f1(W)}px`, height: `${f1(H - hy)}px` })
    Object.assign(note.style, wide ? { left: 'auto', right: `${f1(R.gut + 6)}px`, top: '6px', width: `${f1(Math.min(420, W * 0.3))}px`, textAlign: 'right' } : { left: `${f1(R.gut + 6)}px`, right: `${f1(R.gut + 6)}px`, top: '4px', width: 'auto', textAlign: 'left' })
    Object.assign(count.style, wide ? { left: 'auto', right: `${f1(R.gut + 8)}px`, top: `${f1(hy - 46)}px`, width: `${f1(W * 0.34)}px`, textAlign: 'right' } : { left: 'auto', right: `${f1(R.gut + 6)}px`, top: `${f1(hy - 44)}px`, width: `${f1(W * 0.6)}px`, textAlign: 'right' })
    // the load ring round the bud's foot, on the water (an ellipse in perspective), and the breathing ripple by it
    {
      const cx = bx, cy = wy + Hb * 0.03, rx = Hb * 0.48, ry = rx * 0.2
      load.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
      const arc = `M${f1(cx)} ${f1(cy + ry)}A${f1(rx)} ${f1(ry)} 0 0 0 ${f1(cx)} ${f1(cy - ry)}A${f1(rx)} ${f1(ry)} 0 0 0 ${f1(cx)} ${f1(cy + ry)}`
      load.replaceChildren(
        s('path', { class: 'track', d: arc, pathLength: 1 }),
        s('path', { class: 'fill', d: arc, pathLength: 1, 'stroke-dashoffset': f1(1 - Math.min(1, energy)) }),
        ...[1, 2].map((i) => {
          const a = Math.PI / 2 + (i / 3) * Math.PI * 2
          return s('path', { class: 'tick', d: `M${f1(cx + Math.cos(a) * rx * 0.9)} ${f1(cy + Math.sin(a) * ry * 0.9)}L${f1(cx + Math.cos(a) * rx * 1.1)} ${f1(cy + Math.sin(a) * ry * 1.1)}` })
        }))
      const [dx, dy] = callAt()
      const cr = Hb * 0.2
      Object.assign(call.style, { left: `${f1(dx + R.gut - cr)}px`, top: `${f1(dy - cr * 0.24)}px`, width: `${f1(cr * 2)}px`, height: `${f1(cr * 0.48)}px` })
    }
    placeOpen(false)
    gd.refresh()
  }

  // ── sway: each petal a damped spring kicked by the ripples
  const amp = new Float32Array(M), vel = new Float32Array(M), ang = new Float32Array(M)
  function sway(dt: number) {
    if (!G) return false
    let moving = false
    for (let k = 0; k < M; k++) {
      if (dt > 0) {
        vel[k] += (-ang[k] * 22 - vel[k] * 2.2) * dt
        ang[k] += vel[k] * dt
        if (Math.abs(ang[k]) + Math.abs(vel[k]) > 0.02) moving = true
        else (ang[k] = 0), (vel[k] = 0)
      }
      const [ox, rot, sc] = BUD[k]
      petals[k].style.transform = `translate(${f1(ox * G.Hb)}px,0) rotate(${(rot + ang[k] * (1 + amp[k])).toFixed(2)}deg) scale(${sc})`
    }
    return moving
  }
  R.tick((dt) => (open ? false : sway(dt)))

  function placeOpen(animate: boolean) {
    if (!G) return
    R.root.classList.toggle('open', open)
    if (!open) return
    const g = G
    petals.forEach((el, k) => {
      const q = g.spots[k]
      const [ox, rot, sc] = BUD[k]
      const to = `translate(${f1(q.x - g.bx)}px,${f1(q.y - g.by)}px) rotate(${(k - 2) * 25}deg) scale(${(q.s * 0.5).toFixed(3)})`
      if (animate && !still) {
        el.animate([{ transform: `translate(${f1(ox * g.Hb)}px,0) rotate(${rot}deg) scale(${sc})`, opacity: 1 }, { transform: to, opacity: 1, offset: 0.8 }, { transform: to, opacity: 0 }], { duration: 2000 + k * 260, delay: k * 90, easing: 'cubic-bezier(.35,.1,.25,1)', fill: 'forwards' })
      } else el.style.opacity = '0'
    })
    flowers.forEach((el, k) => {
      if (animate && !still) el.animate([{ opacity: 0, transform: 'scale(.7)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 900, delay: 1500 + k * 300, easing: 'ease-out', fill: 'both' })
    })
    labels.forEach((el, k) => {
      if (animate && !still) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 900, delay: 2000 + k * 300, fill: 'both' })
    })
    for (const [k, gr] of [...threads.children].entries()) {
      for (const p of gr.children) if (animate && !still) (p as SVGPathElement).animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 1800, delay: 2200 + k * 200, easing: 'ease-in-out', fill: 'both' })
    }
  }

  /** a ripple on the water at (x, y): perspective ellipses running out (visual only) */
  function ripple(x: number, y: number) {
    if (!G) return
    const g = G
    const t = clamp((y - g.hy) / (g.H - g.hy), 0, 1)
    const rx = g.W * (0.05 + t * 0.2), ry = rx * (0.08 + t * 0.26)
    const n = still ? 1 : 3
    for (let i = 0; i < n; i++) {
      const e = s('ellipse', { cx: f1(x), cy: f1(y), rx: f1(rx), ry: f1(ry) })
      rings.append(e)
      if (still) {
        e.style.opacity = '0.6'
        setTimeout(() => e.remove(), 1200)
      } else e.animate([{ transform: 'scale(.08)', opacity: 0.9 }, { transform: 'scale(1)', opacity: 0 }], { duration: 1700, delay: i * 260, easing: 'cubic-bezier(.2,.6,.3,1)', fill: 'both' }).onfinish = () => e.remove()
    }
    while (rings.children.length > 9) rings.firstChild!.remove()
  }

  // ── flicks: a ripple where the water was touched; every flick inks a third of the ring — the third opens the bud
  function flick(x: number, y: number, strength: number) {
    if (!G) return
    const g = G
    ripple(x, y)
    ctx.chime(open ? 'soft' : 'tap')
    if (open) return
    flicks++
    energy = Math.min(1, flicks / 3)
    load.querySelector('.fill')?.setAttribute('stroke-dashoffset', f1(1 - energy))
    if (flicks === 1) ctx.prompt(K.prompt2)
    // the ripple reaches the bud: each petal is kicked, harder with every flick and when the flick is near
    const near = 1 - clamp(Math.abs(x - g.bx) / g.W, 0, 0.7)
    for (let k = 0; k < M; k++) {
      amp[k] = Math.min(1.6, 0.6 + energy)
      vel[k] += (k % 2 ? 1 : -1) * (55 + k * 10) * Math.max(0.5, strength) * near * (0.8 + energy * 0.9)
    }
    if (!still) R.touch()
    else sway(0)
    if (energy >= 1) bloom()
  }
  function bloom() {
    open = true
    pond.setAttribute('aria-pressed', 'true')
    dot?.done()
    dot = null
    call.classList.add('off')
    placeOpen(true)
    ctx.chime('ok')
    if (!told) {
      told = true
      list.replaceChildren(...K.meanings.map((m) => h('li', null, m)))
      list.setAttribute('aria-live', 'polite')
      delete note.dataset.off
      delete count.dataset.off
      ctx.insight(K.insight, K.detail)
    }
  }
  // six seconds of stillness: a small ripple spreads from the dot by itself
  const idle = () => {
    if (open || !G || ctx.reduced) return
    const [x, y] = callAt()
    ripple(x + G.gut, y)
  }
  ctx.el.addEventListener('p2:idle', idle)
  ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', idle))

  let down: { x: number; y: number; t: number } | null = null
  pond.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, t: performance.now() }
  })
  pond.addEventListener('pointerup', (e) => {
    if (!down || !G) return
    const r = pond.getBoundingClientRect()
    const d = Math.hypot(e.clientX - down.x, e.clientY - down.y)
    const v = d / Math.max(60, performance.now() - down.t)
    down = null
    flick(e.clientX - r.left, e.clientY - r.top + G.hy, clamp(0.34 + v * 0.25 + d / 600, 0.34, 0.7))
  })
  // keyboard (Enter / Space on the water, or Space anywhere in the scene)
  pond.addEventListener('click', (e) => {
    if (e.detail !== 0 || !G) return
    const [x, y] = callAt()
    flick(x + G.gut, y, 0.4)
  })
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== ' ' || e.defaultPrevented || (e.target as Element).closest?.('button, input, textarea, select, a, [contenteditable]') || !G) return
    e.preventDefault()
    const [x, y] = callAt()
    flick(x + G.gut, y, 0.4)
  }
  addEventListener('keydown', onKey)
  ctx.onCleanup(() => removeEventListener('keydown', onKey))
  // a shake of the phone, where motion events come without asking
  let lastShake = 0
  const onMotion = (e: DeviceMotionEvent) => {
    const a = e.acceleration
    if (!a || !G || Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0) < 14 || performance.now() - lastShake < 700) return
    lastShake = performance.now()
    flick(G.bx, G.wy + (G.H - G.wy) * 0.4, 0.45)
  }
  addEventListener('devicemotion', onMotion)
  ctx.onCleanup(() => removeEventListener('devicemotion', onMotion))
}

/** A lotus petal (base at the bottom centre), backlit by the moon behind the bud: translucent, a cool shade in its
 *  body, flushing pink to the tip, veins, and a bright rim of moonlight along both upper edges. */
function petal(p: Pal, w: number, l: number, seed: number, dpr: number, front: boolean) {
  const c = canvas(w * PX, l * PY, dpr)
  const g = c.g
  g.translate((w * (PX - 1)) / 2, l * (PY - 1))
  const r = rng(seed)
  const cx = w / 2
  const path = () => {
    g.beginPath()
    g.moveTo(cx, l)
    g.bezierCurveTo(cx - w * 0.5, l * 0.82, cx - w * 0.48, l * 0.3, cx + w * 0.02, l * 0.012)
    g.bezierCurveTo(cx + w * 0.48, l * 0.3, cx + w * 0.5, l * 0.82, cx, l)
    g.closePath()
  }
  const white = p.dark ? mix(p.moon, p.ink, 0.35) : mix(p.stepMid, p.card, 0.5)
  const pink = mix(white, p.red, p.dark ? 0.5 : 0.36)
  const base = mix(white, p.mossC, 0.35)
  path()
  const lg = g.createLinearGradient(0, l, 0, 0)
  lg.addColorStop(0, rgba(base))
  lg.addColorStop(0.35, rgba(white))
  lg.addColorStop(0.72, rgba(mix(white, pink, 0.4)))
  lg.addColorStop(1, rgba(pink))
  g.fillStyle = lg
  g.fill()
  g.save()
  path()
  g.clip()
  const cg = g.createLinearGradient(0, 0, w, 0)
  cg.addColorStop(0, rgba(p.dark ? p.paper : mix(p.water, p.wash, 0.3), front ? 0.35 : 0.48))
  cg.addColorStop(0.45, rgba(p.umbra, 0))
  cg.addColorStop(0.78, rgba(p.moon, p.dark ? 0.14 : 0.22))
  cg.addColorStop(1, rgba(p.dark ? p.paper : p.wash, 0.16))
  g.fillStyle = cg
  g.fillRect(0, 0, w, l)
  g.strokeStyle = rgba(mix(pink, p.umbra, 0.3), 0.22)
  g.lineWidth = Math.max(0.6, w * 0.008)
  for (let i = -3; i <= 3; i++) {
    g.beginPath()
    g.moveTo(cx + i * w * 0.02, l * 0.96)
    g.quadraticCurveTo(cx + i * w * (0.11 + r() * 0.02), l * 0.5, cx + i * w * 0.03, l * (0.08 + Math.abs(i) * 0.03))
    g.stroke()
  }
  const tg = g.createRadialGradient(cx, l * 0.04, 0, cx, l * 0.04, l * 0.45)
  tg.addColorStop(0, rgba(p.moon, p.dark ? 0.45 : 0.35))
  tg.addColorStop(1, rgba(p.moon, 0))
  g.fillStyle = tg
  g.fillRect(0, 0, w, l)
  g.restore()
  const rim = p.dark ? p.moon : mix(p.card, p.moon, 0.4)
  g.save()
  g.shadowColor = rgba(p.moon, 0.9)
  g.shadowBlur = w * 0.08
  g.lineCap = 'round'
  g.strokeStyle = rgba(rim, 0.95)
  g.lineWidth = Math.max(1.2, w * 0.03)
  g.beginPath()
  g.moveTo(cx + w * 0.02, l * 0.015)
  g.bezierCurveTo(cx + w * 0.47, l * 0.3, cx + w * 0.49, l * 0.6, cx + w * 0.4, l * 0.74)
  g.stroke()
  g.strokeStyle = rgba(rim, 0.7)
  g.lineWidth = Math.max(1, w * 0.02)
  g.beginPath()
  g.moveTo(cx + w * 0.02, l * 0.015)
  g.bezierCurveTo(cx - w * 0.46, l * 0.3, cx - w * 0.48, l * 0.55, cx - w * 0.42, l * 0.66)
  g.stroke()
  g.restore()
  g.strokeStyle = rgba(p.dark ? p.umbra : p.wash, p.dark ? 0.5 : 0.4)
  g.lineWidth = Math.max(0.7, w * 0.01)
  g.beginPath()
  g.moveTo(cx, l)
  g.bezierCurveTo(cx - w * 0.5, l * 0.82, cx - w * 0.49, l * 0.5, cx - w * 0.44, l * 0.42)
  g.stroke()
  g.save()
  path()
  g.clip()
  grain(g, 0, 0, w, l, 0.05)
  g.restore()
  return c.c
}

/** The seed head left standing on the stem once the petals have gone: a flat green cone, its seeds in their cells. */
function seedHead(p: Pal, w: number, dpr: number) {
  const hh = w * 0.75
  const c = canvas(w, hh, dpr)
  const g = c.g
  const green: RGB = p.dark ? mix(p.mossC, p.mossA, 0.4) : mix(p.mossA, p.mossC, 0.5)
  g.fillStyle = rgba(mix(green, p.umbra, 0.25))
  g.beginPath()
  g.moveTo(w * 0.04, hh * 0.28)
  g.quadraticCurveTo(w * 0.2, hh * 0.95, w * 0.5, hh)
  g.quadraticCurveTo(w * 0.8, hh * 0.95, w * 0.96, hh * 0.28)
  g.closePath()
  g.fill()
  g.fillStyle = rgba(mix(green, p.moon, 0.25))
  g.beginPath()
  g.ellipse(w / 2, hh * 0.28, w * 0.46, hh * 0.2, 0, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = rgba(mix(green, p.umbra, 0.5))
  for (const [u, v] of [[0.5, 0.28], [0.3, 0.25], [0.7, 0.25], [0.4, 0.36], [0.6, 0.36], [0.22, 0.32], [0.78, 0.32], [0.5, 0.18]]) {
    g.beginPath()
    g.ellipse(w * u, hh * v, w * 0.035, hh * 0.03, 0, 0, Math.PI * 2)
    g.fill()
  }
  g.strokeStyle = rgba(p.moon, p.dark ? 0.6 : 0.8)
  g.lineWidth = Math.max(1, w * 0.02)
  g.beginPath()
  g.ellipse(w / 2, hh * 0.28, w * 0.45, hh * 0.19, 0, Math.PI * 1.05, Math.PI * 1.95)
  g.stroke()
  return c.c
}

/**
 * A lily pad seen low (flattened): an irregular round leaf with its notch, the rim curling up into a lit lip (a thin
 * dark band of its underside below it), veins branching from the stalk point, beads of water with their glints, the
 * moon's long sheen across it. `near`: the big blurred one at the frame's edge (fewer details).
 */
function lilyPad(p: Pal, rx: number, ry: number, seed: number, dpr: number, near = false) {
  const c = canvas(rx * 2 + 4, ry * 2 + 10, dpr)
  const g = c.g
  const r = rng(seed)
  const x = rx + 2, y = ry + 3
  const n = 0.16 + r() * 0.08
  const a0 = -Math.PI / 2 + n, a1 = -Math.PI / 2 - n + Math.PI * 2
  // the outline: an ellipse wobbled a little (a real leaf is not a compass circle)
  const wob = Array.from({ length: 9 }, () => 1 + (r() - 0.5) * 0.08)
  const rad = (a: number) => {
    const t = (((a - a0) / (a1 - a0)) * 8 + 8) % 8
    const i = Math.floor(t), f = t - i
    return wob[i] + (wob[i + 1] - wob[i]) * f
  }
  const leaf = (k = 1, dy = 0) => {
    g.beginPath()
    g.moveTo(x, y + dy)
    for (let i = 0; i <= 64; i++) {
      const a = a0 + ((a1 - a0) * i) / 64
      const q = rad(a) * k
      g.lineTo(x + Math.cos(a) * rx * q, y + dy + Math.sin(a) * ry * q)
    }
    g.closePath()
  }
  const green = p.dark ? mix(p.mossA, p.mossB, 0.4) : mix(p.mossB, p.mossA, 0.55)
  // its underside, seen where the rim curls up
  leaf(1, Math.max(1.5, ry * 0.1))
  g.fillStyle = rgba(p.dark ? mix(p.umbra, p.mossB, 0.3) : mix(p.mossB, p.wash, 0.55), 0.9)
  g.fill()
  leaf()
  const lg = g.createLinearGradient(0, y - ry, 0, y + ry)
  lg.addColorStop(0, rgba(mix(green, p.moon, p.dark ? 0.16 : 0.22)))
  lg.addColorStop(0.55, rgba(green))
  lg.addColorStop(1, rgba(mix(green, p.dark ? p.umbra : p.mossB, 0.35)))
  g.fillStyle = lg
  g.fill()
  g.save()
  leaf()
  g.clip()
  // a mottle of the leaf's own tones, then the veins: main ribs from the stalk point, each forking once
  for (let i = 0; i < 26; i++) {
    const a = a0 + (a1 - a0) * r(), q = Math.sqrt(r()) * 0.9
    g.fillStyle = rgba(r() < 0.5 ? mix(green, p.umbra, 0.25) : mix(green, p.mossC, 0.35), 0.18)
    g.beginPath()
    g.ellipse(x + Math.cos(a) * rx * q, y + Math.sin(a) * ry * q, rx * (0.06 + r() * 0.08), ry * (0.08 + r() * 0.1), 0, 0, Math.PI * 2)
    g.fill()
  }
  g.strokeStyle = rgba(p.dark ? mix(p.mossC, p.moon, 0.15) : mix(p.mossC, p.card, 0.45), near ? 0.25 : 0.38)
  g.lineCap = 'round'
  for (let k = 0; k < 15; k++) {
    const a = a0 + ((a1 - a0) * (k + 0.5)) / 15
    const ex = x + Math.cos(a) * rx * 0.93, ey = y + Math.sin(a) * ry * 0.93
    const mx = x + Math.cos(a + 0.05) * rx * 0.5, my = y + Math.sin(a + 0.05) * ry * 0.5
    g.lineWidth = Math.max(0.6, rx * 0.007)
    g.beginPath()
    g.moveTo(x, y)
    g.quadraticCurveTo(mx, my, ex, ey)
    g.stroke()
    if (!near && k % 2) {
      g.lineWidth = Math.max(0.5, rx * 0.004)
      g.beginPath()
      g.moveTo(x + Math.cos(a) * rx * 0.6, y + Math.sin(a) * ry * 0.6)
      g.lineTo(x + Math.cos(a + 0.12) * rx * 0.9, y + Math.sin(a + 0.12) * ry * 0.9)
      g.stroke()
    }
  }
  // the moon's long sheen across the far half
  const sh = g.createLinearGradient(x - rx, y - ry, x + rx * 0.4, y)
  sh.addColorStop(0, rgba(p.moon, 0))
  sh.addColorStop(0.5, rgba(p.dark ? p.moon : p.card, p.dark ? 0.14 : 0.3))
  sh.addColorStop(1, rgba(p.moon, 0))
  g.fillStyle = sh
  g.fillRect(x - rx, y - ry, rx * 2, ry)
  g.restore()
  // the curled rim: a lit lip along the far edge, a darker one on the near side
  g.lineCap = 'round'
  g.strokeStyle = rgba(p.dark ? mix(p.mossC, p.moon, 0.45) : mix(p.mossC, p.card, 0.6), p.dark ? 0.7 : 0.85)
  g.lineWidth = Math.max(1.2, ry * 0.09)
  g.beginPath()
  for (let i = 0; i <= 40; i++) {
    const a = Math.PI * 1.05 + (Math.PI * 0.85 * i) / 40
    if (a > a0 + Math.PI * 2 - 0.02 && a < a1) continue
    const q = rad(a) * 0.985
    const px = x + Math.cos(a) * rx * q, py = y + Math.sin(a) * ry * q
    i ? g.lineTo(px, py) : g.moveTo(px, py)
  }
  g.stroke()
  g.strokeStyle = rgba(p.dark ? p.umbra : mix(p.mossB, p.wash, 0.5), 0.55)
  g.lineWidth = Math.max(1, ry * 0.06)
  g.beginPath()
  for (let i = 0; i <= 40; i++) {
    const a = Math.PI * 0.1 + (Math.PI * 0.8 * i) / 40
    const q = rad(a)
    const px = x + Math.cos(a) * rx * q, py = y + Math.sin(a) * ry * q
    i ? g.lineTo(px, py) : g.moveTo(px, py)
  }
  g.stroke()
  // beads of water: a dark lens, a bright glint up and right
  if (!near) {
    for (let i = 0; i < 5; i++) {
      const a = a0 + (a1 - a0) * r(), q = 0.25 + r() * 0.55
      const bx = x + Math.cos(a) * rx * q, by = y + Math.sin(a) * ry * q
      const br = Math.max(1.2, rx * (0.012 + r() * 0.014))
      g.fillStyle = rgba(mix(green, p.umbra, 0.45), 0.8)
      g.beginPath()
      g.ellipse(bx, by, br, br * 0.62, 0, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = rgba(p.dark ? p.moon : p.card, 0.95)
      g.beginPath()
      g.ellipse(bx + br * 0.3, by - br * 0.22, br * 0.32, br * 0.22, 0, 0, Math.PI * 2)
      g.fill()
    }
  }
  return c.c
}

/** A small open lotus floating at depth (its petals spread, a pad under it, its reflection), hazed bluer and paler
 *  toward the mist. */
function flower(p: Pal, F: number, seed: number, dpr: number, haze: number) {
  const W = F * 1.6, H = F * 1.5
  const c = canvas(W, H, dpr)
  const g = c.g
  const cx = W / 2, wy = F * 0.95
  const pd = lilyPad(p, F * 0.62, F * 0.14, seed, dpr)
  g.drawImage(pd, cx - F * 0.62 - 2, wy - F * 0.14, F * 1.24 + 4, F * 0.28 + 10)
  const sp = petal(p, F * 0.3, F * 0.6, seed, dpr, true)
  const draw = (flip: number) => {
    for (const [rot, sc] of [[-62, 0.75], [62, 0.75], [-34, 0.9], [34, 0.9], [-10, 1], [12, 1]] as [number, number][]) {
      g.save()
      g.translate(cx, wy - F * 0.04 * flip)
      g.scale(1, flip)
      g.rotate((rot * Math.PI) / 180)
      g.scale(sc, sc)
      g.drawImage(sp, -F * 0.15 * PX, -F * 0.6 * PY, F * 0.3 * PX, F * 0.6 * PY)
      g.restore()
    }
  }
  draw(1)
  g.save()
  g.globalAlpha = p.dark ? 0.35 : 0.25
  g.beginPath()
  g.rect(0, wy + F * 0.12, W, H)
  g.clip()
  g.translate(0, F * 0.16)
  draw(-1)
  g.restore()
  if (haze > 0) {
    g.globalCompositeOperation = 'source-atop'
    g.fillStyle = rgba(p.dark ? mix(p.paper, p.mist, 0.32) : mix(p.mist, p.water, 0.3), haze * (p.dark ? 0.6 : 0.62))
    g.fillRect(0, 0, W, H)
  }
  return c.c
}

/** The ink mark each lotus carries: a DNA twist, a Hebrew letter, a section sign, a web request, a food label. */
function glyph(k: number) {
  const svg = s('svg', { class: 't23o-glyph', viewBox: '-20 -20 40 40', 'aria-hidden': 'true' })
  const path = (d: string, w = 1.8) => s('path', { d, 'stroke-width': w })
  if (k === 0) {
    let a = '', b = '', rungs = ''
    for (let i = 0; i <= 16; i++) {
      const t = i / 16, y = -16 + t * 32, x = Math.sin(t * Math.PI * 2.2) * 7
      a += `${i ? 'L' : 'M'}${f1(x)} ${f1(y)}`
      b += `${i ? 'L' : 'M'}${f1(-x)} ${f1(y)}`
      if (i % 2) rungs += `M${f1(-x * 0.85)} ${f1(y)}L${f1(x * 0.85)} ${f1(y)}`
    }
    svg.append(path(a), path(b), path(rungs, 1.1))
  } else if (k === 1) svg.append(s('text', { x: 0, y: 11, 'text-anchor': 'middle', 'font-size': 30 }, 'א'))
  else if (k === 2) svg.append(s('text', { x: 0, y: 10, 'text-anchor': 'middle', 'font-size': 28 }, '§'))
  else if (k === 3) svg.append(s('text', { x: 0, y: 5, 'text-anchor': 'middle', 'font-size': 13 }, 'GET /'))
  else {
    let d = 'M-11 -15H11V15H-11Z'
    for (let i = 0; i < 6; i++) d += `M-8 ${-10 + i * 4.5}H${i ? 8 : 2}`
    svg.append(path(d, 1.4))
  }
  return svg
}
