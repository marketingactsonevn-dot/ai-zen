import { fill, h, nextId, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { C, blob, journey, paperArt, question, reply, rng, sheetArt, stroke, tokText, type Pt } from './shared'

const T = C.scenes.write
const R = 70
/** the brush lands lower-left and travels clockwise for SWEEP degrees, leaving an open gap */
const START = 205
const SWEEP = 330
const SEG = SWEEP / 5
/** point at `deg` (clockwise from 12 o'clock) on a circle of radius r round the ensō's centre */
const at = (deg: number, r = R): Pt => {
  const a = ((deg - 90) * Math.PI) / 180
  return [100 + Math.cos(a) * r, 100 + Math.sin(a) * r]
}
const f1 = (n: number) => n.toFixed(1)
const line = (pts: Pt[]) => `M${pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')}`

/** The ensō as one brush stroke: a loaded brush presses down (dark, bleeding), its wet core thins as the ink runs out,
 *  the body turns grey and streaked with paper, and dry-brush hairs break up towards the open end (flying white). */
function ensoPaint() {
  const r = rng(29)
  const N = 170
  const radius = (t: number) => R + Math.sin(t * 6.1 + 0.7) * 1.5 + Math.sin(t * 17) * 0.45 + (t > 0.86 ? (t - 0.86) * 16 : 0)
  const width = (t: number) => {
    let w = 10 * (1 - 0.28 * t) + Math.sin(t * 41) * 0.35 + Math.sin(t * 13 + 1) * 0.45
    w += 4.5 * Math.exp(-Math.pow(t / 0.035, 2)) // the brush presses down where it lands
    if (t > 0.66) w *= Math.max(0.05, 1 - Math.pow((t - 0.66) / 0.28, 1.4))
    return w
  }
  /** a closed band along the ring from t0 to t1, half-width hw(t) round radius rr(t) */
  const band = (t0: number, t1: number, hw: (t: number) => number, rr = radius) => {
    const o: Pt[] = [], i: Pt[] = []
    for (let k = 0; k <= N; k++) {
      const t = t0 + ((t1 - t0) * k) / N
      o.push(at(START + SWEEP * t, rr(t) + hw(t)))
      i.push(at(START + SWEEP * t, rr(t) - hw(t)))
    }
    return { o, i, d: `${line(o)}L${i.slice().reverse().map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')}Z` }
  }
  const end = 0.95
  const b = band(0, end, (t) => width(t) / 2)
  // a rounded start: the bristles spread as they touch the paper
  const s0 = at(START - 8, radius(0) - 1)
  const body = `${b.d.slice(0, -1)}Q${f1(s0[0])} ${f1(s0[1])} ${f1(b.o[0][0])} ${f1(b.o[0][1])}Z`
  const [bx, by] = at(START + 1.5, radius(0))
  const blot = blob(bx, by, width(0) * 0.6, width(0) * 0.52, 7, 0.16, 16)
  // the wet core: dark ink that fills the stroke where it lands and narrows to nothing as the brush empties
  const core = band(0, 0.6, (t) => (width(t) / 2) * (0.08 + 0.86 * Math.pow(1 - t / 0.6, 0.9)), (t) => radius(t) + 0.5).d

  // hairs that run on past the body and break up
  const hairs = Array.from({ length: 9 }, (_, k) => {
    const o = -0.5 + (k + r() * 0.6) / 9
    const t0 = 0.56 + r() * 0.12, t1 = 0.88 + r() * 0.12
    const pts: Pt[] = []
    for (let t = t0; t <= t1; t += 0.008) {
      const spread = Math.max(width(t), 8 * (1 - (t - 0.6)))
      pts.push(at(START + SWEEP * t, radius(t) + o * spread))
    }
    const dash = Array.from({ length: 10 }, (_, i) => (i % 2 ? 1.5 + r() * 5 : 4 + r() * 18).toFixed(1)).join(' ')
    return s('path', { class: 't5-w-hair', d: line(pts), 'stroke-width': (0.45 + r() * 0.9).toFixed(2), 'stroke-dasharray': dash, opacity: (0.4 + r() * 0.45).toFixed(2) })
  })
  // paper showing through the body where the ink runs thin: more streaks, wider, the further the brush goes
  const gaps = [-0.3, -0.12, 0.05, 0.2, 0.33].map((o, k) => {
    const pts: Pt[] = []
    for (let t = 0.3 + k * 0.06; t <= 0.86; t += 0.008) pts.push(at(START + SWEEP * t, radius(t) + o * width(t)))
    const dash = Array.from({ length: 8 }, (_, i) => (i % 2 ? 3 + r() * 9 : 3 + r() * 14).toFixed(1)).join(' ')
    return s('path', { class: 't5-w-gap', d: line(pts), 'stroke-width': (0.55 + k * 0.22).toFixed(2), 'stroke-dasharray': dash })
  })
  return [
    s('path', { class: 't5-w-bleed', d: body + blob(bx, by, width(0) * 0.95, width(0) * 0.85, 9, 0.2, 16), filter: 'url(#ink-wash)' }),
    s('path', { class: 't5-w-ink', d: body + blot, filter: 'url(#ink-rough)' }),
    s('path', { class: 't5-w-core', d: core + blot, filter: 'url(#ink-wash)' }),
    ...gaps,
    ...hairs,
  ]
}

/** Scene 5: the ensō loop. A bead runs round the brushed ring — through the five stages — and each turn writes one token
 *  onto the paper slip; that token joins the input strip and the ring turns again, until the model draws "hết" (end). */
export function mountWrite(ctx: SceneCtx) {
  const q = question()
  const ans = reply()
  const bead = s('circle', { class: 't5-w-bead', r: 4.4, cx: at(START)[0], cy: at(START)[1], opacity: 0 })
  const tail = s('path', { class: 't5-w-tail' })
  const segs = C.journey.map((name, k) => {
    const a0 = START + k * SEG + 5, a1 = START + (k + 1) * SEG - 5
    const pts = Array.from({ length: 9 }, (_, i) => at(a0 + ((a1 - a0) * i) / 8, R + 15 + Math.sin(i + k) * 0.6))
    const mid = START + (k + 0.5) * SEG
    const [lx, ly] = at(mid, R + 27)
    const side = Math.sin(((mid - 0) * Math.PI) / 180)
    return s('g', { class: 't5-w-st' },
      s('path', { class: 't5-w-seg', d: stroke(pts, 2.8, { head: 0.12, tail: 0.7, min: 0.15 }) }),
      s('text', { class: 't5-w-stlabel', x: f1(lx), y: f1(ly + 4), 'text-anchor': Math.abs(side) < 0.3 ? 'middle' : side > 0 ? 'start' : 'end' }, name))
  })
  // the ring is painted in one stroke: a mask follows the brush's path
  const maskId = nextId('t5enso')
  const spine = Array.from({ length: 67 }, (_, i) => at(START - 4 + (SWEEP + 8) * (i / 66)))
  const reveal = s('path', { d: line(spine), fill: 'none', stroke: '#fff', 'stroke-width': 36, 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': ctx.reduced ? 0 : 1 })
  // short screens: the ring alone (no names round it) and only the stage the bead is passing, inside the ring
  const nowLabel = s('text', { class: 't5-w-now', x: 100, y: 138, 'text-anchor': 'middle' })
  const enso = s('svg', { class: 't5-w-enso', viewBox: '-64 -4 328 208', 'aria-hidden': 'true' },
    s('defs', null, s('mask', { id: maskId, maskUnits: 'userSpaceOnUse', x: -64, y: -4, width: 328, height: 208 }, reveal)),
    s('g', { mask: `url(#${maskId})` }, ...ensoPaint()), ...segs, nowLabel, tail, bead)
  const center = h('span', { class: 't5-w-center', 'aria-hidden': 'true' })
  const loop = h('div', { class: 't5-w-loop', role: 'img', 'aria-label': T.loopAria }, enso, center)

  const track = h('div', { class: 't5-w-track' })
  const strip = h('div', { class: 't5-w-strip', 'aria-hidden': 'true' }, track)
  const mini = (text: string, cls = '') => h('span', { class: `t5-mini ${cls}`.trim() }, text)
  const sheet = h('span', { class: 't5-mini is-sheet' }, sheetArt())

  // the full answer is laid out invisibly underneath, so the slip never changes size while it is written
  const full = h('p', { class: 't5-w-text t5-w-full', 'aria-hidden': 'true' }, ans.tokens.join(''), h('span', { class: 't5-w-end' }, T.end))
  const text = h('p', { class: 't5-w-text t5-w-live' })
  const cursor = h('span', { class: 't5-w-cursor', 'aria-hidden': 'true' })
  const paper = h('div', { class: 't5-w-paper' }, paperArt(7), h('div', { class: 't5-w-lines' }, full, text), h('div', { class: 't5-w-tag' }, ctx.tag('illustration')))
  const main = h('div', { class: 't5-w-main' }, strip, h('div', { class: 't5-w-body' }, loop, paper))

  const stepBtn = h('button', { class: 'btn ghost t5-w-step', type: 'button' }, T.step)
  const autoBtn = h('button', { class: 'btn ghost t5-w-auto', type: 'button', 'aria-pressed': 'false' }, T.auto)
  const againBtn = h('button', { class: 'btn ghost t5-w-again', type: 'button', hidden: true }, T.again)
  const endCap = h('p', { class: 't5-w-endcap', hidden: true }, T.endCaption)
  const live = h('p', { class: 'visually-hidden', 'aria-live': 'polite' })
  const root = h('div', { class: 't5-scene t5-write' }, journey(4), main,
    h('div', { class: 't5-w-ctrl' }, stepBtn, autoBtn, endCap, againBtn), live)
  ctx.art.append(root)
  ctx.prompt(T.prompt)

  let n = 0 // tokens written
  let busy = false
  let auto = false
  let finished = false
  let explored = false
  const timers: number[] = []
  let run: ReturnType<typeof gsap.timeline> | null = null
  let epoch = 0 // bumps on reset, so a word still in flight cannot restart the loop

  function reset() {
    run?.kill()
    epoch++
    n = 0
    finished = false
    busy = false
    setAuto(false)
    text.replaceChildren(cursor)
    endCap.hidden = true
    root.classList.remove('is-done')
    track.replaceChildren(sheet, ...q.tokens.map(([t]) => mini(tokText(t))))
    gsap.set(track, { x: 0 })
    fitTrack(false)
    stepBtn.hidden = autoBtn.hidden = false
    againBtn.hidden = true
    center.textContent = ''
    segs.forEach((g) => g.classList.remove('is-lit'))
    nowLabel.textContent = ''
  }

  function setAuto(on: boolean) {
    auto = on
    autoBtn.setAttribute('aria-pressed', String(on))
    autoBtn.textContent = on ? T.pause : T.auto
    root.classList.toggle('is-auto', on)
  }

  /** slide the strip so its newest stone stays in view */
  function fitTrack(animate: boolean) {
    const over = track.scrollWidth - strip.clientWidth
    const x = over > 0 ? -over : 0
    strip.classList.toggle('is-over', over > 0)
    if (animate && !ctx.reduced) ctx.anim(() => gsap.to(track, { x, duration: 0.6, ease: 'power3.out' }))
    else gsap.set(track, { x })
  }

  /** the bead's place on the ring at progress u (0…1 of one turn) + its vermilion tail */
  function setBead(u: number) {
    const deg = START + 360 * u
    const [x, y] = at(deg)
    bead.setAttribute('cx', f1(x))
    bead.setAttribute('cy', f1(y))
    const back = Math.min(34, 360 * u)
    tail.setAttribute('d', back > 2 ? stroke(Array.from({ length: 7 }, (_, i) => at(deg - (back * i) / 6)), 5.4, { head: 0.04, tail: 0.5, min: 0.05 }) : '')
    const k = Math.floor((deg - START) / SEG)
    segs.forEach((g, i) => g.classList.toggle('is-lit', i === k))
    nowLabel.textContent = C.journey[k] ?? ''
  }

  // ── one turn of the loop: the bead runs the five stages; at "Chữ tiếp theo" the next word forms in the centre;
  //    at "Viết ra" it flies onto the paper, brushed in with a short vermilion stroke, and joins the input strip.
  function turn() {
    if (busy || finished) return
    busy = true
    const isEnd = n >= ans.tokens.length
    const word = isEnd ? '' : ans.tokens[n]
    const shown = isEnd ? T.end : tokText(word)
    const slow = n < 3 && !auto ? 2.6 : n < 3 ? 1.9 : 0.62
    if (ctx.reduced) {
      center.textContent = shown
      return emit(word, isEnd)
    }
    const o = { u: 0 }
    ctx.anim(() => {
      run = gsap.timeline({ onComplete: () => emit(word, isEnd) })
        .set(bead, { opacity: 1 })
        .to(o, { u: SWEEP / 360, duration: slow, ease: n < 3 ? 'power1.inOut' : 'none', onUpdate: () => setBead(o.u) })
        .add(() => (center.textContent = shown), slow * ((3 * SEG) / SWEEP))
        .fromTo(center, { opacity: 0, scale: 0.8, filter: 'blur(4px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: slow * 0.25, ease: 'power2.out' }, slow * ((3 * SEG) / SWEEP))
        .to(bead, { opacity: 0, duration: 0.2 })
        .add(() => tail.setAttribute('d', ''), '<')
    })
  }

  function emit(word: string, isEnd: boolean) {
    segs.forEach((g) => g.classList.remove('is-lit'))
    nowLabel.textContent = ''
    if (isEnd) return finish()
    const lead = word.startsWith(' ') ? ' ' : ''
    // the word drawn in scene 4 keeps its vermilion stroke
    const drawn = n >= ans.at && n < ans.to
    const span = h('span', { class: `t5-w-tok${drawn ? ' is-drawn' : ''}` }, word.slice(lead.length),
      s('svg', { class: 't5-w-mark', viewBox: '0 0 100 10', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
        s('path', { d: stroke([[2, 6], [40, 4.6], [98, 5.4]], 4.2, { head: 0.08, tail: 0.6, min: 0.12 }) })))
    text.insertBefore(document.createTextNode(lead), cursor)
    text.insertBefore(span, cursor)
    const stone = mini(tokText(word), 'is-new')
    track.querySelectorAll('.is-new').forEach((el) => el.classList.remove('is-new'))
    track.append(stone)
    n++
    live.textContent = fill(T.added, { w: tokText(word) })
    if (n >= 3 && !explored) {
      explored = true
      ctx.insight(T.insight, T.detail)
    }
    const fast = n > 3 || auto
    const mark = span.querySelector('.t5-w-mark') as SVGElement
    if (ctx.reduced) {
      // no brushing in: only the newest word keeps its vermilion stroke
      text.querySelectorAll<SVGElement>('.t5-w-tok:not(.is-drawn) .t5-w-mark').forEach((m) => m !== mark && (m.style.opacity = '0'))
      center.textContent = ''
      fitTrack(false)
      return next()
    }
    fitTrack(true)
    // the word leaves the centre of the ring and settles on the paper
    const cb = center.getBoundingClientRect(), sb = span.getBoundingClientRect()
    const fly = h('span', { class: 't5-w-fly', 'aria-hidden': 'true' }, tokText(word))
    root.append(fly)
    const rb = root.getBoundingClientRect()
    const gen = epoch
    ctx.anim(() => {
      const d = fast ? 0.42 : 0.95
      gsap.set(center, { opacity: 0 })
      gsap.timeline()
        .fromTo(fly, { x: cb.left + cb.width / 2 - rb.left, y: cb.top + cb.height / 2 - rb.top, xPercent: -50, yPercent: -50, scale: 1.25 },
          { x: sb.left - rb.left, y: sb.top + sb.height / 2 - rb.top, xPercent: 0, scale: 1, duration: d, ease: 'power2.inOut' })
        .addLabel('land', '-=0.1')
        .fromTo(span, { opacity: 0 }, { opacity: 1, duration: 0.25 }, 'land')
        .to(fly, { opacity: 0, duration: 0.2, onComplete: () => fly.remove() }, 'land')
        .fromTo(mark, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: fast ? 0.25 : 0.5, ease: 'power2.out' }, 'land')
        .from(stone, { opacity: 0, scale: 0.6, duration: 0.5, ease: 'back.out(2)' }, 'land')
        .add(() => gen === epoch && next(), fast ? 'land+=0.2' : 'land+=0.8')
        .to(mark, { opacity: drawn ? 0.75 : 0, duration: fast ? 0.9 : 1.6, ease: 'power1.in' }, fast ? 'land+=0.4' : 'land+=1')
    })
  }

  function next() {
    busy = false
    if (auto && !finished) timers.push(window.setTimeout(turn, n < 3 ? 260 : 40))
  }

  function finish() {
    finished = true
    busy = false
    setAuto(false)
    center.textContent = ''
    const seal = h('span', { class: 't5-w-end' }, T.end)
    text.insertBefore(seal, cursor)
    endCap.hidden = false
    root.classList.add('is-done')
    stepBtn.hidden = autoBtn.hidden = true
    againBtn.hidden = false
    againBtn.focus({ preventScroll: true })
    live.textContent = T.endCaption
    if (!explored) {
      explored = true
      ctx.insight(T.insight, T.detail)
    }
    ctx.chime('ok')
    if (!ctx.reduced) ctx.anim(() => {
      gsap.from(seal, { scale: 1.8, opacity: 0, rotation: -12, duration: 0.7, ease: 'back.out(2.2)' })
      gsap.from(endCap, { opacity: 0, y: 6, duration: 0.9, delay: 0.3 })
    })
  }

  const step = () => {
    setAuto(false)
    turn()
  }
  stepBtn.addEventListener('click', step)
  loop.addEventListener('click', step)
  paper.addEventListener('click', (e) => !(e.target as Element).closest('.tag, button') && step())
  autoBtn.addEventListener('click', () => {
    if (ctx.reduced) {
      // no running animation: write everything at once
      while (!finished) turn()
      return
    }
    setAuto(!auto)
    if (auto) turn()
  })
  againBtn.addEventListener('click', () => {
    reset()
    stepBtn.focus({ preventScroll: true })
  })

  const ro = new ResizeObserver(() => {
    const short = root.clientHeight < 300
    if (short !== root.classList.contains('is-short')) {
      root.classList.toggle('is-short', short)
      enso.setAttribute('viewBox', short ? '10 10 180 180' : '-64 -4 328 208')
    }
    fitTrack(false)
  })
  ro.observe(root)
  ro.observe(strip)
  reset()
  if (!ctx.reduced) {
    ctx.anim(() => {
      // the ring is painted in one stroke, then the slip and the input settle
      gsap.to(reveal, { attr: { 'stroke-dashoffset': 0 }, duration: 2.2, delay: 0.2, ease: 'power2.inOut' })
      gsap.from(segs.map((g) => g.querySelector('text')), { opacity: 0, duration: 1.2, delay: 1.4, stagger: 0.12 })
      gsap.from([strip, paper], { opacity: 0, y: 12, duration: 1.1, delay: 0.4, stagger: 0.15, ease: 'power3.out', clearProps: 'opacity,transform' })
    })
  }
  return () => {
    timers.forEach(clearTimeout)
    ro.disconnect()
    run?.kill()
  }
}
