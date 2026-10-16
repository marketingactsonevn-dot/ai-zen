import raw from '../../content/tram-33.json'
import { h, s } from '../../core/dom'
import type { Fact } from '../../core/content'
import { blob, clamp, onSize, rng, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist, moon, water } from '../../ui/part2/paint'
import { newsStones } from '../../ui/part2/news'
import type { SceneCtx } from '../types'
import './stones.css'
import { f1, lantern, P, reedClump, t33Defs } from './kit'

const K = raw.scenes.stones
/** depth of each stele along the path (0 near, cut by the frame; 1 middle; 2 far, small in the mist) */
const DEPTH = [1, 0, 2, 1, 2, 0]

/** A standing paper lantern (andon) on four legs (viewBox 0 0 40 72): the shade the "verified only" filter turns on. */
const andon = () => s('svg', { class: 't33s-andon', viewBox: '0 0 40 72', 'aria-hidden': 'true' },
  s('ellipse', { class: 't33s-andonpool', cx: 20, cy: 70, rx: 26, ry: 4 }),
  s('circle', { class: 't33s-andonhalo', cx: 20, cy: 30, r: 30 }),
  s('path', { class: 't33s-andonleg', d: 'M8 52L6 70M32 52L34 70M13 54L12 69M27 54L28 69' }),
  s('path', { class: 't33s-andonpaper', d: 'M8 12L32 12L33 54L7 54Z' }),
  s('path', { class: 't33s-andonlit', d: 'M10 14L30 14L31 52L9 52Z' }),
  s('path', { class: 't33s-andonframe', d: 'M7 12h26M7 54h26M8 12v42M32 12v42M7 33h26M20 12v42' }),
  s('path', { class: 't33s-andoncap', d: 'M5 10L35 10L32 6L8 6Z' }))

/**
 * Scene 5 — the news steles as an emaki along the night shore: the pond and its moon road behind, steles at three depths
 * (near ones large and cut by the frame, far ones small in the mist), real stone thickness that shows as they pass and turn,
 * a low lantern that moves to the stele in the middle, and the "verified only" filter as a standing lantern shade on the path.
 */
