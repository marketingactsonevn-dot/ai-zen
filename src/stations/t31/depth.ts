import raw from '../../content/tram-31.json'
import { fill, h, s, viDate } from '../../core/dom'
import { L, type Fact } from '../../core/content'
import type { SceneDef } from '../types'
import type { Tide } from '../../ui/part2/types'
import { clamp, onSize, p2Defs, stableHeight } from '../../ui/part2/ink'
import { mist, moon, paperLantern } from '../../ui/part2/paint'
import { blob, live, rng, stroke, type Pt } from './kit'

const S = raw.scenes.depth
const T = S.tide as Tide
const f1 = (n: number) => (Math.round(n * 10) / 10).toString()

/** the scroll and the well painted on it, in scene px */
type Geo = {
  W: number; H: number; tall: boolean
  sx: number; sy: number; sw0: number; sh: number // the whole mount
  x0: number; x1: number; top: number; bot: number // the painting
  cx: number; a: number; b: number; sw: number; ct: number // the shaft: centre, inner walls, width, lining thickness
  gy: number; F: number; levels: number[]; fog: number // ground, the floor (the deep below it), water levels, the deep's centre
}

/** how open a ring of the shaft looks at y: the eye is at the mouth, so deeper rings are seen more from above */
const bowAt = (G: Geo, y: number) => G.sw * (0.1 + 0.16 * clamp((y - G.gy) / (G.bot - G.gy), 0, 1))
/** the far half of the ring at y as points, φ from −π/2 (left wall) to π/2 (right wall) */
const ringPt = (G: Geo, y: number, ph: number): Pt => [G.cx + (Math.sin(ph) * G.sw) / 2, y - Math.cos(ph) * bowAt(G, y)]

/** where the moon's reflection is at t: on the water up to today, then sinking into the deep (the forecast) */
const at = (G: Geo, t: number): number => {
  const [a, b, c] = G.levels
  if (t <= 1 / 3) return a + (b - a) * t * 3
  if (t <= 2 / 3) return b + (c - b) * (t - 1 / 3) * 3
  return c + (G.fog - c) * (t - 2 / 3) * 3
}

/**
 * Scene 2 — a well cut open from top to bottom, painted on a tall hanging scroll (kakemono) off-centre on a moonlit wall,
 * the reading in the margin beside it. The round mouth opens to the moon; a cone of moonlight falls down the shaft; the
 * stone courses curve round its back wall, each stone lit on top and dark below, darker going down. The water column is
 * the number of public models: drag the moon's reflection on it up through the years (the water rises with it, the
 * milestone stones light as it passes) to today, under the real moon; then on down into the misty deep below the floor,
 * where the dotted courses go on: the forecast.
 */
