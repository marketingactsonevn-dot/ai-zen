import { fill, h, s } from '../../core/dom'
import { brush, ell, poly, rrD, rrPts, type Pt } from '../t03/brush'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { DESK_IDS, makeDesk } from './desks'
import { idler, makeMist, paintRoom, placeDesks, plan } from './room'
import { C } from './data'

const G = C.scenes.game
const D = C.scenes.team.desks
const SLOTS = 4

interface Card {
  el: HTMLButtonElement
  ti: number
  slot: number
}

/** Scene 2 — task slips drift into a lacquer tray; drag (or pick, then pick a desk) to hand each to the right desk. */
export function gameScene(ctx: SceneCtx) {
  const desks = DESK_IDS.map((id) => makeDesk(id, ctx.reduced, { lite: ctx.quality === 'low' }))
  // finished jobs: small vermilion brush dots under each desk's table, inside its drawing
  const tallies = desks.map((d) => d.svg.appendChild(s('g', { class: 't11-tally', filter: 'url(#ink-rough)' })))
  const dBtns = DESK_IDS.map((id, i) =>
    h('button', { class: 't11-gdesk', type: 'button', 'aria-label': D[id].name, onClick: (e: MouseEvent) => onDesk(i, e.detail === 0) },
      h('span', { class: 't11-mat', 'aria-hidden': 'true' }), h('span', { class: 't11-glow', 'aria-hidden': 'true' }), desks[i].svg, h('span', { class: 't11-dname' }, D[id].name)))
  const slots = Array.from({ length: SLOTS }, () => h('div', { class: 't11-slot' }))
  const inbox = h('div', { class: 't11-inbox', role: 'group', 'aria-label': G.inbox }, ...slots)
  const left = h('p', { class: 't11-left', 'aria-hidden': 'true' })
  const note = h('p', { class: 't11-note', 'aria-live': 'polite' })
  const sr = h('p', { class: 'visually-hidden', 'aria-live': 'polite' })
  const deskRow = h('div', { class: 't11-floor', role: 'group', 'aria-label': G.desks }, ...dBtns)
  const trayArt = s('svg', { class: 't11-trayart', 'aria-hidden': 'true' })
  const tray = h('div', { class: 't11-tray' }, trayArt, inbox, left)
  const room = s('svg', { class: 't11-room', 'aria-hidden': 'true' })
  const mist = makeMist(ctx.reduced)
  const root = h('div', { class: 't11 t11-game' }, room, ...mist.els, tray, note, deskRow, sr)
  ctx.art.append(root)
  ctx.prompt(G.prompt)

  // shuffled once per visit; the tray holds four slips at a time
  const queue = G.tasks.map((_, i) => i).sort(() => Math.random() - 0.5)
  const cards: (Card | null)[] = Array(SLOTS).fill(null)
  const done = DESK_IDS.map(() => 0)
  let remaining = G.tasks.length
  let picked: Card | null = null
  let sealed: HTMLElement | null = null
  const timers: number[] = []
  const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ctx.reduced ? 0 : ms))

  const setLeft = () => (left.textContent = remaining ? fill(G.left, { n: remaining }) : '')
  setLeft()

  function deal(slot: number, delay = 0) {
    const ti = queue.shift()
    if (ti === undefined) return
    const tilt = ((ti * 37) % 7) - 3
    const el = h('button', { class: 't11-card', type: 'button', 'aria-pressed': 'false', 'aria-label': fill(G.card, { task: G.tasks[ti].text }), style: `--tilt:${tilt * 0.8}deg` },
      h('span', { class: 't11-card-in' }, h('span', { class: 't11-card-t' }, G.tasks[ti].text), h('span', { class: 't11-seal', 'aria-hidden': 'true' })))
    const card: Card = { el, ti, slot }
    cards[slot] = card
    slots[slot].replaceChildren(el)
    bindDrag(card)
    if (!ctx.reduced)
      ctx.anim(() => {
        const drop = slots[slot].offsetTop + slots[slot].offsetHeight + 40
        const sway = (ti % 2 ? 1 : -1) * (14 + (ti % 3) * 6)
        const tl = gsap.timeline({ delay })
        tl.fromTo(el, { y: -drop, opacity: 0 }, { y: 0, opacity: 1, duration: 1.5, ease: 'power2.out' }, 0)
        tl.fromTo(el, { x: sway, rotation: -sway * 0.6 }, { keyframes: [{ x: -sway * 0.55, rotation: sway * 0.35, duration: 0.7, ease: 'sine.inOut' }, { x: 0, rotation: 0, duration: 0.9, ease: 'back.out(1.6)' }] }, 0)
      })
  }

  function select(card: Card | null) {
    if (picked) {
      picked.el.setAttribute('aria-pressed', 'false')
      picked.el.classList.remove('picked')
    }
    picked = card && card !== picked ? card : null
    root.classList.toggle('armed', !!picked)
    if (picked) {
      picked.el.setAttribute('aria-pressed', 'true')
      picked.el.classList.add('picked')
      sr.textContent = fill(G.picked, { task: G.tasks[picked.ti].text })
    }
  }

  function showNote(text: string) {
    note.textContent = text
    if (!ctx.reduced) ctx.anim(() => gsap.fromTo(note, { opacity: 0, y: 6, filter: 'blur(3px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.8, ease: 'power3.out' }))
  }

  function home(card: Card, wrong: boolean) {
    if (ctx.reduced) return void gsap.set(card.el, { x: 0, y: 0, rotation: 0 })
    ctx.anim(() =>
      gsap.to(card.el, wrong
        ? { keyframes: [{ x: 0, y: 0, rotation: 4, duration: 0.55, ease: 'power3.out' }, { rotation: -3, duration: 0.14 }, { rotation: 0, duration: 0.3, ease: 'back.out(3)' }] }
        : { x: 0, y: 0, rotation: 0, duration: 0.6, ease: 'power3.out' }))
  }

  function tally(di: number) {
    const g = tallies[di]
    const k = done[di] - 1
    const dot = s('path', { d: ell(0, 177, 3.8 - k * 0.4, 3 - k * 0.25), class: 'v' })
    g.append(s('g', null, dot))
    // the dots sit centred under the table, a brush-width apart
    const n = g.children.length
    ;[...g.children].forEach((c, j) => c.setAttribute('transform', `translate(${120 + (j - (n - 1) / 2) * 12} ${j % 2 ? -0.8 : 0})`))
    if (!ctx.reduced) ctx.anim(() => gsap.fromTo(dot, { opacity: 0, scale: 0.2, svgOrigin: '0 177' }, { opacity: 1, scale: 1, duration: 0.7, ease: 'back.out(2.4)', delay: 0.6 }))
  }

  function assign(card: Card, di: number, kb: boolean) {
    select(null)
    const t = G.tasks[card.ti]
    const id = DESK_IDS[di]
    if (t.desk !== id) {
      ctx.chime('low')
      home(card, true)
      if (!ctx.reduced) ctx.anim(() => gsap.fromTo(desks[di].svg, { x: 0 }, { keyframes: { x: [0, -5, 4, -2, 0] }, duration: 0.5, ease: 'power1.inOut' }))
      showNote(t.near?.[id] ?? t.why)
      if (kb) card.el.focus()
      return
    }
    ctx.chime('ok')
    cards[card.slot] = null
    remaining--
    done[di]++
    tally(di)
    ctx.anim(() => desks[di].work())
    dBtns[di].classList.add('got')
    sr.textContent = fill(G.right, { desk: D[id].name, task: t.text })
    note.textContent = ''
    setLeft()
    card.el.classList.add('placed')
    card.el.disabled = true
    const gone = () => {
      card.el.remove()
      if (queue.length) deal(card.slot)
      else if (!remaining) finish()
      if (kb) (cards.find(Boolean)?.el ?? dBtns[di]).focus()
    }
    if (ctx.reduced) return gone()
    const a = card.el.getBoundingClientRect()
    const b = desks[di].svg.getBoundingClientRect()
    ctx.anim(() => {
      gsap.to(card.el, { x: `+=${b.left + b.width / 2 - (a.left + a.width / 2)}`, y: `+=${b.top + b.height * 0.45 - (a.top + a.height / 2)}`, scale: 0.2, rotation: 0, opacity: 0, duration: 0.75, ease: 'power2.in' })
    })
    later(gone, 800)
  }

  /** All handed out: the tray clears away and a seal is pressed where it stood, over a room of lit desks. */
  function finish() {
    const S = 100
    const r = (n: number) => (((n * 9301 + 49297) % 233280) / 233280 - 0.5) * 3.2
    const body: Pt[] = [[8 + r(1), 9 + r(2)], [50, 7 + r(3)], [92 + r(4), 8 + r(5)], [93 + r(6), 50], [91 + r(7), 92 + r(8)], [50, 93 + r(9)], [8 + r(10), 91 + r(11)], [7 + r(12), 50]]
    const bleed = s('path', { class: 'hk-bleed', d: rrD(2, 2, 96, 96, 14), filter: 'url(#ink-wash)' })
    const svg = s('svg', { viewBox: `0 0 ${S} ${S}`, 'aria-hidden': 'true' },
      bleed,
      s('g', { filter: 'url(#ink-rough)' },
        s('path', { class: 'hk-body', d: poly(body) }),
        s('path', { class: 'hk-cut', d: brush(rrPts(17, 17, 66, 66, 5), 2.6, { a: 0.03, b: 0.03, min: 0.5, wob: 0.2 }).d })),
      s('text', { class: 'hk-word', x: 50, y: 50, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, G.seal))
    const seal = h('div', { class: 't11-hanko' }, svg)
    const cap = h('p', { class: 't11-hanko-cap' }, fill(G.done, { n: G.tasks.length }))
    const box = h('div', { class: 't11-sealbox' }, seal, cap)
    sealed = box
    root.append(box)
    placeSeal()
    root.classList.add('finished')
    sr.textContent = fill(G.done, { n: G.tasks.length })
    if (!ctx.reduced)
      ctx.anim(() => {
        const tl = gsap.timeline()
        tl.to(tray, { opacity: 0, y: -10, filter: 'blur(6px)', duration: 0.9, ease: 'power2.in' }, 0)
        tl.fromTo(seal, { opacity: 0, scale: 1.45, rotation: -12 }, { opacity: 1, scale: 0.94, rotation: -5, duration: 0.42, ease: 'power3.in' }, 0.8)
        tl.to(seal, { scale: 1, duration: 0.6, ease: 'back.out(3)' }, 1.22)
        tl.fromTo(bleed, { opacity: 0, scale: 0.9, svgOrigin: '50 50' }, { opacity: 1, scale: 1.1, duration: 1.2, ease: 'power2.out' }, 1.2)
        tl.fromTo(cap, { opacity: 0, y: 8, filter: 'blur(4px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1, ease: 'power3.out' }, 1.5)
        tl.fromTo(dBtns.map((b) => b.querySelector('.t11-glow')), { opacity: 0 }, { opacity: 1, duration: 1.2, stagger: 0.1 }, 1.3)
      })
    ctx.insight(G.insight, G.detail)
  }

  /** the seal takes the free wall above the far desks, where the tray stood */
  let free = 0
  let sideW = 0
  function placeSeal() {
    if (!sealed) return
    const room = sideW ? root.clientHeight * 0.8 : free
    const sz = Math.max(54, Math.min(92, room * 0.48, root.clientWidth * 0.18))
    sealed.style.setProperty('--seal', `${sz}px`)
    Object.assign(sealed.style, { top: '0px', height: `${Math.max(room, sz + 44)}px`, width: sideW ? `${sideW}px` : '', right: sideW ? 'auto' : '' })
  }

  function onDesk(di: number, kb: boolean) {
    if (picked) return assign(picked, di, kb)
    if (sealed) return
    showNote(G.noCard)
    if (!ctx.reduced) ctx.anim(() => gsap.fromTo(desks[di].svg, { y: 0 }, { y: -4, duration: 0.18, yoyo: true, repeat: 1, ease: 'power1.out' }))
  }

  // with a slip in hand, ← → step from desk to desk in the order they are seen (not the scene arrows)
  let visual = DESK_IDS.map((_, i) => i)
  root.addEventListener('keydown', (e) => {
    if (!picked || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return
    e.preventDefault()
    const at = visual.indexOf(dBtns.indexOf(document.activeElement as HTMLButtonElement))
    const dir = e.key === 'ArrowRight' ? 1 : -1
    const k = at < 0 ? (dir > 0 ? 0 : visual.length - 1) : (at + dir + visual.length) % visual.length
    dBtns[visual[k]].focus()
  })

  // ───────── drag ─────────
  let hover = -1
  /** desks overlap a little at two depths: the drop goes to the nearest desk whose box holds the pointer */
  const hit = (x: number, y: number) => {
    let best = -1
    let bd = Infinity
    dBtns.forEach((b, i) => {
      const r = b.getBoundingClientRect()
      if (x < r.left - 8 || x > r.right + 8 || y < r.top - 12 || y > r.bottom + 8) return
      const d = Math.hypot(x - (r.left + r.width / 2), (y - (r.top + r.height * 0.62)) * 1.4)
      if (d < bd) [bd, best] = [d, i]
    })
    return best
  }
  const setHover = (i: number) => {
    if (i === hover) return
    if (hover >= 0) dBtns[hover].classList.remove('over')
    hover = i
    if (i >= 0) dBtns[i].classList.add('over')
  }

  function bindDrag(card: Card) {
    const el = card.el
    let st: { x: number; y: number; id: number; moved: boolean } | null = null
    let skipClick = false
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || el.disabled) return
      st = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false }
      el.setPointerCapture(e.pointerId)
    })
    el.addEventListener('pointermove', (e) => {
      if (!st || e.pointerId !== st.id) return
      const dx = e.clientX - st.x
      const dy = e.clientY - st.y
      if (!st.moved) {
        if (Math.hypot(dx, dy) < 6) return
        st.moved = true
        if (picked && picked !== card) select(null)
        gsap.killTweensOf(el)
        el.classList.add('dragging')
        root.classList.add('dragging')
      }
      gsap.set(el, { x: dx, y: dy, rotation: Math.max(-7, Math.min(7, dx * 0.03)) })
      setHover(hit(e.clientX, e.clientY))
    })
    const end = (e: PointerEvent, cancel = false) => {
      if (!st || e.pointerId !== st.id) return
      const moved = st.moved
      st = null
      if (!moved) return
      skipClick = true
      el.classList.remove('dragging')
      root.classList.remove('dragging')
      const i = cancel ? -1 : hover
      setHover(-1)
      if (i >= 0) assign(card, i, false)
      else home(card, false)
    }
    el.addEventListener('pointerup', (e) => end(e))
    el.addEventListener('pointercancel', (e) => end(e, true))
    el.addEventListener('click', () => {
      if (skipClick) return void (skipClick = false)
      select(card)
    })
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && picked) {
        e.stopPropagation()
        select(null)
      }
    })
  }

  for (let i = 0; i < SLOTS; i++) deal(i, 0.5 + i * 0.28)

  function layout() {
    const W = root.clientWidth
    const H = root.clientHeight
    if (!W || !H) return
    const narrow = W < 600 || W / H < 1.05
    const short = H < 330
    // short, wide screens: the tray and its note stand at the left, the room takes the rest
    const side = H < 380 && W / H > 1.6
    root.classList.toggle('narrow', narrow)
    root.classList.toggle('short', short)
    root.classList.toggle('side', side)
    sideW = side ? Math.min(440, W * 0.44) : 0
    tray.style.width = note.style.width = side ? `${sideW}px` : ''
    const N = short ? 20 : 26
    const top = tray.offsetHeight + note.offsetHeight + 4
    note.style.top = `${tray.offsetHeight}px`
    const pl = plan(W - sideW, H, side ? 0 : top, N, 380)
    if (side) {
      pl.spots.forEach((p) => (p.x += sideW))
      pl.opening = [pl.opening[0] + sideW, pl.opening[1] + sideW]
    }
    root.dataset.mode = pl.mode
    placeDesks(dBtns, pl, N)
    // focus walks the desks as they are seen: far row first, then nearer, each left to right
    const order = DESK_IDS.map((_, i) => i).sort((a, b) => pl.spots[a].d - pl.spots[b].d || pl.spots[a].x - pl.spots[b].x)
    if (order.some((i, k) => deskRow.children[k] !== dBtns[i])) {
      const had = document.activeElement
      deskRow.append(...order.map((i) => dBtns[i]))
      if (had instanceof HTMLElement && deskRow.contains(had)) had.focus()
    }
    visual = order
    free = Math.min(...pl.spots.map((p) => p.y - p.w * 0.75 * 0.84))
    mist.place(W, paintRoom(room, W, H, pl, { quiet: true, clear: side ? 0 : top }))
    requestAnimationFrame(drawTray)
    placeSeal()
  }

  /** A shallow lacquer tray seen from the front: a bleeding wash under the slips, a raised near rim, a thin far edge. */
  function drawTray() {
    const W = tray.clientWidth
    const H = tray.clientHeight
    if (!W || !H) return
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (const sl of slots) {
      x0 = Math.min(x0, inbox.offsetLeft + sl.offsetLeft)
      y0 = Math.min(y0, inbox.offsetTop + sl.offsetTop)
      x1 = Math.max(x1, inbox.offsetLeft + sl.offsetLeft + sl.offsetWidth)
      y1 = Math.max(y1, inbox.offsetTop + sl.offsetTop + sl.offsetHeight)
    }
    const px = Math.min(24, W * 0.03)
    const top = y0 - Math.min(10, H * 0.06)
    const bot = y1 + Math.min(12, H * 0.07)
    const a = x0 - px
    const b = x1 + px
    const lip = Math.max(5, (bot - top) * 0.06)
    trayArt.setAttribute('viewBox', `0 0 ${W} ${H}`)
    trayArt.replaceChildren(
      // the lacquer floor: one wash with a bleeding edge
      s('path', { class: 'tr-floor', d: rrD(a + 6, top, b - a - 12, bot - top, 10), filter: 'url(#ink-wash)' }),
      // the shadow the tray throws on the shelf below it
      s('path', { class: 'tr-lip', d: ell((a + b) / 2, bot + lip * 1.6, (b - a) * 0.5, lip * 0.9), filter: 'url(#ink-wash)' }),
      s('g', { filter: 'url(#ink-rough)' },
        // far edge: a thin dry line, a little shorter than the near rim
        s('path', { class: 'k3', 'fill-opacity': 0.55, d: brush([[a + 16, top + 1], [(a + b) / 2, top - 0.5], [b - 16, top + 0.8]], 1.1, { a: 0.2, b: 0.25, min: 0.25, wob: 0.15 }).d }),
        // near rim: pressed in at the left, lifted at the right, its ends turning up like a tray's raised lip
        s('path', { class: 'k2', 'fill-opacity': 0.8, d: brush([[a - 2, bot - lip * 1.6], [a + 6, bot], [(a + b) * 0.5, bot + 1.2], [b - 6, bot + 0.3], [b + 2, bot - lip * 1.4]], 3.6, { a: 0.04, b: 0.1, min: 0.3, wob: 0.14 }).d }),
        s('path', { class: 'k3', 'fill-opacity': 0.45, d: brush([[a + 10, bot + lip], [b - 10, bot + lip + 0.6]], 1, { a: 0.25, b: 0.25, min: 0.3 }).d })))
    Object.assign(left.style, { left: `${a + 4}px`, right: 'auto', top: `${bot + lip + 6}px` })
  }
  const ro = new ResizeObserver(layout)
  ro.observe(root)
  layout()

  if (!ctx.reduced) {
    const tl = gsap.timeline()
    tl.from(room, { opacity: 0, duration: 1.4, ease: 'power1.out' }, 0)
    tl.from(dBtns, { opacity: 0, y: 16, duration: 0.9, stagger: 0.08, ease: 'power3.out', clearProps: 'opacity,transform' }, 0.2)
  }
  const stopIdle = ctx.reduced ? () => {} : idler(desks, 6)
  return () => {
    ro.disconnect()
    timers.forEach(clearTimeout)
    stopIdle()
    mist.stop()
  }
}
