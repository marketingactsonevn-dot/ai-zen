import './part2.css'
import { fill, h, nextId, s } from '../../core/dom'
import { L } from '../../core/content'
import type { Detail, SceneDef } from '../../stations/types'
import type { Perspectives } from './types'
import { blob, clamp, onDigit, onSize, p2Defs, rng, seedOf, shuffledIdx, stableHeight, stoneArt, stroke, type Pt } from './ink'
import { grass, hills, mist, moon, reeds, wash } from './paint'

/** Where the pond lies in the stage (px): a station may paint around it (a well's stones, a bridge, a far shore). */
export type PondGeo = { w: number; h: number; cx: number; cy: number; rx: number; ry: number; top: number; seed: number }

export interface PerspectiveOpts {
  /** scene name for the rail */
  label: string
  /** the instruction pill; default "Nghe từng hòn đá" */
  prompt?: string
  /** the question the stones answer, shown above what they say */
  question?: string
  /** the "more" line under the common insight */
  detail?: Detail
  /** the station's own painting behind the pond (default: far ink hills under the moon); `sky: false` = no moon above */
  art?: (g: PondGeo) => SVGElement[]
  sky?: boolean
}

const f1 = (n: number) => n.toFixed(1)

/**
 * B.7.1 Vòng đá góc nhìn: 3–5 equal stones round a moonlit pond, in a stable order seeded by the data. Touch one: it lights,
 * the moon's reflection leans its way and the reading card shows who says it, the argument, its mark and source. When
 * every stone has been heard the water stills and `common` becomes the scene's insight. Keys: Tab / Enter, digits 1–5.
 */
