import { fill, h } from '../../core/dom'
import { gsap } from '../../core/anim'
import { cssVar, onPrefs, prefs } from '../../core/prefs'
import type { Fact } from '../../core/content'
import type { SceneCtx } from '../types'
import { stoneArt } from './brush'

export interface NextWordCopy {
  prompt: string
  stonesLabel: string
  pick: string
  result: string
  next: string
  again: string
  roundOf: string
  insight: string
  regen: string
  note: Fact
  rounds: { prompt: string; choices: { w: string; p: number }[] }[]
}

const pct = (p: number) => (p < 1 ? '<1%' : `${Math.round(p)}%`)

type RGBA = [number, number, number, number]
/** '#rrggbb' or 'rgb(a)(…)' → [r, g, b, a] so the canvas can mix theme tokens. */
function rgba(css: string): RGBA {
  const m = css.match(/^#([0-9a-f]{6})$/i)
  if (m) {
    const n = parseInt(m[1], 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1]
  }
  const v = css.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 1]
  return [v[0], v[1], v[2], v[3] ?? 1]
}
const col = ([r, g, b]: RGBA, a: number) => `rgba(${r | 0},${g | 0},${b | 0},${a.toFixed(3)})`
const mixc = (a: RGBA, b: RGBA, t: number): RGBA => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, 1]

interface Stone {
  el: HTMLButtonElement
  body: HTMLElement
  float: HTMLElement
  pctEl: HTMLElement
  home: [number, number]
  w: number
  hgt: number
  p: number
}

