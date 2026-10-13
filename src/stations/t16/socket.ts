import { fill, h, nextId, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { appIcon, boulder, clamp, cordD, f1, fitRings, glowDefs, hit, horizon, lantern, litDefs, placed, plugShape, portStone, sand, textW, type Box, type Lantern, type Pt, type Ring } from './art'
import { C } from './data'

const T = C.scenes.socket
const N = T.apps.length
// pebbles fan out from the socket: [angle°, reach 0–1, size] per app (drive, gmail, slack, figma, db, blender).
// Far and near stones alternate, so the far cords pass between the near ones.
const WIDE: [number, number, number][] = [[214, 0.98, 1], [246, 0.96, 1], [262, 0.5, 0.92], [182, 0.95, 1], [196, 0.52, 1.02], [228, 0.58, 0.9]]
// tall screens: a horseshoe around the socket, open at the top where the lantern stands
const TALL: [number, number, number][] = [[-22, 0.98, 0.9], [24, 0.9, 0.8], [66, 1.04, 0.94], [114, 0.94, 1.04], [160, 1.02, 0.84], [206, 0.92, 0.92]]
const NAME = 15
const ABIL = 13.6

interface Plug {
  /** the pebble's rim facing the port: where the cord leaves the stone */
  a: Pt
  rest: Pt
  ang: number
  /** sideways bow of the cord once seated, chosen so it passes no other stone and no word */
  bend: number
  head: SVGGElement
  cord: SVGPathElement
  pos: Pt
  mode: 'rest' | 'drag' | 'fly' | 'in'
  sc: number
  tw?: ReturnType<typeof gsap.to>
}

/** Scene 1 — one universal socket at the foot of the AI's lantern; every app plugs into the same shape. */
export function socketScene(ctx: SceneCtx) {
  const sandSvg = s('svg', { class: 't16-svg t16-sandsvg', 'aria-hidden': 'true' })
  const svg = s('svg', { class: 't16-svg', 'aria-hidden': 'true' })
  const labs = h('div', { class: 't16k-labs', 'aria-hidden': 'true' })
  const status = h('p', { class: 'visually-hidden', 'aria-live': 'polite' })
  const names = T.apps.map((a) => h('span', { class: 't16k-lab' }, h('span', { class: 't16k-name' }, a.name), h('span', { class: 't16k-ab' }, a.ability)))
  const btns = T.apps.map((a, i) =>
    h('button', { class: 't16k-hit', type: 'button', 'aria-pressed': 'false', 'aria-label': fill(T.plug, { name: a.name }), onClick: () => onClick(i) }))
  const gain = h('span', { class: 't16k-gain' })
  const portLab = h('span', { class: 't16k-port' }, h('span', { class: 't16k-portname' }, T.port), h('span', { class: 't16k-portsub' }, T.portSub))
  const aiLab = h('span', { class: 't16k-ai' }, T.agent)
  labs.append(...names, portLab, aiLab, gain)
  const group = h('div', { class: 't16k-hits', role: 'group', 'aria-label': T.group }, ...btns)
  const root = h('div', { class: 't16 t16k' }, sandSvg, svg, labs, group, status)
  ctx.art.append(root)
  ctx.prompt(T.prompt)

  const on = new Array<boolean>(N).fill(false)
  const gid = nextId('t16k')
  let plugs: Plug[] = []
  const pebbles: SVGGElement[] = []
  let port: Pt = [0, 0]
  let portW = 60
  let halo: SVGCircleElement | null = null
  let pool: SVGEllipseElement | null = null
  let mouth: SVGEllipseElement | null = null
  let flash: SVGEllipseElement | null = null
  let lamp: Lantern | null = null
  let cordsG: SVGGElement | null = null
  let k = 1
  let sIn = 1
  let told = false
  let dragged = false
  const bright = { b: 0 }
  let flicker: ReturnType<typeof gsap.to> | null = null

  /** Each app has its own place in the socket's mouth, so the seated plugs fan out side by side. */
  const slot = (i: number): Pt => [port[0] + (i - (N - 1) / 2) * portW * 0.055, port[1]]

  function drawCord(i: number) {
    const p = plugs[i]
    if (!p) return
    if (p.mode === 'in') {
      const end = slot(i)
      const d = cordD(p.a, end, 0.05, p.bend)
      p.cord.setAttribute('d', d)
      // the seated plug points along the cord's last stretch, its tip in the mouth
      const m = d.match(/C[\d.-]+ [\d.-]+ ([\d.-]+) ([\d.-]+)/)
      const c2: Pt = m ? [Number(m[1]), Number(m[2])] : p.a
      const ang = Math.atan2(end[1] - c2[1], end[0] - c2[0])
      const at: Pt = [end[0] - Math.cos(ang) * 9 * sIn, end[1] - Math.sin(ang) * 9 * sIn]
      p.head.setAttribute('transform', `translate(${f1(at[0])} ${f1(at[1])}) rotate(${f1((ang * 180) / Math.PI)}) scale(${sIn.toFixed(3)})`)
      return
    }
    const loose = p.mode === 'rest'
    const ang = loose ? p.ang : Math.atan2(port[1] - p.pos[1], port[0] - p.pos[0])
    const end: Pt = [p.pos[0] - Math.cos(ang) * 12 * p.sc, p.pos[1] - Math.sin(ang) * 12 * p.sc]
    p.cord.setAttribute('d', cordD(p.a, end, loose ? 0.55 : 0.05, loose ? 0.12 : 0))
    p.head.setAttribute('transform', `translate(${f1(p.pos[0])} ${f1(p.pos[1])}) rotate(${f1((ang * 180) / Math.PI)}) scale(${p.sc.toFixed(3)})`)
  }

  function applyBright() {
    const b = bright.b
    lamp?.lit.setAttribute('opacity', b > 0.01 ? String(0.35 + 0.65 * b) : '0')
    if (halo) {
      halo.setAttribute('opacity', b.toFixed(3))
      halo.setAttribute('r', String(f1(Number(halo.dataset.r) * (0.55 + 0.6 * b))))
    }
    pool?.setAttribute('opacity', (b * 0.9).toFixed(3))
    mouth?.setAttribute('opacity', Math.min(1, b * 1.6).toFixed(3))
  }

  function layout() {
    const W = root.clientWidth
    const H = root.clientHeight
    if (!W || !H) return
    const wide = W / H > 1.15
    const short = H < 330
    const compact = short || W < 560
    root.classList.toggle('compact', compact)
    root.classList.toggle('tall', !wide)
    plugs.forEach((p) => p.tw?.kill())
    svg.replaceChildren()
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`)

    // the lantern and its socket
    const L = wide ? Math.min(H * 0.8, W * 0.34) : Math.min(H * 0.42, W * 0.5)
    k = L / 232
    const lx = wide ? W * 0.78 : W * 0.5
    const ly = wide ? H * 0.86 : H * 0.47
    portW = clamp(L * 0.3, 46, 96)
    sIn = clamp(portW / 105, 0.5, 0.82)
    port = wide ? [W * 0.6, H * (short ? 0.62 : 0.76)] : [W * 0.5, H * 0.585]
    const hy = wide ? H * (short ? 0.16 : 0.2) : H * 0.2
    const r0 = wide ? Math.min(W * 0.046, H * 0.088) : Math.min(W * 0.088, H * 0.058)
    // reach of the fan: to the left edge and up to the horizon (wide); down to the foot, both sides (tall)
    const reach = wide
      ? { l: port[0] - W * 0.08, r: 0, u: port[1] - hy - H * 0.08, d: 0 }
      : { l: W * 0.37, r: W * 0.37, u: H * 0.2, d: H * 0.25 }
    // nearer the viewer = lower on the screen = bigger (wide); tall screens are seen from above, sizes stay
    const depth = (y: number) => (wide ? 0.74 + 0.42 * clamp((y - hy) / (H - hy), 0, 1) : 1)
    const P = (wide ? WIDE : TALL).map(([a, f, sz]) => {
      const c = Math.cos((a * Math.PI) / 180)
      const sn = Math.sin((a * Math.PI) / 180)
      const x = port[0] + c * (c < 0 ? reach.l : reach.r) * f
      const y = port[1] + sn * (sn < 0 ? reach.u : reach.d) * f
      return { x, y, r: r0 * sz * depth(y) }
    })

    // far hills, mist, raked sand with rings around every stone
    const rings: Ring[] = fitRings([
      { x: lx, y: ly + 2, r: 56 * k, n: wide ? 5 : 3 },
      { x: port[0], y: port[1] + portW * 0.2, r: portW * 0.6, n: 3 },
      ...P.map((q) => ({ x: q.x + q.r * 0.1, y: q.y + q.r * 0.42, r: q.r * 1.25, n: wide && !short ? 3 : 2 })),
    ], 7)
    svg.append(s('defs', null, glowDefs(`${gid}-g`), litDefs()))
    sandSvg.replaceChildren(horizon(`${gid}-h`, W, H, hy), sand(`${gid}-s`, W, H, hy + H * 0.02, rings, 7))
    sandSvg.setAttribute('viewBox', `0 0 ${W} ${H}`)

    pool = s('ellipse', { class: 't16-halo', cx: f1(lx - 10 * k), cy: f1(ly + 4), rx: f1(150 * k), ry: f1(26 * k), fill: `url(#${gid}-g)`, opacity: 0 })
    halo = s('circle', { class: 't16-halo', cx: f1(lx), cy: f1(ly - 140 * k), r: f1(170 * k), fill: `url(#${gid}-g)`, opacity: 0, 'data-r': f1(170 * k) })
    cordsG = s('g', { class: 't16-cords', filter: ctx.quality === 'low' ? null : 'url(#ink-rough)' })
    svg.append(pool, halo, cordsG)

    const ps = placed(port[0], port[1], 1)
    portStone(ps, portW)
    // the socket warms as more apps share it
    mouth = s('ellipse', { class: 't16-halo', cx: f1(port[0]), cy: f1(port[1]), rx: f1(portW * 0.42), ry: f1(portW * 0.16), fill: `url(#${gid}-g)`, opacity: 0 })
    flash = s('ellipse', { class: 't16-flash', cx: f1(port[0]), cy: f1(port[1]), rx: portW * 0.24, ry: portW * 0.1, opacity: 0 })
    svg.append(ps.root, mouth, flash)

    // pebbles, far first
    const order = P.map((q, i) => [q.y, i]).sort((a, b) => a[0] - b[0]).map(([, i]) => i)
    for (const i of order) {
      const q = P[i]
      const pen = placed(q.x, q.y, 1, ctx.quality === 'low' ? 'root' : 'full')
      boulder(pen, q.r, 7 + i * 13)
      const ik = pen.sub(`translate(${f1(q.r * 0.04)} ${f1(-q.r * 0.08)}) scale(${(q.r / 34).toFixed(3)})`)
      ik.classList.add('t16k-icon')
      appIcon(pen, T.apps[i].id, 2.4)
      pen.back()
      pen.root.classList.toggle('far', wide && q.y < hy + (H - hy) * 0.35)
      pebbles[i] = pen.root
      svg.append(pen.root)
    }
    pebbles.forEach((g, i) => g.classList.toggle('on', on[i]))

    // the lantern stands behind the socket
    const lp = placed(lx, ly, k)
    lamp = lantern(lp)
    svg.append(lp.root)
    flicker?.kill()
    if (!ctx.reduced) flicker = gsap.to(lamp.flame, { scaleY: 0.82, scaleX: 1.1, svgOrigin: `0 ${f1(lamp.wy + 9)}`, duration: 0.7, ease: 'sine.inOut', repeat: -1, yoyo: true })

    // words: each name sits on the side of its stone away from the socket, so no cord ever runs through it
    const labBox: Box[] = []
    P.forEach((q, i) => {
      const el = names[i]
      el.className = 't16k-lab'
      if (compact) {
        labBox.push({ x: -99, y: -99, w: 0, h: 0 })
        return
      }
      const w = Math.max(textW(T.apps[i].name, NAME), textW(T.apps[i].ability, ABIL)) + 4
      const hh = NAME * 1.25 + ABIL * 1.25 + 2
      const ux = q.x - port[0]
      const uy = q.y - port[1]
      const ul = Math.hypot(ux, uy) || 1
      const side = Math.abs(ux / ul) > 0.6
      let b: Box
      let cls: string
      if (side) {
        const x = ux < 0 ? q.x - q.r * 1.25 - 6 - w : q.x + q.r * 1.25 + 6
        b = { x, y: q.y - hh * 0.4, w, h: hh }
        cls = ux < 0 ? 'l' : 'r'
        if (b.x < 2 || b.x + w > W - 2) {
          b = { x: q.x - w / 2, y: q.y + q.r * 0.62 + 4, w, h: hh }
          cls = 'dn'
        }
      } else if (uy < 0) {
        b = { x: q.x - w / 2, y: q.y - q.r * 0.82 - 4 - hh, w, h: hh }
        cls = 'up'
      } else {
        b = { x: q.x - w / 2, y: q.y + q.r * 0.62 + 4, w, h: hh }
        cls = 'dn'
      }
      el.classList.add(cls)
      Object.assign(el.style, { left: `${f1(cls === 'l' ? b.x + w : cls === 'r' ? b.x : q.x)}px`, top: `${f1(cls === 'up' ? b.y + hh : b.y)}px` })
      labBox.push(b)
    })

    // plugs and their cords
    const heads = s('g', { class: 't16-heads', filter: 'url(#ink-rough)' })
    svg.append(heads)
    const portBox: Box = { x: port[0] - portW * 0.6, y: port[1] - portW * 0.3, w: portW * 1.2, h: portW * 0.6 }
    plugs = P.map((q, i) => {
      const ang = Math.atan2(port[1] - q.y, port[0] - q.x)
      const a: Pt = [q.x + Math.cos(ang) * q.r * 1.02, q.y + Math.sin(ang) * q.r * 0.7]
      // the loose plug lies on the sand beside its stone, on the side facing the socket
      const sd = Math.abs(port[0] - q.x) < q.r * 0.5 ? 1 : Math.sign(port[0] - q.x)
      const rest: Pt = [q.x + sd * q.r * 1.42, q.y + q.r * 0.3]
      // choose how the seated cord bows: the least contact with other stones and words wins, then the straightest
      const avoid: Box[] = [
        ...P.filter((_, j) => j !== i).map((o) => ({ x: o.x - o.r * 1.15, y: o.y - o.r * 0.75, w: o.r * 2.3, h: o.r * 1.35 })),
        ...labBox.filter((_, j) => j !== i).map((b) => ({ x: b.x - 3, y: b.y - 3, w: b.w + 6, h: b.h + 6 })),
      ]
      const end = slot(i)
      let bend = 0
      let best = Infinity
      for (const bd of [0, 0.06, -0.06, 0.12, -0.12, 0.18, -0.18, 0.26, -0.26]) {
        // sample the cubic by hand (no DOM measuring): same control points as cordD
        const dx = end[0] - a[0]
        const dy = end[1] - a[1]
        const g = Math.hypot(dx, dy) * 0.05
        const c1: Pt = [a[0] + dx * 0.3 - dy * bd, a[1] + dy * 0.3 + g + dx * bd]
        const c2: Pt = [a[0] + dx * 0.72 - dy * bd, a[1] + dy * 0.72 + g * 0.8 + dx * bd]
        let n = 0
        for (let u = 0.04; u < 0.96; u += 0.04) {
          const v = 1 - u
          const x = v * v * v * a[0] + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u * u * u * end[0]
          const y = v * v * v * a[1] + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u * u * u * end[1]
          const pb = { x: x - 1.5, y: y - 1.5, w: 3, h: 3 }
          if (avoid.some((o) => hit(pb, o)) || (u < 0.8 && hit(pb, portBox)) || x < 0 || x > W || y < 0 || y > H) n++
        }
        // a gentle bow is worth one small touch less than a wild one
        const score = n + Math.abs(bd) * 6
        if (score < best) {
          best = score
          bend = bd
        }
        if (n === 0) break
      }
      const cord = s('path', { class: 't16-cord' })
      cord.style.strokeWidth = `${f1(clamp(q.r * 0.07, 1.6, 3.4))}px`
      cordsG!.append(cord)
      const head = plugShape(1)
      heads.append(head)
      const pl: Plug = { a, rest, ang, bend, head, cord, sc: clamp(q.r / 24, 0.85, 2.2), pos: on[i] ? slot(i) : rest, mode: on[i] ? 'in' : 'rest' }
      return pl
    })
    plugs.forEach((_, i) => drawCord(i))
    applyBright()

    // hit areas
    P.forEach((q, i) => {
      const bw = Math.max(48, q.r * 2.6)
      const bh = Math.max(48, q.r * 2.1)
      Object.assign(btns[i].style, { left: `${q.x - bw / 2 + q.r * 0.15}px`, top: `${q.y - bh / 2 + q.r * 0.05}px`, width: `${bw}px`, height: `${bh}px` })
    })
    // tall screens: cords arrive from below too, so the socket's name is carved on its stone, and "AI" stands beside the lantern
    portLab.hidden = !wide
    // tall or short screens: "AI" stands beside the lantern, not under it
    const beside = !wide || short
    aiLab.classList.toggle('side', beside)
    if (!wide) svg.append(s('text', { class: 't16k-carve', x: f1(port[0]), y: f1(port[1] - portW * 0.17), 'font-size': f1(portW * 0.17), 'text-anchor': 'middle' }, T.port))
    Object.assign(portLab.style, { left: `${port[0]}px`, top: `${port[1] + portW * 0.3 + 6}px` })
    Object.assign(aiLab.style, beside ? { left: `${f1(lx - 62 * k - 8)}px`, top: `${f1(ly - 150 * k)}px` } : { left: `${lx}px`, top: `${ly + 8}px` })
    // small screens show no words under the pebbles; the newest ability is written beside the lantern, where no cord runs
    const gx = lx + 60 * k + 8
    root.classList.toggle('gain-under', W - gx < 96)
    if (W - gx < 96) Object.assign(gain.style, { left: `${port[0]}px`, top: `${port[1] + portW * 0.3 + 44}px`, width: '', transform: 'translateX(-50%)' })
    else Object.assign(gain.style, { left: `${f1(gx)}px`, top: `${f1(ly - 160 * k)}px`, width: `${f1(W - gx - 2)}px`, transform: '' })
  }

  function settle(i: number) {
    btns[i].setAttribute('aria-pressed', String(on[i]))
    btns[i].setAttribute('aria-label', fill(on[i] ? T.unplug : T.plug, { name: T.apps[i].name }))
    names[i].classList.toggle('on', on[i])
    pebbles[i]?.classList.toggle('on', on[i])
    const n = on.filter(Boolean).length
    ctx.anim(() => {
      if (ctx.reduced) {
        bright.b = n / N
        applyBright()
      } else gsap.to(bright, { b: n / N, duration: 1.4, ease: 'power2.out', onUpdate: applyBright })
    })
  }

  function connect(i: number) {
    const p = plugs[i]
    if (!p || on[i]) return
    on[i] = true
    p.tw?.kill()
    const from: Pt = [...p.pos]
    const to = slot(i)
    const done = () => {
      p.mode = 'in'
      p.pos = to
      drawCord(i)
      arrive(i)
    }
    if (ctx.reduced) done()
    else {
      p.mode = 'fly'
      const o = { t: 0 }
      const lift = Math.min(90, Math.hypot(to[0] - from[0], to[1] - from[1]) * 0.25)
      ctx.anim(() => {
        p.tw = gsap.to(o, {
          t: 1,
          duration: 0.75,
          ease: 'power2.inOut',
          onUpdate: () => {
            const t = o.t
            p.pos = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t - Math.sin(Math.PI * t) * lift]
            drawCord(i)
          },
          onComplete: done,
        })
      })
    }
    settle(i)
  }

  /** The plug seats: the socket flashes, a bead of light runs back up the cord, the ability is lit. */
  function arrive(i: number) {
    const p = plugs[i]
    ctx.chime('soft')
    const a = T.apps[i]
    status.textContent = fill(T.status, { name: a.name, ability: a.ability })
    gain.replaceChildren(h('span', { class: 't16k-gname' }, a.name), ' ', h('span', null, a.ability))
    if (!ctx.reduced) ctx.anim(() => gsap.fromTo(gain, { opacity: 0, y: -4 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out' }))
    if (!ctx.reduced && flash) {
      ctx.anim(() => {
        gsap.fromTo(flash, { opacity: 0.9, attr: { rx: portW * 0.22, ry: portW * 0.09 } }, { opacity: 0, attr: { rx: portW * 0.9, ry: portW * 0.32 }, duration: 1.4, ease: 'power2.out' })
        const bead = s('circle', { class: 't16-bead', r: 3.2 })
        cordsG?.parentNode?.append(bead)
        const len = p.cord.getTotalLength()
        const o = { t: 0 }
        gsap.to(o, {
          t: 1,
          duration: 1.1,
          ease: 'power1.inOut',
          onUpdate: () => {
            const pt = p.cord.getPointAtLength(len * (1 - o.t))
            bead.setAttribute('cx', f1(pt.x).toString())
            bead.setAttribute('cy', f1(pt.y).toString())
          },
          onComplete: () => bead.remove(),
        })
      })
    }
    const n = on.filter(Boolean).length
    if (n >= 3 && !told) {
      told = true
      ctx.insight(T.insight, T.detail)
    }
  }

  function unplug(i: number) {
    const p = plugs[i]
    if (!p || !on[i]) return
    on[i] = false
    p.tw?.kill()
    status.textContent = fill(T.statusOff, { name: T.apps[i].name })
    gain.replaceChildren()
    p.mode = 'fly'
    const from = slot(i)
    const to = p.rest
    if (ctx.reduced) {
      p.mode = 'rest'
      p.pos = to
      drawCord(i)
    } else {
      const o = { t: 0 }
      ctx.anim(() => {
        p.tw = gsap.to(o, {
          t: 1,
          duration: 0.9,
          ease: 'power3.out',
          onUpdate: () => {
            p.pos = [from[0] + (to[0] - from[0]) * o.t, from[1] + (to[1] - from[1]) * o.t]
            drawCord(i)
          },
          onComplete: () => {
            p.mode = 'rest'
            drawCord(i)
          },
        })
      })
    }
    settle(i)
  }

  function onClick(i: number) {
    if (dragged) {
      dragged = false
      return
    }
    if (on[i]) unplug(i)
    else connect(i)
  }

  // ── drag a plug from its stone into the socket ──
  let drag: { i: number; id: number; x0: number; y0: number; moved: boolean; left: number; top: number } | null = null
  const near = (q: Pt) => Math.hypot(q[0] - port[0], (q[1] - port[1]) * 1.3) < Math.max(52, portW * 0.85)
  btns.forEach((b, i) => {
    b.addEventListener('pointerdown', (e) => {
      if (on[i] || e.button > 0) return
      const r = root.getBoundingClientRect()
      drag = { i, id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, left: r.left, top: r.top }
      b.setPointerCapture(e.pointerId)
    })
    b.addEventListener('pointermove', (e) => {
      if (!drag || drag.i !== i || drag.id !== e.pointerId) return
      if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6) return
      const p = plugs[i]
      if (!drag.moved) {
        drag.moved = true
        p.tw?.kill()
        root.classList.add('dragging')
      }
      p.mode = 'drag'
      p.pos = [e.clientX - drag.left, e.clientY - drag.top]
      drawCord(i)
      root.classList.toggle('near', near(p.pos))
    })
    const end = (e: PointerEvent) => {
      if (!drag || drag.i !== i || drag.id !== e.pointerId) return
      const moved = drag.moved
      drag = null
      root.classList.remove('dragging', 'near')
      if (!moved) return
      dragged = true
      setTimeout(() => (dragged = false), 0)
      const p = plugs[i]
      if (near(p.pos)) connect(i)
      else {
        p.mode = 'fly'
        const from: Pt = [...p.pos]
        const o = { t: 0 }
        const back = () => {
          p.mode = 'rest'
          p.pos = p.rest
          drawCord(i)
        }
        if (ctx.reduced) back()
        else
          ctx.anim(() => {
            p.tw = gsap.to(o, {
              t: 1,
              duration: 0.9,
              ease: 'elastic.out(1, 0.6)',
              onUpdate: () => {
                p.pos = [from[0] + (p.rest[0] - from[0]) * o.t, from[1] + (p.rest[1] - from[1]) * o.t]
                drawCord(i)
              },
              onComplete: back,
            })
          })
      }
    }
    b.addEventListener('pointerup', end)
    b.addEventListener('pointercancel', end)
  })

  let rraf = 0
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(rraf)
    rraf = requestAnimationFrame(layout)
  })
  ro.observe(root)
  layout()
  document.fonts?.ready.then(() => root.isConnected && layout())
  if (!ctx.reduced) {
    // the lantern breathes in from the dusk; the pebbles settle
    ctx.anim(() => {
      gsap.from(svg.querySelectorAll('.v-art'), { opacity: 0, duration: 1.4, stagger: 0.08, ease: 'power2.out', clearProps: 'opacity' })
    })
  }
  return () => {
    ro.disconnect()
    cancelAnimationFrame(rraf)
    plugs.forEach((p) => p.tw?.kill())
    flicker?.kill()
  }
}
