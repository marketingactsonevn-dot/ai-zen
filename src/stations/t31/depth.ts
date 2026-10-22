import raw from '../../content/tram-31.json'
import { fill, h, s, viDate } from '../../core/dom'
import { L, type Fact } from '../../core/content'
import type { SceneDef } from '../types'
import { clamp, onSize, p2Defs, stableHeight } from '../../ui/part2/ink'
import { guide, type Mark } from '../../ui/part2/guide'
import { grass as tuft, hills, mist, moon, paperLantern, pine, toro, wash } from '../../ui/part2/paint'
import { blob, live, rng, stroke, type Pt } from './kit'
import './depth.css'

const S = raw.scenes.depth
const ms = S.tide.milestones
const f1 = (n: number) => (Math.round(n * 10) / 10).toString()

/** the cut-open well in scene px */
type Geo = {
  W: number; H: number; tall: boolean
  cx: number; a: number; b: number; sw: number; ct: number // the shaft: centre, inner walls, width, lining thickness
  gy: number; F: number; levels: number[] // the ground (the cut's top edge), the floor, the water level at each milestone
}

/** how open a ring of the shaft looks at y: the eye is a little above the mouth, so deeper rings are seen more from above */
const bowAt = (G: Geo, y: number) => G.sw * (0.08 + 0.12 * clamp((y - G.gy) / (G.F - G.gy), 0, 1))
/** the far half of the ring at y, φ from −π/2 (left wall) to π/2 (right wall) */
const ringPt = (G: Geo, y: number, ph: number): Pt => [G.cx + (Math.sin(ph) * G.sw) / 2, y - Math.cos(ph) * bowAt(G, y)]
/** the water level at t (0 = the first milestone … 1 = today), piecewise through the middle milestone */
const at = (G: Geo, t: number): number => {
  const [a, b, c] = G.levels
  return t <= 0.5 ? a + (b - a) * t * 2 : b + (c - b) * (t - 0.5) * 2
}

/** a small clay jar floating at (x, y = its waterline), k ≈ height / 13: body, neck, a pale paper label, a moonlit side */
function jar(x: number, y: number, k: number, seed: number): SVGGElement {
  const r = rng(seed)
  const w = 5 + r() * 1.2
  const body = `M${f1(x - w * k)} ${f1(y)}C${f1(x - (w + 2.6) * k)} ${f1(y - 6 * k)} ${f1(x - w * k)} ${f1(y - 10 * k)} ${f1(x - 2.3 * k)} ${f1(y - 10.6 * k)}L${f1(x - 2.3 * k)} ${f1(y - 12.4 * k)}L${f1(x + 2.3 * k)} ${f1(y - 12.4 * k)}L${f1(x + 2.3 * k)} ${f1(y - 10.6 * k)}C${f1(x + w * k)} ${f1(y - 10 * k)} ${f1(x + (w + 2.6) * k)} ${f1(y - 6 * k)} ${f1(x + w * k)} ${f1(y)}Z`
  return s('g', { class: 't31d4-jar' },
    s('ellipse', { class: 't31d4-jar-ring', cx: f1(x), cy: f1(y + 0.6 * k), rx: f1((w + 3.5) * k), ry: f1(1.6 * k) }),
    s('path', { class: 'g11-clay', d: body }),
    s('path', { class: 't31d4-jar-sh', d: body }),
    s('path', { class: 'g11-label', d: `M${f1(x - 2.8 * k)} ${f1(y - 8.2 * k)}l${f1(5.4 * k)} -0.3l0.2 ${f1(4.4 * k)}l${f1(-5.4 * k)} 0.3Z` }),
    s('path', { class: 't31d4-jar-lit', d: stroke([[x + (w + 0.6) * k, y - 3 * k], [x + (w - 0.6) * k, y - 8 * k], [x + 2.6 * k, y - 9.8 * k]], 1.1 * k, 0.2, 0.3, 0.2) }))
}

/**
 * Scene 2 — a well cut open from the ground to its floor, a cross-section through the night: the moon over the mouth and a
 * cone of its light down the shaft (dust turning in it), the back wall's stone courses curving and darkening with depth,
 * the earth outside the cut in strata to the frame's edges, a pine and a stone lantern on the bank above. The water column
 * is the number of public models: drag the moon's reflection on it up (a carved groove right of the shaft marks the three
 * dates); the water rises, clay jars (models) bob up thicker and thicker, the milestone stones on the left wall light as
 * it passes, the reading is written beside the stone. At today the jars cover the surface: the insight.
 */
