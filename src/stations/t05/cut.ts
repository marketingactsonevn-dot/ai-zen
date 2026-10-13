import { fill, h, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { tokenize } from '../t04/tokenizer'
import { C, QUESTIONS, journey, nearest, paperArt, question, rake, sheetArt, state, stoneArt, stroke, tokText, type Isle, type Pt } from './shared'

const T = C.scenes.cut

/** A calligraphy brush; its tip sits at the element's origin so it can ride the pointer. */
function brushArt() {
  const along = (t: number): Pt => [10 + 118 * t, 150 - 138 * t]
  return s('svg', { class: 't5-brush-art', viewBox: '0 0 140 160', 'aria-hidden': 'true' },
    s('path', { class: 't5-br-shadow', d: stroke([[18, 158], [70, 104], [134, 30]], 7, { head: 0.3, tail: 0.6 }) }),
    s('path', { class: 't5-br-handle', d: stroke([along(0.36), along(0.68), along(1)], 10, { head: 0.02, tail: 0.04, min: 0.85 }) }),
    ...[0.55, 0.8].map((t) => s('path', { class: 't5-br-node', d: stroke([along(t - 0.012), along(t + 0.012)], 11.5, { head: 0.4, tail: 0.5, min: 0.8 }) })),
    s('path', { class: 't5-br-ferrule', d: stroke([along(0.27), along(0.37)], 12.5, { head: 0.1, tail: 0.1, min: 0.85 }) }),
    s('path', { class: 't5-br-tuft', d: stroke([along(0.28), along(0.15), [17, 141], [10, 150]], 18, { head: 0.08, tail: 1.5, min: 0.02 }) }))
}

/** a torn edge between (0, yl) and (w, yr), left to right, as clip-path polygon points */
function tear(w: number, yl: number, yr: number) {
  const n = Math.max(6, Math.round(w / 13))
  return Array.from({ length: n + 1 }, (_, i) => {
    const x = (i / n) * w
    const y = yl + (yr - yl) * (i / n) + (i % 2 ? 1.6 : -1.4) * (i % 3 ? 1 : 0.5)
    return `${x.toFixed(1)}px ${y.toFixed(1)}px`
  })
}

/** Scene 1: your question on a paper slip lying in raked sand → swipe a brush through it → the slip tears and its words
 *  roll out as numbered token stones; then a folded sheet slides in front of them: the app's hidden instruction (system prompt). */
export function mountCut(ctx: SceneCtx) {
  const live = h('p', { class: 'visually-hidden', 'aria-live': 'polite' })
  const bed = s('svg', { class: 't5-bed', 'aria-hidden': 'true' })
  const stage = h('div', { class: 't5-cut-stage' })
  const altsEl = h('div', { class: 't5-alts', role: 'group', 'aria-label': T.alts })
  const root = h('div', { class: 't5-scene t5-cut' }, journey(0), stage, altsEl, live)
  ctx.art.append(root)
  ctx.prompt(T.prompt)

  let cut = false
  let sheetFocus = false // keyboard users keep their place: focus moves to the sheet when it arrives
  let seenSheet = false
  let busy: ReturnType<typeof gsap.timeline> | null = null
  const timers: number[] = []
  const later = (fn: () => void, ms: number) => void timers.push(window.setTimeout(fn, ms))

  // ── per-question pieces (rebuilt when the visitor sends another question)
  let note: HTMLElement
  let spans: HTMLElement[] = []
  let row: HTMLElement
  let stones: HTMLElement[] = []
  let sheetBtn: HTMLButtonElement
  let card: HTMLElement
  let brush: HTMLElement
  let ownNote: HTMLElement
  let scraps: HTMLElement[] = []
  const slash = s('svg', { class: 't5-slash', 'aria-hidden': 'true' })
  const trailPath = s('path', { class: 't5-slash-ink' })
  slash.append(trailPath)

  const tokens = (): [string, number][] => state.own?.tokens ?? question().tokens
  const sentence = () => state.own?.text ?? question().text

  function build() {
    cut = false
    scraps = []
    stage.replaceChildren()
    spans = tokens().map(([t]) => h('span', { class: 't5-nt' }, t))
    const text = h('p', { class: 't5-note-text' }, ...spans)
    note = h('div', { class: 't5-note', role: 'button', tabindex: '0', 'aria-label': fill(T.aria, { q: sentence() }) }, paperArt(state.q + 2), text)
    stones = tokens().map(([t, id], i) =>
      h('span', { class: 't5-tok' },
        h('span', { class: 't5-tok-body' }, stoneArt(i * 5 + state.q * 13 + 1), h('span', { class: 't5-tok-w' }, tokText(t))),
        h('span', { class: 't5-tok-id' }, String(id))))
    sheetBtn = h('button', { class: 't5-sheet', type: 'button', 'aria-expanded': 'false', 'aria-label': T.sheetAria, hidden: true },
      h('span', { class: 't5-sheet-pulse', 'aria-hidden': 'true' }), sheetArt(), h('span', { class: 't5-sheet-name' }, C.sheet.name))
    row = h('div', { class: 't5-row' }, sheetBtn, ...stones)
    ownNote = h('p', { class: 't5-own-note', hidden: true }, state.own ? fill(T.ownNote, { q: question().text }) : '')
    const fold = (k: number) => s('path', { class: 't5-card-crease', d: `M3 ${k} L97 ${k + 0.4}` })
    card = h('div', { class: 't5-card', hidden: true, role: 'note' },
      paperArt(11),
      s('svg', { class: 't5-card-folds', viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'aria-hidden': 'true' }, fold(33.3), fold(66.6)),
      h('p', { class: 't5-card-title' }, C.sheet.title, h('span', null, ` · ${C.sheet.name}`)),
      h('p', { class: 't5-card-text' }, C.sheet.text),
      s('svg', { class: 't5-card-rule', viewBox: '0 0 200 6', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
        s('path', { d: stroke([[2, 3.4], [80, 2.6], [198, 3.2]], 2.4, { head: 0.05, tail: 0.6, min: 0.15 }) })),
      h('p', { class: 't5-card-cap' }, T.sheetCap),
      h('p', { class: 't5-card-count' }, C.sheet.count, ' ', ctx.tag('illustration')),
      s('svg', { class: 't5-card-seal', viewBox: '0 0 40 40', 'aria-hidden': 'true' },
        s('path', { d: 'M8 9 Q20 5 32 8.5 Q35 20 31.5 32 Q20 35.5 8.5 31.5 Q5 20 8 9Z' }),
        s('path', { class: 't5-seal-mark', d: 'M12 12.5 Q20 10.5 28 12 Q29.5 20 28 28 Q20 29.5 12 28 Q10.5 20 12 12.5Z' })))
    brush = h('div', { class: 't5-brush', 'aria-hidden': 'true' }, brushArt())
    stage.append(bed, note, h('div', { class: 't5-rowwrap' }, row, ownNote), slash, brush)
    root.querySelector('.t5-card')?.remove()
    root.append(card)
    requestAnimationFrame(() => (restBrush(), paintBed()))
    trailPath.setAttribute('d', '')
    note.addEventListener('click', () => doCut(null))
    note.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        doCut(null)
      }
    })
    sheetBtn.addEventListener('click', toggleSheet)
    if (!ctx.reduced) {
      ctx.anim(() => {
        gsap.from(note, { opacity: 0, y: 14, duration: 1.2, ease: 'power3.out' })
        gsap.fromTo(text, { clipPath: 'inset(-20% 100% -20% 0)' }, { clipPath: 'inset(-20% -2% -20% 0)', duration: 1.8, delay: 0.35, ease: 'power2.inOut', clearProps: 'clipPath' })
      })
    }
    pickers()
  }

  // ── the other questions lie on the desk as small slips; the last one takes a sentence of your own
  function pickers() {
    const own = h('button', { class: 't5-alt is-own', type: 'button', 'aria-label': T.ownAria, onClick: openOwn }, T.own)
    altsEl.replaceChildren(h('span', { class: 't5-alts-label', 'aria-hidden': 'true' }, T.alts),
      ...QUESTIONS.flatMap((qq, i) => (i === state.q && !state.own ? [] : [h('button', { class: 't5-alt', type: 'button', 'aria-label': fill(T.altPick, { q: qq.text }), onClick: () => swap(i, null) }, qq.text)])),
      own)
  }
  function openOwn() {
    const input = h('input', { class: 't5-own-in', type: 'text', maxlength: '44', placeholder: T.ownPlaceholder, 'aria-label': T.ownAria, autocomplete: 'off', enterkeyhint: 'send' })
    const form = h('form', { class: 't5-own' }, input,
      h('button', { class: 'btn ghost t5-own-send', type: 'submit' }, T.ownSend),
      h('button', { class: 't5-own-x', type: 'button', 'aria-label': T.ownCancel, onClick: () => (pickers(), altsEl.querySelector<HTMLElement>('.is-own')?.focus()) }, '×'))
    form.addEventListener('submit', (e) => {
      e.preventDefault()
      const text = input.value.replace(/\s+/g, ' ').trim()
      if (!text) return input.focus()
      const toks = tokenize(text).map((t): [string, number] => [(t.lead ? ' ' : '') + t.t, t.id])
      if (toks.length) swap(nearest(text), { text, tokens: toks })
    })
    input.addEventListener('keydown', (e) => e.key === 'Escape' && (e.stopPropagation(), pickers()))
    altsEl.replaceChildren(form)
    input.focus({ preventScroll: true })
    if (!ctx.reduced) ctx.anim(() => gsap.from(form, { opacity: 0, y: 6, duration: 0.6, ease: 'power3.out' }))
  }

  /** the brush rests against the slip's lower-right corner (on narrow screens it lies flat beneath the slip) */
  function restBrush(animate = false) {
    if (cut || !brush) return
    const sr = stage.getBoundingClientRect()
    const nr = note.getBoundingClientRect()
    const flat = sr.width < 560
    const x = flat ? nr.left - sr.left + nr.width * 0.42 : Math.min(sr.width - 120, nr.right - sr.left - 6)
    const y = nr.bottom - sr.top + (flat ? 30 : 8)
    const rotation = flat ? 42 : 0
    if (animate && !ctx.reduced) ctx.anim(() => gsap.to(brush, { x, y, rotation, duration: 0.8, ease: 'power3.out' }))
    else gsap.set(brush, { x, y, rotation })
  }

  /** raked sand: grooves part around the slip, or (after the cut) around each line of stones */
  function paintBed() {
    const sr = stage.getBoundingClientRect()
    if (sr.width < 10) return
    bed.setAttribute('viewBox', `0 0 ${sr.width.toFixed(0)} ${sr.height.toFixed(0)}`)
    const isles: Isle[] = []
    const box = (r: DOMRect) => ({ l: r.left - sr.left, r: r.right - sr.left, t: r.top - sr.top, b: r.bottom - sr.top })
    if (!cut) {
      const n = box(note.getBoundingClientRect())
      const ry = (n.b - n.t) / 2 - 4
      isles.push({ x0: n.l + ry, x1: n.r - ry, y: (n.t + n.b) / 2, ry })
    } else {
      // one island per line of stones (the row wraps on narrow screens)
      const items = [sheetBtn, ...stones].filter((el) => !el.hidden).map((el) => box((el.querySelector('.t5-tok-body, .t5-sheet-art') ?? el).getBoundingClientRect()))
      const lines: (typeof items)[] = []
      items.forEach((b) => {
        const line = lines.find((l) => Math.abs(l[0].t + l[0].b - b.t - b.b) < 20)
        if (line) line.push(b)
        else lines.push([b])
      })
      lines.forEach((l) => {
        const t = Math.min(...l.map((b) => b.t)), b = Math.max(...l.map((b) => b.b))
        const ry = (b - t) / 2 + 2
        isles.push({ x0: Math.min(...l.map((b) => b.l)) + ry * 0.6, x1: Math.max(...l.map((b) => b.r)) - ry * 0.6, y: (t + b) / 2 + 3, ry })
      })
    }
    bed.replaceChildren(...rake(sr.width, sr.height, isles, { step: sr.width < 520 ? 8 : 9, rings: 3, seed: state.q + 1 }))
  }

  function swap(i: number, own: typeof state.own) {
    busy?.kill()
    closeSheet()
    state.q = i
    state.own = own
    state.picked = -1
    const refocus = () => {
      build()
      note.focus({ preventScroll: true })
    }
    if (ctx.reduced) return refocus()
    ctx.anim(() => gsap.to(stage.children, { opacity: 0, y: 10, duration: 0.45, ease: 'power2.in', onComplete: () => void setTimeout(refocus) }))
  }

  // ── the brush: swipe across the slip; a tap or Enter draws the stroke for you
  let pid: number | null = null
  let pts: Pt[] = []
  const local = (e: PointerEvent): Pt => {
    const r = stage.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top]
  }
  // the brush listens on the whole scene, so a swipe may start in the side gutter, outside the art box
  const pad = ctx.el
  const touch0 = pad.style.touchAction
  pad.style.touchAction = 'none'
  const drawTrail = () => trailPath.setAttribute('d', pts.length > 1 ? stroke(pts.length > 40 ? pts.filter((_, i) => i % 2 === 0 || i === pts.length - 1) : pts, 11, { head: 0.06, tail: 0.55, min: 0.08 }) : '')
  pad.addEventListener('pointerdown', (e) => {
    if (cut || e.button !== 0 || (e.target as Element).closest('.t5-alts, .t5-sheet, .t5-card, .scene-foot, button, a, input')) return
    pid = e.pointerId
    pts = [local(e)]
    gsap.killTweensOf(trailPath)
    gsap.set(trailPath, { opacity: 1 })
    try {
      pad.setPointerCapture(e.pointerId)
    } catch {
      /* gone */
    }
  })
  pad.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pid) return
    const p = local(e)
    const last = pts[pts.length - 1]
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 4) return
    pts.push(p)
    drawTrail()
    gsap.set(brush, { x: p[0], y: p[1], rotation: -6 })
  })
  const end = (e: PointerEvent) => {
    if (e.pointerId !== pid) return
    pid = null
    if (cut) return
    pts.push(local(e))
    const sr = stage.getBoundingClientRect()
    const nr = note.getBoundingClientRect()
    const l = nr.left - sr.left, r = nr.right - sr.left, t = nr.top - sr.top - 12, b = nr.bottom - sr.top + 12
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1])
    // a stroke cuts when it sweeps across most of the slip's width within its band — however few points a fast flick leaves
    const across = Math.min(r, Math.max(...xs)) - Math.max(l, Math.min(...xs))
    const band = Math.max(...ys) > t && Math.min(...ys) < b
    if (band && across > nr.width * 0.45) return doCut(pts)
    if (pts.some(([x, y]) => x > l && x < r && y > t && y < b)) return doCut(null)
    gsap.to(trailPath, { opacity: 0, duration: 0.6 })
    restBrush(true)
    ctx.prompt(T.prompt)
  }
  pad.addEventListener('pointerup', end)
  pad.addEventListener('pointercancel', end)

  function doCut(trail: Pt[] | null) {
    if (cut) return
    cut = true
    sheetFocus = document.activeElement === note
    note.removeAttribute('role')
    note.removeAttribute('tabindex')
    ctx.chime('soft')
    gsap.killTweensOf(trailPath)
    gsap.set(trailPath, { opacity: 1 })
    const sr = stage.getBoundingClientRect()
    const nr = note.getBoundingClientRect()
    if (!trail) {
      // a calm diagonal sweep through the slip
      const x0 = nr.left - sr.left - 18, x1 = nr.right - sr.left + 18, yc = nr.top - sr.top + nr.height * 0.52
      trail = [[x0, yc + 10], [x0 + (x1 - x0) * 0.35, yc + 2], [x0 + (x1 - x0) * 0.7, yc - 4], [x1, yc - 12]]
      pts = trail
      drawTrail()
    }
    const src = spans.map((sp) => sp.getBoundingClientRect())
    const noteSize = parseFloat(getComputedStyle(spans[0]).fontSize)
    // where the stones will rest (measured on the word, so each word leaves the slip exactly where it was written)
    row.classList.add('is-on')
    ownNote.hidden = !state.own
    const words = stones.map((st) => st.querySelector('.t5-tok-w') as HTMLElement)
    const dst = words.map((w) => w.getBoundingClientRect())
    const tokSize = parseFloat(getComputedStyle(words[0]).fontSize)
    const done = () => {
      live.textContent = fill(T.done, { n: tokens().length })
      ctx.insight(T.insight, T.detail as Fact)
      later(arriveSheet, ctx.reduced ? 0 : 900)
    }
    // the slip tears along the stroke into two scraps that stay on the sand, above and below the stones
    const first = trail[0], last = trail[trail.length - 1]
    const slope = (last[1] - first[1]) / Math.max(1, last[0] - first[0])
    const nl = nr.left - sr.left, nt = nr.top - sr.top, w = nr.width, hh = nr.height
    const yAt = (x: number) => Math.min(hh * 0.72, Math.max(hh * 0.28, first[1] + (x - first[0]) * slope - nt))
    const yl = yAt(nl), yr = yAt(nl + w)
    const edge = tear(w, yl, yr)
    tearMid = (yl + yr) / 2
    // the torn edge keeps a thin vermilion rim where the brush went through
    const rim = `M${edge.map((p) => p.replace(/px/g, '')).join('L')}`
    scraps = [[`0 0`, `${w}px 0`, ...edge.slice().reverse()], [...edge, `${w}px ${hh}px`, `0 ${hh}px`]].map((poly) => {
      const el = h('div', { class: 't5-scrap', 'aria-hidden': 'true', style: `width:${w}px;height:${hh}px;clip-path:polygon(${poly.join(',')})` }, paperArt(state.q + 2),
        s('svg', { class: 't5-scrap-rim', viewBox: `0 0 ${w.toFixed(0)} ${hh.toFixed(0)}` }, s('path', { d: rim })))
      stage.insertBefore(el, note)
      return el
    })
    const st0 = scrapPlace()
    note.classList.add('is-torn')
    if (ctx.reduced) {
      note.classList.add('is-gone')
      brush.hidden = true
      trailPath.setAttribute('d', '')
      placeScraps()
      paintBed()
      return done()
    }
    paintBed()
    ctx.anim(() => {
      gsap.set(stones, { opacity: 0 })
      gsap.fromTo(bed, { opacity: 0.25 }, { opacity: 1, duration: 1.6, delay: 0.9, ease: 'power2.out' })
      const tl = gsap.timeline({ onComplete: done })
      busy = tl
      if (pts === trail && trail.length === 4) {
        // the brush glides to the edge of the slip, then sweeps through it
        gsap.set(trailPath, { clipPath: 'inset(-20px 100% -20px -20px)' })
        tl.to(brush, { x: trail[0][0], y: trail[0][1], rotation: -6, duration: 0.5, ease: 'power2.inOut' })
          .to(trailPath, { clipPath: 'inset(-20px 0% -20px -20px)', duration: 0.42, ease: 'power2.in' })
          .to(brush, { keyframes: trail.slice(1).map(([x, y]) => ({ x, y })), duration: 0.42, ease: 'power2.in' }, '<')
      }
      tl.addLabel('cut').to(brush, { x: '+=70', y: '-=50', rotation: 8, opacity: 0, duration: 0.9, ease: 'power2.out' }, 'cut')
      // the slip cracks at every token boundary, shivers, and lets go of its words
      const cracks = spans.slice(1).map((sp) => {
        const r = sp.getBoundingClientRect()
        const c = h('span', { class: 't5-crack', style: `left:${r.left - nr.left}px` })
        note.append(c)
        return c
      })
      tl.from(cracks, { scaleY: 0, duration: 0.3, stagger: 0.03, ease: 'power2.out' }, 'cut')
        .to(note, { x: 2, duration: 0.05, repeat: 3, yoyo: true, ease: 'none' }, 'cut')
        .addLabel('split', 'cut+=0.5')
        .to(trailPath, { opacity: 0, duration: 0.9 }, 'split+=0.3')
        .set(cracks, { opacity: 0 }, 'split+=0.2')
        .set(spans, { opacity: 0 }, 'split')
        .set(stones, { opacity: 1 }, 'split')
      scraps.forEach((sc, k) => {
        tl.fromTo(sc, { y: 0, rotation: 0 }, st0.fits
          ? { ...scrapPose(k, st0.ys[k], st0.dx), duration: 1.4, ease: 'power3.inOut' }
          : { y: k ? 30 : -30, opacity: 0, duration: 0.9, ease: 'power2.in' }, 'split')
      })
      stones.forEach((st, i) => {
        const a = src[i], b = dst[i]
        const dx = a.left + a.width / 2 - (b.left + b.width / 2)
        const dy = a.top + a.height / 2 - (b.top + b.height / 2)
        const at = `split+=${(0.05 + i * 0.05).toFixed(2)}`
        tl.fromTo(st, { x: dx, y: dy }, { keyframes: [{ y: dy - 14, x: dx * 0.7, ease: 'power2.out' }, { x: 0, y: 0, ease: 'power3.inOut' }], duration: 1.15 }, at)
          .fromTo(words[i], { scale: noteSize / tokSize }, { scale: 1, duration: 1.0, ease: 'power3.inOut' }, at)
          .fromTo(st.querySelector('.t5-st'), { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.8, ease: 'power2.out' }, `${at}+=0.35`)
      })
      tl.from(stones.map((st) => st.querySelector('.t5-tok-id')), { opacity: 0, y: -4, duration: 0.6, stagger: 0.05 }, '-=0.3')
        .from(ownNote, { opacity: 0, duration: 0.8 }, '<')
        .add(() => note.classList.add('is-gone'))
    })
  }

  /** where the scraps rest: the upper one just above the stones, the lower one just below (gone if there is no room) */
  let tearMid = 0
  function scrapPlace() {
    const sr = stage.getBoundingClientRect(), rr = row.getBoundingClientRect(), nr = note.getBoundingClientRect()
    const nt = nr.top - sr.top
    const tear = nt + tearMid
    // the lower scrap rests below the stones and the small note under them
    const bottom = Math.max(rr.bottom, ownNote.hidden ? 0 : ownNote.getBoundingClientRect().bottom)
    const ys = [rr.top - sr.top - 14 - tear, bottom - sr.top + 14 - tear]
    scraps.forEach((sc) => ((sc.style.left = `${nr.left - sr.left}px`), (sc.style.top = `${nt}px`), (sc.style.transformOrigin = `50% ${tearMid}px`)))
    return { ys, dx: Math.min(sr.width * 0.2, nr.width * 0.3), fits: tear + ys[0] - tearMid * SC > -16 && tear + ys[1] + (nr.height - tearMid) * SC < sr.height + 16 }
  }
  const SC = 0.56
  const scrapPose = (k: number, y: number, dx: number) => ({ y, x: k ? dx : -dx, rotation: k ? 2.5 : -3, scale: SC, opacity: 1 })
  function placeScraps() {
    const p = scrapPlace()
    scraps.forEach((sc, k) => gsap.set(sc, p.fits ? scrapPose(k, p.ys[k], p.dx) : { opacity: 0 }))
  }

  // ── the hidden instruction sheet slides in before your words
  function arriveSheet() {
    if (!cut) return
    const before = stones.map((st) => st.getBoundingClientRect().left)
    sheetBtn.hidden = false
    paintBed()
    if (sheetFocus) sheetBtn.focus({ preventScroll: true })
    if (ctx.reduced) return
    ctx.anim(() => {
      stones.forEach((st, i) => {
        const dx = before[i] - st.getBoundingClientRect().left
        if (Math.abs(dx) > 0.5) gsap.from(st, { x: dx, duration: 0.9, ease: 'power3.inOut' })
      })
      gsap.from(sheetBtn, { x: -Math.min(320, innerWidth * 0.4), rotation: -14, opacity: 0, duration: 1.3, ease: 'power3.out' })
    })
  }

  /** above the stones if there is room (it may cover the journey header), else below, else at the top of the scene;
   *  its left edge starts at the folded sheet, so it opens out of it */
  function placeCard() {
    const sb = root.getBoundingClientRect()
    const rr = row.getBoundingClientRect()
    const hb = sheetBtn.getBoundingClientRect()
    const ch = card.offsetHeight
    const above = rr.top - sb.top - ch - 10
    const below = rr.bottom - sb.top + 10
    card.style.top = `${above > -8 ? above : below + ch < sb.height ? below : 0}px`
    card.style.left = `${Math.max(0, Math.min(sb.width - card.offsetWidth, hb.left - sb.left - 14))}px`
  }
  function toggleSheet() {
    if (!card.hidden) return closeSheet()
    card.hidden = false
    sheetBtn.setAttribute('aria-expanded', 'true')
    sheetBtn.setAttribute('aria-label', T.sheetClose)
    sheetBtn.classList.add('is-open')
    placeCard()
    if (!ctx.reduced) {
      // the folded sheet opens: it lifts from its place in the row, then unfolds panel by panel
      const sb = sheetBtn.getBoundingClientRect(), cb = card.getBoundingClientRect()
      const ox = sb.left + sb.width / 2 - cb.left
      ctx.anim(() => {
        gsap.timeline()
          .fromTo(card, { opacity: 0, scaleX: 0.3, scaleY: 0.12, rotation: -6, transformOrigin: `${ox}px 100%` }, { opacity: 1, scaleX: 1, scaleY: 0.34, rotation: -1.5, duration: 0.55, ease: 'power3.out' })
          .to(card, { scaleY: 1, rotation: 0, duration: 0.85, ease: 'power3.inOut' })
          .fromTo(card.querySelector('.t5-card-folds'), { opacity: 1 }, { opacity: 0.2, duration: 1.2 }, '<')
          .from(card.querySelectorAll('p'), { opacity: 0, duration: 0.7, stagger: 0.12 }, '-=0.3')
          .from(card.querySelector('.t5-card-seal'), { scale: 1.6, opacity: 0, rotation: -20, duration: 0.6, ease: 'back.out(2)' }, '-=0.4')
      })
    }
    if (!seenSheet) {
      seenSheet = true
      ctx.chime('ok')
      ctx.insight(T.insight, T.sheetDetail)
    }
  }
  function closeSheet() {
    if (!card || card.hidden) return
    card.hidden = true
    sheetBtn.setAttribute('aria-expanded', 'false')
    sheetBtn.setAttribute('aria-label', T.sheetAria)
    sheetBtn.classList.remove('is-open')
  }
  const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeSheet()
  const onDoc = (e: PointerEvent) => !(e.target as Element).closest?.('.t5-sheet, .t5-card') && closeSheet()
  root.addEventListener('keydown', onKey)
  document.addEventListener('pointerdown', onDoc)
  const ro = new ResizeObserver(() => {
    root.classList.toggle('is-short', root.clientHeight < 300)
    if (!card.hidden) placeCard()
    restBrush()
    paintBed()
    if (cut && !busy?.isActive()) placeScraps()
  })
  ro.observe(stage)

  build()
  return () => {
    timers.forEach(clearTimeout)
    ro.disconnect()
    document.removeEventListener('pointerdown', onDoc)
    pad.style.touchAction = touch0
  }
}
