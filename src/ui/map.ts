import { fill, h, s } from '../core/dom'
import { ALL_STATIONS, GARDENS, L, SITE } from '../core/content'
import { STATIONS } from '../stations/registry'
import { progress } from '../core/progress'
import { cssVar, onPrefs, prefs } from '../core/prefs'
import { gsap } from '../core/anim'
import { icon } from './icons'

type Pt = { x: number; y: number }
type Rock = Pt & { r: number; seed: number }

// Garden anchors in the free area (0..1). Landscape: the path snakes left→right; portrait: zig-zags down.
const LAND: Pt[] = [{ x: 0.1, y: 0.7 }, { x: 0.27, y: 0.3 }, { x: 0.45, y: 0.7 }, { x: 0.62, y: 0.29 }, { x: 0.77, y: 0.7 }, { x: 0.91, y: 0.32 }]
const PORT: Pt[] = [{ x: 0.3, y: 0.08 }, { x: 0.7, y: 0.25 }, { x: 0.3, y: 0.42 }, { x: 0.7, y: 0.59 }, { x: 0.3, y: 0.76 }, { x: 0.7, y: 0.93 }]

const pad = (n: number) => String(n).padStart(2, '0')

/** Home = a full-viewport zen garden. Rocks are the 6 gardens; stepping stones are the 18 stations. */
export function renderMap(root: HTMLElement, withIntro: boolean): () => void {
  const sand = h('canvas', { class: 'garden-sand', 'aria-hidden': 'true' })
  const ripple = h('canvas', { class: 'garden-ripple', 'aria-hidden': 'true' })
  const rocksSvg = s('svg', { class: 'garden-rocks', 'aria-hidden': 'true' })
  const labels = h('div', { class: 'garden-labels', 'aria-hidden': 'true' })
  const tip = h('div', { class: 'ptip', role: 'tooltip', id: 'ptip', hidden: true })
  const nextId = ALL_STATIONS.find((st) => st.id in STATIONS && !progress.isVisited(st.id))?.id
  const stones = ALL_STATIONS.map((st) => {
    const built = st.id in STATIONS
    const visited = progress.isVisited(st.id)
    const passed = progress.isPassed(st.id)
    const state = [built ? '' : L.soon, passed ? L.passed : visited ? L.visited : ''].filter(Boolean).join(', ')
    return h('a', {
      class: 'pstone',
      href: `#/tram/${st.id}`,
      'data-built': built,
      'data-visited': visited,
      'data-passed': passed,
      'data-here': st.id === nextId,
      'data-garden': st.garden.id,
      'aria-label': `${L.station} ${st.id}: ${st.title}${state ? ` — ${state}` : ''}`,
      'aria-describedby': 'ptip',
    }, h('span', { class: 'pstone-num' }, pad(st.id)))
  })
  const list = h('nav', { class: 'garden-stones', 'aria-label': SITE.hero.tagline }, ...stones)
  const note = h('p', { class: 'garden-note' }, SITE.footer.note, ' · ', h('a', { href: '#/logos' }, SITE.footer.logos))
  const hint = progress.visitedCount() ? null : h('p', { class: 'garden-hint' }, L.mapHint)
  const extras = h('nav', { class: 'garden-extras', 'aria-label': `${L.glossary} · ${L.exam}` },
    h('a', { class: 'gx', href: '#/tu-dien', title: L.glossaryHint }, icon('lantern'), h('span', null, L.glossary)),
    h('a', { class: 'gx', href: '#/bai-thi', title: L.examHint }, icon('gate'), h('span', null, L.exam)))
  const garden = h('section', { class: 'garden', 'aria-label': L.map }, sand, ripple, rocksSvg, labels, list, tip, note, hint, extras)
  root.append(garden)

  let w = 0
  let hgt = 0
  let rocks: Rock[] = []
  const dpr = () => Math.min(devicePixelRatio, prefs.quality === 'high' ? 2 : 1)

  function layout() {
    const r = garden.getBoundingClientRect()
    w = Math.round(r.width)
    hgt = Math.round(r.height)
    if (!w || !hgt) return
    const portrait = hgt > w * 1.05
    garden.toggleAttribute('data-portrait', portrait)
    const top = 80
    const bottom = portrait ? 104 : 84
    const side = portrait ? 18 : Math.max(40, w * 0.03)
    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
    const rnd = (k: number) => {
      const x = Math.sin(k * 127.1 + 311.7) * 43758.5453
      return x - Math.floor(x)
    }
    const anchors = (portrait ? PORT : LAND).map((p) => ({ x: side + p.x * (w - 2 * side), y: top + p.y * (hgt - top - bottom) }))
    const first = anchors[0], last = anchors[5]
    const P = [
      { x: first.x - (anchors[1].x - first.x) * 0.7, y: first.y - (anchors[1].y - first.y) * 0.7 },
      ...anchors,
      { x: last.x + (last.x - anchors[4].x) * 0.7, y: last.y + (last.y - anchors[4].y) * 0.7 },
    ]
    const at = (T: number): Pt => {
      const j = Math.max(0, Math.min(P.length - 2, Math.floor(T)))
      const t = T - j
      const p0 = P[Math.max(0, j - 1)], p1 = P[j], p2 = P[j + 1], p3 = P[Math.min(P.length - 1, j + 2)]
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t)
      return { x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) }
    }
    const m = Math.min(w, hgt)
    const S = Math.round(clamp(m * 0.058, 34, 54))
    const R = clamp(m * (portrait ? 0.05 : 0.07), 20, 78)
    // arc-length table so stepping stones keep an even pixel gap whatever the curve does
    const STEP = 0.004
    const Ts: number[] = []
    const Ls: number[] = []
    let acc = 0
    let prev = at(0)
    for (let T = 0; T <= P.length - 1 + 1e-9; T += STEP) {
      const p = at(T)
      acc += Math.hypot(p.x - prev.x, p.y - prev.y)
      prev = p
      Ts.push(T)
      Ls.push(acc)
    }
    const lenAt = (T: number) => Ls[Math.min(Ls.length - 1, Math.round(T / STEP))]
    const tAtLen = (Lq: number) => {
      let lo = 0, hi = Ls.length - 1
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (Ls[mid] < Lq) lo = mid + 1
        else hi = mid
      }
      return Ts[lo]
    }

    const pending: { lab: HTMLElement; half: number; cands: Pt[]; home: Pt }[] = []
    const placed: Pt[] = []
    rocks = []
    rocksSvg.replaceChildren()
    rocksSvg.setAttribute('viewBox', `0 0 ${w} ${hgt}`)
    labels.replaceChildren()
    GARDENS.forEach((g, gi) => {
      const T = gi + 1
      const c = at(T)
      const a = at(T - 0.02), b = at(T + 0.02)
      let nx = -(b.y - a.y), ny = b.x - a.x
      const len = Math.hypot(nx, ny) || 1
      nx /= len
      ny /= len
      const sideK = portrait ? (c.x < w / 2 ? -1 : 1) * Math.sign(nx || 1) : gi % 2 ? 1 : -1
      const off = R * (portrait ? 2.6 : 2.3)
      const rc = {
        x: clamp(c.x + nx * off * sideK, R * 2.5, w - R * 2.6),
        y: clamp(c.y + ny * off * sideK, top + R, hgt - bottom - R * 1.2),
      }
      // a main rock with one or two companions, set like a real garden group (never in a row)
      const cluster: Rock[] = [
        { x: rc.x, y: rc.y, r: R, seed: g.id * 1.7 },
        { x: rc.x + R * 1.3 * Math.cos(g.id * 2.1), y: rc.y + R * 0.55 * Math.sin(g.id * 2.1) + R * 0.35, r: R * 0.46, seed: g.id * 3.1 },
      ]
      if (g.stations.length > 2) cluster.push({ x: rc.x - R * 1.15, y: rc.y + R * 0.5, r: R * 0.3, seed: g.id * 5.3 })
      cluster.forEach((rk, i) => drawRock(rocksSvg, rk, g.id, i === 0))
      rocks.push(...cluster)

      const lab = h('p', { class: 'glabel', 'data-garden': g.id }, h('span', { class: 'glabel-num' }, String(g.id)), h('span', null, g.name))
      labels.append(lab)
      const half = lab.offsetWidth / 2 + 10
      const cands = [
        { x: rc.x + nx * R * 1.75 * sideK, y: rc.y + ny * R * 1.75 * sideK },
        { x: rc.x, y: rc.y - R * 1.5 },
        { x: rc.x, y: rc.y + R * 1.4 },
        { x: rc.x + (rc.x < w / 2 ? 1 : -1) * (R * 1.5 + half), y: rc.y },
        ...(portrait
          ? [
              { x: rc.x < w / 2 ? half + 4 : w - half - 4, y: rc.y + R * 1.45 },
              { x: rc.x < w / 2 ? half + 4 : w - half - 4, y: rc.y - R * 1.55 },
            ]
          : []),
      ].map((p) => ({ x: clamp(p.x, half, w - half), y: clamp(p.y, top, hgt - bottom - 10) }))
      pending.push({ lab, half, cands, home: rc })

      // stepping stones: follow the path but alternate sides, vary gap, size and turn — a hand-set walk
      const n = g.stations.length
      let sOff = -((n - 1) / 2) * S * 1.3
      g.stations.forEach((st, k) => {
        const tk = tAtLen(lenAt(T) + sOff)
        sOff += S * (1.18 + rnd(st.id * 3.3) * 0.24)
        const p = at(tk)
        const q = at(tk + 0.01)
        const tl = Math.hypot(q.x - p.x, q.y - p.y) || 1
        const pn = { x: -(q.y - p.y) / tl, y: (q.x - p.x) / tl }
        const zig = (k % 2 ? 1 : -1) * S * (0.26 + rnd(st.id) * 0.16)
        const x = p.x + pn.x * zig
        const y = p.y + pn.y * zig
        const el = stones[ALL_STATIONS.findIndex((x2) => x2.id === st.id)]
        el.style.left = `${x}px`
        el.style.top = `${y}px`
        placed.push({ x, y })
        el.style.setProperty('--S', `${(S * (0.9 + rnd(st.id + 7) * 0.2)).toFixed(1)}px`)
        el.style.setProperty('--rot', `${((Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI + (rnd(st.id + 3) - 0.5) * 40).toFixed(1)}deg`)
      })
    })
    // stepping stones never sit on a rock: nudge any overlapping stone out along the line from the rock's centre
    stones.forEach((el, i) => {
      let x = parseFloat(el.style.left), y = parseFloat(el.style.top)
      for (let pass = 0; pass < 3; pass++)
        for (const rk of rocks) {
          const dx = x - rk.x, dy = (y - rk.y) * 1.25
          const dd = Math.hypot(dx, dy) || 1
          const min = rk.r * 1.4 + S * 0.6
          if (dd < min) {
            x += (dx / dd) * (min - dd)
            y += ((dy / dd) * (min - dd)) / 1.25
          }
        }
      x = clamp(x, S * 0.6, w - S * 0.6)
      y = clamp(y, top, hgt - bottom)
      el.style.left = `${x}px`
      el.style.top = `${y}px`
      placed[i] = { x, y }
    })
    // each label takes the candidate spot that overlaps the fewest stepping stones / rocks
    const overlap = (ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) =>
      Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax - aw, bx - bw)) * Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay - ah, by - bh))
    const taken: { x: number; y: number; w: number; h: number }[] = placed.map((p) => ({ x: p.x, y: p.y, w: S * 0.6, h: S * 0.45 }))
    for (const { lab, half, cands, home } of pending) {
      const cost = (p: Pt, k: number) => {
        let v = k * 40 + Math.max(0, Math.hypot(p.x - home.x, p.y - home.y) - R * 2.2) * 25
        for (const t of taken) v += overlap(p.x, p.y, half, 13, t.x, t.y, t.w, t.h)
        for (const r2 of rocks) v += overlap(p.x, p.y, half, 13, r2.x, r2.y, r2.r * 0.95, r2.r * 0.7)
        return v
      }
      let best = cands[0], bestCost = Infinity
      cands.forEach((p, k) => {
        const v = cost(p, k)
        if (v < bestCost) (bestCost = v), (best = p)
      })
      lab.style.left = `${best.x}px`
      lab.style.top = `${best.y}px`
      taken.push({ x: best.x, y: best.y, w: half, h: 13 })
    }
    drawSand()
  }

  function drawSand() {
    const d = dpr()
    sand.width = w * d
    sand.height = hgt * d
    ripple.width = w * d
    ripple.height = hgt * d
    const g = sand.getContext('2d')!
    g.setTransform(d, 0, 0, d, 0, 0)
    g.clearRect(0, 0, w, hgt)
    const gap = Math.max(7, Math.min(11, Math.min(w, hgt) / 80))
    const K = 5
    const field = (x: number, y: number) => {
      let m = Infinity
      for (const r of rocks) m = Math.min(m, Math.hypot(x - r.x, (y - r.y) * 1.15) - r.r * 1.12)
      return m
    }
    const rake = cssVar('--rake')
    const hi = cssVar('--rake-hi')
    const stroke = (fn: () => void) => {
      for (const [col, dy] of [[hi, -0.9], [rake, 0]] as const) {
        g.save()
        g.translate(0, dy)
        g.strokeStyle = col
        g.lineWidth = 1.05
        g.beginPath()
        fn()
        g.stroke()
        g.restore()
      }
    }
    // straight raked rows, broken where they meet the rings
    const limit = (K + 0.55) * gap
    stroke(() => {
      for (let y = gap * 0.6; y < hgt; y += gap) {
        let pen = false
        for (let x = -2; x <= w + 4; x += 4) {
          const yy = y + Math.sin(x / 210 + y / 37) * 0.9
          if (field(x, yy) > limit) {
            if (pen) g.lineTo(x, yy)
            else g.moveTo(x, yy)
            pen = true
          } else pen = false
        }
      }
    })
    // concentric rings around each rock cluster = iso-lines of the distance field (marching squares)
    const c = 4
    const nx = Math.ceil(w / c) + 1, ny = Math.ceil(hgt / c) + 1
    const F = new Float32Array(nx * ny)
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) F[j * nx + i] = field(i * c, j * c)
    stroke(() => {
      for (let k = 1; k <= K; k++) {
        const lv = k * gap
        for (let j = 0; j < ny - 1; j++)
          for (let i = 0; i < nx - 1; i++) {
            const a = F[j * nx + i], b = F[j * nx + i + 1], cc = F[(j + 1) * nx + i + 1], dd = F[(j + 1) * nx + i]
            if (Math.min(a, b, cc, dd) > lv || Math.max(a, b, cc, dd) < lv) continue
            const x0 = i * c, y0 = j * c
            const pts: [number, number][] = []
            const edge = (v1: number, v2: number, p1: [number, number], p2: [number, number]) => {
              if ((v1 < lv) !== (v2 < lv)) {
                const t = (lv - v1) / (v2 - v1)
                pts.push([p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t])
              }
            }
            edge(a, b, [x0, y0], [x0 + c, y0])
            edge(b, cc, [x0 + c, y0], [x0 + c, y0 + c])
            edge(cc, dd, [x0 + c, y0 + c], [x0, y0 + c])
            edge(dd, a, [x0, y0 + c], [x0, y0])
            for (let p = 0; p + 1 < pts.length; p += 2) {
              g.moveTo(pts[p][0], pts[p][1])
              g.lineTo(pts[p + 1][0], pts[p + 1][1])
            }
          }
      }
    })
  }

  // Touching the sand sends a slow ripple — the garden answers you.
  const ripples: { x: number; y: number; t: number }[] = []
  let raf = 0
  const tick = () => {
    raf = 0
    const d = dpr()
    const g = ripple.getContext('2d')!
    g.setTransform(d, 0, 0, d, 0, 0)
    g.clearRect(0, 0, w, hgt)
    const now = performance.now()
    const col = cssVar('--ink')
    for (let i = ripples.length - 1; i >= 0; i--) {
      const age = (now - ripples[i].t) / 2600
      if (age >= 1) {
        ripples.splice(i, 1)
        continue
      }
      for (let k = 0; k < 3; k++) {
        const a = age - k * 0.12
        if (a <= 0) continue
        g.globalAlpha = (1 - a) * 0.22
        g.strokeStyle = col
        g.lineWidth = 1.2
        g.beginPath()
        g.ellipse(ripples[i].x, ripples[i].y, a * 150, a * 150 * 0.62, 0, 0, Math.PI * 2)
        g.stroke()
      }
    }
    if (ripples.length) raf = requestAnimationFrame(tick)
  }
  const onSandDown = (e: PointerEvent) => {
    if (prefs.reduced || (e.target as Element).closest('a, button')) return
    const r = garden.getBoundingClientRect()
    ripples.push({ x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() })
    if (!raf) raf = requestAnimationFrame(tick)
  }
  garden.addEventListener('pointerdown', onSandDown)

  // Tooltip: hover/focus shows the station; on touch the first tap shows it, the second enters.
  let touchArmed: HTMLElement | null = null
  let lastPointer = 'mouse'
  const showTip = (el: HTMLElement) => {
    const st = ALL_STATIONS[stones.indexOf(el as HTMLAnchorElement)]
    const built = st.id in STATIONS
    tip.replaceChildren(
      h('span', { class: 'ptip-num' }, `${L.station} ${pad(st.id)} · ${fill(L.gardenOf, { n: st.garden.id })}`),
      h('span', { class: 'ptip-title' }, st.title),
      h('span', { class: 'ptip-teaser' }, built ? st.teaser : L.soon))
    tip.hidden = false
    const r = el.getBoundingClientRect()
    const gr = garden.getBoundingClientRect()
    const tw = tip.offsetWidth
    const th = tip.offsetHeight
    const x = Math.max(10, Math.min(w - tw - 10, r.left - gr.left + r.width / 2 - tw / 2))
    const above = r.top - gr.top - th - 14
    tip.style.left = `${x}px`
    tip.style.top = `${above > 70 ? above : r.bottom - gr.top + 14}px`
    garden.dataset.focus = String(st.garden.id)
  }
  const hideTip = () => {
    tip.hidden = true
    delete garden.dataset.focus
  }
  stones.forEach((el) => {
    el.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && showTip(el))
    el.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && hideTip())
    el.addEventListener('pointerdown', (e) => (lastPointer = e.pointerType))
    el.addEventListener('focus', () => el.matches(':focus-visible') && showTip(el))
    el.addEventListener('blur', hideTip)
    el.addEventListener('click', (e) => {
      if (lastPointer !== 'mouse' && touchArmed !== el) {
        e.preventDefault()
        touchArmed = el
        showTip(el)
      }
    })
  })

  let relayout = 0
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(relayout)
    relayout = requestAnimationFrame(layout)
  })
  ro.observe(garden)
  const offPrefs = onPrefs(() => w && drawSand())
  layout()

  let introCleanup: (() => void) | null = null
  const gctx = gsap.context(() => {
    if (prefs.reduced) return
    const appear = () => {
      gsap.from(rocksSvg.children, { opacity: 0, scale: 0.9, transformOrigin: '50% 60%', stagger: 0.04, duration: 1.4, ease: 'power3.out' })
      gsap.from(stones, { opacity: 0, y: 10, stagger: 0.035, duration: 0.9, ease: 'power3.out', delay: 0.3 })
      gsap.from(labels.children, { opacity: 0, duration: 1.6, stagger: 0.08, delay: 0.6 })
      gsap.from(sand, { opacity: 0, duration: 2 })
    }
    if (withIntro) introCleanup = intro(garden, appear)
    else appear()
  }, root)
  if (withIntro && prefs.reduced) introCleanup = intro(garden, () => {})

  return () => {
    ro.disconnect()
    offPrefs()
    cancelAnimationFrame(raf)
    cancelAnimationFrame(relayout)
    introCleanup?.()
    gctx.revert()
  }
}

