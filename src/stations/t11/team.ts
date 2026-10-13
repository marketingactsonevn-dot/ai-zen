import { fill, h, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import { brush } from '../t03/brush'
import type { SceneCtx } from '../types'
import { DESK_IDS, makeDesk } from './desks'
import { idler, makeMist, paintRoom, placeDesks, plan, type Plan } from './room'
import { C } from './data'

const T = C.scenes.team

/** Scene 1 — the team's room at dawn. Tap a desk: its worker does the job, and a caption says who they are. */
export function teamScene(ctx: SceneCtx) {
  const desks = DESK_IDS.map((id) => makeDesk(id, ctx.reduced, { lite: ctx.quality === 'low' }))
  const names = DESK_IDS.map((id) => h('span', { class: 't11-dname' }, T.desks[id].name))
  const btns = DESK_IDS.map((id, i) =>
    h('button', { class: 't11-desk', type: 'button', 'aria-label': fill(T.deskAria, { name: T.desks[id].name }), onClick: () => wake(i) },
      h('span', { class: 't11-glow', 'aria-hidden': 'true' }), desks[i].svg, names[i]))
  const room = s('svg', { class: 't11-room', 'aria-hidden': 'true' })
  const mist = makeMist(ctx.reduced)
  const role = h('span', { class: 't11-cap-role' })
  const say = h('span', { class: 't11-cap-text' })
  const cap = h('p', { class: 't11-cap', 'aria-live': 'polite' }, role, say)
  const lead = s('svg', { class: 't11-lead', 'aria-hidden': 'true' })
  const group = h('div', { class: 't11-floor', role: 'group', 'aria-label': T.group }, ...btns)
  const root = h('div', { class: 't11 t11-team' }, room, ...mist.els, group, lead, cap)
  ctx.art.append(root)
  ctx.prompt(T.prompt)

  let pl = null as Plan | null
  let capH = 0
  let cur = -1
  let W = 0
  let H = 0
  const N = () => (root.classList.contains('short') ? 20 : 26)


  const seen = new Set<number>()
  function wake(i: number) {
    const id = DESK_IDS[i]
    const first = !seen.has(i)
    seen.add(i)
    cur = i
    btns.forEach((b, j) => b.classList.toggle('cur', j === i))
    btns[i].classList.add('awake')
    role.textContent = T.desks[id].role
    say.textContent = T.desks[id].caption
    placeCap()
    ctx.anim(() => {
      desks[i].work()
      if (!ctx.reduced) {
        gsap.fromTo(cap, { opacity: 0, y: 8, filter: 'blur(4px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1, ease: 'power3.out' })
        gsap.fromTo(lead, { opacity: 0 }, { opacity: 1, duration: 1.2, ease: 'power2.out', delay: 0.2 })
        if (first) gsap.from(names[i], { opacity: 0, y: 6, filter: 'blur(4px)', duration: 1, ease: 'power3.out', delay: 0.15 })
      }
    })
    ctx.chime('soft')
    if (seen.size === DESK_IDS.length && first) ctx.insight(T.insight, T.detail)
  }

  /** Wide screens: the caption hangs on the wall above the tapped desk, tied to it by a thin thread of ink. */
  function placeCap() {
    lead.replaceChildren()
    if (cur < 0 || !pl) return
    const sp = pl.spots[cur]
    const wide = pl.mode !== 'tall'
    const cw = cap.offsetWidth
    const x = wide ? Math.max(0, Math.min(W - cw, sp.x - cw / 2)) : (W - cw) / 2
    Object.assign(cap.style, { left: `${x}px`, top: `${Math.max(0, capH - cap.offsetHeight)}px`, textAlign: wide && (x <= 0 || x >= W - cw - 1) ? (x <= 0 ? 'left' : 'right') : 'center' })
    const y0 = capH + 8
    const y1 = sp.y - sp.w * 0.75 * 0.86
    const wob = sp.w * 0.012
    let pts: [number, number][]
    if (wide) {
      if (y1 - y0 < 26) return
      pts = [[sp.x, y0], [sp.x + wob, (y0 + y1) / 2], [sp.x - wob * 0.5, y1]]
    } else {
      // phones: the thread hangs from the caption down the aisle between the two columns
      // (which zigzags with the rows), then turns in to the tapped desk
      const row = Math.round(sp.d * 2)
      const side = sp.x < W / 2 ? -1 : 1
      const aisle = (r: number) => W / 2 + (r % 2 ? -1 : 1) * W * 0.03
      const yRow = (r: number) => pl!.spots[r * 2].y - pl!.spots[r * 2].w * 0.75 * 0.62
      pts = [[W / 2, y0]]
      for (let r = 0; r < row; r++) pts.push([aisle(r), yRow(r)])
      const ye = yRow(row)
      pts.push([aisle(row), ye - sp.w * 0.12], [sp.x - side * sp.w * 0.3, ye])
    }
    lead.append(
      s('path', { class: 'k3', 'fill-opacity': 0.5, d: brush(pts, 1.3, { a: 0.1, b: 0.5, min: 0.2, wob: 0.2 }).d }),
      s('circle', { class: 'k3', 'fill-opacity': 0.5, cx: pts[0][0], cy: y0, r: 2 }))
  }

  /** The tallest caption at this width sets how much wall stays free above the desks. */
  function measureCap(cw: number) {
    cap.style.width = `${cw}px`
    const keep = [role.textContent, say.textContent]
    let m = 0
    for (const id of DESK_IDS) {
      role.textContent = T.desks[id].role
      say.textContent = T.desks[id].caption
      m = Math.max(m, cap.offsetHeight)
    }
    ;[role.textContent, say.textContent] = keep
    return m
  }

  function layout() {
    W = root.clientWidth
    H = root.clientHeight
    if (!W || !H) return
    root.classList.toggle('short', H < 330)
    const n = N()
    // try the caption beside a desk (wide) first; on narrow screens it spans the top
    const narrow = W / H < 1.05 || W < 560
    capH = measureCap(narrow ? Math.min(W, 520) : H < 330 ? Math.min(620, W * 0.72) : Math.min(420, W * 0.42))
    pl = plan(W, H, capH + 10, n)
    if (pl.mode === 'tall' && !narrow) {
      capH = measureCap(Math.min(W, 520))
      pl = plan(W, H, capH + 10, n)
    }
    root.dataset.mode = pl.mode
    placeDesks(btns, pl, n)
    mist.place(W, paintRoom(room, W, H, pl))
    lead.setAttribute('viewBox', `0 0 ${W} ${H}`)
    placeCap()
  }
  const ro = new ResizeObserver(layout)
  ro.observe(root)
  layout()

  if (!ctx.reduced) {
    const tl = gsap.timeline()
    tl.from(room, { opacity: 0, duration: 1.8, ease: 'power1.out' }, 0)
    tl.from(mist.els, { opacity: 0, duration: 2.4, stagger: 0.4 }, 0.6)
    // far desks are brushed first, then the near ones, each row left to right
    const sp = pl?.spots
    const order = DESK_IDS.map((_, i) => i).sort((a, b) => (sp ? sp[a].d - sp[b].d || sp[a].x - sp[b].x : a - b))
    order.forEach((i, k) => desks[i].draw(tl, 0.4 + k * 0.28, 1.3))
  }
  const stopIdle = ctx.reduced ? () => {} : idler(desks, 5.5)
  return () => {
    ro.disconnect()
    stopIdle()
    mist.stop()
  }
}
