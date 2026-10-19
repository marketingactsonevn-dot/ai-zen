import { fill, h, s } from '../../core/dom'
import { L, type Fact } from '../../core/content'
import { sliced } from '../../core/chunk'
import type { SceneCtx } from '../types'
import { blob, curve, onSize, rng, stableHeight, stroke, type Pt } from '../../ui/part2/ink'
import { grass, hills, mist, moon, paperLantern } from '../../ui/part2/paint'
import { findTakeaway, takeaway } from '../../ui/part2/takeaway'
import { C } from './data'
import { guide } from '../../ui/part2/guide'
import { arm, kura, runner, scribe, t29Defs } from './figures'
import { at3, billboard, clamp, f1, P, plane, project, rig, stand } from './rig'

const G = C.scenes.desk
// a laptop's RAM (audit v3 29-1: the H200's 141 GB of HBM is not a desk you can buy; it goes in the detail)
const GB = [8, 16, 32, 64]
const OPEN = [1, 3, 5, 8] // scrolls laid open at each width (as many as fit)
const PLATES = 10
// garden units (× k = px): desk height, apron, depth; the inkstone (the chip), the HBM tower, a scroll; the camera distance
const HD = 66, TA = 14, DD = 200
const INK = { x: 0, z: -44, w: 74, d: 62, t: 12 }
const TOWER = { x: -72, z: -48, r: 29, gap: 7.5, open: 25, base: 9 }
const SCR = { w: 100, d: 86 }
// what lies on the desk, in the order the slots fill: the sheet being written, an open handscroll, a stack, a closed roll…
const KINDS = ['half', 'scroll', 'stack', 'roll', 'pair', 'sheet', 'roll', 'stack'] as const
const CAM = 1250
const LAMP = { x: -26, y: -268, z: -46 }

/**
 * ★ Bàn thư lại (2.5D, CSS 3D): a black lacquered desk on a moss bed under a paper lantern. The chip is the inkstone in the
 * middle, the scribe kneels behind it, the HBM tower of celadon plates stands right at its edge. Drag the carved board at
 * the desk's end: the desk widens (memory) and more scrolls lie open; on a narrow desk a runner walks the stepping stones
 * into the mist to the store and back while the brush waits. Tap the tower: the plates fan apart (exploded view) and the
 * camera swings round to show them right beside the chip; close it for insight 2. Drag the garden to turn ±25°.
 */
