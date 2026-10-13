import { fill, h, nextId, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { blob, brush, ell, onSize, spline, stableHeight, type Pt } from './ink'
import { C } from './data'

const T = C.scenes.chat
type Edit = (typeof T.edits)[number]['id']

type A = Record<string, unknown>
const P = (d: string, cls: string, a: A = {}) => s('path', { d, class: cls, ...a })
const B = (pts: Pt[], w: number, cls: string, o: Parameters<typeof brush>[2] = {}, a: A = {}) => P(brush(pts, w, o).d, cls, a)

// The figure, seen from behind (viewBox 400 × 500): nón lá, hair in one long stroke, a narrow-waisted áo dài whose
// back panel falls straight while the front panel lifts in the breeze, white trousers between them.
const HAT = 'M170 143Q204 115 236 88Q268 115 302 143Q236 159 170 143Z'
const TORSO = 'M226 151Q236 147 246 151Q256 154 260 163C258 190 252 214 251 240L222 240C221 214 215 190 212 163Q216 154 226 151Z'
const ARM_L: Pt[] = [[214, 164], [207, 195], [205, 228], [208, 262]]
const ARM_R: Pt[] = [[258, 164], [265, 195], [267, 228], [264, 262]]
const BACK = 'M223 238C222 300 223 370 224 432Q244 441 263 430C258 370 254 300 251 238Z'
// the lifted panel widens from the waist like a sail and ends in a broad, fluttering hem (cloth, never a tail)
const FRONT_OUT: Pt[] = [[222, 246], [214, 270], [200, 292], [182, 308], [160, 318], [138, 322]]
const FRONT_IN: Pt[] = [[134, 362], [158, 370], [182, 368], [202, 356], [216, 336], [226, 306], [231, 276], [233, 252]]
const FRONT = `M${spline(FRONT_OUT, 3).map((p) => p.map((n) => n.toFixed(1)).join(' ')).join('L')}Q128 340 134 362L${spline(FRONT_IN, 3).map((p) => p.map((n) => n.toFixed(1)).join(' ')).join('L')}Z`
const PANTS = 'M222 288C216 340 210 400 203 462L235 463L237 300ZM239 300L241 462L268 460C262 400 258 340 254 288Z'
// the far (right) side of the figure, washed a shade darker
const SHADE = 'M246 152Q258 156 260 163C258 190 252 214 251 240C254 300 258 370 262 430Q253 436 245 438C243 370 241 300 240 240C242 210 245 180 246 152Z'
const SLEEVE = { a: 0.05, b: 0.2, min: 0.62, wob: 0.05 }
const SIL = [HAT, TORSO, brush(ARM_L, 13, SLEEVE).d, brush(ARM_R, 13, SLEEVE).d, BACK, FRONT, PANTS]
const DRESS = [TORSO, brush(ARM_L, 13, SLEEVE).d, brush(ARM_R, 13, SLEEVE).d, BACK, FRONT]

/** A lotus: petals as pointed leaves fanning from the cup, tips flushed darker. */
function lotus(x: number, y: number, k: number) {
  const g = s('g', { filter: 'url(#ink-rough)' })
  const petal = (ang: number, len: number, wid: number, cls: string) => {
    const a = (ang * Math.PI) / 180
    const tx = x + Math.cos(a) * len * k
    const ty = y + Math.sin(a) * len * k
    const nx = -Math.sin(a) * wid * k
    const ny = Math.cos(a) * wid * k
    const mx = x + Math.cos(a) * len * 0.45 * k
    const my = y + Math.sin(a) * len * 0.45 * k
    return P(`M${x} ${y}Q${mx + nx} ${my + ny} ${tx} ${ty}Q${mx - nx} ${my - ny} ${x} ${y}Z`, cls)
  }
  if (k < 0.6) {
    g.append(petal(-92, 30, 9, 't7c-lotus'), petal(-80, 26, 7, 't7c-lotus2'))
    return g
  }
  g.append(
    petal(-160, 26, 8, 't7c-lotus'), petal(-20, 26, 8, 't7c-lotus'),
    petal(-130, 34, 10, 't7c-lotus'), petal(-50, 34, 10, 't7c-lotus'),
    petal(-108, 38, 11, 't7c-lotus2'), petal(-72, 38, 11, 't7c-lotus2'),
    petal(-90, 40, 12, 't7c-lotus'),
    P(ell(x, y - 2, 9 * k, 4 * k), 't7-m2'))
  return g
}

function painting(ids: { fig: string; dress: string; noise: string; ring: string; keep: string; mBg: string; mDress: string; mText: string }, written: string) {
  const R = (cls: string) => s('rect', { width: 400, height: 500, class: cls })
  const svg = s('svg', { class: 't7c-pic', viewBox: '0 0 400 500', 'aria-hidden': 'true' })
  const defs = s('defs', null,
    s('path', { id: ids.fig, d: SIL.join('') }),
    s('path', { id: ids.dress, d: DRESS.join('') }),
    s('filter', { id: ids.noise, x: 0, y: 0, width: '100%', height: '100%' },
      s('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.85', numOctaves: '1', seed: '2', result: 'n' }),
      s('feColorMatrix', { in: 'n', type: 'matrix', values: '0 0 0 0 0.5  0 0 0 0 0.48  0 0 0 0 0.46  0 0 0 1.6 -0.35' })),
    ...[ids.ring, ids.keep].map((id, k) => s('filter', { id, x: '-10%', y: '-10%', width: '120%', height: '120%' },
      s('feMorphology', { in: 'SourceAlpha', operator: 'dilate', radius: '3', result: 'd' }),
      s('feComposite', { in: 'd', in2: 'SourceAlpha', operator: 'out', result: 'o' }),
      s('feFlood', { class: k ? 't7c-flood2' : 't7c-flood' }),
      s('feComposite', { in2: 'o', operator: 'in' }))),
    s('mask', { id: ids.mBg, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 400, height: 500 },
      s('rect', { width: 400, height: 500, fill: '#fff' }), s('use', { href: `#${ids.fig}`, fill: '#000', stroke: '#000', 'stroke-width': 6 })),
    s('mask', { id: ids.mDress, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 400, height: 500 },
      s('use', { href: `#${ids.dress}`, fill: '#fff', stroke: '#fff', 'stroke-width': 4 })),
    s('mask', { id: ids.mText, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 400, height: 500 },
      s('rect', { x: 22, y: 30, width: 186, height: 96, rx: 14, fill: '#fff', filter: 'url(#ink-rough)' })))

  // background — two versions crossfaded (paper / pink)
  const bgA = s('g', { class: 't7c-bgA' }, R('t7c-paper'), P(ell(282, 176, 104), 't7-s3', { 'fill-opacity': 0.75, filter: 'url(#ink-wash)' }))
  const bgB = s('g', { class: 't7c-bgB', opacity: 0 }, R('t7c-pink'), P(ell(282, 176, 104), 't7c-pink2', { filter: 'url(#ink-wash)' }))
  // the pond: far bank, water lines, lotus leaves, a flower and a bud, reeds
  const pond = s('g', { class: 't7c-pond' },
    P(brush([[0, 332], [120, 327], [240, 334], [400, 328]], 2.6, { a: 0.1, b: 0.2, min: 0.3, wob: 0.3 }).d, 't7-k3', { 'fill-opacity': 0.38 }),
    P('M0 474Q120 458 220 466T400 462L400 500L0 500Z', 't7-k3', { 'fill-opacity': 0.08, filter: 'url(#ink-wash)' }),
    ...[[30, 372, 90], [96, 392, 70], [40, 420, 120], [140, 412, 46]].map(([x, y, l]) => B([[x, y], [x + l, y + 1]], 2.2, 't7-k3', { a: 0.3, b: 0.4 }, { 'fill-opacity': 0.55 })),
    ...[[70, 404, 62, 18, 3], [150, 446, 44, 12, 5], [24, 458, 54, 15, 7]].map(([x, y, rx, ry, sd]) => s('g', null,
      P(blob(x, y, rx, ry, sd, 0.12), 't7-m', { 'fill-opacity': 0.55, filter: 'url(#ink-wash)' }),
      P(blob(x - rx * 0.1, y - ry * 0.15, rx * 0.6, ry * 0.5, sd + 9, 0.15), 't7-m', { 'fill-opacity': 0.3, filter: 'url(#ink-wash)' }),
      ...[-0.7, -0.2, 0.3, 0.75].map((f) => B([[x, y], [x + rx * f, y + ry * (0.5 - Math.abs(f) * 0.4)]], 1.4, 't7-m2', { a: 0.1, b: 0.6 }, { 'fill-opacity': 0.8 })))),
    B([[70, 404], [76, 360], [92, 318]], 2.4, 't7-m2', { a: 0.1, b: 0.3 }),
    B([[124, 444], [128, 380], [118, 300]], 2.4, 't7-m2', { a: 0.1, b: 0.3 }),
    lotus(92, 318, 1), lotus(119, 300, 0.42),
    ...[[330, 470, 300], [344, 474, 330], [356, 476, 290], [370, 478, 340]].map(([x, y, t]) => B([[x, y], [x - 4, (y + t) / 2], [x + 6, t]], 3.2, 't7-k2', { a: 0.05, b: 0.7 }, { 'fill-opacity': 0.7 })))

  // the figure
  const dressFill = (cls: string, cls2: string) => [
    P(FRONT, cls2, { filter: 'url(#ink-rough)' }),
    P(BACK, cls, { filter: 'url(#ink-rough)' }),
    P(TORSO, cls, { filter: 'url(#ink-rough)' }),
    B(ARM_L, 13, cls, SLEEVE, { filter: 'url(#ink-rough)' }),
    B(ARM_R, 13, cls, SLEEVE, { filter: 'url(#ink-rough)' }),
  ]
  const dressA = s('g', { class: 't7c-dressA' }, ...dressFill('t7c-dress', 't7c-dress2'))
  const dressB = s('g', { class: 't7c-dressB', opacity: 0 }, ...dressFill('t7c-white', 't7c-white2'))
  const lines = s('g', { filter: 'url(#ink-rough)' },
    P(SHADE, 't7-k', { 'fill-opacity': 0.13, filter: 'url(#ink-wash)' }),
    // contours: heavier on the shadow side, lifting off at the ends
    B([[223, 240], [222, 300], [223, 370], [224, 432]], 2, 't7-k2', { a: 0.15, b: 0.25 }, { 'fill-opacity': 0.75 }),
    B([[251, 240], [254, 300], [258, 370], [262, 430]], 2.8, 't7-k2', { a: 0.15, b: 0.25 }, { 'fill-opacity': 0.8 }),
    B([[223, 433], [244, 441], [263, 430]], 1.8, 't7-k2', { a: 0.2, b: 0.2 }, { 'fill-opacity': 0.6 }),
    B(FRONT_OUT, 2, 't7-k2', { a: 0.12, b: 0.3 }, { 'fill-opacity': 0.7 }),
    B(FRONT_IN.slice(0, 6), 1.4, 't7-k2', { a: 0.3, b: 0.4 }, { 'fill-opacity': 0.55 }),
    // the fold where the sail turns
    B([[220, 280], [206, 316], [182, 338], [150, 346]], 1, 't7-k3', { a: 0.3, b: 0.4 }, { 'fill-opacity': 0.45 }),
    B([[212, 164], [215, 190], [221, 214], [222, 240]], 1.6, 't7-k2', { a: 0.2, b: 0.2 }, { 'fill-opacity': 0.6 }),
    B([[260, 164], [258, 190], [252, 214], [251, 240]], 2.2, 't7-k2', { a: 0.2, b: 0.2 }, { 'fill-opacity': 0.7 }),
    B([[213, 166], [206, 196], [204, 228], [207, 260]], 1.3, 't7-k2', { a: 0.2, b: 0.4 }, { 'fill-opacity': 0.55 }),
    B([[259, 166], [266, 196], [268, 228], [265, 260]], 1.6, 't7-k2', { a: 0.2, b: 0.4 }, { 'fill-opacity': 0.6 }),
    B([[221, 292], [214, 340], [208, 400], [204, 460]], 1.3, 't7-k3', { a: 0.2, b: 0.2 }, { 'fill-opacity': 0.6 }),
    B([[255, 292], [260, 340], [263, 400], [267, 458]], 1.3, 't7-k3', { a: 0.2, b: 0.2 }, { 'fill-opacity': 0.6 }),
    // a fold down the back panel, the waist where the panels part
    B([[238, 246], [240, 330], [243, 426]], 1, 't7-k3', { a: 0.3, b: 0.4 }, { 'fill-opacity': 0.4 }),
    B([[222, 240], [236, 242], [251, 240]], 1.2, 't7-k3', { a: 0.3, b: 0.3 }, { 'fill-opacity': 0.4 }))
  const hair = s('g', { filter: 'url(#ink-rough)' },
    // one long stroke: full at the nape, swaying, thinning to a point below the waist
    B([[236, 147], [238, 172], [235, 205], [238, 238], [244, 266]], 23, 't7c-hair', { a: 0.03, b: 0.9, min: 0.04, wob: 0.05 }),
    B([[227, 152], [226, 186], [229, 222]], 1.4, 't7-k2', { a: 0.1, b: 0.5 }, { 'fill-opacity': 0.6 }),
    B([[247, 152], [248, 192], [244, 232], [249, 258]], 1.3, 't7-k2', { a: 0.1, b: 0.6 }, { 'fill-opacity': 0.6 }),
    B([[240, 230], [246, 256], [252, 272]], 1, 't7c-hair', { a: 0.1, b: 0.7 }, { 'fill-opacity': 0.55 }))
  const figure = s('g', { class: 't7c-fig' },
    P(PANTS, 't7c-pants', { filter: 'url(#ink-rough)' }),
    B([[204, 462], [226, 463]], 4.5, 't7-k'), B([[243, 461], [266, 460]], 4.5, 't7-k'),
    dressA, dressB, lines, hair,
    P(HAT, 't7c-hat'),
    P('M236 88L302 143Q270 152 236 157Z', 't7-k', { 'fill-opacity': 0.1, filter: 'url(#ink-wash)' }),
    s('g', { filter: 'url(#ink-rough)' },
      B([[170, 143], [236, 157], [302, 143]], 2.6, 't7-k2', { a: 0.1, b: 0.1 }),
      B([[171, 142], [204, 114], [236, 88]], 1.6, 't7-k2', { a: 0.1, b: 0.3 }, { 'fill-opacity': 0.8 }),
      B([[236, 88], [268, 114], [301, 142]], 1.8, 't7-k2', { a: 0.3, b: 0.1 }, { 'fill-opacity': 0.85 }),
      ...[0.32, 0.56, 0.8].map((k) => B([[236 - 66 * k, 88 + 55 * k], [236, 88 + 64 * k], [236 + 66 * k, 88 + 55 * k]], 0.9, 't7-k3', { a: 0.2, b: 0.2 }, { 'fill-opacity': 0.55 }))))

  // the words (edit 2): serif calligraphy + a small vermilion seal
  const words = s('g', { class: 't7c-words', opacity: 0 },
    s('text', { x: 36, y: 82, class: 't7c-written' }, written),
    P('M38 96h14v14h-14z', 't7-v', { filter: 'url(#ink-rough)' }))

  // edit effects: masked noise, attention ring
  const fx = (mask: string) => s('g', { mask: `url(#${mask})`, opacity: 0 }, s('rect', { width: 400, height: 500, filter: `url(#${ids.noise})` }))
  const noise = { bg: fx(ids.mBg), dress: fx(ids.mDress), text: fx(ids.mText) }
  const ring = {
    bg: s('use', { href: `#${ids.fig}`, class: 't7c-keep', filter: `url(#${ids.keep})`, opacity: 0 }),
    dress: s('use', { href: `#${ids.dress}`, class: 't7c-sel', filter: `url(#${ids.ring})`, opacity: 0 }),
    text: P('M24 32h184v92H24z', 't7c-box', { opacity: 0, pathLength: 1 }),
  }
  svg.append(defs, bgA, bgB, pond, figure, words, noise.bg, noise.dress, noise.text, ring.bg, ring.dress, ring.text)
  return { svg, bgA, bgB, dressA, dressB, words, noise, ring }
}

