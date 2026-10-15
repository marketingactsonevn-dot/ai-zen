import { h, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { C } from './data'
import { arc, clamp, ell, lantern, peaks, place, rng, stable, stroke, wash, watch, type Pt } from './ink'

const S = C.scenes.dawn
const VW = 1000
const VH = 600
const POND = { cx: 500, cy: 468, rx: 560, ry: 104 }
type Kind = 'good' | 'bad'
const AT: Record<Kind, { from: Pt; to: Pt }> = {
  good: { from: [424, 548], to: [430, 452] },
  bad: { from: [578, 550], to: [590, 470] },
}

/** A small lotus flower: three petal strokes and a soft heart, opening from nothing. */
function lotus(x: number, y: number, k: number) {
  const g = s('g', { opacity: 0 })
  const petal = (dx: number, tilt: number) =>
    s('path', { class: 'petal', d: `M${x} ${y}C${x + dx - 6 * k} ${y - 4 * k} ${x + dx - 4 * k + tilt} ${y - 16 * k} ${x + dx + tilt} ${y - 20 * k}C${x + dx + 4 * k + tilt} ${y - 16 * k} ${x + dx + 6 * k} ${y - 4 * k} ${x} ${y}Z` })
  g.append(
    s('path', { class: 'm', 'fill-opacity': 0.55, d: ell(x, y + 2 * k, 18 * k, 4.5 * k) }),
    petal(-7 * k, -5 * k), petal(7 * k, 5 * k), petal(0, 0),
    s('path', { class: 'v', 'fill-opacity': 0.6, d: ell(x, y - 6 * k, 2.2 * k, 1.6 * k) }),
  )
  return g
}

export function dawnScene(ctx: SceneCtx) {
  const low = ctx.quality === 'low'
  const r = rng(30)
  // five stacked layers with one shared viewBox: what moves never shares an SVG with a filtered ink layer,
  // so the brushwork is painted once and only the light, the mist and the water are repainted
  const mk = () => s('svg', { class: 't18w-svg', viewBox: `0 0 ${VW} ${VH}`, preserveAspectRatio: 'xMidYMax slice', 'aria-hidden': 'true' })
  const svg = mk()
  const hills = mk()
  const fog = mk()
  const still = mk()
  const live = mk()
  const layers = [svg, hills, fog, still, live]
  const f = (id: string) => (low ? null : { filter: `url(#${id})` })
  svg.append(s('defs', null,
    s('linearGradient', { id: 't18w-sky', x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, class: 'sk0' }), s('stop', { offset: 1, class: 'sk1' })),
    s('linearGradient', { id: 't18w-warm', x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0.15, class: 'wm0' }), s('stop', { offset: 0.78, class: 'wm1' }), s('stop', { offset: 1, class: 'wm0' })),
    s('radialGradient', { id: 't18w-ink' }, s('stop', { offset: 0, class: 'ik0' }), s('stop', { offset: 0.6, class: 'ik1' }), s('stop', { offset: 1, class: 'ik2' })),
    s('radialGradient', { id: 't18w-mist' }, s('stop', { offset: 0, class: 'ms0' }), s('stop', { offset: 0.55, class: 'ms1' }), s('stop', { offset: 1, class: 'ms2' })),
    s('radialGradient', { id: 't18w-halo' }, s('stop', { offset: 0, class: 'hl0' }), s('stop', { offset: 1, class: 'hl1' })),
    s('clipPath', { id: 't18w-pond' }, s('path', { d: ell(POND.cx, POND.cy, POND.rx, POND.ry) }))))

  // sky: cool before dawn; a warm wash rises with the sun
  svg.append(s('rect', { x: -900, y: -50, width: VW + 1800, height: VH + 100, fill: 'url(#t18w-sky)' }))
  const warm = s('rect', { x: -900, y: -50, width: VW + 1800, height: 470, fill: 'url(#t18w-warm)', opacity: 0 })
  svg.append(warm)
  const halo = s('circle', { cx: 500, cy: 300, r: 190, fill: 'url(#t18w-halo)', opacity: 0 })
  const sun = s('circle', { class: 'sun', cx: 500, cy: 300, r: 44 })
  const sunG = s('g', null, halo, sun)
  svg.append(sunG)
  // ridges in front of the rising sun
  const far = s('g', f('ink-wash'))
  const near = s('g', f('ink-wash'))
  for (const d of peaks(r, -700, 1700, 330, 40, 110, 120)) far.append(s('path', { d, class: 'k', 'fill-opacity': 0.08 }))
  for (const d of peaks(r, -700, 1700, 352, 24, 70, 140)) near.append(s('path', { d, class: 'k', 'fill-opacity': 0.13 }))
  hills.append(far, near)
  // mist lying on the water line
  const mist = s('g', { class: 't18w-mist' })
  for (const [x, y, rx, ry] of [[260, 350, 360, 36], [720, 344, 400, 32], [500, 372, 560, 30]]) mist.append(s('ellipse', { cx: x, cy: y, rx, ry, fill: 'url(#t18w-mist)' }))
  fog.append(mist)

  // the pond
  const pond = s('g', { 'clip-path': 'url(#t18w-pond)' })
  const water = s('g', { 'clip-path': 'url(#t18w-pond)' })
  pond.append(s('path', { class: 'k', 'fill-opacity': 0.05, d: ell(POND.cx, POND.cy, POND.rx, POND.ry) }))
  const refl = s('g', { opacity: 0.25 })
  for (let i = 0; i < 9; i++) {
    const y = 378 + i * 11
    const w = 70 - i * 5 + r() * 12
    refl.append(stroke([[500 - w / 2, y], [500 + w / 2, y + 0.5]], 3 - i * 0.18, 'v', { a: 0.3, b: 0.3, min: 0.3 }, 0.5 - i * 0.04))
  }
  water.append(refl)
  const lines = s('g', f('ink-rough'))
  for (let i = 0; i < 18; i++) {
    const x = 60 + r() * 880
    const y = 380 + r() * 170
    const l = 24 + r() * 70
    lines.append(stroke([[x, y], [x + l / 2, y - 0.8], [x + l, y]], 1 + r(), 'k3', { a: 0.3, b: 0.4 }, 0.5))
  }
  pond.append(lines)
  // lily pads that will flower
  const pads: Pt[] = [[318, 452], [392, 504], [640, 440], [712, 496], [520, 522]]
  for (const [x, y] of pads) pond.append(s('path', { class: 'm', 'fill-opacity': 0.42, d: `M${x} ${y}m-22 0a22 5.6 0 1 0 44 0a22 5.6 0 0 0 -18 -5L${x} ${y}Z` }))
  const ripples = s('g')
  const inkG = s('g')
  water.append(inkG, ripples)
  const flowers = pads.slice(0, 4).map(([x, y]) => lotus(x, y - 1, 1.15))
  water.append(...flowers)
  still.append(pond)
  live.append(water)
  // the near bank, a pine bough from the left, a stone lantern on the far right bank
  const bank = s('g', f('ink-wash'))
  bank.append(wash('M-800 600L-800 528C-300 520 120 514 300 538C420 536 460 534 500 534C700 530 860 512 1060 526C1300 530 1600 522 1800 528L1800 600Z', 0.16), wash(ell(500, 540, 240, 14), 0.08))
  still.append(bank)
  const ink = s('g', f('ink-rough'))
  ink.append(
    stroke([[-600, 528], [-200, 522], [180, 522], [340, 534], [500, 530], [680, 528], [860, 516], [1200, 526], [1600, 522]], 2.4, 'k', { a: 0.04, b: 0.1 }, 0.6),
  )
  // the stone lantern on the far bank (moves in on portrait screens)
  const lan = lantern(902, 382, 1.05)
  const lanW = s('g', f('ink-wash'), wash(ell(942, 388, 120, 8), 0.1), lan.wash)
  const lanI = s('g', f('ink-rough'), lan.ink)
  const lamp = lan.lamp
  const lanL = s('g', null, lamp)
  still.append(ink, lanW, lanI)
  live.append(lanL)
  // the two pebbles
  const pebble = (k: Kind) => {
    const [x, y] = AT[k].from
    const g = s('g', { class: `peb ${k}` },
      s('path', { class: 'k', 'fill-opacity': 0.18, d: ell(x + 4, y + 7, 22, 5) }),
      s('path', { class: 'body', d: `M${x - 19} ${y + 3}C${x - 21} ${y - 9} ${x - 6} ${y - 14} ${x + 4} ${y - 13}C${x + 16} ${y - 12} ${x + 22} ${y - 4} ${x + 19} ${y + 4}C${x + 15} ${y + 10} ${x - 14} ${y + 11} ${x - 19} ${y + 3}Z` }),
      stroke(arc(x, y - 1, 19, 10, 10, 170, 14), 2.2, 'k', { a: 0.1, b: 0.3 }, 0.7),
      s('path', { class: 'shine', d: ell(x - 7, y - 7, 6, 2.4) }))
    live.append(g)
    return g
  }
  const peb = { good: pebble('good'), bad: pebble('bad') }
  const falling = s('g')
  live.append(falling)

  const btn = (k: Kind) => h('button', { class: `t18w-peb ${k}`, type: 'button', 'aria-label': k === 'good' ? S.goodAria : S.badAria, onClick: () => drop(k) }, h('span', { class: 't18w-lab' }, k === 'good' ? S.good : S.bad))
  const btns = { good: btn('good'), bad: btn('bad') }
  const status = h('p', { class: 'visually-hidden', 'aria-live': 'polite' })
  const pic = h('div', { class: 't18w-pic' }, ...layers)
  const root = h('div', { class: 't18 t18w' }, h('p', { class: 'visually-hidden' }, S.art), pic, h('div', { role: 'group', 'aria-label': S.group }, btns.good, btns.bad), status)
  ctx.art.append(root)
  const st = stable(ctx, [S.insight], root)

  // ───────── light: 0 = before dawn, 1 = sunrise ─────────
  const light = { d: 0 }
  const paint = () => {
    const d = light.d
    sun.setAttribute('cy', String(352 - 130 * d))
    halo.setAttribute('cy', String(352 - 130 * d))
    halo.setAttribute('opacity', String(0.2 + 0.8 * d))
    warm.setAttribute('opacity', String(d))
    refl.setAttribute('opacity', String(0.15 + 0.85 * d))
    mist.setAttribute('opacity', String(1 - 0.75 * d))
    lamp.setAttribute('fill-opacity', String(0.62 - 0.45 * d))
  }
  const dawnTo = (d: number, dur: number) => {
    if (ctx.reduced) {
      light.d = d
      paint()
    } else ctx.anim(() => gsap.to(light, { d, duration: dur, ease: 'sine.inOut', onUpdate: paint }))
  }
  paint()

  function layout() {
    st.apply()
    const W = root.clientWidth
    const H = root.clientHeight
    // very wide, short boxes keep the whole story (sun to pebbles) rather than crop it;
    // portrait screens look at the middle of the pond, where the flowers and the pebbles are
    const meet = W / H > VW / 440
    const tall = W / H < 1
    const vb = meet ? { x: 0, y: 150, w: VW, h: 440 } : tall ? { x: 250, y: 0, w: 500, h: VH } : { x: 0, y: 0, w: VW, h: VH }
    for (const l of layers) {
      l.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`)
      l.setAttribute('preserveAspectRatio', meet ? 'xMidYMid meet' : 'xMidYMax slice')
    }
    const shift = tall ? 'translate(-196 6)' : ''
    for (const g of [lanW, lanI, lanL]) g.setAttribute('transform', shift)
    const k = meet ? Math.min(W / vb.w, H / vb.h) : Math.max(W / vb.w, H / vb.h)
    const ox = (W - vb.w * k) / 2 - vb.x * k
    const oy = (meet ? (H - vb.h * k) / 2 : H - vb.h * k) - vb.y * k
    // two hit areas that never overlap and never shrink under 44 px
    const gap = (AT.bad.from[0] - AT.good.from[0]) * k
    const w = clamp(52 * k, 46, Math.max(46, gap - 8))
    const hh = Math.max(46, 34 * k)
    for (const kd of ['good', 'bad'] as Kind[]) {
      const [x, y] = AT[kd].from
      place(btns[kd], ox + x * k - w / 2, Math.min(H - hh - 2, oy + (y - 4) * k - hh / 2), w, hh)
    }
  }

  // ───────── a pebble falls; the pond carries its ripple everywhere ─────────
  const dropped = new Set<Kind>()
  function drop(k: Kind) {
    if (dropped.has(k)) return
    dropped.add(k)
    // keep the keyboard in the garden: hand focus to the other pebble before this one goes
    const other = btns[k === 'good' ? 'bad' : 'good']
    if (document.activeElement === btns[k] && !other.disabled) other.focus({ preventScroll: true })
    btns[k].disabled = true
    btns[k].classList.add('gone')
    ctx.chime(k === 'good' ? 'ok' : 'low')
    status.textContent = k === 'good' ? S.goodDone : S.badDone
    const { from, to } = AT[k]
    const color = k === 'good' ? 'rg' : 'rb'
    const rings = Array.from({ length: 7 }, () => s('path', { class: `ring ${color}`, d: ell(to[0], to[1], 10, 2.4), opacity: 0 }))
    ripples.append(...rings)
    const both = dropped.size === 2
    const finish = () => {
      if (both) {
        dawnTo(1, 4)
        const box = ctx.insight(S.insight, S.detail)
        if (!document.activeElement || document.activeElement === document.body || (document.activeElement as HTMLButtonElement).disabled) {
          box.querySelector<HTMLElement>('.insight-more')?.focus({ preventScroll: true })
        }
      } else {
        dawnTo(0.45, 3)
        ctx.prompt(S.next)
      }
    }
    if (ctx.reduced) {
      peb[k].setAttribute('opacity', '0')
      rings.forEach((rg, i) => {
        rg.setAttribute('opacity', String(0.5 - i * 0.06))
        rg.setAttribute('transform', `translate(${to[0]} ${to[1]}) scale(${4 + i * 7}) translate(${-to[0]} ${-to[1]})`)
      })
      if (k === 'good') flowers.forEach((fl) => fl.setAttribute('opacity', '1'))
      else inkG.append(...[0, 1, 2].map((i) => s('ellipse', { cx: to[0] + (i - 1) * 90, cy: to[1] + i * 8, rx: 200, ry: 46, fill: 'url(#t18w-ink)', opacity: 0.55 })))
      finish()
      return
    }
    ctx.anim(() => {
      const tl = gsap.timeline()
      // the throw: a short arc from the bank
      const p = { t: 0 }
      tl.to(peb[k], { opacity: 0, duration: 0.2 }, 0)
      const stone = s('path', { class: `fly ${k}`, d: ell(0, 0, 7, 4.5) })
      falling.append(stone)
      tl.to(p, {
        t: 1, duration: 0.85, ease: 'power1.in',
        onUpdate: () => {
          const x = from[0] + (to[0] - from[0]) * p.t
          const y = from[1] + (to[1] - from[1]) * p.t - Math.sin(Math.PI * p.t) * 90
          stone.setAttribute('transform', `translate(${x} ${y}) scale(${1 - 0.45 * p.t})`)
        },
      }, 0)
      tl.set(stone, { opacity: 0 }, 0.85)
      // splash
      for (let i = 0; i < 6; i++) {
        const a = Math.PI * (1.15 + (i / 5) * 0.7)
        const d = s('circle', { class: `drop ${k}`, cx: to[0], cy: to[1], r: 2.2, opacity: 0 })
        falling.append(d)
        tl.fromTo(d, { opacity: 1, x: 0, y: 0 }, { keyframes: [{ x: Math.cos(a) * 26, y: Math.sin(a) * 34, duration: 0.35, ease: 'power2.out' }, { y: 4, opacity: 0, duration: 0.35, ease: 'power2.in' }] }, 0.86)
      }
      // the ripple keeps going — far past where a pebble's ripple should stop
      rings.forEach((rg, i) => {
        tl.fromTo(rg, { scale: 1, opacity: 0.85, svgOrigin: `${to[0]} ${to[1]}` },
          { scale: 34 + i * 6, opacity: 0, duration: 5.5, ease: 'power1.out' }, 0.9 + i * 0.42)
      })
      if (k === 'good') {
        flowers.forEach((fl, i) => {
          const [x, y] = pads[i]
          const dist = Math.hypot((x - to[0]) / 1, (y - to[1]) * 4.2)
          tl.fromTo(fl, { opacity: 0, scale: 0.2, svgOrigin: `${x} ${y}` }, { opacity: 1, scale: 1, duration: 1.4, ease: 'back.out(2)' }, 1.2 + dist / 260)
        })
      } else {
        // a drop of ink blooms through the water
        for (let i = 0; i < 5; i++) {
          const cx = to[0] + (r() - 0.5) * 60
          const cy = to[1] + (r() - 0.3) * 14
          const e = s('ellipse', { cx, cy, rx: 220 + r() * 120, ry: 40 + r() * 16, fill: 'url(#t18w-ink)', opacity: 0 })
          inkG.append(e)
          tl.fromTo(e, { scale: 0.04, opacity: 0.9, svgOrigin: `${to[0]} ${to[1]}` },
            { scale: 1, x: (i - 2) * 46, opacity: 0.42, duration: 5 + i * 0.6, ease: 'power2.out' }, 1 + i * 0.25)
          // the water slowly settles, but never quite forgets
          tl.to(e, { opacity: 0.2, duration: 8, ease: 'sine.inOut' }, 7 + i * 0.25)
        }
      }
      tl.add(finish, 2.4)
    })
  }

  watch(
    ctx,
    () => {
      st.reset()
      layout()
    },
    true,
  )
  ctx.prompt(S.prompt)
  if (!ctx.reduced) {
    gsap.from(pic, { opacity: 0, duration: 2, ease: 'power1.out' })
    // the mist drifts a little while you decide
    ctx.anim(() => gsap.to(mist, { x: 26, duration: 9, ease: 'sine.inOut', yoyo: true, repeat: -1 }))
  }
}
