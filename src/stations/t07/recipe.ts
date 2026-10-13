import { fill, h, nextId, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { blob, brush, ell, inkStone, onSize, rng, stableHeight, type Pt } from './ink'
import { C } from './data'

const R = C.scenes.recipe
type A = Record<string, unknown>
const P = (d: string, cls: string, a: A = {}) => s('path', { d, class: cls, ...a })
const B = (pts: Pt[], w: number, cls: string, o: Parameters<typeof brush>[2] = {}, a: A = {}) => P(brush(pts, w, o).d, cls, a)
/** a layer drawn twice: a thin pencil sketch and the finished ink version (the "phong cách" stone swaps them) */
const both = (cls: string, sk: SVGElement[], ink: SVGElement[]) => s('g', { class: cls }, s('g', { class: 'sk' }, ...sk), s('g', { class: 'ink' }, ...ink))
const line = (d: string) => P(d, 't7r-ln')

const CAT_BODY = 'M152 400C142 362 150 324 174 308C186 300 214 300 226 308C250 324 258 362 248 400Z'
const CAT_HEAD = 'M171 284C169 270 171 258 175 249L178 234L192 250C197 248 203 248 208 250L222 234L225 249C229 258 231 270 229 284C227 300 215 307 200 307C185 307 173 300 171 284Z'
const TAIL: Pt[] = [[244, 396], [272, 402], [296, 396], [304, 380]]
const TEAPOT = 'M300 356C298 340 306 330 322 330C338 330 346 340 344 356Z'

function picture(clipId: string, written: string) {
  const paper = s('rect', { x: 0, y: 50, width: 400, height: 400, class: 't7r-paper' })
  const clipRect = s('rect', { x: 0, y: 50, width: 400, height: 400 })
  const winMask = nextId('t7rw')

  const pose = both('L-pose',
    [line(ell(200, 238, 128)), line('M70 120L70 400M330 120L330 400')],
    [
      s('mask', { id: winMask, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 400, height: 500 },
        s('rect', { width: 400, height: 500, fill: '#fff' }), P(ell(200, 238, 128), '', { fill: '#000' })),
      s('rect', { width: 400, height: 500, class: 't7r-wall', mask: `url(#${winMask})` }),
      P('M70 270L120 238L160 252L210 220L262 246L300 232L330 248L330 330L70 330Z', 't7-k', { 'fill-opacity': 0.1, filter: 'url(#ink-wash)' }),
      P('M84 330C110 292 132 268 150 262C164 258 176 274 196 300C210 318 222 324 240 330Z', 't7-k', { 'fill-opacity': 0.2, filter: 'url(#ink-wash)' }),
      B([[322, 160], [300, 140], [276, 136]], 2.4, 't7-k2', { a: 0.1, b: 0.6 }, { filter: 'url(#ink-rough)' }),
      P(ell(296, 146, 18, 6), 't7-m', { 'fill-opacity': 0.7, filter: 'url(#ink-rough)' }),
      B(Array.from({ length: 49 }, (_, i) => [200 + Math.cos((i / 48) * 6.2832 - 1.9) * 128, 238 + Math.sin((i / 48) * 6.2832 - 1.9) * 128] as Pt), 5, 't7-k2', { a: 0.05, b: 0.3, wob: 0.2 }, { filter: 'url(#ink-rough)', 'fill-opacity': 0.8 }),
    ])
  const sun = P(ell(256, 196, 17), 't7r-acc acc-sun', { filter: 'url(#ink-wash)' })
  const place = both('L-place',
    [line('M0 400L400 400M40 440L10 500M200 440L200 500M360 440L390 500M0 440L400 440'), line('M276 372L384 372M286 372L286 400M374 372L374 400'), line(TEAPOT), line('M344 344C356 340 360 330 358 324M300 346C292 344 288 338 290 332'), line('M354 360L370 360L368 372L356 372Z')],
    [
      P('M0 400L400 400L400 500L0 500Z', 't7r-floor'),
      ...[[40, 10], [200, 200], [360, 390]].map(([a, b]) => B([[a, 404], [b, 500]], 1.6, 't7-k3', { a: 0.1, b: 0.1 }, { 'fill-opacity': 0.4 })),
      B([[0, 440], [400, 438]], 1.4, 't7-k3', { a: 0.1, b: 0.1 }, { 'fill-opacity': 0.4 }),
      B([[0, 400], [200, 401], [400, 399]], 3, 't7-k2', { a: 0.05, b: 0.05, min: 0.6 }, { filter: 'url(#ink-rough)' }),
      P('M272 368L388 368L386 376L274 376Z', 't7-k2', { filter: 'url(#ink-rough)' }),
      B([[284, 376], [285, 400]], 5, 't7-k2'), B([[376, 376], [375, 400]], 5, 't7-k2'),
      P(TEAPOT, 't7r-pot', { filter: 'url(#ink-rough)' }),
      B([[344, 344], [356, 340], [360, 326]], 4, 't7r-pot', { a: 0.1, b: 0.4 }),
      B([[302, 346], [290, 342], [290, 330]], 3.2, 't7-k2', { a: 0.2, b: 0.2 }),
      P(ell(322, 330, 6, 2.4), 't7-k2'),
      P('M354 358L370 358L368 368L356 368Z', 't7r-pot', { filter: 'url(#ink-rough)' }),
      P(blob(118, 392, 26, 8, 3, 0.2), 't7-k', { 'fill-opacity': 0.12, filter: 'url(#ink-wash)' }),
    ])
  const fruit = P(ell(300, 360, 8, 7), 't7r-acc acc-fruit', { filter: 'url(#ink-rough)' })
  const rayId = nextId('t7ry')
  const light = s('g', { class: 'L-light' },
    s('defs', null, s('linearGradient', { id: rayId, x1: 0, y1: 0, x2: 0.2, y2: 1 }, s('stop', { offset: 0, class: 't7r-r0' }), s('stop', { offset: 1, class: 't7r-r1' }))),
    s('rect', { width: 400, height: 500, class: 't7r-dim' }),
    P('M128 128L196 116L170 500L-30 500Z', '', { fill: `url(#${rayId})`, filter: 'url(#ink-wash)' }),
    P('M210 118L254 126L262 500L190 500Z', '', { fill: `url(#${rayId})`, 'fill-opacity': 0.6, filter: 'url(#ink-wash)' }),
    P(blob(150, 404, 70, 9, 9, 0.1), 't7-k', { 'fill-opacity': 0.16, filter: 'url(#ink-wash)' }))
  const cat = both('L-cat',
    [line(CAT_BODY), line(CAT_HEAD), P(brush(TAIL, 1.4, { a: 0, b: 0, min: 1, wob: 0 }).d, 't7r-ln')],
    [
      B(TAIL, 12, 't7r-cat', { a: 0.05, b: 0.5 }, { filter: 'url(#ink-rough)' }),
      B(TAIL, 2, 't7-k2', { a: 0.1, b: 0.5 }, { 'fill-opacity': 0.6 }),
      P(CAT_BODY, 't7r-cat', { filter: 'url(#ink-rough)' }),
      P('M226 312C246 326 254 360 248 398L224 398C232 368 232 334 222 312Z', 't7-k', { 'fill-opacity': 0.12, filter: 'url(#ink-wash)' }),
      P(CAT_HEAD, 't7r-cat', { filter: 'url(#ink-rough)' }),
      P('M178 240L180 252L188 251Z', 't7-k3', { 'fill-opacity': 0.6 }), P('M222 240L220 252L212 251Z', 't7-k3', { 'fill-opacity': 0.6 }),
      s('g', { filter: 'url(#ink-rough)' },
        B([[175, 249], [178, 235], [192, 250]], 2.2, 't7-k', { a: 0.2, b: 0.2 }),
        B([[208, 250], [222, 235], [225, 250]], 2.2, 't7-k', { a: 0.2, b: 0.2 }),
        B([[171, 282], [176, 300], [200, 307], [222, 302], [229, 284]], 2.4, 't7-k', { a: 0.15, b: 0.2 }),
        B([[174, 308], [154, 340], [150, 398]], 2.8, 't7-k', { a: 0.1, b: 0.3 }),
        B([[226, 308], [250, 340], [249, 398]], 3.4, 't7-k', { a: 0.1, b: 0.3 }),
        B([[152, 400], [200, 402], [248, 400]], 2, 't7-k2', { a: 0.2, b: 0.2 }, { 'fill-opacity': 0.7 })),
    ])
  const collar = B([[176, 306], [200, 312], [224, 306]], 6, 't7r-acc', { a: 0.15, b: 0.15, min: 0.5 })
  const words = s('g', { class: 'L-text' },
    s('text', { x: 362, y: 104, class: 't7r-written', 'text-anchor': 'middle' }, written),
    P('M355 116h14v14h-14z', 't7-v', { filter: 'url(#ink-rough)' }))
  const cam = s('g', { class: 't7r-cam' }, pose, sun, place, fruit, light, s('g', { class: 't7r-catpos' }, cat, collar))
  const svg = s('svg', { class: 't7r-pic', viewBox: '0 0 400 500', 'aria-hidden': 'true' },
    s('defs', null, s('clipPath', { id: clipId }, clipRect)),
    paper,
    s('g', { 'clip-path': `url(#${clipId})` }, cam, words),
    s('rect', { x: 0, y: 50, width: 400, height: 400, class: 't7r-edge' }))
  return { svg, paper, clipRect, edge: svg.lastElementChild as SVGRectElement }
}

/** Scene 5 — nine stones of the image-prompt formula; each adds its words to the strip and its part to the picture. */
export function recipeScene(ctx: SceneCtx) {
  const pic = picture(nextId('t7rc'), R.written)
  const frame = h('div', { class: 't7r-frame', role: 'img', 'aria-label': fill(R.canvas, { prompt: R.empty }) }, pic.svg)
  // the prompt strip stays blank paper until the first stone is laid
  const words = h('p', { class: 't7r-words', 'aria-live': 'polite' })
  const strip = h('div', { class: 't7r-strip' }, h('p', { class: 't7r-lab' }, R.stripLabel), words)
  const jr = rng(13)
  const stones = R.parts.map((p, i) =>
    h('button', {
      class: 't7s-stone t7r-stone', type: 'button', 'aria-pressed': 'false', onClick: () => toggle(i),
      style: `--dx:${((jr() - 0.5) * 8).toFixed(1)}%;--dy:${((jr() - 0.5) * 7).toFixed(1)}px;--k:${(0.93 + jr() * 0.07).toFixed(3)};rotate:${((jr() - 0.5) * 5).toFixed(1)}deg`,
    }, inkStone(101 + i * 13, i % 4 === 2), h('span', { class: 't7s-ring', 'aria-hidden': 'true' }), h('span', { class: 't7s-face' }, p.name)))
  const sand = s('svg', { class: 't7r-sand', 'aria-hidden': 'true' })
  const grid = h('div', { class: 't7r-grid', role: 'group', 'aria-label': R.group }, ...stones)
  const bed = h('div', { class: 't7r-bed' }, sand, grid)
  const side = h('div', { class: 't7r-side' }, strip, bed)
  const root = h('div', { class: 't7 t7r' }, frame, side)
  ctx.art.append(root)
  ctx.prompt(R.prompt)
  stones[0].classList.add('next')

  const on = new Set<number>()
  let last = -1
  let told = false

  function render() {
    const ids = R.parts.map((p, i) => (on.has(i) ? p.id : '')).filter(Boolean)
    for (const p of R.parts) pic.svg.toggleAttribute(`data-${p.id}`, ids.includes(p.id))
    const parts = R.parts.map((p, i) => (on.has(i) ? h('span', { class: i === last ? 'new' : '' }, p.say) : null)).filter((x): x is HTMLSpanElement => !!x)
    const text = R.parts.filter((_, i) => on.has(i)).map((p) => p.say).join(', ')
    if (parts.length) {
      words.replaceChildren()
      parts.forEach((sp, k) => words.append(k ? ', ' : '', sp))
      // sentence-case the first letter, like a real prompt
      const first = parts[0]
      first.textContent = first.textContent!.charAt(0).toUpperCase() + first.textContent!.slice(1)
    } else words.replaceChildren()
    strip.classList.toggle('on', parts.length > 0)
    frame.setAttribute('aria-label', fill(R.canvas, { prompt: text || R.empty }))
    // the 4:5 stone reshapes the paper
    const tall = on.has(R.parts.findIndex((p) => p.id === 'ratio'))
    const box = tall ? { y: 0, height: 500 } : { y: 50, height: 400 }
    if (ctx.reduced) gsap.set([pic.paper, pic.clipRect, pic.edge], { attr: box })
    else ctx.anim(() => gsap.to([pic.paper, pic.clipRect, pic.edge], { attr: box, duration: 1.2, ease: 'power3.inOut' }))
    if (!ctx.reduced && last >= 0 && on.has(last)) {
      const sp = words.querySelector('.new')
      if (sp) ctx.anim(() => gsap.fromTo(sp, { opacity: 0, filter: 'blur(4px)' }, { opacity: 1, filter: 'blur(0px)', duration: 0.9, ease: 'power2.out' }))
    }
  }

  function toggle(i: number) {
    if (on.has(i)) on.delete(i)
    else on.add(i)
    last = i
    stones[i].setAttribute('aria-pressed', String(on.has(i)))
    stones.forEach((b) => b.classList.remove('next'))
    const nx = R.parts.findIndex((_, j) => !on.has(j))
    if (nx >= 0 && on.size < 5) stones[nx].classList.add('next')
    render()
    ctx.chime('soft')
    if (on.has(i) && !ctx.reduced) ctx.anim(() => gsap.fromTo(stones[i].querySelector('.t7s-ring'), { scale: 0.8, opacity: 0.9 }, { scale: 1.5, opacity: 0, duration: 1.2, ease: 'power2.out' }))
    if (on.size >= 5 && !told) {
      told = true
      ctx.insight(R.insight, R.detail)
    }
  }

  grid.addEventListener('keydown', (e) => {
    const k = stones.indexOf(document.activeElement as HTMLButtonElement)
    if (k < 0) return
    // rows are as wide as the grid's current columns (3, or 5 on low landscape screens)
    const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length
    const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key]
    if (!d) return
    e.preventDefault()
    stones[(k + d + stones.length) % stones.length].focus()
  })

  const stable = stableHeight(ctx, [R.insight])
  /** The tallest the strip gets (all nine parts), kept from the start so nothing below it ever jumps. */
  function stripMax() {
    const keep = [...words.childNodes]
    words.textContent = R.parts.map((p) => p.say).join(', ')
    const hgt = strip.offsetHeight
    words.replaceChildren(...keep)
    return hgt
  }

  const rk = { mask: nextId('t7rm'), fade: nextId('t7rf') }
  /** Raked sand under the stones: straight rows, two rings around each stone. */
  function rakeBed() {
    const w = bed.clientWidth
    const hh = bed.clientHeight
    if (!w || !hh) return
    const pad = 14
    sand.setAttribute('viewBox', `${-pad} ${-pad} ${w + 2 * pad} ${hh + 2 * pad}`)
    const boxes = stones.map((b) => [b.offsetLeft + b.offsetWidth / 2, b.offsetTop + b.offsetHeight / 2 + 2, b.offsetWidth / 2, b.offsetHeight / 2])
    const add = (g: SVGGElement, d: string) => g.append(s('path', { d, class: 't7-rk' }), s('path', { d, class: 't7-rk-hi', transform: 'translate(0 1.3)' }))
    const rows = s('g', { mask: `url(#${rk.mask})` })
    for (let y = -pad + 3, k = 0; y < hh + pad; y += 6, k++) {
      const pts: string[] = []
      for (let x = -pad - 10; x <= w + pad + 20; x += 20) pts.push(`${x} ${(y + 0.9 * Math.sin(x / 37 + k * 0.9)).toFixed(1)}`)
      add(rows, `M${pts.join('L')}`)
    }
    const rings = s('g', { mask: `url(#${rk.fade}-m)` })
    for (const [x, y, a, b] of boxes) for (const k of [1, 2]) add(rings, ell(x, y, a + 5 * k, b + 4 * k))
    sand.replaceChildren(
      s('defs', null,
        s('radialGradient', { id: rk.fade, cx: 0.5, cy: 0.5, r: 0.5 }, s('stop', { offset: 0.72, 'stop-color': '#fff' }), s('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 })),
        s('mask', { id: `${rk.fade}-m`, maskUnits: 'userSpaceOnUse', x: -pad, y: -pad, width: w + 2 * pad, height: hh + 2 * pad },
          s('rect', { x: -pad, y: -pad, width: w + 2 * pad, height: hh + 2 * pad, fill: `url(#${rk.fade})` })),
        s('mask', { id: rk.mask, maskUnits: 'userSpaceOnUse', x: -pad, y: -pad, width: w + 2 * pad, height: hh + 2 * pad },
          s('rect', { x: -pad, y: -pad, width: w + 2 * pad, height: hh + 2 * pad, fill: `url(#${rk.fade})` }),
          ...boxes.map(([x, y, a, b]) => s('path', { d: ell(x, y, a + 13, b + 11), fill: '#000' })))),
      rows, rings)
  }

  function layout() {
    const W = ctx.art.clientWidth
    const H = stable(ctx.art.clientHeight)
    if (!W || !H) return
    const wide = W / H > 1.05 && W > 540
    root.classList.toggle('wide', wide)
    root.classList.toggle('tall', !wide)
    const short = wide && H < 330
    root.classList.toggle('short', short)
    root.style.height = `${H}px`
    strip.style.minHeight = ''
    if (wide) {
      const sw = short ? Math.min(560, W * 0.62) : Math.min(460, Math.max(280, W * 0.36))
      const fh = Math.min(H * 0.96, ((W - sw - 60) * 5) / 4, 640)
      root.style.setProperty('--fw', `${(fh * 4) / 5}px`)
      root.style.setProperty('--sw', `${sw}px`)
      root.style.setProperty('--sh', `${Math.max(44, Math.min(58, H / 9))}px`)
      strip.style.minHeight = `${stripMax()}px`
    } else {
      // portrait: the picture and its prompt side by side, the stones beneath; the picture is as large as
      // the longest prompt (all nine parts) still allows beside it
      const sw = Math.min(W, 440)
      root.style.setProperty('--sw', `${sw}px`)
      root.style.setProperty('--sh', '44px')
      const room = H - bed.offsetHeight - 12
      let fw = Math.min(sw * 0.62, (room * 4) / 5)
      for (let k = 0; k < 6; k++) {
        root.style.setProperty('--fw', `${fw}px`)
        if (stripMax() <= (fw * 5) / 4 || fw < sw * 0.42) break
        fw -= sw * 0.04
      }
      strip.style.minHeight = `${Math.min(stripMax(), (fw * 5) / 4)}px`
    }
    rakeBed()
  }
  onSize(ctx, ctx.art, layout)
  render()
}