export function perspectiveCircle(data: Perspectives, o: PerspectiveOpts): SceneDef {
  return {
    label: o.label,
    mount(ctx) {
      const n = data.stones.length
      const seed = seedOf(data.stones.map((x) => x.who).join('|'))
      const order = shuffledIdx(n, seed) // order[k] = which view the k-th stone (clockwise, numbered k+1) holds
      const stableH = stableHeight(ctx, [data.common])
      const gid = nextId('p2c')
      p2Defs()

      const pond = s('svg', { class: 'p2c-pond', 'aria-hidden': 'true' })
      const stones = order.map((vi, k) => {
        const art = s('svg', { class: 'p2c-stone-art', viewBox: '-60 -70 120 90', 'aria-hidden': 'true' },
          s('ellipse', { class: 'p2c-halo', cx: 0, cy: -18, rx: 60, ry: 46, fill: 'url(#p2-halo)' }),
          s('ellipse', { class: 'p2c-ring', cx: 0, cy: 2, rx: 58, ry: 15 }),
          s('ellipse', { class: 'p2c-ring p2c-ring2', cx: 0, cy: 2, rx: 50, ry: 11 }),
          stoneArt(92, 58, seed + vi * 31),
          s('text', { class: 'p2c-num', x: 0, y: -24, 'text-anchor': 'middle' }, String(k + 1)))
        return h('button', { class: 'p2c-stone', type: 'button', style: `--i:${k}`, 'aria-pressed': 'false', 'aria-label': fill(L.stoneN, { n: k + 1 }), onClick: () => pick(k) }, art)
      })
      const ring = h('div', { class: 'p2c-stones', role: 'group', 'aria-label': L.perspectives }, ...stones)
      const stage = h('div', { class: 'p2c-stage' }, pond, ring)
      const dots = order.map(() => h('i'))
      const count = h('p', { class: 'p2c-count' }, h('span', { class: 'p2c-dots', 'aria-hidden': 'true' }, ...dots), h('span', null, fill(L.heard, { n: 0, total: n })))
      const body = h('div', { class: 'p2c-body-text' })
      const card = h('div', { class: 'p2c-card' },
        o.question ? h('p', { class: 'p2-question' }, o.question) : null,
        body,
        count)
      card.hidden = !o.question
      const root = h('div', { class: 'p2c p2-astir' }, stage, card)
      ctx.art.append(root)
      ctx.prompt(o.prompt ?? L.perspectivesPrompt)

      const heard = new Set<number>()
      let sel = -1
      let geo: { cx: number; cy: number; rx: number; ry: number; pts: Pt[] } | null = null
      let reflect: SVGGElement | null = null
      let ripples: SVGGElement | null = null

      function pick(k: number) {
        if (k < 0 || k >= n) return
        if (sel >= 0) stones[sel].setAttribute('aria-pressed', 'false')
        sel = k
        const st = data.stones[order[k]]
        stones[k].setAttribute('aria-pressed', 'true')
        stones[k].setAttribute('aria-label', fill(L.stoneHeard, { n: k + 1, who: st.who }))
        stones[k].dataset.heard = ''
        heard.add(k)
        dots[k].className = 'on'
        body.replaceChildren(
          h('p', { class: 'p2c-who' }, h('span', { class: 'p2c-who-label' }, L.whoSays), st.who),
          ctx.fact(st.view, 'p', 'p2c-view'))
        ;(count.lastChild as HTMLElement).textContent = fill(L.heard, { n: heard.size, total: n })
        const first = card.hidden || !card.hasAttribute('aria-live')
        card.hidden = false
        if (first) card.setAttribute('aria-live', 'polite') // after the first fill: not read out on entering the scene
        lean(k)
        if (heard.size === n && !root.classList.contains('p2-still')) {
          root.classList.replace('p2-astir', 'p2-still')
          ctx.insight(data.common, o.detail)
          ctx.chime('ok')
        } else ctx.chime('soft')
      }

      // the reflection leans toward the stone that speaks; ripples run out from the bank in front of it
      function lean(k: number) {
        if (!geo || !reflect) return
        const [x, y] = geo.pts[k]
        const still = heard.size === n
        const dx = still ? 0 : clamp((x - geo.cx) / geo.rx, -1, 1) * geo.rx * 0.12
        const rot = still ? 0 : clamp((x - geo.cx) / geo.rx, -1, 1) * 7
        reflect.style.transform = `translate(${f1(dx)}px, ${f1(still ? 0 : (y - geo.cy) / geo.ry * geo.ry * 0.06)}px) rotate(${f1(rot)}deg)`
        if (ctx.reduced || !ripples) return
        const a = Math.atan2((y - geo.cy) / geo.ry, (x - geo.cx) / geo.rx)
        const ex = geo.cx + Math.cos(a) * geo.rx * 0.78, ey = geo.cy + Math.sin(a) * geo.ry * 0.78
        const g = s('g', { class: 'p2c-ripple', transform: `translate(${f1(ex)} ${f1(ey)})` },
          ...[0, 1, 2].map((i) => s('ellipse', { rx: f1(geo!.rx * 0.2), ry: f1(geo!.ry * 0.2), style: `animation-delay:${i * 0.35}s` })))
        ripples.replaceChildren(g)
      }

      function layout() {
        const W = ctx.art.clientWidth
        const H = stableH(ctx.art.clientHeight)
        if (W < 40 || H < 40) return
        root.style.height = `${f1(H)}px`
        const wide = W / H > 1.15
        root.classList.toggle('wide', wide)
        // the stage: left of the card on wide screens (the pair centred), above it on tall ones
        const gap = clamp(W * 0.035, 20, 48)
        const cardW = wide ? Math.min(380, W * 0.36) : W
        const sw = wide ? Math.min(W - cardW - gap, H * 1.55) : W
        const sh = wide ? H : Math.min(H * 0.56, W * 0.92)
        const x0 = wide ? (W - sw - gap - cardW) / 2 : 0
        Object.assign(stage.style, { left: `${f1(x0)}px`, width: `${f1(sw)}px`, height: `${f1(sh)}px` })
        Object.assign(card.style, wide ? { width: `${f1(cardW)}px`, maxHeight: `${f1(H)}px`, top: '50%', left: `${f1(x0 + sw + gap)}px`, transform: 'translateY(-50%)' }
          : { width: `${f1(W)}px`, maxHeight: `${f1(H - sh - 24)}px`, top: `${f1(sh + 6)}px`, left: '0px', transform: 'none' })

        let bw = clamp(Math.min(sw, sh * 1.7) * 0.19, 64, 140)
        let bh = (bw * 90) / 120
        let rx = Math.min(sw / 2 - bw * 1.15, (sh / 2 - bh * 1.2) / 0.46, bw * 2.3)
        if (rx < 50) {
          bw = 60
          bh = (bw * 90) / 120
          rx = Math.max(40, Math.min(sw / 2 - bw * 1.1, (sh / 2 - bh * 1.15) / 0.46))
        }
        const ry = rx * 0.42
        const cx = sw / 2, cy = sh / 2 + bh * 0.12
        const RX = rx + bw * 0.62, RY = ry + bh * 0.56
        const pts: Pt[] = order.map((_, k) => {
          const a = ((-90 + 180 / n + (k * 360) / n) * Math.PI) / 180
          return [cx + RX * Math.cos(a), cy + RY * Math.sin(a)]
        })
        geo = { cx, cy, rx, ry, pts }
        stones.forEach((b, k) => {
          const [x, y] = pts[k]
          Object.assign(b.style, { left: `${f1(x - bw / 2)}px`, top: `${f1(y - bh * (70 / 90))}px`, width: `${f1(bw)}px`, height: `${f1(bh)}px`, zIndex: String(Math.round(y)) })
        })
        drawPond(sw, sh, cx, cy, rx, ry)
        if (sel >= 0) lean(sel)
      }

      function drawPond(w: number, hh: number, cx: number, cy: number, rx: number, ry: number) {
        pond.setAttribute('viewBox', `0 0 ${f1(w)} ${f1(hh)}`)
        const r = rng(seed)
        const water = blob(cx, cy, rx, ry, seed, 0.05)
        const glints = (k: number) => {
          const rr = rng(seed + k)
          let d = ''
          for (let i = 0; i < 16; i++) {
            const y = cy - ry * 0.7 + (i / 15) * ry * 1.4
            const near = 1 - Math.abs(y - cy) / (ry * 0.9)
            if (near <= 0.05 || rr() > 0.4 + near * 0.6) continue
            const len = rx * (0.06 + near * 0.22) * (0.5 + rr())
            const x = cx + (rr() - 0.5) * rx * 0.5
            d += `M${f1(x - len / 2)} ${f1(y)}h${f1(len)}`
          }
          return d
        }
        const mr = rx * 0.17
        reflect = s('g', { class: 'p2c-reflect' },
          s('ellipse', { class: 'p2c-moon', cx: f1(cx), cy: f1(cy - ry * 0.08), rx: f1(mr), ry: f1(mr * 0.5) }),
          s('path', { class: 'p2c-moon-cut', d: `M${f1(cx - mr * 1.2)} ${f1(cy - ry * 0.02)}h${f1(mr * 2.4)}M${f1(cx - mr * 1.2)} ${f1(cy - ry * 0.18)}h${f1(mr * 2.4)}` }))
        reflect.style.transformOrigin = `${f1(cx)}px ${f1(cy)}px`
        ripples = s('g')
        // raked sand: each ring a few brush passes with dry gaps
        const rake = [1.2, 1.42, 1.66, 1.92].map((k, i) => {
          let d = ''
          let a = r() * 40
          while (a < 360 + 20) {
            const len = 50 + r() * 90
            d += stroke(arcPts(cx, cy + ry * 0.04 * i, rx * k, ry * k * 1.08, a, Math.min(a + len, a + 360 - 4)), 1.3 + r() * 0.9, 0.2, 0.2, 0.1)
            a += len + 8 + r() * 26
          }
          return s('path', { class: 'p2c-rake', d })
        })
        // the far side: ink hills under the moon (or the station's own), mist on the far bank
        const top = cy - ry * 1.35
        const sr = clamp(rx * 0.13, 10, 26)
        const my = Math.max(sr * 1.6, top - ry * 1.5)
        const sky = o.sky !== false && my + sr * 2 < top
        const back = o.art ? o.art({ w, h: hh, cx, cy, rx, ry, top, seed }) : [
          mist(cx, cy - ry * 1.3, w * 0.62, ry * 1.1), // the moonlit sky behind the ridges, so they read at night
          hills(-w * 0.05, w * 1.05, cy - ry * 0.7, Math.min(ry * 1.5, cy - ry * 0.7 - (sky ? my + sr : 0)), seed, 0.85, 5),
          hills(w * 0.05, w * 0.62, cy - ry * 0.6, ry * 0.9, seed + 2, 0.55, 2),
          mist(cx, cy - ry * 0.75, rx * 2.4, ry * 0.5),
        ]
        pond.replaceChildren(
          sky ? moon(cx + rx * 0.12, my, sr, seed, true) : '',
          ...back,
          s('defs', null,
            s('radialGradient', { id: `${gid}-water`, cx: '0.5', cy: '0.42', r: '0.62' },
              s('stop', { offset: 0, style: 'stop-color:var(--water);stop-opacity:.72' }),
              s('stop', { offset: 1, style: 'stop-color:var(--water);stop-opacity:1' })),
            s('radialGradient', { id: `${gid}-road`, cx: '0.5', cy: '0.5', r: '0.5' },
              s('stop', { offset: 0, style: 'stop-color:var(--moon);stop-opacity:.34' }),
              s('stop', { offset: 1, style: 'stop-color:var(--moon);stop-opacity:0' })),
            s('clipPath', { id: `${gid}-clip` }, s('path', { d: water }))),
          ...rake,
          s('path', { class: 'p2c-bank', d: blob(cx + rx * 0.02, cy + ry * 0.1, rx * 1.05, ry * 1.12, seed + 5, 0.05), filter: 'url(#ink-wash)' }),
          wash(blob(cx - rx * 0.5, cy + ry * 0.98, rx * 0.5, ry * 0.18, seed + 6, 0.2), 0.18, 'p2p-wash p2c-moss'),
          s('path', { d: water, fill: `url(#${gid}-water)` }),
          s('g', { 'clip-path': `url(#${gid}-clip)` },
            s('ellipse', { cx: f1(cx), cy: f1(cy), rx: f1(rx * 0.42), ry: f1(ry * 1.1), fill: `url(#${gid}-road)` }),
            s('ellipse', { class: 'p2c-far', cx: f1(cx), cy: f1(cy - ry * 0.95), rx: f1(rx * 1.1), ry: f1(ry * 0.5) }),
            reflect,
            s('path', { class: 'p2c-glint p2c-glint-a', d: glints(3) }),
            s('path', { class: 'p2c-glint p2c-glint-b', d: glints(17) }),
            ripples),
          s('path', { class: 'p2c-rim', d: stroke(arcPts(cx, cy, rx * 1.01, ry * 1.02, 196 + r() * 8, 340 - r() * 10), Math.max(2, rx * 0.022)) }),
          s('path', { class: 'p2c-rim p2c-rim-near', d: stroke(arcPts(cx, cy, rx * 1.02, ry * 1.04, 18 + r() * 8, 160 - r() * 8), Math.max(1.6, rx * 0.016)) }),
          s('path', { class: 'p2c-shine', d: stroke(arcPts(cx, cy, rx * 0.97, ry * 0.94, 200 + r() * 10, 300 + r() * 20), Math.max(1.2, rx * 0.012), 0.3, 0.3, 0.1) }),
          pad(cx - rx * 0.58, cy + ry * 0.42, Math.max(5, rx * 0.07), 20),
          pad(cx - rx * 0.47, cy + ry * 0.6, Math.max(3, rx * 0.045), -35),
          pad(cx + rx * 0.62, cy - ry * 0.28, Math.max(4, rx * 0.05), 70),
          reeds(cx - rx * 0.98, cy + ry * 0.35, Math.max(18, ry * 0.9), seed + 7, 8),
          reeds(cx + rx * 0.9, cy - ry * 0.55, Math.max(14, ry * 0.6), seed + 8, 5),
          grass(cx + rx * 0.35, cy + ry * 1.08, Math.max(12, rx * 0.12), seed + 9),
          grass(cx - rx * 0.15, cy + ry * 1.1, Math.max(10, rx * 0.09), seed + 10))
      }

      ctx.onCleanup(onSize(ctx.art, layout))
      ctx.onCleanup(onDigit((d) => pick(d - 1)))
    },
  }
}

const arcPts = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number): Pt[] =>
  Array.from({ length: 25 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / 24) * Math.PI) / 180
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]
  })

function pad(x: number, y: number, r: number, rot: number) {
  return s('path', { class: 'p2c-pad', d: `M${f1(x)} ${f1(y)}m${f1(r)} 0a${f1(r)} ${f1(r * 0.55)} 0 1 1 ${f1(-r * 0.3)} ${f1(-r * 0.42)}L${f1(x)} ${f1(y)}z`, transform: `rotate(${rot} ${f1(x)} ${f1(y)})` })
}