/**
 * First arrival. Dawn mist; a single vermilion drop falls and becomes the dot of "AI Zen.";
 * its ripple rakes the sand into rings while the letters bleed in like ink. Stepping in sends
 * one wide ripple across the garden and the mist lifts.
 */
function intro(garden: HTMLElement, then: () => void): () => void {
  const fx = h('canvas', { class: 'intro-fx', 'aria-hidden': 'true' })
  const letters = [...SITE.title].map((ch) => h('span', { class: 'intro-ch', 'aria-hidden': 'true' }, ch === ' ' ? ' ' : ch))
  const dot = h('span', { class: 'dot', 'aria-hidden': 'true' })
  const title = h('h1', { class: 'intro-title', tabindex: '-1', 'aria-label': SITE.title }, ...letters, dot)
  const tag = h('p', { class: 'intro-tag' }, SITE.hero.tagline)
  const btn = h('button', { class: 'btn primary intro-btn', type: 'button' }, SITE.hero.enter)
  const drop = h('span', { class: 'intro-drop', 'aria-hidden': 'true' })
  const mists = [1, 2, 3].map((i) => h('div', { class: `mist m${i}` }))
  const veil = h('div', { class: 'intro' }, fx, ...mists, h('div', { class: 'intro-copy' }, title, tag, btn), drop)
  garden.append(veil)
  title.focus({ preventScroll: true })

  // ── canvas: rings raked around the dot (revealed by the ripple), passing ripples, drifting dust ──
  const ctx2 = fx.getContext('2d')!
  const rake = document.createElement('canvas')
  const state = { reveal: 0 }
  const ripples: { t: number; big: boolean }[] = []
  const motes = Array.from({ length: prefs.quality === 'high' ? 70 : 34 }, (_, i) => ({
    x: Math.random(), y: Math.random(), v: 4 + Math.random() * 10, r: 0.6 + Math.random() * 1.4, ph: i * 1.7,
  }))
  let W = 1, H = 1, d = 1, cx = 0, cy = 0, Rr = 200, raf = 0, last = performance.now(), alive = true

  function size() {
    const vr = veil.getBoundingClientRect()
    W = Math.max(1, vr.width)
    H = Math.max(1, vr.height)
    d = Math.min(devicePixelRatio, prefs.quality === 'high' ? 2 : 1)
    fx.width = W * d
    fx.height = H * d
    const dr = dot.getBoundingClientRect()
    cx = dr.left - vr.left + dr.width / 2
    cy = dr.top - vr.top + dr.height / 2
    Rr = Math.min(W, H) * 0.46
    drop.style.left = `${cx}px`
    drop.style.top = `${cy}px`
    // pre-render the raked pattern once: rings around the dot, straight rows beyond
    rake.width = W * d
    rake.height = H * d
    const c = rake.getContext('2d')!
    c.setTransform(d, 0, 0, d, 0, 0)
    const gap = Math.max(8, Math.min(12, Math.min(W, H) / 70))
    const r0 = dr.width * 1.6
    for (const [col, dy] of [[cssVar('--rake-hi'), -0.9], [cssVar('--rake'), 0]] as const) {
      c.strokeStyle = col
      c.lineWidth = 1.05
      c.beginPath()
      for (let r = r0; r < Rr; r += gap) {
        c.moveTo(cx + r, cy + dy)
        c.arc(cx, cy + dy, r, 0, Math.PI * 2)
      }
      for (let y = gap * 0.5; y < H; y += gap) {
        let pen = false
        for (let x = 0; x <= W + 4; x += 4) {
          const yy = y + dy + Math.sin(x / 200 + y / 41) * 0.8
          if (Math.hypot(x - cx, yy - cy) > Rr + gap * 0.4) {
            if (pen) c.lineTo(x, yy)
            else c.moveTo(x, yy)
            pen = true
          } else pen = false
        }
      }
      c.stroke()
    }
  }

  function frame(now: number) {
    raf = 0
    if (!alive) return
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    ctx2.setTransform(d, 0, 0, d, 0, 0)
    ctx2.clearRect(0, 0, W, H)
    if (state.reveal > 0) {
      ctx2.save()
      ctx2.beginPath()
      ctx2.arc(cx, cy, state.reveal, 0, Math.PI * 2)
      ctx2.clip()
      ctx2.drawImage(rake, 0, 0, W, H)
      ctx2.restore()
    }
    const ink = cssVar('--ink')
    const ver = cssVar('--vermilion')
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i]
      const life = rp.big ? 2.2 : 3.4
      const age = (now - rp.t) / 1000 / life
      if (age >= 1) {
        ripples.splice(i, 1)
        continue
      }
      const reach = rp.big ? Math.hypot(W, H) : Rr * 1.05
      for (let k = 0; k < 3; k++) {
        const a = age - k * 0.08
        if (a <= 0) continue
        const ease = 1 - Math.pow(1 - a, 2.2)
        ctx2.globalAlpha = (1 - a) * (k === 0 ? 0.5 : 0.25)
        ctx2.strokeStyle = k === 0 ? ver : ink
        ctx2.lineWidth = k === 0 ? 1.6 : 1
        ctx2.beginPath()
        ctx2.arc(cx, cy, 6 + ease * reach, 0, Math.PI * 2)
        ctx2.stroke()
      }
    }
    ctx2.globalAlpha = 1
    // dust in dawn light, rising very slowly
    ctx2.fillStyle = ink
    for (const m of motes) {
      m.y -= (m.v * dt) / H
      if (m.y < -0.02) m.y = 1.02
      const x = m.x * W + Math.sin(now / 2400 + m.ph) * 12
      ctx2.globalAlpha = 0.16 * (0.5 + 0.5 * Math.sin(now / 1300 + m.ph))
      ctx2.beginPath()
      ctx2.arc(x, m.y * H, m.r, 0, Math.PI * 2)
      ctx2.fill()
    }
    ctx2.globalAlpha = 1
    if (!prefs.reduced) raf = requestAnimationFrame(frame)
  }
  const kick = () => {
    if (!raf && alive) raf = requestAnimationFrame(frame)
  }
  const ripple = (big = false) => {
    ripples.push({ t: performance.now(), big })
    kick()
  }

  size()
  const ro = new ResizeObserver(() => {
    size()
    kick()
  })
  ro.observe(veil)

  let idle: gsap.core.Tween | null = null
  if (prefs.reduced) {
    state.reveal = Rr * 1.2
    kick()
  } else {
    const tl = gsap.timeline()
    tl.from(mists, { opacity: 0, duration: 2.4, stagger: 0.2 }, 0)
      .fromTo(drop, { y: -cy - 60, scaleY: 2.2, scaleX: 0.7, opacity: 1 }, { y: 0, scaleY: 1, scaleX: 1, duration: 0.95, ease: 'power2.in' }, 0.35)
      .set(drop, { opacity: 0 }, 1.3)
      .fromTo(dot, { scale: 0 }, { scale: 1, duration: 1.1, ease: 'elastic.out(1, 0.45)' }, 1.3)
      .add(() => ripple(), 1.3)
      .to(state, { reveal: Rr * 1.2, duration: 3.2, ease: 'power2.out' }, 1.3)
      .from(letters, { opacity: 0, filter: 'blur(14px)', y: 12, stagger: 0.08, duration: 1.5, ease: 'power3.out' }, 1.45)
      .from(tag, { opacity: 0, y: 10, filter: 'blur(6px)', duration: 1.3, ease: 'power3.out' }, 2.3)
      .from(btn, { opacity: 0, y: 10, duration: 1.1, ease: 'power3.out' }, 2.8)
      .add(() => {
        idle = gsap.delayedCall(4.6, function again() {
          ripple()
          idle = gsap.delayedCall(4.6, again)
        })
      })
    kick()
  }

  btn.addEventListener('click', () => {
    idle?.kill()
    ripple(true)
    const tl = gsap.timeline({
      onComplete: () => {
        alive = false
        cancelAnimationFrame(raf)
        ro.disconnect()
        veil.remove()
      },
    })
    if (prefs.reduced) {
      tl.add(then).to(veil, { opacity: 0, duration: 0.01 })
    } else {
      tl.to(letters.concat(dot), { opacity: 0, y: -16, filter: 'blur(10px)', stagger: 0.04, duration: 0.8, ease: 'power2.in' }, 0)
        .to([tag, btn], { opacity: 0, y: -10, duration: 0.6, ease: 'power2.in' }, 0)
        .to(mists, { scale: 1.6, opacity: 0, duration: 1.8, stagger: 0.1, ease: 'power2.out' }, 0.2)
        .to(veil, { backgroundColor: 'transparent', duration: 1.6 }, 0.35)
        .to(fx, { opacity: 0, duration: 1.4 }, 0.7)
        .add(then, 0.55)
    }
    history.pushState(null, '', '#/vuon') // back button returns to the title; no re-render now
    ;(document.querySelector('.pstone[data-here]') as HTMLElement | null)?.focus({ preventScroll: true })
  }, { once: true })

  return () => {
    alive = false
    idle?.kill()
    cancelAnimationFrame(raf)
    ro.disconnect()
  }
}