/** Scene 3: a sentence with a blank above an ink-wash pond; word-stones float. Drop one in → washes show the odds. */
export function mountNextWord(ctx: SceneCtx, c: NextWordCopy) {
  const canvas = h('canvas', { class: 't1-water', 'aria-hidden': 'true' })
  const promptEl = h('span', { class: 't1-nw-prompt' })
  const fillEl = h('span', { class: 't1-nw-fill' })
  const blank = h('span', { class: 't1-nw-blank' }, fillEl)
  const line = h('p', { class: 't1-nw-line' }, promptEl, ' ', blank)
  const stonesEl = h('div', { class: 't1-nw-stones', role: 'group', 'aria-label': c.stonesLabel })
  const dots = c.rounds.map(() => h('span', { class: 't1-nw-dot' }))
  const counter = h('p', { class: 't1-nw-count' }, h('span', { class: 'visually-hidden' }), ...dots)
  const nextBtn = h('button', { class: 'btn ghost t1-nw-next', type: 'button', hidden: true })
  const live = h('p', { class: 'visually-hidden', 'aria-live': 'polite' })
  const root = h('div', { class: 't1-nw' }, canvas, line, stonesEl, counter, nextBtn, live)
  ctx.art.append(root)
  ctx.prompt(c.prompt)

  const cx = canvas.getContext('2d')
  const low = ctx.quality === 'low'
  let W = 1, H = 1, waterTop = 0, waterBot = 1, dpr = 1
  let stones: Stone[] = []
  let round = 0
  let picked = -1
  let top = -1
  let revealT = 0 // time the washes started blooming (seconds); 0 = not yet
  let raf = 0
  const t0 = performance.now()
  let disposed = false
  const C = { ink: rgba('#000'), ink3: rgba('#666'), ver: rgba('#c33'), moss: rgba('#575'), pond: rgba('#ccc'), pondA: 0.5, dark: false }
  const readColors = () => {
    const dark = prefs.theme === 'dark'
    const glow = rgba(cssVar('--glow-moss'))
    Object.assign(C, {
      dark,
      ink: rgba(cssVar('--ink')),
      ink3: rgba(cssVar('--ink-3')),
      ver: rgba(cssVar('--vermilion')),
      moss: rgba(cssVar('--moss')),
      pond: dark ? glow : mixc(rgba(cssVar('--moss-soft')), rgba(cssVar('--stone-2')), 0.35),
      pondA: dark ? Math.min(1, glow[3] * 1.6) : 0.85,
    })
    draw()
  }

  // ── Layout: sentence on top, pond below; stones float in a staggered row (landscape), a 2×2 drift (portrait),
  //    or one calm row when the screen is very short.
  const layout = () => {
    const r = root.getBoundingClientRect()
    W = Math.max(1, r.width)
    H = Math.max(1, r.height)
    dpr = Math.min(devicePixelRatio || 1, ctx.quality === 'low' ? 1.25 : 2)
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    const compact = H < 260
    const land = W / H > 1.15
    root.classList.toggle('is-port', !land && !compact)
    root.classList.toggle('is-compact', compact)
    const lineBox = line.getBoundingClientRect()
    waterTop = lineBox.bottom - r.top + (compact ? 6 : Math.min(36, H * 0.05))
    waterBot = H - (compact ? 2 : 54)
    const wh = Math.max(40, waterBot - waterTop)
    const spots: [number, number][] = compact
      ? [[0.14, 0.5], [0.38, 0.5], [0.62, 0.5], [0.86, 0.5]]
      : land
        ? [[0.17, 0.34], [0.39, 0.68], [0.61, 0.3], [0.83, 0.66]]
        : [[0.28, 0.2], [0.72, 0.38], [0.28, 0.62], [0.72, 0.8]]
    stones.forEach((st, i) => {
      st.w = st.el.offsetWidth
      st.hgt = st.el.offsetHeight
      st.home = [spots[i][0] * W, waterTop + spots[i][1] * wh]
      if (!st.el.classList.contains('is-dragging')) gsap.set(st.el, { x: st.home[0], y: st.home[1] })
    })
    draw()
  }

  // ── Pond: a feathered ink wash, tapered ripple strokes thickening towards the viewer, reflections under stones;
  //    after a pick, a wash blooms under every stone with area ∝ its (illustrative) probability.
  const taperedLine = (y0: number, x0: number, x1: number, hw: number, amp: number, k: number, tt: number) => {
    if (!cx || x1 - x0 < 8) return
    const n = Math.max(4, Math.round((x1 - x0) / 7))
    const top: [number, number][] = [], bot: [number, number][] = []
    for (let i = 0; i <= n; i++) {
      const u = i / n
      const x = x0 + (x1 - x0) * u
      const y = y0 + Math.sin(x * 0.012 + k * 0.7 + tt * 0.35) * amp + Math.sin(x * 0.031 - tt * 0.6 + k) * amp * 0.35
      const w = hw * Math.pow(Math.sin(Math.PI * u), 0.7) * (0.75 + 0.25 * Math.sin(x * 0.05 + k))
      top.push([x, y - w])
      bot.push([x, y + w])
    }
    cx.beginPath()
    top.forEach(([x, y], i) => (i ? cx.lineTo(x, y) : cx.moveTo(x, y)))
    for (let i = bot.length - 1; i >= 0; i--) cx.lineTo(bot[i][0], bot[i][1])
    cx.closePath()
    cx.fill()
  }

  const wash = (x: number, y: number, rx: number, ry: number, c: RGBA, a: number, soft = 0.25) => {
    if (!cx || rx < 1) return
    cx.save()
    cx.translate(x, y)
    cx.scale(1, ry / rx)
    const g = cx.createRadialGradient(0, 0, 0, 0, 0, rx)
    g.addColorStop(0, col(c, a))
    g.addColorStop(soft, col(c, a * 0.9))
    g.addColorStop(0.72, col(c, a * 0.35))
    g.addColorStop(1, col(c, 0))
    cx.fillStyle = g
    cx.beginPath()
    cx.arc(0, 0, rx, 0, Math.PI * 2)
    cx.fill()
    cx.restore()
  }

  const draw = () => {
    if (!cx) return
    const t = (performance.now() - t0) / 1000
    const still = ctx.reduced
    const tt = still ? 0 : t
    cx.setTransform(dpr, 0, 0, dpr, 0, 0)
    cx.clearRect(0, 0, W, H)
    const wh = Math.max(40, waterBot - waterTop)
    const pcx = W / 2, pcy = waterTop + wh * 0.5
    const prx = W * 0.47, pry = wh * 0.6
    // the pond itself: a feathered wash that never touches the frame
    wash(pcx, pcy, prx, pry, C.pond, C.pondA, 0.3)
    // far shore: one long, faint tapered stroke
    cx.fillStyle = col(C.ink3, C.dark ? 0.2 : 0.26)
    taperedLine(pcy - pry * 0.8, pcx - prx * 0.55, pcx + prx * 0.55, 1, 0.5, 9, 0)
    // ripple lines inside the pond: wider apart, thicker and darker towards the viewer, broken like brush strokes
    const rows = H < 260 || low ? 5 : 9
    for (let k = 0; k < rows; k++) {
      const f = (k + 1) / (rows + 1)
      const y = pcy - pry * 0.72 + pry * 1.5 * f ** 1.3
      const half = prx * Math.sqrt(Math.max(0, 1 - ((y - pcy) / pry) ** 2)) * 0.86
      if (half < 30) continue
      const xa = pcx - half, xb = pcx + half
      cx.fillStyle = col(C.ink3, (C.dark ? 0.1 : 0.1) + f * (C.dark ? 0.16 : 0.2))
      let segStart = -1
      for (let x = xa; x <= xb + 6; x += 6) {
        const on = x <= xb && Math.sin(x * 0.011 + k * 1.9 + tt * 0.1) + Math.sin(x * 0.037 - k) * 0.5 > -0.45
        if (on && segStart < 0) segStart = x
        if (!on && segStart >= 0) {
          taperedLine(y, segStart, x, 0.35 + f * 1.25, 0.8 + f * 2.2, k, tt)
          segStart = -1
        }
      }
    }
    // short strip: size the washes by width too, so 46% vs 12% stays visibly different
    const base = H < 260 ? Math.max(Math.min(W, H), W * 0.32) : Math.min(W, H)
    const shown = revealT > 0
    const grow = shown ? (still ? 1 : 1 - Math.pow(1 - Math.min(1, (t - revealT) / 2.2), 3)) : 0
    stones.forEach((st, i) => {
      if (st.el.classList.contains('is-dragging')) return
      if (i === picked && !shown) return // the stone is away, gliding to the blank
      const [sx, sy] = st.home
      const isTop = shown && i === top
      // reflection: a soft, flipped smear beneath the stone
      wash(sx + 2, sy + st.hgt * 0.62, st.w * 0.42, st.hgt * 0.55, C.ink, C.dark ? 0.1 : 0.13, 0.2)
      if (shown) {
        const R = 0.3 * base * Math.sqrt(st.p / 100) * grow
        const tint = isTop ? C.ver : C.dark ? C.moss : C.ink
        wash(sx, sy + 4, Math.max(R, 1), Math.max(R, 1) * 0.48, tint, isTop ? (C.dark ? 0.6 : 0.42) : C.dark ? 0.42 : 0.3, 0.55)
      }
      // rings: idle breathing before the pick, slow outward rings sized by probability after
      const ringR = shown ? Math.max(st.w * 0.6, 0.3 * base * Math.sqrt(st.p / 100) * 1.15) : st.w * 0.85
      const n = shown ? 3 : 2
      cx.strokeStyle = col(isTop ? C.ver : C.dark ? C.moss : C.ink3, 1)
      for (let k = 0; k < n; k++) {
        const ph = still ? (k + 0.5) / n : (((t * (shown ? 0.12 : 0.09) + k / n) % 1) + 1) % 1
        const rr = st.w * 0.5 + (ringR - st.w * 0.5) * ph * (shown ? grow : 1)
        cx.globalAlpha = (1 - ph) ** 1.3 * (isTop ? 0.8 : shown ? 0.4 : 0.38)
        cx.lineWidth = (isTop ? 1.8 : 1.2) * (1.2 - ph * 0.6)
        cx.beginPath()
        cx.ellipse(sx, sy + 4, rr, rr * 0.36, 0, 0, Math.PI * 2)
        cx.stroke()
      }
      cx.globalAlpha = 1
    })
  }
  let frameN = 0
  const loop = () => {
    raf = 0
    if (disposed) return
    if (!low || frameN++ % 2 === 0) draw() // low quality: ~30 fps
    if (!ctx.reduced && !document.hidden) raf = requestAnimationFrame(loop)
  }
  const kick = () => {
    if (!raf && !ctx.reduced && !disposed) raf = requestAnimationFrame(loop)
  }
  const onVis = () => kick()
  document.addEventListener('visibilitychange', onVis)

  // ── Rounds
  const renderRound = (focus: boolean) => {
    const r = c.rounds[round]
    picked = -1
    top = r.choices.reduce((b, ch, j) => (ch.p > r.choices[b].p ? j : b), 0)
    revealT = 0
    promptEl.textContent = r.prompt
    fillEl.textContent = ''
    blank.classList.remove('is-filled')
    nextBtn.hidden = true
    ;(counter.firstChild as HTMLElement).textContent = fill(c.roundOf, { n: round + 1, total: c.rounds.length })
    dots.forEach((d, i) => (d.className = `t1-nw-dot${i < round ? ' done' : i === round ? ' now' : ''}`))
    gsap.killTweensOf(stones.flatMap((st) => [st.el, st.body, st.float]))
    stonesEl.replaceChildren()
    stones = r.choices.map((ch, i) => {
      // body: entrance + sinking into the blank (gsap) › float: gentle bob (gsap) › in: the stone itself (CSS sink when unlikely)
      const float = h('span', { class: 't1-wstone-float' },
        h('span', { class: 't1-wstone-in' }, stoneArt(round * 10 + i + 3), h('span', { class: 't1-wstone-word' }, ch.w)))
      const body = h('span', { class: 't1-wstone-body' }, float)
      const pctEl = h('span', { class: 't1-wstone-pct', 'aria-hidden': 'true' })
      const el = h('button', { class: 't1-wstone', type: 'button', 'aria-label': fill(c.pick, { w: ch.w }) }, body, pctEl)
      stonesEl.append(el)
      gsap.set(el, { xPercent: -50, yPercent: -50 })
      return { el, body, float, pctEl, home: [0, 0], w: 100, hgt: 50, p: ch.p }
    })
    stones.forEach((st, i) => bindStone(st, i))
    layout()
    if (!ctx.reduced) {
      ctx.anim(() => {
        gsap.from(promptEl, { opacity: 0, filter: 'blur(6px)', duration: 1.2, ease: 'power2.out' })
        gsap.from(stones.map((st) => st.body), { opacity: 0, y: 26, scale: 0.9, duration: 1.3, stagger: 0.12, ease: 'power3.out' })
        stones.forEach((st, i) => gsap.to(st.float, { y: -3, duration: 2.2 + i * 0.37, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 1.3 }))
      })
    }
    if (focus) stones[0].el.focus({ preventScroll: true })
  }

  const blankCenter = () => {
    const rr = root.getBoundingClientRect()
    const b = blank.getBoundingClientRect()
    return [b.left - rr.left + b.width / 2, b.top - rr.top + b.height / 2]
  }
  const nearBlank = (x: number, y: number) => {
    const rr = root.getBoundingClientRect()
    const b = blank.getBoundingClientRect()
    const pad = 46
    return x > b.left - rr.left - pad && x < b.right - rr.left + pad && y > b.top - rr.top - pad && y < b.bottom - rr.top + pad
  }

  const bindStone = (st: Stone, i: number) => {
    let id: number | null = null
    let ox = 0, oy = 0, sx = 0, sy = 0, moved = false
    st.el.addEventListener('pointerdown', (e) => {
      if (picked >= 0 || e.button !== 0) return
      id = e.pointerId
      moved = false
      const rr = root.getBoundingClientRect()
      sx = e.clientX
      sy = e.clientY
      ox = e.clientX - rr.left - st.home[0]
      oy = e.clientY - rr.top - st.home[1]
      try {
        st.el.setPointerCapture(e.pointerId)
      } catch {
        /* pointer already gone */
      }
    })
    st.el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return
      if (!moved && Math.hypot(e.clientX - sx, e.clientY - sy) < 6) return
      moved = true
      st.el.classList.add('is-dragging')
      const rr = root.getBoundingClientRect()
      const x = e.clientX - rr.left - ox, y = e.clientY - rr.top - oy
      gsap.set(st.el, { x, y })
      blank.classList.toggle('is-near', nearBlank(x, y))
    })
    const end = (e: PointerEvent) => {
      if (e.pointerId !== id) return
      id = null
      if (!moved) return
      st.el.classList.remove('is-dragging')
      blank.classList.remove('is-near')
      const rr = root.getBoundingClientRect()
      const x = e.clientX - rr.left - ox, y = e.clientY - rr.top - oy
      if (nearBlank(x, y)) choose(i)
      else ctx.anim(() => gsap.to(st.el, { x: st.home[0], y: st.home[1], duration: 0.9, ease: 'power3.out' }))
    }
    st.el.addEventListener('pointerup', end)
    st.el.addEventListener('pointercancel', end)
    st.el.addEventListener('click', () => {
      if (moved) return void (moved = false)
      choose(i)
    })
  }

  const choose = (i: number) => {
    if (picked >= 0) return
    picked = i
    const r = c.rounds[round]
    const st = stones[i]
    stones.forEach((s2) => s2.el.setAttribute('aria-disabled', 'true'))
    root.classList.add('is-picked')
    ctx.chime(i === top ? 'ok' : 'soft')
    const reveal = () => {
      fillEl.textContent = r.choices[i].w
      blank.classList.add('is-filled')
      revealT = (performance.now() - t0) / 1000
      stones.forEach((s2, j) => {
        s2.el.classList.toggle('is-top', j === top)
        s2.el.classList.toggle('is-you', j === i)
        s2.el.classList.toggle('is-unlikely', s2.p < 5)
        s2.pctEl.textContent = pct(s2.p)
      })
      const list = [...r.choices].sort((a, b) => b.p - a.p).map((ch) => `“${ch.w}” ${pct(ch.p)}`).join(', ')
      live.textContent = fill(c.result, { list })
      nextBtn.textContent = round < c.rounds.length - 1 ? c.next : c.again
      nextBtn.hidden = false
      nextBtn.focus({ preventScroll: true })
      if (round === 0) ctx.insight(c.insight, c.note)
      else if (round === c.rounds.length - 1) ctx.insight(c.regen, c.note)
      if (ctx.reduced) return draw()
      kick()
      ctx.anim(() => {
        gsap.fromTo(fillEl, { clipPath: 'inset(0 100% 0 0)', opacity: 0.3 }, { clipPath: 'inset(0 -5% 0 0)', opacity: 1, duration: 1.1, ease: 'power2.out' })
        gsap.fromTo(stones.map((s2) => s2.pctEl), { opacity: 0, y: -4 }, { opacity: 1, y: 0, duration: 0.9, stagger: 0.12, delay: 0.6, ease: 'power3.out' })
        gsap.fromTo(nextBtn, { opacity: 0 }, { opacity: 1, duration: 0.8, delay: 1.4 })
      })
    }
    if (ctx.reduced) {
      gsap.set(st.el, { x: st.home[0], y: st.home[1] })
      return reveal()
    }
    // the stone glides to the blank, sinks into it as ink, then floats back home for the reveal
    const [bx, by] = blankCenter()
    ctx.anim(() => {
      gsap.timeline({ onComplete: reveal })
        .to(st.el, { x: bx, y: by, duration: 0.7, ease: 'power3.inOut' })
        .to(st.body, { scale: 0.6, opacity: 0, filter: 'blur(4px)', duration: 0.35, ease: 'power2.in' })
        .set(st.el, { x: st.home[0], y: st.home[1] })
        .to(st.body, { scale: 1, opacity: 1, filter: 'blur(0px)', duration: 0.8, ease: 'power3.out' }, '+=0.25')
    })
  }

  nextBtn.addEventListener('click', () => {
    round = (round + 1) % c.rounds.length
    root.classList.remove('is-picked')
    renderRound(true)
  })

  const ro = new ResizeObserver(layout)
  ro.observe(root)
  const offPrefs = onPrefs(readColors)
  readColors()
  renderRound(false)
  kick()

  return () => {
    disposed = true
    cancelAnimationFrame(raf)
    ro.disconnect()
    offPrefs()
    document.removeEventListener('visibilitychange', onVis)
  }
}