/** Scene 2 — a picture made in a chat; each message changes only the part it names. */
export function chatScene(ctx: SceneCtx) {
  const ids = { fig: nextId('t7f'), dress: nextId('t7d'), noise: nextId('t7n'), ring: nextId('t7r'), keep: nextId('t7k'), mBg: nextId('t7mb'), mDress: nextId('t7md'), mText: nextId('t7mt') }
  const art = painting(ids, T.written)
  const frame = h('div', { class: 't7c-frame', role: 'img', 'aria-label': T.image }, art.svg)
  const log = h('div', { class: 't7c-log', role: 'log', 'aria-live': 'polite', tabindex: '-1' })
  const msg = (who: 'you' | 'ai', text: string) =>
    h('div', { class: `t7c-msg ${who}` }, h('span', { class: 't7c-who' }, who === 'you' ? T.you : T.ai), h('p', null, text))
  log.append(msg('you', T.first), msg('ai', T.firstReply))
  const chips = T.edits.map((e) =>
    h('button', { class: 't7c-chip', type: 'button', 'aria-label': fill(T.send, { text: e.say }), onClick: () => send(e.id) },
      h('span', null, e.say), s('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, s('path', { d: 'M4 12h14M13 6l6 6-6 6' }))))
  const sugg = h('div', { class: 't7c-sugg', role: 'group', 'aria-label': T.suggest }, ...chips)
  const chat = h('div', { class: 't7c-chat' }, log, sugg, h('p', { class: 't7c-note' }, T.note))
  const root = h('div', { class: 't7 t7c' }, frame, chat)
  ctx.art.append(root)
  ctx.prompt(T.prompt)

  const done = new Set<Edit>()
  let busy = false

  function apply(id: Edit) {
    const swap = id === 'bg' ? [art.bgA, art.bgB] : id === 'dress' ? [art.dressA, art.dressB] : [null, art.words]
    const n = art.noise[id]
    const r = art.ring[id]
    const tl = gsap.timeline()
    if (ctx.reduced) {
      if (swap[0]) gsap.set(swap[0], { opacity: 0 })
      gsap.set(swap[1], { opacity: 1 })
      return tl
    }
    const turb = art.svg.querySelector(`#${ids.noise} feTurbulence`)
    const boil = { v: 1 }
    if (id === 'text') tl.fromTo(r, { opacity: 1, attr: { 'stroke-dashoffset': 1 } }, { attr: { 'stroke-dashoffset': 0 }, duration: 0.7, ease: 'power2.inOut' })
    else tl.fromTo(r, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out' })
    tl.to(n, { opacity: 0.95, duration: 0.6, ease: 'power2.in' }, 0.25)
    // the noise "boils" while the region is redrawn
    // (stepped: a fresh turbulence only every few frames keeps this cheap on phones)
    if (turb) tl.to(boil, { v: 9, duration: 2.2, ease: 'none', onUpdate: () => { const v = String(Math.round(boil.v)); if (turb.getAttribute('seed') !== v) turb.setAttribute('seed', v) } }, 0.25)
    if (swap[0]) tl.to(swap[0], { opacity: 0, duration: 0.5 }, 0.85)
    tl.to(swap[1], { opacity: 1, duration: 0.6 }, 0.85)
      .to(n, { opacity: 0, duration: 1, ease: 'power2.out' }, 1.25)
      .to(r, { opacity: 0, duration: 0.8 }, 1.7)
    return tl
  }

  function send(id: Edit) {
    if (busy || done.has(id)) return
    busy = true
    done.add(id)
    const e = T.edits.find((x) => x.id === id)!
    const chip = chips[T.edits.indexOf(e)]
    const you = msg('you', e.say)
    const typing = h('div', { class: 't7c-msg ai typing' }, h('span', { class: 't7c-who' }, T.ai), h('p', null, h('span', { class: 'visually-hidden' }, T.typing), h('i', { 'aria-hidden': 'true' }), h('i', { 'aria-hidden': 'true' }), h('i', { 'aria-hidden': 'true' })))
    const reply = msg('ai', e.reply)
    const finish = () => {
      typing.remove()
      log.append(reply)
      busy = false
      if (done.size === 1) ctx.insight(T.insight, T.detail)
      // keep focus inside the scene when the pressed chip disappears
      const nextChip = chips.find((_, i) => !done.has(T.edits[i].id))
      if (document.activeElement === chip || !document.activeElement || document.activeElement === document.body) (nextChip ?? log).focus({ preventScroll: true })
      chip.remove()
      if (!nextChip) sugg.remove()
      layout()
    }
    chip.disabled = true
    log.append(you, typing)
    layout()
    ctx.chime('soft')
    if (ctx.reduced) {
      apply(id)
      finish()
      return
    }
    ctx.anim(() => {
      gsap.from(you, { opacity: 0, y: 14, duration: 0.6, ease: 'power3.out' })
      gsap.to(chip, { opacity: 0.3, duration: 0.4 })
      gsap.from(typing, { opacity: 0, duration: 0.4, delay: 0.3 })
      apply(id).call(() => {
        finish()
        gsap.from(reply, { opacity: 0, y: 10, duration: 0.7, ease: 'power3.out' })
      }, [], 2.3)
    })
  }

  const stable = stableHeight(ctx, [T.insight])
  function layout() {
    const W = ctx.art.clientWidth
    const H = stable(ctx.art.clientHeight)
    if (!W || !H) return
    const wide = W / H > 1.05 && W > 540
    root.classList.toggle('wide', wide)
    root.classList.toggle('tall', !wide)
    root.classList.toggle('short', wide && H < 330)
    root.style.height = `${H}px`
    if (wide) {
      const cw = Math.min(400, Math.max(260, W * 0.34))
      const fh = Math.min(H * 0.94, ((W - cw - 56) / 4) * 5, 620)
      root.style.setProperty('--fw', `${(fh * 4) / 5}px`)
      root.style.setProperty('--cw', `${cw}px`)
      root.style.setProperty('--ch', `${Math.min(H, fh + 10)}px`)
    } else {
      const cw = Math.min(W, 460)
      root.style.setProperty('--cw', `${cw}px`)
      const sh = sugg.isConnected ? sugg.offsetHeight : 0
      const fh = Math.max(150, Math.min(H * 0.62, H - sh - 110, (cw / 4) * 5 * 0.92))
      root.style.setProperty('--fw', `${(fh * 4) / 5}px`)
      root.style.setProperty('--ch', `${H - fh - 12}px`)
    }
  }
  onSize(ctx, ctx.art, layout)
}
