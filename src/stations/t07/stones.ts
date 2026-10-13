import { h, nextId, s } from '../../core/dom'
import { gsap } from '../../core/anim'
import type { SceneCtx } from '../types'
import { brush, clamp, hull, inkStone, onSize, rng, smoothClosed, stableHeight, type Pt } from './ink'
import { DEMOS, type Demo } from './demos'
import { C, type Concept } from './data'

const K = C.scenes.concepts
// where each island sits inside its quarter of the sand (share of the free room), so the four read as one garden
const OX = [0.18, 0.8, 0.3, 0.7]
const OY = [0.12, 0.62, 0.38, 0.9]

/** Scene 3 — ten stones in four raked islands; each one, touched, plays its own small demo in the window. */
export function stonesScene(ctx: SceneCtx) {
  const pic = s('svg', { class: 't7s-pic', viewBox: '0 0 240 180', 'aria-hidden': 'true' })
  const idle = s('g', { class: 't7s-idle' })
  pic.append(idle)
  const name = h('p', { class: 't7s-name' })
  const term = h('span', { class: 't7s-term' })
  const say = h('p', { class: 't7s-say' })
  const cap = h('div', { class: 't7s-cap', 'aria-live': 'polite' }, h('div', { class: 't7s-head' }, name, term), say)
  const win = h('div', { class: 't7s-win' }, h('div', { class: 't7s-frame' }, pic), cap)

  const all: Concept[] = []
  const r = rng(5)
  const sand = s('svg', { class: 't7s-sand', 'aria-hidden': 'true' })
  const groups = K.groups.map((gr) => {
    const lab = h('span', { class: 't7s-glab', 'aria-hidden': 'true' }, gr.name)
    const btns = gr.items.map((it) => {
      const i = all.push(it) - 1
      return h('button', { class: 't7s-stone', type: 'button', 'aria-pressed': 'false', onClick: () => pick(i) },
        inkStone(11 + i * 7, i % 4 === 1), h('span', { class: 't7s-ring', 'aria-hidden': 'true' }), h('span', { class: 't7s-face' }, it.name))
    })
    return { row: h('div', { class: 't7s-row', role: 'group', 'aria-label': gr.name }, lab, ...btns), lab, btns }
  })
  // each stone keeps its own small irregularity (size, lean, offset) across re-layouts
  const J = all.map(() => ({ w: 0.9 + r() * 0.1, h: r(), dx: r() - 0.5, dy: r() - 0.5, rot: (r() - 0.5) * 4.5 }))
  const bed = h('div', { class: 't7s-bed', role: 'group', 'aria-label': K.group }, sand, ...groups.map((g) => g.row))
  const root = h('div', { class: 't7 t7s' }, win, bed)
  ctx.art.append(root)
  ctx.prompt(K.prompt)
  const stones = groups.flatMap((g) => g.btns)
  stones[0].classList.add('next')

  // idle window: a raked circle waiting for a stone
  for (let k = 0; k < 5; k++) idle.append(s('path', { class: 't7-k3', 'fill-opacity': 0.25, d: brush(Array.from({ length: 41 }, (_, i) => [120 + Math.cos((i / 40) * 6.3) * (24 + k * 13), 90 + Math.sin((i / 40) * 6.3) * (16 + k * 9)] as Pt), 1.2, { a: 0.2, b: 0.2 }).d }))
  idle.append(s('path', { class: 't7s-pebble', d: 'M104 92C104 82 112 78 121 78C131 78 138 83 138 91C138 99 130 103 120 103C110 103 104 100 104 92Z' }))

  const ids = [nextId('t7sf'), nextId('t7sm'), nextId('t7ss'), nextId('t7sp')]
  const seen = new Set<number>()
  let sel = -1
  let demo: Demo | null = null

  function pick(i: number) {
    if (i === sel) {
      demo?.tl.restart()
      return
    }
    sel = i
    seen.add(i)
    const it = all[i]
    stones.forEach((b, j) => {
      b.setAttribute('aria-pressed', String(j === i))
      b.classList.toggle('seen', seen.has(j))
      b.classList.remove('next')
    })
    const nx = stones.findIndex((_, j) => !seen.has(j))
    if (nx >= 0 && seen.size < 4) stones[nx].classList.add('next')
    ctx.anim(() => {
      const old = demo
      if (old) {
        old.tl.kill()
        if (ctx.reduced) old.root.remove()
        else gsap.to(old.root, { opacity: 0, duration: 0.35, onComplete: () => old.root.remove() })
      }
      if (idle.isConnected) {
        if (ctx.reduced) idle.remove()
        else gsap.to(idle, { opacity: 0, duration: 0.5, onComplete: () => idle.remove() })
      }
      const d = DEMOS[it.id]()
      demo = d
      pic.append(d.root)
      if (ctx.reduced) d.tl.progress(d.still ?? 0.8).pause()
      else {
        d.tl.pause()
        gsap.fromTo(d.root, { opacity: 0 }, { opacity: 1, duration: 0.5, delay: 0.25, onStart: () => void d.tl.restart() })
      }
      name.textContent = it.name
      term.textContent = it.term
      say.textContent = it.say
      if (!ctx.reduced) {
        gsap.fromTo(cap.children, { opacity: 0, y: 8, filter: 'blur(4px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.8, stagger: 0.12, ease: 'power3.out' })
        gsap.fromTo(stones[i].querySelector('.t7s-ring'), { scale: 0.8, opacity: 0.9 }, { scale: 1.6, opacity: 0, duration: 1.4, ease: 'power2.out' })
      }
    })
    ctx.chime('soft')
    if (seen.size === 4) ctx.insight(K.insight)
  }

  // keyboard: arrows walk the stones (and stop the player from flipping scenes)
  bed.addEventListener('keydown', (e) => {
    const k = stones.indexOf(document.activeElement as HTMLButtonElement)
    if (k < 0) return
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!d) return
    e.preventDefault()
    stones[(k + d + stones.length) % stones.length].focus()
  })

  /** The tallest caption at this width, so the window is sized for it before any stone is touched. */
  function capHeight(width: number) {
    const probe = cap.cloneNode(true) as HTMLElement
    probe.removeAttribute('aria-live')
    probe.setAttribute('aria-hidden', 'true')
    Object.assign(probe.style, { position: 'absolute', left: '0', top: '0', width: `${width}px`, visibility: 'hidden', pointerEvents: 'none' })
    root.append(probe)
    const [n, t, sy] = [probe.querySelector('.t7s-name')!, probe.querySelector('.t7s-term')!, probe.querySelector('.t7s-say')!]
    let max = 0
    for (const it of all) {
      n.textContent = it.name
      t.textContent = it.term
      sy.textContent = it.say
      max = Math.max(max, probe.offsetHeight)
    }
    probe.remove()
    return max
  }

  /** The garden: four islands of stones, rings raked around each, straight rakes between them. */
  /**
   * The garden: four islands of stones, rings raked around each, straight rakes between them.
   * 'wide' / 'tall': islands in a 2 × 2 garden, each a stone high on the right and the rest low ·
   * 'line': short landscape screens, two islands per row, their stones along a shallow arc.
   */
  function place(bw: number, bh: number, sw: number, sh: number, mode: 'wide' | 'tall' | 'line') {
    const wide = mode === 'wide'
    const rings = wide ? 3 : 2
    const gap = wide ? clamp(sh * 0.12, 5, 7.5) : 4
    const outer = rings * gap + 2
    const gy = wide ? Math.max(4, sh * 0.1) : 2
    const iw = sw * 2.08
    const ih = sh * 2.12 + gy
    const y0 = sh * 0.53
    const y1 = sh * 1.59 + gy
    const gx = sw * 0.1
    const lineW = (n: number) => n * sw + (n - 1) * gx
    const hulls: Pt[][][] = []
    let si = 0
    groups.forEach((g, gi) => {
      const n = g.btns.length
      let ox: number
      let oy: number
      if (mode === 'line') {
        const rowH = bh / 2
        const free = Math.max(0, bw - lineW(n) - lineW(groups[gi ^ 1].btns.length) - 4 * outer)
        ox = gi % 2 ? bw - outer - lineW(n) - free * 0.18 : outer + free * 0.18
        oy = Math.floor(gi / 2) * rowH + 14 + outer + Math.max(0, rowH - 14 - sh - 2 * outer) * OY[gi]
      } else {
        const cw = bw / 2
        const ch = bh / 2
        ox = (gi % 2) * cw + outer + Math.max(0, cw - iw - 2 * outer) * OX[gi]
        oy = Math.floor(gi / 2) * ch + outer + Math.max(0, ch - ih - 2 * outer) * OY[gi]
      }
      const boxes = g.btns.map((b, k) => {
        const j = J[si++]
        const w = sw * j.w
        const hh = mode === 'line' ? 44 : Math.max(44, sh * (0.93 + 0.12 * j.h))
        let x: number
        let y: number
        if (mode === 'line') [x, y] = [k * (sw + gx) + sw / 2, sh / 2 + (n === 3 ? [3, -2, 2][k] : [-2, 2][k])]
        // 2 stones: one high on the right, one low on the left · 3 stones: one high on the right, two low
        else if (k === 0) [x, y] = [iw - w * (n === 2 ? 0.52 : 0.62), y0]
        else if (k === 1) [x, y] = [w * 0.5, y1]
        else [x, y] = [iw - w * 0.5, y1]
        x += ox + j.dx * sw * 0.06
        y += oy + j.dy * sh * (mode === 'line' ? 0.03 : 0.06)
        Object.assign(b.style, { left: `${x - w / 2}px`, top: `${y - hh / 2}px`, width: `${w}px`, height: `${hh}px`, rotate: `${j.rot.toFixed(1)}deg`, fontSize: wide ? `${clamp(sh * 0.25, 13.5, 17)}px` : '' })
        return { x, y, w, h: hh }
      })
      // the group's name, raked into the sand: in the free corner of its island, or just above a line of stones
      const top = boxes[0]
      if (mode === 'line') Object.assign(g.lab.style, { left: `${ox}px`, top: `${oy - outer - 3}px`, maxWidth: 'none' })
      else Object.assign(g.lab.style, { left: `${ox}px`, top: `${top.y}px`, maxWidth: `${Math.max(40, top.x - top.w / 2 - ox - 6)}px` })
      hulls.push(Array.from({ length: rings }, (_, k) => {
        const pad = (k + 1) * gap
        return hull(boxes.flatMap((q) => Array.from({ length: 20 }, (_, a) => [q.x + Math.cos((a / 20) * 6.2832) * (q.w / 2 + pad), q.y + 2 + Math.sin((a / 20) * 6.2832) * (q.h / 2 + pad * 0.8)] as Pt)))
      }))
    })

    sand.setAttribute('viewBox', `0 0 ${bw} ${bh}`)
    const [fade, mask, soft, pool] = ids
    const outerD = hulls.map((rs) => smoothClosed(rs[rs.length - 1]))
    const rk = s('g', { mask: `url(#${mask})` })
    const pitch = wide ? 7 : 6
    for (let y = pitch / 2, k = 0; y < bh; y += pitch, k++) {
      const pts: string[] = []
      for (let x = -10; x <= bw + 20; x += 20) pts.push(`${x} ${(y + 0.9 * Math.sin(x / 37 + k * 0.9)).toFixed(1)}`)
      const d = `M${pts.join('L')}`
      rk.append(s('path', { d, class: 't7-rk' }), s('path', { d, class: 't7-rk-hi', transform: 'translate(0 1.3)' }))
    }
    const ringG = s('g', { mask: `url(#${soft})` })
    for (const rs of hulls)
      for (const ring of rs) {
        const d = smoothClosed(ring)
        ringG.append(s('path', { d, class: 't7-rk' }), s('path', { d, class: 't7-rk-hi', transform: 'translate(0 1.3)' }))
      }
    sand.replaceChildren(
      s('defs', null,
        s('radialGradient', { id: fade, cx: 0.5, cy: 0.5, r: 0.5 },
          s('stop', { offset: 0.78, 'stop-color': '#fff' }),
          s('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 })),
        s('mask', { id: mask, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: bw, height: bh },
          s('rect', { width: bw, height: bh, fill: `url(#${fade})` }),
          ...outerD.map((d) => s('path', { d, fill: '#000' }))),
        s('mask', { id: soft, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: bw, height: bh },
          s('rect', { width: bw, height: bh, fill: `url(#${fade})` })),
        s('radialGradient', { id: pool, cx: 0.5, cy: 0.5, r: 0.5 }, s('stop', { offset: 0, class: 't7-pool0' }), s('stop', { offset: 1, class: 't7-pool1' }))),
      // light pooled on the sand
      s('ellipse', { cx: bw / 2, cy: bh / 2, rx: bw * 0.55, ry: bh * 0.52, fill: `url(#${pool})` }),
      rk, ringG)
    return ih + 2 * outer
  }

  const stable = stableHeight(ctx, [K.insight], false)
  function layout() {
    const W = ctx.art.clientWidth
    const H = stable(ctx.art.clientHeight)
    if (!W || !H) return
    const wide = W / H > 1.1 && W > 560
    const short = wide && H < 330
    root.classList.toggle('wide', wide)
    root.classList.toggle('tall', !wide)
    root.classList.toggle('short', short)
    root.style.height = `${H}px`
    if (wide) {
      const colGap = clamp(W * 0.04, 28, 64)
      // the left column holds the picture and its words; on low screens the words keep a wider column
      let colW = Math.min(W * (short ? 0.3 : 0.4), 640, W - (short ? 470 : 360) - colGap)
      let ch = capHeight(colW)
      let fw = Math.min(colW, (H - ch - 8) * (4 / 3))
      if (fw > colW * 0.8) {
        colW = fw
        ch = capHeight(colW)
        fw = colW = Math.min(colW, (H - ch - 8) * (4 / 3))
        ch = capHeight(colW)
      }
      cap.style.minHeight = `${ch}px`
      const bw = Math.min(760, W - colW - colGap)
      let sh = 44
      let sw: number
      if (short) sw = Math.min(110, (bw - 8 * 10 - 20) / 5.3)
      else {
        // stones from the bed's width, bounded by its height (two rows per island, two islands high)
        sw = Math.min(150, (bw / 2 - 2 * (3 * 7 + 2) - 6) / 2.08)
        sh = clamp(sw * 0.46, 44, 68)
        const maxSh = (H / 2 - 2 * (3 * clamp(sh * 0.12, 5, 7.5) + 2) - 4) / 2.25
        if (sh > maxSh) sh = Math.max(44, maxSh)
        sw = Math.max(sw, sh * 1.7)
      }
      const bh = short ? H : Math.min(H, 2 * (sh * 2.25 + 2 * 24) + H * 0.16)
      root.style.setProperty('--ww', `${colW}px`)
      root.style.setProperty('--fw', `${fw}px`)
      root.style.setProperty('--bw', `${bw}px`)
      root.style.setProperty('--bh', `${bh}px`)
      root.style.setProperty('--colgap', `${colGap}px`)
      place(bw, bh, sw, sh, short ? 'line' : 'wide')
    } else {
      // portrait: the words span the column, the picture takes the height the stones leave
      const bw = Math.min(W, 460)
      const sw = (bw / 2 - 2 * 10 - 4) / 2.08
      const sh = 44
      root.style.setProperty('--ww', `${bw}px`)
      const ch = capHeight(bw)
      cap.style.minHeight = `${ch}px`
      root.style.setProperty('--bw', `${bw}px`)
      const bh = place(bw, 0, sw, sh, 'tall') * 2 + 2
      root.style.setProperty('--bh', `${bh}px`)
      place(bw, bh, sw, sh, 'tall')
      const fh = Math.max(110, Math.min(H - bh - ch - 16, ((bw - 8) * 3) / 4, 330))
      root.style.setProperty('--fw', `${(fh * 4) / 3}px`)
    }
  }
  onSize(ctx, ctx.art, layout)

  return () => demo?.tl.kill()
}