export function depthScene(): SceneDef {
  return {
    label: S.label,
    text: 'tr',
    mount(ctx) {
      p2Defs()
      const n = ms.length // stops 0 … n-1; n-1 = today
      const cmp = ms[n - 1].compare
      const stableH = stableHeight(ctx, [S.insight as Fact])
      const valueText = (i: number) => fill(L.tideValue, { date: viDate(ms[i].date), label: ms[i].label })

      const art = s('svg', { class: 't31d4-art', 'aria-hidden': 'true' })
      const lead = s('path', { class: 't31d4-lead' })
      const leadSvg = s('svg', { class: 't31d4-art t31d4-leads', 'aria-hidden': 'true' }, lead)
      const glint = s('svg', { class: 't31d4-glint', viewBox: '-50 -20 100 40', 'aria-hidden': 'true' },
        s('ellipse', { class: 't31d4-halo', cx: 0, cy: 0, rx: 40, ry: 13, fill: 'url(#p2-halo)' }),
        s('ellipse', { class: 't31d4-ring r1', cx: 0, cy: 0, rx: 30, ry: 6.5 }),
        s('ellipse', { class: 't31d4-ring r2', cx: 0, cy: 0, rx: 42, ry: 9 }),
        s('ellipse', { class: 't31d4-disc', cx: 0, cy: 0, rx: 15, ry: 4 }),
        s('path', { class: 't31d4-disc', d: stroke([[-27, 4.6], [-10, 5.2]], 1.6, 0.3, 0.3, 0.2) + stroke([[8, 5.8], [24, 5.2]], 1.6, 0.3, 0.3, 0.2) }))
      const thumb = h('div', {
        class: 't31d4-moon', role: 'slider', tabindex: '0', 'aria-label': S.aria, 'aria-orientation': 'vertical',
        'aria-valuemin': '0', 'aria-valuemax': String(n - 1), 'aria-valuenow': '0', 'aria-valuetext': valueText(0),
      }, glint)
      const hit = h('div', { class: 't31d4-hit', 'aria-hidden': 'true' })
      const card = live('t31d4-read')
      const root = h('div', { class: 't31d4' }, h('p', { class: 'visually-hidden' }, S.art), art, leadSvg, hit, thumb, card)
      ctx.art.append(root)
      ctx.prompt(S.prompt)
      // H1: the vermilion dot rides on the reflection until today is reached
      let dot: Mark | null = guide(ctx).dot(thumb, { dir: [0, -1] })

      let G: Geo | null = null
      let water: SVGGElement | null = null
      let groove: SVGPathElement | null = null
      let stones: SVGGElement[] = []
      let ticks: SVGGElement[] = []
      let jars: { el: SVGGElement; t: number }[] = []
      let lamp: SVGGElement | null = null
      let at_ = -1, tt = 0, reached = false, moved = false

      /** the reading beside the milestone stone (one block); at today it gives way to the insight */
      function show(i: number) {
        if (i === at_) return
        at_ = i
        thumb.setAttribute('aria-valuenow', String(i))
        thumb.setAttribute('aria-valuetext', valueText(i))
        if (i < n - 1) card.say(h('p', { class: 'p2-eyebrow' }, `${viDate(ms[i].date)} · ${ms[i].label}`), ctx.fact(ms[i].fact as Fact, 'p', 't31d4-fact'))
        else card.replaceChildren()
        card.hidden = i >= n - 1
        lead.style.opacity = i >= n - 1 ? '0' : ''
        place()
        if (i > 0 && !moved) (moved = true), ctx.prompt(S.next)
        if (i >= n - 1 && !reached) {
          reached = true
          dot?.done()
          dot = null
          ctx.insight(S.insight as Fact, S.detail as Fact)
        }
      }
      /** the reading block and its thread to the stone */
      function place() {
        if (!G || at_ < 0 || at_ >= n - 1) return
        const y = G.levels[at_]
        const jy = y - Math.max(13, G.sw * 0.05) / 2
        if (G.tall) {
          // phone: the reading sits in the sky band; its thread drops to the stone along the bank
          lead.setAttribute('d', '')
          return
        }
        const right = G.a - G.ct - G.W * 0.035
        card.style.top = `${f1(jy)}px`
        lead.setAttribute('d', stroke([[right + 10, jy], [G.a - G.ct - 4, jy + 0.5], [G.a + G.sw * 0.08, jy + 1]], 1, 0.1, 0.1, 0.4))
      }
      function moveTo(t: number, snap: boolean) {
        if (!G) return
        tt = clamp(t, 0, 1)
        const near = Math.round(tt * (n - 1))
        if (snap) tt = near / (n - 1)
        const y = at(G, tt)
        thumb.classList.toggle('snap', snap)
        thumb.style.transform = `translate(${f1(G.cx)}px, ${f1(y)}px)`
        if (water) water.style.transform = `translateY(${f1(y - G.levels[n - 1])}px)`
        if (groove) groove.style.transform = `scaleY(${(tt + 0.0001).toFixed(3)})`
        stones.forEach((st, k) => st.classList.toggle('on', tt >= k / (n - 1) - 0.02))
        ticks.forEach((st, k) => st.classList.toggle('on', tt >= k / (n - 1) - 0.02))
        for (const j of jars) j.el.classList.toggle('on', tt >= j.t)
        lamp?.classList.toggle('on', tt >= 1 / (n - 1) - 0.02)
        show(near)
      }
      /** the pointer's height as t, through the middle milestone */
      function tAt(y: number) {
        const [l0, l1, l3] = G!.levels
        return y >= l1 ? clamp((l0 - y) / Math.max(1, l0 - l1), 0, 1) / 2 : 0.5 + clamp((l1 - y) / Math.max(1, l1 - l3), 0, 1) / 2
      }

      // drag the reflection (or anywhere on the water column); a tap that does not move steps one date toward the finger
      let drag = false, top0 = 0, y0 = 0, slid = false
      const down = (e: PointerEvent) => {
        if (e.button) return
        drag = true
        slid = e.currentTarget === thumb
        top0 = root.getBoundingClientRect().top
        y0 = e.clientY
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        thumb.focus({ preventScroll: true })
        ctx.chime('soft')
      }
      const move = (e: PointerEvent) => {
        if (!drag) return
        if (!slid && Math.abs(e.clientY - y0) < 6) return
        slid = true
        moveTo(tAt(e.clientY - top0), false)
      }
      const up = (e: PointerEvent) => {
        if (!drag) return
        drag = false
        if (!slid && G) {
          const y = e.clientY - top0
          return moveTo(clamp(at_ + (y < at(G, tt) ? 1 : -1), 0, n - 1) / (n - 1), true)
        }
        moveTo(tt, true)
      }
      for (const el of [hit, thumb]) {
        el.addEventListener('pointerdown', down)
        el.addEventListener('pointermove', move)
        el.addEventListener('pointerup', up)
        el.addEventListener('pointercancel', up)
      }
      thumb.addEventListener('keydown', (e) => {
        const k = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key]
        const to = k ? clamp(at_ + k, 0, n - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1
        if (to < 0) return
        e.preventDefault()
        moveTo(to / (n - 1), true)
      })
      // H7: standing still 6 s, the reflection lifts ~10 px up the shaft and settles back
      const nudge = () => {
        if (ctx.reduced || reached || drag) return
        glint.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-10px)', offset: 0.45 }, { transform: 'translateY(0)' }], { duration: 1300, easing: 'ease-in-out' })
      }
      ctx.el.addEventListener('p2:idle', nudge)
      ctx.onCleanup(() => ctx.el.removeEventListener('p2:idle', nudge))

      function layout() {
        const W = ctx.art.clientWidth
        const tall = W < ctx.art.clientHeight * 0.8
        const H = tall ? stableH(ctx.art.clientHeight) : ctx.art.clientHeight
        if (W < 60 || H < 60) return
        root.style.height = `${f1(H)}px`
        const cx = W / 2
        const sw = tall ? W * 0.48 : clamp(W * 0.2, 190, 330)
        const ct = Math.max(7, sw * 0.075)
        const gy = H * (tall ? 0.31 : 0.25)
        const F = H * (tall ? 0.88 : 0.87)
        const l3 = gy + (F - gy) * 0.2 // today's water line
        const l0 = F - (F - l3) / (cmp?.ratio ?? 3.16) // 1 million: the ratio sets the geometry
        const l1 = l0 + (l3 - l0) * 0.68 // 02/2026 by date (no count is claimed for it)
        G = { W, H, tall, cx, a: cx - sw / 2, b: cx + sw / 2, sw, ct, gy, F, levels: [l0, l1, l3] }
        for (const el of [art, leadSvg]) el.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
        art.replaceChildren(...paint(G))
        const top = l3 - sw * 0.2
        Object.assign(hit.style, { left: `${f1(G.a)}px`, top: `${f1(top)}px`, width: `${f1(sw)}px`, height: `${f1(F - top)}px` })
        Object.assign(thumb.style, { width: `${f1(sw * 0.62)}px`, height: `${f1(Math.max(52, sw * 0.26))}px`, marginLeft: `${f1(-sw * 0.31)}px`, marginTop: `${f1(-Math.max(52, sw * 0.26) / 2)}px` })
        if (tall) Object.assign(card.style, { left: '2px', top: `${f1(H * 0.015)}px`, width: `${f1(W * 0.64)}px` })
        else {
          const right = G.a - ct - W * 0.035
          const left = Math.max(W * 0.035, right - 420)
          Object.assign(card.style, { left: `${f1(left)}px`, width: `${f1(right - left)}px` })
        }
        root.classList.toggle('tall', tall)
        moveTo(at_ < 0 ? 0 : at_ / (n - 1), true)
        place()
      }

      /** the night, the bank and the cut-open well */
      function paint(G: Geo): SVGElement[] {
        const { W, H, tall, cx, a, b, sw, ct, gy, F, levels } = G
        const seed = 3131
        const r = rng(seed)
        const id = 't31d4'
        const ring = (y: number, p0: number, p1: number, k = 6): Pt[] => Array.from({ length: k + 1 }, (_, i) => ringPt(G, y, p0 + ((p1 - p0) * i) / k))
        const pts = (p: Pt[]) => p.map((q) => `${f1(q[0])} ${f1(q[1])}`).join('L')

        // ── sky: the moon over the mouth, far ranges melting into mist at the ground
        const mr = tall ? clamp(W * 0.06, 15, 24) : clamp(H * 0.045, 18, 34)
        const mx = tall ? W * 0.84 : cx + sw * 0.22, my = tall ? gy * 0.26 : gy * 0.4
        const sky = [
          moon(mx, my, mr, seed + 7, true),
          hills(-W * 0.1, W * 1.1, gy - H * 0.02, H * (tall ? 0.1 : 0.12), seed + 1, 0.92, 6),
          mist(W * 0.5, gy - H * 0.05, W * 0.7, H * 0.05),
          hills(-W * 0.05, W * 0.6, gy - H * 0.012, H * (tall ? 0.05 : 0.065), seed + 2, 0.6, 3),
          hills(W * 0.45, W * 1.08, gy - H * 0.01, H * (tall ? 0.04 : 0.05), seed + 3, 0.66, 2),
          mist(W * 0.5, gy - H * 0.012, W * 0.8, H * 0.03),
        ]

        // ── the bank: the ground's top seen a little from above, its cut edge lit by the moon, grass along it
        const gs = H * 0.035
        const far: Pt[] = []
        for (let x = 0; x <= W; x += W / 24) far.push([x, gy - gs + (r() - 0.5) * gs * 0.5])
        const bankTop = `M${pts(far)}L${f1(W)} ${f1(gy)}L0 ${f1(gy)}Z`
        let grassD = ''
        for (let x = 2; x < W - 2; x += 3 + r() * 5) {
          if (x > a - ct * 1.6 && x < b + ct * 1.6) continue
          grassD += stroke([[x, gy + 0.5], [x + (r() - 0.5) * 4, gy - 3 - r() * (tall ? 6 : 9)]], 0.9, 0.05, 0.8, 0.1)
        }
        // the pine on the left bank, the stone lantern by the mouth; their shadows fall left, away from the moon
        const px = tall ? W * 0.9 : W * 0.13, ph = tall ? H * 0.17 : H * 0.27
        const tx = tall ? W * 0.12 : a - ct - W * 0.07, th = tall ? H * 0.075 : H * 0.11
        const bank = [
          s('path', { class: 't31d4-banktop', d: bankTop, filter: 'url(#ink-wash)' }),
          wash(blob(px - ph * 0.22, gy - gs * 0.3, ph * 0.3, gs * 0.28, seed + 4, 0.2), 0.35, 'p2p-wash t31d4-cast'),
          wash(blob(tx - th * 0.4, gy - gs * 0.25, th * 0.55, gs * 0.22, seed + 5, 0.2), 0.35, 'p2p-wash t31d4-cast'),
          s('ellipse', { class: 't31d4-pool', cx: f1(tx), cy: f1(gy - gs * 0.35), rx: f1(th * 1.4), ry: f1(gs * 0.5), fill: 'url(#p2-lamp)' }),
          pine(px, gy - gs * 0.35, ph, seed + 6, tall ? -1 : 1),
          toro(tx, gy - gs * 0.3, th, true),
        ]

        // ── the earth in section, to the frame's edges: strata with ink grain, pebbles, buried boulders, the pine's roots,
        // a band of wet gravel on the right seeping into the shaft (where its water comes from)
        let pebbles = '', roots = '', boulders = '', seep = '', seams = ''
        const strata = ['', '', '']
        // soft wavy boundaries with a gentle tilt; the bands between them in three washes, a dry seam along part of each
        const edgeAt = (y: number) => {
          const ph = r() * 6, amp = 3 + r() * (tall ? 5 : 9), tilt = (r() - 0.5) * 0.03
          return Array.from({ length: 25 }, (_, i) => { const x = -10 + ((W + 20) * i) / 24; return [x, y + Math.sin(ph + x / (W * 0.16)) * amp + (x - W / 2) * tilt] as Pt })
        }
        let prev = edgeAt(gy + 2)
        for (let k = 0, y = gy + 4; y < H + 20; k++) {
          const hh = (tall ? 16 : 22) + r() * 34
          const next = edgeAt(y + hh)
          const tone = Math.floor(r() * 3.4) // 3 = the plain earth shows through
          if (tone < 3) strata[tone] += `M${pts(prev)}L${pts([...next].reverse())}Z`
          const i0 = Math.floor(r() * 18), i1 = i0 + 3 + Math.floor(r() * 4)
          seams += stroke(next.slice(i0, Math.min(25, i1)), 1.6 + r() * 1.8, 0.2, 0.6, 0.15)
          prev = next
          for (let j = 0; j < (tall ? 6 : 14); j++) {
            const x = r() * W
            if (x > a - ct - 6 && x < b + ct + 6) continue
            pebbles += blob(x, y + r() * hh, 1.6 + r() * 3.2, 1.1 + r() * 2.2, seed + k * 17 + j, 0.2, 8)
          }
          y += hh
        }
        const boulder = (x: number, y: number, w: number) => (boulders += blob(x, y, w, w * 0.55, seed + Math.round(x), 0.16, 14))
        if (tall) boulder(W * 0.1, H * 0.66, W * 0.06)
        else (boulder(W * 0.06, H * 0.82, W * 0.045), boulder(W * 0.93, H * 0.5, W * 0.035), boulder(W * 0.3, H * 0.93, W * 0.03))
        for (let j = 0; j < 9; j++) {
          // the pine's roots: wandering, forking, thinning down into the earth
          const x0 = px + (r() - 0.5) * ph * 0.12
          let x = x0, y = gy + 1
          const dir = (r() - 0.5) * 2, pts2: Pt[] = [[x, y]]
          for (let q = 0; q < 4; q++) pts2.push([(x += dir * ph * (0.05 + r() * 0.07) + (r() - 0.5) * ph * 0.05), (y += ph * (0.04 + r() * 0.06))])
          roots += stroke(pts2, 2.6 - j * 0.18, 0.3, 0.9, 0.12)
        }
        const gtop = levels[0] - (F - levels[0]) * 0.2, gbot = levels[0] + (F - levels[0]) * 0.35
        const gravel: Pt[] = []
        for (let x = b + ct; x <= W + 20; x += (W - b) / 10) gravel.push([x, gtop + (r() - 0.5) * 6 + (x - b) * 0.06])
        const gravelD = `M${pts(gravel)}L${f1(W + 20)} ${f1(gbot + (W - b) * 0.06)}L${f1(b + ct)} ${f1(gbot)}Z`
        let gstones = ''
        for (let j = 0; j < (tall ? 18 : 40); j++) {
          const x = b + ct + r() * (W - b - ct), y = gtop + (x - b) * 0.06 + 3 + r() * (gbot - gtop - 6)
          gstones += blob(x, y, 1.6 + r() * 2.6, 1.2 + r() * 1.6, seed + 300 + j, 0.22, 7)
        }
        for (let j = 0; j < 4; j++) {
          const y = gtop + (gbot - gtop) * (0.3 + j * 0.15)
          seep += stroke([[b + ct + 2, y], [b + ct - 3 - j, y + 3 + j], [b - 1, y + 9 + j * 2]], 1.1, 0.2, 0.4, 0.2)
        }

        // ── the back wall: each course the far half of a ring, opening as it goes down; each stone lit on top, dark at its
        // foot, darker toward the sides and with depth (the moon reaches the upper middle only)
        const rh = clamp((F - gy) / (tall ? 12 : 14), 9, 30)
        const cop = H * (tall ? 0.03 : 0.04) // how high the coping stands over the ground
        const shade = ['', '', '', '', '']
        let foot = '', lit = '', dim = ''
        for (let y = gy - cop, row = 0; y < F; y += rh, row++) {
          const nSt = tall ? 6 : 8
          const off = (row % 2) * 0.5
          for (let k = -1; k < nSt; k++) {
            const p0 = clamp(-Math.PI / 2 + ((k + off) / nSt) * Math.PI, -Math.PI / 2, Math.PI / 2)
            const p1 = clamp(-Math.PI / 2 + ((k + 1 + off) / nSt) * Math.PI, -Math.PI / 2, Math.PI / 2)
            if (p1 - p0 < 0.05) continue
            const g0 = p0 + 0.025, g1 = p1 - 0.025
            const yb = Math.min(F, y + rh - 1.2)
            const topA = ring(y + 1, g0, g1), botA = ring(yb, g0, g1)
            const quad = `M${pts(topA)}L${pts(botA.reverse())}Z`
            const side = Math.abs(Math.sin((p0 + p1) / 2)), depth = clamp((y - gy) / (F - gy), 0, 1)
            shade[clamp(Math.round((0.05 + depth * 0.62 + side * side * 0.6) * 4 - 0.5 + (r() - 0.5) * 0.8), 0, 4)] += quad
            foot += stroke(ring(y + rh * 0.72, g0 + 0.02, g1 - 0.02, 4), rh * 0.45, 0.12, 0.12, 0.5)
            const edge = stroke(ring(y + 1.8, g0 + 0.03, g1 - 0.03, 4), Math.max(1, rh * 0.11), 0.25, 0.3, 0.2)
            if (side < 0.6 && depth < 0.7) lit += edge
            else dim += edge
          }
        }
        // the floor: the far half of its ring, gravel on it
        const floorD = `M${pts(ring(F, -Math.PI / 2, Math.PI / 2, 16))}Z`
        let floorStones = ''
        for (let j = 0; j < 16; j++) {
          const ph2 = -1.3 + r() * 2.6
          const p = ringPt(G, F, ph2)
          floorStones += blob(p[0], F - (F - p[1]) * r(), 2 + r() * 4, 1.4 + r() * 2, seed + 500 + j, 0.2, 8)
        }

        // ── the lining cut in section on both sides (rising above the ground as the coping), the floor slab, and the back
        // half of the coping ring round the mouth
        let cut = '', cutLit = '', cutJoint = ''
        for (const [u, v] of [[a - ct, a], [b, b + ct]]) {
          for (let y = gy - cop, k = 0; y < F; y += rh * 0.92, k++) {
            const y1 = Math.min(F + ct, y + rh * 0.92)
            cut += `M${f1(u + 0.6)} ${f1(y + 0.8)}h${f1(v - u - 1.2)}V${f1(y1 - 0.8)}h${f1(u - v + 1.2)}Z`
            cutLit += stroke([[u + 1, y + 1.4], [v - 1, y + 1.4]], 1, 0.2, 0.2, 0.3)
          }
        }
        for (let x = a - ct, k = 0; x < b + ct; x += sw * 0.16, k++) cutJoint += stroke([[x, F + 1], [x, F + ct - 1]], 1, 0.1, 0.1, 0.4)
        const slab = `M${f1(a - ct)} ${f1(F)}H${f1(b + ct)}V${f1(F + ct)}H${f1(a - ct)}Z`
        // the coping: the back half of its ring seen from a little above, a band between the outer and inner edges (its
        // top), the inner wall's courses starting right under its inner edge; joints across the band
        const y0 = gy - cop, bw0 = bowAt(G, y0)
        const arcAt = (rx: number, ry: number, k = 24): Pt[] => Array.from({ length: k + 1 }, (_, i) => { const p = -Math.PI / 2 + (i / k) * Math.PI; return [cx + Math.sin(p) * rx, y0 - Math.cos(p) * ry] as Pt })
        const outer = arcAt(sw / 2 + ct, bw0 * (1 + (2 * ct) / sw) + ct * 0.35), inner = arcAt(sw / 2, bw0)
        const copingTop = `M${pts(outer)}L${pts([...inner].reverse())}Z`
        let copingJoints = ''
        for (let i = 2; i < 24; i += 3) copingJoints += stroke([outer[i], inner[i]], 1, 0.1, 0.1, 0.4)
        const copingLit = stroke(outer.slice(3, 22), Math.max(1.2, ct * 0.18), 0.2, 0.2, 0.3)

        // ── milestones: a stone jutting from the left wall at each water level; the paper lamp let down on a rope tied to
        // the coping, to 02/2026; a groove carved right of the shaft with a tick and a carved date at each level
        const jw = sw * 0.3, jh = Math.max(13, sw * 0.05)
        stones = levels.map((y, k) => s('g', { class: 't31d4-stone' },
          s('path', { class: 't31d4-jut-sh', d: blob(a + jw * 0.5, y + jh * 0.25, jw * 0.45, jh * 0.3, seed + 60 + k, 0.15, 10) }),
          s('path', { class: 't31d4-jut', d: `M${f1(a - 2)} ${f1(y - jh)}L${f1(a + jw)} ${f1(y - jh + 1.5)}Q${f1(a + jw + 3)} ${f1(y - jh / 2)} ${f1(a + jw - 1)} ${f1(y - 1)}L${f1(a - 2)} ${f1(y)}Z`, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
          s('path', { class: 't31d4-jut-top', d: stroke([[a, y - jh + 0.8], [a + jw - 2, y - jh + 2]], 1.6, 0.1, 0.2, 0.3) })))
        // the lamp let down on its rope stops above today's water (it never drowns); it lights once the water passes 02/2026
        const lx = a + jw * 0.75, lr = Math.max(5, sw * 0.045), ly = levels[n - 1] - bowAt(G, levels[n - 1]) - lr * 4.2
        lamp = s('g', { class: 't31d4-lamp' },
          s('path', { class: 't31d4-rope', d: `M${f1(lx)} ${f1(y0 - Math.sqrt(Math.max(0, 1 - ((lx - cx) / (sw / 2)) ** 2)) * bw0 - ct * 0.3)}L${f1(lx)} ${f1(ly)}` }),
          paperLantern(lx, ly, lr, seed + 50, lr * 0.6))
        const gx = b + ct + Math.max(14, sw * 0.08)
        const fs = tall ? 10 : clamp(sw * 0.048, 11, 14)
        const labels = [cmp ? `${viDate(ms[0].date)} · ${cmp.before}` : viDate(ms[0].date), viDate(ms[1].date), cmp ? `${viDate(ms[n - 1].date)} · ${cmp.after}` : viDate(ms[n - 1].date)]
        ticks = levels.map((y, k) => s('g', { class: 't31d4-tick' },
          s('path', { class: 't31d4-notch', d: stroke([[gx - 6, y], [gx + 7, y + 0.4]], 2, 0.05, 0.05, 0.5) }),
          tall && k === 1 ? '' : s('text', { class: 't31d4-date', x: f1(gx + 11), y: f1(y + fs * 0.36), 'font-size': f1(fs) }, tall ? viDate(ms[k].date) : labels[k])))
        groove = s('path', { class: 't31d4-groove-fill', d: stroke([[gx, levels[0]], [gx + 0.4, (levels[0] + levels[2]) / 2], [gx, levels[2]]], 2.2, 0.05, 0.05, 0.6) })
        groove.style.transformOrigin = `${f1(gx)}px ${f1(levels[0])}px`

        // ── the water: one column moved by the slider; a lit far rim, a bright meniscus at the cut; jars floating on it
        const l3 = levels[n - 1]
        const surf = ring(l3, -Math.PI / 2, Math.PI / 2, 18)
        const bw = bowAt(G, l3)
        const R = rng(seed + 900)
        // jar spots on the surface crescent, clear of the reflection in the middle; at today they cover it
        const spots: Pt[] = []
        for (let tries = 0; spots.length < (tall ? 14 : 20) && tries < 400; tries++) {
          const u = R() * 2 - 1
          if (Math.abs(u) < 0.2) continue
          const x = cx + (u * sw) / 2 * 0.9
          const back = l3 - Math.sqrt(Math.max(0, 1 - u * u)) * bw
          const y = back + (l3 - back) * (0.25 + R() * 0.8) + 2
          if (spots.some((q) => Math.abs(q[0] - x) < sw * 0.07 && Math.abs(q[1] - y) < bw * 0.45)) continue
          spots.push([x, y])
        }
        spots.sort((p, q) => p[1] - q[1])
        const jk = clamp(sw / 150, 1.1, 1.9)
        const order = spots.map((_, i) => i).sort((i, j) => Math.abs(spots[i][0] - cx) - Math.abs(spots[j][0] - cx))
        jars = spots.map((p, i) => ({ el: jar(p[0], p[1], jk * (0.85 + ((p[1] - (l3 - bw)) / (bw + 4)) * 0.25), seed + 700 + i), t: Math.max(0, order.indexOf(i) - 2) / (spots.length - 3) - 0.001 }))
        water = s('g', { class: 't31d4-water' },
          s('rect', { class: 't31d4-body', x: f1(a), y: f1(l3), width: f1(sw), height: f1(F - levels[0] + (F - l3) + 10), fill: `url(#${id}-w)` }),
          s('path', { class: 't31d4-skin', d: `M${pts(surf)}Z` }),
          s('path', { class: 't31d4-rim', d: stroke(surf, 2, 0.05, 0.05, 0.5) }),
          s('path', { class: 't31d4-meniscus', d: stroke([[a, l3 + 0.4], [cx, l3 + 0.9], [b, l3 + 0.4]], 1.6, 0.05, 0.05, 0.5) }),
          s('path', { class: 't31d4-sparkle', d: stroke([[a + sw * 0.1, l3 - bw * 0.4], [a + sw * 0.24, l3 - bw * 0.62]], 1.1, 0.3, 0.3, 0.2) + stroke([[a + sw * 0.72, l3 - bw * 0.66], [a + sw * 0.88, l3 - bw * 0.45]], 1.1, 0.3, 0.3, 0.2) }),
          ...jars.map((j) => j.el))

        // the moon's cone down the shaft, dust turning in it
        const cone = `M${f1(cx - sw * 0.22)} ${f1(gy - cop)}L${f1(cx + sw * 0.26)} ${f1(gy - cop)}L${f1(cx + sw * 0.45)} ${f1(F)}L${f1(cx - sw * 0.38)} ${f1(F)}Z`
        let dust = ''
        for (let j = 0; j < (tall ? 26 : 44); j++) {
          const v = R(), y = gy + (F - gy) * v * 0.9, half = sw * (0.24 + 0.17 * v) * (R() * 2 - 1)
          const rr = 0.5 + R() * 1.1
          dust += `M${f1(cx + sw * 0.03 + half)} ${f1(y)}m-${f1(rr)} 0a${f1(rr)} ${f1(rr)} 0 1 0 ${f1(rr * 2)} 0a${f1(rr)} ${f1(rr)} 0 1 0 -${f1(rr * 2)} 0`
        }
        return [
          s('defs', null,
            s('linearGradient', { id: `${id}-w`, x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, class: 't31d4-w0' }), s('stop', { offset: 0.3, class: 't31d4-w1' }), s('stop', { offset: 1, class: 't31d4-w2' })),
            s('linearGradient', { id: `${id}-c`, x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, class: 't31d4-c0' }), s('stop', { offset: 0.55, class: 't31d4-c1' }), s('stop', { offset: 1, class: 't31d4-c2' })),
            s('linearGradient', { id: `${id}-e`, x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, class: 't31d4-e0' }), s('stop', { offset: 0.82, class: 't31d4-e1' }), s('stop', { offset: 1, class: 't31d4-e2' })),
            // the earth dissolves into the paper at the frame's sides and under the foot of the picture (luminance masks)
            s('linearGradient', { id: `${id}-gx`, x1: 0, y1: 0, x2: 1, y2: 0 }, s('stop', { offset: 0, 'stop-color': '#000' }), s('stop', { offset: 0.035, 'stop-color': '#fff' }), s('stop', { offset: 0.965, 'stop-color': '#fff' }), s('stop', { offset: 1, 'stop-color': '#000' })),
            s('linearGradient', { id: `${id}-gy`, x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, 'stop-color': '#fff' }), s('stop', { offset: 0.92, 'stop-color': '#fff' }), s('stop', { offset: 1, 'stop-color': '#000' })),
            s('mask', { id: `${id}-mx`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: f1(W), height: f1(H) }, s('rect', { x: 0, y: 0, width: f1(W), height: f1(H), fill: `url(#${id}-gx)` })),
            s('mask', { id: `${id}-my`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: f1(W), height: f1(H) }, s('rect', { x: 0, y: 0, width: f1(W), height: f1(H), fill: `url(#${id}-gy)` })),
            s('clipPath', { id: `${id}-clip` }, s('rect', { x: f1(a), y: f1(gy - cop - bowAt(G, gy) * 2), width: f1(sw), height: f1(F - gy + cop + bowAt(G, gy) * 2) })),
            s('linearGradient', { id: `${id}-s`, x1: 0, y1: 0, x2: 1, y2: 0 }, s('stop', { offset: 0, class: 't31d4-s0' }), s('stop', { offset: 0.3, class: 't31d4-s1' }), s('stop', { offset: 0.7, class: 't31d4-s1' }), s('stop', { offset: 1, class: 't31d4-s0' }))),
          ...sky,
          // the earth: one body to the frame's edges, dissolving into the paper at the sides and the foot
          s('g', { mask: `url(#${id}-my)` }, s('g', { mask: `url(#${id}-mx)` },
          s('rect', { class: 't31d4-earth', x: 0, y: f1(gy), width: f1(W), height: f1(H - gy), fill: `url(#${id}-e)` }),
          ...strata.map((d, k) => s('path', { class: `t31d4-strata t31d4-sa${k}`, d, filter: 'url(#ink-wash)' })),
          s('path', { class: 'g11-wash t31d4-seam', d: seams }),
          s('path', { class: 't31d4-gravel', d: gravelD, filter: 'url(#ink-wash)' }),
          s('path', { class: 't31d4-gstone', d: gstones }),
          s('path', { class: 't31d4-pebble', d: pebbles }),
          s('path', { class: 't31d4-boulder', d: boulders, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
          s('path', { class: 'g11-wash t31d4-root', d: roots }),
          s('path', { class: 't31d4-seep', d: seep }),
          ...bank,
          s('path', { class: 'g11-moonlit t31d4-cutedge', d: stroke([[-20, gy + 0.5], [a - ct, gy + 1]], 1.4, 0.05, 0.05, 0.4) + stroke([[b + ct, gy + 1], [W + 20, gy + 0.5]], 1.4, 0.05, 0.05, 0.4) }),
          s('path', { class: 'g11-wash t31d4-grass', d: grassD }),
          tuft(tx + th * 0.45, gy - gs * 0.2, th * 0.6, seed + 8),
          // the shaft: mortar-dark behind, the stones by shade, their dark feet and lit tops, the turn of the wall
          s('path', { class: 't31d4-mortar', d: `M${pts(inner)}L${f1(b)} ${f1(F)}L${f1(a)} ${f1(F)}Z` }),
          ...shade.map((d, k) => s('path', { class: `t31d4-st t31d4-st${k}`, d })),
          s('path', { class: 't31d4-foot', d: foot }),
          s('path', { class: 't31d4-lit', d: lit }),
          s('path', { class: 't31d4-dim', d: dim }),
          s('path', { class: 't31d4-floor', d: floorD }),
          s('path', { class: 't31d4-floorst', d: floorStones }),
          s('rect', { x: f1(a), y: f1(gy - cop), width: f1(sw), height: f1(F - gy + cop), fill: `url(#${id}-s)` }),
          s('path', { class: 't31d4-cone', d: cone, fill: `url(#${id}-c)` }),
          s('path', { class: 't31d4-dust', d: dust }),
          lamp,
          s('g', { 'clip-path': `url(#${id}-clip)` }, water),
          s('path', { class: 't31d4-cut', d: cut + slab, fill: 'url(#p2-rock)' }),
          s('path', { class: 'g11-wash t31d4-cutjoint', d: cutJoint }),
          s('path', { class: 't31d4-cutlit', d: cutLit }),
          s('path', { class: 'g11-wash t31d4-cutline', d: stroke([[a, gy - cop], [a, F]], 1.3, 0.02, 0.1, 0.5) + stroke([[b, gy - cop], [b, F]], 1.3, 0.02, 0.1, 0.5) + stroke([[a - ct, F + ct], [b + ct, F + ct]], 1.6, 0.05, 0.05, 0.5) }),
          s('path', { class: 't31d4-coping', d: copingTop, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
          s('path', { class: 'g11-wash t31d4-copedge', d: stroke(inner, 1.4, 0.05, 0.05, 0.5) + stroke(outer, 1.6, 0.05, 0.05, 0.5) }),
          s('path', { class: 'g11-wash t31d4-copjoint', d: copingJoints }),
          s('path', { class: 't31d4-copinglit', d: copingLit }),
          ...stones,
          s('path', { class: 't31d4-groove', d: stroke([[gx, levels[0] + 6], [gx + 0.4, (levels[0] + levels[2]) / 2], [gx, levels[2] - 6]], 3.4, 0.1, 0.1, 0.6) }),
          groove,
          ...ticks,
          )),
        ]
      }

      ctx.onCleanup(onSize(ctx.art, layout))
    },
  }
}