/** Deterministic 0..1 noise from a seed. */
function hash(k: number) {
  const x = Math.sin(k * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/**
 * A garden stone: a weathered silhouette resting on a flat base, lit from the upper left,
 * with grain, speckles, a contact shadow on the sand and — on the main stone — a cushion of moss.
 */
function drawRock(svg: SVGSVGElement, r: Rock, garden: number, main: boolean) {
  const id = `rk-${garden}-${Math.round(r.seed * 100)}`
  const R = r.r
  const body = rockPath(r.x, r.y, R, r.seed)
  const rnd = (k: number) => hash(r.seed * 31 + k)
  const grain = [0, 1, 2, 3].map((i) => {
    const y0 = r.y - R * 0.34 + i * R * 0.2 + (rnd(i) - 0.5) * R * 0.08
    return s('path', {
      class: 'rock-grain',
      d: `M${(r.x - R * 1.05).toFixed(1)} ${(y0 + R * 0.08).toFixed(1)}Q${(r.x + (rnd(i + 4) - 0.5) * R * 0.6).toFixed(1)} ${(y0 - R * (0.12 + rnd(i + 8) * 0.1)).toFixed(1)} ${(r.x + R * 1.05).toFixed(1)} ${(y0 + R * 0.02).toFixed(1)}`,
    })
  })
  const specks = Array.from({ length: Math.round(10 + R * 0.5) }, (_, i) => {
    const a = rnd(i + 20) * Math.PI * 2
    const d = Math.sqrt(rnd(i + 50))
    return s('circle', { class: 'rock-speck', cx: (r.x + Math.cos(a) * d * R * 0.9).toFixed(1), cy: (r.y + Math.sin(a) * d * R * 0.6).toFixed(1), r: (0.4 + rnd(i + 80) * 0.9).toFixed(2) })
  })
  const g = s('g', { class: 'rock', 'data-garden': garden },
    s('ellipse', { class: 'rock-shadow', cx: r.x + R * 0.22, cy: r.y + R * 0.5, rx: R * 1.18, ry: R * 0.32 }),
    s('ellipse', { class: 'rock-contact', cx: r.x + R * 0.05, cy: r.y + R * 0.41, rx: R * 0.95, ry: R * 0.13 }),
    s('path', { d: body, fill: `url(#${id}-g)` }),
    s('g', { 'clip-path': `url(#${id}-c)` },
      s('ellipse', { class: 'rock-shade', cx: r.x + R * 0.4, cy: r.y + R * 0.62, rx: R * 1.1, ry: R * 0.55 }),
      s('ellipse', { class: 'rock-light', cx: r.x - R * 0.32, cy: r.y - R * 0.45, rx: R * 0.66, ry: R * 0.28 }),
      ...grain,
      ...specks),
    s('path', { class: 'rock-rim', d: body }))
  if (main && R > 24) g.append(moss(r, rnd))
  svg.append(
    s('defs', null,
      s('clipPath', { id: `${id}-c` }, s('path', { d: body })),
      s('linearGradient', { id: `${id}-g`, x1: '0.1', y1: '0', x2: '0.75', y2: '1' },
        s('stop', { offset: '0', style: 'stop-color:var(--rock-hi)' }),
        s('stop', { offset: '.5', style: 'stop-color:var(--rock-mid)' }),
        s('stop', { offset: '1', style: 'stop-color:var(--rock-lo)' }))),
    g)
}

/** Moss grows as a cushion of tiny clumps where the stone meets the sand, a little way up its side. */
function moss(r: Rock, rnd: (k: number) => number) {
  const R = r.r
  const dir = rnd(99) > 0.5 ? 1 : -1 // which side the moss favours
  const g = s('g', { class: 'moss' },
    s('ellipse', { class: 'moss-wash', cx: r.x - dir * R * 0.45, cy: r.y + R * 0.43, rx: R * 0.62, ry: R * 0.16 }))
  const n = Math.round(16 + R * 0.45)
  for (let i = 0; i < n; i++) {
    const t = rnd(i + 200)
    const along = -dir * (0.15 + t * 0.95) // from the front toward one side
    const up = Math.pow(rnd(i + 300), 1.8) * 0.32 // mostly low, a few climbing the stone
    const x = r.x + along * R
    const y = r.y + R * (0.44 - up) + (rnd(i + 400) - 0.5) * R * 0.08
    const tone = rnd(i + 500)
    g.append(s('circle', { class: tone < 0.35 ? 'moss-dot dark' : tone < 0.8 ? 'moss-dot' : 'moss-dot light', cx: x.toFixed(1), cy: y.toFixed(1), r: (0.8 + rnd(i + 600) * R * 0.036).toFixed(2) }))
  }
  return g
}

/** Weathered stone outline: irregular top, flattened base so it sits on the sand. */
function rockPath(cx: number, cy: number, R: number, seed: number): string {
  const n = 9
  const squash = 0.62 + hash(seed) * 0.2
  const pts: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + hash(seed + i) * 0.25
    const rr = R * (0.86 + hash(seed * 3 + i) * 0.22)
    let y = cy + Math.sin(a) * rr * squash
    if (Math.sin(a) > 0) y = Math.min(y, cy + R * 0.42) // flat foot
    else y -= R * 0.12 * Math.abs(Math.sin(a)) // a little taller than wide
    pts.push([cx + Math.cos(a) * rr, y])
  }
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n]
    const k = 1 / 7.5 // a touch tighter than a blob: reads as weathered stone
    d += `C${(p1[0] + (p2[0] - p0[0]) * k).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) * k).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) * k).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) * k).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return d + 'Z'
}