export function deskScene(ctx: SceneCtx) {
  t29Defs()
  let idx = 1
  let open = false
  let stage = 0 // 1 = desk moved (insight 1), 2 = tower opened, 3 = tower closed again (insight 2)
  const card = findTakeaway(C.takeaways[0])

  const back = s('svg', { class: 't29d-back', role: 'img', 'aria-label': G.art })
  const backWrap = h('div', { class: 't29d-backwrap' }, back)
  const root = h('div', { class: 't29d' }, backWrap)
  ctx.art.append(root)
  const stableH = stableHeight(ctx, G.insights as Fact[])
  let Pd = 1000, W = 0, H = 0, k = 1, wide = true, yaw0 = -26, pitch0 = 22, lift = 0, FX = 0, FY = 0
  let frameM = [16, 80, 40, 40] // the frame's margins: left, right (the board's half width), top, bottom
  const R = rig(ctx, root, {
    yaw: yaw0, pitch: pitch0, drag: 25, tilt: 1.4,
    onMove: (yaw, pitch) => {
      // the far hills sit at infinity: they slide by the camera's turn; the near grass slides a little the other way
      const r = Math.PI / 180, dx = Pd * Math.tan((yaw - yaw0) * r)
      backWrap.style.transform = `translate3d(${f1(-dx)}px,${f1(-Pd * (Math.tan(pitch * r) - Math.tan(pitch0 * r)))}px,0)`
      fg.style.transform = `translate3d(${f1(dx * 0.12)}px,0,0)`
    },
  })
  const fg = s('svg', { class: 't29d-fg', 'aria-hidden': 'true' })
  root.append(fg)

  // ── the controls and what they say (built once; the layout only moves them)
  const valueText = () => fill(G.valueText, { n: GB[idx] })
  const boardText = h('span', { class: 't29d-board-text' }, valueText())
  const board = h('div', {
    class: 't29d-board', role: 'slider', tabindex: '0', 'aria-label': G.slider, 'aria-valuemin': '0', 'aria-valuemax': String(GB.length - 1),
    'aria-valuenow': String(idx), 'aria-valuetext': valueText(),
  }, h('span', { class: 't29d-board-grip', 'aria-hidden': 'true' }), boardText, h('span', { class: 't29d-board-grip', 'aria-hidden': 'true' }))
  const msg = h('p', { class: 't29d-msg' })
  const tower = h('div', { class: 't29d-hit', role: 'button', tabindex: '0', 'aria-expanded': 'false', 'aria-label': G.towerAria })
  const tag = h('p', { class: 't29d-tag-text' }, G.stackLabel)
  const slip = h('button', { class: 't29d-slip', type: 'button', 'aria-label': `${L.takeaway}: ${card?.title ?? ''}`, hidden: true }, h('span', null, L.takeaway))
  const sheet = h('div', { class: 't29d-sheet', role: 'region', 'aria-label': L.takeaway, hidden: true })
  root.append(sheet)

  // ── world pieces that the state moves (filled by build())
  let deskFaces: { el: HTMLElement; t: (wd: number) => string }[] = []
  let scrolls: HTMLElement[] = []
  let plates: HTMLElement[] = []
  let threads: HTMLElement[] = []
  let boardAt: HTMLElement | null = null, slipAt: HTMLElement | null = null, hitCard: HTMLElement | null = null, tagAt: HTMLElement | null = null
  let wmin = 290, wmax = 780
  let KURA = { x: -560, z: -1500 }

  const wOf = (i: number) => wmin + ((wmax - wmin) * i) / (GB.length - 1)
  // where the papers lie: the sheet being written (back right of the inkstone), then the front row, then the back corners;
  // each a little askew, never in a grid, and the near-right corner stays free for the carved board
  function slots(wd: number): [number, number, number][] {
    const half = wd / 2 - 10
    const fits = (x: number, z: number) => Math.abs(x) + SCR.w / 2 <= half && !(z > 0 && x + SCR.w / 2 > half - 86)
    const out: [number, number, number][] = [[94, -54, -5]]
    for (const [x, z, r] of [[-6, 46, 4], [122, 40, -8], [-128, 52, 9], [240, 48, 3], [-246, 38, -6], [352, 44, 7], [-356, 50, -3]]) if (fits(x, z)) out.push([x, z, r])
    for (const [x, z, r] of [[-176, -60, 7], [214, -44, -10], [-290, -42, 4], [326, -58, -7]]) if (fits(x, z)) out.push([x, z, r])
    return out
  }

  function setDesk(first = false) {
    const wd = wOf(idx)
    for (const f of deskFaces) f.el.style.transform = f.t(wd)
    const sl = slots(wd)
    const n = Math.min(OPEN[idx], sl.length)
    scrolls.forEach((el, i) => {
      const [x, z, r] = sl[Math.min(i, sl.length - 1)]
      const on = i < n
      el.style.transform = `translate3d(${f1((x - SCR.w / 2) * k)}px,${f1(-HD * k - SCR.d * k / 2 - 0.8 - (i % 3) * 0.3)}px,${f1(z * k)}px) rotateX(90deg) rotateZ(${r}deg) scale(${on ? 1 : 0.06}, ${on ? 1 : 0.5})`
      el.style.opacity = on ? '1' : '0'
      // the lantern warms what lies near it (its foot is at LAMP.x, LAMP.z)
      el.style.setProperty('--warm', clamp(1.15 - Math.hypot(x - LAMP.x, z - LAMP.z) / 300, 0, 1).toFixed(2))
    })
    // the carved board sits on the desk's near-right corner and travels with it
    if (boardAt) boardAt.style.transform = at3((wd / 2 - 30) * k, -HD * k, (DD / 2 - 12) * k)
    if (slipAt) slipAt.style.transform = at3(-wd * 0.18 * k, 0, (DD / 2 + 70) * k)
    const t = idx / (GB.length - 1)
    root.style.setProperty('--pace', `${(1.5 - t * 1.05).toFixed(2)}s`)
    root.style.setProperty('--its', String(Math.ceil(12 / (1.5 - t * 1.05)) * 2))
    const narrow = idx <= 2
    if (!first) {
      // restart the brush and the runner (they rest after a while)
      root.classList.remove('is-narrow', 'is-wide')
      void root.offsetWidth
    }
    root.classList.add(narrow ? 'is-narrow' : 'is-wide')
    const tv = valueText()
    boardText.textContent = tv
    board.setAttribute('aria-valuenow', String(idx))
    board.setAttribute('aria-valuetext', tv)
    if (!first) {
      msg.textContent = narrow ? G.small : G.large
      if (!msg.hasAttribute('aria-live')) msg.setAttribute('aria-live', 'polite')
      root.classList.add('has-msg')
    }
  }

  // the insight comes once both ends have been tried: the cramped desk and the wide one (audit v3 29-1)
  const ends = new Set<number>()
  function step(to: number) {
    to = clamp(to, 0, GB.length - 1)
    if (to === idx) return
    idx = to
    setDesk()
    ctx.chime('soft')
    if (idx === 0 || idx === GB.length - 1) ends.add(idx)
    if (stage === 0 && ends.size === 2) {
      stage = 1
      ctx.insight(G.insights[0] as Fact)
      prompts(2)
      boardDot.done()
      towerDot = gd.dot(tower, { dir: [0, -1] })
      shift()
      root.classList.add('is-cue') // the tower glows a few times: touch me
    } else if (stage === 0) prompts(1)
  }

  function toggle() {
    open = !open
    root.classList.toggle('is-open', open)
    tower.setAttribute('aria-expanded', String(open))
    tower.setAttribute('aria-label', open ? G.closePrompt : G.towerAria)
    placeTower()
    if (open) {
      aim()
      if (stage < 2) stage = 2
      if (stage === 2) prompts(3)
      root.classList.remove('is-cue')
      ctx.chime('soft')
    } else {
      aim()
      if (stage === 2) {
        stage = 3
        ctx.insight(G.insights[1] as Fact, G.detail as Fact[])
        ctx.chime('ok')
        root.classList.add('is-sealed')
        towerDot?.done()
        // (the take-away card now waits at the end of the station, slide 4)
      }
    }
  }

  function placeTower() {
    const g = open ? TOWER.open : TOWER.gap
    plates.forEach((p, i) => (p.style.transform = at3(0, -(TOWER.base + i * g) * k, 0)))
    const hh = (TOWER.base + (PLATES - 1) * g + 8) * k
    threads.forEach((t) => (t.style.transform = `scaleY(${(hh / ((TOWER.base + (PLATES - 1) * TOWER.open + 8) * k)).toFixed(3)})`))
    if (hitCard) {
      hitCard.style.height = `${f1(hh + 18 * k)}px`
      hitCard.style.top = `${f1(-hh - 12 * k)}px`
    }
    // the tanzaku hangs on a string from the top plate's left rim (it rides up with it)
    if (tagAt) tagAt.style.transform = at3(-TOWER.r * 0.92 * k, -(TOWER.base + (PLATES - 1) * g + 2) * k, TOWER.r * 0.2 * k)
  }

  // the camera: home, or swung round onto the open tower (it stands right at the inkstone's edge), framed so the tall tower,
  // its tanzaku, the lantern and the desk's corner board all stay in view: push in only as far as they still fit
  function aim() {
    if (!open) return R.home(yaw0, pitch0, lift)
    const yaw = yaw0 + (wide ? 18 : 14), pitch = pitch0 - 3, wd = wOf(idx)
    const top = -HD - TOWER.base - (PLATES - 1) * TOWER.open - 16
    const pp = ([[-wd / 2, 0, DD / 2], [wd / 2, 0, DD / 2], [wd / 2, -HD, -DD / 2], [-wd / 2, -HD, -DD / 2], [wd / 2 - 30, -HD - 40, DD / 2 - 12],
      // the tanzaku is ~100 px wide and hangs ~110 px below the top plate, whatever the scale
      [TOWER.x, top, TOWER.z], [TOWER.x - TOWER.r - 112 / k, top + 116 / k, TOWER.z], [LAMP.x, LAMP.y - 30, LAMP.z]] as [number, number, number][]).map((p) => project(yaw, pitch, CAM, p))
    const xs = pp.map((p) => p[0] * k), ys = pp.map((p) => p[1] * k)
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
    const sc = Math.min((W - frameM[0] - frameM[1]) / (x1 - x0), (H - frameM[2] - frameM[3]) / (y1 - y0), wide ? 1.3 : 1.12)
    const pan = (frameM[0] + (W - frameM[0] - frameM[1]) / 2 - FX) / sc - (x0 + x1) / 2
    const up = (frameM[2] + (H - frameM[2] - frameM[3]) / 2 - FY) / sc - (y0 + y1) / 2
    R.home(yaw, pitch, up, Pd * (1 - 1 / sc), pan)
  }
  // the insight rises from the foot: the camera settles a touch
  function shift() {
    lift = -0.015 * H
    aim()
  }

  // ── input: the board (drag along the desk, or keys), the tower (tap / Enter / Space), the take-away slip
  let drag: { id: number; x: number; i: number; px: number } | null = null
  board.addEventListener('pointerdown', (e) => {
    if (e.button) return
    board.setPointerCapture(e.pointerId)
    board.focus({ preventScroll: true })
    drag = { id: e.pointerId, x: e.clientX, i: idx, px: Math.max(18, ((wmax - wmin) / (GB.length - 1)) * 0.5 * k * Math.cos((R.yaw * Math.PI) / 180)) }
    root.classList.add('is-pulling')
  })
  board.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return
    step(drag.i + Math.round((e.clientX - drag.x) / drag.px))
  })
  const endDrag = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return
    // a tap without a drag: the near half narrows, the far half widens
    if (Math.abs(e.clientX - drag.x) < 4 && e.type === 'pointerup') {
      const r = board.getBoundingClientRect()
      step(idx + (e.clientX > r.left + r.width / 2 ? 1 : -1))
    }
    drag = null
    root.classList.remove('is-pulling')
  }
  board.addEventListener('pointerup', endDrag)
  board.addEventListener('pointercancel', endDrag)
  board.addEventListener('keydown', (e) => {
    const d = { ArrowRight: 1, ArrowUp: 1, PageUp: 1, ArrowLeft: -1, ArrowDown: -1, PageDown: -1 }[e.key]
    const to = d ? idx + d : e.key === 'Home' ? 0 : e.key === 'End' ? GB.length - 1 : -1
    if (to < 0) return
    e.preventDefault()
    step(to)
  })
  tower.addEventListener('click', toggle)
  tower.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    toggle()
  })
  slip.addEventListener('click', () => {
    if (!card) return
    if (!sheet.childElementCount) sheet.append(h('button', { class: 't29d-close', type: 'button', 'aria-label': L.close, onClick: () => ((sheet.hidden = true), slip.focus()) }, '×'), takeaway(card, null, ctx.onCleanup))
    sheet.hidden = false
    ;(sheet.querySelector('.p2k-copy') as HTMLElement | null)?.focus()
  })

  // ── layout: frame the camera, then (re)build the world
  let job: { cancel(): void } | null = null
  let built = false
  ctx.onCleanup(() => job?.cancel())
  function layout() {
    W = ctx.art.clientWidth
    H = stableH(ctx.art.clientHeight)
    if (W < 60 || H < 60) return
    root.style.height = `${f1(H)}px`
    wide = W / H > 1.15
    ;[wmin, wmax] = wide ? [290, 780] : [280, 470]
    KURA = wide ? { x: -330, z: -1500 } : { x: -260, z: -1300 }
    yaw0 = wide ? -26 : -34
    pitch0 = wide ? 19 : 34
    // frame what must be seen at home: the widest desk and its corner board, the rod and lantern, the scribe, the tower;
    // projected once in garden units, then scaled and centred into the frame (the board's own px width as a right margin)
    const pts: [number, number, number][] = [
      [-wmax / 2, 0, DD / 2], [wmax / 2, 0, DD / 2], [wmax / 2, -HD, -DD / 2], [-wmax / 2, -HD, -DD / 2],
      // on a phone the rod's foot may leave the frame (a near thing cut by the edge); the lantern may not
      [wmax / 2 - 30, -HD - 40, DD / 2 - 12], wide ? [-(wmax / 2 + 100), 0, LAMP.z] : [-wmax / 2, -HD, 0], [LAMP.x, LAMP.y - 30, LAMP.z], [34, -250, -128],
      [TOWER.x, -HD - TOWER.base - (PLATES - 1) * TOWER.gap - 30, TOWER.z],
    ]
    const pp = pts.map((p) => project(yaw0, pitch0, CAM, p))
    const xs = pp.map((p) => p[0]), ys = pp.map((p) => p[1])
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
    const mL = wide ? 16 : 10, mR = (wide ? 76 : 56) + 10, mT = H * 0.05, mB = H * (wide ? 0.04 : 0.06)
    k = Math.min((W - mL - mR) / (x1 - x0), (H - mT - mB) / (y1 - y0), H / 330)
    Pd = CAM * k
    const fx = mL + (W - mL - mR - k * (x1 - x0)) / 2 - k * x0
    const fy = mT + (H - mT - mB - k * (y1 - y0)) * (wide ? 0.9 : 0.72) - k * y0
    FX = fx
    FY = fy
    frameM = [mL, mR, mT, mB]
    R.frame(Pd, fx, fy)
    lift = stage ? -0.015 * H : 0
    aim()
    job?.cancel()
    // a rebuild re-parents the controls: keep the keyboard where it was (the insight rising re-lays the scene out)
    const had = root.contains(document.activeElement) ? (document.activeElement as HTMLElement) : null
    job = sliced(build(fx, fy), { sync: ctx.reduced || built })
    if (built) had?.focus({ preventScroll: true })
    built = true
  }

  function* build(fx: number, fy: number) {
    const u = (n: number) => n * k
    R.clearBills()
    R.cam.replaceChildren()
    deskFaces = []
    // the horizon where the far floor melts: the backdrop's hills stand on it
    const rp = (pitch0 * Math.PI) / 180
    const zf = -2300
    const hz = fy + (k * zf * Math.sin(rp) * CAM) / (CAM - zf * Math.cos(rp))
    drawBack(fx, hz)
    drawFg()
    yield
    // ground: raked sand round a moss bed, the stepping stones to the store, the lantern's pool, the desk's shadow
    const FW = 3400, Z0 = 560, Z1 = -2500
    const floor = plane('t29d-floor', 0, 0, u((Z0 + Z1) / 2), u(FW), u(Z0 - Z1))
    floor.append(floorArt(FW, Z0, Z1))
    R.cam.append(floor)
    yield
    // the desk's cast shadow on the moss: the lantern above drops it straight down, the moon at back-left pushes it to
    // front-right; a soft-edged slab that widens with the desk. The lantern's warm pool spreads round it.
    const shT = (wd: number) => planeT(u(26), -0.6, u(34), u(wmax + 60), u(DD + 70), ` scaleX(${((wd + 60) / (wmax + 60)).toFixed(3)})`)
    const shadow = h('div', { class: 't29-face t29d-shadow', style: `width:${f1(u(wmax + 60))}px;height:${f1(u(DD + 70))}px` })
    R.cam.append(plane('t29d-pool', u(LAMP.x + 20), -0.5, u(LAMP.z + 90), u(1000), u(760)), shadow)
    deskFaces.push({ el: shadow, t: shT })
    // the store at the end of the stones, in the mist; mist banks between
    const [kAt, kCard] = billboard('t29d-kura', u(KURA.x), 0, u(KURA.z), u(380), u(300),
      s('svg', { viewBox: `${f1(-u(190))} ${f1(-u(300))} ${f1(u(380))} ${f1(u(300))}`, 'aria-hidden': 'true' }, ...kura(u(380), u(300), 2931), mist(0, -u(14), u(320), u(110))))
    R.bill(kCard)
    const mists = [[-300, -1150, 2600, 420], [-520, -1600, 1500, 420], [380, -1700, 3200, 760], [-1300, -2250, 2200, 520]].map(([x, z, w, hh]) => {
      const [a, c] = billboard('t29d-mist', u(x), u(hh * 0.3), u(z), u(w), u(hh))
      R.bill(c)
      return a
    })
    R.cam.append(kAt, ...mists)
    yield
    // the desk: lacquer top, apron, the right end, two plank feet; all scaled along x with the width
    const face = (cls: string, t: (wd: number) => string) => {
      const el = h('div', { class: `t29-face ${cls}` })
      deskFaces.push({ el, t })
      R.cam.append(el)
      return el
    }
    const topW = u(wmax), top = face('t29d-top', (wd) => planeT(0, u(-HD), 0, topW, u(DD), ` scaleX(${(wd / wmax).toFixed(4)})`))
    Object.assign(top.style, { width: `${f1(topW)}px`, height: `${f1(u(DD))}px` })
    // the lantern's warm pool on the lacquer (under the lamp's foot), then the moon's cold sheen at the far-left
    top.append(h('div', { class: 't29d-top-glow', style: `left:${f1(u(wmax / 2 + LAMP.x + 6))}px;top:${f1(u(DD / 2 + LAMP.z + 30))}px;width:${f1(u(620))}px;height:${f1(u(330))}px` }), h('div', { class: 't29d-top-sheen' }))
    const front = face('t29d-front', (wd) => standT(0, u(-HD + TA), u(DD / 2), topW, u(TA), ` scaleX(${(wd / wmax).toFixed(4)})`))
    Object.assign(front.style, { width: `${f1(topW)}px`, height: `${f1(u(TA))}px` })
    const end = face('t29d-end', (wd) => standT(u(wd / 2), u(-HD + TA), 0, u(DD), u(TA), ' rotateY(90deg)'))
    Object.assign(end.style, { width: `${f1(u(DD))}px`, height: `${f1(u(TA))}px` })
    for (const side of [-1, 1]) {
      const lx = (wd: number) => side * (wd / 2 - 40)
      const legH = HD - TA
      const fr = face('t29d-leg', (wd) => standT(u(lx(wd)), 0, u(DD / 2 - 22), u(16), u(legH)))
      Object.assign(fr.style, { width: `${f1(u(16))}px`, height: `${f1(u(legH))}px` })
      const sd = face(side > 0 ? 't29d-leg t29d-leg-side' : 't29d-leg t29d-leg-in', (wd) => standT(u(lx(wd) + 8), 0, 0, u(DD - 44), u(legH), ' rotateY(90deg)'))
      Object.assign(sd.style, { width: `${f1(u(DD - 44))}px`, height: `${f1(u(legH))}px` })
      const foot = face('t29d-foot', (wd) => planeT(u(lx(wd)), -1, 0, u(30), u(DD - 20)))
      Object.assign(foot.style, { width: `${f1(u(30))}px`, height: `${f1(u(DD - 20))}px` })
    }
    yield
    // the inkstone: a black slab with a faint engraved grid that catches the moon, a sunken well of ink at its back
    const ink = h('div', { class: 't29-group', style: `transform:${at3(u(INK.x), u(-HD), u(INK.z))}` },
      planeEl('t29d-ink-top', 0, u(-INK.t), 0, u(INK.w), u(INK.d), inkTop(u(INK.w), u(INK.d))),
      standEl('t29d-ink-front', 0, 0, u(INK.d / 2), u(INK.w), u(INK.t)),
      standEl('t29d-ink-side', u(INK.w / 2), 0, 0, u(INK.d), u(INK.t), ' rotateY(90deg)'))
    R.cam.append(ink)
    // scrolls (the first is the one being written)
    scrolls = KINDS.map((kind, i) => {
      const el = h('div', { class: `t29-face t29d-scroll t29d-${kind}`, style: `width:${f1(u(SCR.w))}px;height:${f1(u(SCR.d))}px` }, paperArt(kind, u(SCR.w), u(SCR.d), 2940 + i))
      R.cam.append(el)
      return el
    })
    yield
    // the HBM tower: ten celadon plates on a little stand, silver threads through them, the hit card and its paper tag
    const tw = h('div', { class: 't29-group t29d-tower', style: `transform:${at3(u(TOWER.x), u(-HD), u(TOWER.z))}` })
    tw.append(planeEl('t29d-stand-top', 0, u(-TOWER.base + 2), 0, u(TOWER.r * 2.3), u(TOWER.r * 2.3)), standEl('t29d-stand-front', 0, 0, u(TOWER.r * 1.0), u(TOWER.r * 2.1), u(TOWER.base - 2)))
    plates = Array.from({ length: PLATES }, (_, i) => {
      const p = h('div', { class: 't29-group t29d-plate', style: `--i:${i}` },
        planeEl('t29d-plate-under', 0, u(2.6), 0, u(TOWER.r * 1.86), u(TOWER.r * 1.86)),
        planeEl('t29d-plate-top', 0, 0, 0, u(TOWER.r * 2), u(TOWER.r * 2)))
      tw.append(p)
      return p
    })
    const span = (TOWER.base + (PLATES - 1) * TOWER.open + 8) * k
    threads = [[-0.45, 0.3], [0.5, 0.25], [0.05, -0.55]].map(([dx, dz]) => {
      const line = h('div', { class: 't29d-thread-line', style: `height:${f1(span)}px` })
      const [a, c] = billboard('t29d-thread', u(TOWER.r * dx), u(-2), u(TOWER.r * dz), 2, span, line)
      R.bill(c)
      tw.append(a)
      return line
    })
    const seal = h('div', { class: 't29-face t29d-seal', style: `width:${f1(u(12))}px;height:${f1(u(10))}px;transform:${standT(u(TOWER.r * 0.55), u(-0.5), u(TOWER.r * 1.0) + 0.6, u(12), u(8))}` })
    tw.append(seal)
    const [hitAt, hc] = billboard('t29d-hitcard', 0, 0, 0, u(TOWER.r * 2.6), u(90), tower)
    hitCard = hc
    R.bill(hc)
    const tagCard = h('div', { class: 't29d-tag' },
      s('svg', { class: 't29d-tag-string', viewBox: '-60 -2 62 28', 'aria-hidden': 'true' }, s('path', { d: 'M0 0Q-26 4 -52 24' })),
      h('div', { class: 't29d-tag-paper' }, tag))
    const [ta, tc] = billboard('t29d-tagcard', 0, 0, 0, 1, 1, tagCard)
    tagAt = ta
    R.bill(tc)
    tw.append(hitAt, ta)
    placeTower()
    yield
    // the scribe kneeling behind the inkstone; his brush arm (it moves); the lantern on its bamboo rod
    const sw = u(260), sh = u(250), fig = u(188)
    const sc = scribe(-u(34), 0, fig, 2911)
    const hand: Pt = [-u(34) + fig * 0.5, -u(HD) - u(2)]
    const scribeSvg = s('svg', { viewBox: `${f1(-sw / 2)} ${f1(-sh)} ${f1(sw)} ${f1(sh)}`, 'aria-hidden': 'true' },
      ...sc.parts,
      s('g', { class: 't29d-arm', style: `transform-origin:${f1(sc.elbow[0])}px ${f1(sc.elbow[1])}px` }, ...arm(sc.elbow, hand, fig)))
    const [scA, scC] = billboard('t29d-scribe', u(34), 0, u(-128), sw, sh, scribeSvg)
    R.bill(scC)
    R.cam.append(scA)
    // the rod: planted beyond the desk's left end, bowing over the desk; the lantern hangs from its tip
    const baseX = -(wmax / 2 + 70)
    const tip: Pt = [LAMP.x, LAMP.y]
    const rodPts = curve([baseX, 0], [baseX + 30, LAMP.y * 1.05], tip, 24)
    const rx0 = baseX - 30, rw = LAMP.x + 30 - rx0
    const rod = stand('t29d-rod', u(rx0 + rw / 2), 0, u(LAMP.z), u(rw), u(-LAMP.y + 30))
    rod.append(s('svg', { viewBox: `${f1(u(rx0))} ${f1(u(LAMP.y - 30))} ${f1(u(rw))} ${f1(u(-LAMP.y + 30))}`, 'aria-hidden': 'true' }, ...bamboo(rodPts.map(([x, y]) => [u(x), u(y)] as Pt), Math.max(2.2, u(5)))))
    const lr = Math.max(9, u(22))
    const [lA, lC] = billboard('t29d-lantern', u(LAMP.x), u(LAMP.y), u(LAMP.z), lr * 7, lr * 7,
      s('svg', { viewBox: `${f1(-lr * 3.5)} ${f1(-lr * 0.2)} ${f1(lr * 7)} ${f1(lr * 7)}`, 'aria-hidden': 'true' }, paperLantern(0, 0, lr, 2905, lr * 1.2)))
    lC.style.top = '0px'
    R.bill(lC)
    // the message strip hangs from the rod, left of the lantern
    // the message strip: hung from the rod (wide), or a tanzaku on a stake in the moss before the desk (tall)
    const mp: Pt = wide ? rodPts[17] : [-wmin / 2 - 10, -96]
    const [mA, mC] = billboard(`t29d-strip${wide ? '' : ' t29d-stake'}`, u(mp[0]), u(mp[1]), u(wide ? LAMP.z : DD / 2 + 150), wide ? 190 : 156, 10, h('div', { class: 't29d-strip-paper' }, msg))
    mC.style.top = '0px'
    mC.style.height = 'auto'
    R.bill(mC)
    R.cam.append(rod, lA, mA)
    yield
    // the runner on the stones (high quality only; CSS walks him there and back while the desk is narrow)
    const path = stonePath()
    const rh = u(44)
    const [rA, rC] = billboard('t29d-runner', 0, 0, 0, rh, rh * 1.1, s('svg', { viewBox: `${f1(-rh / 2)} ${f1(-rh * 1.1)} ${f1(rh)} ${f1(rh * 1.1)}`, 'aria-hidden': 'true' }, runner(rh)))
    const way = [path[0], path[3], path[6], path[path.length - 1]]
    way.forEach(([x, z], i) => rA.style.setProperty(`--p${i}`, at3(u(x), 0, u(z))))
    rA.classList.add('t29d-run')
    R.bill(rC)
    R.cam.append(rA)
    // the controls, in reading order: the board, the tower (above), the slip
    const [bA, bC] = billboard('t29d-boardcard', 0, 0, 0, wide ? 152 : 112, wide ? 46 : 42, board)
    boardAt = bA
    R.bill(bC)
    const [slA, slC] = billboard('t29d-slipcard', 0, 0, 0, Math.max(96, u(110)), Math.max(40, u(46)), slip)
    slipAt = slA
    R.bill(slC)
    R.cam.append(bA, tw, slA) // reading order: the board, the tower, the slip
    setDesk(true)
  }

  ctx.onCleanup(onSize(ctx.art, layout))
  const gd = guide(ctx)
  const prompts = gd.steps(G.prompts)
  prompts(0)
  const boardDot = gd.dot(board, { dir: [1, 0] })
  let towerDot: ReturnType<typeof gd.dot> | null = null

  // ── paintings
  function drawBack(fx: number, hz: number) {
    const span = W + 2 * Pd * Math.tan((34 * Math.PI) / 180)
    const x0 = (W - span) / 2
    Object.assign(backWrap.style, { width: `${f1(span)}px`, height: `${f1(H)}px`, left: `${f1(x0)}px` })
    back.setAttribute('viewBox', `0 0 ${f1(span)} ${f1(H)}`)
    const mr = Math.min(W, H) * (wide ? 0.04 : 0.055)
    const mx = fx - x0 - W * (wide ? 0.28 : 0.22), my = Math.max(H * 0.07 + mr, Math.min(hz - H * 0.1, H * 0.16))
    back.replaceChildren(
      moon(mx, my, mr, 29, false),
      // a cloud bank across the moon's lower edge (garden 10: the moon half hidden)
      s('path', { class: 't29d-cloud', d: blob(mx + mr * 1.6, my + mr * 0.85, mr * 3.2, mr * 0.42, 2932, 0.2, 18) + blob(mx - mr * 2.4, my + mr * 1.3, mr * 2.4, mr * 0.3, 2933, 0.2, 14) }),
      mist(span / 2, hz - H * 0.06, span * 0.6, H * 0.16),
      hills(0, span, hz + H * 0.02, H * 0.2, 2934, 0.92, 7),
      hills(span * 0.08, span * 0.62, hz + H * 0.03, H * 0.12, 2935, 0.7, 3),
      hills(span * 0.55, span, hz + H * 0.03, H * 0.09, 2936, 0.75, 2),
      mist(span / 2, hz + H * 0.03, span * 0.7, H * 0.07),
    )
  }
  function drawFg() {
    fg.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`)
    const g = Math.max(26, H * 0.09)
    fg.replaceChildren(
      s('path', { class: 't29d-fg-rock', d: blob(-W * 0.02, H * 1.02, W * (wide ? 0.12 : 0.22), H * 0.07, 2937, 0.12, 16) }),
      grass(W * (wide ? 0.06 : 0.1), H, g * 1.6, 2938),
      grass(W * (wide ? 0.95 : 0.92), H, g * 1.3, 2939),
      grass(W * 0.99, H, g, 2940),
    )
  }
  // the stepping stones from the desk's left front into the mist, up to the store's door
  function stonePath(): Pt[] {
    return curve([-wmax / 2 + 60, DD / 2 + 70], [-wmax / 2 - 260, -360], [KURA.x + 30, KURA.z + 110], 11)
  }
  function floorArt(FW: number, Z0: number, Z1: number): SVGElement {
    const u = (n: number) => n * k
    const FD = Z0 - Z1
    const X = (x: number) => u(x + FW / 2), Z = (z: number) => u(z - Z1)
    const r = rng(2950)
    // raked sand: rings round the moss bed that loosen outward and break into dry gaps (no straight rows: on a phone they
    // read as scan lines), then plain sand with a fine grain that thins into the distance
    const ex = wmax / 2 + 130, ez = DD / 2 + 120
    let rings = ''
    for (let i = 0; i < 7; i++) {
      const rx = ex + 26 + i * (30 + i * 4), rz = ez + 26 + i * (30 + i * 4)
      let a = r() * 30
      while (a < 360) {
        const len = 40 + r() * 80 - i * 4
        const pts: Pt[] = []
        for (let b = a; b <= a + len; b += 6) pts.push([X(Math.cos((b * Math.PI) / 180) * rx * (1 + Math.sin(b * 0.05 + i) * 0.012)), Z(20 + Math.sin((b * Math.PI) / 180) * rz)])
        if (pts.length > 1) rings += `M${pts.map(P).join('L')}`
        a += len + 6 + r() * (10 + i * 6)
      }
    }
    let grain = ''
    for (let i = 0; i < 700; i++) {
      const x = (r() - 0.5) * FW * 0.8, z = Z0 - Math.pow(r(), 1.6) * (Z0 + 1300)
      grain += `M${f1(X(x))} ${f1(Z(z))}h${f1(u(1.6 + r() * 2.4))}`
    }
    // moss: a soft bed with darker clumps and pale tips
    let clumps = ''
    for (let i = 0; i < 90; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.9
      clumps += blob(X(Math.cos(a) * ex * d), Z(20 + Math.sin(a) * ez * d), u(5 + r() * 12), u(3 + r() * 6), 2952 + i, 0.35, 9)
    }
    let tips = ''
    for (let i = 0; i < 260; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.98
      tips += `M${f1(X(Math.cos(a) * ex * d))} ${f1(Z(20 + Math.sin(a) * ez * d))}h${f1(u(2 + r() * 3))}`
    }
    // stepping stones: side, face, the moon's rim on their far-left edge
    const stones: SVGElement[] = []
    stonePath().forEach(([x, z], i) => {
      const rx = 46 + r() * 12, rz = 34 + r() * 8
      stones.push(
        s('path', { class: 't29d-st-sh', d: blob(X(x + 14), Z(z + 12), u(rx * 1.1), u(rz * 1.05), 2960 + i, 0.12, 14) }),
        s('path', { class: 't29d-st-side', d: blob(X(x), Z(z + 7), u(rx), u(rz), 2960 + i, 0.1, 14) }),
        s('path', { class: 't29d-st-face', d: blob(X(x), Z(z), u(rx), u(rz), 2960 + i, 0.1, 14) }),
        s('path', { class: 't29d-st-rim', d: stroke(curve([X(x - rx * 0.8), Z(z - rz * 0.2)], [X(x - rx * 0.5), Z(z - rz * 0.95)], [X(x + rx * 0.4), Z(z - rz * 0.85)], 8), u(4), 0.3, 0.3, 0.1) }))
    })
    const trail = stonePath().map(([x, z]) => [X(x), Z(z)] as Pt)
    return s('svg', { viewBox: `0 0 ${f1(u(FW))} ${f1(u(FD))}`, 'aria-hidden': 'true' },
      s('path', { class: 't29d-grain', d: grain }),
      s('path', { class: 't29d-ring', d: rings }),
      ...[1.08, 1, 0.9, 0.78].map((q, i) => s('path', { class: `t29d-moss t29d-moss-${i}`, d: blob(X(0), Z(20), u(ex * q), u(ez * q), 2953 + i, 0.07, 36) })),
      s('path', { class: 't29d-moss-dark', d: clumps }),
      s('path', { class: 't29d-moss-tip', d: tips }),
      ...stones,
      s('path', { class: 't29d-trail', d: `M${trail.map(P).join('L')}` }))
  }
}

// ── small builders
const planeT = (x: number, y: number, z: number, w: number, d: number, extra = '') => `translate3d(${f1(x - w / 2)}px,${f1(y - d / 2)}px,${f1(z)}px) rotateX(90deg)${extra}`
const standT = (x: number, y: number, z: number, w: number, hh: number, extra = '') => `translate3d(${f1(x - w / 2)}px,${f1(y - hh)}px,${f1(z)}px)${extra}`
function planeEl(cls: string, x: number, y: number, z: number, w: number, d: number, ...kids: Node[]) {
  return h('div', { class: `t29-face ${cls}`, style: `width:${f1(w)}px;height:${f1(d)}px;transform:${planeT(x, y, z, w, d)}` }, ...kids)
}
function standEl(cls: string, x: number, y: number, z: number, w: number, hh: number, extra = '') {
  return h('div', { class: `t29-face t29-stand ${cls}`, style: `width:${f1(w)}px;height:${f1(hh)}px;transform:${standT(x, y, z, w, hh, extra)}` })
}

/** The inkstone's top in top view: the grinding face with an engraved die grid, the ink well at the back. */
function inkTop(w: number, d: number): SVGElement {
  let grid = ''
  const gx0 = w * 0.16, gx1 = w * 0.84, gz0 = d * 0.36, gz1 = d * 0.88
  for (let i = 0; i <= 6; i++) {
    const x = gx0 + ((gx1 - gx0) * i) / 6, z = gz0 + ((gz1 - gz0) * i) / 6
    grid += `M${f1(x)} ${f1(gz0)}V${f1(gz1)}M${f1(gx0)} ${f1(z)}H${f1(gx1)}`
  }
  return s('svg', { viewBox: `0 0 ${f1(w)} ${f1(d)}`, 'aria-hidden': 'true' },
    s('path', { class: 't29d-ink-well', d: blob(w / 2, d * 0.17, w * 0.34, d * 0.11, 2945, 0.08, 14) }),
    s('path', { class: 't29d-ink-shine', d: stroke([[w * 0.28, d * 0.15], [w * 0.5, d * 0.12], [w * 0.66, d * 0.15]], Math.max(1, d * 0.03), 0.3, 0.3, 0.1) }),
    s('path', { class: 't29d-ink-grid', d: grid }),
    s('rect', { class: 't29d-ink-core', x: f1(w * 0.36), y: f1(d * 0.5), width: f1(w * 0.28), height: f1(d * 0.24) }))
}

/** Columns of brush writing inside (x0, z0)–(x1, z1), top view; `upto` 0…1 = how far down the last columns get (half-written). */
function writing(x0: number, z0: number, x1: number, z1: number, w: number, r: () => number, upto = 1): string {
  let d = ''
  const cols = Math.max(3, Math.round((x1 - x0) / 8.5))
  for (let c = 0; c < cols; c++) {
    const x = x1 - ((x1 - x0) * (c + 0.5)) / cols // right to left, as a scribe writes
    const stop = c < cols * upto ? z0 + (z1 - z0) * (0.55 + r() * 0.45) : z0 + (z1 - z0) * (c < cols * upto + 1 ? r() * 0.5 : 0)
    let z = z0
    while (z < stop) {
      const len = (z1 - z0) * (0.04 + r() * 0.07)
      d += stroke([[x, z], [x + 0.3, Math.min(stop, z + len)]], Math.max(0.8, w * 0.016), 0.2, 0.3, 0.3)
      z += len + (z1 - z0) * 0.03
    }
  }
  return d
}

/** One paper on the desk in top view (w × d box): a sheet half written, an open handscroll on its rollers, a stack of
 *  sheets, a closed roll (two, tied), or two sheets overlapping. Paper is warmed by the lantern through --warm (CSS). */
function paperArt(kind: string, w: number, d: number, seed: number): SVGElement {
  const r = rng(seed)
  const sheet = (x: number, y: number, sw: number, sd: number, rot: number, upto: number, cls = 't29d-paper') =>
    s('g', { transform: `rotate(${rot} ${f1(x + sw / 2)} ${f1(y + sd / 2)})` },
      s('rect', { class: 't29d-sheet-sh', x: f1(x + sw * 0.03), y: f1(y + sd * 0.04), width: f1(sw), height: f1(sd) }),
      s('rect', { class: cls, x: f1(x), y: f1(y), width: f1(sw), height: f1(sd) }),
      upto > 0 ? s('path', { class: 't29d-writing', d: writing(x + sw * 0.1, y + sd * 0.1, x + sw * 0.9, y + sd * 0.9, sw, r, upto) }) : null)
  const roll = (cx: number, cy: number, len: number, th: number, rot: number) =>
    s('g', { transform: `rotate(${rot} ${f1(cx)} ${f1(cy)})` },
      s('rect', { class: 't29d-sheet-sh', x: f1(cx - len / 2 + th * 0.2), y: f1(cy - th / 2 + th * 0.35), width: f1(len), height: f1(th), rx: f1(th / 2) }),
      s('rect', { class: 't29d-paper', x: f1(cx - len / 2), y: f1(cy - th / 2), width: f1(len), height: f1(th), rx: f1(th / 2) }),
      s('rect', { class: 't29d-roll-shade', x: f1(cx - len / 2), y: f1(cy - th / 2), width: f1(len), height: f1(th), rx: f1(th / 2), fill: 'url(#t29-roll)' }),
      s('ellipse', { class: 't29d-roll-end', cx: f1(cx + len / 2 - th * 0.3), cy: f1(cy), rx: f1(th * 0.3), ry: f1(th * 0.48) }),
      s('path', { class: 't29d-roll-cord', d: stroke([[cx - len * 0.12, cy - th * 0.55], [cx - len * 0.1, cy + th * 0.6]], Math.max(1, th * 0.12), 0.1, 0.1, 0.5) }))
  const kids: (SVGElement | null)[] = []
  if (kind === 'scroll') {
    kids.push(sheet(w * 0.06, d * 0.08, w * 0.88, d * 0.84, 0, 1),
      s('rect', { class: 't29d-roller', x: 0, y: f1(d * 0.04), width: f1(w * 0.08), height: f1(d * 0.92), rx: f1(w * 0.035) }),
      s('rect', { class: 't29d-roller', x: f1(w * 0.92), y: f1(d * 0.04), width: f1(w * 0.08), height: f1(d * 0.92), rx: f1(w * 0.035) }))
  } else if (kind === 'stack') {
    for (let i = 0; i < 3; i++) kids.push(sheet(w * (0.12 + i * 0.02), d * (0.1 + i * 0.015), w * 0.72, d * 0.78, (r() - 0.5) * 9, i === 2 ? 1 : 0))
  } else if (kind === 'roll') {
    kids.push(roll(w * 0.5, d * 0.42, w * 0.86, d * 0.2, -14 + r() * 8), roll(w * 0.46, d * 0.68, w * 0.74, d * 0.18, -6 + r() * 6))
  } else if (kind === 'pair') {
    kids.push(sheet(w * 0.02, d * 0.12, w * 0.6, d * 0.7, -11, 1), sheet(w * 0.36, d * 0.2, w * 0.6, d * 0.72, 7, 0.6))
  } else {
    // a single sheet; the one being written is only half filled (the columns stop where the brush is)
    kids.push(sheet(w * 0.1, d * 0.06, w * 0.8, d * 0.88, 0, kind === 'half' ? 0.45 : 1))
  }
  return s('svg', { viewBox: `0 0 ${f1(w)} ${f1(d)}`, 'aria-hidden': 'true' }, ...kids)
}

/** A bamboo rod along pts: the cane in one tapering stroke, nodes, a moonlit edge, a few leaves at the base. */
function bamboo(pts: Pt[], wd: number): SVGElement[] {
  let nodes = ''
  for (let i = 3; i < pts.length - 2; i += 3) {
    const [x, y] = pts[i]
    const [a, b] = pts[i + 1]
    const l = Math.hypot(a - x, b - y) || 1
    const nx = -(b - y) / l, ny = (a - x) / l
    nodes += stroke([[x - nx * wd * 0.8, y - ny * wd * 0.8], [x + nx * wd * 0.8, y + ny * wd * 0.8]], wd * 0.45, 0.1, 0.1, 0.5)
  }
  const [bx, by] = pts[0]
  let leaves = ''
  for (let i = 0; i < 4; i++) leaves += stroke(curve([bx, by - wd * 3], [bx + (i - 1.5) * wd * 6, by - wd * (8 + i * 2)], [bx + (i - 1.5) * wd * 10, by - wd * (4 + i * 3)], 8), wd * 1.6, 0.05, 0.6, 0.1)
  return [
    s('path', { class: 't29d-cane', d: stroke(pts, wd, 0.02, 0.1, 0.45), filter: 'url(#ink-rough)' }),
    s('path', { class: 't29d-cane-rim', d: stroke(pts.slice(1, -2).map(([x, y]) => [x - wd * 0.25, y - wd * 0.15] as Pt), wd * 0.3, 0.2, 0.2, 0.2) }),
    s('path', { class: 't29d-node', d: nodes }),
    s('path', { class: 't29d-leaf', d: leaves }),
  ]
}