export function stonesScene(ctx: SceneCtx) {
  t33Defs()
  const far = s('svg', { class: 't33s-layer t33s-far', 'aria-hidden': 'true' })
  const pond = s('svg', { class: 't33s-layer t33s-pond', 'aria-hidden': 'true' })
  const near = s('svg', { class: 't33s-layer t33s-near', 'aria-hidden': 'true' })
  const back = h('div', { class: 't33 t33s-back t33-fade', 'aria-hidden': 'true' }, far, pond)
  ctx.art.append(back)
  newsStones({ label: K.label, tags: raw.newsTags, prompt: K.prompt, insight: K.insight as Fact, detail: K.detail }).mount(ctx)
  const root = ctx.art.querySelector<HTMLElement>('.p2n')
  const path = root?.querySelector<HTMLElement>('.p2n-path')
  if (!root || !path) return
  root.classList.add('t33', 't33s')
  root.setAttribute('aria-label', K.aria)
  root.setAttribute('role', 'group')
  ctx.art.append(h('div', { class: 't33s-front t33-fade', 'aria-hidden': 'true' }, near))
  const lamp = h('li', { class: 't33s-lamp', 'aria-hidden': 'true', role: 'presentation' }, h('span', { class: 't33s-cord' }), lantern('on', 3341))
  path.append(lamp)
  const steles = [...path.querySelectorAll<HTMLElement>('.p2n-stele')]
  steles.forEach((li, i) => {
    li.classList.add(`t33s-z${DEPTH[i % DEPTH.length]}`)
    // the stone's own thickness: two side faces hinged on the slab's edges, seen as the stele passes off-centre or turns
    li.querySelector('.p2n-flip')?.append(h('span', { class: 't33s-edge t33s-el', 'aria-hidden': 'true' }), h('span', { class: 't33s-edge t33s-er', 'aria-hidden': 'true' }))
  })
  // the filter becomes a paper shade standing on the path, its words written under it
  const only = root.querySelector<HTMLElement>('.p2n-only')
  if (only) {
    only.prepend(andon())
    root.append(only)
  }

  // ── the shore, drawn per layout: far ranges, the pond with soft banks, raked ground, reeds in front
  let mids: number[] = []
  let pathW = 0
  ctx.onCleanup(onSize(root, () => {
    const W = root.clientWidth, H = root.clientHeight
    if (W < 40 || H < 40) return
    const mobile = W < 640
    mids = steles.map((li) => li.offsetLeft + li.offsetWidth / 2)
    pathW = path.clientWidth
    const shore = H * (mobile ? 0.36 : 0.42), bank = H * (mobile ? 0.6 : 0.68)
    const mr = clamp(W * 0.024, 14, 30)
    const r = rng(3342)
    const big = W * 1.6
    for (const g of [far, pond, near]) g.setAttribute('viewBox', `0 0 ${f1(big)} ${H}`), g.setAttribute('width', f1(big)), g.setAttribute('height', String(H))
    far.replaceChildren(
      mist(big * 0.5, shore - H * 0.06, big * 0.6, H * 0.14),
      moon(W * 0.8, Math.max(mr * 2.6, H * 0.14), mr, 3343, true),
      hills(-W * 0.1, big, shore, H * 0.2, 3344, 0.92, 9),
      hills(W * 0.2, big * 0.9, shore + 4, H * 0.12, 3345, 0.66, 5),
      mist(big * 0.5, shore + 2, big * 0.6, H * 0.035))
    // the water: its far edge under the mist, its near bank a wavy line of wet sand; nothing square about it
    // a long lake, flat in the middle and closing in curved shores at both ends (nothing square about it)
    const q = rng(3346), xc = big * 0.46, hw = big * 0.44, mid = (shore + bank) / 2
    const lake = (sgn: number, amp: number): Pt[] => Array.from({ length: 41 }, (_, i) => {
      const u = -1 + (i / 40) * 2, e = Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(u), 6)))
      return [xc + u * hw, mid + sgn * (sgn < 0 ? mid - shore : bank - mid) * e + Math.sin(i * 1.3 + q() * 2) * amp * e] as Pt
    })
    const top = lake(-1, 1.5), bot = lake(1, H * 0.01)
    const waterD = `M${top.map(P).join('L')}L${[...bot].reverse().map(P).join('L')}Z`
    let rake = ''
    for (let i = 0; i < 9; i++) {
      const y = bank + 8 + i * (6 + i * 1.6)
      for (let x = -10; x < big; ) {
        const len = 70 + r() * 180
        rake += stroke([[x, y + (r() - 0.5)], [x + len, y + (r() - 0.5)]], 1 + r() * 0.6, 0.15, 0.15, 0.1)
        x += len + 6 + r() * 24
      }
    }
    pond.replaceChildren(
      s('defs', null, s('clipPath', { id: 't33s-waterclip' }, s('path', { d: waterD }))),
      s('path', { class: 't33s-water', d: waterD }),
      s('g', { 'clip-path': 'url(#t33s-waterclip)' }, water(0, shore, big, bank + H * 0.02, 3346, W * 0.8, false)),
      s('path', { class: 't33s-wetsand', d: `M${bot.map(P).join('L')}L${f1(xc + hw)} ${f1(bank + H * 0.04)}L${f1(xc - hw)} ${f1(bank + H * 0.04)}Z`, filter: 'url(#ink-wash)' }),
      s('path', { class: 't33s-wetline', d: stroke(bot, 2.2, 0.02, 0.02, 0.6), filter: 'url(#ink-rough)' }),
      s('path', { class: 't33s-rake', d: rake }),
      mist(big * 0.5, shore + 4, big * 0.55, (bank - shore) * 0.22),
      ...Array.from({ length: 5 }, (_, i) => blob(big * (0.1 + i * 0.2 + r() * 0.06), bank + H * (0.03 + r() * 0.04), W * 0.012, H * 0.008, 3348 + i, 0.3, 10)).map((d) => s('path', { class: 't33s-pebble', d, filter: 'url(#ink-rough)' })))
    // near: reed clumps painted blade by blade, leaning in from the frame, and a low tuft or two
    const tufts: SVGElement[] = []
    for (let x = W * 0.02; x < big; x += W * (0.34 + r() * 0.28)) tufts.push(reedClump(x, H + 6, H * (mobile ? 0.11 : 0.13) * (0.8 + r() * 0.4), 3349 + Math.round(x), 8, r() < 0.5 ? 0.5 : -0.5), grass(x + W * 0.1, H, H * 0.05, 3350 + Math.round(x)))
    near.replaceChildren(...tufts)
    root.style.setProperty('--bank', `${f1(bank)}px`)
    onScroll()
  }))

  // ── walking the path: the layers slide at their own depths; the lantern goes to the stele in the middle
  let raf = 0
  let lit = -1
  function onScroll() {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => {
      const x = path!.scrollLeft
      far.style.transform = `translate3d(${f1(-x * 0.06)}px,0,0)`
      pond.style.transform = `translate3d(${f1(-x * 0.22)}px,0,0)`
      near.style.transform = `translate3d(${f1(-x * 1.25)}px,0,0)`
      const c = x + pathW / 2
      // steles off the middle turn a little away from it, so their stone edge shows as you walk past
      mids.forEach((m, i) => steles[i].style.setProperty('--yaw', `${clamp(((m - c) / pathW) * 44, -24, 24).toFixed(1)}deg`))
      let best = 0
      mids.forEach((m, i) => {
        if (!steles[i].hidden && Math.abs(m - c) < Math.abs(mids[best] - c)) best = i
      })
      if (best !== lit && mids.length) {
        if (lit >= 0) steles[lit].classList.remove('t33s-lit')
        lit = best
        steles[lit].classList.add('t33s-lit')
        lamp.style.transform = `translateX(${f1(mids[lit] + steles[lit].offsetWidth * 0.5)}px)`
      }
    })
  }
  path.addEventListener('scroll', onScroll, { passive: true })
  ctx.onCleanup(() => cancelAnimationFrame(raf))
  // the filter hides steles (and a turned stele widens): the lantern finds the one in the middle again
  const relayout = () => requestAnimationFrame(() => {
    mids = steles.map((li) => li.offsetLeft + li.offsetWidth / 2)
    lit = -1
    onScroll()
  })
  only?.addEventListener('click', relayout)
  path.addEventListener('transitionend', (e) => (e.target as Element).classList?.contains('p2n-stele') && relayout())

  // a wheel walks the path sideways; a mouse can drag the scene (touch already scrolls natively)
  path.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
    e.preventDefault()
    path.scrollBy({ left: e.deltaY, behavior: 'auto' })
  }, { passive: false })
  let drag: { x: number; s: number } | null = null
  path.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || (e.target as Element).closest('button, a')) return
    drag = { x: e.clientX, s: path.scrollLeft }
    path.setPointerCapture(e.pointerId)
    path.classList.add('drag')
  })
  path.addEventListener('pointermove', (e) => drag && (path.scrollLeft = drag.s - (e.clientX - drag.x)))
  const up = () => {
    if (!drag) return
    drag = null
    // the snap comes back on release: the path settles on the nearest stele
    path.classList.remove('drag')
  }
  path.addEventListener('pointerup', up)
  path.addEventListener('pointercancel', up)
}