export function depthScene(): SceneDef {
  return {
    label: S.label,
    mount(ctx) {
      p2Defs()
      const ms = T.milestones
      const n = ms.length // stops 0…n-1 milestones, n = the horizon (the deep)
      const today = viDate(T.horizon.asOf)
      const stableH = stableHeight(ctx, [S.insight as Fact])
      const valueText = (i: number) => (i < n ? fill(L.tideValue, { date: viDate(ms[i].date), label: ms[i].label }) : `${L.today} · ${today} → ${L.horizon}`)

      const art = s('svg', { class: 't31d3-art', 'aria-hidden': 'true' })
      const glint = s('svg', { class: 't31d3-glint', viewBox: '-50 -20 100 40', 'aria-hidden': 'true' },
        s('ellipse', { class: 't31d3-ring r1', cx: 0, cy: 0, rx: 30, ry: 7 }),
        s('ellipse', { class: 't31d3-ring r2', cx: 0, cy: 0, rx: 42, ry: 10 }),
        s('ellipse', { class: 't31d3-halo', cx: 0, cy: 0, rx: 34, ry: 12, fill: 'url(#p2-halo)' }),
        s('ellipse', { class: 't31d3-disc', cx: 0, cy: 0, rx: 15, ry: 4.6 }),
        s('path', { class: 't31d3-disc', d: stroke([[-27, 5], [-10, 5.6]], 1.6, 0.3, 0.3, 0.2) + stroke([[8, 6.2], [24, 5.6]], 1.6, 0.3, 0.3, 0.2) + stroke([[-14, 9], [6, 9.4]], 1.1, 0.3, 0.3, 0.2) }))
      const thumb = h('div', {
        class: 't31d3-moon', role: 'slider', tabindex: '0', 'aria-label': S.aria, 'aria-orientation': 'vertical',
        'aria-valuemin': '0', 'aria-valuemax': String(n), 'aria-valuenow': '0', 'aria-valuetext': valueText(0),
      }, glint)
      const hit = h('div', { class: 't31d3-hit', 'aria-hidden': 'true' })
      const card = live('t31d3-card')
      const root = h('div', { class: 't31d3' }, h('p', { class: 'visually-hidden' }, S.art), art, hit, thumb, card)
      ctx.art.append(root)
      ctx.prompt(S.prompt)

      let G: Geo | null = null
      let water: SVGGElement | null = null
      let warm: SVGGElement | null = null
      let deep: SVGGElement | null = null
      let stones: SVGGElement[] = []
      let lamp: SVGGElement | null = null
      let at_ = -1, tt = 0, reached = false

      function show(i: number) {
        if (i === at_) return
        at_ = i
        thumb.setAttribute('aria-valuenow', String(i))
        thumb.setAttribute('aria-valuetext', valueText(i))
        if (i < n) {
          const m = ms[i]
          card.say(h('p', { class: 'p2-eyebrow' }, `${viDate(m.date)} · ${m.label}`), ctx.fact(m.fact, 'p', 'p2t-fact'), m.compare ? compare(m.compare) : '')
        } else card.say(h('p', { class: 'p2-eyebrow' }, `${L.today} · ${today}  →  ${L.horizon}`), ctx.fact(T.horizon, 'p', 'p2t-fact t31d3-mist'))
        card.classList.toggle('mist', i === n)
        // today, under the real moon: the insight; the deep holds the forecast (its detail stays one tap away)
        if (i >= n - 1 && !reached) {
          reached = true
          ctx.insight(S.insight as Fact, S.detail)
        }
      }
      function moveTo(t: number, snap: boolean) {
        if (!G) return
        tt = clamp(t, 0, 1)
        const near = Math.round(tt * n)
        if (snap) tt = near / n
        thumb.classList.toggle('snap', snap)
        thumb.classList.toggle('sunk', tt > (n - 1) / n + 0.01)
        thumb.style.transform = `translate(${f1(G.cx)}px, ${f1(at(G, tt))}px)`
        if (water) water.style.transform = `translateY(${f1(at(G, Math.min(tt, (n - 1) / n)) - G.levels[2])}px)`
        stones.forEach((st, k) => st.classList.toggle('on', tt >= k / n - 0.02))
        lamp?.classList.toggle('on', tt >= 1 / n - 0.02)
        warm?.classList.toggle('on', tt >= (n - 1) / n - 0.02)
        deep?.classList.toggle('on', near === n)
        show(near)
      }
      /** the pointer's height as t: up the water column through the years; anywhere in the deep is the forecast */
      function tAt(y: number) {
        const g2 = G!
        if (y > g2.F + (g2.bot - g2.F) * 0.2) return 1
        const [l0, , l3] = g2.levels
        const u = clamp((l0 - y) / Math.max(1, l0 - l3), 0, 1) // 0 at 1 million … 1 at today
        const l1u = (l0 - g2.levels[1]) / Math.max(1, l0 - l3)
        return u <= l1u ? (u / l1u) / 3 : 1 / 3 + ((u - l1u) / (1 - l1u)) / 3
      }

      // drag anywhere on the painting (or the reflection itself)
      let drag = false, top0 = 0
      const down = (e: PointerEvent) => {
        if (e.button) return
        drag = true
        top0 = root.getBoundingClientRect().top
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        thumb.focus({ preventScroll: true })
        moveTo(tAt(e.clientY - top0), false)
        ctx.chime('soft')
      }
      const move = (e: PointerEvent) => drag && moveTo(tAt(e.clientY - top0), false)
      const up = () => {
        if (!drag) return
        drag = false
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
        const to = k ? clamp(at_ + k, 0, n) : e.key === 'Home' ? 0 : e.key === 'End' ? n : -1
        if (to < 0) return
        e.preventDefault()
        moveTo(to / n, true)
      })

      function layout() {
        const W = ctx.art.clientWidth
        const H = stableH(ctx.art.clientHeight)
        if (W < 60 || H < 60) return
        root.style.height = `${f1(H)}px`
        const tall = W < H * 0.8
        // the scroll: ~1 : 2.5, nearly the stage's height, off centre; the reading in the margin beside it
        const sh = H * (tall ? 0.95 : 0.94)
        const sw0 = tall ? Math.min(sh / 2.5, W * 0.56) : clamp(sh / 2.5, 160, 300)
        const sx = tall ? 4 : Math.max(16, W * 0.33 - sw0 / 2)
        const sy = (H - sh) * 0.4
        const m = sw0 * 0.075
        const x0 = sx + m, x1 = sx + sw0 - m, top = sy + sh * 0.075, bot = sy + sh * 0.9
        const kw = x1 - x0, ph = bot - top
        const cx = (x0 + x1) / 2, sw = kw * (tall ? 0.66 : 0.62)
        const gy = top + ph * 0.16
        const F = top + ph * 0.8 // the floor; the deep (the forecast) goes on below it into the mist
        const l3 = gy + (F - gy) * 0.2 // today's water line
        const hc = F - l3
        const l0 = F - hc / (ms[2].compare?.ratio ?? 3.16) // 1 million: the ratio sets the geometry
        const l1 = l0 + (l3 - l0) * 0.68 // 02/2026 sits between by date (an illustration: no count is claimed for it)
        G = { W, H, tall, sx, sy, sw0, sh, x0, x1, top, bot, cx, a: cx - sw / 2, b: cx + sw / 2, sw, ct: Math.max(5, sw * 0.08), gy, F, levels: [l0, l1, l3], fog: F + (bot - F) * 0.5 }
        art.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
        art.replaceChildren(...paint(G))
        Object.assign(hit.style, { left: `${f1(x0)}px`, top: `${f1(top)}px`, width: `${f1(kw)}px`, height: `${f1(ph)}px` })
        Object.assign(thumb.style, { width: `${f1(sw * 0.9)}px`, height: `${f1(sw * 0.36)}px`, marginLeft: `${f1(-sw * 0.45)}px`, marginTop: `${f1(-sw * 0.18)}px` })
        // the reading: in the margin right of the scroll
        const cl = sx + sw0 + (tall ? 10 : clamp(W * 0.04, 28, 64))
        Object.assign(card.style, { left: `${f1(cl)}px`, width: `${f1(Math.min(tall ? 999 : 440, W - cl - (tall ? 2 : 24)))}px`, top: `${f1(tall ? sy + sh * 0.1 : sy + sh * 0.22)}px`, maxHeight: `${f1(H - (tall ? sy + sh * 0.1 : sy + sh * 0.22) - 8)}px` })
        root.classList.toggle('tall', tall)
        moveTo(at_ < 0 ? 0 : at_ / n, true)
      }

      /** the wall, the mount and the painting */
      function paint(G: Geo): SVGElement[] {
        const { sx, sy, sw0, sh, x0, x1, top, bot, cx, a, b, sw, ct, gy, F, levels } = G
        const seed = 3131
        const r = rng(seed)
        const kw = x1 - x0
        const id = 't31d3'
        // ── the mount: the cord on its nail, the hanging stick, brocade, the two thin gold bands, the roller and its knobs
        const knob = Math.max(5, sw0 * 0.045)
        const mount = [
          s('ellipse', { class: 't31d3-wallglow', cx: f1(sx + sw0 / 2), cy: f1(sy + sh * 0.3), rx: f1(sw0 * 2.2), ry: f1(sh * 0.62), fill: 'url(#p2-halo)' }),
          s('rect', { class: 't31d3-shadow', x: f1(sx + 8), y: f1(sy + 10), width: f1(sw0), height: f1(sh), rx: 3, filter: 'url(#ink-wash)' }),
          s('path', { class: 't31d3-cord', d: `M${f1(sx + sw0 * 0.18)} ${f1(sy + 2)}L${f1(sx + sw0 / 2)} ${f1(sy - Math.min(26, sy * 0.9))}L${f1(sx + sw0 * 0.82)} ${f1(sy + 2)}` }),
          s('circle', { class: 't31d3-nail', cx: f1(sx + sw0 / 2), cy: f1(sy - Math.min(26, sy * 0.9)), r: 2.4 }),
          s('rect', { class: 't31d3-silk', x: f1(sx), y: f1(sy), width: f1(sw0), height: f1(sh) }),
          s('rect', { class: 't31d3-silk2', x: f1(sx + sw0 * 0.03), y: f1(top - sh * 0.03), width: f1(sw0 * 0.94), height: f1(bot - top + sh * 0.06) }),
          s('rect', { class: 't31d3-gold', x: f1(sx + sw0 * 0.03), y: f1(top - sh * 0.012), width: f1(sw0 * 0.94), height: f1(sh * 0.008) }),
          s('rect', { class: 't31d3-gold', x: f1(sx + sw0 * 0.03), y: f1(bot + sh * 0.004), width: f1(sw0 * 0.94), height: f1(sh * 0.008) }),
          s('rect', { class: 't31d3-stick', x: f1(sx - 2), y: f1(sy - 3), width: f1(sw0 + 4), height: f1(Math.max(5, sh * 0.011)), rx: 1.5 }),
          s('rect', { class: 't31d3-roller', x: f1(sx - 3), y: f1(sy + sh - knob * 0.9), width: f1(sw0 + 6), height: f1(knob * 1.4), rx: f1(knob * 0.5) }),
          s('rect', { class: 't31d3-knob', x: f1(sx - knob * 1.6), y: f1(sy + sh - knob * 1.1), width: f1(knob * 1.4), height: f1(knob * 1.8), rx: f1(knob * 0.5) }),
          s('rect', { class: 't31d3-knob', x: f1(sx + sw0 + knob * 0.2), y: f1(sy + sh - knob * 1.1), width: f1(knob * 1.4), height: f1(knob * 1.8), rx: f1(knob * 0.5) }),
        ]
        // ── earth outside the lining: strata with pebbles, roots under the grass
        let strata = '', pebbles = '', roots = '', grass = ''
        for (let k = 0, y = gy + 6; y < bot; k++) {
          const hh = 12 + r() * 24
          const pts: Pt[] = []
          for (let x = x0; x <= x1 + 1; x += kw / 10) pts.push([x, y + hh + (r() - 0.5) * 6])
          if (k % 2) strata += `M${f1(x0)} ${f1(y)}L${pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')}L${f1(x1)} ${f1(y)}Z`
          for (let j = 0; j < 4; j++) {
            const px = r() < 0.5 ? x0 + r() * (a - ct - x0) : b + ct + r() * (x1 - b - ct)
            pebbles += blob(px, y + r() * hh, 1.4 + r() * 2.6, 1 + r() * 1.8, seed + k * 9 + j, 0.2, 8)
          }
          y += hh
        }
        for (let j = 0; j < 6; j++) {
          const px = r() < 0.5 ? x0 + r() * (a - ct - x0 - 4) : b + ct + 4 + r() * (x1 - b - ct - 4)
          roots += stroke([[px, gy + 3], [px + (r() - 0.5) * 8, gy + 12 + r() * 10], [px + (r() - 0.5) * 14, gy + 20 + r() * 22]], 1.1, 0.2, 0.7, 0.1)
        }
        for (let x = x0 + 1; x < x1 - 1; x += 2.5 + r() * 3) if (x < a - ct - 4 || x > b + ct + 4) grass += stroke([[x, gy + 1], [x + (r() - 0.5) * 4, gy - 3 - r() * 6]], 0.9, 0.05, 0.8, 0.1)
        // ── the back wall: each course the far half of a ring, opening as it goes down; every stone its own quad, lit on
        // its top edge where the moon reaches, dark at its foot, darker toward the turning sides and with depth
        const rh = clamp((F - gy) / 13, 9, 26)
        const shade = ['', '', '', '', '']
        let foot = '', lit = '', dim = '', dotted = ''
        const ring = (y: number, p0: number, p1: number, k = 6): Pt[] => Array.from({ length: k + 1 }, (_, i) => ringPt(G, y, p0 + ((p1 - p0) * i) / k))
        for (let y = gy + 3, row = 0; y < bot + rh; y += rh, row++) {
          const nSt = 7
          const off = (row % 2) * 0.5
          for (let k = -1; k < nSt; k++) {
            const p0 = clamp(-Math.PI / 2 + ((k + off) / nSt) * Math.PI, -Math.PI / 2, Math.PI / 2)
            const p1 = clamp(-Math.PI / 2 + ((k + 1 + off) / nSt) * Math.PI, -Math.PI / 2, Math.PI / 2)
            if (p1 - p0 < 0.05) continue
            const g0 = p0 + 0.025, g1 = p1 - 0.025 // a mortar gap between stones
            const topA = ring(y + 1, g0, g1), botA = ring(y + rh - 1.2, g0, g1)
            if (y > F) {
              // the deep: the courses go on as dotted lines in the mist
              if (k >= 0) dotted += stroke(ring(y, p0, p1), 1, 0.1, 0.1, 0.4)
              continue
            }
            const quad = `M${topA.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')}L${botA.reverse().map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')}Z`
            const side = Math.abs(Math.sin((p0 + p1) / 2)), depth = clamp((y - gy) / (F - gy), 0, 1)
            shade[clamp(Math.round((0.1 + depth * 0.5 + side * side * 0.7) * 4 - 0.5 + (r() - 0.5) * 0.8), 0, 4)] += quad
            foot += stroke(ring(y + rh - rh * 0.3, g0 + 0.02, g1 - 0.02, 4), rh * 0.5, 0.12, 0.12, 0.5)
            const inCone = side < 0.55 && depth < 0.75
            const edge = stroke(ring(y + 1.6, g0 + 0.03, g1 - 0.03, 4), Math.max(1, rh * 0.11), 0.25, 0.3, 0.2)
            if (inCone) lit += edge
            else dim += edge
          }
        }
        // ── the lining cut in section on both sides, and the back half of the mouth's stone ring
        let cut = '', cutLit = ''
        for (const [u, v] of [[a - ct, a], [b, b + ct]]) {
          for (let y = gy - 4, k = 0; y < F; y += rh * 0.92, k++) {
            cut += `M${f1(u + 0.6)} ${f1(y + 0.8)}h${f1(v - u - 1.2)}v${f1(rh * 0.92 - 1.6)}h${f1(u - v + 1.2)}Z`
            cutLit += stroke([[u + 1, y + 1.4], [v - 1, y + 1.4]], 1, 0.2, 0.2, 0.3)
          }
        }
        const mouth: Pt[] = Array.from({ length: 25 }, (_, i) => { const ph = -Math.PI / 2 + (i / 24) * Math.PI; return [cx + (Math.sin(ph) * (sw + ct * 2)) / 2, gy - 2 - Math.cos(ph) * (bowAt(G, gy) + ct * 0.6)] as Pt })
        // ── milestones: a stone jutting from the left wall at each water level, its date cut on its face; the lamp let
        // down to 02/2026; the two flood marks (1 million, 3.16 million) carved on small tablets on the right wall
        const jw = sw * 0.46, jh = Math.max(13, rh * 0.85)
        const fs = clamp(jw / 5.6, 8.5, 12)
        stones = levels.map((y, k) => s('g', { class: 't31d3-stone' },
          s('path', { class: 't31d3-jut-sh', d: blob(a + jw * 0.55, y + jh * 0.2, jw * 0.5, jh * 0.32, seed + 60 + k, 0.15, 10) }),
          s('path', { class: 't31d3-jut', d: `M${f1(a - 2)} ${f1(y - jh)}L${f1(a + jw)} ${f1(y - jh + 1.5)}Q${f1(a + jw + 3)} ${f1(y - jh / 2)} ${f1(a + jw - 1)} ${f1(y - 1)}L${f1(a - 2)} ${f1(y)}Z`, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
          s('path', { class: 't31d3-jut-top', d: stroke([[a, y - jh + 0.8], [a + jw - 2, y - jh + 2]], 1.6, 0.1, 0.2, 0.3) }),
          s('text', { class: 't31d3-date', x: f1(a + 4), y: f1(y - jh * 0.3), 'font-size': f1(fs) }, viDate(ms[k].date))))
        lamp = s('g', { class: 't31d3-lamp' },
          s('path', { class: 't31d3-rope', d: `M${f1(a + jw * 0.8)} ${f1(gy - 4)}L${f1(a + jw * 0.8)} ${f1(levels[1] - jh - 22)}` }),
          paperLantern(a + jw * 0.8, levels[1] - jh - 22, Math.max(5, sw * 0.05), seed + 50, 2))
        const cmp = ms[2].compare!
        const tw = sw * 0.42
        const marks = s('g', { class: 't31d3-marks' },
          ...[[levels[0], cmp.before], [levels[2], cmp.after]].flatMap(([y, txt], k) => [
            s('path', { class: 't31d3-notch', d: stroke([[b - tw - 3, +y], [b + ct, +y + 0.6]], 1.6, 0.05, 0.05, 0.4) }),
            s('path', { class: 't31d3-tablet', d: `M${f1(b - tw)} ${f1(+y + 2)}L${f1(b + 1)} ${f1(+y + 2.5)}L${f1(b + 1)} ${f1(+y + 2 + jh * 0.95)}L${f1(b - tw + 1)} ${f1(+y + 1.5 + jh * 0.95)}Z`, fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
            s('text', { class: `t31d3-val${k ? ' now' : ''}`, x: f1(b - 3), y: f1(+y + 2 + jh * 0.68), 'text-anchor': 'end', 'font-size': f1(fs) }, String(txt)),
          ]))
        // ── the water: one column moved by the slider; its surface is the far half of a ring: a lit rim, a meniscus at
        // the cut, a lighter skin; a warm band of GGUF models just under today's surface (~211 thousand of ~3.16 million)
        const l3 = levels[2]
        const surf = ring(l3, -Math.PI / 2, Math.PI / 2, 16)
        const gh = Math.max(3, (F - l3) * 0.067)
        warm = s('g', { class: 't31d3-gguf' },
          s('rect', { x: f1(a), y: f1(l3 + 1), width: f1(sw), height: f1(gh), fill: `url(#${id}-g)` }),
          s('path', { d: stroke([[a + 1, l3 + 1 + gh], [cx, l3 + 1.5 + gh], [b - 1, l3 + 1 + gh]], 1, 0.1, 0.1, 0.3) }))
        water = s('g', { class: 't31d3-water' },
          s('rect', { class: 't31d3-body', x: f1(a), y: f1(l3), width: f1(sw), height: f1(F - l3 + (F - levels[0]) + 20), fill: `url(#${id}-w)` }),
          s('path', { class: 't31d3-skin', d: `M${surf.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')}Z` }),
          warm,
          s('path', { class: 't31d3-rim', d: stroke(surf, 2, 0.05, 0.05, 0.5) }),
          s('path', { class: 't31d3-meniscus', d: stroke([[a, l3 + 0.4], [cx, l3 + 0.8], [b, l3 + 0.4]], 1.4, 0.05, 0.05, 0.5) }),
          s('path', { class: 't31d3-sparkle', d: stroke([[a + sw * 0.12, l3 - bowAt(G, l3) * 0.4], [a + sw * 0.3, l3 - bowAt(G, l3) * 0.62]], 1.1, 0.3, 0.3, 0.2) + stroke([[a + sw * 0.66, l3 - bowAt(G, l3) * 0.66], [a + sw * 0.86, l3 - bowAt(G, l3) * 0.45]], 1.1, 0.3, 0.3, 0.2) }))
        // ── the deep below the floor: mist, the dotted courses going on, the forecast's open ring
        deep = s('g', { class: 't31d3-deep' },
          s('rect', { class: 't31d3-fog', x: f1(a - ct), y: f1(F - (F - l3) * 0.25), width: f1(sw + ct * 2), height: f1(bot - F + (F - l3) * 0.25 + 4), fill: `url(#${id}-f)` }),
          s('path', { class: 't31d3-dotted', d: dotted }),
          mist(cx, G.fog, sw * 0.6, (bot - F) * 0.42),
          s('ellipse', { class: 't31d3-o', cx: f1(cx), cy: f1(G.fog + (bot - F) * 0.22), rx: f1(sw * 0.07), ry: f1(sw * 0.07) }))
        // the moon over the mouth, and its cone down the shaft (it pools where it meets today's water)
        const mr = clamp(Math.min(kw * 0.1, (gy - top) * 0.26), 8, 26)
        const my = top + (gy - top) * 0.42
        const cone = `M${f1(cx - sw * 0.2)} ${f1(gy - 4)}L${f1(cx + sw * 0.2)} ${f1(gy - 4)}L${f1(cx + sw * 0.44)} ${f1(F)}L${f1(cx - sw * 0.44)} ${f1(F)}Z`
        const clip = `${id}-clip`
        return [
          s('defs', null,
            s('clipPath', { id: clip }, s('rect', { x: f1(x0), y: f1(top), width: f1(kw), height: f1(bot - top) })),
            s('linearGradient', { id: `${id}-w`, x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, class: 't31d3-w0' }), s('stop', { offset: 0.35, class: 't31d3-w1' }), s('stop', { offset: 1, class: 't31d3-w2' })),
            s('linearGradient', { id: `${id}-c`, x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, class: 't31d3-c0' }), s('stop', { offset: 0.6, class: 't31d3-c1' }), s('stop', { offset: 1, class: 't31d3-c2' })),
            s('linearGradient', { id: `${id}-g`, x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, class: 't31d3-g0' }), s('stop', { offset: 1, class: 't31d3-g1' })),
            s('linearGradient', { id: `${id}-f`, x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, class: 't31d3-f0' }), s('stop', { offset: 0.35, class: 't31d3-f1' }), s('stop', { offset: 1, class: 't31d3-f2' })),
            s('linearGradient', { id: `${id}-s`, x1: 0, y1: 0, x2: 1, y2: 0 }, s('stop', { offset: 0, class: 't31d3-s0' }), s('stop', { offset: 0.28, class: 't31d3-s1' }), s('stop', { offset: 0.72, class: 't31d3-s1' }), s('stop', { offset: 1, class: 't31d3-s0' }))),
          ...mount,
          s('g', { 'clip-path': `url(#${clip})` },
            s('rect', { class: 't31d3-panel', x: f1(x0), y: f1(top), width: f1(kw), height: f1(bot - top) }),
            s('rect', { class: 't31d3-sky', x: f1(x0), y: f1(top), width: f1(kw), height: f1(gy - top + 4) }),
            moon(cx, my, mr, seed + 7, true),
            mist(cx, gy - 6, kw * 0.55, 10),
            s('rect', { class: 't31d3-earth', x: f1(x0), y: f1(gy), width: f1(kw), height: f1(bot - gy) }),
            s('path', { class: 't31d3-strata', d: strata, filter: 'url(#ink-wash)' }),
            s('path', { class: 't31d3-pebble', d: pebbles }),
            s('path', { class: 'g11-wash t31d3-root', d: roots }),
            // the shaft: mortar-dark behind, the stones by shade, their dark feet and lit tops, the turn of the wall
            s('rect', { class: 't31d3-mortar', x: f1(a), y: f1(gy - 2), width: f1(sw), height: f1(bot - gy + 4) }),
            ...shade.map((d, k) => s('path', { class: `t31d3-st t31d3-st${k}`, d })),
            s('path', { class: 't31d3-foot', d: foot }),
            s('path', { class: 't31d3-lit', d: lit }),
            s('path', { class: 't31d3-dim', d: dim }),
            s('rect', { x: f1(a), y: f1(gy - 2), width: f1(sw), height: f1(bot - gy + 4), fill: `url(#${id}-s)` }),
            s('path', { class: 't31d3-cone', d: cone, fill: `url(#${id}-c)` }),
            water,
            deep,
            s('path', { class: 't31d3-cut', d: cut, fill: 'url(#p2-rock)' }),
            s('path', { class: 't31d3-cutlit', d: cutLit }),
            s('path', { class: 'g11-wash t31d3-cutline', d: stroke([[a, gy - 6], [a, F]], 1.3, 0.02, 0.1, 0.5) + stroke([[b, gy - 6], [b, F]], 1.3, 0.02, 0.1, 0.5) }),
            s('path', { class: 't31d3-mouth', d: stroke(mouth, ct * 1.4, 0.05, 0.05, 0.7), fill: 'url(#p2-rock)', filter: 'url(#ink-rough)' }),
            s('path', { class: 't31d3-mouthlit', d: stroke(mouth.slice(3, 22), Math.max(1.2, ct * 0.3), 0.2, 0.2, 0.3) }),
            s('path', { class: 'g11-wash t31d3-grass', d: grass }),
            marks, ...stones, lamp),
        ]
      }

      ctx.onCleanup(onSize(ctx.art, layout))
    },
  }
}

/** Two numbers as brushed ink bars, long and short, stacked to fit a narrow margin. */
function compare(c: NonNullable<Tide['milestones'][number]['compare']>): HTMLElement {
  const r = c.ratio && c.ratio > 0 ? c.ratio : 1
  const row = (label: string | undefined, value: string, k: number, cls: string) =>
    h('div', { class: 't31d3-cmp' },
      h('span', { class: 't31d3-cmp-l' }, label ?? ''), h('b', null, value),
      s('svg', { class: `t31d3-bar ${cls}`, viewBox: '0 0 200 14', preserveAspectRatio: 'none', style: `width:${f1(Math.max(4, k * 100))}%`, 'aria-hidden': 'true' },
        s('path', { d: stroke([[2, 7.5], [100, 6.6], [198, 7.2]], 11, 0.04, 0.12, 0.5) })))
  return h('div', { class: 't31d3-compare' }, row(c.beforeLabel, c.before, r >= 1 ? 1 / r : 1, 'before'), row(c.afterLabel, c.after, r >= 1 ? 1 : r, 'after'))
}
